# Digital Buck Book Gallery and Book-Level QR — Product Requirements Document

**Status:** Draft for product review

**Updated:** 2026-09-28

**Product:** Upland Wildlife Management admin and client portals

**Related specification:** [Digital Buck Book PRD](./PRD-digital-buck-book.md). This document supersedes its per-buck QR, public landing page, gallery presentation, and QR export requirements. Its book ownership, image handling, publication, security, and print-selection requirements remain in force unless explicitly changed here.

## Overview

Each client property's Digital Buck Book has one QR code for each survey year. Scanning it opens that year's published book as a gallery of the selected bucks' highlight photos, organized by age group. Selecting a highlight opens a larger view of that buck and lets the reader browse its additional photos, if any. The administrator previews, downloads, and tests the single book QR; the print package contains that code once, rather than a code for every buck.

The book remains public to people with its QR link, without sign-in. Signed-in clients reach the same gallery through the Digital Buck Book item in their portal sidebar, with an explicit property and survey-year context. Administrators curate the book in their property workspace and preview the client experience before publication. The printed and digital books continue to contain the same print-selected bucks and highlights.

## Problem statement

The current design asks an administrator to manage a separate QR code for every buck and sends a print reader directly to one buck. This creates repetitive print assets and makes it harder to see the year's age structure at a glance. A reader needs one entry point to the whole book, with a clear path from grouped highlights to larger photos of an individual buck.

## Goals and success measures

1. For any client property and survey year, the admin UI and print export provide exactly one QR asset and one stable book-level destination. No buck card offers a buck-specific QR control.
2. Every scan of a published book QR opens the correct property-year gallery. The gallery shows each published, print-selected buck exactly once under an age-group heading and shows no draft or unselected buck.
3. From each gallery highlight, a reader can open a larger view, reach every additional photo for that buck, and return to the same gallery context on desktop and mobile.
4. Release QA decodes every generated book QR, verifies its destination and property/year, and checks published, draft, unpublished, and invalid-token behavior. Measure successful book-QR arrivals separately from ordinary gallery navigation.
5. Admin preview, signed-in client portal, and signed-out QR entry show the same grouped highlights and focused-photo behavior for a published book. Only the administrator can edit, publish, or download print assets.

## User stories

- As an administrator, I want one QR code for a property's annual book so I can place a single reusable asset in the print layout.
- As a print reader, I want a scan to open all of that year's selected bucks by age group so I can compare the highlights before choosing one to inspect.
- As a client, I want to enlarge a buck's highlight and move through its other photos so I can see the full set without losing my place in the book.
- As an administrator, I want to preview the published gallery and test the QR destination before sending the code to print.
- As a signed-in client, I want the Digital Buck Book in my property's familiar sidebar and year selector so I can browse the right annual gallery without admin controls.

## Functional requirements

### P0 — Must have

1. **One code per book.** The system generates one QR code from the book's stable public token for each client property and survey year. Renaming, reordering, adding, or removing a buck does not change that code or its destination. Different property-year books have different destinations. The encoded URL identifies the book, not a buck or a temporary image URL.
2. **Admin QR controls.** The book-level workspace provides one preview, download, and destination-test control for the book QR. Remove per-buck QR preview, download, and test controls and any copy that tells admins to put a unique QR on each buck page. A draft book may show the code with a clear notice that its public destination opens only after publication.
3. **Print export.** The print package contains exactly one print-quality book QR asset, stored at the package root, plus a manifest field pairing that asset with its book-level destination. Retain one original highlight per selected buck, print-compatible JPEGs where needed, buck identity, age class, observations, and print order. Remove per-buck QR files and per-buck QR destination fields from the manifest. The app continues to supply assets for layout elsewhere; it does not generate a print-ready PDF.
4. **Grouped gallery landing page.** A valid published book QR opens a gallery headed by the property name and survey year. The gallery displays each print-selected buck's highlight, name, and age class once, grouped under clearly labeled age headings. Bucks with no age class remain visible in a clearly labeled unclassified group. Unselected bucks never appear. The group order and label rules are resolved in Open Questions; within each group, preserve the admin's relative buck order.
5. **Focused buck viewer.** Selecting a highlight opens a larger, uncropped presentation of that buck's highlight. The viewer shows the buck name and age group, then allows navigation through every ready additional photo in the administrator's image order. When a buck has no additional photos, the viewer presents the highlight without empty gallery controls. Retain available descriptions, observations, captions, and meaningful image alt text. The reader can return to the gallery without losing the previous scroll position or age-group context.
6. **Publication and access.** The gallery and focused viewer are available without sign-in only while the book is published. Signed-in clients with access to that property see the same selected content in their portal. Draft, unpublished, unselected, or removed bucks and their private images remain inaccessible through direct URLs and image requests. Unpublishing revokes public gallery and image access immediately.
7. **Live updates.** Changes to a published book's selected bucks, age groups, names, highlight images, and additional photos appear on the gallery and focused viewer immediately after save. The book QR destination stays stable. The system continues to reject a published selected buck without a ready highlight.
8. **Navigation and compatibility.** The gallery is the primary entry point for new book QR codes. Reader links between gallery and buck viewer work with browser Back/Forward and direct linking. Existing per-buck URLs remain governed by the same publication checks; whether previously printed per-buck QR entry routes must remain live is resolved in Open Questions.
9. **Admin workspace and preview.** The existing admin Digital Buck Book sidebar item remains scoped to the selected property and survey year. Administrators can continue creating bucks, assigning age classes, selecting and ordering print bucks, managing highlights and supporting photos, and publishing or unpublishing the book. The book-level QR controls sit with book-level actions, not in each buck card. An administrator can preview the grouped gallery and focused viewer inside the client-style preview shell before publishing; draft content visible there is never exposed by the public QR route or to a signed-in client.
10. **Signed-in client portal.** The existing client Digital Buck Book sidebar item opens the grouped gallery for the client's selected property and survey year, using the same navigation, theme, and page layout as the rest of the client portal. When the client has more than one assigned property, provide a visible property selector on this page; the survey-year selector switches books without mixing photos between years. The client view is read-only and contains no QR generation, print export, editing, publishing, or admin-preview controls. If no book is published for the selected year, show a clear empty state with a route back to the client overview; do not reveal draft buck names or images.

### P1 — Should have

1. Display a count of selected bucks in each age group and the total count for the book.
2. Allow previous/next buck navigation from the focused viewer in gallery group order, while keeping photo navigation distinct.
3. Let an administrator inspect how a buck will appear in its age group before publication, with warnings for missing age class or broken highlight renditions.

### P2 — Nice to have

1. Let readers jump to an age group from a compact gallery index when a book contains many bucks.
2. Provide an optional enlarged side-by-side comparison of two highlight images within an age group.

## Acceptance scenarios

1. An admin publishes a 2026 book for Property A and a 2026 book for Property B. Each export contains one QR asset. Scanning A's code opens A's 2026 grouped gallery and never reveals B's images; scanning B's opens B's gallery. A 2027 book for A gets a different destination.
2. A book contains two age-3 bucks, one age-4 buck, one selected buck without an age class, and one unselected buck. The public gallery shows the four selected highlights exactly once in the appropriate groups; the unselected buck and image return 404 by direct public URL.
3. A reader opens a buck with one highlight and four additional photos, views all five in order, then returns to the same gallery position. A buck with only a highlight has no inactive additional-photo controls. The flow works with mouse, keyboard, touch, and a screen reader.
4. After publication, an admin changes a buck's age class, highlight, or selection. The existing book QR still opens the same book. The gallery and viewer reflect the saved change, and a removed or unselected buck's public image is no longer available.
5. A draft or unpublished book QR does not expose the gallery. Invalid tokens and cross-book image URLs do not expose content. A signed-in client only sees books for assigned properties.
6. The print ZIP contains one book QR asset, no buck QR assets, and the same selected buck highlights and metadata shown in the gallery. Decoding the QR opens the book gallery rather than a specific buck.
7. An admin switches between two properties with the sidebar selector and between survey years with the page selector, edits one draft, and previews it in the client-style shell. The preview groups only that book's selected bucks; the other property/year remains unchanged. The draft's book QR still does not expose it publicly.
8. A signed-in client selects an assigned property and published year from the Digital Buck Book page controls. The sidebar page shows the same age groups and focused images as the public gallery, with no admin controls. Switching to an unpublished year shows the empty state. Selecting an unassigned property through a forged URL does not reveal its book.
9. Admin preview, signed-in client, and signed-out QR visitor open the same published buck. The highlight, supporting-photo order, captions, and observations agree across all three views at desktop and mobile widths.

## Non-functional requirements

- **Accessibility:** Use semantic age-group headings, labeled highlight controls, visible focus, keyboard-operable photo navigation, Escape/close behavior for any overlay, and announced photo position. Preserve meaningful alt text and captions.
- **Responsive layout:** The gallery and viewer work at 320 px and larger without horizontal page overflow. On mobile, the enlarged photo and its controls remain reachable and touch targets remain usable.
- **Experience consistency:** Reuse the established admin and client sidebar shells, theme, typography, property context, and survey-year controls. Reader content and interaction patterns match across admin preview, client portal, and public entry; role-specific actions remain confined to their authorized shell.
- **Performance:** Load gallery-sized highlight renditions first; do not download every buck's supporting photos on initial gallery load. Load supporting images only when the buck is opened. Recheck the prior mobile baseline of a gallery under 5 seconds and a focused buck under 2 seconds on a 1.6 Mbps connection with representative book content.
- **Security:** Preserve private original storage, property-scoped editing rights, token-scoped public access, and publication checks on gallery, buck, and image requests. The book QR must not encode private object paths or expiring signed URLs.
- **Reliability:** A broken image cannot silently replace a published highlight. The QR asset must remain scannable at print quality and resolve to the same book after ordinary edits.

## Technical considerations

- Reuse the existing one-book-per-property-year record and stable `public_token`. A book-level QR entry route may render the same gallery as the ordinary book URL while keeping QR-origin pageviews measurable on the current Vercel Analytics plan. The QR path must contain no buck identifier.
- Replace the editor's per-buck QR component and the export's per-buck `buck-qr.svg` entries with one book-level asset and manifest destination. Keep buck IDs for viewer links and image authorization; they are no longer QR payloads.
- Serve smaller gallery and thumbnail renditions for browsing. In the focused viewer, show a usable enlarged preview first and replace it with the full web rendition when that finishes loading.
- Update the existing admin `/admin/digital-buck-book`, admin client preview, and client `/portal/digital-buck-book` flows together. Share the gallery and focused-viewer presentation rather than maintaining divergent role-specific copies. Keep property/year selection and membership checks at the portal route boundary; public QR access remains token-scoped and published-only.
- The current `age_class` value is free text. The product decision on fixed versus free-text groups determines whether the editor needs controlled choices, normalization, or a migration. Until resolved, all saved age values and blank ages must remain visible; silently dropping or merging records is unacceptable.
- Preserve the current supported image formats, 50 MB original limit, renditions, print-selection model, and historical Reports behavior from the related PRD. This iteration changes the reader and QR workflow, not the upload pipeline or ownership model.
- Roll out with browser QA for admin preview, authenticated client, signed-out QR visitor, desktop and mobile widths, scanned export assets, and property/year isolation. Check the behavior of any already distributed per-buck QR codes before removing their route.

## Out of scope

- Generating a print-ready PDF or deciding where the single QR appears in an externally designed printed book.
- QR codes for individual buck pages, images, or age groups.
- Client-side buck editing or photo uploads.
- Automatic age estimation or classification from photographs.
- Reworking image conversion, report PDFs, or unrelated portal navigation.

## Open questions

1. Age groups use the fixed admin-selected values 1 through 5. The gallery sorts them in ascending order and places any legacy unclassified buck last.
2. Have any buck-specific QR codes already been printed or shared? The current build keeps those direct links working for published, selected bucks while generating only book-level QR codes. Confirm how long that compatibility must remain.
3. Should the single book QR be printed once in the physical book, or may the same code be repeated on multiple pages? The app will export one QR asset either way.
4. Should the grouped gallery's age-group order also determine the print export's page order? The current build keeps the existing admin-selected print order independent. Confirm or change this rule.
