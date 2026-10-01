"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

function getSafeNextPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/account?mode=reset";
}

export default function ConfirmAuthPage() {
  const [error, setError] = useState<string>();

  useEffect(() => {
    async function confirm() {
      const url = new URL(window.location.href);
      const nextPath = getSafeNextPath(url.searchParams.get("next"));
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type") as EmailOtpType | null;
      const hashParams = new URLSearchParams(url.hash.slice(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const callbackError = hashParams.get("error_code") ?? url.searchParams.get("error_code");
      const supabase = createClient();

      let confirmationError;

      if (callbackError) {
        confirmationError = new Error(callbackError);
      } else if (code) {
        ({ error: confirmationError } = await supabase.auth.exchangeCodeForSession(code));
      } else if (tokenHash && type) {
        ({ error: confirmationError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        }));
      } else if (accessToken && refreshToken) {
        ({ error: confirmationError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }));
      } else {
        confirmationError = new Error("This reset link is incomplete.");
      }

      if (confirmationError) {
        setError("This reset link is invalid or has expired. Request a new link and try again.");
        return;
      }

      window.location.replace(nextPath);
    }

    void confirm();
  }, []);

  return (
    <main className="auth-shell">
      <section className="auth-hero auth-centered-stage">
        <div className="auth-card auth-centered-card">
          <p className="eyebrow">Account recovery</p>
          <h1>{error ? "Reset link unavailable" : "Opening password reset"}</h1>
          <p className={error ? "auth-error" : "lede auth-centered-lede"}>
            {error ?? "We are securely verifying your link. You will continue automatically."}
          </p>
          {error ? (
            <Link className="primary-chip submit-chip" href="/">
              Request another link
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
