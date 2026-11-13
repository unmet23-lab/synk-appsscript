import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../platform.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../platform.css', import.meta.url), 'utf8');
const script = fs.readFileSync(new URL('../theme.js', import.meta.url), 'utf8');

test('platform page loads the theme script in head before the app bundle and offers the theme button', () => {
  const head = html.slice(0, html.indexOf('</head>'));
  assert.ok(head.includes('<script src="./theme.js"></script>'));
  assert.ok(html.indexOf('./theme.js') < html.indexOf('./dist/platform.js'));
  assert.match(html, /<meta name="color-scheme" content="light dark">/);
  assert.match(html, /<meta name="theme-color" content="#FFFFFF">/);
  assert.match(html, /<button type="button" class="theme-toggle" id="theme-toggle" aria-label="화면 테마">/);
  for (const icon of ['i-moon', 'i-sun', 'i-monitor']) assert.ok(html.includes('class="i ' + icon + '"'), icon);
  assert.match(html, /id="platform-search"[^>]*aria-keyshortcuts="Control\+K \/"/);
});

test('white paper is the base and night is the same frame with inverted tokens, for the explicit choice and a dark device setting', () => {
  // A 진열대(2026-11-08): 기본(:root)이 낮 — 흰 종이 · 회색 선반. 밤은 색만 뒤집는다.
  const base = css.match(/:root\{([^}]*)\}/);
  assert.ok(base, 'base block');
  assert.match(base[1], /--paper:#FFFFFF;--surface:#F3F3F4;--ink:#0B0B0C/);
  assert.match(base[1], /color-scheme:light/);
  const night = css.match(/:root\[data-theme=night\]\{([^}]*)\}/);
  assert.ok(night, 'night block');
  assert.match(night[1], /--paper:#0F0F10;--surface:#1A1A1C;--ink:#F2F2F3/);
  assert.match(night[1], /color-scheme:dark/);
  assert.match(css, /@media \(prefers-color-scheme:dark\)\{\s*:root\[data-theme=system\]\{[^}]*--paper:#0F0F10/);
  assert.doesNotMatch(css, /:root\[data-theme=day\]/);
  // 찾기는 위 막대의 아이콘 하나로 두고, 초점이 들어오면 가운데 칸이 열리며 메뉴가 숨는다.
  assert.match(css, /#search-form:focus-within \.search-field\{opacity:1;pointer-events:auto/);
  assert.match(css, /\.topbar:has\(#search-form:focus-within\) \.main-nav\{visibility:hidden\}/);
  assert.match(html, /<label for="platform-search" class="search-trigger"/);
});

function page({ stored = null, dark = false, storageBlocked = false } = {}) {
  const listeners = {}, store = new Map(stored ? [['synk.platform.theme', stored]] : []);
  class HTMLElement { constructor(tag) { this.tagName = tag; this.dataset = {}; this.attributes = {}; this.isContentEditable = false; this.handlers = {}; }
    setAttribute(k, v) { this.attributes[k] = String(v); } addEventListener(type, fn) { this.handlers[type] = fn; } }
  const button = new HTMLElement('BUTTON');
  const search = new HTMLElement('INPUT'); search.value = ''; search.focused = 0; search.selected = 0;
  search.focus = () => { search.focused++; document.activeElement = search; }; search.select = () => { search.selected++; };
  search.blur = () => { document.activeElement = null; };
  const meta = new HTMLElement('META');
  const document = {
    readyState: 'complete', documentElement: { dataset: {} }, activeElement: null,
    getElementById: id => ({ 'theme-toggle': button, 'platform-search': search })[id] || null,
    querySelector: selector => selector === 'meta[name="theme-color"]' ? meta : null,
    addEventListener: (type, fn) => { listeners[type] = fn; },
  };
  const localStorage = {
    getItem: key => { if (storageBlocked) throw Error('blocked'); return store.has(key) ? store.get(key) : null; },
    setItem: (key, value) => { if (storageBlocked) throw Error('blocked'); store.set(key, value); },
  };
  const window = { matchMedia: query => ({ matches: query.includes('dark') ? dark : !dark, addEventListener() {} }) };
  vm.runInNewContext(script, { document, localStorage, window, HTMLElement });
  const key = (key, extra = {}, target = { tagName: 'BODY' }) => {
    const event = { key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, defaultPrevented: false, target, ...extra, prevented: false };
    event.preventDefault = () => { event.prevented = true; };
    listeners.keydown(event); return event;
  };
  return { document, button, search, meta, store, key, HTMLElement };
}

test('theme defaults to day, keeps a saved choice and cycles day → night → device setting', () => {
  const fresh = page();
  assert.equal(fresh.document.documentElement.dataset.theme, 'day');
  assert.equal(fresh.meta.attributes.content, '#FFFFFF');
  assert.equal(fresh.button.dataset.choice, 'day');
  fresh.button.handlers.click();
  assert.equal(fresh.document.documentElement.dataset.theme, 'night');
  assert.equal(fresh.store.get('synk.platform.theme'), 'night');
  assert.equal(fresh.meta.attributes.content, '#0F0F10');
  fresh.button.handlers.click();
  assert.equal(fresh.document.documentElement.dataset.theme, 'system');
  assert.match(fresh.button.attributes['aria-label'], /기기 설정/);
  fresh.button.handlers.click();
  assert.equal(fresh.document.documentElement.dataset.theme, 'day');
  // 저장된 선택은 그대로 따른다(전에 밤을 고른 사람은 밤으로 연다).
  const night = page({ stored: 'night' });
  assert.equal(night.document.documentElement.dataset.theme, 'night');
  assert.equal(night.meta.attributes.content, '#0F0F10');
  const saved = page({ stored: 'system', dark: true });
  assert.equal(saved.document.documentElement.dataset.theme, 'system');
  assert.equal(saved.meta.attributes.content, '#0F0F10');
  assert.equal(page({ stored: 'system' }).meta.attributes.content, '#FFFFFF');
  assert.equal(page({ stored: 'sepia' }).document.documentElement.dataset.theme, 'day');
});

test('blocked storage still changes the theme for this page', () => {
  const blocked = page({ storageBlocked: true });
  assert.equal(blocked.document.documentElement.dataset.theme, 'day');
  blocked.button.handlers.click();
  assert.equal(blocked.document.documentElement.dataset.theme, 'night');
  blocked.button.handlers.click();
  assert.equal(blocked.document.documentElement.dataset.theme, 'system');
});

test('Ctrl+K and / open the search, / is ignored while typing, Escape closes an empty search', () => {
  const p = page();
  const ctrl = p.key('k', { ctrlKey: true });
  assert.equal(ctrl.prevented, true); assert.equal(p.search.focused, 1); assert.equal(p.search.selected, 1);
  const meta = p.key('K', { metaKey: true });
  assert.equal(meta.prevented, true); assert.equal(p.search.focused, 2);
  const typing = new p.HTMLElement('TEXTAREA');
  assert.equal(p.key('/', {}, typing).prevented, false);
  assert.equal(p.key('/').prevented, true); assert.equal(p.search.focused, 3);
  p.key('Escape');
  assert.equal(p.document.activeElement, null);
  p.search.focus(); p.search.value = '받침';
  p.key('Escape');
  assert.equal(p.document.activeElement, p.search);
});

test('arrow characters use the Inter Tight arrow face instead of SUIT chevrons', () => {
  // The arrow face is the four Inter Tight Medium arrows only (tools/build-platform-fonts.py), not the whole TTF.
  assert.match(css, /@font-face\{font-family:'SYNK Arrow';src:url\('\.\/assets\/SYNKArrow\.woff2'\) format\('woff2'\);[^}]*unicode-range:U\+2190-2193;size-adjust:130%\}/);
  assert.match(css, /--sans:'SYNK Arrow','SYNK Sans','Inter Tight',system-ui,sans-serif;/);
  assert.ok(fs.existsSync(new URL('../assets/SYNKArrow.woff2', import.meta.url)));
});

test('the platform loads the SUIT screen subset first and the rest only for characters outside it', () => {
  // SYNK Sans is SUIT renamed for the OFL reserved name. The rest face is declared first and never
  // claims a screen-subset character, so the screen face is the only font a first view needs.
  const faces = [...css.matchAll(/@font-face\{font-family:'SYNK Sans';src:url\('\.\/assets\/(SYNKSans-(?:rest|ui)\.woff2)'\)[^}]*unicode-range:([^}]+)\}/g)];
  assert.deepEqual(faces.map((face) => face[1]), ['SYNKSans-rest.woff2', 'SYNKSans-ui.woff2']);
  for (const [, file] of faces) assert.ok(fs.existsSync(new URL(`../assets/${file}`, import.meta.url)));
  assert.doesNotMatch(css, /SUIT-Variable\.woff2|\.ttf'/);
});

test('the menu is a text row in the 72px top bar, and a narrow window keeps it reachable in a fixed five-slot tab bar', () => {
  // 사이드바 레일은 없다. 위 막대(72, 스크롤하면 아래 1px 선)에 글자 메뉴, 900px 이하는 위 막대 60 + 아래 고정 탭 막대.
  assert.doesNotMatch(html, /class="sidebar"|nav-mark|sidebar-label|side-apps/);
  assert.match(css, /\.topbar\{position:sticky;top:0;[^}]*height:72px/);
  assert.match(css, /\.topbar\.scrolled\{border-bottom-color:var\(--line\)\}/);
  const nav = html.match(/<nav class="main-nav"[^>]*>(.*?)<\/nav>/)[1];
  assert.deepEqual([...nav.matchAll(/data-route="([a-z]+)"/g)].map(m => m[1]), ['home', 'discover', 'solio', 'library', 'updates', 'downloads']);
  const tabs = html.match(/<nav class="tabbar"[^>]*>(.*?)<\/nav>/)[1];
  assert.deepEqual([...tabs.matchAll(/data-route="([a-z]+)"/g)].map(m => m[1]), ['home', 'discover', 'solio', 'library']);
  assert.match(tabs, /id="more-toggle" aria-expanded="false" aria-controls="more-menu"/);
  const more = html.match(/<div id="more-menu"[^>]*>(.*?)<\/div>/)[1];
  // 회원 혜택은 2026-11-13부터 오른쪽 프로필 메뉴와 좁은 창 「더 보기」 · 바닥 줄에 있다.
  for (const route of ['benefits', 'updates', 'downloads', 'settings', 'help']) assert.match(more, new RegExp('data-route="' + route + '"'));
  const profile = html.match(/<div id="profile-menu" class="profile-menu" hidden>(.*?)<\/div>/)[1];
  assert.deepEqual([...profile.matchAll(/href="([^"]+)"/g)].map(m => m[1]), ['#account', '#benefits', './client.html?product=platform']);
  const phone = css.slice(css.indexOf('@media (max-width:900px){'));
  assert.match(phone, /\.topbar\{grid-template-columns:auto 1fr;height:60px\}/);
  assert.match(phone, /\.main-nav\{display:none\}/);
  assert.match(phone, /\.tabbar\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\);position:fixed;/);
  assert.match(script, /bar\.classList\.toggle\('scrolled'/);
});

test('the shelf screens carry no English uppercase tags, mono eyebrows or 900 weight', () => {
  const views = ['../src/platform.mjs', '../src/member-benefits.mjs', '../src/platform-shelf.mjs'].map(file => fs.readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n') + html;
  assert.doesNotMatch(views, /sb-eyebrow|benefit-index|nav-mark/);
  for (const tag of ['SYNK FOR YOU</', 'KOREAN LEARNING', 'INTERVIEW PRACTICE', 'TEAM WORKSPACE', 'MEMBER BENEFITS', 'WHERE TO OPEN', 'HOW IT WORKS', "'DOWNLOADS'", "'SETTINGS'", 'WHAT’S NEW', 'ON THE WEB', 'FAVORITES', 'RECENT<', 'KOREAN STUDY', '>PLATFORM<']) assert.ok(!views.includes(tag), tag);
  assert.doesNotMatch(css + fs.readFileSync(new URL('../benefits.css', import.meta.url), 'utf8'), /font-weight:(800|850|900)|letter-spacing:\.1\d?em/);
  // 함께 쓰는 계정 라이브러리 띠의 영문 눈썹(MY LIBRARY)은 웹 화면에서 숨긴다.
  assert.match(css, /\.platform-continuity \.continuity-eyebrow\{display:none\}/);
});
