"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import * as tus from "tus-js-client";
import QRCode from "qrcode";
import { Images, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Buck, BuckBook } from "@/lib/digital-buck-book";
import { buckDisplayName } from "@/lib/digital-buck-label";
import {
  createDigitalBuckForPhoto, createDigitalBook, discardUnfinishedDigitalBuckImage, processDigitalBuckImage, removeDigitalBuck,
  removeEmptyDigitalBuck,
  removeDigitalBuckImage, reserveDigitalBuckImage, setDigitalBookPublished,
  setDigitalBuckHighlight, updateDigitalBuck, updateDigitalBuckImage,
} from "@/app/actions/digital-buck-book";

function actionError(error: unknown) {
  if (!(error instanceof Error)) return "The change could not be saved.";
  if (/Server Action .+ was not found on the server/i.test(error.message))
    return "This page was updated. Reload it and try again.";
  return error.message;
}
const Label = (props: React.ComponentProps<"label">) => <label {...props} />;
const acceptedPhotoTypes = ".jpg,.jpeg,.png,.webp,.heic,.heif,.dng,.cr2,.cr3,.nef,.arw,.raf,.orf,.rw2";
const standardAgeGroups = ["1.5", "2.5", "3.5", "4.5", "5.5+"];
type BatchFile = { key: string; file: File };
type BatchResult = { key: string; fileName: string; buckId?: string; name?: string; imageId?: string; error?: string };
function editableAgeClass(value: string) {
  return value.trim().replace(/\s*(?:years?|yrs?)(?:\s*old)?$/i, "");
}

function validatePhoto(file: File) {
  if (file.size < 1 || file.size > 50 * 1024 * 1024) throw new Error(`${file.name}: Photos must be 50 MB or smaller.`);
  if (!/\.(jpe?g|png|webp|heic|heif|dng|cr2|cr3|nef|arw|raf|orf|rw2)$/i.test(file.name))
    throw new Error(`${file.name}: Choose a supported JPEG, PNG, WebP, HEIC, or camera RAW photo.`);
}

async function uploadBuckPhotos(buckId: string, files: File[], onProgress: (value: string) => void, onPhotoReady: () => void) {
  const client = createClient();
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error("Sign in again before uploading photos.");
  const env = getSupabaseEnv();
  const failures: string[] = [];
  const readyImageIds: string[] = [];
  for (const file of files) {
    let reservedImageId: string | null = null;
    let processingStarted = false;
    let processFailed = false;
    try {
      validatePhoto(file);
      onProgress(`Preparing ${file.name}…`);
      const reservation = await reserveDigitalBuckImage(buckId, file.name, file.size, file.type);
      reservedImageId = reservation.id;
      await new Promise<void>((resolve, reject) => {
        const transfer = new tus.Upload(file, {
          endpoint: `${env.url}/storage/v1/upload/resumable`,
          headers: { authorization: `Bearer ${session.access_token}`, apikey: env.publishableKey },
          metadata: { bucketName: "digital-buck-originals", objectName: reservation.path,
            contentType: file.type || "application/octet-stream", cacheControl: "3600" },
          chunkSize: 6 * 1024 * 1024, retryDelays: [0, 3000, 5000, 10000],
          onProgress: (done, total) => onProgress(`Uploading ${file.name}: ${Math.round(done / total * 100)}%`),
          onError: reject, onSuccess: () => resolve(),
        });
        transfer.start();
      });
      onProgress(`Processing ${file.name}…`);
      processingStarted = true;
      const result = await processDigitalBuckImage(reservation.id);
      if (result.error) { processFailed = true; throw new Error(result.error); }
      onProgress(`${file.name} ready`);
      readyImageIds.push(reservation.id);
      onPhotoReady();
    } catch (cause) {
      let message = actionError(cause);
      if (reservedImageId) {
        try { await discardUnfinishedDigitalBuckImage(reservedImageId, !processingStarted || processFailed); }
        catch (cleanupError) { message += ` ${actionError(cleanupError)}`; }
      }
      failures.push(`${file.name}: ${message}`);
      onProgress(`${files.length - failures.length} of ${files.length} photos ready; ${failures.length} failed`);
    }
  }
  if (failures.length) throw new Error(failures.join("; "));
  return readyImageIds;
}

export function DigitalBuckWorkspace({ book, clientSlug, propertyName, year, origin }: {
  book: BuckBook | null; clientSlug: string; propertyName: string; year: string; origin: string;
}) {
  const router = useRouter();
  const [addingBuck, setAddingBuck] = useState(false);
  const [newAgeClass, setNewAgeClass] = useState("3.5");
  const [newPhotos, setNewPhotos] = useState<BatchFile[]>([]);
  const [newUploadState, setNewUploadState] = useState("");
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  const selectedBucks = book?.bucks.filter(buck => buck.print_selected) ?? [];
  const missingHighlights = selectedBucks.filter(buck => !buck.images.some(image => image.status === "ready" && image.is_highlight));
  const missingAgeClasses = selectedBucks.filter(buck => !buck.age_class.trim());
  const failedPhotos = book?.bucks.reduce((count, buck) => count + buck.images.filter(image => image.status === "failed").length, 0) ?? 0;
  const ageGroups = [...new Set([...standardAgeGroups, ...(book?.bucks.map(buck => buck.age_class) ?? [])
    .filter(value => /^[0-9]+(?:\.[0-9]+)?\+?$/.test(value))])];
  const run = (work: () => Promise<unknown>, success: string) => {
    setError(""); setMessage("");
    start(async () => { try { await work(); setMessage(success); router.refresh(); } catch (cause) { setError(actionError(cause)); } });
  };
  const addBucks = (bookId: string) => {
    setError(""); setMessage("");
    if (!newPhotos.length) { setError("Choose at least one highlight photo."); return; }
    start(async () => {
      const failed: BatchFile[] = [];
      const results: BatchResult[] = [];
      for (const [index, item] of newPhotos.entries()) {
        let buck: Awaited<ReturnType<typeof createDigitalBuckForPhoto>> | null = null;
        try {
          validatePhoto(item.file);
          setNewUploadState(`Photo ${index + 1} of ${newPhotos.length}: ${item.file.name}`);
          buck = await createDigitalBuckForPhoto(bookId, newAgeClass, item.key);
          const imageIds = buck.ready ? [] : await uploadBuckPhotos(buck.id, [item.file], setNewUploadState, () => {});
          results.push({ key: item.key, fileName: item.file.name, buckId: buck.id, name: buck.name,
            imageId: buck.highlightId ?? imageIds[0] });
        } catch (cause) {
          failed.push(item);
          let cleanupError = "";
          if (buck?.created) {
            try { if (await removeEmptyDigitalBuck(buck.id)) buck = null; }
            catch (error) { cleanupError = ` Cleanup needs attention: ${actionError(error)}`; }
          }
          results.push({ key: item.key, fileName: item.file.name, buckId: buck?.id, name: buck?.name,
            error: actionError(cause) + cleanupError });
        }
        setBatchResults([...results]);
      }
      setNewPhotos(failed);
      setNewUploadState("");
      setMessage(`${newPhotos.length - failed.length} of ${newPhotos.length} bucks ready.${failed.length ? " Retry the failed files below." : ""}`);
      router.refresh();
    });
  };
  return <Card className="workspace-card digital-book-workspace">
    <div className="digital-workspace-head"><div><p className="eyebrow">{propertyName} · {year}</p><h2>Digital Buck Book</h2>
      <p>Choose the bucks for print, add their photos, then publish the same book online.</p></div>
      {book && <div className="digital-workspace-head-actions"><span className="digital-status">{book.status === "published" ? "Published" : "Draft"}</span>
        <Button aria-controls="add-buck-form" aria-expanded={addingBuck} disabled={busy} onClick={() => setAddingBuck(open => !open)} type="button">
          <Plus aria-hidden="true" /> {addingBuck ? "Close form" : "Add bucks"}
        </Button></div>}
    </div>
    {error && <p className="digital-feedback error" role="alert">{error}</p>}
    {message && <p className="digital-feedback" role="status">{message}</p>}
    {!book ? <div className="digital-empty"><p>No book for this survey year yet.</p>
      <Button disabled={busy} onClick={() => run(() => createDigitalBook(clientSlug, year), "Book created.")}>Create {year} book</Button>
    </div> : <>
      {addingBuck && <form className="digital-add-buck" id="add-buck-form" onSubmit={event => {
        event.preventDefault();
        addBucks(book.id);
      }}>
        <div><p className="eyebrow">Bulk upload</p><h3>Add bucks by age group</h3><p>Each selected photo creates one buck and becomes its highlight. Add more photos to a buck in its editor below.</p></div>
        <div className="digital-add-buck-fields">
          <div><Label htmlFor="new-buck-age">Age group</Label><NativeSelect autoFocus id="new-buck-age" value={newAgeClass} onChange={event => setNewAgeClass(event.target.value)}>
            {ageGroups.map(age => <option key={age} value={age}>{age} years</option>)}
          </NativeSelect></div>
          <div><Label>Property and survey year</Label><p>{propertyName} · {year}</p></div>
        </div>
        <div className="digital-add-buck-photos"><Label htmlFor="new-buck-photos">Highlight photos</Label>
          <div className="portal-file-picker"><Input className="portal-file-input" id="new-buck-photos" type="file" multiple accept={acceptedPhotoTypes}
            aria-label="Choose highlight photos for new bucks" disabled={busy} onChange={event => { setNewPhotos(Array.from(event.currentTarget.files ?? []).map(file => ({ key: crypto.randomUUID(), file }))); setBatchResults([]); event.currentTarget.value = ""; }} />
            <Label className="portal-file-trigger" htmlFor="new-buck-photos"><Images aria-hidden="true" /> Choose highlight photos</Label>
            <span className="portal-file-help">JPEG, PNG, WebP, HEIC, or camera RAW · up to 50 MB each</span></div>
          {newPhotos.length > 0 && <><p>{newPhotos.length} photo{newPhotos.length === 1 ? "" : "s"} selected. Expected IDs: {book.buckPrefix}{book.nextBuckNumber}–{book.buckPrefix}{book.nextBuckNumber + newPhotos.length - 1}. Final IDs are confirmed during upload.</p>
            <ul className="digital-batch-files">{newPhotos.map(item => <li key={item.key}><span>{item.file.name}</span><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setNewPhotos(files => files.filter(file => file.key !== item.key))} aria-label={`Remove ${item.file.name} from batch`}>Remove</Button></li>)}</ul></>}
        </div>
        {newUploadState && <p role="status">{newUploadState}</p>}
        {batchResults.length > 0 && <div role="status"><strong>Batch results</strong><ul className="digital-batch-results">{batchResults.map(result => <li key={result.key}>
          {result.imageId && <Image src={`/api/digital-buck/admin-image/${result.imageId}`} alt="" width={72} height={54} unoptimized />}
          <span><strong>{result.name ?? result.fileName}</strong><br />{result.error ?? `${result.fileName} ready`}</span>
          {result.buckId && <a href={`#buck-${result.buckId}`}>Edit buck</a>}
        </li>)}</ul></div>}
        <div className="digital-editor-actions"><Button disabled={busy || !newPhotos.length} type="submit">{busy ? "Uploading bucks…" : `Add ${newPhotos.length} buck${newPhotos.length === 1 ? "" : "s"}`}</Button>
          <Button disabled={busy} variant="outline" type="button" onClick={() => setAddingBuck(false)}>Cancel</Button></div>
      </form>}
      <div className="digital-book-toolbar">
        <div><strong>{selectedBucks.length} selected for print</strong><p>Only selected bucks appear in the digital book.</p></div>
        <div className="digital-toolbar-actions">
          <Button variant="outline" nativeButton={false} render={<Link href={book.status === "published"
            ? `/book/${book.public_token}/qr`
            : `/admin/preview/${clientSlug}?section=digital-buck-book&year=${year}`} target="_blank" />}>
            {book.status === "published" ? "Preview book" : "Preview draft"}
          </Button>
          <Button variant="outline" nativeButton={false} render={<a href={`/api/digital-buck/export/${book.id}`} />}>Download print assets</Button>
          <Button disabled={busy} variant={book.status === "published" ? "outline" : "default"}
            onClick={() => run(() => setDigitalBookPublished(book.id, book.status !== "published"), book.status === "published" ? "Book unpublished." : "Book published.")}>
            {book.status === "published" ? "Unpublish" : "Publish book"}
          </Button>
        </div>
      </div>
      <BookQrControls book={book} origin={origin} propertyName={propertyName} />
      {(missingHighlights.length > 0 || missingAgeClasses.length > 0 || failedPhotos > 0) &&
        <div className="digital-publish-review" role="status"><strong>Review before publishing</strong><ul>
          {missingHighlights.map(buck => <li key={buck.id}>{buckDisplayName(buck.name, buck.nickname)} needs a ready highlight photo.</li>)}
          {missingAgeClasses.map(buck => <li key={`age-${buck.id}`}>{buckDisplayName(buck.name, buck.nickname)} has no age class and will appear under Unclassified.</li>)}
          {failedPhotos > 0 && <li>{failedPhotos} photo{failedPhotos === 1 ? "" : "s"} could not be processed. Remove or retry them.</li>}
        </ul></div>}
      <div className="digital-buck-list">{book.bucks.map((buck, index) => <BuckEditor key={buck.id} buck={buck} index={index} book={book}
        busy={busy} setError={setError} run={run} />)}</div>
      {book.bucks.length === 0 && <p className="digital-empty">Add your first buck to start curating this book.</p>}
    </>}
  </Card>;
}

function BookQrControls({ book, origin, propertyName }: { book: BuckBook; origin: string; propertyName: string }) {
  const [qr, setQr] = useState("");
  const [qrError, setQrError] = useState(false);
  const url = `${origin}/book/${book.public_token}/qr`;
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, { width: 1200, margin: 2, errorCorrectionLevel: "H" })
      .then(value => { if (active) setQr(value); })
      .catch(() => { if (active) setQrError(true); });
    return () => { active = false; };
  }, [url]);
  return <section className="digital-book-qr-section" id="book-qr" aria-label="Book QR code">
    <div className="digital-book-qr-head"><div><p className="eyebrow">Print and share</p><h3>{book.survey_year} book QR code</h3>
      <p>One code for the entire {propertyName} book. Scanning opens the gallery of selected bucks.</p></div>
      <span className="digital-status">{book.status === "published" ? "Live" : "Available after publishing"}</span>
    </div>
    <div className="digital-qr">
      <div className="digital-qr-preview">{qr ? <Image src={qr} alt={`QR code for the ${book.survey_year} ${propertyName} book`} width={240} height={240} unoptimized />
        : <span role="status">{qrError ? "QR code unavailable. Reload to try again." : "Preparing QR code…"}</span>}</div>
      <div className="digital-qr-details"><p>{book.status === "published" ? "This QR code is ready to place in the printed book." : "You can download this QR code now. Its public gallery opens after you publish the book."}</p>
        <div className="digital-qr-actions">
          {qr && <Button variant="outline" nativeButton={false} render={<a href={qr} download={`${book.survey_year}-${book.public_token}-book-qr.png`} />}>Download book QR</Button>}
          <Button variant="outline" nativeButton={false} render={<Link href={url} target="_blank" />}>Open QR destination</Button>
        </div>
        <p className="digital-book-qr-url">{url}</p>
      </div>
    </div>
  </section>;
}

function BuckEditor({ buck, index, book, busy, setError, run }: {
  buck: Buck; index: number; book: BuckBook; busy: boolean;
  setError: (value: string) => void;
  run: (work: () => Promise<unknown>, success: string) => void;
}) {
  const router = useRouter();
  const [nickname, setNickname] = useState(buck.nickname ?? "");
  const [ageClass, setAgeClass] = useState(editableAgeClass(buck.age_class));
  const [selected, setSelected] = useState(buck.print_selected);
  const [order, setOrder] = useState(buck.display_order);
  const [uploadState, setUploadState] = useState("");
  const upload = async (files: File[]) => {
    if (!files.length) return;
    setError("");
    try { await uploadBuckPhotos(buck.id, files, setUploadState, () => router.refresh()); }
    catch (cause) { setError(actionError(cause)); setUploadState(""); router.refresh(); }
  };
  return <Card className="digital-buck-editor" id={`buck-${buck.id}`}>
    <div className="digital-buck-editor-head"><div><p className="eyebrow">Buck {index + 1}</p><h3>{buckDisplayName(buck.name, buck.nickname)}</h3></div>
      <span>{buck.print_selected ? "In print and digital" : "Not selected"}</span></div>
    <div className="digital-buck-fields">
      <div><Label htmlFor={`nickname-${buck.id}`}>Nickname (optional)</Label><Input id={`nickname-${buck.id}`} value={nickname} maxLength={120} placeholder="Example: Big Boy" onChange={event => setNickname(event.target.value)} /><small>Identifier: {buck.name}</small></div>
      <div><Label htmlFor={`age-${buck.id}`}>Age group</Label><NativeSelect id={`age-${buck.id}`} value={ageClass} onChange={event => setAgeClass(event.target.value)}>
        {!/^[0-9]+(?:\.[0-9]+)?\+?$/.test(ageClass) && <option value={ageClass}>{ageClass || "Choose an age group"}</option>}
        {[...new Set([...standardAgeGroups, ageClass].filter(value => /^[0-9]+(?:\.[0-9]+)?\+?$/.test(value)))].map(age => <option key={age} value={age}>{age} years</option>)}
      </NativeSelect></div>
      <div><Label htmlFor={`order-${buck.id}`}>Print order</Label><Input id={`order-${buck.id}`} type="number" value={order} onChange={event => setOrder(Number(event.target.value))} /></div>
      <div className="digital-buck-selection"><Label htmlFor={`select-${buck.id}`}>Include in print and digital book</Label><input id={`select-${buck.id}`} type="checkbox" checked={selected} onChange={event => setSelected(event.target.checked)} /></div>
    </div>
    <div className="digital-editor-actions">
      <Button disabled={busy} onClick={() => {
        if (book.status === "published" && buck.print_selected && !selected &&
          !window.confirm(`Remove ${buck.name} from the published gallery? Existing direct links to this buck will stop working.`)) return;
        run(() => updateDigitalBuck(buck.id, { nickname, ageClass, selected, order }), "Buck saved.");
      }}>Save buck</Button>
      <Button disabled={busy} variant="outline" onClick={() => {
        const warning = book.status === "published" && buck.print_selected
          ? `Remove ${buck.name} from the published gallery? Existing direct links to this buck will stop working.`
          : `Remove ${buck.name} and its photos?`;
        if (window.confirm(warning)) run(() => removeDigitalBuck(buck.id), "Buck removed.");
      }}>Remove buck</Button>
    </div>
    <div className="digital-image-section"><div><h4>Photos</h4><p>Add one or more photos of this buck. Select another ready photo to change the highlight.</p></div>
      <div className="portal-file-picker">
        <Input className="portal-file-input" id={`upload-${buck.id}`} type="file" multiple accept={acceptedPhotoTypes} aria-label={`Choose images for ${buck.name}`} onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void upload(files); }} />
        <Label className="portal-file-trigger" htmlFor={`upload-${buck.id}`}><Images aria-hidden="true" /> Add photos to {buck.name}</Label>
        <span className="portal-file-help">JPEG, PNG, WebP, HEIC, or camera RAW · up to 50 MB each</span>
      </div>
      {uploadState && <p role="status">{uploadState}</p>}
    </div>
    <div className="digital-image-grid">{buck.images.map(image => <div className="digital-image-card" key={image.id}>
      {image.status === "ready" ? <Image src={`/api/digital-buck/admin-image/${image.id}`} alt={image.alt_text || `${buckDisplayName(buck.name, buck.nickname)}, photo ${image.display_order + 1}`} width={340} height={250} unoptimized /> : <div className="digital-image-pending">{image.status === "pending" ? "Processing" : image.error_message || "Conversion failed"}</div>}
      <div><strong>{image.original_name}</strong><span>{image.is_highlight ? "Highlight" : "Supporting photo"}</span></div>
      {image.status === "ready" && <div className="digital-image-actions"><Button disabled={busy || image.is_highlight} variant="outline" size="sm" onClick={() => run(() => setDigitalBuckHighlight(image.id), "Highlight updated.")}>Use as highlight</Button>
        {image.is_highlight && <Button nativeButton={false} variant="outline" size="sm" render={<a href={`/api/digital-buck/admin-original/${image.id}`} />}>Download highlight</Button>}</div>}
      <ImageFields id={image.id} initialAlt={image.alt_text} initialOrder={image.display_order} busy={busy} run={run} />
      <Button disabled={busy} variant="outline" size="sm" onClick={() => { if (window.confirm("Remove this photo?")) run(() => removeDigitalBuckImage(image.id), "Photo removed."); }}>Remove photo</Button>
    </div>)}</div>
  </Card>;
}

function ImageFields({ id, initialAlt, initialOrder, busy, run }: { id: string; initialAlt: string; initialOrder: number; busy: boolean; run: (work: () => Promise<unknown>, success: string) => void }) {
  const [alt, setAlt] = useState(initialAlt);
  const [order, setOrder] = useState(initialOrder);
  return <div className="digital-image-fields"><Label htmlFor={`alt-${id}`}>Image accessibility text (optional)</Label><Input id={`alt-${id}`} value={alt} onChange={event => setAlt(event.target.value)} />
    <Label htmlFor={`image-order-${id}`}>Photo order</Label><Input id={`image-order-${id}`} type="number" value={order} onChange={event => setOrder(Number(event.target.value))} />
    <Button disabled={busy} variant="outline" size="sm" onClick={() => run(() => updateDigitalBuckImage(id, alt, order), "Photo saved.")}>Save photo details</Button>
  </div>;
}
