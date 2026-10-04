"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getRequestOrigin } from "@/lib/request-origin";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type ClientMutationState = {
  error?: string;
  success?: string;
};

type OwnedClient = {
  id: string;
  slug: string;
  property_name: string;
};

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function parseClientDetails(formData: FormData) {
  const name = getField(formData, "name");
  const propertyName = getField(formData, "property_name");
  const county = getField(formData, "county");
  const acreage = Number.parseInt(getField(formData, "acreage"), 10);

  if (!name || !propertyName || !county || !Number.isSafeInteger(acreage) || acreage <= 0) {
    return { error: "Enter the client, property, county, and a valid acreage." } as const;
  }

  return { name, propertyName, county, acreage } as const;
}

async function getAdminSession() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sign in again before managing clients." } as const;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: "admin" | "client" }>();

  if (profile?.role !== "admin") {
    return { error: "Administrator access is required." } as const;
  }

  return { supabase, user } as const;
}

async function getOwnedClient(clientId: string) {
  const session = await getAdminSession();

  if ("error" in session) {
    return session;
  }

  const { data: membership } = await session.supabase
    .from("client_memberships")
    .select("membership_role")
    .eq("user_id", session.user.id)
    .eq("client_account_id", clientId)
    .eq("membership_role", "owner")
    .maybeSingle<{ membership_role: "owner" }>();

  if (!membership) {
    return { error: "This client is not tied to your admin account." } as const;
  }

  const { data: client } = await session.supabase
    .from("client_accounts")
    .select("id, slug, property_name")
    .eq("id", clientId)
    .maybeSingle<OwnedClient>();

  if (!client) {
    return { error: "The client account could not be found." } as const;
  }

  return { ...session, client } as const;
}

function refreshClients() {
  revalidatePath("/", "layout");
}

export async function createClientAccount(
  _: ClientMutationState,
  formData: FormData,
): Promise<ClientMutationState> {
  const details = parseClientDetails(formData);

  if ("error" in details) {
    return details;
  }

  const enteredPrefix = getField(formData, "buck_prefix");
  if (enteredPrefix && !/^[A-Za-z0-9]{1,12}$/.test(enteredPrefix)) {
    return { error: "Buck prefix must contain 1–12 letters or numbers, without spaces." };
  }
  const buckPrefix = enteredPrefix ? enteredPrefix.toUpperCase() : null;

  const session = await getAdminSession();

  if ("error" in session) {
    return session;
  }

  const baseSlug = slugify(details.propertyName) || slugify(details.name) || "client";
  const clientId = crypto.randomUUID();
  let selectedSlug = baseSlug;
  let { error } = await session.supabase.from("client_accounts").insert({
    id: clientId,
    slug: selectedSlug,
    name: details.name,
    property_name: details.propertyName,
    county: details.county,
    acreage: details.acreage,
    buck_prefix: buckPrefix,
  });

  if (error?.code === "23505") {
    selectedSlug = `${baseSlug.slice(0, 55)}-${crypto.randomUUID().slice(0, 8)}`;
    ({ error } = await session.supabase.from("client_accounts").insert({
      id: clientId,
      slug: selectedSlug,
      name: details.name,
      property_name: details.propertyName,
      county: details.county,
      acreage: details.acreage,
      buck_prefix: buckPrefix,
    }));
  }

  if (error) {
    return { error: error.message };
  }

  const { error: membershipError } = await session.supabase.from("client_memberships").insert({
    user_id: session.user.id,
    client_account_id: clientId,
    membership_role: "owner",
  });

  if (membershipError) {
    await session.supabase.from("client_accounts").delete().eq("id", clientId);
    return { error: membershipError.message };
  }

  refreshClients();
  return { success: `${details.propertyName} was added to your client list.` };
}

export async function updateClientAccount(
  _: ClientMutationState,
  formData: FormData,
): Promise<ClientMutationState> {
  const clientId = getField(formData, "client_id");
  const details = parseClientDetails(formData);

  if (!clientId || "error" in details) {
    return "error" in details ? details : { error: "The client account is missing." };
  }

  const owned = await getOwnedClient(clientId);

  if (!("client" in owned)) {
    return owned;
  }

  const { error } = await owned.supabase
    .from("client_accounts")
    .update({
      name: details.name,
      property_name: details.propertyName,
      county: details.county,
      acreage: details.acreage,
    })
    .eq("id", clientId);

  if (error) {
    return { error: error.message };
  }

  refreshClients();
  return { success: `${details.propertyName} was updated.` };
}

export async function setClientActive(
  _: ClientMutationState,
  formData: FormData,
): Promise<ClientMutationState> {
  const clientId = getField(formData, "client_id");
  const isActive = getField(formData, "is_active") === "true";
  const owned = await getOwnedClient(clientId);

  if (!("client" in owned)) {
    return owned;
  }

  const { error } = await owned.supabase
    .from("client_accounts")
    .update({ is_active: isActive })
    .eq("id", clientId);

  if (error) {
    return { error: error.message };
  }

  refreshClients();
  return { success: `${owned.client.property_name} was ${isActive ? "reactivated" : "archived"}.` };
}

export async function deleteClientAccount(
  _: ClientMutationState,
  formData: FormData,
): Promise<ClientMutationState> {
  const clientId = getField(formData, "client_id");
  const confirmation = getField(formData, "confirmation");
  const owned = await getOwnedClient(clientId);

  if (!("client" in owned)) {
    return owned;
  }

  if (confirmation !== owned.client.property_name) {
    return { error: `Enter “${owned.client.property_name}” exactly to delete this client.` };
  }

  const [documents, books, memberships] = await Promise.all([
    owned.supabase.from("client_documents").select("id", { count: "exact", head: true }).eq("client_account_id", clientId),
    owned.supabase.from("digital_buck_books").select("id", { count: "exact", head: true }).eq("client_account_id", clientId),
    owned.supabase.from("client_memberships").select("id", { count: "exact", head: true }).eq("client_account_id", clientId),
  ]);

  const countError = [documents, books, memberships].find((result) => result.error)?.error;
  if (countError) {
    return { error: countError.message };
  }

  if ([documents, books].some((result) => (result.count ?? 0) > 0) || (memberships.count ?? 0) > 1) {
    return { error: "This client has portal users or saved property records. Archive it instead." };
  }

  const { error } = await owned.supabase.from("client_accounts").delete().eq("id", clientId);

  if (error) {
    return { error: error.message };
  }

  refreshClients();
  return { success: `${owned.client.property_name} was permanently deleted.` };
}

async function findProfileByEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string,
) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", email)
    .maybeSingle<{ id: string; role: "admin" | "client" }>();

  if (error) {
    return { error: error.message } as const;
  }

  return { profile } as const;
}

export async function addClientLogin(
  _: ClientMutationState,
  formData: FormData,
): Promise<ClientMutationState> {
  const clientId = getField(formData, "client_id");
  const email = getField(formData, "email").toLowerCase();
  const fullName = getField(formData, "full_name");
  const owned = await getOwnedClient(clientId);

  if (!("client" in owned)) {
    return owned;
  }

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return { error: "Enter a valid client email address." };
  }

  const found = await findProfileByEmail(owned.supabase, email);
  if ("error" in found) {
    return { error: found.error };
  }
  if (found.profile?.role === "admin") {
    return { error: "An administrator account cannot be assigned as a client login." };
  }

  const origin = await getRequestOrigin();
  const propertyPath = `/?client=${encodeURIComponent(owned.client.slug)}`;
  const passwordSetupPath = "/account?mode=reset";
  const confirmationUrl = `${origin}/auth/confirm?next=${encodeURIComponent(passwordSetupPath)}`;
  let userId = found.profile?.id ?? null;
  let createdAccount = false;

  if (!userId) {
    const env = getSupabaseEnv();
    const signupClient = createSupabaseClient(env.url, env.publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await signupClient.auth.signUp({
      email,
      password: `${crypto.randomUUID()}Aa1!`,
      options: {
        data: { full_name: fullName || email },
        emailRedirectTo: confirmationUrl,
      },
    });

    if (error || !data.user) {
      return { error: error?.message ?? "The client account could not be created." };
    }
    if (data.user.identities?.length === 0) {
      return { error: "That email already has an account. Ask the client to request a password reset, then try again." };
    }

    userId = data.user.id;
    createdAccount = true;
  }

  const { error: profileError } = await owned.supabase.from("profiles").upsert({
    id: userId,
    email,
    full_name: fullName || email,
    role: "client",
  }, { onConflict: "id" });

  if (profileError) {
    return { error: profileError.message };
  }

  const { error: membershipError } = await owned.supabase.from("client_memberships").upsert({
    user_id: userId,
    client_account_id: clientId,
    membership_role: "viewer",
  }, { onConflict: "user_id,client_account_id" });

  if (membershipError) {
    return { error: membershipError.message };
  }

  if (!createdAccount) {
    const { error: resetError } = await owned.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(passwordSetupPath)}`,
    });
    if (resetError) {
      return { error: `Access was assigned, but the setup email could not be sent: ${resetError.message}` };
    }
  }

  refreshClients();
  return {
    success: `Client access was assigned to ${email}. A secure setup email was sent; after choosing a password, the client can use ${origin}${propertyPath}.`,
  };
}

export async function resendClientAccessEmail(
  _: ClientMutationState,
  formData: FormData,
): Promise<ClientMutationState> {
  const clientId = getField(formData, "client_id");
  const email = getField(formData, "email").toLowerCase();
  const owned = await getOwnedClient(clientId);

  if (!("client" in owned)) {
    return owned;
  }

  const { data: profile } = await owned.supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle<{ id: string }>();
  const { data: membership } = profile
    ? await owned.supabase
        .from("client_memberships")
        .select("id")
        .eq("client_account_id", clientId)
        .eq("user_id", profile.id)
        .maybeSingle<{ id: string }>()
    : { data: null };

  if (!membership) {
    return { error: "That login is not assigned to this client." };
  }

  const redirectTo = `${await getRequestOrigin()}/auth/confirm?next=${encodeURIComponent("/account?mode=reset")}`;
  const { error } = await owned.supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    return { error: error.message };
  }

  return { success: `A new password setup email was sent to ${email}.` };
}

export async function removeClientLogin(
  _: ClientMutationState,
  formData: FormData,
): Promise<ClientMutationState> {
  const clientId = getField(formData, "client_id");
  const userId = getField(formData, "user_id");
  const owned = await getOwnedClient(clientId);

  if (!("client" in owned)) {
    return owned;
  }

  const { error } = await owned.supabase
    .from("client_memberships")
    .delete()
    .eq("client_account_id", clientId)
    .eq("user_id", userId)
    .eq("membership_role", "viewer");

  if (error) {
    return { error: error.message };
  }

  refreshClients();
  return { success: "The client login was removed from this property." };
}
