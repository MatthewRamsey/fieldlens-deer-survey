import Link from "next/link";
import { notFound } from "next/navigation";
import { BuckBookViewer } from "@/components/buck-book-viewer";
import { getAccessibleBuckBook } from "@/lib/portal-data";

export default async function BuckBookPage({
  params,
}: {
  params: Promise<{ clientSlug: string; surveyYear: string }>;
}) {
  const { clientSlug, surveyYear } = await params;
  const buckBook = await getAccessibleBuckBook(clientSlug, surveyYear);

  if (!buckBook) {
    notFound();
  }

  return (
    <main className="shell">
      <section className="workspace-card book-section">
        <div className="workspace-top">
          <div>
            <p className="eyebrow">Digital buck book</p>
            <h1>{buckBook.account.property_name}</h1>
            <p className="section-copy">{buckBook.surveyYear} survey year • Reviewed deer images grouped for this property.</p>
          </div>
          <div className="status-group">
            <span className="status-pill">{buckBook.images.length} released image{buckBook.images.length === 1 ? "" : "s"}</span>
            <Link className="ghost-chip signout-chip" href="/">Back to portal</Link>
          </div>
        </div>
        {buckBook.images.length ? (
          <BuckBookViewer images={buckBook.images} propertyName={buckBook.account.property_name} surveyYear={buckBook.surveyYear} />
        ) : (
          <article className="empty-state">
            <h2>No deer images have been released for this survey year</h2>
            <p>Your wildlife manager will add reviewed management and trophy deer images here.</p>
          </article>
        )}
      </section>
    </main>
  );
}
