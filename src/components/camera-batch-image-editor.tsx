"use client";

import Image from "next/image";
import { useActionState } from "react";
import { updateCameraBatchImageReview, type PortalMutationState } from "@/app/actions/portal";
import type { CameraBatchImage } from "@/lib/portal-types";

const initialState: PortalMutationState = {};

const ageOptions: CameraBatchImage["ageLabel"][] = [
  "Unknown",
  "Fawn",
  "1.5 years",
  "2.5 years",
  "3.5 years",
  "4.5 years",
  "5.5+ years",
];

const lifeOptions: CameraBatchImage["lifeStatus"][] = ["Unknown", "Alive", "Dead"];
const classOptions: CameraBatchImage["deerClassification"][] = ["Unsorted", "Management", "Trophy"];

export function CameraBatchImageEditor({ image }: { image: CameraBatchImage }) {
  const [state, action, pending] = useActionState(updateCameraBatchImageReview, initialState);

  return (
    <article className="camera-review-card">
      <div className="camera-review-image-frame">
        <Image
          alt={image.fileName}
          className="camera-review-image"
          height={260}
          src={image.url}
          unoptimized
          width={360}
        />
      </div>

      <div className="camera-review-top">
        <div>
          <h3>{image.fileName}</h3>
          <p>
            Image {image.displayOrder + 1}
            {image.capturedAt ? ` • ${new Date(image.capturedAt).toLocaleString("en-US")}` : ""}
          </p>
        </div>
        <span className={`label-chip ${image.clientVisible ? "doe" : "neutral"}`}>
          {image.clientVisible ? "Client visible" : "Admin only"}
        </span>
      </div>

      <form action={action} className="upload-form compact-upload-form">
        <input name="image_id" type="hidden" value={image.id} />

        <div className="form-grid compact-grid">
          <label className="auth-field">
            <span>Age</span>
            <select defaultValue={image.ageLabel} name="age_label">
              {ageOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="auth-field">
            <span>Antler count</span>
            <input defaultValue={image.antlerPoints ?? ""} min={0} name="antler_points" placeholder="8" type="number" />
          </label>

          <label className="auth-field">
            <span>Alive / dead</span>
            <select defaultValue={image.lifeStatus} name="life_status">
              {lifeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="auth-field">
            <span>Management / trophy</span>
            <select defaultValue={image.deerClassification} name="deer_classification">
              {classOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="checkbox-row">
          <input defaultChecked={image.clientVisible} name="client_visible" type="checkbox" />
          <span>Show this image in the client-ready buck book and gallery set</span>
        </label>

        <label className="auth-field">
          <span>Review notes</span>
          <textarea defaultValue={image.reviewNotes} name="review_notes" placeholder="Optional notes for this deer or image." rows={2} />
        </label>

        {state.error ? <p className="auth-error">{state.error}</p> : null}
        {state.success ? <p className="status-pill accent">{state.success}</p> : null}

        <button className="ghost-chip submit-chip" disabled={pending} type="submit">
          {pending ? "Saving..." : "Save tags"}
        </button>
      </form>
    </article>
  );
}
