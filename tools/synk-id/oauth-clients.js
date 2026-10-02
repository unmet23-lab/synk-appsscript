#!/usr/bin/env node
// SYNK's public OAuth clients on one talk project: lists them, and with --register adds a missing one
//   world  — the SYNK WORLD app (return address synktalk://oauth/callback)
//   tools  — the synk.im custom tools (production only; read the chosen settings as the platform product)
// and with --products writes SYNK_OAUTH_CLIENT_PRODUCTS (client id → SYNK product) from lib.js.
// Rehearsal by default; production with --운영. The project's server key is used for the admin call in
// memory only and never printed. Public PKCE clients have no secret of their own.
// After --products, restart synk-account and synk-learning (talk tools/원격배포.js) so they read it.
'use strict';
const { target, management, projectName, serverKey, CLIENTS, TOOL_REDIRECTS } = require('./lib.js');

(async () => {
  const t = target(), register = process.argv.includes('--register'), products = process.argv.includes('--products');
  console.log(`target ▸ ${await projectName(t.ref)} (${t.ref})`);
  const key = await serverKey(t.ref);
  const admin = `https://${t.ref}.supabase.co/auth/v1/admin/oauth/clients`;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const listed = await fetch(admin, { headers });
  const body = listed.ok ? await listed.json() : null;
  const clients = Array.isArray(body) ? body : (body?.clients || []);
  console.log(`list HTTP ${listed.status} · ${clients.length} client(s)`);
  for (const c of clients) console.log(`  ${c.client_id} | ${c.client_name || c.name || ''} | ${c.client_type} | ${(c.redirect_uris || []).join(' ')}`);
  const wanted = [{ name: t.production ? 'SYNK WORLD 앱' : 'SYNK WORLD 앱 (리허설)', redirect_uris: ['synktalk://oauth/callback'], client_type: 'public' },
    ...(t.production ? [{ name: 'SYNK 맞춤 도구', redirect_uris: [...TOOL_REDIRECTS], client_type: 'public' }] : [])];
  if (register) {
    for (const client of wanted) {
      const found = clients.find(c => (c.redirect_uris || []).includes(client.redirect_uris[0]));
      if (found) { console.log(`registered already: ${client.name} ${found.client_id}`); continue; }
      const res = await fetch(admin, { method: 'POST', headers, body: JSON.stringify(client) });
      const out = await res.json().catch(() => ({}));
      console.log(`register ${client.name}: HTTP ${res.status}`, res.ok ? `client_id=${out.client_id}` : JSON.stringify(out).slice(0, 200));
      console.log('  → add this id to CLIENTS in tools/synk-id/lib.js before --products');
    }
  }
  if (products) {
    const known = CLIENTS[t.name], mapping = {};
    if (known.world) mapping[known.world] = 'world';
    if (known.tools) mapping[known.tools] = 'platform';
    for (const id of Object.keys(mapping)) if (!clients.some(c => c.client_id === id)) throw new Error(`client ${id} in lib.js is not registered on this project`);
    const res = await management(t.ref, '/secrets', { method: 'POST', body: JSON.stringify([{ name: 'SYNK_OAUTH_CLIENT_PRODUCTS', value: JSON.stringify(mapping) }]) });
    console.log(`set SYNK_OAUTH_CLIENT_PRODUCTS ${JSON.stringify(mapping)}: HTTP ${res.status}`);
    process.exitCode = res.ok ? 0 : 1;
  }
})().catch(e => { console.error(String(e.message || e)); process.exitCode = 1; });
