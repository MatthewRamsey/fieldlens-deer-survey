import JSZip from "jszip";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/request-origin";
import { buckDisplayName } from "@/lib/digital-buck-label";
import { normalizeBuckAge } from "@/lib/digital-buck-age";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(_: Request, { params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return new Response("Administrator access required", { status: 403 });
  const { data: book } = await supabase.from("digital_buck_books")
    .select("id,client_account_id,survey_year,public_token").eq("id", bookId).maybeSingle();
  if (!book) return new Response("Book not found", { status: 404 });
  const { data: account } = await supabase.from("client_accounts").select("property_name").eq("id", book.client_account_id).single();
  const { data: bucks } = await supabase.from("digital_bucks")
    .select("id,name,nickname,age_class,display_order")
    .eq("book_id", book.id).eq("print_selected", true).order("display_order").order("created_at");
  if (!bucks?.length) return new Response("Select bucks before exporting", { status: 400 });
  const { data: images } = await supabase.from("digital_buck_images")
    .select("id,buck_id,original_path,original_name,print_path,status")
    .in("buck_id", bucks.map(buck => buck.id)).eq("is_highlight", true);
  const zip = new JSZip();
  const manifest = [];
  const origin = await getRequestOrigin();
  const qrFile = "book-qr.svg";
  const destinationUrl = `${origin}/book/${book.public_token}/qr`;
  zip.file(qrFile, await QRCode.toString(destinationUrl, { type: "svg", errorCorrectionLevel: "H", margin: 2 }));
  for (const [index, buck] of bucks.entries()) {
    const image = images?.find(entry => entry.buck_id === buck.id && entry.status === "ready");
    if (!image?.print_path) return new Response(`Missing ready highlight for ${buck.name}`, { status: 400 });
    const folder = `${String(index + 1).padStart(2, "0")}-${buck.name.replace(/[^A-Z0-9-]/gi, "_")}`;
    const originalName = image.original_name.replace(/[^a-z0-9._-]/gi, "_");
    const originalFile = `${folder}/highlight-original-${originalName}`;
    const printFile = `${folder}/highlight-print.jpg`;
    const { data: original, error: originalError } = await supabase.storage.from("digital-buck-originals").download(image.original_path);
    if (originalError || !original) return new Response(`Original missing for ${buck.name}`, { status: 409 });
    const originalBytes = Buffer.from(await original.arrayBuffer());
    const isJpeg = originalBytes.length >= 3 && originalBytes[0] === 0xff && originalBytes[1] === 0xd8 && originalBytes[2] === 0xff;
    zip.file(originalFile, originalBytes, { compression: "STORE" });
    if (!isJpeg) {
      const { data: print, error: printError } = await supabase.storage.from("digital-buck-print").download(image.print_path);
      if (printError || !print) return new Response(`Print image missing for ${buck.name}`, { status: 409 });
      zip.file(printFile, await print.arrayBuffer(), { compression: "STORE" });
    }
    manifest.push({ printOrder: index + 1, propertyName: account?.property_name ?? "", surveyYear: book.survey_year,
      buckId: buck.id, buckName: buckDisplayName(buck.name, buck.nickname), identifier: buck.name,
      nickname: buck.nickname || null, ageClass: normalizeBuckAge(buck.age_class),
      originalHighlight: originalFile, printJpeg: isJpeg ? null : printFile });
  }
  zip.file("manifest.json", JSON.stringify({ propertyName: account?.property_name, surveyYear: book.survey_year,
    generatedAt: new Date().toISOString(), qrFile, destinationUrl, bucks: manifest }, null, 2));
  const contents = await zip.generateAsync({ type: "uint8array", compression: "STORE" });
  return new Response(Buffer.from(contents), { headers: {
    "Content-Type": "application/zip", "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="digital-buck-book-${book.survey_year}.zip"`,
  } });
}
