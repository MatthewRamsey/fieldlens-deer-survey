import type { AuthError } from "@supabase/supabase-js";

function includesCode(error: AuthError, code: string) {
  return error.code === code || error.message.includes(code);
}

export function getFriendlyAuthError(error: AuthError) {
  if (includesCode(error, "over_email_send_rate_limit")) {
    return "Email sending is temporarily throttled. No account was created. Please wait a bit before trying again.";
  }

  if (includesCode(error, "email rate limit exceeded")) {
    return "Email sending is temporarily throttled. Please wait a bit before trying again.";
  }

  if (includesCode(error, "invalid_credentials")) {
    return "The email or password did not match an existing account.";
  }

  return error.message;
}
