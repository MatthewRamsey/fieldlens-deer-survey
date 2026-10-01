"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useOptimistic, useTransition } from "react";
import { ChartNoAxesCombined, FileText, Settings, Users, BookOpen, ShieldCheck } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { adminHref, adminSections, type AdminSection } from "@/lib/admin-navigation";
import { clientHref, clientSections, type ClientSection } from "@/lib/client-navigation";
import type { ViewerContext } from "@/lib/portal-data";
import type { Client } from "@/lib/portal-types";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";

const sectionIcons = {
  overview: ChartNoAxesCombined,
  clients: Users,
  users: ShieldCheck,
  reports: FileText,
  "digital-buck-book": BookOpen,
  account: Settings,
};

const portalLogo = "/upland-logo-transparent.png";

function AdminNavigation({ viewer, clients, section, clientId, year, pending }: {
  viewer: ViewerContext;
  clients: Client[];
  section: AdminSection | "account";
  clientId?: string;
  year?: string;
  pending: boolean;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const router = useRouter();
  const [workspaceId, selectWorkspace] = useOptimistic(clientId ?? "admin");
  const [switching, startWorkspaceSwitch] = useTransition();
  const selectedClient = clients.find(client => client.id === workspaceId);
  const items = selectedClient
    ? adminSections.filter(item => item.id === "overview" || (item.id !== "clients" && item.id !== "users"))
    : [...adminSections.filter(item => item.id === "overview" || item.id === "clients" || (viewer.isSuperAdmin && item.id === "users")),
      { id: "account" as const, label: "Account", href: "/account" }];

  return <Sidebar collapsible="offcanvas" className="portal-sidebar">
    <SidebarHeader className="gap-4 border-b border-sidebar-border px-5 py-6">
      <Link href={adminHref("/", selectedClient?.id, year)} className="portal-brand-link flex flex-col gap-3" onClick={() => isMobile && setOpenMobile(false)}>
        <Image src={portalLogo} alt="Upland Wildlife Management" width={164} height={164} loading="eager" />
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Management portal</span>
      </Link>
      <Button className="md:hidden" variant="ghost" size="sm" type="button" onClick={() => setOpenMobile(false)}>Close navigation</Button>
    </SidebarHeader>
    <SidebarContent className="px-3 py-4">
      <div className="px-3 pb-4">
        <label className="grid gap-2 text-xs font-medium text-muted-foreground">
          <span>Workspace</span>
          <NativeSelect aria-label="Workspace" disabled={pending} value={workspaceId}
            onChange={event => {
              const nextWorkspace = event.target.value;
              startWorkspaceSwitch(() => {
                selectWorkspace(nextWorkspace);
                router.push(nextWorkspace === "admin" ? "/" : adminHref("/", nextWorkspace));
              });
              if (isMobile) setOpenMobile(false);
            }}>
            <option value="admin">Admin</option>
            {clients.map(client => <option key={client.id} value={client.id}>{client.propertyName}</option>)}
          </NativeSelect>
          {switching && <span className="workspace-switch-status" role="status">Switching workspace…</span>}
        </label>
      </div>
      <nav aria-label="Admin navigation">
      <SidebarGroup>
        <SidebarGroupLabel>{selectedClient ? "Property tools" : "Admin tools"}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map(item => {
              const Icon = sectionIcons[item.id];
              return <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  render={<Link href={adminHref(item.href, selectedClient?.id, year)} />}
                  isActive={section === item.id}
                  aria-current={section === item.id ? "page" : undefined}
                  aria-disabled={pending || undefined}
                  tabIndex={pending ? -1 : undefined}
                  onClick={event => {
                    if (pending) event.preventDefault();
                    else if (isMobile) setOpenMobile(false);
                  }}
                >
                  <Icon aria-hidden="true" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>;
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      </nav>
    </SidebarContent>
    <SidebarFooter className="gap-3 border-t border-sidebar-border px-5 py-5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Administrator</p>
        <p className="truncate text-sm font-semibold">{viewer.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">{viewer.email}</p>
      </div>
      <Separator />
      <form action={signOut}><Button className="portal-sign-out" variant="outline" size="sm" disabled={pending} type="submit">Sign out</Button></form>
    </SidebarFooter>
  </Sidebar>;
}

export function AdminShell({ viewer, clients, section, clientId, year, pending = false, children }: {
  viewer: ViewerContext;
  clients: Client[];
  section: AdminSection | "account";
  clientId?: string;
  year?: string;
  pending?: boolean;
  children: ReactNode;
}) {
  const label = section === "account" ? "Account" : adminSections.find(item => item.id === section)?.label ?? "Workspace";
  return <TooltipProvider>
    <SidebarProvider className="portal-layout">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <AdminNavigation viewer={viewer} clients={clients} section={section} clientId={clientId} year={year} pending={pending} />
      <SidebarInset className="portal-inset">
        <header className="portal-mobile-header">
          <SidebarTrigger aria-label="Open navigation" />
          <span>{label}</span>
        </header>
        <div key={`${section}:${clientId ?? ""}:${year ?? ""}`} className="portal-scroll" id="main-content" tabIndex={-1}>
          {pending ? <p className="status-pill" role="status">Saving survey changes. Navigation will be available when saved.</p> : null}
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  </TooltipProvider>;
}

function ClientNavigation({ viewer, section, clientId, year, preview }: {
  viewer: ViewerContext;
  section: ClientSection | "account";
  clientId: string;
  year: string;
  preview: boolean;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const items = preview ? clientSections : [...clientSections, { id: "account" as const, label: "Account" }];

  return <Sidebar collapsible="offcanvas" className="portal-sidebar">
    <SidebarHeader className="gap-4 border-b border-sidebar-border px-5 py-6">
      <Link href={clientHref("overview", clientId, year, preview ? clientId : undefined)} className="portal-brand-link flex flex-col gap-3" onClick={() => isMobile && setOpenMobile(false)}>
        <Image src={portalLogo} alt="Upland Wildlife Management" width={164} height={164} loading="eager" />
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Client portal</span>
      </Link>
      <Button className="md:hidden" variant="ghost" size="sm" type="button" onClick={() => setOpenMobile(false)}>Close navigation</Button>
    </SidebarHeader>
    <SidebarContent className="px-3 py-4">
      <nav aria-label="Client navigation">
        <SidebarGroup>
          <SidebarGroupLabel>Property archive</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => {
                const Icon = sectionIcons[item.id];
                return <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    render={<Link href={clientHref(item.id, clientId, year, preview ? clientId : undefined)} />}
                    isActive={section === item.id}
                    aria-current={section === item.id ? "page" : undefined}
                    onClick={() => isMobile && setOpenMobile(false)}
                  >
                    <Icon aria-hidden="true" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>;
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </nav>
    </SidebarContent>
    <SidebarFooter className="gap-3 border-t border-sidebar-border px-5 py-5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{preview ? "Administrator preview" : "Client"}</p>
        <p className="truncate text-sm font-semibold">{viewer.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">{viewer.email}</p>
      </div>
      <Separator />
      {preview ? <Button render={<Link href="/admin/clients" />} nativeButton={false} variant="outline" size="sm">Exit preview</Button> :
        <form action={signOut}><Button className="portal-sign-out" variant="outline" size="sm" type="submit">Sign out</Button></form>}
    </SidebarFooter>
  </Sidebar>;
}

export function ClientShell({ viewer, section, clientId, year, preview = false, children }: {
  viewer: ViewerContext;
  section: ClientSection | "account";
  clientId: string;
  year: string;
  preview?: boolean;
  children: ReactNode;
}) {
  const label = section === "account" ? "Account" : clientSections.find(item => item.id === section)?.label ?? "Overview";
  return <TooltipProvider>
    <SidebarProvider className="portal-layout">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <ClientNavigation viewer={viewer} section={section} clientId={clientId} year={year} preview={preview} />
      <SidebarInset className="portal-inset">
        <header className="portal-mobile-header">
          <SidebarTrigger aria-label="Open navigation" />
          <span>{label}</span>
        </header>
        <div key={`${section}:${clientId}:${year}`} className="portal-scroll" id="main-content" tabIndex={-1}>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  </TooltipProvider>;
}
