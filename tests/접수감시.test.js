// 크루카드 접수 감시 회귀 [v9.171] — 「알림이 나가는가/침묵하는가」를 결과로 검사한다.
//   이 장치의 값은 전부 «부르는가»에 있다: 로직이 아무리 정확해도 발동하지 않으면 통과와 같은 모양이다.
//   그래서 ①parentSweep 배선 ②웹앱 쪽 메일 금지 ③가짜 시트로 실제 실행 — 셋을 함께 잠근다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
/* 시트 흉내는 공용 하나다 — 계약·근거·변이 픽스처가 거기 산다(#Q85 · F460). */
const { 시트흉내 } = require('./lib/시트흉내.js');

// SYNK_TEST_SRC_ROOT = 변이 실험용 이음매(궤적·크루카드 테스트와 같은 규약). 평소엔 실소스를 본다.
const ROOT = process.env.SYNK_TEST_SRC_ROOT || path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const 폼리포트 = read('엔진_폼리포트.js');
const 콘텐츠AI = read('엔진_콘텐츠AI.js');
const 크루서버 = read('crewcard/크루카드.js');
/* 부정 단언(「~가 없어야 한다」)의 주어만 이걸로 감싼다 — 주석이 금지 패턴을 «설명»하면 그 검사가
 * 설명을 위반으로 읽는다(「메일을 쏘지 않는다」를 적어 둔 자리가 곧 위반이 된다). (대기열 #Q72) */
const { 코드만 } = require('./lib/소스검사.js');

/* ── 발동층 ─────────────────────────────────────────────────────── */

test('배선 — parentSweep이 crewIntakeWatch를 부른다 (안 불리면 로직이 아무리 맞아도 침묵이다)', () => {
  const sweep = 콘텐츠AI.slice(콘텐츠AI.indexOf('function parentSweep()'), 콘텐츠AI.indexOf('function translateTopics_'));
  assert.ok(sweep.includes('crewIntakeWatch_(ss)'), '10분 스위프에 접수 감시 배선이 없다 — 접수가 들어와도 아무도 안 부른다');
  assert.ok(/safeRun\('crewIntakeWatch'/.test(sweep), 'safeRun 밖에 있으면 여기서 throw할 때 뒤의 스위프가 함께 죽는다');
});

test('결정 못박기 — 크루카드 웹앱은 메일을 쏘지 않는다 (익명 POST = 메일 폭탄 벡터)', () => {
  assert.ok(!/MailApp|GmailApp/.test(코드만(크루서버)), 'crewcard 웹앱에 메일 발송이 생겼다 — 무토큰 익명 엔드포인트가 메일을 발사하게 된다');
  assert.ok(!/MailApp|GmailApp/.test(코드만(read('crewcard/상담시트.js'))), 'crewcard 이관부에 메일 발송이 생겼다(같은 이유)');
});

test('사본 동치 — 상한·타임존이 웹앱 정본과 갈리면 경고 시점과 「오늘」이 어긋난다', () => {
  const capMain = Number((폼리포트.match(/const CREW_CAP_ = (\d+)/) || [])[1]);
  const capCanon = Number((크루서버.match(/const DAILY_CAP = (\d+)/) || [])[1]);
  assert.equal(capMain, capCanon, `CREW_CAP_(${capMain}) ≠ crewcard DAILY_CAP(${capCanon})`);
  const tzMain = (폼리포트.match(/const CREW_TZ_ = '([^']+)'/) || [])[1];
  const tzCanon = (크루서버.match(/const TZ_ = '([^']+)'/) || [])[1];
  assert.equal(tzMain, tzCanon, `CREW_TZ_(${tzMain}) ≠ crewcard TZ_(${tzCanon}) — 「오늘 건수」가 하루 어긋난다`);
  // 오류 탭 이름이 갈리면 웹앱은 적는데 감시는 딴 데를 본다 — 기록만 쌓이고 영원히 침묵
  const errMain = (폼리포트.match(/const CREW_ERR_TAB_ = '([^']+)'/) || [])[1];
  const errCanon = (크루서버.match(/const ERR_TAB = '([^']+)'/) || [])[1];
  assert.equal(errMain, errCanon, `CREW_ERR_TAB_(${errMain}) ≠ crewcard ERR_TAB(${errCanon})`);
});

test('🔴 사본 동치 — crew_errors 열 스키마: 쓰는 쪽 헤더와 읽는 쪽 열 번호가 같아야 한다', () => {
  /* 두 프로젝트는 **따로 배포된다** — 한쪽만 밀린 상태가 정상적으로 존재한다. 스위프는 열을 이름이
   * 아니라 번호로 읽으므로(getRange(…,4)·v[3]), 웹앱이 헤더를 하나 끼우면 「통보」 자리에
   * detail(늘 값이 있다)이 와서 **전 행이 「이미 통보됨」으로 읽힌다 — 폭주가 아니라 영구 침묵**이다.
   * 이름만 잠그던 위 검사의 사각(적대 리뷰 H2). */
  const 헤더 = (크루서버.match(/setValues\(\[\[('at'[^\]]*)\]\]\)/) || [])[1];
  assert.ok(헤더, 'crew_errors 헤더 리터럴을 못 찾았다 — 형태가 바뀌었으면 이 검사부터 고쳐라');
  const 열 = 헤더.match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  assert.deepEqual(열, ['at', 'stage', 'detail', '통보'], '웹앱이 쓰는 헤더가 바뀌었다');
  assert.equal(열.indexOf('통보') + 1, 4, '「통보」가 4열이 아니다');

  const 수확 = 폼리포트.slice(폼리포트.indexOf('function crewErrRows_'), 폼리포트.indexOf('function crewErr절_'));
  assert.match(수확, /getRange\(2, 1, errs\.getLastRow\(\) - 1, 4\)/, `읽는 폭이 ${열.length}열과 다르다`);
  assert.match(수확, /v\[3\]/, '「통보」를 4열(v[3])에서 읽지 않는다');
  const 표식 = 폼리포트.slice(폼리포트.indexOf('function crewErrMark_'), 폼리포트.indexOf('function crewErrOnly_'));
  assert.match(표식, /getRange\(o\.row, 4\)\.setValue/, '표식을 4열에 안 찍는다');
  // appendRow도 4칸이어야 한다 — 3칸이면 「통보」 자리가 아예 없어 스위프의 v[3]이 undefined다.
  // 괄호 깊이를 세어 **최상위** 쉼표만 본다(중첩 호출의 쉼표를 같이 세면 검사가 거짓말을 한다)
  const app = (크루서버.match(/sh\.appendRow\(\[([\s\S]*?)\]\);/) || [])[1] || '';
  let d = 0, 칸 = 1;
  for (const ch of app) {
    if ('([{'.includes(ch)) d++;
    else if (')]}'.includes(ch)) d--;
    else if (ch === ',' && d === 0) 칸++;
  }
  assert.equal(칸, 4, `오류 행 append가 ${칸}칸이다(헤더는 4열): ${app}`);
});

test('마커 방식 금지 — 마지막 serial 비교로 되돌아가면 crew_cards 초기화 후 영원히 침묵한다', () => {
  const fn = 폼리포트.slice(폼리포트.indexOf('function crewIntakeWatch_'), 폼리포트.indexOf('function importFormResponses'));
  assert.ok(/indexOf\(s\) === -1/.test(fn), '집합 차집합(새 원소만) 판정이 사라졌다');
  assert.ok(!/>\s*이전문|이전문\s*</.test(코드만(fn)), 'serial 크기 비교(마커)가 되살아났다 — 채번 리셋에 눈이 먼다');
});

/* ── 실행 하네스 ───────────────────────────────────────────────── */

/* 쓰기·읽기·삼킴은 **공용 통로**에 얹는다(`tests/lib/시트흉내.js` · #Q85 · F460) — 손으로 다시 지으면
 *   사본이 되고, 라이브와 갈라져도 아무도 못 잰다. 여기 남은 것은 이 시험에만 필요한 겉면뿐이다.
 *   ⚠ 실제 Range 에 있는 메서드를 빠뜨리면 코드가 예외로 조용히 건너뛰고 하네스만 초록이 된다(실측). */
function 시트_(grid) {
  const W = grid.reduce((m, r) => Math.max(m, r.length), 0);
  const pad = (r) => { const o = r.slice(); while (o.length < W) o.push(''); return o; };
  const sh = 시트흉내({ 첫행: 1, 행들: grid.map(pad) });
  return Object.assign(sh, { grid: sh.data, getLastColumn: () => W });
}

const 상담헤더 = ['이름(한국어)', '연락처', '처리상태', '크루카드번호'];
const 상담시트_ = (rows) => 시트_([['◆ 관리·기본', '', '', ''], 상담헤더].concat(rows));
const 크루시트_ = (rows) => 시트_([['submitted_at', 'ref_serial']].concat(rows));
const 오류시트_ = (rows) => 시트_([['at', 'stage', 'detail', '통보']].concat(rows));

function 하네스_(src, opts) {
  const 상태 = {};                    // app_state 대역
  const 메일 = [];
  const 탭 = { consult: null, crew: null, errs: null };
  const body = (src || 폼리포트);
  const 상수 = body.slice(body.indexOf('const CREW_TAB_'), body.indexOf('function crewIntakeWatch_'));
  // crewIntakeWatch_ + 뒤따르는 오류 회수 3종(crewErrRows_·crewErr절_·crewErrMark_·crewErrOnly_)까지 한 덩어리
  const 함수 = body.slice(body.indexOf('function crewIntakeWatch_'), body.indexOf('function importFormResponses'));

  const api = new Function(
    'SpreadsheetApp', 'MailApp', 'Utilities', 'Logger', 'ensureSheet', 'getState', 'setState',
    'quotaOk', 'ADMIN_EMAIL', 'CONSULT_SHEET_ID',
    상수 + '\n' + 함수 + '\nreturn crewIntakeWatch_;'
  )(
    { openById: () => ({ getSheetByName: (n) => (n === '상담데이터입력' ? 탭.consult : (n === 'crew_cards' ? 탭.crew : (n === 'crew_errors' ? 탭.errs : null))) }) },
    { sendEmail: (to, subj, text) => 메일.push({ to, subj, text }) },
    {
      formatDate: (d, tz, f) => {
        const p2 = (n) => (n < 10 ? '0' : '') + n;
        return d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate());   // 'yyyyMMdd'만 쓴다
      },
    },
    { log: () => {} },
    () => ({}),                                   // ensureSheet → app_state 대역(키만 쓰므로 빈 객체)
    (st, k) => ({ row: 상태[k] === undefined ? -1 : 1, val: 상태[k] === undefined ? '' : 상태[k] }),
    (st, k, v) => { 상태[k] = String(v); },
    (opts && opts.quota) || (() => true),
    'admin@synk.test',
    'FAKE-SHEET-ID'
  );
  return { 실행: (c, k, e) => { 탭.consult = c; 탭.crew = k; 탭.errs = e || null; return api({}); }, 메일, 상태 };
}

const 오늘_ = () => {
  const d = new Date(), p2 = (n) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate());
};
const 방금_ = () => new Date(Date.now() - 60 * 1000);
const S = (n) => 'SL-' + 오늘_() + '-' + String(n).padStart(3, '0');

/* ── 동작 ──────────────────────────────────────────────────────── */

test('첫 실행은 기준선만 저장하고 침묵한다 (기존 접수 전량이 「새것」으로 잡히면 안 된다)', () => {
  const h = 하네스_();
  h.실행(상담시트_([['바트', '99112233', '신규접수', S(1)]]), 크루시트_([[방금_(), S(1)]]));
  assert.equal(h.메일.length, 0, '첫 실행이 대량 알림을 냈다');
  assert.equal(h.상태['크루접수_통보지문'], 'v1:' + S(1), '기준선이 저장되지 않았다 — 다음 실행도 첫 실행이 된다');
});

test('🔑 접수 0건에서 시작해도 첫 접수는 알린다 (빈 지문을 「저장된 적 없음」으로 읽으면 최초 1건이 침묵한다)', () => {
  // 개원 전 상태에서 감시를 켜는 것이 정상 경로다. 그때 지문이 빈 문자열이면 초회 판정이
  // 영영 참이 되어, 정작 첫 학생의 접수가 조용히 지나간다 — 이 장치가 막으려던 바로 그 실패.
  const h = 하네스_();
  h.실행(상담시트_([]), 크루시트_([]));
  h.실행(상담시트_([['첫학생', '99112233', '신규접수', S(1)]]), 크루시트_([[방금_(), S(1)]]));
  assert.equal(h.메일.length, 1, '개원 후 첫 접수가 침묵했다');
  assert.match(h.메일[0].text, /첫학생/);
});

test('신규 접수 1건 → 메일 1통, 그다음 실행은 침묵 (10분마다 스팸이 되면 안 된다)', () => {
  const h = 하네스_();
  const crew = 크루시트_([[방금_(), S(1)]]);
  h.실행(상담시트_([['바트', '99112233', '신규접수', S(1)]]), crew);          // 기준선
  const 상담 = 상담시트_([['바트', '99112233', '신규접수', S(1)], ['솔롱고', '88112233', '신규접수', S(2)]]);
  h.실행(상담, 크루시트_([[방금_(), S(1)], [방금_(), S(2)]]));
  assert.equal(h.메일.length, 1, '신규 접수인데 알림이 없다');
  assert.match(h.메일[0].subj, /신규 접수 1건/);
  assert.match(h.메일[0].text, /솔롱고/);
  assert.match(h.메일[0].text, /반배정/, '무엇을 해야 하는지가 없으면 알림이 손일로 돌아온다');
  assert.ok(!h.메일[0].text.includes('바트'), '이미 알린 건이 다시 실렸다');

  h.실행(상담, 크루시트_([[방금_(), S(1)], [방금_(), S(2)]]));
  assert.equal(h.메일.length, 1, '변화가 없는데 또 알렸다 — 10분마다 스팸이 된다');
});

test('원장이 처리상태만 바꾸면 침묵한다 (사람이 일한 것은 사건이 아니다)', () => {
  const h = 하네스_();
  h.실행(상담시트_([['바트', '99112233', '신규접수', S(1)]]), 크루시트_([[방금_(), S(1)]]));
  h.실행(상담시트_([['바트', '99112233', '반배정', S(1)]]), 크루시트_([[방금_(), S(1)]]));
  assert.equal(h.메일.length, 0, `처리상태 변경을 사건으로 알렸다: ${JSON.stringify(h.메일)}`);
});

test('지문이 줄기만 하면 침묵한다 (아카이브·정리는 사건이 아니다)', () => {
  const h = 하네스_();
  h.실행(상담시트_([['바트', '99112233', '신규접수', S(1)], ['솔롱고', '88112233', '신규접수', S(2)]]),
    크루시트_([[방금_(), S(1)], [방금_(), S(2)]]));
  h.실행(상담시트_([['바트', '99112233', '신규접수', S(1)]]), 크루시트_([[방금_(), S(1)]]));
  assert.equal(h.메일.length, 0, `줄어든 것을 사건으로 알렸다: ${JSON.stringify(h.메일)}`);
});

test('재제출 — 미착수는 「갱신됨」, 착수 이후는 🔴「반영 안 됨」으로 갈라 알린다', () => {
  const h = 하네스_();
  const crew0 = 크루시트_([[방금_(), S(1)], [방금_(), S(2)]]);
  h.실행(상담시트_([['바트', '99112233', '신규접수', S(1)], ['솔롱고', '88112233', '반배정', S(2)]]), crew0);

  const crew1 = 크루시트_([[방금_(), S(1)], [방금_(), S(2)], [방금_(), S(3)], [방금_(), S(4)]]);
  h.실행(상담시트_([
    ['바트', '99112233', '신규접수', S(3) + ' ← ' + S(1)],        // 미착수 재제출 → 덮였다
    ['솔롱고', '88112233', '반배정', S(4) + ' ← ' + S(2)],         // 착수 이후 재제출 → 안 덮었다
  ]), crew1);

  assert.equal(h.메일.length, 1);
  const t = h.메일[0].text;
  assert.match(t, /🔄 재제출 1건[\s\S]*갱신됐습니다[\s\S]*바트[\s\S]*따로 하실 일은 없습니다/, '미착수 재제출을 「갱신됨」으로 안내하지 않는다');
  assert.match(t, /🔴 재제출 1건[\s\S]*반영하지 않았습니다[\s\S]*솔롱고/, '착수 이후 재제출을 위험으로 표시하지 않는다 — 이게 [v9.168]이 남긴 구멍이었다');
  assert.match(t, /crew_cards/, '원본을 어디서 보는지가 없다');
});

test('이관 유실 — crew_cards에 있는데 상담시트에 없으면 🔴로 알린다 (원장 큐에서 사라진 접수)', () => {
  const h = 하네스_();
  h.실행(상담시트_([['바트', '99112233', '신규접수', S(1)]]), 크루시트_([[방금_(), S(1)]]));
  h.실행(상담시트_([['바트', '99112233', '신규접수', S(1)]]),
    크루시트_([[방금_(), S(1)], [방금_(), S(2)]]));                 // 002는 이관 실패
  assert.equal(h.메일.length, 1, '유실을 못 잡았다 — 이 접수는 영원히 안 보인다');
  assert.match(h.메일[0].subj, /확인 필요/);
  assert.match(h.메일[0].text, new RegExp('이관 유실 의심 1건[\\s\\S]*' + S(2)));
});

test('유실 오탐 방지 — 이력에 밀려난 옛 번호와 2시간 지난 건은 유실이 아니다', () => {
  const h = 하네스_();
  const 옛날 = new Date(Date.now() - 5 * 60 * 60 * 1000);
  h.실행(상담시트_([['바트', '99112233', '신규접수', S(2) + ' ← ' + S(1)]]),
    크루시트_([[옛날, S(1)], [방금_(), S(2)]]));
  h.실행(상담시트_([['바트', '99112233', '신규접수', S(2) + ' ← ' + S(1)]]),
    크루시트_([[옛날, S(1)], [방금_(), S(2)], [옛날, S(3)]]));       // 003은 2시간 밖 → 판단 보류
  assert.equal(h.메일.length, 0, `오탐이 났다: ${JSON.stringify(h.메일)}`);
});

test('🔑 crew_cards를 비워 채번이 001부터 다시 시작해도 알린다 (마커 방식이었으면 영원히 침묵)', () => {
  const h = 하네스_();
  h.실행(상담시트_([['바트', '99112233', '신규접수', S(9)]]), 크루시트_([[방금_(), S(9)]]));
  h.실행(상담시트_([['새사람', '77112233', '신규접수', S(1)]]), 크루시트_([[방금_(), S(1)]]));
  assert.equal(h.메일.length, 1, '작은 번호로 되돌아간 접수를 놓쳤다 — 08-04에 실제로 만든 상태다');
  assert.match(h.메일[0].text, /새사람/);
});

test('상한 근접 — 80%에서 경고하고 같은 날 두 번은 안 보낸다', () => {
  const h = 하네스_();
  h.실행(상담시트_([['바트', '99112233', '신규접수', S(1)]]), 크루시트_([[방금_(), S(1)]]));   // 기준선
  h.실행(상담시트_([['바트', '99112233', '신규접수', S(1)], ['늦둥이', '77112233', '신규접수', S(240)]]),
    크루시트_([[방금_(), S(1)], [방금_(), S(240)]]));
  assert.equal(h.메일.length, 1, '상한 80%인데 조용하다 — 막히면 학생은 실패 화면을 보고 원장은 모른다');
  assert.match(h.메일[0].text, /240건 \/ 상한 300건/);
  h.실행(상담시트_([['바트', '99112233', '신규접수', S(1)], ['늦둥이', '77112233', '신규접수', S(240)]]),
    크루시트_([[방금_(), S(1)], [방금_(), S(240)]]));
  assert.equal(h.메일.length, 1, '같은 날 상한 경고가 두 번 나갔다');
});

test('🔒 익명 제출자가 지은 이름으로 경보 본문을 위조할 수 없다', () => {
  // 이 메일의 구조는 줄바꿈이다 — 이름 칸에 개행을 넣으면 가짜 절을 만들어 원장을 오도할 수 있다.
  const h = 하네스_();
  h.실행(상담시트_([]), 크루시트_([]));
  const 악의 = '바트\n🔴 이관 유실 의심 99건\n· 지금 당장 확인하세요';
  h.실행(상담시트_([[악의, '99112233', '신규접수', S(1)]]), 크루시트_([[방금_(), S(1)]]));
  assert.equal(h.메일.length, 1);
  const t = h.메일[0].text;
  assert.ok(!/\n🔴 이관 유실 의심 99건/.test(t), '이름의 개행이 그대로 실려 가짜 절이 만들어졌다');
  assert.match(t, /바트 🔴 이관 유실 의심 99건/, '개행만 접고 내용은 보이게 남겨야 한다(감춰버리면 무슨 이름인지 모른다)');
});

test('상담시트 증분 전이면 조용히 스킵한다 (열이 없는데 크래시하면 10분마다 실패 메일)', () => {
  const h = 하네스_();
  const 구시트 = 시트_([['◆'], ['이름(한국어)', '연락처']]);          // 처리상태·크루카드번호 없음
  assert.doesNotThrow(() => h.실행(구시트, 크루시트_([])));
  assert.equal(h.메일.length, 0);
  assert.equal(h.상태['크루접수_통보지문'], undefined, '감시할 수 없는 상태인데 지문을 저장했다');
});

/* ── 웹앱 오류 회수 — doPost가 'internal'로 삼킨 실패의 유일한 감시 통로 ── */

test('🔴 웹앱 오류 — 미통보 행을 1통으로 묶어 알리고, 보낸 뒤에만 통보 표식을 남긴다', () => {
  const h = 하네스_();
  h.실행(상담시트_([]), 크루시트_([]));                              // 기준선
  const e = 오류시트_([
    [방금_(), 'doPost', 'TypeError: Cannot read appendRow of null (크루_탭_)', ''],
    [방금_(), '이관:' + S(3), 'RangeError: 열 폭 초과', ''],
  ]);
  h.실행(상담시트_([]), 크루시트_([]), e);
  assert.equal(h.메일.length, 1, '웹앱 오류가 침묵했다 — 이 층이 없으면 지원자 유실을 아무도 모른다');
  assert.match(h.메일[0].subj, /확인 필요/, '오류인데 제목이 위험을 말하지 않는다');
  assert.match(h.메일[0].text, /접수 웹앱 오류 2건/);
  assert.match(h.메일[0].text, /doPost[\s\S]*appendRow/, '무슨 오류인지가 본문에 없다 — 시트를 또 열어봐야 한다');
  assert.match(h.메일[0].text, /crew_errors/, '어디서 원인을 보는지가 없다');
  assert.ok(e.grid[1][3] instanceof Date && e.grid[2][3] instanceof Date, '통보 표식이 안 남았다 — 10분마다 같은 경보가 나간다');

  h.실행(상담시트_([]), 크루시트_([]), e);
  assert.equal(h.메일.length, 1, '통보한 오류를 또 알렸다 — 표식을 안 읽는다');
});

test('웹앱 오류 — 쿼터로 못 보낸 틱은 표식을 안 남긴다(다음 틱이 다시 물어야 경보가 유실되지 않는다)', () => {
  const h = 하네스_(null, { quota: () => false });
  h.실행(상담시트_([]), 크루시트_([]));
  const e = 오류시트_([[방금_(), 'doPost', 'boom', '']]);
  h.실행(상담시트_([]), 크루시트_([]), e);
  assert.equal(h.메일.length, 0);
  assert.equal(String(e.grid[1][3] || ''), '', '메일이 안 나갔는데 통보됨으로 찍었다 — 이 오류는 영원히 침묵한다');
});

test('🔒 오류 detail의 개행으로 경보 본문을 위조할 수 없다 (이름 칸과 같은 계열의 2겹째)', () => {
  const h = 하네스_();
  h.실행(상담시트_([]), 크루시트_([]));
  const e = 오류시트_([[방금_(), 'doPost', '악의\n🔴 이관 유실 의심 99건\n· 지금 당장', '']]);
  h.실행(상담시트_([]), 크루시트_([]), e);
  assert.equal(h.메일.length, 1);
  assert.ok(!/\n🔴 이관 유실 의심 99건/.test(h.메일[0].text), 'detail의 개행이 그대로 실려 가짜 절이 만들어졌다');
  assert.match(h.메일[0].text, /악의 🔴 이관 유실 의심 99건/, '개행만 접고 내용은 보여야 한다');
});

test('🔴 상담시트를 못 읽어도 웹앱 오류는 알린다 — 오류가 가장 많은 날 감시가 먼저 죽으면 안 된다', () => {
  /* 전에는 오류 수확이 상담시트 전제조건 **뒤**에 있었다. 둘은 논리적으로 무관한데,
   * 상담시트 탭이 사라지거나 증분 전이면 crew_errors에 치명 오류가 쌓여도 메일 0통이었다.
   * 남는 건 Logger.log뿐이고 원장은 Apps Script 로그를 보지 않는다(적대 리뷰 H3). */
  for (const [이름, 상담] of [
    ['탭 없음', null],
    ['증분 전(열 없음)', 시트_([['◆'], ['이름(한국어)', '연락처']])],
  ]) {
    const h = 하네스_();
    const e = 오류시트_([[방금_(), 'doPost', 'boom', '']]);
    h.실행(상담, 크루시트_([]), e);
    assert.equal(h.메일.length, 1, `[${이름}] 웹앱 오류가 침묵했다`);
    assert.match(h.메일[0].text, /접수 웹앱 오류 1건/);
    assert.ok(e.grid[1][3] instanceof Date, `[${이름}] 표식이 안 남아 매 틱 재경보가 된다`);
    h.실행(상담, 크루시트_([]), e);
    assert.equal(h.메일.length, 1, `[${이름}] 통보한 오류를 또 알렸다`);
    // 상담시트를 못 읽는 상태이므로 접수 지문은 저장하지 않는다(감시할 수 없는 것을 「봤다」로 만들면 안 된다)
    assert.equal(h.상태['크루접수_통보지문'], undefined, `[${이름}] 감시 불가 상태인데 지문을 저장했다`);
  }
});

test('빈 행은 오류가 아니다 — 원장이 그 탭을 손보면 유령 경보가 난다', () => {
  // 이 메일이 원장을 정확히 crew_errors 탭으로 부른다. 거기서 내용을 지우면 빈 행이 남는데,
  // 「통보」 칸만 보고 세면 「🔴 웹앱 오류 N건」이 통째로 거짓이 된다(적대 리뷰 M1).
  const h = 하네스_();
  h.실행(상담시트_([]), 크루시트_([]));
  h.실행(상담시트_([]), 크루시트_([]), 오류시트_([['', '', '', ''], ['', '', '', '']]));
  assert.equal(h.메일.length, 0, `빈 행을 오류로 세어 경보를 냈다: ${JSON.stringify(h.메일)}`);
});

test('🔒 표식 직전 행을 다시 읽어 대조한다 — 발송 사이에 행이 밀리면 남의 행에 도장이 찍힌다', () => {
  /* 스냅샷 → 메일 발송(1~3초) → 도장 사이에 사람이 행을 지우거나 정렬하면 인덱스가 밀린다.
   * 그러면 ①안 알린 행에 「통보」가 찍혀 영원히 침묵하고 ②알린 행은 그대로라 재경보다.
   * 대가가 비대칭(한쪽이 영구 소실)이라 「모르면 안 찍는다」로 설계했다(적대 리뷰 M2). */
  const h = 하네스_();
  h.실행(상담시트_([]), 크루시트_([]));
  const e = 오류시트_([[방금_(), 'doPost', 'boom', '']]);
  const 원래 = e.getRange.bind(e);
  // 표식 단계의 단일 셀 읽기(2행 1열)만 「다른 행이 와 있는」 상태로 바꾼다 — 밀림을 시각이 아니라 값으로 재현
  e.getRange = (r, c, nr, nc) => (r === 2 && c === 1 && (nr === undefined || nr === 1) && (nc === undefined || nc === 1)
    ? { getValue: () => new Date(Date.now() - 9 * 60 * 60 * 1000), getValues: () => [[null]], setValue: () => {}, setValues: () => {} }
    : 원래(r, c, nr, nc));
  h.실행(상담시트_([]), 크루시트_([]), e);
  assert.equal(h.메일.length, 1, '메일 자체는 나갔어야 한다');
  assert.equal(String(e.grid[1][3] || ''), '', '행이 밀렸는데 그 자리에 도장을 찍었다 — 그 오류는 영원히 침묵한다');

  // 대조가 맞는 정상 경로에서는 반드시 찍힌다(위 검사만 있으면 「아무것도 안 찍는다」로도 초록이 된다)
  const g = 하네스_();
  g.실행(상담시트_([]), 크루시트_([]));
  const e2 = 오류시트_([[방금_(), 'doPost', 'boom', '']]);
  g.실행(상담시트_([]), 크루시트_([]), e2);
  assert.ok(e2.grid[1][3] instanceof Date, '밀리지 않았는데도 안 찍었다 — 매 틱 재경보가 된다');
});

test('웹앱 오류 — 폭주해도 메일은 10건까지만 싣고, 초과분도 통보로 센다(매 틱 재경보 방지)', () => {
  const h = 하네스_();
  h.실행(상담시트_([]), 크루시트_([]));
  const rows = [];
  for (let i = 0; i < 14; i++) rows.push([방금_(), 'doPost', '오류 ' + i, '']);
  const e = 오류시트_(rows);
  h.실행(상담시트_([]), 크루시트_([]), e);
  assert.equal(h.메일.length, 1);
  assert.match(h.메일[0].text, /접수 웹앱 오류 14건/);
  assert.match(h.메일[0].text, /외 4건/, '잘렸다는 사실이 안 보이면 「전부 봤다」로 읽힌다');
  for (let i = 1; i <= 14; i++) assert.ok(e.grid[i][3] instanceof Date, `행 ${i + 1}에 표식이 없다 — 다음 틱에 또 실린다`);
  h.실행(상담시트_([]), 크루시트_([]), e);
  assert.equal(h.메일.length, 1, '초과분이 재경보를 냈다');
});
