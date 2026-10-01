# Digital Buck Book — Bulk Age-Group Upload and Buck Names

**Status:** Implemented locally; production migration pending

**Date:** 2026-10-01
**Product:** Upland Wildlife Management admin, client, and public Digital Buck Book

**Related requirements:** [Digital Buck Book](./PRD-digital-buck-book.md) and [Book Gallery and Book-Level QR](./PRD-digital-buck-book-gallery.md). This PRD replaces their single-buck creation, manually entered buck-name, field-observation, buck-description, and photo-caption requirements. It keeps one QR code per property-year book, the age-group gallery, print selection, publication rules, and supporting-photo viewer. The earlier optional comparison idea is not part of this iteration.

## Overview

An administrator selects a client property, survey year, and age group, then uploads a batch of highlight photos. Each photo creates one buck in that property-year book. The app assigns an identifier from the first letter of each word in the property name plus a numeric sequence: Bradley Clark Farms produces `BCF1`, `BCF2`, and `BCF27`. The administrator can add an optional nickname; the display label becomes `BCF1 (Big Boy)`. Age group controls gallery placement but is not part of the identifier. The buck editor also accepts one or more additional photos of that same buck. Readers see its highlight in the age-group gallery and can open it to browse all ready photos.

## Problem

Creating a buck and its highlight one at a time makes a large camera-photo intake slow. Manually naming each buck creates inconsistent labels, and an age-based identifier would change when the buck's age group is corrected. Alphabetic suffixes would also break down beyond 26 deer. The current editor asks for observations, descriptions, and photo captions that the administrator no longer wants to maintain. Additional photos need to remain easy to attach to an individual buck without being mistaken for new bucks.

## Goals and success measures

1. An administrator can create at least 100 bucks in one age group and property-year book through one batch-selection flow, subject to the existing per-file upload limit. Every successful photo creates exactly one buck with a unique numeric identifier and a ready highlight.
2. Labels use the property's initials plus a numeric sequence with no alphabetic cap. Admin, client, public gallery, focused viewer, and print export show the same identifier and optional nickname; changing a buck's age group never changes that label.
3. An administrator can attach multiple additional photos to an existing buck in one action; these never create separate bucks and are available in the focused viewer after processing.
4. No buck or photo editing screen asks for observations, descriptions, or captions. Client and public views and future print exports do not display those fields, and previously stored buck prose is removed from active data.
5. Batch failures identify each affected file. Retrying does not silently duplicate an already created buck or reuse another buck's identifier.

## User stories

- As an administrator, I want to upload a group of highlight photos under one age group so I can create the year's bucks without repeating the same form for every deer.
- As an administrator, I want the app to number bucks from the property name beyond 26, independently of age group, so labels remain stable when I correct an age.
- As an administrator, I want to add an optional nickname while editing a buck so I can recognize a familiar deer without replacing its identifier.
- As an administrator, I want to add several more photos to one buck so the gallery shows the full set for that deer.
- As a client or QR visitor, I want to open an age-group highlight and browse that buck's additional photos with the same clear label throughout the book.

## Functional requirements

### P0 — Must have

1. **Book context and age group.** The bulk intake is available to authorized administrators in the selected client property and survey year. Before selecting photos, the administrator chooses one age group from a controlled set used by the book gallery. The intake screen shows the selected property, year, and age group throughout upload. A batch cannot create bucks without an age group. Age group affects grouping and display order, never the generated identifier.
2. **Bulk highlights.** Replace the top-level single-buck creation form with an **Add bucks** action that accepts multiple image files; selecting a single file through the same flow remains valid. Each accepted file creates one buck, and that file becomes its highlight after conversion. Preserve the order in which the administrator selected the files for numbering and initial display/print order. Show a pre-upload count, file list, age group, and expected naming range before confirmation. The administrator can remove a file from the batch before starting.
3. **Property identifiers.** Build a property's uppercase prefix from the first letter of each word in its name, ignoring surrounding spaces and punctuation; `Bradley Clark Farms` becomes `BCF`. Append a positive integer with no alphabetic cap, separator, or fixed digit width. Allocate the next never-issued number across all bucks for that property, including other age groups and survey years, on the server atomically. The first buck is `BCF1`; two concurrent batches cannot receive the same number. Freeze the stored prefix once the property's first identifier is issued so later property-name edits do not rename existing bucks or cause mixed prefixes for future bucks. Deleting a buck does not renumber the others or reuse its number. The immutable internal buck ID remains the key for links and photo ownership. Different properties may share the same initials; authorization and book context, not the visible label alone, distinguish them.
4. **Optional nickname.** The edit form offers one optional nickname field, separate from the generated identifier. Trim surrounding whitespace; blank or whitespace-only input clears the nickname, while values over 120 characters are rejected. When present, display `identifier (nickname)` in admin cards, the client/public age-group gallery, the focused viewer, navigation labels, and the print manifest. Without a nickname, display the identifier alone. The generated identifier cannot be overwritten through the nickname field. A nickname edit on a published buck becomes visible after save, without changing the book QR destination or buck URL.
5. **Additional photos for an existing buck.** Each buck editor offers **Add photos** with multi-file selection. Every accepted file belongs to that buck as a supporting photo and cannot create a new buck or replace the highlight by accident. Show per-file progress and results. Once ready, supporting photos appear after the highlight in the admin preview and client/public focused viewer. Retain an explicit action to change the highlight to another ready photo, plus photo reordering and removal under the existing publication checks.
6. **Remove descriptive fields and stored prose.** Remove buck field observations, digital descriptions, and editable photo captions from create/edit screens, detail cards, client/public reader views, and new print exports. Do not replace them with another free-text notes field. Keep an accessible image description derived from the buck label and photo position; if a more specific alt-text editor is retained for accessibility, label it clearly as image accessibility text and do not show it as buck prose or a photo caption. As part of the release migration, delete previously stored observations, descriptions, and captions from active buck and image records, then remove the unused fields and access paths. Preserve unrelated report text and files.
7. **Upload validation and recovery.** Keep the current supported JPEG, PNG, WebP, HEIC, and listed camera RAW formats and the 50 MB limit per original. Check extension and size before creating a buck; validate and convert the uploaded image bytes on the server. If conversion fails, discard the unfinished image and its empty new buck so a retry creates only the remaining intended buck. Preserve the original of each successful upload and generate browser-compatible gallery and full-view renditions. A failed file is reported by filename and never appears in a published gallery. The result screen identifies created bucks and failed files; retrying failed files must not recreate successful entries. Preserve the book's existing draft/print-selection workflow; a new buck in a published book cannot become public or print-selected until its highlight is ready. If a published book is edited, successfully saved changes become visible immediately.
8. **Reader and export consistency.** The published book still contains only print-selected bucks, grouped by age, with the same highlights as the print export. Additional photos appear only inside the focused buck viewer, not as extra gallery cards or print-selected bucks. Admin preview, signed-in clients, and signed-out book-QR visitors see the same label and ready-photo order. The export still provides one book-level QR code, not per-buck QR codes. It uses the generated identifier and optional nickname in the manifest and filenames where safe.
9. **Access control.** Only administrators authorized for the property may create or edit bucks or upload photos. Clients and public visitors remain read-only. Existing publication and property-year checks protect new highlights and supporting images, including direct image requests.

### P1 — Should have

1. Offer a batch review screen after processing with a thumbnail, assigned identifier, and ready/failed status for each file, plus a direct link to edit the new buck and add its supporting photos.
2. Let an administrator choose a different ready photo as the highlight without reuploading or changing the buck's identifier.

## Acceptance scenarios

1. For Bradley Clark Farms, an admin selects 28 photos in a known order for one age group. The app creates 28 separate bucks labeled `BCF1` through `BCF28`, each with its selected photo as the highlight. Adding two photos in a different age group creates `BCF29` and `BCF30`; no alphabetic suffix appears.
2. A later survey year for the same property continues the next unused `BCF` number. A different property starts its own sequence at `1`, even if its initials are also `BCF`. Two admins submit batches for the same property at the same time; all successful bucks receive unique identifiers with no overwrite or duplicate assignment.
3. The admin changes buck `BCF1`'s nickname to `Big Boy`. Every admin, client, public, and export label reads `BCF1 (Big Boy)`. Clearing the nickname restores `BCF1`. Moving the buck from one age group to another changes its gallery section but leaves `BCF1` unchanged. The book's QR code and that buck's internal link stay unchanged.
4. The admin selects four additional photos while editing `BCF1`. The buck count does not change. Opening `BCF1` from the published gallery shows its highlight first and all four ready supporting photos in order; other bucks' galleries remain unchanged.
5. A batch contains valid JPEG and HEIC photos, an unsupported file, and a file over 50 MB. Valid files succeed, rejected files show specific reasons, and a retry creates only the remaining intended bucks. A failed or pending image cannot appear as a published highlight.
6. The editor, public reader, client reader, and newly generated print manifest contain no field observations, digital descriptions, or photo captions. A post-migration data check finds no old prose values or unused prose columns in active buck and photo records. Existing historical Reports, including camera-survey PDFs, remain available.
7. On mobile and desktop, the admin can select files, review a batch, see its result, edit a nickname, and add supporting photos without horizontal overflow. A signed-out QR visitor can open only published, selected bucks in that book.

## Non-functional requirements

- **Accessibility:** The file chooser, progress, error summary, nickname field, photo actions, and gallery controls have visible labels, keyboard support, focus states, and screen-reader status announcements. Derived alt text identifies the buck and photo position without inventing observations about the animal.
- **Performance:** Do not render or decode full-size originals to show the batch review or gallery. Process uploads without blocking the interface, report progress per file, and load supporting photos only when their buck is opened. Verify a 100-file batch and a book containing more than 100 bucks on representative desktop and mobile connections before release.
- **Reliability:** Identifier allocation is atomic and scoped to the property across books and age groups. A batch can complete partially without losing successful photos, duplicating them on retry, or leaving a public buck without a ready highlight. Preserve private originals and the current conversion pipeline.
- **Security:** Validate file content and size server-side, keep originals private, and enforce the existing administrator/property and published-reader checks for every new photo.

## Technical considerations and migration

- Store the frozen property prefix, property-wide numeric sequence, structured age-group key, and optional nickname separately from the immutable buck ID. Derive the visible label from prefix and sequence rather than asking an admin to type it. Enforce uniqueness for property + sequence in the database, with a transaction-safe allocator and retry-safe batch bookkeeping. Age-group edits must not write to prefix or sequence.
- Keep the existing one-book-per-property-year model, print-selection controls, book-level QR token, gallery grouping, image processing, and publication boundaries. The current single-add action and UI, editable buck name, observations, description, and photo caption paths need coordinated changes in admin actions, readers, and print export.
- At migration, assign existing bucks property-wide numbers by survey year, print order, creation time, and immutable ID. Preserve each former name as its nickname so a published label remains recognizable after receiving its new identifier. Review already exported print manifests before production rollout because regenerated exports will show the new labels. In the same controlled migration, remove stored buck observations, buck descriptions, and image captions from active records and drop unused columns after all readers, actions, and exports stop depending on them. Verify the data deletion and report retention. Follow the project's ordinary backup-retention policy for pre-migration backups rather than treating them as active application data.
- Build the prefix from the first ASCII letter of each name segment separated by spaces or punctuation. If no usable letters exist, use `P` plus the first six hexadecimal digits of the property's internal ID. Freeze the prefix when issued; renaming the property does not rename bucks.
- Preserve file-selection order as the intended naming order even if conversions complete out of order. If some files fail, the result must show exactly which identifiers were committed and must never assign one identifier to two images.
- Verify the admin workspace, client portal, signed-out public book, book QR, print export, direct image access, and mobile upload/viewer flows in release QA.

## Out of scope

- Automatic buck identification, age estimation, or grouping from image contents.
- Automatically deciding whether two uploaded photos show the same deer; the admin attaches supporting photos after the bulk highlight intake.
- Free-form buck descriptions, observations, photo captions, or other narrative fields.
- Per-buck QR codes, comparison mode, or generating a print-ready PDF.
- Deleting historical Reports or unrelated property/client information.
