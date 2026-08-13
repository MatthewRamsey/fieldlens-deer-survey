import { AuthPortal } from "@/components/auth-portal";
import { DeerSurveyApp } from "@/components/deer-survey-app";
import { SetupPanel } from "@/components/setup-panel";
import { getPortalAppState } from "@/lib/portal-data";

export default async function Home() {
  const appState = await getPortalAppState();

  if (appState.setupMode) {
    return <SetupPanel />;
  }

  if (!appState.viewer) {
    return <AuthPortal />;
  }

  return <DeerSurveyApp viewer={appState.viewer} accessibleClients={appState.clients} />;
}
