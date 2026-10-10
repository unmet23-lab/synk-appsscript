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
  assert.match(html, /<meta name="color-scheme" content="dark light">/);
  assert.match(html, /<button type="button" class="theme-toggle" id="theme-toggle" aria-label="화면 테마">/);
  for (const icon of ['i-moon', 'i-sun', 'i-monitor']) assert.ok(html.includes('class="i ' + icon + '"'), icon);
  assert.match(html, /id="platform-search"[^>]*aria-keyshortcuts="Control\+K \/"/);
});

test('day tokens exist for the explicit choice and for a light device setting', () => {
  const day = css.match(/:root\[data-theme=day\]\{([^}]*)\}/);
  assert.ok(day, 'day block');
  assert.match(day[1], /--bg:#ECECEA/);
  assert.match(day[1], /--ink:#08090C/);
  assert.match(day[1], /color-scheme:light/);
  assert.match(css, /@media \(prefers-color-scheme:light\)\{\s*:root\[data-theme=system\]\{[^}]*--bg:#ECECEA/);
  assert.match(css, /@media \(min-width:761px\)\{\s*#search-form\{flex:0 0 42px/);
});

function page({ stored = null, light = false, storageBlocked = false } = {}) {
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
  const window = { matchMedia: () => ({ matches: light, addEventListener() {} }) };
  vm.runInNewContext(script, { document, localStorage, window, HTMLElement });
  const key = (key, extra = {}, target = { tagName: 'BODY' }) => {
    const event = { key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, defaultPrevented: false, target, ...extra, prevented: false };
    event.preventDefault = () => { event.prevented = true; };
    listeners.keydown(event); return event;
  };
  return { document, button, search, meta, store, key, HTMLElement };
}

test('theme defaults to night, keeps a saved choice and cycles night → day → device setting', () => {
  const fresh = page();
  assert.equal(fresh.document.documentElement.dataset.theme, 'night');
  assert.equal(fresh.meta.attributes.content, '#08090C');
  assert.equal(fresh.button.dataset.choice, 'night');
  fresh.button.handlers.click();
  assert.equal(fresh.document.documentElement.dataset.theme, 'day');
  assert.equal(fresh.store.get('synk.platform.theme'), 'day');
  assert.equal(fresh.meta.attributes.content, '#ECECEA');
  fresh.button.handlers.click();
  assert.equal(fresh.document.documentElement.dataset.theme, 'system');
  assert.match(fresh.button.attributes['aria-label'], /기기 설정/);
  fresh.button.handlers.click();
  assert.equal(fresh.document.documentElement.dataset.theme, 'night');
  const saved = page({ stored: 'system', light: true });
  assert.equal(saved.document.documentElement.dataset.theme, 'system');
  assert.equal(saved.meta.attributes.content, '#ECECEA');
  assert.equal(page({ stored: 'sepia' }).document.documentElement.dataset.theme, 'night');
});

test('blocked storage still changes the theme for this page', () => {
  const blocked = page({ storageBlocked: true });
  assert.equal(blocked.document.documentElement.dataset.theme, 'night');
  blocked.button.handlers.click();
  assert.equal(blocked.document.documentElement.dataset.theme, 'day');
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
  assert.match(css, /@font-face\{font-family:'SYNK Arrow';src:url\('\.\/assets\/InterTight-Medium\.ttf'\) format\('truetype'\);[^}]*unicode-range:U\+2190-2193;size-adjust:130%\}/);
  assert.match(css, /--sans:'SYNK Arrow',SUIT,'Inter Tight',system-ui,sans-serif;/);
  assert.ok(fs.existsSync(new URL('../assets/InterTight-Medium.ttf', import.meta.url)));
});

test('phone menu stays reachable while scrolling and the search row scrolls with the page', () => {
  const phone = css.slice(css.indexOf('@media (max-width:760px){'));
  assert.match(phone, /\.sidebar\{position:sticky;inset:auto;top:-40px;z-index:9;[^}]*pointer-events:none\}/);
  assert.match(phone, /\.sidebar>\*\{pointer-events:auto\}/);
  assert.match(phone, /\.main-nav\{[^}]*background:var\(--glass-strong\);box-shadow:var\(--glass-edge\)/);
  assert.match(phone, /\.topbar\{position:relative;top:auto;/);
});
