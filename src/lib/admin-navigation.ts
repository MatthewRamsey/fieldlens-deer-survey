export const adminSections = [
  { id: "overview", label: "Overview", href: "/", description: "A quick look at your property’s published archive." },
  { id: "clients", label: "Clients", href: "/admin/clients", description: "Manage properties, client logins, and portal access." },
  { id: "users", label: "Users", href: "/admin/users", description: "Manage portal accounts and reset passwords." },
  { id: "reports", label: "Reports", href: "/admin/reports", description: "Upload and review reports for the selected survey year." },
  { id: "digital-buck-book", label: "Digital Buck Book", href: "/admin/digital-buck-book", description: "Curate and publish the bucks selected for print." },
] as const;

export type AdminSection = (typeof adminSections)[number]["id"];

export function adminHref(path: string, client?: string, year?: string) {
  const query = new URLSearchParams();
  if (client) query.set("client", client);
  if (year) query.set("year", year);
  return `${path}${query.size ? `?${query}` : ""}`;
}
