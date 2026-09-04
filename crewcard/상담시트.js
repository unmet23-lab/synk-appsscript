/* ═══════════════════════════════════════════════════════════════════
 * SYNK LAB · 크루카드 → 상담데이터입력 이관 + 상담시트 업그레이드
 * ───────────────────────────────────────────────────────────────────
 * 왜 상담시트에 옮기나: 운영은 「상담데이터입력」 한 장에서 돈다(반 배정·수강납입·앱 편입이 전부
 *   그 시트를 본다). 크루카드가 아무리 자세해도 crew_cards 탭에만 쌓이면 원장이 두 곳을 봐야 한다.
 *
 * 🔴 이관해도 **학생ID는 비운다.** 메인 엔진의 syncProfiles는 학생ID가 없는 행을 건너뛴다
 *   (엔진_운영배치.js: `const userId = row[59]; if (!userId) return;`).
 *   크루카드는 **토큰 없는 공개 링크**라 누구나 제출할 수 있는데, 그게 곧바로 앱 로스터가 되면
 *   장난 제출 한 번이 학생 계정이 된다. ID를 비워두면 상담시트엔 쌓이되 앱엔 안 들어가고,
 *   원장이 확인하고 ID를 채우는 순간 정식 편입된다 — 공개 접수와 로스터 사이의 유일한 안전 지점.
 *
 * 중복 이관 금지: 크루카드번호(ref_serial)를 조인 키로 쓰고, 같은 번호가 이미 있으면 건너뛴다.
 *
 * 📌 재제출 정책 [v9.168] — **crew_cards는 제출 1건 = 1행(append-only), 여기는 사람 1명 = 1행.**
 *   같은 사람이 다시 내도 새 행을 만들지 않는다. 행이 둘이면 원장이 둘 다 「반배정」으로 바꿀 수 있고,
 *   그 순간 학생ID가 두 번 나가 앱에서 한 사람이 학생 둘이 된다(profiles 키가 학생ID다 ·
 *   syncProfiles는 중복 id도 행 수를 보존하므로 로스터에 그대로 두 줄이 생긴다).
 *   덮는 조건은 **사람이 아직 손대지 않았을 때뿐**이다 — 공개 링크 접수가 사람의 결정(반·담당자·
 *   학생ID)을 덮으면 [v9.167]에서 세운 「사람이 게이트」가 뒤로 뚫린다.
 * ═══════════════════════════════════════════════════════════════════ */

const CONSULT_TAB = '상담데이터입력';
const CONSULT_HDR_ROW = 2;   // 헤더는 2행, 데이터는 3행부터(기존 규약)

/* 재제출이 덮을 수 있는 상태 = 아직 사람이 안 건드린 접수. 빈 상태도 여기에 넣는다
 * (증분 전 행·손으로 지운 행 — 어차피 원장 큐에 안 잡히는 행이라 최신 내용이 낫다). */
const 미착수상태_ = ['신규접수', '검토중', ''];

/* 재제출이 덮지 않는 4열 — 「언제·어디로 들어왔나」와 「사람이 어디까지 진행했나」.
 * 등록일이 재제출 날짜로 밀리면 접수→상담 리드타임 지표가 통째로 거짓이 된다.
 * [2026-08-04] '인지채널'(마케팅 유입경로) 추가 — 접수출처와 같은 계급이다.
 *   재제출로 덮이면 「페이스북 광고로 처음 알았다」가 「추천」으로 바뀌어 CPL·어트리뷰션이 밀린다.
 *   반면 '추천인'은 **불변열이 아니다** — 처음엔 몰랐다가 나중에 적어 주는 것이 정상이다. */
const 재제출_불변열_ = ['등록일', '접수출처', '처리상태', '인지채널'];

/* 크루카드에만 있던 항목 중 **관리에 실제로 쓰이는 것**만 증분한다.
 * 이미 상담시트에 있는 항목(K컬처 4종·유학예산·학비조달·가족지지·학습가능시간 등)은 옮기지 않는다
 * — 같은 값이 두 열에 살면 어느 쪽이 정본인지 아무도 모르게 된다. */
const 증분헤더_ = [
  '처리상태', '접수출처', '크루카드번호',          // 운영 흐름
  '개인정보동의', '초상권동의',                    // 법적 근거(시트엔 음성동의만 있었다)
  '집중시간대', '학습공간',                        // 반 배정·학습 설계
  '듣기자신감', '말하기자신감', '읽기자신감', '쓰기자신감',  // 레벨 배정(1~5)
  '졸업후목표비자', '장학금의향',                  // 비자·재정 로드맵
  '걱정요인', '인지진단',                          // 이탈 리스크 · 학습 설계
  // ── 2차 증분(08-04 유호 "관리에 필요한데 없는 건 다 넣어라") ──
  //    원칙은 1차와 같다: 원본 103문항은 crew_cards가 정본이고 여기엔 **읽고 판단하는 한 칸**만 만든다.
  //    체크박스 묶음·1~5 척도는 열을 쪼개지 않고 사람이 읽는 문장으로 접어 넣는다(열 폭발 방지).
  '담당자',                                        // 누가 접수했나 — 후속 상담 배정
  '거주형태', '아르바이트계획',                    // 시간표·수업 배치 제약
  '한국어학습이력', '몽골내한국활동',              // 레벨 배정 근거(세종학당·TOPIK반 경험)
  '한자자신감',                                    // 듣·말·읽·쓰 4종 옆의 5번째 축
  '목표강도', '관심전공분야', '진학타임라인',      // 목표 관리·진학 지도
  '한국체류총기간', '한국연고', '비자보유이력',    // 비자 실무
  '영어시험종류',                                  // 진학 요건
  '한국관심경로', '한국어노출경로',                // 동기 유지 상담·수업 소재 선택
  'K컬처참여강도', 'K컬처활동형태', 'K컬처세부',   // 특강 편성
  // ── 3차 증분(08-04 유호 "인지채널 수복 진행해줘") ──
  //    '인지채널'은 시트에 **이미 있는 열**이라 여기 없다(아래 매핑에서 되찾는다).
  //    '추천인'만 새 열이다 — leads E열 '추천인'과 같은 뜻·같은 이름으로 맞춘다.
  '추천인'
];

const 처리상태_ = ['신규접수', '검토중', '상담완료', '반배정', '앱편입', '보류', '취소'];

/* 반 키 정본 — docs/반편성_정본_v2.md §4(4실 24반 384석).
 * 키는 영원히 안 바뀌는 층이다(문패·표시명은 다른 층) — 상담시트 「반」에 들어가는 건 이 키다. */
function 반키정본_() {
  const out = [];
  ['11', '14', '15', '18'].forEach(function (t) { ['A', 'B', 'C', 'D'].forEach(function (r) { out.push('평일' + t + r); }); });
  ['11', '14'].forEach(function (t) { ['A', 'B', 'C', 'D'].forEach(function (r) { out.push('주말' + t + r); }); });
  return out;   // 24개
}

/* ── 헤더 이름 → 열 인덱스(0-base). 중복 헤더는 첫 열 우선(엔진_운영배치와 같은 규약) ── */
function 상담헤더맵_(sh) {
  const w = sh.getLastColumn();
  const hdr = sh.getRange(CONSULT_HDR_ROW, 1, 1, w).getValues()[0];
  const m = {};
  hdr.forEach(function (h, i) { const k = String(h || '').trim(); if (k && m[k] === undefined) m[k] = i; });
  return { map: m, width: w };
}

/* multi 컬럼(옵션별 TRUE) → 사람이 읽는 한 칸. 접두어가 같은 컬럼들을 훑어 TRUE인 것만 이어 붙인다. */
function 다중요약_(data, prefix, 라벨) {
  const on = [];
  Object.keys(라벨).forEach(function (col) {
    if (col.indexOf(prefix) === 0 && (data[col] === true || data[col] === 'TRUE')) on.push(라벨[col]);
  });
  return on.join(', ');
}

const 비자라벨_ = {
  visa_target_d10: 'D-10 구직', visa_target_e7: 'E-7 전문직', visa_target_e9: 'E-9 비전문',
  visa_target_d8_d9: 'D-8·D-9 창업무역', visa_target_f2: 'F-2 거주', visa_target_f5: 'F-5 영주',
  visa_target_undecided: '미정'
};
const 걱정라벨_ = {
  worry_language: '언어의 벽', worry_loneliness: '외로움', worry_culture: '문화충격', worry_finance: '학비·생활비',
  worry_visa: '비자거절', worry_discrimination: '차별', worry_family: '가족과 이별', worry_academic: '성적압박',
  worry_health: '건강·기후', worry_career: '진로 불확실'
};
const 지역라벨_ = {
  region_wish_seoul: '서울', region_wish_gyeonggi: '경기·인천', region_wish_chungcheong: '충청',
  region_wish_yeongnam: '영남', region_wish_honam: '호남', region_wish_gangwon_jeju: '강원·제주',
  region_wish_any: '상관없음'
};
const 가치라벨_ = {
  values_stability: '안정성', values_growth: '도전·성장', values_family: '가족', values_global_career: '글로벌 커리어',
  values_startup: '창업·자율', values_social: '사회기여', values_kculture: 'K컬처', values_wealth: '경제적 성공',
  values_expertise: '전문성', values_community: '커뮤니티'
};

const 왜한국라벨_ = {
  why_korea_kpop_idol: 'K-POP·아이돌', why_korea_kdrama: 'K-드라마', why_korea_education: '교육·명문대',
  why_korea_career: '취업 기회', why_korea_proximity: '가까운 거리', why_korea_relatives: '친척·지인',
  why_korea_safety: '치안', why_korea_it: 'IT·스마트시티', why_korea_beauty_fashion: 'K-뷰티·패션',
  why_korea_healthcare: '의료·복지', why_korea_food: '한식', why_korea_immigration: '비자·이민'
};
const 비자이력라벨_ = {
  visa_history_c3: 'C-3 단기방문', visa_history_d4: 'D-4 어학연수', visa_history_d2: 'D-2 유학',
  visa_history_h2: 'H-2 방문취업', visa_history_f1_f4: 'F-1·F-4 동포', visa_history_none: '없음'
};
const 영어시험라벨_ = {
  english_test_none: '없음', english_test_toeic: 'TOEIC', english_test_ielts: 'IELTS',
  english_test_toefl: 'TOEFL', english_test_other: '기타'
};
const 현지활동라벨_ = {
  local_activity_sejong: '세종학당', local_activity_topik_class: 'TOPIK 준비반',
  local_activity_kr_parttime: '한국기업 알바', local_activity_kpop_fanclub: '팬클럽·커버댄스',
  local_activity_none: '없음'
};
const 전공관심라벨_ = {
  field_interest_business: '경영·경제', field_interest_it: 'IT·컴공', field_interest_design: '디자인·예술',
  field_interest_medical: '의료·보건', field_interest_engineering: '공학', field_interest_humanities: '인문·어학',
  field_interest_media: '미디어·방송', field_interest_undecided: '미정'
};
const 학습방식라벨_ = {
  learning_style_1on1: '1:1 코칭', learning_style_small_group: '소그룹 4~6인',
  learning_style_large_class: '정규 대형', learning_style_online: '온라인 병행',
  learning_style_immersion: '원어 몰입', learning_style_grammar: '문법·시험', learning_style_conversation: '회화·발음'
};
const K추가라벨_ = {
  kc_more_kdrama: 'K-드라마 몰입', kc_more_kfood: 'K-푸드·요리', kc_more_kfashion: 'K-패션',
  kc_more_kvariety: 'K-예능', kc_more_seoul_tour: '서울 투어', kc_more_kpop_concert: '콘서트·팬미팅'
};

/* 1~5 척도 묶음 → 「이름 4 · 이름 2」 한 칸. 0·빈칸은 통째로 뺀다(0을 「낮음」으로 읽히게 두지 않는다). */
function 강도요약_(data, 축) {
  return Object.keys(축).map(function (k) {
    const n = Number(data[k]);
    return n ? 축[k] + ' ' + n : '';
  }).filter(String).join(' · ');
}
const 목표축_ = {
  vision_topik_intensity: 'TOPIK', vision_university_intensity: '진학', vision_career_intensity: '취업',
  vision_kculture_intensity: 'K컬처', vision_native_intensity: '회화'
};
const 노출축_ = {
  exposure_drama_intensity: '드라마·영화', exposure_kpop_intensity: 'K-POP', exposure_shortform_intensity: '유튜브·틱톡',
  exposure_real_speaker_intensity: '원어민 대화', exposure_study_mat_intensity: '교재·앱'
};

/* 양극 척도(1~5) → 어느 쪽으로 기울었는지. 3은 어느 극도 아니므로 「중간」으로 따로 읽는다
 * — 숫자만 옮기면 강사가 매번 「1이 어느 쪽이더라」를 되물어야 한다. */
const 성향축_ = [
  { col: 'trait_extroversion', 낮: '내향', 높: '외향' },
  { col: 'trait_planning', 낮: '계획형', 높: '즉흥형' },
  { col: 'trait_social_study', 낮: '혼자 학습', 높: '그룹 학습' },
  { col: 'trait_visual_auditory', 낮: '시각형', 높: '청각형' },
  { col: 'trait_theory_practice', 낮: '이론형', 높: '실전형' }
];
function 극요약_(n, 낮, 높) {
  n = Number(n);
  if (!n) return '';
  return (n === 3 ? '중간' : (n < 3 ? 낮 : 높)) + '(' + n + ')';
}
function 성향요약_(data) {
  return 성향축_.map(function (a) { return 극요약_(data[a.col], a.낮, a.높); }).filter(String).join(' · ');
}

/* K컬처 세부는 트랙별로 접는다 — 관심도 3종(보컬·댄스·뷰티)은 이미 각자 열이 있고, 여기엔 그 아래 문항만. */
function K세부요약_(data) {
  return [
    ['보컬', ['kc_vocal_style', 'kc_vocal_role', 'kc_vocal_stage']],
    ['댄스', ['kc_dance_genre', 'kc_dance_career', 'kc_dance_goal']],
    ['뷰티', ['kc_beauty_part', 'kc_beauty_look', 'kc_beauty_career']]
  ].map(function (p) {
    const vals = p[1].map(function (c) { return data[c] ? String(data[c]) : ''; }).filter(String);
    return vals.length ? p[0] + ' ' + vals.join('/') : '';
  }).filter(String).join(' | ');
}

/* 크루카드 data(컬럼:값) → 상담시트 {헤더명: 값}.
 * 🔴 「반」·「학생ID」는 일부러 비운다 — 배정과 편입은 사람의 결정이다. */
function 크루카드_상담매핑_(data, lang, serial, 접수시각) {
  const v = function (k) { const x = data[k]; return (x === true) ? 'TRUE' : (x === false || x == null ? '' : String(x)); };
  const 서술 = ['[한국 유학, 왜 지금] ' + v('why_now_story'), '[성공한 유학이란] ' + v('success_definition'),
    '[어떤 크루가 되고 싶은가] ' + v('crew_intro')].filter(function (s) { return s.replace(/^\[[^\]]*\]\s*/, ''); }).join('\n');
  const 퀴즈 = [1, 2, 3, 4].map(function (n) { return v('quiz_q' + n); }).filter(String)
    .map(function (a, i) { return 'Q' + (i + 1) + ' ' + a; }).join(' / ');
  /* 지망 사유 3종은 열을 새로 만들지 않고 자유서술 뒤에 붙인다 — 서술형은 읽는 자리가 한 곳이어야 한다. */
  const 지망사유 = [1, 2, 3].map(function (n) {
    const key = ['school_1st_reason', 'school_2nd_reason', 'school_3rd_reason'][n - 1];
    return v(key) ? '[' + n + '순위 선택 이유] ' + v(key) : '';
  }).filter(String).join('\n');

  const o = {
    '등록일': 접수시각,
    '이름(한국어)': v('name_kr'), '이름(몽골어)': v('name_mn'),
    '생년월일': v('birthdate'), '성별': v('gender'),
    '연락처': v('phone'), 'SNS_ID': v('sns'), '이메일': v('email'), '거주지역': v('residence'),
    '최종학력': v('edu_status'),
    '학교명/전공': [v('school'), v('major')].filter(String).join(' / '),
    '보호자명': v('finance_guardian'), '보호자연락처': v('finance_guardian_phone'),
    'TOPIK급수': v('topik_level'), '한국어수준': v('korean_level'), '영어(점수/회화)': v('english_level'),
    'TOPIK목표': v('topik_target'), 'TOPIK목표기한': v('tl_topik_target'), '대학진학시기': v('tl_enroll'),
    '한국방문경험': v('visited_korea'), '방문상세': v('recent_visit'),
    '비자신청이력': v('visa_denied') === '있음' ? '거절' : (v('visa_denied') === '없음' ? '없음' : ''),
    '거절정황': v('visa_denied_reason'),
    '희망진학과정': v('degree_target'), '희망진학지역': 다중요약_(data, 'region_wish_', 지역라벨_),
    '현재직업': v('occupation'), '학습가능시간': v('daily_hours'), '졸업후진로': v('future_10y'),
    '핵심가치관': 다중요약_(data, 'values_', 가치라벨_),
    '지망대학1순위': v('school_1st'), '지망대학2순위': v('school_2nd'), '지망대학3순위': v('school_3rd'),
    '유학예산': v('finance_budget'), '학비조달주체': v('finance_sponsor'), '가족지지': v('family_support'),
    'KPOP댄스희망': v('kc_dance_interest'), '보컬트레이닝': v('kc_vocal_interest'), 'K뷰티메이크업': v('kc_beauty_interest'),
    '선호그룹': v('fav_artist'), '인생드라마': v('fav_drama'),
    '취미관심사': v('fav_place') ? '가고 싶은 곳: ' + v('fav_place') : '',
    // 시트에 이미 있던 빈 열들 — 새 열을 만들기 전에 여기부터 채운다(같은 뜻의 열을 두 개 만들지 않는다)
    '성격유형': 성향요약_(data),
    '학습_방식': 다중요약_(data, 'learning_style_', 학습방식라벨_),
    '관심K분야': 다중요약_(data, 'kc_more_', K추가라벨_),
    /* [2026-08-04] 🔴 수복 — 이 열은 「시각형/청각형」이 아니라 **마케팅 유입경로 8버킷** 열이다.
     * 근거: `엔진_폼리포트.js:114`가 같은 이름의 상담폼 문항을 8버킷으로 만들고,
     *       `엔진_운영배치.js:694`가 이 열을 **채널 어트리뷰션으로 집계**한다(KPI 「채널별 등록」).
     * 그동안 크루카드가 여기에 학습 성향을 덮어써서 **KPI가 「시각형(4)」을 유입 채널로 세고 있었다.**
     * 잃는 정보 0 — 시각/청각은 `성향축_`에 이미 있어 '성격유형' 칸으로 들어간다(실측). */
    '인지채널': v('source'),
    '추천인': v('referrer'),
    '📝자유서술→노션': [서술, 지망사유].filter(String).join('\n'),
    // ── 증분 ──
    '처리상태': '신규접수', '접수출처': '크루카드-' + (lang === 'mn' ? '몽골어' : '한국어'), '크루카드번호': serial,
    '개인정보동의': v('consent_privacy'), '초상권동의': v('consent_media'),
    '집중시간대': v('peak_focus'), '학습공간': v('study_space'),
    '듣기자신감': v('lang_listening_intensity'), '말하기자신감': v('lang_speaking_intensity'),
    '읽기자신감': v('lang_reading_intensity'), '쓰기자신감': v('lang_writing_intensity'),
    '졸업후목표비자': 다중요약_(data, 'visa_target_', 비자라벨_), '장학금의향': v('scholarship'),
    '걱정요인': 다중요약_(data, 'worry_', 걱정라벨_), '인지진단': 퀴즈,
    // ── 2차 증분 ──
    '담당자': v('advisor'),
    '거주형태': v('living'), '아르바이트계획': v('parttime'),
    '한국어학습이력': v('prior_study'), '몽골내한국활동': 다중요약_(data, 'local_activity_', 현지활동라벨_),
    '한자자신감': v('lang_hanja_intensity'),
    '목표강도': 강도요약_(data, 목표축_),
    '관심전공분야': 다중요약_(data, 'field_interest_', 전공관심라벨_),
    '진학타임라인': [v('tl_synk_register') && ('SYNK 등록 ' + v('tl_synk_register')),
      v('tl_apply') && ('지원 ' + v('tl_apply'))].filter(String).join(' · '),
    '한국체류총기간': v('total_stay'), '한국연고': v('korea_tie'),
    '비자보유이력': 다중요약_(data, 'visa_history_', 비자이력라벨_),
    '영어시험종류': 다중요약_(data, 'english_test_', 영어시험라벨_),
    '한국관심경로': 다중요약_(data, 'why_korea_', 왜한국라벨_),
    '한국어노출경로': 강도요약_(data, 노출축_),
    'K컬처참여강도': v('kc_load'), 'K컬처활동형태': v('kc_style'), 'K컬처세부': K세부요약_(data)
  };
  return o;
}

/* 동일인 판정 키 = 이름(공백 제거) + 연락처(숫자만·국가번호 정규화) [v9.168]
 *   왜 둘 다인가: 연락처만 보면 형제가 가족 번호를 같이 적었을 때 두 사람이 한 행으로 합쳐지고,
 *     이름만 보면 동명이인이 합쳐진다. 둘 다 크루카드 필수 문항이라 항상 값이 있다.
 *   왜 이메일이 아닌가: 크루카드에서 선택 문항이라 빈칸이 정상이고, 빈 키는 전부 서로 같아진다.
 *   ⚠ 오타로 이름·번호가 달라지면 못 잡는다 — **놓치는 쪽으로만 틀리게** 만든 것이다.
 *     못 잡으면 행이 하나 더 생겨 원장 눈에 보이지만, 잘못 합치면 남의 상담 기록을 덮는다. */
function 동일인키_(이름, 연락처) {
  const n = String(이름 == null ? '' : 이름).replace(/\s+/g, '');
  let p = String(연락처 == null ? '' : 연락처).replace(/\D/g, '').replace(/^0{2}/, '');
  if (p.length > 8 && p.indexOf('976') === 0) p = p.slice(3);   // +976 99112233 = 99112233
  return (n && p) ? n + '|' + p : '';
}

/* 크루카드번호 칸의 이력 표기 — **최신 ← 직전 · 총 N건**으로 길이를 못 박는다 [v9.168]
 *   🔴 첫 구현은 앞에 계속 이어 붙였는데, 라이브 왕복에서 5회 제출에 이력이 5개까지 자랐다
 *     (`005 ← 004 ← 003 ← 002 ← 001`). 회귀는 2회까지만 봐서 성장이 안 보였다 — 재제출은
 *     본래 여러 번 하는 행위이므로 **횟수에 비례해 자라는 칸은 결국 못 읽는 칸이 된다.**
 *   추적에 필요한 건 「최신이 무엇이고 그 앞이 무엇인가」 + 「몇 번 왔나」다. 전 이력은
 *   crew_cards에 이름으로 다 남아 있으므로 여기서 다시 나열할 이유가 없다. */
function 번호이력_(이전, serial) {
  const 이전문 = String(이전 == null ? '' : 이전).trim();
  if (!이전문) return serial;
  const 직전 = (이전문.match(/^SL-\d{8}-\d{3}/) || [이전문])[0];
  if (직전 === serial) return 이전문;                 // 같은 번호 재기록은 중복시키지 않는다
  /* 누적 건수는 표기에서 되읽는다. 카운트 표기는 3건째부터 붙으므로(2건은 시끄럽게 만들지 않는다)
   * 마커가 없을 때 「←가 있으면 2건, 없으면 1건」이 직전 상태다 — 이걸 1로 뭉뚱그리면
   * 3건째마다 카운트가 리셋돼 영원히 「총 3건」에 머문다(라이브 왕복 뒤 회귀가 잡은 실수). */
  const m = 이전문.match(/·\s*총\s*(\d+)건/);
  const n = (m ? Number(m[1]) : (이전문.indexOf('←') !== -1 ? 2 : 1)) + 1;
  return serial + ' ← ' + 직전 + (n > 2 ? ' · 총 ' + n + '건' : '');
}

/* 같은 사람의 기존 행 번호(없으면 0). 이름·연락처 두 열만 읽는다(전 폭 읽기는 102열 × 수백 행). */
function 상담_동일인행_(sh, h, 이름, 연락처) {
  const key = 동일인키_(이름, 연락처);
  const c이름 = h.map['이름(한국어)'], c연락 = h.map['연락처'];
  if (!key || c이름 === undefined || c연락 === undefined) return 0;
  const last = sh.getLastRow();
  if (last < CONSULT_HDR_ROW + 1) return 0;
  const n = last - CONSULT_HDR_ROW;
  const 이름들 = sh.getRange(CONSULT_HDR_ROW + 1, c이름 + 1, n, 1).getValues();
  const 연락들 = sh.getRange(CONSULT_HDR_ROW + 1, c연락 + 1, n, 1).getValues();
  for (let i = 0; i < n; i++) {
    if (동일인키_(이름들[i][0], 연락들[i][0]) === key) return CONSULT_HDR_ROW + 1 + i;
  }
  return 0;
}

/* 상담데이터입력에 1행 append. 실패해도 crew_cards 적재는 이미 끝났으므로 doPost 전체를 죽이지 않는다. */
function 상담시트_이관_(data, lang, serial) {
  const ss = SpreadsheetApp.openById(CONSULT_SHEET_ID);
  const sh = ss.getSheetByName(CONSULT_TAB);
  if (!sh) return { ok: false, error: 'no-tab' };
  const h = 상담헤더맵_(sh);
  if (h.map['크루카드번호'] === undefined) return { ok: false, error: 'not-migrated' };  // 증분 전이면 조용히 보류

  // 같은 크루카드번호가 이미 있으면 중복 이관하지 않는다(재제출·재시도 대비)
  const last = sh.getLastRow();
  if (last >= CONSULT_HDR_ROW + 1) {
    const col = h.map['크루카드번호'] + 1;
    const 기존 = sh.getRange(CONSULT_HDR_ROW + 1, col, last - CONSULT_HDR_ROW, 1).getValues();
    for (let i = 0; i < 기존.length; i++) if (String(기존[i][0]) === serial) return { ok: true, skip: 'dup' };
  }

  /* ⚠ 스프레드시트 타임존을 믿지 않는다 — 실측(08-04) 이 파일의 TZ는 America/Los_Angeles다.
   *   그대로 쓰면 크루카드번호는 `SL-20260804`인데 같은 행 등록일은 `2026-08-03`으로 하루 어긋난다
   *   (몽골 오전 = LA 전날 오후). 학원 소재지 = 울란바토르 하나뿐이므로 채번(크루카드.js)과 같은
   *   기준으로 못 박는다. 시트 TZ를 고치는 쪽은 이 파일을 함께 읽는 메인 프로젝트까지 흔든다. */
  const 접수시각 = Utilities.formatDate(new Date(), TZ_, 'yyyy-MM-dd');
  const o = 크루카드_상담매핑_(data, lang, serial, 접수시각);

  /* ── 재제출: 같은 사람의 행이 이미 있으면 새 행을 만들지 않는다 [v9.168] ── */
  const 기존행 = 상담_동일인행_(sh, h, o['이름(한국어)'], o['연락처']);
  if (기존행) {
    const c번호 = h.map['크루카드번호'], c상태 = h.map['처리상태'];
    const 현재 = sh.getRange(기존행, 1, 1, h.width).getValues()[0];
    const 상태 = c상태 === undefined ? '' : String(현재[c상태] || '').trim();
    const 이전번호 = c번호 === undefined ? '' : String(현재[c번호] || '').trim();
    const 번호이력 = 번호이력_(이전번호, serial);

    if (미착수상태_.indexOf(상태) !== -1) {
      /* 아직 아무도 안 건드린 접수 = 최신 제출이 정본이다(재제출의 8할은 오타 수정이다).
       * ⚠ **빈 값으로는 덮지 않는다** — 부분 재제출이 이미 받아둔 답을 지우면 재제출이 손해가 된다. */
      const row = 현재.slice();
      Object.keys(o).forEach(function (name) {
        const i = h.map[name];
        if (i === undefined || 재제출_불변열_.indexOf(name) !== -1) return;
        const v = String(o[name] == null ? '' : o[name]);
        if (!v) return;
        row[i] = 셀안전_(v.slice(0, MAX_CELL));
      });
      if (c번호 !== undefined) row[c번호] = 번호이력;
      sh.getRange(기존행, 1, 1, h.width).setValues([row]);
      return { ok: true, row: 기존행, merge: 'update' };
    }
    /* 사람이 이미 손댄 행(상담완료·반배정·앱편입·보류·취소) — **한 칸도 덮지 않는다.**
     * 반·담당자·학생ID가 거기 있고, 학생ID가 붙은 뒤의 이 행은 곧 앱 로스터다.
     * 재제출이 있었다는 사실만 크루카드번호 칸에 남기고, 반영 여부는 원장이 crew_cards 원본을 보고 정한다. */
    if (c번호 !== undefined) sh.getRange(기존행, c번호 + 1).setValue(번호이력);
    return { ok: true, row: 기존행, merge: 'locked' };
  }

  const row = new Array(h.width).fill('');
  Object.keys(o).forEach(function (name) {
    const i = h.map[name];
    if (i === undefined) return;                       // 시트에 없는 헤더는 조용히 건너뛴다
    row[i] = 셀안전_(String(o[name] == null ? '' : o[name]).slice(0, MAX_CELL));
  });
  // 첫 빈 행을 찾아 쓴다 — 상담시트는 서식만 잡힌 빈 행이 아래에 길게 깔려 있어 appendRow가 그 끝으로 튄다
  const 기입행 = 상담_첫빈행_(sh, h.map['이름(한국어)'] + 1);
  sh.getRange(기입행, 1, 1, h.width).setValues([row]);
  return { ok: true, row: 기입행, merge: 'new' };
}

/* 이름 열 기준 첫 빈 행. 서식만 있는 빈 행 때문에 getLastRow()가 부풀어 있어 그대로 쓰면 수백 행 아래에 꽂힌다. */
function 상담_첫빈행_(sh, nameCol) {
  const last = sh.getLastRow();
  if (last < CONSULT_HDR_ROW + 1) return CONSULT_HDR_ROW + 1;
  const vals = sh.getRange(CONSULT_HDR_ROW + 1, nameCol, last - CONSULT_HDR_ROW, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (!String(vals[i][0] || '').trim()) return CONSULT_HDR_ROW + 1 + i;
  return last + 1;
}

/* ═══════════════════════════════════════════════════════════════════
 * 상담시트 업그레이드 (재실행 안전 — 있는 건 건드리지 않고 없는 것만 더한다)
 *   ① 증분 헤더 15열 추가   ② 「반」 드롭다운을 24반 정본으로
 *   ③ 「처리상태」 드롭다운  ④ 헤더·틀고정·조건부 서식(브랜드 키트)
 * 실행: 일회성으로 doGet에서 호출 → 로그 확인 → 호출 제거·push (러너를 상시로 두지 않는다)
 * ═══════════════════════════════════════════════════════════════════ */
const 브랜드_ = { navy: '#262626', coral: '#F96859', lime: '#C8FF3D', cream: '#E4E4E7', paper: '#FBF7F0', ink: '#2B2320' };

function 상담시트_업그레이드_() {
  const ss = SpreadsheetApp.openById(CONSULT_SHEET_ID);
  const sh = ss.getSheetByName(CONSULT_TAB);
  if (!sh) { Logger.log('❌ %s 탭 없음', CONSULT_TAB); return; }
  const 로그 = [];

  // ① 증분 헤더 — 없는 것만 뒤에 붙인다
  let h = 상담헤더맵_(sh);
  const 없는것 = 증분헤더_.filter(function (n) { return h.map[n] === undefined; });
  if (없는것.length) {
    const need = h.width + 없는것.length;
    if (sh.getMaxColumns() < need) sh.insertColumnsAfter(sh.getMaxColumns(), need - sh.getMaxColumns());
    sh.getRange(CONSULT_HDR_ROW, h.width + 1, 1, 없는것.length).setValues([없는것]);
    로그.push('헤더 +' + 없는것.length + '열: ' + 없는것.join(', '));
  } else 로그.push('헤더 증분 없음(이미 최신)');
  h = 상담헤더맵_(sh);

  const 마지막 = Math.max(sh.getMaxRows(), 3);
  const 행수 = 마지막 - CONSULT_HDR_ROW;

  // ② 「반」 드롭다운 = 24반 정본. 구 값(정규반1 등)은 목록 밖이 되어 경고 표시로 드러난다.
  if (h.map['반'] !== undefined) {
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(반키정본_(), true)
      .setAllowInvalid(true)   // 기존 값을 지우지 않는다 — 경고만 띄워 사람이 고치게 한다
      .setHelpText('반 키 정본 24종(평일11A~18D · 주말11A~14D). 문패·표시명은 별도 층이다.').build();
    sh.getRange(CONSULT_HDR_ROW + 1, h.map['반'] + 1, 행수, 1).setDataValidation(rule);
    로그.push('「반」 드롭다운 = 24반 정본');
  }

  // ③ 「처리상태」 드롭다운 + 색 — 접수부터 앱 편입까지가 한 열에서 보인다
  if (h.map['처리상태'] !== undefined) {
    const c = h.map['처리상태'] + 1;
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(처리상태_, true).setAllowInvalid(true).build();
    const rng = sh.getRange(CONSULT_HDR_ROW + 1, c, 행수, 1);
    rng.setDataValidation(rule);
    const 색 = { '신규접수': 브랜드_.coral, '검토중': '#F5C445', '상담완료': '#3B82F6', '반배정': '#7C3AED', '앱편입': '#16A34A', '보류': '#9CA3AF', '취소': '#6B7280' };
    /* 🔑 글자색은 «면마다» 정한다 — 일곱에 흰 글자를 한꺼번에 주면 밝은 면에서 글자가 사라진다.
     *   검토중의 Butter(#F5C445)가 그 자리였다: 흰 글자가 저대비였고 킷 규칙(Butter 면의 글자는 Ink)도 어겼다.
     *   (codex 지적 bdacfddecda9·2c6b8fe9ba91 · 08-20) 나머지 여섯은 어두운 면이라 흰 글자가 맞다. */
    const 글자 = { '검토중': 브랜드_.ink };
    const rules = Object.keys(색).map(function (s) {
      return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(s)
        .setBackground(색[s]).setFontColor(글자[s] || '#FFFFFF').setRanges([rng]).build();
    });
    sh.setConditionalFormatRules(sh.getConditionalFormatRules().filter(function (r) {
      return r.getRanges().every(function (x) { return x.getColumn() !== c; });   // 이 열의 기존 규칙만 교체
    }).concat(rules));
    로그.push('「처리상태」 드롭다운 7단계 + 상태색');
  }

  // ④ 헤더 서식 + 틀고정 — 69열이 넘어가면 눈으로 못 따라간다
  h = 상담헤더맵_(sh);
  sh.getRange(CONSULT_HDR_ROW, 1, 1, h.width)
    .setBackground(브랜드_.navy).setFontColor(브랜드_.cream).setFontWeight('bold').setFontSize(10)
    .setVerticalAlignment('middle').setWrap(true);
  sh.setFrozenRows(CONSULT_HDR_ROW);
  sh.setFrozenColumns(2);   // 이름 2칸은 항상 보이게
  로그.push('헤더 서식 + 틀고정(2행·2열)');

  Logger.log('✅ 상담시트 업그레이드\n · %s', 로그.join('\n · '));
  Logger.log('현재 폭: %s열 · 크루카드번호 열=%s · 처리상태 열=%s',
    h.width, h.map['크루카드번호'] + 1, h.map['처리상태'] + 1);
}

/* 샘플 행 정리 — 반=정규반1(구 이름)이면서 학생ID가 비어 있는 행만. 실학생은 학생ID가 있으므로 안 걸린다. */
function 상담시트_샘플정리_() {
  const sh = SpreadsheetApp.openById(CONSULT_SHEET_ID).getSheetByName(CONSULT_TAB);
  const h = 상담헤더맵_(sh);
  const last = sh.getLastRow();
  if (last < CONSULT_HDR_ROW + 1) { Logger.log('데이터 없음'); return; }
  const vals = sh.getRange(CONSULT_HDR_ROW + 1, 1, last - CONSULT_HDR_ROW, h.width).getValues();
  const 정본 = 반키정본_();
  const 대상 = [];
  for (let i = 0; i < vals.length; i++) {
    const 반 = String(vals[i][h.map['반']] || '').trim();
    const id = String(vals[i][h.map['학생ID']] || '').trim();
    const 이름 = String(vals[i][h.map['이름(한국어)']] || '').trim();
    if (!반 && !이름) continue;
    if (id) continue;                                   // 학생ID 있으면 실데이터 — 절대 안 건드린다
    if (반 && 정본.indexOf(반) === -1) 대상.push({ row: CONSULT_HDR_ROW + 1 + i, 반: 반, 이름: 이름 });
  }
  Logger.log('구 반이름 + 학생ID 없음 행 %s건: %s', 대상.length,
    대상.map(function (t) { return t.row + '(' + t.반 + '/' + t.이름 + ')'; }).join(', ') || '(없음)');
  for (let i = 대상.length - 1; i >= 0; i--) sh.deleteRow(대상[i].row);
  Logger.log('삭제 %s건', 대상.length);
}

/* ═══════════════════════════════════════════════════════════════════
 * 상담 운영 흐름 — 접수 현황판 + 절차 안내 (재실행 안전)
 *   대시보드 탭 기존 내용은 건드리지 않고 **아래에 블록을 붙인다**(마커로 찾아 갱신).
 *   숫자는 수식이라 시트가 스스로 갱신한다 — 코드를 다시 돌릴 필요가 없다.
 * ═══════════════════════════════════════════════════════════════════ */
const 접수판_마커_ = '▣ 크루카드 접수 현황';
const 안내_마커_ = '▣ 크루카드 접수 → 앱 편입 절차';

/* 마커가 있으면 그 행부터, 없으면 기존 내용 두 줄 아래부터 — 같은 자리에 덮어써서 블록이 늘어나지 않는다. */
function 블록시작행_(sh, 마커, 여백) {
  const last = sh.getLastRow();
  if (last >= 1) {
    const col = sh.getRange(1, 1, last, 1).getValues();
    for (let i = 0; i < col.length; i++) if (String(col[i][0] || '').indexOf(마커) === 0) return i + 1;
  }
  return last + (여백 || 2);
}

function 상담시트_접수판_() {
  const ss = SpreadsheetApp.openById(CONSULT_SHEET_ID);
  const sh = ss.getSheetByName('대시보드');
  if (!sh) { Logger.log('대시보드 탭 없음'); return; }
  const c = 상담헤더맵_(ss.getSheetByName(CONSULT_TAB));
  const A1 = function (name) {   // 헤더명 → 상담데이터입력의 열 전체 범위(3행부터)
    const i = c.map[name];
    if (i === undefined) return null;
    const L = 열문자_(i + 1);
    return "'" + CONSULT_TAB + "'!" + L + '3:' + L;
  };
  const 상태열 = A1('처리상태'), 출처열 = A1('접수출처'), 반열 = A1('반'), ID열 = A1('학생ID'), 등록열 = A1('등록일');
  if (!상태열) { Logger.log('증분 열이 없다 — 상담시트_업그레이드_ 먼저'); return; }

  const r0 = 블록시작행_(sh, 접수판_마커_, 3);
  const rows = [];
  rows.push([접수판_마커_, '', '', '', '', '', '']);
  rows.push(['숫자는 수식이라 시트가 스스로 갱신합니다. 크루카드 제출이 들어오면 바로 반영됩니다.', '', '', '', '', '', '']);
  rows.push(['', '', '', '', '', '', '']);
  rows.push(['처리상태', '건수', '', '접수출처', '건수', '', '한눈에']);
  처리상태_.forEach(function (s, i) {
    const 출처 = ['크루카드-한국어', '크루카드-몽골어', '워크인·기타'];
    const o = 출처[i];
    rows.push([
      s, '=COUNTIF(' + 상태열 + ',"' + s + '")', '',
      o || '', o ? (o === '워크인·기타'
        ? '=COUNTA(' + 상태열 + ')-COUNTIF(' + 출처열 + ',"크루카드-*")'
        : '=COUNTIF(' + 출처열 + ',"' + o + '")') : '', '',
      i === 0 ? '=CONCATENATE("총 접수 ",COUNTA(' + 상태열 + '),"건")'
        : i === 1 ? '=CONCATENATE("반 배정 대기 ",COUNTIF(' + 반열 + ',"")-COUNTBLANK(' + 상태열 + '),"건")'
        : i === 2 ? '=CONCATENATE("앱 미편입 ",COUNTA(' + 상태열 + ')-COUNTA(' + ID열 + '),"건")'
        : i === 3 ? '=CONCATENATE("오늘 접수 ",COUNTIF(' + 등록열 + ',TEXT(TODAY(),"yyyy-mm-dd")),"건")' : ''
    ]);
  });
  sh.getRange(r0, 1, rows.length, 7).setValues(rows);
  sh.getRange(r0, 1, 1, 7).merge().setBackground(브랜드_.navy).setFontColor(브랜드_.lime)
    .setFontWeight('bold').setFontSize(12).setVerticalAlignment('middle');
  sh.setRowHeight(r0, 30);
  sh.getRange(r0 + 1, 1, 1, 7).merge().setFontColor('#6B7280').setFontSize(9);
  sh.getRange(r0 + 3, 1, 1, 7).setBackground(브랜드_.cream).setFontWeight('bold');
  sh.getRange(r0 + 4, 7, 4, 1).setFontWeight('bold').setFontColor(브랜드_.coral);
  Logger.log('✅ 접수 현황판 — 대시보드 %s행부터 %s행', r0, rows.length);
}

function 열문자_(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

function 상담시트_안내_() {
  const ss = SpreadsheetApp.openById(CONSULT_SHEET_ID);
  const sh = ss.getSheetByName('사용안내');
  if (!sh) { Logger.log('사용안내 탭 없음'); return; }
  const r0 = 블록시작행_(sh, 안내_마커_, 3);
  const L = [
    [안내_마커_],
    [''],
    ['크루카드(태블릿·링크)로 들어온 접수는 이 시트 「상담데이터입력」에 자동으로 한 줄 쌓입니다.'],
    ['⚠ 단 학생ID와 반은 비어서 들어옵니다 — 공개 링크라 아무나 제출할 수 있기 때문입니다.'],
    ['   학생ID가 비어 있는 동안에는 앱 로스터에 절대 들어가지 않습니다. 안전장치입니다.'],
    [''],
    ['① 신규접수  — 크루카드가 자동으로 넣습니다. 원장이 할 일 없음.'],
    ['② 검토중    — 내용을 읽고 진짜 상담 대상인지 판단합니다. 장난·중복이면 「취소」로.'],
    ['③ 상담완료  — 대면·전화 상담을 마쳤습니다. 필요하면 비고에 메모.'],
    ['             📄 이 자리에서 「상담 결과 요약」 한 장을 뽑아 손에 쥐여 드립니다.'],
    ['                상담 «직전»에 뽑아 두면 그 종이가 상담 대본이 됩니다 — 지금 자리·목표까지의 길·추천 반이'],
    ['                이미 채워져 나오므로 종이를 짚어 가며 이야기하고, 달라진 것만 그 자리에서 고칩니다.'],
    ['                뽑는 법 = `node tools/상담결과조판.js --상담행 <그 사람 한 줄.json> --pdf`'],
    ['④ 반배정    — 「반」 열에서 24반 중 하나를 고릅니다(평일11A~18D · 주말11A~14D).'],
    ['⑤ 앱편입    — 「학생ID」를 채웁니다. 이 순간부터 다음 날 아침 동기화로 앱에 학생이 생깁니다.'],
    ['             ID 규칙은 기존 학생과 같은 형식을 따르세요(예: SYNK-0NN).'],
    ['⑥ 보류/취소 — 진행하지 않는 건. 행을 지우지 말고 상태로 남겨두면 통계가 정확해집니다.'],
    [''],
    ['📌 크루카드번호(SL-YYYYMMDD-NNN)가 crew_cards 탭의 원본과 이어지는 열쇠입니다.'],
    ['   상담시트에는 관리에 쓰이는 항목만 옮겨 왔고, 응답 전체(182열)는 crew_cards에 그대로 있습니다.'],
    ['📌 접수 건수·대기 건수는 「대시보드」 탭 아래 ▣ 크루카드 접수 현황에서 자동으로 셉니다.']
  ];
  sh.getRange(r0, 1, L.length, 1).setValues(L);
  sh.getRange(r0, 1).setBackground(브랜드_.navy).setFontColor(브랜드_.lime).setFontWeight('bold').setFontSize(12);
  sh.setRowHeight(r0, 28);
  sh.getRange(r0 + 3, 1, 3, 1).setFontColor(브랜드_.coral);
  sh.setColumnWidth(1, 780);
  Logger.log('✅ 절차 안내 — 사용안내 %s행부터 %s행', r0, L.length);
}
