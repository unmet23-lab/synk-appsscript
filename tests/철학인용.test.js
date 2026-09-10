'use strict';
/**
 * 철학인용 — 옛 철학 번호 인용을 «세는» 도구의 회귀. (발전안 20260911 갈래 ⑥)
 *
 * ■ 재는 것 — 탐지력은 픽스처가 지고, 실저장소에는 분모만 묻는다(F207).
 *   ① Ⅰ-N·Ⅱ-N·Ⅲ-N 과 「부록 A-1」을 줄 단위로 찾고, 맨 「A-1」(다른 표 이름일 수 있다)은 안 센다.
 *   ② 같은 줄의 v1.24·보존본·당시 표시를 «표시됨»으로 가른다.
 *   ③ 코드 펜스 안은 안 센다.
 *   ④ 면제 목록 — 역사 문서는 면제, 담당 설계는 면제가 아니다.
 *   ⑤ 대조표에서 번호의 현행 자리를 찾는다 · 없으면 null.
 *   ⑥ 실저장소 — 과녁이 비지 않고(분모), 이 파일 자신이 세어진다.
 * 🔴 이 시험은 「미표시 0」을 요구하지 않는다 — 치환은 이 도구의 일이 아니다(GPT 검토 09-11).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const 도구 = require('../tools/철학인용.js');

const ROOT = path.resolve(__dirname, '..');

test('① 탐지력 — 조항 번호 셋과 부록 인용을 줄 단위로 찾고, 맨 A-1 은 안 센다 (분모 4)', () => {
  const 본문 = [
    '첫 줄에는 아무것도 없다',
    '철학 Ⅰ-3 의 세 기준과 Ⅱ-8 을 본다',
    '표 A-1 은 다른 문서의 표 이름이다',
    '철학 부록 A-1 이해 대장을 본다',
    '대외 Ⅲ-8 자 넷',
  ].join('\n');
  const r = 도구.인용찾기(본문);
  assert.equal(r.length, 3, `줄 셋에서 찾아야 한다 — 찾은 줄 ${r.length}`);
  assert.deepEqual(r.map((x) => x.줄번호), [2, 4, 5]);
  assert.deepEqual(r[0].번호들, ['Ⅰ-3', 'Ⅱ-8']);
  assert.deepEqual(r[1].번호들, ['A-1']);
  assert.deepEqual(r[2].번호들, ['Ⅲ-8']);
  const 전체 = r.reduce((s, x) => s + x.번호들.length, 0);
  assert.equal(전체, 4, '번호 넷을 세야 한다 — 분모가 깨졌다');
  const 절단 = 도구.인용찾기('Ⅰ-3 ' + '가'.repeat(155) + ' 뒷말');
  assert.equal(절단[0].원문.length, 159, '160번째 공백에서 자른 발췌도 행끝 공백을 남기지 않는다');
});

test('② 표시됨 — 같은 줄에 v1.24·보존본·당시가 있으면 표시됨이다', () => {
  const r = 도구.인용찾기('본문의 구 Ⅰ·Ⅱ·Ⅲ 번호는 v1.24 보존본의 당시 번호다 — Ⅰ-3\n그냥 Ⅰ-3 을 따른다');
  assert.equal(r.length, 2);
  assert.equal(r[0].표시됨, true);
  assert.equal(r[1].표시됨, false);
});

test('③ 코드 펜스 안은 안 센다', () => {
  const r = 도구.인용찾기('```\n철학 Ⅰ-3\n```\n밖의 Ⅱ-1');
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].번호들, ['Ⅱ-1']);
});

test('④ 면제 — 역사 문서는 면제이고 담당 설계는 면제가 아니다', () => {
  assert.equal(도구.면제인가('docs/_archive/SYNK_철학_v1.24_20260909.md'), true);
  assert.equal(도구.면제인가('docs/_ops/심문결과/코어엔진_설계-전건판정.md'), true);
  assert.equal(도구.면제인가('docs/_ops/결정.md'), true);
  assert.equal(도구.면제인가('docs/앱재설계_v2.md'), false);
  assert.equal(도구.면제인가('docs/엔진7종_상향설계_v3.md'), false);
});

test('⑤ 대조표 — 번호의 현행 자리를 찾고, 없으면 null', () => {
  const 대조 = { 대조: [{ 옛: 'Ⅰ-3', 새: ['SYNK_철학.md §2'], 정도: '전부', 담당설계: [] }] };
  assert.deepEqual(도구.자리찾기('Ⅰ-3', 대조), { 새: ['SYNK_철학.md §2'], 정도: '전부', 비고: '', 담당설계: [] });
  assert.equal(도구.자리찾기('Ⅲ-8', 대조), null);
  assert.equal(도구.자리찾기('Ⅰ-3', null), null);
});

test('⑥ 실저장소 — 과녁이 비지 않고 보고서가 선다 · 자기 자신을 센다(분모)', () => {
  const 파일들 = 도구.과녁들(ROOT);
  assert.ok(파일들.length > 50, `과녁이 ${파일들.length}벌 — 저장소 문서를 못 봤다`);
  assert.ok(파일들.includes('tests/철학인용.test.js') === false, 'tests/ 는 과녁이 아니다(문서·엔진·스킬만)');
  const r = 도구.보고서({ root: ROOT, 파일들, 대조: null, 대조경로: '(없음)', 면제적용: true });
  assert.ok(r.셈.전체 >= 1, '옛 번호 인용이 0 이면 도구가 눈이 멀었거나 저장소가 다 치환됐다 — 둘 다 이 회귀가 알아야 한다');
  assert.match(r.글, /^# 철학 옛 번호 인용 보고/);
  assert.match(r.글, /대조표 \(없음\)|대조표 없음/);
  assert.equal(/[ \t]+$/m.test(r.글), false);
  assert.equal(r.글.endsWith('\n'), false, '파일로 쓸 때 붙이는 한 번의 개행만 남긴다');
});
