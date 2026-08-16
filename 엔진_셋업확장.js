// SYNK 엔진 분할부 — 셋업·확장 — 트리거/시트 셋업·몬스터 카드·데모 모드·Glide 사전점검·트리거 리셋·경영계기판·조 편성·차시 마감폼·마감 감시·온라인 강의·시트 메뉴·강의 카탈로그.
// 원본은 Code.js 단일 파일이었다. 로드 순서 정본 = .clasp.json filePushOrder(상수 정본 Code.js가 선두). 표식 기반 테스트는 tests/_engine-source.js가 전 파일을 합본해 본다.
/* ===================== [v5] 신규 트리거/시트 셋업 (1회 실행) ===================== */

// [v9.9] 🧬 원버튼 재건 — 빈 스프레드시트에서 SYNK 세계 전체를 되살립니다
// [v9.37] 시트 골격 정본 — 이 목록이 곧 SYNK의 시트 지도입니다(실데이터는 백업에서 복원). 단일 소스를
//   bootstrapSynk(재건)·preflightGlide·buildSystemManifest(누락·잉여·스키마 드리프트 감지)가 공유한다.
// [v9.135] 톱레벨 const → 지연 평가 함수. 이 목록은 타파일 상수 8종(KPI_*·GROUPS_·LECTURE_*·LESSON_CLOSE_·
//   TEACHER_STATS_·ABSENCE_FOLLOWUP_)을 참조하는데, 톱레벨 const면 파일 초기화 순서(filePushOrder)가
//   틀어지는 순간 ReferenceError로 전 트리거가 즉사한다(07-24 상담AI.gs:27 실사고와 같은 계급).
//   호출 시점(런타임)엔 전 파일이 로드돼 있어 순서 자체가 무의미해진다 — 순서 의존 제거가 목적이지 성능 아님.
// [v9.239] 학습 수집면 헤더 정본 3벌 — 같은 배열이 여러 곳(골격·리허설 시딩·재건·교재연동)에 손사본으로
//   살아 갈라질 수 있었다(v9.138 hw_feedback·v9.87 teacher_stats 와 같은 병 — 두 벌은 반드시 갈라진다).
//   여기 한 벌에서 전부 파생시킨다. 열 추가는 끝에만(기존 데이터 열 위치 보존).
//   VOICE_LOG_HEADERS 가 여기 사는 이유: 쓰는 쪽(교재연동.js)은 ENGINE_FILES 밖이라, 골격이 참조하는
//   정본은 엔진 쪽에 있어야 테스트 하네스·filePushOrder 선두 고정과 안 부딪친다(08-15 실측).
const MASTERY_LOG_HEADERS = ['student_id', 'grammar_id', '상태', '첫기록일', '도달일', '출처', 'updated_at'];
const ACADEMIC_LOG_HEADERS = ['log_id', 'student_id', '날짜', '유형', '값', '비고', '입력자'];
const VOICE_LOG_HEADERS = ['student_id', '제출일', '미션', '파일URL', 'file_id', 'created_at', '전사', '전사상태', '전사일시', '급수', '미션ID', 'schema_ver']; // [v9.208] schema_ver — A-8 2단계(수집 4시트 중 마지막) · 끝에만 붙인다
// [v9.241] 골격 밖에 살던 필수 탭 4종의 헤더 정본. 이 넷은 setup·재건이 만들거나(contents·class_stats·
//   trajectory) 사람이 채우는데(schedule), **지도에 없었다** — 그래서 워치독의 손 목록에만 이름이 있었다.
const CONTENTS_HEADERS = ['콘텐츠ID','유형','이름','설명','이미지URL','순번','몽골어','영어'];
const CLASS_STATS_HEADERS = ['class_name','학생수','반누적포인트','반월간포인트','반몬스터','이번달출석합','반주간데미지','주간평균'];
/* [v9.241] 골격 행의 **세 번째 칸** = 이 탭이 «수집 장부»인가(append-only · 지워지면 소급 불가).
 *
 * 왜 여기 적나: 이 표식을 다른 파일에 목록으로 두면 새 수집 탭이 생기는 날 그 목록만 안 늘고,
 *   갈라진 쪽의 증상은 언제나 「통과」다(v9.239 가 수집면 «출생»에서 겪은 것과 같은 병).
 *   시트를 선언하는 **바로 그 줄**에 붙이면 낡을 자리가 없다.
 * 무엇이 표식을 받나: 행이 쌓이기만 하고 **줄어들 이유가 없는** 탭. 데모 퇴장(`exitDemoMode`)이
 *   지우는 탭은 그 자리에서 기준선을 함께 지운다(아래 `wipe`) — 안 그러면 개원 첫 주에
 *   따를 수 없는 경보가 뜬다(F103).
 * 읽는 쪽: `수집장부탭_()` → 주간 워치독의 «줄었나» 검사. 골격을 쓰는 나머지 셋(재건·사전점검·
 *   매니페스트)은 k[0]·k[1] 만 보므로 칸이 늘어도 영향이 없다. */
const 수집표식_ = '수집';
function sheetSkeleton_() {
  return [
    ['profiles', ['user_id','이름','이름_몽골','role','class_name','생일','email','연락처','messenger_link','parent_of','tuition','등록일','보호자명','보호자연락처','created_at']],
    ['point_logs', ['id','student_id','points','reason','given_by','created_at','month','태그']],
    ['attendance', ['id','student_id','timestamp','method']],
    ['teacher_checkins', ['이름','구분','시각']],
    ['form_responses', ['제출시각']],
    ['raid', ['week','class_name','목표','달성포인트','상태','보상지급']],
    ['carryover', ['student_id','points']], ['app_state', ['key','value']],
    ['titles', ['월','student_id','칭호']], ['manual_titles', ['student_id','칭호','부여자','날짜']],
    ['achievements', ['student_id','업적','등급','달성일']],
    ['monthly_snapshot', ['월','student_id','월간포인트','랭킹']],
    ['story', ['월','student_id','이름','스토리']],
    ['notices', ['title','body','date','title_mn','body_mn']],
    ['weekly_topics', ['class_name','배운내용','입력자','created_at','배운내용_mn','문법태그','전체도달도','예외학생','숙제완료자','연료미션','처리상태','학습전개상태']], // [v9.36] 수업 로그 승격(F~L) — ensureLessonCols_가 기존 시트도 보정
    ['class_fuel', ['class_name','미션','입력자','created_at']],
    ['hw_batch', ['date','class_name','완료자목록','입력자','created_at','처리상태']],
    ['today_board', ['유형','이름','반','시각','퇴근']],
    ['teacher_stats', TEACHER_STATS_HEADERS], // [v9.40] 구 3열(teacher·지급수·편중률)이 실사용 8열과 불일치하던 드리프트 정정 · [v9.87] 정본 상수 공유로 드리프트 재발 자체를 차단(+담당반 9열)
    ['report_cards', ['card_id','student_id','월','image_url','칭호','코멘트','created_at']], // [v9.28] 실사용 7열로 정정(구 3열은 setupV5Triggers·runReportCards_와 불일치하던 결함)
    ['league_history', ['월','시즌','챔피언반','챔피언포인트','준우승','준우승포인트','MVP_id','MVP이름','MVP포인트','created_at']], ['hall_of_fame', ['연도','이름','반','업적','한마디','사진URL']],
    ['raid_story', ['date','class_name','유형','제목','스토리']],
    [KPI_SHEET_NAME, KPI_HEADERS], // [v9.26] 이탈률·전환율 계측 시트
    ['exit_log', ['student_id','이름','반','퇴소감지일','재원일수']], // [v9.28] 퇴소 이벤트 로그
    ['absence_notice', ['student_id','반','날짜','사유','등록시각']], // [v9.28] 학부모 결석 사전신고
    ['absence_followup', ABSENCE_FOLLOWUP_HEADERS], // [v9.89] 결석 추적 — checkNoShow 감지 1건=1행, 연락은 폼, 복귀는 자동 판정. 「결석 복귀율」(등급 심사 20점) 원본
    ['inquiries', ['student_id','이름','문의내용','상태','접수시각']], // [v9.28] 학부모 문의 인바운드
    ['payments', ['student_id','이름','금액(만₮)','납부일','방법','비고','created_at']], // [v9.28] 매출 원장(수동 기입)
    ['crew_projects', ['시즌','반','프로젝트명','한줄소개','결과물링크','사진URL','공개일','참여크루','비고']], // [v9.29] 시즌 프로젝트 포트폴리오 — 수동 기입 전용(hall_of_fame 패턴 · 트리거·배치 연동 없음)
    ['mastery_log', MASTERY_LOG_HEADERS, 수집표식_], // [v9.36] 문법 도달 로그 — expandMasteryLog_ upsert, 진화 게이트 재료(Glide 비바인딩) · [v9.239] 헤더 정본 공유(손사본 3벌 → 1벌)
    [SELF_DECLARE_TAB_, SELF_DECLARE_HEADERS, 수집표식_], // [v9.197] 자기선언 이력 — 학생이 덮어쓰는 3칸(드림한줄·최애·몬스터이름)의 변경만 append(selfDeclareLogNightly_)
    ['attendance_batch', ['날짜','class_name','출석자목록','입력자','created_at','처리상태']], // [v9.36] 수업 시작 출석 1탭(B안) → expandAttendanceBatch_가 attendance로 전개
    ['groups', GROUPS_HEADERS], // [v9.80] 조 편성(시즌×반 1벌) — assignGroupsAll이 채운다. 역할·짝·발표자는 여기서 계산만 하고 저장하지 않는다(매 차시 쓰기 0)
    ['lectures', LECTURE_HEADERS],           // [v9.106] 온라인 강의 카탈로그(유호님이 채운다)
    ['lecture_views', LECTURE_VIEW_HEADERS], // [v9.106] 수강 이력 — 주말반 승급 판정의 나머지 절반
    ['lesson_close', LESSON_CLOSE_HEADERS], // [v9.91] 차시 마감폼 적재 — 진도 3택·미발화자. 조 편성 침묵 점수·이월 경보·4주차 명단의 공통 원천
    ['hw_feedback', HW_FEEDBACK_HEADERS, 수집표식_], // [v9.49] AI 숙제 첨삭 카드 — aiFeedbackBatch_ 생성. I상태: '노출'=공개(게이트 통과·무인)/'대기'=수동검수 모드/'격리:'·'오류:'=미노출([v9.63]), J학생확인=Glide 전용(스크립트 불가침), K포인트지급=스크립트 전용 · [v9.138] 헤더 정본을 배치와 공유(구 구조는 두 벌이라 갈라졌다) + 수집 4열(숙제ID·오류태그·재작성원본·다시쓰기URL)
    ['student_errors', ['날짜','student_id','반','유형','메모','입력자','created_at','상태']], // [v9.36] 강사 개인 약점 메모(선택 입력) — 리포트·브리핑 노출은 후속(학생 앱 미노출)
    ['onboarding', ['role','제목','안내KO','안내MN','아이콘']], // [v9.38] 역할별 홈 안내 카드(setupOnboarding) — 재건 목록 누락분 보강
    ['system_manifest', ['지표','값','상태']], // [v9.37] buildSystemManifest 출력 — 시트·콘텐츠·트리거·의존성 실측 정본(수동 숫자 대체)
    // [v9.40] 월간 배치 산출 시트 5종 — 배치가 매월 1일에야 ensureSheet로 만들던 것을 골격 정본에 편입.
    //   Glide는 "존재하는 시트"만 테이블로 잡으므로, 조립 시점에 헤더가 미리 있어야 스토리·카드·리그 탭을 바인딩할 수 있다.
    ['synk_stories', ['월','호수','제목','챕터','챕터제목','본문','문법포인트','씬프롬프트']],
    ['synk_cards', ['월','student_id','카드HTML']],
    ['world_raid', ['월','보스명','HP','누적데미지','상태']],
    ['league_pairs', ['week','반A','반B','상태','결과']],
    ['academic_log', ACADEMIC_LOG_HEADERS], // [v9.239] 헤더 정본 공유(손사본 3벌 → 1벌)
    ['jacket_grants', ['student_id','이름','자격도달일','재원개월','누적P','지급상태']], // [v9.83] 🧥 과잠 자격 대장
    // [v9.138] 📊 학습 데이터 축적층 — 「2년 축적 → AI 회화 앱」의 원본. 운영 시트가 아니라 **수집기**다.
    //   quiz_log: 구조상 가장 크게 새던 곳 — 퀴즈 100문항을 매일 띄우면서 학생의 선택을 한 건도 안 받고 있었다.
    //   문항 텍스트·정답을 행에 함께 스냅샷한다(contents가 개정돼도 2년 뒤 해석이 가능하도록).
    ['quiz_log', QUIZ_LOG_HEADERS, 수집표식_],
    //   talk_log: 지금 앱이 쌓는 것은 전부 단문·단답이라 **「대화」가 0건**이었다 — 회화 앱을 만들겠다면서
    //   다회차 주고받기가 한 건도 없는 상태. 이 시트가 그 구멍을 메운다(숙제·퀴즈보다 큰 구멍이다).
    ['talk_log', TALK_LOG_HEADERS, 수집표식_],
    //   [v9.147] teacher_gold: 학생 데이터가 아니라 **정답(채점표)**을 쌓는 유일한 시트. 무인 발행이라
    //   「강사가 실제로 한 교정」이 어디에도 안 남는데, 그게 없으면 2년 뒤 모델 선택을 감으로 한다.
    //   강사판정·강사교정·사유·강사 4열은 **Glide가 채운다**(주 5행이라 update 예산 ≈ 월 20).
    ['teacher_gold', GOLD_HEADERS, 수집표식_],
    // [v9.239] 수집면 «출생» 단일화(엔진도달 전수감사 §9-4 (2)) — 학습 데이터 탭 3종이 골격 밖에서
    //   ensureSheet 로만 태어나 「우리 수집면 목록」이 두 갈래였다(갈라진 쪽의 증상은 언제나 「통과」).
    //   골격 등재 = 재건·system_manifest 대조·월키 보호(textKeyCols_ 도출)의 눈에 들어온다.
    ['voice_log', VOICE_LOG_HEADERS, 수집표식_],               // 음성 원본·전사 — 교재연동 voiceSweep_ 가 쓴다
    [TALK_INDEX_LOG_SHEET, TALK_INDEX_LOG_HEADERS, 수집표식_], // 발화 지수 주간 스냅샷 — talkIndexSnapshot_ (v9.233)
    [OUTCOME_TAB_, OUTCOME_HEADERS_, 수집표식_],               // 궤적 결과 관측 — 엔진_궤적 (의도↔결과 조인의 결과쪽)
    /* [v9.241] 지도 밖에 살던 필수 탭 4종 편입 — 주간 워치독의 손 목록에만 이름이 있어서, 목록을
     *   골격에서 도출하는 순간 **감시에서 사라질 뻔했다**(실측: 손 35종 중 이 넷만 골격 밖).
     *   셋은 코드가 만들고(contents·class_stats·trajectory) `schedule` 은 사람이 채운다 —
     *   그래서 `schedule` 은 지워지면 아무도 되살리지 않는다(존재 검사가 가장 값진 자리). */
    ['contents', CONTENTS_HEADERS],       // 게임 콘텐츠 원장(setupContents 계열이 채운다)
    ['class_stats', CLASS_STATS_HEADERS], // 반 집계(calcAll 산출)
    ['schedule', SCHEDULE_HEADERS],       // 시간표 — 사람이 채우는 유일한 골격 탭
    [TRAJECTORY_TAB_, TRAJECTORY_HEADERS_] // 궤적 의도(엔진_궤적) — 결과쪽 outcome_log 의 짝
  ];
}
/** [v9.241] 수집 장부 탭 이름 — 골격의 세 번째 칸에서 **도출**한다(손 목록 금지 · 회귀가 대조한다). */
function 수집장부탭_() {
  return sheetSkeleton_().filter(function (k) { return k[2] === 수집표식_; }).map(function (k) { return k[0]; });
}

/* [v9.243] 수집 «도달» 장부 — 「이 시트에 쌓인 것이 «다음에 줄 것»을 바꾸는가」
 *
 * ■ 왜 넷째 장부인가 — 래칫 셋이 **이 층을 원리상 못 본다**
 *   형제 저장소(SYNK-talk `lib/이벤트검증.js`)의 래칫 셋(`도달0상한`·`생산자섰는데도달0상한`·
 *   `행동안바뀜상한`)은 전부 **앱 사건 14종**만 센다. 그런데 `docs/엔진도달_설계.md` §2-1 이
 *   「지금 실제로 데이터가 쌓이는 유일한 곳」이라 부른 곳은 **이 시트층**이다.
 *   즉 오늘 실제로 모이는 것에는 도달 검사가 0이었다 — 바로 위 `수집장부탭_()` 은 «줄었나»(유실)만
 *   보고, 그 검사는 도달이 0인 탭에서도 초록이다. 유호님 상시 지시(「수집은 엔진 도달까지가
 *   한 벌」)의 기계적 실체가 앱층에만 있고 시트층에 없었다.
 *
 * ■ 이 층 고유의 함정 = **사람 화면을 도달로 세는 것**
 *   `talk_index_log` 가 그 반례다. 주간 리포트 꼬리가 그것을 읽으므로 「읽는 코드가 있다」는
 *   참이다 — 그런데 읽어서 **사람에게 보여줄 뿐** 다음에 줄 것을 안 바꾼다. 철학 부록 A-1 이
 *   각주로만 적어 둔 그 갈림(㉠ 행 「모였나 ✓·닿았나 ✗」)을 여기서 기계가 진다.
 *   ⇒ 사람 화면만 읽는 탭은 `{소비자}` 가 아니라 `{사유}` 다. 「읽힌 것」이 도달이지
 *     「보이는 것」이 도달이 아니다(설계 §5 · 철학 A-1 읽는 법 ②).
 *
 * ■ 규칙 — 값은 `{ 소비자, 층 [, 손] }` xor `{ 사유 }`
 *   · 소비자 = '파일.js:함수명'. 그 파일에 **탭 이름 문자열이 실재**해야 한다(거짓 지목 차단 —
 *     형제 장부의 `낡은도달` 과 같은 규칙).
 *   · 층 = '제품'(오늘의 학생에게 줄 것이 바뀐다) | '자산'(회사의 다음 결정에 닿는다).
 *     엔진 지도의 두 줄 그대로다 — 자산층에 「학생 화면이 안 바뀐다」를 결함으로 적지 않는다.
 *   · 손 = true — **사람이 눌러야만 도는** 도달. 형제 장부가 못 보는 갈림이고(설계 §2 「손 CLI 도
 *     초록으로 세어 이 갈림을 못 본다」), 그래서 도달로 세되 **따로 센다**.
 *   · 사유 = 지금 안 닿는 이유. 「나중에」 금지 — **무엇이 서면 닿는지**를 적는다.
 *   · 키는 `수집장부탭_()` 에서 파생한다 — 여기 목록을 다시 적지 않는다(같은 목록을 두 곳에
 *     적으면 갈라지고, 갈라진 쪽의 증상은 언제나 「통과」다). 회귀가 두 집합을 대조한다.
 *
 * ■ 대가 (CLAUDE.md 신뢰성 맹점④ — 새 장치엔 틀릴 때의 모습과 닫을 것을 함께 적는다)
 *   · 틀릴 때의 모습 = **맞는 얼굴로 틀린 초록**. 소비자를 적어 둔 뒤 그 함수의 «읽는 몸»만
 *     비워도 이 장부는 초록이다 — 문자열 실재까지가 기계의 천장이고 그 위는 리뷰 몫이다.
 *     숨기지 않는다: 형제 장부가 같은 자리에서 같은 말을 한다.
 *   · 닫을 것 = 없다(안전 가드는 억지로 닫지 않는다). 대신 **분모를 안 늘렸다** — 새 검사는
 *     기존 골격에서 도출하고, 새 시트·새 속성·새 배치를 하나도 만들지 않는다.
 *
 * ■ 🔴 정직한 한계 — **분모는 「수집 표식이 붙은 것」이지 「수집되는 것 전부」가 아니다**
 *   실측 08-16 의 반례: `lesson_close`(차시 마감폼 — 진도 3택·미발화자)는 append-only 이고
 *   소급이 안 되며 **실제로 도달한다**(`quietScoreMap_` → `assignGroups` 침묵 점수). 그런데
 *   수집 표식이 없어 여기서도, 위 «줄었나» 감시에서도 분모 밖이다. 즉 「위반 0」은 **표식이
 *   붙은 9종 안에서만** 참이다 — 0 은 분모와 함께 읽는다(유호 확정 08-14).
 *   ⚠ 표식을 넓히는 것은 이 커밋의 몫이 아니다: 표식은 «줄었나» 경보의 과녁이기도 해서
 *   넓히면 그쪽 알림이 함께 늘어난다(따를 수 없는 경보를 만들면 둘 다 무시된다 · F103).
 *   → 별도 트랙으로 세운다(대기열). 여기 적어 두는 것이 「알고도 두지 마라」의 이행이다. */
function 수집도달_() {
  return {
    /* 오류 태그 13열 → `aiWeakMap_` 이 14일 창으로 집계해 AI 퀴즈 프롬프트·반 브리핑·연습 노트
     * 세 곳의 «내용»을 바꾼다(v9.209). 철학 Ⅰ-1 「23유형 기록」이 학생에게 되돌아가는 배선. */
    'hw_feedback': { 소비자: '엔진_콘텐츠AI.js:aiWeakMap_', 층: '제품' },
    /* 미도달('연습') 문법 → `buildFocusNotes_` 가 학생별 「내 연습 노트」 문항을 고른다. */
    'mastery_log': { 소비자: '교재연동.js:buildFocusNotes_', 층: '제품' },
    /* 강사 교정 → 비식별 평가 픽스처로 조립돼 형제 저장소(모델 교체 판정 시험지)로 간다.
     * 🔑 손=true 는 결함이 아니라 **의도된 게이트**다 — 바깥으로 나가는 쓰기는 사람이 누를 때만
     *   돈다(설계 §2-1 · `tests/수집.test.js` 「[v9.175] 자동 배치에 넣지 않는다」). 🚫자동 배치
     *   편입 재제안. 그래도 세는 이유는 「사람 손 없이」 축에서 이 칸이 미완이기 때문이다. */
    'teacher_gold': { 소비자: '엔진_수집.js:골든픽스처_', 층: '자산', 손: true },
    /* 결과 관측 → `궤적_최신관측_` 이 trajectory 한 줄(「지금 이 사람은 어디에 있나」)을 세운다.
     * 자산층이라 학생 화면이 안 바뀌는 것이 정상이다 — 소비자는 회사의 다음 결정이다.
     * 🔑 키를 상수로 짓는다(리터럴 금지) — 이름이 두 곳에 적히면 갈라지고, 갈라진 쪽은 조용히
     *   빈 시트를 읽는다(`tests/발화퀄리티.test.js` 가 talk_index 에서 먼저 못박은 규칙). */
    [OUTCOME_TAB_]: { 소비자: '엔진_궤적.js:궤적_최신관측_', 층: '자산' },

    /* ↓ 여기부터가 오늘의 빚이다. 사유는 전부 «무엇이 서면 닿는가» 형태로 적는다. */
    /* 읽는 곳은 있다 — 수집 장부 점검 리포트가 응답 수·정답률·확신도 채움률을 «센다». 그런데
     * 세기만 하고 다음 문제를 안 고른다. 🔑 무엇이 서면 닿는가 = 개인 퀴즈 출제(`aiQuizBatch_`)가
     * 이 탭의 오답 문항을 재출제 재료로 읽는 날. 지금 그 출제는 hw_feedback 태그만 본다. */
    'quiz_log': { 사유: '읽는 곳이 진단 리포트뿐이다 — 응답을 세기만 하고 다음 문항 선택에 안 쓴다. AI 개인 퀴즈 출제가 이 탭의 오답을 재출제 재료로 읽는 날 닿는다.' },
    /* 회화 앱의 핵심 재료인데 소비자가 0이다. 🔑 무엇이 서면 닿는가 = 다회차 대화의 턴 이력을
     * 다음 답장의 맥락으로 싣는 날(지금 답장은 그 턴 하나만 보고 쓴다). */
    'talk_log': { 사유: '읽는 곳이 진단 리포트뿐이다 — 턴 수·최장 턴만 센다. 다회차 이력을 다음 답장의 맥락으로 싣는 배선이 서면 닿는다.' },
    /* 전사문이 쌓이는데 읽는 것은 전사 «상태»(대기·완료·실패) 관리와 삭제뿐이다. 🔑 무엇이 서면
     * 닿는가 = 전사문에서 발음·오류를 뽑아 약점맵에 합류시키는 날(`aiWeakMap_` 의 셋째 재료). */
    'voice_log': { 사유: '읽는 곳이 전사 상태 관리·진단·삭제뿐이다 — 전사문 자체를 학습 재료로 읽는 자리가 0이다. 전사문의 오류가 약점맵에 합류하는 날 닿는다.' },
    /* 🔴 이 층이 세우려는 함정의 표본 — 읽는 코드는 있는데 그 끝이 사람 화면이다.
     * ⚠ 「조 편성에 발화 축이 없다」는 뜻이 아니다(실측 08-16): `assignGroups` 는 발화를 이미 본다 —
     *   단 `quietScoreMap_` 이 **원신호** `lesson_close` 의 미발화자 칸을 세지, 이 주간 지수
     *   (got·max·quiet·pct)를 안 읽는다. 그래서 «요약을 낸 것»만 도달이 0이다. */
    [TALK_INDEX_LOG_SHEET]: { 사유: '읽는 곳이 주간 리포트 꼬리 하나 = 사람 화면이다 — 전주 대비를 보여줄 뿐 다음 조·역할·과제를 안 바꾼다. 조 편성이 원신호(lesson_close 미발화자) 대신 이 주간 지수를 입력으로 받는 날 닿는다.' },
    /* 학생이 스스로 쓴 선언(드림한줄·최애·몬스터이름)의 «변경 이력». 철학 ㉢(삶 이해)의 재료인데
     * 읽는 자리가 0이라 A-1 ㉢ 행의 「끊겼다」가 여기서도 참이다. 🔑 무엇이 서면 닿는가 =
     * 드림맵·시즌 회고가 이 이력을 맥락으로 읽는 날(지금은 최신 3칸만 profiles 에서 본다). */
    [SELF_DECLARE_TAB_]: { 사유: '읽는 자리가 0이다 — 탭 축소 감시만 이 이름을 안다. 드림맵·시즌 회고가 선언의 «변화»를 맥락으로 읽는 날 닿는다(㉢ 삶 이해의 첫 재료).' },
  };
}

/* 시트층 도달의 **래칫 둘**. 형제 저장소의 래칫 셋과 같은 성질 — 내리는 것은 언제나 통과하고
 * (사유를 소비자로 바꾸면 준다) **올라가면 빨개진다.** 지연 평가 함수인 이유는 위 골격과 같다
 * (v9.135 — 톱레벨 상수는 로드 순서에 걸린다).
 *
 * · `도달0` = 도달이 0인 수집 탭 수. ⚠ 새 수집 탭을 세우면서 도달을 안 적으면 여기서 걸린다.
 *   📉 5 (2026-08-16 · 신설 · quiz_log·talk_log·voice_log·talk_index_log·self_declare_log)
 * · `손` = «사람이 눌러야만 도는» 도달 수. 갈라 세는 이유는 **다른 병**이기 때문이다 —
 *   도달0 은 「안 읽는다」이고 이쪽은 「읽는데 저절로 안 돈다」다. 한 숫자로 뭉치면 손 통로가
 *   늘어도 총합이 그대로라 조용하다(형제 장부가 못 보는 갈림 · 설계 §2).
 *   📉 1 (2026-08-16 · 신설 · teacher_gold = 의도된 사람 게이트 · 🚫자동 배치 편입 재제안) */
function 시트도달상한_() {
  return { 도달0: 5, 손: 1 };
}

/* ===================== [v9.43] 🎴 몬스터·보스 상세 카드 — "눌렀을 때 우와" =====================
 * contents의 monster·boss·worldboss 행에 '상세카드' 열(HTML)을 생성 — Glide 도감/보스 상세 화면의 Rich Text 소스.
 * 몬스터 = 그 단계의 시그니처 색(FRAME_CSS)으로 물들인 카드 + 숨쉬는 큰 이미지 + 스토리 + 진화 조건.
 * 보스 = 다크 톤 위압 카드 + 등장 대사(도발) + 격파 대사는 스포일러 방지로 숨김(격파의 순간에 스토리로 공개).
 * langColOf_ 패턴으로 열 탐색·생성(Row ID 회피) — preflightGlide 편입 + 수동 실행 가능(멱등·writeIfChanged). */
function buildMonsterDetailCards() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ct = ss.getSheetByName('contents');
  if (!ct || ct.getLastRow() < 2) return 'contents 비어 있음';
  const col = langColOf_(ct, '상세카드');
  const n = ct.getLastRow() - 1;
  const data = ct.getRange(2, 1, n, 6).getValues();
  // 몬스터 순번(임계 오름차순) → FRAME_CSS 색 매핑
  const mons = data.filter(r => r[1] === 'monster').sort((a, b) => (Number(a[5]) || 0) - (Number(b[5]) || 0));
  const monIdx = {}; mons.forEach((r, i) => { monIdx[String(r[0])] = i; });
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const out = data.map(r => {
    const type = String(r[1] || ''), nm = esc(r[2]), story = esc(r[3]), img = String(r[4] || ''), th = Number(r[5]) || 0;
    if (type === 'monster') {
      const i = monIdx[String(r[0])] || 0;
      const f = FRAME_CSS[Math.min(i, 6)], ic = FRAME_ICON[Math.min(i, 6)];
      const hero = img.indexOf('http') === 0
        ? '<img class="skBr" src="' + img + '" style="display:block;margin:0 auto;width:150px;height:150px;border-radius:20px;background:#fff;border:3px solid ' + f[1] + ';box-shadow:0 10px 26px rgba(255,107,92,.2);' + ANIM_BREATH + '"/>' // [v9.48] display:block+margin:auto — Glide Rich Text가 img를 block 처리해 text-align 중앙이 풀리던 것(왼쪽 치우침) 교정
        : '<span class="skBr" style="display:inline-block;font-size:90px;' + ANIM_BREATH + '">' + ic + '</span>';
      return [CARD_ANIM + CARD_WEBFONT + '<div style="' + CARD_FONT + 'background:linear-gradient(160deg,' + f[2] + ',#FFFFFF 45%,' + f[2] + ');border:2px solid ' + f[1] + ';border-radius:20px;padding:18px 16px;text-align:center;">' +
        '<div style="padding:6px 0 12px;">' + hero + '</div>' +
        '<div style="font-size:21px;font-weight:900;color:' + f[3] + ';">' + ic + ' ' + nm + '</div>' +
        '<div style="display:inline-block;font-size:11px;font-weight:700;color:' + f[3] + ';background:' + f[2] + ';border:1.5px solid ' + f[1] + ';border-radius:99px;padding:2px 11px;margin:6px 0 10px;">' + f[0] + ' · ' + (i + 1) + '단계</div>' +
        '<div style="background:rgba(255,255,255,.85);border-radius:14px;padding:11px 13px;font-size:13px;line-height:1.9;color:#374151;text-align:left;">' + story + '</div>' +
        '<div style="font-size:11.5px;color:#6B7280;padding-top:10px;">' + (th > 0 ? '🧠 시냅스 ' + th + 'P에서 깨어난 친구' : '🥚 처음부터 함께한 첫 친구') + ' — 매일의 연결이 다음 진화를 부른다</div>' +
        '</div>'];
    }
    if (type === 'boss' || type === 'worldboss') {
      const isW = type === 'worldboss';
      const entry = esc(String(r[3] || '').split('|')[0]);
      const hero = img.indexOf('http') === 0
        ? '<img class="skBo" src="' + img + '" style="display:block;margin:0 auto;width:150px;height:150px;border-radius:20px;background:#2A3358;border:3px solid #FF6B5C;box-shadow:0 12px 30px rgba(30,27,75,.55);' + ANIM_BOSS + '"/>' // [v9.48] 중앙 고정(위와 동일 사유)
        : '<span class="skBo" style="display:inline-block;font-size:90px;' + ANIM_BOSS + '">👾</span>';
      return [CARD_ANIM + CARD_WEBFONT + '<div style="' + CARD_FONT + 'background:linear-gradient(165deg,#0F1730,#2A3358 60%,#0F1730);border:2px solid #FF6B5C;border-radius:20px;padding:18px 16px;text-align:center;color:#F6F1E8;">' +
        '<div style="font-size:10.5px;letter-spacing:.25em;color:#E7DDC7;padding-bottom:8px;">' + (isW ? 'WORLD BOSS' : 'MONTHLY BOSS ' + (th || '') ) + '</div>' +
        '<div style="padding:2px 0 12px;">' + hero + '</div>' +
        '<div style="font-size:20px;font-weight:900;color:#FFFFFF;">' + nm + '</div>' +
        (entry ? '<div style="background:rgba(224,231,255,.10);border:1px dashed rgba(165,180,252,.5);border-radius:14px;padding:11px 13px;font-size:13px;line-height:1.85;color:#E7DDC7;margin-top:11px;font-style:italic;">“' + entry + '”</div>' : '') +
        '<div style="font-size:11.5px;color:#FF8877;padding-top:10px;">' + (isW ? '전교 크루의 힘을 합쳐야 봉인할 수 있다' : '격파의 대사는… 쓰러뜨린 크루만 듣게 된다 🤫') + '</div>' +
        '</div>'];
    }
    return null; // 대상 외 유형 — 기존 값 보존
  });
  const cur = ct.getRange(2, col, n, 1).getValues();
  let wrote = 0;
  out.forEach((v, i) => { if (v && String(cur[i][0]) !== v[0]) { cur[i][0] = v[0]; wrote++; } });
  if (wrote) ct.getRange(2, col, n, 1).setValues(cur);
  Logger.log('상세 카드: 갱신 ' + wrote + '건 (몬스터 ' + mons.length + '·보스류 ' + data.filter(r => r[1] === 'boss' || r[1] === 'worldboss').length + ') — 상세카드=' + col + '열');
  return '상세 카드 갱신 ' + wrote + '건';
}

/* ===================== [v9.42] 🎭 데모 모드 — 전 시스템을 "상용 중"처럼 시연 =====================
 * seedDemoData(): 가상 크루 8명(데모정규반·데모주말반)의 지난달+이번달 출석·포인트·문법·학업 데이터를 깔고,
 *   월간 시상·스토리북·이달의 카드·리그·레이드·콕핏까지 실제 배치로 발간 — 조립하며 모든 화면을 실물로 검증.
 * clearDemoData(): DEMO- 흔적을 전 시트에서 제거하고 산출물(스토리북 지난달호·시상·카드·지도)을 원복.
 * 실데이터 격리 3중: ①학생 ID 'DEMO-' 접두(syncProfiles·노션 보존/스킵 가드) ②반 이름 '데모' 접두
 *   (레이드·리그·통계 식별) ③시드 시각 마커(app_state '데모모드' — notices 등 시각 기반 정리). */
function seedDemoData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const t0 = Date.now(); // [v9.47] ⏱️ 시간 예산 — 배치 체인을 4.5분에서 우아하게 멈추고 1분 뒤 자동 이어하기
  { // [v9.47] ⏯️ 이어하기 — 직전 실행이 예산에서 멈췄으면(포인터 존재) 시드 ①~⑧은 건너뛰고 체인만 재개
    const chainG = getState(st, '데모시드_체인');
    if (chainG.row > 0) {
      if (getState(st, '데모모드').row < 1) { st.deleteRow(chainG.row); clearContinue_('seedDemoData'); return 'ℹ 데모 모드가 이미 해제되어 이어하기를 취소했습니다.'; }
      return runSeedChain_(ss, st, tz, ['⏯️ 이어하기 — 배치 체인 ' + (Number(chainG.val) || 0) + '단계부터 재개'], t0, Number(chainG.val) || 0);
    }
  }
  if (getState(st, '데모모드').row > 0) return '이미 데모 데이터가 있습니다 — clearDemoData() 실행 후 다시 시드하세요.';
  { // [v9.47] 마커 없는 부분 시드 흔적(직전 실행이 ①~⑧ 도중 강제 종료됨) — clearDemoData가 마커 없이도 회수한다
    const pf0 = ss.getSheetByName('profiles');
    if (pf0 && pf0.getLastRow() >= 2 && pf0.getRange(2, 1, pf0.getLastRow() - 1, 1).getValues().some(r => String(r[0]).indexOf('DEMO-') === 0))
      return '⚠ 데모 흔적은 있는데 마커가 없습니다(직전 시드가 도중에 끊김) — clearDemoData() 1회로 회수한 뒤 다시 시드하세요.';
  }
  const L = [];
  const day = k => { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - k); return d; }; // k일 전 0시(정규화 — 오후 실행 시 시각 오버플로 방지)
  const atTime = (k, h) => new Date(day(k).getTime() + h * 3600000);
  const d8 = d => Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  const ymNow = Utilities.formatDate(now, tz, 'yyyy-MM');
  const ymLast = ymShift_(ymNow, -1);
  const CLS_A = '데모정규반', CLS_B = '데모주말반';

  // ① schedule에 데모 반 2행(평일·주말 각 1 — 스트릭·브리핑·미등원 파이프라인이 실반처럼 작동)
  const sc = ss.getSheetByName('schedule');
  if (sc) {
    const have = sc.getLastRow() >= 2 ? sc.getRange(2, 1, sc.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
    const addSc = []; // [v9.95] 정원·표시명까지 채운다 — 데모 반이 실반과 다른 스키마면 데모로 검증한 화면이 실전과 어긋난다
    if (have.indexOf(CLS_A) < 0) addSc.push([CLS_A, '평일', '11:00', CLASS_CAP_DEFAULT, '데모 평일반']);
    if (have.indexOf(CLS_B) < 0) addSc.push([CLS_B, '주말', '11:00', CLASS_CAP_DEFAULT, '데모 주말반']);
    if (addSc.length) sc.getRange(sc.getLastRow() + 1, 1, addSc.length, SCHEDULE_HEADERS.length).setValues(addSc);
  }
  L.push('✓ 시간표: 데모 반 2개');

  // ② profiles 8명 — 시나리오: 01 에이스·02 성실+오늘 생일·03 진화 임박(95P 고정)·04 케어 사각·05 리텐션 🔴·06 신입·07 숙제왕·08 스킨 선택
  //   [검증 반영] 생일(+20P)과 임박(95P)을 같은 학생에 두면 생일 지급이 임박 밴드를 깨뜨림 — 역할 분리.
  const bday2 = Utilities.formatDate(now, tz, 'MM-dd'); // DEMO-02 사라 = 오늘 생일
  const P = ADMIN_EMAIL;
  const demo = [ // [id, 이름, 몽골이름, 반, 생일, email, 등록일(일 전), 레벨]
    ['DEMO-01', '바야르', 'Баяр', CLS_A, '2011-03-14', 'demo01@synk.test', 90, '중급'],
    ['DEMO-02', '사라', 'Сараа', CLS_A, '2012-' + bday2, 'demo02@synk.test', 75, '초급'],
    ['DEMO-03', '테무진', 'Тэмүжин', CLS_A, '2012-11-08', 'demo03@synk.test', 60, '초급'],
    ['DEMO-04', '오윤아', 'Оюунаа', CLS_A, '2011-11-23', 'demo04@synk.test', 80, '기초'],
    ['DEMO-05', '냠카', 'Нямка', CLS_B, '2010-05-09', 'demo05@synk.test', 70, '초급'],
    ['DEMO-06', '졸자야', 'Золзаяа', CLS_B, '2013-01-30', 'demo06@synk.test', 20, '기초'],
    ['DEMO-07', '간톨가', 'Гантулга', CLS_B, '2011-09-17', 'demo07@synk.test', 85, '초급'],
    ['DEMO-08', '에르덴', 'Эрдэнэ', CLS_B, '2012-04-05', 'demo08@synk.test', 55, '기초']
  ];
  const pf = ss.getSheetByName('profiles');
  const pfRows = demo.map(d => [d[0], d[1], d[2], 'student', d[3], d[4], d[5], '', '', '', '30만₮', d8(day(d[6])), d[1] + ' 보호자', '', day(d[6])]);
  // [검증 반영] 삽입 위치 = 실학생 블록 바로 뒤(비학생 앞) — syncProfiles의 out 순서(실학생→데모→비학생)와 물리 순서를
  //   처음부터 일치시켜, 다음 날 아침 동기화가 A~O만 재배치하며 계산열(P~CE)과 행이 어긋나는 경로를 원천 차단.
  let lastStuRow = 1;
  if (pf.getLastRow() >= 2) {
    pf.getRange(2, 1, pf.getLastRow() - 1, 4).getValues().forEach((r, i) => { if (r[0] && r[3] === 'student') lastStuRow = i + 2; });
  }
  pf.insertRowsAfter(lastStuRow, pfRows.length);
  const pfStart = lastStuRow + 1;
  pf.getRange(pfStart, 1, pfRows.length, 15).setValues(pfRows);
  pf.getRange(pfStart, 26, pfRows.length, 1).setValues(demo.map(() => [P])); // Z 보호자이메일 → 원장 수신(시연)
  if (pf.getMaxColumns() >= 51) pf.getRange(pfStart, 51, pfRows.length, 1).setValues(demo.map(d => [d[7]])); // AY 레벨(강사 뷰)
  if (pf.getMaxColumns() >= 55) pf.getRange(pfStart + 7, 55, 1, 1).setValue('뉴로'); // DEMO-08 대표몬스터 스킨 선택 시연
  L.push('✓ profiles: 데모 크루 8명');

  // ③ attendance — 반유형별 수업일만, 시나리오별 패턴 (지난달 포함 ~5주)
  const atRows = [];
  const pushAtt = (sid, k) => atRows.push(['ATD' + Utilities.formatDate(day(k), tz, 'yyyyMMdd') + '-' + sid, sid, atTime(k, 11), '출석(데모)']);
  for (let k = 35; k >= 0; k--) {
    const wd = day(k).getDay();
    if (wd >= 1 && wd <= 5) { // 평일 — 데모정규반
      pushAtt('DEMO-01', k); // 개근 에이스
      if (k % 3 !== 0) pushAtt('DEMO-02', k);
      if (k % 2 === 0 && k <= 28) pushAtt('DEMO-03', k); // [검증 반영] 6월 출석 0 — 월간 출석정산(+3P/일) 변동을 차단해 95P 고정
      if (k <= 16 && k % 2 === 1) pushAtt('DEMO-04', k); // 최근 출석 있음(케어 사각용)
    } else if (wd === 6) { // 토요일 — 데모주말반 ([v9.46] 주말반=토요일만 확정 정합)
      if (k >= 9) pushAtt('DEMO-05', k); // 9일+ 미출석 → 리텐션 🔴
      if (k <= 10) pushAtt('DEMO-06', k); // 신입 — 최근만
      pushAtt('DEMO-07', k);
      if (k % 4 !== 0) pushAtt('DEMO-08', k);
    }
  }
  const at = ss.getSheetByName('attendance');
  at.getRange(at.getLastRow() + 1, 1, atRows.length, 4).setValues(atRows);
  L.push('✓ attendance: ' + atRows.length + '행(스트릭·미출석·보드 시나리오)');

  // ④ point_logs — 지난달(시상 재료)+이번달(랭킹·왕관·레이드 재료). id 'PLD' 접두(PL 채번과 무충돌)
  let seq = 0;
  const plRows = [];
  const pushPl = (sid, pts, rs, by, d) => { const dd = (d instanceof Date && d.getHours() === 0) ? new Date(d.getTime() + 15 * 3600000) : d; plRows.push(['PLD' + (++seq), sid, pts, rs, by, dd, Utilities.formatDate(dd, tz, 'yyyy-MM')]); }; // [v9.51] 7열만 기록 — 라이브 8열은 Glide 🔒 Row ID(충돌 지뢰). 태그는 사유 접미('칭찬·태그') 방식
  const T = '김재헌';
  // 지난달: 01 챔피언(왕관 몰림 — 편중 시연)·07 숙제왕
  for (let i = 0; i < 8; i++) pushPl('DEMO-01', 10, '숙제완료', T, day(28 + i * 0.9 | 0));
  pushPl('DEMO-01', 10, '오늘의 MVP', T, day(30)); pushPl('DEMO-01', 10, '오늘의 MVP', T, day(26));
  pushPl('DEMO-01', 10, '오늘의 시냅스', T, day(33));
  for (let i = 0; i < 9; i++) pushPl('DEMO-07', 10, '숙제완료', T, day(27 + (i * 0.8 | 0)));
  pushPl('DEMO-02', 10, '숙제완료', T, day(29)); pushPl('DEMO-02', 10, '오늘의 시냅스', T, day(27));
  pushPl('DEMO-08', 10, '숙제완료', T, day(28)); // [검증 반영] DEMO-03 지난달 기록 0 — 정산·칭호 변수 원천 차단
  // 이번달: 진행 중 스토리 — 03 진화 임박(95P대), 04 무포인트(사각), 05 정지
  for (let i = 0; i < 6; i++) pushPl('DEMO-01', 10, '숙제완료', T, day(2 + i * 2));
  pushPl('DEMO-01', 10, '오늘의 MVP', T, day(0)); // 오늘 왕관 — 축하 배너·알림 시연
  pushPl('DEMO-01', 3, '칭찬·집중력', T, day(1)); pushPl('DEMO-02', 3, '칭찬·친구도움', T, day(4)); // [v9.51] 💝 '크루의 눈' 시연 재료 — 태그=사유 접미
  for (let i = 0; i < 5; i++) pushPl('DEMO-02', 10, '숙제완료', T, day(3 + i * 3));
  for (let i = 0; i < 9; i++) pushPl('DEMO-03', 10, '숙제완료', T, day(1 + i * 2)); // [검증 반영] 6월 기록·출석·생일 전부 0인 설계라 90+5=95P '고정' → 진화까지 5P(임박 브리핑·한마디 확정 발화)
  pushPl('DEMO-03', 5, '리그승리', 'SYSTEM', day(7));
  pushPl('DEMO-04', 10, '숙제완료', T, day(16)); // 마지막 포인트 16일 전 — 케어 사각 발화
  for (let i = 0; i < 7; i++) pushPl('DEMO-07', 10, '숙제완료', T, day(2 + i * 2));
  for (let i = 0; i < 4; i++) pushPl('DEMO-06', 10, '숙제완료', T, day(1 + i * 3));
  for (let i = 0; i < 5; i++) pushPl('DEMO-08', 10, '숙제완료', T, day(2 + i * 3));
  pushPl('DEMO-08', -40, '스토어·싱크 스티커', '에르덴', day(4)); // 구매 이력(잔액 차감 시연)
  const pl = ss.getSheetByName('point_logs');
  pl.getRange(pl.getLastRow() + 1, 1, plRows.length, 7).setValues(plRows); // [v9.51] 7열 — 8열(🔒 Row ID) 침범 금지
  L.push('✓ point_logs: ' + plRows.length + '행(시상·왕관·구매·편중 시나리오)');

  // ⑤ mastery_log — 01 게이트 통과(G3 9/12)·03 게이트 대기 직전 세팅
  const ml = ensureSheet(ss, 'mastery_log', MASTERY_LOG_HEADERS);
  const mlRows = [];
  GRAMMAR_BANK.forEach(g => {
    const stg = grammarStageOf_(g[0]);
    if (stg === 2) { ['DEMO-01', 'DEMO-02', 'DEMO-03', 'DEMO-07'].forEach(sid => mlRows.push([sid, g[0], '도달', d8(day(25)), d8(day(25)), 'lesson', now])); }
  });
  GRAMMAR_BANK.filter(g => grammarStageOf_(g[0]) === 3).slice(0, 9).forEach(g => mlRows.push(['DEMO-01', g[0], '도달', d8(day(12)), d8(day(6)), 'lesson', now]));
  GRAMMAR_BANK.filter(g => grammarStageOf_(g[0]) === 3).slice(0, 4).forEach(g => mlRows.push(['DEMO-03', g[0], '도달', d8(day(8)), d8(day(4)), 'lesson', now]));
  ml.getRange(ml.getLastRow() + 1, 1, mlRows.length, 7).setValues(mlRows);
  // 게이트 활성 조건(반 최근 60일 문법태그) — 마감폼 이력 1행(전개완료 마킹 = 재전개 없음)
  const tp = ss.getSheetByName('weekly_topics');
  ensureLessonCols_(tp);
  tp.getRange(tp.getLastRow() + 1, 1, 1, 12).setValues([[CLS_A, "'-고 싶다'로 소원 말하기", T, day(3), '', 'G301,G302', '도달', '', '', '', '전개완료', '전개완료']]);
  L.push('✓ mastery+마감폼 이력: 진화 게이트 활성(' + mlRows.length + '건)');

  // ⑥ academic_log — 학업추세 차트·레벨업 축하 재료
  const al = ensureSheet(ss, 'academic_log', ACADEMIC_LOG_HEADERS);
  al.getRange(al.getLastRow() + 1, 1, 8, 7).setValues([
    ['ALD1', 'DEMO-01', d8(day(65)), 'level', 2, '[DEMO]', T], ['ALD2', 'DEMO-01', d8(day(65)), 'mock', 55, '[DEMO]', T],
    ['ALD3', 'DEMO-01', d8(day(35)), 'mock', 68, '[DEMO]', T], ['ALD4', 'DEMO-01', d8(day(5)), 'level', 3, '[DEMO] 레벨업!', T],
    ['ALD5', 'DEMO-01', d8(day(5)), 'mock', 74, '[DEMO]', T], ['ALD6', 'DEMO-02', d8(day(40)), 'mock', 60, '[DEMO]', T],
    ['ALD7', 'DEMO-02', d8(day(8)), 'mock', 62, '[DEMO]', T], ['ALD8', 'DEMO-03', d8(day(20)), 'level', 1, '[DEMO]', T]
  ]);
  // ⑦ class_fuel(이번 주 연료)·world_raid(지난달 격파 이력— 지급 부작용 없는 완료형)
  const cf = ensureSheet(ss, 'class_fuel', ['class_name', '미션', '입력자', 'created_at']);
  cf.getRange(cf.getLastRow() + 1, 1, 1, 4).setValues([[CLS_A, '📚 숙제 올클리어', T, day(1)]]);
  const wr = ensureSheet(ss, 'world_raid', ['월', '보스명', 'HP', '누적데미지', '상태']);
  const wrHas = wr.getLastRow() >= 2 && wr.getRange(2, 1, wr.getLastRow() - 1, 1).getValues().some(r => String(r[0]) === ymLast);
  if (!wrHas) wr.getRange(wr.getLastRow() + 1, 1, 1, 5).setValues([[ymLast, worldBossOf(ss).name + ' (데모)', 800, 843, '격파']]); // [검증 반영] '(데모)' 마커 — clear가 값 우연 일치(HP 800) 아닌 마커로 회수
  // ⑧ 운영 시트 — 문의·결석신고·매출·리드·전당·크루 프로젝트·리포트카드 1장
  ensureSheet(ss, 'inquiries', ['student_id', '이름', '문의내용', '상태', '접수시각'])
    .appendRow(['DEMO-02', '사라 어머니', '[DEMO] 겨울방학 특강도 있을까요? 아이가 학원 가는 날만 기다려요 😊', '접수', now]);
  ensureSheet(ss, 'absence_notice', ['student_id', '반', '날짜', '사유', '등록시각'])
    .appendRow(['DEMO-03', CLS_A, d8(new Date(now.getTime() + 86400000)), '[DEMO] 병원 진료', now]);
  const pay = ensureSheet(ss, 'payments', ['student_id', '이름', '금액(만₮)', '납부일', '방법', '비고', 'created_at']);
  pay.getRange(pay.getLastRow() + 1, 1, 2, 7).setValues([
    ['DEMO-01', '바야르', 30, d8(day(6)), '계좌이체', '[DEMO]', now], ['DEMO-07', '간톨가', 84, d8(day(3)), '현금', '[DEMO] 3개월 선납', now]]);
  const ld = ensureSheet(ss, 'leads', ['날짜', '이름', '연락처', '유입경로', '추천인', '체험참석', '등록', '등록권종', '등록일', '미등록사유', '메모', '캠페인']);
  ld.getRange(ld.getLastRow() + 1, 1, 3, 12).setValues([
    [d8(day(12)), '[DEMO] 아누진', '9911-0001', '페이스북', '', 'Y', 'Y', '3개월', d8(day(9)), '', '', '7월 신학기'],
    [d8(day(8)), '[DEMO] 빌군', '9911-0002', '추천', '바야르', 'Y', 'N', '', '', '보류', '', ''],
    [d8(day(4)), '[DEMO] 사인자야', '9911-0003', '인스타', '', 'N', 'N', '', '', '시간대', '', '7월 신학기']]);
  ensureSheet(ss, 'hall_of_fame', ['연도', '이름', '반', '업적', '한마디', '사진URL'])
    .appendRow(['2025', '김철수', '졸업 크루', 'TOPIK 4급 합격 · 서울 유학', '[DEMO] SYNK에서 보낸 1년이 인생을 바꿨어요', 'https://placehold.co/400x400/3D5AFE/FFFFFF/png?text=HOF']);
  ensureSheet(ss, 'crew_projects', ['시즌', '반', '프로젝트명', '한줄소개', '결과물링크', '사진URL', '공개일', '참여크루', '비고'])
    .appendRow(['여름 시즌', CLS_A, 'K-POP 커버 무대', '나담 축제 무대에서 한국어 노래 완창', '', 'https://placehold.co/400x300/FF6B35/FFFFFF/png?text=CREW', d8(day(15)), '바야르, 사라, 테무진', '[DEMO]']);
  const rc = ensureSheet(ss, 'report_cards', ['card_id', 'student_id', '월', 'image_url', '칭호', '코멘트', 'created_at']);
  rc.appendRow(['RCD-01', 'DEMO-01', ymLast, 'https://placehold.co/600x800/3D5AFE/FFFFFF/png?text=REPORT+' + ymLast, '🧠 시냅스 챔피언', '[DEMO] 이번 달 가장 많은 연결을 만든 크루', now]);
  L.push('✓ 운영 시트 7종(문의·결석·매출·리드·전당·크루·리포트)');
  // 데모모드 마커 = 시드시각|스토리북 사전존재|월간배치 사전완료 — clear가 "데모가 만든 것"만 회수하기 위한 판별값
  const sbSheet = ss.getSheetByName('synk_stories');
  const sbPre = (sbSheet && sbSheet.getLastRow() >= 2 && sbSheet.getRange(2, 1, sbSheet.getLastRow() - 1, 1).getValues().some(r => String(r[0]) === ymLast)) ? 1 : 0;
  // [워크플로 검증 반영] 실 시스템의 매월 1일 배치가 이미 지난달 시상을 완료한 상태(키 또는 스냅샷 존재)면
  //   시드는 시상 재실행을 시도하지 않고(멱등 가드에 걸려 조용히 스킵됨 — 허위 ✓ 방지) 정직하게 고지하며,
  //   clear는 실 시스템이 만든 완료 키를 지우지 않는다.
  const snapPre = ss.getSheetByName('monthly_snapshot');
  const gbPre = (String(getState(st, '게임배치완료월').val) === ymLast ||
    (snapPre && snapPre.getLastRow() >= 2 && snapPre.getRange(2, 1, snapPre.getLastRow() - 1, 1).getValues().some(r => String(r[0]) === ymLast))) ? 1 : 0;
  // 마커 4필드: 시각|sbPre|gbPre|시드 시점의 지난달 키 — clear가 달이 바뀐 뒤 실행돼도 정확히 그 달을 회수
  setState(st, '데모모드', Utilities.formatDate(now, tz, "yyyy-MM-dd'T'HH:mm:ss") + '|' + sbPre + '|' + gbPre + '|' + ymLast);

  // ⑨ 배치 체인 — 계산→지난달 시상→스토리북→카드→지도→경영→레이드·리그→중계·보드
  //   [v9.47] runSeedChain_로 분리 + 포인터('데모시드_체인') — 6분 강제 종료가 "clearDemoData 후 처음부터"를
  //   무한 반복시키던 근본 원인 제거. 예산 도달 시 1분 뒤 자동 이어하기(수동 재실행해도 같은 지점부터).
  setState(st, '데모시드_체인', '0');
  return runSeedChain_(ss, st, tz, L, t0, 0);
}

// [v9.47] 데모 시드 배치 체인 — seedDemoData ⑨의 이어하기 가능 본체. sbPre/gbPre/기준달을 지역변수가 아니라
//   '데모모드' 마커(4필드)에서 읽으므로 재진입(수동 재실행·1분 트리거) 시에도 조건 분기가 정확히 복원된다.
function runSeedChain_(ss, st, tz, L, t0, startIdx) {
  const gM = String(getState(st, '데모모드').val).split('|');
  const sbPreC = String(gM[1] || '0') === '1';
  const gbPreC = String(gM[2] || '0') === '1';
  const ymLastC = String(gM[3] || '') || ymShift_(Utilities.formatDate(new Date(), tz, 'yyyy-MM'), -1);
  const CLS_A = '데모정규반', CLS_B = '데모주말반';
  const chain = [
    ['전체 계산', function () { calcAll(); }],
    ['생일 축하(+' + PT.생일 + 'P·학부모 메일)', function () { birthdayCheck(); }], // DEMO-02 사라 오늘 생일 — 지급·배너·브리핑 즉시 시연
    ['지난달 시상(칭호·랭킹·정산)', function () {
      if (gbPreC) { L.push('ℹ 지난달 시상은 실배치가 이미 완료(재실행 안전상 스킵) — 시상·칭호 시연은 이번 달 데이터로 확인'); return; }
      monthlyGameBatch();
    }],
    ['스토리북 발간(지난달호)', function () {
      if (sbPreC) L.push('ℹ 스토리북 지난달호는 실호가 이미 발간돼 재발간 생략(실호 보존) — 다음 달 1일 발간분으로 확인');
      const g1 = getState(st, '경영리포트발송_' + ymLastC); if (g1.row > 0) st.deleteRow(g1.row); // 경영 월보를 데모 반영판으로 재생성(멱등 키 해제)
      buildMonthlyStorybook_();
    }],
    ['이달의 카드', function () { buildMonthlyCards_(); }],
    ['여행 지도', function () { updateTravelMap_(); }],
    ['경영 월보', function () { buildExecReport_(); }],
    ['레이드·리그 생성(데모 반 직접)', function () {
      // [검증 반영] raidMonday는 "이번 주 행 존재 시 전체 스킵" 멱등 — 실반 레이드가 이미 있는 주엔 데모 반이 못 생기므로
      //   데모 반 2행을 직접 생성(실반 행 불간섭·주 키·HP=인원×28/18 동일 산식). 이번 달 월드 HP도 재적 기준으로 정합화.
      const nowR = new Date();
      const mondayR = new Date(nowR); mondayR.setDate(nowR.getDate() - ((nowR.getDay() + 6) % 7)); mondayR.setHours(0, 0, 0, 0);
      const wk = Utilities.formatDate(mondayR, tz, 'yyyy-MM-dd');
      const rd = ensureSheet(ss, 'raid', ['week', 'class_name', '목표', '달성포인트', '상태', '보상지급']);
      const haveR = {};
      if (rd.getLastRow() >= 2) rd.getRange(2, 1, rd.getLastRow() - 1, 2).getValues().forEach(r => { if (dstr(r[0], tz) === wk) haveR[String(r[1])] = 1; });
      const addR = [];
      if (!haveR[CLS_A]) addR.push([wk, CLS_A, 4 * 28, 0, '진행중', '']);
      if (!haveR[CLS_B]) addR.push([wk, CLS_B, 4 * 18, 0, '진행중', '']);
      if (addR.length) rd.getRange(rd.getLastRow() + 1, 1, addR.length, 6).setValues(addR);
      const lg = ensureSheet(ss, 'league_pairs', ['week', '반A', '반B', '상태', '결과']);
      const haveL = lg.getLastRow() >= 2 && lg.getRange(2, 1, lg.getLastRow() - 1, 3).getValues().some(r => String(r[0]) === wk && String(r[1]).indexOf('데모') === 0);
      if (!haveL) lg.getRange(lg.getLastRow() + 1, 1, 1, 5).setValues([[wk, CLS_A, CLS_B, '제안', '']]);
      const wrN = ss.getSheetByName('world_raid');
      const ymN = Utilities.formatDate(nowR, tz, 'yyyy-MM');
      const pfR = ss.getSheetByName('profiles');
      if (wrN && wrN.getLastRow() >= 2 && pfR && pfR.getLastRow() >= 2) {
        const stuN = pfR.getRange(2, 1, pfR.getLastRow() - 1, 4).getValues().filter(r => r[0] && r[3] === 'student').length;
        wrN.getRange(2, 1, wrN.getLastRow() - 1, 5).getValues().forEach((r, i) => {
          if (String(r[0]) === ymN && String(r[4]) === '진행중') wrN.getRange(i + 2, 3).setValue(Math.max(stuN, 1) * 100); // HP 100(재적1 기준)에 데모 데미지 수백이 얹히는 화면 모순 해소
        });
      }
    }],
    ['일일 전투 리포트', function () { raidStoryDaily(); }],
    ['리그 중계석', function () { if (LEAGUE_DAILY_CAST) leagueStoryDaily_(); else L.push('ℹ 리그 일일 중계는 OFF(일요일 결산만 — LEAGUE_DAILY_CAST)'); }],
    ['재계산(시상 반영)', function () { calcAll(); }],
    ['강사 지표', function () { calcTeacherStats(); }],
    ['출결 보드', function () { todayBoard_(ss); }]
  ];
  for (let i = Math.max(startIdx, 0); i < chain.length; i++) {
    if (budgetOver_(t0)) {
      setState(st, '데모시드_체인', String(i));
      scheduleContinue_('seedDemoData');
      const pauseMsg = '⏱️ 시간 예산(4.5분) 도달 — 배치 체인 ' + i + '/' + chain.length + ' 단계까지 완료.\n' + L.join('\n') +
        '\n\n💡 1분 후 자동으로 이어서 실행됩니다. 기다리기 싫으면 지금 seedDemoData ▶ 재실행 — 같은 지점부터 이어가며 중복 지급 없음(clearDemoData 불필요!).';
      Logger.log(pauseMsg);
      return pauseMsg;
    }
    try { chain[i][1](); L.push('✓ ' + chain[i][0]); } catch (e) { L.push('✗ ' + chain[i][0] + ': ' + e.message); }
    setState(st, '데모시드_체인', String(i + 1));
  }
  { const gp = getState(st, '데모시드_체인'); if (gp.row > 0) st.deleteRow(gp.row); }
  clearContinue_('seedDemoData');
  const rep = '🎭 데모 시드 완료 — 앱에서 8명의 크루가 살아 움직입니다\n' + L.join('\n') +
    '\n\n확인: 학생(DEMO-01 바야르=에이스·02 사라=오늘 생일·03 테무진=진화까지 5P 임박) · 강사(데모정규반 브리핑·왕관밸런스) · 원장(레이더 🔴 냠카·케어사각 오윤아·계기판·시상 메일)' +
    '\n격파 시연: demoRaidClearNow() · 상담→앱 검증: seedConsultDemo() · 제거: clearDemoData() 1회(⚠ 월말 전 필수).';
  Logger.log(rep);
  return rep;
}

/* [v9.44] 🧪 상담→앱 파이프라인 검증 원버튼 — 상담 스프레드시트에 [DEMO] 체험학생 1명을 실제로 입력하고
 * syncProfiles를 돌려 "상담데이터 입력 → 앱 로스터"의 전 구간(62열 매핑·수강납입 조인·created_at)을 실측 검증. */
function seedConsultDemo() {
  const book = SpreadsheetApp.openById(CONSULT_SHEET_ID);
  const src = book.getSheetByName('상담데이터입력');
  if (!src) return '상담데이터입력 탭을 찾지 못함';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  // 기존 DEMO-C1 행이 있으면 재시드 금지(중복 방지)
  if (src.getLastRow() >= 3 && src.getRange(3, 60, src.getLastRow() - 2, 1).getValues().some(r => String(r[0]) === 'DEMO-C1'))
    return '이미 DEMO-C1 상담 행이 있습니다 — clearConsultDemo() 후 재시드하세요.';
  const row = new Array(62).fill('');
  row[0] = '[DEMO] 체험학생'; row[1] = 'Туршилт'; row[2] = today; row[3] = '데모정규반'; row[4] = '2012-06-15';
  row[7] = '9900-0000'; row[8] = 'demo.trial'; row[9] = 'democ1@synk.test';
  row[12] = '[DEMO] 보호자'; row[14] = '9900-0001'; row[18] = '기초'; row[21] = '한국 유학';
  row[59] = 'DEMO-C1'; row[60] = '';
  src.getRange(src.getLastRow() + 1, 1, 1, 62).setValues([row]);
  const pay = book.getSheetByName('수강·납입');
  if (pay) {
    const pr = new Array(11).fill('');
    pr[0] = 'DEMO-C1'; pr[4] = '30만₮'; pr[10] = '재원';
    pay.getRange(Math.max(pay.getLastRow() + 1, 5), 1, 1, 11).setValues([pr]);
  }
  syncProfiles(); // 상담→앱 실제 파이프라인 가동
  const pf = ss.getSheetByName('profiles');
  const landed = pf && pf.getLastRow() >= 2 && pf.getRange(2, 1, pf.getLastRow() - 1, 1).getValues().some(r => String(r[0]) === 'DEMO-C1');
  const rep = landed
    ? '✅ 상담→앱 파이프라인 정상 — DEMO-C1 [DEMO] 체험학생이 profiles에 유입됐습니다(이름·반·이메일·보호자·created_at 확인). 검증 후 clearConsultDemo() 1회.'
    : '⚠ 상담 행은 넣었으나 profiles에 안 보임 — syncProfiles 로그·급감 가드 알림을 확인하세요.';
  Logger.log(rep);
  return rep;
}

function clearConsultDemo() {
  const book = SpreadsheetApp.openById(CONSULT_SHEET_ID);
  const src = book.getSheetByName('상담데이터입력');
  let n = 0;
  if (src && src.getLastRow() >= 3) {
    const ids = src.getRange(3, 60, src.getLastRow() - 2, 1).getValues();
    for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === 'DEMO-C1') { src.deleteRow(i + 3); n++; }
  }
  const pay = book.getSheetByName('수강·납입');
  if (pay && pay.getLastRow() >= 5) {
    const pids = pay.getRange(5, 1, pay.getLastRow() - 4, 1).getValues();
    for (let i = pids.length - 1; i >= 0; i--) if (String(pids[i][0]) === 'DEMO-C1') { pay.deleteRow(i + 5); n++; }
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) {
    const ids2 = pf.getRange(2, 1, pf.getLastRow() - 1, 1).getValues();
    for (let i = ids2.length - 1; i >= 0; i--) if (String(ids2[i][0]) === 'DEMO-C1') { pf.deleteRow(i + 2); n++; }
  }
  calcAll();
  return '🧹 상담 파이프라인 데모 제거: ' + n + '행';
}

/* [v9.44] ⚔️ 레이드·월드 격파 시뮬레이터 — "클리어했을 때 화면"을 지금 본다(데모 모드 전용).
 * 반 레이드: 데모 반 부족 데미지를 '이벤트·총력전'으로 채우고 즉시 정산(보상 +20P·결산 서사·공지·지급완료 마킹 —
 *   일요일 밤 실정산은 wasPaid 가드로 자동 스킵). 월드: 이번 달 행을 격파로 확정(다음 달 판정과 무충돌·clear가 원복). */
function demoRaidClearNow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const st = ss.getSheetByName('app_state');
  if (!st || getState(st, '데모모드').row < 1) return '데모 모드가 아닙니다 — seedDemoData() 먼저.';
  const now = new Date();
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); monday.setHours(0, 0, 0, 0);
  const weekKey = Utilities.formatDate(monday, tz, 'yyyy-MM-dd');
  const pf = ss.getSheetByName('profiles');
  const demoByCls = {};
  pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
    if (r[0] && String(r[0]).indexOf('DEMO-') === 0 && r[3] === 'student' && String(r[4] || '').indexOf('데모') === 0)
      (demoByCls[String(r[4])] = demoByCls[String(r[4])] || []).push(String(r[0]));
  });
  const L = [];
  const rd = ss.getSheetByName('raid');
  if (rd && rd.getLastRow() >= 2) {
    const data = rd.getRange(2, 1, rd.getLastRow() - 1, 6).getValues();
    data.forEach((r, i) => {
      const cls = String(r[1] || '');
      if (dstr(r[0], tz) !== weekKey || cls.indexOf('데모') !== 0 || r[5] === '지급완료') return;
      const members = demoByCls[cls] || [];
      if (!members.length) return;
      const target = Number(r[2]) || 0, got = Number(r[3]) || 0;
      const lack = Math.max(target - got, 0);
      if (lack > 0) { // 부족분을 총력전 이벤트로 분배(일일한도 가드 비대상 사유)
        const per = Math.ceil(lack / members.length);
        appendPoints(ss, members.map(sid => [sid, per, '이벤트·레이드총력전', 'SYSTEM']));
      }
      appendPoints(ss, members.map(sid => [sid, PT.레이드, '레이드보상', '시스템']));
      rd.getRange(i + 2, 4, 1, 3).setValues([[Math.max(target, got + (lack || 0)), '달성 🎉', '지급완료']]);
      const bossD = bossOfMonth(ss, Number(Utilities.formatDate(now, tz, 'M')));
      const bNm = bossD ? bossD.name : '이달의 보스';
      ensureSheet(ss, 'raid_story', ['date', 'class_name', '유형', '제목', '스토리']).appendRow([
        weekKey, cls, '결산', '⚔️ ' + cls + ' — ' + bNm + ' 격파!',
        '총력전 끝에 ' + bNm + '(HP ' + target + ')' + josa(String(target), '이', '가') + ' 무너졌다! 크루 전원의 마지막 합동 공격이 작렬한 순간, 보스는 빛이 되어 흩어졌다. 반 전원 +' + PT.레이드 + 'P 🏆']);
      addNotice(ss, '🎉 ' + cls + ' 레이드 격파!', bNm + ' 격파 성공 — ' + cls + ' 전원 +' + PT.레이드 + 'P! ' + (bossD ? '"' + bossD.win + '"' : ''));
      L.push('✓ ' + cls + ' 반 레이드 격파(부족분 ' + lack + ' 총력전 지급)');
    });
  }
  const wr = ss.getSheetByName('world_raid');
  const ymNow = Utilities.formatDate(now, tz, 'yyyy-MM');
  if (wr && wr.getLastRow() >= 2) {
    const wdata = wr.getRange(2, 1, wr.getLastRow() - 1, 5).getValues();
    wdata.forEach((r, i) => {
      if (String(r[0]) !== ymNow || String(r[4]) !== '진행중') return;
      const hp = Number(r[2]) || 0;
      wr.getRange(i + 2, 4, 1, 2).setValues([[Math.max(hp, Number(r[3]) || 0), '격파']]);
      const demoAll = Object.keys(demoByCls).reduce((a, c) => a.concat(demoByCls[c]), []);
      if (demoAll.length) appendPoints(ss, demoAll.map(sid => [sid, PT.월드, '월드레이드', 'SYSTEM']));
      const wbD = worldBossOf(ss);
      addNotice(ss, '🌍 월드 레이드 대승리! ' + wbD.name + ' 격파!', '"' + wbD.win + '" 전교 크루의 힘이 대군주를 쓰러뜨렸습니다! (데모 시연)');
      L.push('✓ 월드 레이드 격파(이번 달 행 확정 — clearDemoData가 원복)');
    });
  }
  calcAll(); // 레이드 카드(13열)·여정·기록실에 격파가 반영되게
  const rep = L.length ? '⚔️ 격파 시연 완료\n' + L.join('\n') + '\n확인: 학생 홈 레이드카드 "🏆 격파 달성!"·소식탭 공지·기록실 보스 참여' : '격파할 데모 레이드가 없습니다(raidMonday 미생성 또는 이미 지급완료).';
  Logger.log(rep);
  return rep;
}

function clearDemoData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const st = ss.getSheetByName('app_state');
  if (!st) return '데모 데이터가 없습니다(app_state 없음).';
  const g = getState(st, '데모모드');
  const hasMarker = g.row > 0;
  const L = [];
  if (!hasMarker) { // [v9.47] 마커 없는 부분 시드(①~⑧ 도중 강제 종료)도 회수 — 구 가드("키 없음" 거부)가 회수를 막던 교착 해소
    const pf0 = ss.getSheetByName('profiles');
    const anyDemo = pf0 && pf0.getLastRow() >= 2 && pf0.getRange(2, 1, pf0.getLastRow() - 1, 1).getValues().some(r => String(r[0]).indexOf('DEMO-') === 0);
    if (!anyDemo) return '데모 데이터가 없습니다(데모모드 키 없음).';
    L.push('ℹ 마커 없는 부분 시드 회수 모드 — DEMO 표식 행만 지우고 발간물·완료 키는 보존(가장 보수적)');
  }
  const gParts = hasMarker ? String(g.val).split('|') : ['', '1', '1', ''];
  const seededAt = hasMarker ? new Date(gParts[0]) : new Date(0);
  const sbPreExisted = String(gParts[1] || '0') === '1'; // 시드 전에 지난달 스토리북 실호가 있었으면 회수 금지
  const gbPreExisted = String(gParts[2] || '0') === '1'; // [검증 반영] 실배치가 만든 게임배치완료월 키면 보존
  // [검증 반영] 회수 기준 달 = "시드 시점의 지난달"(마커 4번째) — clear가 달을 넘겨 실행돼도 회수 대상이 어긋나지 않게
  const ymLast = String(gParts[3] || '') || ymShift_(Utilities.formatDate(new Date(), tz, 'yyyy-MM'), -1);
  clearContinue_('seedDemoData'); // [v9.47·리뷰 P2] seed가 일시정지 상태로 남긴 재개 트리거를 청소 시작 즉시 취소 — 청소 도중 시드가 재개돼 교차 실행되는 창 제거
  const t0 = Date.now(); // [v9.47] ⏱️ 시간 예산 — 초과 시 1분 뒤 자동 이어서 청소(삭제는 전부 재실행 안전·이미 지운 행은 매치 안 됨)
  const budgetStop_ = next => {
    if (!budgetOver_(t0)) return null;
    scheduleContinue_('clearDemoData');
    const m = '⏱️ 시간 예산(4.5분) 도달 — "' + next + '" 앞에서 안전하게 멈췄습니다.\n' + L.join('\n') +
      '\n\n💡 1분 후 자동으로 이어서 청소합니다(지금 clearDemoData ▶ 재실행해도 이어짐).';
    Logger.log(m);
    return m;
  };
  // 열 값 술어 기반 행 삭제(뒤에서부터) — [v9.47] 연속 매치를 묶어 deleteRows 1회로: 행당 API 1회 → 블록당 1회(수 배 가속).
  //   아래→위로 훑으며 블록을 만들고, 삭제는 항상 현재 탐색 위치 아래라 남은 인덱스가 흔들리지 않는다.
  const wipe = (name, pred, width) => {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;
    const w = Math.min(sh.getLastColumn(), width || sh.getLastColumn());
    const data = sh.getRange(2, 1, sh.getLastRow() - 1, w).getValues();
    let n = 0, start = -1, len = 0;
    const flush = () => { if (len > 0) { sh.deleteRows(start + 2, len); n += len; } start = -1; len = 0; };
    for (let i = data.length - 1; i >= 0; i--) {
      if (pred(data[i])) { start = i; len++; }
      else flush();
    }
    flush();
    /* [v9.241] 의도한 축소는 **기준선도 함께 내린다** — 안 그러면 데모 퇴장 다음 주 워치독이
     *   「수집 장부가 줄었다」고 외치고, 그 경보엔 따를 처방이 없다(F103). 지운 자리에서
     *   지우므로 새 수집 탭이 이 목록에 들어와도 자동으로 보호된다(손 목록이 안 생긴다). */
    if (n) 탭수축기준선지움_(name);
    if (n) L.push('✓ ' + name + ' ' + n + '행');
  };
  const isDemoSid = r => String(r[0] || '').indexOf('DEMO-') === 0;
  const hasDemoCls = s => String(s || '').indexOf('데모') === 0;
  wipe('profiles', isDemoSid, 4);
  wipe('attendance', r => String(r[1] || '').indexOf('DEMO-') === 0, 2);
  wipe('point_logs', r => String(r[1] || '').indexOf('DEMO-') === 0, 2);
  wipe('point_logs_archive', r => String(r[1] || '').indexOf('DEMO-') === 0, 2);
  { const bMsg = budgetStop_('mastery_log 회수'); if (bMsg) return bMsg; } // [v9.47] 체크포인트 ① — 큰 로그 시트 뒤
  wipe('mastery_log', isDemoSid, 1);
  wipe('academic_log', r => String(r[1] || '').indexOf('DEMO-') === 0, 2);
  wipe('monthly_snapshot', r => String(r[1] || '').indexOf('DEMO-') === 0, 2);
  wipe('titles', r => String(r[1] || '').indexOf('DEMO-') === 0, 2);
  wipe('story', r => String(r[1] || '').indexOf('DEMO-') === 0, 2);
  wipe('achievements', isDemoSid, 1);
  wipe('synk_cards', r => String(r[1] || '').indexOf('DEMO-') === 0, 2);
  wipe('report_cards', r => String(r[1] || '').indexOf('DEMO-') === 0, 2);
  wipe('inquiries', isDemoSid, 1);
  wipe('absence_notice', isDemoSid, 1);
  wipe('payments', isDemoSid, 1);
  wipe('leads', r => String(r[1] || '').indexOf('[DEMO]') === 0, 2);
  wipe('hall_of_fame', r => String(r[4] || '').indexOf('[DEMO]') === 0, 5);
  wipe('crew_projects', r => String(r[8] || '').indexOf('[DEMO]') === 0, 9);
  { const bMsg = budgetStop_('weekly_topics 회수'); if (bMsg) return bMsg; } // [v9.47] 체크포인트 ② — 운영 시트 뒤
  wipe('weekly_topics', r => hasDemoCls(r[0]), 1);
  wipe('class_fuel', r => hasDemoCls(r[0]), 1);
  wipe('raid', r => hasDemoCls(r[1]), 2);
  wipe('league_pairs', r => hasDemoCls(r[1]) || hasDemoCls(r[2]), 3);
  wipe('raid_story', r => hasDemoCls(r[1]), 2);
  wipe('class_stats', r => hasDemoCls(r[0]), 1);
  // [v9.87] A열이 반명 → 강사명으로 바뀌어 '데모' 접두만으론 못 잡는다(데모 반 담당 강사 행·'(미지정) 데모…' 행 모두).
  //   담당반(I열)에 데모 반이 하나라도 있으면 그 행은 데모 오염분 — 지워도 다음 calcTeacherStats가 실데이터로 재생성한다.
  wipe('teacher_stats', r => hasDemoCls(r[0]) || String(r[8] || '').split(',').some(c => hasDemoCls(c.trim())), TEACHER_STATS_HEADERS.length);
  wipe('world_raid', r => String(r[1] || '').indexOf('(데모)') > -1, 2); // [검증 반영] '(데모)' 마커 행만 — 재적 8명인 달의 실 이력(HP 800 우연 일치) 오폭 차단
  { // [v9.44] demoRaidClearNow가 이번 달 월드를 '격파'로 확정했다면 '진행중'으로 원복 — 다음 calcAll이 실데미지로 재계산
    const wrC = ss.getSheetByName('world_raid');
    const ymNowC = Utilities.formatDate(new Date(), tz, 'yyyy-MM');
    if (wrC && wrC.getLastRow() >= 2) {
      wrC.getRange(2, 1, wrC.getLastRow() - 1, 5).getValues().forEach((r, i) => {
        if (String(r[0]) === ymNowC && String(r[4]) === '격파') wrC.getRange(i + 2, 4, 1, 2).setValues([[0, '진행중']]);
      });
    }
  }
  if (!sbPreExisted) wipe('synk_stories', r => String(r[0]) === ymLast, 1); // 데모가 발간시킨 지난달호만 회수(실호 사전존재 시 보존)
  wipe('league_history', r => hasDemoCls(r[2]) || hasDemoCls(r[4]), 6); // [검증 반영] 월 기준→데모 반명 기준(챔피언·준우승) — 실 월간 기록 오폭 차단
  { // notices — 시드 이후 생성분(발간·리그·시상 공지) 일괄 회수: created_at 헤더 탐색
    const nt = ss.getSheetByName('notices');
    if (nt && nt.getLastRow() >= 2) {
      const heads = nt.getRange(1, 1, 1, nt.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase());
      let iC = -1;
      ['created_at', 'date', '날짜', '작성일'].forEach(c => { if (iC < 0) iC = heads.indexOf(c); });
      if (iC > -1) {
        const dataN = nt.getRange(2, 1, nt.getLastRow() - 1, nt.getLastColumn()).getValues();
        let n = 0;
        // [워크플로 검증 반영] 데모 "연관" 조건 필수 — 시각+이모지 접두만으로는 데모 기간 중 실반이 만든
        //   정당한 자동 공지(레이드 성공·보스 등장 등)까지 지운다. 삭제 조건 = 시드 이후 AND (
        //   ①제목·본문에 '데모' 포함(데모 반 공지·월드 시연 공지) OR ②데모가 발간시킨 산출물의 공지
        //   (스토리북 📖 = sbPre 0일 때만 · 시상/보스 🏆⚔️ = gbPre 0일 때만) ). 지운 제목은 로그로 고지.
        let iT2 = -1, iB2 = -1;
        ['title', 'title_ko', '제목'].forEach(c => { if (iT2 < 0) iT2 = heads.indexOf(c); });
        ['body', 'body_ko', '내용', '본문'].forEach(c => { if (iB2 < 0) iB2 = heads.indexOf(c); });
        const wiped = [];
        for (let i = dataN.length - 1; i >= 0; i--) {
          const dv = dataN[i][iC];
          const dd = dv instanceof Date ? dv : (dv ? new Date(dv) : null);
          if (!dd || isNaN(dd.getTime()) || dd < seededAt) continue;
          const tt = iT2 > -1 ? String(dataN[i][iT2] || '') : '';
          const bb = iB2 > -1 ? String(dataN[i][iB2] || '') : '';
          const demoTouched = (tt + bb).indexOf('데모') > -1;
          const demoIssue = (!sbPreExisted && tt.indexOf('📖') === 0) || (!gbPreExisted && (tt.indexOf('🏆') === 0 || tt.indexOf('⚔️') === 0));
          if (demoTouched || demoIssue) { wiped.push(tt.slice(0, 30)); nt.deleteRow(i + 2); n++; }
        }
        if (n) L.push('✓ notices ' + n + '행(데모 연관만): ' + wiped.join(' / '));
      }
    }
  }
  { // schedule 데모 반 제거 + 지난달 배치 키 원복([v9.47] '데모모드' 마커 삭제는 맨 끝으로 — 예산 중단 시 재진입 경로 보존)
    const sc = ss.getSheetByName('schedule');
    if (sc && sc.getLastRow() >= 2) {
      const dataS = sc.getRange(2, 1, sc.getLastRow() - 1, 1).getValues();
      for (let i = dataS.length - 1; i >= 0; i--) if (hasDemoCls(dataS[i][0])) sc.deleteRow(i + 2);
    }
    { const gg = getState(st, '경영리포트발송_' + ymLast); if (gg.row > 0) st.deleteRow(gg.row); } // 경영 월보를 제거 반영판으로 재생성
    // [검증 반영] 전호주연은 "데모가 스토리북을 실제로 발간했을 때만" 삭제 — 실 발간이 기록한 실학생 주연 가드를 보존
    if (!sbPreExisted) { const gj = getState(st, '전호주연'); if (gj.row > 0) st.deleteRow(gj.row); }
    if (!gbPreExisted) { const gb = getState(st, '게임배치완료월'); if (gb.row > 0 && String(gb.val) === ymLast) st.deleteRow(gb.row); } // [검증 반영] 실배치 키는 보존
    const sb = getState(st, '스토리북발간월'); if (sb.row > 0 && String(sb.val) === ymLast) st.deleteRow(sb.row);
  }
  { const bMsg = budgetStop_('원복 재계산 5종'); if (bMsg) return bMsg; } // [v9.47] 체크포인트 ③ — 원복은 통으로 무거움
  const run = (nm, fn) => { try { fn(); L.push('✓ ' + nm + ' 원복'); } catch (e) { L.push('✗ ' + nm + ': ' + e.message); } };
  run('여행 지도', updateTravelMap_);
  run('경영 월보', buildExecReport_);
  run('전체 재계산', calcAll);
  run('강사 지표', calcTeacherStats);
  run('출결 보드', function () { todayBoard_(ss); });
  { // [v9.47] 마커·이어하기 정리는 맨 마지막 — 여기 도달 = 완주. 중간에 끊겼다면 마커가 남아 재실행이 정상 경로로 이어간다
    ['데모모드', '데모시드_체인'].forEach(k => { const gg = getState(st, k); if (gg.row > 0) st.deleteRow(gg.row); });
    clearContinue_('clearDemoData'); clearContinue_('seedDemoData');
  }
  const rep = '🧹 데모 데이터 제거 완료\n' + L.join('\n');
  Logger.log(rep);
  return rep;
}

function bootstrapSynk() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // 0단계: 데이터 시트 골격 — sheetSkeleton_()(모듈 정본)으로 재건. 이 목록이 곧 SYNK의 시트 지도입니다(실데이터는 백업에서 복원).
  sheetSkeleton_().forEach(k => ensureSheet(ss, k[0], k[1]));
  const steps = [
    ['시간표·반 구조', setupSchedule], ['스토어', setupStore],
    ['몬스터 7', setupMonsters], ['보스 12 + 대군주', setupBosses], ['시즌 12', setupSeasons],
    ['브레인팁 30', setupBrainTips], ['학부모 라벨', setupParentLabels], ['크루 응원', setupTeacherCheers],
    ['연료 미션', setupFuelMissions], ['칭호 설화', setupTitleLore], ['워밍업 퀴즈', setupQuiz],
    ['숙제 210', setupHomework], ['학업 로그', setupAcademic], // [v9.18] 학업 성장 축 시트 재건 편입
    ['문법 뱅크 72', setupGrammarBank], // [v9.36] 진화 게이트 문법 커리큘럼(contents type='grammar') 재건
    ['수업 입력 구조', setupClassroomInputs], // [v9.38] weekly_topics F~L 승격 + attendance_batch·mastery_log·student_errors·teacher_checkins 정규화
    ['온보딩 카드', setupOnboarding] // [v9.38] 역할별 홈 안내(재건 목록 누락분 보강)
  ];
  const log = [];
  steps.forEach(s => { try { s[1](); log.push('✓ ' + s[0]); } catch (e) { log.push('✗ ' + s[0] + ': ' + e.message); } });
  try { worldRaidMonthly_(); log.push('✓ 월드 보스 소환'); } catch (e) { log.push('✗ 월드: ' + e.message); }
  try { calcAll(); log.push('✓ 전체 계산 1회'); } catch (e) { log.push('✗ calcAll: ' + e.message); }
  // [v9.37] 재건 직후 시스템 매니페스트 1장 — 실측 스냅샷(진단용). 실패해도 '⚠'로만 남겨 재건 성공 판정엔 영향 없음
  try { buildSystemManifest(); log.push('✓ 시스템 매니페스트'); } catch (e) { log.push('⚠ 매니페스트 스킵: ' + e.message); }
  let cnt = 0;
  const ct = ss.getSheetByName('contents');
  if (ct && ct.getLastRow() >= 2) cnt = ct.getLastRow() - 1;
  const rebuildFailed = log.some(line => line.indexOf('✗') === 0);
  const summary = (rebuildFailed ? 'SYNK OS 재건 일부 실패' : 'SYNK OS 재건 완료') +
    ' — 시트 ' + ss.getSheets().length + '장 · 콘텐츠 ' + cnt + '개\n' + log.join('\n') +
    '\n\n다음 단계: resetAllTriggers() 1회 실행(트리거 통합 재설치) → 데이터 복원(백업 폴더) → Glide 연결';
  Logger.log(summary);
  return summary;
}

/* ===================== [v9.40] 🛫 Glide 조립 사전점검 — 원버튼 준비+자동복구+진단 =====================
 * 새 Glide 앱 조립 전 이 함수 하나만 실행한다: 시트 골격·입력 시트·콘텐츠·월간 산출물·계산을 전부
 * 자동으로 채우고(멱등), 사람이 해야 하는 것(반 배정·이메일·가족 연결)만 ⚠로 남긴다.
 * [v9.40 개조 이유] 구 버전은 콘텐츠 구멍을 "setupXxx 실행" 경고로만 남겼고, 그 수동 실행이 누락돼
 *   숙제 0/210·연료 0/6·시즌 0/12·팁 0/30·문법 57/72 상태로 조립이 진행됐다(기능 다수 전멸의 최대 원인).
 * ⚠ 파괴 호출 없음 — setupSchedule(시트를 통째로 정본 24반으로 리셋함 — v9.102)은 절대 부르지 않는다.
 *   [v9.95] 표시명(각 반이 지은 이름)은 재실행에도 보존되지만, 수기로 추가·수정한 반·시각은 그대로 날아간다.
 *   콘텐츠 자동 복구는 "개수가 기대와 다른 유형만" 재설치한다(다른 유형·Row ID·행 순서 보존).
 * 사용법: 편집기에서 preflightGlide 선택 → ▶실행 → 로그의 ⚠ 줄을 하나씩 해소 → ⚠ 0이면 조립 시작. */
function preflightGlide() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const L = [];
  const ok = m => L.push('✅ ' + m);
  const warn = m => L.push('⚠ ' + m);
  // [v9.47] ⏱️ 시간 예산 — 첫 실행(콘텐츠 수백 행+번역+계산)이 6분 강제 종료로 "중간에 죽던" 것을,
  //   4.5분에서 우아하게 멈추고 1분 뒤 자동 이어하기로 교체. 전 단계 멱등이라 몇 번을 이어가도 안전.
  const t0 = Date.now();
  let pausedP = false;
  const ensureBudget = next => {
    if (pausedP) return false;
    if (!budgetOver_(t0)) return true;
    pausedP = true;
    warn('⏱️ 시간 예산(4.5분) 도달 — "' + next + '"부터의 무거운 단계는 1분 후 자동으로 이어집니다(지금 preflightGlide ▶ 재실행해도 이어짐 · 전부 멱등이라 안전)');
    scheduleContinue_('preflightGlide');
    return false;
  };

  // 0) 안전 셋업(전부 멱등): 시트 골격 + 입력 시트·열 + 온보딩 + 학업 로그
  try { const skel = sheetSkeleton_(); skel.forEach(k => ensureSheet(ss, k[0], k[1])); ok('시트 골격 ' + skel.length + '종 보장(누락분만 생성 — 기존 시트·데이터 무해)'); } catch (e) { warn('시트 골격 보장 실패: ' + e.message); }
  try { setupClassroomInputs(); ok('입력 시트·열 보장(setupClassroomInputs)'); } catch (e) { warn('setupClassroomInputs 실패: ' + e.message); }
  try { setupOnboarding(); ok('온보딩 카드(setupOnboarding)'); } catch (e) { warn('setupOnboarding 실패: ' + e.message); }
  try { setupAcademic(); ok('학업 로그(academic_log) 보장 — 강사 급수·모의점수 입력처'); } catch (e) { warn('setupAcademic 실패: ' + e.message); }

  // 0.5) [v9.40] 콘텐츠 자동 복구 — 유형별 실측이 기대(CONTENT_EXPECT)와 다르면 해당 셋업을 자동 실행.
  //   구 preflight는 "setupXxx 1회 실행" 경고만 남겼고, 그 수동 실행이 누락돼 숙제(0/210)·연료(0/6)·시즌(0/12)·
  //   팁(0/30)·문법(57/72)이 전멸 상태였다(2026-07-19 실측 — 조립 실패의 최대 원인). replaceContentType은
  //   다른 유형 행을 보존하므로 안전하고, 재설치 유형의 몽골어 초벌 번역은 아래 translateContents가 다시 채운다.
  try {
    const ctA = ss.getSheetByName('contents');
    const censusA = {};
    if (ctA && ctA.getLastRow() >= 2) ctA.getRange(2, 1, ctA.getLastRow() - 1, 2).getValues().forEach(r => { const t = String(r[1] || ''); if (t) censusA[t] = (censusA[t] || 0) + 1; });
    const ranFns = {}, fixedC = [];
    Object.keys(CONTENT_EXPECT).forEach(tp => {
      const have = censusA[tp] || 0;
      if (have === CONTENT_EXPECT[tp]) return;
      // [리뷰 H1] 커스텀 보유 유형(monster·store·boss·worldboss)은 0개일 때만 자동 재건 — 부분 불일치는
      //   유호님 커스터마이즈일 수 있어 자동 재설치가 이미지 URL 등 시트 값을 소거하므로 경고로만 남긴다.
      if (CONTENT_CUSTOM_TYPES[tp] && have > 0) {
        warn("contents '" + tp + "' " + have + '/' + CONTENT_EXPECT[tp] + ' — 커스텀 가능 유형이라 자동 복구 안 함. 의도한 편집이면 무시, 재건하려면 ' + String((contentSetupOf_(tp) || {}).name || '') + ' 수동 실행(⚠ 이미지 URL 등 시트 커스텀이 코드 기본값으로 리셋됨)');
        return;
      }
      const fn = contentSetupOf_(tp);
      if (!fn) return;
      if (!ensureBudget("contents '" + tp + "' 자동 복구")) return; // [v9.47] 유형 단위 체크포인트
      const fname = String(fn.name || tp);
      if (ranFns[fname]) return; // 한 셋업이 여러 유형 담당(setupGrammarBank=grammar+reach 등) — 1회만
      ranFns[fname] = 1;
      try { fn(); fixedC.push(tp + ' ' + have + '→' + CONTENT_EXPECT[tp]); }
      catch (e) { warn('콘텐츠 자동 복구 실패 ' + fname + ': ' + e.message); }
    });
    if (fixedC.length) {
      ok('콘텐츠 자동 복구 실행: ' + fixedC.join(' · '));
      try { setupPlaceholderImages(); ok('빈 이미지 플레이스홀더 채움(기존 URL 보존)'); } catch (e) { warn('플레이스홀더 실패: ' + e.message); }
      // 몽골어 재주입 — 숙제·퀴즈·팁 340행은 내장 큐레이션(injectMongolianContents·멱등 upsert)이 정본,
      // monster·season 등 잔여는 translateContents 기계 초벌(60행/회 — 커버 유형이 적어 보통 1회로 끝)
      if (ensureBudget('몽골어 큐레이션 340행')) { try { injectMongolianContents(); ok('몽골어 큐레이션 340행 주입(숙제·퀴즈·팁 — injectMongolianContents)'); } catch (e) { warn('몽골어 큐레이션 주입 실패: ' + e.message); } }
      if (ensureBudget('잔여 초벌 번역')) { try { translateContents(); ok('잔여 유형 초벌 번역 1회(translateContents) — 로그에 남은 행이 있으면 재실행 또는 매일 밤 자동 60행'); } catch (e) { warn('초벌 번역 실패(매일 밤 자동 60행이 이어서 채움): ' + e.message); } }
    } else ok('콘텐츠 유형별 개수 전부 기대치와 일치');
  } catch (e) { warn('콘텐츠 자동 복구 단계 실패: ' + e.message); }

  // 0.7) [v9.40] 월간 산출물 사전 생성 — 월드보스 이번 달 소환 + 원장 콕핏 월간 카드 2종(전부 멱등·아카이브 등 부작용 없음)
  if (ensureBudget('월간 산출물 사전 생성')) {
    try { worldRaidMonthly_(); ok('월드 레이드 이번 달 소환 확인(world_raid)'); } catch (e) { warn('worldRaidMonthly 실패: ' + e.message); }
    try { buildExecReport_(); updateTravelMap_(); ok('콕핏 월간 카드 2종(경영리포트HTML·여행지도HTML) 생성 확인'); } catch (e) { warn('콕핏 월간 카드 실패: ' + e.message); }
  }

  if (ensureBudget('전체 계산(calcAll)')) { try { calcAll(); ok('전체 계산 1회(calcAll) — profiles 카드열·class_stats 9~13열·오늘의숙제/퀴즈/팁/보스 키 갱신'); } catch (e) { warn('calcAll 실패: ' + e.message); } }
  if (ensureBudget('강사 지표')) { try { calcTeacherStats(); ok('강사 지표 갱신(teacher_stats 8열 정규화)'); } catch (e) { warn('calcTeacherStats 실패: ' + e.message); } }
  if (ensureBudget('몬스터 상세 카드')) { try { buildMonsterDetailCards(); ok('몬스터·보스 상세 카드(contents 상세카드 열) — 숨쉬는 단계색 카드'); } catch (e) { warn('상세 카드 실패: ' + e.message); } }

  // 1) app_state 중복 키 정리 — 같은 key 2행+면 첫 행만 유지(getState가 첫 행만 읽어 뒷행은 죽은 데이터.
  //    라이브 실측(2026-07-18): '상담폼ID' 2행 존재 → 뒷행이 혼동 유발)
  try {
    const st = ensureSheet(ss, 'app_state', ['key', 'value']);
    const lastS = st.getLastRow();
    if (lastS >= 2) {
      const keys = st.getRange(1, 1, lastS, 1).getValues();
      const seenK = {}; const del = [];
      keys.forEach((r, i) => {
        const k = String(r[0] || '');
        if (!k) return;
        if (seenK[k]) del.push(i + 1); else seenK[k] = 1;
      });
      del.reverse().forEach(rw => st.deleteRow(rw));
      if (del.length) ok('app_state 중복 키 ' + del.length + '행 정리(첫 행 유지)');
      else ok('app_state 중복 키 없음');
    }
  } catch (e) { warn('app_state 정리 실패: ' + e.message); }

  // 2) profiles 진단 — 로그인·반배정·가족연결 차단 요인
  const pf = ss.getSheetByName('profiles');
  const ROLES = { student: 1, parent: 1, teacher: 1, director: 1 };
  const cnt = { student: 0, parent: 0, teacher: 0, director: 0 };
  const noClassStu = [], noClassTea = [], noParentOf = [], badEmail = [], badRole = [];
  const emailSeen = {}, emailDup = [];
  if (pf && pf.getLastRow() >= 2) {
    pf.getRange(2, 1, pf.getLastRow() - 1, 10).getValues().forEach(r => {
      if (!r[0]) return;
      const role = String(r[3] || ''), nm = (r[1] || r[0]);
      if (ROLES[role]) cnt[role]++; else { badRole.push(nm + '(' + (role || '빈값') + ')'); return; }
      const em = String(r[6] || '').trim();
      if (!em || em.indexOf('@') < 1) badEmail.push(nm + (em ? '(' + em + ')' : ''));
      else { if (emailSeen[em]) emailDup.push(em); emailSeen[em] = 1; }
      if (role === 'student' && !String(r[4] || '').trim()) noClassStu.push(nm);
      if (role === 'teacher' && !String(r[4] || '').trim()) noClassTea.push(nm);
      if (role === 'parent' && !String(r[9] || '').trim()) noParentOf.push(nm);
    });
  }
  L.push('— profiles: 학생 ' + cnt.student + ' · 학부모 ' + cnt.parent + ' · 강사 ' + cnt.teacher + ' · 원장 ' + cnt.director);
  if (badRole.length) warn('알 수 없는 role(탭 Visibility 전멸): ' + badRole.join(', ') + ' → student/parent/teacher/director만 유효');
  { // [v9.77] 위 루프는 !r[0] 스킵이라 유령 행·중복 ID를 구조적으로 못 본다 — 코어 스캔으로 보강
    const pi = profilesIntegrityScan_(ss);
    if (pi.ghost.length) warn('유령 행(user_id 공란인데 내용 있음 — 앱 Add/수기 흔적, 어떤 집계에도 안 잡힘): ' + pi.ghost.join(', ') + ' → 행 삭제 또는 user_id 채움');
    if (pi.dupId.length) warn('user_id 중복(로그인·카드열이 첫 행만 연결): ' + pi.dupId.join(', ') + ' → 중복 행 정리');
    if (!pi.ghost.length && !pi.dupId.length) ok('유령 행·중복 user_id 없음');
  }
  if (badEmail.length) warn('이메일 없음/형식 오류(그 사람 로그인 불가): ' + badEmail.join(', '));
  if (emailDup.length) warn('이메일 중복(로그인 시 첫 행만 연결됨): ' + emailDup.join(', '));
  if (noClassStu.length) warn('반 미배정 학생(강사 반 리스트·반 통계·레이드에 안 뜸): ' + noClassStu.join(', ') + ' → 상담시트 "반" 열 입력, 내일 아침 자동 반영(즉시 반영 = syncProfiles 실행 후 preflightGlide 재실행)');
  else if (cnt.student) ok('학생 전원 반 배정됨');
  if (noClassTea.length) warn('담당 반 없는 강사(수업 브리핑·미등원 메일 라우팅 불가): ' + noClassTea.join(', ') + ' → profiles E열(class_name)에 담당 반 직접 입력(여러 반은 쉼표: 정규반1,정규반2)');
  if (noParentOf.length) warn('자녀 미연결 학부모("우리 아이" 탭이 빔): ' + noParentOf.join(', ') + ' → profiles J열(parent_of)에 자녀 user_id 직접 입력(예: SYNK-001)');
  { // [v9.82] 결석 사전신고 무결성 — student_id가 profiles와 정확히 일치해야 미출석 제외·강사 브리핑·접수 카드가 작동.
    //   다자녀 parent_of('A,B')가 통째로 기록되면 엔진 3곳이 조용히 불발하던 실결함의 회귀 장치(폼은 자녀 Choice로 재조립).
    const anP = ss.getSheetByName('absence_notice');
    if (anP && anP.getLastRow() >= 2) {
      const idsP = {};
      if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 1).getValues().forEach(r => { if (r[0]) idsP[String(r[0]).trim()] = 1; });
      const badAb = [];
      anP.getRange(2, 1, anP.getLastRow() - 1, 1).getValues().forEach((r, i) => {
        const v = String(r[0] || '').trim();
        if (v && (v.indexOf(',') > -1 || !idsP[v])) badAb.push('행' + (i + 2) + '(' + v.slice(0, 24) + ')');
      });
      if (badAb.length) warn('결석 신고 student_id 불일치 ' + badAb.length + '건 — 엔진이 무시함(알림 억제·브리핑·카드 전부 불발). 폼 "자녀"를 Choice(value=user_id)로 재조립: ' + badAb.slice(0, 5).join(', '));
      else ok('결석 사전신고 student_id 전건 유효');
    }
  }
  // [v9.40] 잔액 음수 검사 — 구매 버튼에 잔액 조건이 없으면 마이너스 구매가 가능하다(2026-07-19 실측: SYNK-001 잔액 -35)
  if (pf && pf.getLastRow() >= 2 && pf.getMaxColumns() >= 43) {
    const negBal = [];
    const balV = pf.getRange(2, 43, pf.getLastRow() - 1, 1).getValues();
    pf.getRange(2, 1, pf.getLastRow() - 1, 4).getValues().forEach((r, i) => {
      if (r[0] && r[3] === 'student' && Number(balV[i] && balV[i][0]) < 0) negBal.push((r[1] || r[0]) + '(' + balV[i][0] + 'P)');
    });
    if (negBal.length) warn('잔액 음수 학생(스토어 과소비 이력): ' + negBal.join(', ') + ' → 테스트 구매였다면 point_logs의 해당 음수 행을 지우세요. 조립 시 구매 버튼 Visibility에 "잔액 ≥ 가격" 조건 필수(가이드 참조)');
  }

  // 3) 학생 반 이름 ↔ schedule 대조(오타·미등록 반 검출)
  const sc = ss.getSheetByName('schedule');
  const schSet = {};
  if (sc && sc.getLastRow() >= 2) sc.getRange(2, 1, sc.getLastRow() - 1, 1).getValues().forEach(r => { if (r[0]) schSet[String(r[0]).trim()] = 1; });
  const offSched = [];
  if (pf && pf.getLastRow() >= 2) {
    pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
      if (!r[0] || String(r[3]) !== 'student') return;
      const cn = String(r[4] || '').trim();
      if (cn && !schSet[cn]) offSched.push((r[1] || r[0]) + '→' + cn);
    });
  }
  if (offSched.length) warn('시간표(schedule)에 없는 반 이름(스트릭·미등원·수업 브리핑 오작동): ' + offSched.join(', '));
  else ok('학생 반 이름 전부 시간표와 일치');

  { // [v9.75] 수강 만료 안내(v9.72) 침묵 감시 — enrollments는 유호님 수기 입력 시트라, 학생이 있는데 0행이면
    //   D-14/D-3 안내가 영원히 안 나간다(코드는 정상인데 아무도 모르는 상태 = v9.61 폼 미생성 감시와 같은 계급).
    const en = ss.getSheetByName('enrollments');
    const enRows = en && en.getLastRow() >= 2 ? en.getLastRow() - 1 : 0;
    const stuN75 = cnt.student; // 위 로스터 점검이 이미 센 값 재사용(시트 재읽기 0)
    if (!en) warn('enrollments 시트 없음 — 내일 아침 자동 생성되지만, 수강 만료 안내를 쓰려면 시작일·개월수를 넣어야 합니다(실행지 v973 A-2)');
    else if (stuN75 > 0 && !enRows) warn('enrollments 비어 있음(학생 ' + stuN75 + '명) — 수강 만료 D-14/D-3 학부모 안내가 발송되지 않습니다. student_id·시작일·개월수만 넣으면 만료일은 자동 계산됩니다');
    else if (enRows) ok('수강 등록 ' + enRows + '건 — 만료 D-14/D-3 안내 가동 중');
  }

  { // [v9.89] 결석 추적 침묵 감시 — checkNoShow는 "당일 그 반 출석 0건이면 스킵"이라, 강사가 출석 1탭을
    //   안 하면 판정 창 자체가 안 열린다. 그러면 absence_followup은 계속 0행이고 「결석 복귀율」(등급 심사
    //   20점 · 앱 자동 채점)은 0점이 아니라 무데이터가 된다. 코드는 정상인데 아무도 모르는 상태 = v9.75 계급.
    const af80 = ss.getSheetByName('absence_followup');
    const afRows = af80 && af80.getLastRow() >= 2 ? af80.getLastRow() - 1 : 0;
    const atSh80 = ss.getSheetByName('attendance');
    const atRows80 = atSh80 && atSh80.getLastRow() >= 2 ? atSh80.getLastRow() - 1 : 0;
    if (!af80) warn('absence_followup 시트 없음 — 다음 미등원 감지 때 자동 생성되지만, 그 전까지 결석 복귀율은 측정되지 않습니다');
    else if (cnt.student > 0 && !atRows80) warn('attendance 0건(학생 ' + cnt.student + '명) — 출석 1탭이 안 들어오면 결석 감지 창 자체가 안 열립니다(결석 복귀율 측정 불가). 강사 출석 1탭 정착이 이 지표의 전제입니다');
    else if (cnt.student > 0 && atRows80 && !afRows) warn('출석은 들어오는데(' + atRows80 + '건) 결석 감지 0건 — 전원 개근이면 정상이지만, 반 단위로 출석 1탭이 빠진 날이 있는지 확인하세요(그 반은 결석 판정이 스킵됩니다)');
    else if (afRows) ok('결석 추적 ' + afRows + '행 — 복귀 자동 판정·24시간 연락 알림 가동 중');
  }

  // 4) class_stats — 강사 "오늘의 반" 데이터 존재 여부
  const cs = ss.getSheetByName('class_stats');
  const csRows = cs && cs.getLastRow() >= 2 ? cs.getLastRow() - 1 : 0;
  if (csRows) ok('class_stats ' + csRows + '개 반 집계됨(강사 팩 9~13열 포함)');
  else warn('class_stats 비어 있음(강사 "오늘의 반" 탭이 빔) — 반 배정 해소 후 preflightGlide 재실행');

  // 5) contents 유형 개수 — [v9.40] 자동 복구(0.5단계) 후 재실측. 여전히 불일치면 해당 셋업 로그 확인 필요.
  const ct = ss.getSheetByName('contents');
  const census = {};
  if (ct && ct.getLastRow() >= 2) ct.getRange(2, 1, ct.getLastRow() - 1, 2).getValues().forEach(r => { const t = String(r[1] || ''); if (t) census[t] = (census[t] || 0) + 1; });
  L.push('— contents: ' + (Object.keys(census).length ? Object.keys(census).sort().map(t => t + ' ' + census[t]).join(' · ') : '비어 있음'));
  Object.keys(CONTENT_EXPECT).forEach(tp => {
    if ((census[tp] || 0) !== CONTENT_EXPECT[tp]) warn("contents '" + tp + "' " + (census[tp] || 0) + '/' + CONTENT_EXPECT[tp] + ' — 자동 복구 후에도 불일치. 위 자동 복구 로그(실패 사유)를 확인하세요');
  });

  // 6) app_state 필수 키 — [v9.40] 숙제·팁 키 편입(calcAll 콜드스타트 시딩이 채웠어야 정상)
  const st6 = ss.getSheetByName('app_state');
  if (st6) {
    ['리텐션레이더HTML', '케어사각HTML', '오늘의퀴즈', '오늘의숙제', '주말의숙제', '오늘의팁', '경영리포트HTML', '여행지도HTML', '상담폼ID'].forEach(k => {
      if (getState(st6, k).row < 1) warn("app_state '" + k + "' 없음" + (k === '상담폼ID' ? ' → createConsultForm 실행 필요(상담 폼 응답 유입 끊김)' : ''));
    });
    // [v9.61] 학생 입력 폼 3종 미생성 감시 — 폼을 안 만들면 URL 틀이 없고 → calcAll이 CX102·CY103을 빈칸으로 두고
    //   → Glide의 Open-link 버튼이 "대상 없음"으로 조용히 안 그려진다. 컴포넌트는 멀쩡히 존재하므로 조립 점검을
    //   눈으로만 하면 통과해 버린다(2026-07-24 실측: 출석·숙제 버튼 전원 미렌더 + GPS 삭제 후 출석 수단 0).
    [['출석폼URL틀', 'createAttendanceForm', '앱 출석 버튼'], ['숙제폼URL틀', 'createHwForm', '숙제 제출 버튼(AI 첨삭 입구)'],
     ['약점메모폼URL', 'createTeacherMemoForm', '강사 약점 메모'],
     ['학업폼URL', 'createAcademicForm', '강사 학업 기록 버튼(수업준비 탭 — 급수·모의 차트 원료)'], // [v9.74]
     ['결석폼URL', 'createAbsenceForm', '강사 결석 연락 기록 버튼(시즌 등급 심사 「결석 복귀율」 원료 — 없으면 지표가 측정 불가)'], // [v9.89]
     ['마감폼URL', 'createLessonCloseForm', '강사 차시 마감 30초(규칙서 §6 강사 입력 2개 중 하나 — 없으면 조 편성 침묵 점수·4주차 명단·이월 경보가 전부 안 열린다)'], // [v9.91]
     ['강의폼URL', 'createLectureForm', '온라인 강의 수강 확인(주말반 승급 판정의 나머지 절반 — 없으면 대면 90분만 보고 채점된다)'], // [v9.106]
     ['설문폼URL틀', 'createSurveyForm', '월간 만족도 설문(하이라이트 메일 동봉·주간 리포트 집계 — 첫 만족도 기준선)'], // [v9.75] v9.73 편입 누락분
     ['퀴즈폼URL틀', 'createQuizForm', '학생 퀴즈 답하기 버튼(quiz_log 유일 입구 — 없으면 매일 던지는 문제의 답이 한 건도 안 쌓인다. 「무엇을 골랐나」는 소급이 안 된다)'], // [v9.138]
     ['대화폼URL틀', 'createTalkForm', '학생 「한국어로 말 걸기」 버튼(talk_log 유일 입구 — 앱이 쌓는 것은 전부 단문·단답이라 다회차 대화가 0건이다. 회화 앱의 핵심 재료가 여기서만 나온다)']].forEach(f => { // [v9.138]
      if (getState(st6, f[0]).row < 1) warn('폼 미생성 — ' + f[2] + '가 작동하지 않습니다. 에디터에서 ' + f[1] + ' ▶ 1회 실행 후 calcAll(자동 14/22시)');
    });
  }

  // 6.5) [v9.48] 공유열 서버화 확인 — Glide가 계산 컬럼 없이 바로 바인딩할 수 있는 상태인지(조립 전제)
  if (pf && pf.getLastRow() >= 2) {
    const endColP = SHARED2_COL_START + SHARED2_COL_HEADERS.length - 1; // [v9.74] 118(DN) — 2차 블록까지
    if (pf.getMaxColumns() < endColP) warn('공유열(CG85~CZ104·DH112~DN118) 미생성 — calcAll 1회 실행 필요(preflight가 이미 돌렸다면 로그의 calcAll 실패 사유 확인)'); // [v9.74] 카드·출퇴근·폼URL 2차 블록 포함(DA105~DG111 선점 구간은 제외)
    else {
      const shared = pf.getRange(2, SHARED_COL_START, pf.getLastRow() - 1, SHARED_COL_HEADERS.length).getValues();
      const roles = pf.getRange(2, 1, pf.getLastRow() - 1, 10).getValues();
      let stuFilled = 0, stuTotal = 0, parFilled = 0, parTotal = 0;
      roles.forEach((r, i) => {
        if (!r[0]) return;
        if (r[3] === 'student') { stuTotal++; if (String(shared[i][1] || '')) stuFilled++; }        // 내숙제
        else if (r[3] === 'parent') { parTotal++; if (String(shared[i][12] || '')) parFilled++; }   // 자녀_주간리포트
      });
      if (stuTotal && stuFilled < stuTotal) warn('학생 공유열 미충전 ' + stuFilled + '/' + stuTotal + ' — 숙제 키가 아직 없을 수 있음(밤 21시 이후 자동, 즉시 원하면 calcAll 재실행)');
      else if (stuTotal) ok('학생 공유열 충전 완료 ' + stuFilled + '/' + stuTotal + '(숙제·퀴즈·팁·배너·보스·여행지도 — Glide 계산 컬럼 불필요)');
      if (parTotal && parFilled < parTotal) warn('학부모 공유열 미충전 ' + parFilled + '/' + parTotal + ' — parent_of(J열) 자녀 연결을 확인하세요(연결 후 calcAll 재실행)');
      else if (parTotal) ok('학부모 공유열 충전 완료 ' + parFilled + '/' + parTotal + '(자녀 카드 6종 — Relation·Lookup 불필요)');
    }
  }

  // 7) 트리거 생존 확인. [v9.202] 목록을 여기 다시 적지 않는다 — triggerManifest_(정본)에서 파생한다.
  //   (고정 10개를 손으로 적어 두던 시절엔 v9.164가 추가한 onConsultEdit 실종을 이 점검이 영영 못 봤다)
  const tbOnP = textbookLinkOn_(ss); // [v9.67] 개통 발자국(profiles 목소리폼URL 헤더) 있을 때만 요구 — 미개통 오경보 차단
  const need = triggerManifest_(tbOnP);
  const have = {};
  try { ScriptApp.getProjectTriggers().forEach(t => { have[t.getHandlerFunction()] = 1; }); } catch (e) {}
  const missT = need.filter(k => !have[k]);
  if (missT.length) warn('트리거 누락: ' + missT.join(', ') + ' → resetAllTriggers() 1회 실행(⚠ 매월 1일 오전엔 실행 금지 · 교재연동Nightly는 setupTextbookLink ▶로도 복구)');
  else ok('트리거 ' + need.length + '개 전부 살아있음(통합 ' + triggerManifest_(false).length + (tbOnP ? ' + 교재연동Nightly' : ' · 교재연동 미개통') + ')');

  // 7.2) [v9.67] AI 첨삭 키·적체 — 키 휴면이 완전 침묵이던 결함 해소(키 값은 절대 미출력, 존재 여부만)
  {
    const aiP = aiFeedbackHealth_(ss);
    if (!aiP.hasKey) warn('CLAUDE_API_KEY 미설정 — AI 첨삭·문법판정·스튜디오 휴면' + (aiP.backlog ? ' · 숙제폼 적체 ' + aiP.backlog + '건(키 설정 즉시 다음 밤 자동 소진)' : '(학생 숙제 제출이 시작되기 전에 스크립트 속성에 설정)'));
    else if (aiP.backlog > 0 && aiP.oldestAge > 1) warn('숙제 첨삭 적체 ' + aiP.backlog + '건 — 가장 오래된 제출이 ' + aiP.oldestAge + '일 전인데 미처리(hw_feedback 최근 생성 ' + (aiP.fbAge < 0 ? '이력 없음' : aiP.fbAge + '일 전') + ') → 야간 배치 실패 의심(aiFeedbackBatch 실행 기록 확인)');
    else ok('AI 첨삭 파이프라인: 키 설정됨 · 적체 ' + (aiP.backlog ? aiP.backlog + '건(다음 밤 소진 예정)' : '0건'));
  }

  // 7.5) [v9.42] 데모 모드 상태 표시
  {
    const gD = st6 ? getState(st6, '데모모드') : { row: -1 };
    L.push(gD.row > 0
      ? 'ℹ 🎭 데모 모드 ON(' + gD.val + ' 시드) — 화면의 DEMO 크루 8명은 시연용. 제거 = clearDemoData() 1회'
      : 'ℹ 데모 모드 OFF — 전 화면을 실물로 시연하려면 seedDemoData() 1회(제거는 clearDemoData)');
  }

  // 8) 실측 매니페스트 갱신 + 요약
  if (ensureBudget('system_manifest 실측')) { try { buildSystemManifest(); ok('system_manifest 실측 갱신'); } catch (e) { warn('manifest 실패: ' + e.message); } }
  if (!pausedP) clearContinue_('preflightGlide'); // [v9.47] 완주 시 잔여 이어하기 트리거 청소
  const report = '===== SYNK Glide 조립 사전점검 (' + SYNK_VERSION + ' · ' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm') + ') =====\n'
    + L.join('\n')
    + '\n=====\n' + (pausedP ? '⏱️ 일부 무거운 단계가 시간 예산으로 미뤄졌습니다 — 1분 후 자동 이어하기(재실행 무해).\n' : '')
    + '⚠ 줄을 전부 해소하면 조립 준비 완료. 세부 실측은 system_manifest 시트 참조.';
  Logger.log(report);
  return report;
}

/* ===================== [v6.3] 트리거 통합 리셋 — 20개 한도 해결 =====================
 * Apps Script는 스크립트당 시간 트리거 20개 한도. v4부터 쌓인 개별 트리거를 전부 지우고
 * 시간대별 통합 작업 10개(+교재연동 개통 시 교재연동Nightly 1개)로 재설치합니다. 실행 순서 보장 덤:
 * 게임배치 → 아카이브 순서가 코드로 고정 (기존엔 별도 트리거라 경합 위험).
 * ⚠️ 매월 1일 오전(리포트카드 생성 중)에는 실행하지 마세요 — 이어하기 트리거가 끊깁니다. */

function safeRun(name, fn) {
  try { fn(); }
  catch (e) {
    Logger.log('❗ ' + name + ' 실패: ' + e);
    // [v9.32] 실패 메일 dedup — parentSweep(10분)이 부르는 작업이 지속 실패하면 같은 실패 메일이
    //   하루 수십~수백 통 발송돼 메일 쿼터를 태우고 학부모·미납·브리핑 알림까지 죽는다(quotaOk 경고와
    //   동일한 자기증폭). '함수명+에러 첫 줄'당 하루 1통으로 제한하되, 에러 내용이 바뀌면 다시 알린다.
    try {
      const sig = String(e && e.message ? e.message : e).split('\n')[0].slice(0, 120);
      const props = PropertiesService.getScriptProperties();
      const today = Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
      const key = 'safeRun실패_' + name;
      if (props.getProperty(key) === today + '|' + sig) return; // 오늘 같은 에러는 이미 알림
      if (quotaOk(1)) {
        MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] ❗ 자동 작업 실패: ' + name,
          String(e && e.stack ? e.stack : e) + '\n\n다른 작업들은 정상 진행되었습니다.\n\n(같은 오류는 오늘 다시 알리지 않습니다 — dedup)');
        props.setProperty(key, today + '|' + sig); // 발송 성공분만 마킹 → 쿼터 부족이면 다음 스위프 재시도
      }
    } catch (e2) { Logger.log('safeRun dedup 처리 실패: ' + e2); }
  }
}

function morningJobs() {   // 매일 07시
  rehearsalForceOff_(); // [v9.120] 리허설이 켜진 채 배치가 오면 그날 알림이 통째로 죽는다 — TTL과 별개의 두 번째 안전장치
  safeRun('학생ID발급', function () { 학생ID_발급_(); }); // [v9.164] 반배정·앱편입인데 ID가 빈 행을 채운다. **syncProfiles보다 앞** — 뒤에 두면 그날 아침 앱에 못 들어가고 하루 밀린다. onEdit 트리거가 죽어도 여기서 잡히는 두 번째 발동층
  safeRun('syncProfiles', syncProfiles);       // [v7.0] 동기화 먼저 — 신규 학생 생일을 당일부터 인식
  safeRun('birthdayCheck', birthdayCheck);
  safeRun('checkConsultDelay', checkConsultDelay);
  safeRun('parentWeeklyDigestRetry', parentWeeklyDigestRetry_); // [v9.34] 일요일 다이제스트 쿼터 유실분 평일 아침 재발송(보류 키 없으면 즉시 return)
  safeRun('parentHighlightsRetry', parentHighlightsMail_); // [v9.54] 월간 하이라이트 쿼터 보류분 이어 발송(월 마커 있으면 즉시 return — 사실상 무비용)
  safeRun('welcomeStoryBatch', welcomeStoryBatch_); // [v9.50·F4] 웰컴 스토리 — 대기열 중 학부모 이메일이 채워진 신규 학생에게 세계관 입장 편지(키 없으면 템플릿 폴백)
  safeRun('teacherMemoFormSync', function () { const ssTm = SpreadsheetApp.getActiveSpreadsheet(); syncTeacherMemoForm_(ssTm, ensureSheet(ssTm, 'app_state', ['key', 'value'])); }); // [v9.64] 연습 포인트 폼을 코드 정본에 매일 동기화 — 로스터(강사·반) 변화가 드롭다운에 자동 반영(폼 없으면 즉시 -1 return, 무비용)
  safeRun('academicFormSync', function () { const ssAf = SpreadsheetApp.getActiveSpreadsheet(); syncAcademicForm_(ssAf, ensureSheet(ssAf, 'app_state', ['key', 'value'])); }); // [v9.74] 학업 기록 폼 동기화 — 같은 계보(폼 없으면 -1 return, 무비용)
  safeRun('absenceFormSync', function () { const ssAb = SpreadsheetApp.getActiveSpreadsheet(); syncAbsenceForm_(ssAb, ensureSheet(ssAb, 'app_state', ['key', 'value'])); }); // [v9.89] 결석 연락 폼 동기화 — 같은 계보(폼 없으면 -1 return, 무비용)
  safeRun('expiryDaily', function () { MJ_expiryDaily_(); }); // [v9.72] 수강 만료 D-14/D-3 학부모 안내 — enrollments 비어 있으면 무비용(클로저 = 만족도팩 누락에도 morningJobs 생존)
  safeRun('jacketWatch', jacketWatch_); // [v9.83] 🧥 과잠 자격(재원 12개월+누계) 신규 도달자 감지 — 도달 0명이면 시트·메일 모두 무동작
  safeRun('lessonCloseGap', function () { const ssG = SpreadsheetApp.getActiveSpreadsheet(); lessonCloseGapAlert_(ssG, ssG.getSpreadsheetTimeZone()); }); // [v9.92] 어제 마감 미제출 반 → 담당 강사(하루 1통). 어제 출석 0건이면 휴강으로 보고 무동작
}

function nightJobs() {     // 매일 22시 — 수업 종료 후
  rehearsalForceOff_(); // [v9.120] 리허설이 켜진 채 배치가 오면 그날 알림이 통째로 죽는다 — TTL과 별개의 두 번째 안전장치
  safeRun('expandLessonLog', expandLessonLog_);   // [v9.36] 수업 마감 로그 승격분 → 숙제 +10·연료 전개 (calcAll 앞 = 그날 밤 게이지·랭킹 즉시 반영)
  safeRun('expandMasteryLog', expandMasteryLog_); // [v9.36] 당일 문법 태그 → mastery_log upsert (calcAll 앞 = 그날 밤 진화 게이트 즉시 반영)
  safeRun('calcAll', calcAll); // 오늘의 숙제 게시(21시 조건) + Glide가 만든 point_logs A·F 빈칸 보정
  safeRun('expandHwBatch', expandHwBatch);       // [v8.0] 숙제 일괄 1탭 → 학생별 +10 전개 (가드·정산·스토리 전에)
  safeRun('dailyGuard', dailyGuard);             // [v7.5] 일일 한도 — MVP 반당 1명 + 숙제·칭찬·생일 1회/일 자동 정정
  safeRun('notifyDailyAwards', notifyDailyAwards); // [v7.6] 유효 MVP·시냅스 학부모 알림(한·몽 통합 1통)
  const dyN = new Date().getDay(); // [v7.3] 금=평일반 정산 · 일=주말반 정산(주말 수업 데미지 미집계 결함 수정)
  if (dyN === 5 || dyN === 0) safeRun('raidSettle', raidFriday);
  else safeRun('raidStoryDaily', raidStoryDaily); // 월~목·토 일일 전투 리포트
  if (dyN !== 0) safeRun('leagueStoryDaily', leagueStoryDaily_); // [v9.3] 월~토 리그 중계석
  if (dyN === 0) safeRun('leagueSettle', leagueSettle_); // [v9.1] 반 대항 리그 — 주간데미지 확정 후·다이제스트 전
  if (dyN === 0) safeRun('parentWeeklyDigest', parentWeeklyDigest); // [v7.9] 일요일 밤 — 학부모 주간 소식 1통
  if (dyN === 0) safeRun('messengerDigest', function () { MJ_messengerDigest_(); }); // [v9.71] 이메일 다이제스트의 메신저 미러 — 연결된 학부모만·창 밖 스킵(클로저 = 만족도팩 누락에도 nightJobs 생존)
  safeRun('notifyParents', notifyParents);
  // [v9.34] checkNoShow는 parentSweep(10분) 편승으로 이동 — 판정 창(수업 시작+30~90분)이 22시엔 구조적으로 안 걸려 죽은 안전장치였음
  safeRun('checkEvolution', checkEvolution);
  safeRun('checkAchievements', checkAchievements);
  safeRun('absenceFollowup', absenceFollowupNightly_); // [v9.89] 결석 복귀 자동 판정 + 24시간 경과 미연락 강사 알림(창 D+1~D+3) — attendance가 그날치까지 채워진 뒤라야 판정이 맞으므로 calcAll·출석 전개 뒤
  safeRun('checkUnknownReasonsNightly', checkUnknownReasonsNightly_); // [v9.28] 미인식 reason 발각 지연 7일→1일
  safeRun('sheetSelfHeal', sheetSelfHeal_); // [v9.69] 스토리북 구형 분권 병합·고아 변형 선택자 청소·world_raid 월 중복 정리 — 멱등·변경 없으면 쓰기 0
  safeRun('profilesIntegrityNightly', profilesIntegrityNightly_); // [v9.77] 유령 행·user_id 중복·무효 role 매일 감시 — 이상 시에만 메일(동일 내용 dedup), 3열 읽기라 비용 0
  safeRun('selfDeclareLog', selfDeclareLogNightly_); // [v9.197] 학생 자기선언 3칸(드림한줄·최애·몬스터이름)의 «바뀐 것만» 이력에 append — calcAll 뒤라 그날 열 보장이 끝난 상태다. 안 바뀌면 쓰기 0
  safeRun('translateContentsNightly', translateContents); // [v9.41·자동화] 빈 몽골어·영어 번역을 매일 밤 60행씩 자동 소진 — "translateContents 수동 반복 실행" 절차 제거(빈칸 없으면 API 호출 0)
  safeRun('aiFeedbackBatch', aiFeedbackBatch_); // [v9.49] 숙제폼 제출분 AI 첨삭 생성 — CLAUDE_API_KEY 없으면 0초 스킵
  safeRun('talkBatch', talkBatch_); // [v9.138] 한국어 대화 답장 — 회화 앱 1세대이자 「다회차 대화」 데이터의 유일한 원천(키 없으면 0초 스킵)
  safeRun('aiStudioBatch', aiStudioBatch_); // [v9.50] AI 스튜디오 — 오늘의 한 문장·개인 퀴즈(H1/A1/A2/A4)·오류사전(G)·반 브리핑(H5)·리텐션 멘트(E5). 키 없으면 0초 스킵
  safeRun('sweepLevelTest', sweepLevelTest_); // [v9.50·F1] 레벨 테스트 응답 채점→AI 진단 리포트 발송→leads 편입(폼 미생성이면 0초 스킵)
  safeRun('demoMonthEndGuard', function () { // [v9.44] 데모 모드가 월말(28일~)까지 살아 있으면 경고 — 다음 달 1일 실배치가 데모 재적으로 지난달을 정산하는 사고 예방
    const ssD = SpreadsheetApp.getActiveSpreadsheet();
    const stD = ssD.getSheetByName('app_state');
    if (!stD || getState(stD, '데모모드').row < 1) return;
    const dD = Number(Utilities.formatDate(new Date(), ssD.getSpreadsheetTimeZone(), 'd'));
    if (dD >= 28) adminMail('[SYNK] ⚠️ 데모 모드가 아직 켜져 있습니다(월말)', '다음 달 1일 새벽 월간 배치 전에 clearDemoData()를 실행하세요 — 안 하면 데모 크루 8명이 실제 월간 시상·스토리북·랭킹에 섞여 발간됩니다.');
  });
  // [v9.28] 완주 마커 — 반드시 맨 마지막 줄. 6분 타임아웃이면 이 줄 자체가 실행 안 되어 워치독이 증발을 감지
  try {
    const ssNJ = SpreadsheetApp.getActiveSpreadsheet();
    PropertiesService.getScriptProperties().setProperty('야간배치완료일',
      Utilities.formatDate(new Date(), ssNJ.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm'));
  } catch (e) {}
}

// [v9.25] 직접 등록 트리거 safeRun 보호 래퍼 — morningJobs/nightJobs처럼 실패 시 admin 알림 보장.
//         원 함수(dailyBackup 등)는 수동 실행용으로 그대로 두고, 트리거에는 이 래퍼를 등록한다.
//         monthlyReportCards는 진입점만 감싸고 내부 reportCardsContinue 이어하기 체인은 건드리지 않는다.
function dailyBackupJob()         { safeRun('dailyBackup', dailyBackup); }                 // 매일 03시 — 유일한 백업 경로
function calcAllJob()             { safeRun('calcAll', calcAll); }                          // [v9.32] 14시 단독 계산 트리거 보호(실패 시 admin 알림)
function sendMorningDigestJob()   { safeRun('sendMorningDigest', sendMorningDigest); }     // 매일 08시 — 아침 브리핑
function monthlyReportCardsJob()  { safeRun('monthlyReportCards', monthlyReportCards); }   // 1일 06시 — 리포트카드 배치 진입점
function monthlyReportJob()       { safeRun('monthlyReport', monthlyReport); }             // 1일 07시 — 월간 리포트

function weeklyJobs() {    // 매주 월 07시
  safeRun('raidMonday', raidMonday); // 게임(레이드) 설정 — 시트 쓰기만, 메일 리포트 아님
  safeRun('goldenSample', goldenSampleWeekly_); // [v9.147] 강사 교정 정답 모음 무작위 표본 — 2년 뒤 모델 선택의 채점표(소급 불가)
  let lpText = ''; // [v9.86·D] 주간 교안 초안 — 생성은 여기서, 링크 보고는 아래 통합 리포트 섹션으로(메일 순증 0)
  safeRun('lessonPlanDrafts', function () { lpText = lessonPlanDrafts_(); });
  let silText = ''; // [v9.91] 4주차 침묵 학생 명단 — 시즌 4주차 주에만 값이 생긴다(그 외 주는 섹션 생략)
  safeRun('silentRosterAlert', function () { const ssS = SpreadsheetApp.getActiveSpreadsheet(); silText = silentRosterAlert_(ssS, ssS.getSpreadsheetTimeZone()); });
  // [v9.233] 발화 지수 주간 스냅샷 — 아래 통합 리포트의 「주간 리포트」 섹션(weeklyReport 꼬리)이 이 로그를 읽으므로 섹션 실행보다 먼저 적재한다
  safeRun('talkIndexSnapshot', function () { const ssT = SpreadsheetApp.getActiveSpreadsheet(); Logger.log(talkIndexSnapshot_(ssT, ssT.getSpreadsheetTimeZone())); });

  // [v9.25] 월요일 정기 리포트 통합 — 최악 5통(healthCheck·systemWatchdog·weeklyReport·checkTuition·
  //         checkReenrollment) → 1통. 각 섹션을 개별 try/catch로 수집해 한 섹션 예외가 나머지 섹션·
  //         메일 발송을 죽이지 않게 하고, 마지막에 quotaOk(1) 확인 후 딱 1통만 발송한다.
  //         (healthCheck 점검 항목은 systemWatchdog에 흡수됨)
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  // [v9.29] KPI 단일 계산 — kpiSection_·updateBizDashboard가 각각 computeKpiMetrics(당월)를 독립
  //   호출하던 이중 계산 제거(profiles·attendance 전량 스캔 + 상담시트 openById가 한 번으로).
  //   여기서 1회 계산해 두 섹션에 주입하고, 실패하면 null → 각 섹션이 기존처럼 자체 계산(단독 실행 경로 보존).
  let kpiInjection = null;
  try {
    const nowW = new Date();
    const curYmW = Utilities.formatDate(nowW, tz, 'yyyy-MM');
    const prevYmW = ymShift_(curYmW, -1); // [v9.34] 전월 — 월키 TZ 단일화(연 경계 안전)
    const curW = computeKpiMetrics(curYmW);                          // 당월 잠정 재계산(멱등)
    const prevW = kpiReadRow_(prevYmW) || computeKpiMetrics(prevYmW); // 전월 확정 우선·없으면 잠정
    kpiInjection = { cur: curW, prev: prevW, curYm: curYmW, prevYm: prevYmW };
  } catch (e) { Logger.log('weeklyJobs KPI 단일 계산 실패(각 섹션 자체 계산 폴백): ' + e); }
  // [v9.206] 셋째 칸 true = AI 해설(H7) 입력에 실어도 되는 「집계·숫자만」 섹션(방향 불변식 4 — 이름·학생ID·연락처·
  //   자유서술이 벤더로 안 나간다 · docs/제품방향.md:62). 이름이 실리는 섹션(주간순위·미납·재등록·문의·만료임박·이수율)과
  //   조건부 누출(워치독 유령행 이름·설문 자유서술·교안 Doc URL)은 플래그 없음 = 기본 제외 — 새 섹션도 기본이 제외라
  //   새는 방향이 기본 닫혀 있다. 원장 이메일 본문(body)은 내부 수신이라 전문 유지. 결석 복귀율은 강사명만 실린다(학생 식별자 0).
  const sections = [
    ['🛡️ 시스템 워치독', systemWatchdog],
    ['📊 주간 리포트', weeklyReport],
    ['📈 KPI(이탈·전환)', kpiSection_, true],    // [v9.26] 당월 잠정 + 전월 확정 비교
    ['📟 경영계기판', updateBizDashboard, true],  // [v9.26] 6지표 신호등 — KPI 재사용 + leads·현금 지표 + 적색경보
    ['💰 미납 현황', checkTuition],        // 미납은 주 1회 (알림 다이어트)
    ['🔄 재등록 시점', checkReenrollment],
    ['💬 학부모 문의', checkNewInquiries_],  // [v9.28] 결석 사전신고와 짝을 이루는 인바운드 채널
    ['📨 메신저 연결(학부모)', function (t) { return MJ_msgSection_(t); }, true],  // [v9.71] 이중화 현황 — 클로저(만족도팩 누락 시 이 섹션만 실패, 리포트는 발송)
    ['🔁 결석 복귀율(강사별)', function (t) { return absenceSection_(t); }, true],  // [v9.89] 등급 심사 20점 항목 — 8주 시즌 창
    ['📅 수강 만료 임박', function (t) { return MJ_expirySection_(t); }],    // [v9.72]
    ['📋 월간 만족도 설문', function (t) { return MJ_surveySection_(t); }],   // [v9.73] 첫 만족도 기준선
    ['📋 주간 교안 초안', function () { return lpText || '(생성 없음)'; }],    // [v9.86·D] 반별 Doc 링크 — 유호 근무 46%(콘텐츠 편집)의 백지 제거
    // ⚠ [v9.107] 위 줄의 쉼표는 지우지 말 것 — 빠지면 JS가 `[…][…]`를 배열 인덱싱으로 읽어 이 자리가
    //   undefined가 되고, 아래 forEach의 sec[0]에서 TypeError로 죽는다. 그러면 주간 통합 리포트가
    //   통째로 발송되지 않는다(섹션 try/catch보다 바깥이라 안전망이 안 걸린다). 08-01 실측으로 발각.
    ['📋 마감 제출률', function () { const ssR = SpreadsheetApp.getActiveSpreadsheet(); return lessonCloseRate_(ssR, tz); }, true],  // [v9.92] 필수 루틴 준수 계측 — 값 없으면(시즌 미설정·수업 0) 섹션 생략
    ['🔇 4주차 침묵 학생', function () { return silText; }, true],  // 반환값은 인원수뿐 — 실명 명단은 adminMail 전용(silentRosterAlert_)
    // [v9.119] `ss`는 weeklyJobs 스코프에 없다 — 08-01 실행 로그에서 `ReferenceError: ss is not defined`로
    //   이 섹션만 매주 실패하고 있었다(섹션 try/catch가 잡아 리포트는 살지만 이수율은 영구 공백).
    //   다른 섹션과 같은 패턴으로 자체 조회한다.
    ['🎬 온라인 강의 이수율(주말반)', function () { const ssL = SpreadsheetApp.getActiveSpreadsheet(); return lectureWeeklyText_(ssL); }] // [v9.125] 주석 정정: 섹션 제목은 항상 찍히고 빈 값은 '(내용 없음)'으로 남는다 — 무데이터가 보여야 「원래 그런 주」와 구별된다
  ];
  let body = '📬 SYNK 주간 통합 리포트 · ' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd') + '\n';
  let aiBody = ''; // [v9.206] AI 해설 입력 — 집계 화이트리스트 섹션만 담는다(위 sections 셋째 칸 주석 참조)
  sections.forEach(function (sec) {
    const title = sec[0], fn = sec[1], 집계만 = sec[2] === true;
    body += '\n──────── ' + title + ' ────────\n';
    try {
      const txt = fn(true, kpiInjection); // 텍스트 반환 모드 — 각 섹션은 자체 발송하지 않음(KPI 두 섹션만 주입치 사용, 나머지는 잉여인자 무시)
      const t = (txt && String(txt).trim() ? String(txt) : '(내용 없음)') + '\n';
      body += t;
      if (집계만) aiBody += '\n──────── ' + title + ' ────────\n' + t;
    } catch (e) {
      body += '⚠ 섹션 생성 실패: ' + title + '\n';
      Logger.log('주간 통합 리포트 섹션 실패 [' + title + ']: ' + e);
    }
  });
  try { // [v9.50·H7] 주간 지표 AI 해설 — 숫자 위 판단 층(계산은 코드가, AI는 해설만·실패해도 리포트는 그대로 발송)
    // [v9.206] 입력은 body(전문·이름 포함)가 아니라 aiBody(집계 섹션만) — 방향 불변식 4. 절단은 방어가 아니었다(이름 섹션이 앞쪽이라 먼저 나감).
    const cmtH7 = aiText_('SYNK 학원(몽골 울란바토르, 게임화 한국어 학원)의 주간 운영 리포트다. 명단 섹션은 제외된 집계 요약본이다. 아래 본문 지표에서 ①핵심 신호 2가지 ②이상 징후(없으면 "없음") ③이번 주 원장이 할 행동 딱 1가지를 한국어 6줄 이내로 써라. 숫자를 새로 계산하지 말고 본문의 숫자만 인용한다.\n\n' + aiBody.slice(0, 6000), 900);
    if (cmtH7) body += '\n──────── 🤖 AI 해설 ────────\n' + cmtH7 + '\n';
  } catch (eH7) { Logger.log('H7 해설 스킵: ' + eH7); }
  if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 주간 통합 리포트', body);
  else Logger.log('주간 통합 리포트: 쿼터 부족으로 미발송');

  safeRun('syncToNotion', syncToNotion_); // [v9.21] 앱→노션 크루 DB 동기화 (NOTION_TOKEN 없으면 자동 스킵)
  safeRun('calcTeacherStats', calcTeacherStats); // [v9.41·자동화] 강사 지표(케어지수·왕관편중) 주간 자동 갱신 — 월 1회(monthlyReport)만 갱신돼 원장 뷰가 한 달 낡던 것 해소(멱등·전월 왕관 기준이라 주중 재실행 무해)
  safeRun('systemManifest', buildSystemManifest); // [v9.37] 주간 실측 스냅샷 — 시트·콘텐츠·트리거·의존성 드리프트를 system_manifest 시트에 갱신
  // [v7.0] pruneAppState 제거 — 인자(ss, 월)가 필요한 archiveMonthly 내부 헬퍼였음 (무인자 호출 시 매주 실패)
}

function monthlyJobs() {   // 매월 1일 05시 — 순서 고정이 핵심
  safeRun('monthlyGameBatch', monthlyGameBatch); // ① 지난달 칭호·스냅샷 (로그가 옮겨지기 전에!)
  safeRun('worldRaidMonthly', worldRaidMonthly_); // [v9.6] ①.4 🌍 월드 정산·소환 — 스토리북이 결과를 읽도록 먼저
  safeRun('buildMonthlyStorybook', buildMonthlyStorybook_); // [v9.4] ①.5 📖 싱크 스토리 — 칭호 확보 후·아카이브 전
  safeRun('buildMonthlyCards', buildMonthlyCards_);   // [v9.12] ①.6 🃏 이달의 카드
  safeRun('updateTravelMap', updateTravelMap_);       // [v9.12] ①.7 🗺️ 여행 지도 도장
  safeRun('aiMonthlyTitles', aiMonthlyTitles_);       // [v9.50·B3] ①.71 이달의 AI 유니크 칭호 — 여정 카드 노출(키 없으면 스킵)
  safeRun('futureLetter', futureLetterBatch_);        // [v9.50·B5] ①.72 미래의 나 편지 — 3개월차·목표(드림한줄/상담 비전) 보유자에게(키 없으면 템플릿)
  safeRun('parentHighlights', parentHighlightsMail_); // [v9.50·H4] ①.73 학부모 하이라이트 3장면 — 몽골어 템플릿 조합(AI 창작 없음·원어민 검수 대상)
  safeRun('snsDrafts', snsDrafts_);                   // [v9.50·F2] ①.74 SNS 성장 스토리 초안 — 익명 집계만 사용(동의 체계 전 개인정보 미사용)
  safeRun('buildExecReport', buildExecReport_);       // [v9.14] ①.8 📊 경영 리포트
  safeRun('kpiSnapshotPrevMonth', kpiSnapshotPrevMonth_); // [v9.26] ①.9 📈 전월 KPI 확정 스냅샷 (attendance 미아카이브라 순서 무관·아카이브 전 배치)
  safeRun('archiveMonthly', archiveMonthly);     // ② 그다음 아카이브
  // [v9.166] ③ 커버리지 자동 발화 — 계기판을 시트 메뉴에만 두면 「6개월마다 열어본다」가 아무도 안 하는 일이 된다.
  //   아카이브 뒤에 둔 이유: archiveMonthly가 옮기는 것은 point_logs뿐이라 수집층 카운트에 영향이 없고,
  //   그달 배치가 전부 끝난 상태를 재는 편이 맞다. 정상이면 메일 0통(재원 0명이면 통째로 침묵).
  safeRun('dataCoverageMail', dataCoverageMonthly_);
  // [v9.32] 완주 마커 — 반드시 맨 마지막 줄(nightJobs와 동일 패턴). 8개 직렬 체인이 6분 타임아웃으로
  //   중간 증발하면 이 줄이 실행되지 않아 워치독이 감지한다. archiveMonthly는 다음 달 소급 아카이브로
  //   자기치유되지만 스토리북·카드·경영리포트는 그달 치가 영구 증발하므로 마커 감지가 필요.
  try {
    const ssMJ = SpreadsheetApp.getActiveSpreadsheet();
    PropertiesService.getScriptProperties().setProperty('월간배치완료월',
      Utilities.formatDate(new Date(), ssMJ.getSpreadsheetTimeZone(), 'yyyy-MM'));
  } catch (e) {}
}

// [v9.38e] Glide 원장 콕핏 수동 생성용 래퍼 — buildExecReport_·updateTravelMap_는 이름이 _로 끝나
//   Apps Script 편집기의 실행 드롭다운에 안 떠서(private 취급), 원장이 개원 전 콕핏 카드를 미리 만들 때
//   이 래퍼를 골라 ▶실행한다. 각 함수는 자기 app_state 키(경영리포트HTML·여행지도HTML)만 멱등 생성 —
//   monthlyJobs를 통째로 돌릴 때의 archiveMonthly(로그 아카이브) 같은 부작용이 전혀 없다.
function runExecReportNow() { buildExecReport_(); }
function runTravelMapNow() { updateTravelMap_(); }
// [v9.39] 조립 검증용 수동 러너 — 마감폼 저장분을 밤 22시까지 기다리지 않고 즉시 전개+재계산.
//   expandLessonLog_/expandMasteryLog_는 멱등(K·L 처리상태 마킹 + 당일 지급분 재조회 dedup)이라 낮 실행 무해.
//   메일·정산·가드는 안 건드린다(그건 nightJobs 전용 순서 유지).
function runLessonExpandNow() { expandLessonLog_(); expandMasteryLog_(); calcAll(); return '마감폼 전개+재계산 완료 — mastery_log·point_logs·여정 카드 확인'; }

/* [v9.202] 트리거 매니페스트 **정본** — 「같은 판정을 두 곳에 적으면 갈라진다」의 수리.
 *   병의 실물: v9.164가 onConsultEdit을 아래 재설치 목록에만 넣고 소비자 셋을 안 고쳤다. 결과가 두 방향으로 샜다 —
 *     ①preflight need(10개)·②워치독 recommended 가 onConsultEdit 실종을 **못 본다**(거짓 초록 · onEdit은 시간 기반이
 *       아니라 「조용히 안 도는 것」으로만 드러나서 증상이 없다)
 *     ③buildSystemManifest 기대치 10이 정상 설치된 11개를 ⚠로 오판한다(**거짓경보** — 상시 WARN은 사람이 가드를 끄게 만든다)
 *   숫자만 11로 올리면 ③만 닫히고 ①②는 그대로 남는다. 그래서 셋 다 이 함수에서 파생시킨다.
 *   트리거를 늘릴 땐 **여기 한 줄 + 아래 설치 한 줄**이고, 둘이 갈라지면 tests/safety.test.js 의 대조가 CI에서 잡는다.
 * 🚫 설치 코드(resetAllTriggers)를 이 목록으로 **몰지 않는다** — 이종 검수 20a30d304f4c 의 지적이지만 기각이다.
 *   트리거마다 주기·시각·대상이 다르고(10분 스위프 · 월 1일 5/6/7시 · 외부 시트 onEdit), 그것까지 표로 접으면
 *   표가 곧 두 번째 스케줄러가 된다. 게다가 그 함수는 **전체 삭제 후 재설치**라 한 줄만 어긋나도 학원 자동화가
 *   통째로 멈추는데, 지금은 앱을 짓는 중이라 그런 되돌림 비용을 낼 자리가 아니다(유호 확정 08-10 「구조 결함은
 *   완성 후」). 대신 **갈라짐은 회귀가 막는다** — 통합의 목적은 「한 곳에 적기」가 아니라 「갈라져도 모르는 일이
 *   없게 하기」이고, 그건 대조로도 달성된다.
 * ⚠ 이름은 **실제 등록되는 핸들러명**이다(safeRun 보호 래퍼는 …Job) — 워치독 alive()가 bare/Job 두 표기를 흡수한다.
 * ⚠ 톱레벨 const 로 빼지 말 것 — 파일 초기화 순서에 따라 전 트리거가 죽는다(tests/로드시뮬). */
function triggerManifest_(tbOn) {
  const 목록 = [
    'parentSweep', 'dailyBackupJob', 'morningJobs', 'sendMorningDigestJob', 'calcAllJob',
    'nightJobs', 'weeklyJobs', 'monthlyJobs', 'monthlyReportCardsJob', 'monthlyReportJob',
    'onConsultEdit'                       // [v9.164] 상담시트 학생ID 즉시 발급
  ];
  if (tbOn) 목록.push('교재연동Nightly'); // [v9.67] 개통 발자국 있을 때만 — 미개통 시스템에 오경보 0
  return 목록;
}

function resetAllTriggers(force) {
  // [v9.25] 리포트카드 이어하기 보호 — 월 1일 배치가 예약한 reportCardsContinue 4분-뒤 트리거를
  // 무조건 삭제 루프가 함께 지워 배치를 조용히 중단시키는 사고 방지. force=true로 수동 강행 가능.
  const triggers = ScriptApp.getProjectTriggers();
  // [v9.47·리뷰 P2] 이어하기 트리거 보호 확장 — 리포트카드뿐 아니라 preflight·데모 시드/청소의 1분 재개 트리거도
  //   무조건 삭제 루프에 쓸려 "자동 이어하기"가 조용히 죽는 것을 방지(그 1분 사이에 재설치하는 경합 케이스).
  const PROTECTED_CONT = ['reportCardsContinue', 'preflightGlide', 'seedDemoData', 'clearDemoData'];
  const pendingCont = triggers.map(t => t.getHandlerFunction()).filter(h => PROTECTED_CONT.indexOf(h) > -1);
  if (!force && pendingCont.length) {
    const msg = '이어하기 트리거(' + pendingCont.join(', ') + ')가 대기 중이라 resetAllTriggers를 중단했습니다. ' +
      '지금 재설치하면 진행 중인 배치(리포트카드/조립 점검/데모)가 끊깁니다. 1~2분 뒤(완주 후) 다시 실행하거나, ' +
      '강행이 필요하면 resetAllTriggers(true)로 호출하세요.';
    Logger.log('⛔ ' + msg);
    adminMail('[SYNK] ⛔ resetAllTriggers 중단 — 리포트카드 배치 보호', msg);
    return;
  }
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('parentSweep').timeBased().everyMinutes(10).create(); // [v6.8] 30→10분: 수업 전·퇴근 후 알림 정밀도
  ScriptApp.newTrigger('dailyBackupJob').timeBased().atHour(3).everyDays(1).create();       // [v9.25] safeRun 보호 래퍼
  ScriptApp.newTrigger('morningJobs').timeBased().atHour(7).everyDays(1).create();
  ScriptApp.newTrigger('sendMorningDigestJob').timeBased().atHour(8).everyDays(1).create(); // [v9.25] safeRun 보호 래퍼
  ScriptApp.newTrigger('calcAllJob').timeBased().atHour(14).everyDays(1).create(); // [v9.32] safeRun 보호 래퍼(워치독 alive가 calcAll/calcAllJob 흡수)
  ScriptApp.newTrigger('nightJobs').timeBased().atHour(22).everyDays(1).create();
  ScriptApp.newTrigger('weeklyJobs').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();
  ScriptApp.newTrigger('monthlyJobs').timeBased().onMonthDay(1).atHour(5).create();
  ScriptApp.newTrigger('monthlyReportCardsJob').timeBased().onMonthDay(1).atHour(6).create(); // [v9.25] safeRun 보호 래퍼
  ScriptApp.newTrigger('monthlyReportJob').timeBased().onMonthDay(1).atHour(7).create();       // [v9.25] safeRun 보호 래퍼
  // [v9.67] 교재연동Nightly(23시 — AI 문법판정·목소리 수거·연습 노트) 재설치 — 위 전체 삭제 루프가
  //   setupTextbookLink(교재연동.js)가 설치한 이 트리거까지 지우고 재설치 목록엔 없어 조용히 실종되던 결함.
  //   개통 발자국(profiles '목소리폼URL' 헤더) 있을 때만 — 미개통 시스템에 유령 트리거를 만들지 않는다.
  //   시각·주기는 setupTextbookLink와 동일(매일 23시) · 전체 삭제 직후라 중복 설치 불가.
  const tbOnR = textbookLinkOn_();
  if (tbOnR) ScriptApp.newTrigger('교재연동Nightly').timeBased().everyDays(1).atHour(23).create();
  // [v9.164] 상담시트 onEdit(학생ID 즉시 발급)도 **여기서 반드시 재설치**한다 — 위 전체 삭제 루프가
  //   setupConsultTrigger가 만든 트리거까지 지운다. 교재연동Nightly가 같은 이유로 실종됐던 결함([v9.67])의 재발.
  //   시간 기반이 아니라 조용히 안 도는 것으로만 드러나므로(발급이 아침 백스톱까지 밀린다) 목록 누락이 더 위험하다.
  ScriptApp.newTrigger('onConsultEdit').forSpreadsheet(CONSULT_SHEET_ID).onEdit().create();
  Logger.log('✅ 트리거 통합 재설치 완료: ' + (tbOnR ? '12개' : '11개') + ' (10분 스위프 · 3시 백업 · 7시 아침작업 · 8시 브리핑 · 14/22시 계산 · 월 7시 주간 · 1일 5/6/7시 월간 · 상담시트 onEdit' + (tbOnR ? ' · 23시 교재연동' : ' — 교재연동 미개통이라 교재연동Nightly 제외, setupTextbookLink ▶ 시 +1') + ')');
}

/* ===================== [v9.26] 📟 경영계기판 — 6지표 신호등 대시보드 =====================
 * 사업 진단(2026-07)의 주간 대시보드를 시트로 구현. 이탈률·전환율은 KPI 파이프라인(computeKpiMetrics)을
 * 단일 소스로 재사용하고(두 벌 계산 금지), 여기서는 그 위에 3개 층을 얹는다:
 *   ① leads 시트 — 마케팅 퍼널 귀속: 유입경로(채널)·체험참석·등록권종·미등록사유·추천인. 데스크가 1행씩 기입.
 *      (KPI 전환율은 '상담 접수→등록'이라 채널·체험·사유를 모름 — 이 시트가 그 공백을 채운다)
 *   ② 입력칸 — 현금잔고(월 1회 직접)·월 번·BEP 목표 → ⓪ 생존개월수 = 현금÷번.
 *   ③ 신호등 판정 + 적색경보 — 생존<4.0개월 · 이탈률 8% 2개월 연속(= 마케팅 증액 금지) → 즉시 메일(월 1회 dedup).
 * 운영: 매주 월 07시 주간 통합 리포트 섹션으로 자동 갱신 · 설치 setupBizDashboard() 1회 · 수동 bizDashboardNow(). */

/* [v9.127] 급여 인센티브 정본 v1.3에 동기화 — 08-02 Glide 실측에서 경영 탭이 「BEP 목표 131명」을 띄우고 있었다
 *   (정본은 119명). 구 값은 「번 6,100만₮」 시나리오의 잔재이고, 정본은 4실 24반 384석·13명·임대 실계약가
 *   1,500만₮ 확정을 반영한 **고정비 5,065만₮ · BEP 119명(총 좌석의 31%)**이다.
 *   검산: 5,065 ÷ 42.7(ARPU) = 118.6 → 119명. 원천 = docs/정본/SYNK/ 급여 인센티브 정본 v1.3. */
const BIZ_BURN_DEFAULT = 5065; // 월 번(만₮) — 정본 v1.3 고정비. 사회보험·외국인고용부담금 확정 시 계기판 B3에서 직접 수정
const BIZ_BEP_DEFAULT = 119;   // 손익분기 재적(명) — 정본 v1.3(384석의 31%). 확정 변경 시 계기판 B4에서 수정

function bizSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    ld: ensureSheet(ss, 'leads', ['날짜', '이름', '연락처', '유입경로', '추천인', '체험참석', '등록', '등록권종', '등록일', '미등록사유', '메모', '캠페인']), // [v9.33] '캠페인' 자유텍스트 열(맨 끝) — 광고 캠페인/소재 식별. 기존 시트는 setupBizDashboard가 멱등 추가(대시보드 로직은 A~J열만 읽어 무영향)
    db: ensureSheet(ss, '경영계기판', ['지표', '값', '상태', '기준·메모']),
    pay: ensureSheet(ss, 'payments', ['student_id', '이름', '금액(만₮)', '납부일', '방법', '비고', 'created_at']) // [v9.28] 매출 원장 — 수동 기입(hall_of_fame과 동일 방식)
  };
}

function setupBizDashboard() { // 1회 설치 — leads 드롭다운 + 계기판 골격 (재실행 무해)
  const sh = bizSheets_();
  // [v9.33] 기존 leads 시트 멱등 마이그레이션 — '캠페인' 열이 없으면 맨 끝에 1열만 추가(자유 텍스트, 드롭다운 없음). 재실행해도 이미 있으면 무해.
  const ldHdr = sh.ld.getRange(1, 1, 1, sh.ld.getLastColumn()).getValues()[0].map(String);
  if (ldHdr.indexOf('캠페인') === -1) sh.ld.getRange(1, sh.ld.getLastColumn() + 1).setValue('캠페인');
  const dv = list => SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(true).build();
  sh.ld.getRange(2, 4, 999, 1).setDataValidation(dv(['페이스북', '인스타', '틱톡', '추천', '오픈데이', '학교제휴', '워크인', '기타']));
  sh.ld.getRange(2, 6, 999, 2).setDataValidation(dv(['Y', 'N'])); // 체험참석·등록
  sh.ld.getRange(2, 8, 999, 1).setDataValidation(dv(['1개월', '3개월', '6개월', '번들3개월', '번들6개월']));
  sh.ld.getRange(2, 10, 999, 1).setDataValidation(dv(['가격', '시간대', '거리', '타학원', '보류', '연락두절', '기타']));
  updateBizDashboard(true); // 입력칸·지표 골격 즉시 생성
  Logger.log('✅ 경영계기판 설치 완료 — leads 시트에 체험·상담을 기록하세요. 계기판 B2(현금잔고)는 월 1회 직접 입력.');
}

function updateBizDashboard(asText, kpiData) { // 계기판 시트 갱신 + 요약 텍스트 반환 (주간 통합 리포트 섹션 규약)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const DAY = 86400000;
  const sh = bizSheets_();

  // ── 입력칸 B2:B4 보존 (비면 기본값)
  const inp = sh.db.getLastRow() >= 5 ? sh.db.getRange(2, 2, 4, 1).getValues() : [[''], [''], [''], ['']]; // [v9.33] 입력칸 4개(B5 광고비 추가) — 구 3칸 대시보드는 B5=구분선이라 NaN→0으로 안전 폴백 후 1회 실행에 자가치유
  const cash = Number(inp[0][0]) || 0;
  /* [v9.127] 구 기본값 자동 승계 — 이 함수는 입력칸을 **읽은 값 그대로 되쓴다.** 그래서 과거 실행이 구 기본값
   *   (번 5250·BEP 131)을 시트에 박아 넣은 뒤로는 상수를 고쳐도 화면이 영영 안 바뀐다(08-02 Glide 실측:
   *   경영 탭이 정본 v1.3의 119명 대신 131명을 표시 중이었다). 셀 값이 **구 기본값과 정확히 같을 때만**
   *   새 정본값으로 승계한다 — 유호님이 직접 넣은 다른 숫자는 어떤 경우에도 건드리지 않는다. */
  const BIZ_BURN_LEGACY = 5250, BIZ_BEP_LEGACY = 131;
  const burnRaw = Number(inp[1][0]) || 0, bepRaw = Number(inp[2][0]) || 0;
  const burn = (!burnRaw || burnRaw === BIZ_BURN_LEGACY) ? BIZ_BURN_DEFAULT : burnRaw;
  const bep = (!bepRaw || bepRaw === BIZ_BEP_LEGACY) ? BIZ_BEP_DEFAULT : bepRaw;
  if (burnRaw === BIZ_BURN_LEGACY || bepRaw === BIZ_BEP_LEGACY) {
    Logger.log('경영 계기판: 구 기본값 승계 — 번 ' + burnRaw + '→' + burn + ' · BEP ' + bepRaw + '→' + bep + ' (정본 v1.3)');
  }
  const adSpend = Number(inp[3][0]) || 0; // [v9.33] 이번달 광고비(만₮) — CPL 계산용. 비면 0

  // ── 이탈률·전환율 = KPI 단일 소스 (당월 잠정 재계산 멱등 + 전월은 확정 우선)
  const prevYm = ymShift_(Utilities.formatDate(now, tz, 'yyyy-MM'), -1); // [v9.34] 전월 — 월키 TZ 단일화
  let kpiCur = null, kpiPrev = null;
  const kpiInj = (kpiData && kpiData.cur) ? kpiData : null; // [v9.29] weeklyJobs 주입치 재사용(이중 계산 제거) · 주입 없으면(단독 실행) 자체 계산
  if (kpiInj) { kpiCur = kpiInj.cur; kpiPrev = kpiInj.prev; }
  else {
    try { kpiCur = computeKpiMetrics(); kpiPrev = kpiReadRow_(prevYm) || computeKpiMetrics(prevYm); }
    catch (e) { Logger.log('경영계기판 KPI 읽기 실패(섹션은 계속): ' + e); }
  }

  // ── 재적·이탈위험 선행지표 (profiles Y열 25)
  const pf = ss.getSheetByName('profiles');
  let nStu = 0, riskHi = 0, riskMid = 0;
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 25).getValues().forEach(r => {
    if (!r[0] || r[3] !== 'student') return;
    nStu++;
    const rk = String(r[24] || '').charAt(0);
    if (rk === '상') riskHi++; else if (rk === '중') riskMid++;
  });

  // ── 마케팅 퍼널 (leads): 리드·참석률·추천비율·선납비중
  const L = [];
  if (sh.ld.getLastRow() >= 2) sh.ld.getRange(2, 1, sh.ld.getLastRow() - 1, 10).getValues().forEach(r => {
    const d = toDate_(r[0]) || (isNaN(new Date(r[0]).getTime()) ? null : new Date(r[0]));
    if (!d || !String(r[1] || '')) return;
    L.push({ t: d.getTime(), src: String(r[3] || ''), att: String(r[5]) === 'Y', enr: String(r[6]) === 'Y', term: String(r[7] || '') });
  });
  const in30 = L.filter(l => l.t > now.getTime() - 30 * DAY);
  const enr90 = L.filter(l => l.t > now.getTime() - 90 * DAY && l.enr);
  const att30 = in30.length ? Math.round(in30.filter(l => l.att).length / in30.length * 100) : null;
  const refPct = enr90.length ? Math.round(enr90.filter(l => l.src === '추천').length / enr90.length * 100) : null;
  const prePct = enr90.length ? Math.round(enr90.filter(l => l.term && l.term !== '1개월').length / enr90.length * 100) : null;

  // [v9.33] CPL — 이번달 광고비 ÷ 이번달 리드수(채널 무관 전체 리드). 몽골 CPM·CPL 벤치마크 부재 → 신호등 색 판정 보류(⚪ 고정), 값만 누적해 실측 기준을 세운다.
  const inMonth = L.filter(l => { const d = new Date(l.t); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
  const cpl = (adSpend > 0 && inMonth.length > 0) ? Math.round(adSpend / inMonth.length * 10) / 10 : null; // 데이터 부족(광고비 0 또는 리드 0)이면 null

  // [v9.28] 매출 — payments 시트(수동 기입) 당월 합계. 기입 없으면 다른 지표와 동일하게 '축적 중'
  let revenue = null;
  if (sh.pay.getLastRow() >= 2) {
    let sum = 0, any = false;
    sh.pay.getRange(2, 1, sh.pay.getLastRow() - 1, 4).getValues().forEach(r => {
      const d = toDate_(r[3]) || (isNaN(new Date(r[3]).getTime()) ? null : new Date(r[3]));
      if (!d) return;
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) { sum += Number(r[2]) || 0; any = true; }
    });
    if (any) revenue = sum;
  }

  // ── 신호등 판정 (진단 임계선)
  const surv = (burn > 0 && cash > 0) ? Math.round(cash / burn * 10) / 10 : null;
  const cvR = kpiCur ? kpiCur.convRate : null, cvN = kpiCur ? kpiCur.consult : 0;
  const chR = kpiCur ? kpiCur.churnRate : null, chPrevR = kpiPrev ? kpiPrev.churnRate : null;
  const stSurv = surv == null ? '⚪' : surv >= 6 ? '🟢' : surv >= 4 ? '🟡' : '🔴';
  const stConv = (cvR == null || cvN < 10) ? '⚪' : cvR >= 25 ? '🟢' : cvR >= 20 ? '🟡' : '🔴';
  const stChurn = chR == null ? '⚪' : chR <= 5 ? '🟢' : chR < 8 ? '🟡' : '🔴';
  const stRef = refPct == null ? '⚪' : refPct >= 15 ? '🟢' : '🟡';
  const stPre = prePct == null ? '⚪' : prePct >= 30 ? '🟢' : '🟡';
  const churn2x = chR != null && chPrevR != null && chR >= 8 && chPrevR >= 8;

  // ── 계기판 시트 재작성 (2행부터 — 입력칸 값은 읽은 그대로 되쓰기)
  const fmt = (v, unit) => v == null ? '— (축적 중)' : v + (unit || '');
  const rows = [
    ['[입력] 현금잔고(만₮)', cash || '', '', '월 1회 직접 입력 — 비어 있으면 생존개월수 미계산'],
    ['[입력] 월 번(만₮)', burn, '', '유지비. 사회보험·외국인고용부담금 확정 시 갱신'],
    ['[입력] BEP 목표(명)', bep, '', '손익분기 재적 — 급여 인센티브 정본 v1.3 = 119명(384석의 31%)'], // [v9.127] 구 '114~131명' 진단 범위 → 정본 인용
    ['[입력] 이번달 광고비(만₮)', adSpend || '', '', '이번 달 Meta 광고 지출 누계 — 직접 입력(월초 리셋). 비면 CPL 미계산'], // [v9.33] 4번째 입력칸(B5)
    ['── 자동 지표 ──', '갱신 ' + Utilities.formatDate(now, tz, 'MM-dd HH:mm'), '', '매주 월 07시 자동 · 수동 bizDashboardNow()'],
    ['⓪ 생존개월수', surv == null ? '현금잔고 입력 필요' : surv + '개월', stSurv, '현금÷번. 4.0 미만 = 적색(개원조건 미달)'],
    ['재적 (BEP까지)', nStu + '명 (' + Math.max(bep - nStu, 0) + '명 남음)', nStu >= bep ? '🟢' : '⚪', 'BEP ' + bep + '명 기준'],
    ['💰 이번달 매출(만₮)', revenue == null ? '— (축적 중)' : revenue, revenue == null ? '⚪' : '', 'payments 시트 당월 합계 — 원장이 직접 기입(hall_of_fame과 동일 방식)'], // [v9.28]
    ['① 리드 30일', in30.length + '건 · 체험참석률 ' + fmt(att30, '%'), '⚪', 'leads 시트 기입 기준 · 참석률 50% 목표'],
    ['② 전환율(상담→등록, 당월)', kpiCur ? kpiCur.conv + '/' + kpiCur.consult + '건 = ' + cvR + '%' : '— (KPI 미가동)', stConv, '25% 사수 · 20% 미만 적색(상담 10건+부터 판정) · 상세 kpi_metrics'],
    ['③ 추천 신규 비율(90일)', fmt(refPct, '%'), stRef, '등록자 중 유입경로=추천. 15→30% 목표'],
    ['④ 월 이탈률(당월 잠정)', (chR != null ? chR + '%' : '— (KPI 미가동)') + (chPrevR != null ? ' · 전월 ' + chPrevR + '%' : ''), stChurn, '≤5% 사수 · 8% 2개월 연속 = 마케팅 증액 금지 · 정의=출석 ' + KPI_CHURN_DAYS + '일+ 무활동'],
    ['이탈위험 상/중 (선행지표)', riskHi + '명 / ' + riskMid + '명', riskHi > 0 ? '🟡' : '🟢', 'profiles 이탈위험 — 담임 케어 SOP 대상'],
    ['⑤ 3개월+ 선납 비중(90일)', fmt(prePct, '%'), stPre, '등록자 중 3·6개월/번들. 30%+ = 겨울 방어선'],
    ['⑥ CPL (리드당 광고비)', cpl == null ? '— (광고비·리드 입력 후)' : cpl + '만₮/건', '⚪', '이번달 광고비 ' + (adSpend || 0) + '만₮ ÷ 이번달 리드 ' + inMonth.length + '건 · 몽골 벤치마크 부재로 색 판정 보류(실측 누적용)'] // [v9.33]
  ];
  sh.db.getRange(2, 1, rows.length, 4).setValues(rows);
  const extra = sh.db.getLastRow() - (rows.length + 1);
  if (extra > 0) sh.db.getRange(rows.length + 2, 1, extra, 4).clearContent();

  // ── 적색경보 — 긴급이라 다이제스트 큐 우회 즉시 발송, 월 1회 dedup(app_state)
  const alerts = [];
  if (surv != null && surv < 4) alerts.push('🚨 생존개월수 ' + surv + '개월 (<4.0) — 현금 확보 최우선. 지출 동결·개원/증설 보류 검토.');
  if (churn2x) alerts.push('🚨 월 이탈률 ' + chPrevR + '% → ' + chR + '%, 2개월 연속 8%+ — 마케팅 증액 금지. 리텐션 수술 우선(담임 결석 SOP·재등록 인터뷰·미등록사유 분석).');
  if (alerts.length) {
    const stA = ensureSheet(ss, 'app_state', ['key', 'value']);
    const sig = Utilities.formatDate(now, tz, 'yyyy-MM') + '_' + alerts.length;
    if (String(getState(stA, '경영경보_상태').val || '') !== sig) {
      if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 🚨 경영 적색경보', alerts.join('\n\n') + '\n\n📟 상세: 앱 스프레드시트 "경영계기판" 시트');
      setState(stA, '경영경보_상태', sig);
    }
  }

  // ── 주간 통합 리포트 섹션 텍스트
  const t = [
    '⓪ 생존개월수: ' + (surv == null ? '현금잔고 미입력 (계기판 B2)' : surv + '개월 ' + stSurv),
    '재적: ' + nStu + '명 (BEP ' + bep + '명까지 ' + Math.max(bep - nStu, 0) + '명)',
    '💰 이번달 매출: ' + (revenue == null ? '— (축적 중)' : revenue + '만₮'), // [v9.28]
    '① 리드 30일: ' + in30.length + '건 · 참석률 ' + fmt(att30, '%'),
    '② 전환율(상담→등록): ' + (kpiCur ? cvR + '% (' + kpiCur.conv + '/' + kpiCur.consult + ')' : 'KPI 미가동') + ' ' + stConv,
    '③ 추천 비율: ' + fmt(refPct, '%') + ' ' + stRef,
    '④ 이탈률: ' + (chR != null ? chR + '%' : 'KPI 미가동') + (chPrevR != null ? ' (전월 ' + chPrevR + '%)' : '') + ' ' + stChurn + ' · 이탈위험 상 ' + riskHi + '/중 ' + riskMid,
    '⑤ 3개월+ 선납: ' + fmt(prePct, '%') + ' ' + stPre,
    '⑥ CPL: ' + (cpl == null ? '— (광고비·리드 입력 후)' : cpl + '만₮/건 (광고비 ' + adSpend + '÷리드 ' + inMonth.length + ')') + ' ⚪' // [v9.33]
  ];
  if (alerts.length) t.push('', alerts.join('\n'));
  return t.join('\n');
}

// [v9.26] 수동 실행용 — 드롭다운에서 바로 보이는 정식 함수 (설치+갱신 원스톱)
function bizDashboardNow() { setupBizDashboard(); return updateBizDashboard(true); }

/* ===================== [v9.80] 🧩 조 편성 · 역할 로테이션 — 소그룹 20분을 앱이 짠다 =====================
 * 정본 = Desktop\SYNK LAB\「SYNK LAB 강사 수업 규칙」 v3.0 §5·§11 (2026-07-31)
 *   §11 "가장 먼저 만들 것 = 조 편성 데이터 — 조 편성 한 벌이 (배선 대기) 목록의 절반을 한꺼번에 엽니다"
 *   조·역할 자동 배정 → 발표 순번 자동 → 짝 조합 순환 → 발화량 추정 → 4주차 침묵 명단.
 *
 * ▣ 왜 앱이 짜는가 (유호님 2026-07-31 확정 "앱 자동 제안")
 *   반 16개 × 4조 × 4역할을 매 차시 손으로 돌리면 결석 한 번에 순번이 꼬이고, 8주 뒤엔 누가 몇 번
 *   발표했는지 아무도 모른다. 규칙서가 강사 머리에서 앱으로 넘긴 3개(전원 1회 발화·조별 산출물
 *   확인·발표 순번)가 전부 이 데이터 위에 선다.
 *
 * ▣ 규칙서 → 코드 대응
 *   4명 한 조 · 8주 고정           → groups 시트(시즌×반 1벌). 재편성해도 '고정'=Y 행은 자리 보존
 *   12명 이하 반은 3명씩 4조       → 조 수는 항상 4, 인원은 몫+나머지 분배(3명 조는 역할 3개만 순환)
 *   실력 섞기(빠른1 보통2 느린1)   → 실력 내림차순 스네이크 배분
 *   말수 섞기                      → 같은 배분 계층 안에서만 교환(실력 균형이 깨지지 않는다)
 *   같은 학교·동네는 다른 조       → 같은 원리로 교환. profiles 학교·동네 열이 비면 자동 생략
 *                                     (열은 langColOf_로 이름 탐색 — 번호를 박으면 공유 열 증설 때 어긋난다)
 *   역할 차시마다 한 칸            → roleOfSeat_(좌석, 차시) 순수 계산 — 시트에 쓰지 않는다
 *   2인 짝 3조합 순환              → pairSeatOf_(좌석, 차시)
 *   발표 8주 전원 최소 2회         → 역할 주기가 4차시라 주말반 8차시=정확히 2회·평일반 40차시=10회.
 *                                     로테이션이 이미 보장하므로 별도 순번표를 만들지 않는다.
 *
 * ▣ 쓰기 예산 (규칙서 §11 — Glide 월 500건 한도)
 *   조 편성은 시즌당 반별 1회(16반 × 8주 = 두 달에 16행). 역할·짝·발표자는 저장하지 않고 차시 번호에서
 *   계산한다. 매 차시 쓰기가 0이라 한도에 손대지 않는다. */

const GROUP_COUNT = 4;                                 // 규칙서 §5·§9 — 인원과 무관하게 4조(교실의 4인 섬 4개와 1:1)
const ROLE_NAMES = ['진행', '기록', '발표', '질문'];    // 순환 순서 — 진행 → 기록 → 발표 → 질문 → 진행
const ROLE_ICONS = ['🎯', '✍️', '📢', '❓'];
/* 발화량 가중(규칙서 역할 상세: 진행·발표=많음 / 기록·질문=보통).
 * ⚠ **이 가중이 재는 것은 「소그룹 20분」 하나뿐이다** — 숙제 서클 재검 판정 08-13(설계 §10-4).
 *   서클(수업 첫 20분)의 주 발화는 브리핑이고, 브리핑은 **역할과 무관하게 전원 균등**이다.
 *   그래서 가중은 그대로 둔다 — 서클은 소그룹이라는 «다른 활동»을 안 바꾼다. 바꾼 것은 **범위**다:
 *   talkIndexOf_ 는 이제 그날 발화의 «전부»가 아니라 소그룹 몫을 잰다. 이름을 안 고치면
 *   「구조적으로 덜 받았다」가 실제보다 크게 읽힌다(서클이 매 차시 균등한 차례를 하나씩 더 준다).
 *   🚫 가중 평탄화 — 편성의 '말수 섞기' 기준이 통째로 무의미해진다(v9.99 판정 유지).
 *   ⏳ 서클 발화를 지수에 합칠지는 **첫 시즌 실측 뒤**다: 지금 합치면 상수를 지어내는 것이고,
 *      학생 0명이라 그 상수가 맞는지 잴 방법이 없다. */
const ROLE_TALK = [2, 1, 2, 1];
const SEASON_WEEKS = 8;
/* [v9.99] 역할별 '발화 의무' — v9.80은 역할 이름만 줬다. 이름은 자리를 정하지만 입을 열게 하지는 않는다.
 *   기록·질문은 가중 1(저발화)인데 로테이션 주기가 4차시라, 학생은 4차시 중 2차시를 저발화 역할로 보낸다.
 *   의무 한 줄을 붙여 저발화 역할에도 발화를 심는다. 특히 '질문 = 고칠 문장 1개'는 강사가 못 듣는
 *   소그룹 3/4 구간(강사 1명 : 4조 = 조당 5분)에 학생 상호 교정을 심는 장치다.
 *   ⚠ ROLE_TALK 가중은 그대로 둔다 — 의무 발화는 30초·1문장이고 진행·발표는 활동 내내 말한다.
 *     격차는 줄지만 남으며, 가중을 평탄화하면 편성의 '말수 섞기' 기준이 무의미해진다. */
const ROLE_DUTY = ['한국어 유지 감시', '마지막 30초 요약', '조 결론 발표', '고칠 문장 1개'];
/* [v9.99] 소그룹 20분 타임박스 — 20분을 "알아서 하세요"로 두지 않는다.
 *   1분 계획(말 없이 메모) → 4·3·2분 3라운드(라운드마다 짝 교대) → 정리·발표. 합 19분(전환 여유 1분).
 *   ① 계획 1분: 하위권의 침묵은 할 말이 없어서가 아니라 조립할 시간이 없어서다. 20분에서 1분을 떼면
 *      남은 19분의 밀도가 오른다.  ② 4/3/2: 같은 과제를 짝을 바꿔 반복하면 인지 여유가 정확도로 넘어간다.
 *   ⚠ Lv1~3 유창성 차시 기준. 상급은 내용 깊이가 목표라 3회 반복이 폭을 줄인다 — 강사가 끄는 판단은 재량(§6-2). */
const TALK_PLAN_MIN = 1;
const TALK_ROUNDS = [4, 3, 2];
const FOCUS_START_WEEK = 3;                            // 정밀 청취 시작 주차 — 1~2주차는 조 자율 운행 미성숙
// 4인 조의 2인 짝 3조합 — 값 = 그 좌석의 짝 좌석. (0,1)(2,3) / (0,2)(1,3) / (0,3)(1,2)
const PAIR_PATTERNS = [[1, 0, 3, 2], [2, 3, 0, 1], [3, 2, 1, 0]];
// GROUPS_HEADERS 정본은 Code.js(KPI_HEADERS 옆) — [v9.135] 골격이 지연 평가라 순서 제약은 없어졌지만, 헤더 정본은 상수 정본 파일(Code.js)에 모아 둔다.

/* --- 시즌 시작일 — 차시 번호의 원점. 이 한 줄이 없으면 역할·짝·발표가 전부 안 돈다 --- */
function seasonStartOf_(ss) {
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  return toDate_(getState(st, '시즌시작일').val);
}

/* 시즌 1주차 1차시 날짜를 박습니다. 예: setSeasonStart('2027-02-01')
 * ⚠ 인자 없이 실행하면 설정하지 않고 현재 상태만 알려준다 — Apps Script 편집기의 ▶ 버튼은 인자를 못 넘기므로,
 *   "인자 없으면 오늘"로 두면 확인하려고 누른 ▶ 한 번에 엉뚱한 날짜가 시즌 시작일로 박힌다.
 *   시즌 시작일이 틀어지면 차시 번호가 통째로 밀려 역할·짝·발표자가 전부 어긋난다. */
function setSeasonStart(dateStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  if (!dateStr) {
    const cur = seasonLabelOf_(ss, tz);
    return (cur ? '현재 시즌 시작일 = ' + cur : '시즌 시작일이 아직 없습니다.') + '\n' +
      '바꾸려면 둘 중 하나:\n' +
      '  ① app_state 시트에 key="시즌시작일" · value="2027-02-01" 한 행 (▶ 없이 바로 반영)\n' +
      '  ② 코드에서 setSeasonStart("2027-02-01") 호출\n' +
      '※ ▶ 버튼만으로는 설정되지 않습니다(실수로 오늘 날짜가 박히는 것을 막기 위함).';
  }
  const d = toDate_(dateStr);
  if (!d) return '⚠ 날짜를 읽지 못했습니다 — setSeasonStart("2027-02-01") 형태로 실행하세요.';
  const s = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  setState(ensureSheet(ss, 'app_state', ['key', 'value']), '시즌시작일', s);
  const end = new Date(d.getTime() + (SEASON_WEEKS * 7 - 1) * 86400000);
  return '✅ 시즌 시작일 = ' + s + ' (8주 → ' + Utilities.formatDate(end, tz, 'yyyy-MM-dd') + ' 종료)\n' +
    '   다음: assignGroupsAll() ▶ 1회로 전 반 조 편성';
}

/* [v9.132] 🔴 시즌 키 정규화 — 월키 Date 오염의 **네 번째** 재현 지점(groups 시트 A열).
 *   시즌 라벨은 `2026-07-13` 형태라 시트가 날짜로 자동 파싱한다. 그러면 `String(r[0])`이
 *   `Mon Jul 13 2026 00:00:00 GMT+0800…`이 되어 라벨과 **영원히 안 맞는다.** 08-02 실측 결과:
 *     ① 조 편성은 "✅ 1명 확정"으로 성공하는데 ② 조 편성표는 "편성 행이 없습니다"를 돌려준다
 *     ③ 더 위험한 것 — `assignGroups`의 「같은 시즌·반 행을 걷어내고 새로 쓴다」 필터도 안 맞아
 *        **재실행이 교체가 아니라 누적**이 된다(한 학생이 여러 조에 동시에 들어간다).
 *   그래서 비교는 전부 이 함수를 통과시킨다 — 셀이 Date든 문자열이든 같은 키가 나오게. */
function seasonKeyOf_(v, tz) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, tz || Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const s = String(v == null ? '' : v).trim();
  // String(Date)가 텍스트로 굳은 형태(v9.129와 같은 계열)
  if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{4}/.test(s)) {
    const p = new Date(s);
    // 로컬 게터 금지 — 런타임 시간대(GAS=스크립트 tz, CI=UTC)에 따라 날짜가 밀린다. tz 인자가 결정해야 한다.
    if (!isNaN(p.getTime())) return Utilities.formatDate(p, tz || Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return s;
}
// 시즌 라벨 — groups 행의 키. 시작일이 곧 시즌 이름(중복·재사용 사고가 없다)
function seasonLabelOf_(ss, tz) {
  const d = seasonStartOf_(ss);
  return d ? Utilities.formatDate(d, tz || ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : '';
}

/* --- 차시 번호 — 시즌 시작일부터 '그 반이 수업하는 요일'만 세어 몇 번째 차시인지.
 *     평일반은 월~금(주 5차시), 주말반은 토(주 1차시). classDowOk_과 같은 판정을 쓴다. --- */
function lessonNoOf_(start, target, type) {
  if (!start || !target) return 0;
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  if (t < s) return 0;
  const days = Math.round((t - s) / 86400000);
  if (days > SEASON_WEEKS * 7 + 14) return 0;           // 시즌 밖 — 무한 루프·오래된 시작일 방어
  let n = 0;
  const d = new Date(s);
  for (let i = 0; i <= days; i++) {
    if (classDowOk_(type, d.getDay())) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

// 시즌 주차(1~8) — 4주차 침묵 명단·3주차 오류 톱10 같은 리듬 장치의 기준
function seasonWeekOf_(start, target) {
  if (!start || !target) return 0;
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  if (t < s) return 0;
  return Math.floor(Math.round((t - s) / 86400000) / 7) + 1;
}

/* --- 역할·짝 — 저장하지 않고 계산한다(매 차시 쓰기 0) --- */
// 좌석 seat(0~) · 차시 lessonNo(1~) → 역할명. 조 인원이 3명이면 앞 3개(진행·기록·발표)만 돈다.
function roleOfSeat_(seat, lessonNo, size) {
  const k = Math.max(1, Math.min(Number(size) || GROUP_COUNT, ROLE_NAMES.length));
  const n = Math.max(1, Number(lessonNo) || 1);
  return ROLE_NAMES[(((Number(seat) || 0) + n - 1) % k + k) % k];
}
function roleIconOf_(seat, lessonNo, size) {
  const k = Math.max(1, Math.min(Number(size) || GROUP_COUNT, ROLE_ICONS.length));
  const n = Math.max(1, Number(lessonNo) || 1);
  return ROLE_ICONS[(((Number(seat) || 0) + n - 1) % k + k) % k];
}
// 그 차시의 짝 좌석(4인 조만). 3인 조는 셋이 함께 하므로 -1.
// [v9.125] '< 4' → '!== 4' — 5인 조(정원 초과)에서 좌석4가 좌석0의 짝 배열을 복제해 짝이 서로를 안 가리켰다.
function pairSeatOf_(seat, lessonNo, size) {
  if ((Number(size) || GROUP_COUNT) !== 4) return -1;
  const n = Math.max(1, Number(lessonNo) || 1);
  return PAIR_PATTERNS[((n - 1) % 3 + 3) % 3][(Number(seat) || 0) % 4];
}
/* [v9.99] 한 차시 안의 3라운드 짝 — PAIR_PATTERNS를 '차시마다 1조합'이 아니라 '한 차시에 3조합 전부'로 쓴다.
 *   같은 상수, 새 의미: 4/3/2의 상대가 라운드마다 바뀐다(= 학생에게는 "오늘 세 번의 만남").
 *   기존 pairSeatOf_(차시별 대표 짝)는 4/3/2를 끄는 차시용으로 그대로 둔다 — 어느 쪽도 시트에 쓰지 않는다. */
function pairRoundsOf_(seat, size) {
  // [v9.125] 4인 조에서만 짝을 만든다 — 구 '< 4'는 5인 조(정원 초과 17명 반)를 통과시켰고,
  //   %4 접기로 좌석4가 좌석0과 같은 짝 배열을 받아 학생 앱과 강사 편성표가 서로 다른 짝을 말했다
  //   (좌석4의 "1R 좌석1" ↔ 좌석1의 "1R 좌석0" 충돌). 4인이 아니면 [] = "조 전체" 폴백으로 항상 정합.
  if ((Number(size) || GROUP_COUNT) !== 4) return [];
  const s = ((Number(seat) || 0) % 4 + 4) % 4;
  return PAIR_PATTERNS.map(p => p[s]);
}
/* [v9.99] 정밀 청취 조 — 유호님 08-01 채택(도전안: 순회 지도를 버린다).
 *   순회(4조 × 5분)는 어느 학생의 오류도 정확히 못 잡는다. 그래서 student_errors가 빈 채로 남고,
 *   그 시트가 비면 반 브리핑 '연습 포인트'·AI 개인화·3주차 오류 톱10이 전부 빈 껍데기로 돈다
 *   — 체인 전체가 강사의 실측 입력 한 칸에 물려 있다.
 *   한 차시에 한 조만 20분 내내 듣는다: 4차시면 전원 1회전, 8주 시즌 2회전(주말반은 1회전).
 *   0 = 표시하지 않음(1~2주차는 조가 아직 자율 운행을 못 해 나머지 3조 방치가 통제 리스크). */
function focusGroupOf_(lessonNo, week, groupCount) {
  // [v9.125] 실제 조 수를 받는다 — 구 버전은 항상 1~4를 돌아 3명 반(조 3개)에 "오늘 정밀 청취 = 4조"라는
  //   존재하지 않는 조를 지시했다. 정밀 청취는 student_errors 체인의 유일한 입구라 지시 불능 = 체인 공백.
  const gc = Math.max(1, Math.min(Number(groupCount) || GROUP_COUNT, GROUP_COUNT));
  const n = Number(lessonNo) || 0, w = Number(week) || 0;
  if (n < 1 || w < FOCUS_START_WEEK) return 0;
  return ((n - 1) % gc) + 1;
}
/* [v9.99] 날짜 → 차시 번호 맵 — lessonNoOf_를 출석 행마다 부르면 그 안의 일자 루프가 행 수만큼 반복된다.
 *   시즌 시작~기준일을 한 번만 훑어 'yyyy-MM-dd' → 차시 번호를 만든다(발화 지수의 조인 축). */
function lessonDayMap_(start, until, type, tz) {
  const out = {};
  if (!start || !until) return out;
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const t = new Date(until.getFullYear(), until.getMonth(), until.getDate());
  const days = Math.round((t - s) / 86400000);
  if (days < 0 || days > SEASON_WEEKS * 7 + 14) return out;   // 시즌 밖·오래된 시작일 방어(lessonNoOf_와 같은 창)
  let n = 0;
  const d = new Date(s);
  for (let i = 0; i <= days; i++) {
    if (classDowOk_(type, d.getDay())) { n++; out[Utilities.formatDate(d, tz, 'yyyy-MM-dd')] = n; }
    d.setDate(d.getDate() + 1);
  }
  return out;
}
/* [v9.99] 출석 원본 1회 읽기 — 브리핑은 한 실행에 반 18개를 도는데, 반마다 attendance를 통째로 읽으면
 *   같은 시트를 18번 훑는다. 실행 단위 메모이즈(Apps Script는 실행마다 전역이 초기화되므로 stale 없음).
 *   차시 번호로의 변환은 반 type(평일/주말)마다 다르니 여기서는 날짜까지만 만든다. */
let TALK_ATT_CACHE_ = null;
function attDayMapCached_(ss, tz) {
  if (TALK_ATT_CACHE_) return TALK_ATT_CACHE_;
  const out = {};
  const at = ss.getSheetByName('attendance');
  if (at && at.getLastRow() >= 2) {
    at.getRange(2, 2, at.getLastRow() - 1, 2).getValues().forEach(r => {   // B student_id · C timestamp
      if (!r[0] || !r[1]) return;
      const d = asDate_(r[1]);
      if (!d || isNaN(d.getTime())) return;
      (out[String(r[0])] = out[String(r[0])] || {})[Utilities.formatDate(d, tz, 'yyyy-MM-dd')] = 1;
    });
  }
  TALK_ATT_CACHE_ = out;
  return out;
}

/* [v9.99] 🔈 발화 지수 — ROLE_TALK를 처음으로 실제 계산에 쓴다.
 *   v9.80은 이 상수를 선언만 하고 어디서도 참조하지 않아, 헤더가 약속한 「발화량 추정」이 주석으로만
 *   존재했다(08-01 발견). 역할 로테이션이 만드는 발화량 편차를 아무도 측정하지 않고 있었다는 뜻이다.
 *
 *   지수 = 그 학생이 '실제 출석한 차시'의 역할 가중 합. 역할은 좌석·차시의 결정론이라 개근하면 전원이
 *   거의 같아진다 — 벌어지는 원인은 셋뿐이고, 셋 다 강사가 눈으로는 못 보는 것이다.
 *     ① 결석: 그날 배정됐던 역할(진행·발표일 수도 있다)을 통째로 못 받았다
 *     ② 3인 조: 역할이 3개만 돌아 '질문'이 없다
 *     ③ 미발화 기록(마감폼): 자리는 받았는데 실제로 말하지 않았다 → 가중에서 뺀다
 *   그래서 하위권 = "구조적으로 말할 차례를 덜 받은 학생"이고, 지명은 인상이 아니라 이 순서로 간다.
 *   4주차 침묵 명단(시즌 1회·이진)의 상시·연속값 짝 — 그쪽이 경보라면 이쪽은 계기판이다.
 *   board = groupBoardOf_ 결과(좌석·조 크기 재사용, groups 재읽기 0). 반환 = [{sid,name,grp,got,max,quiet,pct}] 오름차순. */
function talkIndexOf_(ss, cls, when, tz, board, quietMap) {
  const b = board || groupBoardOf_(ss, cls, when, tz);
  if (!b || !b.lessonNo) return [];
  const start = seasonStartOf_(ss);
  const sch = schedOf(scheduleMap(ss), cls);
  const dayMap = lessonDayMap_(start, when || new Date(), sch ? sch.type : '평일', tz);
  const byDay = attDayMapCached_(ss, tz);                      // sid → {'yyyy-MM-dd': 1}
  const quiet = quietMap || quietScoreMap_(ss);
  const out = [];
  const lessonSeen = {};                                       // sid → {차시번호: 1} (반 type의 dayMap으로 변환)
  Object.keys(byDay).forEach(sid => {
    Object.keys(byDay[sid]).forEach(ymd => {
      const n = dayMap[ymd];                                   // 시즌 밖·수업 없는 날(보강 등)은 분모에 없다
      if (n) (lessonSeen[sid] = lessonSeen[sid] || {})[n] = 1;
    });
  });
  b.groups.forEach((arr, g) => arr.forEach(m => {
    let got = 0, max = 0;
    for (let n = 1; n <= b.lessonNo; n++) {
      const w = ROLE_TALK[ROLE_NAMES.indexOf(roleOfSeat_(m.seat, n, arr.length))] || 0;
      max += w;
      if ((lessonSeen[m.sid] || {})[n]) got += w;
    }
    const q = Number(quiet[m.sid] || 0);
    const adj = Math.max(got - q * ROLE_TALK[0], 0);           // 미발화 1회 = 최고 가중 1차시를 통째로 무효로 본다
    out.push({ sid: m.sid, name: m.name, grp: g + 1, got: got, max: max, quiet: q,
      pct: max ? Math.round(adj / max * 100) : 0 });
  }));
  return out.sort((x, y) => x.pct - y.pct || String(x.sid).localeCompare(String(y.sid)));
}
/* [v9.233] 🗣 발화 지수 «결과 저장» — 재고 버리던 것을 남긴다(세계판 대조 08-14: 말하기 평가의 결과가 안 남는 칸).
 *   talkIndexOf_ 는 조 편성표·교안 §12 에 실리고 버려져, 시즌이 지나면 궤적이 사라졌다. weeklyJobs(매주 월 07시)가
 *   반×학생 스냅샷을 talk_index_log 에 적재하고, 소비자는 주간 리포트 꼬리(weeklyReport — 전주 대비)다.
 *   멱등 키 = (시즌|주차|student_id) — 재실행이 행을 늘리지 않는다. 한계(정직 고지): 스냅샷은 주 1회 사진이라
 *   같은 주 안의 값 변화는 첫 실행 값으로 남는다(월 07시 이후 그 주의 출석·마감폼은 다음 주 행에 반영).
 *   ⚠ 이 로그·리포트는 원장 내부 계기판이다 — 학생·학부모 화면에 싣지 않는다(㉢ 학생 간 비교 금지는 학생 접점 규칙). */
/*   ⚠ 이름은 `TALK_INDEX_LOG_*` 다 — `TALK_LOG_HEADERS` 는 엔진_수집.js 의 회화 로그(talk_log)가 이미 쓴다.
 *   Apps Script 는 전역을 파일 순서대로 초기화해 const 재선언이 SyntaxError 로 **프로젝트를 통째로** 죽인다
 *   (구문검사는 파일 단위라 통과하고, 합본을 평가하는 tests/월키원인차단.test.js 가 실측으로 잡았다). */
const TALK_INDEX_LOG_SHEET = 'talk_index_log';
const TALK_INDEX_LOG_HEADERS = ['logged_at', 'season', 'week', 'class', 'student_id', 'name', 'got', 'max', 'quiet', 'pct'];
function talkIndexSnapshot_(ss, tz, when) {
  tz = tz || ss.getSpreadsheetTimeZone();
  const now = when || new Date();
  const start = seasonStartOf_(ss);
  if (!start) return '시즌 시작일 미설정 — 적재 없음.';
  const week = seasonWeekOf_(start, now);
  if (week < 1 || week > SEASON_WEEKS) return '시즌 기간 밖(주차 ' + week + ') — 적재 없음.';
  const season = seasonLabelOf_(ss, tz);
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return '프로필 없음 — 적재 없음.';
  const cls = {};
  pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
    const cN = 반키_(r[4]);                                    // [v9.235] 「정규반2(9시)」→「정규반2」 — groups B열과 같은 키로 접는다
    if (r[0] && r[3] === 'student' && cN) cls[cN] = 1;
  });
  /* [v9.234] 분모는 «끝난 차시»까지만 — 이 적재는 월요일 07시, 그날 수업 «전»에 돈다. `lessonNoOf_` 는
   *   대상일을 포함해 세므로(:1575 `i <= days`) `now` 를 그대로 넘기면 평일반은 **아직 안 한 월요일 차시**가
   *   max 에 들어가 지수가 상시 낮게 나온다(1주차는 분모 1·분자 0 이라 0%). 어제 끝까지로 잰다.
   *   ⚠ 주차 «표기»는 now 기준 그대로다 — 이 행의 뜻은 「N주차 «시작 시점»의 누적」이고, 소비자의 전주 대비도
   *   누적 대 누적이라 뜻이 안 갈린다. 시즌 첫 월요일엔 lessonNo=0 이라 행이 아예 안 생긴다(그게 옳다). */
  const 잰시각 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 0);
  const quiet = quietScoreMap_(ss);                            // 반 루프 밖 1회 — talkIndexOf_ 가 반마다 lesson_close 를 다시 읽지 않게
  /* 무거운 반별 계산은 락 «밖»에서 끝낸다 — 락은 아래 읽기·검사·쓰기만 감싼다. */
  const 후보 = [];
  const 실패반 = [];                                           // 서명이 될 «이름(원인 첫 줄)»
  const 실패상세 = [];                                         // 진단용 스택 — 서명 밖(둘째 줄 아래)
  Object.keys(cls).sort().forEach(cN => {
    let ti = [];
    /* [v9.234] 실패한 반을 «이름으로» 모은다 — 예전엔 Logger.log 한 줄로 삼켜서, 그 반 학생이 전원 빠져도
     *   `safeRun` 은 배치를 성공으로 보고했다(미실행이 통과와 같은 모양 · F207). 이제 요약에 실려 나간다. */
    /* [v9.236] 원인 «첫 줄»까지 이름 옆에 붙인다 — 반 이름만으로는 같은 반의 «다른» 실패가 같은 dedup
     *   서명을 공유해 그날 두 번째 원인이 영영 안 알려진다(검수 758bae69853f). 스택은 아래 줄로 보낸다:
     *   서명은 첫 줄 120자라(:1002) 스택이 앞에 오면 안정성이 깨지고, 아예 없으면 진단이 로그 뒤짐이 된다. */
    try { ti = talkIndexOf_(ss, cN, 잰시각, tz, null, quiet); }
    catch (e) {
      실패반.push(cN + '(' + String(e && e.message ? e.message : e).split('\n')[0].slice(0, 60) + ')');
      실패상세.push(cN + ' ← ' + String(e && e.stack ? e.stack : e));
      Logger.log('발화 지수 적재 실패(' + cN + '): ' + e);
    }
    ti.forEach(x => { if (x.max) 후보.push([cN, x]); });        // 아직 잴 차시가 없는 학생 — 행을 만들지 않는다
  });
  /* [v9.234] 읽기·검사·쓰기를 스크립트 락으로 직렬화한다 — 예약 실행과 손 재실행이 겹치면 두 실행이 같은
   *   `seen` 을 보고 같은 키를 나란히 붙여, 선언한 멱등성이 깨진다(append-only 라 되돌리기도 어렵다). */
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  const rows = [];
  let dup = 0;
  try {
    const sh = ensureSheet(ss, TALK_INDEX_LOG_SHEET, TALK_INDEX_LOG_HEADERS);
    const seen = {};                                           // 'season|week|sid' → 1 (기존 행)
    /* [v9.234] 시즌 칸은 `seasonKeyOf_` 로 접어서 읽는다 — 시트 기본 서식이 'yyyy-MM-dd' 문자열을 **Date 로
     *   삼켜서**, 다시 읽으면 'Mon Aug 17 2026…' 이 되어 멱등 키가 영영 안 맞는다(재실행마다 같은 주차가
     *   통째로 중복 적재된다). `groups` 시트가 v9.132 에 이미 물린 함정이고 그 처방이 이 함수다 — 새 로그만
     *   그 통로를 안 타고 맨몸 `String()` 으로 대조하고 있었다(같은 판정이 두 곳에 있으면 갈라진다). */
    if (sh.getLastRow() >= 2) sh.getRange(2, 2, sh.getLastRow() - 1, 4).getValues()
      .forEach(r => { seen[seasonKeyOf_(r[0], tz) + '|' + String(r[1]) + '|' + String(r[3])] = 1; });
    후보.forEach(p => {
      const cN = p[0], x = p[1];
      const k = season + '|' + week + '|' + x.sid;
      if (seen[k]) { dup++; return; }
      seen[k] = 1;
      rows.push([now, season, week, cN, x.sid, x.name, x.got, x.max, x.quiet, x.pct]);
    });
    // 반·student_id·이름은 상담시트·폼에서 온 「남의 글」이 profiles→groups 를 거쳐 흘러온 원문이다(아포스트로피 접두는
    //   저장 때 소비돼 getValues 가 원문을 돌려주므로 앞단 소독은 여기서 되살아나지 않는다 — Code.js:1036 주석).
    //   append 형 로그의 선례(lesson_close·lecture_view)와 같은 공용 통로를 탄다: 문자열만 셀안전_, Date·number 는 타입 보존.
    if (rows.length) {
      // 시즌 칸을 텍스트로 못박아 «다음» 적재부터는 삼킴 자체가 안 일어나게 한다(위 읽기 정규화와 짝 — 한쪽만으론 못 닫는다:
      //   서식은 새 시트만 지키고, 이미 Date 로 굳은 옛 행은 읽기 정규화가 산다).
      sh.getRange(1, 2, sh.getMaxRows(), 1).setNumberFormat('@');
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, TALK_INDEX_LOG_HEADERS.length).setValues(행소독_(rows));
    }
  } finally { lock.releaseLock(); }
  const 요약 = '발화 지수 적재 — 신규 ' + rows.length + '행 + 중복 스킵 ' + dup + '행 (시즌 ' + season + ' · ' + week + '주차 · 반 ' + Object.keys(cls).length + '개)';
  /* [v9.235] 실패 반이 있으면 «적재를 끝낸 뒤» 던진다 — 여태 이 요약은 :1094 에서 `Logger.log` 로만 가서
   *   `safeRun` 의 오류 경로(실패 메일·재시도)를 안 탔다. 그 반 학생이 전원 빠져도 배치는 «성공»으로
   *   보고됐다 — 미실행이 통과와 같은 모양이다(F207 · 검수 05a4f9b9c40e).
   *   던지는 자리가 락 «밖»·쓰기 «뒤»인 이유: 한 반이 실패했다고 나머지 반 적재를 통째로 버리면 안 된다.
   *   ⚠ 첫 줄에 행수 같은 «변동값»을 넣지 않는다 — `safeRun` 의 dedup 서명이 에러 첫 줄 120자라(:1002),
   *      매번 서명이 달라지면 하루 1통 제한이 풀려 실패 메일이 메일 쿼터를 태우고 학부모·미납 알림까지
   *      죽는다(:998 주석이 경고하는 바로 그 자기증폭). 반 이름은 안정적이라 서명이 고정된다.
   *      ⚠ 이 「고정된다」가 **절반만 참이었다** — 고정은 됐는데 «너무» 고정돼서, 120자 밖으로 밀린 반의
   *         원인이 바뀌어도 서명이 안 갈렸다(아래 `원인지문_`). 안정성과 «분해능»은 다른 축이다. */
  /* [v9.237·검수 c59f24d9] 원인 지문을 **앞쪽에** 실어 「절단 밖」을 닫는다 — 이름만 이어 붙이면 실패 반이
   *   둘만 넘어도 뒤쪽 원인이 120자 밖으로 밀려 그 반의 고장이 바뀌어도 서명이 그대로였다(위 `원인지문_`). */
  if (실패반.length) throw new Error('발화 지수 적재 — 실패 반 ' + 실패반.length + '개 #' + 원인지문_(실패반)
    + ': ' + 실패반.join(', ')
    + '\n' + 요약 + '\n' + 실패상세.join('\n'));
  return 요약;
}
/* [v9.99] 학생용 오늘의 만남 — sid → "1R 바트 · 2R 사란 · 3R 뭉흐".
 *   calcAll이 profiles DY129에 싣는다. 오늘 수업이 없는 반은 키를 만들지 않는다(학생 화면 공란 = 카드 숨김).
 *   groups 1회 읽기 · 반 수만큼 순회. 편성 전이면 빈 맵(개원 전 무소음 — 조용한 공백이 정상인 구간). */
function todayPairsBySid_(ss, tz, when) {
  const out = {};
  const season = seasonLabelOf_(ss, tz);
  const start = seasonStartOf_(ss);
  const gs = ss.getSheetByName('groups');
  if (!season || !start || !gs || gs.getLastRow() < 2) return out;
  const schM = scheduleMap(ss);
  const whenD = when || new Date();
  const byCls = {};
  gs.getRange(2, 1, gs.getLastRow() - 1, GROUPS_HEADERS.length).getValues().forEach(r => {
    if (seasonKeyOf_(r[0], tz) !== season || !r[1]) return; // [v9.132] Date 오염 면역
    (byCls[String(r[1])] = byCls[String(r[1])] || []).push(r);
  });
  Object.keys(byCls).forEach(c => {
    const sch = schedOf(schM, c);
    const type = sch ? sch.type : '평일';
    if (!classDowOk_(type, whenD.getDay())) return;      // 오늘 수업 없는 반 — 어제 짝이 남아 있으면 오히려 오정보
    if (seasonWeekOf_(start, whenD) > SEASON_WEEKS) return; // [v9.125] 시즌 종료 — 유예 14일 구간의 유령 차시 차단
    const lessonNo = lessonNoOf_(start, whenD, type);
    if (!lessonNo) return;                               // 시즌 기간 밖
    const groups = [];
    for (let g = 0; g < GROUP_COUNT; g++) groups.push([]);
    byCls[c].forEach(r => {
      const g = Math.min(Math.max(Number(r[4]) - 1, 0), GROUP_COUNT - 1);
      groups[g].push({ sid: String(r[2]), name: String(r[3] || r[2]), seat: Number(r[5]) || 0 });
    });
    groups.forEach(arr => {
      arr.sort((a, b) => a.seat - b.seat);
      arr.forEach(m => {
        const names = pairRoundsOf_(m.seat, arr.length)
          .map(s => { const x = arr.filter(y => y.seat === s)[0]; return x ? x.name : ''; }).filter(Boolean);
        out[m.sid] = names.length
          ? '🤝 오늘 세 번 만나요 — ' + names.map((n, i) => (i + 1) + '번째 ' + n).join(' · ')
          : '🤝 오늘은 조 전체가 함께 이야기해요';
      });
    });
  });
  return out;
}

/* [v9.99] 강사가 매 차시 보는 20분 운영 지시 — 프로토콜을 문서에만 두면 개원 3주면 아무도 안 본다.
 *   조 편성표가 나가는 모든 경로(브리핑 메일·수업 직전 메일·반 상세 HUD·주간 교안)에 같은 원천으로 실린다. */
function talkProtocolLines_(focusGrp) {
  const L = ['  ⏱ 소그룹 20분 — ' + TALK_PLAN_MIN + '분 계획(말 없이 메모만) → ' +
    TALK_ROUNDS.map((m, i) => (i + 1) + 'R ' + m + '분').join(' → ') + ' (라운드마다 짝 교대) → 조별 정리 → 발표',
    '  🗣 역할 의무 — ' + ROLE_NAMES.map((n, i) => ROLE_ICONS[i] + ' ' + n + '=' + ROLE_DUTY[i]).join(' · ')];
  if (focusGrp) L.push('  🎧 오늘 정밀 청취 = ' + focusGrp + '조 — 20분 내내 이 조에 붙어 실제 문장을 받아적고, ' +
    '끝나면 약점 메모 폼에 넣으세요(나머지 3조는 역할·타이머로 자율 운행)');
  return L;
}

/* --- 실력 점수 — 급수(BO)가 있으면 급수가 지배하고, 없는 학생끼리는 누계 포인트·출석으로 가른다.
 *     개원 첫 시즌엔 전원 급수가 비어 있어 사실상 포인트 순이 된다(그래서 1주차는 임시 조다). --- */
function skillScoreOf_(r) {
  const lv = Number(r[66]) || 0;    // BO 현재급수
  const pts = Number(r[15]) || 0;   // P 획득 누계
  const att = Number(r[21]) || 0;   // V 출석 누계
  return lv * 1000000 + pts + att * 10;
}

/* --- 침묵 점수 — 규칙서 §5 "말 많은 학생을 한 조에 몰지 않기"의 실질 목적은
 *     조용한 학생을 흩어놓는 것이다(§6: 조용한 학생은 조용한 채로 8주를 보내고 재등록하지 않는다).
 *     원천 = 차시 마감폼의 「미발화자」(v9.91). 값이 클수록 말이 없었던 학생이고, 편성은 이들을
 *     한 조에 몰지 않는다. 마감폼 응답이 없으면 빈 맵이 돌아오고 이 기준만 조용히 생략된다. --- */
function quietScoreMap_(ss) {
  // [v9.125] 시즌 필터 — 구 버전은 개원 이래 전 기간을 누적해, 시즌이 거듭될수록 과거의 조용함이
  //   현재 발화 지수(adj = got − q×w)를 영구 잠식했다(시즌 시작 직후부터 pct 0 = 지명 우선 영구 점유).
  //   silentRosterAlert_와 같은 규칙: A열 날짜가 시즌 시작 전이면 제외. 시즌 미설정이면 전 기간(개원 전 하위호환).
  const out = {};
  const sh = ss.getSheetByName('lesson_close');
  if (!sh || sh.getLastRow() < 2) return out;
  const start = seasonStartOf_(ss);
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h));
  const col = head.indexOf('미발화자');
  if (col < 0) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, col + 1).getValues().forEach(r => {
    if (start) { const d = toDate_(r[0]); if (!d || d < start) return; }
    String(r[col] || '').split(/[,·\n]/).forEach(s => {
      const id = s.trim();
      if (id) out[id] = (out[id] || 0) + 1;
    });
  });
  return out;
}

/* --- 조 편성 코어 — 실력 스네이크 배분 후, 계층을 깨지 않는 교환으로 말수·학교를 푼다 ---
 * 반환: [{sid, name, grp, seat, why}]
 * members = [{sid, name, skill, talk, tag}]  tag = 학교·동네(없으면 '') */
function buildGroupPlan_(members, fixed) {
  const n = members.length;
  if (!n) return [];
  const sorted = members.slice().sort((a, b) => b.skill - a.skill || String(a.sid).localeCompare(String(b.sid)));
  const rankOf = {};
  sorted.forEach((m, i) => { rankOf[m.sid] = i + 1; });

  // 조별 정원 — 4조 고정, 나머지는 앞 조부터 한 명씩(16명→4·4·4·4 / 14명→4·4·3·3 / 12명→3·3·3·3)
  const base = Math.floor(n / GROUP_COUNT), rest = n % GROUP_COUNT;
  const cap = [];
  for (let g = 0; g < GROUP_COUNT; g++) cap.push(base + (g < rest ? 1 : 0));

  // ① 고정 학생(강사가 손으로 잠근 자리)을 먼저 앉힌다 — 규칙서상 예외 경로지만 존중한다
  const bucket = [];
  for (let g = 0; g < GROUP_COUNT; g++) bucket.push([]);
  const placed = {};
  sorted.forEach(m => {
    const f = fixed[m.sid];
    if (!f) return;
    const g = Math.min(Math.max(Number(f.grp) - 1, 0), GROUP_COUNT - 1);
    if (bucket[g].length >= cap[g]) return;             // 정원이 줄었으면 고정을 포기하고 자동 배분에 맡긴다
    bucket[g].push(m); placed[m.sid] = true;
  });

  // ② 나머지를 실력 내림차순 스네이크로 — 라운드마다 방향을 뒤집어야 각 조에 상·중·하가 고루 간다
  const rows = sorted.filter(m => !placed[m.sid]);
  let round = 0, idx = 0;
  while (idx < rows.length) {
    const order = [];
    for (let g = 0; g < GROUP_COUNT; g++) order.push(round % 2 === 0 ? g : GROUP_COUNT - 1 - g);
    let moved = false;
    for (let k = 0; k < order.length && idx < rows.length; k++) {
      const g = order[k];
      if (bucket[g].length >= cap[g]) continue;
      bucket[g].push(rows[idx++]); moved = true;
      rows[idx - 1].layer = round;                       // 계층 = 스네이크 라운드(교환은 이 안에서만)
    }
    round++;
    if (!moved) break;                                   // 전 조 만석 — 방어
  }

  // ③ 계층 안 교환 — 실력 균형을 유지한 채 말수·학교 쏠림만 푼다
  const dup = (arr, key) => {                            // 한 조 안에서 같은 값이 겹치는 수
    const seen = {}; let d = 0;
    arr.forEach(m => { const v = key(m); if (!v) return; if (seen[v]) d++; else seen[v] = 1; });
    return d;
  };
  const quietHi = (() => {                               // 미발화 상위 절반을 '조용한 학생'으로 본다
    const vals = members.map(m => m.quiet).filter(v => v > 0).sort((a, b) => b - a);
    return vals.length ? vals[Math.floor(vals.length / 2)] : Infinity;
  })();
  const cost = arr => dup(arr, m => m.tag) * 2 + dup(arr, m => (m.quiet >= quietHi && m.quiet > 0) ? 'QUIET' : '');
  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    for (let a = 0; a < GROUP_COUNT; a++) {
      for (let b = a + 1; b < GROUP_COUNT; b++) {
        for (let i = 0; i < bucket[a].length; i++) {
          for (let j = 0; j < bucket[b].length; j++) {
            const ma = bucket[a][i], mb = bucket[b][j];
            if (placed[ma.sid] || placed[mb.sid]) continue;         // 고정 자리는 안 건드린다
            if ((ma.layer == null ? -1 : ma.layer) !== (mb.layer == null ? -2 : mb.layer)) continue; // 같은 계층끼리만
            const before = cost(bucket[a]) + cost(bucket[b]);
            bucket[a][i] = mb; bucket[b][j] = ma;
            const after = cost(bucket[a]) + cost(bucket[b]);
            if (after < before) { improved = true; } else { bucket[a][i] = ma; bucket[b][j] = mb; }
          }
        }
      }
    }
    if (!improved) break;
  }

  // ④ 좌석 — 조 안에서 실력 내림차순으로 앉힌다. 좌석이 역할·짝 순환의 축이라 순서가 곧 규칙이다
  const out = [];
  bucket.forEach((arr, g) => {
    arr.sort((x, y) => y.skill - x.skill);
    arr.forEach((m, seat) => {
      out.push({
        sid: m.sid, name: m.name, grp: g + 1, seat: seat,
        why: '실력 ' + rankOf[m.sid] + '/' + n + (m.quiet > 0 ? ' · 침묵 ' + m.quiet + '회' : '') + (m.tag ? ' · ' + m.tag : '')
      });
    });
  });
  return out;
}

/* --- 반 하나 편성 — 앱이 제안하고 강사는 확인만 한다(유호님 확정) --- */
function assignGroups(className, opts) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const season = seasonLabelOf_(ss, tz);
  if (!season) return '⚠ 시즌 시작일이 없습니다 — setSeasonStart("2027-02-01") 먼저 실행하세요.';
  /* [v9.236] 입력도 접는다 — 아래 학생 선별은 `반키_(r[4]) !== cls` 라, 손으로 `assignGroups('정규반2(9시)')`
   *   를 부르면 한쪽만 접혀 **전원이 걸러지고 「0명 확정」**이 나온다(검수 48599e195c0f). `assignGroupsAll`
   *   은 schedule A열의 정본 키를 넘기므로 그 경로의 동작은 안 바뀐다. 접힌 키가 groups B열에 저장되는
   *   것도 옳다 — `groupBoardOf_` 의 조인이 그 키를 본다. */
  const cls = 반키_(className);
  if (!cls) return '⚠ 반 이름이 필요합니다 — assignGroups("정규반1") 형태로 실행하세요.';

  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return '⚠ profiles가 비어 있습니다.';
  // 학교·동네는 이름으로 열을 찾는다 — 열 번호를 박으면 공유 열이 늘어날 때마다 엉뚱한 값을 읽는다.
  const schoolCol = langColOf_(pf, '학교'), areaCol = langColOf_(pf, '동네');
  const rows = pf.getRange(2, 1, pf.getLastRow() - 1, pf.getLastColumn()).getValues();
  const quiet = quietScoreMap_(ss);
  const members = [];
  rows.forEach(r => {
    if (!r[0] || r[3] !== 'student') return;
    if (반키_(r[4]) !== cls) return;
    members.push({
      sid: String(r[0]), name: String(r[1] || r[0]), skill: skillScoreOf_(r),
      quiet: Number(quiet[String(r[0])] || 0),
      tag: String(r[schoolCol - 1] || '').trim() || String(r[areaCol - 1] || '').trim()  // 둘 다 선택 입력
    });
  });
  if (!members.length) return 'ℹ ' + cls + ': 배정된 학생이 없습니다.';

  // 기존 편성 — 같은 시즌·반의 '고정'=Y만 자리를 지킨다
  const gs = ensureSheet(ss, 'groups', GROUPS_HEADERS);
  /* [v9.132] 시즌 열을 텍스트로 굳힌다 — 읽기→서식→쓰기 순(v9.128에서 확립한 순서).
   *   이걸 안 하면 아래 setValues가 쓰는 '2026-07-13'이 그 자리에서 다시 Date로 파싱돼
   *   다음 실행의 비교가 또 어긋난다(정규화만으로는 읽기만 고치고 쓰기는 계속 오염된다). */
  if (gs.getLastRow() >= 2) {
    const svCol = gs.getRange(2, 1, gs.getLastRow() - 1, 1).getValues();
    let svFix = 0;
    for (let i = 0; i < svCol.length; i++) {
      const norm = seasonKeyOf_(svCol[i][0], tz);
      if (typeof svCol[i][0] !== 'string' || norm !== svCol[i][0]) { svCol[i][0] = norm; svFix++; }
    }
    if (gs.getRange(2, 1).getNumberFormat() !== '@') gs.getRange(1, 1, gs.getMaxRows(), 1).setNumberFormat('@');
    if (svFix) { gs.getRange(2, 1, svCol.length, 1).setValues(svCol); Logger.log('조 편성: groups 시즌 열 ' + svFix + '행 정상화'); }
  } else if (gs.getRange(2, 1).getNumberFormat() !== '@') {
    gs.getRange(1, 1, gs.getMaxRows(), 1).setNumberFormat('@'); // 첫 쓰기부터 오염 예방
  }
  const last = gs.getLastRow();
  const all = last >= 2 ? gs.getRange(2, 1, last - 1, GROUPS_HEADERS.length).getValues() : [];
  const fixed = {};
  all.forEach(r => {
    if (seasonKeyOf_(r[0], tz) !== season || String(r[1]) !== cls) return; // [v9.132]
    if (String(r[9] || '').toUpperCase().charAt(0) === 'Y') fixed[String(r[2])] = { grp: r[4], seat: r[5] };
  });

  const plan = buildGroupPlan_(members, fixed);
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const confirmed = (opts && opts.temp) ? '임시' : '확정';
  const keep = all.filter(r => !(seasonKeyOf_(r[0], tz) === season && String(r[1]) === cls));  // 다른 시즌·반은 그대로 [v9.132] 이 비교가 안 맞으면 재실행이 교체가 아니라 누적이 된다
  const fresh = plan.map(p => [season, cls, p.sid, p.name, p.grp, p.seat,
    confirmed, today, p.why, fixed[p.sid] ? 'Y' : '']);
  const merged = keep.concat(fresh);
  if (last >= 2) gs.getRange(2, 1, last - 1, GROUPS_HEADERS.length).clearContent();
  if (merged.length) gs.getRange(2, 1, merged.length, GROUPS_HEADERS.length).setValues(merged);

  const sizes = [];
  for (let g = 1; g <= GROUP_COUNT; g++) sizes.push(plan.filter(p => p.grp === g).length);
  // [v9.125] 소인원 경고 — 1~2인 조는 역할이 진행(·기록)만 돌아 「발표」가 영원히 안 오고(규칙서 §3⑤ 위반),
  //   짝도 성립하지 않는다. 조 수 정책(12명 미만 반은 몇 개 조?)은 유호님 결정 사항이라 여기선 경고만 낸다.
  const tiny = sizes.filter(s => s >= 1 && s <= 2).length;
  const warn = tiny ? '\n⚠ 1~2인 조 ' + tiny + '개 — 이 조엔 발표 역할이 배정되지 않습니다(소인원 반 조 수 정책 필요)' : '';
  return '✅ ' + cls + ' ' + confirmed + ' 편성: ' + members.length + '명 → ' +
    sizes.join('·') + '명' + (Object.keys(fixed).length ? ' (고정 ' + Object.keys(fixed).length + '명 유지)' : '') + warn;
}

// 전 반 일괄 — schedule에 있는 코어 반 전부. 시즌 3차시까지 1회 실행이 규칙서 §8 절차다.
function assignGroupsAll(opts) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sc = ss.getSheetByName('schedule');
  if (!sc || sc.getLastRow() < 2) return '⚠ schedule이 비어 있습니다 — setupSchedule 먼저 실행하세요.';
  const L = [];
  sc.getRange(2, 1, sc.getLastRow() - 1, 1).getValues().forEach(r => {
    if (!r[0]) return;
    try { L.push(assignGroups(String(r[0]), opts)); } catch (e) { L.push('⚠ ' + r[0] + ': ' + e.message); }
  });
  Logger.log(L.join('\n'));
  return L.join('\n');
}

/* [v9.235] 반 표시명 → 조인 키. `profiles` E열은 「정규반2(9시)」처럼 시간을 달고 오는데 `schedule` A열·
 *   `groups` B열은 「정규반2」다. 이 접기를 호출부마다 손으로 적어 왔고(이 파일 4곳 + 엔진_운영배치 2곳),
 *   새로 난 자리 하나가 그 통로를 안 타서 그 반이 통째로 «빈 후보»로 조용히 빠졌다(검수 d8461c489202 —
 *   `talkIndexSnapshot_` 이 원문을 그대로 넘기고 `groupBoardOf_` 는 `String(r[1]) === cls` 로 맞춘다).
 *   바로 위 `seasonKeyOf_` 와 같은 이유로 같은 판정은 한 곳에서만 산다 — 갈라지면 어느 쪽이 옳은지
 *   아무도 모르고, 틀린 쪽은 «0건»이라는 정상적인 얼굴로 나온다.
 *   ✅ [v9.238·#Q79] 엔진_운영배치.js 의 두 자리(teachersOfClass_·calcTeacherStats)도 이 통로로 들어왔다.
 *      이제 회귀는 엔진 **전량**을 잠근다 — 새 엔진 파일이 생겨도 손으로 적은 접기는 그 자리에서 빨개진다. */
function 반키_(v) { return String(v == null ? '' : v).split('(')[0].trim(); }

/* [v9.237·검수 c59f24d9] 실패 «원인 전부»를 8자리로 접은 지문 — dedup 서명의 «절단 밖» 구멍을 닫는다.
 *   `safeRun` 의 서명은 에러 **첫 줄 120자**다(:1002). 실패 반이 둘만 넘어도 뒤쪽 반의 원인은 그 120자
 *   «밖»으로 밀려난다(앞머리 22자 + 반당 최대 65자). 그러면 그 반의 원인이 바뀌어도 서명이 그대로라
 *   진단 메일이 **영영 안 온다** — [v9.236] 이 「같은 반의 다른 고장이 가려진다」를 닫으면서 정작
 *   「여러 반일 때」는 열어 둔 나머지 절반이다(검수 c59f24d91ca6 · 815c0ea77f09).
 * 🔑 지문을 첫 줄 «앞쪽»에 둔다 — 뒤에 붙이면 그것부터 잘려 아무것도 안 고친 것이 된다.
 * 🔑 길이가 **고정**이라 바로 위 「첫 줄에 변동값 금지」(:1804)와 안 부딪힌다: 같은 원인 집합이면 같은
 *   8자리라 하루 1통 제한이 그대로 살고, 원인이 **하나라도** 바뀌면 8자리가 갈려 다시 알린다.
 *   그래서 이 칸은 «변동값»이 아니라 «원인 집합의 이름»이다.
 * 🔑 구분자를 `\u0001` 로 둔다 — 반 이름·원인에 쉼표·괄호가 섞여도 경계가 안 무너진다(쉼표로 이으면
 *   「A반(x, y)」 하나와 「A반(x」+「y)」 둘이 같은 지문을 낸다). 다이제스트 관용구는 `talkPromptVer_` 와 같다. */
function 원인지문_(조각들) {
  const raw = (조각들 || []).join('\u0001');
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw, Utilities.Charset.UTF_8);
  return d.map(b => ((b & 0xFF) + 0x100).toString(16).slice(1)).join('').slice(0, 8);
}

/* --- 그 반의 오늘(또는 지정 차시) 조·역할·짝 한 판 --- */
function groupBoardOf_(ss, cls, when, tz) {
  const season = seasonLabelOf_(ss, tz);
  const start = seasonStartOf_(ss);
  const gs = ss.getSheetByName('groups');
  if (!season || !gs || gs.getLastRow() < 2) return null;
  const sch = schedOf(scheduleMap(ss), cls);
  // [v9.125] 시즌 종료 게이트 — lessonNoOf_의 14일 유예(무한 루프 방어)가 주차·차시로 새어 시즌 종료 후
  //   2주간 "9~11주차 41차시"가 강사 화면에 찍혔다. 8주를 넘겼으면 「기간 밖」과 같은 표기로 떨어뜨린다.
  const wkChk = seasonWeekOf_(start, when || new Date());
  const lessonNo = (wkChk > SEASON_WEEKS) ? 0 : lessonNoOf_(start, when || new Date(), sch ? sch.type : '평일');
  const rows = gs.getRange(2, 1, gs.getLastRow() - 1, GROUPS_HEADERS.length).getValues()
    .filter(r => seasonKeyOf_(r[0], tz) === season && String(r[1]) === cls); // [v9.132]
  if (!rows.length) return null;
  const groups = [];
  for (let g = 0; g < GROUP_COUNT; g++) groups.push([]);
  rows.forEach(r => {
    const g = Math.min(Math.max(Number(r[4]) - 1, 0), GROUP_COUNT - 1);
    groups[g].push({ sid: String(r[2]), name: String(r[3] || r[2]), seat: Number(r[5]) || 0 });
  });
  groups.forEach(arr => arr.sort((a, b) => a.seat - b.seat));
  groups.forEach(arr => arr.forEach(m => {
    m.role = roleOfSeat_(m.seat, lessonNo, arr.length);
    m.icon = roleIconOf_(m.seat, lessonNo, arr.length);
    m.duty = ROLE_DUTY[ROLE_NAMES.indexOf(m.role)] || ''; // [v9.99]
    const ps = pairSeatOf_(m.seat, lessonNo, arr.length);
    const pm = ps >= 0 ? arr.filter(x => x.seat === ps)[0] : null;
    m.pair = pm ? pm.name : (arr.length !== 4 ? '조 전체' : ''); // [v9.125] 5인 조도 '조 전체'(pairSeatOf_와 동일 기준)
    // [v9.99] 오늘의 3라운드 짝 — 4/3/2 반복의 상대. 3인 조는 빈 배열('조 전체'로 표기)
    m.rounds = pairRoundsOf_(m.seat, arr.length)
      .map(s => { const x = arr.filter(y => y.seat === s)[0]; return x ? x.name : ''; }).filter(Boolean);
  }));
  const week = seasonWeekOf_(start, when || new Date());
  const live = groups.filter(a => a.length); // [v9.125] 실제 조 수 기준 — focus가 유령 조를 가리키지 않게
  return {
    season: season, lessonNo: lessonNo, week: week,
    focus: focusGroupOf_(lessonNo, week, live.length), // [v9.99] 오늘 정밀 청취 조(0 = 표시 안 함)
    confirmed: String(rows[0][6] || ''), groups: live
  };
}

/* --- 강사용 조 편성표 — 브리핑 메일에 붙는 텍스트. 대강 강사가 이것만 보고 수업할 수 있어야 한다(규칙서 §9) --- */
function groupBoardText_(ss, cls, when, tz) {
  const b = groupBoardOf_(ss, cls, when, tz);
  /* [v9.130] 조용히 사라지지 않는다 — 08-02 개원 시뮬 실측: 이 함수가 **빈 문자열**을 돌려주는 바람에
   *   강사 「수업 준비」 브리핑에서 조 편성표가 통째로 빠졌고, 화면상 「원래 없는 항목」과 구별되지 않았다.
   *   규칙서 §9는 대강 강사가 앱의 넷(진도·판서·좌석표·**조 편성표**)만으로 수업한다고 못박는데 그 하나가 침묵한 것.
   *   원인은 셋 중 하나이고 처방이 각각 다르므로, 어느 쪽인지 말해 준다(빈 문자열은 처방을 못 준다). */
  if (!b) {
    const seasonSet = !!seasonLabelOf_(ss, tz);
    const gsH = ss.getSheetByName('groups');
    const hasRows = !!(gsH && gsH.getLastRow() >= 2);
    if (!seasonSet) return '🧩 조 편성: **시즌 시작일이 없습니다** — `setSeasonStart("2027-02-01")` 1회 실행하면 이 자리에 조·역할·짝이 채워집니다.\n';
    if (!hasRows) return '🧩 조 편성: **아직 편성 전입니다** — `assignGroupsAll()` 1회 실행(시즌 3차시까지 · 규칙서 §8).\n';
    return '🧩 조 편성: **' + cls + ' 편성 행이 없습니다** — 이 반만 `assignGroups("' + cls + '")` 실행하세요(다른 반은 정상).\n';
  }
  if (!b.lessonNo) return '🧩 조 편성: 시즌 기간 밖입니다(시즌 시작일 확인 — setSeasonStart).\n';
  // [v9.103] 지명 우선 — "말 많은 애가 또 말하는" 20분을 막는 유일한 객관 축(인상 아님, 출석×역할 실측)
  let low = [];
  try { low = talkIndexOf_(ss, cls, when, tz, b).filter(x => x.max > 0).slice(0, 3); }
  catch (e) { Logger.log('발화 지수 스킵(' + cls + '): ' + e); }
  return groupBoardRender_(b, low);
}

/* [v9.103] 조 편성표 렌더 — 시트를 모르는 순수 함수로 분리.
 *   분리 이유: 개원 전에는 편성 데이터가 없어 강사가 실제로 뭘 보게 되는지 확인할 방법이 아예 없었다
 *   (08-01 유호님 groupBoardNow ▶ 실측 = 전 반 "편성 없음"). 미리보기가 별도 문자열을 조립하면 그 순간
 *   두 벌이 되어 갈라지므로, 실물과 미리보기가 **같은 함수**를 타게 만든다. */
function groupBoardRender_(b, low) {
  const L = ['🧩 조 편성 · ' + b.week + '주차 ' + b.lessonNo + '차시' + (b.confirmed === '임시' ? ' (임시 조)' : '')];
  b.groups.forEach((arr, g) => {
    L.push('  ' + (g + 1) + '조' + (b.focus === g + 1 ? ' 🎧' : '  ') + '  ' +
      arr.map(m => m.icon + ' ' + m.name + '(' + m.role + ')').join(' · '));
    // [v9.99] 짝을 '오늘 1조합'이 아니라 3라운드로 편다 — 4/3/2 반복이 곧 이 순서다
    const rounds = [];
    for (let r = 0; r < TALK_ROUNDS.length; r++) {
      const seen = {}, ps = [];
      arr.forEach(m => {
        const nm = (m.rounds || [])[r];
        if (!nm || seen[m.name] || seen[nm]) return;
        seen[m.name] = 1; seen[nm] = 1; ps.push(m.name + '–' + nm);
      });
      if (ps.length) rounds.push((r + 1) + 'R ' + ps.join('/'));
    }
    if (rounds.length) L.push('        짝 ' + rounds.join('  '));
    // [v9.132] 실제 인원을 적는다 — 「(3인 조)」 하드코딩이라 **1인 조에도 "3인 조"**라고 찍혔다(08-02 실측).
    //   강사가 화면을 믿고 셋을 묶으려다 사람이 없는 것을 발견하게 되는, 조용하지만 현장에서 바로 걸리는 거짓말.
    //   5인 조(정원 초과)도 짝을 안 만들므로 여기로 오는데, 그때 "3인 조"는 정반대 오정보가 된다.
    else if (arr.length && arr.length !== 4) L.push('        짝: 조 전체(' + arr.length + '인 조)');
  });
  const pres = [];
  b.groups.forEach((arr, g) => arr.forEach(m => { if (m.role === '발표') pres.push((g + 1) + '조 ' + m.name); }));
  if (pres.length) L.push('  📢 오늘 발표: ' + pres.join(' · ') + '  ← ④소그룹 시작할 때 미리 알려주세요');
  talkProtocolLines_(b.focus).forEach(x => L.push(x)); // [v9.99] 20분 타임박스·역할 의무·정밀 청취
  // 범위를 문장에 박는다(서클 재검 08-13 · 설계 §10-4) — 서클 브리핑은 전원 균등이라 이 지수에 안 든다.
  //   구 문구 「발화 차례를 구조적으로 덜 받은 순서」는 서클이 선 뒤로 그날 발화 전부를 잰다고 읽혀,
  //   강사가 실제보다 큰 격차를 믿고 지명하게 된다. 숫자는 그대로고 «무엇의 숫자인지»만 바로잡았다.
  if ((low || []).length) L.push('  🔈 오늘 지명 우선: ' + low.map(x => x.name + '(' + x.pct + '%' +
    (x.quiet ? '·침묵' + x.quiet : '') + ')').join(' · ') + '  ← 소그룹 20분에서 차례를 덜 받은 순서(서클 브리핑은 전원 균등이라 안 듦)');
  return L.join('\n') + '\n';
}

/* [v9.103] 📺 조 편성표 미리보기 — 개원 전에 "강사가 매 차시 보게 될 화면"을 그대로 확인한다.
 *   시트를 전혀 읽지 않고 쓰지도 않는다(가상 16명 · 4인 4조 · 11차시=3주차라 정밀 청취까지 켜진 상태).
 *   실물과 **같은 groupBoardRender_**를 타므로 여기서 본 모양이 개원 후 실제와 다를 수 없다. */
function groupBoardPreview() {
  const NAMES = ['바트', '사란', '뭉흐', '오윤', '텅걸', '아마르', '볼드', '나랑',
    '에르덴', '조리그', '하스', '뭉근', '사르나이', '간바트', '오트곤', '델게르'];
  const lessonNo = 11, week = 3;                       // 3주차 = 정밀 청취가 켜지는 첫 주
  const groups = [];
  for (let g = 0; g < GROUP_COUNT; g++) {
    const arr = [];
    for (let s = 0; s < 4; s++) {
      const nm = NAMES[g * 4 + s];
      arr.push({ sid: 'DEMO-' + (g * 4 + s + 1), name: nm, seat: s,
        role: roleOfSeat_(s, lessonNo, 4), icon: roleIconOf_(s, lessonNo, 4) });
    }
    arr.forEach(m => {
      m.duty = ROLE_DUTY[ROLE_NAMES.indexOf(m.role)] || '';
      m.rounds = pairRoundsOf_(m.seat, 4).map(x => arr[x].name);
    });
    groups.push(arr);
  }
  const b = { season: '(미리보기)', lessonNo: lessonNo, week: week,
    focus: focusGroupOf_(lessonNo, week), confirmed: '확정', groups: groups };
  const low = [{ name: '델게르', pct: 58, quiet: 2 }, { name: '하스', pct: 67, quiet: 0 }, { name: '나랑', pct: 75, quiet: 1 }];
  const txt = '── 📺 미리보기(가상 데이터 · 시트 무접근) ──\n' + groupBoardRender_(b, low) +
    '\n※ 실제 반은 assignGroupsAll 실행 후 groupBoardNow에서 같은 모양으로 나옵니다.' +
    '\n※ 학생 앱에는 각자 이렇게 보입니다 — "' +
    '🤝 오늘 세 번 만나요 — 1R ' + groups[0][0].rounds[0] + ' · 2R ' + groups[0][0].rounds[1] + ' · 3R ' + groups[0][0].rounds[2] + '"' +
    ' (1조 ' + groups[0][0].name + ' 학생 화면 기준)';
  Logger.log(txt);
  return txt;
}

// 수동 확인용 — 드롭다운에서 바로 보이는 정식 함수. 인자 없이 실행하면 오늘 수업하는 반 전부.
function groupBoardNow(className) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const sc = ss.getSheetByName('schedule');
  const dow = new Date().getDay();
  const list = className ? [String(className)]
    : (sc && sc.getLastRow() >= 2 ? sc.getRange(2, 1, sc.getLastRow() - 1, 2).getValues()
      .filter(r => r[0] && classDowOk_(r[1], dow)).map(r => String(r[0])) : []);
  if (!list.length) return 'ℹ 오늘 수업하는 반이 없습니다(일요일이거나 schedule 미설정).';
  const out = list.map(c => {
    const t = groupBoardText_(ss, c, new Date(), tz);
    return '── ' + c + ' ──\n' + (t || '  (편성 없음 — assignGroups("' + c + '") 실행)');
  }).join('\n');
  Logger.log(out);
  return out;
}

/* ═════════════ 🟨 숙제 서클 — 조 단위 인쇄물 조립 ═════════════════════════════════════════════
 * 정본 = docs/숙제서클_설계.md (v1.0) · 인수 조건 §10 · 계약 초안 §3 `circle_sheet`.
 *
 * 왜 새 계층인가: 배달 배치(deliver)는 **학생 1명당**으로 돈다. 조별 A4 1장은 4명을 한 장에
 *   묶는 일이라 「새 배치 0」이 성립하지 않는다(설계 §3 말미가 게이트에서 그렇게 판정됐다).
 *   그래서 여기가 그 조 단위 조립 계층이다 — 읽기 전용 조회로만 조립한다:
 *   **새 event_type 0 · 새 시트 0 · 새 폼 0 · 쓰기 0**(§7 「새 수집 채널 금지」).
 *
 * ⚠ 인쇄 페이로드에 학습자 식별자 0 — 이름만 실린다(§3). sid 는 조립 «안»에서만 산다.
 * ⚠ 인쇄 금지 계약(§3): 점수·정답률·정답 개수·등수·난도 라벨 0 · 조 안 항목을 난도순·개수순
 *   정렬 금지(순서는 좌석 회전만) · 오류 태그 «코드» 문자열 0 · 한자 0 · 교사 기입 칸 0.
 * ⚠ 조 안 순서는 **좌석 순번**이다. 어떤 축으로도 다시 정렬하지 않는다 —
 *   정렬하는 순간 종이가 등수를 말한다(철학 ㉢).
 *
 * 문자열은 전부 contents_서클.js 가 정본이다(로직 0줄 · 카드 풀은 줄만 더하면 늘어난다).
 * 이 절의 순수 함수는 tools/서클조판.js 가 그대로 떼어다 실물 A4 를 굽는다 —
 * 미리보기와 실물이 **같은 함수**를 타야 한다(groupBoardRender_ 가 세운 규약 그대로). */

/* 레벨 밴드 — 0=Lv1~2 · 1=Lv3~4 · 2=Lv5~6 · -1=모름.
 * 🔴 추측하지 않는다: profiles 「한국어수준」은 '기초·초급·중급…' 어휘이고 커리큘럼 Lv1~6 과
 *   **다른 축**이다(Code.js PROFILE_LEVEL_HEADER 주석 — 매핑은 유호님 확정 사항).
 *   그래서 이 함수는 숫자·`LvN` 만 읽고, 어휘 해석은 app_state 의 매핑표에만 맡긴다.
 *   못 읽으면 -1 을 낸다 — 조용히 Lv1~2 로 접으면 상급반 종이 전체가 초급 문장 틀로 나가고,
 *   그건 화면 어디에도 빨갛게 안 뜬다. */
function circleBandOf_(lv, vocab) {
  const s = String(lv == null ? '' : lv).trim();
  if (!s) return -1;
  if (vocab && vocab[s] != null) return circleBandOf_(vocab[s], null);
  const m = s.match(/^(?:Lv)?\s*([1-6])$/i);
  if (!m) return -1;
  return Math.floor((Number(m[1]) - 1) / 2);
}
/* 어휘 매핑표 — app_state 한 칸(key='레벨어휘', value='기초=1,초급=2,중급=4,고급=6').
 * 시트 한 칸이라 유호님이 코드를 안 거치고 정한다. 없으면 null → 밴드는 -1 로 남고,
 * 조립 보고가 그 사실을 말한다(빈 종이를 조용히 내보내지 않는다). */
function circleLevelVocab_(ss) {
  const st = ss.getSheetByName('app_state');
  if (!st) return null;
  const raw = String((getState(st, '레벨어휘') || {}).val || '').trim();
  if (!raw) return null;
  const out = {};
  raw.split(',').forEach(p => {
    const kv = String(p).split('=');
    if (kv.length === 2 && String(kv[0]).trim()) out[String(kv[0]).trim()] = String(kv[1]).trim();
  });
  return Object.keys(out).length ? out : null;
}

/* 오늘의 질문 카드 — 결은 차시로 돌고, 같은 결의 카드는 4차시마다 한 장 넘어간다(설계 §5 ①).
 * 저장 0 · 차시 번호의 순수 함수라 매 차시 쓰기가 0이다(조 편성 절의 규약 그대로). */
function circleWarmupOf_(lessonNo, band) {
  const n = Math.max(1, Number(lessonNo) || 1);
  const tone = CIRCLE_TONE_ORDER[(n - 1) % CIRCLE_TONE_ORDER.length];
  // 밴드를 모르면(-1) 카드를 **안 낸다**. 조용히 0(Lv1~2)으로 접으면 상급반 조 머리에 초급 질문이
  // 인쇄되고 어디서도 안 빨개진다 — 설계 §10 「추측하지 않는다」가 정확히 금지한 모양이다.
  if (!(band >= 0 && band <= 2)) return { tone: tone, text: '' };
  const pool = (CIRCLE_QUESTION_CARDS[tone] || [])[band] || [];
  if (!pool.length) return { tone: tone, text: '' };
  return { tone: tone, text: pool[Math.floor((n - 1) / CIRCLE_TONE_ORDER.length) % pool.length] };
}

/* 오류 태그 → 학생이 읽는 말. 어휘 밖 태그는 **빈 문자열**을 낸다 —
 * 모르는 코드를 그대로 종이에 흘리면 그게 곧 §3 이 금지한 「태그 코드 노출」이다. */
function circleTagSay_(tag) { return CIRCLE_TAG_SAY[String(tag || '').trim()] || ''; }
// 태그의 «영역» — 접두(조사·어미·높임·어휘·맞춤법…). 반복 영역 대조의 축.
function circleTagArea_(tag) { const s = String(tag || '').trim(); const i = s.indexOf(':'); return i > 0 ? s.slice(0, i) : s; }

/* ── 한 학생 칸 — 순수 함수(시트를 모른다) ────────────────────────────────────
 * rows = 그 학생의 검수 «확정»분만, 최신순. 각 행:
 *   { day:'yyyy-MM-dd', 제출문, 태그:[...], 숙제ID, 재작성:true|false }
 * 확정 게이트는 호출부가 이미 통과시킨다(노출카드_ 단일 정본 — 여기서 다시 판정하면 두 벌이 된다). */

// kept — 설계 §3 선정 규칙 ①~④, 위에서 먼저 맞는 것 하나.
function circleKeptPick_(rows) {
  const rs = rows || [];
  if (!rs.length) return null;
  const 오늘 = rs[0].day;
  const 이번 = rs.filter(r => r.day === 오늘);
  const 이전 = rs.filter(r => r.day !== 오늘);
  const 깨끗 = (r) => !r.태그.filter(t => t && t !== '오류없음').length;
  const 맞은것 = 이번.filter(깨끗);
  // ① 지난번에 틀렸다가 이번에 맞은 자리 — 재작성 행이 그 «증거»다(추정이 아니라 열이 말한다)
  const a = 맞은것.filter(r => r.재작성)[0];
  if (a) return { text: a.제출문 };
  // ② 최근 반복 오류 영역과 같은 영역에서 맞은 것 — 같은 숙제ID 의 과거 행이 그 영역을 틀렸던 것
  const 빈도 = {};
  이전.forEach(r => r.태그.forEach(t => { if (t && t !== '오류없음') { const k = circleTagArea_(t); 빈도[k] = (빈도[k] || 0) + 1; } }));
  const 반복영역 = Object.keys(빈도).sort((x, y) => 빈도[y] - 빈도[x])[0];
  if (반복영역) {
    const b = 맞은것.filter(r => 이전.filter(p => p.숙제ID && p.숙제ID === r.숙제ID &&
      p.태그.filter(t => circleTagArea_(t) === 반복영역).length).length)[0];
    if (b) return { text: b.제출문 };
  }
  // ③ 이번에 맞은 것 아무거나
  if (맞은것[0]) return { text: 맞은것[0].제출문 };
  // ④ 끝까지 제출한 것 자체 — 「얻는 쪽에서 센다」(설계 §3)
  if (이번[0]) return { text: 이번[0].제출문 };
  return null;
}

// shaky — ①이번 최다 ②동률=최근 반복 많은 쪽 ③동률=발음 축 우선.
// 🔴 ④「오류 0건 = 다음 단계 자리」는 여기서 못 낸다 — 다음 단계 문법 배정이 이 저장소에 없다.
//    지어내는 대신 null 을 내고(줄을 인쇄하지 않는다), 조립 보고가 그 사실을 센다.
const CIRCLE_SOUND_TAGS = ['맞춤법:받침'];   // 발음 축 — 어휘에 있는 것만(경음·유음화 태그는 아직 어휘에 없다)
function circleShakyPick_(rows) {
  const rs = rows || [];
  if (!rs.length) return null;
  const 오늘 = rs[0].day;
  const 세기 = (list) => {
    const c = {};
    list.forEach(r => r.태그.forEach(t => { if (t && t !== '오류없음') c[t] = (c[t] || 0) + 1; }));
    return c;
  };
  const 이번 = 세기(rs.filter(r => r.day === 오늘));
  let 후보 = Object.keys(이번);
  if (!후보.length) {                                    // 없을 때 = 최근 3회로 넓힘(§3 오른쪽 칸)
    const days = [];
    rs.forEach(r => { if (days.indexOf(r.day) < 0 && days.length < 3) days.push(r.day); });
    const 넓힘 = 세기(rs.filter(r => days.indexOf(r.day) >= 0));
    후보 = Object.keys(넓힘);
    if (!후보.length) return null;
    return circlePickTop_(후보, 넓힘, rs, 오늘);
  }
  return circlePickTop_(후보, 이번, rs, 오늘);
}
function circlePickTop_(후보, 표, rs, 오늘) {
  const 최다 = Math.max.apply(null, 후보.map(t => 표[t]));
  let tie = 후보.filter(t => 표[t] === 최다);
  if (tie.length > 1) {                                   // ② 최근 반복 많은 쪽
    const 과거 = {};
    rs.filter(r => r.day !== 오늘).forEach(r => r.태그.forEach(t => { 과거[t] = (과거[t] || 0) + 1; }));
    const mx = Math.max.apply(null, tie.map(t => 과거[t] || 0));
    tie = tie.filter(t => (과거[t] || 0) === mx);
  }
  if (tie.length > 1) {                                   // ③ 발음 축 우선
    const snd = tie.filter(t => CIRCLE_SOUND_TAGS.indexOf(t) >= 0);
    if (snd.length) tie = snd;
  }
  const tag = tie.slice().sort()[0];                      // 남은 동률은 어휘 순 — 회차마다 흔들리지 않게
  const say = circleTagSay_(tag);
  return say ? { tag: tag, text: say } : null;
}

/* trend_line — 두 갈래 고정 문형만(자유 생성 금지 · 숫자 노출 금지 · 이력 1주 미만은 줄 생략).
 * 🔑 설계의 ⓑ「아니면」을 그대로 쓰지 않는다: 그 태그가 지난주에 **없었으면** ⓑ 문장은
 *    종이 위에서 거짓말이 된다(늘어난 자리인데 「지난주에도 나왔어요」로 읽힌다).
 *    그래서 ⓑ 는 «지난주에 실제로 있었을 때»만 낸다 — 없으면 줄을 안 쓴다. */
function circleTrendOf_(rows, tag, todayStr) {
  if (!tag || !rows || !rows.length) return '';
  const day0 = todayStr || rows[0].day;
  const t0 = Date.parse(day0 + 'T00:00:00Z');
  if (isNaN(t0)) return '';
  const 창 = (a, b) => rows.filter(r => {
    const t = Date.parse(r.day + 'T00:00:00Z');
    return !isNaN(t) && t <= t0 - a * 86400000 && t > t0 - b * 86400000;
  });
  const 이력폭 = rows.filter(r => {
    const t = Date.parse(r.day + 'T00:00:00Z');
    return !isNaN(t) && t <= t0 - 7 * 86400000;
  });
  if (!이력폭.length) return '';                          // 이력 1주 미만 = 줄 생략
  const 센다 = (list) => list.reduce((n, r) => n + r.태그.filter(t => t === tag).length, 0);
  const 이번주 = 센다(창(0, 7)), 지난주 = 센다(창(7, 14));
  if (지난주 > 0 && 이번주 < 지난주) return CIRCLE_TREND_LINES.줄었음;
  if (지난주 > 0) return CIRCLE_TREND_LINES.남아있음;
  return '';
}

/* 한 학생 칸 한 벌. 제출 여부를 «칸의 모양»으로 드러내지 않는다(§3 예외 조항) —
 * 드러나는 것은 줄의 이름표뿐이고, 그 이름표는 이력이 얕은 제출자에게도 똑같이 붙는다. */
function circleMemberCard_(m, rows, band, todayStr) {
  const rs = (rows || []).slice();
  const frame = CIRCLE_FRAMES[band] || null;
  const card = { display_name: m.name, role: m.role, kept: null, shaky: null, next_one: null };
  if (!rs.length) {                                       // 이력 0 — 첫날·신규(§6 1차시)
    // 밴드를 모르면 시작 문장도 **안 낸다**(문장 틀 `CIRCLE_FRAMES[-1]`=null 은 이미 그렇다 —
    // 셋 중 하나만 맞아 있었다). `|| [0]` 로 접으면 상급반 첫날 종이가 초급 문장으로 나간다.
    const 시작 = (band >= 0 && band <= 2) ? CIRCLE_START_LINES[band] : null;
    if (시작) card.next_one = { label: CIRCLE_CATCHUP_LEAD, text: 시작, check: true };
    card.frame = frame;
    return card;
  }
  const 오늘것 = rs.filter(r => r.day === todayStr);
  if (오늘것.length) {
    card.kept = circleKeptPick_(rs);
    const sh = circleShakyPick_(rs);
    if (sh) card.shaky = { tag: sh.tag, text: sh.text, trend_line: circleTrendOf_(rs, sh.tag, todayStr) };
    card.next_one = {
      label: '다음에 맞힐 문제',
      text: (sh && sh.text) ? (sh.text + ' — ' + CIRCLE_NEXT_FALLBACK) : CIRCLE_NEXT_FALLBACK,
      check: true
    };
  } else {                                                // 어젯밤 것이 없다 — 최근 이력에서 「오늘 볼 것」 한 줄
    const sh = circleShakyPick_(rs);
    card.next_one = {
      label: CIRCLE_CATCHUP_LEAD,
      text: (sh && sh.text) ? (sh.text + ' — ' + CIRCLE_NEXT_FALLBACK) : CIRCLE_NEXT_FALLBACK,
      check: true
    };
  }
  card.frame = frame;
  return card;
}

/* ── 시트 → circle_sheet ──────────────────────────────────────────────────────
 * 조·좌석·역할은 groupBoardOf_ 를 그대로 탄다(두 벌로 계산하면 종이와 강사 화면이 갈라진다).
 * 반환은 조 배열 — 조당 A4 1장이다. */
function circleSheetOf_(ss, cls, when, tz) {
  const b = groupBoardOf_(ss, cls, when, tz);
  if (!b) return null;
  const day = Utilities.formatDate(when || new Date(), tz, 'yyyy-MM-dd');
  const vocab = circleLevelVocab_(ss);
  // 레벨 — profiles 「한국어수준」 열은 이름으로 찾는다(위치 상수 금지 · Code.js v9.119)
  const lvBy = {};
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) {
    const lvCol = profileLevelCol_(pf);
    if (lvCol >= 0) {
      pf.getRange(2, 1, pf.getLastRow() - 1, lvCol + 1).getValues()
        .forEach(r => { if (r[0]) lvBy[String(r[0]).trim()] = r[lvCol]; });
    }
  }
  // 출석 확정 — 종이는 확정 뒤 인쇄된다(§3). 확정 행이 0이면 전원 인쇄하고 그 사실을 보고에 담는다.
  const present = {};
  let 출석확정 = false;
  const at = ss.getSheetByName('attendance');
  if (at && at.getLastRow() >= 2) {
    at.getRange(2, 1, at.getLastRow() - 1, 3).getValues().forEach(r => {
      if (r[1] && r[2] && dstr(r[2], tz) === day) { present[String(r[1]).trim()] = true; 출석확정 = true; }
    });
  }
  const hw = circleHwBySid_(ss, tz);
  const out = [], 미확정레벨 = [], 질문없는조 = [];
  b.groups.forEach((arr, g) => {
    const 자리 = arr.filter(m => !출석확정 || present[m.sid]);   // 결석 = 칸이 아예 없다(§3)
    if (!자리.length) return;
    const band0 = circleBandOf_(lvBy[자리[0].sid], vocab);
    자리.forEach(m => { if (circleBandOf_(lvBy[m.sid], vocab) < 0) 미확정레벨.push(m.name); });
    if (band0 < 0) 질문없는조.push(g + 1);   // 밴드를 모르면 질문 카드를 안 낸다 — 조 머리가 비는 사실을 보고가 진다
    out.push({
      group_no: g + 1,
      warmup_question: circleWarmupOf_(b.lessonNo, band0),
      // 좌석 회전 그대로 — 이 배열을 다시 정렬하지 않는다(§3)
      members: 자리.map(m => circleMemberCard_(m, hw[m.sid] || [], circleBandOf_(lvBy[m.sid], vocab), day))
    });
  });
  return {
    class_id: cls, session_no: b.lessonNo, week: b.week, season: b.season,
    focus_group: b.focus, groups: out,
    // 조립 보고 — 종이에 안 나가는 칸. 「조용히 반쪽으로 나갔다」를 막는 자리다.
    보고: { 출석확정: 출석확정, 레벨미확정: 미확정레벨, 어휘표: !!vocab, 질문없는조: 질문없는조 }
  };
}

/* hw_feedback → student_id 별 검수 «확정»분(최신순). 확정 판정은 노출카드_ 단일 정본을 탄다.
 * 창은 28일 — 서클이 쓰는 것은 「어젯밤」과 「지난주 대조」뿐이라 그 너머는 종이에 못 오른다. */
function circleHwBySid_(ss, tz) {
  const out = {};
  const fb = ss.getSheetByName('hw_feedback');
  if (!fb || fb.getLastRow() < 2) return out;
  const w = Math.min(15, fb.getLastColumn());              // A~O(재작성원본까지) — 그 뒤 감사 열은 안 읽는다
  const cut = Date.now() - 28 * 86400000;
  fb.getRange(2, 1, fb.getLastRow() - 1, w).getValues().forEach(r => {
    if (!r[1] || !노출카드_(r[8])) return;                 // 검수 확정분만 — 대기·격리·오류는 종이에 안 오른다
    const d = asDate_(r[2]);
    if (!d || isNaN(d.getTime()) || d.getTime() < cut) return;
    const sid = String(r[1]).trim();
    (out[sid] = out[sid] || []).push({
      day: Utilities.formatDate(d, tz, 'yyyy-MM-dd'),
      제출문: String(r[3] || '').trim(),
      태그: String(r[12] || '').split(',').map(s => s.trim()).filter(Boolean),
      숙제ID: String(r[11] || '').trim(),
      재작성: !!String(r[13] || '').trim()
    });
  });
  Object.keys(out).forEach(k => out[k].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0)));
  return out;
}

/* ── A4 조판 — 조당 1장 · 5구역(머리 1 + 학생 칸 4) ───────────────────────────
 * 규격 정본 = 설계 §3. 가로 굵은 파선이 손으로 찢는 자리다 — 뜯어도 각 칸에
 * 「N조 M차시」가 남게 귀퉁이에 반복 인쇄한다.
 * 색: 검정·회색만 쓴다 — 설계가 「흑백 가능」을 규격으로 못박았고, 학원 프린터가
 *     흑백일 때 색으로 뜻을 실으면 그 뜻이 종이에서 통째로 사라진다.
 * 이모지 0 — 인쇄면 이모지는 정본 금칙(발표물린트 ■9)이고, 흑백에서 그림문자로 뭉갠다. */
function circleSheetCss_() {
  // 서체는 CARD_FONT 한 벌을 그대로 탄다 — 브랜드 3종 정본(§9)이고, 스택을 여기 다시 적으면
  // 그 순간 두 벌이 되어 정본이 바뀌어도 종이만 옛 서체로 남는다(브랜드폰트 회귀가 그걸 문다).
  return '@page{size:A4 portrait;margin:0}' +
    'html,body{margin:0;padding:0;background:#fff;color:#000;' + CARD_FONT +
    '-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.pg{width:210mm;height:297mm;box-sizing:border-box;page-break-after:always;display:flex;flex-direction:column}' +
    '.pg:last-child{page-break-after:auto}' +
    '.z{height:59.4mm;box-sizing:border-box;padding:4mm 8mm;position:relative;overflow:hidden;' +
    'border-bottom:1.2mm dashed #999;display:flex;flex-direction:column}' +
    /* 🔑 잘림의 «순서»를 못박는다: 학생의 문장은 절대 안 잘리고, 잘리는 것은 언제나 강사 틀이다.
     *   긴 제출문이 두 줄로 접히는 날 칸이 빠듯해지는데, 그때 학생 원문이 조용히 잘리면
     *   「다듬지 않는다」는 §3 규약이 종이 위에서 깨진다 — 잘려도 눈에 안 보이는 방식으로.
     *   틀은 다시 읽을 수 있는 보조물이라 한 줄 사라져도 서클이 돈다. */
    '.keep{flex:0 0 auto}' +
    '.frames{flex:1 1 auto;min-height:0;overflow:hidden}' +
    '.pg .z:last-child{border-bottom:0}' +
    '.corner{position:absolute;top:3mm;right:7mm;font-size:8pt;color:#666;letter-spacing:.2mm}' +
    '.hd1{font-size:15pt;font-weight:700;margin:0 0 2mm}' +
    '.hd2{font-size:10pt;line-height:1.5;margin:0 0 1.5mm}' +
    '.qcard{font-size:13pt;font-weight:700;line-height:1.35;margin:1.5mm 0 2mm;padding:2.5mm 3mm;border:.4mm solid #000}' +
    '.blank{font-size:9.5pt;color:#333;border-bottom:.3mm solid #000;padding-bottom:1mm;margin-top:1.5mm}' +
    '.nm{font-size:12.5pt;font-weight:700;margin:0 0 1.2mm}' +
    '.nm span{font-size:9.5pt;font-weight:400;color:#333;margin-left:2mm}' +
    '.ln{font-size:10pt;line-height:1.45;margin:0 0 .8mm}' +
    '.lb{font-weight:700}' +
    '.fr{font-size:9pt;line-height:1.4;color:#333;margin:0 0 .6mm}' +
    '.ck{border:.35mm solid #000;border-radius:50%;display:inline-block;width:4.5mm;height:4.5mm;vertical-align:-1mm;margin-left:2mm}';
}
function circleEsc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
/* ── 굽기 «전»에 칸을 잰다 ────────────────────────────────────────────────────
 * `.z` 는 overflow:hidden 이라, 학생 줄(`.keep`)만으로 칸을 넘기면 그 문장이 종이 위에서
 * «없는 줄»과 똑같이 보인다 — §3 「학생 원문 그대로」가 로그 어디에도 안 남고 깨진다.
 * CSS 가 못박은 잘림 순서(틀 먼저)는 keep 합계가 칸을 안 넘을 때만 사는 보장이었다.
 *
 * Apps Script 안엔 브라우저가 없다. 그래서 자수·줄높이는 **실측에서 가져온다** — 지어 박지 않는다:
 *   출처 = `node tools/서클조판.js --자수` (실물 CSS 아래 헤드리스 측정)
 *   회귀 = `tests/숙제서클.test.js` 가 크롬이 있는 자리에서 다시 재어 어긋나면 빨개진다.
 * 공백·라틴 비율을 따로 재는 이유: 전부 한글 폭으로 세면 실제 문장을 과대예측하고,
 * 그 과대예측은 「안 들어간다」는 **거짓 경고**가 되어 진짜 경고까지 같이 죽인다. */
const CIRCLE_FIT = { 자수: 56, 굵은자수: 56, 공백비: 0.336, 라틴비: 0.953, 키릴비: 0.544, 이름자수: 44, 역할자수: 56, 줄mm: 5.11, 여백mm: 0.8, 체크줄mm: 5.17, 체크비: 2.041, 이름줄mm: 5.82, 이름여백mm: 1.2, 칸여백mm: 9.06 };
// 줄 이름표는 여기 한 벌뿐 — 재는 쪽과 그리는 쪽에 따로 적으면 문구가 갈리는 날 예측만 틀어진다.
const CIRCLE_LABELS = { kept: '잘 된 문장', shaky: '한 번 더 볼 자리' };

/* 글자 폭 — 한글 1자를 1로 두고 공백·라틴(키릴 포함)은 잰 비율로 환산한다. */
function circleWidthOf_(s) {
  let w = 0;
  String(s == null ? '' : s).split('').forEach(function (ch) {
    const c = ch.charCodeAt(0);
    if (ch === ' ' || ch === '\t') w += CIRCLE_FIT.공백비;
    // 키릴은 «몽골 학생 이름의 기본 문자»다. 라틴 비율로 갈음하면 실측(0.544 vs 0.481)보다
    // 좁게 세어 이름줄을 낮게 보고, 낮게 본 예측은 곧 조용한 잘림이다(검수 P3 a6af8cae).
    else if (c >= 0x0400 && c <= 0x04FF) w += CIRCLE_FIT.키릴비;
    else if (c < 0x1100) w += CIRCLE_FIT.라틴비;                   // ASCII·라틴·문장부호
    else w += 1;                                                  // 한글·전각
  });
  return w;
}

/* 한 줄이 «몇 줄로 접히는가» — 자수는 칸마다 다르다(굵은 라벨·이름·역할이 서로 다른 크기다). */
function circleLineCount_(라벨, 본문, 덧폭) {
  const 폭비 = (라벨 ? circleWidthOf_(라벨) / CIRCLE_FIT.굵은자수 + CIRCLE_FIT.공백비 / CIRCLE_FIT.자수 : 0) +
    (circleWidthOf_(본문) + (덧폭 || 0)) / CIRCLE_FIT.자수;   // 덧폭 = 글자가 아닌 것(동그라미)의 폭
  return Math.max(1, Math.ceil(폭비 - 0.001));   // 딱 떨어지는 줄을 반올림으로 한 줄 더 세지 않는다
}

/* 학생 줄(`.keep`) 한 벌의 높이(mm). 강사 틀은 «안 센다» — 그건 잘려도 되는 보조물이고,
 * 그렇게 못박은 것이 §10-2 다. 여기서 재는 것은 「잘리면 안 되는 것」의 크기다. */
function circleKeepMm_(m) {
  // 이름줄도 «잰다» — 고정 1줄로 두면 긴 몽골 이름이 접히는 날 예측이 실물보다 낮아지고,
  // 낮게 본 예측은 곧 조용한 잘림이다(검수 P3 e2c3037f).
  const 이름줄수 = Math.max(1, Math.ceil(circleWidthOf_(m.display_name) / CIRCLE_FIT.이름자수 +
    circleWidthOf_(m.role) / CIRCLE_FIT.역할자수 - 0.001));
  // 문단 여백은 «문단마다 한 번»이다 — 접힌 줄마다 곱하면 긴 카드를 과대예측해, 실제로는
  // 들어가는 학생 줄까지 걷어낸다(검수 P2 382f53fa). 그래서 줄높이와 여백을 따로 센다.
  let h = 이름줄수 * CIRCLE_FIT.이름줄mm + CIRCLE_FIT.이름여백mm;   // 여백은 이름줄에도 «한 번»(P2 f9a9f133)
  if (m.kept) h += circleLineCount_(CIRCLE_LABELS.kept, m.kept.text) * CIRCLE_FIT.줄mm + CIRCLE_FIT.여백mm;
  if (m.shaky) {
    h += circleLineCount_(CIRCLE_LABELS.shaky, m.shaky.text) * CIRCLE_FIT.줄mm + CIRCLE_FIT.여백mm;
    if (m.shaky.trend_line) h += circleLineCount_('', m.shaky.trend_line) * CIRCLE_FIT.줄mm + CIRCLE_FIT.여백mm;
  }
  if (m.next_one) {
    // 동그라미는 높이만이 아니라 «폭»도 먹는다 — 안 세면 그 줄이 한 줄 더 접히는 날을 못 본다(검수 P2 cee4b75f)
    const 줄 = circleLineCount_(m.next_one.label, m.next_one.text, m.next_one.check ? CIRCLE_FIT.체크비 : 0);
    h += (줄 - 1) * CIRCLE_FIT.줄mm +
      (m.next_one.check ? CIRCLE_FIT.체크줄mm : CIRCLE_FIT.줄mm) + CIRCLE_FIT.여백mm;
  }
  return h;
}

/* 칸 높이 배분 — 남는 자리는 위 칸들이 나눠 갖는다(§3). 다만 균등이 아니라 «필요한 만큼» 나눈다:
 * 균등 배분은 긴 제출문이 온 칸에서만 넘치는데, 옆 칸은 여백을 남긴 채 그 사실을 모른다.
 * 주는 쪽은 자기 필요분 아래로는 절대 안 준다(그래서 옮겨도 새 잘림이 안 생긴다). */
function circleZoneHeights_(members) {
  const N = Math.max(1, (members || []).length);
  const 균등 = (59.4 * 4) / N;                       // 머리 칸 1개를 뺀 나머지를 나눈다(A4 5구역)
  const 필요 = members.map(circleKeepMm_).map(function (x) { return x + CIRCLE_FIT.칸여백mm; });
  if (필요.every(function (x) { return x <= 균등; })) return members.map(function () { return 균등; });
  let 여유 = 0, 모자람 = 0;
  필요.forEach(function (x) { if (x < 균등) 여유 += 균등 - x; else 모자람 += x - 균등; });
  const 옮길것 = Math.min(여유, 모자람);
  return 필요.map(function (x) {
    if (x > 균등) return 균등 + (x - 균등) * (옮길것 / 모자람);
    return 여유 > 0 ? 균등 - (균등 - x) * (옮길것 / 여유) : 균등;
  });
}

/* 안 들어가면 «걷는다» — 재기만 하고 경고를 붙이는 것은 잘림을 막는 게 아니라 설명하는 것이다.
 * 걷는 순서를 여기서 못박는다. 걷히는 것은 **엔진이 붙인 보조물**이고, 학생이 쓴 문장은
 * 한 글자도 안 다듬는다(§3 「학생 원문 그대로」) — 마지막 수단조차 «줄 통째로» 빼는 것이지
 * 문장을 자르는 것이 아니다. CSS 잘림은 문장 중간을 삼켜 «없는 줄»처럼 보이게 하지만,
 * 줄을 통째로 안 내는 것은 §3 이 이미 정한 규약이고(「없으면 인쇄하지 않는다」) 보고가 진다. */
function circleFitCard_(m, 담기는mm) {
  const 걷음 = [];
  let c = m;
  const 복사 = function (o) { const r = {}; Object.keys(o).forEach(function (k) { r[k] = o[k]; }); return r; };
  if (circleKeepMm_(c) <= 담기는mm) return { card: c, 걷음: 걷음 };
  if (c.shaky && c.shaky.trend_line) {          // ① 지난주 대조 — 없어도 서클이 돈다
    c = 복사(c);
    c.shaky = { tag: c.shaky.tag, text: c.shaky.text, trend_line: '' };
    걷음.push('지난주 대조');
    if (circleKeepMm_(c) <= 담기는mm) return { card: c, 걷음: 걷음 };
  }
  if (c.next_one) {                             // ② 「오늘 볼 것」 — 엔진이 고른 다음 연습
    c = 복사(c); c.next_one = null; 걷음.push(CIRCLE_CATCHUP_LEAD);
    if (circleKeepMm_(c) <= 담기는mm) return { card: c, 걷음: 걷음 };
  }
  if (c.shaky) {                                // ③ 줄을 통째로 뺀다(문장을 자르지 않는다)
    c = 복사(c); c.shaky = null; 걷음.push(CIRCLE_LABELS.shaky);
    if (circleKeepMm_(c) <= 담기는mm) return { card: c, 걷음: 걷음 };
  }
  if (c.kept) {                                 // ④ 마지막 칸까지 — 여기서 멈추면 CSS 가 문장 중간을 삼킨다
    c = 복사(c); c.kept = null; 걷음.push(CIRCLE_LABELS.kept);
  }
  // 이제 남은 것은 이름줄뿐이라 `.keep` 은 **넘칠 수 없다** — 잘린 종이가 구조적으로 안 나온다.
  // 「경고만 하고 잘린 파일을 굽는다」가 아니라 「줄을 통째로 빼고 무엇을 뺐는지 말한다」다.
  return { card: c, 걷음: 걷음 };
}

/* 굽기 전 대조 — 줄인 칸과, 줄이고도 «안 들어가는» 칸을 이름으로 낸다. */
function circleTightOf_(sheet) {
  const out = [];
  (sheet.groups || []).forEach(function (g) {
    const 높이 = circleZoneHeights_(g.members);
    g.members.forEach(function (m, i) {
      const 담기는 = 높이[i] - CIRCLE_FIT.칸여백mm;
      const r = circleFitCard_(m, 담기는);
      const 남는 = 담기는 - circleKeepMm_(r.card);
      if (r.걷음.length || 남는 < 0) out.push({
        group_no: g.group_no, name: m.display_name, 걷음: r.걷음,
        모자란mm: 남는 < 0 ? Math.round(-남는 * 10) / 10 : 0
      });
    });
  });
  return out;
}

/* 한 조 = 한 쪽. 학생 칸이 4개보다 적으면(3인 조·결석) **빈 칸을 그리지 않는다** —
 * 종이 위의 빈 칸은 낙인이다(§3). 남은 자리는 위 칸들이 나눠 갖는다. */
function circleGroupPage_(sheet, grp) {
  const 꼬리 = grp.group_no + '조 · ' + sheet.session_no + '차시';
  const 순서 = grp.members.map(m => m.display_name).join(' → ');
  const 역할 = grp.members.map(m => m.display_name + '(' + m.role + ')').join(' · ');
  const H = ['<div class="pg">'];
  H.push('<div class="z">' +
    '<div class="corner">' + circleEsc_(꼬리) + '</div>' +
    '<p class="hd1">' + circleEsc_(grp.group_no) + '조 · ' + circleEsc_(sheet.session_no) + '차시</p>' +
    '<p class="hd2"><span class="lb">역할</span> ' + circleEsc_(역할) + '</p>' +
    '<p class="hd2"><span class="lb">말하는 순서</span> ' + circleEsc_(순서) + '</p>' +
    // 물음이 없으면 **빈 상자를 그리지 않는다** — 테두리만 남은 칸은 「오늘은 질문이 없다」로 읽힌다(§3).
    (((grp.warmup_question || {}).text || '')
      ? '<div class="qcard">' + circleEsc_(grp.warmup_question.text) + '</div>' : '') +
    '<div class="blank">오늘 조에서 나온 질문 한 개 (기록)</div>' +
    '</div>');
  const 칸높이 = circleZoneHeights_(grp.members);   // 빈 자리·긴 제출문을 «필요한 만큼» 나눠 갖는다
  grp.members.forEach((m0, mi) => {
    // 굽기 «전»에 걷는다 — 여기서 안 걷으면 CSS 가 문장 중간을 삼키고, 종이에선 그게 «없는 줄»과 같다
    const m = circleFitCard_(m0, 칸높이[mi] - CIRCLE_FIT.칸여백mm).card;
    const L = ['<div class="z" style="height:' + 칸높이[mi].toFixed(2) + 'mm">',
      '<div class="corner">' + circleEsc_(꼬리) + '</div>',
      '<div class="keep">',
      '<p class="nm">' + circleEsc_(m.display_name) + '<span>' + circleEsc_(m.role) + '</span></p>'];
    if (m.kept) L.push('<p class="ln"><span class="lb">' + CIRCLE_LABELS.kept + '</span> ' + circleEsc_(m.kept.text) + '</p>');
    if (m.shaky) {
      L.push('<p class="ln"><span class="lb">' + CIRCLE_LABELS.shaky + '</span> ' + circleEsc_(m.shaky.text) + '</p>');
      if (m.shaky.trend_line) L.push('<p class="ln">' + circleEsc_(m.shaky.trend_line) + '</p>');
    }
    if (m.next_one) L.push('<p class="ln"><span class="lb">' + circleEsc_(m.next_one.label) + '</span> ' +
      circleEsc_(m.next_one.text) + (m.next_one.check ? '<span class="ck"></span>' : '') + '</p>');
    L.push('</div>');
    const f = m.frame;
    if (f) {
      L.push('<div class="frames">');
      L.push('<p class="fr"><span class="lb">말할 때</span> ' + circleEsc_(f.kept) + ' / ' + circleEsc_(f.shaky) + '</p>');
      L.push('<p class="fr"><span class="lb">물어볼 때</span> ' + f.asks.map(circleEsc_).join(' / ') + '</p>');
      L.push('<p class="fr"><span class="lb">오늘 목표</span> ' + circleEsc_(f.goal) + '  <span class="lb">옆 사람이 바꿔 말하기</span> ' + circleEsc_(f.echo) + '</p>');
      L.push('</div>');
    }
    L.push('</div>');
    H.push(L.join(''));
  });
  H.push('</div>');
  return H.join('');
}
function circleSheetHtml_(sheet) {
  const pages = (sheet.groups || []).map(g => circleGroupPage_(sheet, g)).join('');
  return '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">' +
    '<title>숙제 서클 ' + circleEsc_(sheet.class_id) + ' ' + circleEsc_(sheet.session_no) + '차시</title>' +
    // 웹폰트 동반 — 스택 이름만 바꾸면 아무 일도 안 일어난다(브랜드 폰트 정본 §9).
    // 학원 PC 에 SUIT·Inter Tight 가 깔려 있을 리 없고, 없으면 조용히 시스템 서체로 떨어진다.
    CARD_WEBFONT +
    '<style>' + circleSheetCss_() + '</style></head><body>' + pages + '</body></html>';
}

/* 📺 미리보기 — 시트를 전혀 읽지 않는다(개원 전에도 강사·유호님이 실물 모양을 본다).
 * 실물과 **같은 circleSheetHtml_** 를 타므로 여기서 본 모양이 개원 후와 다를 수 없다
 * (groupBoardPreview 가 세운 규약 · 08-01 유호님 실측에서 나온 규칙). */
function circleSheetFixture_(lessonNo) {
  const n = Number(lessonNo) || 12;
  const 이름 = ['바트', '사란', '뭉흐', '오윤'];
  const 태그 = ['조사:주격(이/가·은/는)', '어미:연결어미', '맞춤법:받침', '오류없음'];
  const 문장 = ['저는 어제 도서관에서 책을 읽었어요.', '주말에 친구하고 시장에 갔어요.',
    '아침에 눈이 와서 길이 미끄러웠어요.', '어머니께서 만들어 주신 음식이 맛있었어요.'];
  const 어제 = '2026-03-10', 지난주 = '2026-03-03';
  return {
    class_id: '평일 A', session_no: n, week: Math.ceil(n / 5), season: '2026-02-25', focus_group: 1,
    groups: [{
      group_no: 1,
      warmup_question: circleWarmupOf_(n, 1),
      members: 이름.map((nm, i) => circleMemberCard_(
        { name: nm, role: roleOfSeat_(i, n, 4) },
        [{ day: 어제, 제출문: 문장[i], 태그: [태그[i]], 숙제ID: 'HW' + i, 재작성: i === 0 },
         { day: 어제, 제출문: 문장[(i + 1) % 4], 태그: ['오류없음'], 숙제ID: 'HW' + i, 재작성: i === 0 },
         { day: 지난주, 제출문: 문장[(i + 2) % 4], 태그: [태그[i], 태그[i]], 숙제ID: 'HW' + i, 재작성: false }],
        1, 어제))
    }],
    보고: { 출석확정: true, 레벨미확정: [], 어휘표: true }
  };
}
function circleSheetPreview() {
  const html = circleSheetHtml_(circleSheetFixture_(12));
  Logger.log('숙제 서클 미리보기 — ' + html.length + '자. HtmlService 로 열어 Ctrl+P 하세요.');
  return HtmlService.createHtmlOutput(html).setTitle('숙제 서클 미리보기');
}

/* 🖨 오늘 수업 반의 서클 인쇄물을 Drive 에 굽는다 — 기존 SYNK_인쇄 통로(printMonthlyCards)와 같은 폴더.
 * ▶ 수동 실행. 반 이름을 주면 그 반만, 안 주면 오늘 수업하는 반 전부. */
function printCircleSheets(className, 구운반) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const sc = ss.getSheetByName('schedule');
  const dow = new Date().getDay();
  const list = className ? [String(className)]
    : (sc && sc.getLastRow() >= 2 ? sc.getRange(2, 1, sc.getLastRow() - 1, 2).getValues()
      .filter(r => r[0] && classDowOk_(r[1], dow)).map(r => String(r[0])) : []);
  if (!list.length) return 'ℹ 오늘 수업하는 반이 없습니다(일요일이거나 schedule 미설정).';
  const it = DriveApp.getFoldersByName('SYNK_인쇄');
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder('SYNK_인쇄');
  const day = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const 강사 = teacherEmailMap_(ss);   // 반별 열람 권한의 정본(profiles role=teacher) — 반마다 다시 읽지 않는다
  const L = [];
  list.forEach(c => {
    const sheet = circleSheetOf_(ss, c, new Date(), tz);
    if (!sheet) { L.push('⚠ ' + c + ': 조 편성이 없습니다 — assignGroups("' + c + '") 실행'); return; }
    if (!sheet.session_no) { L.push('⚠ ' + c + ': 시즌 기간 밖입니다(setSeasonStart 확인)'); return; }
    if (!sheet.groups.length) { L.push('⚠ ' + c + ': 오늘 출석 확정된 학생이 0명이라 인쇄할 칸이 없습니다'); return; }
    // 🔑 굽기 «전»에 잰다 — `createFile` 뒤에 재면 그건 막는 것이 아니라 이미 나간 종이를 설명하는 것이다
    const 빠듯 = circleTightOf_(sheet);
    const 경고 = [];
    if (!sheet.보고.출석확정) 경고.push('출석 확정 행이 0 — 편성 전원을 인쇄했습니다');
    if (!sheet.보고.어휘표) 경고.push("레벨 어휘표가 없습니다 — app_state 에 key='레벨어휘' · value='기초=1,초급=2,중급=4,고급=6' 한 행");
    if (sheet.보고.레벨미확정.length) 경고.push('레벨을 못 읽은 학생 ' + sheet.보고.레벨미확정.length + '명 — 그 칸은 문장 틀·시작 문장 없이 나갑니다(' + sheet.보고.레벨미확정.join('·') + ')');
    if ((sheet.보고.질문없는조 || []).length) 경고.push('질문 카드가 빠진 조 ' + sheet.보고.질문없는조.join('·') + '조 — 조 대표의 레벨을 못 읽었습니다(카드를 추측해 내지 않습니다)');
    const 줄인것 = 빠듯.filter(t => t.걷음.length);
    const 넘친것 = 빠듯.filter(t => t.모자란mm > 0);
    if (줄인것.length) 경고.push('제출문이 길어 보조 줄을 걷고 인쇄한 칸 ' + 줄인것.length + '개 — 학생 문장은 그대로입니다(' +
      줄인것.map(t => t.name + ' ' + t.group_no + '조: ' + t.걷음.join('·') + ' 뺌').join(' · ') + ')');
    // 걷기 사다리(④ kept 까지)가 잔여 넘침을 구조적으로 0 으로 만들었으니 여기는 «도달할 수 없는» 자리다.
    // 그래도 굽지 않고 멈춘다 — 도달했다면 그건 예측 모델이 실물보다 낮게 본 것이고, 그때 파일을 만들면
    // 「잘릴 것을 알면서 저장한」 종이가 된다. 안 굽고 남겨 두면 다음 틱·손 통로에서 다시 시도할 수 있다.
    if (넘친것.length) {
      L.push('⛔ ' + c + ': 보조 줄을 다 걷고도 학생 문장이 칸을 넘겨 **굽지 않았습니다** — 예측 모델이 실물보다 낮게 본 자리입니다(' +
        넘친것.map(t => t.name + ' ' + t.group_no + '조 ' + t.모자란mm + 'mm').join(' · ') +
        ') · `node tools/서클조판.js --자수` 로 상수를 다시 재십시오');
      return;
    }
    const blob = Utilities.newBlob(circleSheetHtml_(sheet), 'text/html',
      'SYNK_서클_' + c + '_' + day + '.html');
    const f = folder.createFile(blob);
    // 🔑 «파일이 실제로 생겼다»를 문자열이 아니라 이 배열로 알린다 — 자동 통로가 반환 문자열만 보고
    //   도장을 찍으면, 안 구운 반(⛔·⚠)도 완료로 남아 그날 재시도가 통째로 막힌다(검수 P1 ee142cdd).
    if (구운반) 구운반.push(c);
    // 링크를 받는 사람이 «열 수» 있어야 한다 — Drive 파일은 만든 계정 것이라, 담당 강사 계정이 다르면
    // 메일은 도착하는데 링크를 열면 「액세스 요청」이 뜨고 그 자리에서 자동 인쇄가 끝난다(검수 P1 657feff6).
    // 실패를 «삼키지» 않는다 — 조용히 넘어가면 강사는 열리지 않는 링크를 받고 아무도 이유를 모른다
    // (검수 P1 2ce886d2). 인쇄 자체는 막지 않되(링크는 이미 있다) 누가 못 여는지 보고에 이름으로 싣는다.
    const 권한실패 = [];
    (강사.byClass[c] || []).forEach(t => {
      try { f.addViewer(t.email); } catch (e) { 권한실패.push(t.email); }
    });
    if (권한실패.length) 경고.push('강사 열람 권한을 못 준 주소 ' + 권한실패.length + '개 — 그 분은 링크를 열면 「액세스 요청」이 뜹니다(' +
      권한실패.join(' · ') + ') · profiles 의 메일 주소를 확인하십시오');
    L.push('✅ ' + c + ' ' + sheet.session_no + '차시 · ' + sheet.groups.length + '조 ' +
      sheet.groups.reduce((n, g) => n + g.members.length, 0) + '명 — ' + f.getUrl() +
      (경고.length ? '\n   ⚠ ' + 경고.join('\n   ⚠ ') : ''));
  });
  const msg = L.join('\n');
  Logger.log(msg);
  return msg;
}

/* 🖨 자동 인쇄 — 설계 §0 전제 「앱이 매 차시 자동 인쇄」·③ 운영 게이트 「강사 준비 0」.
 * 발화 자리가 cron 이 아닌 이유: §3 이 「종이는 QR 출석 «확정 뒤» 인쇄된다」로 못박았다.
 * 시각으로 쏘면 확정 전에 구워져 결석자 칸이 실린 종이가 나가고, 그 종이는 다시 못 걷는다.
 * 그래서 attendance 를 전개하는 그 자리(parentSweep · 10분)에 얹어 «확정을 보고» 굽는다.
 * 반·날짜당 한 번(프로퍼티 도장) — 10분마다 같은 종이가 쌓이면 강사가 오늘 것을 못 고른다.
 * 링크를 메일로 보내는 것까지가 한 벌이다: Drive 에만 두면 강사가 파일을 찾는 손이 남는다. */
function circleSheetsAuto_(ss) {
  // 리허설 중엔 **굽지 않는다** — 실물 Drive 파일과 도장이 남으면 리허설이 끝난 뒤 정상 스윕이
  // 「이미 구웠다」로 건너뛰어 그날 진짜 종이가 안 나온다(검수 P2 0fc810dc · adminMail v9.125 와 같은 격리).
  if (isRehearsal_()) { rehearsalNote_('숙제 서클 자동 인쇄: 리허설 중이라 굽지 않았다'); return; }
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const day = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const sc = ss.getSheetByName('schedule');
  if (!sc || sc.getLastRow() < 2) return;
  const dow = now.getDay();
  const 반 = sc.getRange(2, 1, sc.getLastRow() - 1, 2).getValues()
    .filter(r => r[0] && classDowOk_(r[1], dow)).map(r => String(r[0]));
  if (!반.length) return;                                   // 오늘 수업이 없다 — 정상
  const props = PropertiesService.getScriptProperties();
  // 락 — parentSweep 은 10분마다 돌고 앞 실행이 아직 굽는 중일 수 있다. 겹치면 같은 반 종이가
  // 두 벌 생기고, 강사는 어느 것이 오늘 것인지 못 고른다. 못 잡으면 다음 틱에 다시 온다.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  let 도장, 막힌반 = [];
  try {
    도장 = circleStampOf_(props, day);
    반.filter(c => !도장.구움[c]).forEach(c => {
      if (!circleBatchDone_(ss, c, day, tz)) return;         // 반 전체가 확정되기 전엔 안 굽는다
      const sheet = circleSheetOf_(ss, c, now, tz);
      // `보고.출석확정` 을 **함께** 본다 — 배치가 「전개완료」여도 목록의 ID 가 전부 무효면 attendance 행이
      // 0 이라 조립이 편성 전원으로 되돌아가고, 결석자가 실린 종이가 자동으로 나간다(검수 P1 b2e79b22).
      // 그리고 그 상태는 «고착»된다: 배치는 이미 전개완료라 다시 안 돌고, 여기선 영원히 return 한다.
      // 종이가 조용히 안 나오는 것은 이 트랙이 막으려던 바로 그 모양이라, 하루 한 번 이름으로 알린다(P1 a63e6120).
      // 이 반이 종이를 못 받는 «모든» 갈래를 한 자리에서 연다 — 조 편성 없음(sheet=null)·시즌 밖
      // (session_no=0)·출석 0·조 0. 어느 하나라도 조용히 return 하면 그날 그 반의 종이가 이유 없이
      // 안 나온다(검수 P1 cda019ad·575e6b7e). 확정 신호는 이미 왔는데 결과가 없는 상태가 급소다.
      const 못굽는이유 = !sheet ? '조 편성이 없습니다 — assignGroups("' + c + '") 실행'
        : !sheet.session_no ? '시즌 기간 밖입니다(setSeasonStart 확인)'
          : !sheet.보고.출석확정 ? '출석 1탭은 전개완료인데 그날 attendance 행이 0 입니다'
            : !sheet.groups.length ? '출석 확정된 이 반 학생이 0명입니다(다른 반 ID 가 섞였을 수 있습니다)' : '';
      if (못굽는이유 && 도장.막힘.indexOf(c) < 0) 막힌반.push({ 반: c, 이유: 못굽는이유 });
      if (못굽는이유) return;
      const 구운반 = [];
      const 결과 = printCircleSheets(c, 구운반);               // 굽는 통로는 하나뿐(경고 문구가 갈리지 않는다)
      if (!구운반.length) return;                             // 파일이 안 생겼다 — 도장 없이 두고 다음 틱에 다시 본다
      도장.구움[c] = 결과;
      circleStampTrim_(도장);   // 반당·전체 길이를 못박는다 — 안 하면 저장이 «파일을 만든 뒤» 실패한다
      // 도장은 **반마다** 찍는다 — 마지막에 한 번 찍으면 뒤의 반에서 예외가 났을 때
      // 앞서 구운 반이 도장 없이 남아 다음 틱에 같은 종이를 또 굽는다.
      props.setProperty('서클인쇄_도장', JSON.stringify(도장));
    });
  } finally {
    lock.releaseLock();
  }
  /* 🔑 알림은 락 «밖»에서, 그리고 «즉시» 보낸다 — 둘 다 실측이 강제한 자리다(검수 P1):
   *   ① 스크립트 락은 재진입이 안 된다. `adminMail` 은 DIGEST_MODE 에서 같은 락을 30초 기다리므로
   *      락을 쥔 채 부르면 거기서 죽고, 종이는 구워졌는데 아무도 못 받는다(28db800d).
   *   ② 그 다이제스트는 아침 8시 1통이다. 수업 첫 20분에 쓸 종이의 링크가 다음 날 아침에 오면
   *      그건 안 온 것과 같다(df8b0be6 · DIGEST_MODE=true 실측). 그래서 이 건은 즉시 발송이다. */
  const 알릴반 = Object.keys(도장.구움).filter(c => 도장.알림.indexOf(c) < 0);
  // 링크는 **그 반 담당 강사**에게 간다 — 운영자 받은편지함에만 두면 정작 종이를 쓸 사람이 못 받는다
  // (검수 P1 e4c00b45). 반별 메일 정본은 `teacherEmailMap_`(profiles role=teacher)이고, 운영자는 늘 함께 받는다.
  const 강사 = teacherEmailMap_(ss);
  const 받는이별 = {};
  알릴반.forEach(c => {
    받는이별[c] = [ADMIN_EMAIL].concat((강사.byClass[c] || []).map(t => t.email))
      .filter((e, i, a) => e && a.indexOf(e) === i);
  });
  if (!알릴반.length && !막힌반.length) return;
  if (막힌반.length && quotaOk(1)) {                         // 종이가 «조용히» 안 나오는 상태를 이름으로 알린다
    try {
      MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] ⚠ 숙제 서클 — 출석은 확정됐는데 종이가 안 나온 반 ' + 막힌반.length + '개',
        '아래 반은 출석 1탭이 「전개완료」인데 인쇄할 자리가 없었습니다. 배치가 이미 전개완료라\n' +
        '자동으로 다시 돌지 않으므로, 그대로 두면 오늘 그 반의 서클 종이가 안 나옵니다.\n' +
        '고치는 법: attendance_batch 의 그 행에서 출석자목록을 바로잡고 처리상태를 비운 뒤 10분 기다리십시오.\n' +
        '(조 편성·시즌 문제라면 괄호 안 명령을 먼저 실행하십시오.)\n\n· ' +
        막힌반.map(x => x.반 + ' — ' + x.이유).join('\n· '));
      막힌반.forEach(x => { if (도장.막힘.indexOf(x.반) < 0) 도장.막힘.push(x.반); });
      props.setProperty('서클인쇄_도장', JSON.stringify(도장));
    } catch (e) { 막힌반 = []; }                             // 못 보냈으면 도장을 안 찍어 다음 틱에 다시 시도한다
  }
  const 보낸것 = [];
  알릴반.forEach(c => {
    // 쿼터는 «수신자» 수로 센다 — 반 수로 세면 반마다 강사가 붙는 만큼 모자라, 마지막 반이 조용히 못
    // 받는다(검수 P2 32ae5420). 발송 바로 앞에서 세는 편이 정확하고, 관문 밖 발송도 원리상 안 생긴다.
    if (!quotaOk(받는이별[c].length)) return;                // 못 보낸 반은 도장이 안 옮겨져 다음 틱에 다시 온다
    try {
      MailApp.sendEmail(받는이별[c].join(','), '[SYNK] 🖨 숙제 서클 인쇄물 — ' + c,
        '오늘 출석이 확정돼 서클 종이를 구웠습니다. 링크를 열어 인쇄 버튼을 누르시면 됩니다.\n\n' + 도장.구움[c]);
      보낸것.push(c);
    } catch (e) { /* 한 반이 실패해도 나머지는 나간다 — 실패분은 도장이 안 옮겨져 다음 틱에 다시 시도한다 */ }
  });
  // 보낸 «뒤»에만 알림 도장을 옮긴다 — 먼저 옮기면 발송 실패가 곧 영구 미전달이다(검수 P2 b74e8ee4).
  if (!보낸것.length || !lock.tryLock(5000)) return;          // 못 잡으면 다음 틱에 한 번 더 보낸다(종이는 안 는다)
  try {
    const 최신 = circleStampOf_(props, day);
    보낸것.forEach(c => { if (최신.알림.indexOf(c) < 0) 최신.알림.push(c); });
    props.setProperty('서클인쇄_도장', JSON.stringify(최신));
  } finally {
    lock.releaseLock();
  }
}

/* 반 단위 출석 «확정» 신호 — attendance_batch 의 오늘 그 반 행이 `전개완료` 인가.
 * 개별 attendance 행은 확정이 **아니다**: QR·폼 출석은 학생당 한 행씩 10분 스윕으로 들어오는 중이라
 * (`sweepAttendanceForm_` 이 행을 한 장씩 append 한다), 첫 한 명만 보고 구우면 나머지가 빠진 명단이
 * 인쇄되고 도장까지 찍혀 그날 다시 안 나온다 — 검수 P1 f5f43034 가 잡은 자리다.
 * 강사가 수업 시작에 내는 출석 1탭이 곧 「반 전체 확정」이고, 그것이 여기서 보는 신호다. */
function circleBatchDone_(ss, cls, day, tz) {
  const ab = ss.getSheetByName('attendance_batch');
  if (!ab || ab.getLastRow() < 2) return false;
  return ab.getRange(2, 1, ab.getLastRow() - 1, 6).getValues().some(function (r) {
    // 출석자목록이 «비어 있는» 행도 전개완료로 찍힐 수 있다 — 그걸 확정으로 읽으면 attendance 행이
    // 0 이라 circleSheetOf_ 가 편성 전원으로 되돌아가고, 결석자가 실린 종이가 자동으로 나간다(검수 P1 3338367d).
    return r[0] && dstr(r[0], tz) === day && String(r[1]).trim() === String(cls) &&
      String(r[5]) === '전개완료' && String(r[2] == null ? '' : r[2]).trim() !== '';
  });
}

/* 도장 줄이기 — Script Property 한 칸은 9KB 다. 반이 늘고 경고가 길면 저장이 «파일을 만든 뒤»
 * 실패하고, 그러면 그 반이 기록도 알림도 없이 남아 다음 틱이 같은 종이를 또 굽는다(검수 P2 c92783fe).
 * 반당 상한만으로는 못 막으니 **전체**를 재서 줄인다 — 줄일 때는 링크가 있는 첫 줄부터 남긴다
 * (재시도 메일에 필요한 것은 링크이고, 경고 전문은 실행 로그에 그대로 있다). */
function circleStampTrim_(도장) {
  const 한도 = 8000;
  Object.keys(도장.구움).forEach(function (c) {
    if (도장.구움[c].length > 600) 도장.구움[c] = 도장.구움[c].slice(0, 600) + ' …(전체는 실행 로그)';
  });
  if (JSON.stringify(도장).length <= 한도) return;
  Object.keys(도장.구움).forEach(function (c) {          // 그래도 넘치면 첫 줄(링크)만 남긴다
    도장.구움[c] = String(도장.구움[c]).split('\n')[0];
  });
  // 🔑 더 줄일 때는 **이미 알린 반만** 건드린다 — 아직 안 알린 반의 링크를 지우면 그 자리에 ✅ 가
  //   메일 본문으로 나가고, 그러고도 「알렸다」로 도장이 찍힌다(검수 P1 39819a34 · 링크가 영영 사라진다).
  while (JSON.stringify(도장).length > 한도) {
    const 지울것 = Object.keys(도장.구움).filter(function (c) {
      return 도장.알림.indexOf(c) >= 0 && 도장.구움[c] !== '✅';
    });
    if (!지울것.length) break;                           // 안 알린 링크는 안 건드린다 — 여기서 멈춘다
    도장.구움[지울것[0]] = '✅';
  }
}

/* 오늘 도장 — 날짜가 넘어가면 스스로 비워진다(어제 도장으로 오늘을 건너뛰지 않는다).
 * `구움` = 반 → printCircleSheets 결과 문자열(링크·경고) · `알림` = 그 링크를 실제로 보낸 반. */
function circleStampOf_(props, day) {
  let s = null;
  try { s = JSON.parse(props.getProperty('서클인쇄_도장') || '{}'); } catch (e) { s = null; }
  if (!s || s.day !== day || !s.구움) return { day: day, 구움: {}, 알림: [], 막힘: [] };
  return {
    day: day, 구움: s.구움,
    알림: Array.isArray(s.알림) ? s.알림 : [],
    막힘: Array.isArray(s.막힘) ? s.막힘 : []      // 「전개완료인데 출석 0」을 하루 한 번만 알리기 위한 칸
  };
}

/* 손 재인쇄 — 지각·정정으로 다시 뽑아야 하는 날의 통로(자동은 반·날짜당 1회라 안 다시 굽는다). */
function menuPrintCircleSheets() { menuRun_(printCircleSheets); }
/* ═════════════ [v9.86·D] 📋 주간 교안 초안 — "수업준비를 만드는 사람"의 백지를 없앤다 ═════════════
 * 유호 07-31 채택(도전안 4번): 수업준비의 최대 병목은 강사의 5분이 아니라 콘텐츠·교안 편집(원장 근무 46% 실측).
 * 매주 월 07시(weeklyJobs 편승) 반별 Google Doc 초안 생성 — 앱이 아는 칸(기간·인원·담당·지난주 이월·오류
 * 톱10·지명 프록시·조 편성·과업 로테이션)은 채우고, 강사 몫 9칸은 양식 v2.0 틀 그대로 비워 둔다.
 * 멱등: 같은 이름 문서가 있으면 재생성하지 않는다(강사·원장 편집 보존 — 링크만 다시 보고).
 * 시즌 미설정·기간 밖이면 조용히 보류(개원 전 무소음). 콘텐츠 정본 = contents_교안.js(과업 은행 20종).
 * ⚠ DocumentApp은 이 프로젝트 최초 사용 — 배포 후 아무 함수 ▶ 1회로 권한 재승인 필요(승인 전 트리거 실패 창). */
const LESSON_PLAN_FOLDER = 'SYNK_교안초안';
function lessonPlanDrafts_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  if (typeof LESSON_TASK_BANK === 'undefined') return '⚠ contents_교안.js 미배포 — 초안 생성 보류.';
  const start = seasonStartOf_(ss);
  if (!start) return '시즌 시작일 미설정(setSeasonStart) — 설정한 주부터 자동 생성됩니다.';
  const week = seasonWeekOf_(start, now);
  if (week < 1 || week > SEASON_WEEKS) return '시즌 기간 밖(주차 ' + week + ') — 생성 없음.';
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return '프로필 없음 — 생성 없음.';
  const pfD = pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues();
  const stuCnt = {}, teachersByCls = {}, clsOfSid = {}, nameOfSid = {};
  pfD.forEach(r => {
    if (!r[0]) return;
    const cN = String(r[4] || '').trim();
    if (r[3] === 'student' && cN) {
      stuCnt[cN] = (stuCnt[cN] || 0) + 1;
      clsOfSid[String(r[0]).trim()] = cN;
      nameOfSid[String(r[0]).trim()] = r[1] || r[0];
    }
    if (r[3] === 'teacher') String(r[4] || '').split(',').forEach(x => { const cc = x.trim(); if (cc) (teachersByCls[cc] = teachersByCls[cc] || []).push(r[1] || r[0]); });
  });
  const classes = Object.keys(stuCnt).sort();
  if (!classes.length) return '학생 배정 반 없음 — 생성 없음.';
  const schM = scheduleMap(ss);
  const season = seasonLabelOf_(ss, tz);
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const sat = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 5);
  const period = Utilities.formatDate(mon, tz, 'M/d') + ' ~ ' + Utilities.formatDate(sat, tz, 'M/d');
  // 지난 7일 마감폼(weekly_topics) — 이월('더연습' 문법태그)·지난주 배운 것 (열: A반·B배운·D시각·F태그·G도달도)
  const carry = {}, prevTopic = {};
  {
    const wt = ss.getSheetByName('weekly_topics');
    if (wt && wt.getLastRow() >= 2) {
      const cut = now.getTime() - 8 * 86400000;
      wt.getRange(2, 1, wt.getLastRow() - 1, 7).getValues().forEach(r => {
        const d = asDate_(r[3]);
        if (!r[0] || !d || isNaN(d.getTime()) || d.getTime() < cut) return;
        const cN = String(r[0]).trim();
        if (String(r[6] || '') === '더연습' && String(r[5] || '').trim()) (carry[cN] = carry[cN] || []).push(String(r[5]).trim());
        if (String(r[1] || '').trim()) prevTopic[cN] = String(r[1]).trim();
      });
    }
  }
  // 오류 톱10 — 양식 §9 "3주차부터 앱 실측을 베껴 쓴다"의 실체(최근 21일·'해결' 제외·빈도순)
  const errTop = {};
  if (week >= 3) {
    const se = ss.getSheetByName('student_errors');
    if (se && se.getLastRow() >= 2) {
      const cut = now.getTime() - 21 * 86400000;
      const agg = {};
      se.getRange(2, 1, se.getLastRow() - 1, 8).getValues().forEach(rr => {
        if (!rr[1] || String(rr[7] || '') === '해결') return;
        const d = toDate_(rr[0]) || (rr[6] instanceof Date ? rr[6] : null);
        if (!d || d.getTime() < cut) return;
        const cN = clsOfSid[String(rr[1]).trim()] || String(rr[2] || '').trim();
        const memo = String(rr[4] || rr[3] || '').trim();
        if (!cN || !memo) return;
        const k = cN + '|' + memo;
        (agg[k] = agg[k] || { c: cN, memo: memo, n: 0 }).n++;
      });
      Object.keys(agg).map(k => agg[k]).sort((a, b) => b.n - a.n).forEach(g => {
        (errTop[g.c] = errTop[g.c] || []);
        if (errTop[g.c].length < 10) errTop[g.c].push(g.memo + (g.n > 1 ? ' ×' + g.n : ''));
      });
    }
  }
  // 지명 프록시 — 양식 §12 "4주차 명단". 발화 실측(차시 마감폼)이 배선되기 전엔 최근 14일 양수 포인트 0 학생.
  const quiet = {};
  if (week >= 4) {
    const gotP = {};
    const pl = ss.getSheetByName('point_logs');
    if (pl && pl.getLastRow() >= 2) {
      const cut = now.getTime() - 14 * 86400000;
      pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues().forEach(r => {
        const d = asDate_(r[5]);
        if (r[1] && Number(r[2]) > 0 && d && !isNaN(d.getTime()) && d.getTime() >= cut) gotP[String(r[1]).trim()] = true;
      });
    }
    Object.keys(clsOfSid).forEach(sid => { if (!gotP[sid]) (quiet[clsOfSid[sid]] = quiet[clsOfSid[sid]] || []).push(nameOfSid[sid]); });
  }
  const fIt = DriveApp.getFoldersByName(LESSON_PLAN_FOLDER);
  const folder = fIt.hasNext() ? fIt.next() : DriveApp.createFolder(LESSON_PLAN_FOLDER);
  const L = [];
  let made = 0, kept = 0;
  classes.forEach(cN => {
    const nameD = '교안초안_' + cN + '_' + season + '_' + week + '주차';
    const ex = folder.getFilesByName(nameD);
    if (ex.hasNext()) { kept++; L.push('· ' + cN + ' (기존 유지) ' + ex.next().getUrl()); return; }
    const sch = schedOf(schM, cN);
    const doc = DocumentApp.create(nameD);
    /* [v9.99] 지명 계획을 실측으로 승격 — §12는 "발화 실측 전 — 포인트 무활동 대체"라고 스스로 적어 뒀다.
     *   발화 지수(출석한 차시의 역할 가중 − 미발화)가 배선됐으므로 그 프록시를 걷어낸다.
     *   편성 전·1주차엔 지수가 없으니 기존 프록시로 조용히 폴백한다(빈칸보다 낫다). */
    let quietList = (quiet[cN] || []).slice(0, 3), talkReal = false;
    if (week >= 2) {
      try {
        const ti = talkIndexOf_(ss, cN, now, tz).filter(x => x.max > 0);
        if (ti.length) {
          quietList = ti.slice(0, 3).map(x => x.name + ' ' + x.pct + '%' + (x.quiet ? '(침묵' + x.quiet + ')' : ''));
          talkReal = true;
        }
      } catch (e) { Logger.log('교안 발화 지수 스킵(' + cN + '): ' + e); }
    }
    lessonPlanFill_(doc.getBody(), {
      cls: cN, week: week, period: period, stuN: stuCnt[cN] || 0,
      teachers: (teachersByCls[cN] || []).join(' · '),
      carry: (carry[cN] || []).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4),
      prevTopic: prevTopic[cN] || '', errTop: errTop[cN] || [], quiet: quietList, talkReal: talkReal,
      wknd: !!(sch && String(sch.type) === '주말'),
      groupText: (function () { try { return groupBoardText_(ss, cN, now, tz); } catch (e) { return ''; } })()
    });
    doc.saveAndClose();
    try { DriveApp.getFileById(doc.getId()).moveTo(folder); } catch (e) { Logger.log('교안 폴더 이동 실패(' + cN + '): ' + e); }
    made++;
    L.push('· ' + cN + ' ' + doc.getUrl());
  });
  return week + '주차 교안 초안 — 신규 ' + made + '반 · 기존 유지 ' + kept + '반 (Drive 폴더: ' + LESSON_PLAN_FOLDER + ')\n' + L.join('\n') +
    '\n앱이 아는 칸만 채웠습니다 — 강사 몫 9칸은 양식 v2.0 그대로(작성 상한 30분).';
}
// 차시 슬롯(1~5)의 추천 과업 — 군은 표준 배분(§6)에, 항목은 주차에 로테이션(8주 동안 같은 차시에 같은 과업이 안 옴)
function lessonPlanTaskFor_(week, slotIdx) {
  if (typeof LESSON_TASK_BANK === 'undefined' || typeof LESSON_TASK_ROTATION === 'undefined') return '';
  const cat = LESSON_TASK_ROTATION[(slotIdx - 1) % LESSON_TASK_ROTATION.length];
  const pool = LESSON_TASK_BANK.filter(t => t[2] === cat);
  if (!pool.length) return '';
  const t = pool[(((Number(week) || 1) - 1) % pool.length + pool.length) % pool.length];
  return t[0] + ' ' + t[1] + ' (' + t[3] + ' · 준비: ' + t[4] + ' · 산출: ' + t[5] + ')';
}
// 초안 본문 — 양식 v2.0의 14항을 그대로 딴다. 채울 수 있는 칸만 채우고 강사 몫은 밑줄로 남긴다.
function lessonPlanFill_(body, o) {
  const line = s => body.appendParagraph(s);
  line('SYNK 주간 교안 — ' + o.cls + ' · ' + o.week + '주차 / ' + SEASON_WEEKS + '주   [앱 초안]');
  line('강사 몫 9칸을 채우면 완성 — 상한 30분 · 해당 없는 칸은 "해당 없음" · 완벽한 교안보다 채워진 교안');
  if (o.week >= 7) line('※ ' + o.week + '주차 — 새 문법을 넣지 않습니다(복습·산출 집중, 8주차 5차시 = 승급 평가)');
  line('');
  line('레벨 Lv___   교재 시냅스 코어 ___권 ' + o.week + '과   담당 ' + (o.teachers || '___________') + '   반 ' + o.cls + ' (' + o.stuN + '명)');
  line('기간 ' + o.period + (o.wknd ? '   (주말반 — 토요일 1차시)' : ''));
  line('지난주 이월  ' + (o.carry.length ? o.carry.join(', ') + '   ← 이번 주 첫 차시 앞 5분' : '없음'));
  if (o.prevTopic) line('지난주 배운 것  ' + o.prevTopic);
  line('');
  line('▣ 1. 이번 주 목표 (can-do 한 줄) — "____________________________ 할 수 있다"');
  line('   ※ 매 차시 칠판 왼쪽에 그대로. "-는데를 안다"가 아니라 "-는데로 이유를 말할 수 있다"');
  line('');
  line('▣ 2. 문법 (2개 · 상한 3개) — ★ 별표는 반드시 하나(버릴 때도 별표만은 다룬다)');
  line('   ① ______________  예문: ______________________');
  line('   ② ______________  예문: ______________________');
  line('   ※ 예문은 학생 이름·동네·좋아하는 것으로 · 차시당 새 문법 1개까지');
  line('');
  line('▣ 3. 어휘 (주제 1개 · 차시당 7개 이하)   주제: ______________   몸짓 붙일 단어 2개+: ______  ______');
  line('▣ 4. 발음 포인트 — □받침 □경음/격음 □유음화 □화계 □기타:  구체적으로 ______________________');
  line('▣ 5. 한자어 (Lv3 이상만) — 어원 묶음: ______ → ______ ______ ______');
  line('');
  line('▣ 6. 차시별 5행 — ②제시에서 다룰 것 + ④소그룹 과업(앱 추천, 바꿔도 됩니다)');
  // [v9.99] 20분 타임박스 — 과업만 주고 시간 배분을 안 주면 20분은 "말 많은 학생의 20분"이 된다
  line('   ⏱ 소그룹 20분 공통 — ' + TALK_PLAN_MIN + '분 계획(말 없이 메모) → ' +
    TALK_ROUNDS.map((m, i) => (i + 1) + 'R ' + m + '분').join(' → ') + ' (라운드마다 짝 교대) → 조별 정리 → 발표');
  line('   🗣 역할 의무 — ' + ROLE_NAMES.map((n, i) => n + '=' + ROLE_DUTY[i]).join(' · ') +
    '   ※ 상급 내용 심화 차시는 3라운드를 끄고 한 과업을 깊게(§6-2 자율)');
  const slots = o.wknd ? [5] : [1, 2, 3, 4, 5];
  slots.forEach(i => {
    const lbl = (typeof LESSON_SLOT_LABELS !== 'undefined' && LESSON_SLOT_LABELS[i - 1]) || '';
    line('   ' + i + '차시  [' + lbl + ']  제시: ______________   ④추천 ' + lessonPlanTaskFor_(o.week, i));
  });
  line('');
  line('▣ 7. 시선 목적지 (차시당 최대 2곳) — □판서 □화면 □교재 (셋 다 금지) · 교재 쓰는 차시: ___');
  line('▣ 8. 확장 3문항 (빠른 학생용 — 같은 문법으로 더 긴 문장) ① ______ ② ______ ③ ______');
  line('');
  line('▣ 9. 예상 오류 + 대응 (3개)' + (o.week >= 3 ? ' — 앱 오류 톱10(최근 21일 실측)에서 골라 옮기세요:' : ' — 1~2주차는 직접 예상해 적습니다'));
  if (o.week >= 3) {
    if (o.errTop.length) o.errTop.forEach((e, i) => line('   톱' + (i + 1) + '. ' + e));
    else line('   (실측 오류 없음 — 직접 예상 3개)');
  }
  line('   ① 이렇게 틀릴 것: ______________ → 이렇게 잡는다: ______________');
  line('   ② ______________ → ______________   ③ ______________ → ______________');
  line('');
  line('▣ 10. 숙제 — 차시별: ______________  주말: ______________  앱 연동: □퀴즈 ___번 □AI 첨삭 □없음');
  line('▣ 11. 준비물 — □인쇄물 ___장 □그림·사진 □실물 □음원/영상 (없을 때 대체 = 수업 규칙 9장)');
  line('');
  // [v9.99] 실측(발화 지수)이 있으면 그것으로, 없으면 구 프록시로 폴백 — 어느 쪽인지 강사에게 밝힌다
  line('▣ 12. 이번 주 지명 계획' + (o.talkReal
    ? ' — 🔈 발화 지수 하위(출석한 차시의 역할 발화량 실측): ' + o.quiet.join('  ')
    : (o.week >= 4
      ? ' — 앱 명단(발화 실측 전 — 최근 2주 포인트 무활동 대체): ' + (o.quiet.length ? o.quiet.join('  ') : '(해당 학생 없음)')
      : ' — 해당 없음(2주차부터 발화 지수 · 4주차부터 대체 명단)')));
  line('   → 5주차 안에 각 3회 지명 · 정답이 아니라 경험을 묻습니다');
  line('');
  line('▣ 13. 주말 점검 — 도달 기준: ______________  못 따라온 학생: ______ ______ → 다음 주: ______');
  line('▣ 14. 다음에 고칠 것 ★수업 끝나고 바로 — 잘 된 것: ______  안 된 것: ______  다음 시즌: ______');
  if (o.groupText) {
    line('');
    line('── 참고: 이번 주 조 편성(앱 자동 — 역할·발표는 차시마다 자동 순환) ──');
    String(o.groupText).split('\n').forEach(t => { if (t.trim()) line('   ' + t); });
  }
}

/* ===================== [v9.91] 📋 차시 마감폼 — 규칙서 §6 「강사 입력 두 개」의 나머지 하나 =====================
 * 정본 = 「SYNK LAB 강사 수업 규칙」 v3.0 §6 · §11 (2026-07-31)
 *   §6  강사 입력은 두 개뿐 — ①출석 1탭(①열기 60초 안) ②차시 마감 30초(수업 후 3분 안)
 *   §11 배선 대기표 "차시 마감폼(진도·발화자) 미구축 → 기록 없음"
 *
 * ▣ 왜 구글 폼인가 (규칙서 §11이 직접 계산해 둔 것)
 *   평일 12반×주5 + 주말 6반×주1 ≈ 월 284차시. 출석 1탭만으로 Glide 월 500건의 57%다.
 *   마감을 앱 화면으로 받으면 568건이 되어 한도를 넘긴다. 폼은 한도를 쓰지 않는다.
 *
 * ▣ 「말한 학생」이 아니라 「말하지 않은 학생」을 받는다 — 규칙서 문구와 다른 유일한 지점
 *   §6은 "발화자 = 오늘 말한 학생(여러 명 선택)"이라 썼지만, §3③이 "이 블록이 끝나기 전 16명
 *   전원이 최소 1회 발화"를 기본값으로 못박았다. 즉 정상 차시의 발화자는 16명 전원이고,
 *   그걸 매번 16번 체크하는 폼은 규칙서 스스로 경계한 "3주 뒤 아무도 안 쓰는 입력"이 된다.
 *   예외(0~2명)만 적으면 정보량은 같고 입력은 1/7이며, §6의 소비처인 「말한 기록이 없는 학생
 *   명단」(4주차)의 직접 재료가 된다. 발화자가 필요하면 그 반 출석자에서 빼면 나온다.
 *
 * ▣ weekly_topics와의 관계 — 겹치지 않는다
 *   weekly_topics F~L(v9.36)은 배운내용·문법태그·도달도·숙제완료자 = 수업 '내용' 로그이고
 *   Glide 입력 경로다. 이 폼은 진도 3택·미발화자 = 수업 '지표' 로그이고 폼 경로다.
 *   소비처도 다르다(전자 = 진화 게이트·번역·브리핑 / 후자 = 조 편성 침묵 점수·이월 경보·4주차 명단). */

// LESSON_CLOSE_HEADERS 정본은 Code.js(GROUPS_HEADERS 옆) — [v9.135] 골격이 지연 평가라 순서 제약은 없어졌지만, 헤더 정본은 상수 정본 파일(Code.js)에 모아 둔다.
const LESSON_PROGRESS = ['완료', '이월', '미실시'];
const LESSON_CARRY_LIMIT = 4;  // 규칙서 외울것 2 — 시즌 이월 4회 초과 = 강사 문제가 아니라 교안 과적재

function lessonCloseSpec_(ss) {
  const base = teacherMemoSpec_(ss); // 강사·반 로스터 재사용 — 아침 동기화도 같은 원천을 본다
  return {
    title: 'SYNK 차시 마감 (강사용 · 30초)',
    desc: '수업 끝나고 30초. 진도 하나 고르고, 오늘 한 번도 말하지 않은 학생이 있으면 이름만 적어주세요. ' +
      '이 두 가지가 조 편성·4주차 점검·교안 과적재 경보로 이어집니다. 서술형은 없습니다.',
    teachers: base.teachers,
    classes: base.classes,
    help: {
      '진도': '완료 = 오늘 목표까지 갔다 · 이월 = 남은 것을 다음 차시 ②앞 5분으로 넘긴다 · 미실시 = 휴강·행사로 진행 못 함',
      '오늘 한 번도 말하지 않은 학생': '없으면 비워두세요 — 전원 말했다는 뜻입니다. 여러 명이면 쉼표로 (예: 바트자야, 사랑토야)'
    }
  };
}

// 실제 폼을 스펙에 제자리 동기화 — 폼이 없으면 -1(호출부가 생성 경로로). 약점 메모 폼(v9.64) 계보 그대로.
function syncLessonCloseForm_(ss, st) {
  let formId = '';
  try { formId = String((getState(st, '마감폼ID') || {}).val || '').trim(); } catch (eS) {}
  if (!formId) { // ID 유실 시 응답 시트의 연결 폼에서 복구
    try {
      const shR = ss.getSheetByName('마감폼_응답');
      const editUrl = shR && shR.getFormUrl();
      if (editUrl) { const f0 = FormApp.openByUrl(editUrl); formId = f0.getId(); setState(st, '마감폼ID', formId); setState(st, '마감폼URL', f0.getPublishedUrl()); }
    } catch (eR) {}
  }
  if (!formId) return -1;
  const form = FormApp.openById(formId);
  const spec = lessonCloseSpec_(ss);
  let changed = 0;
  if (form.getTitle() !== spec.title) { form.setTitle(spec.title); changed++; }
  if (form.getDescription() !== spec.desc) { form.setDescription(spec.desc); changed++; }
  form.getItems().forEach(it => {
    const t = it.getTitle();
    const wantHelp = spec.help[t];
    if (wantHelp !== undefined && it.getHelpText() !== wantHelp) { it.setHelpText(wantHelp); changed++; }
    if (it.getType() !== FormApp.ItemType.LIST) return;
    const li = it.asListItem();
    const cur = li.getChoices().map(c => c.getValue()).join('|');
    const want = (t === '강사' ? spec.teachers : t === '반' ? spec.classes : t === '진도' ? LESSON_PROGRESS : null);
    if (want && cur !== want.join('|')) { li.setChoiceValues(want); changed++; }
  });
  if (changed) Logger.log('📋 차시 마감폼 동기화 — ' + changed + '곳 갱신(URL 불변)');
  return changed;
}

function createLessonCloseForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const synced = syncLessonCloseForm_(ss, st); // 이미 있으면 복제 대신 제자리 업그레이드
  if (synced >= 0) {
    const msg = '✅ 차시 마감폼 — 이미 있어 제자리 업그레이드만 했습니다(' + synced + '곳 갱신 · URL 불변): ' + String((getState(st, '마감폼URL') || {}).val || '');
    Logger.log(msg);
    return msg;
  }
  /* [v9.93] 4단계 멱등 — 2026-08-01 실사고 대응.
   * 첫 실행이 8분 만에 DEADLINE_EXCEEDED로 죽었다. 원인 자체(응답 시트 연결이 느린 것)는
   * 스프레드시트 크기 문제라 코드가 없앨 수 없지만, 그때 **폼은 이미 만들어졌는데 ID 저장이
   * 맨 뒤에 있어 앱이 그 폼의 존재를 몰랐다** — 재실행하면 폼이 하나 더 생기고 배포한 링크가 갈린다.
   * 그래서 ①생성 직후 즉시 ID를 박고 ②각 단계는 이미 끝났으면 건너뛰고 ③단계마다 경과초를 남긴다.
   * 죽어도 재실행이 남은 단계만 이어서 한다. */
  const t0 = Date.now();
  const step = m => Logger.log('[' + Math.round((Date.now() - t0) / 1000) + 's] ' + m);
  const spec = lessonCloseSpec_(ss);
  step('스펙 준비 — 강사 ' + spec.teachers.length + '명 · 반 ' + spec.classes.length + '개');

  // ① 고아 폼 회수 — 직전 실행이 ID 저장 전에 끊겼다면 같은 이름의 폼이 이미 드라이브에 있다
  let form = null;
  try {
    const it = DriveApp.getFilesByName(spec.title);
    const found = [];
    while (it.hasNext()) found.push(it.next().getId());
    if (found.length) {
      form = FormApp.openById(found[0]);
      step('♻ 고아 폼 회수 — 직전 실행이 만들어 두고 기록 못 한 폼을 재사용합니다' +
        (found.length > 1 ? ' (⚠ 같은 이름 ' + found.length + '개 — 나머지는 드라이브에서 수동 삭제하세요)' : ''));
    }
  } catch (eD) { step('드라이브 조회 건너뜀: ' + eD.message); }

  // ② 없으면 생성 — 그리고 곧바로 ID·URL을 박는다(여기서 죽어도 다음 실행이 ①에서 찾는다)
  if (!form) {
    form = FormApp.create(spec.title).setDescription(spec.desc).setCollectEmail(false);
    setState(st, '마감폼ID', form.getId());
    setState(st, '마감폼URL', form.getPublishedUrl());
    step('폼 생성 + ID 즉시 기록');
  } else {
    setState(st, '마감폼ID', form.getId());
    setState(st, '마감폼URL', form.getPublishedUrl());
  }

  // ③ 문항 4개 — 이미 있으면 손대지 않는다(응답 시트가 항목별 열이라 지웠다 만들면 sweep 5열 계약이 깨진다)
  if (!form.getItems().length) {
    if (spec.teachers.length > 1) form.addListItem().setTitle('강사').setRequired(true).setChoiceValues(spec.teachers);
    else form.addTextItem().setTitle('강사').setRequired(true);
    if (spec.classes.length > 1) form.addListItem().setTitle('반').setRequired(true).setChoiceValues(spec.classes);
    else form.addTextItem().setTitle('반').setRequired(true);
    form.addListItem().setTitle('진도').setRequired(true).setChoiceValues(LESSON_PROGRESS).setHelpText(spec.help['진도']);
    form.addTextItem().setTitle('오늘 한 번도 말하지 않은 학생').setRequired(false).setHelpText(spec.help['오늘 한 번도 말하지 않은 학생']);
    step('문항 4개 추가');
  } else step('문항 이미 있음 — 건너뜀 (' + form.getItems().length + '개)');

  // ④ 응답 시트 연결 — 가장 무거운 단계라 맨 뒤에 둔다(여기서 죽어도 ①~③은 이미 남아 있다)
  let linked = false;
  try { linked = !!form.getDestinationId(); } catch (eL) { linked = false; }
  if (!linked) {
    const before = ss.getSheets().map(s => s.getName());
    form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
    linkFormTab_(ss, before, '마감폼_응답');
    step('응답 시트 연결 — 마감폼_응답');
  } else step('응답 시트 이미 연결됨 — 건너뜀');

  ensureSheet(ss, 'lesson_close', LESSON_CLOSE_HEADERS);
  step('완료');
  adminMail('[SYNK] 📋 차시 마감폼 생성 완료',
    '강사 단톡·즐겨찾기에 배포할 링크:\n' + form.getPublishedUrl() +
    '\n\nGlide 수업 준비 탭 버튼(Open Link)에도 이 URL을 넣으면 됩니다.\n편집용: ' + form.getEditUrl() +
    '\n\n※ 재실행해도 안전합니다(제자리 업그레이드 · URL 불변). 반·강사가 바뀌면 다음 날 아침 드롭다운이 자동 갱신됩니다.' +
    '\n※ 차시·주차는 시즌 시작일에서 계산합니다 — app_state "시즌시작일"이 비어 있으면 0으로 적재됩니다.');
  Logger.log('✅ 차시 마감폼 생성 완료: ' + form.getPublishedUrl());
  Logger.log('편집용: ' + form.getEditUrl());
}

// [v9.93] 마감폼 상태 진단 — 생성이 중간에 끊겼을 때 "지금 어디까지 됐나"를 30초에 본다(무거운 호출 없음).
function lessonCloseFormStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const id = String(getState(st, '마감폼ID').val || '');
  const url = String(getState(st, '마감폼URL').val || '');
  const L = ['📋 차시 마감폼 상태'];
  L.push('· app_state 마감폼ID : ' + (id || '(없음)'));
  L.push('· app_state 마감폼URL: ' + (url || '(없음)'));
  if (id) {
    try {
      const f = FormApp.openById(id);
      L.push('· 폼 제목: ' + f.getTitle() + ' · 문항 ' + f.getItems().length + '개(정상=4)');
      let dest = ''; try { dest = f.getDestinationId() || ''; } catch (e) { dest = ''; }
      L.push('· 응답 시트 연결: ' + (dest ? '✅ 연결됨' : '❌ 미연결 — createLessonCloseForm 재실행하면 이 단계만 이어서 합니다'));
    } catch (e) { L.push('· ⚠ 폼 열기 실패(삭제됐거나 권한 없음): ' + e.message); }
  }
  L.push('· 마감폼_응답 시트: ' + (ss.getSheetByName('마감폼_응답') ? '있음' : '없음'));
  const lc = ss.getSheetByName('lesson_close');
  L.push('· lesson_close 적재: ' + (lc ? Math.max(lc.getLastRow() - 1, 0) + '행' : '시트 없음'));
  const out = L.join('\n');
  Logger.log(out);
  return out;
}

/* 폼 응답 → lesson_close 전개. 이름→sid 매칭은 약점 메모·학업 폼과 같은 규칙(동명이인은 반으로 가른다).
 * 미매칭은 sid 공란 + 상태 '미매칭'으로 적재 — 소비처(침묵 점수·4주차 명단)가 공란을 스킵하므로 오염 0. */
function sweepLessonCloseForm_(ss) {
  const src = ss.getSheetByName('마감폼_응답');
  if (!src || src.getLastRow() < 2) return;
  const props = PropertiesService.getScriptProperties();
  const last = src.getLastRow();
  const from = Number(props.getProperty('마감폼_포인터')) || 1;
  if (from >= last) { if (from > last) props.setProperty('마감폼_포인터', String(last)); return; }
  const tz = ss.getSpreadsheetTimeZone();
  const rows = src.getRange(from + 1, 1, last - from, 5).getValues(); // 타임스탬프·강사·반·진도·미발화자이름
  const pf = ss.getSheetByName('profiles');
  const students = [];
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
    if (r[0] && r[3] === 'student') students.push({ sid: String(r[0]).trim(), n: String(r[1] || ''), c: String(r[4] || '') });
  });
  const start = seasonStartOf_(ss);
  const schMap = scheduleMap(ss);
  const lc = ensureSheet(ss, 'lesson_close', LESSON_CLOSE_HEADERS);
  const out = [], miss = [];
  rows.forEach(r => {
    const ts = r[0] instanceof Date ? r[0] : new Date();
    const cls = String(r[2] || '').trim();
    if (!cls) return;
    const sch = schedOf(schMap, cls);
    const lessonNo = start ? lessonNoOf_(start, ts, sch ? sch.type : '평일') : 0;
    const week = start ? seasonWeekOf_(start, ts) : 0;
    const names = String(r[4] || '').split(/[,·\n]/).map(s => s.trim()).filter(Boolean);
    const sids = [], bad = [];
    names.forEach(nm => {
      const cands = matchStudentsByNameClass_(students, nm, cls);
      if (cands.length === 1) sids.push(cands[0]);
      else { bad.push(nm); miss.push('· ' + nm + ' (' + cls + ') — 로스터 후보 ' + cands.length + '명 · 이름을 확인해 주세요'); }
    });
    out.push([dstr(ts, tz), cls, lessonNo, week, String(r[3] || ''), sids.join(','), names.join(','),
      String(r[1] || '폼'), dstr(ts, tz, 'yyyy-MM-dd'), bad.length ? '미매칭' : '']);
  });
  if (out.length) lc.getRange(lc.getLastRow() + 1, 1, out.length, LESSON_CLOSE_HEADERS.length).setValues(행소독_(out)); // [v9.157] 진도·미발화자 이름은 강사 손입력 — 같은 시트에 profiles가 산다
  props.setProperty('마감폼_포인터', String(last)); // 적재 직후·메일 전 마감 — 메일 실패가 같은 응답을 재적재하지 않게
  if (miss.length && quotaOk(1)) {
    adminMail('[SYNK] 📋 차시 마감폼 — 이름 매칭 실패 ' + miss.length + '건',
      '아래 학생은 lesson_close에 이름만 남고 학생ID가 비어 있습니다(침묵 점수·4주차 명단에서 제외됩니다).\n\n' +
      miss.join('\n') + '\n\nlesson_close 시트의 「미발화자」 열에 학생ID를 직접 채우면 다음 계산부터 반영됩니다.');
  }
  if (out.length) lessonCarryAlert_(ss, tz); // 이월 누적 경보는 새 응답이 있을 때만 본다
}

/* 이월 4회 경보 — 규칙서 외울것 2: "시즌에 이월이 4회를 넘으면 강사 문제가 아니라 교안이 과적재된 것.
 * 원장에게 알려집니다." 반별로 시즌 1회만 알린다(app_state dedup). */
function lessonCarryAlert_(ss, tz) {
  const lc = ss.getSheetByName('lesson_close');
  if (!lc || lc.getLastRow() < 2) return;
  const season = seasonLabelOf_(ss, tz);
  if (!season) return; // 시즌 시작일이 없으면 '시즌 내 4회'를 셀 기준이 없다
  const start = seasonStartOf_(ss);
  const endMs = start.getTime() + SEASON_WEEKS * 7 * 86400000;
  const cnt = {};
  lc.getRange(2, 1, lc.getLastRow() - 1, LESSON_CLOSE_HEADERS.length).getValues().forEach(r => {
    if (String(r[4]) !== '이월') return;
    const d = toDate_(r[0]);
    if (!d || d < start || d.getTime() > endMs) return;
    const c = String(r[1] || ''); if (c) cnt[c] = (cnt[c] || 0) + 1;
  });
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const over = Object.keys(cnt).filter(c => cnt[c] > LESSON_CARRY_LIMIT);
  if (!over.length) return;
  const key = '이월경보_' + season;
  const done = String(getState(st, key).val || '');
  const fresh = over.filter(c => done.indexOf('[' + c + ']') < 0);
  if (!fresh.length) return;
  if (quotaOk(1)) {
    adminMail('[SYNK] 📋 교안 과적재 경보 — ' + fresh.length + '개 반',
      fresh.map(c => '· ' + c + ' — 이번 시즌 이월 ' + cnt[c] + '회').join('\n') +
      '\n\n규칙서 「외울 것 2」: 시즌에 이월이 ' + LESSON_CARRY_LIMIT + '회를 넘으면 강사 문제가 아니라 교안이 과적재된 것입니다.' +
      '\n주간 교안의 차시별 분량을 줄이는 쪽을 먼저 보십시오(강사에게 속도를 요구하면 ④소그룹 20분이 깎입니다).');
  }
  setState(st, key, done + fresh.map(c => '[' + c + ']').join(''));
}

/* 4주차 침묵 학생 명단 — 규칙서 §6 "4주차에 「말한 기록이 없는 학생」 명단을 띄웁니다" ·
 * "그 학생들에게 5주차 안에 지명 발화 3회를 배정합니다".
 * weeklyJobs(월 07시)에서 호출 — 시즌 4주차에 든 주에만 발송한다(시즌당 1회, app_state dedup). */
function silentRosterAlert_(ss, tz) {
  const start = seasonStartOf_(ss);
  if (!start) return '';
  const week = seasonWeekOf_(start, new Date());
  if (week !== 4) return '';
  const season = seasonLabelOf_(ss, tz);
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const key = '침묵명단_' + season;
  if (String(getState(st, key).val || '')) return ''; // 시즌 1회
  const lc = ss.getSheetByName('lesson_close');
  if (!lc || lc.getLastRow() < 2) return '';
  const pf = ss.getSheetByName('profiles');
  const nameOf = {}, clsOf = {};
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
    // [v9.235] 표시 그룹핑도 같은 키로 접는다 — 「정규반2(9시)」와 「정규반2」가 섞이면 한 반이 두 줄로 갈라져 보인다(빈 값은 그대로 '' → '(반 미상)').
    if (r[0] && r[3] === 'student') { nameOf[String(r[0])] = String(r[1] || r[0]); clsOf[String(r[0])] = 반키_(r[4]); }
  });
  const cnt = {};
  lc.getRange(2, 1, lc.getLastRow() - 1, LESSON_CLOSE_HEADERS.length).getValues().forEach(r => {
    const d = toDate_(r[0]);
    if (!d || d < start) return;
    String(r[5] || '').split(',').forEach(s => { const id = s.trim(); if (id) cnt[id] = (cnt[id] || 0) + 1; });
  });
  const ids = Object.keys(cnt).filter(id => nameOf[id]).sort((a, b) => cnt[b] - cnt[a]);
  if (!ids.length) return '';
  const byCls = {};
  ids.forEach(id => { const c = clsOf[id] || '(반 미상)'; (byCls[c] = byCls[c] || []).push(nameOf[id] + ' ' + cnt[id] + '회'); });
  const body = Object.keys(byCls).sort().map(c => '· ' + c + ': ' + byCls[c].join(' · ')).join('\n');
  if (quotaOk(1)) {
    adminMail('[SYNK] 🔇 4주차 침묵 학생 명단 — ' + ids.length + '명',
      '이번 시즌 마감폼에 「말하지 않은 학생」으로 올라온 횟수입니다.\n\n' + body +
      '\n\n규칙서 §6: 이 학생들에게 5주차 안에 지명 발화 3회를 배정하십시오.' +
      '\n지명은 정답을 묻는 질문이 아니라 경험을 묻는 질문으로 합니다.' +
      '\n\n※ 교실이 조용하면 잘 굴러가는 것처럼 보여 강사는 문제를 못 느낍니다. 그 학생은 재등록하지 않고, 왜 안 왔는지 아무도 모릅니다.');
  }
  setState(st, key, String(ids.length));
  return '🔇 4주차 침묵 학생 ' + ids.length + '명 — 5주차 지명 발화 배정 대상(상세는 원장 메일)';
}

/* ===================== [v9.92] 📋 마감 미제출 감시 — 「필수」를 기계로 강제 =====================
 * 유호님 2026-08-01 확정: 차시 마감 30초를 강사 필수 루틴으로. (07-25 「필수 = 출석 1탭 하나」에 하나 추가)
 *
 * ▣ 왜 감시가 필요한가
 *   필수라고 문서에 쓰기만 하면 재량과 같아진다. 반쪽 데이터는 무데이터보다 나쁘다 —
 *   성실한 강사 반만 기록이 쌓이면 4주차 침묵 명단에 그 반 학생만 올라오고, 안 낸 반은
 *   침묵 학생이 0명인 것처럼 보인다. 등급 심사에 쓰면 성실한 강사가 오히려 불리해진다.
 *
 * ▣ 판정 규칙 — 규칙서 §6의 휴강 정의를 그대로 쓴다
 *   "앱은 그 반에 출석 기록이 하나도 없으면 휴강으로 본다."
 *   따라서 미제출 = (어제 출석 기록이 있는 반) − (어제 마감 행이 있는 반).
 *   휴강·공휴일은 출석이 0건이라 분모에서 자동으로 빠진다. 별도 달력이 필요 없다. */

// 어제 마감 미제출 반 → 담당 강사에게 하루 1통. 반환 = 원장 브리핑용 요약(없으면 빈 문자열).
function lessonCloseGapAlert_(ss, tz) {
  const now = new Date();
  const y = new Date(now.getTime() - 86400000);
  const yStr = Utilities.formatDate(y, tz, 'yyyy-MM-dd');
  if (!classDowOk_('평일', y.getDay()) && !classDowOk_('주말', y.getDay())) return ''; // 일요일 = 수업 없음

  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  if (String(getState(st, '마감미제출_알림').val || '') === yStr) return ''; // 같은 날 재발송 금지

  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return '';
  const clsOf = {};
  pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
    if (r[0] && r[3] === 'student' && r[4]) clsOf[String(r[0])] = 반키_(r[4]);
  });

  // ① 어제 실제로 수업한 반 = 출석 기록이 1건이라도 있는 반
  const taught = {};
  const att = ss.getSheetByName('attendance');
  if (att && att.getLastRow() >= 2) att.getRange(2, 1, att.getLastRow() - 1, 4).getValues().forEach(r => {
    if (dstr(r[2], tz) !== yStr) return;
    const c = clsOf[String(r[1])];
    if (c) taught[c] = true;
  });
  if (!Object.keys(taught).length) return ''; // 어제 수업 자체가 없었다(전 반 휴강·개원 전)

  // ② 어제 마감을 낸 반
  const closed = {};
  const lc = ss.getSheetByName('lesson_close');
  if (lc && lc.getLastRow() >= 2) lc.getRange(2, 1, lc.getLastRow() - 1, 2).getValues().forEach(r => {
    if (dstr(r[0], tz) === yStr && r[1]) closed[String(r[1])] = true;
  });

  const gaps = Object.keys(taught).filter(c => !closed[c]).sort();
  if (!gaps.length) { setState(st, '마감미제출_알림', yStr); return ''; } // 전 반 제출 — 조용히 통과

  // ③ 담당 강사별로 묶어 1통씩 (반이 여러 개면 한 통에 모아 보낸다)
  const emap = teacherEmailMap_(ss);
  const formUrl = String(getState(st, '마감폼URL').val || '');
  const byTeacher = {};
  gaps.forEach(c => {
    (emap.byClass[c] || []).forEach(t => { (byTeacher[t.email] = byTeacher[t.email] || { name: t.name, cls: [] }).cls.push(c); });
  });
  Object.keys(byTeacher).forEach(email => {
    const v = byTeacher[email];
    if (!quotaOk(1)) return;
    MailApp.sendEmail(email, '[SYNK] 📋 어제 차시 마감이 비어 있습니다 — ' + v.cls.join(', '),
      (v.name ? v.name + ' 선생님, ' : '') + yStr + ' 수업 중 아래 반의 마감이 들어오지 않았습니다.\n\n' +
      v.cls.map(c => '· ' + c).join('\n') +
      '\n\n지금 30초만 내주세요 — 진도 하나, 말 안 한 학생 있으면 이름만.\n' +
      (formUrl ? formUrl + '\n' : '') +
      '\n이 기록이 없으면 그 차시의 조용했던 학생이 4주차 명단에서 빠집니다.\n' +
      '(교실이 조용하면 잘 굴러가는 것처럼 보이기 때문에, 그 학생은 아무도 모르게 멀어집니다.)');
  });
  setState(st, '마감미제출_알림', yStr);
  return '📋 어제 마감 미제출 ' + gaps.length + '개 반: ' + gaps.join(', ') +
    (Object.keys(byTeacher).length ? ' — 담당 강사 ' + Object.keys(byTeacher).length + '명에게 발송' : ' — ⚠ 담당 강사 이메일 미등록');
}

/* 시즌 마감 제출률 — 주간 리포트용. 필수 루틴이 실제로 지켜지는지의 유일한 계측치이고,
 * 등급 심사에 쓰려면 반마다 분모가 같아야 하므로 '출석이 있었던 차시'만 분모로 센다. */
function lessonCloseRate_(ss, tz) {
  const start = seasonStartOf_(ss);
  if (!start) return '';
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return '';
  const clsOf = {};
  pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
    if (r[0] && r[3] === 'student' && r[4]) clsOf[String(r[0])] = 반키_(r[4]);
  });
  const taught = {}; // 반|날짜 → true
  const att = ss.getSheetByName('attendance');
  if (att && att.getLastRow() >= 2) att.getRange(2, 1, att.getLastRow() - 1, 4).getValues().forEach(r => {
    const d = toDate_(dstr(r[2], tz));
    if (!d || d < start) return;
    const c = clsOf[String(r[1])];
    if (c) taught[c + '|' + dstr(r[2], tz)] = true;
  });
  const total = Object.keys(taught).length;
  if (!total) return '';
  const closed = {};
  const lc = ss.getSheetByName('lesson_close');
  if (lc && lc.getLastRow() >= 2) lc.getRange(2, 1, lc.getLastRow() - 1, 2).getValues().forEach(r => {
    const key = String(r[1] || '') + '|' + dstr(r[0], tz);
    if (taught[key]) closed[key] = true;
  });
  const done = Object.keys(closed).length;
  const rate = Math.round(done * 100 / total);
  const byCls = {};
  Object.keys(taught).forEach(k => { const c = k.split('|')[0]; byCls[c] = byCls[c] || { t: 0, d: 0 }; byCls[c].t++; if (closed[k]) byCls[c].d++; });
  const weak = Object.keys(byCls).filter(c => byCls[c].d * 100 / byCls[c].t < 80)
    .sort().map(c => c + ' ' + Math.round(byCls[c].d * 100 / byCls[c].t) + '%');
  return '마감 제출률: ' + rate + '% (' + done + '/' + total + '차시)' +
    (weak.length ? ' · 80% 미만: ' + weak.join(' · ') : ' · 전 반 80% 이상') +
    (rate < 80 ? '\n  ⚠ 제출률이 낮으면 4주차 침묵 명단·이월 경보·조 편성 침묵 균형이 반쪽 데이터로 돌아갑니다.' : '');
}

/* ===================== [v9.106] 🎬 온라인 녹화 강의 — 주말반 시수의 나머지 =====================
 * 유호님 08-01 확정: 주말반 = 정규 트랙(에드온 폐지). 대면 토 1회 90분 + 녹화 강의로 시수를 메우고,
 *   커리큘럼·시즌·승급 기준은 평일과 동일하다. 가격도 평일과 같다(올액세스는 주말생에게 팔지 않는다).
 *
 * 이 절이 푸는 문제: 「온라인이 커리큘럼의 정식 일부」라고 상담에서 고지해 놓고 이수 여부를 앱이
 *   모르면, 8주차 승급 도달제 판정이 **대면 90분만 보고** 내려진다. 강사 2층 「승급 통과율」 20점도
 *   같은 눈으로 매겨지므로 돈이 걸린 지표가 반쪽 데이터 위에 선다(v9.89 결석 복귀율과 같은 계급의 구멍).
 *
 * 확인 방법 = 체크박스가 아니라 **한 줄 요약**이다. "봤어요" 체크는 3주 뒤 전원 100%가 되고 아무것도
 *   증명하지 못한다. 배운 것을 한국어 한 문장으로 쓰게 하면 시청 증명·산출 연습·강사가 볼 재료가
 *   한 번에 나온다 — 한국어 학원에서 가장 싼 검증은 한국어를 쓰게 하는 것이다.
 *
 * 무데이터는 0%가 아니다(v9.89 규약 계승): 배정된 필수 강의가 없으면 rate=null로 두고 분모에 안 넣는다.
 *   카탈로그를 아직 안 채웠다는 이유로 학생·강사가 0점을 맞으면 안 된다.
 */

// 순수 함수 — tests/온라인강의.test.js가 직접 로드해 검증한다(시트 접근 없음).
//   required = 그 학생에게 배정된 필수 강의ID 배열 · viewed = 그 학생이 제출한 강의ID 배열
function lectureProgressOf_(required, viewed) {
  const need = [];
  (required || []).forEach(function (x) {
    const s = String(x == null ? '' : x).trim();
    if (s && need.indexOf(s) < 0) need.push(s); // 중복 배정은 한 번만 센다
  });
  if (!need.length) return { done: 0, total: 0, rate: null }; // 배정 없음 = 무데이터. 0%로 환산하지 않는다
  const seen = {};
  (viewed || []).forEach(function (x) {
    const s = String(x == null ? '' : x).trim();
    if (s) seen[s] = 1;
  });
  let done = 0;
  need.forEach(function (id) { if (seen[id]) done++; });
  return { done: done, total: need.length, rate: Math.round(done / need.length * 100) };
}

// 학생별 이수율 — 반유형 '주말'인 학생만 대상(평일반은 대면으로 시수가 차서 필수가 아니다).
//   반환 { sid: {name, cls, done, total, rate} }
function lectureRatesOf_(ss) {
  const out = {};
  const lec = ss.getSheetByName('lectures');
  if (!lec || lec.getLastRow() < 2) return out;
  const season = Number((getState(ensureSheet(ss, 'app_state', ['key', 'value']), '현재시즌') || {}).val) || 0;
  const reqByLevel = {}; // 레벨 → 필수 강의ID[]  ('*' = 전 레벨 공통)
  lec.getRange(2, 1, lec.getLastRow() - 1, LECTURE_HEADERS.length).getValues().forEach(function (r) {
    const id = String(r[0] || '').trim();
    if (!id) return;
    if (!/^(y|o|1|필수|true|예)$/i.test(String(r[6] == null ? '' : r[6]).trim())) return; // 선택 강의는 분모 제외 — [v9.125] 대소문자·'예' 허용(소문자 y가 경보 없이 분모에서 빠지던 구멍)
    if (season && Number(r[2]) && Number(r[2]) !== season) return; // 시즌 지정이 있으면 현재 시즌만
    const lv = String(r[1] || '').trim() || '*';
    (reqByLevel[lv] = reqByLevel[lv] || []).push(id);
  });

  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return out;
  const smap = scheduleMap(ss);

  const seenBy = {};
  const vw = ss.getSheetByName('lecture_views');
  if (vw && vw.getLastRow() >= 2) vw.getRange(2, 1, vw.getLastRow() - 1, LECTURE_VIEW_HEADERS.length).getValues()
    .forEach(function (r) { const sid = String(r[1] || '').trim(); if (sid) (seenBy[sid] = seenBy[sid] || []).push(r[4]); });

  // [v9.119] 레벨 열은 이름으로 찾는다. 못 찾으면 레벨 매칭을 포기하고 '*'(전 레벨 공통)만 쓴다 —
  //   엉뚱한 열을 레벨로 읽어 조용히 오답을 내느니, 매칭을 안 하는 편이 낫다.
  const lvCol = profileLevelCol_(pf);
  if (lvCol < 0) Logger.log('⚠ profiles에 「' + PROFILE_LEVEL_HEADER + '」 열이 없습니다 — 레벨별 배정을 건너뜁니다');
  pf.getRange(2, 1, pf.getLastRow() - 1, pf.getLastColumn()).getValues().forEach(function (r) {
    if (!r[0] || r[3] !== 'student') return;
    const cls = String(r[4] || '').trim();
    const sch = schedOf(smap, cls);
    if (!sch || String(sch.type).trim() !== '주말') return; // 주말반만 — 평일반은 대면으로 시수가 찬다 [v9.125] trim 통일(후행 공백이면 대상 0명)
    const lv = lvCol >= 0 ? String(r[lvCol] || '').trim() : ''; // 완전초보·기초·초중급·중급·고급
    const need = (reqByLevel[lv] || []).concat(reqByLevel['*'] || []);
    const p = lectureProgressOf_(need, seenBy[String(r[0]).trim()]);
    out[String(r[0]).trim()] = { name: String(r[1] || r[0]), cls: cls, done: p.done, total: p.total, rate: p.rate };
  });
  return out;
}

/* [v9.124] 메뉴에서 부른 결과를 **눈에 보이게** 한다.
 *   지금까지 메뉴 항목은 `Logger.log`만 남겼다 — 실행 로그는 편집기를 열어야 보이므로, 유호님 입장에서는
 *   누르면 **아무 일도 안 일어난 것처럼 보인다.** 그 결과가 확인 없는 재클릭이고, 멱등이 아닌 함수에서는
 *   그게 곧 사고다. 실패도 반드시 보여준다 — 조용히 실패하면 "했다"고 믿은 채 다음 단계로 간다.
 *   throw를 다시 올리는 이유: alert만 띄우고 삼키면 실행 기록에 「완료됨」으로 남아 사후 추적이 거짓말을 한다. */
function menuRun_(fn) {
  const ui = SpreadsheetApp.getUi();
  let out;
  try {
    out = String(fn() || '(반환값 없음)');
  } catch (err) {
    ui.alert('❌ 실패했습니다\n\n' + String(err && err.message || err).slice(0, 800) +
      '\n\n일부 단계는 이미 반영됐을 수 있습니다 — 같은 항목을 다시 누르면 남은 단계만 이어서 합니다.\n이 문구를 그대로 알려 주세요.'); // [v9.125] "아무것도 안 바뀜" 단언은 다단계 함수(폼 생성 등)에서 거짓이었다
    throw err;
  }
  ui.alert(out.length > 1400 ? out.slice(0, 1400) + '\n\n…(이하 생략 — 전체는 실행 로그)' : out);
}
function menuSetupLectures() { menuRun_(setupLectures); }
function menuCreateLectureForm() { menuRun_(createLectureForm); }
function menuPruneStaleLectures() { menuRun_(pruneStaleLectures); }
function menuSyncLectureForm() { menuRun_(syncLectureFormChoices); }
function menuLectureJoinDiag() { menuRun_(lectureJoinDiag); }
function menuSelfHeal() { menuRun_(sheetSelfHealNow); } // [v9.127] 자기치유 결과 가시화
function menuCreateQuizForm() { menuRun_(createQuizForm); } // [v9.138] 퀴즈 응답 폼 — 수집층 입구(재실행 안전)
function menuMigrateHwForm() { menuRun_(migrateHwFormV9138); } // [v9.138] 숙제 폼 증분 — 문항 연결·재작성 경로(멱등)
function menuMigrateVoiceForm() { menuRun_(migrateVoiceFormMissionId); } // [v9.190] 목소리 폼 미션ID 증분(멱등 — 야간 배치도 부른다)
// 🔗 면접폼에 학생ID 1칸(선택) — 의도(크루카드)와 결과(면접 합·불)를 한 사람으로 잇는 조인 키.
//   생성부는 살아 있는 폼을 안 건드리므로 이 클릭이 유일한 통로다(멱등 · 익명 회수는 그대로).
function menuMigrateInterviewSid() { menuRun_(migrateInterviewSid); }
// [v9.180] 링크 둘로 — 공개 링크는 익명 그대로 두고, 아는 사람에게만 학생ID가 채워진 개인 링크를 준다.
//   프롬프트 1개(학생ID)라 메뉴가 유일한 경로다(편집기 실행은 인자를 못 준다 · v9.131 계보).
function menuInterviewPersonalLink() { menuRun_(interviewPersonalLink); }
function menuCreateTalkForm() { menuRun_(createTalkForm); } // [v9.138] 한국어 대화 폼 — 회화 앱 1세대(재실행 안전)
function menuDataCoverage() { menuRun_(dataCoverageReport); } // [v9.138] 커버리지 — 읽기 전용이라 언제 눌러도 안전
// [v9.166] 강사 정답 모음 → 회화 앱 평가 픽스처. 시트는 안 건드리고 내 드라이브에 JSON 1개를 새로 만든다.
//   식별자는 함수 안에서 전부 잘려 나간다(동의 v18.9의 「비식별 사용」 · 목적지가 git이라 되돌릴 수 없음).
function menuExportGolden() { menuRun_(exportGoldenFixture_); }
// [v9.175] 같은 픽스처를 SYNK-talk 저장소에 **직접** 올린다(손으로 받아 옮기는 절차 제거).
//   ⚠ 바깥으로 나가는 쓰기다 — 배치에 넣지 않고 메뉴에만 둔다. 그 클릭이 승인이다.
//   토큰이 없으면 실패가 아니라 설치 절차를 안내한다(문서 = docs/골든픽스처_자동전송_설치.md).
function menuPushGolden() { menuRun_(pushGoldenFixture_); }
// [v9.146] 대화 수집 점검 — 조기 반환 4개 중 무엇에 걸렸는지 지목한다(「안 생김」의 원인이 넷이라 눈으로는 구분 불가).
//   읽기 전용이 아니다: talk_log 헤더 치유를 겸한다(배치 안쪽 치유는 첫 대화 전까지 실행되지 않는다). 멱등.
function menuTalkLogCheck() { menuRun_(talkLogCheck); }
// [2026-08-03] 동의 문항 갱신 — 정의는 엔진_폼리포트.js. 멱등이라 문구를 고칠 때마다 다시 눌러도 안전하고,
//   몽골어 검수 후(CONSENT_MN_APPROVED=true) 한 번 더 눌러야 병기가 라이브 폼에 반영된다.
function menuMigrateConsent() { menuRun_(migrateConsentV186); }
/* [2026-08-07] 면접 기록 회수 폼 — **같은 사고의 2번째다.** 위 동의 갱신 주석이 이미
 *   "편집기 드롭다운에서만 돌 수 있어 유호님이 어디 있냐고 물으신 함수"라고 적어 뒀는데,
 *   이 함수는 그때 같이 안 올려서 08-07 유호님이 다시 "아무리 찾아도 없더라고" 하셨다.
 *   ▶1회짜리라도 **비개발자가 눌러야 하는 함수면 메뉴가 실행 경로다**(편집기는 경로가 아니다). */
function menuCreateInterviewLogForm() { menuRun_(createInterviewLogForm); }
/* 같은 자리 3번째라 개별로 안 고치고 회귀로 못박았다(`tests/수집.test.js` 「▶ 표기는 메뉴가 실행 경로다」):
 *   Code.js 가 `(▶…)` 로 적은 함수는 **정의가 살아 있는 한 전부** 여기 있어야 한다. */
function menuCreateTeacherMemoForm() { menuRun_(createTeacherMemoForm); }

/* [v9.131] 🗓 시즌 시작일 — **인자가 필요한 유일한 개원 준비 함수**라 ▶ 버튼으로 실행할 수 없었다.
 *   `setSeasonStart`는 인자 없이 부르면 「▶로는 설정되지 않습니다」라고 거부한다(오늘 날짜가 실수로 박히면
 *   차시 번호가 통째로 밀려 역할·짝·발표자가 전부 어긋나므로 옳은 설계다). 그런데 그 결과 **비개발자에게는
 *   실행 경로가 app_state 시트 직접 편집뿐**이었다 — 08-02 유호님이 드롭다운에서 못 찾아 막힌 지점.
 *   해법은 거부를 푸는 게 아니라 **날짜를 물어보는 입구를 만드는 것**(voiceWithdrawPrompt와 같은 계보).
 *   확인 단계에서 시즌 종료일과 「차시 1이 언제인지」를 함께 보여 준다 — 날짜가 맞는지는 그걸 봐야 안다. */
function seasonStartPrompt() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const cur = seasonLabelOf_(ss, tz);
  const a = ui.prompt('🗓 시즌 시작일 설정',
    (cur ? '현재: ' + cur + '\n\n' : '현재: 설정 안 됨\n\n') +
    '시즌 1주차 **1차시 날짜**를 yyyy-MM-dd로 입력하세요 (예: 2027-02-01).\n' +
    '⚠ 이 날짜부터 8주가 한 시즌이고, 차시 번호·역할·짝·발표자가 전부 여기서 계산됩니다.',
    ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK) return;
  const raw = String(a.getResponseText() || '').trim();
  const d = toDate_(raw);
  if (!d) { ui.alert('⚠ 날짜를 읽지 못했습니다 — 2027-02-01 형태로 입력하세요.'); return; }
  const s = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  const end = new Date(d.getTime() + (SEASON_WEEKS * 7 - 1) * 86400000);
  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  const b = ui.alert('확인',
    '시즌 시작일을 ' + s + '(' + dow + ')로 설정합니다.\n' +
    '  · 8주 시즌 종료 = ' + Utilities.formatDate(end, tz, 'yyyy-MM-dd') + '\n' +
    '  · 그날이 평일반 1차시가 됩니다(일요일이면 수업일이 아니라 차시가 밀립니다)\n' +
    (cur ? '  · 현재 값 ' + cur + '을(를) 덮어씁니다 — 기존 groups 편성은 옛 시즌 키로 남습니다\n' : '') +
    '\n진행할까요?', ui.ButtonSet.YES_NO);
  if (b !== ui.Button.YES) { ui.alert('취소했습니다 — 아무것도 바뀌지 않았습니다.'); return; }
  ui.alert(setSeasonStart(s) + '\n\n다음: 메뉴 「🧩 전 반 조 편성」');
}
function menuAssignGroups() { menuRun_(assignGroupsAll); } // [v9.131] 조 편성표의 나머지 절반 — 결과가 alert로 보인다

/* [v9.124] ▶ 읽기 전용 — 「이수율 조인이 실제로 붙는가」에 한 화면으로 답한다.
 *   이 질문이 따로 필요한 이유: 조인이 깨져도 **에러가 안 난다.** 그냥 rate=null(무데이터)로 조용히 떨어지고,
 *   주간 리포트에서는 섹션이 통째로 빠져 「원래 그런 주」와 구별되지 않는다. v9.118·v9.119가 같은 자리에서
 *   세 번 틀린 이유가 그것이다 — 틀렸다는 신호가 어디에도 없었다. 그래서 신호를 만든다. */
function lectureJoinDiag() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lec = ss.getSheetByName('lectures');
  const pf = ss.getSheetByName('profiles');
  if (!lec || lec.getLastRow() < 2) return '카탈로그(lectures)가 비어 있습니다 — 「📚 강의 자리 깔기」를 먼저 누르세요.';
  if (!pf || pf.getLastRow() < 2) return 'profiles가 비어 있습니다 — 동기화 먼저.';

  // [v9.125] 읽기 전용 계약을 지킨다 — ensureSheet는 없으면 만들므로(쓰기) getSheetByName으로만 읽는다
  const stR = ss.getSheetByName('app_state');
  const season = stR ? (Number((getState(stR, '현재시즌') || {}).val) || 0) : 0;
  const cat = {};
  lec.getRange(2, 1, lec.getLastRow() - 1, LECTURE_HEADERS.length).getValues().forEach(function (r) {
    if (!String(r[0] || '').trim()) return;
    const lv = String(r[1] || '').trim() || '*';
    cat[lv] = cat[lv] || { all: 0, req: 0 };
    cat[lv].all++;
    const isReq = /^(y|o|1|필수|true|예)$/i.test(String(r[6] == null ? '' : r[6]).trim()); // [v9.125] lectureRatesOf_와 동일 규약
    const inSeason = !(season && Number(r[2]) && Number(r[2]) !== season);
    if (isReq && inSeason) cat[lv].req++;
  });

  const lvCol = profileLevelCol_(pf);
  const smap = scheduleMap(ss);
  const dist = {};
  let weekend = 0;
  pf.getRange(2, 1, pf.getLastRow() - 1, pf.getLastColumn()).getValues().forEach(function (r) {
    if (!r[0] || r[3] !== 'student') return;
    const sch = schedOf(smap, String(r[4] || '').trim());
    if (!sch || String(sch.type).trim() !== '주말') return; // [v9.125] trim 통일
    weekend++;
    const k = lvCol < 0 ? '(레벨 열 없음)' : (String(r[lvCol] || '').trim() || '(공란)');
    dist[k] = (dist[k] || 0) + 1;
  });

  const m = lectureRatesOf_(ss);
  const ids = Object.keys(m);
  const scored = ids.filter(function (s) { return m[s].rate !== null; });

  // 붙지 않은 레벨 = 학생은 있는데 그 레벨의 필수 강의가 0개인 것. 이것이 조인 실패의 유일한 실제 모양이다.
  const orphan = Object.keys(dist).filter(function (k) {
    return !(cat[k] && cat[k].req) && !(cat['*'] && cat['*'].req);
  });
  // [v9.125] 원인 세분화 — 「강의는 있는데(all>0) 필수·시즌 필터로 req=0」이면 어휘 문제가 아니다.
  //   구 진단은 이 경우도 "어휘가 다릅니다"로 단정해 멀쩡한 어휘를 갈아엎게 유도했다.
  const filtered = orphan.filter(function (k) { return cat[k] && cat[k].all > 0; });
  const orphanCause = filtered.length
    ? '레벨 「' + filtered.join('·') + '」는 강의가 있는데 필수(G열 Y)·시즌(현재 ' + (season || '미설정') + ') 필터로 분모가 0개입니다 — 어휘가 아니라 **G열 또는 시즌 값**을 보세요'
    : '학생 레벨 「' + orphan.join('·') + '」에 배정된 필수 강의가 0개 — **카탈로그 레벨 어휘가 학생 레벨과 다릅니다**';

  const partial = scored.length && scored.length < ids.length;

  return '🎬 온라인 강의 이수율 — 조인 진단\n\n' +
    '① 레벨 열: ' + (lvCol < 0 ? '❌ profiles에 「' + PROFILE_LEVEL_HEADER + '」 헤더가 없습니다(레벨 매칭 불가)' : '✅ ' + (lvCol + 1) + '번째 열') + '\n' +
    '② 현재 시즌: ' + (season || '(미설정 — 모든 시즌을 분모에 넣습니다. app_state에 「현재시즌」 키를 넣으면 시즌별로 갈립니다 — 이 키는 시즌마다 손으로 올려야 합니다)') + '\n' +
    '③ 카탈로그 레벨별 (전체/필수):\n   ' +
      (Object.keys(cat).length ? Object.keys(cat).map(function (k) { return k + ' ' + cat[k].all + '/' + cat[k].req; }).join(' · ') : '(없음)') + '\n' +
    '④ 주말반 학생 ' + weekend + '명 레벨 분포:\n   ' +
      (weekend ? Object.keys(dist).map(function (k) { return k + ' ' + dist[k] + '명'; }).join(' · ') : '(주말반 학생 없음 — 시간표 반유형이 「주말」인 반에 학생이 있어야 합니다)') + '\n' +
    '⑤ 이수율 산출: ' + scored.length + '명 / 대상 ' + ids.length + '명' +
      (scored.length ? '\n   ' + scored.slice(0, 8).map(function (s) { return m[s].name + ' ' + m[s].done + '/' + m[s].total; }).join(' · ') : '') + '\n\n' +
    (scored.length === ids.length && scored.length
      ? '판정: ✅ 조인 성립 — 이수율이 실제로 계산됩니다.'
      : partial
      ? '판정: ⚠ **부분 성립** — ' + scored.length + '명만 산출, 미산출 ' + (ids.length - scored.length) + '명.\n   원인 = ' + (orphan.length ? orphanCause : '해당 학생들의 레벨에 필수 강의가 없습니다(④ 분포와 ③을 대조)') +
        '\n   ✅로 읽으면 안 됩니다 — 승급 배점이 걸린 지표라 미산출 학생은 미측정으로 남습니다.'
      : '판정: ⚠ 아직 아무도 산출되지 않습니다.\n   원인 = ' +
        (lvCol < 0 ? '레벨 열 없음'
          : !weekend ? '주말반 학생 0명'
          : orphan.length ? orphanCause
          : '알 수 없음(위 ①~④를 그대로 알려 주세요)'));
}

/* [v9.123] 지금 실제로 쓰이는 레벨 어휘 = 상수 ∪ profiles 「한국어수준」에 실재하는 값.
 *   상수만 믿으면 유호님이 profiles에 새 레벨을 추가한 순간 그 레벨의 강의 자리가 '낡은 것'으로 오판된다.
 *   그래서 **살아 있는 쪽을 시트에서 읽어 합집합**을 만든다 — 판단이 틀리는 방향을 항상 '안 지우는' 쪽으로 기울인다. */
function liveLectureLevels_(ss) {
  const set = {};
  set[''] = 1; set['*'] = 1; // [v9.125] 레벨 공란·'*'는 「전 레벨 공통」 승격 대상(lectureRatesOf_) — 낡은 게 아니라 규칙으로 보호
  PROFILE_LEVELS.forEach(function (v) { set[v] = 1; });
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) {
    const c = profileLevelCol_(pf);
    if (c >= 0) pf.getRange(2, c + 1, pf.getLastRow() - 1, 1).getValues()
      .forEach(function (r) { const v = String(r[0] || '').trim(); if (v) set[v] = 1; });
  }
  return set;
}

/* [v9.123] ▶ 낡은 어휘로 깔린 강의 자리만 걷어낸다.
 * 왜 필요한가: 레벨 어휘가 바뀌면(Lv1/Lv2 → 완전초보/기초, 08-01) 구 자리는 **어느 학생과도 조인되지 않는
 *   유령 행**으로 남는다. 이수율 수치를 오염시키진 않지만 폼 선택지를 두 배로 부풀리고, 학생이 유령을
 *   고르면 존재하지 않는 강의ID가 lecture_views에 쌓인다. setupLectures는 강의ID로 멱등이라 못 지운다.
 *
 * 왜 손으로 지우지 않는가: 시트에서 행을 직접 지우는 건 **행 번호로 조준하는 일**이고, 옆 세션·다른 창이
 *   같은 시트를 만지면 목록이 밀려 멀쩡한 행에 삭제가 걸린다(08-01 실사고 계열). 조준은 내용으로 해야 한다.
 *
 * 4중 잠금 — 아래를 **전부** 만족하는 행만 지운다. 하나라도 어긋나면 남기고 이유를 보고한다.
 *   ① 레벨이 지금 쓰이는 어휘가 아니다(상수 ∪ profiles 실재값)
 *   ② URL(F열)이 비어 있다        — 유호님이 녹화 링크를 붙였으면 그건 사람의 작업물이다
 *   ③ 제목(E열)이 자동 생성값 그대로다 — 손으로 고쳤으면 사람의 작업물이다
 *   ④ 그 강의ID로 제출된 수강 기록이 없다 — 있으면 학생의 이력이다
 * 그래서 **잘못 눌러도 손실이 0**이다(메뉴에 올린 근거 — 「한 번 잘못 누름이 라이브 사고」에 해당하지 않는다). */
function pruneStaleLectures() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('lectures');
  if (!sh || sh.getLastRow() < 2) return 'lectures가 비어 있습니다 — 지울 것이 없습니다.';

  const live = liveLectureLevels_(ss);
  const viewed = {};
  const vw = ss.getSheetByName('lecture_views');
  if (vw && vw.getLastRow() >= 2) vw.getRange(2, 1, vw.getLastRow() - 1, LECTURE_VIEW_HEADERS.length).getValues()
    .forEach(function (r) { const id = String(r[4] || '').trim(); if (id) viewed[id] = (viewed[id] || 0) + 1; });

  // [v9.125] 전 열을 읽는다 — 구 코드는 A~G(7열)만 보고 "사람이 넣은 값은 하나도 없었습니다"라고 단언했지만,
  //   deleteRows는 행 전체를 지우므로 H열 이후의 수기 메모가 시야 밖에서 함께 사라졌다. ⑤번째 잠금.
  const fullW = sh.getLastColumn();
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, fullW).getValues();
  const kill = [], keep = [];
  rows.forEach(function (r, i) {
    const id = String(r[0] || '').trim();
    if (!id) return;
    const lv = String(r[1] || '').trim();
    if (live[lv]) return;                                     // ① 살아 있는 레벨 — 대상 아님(조용히 통과)
    // 자동 생성 제목의 차시 번호는 강의ID 끝자리에서 온다(setupLectures와 같은 조립식) — 제목에서 되짚으면 순환이 된다
    const auto = lv + ' 시즌' + r[2] + ' ' + r[3] + '주차 ' + id.split('-').pop() + '차시';
    const why = [];
    if (String(r[5] || '').trim()) why.push('URL 있음');       // ②
    if (String(r[4] || '').trim() !== auto) why.push('제목 수정됨'); // ③
    if (viewed[id]) why.push('수강 기록 ' + viewed[id] + '건');   // ④
    for (let x = LECTURE_HEADERS.length; x < fullW; x++) {      // ⑤ 감시 밖 열의 수기 값
      if (String(r[x] == null ? '' : r[x]).trim()) { why.push((x + 1) + '열에 값 있음'); break; }
    }
    if (why.length) keep.push(id + '(' + lv + ') — ' + why.join('·'));
    else kill.push({ row: i + 2, id: id, lv: lv });
  });

  if (!kill.length) {
    const none = '지울 낡은 자리가 없습니다 (총 ' + rows.length + '행)' +
      (keep.length ? '\n   ⚠ 낡은 어휘지만 사람·학생의 작업물이라 남긴 행 ' + keep.length + '개:\n   - ' + keep.join('\n   - ') : '');
    Logger.log(none);
    return none;
  }
  // 아래에서 위로 지운다 — 위에서 지우면 남은 행 번호가 밀려 다음 삭제가 엉뚱한 행을 문다.
  // [v9.125] 삭제 직전 내용 재확인 — 읽기와 삭제 사이에 다른 창·세션이 행을 넣거나 빼면 행 번호가 밀려
  //   멀쩡한 행이 지워진다(08-01 실사고 계열: 행 번호는 근거가 아니다). A열이 조준한 ID와 다르면 건너뛴다.
  let shifted = 0, deleted = 0;
  kill.slice().sort(function (a, b) { return b.row - a.row; }).forEach(function (k) {
    if (String(sh.getRange(k.row, 1).getValue() || '').trim() !== k.id) { shifted++; return; }
    sh.deleteRows(k.row, 1); deleted++;
  });
  if (shifted) {
    const warnMsg = '⚠ 목록이 밀려 ' + shifted + '개를 건너뛰었습니다(다른 창·세션이 동시 편집 중) — 삭제 ' + deleted + '개만 완료. 시트를 닫고 다시 실행하세요.';
    Logger.log(warnMsg);
    return warnMsg;
  }

  const byLv = {};
  kill.forEach(function (k) { byLv[k.lv] = (byLv[k.lv] || 0) + 1; });
  const msg = '낡은 강의 자리 ' + kill.length + '개 삭제 (남은 ' + (rows.length - kill.length) + '행)' +
    '\n   레벨별: ' + Object.keys(byLv).map(function (k) { return k + ' ' + byLv[k] + '개'; }).join(' · ') +
    '\n   첫 삭제: ' + kill[0].id + ' · 끝 삭제: ' + kill[kill.length - 1].id +
    '\n   지운 것은 전부 URL 공란·제목 자동값·수강기록 0 — 사람이 넣은 값은 하나도 없었습니다.' +
    (keep.length ? '\n   ⚠ 낡은 어휘지만 남긴 행 ' + keep.length + '개(사람·학생 작업물):\n   - ' + keep.join('\n   - ') : '') +
    '\n   다음: 「🔄 폼 선택지 카탈로그와 맞추기」를 눌러 폼에서도 유령 선택지를 걷어내세요.';
  Logger.log(msg);
  return msg;
}

/* [v9.121] 카탈로그 → 폼 선택지 문자열. 최초 생성과 이후 동기화가 **같은 모양**을 쓰도록 한 곳에서 만든다.
 *   " - " 구분자는 계약이다 — sweepLectureForm_이 앞부분을 강의ID로 잘라 읽는다(모양이 갈리면 적재가 조용히 어긋난다).
 *   200개 상한은 구글 폼 목록 문항의 현실적 한계 — 넘치면 뒤가 잘리므로 호출부가 개수를 보고한다. */
function lectureChoices_(ss) {
  const out = [];
  const lc = ss.getSheetByName('lectures');
  // [v9.125] trim 후 공백 제외 — 구 코드는 trim 전 값(스페이스 한 칸)을 통과시켜 빈 선택지('')를 만들었고,
  //   setChoiceValues가 이를 거부하면 v9.121 경로에서 4단계(응답 시트 연결)까지 막혔다. 다른 소비처와 동일 규약.
  if (lc && lc.getLastRow() >= 2) lc.getRange(2, 1, lc.getLastRow() - 1, 5).getValues()
    .forEach(function (r) { const id = String(r[0] == null ? '' : r[0]).trim(); if (!id) return; out.push(id + (r[4] ? ' - ' + r[4] : '')); });
  // [v9.125] 상한 초과 시 **뒤에서** 200개 — 새 시즌 자리는 setupLectures가 맨 뒤에 append하므로,
  //   앞에서 자르면 잘리는 쪽이 정확히 「현재 시즌」이 된다(구 slice(0,200)의 함정).
  return out.length > 200 ? out.slice(-200) : out;
}

/* [v9.121] ▶ 카탈로그가 바뀌면 폼 선택지도 따라가야 한다 — 그런데 아무도 따라가게 하지 않고 있었다.
 *   createLectureForm은 「문항이 이미 있으면 손대지 않는다」. 응답 4열 계약을 지키려는 것이라 그 판단은 옳다.
 *   대가는 **카탈로그와 폼의 영구 불일치**다: 08-01 실측에서 폐기된 Lv1/Lv2 64개가 폼에 그대로 남아 있었고,
 *   학생이 그걸 고르면 lecture_views에 존재하지 않는 강의ID가 쌓여 이수율 분자가 영영 0이 된다.
 *   해법은 재생성이 아니다(지웠다 만들면 응답 시트 열이 갈린다) — **같은 ListItem의 선택지만 교체**한다.
 *   멱등: 같으면 안 건드리고 '변경 없음'을 돌려준다. */
function syncLectureFormChoices() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const id = String((getState(st, '강의폼ID') || {}).val || '').trim();
  if (!id) return '강의폼ID가 없습니다 — createLectureForm ▶ 을 먼저 실행하세요.';
  const want = lectureChoices_(ss);
  if (!want.length) return '카탈로그(lectures)가 비어 있어 선택지를 바꾸지 않았습니다 — setupLectures ▶ 를 먼저 실행하세요.';

  const form = FormApp.openById(id);
  const li = form.getItems(FormApp.ItemType.LIST)
    .filter(function (it) { return String(it.getTitle()).trim() === '강의'; })[0];
  if (!li) {
    // 카탈로그가 비었던 시절에 만들어진 폼은 「강의」가 자유 입력(TEXT)이다. 유형을 갈아끼우면 응답 열이 갈리므로
    //   조용히 고치지 않고 사실만 알린다 — 폼을 새로 만들지 말지는 사람이 정할 문제다.
    return '폼에 목록형 「강의」 문항이 없습니다(자유 입력으로 만들어진 폼) — 선택지를 바꾸지 않았습니다.';
  }
  const item = li.asListItem();
  const before = item.getChoices().map(function (c) { return c.getValue(); });
  const same = before.length === want.length && before.every(function (v, i) { return v === want[i]; });
  if (same) {
    const msgS = '강의 선택지 ' + want.length + '개 — 카탈로그와 이미 같습니다(변경 없음).';
    Logger.log(msgS);
    return msgS;
  }
  item.setChoiceValues(want);
  const gone = before.filter(function (v) { return want.indexOf(v) < 0; });
  const add = want.filter(function (v) { return before.indexOf(v) < 0; });
  const msg = '강의 선택지 교체: ' + before.length + '개 → ' + want.length + '개 (삭제 ' + gone.length + ' · 추가 ' + add.length + ')' +
    '\n   첫 선택지: ' + want[0] +
    '\n   끝 선택지: ' + want[want.length - 1] +
    (want.length >= 200 ? '\n   ⚠ 200개 상한에 닿았습니다 — 카탈로그 **앞부분(오래된 시즌)**이 폼에서 잘렸습니다(최신이 남습니다). 낡은 자리 걷어내기를 권합니다.' : '') +
    '\n   ⚠ 이미 제출된 응답과 lecture_views는 손대지 않았습니다(구 강의ID로 적재된 행이 있으면 수동 정리).';
  Logger.log(msg);
  return msg;
}

/* [v9.106] 1회 실행 — 학생이 강의를 본 뒤 제출하는 확인 폼. 구글 폼 경로라 Glide update 소비 0.
 *   문항 3개 고정(응답 4열 계약 — sweep이 열 위치로 읽으므로 순서를 바꾸면 적재가 어긋난다).
 *   4단계 멱등은 v9.93 실사고 대응 패턴을 그대로 따른다(죽어도 재실행이 남은 단계만 이어서 한다). */
function createLectureForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  ensureSheet(ss, 'lectures', LECTURE_HEADERS);
  ensureSheet(ss, 'lecture_views', LECTURE_VIEW_HEADERS);
  const title = 'SYNK 온라인 강의 수강 확인';
  const t0 = Date.now();
  const steps = []; // [v9.125] 단계 기록을 반환 문구에 싣는다 — Logger만 남기면 alert가 「저하된 성공」을 온전한 성공으로 보인다
  const step = function (m) { steps.push(m); Logger.log('[' + Math.round((Date.now() - t0) / 1000) + 's] ' + m); };

  // 1) 재실행 조준은 app_state 강의폼ID **먼저** — 이름 검색이 먼저면 Drive 일시 오류 한 번에 폼이 하나 더 생기고,
  //    새 폼이 ID를 덮어 구 폼으로 들어온 제출이 영영 적재되지 않는다(응답 탭 분열). [v9.125]
  let form = null;
  const savedId = String((getState(st, '강의폼ID') || {}).val || '').trim();
  if (savedId) {
    try { form = FormApp.openById(savedId); step('기존 폼 재사용(app_state 강의폼ID)'); }
    catch (eS) { step('⚠ 저장된 강의폼ID를 열지 못함(' + eS.message + ') — 이름 검색으로 폴백'); }
  }
  if (!form) {
    try {
      const it = DriveApp.getFilesByName(title), found = [];
      while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) found.push(f.getId()); } // [v9.125] 휴지통 폼 회수 금지 — 죽은 폼 URL이 배포되던 구멍
      if (found.length) {
        form = FormApp.openById(found[0]);
        step((found.length > 1 ? '⚠ 같은 이름 폼 ' + found.length + '개 — 첫 번째를 회수, 나머지는 드라이브에서 수동 삭제 필요' : '고아 폼 회수'));
      }
    } catch (eD) { step('⚠ 드라이브 조회 건너뜀: ' + eD.message); }
  }

  // 2) 생성 즉시 ID·URL 기록 — 여기서 죽어도 다음 실행이 1)에서 찾는다
  if (!form) {
    form = FormApp.create(title)
      .setDescription('강의를 다 본 뒤에 제출하세요. 배운 것을 한국어로 한 문장 쓰면 끝입니다.')
      .setCollectEmail(false);
    step('폼 생성');
  }
  setState(st, '강의폼ID', form.getId());
  setState(st, '강의폼URL', form.getPublishedUrl());

  // 3) 문항 3개 — 이미 있으면 손대지 않는다(지웠다 만들면 응답 열 계약이 깨진다)
  if (!form.getItems().length) {
    const choices = lectureChoices_(ss);
    form.addTextItem().setTitle('이름').setRequired(true).setHelpText('앱에 등록된 이름 그대로 써 주세요');
    if (choices.length) form.addListItem().setTitle('강의').setRequired(true).setChoiceValues(choices);
    else form.addTextItem().setTitle('강의').setRequired(true).setHelpText('강의 번호를 그대로 적어 주세요');
    form.addParagraphTextItem().setTitle('오늘 배운 것을 한국어로 한 문장 쓰세요').setRequired(true)
      .setHelpText('짧아도 됩니다. 틀려도 됩니다 - 선생님이 봅니다.');
    step('문항 3개 추가' + (choices.length ? ' (강의 ' + choices.length + '개 선택지)' : ' (카탈로그가 비어 자유 입력)'));
  } else {
    // [v9.121] 구 동작은 여기서 그냥 '건너뜀'이었다. 문항은 그대로 두고 선택지만 맞춘다.
    // [v9.125] try/catch — 동기화 실패(빈 선택지·폼 유형 상이)가 4단계(응답 시트 연결)를 막으면
    //   폼이 영원히 시트에 안 붙는다(v9.93 「죽어도 남은 단계를 이어서」 원칙이 v9.121에서 깨졌던 자리).
    step('문항 이미 있음 — 선택지만 카탈로그와 동기화');
    try {
      const syncMsg = syncLectureFormChoices();
      step(syncMsg.split('\n')[0] + (syncMsg.indexOf('문항이 없습니다') > -1 ? ' ⚠' : ''));
    } catch (eSy) { step('⚠ 선택지 동기화 실패(4단계는 계속): ' + String(eSy.message || eSy).slice(0, 120)); }
  }

  // 4) 응답 시트 연결 — 가장 무거운 단계라 맨 뒤
  let linked = false;
  try { linked = !!form.getDestinationId(); } catch (eL) { linked = false; }
  if (!linked) {
    const before = ss.getSheets().map(function (s) { return s.getName(); });
    form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
    linkFormTab_(ss, before, '강의폼_응답');
    step('응답 시트 연결');
  } else step('응답 시트 이미 연결됨');

  const warn = steps.filter(function (s) { return s.indexOf('⚠') > -1; });
  const msg = '온라인 강의 수강 확인 폼: ' + form.getPublishedUrl() +
    (warn.length ? '\n\n⚠ 주의 ' + warn.length + '건:\n   ' + warn.join('\n   ') : '') +
    '\n\n실행 단계:\n   ' + steps.join('\n   ') +
    '\n\n먼저 lectures 시트에 강의를 채우세요(강의ID·레벨·시즌·주차·제목·URL·필수).' +
    '\n비어 있으면 이수율이 0%가 아니라 무데이터로 남습니다.';
  Logger.log(msg);
  return msg;
}

// 10분 스위프 편승 — 강의폼_응답 → lecture_views. 포인터 방식이라 같은 응답을 두 번 적재하지 않는다.
function sweepLectureForm_(ss) {
  const src = ss.getSheetByName('강의폼_응답');
  if (!src || src.getLastRow() < 2) return;
  const props = PropertiesService.getScriptProperties();
  const last = src.getLastRow();
  const from = Number(props.getProperty('강의폼_포인터')) || 1;
  if (from >= last) { if (from > last) props.setProperty('강의폼_포인터', String(last)); return; }
  const tz = ss.getSpreadsheetTimeZone();
  const rows = src.getRange(from + 1, 1, last - from, 4).getValues(); // 타임스탬프·이름·강의·한줄요약
  const pf = ss.getSheetByName('profiles');
  const students = [];
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(function (r) {
    if (r[0] && r[3] === 'student') students.push({ sid: String(r[0]).trim(), n: String(r[1] || ''), c: String(r[4] || '') });
  });
  const vw = ensureSheet(ss, 'lecture_views', LECTURE_VIEW_HEADERS);
  const out = [], miss = [];
  rows.forEach(function (r) {
    const ts = r[0] instanceof Date ? r[0] : new Date();
    const nm = String(r[1] || '').trim();
    const lid = String(r[2] || '').split(' - ')[0].trim(); // 선택지가 "ID - 제목" 형태라 앞부분만 취한다
    if (!nm || !lid) return;
    // [v9.125] 이름 매칭 정본(matchStudentsByNameClass_) 사용 — 구 원시 === 비교는 앞뒤·이중 공백에 깨져
    //   그 학생의 제출이 매일 '미매칭'으로 쌓였다(다른 폼 스위프 전부가 쓰는 헬퍼를 이 폼만 안 썼다).
    const cands = matchStudentsByNameClass_(students, nm, '');
    const sid = cands.length === 1 ? cands[0] : '';
    const hit = sid ? students.filter(function (s) { return s.sid === sid; })[0] : null;
    const cls = hit ? hit.c : '';
    if (!sid) miss.push('- ' + nm + ' (강의 ' + lid + ') — 로스터 후보 ' + cands.length + '명');
    out.push([dstr(ts, tz), sid, nm, cls, lid, String(r[3] || ''), dstr(ts, tz, 'yyyy-MM-dd'), sid ? '' : '미매칭']);
  });
  if (out.length) vw.getRange(vw.getLastRow() + 1, 1, out.length, LECTURE_VIEW_HEADERS.length).setValues(행소독_(out)); // [v9.157] 이름·한줄요약은 학생 손입력(강의폼은 학생에게 배포된다)
  props.setProperty('강의폼_포인터', String(last)); // 적재 직후 마감 — 메일 실패가 같은 응답을 재적재하지 않게
  if (miss.length && quotaOk(1)) {
    adminMail('[SYNK] 온라인 강의 — 이름 매칭 실패 ' + miss.length + '건',
      '아래 제출은 학생을 특정하지 못해 이수율에 반영되지 않았습니다.\n' +
      'lecture_views 시트에서 student_id를 채우면 그대로 살아납니다.\n\n' + miss.join('\n'));
  }
}

// 주간 리포트 섹션 — 주말반 학생 이수율. 값이 없으면 빈 문자열이라 섹션이 조용히 빠진다(v9.91 관행).
function lectureWeeklyText_(ss) {
  const m = lectureRatesOf_(ss);
  const sids = Object.keys(m);
  if (!sids.length) return '';
  const scored = sids.filter(function (s) { return m[s].rate !== null; });
  if (!scored.length) {
    return '  - 주말반 ' + sids.length + '명 — 배정된 필수 강의가 없어 이수율을 내지 않았습니다(lectures 시트를 채우세요)';
  }
  const avg = Math.round(scored.reduce(function (a, s) { return a + m[s].rate; }, 0) / scored.length);
  const low = scored.filter(function (s) { return m[s].rate < 60; })
    .sort(function (a, b) { return m[a].rate - m[b].rate; }).slice(0, 8)
    .map(function (s) { return m[s].name + '(' + m[s].cls + ' ' + m[s].done + '/' + m[s].total + ')'; });
  return '  - 주말반 ' + scored.length + '명 평균 이수율 ' + avg + '%' +
    (low.length
      ? '\n  주의 60% 미만: ' + low.join(' · ') +
        '\n     대면이 주 1회뿐이라 이 학생들은 진도의 상당 부분을 안 들은 상태입니다. 승급 판정 전에 확인하세요.'
      : '\n  - 60% 미만 없음');
}

/* ===================== [v9.110] 시트 메뉴 — 수동 실행 진입점 =====================
 * 이 저장소엔 onOpen이 없어 「SYNK 메뉴」가 존재한 적이 없다. 수동 실행은 Apps Script 편집기에서
 * 함수 138개 중 하나를 드롭다운으로 골라 ▶를 눌러야만 가능했다 — 오선택 위험이 크고(setupSchedule은
 * 라이브 반 편성을 리셋한다), 비개발자에게는 사실상 닫힌 경로였다.
 * → 자주 쓰는 **안전한** 항목만 시트 메뉴로 올린다. 파괴적·일회성 함수(setupSchedule·seedDemoData·
 *   clearDemoData·각종 create*Form)는 의도적으로 넣지 않는다. 메뉴에 올리는 순간 "한 번 잘못 누름"이
 *   그대로 라이브 사고가 되므로, 그런 것들은 편집기에서 의식적으로 고르게 둔다.
 * onOpen은 단순 트리거라 별도 권한 승인이 필요 없다(시트를 열면 자동 설치). */
function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('SYNK')
      .addItem('📊 강사 지표 갱신', 'calcTeacherStats')
      .addItem('🔄 전체 재계산', 'calcAll')
      .addSeparator()
      .addItem('🩺 조립 점검·자동 복구(preflight)', 'preflightGlide')
      // [v9.117] 언더바 함수 — **편집기 드롭다운에는 안 뜨지만 메뉴에서는 도는가**를 확인하는 첫 사례.
      //   GAS의 `_` 접미 규약은 "라이브러리로 export하지 않는다 · Run 드롭다운·트리거 UI에 안 보인다"이고,
      //   addItem의 2번째 인자는 같은 스크립트 안의 전역을 이름으로 부르는 것이라 무관할 것으로 본다(미검증).
      //   맞다면 배치·스위프(absenceFollowupNightly_·sweepAbsenceForm_·aiFeedbackBatch_ …)를 밤을 기다리지 않고
      //   수동으로 한 번 돌려볼 수 있게 된다 — 지금은 그게 불가능해 스모크 테스트를 정적 검증으로 때우고 있다.
      //   검증체로 sheetSelfHeal_을 고른 이유: 인자 없음 · 멱등 · 야간에 이미 도는 자기치유라 눌러도 무해.
      // [v9.127] 공개 래퍼로 교체 — 결과가 alert로 보이고, 편집기 드롭다운에서도 실행 가능해진다(구 private은 목록에 안 뜸)
      .addItem('🩹 시트 자기치유', 'menuSelfHeal')
      .addSeparator()
      // [v9.120] 🧪 배치 리허설 — 개원 전에 배치를 "돌려보고" 검증하기 위한 것.
      //   리허설을 켜면 메일·AI·메신저·STT 호출이 전부 막히고(quotaOk·aiCall_·aiText_·adminMail·MJ_send_·voiceTranscribe_ 게이트 — v9.125 전면 확장),
      //   무엇이 나갈 뻔했는지만 기록된다. 배치 실행 항목은 리허설 밖에서 누르면 스스로 거부한다.
      .addItem('🧪 리허설 시작(' + REHEARSAL_TTL_MIN + '분)', 'rehearsalStart')
      .addItem('　└ 결석 복귀 판정 실행', 'rehearseAbsenceFollowup')
      .addItem('　└ AI 첨삭 배치 실행', 'rehearseAiFeedback')
      .addItem('🧪 리허설 결과·종료', 'rehearsalReport')
      .addSeparator()
      // [v9.111] 온라인 강의 2종 — 순서대로 누르면 된다(자리 깔기 → URL 채우기 → 폼 만들기).
      //   편집기 드롭다운은 배포 직후 새로고침 전까지 새 함수를 안 보여줘서 "함수가 없다"로 읽힌다.
      .addItem('📚 강의 자리 깔기(1단계)', 'menuSetupLectures')
      .addItem('🎬 강의 수강 확인 폼(2단계)', 'menuCreateLectureForm')
      .addSeparator()
      // [2026-08-03] 🧠 회사 두뇌 — 확정된 것만 답하고 모르면 원장님께 넘긴다. '모르는 질문'이 곧 채울 목록이다.
      //   강사용 웹 화면은 배포 직전 보안 검토에서 철회됐다(익명 google.script.run 브릿지 — `_보류_두뇌_웹화면.js` 머리말).
      //   지금 단계에서 답변 품질은 아래 '시험 삼아 물어보기'로 확인한다.
      .addItem('🧠 두뇌 지식 만들기(1단계)', 'menuBrainSetup')
      .addItem('💬 시험 삼아 물어보기', 'menuBrainTry')
      .addItem('　└ 두뇌 점검', 'menuBrainCheck')
      .addItem('　└ 아직 모르는 질문 보기', 'menuBrainGaps')
      // [v9.123] 레벨 어휘가 바뀌면 구 자리가 유령으로 남는다 — 4중 잠금이라 잘못 눌러도 손실 0(함수 주석 참조).
      .addItem('🧹 낡은 강의 자리 걷어내기', 'menuPruneStaleLectures')
      // [v9.121] 시즌이 바뀌어 1단계를 다시 깔면 폼 선택지가 낡는다 — 2단계는 문항이 있으면 건너뛰므로 따라가지 않는다.
      .addItem('🔄 폼 선택지 카탈로그와 맞추기(시즌 갱신)', 'menuSyncLectureForm')
      // [v9.124] 읽기 전용 — 조인이 깨져도 에러가 안 나므로 물어볼 곳이 필요하다.
      .addItem('🔎 이수율 조인 진단(읽기 전용)', 'menuLectureJoinDiag')
      .addSeparator()
      // [v9.125] 철회 진입점 — voiceWithdraw는 인자 필수라 편집기 ▶·메뉴 직접 등재가 불가능했다(약속만 있고 실행 수단 없음).
      //   프롬프트 2단계(ID 입력 → 미리보기 → 「삭제」 타이핑)라 잘못 눌러도 손실 0 — 메뉴 등재 기준을 충족한다.
      .addItem('🗑 음성 동의 철회(2단계 확인)', 'voiceWithdrawPrompt')
      // [v9.138] 과거 프리뷰가 열어둔 공개 링크를 닫는다 — 공유 설정은 파일에 붙어 있어 코드 수정만으론 안 닫힌다.
      //   PREVIEW_ 접두어만 건드리므로 학부모 성장 리포트 카드는 그대로다. 여러 번 눌러도 결과가 같다(멱등).
      .addItem('🔒 리포트카드 프리뷰 공개 링크 닫기', 'menuClosePreviewCardLinks')
      // [v9.142] 폴더를 잠그면 학부모 카드도 함께 죽는다(공개가 전부 폴더 상속이었다) — 카드마다 자기 링크를 붙여 되살린다.
      .addItem('🔒 학생 파일 공개 링크 닫기', 'menuCloseStudentFileLinks') // [v9.155] 구 「🩹 복구」(=여는 함수)를 방향 반대로 교체
      .addSeparator()
      // [v9.131] 개원 준비 2종 — 이 둘을 안 하면 강사 브리핑의 조 편성표가 영구 공백이다(v9.130에서 화면이 이유를 말하게 했지만, 실행 경로가 없으면 소용없다).
      //   setSeasonStart는 인자가 필요해 ▶ 버튼으로 실행할 수 없다 → 날짜를 물어보는 프롬프트로 감싼다.
      .addItem('🗓 시즌 시작일 설정(개원 준비 1)', 'seasonStartPrompt')
      .addItem('🧩 전 반 조 편성(개원 준비 2)', 'menuAssignGroups')
      /* 평소엔 누를 일이 없다 — 출석이 확정되면 parentSweep 이 자동으로 굽고 링크를 메일로 보낸다.
       *   이 항목은 지각·정정으로 «다시» 뽑아야 하는 날의 손잡이다(자동은 반·날짜당 1회). */
      .addItem('🖨 숙제 서클 종이 다시 인쇄(오늘 수업 반)', 'menuPrintCircleSheets')
      .addSeparator()
      /* [v9.138] 📊 학습 데이터 수집 — 「2년 축적 → AI 회화 앱」의 입구.
       *   개원 전에 눌러야 하는 이유: 학생이 그날 무엇을 골랐는지는 **소급이 안 된다.**
       *   폼이 없으면 매일 퀴즈를 던지면서 답은 한 건도 안 받는 지금 상태가 그대로 이어진다. */
      /* [2026-08-03] 동의 갱신을 맨 앞에 둔 이유 — 수집의 **법적 전제**이고, 문구를 개정할 때마다
       *   다시 눌러야 한다(몽골어 검수 후 1회 더). 편집기 드롭다운에서만 돌 수 있어 유호님이
       *   "어디 있냐"고 물으신 함수다 — 두 번 쓸 것을 메뉴에 올린다. */
      .addItem('🔏 동의 문항 갱신(수집 0단계·문구 바뀔 때마다)', 'menuMigrateConsent')
      .addItem('🎤 면접 기록 회수 폼 만들기(VR 0단계·1회)', 'menuCreateInterviewLogForm')
      .addItem('🗒 강사 메모 폼 만들기(1회)', 'menuCreateTeacherMemoForm')
      .addItem('🧠 퀴즈 응답 폼 만들기(수집 1단계)', 'menuCreateQuizForm')
      .addItem('📝 숙제 폼에 수집 문항 넣기(수집 2단계)', 'menuMigrateHwForm')
      .addItem('🗣 한국어 대화 폼 만들기(수집 3단계)', 'menuCreateTalkForm')
      /* [v9.190] 야간 배치가 매일 자기적용하므로 평소엔 누를 일이 없다 — 밤을 기다리지 않고
       *   지금 적용하고 싶을 때의 손잡이다(자동만 있고 수동이 없으면 재시도 경로가 하루 단위가 된다). */
      .addItem('🎙 목소리 폼에 미션ID 넣기(자동 적용됨·수동 재시도용)', 'menuMigrateVoiceForm')
      /* 궤적 연결 고리 — 의도(크루카드 100+문항)와 결과(면접 합·불)가 둘 다 쌓이는데 안 이어져 있었다.
       *   문항이 아니라 **연결**이 소급 불가다: 지금 키를 안 심으면 이미 들어온 기록은 영원히 못 잇는다. */
      .addItem('🔗 면접폼에 학생ID 칸 넣기(궤적 연결·선택 문항)', 'menuMigrateInterviewSid')
      /* 위 항목이 칸을 심고, 이 항목이 그 칸을 **실제로 채우는 유일한 경로**다 —
       *   앱은 학생에게 자기 학생ID를 어디서도 보여주지 않으므로, 개인 링크가 없으면 궤적은 0에 가깝다. */
      .addItem('🔗 면접폼 개인 링크 만들기(학생ID 미리채움)', 'menuInterviewPersonalLink')
      .addItem('📊 수집 커버리지 보기(읽기 전용)', 'menuDataCoverage')
      .addItem('📤 강사 정답 모음 → 회화 앱 픽스처 내보내기', 'menuExportGolden')
      .addItem('🚀 강사 정답 모음 → SYNK-talk 저장소로 바로 보내기', 'menuPushGolden')
      .addItem('🔎 대화 수집 점검(밤 배치 확인·머리글 치유)', 'menuTalkLogCheck')
      .addToUi();
  } catch (eMenu) { Logger.log('시트 메뉴 생성 스킵: ' + eMenu); } // UI 없는 컨텍스트(트리거 실행)에서는 조용히 통과
}

/* ===================== [v9.111] 📚 강의 카탈로그 시딩 =====================
 * 유호님 08-01 확정: 녹화 강의를 따로 제작하지 않는다. **평일 수업을 녹화해 잘 된 것만 골라 올린다.**
 *   그래서 카탈로그는 "만들어 둔 강의 목록"이 아니라 **채워질 자리의 목록**이다 —
 *   시즌 시작 시점에 빈 칸(URL 없음)으로 32개를 깔아 두고, 녹화가 나오는 대로 URL만 채운다.
 *
 * 왜 미리 까는가: 이수율의 분모가 시즌 첫날부터 확정돼야 한다. 강의를 올릴 때마다 분모가 늘면
 *   먼저 들은 학생이 계속 손해를 본다(3주차에 8/8이던 학생이 4주차에 8/12가 된다).
 *   자리를 먼저 깔면 "아직 안 올라온 강의"와 "안 본 강의"가 구분되고, 학생은 자기 진도를 예측할 수 있다.
 *
 * 분량 = 주말반이 대면으로 못 채우는 몫. 평일 주 5차시 − 주말 대면 1차시 = **주 4차시** × 8주 = 32개/레벨·시즌.
 *
 * 멱등: 같은 강의ID가 이미 있으면 건드리지 않는다(URL·제목을 손으로 채워 둔 것을 덮어쓰지 않기 위해).
 *   재실행은 빠진 자리만 추가한다.
 */
const LECTURE_WEEKS = 8;          // 시즌 8주 (커리큘럼 D2 확정)
const LECTURE_PER_WEEK = 4;       // 평일 5차시 − 주말 대면 1차시
// [v9.119] 개원 초 실제 분포 = 완전초보·기초. **profiles 한국어수준과 같은 어휘여야 조인된다**
//   (구 v9.111의 'Lv1','Lv2'는 profiles 어디에도 없는 값이라 이수율이 영영 무데이터였다 — 라이브 실측으로 발각).
const LECTURE_LEVELS_DEFAULT = ['완전초보', '기초'];

// 강의ID 규칙 — 정렬하면 진도 순서 그대로. 사람이 읽고 바로 위치를 안다.
//   기초-S1-W03-4 = 기초 · 시즌1 · 3주차 · 4번째 차시
function lectureIdOf_(level, season, week, no) {
  return String(level).replace(/^Lv/i, 'L') + '-S' + season + '-W' + ('0' + week).slice(-2) + '-' + no;
}

/* ▶ 1회 — lectures 시트에 이번 시즌 자리를 깐다.
 *   setupLectures()            = Lv1·Lv2 · 현재 시즌(app_state '현재시즌', 없으면 1)
 *   setupLectures(['Lv3'], 2)  = 특정 레벨·시즌만 추가
 *   URL은 비워 둔다 — 녹화가 나오는 대로 유호님이 그 칸에만 붙여넣으면 된다. */
function setupLectures(levels, season) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const sh = ensureSheet(ss, 'lectures', LECTURE_HEADERS);
  // [v9.125] '현재시즌' 키는 **읽는 곳만 있고 쓰는 곳이 없다**(4번째 같은 모양의 결함 — 값을 아무도 안 넣는다).
  //   키 부재를 조용히 1로 삼키면 시즌 2부터 메뉴 실행이 "이미 다 있음"으로 성공을 위장한다 — 반환 문구에 박아 보이게 한다.
  const seasonKey = Number((getState(st, '현재시즌') || {}).val) || 0;
  const sn = Number(season) || seasonKey || 1;
  const lvs = (levels && levels.length) ? levels : LECTURE_LEVELS_DEFAULT;

  const have = {};
  if (sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues()
    .forEach(function (r) { const id = String(r[0] || '').trim(); if (id) have[id] = 1; });

  const rows = [];
  lvs.forEach(function (lv) {
    for (let w = 1; w <= LECTURE_WEEKS; w++) {
      for (let n = 1; n <= LECTURE_PER_WEEK; n++) {
        const id = lectureIdOf_(lv, sn, w, n);
        if (have[id]) continue; // 이미 있으면 손대지 않는다(손으로 채운 URL·제목 보존)
        rows.push([id, lv, sn, w, lv + ' 시즌' + sn + ' ' + w + '주차 ' + n + '차시', '', 'Y']);
      }
    }
  });

  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, LECTURE_HEADERS.length).setValues(rows);
  const msg = '강의 자리 ' + rows.length + '개 추가 (레벨 ' + lvs.join('·') + ' · **시즌 ' + sn + '**)' +
    (rows.length ? '' : ' — 이미 다 있어 변경 없음') +
    (!Number(season) && !seasonKey ? '\n   ⚠ app_state에 「현재시즌」 키가 없어 시즌 1로 깔았습니다 — 다음 시즌부터는 app_state에 현재시즌=2를 넣고 실행하세요(안 넣으면 계속 1로 깔립니다).' : '') +
    '\n   다음: URL 칸(F열)에 녹화 링크를 채우세요. 비어 있어도 이수율 분모에는 들어갑니다.' +
    '\n   필수(G열)를 Y가 아닌 값으로 바꾸면 그 강의는 분모에서 빠집니다.' +
    '\n   그 다음: createLectureForm ▶ 1회 — 폼 선택지가 이 목록으로 만들어집니다.';
  Logger.log(msg);
  return msg;
}
