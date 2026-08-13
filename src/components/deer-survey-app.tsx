"use client";

import Image from "next/image";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import type { BuckFolder, Client, ClientDocument, SurveyYear } from "@/lib/demo-data";
import { signOut } from "@/app/actions/auth";
import type { ViewerContext } from "@/lib/portal-data";

type ClientPortalView = "reports" | "galleries";
type YearFilter = SurveyYear | "Lifetime";

type UploadedDocument = ClientDocument & {
  clientId: string;
  fileCount: number;
  uploadSource: "Desktop upload" | "Google Drive";
};

type UploadedFolder = BuckFolder & {
  clientId: string;
  fileNames: string[];
};

const BRAND_NAME = "Upland Wildlife Management";
const BRAND_LOGO_URL =
  "https://www.uplandwildlifemanagement.com/lovable-uploads/a22bec12-9028-4ae2-aedf-59a70c278b87.png";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildDocumentUrl(clientId: string, surveyYear: SurveyYear, documentId: string) {
  return `/${clientId}/${surveyYear}/documents/${documentId}`;
}

function QrTile({ value }: { value: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let active = true;

    QRCode.toDataURL(value, {
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
  const [selectedYear, setSelectedYear] = useState<YearFilter>("2026");
  const [clientPortalView, setClientPortalView] = useState<ClientPortalView>("reports");
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [uploadedFolders, setUploadedFolders] = useState<UploadedFolder[]>([]);
  const [documentCategory, setDocumentCategory] = useState<UploadedDocument["category"]>("Camera survey report");
  const [documentVisibility, setDocumentVisibility] = useState<UploadedDocument["visibility"]>("client");
  const [documentSource, setDocumentSource] = useState<UploadedDocument["uploadSource"]>("Desktop upload");
  const [documentYear, setDocumentYear] = useState<SurveyYear>("2026");
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [documentNote, setDocumentNote] = useState("");
  const [folderName, setFolderName] = useState("");
  const [folderBuckName, setFolderBuckName] = useState("");
  const [folderVisibility, setFolderVisibility] = useState<UploadedFolder["visibility"]>("client");
  const [folderSource, setFolderSource] = useState<UploadedFolder["source"]>("Manual upload");
  const [folderClassification, setFolderClassification] = useState<UploadedFolder["classification"]>("Trophy buck");
  const [folderYear, setFolderYear] = useState<SurveyYear>("2026");
  const [folderQrEnabled, setFolderQrEnabled] = useState(true);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [folderNote, setFolderNote] = useState("");

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

  const effectiveDocumentYear = client.surveyYears.includes(documentYear)
    ? documentYear
    : client.surveyYears[0];
  const effectiveFolderYear = client.surveyYears.includes(folderYear)
    ? folderYear
    : client.surveyYears[0];
  const effectiveSelectedYear =
    selectedYear === "Lifetime" || client.surveyYears.includes(selectedYear)
      ? selectedYear
      : client.surveyYears[0];

  const clientUploads = uploadedDocuments.filter((entry) => entry.clientId === client.id);
  const clientFolders = uploadedFolders.filter((entry) => entry.clientId === client.id);
  const documents = [...client.documents, ...clientUploads];
  const folders = [...client.buckFolders, ...clientFolders];

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

  const visibleFolders =
    effectiveSelectedYear === "Lifetime"
      ? folders.filter((folder) => (viewMode === "admin" ? true : folder.visibility === "client"))
      : folders.filter((folder) => {
          const visibleToViewer = viewMode === "admin" ? true : folder.visibility === "client";
          return visibleToViewer && folder.surveyYear === effectiveSelectedYear;
        });

  const visibleBuckBooks = visibleDocuments.filter((document) => document.category === "Buck book");
  const qrReadyFolders = visibleFolders.filter((folder) => folder.qrEnabled);
  const publishedReportCount = visibleDocuments.filter((document) => document.status === "Published").length;
  const sharedGalleryCount = visibleFolders.filter((folder) => folder.visibility === "client").length;
  const totalSharedImages = visibleFolders.reduce((total, folder) => total + folder.imageCount, 0);
  const adminDraftCount =
    viewMode === "admin"
      ? visibleDocuments.filter((document) => document.status === "Draft").length +
        visibleFolders.filter((folder) => folder.visibility === "admin").length
      : 0;
  const yearLabel =
    effectiveSelectedYear === "Lifetime" ? "Lifetime archive" : `${effectiveSelectedYear} survey year`;

  function handleFileSelection(setter: (files: File[]) => void) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setter(Array.from(event.target.files ?? []));
    };
  }

  function handleDocumentUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (documentFiles.length === 0) {
      return;
    }

    const uploadDate = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const entries = documentFiles.map((file, index) => ({
      id: `uploaded-doc-${client.id}-${Date.now()}-${index}`,
      clientId: client.id,
      title: file.name.replace(/\.[^.]+$/, ""),
      category: documentCategory,
      surveyYear: effectiveDocumentYear,
      uploadedAt: uploadDate,
      fileType: file.name.toLowerCase().endsWith(".docx")
        ? "DOCX"
        : file.name.toLowerCase().endsWith(".zip")
          ? "ZIP"
          : "PDF",
      visibility: documentVisibility,
      status: documentVisibility === "client" ? "Published" : "Draft",
      notes: documentNote || `Uploaded into the ${effectiveDocumentYear} property archive.`,
      fileCount: 1,
      uploadSource: documentSource,
    } satisfies UploadedDocument));

    setUploadedDocuments((current) => [...entries, ...current]);
    setDocumentFiles([]);
    setDocumentNote("");
  }

  function handleFolderUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (folderFiles.length === 0 || folderName.trim() === "" || folderBuckName.trim() === "") {
      return;
    }

    const uploadDate = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const folderPath = `/${client.id}/${effectiveFolderYear}/folders/${slugify(folderName)}`;

    const nextFolder: UploadedFolder = {
      id: `uploaded-folder-${client.id}-${Date.now()}`,
      clientId: client.id,
      name: folderName.trim(),
      buckName: folderBuckName.trim(),
      classification: folderClassification,
      surveyYear: effectiveFolderYear,
      imageCount: folderFiles.length,
      updatedAt: uploadDate,
      source: folderSource,
      visibility: folderVisibility,
      qrEnabled: folderQrEnabled,
      shareUrl:
        typeof window === "undefined" ? folderPath : new URL(folderPath, window.location.origin).toString(),
      notes: folderNote || `Digital gallery added to the ${effectiveFolderYear} archive.`,
      fileNames: folderFiles.map((file) => file.name),
    };

    setUploadedFolders((current) => [nextFolder, ...current]);
    setFolderName("");
    setFolderBuckName("");
    setFolderFiles([]);
    setFolderNote("");
    setFolderQrEnabled(true);
    setFolderVisibility("client");
    setFolderSource("Manual upload");
    setFolderClassification("Trophy buck");
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <main className="shell" id="main-content">
        <section className="topbar" aria-label="Workspace controls">
          <div className="brand-lockup">
            <div className="brand-mark">
              <Image className="brand-logo" src={BRAND_LOGO_URL} alt={`${BRAND_NAME} logo`} width={164} height={42} />
              <p className="eyebrow">{BRAND_NAME}</p>
            </div>
            <h1>{viewMode === "admin" ? "Property archive manager" : "Landowner camera survey portal"}</h1>
          </div>
          <div className="topbar-actions">
            <div className="session-summary">
              <span className="status-pill accent">{viewMode === "admin" ? "Admin profile" : "Client profile"}</span>
              <div className="session-copy">
                <strong>{viewer.fullName}</strong>
                <span>{viewer.email}</span>
              </div>
            </div>

            {viewMode === "admin" ? (
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
            ) : (
              <div className="client-picker readonly-picker">
                <span>Assigned client</span>
                <div className="readonly-value">{client.name}</div>
              </div>
            )}

            <label className="client-picker">
              <span>Archive view</span>
              <select
                aria-label="Archive view"
                value={effectiveSelectedYear}
                onChange={(event) => setSelectedYear(event.target.value as YearFilter)}
              >
                {client.surveyYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
                <option value="Lifetime">Lifetime</option>
              </select>
            </label>

            <form action={signOut}>
              <button className="ghost-chip signout-chip" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </section>

        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">{viewMode === "admin" ? "Upland Workspace" : "Property Archive"}</p>
            <h2>{client.propertyName}</h2>
            <p className="lede">
              {viewMode === "admin"
                ? "Build annual landowner deliverables, organize buck galleries, and keep draft working files separate from published client records."
                : "Choose a survey year, then open the published reports and buck galleries prepared for this property."}
            </p>
            <div className="property-meta">
              <span>{client.county}</span>
              <span>{client.acreage} acres</span>
              <span>{yearLabel}</span>
            </div>
          </div>

          {viewMode === "admin" ? (
            <div className="hero-panel">
              <span className="panel-title">At a glance</span>
              <div className="metric-grid compact split">
                <article className="metric-card">
                  <span>Reports</span>
                  <strong>{publishedReportCount}</strong>
                  <p>Survey reports, buck books, and supporting documents in this archive view.</p>
                </article>
                <article className="metric-card">
                  <span>Galleries</span>
                  <strong>{sharedGalleryCount}</strong>
                  <p>Digital buck galleries currently available for this property-year selection.</p>
                </article>
                <article className="metric-card">
                  <span>Draft assets</span>
                  <strong>{adminDraftCount}</strong>
                  <p>Admin-only reports and galleries held back from the client view.</p>
                </article>
              </div>
            </div>
          ) : null}
        </section>

        {viewMode === "admin" ? (
          <>
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
                  <span className="status-pill accent">{visibleFolders.length} galleries in view</span>
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
                  <span>QR galleries</span>
                  <strong>{qrReadyFolders.length}</strong>
                  <p>Galleries with QR-ready links for printed report pages and field use.</p>
                </article>
                <article className="metric-card">
                  <span>Admin-only assets</span>
                  <strong>
                    {visibleDocuments.filter((document) => document.visibility === "admin").length +
                      visibleFolders.filter((folder) => folder.visibility === "admin").length}
                  </strong>
                  <p>Draft or private assets still hidden from client users.</p>
                </article>
              </div>

              <div className="content-grid admin-grid">
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Admin uploads</p>
                      <h3>Upload reports for a specific year</h3>
                    </div>
                  </div>

                  <form className="upload-form" onSubmit={handleDocumentUpload}>
                    <div className="form-grid">
                      <label className="auth-field">
                        <span>Document category</span>
                        <select value={documentCategory} onChange={(event) => setDocumentCategory(event.target.value as UploadedDocument["category"])}>
                          <option>Camera survey report</option>
                          <option>Buck book</option>
                          <option>Map export</option>
                          <option>Harvest plan</option>
                        </select>
                      </label>
                      <label className="auth-field">
                        <span>Survey year</span>
                        <select value={effectiveDocumentYear} onChange={(event) => setDocumentYear(event.target.value as SurveyYear)}>
                          {client.surveyYears.map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="auth-field">
                        <span>Visibility</span>
                        <select value={documentVisibility} onChange={(event) => setDocumentVisibility(event.target.value as UploadedDocument["visibility"])}>
                          <option value="client">Publish to client</option>
                          <option value="admin">Keep admin only</option>
                        </select>
                      </label>
                      <label className="auth-field">
                        <span>Upload source</span>
                        <select value={documentSource} onChange={(event) => setDocumentSource(event.target.value as UploadedDocument["uploadSource"])}>
                          <option value="Desktop upload">Desktop upload</option>
                          <option value="Google Drive">Google Drive</option>
                        </select>
                      </label>
                    </div>

                    <label className="auth-field">
                      <span>Files</span>
                      <input multiple type="file" accept=".pdf,.docx,.zip" onChange={handleFileSelection(setDocumentFiles)} />
                    </label>

                    <label className="auth-field">
                      <span>Notes</span>
                      <textarea
                        rows={3}
                        value={documentNote}
                        onChange={(event) => setDocumentNote(event.target.value)}
                        placeholder="Add release notes, report version context, or publishing details."
                      />
                    </label>

                    <div className="upload-summary">
                      <span>{documentFiles.length} file(s) selected for {effectiveDocumentYear}</span>
                      <button className="primary-chip submit-chip" type="submit">
                        Add report upload
                      </button>
                    </div>
                  </form>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Gallery builder</p>
                      <h3>Create a buck gallery for a specific year</h3>
                    </div>
                  </div>

                  <form className="upload-form" onSubmit={handleFolderUpload}>
                    <div className="form-grid">
                      <label className="auth-field">
                        <span>Folder name</span>
                        <input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Wide Ten late-summer gallery" />
                      </label>
                      <label className="auth-field">
                        <span>Buck name</span>
                        <input value={folderBuckName} onChange={(event) => setFolderBuckName(event.target.value)} placeholder="Wide Ten" />
                      </label>
                      <label className="auth-field">
                        <span>Survey year</span>
                        <select value={effectiveFolderYear} onChange={(event) => setFolderYear(event.target.value as SurveyYear)}>
                          {client.surveyYears.map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="auth-field">
                        <span>Classification</span>
                        <select value={folderClassification} onChange={(event) => setFolderClassification(event.target.value as UploadedFolder["classification"])}>
                          <option value="Trophy buck">Trophy buck</option>
                          <option value="Management buck">Management buck</option>
                        </select>
                      </label>
                      <label className="auth-field">
                        <span>Folder source</span>
                        <select value={folderSource} onChange={(event) => setFolderSource(event.target.value as UploadedFolder["source"])}>
                          <option value="Manual upload">Direct upload</option>
                          <option value="SD card">SD card</option>
                          <option value="Google Drive">Google Drive</option>
                        </select>
                      </label>
                      <label className="auth-field">
                        <span>Visibility</span>
                        <select value={folderVisibility} onChange={(event) => setFolderVisibility(event.target.value as UploadedFolder["visibility"])}>
                          <option value="client">Share with client</option>
                          <option value="admin">Keep admin only</option>
                        </select>
                      </label>
                    </div>

                    <label className="auth-field">
                      <span>Gallery images</span>
                      <input multiple type="file" accept="image/*" onChange={handleFileSelection(setFolderFiles)} />
                    </label>

                    <label className="checkbox-row">
                      <input checked={folderQrEnabled} type="checkbox" onChange={(event) => setFolderQrEnabled(event.target.checked)} />
                      <span>Generate a QR-ready gallery link for this folder</span>
                    </label>

                    <label className="auth-field">
                      <span>Notes</span>
                      <textarea
                        rows={3}
                        value={folderNote}
                        onChange={(event) => setFolderNote(event.target.value)}
                        placeholder="Add publishing notes or context for this year’s digital gallery."
                      />
                    </label>

                    <div className="upload-summary">
                      <span>{folderFiles.length} image(s) selected for {effectiveFolderYear}</span>
                      <div className="summary-actions">
                        <button className="primary-chip submit-chip" type="submit">
                          Create gallery folder
                        </button>
                      </div>
                    </div>
                  </form>
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
              <div className="workspace-top">
                <div>
                  <p className="eyebrow">Digital buck gallery</p>
                  <h2>QR-linked galleries for the selected year or lifetime archive</h2>
                  <p className="section-copy">
                    Each gallery stays tied to its survey year so Upland can support both printed buck books and mobile follow-up viewing.
                  </p>
                </div>
                <div className="book-callout">
                  <strong>{visibleFolders.length}</strong>
                  <span>{visibleBuckBooks.length} buck books</span>
                  <span>{qrReadyFolders.length} QR-ready galleries</span>
                </div>
              </div>

              <div className="book-grid">
                {visibleFolders.length ? (
                  visibleFolders.map((folder) => (
                    <article className="book-card" key={folder.id}>
                      <div className="book-image">
                        <span>{folder.buckName.slice(0, 2).toUpperCase()}</span>
                      </div>
                      <div className="book-copy">
                        <div className="book-title">
                          <div>
                            <h3>{folder.buckName}</h3>
                            <p>{folder.surveyYear} gallery archive</p>
                          </div>
                          <span className={`label-chip ${folder.classification === "Trophy buck" ? "trophy" : "management"}`}>
                            {folder.classification}
                          </span>
                        </div>
                        <p>{folder.notes}</p>
                        <div className="book-meta">
                          <span>{folder.imageCount} linked images</span>
                          <span>{folder.source}</span>
                          <span>{folder.name}</span>
                        </div>
                        <div className="asset-actions">
                          <a className="primary-chip action-chip" href={folder.shareUrl} rel="noreferrer" target="_blank">
                            Open gallery
                          </a>
                        </div>
                      </div>
                      {folder.qrEnabled ? <QrTile value={folder.shareUrl} /> : <div className="qr-placeholder" aria-hidden="true" />}
                    </article>
                  ))
                ) : (
                  <article className="empty-state">
                    <h3>No QR-linked galleries in this view</h3>
                    <p>Choose another year or lifetime to browse buck folders that are ready to share.</p>
                  </article>
                )}
              </div>
            </section>
          </>
        ) : (
          <section className="workspace-card client-portal-card">
            <div className="workspace-top">
              <div>
                <p className="eyebrow">Published archive</p>
                <h2>Reports and buck galleries for {yearLabel.toLowerCase()}</h2>
                <p className="section-copy">
                  Open the published material prepared for this property. Lifetime combines every released survey year in one archive.
                </p>
              </div>
              <div className="client-summary">
                <strong>
                  {publishedReportCount} report{publishedReportCount === 1 ? "" : "s"} and {sharedGalleryCount} galler{sharedGalleryCount === 1 ? "y" : "ies"}
                </strong>
                <span>{totalSharedImages.toLocaleString()} shared images in this view</span>
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
                Buck galleries
              </button>
            </div>

            {clientPortalView === "reports" ? (
              <div className="asset-list">
                {visibleDocuments.length ? (
                  visibleDocuments.map((document) => (
                    <article className="asset-card" key={document.id}>
                      <div className="asset-top">
                        <div>
                          <h3>{document.title}</h3>
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
                        <span>{client.propertyName}</span>
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
                    <h3>No published reports in this view</h3>
                    <p>Switch to another survey year or wait for Upland to publish the next release.</p>
                  </article>
                )}
              </div>
            ) : (
              <div className="book-grid">
                {visibleFolders.length ? (
                  visibleFolders.map((folder) => (
                    <article className="book-card" key={folder.id}>
                      <div className="book-image">
                        <span>{folder.buckName.slice(0, 2).toUpperCase()}</span>
                      </div>
                      <div className="book-copy">
                        <div className="book-title">
                          <div>
                            <h3>{folder.buckName}</h3>
                            <p>{folder.surveyYear} gallery archive</p>
                          </div>
                          <span className={`label-chip ${folder.classification === "Trophy buck" ? "trophy" : "management"}`}>
                            {folder.classification}
                          </span>
                        </div>
                        <p>{folder.notes}</p>
                        <div className="book-meta">
                          <span>{folder.imageCount} linked images</span>
                          <span>{folder.source}</span>
                          <span>{folder.name}</span>
                        </div>
                        <div className="asset-actions">
                          <a className="primary-chip action-chip" href={folder.shareUrl} rel="noreferrer" target="_blank">
                            Open gallery
                          </a>
                        </div>
                      </div>
                      {folder.qrEnabled ? <QrTile value={folder.shareUrl} /> : <div className="qr-placeholder" aria-hidden="true" />}
                    </article>
                  ))
                ) : (
                  <article className="empty-state">
                    <h3>No published galleries in this view</h3>
                    <p>Choose another year or wait for Upland to publish the next gallery set.</p>
                  </article>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}
