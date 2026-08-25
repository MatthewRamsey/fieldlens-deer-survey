"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useState } from "react";
import type { CameraBatchImage, DeerClassification } from "@/lib/portal-types";

type BuckBookImage = CameraBatchImage & {
  cameraName: string;
};

type BuckBookViewerProps = {
  images: BuckBookImage[];
  propertyName: string;
  surveyYear: string;
};

const ageOrder: Record<CameraBatchImage["ageLabel"], number> = {
  Unknown: 0,
  Fawn: 1,
  "1.5 years": 2,
  "2.5 years": 3,
  "3.5 years": 4,
  "4.5 years": 5,
  "5.5+ years": 6,
};

function labelClass(classification: DeerClassification) {
  return classification === "Trophy" ? "trophy" : "management";
}

export function BuckBookViewer({ images, propertyName, surveyYear }: BuckBookViewerProps) {
  const [sort, setSort] = useState<"age" | "antlers">("age");
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const publishedImages = images.filter((image) => image.deerClassification !== "Unsorted");
  const activeIndex = publishedImages.findIndex((image) => image.id === activeImageId);
  const activeImage = activeIndex === -1 ? null : publishedImages[activeIndex];

  const compareImages = (left: BuckBookImage, right: BuckBookImage) => {
    if (sort === "antlers") {
      const difference = (right.antlerPoints ?? -1) - (left.antlerPoints ?? -1);
      if (difference !== 0) return difference;
    } else {
      const difference = ageOrder[right.ageLabel] - ageOrder[left.ageLabel];
      if (difference !== 0) return difference;
    }

    return left.fileName.localeCompare(right.fileName);
  };

  const groups = (["Trophy", "Management"] as const).map((classification) => ({
    classification,
    images: publishedImages
      .filter((image) => image.deerClassification === classification)
      .sort(compareImages),
  }));

  const showImage = (index: number) => {
    setActiveImageId(publishedImages[index]?.id ?? null);
  };

  const closeViewer = () => setActiveImageId(null);
  const showPrevious = () => showImage(activeIndex <= 0 ? publishedImages.length - 1 : activeIndex - 1);
  const showNext = () => showImage(activeIndex === publishedImages.length - 1 ? 0 : activeIndex + 1);
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!activeImage) return;
    if (event.key === "Escape") closeViewer();
    if (event.key === "ArrowLeft") showPrevious();
    if (event.key === "ArrowRight") showNext();
  });

  useEffect(() => {
    if (!activeImage) return;

    document.body.classList.add("viewer-open");
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("viewer-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeImage]);

  return (
    <>
      <div className="buck-book-toolbar client-buck-book-toolbar">
        <label className="client-picker buck-book-sorter">
          <span>Sort images</span>
          <select aria-label="Sort buck book images" onChange={(event) => setSort(event.target.value as "age" | "antlers")} value={sort}>
            <option value="age">By age</option>
            <option value="antlers">By antler count</option>
          </select>
        </label>
      </div>

      <div className="buck-book-viewer-groups">
        {groups.map((group) => (
          <section className="buck-book-client-panel" key={group.classification}>
            <div className="panel-header">
              <div>
                <p className="eyebrow">{group.classification} deer</p>
                <h2>{group.images.length} reviewed image{group.images.length === 1 ? "" : "s"}</h2>
              </div>
              <span className={`label-chip ${labelClass(group.classification)}`}>{group.classification}</span>
            </div>
            <div className="buck-book-card-grid">
              {group.images.map((image) => {
                const index = publishedImages.findIndex((entry) => entry.id === image.id);
                return (
                  <button className="buck-book-image-card client-buck-book-image-card" key={image.id} onClick={() => showImage(index)} type="button">
                    <div className="buck-book-image-frame">
                      <Image alt={image.fileName} className="buck-book-image" height={220} src={image.url} unoptimized width={320} />
                    </div>
                    <div className="buck-book-image-copy">
                      <strong>{image.ageLabel}</strong>
                      <div className="book-meta">
                        <span>{image.antlerPoints !== null ? `${image.antlerPoints} points` : "Antler count not listed"}</span>
                        <span>{image.lifeStatus}</span>
                        <span>{image.cameraName}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {activeImage ? (
        <div aria-label="Buck book image viewer" className="gallery-viewer" onClick={closeViewer} role="dialog">
          <div className="gallery-viewer-shell" onClick={(event) => event.stopPropagation()} role="document">
            <div className="gallery-viewer-top">
              <div>
                <p className="eyebrow">{propertyName} buck book</p>
                <h2>{activeImage.ageLabel} {activeImage.deerClassification.toLowerCase()} deer</h2>
                <p className="section-copy">{surveyYear} survey year • Image {activeIndex + 1} of {publishedImages.length}</p>
              </div>
              <button aria-label="Close viewer" className="viewer-close" onClick={closeViewer} type="button">Close</button>
            </div>
            <div className="gallery-viewer-stage">
              <button aria-label="Previous image" className="viewer-nav viewer-nav-left" onClick={showPrevious} type="button">Prev</button>
              <div className="viewer-image-frame">
                <Image alt={activeImage.fileName} className="viewer-image" fill sizes="(max-width: 900px) 90vw, 860px" src={activeImage.url} unoptimized />
              </div>
              <button aria-label="Next image" className="viewer-nav viewer-nav-right" onClick={showNext} type="button">Next</button>
            </div>
            <div aria-label="Buck book thumbnails" className="viewer-filmstrip" role="tablist">
              {publishedImages.map((image, index) => (
                <button aria-selected={index === activeIndex} className={`viewer-thumb ${index === activeIndex ? "is-active" : ""}`} key={image.id} onClick={() => showImage(index)} role="tab" type="button">
                  <Image alt={image.fileName} className="viewer-thumb-image" fill sizes="90px" src={image.url} unoptimized />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
