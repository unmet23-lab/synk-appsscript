// WORLD 앱 창(client.html)의 마크업이 client.mjs · 옷장 모듈과 맺은 약속을 지키는지(2026-11-21 새 판, Fable 검수 F1).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../client.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../client.css', import.meta.url), 'utf8');
const body = html.slice(html.indexOf('<body'));
// 괄호(:is() · :has()) 안의 쉼표는 선택자 목록의 가름이 아니다
const topLevel = list => { const out = [];let depth = 0, start = 0;for (let i = 0; i < list.length; i++) { const c = list[i];if (c === '(') depth++;else if (c === ')') depth--;else if (c === ',' && depth === 0) { out.push(list.slice(start, i));start = i + 1; } }out.push(list.slice(start));return out; };

test('client.html loads only client.css, as the wardrobe style link so wardrobe.css is not added', () => {
  const links = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)].map(m => m[0]);
  assert.equal(links.length, 1);
  assert.match(links[0], /id="world-wardrobe-style"/);
  assert.match(links[0], /href="\.\/client\.css\?v=[^"]+"/);
  assert.doesNotMatch(html, /scrapbook\.css|style\.css|world-classroom\.css|wardrobe\.css/);
});

test('the first footer link is the one client.mjs turns into 「이 앱의 로그인 상태」', () => {
  const footer = body.slice(body.indexOf('<footer'), body.indexOf('</footer>'));
  const first = footer.match(/<a [^>]*>([^<]*)<\/a>/);
  assert.ok(first);
  assert.equal(first[1], 'SYNK ID 관리');
  assert.match(first[0], /href="\.\/index\.html"/);
});

test('connect and cancel sit together in .sc-actions so the retry button joins them', () => {
  const actions = body.match(/<div class="sc-actions">(.*?)<\/div>/);
  assert.ok(actions);
  assert.match(actions[1], /^<button id="connect" class="sb-btn" hidden>/);
  assert.match(actions[1], /<button id="cancel-connect" class="sb-btn soft" hidden>/);
});

test('every element client.mjs and account modules look up is present once, in order', () => {
  const ids = ['platform-portal-orb', 'product-label', 'product-copy', 'notice', 'setup', 'learning-link', 'connect', 'cancel-connect', 'account', 'world-games'];
  let at = -1;
  for (const id of ids) {
    const re = new RegExp(` id="${id}"`, 'g');
    assert.equal([...body.matchAll(re)].length, 1, id);
    const i = body.search(re);
    assert.ok(i > at, `${id} keeps its order`);
    at = i;
  }
  assert.match(body, /^<body class="sc">/);
  assert.match(html, /<link id="app-manifest"/);
  assert.match(html, /<link rel="apple-touch-icon"/);
});

test('client.css scopes its rules under .sc and keeps the platform boot orb rules', () => {
  assert.match(css, /@font-face\{font-family:'SYNK Sans';src:url\('\.\/assets\/SYNKSans-ui\.woff2'\)/);
  assert.match(css, /html\[data-platform-portal-boot="true"\] body\.sc>main\{visibility:hidden!important/);
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\{[^}]*\}/g, '').replace(/@keyframes [^{]+\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '').replace(/@media[^{]*\{/g, '');
  assert.doesNotMatch(rules, /sb-page|slab-|chip-|badge-|sticker/);
  for (const m of rules.matchAll(/(^|\})\s*([^@{}][^{}]*)\{/g)) {
    for (const sel of topLevel(m[2]).map(x => x.trim()).filter(Boolean)) {
      assert.ok(/^(\.sc\b|\.client-portal-orb|html\[data-platform-portal-boot)/.test(sel), `unscoped selector: ${sel}`);
    }
  }
});
