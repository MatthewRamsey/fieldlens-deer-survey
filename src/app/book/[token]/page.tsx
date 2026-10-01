import { notFound } from "next/navigation";
import { DigitalBookReader } from "@/components/digital-book-reader";
import { getPublishedBook } from "@/lib/digital-buck-book";

export const dynamic = "force-dynamic";

export default async function PublicBookPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const book = await getPublishedBook(token);
  if (!book) notFound();
  return <DigitalBookReader book={book} />;
}
