"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { signUp, type AuthFormState } from "@/app/actions/auth";

const initialState: AuthFormState = {};
const brandLogoUrl =
  "https://www.uplandwildlifemanagement.com/lovable-uploads/a22bec12-9028-4ae2-aedf-59a70c278b87.png";

export function RequestAccessPanel() {
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, initialState);

  return (
    <main className="auth-shell">
      <section className="auth-hero auth-centered-stage">
        <div className="auth-card auth-centered-card">
          <div className="brand-mark auth-centered-brand">
            <Image className="brand-logo" src={brandLogoUrl} alt="Upland Wildlife Management logo" width={124} height={32} />
            <p className="eyebrow">Client Access Request</p>
          </div>

          <p className="lede auth-centered-lede">
            Fill out the request below to create a client portal account. Property access and role assignment are completed after review.
          </p>

          <div className="auth-centered-grid">
            <div className="auth-form-panel">
              <form className="auth-form" action={signUpAction}>
                <label className="auth-field">
                  <span>Name</span>
                  <input autoComplete="name" name="full_name" placeholder="Landowner name" type="text" />
                </label>

                <label className="auth-field">
                  <span>Email</span>
                  <input autoComplete="email" name="email" placeholder="owner@example.com" type="email" />
                </label>

                <label className="auth-field">
                  <span>Password</span>
                  <input autoComplete="new-password" name="password" placeholder="Create a password" type="password" />
                </label>

                {signUpState.error ? <p className="auth-error">{signUpState.error}</p> : null}
                {signUpState.success ? <p className="status-pill accent">{signUpState.success}</p> : null}

                <button className="auth-submit auth-submit-centered" disabled={signUpPending} type="submit">
                  {signUpPending ? "Submitting request..." : "Submit request"}
                </button>
              </form>

              <div className="auth-inline-actions single-row">
                <Link className="auth-text-link" href="/">
                  Back to sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
