'use strict';
/**
 * 🗣 증언 그릇 — 학생의 말이 «번호와 함께» 남고, 밖에 낼 때만 가려지며, ㉢ 삶 이해가 그 말을 읽는가
 * (09-07 · 브랜드 v2 ㉡-2 · 트랙 §0-명품 3번 · v9.324 손질 = 코덱스 검수 49eb769 의 넷)
 *
 * ■ 이 시험이 재는 것
 *   ① 남기기(증언남기기_) — 번호·출처·물음·답 넷이 있어야 한 줄 · 빈 답은 안 남긴다 · 같은 말은 언제 다시 보내도 한 줄(지문에 시각 없음 · 잠금) ·
 *      원문은 공백·줄바꿈 그대로(2000자) · 남의 글은 셀안전_ 을 지난다 · 화자(학생|보호자)와 판(schema_ver)이 끝 두 칸에 선다.
 *   ② 검문(증언비식별_) — 명단 이름 조각 · 긴 숫자열 · 이메일 · 손잡이 · 학생 번호 꼴 · 주소가 들면 그 줄은 안 나간다 · 명단이 없으면 검문 불가(null).
 *   ③ 읽기(증언맵_) — 학생 화자만 · 창(일수 또는 시즌 창) 안만 · 검문 통과분만 · 명단을 못 읽으면 빈 맵(검문못함) · 이름은 안 싣는다 · 140자 캡.
 *   ④ 반출(증언반출_) — 번호 0 · 시각은 달까지 · 출처·물음·답 셋 다 검문 · 명단을 못 읽으면 안 내보낸다.
 *   ⑤ 배선 — 골격에 수집 표식으로 서고, 도달 장부의 소비자가 aiStudioBatch_ ① 이며(대장칸 ㉢ · 밤마다), ① 절이 되받기 지시와 함께 싣고,
 *      ③ 반 브리핑은 이 말을 안 읽는다.
 *
 * ■ 왜 소스 모양까지 재나 — 심문(제미나이)이 짚은 「모을 때 끊는 것과 밖에 낼 때 가리는 것을 혼동해 재료를 휘발시키는 조용한 실패」는
 *   함수 하나가 아니라 배선(어디서 읽나)에서 난다. 그릇만 서고 아무도 안 읽으면 ㉡-2 는 미완이다.
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
const 그릇절 = section('const TESTIMONY_ANSWER_MAX_ = 2000;', '/* ===================== [㉡-1 부품');
const 살균절 = section('function 이름살균_(', 'function 문항지문_(');
const HEADERS = ['id', 'student_id', '시각', '출처', '물음', '답', '맥락', '시즌', '화자', 'schema_ver'];

/** 시트 흉내 — 행 배열 하나 + 헤더 행(기본 = 정본 열 칸). */
function 시트(rows, w, 헤더) {
  const hdr = 헤더 || HEADERS.slice();
  const sh = {
    rows: rows.slice(),
    appended: [],
    getLastRow() { return this.rows.length + 1; },
    getLastColumn() { return w || hdr.length; },
    appendRow(r) { this.appended.push(r); this.rows.push(r); },
    getRange(r, c, n, cw) {
      const self = this;
      return { getValues() { return r === 1 ? [hdr.slice(c - 1, c - 1 + cw)] : self.rows.slice(r - 2, r - 2 + n).map(row => row.slice(c - 1, c - 1 + cw)); } };
    },
  };
  return sh;
}

function 엔진(opts) {
  const o = opts || {};
  const sh = o.sheet === null ? null : (o.sheet || 시트([]));
  const locks = { taken: 0, released: 0, refuse: !!o.lockRefuse };
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
  const LockService = { getScriptLock: () => ({ tryLock: () => { if (locks.refuse) return false; locks.taken++; return true; }, releaseLock: () => { locks.released++; } }) };
  const 셀안전_ = (v) => (/^[=+\-@\t\r]/.test(v) ? "'" + v : v);
  const toDate_ = (v) => (v instanceof Date ? v : null);
  const 명단이름_ = () => (o.names === undefined ? ['바트', 'bat'] : o.names);
  const 보정 = [];
  const 헤더보정_ = (s, headers) => { 보정.push(headers); };
  const E = new Function('ensureSheet', 'Utilities', 'LockService', '셀안전_', 'toDate_', '명단이름_', '헤더보정_', 'Logger',
    `${상수절}\n${살균절}\n${그릇절}\nreturn { 증언지문_, 증언남기기_, 증언비식별_, 증언맵_, 증언반출_, 이름살균_, TESTIMONY_SCHEMA_VER };`)(ensureSheet, Utilities, LockService, 셀안전_, toDate_, 명단이름_, 헤더보정_, { log: () => {} });
  return { E, ss, sh, locks, 보정 };
}
const now = Date.now();
const d = (일전) => new Date(now - 일전 * 86400000);

/* ───────────────────── ① 남기기 ───────────────────── */
test('[증언] 넷(번호·출처·물음·답)이 있어야 한 줄 — 빈 답은 안 남긴다 · 화자와 판이 끝 두 칸에 선다', () => {
  const { E, ss, locks } = 엔진();
  assert.deepEqual(E.증언남기기_(ss, { 출처: '회고', 물음: 'q', 답: 'a' }), { ok: false, error: 'no-student' });
  assert.deepEqual(E.증언남기기_(ss, { student_id: 'S1', 물음: 'q', 답: 'a' }), { ok: false, error: 'no-question' });
  assert.deepEqual(E.증언남기기_(ss, { student_id: 'S1', 출처: '회고', 물음: 'q', 답: ' \n  ' }), { ok: false, error: 'empty' });
  const r = E.증언남기기_(ss, { student_id: 'S1', 출처: '회고', 물음: '안다고 느낀 것이 있었나요?', 답: '없다', 시즌: '2026-11-30', 시각: '2027-01-24T10:00:00', 화자: '보호자' });
  assert.equal(r.ok, true);
  assert.equal(r.중복, false);
  assert.equal(r.id.length, 12);
  const row = ss.getSheetByName('testimony_log').appended[0];
  assert.equal(row.length, HEADERS.length, '칸 수 = 헤더 수(열)');
  assert.equal(row[1], 'S1');
  assert.equal(row[5], '없다', '「없다」도 그대로 남는다 — 그게 최저점 원천이다');
  assert.equal(row[7], '2026-11-30');
  assert.equal(row[8], '보호자');
  assert.equal(row[9], E.TESTIMONY_SCHEMA_VER);
  assert.ok(/^2027-01-24 \d\d:\d\d$/.test(row[2]), '시각은 분까지: ' + row[2]);
  assert.equal(locks.taken, 1, '조회→append 는 잠금 안에서');
  assert.equal(locks.released, 1);
  const 기본 = E.증언남기기_(ss, { student_id: 'S2', 출처: '회고', 물음: 'q', 답: 'a' });
  assert.equal(ss.getSheetByName('testimony_log').appended[1][8], '학생', '화자를 안 주면 학생');
  assert.equal(기본.ok, true);
});

test('[증언] 같은 말은 «언제 다시 보내도» 한 줄 — 지문에 시각이 없다(분 경계 재시도 · 코덱스 09-07 P1) · 잠금을 못 잡으면 busy', () => {
  const { E, ss } = 엔진();
  const 입력 = { student_id: 'S1', 출처: '회고', 물음: 'q', 답: '한국 회사에서 일하고 싶어요', 시각: '2027-01-24T10:00:59' };
  const a = E.증언남기기_(ss, 입력);
  const b = E.증언남기기_(ss, Object.assign({}, 입력, { 시각: '2027-01-24T10:01:01' }));
  assert.equal(a.중복, false);
  assert.equal(b.중복, true, '분이 바뀌어도 같은 말이면 중복');
  assert.equal(a.id, b.id);
  assert.equal(ss.getSheetByName('testimony_log').appended.length, 1);
  const c = E.증언남기기_(ss, Object.assign({}, 입력, { 답: '다른 말' }));
  assert.equal(c.중복, false, '답이 다르면 다른 줄이다');
  const 공백 = E.증언남기기_(ss, Object.assign({}, 입력, { 답: '한국  회사에서\n일하고 싶어요' }));
  assert.equal(공백.중복, true, '공백·줄바꿈만 다른 같은 말은 같은 지문');
  const 다른시즌 = E.증언남기기_(ss, Object.assign({}, 입력, { 시즌: '2027-02-25' }));
  assert.equal(다른시즌.중복, false, '다른 시즌의 같은 답은 새 관측이다(코덱스 2차 P1) — 지문에 시즌이 든다');
  const 다른화자 = E.증언남기기_(ss, Object.assign({}, 입력, { 화자: '보호자' }));
  assert.equal(다른화자.중복, false, '보호자가 같은 말을 해도 다른 줄');
  const 막힘 = 엔진({ lockRefuse: true });
  assert.deepEqual(막힘.E.증언남기기_(막힘.ss, 입력), { ok: false, error: 'busy' });
});

test('[증언] 옛 8칸 탭에 쓰기 «전»에 칸을 세운다(헤더보정_) — 이름 없는 값 열이 생기면 아침 시트칸맞추기가 그 표를 멈춘다', () => {
  const 옛 = 시트([], 8, HEADERS.slice(0, 8));
  const { E, ss, 보정 } = 엔진({ sheet: 옛 });
  const r = E.증언남기기_(ss, { student_id: 'S1', 출처: '회고', 물음: 'q', 답: 'a' });
  assert.equal(r.ok, true);
  assert.deepEqual(보정, [HEADERS], '쓰기 전에 헤더 정본으로 보정한다');
  assert.equal(옛.appended.length, 1);
});

test('[증언] 정본 자리에 «다른 이름»이 서 있으면 덮지 않고 멈춘다 — 그 열의 값이 남의 이름을 뒤집어쓴다(코덱스 3차 P0 · 결정 09-03)', () => {
  const 충돌 = 시트([], 9, HEADERS.slice(0, 8).concat(['운영메모']));
  const { E, ss, 보정 } = 엔진({ sheet: 충돌 });
  const r = E.증언남기기_(ss, { student_id: 'S1', 출처: '회고', 물음: 'q', 답: 'a' });
  assert.deepEqual(r, { ok: false, error: 'header-clash' });
  assert.deepEqual(보정, [], '충돌 자리에 헤더보정_ 을 부르면 「운영메모」가 「화자」로 바뀐다');
  assert.equal(충돌.appended.length, 0, '학생 글을 쓰지 않는다');
});

test('[증언] 원문은 공백·줄바꿈 그대로 남고 2000자에서 자른다 · 남의 글은 셀안전_ 을 지난다(= 로 시작하면 수식이 안 된다)', () => {
  const { E, ss } = 엔진();
  E.증언남기기_(ss, { student_id: 'S1', 출처: '회고', 물음: 'q', 답: '첫 줄\r\n둘째  줄' });
  assert.equal(ss.getSheetByName('testimony_log').appended[0][5], '첫 줄\n둘째  줄', '가공 전 원문을 보존한다(제품방향 불변식 2)');
  E.증언남기기_(ss, { student_id: 'S2', 출처: '회고', 물음: 'q', 답: '=1+1', 맥락: '=x' });
  const row = ss.getSheetByName('testimony_log').appended[1];
  assert.equal(row[5], "'=1+1");
  assert.equal(row[6], "'=x");
  E.증언남기기_(ss, { student_id: 'S3', 출처: '회고', 물음: 'q', 답: 'a'.repeat(3000) });
  assert.equal(ss.getSheetByName('testimony_log').appended[2][5].length, 2000);
});

/* ───────────────────── ② 검문 ───────────────────── */
test('[증언] 검문 — 이름 조각 · 긴 숫자열 · 이메일 · 손잡이 · 학생 번호 꼴 · 주소가 들면 null · 명단이 없으면 검문 불가(null) · 통과하면 원문 그대로', () => {
  const { E } = 엔진();
  const 이름들 = ['바트', 'bat'];
  assert.equal(E.증언비식별_(이름들, '한국 회사에서 일하고 싶어요'), '한국 회사에서 일하고 싶어요');
  assert.equal(E.증언비식별_(이름들, '바트 선생님이 기억해 줬다'), null, '명단 이름 조각');
  assert.equal(E.증언비식별_(이름들, '연락처는 010-1234-5678'), null, '전화');
  assert.equal(E.증언비식별_(이름들, '제 메일은 me@example.com'), null, '이메일');
  assert.equal(E.증언비식별_(이름들, '인스타 @tuvshin_99'), null, '손잡이');
  assert.equal(E.증언비식별_(이름들, '내 번호는 S0042'), null, '학생 번호 꼴');
  assert.equal(E.증언비식별_(이름들, 'https://example.com 봐요'), null, '주소');
  assert.equal(E.증언비식별_(이름들, '2004년에 태어났어요'), null, '연도(생년)');
  assert.equal(E.증언비식별_(이름들, '3월 5일에 시험이 있어요'), null, '연도 없는 날짜');
  assert.equal(E.증언비식별_(이름들, '몽골국립대학교 3학년이에요'), null, '학교 이름');
  assert.equal(E.증언비식별_(이름들, 'Их сургууль-д сурдаг'), null, '몽골어 학교');
  assert.equal(E.증언비식별_(이름들, '한강 아파트에 살아요'), null, '사는 곳');
  assert.equal(E.증언비식별_(이름들, '생일은 03/05예요'), null, '빗금 날짜(코덱스 3차)');
  assert.equal(E.증언비식별_(이름들, '3 сарын 5-нд төрсөн'), null, '몽골어 월일');
  assert.equal(E.증언비식별_(이름들, 'ABC Academy에 다녀요'), null, '영어 학원 낱말');
  assert.equal(E.증언비식별_(이름들, '테헤란로 12에 살아요'), null, '도로명');
  assert.equal(E.증언비식별_(이름들, '다시 해 볼게요, 친구랑 같이'), '다시 해 볼게요, 친구랑 같이', '「다시」·「친구」 같은 보통 말은 통과한다');
  assert.equal(E.증언비식별_(null, '한국 회사'), null, '명단을 못 읽으면 검문 불가');
  assert.equal(E.증언비식별_(이름들, '   '), null);
});

/* ───────────────────── ③ 읽기 ───────────────────── */
test('[증언] 증언맵_ — 학생별 최근 둘 · 창 밖은 안 읽는다 · 보호자 답은 뺀다 · 검문에 걸린 답은 세어서 뺀다 · 이름 0', () => {
  const rows = [
    ['i1', 'S1', d(3), '회고', '왜 배우나', '회사 때문에', '', '', '학생', 1],
    ['i2', 'S1', d(1), '회고', '느낀 것', '있다 — 내 이름을 기억해 줬다', '', '', '학생', 1],
    ['i3', 'S1', d(10), '상담', '목표', '옛 말', '', '', '학생', 1],
    ['i4', 'S2', d(200), '회고', '느낀 것', '창 밖', '', '', '학생', 1],
    ['i5', '', d(1), '회고', 'q', '번호 없음', '', '', '학생', 1],
    ['i6', 'S3', d(2), '회고', '느낀 것', '있다 — 보호자가 씀', '', '', '보호자', 1],
    ['i7', 'S4', d(2), '회고', '느낀 것', '바트가 잘해 줬다', '', '', '학생', 1],
    ['i8', 'S5', d(2), '회고', '바트에게 묻는 것', '괜찮았어요', '', '', '학생', 1],
  ];
  const { E, ss } = 엔진({ sheet: 시트(rows) });
  const r = E.증언맵_(ss, 120);
  assert.equal(r.건수, 3, '창 안 + 번호 있는 학생 화자 + 검문 통과');
  assert.equal(r.걸러냄, 2, '이름 조각이 든 답 하나 · 이름 든 물음 하나를 걸렀다');
  assert.equal(r.학생수, 1);
  assert.equal(r.맵.S3, undefined, '보호자의 말은 「스스로 한 말」이 아니다');
  assert.equal(r.맵.S4, undefined, '검문에 걸린 답은 AI 로 안 간다');
  assert.equal(r.맵.S5, undefined, '물음도 밖으로 나간다 — 물음에 이름이 들면 그 줄은 안 간다(코덱스 2차 P0)');
  assert.ok(r.맵.S1.indexOf('내 이름을 기억해 줬다') > -1 && r.맵.S1.indexOf('회사 때문에') > -1, r.맵.S1);
  assert.ok(r.맵.S1.indexOf('옛 말') === -1, '셋째(오래된 것)는 안 싣는다');
  assert.ok(r.맵.S1.length <= 140);
  const 빈 = 엔진({ sheet: null });
  assert.deepEqual(빈.E.증언맵_(빈.ss), { 맵: {}, 건수: 0, 학생수: 0, 걸러냄: 0, 검문못함: false });
});

test('[증언] 증언맵_ — 명단을 못 읽으면 맵이 빈다(검문못함 · 외부 AI 로 아무것도 안 낸다) · 시즌 창 { 시작, 끝 } 으로도 읽는다', () => {
  const rows = [
    ['i1', 'S1', new Date('2026-12-10T10:00:00'), '회고', 'q', '시즌 안', '', '', '학생', 1],
    ['i2', 'S1', new Date('2027-02-10T10:00:00'), '회고', 'q', '시즌 뒤', '', '', '학생', 1],
  ];
  const 못읽음 = 엔진({ sheet: 시트(rows), names: null });
  const r0 = 못읽음.E.증언맵_(못읽음.ss, { 시작: new Date('2026-11-30T00:00:00'), 끝: new Date('2027-01-24T00:00:00') });
  assert.equal(r0.검문못함, true);
  assert.deepEqual(r0.맵, {});
  const { E, ss } = 엔진({ sheet: 시트(rows) });
  const r = E.증언맵_(ss, { 시작: new Date('2026-11-30T00:00:00'), 끝: new Date('2027-01-24T00:00:00') });
  assert.equal(r.건수, 1);
  assert.ok(r.맵.S1.indexOf('시즌 안') > -1 && r.맵.S1.indexOf('시즌 뒤') === -1, '시즌 끝 뒤에 쓴 말은 그 시즌의 회고가 아니다: ' + r.맵.S1);
});

/* ───────────────────── ④ 반출 ───────────────────── */
test('[증언] 증언반출_ — 번호 0 · 시각은 달까지 · 출처·물음·답 셋 다 검문 · 몇 건 뺐나를 낸다 · 명단을 못 읽으면 안 내보낸다', () => {
  const rows = [
    ['i1', 'S1', '2027-01-24 10:00', '회고', '느낀 것', '있다 — 바트 선생님이 기억해 줬다', '', '', '학생', 1],
    ['i2', 'S1', '2027-01-24 10:01', '회고', '느낀 것', '한국 회사에서 일하고 싶어요', '', '', '학생', 1],
    ['i3', 'S1', '2027-01-24 10:02', '회고', '바트에게 묻는 것', '괜찮았어요', '', '', '보호자', 1],
    ['i4', 'S1', '2027-01-24 10:03', '회고', '느낀 것', '전화 010-2222-3333 으로', '', '', '학생', 1],
  ];
  const a = 엔진({ sheet: 시트(rows) });
  const r = a.E.증언반출_(a.ss);
  assert.equal(r.뺀건수, 3, '이름 든 답 · 이름 든 물음 · 전화 든 답');
  assert.deepEqual(r.판, [{ 월: '2027-01', 출처: '회고', 물음: '느낀 것', 답: '한국 회사에서 일하고 싶어요', 화자: '학생' }]);
  assert.ok(!JSON.stringify(r.판).includes('S1'), '밖으로 나가는 판에 학생 번호가 있다');
  const b = 엔진({ sheet: 시트(rows), names: null });
  assert.equal(b.E.증언반출_(b.ss), null, '명단을 못 읽으면 살균을 못 하니 안 내보낸다(fail-closed)');
});

/* ───────────────────── ⑤ 배선 ───────────────────── */
test('[증언] 골격 — testimony_log 가 수집 표식으로 서고, 헤더 정본은 소비자 파일(엔진_콘텐츠AI.js) 한 곳이다(열 칸 · 화자·판이 끝)', () => {
  const 골격 = section('function sheetSkeleton_() {', 'function 수집장부탭_() {');
  const 줄 = 골격.split('\n').filter(l => l.indexOf('[TESTIMONY_TAB_, TESTIMONY_HEADERS, 수집표식_]') > -1);
  assert.equal(줄.length, 1, '골격에 증언 탭이 정확히 한 줄');
  assert.equal((code.match(/const TESTIMONY_HEADERS = /g) || []).length, 1, '헤더 정본이 두 곳이면 갈린다');
  assert.ok(/^const TESTIMONY_HEADERS = \['id', 'student_id', '시각', '출처', '물음', '답', '맥락', '시즌', '화자', 'schema_ver'\];/m.test(code));
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
