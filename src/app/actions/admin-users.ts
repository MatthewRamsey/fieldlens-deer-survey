"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AdminUserActionState = { error?: string; success?: string };

async function callAdminUsers(body: Record<string, string>): Promise<AdminUserActionState> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user || user.app_metadata?.super_admin !== true) {
    return { error: "Super-admin access required. Sign in again if your access was just updated." };
  }
  const { data: profile } = await supabase.from("profiles").select("role")
    .eq("id", user.id).maybeSingle<{ role: string }>();
  if (profile?.role !== "admin") return { error: "Super-admin access required." };

  const { data, error } = await supabase.functions.invoke<AdminUserActionState>("admin-users", { body });
  if (error) {
    let message = "The account change could not be completed.";
    if ("context" in error && error.context instanceof Response) {
      const result = await error.context.json().catch(() => null) as AdminUserActionState | null;
      message = result?.error ?? message;
    }
    return { error: message };
  }
  if (data?.error) return { error: data.error };
  revalidatePath("/admin/users");
  return { success: data?.success ?? "Account updated." };
}

export async function updateManagedAccount(
  _: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  const userId = String(formData.get("user_id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email) || fullName.length < 2 || fullName.length > 120) {
    return { error: "Enter a valid email and name (2–120 characters)." };
  }
  return callAdminUsers({ action: "update_account", userId, email, fullName });
}

export async function setManagedPassword(
  _: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  const userId = String(formData.get("user_id") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirm_password") ?? "");
  if (password.length < 16 || password.length > 128) {
    return { error: "Use a temporary password of 16–128 characters." };
  }
  if (password !== confirmation) return { error: "The passwords do not match." };
  return callAdminUsers({ action: "set_password", userId, password });
}
