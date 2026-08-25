import Link from "next/link";
import { notFound } from "next/navigation";
import { GalleryViewer } from "@/components/gallery-viewer";
import { getAccessibleGallery } from "@/lib/portal-data";
import type { GalleryImage } from "@/lib/portal-types";
import { createClient } from "@/lib/supabase/server";

type GalleryImageRow = {
  id: string;
  file_path: string;
  file_name: string;
  display_order: number;
};

async function getGalleryImages(galleryId: string): Promise<GalleryImage[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("buck_gallery_images")
    .select("id, file_path, file_name, display_order")
    .eq("gallery_id", galleryId)
    .order("display_order", { ascending: true })
    .returns<GalleryImageRow[]>();

  const images = rows ?? [];

  return Promise.all(
    images.map(async (image) => {
      const { data } = await supabase.storage
        .from("buck-gallery-images")
        .createSignedUrl(image.file_path, 60 * 10);

      return {
        id: image.id,
        caption: null,
        url: data?.signedUrl ?? "",
        fileName: image.file_name,
      };
    }),
  );
}

export default async function GalleryPage({
  params,
}: {
  params: Promise<{
    clientSlug: string;
    surveyYear: string;
    gallerySlug: string;
  }>;
}) {
  const { clientSlug, surveyYear, gallerySlug } = await params;
  const galleryState = await getAccessibleGallery(clientSlug, surveyYear, gallerySlug);

  if (!galleryState) {
    notFound();
  }

  const images = (await getGalleryImages(galleryState.gallery.id)).filter((image) => image.url);

  return (
    <main className="shell">
      <section className="workspace-card book-section">
        <div className="workspace-top">
          <div>
            <p className="eyebrow">Buck gallery</p>
            <h1>{galleryState.gallery.buck_name}</h1>
            <p className="section-copy">
              {galleryState.account.property_name} • {galleryState.gallery.survey_year} • {galleryState.gallery.classification}
            </p>
          </div>
          <div className="status-group">
            <span className="status-pill">{images.length} image{images.length === 1 ? "" : "s"}</span>
            <span className="status-pill">{galleryState.gallery.source}</span>
            <Link className="ghost-chip signout-chip" href="/">
              Back to portal
            </Link>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Gallery details</p>
              <h2>{galleryState.gallery.name}</h2>
            </div>
          </div>
          <p>{galleryState.gallery.notes}</p>
        </div>

        <div className="book-grid">
          {images.length ? (
            <GalleryViewer
              buckName={galleryState.gallery.buck_name}
              galleryName={galleryState.gallery.name}
              images={images}
            />
          ) : (
            <article className="empty-state">
              <h3>No images are available in this gallery yet</h3>
              <p>Check back after the next upload finishes.</p>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}
