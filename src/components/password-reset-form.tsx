"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useState, type FormEvent } from "react";
import { getFriendlyAuthError } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/client";

export function PasswordResetForm({
  defaultEmail = "",
  compact = false,
}: {
  defaultEmail?: string;
  compact?: boolean;
}) {
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSuccess(undefined);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();

    if (!email) {
      setError("Enter your email address.");
      return;
    }

    setPending(true);

    try {
      const supabase = createClient();
      const nextPath = encodeURIComponent("/account?mode=reset");
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/confirm?next=${nextPath}`,
      });

      if (resetError) {
        setError(getFriendlyAuthError(resetError));
        return;
      }

      setSuccess("Password reset instructions have been sent if that account exists.");
    } catch {
      setError("We could not send the reset link. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={compact ? "auth-form compact-auth-form" : "upload-form"} onSubmit={submitReset}>
      <label className="auth-field">
        <span>Email</span>
        <Input autoComplete="email" defaultValue={defaultEmail} name="email" placeholder="owner@example.com" type="email" />
      </label>

      {error ? <p className="auth-error">{error}</p> : null}
      {success ? <p className="status-pill accent">{success}</p> : null}

      <div className={compact ? undefined : "upload-summary"}>
        {!compact ? <span>The link will return to the new-password form.</span> : null}
        <Button className="ghost-chip signout-chip" disabled={pending} type="submit">
          {pending ? "Sending..." : compact ? "Send reset link" : "Email reset link"}
        </Button>
      </div>
    </form>
  );
}
