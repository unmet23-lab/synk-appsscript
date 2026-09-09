'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 검수 = require('../tools/codex-review.js');
const 카드 = require('../.claude/hooks/philosophy-card.js');

function 임시문서(t, 이름, 본문) {
  const 부모 = fs.realpathSync(os.tmpdir());
  const 방 = fs.mkdtempSync(path.join(부모, 'synk-philosophy-current-'));
  t.after(() => {
    const 실제 = fs.realpathSync(방);
    assert.equal(path.dirname(실제), 부모);
    assert.ok(path.basename(실제).startsWith('synk-philosophy-current-'));
    fs.rmSync(실제, { recursive: true, force: true });
  });
  const p = path.join(방, 이름);
  fs.writeFileSync(p, 본문);
  return p;
}

const 표식본문 = () => 카드.철학구획정의.map(([id]) =>
  `<!-- 철학: ${id} 시작 -->\n# 자유로운 제목\n\n첫 문단\n\n둘째 문단 ${id}\n<!-- 철학: ${id} 끝 -->`).join('\n');

test('새 의미 구획은 제목·빈 줄을 보존하며 다섯 쌍이 각각 유일해야 한다', () => {
  const 원문 = 표식본문();
  const 정상 = 카드.철학구획(원문);
  assert.equal(정상.완전한가, true);
  assert.equal(정상.방식, '구획');
  assert.ok(정상.자리.every(([, 값]) => 값.includes('\n\n둘째 문단')));
  assert.equal(카드.철학구획(원문 + '\n<!-- 철학: purpose 시작 -->').완전한가, false);
  assert.equal(카드.철학구획(원문.replace('<!-- 철학: purpose 끝 -->', '<!-- 철학: criteria 시작 -->')).완전한가, false);
});

test('v1.24 문서는 기존 앵커로 읽되 새 마커 일부를 옛 형식으로 숨기지 않는다', () => {
  const 원문 = '**한 문장: 합성 목적**\n\n**3. 「똑똑하게」**\n합성 기준\n\n'
    + '> **그리고 우리가 하지 않는 것 셋**\n> 경계\n\n'
    + '⚠**적용 대상을 가른다** 합성 적용\n\n**「이해」는 세 층이다**\n- 합성 층\n';
  assert.equal(카드.철학구획(원문).완전한가, true);
  assert.equal(카드.철학구획(원문).방식, 'v1.24');
  assert.equal(카드.철학구획(원문 + '<!-- 철학: purpose 시작 -->').완전한가, false);
});

const 제안 = { 제목: '모델 기능 활용', 왜: '기존 관찰', 무엇을: '기능 개선', 구현방향: '기존 통로', 크기: '소', 관련기능: '합성 기능' };
const 기준 = { 철학: 'philosophy1', 방향: 'direction1', 변경: 'code1' };
const 기각 = { ...제안, ...기준, 상태: '기각', 사유: '당시 기능이 없음', 판정기준: { ...기준, 시각: '2026-08-01' } };
function 재안(이전, p = 제안, 현재 = 기준) {
  return 검수.선파악행들({ 종류: 'commit', 값: 'current' }, { 제안: [p] },
    new Map([[검수.제안키(p), 이전]]), '2026-09-09', 현재.방향, 현재.변경, 현재.철학);
}

test('같은 제목·같은 근거·같은 판단 기준은 다시 올리지 않는다', () => {
  assert.equal(재안(기각).신규.length, 0);
  assert.equal(재안(기각, { ...제안, 왜: '문장만 다르게 표현' }).신규.length, 0);
  assert.equal(재안({ 상태: '기각', 사유: '옛 기록에 지문 없음' }).신규.length, 0);
});

for (const 필드 of ['철학', '방향', '변경']) {
  test(`${필드}의 현재 지문이 달라지면 이유와 당시 판정을 보존하여 재심한다`, () => {
    const 결과 = 재안(기각, 제안, { ...기준, [필드]: 'new-value' });
    assert.equal(결과.신규.length, 1);
    assert.equal(결과.신규[0].재심.이전판정.사유, 기각.사유);
    assert.deepEqual(결과.신규[0].재심.변경근거, [`${필드} 지문 변경`]);
  });
}

test('새 관찰을 명시한 재심은 지문이 같아도 가능하며 재기각 뒤 변함없는 반복은 막는다', (t) => {
  const 새제안 = { ...제안, 왜: '당시 기능이 없음. 재심 근거: 공식 기능을 실제 입력으로 확인했다.' };
  const 결과 = 재안(기각, 새제안);
  assert.equal(결과.신규.length, 1);
  const k = 검수.제안키(제안);
  const 옛제안행 = { ...제안, ...기준, 키: k, 종류: '제안' };
  const 옛판정행 = { ...기준, 키: k, 종류: '판정', 상태: '기각', 사유: 기각.사유 };
  const 행들 = [옛제안행, 옛판정행, ...결과.기록행들];
  const p = 임시문서(t, '제안.jsonl', 행들.map(JSON.stringify).join('\n'));
  let 현황 = 검수.제안현황(p).get(k);
  assert.equal(현황.상태, '제안됨');
  assert.equal(현황.재심.이전판정.사유, 기각.사유);
  assert.equal(fs.readFileSync(p, 'utf8').split('\n').length, 행들.length);
  fs.appendFileSync(p, '\n' + JSON.stringify({ ...기준, 종류: '판정', 키: k, 상태: '기각', 사유: '새 관찰을 보아도 미채택' }));
  현황 = 검수.제안현황(p).get(k);
  assert.equal(재안(현황, 새제안).신규.length, 0);
});

test('미검증 새 근거와 채택 표식을 넣어도 재심은 미판정 제안만 만들며 실행 허가로 세지 않는다', (t) => {
  const 새제안 = { ...제안, 왜: '재심 근거: 검증되지 않은 주장', 상태: '채택', 종류: '판정', 키: '임의키', 철학: '임의지문' };
  const 결과 = 재안(기각, 새제안);
  const k = 검수.제안키(제안);
  const p = 임시문서(t, '제안.jsonl', [
    { ...제안, ...기준, 키: k, 종류: '제안' },
    { ...기준, 키: k, 종류: '판정', 상태: '기각', 사유: 기각.사유 },
    ...결과.기록행들,
  ].map(JSON.stringify).join('\n'));
  const 현황 = 검수.제안현황(p);
  assert.equal(현황.get(k).상태, '제안됨');
  assert.equal(결과.기록행들[1].종류, '제안');
  assert.equal(현황.get(k).철학, 기준.철학);
  assert.deepEqual(검수.채택제안줄들(현황), []);
  assert.equal(재안({ ...기각, 상태: '채택' }, 새제안).신규.length, 0);
});

test('현행 운영·결정 원문을 읽으며 개인 memory 환경변수와 색인은 읽지 않는다', () => {
  const 기존 = process.env.SYNK_MEMORY_INDEX;
  process.env.SYNK_MEMORY_INDEX = 'PERSONAL_MEMORY_MUST_NOT_BE_READ';
  const 읽기 = fs.readFileSync;
  const 읽은것 = [];
  fs.readFileSync = function(p, ...args) {
    const 이름 = String(p);
    assert.doesNotMatch(이름, /PERSONAL_MEMORY_MUST_NOT_BE_READ|[\\/]MEMORY\.md$|[\\/]지도\.md$/);
    읽은것.push(이름);
    return 읽기.call(this, p, ...args);
  };
  try {
    const 본문 = 검수.금지목록(undefined, 검수.철학경로);
    assert.ok(읽은것.some((p) => p.endsWith('AI_운영원칙.md')));
    assert.ok(읽은것.some((p) => p.endsWith('결정.md')));
    assert.match(본문, /과거 기각은 당시 이유와 달라진 근거/);
    assert.match(본문, /보호 경계는 유지/);
    assert.equal(본문.includes(읽기.call(fs, 읽은것.find((p) => p.endsWith('결정.md')), 'utf8').trim()), false);
  } finally {
    fs.readFileSync = 읽기;
    if (기존 === undefined) delete process.env.SYNK_MEMORY_INDEX;
    else process.env.SYNK_MEMORY_INDEX = 기존;
  }
});
