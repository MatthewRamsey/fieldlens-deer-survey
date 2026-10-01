import { NextResponse } from "next/server";
import { getAccessibleDocument } from "@/lib/portal-data";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _: Request,
  {
    params,
  }: {
    params: Promise<{
      clientSlug: string;
      surveyYear: string;
      documentId: string;
    }>;
  },
) {
  const { clientSlug, surveyYear, documentId } = await params;
  const document = await getAccessibleDocument(clientSlug, surveyYear, documentId);

  if (!document) {
    return new NextResponse(null, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("client-documents")
    .createSignedUrl(document.file_path, 60);

  if (error || !data?.signedUrl) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl);
}
