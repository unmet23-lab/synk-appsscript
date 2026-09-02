'use strict';
/* 동의 이력 원장 회귀 — 2026-09-02 (유호 위임 「철학에 빗대 최선을 골라줘」)
 *
 * 무엇을 지키나: **「그때 동의했나」가 남는가.**
 *   동의 문구가 「학습에 들어간 데이터는 되돌릴 수 없다」를 명문화했으므로 그 근거는
 *   «들어갈 때의 동의 상태»다. 그런데 09-02 실측: 시트 층 수집면 어디에도 그 기록이 없었고,
 *   상담시트는 **지금 값**만 안다 — 학생이 내년에 철회하면 작년 행을 못 가른다.
 *   🔴 **옛 행에 지어 넣을 수 없으므로 학생이 오기 전에만 열 수 있는 자리다.**
 *
 * ⚠ 여기서 재는 것은 **판정 코어**(`consentDiff_`)뿐이다 — 시트 래퍼는 라이브 Sheets 를 부르므로
 *   회귀가 못 잡는다(v9.197 자기선언 이력과 같은 선). 그 층은 «안 재봤다».
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
/* ⚠ 줄끝을 먼저 고른다 — 작업본이 CRLF 라 LF 표식으로 자르면 「함수 끝을 못 찾는다」로 죽는다. */
const 소스 = () => fs.readFileSync(path.join(ROOT, '엔진_폼리포트.js'), 'utf8').replace(/\r\n/g, '\n');

function 뽑기(이름) {
  const src = 소스();
  const s = src.indexOf(`function ${이름}(`);
  assert.ok(s > -1, `${이름} 을 못 찾았다 — 이름이 바뀌었으면 이 시험부터 고친다`);
  const e = src.indexOf('\n}\n', s);
  assert.ok(e > s, '함수 끝을 못 찾았다');
  return new Function(src.slice(s, e + 2) + `\nreturn ${이름};`)();
}

const diff = 뽑기('consentDiff_');

test('🔴 첫 관측이 «보류»면 안 적는다 — 미응답 전원이 의미 없이 깔리면 원장이 소음이 된다', () => {
  const last = {};
  assert.deepStrictEqual(diff({ S1: '', S2: '' }, last, '2026-09-02', 'v19.0'), []);
  assert.deepStrictEqual(last, {}, '안 적었으면 기억도 안 남긴다');
});

test('첫 «동의»는 한 줄로 남는다', () => {
  const last = {};
  assert.deepStrictEqual(diff({ S1: 'yes' }, last, '2026-09-02', 'v19.0'),
    [['S1', 'v19.0', 'yes', '2026-09-02']]);
  assert.strictEqual(last.S1, 'v19.0|yes');
});

test('안 바뀌면 쓰기 0 — 매일 도는 배치가 같은 줄을 쌓으면 원장이 곧 못 읽는다', () => {
  const last = { S1: 'v19.0|yes' };
  assert.deepStrictEqual(diff({ S1: 'yes' }, last, '2026-09-03', 'v19.0'), []);
});

test('(옛 꼴 문자열 맵 · 회귀 픽스처 호환) 문자열 맵일 때만 ver 가 판이다 — 실제 래퍼는 행의 판을 쓴다(v9.291)', () => {
  const last = { S1: 'v19.0|yes' };
  assert.deepStrictEqual(diff({ S1: 'yes' }, last, '2026-09-03', 'v20.0'),
    [['S1', 'v20.0', 'yes', '2026-09-03']]);
});

test('🔴 판은 «그 학생 행에 찍힌 판»이다 — 전역 판이 올라도 행의 판이 그대로면 새 줄이 없다(허위 동의 금지 · 09-02 codex P1)', () => {
  const last = { S1: 'v19.0|yes' };
  assert.deepStrictEqual(diff({ S1: { 상태: 'yes', 판: 'v19.0' } }, last, '2026-10-01 23:30:00', 'v20.0'), []);
  assert.strictEqual(last.S1, 'v19.0|yes', '기억이 전역 판으로 바뀌었다');
});

test('🔑 행의 판이 바뀌면(재동의) 같은 yes 라도 한 줄 — 그때만 «새 판에 동의»다', () => {
  const last = { S1: 'v19.0|yes' };
  assert.deepStrictEqual(diff({ S1: { 상태: 'yes', 판: 'v20.0' } }, last, '2026-10-02 23:30:00', 'v20.0'),
    [['S1', 'v20.0', 'yes', '2026-10-02 23:30:00']]);
});

test('판을 모르면(아직 안 찍힘) 모른다고 적고, 스탬프가 찍히면 «판을 알게 됐다»가 한 줄 더 남는다 — 전역 판으로 지어 넣지 않는다', () => {
  const last = {};
  assert.deepStrictEqual(diff({ S1: { 상태: 'yes', 판: '' } }, last, 'd1', 'v19.0'), [['S1', '', 'yes', 'd1']]);
  assert.deepStrictEqual(diff({ S1: { 상태: 'yes', 판: 'v19.0' } }, last, 'd2', 'v19.0'), [['S1', 'v19.0', 'yes', 'd2']]);
  assert.deepStrictEqual(diff({ S1: { 상태: 'yes', 판: '기록전(≤v19.0)' } }, {}, 'd3', 'v19.0'), [['S1', '기록전(≤v19.0)', 'yes', 'd3']], '스탬프 문자열을 고쳐 읽지 않고 그대로 적는다');
});

test('🔒 래퍼는 잠금을 잡고(중복 append 방지) 행의 판을 읽는 통로를 쓰며 시각을 초까지 남긴다 (09-02 codex P2 985c1a06b915 · 기능체크 5fcd8b1ab5f4·4047493e84c6)', () => {
  const 본문 = 소스();
  const s = 본문.indexOf('function consentLogNightly_(');
  const 몸 = 본문.slice(s, 본문.indexOf('\n}\n', s));
  assert.match(몸, /LockService\.getScriptLock\(\)/, '잠금이 없다 — 야간 트리거와 손 실행이 겹치면 같은 줄이 두 번 적힌다');
  assert.match(몸, /tryLock\(/, 'tryLock 이 아니면 기다리다 두 번 적는다');
  assert.match(몸, /releaseLock\(\)/, '잠금을 안 푼다');
  assert.match(몸, /voiceConsentRead_\(\)/, '행의 판을 읽는 통로(voiceConsentRead_)를 안 쓴다 — 전역 판이 다시 찍힌다');
  assert.match(몸, /yyyy-MM-dd HH:mm:ss/, '기록 시각이 날짜뿐이다 — 같은 날 수집 행과 앞뒤를 못 가른다');
});

test('읽기 통로 하나 — voiceConsentMap_ 은 voiceConsentRead_ 에서 상태만 뽑는다(두 곳이 시트를 읽으면 판정이 갈린다)', () => {
  const 본문 = 소스();
  const s = 본문.indexOf('function voiceConsentMap_(');
  const 몸 = 본문.slice(s, 본문.indexOf('\n}\n', s));
  assert.match(몸, /voiceConsentRead_\(\)/);
  assert.doesNotMatch(몸, /openById/, 'voiceConsentMap_ 이 시트를 제 손으로 다시 읽는다');
});

test('🔑 철회(yes→no)가 남는다 — 이 원장의 존재 이유가 바로 이 줄이다', () => {
  const last = { S1: 'v19.0|yes' };
  assert.deepStrictEqual(diff({ S1: 'no' }, last, '2026-09-10', 'v19.0'),
    [['S1', 'v19.0', 'no', '2026-09-10']]);
});

test('값이 있던 사람이 «보류»로 돌아간 것도 사실이라 남긴다(첫 관측 보류와 갈린다)', () => {
  const last = { S1: 'v19.0|yes' };
  assert.deepStrictEqual(diff({ S1: '' }, last, '2026-09-10', 'v19.0'),
    [['S1', 'v19.0', '', '2026-09-10']]);
});

test('여러 학생이 섞여도 «바뀐 사람만» 나온다', () => {
  const last = { S1: 'v19.0|yes', S2: 'v19.0|no' };
  const out = diff({ S1: 'yes', S2: 'yes', S3: 'yes' }, last, '2026-09-11', 'v19.0');
  assert.deepStrictEqual(out.map((r) => r[0]).sort(), ['S2', 'S3']);
});

test('🔴 판정 불가(map=null)면 «아무것도 안 적는다» — 빈 맵으로 접으면 「전원 보류」가 사실처럼 박힌다', () => {
  const 본문 = 소스();
  const s = 본문.indexOf('function consentLogNightly_(');
  const 몸 = 본문.slice(s, 본문.indexOf('\n}\n', s));
  assert.match(몸, /if \(!map\)/, 'null 갈래가 없다 — voiceConsentMap_ 의 보류 원칙이 여기서 깨진다');
  assert.match(몸, /판정 불가/, '왜 안 적는지가 로그에 안 남는다');
  assert.ok(!/voiceConsentMap_\(\) \|\| \{\}/.test(몸), 'null 을 빈 맵으로 접고 있다');
});

test('원장이 골격에 등재되고 «수집 표식»을 단다 — 안 달면 도달 감시 눈 밖에서 조용히 0이 된다', () => {
  const s = fs.readFileSync(path.join(ROOT, '엔진_셋업확장.js'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(s, /\[CONSENT_LOG_TAB_,\s*CONSENT_LOG_HEADERS,\s*수집표식_\]/);
  assert.match(s, /safeRun\('consentLog', consentLogNightly_\)/, '야간 배치에 안 물려 있다 — 스스로 발화하지 않는 장치는 안 돈다');
});
