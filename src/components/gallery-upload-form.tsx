"use client";

import { useActionState, useState } from "react";
import { createGallery, type PortalMutationState } from "@/app/actions/portal";
import type { Client } from "@/lib/portal-types";

const initialState: PortalMutationState = {};

export function GalleryUploadForm({
  client,
  selectedYear,
}: {
  client: Client;
  selectedYear: string;
}) {
  const [state, action, pending] = useActionState(createGallery, initialState);
  const [fileCount, setFileCount] = useState(0);

  return (
    <form className="upload-form" action={action}>
      <input name="client_slug" type="hidden" value={client.id} />

      <div className="form-grid">
        <label className="auth-field">
          <span>Folder name</span>
          <input name="name" placeholder="Wide Ten late-summer gallery" />
        </label>
        <label className="auth-field">
          <span>Buck name</span>
          <input name="buck_name" placeholder="Wide Ten" />
        </label>
        <label className="auth-field">
          <span>Survey year</span>
          <select defaultValue={selectedYear} name="survey_year">
            {client.surveyYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label className="auth-field">
          <span>Classification</span>
          <select defaultValue="Trophy buck" name="classification">
            <option value="Trophy buck">Trophy buck</option>
            <option value="Management buck">Management buck</option>
          </select>
        </label>
        <label className="auth-field">
          <span>Folder source</span>
          <select defaultValue="Manual upload" name="source">
            <option value="Manual upload">Direct upload</option>
            <option value="SD card">SD card</option>
            <option value="Google Drive">Google Drive</option>
          </select>
        </label>
        <label className="auth-field">
          <span>Visibility</span>
          <select defaultValue="client" name="visibility">
            <option value="client">Share with client</option>
            <option value="admin">Keep admin only</option>
          </select>
        </label>
      </div>

      <label className="auth-field">
        <span>Gallery images</span>
        <input
          multiple
          accept="image/*"
          name="images"
          type="file"
          onChange={(event) => setFileCount(event.target.files?.length ?? 0)}
        />
      </label>

      <label className="checkbox-row">
        <input defaultChecked name="qr_enabled" type="checkbox" />
        <span>Generate a QR-ready gallery link for this folder</span>
      </label>

      <label className="auth-field">
        <span>Notes</span>
        <textarea name="notes" placeholder="Add publishing notes or context for this year’s digital gallery." rows={3} />
      </label>

      {state.error ? <p className="auth-error">{state.error}</p> : null}
      {state.success ? <p className="status-pill accent">{state.success}</p> : null}

      <div className="upload-summary">
        <span>{fileCount} image(s) selected for {selectedYear}</span>
        <div className="summary-actions">
          <button className="primary-chip submit-chip" disabled={pending} type="submit">
            {pending ? "Creating..." : "Create gallery folder"}
          </button>
        </div>
      </div>
    </form>
  );
}
