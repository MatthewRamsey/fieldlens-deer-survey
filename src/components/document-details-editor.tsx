"use client";

import { useRef, useState, useTransition } from "react";
import { updatePortalDocument, type PortalMutationState } from "@/app/actions/portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ClientDocument } from "@/lib/portal-types";

export function DocumentDetailsEditor({ clientSlug, document, years, categories, onSaved }: {
  clientSlug: string;
  document: ClientDocument;
  years: string[];
  categories: string[];
  onSaved: (year: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<PortalMutationState["fieldErrors"]>({});
  const [saving, startSaving] = useTransition();
  const editButton = useRef<HTMLButtonElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const categoryListId = `document-categories-${document.id}`;

  const close = () => {
    setEditing(false);
    setError("");
    setFieldErrors({});
    requestAnimationFrame(() => editButton.current?.focus());
  };

  return <>
    <Button ref={editButton} variant="outline" type="button" aria-expanded={editing}
      aria-controls={`document-editor-${document.id}`} onClick={() => {
        setEditing(true);
        requestAnimationFrame(() => titleInput.current?.focus());
      }}>
      Edit details
    </Button>
    {editing && <form id={`document-editor-${document.id}`} className="document-edit-form" onSubmit={event => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const nextYear = String(formData.get("survey_year"));
      setError("");
      setFieldErrors({});
      startSaving(async () => {
        const result = await updatePortalDocument(clientSlug, document.id, formData);
        if (result.error || result.fieldErrors) {
          setError(result.error ?? "Correct the fields below and try again.");
          setFieldErrors(result.fieldErrors ?? {});
          return;
        }
        close();
        onSaved(nextYear);
      });
    }}>
      <div className="form-grid">
        <label className="auth-field"><span>Document title</span>
          <Input ref={titleInput} name="title" defaultValue={document.title} maxLength={200} required
            aria-invalid={Boolean(fieldErrors?.title)} aria-describedby={fieldErrors?.title ? `document-title-error-${document.id}` : undefined} />
          {fieldErrors?.title && <span className="auth-error" id={`document-title-error-${document.id}`}>{fieldErrors.title}</span>}
        </label>
        <label className="auth-field"><span>Document category</span>
          <Input name="category" defaultValue={document.category} list={categoryListId} maxLength={100} required
            aria-invalid={Boolean(fieldErrors?.category)} aria-describedby={fieldErrors?.category ? `document-category-error-${document.id}` : undefined} />
          <datalist id={categoryListId}>{categories.map(category => <option key={category} value={category} />)}</datalist>
          {fieldErrors?.category && <span className="auth-error" id={`document-category-error-${document.id}`}>{fieldErrors.category}</span>}
        </label>
        <label className="auth-field"><span>Survey year</span>
          <NativeSelect name="survey_year" defaultValue={document.surveyYear} aria-invalid={Boolean(fieldErrors?.surveyYear)}>
            {years.map(year => <option key={year} value={year}>{year}</option>)}
          </NativeSelect>
          {fieldErrors?.surveyYear && <span className="auth-error">{fieldErrors.surveyYear}</span>}
        </label>
        <label className="auth-field"><span>Visibility</span>
          <NativeSelect name="visibility" defaultValue={document.visibility} aria-invalid={Boolean(fieldErrors?.visibility)}>
            <option value="client">Publish to client</option>
            <option value="admin">Keep admin only</option>
          </NativeSelect>
          {fieldErrors?.visibility && <span className="auth-error">{fieldErrors.visibility}</span>}
        </label>
      </div>
      <label className="auth-field"><span>Notes (optional)</span>
        <Textarea name="notes" defaultValue={document.notes} maxLength={5000} rows={3}
          aria-invalid={Boolean(fieldErrors?.notes)} />
        {fieldErrors?.notes && <span className="auth-error">{fieldErrors.notes}</span>}
      </label>
      {error && <p role="alert" className="auth-error">{error}</p>}
      <div className="asset-actions">
        <Button disabled={saving} type="submit">{saving ? "Saving…" : "Save changes"}</Button>
        <Button disabled={saving} variant="outline" type="button" onClick={close}>Cancel</Button>
      </div>
    </form>}
  </>;
}
