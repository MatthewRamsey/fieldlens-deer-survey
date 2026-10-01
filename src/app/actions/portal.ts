"use server";

import { revalidatePath } from "next/cache";
import type { DocumentCategory, DocumentVisibility } from "@/lib/portal-types";
import { createClient } from "@/lib/supabase/server";

export type PortalMutationState = {
  error?: string;
  success?: string;
};

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

type UploadedAsset = { id: string; path: string; name: string; type: string };

function getUploadedFiles(formData: FormData): UploadedAsset[] {
  try {
    const value: unknown = JSON.parse(String(formData.get("uploaded_files") ?? "[]"));
    if (!Array.isArray(value)) return [];
    return value.filter((file): file is UploadedAsset => Boolean(file) && typeof file.id === "string" && typeof file.path === "string" && typeof file.name === "string" && typeof file.type === "string");
  } catch { return []; }
}

function validPaths(files: UploadedAsset[], accountId: string, bucket: string) {
  return files.every(file => file.path.startsWith(`${accountId}/${bucket}/${file.id}/`) && !file.path.includes("..") && /^[0-9a-f-]{36}$/.test(file.id));
}

function buildFileType(file: UploadedAsset) {
  return file.name.split(".").pop()?.toUpperCase() || "FILE";
}

async function getAccessibleClientAccountId(clientSlug: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, accountId: null };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { supabase, accountId: null };
  const { data: account } = await supabase
    .from("client_accounts")
    .select("id, slug")
    .eq("slug", clientSlug)
    .maybeSingle<{ id: string; slug: string }>();

  if (!account) return { supabase, accountId: null };

  const { data: membership } = await supabase
    .from("client_memberships")
    .select("membership_role")
    .eq("user_id", user.id)
    .eq("client_account_id", account.id)
    .in("membership_role", ["owner", "manager"])
    .maybeSingle<{ membership_role: "owner" | "manager" }>();

  return {
    supabase,
    accountId: membership ? account.id : null,
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
  const files = getUploadedFiles(formData);

  if (!["Camera survey report", "Map export", "Harvest plan"].includes(category))
    return { error: "Choose a valid document category." };

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

  if (!validPaths(files, accountId, "client-documents")) return { error: "Invalid document upload paths." };
  const { error: insertError } = await supabase.from("client_documents").insert(files.map(file => ({
    id: file.id, client_account_id: accountId, title: file.name.replace(/\.[^.]+$/, ""),
    category, survey_year: surveyYear, file_path: file.path, file_type: buildFileType(file),
    visibility, status: visibility === "client" ? "published" : "draft",
    notes: notes || `Uploaded into the ${surveyYear} property archive.`,
    upload_source: uploadSource || "Desktop upload", uploaded_by: user.id,
  })));
  if (insertError) return { error: insertError.message };

  revalidatePath("/", "layout");

  return {
    success: `${files.length} document${files.length === 1 ? "" : "s"} uploaded.`,
  };
}
