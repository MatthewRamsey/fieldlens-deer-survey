"use server";

import { revalidatePath } from "next/cache";
import type {
  DeerAgeLabel,
  DeerClassification,
  DeerLifeStatus,
  DocumentCategory,
  DocumentVisibility,
} from "@/lib/portal-types";
import { createClient } from "@/lib/supabase/server";

export type PortalMutationState = {
  error?: string;
  success?: string;
};

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function buildFileType(file: File) {
  const extension = file.name.split(".").pop()?.toUpperCase();
  return extension || file.type || "FILE";
}

function getAntlerPoints(formData: FormData, key: string) {
  const value = getField(formData, key);

  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getAccessibleClientAccountId(clientSlug: string) {
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("client_accounts")
    .select("id, slug")
    .eq("slug", clientSlug)
    .maybeSingle<{ id: string; slug: string }>();

  return {
    supabase,
    accountId: account?.id ?? null,
  };
}

export async function uploadDocuments(
  _: PortalMutationState,
  formData: FormData,
): Promise<PortalMutationState> {
  const clientSlug = getField(formData, "client_slug");
  const surveyYear = getField(formData, "survey_year");
  const category = getField(formData, "category") as DocumentCategory;
  const visibility = getField(formData, "visibility") as DocumentVisibility;
  const uploadSource = getField(formData, "upload_source");
  const notes = getField(formData, "notes");
  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!clientSlug || !surveyYear || files.length === 0) {
    return {
      error: "Choose a client, survey year, and at least one file.",
    };
  }

  const { supabase, accountId } = await getAccessibleClientAccountId(clientSlug);

  if (!accountId) {
    return {
      error: "The selected client could not be found for this account.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Sign in again before uploading files.",
    };
  }

  for (const file of files) {
    const documentId = crypto.randomUUID();
    const filePath = `${accountId}/documents/${documentId}/${sanitizeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("client-documents")
      .upload(filePath, file, {
        cacheControl: "3600",
        contentType: file.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      return {
        error: uploadError.message,
      };
    }

    const title = file.name.replace(/\.[^.]+$/, "");
    const { error: insertError } = await supabase.from("client_documents").insert({
      id: documentId,
      client_account_id: accountId,
      title,
      category,
      survey_year: surveyYear,
      file_path: filePath,
      file_type: buildFileType(file),
      visibility,
      status: visibility === "client" ? "published" : "draft",
      notes: notes || `Uploaded into the ${surveyYear} property archive.`,
      upload_source: uploadSource || "Desktop upload",
      uploaded_by: user.id,
    });

    if (insertError) {
      return {
        error: insertError.message,
      };
    }
  }

  revalidatePath("/", "layout");

  return {
    success: `${files.length} document${files.length === 1 ? "" : "s"} uploaded.`,
  };
}

export async function createGallery(
  _: PortalMutationState,
  formData: FormData,
): Promise<PortalMutationState> {
  const clientSlug = getField(formData, "client_slug");
  const surveyYear = getField(formData, "survey_year");
  const folderName = getField(formData, "name");
  const buckName = getField(formData, "buck_name");
  const classification = getField(formData, "classification");
  const source = getField(formData, "source");
  const visibility = getField(formData, "visibility") as DocumentVisibility;
  const notes = getField(formData, "notes");
  const qrEnabled = formData.get("qr_enabled") === "on";
  const files = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!clientSlug || !surveyYear || !folderName || !buckName || files.length === 0) {
    return {
      error: "Enter the gallery details and choose at least one image.",
    };
  }

  const { supabase, accountId } = await getAccessibleClientAccountId(clientSlug);

  if (!accountId) {
    return {
      error: "The selected client could not be found for this account.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Sign in again before creating a gallery.",
    };
  }

  const galleryId = crypto.randomUUID();
  const gallerySlug = `${slugify(folderName) || "gallery"}-${galleryId.slice(0, 8)}`;

  const { error: galleryInsertError } = await supabase.from("buck_galleries").insert({
    id: galleryId,
    client_account_id: accountId,
    slug: gallerySlug,
    name: folderName,
    buck_name: buckName,
    classification,
    survey_year: surveyYear,
    image_count: files.length,
    source,
    visibility,
    qr_enabled: qrEnabled,
    notes: notes || `Digital gallery added to the ${surveyYear} archive.`,
    created_by: user.id,
  });

  if (galleryInsertError) {
    return {
      error: galleryInsertError.message,
    };
  }

  const rows: Array<{
    id: string;
    gallery_id: string;
    client_account_id: string;
    file_path: string;
    file_name: string;
    created_by: string;
    display_order: number;
  }> = [];

  for (const [index, file] of files.entries()) {
    const imageId = crypto.randomUUID();
    const filePath = `${accountId}/galleries/${galleryId}/${index + 1}-${sanitizeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("buck-gallery-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        contentType: file.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      return {
        error: uploadError.message,
      };
    }

    rows.push({
      id: imageId,
      gallery_id: galleryId,
      client_account_id: accountId,
      file_path: filePath,
      file_name: file.name,
      created_by: user.id,
      display_order: index,
    });
  }

  const { error: imageInsertError } = await supabase.from("buck_gallery_images").insert(rows);

  if (imageInsertError) {
    return {
      error: imageInsertError.message,
    };
  }

  revalidatePath("/", "layout");

  return {
    success: `Gallery created with ${files.length} image${files.length === 1 ? "" : "s"}.`,
  };
}

export async function createCameraBatch(
  _: PortalMutationState,
  formData: FormData,
): Promise<PortalMutationState> {
  const clientSlug = getField(formData, "client_slug");
  const surveyYear = getField(formData, "survey_year");
  const cameraName = getField(formData, "camera_name");
  const source = getField(formData, "source");
  const notes = getField(formData, "notes");
  const files = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!clientSlug || !surveyYear || !cameraName || files.length === 0) {
    return {
      error: "Enter the camera details and choose at least one image.",
    };
  }

  const { supabase, accountId } = await getAccessibleClientAccountId(clientSlug);

  if (!accountId) {
    return {
      error: "The selected client could not be found for this account.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Sign in again before creating a camera batch.",
    };
  }

  const batchId = crypto.randomUUID();
  const { error: batchInsertError } = await supabase.from("camera_batches").insert({
    id: batchId,
    client_account_id: accountId,
    survey_year: surveyYear,
    camera_name: cameraName,
    source: source || "SD card",
    notes: notes || `Batch uploaded for ${cameraName} in ${surveyYear}.`,
    created_by: user.id,
  });

  if (batchInsertError) {
    return {
      error: batchInsertError.message,
    };
  }

  const rows: Array<{
    id: string;
    batch_id: string;
    client_account_id: string;
    file_path: string;
    file_name: string;
    created_by: string;
    display_order: number;
  }> = [];

  for (const [index, file] of files.entries()) {
    const imageId = crypto.randomUUID();
    const filePath = `${accountId}/camera-batches/${batchId}/${index + 1}-${sanitizeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("camera-batch-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        contentType: file.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      return {
        error: uploadError.message,
      };
    }

    rows.push({
      id: imageId,
      batch_id: batchId,
      client_account_id: accountId,
      file_path: filePath,
      file_name: file.name,
      created_by: user.id,
      display_order: index,
    });
  }

  const { error: imageInsertError } = await supabase.from("camera_batch_images").insert(rows);

  if (imageInsertError) {
    return {
      error: imageInsertError.message,
    };
  }

  revalidatePath("/", "layout");

  return {
    success: `Camera batch created with ${files.length} image${files.length === 1 ? "" : "s"}.`,
  };
}

export async function updateCameraBatchImageReview(
  _: PortalMutationState,
  formData: FormData,
): Promise<PortalMutationState> {
  const imageId = getField(formData, "image_id");
  const ageLabel = getField(formData, "age_label") as DeerAgeLabel;
  const antlerPoints = getAntlerPoints(formData, "antler_points");
  const lifeStatus = getField(formData, "life_status") as DeerLifeStatus;
  const deerClassification = getField(formData, "deer_classification") as DeerClassification;
  const clientVisible = formData.get("client_visible") === "on";
  const reviewNotes = getField(formData, "review_notes");

  if (!imageId) {
    return {
      error: "Choose an image to review.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("camera_batch_images")
    .update({
      age_label: ageLabel || "Unknown",
      antler_points: antlerPoints,
      life_status: lifeStatus || "Unknown",
      deer_classification: deerClassification || "Unsorted",
      client_visible: clientVisible,
      review_notes: reviewNotes,
    })
    .eq("id", imageId);

  if (error) {
    return {
      error: error.message,
    };
  }

  revalidatePath("/", "layout");

  return {
    success: "Image tags saved.",
  };
}
