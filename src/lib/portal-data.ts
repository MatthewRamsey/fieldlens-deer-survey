import "server-only";

import { cache } from "react";
import type { BuckFolder, CameraBatch, CameraBatchImage, Client, ClientDocument, SurveyYear } from "@/lib/portal-types";
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
};

type ClientAccountRow = {
  id: string;
  slug: string;
  name: string;
  property_name: string;
  county: string;
  acreage: number;
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
  visibility: "admin" | "client";
  status: "draft" | "published";
  notes: string;
};

type BuckGalleryRow = {
  id: string;
  client_account_id: string;
  slug: string;
  name: string;
  buck_name: string;
  classification: BuckFolder["classification"];
  survey_year: string;
  image_count: number;
  updated_at: string;
  source: BuckFolder["source"];
  visibility: "admin" | "client";
  qr_enabled: boolean;
  notes: string;
};

type CameraBatchRow = {
  id: string;
  client_account_id: string;
  survey_year: string;
  camera_name: string;
  source: CameraBatch["source"];
  notes: string;
  image_count: number;
  client_visible_count: number;
  updated_at: string;
};

type CameraBatchImageRow = {
  id: string;
  batch_id: string;
  client_account_id: string;
  file_path: string;
  file_name: string;
  captured_at: string | null;
  display_order: number;
  age_label: CameraBatchImage["ageLabel"];
  antler_points: number | null;
  life_status: CameraBatchImage["lifeStatus"];
  deer_classification: CameraBatchImage["deerClassification"];
  client_visible: boolean;
  review_notes: string;
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

function buildGalleryShareUrl(clientSlug: string, surveyYear: string, gallerySlug: string) {
  return `/${clientSlug}/${surveyYear}/folders/${gallerySlug}`;
}

export function buildBuckBookShareUrl(clientSlug: string, surveyYear: string) {
  return `/${clientSlug}/${surveyYear}/buck-book`;
}

async function buildCameraBatchImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: CameraBatchImageRow[],
) {
  return Promise.all(
    rows.map(async (image) => {
      const { data } = await supabase.storage
        .from("camera-batch-images")
        .createSignedUrl(image.file_path, 60 * 10);

      return {
        id: image.id,
        fileName: image.file_name,
        url: data?.signedUrl ?? "",
        batchId: image.batch_id,
        displayOrder: image.display_order,
        capturedAt: image.captured_at,
        ageLabel: image.age_label,
        antlerPoints: image.antler_points,
        lifeStatus: image.life_status,
        deerClassification: image.deer_classification,
        clientVisible: image.client_visible,
        reviewNotes: image.review_notes,
      } satisfies CameraBatchImage;
    }),
  );
}

function buildSurveyYearsFromValues(values: string[]): SurveyYear[] {
  const years = new Set<string>();

  values.forEach((value) => years.add(value));

  if (years.size === 0) {
    years.add(String(new Date().getFullYear()));
  }

  return Array.from(years).sort((left, right) => right.localeCompare(left));
}

async function getViewerState() {
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
        accessibleClientIds: [],
        defaultClientId: null,
      },
      accessibleClientAccountIds: [] as string[],
    };
  }

  const accessibleClientAccountIds =
    profile.role === "admin"
      ? (
          await supabase
            .from("client_accounts")
            .select("id")
            .eq("is_active", true)
            .returns<Array<{ id: string }>>()
        ).data?.map((account) => account.id) ?? []
      : (
          await supabase
            .from("client_memberships")
            .select("client_account_id")
            .eq("user_id", user.id)
            .returns<MembershipRow[]>()
        ).data?.map((membership) => membership.client_account_id) ?? [];

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
      accessibleClientIds,
      defaultClientId,
    },
    accessibleClientAccountIds,
  };
}

export const getPortalAppState = cache(async (): Promise<PortalAppState> => {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      viewer: null,
      clients: [],
      setupMode: true,
    };
  }

  const { supabase, viewer, accessibleClientAccountIds } = await getViewerState();

  if (!viewer) {
    return {
      configured: true,
      viewer: null,
      clients: [],
      setupMode: false,
    };
  }

  if (accessibleClientAccountIds.length === 0) {
    return {
      configured: true,
      viewer,
      clients: [],
      setupMode: false,
    };
  }

  const { data: accounts } = await supabase
    .from("client_accounts")
    .select("id, slug, name, property_name, county, acreage")
    .in("id", accessibleClientAccountIds)
    .eq("is_active", true)
    .order("property_name")
    .returns<ClientAccountRow[]>();

  const { data: documents } = await supabase
    .from("client_documents")
    .select("id, client_account_id, title, category, survey_year, created_at, file_type, page_count, visibility, status, notes")
    .in("client_account_id", accessibleClientAccountIds)
    .order("created_at", { ascending: false })
    .returns<ClientDocumentRow[]>();

  const { data: galleries } = await supabase
    .from("buck_galleries")
    .select("id, client_account_id, slug, name, buck_name, classification, survey_year, image_count, updated_at, source, visibility, qr_enabled, notes")
    .in("client_account_id", accessibleClientAccountIds)
    .order("updated_at", { ascending: false })
    .returns<BuckGalleryRow[]>();

  const cameraBatchRows =
    (
      await supabase
        .from("camera_batches")
        .select("id, client_account_id, survey_year, camera_name, source, notes, image_count, client_visible_count, updated_at")
        .in("client_account_id", accessibleClientAccountIds)
        .order("updated_at", { ascending: false })
        .returns<CameraBatchRow[]>()
    ).data ?? [];

  const cameraBatchImageRows =
    cameraBatchRows.length
      ? (
          await supabase
            .from("camera_batch_images")
            .select("id, batch_id, client_account_id, file_path, file_name, captured_at, display_order, age_label, antler_points, life_status, deer_classification, client_visible, review_notes")
            .in("batch_id", cameraBatchRows.map((batch) => batch.id))
            .order("display_order", { ascending: true })
            .returns<CameraBatchImageRow[]>()
        ).data ?? []
      : [];

  const accountRows = accounts ?? [];
  const documentRows = documents ?? [];
  const galleryRows = galleries ?? [];
  const builtCameraBatchImages =
    cameraBatchImageRows.length > 0 ? await buildCameraBatchImages(supabase, cameraBatchImageRows) : [];
  const imagesByBatchId = builtCameraBatchImages.reduce<Record<string, CameraBatchImage[]>>((groups, image) => {
    if (!image.url) {
      return groups;
    }

    if (!groups[image.batchId]) {
      groups[image.batchId] = [];
    }

    groups[image.batchId].push(image);
    return groups;
  }, {});

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
        }),
      );

    const clientGalleries = galleryRows
      .filter((gallery) => gallery.client_account_id === account.id)
      .map(
        (gallery): BuckFolder => ({
          id: gallery.id,
          name: gallery.name,
          buckName: gallery.buck_name,
          classification: gallery.classification,
          surveyYear: gallery.survey_year,
          imageCount: gallery.image_count,
          updatedAt: formatDisplayDate(gallery.updated_at),
          source: gallery.source,
          visibility: gallery.visibility,
          qrEnabled: gallery.qr_enabled,
          shareUrl: buildGalleryShareUrl(account.slug, gallery.survey_year, gallery.slug),
          notes: gallery.notes,
        }),
      );

    const clientCameraBatches = cameraBatchRows
      .filter((batch) => batch.client_account_id === account.id)
      .map(
        (batch): CameraBatch => ({
          id: batch.id,
          cameraName: batch.camera_name,
          surveyYear: batch.survey_year,
          source: batch.source,
          notes: batch.notes,
          imageCount: batch.image_count,
          clientVisibleCount: batch.client_visible_count,
          updatedAt: batch.updated_at,
          images: (imagesByBatchId[batch.id] ?? []).sort((left, right) => left.displayOrder - right.displayOrder),
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
        ...clientGalleries.map((gallery) => gallery.surveyYear),
        ...clientCameraBatches.map((batch) => batch.surveyYear),
      ]),
      documents: clientDocuments,
      buckFolders: clientGalleries,
      cameraBatches: clientCameraBatches,
    } satisfies Client;
  });

  return {
    configured: true,
    viewer,
    clients,
    setupMode: false,
  };
});

export async function getAccessibleClientAccountBySlug(clientSlug: string) {
  const { supabase } = await getViewerState();

  const { data: account } = await supabase
    .from("client_accounts")
    .select("id, slug, name, property_name, county, acreage")
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
    .select("id, client_account_id, title, survey_year, file_path")
    .eq("id", documentId)
    .eq("client_account_id", account.id)
    .eq("survey_year", surveyYear)
    .maybeSingle<{
      id: string;
      client_account_id: string;
      title: string;
      survey_year: string;
      file_path: string;
    }>();

  return document;
}

export async function getAccessibleGallery(clientSlug: string, surveyYear: string, gallerySlug: string) {
  const account = await getAccessibleClientAccountBySlug(clientSlug);

  if (!account) {
    return null;
  }

  const { supabase } = await getViewerState();
  const { data: gallery } = await supabase
    .from("buck_galleries")
    .select("id, client_account_id, slug, name, buck_name, classification, survey_year, image_count, updated_at, source, visibility, qr_enabled, notes")
    .eq("client_account_id", account.id)
    .eq("survey_year", surveyYear)
    .eq("slug", gallerySlug)
    .maybeSingle<BuckGalleryRow>();

  if (!gallery) {
    return null;
  }

  return {
    account,
    gallery,
  };
}

export async function getAccessibleBuckBook(clientSlug: string, surveyYear: string) {
  const account = await getAccessibleClientAccountBySlug(clientSlug);

  if (!account) {
    return null;
  }

  const { supabase } = await getViewerState();
  const { data: batches } = await supabase
    .from("camera_batches")
    .select("id, client_account_id, survey_year, camera_name, source, notes, image_count, client_visible_count, updated_at")
    .eq("client_account_id", account.id)
    .eq("survey_year", surveyYear)
    .order("updated_at", { ascending: false })
    .returns<CameraBatchRow[]>();

  const batchRows = batches ?? [];

  if (batchRows.length === 0) {
    return {
      account,
      surveyYear,
      images: [],
    };
  }

  const { data: images } = await supabase
    .from("camera_batch_images")
    .select("id, batch_id, client_account_id, file_path, file_name, captured_at, display_order, age_label, antler_points, life_status, deer_classification, client_visible, review_notes")
    .in("batch_id", batchRows.map((batch) => batch.id))
    .eq("client_visible", true)
    .order("display_order", { ascending: true })
    .returns<CameraBatchImageRow[]>();

  const batchNames = new Map(batchRows.map((batch) => [batch.id, batch.camera_name]));
  const signedImages = await buildCameraBatchImages(supabase, images ?? []);

  return {
    account,
    surveyYear,
    images: signedImages
      .filter((image) => image.url)
      .map((image) => ({
        ...image,
        cameraName: batchNames.get(image.batchId) ?? "Camera batch",
      })),
  };
}
