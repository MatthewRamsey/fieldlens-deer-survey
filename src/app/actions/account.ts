"use server";

import { revalidatePath } from "next/cache";
import { getRequestOrigin } from "@/lib/request-origin";
import { getFriendlyAuthError } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/server";

export type AccountFormState = {
  error?: string;
  success?: string;
};

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function requestPasswordReset(
  _: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const email = getField(formData, "email").toLowerCase();

  if (!email) {
    return {
      error: "Enter your email address.",
    };
  }

  const supabase = await createClient();
  const nextPath = encodeURIComponent("/account?mode=reset");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await getRequestOrigin()}/auth/confirm?next=${nextPath}`,
  });

  if (error) {
    return {
      error: getFriendlyAuthError(error),
    };
  }

  return {
    success: "Password reset instructions have been sent if that account exists.",
  };
}

export async function updateProfile(
  _: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const fullName = getField(formData, "full_name");
  const defaultClientId = getField(formData, "default_client_id");

  if (!fullName) {
    return {
      error: "Enter your name.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Sign in again to update your profile.",
    };
  }

  let defaultClientAccountId: string | null = null;

  if (defaultClientId) {
    const { data: account } = await supabase
      .from("client_accounts")
      .select("id")
      .eq("slug", defaultClientId)
      .maybeSingle<{ id: string }>();

    defaultClientAccountId = account?.id ?? null;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      default_client_account_id: defaultClientAccountId,
    })
    .eq("id", user.id);

  if (profileError) {
    return {
      error: profileError.message,
    };
  }

  const { error: authError } = await supabase.auth.updateUser({
    data: {
      full_name: fullName,
    },
  });

  if (authError) {
    return {
      error: getFriendlyAuthError(authError),
    };
  }

  revalidatePath("/", "layout");
  revalidatePath("/account");

  return {
    success: "Profile updated.",
  };
}

export async function updatePassword(
  _: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const password = getField(formData, "password");
  const confirmPassword = getField(formData, "confirm_password");

  if (password.length < 8) {
    return {
      error: "Use at least 8 characters for the new password.",
    };
  }

  if (password !== confirmPassword) {
    return {
      error: "The password confirmation does not match.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return {
      error: getFriendlyAuthError(error),
    };
  }

  revalidatePath("/account");

  return {
    success: "Password updated.",
  };
}
