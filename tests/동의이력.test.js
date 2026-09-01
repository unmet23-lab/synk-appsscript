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

test('🔑 동의판이 바뀌면 «같은 yes 라도» 한 줄 남는다 — 어느 문구에 동의했나가 다른 사실이다', () => {
  const last = { S1: 'v19.0|yes' };
  assert.deepStrictEqual(diff({ S1: 'yes' }, last, '2026-09-03', 'v20.0'),
    [['S1', 'v20.0', 'yes', '2026-09-03']]);
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
