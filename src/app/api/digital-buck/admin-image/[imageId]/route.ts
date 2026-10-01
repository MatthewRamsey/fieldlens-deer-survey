import { createClient } from "@/lib/supabase/server";
import { readerRendition } from "@/lib/digital-buck-rendition";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Not found", { status: 404 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return new Response("Not found", { status: 404 });
  const { data: image } = await supabase.from("digital_buck_images").select("web_path").eq("id", imageId).maybeSingle();
  if (!image?.web_path) return new Response("Not found", { status: 404 });
  const { data, error } = await supabase.storage.from("digital-buck-web").download(image.web_path);
  if (error || !data) return new Response("Not found", { status: 404 });
  const size = new URL(request.url).searchParams.get("size");
  if (size === "gallery" || size === "thumbnail" || size === "viewer") {
    try {
      return new Response(new Uint8Array(await readerRendition(await data.arrayBuffer(), size)), { headers: {
        "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      } });
    } catch { return new Response("Image unavailable", { status: 502 }); }
  }
  return new Response(data.stream(), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
