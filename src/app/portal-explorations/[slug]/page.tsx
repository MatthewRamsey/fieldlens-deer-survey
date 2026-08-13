import { notFound } from "next/navigation";
import { PortalExplorationView } from "@/components/portal-explorations";
import { explorationMap, portalExplorations } from "@/lib/portal-explorations";

export function generateStaticParams() {
  return portalExplorations.map((exploration) => ({ slug: exploration.slug }));
}

export default async function PortalExplorationRoute({
  params,
}: PageProps<"/portal-explorations/[slug]">) {
  const { slug } = await params;
  const exploration = explorationMap[slug];

  if (!exploration) {
    notFound();
  }

  return <PortalExplorationView exploration={exploration} />;
}
