import { createClient } from "npm:@supabase/supabase-js@2";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async request => {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const imageId = url.searchParams.get("image") ?? "";
  if (!uuid.test(token) || !uuid.test(imageId)) return new Response("Not found", { status: 404 });
  const projectUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!projectUrl || !serviceKey) return new Response("Unavailable", { status: 503 });
  const supabase = createClient(projectUrl, serviceKey, { auth: { persistSession: false } });
  const { data: path, error } = await supabase.rpc("get_digital_book_image_path", { p_token: token, p_image_id: imageId });
  if (error || !path) return new Response("Not found", { status: 404 });
  const { data, error: downloadError } = await supabase.storage.from("digital-buck-web").download(path);
  if (downloadError || !data) return new Response("Not found", { status: 404 });
  return new Response(data.stream(), { headers: {
    "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
});
