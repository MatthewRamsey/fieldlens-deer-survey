import "server-only";

import { createClient } from "@/lib/supabase/server";
import { normalizeBuckAge } from "@/lib/digital-buck-age";

export type BuckImage = {
  id: string;
  buck_id: string;
  original_name: string;
  original_type: string;
  original_path: string;
  web_path: string | null;
  print_path: string | null;
  byte_size: number;
  status: "pending" | "ready" | "failed";
  error_message: string | null;
  is_highlight: boolean;
  display_order: number;
  alt_text: string;
};

export type Buck = {
  id: string;
  book_id: string;
  name: string;
  nickname: string;
  age_class: string;
  print_selected: boolean;
  display_order: number;
  images: BuckImage[];
};

export type BuckBook = {
  id: string;
  client_account_id: string;
  survey_year: string;
  public_token: string;
  status: "draft" | "published";
  buckPrefix: string;
  nextBuckNumber: number;
  bucks: Buck[];
};

export type PublishedBook = {
  id: string;
  token: string;
  year: string;
  propertyName: string;
  bucks: {
    id: string;
    name: string;
    ageClass: string;
    images: { id: string; altText: string; isHighlight: boolean }[];
  }[];
};

export type AdminBuckGalleryEntry = {
  id: string;
  year: string;
  name: string;
  nickname: string;
  ageClass: string;
  printSelected: boolean;
  displayOrder: number;
  highlightImageId: string | null;
};

export async function getAdminBuckGallery(clientSlug: string): Promise<AdminBuckGalleryEntry[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return [];
  const { data: account } = await supabase.from("client_accounts").select("id").eq("slug", clientSlug).maybeSingle();
  if (!account) return [];
  const { data: membership } = await supabase.from("client_memberships").select("membership_role")
    .eq("user_id", user.id).eq("client_account_id", account.id).maybeSingle();
  if (!membership || !["owner", "manager"].includes(membership.membership_role)) return [];
  const { data: books, error: bookError } = await supabase.from("digital_buck_books")
    .select("id,survey_year").eq("client_account_id", account.id);
  if (bookError) throw new Error(bookError.message);
  const bookYears = new Map((books ?? []).map(book => [book.id, book.survey_year]));
  if (bookYears.size === 0) return [];
  const { data: bucks, error: buckError } = await supabase.from("digital_bucks")
    .select("id,book_id,name,nickname,age_class,print_selected,display_order")
    .in("book_id", [...bookYears.keys()]);
  if (buckError) throw new Error(buckError.message);
  const buckIds = (bucks ?? []).filter(buck => bookYears.has(buck.book_id)).map(buck => buck.id);
  const highlights = new Map<string, string>();
  // Fetch only highlight metadata, in batches that stay below PostgREST's row limit.
  for (let offset = 0; offset < buckIds.length; offset += 200) {
    const { data: images, error } = await supabase.from("digital_buck_images")
      .select("id,buck_id").in("buck_id", buckIds.slice(offset, offset + 200))
      .eq("status", "ready").eq("is_highlight", true);
    if (error) throw new Error(error.message);
    for (const image of images ?? []) highlights.set(image.buck_id, image.id);
  }
  return (bucks ?? []).filter(buck => bookYears.has(buck.book_id)).map(buck => ({
    id: buck.id, year: bookYears.get(buck.book_id)!, name: buck.name,
    nickname: buck.nickname, ageClass: normalizeBuckAge(buck.age_class) ?? "",
    printSelected: buck.print_selected, displayOrder: buck.display_order,
    highlightImageId: highlights.get(buck.id) ?? null,
  })).sort((a, b) => Number(b.year) - Number(a.year) || a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
}

export async function getAdminBook(clientSlug: string, year: string): Promise<BuckBook | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return null;
  const { data: account } = await supabase.from("client_accounts").select("id,buck_prefix,buck_next_number").eq("slug", clientSlug).maybeSingle();
  if (!account) return null;
  const { data: book, error } = await supabase.from("digital_buck_books")
    .select("id,client_account_id,survey_year,public_token,status")
    .eq("client_account_id", account.id).eq("survey_year", year).maybeSingle();
  if (error) throw new Error(error.message);
  if (!book) return null;
  const { data: bucks, error: buckError } = await supabase.from("digital_bucks")
    .select("id,book_id,name,nickname,age_class,print_selected,display_order")
    .eq("book_id", book.id).order("display_order").order("created_at");
  if (buckError) throw new Error(buckError.message);
  const buckIds = (bucks ?? []).map(buck => buck.id);
  const { data: images, error: imageError } = buckIds.length ? await supabase.from("digital_buck_images")
    .select("id,buck_id,original_name,original_type,original_path,web_path,print_path,byte_size,status,error_message,is_highlight,display_order,alt_text")
    .in("buck_id", buckIds).order("display_order").order("created_at") : { data: [], error: null };
  if (imageError) throw new Error(imageError.message);
  return { ...book, buckPrefix: account.buck_prefix, nextBuckNumber: account.buck_next_number,
    bucks: (bucks ?? []).map(buck => ({ ...buck, age_class: normalizeBuckAge(buck.age_class) ?? "",
    images: (images ?? []).filter(image => image.buck_id === buck.id),
  })) } as BuckBook;
}

export async function getPublishedBook(token: string): Promise<PublishedBook | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_published_digital_book", { p_token: token });
  if (error || !data) return null;
  const book = data as PublishedBook;
  return { ...book, bucks: book.bucks.map(buck => ({
    ...buck, ageClass: normalizeBuckAge(buck.ageClass) ?? "",
  })) };
}

export function publicBookHref(token: string, buckId?: string) {
  return `/book/${token}${buckId ? `/bucks/${buckId}` : ""}`;
}

export function publicImageHref(token: string, imageId: string) {
  return `/book/${token}/images/${imageId}`;
}
