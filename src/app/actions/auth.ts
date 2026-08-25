"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRequestOrigin } from "@/lib/request-origin";
import { getFriendlyAuthError } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error?: string;
  success?: string;
};

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function signIn(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = getField(formData, "email").toLowerCase();
  const password = getField(formData, "password");

  if (!email || !password) {
    return {
      error: "Enter an email and password.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error: getFriendlyAuthError(error),
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = getField(formData, "email").toLowerCase();
  const password = getField(formData, "password");
  const fullName = getField(formData, "full_name");

  if (!email || !password || !fullName) {
    return {
      error: "Enter your name, email, and password.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${await getRequestOrigin()}/auth/confirm`,
    },
  });

  if (error) {
    return {
      error: getFriendlyAuthError(error),
    };
  }

  revalidatePath("/", "layout");

  return {
    success: "Check your email to confirm the account, then sign in.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
