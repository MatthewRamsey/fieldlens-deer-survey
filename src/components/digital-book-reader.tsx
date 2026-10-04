"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { groupBucksByAge, type AgeGroup } from "@/lib/digital-buck-groups";
import { buckAgeLabel } from "@/lib/digital-buck-age";
import type { PublishedBook } from "@/lib/digital-buck-book";

const publicBookHref = (token: string, buckId?: string) => `/book/${token}${buckId ? `/bucks/${buckId}` : ""}`;
const publicImageHref = (token: string, imageId: string) => `/book/${token}/images/${imageId}`;

function ProgressivePhoto({ src, alt }: { src: string; alt: string }) {
  const [fullSrc, setFullSrc] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    fetch(`${src}?size=viewer`, { cache: "no-store", signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error("Full image unavailable");
      return response.blob();
    }).then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setFullSrc(objectUrl);
    }).catch(() => { /* Keep the readable preview if the larger image fails. */ });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return <Image src={fullSrc ?? `${src}?size=gallery`} alt={alt} width={1800} height={1200}
    unoptimized loading="eager" fetchPriority="high" />;
}

function AgeGroupSection({ group, index, href, imageHref, savePosition }: {
  group: AgeGroup; index: number; href: (buckId: string) => string;
  imageHref: (imageId: string) => string; savePosition: (buckId: string) => void;
}) {
  return <section className="digital-age-group" id={`age-group-${index}`} aria-labelledby={`age-group-title-${index}`}>
    <div className="digital-age-group-head">
      <div><p className="eyebrow">Age group</p><h2 id={`age-group-title-${index}`}>{group.label}</h2>
        <p>{group.bucks.length} buck{group.bucks.length === 1 ? "" : "s"}</p></div>
    </div>
    <div className="digital-book-grid">{group.bucks.map(buck => <div className="digital-book-card-wrap" key={buck.id} id={`buck-${buck.id}`}>
      <Link href={href(buck.id)} className="digital-book-card" onClick={() => savePosition(buck.id)} aria-label={`View ${buck.name} and its photos`}>
        {buck.images[0] ? <Image src={`${imageHref(buck.images[0].id)}?size=gallery`} alt={buck.images[0].altText || buck.name}
          width={640} height={440} unoptimized loading={index === 0 && group.bucks[0].id === buck.id ? "eager" : "lazy"} />
          : <div className="digital-book-image-placeholder">Highlight photo needed</div>}
        <div><span>View buck photos</span><h3>{buck.name}</h3>
          <p>{buckAgeLabel(buck.ageClass)}</p>
          {buck.images.length > 1 && <p>{buck.images.length - 1} additional photo{buck.images.length === 2 ? "" : "s"}</p>}</div>
      </Link>
    </div>)}</div>
  </section>;
}

export function DigitalBookReader({ book, buckId, embeddedHref, adminPreview = false }: {
  book: PublishedBook; buckId?: string; embeddedHref?: string; adminPreview?: boolean;
}) {
  const router = useRouter();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoHeight, setPhotoHeight] = useState<number | null>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const groups = groupBucksByAge(book.bucks);
  const orderedBucks = groups.flatMap(group => group.bucks);
  const index = orderedBucks.findIndex(buck => buck.id === buckId);
  const buck = index >= 0 ? orderedBucks[index] : null;
  const href = (id?: string) => embeddedHref ? `${embeddedHref}${id ? `&buck=${id}` : ""}` : publicBookHref(book.token, id);
  const imageHref = (id: string) => adminPreview ? `/api/digital-buck/admin-image/${id}` : publicImageHref(book.token, id);
  const scrollKey = `digital-book-gallery:${book.token}:${embeddedHref ?? "public"}`;
  const savePosition = (selectedBuckId: string) => {
    const content = document.querySelector<HTMLElement>("#main-content");
    sessionStorage.setItem(scrollKey, JSON.stringify({ content: content?.scrollTop ?? null, window: window.scrollY, selectedBuckId }));
  };
  useEffect(() => {
    if (!buckId) return;
    const fitPhoto = () => {
      if (!photoRef.current) return;
      setPhotoHeight(Math.max(64, window.innerHeight - photoRef.current.getBoundingClientRect().top - 12));
    };
    const alignPhoto = () => {
      const heading = headingRef.current;
      if (!heading) return;
      const content = document.querySelector<HTMLElement>("#main-content");
      if (content) content.scrollTo({ top: content.scrollTop + heading.getBoundingClientRect().top - content.getBoundingClientRect().top - 12, behavior: "instant" });
      else window.scrollTo({ top: window.scrollY + heading.getBoundingClientRect().top - 12, behavior: "instant" });
      heading.focus({ preventScroll: true });
      window.requestAnimationFrame(fitPhoto);
    };
    const frame = window.requestAnimationFrame(alignPhoto);
    const resize = () => window.requestAnimationFrame(alignPhoto);
    window.addEventListener("resize", resize);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("resize", resize); };
  }, [buckId]);
  useEffect(() => {
    if (buckId) return;
    const saved = sessionStorage.getItem(scrollKey);
    if (!saved) return;
    try {
      const position = JSON.parse(saved) as { content: number | null; window: number; selectedBuckId?: string };
      const restore = () => {
        sessionStorage.removeItem(scrollKey);
        const content = document.querySelector<HTMLElement>("#main-content");
        if (content && position.content !== null) content.scrollTop = position.content;
        else window.scrollTo(0, position.window);
        const scroller = content ?? document.scrollingElement;
        if (scroller && Math.abs(scroller.scrollTop - (content ? position.content ?? 0 : position.window)) > 40 && position.selectedBuckId) {
          document.getElementById(`buck-${position.selectedBuckId}`)?.scrollIntoView({ block: "center" });
        }
        if (position.selectedBuckId) {
          document.querySelector<HTMLAnchorElement>(`#buck-${position.selectedBuckId} a`)?.focus({ preventScroll: true });
        }
      };
      const timeout = window.setTimeout(restore, 100);
      return () => window.clearTimeout(timeout);
    } catch { sessionStorage.removeItem(scrollKey); }
  }, [buckId, scrollKey]);
  const Root = embeddedHref ? "div" : "main";

  return <Root className="digital-book-reader">
    {!embeddedHref && <header className="digital-book-header">
      <Link href={href()} className="digital-book-brand">Upland Wildlife Management</Link>
      <span>{book.propertyName} · {book.year}</span>
    </header>}
    {buck ? <>
      <div className="digital-book-heading" ref={headingRef} tabIndex={-1}>
        <Link href={href()} className="digital-book-back"><ArrowLeft size={17} /> All bucks</Link>
        <p className="eyebrow">Buck {index + 1} of {orderedBucks.length}</p>
        <h1>{buck.name} <span className="digital-book-age">{buckAgeLabel(buck.ageClass)}</span></h1>
      </div>
      <nav className="digital-book-buck-nav" aria-label="Browse bucks">
        {orderedBucks[index - 1] && <Link className={buttonVariants({ variant: "outline" })} href={href(orderedBucks[index - 1].id)}>
          <ArrowLeft aria-hidden="true" /> Previous: {orderedBucks[index - 1].name}
        </Link>}
        {orderedBucks[index + 1] && <Link className={buttonVariants({ variant: "outline" })} href={href(orderedBucks[index + 1].id)}>
          Next: {orderedBucks[index + 1].name} <ArrowRight aria-hidden="true" />
        </Link>}
      </nav>
      {buck.images.length > 0 && <div className="digital-book-photo-viewer" tabIndex={0} role="region" aria-label={`${buck.name} photo viewer`}
        onKeyDown={event => {
          if (event.key === "Escape") { event.preventDefault(); router.push(href()); }
          if (event.key === "ArrowRight" && photoIndex < buck.images.length - 1) { event.preventDefault(); setPhotoIndex(photoIndex + 1); }
          if (event.key === "ArrowLeft" && photoIndex > 0) { event.preventDefault(); setPhotoIndex(photoIndex - 1); }
        }}
        onTouchStart={event => setTouchStart({ x: event.touches[0].clientX, y: event.touches[0].clientY })}
        onTouchEnd={event => {
          if (!touchStart) return;
          const dx = event.changedTouches[0].clientX - touchStart.x;
          const dy = event.changedTouches[0].clientY - touchStart.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) setPhotoIndex(current => Math.min(current + 1, buck.images.length - 1));
            else setPhotoIndex(current => Math.max(current - 1, 0));
          }
          setTouchStart(null);
        }}>
        <div className="digital-book-photo" ref={photoRef} style={photoHeight === null ? undefined : { height: photoHeight }}>
          <ProgressivePhoto key={buck.images[photoIndex]?.id ?? buck.images[0].id}
            src={imageHref(buck.images[photoIndex]?.id ?? buck.images[0].id)}
            alt={buck.images[photoIndex]?.altText || `${buck.name}, photo ${photoIndex + 1}`} />
        </div>
        {buck.images.length > 1 && <>
          <div className="digital-book-photo-controls" aria-live="polite">
            <Button variant="outline" disabled={photoIndex === 0} onClick={() => setPhotoIndex(photoIndex - 1)} aria-label="Previous photo"><ChevronLeft /></Button>
            <span>Photo {photoIndex + 1} of {buck.images.length}</span>
            <Button variant="outline" disabled={photoIndex >= buck.images.length - 1} onClick={() => setPhotoIndex(photoIndex + 1)} aria-label="Next photo"><ChevronRight /></Button>
          </div>
          <div className="digital-book-thumbnails" aria-label="Buck photos">
            {buck.images.map((image, photo) => <button key={image.id} type="button" className={photo === photoIndex ? "active" : ""}
              onClick={() => setPhotoIndex(photo)} aria-label={`Show photo ${photo + 1}`} aria-current={photo === photoIndex ? "true" : undefined}>
              <Image src={`${imageHref(image.id)}?size=thumbnail`} alt="" width={96} height={72} unoptimized loading="lazy" />
            </button>)}
          </div>
        </>}
      </div>}
    </> : <>
      <div className="digital-book-heading"><p className="eyebrow">{book.year} digital buck book</p><h1>{book.propertyName}</h1>
        <p>Explore the bucks selected for this year&apos;s printed book by age group.</p>
        <p className="digital-book-total">{orderedBucks.length} selected buck{orderedBucks.length === 1 ? "" : "s"}</p></div>
      {groups.length > 1 && <nav className="digital-age-jump" aria-label="Jump to age group">
        {groups.map((group, groupIndex) => <a href={`#age-group-${groupIndex}`} key={group.label}>{group.label}</a>)}
      </nav>}
      <div className="digital-age-groups">{groups.map((group, groupIndex) => <AgeGroupSection key={group.label}
        group={group} index={groupIndex} href={id => href(id)} imageHref={imageHref} savePosition={savePosition} />)}</div>
      {book.bucks.length === 0 && <p>No bucks have been selected for this book.</p>}
    </>}
  </Root>;
}
