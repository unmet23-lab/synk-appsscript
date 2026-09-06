'use strict';
/**
 * 골든 픽스처 이름 살균 — 학생이 제 이름을 적은 문장은 밖으로 안 나간다 (2026-09-06 · 유호 확정 「출구는 살균을 먼저」)
 *
 * ■ 무엇을 지키나
 *   `pushGoldenFixture_` 의 목적지는 공개 저장소의 영구 기록이다(철학 Ⅰ ㉣ 경계 ⑧ 아래). 비식별 조립이라도
 *   자유 서술 칸에 학생이 제 이름(또는 반 친구 이름)을 적으면 그 이름이 그대로 나간다. 그래서
 *   ① 명단(profiles)의 이름 조각이 든 항목은 픽스처에서 빠지고 그 수가 요약에 남는다
 *   ② 명단을 못 읽으면(시트 없음) **내보내지 않는다** — 「살균 0건」과 「살균 못 함」은 다른 얼굴이다
 *
 * ■ 재는 법 — 정본 함수를 그대로 태운다(스텁으로 채우면 그 함수가 깨져도 초록). 시트는 흉내(공용 통로).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { engineSource } = require('./_engine-source');
const { 시트흉내 } = require('./lib/시트흉내.js');

const code = engineSource();
function section(시작, 끝) {
  const s = code.indexOf(시작);
  assert.notEqual(s, -1, `시작 표식을 찾지 못함: ${시작}`);
  const e = code.indexOf(끝, s + 시작.length);
  assert.notEqual(e, -1, `끝 표식을 찾지 못함: ${끝}`);
  return code.slice(s, e);
}
function 불러오기(시작, 끝, 이름, 의존) {
  const src = section(시작, 끝);
  const n = Object.keys(의존);
  return new Function(...n, `${src}\nreturn ${이름};`)(...n.map((k) => 의존[k]));
}
/** 함수 하나를 «닫는 괄호까지» 잘라 온다 — 끝 표식을 다음 블록으로 잡으면 그 사이 남의 코드가 딸려 온다. */
function 함수(이름, 의존 = {}) {
  const s = code.indexOf(`function ${이름}(`);
  assert.notEqual(s, -1, `함수를 찾지 못함: ${이름}`);
  const e = code.indexOf('\n}\n', s);
  assert.notEqual(e, -1, `함수의 끝을 찾지 못함: ${이름}`);
  const src = code.slice(s, e + 2);
  const n = Object.keys(의존);
  return new Function(...n, `${src}\nreturn ${이름};`)(...n.map((k) => 의존[k]));
}

const GOLD_HEADERS = JSON.parse(code.match(/const GOLD_HEADERS = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));
const GOLD_VERDICTS = JSON.parse(code.match(/const GOLD_VERDICTS = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));
const 역소독_ = 함수('역소독_');
const 명단이름_ = 불러오기('function 명단이름_(ss)', '/* [vNEXT] 문장에 명단 이름 조각이', '명단이름_', {});
const 이름살균_ = 불러오기('function 이름살균_(이름들, 글)', '/* [vNEXT] 문항 지문', '이름살균_', {});
const FIXTURE_MIN_LEN = Number(code.match(/const FIXTURE_MIN_LEN = (\d+)/)[1]);
const fixtureDiff_ = 불러오기('function fixtureDiff_(원문, 교정)', '\nfunction 골든픽스처_', 'fixtureDiff_', { FIXTURE_MIN_LEN });

/** profiles 한 행 — user_id · 이름 · 이름_몽골 · role(3) */
const 학생 = (id, 이름) => { const r = new Array(15).fill(''); r[0] = id; r[1] = 이름; r[3] = 'student'; return r; };
/** teacher_gold 한 행 — 원문(4) · AI교정(5) · 강사판정(6) · 강사교정(7) · 오류태그(9) */
const 정답행 = (원문, 판정, 교정 = '', 태그 = '조사') => {
  const r = new Array(GOLD_HEADERS.length).fill('');
  r[4] = 원문; r[5] = 교정 || 원문; r[6] = 판정; r[7] = 교정; r[9] = 태그;
  return r;
};

function 골든(ss) {
  const 의존 = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    Utilities: { formatDate: () => '2026-09-06' },
    GOLD_HEADERS, GOLD_VERDICTS, 역소독_, fixtureDiff_, 명단이름_, 이름살균_,
    FIXTURE_MIN_LEN: Number(code.match(/const FIXTURE_MIN_LEN = (\d+)/)[1]),
    HW_ERROR_TAGS: ['조사', '오류없음'],
  };
  return 불러오기('function 골든픽스처_()', '/* [vNEXT] 명단의 이름 조각', '골든픽스처_', 의존)();
}
const 시트들 = (표) => ({
  getSheetByName: (n) => (표[n] ? 시트흉내({ 첫행: 2, 행들: 표[n] }) : null),
  getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar',
});

test('명단 이름 조각 — 어절로 쪼개고 한 글자는 버린다(조사·어미와 겹친다) · 몽골어 표기 칸(C)과 퇴소 명단도 든다', () => {
  const 학생C = (id, 이름, 몽골) => { const r = 학생(id, 이름); r[2] = 몽골; return r; };
  const ss = 시트들({
    profiles: [학생C('S1', '바트 에르덴', 'Бат-Эрдэнэ'), 학생('S2', 'Sarnai'), ['S9', '김', '', 'teacher']],
    exit_log: [['S7', '냠카', '', '2026-05-01']],     // 퇴소자 — profiles 에서 지워졌지만 teacher_gold 문장은 남는다(보안 검토 09-06)
  });
  const 조각 = 명단이름_(ss).sort();
  assert.deepEqual(조각, ['sarnai', 'бат', 'эрдэнэ', '냠카', '바트', '에르덴']);
  assert.equal(이름살균_(조각, '저는 바트예요'), true);
  assert.equal(이름살균_(조각, 'SARNAI 랑 갔어요'), true, '대소문자를 무시해야 한다');
  assert.equal(이름살균_(조각, '제 이름은 Бат입니다'), true, '몽골어 표기(C 칸)가 사전에 없다');
  assert.equal(이름살균_(조각, '냠카랑 놀았어요'), true, '퇴소한 학생 이름이 사전에 없다');
  assert.equal(이름살균_(조각, '오늘 학원에 갔어요'), false);
});

test('🔴 이름이 든 문장은 픽스처에서 빠지고 요약에 «몇 건 뺐나»가 남는다', () => {
  const ss = 시트들({
    profiles: [학생('S1', '바트')],
    teacher_gold: [
      정답행('오늘 학원에 갔어요', GOLD_VERDICTS[2]),                 // 원문이 이미 맞다 — 정상 표본
      정답행('저는 바트입니다 학교을 가요', GOLD_VERDICTS[1], '저는 바트입니다 학교에 가요'), // 이름 — 빠져야 한다
      정답행('친구을 만났어요', GOLD_VERDICTS[1], '친구를 만났어요'),
    ],
  });
  const r = 골든(ss);
  assert.equal(typeof r, 'object', r);
  assert.equal(r.건수, 2, '이름이 든 항목이 빠져야 한다');
  assert.equal(r.살균제외, 1);
  assert.ok(r.doc.항목.every((x) => !x.입력.includes('바트') && !x.기대교정.includes('바트')), '이름이 실려 나갔다');
  assert.match(r.요약, /이름 살균 제외 1/);
  assert.ok(r.doc.한계.some((l) => /이름 살균으로 제외 1건/.test(l)), '한계 줄에 살균 수가 없다');
});

test('🔴 명단을 못 읽으면 내보내지 않는다 — 「살균 0건」과 「살균 못 함」은 다른 얼굴이다', () => {
  const ss = 시트들({ teacher_gold: [정답행('오늘 학원에 갔어요', GOLD_VERDICTS[2])] });
  const r = 골든(ss);
  assert.equal(typeof r, 'string', '명단 없이 객체가 나왔다 — 살균 없이 나간다');
  assert.match(r, /살균 없이는 내보내지 않는다/);
});

test('명단은 있는데 학생이 0명이면 살균 0건으로 그대로 나간다(빈 명단 ≠ 못 읽음)', () => {
  const ss = 시트들({ profiles: [['S9', '김', '', 'teacher']], teacher_gold: [정답행('오늘 학원에 갔어요', GOLD_VERDICTS[2])] });
  const r = 골든(ss);
  assert.equal(typeof r, 'object', r);
  assert.equal(r.살균제외, 0);
  assert.equal(r.살균이름수, 0);
});
