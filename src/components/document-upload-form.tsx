"use client";

import { useActionState, useState } from "react";
import { uploadDocuments, type PortalMutationState } from "@/app/actions/portal";
import type { Client } from "@/lib/portal-types";

const initialState: PortalMutationState = {};

export function DocumentUploadForm({
  client,
  selectedYear,
}: {
  client: Client;
  selectedYear: string;
}) {
  const [state, action, pending] = useActionState(uploadDocuments, initialState);
  const [fileCount, setFileCount] = useState(0);

  return (
    <form className="upload-form" action={action}>
      <input name="client_slug" type="hidden" value={client.id} />

      <div className="form-grid">
        <label className="auth-field">
          <span>Document category</span>
          <select defaultValue="Camera survey report" name="category">
            <option>Camera survey report</option>
            <option>Buck book</option>
            <option>Map export</option>
            <option>Harvest plan</option>
          </select>
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
          <span>Visibility</span>
          <select defaultValue="client" name="visibility">
            <option value="client">Publish to client</option>
            <option value="admin">Keep admin only</option>
          </select>
        </label>
        <label className="auth-field">
          <span>Upload source</span>
          <select defaultValue="Desktop upload" name="upload_source">
            <option value="Desktop upload">Desktop upload</option>
            <option value="Google Drive">Google Drive</option>
          </select>
        </label>
      </div>

      <label className="auth-field">
        <span>Files</span>
        <input
          multiple
          accept=".pdf,.doc,.docx,.zip"
          name="files"
          type="file"
          onChange={(event) => setFileCount(event.target.files?.length ?? 0)}
        />
      </label>

      <label className="auth-field">
        <span>Notes</span>
        <textarea name="notes" placeholder="Add release notes, report version context, or publishing details." rows={3} />
      </label>

      {state.error ? <p className="auth-error">{state.error}</p> : null}
      {state.success ? <p className="status-pill accent">{state.success}</p> : null}

      <div className="upload-summary">
        <span>{fileCount} file(s) selected for {selectedYear}</span>
        <button className="primary-chip submit-chip" disabled={pending} type="submit">
          {pending ? "Uploading..." : "Add report upload"}
        </button>
      </div>
    </form>
  );
}
