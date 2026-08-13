export type PortalExploration = {
  slug: string;
  shortTitle: string;
  title: string;
  description: string;
  bestWhen: string;
  accent: "green" | "orange" | "sand" | "slate";
};

export const portalExplorations: PortalExploration[] = [
  {
    slug: "centered-portal-card",
    shortTitle: "Centered Card",
    title: "Centered Portal Card",
    description: "A single, high-confidence login card with concise support content around it.",
    bestWhen: "The fastest sign-in path matters more than storytelling.",
    accent: "green",
  },
  {
    slug: "top-header-equal-bands",
    shortTitle: "Equal Bands",
    title: "Top Header + Equal Bands",
    description: "A compact branded header with a balanced two-column body for orientation and access.",
    bestWhen: "You want a classic portal layout without wasting horizontal space.",
    accent: "sand",
  },
  {
    slug: "single-column-stack",
    shortTitle: "Single Column",
    title: "Single Column Stack",
    description: "A narrow, sequential entry flow with no side-by-side competition.",
    bestWhen: "Mobile clarity and predictable vertical scanning are the priority.",
    accent: "slate",
  },
  {
    slug: "dashboard-preview",
    shortTitle: "Dashboard Preview",
    title: "Dashboard Preview Portal",
    description: "A login-first page that previews the archive tools users will reach after sign-in.",
    bestWhen: "You want the page to feel like software instead of a brochure.",
    accent: "green",
  },
  {
    slug: "role-first-login",
    shortTitle: "Role First",
    title: "Role-First Login",
    description: "The first decision is audience selection, followed by a role-specific access panel.",
    bestWhen: "Admin and client need a clearly separated mental model.",
    accent: "orange",
  },
  {
    slug: "compact-left-rail",
    shortTitle: "Left Rail",
    title: "Compact Left Rail",
    description: "A narrow informational rail and a dominant sign-in area for efficient desktop use.",
    bestWhen: "You want a restrained enterprise portal pattern.",
    accent: "slate",
  },
  {
    slug: "tabbed-portal-surface",
    shortTitle: "Tabbed Surface",
    title: "Tabbed Portal Surface",
    description: "One shared shell where client and admin access live behind clear tabs.",
    bestWhen: "A single entry point should serve both roles without extra page clutter.",
    accent: "orange",
  },
  {
    slug: "sign-in-first",
    shortTitle: "Sign-In First",
    title: "Sign-In First",
    description: "The form leads the page, with context and archive details supporting underneath.",
    bestWhen: "Returning users dominate and need zero ambiguity.",
    accent: "green",
  },
  {
    slug: "property-archive-theme",
    shortTitle: "Archive Theme",
    title: "Property Archive Theme",
    description: "An archive-inspired entry page with record chips, property metadata, and library cues.",
    bestWhen: "The product should immediately feel tied to reports, books, and galleries.",
    accent: "sand",
  },
  {
    slug: "minimal-secure-access",
    shortTitle: "Minimal Access",
    title: "Minimal Secure Access",
    description: "A stripped-down secure access screen with almost no non-essential interface.",
    bestWhen: "Repeat users need a fast, quiet, modern entry experience.",
    accent: "slate",
  },
];

export const explorationMap = Object.fromEntries(
  portalExplorations.map((exploration) => [exploration.slug, exploration]),
) as Record<string, PortalExploration>;
