import assert from 'node:assert/strict';
import { randomFillSync, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServerClient } from '@supabase/ssr';
import sharp from 'sharp';
import JSZip from 'jszip';
import jsQR from 'jsqr';

// Isolated contract fixtures: no production credentials, users, or data are used.
const origin = 'http://127.0.0.1:3021';
const api = 'http://127.0.0.1:3022';
const year = String(new Date().getFullYear());
const older = String(Number(year) - 1);
const bookToken = '11111111-1111-4111-8111-111111111111';
const bookId = '22222222-2222-4222-8222-222222222222';
const buckId = '33333333-3333-4333-8333-333333333333';
const imageId = '44444444-4444-4444-8444-444444444444';
const managedUserId = '55555555-5555-4555-8555-555555555555';
const adminUsersSource = await readFile('supabase/functions/admin-users/index.ts', 'utf8');
const uuidPattern = adminUsersSource.match(/^const uuid = (\/.*\/[a-z]*);$/m)?.[1];
assert.ok(uuidPattern, 'Admin user ID validator is present');
const finalSlash = uuidPattern.lastIndexOf('/');
const validUserId = new RegExp(uuidPattern.slice(1, finalSlash), uuidPattern.slice(finalSlash + 1));
assert.ok(validUserId.test(managedUserId), 'Admin user ID validator accepts a real UUID');
assert.ok(!validUserId.test('not-a-user-id'), 'Admin user ID validator rejects malformed IDs');
const testJpeg = await sharp({ create: { width: 240, height: 180, channels: 3, background: '#3a5038' } }).jpeg().toBuffer();
let publicImageBytes = testJpeg;
const digitalBucks = [{ id: buckId, book_id: bookId, name: 'North Eight', nickname: '', age_class: '4', print_selected: true, display_order: 0 }];
const digitalImages = [{ id: imageId, buck_id: buckId, original_name: 'north-eight.jpg', original_type: 'image/jpeg', original_path: `${bookId}/${buckId}/${imageId}/original.jpg`, web_path: `${bookId}/${buckId}/${imageId}/web.jpg`, print_path: `${bookId}/${buckId}/${imageId}/print.jpg`, byte_size: testJpeg.length, status: 'ready', error_message: null, is_highlight: true, display_order: 0, alt_text: 'Buck at trail camera', caption: '' }];
const extraBooks = [];
const extraBucks = [];
const extraImages = [];
const originals = new Map([[digitalImages[0].original_path, testJpeg]]);
const generatedAssets = new Map();
let bookStatus = 'published';
let tusPath = '';
let tusBytes = Buffer.alloc(0);
let corruptRetryOnce = true;
const accounts = ['north', 'south'].map((slug, index) => ({ id: `account-${index}`, slug, name: `${slug} client`, property_name: `${slug} property`, buck_prefix: `${slug[0].toUpperCase()}P`, buck_next_number: index === 0 ? 2 : 1, county: 'Test County', acreage: 500, is_active: true }));
const documents = [
  ...accounts.flatMap(account => [year, older].map(survey_year => ({ id: `${account.slug}-${survey_year}`, client_account_id: account.id, title: `${account.slug} report ${survey_year}`, category: 'Camera survey report', survey_year, created_at: `${survey_year}-01-01`, file_type: 'pdf', visibility: 'client', status: 'published', notes: 'Navigation fixture', file_path: 'test.pdf' }))),
];
const documentFiles = new Map();
let failDocumentRemovalOnce = false;
function user(role) { return { id: role, email: `${role}@example.test`, user_metadata: {}, app_metadata: role === 'superadmin' ? { super_admin: true } : {}, aud: 'authenticated', created_at: `${year}-01-01` }; }
function session(role) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: role, exp: Math.floor(Date.now()/1000)+3600, role: 'authenticated' })}.fixture`, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, user: user(role) };
}
const backend = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,HEAD,OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Location,Upload-Offset,Tus-Resumable');
  if (req.method === 'OPTIONS') { res.end(); return; }
  const url = new URL(req.url, api);
  const send = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
  let role = 'admin';
  try { role = JSON.parse(Buffer.from(req.headers.authorization.split('.')[1], 'base64url')).sub; } catch {}
  if (url.pathname === '/auth/v1/token') {
    let body = ''; for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body);
    send(session(payload.email ? payload.email.split('@')[0] : 'admin')); return;
  }
  if (url.pathname === '/auth/v1/user') { send(user(role)); return; }
  if (url.pathname === '/auth/v1/logout') { res.statusCode = 204; res.end(); return; }
  if (url.pathname === '/functions/v1/admin-users') {
    if (role !== 'superadmin') { res.statusCode = 403; send({ error: 'Super-admin access required.' }); return; }
    let body = ''; for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body);
    if (!validUserId.test(payload.userId ?? '') || payload.userId !== managedUserId) {
      res.statusCode = 400; send({ error: 'Choose a valid user.' }); return;
    }
    if (payload.action === 'set_password') { send({ success: 'Temporary password set.' }); return; }
    if (payload.action === 'update_account') { send({ success: 'Account details updated.' }); return; }
    res.statusCode = 400; send({ error: 'Unknown action.' }); return;
  }
  if (req.method === 'POST' && url.pathname === '/storage/v1/upload/resumable') {
    const metadata = Object.fromEntries((req.headers['upload-metadata'] ?? '').split(',').map(part => {
      const [key, value] = part.trim().split(' '); return [key, value ? Buffer.from(value, 'base64').toString() : ''];
    }));
    tusPath = metadata.objectName;
    tusBytes = Buffer.alloc(0);
    res.statusCode = 201;
    res.setHeader('Tus-Resumable', '1.0.0');
    res.setHeader('Location', `${api}/storage/v1/upload/resumable/test-upload`);
    res.setHeader('Upload-Offset', '0');
    res.end(); return;
  }
  if (req.method === 'PATCH' && url.pathname === '/storage/v1/upload/resumable/test-upload') {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    tusBytes = Buffer.concat([tusBytes, ...chunks]);
    const targetImage = digitalImages.find(image => image.original_path === tusPath);
    if (targetImage?.original_name === 'retry-once.jpg' && corruptRetryOnce) {
      originals.set(tusPath, Buffer.from('temporary conversion failure'));
      corruptRetryOnce = false;
    } else originals.set(tusPath, tusBytes);
    res.statusCode = 204; res.setHeader('Tus-Resumable', '1.0.0');
    res.setHeader('Upload-Offset', String(tusBytes.length)); res.end(); return;
  }
  if (req.method === 'HEAD' && url.pathname === '/storage/v1/upload/resumable/test-upload') {
    res.statusCode = 200; res.setHeader('Tus-Resumable', '1.0.0'); res.setHeader('Upload-Offset', String(tusBytes.length)); res.end(); return;
  }
  if (req.method === 'POST' && url.pathname.startsWith('/storage/v1/object/digital-buck-')) {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    generatedAssets.set(decodeURIComponent(url.pathname.replace('/storage/v1/object/', '')), Buffer.concat(chunks));
    send({ Key: url.pathname.replace('/storage/v1/object/', '') }); return;
  }
  if (req.method === 'DELETE' && url.pathname.startsWith('/storage/v1/object/digital-buck-')) {
    let body = ''; for await (const chunk of req) body += chunk;
    for (const path of JSON.parse(body).prefixes ?? []) originals.delete(path);
    send([]); return;
  }
  if (req.method === 'POST' && url.pathname.startsWith('/storage/v1/object/client-documents/')) {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    documentFiles.set(decodeURIComponent(url.pathname.replace('/storage/v1/object/client-documents/', '')), Buffer.concat(chunks));
    send({ Key: url.pathname }); return;
  }
  if (req.method === 'DELETE' && url.pathname === '/storage/v1/object/client-documents') {
    if (failDocumentRemovalOnce) { failDocumentRemovalOnce = false; res.statusCode = 500; send({ message: 'Temporary storage failure' }); return; }
    let body = ''; for await (const chunk of req) body += chunk;
    for (const path of JSON.parse(body).prefixes ?? []) documentFiles.delete(path);
    send([]); return;
  }
  if (req.method === 'GET' && url.pathname.startsWith('/storage/v1/object/digital-buck-originals/')) {
    const path = decodeURIComponent(url.pathname.replace('/storage/v1/object/digital-buck-originals/', ''));
    const bytes = originals.get(path);
    if (!bytes) { res.statusCode = 404; res.end('Not found'); return; }
    res.setHeader('Content-Type', 'image/jpeg'); res.end(bytes); return;
  }
  if (req.method === 'GET' && url.pathname.startsWith('/storage/v1/object/digital-buck-print/')) { res.setHeader('Content-Type', 'image/jpeg'); res.end(testJpeg); return; }
  if (url.pathname.startsWith('/storage/v1/object/sign/')) { send({ signedURL: url.pathname.includes('client-documents') ? '/object/public/test.pdf' : '/object/public/test.svg' }); return; }
  if (url.pathname === '/storage/v1/object/public/test.svg') { res.setHeader('Content-Type', 'image/svg+xml'); res.end('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#3a5038"/><text x="30" y="60" fill="white" font-size="24">Mobile QA image</text></svg>'); return; }
  if (url.pathname === '/storage/v1/object/public/test.pdf') { res.setHeader('Content-Type', 'application/pdf'); res.end('%PDF-1.4\nNavigation test'); return; }
  if (url.pathname.startsWith('/storage/v1/object/') && url.pathname.includes('/digital-buck-web/')) { res.setHeader('Content-Type', 'image/jpeg'); res.end(testJpeg); return; }
  if (url.pathname === '/functions/v1/digital-buck-image') {
    const token = url.searchParams.get('token');
    const imageId = url.searchParams.get('image');
    const primary = bookStatus === 'published' && token === bookToken && digitalImages.some(image => image.id === imageId && image.status === 'ready' && digitalBucks.some(buck => buck.id === image.buck_id && buck.print_selected));
    const secondary = extraBooks.some(book => book.public_token === token && book.status === 'published' && extraImages.some(image => image.id === imageId && image.status === 'ready' && extraBucks.some(buck => buck.id === image.buck_id && buck.book_id === book.id && buck.print_selected)));
    if (!primary && !secondary) { res.statusCode = 404; res.end('Not found'); return; }
    res.setHeader('Content-Type', 'image/jpeg'); res.end(publicImageBytes); return;
  }
  if (url.pathname === '/rest/v1/rpc/get_client_digital_books') {
    let body = ''; for await (const chunk of req) body += chunk;
    const { p_client_id } = JSON.parse(body);
    send(role === 'client' || role === 'admin' ? [
      ...(bookStatus === 'published' && p_client_id === accounts[0].id ? [{ id: bookId, year, token: bookToken }] : []),
      ...extraBooks.filter(book => book.status === 'published' && book.client_account_id === p_client_id).map(book => ({ id: book.id, year: book.survey_year, token: book.public_token })),
    ] : []);
    return;
  }
  if (url.pathname === '/rest/v1/rpc/get_published_digital_book') {
    let body = ''; for await (const chunk of req) body += chunk;
    const { p_token } = JSON.parse(body);
    const book = p_token === bookToken ? { id: bookId, public_token: bookToken, survey_year: year, client_account_id: accounts[0].id, status: bookStatus } : extraBooks.find(entry => entry.public_token === p_token);
    const allBucks = [...digitalBucks, ...extraBucks];
    const allImages = [...digitalImages, ...extraImages];
    send(book?.status === 'published' ? { id: book.id, token: book.public_token, year: book.survey_year, propertyName: accounts.find(account => account.id === book.client_account_id).property_name,
      bucks: allBucks.filter(buck => buck.book_id === book.id && buck.print_selected).sort((a, b) => a.display_order - b.display_order).map(buck => ({ id: buck.id, name: buck.name + (buck.nickname ? ` (${buck.nickname})` : ''), ageClass: buck.age_class,
        images: allImages.filter(image => image.buck_id === buck.id && image.status === 'ready').sort((a, b) => Number(b.is_highlight) - Number(a.is_highlight) || a.display_order - b.display_order).map(image => ({ id: image.id, altText: image.alt_text, isHighlight: image.is_highlight })) })) } : null);
    return;
  }
  if (url.pathname === '/rest/v1/rpc/get_digital_book_image_path') {
    let body = ''; for await (const chunk of req) body += chunk;
    const { p_token, p_image_id } = JSON.parse(body);
    const image = digitalImages.find(entry => entry.id === p_image_id && entry.status === 'ready' && digitalBucks.some(buck => buck.id === entry.buck_id && buck.print_selected));
    send(p_token === bookToken && bookStatus === 'published' ? image?.web_path ?? null : null);
    return;
  }
  if (url.pathname === '/rest/v1/rpc/set_digital_buck_highlight') { send(null); return; }
  if (url.pathname === '/rest/v1/rpc/create_digital_buck_for_photo') {
    let body = ''; for await (const chunk of req) body += chunk;
    const { p_book_id, p_age_class, p_upload_key } = JSON.parse(body);
    const existing = digitalBucks.find(buck => buck.upload_key === p_upload_key);
    if (existing) { const highlight = digitalImages.find(image => image.buck_id === existing.id && image.is_highlight && image.status === 'ready');
      send({ id: existing.id, name: existing.name, created: false, ready: Boolean(highlight), highlightId: highlight?.id ?? null }); return; }
    const book = [{ id: bookId, client_account_id: accounts[0].id, status: bookStatus }, ...extraBooks].find(entry => entry.id === p_book_id);
    const account = accounts.find(entry => entry.id === book?.client_account_id);
    if (!book || !account) { res.statusCode = 403; send({ message: 'Book not found' }); return; }
    const number = account.buck_next_number++;
    const created = { id: randomUUID(), book_id: p_book_id, name: `${account.buck_prefix}${number}`,
      nickname: '', age_class: p_age_class, print_selected: book.status !== 'published',
      display_order: Math.max(-1, ...digitalBucks.filter(buck => buck.book_id === p_book_id).map(buck => buck.display_order)) + 1,
      upload_key: p_upload_key };
    digitalBucks.push(created);
    send({ id: created.id, name: created.name, created: true, ready: false, highlightId: null }); return;
  }
  const table = url.pathname.split('/').at(-1);
  if (table === 'client_documents' && req.method === 'POST') {
    if (role !== 'admin' && role !== 'superadmin') { res.statusCode = 403; send({ message: 'Admin access required' }); return; }
    let body = ''; for await (const chunk of req) body += chunk;
    const entries = JSON.parse(body);
    documents.push(...(Array.isArray(entries) ? entries : [entries]).map(entry => ({ ...entry, created_at: new Date().toISOString(), deleted_at: null })));
    res.statusCode = 201; send([]); return;
  }
  if (table === 'client_documents' && req.method === 'PATCH') {
    if (role !== 'admin' && role !== 'superadmin') { res.statusCode = 403; send({ message: 'Admin access required' }); return; }
    let body = ''; for await (const chunk of req) body += chunk;
    const changes = JSON.parse(body);
    const entry = documents.find(item => item.id === url.searchParams.get('id')?.slice(3) && item.client_account_id === url.searchParams.get('client_account_id')?.slice(3));
    if (entry) Object.assign(entry, changes);
    send([]); return;
  }
  if (table === 'client_documents' && req.method === 'DELETE') {
    if (role !== 'admin' && role !== 'superadmin') { res.statusCode = 403; send({ message: 'Admin access required' }); return; }
    const index = documents.findIndex(item => item.id === url.searchParams.get('id')?.slice(3) && item.client_account_id === url.searchParams.get('client_account_id')?.slice(3));
    const removed = index >= 0 ? documents.splice(index, 1)[0] : null;
    send(req.headers.accept?.includes('application/vnd.pgrst.object+json') ? removed ? { id: removed.id } : null : removed ? [{ id: removed.id }] : []);
    return;
  }
  if (table === 'digital_buck_images' && req.method === 'POST') {
    let body = ''; for await (const chunk of req) body += chunk;
    const value = JSON.parse(body);
    digitalImages.push({ ...value, web_path: null, print_path: null, status: 'pending', error_message: null, is_highlight: false, alt_text: '', caption: '' });
    res.statusCode = 201; send([]); return;
  }
  if (table === 'digital_buck_images' && req.method === 'PATCH') {
    let body = ''; for await (const chunk of req) body += chunk;
    const changes = JSON.parse(body);
    const image = digitalImages.find(entry => entry.id === url.searchParams.get('id')?.slice(3));
    if (image) Object.assign(image, changes);
    send(req.headers.prefer?.includes('return=representation') ? image ? { id: image.id } : null : []); return;
  }
  if (table === 'digital_buck_images' && req.method === 'DELETE') {
    const allowedStatuses = url.searchParams.get('status')?.match(/^in\.\(([^)]+)\)$/)?.[1].split(',');
    const index = digitalImages.findIndex(image => image.id === url.searchParams.get('id')?.slice(3) && (!allowedStatuses || allowedStatuses.includes(image.status)));
    const target = digitalImages[index];
    if (target?.is_highlight && digitalBucks.some(buck => buck.id === target.buck_id && buck.print_selected)) {
      res.statusCode = 400; send({ message: 'Every selected buck in a published book needs a ready highlight.' }); return;
    }
    const deleted = index >= 0 ? digitalImages.splice(index, 1) : [];
    send(req.headers.accept?.includes('application/vnd.pgrst.object+json') ? deleted[0] ? { id: deleted[0].id } : null : deleted.map(({ id }) => ({ id })));
    return;
  }
  if (table === 'digital_bucks' && req.method === 'PATCH') {
    let body = ''; for await (const chunk of req) body += chunk;
    const changes = JSON.parse(body);
    for (const buck of digitalBucks) if (buck.id === url.searchParams.get('id')?.slice(3)) Object.assign(buck, changes);
    send([]); return;
  }
  if (table === 'digital_bucks' && req.method === 'POST') {
    let body = ''; for await (const chunk of req) body += chunk;
    const created = { id: randomUUID(), ...JSON.parse(body) };
    digitalBucks.push(created);
    send({ id: created.id }); return;
  }
  if (table === 'digital_bucks' && req.method === 'DELETE') {
    const id = url.searchParams.get('id')?.slice(3);
    const index = digitalBucks.findIndex(buck => buck.id === id);
    const buck = digitalBucks[index];
    if (buck?.print_selected && digitalBucks.filter(entry => entry.print_selected).length <= 1) {
      res.statusCode = 400; send({ message: 'A published digital buck book needs at least one selected buck.' }); return;
    }
    if (index >= 0) digitalBucks.splice(index, 1);
    for (let i = digitalImages.length - 1; i >= 0; i--) if (digitalImages[i].buck_id === id) digitalImages.splice(i, 1);
    send(buck ? { id: buck.id } : null); return;
  }
  if (table === 'client_accounts' && req.method === 'POST') {
    let body = ''; for await (const chunk of req) body += chunk;
    const entry = JSON.parse(body);
    if (entry.buck_prefix && !/^[A-Z0-9]{1,12}$/.test(entry.buck_prefix)) { res.statusCode = 400; send({ message: 'Invalid buck prefix' }); return; }
    const derived = entry.property_name.split(/[^A-Za-z]+/).filter(Boolean).map(word => word[0].toUpperCase()).join('');
    accounts.push({ ...entry, buck_prefix: entry.buck_prefix || derived, buck_next_number: 1, is_active: true });
    res.statusCode = 201; send([]); return;
  }
  if (table === 'client_memberships' && req.method === 'POST') { res.statusCode = 201; send([]); return; }
  const tables = {
    profiles: [...['admin', 'superadmin', 'client', 'empty'].map(id => ({ id, email: `${id}@example.test`, full_name: id === 'superadmin' ? 'Super Admin' : id === 'client' ? 'Client User' : 'Test Manager', role: id === 'client' ? 'client' : 'admin', default_client_account_id: accounts[0].id })),
      { id: managedUserId, email: 'managedclient@example.test', full_name: 'Managed Client', role: 'client', default_client_account_id: accounts[0].id }],
    client_memberships: role === 'empty' ? [] : accounts.map(a => ({ user_id: role, client_account_id: a.id, membership_role: 'owner' })),
    client_accounts: accounts,
    client_documents: documents,
    digital_buck_books: [{ id: bookId, client_account_id: accounts[0].id, survey_year: year, public_token: bookToken, status: bookStatus }, ...extraBooks],
    digital_bucks: [...digitalBucks, ...extraBucks],
    digital_buck_images: [...digitalImages, ...extraImages],
  };
  if (!(table in tables)) { res.statusCode = 400; send({ message: `Unexpected fixture request: ${url.pathname}` }); return; }
  let rows = tables[table];
  for (const [key, value] of url.searchParams) {
    if (value.startsWith('eq.')) rows = rows.filter(row => String(row[key]) === value.slice(3));
    if (value.startsWith('in.(')) rows = rows.filter(row => value.slice(4,-1).split(',').includes(String(row[key])));
    if (value === 'is.null') rows = rows.filter(row => row[key] == null);
  }
  if (url.searchParams.get('order')?.startsWith('display_order.asc'))
    rows = [...rows].sort((a, b) => a.display_order - b.display_order);
  if (req.method === 'HEAD') {
    res.setHeader('Content-Range', `0-${Math.max(rows.length - 1, 0)}/${rows.length}`);
    res.end(); return;
  }
  send(req.headers.accept?.includes('application/vnd.pgrst.object+json') ? rows[0] ?? null : rows);
});
await new Promise(resolve => backend.listen(3022, '127.0.0.1', resolve));
let logs = '';
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3021'], { env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: api, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'navigation-fixture', NEXT_PUBLIC_SITE_URL: origin }, stdio: ['ignore', 'pipe', 'pipe'] });
app.stdout.on('data', chunk => { logs += chunk; });
app.stderr.on('data', chunk => { logs += chunk; });
let browser;
try {
  for (let i = 0; i < 120; i++) {
    if (app.exitCode !== null) throw new Error(logs);
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(5000) })).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  async function login(role) {
    await context.clearCookies();
    const cookies = [];
    const client = createServerClient(api, 'navigation-fixture', { cookies: { getAll: () => [], setAll: values => cookies.push(...values) } });
    const { error } = await client.auth.signInWithPassword({ email: `${role}@example.test`, password: 'fixture-only' });
    assert.equal(error, null);
    await context.addCookies(cookies.map(({ name, value }) => ({ name, value, url: origin })));
  }
  async function visit(path, heading) {
    const response = await page.goto(origin + path);
    assert.equal(response.status(), 200, path);
    await page.getByRole('heading', { name: heading, exact: true, level: 1 }).waitFor();
    assert.equal(await page.locator('[data-nextjs-dialog]').count(), 0);
  }
  async function auditMobile(label) {
    const failures = [];
    for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(size);
      const issues = await page.locator('main').evaluate(main => {
        const visible = [...main.querySelectorAll('*')].filter(element => element.getBoundingClientRect().width > 0);
        const outside = visible.filter(element => {
          const rect = element.getBoundingClientRect();
          return rect.left < -1 || rect.right > innerWidth + 1;
        }).map(element => `${element.tagName}.${element.className}`);
        const smallInputs = visible.filter(element => element.matches('input:not([type="hidden"]):not([type="checkbox"]):not([type="file"]), select, textarea') && parseFloat(getComputedStyle(element).fontSize) < 16).map(element => element.getAttribute('name') || element.getAttribute('aria-label') || element.tagName);
        return { outside, smallInputs };
      });
      if (size.width < 760 && await page.locator('.portal-mobile-header').count()) {
        const height = await page.locator('.portal-mobile-header').evaluate(element => element.getBoundingClientRect().height);
        assert.ok(height < 200, `${label}: collapsed mobile header must not stretch (${height}px)`);
      }
      if (issues.outside.length || issues.smallInputs.length) failures.push({ label, width: size.width, ...issues });
      if (size.width === 320 || size.width === 844) await page.screenshot({ path: `/tmp/upland-sidebar-qa/${label}-${size.width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.deepEqual(failures, [], `Mobile layout: ${label}`);
  }
  async function verifyIndependentScroll() {
    const main = page.locator('.portal-scroll');
    const navigation = page.viewportSize().width < 768 ? page.locator('.portal-mobile-header') : page.locator('[data-slot="sidebar-container"]');
    const before = await navigation.boundingBox();
    await main.hover();
    await page.mouse.wheel(0, 800);
    await page.waitForFunction(() => document.querySelector('.portal-scroll').scrollTop > 0);
    assert.equal(await page.evaluate(() => window.scrollY), 0, 'The document must not scroll');
    const after = await navigation.boundingBox();
    assert.equal(after.y, before.y, 'Navigation stays in place');
    assert.equal(after.height, before.height);
    assert.ok(await main.evaluate(element => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop > 0 && Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) <= 1;
    }), 'The bottom of the content remains reachable');
    await main.evaluate(element => { element.scrollTop = 0; });
  }
  async function verifyBuckPhotoFits(label) {
    await page.waitForFunction(() => {
      const image = document.querySelector('.digital-book-photo img');
      const viewer = document.querySelector('.digital-book-photo');
      return image?.complete && image.naturalWidth > 0 && viewer?.hasAttribute('style') &&
        viewer.getBoundingClientRect().bottom <= innerHeight + 1;
    });
    const position = await page.locator('.digital-book-photo img').evaluate(image => {
      const imageRect = image.getBoundingClientRect();
      const viewerRect = image.closest('.digital-book-photo').getBoundingClientRect();
      return { imageTop: imageRect.top, imageBottom: imageRect.bottom, viewerTop: viewerRect.top,
        viewerBottom: viewerRect.bottom, imageWidth: imageRect.width, imageHeight: imageRect.height,
        objectFit: getComputedStyle(image).objectFit, viewportHeight: innerHeight };
    });
    assert.ok(position.imageTop >= -1 && position.imageBottom <= position.viewportHeight + 1, `${label}: full image fits viewport ${JSON.stringify(position)}`);
    assert.ok(position.viewerTop >= -1 && position.viewerBottom <= position.viewportHeight + 1, `${label}: viewer fits viewport ${JSON.stringify(position)}`);
    assert.equal(position.objectFit, 'contain', `${label}: the whole photo stays uncropped`);
  }
  async function verifyDesktopShell() {
    await page.setViewportSize({ width: 1920, height: 1000 });
    const geometry = await page.evaluate(() => {
      const rect = selector => {
        const { x, width, right } = document.querySelector(selector).getBoundingClientRect();
        return { x, width, right };
      };
      const sidebar = rect('[data-slot="sidebar-container"]');
      const inset = rect('[data-slot="sidebar-inset"]');
      const scroll = rect('.portal-scroll');
      const logo = rect('.portal-sidebar [data-sidebar="header"] img');
      const portalLabel = rect('.portal-brand-link span');
      const signOut = document.querySelector('.portal-sign-out');
      return { sidebar, inset, scroll, logo, portalLabel, portalLabelAlign: getComputedStyle(document.querySelector('.portal-brand-link span')).textAlign, signOutFont: getComputedStyle(signOut).fontFamily, bodyFont: getComputedStyle(document.body).fontFamily, viewportWidth: innerWidth };
    });
    assert.ok(Math.abs(geometry.logo.x + geometry.logo.width / 2 - (geometry.sidebar.x + geometry.sidebar.width / 2)) < 2, 'Sidebar logo is centered');
    assert.ok(Math.abs(geometry.portalLabel.x + geometry.portalLabel.width / 2 - (geometry.sidebar.x + geometry.sidebar.width / 2)) < 2, 'Sidebar portal label is centered');
    assert.equal(geometry.portalLabelAlign, 'center', 'Sidebar portal text is centered');
    assert.equal(geometry.signOutFont, geometry.bodyFont, 'Sign-out uses the portal body font');
    assert.ok(Math.abs(geometry.scroll.x - geometry.inset.x) < 1, 'Scrollable content begins at the sidebar edge');
    assert.ok(Math.abs(geometry.scroll.right - geometry.viewportWidth) < 1, 'Scrollable content reaches the viewport edge');
    const scroll = page.locator('.portal-scroll');
    if (await scroll.evaluate(element => element.scrollHeight > element.clientHeight)) {
      await page.mouse.move(geometry.inset.x + 8, 500);
      await page.mouse.wheel(0, 600);
      await page.waitForFunction(() => document.querySelector('.portal-scroll').scrollTop > 0);
      await scroll.evaluate(element => { element.scrollTop = 0; });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await login('admin');
  await visit('/', 'Overview');
  assert.equal(await page.getByRole('navigation', { name: 'Admin navigation' }).getByRole('link', { name: 'Users' }).count(), 0);
  assert.equal((await page.goto(`${origin}/admin/users`)).status(), 404);
  await visit('/', 'Overview');
  await mkdir('/tmp/upland-sidebar-qa', { recursive: true });
  await page.screenshot({ path: '/tmp/upland-sidebar-qa/admin-workspace-desktop.png', fullPage: true });
  assert.equal(await page.getByRole('button', { name: 'Add report upload' }).count(), 0);
  assert.equal(await page.getByRole('heading', { name: 'Create a client account' }).count(), 0);
  assert.equal(await page.getByLabel('Workspace', { exact: true }).inputValue(), 'admin');
  assert.deepEqual(await page.getByRole('navigation', { name: 'Admin navigation' }).getByRole('link').allTextContents(), ['Overview', 'Clients', 'Account']);
  const allStats = page.getByRole('region', { name: 'All property statistics' });
  const stat = label => allStats.locator('.metric-card').filter({ hasText: label }).locator('strong');
  assert.equal(await page.getByLabel('All properties survey year').inputValue(), 'Lifetime');
  assert.equal(await stat('Active properties').innerText(), '2');
  assert.equal(await stat('Published reports').innerText(), '4');
  assert.equal(await allStats.locator('.metric-card').filter({ hasText: 'Camera batches' }).count(), 0);
  await page.getByLabel('All properties survey year').selectOption(older);
  await page.waitForURL(`**/?year=${older}`);
  assert.equal(await stat('Published reports').innerText(), '2');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.getByLabel('All properties survey year').inputValue(), older);
  await page.getByLabel('All properties survey year').selectOption('Lifetime');
  await page.waitForURL(origin + '/');
  await page.getByRole('navigation').getByRole('link', { name: 'Clients' }).click();
  await page.getByRole('heading', { name: 'Clients', exact: true, level: 1 }).waitFor();
  const slowWorkspaceRoute = /[?&]client=north(?:&|$)/;
  await page.route(slowWorkspaceRoute, async route => {
    await new Promise(resolve => setTimeout(resolve, 400));
    await route.continue();
  });
  await page.getByLabel('Workspace', { exact: true }).selectOption('north');
  assert.equal(await page.getByLabel('Workspace', { exact: true }).inputValue(), 'north', 'Workspace selection updates before navigation completes');
  await page.waitForURL('**/?client=north');
  await page.unroute(slowWorkspaceRoute);
  assert.equal(await page.getByRole('navigation').getByRole('link', { name: 'Account' }).count(), 0);
  assert.equal(await page.getByRole('navigation').getByRole('link', { name: 'Reports' }).count(), 1);
  await page.getByLabel('Archive view').selectOption(older);
  await page.waitForURL(`**year=${older}`);
  await page.getByRole('navigation').getByRole('link', { name: 'Reports' }).click();
  await page.waitForURL('**/admin/reports?**');
  await page.getByRole('heading', { name: 'Reports', exact: true, level: 1 }).waitFor();
  assert.equal(await page.getByLabel('Archive view').inputValue(), older);
  assert.equal(await page.locator('select[name="survey_year"]').inputValue(), older);
  await page.getByText(`north report ${older}`, { exact: true }).waitFor();
  await page.getByLabel('Workspace', { exact: true }).selectOption('south');
  await page.waitForURL('**/?client=south');
  await page.getByRole('navigation').getByRole('link', { name: 'Reports' }).click();
  await page.getByRole('heading', { name: 'Reports', exact: true, level: 1 }).waitFor();
  await page.getByLabel('Archive view').selectOption(older);
  await page.getByText(`south report ${older}`, { exact: true }).waitFor();
  assert.equal(await page.getByText(`north report ${older}`, { exact: true }).count(), 0);
  await page.getByLabel('Workspace', { exact: true }).selectOption('admin');
  await page.waitForURL(origin + '/');
  await page.getByRole('navigation').getByRole('link', { name: 'Account' }).click();
  await page.waitForURL('**/account');
  await page.getByRole('heading', { name: 'Account', exact: true, level: 1 }).waitFor();
  await page.getByLabel('Workspace', { exact: true }).selectOption('south');
  await page.waitForURL('**/?client=south');
  await page.getByRole('navigation').getByRole('link', { name: 'Reports' }).click();
  await page.waitForURL('**/admin/reports?**');
  await page.getByText(`south report ${year}`, { exact: true }).waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.getByLabel('Workspace', { exact: true }).inputValue(), 'south');
  await page.goBack();
  await page.waitForURL('**/?client=south');
  await page.getByRole('heading', { name: 'Overview', exact: true, level: 1 }).waitFor();
  await page.goForward();
  await page.waitForURL("**/admin/reports?**");
  await page.getByText(`south report ${year}`, { exact: true }).waitFor();
  console.log('PASS: sidebar navigation, upload year, client isolation, account round-trip, reload, back/forward');

  await visit('/admin/clients', 'Clients');
  const northCard = page.getByRole('article', { name: 'north property' });
  assert.equal(await northCard.getByRole('heading', { name: 'north property' }).count(), 1);
  await northCard.getByRole('button', { name: 'Add client login' }).click();
  await northCard.getByRole('heading', { name: 'Manage portal access' }).waitFor();
  await northCard.getByRole('button', { name: 'Close' }).click();
  await northCard.getByRole('button', { name: 'Edit property' }).click();
  await northCard.getByRole('heading', { name: 'Edit property details' }).waitFor();
  await northCard.getByRole('button', { name: 'Close' }).click();
  await northCard.getByRole('button', { name: 'More actions for north property' }).click();
  await page.getByRole('menuitem', { name: 'Archive client' }).click();
  await northCard.getByRole('heading', { name: 'Archive this client' }).waitFor();
  await northCard.getByRole('button', { name: 'Close' }).click();
  await northCard.getByRole('button', { name: 'More actions for north property' }).click();
  await page.getByRole('menuitem', { name: 'Delete client' }).click();
  await northCard.getByRole('heading', { name: 'Delete this client' }).waitFor();
  await northCard.getByRole('button', { name: 'Close' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await northCard.scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/upland-sidebar-qa/client-card-390.png' });
  await northCard.getByRole('button', { name: 'Add client login' }).tap();
  await northCard.getByRole('heading', { name: 'Manage portal access' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/upland-sidebar-qa/client-access-390.png' });
  await northCard.getByRole('button', { name: 'Close' }).tap();
  await page.setViewportSize({ width: 1440, height: 1000 });
  console.log('PASS: clear per-client access, edit, archive, and delete controls');
  await northCard.getByRole('link', { name: 'Preview client view' }).click();
  await page.waitForURL('**/admin/preview/north');
  await page.getByRole('heading', { name: 'Overview', exact: true, level: 1 }).waitFor();
  await page.getByText('Client preview: north property', { exact: true }).waitFor();
  const previewReportsCard = page.getByRole('region', { name: 'Published archive' }).getByRole('link', { name: /Published reports/ });
  assert.match(await previewReportsCard.getAttribute('href'), new RegExp(`section=reports.*year=${year}`));
  assert.equal(await page.getByRole('navigation', { name: 'Admin navigation' }).count(), 0);
  assert.equal(await page.getByRole('navigation', { name: 'Client navigation' }).count(), 1);
  assert.equal(await page.getByRole('heading', { name: 'Profile and security' }).count(), 0);
  assert.equal(await page.getByText(`south report ${year}`, { exact: true }).count(), 0);
  await previewReportsCard.click();
  await page.waitForURL('**/admin/preview/north?section=reports*');
  await page.getByText(`north report ${year}`, { exact: true }).waitFor();
  await page.getByLabel('Archive view').selectOption(older);
  await page.getByText(`north report ${older}`, { exact: true }).waitFor();
  assert.match(page.url(), new RegExp(`year=${older}`));
  await page.getByLabel('Archive view').selectOption(year);
  await page.getByText(`north report ${year}`, { exact: true }).waitFor();
  await auditMobile('admin-client-preview');
  assert.equal(await page.getByRole('navigation', { name: 'Client navigation' }).getByRole('link', { name: 'Buck book', exact: true }).count(), 0);
  assert.equal((await page.goto(`${origin}/admin/preview/north?section=buck-book`)).status(), 404);
  assert.equal((await page.goto(`${origin}/north/${year}/buck-book?preview=north`)).status(), 404);
  assert.equal((await page.goto(`${origin}/north/${year}/folders/test-buck?preview=north`)).status(), 404);
  await page.goto(`${origin}/admin/preview/north`);
  await page.locator('.client-preview-banner').getByRole('link', { name: 'Exit preview' }).click();
  await page.waitForURL('**/admin/clients');
  assert.equal((await page.goto(`${origin}/admin/preview/not-owned`)).status(), 404);
  await page.goto(`${origin}/portal/reports`);
  await page.waitForURL(origin + '/');
  assert.equal(await page.getByRole('navigation', { name: 'Client navigation' }).count(), 0);
  console.log('PASS: authorized read-only client preview, client-only content, retired routes, exit, and unknown-client guard');
  await visit('/admin/clients', 'Clients');
  await verifyDesktopShell();
  await verifyIndependentScroll();
  await page.locator('.portal-scroll').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await page.getByRole('navigation').getByRole('link', { name: 'Overview' }).click();
  await page.getByRole('heading', { name: 'Overview', exact: true, level: 1 }).waitFor();
  assert.equal(await page.locator('.portal-scroll').evaluate(element => element.scrollTop), 0, 'New routes start at the top');
  await visit('/account', 'Account');
  await page.setViewportSize({ width: 390, height: 844 });
  await verifyIndependentScroll();
  await page.getByRole('button', { name: 'Open navigation', exact: true }).tap();
  await page.getByLabel('Workspace', { exact: true }).selectOption('north');
  await page.waitForURL('**/?client=north');
  assert.equal(await page.getByRole('navigation').isVisible(), false);
  await page.getByRole('button', { name: 'Open navigation', exact: true }).tap();
  await page.getByLabel('Workspace', { exact: true }).selectOption('admin');
  await page.waitForURL(origin + '/');
  assert.equal(await page.getByRole('navigation').isVisible(), false);
  await page.getByRole('button', { name: 'Open navigation', exact: true }).tap();
  await page.getByRole('navigation').getByRole('link', { name: 'Overview', exact: true }).tap();
  await page.getByRole('button', { name: 'Open navigation', exact: true }).tap();
  await page.getByRole('navigation').getByRole('link', { name: 'Clients' }).tap();
  await page.getByRole('heading', { name: 'Clients', exact: true, level: 1 }).waitFor();
  assert.equal(await page.locator('.portal-scroll').evaluate(element => element.scrollTop), 0);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).tap();
  await page.getByRole('button', { name: 'Sign out', exact: true }).scrollIntoViewIfNeeded();
  assert.ok(await page.getByRole('button', { name: 'Sign out', exact: true }).evaluate(element => element.getBoundingClientRect().bottom <= innerHeight));
  await page.getByRole('button', { name: 'Close navigation', exact: true }).tap();
  await page.setViewportSize({ width: 1440, height: 1000 });
  console.log('PASS: independent desktop/mobile content scrolling, stationary navigation, reachable content/menu bottom, route scroll reset');

  const sections = [['clients' ,'Clients'], ['reports','Reports']];
  await mkdir('/tmp/upland-sidebar-qa', { recursive: true });
  for (const [path, heading] of sections) {
    await visit(`/admin/${path}?client=north&year=${year}`, heading);
    assert.equal(await page.getByRole('navigation').locator('[aria-current="page"]').innerText().then(s => s.split('\n')[0]), heading);
    await page.screenshot({ path: `/tmp/upland-sidebar-qa/${path}-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.getByRole('navigation').isVisible(), false);
    await page.getByRole('button', { name: 'Open navigation' }).tap();
    assert.equal(await page.getByRole('navigation').isVisible(), true);
    await page.getByRole('navigation').getByRole('link', { name: 'Overview' }).tap();
    await page.getByRole('heading', { name: 'Overview', exact: true, level: 1 }).waitFor();
    assert.equal(await page.getByRole('navigation').isVisible(), false);
    await page.goto(`${origin}/admin/${path}?client=north&year=${year}`);
    await page.getByRole('heading', { name: heading, exact: true, level: 1 }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${path} mobile overflow`);
    await page.screenshot({ path: `/tmp/upland-sidebar-qa/${path}-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await auditMobile(path);
  }
  await visit('/account', 'Account');
  await auditMobile('account');
  await visit('/', 'Overview');
  await auditMobile('overview');
  console.log('PASS: direct feature routes, active navigation, mobile menu, responsive layout');
  await visit('/?client=north', 'Overview');
  await page.screenshot({ path: '/tmp/upland-sidebar-qa/overview-desktop.png', fullPage: true });
  await visit('/admin/reports?client=not-owned&year=invalid', 'Reports');
  assert.equal(await page.getByLabel('Workspace', { exact: true }).inputValue(), 'north');
  assert.equal(await page.getByLabel('Archive view').inputValue(), year);
  await visit('/admin/reports?client=north&year=Lifetime', 'Reports');
  await page.getByText(`north report ${older}`, { exact: true }).waitFor();
  await page.getByText(`north report ${year}`, { exact: true }).waitFor();
  await verifyDesktopShell();
  const report = await context.request.get(`${origin}/north/${year}/documents/north-${year}`);
  assert.equal(report.status(), 200); assert.match(report.headers()['content-type'], /pdf/);
  const categoryField = page.locator('input[name="category"]');
  await categoryField.fill('   ');
  await page.locator('#report-files').setInputFiles({ name: 'invalid.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nInvalid fixture') });
  await page.getByRole('button', { name: 'Add report upload' }).click();
  await page.getByText('Enter a document category of 1–100 characters without control characters.').waitFor();
  assert.equal(documents.filter(entry => entry.title === 'invalid').length, 0);
  assert.equal([...documentFiles.keys()].some(path => path.includes('invalid')), false, 'Invalid category is rejected before file upload');
  await categoryField.fill('  Habitat assessment  ');
  await page.locator('#report-files').setInputFiles([
    { name: 'habitat-a.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nFirst fixture') },
    { name: 'habitat-b.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nSecond fixture') },
  ]);
  await page.getByRole('button', { name: 'Add report upload' }).click();
  await page.getByText('2 documents uploaded.').waitFor();
  assert.deepEqual(documents.filter(entry => entry.title.startsWith('habitat-')).map(entry => entry.category), ['Habitat assessment', 'Habitat assessment']);
  assert.equal([...documentFiles.keys()].filter(path => path.includes('habitat-')).length, 2);
  await login('client');
  await visit(`/portal/reports?client=north&year=${year}`, 'Reports');
  for (const title of ['habitat-a', 'habitat-b'])
    assert.match(await page.locator('.asset-card').filter({ has: page.getByRole('heading', { name: title }) }).innerText(), /Habitat assessment/);
  assert.equal(await page.getByRole('button', { name: 'Delete document' }).count(), 0, 'Clients cannot delete documents');
  await login('admin');
  await visit(`/admin/reports?client=north&year=${year}`, 'Reports');
  const firstCard = page.locator('.asset-card').filter({ has: page.getByRole('heading', { name: 'habitat-a' }) });
  const firstLink = await firstCard.getByRole('link', { name: 'Open document' }).getAttribute('href');
  assert.equal((await context.request.get(origin + firstLink)).status(), 200);
  page.once('dialog', dialog => dialog.dismiss());
  await firstCard.getByRole('button', { name: 'Delete document' }).click();
  assert.equal(await firstCard.count(), 1, 'Cancel leaves the document visible');
  failDocumentRemovalOnce = true;
  page.once('dialog', dialog => dialog.accept());
  await firstCard.getByRole('button', { name: 'Delete document' }).click();
  await page.getByText(/Document hidden, but its file could not be removed/).waitFor();
  await page.getByRole('button', { name: 'Retry deletion' }).waitFor();
  assert.equal((await context.request.get(origin + firstLink)).status(), 404, 'A pending deletion revokes direct access');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Retry deletion' }).click();
  await page.getByText('Document deleted.').waitFor();
  assert.equal(documents.some(entry => entry.title === 'habitat-a'), false);
  assert.equal([...documentFiles.keys()].some(path => path.includes('habitat-a')), false);
  assert.equal(documents.some(entry => entry.title === 'habitat-b'), true, 'Sibling document remains');
  const secondCard = page.locator('.asset-card').filter({ has: page.getByRole('heading', { name: 'habitat-b' }) });
  page.once('dialog', dialog => dialog.accept());
  await secondCard.getByRole('button', { name: 'Delete document' }).click();
  await page.getByText('Document deleted.').waitFor();
  assert.equal([...documentFiles.keys()].some(path => path.includes('habitat-b')), false);
  console.log('PASS: custom multi-file categories, validation, cancel/delete/retry, storage removal, and direct-link revocation');
  await visit('/account?mode=reset', 'Account');
  await page.getByText('Your reset link is active.', { exact: false }).waitFor();
  assert.equal((await page.goto(origin + '/admin/unknown')).status(), 404);
  for (const section of ['galleries','camera-surveys','buck-book']) assert.equal((await page.goto(origin + '/admin/' + section)).status(), 404);
  console.log('PASS: query fallbacks, lifetime archive, document links, reset mode, and retired routes');
  await visit(`/admin/digital-buck-book?client=north&year=${year}`, 'Digital Buck Book');
  assert.equal(await page.locator('.digital-buck-editor').count(), 0, 'Gallery does not render every editor');
  assert.equal(await page.locator('.admin-buck-grid').first().evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length), 4);
  await page.locator('.admin-buck-card').filter({ hasText: 'North Eight' }).click();
  await page.getByRole('button', { name: 'Save buck' }).waitFor();
  await page.getByRole('heading', { name: 'North Eight' }).waitFor();
  const photoGrid = page.locator('.digital-buck-editor').first().locator('.digital-image-grid');
  assert.equal(await photoGrid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length), 4,
    'One admin photo occupies one of four equal desktop columns');
  const adminImage = await context.request.get(`${origin}/api/digital-buck/admin-image/${imageId}`);
  assert.equal(adminImage.status(), 200, `Admin image: ${await adminImage.text()}`);
  const originalHighlight = await context.request.get(`${origin}/api/digital-buck/admin-original/${imageId}`);
  assert.equal(originalHighlight.status(), 200);
  assert.equal((await originalHighlight.body()).compare(testJpeg), 0);
  assert.match(originalHighlight.headers()['content-disposition'], /attachment; filename="north-eight.jpg"/);
  assert.equal(await page.getByLabel('Digital description (optional)').count(), 0);
  assert.equal(await page.getByLabel('Field observations — one per line (optional)').count(), 0);
  await page.getByRole('button', { name: 'Save buck' }).click();
  await page.getByText('Buck saved.').waitFor();
  assert.equal(await page.getByLabel('Photo caption (optional)').count(), 0);
  assert.equal(await page.getByLabel('Image accessibility text (optional)').count(), 0);
  assert.equal(await page.getByLabel('Photo order').count(), 0);
  assert.equal(await page.getByLabel('Book order').count(), 1);
  const firstBuckFields = page.locator('.digital-buck-editor').first().locator('.digital-buck-fields');
  assert.ok(await firstBuckFields.evaluate(fields => {
    const controls = [...fields.children].map(field => field.querySelector('input, select').getBoundingClientRect());
    return Math.max(...controls.map(control => control.top + control.height / 2)) - Math.min(...controls.map(control => control.top + control.height / 2)) <= 3;
  }), 'Buck editor controls align on desktop');
  assert.equal(await page.getByRole('button', { name: 'Show QR code', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Show book QR code' }).count(), 0);
  assert.equal(await page.locator('a[href="#book-qr"]').count(), 0);
  assert.equal(await page.locator('.digital-book-toolbar a').filter({ hasText: 'Preview book' }).getAttribute('href'), `/book/${bookToken}/qr`);
  const bookQrSection = page.getByRole('region', { name: 'Book QR code' });
  await bookQrSection.getByRole('heading', { name: `${year} book QR code` }).waitFor();
  assert.equal(await bookQrSection.locator(`a[href="${origin}/book/${bookToken}/qr"]`).count(), 1);
  const editorQr = bookQrSection.getByRole('img', { name: `QR code for the ${year} north property book` });
  await editorQr.waitFor();
  assert.ok((await bookQrSection.locator('a[download]').getAttribute('href'))?.startsWith('data:image/png;base64,'));
  const editorQrData = await editorQr.getAttribute('src');
  assert.ok(editorQrData?.startsWith('data:image/png;base64,'));
  const { data: editorQrPixels, info: editorQrInfo } = await sharp(Buffer.from(editorQrData.split(',')[1], 'base64'))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(jsQR(new Uint8ClampedArray(editorQrPixels), editorQrInfo.width, editorQrInfo.height)?.data,
    `${origin}/book/${bookToken}/qr`);
  await page.locator('input[type="file"]').setInputFiles({ name: 'additional.jpg', mimeType: 'image/jpeg', buffer: testJpeg });
  try { await page.getByText('additional.jpg ready').waitFor({ timeout: 15000 }); }
  catch (error) { console.error('Upload diagnostic:', await page.locator('.digital-feedback, .digital-image-section [role="status"]').allTextContents(), { imageRows: digitalImages.length, tusPath, uploadedBytes: tusBytes.length }); throw error; }
  await page.waitForFunction(() => document.querySelectorAll('.digital-image-card').length === 2);
  assert.ok(await photoGrid.evaluate(element => {
    const [first, second] = [...element.children].map(child => child.getBoundingClientRect());
    return Math.abs(first.width - second.width) < 1 && Math.abs(first.top - second.top) < 1;
  }), 'Two admin photos stay the same size in one row');
  assert.equal(digitalImages.length, 2);
  const exportResponse = await context.request.get(`${origin}/api/digital-buck/export/${bookId}`);
  assert.equal(exportResponse.status(), 200, await exportResponse.text());
  const printZip = await JSZip.loadAsync(await exportResponse.body());
  const manifest = JSON.parse(await printZip.file('manifest.json').async('string'));
  assert.equal(manifest.bucks.length, 1);
  assert.equal(manifest.bucks[0].buckId, buckId);
  assert.equal(manifest.destinationUrl, `${origin}/book/${bookToken}/qr`);
  assert.equal(manifest.qrFile, 'book-qr.svg');
  assert.equal('qrFile' in manifest.bucks[0], false);
  assert.equal('destinationUrl' in manifest.bucks[0], false);
  assert.ok(printZip.file(manifest.bucks[0].originalHighlight));
  assert.ok(printZip.file(manifest.qrFile));
  assert.equal(Object.keys(printZip.files).filter(name => name.endsWith('-qr.svg')).length, 1);
  assert.equal(Object.keys(printZip.files).filter(name => name.includes('highlight-original')).length, 1, 'Supporting photos stay out of print export');
  await page.locator('input[type="file"]').setInputFiles({ name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('invalid image bytes') });
  await page.getByRole('alert').getByText(/broken.jpg: Could not process/).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.digital-image-card').length === 2);
  assert.equal(digitalImages.filter(image => image.original_name === 'broken.jpg').length, 0, 'Failed upload reservation is removed');
  await page.locator('input[type="file"]').setInputFiles({ name: 'broken.jpg', mimeType: 'image/jpeg', buffer: testJpeg });
  await page.getByText('broken.jpg ready').waitFor();
  assert.equal(digitalImages.filter(image => image.original_name === 'broken.jpg').length, 1, 'Retry creates just one ready photo');
  const highlight = digitalImages[0];
  const originalName = highlight.original_name;
  const originalBytes = originals.get(highlight.original_path);
  const pngBytes = await sharp(testJpeg).png().toBuffer();
  highlight.original_name = 'north-eight.png';
  originals.set(highlight.original_path, pngBytes);
  try {
    const nonJpegResponse = await context.request.get(`${origin}/api/digital-buck/export/${bookId}`);
    assert.equal(nonJpegResponse.status(), 200, await nonJpegResponse.text());
    const nonJpegZip = await JSZip.loadAsync(await nonJpegResponse.body());
    const nonJpegManifest = JSON.parse(await nonJpegZip.file('manifest.json').async('string'));
    assert.ok(nonJpegManifest.bucks[0].originalHighlight.endsWith('.png'));
    assert.ok(nonJpegZip.file(nonJpegManifest.bucks[0].originalHighlight));
    assert.ok(nonJpegZip.file(nonJpegManifest.bucks[0].printJpeg));
    assert.equal((await nonJpegZip.file(nonJpegManifest.bucks[0].printJpeg).async('nodebuffer')).compare(testJpeg), 0);
    highlight.original_name = originalName;
    const mislabeledResponse = await context.request.get(`${origin}/api/digital-buck/export/${bookId}`);
    assert.equal(mislabeledResponse.status(), 200);
    const mislabeledZip = await JSZip.loadAsync(await mislabeledResponse.body());
    const mislabeledManifest = JSON.parse(await mislabeledZip.file('manifest.json').async('string'));
    assert.ok(mislabeledManifest.bucks[0].printJpeg, 'Actual PNG content receives a print JPEG even with a .jpg filename');
  } finally {
    highlight.original_name = originalName;
    originals.set(highlight.original_path, originalBytes);
  }
  assert.equal(await page.getByRole('navigation', { name: 'Admin navigation' }).getByRole('link', { name: 'Digital Buck Book' }).getAttribute('aria-current'), 'page');
  await auditMobile('digital-admin');
  await visit(`/admin/preview/north?section=digital-buck-book&year=${year}`, 'north property');
  await page.getByRole('heading', { name: '4 years old', level: 2 }).waitFor();
  assert.equal(await page.getByRole('button', { name: /Compare highlights/ }).count(), 0);
  await page.getByRole('link', { name: 'View North Eight and its photos' }).click();
  await page.getByRole('img', { name: 'Buck at trail camera' }).waitFor();
  await verifyBuckPhotoFits('admin preview');
  assert.equal(await page.locator('.digital-book-age').textContent(), '4 years old');
  assert.equal(await page.locator('.digital-book-heading h1').innerText(), 'North Eight 4 years old');
  assert.equal(await page.getByText('A familiar buck seen by the north trail.').count(), 0);
  assert.equal(await page.getByText('North trail camera, late summer').count(), 0);
  await page.setViewportSize({ width: 320, height: 568 });
  await verifyBuckPhotoFits('admin preview narrow phone');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await auditMobile('digital-admin-preview');
  bookStatus = 'draft';
  await visit(`/admin/digital-buck-book?client=north&year=${year}`, 'Digital Buck Book');
  assert.equal(await page.locator('.digital-book-toolbar a').filter({ hasText: 'Preview draft' }).getAttribute('href'),
    `/admin/preview/north?section=digital-buck-book&year=${year}`);
  await visit(`/admin/preview/north?section=digital-buck-book&year=${year}`, 'north property');
  await page.getByRole('heading', { name: '4 years old', level: 2 }).waitFor();
  assert.equal((await context.request.get(`${origin}/book/${bookToken}/qr`)).status(), 404);
  assert.equal((await context.request.get(`${origin}/book/${bookToken}/images/${imageId}`)).status(), 404);
  bookStatus = 'published';
  console.log('PASS: Digital Buck Book admin editor, QR preview, draft preview, desktop/mobile layout');
  await login('empty');
  await visit('/', 'Overview');
  await auditMobile('empty-overview');
  assert.equal(await page.getByRole('region', { name: 'All property statistics' }).locator('.metric-card').filter({ hasText: 'Active properties' }).locator('strong').innerText(), '0');
  await page.getByRole('navigation').getByRole('link', { name: 'Clients' }).click();
  await page.getByRole('heading', { name: 'Clients', exact: true, level: 1 }).waitFor();
  await visit('/account', 'Account');
  await login('client');
  assert.equal((await context.request.get(`${origin}/api/digital-buck/admin-original/${imageId}`)).status(), 404);
  assert.equal((await page.goto(`${origin}/admin/preview/north`)).status(), 404);
  await page.goto(origin + '/admin/reports');
  await page.waitForURL(origin + '/');
  assert.equal(await page.getByRole('navigation', { name: 'Admin navigation' }).count(), 0);
  await page.getByRole('navigation', { name: 'Client navigation' }).getByRole('link', { name: 'Reports' }).waitFor();
  bookStatus = 'draft';
  await visit(`/portal/digital-buck-book?client=north&year=${year}`, 'Digital Buck Book');
  await page.getByRole('heading', { name: `No published book for ${year}` }).waitFor();
  assert.equal(await page.getByText('North Eight').count(), 0);
  bookStatus = 'published';
  await visit(`/portal/digital-buck-book?client=north&year=${year}`, 'Digital Buck Book');
  await page.getByRole('link', { name: /North Eight/ }).click();
  await page.getByRole('img', { name: 'Buck at trail camera' }).waitFor();
  await verifyBuckPhotoFits('signed-in client');
  assert.equal(await page.getByText('A familiar buck seen by the north trail.').count(), 0);
  assert.equal(await page.getByText('North trail camera, late summer').count(), 0);
  await page.getByRole('button', { name: 'Next photo' }).click();
  await page.getByText('Photo 2 of 3').waitFor();
  await page.locator('.digital-book-photo-viewer').focus();
  await page.keyboard.press('ArrowLeft');
  await page.getByText('Photo 1 of 3').waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await verifyBuckPhotoFits('signed-in client phone');
  const photoViewer = page.locator('.digital-book-photo-viewer');
  await photoViewer.scrollIntoViewIfNeeded();
  const swipeBox = await photoViewer.boundingBox();
  const touchY = Math.min(700, swipeBox.y + 100);
  const touchSession = await context.newCDPSession(page);
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: swipeBox.x + swipeBox.width * 0.8, y: touchY, id: 1 }] });
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: swipeBox.x + swipeBox.width * 0.2, y: touchY, id: 1 }] });
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.getByText('Photo 2 of 3').waitFor();
  await auditMobile('digital-client-detail');
  await page.getByRole('link', { name: /All bucks/ }).click();
  await page.getByRole('heading', { name: '4 years old', level: 2 }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Show book QR code' }).count(), 0);
  assert.equal(await page.getByRole('link', { name: 'Download book QR' }).count(), 0);
  assert.equal(await page.getByRole('link', { name: 'Download print assets' }).count(), 0);
  assert.equal(await page.getByLabel('Property').inputValue(), 'north');
  await auditMobile('digital-client-index');
  await page.getByLabel('Property').selectOption('south');
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('heading', { name: `No published book for ${year}` }).waitFor();
  assert.equal(await page.getByText('North Eight').count(), 0);
  assert.equal((await page.goto(`${origin}/portal/digital-buck-book?client=not-assigned&year=${year}`)).status(), 404);
  await visit(`/portal/digital-buck-book?client=north&year=${year}`, 'Digital Buck Book');
  await page.getByRole('heading', { name: '4 years old', level: 2 }).waitFor();
  await page.goto(origin + '/');
  assert.equal(await page.getByText('Assigned client', { exact: true }).count(), 0);
  assert.equal(await page.getByLabel('Archive view').inputValue(), year);
  assert.equal(await page.getByRole('region', { name: 'Published archive' }).getByRole('link', { name: /Digital Buck Book/ }).count(), 1);
  await page.screenshot({ path: '/tmp/upland-sidebar-qa/client-overview-desktop.png' });
  await auditMobile('client-portal');
  const clientArchive = page.getByRole('region', { name: 'Published archive' });
  assert.equal(await clientArchive.getByRole('link', { name: /Digital Buck Book/ }).count(), 1);
  await clientArchive.getByRole('link', { name: /Published reports/ }).click();
  await page.waitForURL('**/portal/reports*');
  await page.getByText(`north report ${year}`, { exact: true }).waitFor();
  await page.getByLabel('Archive view').selectOption(older);
  await page.getByText(`north report ${older}`, { exact: true }).waitFor();
  assert.match(page.url(), new RegExp(`year=${older}`));
  await page.getByLabel('Archive view').selectOption(year);
  await page.getByText(`north report ${year}`, { exact: true }).waitFor();
  assert.equal(await page.getByRole('navigation', { name: 'Client navigation' }).getByRole('link', { name: 'Reports' }).getAttribute('aria-current'), 'page');
  await auditMobile('client-reports');
  assert.equal(await page.getByRole('navigation', { name: 'Client navigation' }).getByRole('link', { name: 'Buck book', exact: true }).count(), 0);
  assert.equal((await page.goto(`${origin}/portal/buck-book`)).status(), 404);
  assert.equal((await page.goto(`${origin}/north/${year}/buck-book`)).status(), 404);
  assert.equal((await page.goto(`${origin}/north/${year}/folders/test-buck`)).status(), 404);
  await page.goto(`${origin}/portal/reports`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).tap();
  await page.getByRole('navigation', { name: 'Client navigation' }).getByRole('link', { name: 'Account' }).tap();
  await page.getByRole('heading', { name: 'Account', exact: true, level: 1 }).waitFor();
  await page.getByRole('button', { name: 'Open navigation', exact: true }).tap();
  assert.equal(await page.getByRole('navigation', { name: 'Client navigation' }).getByRole('link', { name: 'Account' }).getAttribute('aria-current'), 'page');
  await page.getByRole('button', { name: 'Sign out', exact: true }).scrollIntoViewIfNeeded();
  assert.ok(await page.getByRole('button', { name: 'Sign out', exact: true }).evaluate(element => element.getBoundingClientRect().bottom <= innerHeight));
  await page.getByRole('button', { name: 'Close navigation', exact: true }).tap();
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.equal((await page.goto(`${origin}/portal/unknown`)).status(), 404);
  await context.clearCookies();
  const publicBook = await page.goto(`${origin}/book/${bookToken}`);
  assert.equal(publicBook.status(), 200);
  await page.getByRole('link', { name: /North Eight/ }).click();
  await page.getByRole('heading', { name: 'North Eight', level: 1 }).waitFor();
  assert.equal((await context.request.get(`${origin}/book/${bookToken}/images/${imageId}`)).status(), 200);
  assert.equal((await context.request.get(`${origin}/book/${bookToken}/images/55555555-5555-4555-8555-555555555555`)).status(), 404);
  assert.equal((await context.request.get(`${origin}/book/66666666-6666-4666-8666-666666666666/bucks/${buckId}`)).status(), 404);
  await auditMobile('digital-public-detail');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.locator('.digital-book-photo-viewer').focus();
  await page.keyboard.press('Escape');
  await page.getByRole('heading', { name: 'north property', level: 1 }).waitFor();
  console.log('PASS: signed-out QR book/index/detail, image authorization, mobile reader');
  await page.goto(`${origin}/portal/reports?client=north&year=${older}`);
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  assert.match(await page.locator('input[name="next"]').inputValue(), /\/portal\/reports\?client=north/);
  await page.goto(`${origin}/admin/preview/north`);
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  assert.match(await page.locator('input[name="next"]').inputValue(), /\/admin\/preview\/north/);
  await page.goto(`${origin}/admin/reports?client=south&year=${older}`);
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  await auditMobile('sign-in');
  assert.match(await page.locator('input[name="next"]').inputValue(), /\/admin\/reports\?client=south/);
  await page.getByLabel('Email', { exact: true }).fill('admin@example.test');
  await page.getByLabel('Password', { exact: true }).fill('fixture-only');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Reports', exact: true, level: 1 }).waitFor();
  assert.equal(await page.getByLabel('Workspace', { exact: true }).inputValue(), 'south');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  await page.goto(`${origin}/account?mode=reset`);
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  assert.equal(await page.locator('input[name="next"]').inputValue(), '/account?mode=reset');
  await page.goto(`${origin}/#error_code=otp_expired&type=recovery`);
  await page.waitForURL('**/auth/confirm#error_code=otp_expired&type=recovery');
  await page.getByRole('heading', { name: 'Reset link unavailable' }).waitFor();
  await page.goto(`${origin}/?token_hash=fixture&type=recovery`);
  await page.waitForURL('**/auth/confirm?token_hash=fixture&type=recovery');
  await page.getByRole('heading', { name: 'Reset link unavailable' }).waitFor();
  await page.goto(`${origin}/#access_token=${session('admin').access_token}&refresh_token=fixture&type=recovery`);
  await page.waitForURL('**/account?mode=reset');
  await page.getByText('Your reset link is active. Enter a new password below to finish the reset.').waitFor();
  await context.clearCookies();
  await login('superadmin');
  await visit('/admin/users', 'Users');
  assert.equal(await page.getByRole('navigation', { name: 'Admin navigation' }).getByRole('link', { name: 'Users' }).getAttribute('aria-current'), 'page');
  await auditMobile('super-admin-users');
  await page.getByLabel('Search users').fill('managedclient@example.test');
  assert.equal(await page.getByRole('button', { name: 'Manage' }).count(), 1);
  await page.getByRole('button', { name: 'Manage' }).click();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(250);
  assert.ok(await page.locator('[data-slot="sheet-content"]').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth + 1 && rect.height <= innerHeight + 1;
  }), 'Super-admin editor fits on a phone');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('textbox', { name: 'Full name' }).fill('Updated Client User');
  await page.getByRole('button', { name: 'Save account details' }).click();
  await page.getByText('Account details updated.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Generate password' }).click();
  assert.ok((await page.locator('input[name="password"]').inputValue()).length >= 16);
  assert.equal(await page.locator('input[name="password"]').getAttribute('type'), 'password');
  await page.getByRole('button', { name: 'Show password' }).click();
  assert.equal(await page.locator('input[name="password"]').getAttribute('type'), 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await page.getByRole('button', { name: 'Set temporary password' }).click();
  await page.getByText('Temporary password set.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close' }).click();
  await context.clearCookies();
  const explorations = await readFile('src/lib/portal-explorations.ts', 'utf8');
  const slugs = [...explorations.matchAll(/slug: "([^"]+)"/g)].map(match => match[1]);
  for (const path of ['/request-access', '/auth/confirm', '/portal-explorations', ...slugs.map(slug => `/portal-explorations/${slug}`)]) {
    const response = await page.goto(origin + path);
    assert.equal(response.status(), 200, path);
    await page.locator('main').first().waitFor();
    assert.ok((await page.locator('main').first().innerText()).length > 30, path);
    assert.equal(await page.locator('[data-nextjs-dialog]').count(), 0, path);
    if (path === '/request-access' || path === '/auth/confirm') await auditMobile(path.slice(1).replaceAll('/', '-'));
  }
  const analysis = await context.request.post(origin + '/api/huntpro/sample-analysis', { data: { photoIndex: 0 } });
  assert.equal(analysis.status(), 404);
  console.log('PASS: account login return, request-access, auth recovery, all exploration pages, anonymous API guard');
  assert.deepEqual(errors, []);
  console.log('PASS: empty admin, client access guard, anonymous login return, sign-out; no browser errors');
  const secondBuckId = '77777777-7777-4777-8777-777777777777';
  const excludedBuckId = '88888888-8888-4888-8888-888888888888';
  const secondImageId = '99999999-9999-4999-8999-999999999999';
  const excludedImageId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  digitalBucks.push(
    { id: secondBuckId, book_id: bookId, name: 'South Nine', age_class: '5', observations: 'Broad chest', description: '', print_selected: true, display_order: -1 },
    { id: excludedBuckId, book_id: bookId, name: 'Draft Ten', age_class: '', observations: '', description: '', print_selected: false, display_order: -2 },
  );
  for (const [id, owner] of [[secondImageId, secondBuckId], [excludedImageId, excludedBuckId]]) {
    const path = `${bookId}/${owner}/${id}/original.jpg`;
    digitalImages.push({ id, buck_id: owner, original_name: `${id}.jpg`, original_type: 'image/jpeg', original_path: path, web_path: `${bookId}/${owner}/${id}/web.jpg`, print_path: `${bookId}/${owner}/${id}/print.jpg`, byte_size: testJpeg.length, status: 'ready', error_message: null, is_highlight: true, display_order: 0, alt_text: '', caption: '' });
    originals.set(path, testJpeg);
  }
  const multiBuckResponse = await page.goto(`${origin}/book/${bookToken}`);
  assert.equal(multiBuckResponse.status(), 200);
  assert.deepEqual(await page.locator('.digital-age-group h2').allTextContents(), ['4 years old', '5 years old']);
  assert.deepEqual(await page.locator('.digital-book-card h3').allTextContents(), ['North Eight', 'South Nine']);
  assert.equal(await page.getByText('Draft Ten').count(), 0);
  assert.equal((await page.goto(`${origin}/book/${bookToken}/bucks/${excludedBuckId}`)).status(), 404);
  assert.equal((await page.goto(`${origin}/book/${bookToken}/qr/${excludedBuckId}`)).status(), 404);
  assert.equal((await context.request.get(`${origin}/book/${bookToken}/images/${excludedImageId}`)).status(), 404);
  assert.equal((await page.goto(`${origin}/book/${bookToken}/bucks/${secondBuckId}`)).status(), 200);
  await page.getByRole('heading', { name: 'South Nine', level: 1 }).waitFor();
  await verifyBuckPhotoFits('public desktop');
  const buckNavigation = page.getByRole('navigation', { name: 'Browse bucks' });
  assert.ok(await buckNavigation.evaluate(element => element.getBoundingClientRect().bottom < document.querySelector('.digital-book-photo-viewer').getBoundingClientRect().top));
  await buckNavigation.getByRole('link', { name: 'Previous: North Eight' }).click();
  await page.getByRole('heading', { name: 'North Eight', level: 1 }).waitFor();
  await verifyBuckPhotoFits('public next buck desktop');
  for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await page.getByRole('navigation', { name: 'Browse bucks' }).getByRole('link', { name: 'Next: South Nine' }).click();
    await page.getByRole('heading', { name: 'South Nine', level: 1 }).waitFor();
    await verifyBuckPhotoFits(`public ${size.width}px next buck`);
    await page.getByRole('navigation', { name: 'Browse bucks' }).getByRole('link', { name: 'Previous: North Eight' }).click();
    await page.getByRole('heading', { name: 'North Eight', level: 1 }).waitFor();
    await verifyBuckPhotoFits(`public ${size.width}px previous buck`);
  }
  publicImageBytes = await sharp({ create: { width: 180, height: 420, channels: 3, background: '#4a5b3d' } }).jpeg().toBuffer();
  await page.reload();
  await verifyBuckPhotoFits('public portrait phone');
  publicImageBytes = testJpeg;
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(await page.getByRole('navigation', { name: 'Browse bucks' }).getByRole('link', { name: 'Next: South Nine' }).count(), 1);
  await login('admin');
  const twoBuckExport = await context.request.get(`${origin}/api/digital-buck/export/${bookId}`);
  assert.equal(twoBuckExport.status(), 200);
  const twoBuckZip = await JSZip.loadAsync(await twoBuckExport.body());
  const twoBuckManifest = JSON.parse(await twoBuckZip.file('manifest.json').async('string'));
  assert.deepEqual(twoBuckManifest.bucks.map(buck => buck.buckId), [secondBuckId, buckId]);
  for (const entry of twoBuckManifest.bucks) {
    assert.ok(twoBuckZip.file(entry.originalHighlight));
    assert.equal('qrFile' in entry, false);
    assert.equal('destinationUrl' in entry, false);
  }
  assert.equal(Object.keys(twoBuckZip.files).filter(name => name.endsWith('-qr.svg')).length, 1);
  const qrAsset = twoBuckZip.file(twoBuckManifest.qrFile);
  assert.ok(qrAsset);
  assert.equal(twoBuckManifest.destinationUrl, `${origin}/book/${bookToken}/qr`);
  const { data: qrPixels, info } = await sharp(await qrAsset.async('nodebuffer'))
    .resize(600, 600, { kernel: 'nearest' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(qrPixels), info.width, info.height);
  assert.equal(decoded?.data, twoBuckManifest.destinationUrl);
  assert.equal((await page.goto(decoded.data)).status(), 200);
  await page.getByRole('heading', { name: 'north property', level: 1 }).waitFor();
  assert.deepEqual(await page.locator('.digital-book-card h3').allTextContents(), ['North Eight', 'South Nine']);
  assert.equal((await context.request.get(`${origin}/book/${bookToken}/qr/${secondBuckId}`)).status(), 200, 'Older buck-specific QR links still open');
  assert.ok(!JSON.stringify(twoBuckManifest).includes(excludedBuckId));
  console.log('PASS: two selected bucks grouped by age, excluded content inaccessible, one book QR decoded and opened');
  const sameAgeBuckId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const unknownAgeBuckId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const extraImageIds = ['dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'];
  digitalBucks.push(
    { id: sameAgeBuckId, book_id: bookId, name: 'North Eight Twin', age_class: '4', observations: '', description: '', print_selected: true, display_order: 1 },
    { id: unknownAgeBuckId, book_id: bookId, name: 'Unknown Age', age_class: '', observations: '', description: '', print_selected: true, display_order: 2 },
  );
  for (const [i, owner] of [sameAgeBuckId, unknownAgeBuckId].entries()) {
    const path = `${bookId}/${owner}/${extraImageIds[i]}/original.jpg`;
    digitalImages.push({ id: extraImageIds[i], buck_id: owner, original_name: `${owner}.jpg`, original_type: 'image/jpeg', original_path: path, web_path: `${bookId}/${owner}/${extraImageIds[i]}/web.jpg`, print_path: `${bookId}/${owner}/${extraImageIds[i]}/print.jpg`, byte_size: testJpeg.length, status: 'ready', error_message: null, is_highlight: true, display_order: 0, alt_text: '', caption: '' });
    originals.set(path, testJpeg);
  }
  await page.goto(`${origin}/book/${bookToken}/qr`);
  assert.deepEqual(await page.locator('.digital-age-group h2').allTextContents(), ['4 years old', '5 years old', 'Unclassified']);
  assert.deepEqual(await page.locator('.digital-book-card h3').allTextContents(), ['North Eight', 'North Eight Twin', 'South Nine', 'Unknown Age']);
  assert.equal(await page.getByText('2 bucks', { exact: true }).count(), 1);
  const firstAgeGroup = page.locator('.digital-age-group').first();
  assert.equal(await firstAgeGroup.getByRole('button', { name: /Compare/ }).count(), 0);
  assert.equal(await page.locator('.digital-book-comparison').count(), 0);
  await auditMobile('digital-public-gallery');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(`#buck-${unknownAgeBuckId}`).getByRole('link').scrollIntoViewIfNeeded();
  const previousScroll = await page.evaluate(() => window.scrollY);
  await page.locator(`#buck-${unknownAgeBuckId}`).getByRole('link').click();
  await page.getByRole('heading', { name: 'Unknown Age', level: 1 }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Next photo' }).count(), 0);
  await page.getByRole('link', { name: /All bucks/ }).click();
  await page.waitForURL(`${origin}/book/${bookToken}`);
  await page.waitForFunction(expected => Math.abs(window.scrollY - expected) < 40, previousScroll);
  await page.waitForFunction(id => document.activeElement === document.querySelector(`#buck-${id} a`), unknownAgeBuckId);
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const id of [sameAgeBuckId, unknownAgeBuckId]) {
    const index = digitalBucks.findIndex(buck => buck.id === id);
    digitalBucks.splice(index, 1);
  }
  for (const id of extraImageIds) {
    const index = digitalImages.findIndex(image => image.id === id);
    originals.delete(digitalImages[index].original_path);
    digitalImages.splice(index, 1);
  }
  console.log('PASS: whole-year and unclassified age groups, gallery jump, single-photo viewer, scroll return, mobile');
  await visit(`/admin/digital-buck-book?client=north&year=${year}`, 'Digital Buck Book');
  await page.locator('.admin-buck-card').filter({ hasText: 'South Nine' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Remove buck' }).click();
  await page.waitForURL(`**/admin/digital-buck-book?client=north&year=${year}`);
  await page.locator('.admin-buck-card').filter({ hasText: 'South Nine' }).waitFor({ state: 'detached' });
  assert.equal((await context.request.get(`${origin}/book/${bookToken}/bucks/${secondBuckId}`)).status(), 404);
  assert.equal((await context.request.get(`${origin}/book/${bookToken}/images/${secondImageId}`)).status(), 404);
  const afterRemoval = await page.goto(`${origin}/book/${bookToken}`);
  assert.equal(afterRemoval.status(), 200);
  assert.deepEqual(await page.locator('.digital-book-card h3').allTextContents(), ['North Eight']);
  await visit(`/admin/digital-buck-book?client=north&year=${year}`, 'Digital Buck Book');
  await page.locator('.admin-buck-card').filter({ hasText: 'North Eight' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Remove buck' }).click();
  await page.getByRole('alert').getByText('Unpublish the book before removing its last selected buck.').waitFor();
  console.log('PASS: warned published-buck removal revokes its old direct link and image; book QR stays valid');
  const supporting = digitalImages.find(image => image.original_name === 'additional.jpg');
  assert.ok(supporting);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.digital-image-card').filter({ hasText: 'additional.jpg' }).getByRole('button', { name: 'Remove photo' }).click();
  await page.getByText('Photo removed.', { exact: true }).waitFor();
  assert.equal(digitalImages.some(image => image.id === supporting.id), false);
  assert.equal((await context.request.get(`${origin}/book/${bookToken}/images/${supporting.id}`)).status(), 404);
  console.log('PASS: published supporting-photo removal revokes its public image');
  const bookCases = [
    { id: '10101010-1010-4010-8010-101010101010', token: '20202020-2020-4020-8020-202020202020', buck: '30303030-3030-4030-8030-303030303030', image: '40404040-4040-4040-8040-404040404040', account: accounts[1], surveyYear: year, name: 'South Eleven' },
    { id: '50505050-5050-4050-8050-505050505050', token: '60606060-6060-4060-8060-606060606060', buck: '70707070-7070-4070-8070-707070707070', image: '80808080-8080-4080-8080-808080808080', account: accounts[0], surveyYear: older, name: 'North Seven' },
  ];
  for (const fixture of bookCases) {
    extraBooks.push({ id: fixture.id, client_account_id: fixture.account.id, survey_year: fixture.surveyYear, public_token: fixture.token, status: 'published' });
    extraBucks.push({ id: fixture.buck, book_id: fixture.id, name: fixture.name, age_class: '3', observations: '', description: '', print_selected: true, display_order: 0 });
    const path = `${fixture.id}/${fixture.buck}/${fixture.image}/original.jpg`;
    extraImages.push({ id: fixture.image, buck_id: fixture.buck, original_name: `${fixture.name}.jpg`, original_type: 'image/jpeg', original_path: path, web_path: `${fixture.id}/${fixture.buck}/${fixture.image}/web.jpg`, print_path: `${fixture.id}/${fixture.buck}/${fixture.image}/print.jpg`, byte_size: testJpeg.length, status: 'ready', error_message: null, is_highlight: true, display_order: 0, alt_text: fixture.name, caption: '' });
    originals.set(path, testJpeg);
  }
  const noHighlightId = '90909090-9090-4090-8090-909090909090';
  extraBucks.push({ id: noHighlightId, book_id: bookCases[1].id, name: 'North Unselected', nickname: '', age_class: '2', print_selected: false, display_order: 1 });
  const destinations = new Set([`${origin}/book/${bookToken}/qr`]);
  await login('admin');
  await visit(`/admin/digital-buck-book?client=north&year=${year}`, 'Digital Buck Book');
  assert.equal(await page.locator('.admin-buck-year').count(), 2);
  assert.equal(await page.locator('.admin-buck-card').count(), digitalBucks.length + extraBucks.filter(buck => buck.book_id === bookCases[1].id).length);
  assert.equal(await page.getByText('South Eleven', { exact: true }).count(), 0, 'Gallery is scoped to the chosen property');
  assert.equal(await page.locator('.admin-buck-card').filter({ hasText: 'North Unselected' }).getByText('No highlight photo').count(), 1);
  await auditMobile('admin-buck-gallery');
  await page.locator('.admin-buck-card').filter({ hasText: 'North Seven' }).click();
  await page.getByRole('heading', { name: 'North Seven' }).waitFor();
  assert.match(page.url(), new RegExp(`year=${older}.*buck=${bookCases[1].buck}`));
  await page.locator('.digital-focused-nav').getByText('All bucks').click();
  await page.locator('.admin-buck-year').first().waitFor();
  assert.match(page.url(), new RegExp(`year=${year}`));
  assert.equal((await page.goto(`${origin}/admin/digital-buck-book?client=north&year=${year}&buck=${bookCases[0].buck}`)).status(), 404);
  console.log('PASS: all-years property gallery, cross-year focused editing, missing highlight, and foreign-buck guard');
  for (const fixture of bookCases) {
    const exported = await context.request.get(`${origin}/api/digital-buck/export/${fixture.id}`);
    assert.equal(exported.status(), 200);
    const zip = await JSZip.loadAsync(await exported.body());
    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
    assert.deepEqual(manifest.bucks.map(entry => entry.buckName), [fixture.name]);
    assert.equal(Object.keys(zip.files).filter(name => name.endsWith('-qr.svg')).length, 1);
    assert.equal(manifest.destinationUrl, `${origin}/book/${fixture.token}/qr`);
    destinations.add(manifest.destinationUrl);
    assert.equal((await page.goto(manifest.destinationUrl)).status(), 200);
    await page.getByRole('heading', { name: fixture.account.property_name, level: 1 }).waitFor();
    assert.deepEqual(await page.locator('.digital-book-card h3').allTextContents(), [fixture.name]);
    assert.equal((await context.request.get(`${origin}/book/${fixture.token}/images/${imageId}`)).status(), 404);
    assert.equal((await context.request.get(`${origin}/book/${bookToken}/images/${fixture.image}`)).status(), 404);
  }
  assert.equal(destinations.size, 3);
  await login('client');
  await visit(`/portal/digital-buck-book?client=south&year=${year}`, 'Digital Buck Book');
  assert.deepEqual(await page.locator('.digital-book-card h3').allTextContents(), ['South Eleven']);
  await visit(`/portal/digital-buck-book?client=north&year=${older}`, 'Digital Buck Book');
  assert.deepEqual(await page.locator('.digital-book-card h3').allTextContents(), ['North Seven']);
  console.log('PASS: distinct property/year QR destinations, exports, public galleries, cross-book image guards, and client selectors');
  if (process.env.PERFORMANCE_QA === '1') {
    const pixels = Buffer.allocUnsafe(1200 * 800 * 3);
    randomFillSync(pixels);
    publicImageBytes = await sharp(pixels, { raw: { width: 1200, height: 800, channels: 3 } }).jpeg({ quality: 55, mozjpeg: true }).toBuffer();
    assert.ok(publicImageBytes.length > 250_000 && publicImageBytes.length < 350_000);
    const benchmarkBucks = Array.from({ length: 12 }, (_, index) => ({ id: randomUUID(), image: randomUUID(), name: `Benchmark Buck ${index + 1}` }));
    for (const [index, fixture] of benchmarkBucks.entries()) {
      digitalBucks.push({ id: fixture.id, book_id: bookId, name: fixture.name, age_class: String(index % 3 + 3), observations: '', description: '', print_selected: true, display_order: index + 1 });
      digitalImages.push({ id: fixture.image, buck_id: fixture.id, original_name: `${fixture.name}.jpg`, original_type: 'image/jpeg', original_path: '', web_path: '', print_path: '', byte_size: publicImageBytes.length, status: 'ready', error_message: null, is_highlight: true, display_order: 0, alt_text: fixture.name, caption: '' });
    }
    const galleryImage = await context.request.get(`${origin}/book/${bookToken}/images/${benchmarkBucks[0].image}?size=gallery`);
    assert.equal(galleryImage.status(), 200);
    const galleryBytes = await galleryImage.body();
    assert.ok(galleryBytes.length < publicImageBytes.length / 2, 'Gallery image is smaller than the focused image');
    const galleryMetadata = await sharp(galleryBytes).metadata();
    assert.ok(galleryMetadata.width <= 720 && galleryMetadata.height <= 480);
    const viewerImage = await context.request.get(`${origin}/book/${bookToken}/images/${benchmarkBucks[0].image}?size=viewer`);
    assert.equal(viewerImage.status(), 200);
    const viewerBytes = await viewerImage.body();
    const viewerMetadata = await sharp(viewerBytes).metadata();
    assert.ok(viewerMetadata.width <= 1440 && viewerMetadata.height <= 1440);
    assert.ok(viewerBytes.length <= publicImageBytes.length, 'Focused viewer image is no larger than the source');
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.clearBrowserCache');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 200_000, uploadThroughput: 200_000 });
    await page.setViewportSize({ width: 390, height: 844 });
    const galleryStart = performance.now();
    assert.equal((await page.goto(`${origin}/book/${bookToken}/qr`, { waitUntil: 'domcontentloaded' })).status(), 200);
    await page.waitForFunction(() => { const image = document.querySelector('.digital-book-card img'); return image?.complete && image.naturalWidth > 0; });
    const galleryMs = performance.now() - galleryStart;
    const focusCard = page.getByRole('link', { name: `View ${benchmarkBucks.at(-1).name} and its photos` });
    await focusCard.scrollIntoViewIfNeeded();
    await focusCard.locator('img').evaluate(image => image.decode());
    await page.waitForLoadState('networkidle');
    const viewerStart = performance.now();
    await focusCard.click();
    await page.waitForURL(`${origin}/book/${bookToken}/bucks/${benchmarkBucks.at(-1).id}`);
    await page.waitForFunction(() => { const image = document.querySelector('.digital-book-photo img'); return image?.complete && image.naturalWidth > 0; });
    const viewerMs = performance.now() - viewerStart;
    await page.waitForFunction(() => document.querySelector('.digital-book-photo img')?.getAttribute('src')?.startsWith('blob:'));
    const fullImageMs = performance.now() - viewerStart;
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    console.log(`Mobile performance: gallery ${Math.round(galleryMs)} ms, focused preview ${Math.round(viewerMs)} ms, viewer image ${Math.round(fullImageMs)} ms, ${Math.round(publicImageBytes.length / 1024)} KiB source images`);
    assert.ok(galleryMs < 5000, `1.6 Mbps mobile gallery: ${Math.round(galleryMs)} ms`);
    assert.ok(viewerMs < 2000, `1.6 Mbps mobile focused buck: ${Math.round(viewerMs)} ms`);
    console.log(`PASS: 13-buck mobile gallery ${Math.round(galleryMs)} ms and usable focused buck ${Math.round(viewerMs)} ms at 1.6 Mbps; viewer image loaded in ${Math.round(fullImageMs)} ms`);
  }
  await login('admin');
  await visit(`/admin/digital-buck-book?client=north&year=${year}`, 'Digital Buck Book');
  assert.equal(await page.locator('#add-buck-form').count(), 0);
  await page.getByRole('button', { name: 'Add bucks', exact: true }).click();
  const addBuckForm = page.locator('#add-buck-form');
  assert.deepEqual(await addBuckForm.getByLabel('Age group').locator('option').allTextContents(),
    ['1 year old', '2 years old', '3 years old', '4 years old', '5 years old']);
  await addBuckForm.getByLabel('Age group').selectOption('5');
  await addBuckForm.locator('input[type="file"]').setInputFiles([
    { name: 'east-eleven.jpg', mimeType: 'image/jpeg', buffer: testJpeg },
    { name: 'east-twelve.jpg', mimeType: 'image/jpeg', buffer: testJpeg },
  ]);
  await addBuckForm.getByText(/2 photos selected/).waitFor();
  await auditMobile('digital-bulk-upload');
  await page.setViewportSize({ width: 390, height: 844 });
  await addBuckForm.getByRole('button', { name: 'Add 2 bucks' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/upland-sidebar-qa/digital-bulk-form-390.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await addBuckForm.getByRole('button', { name: 'Add 2 bucks' }).click();
  await page.getByText('2 of 2 bucks ready.').waitFor();
  assert.equal(await addBuckForm.locator('.digital-batch-results img').count(), 2);
  assert.equal(await addBuckForm.getByRole('link', { name: 'Edit buck' }).count(), 2);
  await page.setViewportSize({ width: 390, height: 844 });
  await addBuckForm.locator('.digital-batch-results').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/upland-sidebar-qa/digital-bulk-results-390.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.admin-buck-card').filter({ hasText: 'NP2' }).waitFor();
  await page.locator('.admin-buck-card').filter({ hasText: 'NP3' }).waitFor();
  assert.deepEqual(digitalBucks.slice(-2).map(buck => buck.name), ['NP2', 'NP3']);
  assert.deepEqual(digitalBucks.slice(-2).map(buck => buck.age_class), ['5', '5']);
  assert.ok(digitalImages.some(image => image.buck_id === digitalBucks.at(-2).id && image.original_name === 'east-eleven.jpg' && image.status === 'ready' && image.is_highlight));
  await page.locator('.admin-buck-card').filter({ hasText: 'NP2' }).click();
  const newBuck = page.locator('.digital-buck-editor').filter({ has: page.getByRole('heading', { name: 'NP2', exact: true }) });
  await newBuck.getByLabel('Nickname (optional)').fill('Big Boy');
  await newBuck.getByLabel('Age group').selectOption('4');
  await newBuck.getByLabel('Include in print and digital book').check();
  await newBuck.getByRole('button', { name: 'Save buck' }).click();
  await page.getByRole('heading', { name: 'NP2 (Big Boy)' }).waitFor();
  assert.equal(digitalBucks.at(-2).name, 'NP2', 'Age changes cannot rename the identifier');
  assert.equal(digitalBucks.at(-2).age_class, '4');
  await page.locator(`[id="upload-${digitalBucks.at(-2).id}"]`).setInputFiles([
    { name: 'np2-side-a.jpg', mimeType: 'image/jpeg', buffer: testJpeg },
    { name: 'np2-side-b.jpg', mimeType: 'image/jpeg', buffer: testJpeg },
  ]);
  await page.getByText('np2-side-b.jpg ready').waitFor();
  assert.equal(digitalImages.filter(image => image.buck_id === digitalBucks.at(-2).id && image.status === 'ready').length, 3,
    'Multiple supporting photos belong to one buck');
  const renamedExport = await context.request.get(`${origin}/api/digital-buck/export/${bookId}`);
  assert.equal(renamedExport.status(), 200);
  const renamedZip = await JSZip.loadAsync(await renamedExport.body());
  const renamedManifest = JSON.parse(await renamedZip.file('manifest.json').async('string'));
  const renamedEntry = renamedManifest.bucks.find(entry => entry.identifier === 'NP2');
  assert.equal(renamedEntry.buckName, 'NP2 (Big Boy)');
  assert.equal(renamedEntry.nickname, 'Big Boy');
  assert.equal('fieldObservations' in renamedEntry, false);
  await page.locator('.digital-focused-nav').getByText('All bucks').click();
  await page.getByRole('button', { name: 'Add bucks', exact: true }).click();
  await addBuckForm.locator('input[type="file"]').setInputFiles({ name: 'retry-once.jpg', mimeType: 'image/jpeg', buffer: testJpeg });
  await addBuckForm.getByRole('button', { name: 'Add 1 buck' }).click();
  await page.getByText('0 of 1 bucks ready. Retry the failed files below.').waitFor();
  assert.equal(digitalBucks.filter(buck => buck.upload_key && !digitalImages.some(image => image.buck_id === buck.id)).length, 0,
    'Failed conversion does not leave an empty buck');
  await addBuckForm.getByRole('button', { name: 'Add 1 buck' }).click();
  await page.getByText('1 of 1 bucks ready.').waitFor();
  assert.equal(digitalImages.filter(image => image.original_name === 'retry-once.jpg' && image.status === 'ready').length, 1);
  await page.goto(`${origin}/book/${bookToken}/qr`);
  await page.getByRole('link', { name: /NP2 \(Big Boy\)/ }).click();
  await page.getByText('Photo 1 of 3').waitFor();
  await page.getByRole('button', { name: 'Next photo' }).click();
  await page.getByRole('button', { name: 'Next photo' }).click();
  await page.getByText('Photo 3 of 3').waitFor();
  await login('client');
  await visit(`/portal/digital-buck-book?client=north&year=${year}`, 'Digital Buck Book');
  await page.getByRole('link', { name: /NP2 \(Big Boy\)/ }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Bulk buck mobile overflow');
  console.log('PASS: bulk age-group upload, property IDs, nickname, age correction, published gallery, mobile width');
  if (process.env.BULK_100_QA === '1') {
    await login('admin');
    await visit(`/admin/digital-buck-book?client=north&year=${year}`, 'Digital Buck Book');
    await page.getByRole('button', { name: 'Add bucks', exact: true }).click();
    const batch = page.locator('#add-buck-form');
    await batch.getByLabel('Age group').selectOption('3');
    const firstNumber = accounts[0].buck_next_number;
    await batch.locator('input[type="file"]').setInputFiles(Array.from({ length: 100 }, (_, index) => ({
      name: `bulk-${String(index + 1).padStart(3, '0')}.jpg`, mimeType: 'image/jpeg', buffer: testJpeg,
    })));
    await batch.getByText(/100 photos selected/).waitFor();
    await batch.getByRole('button', { name: 'Add 100 bucks' }).click();
    await page.getByText('100 of 100 bucks ready.').waitFor({ timeout: 600000 });
    assert.equal(accounts[0].buck_next_number, firstNumber + 100);
    assert.equal(digitalBucks.filter(buck => buck.name.startsWith('NP') && Number(buck.name.slice(2)) >= firstNumber).length, 100);
    assert.equal(digitalImages.filter(image => /^bulk-\d+\.jpg$/.test(image.original_name) && image.status === 'ready').length, 100);
    await auditMobile('digital-bulk-100');
    console.log('PASS: 100-file browser batch, unique property IDs, ready highlights, mobile layout');
  }
  if (process.env.LARGE_IMAGE_QA === '1') {
    const raw = Buffer.allocUnsafe(7000 * 7000 * 3);
    randomFillSync(raw);
    let largeJpeg;
    for (const quality of [95, 94, 93]) {
      largeJpeg = await sharp(raw, { raw: { width: 7000, height: 7000, channels: 3 } }).jpeg({ quality }).toBuffer();
      if (largeJpeg.length < 50 * 1024 * 1024) break;
    }
    assert.ok(largeJpeg.length > 40 * 1024 * 1024 && largeJpeg.length < 50 * 1024 * 1024, `Expected near-limit JPEG, got ${largeJpeg.length} bytes`);
    await login('admin');
    await visit(`/admin/digital-buck-book?client=north&year=${year}`, 'Digital Buck Book');
    await page.locator('.admin-buck-card').filter({ hasText: 'North Eight' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(`[id="upload-${buckId}"]`).setInputFiles({ name: 'large-qa.jpg', mimeType: 'image/jpeg', buffer: largeJpeg });
    await page.getByText('large-qa.jpg ready').waitFor({ timeout: 180000 });
    const uploaded = digitalImages.find(image => image.original_name === 'large-qa.jpg');
    assert.ok(uploaded && uploaded.status === 'ready' && uploaded.web_path && uploaded.print_path);
    assert.equal(tusBytes.compare(largeJpeg), 0, 'Resumable upload preserves every original byte');
    assert.equal(originals.get(uploaded.original_path)?.compare(largeJpeg), 0, 'Stored original preserves every byte');
    const web = generatedAssets.get(`digital-buck-web/${uploaded.web_path}`);
    const print = generatedAssets.get(`digital-buck-print/${uploaded.print_path}`);
    assert.ok(web && print, 'Both web and print assets are uploaded');
    assert.equal((await sharp(web).metadata()).format, 'jpeg');
    assert.equal((await sharp(print).metadata()).format, 'jpeg');
    assert.ok(web.length < largeJpeg.length && print.length < 50 * 1024 * 1024);
    await page.locator('main').evaluate(main => {
      if (main.scrollWidth > main.clientWidth + 1) throw new Error('Large-image editor overflows at 390 px');
    });
    assert.deepEqual(errors, []);
    console.log(`PASS: ${Math.round(largeJpeg.length / 1024 / 1024)} MiB resumable upload, original integrity, web/print conversion, 390 px editor`);
  }
  if (process.env.RENDITION_LIMIT_QA === '1') {
    const width = 8000; const height = 8000;
    const raw = Buffer.allocUnsafe(width * height * 3);
    randomFillSync(raw);
    const largeWebp = await sharp(raw, { raw: { width, height, channels: 3 } }).webp({ quality: 80 }).toBuffer();
    assert.ok(largeWebp.length > 30 * 1024 * 1024 && largeWebp.length < 50 * 1024 * 1024);
    await login('admin');
    await visit(`/admin/digital-buck-book?client=north&year=${year}`, 'Digital Buck Book');
    await page.locator('.admin-buck-card').filter({ hasText: 'North Eight' }).click();
    await page.locator(`[id="upload-${buckId}"]`).setInputFiles({ name: 'rendition-limit.webp', mimeType: 'image/webp', buffer: largeWebp });
    await page.getByText('rendition-limit.webp ready').waitFor({ timeout: 240000 });
    const uploaded = digitalImages.find(image => image.original_name === 'rendition-limit.webp');
    assert.ok(uploaded && uploaded.status === 'ready' && uploaded.web_path && uploaded.print_path);
    assert.equal(originals.get(uploaded.original_path)?.compare(largeWebp), 0);
    const print = generatedAssets.get(`digital-buck-print/${uploaded.print_path}`);
    assert.ok(print && print.length <= 50 * 1024 * 1024);
    const metadata = await sharp(print).metadata();
    assert.equal(metadata.format, 'jpeg');
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, height);
    assert.deepEqual(errors, []);
    console.log(`PASS: ${Math.round(largeWebp.length / 1024 / 1024)} MiB WebP generated a full-resolution ${Math.round(print.length / 1024 / 1024)} MiB print JPEG below the Storage limit`);
  }
  await login('admin');
  await visit('/admin/clients', 'Clients');
  await page.getByRole('button', { name: 'Add client', exact: true }).click();
  const createClientPanel = page.getByRole('region', { name: 'Add a client' });
  await createClientPanel.getByLabel('Client or organization name').fill('Ramsey Farms');
  await createClientPanel.getByLabel('Property name').fill('Ramsey Farms');
  await createClientPanel.getByLabel('County and state').fill('Test County, Test State');
  await createClientPanel.getByLabel('Acreage').fill('100');
  await createClientPanel.getByLabel('Buck name prefix (optional)').fill('rfc');
  await createClientPanel.getByRole('button', { name: 'Add client' }).click();
  await createClientPanel.getByText('Ramsey Farms was added to your client list.').waitFor();
  assert.equal(accounts.find(account => account.property_name === 'Ramsey Farms')?.buck_prefix, 'RFC');
  console.log('PASS: custom buck prefix is normalized and stored during client creation');
} catch (error) { console.error(logs.slice(-8000)); throw error; }
finally { await browser?.close(); app.kill('SIGTERM'); backend.close(); }
