import { notFound, redirect } from "next/navigation";
import { DeerSurveyApp } from "@/components/deer-survey-app";
import { clientHref } from "@/lib/client-navigation";
import { getPortalAppState } from "@/lib/portal-data";
import { getRequestOrigin } from "@/lib/request-origin";
import { ClientShell } from "@/components/admin-shell";
import { DigitalBookReader } from "@/components/digital-book-reader";
import { getAdminBook, type PublishedBook } from "@/lib/digital-buck-book";
import { buckDisplayName } from "@/lib/digital-buck-label";
import Link from "next/link";

export default async function ClientPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientSlug: string }>;
  searchParams: Promise<{ section?: string; year?: string; buck?: string }>;
}) {
  const { clientSlug } = await params;
  const { section, year, buck } = await searchParams;
  if (section && section !== "overview" && section !== "reports" && section !== "digital-buck-book") notFound();
  const clientSection = section === "reports" || section === "digital-buck-book" ? section : "overview";
  const state = await getPortalAppState();

  if (!state.viewer) {
    redirect(`/?next=${encodeURIComponent(clientHref(clientSection, clientSlug, year, clientSlug))}`);
  }

  if (state.viewer.role !== "admin") notFound();

  const managedClient = state.managedClients.find((entry) => entry.slug === clientSlug && entry.isActive);
  const client = state.clients.find((entry) => entry.id === clientSlug);
  if (!managedClient || !client) notFound();

  if (clientSection === "digital-buck-book") {
    const selectedYear = year && /^\d{4}$/.test(year) ? year : client.surveyYears[0];
    const draft = await getAdminBook(client.id, selectedYear);
    const book: PublishedBook | null = draft ? { id: draft.id, token: draft.public_token, year: selectedYear,
      propertyName: client.propertyName,
      bucks: draft.bucks.filter(entry => entry.print_selected).map(entry => ({ id: entry.id,
        name: buckDisplayName(entry.name, entry.nickname), ageClass: entry.age_class,
        images: entry.images.filter(image => image.status === "ready")
          .sort((left, right) => Number(right.is_highlight) - Number(left.is_highlight) || left.display_order - right.display_order)
          .map(image => ({ id: image.id, altText: image.alt_text, isHighlight: image.is_highlight })),
      })) } : null;
    return <ClientShell viewer={state.viewer} section={clientSection} clientId={client.id} year={selectedYear} preview>
      <div className="client-preview-banner"><div><strong>Admin preview · {client.propertyName}</strong><span>Draft changes are visible here before publication.</span></div>
        <Link href={`/admin/digital-buck-book?client=${client.id}&year=${selectedYear}`}>Return to editor</Link></div>
      {book ? <DigitalBookReader key={buck ?? "index"} book={book} buckId={buck} adminPreview
        embeddedHref={`/admin/preview/${clientSlug}?section=digital-buck-book&year=${selectedYear}`} />
        : <div className="workspace-card digital-empty">No draft book for {selectedYear} yet.</div>}
    </ClientShell>;
  }

  return <DeerSurveyApp
    key={`${client.id}:${year}:${clientSection}`}
    viewer={state.viewer}
    accessibleClients={[client]}
    managedClients={[]}
    initialClientId={client.id}
    initialYear={year}
    clientSection={clientSection}
    portalOrigin={await getRequestOrigin()}
    preview
  />;
}
