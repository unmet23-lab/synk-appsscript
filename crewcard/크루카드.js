/* ═══════════════════════════════════════════════════════════════════
 * SYNK LAB · 크루카드 전용 웹앱 (standalone Apps Script)
 * ───────────────────────────────────────────────────────────────────
 * 왜 메인 프로젝트와 분리하나:
 *   ① 메인 doPost는 상담AI(Meta 웹훅)가 점유 — 프로젝트당 doPost는 1개.
 *   ② 메인에서 HtmlService를 반환하면 google.script.run으로 밑줄 없는
 *      전역 함수 전부가 익명자에게 노출된다(상담AI.js doGet 머리말의 실측 171개).
 *      이 프로젝트의 노출 표면은 이 파일 하나 — doGet·doPost 외 전부 밑줄 종결.
 *
 * 경로:
 *   GET  /exec            → 카드_kr.html (한국어판)
 *   GET  /exec?lang=mn    → 카드_mn.html (몽골어판)
 *   POST /exec  {form:'crew_card', lang, hp, data:{컬럼:값}}
 *        → crew_cards 탭 1행 append + Serial(SL-YYYYMMDD-NNN) 채번 회신
 *
 * 대상 시트: CONSULT_SHEET_ID(외부 상담 스프레드시트 — Code.js:789와 동일 ID)
 * ═══════════════════════════════════════════════════════════════════ */

const CONSULT_SHEET_ID = '1Ze_8IHOzmtAV-PHt12cUfRn5_LwRZwt8pcWsnjQ19FY';
const CREW_TAB = 'crew_cards';
/* 날짜 기준 = 학원 소재지 하나. 스프레드시트 TZ(실측 America/Los_Angeles)를 쓰면
 * 채번(SL-YYYYMMDD)과 등록일이 하루 어긋난다 — 상담시트.js 이관부 주석 참조. */
const TZ_ = 'Asia/Ulaanbaatar';
/* ⛔ 공유 토큰 검사를 일부러 두지 않는다(08-04 인계 갭① 종결).
 *   이 폼은 공개 링크로 배포된다 — 토큰을 넣어도 페이지 소스에 그대로 노출돼 1분이면 베껴 쓴다(보안 연극).
 *   실방어 = 허니팟(hp) + DAILY_CAP + MAX_BODY/MAX_CELL + 락 채번 + doGet 무부작용.
 *   남용이 실제로 관측되면: DAILY_CAP 하향 → 새 배포로 /exec URL 교체(구 URL 즉시 무효)가 대응 절차다. */
const DAILY_CAP = 300;          // 익명 엔드포인트 남용 방지 — 하루 접수 상한
const MAX_BODY = 100000;        // 100KB — 정상 제출은 ~10KB
const MAX_CELL = 2000;          // 서술형 1칸 상한(시트 오염 방지)
const ERR_TAB = 'crew_errors';  // doPost 런타임 오류 착지 탭 — 알림은 메인 crewIntakeWatch_가 읽어서 낸다
const ERR_DAILY_CAP = 50;       // 오류 기록도 익명 입력이 낳는다 — 상한 없이는 오류 유발 반복 제출이 시트를 무한 증식시킨다

/* 컬럼 정본 — 카드 HTML 내장 스키마(6섹션 103필드+메타)에서 기계 생성.
 * multi 필드는 옵션별 TRUE 컬럼으로 전개(구글폼 자동 방식과 동일 규약). */
const COLUMNS = [
  'submitted_at', 'ref_serial', 'lang', 'advisor', 'class_name', 'reg_year_month',
  'consent_privacy', 'consent_media', 'name_mn', 'name_kr', 'birthdate', 'gender',
  'phone', 'sns', 'email', 'residence', 'edu_status', 'edu_level',
  'school', 'major', 'topik_level', 'korean_level', 'english_test_none', 'english_test_toeic',
  'english_test_ielts', 'english_test_toefl', 'english_test_other', 'english_level', 'occupation', 'living',
  'daily_hours', 'peak_focus', 'study_space', 'family_support', 'vision_topik_intensity', 'vision_university_intensity',
  'vision_career_intensity', 'vision_kculture_intensity', 'vision_native_intensity', 'why_korea_kpop_idol', 'why_korea_kdrama', 'why_korea_education',
  'why_korea_career', 'why_korea_proximity', 'why_korea_relatives', 'why_korea_safety', 'why_korea_it', 'why_korea_beauty_fashion',
  'why_korea_healthcare', 'why_korea_food', 'why_korea_immigration', 'why_now_story', 'worry_language', 'worry_loneliness',
  'worry_culture', 'worry_finance', 'worry_visa', 'worry_discrimination', 'worry_family', 'worry_academic',
  'worry_health', 'worry_career', 'future_10y', 'topik_target', 'success_definition', 'visited_korea',
  'recent_visit', 'total_stay', 'korea_tie', 'visa_history_c3', 'visa_history_d4', 'visa_history_d2',
  'visa_history_h2', 'visa_history_f1_f4', 'visa_history_none', 'visa_target_d10', 'visa_target_e7', 'visa_target_e9',
  'visa_target_d8_d9', 'visa_target_f2', 'visa_target_f5', 'visa_target_undecided', 'visa_denied', 'visa_denied_reason',
  'exposure_drama_intensity', 'exposure_kpop_intensity', 'exposure_shortform_intensity', 'exposure_real_speaker_intensity', 'exposure_study_mat_intensity', 'fav_artist',
  'fav_drama', 'fav_place', 'local_activity_sejong', 'local_activity_topik_class', 'local_activity_kr_parttime', 'local_activity_kpop_fanclub',
  'local_activity_none', 'prior_study', 'region_wish_seoul', 'region_wish_gyeonggi', 'region_wish_chungcheong', 'region_wish_yeongnam',
  'region_wish_honam', 'region_wish_gangwon_jeju', 'region_wish_any', 'school_1st', 'school_1st_reason', 'school_2nd',
  'school_2nd_reason', 'school_3rd', 'school_3rd_reason', 'degree_target', 'field_interest_business', 'field_interest_it',
  'field_interest_design', 'field_interest_medical', 'field_interest_engineering', 'field_interest_humanities', 'field_interest_media', 'tl_synk_register',
  'tl_topik_target', 'tl_apply', 'tl_enroll', 'finance_budget', 'finance_sponsor', 'finance_guardian',
  'finance_guardian_phone', 'scholarship', 'parttime', 'trait_extroversion', 'trait_planning', 'trait_social_study',
  'trait_visual_auditory', 'trait_theory_practice', 'trait_chronotype', 'learning_style_1on1', 'learning_style_small_group', 'learning_style_large_class',
  'learning_style_online', 'learning_style_immersion', 'learning_style_grammar', 'learning_style_conversation', 'quiz_q1', 'quiz_q2',
  'quiz_q3', 'quiz_q4', 'lang_listening_intensity', 'lang_speaking_intensity', 'lang_reading_intensity', 'lang_writing_intensity',
  'lang_hanja_intensity', 'values_stability', 'values_growth', 'values_family', 'values_global_career', 'values_startup',
  'values_social', 'values_kculture', 'values_wealth', 'values_expertise', 'values_community', 'kc_vocal_interest',
  'kc_vocal_style', 'kc_vocal_role', 'kc_vocal_stage', 'kc_dance_interest', 'kc_dance_genre', 'kc_dance_career',
  'kc_dance_goal', 'kc_beauty_interest', 'kc_beauty_part', 'kc_beauty_look', 'kc_beauty_career', 'kc_more_kdrama',
  'kc_more_kfood', 'kc_more_kfashion', 'kc_more_kvariety', 'kc_more_seoul_tour', 'kc_more_kpop_concert', 'kc_load',
  'kc_style', 'crew_intro',
  /* [2026-08-04] 마케팅 어트리뷰션 2칸. **반드시 맨 뒤에** 붙인다 — 중간에 끼우면
   * 라이브 crew_cards의 기존 열이 통째로 한 칸씩 밀린다(헤더는 이름으로 매칭하지 않는다).
   * source = leads·리드폼과 **같은 8버킷**(새 분류를 만들면 대시보드 「③ 추천 신규 비율」이 즉시 거짓말을 한다). */
  'source', 'referrer',
  /* [2026-08-04] 전공 관심 「아직 미정」. 이름은 field_interest_* 무리인데 **자리는 맨 뒤**다 —
   * 무리 옆에 끼워 넣으면 그 뒤 열 전부가 한 칸씩 밀린다(헤더는 이름으로 매칭하지 않는다).
   * 이 칸이 생긴 이유: 진로 5문항이 제출 필수가 됐는데 이 문항엔 정직한 「모르겠다」가 없었다.
   * 빠져나갈 곳 없는 필수는 답을 받는 게 아니라 **아무거나 찍게 만든다**. */
  'field_interest_undecided'
];

function doGet(e) {
  // 읽기 전용 서빙만 — GET에 부작용 금지(배포 보안 규칙 2)
  const lang = e && e.parameter && String(e.parameter.lang || '').toLowerCase() === 'mn' ? 'mn' : 'kr';
  return HtmlService.createHtmlOutputFromFile('카드_' + lang)
    .setTitle('SYNK LAB · Crew Card')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || '';
    if (!raw || raw.length > MAX_BODY) return 크루_응답_({ ok: false, error: 'bad-size' });
    let body;
    try { body = JSON.parse(raw); } catch (_) { return 크루_응답_({ ok: false, error: 'bad-json' }); }
    if (!body || body.form !== 'crew_card') return 크루_응답_({ ok: false, error: 'bad-form' });
    if (body.hp) return 크루_응답_({ ok: true, serial: 'SL-00000000-000' }); // 허니팟 — 봇에게는 성공처럼 보이게
    const data = (body.data && typeof body.data === 'object') ? body.data : null;
    if (!data || !Object.keys(data).length) return 크루_응답_({ ok: false, error: 'empty' });

    const props = PropertiesService.getScriptProperties();
    const today = Utilities.formatDate(new Date(), TZ_, 'yyyyMMdd');
    const capKey = 'cap:' + today;
    if (Number(props.getProperty(capKey) || 0) >= DAILY_CAP) {
      return 크루_응답_({ ok: false, error: 'daily-cap' });
    }

    // 채번+기록은 락 안에서 원자적으로 — 동시 제출 2건이 같은 번호를 받는 것을 막는다
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    let serial, 이관오류 = null, 이관결과 = null;
    try {
      const sh = 크루_탭_();
      serial = 'SL-' + today + '-' + ('00' + 크루_다음번호_(sh, today)).slice(-3);
      const row = COLUMNS.map(function (c) {
        if (c === 'submitted_at') return new Date();            // 시각은 서버가 정본(클라이언트 시계 불신)
        if (c === 'ref_serial') return serial;
        if (c === 'lang') return 셀안전_(String(body.lang || '').slice(0, 8));   // lang도 요청 본문 = 공격자 통제
        const v = data[c];
        if (v === true) return 'TRUE';
        if (v === false || v == null) return '';                // multi 미선택은 빈칸 — TRUE만 의미를 갖는다
        return 셀안전_(String(v).slice(0, MAX_CELL));            // ⚠ 소독 없이 쓰면 익명 POST가 라이브 수식이 된다(아래 함수 머리말)
      });
      sh.appendRow(row);
      props.setProperty(capKey, String(Number(props.getProperty(capKey) || 0) + 1));
      /* 상담데이터입력에도 1행(학생ID 비움 — 상담시트.js 머리말). 원본은 crew_cards가 정본이므로
       * 이관이 실패해도 접수 자체는 이미 성립했다 → 삼키고 로그만 남긴다(제출자에게 실패를 보이지 않는다). */
      try { 이관결과 = 상담시트_이관_(data, body.lang, serial); }
      catch (e2) {
        console.warn('[크루카드] 상담시트 이관 실패(접수는 정상): ' + e2);
        /* 기록은 **락 밖으로** 미룬다 — 기록 1회가 시트 왕복 2번(≈1초)이라 임계구역이 그만큼 길어지고,
         * 하필 이 경로는 이관이 계통적으로 깨진 날 매 제출마다 밟힌다. 그러면 뒤 제출들의
         * waitLock(20000)이 타임아웃 나고 그 타임아웃이 또 오류를 낳는 자기증폭 고리가 된다. */
        이관오류 = e2;
      }
    } finally {
      lock.releaseLock();
    }
    /* [2026-08-15] 🔑 이관의 실패 두 갈래는 **throw 가 아니라 return** 이다 —
     *   `상담시트_이관_`은 탭이 없으면 `{ok:false,error:'no-tab'}`, 증분 전이면 `not-migrated`를
     *   **돌려준다**(상담시트.js). 위 catch 는 원리상 그것을 못 잡는다. 반환값을 안 읽는 동안
     *   그 두 실패는 crew_errors 에 한 줄도 안 남았고, 유실 경보(crewIntakeWatch_ ·「이관 유실
     *   의심」창)는 「없어졌다」만 알고 **「왜」는 영영 몰랐다**. 08-15 실측으로 드러난 자리.
     * 🔑 예외와 **같은 통로**로 보낸다(stage 도 그대로) — 기록 자리가 둘로 갈라지면 또 한쪽만 낡는다.
     * 🔑 자리는 락 **밖**이다 — 위 catch 의 기록을 락 밖으로 미룬 이유(자기증폭 고리)가 여기에도 그대로 걸린다. */
    if (!이관오류 && !(이관결과 && 이관결과.ok === true)) {
      const 사유 = (이관결과 && 이관결과.error) ? String(이관결과.error) : '반환없음';
      console.warn('[크루카드] 상담시트 이관 거부(접수는 정상): ' + 사유);
      이관오류 = '거부: ' + 사유;   // 문자열도 그대로 받는다 — 크루_오류로그_는 `err.stack || err`
    }
    if (이관오류) 크루_오류로그_('이관:' + serial, 이관오류);      // 유실 경보(crewIntakeWatch_)가 원인까지 갖게 한다
    return 크루_응답_({ ok: true, serial: serial });
  } catch (err) {
    /* 이 catch가 삼키는 실패는 어디에도 안 보였다 — Apps Script 자동 실패 메일은 「트리거 실패」에만
     * 오고, 웹앱 doPost 오류는 호출자에게 'internal'로만 돌아간다. 접수는 라이브 파이프라인이라
     * 조용한 실패 = 지원자 유실. 그래서 시트에 적어 두면, 이미 감시되는 층(10분 트리거의
     * crewIntakeWatch_ — 트리거 실패는 자동 메일이 온다)이 미통보 건을 묶어 1통으로 알린다. */
    console.error('[크루카드] doPost 실패: ' + ((err && err.stack) || err));
    크루_오류로그_('doPost', err);
    return 크루_응답_({ ok: false, error: 'internal' });        // 내부 오류 내용은 밖으로 흘리지 않는다
  }
}

/* [2026-08-04] 열 폭·헤더 맞추기를 **매번** 한다(멱등).
 * 전에는 `getLastRow() === 0`일 때만 만들었다 — 탭이 처음 생기는 순간에만. 그래서 COLUMNS가
 * 늘어난 날 라이브 탭은 **옛 폭 그대로**고, appendRow가 폭을 넘겨 접수가 통째로 실패한다.
 * 하필 그 실패는 제출자에게 `{ok:false, error:'internal'}`로만 보이고(원인은 밖으로 안 흘린다),
 * 상담시트 이관은 try로 감싸 삼키는데 **이건 그 바깥이라 접수 자체가 사라진다.**
 * 즉 「열 2개 추가」라는 작은 변경이 접수 창구를 조용히 닫을 수 있었다.
 * 🔑 헤더는 **늘어난 꼬리만** 채운다 — 기존 이름은 사람이 고쳤을 수 있어 덮지 않는다. */
function 크루_탭_() {
  const ss = SpreadsheetApp.openById(CONSULT_SHEET_ID);
  let sh = ss.getSheetByName(CREW_TAB);
  if (!sh) sh = ss.insertSheet(CREW_TAB);
  if (sh.getMaxColumns() < COLUMNS.length) {
    sh.insertColumnsAfter(sh.getMaxColumns(), COLUMNS.length - sh.getMaxColumns());
  }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else {
    const w = sh.getLastColumn();
    if (w < COLUMNS.length) {
      sh.getRange(1, w + 1, 1, COLUMNS.length - w).setValues([COLUMNS.slice(w)]).setFontWeight('bold');
    }
  }
  return sh;
}

/* 같은 날짜의 기존 Serial 최대값+1 — 반드시 락 안에서 호출.
 * 행 수가 아니라 Serial 실값을 읽는다: 중간 행 삭제가 있어도 번호가 역행·중복되지 않는다. */
function 크루_다음번호_(sh, today) {
  const last = sh.getLastRow();
  if (last < 2) return 1;
  const vals = sh.getRange(2, 2, last - 1, 1).getValues(); // B열 = ref_serial (COLUMNS[1])
  let max = 0;
  for (let i = 0; i < vals.length; i++) {
    const m = /^SL-(\d{8})-(\d{3})$/.exec(String(vals[i][0]));
    if (m && m[1] === today) max = Math.max(max, Number(m[2]));
  }
  return max + 1;
}

/* doPost 런타임 오류를 crew_errors 탭에 적는다 — 이 웹앱에서 「알리는」 유일하게 안전한 방법.
 *
 * ⛔ 여기서 메일을 쏘지 않는 이유는 접수 알림과 같다(무토큰 익명 POST = 메일 폭탄 벡터).
 *   기록만 하고, 알림은 읽는 쪽(메인 crewIntakeWatch_ · 10분 트리거 = 감시되는 층)이 낸다.
 * 🔒 이 함수는 절대 throw 하면 안 된다 — 오류 처리 중의 오류가 응답을 죽이면
 *   「기록하려다 접수 응답까지 잃는」 역전이 된다. 실패하면 console에만 남기고 삼킨다.
 * 🔒 detail은 공백류를 접고 자른다 — 예외 문자열엔 공격자 입력 조각이 섞일 수 있고,
 *   경보 메일의 본문 구조가 줄바꿈이라 개행이 살아 있으면 가짜 절을 만든다(이름 칸과 같은 계열).
 *   셀안전_도 지난다(오류 문자열로 수식 인젝션 우회 차단). */
function 크루_오류로그_(stage, err) {
  try {
    const props = PropertiesService.getScriptProperties();
    const key = 'errlog:' + Utilities.formatDate(new Date(), TZ_, 'yyyyMMdd');
    const n = Number(props.getProperty(key) || 0);
    if (n >= ERR_DAILY_CAP) return;   // 상한 뒤는 조용히 버린다(원본은 console에 남는다)
    const ss = SpreadsheetApp.openById(CONSULT_SHEET_ID);
    let sh = ss.getSheetByName(ERR_TAB);
    if (!sh) sh = ss.insertSheet(ERR_TAB);
    /* 헤더는 **매번** 확인한다(멱등) — 만드는 순간에만 쓰면, 사람이 1행을 지웠거나 탭을 손으로
     * 먼저 만들어 둔 경우 오류가 1행에 착지하고 읽는 쪽의 `getLastRow() >= 2` 가드에 걸려
     * **그 오류는 영원히 안 보인다**. 같은 파일 크루_탭_이 이미 배운 함정([v9.163])이다. */
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, 4).setValues([['at', 'stage', 'detail', '통보']]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    /* 마지막 한 칸은 「여기서 잘렸다」를 남기는 데 쓴다 — 조용한 절단은 이 장치가 없애려던 바로 그 형태다.
     * 접수가 계통적으로 깨진 날(열 변경 등) 상한 50에 닿으면 나머지 250건이 흔적 없이 사라져
     * 원장이 규모를 5분의 1로 과소평가한다(적대 리뷰 H4). */
    const 마지막 = (n === ERR_DAILY_CAP - 1);
    const detail = 마지막
      ? '오늘 오류 기록이 상한(' + ERR_DAILY_CAP + '건)에 닿아 이후는 생략합니다 — 실제 실패는 이보다 많습니다. 원문은 Apps Script 실행 로그에 있습니다.'
      : String((err && err.stack) || err).replace(/\s+/g, ' ').slice(0, 500);
    sh.appendRow([new Date(), 셀안전_(마지막 ? '상한도달' : String(stage).slice(0, 40)), 셀안전_(detail), '']);
    props.setProperty(key, String(n + 1));   // 기록이 성립한 뒤에만 상한을 소모
  } catch (e3) {
    console.error('[크루카드] 오류 기록 실패(원 오류는 위 로그에): ' + e3);
  }
}

/* 수식 인젝션 차단 — 시트에 문자열로 들어갈 값은 전부 이 통로를 지난다.
 *
 * 왜 이 파일에 사본을 두나: crewcard는 메인과 **별도 clasp 프로젝트**라 상담AI.js의 셀안전_를
 *   전역으로 못 쓴다. 규약(정규식·아포스트로피 접두)은 정본과 동일하게 유지한다 — 한쪽만 고치면 갈린다.
 *
 * 왜 필요한가(08-04 적대 리뷰가 특정한 실제 경로): 이 웹앱은 익명 POST를 토큰 없이 받고(의도),
 *   쓰는 곳이 **상담 스프레드시트와 같은 파일**(CONSULT_SHEET_ID = Code.js:789와 동일)이다.
 *   소독이 없으면 `crew_intro` 한 칸에 `=IMPORTDATA("https://…"&ENCODEURL(TEXTJOIN(…,'상담데이터입력'!H3:H200)))`
 *   를 넣는 것만으로 같은 파일의 상담 연락처가 외부로 나간다 — 사람이 클릭할 필요조차 없다.
 *   [v9.153] profiles 하드닝과 같은 계열이며, 여기가 공격 비용이 더 싸다(공개 폼·무인증). */
function 셀안전_(v) {
  const s = String(v == null ? '' : v);
  return /^[=+\-@\t\r]/.test(s) ? ("'" + s) : s;
}

function 크루_응답_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
