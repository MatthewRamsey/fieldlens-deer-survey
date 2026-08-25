"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { requestPasswordReset } from "@/app/actions/account";
import { signIn, type AuthFormState } from "@/app/actions/auth";

const initialState: AuthFormState = {};
const brandLogoUrl =
  "https://www.uplandwildlifemanagement.com/lovable-uploads/a22bec12-9028-4ae2-aedf-59a70c278b87.png";

export function AuthPortal() {
  const [resetOpen, setResetOpen] = useState(false);
  const [signInState, signInAction, signInPending] = useActionState(signIn, initialState);
  const [resetState, resetAction, resetPending] = useActionState(requestPasswordReset, initialState);

  return (
    <main className="auth-shell">
      <section className="auth-hero auth-centered-stage">
        <div className="auth-card auth-centered-card">
          <div className="brand-mark auth-centered-brand">
            <Image className="brand-logo" src={brandLogoUrl} alt="Upland Wildlife Management logo" width={124} height={32} />
            <p className="eyebrow">Upland Wildlife Management Portal</p>
          </div>

          <p className="lede auth-centered-lede">
            Sign in with your portal account to access either the internal admin workspace or your client archive.
          </p>

          <div className="auth-centered-grid">
            <div className="auth-form-panel">
              <form className="auth-form" action={signInAction}>
                <label className="auth-field">
                  <span>Email</span>
                  <input autoComplete="username" name="email" placeholder="owner@example.com" type="email" />
                </label>

                <label className="auth-field">
                  <span>Password</span>
                  <input autoComplete="current-password" name="password" placeholder="Enter your password" type="password" />
                </label>

                {signInState.error ? <p className="auth-error">{signInState.error}</p> : null}

                <button className="auth-submit auth-submit-centered" disabled={signInPending} type="submit">
                  {signInPending ? "Signing in..." : "Sign in"}
                </button>
              </form>

              <div className="auth-inline-actions">
                <button
                  aria-expanded={resetOpen}
                  className="auth-text-link"
                  onClick={() => setResetOpen((current) => !current)}
                  type="button"
                >
                  Forgot password?
                </button>

                <Link className="ghost-chip auth-secondary-button" href="/request-access">
                  Request client access
                </Link>
              </div>

              {resetOpen ? (
                <div className="auth-inline-panel">
                  <p className="auth-inline-copy">Send a password reset link to the email address attached to your portal account.</p>
                  <form className="auth-form compact-auth-form" action={resetAction}>
                    <label className="auth-field">
                      <span>Email</span>
                      <input autoComplete="email" name="email" placeholder="owner@example.com" type="email" />
                    </label>

                    {resetState.error ? <p className="auth-error">{resetState.error}</p> : null}
                    {resetState.success ? <p className="status-pill accent">{resetState.success}</p> : null}

                    <button className="ghost-chip signout-chip" disabled={resetPending} type="submit">
                      {resetPending ? "Sending link..." : "Send reset link"}
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
