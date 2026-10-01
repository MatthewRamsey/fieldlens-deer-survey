import { notFound, redirect } from "next/navigation";
import { DeerSurveyApp } from "@/components/deer-survey-app";
import { clientHref, clientSections } from "@/lib/client-navigation";
import { getPortalAppState } from "@/lib/portal-data";
import { getRequestOrigin } from "@/lib/request-origin";
import { ClientShell } from "@/components/admin-shell";
import { DigitalBookReader } from "@/components/digital-book-reader";
import { getPublishedBook } from "@/lib/digital-buck-book";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ClientPortalSectionPage({ params, searchParams }: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ client?: string; year?: string; buck?: string }>;
}) {
  const { section } = await params;
  const feature = clientSections.find(item => item.id === section && item.id !== "overview");
  if (!feature) notFound();
  const { client, year, buck } = await searchParams;
  const state = await getPortalAppState();
  if (!state.viewer) redirect(`/?next=${encodeURIComponent(clientHref(feature.id, client, year))}`);
  if (state.viewer.role !== "client") redirect("/");

  if (feature.id === "digital-buck-book") {
    if (client && !state.clients.some(item => item.id === client)) notFound();
    const selected = state.clients.find(item => item.id === client) ?? state.clients[0];
    if (!selected) notFound();
    const selectedYear = year && selected.surveyYears.includes(year) ? year : selected.surveyYears[0] ?? String(new Date().getFullYear());
    const supabase = await createClient();
    const { data: account } = await supabase.from("client_accounts").select("id").eq("slug", selected.id).maybeSingle();
    const { data: books } = account ? await supabase.rpc("get_client_digital_books", { p_client_id: account.id }) : { data: [] };
    const bookEntry = (books as { year: string; token: string }[] | null)?.find(entry => entry.year === selectedYear);
    const book = bookEntry ? await getPublishedBook(bookEntry.token) : null;
    return <ClientShell viewer={state.viewer} section={feature.id} clientId={selected.id} year={selectedYear}>
      <section className="topbar admin-topbar"><div className="admin-topbar-body"><div className="admin-topbar-copy">
        <p className="eyebrow">{selected.propertyName}</p><h1>Digital Buck Book</h1>
        <p className="lede">Explore the bucks selected for your property&apos;s printed book by age group.</p>
      </div><form className="topbar-filters admin-topbar-filters" action="/portal/digital-buck-book">
        {state.clients.length > 1 ? <label className="client-picker"><span>Property</span><select name="client" defaultValue={selected.id}>
          {state.clients.map(account => <option key={account.id} value={account.id}>{account.propertyName}</option>)}</select></label>
          : <input type="hidden" name="client" value={selected.id} />}
        <label className="client-picker"><span>Survey year</span><select name="year" defaultValue={selectedYear}>
          {[...new Set([selectedYear, ...selected.surveyYears])].map(value => <option key={value} value={value}>{value} survey year</option>)}</select></label>
        <button className="ghost-chip" type="submit">View</button>
      </form></div></section>
      {book ? <DigitalBookReader key={`${book.token}:${buck ?? ""}`} book={book} buckId={buck}
        embeddedHref={`/portal/digital-buck-book?client=${encodeURIComponent(selected.id)}&year=${encodeURIComponent(selectedYear)}`} />
        : <div className="workspace-card digital-empty"><h2>No published book for {selectedYear}</h2>
          <p>Your wildlife manager will share this year&apos;s selected bucks here.</p>
          <Link href="/">Back to overview</Link></div>}
    </ClientShell>;
  }

  return <DeerSurveyApp key={`${client}:${year}`} viewer={state.viewer} accessibleClients={state.clients}
    managedClients={[]} initialClientId={client} initialYear={year} clientSection={feature.id}
    portalOrigin={await getRequestOrigin()} />;
}
