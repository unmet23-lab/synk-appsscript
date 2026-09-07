'use strict';
/**
 * 🗣 증언 그릇 — 학생의 말이 «번호와 함께» 남고, 밖에 낼 때만 가려지며, ㉢ 삶 이해가 그 말을 읽는가
 * (09-07 · 브랜드 v2 ㉡-2 · 트랙 §0-명품 3번)
 *
 * ■ 이 시험이 재는 것
 *   ① 남기기(증언남기기_) — 번호·출처·물음·답 넷이 있어야 한 줄 · 빈 답은 안 남긴다 · 같은 말은 한 줄(멱등) · 남의 글은 셀안전_ 을 지난다.
 *   ② 읽기(증언맵_) — 학생별 최근 둘 · 창 밖은 안 읽는다 · 이름은 안 싣는다 · 140자 캡.
 *   ③ 반출(증언반출_) — 번호 0 · 시각은 달까지 · 이름 조각이 든 답은 뺀다(몇 건 뺐나 동봉) · 명단을 못 읽으면 안 내보낸다.
 *   ④ 배선 — 골격에 수집 표식으로 서고, 도달 장부의 소비자가 aiStudioBatch_ ① 이며(대장칸 ㉢ · 밤마다), ① 절이 되받기 지시와 함께 싣고,
 *      ③ 반 브리핑은 이 말을 안 읽는다(반 단위 글에 개인의 말을 실으면 그 자리가 곧 노출이다).
 *
 * ■ 왜 소스 모양까지 재나 — 심문(제미나이)이 짚은 「모을 때 끊는 것과 밖에 낼 때 가리는 것을 혼동해 재료를 휘발시키는
 *   조용한 실패」는 함수 하나가 아니라 배선(어디서 읽나)에서 난다. 그릇만 서고 아무도 안 읽으면 ㉡-2 는 미완이다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { engineSource } = require('./_engine-source');
const code = engineSource();

function section(시작, 끝) {
  const s = code.indexOf(시작);
  assert.notEqual(s, -1, `시작 표식을 찾지 못함: ${시작}`);
  const e = code.indexOf(끝, s + 시작.length);
  assert.notEqual(e, -1, `끝 표식을 찾지 못함: ${끝}`);
  return code.slice(s, e);
}

const 상수절 = section("const TESTIMONY_TAB_ = 'testimony_log';", 'function ');
/* 그릇절 = 상한 상수부터 증언반출_ 직전까지(지문·남기기·맵) · 반출절 = 마지막 함수의 닫는 괄호까지. */
const 그릇절 = code.slice(code.indexOf('const TESTIMONY_ANSWER_MAX_ = 500;'), code.indexOf('function 증언반출_('));
const 끝 = code.indexOf('function 증언반출_(');
const 반출절 = code.slice(끝, code.indexOf('\n}\n', 끝) + 3);
const 살균절 = section('function 이름살균_(', 'function 문항지문_(');
const HEADERS = ['id', 'student_id', '시각', '출처', '물음', '답', '맥락', '시즌'];

/** 시트 흉내 — 행 배열 하나. appendRow/getRange/getValues/getLastRow/getLastColumn 만. */
function 시트(rows, w) {
  const sh = {
    rows: rows.slice(),
    appended: [],
    getLastRow() { return this.rows.length + 1; },
    getLastColumn() { return w || HEADERS.length; },
    appendRow(r) { this.appended.push(r); this.rows.push(r); },
    getRange(r, c, n, cw) {
      const self = this;
      return { getValues() { return self.rows.slice(r - 2, r - 2 + n).map(row => row.slice(c - 1, c - 1 + cw)); } };
    },
  };
  return sh;
}

function 엔진(opts) {
  const o = opts || {};
  const sh = o.sheet === null ? null : (o.sheet || 시트([]));
  const ss = {
    getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar',
    getSheetByName: (n) => (n === 'testimony_log' ? sh : (n === 'profiles' ? (o.profiles === undefined ? {} : o.profiles) : null)),
  };
  const ensureSheet = (s, name, headers) => { assert.equal(name, 'testimony_log'); assert.deepEqual(headers, HEADERS); return sh; };
  const Utilities = {
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (alg, s) => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map(b => (b > 127 ? b - 256 : b)),
    formatDate: (d) => {
      const p = (n) => ('0' + n).slice(-2);
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    },
  };
  const 셀안전_ = (v) => (/^[=+\-@\t\r]/.test(v) ? "'" + v : v);
  const toDate_ = (v) => (v instanceof Date ? v : null);
  const 명단이름_ = () => (o.names === undefined ? ['바트', 'bat'] : o.names);
  const E = new Function('ensureSheet', 'Utilities', '셀안전_', 'toDate_', '명단이름_',
    `${상수절}\n${살균절}\n${그릇절}\n${반출절}\nreturn { 증언지문_, 증언남기기_, 증언맵_, 증언반출_, 이름살균_ };`)(ensureSheet, Utilities, 셀안전_, toDate_, 명단이름_);
  return { E, ss, sh };
}

/* ───────────────────── ① 남기기 ───────────────────── */
test('[증언] 넷(번호·출처·물음·답)이 있어야 한 줄 — 빈 답은 안 남긴다(「없다」는 낱말로 보내야 남는다)', () => {
  const { E, ss } = 엔진();
  assert.deepEqual(E.증언남기기_(ss, { 출처: '회고', 물음: 'q', 답: 'a' }), { ok: false, error: 'no-student' });
  assert.deepEqual(E.증언남기기_(ss, { student_id: 'S1', 물음: 'q', 답: 'a' }), { ok: false, error: 'no-question' });
  assert.deepEqual(E.증언남기기_(ss, { student_id: 'S1', 출처: '회고', 물음: 'q', 답: '   ' }), { ok: false, error: 'empty' });
  const r = E.증언남기기_(ss, { student_id: 'S1', 출처: '회고', 물음: '안다고 느낀 것이 있었나요?', 답: '없다', 시즌: '2026-11-30', 시각: '2027-01-24T10:00:00' });
  assert.equal(r.ok, true);
  assert.equal(r.중복, false);
  assert.equal(r.id.length, 12);
  assert.equal(ss.getSheetByName('testimony_log').appended.length, 1);
  const row = ss.getSheetByName('testimony_log').appended[0];
  assert.equal(row.length, HEADERS.length, '칸 수 = 헤더 수');
  assert.equal(row[1], 'S1');
  assert.equal(row[5], '없다', '「없다」도 그대로 남는다 — 그게 최저점 원천이다');
  assert.equal(row[7], '2026-11-30');
  assert.ok(/^2027-01-24 \d\d:\d\d$/.test(row[2]), '시각은 분까지: ' + row[2]);
});

test('[증언] 같은 말은 한 줄(멱등) — 두 번 보내도 둘째는 중복으로 돌려주고 안 쓴다', () => {
  const { E, ss } = 엔진();
  const 입력 = { student_id: 'S1', 출처: '회고', 물음: 'q', 답: '한국 회사에서 일하고 싶어요', 시각: '2027-01-24T10:00:00' };
  const a = E.증언남기기_(ss, 입력);
  const b = E.증언남기기_(ss, 입력);
  assert.equal(a.중복, false);
  assert.equal(b.중복, true);
  assert.equal(a.id, b.id);
  assert.equal(ss.getSheetByName('testimony_log').appended.length, 1);
  const c = E.증언남기기_(ss, Object.assign({}, 입력, { 답: '다른 말' }));
  assert.equal(c.중복, false, '답이 다르면 다른 줄이다');
});

test('[증언] 남의 글은 셀안전_ 을 지난다 — = 로 시작하는 답이 수식이 되지 않는다 · 500자에서 자른다', () => {
  const { E, ss } = 엔진();
  E.증언남기기_(ss, { student_id: 'S1', 출처: '회고', 물음: 'q', 답: '=1+1', 맥락: '=x' });
  const row = ss.getSheetByName('testimony_log').appended[0];
  assert.equal(row[5], "'=1+1");
  assert.equal(row[6], "'=x");
  E.증언남기기_(ss, { student_id: 'S2', 출처: '회고', 물음: 'q', 답: 'a'.repeat(900) });
  assert.equal(ss.getSheetByName('testimony_log').appended[1][5].length, 500);
});

/* ───────────────────── ② 읽기 ───────────────────── */
test('[증언] 증언맵_ — 학생별 최근 둘 · 창 밖은 안 읽는다 · 이름 0 · 시트가 없으면 빈 맵(0 은 분모와 함께)', () => {
  const now = Date.now();
  const d = (일전) => new Date(now - 일전 * 86400000);
  const rows = [
    ['i1', 'S1', d(3), '회고', '왜 배우나', '회사 때문에', '', ''],
    ['i2', 'S1', d(1), '회고', '느낀 것', '있다 — 내 이름을 기억해 줬다', '', ''],
    ['i3', 'S1', d(10), '상담', '목표', '옛 말', '', ''],
    ['i4', 'S2', d(200), '회고', '느낀 것', '창 밖', '', ''],
    ['i5', '', d(1), '회고', 'q', '번호 없음', '', ''],
  ];
  const { E, ss } = 엔진({ sheet: 시트(rows) });
  const r = E.증언맵_(ss, 120);
  assert.equal(r.건수, 3, '창 안 + 번호 있는 것만');
  assert.equal(r.학생수, 1);
  assert.ok(r.맵.S1.indexOf('내 이름을 기억해 줬다') > -1 && r.맵.S1.indexOf('회사 때문에') > -1, r.맵.S1);
  assert.ok(r.맵.S1.indexOf('옛 말') === -1, '셋째(오래된 것)는 안 싣는다');
  assert.ok(r.맵.S1.indexOf('느낀 것 → ') < r.맵.S1.indexOf('왜 배우나 → '), '최근 것이 앞');
  assert.equal(r.맵.S2, undefined);
  assert.ok(r.맵.S1.length <= 140);
  const 빈 = 엔진({ sheet: null });
  assert.deepEqual(빈.E.증언맵_(빈.ss), { 맵: {}, 건수: 0, 학생수: 0 });
});

/* ───────────────────── ③ 반출 ───────────────────── */
test('[증언] 증언반출_ — 번호 0 · 시각은 달까지 · 이름 조각이 든 답은 빼고 몇 건 뺐나를 낸다 · 명단을 못 읽으면 안 내보낸다', () => {
  const rows = [
    ['i1', 'S1', '2027-01-24 10:00', '회고', '느낀 것', '있다 — 바트 선생님이 기억해 줬다', '', ''],
    ['i2', 'S1', '2027-01-24 10:01', '회고', '느낀 것', '한국 회사에서 일하고 싶어요', '', ''],
  ];
  const a = 엔진({ sheet: 시트(rows) });
  const r = a.E.증언반출_(a.ss);
  assert.equal(r.뺀건수, 1);
  assert.deepEqual(r.판, [{ 월: '2027-01', 출처: '회고', 물음: '느낀 것', 답: '한국 회사에서 일하고 싶어요' }]);
  assert.ok(!JSON.stringify(r.판).includes('S1'), '밖으로 나가는 판에 학생 번호가 있다');
  const b = 엔진({ sheet: 시트(rows), names: null });
  assert.equal(b.E.증언반출_(b.ss), null, '명단을 못 읽으면 살균을 못 하니 안 내보낸다(fail-closed)');
});

/* ───────────────────── ④ 배선 ───────────────────── */
test('[증언] 골격 — testimony_log 가 수집 표식으로 서고, 헤더 정본은 소비자 파일(엔진_콘텐츠AI.js) 한 곳이다', () => {
  const 골격 = section('function sheetSkeleton_() {', 'function 수집장부탭_() {');
  const 줄 = 골격.split('\n').filter(l => l.indexOf('[TESTIMONY_TAB_, TESTIMONY_HEADERS, 수집표식_]') > -1);
  assert.equal(줄.length, 1, '골격에 증언 탭이 정확히 한 줄');
  assert.equal((code.match(/const TESTIMONY_HEADERS = /g) || []).length, 1, '헤더 정본이 두 곳이면 갈린다');
  assert.ok(/^const TESTIMONY_HEADERS = \['id', 'student_id', '시각', '출처', '물음', '답', '맥락', '시즌'\];/m.test(code));
});

test('[증언] 도달 장부 — 소비자 = 엔진_콘텐츠AI.js:aiStudioBatch_ · 제품층 · 밤마다 · 대장칸 ㉢(삶) — 그릇만 서고 안 읽히면 미완이다', () => {
  const 장부 = section('function 수집도달_() {', 'function 시트도달상한_() {');
  assert.ok(/\[TESTIMONY_TAB_\]: \{ 소비자: '엔진_콘텐츠AI\.js:aiStudioBatch_', 층: '제품', 회수: '밤마다', 대장칸: '㉢' \}/.test(장부),
    '증언 탭의 도달 칸이 없거나 다르다');
});

test('[증언] aiStudioBatch_ ① — 증언맵_ 을 부르고 「스스로 한 말」 칸으로 싣고 되받기 지시가 있다 · ③ 반 브리핑은 안 읽는다', () => {
  const 본문 = section('function aiStudioBatch_() {', '// ③ H5 반 브리핑 한 줄');
  assert.ok(/const 증언 = typeof 증언맵_ === 'function' \? 증언맵_\(ss\)/.test(본문), '① 절이 증언맵_ 을 안 부른다');
  assert.ok(/const tm = 증언\.맵\[s\.id\] \|\| '';/.test(본문));
  assert.ok(/\(tm \? ' \| 스스로 한 말: ' \+ tm : ''\)/.test(본문), '별도 칸으로 실어야 slice(-2) 가 손메모를 안 밀어낸다');
  assert.ok(/「스스로 한 말」이 실려 있으면 응원 한 문장이 그 말을 되받는다/.test(본문), '재료만 실으면 모델이 무시한다 — 지시가 있어야 한다');
  assert.ok(/🚫 스스로 한 말을 평가하거나 고치지 않는다/.test(본문), '그 말은 채점 대상이 아니다');
  const 뒤 = code.slice(code.indexOf('// ③ H5 반 브리핑 한 줄'), code.indexOf('// ③ H5 반 브리핑 한 줄') + 6000);
  assert.ok(!/증언\.맵|증언맵_/.test(뒤), '반 브리핑이 개인의 말을 읽는다 — 반 단위 글에 실리면 그 자리가 곧 노출이다');
});
