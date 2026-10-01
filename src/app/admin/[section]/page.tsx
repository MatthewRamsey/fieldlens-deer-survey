import { notFound, redirect } from "next/navigation";
import { DeerSurveyApp } from "@/components/deer-survey-app";
import { adminHref, adminSections } from "@/lib/admin-navigation";
import { getPortalAppState } from "@/lib/portal-data";
import { getRequestOrigin } from "@/lib/request-origin";
import { AdminShell } from "@/components/admin-shell";
import { DigitalBuckWorkspace } from "@/components/digital-buck-workspace";
import { getAdminBook } from "@/lib/digital-buck-book";
import { createClient } from "@/lib/supabase/server";
import { AdminUserManagement, type ManagedUser } from "@/components/admin-user-management";

export const maxDuration = 300;

export default async function AdminPage({ params, searchParams }: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ client?: string; year?: string }>;
}) {
  const { section } = await params;
  const feature = adminSections.find(item => item.id === section && item.id !== "overview");
  if (!feature) notFound();
  const state = await getPortalAppState();
  const { client, year } = await searchParams;
  if (!state.viewer) redirect(`/?next=${encodeURIComponent(adminHref(feature.href, client, year))}`);
  if (state.viewer.role !== "admin") redirect("/");
  if (feature.id === "users") {
    if (!state.viewer.isSuperAdmin) notFound();
    const supabase = await createClient();
    const { data: profiles, error } = await supabase.from("profiles")
      .select("id, email, full_name, role").order("email")
      .returns<Array<{ id: string; email: string; full_name: string | null; role: "admin" | "client" }>>();
    if (error) throw new Error("Could not load portal users.");
    const users: ManagedUser[] = (profiles ?? []).map(profile => ({
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name || profile.email,
      role: profile.role,
      isSuperAdmin: profile.id === state.viewer!.id,
    }));
    return <AdminShell viewer={state.viewer} clients={state.clients} section="users">
      <header className="admin-page-heading"><p className="eyebrow">Admin</p><h1>Users</h1>
        <p className="lede">Manage account details and password access.</p></header>
      <AdminUserManagement users={users} />
    </AdminShell>;
  }
  if (feature.id === "digital-buck-book") {
    const selected = state.clients.find(item => item.id === client) ?? state.clients[0];
    const selectedYear = year && /^\d{4}$/.test(year) ? year : String(new Date().getFullYear());
    const book = selected ? await getAdminBook(selected.id, selectedYear) : null;
    return <AdminShell viewer={state.viewer} clients={state.clients} section={feature.id}
      clientId={selected?.id} year={selectedYear}>
      <section className="topbar admin-topbar"><div className="admin-topbar-body"><div className="admin-topbar-copy">
        <p className="eyebrow">{selected?.propertyName ?? "Property"}</p><h1>Digital Buck Book</h1>
        <p className="lede">Curate one selected buck per printed page and publish the same book online.</p>
      </div><form className="topbar-filters admin-topbar-filters" action="/admin/digital-buck-book">
        <input type="hidden" name="client" value={selected?.id ?? ""} />
        <label className="client-picker"><span>Survey year</span><select name="year" defaultValue={selectedYear}
          onChange={undefined}>{[...new Set([selectedYear, ...(selected?.surveyYears ?? [])])].map(value => <option key={value} value={value}>{value} survey year</option>)}</select></label>
        <button className="ghost-chip" type="submit">View</button>
      </form></div></section>
      {selected ? <DigitalBuckWorkspace key={`${selected.id}:${selectedYear}`} book={book} clientSlug={selected.id}
        propertyName={selected.propertyName} year={selectedYear} origin={await getRequestOrigin()} />
        : <p>Add a client property before creating a buck book.</p>}
    </AdminShell>;
  }
  return <DeerSurveyApp key={`${client}:${year}`} viewer={state.viewer} accessibleClients={state.clients}
    managedClients={state.managedClients} initialClientId={client} initialYear={year}
    section={feature.id} portalOrigin={await getRequestOrigin()} />;
}
