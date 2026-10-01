This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Camera survey photo review

The gallery builder, camera survey, camera batch review, related preview tools,
and sample HuntPro analysis are controlled by `FEATURE_CAMERA_TOOLS`. They are
disabled by default. Set `FEATURE_CAMERA_TOOLS=true` and restart or redeploy the
app to make these admin tools available.

Sign in with an admin account, select a client and a specific survey year,
then use **Add photos** or **Add folder** in the camera survey workspace. Each photo
stores buck, doe, and fawn sightings, camera assignment, capture date/time, notes,
and review status. Annual totals sum the photo counts (they are not unique deer
estimates). Mark zero-deer images reviewed using the review checkbox.

Use Left/Right arrows to browse and F/D/S to count bucks/does/fawns. Shift subtracts;
counts never go below zero. Shortcuts can be reassigned under Keyboard shortcuts
and are ignored while typing. Photos are sorted naturally within each import;
matching filename/path, file size, modification time, and camera skip duplicate imports.

Photos are stored in Supabase Storage and survey metadata is stored in Postgres,
scoped by client and year with row-level security. Changes save automatically;
**Save survey** also retries failed writes. Changing clients/years and signing out
are disabled until changes save.
**Export details** downloads JSON containing photo metadata, counts, shortcuts, and
survey notes; it does not contain image files or provide a restore/import workflow.

Authentication, client access, reports, gallery images, camera batches, and survey
counts use Supabase. Copy `.env.example` to `.env.local` and fill in the public
project values. Set `NEXT_PUBLIC_SITE_URL` to the stable production origin so email
confirmation and password-reset links return to the deployed app. Add that origin's
`/auth/confirm` path to the Supabase Auth redirect URL allow list and use the stable
origin as the Supabase Auth Site URL.

### Camera survey browser checks

Run `pnpm build` and `pnpm start --hostname 127.0.0.1 --port 3011`, then in another
terminal run `pnpm test:survey`. Tests use an isolated browser context and installed
Google Chrome. Set `CHROME_PATH` to an alternate Chromium executable, or
`SURVEY_TEST_URL` to test another local server URL. Checks cover persisted images,
counts/notes, keyboard shortcuts, client/year isolation, exports, save-failure
recovery, mobile layout, and hiding the workspace from demo client accounts.

## Admin navigation

The signed-in admin root (`/`) is a compact property overview. Use the sidebar for
Clients (`/admin/clients`), Reports (`/admin/reports`), and Account (`/account`).
When `FEATURE_CAMERA_TOOLS=true`, it also includes Galleries (`/admin/galleries`),
Camera surveys (`/admin/camera-surveys`), and Buck book (`/admin/buck-book`).
Disabled camera routes return 404; non-admin users return to their client portal.
Client and year selections travel in the URL and remain selected across features,
refreshes, and browser history. The admin shell fills the viewport: page content scrolls independently while navigation stays in place. Mobile navigation opens with **Open navigation**, and its menu can scroll independently on short screens. Changing pages or archive filters starts the content at the top.
Survey saves temporarily disable sidebar links, property/year selectors, and sign-out.

Run `pnpm test:navigation` on Node 22+ with Google Chrome installed for isolated
browser regression checks. The test starts local servers on ports 3021 and 3022
and uses a mock Supabase HTTP service; it never reads production credentials or
changes live data. It verifies desktop/mobile routes, query persistence, auth
redirects, feature visibility, empty accounts, archive links, and survey-save
navigation guards. Run `TEST_CAMERA_TOOLS=false pnpm test:navigation` to check the
disabled configuration. Screenshots are written to `/tmp/upland-sidebar-qa`.
These fixture tests supplement, rather than replace, live storage/RLS tests in
`test:survey`, which require separately provisioned disposable accounts.

Mobile regression checks also cover 320px, 390px, 430px, and 768px portrait
viewports plus 844×390 landscape. Assertions inspect element bounds (including
content hidden by page overflow), readable input sizes, empty-state spacing, and
touch opening/closing of navigation and gallery/buck-book viewers. Image viewer
Next/Previous and Close are exercised with populated fixtures on small phones
and in landscape. These are browser-emulated checks, not physical-device tests.
