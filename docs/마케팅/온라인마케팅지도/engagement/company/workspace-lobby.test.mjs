// 워크스페이스 로비 겉(11-26 유호님 「우리 지금 만들어가고있는 시안처럼 여기도 전체적으로 시안느낌으로」 · 「싱ㅋ 이것도 이제 별로야. 삭제시켜줘」).
// 노란 바탕 위 글자 명암비, 선택자 범위, 맨 끝 스타일 연결, 글자 로고 없음, 글꼴 파일을 지킨다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = rel => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const css = read('./public/workspace-lobby.css');
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const over = (alpha, fg, bg) => fg.map((v, i) => v * alpha + bg[i] * (1 - alpha));
const hex = name => { const m = new RegExp('--' + name + ':#([0-9A-F]{6})', 'i').exec(css); return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)); };
const rgba = name => { const m = new RegExp('--' + name + ':rgba\\((\\d+),(\\d+),(\\d+),([.\\d]+)\\)').exec(css); return { rgb: m.slice(1, 4).map(Number), a: Number(m[4]) }; };

test('text on the yellow and on the glass panels keeps 4.5:1, and the ink buttons read in yellow', () => {
  const y = hex('lobby-y'), ink = hex('lobby-ink');
  assert.ok(ratio(ink, y) >= 7, 'ink on yellow');
  assert.ok(ratio(y, ink) >= 7, 'yellow label on the ink button');
  const mute = rgba('lobby-mute');
  assert.ok(ratio(over(mute.a, mute.rgb, y), y) >= 4.5, 'mute on yellow ' + ratio(over(mute.a, mute.rgb, y), y).toFixed(2));
  // 유리 판의 실제 바탕은 흰빛 92%가 노랑 위에 겹친 색이다
  const g = rgba('lobby-glass'), glass = over(g.a, g.rgb, y);
  for (const name of ['lobby-label2', 'lobby-label3']) {
    const c = rgba(name), fg = over(c.a, c.rgb, glass);
    assert.ok(ratio(fg, glass) >= 4.5, name + ' on glass ' + ratio(fg, glass).toFixed(2));
  }
  // 찾기 칸의 단축키 글은 유리 위 옅은 먹 면 위에 선다(카본 A4)
  const l2 = rgba('lobby-label2'), kbdBg = over(0.06, ink, glass);
  assert.ok(css.includes('.ws-side-find kbd{border:0;background:rgba(20,20,20,.06);color:var(--lobby-label2)}'));
  assert.ok(ratio(over(l2.a, l2.rgb, kbdBg), kbdBg) >= 4.5, 'kbd ' + ratio(over(l2.a, l2.rgb, kbdBg), kbdBg).toFixed(2));
  // 목록 줄의 보조 글(노랑 바로 위)
  const ctx = Number(/--lobby-fg2:rgba\(20,20,20,([.\d]+)\)/.exec(css)[1]);
  assert.ok(ratio(over(ctx, ink, y), y) >= 4.5, 'row context on yellow');
  assert.match(css, /--ws-cta:#141414;--ws-cta-hover:#000;--ws-cta-ink:#FED027;--ws-decide:#141414;--ws-decide-hover:#000;--ws-decide-ink:#FED027;/);
});

test('the paper panel never sets its own height, so the messenger keeps its own (Fable F1), and the unread counts read on the yellow (Fable F6)', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of plain.matchAll(/([^{}]*\.workspace-main[^{}]*)\{([^{}]*)\}/g)) assert.ok(!/min-height/.test(m[2]), 'no min-height on ' + m[1].trim());
  assert.ok(css.includes('.synk-workspace .ws-side-link .messenger-unread,.synk-workspace .ws-side-link .nav-badge{color:var(--lobby-mute)}'));
  assert.ok(css.includes('.synk-workspace .ws-tabchip .ws-num{color:var(--lobby-mute)}'));
  assert.ok(css.includes('.synk-workspace[data-view="messenger"] .workspace-main{overflow:hidden}'));
  assert.ok(!read('./public/workspace.js').includes('싱ㅋ'));
});

test('every rule stays under the workspace, sign-in, loading or teaching shell', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...plain.matchAll(/(^|[{}])\s*([^{}@]+?)\s*\{/g)].map(m => m[2].trim()).filter(s => s && !/^(from|to)$/.test(s));
  assert.ok(selectors.length > 150);
  // 바탕 색은 <html data-lobby-theme="paper|night">를 앞에 붙인 같은 범위다. html에는 바탕 값 하나만 둔다
  const scope = /^(\.synk-workspace\b|\.app-shell\.synk-workspace\b|\.auth-layout\b|#app\.boot-shell\b|\.teaching-only-shell\b|html:has\(|body:has\()/;
  for (const sel of selectors) for (const one of sel.split(',')) {
    // html[data-lobby-theme="night"]:has(.synk-workspace)(쪽 전체 스크롤 손잡이)는 html:has( 범위와 같다
    const bare = one.trim().replace(/^html\[data-lobby-theme="(?:paper|night)"\]\s+/, '').replace(/^html\[data-lobby-theme="(?:paper|night)"\](?=:has\()/, 'html');
    if (/^html\[data-lobby-theme="(?:paper|night)"\]$/.test(bare)) continue;
    assert.match(bare, scope, 'scoped: ' + one.trim());
  }
  for (const m of plain.matchAll(/html\[data-lobby-theme="(?:paper|night)"\]\{([^}]*)\}/g)) assert.match(m[1], /^--lobby-page:#[0-9A-F]{6}$/i, 'html only takes the page colour');
});

test('the skin is the last stylesheet, the server serves it, and its fonts are files the server already serves', () => {
  const html = read('./public/index.html'), server = read('./server.mjs');
  const links = [...html.split('</head>')[0].matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m => m[1]);
  assert.equal(links.at(-1), '/workspace-lobby.css');
  assert.ok(server.includes("'/workspace-lobby.css':['public/workspace-lobby.css','text/css; charset=utf-8']"));
  for (const font of ['NotoSerifKR-300.woff2', 'NotoSerifDisplay-Light-latin.woff2']) {
    assert.ok(css.includes(`url('/pulse-app/assets/${font}')`), font);
    assert.ok(fs.existsSync(new URL('./public/pulse-app/assets/' + font, import.meta.url)), font);
  }
  assert.ok(server.includes("files['/pulse-app/assets/NotoSerifDisplay-Light-latin.woff2']"));
  assert.match(server, /'\/pulse-app\/assets\/NotoSerifKR-300\.woff2'/);
});

test('the workspace screens no longer show the 싱ㅋ letter logo', () => {
  for (const rel of ['./public/workspace.js', './public/app.js', './public/synk-id.js', './public/teaching.js', './public/trial-feedback.html', './public/index.html']) {
    const src = read(rel);
    assert.ok(!src.includes('/wordmark.svg'), rel);
    assert.ok(!src.includes('alt="싱ㅋ"'), rel);
  }
  assert.ok(read('./public/workspace.js').includes('<img class="brand-logo" src="/brand-logo.svg" alt="" width="42" height="30"><span>Workspace</span>'));
});

test('the office keeps its live hooks: clock, greeting, rooms, first item, the rest stacked behind it, and the status panel', () => {
  const src = read('./public/marin-home.js');
  for (const hook of ['data-ws-clock', 'data-ws-day', 'id="ws-office-hello"', 'id="ws-office-rooms"', 'id="ws-office-lead"', 'id="ws-office-rest"', 'id="ws-office-extra"', 'id="next-action"']) assert.ok(src.includes(hook), hook);
  assert.ok(!src.includes('ws-office-img'), 'the clay office picture is gone');
  // 읽는 차례: 시계 → 인사 → 1순위 → 방 → 운영 상태(좁은 화면의 보이는 차례와 같다, 카본 A3)
  const order = ['class="ws-office-date"', 'id="ws-office-hello"', 'id="ws-office-lead"', 'id="ws-office-rooms"', 'id="ws-office-extra"'].map(h => src.indexOf(h));
  assert.deepEqual([...order].sort((a, b) => a - b), order, JSON.stringify(order));
  assert.ok(!src.includes('ws-office-side'));
  // 자정을 넘기면 날짜도 바뀐다(카본 A5)
  assert.ok(src.includes("for(const node of document.querySelectorAll('[data-ws-day]'))if(node.textContent!==day)node.textContent=day;"));
  // 시계 타이머는 한 번만 걸고, 시험 같은 Node 실행을 붙잡지 않는다
  assert.match(src, /timer\?\.unref\?\.\(\);window\.__wsClockTimer=timer;/);
});

// 바탕 색 고르기(11-27 유호님 「계속 노란색을 보고있으면 눈이 아프니까」): 노랑 · 종이 · 밤
const SCOPES = ['.synk-workspace', '.auth-layout', '#app.boot-shell', '.teaching-only-shell'];
const block = sel => { const i = css.indexOf(sel + '{'); assert.ok(i >= 0, sel); return css.slice(i + sel.length + 1, css.indexOf('}', i)); };
const themeBlock = name => block(SCOPES.map(s => `html[data-lobby-theme="${name}"] ${s}`).join(','));
const themeTokens = name => {
  const out = {};
  for (const src of [block(SCOPES.join(',')), name === 'yellow' ? '' : themeBlock(name)]) for (const m of src.matchAll(/--([a-z0-9-]+):([^;]+);?/g)) out[m[1]] = m[2].trim();
  return out;
};
const color = (value, bg) => {
  let m = /^#([0-9A-F]{6})$/i.exec(value);
  if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  m = /^rgba\((\d+),(\d+),(\d+),([.\d]+)\)$/.exec(value);
  assert.ok(m && bg, 'colour ' + value);
  return over(Number(m[4]), m.slice(1, 4).map(Number), bg);
};

test('each background keeps the text on it readable: words 7:1, quiet words and counts 4.5:1, the current pill 7:1', () => {
  for (const name of ['yellow', 'paper', 'night']) {
    const t = themeTokens(name), bg = color(t['lobby-bg']);
    const check = (label, fg, on, min) => { const r = ratio(fg, on); assert.ok(r >= min, `${name} ${label} ${r.toFixed(2)}`); };
    check('fg', color(t['lobby-fg']), bg, 7);
    check('mute', color(t['lobby-mute'], bg), bg, 4.5);
    check('fg2', color(t['lobby-fg2'], bg), bg, 4.5);
    check('solid pill', color(t['lobby-solid-fg']), color(t['lobby-solid']), 7);
    const chip = color(t['lobby-chip'], bg), soft = color(t['lobby-soft'], bg);
    check('row number on chip', color(t['lobby-fg']), chip, 4.5);
    check('mute on soft', color(t['lobby-mute'], soft), soft, 4.5);
    // 추천 뒤 바탕 위 알림 띠: 글은 fg2 · 덧붙인 줄은 mute, 면은 soft(Fable ws-lobby-20261127d P1)
    check('fg2 on soft', color(t['lobby-fg2'], soft), soft, 4.5);
    // 유리 판은 바탕을 비친다: 판 안의 흐린 글도 바탕마다 4.5:1
    const glass = color(t['lobby-glass'], bg);
    for (const name2 of ['lobby-label2', 'lobby-label3']) check(name2 + ' on glass', color(t[name2], glass), glass, 4.5);
    // 지금 자리 알약은 바탕에서 떨어져 보인다(3:1)
    check('pill against page', color(t['lobby-solid']), bg, 3);
    // html 바탕(쪽 끝 · 스크롤 너머)과 틀 바탕이 같다
    const page = name === 'yellow'
      ? /html:has\(\.synk-workspace\)[^{]*\{--lobby-page:(#[0-9A-F]{6});/i.exec(css)[1]
      : new RegExp(`html\\[data-lobby-theme="${name}"\\]\\{--lobby-page:(#[0-9A-F]{6})\\}`, 'i').exec(css)[1];
    assert.equal(page.toUpperCase(), t['lobby-bg'].toUpperCase(), name + ' page');
  }
  // 유리 · 종이 판 안 값은 바탕마다 바꾸지 않는다(판 안 모듈은 밝은 판을 전제로 짜여 있다)
  for (const name of ['paper', 'night']) for (const fixed of ['lobby-glass', 'lobby-paper', 'lobby-label', 'lobby-ink', 'lobby-y', 'ws-cta']) assert.ok(!themeBlock(name).includes(`--${fixed}:`), `${name} keeps ${fixed}`);
  // 바탕 위에 선 것은 먹 · 노랑을 직접 쓰지 않고 바탕 값을 쓴다
  for (const rule of [
    '.app-shell.synk-workspace{background:var(--lobby-bg);color:var(--lobby-fg)}',
    '.synk-workspace .ws-side-link[aria-current="page"],.synk-workspace .ws-side-sublink[aria-current="page"]{background:var(--lobby-solid);color:var(--lobby-solid-fg)}',
    '.synk-workspace .ws-r-ctx{color:var(--lobby-fg2)}',
    'width:15px;height:62vh;background:var(--lobby-solid);',
    '.synk-workspace .ws-side-brand .brand-logo{width:auto;height:30px;margin:-4px -2px -4px -8px;filter:var(--lobby-logo)}',
    '.synk-workspace .ws-row[aria-current="true"] .ws-r-title{color:var(--lobby-label)}',
    '.synk-workspace .ws-office-next .next-status,.synk-workspace .ws-office-next .next-asof{color:var(--lobby-mute)}',
    '.synk-workspace .ws-office-next .next-warning:not(.is-error){border-color:var(--lobby-line);border-left-color:var(--lobby-fg);background:var(--lobby-soft);color:var(--lobby-fg2)}',
    '.synk-workspace .ws-office-next .next-warning:not(.is-error)>span{color:var(--lobby-mute)}',
  ]) assert.ok(css.includes(rule), rule);
  // 밤의 스크롤 손잡이는 검은 바탕에서 3:1 이상 보인다(Fable ws-lobby-20261127d P2). 쪽 전체 스크롤(html)도 같은 값이다
  const thumb = /html\[data-lobby-theme="night"\]:has\(\.synk-workspace\),[^{]*\{scrollbar-color:(rgba\([^)]*\)) transparent\}/.exec(css);
  assert.ok(thumb, 'night scrollbar colour');
  const nightBg = color(themeTokens('night')['lobby-bg']);
  assert.ok(ratio(color(thumb[1], nightBg), nightBg) >= 3, 'night thumb ' + ratio(color(thumb[1], nightBg), nightBg).toFixed(2));
  assert.ok(css.includes(`html[data-lobby-theme="night"] .synk-workspace *::-webkit-scrollbar-thumb,html[data-lobby-theme="night"] .auth-layout *::-webkit-scrollbar-thumb,html[data-lobby-theme="night"] .teaching-only-shell *::-webkit-scrollbar-thumb{background:${thumb[1]}}`), 'webkit thumb matches');
  // 밤 바탕을 까는 껍데기(html:has(…))마다 손잡이도 밝힌다 — 「내 수업」 단독 쪽이 빠졌던 일(Fable ws-lobby-20261127e P2)
  const nightRule = /html\[data-lobby-theme="night"\]:has\(\.synk-workspace\),[^{]*\{scrollbar-color:/.exec(css)[0];
  for (const shell of ['.synk-workspace', '.auth-layout', '.teaching-only-shell']) {
    assert.ok(nightRule.includes(`html[data-lobby-theme="night"]:has(${shell})`), 'page scrollbar ' + shell);
    assert.ok(nightRule.includes(`html[data-lobby-theme="night"] ${shell} *`), 'inner scrollbars ' + shell);
  }
});

test('the picker is three radio swatches, starts before the first paint, and remembers the choice on this device only', async () => {
  const html = read('./public/index.html'), server = read('./server.mjs'), ws = read('./public/workspace.js');
  assert.ok(html.split('</head>')[0].includes('<script src="/workspace-theme.js"></script>'), 'loaded in <head>');
  assert.ok(server.includes("'/workspace-theme.js':['public/workspace-theme.js','text/javascript; charset=utf-8']"));
  assert.ok(ws.includes("${workspaceThemePick('side')}${me}"), 'side menu, above the account');
  assert.ok(ws.includes("계정과 기기</div>${workspaceThemePick('drawer')}"), 'phone: the 더보기 sheet');

  const vm = await import('node:vm');
  const src = read('./public/workspace-theme.js');
  const run = (stored, { blocked = false } = {}) => {
    const attrs = {}, store = new Map(stored === undefined ? [] : [['synk.workspace.lobby-theme', stored]]);
    const doc = { documentElement: { getAttribute: k => attrs[k] ?? null, setAttribute: (k, v) => { attrs[k] = String(v); } }, querySelectorAll: () => [], addEventListener() {} };
    const local = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)) };
    const win = { addEventListener() {} };
    Object.defineProperty(win, 'localStorage', { get() { if (blocked) throw new Error('blocked'); return local; } });
    vm.runInNewContext(src, { window: win, document: doc });
    return { attrs, store, api: win.SynkLobbyTheme };
  };
  assert.equal(run().attrs['data-lobby-theme'], 'yellow', 'yellow by default');
  assert.equal(run('night').attrs['data-lobby-theme'], 'night', 'a remembered choice applies at once');
  assert.equal(run('pink').attrs['data-lobby-theme'], 'yellow', 'an unknown value falls back');
  const one = run();
  one.api.set('paper');
  assert.equal(one.attrs['data-lobby-theme'], 'paper');
  assert.equal(one.store.get('synk.workspace.lobby-theme'), 'paper');
  const markup = one.api.html('side');
  assert.equal((markup.match(/role="radio"/g) || []).length, 3);
  assert.match(markup, /role="radiogroup" aria-labelledby="ws-theme-k-side"/);
  assert.match(markup, /data-lobby-theme-pick="paper" aria-checked="true" tabindex="0" aria-label="종이"/);
  assert.match(markup, /data-lobby-theme-pick="yellow" aria-checked="false" tabindex="-1" aria-label="노랑"/);
  assert.match(one.api.html('drawer'), /id="ws-theme-k-drawer">바탕 색</);
  // 브라우저 저장이 막혀도 노랑으로 그리고, 고르기는 그 탭에서 그대로 된다
  const shut = run(undefined, { blocked: true });
  assert.equal(shut.attrs['data-lobby-theme'], 'yellow');
  shut.api.set('night');
  assert.equal(shut.attrs['data-lobby-theme'], 'night');
});
