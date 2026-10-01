export const clientSections = [
  { id: "overview", label: "Overview", description: "A quick look at your property's published archive." },
  { id: "reports", label: "Reports", description: "Browse the reports released for your property." },
  { id: "digital-buck-book", label: "Digital Buck Book", description: "Browse this year's published bucks and their photos." },
] as const;

export type ClientSection = (typeof clientSections)[number]["id"];

export function clientHref(section: ClientSection | "account", clientId?: string, year?: string, previewSlug?: string) {
  const path = previewSlug
    ? `/admin/preview/${encodeURIComponent(previewSlug)}`
    : section === "overview" ? "/" : section === "account" ? "/account" : `/portal/${section}`;
  const query = new URLSearchParams();
  if (previewSlug && section !== "overview") query.set("section", section);
  if (!previewSlug && clientId) query.set("client", clientId);
  if (year) query.set("year", year);
  return `${path}${query.size ? `?${query}` : ""}`;
}
