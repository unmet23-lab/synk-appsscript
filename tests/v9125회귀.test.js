/* [v9.125] 앱 전면 최적화 회귀 테스트 — 5구역 병렬 적대 리뷰(08-02)가 잡은 결함의 재발 방지.
 * 원칙: 가능한 것은 전부 **실행 검증**(문구 검사는 문구가 바뀌는 순간 죽는다 — guard-must-check-result).
 * Code.js 전체를 GAS 스텁 컨텍스트로 로드해 순수 함수를 직접 부른다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const { engineSource } = require('./_engine-source');
const code = engineSource();
/* 부정 단언(「~가 없어야 한다」)의 주어만 이걸로 감싼다 — 주석이 금지 패턴을 «설명»하면 그 검사가
 * 설명을 위반으로 읽는다. 구간 앵커·긍정 단언은 원문 그대로 둔다. (대기열 #Q72) */
const { 코드만 } = require('./lib/소스검사.js');
const tbCode = fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8');
const mjCode = fs.readFileSync(path.join(ROOT, '만족도팩.js'), 'utf8');

const stub = new Proxy(function () {}, { get: () => stub, apply: () => stub });
// Utilities.formatDate만 진짜 구현 — tz 인자를 실제로 존중해야 UTC 러너(CI)에서도 GAS와 같은 답이 나온다.
// 나머지 멤버는 기존 stub 그대로. GAS 패턴 중 이 코드베이스가 쓰는 토큰(yyyy·MM·dd·HH·mm·ss)만 지원.
const gasFormatDate = (d, tz, fmt) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(d.getTime())).map((p) => [p.type, p.value]));
  const map = { yyyy: parts.year, MM: parts.month, dd: parts.day, HH: parts.hour, mm: parts.minute, ss: parts.second };
  return fmt.replace(/yyyy|MM|dd|HH|mm|ss/g, (t) => map[t]);
};
const utils = new Proxy({ formatDate: gasFormatDate }, { get: (t, k) => (k in t ? t[k] : stub) });
const ctx = {
  SpreadsheetApp: stub, PropertiesService: stub, Utilities: utils, Session: stub,
  MailApp: stub, GmailApp: stub, UrlFetchApp: stub, DriveApp: stub, FormApp: stub,
  DocumentApp: stub, ScriptApp: stub, CacheService: stub, LockService: stub,
  HtmlService: stub, Logger: { log: () => {} }, console,
};
vm.createContext(ctx);
vm.runInContext(code, ctx);

/* ── ① 결석 복귀율 — Date 오염 면역 (치명: teacher_stats 영구 공백) ───────── */
test('[v9.125] absenceReturnStats_는 A열이 Date여도 판정한다 (시트 자동 서식 면역)', () => {
  const mkRow = (d, teacher, st) => { const r = []; r[0] = d; r[3] = teacher; r[5] = '연락'; r[8] = st; return r; };
  // ⚠ vm 컨텍스트와 호스트는 렐름이 달라 호스트 Date는 ctx 안 instanceof Date에 안 걸린다(GAS 실환경은 단일 렐름).
  const asDate = vm.runInContext('new Date(2026, 6, 20)', ctx); // 2026-07-20
  const byDate = ctx.absenceReturnStats_([mkRow(asDate, '바트', '복귀:2026-07-21(+1일)')], '2026-07-01', '2026-08-02');
  assert.equal((byDate['바트'] || {}).judged, 1, 'Date 행이 창 검사에서 전량 탈락한다 — v9.108 실결함 재발');
  assert.equal(byDate['바트'].rate, 100);
  const byStr = ctx.absenceReturnStats_([mkRow('2026-07-20', '바트', '복귀:2026-07-21(+1일)')], '2026-07-01', '2026-08-02');
  assert.deepEqual(byDate['바트'].judged, byStr['바트'].judged, 'Date와 문자열의 판정이 갈린다');
});

/* ── ② 재등록 판정 — 상태='갱신' 인정 + 같은 날 이어 적기 (강사 급여 지표) ── */
test('[v9.125] reenrollByStudent_ — 상태 갱신·만료일=시작일 연속 수강을 이탈로 세지 않는다', () => {
  // 상태 칸만 '갱신'(후속 행 없음) — 유예 지나도 true
  const r1 = ctx.reenrollByStudent_(
    [{ sid: 'S1', start: '2026-02-01', expire: '2026-05-01', state: '갱신' }],
    '2026-04-01', '2026-06-30', '2026-08-02');
  assert.equal(r1['S1'], true, "상태='갱신'을 무시한다 — 갱신 완료 학생이 이탈로 감점된다");
  // 새 행 시작일 = 만료일(자연 표기) — 구 '>' 경계는 이걸 이탈로 셌다
  const r2 = ctx.reenrollByStudent_(
    [{ sid: 'S2', start: '2026-02-01', expire: '2026-05-01', state: '' },
     { sid: 'S2', start: '2026-05-01', expire: '2026-08-01', state: '' }],
    '2026-04-01', '2026-06-30', '2026-08-02');
  assert.equal(r2['S2'], true, '만료일과 같은 날 시작한 연속 수강을 갱신으로 안 본다(오프바이원)');
  // 진짜 이탈(유예 경과·후속 없음)은 여전히 false
  const r3 = ctx.reenrollByStudent_(
    [{ sid: 'S3', start: '2026-02-01', expire: '2026-05-01', state: '' }],
    '2026-04-01', '2026-06-30', '2026-08-02');
  assert.equal(r3['S3'], false);
});

/* ── ③ 조편성 — 5인 조 짝 정합·유령 조 지시 (학생 앱↔강사 편성표 불일치) ── */
test('[v9.125] pairRoundsOf_·pairSeatOf_ — 4인 조가 아니면 짝을 만들지 않는다(5인 조 %4 복제 차단)', () => {
  assert.equal(ctx.pairRoundsOf_(4, 5).length, 0, '5인 조 좌석4가 좌석0의 짝 배열을 복제한다'); // vm 렐름이라 deepEqual 대신 length
  assert.equal(ctx.pairRoundsOf_(0, 5).length, 0, '5인 조에서 짝이 서로를 가리키지 않는다');
  assert.equal(ctx.pairSeatOf_(4, 1, 5), -1, 'pairSeatOf_가 5인 조를 통과시킨다');
  // 4인 조 정상 동작은 유지 — 짝 대칭
  const a = ctx.pairRoundsOf_(0, 4), b = ctx.pairRoundsOf_(a[0], 4);
  assert.equal(b[0], 0, '4인 조 1라운드 짝이 대칭이 아니다');
});

test('[v9.125] focusGroupOf_ — 실제 조 수를 넘는 조를 지시하지 않는다(3명 반 4조 유령 차단)', () => {
  for (let n = 1; n <= 16; n++) {
    const f = ctx.focusGroupOf_(n, 3, 3); // 3주차(FOCUS_START_WEEK 이후)·조 3개
    assert.ok(f >= 1 && f <= 3, `차시 ${n}에 존재하지 않는 조(${f})를 지시한다`);
  }
  const seen = {};
  for (let n = 1; n <= 3; n++) seen[ctx.focusGroupOf_(n, 3, 3)] = 1;
  assert.equal(Object.keys(seen).length, 3, '3개 조가 로테이션에서 전부 지명되지 않는다');
});

/* ── ④ 월키 자기치유 — 시리얼 숫자 복구 + 서식보다 읽기 먼저 ───────────── */
test('[v9.125] ymTextOf_ — 텍스트 서식이 만든 시리얼 숫자(46173류)를 yyyy-MM으로 되돌린다', () => {
  // 2026-06-01 = 1899-12-30 기준 46174일 (2020-01-01=43831 + 2192 + 151)
  assert.equal(ctx.ymTextOf_(46174, 'Asia/Ulaanbaatar'), '2026-06');
  assert.equal(ctx.ymTextOf_('46174', 'Asia/Ulaanbaatar'), '2026-06', "'@' 서식 셀이 돌려주는 문자열 시리얼을 못 고친다");
  assert.equal(ctx.ymTextOf_('2026-06', 'Asia/Ulaanbaatar'), '2026-06', '정상 월키를 건드린다');
  assert.equal(ctx.ymTextOf_(120, 'Asia/Ulaanbaatar'), '120', '포인트류 작은 숫자를 날짜로 오변환한다(범위 가드 붕괴)');
});

test('[v9.128] ymTextColFix_ 순서 = 읽기 → 서식(@) → 쓰기 (세 번 틀린 자리)', () => {
  const body = code.slice(code.indexOf('function ymTextColFix_'), code.indexOf('function sheetSelfHealNow'));
  const readAt = body.indexOf('.getValues()');
  const fmtAt = body.indexOf("setNumberFormat('@')");
  const writeAt = body.indexOf('.setValues(vals)');
  assert.ok(readAt > -1 && fmtAt > -1 && writeAt > -1, '읽기·서식·쓰기 중 없는 단계가 있다');
  // ① 읽기가 서식보다 먼저 — 서식을 먼저 걸면 Date가 시리얼로 읽혀 instanceof를 빠져나간다(v9.97 실패)
  assert.ok(readAt < fmtAt, '서식이 읽기보다 먼저다 — 치유 0건 + 46173 노출(치유 전보다 악화)');
  // ② 서식이 쓰기보다 먼저 — 날짜 서식 열에 쓰면 시트가 '2026-07'을 다시 Date로 파싱한다(v9.125 실패·라이브 실측)
  assert.ok(fmtAt < writeAt, '쓰기가 서식보다 먼저다 — 되쓴 문자열이 그 자리에서 다시 Date가 된다');
});

/* ── ⑤ 음성 동의 — fail-open 차단 (무동의 녹음은 영구 보관·비가역) ──────── */
test('[v9.125] voiceConsentMap_ 판정 — 화이트리스트(명시적 긍정만 yes, 그 외 보류)', () => {
  const seg = code.slice(code.indexOf('function voiceConsentMap_'), code.indexOf('function voiceConsentStat_'));
  assert.ok(seg.includes("v.indexOf('네') === 0") || seg.includes("v.indexOf('동의') === 0"),
    '명시적 긍정 판정이 없다');
  assert.equal(/\?\s*'no'\s*:\s*'yes'/.test(코드만(seg)), false,
    "「'아니'가 아니면 전부 yes」 fail-open이 되살아났다 — '거부'·'보류'·'확인중'이 동의로 통과한다");
  assert.ok(/:\s*'';/.test(seg), '판정 불가를 보류(빈 값)로 떨어뜨리지 않는다');
});

test('[v9.125] voiceTranscribe_ — 전사(외부 GCP 전송)에 동의 게이트가 있고, 계정 오류는 행을 낙인찍지 않는다', () => {
  const seg = tbCode.slice(tbCode.indexOf('function voiceTranscribe_'), tbCode.indexOf('function voiceSttStatus'));
  assert.ok(seg.includes('voiceConsentMap_'), '전사 경로가 동의 게이트 밖이다 — 무동의 오디오가 GCP로 나간다');
  assert.ok(seg.includes("consent[sid] !== 'yes'"), '동의 미확인 행 제외가 없다');
  assert.ok(seg.includes('r.systemic'), '체계적 오류(401/403/429/5xx) 분기가 없다 — 설정 실수 하나가 전 행을 영구 실패로 낙인');
  const stt = tbCode.slice(tbCode.indexOf('function sttOne_'), tbCode.indexOf('function voiceTranscribe_'));
  assert.ok(stt.includes('systemic:'), 'sttOne_이 오류 성격을 구분해 돌려주지 않는다');
});

/* ── ⑥ 리허설 게이트 전면화 — 실발송·과금 경로 전수 (checkNoShow 소실 계열) ── */
test('[v9.125] 리허설 게이트 — aiCall_·adminMail·MJ_send_·voiceTranscribe_·aiFeedbackBatch_ 전부 잠긴다', () => {
  const gateOf = (src, fnName, endMark) => {
    const s = src.indexOf('function ' + fnName);
    assert.ok(s > -1, fnName + '가 없다');
    return src.slice(s, src.indexOf(endMark, s));
  };
  assert.ok(gateOf(code, 'aiCall_(apiKey', 'function aiText_').includes('isRehearsal_()'),
    'aiCall_ 무게이트 — 월보·학부모 편지·마스터리가 리허설 중 과금된다');
  assert.ok(gateOf(code, 'adminMail(subject', 'const lock').includes('isRehearsal_()'),
    'adminMail 무게이트 — 리허설 산출물이 다음 아침 진짜 브리핑으로 나간다');
  assert.ok(gateOf(mjCode, 'MJ_send_(psid', 'const payload').includes('isRehearsal_'),
    'MJ_send_ 무게이트 — 리허설 중 메신저 실발송');
  assert.ok(gateOf(code, 'aiFeedbackBatch_()', 'for (let i = 0').includes('isRehearsal_()'),
    'AI 첨삭 배치 입구 차단이 없다 — 첫 행 break(대기량 안 보임) 또는 시트·포인터 오염');
  // 발송 성공에만 마킹 — classPrepMail_
  const prep = code.slice(code.indexOf('function classPrepMail_'), code.indexOf('function checkoutCheerMail_'));
  assert.ok(prep.includes('prepSent'), '수업 브리핑이 발송 실패에도 보냄 마킹된다(그날 영구 소실)');
});

/* ── ⑦ 침묵 점수 시즌 필터 — 전 기간 누적이 발화 지수를 잠식 ─────────────── */
test('[v9.125] quietScoreMap_ — 시즌 시작 전 기록은 세지 않는다', () => {
  const seg = code.slice(code.indexOf('function quietScoreMap_'), code.indexOf('function buildGroupPlan_'));
  assert.ok(seg.includes('seasonStartOf_'), '시즌 필터가 없다 — 과거 시즌의 조용함이 지명 우선을 영구 점유한다');
  assert.ok(seg.includes('d < start'), '날짜 하한 검사가 없다(silentRosterAlert_와 같은 규칙이어야 한다)');
});

/* ── ⑧ 시즌 종료 누수 — 유예 14일의 "9주차" 표기 차단 ─────────────────── */
test('[v9.125] 시즌 종료 게이트 — groupBoardOf_·todayPairsBySid_·groupHudsByClass_가 SEASON_WEEKS 상한을 본다', () => {
  ['function groupBoardOf_(ss', 'function todayPairsBySid_(ss'].forEach(mark => {
    const s = code.indexOf(mark);
    const seg = code.slice(s, s + 1600);
    assert.ok(seg.includes('> SEASON_WEEKS'), mark + '에 시즌 종료 상한이 없다 — 시즌 사이 2주간 유령 차시가 찍힌다');
  });
});

/* ═══════ [v9.126] Glide 라이브 전수 점검(08-02)이 잡은 결함 — 실측 근거가 있는 것만 ═══════ */

// 자기치유 ④ 블록을 잘라 실제로 실행한다(삭제가 걸린 로직이라 문구 검사로는 부족하다)
function runRcDedupe(rows) {
  const deleted = [];
  const rc = {
    getName: () => 'report_cards',
    getLastRow: () => rows.length + 1,
    getMaxRows: () => rows.length + 10,
    getRange: (r, c, n, w) => ({
      getValues: () => rows.slice(r - 2, r - 2 + n).map(x => x.slice(c - 1, c - 1 + (w || 1))),
      setValues: () => {},
      getNumberFormat: () => '@',
      setNumberFormat: () => {},
    }),
    deleteRow: (rn) => { deleted.push(rn); rows.splice(rn - 2, 1); },
  };
  const s = code.indexOf('/* ④ [v9.126] report_cards');
  const e = code.indexOf('// [v9.6] 🌍 월드 레이드 — 학원 전체');
  assert.ok(s > -1 && e > s, '자기치유 ④ 블록 표식을 찾지 못함');
  const body = code.slice(s, e).replace(/\}\s*$/, ''); // 함수 닫는 중괄호 제거
  const fn = new Function('ss', 'ymTextColFix_', 'ymTextOf_', 'Logger', body);
  fn(
    { getSheetByName: (n) => (n === 'report_cards' ? rc : null), getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar' },
    () => 0,
    (v) => String(v == null ? '' : v).trim(),
    { log: () => {} }
  );
  return { deleted, remaining: rows.map(r => r[0] + '/' + r[1] + '/' + r[2]) };
}

const rcRow = (id, sid, ym, url, created) => [id, sid, ym, url || '', '칭호', '코멘트', created || '2026-08-01'];

test('[v9.126] report_cards 중복 정리 — 같은 달·같은 학생은 1장만 남는다 (실행 검증)', () => {
  const rows = [
    rcRow('C1', 'SYNK-001', '2026-08', 'http://img/1', '2026-08-01'),
    rcRow('C2', 'SYNK-001', '2026-08', 'http://img/2', '2026-08-02'), // 최신·이미지 있음 → 생존
    rcRow('C3', 'SYNK-001', '2026-08', '', '2026-08-03'),             // 이미지 없음 → 최신이어도 탈락
    rcRow('C4', 'SYNK-002', '2026-08', 'http://img/4', '2026-08-01'), // 다른 학생 → 보존
    rcRow('C5', 'SYNK-001', '2026-07', 'http://img/5', '2026-07-01'), // 다른 달 → 보존
  ];
  const r = runRcDedupe(rows);
  assert.deepEqual(r.remaining, ['C2/SYNK-001/2026-08', 'C4/SYNK-002/2026-08', 'C5/SYNK-001/2026-07'],
    '중복이 안 걷혔거나 다른 학생·다른 달을 지웠다');
});

test('[v9.126] report_cards 중복 정리 — 이미지가 하나도 없으면 전멸시키지 않는다', () => {
  const rows = [
    rcRow('C1', 'SYNK-001', '2026-08', '', '2026-08-01'),
    rcRow('C2', 'SYNK-001', '2026-08', '', '2026-08-02'),
  ];
  const r = runRcDedupe(rows);
  assert.equal(r.remaining.length, 1, '전멸했거나 정리가 안 됐다');
});

test('[v9.126] report_cards 멱등 가드가 월 열 Date 오염에 면역이다', () => {
  const seg = code.slice(code.indexOf('function runReportCards_'), code.indexOf('function reportCardData_'));
  assert.ok(seg.includes('ymTextColFix_(rc, 3, tz)'), '월 열 정상화가 없다 — 매 실행이 전원 카드를 다시 만든다');
  assert.ok(seg.includes("done.add(ymTextOf_(r[2], tz)"), '가드 비교값이 정규화되지 않았다');
  assert.equal(/done\.add\(String\(r\[2\]\)/.test(코드만(seg)), false, '구 String(r[2]) 비교가 되살아났다(라이브 37행 중복의 원인)');
});

test('[v9.126] world_raid 월 열도 Date 오염에서 보호된다', () => {
  const s = code.indexOf('// ③ world_raid 월 중복 정리');
  const seg = code.slice(s, s + 1500);
  assert.ok(seg.includes('ymTextColFix_(wr, 1, tz)'), '월 열 정상화가 없다 — 원장 화면에 원시 Date가 그대로 뜬다');
  assert.ok(seg.includes('ymTextOf_(r[0], tz)'), '중복 판정 키가 정규화되지 않았다(Date 행이 영영 안 묶인다)');
});

test('[v9.126] 상담시트 값 읽기(cv)가 Date를 원시 문자열로 흘리지 않는다', () => {
  const s = code.indexOf('const cv = (row, name) =>');
  const seg = code.slice(s, s + 900);
  assert.ok(seg.includes('raw instanceof Date'), 'Date 분기가 없다 — 학생 홈에 "Fri Oct 01 2027 …"이 노출된다');
  // 실제 동작 검증 — 잘라내 실행
  const fnSrc = code.slice(s, code.indexOf('};', s) + 2).replace('const cv = ', 'return ');
  const cv = new Function('cCol', fnSrc + '')({ '기한': 0 });
  const d = new Date(2027, 9, 1);
  assert.equal(cv([d], "기한"), "2027-10-01", 'Date가 yyyy-MM-dd로 정규화되지 않는다');
  assert.equal(cv(['2027-10'], '기한'), '2027-10', '문자열 값을 훼손한다');
  assert.equal(cv([''], '기한'), '', '빈 값 처리가 다르다');
});

test('[v9.126] 출결 보드는 빈 날에도 안내 한 줄을 남긴다 (백지 ≠ 고장)', () => {
  const s = code.indexOf('function todayBoard_');
  const seg = code.slice(s, code.indexOf('function expandHwBatch', s));
  assert.ok(seg.includes('!rows.length && !stuRows.length'), '빈 상태 분기가 없다');
  assert.ok(seg.includes('일요일'), '무수업일 안내 문구가 없다');
  assert.ok(seg.indexOf('stuRows.push') < seg.indexOf('const all = rows.concat(stuRows)'),
    '안내 행이 all 조립보다 뒤에 있다 — 화면에 안 나간다');
});

/* ═══════ [v9.127] 원격 실행·정본 동기화 ═══════ */

test('[v9.127] 경영 계기판 — 구 기본값이 시트에 박혀 있어도 정본 v1.3으로 승계된다', () => {
  const seg = code.slice(code.indexOf('function updateBizDashboard'), code.indexOf('function bizAlert_') > -1
    ? code.indexOf('function bizAlert_') : code.indexOf('function updateBizDashboard') + 3000);
  assert.ok(seg.includes('BIZ_BURN_LEGACY') && seg.includes('BIZ_BEP_LEGACY'),
    '구 기본값 승계 로직이 없다 — 계기판은 입력칸을 되쓰므로 상수만 고치면 화면이 영영 안 바뀐다');
  // 정본 값 자체
  assert.ok(/const BIZ_BEP_DEFAULT = 119;/.test(code), 'BEP 기본값이 정본 v1.3(119명)이 아니다');
  assert.ok(/const BIZ_BURN_DEFAULT = 5065;/.test(code), '월 번 기본값이 정본 v1.3(5,065만₮)이 아니다');
  // 유호님이 직접 넣은 값은 보존 — 승계는 "구 기본값과 정확히 같을 때"만
  assert.ok(seg.includes('bepRaw === BIZ_BEP_LEGACY'), '승계 조건이 정확 일치가 아니다 — 수기 입력값을 덮을 수 있다');
});

test('[v9.127] 자기치유 공개 래퍼 — 편집기·메뉴 양쪽에서 실행 가능하다', () => {
  assert.ok(/function sheetSelfHealNow\(\)/.test(code), '공개 래퍼가 없다 — private은 편집기 드롭다운에 안 뜬다');
  const seg = code.slice(code.indexOf('function sheetSelfHealNow'), code.indexOf('function sheetSelfHeal_'));
  assert.ok(seg.includes('sheetSelfHeal_()'), '래퍼가 본체를 부르지 않는다');
  assert.ok(seg.includes('return msg'), '결과 문구를 돌려주지 않는다(메뉴 alert가 빈다)');
  assert.ok(code.includes("addItem('🩹 시트 자기치유', 'menuSelfHeal')"), '메뉴가 구 private 이름을 가리킨다');
});

// teacher_checkins 연타 정리 — 실행 검증(삭제가 걸린 로직)
test('[v9.127] teacher_checkins 연타 중복 — 60초 이내만 접고 정상 출퇴근은 남긴다 (실행 검증)', () => {
  const base = new Date('2026-08-02T09:00:00Z').getTime();
  const rows = [
    ['김강사', '출근', new Date(base)],            // 기준 → 생존
    ['김강사', '출근', new Date(base + 2000)],     // +2초 → 삭제
    ['김강사', '출근', new Date(base + 3500)],     // +3.5초 → 삭제
    ['김강사', '퇴근', new Date(base + 8 * 3600e3)],       // 8시간 뒤 → 생존
    ['김강사', '퇴근', new Date(base + 8 * 3600e3 + 1500)], // +1.5초 → 삭제
    ['박강사', '출근', new Date(base + 1000)],     // 다른 사람 → 생존
    ['김강사', '출근', new Date(base + 90000)],    // +90초(연타 아님) → 생존
  ];
  const deleted = [];
  const fmt = { applied: null, cur: '' };   // [v9.133] 시각 열 표시 형식 보증
  const tc = {
    getLastRow: () => rows.length + 1,
    getMaxRows: () => rows.length + 1,
    getRange: (r, c, n, w) => ({
      getValues: () => rows.slice(r - 2, r - 2 + n).map(x => x.slice(c - 1, c - 1 + w)),
      getNumberFormat: () => fmt.cur,
      setNumberFormat: (f) => { fmt.applied = f; fmt.cur = f; },
    }),
    deleteRow: (rn) => { deleted.push(rn); rows.splice(rn - 2, 1); },
  };
  const s = code.indexOf('/* ⑤ [v9.127] teacher_checkins 연타 중복 정리');
  const e = code.indexOf('// [v9.6] 🌍 월드 레이드 — 학원 전체');
  assert.ok(s > -1 && e > s, '⑤ 블록 표식을 찾지 못함');
  const body = code.slice(s, e).replace(/\}\s*$/, '');
  new Function('ss', 'TC_NAME_COL', 'TC_TYPE_COL', 'TC_TIME_COL', 'Logger', body)(
    { getSheetByName: (n) => (n === 'teacher_checkins' ? tc : null) }, 1, 2, 3, { log: () => {} });
  assert.equal(rows.length, 4, '남은 행 수가 다르다(정상 출퇴근을 지웠거나 연타를 못 걷었다)');
  assert.deepEqual(rows.map(r => r[0] + r[1]), ['김강사출근', '김강사퇴근', '박강사출근', '김강사출근'],
    '다른 사람·다른 유형·간격 있는 기록이 훼손됐다');
  // [v9.133] 서식이 없으면 정상 Date가 `2026-07-24T04:22:17.691Z`로 렌더돼 사람이 「데이터가 깨졌다」고 읽는다
  //   (08-02 실측에서 실제로 그렇게 보고됐다). 시트를 새로 만들면 서식이 사라지므로 매번 보증한다.
  assert.equal(fmt.applied, 'yyyy-mm-dd hh:mm', '시각 열 표시 형식을 보증하지 않는다 — ISO 원문 렌더가 되살아난다');
});

/* [v9.133] 08-02 실측으로 잡은 자기 결함: 서식 보증을 「행 2개 이상」 가드 안에 넣었더니
 *   테스트 잔재를 지워 빈 시트가 된 순간 영영 건너뛰게 됐다 — 서식이 가장 필요한 때가 바로 그때인데.
 *   빈 시트일 때야말로 첫 기록이 처음부터 제대로 보이도록 미리 깔아야 한다. */
test('[v9.133] 데이터가 0행이어도 시각 열 서식은 걸린다 (빈 시트를 건너뛰지 않는다)', () => {
  const fmt = { applied: null, cur: '' };
  const tc = {
    getLastRow: () => 1,          // 헤더만 = 방금 잔재를 지운 상태
    getMaxRows: () => 100,
    getRange: () => ({
      getValues: () => [],
      getNumberFormat: () => fmt.cur,
      setNumberFormat: (f) => { fmt.applied = f; fmt.cur = f; },
    }),
    deleteRow: () => {},
  };
  const s = code.indexOf('/* ⑤ [v9.127] teacher_checkins 연타 중복 정리');
  const e = code.indexOf('// [v9.6] 🌍 월드 레이드 — 학원 전체');
  const body = code.slice(s, e).replace(/\}\s*$/, '');
  new Function('ss', 'TC_NAME_COL', 'TC_TYPE_COL', 'TC_TIME_COL', 'Logger', body)(
    { getSheetByName: (n) => (n === 'teacher_checkins' ? tc : null) }, 1, 2, 3, { log: () => {} });
  assert.equal(fmt.applied, 'yyyy-mm-dd hh:mm',
    '빈 시트를 건너뛴다 — 첫 출근 기록이 다시 ISO 원문으로 보인다');
});

test('[v9.133] 시각 열 서식이 이미 맞으면 다시 쓰지 않는다 (쿼터 보호)', () => {
  const rows = [['김강사', '출근', new Date('2026-08-02T09:00:00Z')]];
  const fmt = { applied: null, cur: 'yyyy-mm-dd hh:mm' };
  const tc = {
    getLastRow: () => rows.length + 1,
    getMaxRows: () => rows.length + 1,
    getRange: () => ({
      getValues: () => rows.map(x => x.slice(0, 3)),
      getNumberFormat: () => fmt.cur,
      setNumberFormat: (f) => { fmt.applied = f; fmt.cur = f; },
    }),
    deleteRow: () => {},
  };
  const s = code.indexOf('/* ⑤ [v9.127] teacher_checkins 연타 중복 정리');
  const e = code.indexOf('// [v9.6] 🌍 월드 레이드 — 학원 전체');
  const body = code.slice(s, e).replace(/\}\s*$/, '');
  new Function('ss', 'TC_NAME_COL', 'TC_TYPE_COL', 'TC_TIME_COL', 'Logger', body)(
    { getSheetByName: (n) => (n === 'teacher_checkins' ? tc : null) }, 1, 2, 3, { log: () => {} });
  assert.equal(fmt.applied, null, '서식이 같은데도 매번 다시 쓴다 — 자기치유는 매일 밤 도는 함수다');
});

test('[v9.129] ymTextOf_ — String(Date)가 텍스트로 굳은 셀도 yyyy-MM으로 되돌린다', () => {
  // 08-02 라이브 실측값 그대로 — 이 형태가 Date 분기·시리얼 분기를 둘 다 빠져나가 두 번의 수리를 통과했다
  assert.equal(ctx.ymTextOf_('Wed Jul 01 2026 00:00:00 GMT+0800 (Ulaanbaatar Standard Time)', 'Asia/Ulaanbaatar'), '2026-07');
  assert.equal(ctx.ymTextOf_('Mon Jun 01 2026 00:00:00 GMT+0800 (Ulaanbaatar Standard Time)', 'Asia/Ulaanbaatar'), '2026-06');
  // 사람이 쓴 텍스트는 건드리지 않는다
  assert.equal(ctx.ymTextOf_('2026-08', 'Asia/Ulaanbaatar'), '2026-08');
  assert.equal(ctx.ymTextOf_('여름 시즌', 'Asia/Ulaanbaatar'), '여름 시즌');
  assert.equal(ctx.ymTextOf_('Monday 회의록', 'Asia/Ulaanbaatar'), 'Monday 회의록', '요일로 시작하는 일반 텍스트를 날짜로 오변환한다');
});

/* ═══════ [v9.130] 개원 시뮬(08-02)이 잡은 침묵 — 조 편성표 ═══════ */
test('[v9.130] groupBoardText_ — 조 편성이 없을 때 빈 문자열 대신 원인과 처방을 돌려준다', () => {
  const s = code.indexOf('function groupBoardText_');
  const seg = code.slice(s, code.indexOf('function ', s + 30));
  assert.equal(/if \(!b\) return '';/.test(코드만(seg)), false,
    '빈 문자열 반환이 되살아났다 — 강사 브리핑에서 조 편성표가 「원래 없는 항목」처럼 조용히 사라진다');
  // 원인 3종을 구분해 각각 다른 처방을 준다
  assert.ok(seg.includes('setSeasonStart'), '시즌 시작일 미설정 안내가 없다');
  assert.ok(seg.includes('assignGroupsAll'), '전 반 미편성 안내가 없다');
  assert.ok(seg.includes('assignGroups("'), '해당 반만 미편성인 경우의 안내가 없다');
  assert.ok(seg.indexOf('seasonLabelOf_') < seg.indexOf('assignGroupsAll'),
    '원인 판정 없이 문구만 나열한다 — 세 경우를 실제로 갈라야 처방이 맞는다');
});

/* ═══════ [v9.131] 인자가 필요한 함수는 ▶로 실행할 수 없다 — 입구를 만든다 ═══════ */
test('[v9.131] 시즌 시작일 — 프롬프트 입구가 있고, 인자 없는 setSeasonStart는 여전히 거부한다', () => {
  assert.ok(/function seasonStartPrompt\(\)/.test(code), '날짜를 물어보는 입구가 없다 — ▶ 버튼은 인자를 못 넘긴다');
  const seg = code.slice(code.indexOf('function seasonStartPrompt'), code.indexOf('function menuAssignGroups'));
  assert.ok(seg.includes('ui.prompt'), '입력을 받지 않는다');
  assert.ok(seg.includes('ButtonSet.YES_NO'), '확인 단계가 없다 — 시즌 시작일은 틀리면 차시가 통째로 밀린다');
  assert.ok(seg.includes('setSeasonStart('), '정본 함수를 거치지 않고 직접 쓴다(규칙 중복)');
  assert.ok(seg.includes('SEASON_WEEKS'), '종료일을 보여주지 않는다 — 날짜가 맞는지는 그걸 봐야 안다');
  // 원래 안전장치는 살아 있어야 한다: 인자 없이 부르면 설정하지 않는다
  const orig = code.slice(code.indexOf('function setSeasonStart'), code.indexOf('function seasonLabelOf_'));
  assert.ok(orig.includes('if (!dateStr)'), '인자 없는 호출을 거부하는 가드가 사라졌다 — ▶ 한 번에 오늘 날짜가 박힌다');
  // 메뉴 등재
  assert.ok(code.includes("addItem('🗓 시즌 시작일 설정(개원 준비 1)', 'seasonStartPrompt')"), '메뉴에 없다');
  assert.ok(code.includes("addItem('🧩 전 반 조 편성(개원 준비 2)', 'menuAssignGroups')"), '조 편성 메뉴가 없다');
});

/* ═══════ [v9.132] 시즌 키 Date 오염 — 월키 오염의 네 번째 재현 지점(groups A열) ═══════ */
test('[v9.132] seasonKeyOf_ — Date·String(Date)·문자열이 모두 같은 키를 낸다', () => {
  const d = vm.runInContext('new Date(2026, 6, 13)', ctx); // 2026-07-13
  assert.equal(ctx.seasonKeyOf_('2026-07-13', 'Asia/Ulaanbaatar'), '2026-07-13', '정상 문자열을 훼손한다');
  assert.equal(ctx.seasonKeyOf_('Mon Jul 13 2026 00:00:00 GMT+0800 (Ulaanbaatar Standard Time)', 'Asia/Ulaanbaatar'),
    '2026-07-13', 'String(Date)가 텍스트로 굳은 형태를 못 되돌린다');
  assert.equal(ctx.seasonKeyOf_('', 'Asia/Ulaanbaatar'), '', '빈 값 처리가 다르다');
  assert.equal(ctx.seasonKeyOf_('정규반1', 'Asia/Ulaanbaatar'), '정규반1', '일반 텍스트를 날짜로 오변환한다');
});

test('[v9.132] 시즌 비교 7곳이 전부 정규화를 거친다 (하나라도 빠지면 그 화면만 조용히 빈다)', () => {
  const raw = (code.match(/String\(r\[0\]\)\s*[!=]==\s*season/g) || []);
  assert.deepEqual(raw, [], '정규화를 안 거치는 시즌 비교가 남아 있다: ' + raw.join(' / '));
  const norm = (code.match(/seasonKeyOf_\(r\[0\], tz\)/g) || []).length;
  /* [vNEXT] 5 → 7 — `talk_index_log` 의 적재(멱등 키)와 소비(주간 리포트 꼬리)가 새 비교 둘을 더했다.
   *   그 둘은 처음에 맨몸 `String()` 으로 짰다가 ①배포 검수 P1 으로 잡혔다: 시트가 'yyyy-MM-dd' 를
   *   Date 로 삼켜 재실행마다 중복 적재였다 — v9.132 가 groups 시트에서 이미 겪은 그 함정 그대로다.
   *   숫자를 올릴 때는 «왜 늘었는지»를 여기 적는다(안 적으면 다음 사람이 무심코 올려 래칫이 풀린다). */
  assert.equal(norm, 7, '정규화 지점이 7곳이 아니다(현재 ' + norm + ') — 새 비교가 늘었거나 하나가 사라졌다');
});

test('[v9.132] assignGroups 재실행이 교체다 — 시즌 열을 텍스트로 굳혀 다음 비교가 어긋나지 않는다', () => {
  const seg = code.slice(code.indexOf('function assignGroups(className'), code.indexOf('function assignGroupsAll'));
  const fmtAt = seg.indexOf("setNumberFormat('@')");
  const writeAt = seg.indexOf('.setValues(svCol)');
  assert.ok(fmtAt > -1 && writeAt > -1, '시즌 열 정상화가 없다');
  assert.ok(fmtAt < writeAt, '쓰기가 서식보다 먼저다 — 되쓴 값이 그 자리에서 다시 Date가 된다(v9.128과 같은 함정)');
  assert.ok(seg.includes('const keep = all.filter(r => !(seasonKeyOf_'),
    '교체 필터가 정규화를 안 거친다 — 재실행이 누적이 되어 한 학생이 여러 조에 동시에 들어간다');
});

test('[v9.132] 조 편성표가 실제 인원을 적는다 — 1인 조에 "3인 조"라고 쓰지 않는다', () => {
  const seg = code.slice(code.indexOf('function groupBoardRender_'), code.indexOf('function groupBoardPreview'));
  assert.equal(/조 전체\(3인 조\)/.test(코드만(seg)), false, '인원이 하드코딩돼 있다 — 1인 조에도 "3인 조"라고 찍힌다');
  assert.ok(seg.includes("arr.length + '인 조"), '실제 인원을 쓰지 않는다');
  assert.ok(seg.includes('arr.length !== 4'), '5인 조(정원 초과)가 이 분기로 안 온다 — 짝 규칙(pairSeatOf_)과 기준이 갈린다');
});
