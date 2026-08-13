import "server-only";

import { cache } from "react";
import { clients, type Client } from "@/lib/demo-data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type ViewerRole = "admin" | "client";

export type ViewerContext = {
  id: string;
  email: string;
  fullName: string;
  role: ViewerRole;
  accessibleClientIds: string[];
  defaultClientId: string | null;
};

export type PortalAppState =
  | {
      configured: false;
      viewer: null;
      clients: Client[];
      setupMode: true;
    }
  | {
      configured: true;
      viewer: ViewerContext | null;
      clients: Client[];
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
  client_account_id: string;
  client_accounts: {
    slug: string;
  } | null;
};

export const getPortalAppState = cache(async (): Promise<PortalAppState> => {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      viewer: null,
      clients,
      setupMode: true,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      configured: true,
      viewer: null,
      clients: [],
      setupMode: false,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, default_client_account_id")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (!profile) {
    return {
      configured: true,
      viewer: {
        id: user.id,
        email: user.email ?? "",
        fullName: user.user_metadata.full_name ?? user.email ?? "Signed in user",
        role: "client",
        accessibleClientIds: [],
        defaultClientId: null,
      },
      clients: [],
      setupMode: false,
    };
  }

  const { data: memberships } = await supabase
    .from("client_memberships")
    .select("client_account_id, client_accounts(slug)")
    .eq("user_id", user.id)
    .returns<MembershipRow[]>();

  const accessibleClientIds =
    profile.role === "admin"
      ? clients.map((client) => client.id)
      : Array.from(
          new Set(
            (memberships ?? [])
              .map((membership) => membership.client_accounts?.slug)
              .filter((slug): slug is string => Boolean(slug)),
          ),
        );

  const filteredClients = clients.filter((client) => accessibleClientIds.includes(client.id));

  let defaultClientId: string | null = filteredClients[0]?.id ?? null;

  if (profile.default_client_account_id) {
    const { data: defaultClient } = await supabase
      .from("client_accounts")
      .select("slug")
      .eq("id", profile.default_client_account_id)
      .maybeSingle<{ slug: string }>();

    if (defaultClient?.slug && accessibleClientIds.includes(defaultClient.slug)) {
      defaultClientId = defaultClient.slug;
    }
  }

  return {
    configured: true,
    viewer: {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name ?? user.email ?? "Signed in user",
      role: profile.role,
      accessibleClientIds,
      defaultClientId,
    },
    clients: filteredClients,
    setupMode: false,
  };
});
