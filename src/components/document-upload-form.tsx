"use client";

import { NativeSelect } from "@/components/ui/native-select";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUp } from "lucide-react";

import { submitPortalUpload } from "@/lib/portal-upload";
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
  const [state, action, pending] = useActionState((state: PortalMutationState, form: FormData) => submitPortalUpload(uploadDocuments, state, form, "client-documents", "files"), initialState);
  const [fileCount, setFileCount] = useState(0);
  const categorySuggestions = [...new Set([
    "Camera survey report", "Map export", "Harvest plan",
    ...client.documents.filter(document => !document.deletedAt).map(document => document.category),
  ])];

  return (
    <form className="upload-form" action={action}>
      <Input name="client_slug" type="hidden" value={client.id} />

      <div className="form-grid">
        <label className="auth-field">
          <span>Document category</span>
          <Input autoComplete="off" list="document-category-suggestions" maxLength={100} name="category"
            placeholder="Example: Habitat assessment" required />
          <datalist id="document-category-suggestions">
            {categorySuggestions.map(category => <option key={category} value={category} />)}
          </datalist>
        </label>
        <label className="auth-field">
          <span>Survey year</span>
          <NativeSelect defaultValue={selectedYear} name="survey_year">
            {client.surveyYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="auth-field">
          <span>Visibility</span>
          <NativeSelect defaultValue="client" name="visibility">
            <option value="client">Publish to client</option>
            <option value="admin">Keep admin only</option>
          </NativeSelect>
        </label>
        <label className="auth-field">
          <span>Upload source</span>
          <NativeSelect defaultValue="Desktop upload" name="upload_source">
            <option value="Desktop upload">Desktop upload</option>
            <option value="Google Drive">Google Drive</option>
          </NativeSelect>
        </label>
      </div>

      <div className="auth-field portal-file-picker">
        <label htmlFor="report-files">Files</label>
        <Input
          id="report-files"
          className="portal-file-input"
          multiple
          accept=".pdf,.doc,.docx,.zip"
          name="files"
          type="file"
          onChange={(event) => setFileCount(event.target.files?.length ?? 0)}
        />
        <label className="portal-file-trigger" htmlFor="report-files"><FileUp aria-hidden="true" /> Choose report files</label>
        <span className="portal-file-help">{fileCount ? `${fileCount} file${fileCount === 1 ? "" : "s"} selected` : "PDF, DOC, DOCX, or ZIP"}</span>
      </div>

      <label className="auth-field">
        <span>Notes</span>
        <Textarea name="notes" placeholder="Example: Revised 2026 survey findings." rows={3} />
      </label>

      {state.error ? <p className="auth-error">{state.error}</p> : null}
      {state.success ? <p className="status-pill accent">{state.success}</p> : null}

      <div className="upload-summary">
        <span>{fileCount} file(s) selected for {selectedYear}</span>
        <Button className="primary-chip submit-chip" disabled={pending} type="submit">
          {pending ? "Uploading..." : "Add report upload"}
        </Button>
      </div>
    </form>
  );
}
