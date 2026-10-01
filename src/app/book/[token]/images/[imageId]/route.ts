import { getSupabaseEnv } from "@/lib/supabase/env";
import { readerRendition } from "@/lib/digital-buck-rendition";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ token: string; imageId: string }> }) {
  const { token, imageId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token) || !/^[0-9a-f-]{36}$/i.test(imageId)) return new Response("Not found", { status: 404 });
  const env = getSupabaseEnv();
  const url = new URL(`${env.url}/functions/v1/digital-buck-image`);
  url.searchParams.set("token", token);
  url.searchParams.set("image", imageId);
  const response = await fetch(url, { headers: { apikey: env.publishableKey }, cache: "no-store" });
  if (!response.ok || !response.body) return new Response("Not found", { status: 404 });
  const size = new URL(request.url).searchParams.get("size");
  if (size === "gallery" || size === "thumbnail" || size === "viewer") {
    try {
      return new Response(new Uint8Array(await readerRendition(await response.arrayBuffer(), size)), { headers: {
        "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      } });
    } catch { return new Response("Image unavailable", { status: 502 }); }
  }
  return new Response(response.body, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
