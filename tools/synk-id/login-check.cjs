#!/usr/bin/env node
// Sends a real SYNK WORLD app login request (OAuth 2.1 + PKCE, no sign-in, no account) to a talk project,
// follows its redirect to the SYNK ID page and opens that page in headless Chrome. With a local folder the
// page's files come from it (before publishing); without one, from the live site. Also opens the sign-up
// view and checks its two choices.
//   node tools/synk-id/login-check.cjs <playwright module dir> production|rehearsal [local folder]
// The playwright directory is the one with package.json (e.g. a Codex runtime's node_modules/playwright).
'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { TALK_ROOT, CLIENTS } = require('./lib.js');
const [playwrightDir, which, localDir] = process.argv.slice(2);
if (!playwrightDir || !['production', 'rehearsal'].includes(which)) throw new Error('usage: login-check.cjs <playwright dir> production|rehearsal [local folder]');
const { chromium } = require(path.resolve(playwrightDir));
const env = JSON.parse(execFileSync('git', ['show', 'HEAD:eas.json'], { cwd: TALK_ROOT, encoding: 'utf8' })).build[which === 'production' ? 'production' : 'preview'].env;
const portal = which === 'production' ? 'https://synk.im/id/' : 'https://synk.im/id-rehearsal/';
const b64 = buf => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.woff2': 'font/woff2' };
(async () => {
  const verifier = b64(crypto.randomBytes(32)), challenge = b64(crypto.createHash('sha256').update(verifier).digest());
  const authorize = new URL('/auth/v1/oauth/authorize', env.EXPO_PUBLIC_SUPABASE_URL);
  for (const [k, v] of Object.entries({ response_type: 'code', client_id: CLIENTS[which].world, redirect_uri: 'synktalk://oauth/callback',
    code_challenge: challenge, code_challenge_method: 'S256', state: b64(crypto.randomBytes(16)) })) authorize.searchParams.set(k, v);
  let res = await fetch(authorize, { redirect: 'manual' });
  if (res.status === 401) res = await fetch(authorize, { redirect: 'manual', headers: { apikey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY } });
  const location = res.headers.get('location');
  const result = { authorize: res.status, location: location && location.replace(/authorization_id=[^&]+/, 'authorization_id=…') };
  if (!location || !location.startsWith(portal)) { console.log(JSON.stringify(result)); throw new Error('the server did not send the request to the SYNK ID page'); }
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage(), errors = [], missing = [];
    if (localDir) await context.route(`${portal}**`, route => {
      const rel = new URL(route.request().url()).pathname.replace(new URL(portal).pathname, '') || 'index.html';
      const file = path.join(localDir, rel === '' ? 'index.html' : rel);
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'missing' });
      route.fulfill({ status: 200, headers: { 'content-type': mime[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) });
    });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) missing.push(`${r.status()} ${new URL(r.url()).pathname}`); });
    await page.goto(location);
    await page.waitForTimeout(2500);
    const shown = await page.evaluate(() => Object.fromEntries(['setup', 'auth-panel', 'consent', 'account'].map(id => [id, !document.getElementById(id)?.hidden])));
    result.page = { title: await page.title(), shown, robots: await page.locator('meta[name="robots"]').getAttribute('content').catch(() => null), errors, missing };
    await page.click('[data-view=signup]');
    result.signup = { choices: await page.isVisible('#signup-choices'), learningOffByDefault: !(await page.isChecked('#signup-learning')),
      privacy: await page.locator('#signup-choices a').getAttribute('href') };
  } finally { await browser.close(); }
  console.log(JSON.stringify(result, null, 1));
})().catch(e => { console.error(String(e.message || e)); process.exitCode = 1; });
