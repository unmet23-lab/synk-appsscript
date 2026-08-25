// SYNK 엔진 분할부 — 궤적. 「무엇을 목표했고, 실제로 어디로 갔나」를 한 사람으로 잇는 레일.
// 로드 순서 정본 = .clasp.json filePushOrder · 합본 테스트 정본 = tests/_engine-source.js ENGINE_FILES.
/* ═══════════════════════════════════════════════════════════════════════════
 * 왜 이 파일이 있나 (2026-08-04 · 로드맵 ④ 「유학 집약 봇」의 재료)
 * ───────────────────────────────────────────────────────────────────────────
 * 경쟁자가 복제할 수 없는 자산은 「몽골 학생이 무엇을 목표했고 실제로 어디로 갔는가」의 짝이다.
 * 대조에서 나온 것: **의도는 이미 넘치게 쌓이는데(크루카드 100+문항), 결과를 담는 자리가 없었다.**
 *   · exit_log      = 퇴소일·재원일수만 있다 — 「나갔다」는 알지만 「어디로」는 없다
 *   · hall_of_fame  = 자유서술 업적 — 사람은 읽지만 집계는 못 읽는다
 *   · 면접기록_응답  = 결과가 있는데 익명이라 사람과 안 이어졌다(→ 학생ID 칸이 그래서 생겼다)
 *
 * 🔴 이것이 소급 불가인 이유: 학생이 떠난 뒤엔 연락이 끊긴다. **지금 자리를 안 만들면
 *   **2028-02 1기 졸업생**의 결과는 영영 못 받는다.** 코드를 나중에 짜도 데이터는 안 돌아온다.
 *   🔴 날짜 정정 2026-08-25 (유호 「우리는 1년이 최대 기간」) — 이 줄은 「2027년 1기」였는데 근거가 없었다.
 *     정규 과정 = **12개월 6시즌**(커리큘럼 로드맵 정본)이고 개원이 2027-02 이므로 첫 기수 졸업은 **2028-02** 다.
 *     ⚠ 1년 과정의 파생 성질: 기수가 **해마다 한 번, 한 시점에 통째로** 나간다 — 3년 과정처럼 이탈이 흩어지지
 *     않는다. 그 2월을 놓치면 그 해 결과가 통째로 빈다(선배 모드가 노리는 자리가 바로 그 순간이다).
 *
 * ── 두 축을 직교로 나눈 것이 이 설계의 요점이다 ──────────────────────────
 *   결과종류 = **어느 길로 갔나**(유학·취업·창업…)   단계 = **그 길에서 어디까지 갔나**(지원·합격·입국)
 *   섞으면(「비자 거절」을 결과종류에 넣으면) 「거절당한 사람이 목표하던 길」이 통째로 사라진다.
 *   거절은 결과가 아니라 **어느 길 위의 한 단계**다 — 재도전이 정상이기 때문이다.
 *
 * ── 시트 2장 ──────────────────────────────────────────────────────────────
 *   outcome_log = 관측 「사건」 원장(append-only, 1인 N행). 자동 수확 + 원장 수기(드롭다운 검증).
 *   trajectory  = 파생 조인표(1인 1행, 매번 재작성). 의도 4칸 × 최신 결과 × 대조 판정.
 *   trajectory는 **파생**이다 — 손으로 고치면 다음 아침에 덮인다. 고칠 곳은 언제나 outcome_log다.
 *
 * ⛔ Glide 바인딩 금지 — 두 시트 다 어느 화면에도 올리지 않는다. 학생 본인의 진로 목표는
 *   profiles EA131~ED134에 이미 있고(본인 것이라 본인이 봐도 된다), 여기엔 **남의 결과까지**
 *   모여 있다. 핵심비전(BA53)·⚠상담위험(AZ52)과 같은 계급으로 취급한다.
 * ═══════════════════════════════════════════════════════════════════════════ */

const OUTCOME_TAB_ = 'outcome_log';
const TRAJECTORY_TAB_ = 'trajectory';

const OUTCOME_HEADERS_ = ['student_id', '이름', '관측일', '단계', '결과종류', '기관·회사명',
  '비자종류', '출처', '활용동의', '비고', '근거키', 'created_at'];

/* 근거키 = 멱등의 전부다. 같은 응답을 두 번 수확하면 한 사람이 두 번 합격한 것처럼 집계된다.
 * 값 규약 = '출처:학생ID:원천식별자' — 원천이 늘어도 앞머리로 구분된다.
 *
 * 🔴 이 자리는 **손으로 숫자를 적었다가 한 칸 틀렸다**(적대 리뷰가 스텁 시트로 재현: 같은 응답이
 *   매일 아침 다시 적재돼 3일이면 3배). 조회가 근거키 대신 created_at 을 읽었는데 **에러가 안 난다** —
 *   존재하는 열이라 getRange 가 안 던지고, 로그는 매일 「신규 관측 N건」을 정상처럼 보고했다.
 *   그래서 숫자를 없앤다: 정본 배열에서 파생시키면 두 곳이 갈라질 수 없다. */
const OUTCOME_KEY_COL_ = OUTCOME_HEADERS_.indexOf('근거키'); // 0-based

const TRAJECTORY_HEADERS_ = ['student_id', '이름', '반', '처리상태',
  '졸업후진로', '희망진학과정', '목표비자', '관심전공', 'TOPIK목표',
  '최종단계', '결과종류', '기관·회사명', '실비자', '관측일', '출처', '의도↔결과', '갱신일'];

/* 결과종류 — 「어느 길」. 원장 수기 드롭다운의 정본이기도 하다.
 * ⚠ 문구를 고치면 이미 기록된 행과 갈라진다. 늘리는 것은 안전하고, **고치는 것은 소급 마이그레이션**이다. */
const OUTCOME_KINDS_ = [
  '유학(D-2·D-4) 비자', '한국 대학·대학원 입학', '어학연수(D-4)',
  '한국 취업(E-9 비전문)', '한국 취업(E-7 전문직)', '한국 취업(기타)',
  '한국 창업·무역(D-8·D-9)', '결혼이민(F-6)', '방문·기타 비자',
  '제3국 유학·취업', '몽골 내 진학·취업', '중도 포기·연기', '기타·미상'
];

/* 단계 — 「어디까지」. 시간순이 아니라 상태다(거절 뒤 재지원이 정상이라 되돌아갈 수 있다). */
const OUTCOME_STAGES_ = ['지원·접수', '합격·승인', '불합격·거절', '보류·추가서류', '대기중', '출국·입국', '정착 확인'];

/* 출처 — **확인된 것과 들은 것을 갈라 두는 칸**이다. 이 칸이 없으면 소문이 통계가 된다. */
const OUTCOME_SOURCES_ = ['면접폼(자동)', '본인 제보', '보호자 제보', '강사 확인', '학원 서류 확인', 'SNS·소문(미확인)'];

const OUTCOME_VISAS_ = ['D-2 유학', 'D-4 어학연수', 'E-9 비전문취업', 'E-7 전문직', 'D-10 구직',
  'D-8·D-9 창업무역', 'F-2 거주', 'F-5 영주', 'F-6 결혼이민', 'H-2 방문취업', 'C-3 단기방문', '기타', '해당없음'];

/* [v9.184] 활용동의 — **면접폼 문구와 글자까지 같아야 한다.** 자동 수확은 폼 답을 그대로 실어 오는데
 * (`자료활용동의` 필수 2지선다), 원장 수기 칸만 자유 입력이라 「예」·「ㅇㅇ」·「동의함」이 섞이던 자리였다.
 * 이 칸의 유일한 소비처는 **내보낼 때의 거름망**이라, 어휘가 갈라지면 동의한 사람이 조용히 빠진다
 * (거름망은 못 읽은 값을 「동의 아님」으로 떨어뜨린다 — 안전한 방향으로 틀리지만 그래도 틀린다).
 * ⚠ 빈칸은 목록에 넣지 않는다 — 「미확인」과 「아니요」는 다른 상태고, 빈칸이 이미 미확인이다. */
const OUTCOME_CONSENTS_ = ['네, 동의합니다', '아니요, 원하지 않습니다'];

/* 결과종류 → 경로 버킷. 대조는 **버킷끼리** 한다 — 「학사를 목표했는데 석사로 갔다」를 불일치로
 * 세면 판정이 소음이 된다. 우리가 알고 싶은 것은 「유학을 목표했는데 취업으로 갔다」다.
 * ⚠ 자동 수확은 면접 종류밖에 모른다(어학이냐 학위냐를 구별할 정보가 폼에 없다) — 그래서
 *   버킷을 굵게 잡는 것이 정확도를 포기한 게 아니라 **모르는 것을 안다고 하지 않는 것**이다. */
const OUTCOME_PATH_ = {
  '유학(D-2·D-4) 비자': '유학', '한국 대학·대학원 입학': '유학', '어학연수(D-4)': '유학',
  '한국 취업(E-9 비전문)': '취업', '한국 취업(E-7 전문직)': '취업', '한국 취업(기타)': '취업',
  '한국 창업·무역(D-8·D-9)': '창업', '결혼이민(F-6)': '정착', '방문·기타 비자': '기타',
  '제3국 유학·취업': '제3국', '몽골 내 진학·취업': '몽골', '중도 포기·연기': '중단', '기타·미상': '기타'
};

/* 면접 종류 → 결과종류. 면접폼 INTERVIEW_KINDS(엔진_폼리포트.js)와 짝이다.
 * ⚠ 그쪽 선택지를 늘리면 여기 없는 값이 들어와 '기타·미상'으로 떨어진다 — 조용히 틀리지는
 *   않지만 조용히 뭉개진다. 회귀(tests/궤적.test.js)가 두 목록의 정합을 검사한다. */
const INTERVIEW_TO_KIND_ = {
  '한국 유학 비자 인터뷰': '유학(D-2·D-4) 비자',
  'EPS 취업(E-9) 면접·시험': '한국 취업(E-9 비전문)',
  '한국 기업 취업 면접': '한국 취업(기타)',
  '한국 대학·대학원 입학 면접': '한국 대학·대학원 입학',
  '한국 방문·기타 비자 인터뷰': '방문·기타 비자',
  '기타': '기타·미상'
};

/* 면접폼 「결과」 → 단계. 폼의 4지선다와 짝이다. */
const INTERVIEW_TO_STAGE_ = {
  '합격·승인': '합격·승인',
  '불합격·거절': '불합격·거절',
  '추가 서류 요청·보류': '보류·추가서류',
  '아직 기다리는 중': '대기중'
};

/* ── 진입점 — syncProfiles 말미에서 매일 아침 1회 ──────────────────────────
 * @param src 상담데이터입력 시트(이미 열려 있는 것을 그대로 받는다 — openById 중복 회피).
 *
 * 자체 try로 격리한다: 궤적이 실패해도 로스터 동기화는 이미 끝나 있고, 그걸 되돌릴 이유가 없다.
 * 실패를 삼키되 **조용히는 아니게** — 상태가 바뀔 때만 1회 알린다(매일 같은 메일은 곧 안 읽힌다). */
function 궤적갱신_(src) {
  const ss = SpreadsheetApp.getActiveSpreadsheet(); // try 밖 — 여기서 던지면 경보조차 못 보낸다
  try {
    /* 🔑 **자리를 먼저 만든다.** 수확 안에서 만들면 면접 응답이 0건일 때(=개원 전 지금) 조기 반환에
     *   걸려 시트가 영영 안 생긴다 — 그런데 이 시트의 절반은 **원장이 손으로 적는 것**이다.
     *   적을 자리가 없으면 유호님이 탭을 손으로 만들게 되고, 그 순간 헤더 문구·드롭다운 13종/7종이
     *   정본과 갈라진다. 어휘가 갈라지면 집계는 영원히 불가능하다(나중 정규화는 소급이 안 된다). */
    궤적_관측일서식_(궤적_결과시트_(ss), ss.getSpreadsheetTimeZone());
    const 수확 = 궤적수확_면접_(ss);
    const 커버 = 궤적재작성_(ss, src);
    Logger.log('궤적 갱신 — 신규 관측 ' + 수확 + '건 · 결과 확인 ' + 커버.known + '/' + 커버.total + '명');
    궤적경보_(ss, '');
  } catch (e) {
    Logger.log('궤적 갱신 실패: ' + e);
    궤적경보_(ss, String(e).slice(0, 200));
  }
}

/* 상태 변화 시 1회 알림 — 같은 실패가 매일 오면 그 메일은 읽히지 않는다(F072: 큐에 노이즈 금지). */
function 궤적경보_(ss, sig) {
  try {
    const st = ensureSheet(ss, 'app_state', ['key', 'value']);
    if (String(getState(st, '궤적실패').val || '') === sig) return;
    if (sig) {
      adminMail('[SYNK] ⚠️ 궤적 갱신 실패', '의도↔결과 레일(outcome_log·trajectory) 갱신이 실패했습니다: ' + sig +
        '\n로스터 동기화 자체는 정상입니다. 같은 상태면 다시 알리지 않습니다.');
    }
    setState(st, '궤적실패', sig);
  } catch (e) { /* 알림 실패로 배치를 죽이지 않는다 */ }
}

/* ── outcome_log 준비 — 헤더 + 드롭다운 검증 ────────────────────────────────
 * 왜 드롭다운인가: 이 시트의 절반은 **원장이 손으로 적는다**(졸업생 소식은 사람에게서 온다).
 *   자유 입력이면 「E-9」·「E9 취업」·「이피나인」이 섞이고, 그 순간 집계는 영원히 불가능해진다.
 *   2년 뒤 모델 학습에 쓸 값이므로 어휘를 **입력 시점에** 못 박는다 — 나중 정규화는 소급이 안 된다.
 * 검증 재적용은 판이 바뀔 때만 — 매일 500행에 setDataValidation을 걸면 그냥 낭비다. */
const OUTCOME_VALIDATION_VER_ = 'v2'; // [v9.184] 활용동의(9열) 편입 — 판이 바뀌었으니 다음 실행에서 1회 재적용된다
function 궤적_결과시트_(ss) {
  const sh = ensureSheet(ss, OUTCOME_TAB_, OUTCOME_HEADERS_);
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  if (String(getState(st, '궤적검증판').val || '') === OUTCOME_VALIDATION_VER_) return sh;
  const rows = 500; // 선반영 구간 — 원장이 그 아래에 적으면 검증이 없지만, 그건 500명 졸업 뒤의 이야기다
  if (sh.getMaxRows() < rows + 1) sh.insertRowsAfter(sh.getMaxRows(), rows + 1 - sh.getMaxRows());
  [[4, OUTCOME_STAGES_], [5, OUTCOME_KINDS_], [7, OUTCOME_VISAS_], [8, OUTCOME_SOURCES_],
    [9, OUTCOME_CONSENTS_]].forEach(function (p) {
    /* setAllowInvalid(true) = 경고만. false(거부)로 하면 **자동 수확이 막힌다** — 면접폼 선택지가
     * 늘어난 날 목록에 없는 값이 들어오면 배치가 통째로 예외로 죽는다. 사람에겐 경고가 보이고
     * 기계는 계속 도는 쪽을 고른다(가드가 데이터 유입 자체를 끊으면 안 된다). */
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(p[1], true).setAllowInvalid(true).build();
    sh.getRange(2, p[0], rows, 1).setDataValidation(rule);
  });
  sh.getRange(1, 1, 1, OUTCOME_HEADERS_.length).setFontWeight('bold');
  setState(st, '궤적검증판', OUTCOME_VALIDATION_VER_);
  return sh;
}

/* 🔴 관측일 열 서식 고정 — **이 저장소의 월키 Date 오염 5번째 자리다.**
 * 관측일은 'yyyy-MM' 문자열인데, 서식이 자동인 열에 쓰면 시트가 그걸 **Date 로 재파싱한다**
 * (08-02 라이브 실측: 운영 탭에 `Wed Jul 01 2026` 가 그대로 남아 있었다).
 * 그러면 다음 실행의 getValues 는 Date 를 돌려주고, 궤적_최신관측_ 의 문자열 비교가
 * **시간순이 아니라 요일·영문월 알파벳순**이 된다 — 옛 관측이 최신을 이기고, 「좌절」이어야 할
 * 사람이 「일치」로 찍힌다. 화면에 오류는 안 뜬다.
 * ⚠ outcome_log 는 sheetSkeleton_ 에 없어 healTextKeyCols_ 의 자기치유가 **안 닿는다**(헤더도
 *   '관측일'이라 TEXT_KEY_HEADS_ 에 안 걸린다). 그래서 여기서 직접 기존 통로를 태운다 —
 *   ymTextColFix_ 는 읽기→'@'→쓰기 순서가 보장돼 있고 **이미 오염된 행도 되돌린다**.
 * 왜 매 실행 거는가: 검증판 상태로 스킵하면 원장이 열을 손으로 지우고 다시 만든 날 서식이 사라진다.
 *   비용은 서식 조회 1회 + (오염 0이면) 쓰기 0이다. */
function 궤적_관측일서식_(sh, tz) {
  try {
    if (typeof ymTextColFix_ === 'function') ymTextColFix_(sh, 3, tz); // 3열 = 관측일
  } catch (e) { Logger.log('궤적 관측일 서식 고정 스킵: ' + e); }
}

/* ── 자동 수확 ① 면접기록_응답 → outcome_log ───────────────────────────────
 * 🔑 **헤더 이름으로 읽는다.** 위치로 읽으면 안 된다 — migrateInterviewSid가 라이브 폼에 문항을
 *   끼워 넣으면 응답 시트에 열이 하나 붙고, 위치 파싱은 그날 조용히 어긋난다(결석 폼의 경고와 같다).
 * 🔑 활용동의는 **거르지 않고 실어 나른다.** 학원이 자기 학생의 진로를 기록하는 것은 운영이고,
 *   「AI 학습에 써도 되는가」는 그 다음 질문이다. 여기서 걸러 버리면 동의 안 한 사람의 결과가
 *   운영 통계에서까지 사라져 커버리지가 거짓이 된다 — 대신 칸에 담아 **내보낼 때** 거른다.
 * @return 새로 적재한 행 수
 */
function 궤적수확_면접_(ss) {
  const shIv = ss.getSheetByName('면접기록_응답');
  if (!shIv || shIv.getLastRow() < 2) return 0;

  const w = shIv.getLastColumn();
  const hdr = shIv.getRange(1, 1, 1, w).getValues()[0].map(function (h) { return String(h || '').trim(); });
  const col = {};
  hdr.forEach(function (h, i) { if (h && col[h] === undefined) col[h] = i; }); // 중복 헤더는 첫 열 우선(cv와 같은 규칙)
  const cSid = col['학생ID'];
  if (cSid === undefined) return 0; // 아직 migrateInterviewSid 전 — 조인 키가 없으니 수확할 것도 없다

  const sh = 궤적_결과시트_(ss);
  const 있음 = {};
  if (sh.getLastRow() >= 2) {
    sh.getRange(2, OUTCOME_KEY_COL_ + 1, sh.getLastRow() - 1, 1).getValues()
      .forEach(function (r) { if (r[0]) 있음[String(r[0])] = 1; });
  }

  const tz = ss.getSpreadsheetTimeZone();
  const rows = shIv.getRange(2, 1, shIv.getLastRow() - 1, w).getValues();
  const 신규 = [];
  const now = new Date();
  rows.forEach(function (r) {
    const sid = String(r[cSid] == null ? '' : r[cSid]).trim();
    if (!sid) return;                                   // 익명 응답 — 질문 은행에는 그대로 기여한다(설계)
    const ts = r[0];                                    // 폼 연결 시트의 1열은 언제나 타임스탬프
    const 원천 = ts instanceof Date ? ts.toISOString() : String(ts || '');
    const key = '면접폼:' + sid + ':' + 원천;
    if (!원천 || 있음[key]) return;
    있음[key] = 1;                                      // 같은 배치 안 중복도 막는다

    const kind = INTERVIEW_TO_KIND_[String(r[col['면접 종류']] || '').trim()] || '기타·미상';
    const stage = INTERVIEW_TO_STAGE_[String(r[col['결과']] || '').trim()] || '대기중';
    신규.push([sid, String(r[col['이름']] || '').trim(), 궤적_관측일_(r[col['시기']], ts, tz),
      stage, kind, String(r[col['장소·기관']] || '').trim(), '',
      '면접폼(자동)', String(r[col['자료활용동의']] || '').trim(), '', key, now]);
  });

  if (!신규.length) return 0;
  const at = sh.getLastRow() + 1;
  if (sh.getMaxRows() < at + 신규.length - 1) sh.insertRowsAfter(sh.getMaxRows(), at + 신규.length - 1 - sh.getMaxRows());
  // writeIfChanged = 소독 채널. 이름·기관명은 폼에 사람이 적은 글이라 '=' 로 시작하면 라이브 수식이 된다
  writeIfChanged(sh, at, 1, 신규);
  return 신규.length;
}

/* 관측일 — 면접 「시기」(예: 2026-05)가 있으면 그것이 사실에 가깝다. 없으면 제출 시각으로 떨어진다.
 * ⚠ 폼의 자유 입력이라 「2026년 5월」·「2026.5」·「05/2026」이 다 온다 — 연·월만 뽑는다. */
function 궤적_관측일_(시기, ts, tz) {
  const m = String(시기 == null ? '' : 시기).match(/(20\d{2})\s*[.\-\/년]?\s*(\d{1,2})/);
  if (m) {
    const mo = Number(m[2]);
    if (mo >= 1 && mo <= 12) return m[1] + '-' + ('0' + mo).slice(-2);
  }
  return ts instanceof Date ? Utilities.formatDate(ts, tz, 'yyyy-MM') : '';
}

/* ── trajectory 재작성 — 의도 × 최신 결과 × 대조 ───────────────────────────
 * 상담시트에서 읽는 이유: profiles는 **퇴소자를 지운다**(v9.34 행 정합 불변식). 궤적이 필요한
 *   바로 그 사람들이 거기엔 없다. 상담시트는 나간 사람도 남아 있는 유일한 원장이다.
 * @return {total, known} 커버리지
 */
function 궤적재작성_(ss, src) {
  if (!src) return { total: 0, known: 0 };
  const lastRow = src.getLastRow();
  if (lastRow < 3) return { total: 0, known: 0 };
  const lastC = Math.max(62, src.getLastColumn());
  const hdr = src.getRange(2, 1, 1, lastC).getValues()[0];
  const col = {};
  hdr.forEach(function (h, i) { const k = String(h || '').trim(); if (k && col[k] === undefined) col[k] = i; });
  const g = function (row, name) { const i = col[name]; return i === undefined ? '' : String(row[i] == null ? '' : row[i]).trim(); };

  const tz = ss.getSpreadsheetTimeZone();
  const 최신 = 궤적_최신관측_(ss, tz);
  const data = src.getRange(3, 1, lastRow - 2, lastC).getValues();
  const 갱신일 = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const out = [];
  let known = 0;
  data.forEach(function (row) {
    const sid = String(row[59] == null ? '' : row[59]).trim(); // BH 학생ID — 없으면 아직 사람이 아니라 접수다
    if (!sid || !row[0]) return;
    const 진로 = g(row, '졸업후진로'), 과정 = g(row, '희망진학과정');
    const 비자 = g(row, '졸업후목표비자'), 전공 = g(row, '관심전공분야');
    const o = 최신[sid];
    if (o) known++;
    out.push([sid, String(row[0]).trim(), String(row[3] || '').trim(), g(row, '처리상태'),
      진로, 과정, 비자, 전공, g(row, 'TOPIK목표'),
      o ? o.stage : '', o ? o.kind : '', o ? o.org : '', o ? o.visa : '', o ? o.when : '', o ? o.source : '',
      궤적_대조_(진로, 과정, 비자, o), 갱신일]);
  });

  const sh = ensureSheet(ss, TRAJECTORY_TAB_, TRAJECTORY_HEADERS_);
  if (sh.getMaxRows() < out.length + 1) sh.insertRowsAfter(sh.getMaxRows(), out.length + 1 - sh.getMaxRows());
  /* 🔴 날짜꼴 두 열도 텍스트로 굳힌다 — outcome_log 와 같은 이유(월키 Date 오염 5번째).
   * 여기선 부작용이 하나 더 있다: 셀이 Date 로 굳으면 writeIfChanged 의 JSON 비교가 매번 「다름」이
   * 되어 [v9.25] 무변경 skip 이 죽고 **매일 아침 전 행을 다시 쓴다**(조용한 쿼터 낭비). */
  [14, 17].forEach(function (c) { // 14=관측일(yyyy-MM) · 17=갱신일(yyyy-MM-dd)
    if (sh.getRange(1, c).getNumberFormat() !== '@') sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@');
  });
  if (out.length) writeIfChanged(sh, 2, 1, out);
  const tail = sh.getLastRow() - 1 - out.length; // 상담시트에서 사라진 사람의 옛 줄
  if (tail > 0) sh.getRange(out.length + 2, 1, tail, TRAJECTORY_HEADERS_.length).clearContent();

  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  setState(st, '궤적커버리지', known + '/' + out.length + ' (' + 갱신일 + ')');
  return { total: out.length, known: known };
}

/* 학생별 최신 관측 1건. 최신 = 관측일 우선, 같으면 **뒤 행**(나중에 적은 것이 최신이다).
 * ⚠ 「최신만 본다」는 정보를 버리는 선택이다 — 전 이력은 outcome_log에 그대로 남는다.
 *   trajectory는 「지금 이 사람은 어디에 있나」 한 줄이고, 이력을 여기 늘어놓으면 못 읽는 표가 된다. */
function 궤적_최신관측_(ss, tz) {
  const sh = ss.getSheetByName(OUTCOME_TAB_);
  const map = {};
  if (!sh || sh.getLastRow() < 2) return map;
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, OUTCOME_HEADERS_.length).getValues();
  vals.forEach(function (r) {
    const sid = String(r[0] == null ? '' : r[0]).trim();
    if (!sid) return;
    /* 🔴 되읽기도 방어한다 — 쓰기 쪽 서식('@')만으로는 **이미 오염된 셀**과 사람이 손으로 적은
     *   날짜 셀이 안 걸린다. ymTextOf_ 는 Date·시리얼·String(Date) 세 형태를 전부 'yyyy-MM'으로
     *   되돌리고 문자열은 그대로 둔다(재파싱 금지 — tz 경계에서 전달로 밀린다). */
    const when = (typeof ymTextOf_ === 'function' ? ymTextOf_(r[2], tz) : String(r[2] == null ? '' : r[2])).trim();
    const prev = map[sid];
    if (prev && String(prev.when) > when) return; // 문자열 비교로 충분하다 — 전부 yyyy-MM 규격
    map[sid] = { when: when, stage: String(r[3] || ''), kind: String(r[4] || ''),
      org: String(r[5] || ''), visa: String(r[6] || ''), source: String(r[7] || '') };
  });
  return map;
}

/* 의도 버킷 — **가까운 목표부터** 본다. 「10년 후 한국 정착」과 「내년 학사 진학」이 같이 있으면
 * 우리가 관측하는 결과는 후자 쪽이다. 순서를 뒤집으면 진학한 사람이 전부 「불일치」로 찍힌다. */
/* 🔴 「미정」은 값이 아니라 **상태**다. 있는 것처럼 세면 없는 의도로 판정이 나간다.
 * 진로 5문항을 필수로 만들면서 세 문항에 「아직 미정」을 새로 만들었는데(그 자체는 옳다 —
 * 탈출구 없는 필수는 아무거나 찍게 만든다), 그 값을 여기서 안 걸러 **정직하게 미정을 고른 학생이
 * 가짜 불일치로 찍히던** 자리다. 「모른다를 일치로 세지 않는다」의 반대 방향 위반.
 * 판정은 Code.js 의 미정값_ 하나뿐이다 — 여정 카드·핵심비전도 같은 통로를 쓴다(두 곳에 적으면 갈라진다).
 *
 * 희망진학과정 → 버킷. **값을 본다**(존재가 아니라).
 * 원천이 둘이라 어휘가 다르다: 크루카드(어학연수 (D-4)·학사·편입·석사·박사·아직 미정) ·
 * 구글 상담폼(어학연수·전문대·학사·편입·석사·박사·**취업비자준비**). 후자를 유학으로 세면
 * EPS 취업자가 전원 「불일치」로 찍힌다.
 * ⚠ 모르는 값은 유학이 아니라 **''(미정)**으로 떨어뜨린다 — 선택지가 늘어난 날 조용히 틀리는 대신
 *   판정을 보류하는 쪽이 안전하다(부푼 커버리지보다 빈 커버리지가 정직하다). */
function 궤적_과정버킷_(과정) {
  const v = String(과정 == null ? '' : 과정).trim();
  if (미정값_(v)) return '';
  if (/취업|비자준비/.test(v)) return '취업';
  if (/어학연수|전문대|학사|편입|석사|박사|대학|유학/.test(v)) return '유학';
  return '';
}

function 궤적_의도버킷_(진로, 과정, 비자) {
  const p = 궤적_과정버킷_(과정);
  if (p) return p;
  /* 🔑 **경로를 말하는 답만 버킷이 된다.** 대조는 「어느 길로 갔나」끼리만 뜻이 있는데,
   *   같은 문항 안에도 경로가 아닌 답이 섞여 있다:
   *     · F-2 거주·F-5 영주 = 그 길의 **끝**이지 길이 아니다(대개 D-2·E-7을 거쳐 도달한다)
   *     · 「한국 정착」(10년 후 무대) = **목적지**다. 유학으로도 취업으로도 갈 수 있다.
   *   이것들을 '정착' 버킷으로 세면, E-9 취업에 성공한 사람이 「불일치(정착→취업)」로 찍힌다 —
   *   목표를 향해 한 걸음 간 사람을 이탈로 세는 것이다. 회귀가 실제로 그 판정을 냈다.
   *   → 경로를 말하지 않는 답은 ''(의도 미정)으로 둔다. **판정 수가 줄어도 남는 판정이 정직하다.**
   *   반면 「몽골 복귀」·「제3국 진출」은 한국행 경로를 **배제**하므로 그 자체로 경로다. */
  const v = String(비자 || '');
  if (/E-9|E-7|D-10/.test(v)) return '취업';
  if (/D-8|D-9/.test(v)) return '창업';
  if (/몽골/.test(진로)) return '몽골';
  if (/제3국/.test(진로)) return '제3국';
  return '';
}

/* 대조 판정 — 이 한 칸이 로드맵 ④의 학습 신호다.
 * 🔑 「모른다」를 「일치」로 세지 않는다. 미관측·의도 미정·진행중은 각자 이름을 갖는다 —
 *   뭉치는 순간 커버리지가 부풀고, 부푼 커버리지는 「데이터가 쌓이고 있다」는 착각이 된다. */
function 궤적_대조_(진로, 과정, 비자, o) {
  if (!o) return '미관측';
  if (o.stage === '지원·접수' || o.stage === '대기중' || o.stage === '보류·추가서류') return '진행중';
  if (o.stage === '불합격·거절') return '좌절(재도전 가능)';
  const 의도 = 궤적_의도버킷_(진로, 과정, 비자);
  if (!의도) return '의도 미정';
  const 결과 = OUTCOME_PATH_[o.kind] || '';
  if (!결과 || 결과 === '기타') return '분류 불가';
  return 의도 === 결과 ? '일치' : ('불일치(' + 의도 + '→' + 결과 + ')');
}
