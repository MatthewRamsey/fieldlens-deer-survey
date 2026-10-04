# Admin Buck Gallery and Client-Defined Buck Prefix

**Status:** Implemented
**Date:** 2026-10-04
**Product:** Upland Wildlife Management admin portal

## Overview

Keep the selected property's annual Digital Buck Book summary, **Add bucks** flow, publication controls, print export, and book QR code at the top of the admin page. Replace the long stack of buck edit forms beneath them with a visual gallery of every buck uploaded for that property, grouped by survey year. Selecting a gallery card opens the existing editing capabilities for that one buck. Add an optional buck-name prefix to the **Add client** form; when provided, the property uses it for future numbered buck identifiers instead of deriving initials from the property name.

## Problem statement

An administrator managing many bucks has to scroll through every buck's fields and photos to find the next deer to edit. The selected-year page also makes bucks from other survey years hard to discover. During client creation, the app always derives the prefix from the property name and does not let the administrator choose a more recognizable abbreviation.

## Goals and success measures

1. For a selected property with at least 100 bucks across multiple survey years, the admin can see one highlight card per buck under the correct year and reach a buck's editor directly from its card, without traversing other buck edit forms.
2. The top-of-page summary and **Add bucks** flow continue to operate on the selected survey year; their publication, QR, print-selection, and export behavior does not change.
3. A new client created with prefix `RFC` receives identifiers `RFC1`, `RFC2`, and so on across survey years and age groups. A client created without a prefix keeps the existing property-name-derived convention.
4. Existing buck identifiers and book links remain stable. Moving a buck between age groups or editing the property name does not rename it; numbers are never reused after removal.

## User stories

- As an administrator, I want to scan highlights from every survey year for one property so I can find a buck visually instead of scrolling through forms.
- As an administrator, I want to open one buck's current editor from its gallery card so I can manage its nickname, age group, book inclusion and order, highlight, and supporting photos.
- As an administrator, I want to set an optional prefix when adding a client so its buck IDs match the abbreviation I use for that property.
- As an administrator, I want the existing automatic prefix when I leave that field blank so client creation stays quick.

## Functional requirements

### P0 — Must have

1. **Preserve annual book controls.** The selected client and survey year continue to determine the book summary, draft/published state, **Add bucks** action, publish/unpublish action, print export, and single book-level QR section. Keep those controls above the gallery. If the selected year has no book, retain the **Create book** action; show any other existing years' bucks in the gallery below it. Adding a batch assigns every new buck to the selected year and updates the gallery without a manual reload.
2. **All-years admin gallery.** Below the annual controls, show all stored bucks for the selected property, including draft and unselected bucks, grouped under survey-year headings in descending year order. Show each buck exactly once using its ready highlight thumbnail, identifier and optional nickname, age group, and a clear selected-for-book status. A buck with no ready highlight gets a labeled placeholder rather than disappearing. Show a buck count per year and an empty state when the property has no bucks. Never mix bucks from another property into the gallery.
3. **Consistent gallery layout.** Use equal-sized cards in a four-column desktop grid, wrapping into additional rows; reduce columns responsively on tablet and phone. A year with one buck still uses one standard-width card. Preserve each image's full content inside a consistent thumbnail frame without stretching or cropping the animal.
4. **Focused buck editing.** Selecting a card opens an editor for only that buck. Provide all current actions: change nickname and age group, set book inclusion and order, save or remove the buck, add or remove supporting photos, change the highlight, and download the highlight where currently allowed. Show the buck's property and survey year in the editor. Provide a clear **All bucks** return action and preserve the prior gallery year/scroll position. The editor must be directly addressable by URL so refresh and browser Back/Forward return to the same buck or gallery. Opening a buck from another year switches the editor's annual context to that buck's year; it must never apply edits or book actions to the previously selected year.
5. **Batch-to-editor path.** After an **Add bucks** batch, each successful result links to that buck's focused editor. The new cards appear in the correct year group. Failed uploads retain their current filename-specific errors and retry behavior; they do not create gallery cards unless a buck record remains and needs cleanup.
6. **Optional prefix on client creation.** Add a labeled **Buck name prefix (optional)** field to the **Add client** form. Accept 1–12 ASCII letters or digits after trimming; normalize letters to uppercase before storing. Show an example such as `RFC` and a short explanation that the app appends a property-wide number. Reject spaces or punctuation within a supplied prefix and values over 12 characters with a field-level error. A blank or whitespace-only field uses the existing first-letter-of-each-property-word derivation and existing fallback for names without letters. The created client's stored prefix, not the editable property display name, determines all later buck identifiers.
7. **Prefix and numbering integrity.** A custom prefix is set at client creation, before the first buck is issued. The existing property-wide atomic sequence continues across survey years and age groups; simultaneous uploads cannot duplicate identifiers. Once created, the prefix remains stable under the current immutable-prefix rule, and deleting a buck does not reuse its number. Existing clients keep their stored prefixes and existing buck names; this release does not rename or renumber historical bucks. Prefixes may match across different properties because property identity and authorization remain separate.
8. **Role boundaries.** Only administrators authorized for the selected property can see its complete admin gallery and edit bucks. The client and signed-out book views continue showing only published, print-selected bucks for their specific property-year book. A gallery card or deep link cannot expose another property's or an unpublished book's private photos to clients or public visitors.

### P1 — Should have

1. Provide a search or filter within the admin gallery for identifier/nickname and age group, while retaining survey-year group headings and a visible way to clear filters.
2. In the focused editor, provide previous/next buck controls in the gallery's visible order so an administrator can review several bucks without returning to the gallery each time.

## Acceptance scenarios

1. A property has bucks in 2025 and 2026, including one unselected buck and one without a ready highlight. The admin opens its 2026 page and sees the 2026 book controls at the top, then separate 2026 and 2025 gallery sections containing every stored buck once. The unselected buck is clearly marked; the missing-highlight buck has a placeholder. A single-card year uses the same card width as a four-card year.
2. The admin opens a 2025 buck from the gallery, sees only that buck's edit form and photos with **2025** context, changes its nickname and highlight, saves, then returns to the same gallery position. The 2026 QR, publication state, print order, and other bucks are unchanged. Refresh and Back/Forward preserve the intended gallery/editor route.
3. The admin adds three 2026 highlights in one batch. Three new cards appear in the 2026 group; each successful result opens its editor. A failed file remains labeled for retry and does not duplicate a successful buck.
4. Creating `Ramsey Farms` with custom prefix `rfc` stores `RFC`. Its first two bucks are `RFC1` and `RFC2`; a later-year buck becomes `RFC3`. Creating `Bradley Clark Farms` with the prefix blank produces `BCF1`. An invalid `R F` or a 13-character prefix is rejected without creating the client.
5. Renaming the property or changing a buck's age group leaves existing identifiers unchanged. Two simultaneous batches receive distinct numbers. An existing client's stored prefix and identifiers do not change during migration.
6. At 320 px, 390 px, tablet, and desktop widths, gallery cards have consistent thumbnail frames, no horizontal overflow, usable tap targets, and a keyboard path into and out of the focused editor. A client and a signed-out QR visitor still see only their permitted published book content.

## Non-functional requirements

- **Accessibility:** Year groups use headings; every card is a keyboard-operable link with an accessible name containing the buck identifier, nickname when present, and survey year. Status and missing-image states are conveyed in text, not color alone. Opening and closing the editor moves focus predictably.
- **Performance:** Load gallery-sized highlight renditions, not originals or every supporting photo, for the all-years grid. Lazy-load off-screen thumbnails and fetch supporting-photo details only for the opened buck. Browser QA covers at least 100 bucks without an oversized initial image payload or a long stack of editor forms.
- **Security and reliability:** Scope all gallery and edit queries to the administrator's managed property. Preserve existing image processing, upload retries, publication checks, immutable buck IDs, property-wide sequence allocation, and private original storage.

## Technical considerations

- The current admin route loads one book through `getAdminBook(clientSlug, year)` and renders every `BuckEditor` in `DigitalBuckWorkspace`. Add a property-scoped, all-years gallery query that returns book year, buck metadata, and one ready highlight per buck without fetching all originals or supporting-photo records. Keep the selected-year book query for annual controls and load the full image/editor data only for the focused buck.
- `client_accounts.buck_prefix` and `buck_next_number` already exist. The current insert trigger derives a prefix even when one is supplied; update it to accept a validated custom value while preserving the default derivation, immutability, and existing sequence allocator. The create-client server action must pass the optional prefix on both the first insert and its duplicate-slug retry.
- Keep the annual book ID, public token, print-selection rules, export format, client reader, and public QR destination unchanged. A cross-year admin gallery is a management view, not a new public book or combined QR destination.
- Reuse the existing card, button, input, and responsive theme patterns. Allocate each identifier once from the property's stored prefix and sequence, then preserve that identifier on the buck record; display the optional nickname beside it.

## Out of scope

- Replacing the signed-in client or public annual age-group gallery with an all-years gallery.
- Merging different survey-year books, changing their QR codes, or generating a new print layout.
- Editing a client's prefix after creation or renaming historical buck identifiers in this iteration.
- Automatic recognition of the same deer across photos or survey years.

## Open questions

1. Should an administrator be allowed to correct a custom prefix on a newly created client **before the first buck is issued**? This PRD limits prefix entry to client creation and keeps it immutable afterward; allowing a pre-first-buck correction would need a separate validation and audit rule.
2. Should gallery year groups include years with an empty book, or only years that contain at least one buck? The proposed layout shows populated years and relies on the selected-year book controls for an empty year.
