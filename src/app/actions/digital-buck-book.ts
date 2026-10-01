"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import sharp from "sharp";
import { decodeCameraRaw } from "@/lib/decode-camera-raw";

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const extensions = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "dng", "cr2", "cr3", "nef", "arw", "raf", "orf", "rw2"]);

async function adminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in again to manage the buck book.");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") throw new Error("Only an administrator can change a buck book.");
  return supabase;
}

async function assertManagedAccount(supabase: Awaited<ReturnType<typeof createClient>>, accountId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase.from("client_memberships").select("id")
    .eq("user_id", user?.id ?? "")
    .eq("client_account_id", accountId)
    .in("membership_role", ["owner", "manager"]).maybeSingle();
  if (!membership) throw new Error("This property is not assigned to your admin account.");
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function createDigitalBook(clientSlug: string, year: string) {
  if (!/^\d{4}$/.test(year)) throw new Error("Choose a four-digit survey year.");
  const supabase = await adminClient();
  const { data: account } = await supabase.from("client_accounts").select("id").eq("slug", clientSlug).maybeSingle();
  if (!account) throw new Error("The property was not found.");
  await assertManagedAccount(supabase, account.id);
  const { error } = await supabase.from("digital_buck_books").insert({ client_account_id: account.id, survey_year: year });
  if (error && error.code !== "23505") throw new Error(error.message);
  refresh();
}

async function findBook(bookId: string) {
  const supabase = await adminClient();
  const { data: book } = await supabase.from("digital_buck_books").select("id,status,client_account_id,public_token")
    .eq("id", bookId).maybeSingle();
  if (!book) throw new Error("The buck book was not found.");
  await assertManagedAccount(supabase, book.client_account_id);
  return { supabase, book };
}

async function findBuck(buckId: string) {
  const supabase = await adminClient();
  const { data: buck } = await supabase.from("digital_bucks").select("id,book_id,print_selected")
    .eq("id", buckId).maybeSingle();
  if (!buck) throw new Error("The buck was not found.");
  const { data: book } = await supabase.from("digital_buck_books").select("id,status,public_token,client_account_id")
    .eq("id", buck.book_id).single();
  if (!book) throw new Error("The buck book was not found.");
  await assertManagedAccount(supabase, book.client_account_id);
  return { supabase, buck, book };
}

export async function createDigitalBuckForPhoto(bookId: string, ageClass: string, uploadKey: string) {
  const { supabase } = await findBook(bookId);
  const age = ageClass.trim();
  if (!/^[1-5]$/.test(age)) throw new Error("Choose an age group from 1 to 5.");
  if (!/^[0-9a-f-]{36}$/i.test(uploadKey)) throw new Error("Invalid upload key.");
  const { data, error } = await supabase.rpc("create_digital_buck_for_photo", {
    p_book_id: bookId, p_age_class: age, p_upload_key: uploadKey,
  });
  if (error) throw new Error(error.message);
  return data as { id: string; name: string; created: boolean; ready: boolean; highlightId: string | null };
}

export async function updateDigitalBuck(buckId: string, values: { nickname: string; ageClass: string; selected: boolean; order: number }) {
  const { supabase, book } = await findBuck(buckId);
  const nickname = values.nickname.trim();
  if (nickname.length > 120) throw new Error("Keep nicknames to 120 characters or less.");
  if (!/^[1-5]$/.test(values.ageClass.trim())) throw new Error("Choose an age group from 1 to 5.");
  if (!Number.isSafeInteger(values.order) || values.order < 0) throw new Error("Choose a valid print order.");
  if (book.status === "published" && values.selected) {
    const { data: highlight } = await supabase.from("digital_buck_images").select("id")
      .eq("buck_id", buckId).eq("is_highlight", true).eq("status", "ready").maybeSingle();
    if (!highlight) throw new Error("Add a ready highlight image before selecting this buck for a published book.");
  }
  const { error } = await supabase.from("digital_bucks").update({ nickname, age_class: values.ageClass.trim(),
    print_selected: values.selected, display_order: values.order })
    .eq("id", buckId);
  if (error) throw new Error(error.message);
  refresh();
}

export async function removeDigitalBuck(buckId: string) {
  const { supabase, book, buck } = await findBuck(buckId);
  if (book.status === "published" && buck.print_selected) {
    const { count, error } = await supabase.from("digital_bucks")
      .select("id", { count: "exact", head: true }).eq("book_id", book.id).eq("print_selected", true);
    if (error) throw new Error(error.message);
    if ((count ?? 0) <= 1) throw new Error("Unpublish the book before removing its last selected buck.");
  }
  const { data: images, error: imageError } = await supabase.from("digital_buck_images")
    .select("original_path,web_path,print_path").eq("buck_id", buckId);
  if (imageError) throw new Error(imageError.message);
  const { data: deleted, error } = await supabase.from("digital_bucks").delete().eq("id", buckId).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!deleted) throw new Error("Buck not found for this administrator.");
  const removals = await Promise.all((images ?? []).flatMap(image => [
    supabase.storage.from("digital-buck-originals").remove([image.original_path]),
    ...(image.web_path ? [supabase.storage.from("digital-buck-web").remove([image.web_path])] : []),
    ...(image.print_path ? [supabase.storage.from("digital-buck-print").remove([image.print_path])] : []),
  ]));
  const cleanupError = removals.find(result => result.error)?.error;
  refresh();
  if (cleanupError) throw new Error(`The buck was removed, but some photo files need cleanup: ${cleanupError.message}`);
}

export async function removeEmptyDigitalBuck(buckId: string) {
  const { supabase, buck } = await findBuck(buckId);
  const { data: images, error: lookupError } = await supabase.from("digital_buck_images")
    .select("id").eq("buck_id", buckId).limit(1);
  if (lookupError) throw new Error(lookupError.message);
  if (images?.length) return false;
  const { data: deleted, error } = await supabase.from("digital_bucks")
    .delete().eq("id", buck.id).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(deleted);
}

export async function setDigitalBookPublished(bookId: string, published: boolean) {
  const { supabase } = await findBook(bookId);
  if (published) {
    const { data: bucks } = await supabase.from("digital_bucks").select("id,name")
      .eq("book_id", bookId).eq("print_selected", true);
    if (!bucks?.length) throw new Error("Select at least one buck for print before publishing.");
    const { data: highlights } = await supabase.from("digital_buck_images").select("buck_id")
      .in("buck_id", bucks.map(buck => buck.id)).eq("is_highlight", true).eq("status", "ready");
    const ready = new Set((highlights ?? []).map(image => image.buck_id));
    const missing = bucks.find(buck => !ready.has(buck.id));
    if (missing) throw new Error(`Add a ready highlight image for ${missing.name} before publishing.`);
  }
  const { error } = await supabase.from("digital_buck_books").update({ status: published ? "published" : "draft" }).eq("id", bookId);
  if (error) throw new Error(error.message);
  refresh();
}

export async function reserveDigitalBuckImage(buckId: string, fileName: string, size: number, contentType: string) {
  const { supabase, book } = await findBuck(buckId);
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!extensions.has(ext)) throw new Error(`Unsupported image format: .${ext || "unknown"}.`);
  if (size < 1 || size > MAX_IMAGE_BYTES) throw new Error("Images must be 50 MB or smaller.");
  const id = crypto.randomUUID();
  const path = `${book.id}/${buckId}/${id}/original.${ext}`;
  const { data: last } = await supabase.from("digital_buck_images").select("display_order")
    .eq("buck_id", buckId).order("display_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("digital_buck_images").insert({ id, buck_id: buckId,
    original_path: path, original_name: fileName.slice(0, 255), original_type: contentType || "application/octet-stream",
    byte_size: size, display_order: (last?.display_order ?? -1) + 1 });
  if (error) throw new Error(error.message);
  return { id, path };
}

export async function discardUnfinishedDigitalBuckImage(imageId: string, allowPending: boolean) {
  const supabase = await adminClient();
  const { data: image, error: lookupError } = await supabase.from("digital_buck_images")
    .select("id,original_path,web_path,print_path,status")
    .eq("id", imageId).maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (!image) return;
  if (image.status === "ready") throw new Error("This photo finished processing. Check the photo list before retrying.");
  if (image.status === "pending" && !allowPending)
    throw new Error("This photo may still be processing. Check the photo list before retrying.");
  const { data: deleted, error: deletionError } = await supabase.from("digital_buck_images").delete()
    .eq("id", imageId).in("status", allowPending ? ["pending", "failed"] : ["failed"]).select("id");
  if (deletionError) throw new Error(deletionError.message);
  if (!deleted?.length) throw new Error("This photo finished processing. Check the photo list before retrying.");
  const removals = await Promise.all([
    supabase.storage.from("digital-buck-originals").remove([image.original_path]),
    ...(image.web_path ? [supabase.storage.from("digital-buck-web").remove([image.web_path])] : []),
    ...(image.print_path ? [supabase.storage.from("digital-buck-print").remove([image.print_path])] : []),
  ]);
  const cleanupError = removals.find(result => result.error)?.error;
  if (cleanupError) throw new Error(`The unfinished photo was removed, but its uploaded file needs cleanup: ${cleanupError.message}`);
  refresh();
}

export async function setDigitalBuckHighlight(imageId: string) {
  const supabase = await adminClient();
  const { error } = await supabase.rpc("set_digital_buck_highlight", { p_image_id: imageId });
  if (error) throw new Error(error.message);
  refresh();
}

export async function updateDigitalBuckImage(imageId: string, altText: string, order: number) {
  const supabase = await adminClient();
  if (!Number.isSafeInteger(order) || order < 0) throw new Error("Choose a valid photo order.");
  const { data, error } = await supabase.from("digital_buck_images").update({
    alt_text: altText.trim().slice(0, 300), display_order: order,
  }).eq("id", imageId).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Photo not found for this administrator.");
  refresh();
}

export async function removeDigitalBuckImage(imageId: string) {
  const supabase = await adminClient();
  const { data: image } = await supabase.from("digital_buck_images").select("buck_id,is_highlight,original_path,web_path,print_path").eq("id", imageId).maybeSingle();
  if (!image) throw new Error("Image not found.");
  const { book, buck } = await findBuck(image.buck_id);
  if (book.status === "published" && buck.print_selected && image.is_highlight)
    throw new Error("Choose another highlight or unpublish before removing this image.");
  const { data: deleted, error } = await supabase.from("digital_buck_images").delete().eq("id", imageId).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!deleted) throw new Error("Photo not found for this administrator.");
  const removals = await Promise.all([
    supabase.storage.from("digital-buck-originals").remove([image.original_path]),
    ...(image.web_path ? [supabase.storage.from("digital-buck-web").remove([image.web_path])] : []),
    ...(image.print_path ? [supabase.storage.from("digital-buck-print").remove([image.print_path])] : []),
  ]);
  refresh();
  const cleanupError = removals.find(result => result.error)?.error;
  if (cleanupError) throw new Error(`The photo was removed, but its files need cleanup: ${cleanupError.message}`);
}

export async function processDigitalBuckImage(imageId: string) {
  const supabase = await adminClient();
  const { data: image } = await supabase.from("digital_buck_images")
    .select("id,buck_id,original_path,original_name,byte_size,status")
    .eq("id", imageId).maybeSingle();
  if (!image) return { error: "Image upload was not reserved." };
  if (image.status === "ready") return { error: null };
  const { data: downloaded, error: downloadError } = await supabase.storage.from("digital-buck-originals").download(image.original_path);
  if (downloadError || !downloaded) return { error: "The original upload is missing. Retry the upload." };
  const original = Buffer.from(await downloaded.arrayBuffer());
  if (original.length !== image.byte_size || original.length > MAX_IMAGE_BYTES)
    return { error: "The uploaded image size did not match the selected file." };
  const ext = image.original_name.split(".").pop()?.toLowerCase() ?? "";
  const base = image.original_path.replace(/\/original\.[^.]+$/, "");
  const webPath = `${base}/web.jpg`;
  const printPath = `${base}/print.jpg`;
  try {
    let input: Buffer;
    if (ext === "heic" || ext === "heif") {
      const convert = (await import("heic-convert")).default;
      input = Buffer.from(await convert({ buffer: original, format: "JPEG", quality: 1 }));
    } else if (["dng", "cr2", "cr3", "nef", "arw", "raf", "orf", "rw2"].includes(ext)) {
      input = await decodeCameraRaw(original);
    } else {
      input = original;
    }
    const metadata = await sharp(input, { limitInputPixels: 150_000_000 }).metadata();
    if (!metadata.width || !metadata.height || metadata.width < 100 || metadata.height < 100)
      throw new Error("The image is too small or has invalid dimensions.");
    const pipeline = () => sharp(input, { limitInputPixels: 150_000_000 })
      .rotate().toColourspace("srgb").flatten({ background: "#ffffff" });
    const web = await pipeline().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    let print: Buffer | null = null;
    for (const quality of [95, 90, 85, 80, 75, 70, 60, 50, 40]) {
      const candidate = await pipeline().jpeg({ quality, mozjpeg: true }).toBuffer();
      if (candidate.length <= MAX_IMAGE_BYTES) { print = candidate; break; }
    }
    if (!print) throw new Error("The full-resolution print image exceeds the 50 MB limit.");
    const [webUpload, printUpload] = await Promise.all([
      supabase.storage.from("digital-buck-web").upload(webPath, web, { contentType: "image/jpeg", upsert: true }),
      supabase.storage.from("digital-buck-print").upload(printPath, print, { contentType: "image/jpeg", upsert: true }),
    ]);
    if (webUpload.error || printUpload.error) throw new Error(webUpload.error?.message ?? printUpload.error?.message);
    const { data: existingHighlight } = await supabase.from("digital_buck_images").select("id")
      .eq("buck_id", image.buck_id).eq("is_highlight", true).maybeSingle();
    const { error } = await supabase.from("digital_buck_images").update({
      web_path: webPath, print_path: printPath, status: "ready", error_message: null,
      is_highlight: !existingHighlight,
    }).eq("id", imageId);
    if (error) throw new Error(error.message);
    refresh();
    return { error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image conversion failed.";
    await supabase.from("digital_buck_images").update({ status: "failed", error_message: message.slice(0, 300) }).eq("id", imageId);
    refresh();
    return { error: `Could not process ${image.original_name}: ${message}` };
  }
}
