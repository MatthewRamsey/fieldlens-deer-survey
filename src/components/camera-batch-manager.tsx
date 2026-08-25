"use client";

import { useActionState, useMemo, useState } from "react";
import { createCameraBatch, type PortalMutationState } from "@/app/actions/portal";
import { CameraBatchImageEditor } from "@/components/camera-batch-image-editor";
import type { CameraBatch, Client, SurveyYear } from "@/lib/portal-types";

const initialState: PortalMutationState = {};

function sortBatches(batches: CameraBatch[]) {
  return [...batches].sort((left, right) => {
    if (left.surveyYear !== right.surveyYear) {
      return right.surveyYear.localeCompare(left.surveyYear);
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

export function CameraBatchManager({
  client,
  selectedYear,
}: {
  client: Client;
  selectedYear: SurveyYear | "Lifetime";
}) {
  const [state, action, pending] = useActionState(createCameraBatch, initialState);
  const [fileCount, setFileCount] = useState(0);

  const visibleBatches = useMemo(() => {
    const filtered =
      selectedYear === "Lifetime"
        ? client.cameraBatches
        : client.cameraBatches.filter((batch) => batch.surveyYear === selectedYear);

    return sortBatches(filtered);
  }, [client.cameraBatches, selectedYear]);

  const [selectedBatchId, setSelectedBatchId] = useState(visibleBatches[0]?.id ?? "");
  const resolvedSelectedBatchId =
    visibleBatches.length === 0 || visibleBatches.some((batch) => batch.id === selectedBatchId)
      ? selectedBatchId
      : visibleBatches[0].id;
  const selectedBatch =
    visibleBatches.find((batch) => batch.id === resolvedSelectedBatchId) ?? visibleBatches[0] ?? null;
  const visibleImageCount = selectedBatch?.images.filter((image) => image.clientVisible).length ?? 0;
  const taggedImageCount =
    selectedBatch?.images.filter(
      (image) =>
        image.ageLabel !== "Unknown" ||
        image.deerClassification !== "Unsorted" ||
        image.lifeStatus !== "Unknown" ||
        image.antlerPoints !== null,
    ).length ?? 0;

  return (
    <section className="workspace-card camera-batch-workspace">
      <div className="workspace-top">
        <div>
          <p className="eyebrow">Camera batch review</p>
          <h2>Upload one camera at a time, then review and tag each deer image</h2>
          <p className="section-copy">
            Keep raw uploads organized by camera. Tag each image for age, antler count, alive or dead status, and management or trophy so the client-ready set can be curated afterward.
          </p>
        </div>
        <div className="book-callout">
          <strong>{visibleBatches.length}</strong>
          <span>{selectedBatch?.images.length ?? 0} images in selected batch</span>
          <span>{visibleImageCount} client-visible images</span>
        </div>
      </div>

      <div className="content-grid admin-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Batch upload</p>
              <h3>Add a new camera batch</h3>
            </div>
          </div>

          <form className="upload-form" action={action}>
            <input name="client_slug" type="hidden" value={client.id} />

            <div className="form-grid">
              <label className="auth-field">
                <span>Camera name</span>
                <input name="camera_name" placeholder="South gate scrape" />
              </label>
              <label className="auth-field">
                <span>Survey year</span>
                <select defaultValue={selectedYear === "Lifetime" ? client.surveyYears[0] : selectedYear} name="survey_year">
                  {client.surveyYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              <label className="auth-field">
                <span>Upload source</span>
                <select defaultValue="SD card" name="source">
                  <option value="SD card">SD card</option>
                  <option value="Manual upload">Manual upload</option>
                  <option value="Google Drive">Google Drive</option>
                </select>
              </label>
            </div>

            <label className="auth-field">
              <span>Batch images</span>
              <input
                multiple
                accept="image/*"
                name="images"
                type="file"
                onChange={(event) => setFileCount(event.target.files?.length ?? 0)}
              />
            </label>

            <label className="auth-field">
              <span>Notes</span>
              <textarea name="notes" placeholder="Camera location, date range, or any review notes for this pull." rows={3} />
            </label>

            {state.error ? <p className="auth-error">{state.error}</p> : null}
            {state.success ? <p className="status-pill accent">{state.success}</p> : null}

            <div className="upload-summary">
              <span>{fileCount} image(s) selected for upload</span>
              <button className="primary-chip submit-chip" disabled={pending} type="submit">
                {pending ? "Uploading..." : "Create camera batch"}
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Batch queue</p>
              <h3>Select a camera batch to review</h3>
            </div>
          </div>

          <div className="camera-batch-list">
            {visibleBatches.length ? (
              visibleBatches.map((batch) => (
                <button
                  className={`camera-batch-item ${batch.id === resolvedSelectedBatchId ? "is-active" : ""}`}
                  key={batch.id}
                  onClick={() => setSelectedBatchId(batch.id)}
                  type="button"
                >
                  <div>
                    <strong>{batch.cameraName}</strong>
                    <p>
                      {batch.surveyYear} • {batch.source}
                    </p>
                  </div>
                  <div className="camera-batch-meta">
                    <span>{batch.imageCount} images</span>
                    <span>{batch.clientVisibleCount} visible</span>
                  </div>
                </button>
              ))
            ) : (
              <article className="empty-state">
                <h3>No camera batches in this view</h3>
                <p>Upload a new pull from one camera to start reviewing and tagging deer images.</p>
              </article>
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Image review</p>
            <h3>{selectedBatch ? selectedBatch.cameraName : "Choose a batch to begin tagging"}</h3>
          </div>
          {selectedBatch ? (
            <div className="status-group">
              <span className="status-pill">{selectedBatch.surveyYear}</span>
              <span className="status-pill">{taggedImageCount} tagged</span>
              <span className="status-pill accent">{visibleImageCount} client visible</span>
            </div>
          ) : null}
        </div>

        {selectedBatch ? (
          <div className="camera-review-grid">
            {selectedBatch.images.map((image) => (
              <CameraBatchImageEditor image={image} key={image.id} />
            ))}
          </div>
        ) : (
          <article className="empty-state">
            <h3>No batch selected</h3>
            <p>Pick a camera batch from the queue to review and tag those images.</p>
          </article>
        )}
      </section>
    </section>
  );
}
