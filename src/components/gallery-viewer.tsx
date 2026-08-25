"use client";

import { useEffect, useEffectEvent, useState } from "react";
import type { GalleryImage } from "@/lib/portal-types";

type GalleryViewerProps = {
  buckName: string;
  galleryName: string;
  images: GalleryImage[];
};

export function GalleryViewer({ buckName, galleryName, images }: GalleryViewerProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const openViewer = (index: number) => {
    setActiveIndex(index);
  };

  const closeViewer = () => {
    setActiveIndex(null);
  };

  const showPrevious = () => {
    setActiveIndex((currentIndex) => {
      if (currentIndex === null) {
        return currentIndex;
      }

      return currentIndex === 0 ? images.length - 1 : currentIndex - 1;
    });
  };

  const showNext = () => {
    setActiveIndex((currentIndex) => {
      if (currentIndex === null) {
        return currentIndex;
      }

      return currentIndex === images.length - 1 ? 0 : currentIndex + 1;
    });
  };

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (activeIndex === null) {
      return;
    }

    if (event.key === "Escape") {
      closeViewer();
      return;
    }

    if (event.key === "ArrowLeft") {
      showPrevious();
      return;
    }

    if (event.key === "ArrowRight") {
      showNext();
    }
  });

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    document.body.classList.add("viewer-open");
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("viewer-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeIndex]);

  const activeImage = activeIndex === null ? null : images[activeIndex];
  const activePosition = activeIndex === null ? 0 : activeIndex + 1;

  return (
    <>
      <div className="gallery-grid">
        {images.map((image, index) => (
          <article className="gallery-card" key={image.id}>
            <button
              aria-label={`Open ${image.fileName}`}
              className="gallery-image-button"
              onClick={() => openViewer(index)}
              type="button"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={image.caption ?? image.fileName} className="gallery-image" src={image.url} />
            </button>

            <div className="gallery-card-copy">
              <div className="book-title">
                <div>
                  <h3>{image.fileName}</h3>
                  <p>{buckName}</p>
                </div>
              </div>
              <p className="gallery-card-meta">
                Image {index + 1} of {images.length}
              </p>
            </div>
          </article>
        ))}
      </div>

      {activeImage ? (
        <div
          aria-label={`${galleryName} viewer`}
          className="gallery-viewer"
          onClick={closeViewer}
          role="dialog"
        >
          <div className="gallery-viewer-shell" onClick={(event) => event.stopPropagation()} role="document">
            <div className="gallery-viewer-top">
              <div>
                <p className="eyebrow">Image viewer</p>
                <h2>{activeImage.fileName}</h2>
                <p className="section-copy">
                  {buckName} • {activePosition} of {images.length}
                </p>
              </div>

              <button aria-label="Close viewer" className="viewer-close" onClick={closeViewer} type="button">
                Close
              </button>
            </div>

            <div className="gallery-viewer-stage">
              <button
                aria-label="Previous image"
                className="viewer-nav viewer-nav-left"
                onClick={showPrevious}
                type="button"
              >
                Prev
              </button>

              <div className="viewer-image-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={activeImage.caption ?? activeImage.fileName} className="viewer-image" src={activeImage.url} />
              </div>

              <button aria-label="Next image" className="viewer-nav viewer-nav-right" onClick={showNext} type="button">
                Next
              </button>
            </div>

            <div aria-label="Gallery thumbnails" className="viewer-filmstrip" role="tablist">
              {images.map((image, index) => (
                <button
                  aria-selected={index === activeIndex}
                  className={`viewer-thumb ${index === activeIndex ? "is-active" : ""}`}
                  key={image.id}
                  onClick={() => openViewer(index)}
                  role="tab"
                  type="button"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={image.caption ?? image.fileName} className="viewer-thumb-image" src={image.url} />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
