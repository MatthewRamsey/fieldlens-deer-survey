"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { signIn, type AuthFormState } from "@/app/actions/auth";
import { PasswordResetForm } from "@/components/password-reset-form";
import { Card } from "@/components/ui/card";

const initialState: AuthFormState = {};
const brandLogoUrl =
  "https://www.uplandwildlifemanagement.com/lovable-uploads/a22bec12-9028-4ae2-aedf-59a70c278b87.png";

export function AuthPortal({ nextPath = "/" }: { nextPath?: string }) {
  const [resetOpen, setResetOpen] = useState(false);
  const [signInState, signInAction, signInPending] = useActionState(signIn, initialState);

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    if (fragment.has("access_token") || fragment.has("error_code")) {
      window.location.replace(`/auth/confirm${window.location.hash}`);
    }
  }, []);

  return (
    <main className="auth-shell">
      <section className="auth-hero auth-centered-stage">
        <Card className="auth-card auth-centered-card">
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
                <Input name="next" type="hidden" value={nextPath} />
                <label className="auth-field">
                  <span>Email</span>
                  <Input autoComplete="username" name="email" placeholder="owner@example.com" type="email" />
                </label>

                <label className="auth-field">
                  <span>Password</span>
                  <Input autoComplete="current-password" name="password" placeholder="Enter your password" type="password" />
                </label>

                {signInState.error ? <p className="auth-error">{signInState.error}</p> : null}

                <Button className="auth-submit auth-submit-centered" disabled={signInPending} type="submit">
                  {signInPending ? "Signing in..." : "Sign in"}
                </Button>
              </form>

              <div className="auth-inline-actions">
                <Button
                  aria-expanded={resetOpen}
                  className="auth-text-link"
                  onClick={() => setResetOpen((current) => !current)}
                  type="button"
                >
                  Forgot password?
                </Button>

                <Link className="ghost-chip auth-secondary-button" href="/request-access">
                  Request client access
                </Link>
              </div>

              {resetOpen ? (
                <div className="auth-inline-panel">
                  <p className="auth-inline-copy">Send a password reset link to the email address attached to your portal account.</p>
                  <PasswordResetForm compact />
                </div>
              ) : null}
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
