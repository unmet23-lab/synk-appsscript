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

test('the old account page opens only for a signed-in member; before sign-in its button rechecks the saved sign-in (0.4.95 Fable F2, PC 0.5.0 설계 4.2-2)', () => {
  // 옛 설정 화면의 SYNK ID 줄은 PC 0.5.0에서 그 화면과 함께 거뒀다. 남은 길은 옛 내 계정 하나다
  assert.doesNotMatch(css, /#settings-login/);
  const launcher = fs.readFileSync(new URL('../renderer/launcher.mjs', import.meta.url), 'utf8');
  assert.match(launcher, /function openAccount\(\)\{if\(bridge&&auth\.signedIn\)\{showView\('account'\);return;\}if\(bridge\)void refreshAuth\(\{reload:true\}\);\}/);
  assert.doesNotMatch(launcher, /settings-login|account-dialog/);
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
  assert.match(css, /html\[data-orb-client="app"\] #portal-entry \.portal-window-bar,\s*html\[data-orb-client="legacy"\] #portal-entry \.portal-window-bar\{-webkit-app-region:no-drag;app-region:no-drag\}/);
  assert.match(css, /html\[data-orb-client="app"\] #portal-entry \.portal-window-drag,\s*html\[data-orb-client="legacy"\] #portal-entry \.portal-window-drag\{margin-left:var\(--orb-here-w,0px\)\}/);
  assert.match(css, /html\[data-orb-client="app"\] #portal-entry \.orb-stage\[data-fan\] ~ \.portal-window-bar \.portal-window-drag\{-webkit-app-region:no-drag;app-region:no-drag\}/);
});

test('the old screen band also keeps the orb, name and back button out of the window drag area (OS mouse check 11-19)', () => {
  assert.match(css, /html\[data-orb-client="legacy"\] #portal-entry \.portal-window-bar\{-webkit-app-region:no-drag;app-region:no-drag\}/);
  assert.match(css, /html\[data-orb-client="legacy"\] #portal-entry \.portal-window-drag\{margin-left:var\(--orb-here-w,0px\)\}/);
  const view = fs.readFileSync(new URL('../renderer/orb-face-view.mjs', import.meta.url), 'utf8');
  assert.match(view, /if \(\(s\.mode === 'app' \|\| s\.mode === 'legacy'\) && layer === 'app'\) syncDragGap\(s\.mode === 'legacy'\)/);
  assert.match(view, /\(legacy \|\| app\.rail\.hidden \? 0 : 260\)/, 'the old screen has no object rail, so the gap ends at the back button');
});

test('reduced motion also shortens the fan, its foot and the room dimming', () => {
  for (const sel of ['.fan-go', '.fan-foot', '.room']) {
    assert.match(css, new RegExp('@media \\(prefers-reduced-motion:reduce\\)\\{[^}]*#portal-entry \\' + sel + '[,{]'), sel);
    assert.match(css, new RegExp('html\\[data-motion="reduced"\\] #portal-entry \\' + sel + '[,{]'), sel + ' (app setting)');
  }
});

test('size rules follow the sketch values that the app can reach (설계 3.2절)', () => {
  // 아래 78px는 시안 막대 자리라 옮기지 않고, 좁은 창의 솔리오 방도 아래 끝을 흐린다(대체 검수 F2)
  assert.match(css, /@media \(max-width:640px\)\{[\s\S]*?#portal-entry \.room\{top:clamp\(84px,13vh,128px\);transform:none;max-height:none;bottom:calc\(24px \+ env\(safe-area-inset-bottom,0px\)\)/, 'the base max-height must not cap the narrow room (다시 검수 FA1)');
  assert.match(css, /@media \(max-width:640px\)\{[\s\S]*?#portal-entry \.room-top\{padding-bottom:34px;-webkit-mask-image:linear-gradient\(#000 calc\(100% - 30px\),transparent\)/);
  assert.doesNotMatch(css, /bottom:calc\(78px/, 'the sketch toolbar space is not carried into the app');
  assert.match(css, /@media \(max-height:620px\) and \(min-width:641px\)\{[\s\S]*?#portal-entry \.room-top\{top:16vh;max-height:calc\(100% - 16vh - 56px\)\}/);
  assert.match(css, /@media \(min-width:641px\) and \(max-width:900px\)\{#portal-entry \.rows\.vis\{grid-template-columns:minmax\(96px,128px\) minmax\(0,1fr\) 6\.2em minmax\(96px,auto\)\}\}/);
  assert.doesNotMatch(css, /max-height:340px/, 'the very small window rule waits for a smaller minimum window (설계 검토 1차 9)');
});

/* ── 2단계 둘째 조각 첫 묶음(2단계_둘째조각_구현설계.md 10.2절) ── */
const block = head => { const at = css.indexOf(head + '{'); assert.ok(at >= 0, head); let depth = 0; for (let i = at + head.length; i < css.length; i++) { if (css[i] === '{') depth++; else if (css[i] === '}' && --depth === 0) return css.slice(at, i + 1); } return ''; };

test('room rows: the far action stands alone at the right end, rows of another kind keep a gap, and the warning reads as white', () => {
  assert.match(css, /#portal-entry \.more-acts \.far\{margin-left:auto\}/);
  assert.match(css, /#portal-entry \.row\.gap\{margin-top:clamp\(14px,2\.6vh,26px\)\}/);
  assert.match(css, /#portal-entry \.quiet\.warn\{color:var\(--paper\);border-bottom-color:var\(--paper\)\}/);
  assert.match(css, /#portal-entry \.quiet\[aria-disabled="true"\]\{opacity:\.42;cursor:default\}/);
  assert.match(css, /#portal-entry \.more-live:empty\{display:none\}/);
});

test('fact rows inside a row keep their date and value at least 4.5:1 on black', () => {
  const a = Number(/#portal-entry \.row\.sub \.when,#portal-entry \.row\.sub \.val\{color:rgba\(243,241,236,([.\d]+)\)\}/.exec(css)?.[1]);
  assert.ok(contrastOnBlack(a) >= 4.5, 'fact value ' + a + ' gives ' + contrastOnBlack(a).toFixed(2));
});

test('input fields sit in the row grid, and in a narrow window the field drops under its name with the hint on the left', () => {
  assert.match(css, /#portal-entry \.fld\{display:grid;grid-column:1 \/ -1;grid-template-columns:subgrid/);
  assert.match(css, /#portal-entry \.fld \.hint\{grid-column:3 \/ -1;justify-self:end;text-align:right/);
  const narrow = block('@media (max-width:640px)');
  assert.match(narrow, /#portal-entry \.fld\{grid-template-columns:minmax\(0,1fr\);row-gap:2px;padding:8px 0\}/);
  assert.match(narrow, /#portal-entry \.fld \.hint\{grid-column:1;justify-self:start;text-align:left\}/);
  assert.match(block('@media (max-height:620px) and (min-width:641px)'), /#portal-entry \.room \.up\{margin-bottom:10px\}/);
});

test('the account room is a top room like the two Solio rooms', () => {
  const view = fs.readFileSync(new URL('../renderer/orb-face-view.mjs', import.meta.url), 'utf8');
  assert.match(view, /class="room room-top room-aside"/);
  assert.doesNotMatch(css, /\.room\[data-room\^="solio"\]/, 'the top room rules follow the class, not the room name');
  assert.match(block('@media (min-width:641px)'), /#portal-entry \.room-top\{top:clamp\(92px,21vh,196px\);transform:none/);
});

/* ── 2단계 둘째 조각 둘째 묶음: 모델별 토큰 줄과 내 계정 방 ── */
test('the learning switch lights only when on, and the deletion confirm group is one left line with a quiet question focus', () => {
  assert.match(css, /#portal-entry \.more-acts \.quiet\[aria-pressed="true"\],#portal-entry \.quiet\[aria-checked="true"\],#portal-entry \.quiet\.warn\{color:var\(--paper\);border-bottom-color:var\(--paper\)\}/);
  assert.match(css, /#portal-entry \.quiet\[aria-checked="false"\]\{color:var\(--dim\)\}/);
  assert.match(css, /#portal-entry \.confirm\{display:grid;grid-column:1 \/ -1;[^}]*border-left:1px solid rgba\(243,241,236,\.34\)\}/);
  assert.match(css, /#portal-entry \.confirm \[data-ask-q\]:focus\{outline:none\}/);
});

test('a long name in 내 계정 is cut short instead of covering the next cell, and a lone button in the subscriptions room sits under the sentence', () => {
  assert.match(css, /#portal-entry \.room\[data-room="account"\] button\.row \.val\{min-width:0;overflow:hidden;text-overflow:ellipsis\}/);
  assert.match(css, /#portal-entry \.room\[data-room="solio"\] \.read:has\(> \[data-read\]:empty\)\{justify-content:flex-start\}/);
  assert.match(css, /#portal-entry \.room\[data-room="solio"\] \.read > \[data-read\]:empty\{display:none\}/);
  const view = fs.readFileSync(new URL('../renderer/orb-face-view.mjs', import.meta.url), 'utf8');
  assert.match(view, /const ASIDE_NAMES = Object\.freeze\(\['manage', 'account', 'settings'\]\);/, 'the account and settings rooms share the top room markup');
});
