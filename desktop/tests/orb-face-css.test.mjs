// 새 얼굴 CSS의 약속(0.4.95 원천 후보 카본 P2): 보조 글자 명암비, 첫 화면 「시작하기」의 초점 표시, 솔리오 방의 넘침, 줄 없을 때의 단추 자리
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../renderer/orb-face.css', import.meta.url), 'utf8');
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const contrastOnBlack = a => { const [r, g, b] = [243, 241, 236].map(v => v * a); return (0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) + 0.05) / 0.05; };

test('secondary text keeps at least 4.5:1 on black, and dim rows are not darker than it', () => {
  const dim = Number(/--dim:rgba\(243,241,236,([.\d]+)\)/.exec(css)?.[1]);
  assert.ok(contrastOnBlack(dim) >= 4.5, 'dim ' + dim + ' gives ' + contrastOnBlack(dim).toFixed(2));
  assert.match(css, /\.rows\.dim \.row,#portal-entry \.rows\.dim \.row\.now\{color:var\(--dim\)\}/);
  assert.doesNotMatch(css, /\.rows\.dim \.row\{color:rgba\(243,241,236,\.3/);
});

test('the start button keeps a keyboard focus ring', () => {
  assert.doesNotMatch(css, /\.orb-wake:focus-visible\{outline:none\}/);
  assert.match(css, /\.orb-wake:focus-visible\{outline:1px solid var\(--ring\)/);
});

test('the Solio room scrolls instead of overflowing, and a lone action sits under the sentence', () => {
  assert.match(css, /#portal-entry \.room\{[^}]*max-height:calc\(100% - 168px\);overflow-y:auto/);
  assert.match(css, /#portal-entry \.rows\[hidden\] \+ \.read\{justify-content:flex-start\}/);
});

test('the old screen shown under the new face hides the signed-out SYNK ID row, and its sign-in button rechecks the saved sign-in (0.4.95 Fable F2)', () => {
  assert.match(css, /html\[data-orb-client="legacy"\] \.setting-row:has\(#settings-login\[data-signed-in="false"\]\)\{display:none\}/);
  const launcher = fs.readFileSync(new URL('../renderer/launcher.mjs', import.meta.url), 'utf8');
  assert.match(launcher, /if\(portalHost\?\.isClientShown\?\.\(\)\)\{if\(bridge\)void refreshAuth\(\{reload:true\}\);return;\}/);
  assert.match(launcher, /\$\('settings-login'\)\.dataset\.signedIn=String\(!!signedIn\)/);
});

test('a toast moves to the top while the space switch is open, so it never covers the switch foot (0.4.95 first build, Mac arm64)', () => {
  assert.match(css, /html\[data-orb-client\]:has\(#portal-entry \.orb-stage\[data-ui="switch"\]\) #toast\{bottom:auto;top:28px\}/);
});

/* ── 2단계 첫 조각(2단계_첫조각_구현설계.md 1.3절 · 3.2절, 설계 검토 1차 3 · 4 · 9 · 10 · 15) ── */
test('the fan sits above the drag band, and while it is open the room, name and objects take no presses', () => {
  const fanZ = Number(/#portal-entry \.fan\{position:absolute;z-index:(\d+)/.exec(css)?.[1]);
  const barZ = Number(/#portal-entry \.portal-window-bar\{z-index:(\d+)\}/.exec(css)?.[1]);
  assert.ok(fanZ >= 5 && fanZ > barZ, `fan ${fanZ} over bar ${barZ}`);
  assert.match(css, /\.orb-stage\[data-fan\] \.room\{opacity:\.14;pointer-events:none\}/);
  assert.match(css, /\.orb-stage\[data-fan\] \.here-name,#portal-entry \.orb-stage\[data-fan\] \.rail\{opacity:0;pointer-events:none\}/);
  assert.match(css, /@media \(max-width:640px\)\{[\s\S]*?\.orb-stage\[data-fan\] \.room\{opacity:\.05\}/, 'narrow windows dim the room further');
});

test('after entering, the top-left group and the open fan are taken out of the window drag area', () => {
  assert.match(css, /html\[data-orb-client="app"\] #portal-entry \.portal-window-bar\{-webkit-app-region:no-drag;app-region:no-drag\}/);
  assert.match(css, /html\[data-orb-client="app"\] #portal-entry \.portal-window-drag\{margin-left:var\(--orb-here-w,0px\)\}/);
  assert.match(css, /html\[data-orb-client="app"\] #portal-entry \.orb-stage\[data-fan\] ~ \.portal-window-bar \.portal-window-drag\{-webkit-app-region:no-drag;app-region:no-drag\}/);
});

test('reduced motion also shortens the fan, its foot and the room dimming', () => {
  for (const sel of ['.fan-go', '.fan-foot', '.room']) {
    assert.match(css, new RegExp('@media \\(prefers-reduced-motion:reduce\\)\\{[^}]*#portal-entry \\' + sel + '[,{]'), sel);
    assert.match(css, new RegExp('html\\[data-motion="reduced"\\] #portal-entry \\' + sel + '[,{]'), sel + ' (app setting)');
  }
});

test('size rules follow the sketch values that the app can reach (설계 3.2절)', () => {
  // 아래 78px는 시안 막대 자리라 옮기지 않고, 좁은 창의 솔리오 방도 아래 끝을 흐린다(대체 검수 F2)
  assert.match(css, /@media \(max-width:640px\)\{[\s\S]*?#portal-entry \.room\{top:clamp\(84px,13vh,128px\);transform:none;bottom:calc\(24px \+ env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(css, /@media \(max-width:640px\)\{[\s\S]*?#portal-entry \.room\[data-room\^="solio"\]\{padding-bottom:34px;-webkit-mask-image:linear-gradient\(#000 calc\(100% - 30px\),transparent\)/);
  assert.doesNotMatch(css, /bottom:calc\(78px/, 'the sketch toolbar space is not carried into the app');
  assert.match(css, /@media \(max-height:620px\) and \(min-width:641px\)\{[\s\S]*?#portal-entry \.room\[data-room\^="solio"\]\{top:16vh;max-height:calc\(100% - 16vh - 56px\)\}/);
  assert.match(css, /@media \(min-width:641px\) and \(max-width:900px\)\{#portal-entry \.rows\.vis\{grid-template-columns:minmax\(96px,128px\) minmax\(0,1fr\) 6\.2em minmax\(96px,auto\)\}\}/);
  assert.doesNotMatch(css, /max-height:340px/, 'the very small window rule waits for a smaller minimum window (설계 검토 1차 9)');
});
