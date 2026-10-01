import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(_: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Not found", { status: 404 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return new Response("Not found", { status: 404 });
  const { data: image } = await supabase.from("digital_buck_images")
    .select("original_path,original_name,is_highlight,status").eq("id", imageId).maybeSingle();
  if (!image?.is_highlight || image.status !== "ready") return new Response("Not found", { status: 404 });
  const { data, error } = await supabase.storage.from("digital-buck-originals").download(image.original_path);
  if (error || !data) return new Response("Not found", { status: 404 });
  const name = image.original_name.replace(/[^a-z0-9._-]/gi, "_") || "highlight";
  return new Response(data.stream(), { headers: {
    "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff", "Content-Disposition": `attachment; filename="${name}"`,
  } });
}
