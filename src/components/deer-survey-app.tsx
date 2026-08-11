"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  clients,
  getCamera,
  portalUsers,
  type ClassificationLabel,
  type Client,
  type PortalUser,
} from "@/lib/demo-data";

type ViewMode = "admin" | "client";
type AuthMode = "admin" | "client";
type Session = {
  userId: string;
  role: ViewMode;
  clientId: string;
};

const SESSION_KEY = "fieldlens-session";

function formatRatio(bucks: number, does: number) {
  if (does === 0) {
    return `${bucks}:0`;
  }

  return `1:${(does / Math.max(bucks, 1)).toFixed(1)}`;
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
          <h1>Separate login portals for your clients and your admin workflow.</h1>
          <p className="lede">
            Clients only see their property report, while the admin portal keeps camera ingest,
            AI review, and cross-property management in one secure workspace.
          </p>
          <div className="auth-feature-list">
            <article className="auth-feature">
              <strong>Admin access</strong>
              <p>Switch across clients, review classifications, and monitor every survey queue.</p>
            </article>
            <article className="auth-feature">
              <strong>Client portal</strong>
              <p>Show each landowner only their property dashboard, buck book, and mapped cameras.</p>
            </article>
            <article className="auth-feature">
              <strong>Mobile ready</strong>
              <p>Login, view detections, and open printable reports cleanly from a phone.</p>
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
                ? "Use your admin account to review all properties and manage survey output."
                : "Use a client account to access just one property and its published survey report."}
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

  const viewMode: ViewMode = session?.role ?? "client";
  const availableClients = useMemo(() => {
    if (!accessibleClientIds.length) {
      return clients;
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

  const bookEntries = [...summary.trophy, ...summary.management].sort((a, b) => {
    return (b.antlerScore ?? 0) - (a.antlerScore ?? 0);
  });
  const totalBuckCount = summary.trophy.length + summary.management.length;
  const reviewQueueCount = summary.inReview.length + summary.corrections.length;
  const featuredDetections = reviewedDetections.slice(0, viewMode === "admin" ? reviewedDetections.length : 6);

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
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
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
                ? "Review ingest status, correct AI buck calls, and publish property totals without exposing cross-client data to landowners."
                : "View your property dashboard, current deer survey totals, mapped camera coverage, and the printable buck book in one secure portal."}
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
                    ? "Cameras or classifications currently need attention."
                    : `${totalBuckCount} bucks identified against ${summary.does.length} adult does.`}
                </p>
              </article>
              <article className="metric-card">
                <span>{viewMode === "admin" ? "Images Ingested" : "Featured Bucks"}</span>
                <strong>
                  {viewMode === "admin" ? summary.totalImages.toLocaleString() : bookEntries.length}
                </strong>
                <p>
                  {viewMode === "admin"
                    ? "Across SD card imports and Drive-connected cameras."
                    : "Ready for print layout and QR-linked galleries."}
                </p>
              </article>
              <article className="metric-card">
                <span>{viewMode === "admin" ? "AI Confidence" : "Camera Coverage"}</span>
                <strong>
                  {viewMode === "admin"
                    ? `${Math.round(summary.confidenceAverage * 100)}%`
                    : client.cameras.length}
                </strong>
                <p>
                  {viewMode === "admin"
                    ? "Average confidence before final human review."
                    : "Mapped cameras visible on desktop and mobile."}
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="workspace-card">
          <div className="workspace-top">
            <div>
              <p className="eyebrow">Property Summary</p>
              <h2>{viewMode === "admin" ? "Operational Summary" : "Published Client Report"}</h2>
              <p className="section-copy">
                {viewMode === "admin"
                  ? "Admin users can switch properties, watch review queues, and manage outputs without affecting client visibility."
                  : "Clients are restricted to their own property and only see survey information intended for publication."}
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
                {viewMode === "admin" ? `${summary.inReview.length} queues need review` : `${bookEntries.length} bucks published`}
              </span>
            </div>
          </div>

          <div className="metric-grid">
            <article className="metric-card">
              <span>Buck-to-doe ratio</span>
              <strong>{formatRatio(totalBuckCount, summary.does.length)}</strong>
              <p>{totalBuckCount} identified bucks against {summary.does.length} adult does.</p>
            </article>
            <article className="metric-card">
              <span>Trophy bucks</span>
              <strong>{summary.trophy.length}</strong>
              <p>Client-ready shortlist for print and mobile view.</p>
            </article>
            <article className="metric-card">
              <span>Management bucks</span>
              <strong>{summary.management.length}</strong>
              <p>Cull candidates and harvest planning set aside clearly.</p>
            </article>
            <article className="metric-card">
              <span>AI confidence</span>
              <strong>{Math.round(summary.confidenceAverage * 100)}%</strong>
              <p>Average model confidence before your final validation pass.</p>
            </article>
          </div>

          <div className={viewMode === "admin" ? "content-grid" : "content-grid client-grid"}>
            {viewMode === "admin" ? (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Camera ingestion</p>
                    <h3>Upload sources and processing queues</h3>
                  </div>
                </div>

                <div className="camera-list">
                  {client.cameras.map((camera) => (
                    <article className="camera-card" key={camera.id}>
                      <div className="camera-heading">
                        <div>
                          <h4>{camera.name}</h4>
                          <p>
                            {camera.zone} zone • {camera.source}
                          </p>
                        </div>
                        <span className={`camera-status ${camera.status.toLowerCase().replace(" ", "-")}`}>
                          {camera.status}
                        </span>
                      </div>
                      <dl>
                        <div>
                          <dt>Images</dt>
                          <dd>{camera.imageCount.toLocaleString()}</dd>
                        </div>
                        <div>
                          <dt>Last sync</dt>
                          <dd>{camera.lastSync}</dd>
                        </div>
                        <div>
                          <dt>Camera ID</dt>
                          <dd>{camera.id.toUpperCase()}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

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
                    <span className="label-chip doe">{summary.does.length} Adult Does</span>
                    <p>Published totals reflect reviewed classifications instead of raw model output.</p>
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
                Each entry stays compact, print-ready, and linked back to the full photo set on the property site.
              </p>
            </div>
            <div className="book-callout">
              <strong>{bookEntries.length}</strong>
              <span>bucks in this year&apos;s booklet</span>
            </div>
          </div>

          <div className="book-grid">
            {bookEntries.map((entry) => (
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
                  </div>
                </div>
                <QrTile value={entry.detailUrl} />
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
