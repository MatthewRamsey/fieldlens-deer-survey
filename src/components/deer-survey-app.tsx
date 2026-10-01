"use client";

import { NativeSelect } from "@/components/ui/native-select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import Image from "next/image";
import Link from "next/link";
import { Eye } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { AdminShell, ClientShell } from "@/components/admin-shell";
import { adminHref, adminSections, type AdminSection } from "@/lib/admin-navigation";
import { clientHref, clientSections, type ClientSection } from "@/lib/client-navigation";
import { useMemo, useState } from "react";
import { ClientManagement } from "@/components/client-management";
import { DocumentUploadForm } from "@/components/document-upload-form";
import { signOut } from "@/app/actions/auth";
import type { ManagedClient, ViewerContext } from "@/lib/portal-data";
import type { Client, SurveyYear } from "@/lib/portal-types";

type YearFilter = SurveyYear | "Lifetime";

const BRAND_NAME = "Upland Wildlife Management";
const BRAND_LOGO_URL =
  "https://www.uplandwildlifemanagement.com/lovable-uploads/a22bec12-9028-4ae2-aedf-59a70c278b87.png";

function buildDocumentUrl(clientId: string, surveyYear: SurveyYear, documentId: string) {
  return `/${clientId}/${surveyYear}/documents/${documentId}`;
}

export function DeerSurveyApp({
  viewer,
  accessibleClients,
  managedClients,
  initialClientId,
  portalOrigin,
  preview = false,
  section = "overview",
  clientSection = "overview",
  initialYear,
}: {
  viewer: ViewerContext;
  accessibleClients: Client[];
  managedClients: ManagedClient[];
  initialClientId?: string;
  portalOrigin: string;
  preview?: boolean;
  section?: AdminSection;
  clientSection?: ClientSection;
  initialYear?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const activeSection = adminSections.find(item => item.id === section)!;
  const [selectedClientId] = useState(
    (initialClientId && accessibleClients.some((entry) => entry.id === initialClientId) ? initialClientId : null) ??
      viewer.defaultClientId ??
      accessibleClients[0]?.id ??
      "",
  );
  const [selectedYear] = useState<YearFilter>(initialYear ?? accessibleClients.find(entry => entry.id === selectedClientId)?.surveyYears[0] ?? "Lifetime");

  const viewMode = preview ? "client" : viewer.role;
  const adminWorkspace = viewMode === "admin" && (section === "clients" || (section === "overview" && !accessibleClients.some(entry => entry.id === initialClientId)));
  const activeClientSection = clientSections.find(item => item.id === clientSection)!;
  const adminYears = useMemo(() => [...new Set(accessibleClients.flatMap(entry => entry.surveyYears))].sort((left, right) => Number(right) - Number(left)), [accessibleClients]);
  const adminYear = initialYear && adminYears.includes(initialYear) ? initialYear : "Lifetime";
  const adminStats = useMemo(() => {
    const inYear = (year: string) => adminYear === "Lifetime" || year === adminYear;
    const documents = accessibleClients.flatMap(entry => entry.documents.filter(document => inYear(document.surveyYear)));
    return {
      activeProperties: accessibleClients.length,
      publishedReports: documents.filter(document => document.status === "Published").length,
      draftReports: documents.filter(document => document.status === "Draft").length,
      buckBooks: accessibleClients.reduce((count, entry) => count + (entry.digitalBooks ?? []).filter(book => inYear(book.year)).length, 0),
    };
  }, [accessibleClients, adminYear]);
  const adminOverview = <>
    <section className="topbar admin-topbar" aria-label="Workspace controls">
      <div className="admin-topbar-body">
        <div className="admin-topbar-copy">
          <p className="eyebrow">Admin</p>
          <h1>Overview</h1>
          <p className="lede">Activity across all client properties.</p>
        </div>
        <div className="topbar-filters admin-topbar-filters client-year-filter">
          <label className="client-picker">
            <span>Survey year</span>
            <NativeSelect aria-label="All properties survey year" value={adminYear}
              onChange={event => router.push(event.target.value === "Lifetime" ? "/" : adminHref("/", undefined, event.target.value))}>
              <option value="Lifetime">Lifetime</option>
              {adminYears.map(year => <option key={year} value={year}>{year} survey year</option>)}
            </NativeSelect>
          </label>
        </div>
      </div>
    </section>
    <Card className="workspace-card" role="region" aria-label="All property statistics">
      <div className="workspace-top"><div><p className="eyebrow">All properties</p><h2>{adminYear === "Lifetime" ? "Lifetime totals" : `${adminYear} totals`}</h2></div></div>
      <div className="metric-grid admin-stats-grid">
        <Card className="metric-card"><span>Active properties</span><strong>{adminStats.activeProperties}</strong><p>Clients currently managed.</p></Card>
        <Card className="metric-card"><span>Published reports</span><strong>{adminStats.publishedReports}</strong><p>Released property documents.</p></Card>
        <Card className="metric-card"><span>Draft reports</span><strong>{adminStats.draftReports}</strong><p>Documents awaiting publication.</p></Card>
        <Card className="metric-card"><span>Digital Buck Books</span><strong>{adminStats.buckBooks}</strong><p>Books across properties.</p></Card>
      </div>
    </Card>
  </>;

  const client = useMemo(() => {
    return (
      accessibleClients.find((entry) => entry.id === selectedClientId) ??
      accessibleClients[0] ??
      null
    );
  }, [accessibleClients, selectedClientId]);

  if (adminWorkspace && section === "overview") {
    return <AdminShell viewer={viewer} clients={accessibleClients} section="overview" year={adminYear === "Lifetime" ? undefined : adminYear}>
      {adminOverview}
    </AdminShell>;
  }

  if (!client) {
    if (viewer.role === "admin") {
      return (
        <AdminShell viewer={viewer} clients={accessibleClients} section={section}>
          <header className="admin-page-heading"><p className="eyebrow">Workspace</p><h1>{activeSection.label}</h1></header>
          {section === "clients" ? <ClientManagement clients={managedClients} portalOrigin={portalOrigin} /> :
            <section className="workspace-card admin-empty-state">
              <h2>Add your first client</h2>
              <p>Create a client property to start managing reports and survey archives.</p>
              <Link className="primary-chip" href="/admin/clients">Manage clients</Link>
            </section>}
        </AdminShell>
      );
    }

    return (
      <main className="auth-shell">
        <section className="auth-hero">
          <div className="auth-copy">
            <div className="brand-mark">
              <Image className="brand-logo" src={BRAND_LOGO_URL} alt={`${BRAND_NAME} logo`} width={172} height={44} />
              <p className="eyebrow">Access Pending</p>
            </div>
            <h1>No client memberships are assigned to this profile yet.</h1>
            <p className="lede">
              This account is authenticated, but the Supabase profile does not currently map to any
              client account rows. Add memberships in Supabase before using the portal.
            </p>
            <form action={signOut}>
              <Button className="ghost-chip signout-chip" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  const effectiveSelectedYear =
    selectedYear === "Lifetime" || client.surveyYears.includes(selectedYear)
      ? selectedYear
      : client.surveyYears[0] ?? "Lifetime";
  const effectiveUploadYear =
    effectiveSelectedYear === "Lifetime" ? client.surveyYears[0] : effectiveSelectedYear;

  const documents = client.documents;
  const visibleDocuments =
    effectiveSelectedYear === "Lifetime"
      ? documents.filter((document) =>
          viewMode === "admin"
            ? true
            : document.visibility === "client" && document.status === "Published",
        )
      : documents.filter((document) => {
          const visibleToViewer =
            viewMode === "admin"
              ? true
              : document.visibility === "client" && document.status === "Published";

          return visibleToViewer && document.surveyYear === effectiveSelectedYear;
        });

  const publishedReportCount = visibleDocuments.filter(document => document.status === "Published").length;
  const content = (
    <>
        {viewMode === "admin" ? (
          <>
            <section className="topbar admin-topbar" aria-label="Workspace controls">
              <div className="admin-topbar-body">
                <div className="admin-topbar-copy">
                  <p className="eyebrow">{adminWorkspace ? "Admin" : client.propertyName}</p>
                  <h1>{activeSection.label}</h1>
                  <p className="lede">{adminWorkspace && section === "overview" ? "Manage your client properties and portal access." : activeSection.description}</p>
                  {!adminWorkspace && <div className="property-meta">
                    <span>{client.county}</span>
                    <span>{client.acreage} acres</span>
                  </div>}
                  {!adminWorkspace && section === "overview" && <Link
                    className="ghost-chip admin-client-preview-link"
                    href={clientHref("overview", client.id, effectiveSelectedYear, client.id)}
                  >
                    <Eye aria-hidden="true" />
                    Preview client view
                  </Link>}
                </div>

                {!adminWorkspace && <div className="topbar-filters admin-topbar-filters client-year-filter">
                  <label className="client-picker">
                    <span>Survey year</span>
                    <NativeSelect
                      aria-label="Archive view"
                      value={effectiveSelectedYear}
                      onChange={(event) => router.push(adminHref(pathname, client.id, event.target.value))}
                    >
                      {client.surveyYears.map((year) => (
                        <option key={year} value={year}>
                          {year} survey year
                        </option>
                      ))}
                      <option value="Lifetime">Lifetime archive</option>
                    </NativeSelect>
                  </label>
                </div>}
              </div>
            </section>

            {section === "clients" && <ClientManagement clients={managedClients} portalOrigin={portalOrigin} />}

            {(!adminWorkspace && section === "overview" || section === "reports") && <section className="workspace-card">
              {section === "overview" && <div className="metric-grid">
                <Card className="metric-card client-metric-card">
                  <Link className="client-metric-link" href={adminHref("/admin/reports", client.id, effectiveSelectedYear)}>
                    <span>Published reports</span>
                    <strong>{visibleDocuments.filter((document) => document.status === "Published").length}</strong>
                    <p>Reports released to your client.</p>
                    <span className="client-metric-action">View reports <span aria-hidden="true">→</span></span>
                  </Link>
                </Card>
                <Card className="metric-card client-metric-card">
                  <Link className="client-metric-link" href={adminHref("/admin/digital-buck-book", client.id, effectiveSelectedYear)}>
                    <span>Digital Buck Books</span>
                    <strong>{(client.digitalBooks ?? []).filter(book => effectiveSelectedYear === "Lifetime" || book.year === effectiveSelectedYear).length}</strong>
                    <p>Books in this archive view.</p>
                    <span className="client-metric-action">View book <span aria-hidden="true">→</span></span>
                  </Link>
                </Card>
              </div>}
              {section === "reports" && <div className="content-grid admin-grid admin-grid-single">
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Admin uploads</p>
                      <h3>Upload reports for a specific year</h3>
                    </div>
                  </div>

                  <DocumentUploadForm client={client} selectedYear={effectiveUploadYear} />
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h3>Documents</h3>
                    </div>
                  </div>

                  <div className="asset-list">
                    {visibleDocuments.length ? (
                      visibleDocuments.map((document) => (
                        <article className="asset-card" key={document.id}>
                          <div className="asset-top">
                            <div>
                              <h4>{document.title}</h4>
                              <p>
                                {document.surveyYear} • {document.category} • {document.fileType}
                                {document.pageCount ? ` • ${document.pageCount} pages` : ""}
                              </p>
                            </div>
                            <Badge variant="secondary" className={`label-chip ${document.visibility === "client" ? "doe" : "neutral"}`}>
                              {document.visibility === "client" ? "Client visible" : "Admin only"}
                            </Badge>
                          </div>
                          <p>{document.notes}</p>
                          <div className="asset-meta">
                            <span>{document.uploadedAt}</span>
                            <span>{document.status}</span>
                          </div>
                          <div className="asset-actions">
                            <a
                              className="ghost-chip action-chip"
                              href={buildDocumentUrl(client.id, document.surveyYear, document.id)}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {document.status === "Published" ? "Open document" : "Preview draft"}
                            </a>
                          </div>
                        </article>
                      ))
                    ) : (
                      <article className="empty-state">
                        <h4>No documents in this archive view</h4>
                        <p>Upload a new client report or switch the archive year to review another season.</p>
                      </article>
                    )}
                  </div>
                </section>
              </div>}
            </section>}

          </>
        ) : (
          <>
            <section className="topbar admin-topbar" aria-label="Workspace controls">
              <div className="admin-topbar-body">
                <div className="admin-topbar-copy">
                  <p className="eyebrow">{client.propertyName}</p>
                  <h1>{activeClientSection.label}</h1>
                  <p className="lede">{activeClientSection.description}</p>
                  <div className="property-meta">
                    <span>{client.county}</span>
                    <span>{client.acreage} acres</span>
                  </div>
                </div>

                <div className="topbar-filters admin-topbar-filters client-year-filter">
                  <label className="client-picker">
                    <span>Survey year</span>
                    <NativeSelect
                      aria-label="Archive view"
                      value={effectiveSelectedYear}
                      onChange={(event) => router.push(clientHref(clientSection, client.id, event.target.value, preview ? client.id : undefined))}
                    >
                      {client.surveyYears.map((year) => (
                        <option key={year} value={year}>
                          {year} survey year
                        </option>
                      ))}
                      <option value="Lifetime">Lifetime archive</option>
                    </NativeSelect>
                  </label>
                </div>
              </div>
            </section>

            {clientSection === "overview" && <Card className="workspace-card client-portal-card" role="region" aria-label="Published archive">
              <div className="metric-grid client-metric-grid">
                <Card className="metric-card client-metric-card">
                  <Link className="client-metric-link" href={clientHref("reports", client.id, effectiveSelectedYear, preview ? client.id : undefined)}>
                    <span>Published reports</span>
                    <strong>{publishedReportCount}</strong>
                    <p>Documents released for this property.</p>
                    <span className="client-metric-action">View reports <span aria-hidden="true">→</span></span>
                  </Link>
                </Card>
                <Card className="metric-card client-metric-card">
                  <Link className="client-metric-link" href={clientHref("digital-buck-book", client.id, effectiveSelectedYear, preview ? client.id : undefined)}>
                    <span>Digital Buck Book</span>
                    <strong>{(client.digitalBooks ?? []).filter(book => effectiveSelectedYear === "Lifetime" || book.year === effectiveSelectedYear).length}</strong>
                    <p>Browse the bucks selected for your printed book.</p>
                    <span className="client-metric-action">View book <span aria-hidden="true">→</span></span>
                  </Link>
                </Card>
              </div>
            </Card>}

            {clientSection === "reports" && <Card className="workspace-card client-portal-card" role="region" aria-label="Published reports">
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h3>Published reports</h3>
                    </div>
                  </div>

                  <div className="asset-list">
                    {visibleDocuments.length ? (
                      visibleDocuments.map((document) => (
                        <article className="asset-card" key={document.id}>
                          <div className="asset-top">
                            <div>
                              <h4>{document.title}</h4>
                              <p>
                                {document.surveyYear} • {document.category} • {document.fileType}
                                {document.pageCount ? ` • ${document.pageCount} pages` : ""}
                              </p>
                            </div>
                            <Badge variant="secondary" className="label-chip doe">{document.status}</Badge>
                          </div>
                          <p>{document.notes}</p>
                          <div className="asset-meta">
                            <span>{document.uploadedAt}</span>
                            <span>{document.surveyYear}</span>
                          </div>
                          <div className="asset-actions">
                            <a
                              className="primary-chip action-chip"
                              href={buildDocumentUrl(client.id, document.surveyYear, document.id)}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Open report
                            </a>
                          </div>
                        </article>
                      ))
                    ) : (
                      <article className="empty-state">
                        <h4>No published reports in this view</h4>
                        <p>Switch to another survey year or lifetime to browse more property documents.</p>
                      </article>
                    )}
                  </div>
                </section>
            </Card>}

          </>
        )}
    </>
  );
  return viewMode === "admin" ? (
    <AdminShell viewer={viewer} clients={accessibleClients} section={section} clientId={adminWorkspace ? undefined : client.id} year={adminWorkspace ? undefined : effectiveSelectedYear}>{content}</AdminShell>
  ) : <ClientShell viewer={viewer} section={clientSection} clientId={client.id} year={effectiveSelectedYear} preview={preview}>
    {preview ? <div className="client-preview-banner" role="status">
      <div><strong>Client preview: {client.propertyName}</strong><span>This is the published property view. You are still signed in as an administrator.</span></div>
      <Link href="/admin/clients">Exit preview</Link>
    </div> : null}
    {content}
  </ClientShell>;
}
