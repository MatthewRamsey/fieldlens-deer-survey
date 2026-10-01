import { notFound } from "next/navigation";
import { DigitalBookReader } from "@/components/digital-book-reader";
import { getPublishedBook } from "@/lib/digital-buck-book";

export const dynamic = "force-dynamic";

export default async function PublicBuckPage({ params }: { params: Promise<{ token: string; buckId: string }> }) {
  const { token, buckId } = await params;
  const book = await getPublishedBook(token);
  if (!book?.bucks.some(buck => buck.id === buckId)) notFound();
  return <DigitalBookReader key={buckId} book={book} buckId={buckId} />;
}
