// 크루카드 접수 감시 회귀 [v9.171] — 「알림이 나가는가/침묵하는가」를 결과로 검사한다.
//   이 장치의 값은 전부 «부르는가»에 있다: 로직이 아무리 정확해도 발동하지 않으면 통과와 같은 모양이다.
//   그래서 ①parentSweep 배선 ②웹앱 쪽 메일 금지 ③가짜 시트로 실제 실행 — 셋을 함께 잠근다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const 폼리포트 = read('엔진_폼리포트.js');
const 콘텐츠AI = read('엔진_콘텐츠AI.js');
const 크루서버 = read('crewcard/크루카드.js');

/* ── 발동층 ─────────────────────────────────────────────────────── */

test('배선 — parentSweep이 crewIntakeWatch를 부른다 (안 불리면 로직이 아무리 맞아도 침묵이다)', () => {
  const sweep = 콘텐츠AI.slice(콘텐츠AI.indexOf('function parentSweep()'), 콘텐츠AI.indexOf('function translateTopics_'));
  assert.ok(sweep.includes('crewIntakeWatch_(ss)'), '10분 스위프에 접수 감시 배선이 없다 — 접수가 들어와도 아무도 안 부른다');
  assert.ok(/safeRun\('crewIntakeWatch'/.test(sweep), 'safeRun 밖에 있으면 여기서 throw할 때 뒤의 스위프가 함께 죽는다');
});

test('결정 못박기 — 크루카드 웹앱은 메일을 쏘지 않는다 (익명 POST = 메일 폭탄 벡터)', () => {
  assert.ok(!/MailApp|GmailApp/.test(크루서버), 'crewcard 웹앱에 메일 발송이 생겼다 — 무토큰 익명 엔드포인트가 메일을 발사하게 된다');
  assert.ok(!/MailApp|GmailApp/.test(read('crewcard/상담시트.js')), 'crewcard 이관부에 메일 발송이 생겼다(같은 이유)');
});

test('사본 동치 — 상한·타임존이 웹앱 정본과 갈리면 경고 시점과 「오늘」이 어긋난다', () => {
  const capMain = Number((폼리포트.match(/const CREW_CAP_ = (\d+)/) || [])[1]);
  const capCanon = Number((크루서버.match(/const DAILY_CAP = (\d+)/) || [])[1]);
  assert.equal(capMain, capCanon, `CREW_CAP_(${capMain}) ≠ crewcard DAILY_CAP(${capCanon})`);
  const tzMain = (폼리포트.match(/const CREW_TZ_ = '([^']+)'/) || [])[1];
  const tzCanon = (크루서버.match(/const TZ_ = '([^']+)'/) || [])[1];
  assert.equal(tzMain, tzCanon, `CREW_TZ_(${tzMain}) ≠ crewcard TZ_(${tzCanon}) — 「오늘 건수」가 하루 어긋난다`);
});

test('마커 방식 금지 — 마지막 serial 비교로 되돌아가면 crew_cards 초기화 후 영원히 침묵한다', () => {
  const fn = 폼리포트.slice(폼리포트.indexOf('function crewIntakeWatch_'), 폼리포트.indexOf('function importFormResponses'));
  assert.ok(/indexOf\(s\) === -1/.test(fn), '집합 차집합(새 원소만) 판정이 사라졌다');
  assert.ok(!/>\s*이전문|이전문\s*</.test(fn), 'serial 크기 비교(마커)가 되살아났다 — 채번 리셋에 눈이 먼다');
});

/* ── 실행 하네스 ───────────────────────────────────────────────── */

function 시트_(grid) {
  const W = grid.reduce((m, r) => Math.max(m, r.length), 0);
  const pad = (r) => { const o = r.slice(); while (o.length < W) o.push(''); return o; };
  const g = grid.map(pad);
  return {
    grid: g,
    getLastRow: () => g.length,
    getLastColumn: () => W,
    getRange(r, c, nr = 1, nc = 1) {
      return {
        getValues: () => {
          const out = [];
          for (let i = 0; i < nr; i++) out.push((g[r - 1 + i] || new Array(W).fill('')).slice(c - 1, c - 1 + nc));
          return out;
        },
        setValues: (vals) => {
          for (let i = 0; i < nr; i++) {
            if (!g[r - 1 + i]) g[r - 1 + i] = new Array(W).fill('');
            for (let j = 0; j < nc; j++) g[r - 1 + i][c - 1 + j] = vals[i][j];
          }
        },
        setValue: (v) => { if (!g[r - 1]) g[r - 1] = new Array(W).fill(''); g[r - 1][c - 1] = v; },
      };
    },
  };
}

const 상담헤더 = ['이름(한국어)', '연락처', '처리상태', '크루카드번호'];
const 상담시트_ = (rows) => 시트_([['◆ 관리·기본', '', '', ''], 상담헤더].concat(rows));
const 크루시트_ = (rows) => 시트_([['submitted_at', 'ref_serial']].concat(rows));

function 하네스_(src) {
  const 상태 = {};                    // app_state 대역
  const 메일 = [];
  const 탭 = { consult: null, crew: null };
  const body = (src || 폼리포트);
  const 상수 = body.slice(body.indexOf('const CREW_TAB_'), body.indexOf('function crewIntakeWatch_'));
  const 함수 = body.slice(body.indexOf('function crewIntakeWatch_'), body.indexOf('function importFormResponses'));

  const api = new Function(
    'SpreadsheetApp', 'MailApp', 'Utilities', 'Logger', 'ensureSheet', 'getState', 'setState',
    'quotaOk', 'ADMIN_EMAIL', 'CONSULT_SHEET_ID',
    상수 + '\n' + 함수 + '\nreturn crewIntakeWatch_;'
  )(
    { openById: () => ({ getSheetByName: (n) => (n === '상담데이터입력' ? 탭.consult : (n === 'crew_cards' ? 탭.crew : null)) }) },
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
    () => true,
    'admin@synk.test',
    'FAKE-SHEET-ID'
  );
  return { 실행: (c, k) => { 탭.consult = c; 탭.crew = k; return api({}); }, 메일, 상태 };
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
