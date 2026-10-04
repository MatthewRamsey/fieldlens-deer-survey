"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Copy, Ellipsis, Eye, Plus } from "lucide-react";
import Link from "next/link";

import { useActionState, useState } from "react";
import {
  addClientLogin,
  createClientAccount,
  deleteClientAccount,
  removeClientLogin,
  resendClientAccessEmail,
  setClientActive,
  updateClientAccount,
  type ClientMutationState,
} from "@/app/actions/clients";
import type { ManagedClient, ManagedClientLogin } from "@/lib/portal-data";

const initialState: ClientMutationState = {};

function Feedback({ state }: { state: ClientMutationState }) {
  if (state.error) return <p className="auth-error" role="alert">{state.error}</p>;
  if (state.success) return <p className="status-pill accent" role="status">{state.success}</p>;
  return null;
}

function CopyPortalUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Button variant="outline" size="sm" onClick={copy} type="button">
      <Copy aria-hidden="true" />{copied ? "Copied" : "Copy link"}
    </Button>
  );
}

function ClientLoginRow({ client, login }: { client: ManagedClient; login: ManagedClientLogin }) {
  const [emailState, emailAction, emailPending] = useActionState(resendClientAccessEmail, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeClientLogin, initialState);

  return (
    <div className="client-login-row">
      <div>
        <strong>{login.fullName}</strong>
        <span>{login.email}</span>
      </div>
      <div className="client-login-actions">
        <form action={emailAction}>
          <Input name="client_id" type="hidden" value={client.accountId} />
          <Input name="email" type="hidden" value={login.email} />
          <Button className="ghost-chip" disabled={emailPending} type="submit">
            {emailPending ? "Sending..." : "Send setup email"}
          </Button>
        </form>
        <form action={removeAction}>
          <Input name="client_id" type="hidden" value={client.accountId} />
          <Input name="user_id" type="hidden" value={login.userId} />
          <Button className="ghost-chip danger-chip" disabled={removePending} type="submit">
            {removePending ? "Removing..." : "Remove access"}
          </Button>
        </form>
      </div>
      <Feedback state={emailState.error || emailState.success ? emailState : removeState} />
    </div>
  );
}

function ManagedClientCard({ client, portalOrigin }: { client: ManagedClient; portalOrigin: string }) {
  const [updateState, updateAction, updatePending] = useActionState(updateClientAccount, initialState);
  const [activeState, activeAction, activePending] = useActionState(setClientActive, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteClientAccount, initialState);
  const [loginState, loginAction, loginPending] = useActionState(addClientLogin, initialState);
  const [panel, setPanel] = useState<"access" | "edit" | "archive" | "delete" | null>(null);
  const portalUrl = `${portalOrigin}/?client=${encodeURIComponent(client.slug)}`;
  const panelId = `client-panel-${client.accountId}`;
  const togglePanel = (next: NonNullable<typeof panel>) => setPanel(current => current === next ? null : next);

  return (
    <Card role="article" aria-label={client.propertyName} className={`managed-client-card${client.isActive ? "" : " archived"}`}>
      <div className="client-card-heading">
        <div className="client-card-identity">
          <p className="eyebrow">Property</p>
          <h3>{client.propertyName}</h3>
          <p>{client.name}</p>
        </div>
        <Badge variant={client.isActive ? "secondary" : "outline"}>{client.isActive ? "Active" : "Archived"}</Badge>
      </div>

      <dl className="client-card-facts">
        <div><dt>Location</dt><dd>{client.county}</dd></div>
        <div><dt>Property size</dt><dd>{client.acreage.toLocaleString()} acres</dd></div>
        <div><dt>Portal access</dt><dd>{client.clientLogins.length ? `${client.clientLogins.length} client login${client.clientLogins.length === 1 ? "" : "s"}` : "No logins yet"}</dd></div>
      </dl>

      <div className="client-card-portal">
        <div>
          <span>Client portal</span>
          {client.isActive ? <Link href={`/admin/preview/${encodeURIComponent(client.slug)}`}>Preview client view <Eye aria-hidden="true" /></Link>
            : <p className="client-preview-unavailable">Preview unavailable while archived</p>}
        </div>
        <CopyPortalUrl url={portalUrl} />
      </div>

      <div className="client-card-actions">
        <Button type="button" aria-expanded={panel === "access"} aria-controls={panelId} onClick={() => togglePanel("access")}>
          {client.clientLogins.length ? "Manage access" : "Add client login"}
        </Button>
        <Button variant="outline" type="button" aria-expanded={panel === "edit"} aria-controls={panelId} onClick={() => togglePanel("edit")}>Edit property</Button>
        <DropdownMenu>
          <DropdownMenuTrigger className="client-card-more" aria-label={`More actions for ${client.propertyName}`}>
            <Ellipsis aria-hidden="true" /> More
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setPanel("archive")}>{client.isActive ? "Archive client" : "Reactivate client"}</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setPanel("delete")}>Delete client</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {panel ? <section className="client-card-panel" id={panelId} aria-label={`${client.propertyName} ${panel} settings`}>
        <div className="client-card-panel-heading">
          <div>
            <p className="eyebrow">{client.propertyName}</p>
            <h4>{panel === "access" ? "Manage portal access" : panel === "edit" ? "Edit property details" : panel === "archive" ? (client.isActive ? "Archive this client" : "Reactivate this client") : "Delete this client"}</h4>
          </div>
          <Button variant="ghost" size="sm" type="button" onClick={() => setPanel(null)}>Close</Button>
        </div>

        {panel === "access" ? <div className="client-access-panel">
          <p className="client-panel-description">People listed here can sign in to view this property.</p>
          {client.clientLogins.length ? <div className="client-login-list">
            {client.clientLogins.map(login => <ClientLoginRow client={client} key={login.userId} login={login} />)}
          </div> : <p className="empty-copy">No login has been assigned. Add one below to send a secure setup email.</p>}
          <form action={loginAction} className="form-grid management-form client-panel-form">
            <Input name="client_id" type="hidden" value={client.accountId} />
            <label><span>Client name</span><Input autoComplete="name" name="full_name" placeholder="Bradley Clark" type="text" /></label>
            <label><span>Client email</span><Input autoComplete="email" name="email" placeholder="owner@example.com" required type="email" /></label>
            <div className="management-form-footer">
              <p>A secure password setup email will be sent from Supabase.</p>
              <Button disabled={loginPending} type="submit">
                {loginPending ? "Adding login..." : "Add login and send email"}
              </Button>
            </div>
            <Feedback state={loginState} />
          </form>
        </div> : null}

        {panel === "edit" ? <form action={updateAction} className="form-grid management-form client-panel-form">
            <Input name="client_id" type="hidden" value={client.accountId} />
            <label><span>Client name</span><Input defaultValue={client.name} name="name" required /></label>
            <label><span>Property name</span><Input defaultValue={client.propertyName} name="property_name" required /></label>
            <label><span>County and state</span><Input defaultValue={client.county} name="county" required /></label>
            <label><span>Acreage</span><Input defaultValue={client.acreage} min="1" name="acreage" required type="number" /></label>
            <div className="management-form-footer">
              <span />
              <Button disabled={updatePending} type="submit">
                {updatePending ? "Saving..." : "Save client details"}
              </Button>
            </div>
            <Feedback state={updateState} />
          </form> : null}

        {panel === "archive" ? <form action={activeAction} className="client-confirm-form">
          <Input name="client_id" type="hidden" value={client.accountId} />
          <Input name="is_active" type="hidden" value={client.isActive ? "false" : "true"} />
          <p>{client.isActive ? "This property will leave the active client list. Its records and logins stay available if you reactivate it." : "This property will return to the active client list."}</p>
          <Button variant="outline" disabled={activePending} type="submit">
            {activePending ? "Updating..." : client.isActive ? "Archive client" : "Reactivate client"}
          </Button>
          <Feedback state={activeState} />
        </form> : null}

        {panel === "delete" ? <form action={deleteAction} className="client-confirm-form">
            <Input name="client_id" type="hidden" value={client.accountId} />
            <p>Deletion is available only when the client has no assigned logins or saved property records.</p>
            <label>
              <span>Enter {client.propertyName} to confirm</span>
              <Input name="confirmation" required />
            </label>
            <Button variant="destructive" disabled={deletePending} type="submit">
              {deletePending ? "Deleting..." : "Delete permanently"}
            </Button>
            <Feedback state={deleteState} />
          </form> : null}
      </section> : null}
    </Card>
  );
}

export function ClientManagement({ clients, portalOrigin }: { clients: ManagedClient[]; portalOrigin: string }) {
  const [createState, createAction, createPending] = useActionState(createClientAccount, initialState);
  const [createOpen, setCreateOpen] = useState(clients.length === 0);

  return (
    <section className="workspace-card client-management" aria-label="Client management">
      <div className="workspace-top client-management-toolbar">
        <div className="client-management-header-actions">
          <Badge variant="secondary">{clients.filter((client) => client.isActive).length} active clients</Badge>
          <Button type="button" aria-expanded={createOpen} aria-controls="create-client-panel" onClick={() => setCreateOpen(open => !open)}><Plus aria-hidden="true" /> Add client</Button>
        </div>
      </div>

      {createOpen ? <section className="client-card-panel create-client-panel" id="create-client-panel" aria-label="Add a client">
        <div className="client-card-panel-heading"><div><p className="eyebrow">New property</p><h3>Add a client</h3></div><Button variant="ghost" size="sm" type="button" onClick={() => setCreateOpen(false)}>Close</Button></div>
        <form action={createAction} className="form-grid management-form client-panel-form">
          <label><span>Client or organization name</span><Input name="name" placeholder="Bradley Clark Farms" required /></label>
          <label><span>Property name</span><Input name="property_name" placeholder="Bradley Clark Farms" required /></label>
          <label><span>Buck name prefix (optional)</span><Input name="buck_prefix" placeholder="Example: BCF" autoCapitalize="characters" aria-describedby="buck-prefix-help buck-prefix-error" aria-invalid={createState.error?.startsWith("Buck prefix") || undefined} />
            <small id="buck-prefix-help">Use up to 12 letters or numbers. Leave blank for property initials. Bucks are numbered across all years; this prefix cannot change after creation.</small>
            {createState.error?.startsWith("Buck prefix") && <small id="buck-prefix-error" className="auth-error" role="alert">{createState.error}</small>}
          </label>
          <label><span>County and state</span><Input name="county" placeholder="County, State" required /></label>
          <label><span>Acreage</span><Input min="1" name="acreage" placeholder="1200" required type="number" /></label>
          <div className="management-form-footer">
            <p>The new client will be owned by your admin account.</p>
            <Button disabled={createPending} type="submit">
              {createPending ? "Adding client..." : "Add client"}
            </Button>
          </div>
          {!createState.error?.startsWith("Buck prefix") && <Feedback state={createState} />}
        </form>
      </section> : null}

      <div className="managed-client-list">
        {clients.map((client) => <ManagedClientCard client={client} key={client.accountId} portalOrigin={portalOrigin} />)}
      </div>
    </section>
  );
}
