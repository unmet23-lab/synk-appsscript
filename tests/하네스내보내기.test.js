'use strict';
/* 하네스 내보내기 — «정본 판을 읽는가» 회귀 — 2026-09-06
 *
 * 무엇을 지키나: **자가 자기 눈이 먼 것을 스스로 말하는가.**
 *   09-06 실측 — `CLAUDE.md` v11.0 개편이 머리줄의 굵게 표시를 걷으면서
 *   (`**v6.12 · 2026-08-03**` → `> v11.0 · 2026-09-02 —`) 굵게만 찾던 정규식이 못 읽게 됐다.
 *   그런데 아무것도 안 죽었다 — `(버전 미검출)` 이라는 «글자»가 그대로 이식 폴더 머리말에 박히고,
 *   rot-check 은 그 값으로 낡음을 재므로 자가 눈이 먼 채 초록을 냈다.
 *   0건이 성공 얼굴인 그 무늬다(memory `zero-is-a-success-face-taxonomy`).
 *
 * 🔑 그래서 재는 것은 「정규식이 어떻게 생겼나」가 아니라 **«지금 정본에서 값이 실제로 나오나»**다.
 *   정규식 글자를 재면 CLAUDE.md 머리 꼴이 또 바뀌는 날 시험만 초록으로 남는다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const H = require('../tools/harness-export.js');   // require 는 생성기를 실행하지 않는다

test('🔴 지금 CLAUDE.md 에서 지침 판이 «실제로» 읽힌다 — 「미검출」은 rot-check 의 눈을 멀게 한다', () => {
  assert.match(H.VER, /^v\d+(\.\d+)*$/, `판을 못 읽었다(${H.VER}) — CLAUDE.md 머리 꼴이 바뀌었으면 추출기를 같이 고친다`);
  assert.doesNotMatch(H.STAMP, /미검출/, 'STAMP 에 「미검출」이 들어가면 이식 폴더 머리말에 그대로 박힌다');
  assert.match(H.STAMP, /정본일 \d{4}-\d{2}-\d{2}/, '정본일이 비어 있다 — 낡음을 날짜로도 못 잰다');
});

test('🔴 읽은 판이 CLAUDE.md 가 «말하는» 판과 같다 — 딴 줄에서 주워 오면 조용히 틀린다', () => {
  const md = fs.readFileSync(path.join(__dirname, '..', 'CLAUDE.md'), 'utf8');
  // 머리말 첫 인용줄이 정본 판을 말한다. 그 줄에 추출값이 그대로 들어 있어야 한다.
  const 머리 = md.split(/\r?\n/).slice(0, 6).join('\n');
  assert.ok(머리.includes(H.VER), `머리말에 없는 판을 읽었다(${H.VER}) — 본문 어딘가의 옛 판을 주웠을 수 있다`);
});

test('🔴 버전을 못 읽으면 «만들지 않는다» — 거절하는 자리가 소스에 서 있다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'tools', 'harness-export.js'), 'utf8');
  assert.ok(/function 버전확인\(\)/.test(src), '버전확인() 이 없다');
  assert.ok(/process\.exit\(2\)/.test(src), '못 읽었을 때 종료코드로 거절하지 않는다');
  const main = src.slice(src.indexOf('function main()'), src.indexOf('function main()') + 400);
  assert.ok(/버전확인\(\)/.test(main), 'main 이 버전확인() 을 안 부른다 — 거절이 실제로 안 걸린다');
});
