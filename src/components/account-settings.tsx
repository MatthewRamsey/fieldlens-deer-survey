"use client";

import { useActionState } from "react";
import {
  requestPasswordReset,
  updatePassword,
  updateProfile,
  type AccountFormState,
} from "@/app/actions/account";
import type { Client } from "@/lib/portal-types";
import type { ViewerContext } from "@/lib/portal-data";

const initialState: AccountFormState = {};

export function AccountSettings({
  viewer,
  accessibleClients,
  resetMode = false,
}: {
  viewer: ViewerContext;
  accessibleClients: Client[];
  resetMode?: boolean;
}) {
  const [profileState, profileAction, profilePending] = useActionState(updateProfile, initialState);
  const [passwordState, passwordAction, passwordPending] = useActionState(updatePassword, initialState);
  const [resetState, resetAction, resetPending] = useActionState(requestPasswordReset, initialState);

  return (
    <section className="workspace-card">
      <div className="workspace-top">
        <div>
          <p className="eyebrow">Account management</p>
          <h2>Profile and security</h2>
          <p className="section-copy">
            Manage your display name, default property, password, and reset email access.
          </p>
        </div>
      </div>

      {resetMode ? (
        <div className="status-group">
          <span className="status-pill accent">
            Your reset link is active. Enter a new password below to finish the reset.
          </span>
        </div>
      ) : null}

      <div className="content-grid admin-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Profile</p>
              <h3>Update account details</h3>
            </div>
          </div>

          <form className="upload-form" action={profileAction}>
            <label className="auth-field">
              <span>Email</span>
              <input disabled readOnly type="email" value={viewer.email} />
            </label>

            <label className="auth-field">
              <span>Full name</span>
              <input defaultValue={viewer.fullName} name="full_name" type="text" />
            </label>

            <label className="auth-field">
              <span>Default property</span>
              <select defaultValue={viewer.defaultClientId ?? ""} name="default_client_id">
                <option value="">Choose a default property</option>
                {accessibleClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.propertyName}
                  </option>
                ))}
              </select>
            </label>

            {profileState.error ? <p className="auth-error">{profileState.error}</p> : null}
            {profileState.success ? <p className="status-pill accent">{profileState.success}</p> : null}

            <div className="upload-summary">
              <span>{viewer.role === "admin" ? "Admin profile" : "Client profile"}</span>
              <button className="primary-chip submit-chip" disabled={profilePending} type="submit">
                {profilePending ? "Saving..." : "Save profile"}
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Security</p>
              <h3>Change password</h3>
            </div>
          </div>

          <form className="upload-form" action={passwordAction}>
            <label className="auth-field">
              <span>New password</span>
              <input name="password" type="password" />
            </label>

            <label className="auth-field">
              <span>Confirm password</span>
              <input name="confirm_password" type="password" />
            </label>

            {passwordState.error ? <p className="auth-error">{passwordState.error}</p> : null}
            {passwordState.success ? <p className="status-pill accent">{passwordState.success}</p> : null}

            <div className="upload-summary">
              <span>Use at least 8 characters.</span>
              <button className="primary-chip submit-chip" disabled={passwordPending} type="submit">
                {passwordPending ? "Updating..." : "Update password"}
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Recovery</p>
              <h3>Send a reset link</h3>
            </div>
          </div>

          <form className="upload-form" action={resetAction}>
            <label className="auth-field">
              <span>Email</span>
              <input defaultValue={viewer.email} name="email" type="email" />
            </label>

            {resetState.error ? <p className="auth-error">{resetState.error}</p> : null}
            {resetState.success ? <p className="status-pill accent">{resetState.success}</p> : null}

            <div className="upload-summary">
              <span>The link will return to your account page.</span>
              <button className="ghost-chip signout-chip" disabled={resetPending} type="submit">
                {resetPending ? "Sending..." : "Email reset link"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  );
}
