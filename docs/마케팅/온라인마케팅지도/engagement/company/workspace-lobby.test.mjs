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
  const ctx = Number(/\.ws-r-ctx\{color:rgba\(20,20,20,([.\d]+)\)\}/.exec(css)[1]);
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
  for (const sel of selectors) for (const one of sel.split(',')) assert.match(one.trim(), /^(\.synk-workspace\b|\.app-shell\.synk-workspace\b|\.auth-layout\b|#app\.boot-shell\b|\.teaching-only-shell\b|html:has\(|body:has\()/, 'scoped: ' + one.trim());
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
