import { AdminShell, ClientShell } from "@/components/admin-shell";
import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/account-settings";
import { getPortalAppState } from "@/lib/portal-data";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; client?: string; year?: string }>;
}) {
  const { mode, client, year } = await searchParams;
  const appState = await getPortalAppState();

  if (appState.setupMode || !appState.viewer) {
    const query = new URLSearchParams();
    if (mode) query.set("mode", mode);
    if (client) query.set("client", client);
    if (year) query.set("year", year);
    const path = `/account${query.size ? `?${query}` : ""}`;
    redirect(`/?next=${encodeURIComponent(path)}`);
  }
  const viewer = appState.viewer;

  const settings = (
      <AccountSettings
        accessibleClients={appState.clients}
        resetMode={mode === "reset"}
        viewer={viewer}
      />
  );
  const selectedClient = appState.clients.find(entry => entry.id === client)
    ?? appState.clients.find(entry => entry.id === viewer.defaultClientId)
    ?? appState.clients[0];
  const selectedYear = year === "Lifetime" || selectedClient?.surveyYears.includes(year ?? "")
    ? year ?? "Lifetime"
    : selectedClient?.surveyYears[0] ?? "Lifetime";
  return viewer.role === "admin" ? <AdminShell viewer={viewer} clients={appState.clients} section="account" year={year}>
    <header className="admin-page-heading"><p className="eyebrow">Personal settings</p><h1>Account</h1></header>{settings}
  </AdminShell> : <ClientShell viewer={viewer} section="account" clientId={selectedClient?.id ?? ""} year={selectedYear}>
    <header className="admin-page-heading"><p className="eyebrow">Personal settings</p><h1>Account</h1></header>{settings}
  </ClientShell>;
}
