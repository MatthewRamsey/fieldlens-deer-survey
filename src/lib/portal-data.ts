import "server-only";

import { cache } from "react";
import type { Client, ClientDocument, SurveyYear } from "@/lib/portal-types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type ViewerRole = "admin" | "client";

export type ViewerContext = {
  id: string;
  email: string;
  fullName: string;
  role: ViewerRole;
  isSuperAdmin: boolean;
  accessibleClientIds: string[];
  defaultClientId: string | null;
};

export type ManagedClientLogin = {
  userId: string;
  email: string;
  fullName: string;
};

export type ManagedClient = {
  accountId: string;
  slug: string;
  name: string;
  propertyName: string;
  county: string;
  acreage: number;
  isActive: boolean;
  clientLogins: ManagedClientLogin[];
};

export type PortalAppState =
  | {
      configured: false;
      viewer: null;
      clients: Client[];
      managedClients: ManagedClient[];
      setupMode: true;
    }
  | {
      configured: true;
      viewer: ViewerContext | null;
      clients: Client[];
      managedClients: ManagedClient[];
      setupMode: false;
    };

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: ViewerRole;
  default_client_account_id: string | null;
};

type MembershipRow = {
  user_id: string;
  client_account_id: string;
  membership_role: "owner" | "manager" | "viewer";
};

type ClientAccountRow = {
  id: string;
  slug: string;
  name: string;
  property_name: string;
  county: string;
  acreage: number;
  is_active: boolean;
};

type ClientDocumentRow = {
  id: string;
  client_account_id: string;
  title: string;
  category: ClientDocument["category"];
  survey_year: string;
  created_at: string;
  file_type: string;
  page_count: number | null;
  deleted_at: string | null;
  visibility: "admin" | "client";
  status: "draft" | "published";
  notes: string;
};

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function titleCaseStatus(status: "draft" | "published"): ClientDocument["status"] {
  return status === "draft" ? "Draft" : "Published";
}

function buildDocumentFileType(fileType: string) {
  return fileType.toUpperCase();
}

function buildSurveyYearsFromValues(values: string[]): SurveyYear[] {
  const years = new Set<string>([String(new Date().getFullYear())]);

  values.forEach((value) => years.add(value));

  if (years.size === 0) {
    years.add(String(new Date().getFullYear()));
  }

  return Array.from(years).sort((left, right) => right.localeCompare(left));
}

const getViewerState = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      viewer: null,
      accessibleClientAccountIds: [] as string[],
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, default_client_account_id")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (!profile) {
    return {
      supabase,
      viewer: {
        id: user.id,
        email: user.email ?? "",
        fullName: user.user_metadata.full_name ?? user.email ?? "Signed in user",
        role: "client" as const,
        isSuperAdmin: false,
        accessibleClientIds: [],
        defaultClientId: null,
      },
      accessibleClientAccountIds: [] as string[],
    };
  }

  const memberships =
    (
      await supabase
        .from("client_memberships")
        .select("user_id, client_account_id, membership_role")
        .eq("user_id", user.id)
        .returns<MembershipRow[]>()
    ).data ?? [];
  const accessibleClientAccountIds = memberships.map((membership) => membership.client_account_id);

  const accessibleClientIds =
    accessibleClientAccountIds.length === 0
      ? []
      : (
          await supabase
            .from("client_accounts")
            .select("id, slug")
            .in("id", accessibleClientAccountIds)
            .returns<Array<{ id: string; slug: string }>>()
        ).data?.map((account) => account.slug) ?? [];

  let defaultClientId: string | null = null;

  if (profile.default_client_account_id && accessibleClientAccountIds.includes(profile.default_client_account_id)) {
    const { data: defaultClient } = await supabase
      .from("client_accounts")
      .select("slug")
      .eq("id", profile.default_client_account_id)
      .maybeSingle<{ slug: string }>();

    defaultClientId = defaultClient?.slug ?? null;
  }

  if (!defaultClientId) {
    defaultClientId = accessibleClientIds[0] ?? null;
  }

  return {
    supabase,
    viewer: {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name ?? user.email ?? "Signed in user",
      role: profile.role,
      isSuperAdmin: profile.role === "admin" && user.app_metadata?.super_admin === true,
      accessibleClientIds,
      defaultClientId,
    },
    accessibleClientAccountIds,
  };
});

export async function getClientPreviewBackHref(clientSlug: string, requestedPreview?: string) {
  if (requestedPreview !== clientSlug) return "/";
  const { viewer } = await getViewerState();
  return viewer?.role === "admin" ? `/admin/preview/${encodeURIComponent(clientSlug)}` : "/";
}

export const getPortalAppState = cache(async (): Promise<PortalAppState> => {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      viewer: null,
      clients: [],
      managedClients: [],
      setupMode: true,
    };
  }

  const { supabase, viewer, accessibleClientAccountIds } = await getViewerState();

  if (!viewer) {
    return {
      configured: true,
      viewer: null,
      clients: [],
      managedClients: [],
      setupMode: false,
    };
  }

  if (accessibleClientAccountIds.length === 0) {
    return {
      configured: true,
      viewer,
      clients: [],
      managedClients: [],
      setupMode: false,
    };
  }

  const { data: accounts } = await supabase
    .from("client_accounts")
    .select("id, slug, name, property_name, county, acreage, is_active")
    .in("id", accessibleClientAccountIds)
    .eq("is_active", true)
    .order("property_name")
    .returns<ClientAccountRow[]>();

  const { data: documents } = await supabase
    .from("client_documents")
    .select("id, client_account_id, title, category, survey_year, created_at, file_type, page_count, visibility, status, notes, deleted_at")
    .in("client_account_id", accessibleClientAccountIds)
    .order("created_at", { ascending: false })
    .returns<ClientDocumentRow[]>();

  const accountRows = accounts ?? [];
  const digitalBookRows: { clientAccountId: string; year: string; token: string }[] = viewer.role === "admin"
    ? ((await supabase.from("digital_buck_books").select("client_account_id,survey_year,public_token")
        .in("client_account_id", accessibleClientAccountIds).eq("status", "published")).data ?? []).map(row => ({
          clientAccountId: row.client_account_id, year: row.survey_year, token: row.public_token,
        }))
    : (await Promise.all(accountRows.map(async account => {
        const { data } = await supabase.rpc("get_client_digital_books", { p_client_id: account.id });
        return ((data ?? []) as { year: string; token: string }[]).map(book => ({
          clientAccountId: account.id, year: book.year, token: book.token,
        }));
      }))).flat();
  const documentRows = documents ?? [];
  const clients = accountRows.map((account) => {
    const clientDocuments = documentRows
      .filter((document) => document.client_account_id === account.id)
      .map(
        (document): ClientDocument => ({
          id: document.id,
          title: document.title,
          category: document.category,
          surveyYear: document.survey_year,
          uploadedAt: formatDisplayDate(document.created_at),
          fileType: buildDocumentFileType(document.file_type),
          pageCount: document.page_count ?? undefined,
          visibility: document.visibility,
          status: titleCaseStatus(document.status),
          notes: document.notes,
          deletedAt: document.deleted_at,
        }),
      );

    return {
      id: account.slug,
      name: account.name,
      propertyName: account.property_name,
      county: account.county,
      acreage: account.acreage,
      surveyYears: buildSurveyYearsFromValues([
        ...clientDocuments.map((document) => document.surveyYear),
        ...digitalBookRows.filter(book => book.clientAccountId === account.id).map(book => book.year),
      ]),
      documents: clientDocuments,
      digitalBooks: digitalBookRows.filter(book => book.clientAccountId === account.id).map(book => ({ year: book.year, token: book.token })),
    } satisfies Client;
  });

  let managedClients: ManagedClient[] = [];

  if (viewer.role === "admin") {
    const [{ data: managedAccounts }, { data: managedMemberships }] = await Promise.all([
      supabase
        .from("client_accounts")
        .select("id, slug, name, property_name, county, acreage, is_active")
        .in("id", accessibleClientAccountIds)
        .order("property_name")
        .returns<ClientAccountRow[]>(),
      supabase
        .from("client_memberships")
        .select("user_id, client_account_id, membership_role")
        .in("client_account_id", accessibleClientAccountIds)
        .returns<MembershipRow[]>(),
    ]);

    const clientMemberships = (managedMemberships ?? []).filter(
      (membership) => membership.user_id !== viewer.id,
    );
    const clientUserIds = Array.from(new Set(clientMemberships.map((membership) => membership.user_id)));
    const memberProfiles = clientUserIds.length
      ? (
          await supabase
            .from("profiles")
            .select("id, email, full_name, role")
            .in("id", clientUserIds)
            .eq("role", "client")
            .returns<Array<Pick<ProfileRow, "id" | "email" | "full_name" | "role">>>()
        ).data ?? []
      : [];
    const profilesById = new Map(memberProfiles.map((profile) => [profile.id, profile]));

    managedClients = (managedAccounts ?? []).map((account) => ({
      accountId: account.id,
      slug: account.slug,
      name: account.name,
      propertyName: account.property_name,
      county: account.county,
      acreage: account.acreage,
      isActive: account.is_active,
      clientLogins: clientMemberships
        .filter((membership) => membership.client_account_id === account.id)
        .flatMap((membership) => {
          const member = profilesById.get(membership.user_id);
          return member
            ? [{ userId: member.id, email: member.email, fullName: member.full_name ?? member.email }]
            : [];
        }),
    }));
  }

  return {
    configured: true,
    viewer,
    clients,
    managedClients,
    setupMode: false,
  };
});

export async function getAccessibleClientAccountBySlug(clientSlug: string) {
  const { supabase, accessibleClientAccountIds } = await getViewerState();

  if (accessibleClientAccountIds.length === 0) {
    return null;
  }

  const { data: account } = await supabase
    .from("client_accounts")
    .select("id, slug, name, property_name, county, acreage, is_active")
    .in("id", accessibleClientAccountIds)
    .eq("slug", clientSlug)
    .eq("is_active", true)
    .maybeSingle<ClientAccountRow>();

  return account;
}

export async function getAccessibleDocument(clientSlug: string, surveyYear: string, documentId: string) {
  const account = await getAccessibleClientAccountBySlug(clientSlug);

  if (!account) {
    return null;
  }

  const { supabase } = await getViewerState();
  const { data: document } = await supabase
    .from("client_documents")
    .select("id, client_account_id, title, category, survey_year, file_path")
    .eq("id", documentId)
    .eq("client_account_id", account.id)
    .eq("survey_year", surveyYear)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      client_account_id: string;
      title: string;
      category: string;
      survey_year: string;
      file_path: string;
    }>();

  return document;
}
