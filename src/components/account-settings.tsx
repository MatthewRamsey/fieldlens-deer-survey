"use client";

import { NativeSelect } from "@/components/ui/native-select";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useActionState } from "react";
import {
  updatePassword,
  updateProfile,
  type AccountFormState,
} from "@/app/actions/account";
import { PasswordResetForm } from "@/components/password-reset-form";
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

  return (
    <section className="workspace-card">
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
              <h3>Update account details</h3>
            </div>
          </div>

          <form className="upload-form" action={profileAction}>
            <label className="auth-field">
              <span>Email</span>
              <Input disabled readOnly type="email" value={viewer.email} />
            </label>

            <label className="auth-field">
              <span>Full name</span>
              <Input defaultValue={viewer.fullName} name="full_name" type="text" />
            </label>

            <label className="auth-field">
              <span>Default property</span>
              <NativeSelect defaultValue={viewer.defaultClientId ?? ""} name="default_client_id">
                <option value="">Choose a default property</option>
                {accessibleClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.propertyName}
                  </option>
                ))}
              </NativeSelect>
            </label>

            {profileState.error ? <p className="auth-error">{profileState.error}</p> : null}
            {profileState.success ? <p className="status-pill accent">{profileState.success}</p> : null}

            <div className="upload-summary">
              <span>{viewer.role === "admin" ? "Admin profile" : "Client profile"}</span>
              <Button className="primary-chip submit-chip" disabled={profilePending} type="submit">
                {profilePending ? "Saving..." : "Save profile"}
              </Button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Change password</h3>
            </div>
          </div>

          <form className="upload-form" action={passwordAction}>
            <label className="auth-field">
              <span>New password</span>
              <Input name="password" type="password" />
            </label>

            <label className="auth-field">
              <span>Confirm password</span>
              <Input name="confirm_password" type="password" />
            </label>

            {passwordState.error ? <p className="auth-error">{passwordState.error}</p> : null}
            {passwordState.success ? <p className="status-pill accent">{passwordState.success}</p> : null}

            <div className="upload-summary">
              <span>Use at least 8 characters.</span>
              <Button className="primary-chip submit-chip" disabled={passwordPending} type="submit">
                {passwordPending ? "Updating..." : "Update password"}
              </Button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Send a reset link</h3>
            </div>
          </div>

          <PasswordResetForm defaultEmail={viewer.email} />
        </section>
      </div>
    </section>
  );
}
