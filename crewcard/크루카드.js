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
const DAILY_CAP = 300;          // 익명 엔드포인트 남용 방지 — 하루 접수 상한
const MAX_BODY = 100000;        // 100KB — 정상 제출은 ~10KB
const MAX_CELL = 2000;          // 서술형 1칸 상한(시트 오염 방지)

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
  'kc_style', 'crew_intro'
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
    const today = Utilities.formatDate(new Date(), 'Asia/Ulaanbaatar', 'yyyyMMdd');
    const capKey = 'cap:' + today;
    if (Number(props.getProperty(capKey) || 0) >= DAILY_CAP) {
      return 크루_응답_({ ok: false, error: 'daily-cap' });
    }

    // 채번+기록은 락 안에서 원자적으로 — 동시 제출 2건이 같은 번호를 받는 것을 막는다
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    let serial;
    try {
      const sh = 크루_탭_();
      serial = 'SL-' + today + '-' + ('00' + 크루_다음번호_(sh, today)).slice(-3);
      const row = COLUMNS.map(function (c) {
        if (c === 'submitted_at') return new Date();            // 시각은 서버가 정본(클라이언트 시계 불신)
        if (c === 'ref_serial') return serial;
        if (c === 'lang') return String(body.lang || '').slice(0, 8);
        const v = data[c];
        if (v === true) return 'TRUE';
        if (v === false || v == null) return '';                // multi 미선택은 빈칸 — TRUE만 의미를 갖는다
        return String(v).slice(0, MAX_CELL);
      });
      sh.appendRow(row);
      props.setProperty(capKey, String(Number(props.getProperty(capKey) || 0) + 1));
    } finally {
      lock.releaseLock();
    }
    return 크루_응답_({ ok: true, serial: serial });
  } catch (err) {
    return 크루_응답_({ ok: false, error: 'internal' });        // 내부 오류 내용은 밖으로 흘리지 않는다
  }
}

function 크루_탭_() {
  const ss = SpreadsheetApp.openById(CONSULT_SHEET_ID);
  let sh = ss.getSheetByName(CREW_TAB);
  if (!sh) sh = ss.insertSheet(CREW_TAB);
  if (sh.getLastRow() === 0) {
    if (sh.getMaxColumns() < COLUMNS.length) sh.insertColumnsAfter(sh.getMaxColumns(), COLUMNS.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]).setFontWeight('bold');
    sh.setFrozenRows(1);
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

function 크루_응답_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
