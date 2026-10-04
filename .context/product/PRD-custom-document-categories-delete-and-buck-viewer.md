# Custom Document Categories, Document Deletion, and Buck Photo Viewing

**Status:** Implemented and verified
**Date:** 2026-10-04
**Product:** Upland Wildlife Management admin portal, client portal, and Digital Buck Book

## Overview

Administrators need to name a document's category when uploading reports to a client and remove a document uploaded by mistake. Clients need to move between bucks without scrolling again to see each buck's full photo. This iteration adds free-text document categories, a per-document delete action, and a buck viewer that keeps the selected image fully in view when navigating between bucks.

## Problem statement

The Reports upload form offers only **Camera survey report**, **Map export**, and **Harvest plan**. The server and database reject any other category, so an administrator cannot label a new kind of document accurately. The Reports list has no delete action, leaving incorrect uploads visible to administrators and, when published, clients. In the Digital Buck Book, moving to another buck can leave part of its photo below the visible area, requiring another scroll on each buck.

## Goals and success measures

1. An authorized administrator can enter a new category name and upload a document without choosing one of the existing three labels. The saved label appears consistently in the admin Reports list and the client's published Reports view.
2. An authorized administrator can delete an individual document from the selected client's Reports page. After confirmation, that document is absent from admin and client lists, its direct document URL no longer opens, and its stored file is removed.
3. On a supported desktop or phone viewport, opening a buck or selecting **Previous**/**Next** displays the entire selected photo without an additional vertical scroll. The photo remains uncropped; the reader can still access photo controls and additional images.
4. Existing documents and their categories remain intact through the change. No other client's documents or Digital Buck Book assets are affected by a deletion.

## User stories

- As an administrator, I want to type a document category such as “Habitat assessment” so the document is labeled accurately for my client.
- As an administrator, I want to remove a document I uploaded to the wrong client or year so it no longer appears or opens.
- As a client, I want the next buck's entire photo visible when I navigate to it so I can browse the book without repeatedly adjusting the page scroll.
- As a signed-out visitor using the book QR code, I want the same photo-viewing behavior as a signed-in client.

## Functional requirements

### P0 — Must have

1. **Free-text category at upload.** Replace the category-only select with a text entry that accepts a new category name. The field is required for each upload, including multi-file uploads. Trim surrounding whitespace, reject empty or whitespace-only values, and apply a documented maximum of 100 characters. Show validation before submission and enforce the same rules on the server. Store and render the category as plain text; do not interpret it as markup. The three existing category names remain valid, and previously uploaded documents keep their stored labels.
2. **Category consistency.** Save the entered category on every document created by one multi-file submission. Display the saved value in admin and client Reports cards and any other document metadata view. A custom category must not affect survey year, visibility, file type, or publication status.
3. **Per-document deletion.** Add a clearly labeled **Delete document** action to each admin document card, including drafts and published documents. Identify the document by its immutable ID, not by title or category. Before deletion, confirm the document title and explain that client access will end. Cancel leaves the document unchanged. A successful delete removes only that document's record and private file, updates report counts and lists without requiring a manual reload, and makes direct document links unavailable. Clients do not see a delete control.
4. **Deletion authorization and failure handling.** The server verifies the signed-in user is an administrator authorized for the document's client property. A forged request for another property's document cannot remove its record or file. If record or storage removal fails, show a specific error rather than a success message and provide a safe retry path; do not silently leave a visible record pointing to a missing file or an accessible orphaned file.
5. **Full-photo navigation.** When a reader opens a buck or follows **Previous**/**Next**, position the active reading surface at the buck header and viewer rather than preserving the prior buck's scroll offset. Size the selected photo within the available viewport height and width while preserving its full aspect ratio (`contain`, no crop), including portrait and landscape photos. A reader must not need to scroll to see the complete selected photo at the start of each buck. Keep the buck label, age, and navigation discoverable; allow normal scrolling to photo thumbnails or other controls when space is limited.
6. **Viewer parity.** Apply the full-photo behavior to signed-in client books and signed-out published book links. Admin preview uses the same interaction where the shared viewer is rendered. Preserve keyboard, touch, and on-screen photo navigation, as well as the gallery's existing return-to-position behavior when selecting **All bucks**.

### P1 — Should have

1. Offer the three existing category names and previously used names as optional suggestions while still allowing any valid new entry. Suggestions must not prevent typing a custom value.
2. After deletion, keep the administrator in the same property and survey-year Reports view and announce the result accessibly.

## Acceptance scenarios

1. An admin uploads two files for one client and year with category “Habitat assessment.” Both appear with that exact category in admin Reports; if published, both appear in the client's Reports view. An empty category is rejected. Uploading with “Map export” still works.
2. The admin starts deleting a published report and cancels. The report remains visible and its link works. The admin confirms deletion of that one report; it disappears from admin and client lists and counts, and its old direct URL and file can no longer be accessed. A neighboring report is unchanged.
3. An admin authorized for Client A attempts to delete a Client B document by submitting its ID directly. The request fails and Client B's record and file remain unchanged. A client account cannot invoke document deletion.
4. On representative desktop and phone viewports, a reader opens the first buck, selects the next buck several times, and sees each selected photo in full without manually scrolling after navigation. Portrait and landscape photos remain uncropped. The same check passes in the client portal and a signed-out public book.
5. A reader advances between additional photos, uses keyboard and touch controls, then returns to **All bucks**. Photo controls still work and the gallery returns to the selected card's prior position.

## Non-functional requirements

- **Accessibility:** The category field and delete action have clear labels and error messages. Deletion confirmation is keyboard operable. Focus moves predictably after a deleted card disappears. Photo navigation preserves accessible names, keyboard operation, and visible focus.
- **Security:** Validate category text server-side; escape it wherever rendered. Enforce per-property authorization for both document records and private storage objects. Deletion must not expose another client's documents or files.
- **Reliability:** Handle partial database/storage deletion explicitly and make retries idempotent. The viewer must not show a blank area or jump unexpectedly while a higher-resolution image loads.
- **Responsive behavior:** Check at least a narrow phone viewport, a typical phone viewport, and a desktop viewport, including short screens and both photo orientations. Do not introduce horizontal overflow.

## Technical considerations

- The current upload form uses a three-option native select; the server action rejects other values, the TypeScript category type is a three-value union, and `client_documents` has a database category check constraint. These must change together. Preserve existing rows and labels during migration.
- Documents live in `client_documents` with private files in the `client-documents` storage bucket. The Reports cards currently expose an open/preview link but no delete action. Implement record and object cleanup through an authorized server path; account for the fact that database and storage removal are separate operations.
- The focused buck viewer is shared by the public book and embedded client/admin views. Its navigation currently changes routes while the photo can extend below the viewport. Verify both the scroll container's position and the viewer's height when choosing the implementation; avoid cropping or downloading full originals just to solve layout.
- Run browser QA for upload validation, existing and new categories, deletion/cancellation/authorization, direct-link revocation, and client/public/admin-preview photo navigation on desktop and mobile.

## Out of scope

- A separate category-management page, category renaming, or changing categories on existing documents.
- Bulk document deletion, replacing a document's file, or restoring a deleted document.
- Changing buck order, the number of photos per buck, or the book's QR and publication rules.

## Decisions

1. Previously used category suggestions come from the selected property. Administrators can still type any valid category.
2. Confirmed document deletion is permanent. If file removal fails, the document is hidden from clients and the administrator can retry cleanup from Reports.

## Verification

The local browser suite covers custom two-file uploads, invalid input, deletion cancellation, successful deletion, a storage failure with retry, direct-link revocation, and photo fitting in admin preview, signed-in client, and public book views. The database migration was applied to a disposable PostgreSQL instance and checked for custom-category acceptance and client access revocation after deletion. Lint and production build passed.
