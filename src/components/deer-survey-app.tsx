"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { AccountSettings } from "@/components/account-settings";
import { CameraBatchManager } from "@/components/camera-batch-manager";
import { DocumentUploadForm } from "@/components/document-upload-form";
import { signOut } from "@/app/actions/auth";
import type { ViewerContext } from "@/lib/portal-data";
import type { CameraBatchImage, Client, SurveyYear } from "@/lib/portal-types";

type ClientPortalView = "reports" | "galleries";
type YearFilter = SurveyYear | "Lifetime";
type AdminBuckBookSort = "age" | "antlers";

const BRAND_NAME = "Upland Wildlife Management";
const BRAND_LOGO_URL =
  "https://www.uplandwildlifemanagement.com/lovable-uploads/a22bec12-9028-4ae2-aedf-59a70c278b87.png";

const ageOrder: Record<CameraBatchImage["ageLabel"], number> = {
  Unknown: 0,
  Fawn: 1,
  "1.5 years": 2,
  "2.5 years": 3,
  "3.5 years": 4,
  "4.5 years": 5,
  "5.5+ years": 6,
};

function buildDocumentUrl(clientId: string, surveyYear: SurveyYear, documentId: string) {
  return `/${clientId}/${surveyYear}/documents/${documentId}`;
}

function QrTile({ value }: { value: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let active = true;

    const shareUrl = new URL(value, window.location.origin).toString();

    QRCode.toDataURL(shareUrl, {
      margin: 1,
      color: {
        dark: "#17311b",
        light: "#f4efe2",
      },
      width: 168,
    }).then((dataUrl) => {
      if (active) {
        setSrc(dataUrl);
      }
    });

    return () => {
      active = false;
    };
  }, [value]);

  if (!src) {
    return <div className="qr-placeholder" aria-hidden="true" />;
  }

  return (
    <Image
      className="qr-code"
      src={src}
      alt="QR code linking to a buck gallery"
      width={168}
      height={168}
      loading="lazy"
      unoptimized
    />
  );
}

export function DeerSurveyApp({
  viewer,
  accessibleClients,
}: {
  viewer: ViewerContext;
  accessibleClients: Client[];
}) {
  const [selectedClientId, setSelectedClientId] = useState(
    viewer.defaultClientId ?? accessibleClients[0]?.id ?? "",
  );
  const [selectedYear, setSelectedYear] = useState<YearFilter>(accessibleClients[0]?.surveyYears[0] ?? "Lifetime");
  const [clientPortalView, setClientPortalView] = useState<ClientPortalView>("reports");
  const [adminBuckBookSort, setAdminBuckBookSort] = useState<AdminBuckBookSort>("age");

  const viewMode = viewer.role;

  const client = useMemo(() => {
    return (
      accessibleClients.find((entry) => entry.id === selectedClientId) ??
      accessibleClients[0] ??
      null
    );
  }, [accessibleClients, selectedClientId]);

  if (!client) {
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
              <button className="ghost-chip signout-chip" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  const effectiveSelectedYear =
    selectedYear === "Lifetime" || client.surveyYears.includes(selectedYear)
      ? selectedYear
      : client.surveyYears[0];
  const effectiveUploadYear =
    effectiveSelectedYear === "Lifetime" ? client.surveyYears[0] : effectiveSelectedYear;

  const documents = client.documents;
  const cameraBatches = client.cameraBatches;

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

  const visibleBuckBooks = visibleDocuments.filter((document) => document.category === "Buck book");
  const visibleCameraBatches =
    effectiveSelectedYear === "Lifetime"
      ? cameraBatches
      : cameraBatches.filter((batch) => batch.surveyYear === effectiveSelectedYear);
  const clientReadyImages = visibleCameraBatches.flatMap((batch) =>
    batch.images
      .filter((image) => image.clientVisible)
      .map((image) => ({
        ...image,
        cameraName: batch.cameraName,
        surveyYear: batch.surveyYear,
      })),
  );
  const compareBuckBookImages = (left: (typeof clientReadyImages)[number], right: (typeof clientReadyImages)[number]) => {
    if (adminBuckBookSort === "antlers") {
      const antlerDifference = (right.antlerPoints ?? -1) - (left.antlerPoints ?? -1);
      if (antlerDifference !== 0) {
        return antlerDifference;
      }
    } else {
      const ageDifference = ageOrder[right.ageLabel] - ageOrder[left.ageLabel];
      if (ageDifference !== 0) {
        return ageDifference;
      }
    }

    return left.fileName.localeCompare(right.fileName);
  };
  const groupedClientReadyImages = {
    Trophy: clientReadyImages
      .filter((image) => image.deerClassification === "Trophy")
      .sort(compareBuckBookImages),
    Management: clientReadyImages
      .filter((image) => image.deerClassification === "Management")
      .sort(compareBuckBookImages),
    Unsorted: clientReadyImages
      .filter((image) => image.deerClassification === "Unsorted")
      .sort(compareBuckBookImages),
  };
  const publishedReportCount = visibleDocuments.filter((document) => document.status === "Published").length;
  const publishedBuckBookImages = [
    ...groupedClientReadyImages.Trophy,
    ...groupedClientReadyImages.Management,
  ];
  const buckBookShareUrl =
    effectiveSelectedYear === "Lifetime" ? null : `/${client.id}/${effectiveSelectedYear}/buck-book`;
  const yearLabel =
    effectiveSelectedYear === "Lifetime" ? "Lifetime archive" : `${effectiveSelectedYear} survey year`;

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <main className="shell" id="main-content">
        {viewMode === "admin" ? (
          <>
            <section className="topbar admin-topbar" aria-label="Workspace controls">
              <div className="admin-topbar-header">
                <div className="brand-mark">
                  <Image className="brand-logo" src={BRAND_LOGO_URL} alt={`${BRAND_NAME} logo`} width={164} height={42} />
                  <p className="eyebrow">{BRAND_NAME} Portal</p>
                </div>
                <div className="session-summary">
                  <span className="status-pill accent">Admin login</span>
                  <div className="session-copy">
                    <strong>{viewer.fullName}</strong>
                    <span>{viewer.email}</span>
                  </div>
                  <Link className="ghost-chip signout-chip" href="/account">
                    Account
                  </Link>
                  <form action={signOut}>
                    <button className="ghost-chip signout-chip" type="submit">
                      Sign out
                    </button>
                  </form>
                </div>
              </div>

              <div className="admin-topbar-body">
                <div className="admin-topbar-copy">
                  <h1>{client.propertyName}</h1>
                  <p className="lede">Choose a survey year, then manage the published reports, camera batches, and client-ready deer images prepared for this property.</p>
                  <div className="property-meta">
                    <span>{client.county}</span>
                    <span>{client.acreage} acres</span>
                    <span>{yearLabel}</span>
                  </div>
                </div>

                <div className="topbar-filters admin-topbar-filters">
                  <label className="client-picker">
                    <span>Active client</span>
                    <select
                      aria-label="Active client"
                      value={selectedClientId}
                      onChange={(event) => setSelectedClientId(event.target.value)}
                    >
                      {accessibleClients.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="client-picker">
                    <span>Survey year</span>
                    <select
                      aria-label="Archive view"
                      value={effectiveSelectedYear}
                      onChange={(event) => setSelectedYear(event.target.value as YearFilter)}
                    >
                      {client.surveyYears.map((year) => (
                        <option key={year} value={year}>
                          {year} survey year
                        </option>
                      ))}
                      <option value="Lifetime">Lifetime archive</option>
                    </select>
                  </label>
                </div>
              </div>
            </section>

            <section className="workspace-card">
              <div className="workspace-top">
                <div>
                  <p className="eyebrow">Archive access</p>
                  <h2>Manage year-based client archives</h2>
                  <p className="section-copy">
                    Each property can carry a fresh survey report set and buck galleries every year. Use the year selector to review one season or the full lifetime archive.
                  </p>
                </div>
              </div>

              <div className="client-banner quiet">
                <div>
                  <h3>{client.propertyName}</h3>
                  <p>
                    {client.county} • {client.acreage} acres • {yearLabel}
                  </p>
                </div>
                <div className="status-group">
                  <span className="status-pill">{client.surveyYears.length} tracked survey years</span>
                  <span className="status-pill">{visibleDocuments.length} documents in view</span>
                  <span className="status-pill accent">{visibleCameraBatches.length} camera batches in view</span>
                </div>
              </div>

              <div className="metric-grid">
                <article className="metric-card">
                  <span>Published reports</span>
                  <strong>{visibleDocuments.filter((document) => document.status === "Published").length}</strong>
                  <p>Client-facing reports and books filtered to the selected archive view.</p>
                </article>
                <article className="metric-card">
                  <span>Buck books</span>
                  <strong>{visibleBuckBooks.length}</strong>
                  <p>Printable or digital buck books available in the current archive view.</p>
                </article>
                <article className="metric-card">
                  <span>Camera batches</span>
                  <strong>{visibleCameraBatches.length}</strong>
                  <p>Per-camera image pulls available for review in the selected archive view.</p>
                </article>
                <article className="metric-card">
                  <span>Client-ready deer images</span>
                  <strong>{clientReadyImages.length}</strong>
                  <p>Images already marked visible for the client buck book and gallery experience.</p>
                </article>
              </div>

              <div className="content-grid admin-grid admin-grid-single">
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
                      <p className="eyebrow">Reports archive</p>
                      <h3>Documents currently in this year view</h3>
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
                            <span className={`label-chip ${document.visibility === "client" ? "doe" : "neutral"}`}>
                              {document.visibility === "client" ? "Client visible" : "Admin only"}
                            </span>
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
              </div>
            </section>

            <section className="workspace-card book-section">
              <CameraBatchManager client={client} selectedYear={effectiveSelectedYear} />
            </section>

            <section className="workspace-card book-section">
              <div className="workspace-top">
                <div>
                  <p className="eyebrow">Client-ready buck book preview</p>
                  <h2>Group visible deer images by management or trophy and sort the order before client release</h2>
                  <p className="section-copy">
                    This is the same deer-image structure the client sees. Only management and trophy images are released; unclassified images stay in this review workspace.
                  </p>
                </div>
                <div className="book-callout">
                  <strong>{clientReadyImages.length}</strong>
                  <span>{groupedClientReadyImages.Trophy.length} trophy images</span>
                  <span>{groupedClientReadyImages.Management.length} management images</span>
                </div>
              </div>

              <div className="buck-book-toolbar">
                <label className="client-picker buck-book-sorter">
                  <span>Sort client-ready images</span>
                  <select
                    aria-label="Sort client-ready deer images"
                    value={adminBuckBookSort}
                    onChange={(event) => setAdminBuckBookSort(event.target.value as AdminBuckBookSort)}
                  >
                    <option value="age">By age</option>
                    <option value="antlers">By antler count</option>
                  </select>
                </label>
                {buckBookShareUrl ? (
                  <div className="buck-book-share">
                    <QrTile value={buckBookShareUrl} />
                    <a className="ghost-chip action-chip" href={buckBookShareUrl} target="_blank" rel="noreferrer">
                      Open client buck book
                    </a>
                  </div>
                ) : null}
              </div>

              <div className="buck-book-preview-grid">
                {(["Trophy", "Management", "Unsorted"] as const).map((group) => {
                  const images = groupedClientReadyImages[group];
                  const labelClass =
                    group === "Trophy" ? "trophy" : group === "Management" ? "management" : "neutral";

                  return (
                    <section className="panel buck-book-preview-panel" key={group}>
                      <div className="panel-header">
                        <div>
                          <p className="eyebrow">Client grouping</p>
                          <h3>{group === "Unsorted" ? "Needs classification" : `${group} deer`}</h3>
                        </div>
                        <span className={`label-chip ${labelClass}`}>{images.length} images</span>
                      </div>

                      {images.length ? (
                        <div className="buck-book-card-grid">
                          {images.map((image) => (
                            <article className="buck-book-image-card" key={image.id}>
                              <div className="buck-book-image-frame">
                                <Image
                                  alt={image.fileName}
                                  className="buck-book-image"
                                  height={220}
                                  src={image.url}
                                  unoptimized
                                  width={320}
                                />
                              </div>
                              <div className="buck-book-image-copy">
                                <div className="asset-top">
                                  <strong>{image.fileName}</strong>
                                  <span className={`label-chip ${labelClass}`}>{group}</span>
                                </div>
                                <div className="book-meta">
                                  <span>{image.cameraName}</span>
                                  <span>{image.surveyYear}</span>
                                  <span>{image.ageLabel}</span>
                                  <span>{image.antlerPoints !== null ? `${image.antlerPoints} points` : "No antler count"}</span>
                                  <span>{image.lifeStatus}</span>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <article className="empty-state">
                          <h3>No images in this group yet</h3>
                          <p>
                            {group === "Unsorted"
                              ? "Images marked client visible still need a management or trophy classification."
                              : `Tag deer images as ${group.toLowerCase()} and mark them client visible to build this section.`}
                          </p>
                        </article>
                      )}
                    </section>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="topbar client-topbar" aria-label="Workspace controls">
              <div className="client-topbar-header">
                <div className="brand-mark">
                  <Image className="brand-logo" src={BRAND_LOGO_URL} alt={`${BRAND_NAME} logo`} width={164} height={42} />
                  <p className="eyebrow">{BRAND_NAME} Portal</p>
                </div>
                <div className="session-summary">
                  <span className="status-pill accent">Client login</span>
                  <div className="session-copy">
                    <strong>{viewer.fullName}</strong>
                    <span>{viewer.email}</span>
                  </div>
                  <Link className="ghost-chip signout-chip" href="/account">
                    Account
                  </Link>
                  <form action={signOut}>
                    <button className="ghost-chip signout-chip" type="submit">
                      Sign out
                    </button>
                  </form>
                </div>
              </div>

              <div className="client-topbar-body">
                <div className="client-topbar-copy">
                  <h1>{client.propertyName}</h1>
                  <p className="lede">Choose a survey year, then open the published reports and deer images prepared for this property.</p>
                  <div className="property-meta">
                    <span>{client.county}</span>
                    <span>{client.acreage} acres</span>
                    <span>{yearLabel}</span>
                  </div>
                </div>

                <div className="topbar-filters client-topbar-filters">
                  <div className="client-picker readonly-picker">
                    <span>Assigned client</span>
                    <div className="readonly-value">{client.name}</div>
                  </div>

                  <label className="client-picker">
                    <span>Survey year</span>
                    <select
                      aria-label="Archive view"
                      value={effectiveSelectedYear}
                      onChange={(event) => setSelectedYear(event.target.value as YearFilter)}
                    >
                      {client.surveyYears.map((year) => (
                        <option key={year} value={year}>
                          {year} survey year
                        </option>
                      ))}
                      <option value="Lifetime">Lifetime archive</option>
                    </select>
                  </label>
                </div>
              </div>
            </section>

            <section className="workspace-card client-portal-card">
              <div className="workspace-top">
                <div>
                  <p className="eyebrow">Published archive</p>
                  <h2>Reports and buck book for {yearLabel.toLowerCase()}</h2>
                  <p className="section-copy">
                    Open the published material prepared for this property. Lifetime combines every released survey year in one archive.
                  </p>
                </div>
                <div className="client-summary">
                  <strong>
                    {publishedReportCount} report{publishedReportCount === 1 ? "" : "s"} and {publishedBuckBookImages.length} deer image{publishedBuckBookImages.length === 1 ? "" : "s"}
                  </strong>
                  <span>Grouped by management and trophy</span>
                </div>
              </div>

              <div className="portal-switcher" role="tablist" aria-label="Client archive section">
                <button
                  aria-selected={clientPortalView === "reports"}
                  className={clientPortalView === "reports" ? "primary-chip active" : "ghost-chip"}
                  onClick={() => setClientPortalView("reports")}
                  role="tab"
                  type="button"
                >
                  Reports
                </button>
                <button
                  aria-selected={clientPortalView === "galleries"}
                  className={clientPortalView === "galleries" ? "primary-chip active" : "ghost-chip"}
                  onClick={() => setClientPortalView("galleries")}
                  role="tab"
                  type="button"
                >
                  Digital buck book
                </button>
              </div>

              {clientPortalView === "reports" ? (
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Property reports</p>
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
                            <span className="label-chip doe">{document.status}</span>
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
              ) : (
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Digital buck book</p>
                      <h3>Management and trophy deer</h3>
                    </div>
                  </div>

                  <div className="buck-book-preview-grid client-buck-book-grid">
                    {(["Trophy", "Management"] as const).map((group) => {
                      const images = groupedClientReadyImages[group];
                      const labelClass = group === "Trophy" ? "trophy" : "management";

                      return (
                        <section className="buck-book-client-panel" key={group}>
                          <div className="panel-header">
                            <div>
                              <p className="eyebrow">{group} deer</p>
                              <h4>{images.length} client-ready image{images.length === 1 ? "" : "s"}</h4>
                            </div>
                            <span className={`label-chip ${labelClass}`}>{group}</span>
                          </div>
                          <div className="buck-book-card-grid">
                            {images.map((image) => (
                              <a
                                className="buck-book-image-card client-buck-book-image-card"
                                href={buckBookShareUrl ?? "#"}
                                key={image.id}
                                target={buckBookShareUrl ? "_blank" : undefined}
                              >
                                <div className="buck-book-image-frame">
                                  <Image alt={image.fileName} className="buck-book-image" height={220} src={image.url} unoptimized width={320} />
                                </div>
                                <div className="buck-book-image-copy">
                                  <strong>{image.ageLabel}</strong>
                                  <div className="book-meta">
                                    <span>{image.antlerPoints !== null ? `${image.antlerPoints} points` : "Antler count not listed"}</span>
                                    <span>{image.lifeStatus}</span>
                                  </div>
                                </div>
                              </a>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                    {publishedBuckBookImages.length === 0 ? (
                      <article className="empty-state">
                        <h4>No deer images have been released yet</h4>
                        <p>Your wildlife manager will add reviewed management and trophy deer images here.</p>
                      </article>
                    ) : null}
                  </div>
                </section>
              )}
            </section>
            <section className="client-details-card">
              <p className="eyebrow">Property details</p>
              <div className="status-group">
                <span className="status-pill">{client.county}</span>
                <span className="status-pill">{client.acreage} acres</span>
                <span className="status-pill">{client.surveyYears.length} tracked years</span>
                <span className="status-pill accent">{visibleBuckBooks.length} buck books available</span>
              </div>
            </section>
            <AccountSettings accessibleClients={accessibleClients} viewer={viewer} />
          </>
        )}
      </main>
    </>
  );
}
