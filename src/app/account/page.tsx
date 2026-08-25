import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/account-settings";
import { getPortalAppState } from "@/lib/portal-data";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const appState = await getPortalAppState();

  if (appState.setupMode || !appState.viewer) {
    redirect("/");
  }

  const { mode } = await searchParams;

  return (
    <main className="shell">
      <AccountSettings
        accessibleClients={appState.clients}
        resetMode={mode === "reset"}
        viewer={appState.viewer}
      />
    </main>
  );
}
