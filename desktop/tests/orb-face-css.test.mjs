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
