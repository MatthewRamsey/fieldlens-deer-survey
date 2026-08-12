"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  clients,
  getCamera,
  portalUsers,
  type BuckFolder,
  type ClassificationLabel,
  type Client,
  type ClientDocument,
  type PortalUser,
} from "@/lib/demo-data";

type ViewMode = "admin" | "client";
type AuthMode = "admin" | "client";
type Session = {
  userId: string;
  role: ViewMode;
  clientId: string;
};

type UploadedDocument = ClientDocument & {
  clientId: string;
  fileCount: number;
  uploadSource: "Desktop upload" | "Google Drive";
};

type UploadedFolder = BuckFolder & {
  clientId: string;
  linkedDetectionId?: string;
  fileNames: string[];
};

const SESSION_KEY = "fieldlens-session";

function formatRatio(bucks: number, does: number) {
  if (does === 0) {
    return `${bucks}:0`;
  }

  return `1:${(does / Math.max(bucks, 1)).toFixed(1)}`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function QrTile({ value }: { value: string }) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    let active = true;

    QRCode.toDataURL(value, {
      margin: 1,
      color: {
        dark: "#17311b",
        light: "#f4efe2",
      },
      width: 168,
    }).then((dataUrl: string) => {
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
    <img
      className="qr-code"
      src={src}
      alt="QR code linking to additional buck photos"
      width={168}
      height={168}
      loading="lazy"
    />
  );
}

function classifyTone(label: ClassificationLabel) {
  switch (label) {
    case "Trophy buck":
      return "trophy";
    case "Management buck":
      return "management";
    case "Doe":
      return "doe";
    case "Fawn":
      return "fawn";
    default:
      return "neutral";
  }
}

function buildSummary(client: Client) {
  const trophy = client.detections.filter((detection) => detection.finalLabel === "Trophy buck");
  const management = client.detections.filter((detection) => detection.finalLabel === "Management buck");
  const does = client.detections.filter((detection) => detection.finalLabel === "Doe");
  const fawns = client.detections.filter((detection) => detection.finalLabel === "Fawn");
  const corrections = client.detections.filter((detection) => detection.aiLabel !== detection.finalLabel);
  const inReview = client.cameras.filter((camera) => camera.status !== "Reviewed");
  const confidenceAverage =
    client.detections.reduce((total, detection) => total + detection.confidence, 0) /
    client.detections.length;

  return {
    trophy,
    management,
    does,
    fawns,
    corrections,
    inReview,
    confidenceAverage,
    totalImages: client.cameras.reduce((total, camera) => total + camera.imageCount, 0),
  };
}

function getAccessibleClientIds(user: PortalUser) {
  return user.role === "admin" ? clients.map((client) => client.id) : user.clientIds;
}

function LoginPortal({
  authMode,
  email,
  password,
  error,
  onAuthModeChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: {
  authMode: AuthMode;
  email: string;
  password: string;
  error: string;
  onAuthModeChange: (mode: AuthMode) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const suggestedUser =
    authMode === "admin"
      ? portalUsers.find((user) => user.role === "admin")
      : portalUsers.find((user) => user.role === "client");

  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <div className="auth-copy">
          <p className="eyebrow">FieldLens Deer Survey</p>
          <h1>Secure admin uploads, client-safe reports, and QR-linked buck folders.</h1>
          <p className="lede">
            Admin users can upload survey reports, camera images, and buck galleries for any client.
            Client accounts only see the published assets tied to their own property.
          </p>
          <div className="auth-feature-list">
            <article className="auth-feature">
              <strong>Admin control</strong>
              <p>Upload reports, stage images, and decide exactly which folders or documents are visible.</p>
            </article>
            <article className="auth-feature">
              <strong>Client isolation</strong>
              <p>Each client is scoped to one property, with no route to view another client’s files or results.</p>
            </article>
            <article className="auth-feature">
              <strong>QR-ready buck folders</strong>
              <p>Build folders for trophy and management bucks, then generate a direct QR code for the printed book.</p>
            </article>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-mode-toggle" role="tablist" aria-label="Login mode">
            <button
              aria-selected={authMode === "admin"}
              className={authMode === "admin" ? "primary-chip active" : "ghost-chip"}
              onClick={() => onAuthModeChange("admin")}
              role="tab"
              type="button"
            >
              Admin login
            </button>
            <button
              aria-selected={authMode === "client"}
              className={authMode === "client" ? "primary-chip active" : "ghost-chip"}
              onClick={() => onAuthModeChange("client")}
              role="tab"
              type="button"
            >
              Client login
            </button>
          </div>

          <div className="auth-card-copy">
            <h2>{authMode === "admin" ? "Admin portal" : "Client portal"}</h2>
            <p>
              {authMode === "admin"
                ? "Use your admin account to upload documents, manage image folders, and publish only approved assets."
                : "Use a client account to view only your property report, shared buck folders, and published survey files."}
            </p>
          </div>

          <form className="auth-form" onSubmit={onSubmit}>
            <label className="auth-field">
              <span>Email</span>
              <input
                autoComplete="username"
                name="email"
                onChange={(event) => onEmailChange(event.target.value)}
                placeholder={authMode === "admin" ? "admin@fieldlensdemo.com" : "cedar@fieldlensdemo.com"}
                type="email"
                value={email}
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input
                autoComplete="current-password"
                name="password"
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="Enter your password"
                type="password"
                value={password}
              />
            </label>

            {error ? <p className="auth-error">{error}</p> : null}

            <button className="auth-submit" type="submit">
              Sign in to {authMode === "admin" ? "admin" : "client"} portal
            </button>
          </form>

          {suggestedUser ? (
            <div className="auth-demo">
              <span>Demo credentials</span>
              <strong>{suggestedUser.email}</strong>
              <code>{suggestedUser.password}</code>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export function DeerSurveyApp() {
  const [authMode, setAuthMode] = useState<AuthMode>("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<ClassificationLabel | "All">("All");
  const [selectedClientId, setSelectedClientId] = useState(clients[0].id);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [uploadedFolders, setUploadedFolders] = useState<UploadedFolder[]>([]);
  const [documentCategory, setDocumentCategory] = useState<UploadedDocument["category"]>("Camera survey report");
  const [documentVisibility, setDocumentVisibility] = useState<UploadedDocument["visibility"]>("client");
  const [documentSource, setDocumentSource] = useState<UploadedDocument["uploadSource"]>("Desktop upload");
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [documentNote, setDocumentNote] = useState("");
  const [folderName, setFolderName] = useState("");
  const [folderLinkedDetectionId, setFolderLinkedDetectionId] = useState("");
  const [folderVisibility, setFolderVisibility] = useState<UploadedFolder["visibility"]>("client");
  const [folderSource, setFolderSource] = useState<UploadedFolder["source"]>("Manual upload");
  const [folderQrEnabled, setFolderQrEnabled] = useState(true);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [folderNote, setFolderNote] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem(SESSION_KEY);

    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as Session;
      setSession(parsed);
      setSelectedClientId(parsed.clientId);
      setAuthMode(parsed.role);
    } catch {
      window.localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const currentUser = useMemo(() => {
    if (!session) {
      return null;
    }

    return portalUsers.find((user) => user.id === session.userId) ?? null;
  }, [session]);

  const accessibleClientIds = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    return getAccessibleClientIds(currentUser);
  }, [currentUser]);

  useEffect(() => {
    if (!session || accessibleClientIds.length === 0) {
      return;
    }

    if (!accessibleClientIds.includes(selectedClientId)) {
      setSelectedClientId(accessibleClientIds[0]);
    }
  }, [accessibleClientIds, selectedClientId, session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const nextSession =
      session.clientId === selectedClientId ? session : { ...session, clientId: selectedClientId };

    if (nextSession !== session) {
      setSession(nextSession);
    }

    window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
  }, [selectedClientId, session]);

  const viewMode: ViewMode = session?.role ?? "client";

  const availableClients = useMemo(() => {
    if (!accessibleClientIds.length) {
      return [];
    }

    return clients.filter((client) => accessibleClientIds.includes(client.id));
  }, [accessibleClientIds]);

  const client = useMemo(() => {
    return (
      availableClients.find((entry) => entry.id === selectedClientId) ??
      availableClients[0] ??
      clients[0]
    );
  }, [availableClients, selectedClientId]);

  const summary = useMemo(() => buildSummary(client), [client]);
  const reviewedDetections = useMemo(() => {
    if (selectedLabel === "All") {
      return client.detections;
    }

    return client.detections.filter((detection) => detection.finalLabel === selectedLabel);
  }, [client, selectedLabel]);

  const clientUploads = useMemo(() => {
    return uploadedDocuments.filter((entry) => entry.clientId === client.id);
  }, [client.id, uploadedDocuments]);

  const clientFolders = useMemo(() => {
    return uploadedFolders.filter((entry) => entry.clientId === client.id);
  }, [client.id, uploadedFolders]);

  const documents = useMemo(() => {
    return [...client.documents, ...clientUploads];
  }, [client.documents, clientUploads]);

  const folders = useMemo(() => {
    return [...client.buckFolders, ...clientFolders];
  }, [client.buckFolders, clientFolders]);

  const visibleDocuments = useMemo(() => {
    return viewMode === "admin"
      ? documents
      : documents.filter((document) => document.visibility === "client" && document.status === "Published");
  }, [documents, viewMode]);

  const visibleFolders = useMemo(() => {
    return viewMode === "admin"
      ? folders
      : folders.filter((folder) => folder.visibility === "client");
  }, [folders, viewMode]);

  const bookEntries = [...summary.trophy, ...summary.management].sort((a, b) => {
    return (b.antlerScore ?? 0) - (a.antlerScore ?? 0);
  });
  const totalBuckCount = summary.trophy.length + summary.management.length;
  const reviewQueueCount = summary.inReview.length + summary.corrections.length;
  const featuredDetections = reviewedDetections.slice(0, viewMode === "admin" ? reviewedDetections.length : 6);
  const sharedFolderCount = visibleFolders.filter((folder) => folder.visibility === "client").length;
  const publishedDocumentCount = visibleDocuments.filter((document) => document.status === "Published").length;

  const buckOptions = useMemo(() => {
    return client.detections.filter((detection) => {
      return detection.finalLabel === "Trophy buck" || detection.finalLabel === "Management buck";
    });
  }, [client.detections]);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const matchedUser = portalUsers.find((user) => {
      return (
        user.role === authMode &&
        user.email.toLowerCase() === email.trim().toLowerCase() &&
        user.password === password
      );
    });

    if (!matchedUser) {
      setError(`No ${authMode} account matched those credentials.`);
      return;
    }

    const nextSession: Session = {
      userId: matchedUser.id,
      role: matchedUser.role,
      clientId: getAccessibleClientIds(matchedUser)[0],
    };

    setSession(nextSession);
    setSelectedClientId(nextSession.clientId);
    setError("");
    setPassword("");
  }

  function handleSignOut() {
    setSession(null);
    setPassword("");
    setEmail("");
    setError("");
    setSelectedLabel("All");
    setAuthMode("client");
    window.localStorage.removeItem(SESSION_KEY);
  }

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
      uploadedAt: uploadDate,
      fileType: file.name.toLowerCase().endsWith(".docx")
        ? "DOCX"
        : file.name.toLowerCase().endsWith(".zip")
          ? "ZIP"
          : "PDF",
      visibility: documentVisibility,
      status: documentVisibility === "client" ? "Published" : "Draft",
      notes:
        documentNote ||
        (documentCategory === "Camera survey report"
          ? "Uploaded by admin for this client."
          : "Uploaded as supporting survey material."),
      fileCount: 1,
      uploadSource: documentSource,
    } satisfies UploadedDocument));

    setUploadedDocuments((current) => [...entries, ...current]);
    setDocumentFiles([]);
    setDocumentNote("");
  }

  function handleFolderUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (folderFiles.length === 0 || folderName.trim() === "") {
      return;
    }

    const linkedDetection = client.detections.find((detection) => detection.id === folderLinkedDetectionId);
    const uploadDate = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const slug = slugify(folderName);

    const nextFolder: UploadedFolder = {
      id: `uploaded-folder-${client.id}-${Date.now()}`,
      clientId: client.id,
      name: folderName.trim(),
      buckName: linkedDetection?.deerName ?? "Unassigned buck",
      classification:
        linkedDetection?.finalLabel === "Management buck" ? "Management buck" : "Trophy buck",
      imageCount: folderFiles.length,
      updatedAt: uploadDate,
      source: folderSource,
      visibility: folderVisibility,
      qrEnabled: folderQrEnabled,
      shareUrl: `https://fieldlens-deer-survey.vercel.app/${client.id}/folders/${slug}`,
      notes: folderNote || "Admin-created image folder for review, publishing, or buck-book linking.",
      linkedDetectionId: linkedDetection?.id,
      fileNames: folderFiles.map((file) => file.name),
    };

    setUploadedFolders((current) => [nextFolder, ...current]);
    setFolderName("");
    setFolderLinkedDetectionId("");
    setFolderFiles([]);
    setFolderNote("");
    setFolderQrEnabled(true);
    setFolderVisibility("client");
    setFolderSource("Manual upload");
  }

  if (!session || !currentUser) {
    return (
      <LoginPortal
        authMode={authMode}
        email={email}
        error={error}
        onAuthModeChange={(mode) => {
          setAuthMode(mode);
          setError("");
          setPassword("");
        }}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={handleLogin}
        password={password}
      />
    );
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <main className="shell" id="main-content">
        <section className="topbar" aria-label="Workspace controls">
          <div className="brand-lockup">
            <p className="eyebrow">FieldLens Deer Survey</p>
            <h1>{viewMode === "admin" ? "Admin survey command center" : "Client property survey portal"}</h1>
          </div>
          <div className="topbar-actions">
            <div className="session-summary">
              <span className="status-pill accent">{viewMode === "admin" ? "Admin login" : "Client login"}</span>
              <div className="session-copy">
                <strong>{currentUser.name}</strong>
                <span>{currentUser.email}</span>
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
                  {availableClients.map((entry) => (
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

            <button className="ghost-chip signout-chip" onClick={handleSignOut} type="button">
              Sign out
            </button>
          </div>
        </section>

        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">{viewMode === "admin" ? "Operations Workspace" : "Client Portal"}</p>
            <h2>{client.propertyName}</h2>
            <p className="lede">
              {viewMode === "admin"
                ? "Upload reports, stage image folders, correct AI buck calls, and publish only the assets this client should see."
                : "View only your property dashboard, published survey files, shared buck folders, and QR-linked buck-book galleries."}
            </p>
            <div className="property-meta">
              <span>{client.county}</span>
              <span>{client.acreage} acres</span>
              <span>{client.season}</span>
            </div>
          </div>

          <div className="hero-panel">
            <span className="panel-title">At a glance</span>
            <div className="metric-grid compact split">
              <article className="metric-card">
                <span>{viewMode === "admin" ? "Review Queue" : "Buck-to-Doe Ratio"}</span>
                <strong>
                  {viewMode === "admin"
                    ? reviewQueueCount
                    : formatRatio(totalBuckCount, summary.does.length)}
                </strong>
                <p>
                  {viewMode === "admin"
                    ? "Cameras, folders, or classifications currently need attention."
                    : `${totalBuckCount} bucks identified against ${summary.does.length} adult does.`}
                </p>
              </article>
              <article className="metric-card">
                <span>{viewMode === "admin" ? "Published Files" : "Shared Folders"}</span>
                <strong>{viewMode === "admin" ? publishedDocumentCount : sharedFolderCount}</strong>
                <p>
                  {viewMode === "admin"
                    ? "Client-visible documents and buck folders are controlled here."
                    : "Only published folders and shared buck galleries are visible in your portal."}
                </p>
              </article>
              <article className="metric-card">
                <span>{viewMode === "admin" ? "Images Ingested" : "Camera Coverage"}</span>
                <strong>
                  {viewMode === "admin" ? summary.totalImages.toLocaleString() : client.cameras.length}
                </strong>
                <p>
                  {viewMode === "admin"
                    ? "Across SD card imports, direct uploads, and Drive-connected cameras."
                    : "Mapped cameras visible on desktop and mobile."}
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="workspace-card">
          <div className="workspace-top">
            <div>
              <p className="eyebrow">Secure access</p>
              <h2>{viewMode === "admin" ? "Admin-only controls and publish gates" : "Published client content only"}</h2>
              <p className="section-copy">
                {viewMode === "admin"
                  ? "Admin users can move across clients, upload documents, and publish folders. Client accounts are locked to their assigned property and never receive cross-client data."
                  : "This portal is restricted to your assigned property. Internal review folders, draft documents, and other clients’ data remain hidden."}
              </p>
            </div>
          </div>

          <div className="client-banner quiet">
            <div>
              <h3>{client.propertyName}</h3>
              <p>
                {client.county} • {client.acreage} acres • {client.season}
              </p>
            </div>
            <div className="status-group">
              <span className="status-pill">{client.cameras.length} active cameras</span>
              <span className="status-pill">{summary.totalImages.toLocaleString()} images ingested</span>
              <span className="status-pill accent">
                {viewMode === "admin"
                  ? `${documents.length} files and folders in this workspace`
                  : `${visibleDocuments.length} published files visible to client`}
              </span>
            </div>
          </div>

          <div className="metric-grid">
            <article className="metric-card">
              <span>Buck-to-doe ratio</span>
              <strong>{formatRatio(totalBuckCount, summary.does.length)}</strong>
              <p>
                {totalBuckCount} identified bucks against {summary.does.length} adult does.
              </p>
            </article>
            <article className="metric-card">
              <span>Trophy bucks</span>
              <strong>{summary.trophy.length}</strong>
              <p>Top-end deer separated for landowner review and buck-book printing.</p>
            </article>
            <article className="metric-card">
              <span>Management bucks</span>
              <strong>{summary.management.length}</strong>
              <p>Management candidates kept distinct from mature targets.</p>
            </article>
            <article className="metric-card">
              <span>AI confidence</span>
              <strong>{Math.round(summary.confidenceAverage * 100)}%</strong>
              <p>Average confidence before your final validation pass.</p>
            </article>
          </div>

          <div className={viewMode === "admin" ? "content-grid admin-grid" : "content-grid client-grid"}>
            {viewMode === "admin" ? (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Admin uploads</p>
                    <h3>Upload reports and survey documents</h3>
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
                      placeholder="Add context for this upload, such as report version or review status."
                    />
                  </label>

                  <div className="upload-summary">
                    <span>{documentFiles.length} file(s) selected</span>
                    <button className="primary-chip submit-chip" type="submit">
                      Add document upload
                    </button>
                  </div>
                </form>

                <div className="asset-list">
                  {documents.map((document) => (
                    <article className="asset-card" key={document.id}>
                      <div className="asset-top">
                        <div>
                          <h4>{document.title}</h4>
                          <p>
                            {document.category} • {document.fileType}
                            {"pageCount" in document && document.pageCount ? ` • ${document.pageCount} pages` : ""}
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
                        {"uploadSource" in document ? (
                          <span>{document.uploadSource as UploadedDocument["uploadSource"]}</span>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Published files</p>
                    <h3>Your survey reports and shared documents</h3>
                  </div>
                </div>

                <div className="asset-list">
                  {visibleDocuments.map((document) => (
                    <article className="asset-card" key={document.id}>
                      <div className="asset-top">
                        <div>
                          <h4>{document.title}</h4>
                          <p>
                            {document.category} • {document.fileType}
                            {document.pageCount ? ` • ${document.pageCount} pages` : ""}
                          </p>
                        </div>
                        <span className="label-chip doe">Published</span>
                      </div>
                      <p>{document.notes}</p>
                      <div className="asset-meta">
                        <span>{document.uploadedAt}</span>
                        <span>Assigned to {client.propertyName}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Property map</p>
                  <h3>Every camera pinned by location</h3>
                </div>
              </div>

              <div className="property-map" aria-label={`${client.propertyName} camera map`}>
                <div className="map-overlay" />
                {client.cameras.map((camera) => (
                  <button
                    className="map-pin"
                    key={camera.id}
                    style={{ left: `${camera.coords.x}%`, top: `${camera.coords.y}%` }}
                    type="button"
                  >
                    <span>{camera.name}</span>
                  </button>
                ))}
                <div className="map-legend">
                  <span>Food plots</span>
                  <span>Creek bottoms</span>
                  <span>Travel corridors</span>
                </div>
              </div>
            </section>

            {viewMode === "admin" ? (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Image folders</p>
                    <h3>Build buck folders and generate QR links</h3>
                  </div>
                </div>

                <form className="upload-form" onSubmit={handleFolderUpload}>
                  <div className="form-grid">
                    <label className="auth-field">
                      <span>Folder name</span>
                      <input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Wide Ten late-summer gallery" />
                    </label>
                    <label className="auth-field">
                      <span>Linked buck</span>
                      <select value={folderLinkedDetectionId} onChange={(event) => setFolderLinkedDetectionId(event.target.value)}>
                        <option value="">Select a buck profile</option>
                        {buckOptions.map((detection) => (
                          <option key={detection.id} value={detection.id}>
                            {detection.deerName} ({detection.finalLabel})
                          </option>
                        ))}
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
                    <span>Survey images</span>
                    <input multiple type="file" accept="image/*" onChange={handleFileSelection(setFolderFiles)} />
                  </label>

                  <label className="checkbox-row">
                    <input checked={folderQrEnabled} type="checkbox" onChange={(event) => setFolderQrEnabled(event.target.checked)} />
                    <span>Generate QR code option for this folder</span>
                  </label>

                  <label className="auth-field">
                    <span>Notes</span>
                    <textarea
                      rows={3}
                      value={folderNote}
                      onChange={(event) => setFolderNote(event.target.value)}
                      placeholder="Add notes about the buck, image batch, or intended client usage."
                    />
                  </label>

                  <div className="upload-summary">
                    <span>{folderFiles.length} image(s) selected</span>
                    <button className="primary-chip submit-chip" type="submit">
                      Create buck folder
                    </button>
                  </div>
                </form>

                <div className="folder-grid">
                  {folders.map((folder) => (
                    <article className="folder-card" key={folder.id}>
                      <div className="asset-top">
                        <div>
                          <h4>{folder.name}</h4>
                          <p>
                            {folder.buckName} • {folder.imageCount} images • {folder.source}
                          </p>
                        </div>
                        <span className={`label-chip ${folder.classification === "Trophy buck" ? "trophy" : "management"}`}>
                          {folder.classification}
                        </span>
                      </div>
                      <p>{folder.notes}</p>
                      <div className="asset-meta">
                        <span>{folder.updatedAt}</span>
                        <span>{folder.visibility === "client" ? "Client shared" : "Admin only"}</span>
                        <span>{folder.qrEnabled ? "QR enabled" : "No QR"}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Shared folders</p>
                    <h3>Buck image folders available to your property</h3>
                  </div>
                </div>

                <div className="highlight-list">
                  {visibleFolders.map((folder) => (
                    <article className="highlight-card" key={folder.id}>
                      <span className={`label-chip ${folder.classification === "Trophy buck" ? "trophy" : "management"}`}>
                        {folder.buckName}
                      </span>
                      <p>
                        {folder.imageCount} images in {folder.name}. This folder belongs only to {client.propertyName}.
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {viewMode === "admin" ? (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">AI review</p>
                    <h3>Correct mistakes before publishing totals</h3>
                  </div>
                </div>

                <div className="review-list">
                  {summary.corrections.map((detection) => {
                    const camera = getCamera(client, detection.cameraId);

                    return (
                      <article className="review-card" key={detection.id}>
                        <div className="review-top">
                          <div>
                            <h4>{detection.deerName ?? "Unassigned deer profile"}</h4>
                            <p>
                              {camera?.name} • {detection.captureTime}
                            </p>
                          </div>
                          <span className="confidence">{Math.round(detection.confidence * 100)}%</span>
                        </div>
                        <div className="label-row">
                          <span className={`label-chip ${classifyTone(detection.aiLabel)}`}>
                            AI: {detection.aiLabel}
                          </span>
                          <span className={`label-chip ${classifyTone(detection.finalLabel)}`}>
                            Final: {detection.finalLabel}
                          </span>
                        </div>
                        <p>{detection.notes}</p>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Report highlights</p>
                    <h3>What matters most on this property</h3>
                  </div>
                </div>

                <div className="highlight-list">
                  <article className="highlight-card">
                    <span className="label-chip trophy">{summary.trophy.length} Trophy Bucks</span>
                    <p>Top-end deer are separated clearly for the season book and mobile viewing.</p>
                  </article>
                  <article className="highlight-card">
                    <span className="label-chip management">{summary.management.length} Management Bucks</span>
                    <p>Management candidates stay distinct from mature targets for clearer planning.</p>
                  </article>
                  <article className="highlight-card">
                    <span className="label-chip doe">{visibleDocuments.length} Published Files</span>
                    <p>Only approved reports, folders, and survey assets are available in this portal.</p>
                  </article>
                </div>
              </section>
            )}

            <section className="panel">
              <div className="panel-header stacked">
                <div>
                  <p className="eyebrow">Detection library</p>
                  <h3>{viewMode === "admin" ? "Filter bucks, does, and fawns" : "Browse recent detections"}</h3>
                </div>
                <div className="filter-row">
                  {(["All", "Trophy buck", "Management buck", "Doe", "Fawn"] as const).map((label) => (
                    <button
                      className={selectedLabel === label ? "filter-chip active" : "filter-chip"}
                      key={label}
                      onClick={() => setSelectedLabel(label)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="detection-list">
                {featuredDetections.map((detection) => {
                  const camera = getCamera(client, detection.cameraId);

                  return (
                    <article className="detection-card" key={detection.id}>
                      <div className="thumb">
                        <span>{detection.deerName?.slice(0, 2).toUpperCase() ?? "DE"}</span>
                      </div>
                      <div className="detection-copy">
                        <div className="detection-title">
                          <h4>{detection.deerName ?? detection.finalLabel}</h4>
                          <span className={`label-chip ${classifyTone(detection.finalLabel)}`}>
                            {detection.finalLabel}
                          </span>
                        </div>
                        <p>
                          {camera?.name} • {detection.mediaCount} photos •{" "}
                          {detection.antlerScore ? `${detection.antlerScore}" gross estimate` : "no score estimate"}
                        </p>
                        <p>{detection.notes}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        </section>

        <section className="workspace-card book-section">
          <div className="workspace-top">
            <div>
              <p className="eyebrow">Printable buck book</p>
              <h2>Printable buck pages with QR-linked galleries</h2>
              <p className="section-copy">
                QR codes point only to folders shared for this property. Admin-only review folders are excluded from the client view.
              </p>
            </div>
            <div className="book-callout">
              <strong>{bookEntries.length}</strong>
              <span>bucks in this year&apos;s booklet</span>
            </div>
          </div>

          <div className="book-grid">
            {bookEntries.map((entry) => {
              const sharedFolder = visibleFolders.find((folder) => folder.buckName === (entry.deerName ?? ""));

              return (
                <article className="book-card" key={entry.id}>
                  <div className="book-image">
                    <span>{entry.deerName?.slice(0, 2).toUpperCase() ?? "BK"}</span>
                  </div>
                  <div className="book-copy">
                    <div className="book-title">
                      <div>
                        <h3>{entry.deerName ?? "Buck profile"}</h3>
                        <p>{entry.antlerScore ? `${entry.antlerScore}" gross` : "Field estimate pending"}</p>
                      </div>
                      <span className={`label-chip ${classifyTone(entry.finalLabel)}`}>{entry.finalLabel}</span>
                    </div>
                    <p>{entry.notes}</p>
                    <div className="book-meta">
                      <span>{entry.mediaCount} linked images</span>
                      <span>{getCamera(client, entry.cameraId)?.name}</span>
                      <span>{sharedFolder ? sharedFolder.name : "No client folder published yet"}</span>
                    </div>
                  </div>
                  {sharedFolder?.qrEnabled ? <QrTile value={sharedFolder.shareUrl} /> : <div className="qr-placeholder" aria-hidden="true" />}
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}
