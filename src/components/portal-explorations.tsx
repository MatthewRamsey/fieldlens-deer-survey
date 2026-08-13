import Link from "next/link";
import type { PortalExploration } from "@/lib/portal-explorations";
import { portalExplorations } from "@/lib/portal-explorations";
import styles from "./portal-explorations.module.css";

type PortalExplorationIndexProps = {
  branchName: string;
};

type PortalExplorationViewProps = {
  exploration: PortalExploration;
};

const demoCredentials = {
  client: { email: "cedar@uplandclients.com", password: "CedarClient!" },
  admin: { email: "admin@uplandwildlifemanagement.com", password: "UplandAdmin!" },
};

function BrandBlock() {
  return (
    <div className={styles.brand}>
      <div className={styles.brandMark}>
        <div className={styles.brandBadge} aria-hidden="true">
          U
        </div>
        <div className={styles.brandCopy}>
          <p className={styles.eyebrow}>Upland Wildlife Management</p>
          <strong>Property Archive Portal</strong>
        </div>
      </div>
    </div>
  );
}

function SignInCard({
  title = "Client Access",
  description = "Open published reports, buck books, and gallery links without internal draft material.",
  accent = "client",
}: {
  title?: string;
  description?: string;
  accent?: "client" | "admin";
}) {
  const demo = accent === "admin" ? demoCredentials.admin : demoCredentials.client;

  return (
    <section className={styles.signInCard} aria-labelledby={`${accent}-sign-in-title`}>
      <div className={styles.signInHeader}>
        <p className={styles.eyebrow}>Secure Sign In</p>
        <div className={styles.toggle} aria-label="Role preview">
          <span className={accent === "admin" ? styles.activeToggle : undefined}>Admin</span>
          <span className={accent === "client" ? styles.activeToggle : undefined}>Client</span>
        </div>
      </div>

      <div>
        <h2 className={styles.smallHeading} id={`${accent}-sign-in-title`}>
          {title}
        </h2>
        <p className={styles.lede}>{description}</p>
      </div>

      <form className={styles.form}>
        <label className={styles.field}>
          <span>Email</span>
          <input
            autoComplete="username"
            defaultValue={demo.email}
            name={`${accent}-email`}
            placeholder={accent === "admin" ? "admin@uplandwildlifemanagement.com…" : "cedar@uplandclients.com…"}
            spellCheck={false}
            type="email"
          />
        </label>
        <label className={styles.field}>
          <span>Password</span>
          <input
            autoComplete="current-password"
            defaultValue=""
            name={`${accent}-password`}
            placeholder="Enter your password…"
            type="password"
          />
        </label>
        <button className={styles.submit} type="submit">
          {accent === "admin" ? "Open Admin Workspace" : "Sign In to Client Portal"}
        </button>
      </form>

      <div className={styles.credentials}>
        <span>Demo credentials</span>
        <strong>{demo.email}</strong>
        <code>{demo.password}</code>
      </div>
    </section>
  );
}

function FeatureCards({ items }: { items: Array<{ title: string; body: string }> }) {
  return (
    <div className={styles.previewGrid}>
      {items.map((item) => (
        <article className={styles.featureCard} key={item.title}>
          <h3>{item.title}</h3>
          <p className={styles.lede}>{item.body}</p>
        </article>
      ))}
    </div>
  );
}

function OverviewCopy() {
  return (
    <>
      <p className={styles.eyebrow}>Upland Wildlife Management</p>
      <h1 className={styles.title}>Portal Concepts for Report, Gallery & Archive Access</h1>
      <p className={styles.lede}>
        Each route below shows a different approach to solving the same portal problem: clear role
        separation, fast sign-in, and a layout that behaves like software instead of a marketing splash page.
      </p>
    </>
  );
}

export function PortalExplorationIndex({ branchName }: PortalExplorationIndexProps) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <BrandBlock />
            <h1 className={styles.headerTitle}>10 Portal Entry Concepts on Separate Routes</h1>
            <p className={styles.headerText}>
              This branch contains one route per concept so you can inspect them directly in the browser
              and decide which structure is worth refining.
            </p>
          </div>
          <div className={styles.headerMeta}>
            <span className={styles.metaPill}>Branch: {branchName}</span>
            <span className={styles.metaPill}>Routes: {portalExplorations.length}</span>
          </div>
        </header>

        <section className={styles.routeGrid}>
          {portalExplorations.map((exploration) => (
            <article className={styles.routeCard} key={exploration.slug}>
              <p className={styles.eyebrow}>{exploration.shortTitle}</p>
              <h2>{exploration.title}</h2>
              <p>{exploration.description}</p>
              <p>
                <strong>Best when:</strong> {exploration.bestWhen}
              </p>
              <div className={styles.routeActions}>
                <Link className={styles.linkButton} href={`/portal-explorations/${exploration.slug}`}>
                  Open Route
                </Link>
                <span className={styles.metaPill}>/portal-explorations/{exploration.slug}</span>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function CenteredPortalCard() {
  return (
    <section className={`${styles.portal} ${styles.centeredLayout}`}>
      <div className={`${styles.surface} ${styles.centeredCard}`}>
        <BrandBlock />
        <h1 className={styles.title}>One Clear Card, One Clear Action</h1>
        <p className={styles.lede}>
          Center the sign-in experience and keep the surrounding copy extremely short.
        </p>
        <div className={styles.pills}>
          <span className={styles.pill}>Year-based archives</span>
          <span className={styles.pill}>Client-safe publishing</span>
          <span className={styles.pill}>QR-ready galleries</span>
        </div>
        <SignInCard />
      </div>
    </section>
  );
}

function TopHeaderEqualBands() {
  return (
    <section className={`${styles.portal} ${styles.equalBands}`}>
      <div className={`${styles.surface} ${styles.equalBandsHeader}`}>
        <OverviewCopy />
      </div>
      <div className={styles.equalBandsBody}>
        <section className={`${styles.surface} ${styles.equalBand}`}>
          <h2 className={styles.smallHeading}>What Users Need First</h2>
          <ul className={styles.list}>
            <li>Know whether they belong in admin or client access</li>
            <li>Understand what records live in the portal</li>
            <li>Find the sign-in form without scanning a giant hero</li>
          </ul>
        </section>
        <SignInCard />
      </div>
    </section>
  );
}

function SingleColumnStack() {
  return (
    <section className={`${styles.portal} ${styles.singleColumn}`}>
      <BrandBlock />
      <h1 className={styles.title}>A Straight Vertical Portal Flow</h1>
      <p className={styles.lede}>
        Brand, context, role, form, and credentials all appear in one predictable reading order.
      </p>
      <div className={styles.steps}>
        <span className={styles.step}>1. Choose role</span>
        <span className={styles.step}>2. Sign in</span>
        <span className={styles.step}>3. Open archive</span>
      </div>
      <SignInCard />
      <FeatureCards
        items={[
          { title: "Archive Access", body: "Published reports, buck books, and field-ready links by survey year." },
          { title: "Admin Controls", body: "Internal-only uploads, release checks, and client-safe visibility." },
          { title: "Mobile Friendly", body: "One-column rhythm that keeps the sign-in flow stable on smaller screens." },
        ]}
      />
    </section>
  );
}

function DashboardPreviewPortal() {
  return (
    <section className={`${styles.portal} ${styles.surface} ${styles.dashboardLayout}`}>
      <OverviewCopy />
      <div className={styles.signInFirstLayout}>
        <SignInCard />
        <div className={styles.archiveList}>
          <article className={styles.previewCard}>
            <h3>Property Reports</h3>
            <p className={styles.lede}>Survey summaries, map exports, and harvest plans by season.</p>
            <div className={styles.stats}>
              <span className={styles.stat}>24 page reports</span>
              <span className={styles.stat}>2 survey years</span>
            </div>
          </article>
          <article className={styles.previewCard}>
            <h3>Digital Buck Books</h3>
            <p className={styles.lede}>Curated galleries that mirror printed books and field handouts.</p>
            <div className={styles.stats}>
              <span className={styles.stat}>QR-linked galleries</span>
              <span className={styles.stat}>Published folders</span>
            </div>
          </article>
          <article className={styles.previewCard}>
            <h3>Archive Tools</h3>
            <p className={styles.lede}>Switch between properties, manage releases, and review draft assets.</p>
            <div className={styles.stats}>
              <span className={styles.stat}>Admin drafts</span>
              <span className={styles.stat}>Client-safe records</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function RoleFirstLogin() {
  return (
    <section className={`${styles.portal} ${styles.surface} ${styles.roleFirstLayout}`}>
      <OverviewCopy />
      <div className={styles.roleGrid}>
        <article className={`${styles.rolePanel} ${styles.rolePanelAdmin}`}>
          <p className={styles.eyebrow}>Admin</p>
          <h3>Internal Workspace</h3>
          <p className={styles.lede}>Publish final books, hold drafts back, and manage multiple properties.</p>
          <div className={styles.pills}>
            <span className={styles.pill}>Hunter orange theme</span>
            <span className={styles.pill}>Release controls</span>
          </div>
        </article>
        <article className={`${styles.rolePanel} ${styles.rolePanelClient}`}>
          <p className={styles.eyebrow}>Client</p>
          <h3>Landowner Portal</h3>
          <p className={styles.lede}>Open only the finished records prepared for your property and season.</p>
          <div className={styles.pills}>
            <span className={styles.pill}>Published records</span>
            <span className={styles.pill}>No draft material</span>
          </div>
        </article>
      </div>
      <SignInCard title="Choose a Role & Continue" description="Role separation comes first, followed by a shared sign-in experience." accent="admin" />
    </section>
  );
}

function CompactLeftRail() {
  return (
    <section className={`${styles.portal} ${styles.railLayout}`}>
      <aside className={`${styles.surface} ${styles.rail}`}>
        <BrandBlock />
        <article className={styles.railCard}>
          <h3>Why This Pattern</h3>
          <p className={styles.lede}>Keep context compact and let the access panel own the page.</p>
        </article>
        <article className={styles.railCard}>
          <h3>Best Use</h3>
          <p className={styles.lede}>Frequent desktop users who want a restrained enterprise portal feel.</p>
        </article>
      </aside>
      <section className={`${styles.surface} ${styles.railMain}`}>
        <OverviewCopy />
        <SignInCard />
      </section>
    </section>
  );
}

function TabbedPortalSurface() {
  return (
    <section className={`${styles.portal} ${styles.surface} ${styles.tabbedLayout}`}>
      <OverviewCopy />
      <div className={styles.tabRow} aria-label="Role views">
        <span>Client Access</span>
        <span className={styles.tabActive}>Admin Access</span>
      </div>
      <div className={styles.tabPanels}>
        <SignInCard />
        <SignInCard
          accent="admin"
          title="Admin Access"
          description="A role-specific accent system helps internal users immediately distinguish this workspace."
        />
      </div>
    </section>
  );
}

function SignInFirst() {
  return (
    <section className={`${styles.portal} ${styles.signInFirstLayout}`}>
      <SignInCard />
      <section className={`${styles.surface} ${styles.signInFirstInfo}`}>
        <OverviewCopy />
        <FeatureCards
          items={[
            { title: "Fast Return Visits", body: "The sign-in panel appears first so repeat users do not scan unnecessary content." },
            { title: "Clear Context", body: "Supporting information explains what lives in the portal without competing with the form." },
            { title: "Better Above the Fold", body: "Desktop space supports the form before secondary archive details appear below." },
          ]}
        />
      </section>
    </section>
  );
}

function PropertyArchiveTheme() {
  return (
    <section className={`${styles.portal} ${styles.surface} ${styles.archiveThemeLayout}`}>
      <div className={styles.archiveHeader}>
        <div>
          <p className={styles.eyebrow}>Property Archive Portal</p>
          <h1 className={styles.title}>Records, Books & Galleries by Survey Year</h1>
        </div>
        <div className={styles.stats}>
          <span className={styles.stat}>Macon County, Alabama</span>
          <span className={styles.stat}>1,240 acres</span>
          <span className={styles.stat}>2026 & 2025</span>
        </div>
      </div>
      <div className={styles.archiveGrid}>
        <div className={styles.archiveList}>
          <article className={styles.archiveCard}>
            <h3>Reports Archive</h3>
            <p className={styles.lede}>Annual survey reports, map exports, and planning documents organized by season.</p>
          </article>
          <article className={styles.archiveCard}>
            <h3>Buck Book Library</h3>
            <p className={styles.lede}>Published books and digital galleries aligned to the landowner delivery package.</p>
          </article>
          <article className={styles.archiveCard}>
            <h3>Release Status</h3>
            <p className={styles.lede}>Client-facing records stay separated from internal drafts and admin-only notes.</p>
          </article>
        </div>
        <SignInCard />
      </div>
    </section>
  );
}

function MinimalSecureAccess() {
  return (
    <section className={`${styles.portal} ${styles.minimalLayout}`}>
      <div className={`${styles.surface} ${styles.minimalCard}`}>
        <BrandBlock />
        <h1 className={styles.title}>Secure Access to the Property Archive</h1>
        <p className={styles.lede}>Minimal chrome, no filler, and just enough context to enter confidently.</p>
        <SignInCard />
      </div>
    </section>
  );
}

function VariantRenderer({ exploration }: PortalExplorationViewProps) {
  switch (exploration.slug) {
    case "centered-portal-card":
      return <CenteredPortalCard />;
    case "top-header-equal-bands":
      return <TopHeaderEqualBands />;
    case "single-column-stack":
      return <SingleColumnStack />;
    case "dashboard-preview":
      return <DashboardPreviewPortal />;
    case "role-first-login":
      return <RoleFirstLogin />;
    case "compact-left-rail":
      return <CompactLeftRail />;
    case "tabbed-portal-surface":
      return <TabbedPortalSurface />;
    case "sign-in-first":
      return <SignInFirst />;
    case "property-archive-theme":
      return <PropertyArchiveTheme />;
    case "minimal-secure-access":
      return <MinimalSecureAccess />;
    default:
      return null;
  }
}

function accentClass(accent: PortalExploration["accent"]) {
  switch (accent) {
    case "green":
      return styles.accentGreen;
    case "orange":
      return styles.accentOrange;
    case "sand":
      return styles.accentSand;
    case "slate":
      return styles.accentSlate;
  }
}

export function PortalExplorationView({ exploration }: PortalExplorationViewProps) {
  const index = portalExplorations.findIndex((entry) => entry.slug === exploration.slug);
  const previous = index > 0 ? portalExplorations[index - 1] : null;
  const next = index < portalExplorations.length - 1 ? portalExplorations[index + 1] : null;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.variant}>
          <div className={styles.navRow}>
            <div className={styles.navLinks}>
              <Link className={styles.ghostLink} href="/portal-explorations">
                All Concepts
              </Link>
              {previous ? (
                <Link className={styles.ghostLink} href={`/portal-explorations/${previous.slug}`}>
                  Previous
                </Link>
              ) : null}
              {next ? (
                <Link className={styles.ghostLink} href={`/portal-explorations/${next.slug}`}>
                  Next
                </Link>
              ) : null}
            </div>
            <div className={styles.variantMeta}>
              <span className={styles.metaPill}>{exploration.title}</span>
              <span className={styles.metaPill}>{exploration.bestWhen}</span>
            </div>
          </div>

          <div className={accentClass(exploration.accent)}>
            <VariantRenderer exploration={exploration} />
          </div>
        </div>
      </div>
    </main>
  );
}
