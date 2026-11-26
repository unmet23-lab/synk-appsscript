// 솔리오 로비(유호님 11-26 「두 화면만 바꿔」): 로그인과 「한 번에 처리」만 노란 바탕이다. 글자 명암비 · 이음 · 글꼴 파일을 지킨다
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../renderer/solio-lobby.css', import.meta.url), 'utf8');
const view = fs.readFileSync(new URL('../renderer/orb-face-view.mjs', import.meta.url), 'utf8');
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const hex = name => { const m = new RegExp('--' + name + ':#([0-9A-F]{6})', 'i').exec(css); return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)); };
const over = (alpha, fg, bg) => fg.map((v, i) => v * alpha + bg[i] * (1 - alpha));

test('ink reads on the yellow, the dim ink reads on the glass card and the yellow, and the yellow label reads on ink', () => {
  const y = hex('lobby-y'), ink = hex('lobby-ink');
  const alpha = name => Number(new RegExp('--' + name + ':rgba\\((\\d+),(\\d+),(\\d+),([.\\d]+)\\)').exec(css)[4]);
  const rgb = name => new RegExp('--' + name + ':rgba\\((\\d+),(\\d+),(\\d+),').exec(css).slice(1, 4).map(Number);
  // 사원증과 카드의 실제 바탕은 흰빛 유리(92%)가 노랑 위에 겹친 색이다(Fable F6: 「가장 밝은 흰빛」은 가장 좋은 경우였다)
  const glass = over(alpha('lobby-glass'), rgb('lobby-glass'), y);
  const mute = alpha('lobby-mute');
  assert.ok(ratio(ink, y) >= 7, 'ink on yellow ' + ratio(ink, y).toFixed(2));
  assert.ok(ratio(over(mute, ink, glass), glass) >= 4.5, 'mute on glass ' + ratio(over(mute, ink, glass), glass).toFixed(2));
  assert.ok(ratio(over(mute, ink, y), y) >= 4.5, 'mute on yellow ' + ratio(over(mute, ink, y), y).toFixed(2));
  assert.ok(ratio(y, ink) >= 7, 'yellow label on ink');
  // 초대 코드 칸의 자리표시 글도 노란 바탕 위 흐린 먹과 같은 색이다(카본 A3)
  assert.ok(css.includes('.invite input::placeholder{color:var(--lobby-mute)}'));
  for (const name of ['lobby-label2', 'lobby-label3']) {
    const fg = over(alpha(name), rgb(name), glass);
    assert.ok(ratio(fg, glass) >= 4.5, name + ' on glass over yellow ' + ratio(fg, glass).toFixed(2));
  }
  // 로비 위의 창 단추는 먹색이다(Fable F2: 흰 단추가 노랑 위 1.3:1이었다)
  const win = over(alpha('lobby-win'), rgb('lobby-win'), y);
  assert.ok(ratio(win, y) >= 4.5, 'window buttons on yellow ' + ratio(win, y).toFixed(2));
  assert.ok(css.includes('#portal-entry:has(.orb-stage[data-lobby]) .portal-window-actions button{color:var(--lobby-win)}'));
  assert.ok(css.includes('#portal-entry:has(.orb-stage[data-lobby]) .portal-window-actions button:focus-visible{outline:2px solid var(--lobby-ink)'));
  // 구 단추와 이름 단추의 초점 테도 로비에서는 먹색이다(Fable F5)
  assert.ok(css.includes('#portal-entry .orb-stage[data-lobby] .here-orb:focus-visible,#portal-entry .orb-stage[data-lobby] .here-name:focus-visible{outline:2px solid var(--lobby-ink)'));
});

test('the space fan turns the lobby off, so its light-on-dark list never sits on the yellow', () => {
  assert.ok(view.includes("ui === 'app' && 'todo' in stageEl.dataset && stageEl.dataset.fan !== '1' ? 'todo' : ''"));
  assert.match(view, /else if \('fan' in stageEl\.dataset\) delete stageEl\.dataset\.fan;\r?\n\s*syncLobby\(\);/);
});

test('the lobby is only the sign-in ask and an open queue card, and the canvas paints the same yellow as the CSS', () => {
  assert.ok(view.includes('stage.setBg?.(want ? LOBBY_RGB : [0, 0, 0]);'));
  const rgb = /const LOBBY_RGB = \[(\d+), (\d+), (\d+)\]/.exec(view).slice(1).map(Number);
  assert.deepEqual(rgb, hex('lobby-y'));
  // 로그인 층의 이음(data-*)은 그대로다
  for (const hook of ['data-orb-act="signin"', 'data-orb-act="signup"', 'data-portal-pane="invite"', 'data-ask-status-box', 'data-ask-note', 'data-portal-auth-feedback', 'data-ask-unconf', 'data-ask-actions', 'data-todo-deck']) assert.ok(view.includes(hook), hook);
});

test('the lobby stylesheet comes after the face sheet, its one font ships with the app, and every rule stays under #portal-entry', () => {
  const html = fs.readFileSync(new URL('../renderer/index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('./solio-lobby.css') > html.indexOf('./orb-face.css'));
  assert.match(css, /src:url\('\/assets\/launcher\/NotoSerifDisplay-Light-latin\.woff2'\)/);
  assert.ok(fs.existsSync(new URL('../assets/launcher/NotoSerifDisplay-Light-latin.woff2', import.meta.url)));
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...plain.matchAll(/(^|[{}])\s*([^{}@]+?)\s*\{/g)].map(m => m[2].trim()).filter(s => s && !/^(from|to)$/.test(s));
  assert.ok(selectors.length > 40);
  for (const sel of selectors) for (const one of sel.split(',')) assert.ok(/^#portal-entry\b|^html\[data-motion="reduced"\] #portal-entry\b/.test(one.trim()), 'scoped: ' + one.trim());
});
