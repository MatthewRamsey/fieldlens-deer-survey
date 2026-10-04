# Editable Report Document Details

**Status:** Draft

**Date:** October 4, 2026

**Product:** Upland Wildlife Management admin and client portal

## Overview

Make each report card show one clear, administrator-controlled document title instead of repeating the uploaded file name. Add an **Edit details** action on the admin Reports page so an authorized administrator can correct a document's displayed information without uploading the file again. The client Reports page reflects saved, published changes.

## Problem statement

Report titles currently default to the source file name. A card can also repeat that name in its notes, making the report harder to scan. After upload, an administrator cannot correct the title or other document details; deleting and uploading again is an unnecessary and risky workaround.

## Goals and success measures

1. Each report card displays its title once, followed only by distinct metadata that helps identify the document.
2. An administrator can edit a document's title, category, survey year, visibility, and notes and see the saved values on the card without replacing the stored file.
3. A published, client-visible report reflects saved details in the client portal; an admin-only report stays hidden from clients.
4. Existing document links remain usable after metadata edits unless visibility changes to admin-only or the document is deleted.

## User stories

- As an administrator, I want to rename a report and correct its details so clients see an accurate, readable record.
- As an administrator, I want to remove repetitive text from a report's notes so its card is concise.
- As a client, I want the report title and details to be consistent wherever the report appears.

## Functional requirements

### P0 — Must have

1. **Concise cards.** Show the document title once as the card heading. Show survey year, category, file type, visibility or publication state, upload date, and nonempty notes only where useful to the role. Do not display the original uploaded file name or a second title derived from it on admin or client cards. Do not automatically add an “Original document title” line to notes. Do not silently delete text already stored in historical notes; an admin may remove it through editing.
2. **Admin edit entry point.** Place an **Edit details** button with the existing Open/Preview and Delete actions on each active admin report card. Opening it presents a focused form for that document, prefilled with its current title, category, survey year, visibility, and notes. Provide **Save changes** and **Cancel** actions. Cancel discards unsaved edits.
3. **Editable fields and validation.** Require a nonblank title and category; trim surrounding whitespace, reject control characters, and enforce lengths consistent with the database schema. Let the admin select a valid survey year for the property, change visibility between client-visible and admin-only, and edit or clear notes. Show field-specific validation errors while retaining entered values. File type, upload date, file contents, and storage path are not editable in this form.
4. **Save behavior.** Save all edited metadata for the selected document in one operation. Scope the update to the authenticated admin's managed client and document ID. Refresh the admin card and client view after a successful save; show a concise success message. On failure, show the reason and keep the editor open with entered values. Editing the survey year moves the card to that year's archive view and updates generated document URLs while preserving the document ID and stored file.
5. **Visibility behavior.** Changing a report to client-visible publishes it to the client portal; changing it to admin-only removes it from client lists and blocks direct client access. Reuse the app's existing publication and authorization rules so a metadata edit cannot expose an admin-only document.
6. **Existing data.** Preserve all existing document records and files. Existing titles remain unchanged until an admin edits them. The UI stops showing a separate source-file label immediately, including on older documents.

### P1 — Should have

1. Keep the edited card visible or return the admin to a clear result after changing its survey year, with a link to the destination year's archive.
2. Give the edit form the same responsive layout and keyboard behavior as other admin forms, including focus on the first field when opened and return of focus to **Edit details** when canceled.

## Acceptance scenarios

1. A report card titled “Bradley Clark Fall 2026 Survey Report” shows that title once. Its notes do not gain an automatic copy of the source file name. The original uploaded file name is not presented in either admin or client card UI.
2. An authorized admin edits a report title, category, and notes, saves, and sees the new values on the card. The stored PDF and its document ID are unchanged; **Open document** still opens the same file.
3. The admin moves a report from 2026 to 2025. It disappears from the 2026 archive, appears in 2025, and its generated link uses the new year.
4. The admin makes a published report admin-only. It remains editable in admin Reports but disappears from client Reports, and the previous client link no longer grants access.
5. Blank title, blank category, unsupported year, or a failed update shows an error and does not partially change the document.
6. At phone and desktop widths, the edit controls, report metadata, and actions fit without horizontal scrolling; keyboard users can open, save, and cancel the form.

## Non-functional requirements

- **Security:** Validate the admin role and membership on the server. Keep storage access and client document authorization aligned with the updated visibility.
- **Accessibility:** Use labeled inputs, visible error text, a clear expanded/editing state, and predictable focus. Do not rely on color alone to indicate visibility.
- **Reliability:** Update metadata atomically. Preserve the file and its existing ID. Refresh cached admin and client report views only after a successful update.

## Technical considerations

- The admin and client report cards are rendered in `src/components/deer-survey-app.tsx`. Uploads in `src/app/actions/portal.ts` set `client_documents.title` from the uploaded file's basename; the new edit action updates display metadata without touching `file_path` or storage.
- The edit action should use the same managed-client authorization boundary as document upload and deletion, with a client-account filter on the update query. Revalidate affected report routes and archive views after save.
- Survey-year changes affect `buildDocumentUrl(...)` and archive filtering. Test direct document access after moving the year and after changing visibility.
- Some existing notes were entered with phrases such as “Original document title.” Those are content, not a separate filename field; avoid a destructive data cleanup and let admins revise them.

## Out of scope

- Replacing the uploaded file or editing the PDF's internal content.
- Bulk editing multiple reports.
- Renaming files in storage or changing download filenames solely to match the display title.
- Automatically rewriting historical notes or report titles.

## Open questions

1. Should the document's download filename remain the original upload name, or should downloads use the edited display title? This PRD keeps the stored file and current download behavior unchanged.
2. Should an admin be able to set a separate draft/published status independent of visibility? This PRD follows the current behavior: client-visible is published and admin-only is draft.
