import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = (await readFile('supabase/functions/admin-users/index.ts', 'utf8'))
  .replace('import { createClient } from "npm:@supabase/supabase-js@2";',
    'const createClient = globalThis.__adminUsersTestClient;');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});

const actorId = '66666666-6666-4666-8666-666666666666';
const targetId = '55555555-5555-4555-8555-555555555555';
const password = 'TemporaryPassword123!';
let actorSuperAdmin = true;
let actorRole = 'admin';
let passwordUpdate;
let handler;

globalThis.Deno = {
  env: { get: name => ({ SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'fixture-key' })[name] },
  serve: fn => { handler = fn; },
};
globalThis.__adminUsersTestClient = () => ({
  auth: {
    getUser: async () => ({ data: { user: { id: actorId, app_metadata: { super_admin: actorSuperAdmin } } }, error: null }),
    admin: {
      getUserById: async id => ({ data: { user: id === targetId ? { id, email: 'user@example.test' } : null }, error: null }),
      updateUserById: async (id, changes) => { passwordUpdate = { id, changes }; return { error: null }; },
    },
  },
  from: table => {
    assert.equal(table, 'profiles');
    return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: actorRole }, error: null }) }) }) };
  },
});

await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
assert.equal(typeof handler, 'function');

async function invoke(userId, candidate = password) {
  const response = await handler(new Request('https://example.test/functions/v1/admin-users', {
    method: 'POST',
    headers: { Authorization: 'Bearer fixture-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'set_password', userId, password: candidate }),
  }));
  return { status: response.status, body: await response.json() };
}

assert.deepEqual(await invoke('invalid-id'), { status: 400, body: { error: 'Choose a valid user.' } });
assert.equal(passwordUpdate, undefined);
assert.deepEqual(await invoke(targetId, 'too-short'), {
  status: 400, body: { error: 'Use a temporary password of 16–128 characters.' },
});
assert.equal(passwordUpdate, undefined);
actorSuperAdmin = false;
assert.deepEqual(await invoke(targetId), { status: 403, body: { error: 'Super-admin access required.' } });
actorSuperAdmin = true;
actorRole = 'client';
assert.deepEqual(await invoke(targetId), { status: 403, body: { error: 'Super-admin access required.' } });
actorRole = 'admin';
assert.deepEqual(await invoke(targetId), { status: 200, body: { success: 'Temporary password set.' } });
assert.deepEqual(passwordUpdate, { id: targetId, changes: { password } });
console.log('PASS: admin-users Edge Function rejects invalid requests and updates a valid UUID after authorization');
