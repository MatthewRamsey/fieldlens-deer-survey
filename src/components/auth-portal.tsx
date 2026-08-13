"use client";

import Image from "next/image";
import { useActionState } from "react";
import { signIn, signUp, type AuthFormState } from "@/app/actions/auth";

const initialState: AuthFormState = {};

export function AuthPortal() {
  const [signInState, signInAction, signInPending] = useActionState(signIn, initialState);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, initialState);

  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <div className="auth-copy">
          <div className="brand-mark">
            <Image
              className="brand-logo"
              src="https://www.uplandwildlifemanagement.com/lovable-uploads/a22bec12-9028-4ae2-aedf-59a70c278b87.png"
              alt="Upland Wildlife Management logo"
              width={172}
              height={44}
            />
            <p className="eyebrow">Upland Wildlife Management</p>
          </div>
          <h1>Supabase-backed access for landowner reports and year-based buck galleries.</h1>
          <p className="lede">
            Authentication now runs through secure server-side sessions. Property access is granted
            by profile role and client membership, not by client-side demo credentials.
          </p>
          <div className="auth-feature-list">
            <article className="auth-feature">
              <strong>Cookie-based sessions</strong>
              <p>Next 16 proxy refreshes Supabase auth cookies so pages can render safely on the server.</p>
            </article>
            <article className="auth-feature">
              <strong>Role-aware profiles</strong>
              <p>Each authenticated user gets a profile row and explicit property memberships for tenant isolation.</p>
            </article>
            <article className="auth-feature">
              <strong>RLS foundation</strong>
              <p>Supabase policies enforce who can read profiles, memberships, and client account metadata.</p>
            </article>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card-copy">
            <h2>Sign in</h2>
            <p>Use an existing Supabase account to open the property archive assigned to your profile.</p>
          </div>

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

            <button className="auth-submit" disabled={signInPending} type="submit">
              {signInPending ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="auth-card-copy">
            <h2>Request client access</h2>
            <p>Create a client account. Admin role assignment and property memberships remain controlled in Supabase.</p>
          </div>

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

            <button className="ghost-chip signout-chip" disabled={signUpPending} type="submit">
              {signUpPending ? "Creating account..." : "Create client account"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
