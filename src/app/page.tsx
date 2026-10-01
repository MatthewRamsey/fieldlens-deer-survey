import { redirect } from "next/navigation";
import { AuthPortal } from "@/components/auth-portal";
import { DeerSurveyApp } from "@/components/deer-survey-app";
import { SetupPanel } from "@/components/setup-panel";
import { adminHref } from "@/lib/admin-navigation";
import { getPortalAppState } from "@/lib/portal-data";
import { getRequestOrigin } from "@/lib/request-origin";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; token_hash?: string; type?: string; next?: string; client?: string; year?: string }>;
}) {
  const { code, token_hash, type, next, client, year } = await searchParams;

  if (code || (token_hash && type)) {
    const nextQuery = next && next.startsWith("/") && !next.startsWith("//") ? `&next=${encodeURIComponent(next)}` : "";
    const callbackQuery = code
      ? `code=${encodeURIComponent(code)}`
      : `token_hash=${encodeURIComponent(token_hash!)}&type=${encodeURIComponent(type!)}`;
    redirect(`/auth/confirm?${callbackQuery}${nextQuery}`);
  }

  const appState = await getPortalAppState();

  if (appState.setupMode) {
    return <SetupPanel />;
  }

  if (!appState.viewer) {
    const clientPath = adminHref("/", client, year);
    return <AuthPortal nextPath={next?.startsWith("/") && !next.startsWith("//") ? next : clientPath} />;
  }

  return <DeerSurveyApp
    key={`${client}:${year}`}
    initialYear={year}
    viewer={appState.viewer}
    accessibleClients={appState.clients}
    managedClients={appState.managedClients}
    initialClientId={client}
    portalOrigin={await getRequestOrigin()}
  />;
}
