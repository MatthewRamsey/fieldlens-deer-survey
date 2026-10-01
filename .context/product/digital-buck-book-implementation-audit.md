# Digital Buck Book implementation audit

**Updated:** 2026-09-28

The new workflow is deployed at `https://app.uplandwildlifemanagement.com`. The missing database privilege grant was applied and the live editor now loads. This audit maps the PRD's P0 requirements to code and verification. It distinguishes automated fixture coverage from production-user QA.

| PRD requirement | Implementation | Verification |
| --- | --- | --- |
| Book per property/year and publication state | `digital_buck_books` unique property/year key; admin book route and actions | Migration applied; build, browser fixture, and live admin create/publish/unpublish pass |
| Buck identity, age, observations, order | `digital_bucks`, editor, stable UUID URLs | Editor/preview browser fixture pass |
| Multiple images, highlight, web/print variants | Private originals, resumable upload, HEIC/RAW decoding, JPEG renditions, guarded highlight action | JPEG upload/processing and corrupt-image cleanup/retry browser fixture pass; HEIC and DNG/CR2/CR3/NEF/ARW/RAF/ORF/RW2 public samples decode locally |
| Print selection and ordering | `print_selected`, display order, publication constraint trigger | Public RPC and print ZIP fixture contain only selected bucks |
| Index and detail reader | Reader with thumbnails, keyboard/touch controls, observations | Client and signed-out desktop/mobile browser fixture pass |
| Buck QR and stable URL | Book token + immutable buck UUID, SVG QR in ZIP, PNG QR in editor | URL/manifest and browser route checks pass |
| Print assets | ZIP with selected original highlights, non-JPEG print JPEGs, vector QR, manifest | JPEG and PNG original export, print-JPEG pairing, QR, and manifest browser fixture pass; mismatched filename/content still includes print JPEG |
| Publication and immediate edits | Draft preview, atomic publication checks, dynamic public routes, no-store image response | Browser fixture and live QA book pass; caption edit appeared on signed-out page after refresh; unpublish changed direct buck URL to 404 |
| Property/year and image isolation | RLS on new tables, private buckets, membership-checked client list, token-checked edge image delivery | Admin-only policies and authenticated grants verified; fixture isolation and invalid-token production 404 pass; direct client login still untested |
| Legacy replacement | Old navigation/URLs, actions, components, feature flag, and database tables/functions/policies removed; Reports preserved | Route regression browser fixture and live database read-back pass; 13 backed-up Storage objects remain for final removal |

## Lower-priority requirements

| PRD item | Current status |
| --- | --- |
| P1 photo captions and longer buck description | Deployed; browser regression passes; live editor saved both and the client preview and signed-out buck detail rendered them |
| P1 single-buck highlight download and QR regeneration | Deployed; browser regression passes; the live editor rendered a buck QR and an admin-only highlight download control, but the individual file download was not retested live |
| P1 previous/next buck navigation | Implemented in the client and public reader |
| P1 pre-publish warnings | Deployed; missing-highlight warning appeared on the live QA buck before upload and cleared after processing; browser regression passes |
| P2 bulk assignment, comparison, optional classification | Deferred; multiple files can already be added to a buck, but there is no cross-buck assignment or comparison view |

## Release checks completed

- Local production build and Vercel preview/production builds passed.
- ESLint completed with no errors; four unused-variable warnings remain in the shell, legacy survey view, and browser fixture.
- Browser fixture covered admin, client, preview, and signed-out public routes at 320, 390, 430, 768, 844, and desktop widths, including scrolling and navigation.
- The browser fixture uploaded a JPEG through resumable Storage, processed it, and verified the print ZIP and image authorization. It also exported a PNG highlight and verified that both the original PNG and print JPEG were paired in the manifest.
- A corrupt image now reports a specific error, removes its unfinished reservation, and a successful retry appears only once. A three-photo reader exposed thumbnail overflow at 320 px; the fixed layout passed the mobile suite.
- Public sample HEIC converted to JPEG. Public sample DNG, CR2, CR3, NEF, ARW, RAF, ORF, and RW2 files decoded and produced JPEGs with original dimensions.
- Production routes redirect signed-out admin/client visitors and return 404 for unknown book/image tokens. The deployed Supabase image function also returns 404 for an unknown token.
- The earlier production deployment (`dpl_2zspAFkkiLCTbU9z2HuWjoJ7vydh`) passed signed-out route checks at 320, 390, and 844 px widths with no horizontal overflow; invalid public-book and removed Buck book routes returned 404.
- A live admin session confirmed the admin Clients page, property selection, Oak Run overview, client preview, and the published Reports page. The historical Camera survey PDF remained accessible in the client preview.
- The live admin Digital Buck Book route initially failed with digest `1080071389` because authenticated table grants were missing. Migration `20260927124500_grant_digital_buck_tables.sql` was applied after explicit approval. The admin page and client preview then loaded.
- The expanded browser suite passed on Node 22, including admin/client/public flows and phone/desktop layouts. The local and Vercel preview builds passed; production deployment `dpl_52zj2sfvfGy5wATUTN8eqmehuSec` is Ready on the app domain. The post-deploy runtime error scan found no errors.
- A temporary Cedar Ridge 2026 QA book was created through the live UI. A JPEG upload processed, buck description and photo caption saved, draft preview rendered them, publication opened the signed-out index/detail, and an edit to the published caption appeared after refresh. Its ZIP contained the original highlight, buck QR SVG, and manifest. The public buck page loaded its image at 390 and 320 px without horizontal overflow. After unpublishing, its direct URL returned 404. The unpublished QA records and assets await cleanup confirmation.

## Remaining cutover checks

The P1 editor fields, highlight-download route, and publish-review panel passed the local production build, lint (no errors), browser regression, and deployment. The additive database migration and the explicitly approved authenticated table grants are applied. Row-level security on the three new tables still restricts those table operations to admins.

1. Remove the temporary QA book and its stored images after cleanup approval. The Cedar Ridge 2026 QA book is currently published. Sign in on production as a client to verify the real client account rather than the administrator preview and fixture.
2. Exercise a non-JPEG print ZIP export and a near-50 MB file in the hosted environment. Confirm Vercel processing duration and memory. The non-JPEG branch passed in the isolated browser fixture.
3. Delete backed-up legacy media through the Storage API/dashboard and remove the three empty buckets. The database removal migration is applied: the five old tables, three functions, and old Storage policies are absent, and the document category constraint excludes `Buck book`. The verified pre-cutover inventory was 3 galleries, 3 gallery images, 2 camera batches, 8 camera images, 1 annual survey, 0 Buck book documents, and **13** old media objects (3 gallery, 8 camera-batch, 2 survey). Five ZIP archives, row/object metadata, SHA-256 checksums, and a path-level manifest are held in ignored local `backups/legacy-2026-09-27/`. The three general Reports objects and all new Digital Buck Book objects remain.
4. Recheck the signed-in client role and the retained Camera survey report PDFs in production after the database cutover.
5. The PRD's launch-measurement line now has a QR-specific pageview path. New editor and print-export QR codes target `/book/[token]/qr/[buckId]`; ordinary public navigation continues to use `/book/[token]/bucks/[buckId]`. Vercel Web Analytics records pageviews by path, so the QR route can be counted separately on the current Hobby plan without custom events. The production QR page returned 200 on a 390 px headless browser and loaded the analytics script, but the browser was treated as automated traffic and did not send a countable pageview. Verify a real scan appears in the Analytics dashboard before using the count as a launch baseline. Previously printed `/bucks/` QR codes remain valid but cannot be separated from ordinary links retroactively.

## 2026-09-27 code-cutover verification

The dormant legacy components, server actions, routes, data loaders, and feature flag have now been removed. The document uploader accepts only the retained `client-documents` bucket. The browser fixture no longer invents gallery, camera-batch, or camera-survey records; it asserts the old routes return 404. The full `pnpm test:navigation` suite and `pnpm build` passed after this cleanup, including desktop, 320 px and 390 px mobile, signed-in fixture admin/client flows, and signed-out public browsing. Production deployment `dpl_8b1N2Yb38MD4QHCarGudtZLjD8Bo` is Ready on `https://app.uplandwildlifemanagement.com`; the live public book returned 200, old admin/client Buck book paths returned 404, and the admin editor redirected a signed-out visitor to sign-in. The post-deployment Vercel runtime-error scan found no errors in the selected hour.

This does not replace direct production client-account QA or hosted near-50 MB and non-JPEG upload/export checks. The database migration is applied; permanent media deletion awaits action-time confirmation through the dashboard.

## Database cutover and live mobile check

Migration `20260928002412_remove_legacy_camera_and_gallery` was applied to production after the backup checksums and ZIP CRCs were reverified. A read-back found zero old tables, functions, and old Storage policies, with three Camera survey Reports and one published Digital Buck Book preserved. The 13 legacy Storage objects and three buckets remain until their separate Storage-API deletion.

The signed-out production book index and buck detail loaded images without page errors or horizontal overflow at 320, 390, 844, and 1440 px widths. On a simulated 390 px mid-range mobile connection (80 ms latency, 1.6 Mbps download, 750 Kbps upload, 4× CPU slowdown), three fresh browser contexts loaded the book index in 3.09, 2.75, and 2.80 seconds. Navigating from the index to a buck with an image loaded took 0.45, 0.45, and 0.34 seconds. Set initial production targets of under 5 seconds for the index and under 2 seconds for buck detail under this profile. These measurements cover the current two-buck book; retest with a larger production book.

The JPEG rendition pipeline also processed a synthetic 7000×7000 image whose original was 48.13 MiB. It produced a 0.67 MiB web rendition and a full-resolution 41.43 MiB print JPEG in 18.5 seconds locally, both under the 50 MiB Storage limits. This does not verify the hosted resumable upload or hosted conversion duration.

An opt-in isolated browser test (`LARGE_IMAGE_QA=1 pnpm test:navigation`) subsequently passed with a synthetic 47 MiB JPEG at a 390 px viewport, including after the fixture gained multiple selected bucks. It uploaded through the app's resumable Storage path, matched the original byte-for-byte after upload, produced valid web and print JPEGs under the 50 MiB limit, and showed no mobile editor overflow or browser errors. This still does not verify hosted Storage or hosted function limits.

The browser fixture now covers a two-selected, one-unselected book. The public index and print manifest place the two selected bucks in the configured order; the unselected buck's detail URL and image both return 404. Every exported QR SVG in that fixture was rasterized, decoded with `jsqr`, matched to its manifest URL, and followed to a 200 buck page. The complete navigation suite passed after teaching its mock database to honor the same ordering query as PostgREST. This is fixture evidence; a production book's codes still need a scan check before printing.

The hosted admin tab exposed a stale Server Action error after deployment. The editor now replaces that internal error with a reload-and-retry instruction. Build, lint, and browser regression passed; deployment `dpl_AzNhz1UBCf7fusqCspYpAVNhx7EJ` is Ready on the app domain. The public book returned 200 after deployment and the runtime-error scan was clear. The Mac remained locked when the hosted upload retry was attempted, so the retry still needs a signed-in browser session.

An action audit found that a published buck's Remove control warned about breaking its printed QR code while the server rejected the removal. The action now permits a warned removal when another selected buck remains, rejects removal of the last selected buck, and reports any photo-file cleanup failure. The browser fixture removed one of two selected bucks, confirmed its previously decoded QR destination and image returned 404, and confirmed the last selected buck remained. Build, lint, and browser regression passed. Production deployment `dpl_GsThpPgMKTtzYgU6SrTK8bpnDmBx` is Ready; the public book returned 200 and the runtime-error scan found no errors. This deletion test used only isolated fixture records; no production buck was removed.

Removing a supporting photo from a published selected buck now checks that the database deleted a row and reports any Storage cleanup failure. The browser fixture removed a supporting photo and confirmed its public image URL returned 404. Build, lint, and browser regression passed; production deployment `dpl_j3BRVpDohQAJWQCdsp8tp4YEDBdP` is Ready with a 200 public book and a clear runtime-error scan. Again, the removal test used fixture records only.

A valid 40.93 MiB WebP original produced a 57.58 MiB print JPEG at fixed quality 95, exceeding the production print bucket's 50 MiB limit. The processor now tries lower JPEG qualities while keeping the original 8000×8000 dimensions and accepts the first rendition that fits. The isolated browser upload passed with the untouched 41 MiB WebP and a full-resolution 43 MiB print JPEG; build and lint passed. Production deployment `dpl_CJMKyKBizDEU2di7rwpwi2yHCBvk` is Ready and aliased to the app domain. A live public book returned 200, the retired admin Buck book route returned 404, and the post-deploy runtime-error scan found no errors. A hosted admin upload attempt used a stale tab from the prior deployment and failed before image reservation; the tab was refreshed, but the Mac locked before retry. A database read-back found no `rendition-limit.webp` image row and the three new media buckets still held three objects each. Hosted large-file behavior remains unverified.

After the database cutover, the Supabase security advisor flagged the internal `rls_auto_enable()` event-trigger function as executable by public API roles. Migrations `harden_internal_event_trigger_grants` and `pin_timestamp_trigger_search_path` removed `anon`/`authenticated` execution from that helper and fixed the timestamp trigger's search path. A privilege read-back confirms only the owner can execute the event-trigger helper, and the advisor no longer reports either finding. The advisor still flags the book's intentional, token-scoped public RPC as a generic security-definer warning; its publication and token checks remain essential to the signed-out QR flow.

## Property authorization correction

A code audit found that the original Digital Buck Book table and Storage policies used the global admin role alone. Migration `20260928004202_scope_digital_buck_edits_to_managed_properties` now requires an owner/manager membership for the relevant property in book, buck, image, and Storage policies. The highlight-changing RPC checks the same membership; the client book-list RPC requires a property membership. Server actions explicitly check membership before creating or editing books. Under the live `authenticated` role and JWT identity, a property owner saw one book, two bucks, three image rows, and nine private assets; an admin with no membership and a client viewer each saw zero of those admin records and assets. The owner received the published book list, while the unassigned identities received an empty list. The browser regression and build passed, and deployment `dpl_8b1N2Yb38MD4QHCarGudtZLjD8Bo` is Ready with the live public book at 200 and old routes at 404.

## QR-origin pageview measurement

The linked Vercel project has Web Analytics enabled, but its team is on the Hobby plan, where custom events are unavailable. The app now loads `@vercel/analytics` in the root layout. Editor and exported QR assets encode a dedicated, published-only buck-detail URL under `/qr/`; book cards and buck-to-buck links use the ordinary `/bucks/` route. This makes new printed QR arrivals distinguishable in Analytics pageview counts without changing the reader UI. The local browser suite decoded the editor QR PNG and both exported QR SVGs, opened each QR route, returned to the index, and confirmed an unselected buck and a removed buck returned 404 on that route. Build and lint passed. Production deployment `dpl_59L7ddkpAxLr5ZUkYJAcjMhEdXFP` is Ready and aliased to the app domain; the live QR route loaded the published buck at 390 px without horizontal overflow, the Analytics script responded 200, and the runtime-error scan was clear. A real-browser visit is still needed to confirm the first analytics pageview appears in the dashboard; headless Chrome did not transmit an analytics event.
