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
 * ═══════════════════════════════════════════════════════════════════ */

const CONSULT_TAB = '상담데이터입력';
const CONSULT_HDR_ROW = 2;   // 헤더는 2행, 데이터는 3행부터(기존 규약)

/* 크루카드에만 있던 항목 중 **관리에 실제로 쓰이는 것**만 증분한다.
 * 이미 상담시트에 있는 항목(K컬처 4종·유학예산·학비조달·가족지지·학습가능시간 등)은 옮기지 않는다
 * — 같은 값이 두 열에 살면 어느 쪽이 정본인지 아무도 모르게 된다. */
const 증분헤더_ = [
  '처리상태', '접수출처', '크루카드번호',          // 운영 흐름
  '개인정보동의', '초상권동의',                    // 법적 근거(시트엔 음성동의만 있었다)
  '집중시간대', '학습공간',                        // 반 배정·학습 설계
  '듣기자신감', '말하기자신감', '읽기자신감', '쓰기자신감',  // 레벨 배정(1~5)
  '졸업후목표비자', '장학금의향',                  // 비자·재정 로드맵
  '걱정요인', '인지진단'                           // 이탈 리스크 · 학습 설계
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

/* 크루카드 data(컬럼:값) → 상담시트 {헤더명: 값}.
 * 🔴 「반」·「학생ID」는 일부러 비운다 — 배정과 편입은 사람의 결정이다. */
function 크루카드_상담매핑_(data, lang, serial, 접수시각) {
  const v = function (k) { const x = data[k]; return (x === true) ? 'TRUE' : (x === false || x == null ? '' : String(x)); };
  const 서술 = ['[한국 유학, 왜 지금] ' + v('why_now_story'), '[성공한 유학이란] ' + v('success_definition'),
    '[어떤 크루가 되고 싶은가] ' + v('crew_intro')].filter(function (s) { return s.replace(/^\[[^\]]*\]\s*/, ''); }).join('\n');
  const 퀴즈 = [1, 2, 3, 4].map(function (n) { return v('quiz_q' + n); }).filter(String)
    .map(function (a, i) { return 'Q' + (i + 1) + ' ' + a; }).join(' / ');

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
    '선호그룹': v('fav_artist'), '인생드라마': v('fav_drama'), '취미관심사': v('kc_more_kfood') ? '' : '',
    '📝자유서술→노션': 서술,
    // ── 증분 ──
    '처리상태': '신규접수', '접수출처': '크루카드-' + (lang === 'mn' ? '몽골어' : '한국어'), '크루카드번호': serial,
    '개인정보동의': v('consent_privacy'), '초상권동의': v('consent_media'),
    '집중시간대': v('peak_focus'), '학습공간': v('study_space'),
    '듣기자신감': v('lang_listening_intensity'), '말하기자신감': v('lang_speaking_intensity'),
    '읽기자신감': v('lang_reading_intensity'), '쓰기자신감': v('lang_writing_intensity'),
    '졸업후목표비자': 다중요약_(data, 'visa_target_', 비자라벨_), '장학금의향': v('scholarship'),
    '걱정요인': 다중요약_(data, 'worry_', 걱정라벨_), '인지진단': 퀴즈
  };
  delete o['취미관심사'];   // 크루카드에 대응 항목이 없다 — 빈 값으로 덮어쓰지 않는다
  return o;
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

  const tz = ss.getSpreadsheetTimeZone() || 'Asia/Ulaanbaatar';
  const 접수시각 = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const o = 크루카드_상담매핑_(data, lang, serial, 접수시각);

  const row = new Array(h.width).fill('');
  Object.keys(o).forEach(function (name) {
    const i = h.map[name];
    if (i === undefined) return;                       // 시트에 없는 헤더는 조용히 건너뛴다
    row[i] = 셀안전_(String(o[name] == null ? '' : o[name]).slice(0, MAX_CELL));
  });
  // 첫 빈 행을 찾아 쓴다 — 상담시트는 서식만 잡힌 빈 행이 아래에 길게 깔려 있어 appendRow가 그 끝으로 튄다
  const 기입행 = 상담_첫빈행_(sh, h.map['이름(한국어)'] + 1);
  sh.getRange(기입행, 1, 1, h.width).setValues([row]);
  return { ok: true, row: 기입행 };
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
const 브랜드_ = { navy: '#1A2340', coral: '#FF6B5C', lime: '#C8FF3D', cream: '#F6F1E8', paper: '#FBF7EE', ink: '#171820' };

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
    const 색 = { '신규접수': 브랜드_.coral, '검토중': '#E9A611', '상담완료': '#3B82F6', '반배정': '#7C3AED', '앱편입': '#16A34A', '보류': '#9CA3AF', '취소': '#6B7280' };
    const rules = Object.keys(색).map(function (s) {
      return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(s)
        .setBackground(색[s]).setFontColor('#FFFFFF').setRanges([rng]).build();
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
