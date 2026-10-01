"use client";

import { createClient } from "@/lib/supabase/client";
import type { PortalMutationState } from "@/app/actions/portal";

export type UploadedAsset = { id: string; path: string; name: string; type: string };

// Send bytes straight to private Storage; server actions only receive metadata.
export async function submitPortalUpload(
  action: (state: PortalMutationState, form: FormData) => Promise<PortalMutationState>,
  state: PortalMutationState,
  form: FormData,
  bucket: "client-documents",
  field: "files",
): Promise<PortalMutationState> {
  const supabase = createClient();
  const files = form.getAll(field).filter((value): value is File => value instanceof File && value.size > 0);
  if (!files.length) return { error: "Choose at least one file." };
  if (files.some(file => file.size > 50 * 1024 * 1024)) return { error: "Each file must be 50 MB or smaller." };
  if (files.some(file => !/\.(pdf|doc|docx|zip)$/i.test(file.name))) return { error: "Choose PDF, Word, or ZIP files." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again before uploading files." };
  const { data: account, error } = await supabase.from("client_accounts").select("id").eq("slug", String(form.get("client_slug"))).eq("is_active", true).single();
  if (error || !account) return { error: "The selected client is unavailable." };
  const { data: membership } = await supabase
    .from("client_memberships")
    .select("membership_role")
    .eq("user_id", user.id)
    .eq("client_account_id", account.id)
    .in("membership_role", ["owner", "manager"])
    .maybeSingle();
  if (!membership) return { error: "This client is not tied to your admin account." };
  const uploaded: UploadedAsset[] = [];
  try {
    for (const file of files) {
      const id = crypto.randomUUID();
      const path = `${account.id}/${bucket}/${id}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (error) throw new Error(error.message);
      uploaded.push({ id, path, name: file.name, type: file.type });
    }
    form.delete(field);
    form.set("uploaded_files", JSON.stringify(uploaded));
    const result = await action(state, form);
    if (result.error) {
      const { error } = await supabase.storage.from(bucket).remove(uploaded.map(file => file.path));
      if (error) return { error: `${result.error} Uploaded files could not be cleaned up; contact an administrator.` };
    }
    return result;
  } catch (cause) {
    // A lost action response may have committed metadata; keep the files for recovery.
    return { error: `${cause instanceof Error ? cause.message : "Upload failed."} Check the archive before retrying.` };
  }
}
