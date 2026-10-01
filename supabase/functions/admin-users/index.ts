import { createClient } from "npm:@supabase/supabase-js@2";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function respond(body: { error?: string; success?: string }, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async request => {
  if (request.method !== "POST") return respond({ error: "Method not allowed." }, 405);
  const authorization = request.headers.get("Authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!accessToken) return respond({ error: "Sign in again." }, 401);

  const projectUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!projectUrl || !serviceKey) return respond({ error: "Account management is unavailable." }, 503);
  const admin = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user: actor }, error: actorError } = await admin.auth.getUser(accessToken);
  if (actorError || !actor) return respond({ error: "Sign in again." }, 401);
  if (actor.app_metadata?.super_admin !== true) return respond({ error: "Super-admin access required." }, 403);
  const { data: actorProfile, error: profileError } = await admin.from("profiles")
    .select("role").eq("id", actor.id).maybeSingle<{ role: string }>();
  if (profileError || actorProfile?.role !== "admin") return respond({ error: "Super-admin access required." }, 403);

  let payload: Record<string, unknown>;
  try {
    if (Number(request.headers.get("Content-Length") ?? 0) > 8192) return respond({ error: "Request too large." }, 413);
    payload = await request.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return respond({ error: "Invalid request." }, 400);
  } catch {
    return respond({ error: "Invalid request." }, 400);
  }
  const targetId = typeof payload.userId === "string" ? payload.userId : "";
  if (!uuid.test(targetId)) return respond({ error: "Choose a valid user." }, 400);
  const { data: target, error: targetError } = await admin.auth.admin.getUserById(targetId);
  if (targetError || !target.user) return respond({ error: "User not found." }, 404);

  if (payload.action === "set_password") {
    const password = typeof payload.password === "string" ? payload.password : "";
    if (password.length < 16 || password.length > 128) {
      return respond({ error: "Use a temporary password of 16–128 characters." }, 400);
    }
    const { error } = await admin.auth.admin.updateUserById(targetId, { password });
    if (error) return respond({ error: error.message }, 400);
    console.info(JSON.stringify({ event: "super_admin_password_reset", actorId: actor.id, targetId }));
    return respond({ success: "Temporary password set." });
  }

  if (payload.action === "update_account") {
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const fullName = typeof payload.fullName === "string" ? payload.fullName.trim() : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || fullName.length < 2 || fullName.length > 120) {
      return respond({ error: "Enter a valid email and name (2–120 characters)." }, 400);
    }
    const { data: duplicate, error: duplicateError } = await admin.from("profiles")
      .select("id").eq("email", email).neq("id", targetId).maybeSingle<{ id: string }>();
    if (duplicateError) return respond({ error: "Could not check the email address." }, 500);
    if (duplicate) return respond({ error: "That email is already used by another account." }, 409);

    const previousEmail = target.user.email ?? "";
    const previousMetadata = target.user.user_metadata ?? {};
    const { error: authError } = await admin.auth.admin.updateUserById(targetId, {
      email,
      user_metadata: { ...previousMetadata, full_name: fullName },
    });
    if (authError) return respond({ error: authError.message }, 400);
    const { data: updatedProfile, error: updateError } = await admin.from("profiles")
      .update({ email, full_name: fullName }).eq("id", targetId).select("id").maybeSingle();
    if (updateError || !updatedProfile) {
      const { error: rollbackError } = await admin.auth.admin.updateUserById(targetId, {
        email: previousEmail,
        user_metadata: previousMetadata,
      });
      console.error(JSON.stringify({ event: "super_admin_account_update_failed", actorId: actor.id, targetId, rollbackFailed: Boolean(rollbackError) }));
      return respond({ error: "Account changes could not be saved. Please try again." }, 500);
    }
    console.info(JSON.stringify({ event: "super_admin_account_updated", actorId: actor.id, targetId }));
    return respond({ success: "Account details updated." });
  }

  return respond({ error: "Unknown action." }, 400);
});
