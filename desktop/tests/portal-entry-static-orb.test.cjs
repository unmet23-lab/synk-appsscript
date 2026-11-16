'use strict';
// 카본 0.4.94 원천 검수: WebGL과 2D 캔버스가 모두 없을 때 쓰는 정적 구가, 배정된 작업 문서가 열리기를 기다리는
// 동안(단계 entered · 포털 활성)에도 그려져야 한다. 화면은 이때도 구 장면을 보이므로(portal-entry.mjs holdingExitOrb)
// 선택자가 빠지면 빈 검정 배경만 남는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '../renderer/portal-entry.css'), 'utf8').replace(/\r\n/g, '\n');
const staticRule = css.match(/((?:#portal-entry[^{]*?,\s*)*#portal-entry[^{]*\.portal-orb-stage\[data-orb-mode="static"\]::after)\s*\{/);

test('static orb fallback is drawn for every phase that shows the orb scene', () => {
  assert.ok(staticRule, 'static orb rule exists');
  const selectors = staticRule[1].split(',').map(s => s.trim());
  for (const phase of ['welcome', 'zooming', 'checking', 'entering']) {
    assert.ok(selectors.includes(`#portal-entry[data-portal-state="${phase}"] .portal-orb-stage[data-orb-mode="static"]::after`), phase);
  }
  assert.ok(selectors.includes('#portal-entry[data-portal-state="entered"][data-portal-active="true"] .portal-orb-stage[data-orb-mode="static"]::after'), 'entered while the destination opens');
});

test('the orb hold status line is read by screen readers but not drawn', () => {
  const rule = css.match(/#portal-entry \.portal-orb-status \{([^}]*)\}/);
  assert.ok(rule, 'orb status rule exists');
  for (const decl of ['position: absolute;', 'width: 1px;', 'height: 1px;', 'overflow: hidden;', 'clip-path: inset(50%);']) assert.ok(rule[1].includes(decl), decl);
  assert.ok(!/display:\s*none|visibility:\s*hidden/.test(rule[1]), 'not removed from the accessibility tree');
  const face = fs.readFileSync(path.join(__dirname, '../renderer/portal-entry.mjs'), 'utf8');
  assert.ok(face.includes('<p class="portal-orb-status" data-portal-orb-status role="status" aria-live="polite"></p>'), 'orb status markup');
});

test('the orb scene phases in the face match the static orb phases', () => {
  const face = fs.readFileSync(path.join(__dirname, '../renderer/portal-entry.mjs'), 'utf8');
  assert.match(face, /const isOrbHoldPhase = phase === 'checking' \|\| phase === 'entering' \|\| holdingExitOrb;/);
  assert.match(face, /const showOrbScene = phase === 'welcome' \|\| phase === 'zooming' \|\| isOrbHoldPhase;/);
  assert.match(face, /const holdingExitOrb = phase === 'entered' && navigationHoldActive;/);
  assert.match(face, /root\.dataset\.portalActive = String\(effectiveActive\);/);
});
