/* ============================================================
 * SYNK 교재연동 엔진 [v9.59] — 목소리 타임랩스(A) + 연습 노트(B) + AI 문법 판정(C)
 *   ⚠ B 는 v9.229 에서 「필살기 노트」→「내 연습 노트」로 개명됐다(유호 확정 08-13 · 카피 전수감사
 *     갈래2-② ⓑ). 시트 열 이름도 `필살기노트`→`연습노트` — 마이그레이션은 setupTextbookLink 안 한 줄.
 *
 * 무엇(2026-07-24 유호님 채택 2건 — 기능 동결의 명시 예외):
 *   A. 목소리 타임랩스 — 낭독 과업의 음성 녹음을 폼으로 제출받아 (읽을 거리는 교재가 아니라
 *      voice_missions 시트가 정한다 · v9.190 미션ID · v9.278 씨앗 11) — 그것으로
 *      "처음 목소리 vs 오늘 목소리" 성장 카드를 만든다(시즌1 「첫 목소리」 서사의 물증).
 *   B. 연습 노트 — mastery_log(미도달 문법)·student_errors(강사 약점 메모)·
 *      hw_feedback(AI 첨삭)을 모아 "너의 약점은 이 문법"을 학생별 생성.
 *      ([09-04] "교재 몇 과를 펴라" 꼬리는 걷혔다 — 유호 지시 · 확정 09-03 「교재와 앱은 별개」).
 *   C. AI 문법 판정 [v9.59, 유호님 지시 "교사 손 0"] — 학생이 숙제폼으로 낸 문장을
 *      AI가 판정해 mastery_log를 자동 축적. 강사 마감폼 문법태그 없이도 진화 게이트·
 *      연습 노트가 완전 작동한다(마감폼·약점메모폼은 선택 보강으로 강등).
 *      열의 있는 학생일수록 제출↑ → 도달↑ → 진화↑ — 학생 주도 완결 루프.
 *
 * 설계 원칙
 *   ① Glide update 0 — 폼 제출(인바운드)·야간 배치 쓰기만. 앱은 읽기 전용.
 *   ② AI 신규 호출 0 — B는 이미 생성된 첨삭 문구를 재조립한다(비용 증가 없음).
 *   ③ Code.js 무편집 — 상담AI.js 선례(신규 파일 분리). 타파일 전역은 함수 안에서만 읽는다.
 *   ④ 파일 업로드 폼은 Apps Script가 못 만든다(FormApp 미지원) — 폼만 유호님 손(5분),
 *      나머지 연결·미리채움·전개는 전부 스크립트가 한다.
 *
 * 유호님 절차 정본 = docs/교재연동_실행지_v958.md (폼 생성 → app_state 등록 →
 *   voiceFormFinishSetup ▶ → setupTextbookLink ▶ → Glide 열 배치)
 *
 * profiles 신규 열(헤더는 setupTextbookLink가 세팅):
 *   DB 목소리폼URL(학생별 미리채움) · DC 목소리성장카드 · DD 연습노트
 * 신규 시트: voice_log — 열 정본은 VOICE_LOG_HEADERS(v9.107 전사 3열 · [v9.187] 급수 증분 · [v9.208] schema_ver)
 * ============================================================ */

// ── 자체 상수(리터럴만 — 톱레벨 타파일 참조 금지 규칙 준수) ──────────────

/* [09-04] 문법 ID → 교재 위치 표(TB_GRAMMAR_LESSON)를 걷었다.
 *   유호 지시 09-04 「교재관련 오염되거나 낡은거 있으면 다 지워줘」 · 확정 09-03 「교재와 앱은 아예 별개」.
 *   09-03 에 「존폐는 유호님 판정거리」로 남겨 둔 자리이고, 그 판정이 내려졌다.
 *   읽던 곳은 연습 노트 한 줄뿐이었다(「— 권1 N과 다시 펴기」 꼬리) — 그 꼬리도 같이 걷었다.
 *   ⇒ 연습 노트 본체는 mastery_log·student_errors·hw_feedback 만 읽으므로 교재 없이 그대로 선다.
 *   보관 = git 이력 + docs/_archive/교재_앱_연동_매핑_v1.md(09-03 에 이미 보관됐다). */
const TB_VOICE_POINTS = 10;              // 목소리 제출 포인트(하루 1회 자체 가드)
const TB_VOICE_REASON = '목소리제출';     // point_logs 사유(멱등 키)
const TB_NOTE_MAX = 3;                   // 연습 노트 최대 항목 수(인지 부하 상한)
const TB_GROWTH_MIN_DAYS = 21;           // 성장 카드 최소 간격(처음↔최신)
const TB_JUDGE_MAX_PER_RUN = 20;         // C. 문법 판정 — 밤당 최대 학생 수(비용·시간 가드)
const TB_JUDGE_TEXT_CAP = 600;           // 학생당 판정 입력 문장 길이 상한(자 · 쓰기·말하기 공용)
const TB_VOICE_JUDGE_MAX_PER_RUN = 10;   // C-2. 말하기 판정 — 밤당 최대 학생 수(쓰기보다 낮다: STT 뒤에 도는 자리라 시간이 이미 깎여 있다)
const TB_TALK_JUDGE_MAX_PER_RUN = 15;    // C-3. 대화 판정 — 밤당 최대 학생 수(말하기보다 높고 쓰기보다 낮다: STT «앞»이라 예산이 남아 있고, 재료는 22시 대화 배치가 이미 만들어 뒀다)

// profiles 열을 헤더 이름으로 찾는다 — 열 번호 하드코딩 금지(집필 중 54↔106 오계산을 실제로
// 냈던 오류 클래스의 회귀 장치. 다른 세션이 열을 추가·이동해도 이름이 맞으면 안전).
function tbProfileCol_(pf, name) {
  const head = pf.getRange(1, 1, 1, pf.getLastColumn()).getValues()[0];
  for (let i = 0; i < head.length; i++) if (String(head[i]) === name) return i + 1;
  return 0; // 헤더 없음 = setupTextbookLink 미실행 — 쓰지 않고 조용히 대기
}

// ── 유호님 ▶ 1회: 폼 연결 마무리 ─────────────────────────────────────
// 전제: 실행지 STEP 1~2 — 유호님이 폼(학생ID·미션·녹음 파일 3문항)을 만들고
//       app_state에 [목소리폼편집URL | <폼 편집 화면 URL>] 행을 추가한 상태.
function voiceFormFinishSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const url = String(getState(st, '목소리폼편집URL').val || '').trim();
  if (!url) { Logger.log('❌ app_state에 「목소리폼편집URL」 행이 없습니다 — 실행지 STEP 2를 먼저.'); return; }
  const m = url.match(/\/d\/([-\w]+)/);
  if (!m) { Logger.log('❌ URL에서 폼 ID를 찾지 못했습니다. 폼 "편집 화면"의 주소 전체를 붙여넣었는지 확인하세요.'); return; }
  let form;
  try { form = FormApp.openById(m[1]); }
  catch (e) { Logger.log('❌ 폼을 열 수 없습니다(권한/삭제 확인): ' + e); return; }

  // 응답 목적지를 이 시트로(이미 연결돼 있으면 스킵) + 탭 이름 고정
  if (!ss.getSheetByName('목소리폼_응답')) {
    const before = ss.getSheets().map(s => s.getName());
    try { form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId()); } catch (e) {}
    linkFormTab_(ss, before, '목소리폼_응답');
  }
  setState(st, '목소리폼ID', form.getId());
  setState(st, '목소리폼URL틀', prefillTemplateOf_(form, '학생ID')); // SIDTOKEN 치환형 — 학생별 원터치
  try { migrateVoiceFormMissionId(); } catch (e) { Logger.log('미션ID 증분 보류: ' + e); } // 새로 연결한 폼도 과업 축을 갖고 시작한다
  Logger.log('✅ 목소리 폼 연결 완료. setupTextbookLink ▶ 실행(1회) 후, 다음 야간 배치부터 profiles DB열에 학생별 링크가 채워집니다.');
  Logger.log('※ 파일 업로드 폼은 학생이 구글 계정 로그인 상태여야 제출됩니다(안드로이드 폰은 대부분 로그인 상태).');
}

/* [v9.190] 🎙 목소리 폼에 「미션ID」 문항을 증분 추가한다 (유호님 승인 2026-08-06 · 멱등).
 *
 * 왜: '미션'이 자유 문자열이라 같은 과제가 여러 표기로 쌓인다. 발음 데이터에 **과업 축**이 없으면
 *   "무엇을 읽었을 때의 발음인지"로 묶을 수가 없고, 그 손실은 소급 복구가 안 된다(학습데이터_스키마감사 잔여 1건).
 *
 * 설계 — migrateHwFormV9138 과 같은 계급이라 같은 세 가지를 지킨다:
 *   ① **선택 응답** — 필수로 만들면 이미 배포된 학생별 프리필 링크(이 문항이 없는)가 전부 제출 불가가 된다.
 *   ② **기존 '목소리폼URL틀'을 건드리지 않는다** — profiles DB열에 이미 뿌려진 학생별 링크가 그대로 살아야 한다.
 *      미션별 링크는 **별도 키** '목소리폼미션틀'로 낸다(숙제폼URL틀 / 숙제폼재작성틀 2키 규약과 동일).
 *   ③ 틀은 **문항이 생긴 뒤에** 뽑는다 — 먼저 뽑으면 프리필 자리가 안 잡힌 틀이 저장된다.
 *
 * 실행: 교재연동Nightly 가 매일 부른다 — **클릭 0회로 자기적용**되고, 폼을 새로 만들어도 다시 치유된다
 *   (유호님 "원격으로 진행" 08-06 · 크롬 브리지가 끊겨 있어 편집기 ▶ 를 쓸 수 없는 상태의 처방이기도 하다).
 *   이미 있으면 조용히 틀만 갱신하고 빈 문자열을 돌려준다 — 매일 같은 메일이 오면 그건 알림이 아니라 소음이다. */
function migrateVoiceFormMissionId() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const fid = String(getState(st, '목소리폼ID').val || '');
  if (!fid) return '';                       // 폼 미연결 — 조용히 대기(다른 기능과 동일한 스위치 원칙)
  let form;
  try { form = FormApp.openById(fid); }
  catch (e) { Logger.log('⚠️ 목소리 폼 접근 실패(권한/삭제 확인): ' + e); return ''; }

  const had = form.getItems().map(x => String(x.getTitle()).trim()).indexOf('미션ID') > -1;
  if (!had) {
    form.addTextItem().setTitle('미션ID').setRequired(false)
      .setHelpText('선생님이 준 링크로 열었다면 자동으로 채워져 있어요 — 비워 두셔도 제출됩니다');
  }
  setState(st, '목소리폼미션틀', prefillTemplate2_(form, '학생ID', '미션ID', 'MISSIONTOKEN'));
  if (had) return '';                        // 이미 있음 — 야간 배치가 매일 부르므로 침묵이 정상이다

  const msg = '🎙 목소리 폼에 「미션ID」 문항을 추가했습니다(선택 응답 — 비워도 제출됩니다).\n'
    + '미션별 링크 틀 = app_state 「목소리폼미션틀」 — SIDTOKEN·MISSIONTOKEN 을 바꿔 쓰면 그 미션 전용 링크가 됩니다.\n'
    + '기존 학생별 링크(profiles 「목소리폼URL」)는 그대로 살아 있습니다.';
  Logger.log(msg);
  adminMail('[SYNK] 🎙 목소리 폼 미션ID 문항 추가', msg);
  return msg;
}

// ── 유호님 ▶ 1회: 시트·열·야간 트리거 설치(멱등) ───────────────────────
function setupTextbookLink() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet(ss, 'voice_log', VOICE_LOG_HEADERS);
  const pf = ss.getSheetByName('profiles');
  if (pf) {
    if (String(pf.getRange('DB1').getValue()) !== '목소리폼URL') pf.getRange('DB1').setValue('목소리폼URL');
    if (String(pf.getRange('DC1').getValue()) !== '목소리성장카드') pf.getRange('DC1').setValue('목소리성장카드');
    /* [v9.229] 개명 — 「필살기노트」 → 「연습노트」(유호 확정 08-13 갈래2-② ⓑ · 카피 전수감사).
     * 구 표기 「내일의 필살기」 계열이 퇴역했고 이 열 이름이 그 계열의 마지막 라이브 자리였다.
     * 🔑 이 한 줄이 마이그레이션이다 — 옛 이름이든 빈 칸이든 새 이름으로 덮는다. 열의 «값»은
     *   건드리지 않는다(다음 일요일 밤 buildFocusNotes_ 가 새 제목으로 다시 쓴다). */
    if (String(pf.getRange('DD1').getValue()) !== '연습노트') pf.getRange('DD1').setValue('연습노트');
  }
  // 야간 트리거(23:00) — 같은 함수의 기존 트리거는 제거 후 재설치(멱등)
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === '교재연동Nightly') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('교재연동Nightly').timeBased().everyDays(1).atHour(23).create();
  Logger.log('✅ 교재연동 설치 완료 — 매일 23시: 목소리 스윕+링크, 일요일 밤: 연습 노트 생성.');
  교재연동Nightly(); // 설치 직후 1회 즉시(링크 열을 바로 채워 Glide 조립을 기다리게 하지 않는다)
}

// ── 야간 오케스트레이터(트리거 23:00 — aiFeedbackBatch_ 22시 뒤라 당일 첨삭분 판정 가능) ──
function 교재연동Nightly() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try { masteryFromFeedback_(ss); } catch (e) { Logger.log('masteryFromFeedback_ 오류: ' + e); }
  /* [v9.249 · #Q99] 대화 판정은 **STT 앞**이다 — 재료(학생문)는 22시 대화 배치가 이미 적어 뒀으니
   *   이 밤에 만들어질 것을 기다릴 필요가 없고, `voiceTranscribe_` 뒤로 밀면 6분 예산이 깎인 뒤라
   *   굶는다(말하기 상한을 10 으로 낮춰야 했던 그 자리 · 말하기는 그 밤 전사분을 봐야 해서 뒤에 선다). */
  try { masteryFromTalk_(ss); } catch (e) { Logger.log('masteryFromTalk_ 오류: ' + e); }
  // [v9.190] 폼 문항 자기적용 — **스위프보다 앞**이어야 그날 응답부터 미션ID 열을 읽는다(멱등·이미 있으면 침묵)
  try { migrateVoiceFormMissionId(); } catch (e) { Logger.log('migrateVoiceFormMissionId 오류: ' + e); }
  try { voiceSweep_(ss); } catch (e) { Logger.log('voiceSweep_ 오류: ' + e); }
  try { voiceTranscribe_(ss); } catch (e) { Logger.log('voiceTranscribe_ 오류: ' + e); } // [v9.107] 적재 직후 전사 — 성장 카드가 전사문을 실을 수 있게 카드 생성보다 앞
  // [v9.248 · #Q99] 전사 **직후** — 그날 밤 전사분이 그날 밤 문법 판정에 들어간다(스트림은 전사일시 워터마크)
  try { masteryFromVoice_(ss); } catch (e) { Logger.log('masteryFromVoice_ 오류: ' + e); }
  try { writeVoiceLinks_(ss); } catch (e) { Logger.log('writeVoiceLinks_ 오류: ' + e); }
  try { buildVoiceGrowthCards_(ss); } catch (e) { Logger.log('buildVoiceGrowthCards_ 오류: ' + e); }
  // 연습 노트는 주 1회(일요일 밤)면 충분 — 매일 바뀌면 "노트"가 아니라 소음이 된다
  if (new Date().getDay() === 0) {
    try { buildFocusNotes_(ss); } catch (e) { Logger.log('buildFocusNotes_ 오류: ' + e); }
  }
}

/* [v9.277] 🎙 낭독 미션 목록 — 「미션ID → 그날 무엇을 읽게 했나」 한 벌.
 * 규격 정본 = `docs/발음데이터_규격.md`. 시트 이름 = `voice_missions` · 열 = [미션ID, 축, 목표발화, 비고].
 *
 * 🔑 **문장은 유호님이 쓰신다**(유호 확정 08-31 「내가 쓸게」). 그래서 이 함수는 목록을 **만들지 않고 읽기만** 한다 —
 *   AI 초안을 깔아 두면 유호님이 「쓰는」 일이 「고치는」 일로 바뀐다. 시트가 없으면 조용히 빈 표를 낸다.
 * ⚠ 없음과 못 읽음을 같은 모양으로 두지 않는다 — 시트가 없으면 `{}`(정상 · 아직 안 쓰심)이고,
 *   시트는 있는데 열 이름이 안 맞으면 그건 결함이라 원장에게 말한다(조용히 빈 표를 내면 목표발화가
 *   영원히 빈 채로 «정상처럼» 쌓인다 — 이 저장소가 여러 번 데인 「0건이 성공 얼굴」 그대로다). */
function voiceMissionTexts_(ss) {
  const sh = ss.getSheetByName('voice_missions');
  if (!sh || sh.getLastRow() < 2) return {};              // 아직 안 쓰셨다 — 정상
  const w = sh.getLastColumn();
  const head = sh.getRange(1, 1, 1, w).getValues()[0].map(h => String(h || '').replace(/\s/g, ''));
  const cId = head.indexOf('미션ID'), cTx = head.indexOf('목표발화'), cAx = head.indexOf('축');
  if (cId < 0 || cTx < 0) {
    /* 🔴 «하루 한 번»만 알린다 (2026-09-03 · codex P2 `28ff9c56654b` 채택 수리).
     *   이 함수는 새 제출이 있든 없든 매 실행 맨 앞에서 불린다(잠금 «전»에 읽는 것이 설계다 —
     *   P1 48f070b17495). 그래서 머리글이 한 번 어긋나면 야간 배치마다, 그리고 원장이 메뉴를
     *   누를 때마다 같은 메일이 나갔다. 매일 우는 경보는 읽히지 않게 되고, 그러면 진짜 경보도 묻힌다.
     * 🔑 조용한 쪽으로 기울지 않는다 — 날짜를 «못 재면» 그냥 알린다(못 잰 것을 「알렸다」로 접지 않는다).
     * ⚠ 마킹은 메일 «뒤»다(notifyDroppedSids_ 와 같은 규율) — 큐 적재가 실패한 날 통보가
     *   증발하지 않게. 대가로 두 실행이 겹치면 같은 날 두 통이 갈 수 있는데, 그건 손실이 아니다.
     * ⚠ `typeof` 로 감싼 까닭: 시험이 이 함수를 소스에서 잘라 adminMail 하나만 주입해 태운다
     *   (tests/발음미션목록.test.js) — 없는 전역을 부르면 그 시험이 죽는다. */
    let 오늘알림 = true;
    let 찍기 = null;
    try {
      if (typeof PropertiesService !== 'undefined' && PropertiesService && typeof Utilities !== 'undefined') {
        const props = PropertiesService.getScriptProperties();
        const tz = (ss.getSpreadsheetTimeZone && ss.getSpreadsheetTimeZone()) || 'Asia/Ulaanbaatar';
        const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
        if (String(props.getProperty('미션헤더경고') || '') === today) 오늘알림 = false;
        else 찍기 = () => props.setProperty('미션헤더경고', today);
      }
    } catch (e) { 오늘알림 = true; 찍기 = null; }
    if (오늘알림) {
      adminMail('[SYNK] 🎙 낭독 미션 목록의 열 이름이 안 맞습니다',
        'voice_missions 시트에 「미션ID」·「목표발화」 열이 필요한데 찾지 못했습니다.\n'
        + '지금 머리글: ' + head.join(' · ') + '\n\n'
        + '그대로 두면 voice_log 의 「목표발화」 칸이 계속 빈 채로 쌓이고, 그 소리는 나중에 못 씁니다.\n'
        + '(고칠 때까지 이 알림은 하루 한 번만 갑니다 — 실행 기록에는 매번 남습니다.)');
      if (찍기) try { 찍기(); } catch (e2) { /* 못 찍으면 내일 또 알린다 — 조용해지는 것보다 낫다 */ }
    } else if (typeof Logger !== 'undefined') {
      Logger.log('[목소리] 미션 목록 열 이름이 안 맞는다 — 오늘 이미 알렸다(하루 1회). 지금 머리글: ' + head.join(' · '));
    }
    return {};
  }
  /* 🔴 [2026-09-01] **한 미션ID 에 낱말이 여럿이다 — 그래서 배열이다.**
   *   그전 구현은 `out[id] = tx` 라 **뒤 행이 앞 행을 덮었다.** HW306 처럼 낱말 여섯을 지정하면
   *   다섯이 조용히 사라졌고, 오류도 경고도 없었다. 아래 `voiceSweep_` 주석(:245)은 그때도
   *   「그날의 값을 **스냅샷**한다」고 적고 있었으니 **구현이 자기 주석을 못 지킨 것**이다.
   *   ⇒ 소급 불가 직격이었다: 그날 학생에게 무엇을 읽게 했는지가 영영 복원되지 않는다.
   *   (발음데이터 규격 심문 P0-② · 판정 = `docs/_ops/심문결과/발음데이터_규격-전건판정.md`)
   * 🔑 축을 함께 담는다(`P3:읽었어요`) — 한 낱말이 어느 축을 노렸는지가 목록에만 있고 로그에 없으면
   *   나중에 축별로 못 센다. 축 열이 없으면 낱말만 담는다(없는 것을 지어내지 않는다). */
  const out = {};
  sh.getRange(2, 1, sh.getLastRow() - 1, w).getValues().forEach(r => {
    const id = String(r[cId] || '').trim();
    const tx = String(r[cTx] || '').trim();
    if (!id || !tx) return;
    const ax = cAx >= 0 ? String(r[cAx] || '').trim() : '';
    (out[id] || (out[id] = [])).push(ax ? ax + ':' + tx : tx);
  });
  return out;
}

// ── A-1. 폼 응답 → voice_log 전개(+포인트, 파일 공유 전환) ──────────────
function voiceSweep_(ss) {
  /* [2026-09-03 · 이종 검수 P1 48f070b17495] 🔴 **잠금 «전»에 읽는다.**
   *   `voiceMissionTexts_` 는 `voice_missions` 헤더가 어긋나면 **스스로 `adminMail` 을 부른다.**
   *   잠금을 쥔 채 부르면 그 안의 `waitLock(30000)` 과 겹쳐 30초 뒤 예외가 나고, 그 예외는
   *   여기서 안 잡혀 **배치가 통째로 멈춘다.** 읽기 전용이라 잠금 밖이 안전하다.
   *   ⚠ 비용 = 새 제출이 없어도 시트를 한 번 읽는다(야간 1회 · 무시 가능). 그 대가로
   *   「잠금 안에서 메일에 닿는 경로 0」이 눈으로 확인된다. */
  /* 🔴 **여기서 예외를 삼키지 않는다** — 삼키면 소급 불가한 것이 조용히 빈 채로 굳는다
   *   (2026-09-03 · codex P1 `67dacb6776e4`·`0d5c983cf55f` 채택 수리 · **내가 같은 날 넣은 감싸기를 도로 걷은 자리**).
   *   무슨 일이 있었나 — 나는 「이 호출이 던지면 야간 배치가 통째로 멈춘다」고 보고 try 로 감쌌다.
   *   **그 전제가 틀렸다**: `교재연동Nightly` 는 단계마다 이미 try/catch 를 두르고 있어(:156)
   *   여기서 던져도 배치는 다음 일로 넘어간다. 막을 것이 없는데 감쌌고, 그 대가가 컸다 —
   *   시트 «읽기»가 일시적으로 실패한 밤에도 빈 목록으로 스윕이 계속 돌아 목표발화가 **공란으로**
   *   `voice_log` 에 앉고 포인터가 전진한다. 다음 밤에 시트가 멀쩡해져도 그 제출은 다시 안 읽히므로
   *   **그날 학생에게 무엇을 읽게 했는지가 영영 복원되지 않는다**(발음데이터 규격 §목표발화 = 그날의 전량 스냅샷).
   * 🔑 「없다」와 「못 읽었다」를 가르는 것은 이 파일이 이미 아는 규율이다 — `voiceMissionTexts_` 머리말이
   *   그렇게 적혀 있고(시트 없음 = `{}` 정상 · 열 이름 어긋남 = 원장에게 알림), 나는 그 «셋째 갈래»
   *   (읽다가 던짐)를 첫째로 뭉쳤다. 던지게 두면 포인터가 안 움직여 다음 실행이 같은 제출을 다시 본다. */
  const 목표문 = voiceMissionTexts_(ss);
  /* [2026-09-03 · 이종 검수 P1 a1ba9ec3127f] 🔒 한 번에 하나만 돈다.
   *   이 함수는 이제 두 곳에서 불린다 — 23시 야간 배치(`교재연동Nightly`)와 원장이 누르는
   *   「목소리 지금 걷어오기」 메뉴(v9.296). 둘이 겹치면 **같은 포인터와 같은 새 응답을 함께 읽어**
   *   voice_log 와 point_logs 에 같은 제출이 두 번 앉는다. 포인터 전진은 그 뒤에 일어나므로
   *   「포인터가 있으니 중복은 없다」는 순차 실행에서만 참이다.
   *   편집자가 둘이면 메뉴 동시 클릭만으로도 재현된다.
   *   ⚠ 못 잡으면 **기다리지 않고 되돌아간다** — 이미 다른 실행이 같은 일을 하고 있으므로
   *   건너뛰는 것이 옳다(대기는 야간 배치의 6분 상한을 먹는다). 포인터를 안 건드리니 누락도 없다.
   *   `typeof` 로 감싼 까닭: 시험이 이 함수를 소스에서 꺼내 태운다(tests/발음수집통관.test.js). */
  const 잠금 = (typeof LockService !== 'undefined' && LockService) ? LockService.getScriptLock() : null;
  if (잠금 && !잠금.tryLock(1000)) {
    Logger.log('voiceSweep_: 다른 실행이 이미 걷고 있다 — 이번 호출은 건너뛴다(중복 적재 방지)');
    return { 결과: '잠김' };
  }
  /* 🔴 메일은 **잠금 «밖»에서** 보낸다 — 여기 담아 두고 `finally` 가 해제한 뒤 발송한다.
   *   까닭: `adminMail`(엔진_콘텐츠AI.js)은 DIGEST_MODE=true 라 자기도 `getScriptLock().waitLock(30000)`
   *   을 부른다. 같은 실행이 이미 쥔 스크립트 잠금을 «다른 Lock 객체»로 다시 얻을 수 있는지는
   *   Apps Script 문서가 답하지 않는다(「이미 획득했으면 효과 없음」이 같은 실행을 뜻하는지 불명).
   *   재진입이 안 되면 30초 뒤 예외가 나 **야간 배치가 통째로 죽는다** — 중복을 막으려다
   *   더 큰 것을 깨는 자리라, 확인되지 않은 쪽에 걸지 않는다. [[knowing-vs-machine-timing]] */
  const 알림 = [];
  /* 무효 학생ID 통보도 잠금 «밖»이다 — `notifyDroppedSids_` 가 `adminMail` 을 부르는데, 그 함수는
   *   자기 예외를 `catch` 로 삼킨다. 잠금 안에서 부르면 30초 뒤 조용히 실패하고 **알림 없이
   *   포인터만 전진**한다(학생이 낸 것이 어디로 갔는지 아무도 모르게 된다). */
  const badSid = [];
  try {
    /* [2026-09-03 · 이종 검수 P2 95aec3956067] 이 함수는 이제 «무슨 일이 있었나»를 돌려준다.
     *   야간 배치는 반환값을 안 쓴다(그대로다). 쓰는 쪽은 메뉴 화면 `voiceSweepNow_` 하나다 —
     *   그 화면이 0건일 때 「원인 셋」을 스스로 짐작하고 있었는데, 헤더 누락·판정 불가·잠김은
     *   그 셋에 없다. 짐작이 아니라 **여기서 일어난 일**을 그대로 받아 말하게 한다.
     *   [[zero-is-a-success-face-taxonomy]] — 0은 여러 얼굴을 하고, 얼굴마다 처방이 다르다. */
    const src = ss.getSheetByName('목소리폼_응답');
    if (!src || src.getLastRow() < 2) return { 결과: '제출없음', 본새제출: 0, 앉힘: 0 };
    const props = PropertiesService.getScriptProperties();
    const last = src.getLastRow();
    const from = Number(props.getProperty('목소리폼_포인터')) || 1;
    if (from >= last) { if (from > last) props.setProperty('목소리폼_포인터', String(last)); return { 결과: '새제출없음', 본새제출: 0, 앉힘: 0 }; }
    const tz = ss.getSpreadsheetTimeZone();

    // 응답 열 위치는 헤더로 찾는다(문항 순서를 유호님이 바꿔도 안전)
    const head = src.getRange(1, 1, 1, src.getLastColumn()).getValues()[0].map(h => String(h || ''));
    const cSid = head.findIndex(h => h.indexOf('학생ID') > -1);
    /* [v9.190] ⚠ '미션ID'는 '미션'을 부분문자열로 품는다 — 먼저 집고, '미션'은 **그 열을 뺀 뒤** 찾는다.
     *   순서를 안 가르면 폼 문항 순서가 바뀌는 순간 ID가 자유문자열 칸에 실린다(예외 없이 조용한 오적재). */
    const cMissionId = head.findIndex(h => h.replace(/\s/g, '').indexOf('미션ID') > -1);
    const cMission = head.findIndex((h, i) => i !== cMissionId && h.indexOf('미션') > -1);
    const cFile = head.findIndex(h => h.indexOf('녹음') > -1 || h.indexOf('파일') > -1);
    if (cSid < 0 || cFile < 0) { Logger.log('voiceSweep_: 응답 탭에서 학생ID/녹음 열을 못 찾음 — 폼 문항 제목 확인'); return { 결과: '헤더없음', 본새제출: last - from, 앉힘: 0, 없는열: (cSid < 0 ? '학생ID' : '') + (cSid < 0 && cFile < 0 ? '·' : '') + (cFile < 0 ? '녹음/파일' : '') }; }

    // [v9.187] 폭 67 — 급수(BO67) 스냅샷 재료(첨삭·대화·퀴즈와 같은 위치 규약 r[66]).
    //   새 응답이 있을 때만 여기 온다(위 포인터 조기 반환) — 야간 1회라 비용 무시 가능.
    const valid = new Set(), lvOf = {};
    const pf = ss.getSheetByName('profiles');
    if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 67).getValues().forEach(r => {
      if (r[0] && r[3] === 'student') { const k = String(r[0]).trim(); valid.add(k); lvOf[k] = Number(r[66]) || 0; }
    });

    const vl = ensureSheet(ss, 'voice_log', VOICE_LOG_HEADERS);
    헤더보정_(vl, VOICE_LOG_HEADERS); // [v9.187] 이미 서 있는 9열 시트에 급수 이름표(엔진_수집.js 공용 치유 — 런타임 호출이라 로드 순서 무관)
    const pl = ensureSheet(ss, 'point_logs', ['id', 'student_id', 'points', 'reason', 'given_by', 'created_at', 'month', '태그']);
    // 멱등: 이미 지급된 '날짜|sid' (지급→포인터 저장 사이 크래시 재시도 대비)
    const givenKey = {};
    if (pl.getLastRow() >= 2) pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues().forEach(r => {
      if (r[1] && String(r[3] || '') === TB_VOICE_REASON && r[5]) givenKey[dstr(r[5], tz) + '|' + String(r[1]).trim()] = 1;
    });

    /* [v9.104] 🔒 음성 동의 게이트 — v9.90이 '음성동의' 열을 만들며 "후속 녹음 기능이 기계 게이트로 쓴다"고
     *   선언했는데 정작 이 스위프에는 배선이 없었다(08-01 발견). 동의하지 않은 학생의 녹음이 voice_log에
     *   쌓이고 포인트까지 지급되던 상태였고, 보관이 무기한이 되면서 그 비용이 "영구 보관"으로 커진다.
     *   맵이 null(시트·열 접근 실패)이면 **전원 보류** — 판정 불가를 통과로 바꾸면 게이트가 침묵으로 열린다.
     *   보류분은 적재도, 공유 전환도, 포인트도 하지 않고 원장에게만 알린다. 파일 자동 삭제는 하지 않는다
     *   (오판이면 복구가 불가능하고, 종이 동의서 학생일 수도 있다 — 사람이 판단할 몫). */
    const consent = (typeof voiceConsentMap_ === 'function') ? voiceConsentMap_() : null;
    /* [2026-09-03 · 이종 검수 P1 d8ecb6e56c6f] 🔴 판정 불가면 **포인터를 전진시키지 않는다.**
     *   v9.104 가 「맵이 null 이면 전원 보류」를 세웠는데, 함수 끝의 `props.setProperty('목소리폼_포인터', last)`
     *   는 그 보류와 무관하게 늘 돌았다. 그래서 상담시트 접근이 한 번만 끊겨도 그 사이의 제출은
     *   **다음 실행에서 「새 제출」로 보이지 않는다** — 보류가 아니라 «영구 누락»이다.
     *   학생 녹음은 그날만 존재한다(규격 §「소급 불가는 무엇을 말하게 했느냐」). 재제출을 안내한들
     *   그날 그 소리는 아니다.
     *   그래서 여기서 **아무것도 하지 않고 되돌아간다** — 포인터가 제자리에 있으면 권한이 고쳐진 뒤
     *   다음 실행이 같은 제출을 그대로 집는다. 알림은 매 실행 간다(새 제출이 있을 때만 여기 온다).
     *   ⚠ 개별 학생의 '미응답'·'거부'는 이 갈래가 아니다 — 그건 판정이 «된» 것이라 포인터가 전진한다. */
    if (consent === null) {
      Logger.log('voiceSweep_: 음성 동의 판정 불가 — 포인터를 전진시키지 않고 되돌아간다(영구 누락 방지)');
      알림.push({ 제목: '[SYNK] 🔒 음성 동의를 확인할 수 없어 걷기를 멈췄습니다', 본문:
        '새 목소리 제출 ' + (last - from) + '건을 봤지만 「음성동의」를 읽지 못해 **하나도 처리하지 않았습니다.**\n\n' +
        '중요: 이번에는 표시를 앞으로 옮기지 않았습니다 — 아래를 고치신 뒤 다시 걷으면 **이 제출들이 그대로 처리됩니다.**\n' +
        '(고치지 않고 두면 알림만 계속 옵니다. 제출이 사라지지는 않습니다.)\n\n' +
        '왜 못 읽었나 — 둘 중 하나입니다:\n' +
        '  · 상담 스프레드시트에 「음성동의」 칸이 아직 없다 → 메뉴에서 migrateConsentV186 ▶ 를 한 번 누르세요.\n' +
        '  · 지금 실행한 계정이 상담 스프레드시트를 열 권한이 없다 → 원장 계정으로 다시 누르세요.' });
      return { 결과: '동의불가', 본새제출: last - from, 앉힘: 0 };
    }
    /* [v9.277] 제출 «시점»에만 알 수 있는 둘을 여기서 박는다 — 규격 = docs/발음데이터_규격.md.
     *   ㉠ 시즌 — Ⅰ-8 이 눈금을 「그 학생의 지난 시즌 대비」로 못 박았다. 시즌 시작일은 **사람이 정하고 바뀌므로**
     *     제출일에서 나중에 유도할 수 없다(그 유도는 옛 시즌 행을 새 경계로 다시 갈라 조용히 틀린다).
     *   ㉡ 목표발화 — 미션 목록은 개정된다. 참조(미션ID)만 남기면 2년 뒤 그 ID 가 무엇이었는지 모른다.
     *     그래서 **그날의 값을 스냅샷**한다([[constant-known-in-two-places]] 와 같은 축).
     *     ⚠ 목록 시트가 아직 없으면 빈 칸이다 — 그건 결함이 아니라 «아직 안 쓴 것»이고, 목록이 서는
     *     날부터 그날 제출분에 붙는다. 이미 쌓인 행에 소급하지 않는다(소급하면 그날 실제로 시킨 것이
     *     아니라 «지금 목록이 말하는 것»이 박혀, 이 칸의 존재 이유가 사라진다). */
    const 시즌 = (typeof seasonLabelOf_ === 'function') ? seasonLabelOf_(ss, tz) : '';
    // 목표문은 잠금 «전»에 읽어 두었다(위 머리 주석 · 검수 P1 48f070b17495)
    const rows = src.getRange(from + 1, 1, last - from, src.getLastColumn()).getValues();
    // [v9.104] 미동의 보류 · [2026-09-03 검수 P2] 빈칸 둘도 «센다» —
    //   세지 않으면 「2건 중 1건만 앉았다」를 화면이 설명할 수 없다(나머지 하나가 어디로 갔는지 모른다).
    //   ⚠ badSid 는 잠금 «밖» 스코프다(위 선언 · 통보가 잠금 안에서 죽던 자리).
    const vOut = [], pOut = [], held = [];
    let 파일빈칸 = 0, ID빈칸 = 0;
    rows.forEach(r => {
      const ts = r[0] instanceof Date ? r[0] : new Date();
      const sid = String(r[cSid] || '').trim();
      if (!sid) { ID빈칸++; return; }
      if (!valid.has(sid)) { badSid.push(sid); return; } // 통보만(Code.js notifyDroppedSids_ — 하루 1회 dedup)
      const state = consent ? (consent[sid] || '') : null;
      if (state !== 'yes') { held.push(sid + ' (' + (state === 'no' ? '거부' : state === '' ? '미응답' : '동의 확인 불가') + ')'); return; }
      const fileUrl = String(r[cFile] || '').trim();
      if (!fileUrl) { 파일빈칸++; return; }
      const mission = cMission >= 0 ? String(r[cMission] || '').trim() : '';
      const fid = (fileUrl.match(/[?&]id=([-\w]+)/) || fileUrl.match(/\/d\/([-\w]+)/) || [])[1] || '';
      /* [v9.155] 🔒 공개 전환을 **하지 않는다**(유호님 08-04 「B로 가자」 결정 · 근거 = docs/개인정보처리방침_초안_v1.md §0-B).
       *   구 설계는 앱 재생을 위해 학생 녹음을 ANYONE_WITH_LINK로 열었다. 그런데 이 파일은 **미성년의 목소리**이고
       *   코드 스스로 「몽골법상 생체정보 계열로 읽힐 수 있다」고 적어 뒀다(엔진_폼리포트.js VOICE_RETENTION_MONTHS 주석).
       *   보관이 무기한이라 공개도 무기한이 되고, Drive 공개 링크에는 만료가 없어 한 번 새면 영구다.
       *   ▣ 대체 경로는 이미 있다 — **전사문**(v9.107). 그때 코드가 적은 판단이 그대로 근거가 된다:
       *     「링크는 눌러야 비교되고, 두 파일을 번갈아 듣는 사람은 거의 없다. 전사문이 있으면 눈으로 한 번에 대비된다.」
       *     즉 성장 카드의 값은 재생이 아니라 대비였고, 그 값은 링크 없이도 그대로 산다(buildVoiceGrowthCards_ 참조).
       *   ▣ 원본은 지우지 않는다 — 학원 내부 자산(피드백·AI 학습)이고 동의 범위 안이다. 다만 **밖에서 열리지 않는다.** */
      // [v9.187] 전사 3칸은 빈칸으로 두고(야간 STT가 채운다) 맨 끝에 급수 스냅샷 — 헤더 정본과 같은 폭으로 쓴다
      // [v9.190] 미션ID는 프리필 링크로만 들어온다 — 학생이 손으로 채우는 칸이 아니라 비어도 정상이다
      const mid = cMissionId >= 0 ? String(r[cMissionId] || '').trim() : '';
      vOut.push([sid, ts, mission, fileUrl, fid, new Date(), '', '', '', lvOf[sid] || 0,
        mid,
        SCHEMA_VER, // [v9.208] 행이 자기 규격을 들고 있게(A-8) — 정의는 엔진_수집.js 하나(사본 금지 · 함수 안 참조라 파일 로드 순서 무관)
        // [v9.277] 발음 6칸 — 지금 아는 둘만 채우고 나머지 넷은 각자의 채우는 자가 뒤에 붙인다
        // [2026-09-01] 그날 지정된 낱말 **전량** 스냅샷(`P3:읽었어요 · P9:많았어요`). 하나만 담던 것을
        // 고쳤다 — 여섯을 지정하면 다섯이 조용히 사라지고 있었다(심문 P0-②). 목록 없으면 빈 칸.
        (목표문[mid] || []).join(' · '),  // 목표발화 (소급해 채우지 않는다)
        시즌,               // 시즌     (Ⅰ-8 눈금의 전제)
        '',                 // 전사신뢰도 ← sttSweep_
        '',                 // 전사엔진판 ← sttSweep_
        '',                 // 발음태그   ← 어휘 확정 뒤(규격 §3 의 의도된 유예)
        '']);               // 돌려준날   ← buildVoiceGrowthCards_
      const key = dstr(ts, tz) + '|' + sid;
      if (!givenKey[key]) { // 하루 1회만 지급(여러 번 제출해도 기록은 전부, 포인트는 1회)
        givenKey[key] = 1;
        pOut.push(['VC' + Utilities.formatDate(ts, tz, 'yyyyMMdd') + '-' + sid, sid, TB_VOICE_POINTS,
          TB_VOICE_REASON, '시스템', ts, Utilities.formatDate(ts, tz, 'yyyy-MM'), '']);
      }
    });
    /* [v9.159] 🛡 수식 인젝션 소독 — [v9.157]이 폼 직기입 7경로를 공용 통로로 막을 때 **이 함수만 남았다**
     *   (하드닝 세션이 발견·인계 · 보드상 이 구역 편집권이 이 세션이라 넘어왔다).
     *   위험의 실체: `mission`은 목소리 폼의 **학생·강사 손입력 문자열**이고, voice_log·point_logs는
     *   `profiles`(학생·보호자 연락처)와 **같은 스프레드시트**다. `=`로 시작하면 시트가 스스로 평가해
     *   `=IMPORTDATA("...?d="&TEXTJOIN(",",1,profiles!H2:H400))` 한 줄로 개인정보가 밖으로 나간다(클릭 불요).
     *   pOut은 지금은 상수뿐이지만 함께 통과시킨다 — **같은 방어를 자리마다 판단해 얹으면 다음 자리가 빠진다.**
     *   `행소독_`(Code.js)은 문자열만 소독하고 Date·number는 타입 보존한다(ts·포인트 숫자 안전). */
    if (vOut.length) vl.getRange(vl.getLastRow() + 1, 1, vOut.length, VOICE_LOG_HEADERS.length).setValues(행소독_(vOut));
    if (pOut.length) pl.getRange(pl.getLastRow() + 1, 1, pOut.length, 8).setValues(행소독_(pOut));
    // [v9.67] notifyDroppedSids_ 는 잠금 해제 «뒤」 finally 에서 부른다(검수 P1 48f070b17495)
    props.setProperty('목소리폼_포인터', String(last));
    if (vOut.length) 알림.push({ 제목: '[SYNK] 🎙 새 목소리 ' + vOut.length + '건', 본문:
      '목소리 미션 제출 ' + vOut.length + '건이 voice_log에 쌓였습니다. 성장 카드는 야간 배치가 자동 갱신합니다.' });
    // [v9.104] 미동의 보류 통지 — 침묵하면 "왜 내 제출이 반영 안 되지"가 학생 쪽 미스터리가 된다
    if (held.length) 알림.push({ 제목: '[SYNK] 🔒 음성 동의 없는 제출 ' + held.length + '건 — 보류', 본문:
      '아래 제출은 「음성동의」가 확인되지 않아 voice_log에 넣지 않았고 포인트도 지급하지 않았습니다.\n' +
      '(파일은 자동 삭제하지 않았습니다 — 종이 동의서 학생일 수 있어 사람 판단 몫입니다.)\n\n' +
      held.join('\n') + '\n\n' +
      '처리: ①동의를 받은 학생이면 상담시트 「음성동의」 칸에 「네, 동의합니다」를 넣고 재제출을 안내하세요.\n' +
      '②거부한 학생이면 드라이브의 해당 녹음 파일을 삭제하세요.' });
    /* 갈래별 수를 그대로 돌려준다 — 화면이 「+N」만 말하고 나머지를 삼키지 않게.
     *   합계 = 앉힘 + 보류 + 무효ID + 파일빈칸 + ID빈칸 이어야 한다([[report-zero-with-denominator]]). */
    return { 결과: '걷음', 본새제출: last - from, 앉힘: vOut.length,
      보류: held.length, 무효ID: badSid.length, 파일빈칸: 파일빈칸, ID빈칸: ID빈칸 };
  } finally {
    if (잠금) 잠금.releaseLock();
    /* 해제 «뒤에» 보낸다. finally 라 어느 return 경로로 빠져나가도 나간다.
     * 🔴 여기 있는 것이 곧 「잠금 안에서 메일에 닿는 경로 0」의 집행이다 — 새 알림을 더할 때
     *   본문 안이 아니라 이 큐에 담는다(검수 P1 48f070b17495 가 잡은 자리). */
    if (badSid.length) {
      try { notifyDroppedSids_('목소리폼', badSid); } catch (e) { Logger.log('voiceSweep_ 무효ID 통보 실패: ' + e); }
    }
    알림.forEach(function (m) {
      try { adminMail(m.제목, m.본문); } catch (e) { Logger.log('voiceSweep_ 알림 실패: ' + e); }
    });
  }
}

/* ── A-1c. [v9.296] 🎙 목소리 지금 걷어오기 — 「돌았나」를 **눈으로 재는** 통로 ──────────
 * ■ 왜 있나
 *   `voiceSweep_` 는 야간 배치(23시) 안에서만 돈다. 그래서 「이 통로가 도는가」를 확인하려면
 *   ①학생 소리가 이미 들어와 있어야 하고 ②밤을 기다려야 하고 ③아침에 시트를 열어야 한다.
 *   개원 전에는 ①이 영원히 거짓이라 **확인할 방법이 0이었다** — 라이브에서 지금까지 돈 것은
 *   `setupVoiceMissions` 1회뿐이고 스위프는 0회다. 그런데 개원 첫날 학생이 낸 소리는 **그날만**
 *   존재한다(규격 §「소급 불가는 무엇을 말하게 했느냐」) — 그날 통로가 막혀 있으면 영영 못 되찾는다.
 *   v9.278 이 낭독 미션 목록을 굳이 «메뉴»로 갈라 세운 것과 같은 자리다. [[seed-code-vs-stored-rows]]
 *
 * ■ 🔑 「오류 없음」과 「걷었음」은 다른 말이다
 *   `rehearseRun_` 는 앞의 것만 말한다. 그런데 이 통로에서 **0건은 성공의 얼굴을 하고 있다** —
 *   폼 미연결·새 제출 없음·동의 미확인이 전부 조용히 0을 낸다. 그래서 여기서는 앞뒤로 세고,
 *   0이면 **원인을 지목한다.** 세는 자를 안 들면 이 버튼은 「눌렀다」만 알려 준다.
 *   [[zero-is-a-success-face-taxonomy]] · 자기 설명 = 철학 Ⅰ-3⑤.
 *
 * ■ ⚠ 리허설을 강제하지 않는 까닭 (rehearseRun_ 를 안 쓴다)
 *   이 함수가 내는 외부 동작은 **원장 자신에게 가는 메일 둘뿐**이고(새 목소리 알림·미동의 보류 알림)
 *   AI 비용은 0이다(전사는 `voiceTranscribe_` 의 몫 — 이 함수는 안 부른다). 학부모·강사에게는
 *   아무것도 안 나간다. 리허설이 켜져 있으면 그 메일 둘은 **`adminMail` 첫 줄의 `isRehearsal_()`**
 *   에서 막히고 「리허설 결과」에 적힌다 — 즉 **켜도 되고 안 켜도 되는데, 켜면 더 조용할 뿐**이다.
 *   ⚠ [2026-09-03 · 이종 검수 P2] 여기 「`quotaOk` 에서 막힌다」고 적혀 있었다. 결과는 같지만
 *   **첫 차단 지점이 다르다** — `adminMail` 은 `isRehearsal_()` 이면 quotaOk 를 보기도 «전에»
 *   되돌아간다(엔진_콘텐츠AI.js). 장애를 쫓는 사람이 엉뚱한 자리를 파게 된다.
 *
 * ■ 되돌리기
 *   멱등이 아니다 — 새 제출이 있으면 누를 때마다 그만큼 앉는다(그게 이 함수의 일이다).
 *   다만 포인터가 전진하므로 **같은 제출이 두 번 앉지는 않는다.** 시험으로 잠갔다
 *   (`tests/발음수집통관.test.js` 「포인터가 전진하고, 재실행이 같은 행을 다시 쌓지 않는다」).
 */
function voiceSweepNow_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const 머리 = '🎙 목소리 걷어오기 (SYNK ' + SYNK_VERSION + ')\n\n';

  const src = ss.getSheetByName('목소리폼_응답');
  if (!src) {
    return 머리
      + '⛔ 「목소리폼_응답」 탭이 없습니다.\n\n'
      + '목소리 폼이 이 스프레드시트에 아직 연결되지 않았다는 뜻입니다.\n'
      + '폼 편집 화면 ▸ 「응답」 탭 ▸ 스프레드시트 아이콘 ▸ 기존 스프레드시트 선택에서\n'
      + '이 파일을 고르시면 탭이 생깁니다.';
  }

  const 마지막행 = src.getLastRow();
  const 제출 = Math.max(0, 마지막행 - 1);
  const 포인터 = Number(PropertiesService.getScriptProperties().getProperty('목소리폼_포인터')) || 1;
  const 새제출 = Math.max(0, 마지막행 - 포인터);
  /* 「몇 행이었나」는 스위프 «전»에 재야 한다 — 뒤에 재면 늘어난 수를 못 가른다. */
  const 세기 = function () { const sh = ss.getSheetByName('voice_log'); return sh ? Math.max(0, sh.getLastRow() - 1) : 0; };
  const 전 = 세기();

  /* [2026-09-03 · 이종 검수 P2] 본체가 «무슨 일이 있었나»를 돌려준다 — 화면이 짐작하지 않는다.
   *   전에는 0건이면 무조건 「원인 셋 중 하나」라고 했는데, 헤더 누락·동의 판정 불가·다른 실행과
   *   겹침은 그 셋에 없다. 엉뚱한 곳을 고치게 만드는 안내는 침묵보다 나쁘다. */
  const 결 = voiceSweep_(ss) || {};

  const 후 = 세기();
  const 늘어난 = 후 - 전;
  const 리허설 = (typeof isRehearsal_ === 'function' && isRehearsal_());

  let 몸 = '제출 총 ' + 제출 + '건 · 이번에 본 새 제출 ' + 새제출 + '건\n'
    + 'voice_log: ' + 전 + '행 → ' + 후 + '행 (+' + 늘어난 + ')\n\n';

  // 앉지 «못한» 것들을 갈래별로 적는다 — 합계가 안 맞으면 어딘가를 안 센 것이다
  const 빠진것 = [];
  if (결.보류) 빠진것.push('음성 동의가 확인되지 않았다 — ' + 결.보류 + '건 (상담시트 「음성동의」 칸)');
  if (결.무효ID) 빠진것.push('학생ID가 명부(profiles)에 없다 — ' + 결.무효ID + '건');
  if (결.파일빈칸) 빠진것.push('녹음 파일 칸이 비어 있다 — ' + 결.파일빈칸 + '건');
  if (결.ID빈칸) 빠진것.push('학생ID 칸이 비어 있다 — ' + 결.ID빈칸 + '건');

  if (결.결과 === '잠김') {
    몸 += '⏳ 지금은 걷지 않았습니다 — 다른 실행이 이미 걷고 있습니다.\n'
      + '   (밤 11시 배치와 겹쳤거나, 다른 분이 같은 버튼을 눌렀습니다.)\n'
      + '   같은 제출을 두 번 앉히지 않으려고 비켜선 것이라 **아무것도 잃지 않았습니다.**\n'
      + '   1~2분 뒤 다시 누르시면 그쪽이 끝낸 결과가 보입니다.';
  } else if (결.결과 === '헤더없음') {
    몸 += '⛔ 응답 탭에 필요한 칸이 없습니다 — 없는 칸: ' + (결.없는열 || '학생ID 또는 녹음/파일') + '\n\n'
      + '   이건 동의·명부·파일 문제가 «아닙니다». 폼 문항 제목이 바뀌었거나 지워진 것입니다.\n'
      + '   목소리 폼의 문항 제목에 「학생ID」와 「녹음」(또는 「파일」)이 들어가야 이 코드가 그 칸을 찾습니다.\n'
      + '   제목을 되돌리신 뒤 다시 누르세요 — 제출은 그대로 남아 있습니다.';
  } else if (결.결과 === '동의불가') {
    몸 += '🔒 「음성동의」를 읽지 못해 **걷기를 멈췄습니다** — ' + (결.본새제출 || 새제출) + '건 전부 그대로 둡니다.\n\n'
      + '   중요: 표시를 앞으로 옮기지 않았으니 **이 제출들은 사라지지 않았습니다.**\n'
      + '   아래를 고치고 다시 누르시면 그대로 처리됩니다.\n'
      + '   · 상담 스프레드시트에 「음성동의」 칸이 없다 → 메뉴에서 migrateConsentV186 ▶ 를 한 번 누르세요\n'
      + '   · 지금 계정이 상담 스프레드시트를 못 연다 → 원장 계정으로 다시 누르세요';
  } else if (늘어난 > 0) {
    몸 += '✅ ' + 늘어난 + '건이 앉았습니다. voice_log 탭 맨 아래를 열어 보세요.\n'
      + '   전사(옮겨 적기)·성장 카드는 오늘 밤 배치가 이어서 채웁니다.';
    if (빠진것.length) {
      몸 += '\n\n⚠ 다만 ' + (결.본새제출 || 새제출) + '건 중 ' + 늘어난 + '건만 앉았습니다. 나머지는:\n'
        + 빠진것.map(function (s) { return '   · ' + s; }).join('\n');
    }
  } else if (새제출 === 0) {
    몸 += 'ℹ 새 제출이 없습니다 — 마지막으로 걷어온 뒤 추가된 녹음이 없다는 뜻입니다.\n'
      + '   시험해 보시려면 목소리 폼에 하나 제출하고 이 버튼을 다시 누르세요.\n'
      + '   (이미 걷어온 것은 다시 앉지 않습니다 — 그게 정상입니다.)';
  } else if (빠진것.length) {
    몸 += '⚠ 새 제출 ' + (결.본새제출 || 새제출) + '건을 봤는데 하나도 앉지 않았습니다. 까닭은:\n'
      + 빠진것.map(function (s) { return '   · ' + s; }).join('\n') + '\n\n'
      + '   → 자세한 명단은 ' + (리허설 ? '「🧪 리허설 결과·종료」에 적혔습니다.' : '원장 메일함으로 알림이 갔습니다.');
  } else {
    몸 += '⚠ 새 제출 ' + 새제출 + '건을 봤는데 하나도 앉지 않았고, 까닭도 못 짚었습니다.\n'
      + '   이건 «안 재봤다»가 아니라 «아직 모르는 모양»입니다 — 이 화면을 그대로 알려 주세요.\n'
      + '   (실행 로그: 확장 프로그램 ▸ Apps Script ▸ 실행 기록)';
  }

  if (리허설) 몸 += '\n\n🧪 리허설 중이라 메일은 나가지 않았습니다(시트 기록은 평소대로).';
  return 머리 + 몸;
}

// ── A-2. 학생별 미리채움 링크 → profiles '목소리폼URL' 열 ─────────────────
function writeVoiceLinks_(ss) {
  const st = ss.getSheetByName('app_state');
  if (!st) return;
  const tmpl = String(getState(st, '목소리폼URL틀').val || '');
  if (!tmpl) return; // 폼 미연결 — 조용히 대기(다른 기능과 동일한 스위치 원칙)
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return;
  const n = pf.getLastRow() - 1;
  const ids = pf.getRange(2, 1, n, 4).getValues();
  const out = ids.map(r => [(r[0] && r[3] === 'student') ? tmpl.replace(/SIDTOKEN/g, encodeURIComponent(String(r[0]).trim())) : '']);
  const col = tbProfileCol_(pf, '목소리폼URL');
  if (col) writeIfChanged(pf, 2, col, out);
}

/* ── A-2b. [v9.105] 🗑 음성 동의 철회 실행 — 무기한 보관의 **유일한 삭제 트리거** ──────────
 * v9.104가 보관을 무기한으로 바꾸면서 시간 기반 자동 삭제가 사라졌다. 그러면 동의서의
 * "철회하시면 보관 중인 녹음을 모두 삭제합니다"가 **코드로 실행할 수단이 없는 약속**이 된다
 * — 문장이 참이 되려면 지울 수 있어야 한다. 지워야 할 곳은 세 군데다:
 *   ① Drive 원본 파일  ② voice_log 행  ③ profiles 목소리성장카드(첫 목소리 URL이 박혀 있다)
 * 여기에 ④ 상담시트 음성동의를 '아니요'로 되돌려 **다음 제출이 자동 보류**되게 한다
 * (안 되돌리면 지운 그날 밤 스위프가 새 녹음을 다시 적재한다).
 *
 * ⚠ 비가역이므로 **미리보기가 기본**이다. voiceWithdraw('SYNK-001')은 무엇이 지워질지만 보여주고,
 *   실제 실행은 voiceWithdraw('SYNK-001', true). Drive는 완전 삭제가 아니라 휴지통으로 보낸다
 *   (30일 복구 창 — 오판을 되돌릴 수 있고, 30일 뒤 자동 영구 삭제라 약속에도 어긋나지 않는다). */
function voiceWithdraw(studentId, confirm) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sid = String(studentId || '').trim();
  if (!sid) {
    const usage = '사용법: voiceWithdraw("학생ID") → 무엇이 지워질지 미리보기\n' +
      '        voiceWithdraw("학생ID", true) → 실제 삭제(Drive는 휴지통 30일 보관)';
    Logger.log(usage); return usage;
  }
  const vl = ss.getSheetByName('voice_log');
  const rows = (vl && vl.getLastRow() >= 2) ? vl.getRange(2, 1, vl.getLastRow() - 1, 6).getValues() : [];
  const mine = [];
  rows.forEach((r, i) => { if (String(r[0] || '').trim() === sid) mine.push({ row: i + 2, date: r[1], mission: r[2], url: r[3], fid: String(r[4] || '') }); });

  const head = ['🗑 음성 동의 철회 — ' + sid + (confirm === true ? ' (실행)' : ' (미리보기)'),
    '녹음 기록: ' + mine.length + '건'];
  mine.slice(0, 10).forEach(m => head.push('  · ' + (m.date instanceof Date ? Utilities.formatDate(m.date, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : String(m.date)) + ' ' + (m.mission || '')));
  if (mine.length > 10) head.push('  … 외 ' + (mine.length - 10) + '건');

  if (confirm !== true) {
    head.push('', '지울 곳: ①Drive 파일 ' + mine.filter(m => m.fid).length + '개(휴지통) ②voice_log ' + mine.length + '행 ③목소리성장카드 ④상담시트 음성동의 → 「아니요」',
      '', '실제로 지우려면: voiceWithdraw("' + sid + '", true)');
    Logger.log(head.join('\n')); return head.join('\n');
  }

  // [v9.125] 실행 순서 재편: ④동의 되돌리기를 **맨 앞**으로 — 뒤 단계가 예외로 죽어도 재유입(그날 밤 스위프의
  //   재적재)만은 반드시 차단된다. 구 순서(①②③④)는 ③이 던지면 ④가 안 돌아 철회가 조용히 무효화됐다.
  // ④→① 동의를 '아니요'로
  let consentSet = '실패(수기 확인 필요)';
  try {
    const consult = SpreadsheetApp.openById(CONSULT_SHEET_ID).getSheetByName('상담데이터입력');
    const w = consult.getLastColumn();
    const hdr = consult.getRange(2, 1, 1, w).getValues()[0].map(h => String(h || '').trim());
    const ci = hdr.indexOf(CONSENT_EXT_HEADERS[0]), si = hdr.indexOf('학생ID');
    if (ci > -1 && si > -1) {
      const body = consult.getRange(3, 1, consult.getLastRow() - 2, w).getValues();
      let hit = 0;
      body.forEach((r, i) => {
        if (String(r[si] || '').trim() !== sid) return;
        consult.getRange(i + 3, ci + 1).setValue('아니요, 원하지 않습니다'); hit++;
      });
      consentSet = hit ? hit + '행 「아니요」로 변경' : '해당 학생 행 없음(수기 확인)';
    }
  } catch (e) { Logger.log('동의 되돌리기 실패: ' + e); }
  // ② Drive 휴지통 — 실패해도 나머지는 진행한다(파일이 이미 없을 수 있다)
  let trashed = 0, failed = 0;
  mine.forEach(m => {
    if (!m.fid) return;
    try { DriveApp.getFileById(m.fid).setTrashed(true); trashed++; }
    catch (e) { failed++; Logger.log('파일 휴지통 실패(' + m.fid + '): ' + e); }
  });
  // ③ voice_log 행 삭제 — 아래에서 위로 지워야 인덱스가 밀리지 않는다
  mine.map(m => m.row).sort((a, b) => b - a).forEach(r => vl.deleteRow(r));
  /* [v9.241] **의도한 축소이므로 기준선도 내린다** — 안 그러면 주간 워치독이 다음 주부터
   *   「수집 장부가 줄었다」를 매주 외친다. 우리가 시킨 삭제라 따를 처방이 없는 경보다(F103).
   *   데모 퇴장(`wipe`)과 같은 규칙을 이 통로에도 적는다 — 수집 탭에서 **행을 지우는 자리**는
   *   여기와 거기 둘뿐이고, 둘 다 그 자리에서 내린다(①배포 검수 P2 · 723c1d0137a4). */
  if (mine.length) 탭수축기준선지움_('voice_log');
  // ④ 성장 카드 비우기 — 첫 목소리 URL이 카드 HTML에 박혀 있어 지우지 않으면 링크가 남는다.
  //    [v9.125] 헤더만 있는 profiles(getLastRow()=1) 가드 — getRange(2,1,0,1) 예외가 뒤 단계를 죽이던 구멍
  const pf = ss.getSheetByName('profiles');
  const col = pf ? tbProfileCol_(pf, '목소리성장카드') : 0;
  if (pf && col && pf.getLastRow() >= 2) {
    const ids = pf.getRange(2, 1, pf.getLastRow() - 1, 1).getValues();
    ids.forEach((r, i) => { if (String(r[0] || '').trim() === sid) pf.getRange(i + 2, col).clearContent(); });
  }

  head.push('', '✅ Drive 휴지통 ' + trashed + '개' + (failed ? ' (실패 ' + failed + ')' : '') +
    ' · voice_log ' + mine.length + '행 삭제 · 성장 카드 초기화 · 동의: ' + consentSet,
    'ⓘ Drive 휴지통은 30일 뒤 자동 영구 삭제됩니다(그 전엔 복구 가능).');
  const msg = head.join('\n');
  Logger.log(msg);
  adminMail('[SYNK] 🗑 음성 동의 철회 처리 — ' + sid, msg);
  return msg;
}

/* [v9.125] 🗑 철회 무인자 진입점 — voiceWithdraw는 인자 2개라 편집기 ▶·시트 메뉴에서 실행할 수 없어,
 * 「철회 약속」이 비개발자 운영에선 코드 편집 없이는 이행 불가였다(v9.105가 고치려던 결함의 실행 계층 재현).
 * UI 프롬프트 2단계: ①학생ID 입력 → 미리보기 표시 ②확인 문구 「삭제」 입력 시에만 실행. */
function voiceWithdrawPrompt() {
  const ui = SpreadsheetApp.getUi();
  const a = ui.prompt('🗑 음성 동의 철회', '철회할 학생ID를 입력하세요 (예: SYNK-001)', ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK) return;
  const sid = String(a.getResponseText() || '').trim();
  if (!sid) { ui.alert('학생ID가 비어 있습니다.'); return; }
  const preview = voiceWithdraw(sid);
  const b = ui.prompt('미리보기 — 아래 내용을 확인하세요', preview + '\n\n실제로 삭제하려면 「삭제」라고 입력하세요.', ui.ButtonSet.OK_CANCEL);
  if (b.getSelectedButton() !== ui.Button.OK || String(b.getResponseText() || '').trim() !== '삭제') {
    ui.alert('취소했습니다 — 아무것도 지워지지 않았습니다.'); return;
  }
  ui.alert(voiceWithdraw(sid, true));
}

/* ═══════════ [v9.107] 🎧 STT — GCP Speech-to-Text 전사 (유호님 08-01 결정) ═══════════
 * 녹음 AI 첨삭의 마지막 빠진 조각. Claude API는 오디오를 받지 않으므로 음성→텍스트가 먼저 필요하다.
 *
 * ▣ 왜 서비스 계정인가 (매니페스트를 건드리지 않는 유일한 길)
 *   Speech-to-Text는 `cloud-platform` 스코프 토큰을 요구한다. `ScriptApp.getOAuthToken()`으로 그걸
 *   받으려면 appsscript.json에 oauthScopes를 명시해야 하는데, **그 순간 자동 추론이 꺼진다** —
 *   현재 이 프로젝트는 스코프를 한 줄도 적지 않고 추론에 맡기고 있어(SpreadsheetApp·DriveApp·FormApp·
 *   DocumentApp·MailApp·ScriptApp·UrlFetchApp·Session) 하나라도 빠뜨리면 트리거 10개가 한 번에 죽는다.
 *   서비스 계정 JWT는 UrlFetchApp만 쓰므로(이미 있는 권한) **라이브 리스크가 0**이다.
 *   ⓘ 나중에 매니페스트 스코프를 정리하기로 하면 그때 getOAuthToken 경로로 바꿔도 된다(아래 폴백 유지).
 *
 * ▣ 알려진 제약 — 지어내지 않고 실패를 그대로 기록한다
 *   ① 동기 recognize는 짧은 오디오용이다(대략 1분). 초과분은 API가 거부하고, 그 사유를 상태 열에 남긴다.
 *   ② 인라인 base64라 요청 크기 한도가 있다 — 10MB 넘는 파일은 보내기 전에 거른다.
 *   ③ 인코딩: m4a(AAC)는 지원 목록에 없다. 폰 녹음이 m4a로 오면 여기서 걸린다 —
 *      MIME으로 먼저 거르고, 나머지는 encoding을 지정하지 않고 보내 API의 헤더 자동 인식에 맡긴다.
 *      실제 어느 포맷이 들어오는지는 첫 실측 전엔 알 수 없으므로 **상태 열에 원문 오류를 남겨** 판단 재료로 쓴다.
 *   ④ 유료 API다. 일일 상한(STT_DAILY_CAP)으로 폭주를 막고, 초과분은 다음 날로 미룬다. */
const STT_LANG = 'ko-KR';
/* [v9.277] 요청 모델을 상수로 올린다 — 전에는 요청부에 `'default'` 리터럴로만 있었다.
 * 왜 올렸나: 이 값이 이제 **두 곳에서 쓰인다**(요청 config · voice_log 「전사엔진판」 기록).
 *   같은 값을 두 곳이 각자 알면 반드시 갈리고, 갈리면 «장부가 거짓말을 한다» — 모델을 바꿔도
 *   기록엔 옛 이름이 남아, 「발음이 좋아졌다」와 「모델이 바뀌었다」를 가르려던 그 칸이 무용지물이 된다. */
const STT_MODEL = 'default';
const STT_DAILY_CAP = 30;                 // 하루 전사 상한 — 비용 폭주 방어(지출 2게이트 원칙)
const STT_MAX_BYTES = 10 * 1024 * 1024;   // 인라인 요청 한도
const STT_OK_MIME = ['audio/flac', 'audio/x-flac', 'audio/wav', 'audio/x-wav', 'audio/wave',
  'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/webm', 'audio/amr', 'audio/3gpp'];
/* [v9.187] '급수'(맨 끝) — 녹음 시점의 학생 급수 스냅샷(제품방향 §불변식 2 「학생·레벨·시점」의 레벨 축).
 *   발음 데이터는 급수 층이 없으면 "초급의 더듬거림"과 "고급의 남은 억양"이 한 덩어리로 섞인다.
 * [v9.190] '미션ID'(맨 끝) — 과업 축(유호님 승인 08-06 · 스키마 감사 잔여 1건).
 *   '미션'은 자유 문자열이라 같은 과제가 다섯 표기로 쌓인다 — "무엇을 읽었을 때의 발음인가"로 묶을 수가 없다.
 *   맨 끝 증분이라 앞을 읽는 소비처(전사 7~9열·삭제 6열·점검 8열)는 전부 그대로다. */
// [v9.239] VOICE_LOG_HEADERS 정본은 엔진_셋업확장.js(골격 곁)로 이사 — 수집면 출생 단일화로 골격이
//   이 헤더를 참조하게 됐는데, 이 파일은 ENGINE_FILES(테스트 하네스·filePushOrder 선두 고정) 밖이라
//   정본이 엔진 쪽에 살아야 한다. 여기 쓰임(ensureSheet·헤더보정_)은 런타임 호출이라 로드 순서 무관.

/* GCP 액세스 토큰 — ①서비스 계정(GCP_SA_JSON) ②없으면 스크립트 자체 토큰(매니페스트에 스코프를 넣은 경우).
 * 토큰은 1시간짜리라 캐시에 50분 보관한다(매 파일마다 토큰 발급하면 그 자체가 쿼터·지연이다). */
function gcpAccessToken_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('GCP_TOKEN');
  if (hit) return hit;
  const raw = PropertiesService.getScriptProperties().getProperty('GCP_SA_JSON');
  if (!raw) {
    try { return ScriptApp.getOAuthToken(); } catch (e) { return null; } // 스코프 미명시면 Speech가 403을 준다
  }
  let sa;
  try { sa = JSON.parse(raw); } catch (e) { throw new Error('GCP_SA_JSON 파싱 실패 — 서비스 계정 JSON 전체를 그대로 붙여넣으세요'); }
  if (!sa.client_email || !sa.private_key) throw new Error('GCP_SA_JSON에 client_email/private_key가 없습니다');
  const now = Math.floor(Date.now() / 1000);
  const b64 = o => Utilities.base64EncodeWebSafe(JSON.stringify(o)).replace(/=+$/, '');
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const claim = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now });
  const sig = Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(head + '.' + claim, sa.private_key)).replace(/=+$/, '');
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + claim + '.' + sig }
  });
  if (res.getResponseCode() !== 200) throw new Error('토큰 발급 실패 ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  const tok = JSON.parse(res.getContentText()).access_token;
  if (tok) cache.put('GCP_TOKEN', tok, 3000);
  return tok;
}

/* 파일 1개 전사 — 성공 시 {text}, 실패 시 {err} (throw하지 않는다: 한 건 실패가 배치를 멈추면 안 된다)
 * [2026-08-29] 나가는 것은 **학생 음성 원본 바이트 전량**이라 sid 를 함께 받는다 — 아래 `stt요청_` 이
 *   그 sid 로 동의를 **보내기 직전에** 다시 확인한다. sid 없이 부르면 그 통로가 던진다. */
function sttOne_(fileId, token, sid) {
  let blob;
  try { blob = DriveApp.getFileById(fileId).getBlob(); }
  catch (e) { return { err: '파일 접근 불가: ' + String(e).slice(0, 80) }; }
  const mime = String(blob.getContentType() || '').toLowerCase();
  if (mime && STT_OK_MIME.indexOf(mime) === -1) return { err: '미지원 포맷(' + mime + ') — m4a/AAC는 Speech-to-Text가 받지 않습니다' };
  const bytes = blob.getBytes();
  if (bytes.length > STT_MAX_BYTES) return { err: '파일 초과(' + Math.round(bytes.length / 1024 / 1024) + 'MB > 10MB) — 짧게 재녹음 필요' };
  const 응답 = stt요청_({
    token: token, sid: sid,
    // encoding·sampleRate는 지정하지 않는다 — 헤더가 있는 포맷은 API가 스스로 읽고,
    // 잘못 지정하면 오히려 인식이 깨진다. 못 읽는 포맷은 그 사유가 응답에 그대로 온다.
    config: { languageCode: STT_LANG, enableAutomaticPunctuation: true, model: STT_MODEL },
    content: Utilities.base64Encode(bytes)
  });
  if (!응답.res) return 응답;                              // 보류(동의 미확인·토큰 없음) — 아무것도 안 나갔다
  const res = 응답.res;
  const code = res.getResponseCode();
  const body = res.getContentText();
  // [v9.125] systemic 플래그 — 401/403/429/5xx는 파일이 아니라 계정·설정·쿼터 문제라, 행에 낙인을 찍으면
  //   설정을 고쳐도 전 행을 손으로 되살려야 한다. 배치가 이 플래그를 보고 행을 '대기'로 남기고 즉시 중단한다.
  if (code !== 200) return { err: 'API ' + code + ': ' + body.replace(/\s+/g, ' ').slice(0, 200), systemic: (code === 401 || code === 403 || code === 429 || code >= 500) };
  let j;
  try { j = JSON.parse(body); } catch (e) { return { err: '응답 파싱 실패' }; }
  const alts = (j.results || []).map(r => (r.alternatives || [])[0] || {});
  const text = alts.map(a => a.transcript || '').join(' ').trim();
  if (!text) return { err: '인식 결과 없음(무음·잡음·언어 불일치 가능)' };
  /* [v9.277] 같은 응답에 이미 들어 있던 둘을 이제 버리지 않는다 — 규격 = docs/발음데이터_규격.md.
   *   ㉠ conf — 구간이 여럿이면 **가장 낮은 값**을 쓴다. 평균은 잘 읽힌 구간이 못 읽힌 구간을 덮어
   *     「전체적으로 괜찮았다」로 만드는데, 우리가 찾는 것은 정확히 그 «못 읽힌 구간»이다
   *     (원어민 모델의 낮은 신뢰도 = 비원어민 발음의 싼 대리 신호).
   *     값이 아예 안 오면 0 이 아니라 '' 다 — 0 은 「아주 나쁘게 인식됨」이고 '' 는 「안 왔다」다.
   *   ㉡ engine — GCP 는 «실제로 서빙된» 모델 판을 안 돌려준다. 그래서 이것은 「우리가 무엇을 요청했나」의
   *     기록이다. 우리가 모델을 바꾼 것은 잡지만, 구글이 같은 이름 뒤에서 조용히 갱신한 것은 **못 잡는다.**
   *     그 한계를 여기 적어 둔다 — 안 적으면 다음 사람이 이 칸을 「서빙 판」으로 읽는다. */
  const confs = alts.map(a => a.confidence).filter(c => typeof c === 'number' && isFinite(c));
  return {
    text: text,
    conf: confs.length ? Math.min.apply(null, confs) : '',
    engine: 'gcp-stt:' + STT_MODEL + ':' + STT_LANG
  };
}

/* ══════════════════════════════════════════════════════════════════════
 * 🔒 STT 단일 통로 [2026-08-29] — 학생 음성이 학원 밖으로 나가는 **유일한 문**
 * ══════════════════════════════════════════════════════════════════════
 * ■ 왜 하나로 묶었나
 *   `speech.googleapis.com` 호출이 이 파일에 **2자리**였다(실측 08-29): 실오디오(sttOne_)와
 *   빈 오디오 진단(voiceSttStatus). 문이 둘이면 게이트를 «둘 다» 걸어야 하고, 실제로 둘 중
 *   하나에만 걸린 채로 살았던 전례가 이 레일에 이미 두 번 있다(v9.104 적재 게이트 → v9.125 전사 게이트).
 *   나가는 문을 하나로 모으면 **다음에 생기는 세 번째 소비자가 게이트를 우회할 방법이 없다.**
 *
 * ■ 이 문이 실제로 막는 것 — 「보내기 직전」 동의 재확인
 *   구조상 적재(voiceSweep_ · 폼 제출 직후)와 전사(교재연동Nightly · 23시)는 **몇 시간 떨어져 있다.**
 *   그 사이 철회(voiceWithdraw)가 있으면 적재 시점의 판정은 이미 낡았다.
 *   ⚠ 정정 — 이 구멍은 v9.125 가 이미 절반 닫아 두었다: `voiceTranscribe_` 는 배치 «시작»에
 *     동의 맵을 다시 읽는다. 남아 있던 것은 **배치 시작 ~ 그 학생 차례** 사이(파일 30개면 수 분)와,
 *     「전사 함수를 안 거치고 sttOne_ 을 직접 부르는 새 소비자」다. 이 문이 그 둘을 닫는다.
 *
 * ■ fail-closed 세 겹 (기존 설계 결을 깨지 않는다)
 *   ① 동의맵이 null(시트·열 접근 실패) → **전원 보류**. 판정 불가는 통과가 아니다(v9.104 원칙 그대로).
 *   ② 'yes' 가 아니면(거부·미응답) 보류. 행에 실패 낙인을 **안 찍는다** — 동의가 확인되면 다음 밤 자동 재개.
 *   ③ 🔴 **sid 없이 오디오를 못 보낸다.** 진단(빈 오디오)만 sid 없이 지날 수 있다.
 *      그래서 「sid 를 안 넘기면 게이트가 조용히 꺼지는」 경로가 원리상 없다 — 던진다.
 *
 * ■ 대가(정직히)
 *   동의맵을 매 파일마다 새로 읽으면 상담시트를 열흘 안에 30번 여는 셈이라 6분 실행 한도를 건드린다.
 *   그래서 **60초 TTL 캐시**를 둔다 — 「직전」의 실제 뜻은 «60초 이내»다. 적재↔전사의 몇 시간을
 *   60초로 줄인 것이지 0으로 만든 것이 아니다. 0이 필요하면 TTL 을 0으로 두면 되고, 그 대가는 시간이다.
 *
 * ⚠ 이 함수의 «자리»는 `sttOne_` 과 아래 A-2c 절 표식 사이여야 한다 — `tests/발화퀄리티.test.js`
 *   의 「보낼 수 없는 파일은 API에 닿기 전에 거른다」가 그 구간을 잘라 `speech:recognize` 를 찾는다.
 *   위로 옮기면 그 검사가 표식을 잃고 **오탐으로 죽는다**(구간 검사의 알려진 취약점 — tests/_engine-source.js 머리말).
 *
 * 🔴 [08-30 실측 · 이 주석이 스스로 낸 사고] 이 경고문이 처음엔 그 절 표식을 **글자 그대로** 인용했다.
 *   그러자 그 인용이 파일에서 «첫 번째» 표식이 되어, 위 검사의 `indexOf` 가 진짜 절보다 2119자 앞에서
 *   구간을 잘랐다 → `speech:recognize` 를 못 찾아 `call = -1`, 그런데 판정식이 `gate < call` 이라
 *   **「게이트가 호출보다 뒤에 있다」는 엉뚱한 사유로 빨개졌다**(node --test 실측 · 917건 중 유일한 빨강).
 *   ⇒ 구간 표식은 주석에서도 **글자 그대로 쓰지 않는다.** 표식을 말해야 하면 이 줄처럼 풀어서 쓴다.
 *
 * 🔴 [08-30 정정 — 위 사고를 진단한 첫 문장이 틀렸다] 여기엔 *"같은 구간을 `tests/반출통로.test.js`
 *   도 자르는데 그쪽은 주석을 걷어낸 소스를 봐서 초록이었다"* 라고 적혀 있었다. **그게 아니다.**
 *   그쪽이 초록이던 진짜 까닭은 「제대로 쟀다」가 아니라 **「끝 표식을 못 찾아 구간이 파일 끝까지
 *   통째로 벌어져 있었다」**다 — 주석을 걷어낸 소스에는 그 절 표식 문자열이 «아예 없어서»
 *   `indexOf` 가 -1 을 줬고, `slice(시작, -1)` 은 오류가 아니라 파일 끝까지를 준다.
 *   실측: 이 함수 구간이라 믿던 것이 22,689자였다(진짜 본문은 920자). 그래서 그 파일의
 *   `throw new Error` 단언은 **빈 단언**이었다. 08-30 에 그쪽 구간 자르기를 함수 선언 기준으로
 *   바꾸고 «못 찾으면 던지게» 고쳤다. 교훈은 「자가 둘이면 갈린다」가 아니라
 *   **「초록은 잰 것과 못 잰 것을 구별해 주지 않는다」**다. */
const STT_동의TTL_ = 60 * 1000;   // ms — 위 「대가」 절 참조
let _음성동의캐시_ = null;         // { at:number, map:Object|null } — 실행 1회 수명

/** 동의 맵 — 이 파일에서 동의를 읽는 **유일한 통로**(같은 판정을 두 곳에서 읽으면 갈라진다).
 *  @returns {Object|null} sid→'yes'|'no'|'' · null 이면 **확인 불가(보류)** */
function stt동의맵_(강제) {
  const now = Date.now();
  if (강제 || !_음성동의캐시_ || (now - _음성동의캐시_.at) > STT_동의TTL_) {
    _음성동의캐시_ = { at: now, map: (typeof voiceConsentMap_ === 'function') ? voiceConsentMap_() : null };
  }
  return _음성동의캐시_.map;
}

/** 한 학생의 동의 상태 — null 이면 확인 불가(보류). */
function stt동의재확인_(sid) {
  const m = stt동의맵_();
  if (m === null) return null;
  return String(m[String(sid).trim()] || '');
}

/** 🔒 Speech-to-Text 호출 — 이 저장소에서 학생 음성이 밖으로 나가는 유일한 자리.
 *  @param {{token:string, config:Object, content:string, sid?:string}} opt
 *  @returns {{res:Object}|{err:string, 보류:boolean}}  res 가 없으면 **아무것도 안 나갔다**
 */
function stt요청_(opt) {
  const o = opt || {};
  const 오디오 = String(o.content == null ? '' : o.content);
  const sid = String(o.sid == null ? '' : o.sid).trim();
  // ③ sid 없이 학생 오디오는 못 나간다. 진단(빈 오디오)만 예외 — 실을 학생 데이터가 없다.
  if (오디오 && !sid) throw new Error('stt요청_: sid 없이 오디오를 보낼 수 없다 — 동의를 확인할 대상이 없는 호출이다');
  if (sid) {
    const 상태 = stt동의재확인_(sid);
    if (상태 === null) return { err: '음성 동의 확인 불가 — 보류(전송 0)', 보류: true };   // ①
    if (상태 !== 'yes') return { err: '음성 동의 ' + (상태 === 'no' ? '거부' : '미응답') + ' — 보류(전송 0)', 보류: true }; // ②
  }
  if (!o.token) return { err: 'STT 토큰 없음 — 보류(전송 0)', 보류: true };
  const res = UrlFetchApp.fetch('https://speech.googleapis.com/v1/speech:recognize', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + o.token },
    payload: JSON.stringify({ config: o.config || { languageCode: STT_LANG }, audio: { content: 오디오 } })
  });
  return { res: res };
}

// ── A-2c. voice_log 미전사 행 → STT (교재연동Nightly 편승) ──────────────
function voiceTranscribe_(ss) {
  const vl = ss.getSheetByName('voice_log');
  if (!vl || vl.getLastRow() < 2) return;
  // 열 확장 — 구 6열 시트도 그대로 살아야 하므로 헤더를 보장하고 나서 읽는다([v9.187] 공용 치유로 통일 — 로직 두 벌 방지)
  헤더보정_(vl, VOICE_LOG_HEADERS);

  const tz = ss.getSpreadsheetTimeZone();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const usedRaw = String(getState(st, 'STT일일사용').val || '');
  const used = (usedRaw.split('|')[0] === today) ? (Number(usedRaw.split('|')[1]) || 0) : 0;
  let budget = STT_DAILY_CAP - used;
  if (budget <= 0) return;                                   // 오늘 몫 소진 — 내일 이어서

  // [v9.125] 🔒 동의 게이트 — 동의 문구가 보호하는 대상은 "목소리와 **그것을 글로 옮긴 기록**"인데,
  //   전사(외부 GCP 전송)만 게이트 밖이었다(v9.104 게이트 뒤에 생긴 소비자가 자동으로 구멍이 되는 구조).
  //   v9.104 이전에 무동의로 적재된 행도 여기서 걸러진다. 맵 실패(null)는 배치 전체 보류 — 판정 불가는 통과가 아니다.
  //   [2026-08-29] 읽는 통로를 `stt동의맵_` 하나로 모았다 — 같은 판정을 두 곳이 각자 읽으면 갈라진다.
  //   여기 것은 **예산 절약용 사전 거르기**이고, 못 넘는 최종 게이트는 `stt요청_` 이다(보내기 직전 재확인).
  const consent = stt동의맵_(true);   // 배치 시작 = 새로 읽는다
  if (consent === null) { Logger.log('🎧 전사 보류 — 음성 동의 맵을 읽지 못했다(판정 불가는 보류)'); return; }

  const n = vl.getLastRow() - 1;
  const rows = vl.getRange(2, 1, n, VOICE_LOG_HEADERS.length).getValues();
  const todo = [];
  let noConsent = 0;
  rows.forEach((r, i) => {
    if (String(r[6] || '').trim()) return;                   // 이미 전사됨
    const state = String(r[7] || '').trim();
    if (state && state !== '대기') return;                   // 실패 사유가 있는 행은 자동 재시도하지 않는다(같은 오류로 과금 반복)
    if (!String(r[4] || '').trim()) return;                  // file_id 없음
    const sid = String(r[0] || '').trim();
    if (consent[sid] !== 'yes') { noConsent++; return; }     // [v9.125] 동의 확인 안 된 행은 전사하지 않는다(행은 '대기' 유지 — 동의가 확인되면 다음 밤 자동 진행)
    todo.push({ row: i + 2, fid: String(r[4]).trim(), sid: sid });
  });
  if (noConsent) Logger.log('🎧 전사 보류 ' + noConsent + '행 — 음성 동의 미확인(동의 확인 시 자동 재개)');
  if (!todo.length) return;

  let token;
  try { token = gcpAccessToken_(); }
  catch (e) {
    adminMail('[SYNK] 🎧 STT 토큰 실패 — 전사 보류', String(e) + '\n\nvoiceSttStatus() ▶ 로 설정 상태를 확인하세요.');
    return;
  }
  if (!token) { adminMail('[SYNK] 🎧 STT 미설정 — 전사 보류', 'GCP_SA_JSON 스크립트 속성이 없습니다. docs/STT_설치_v9107.md의 STEP 1~3을 따르세요.'); return; }

  // [v9.125] 리허설 게이트 — 유료 외부 API. 대기량만 보고하고 아무것도 보내지 않는다.
  if (typeof isRehearsal_ === 'function' && isRehearsal_()) {
    if (typeof rehearsalNote_ === 'function') rehearsalNote_('STT 전사: 대기 ' + todo.length + '건 전량 차단(비용 0)');
    return;
  }

  let ok = 0, fail = 0, aborted = '';
  let 보류 = 0;                                              // [08-29] 문 앞에서 되돌아온 건수(전송 0)
  const errSample = [];
  /* 🔴 [08-30] 보류 표본을 실패 표본과 **가른다.** 첫 판은 둘을 같은 `errSample` 에 담았는데,
   *   그 칸은 메일에서 「실패 사유」로 찍히고 그 아래에 *"실패 행은 자동 재시도하지 않습니다 —
   *   「전사상태」 칸을 비우면 다시 시도합니다"* 가 붙는다. 보류 행은 **정반대**다(상태칸이 '대기'
   *   그대로라 다음 밤 자동 재개 · 비울 칸이 애초에 없다). 유호님을 없는 칸으로 보내는 안내였다.
   *   덤으로 보류 다섯이 표본을 채우면 **진짜 실패 사유가 메일에서 사라진다** — 5칸을 나눠 갖는다. */
  const 보류표본 = [];
  const batch = todo.slice(0, budget);
  for (let bi = 0; bi < batch.length; bi++) {
    const t = batch[bi];
    const r = sttOne_(t.fid, token, t.sid);
    const stamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm');
    /* [2026-08-29] 보류 = 「보내기 직전 동의 재확인」이 되돌린 건. 행에 실패 낙인을 **안 찍는다** —
     *   찍으면 동의를 되찾아도 사람이 손으로 칸을 비워야 재개된다(v9.125 가 systemic 에서 배운 것과 같은 축). */
    if (r.보류) { 보류++; if (보류표본.length < 5) 보류표본.push(t.sid + ' — ' + r.err); continue; }
    if (r.text) {
      vl.getRange(t.row, 7, 1, 3).setValues([[r.text, '완료', stamp]]);
      /* [v9.277] 관측 장치를 전사와 «같은 순간에» 적는다 — 규격 = docs/발음데이터_규격.md.
       * 두 칸은 정본에서 나란히 붙어 있어 한 번에 쓴다. 열 번호는 손으로 안 적는다(v9.119 교훈 — 위치 상수는 갈린다).
       * ⚠ 정본에 칸이 없으면(옛 시트 폭) 조용히 건너뛴다 — 전사 자체를 실패로 만들지 않는다.
       *   헤더보정_ 가 다음 스위프에서 폭을 맞추므로 그때부터 채워진다. */
      const c신뢰 = (typeof voiceCol_ === 'function') ? voiceCol_('전사신뢰도') : 0;
      const c엔진 = (typeof voiceCol_ === 'function') ? voiceCol_('전사엔진판') : 0;
      if (c신뢰 && c엔진 === c신뢰 + 1 && vl.getLastColumn() >= c엔진) {
        vl.getRange(t.row, c신뢰, 1, 2).setValues([[r.conf === undefined ? '' : r.conf, r.engine || '']]);
      }
      ok++;
    }
    else if (r.systemic) {
      // [v9.125] 계정·설정·쿼터 오류(401/403/429/5xx) — 행에 낙인을 찍지 않고('대기' 유지) 배치를 즉시 중단.
      //   구 코드는 설정 실수 하나로 그날 대기 전 행이 '실패:'로 영구 낙인돼 수기 복구가 필요했다.
      aborted = r.err;
      break;
    }
    else { vl.getRange(t.row, 7, 1, 3).setValues([['', '실패: ' + r.err, stamp]]); fail++; if (errSample.length < 5) errSample.push(t.sid + ' — ' + r.err); }
  }
  setState(st, 'STT일일사용', today + '|' + (used + ok + fail + (aborted ? 1 : 0)));
  if (aborted) {
    adminMail('[SYNK] 🎧 STT 전사 중단 — 계정·설정 문제(행 낙인 없음)',
      '오류: ' + aborted + '\n\n파일이 아니라 계정·API·쿼터 쪽 문제라 대기 행을 그대로 두고 중단했습니다.\n' +
       'voiceSttStatus() ▶ 로 원인을 확인해 고치면 다음 밤에 자동 재개됩니다(수기 복구 불필요).');
    return;
  }
  if (보류) Logger.log('🎧 전사 보류 ' + 보류 + '건 — 보내기 직전 동의 재확인에서 되돌아왔다(전송 0 · 행은 대기 유지)');
  if (ok || fail || 보류) adminMail('[SYNK] 🎧 목소리 전사 ' + ok + '건' + (fail ? ' · 실패 ' + fail + '건' : '') + (보류 ? ' · 보류 ' + 보류 + '건' : ''),
    '전사 완료 ' + ok + '건, 실패 ' + fail + '건, 보류 ' + 보류 + '건 (오늘 사용 ' + (used + ok + fail) + '/' + STT_DAILY_CAP + ')\n' +
    (보류 ? '\n※ 보류 = 보내기 «직전» 동의 재확인에서 되돌린 건입니다(외부로 나간 것 0 · 행은 대기 유지 — 동의가 확인되면 다음 밤 자동 재개).\n' +
      '   손댈 것이 없습니다 — 실패와 달리 「전사상태」 칸을 비울 필요가 없습니다(칸이 이미 대기입니다).\n' +
      (보류표본.length ? '   보류 사유(최대 5건):\n' + 보류표본.map(function (s) { return '   · ' + s; }).join('\n') + '\n' : '') : '') +
    (errSample.length ? '\n실패 사유(최대 5건):\n' + errSample.join('\n') +
      '\n\n※ 실패 행은 자동 재시도하지 않습니다(같은 오류로 과금이 반복되므로). 원인을 고친 뒤 voice_log의 「전사상태」 칸을 비우면 다음 밤에 다시 시도합니다.' : ''));
}

/* [v9.107] STT 설정 진단 — "왜 전사가 안 되지"를 추측이 아니라 실측으로 답한다.
 * 실제로 1바이트짜리 요청을 보내 응답 코드를 그대로 보여준다(권한·API 활성화·결제 문제가 여기서 갈린다). */
function voiceSttStatus() {
  const L = ['🎧 STT 설정 진단'];
  const raw = PropertiesService.getScriptProperties().getProperty('GCP_SA_JSON');
  L.push('1) 서비스 계정 키(GCP_SA_JSON): ' + (raw ? '있음' : '없음 — 스크립트 속성에 추가 필요'));
  let token = null;
  try { token = gcpAccessToken_(); L.push('2) 액세스 토큰: ' + (token ? '발급 성공' : '발급 실패(null)')); }
  catch (e) { L.push('2) 액세스 토큰: ❌ ' + String(e).slice(0, 200)); }
  if (token) {
    /* 빈 오디오로 호출 — 400이면 인증·API는 정상(요청 내용만 문제), 403이면 권한·활성화 문제.
     * [2026-08-29] 이 진단도 **같은 문**(stt요청_)으로 나간다 — 문이 둘이면 다음 게이트가 한쪽에만 걸린다.
     *   sid 를 안 넘기므로 그 문은 `content` 가 빈 값일 때만 이 호출을 통과시킨다(학생 데이터 0의 기계적 보증). */
    const 응답 = stt요청_({ token: token, config: { languageCode: STT_LANG }, content: '' });
    const res = 응답.res;
    const c = res.getResponseCode();
    L.push('3) Speech API 응답: ' + c + (c === 400 ? ' ✅ (인증·API 정상 — 빈 오디오라 400이 정상 응답)'
      : c === 403 ? ' ❌ API 미활성화이거나 서비스 계정에 권한이 없습니다'
      : c === 401 ? ' ❌ 토큰이 거부됐습니다' : ''));
    if (c !== 400) L.push('   응답 원문: ' + res.getContentText().replace(/\s+/g, ' ').slice(0, 300));
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const vl = ss.getSheetByName('voice_log');
  if (vl && vl.getLastRow() >= 2 && vl.getLastColumn() >= 8) {
    const rows = vl.getRange(2, 1, vl.getLastRow() - 1, 8).getValues();
    const done = rows.filter(r => String(r[6] || '').trim()).length;
    const failed = rows.filter(r => String(r[7] || '').indexOf('실패') === 0).length;
    L.push('4) voice_log: 전체 ' + rows.length + '행 · 전사 완료 ' + done + ' · 실패 ' + failed + ' · 대기 ' + (rows.length - done - failed));
    rows.filter(r => String(r[7] || '').indexOf('실패') === 0).slice(0, 3)
      .forEach(r => L.push('   실패 예: ' + r[0] + ' — ' + r[7]));
  } else L.push('4) voice_log: 없음 또는 비어 있음(전사할 대상 0)');
  const msg = L.join('\n');
  Logger.log(msg);
  return msg;
}

// ── A-3. 성장 카드(처음 vs 최신, 간격 21일+) → profiles '목소리성장카드' 열 ──
function buildVoiceGrowthCards_(ss) {
  const vl = ss.getSheetByName('voice_log');
  const pf = ss.getSheetByName('profiles');
  if (!vl || !pf || vl.getLastRow() < 2 || pf.getLastRow() < 2) return;
  const tz = ss.getSpreadsheetTimeZone();
  const byStu = {}; // sid → {first:{t,url,mission,text}, last:{...}, cnt}
  // [v9.107] 폭을 전사 열까지 넓힌다 — 구 6열 시트도 살아야 하므로 실제 폭 기준(없는 칸은 undefined→'')
  const wV = Math.max(vl.getLastColumn(), 4);
  vl.getRange(2, 1, vl.getLastRow() - 1, wV).getValues().forEach((r, i) => {
    const sid = String(r[0] || '').trim();
    if (!sid || !r[1] || !r[3]) return;
    const t = asDate_(r[1]).getTime();
    // [v9.277] 행 번호를 들고 간다 — 카드가 실제로 «어느 행»을 학생에게 보여줬는지 뒤에서 도장 찍는다(Ⅰ-5 넷째 칸)
    const rec = { t: t, row: i + 2, url: String(r[3]), mission: String(r[2] || ''), text: String(r[6] || '').trim() };
    const s = byStu[sid] = byStu[sid] || { cnt: 0 };
    s.cnt++;
    if (!s.first || t < s.first.t) s.first = rec;
    if (!s.last || t >= s.last.t) s.last = rec;
  });
  const n = pf.getLastRow() - 1;
  const ids = pf.getRange(2, 1, n, 1).getValues();
  const 닿은행 = {};   // [v9.277] 카드에 실제로 실린 voice_log 행 — 아래에서 「돌려준날」 도장을 찍는다
  const out = ids.map(r => {
    const s = byStu[String(r[0] || '').trim()];
    if (!s || s.cnt < 2) return [''];
    const days = Math.round((s.last.t - s.first.t) / 86400000);
    if (days < TB_GROWTH_MIN_DAYS) return [''];
    닿은행[s.first.row] = 1; 닿은행[s.last.row] = 1;
    const d1 = Utilities.formatDate(new Date(s.first.t), tz, 'M/d');
    const d2 = Utilities.formatDate(new Date(s.last.t), tz, 'M/d');
    /* [v9.107] 전사문 병기 — 목소리 타임랩스는 여태 "듣기 링크 두 개"였다. 링크는 눌러야 비교되고,
     *   두 파일을 번갈아 듣는 사람은 거의 없다. 전사문이 있으면 **눈으로 한 번에 대비**된다
     *   ("처음엔 이렇게 말했고, 오늘은 이렇게 말한다") — STT가 성장 서사에 실제로 값을 내는 지점.
     *   전사가 없는 구간(미설정·실패·포맷 미지원)에서는 그 줄만 조용히 빠지고 카드는 그대로 산다. */
    /* [v9.155] 🔒 `[듣기](url)` 링크 제거 — 그 URL이 곧 공개 링크였다(위 voiceSweep_ 참조).
     *   v9.107이 전사문을 넣으며 적은 판단이 이 제거의 근거다: **값은 재생이 아니라 대비**이고,
     *   전사문이 그 대비를 눈으로 한 번에 보여준다. 링크를 빼도 카드의 값은 그대로 남는다.
     *   ⚠ 전사가 아직 없는 구간(STT 미설정·실패)에서는 날짜·미션만 남는다 — 그래도 「며칠의 거리」는 산다. */
    const q = (t) => t ? '\n> “' + (t.length > 140 ? t.slice(0, 140) + '…' : t) + '”' : '';
    return ['## 🎧 나의 목소리 타임랩스\n\n' +
      '**' + d1 + ' 처음의 나**' + (s.first.mission ? ' · ' + s.first.mission : '') + q(s.first.text) + '\n\n' +
      '**' + d2 + ' 오늘의 나**' + (s.last.mission ? ' · ' + s.last.mission : '') + q(s.last.text) + '\n\n' +
      days + '일의 거리만큼 목소리가 자랐어요. 다음 무대에서 또 만나요! 🎤'];
  });
  const col = tbProfileCol_(pf, '목소리성장카드');
  if (col) writeIfChanged(pf, 2, col, out);

  /* [v9.277] 🎯 철학 Ⅰ-5 넷째 칸「누구에게」를 **처음으로 재는 자리**(유호 판정 08-31).
   * 그 조항이 남긴 실측이 「자동 발송 53 자리 중 재학생 본인에게 가는 것 0」이었고, 조항 스스로
   * 「이 칸을 세는 자는 아직 없다 · 자를 세울지는 유호님 판정거리」라고 적어 두었다.
   *
   * 여기서 남기는 사건의 뜻은 좁다 — **「이 녹음이 학생 본인이 보는 카드에 실렸다」** 하나뿐이다.
   * 「학생이 그것을 읽었다」가 아니다. 넓혀 읽으면 이 원장이 곧 거짓이 된다.
   * 🔑 카드에 실린 **그 두 행**(처음·오늘)만 남긴다 — 그 사이 행들은 학생에게 안 보였다.
   *   전부 남기면 「돌려줬다」가 부풀고, 부푸는 방향은 언제나 통과다.
   *
   * 🪦 [2026-09-01] **`voice_log.돌려준날` 칸에 도장을 찍던 것을 원장 append 로 바꿨다**(심문 P0-⑧).
   *   관찰 원본 행에 전달 사건을 섞으면 계보가 끊긴다 — 옛 칸은 «처음 실린 날» 하나만 알아서
   *   두 번 실려도 한 번으로 보였고, 어느 카드로 갔는지는 아무 데도 없었다(심문 P1-⑱ 「빈 껍데기」).
   *   ⇒ 이제 실릴 때마다 쌓이고, 카드 종류·판이 함께 남는다.
   * ⚠ 멱등: 같은 (녹음·카드종류·날짜)는 하루에 한 줄이다 — 배치가 두 번 돌아도 안 늘어난다. */
  const 전달 = ss.getSheetByName('voice_delivery');
  const 행수 = vl.getLastRow() - 1;
  if (전달 && 행수 > 0 && Object.keys(닿은행).length) {
    const 오늘 = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    const 이미 = {};
    if (전달.getLastRow() > 1) {
      전달.getRange(2, 1, 전달.getLastRow() - 1, 1).getValues().forEach(r => { 이미[String(r[0] || '')] = 1; });
    }
    /* 카드판 = 이 카드를 만든 코드의 판. 「어느 판이 만든 문장인가」가 없으면 나중에 학생이 받은
     *   것을 재현할 수 없다(talk_log 의 prompt_ver 와 같은 축 · v9.145). */
    const 카드판 = (typeof SYNK_VERSION === 'string') ? SYNK_VERSION : '';
    const cSid = 0, cFid = 4;                    // voice_log 1·5열 — 헤더 정본과 같은 자리
    const 원본 = vl.getRange(2, 1, 행수, Math.max(cFid + 1, 5)).getValues();
    const 새줄 = [];
    Object.keys(닿은행).forEach(행 => {
      const i = Number(행) - 2;
      if (i < 0 || i >= 행수) return;
      const sid = String(원본[i][cSid] || '').trim();
      const fid = String(원본[i][cFid] || '').trim();
      if (!sid || !fid) return;                  // 조인 키가 없으면 «안 남긴다» — 지어내지 않는다
      const id = fid + '|목소리성장카드|' + 오늘;
      if (이미[id]) return;
      이미[id] = 1;
      새줄.push([id, sid, fid, '목소리성장카드', 카드판, 오늘, new Date()]);
    });
    if (새줄.length) 전달.getRange(전달.getLastRow() + 1, 1, 새줄.length, 새줄[0].length).setValues(새줄);
  }
}

// ── B. 연습 노트(주 1회) → profiles '연습노트' 열 ─────────────────────────
//   재료: mastery_log '연습'(미도달 문법) + aiWeakMap_(강사 메모 14일 + 최근 첨삭 포인트)
//   AI 호출 0 — 전부 기존 데이터의 재조립. [09-04] 교재 과 매핑은 걷혔다(위 35행).
function buildFocusNotes_(ss) {
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return;

  // 문법 이름 사전(GRAMMAR_BANK는 Code.js 전역 — 함수 안 접근 규칙 준수)
  const gName = {};
  try { GRAMMAR_BANK.forEach(g => { gName[g[0]] = g[1]; }); } catch (e) {}

  // 학생별 미도달('연습') 문법 — upsert 시트라 마지막 상태가 정본
  const practicing = {}; // sid → [grammar_id...]
  const ml = ss.getSheetByName('mastery_log');
  if (ml && ml.getLastRow() >= 2) {
    const st = {}; // sid|gid → 상태(뒤 행이 최신)
    ml.getRange(2, 1, ml.getLastRow() - 1, 3).getValues().forEach(r => {
      const sid = String(r[0] || '').trim(), gid = String(r[1] || '').trim();
      if (sid && gid) st[sid + '|' + gid] = String(r[2] || '');
    });
    Object.keys(st).forEach(k => {
      if (st[k] !== '연습') return;
      const p = k.split('|');
      (practicing[p[0]] = practicing[p[0]] || []).push(p[1]);
    });
  }
  let weak = {};
  try { weak = aiWeakMap_(ss); } catch (e) {} // 강사 메모+첨삭 — Code.js 로더 재사용

  const n = pf.getLastRow() - 1;
  const ids = pf.getRange(2, 1, n, 4).getValues();
  const out = ids.map(r => {
    const sid = String(r[0] || '').trim();
    if (!sid || r[3] !== 'student') return [''];
    const gids = (practicing[sid] || []).slice(0, TB_NOTE_MAX);
    const memos = (weak[sid] || []).slice(-1); // 가장 최근 코치 문구 1건만(소음 방지)
    if (!gids.length && !memos.length) return [''];
    let md = '## 📖 내 연습 노트 — 이번 주\n\n';
    if (gids.length) {
      // [09-04] 「— 권1 N과 다시 펴기」 꼬리를 걷었다(유호 지시 「교재관련 오염되거나 낡은거 다 지워줘」).
      //   연습 노트 본체는 mastery_log·student_errors·hw_feedback 만 읽으므로 교재 없이 그대로 선다.
      md += gids.map((g, i) => (i + 1) + '. **' + (gName[g] || g) + '**').join('\n') + '\n\n';
    }
    if (memos.length) md += '💬 최근 코치: ' + memos[0] + '\n\n';
    md += '이것만 잡으면 다음 진화가 가까워져요 ⚡';
    return [md];
  });
  /* 🔴 배포 순서에 안 기댄다 — 코드가 먼저 나가고 setupTextbookLink 가 아직 안 돌면
   *   새 이름 열이 없어 col=0 이 되고, 노트가 **조용히 멈춘다**(에러도 안 난다).
   *   그래서 여기서 옛 이름을 찾아 그 자리에서 헤더만 갈아 끼운다 — 값·열 위치는 그대로다.
   *   설치를 다시 돌리든 안 돌리든 같은 결과가 되는 자리(v9.229 개명). */
  let col = tbProfileCol_(pf, '연습노트');
  if (!col) {
    const 옛 = tbProfileCol_(pf, '필살기노트');
    if (옛) { pf.getRange(1, 옛).setValue('연습노트'); col = 옛; }
  }
  if (col) writeIfChanged(pf, 2, col, out);
}

// ── C. AI 문법 판정 [v9.59] — 숙제 문장 → mastery_log 자동 축적(교사 손 0) ──
//   흐름: hw_feedback 신규 행(포인터) → 학생별 문장 묶음 → aiCall_(Code.js 공용 헬퍼) 1회/학생
//        → 올바르게 쓴 문법 = '연습' 기록, 서로 다른 날 2회째 = '도달' 승격(우연 1회 방지)
//        → 틀리게 시도한 문법 = '연습'만(강등 없음 — 기존 단방향 상향 원칙 그대로)
//   보수 판정 원칙: "명백히 사용된 것만" — 진화 게이트의 무결성이 관대함보다 중요하다.
function masteryFromFeedback_(ss) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  if (!apiKey) return; // 키 없으면 0초 스킵(전 AI 기능 공통 스위치 원칙)
  const fb = ss.getSheetByName('hw_feedback');
  if (!fb || fb.getLastRow() < 2) return;
  const props = PropertiesService.getScriptProperties();
  const last = fb.getLastRow();
  const from = Number(props.getProperty('문법판정_포인터')) || 1;
  if (from >= last) { if (from > last) props.setProperty('문법판정_포인터', String(last)); return; }
  const tz = ss.getSpreadsheetTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  // 신규 첨삭 행에서 학생별 제출문 묶기(D열=제출문)
  const rows = fb.getRange(from + 1, 1, last - from, 4).getValues();
  const bySid = {};
  rows.forEach(r => {
    const sid = String(r[1] || '').trim(), text = String(r[3] || '').trim();
    if (!sid || !text) return;
    bySid[sid] = ((bySid[sid] || '') + '\n' + text).slice(-TB_JUDGE_TEXT_CAP);
  });
  const sids = Object.keys(bySid).slice(0, TB_JUDGE_MAX_PER_RUN);
  if (!sids.length) { props.setProperty('문법판정_포인터', String(last)); return; }

  // 판정 대상 문법 목록 — GRAMMAR_BANK(Code.js 전역)의 G2xx·G3xx만(진화 1~3단계 스코프, 프롬프트 압축)
  const bankList = 문법판정목록_();
  if (!bankList.length) return;
  const schema = {
    type: 'object', additionalProperties: false, required: ['used', 'wrong'],
    properties: {
      used: { type: 'array', items: { type: 'string' }, description: '학생이 명백히 올바르게 사용한 문법 ID만(확신 없으면 제외)' },
      wrong: { type: 'array', items: { type: 'string' }, description: '사용을 시도했으나 틀린 문법 ID만' }
    }
  };
  const system = '한국어 교육 문법 판정관. 학생 문장에서 아래 문법 항목의 사용 여부를 보수적으로 판정한다. ' +
    '명백한 것만 담고, 애매하면 제외한다. 목록에 없는 ID는 절대 만들지 않는다.';

  const 판정들 = [];
  for (const sid of sids) {
    let out;
    try {
      out = aiCall_(apiKey, system,
        '문법 목록(ID=이름):\n' + bankList.join('\n') + '\n\n학생 문장:\n' + bySid[sid],
        schema, 2048);
    } catch (e) { Logger.log('문법판정 실패(' + sid + '): ' + e); continue; } // 학생 단위 격리 — 다음 학생 계속
    판정들.push({ sid: sid, used: out.used, wrong: out.wrong });
  }
  /* 반영은 공용 통로 하나다(아래 `masteryApply_`) — 판정관이 둘이 되며 upsert 를 복제하면 갈라지고,
   *   갈라진 쪽 증상은 언제나 「통과」다(CLAUDE.md 신뢰성 ④). 쓰기는 `단독승격: true` — 이 층의
   *   근거만으로 «도달» 까지 갈 수 있다(v9.59 이래의 규칙 그대로, 바뀐 것 없음). */
  const 결과 = masteryApply_(ss, tz, today, 판정들, { 이름: 'AI첨삭', 단독승격: true });
  // 포인터는 이번에 판정한 학생 수와 무관하게 전진 — 남은 학생은 다음 제출 때 자연 재판정(단순성 우선)
  props.setProperty('문법판정_포인터', String(last));
  if (판정들.length) Logger.log('✅ 문법 판정 ' + 판정들.length + '명 · 신규 기록 ' + 결과.신규 + ' · 도달 승격 ' + 결과.승격);
}

/* 판정 대상 문법 목록 — `GRAMMAR_BANK`(Code.js 전역)의 G2xx·G3xx 만(진화 1~3단계 스코프).
 * 판정관이 둘(쓰기·말하기)이라 목록도 한 곳에서 파생시킨다 — 두 곳에 적으면 한쪽만 낡고,
 * 낡은 쪽은 「못 찾음」이 아니라 **판정 범위가 조용히 갈리는** 모양으로 샌다. */
function 문법판정목록_() {
  const out = [];
  try { GRAMMAR_BANK.forEach(g => { if (/^G[23]/.test(g[0])) out.push(g[0] + '=' + g[1]); }); } catch (e) { return []; }
  return out;
}

/* [v9.248 · #Q99] 문법 판정 → `mastery_log` 반영 — **쓰는 통로 하나**.
 *
 * ■ 왜 갈랐나 — 판정관이 셋이 됐다(쓰기 `masteryFromFeedback_` · 말하기 `masteryFromVoice_` ·
 *   [v9.249] 대화 `masteryFromTalk_`). upsert 를 복제하면 「단방향 상향」·「서로 다른 날 2회」 같은
 *   불변식이 세 곳에 적히고, 한쪽만 고쳐지는 날 그 쪽은 **조용히 통과**한다(CLAUDE.md 신뢰성 ④ ·
 *   ⛔짓는 동안 복제 금지). 판정관이 늘어도 이 함수만 늘지 않는 것이 이 통로의 값이다.
 *
 * ■ `출처.단독승격` — 이 층의 근거만으로 «도달» 까지 갈 수 있는가.
 *   쓰기·말하기 true, 대화만 false. 두 약한 층이 갈린 이유가 **서로 달랐고**, 그중 하나(말하기)를
 *   유호님이 08-27 에 여셨다 — 「말하기 학원인데 녹음만 열심히 하는 학생의 수가 안 오른다」(§7-④):
 *   · 말하기 = ✅ **열렸다**(유호 확정 08-27 · 단독승격 true). 원래 false 였던 사유는 「재는 층이 ASR 이라
 *     자동 전사가 발화를 다듬을 수 있다」였다. 여는 판단의 근거 셋: ①이 학원의 축이 «말하기»다 —
 *     말하기가 성장에 안 닿으면 축과 어긋난다 ②방벽이 남아 있다 — masteryApply_ 의 「서로 다른 날 2회
 *     올바름」은 단독승격과 무관하게 유지되므로, 우연한 ASR 다듬음이 «이틀 연속» 같은 문형에 걸릴
 *     확률은 낮다 ③지금 실해 0 — 학생이 0명이라 잘못 승격될 재료가 없다. 열어 두고 첫 학생 표본으로
 *     검증한다(닫는 게 아니라).
 *     ⚠ **개원 전 큐**(docs/개원전_일괄판정_큐): 첫 학생들의 전사문을 사람이 표본으로 대조해 「ASR 이
 *        실제로 다듬는가」를 잰다 — 실제로 다듬으면 그때 「다른 날 3회」로 방벽을 올리거나 되닫는다.
 *   · 대화 = **여전히 false.** 사유가 말하기와 다르다 — 직전 답장이 올바른 형태를 방금 보여줘, 학생이
 *     그 형태를 되받아 쓰면 모방과 습득이 구분되지 않는다(ASR 다듬음과 «다른 병»이라 같이 안 푼다).
 *     ⚠ 다시 여는 조건 = 첫 학생들의 대화에서 「답장에 안 나온 문법을 학생이 먼저 썼는가」를
 *        사람이 표본으로 재고 난 뒤다.
 *   진화 게이트는 강등이 없어 되돌릴 수 없으니, 남은 약한 층(대화)은 단독으로 안 연다.
 *   쓰기 확인이 한 번 겹치면 승격한다(아래 「천장」이 그 자리다).
 *
 * ■ 천장(정직하게 적는다) — 근거 칸이 한 칸이라 **마지막 근거**만 본다. 그래서 「말하기 → 쓰기」·
 *   「대화 → 쓰기」 순서면 승격한다(쓰기 확인이 있으므로 의도된 통과다). 막는 것은 **같은 약한 층이
 *   연달아 두 번**이다. ⚠ 그래서 «말하기 → 대화» 처럼 약한 층 둘이 엇갈리면 승격한다 — 근거 칸이
 *   하나라 「앞의 근거가 무엇이었나」를 못 보기 때문이다. 지금은 그 조합이 재료상 드물고(대화·음성
 *   둘 다 하는 학생) 두 층의 병이 서로 달라 동시에 같은 착각을 만들 확률이 낮다고 보아 열어 둔다 —
 *   닫으려면 근거 칸을 층별로 갈라야 하고, 그건 `mastery_log` 스키마 변경이라 이 판의 범위 밖이다.
 *
 * @param {{sid:string, used?:string[], wrong?:string[]}[]} 판정들
 * @param {{이름:string, 단독승격:boolean}} 출처
 * @returns {{신규:number, 승격:number}}
 */
function masteryApply_(ss, tz, today, 판정들, 출처) {
  if (!판정들 || !판정들.length) return { 신규: 0, 승격: 0 };
  const validGid = {};
  문법판정목록_().forEach(s => { validGid[s.split('=')[0]] = 1; });
  if (!Object.keys(validGid).length) return { 신규: 0, 승격: 0 }; // 뱅크를 못 읽었다 — 지어낸 ID 차단이 죽으니 아무것도 안 쓴다

  // mastery_log upsert 준비 — (sid|gid) → {row, 상태, 마지막근거일, 마지막출처}
  const ml = ensureSheet(ss, 'mastery_log', MASTERY_LOG_HEADERS); // [v9.239] 헤더 정본 공유(엔진_셋업확장)
  const idx = {};
  if (ml.getLastRow() >= 2) ml.getRange(2, 1, ml.getLastRow() - 1, 7).getValues().forEach((r, i) => {
    const sid = String(r[0] || '').trim(), gid = String(r[1] || '').trim();
    if (sid && gid) idx[sid + '|' + gid] = { row: i + 2, st: String(r[2] || ''), d: dstr(r[6] || r[3], tz), src: String(r[5] || '') };
  });

  let 승격 = 0;
  const append = [];
  const mark = (sid, gid, correct) => {
    if (!validGid[gid]) return; // AI가 지어낸 ID 차단
    const 근거 = 출처.이름 + (correct ? '' : '(오류)');
    const k = sid + '|' + gid, ex = idx[k];
    if (!ex) { // 첫 근거 — '연습'으로 입장
      append.push([sid, gid, '연습', today, '', 근거, new Date()]);
      idx[k] = { row: 0, st: '연습', d: today, src: 근거 };
      return;
    }
    if (ex.st === '도달') return; // 단방향 상향 — 강등 없음
    // 같은 층의 근거가 연달아 두 번인데 그 층이 단독 승격을 못 하면, 여기서 멈춘다(위 ■ 참고)
    const 같은층연속 = !출처.단독승격 && ex.src.indexOf(출처.이름) === 0;
    if (correct && !같은층연속 && ex.d && ex.d !== today) { // 서로 다른 날 2회째 올바름 = 도달
      if (ex.row) { ml.getRange(ex.row, 3, 1, 5).setValues([['도달', ml.getRange(ex.row, 4).getValue() || today, today, 근거, new Date()]]); 승격++; }
      ex.st = '도달';
    } else if (ex.row) { ml.getRange(ex.row, 6, 1, 2).setValues([[근거, new Date()]]); ex.d = today; ex.src = 근거; } // 근거·근거일 갱신
  };
  판정들.forEach(p => {
    (p.used || []).forEach(g => mark(p.sid, String(g).trim(), true));
    (p.wrong || []).forEach(g => mark(p.sid, String(g).trim(), false));
  });
  if (append.length) ml.getRange(ml.getLastRow() + 1, 1, append.length, 7).setValues(append);
  return { 신규: append.length, 승격: 승격 };
}

/* [v9.253 · #Q106] 🧱 **판정 벽의 만료** — 실패한 학생 하나가 큐를 «영영» 막던 자리.
 *
 * ■ 병 (선존재 · 이미 라이브)
 *   아래 둘(C-2 말하기·C-3 대화)은 「실패는 격리하되 재료는 안 버린다」로 실패한 학생 앞에 **벽**을
 *   세운다. 그 규율 자체는 옳다 — 없애면 v9.211·v9.212 가 두 번 고친 영구 유실로 되돌아간다.
 *   그런데 벽에 **만료가 없었다.** `aiCall_` 이 한 학생에게 «영구» 실패하면(내용 필터에 걸리는
 *   문장·손상된 행) 그 벽이 영원히 서서 ①`from` 이 안 움직여 매 밤 **같은 앞쪽 15명**만 다시 읽고,
 *   그 뒤 학생은 상한에 밀려 무기한 미판정 ②그 되읽기가 매 밤 API 슬롯을 통째로 태운다.
 *   🔑 사람이 로그를 보고 알아채야만 풀리는 상태 = 철학 「하지 않는 것 ㉡」 위반이다.
 *
 * ■ 처방 — 선례를 **베끼지 않고 읽고** 왔다
 *   `엔진_수집.js` 의 `닫힌카드_`(v9.212·v9.213)가 같은 모양을 이미 풀었다: 격리는 «복구 창» 안에서는
 *   판정 전(멈춤=지연)이고 창이 지나면 닫힘이다 — 「무기한 멈춤도 답이 아니다」가 거기 적힌 문장이다.
 *   다른 점 하나 = 그쪽 기준 시각은 **시트에 있는 제출일**인데 이 벽은 시트에 자리가 없다. 그래서
 *   벽이 «처음 선 시각»을 스크립트 속성에 적는다 — 새 시트·새 트리거 0(이 계열의 규율 그대로).
 *
 * ■ 벽의 «자리»를 키로 쓴다 — 시각만 적으면 벽이 바뀌어도 옛 시계가 이어져 **엉뚱한 학생을 버린다.**
 *   자리 = `<막고 있는 학생>@<좌표>`(대화는 포인터 행, 말하기는 도장). 자리가 달라지면 새 벽이라
 *   시계가 0 에서 다시 간다.
 *
 * ■ 대가 (지침 신뢰성 맹점④ — 틀릴 때의 모습 + 닫을 것)
 *   · 틀릴 때의 모습 = **재료를 버린다.** 창이 지나면 그 학생의 그 구간 문장은 커서 뒤로 넘어가
 *     다시 안 읽힌다. 그래서 조용히 넘기지 않는다 — 로그 + 관리자 메일로 «누구를 몇 밤 만에
 *     버렸는지»를 적는다(조용한 실패의 그 축: 사라지는데 아무 화면도 안 바뀌는 것이 제일 나쁘다).
 *   · 왜 그래도 버리는가 = 안 버리면 **그 뒤 학생 전원**이 영구 미판정이다. 한 학생의 한 구간과
 *     반 전체 중 무엇을 잃을지의 문제이고, v9.213 이 같은 자리에서 이미 「정체가 한 행 유실보다
 *     나쁘다」로 판정했다.
 *   · 닫을 것 = 창이 지나기 «전»엔 옛 규율 그대로 벽이 선다 — 1~6밤은 재시도라, 일시 실패
 *     (429·5xx·타임아웃)는 그 안에서 스스로 낫는다. 즉 이 처방이 버리는 것은 «영구» 실패뿐이다.
 *   · 안 닫은 천장 둘 — ①실패 «사유»를 못 가른다(`aiCall_` 이 안 돌려준다): 가르면 일시/영구에
 *     창을 따로 줄 수 있다. ②버린 학생이 매일 새로 말하면서 매번 같은 이유로 실패하면, 새 벽이
 *     또 7밤을 선다(영구 정지는 아니고 7밤당 한 배치씩 전진한다). 둘 다 실측 재료가 생긴 뒤에
 *     연다 — 지금은 `talk_log`·`voice_log` 0행이라 못 잰다.
 *
 * ■ `masteryFromFeedback_` 에는 **안 단다** — 그 함수엔 이 병이 없다(대기열 #Q106 이 짚은 「셋의
 *   커서 규율이 갈렸다」의 답). 포인터가 판정 학생 수와 무관하게 `last` 로 전진하므로 벽이 아예
 *   없고, 재료는 다음 숙제 제출이 새 행으로 다시 만든다 — 지연이지 유실이 아니다. 갈림의 이유는
 *   **재료가 다시 오는가**이지 베끼다 만 것이 아니라, 통일하지 않고 그 이유를 여기 적어 둔다. */
const TB_JUDGE_WALL_RECOVERY_MS = 7 * 86400000; // 벽이 서 있어도 되는 밤 수 — 야간 배치는 밤당 1회라 7밤 재시도(선례 `격리복구창_MS` 와 같은 자)

/** 벽이 만료됐나. **부수효과가 있다** — 새 벽이면 그 자리에 시계를 새로 건다.
 *  @param {Object} props `PropertiesService.getScriptProperties()`
 *  @param {string} 키   '대화' | '음성' — 속성 이름에 그대로 들어간다(스트림마다 시계가 따로 간다)
 *  @param {string} 자리 벽의 신원 `<sid>@<좌표>` — 달라지면 새 벽이다
 *  @param {number} 지금 ms
 *  @returns {{만료: boolean, 밤: number}} */
function 판정벽_(props, 키, 자리, 지금) {
  const 이름 = '문법판정_벽_' + 키;
  const 옛 = String(props.getProperty(이름) || '');
  const 갈래 = 옛.lastIndexOf('|');
  const 옛자리 = 갈래 > 0 ? 옛.slice(0, 갈래) : '';
  const 옛시각 = 갈래 > 0 ? Number(옛.slice(갈래 + 1)) : NaN;
  /* 자리가 다르거나 시각을 **못 읽으면 새 벽이다.** 못 읽는 값을 「오래됐다」로 접으면 깨진 속성
   *   하나가 학생을 그 밤에 즉시 버린다 — 틀릴 때 방향은 「유실」이 아니라 「지연」이어야 한다.
   *   (v9.213 은 반대로 접었는데, 그쪽 기준 시각은 «남이 쓴 시트 값»이라 못 읽는 상태가 정상으로
   *   존재하고 기다리면 영구 정지였다. 여기 시각은 **이 함수가 방금 쓴 것**이라 다음 밤이면
   *   반드시 읽히므로 기다려도 안 막힌다 — 같은 낱말이지만 층이 다르다.) */
  if (옛자리 !== 자리 || !isFinite(옛시각) || 옛시각 <= 0 || 옛시각 > 지금) {
    props.setProperty(이름, 자리 + '|' + 지금);
    return { 만료: false, 밤: 0 };
  }
  return { 만료: (지금 - 옛시각) >= TB_JUDGE_WALL_RECOVERY_MS, 밤: Math.floor((지금 - 옛시각) / 86400000) };
}

/** 벽이 내려갔다 — 시계를 지운다. 안 지우면 나중에 **우연히 같은 자리**에 선 새 벽이 옛 시계를
 *  이어받아, 첫 밤에 바로 만료로 읽힌다(자리 키만으로는 못 막는 자리다). */
function 판정벽지움_(props, 키) {
  try { props.deleteProperty('문법판정_벽_' + 키); } catch (e) { Logger.log('벽 시계 삭제 실패(' + 키 + '): ' + e); }
}

/** 버렸다고 **말한다** — 조용히 넘어가면 재료가 사라지는데 아무 화면도 안 바뀐다. */
function 판정버림보고_(층, sid, 밤) {
  const 일 = Math.round(TB_JUDGE_WALL_RECOVERY_MS / 86400000);
  const 글 = 층 + ' 문법 판정 — 학생 ' + sid + ' 앞에서 커서가 ' + 밤 + '밤 서 있었다(복구 창 ' + 일
    + '일 만료). 그 학생의 **그 구간** 문장을 버리고 커서를 넘긴다 — 그 뒤 학생들이 그동안 미판정이었다.';
  Logger.log('⏭ ' + 글);
  /* 통보가 실패해도 판정은 계속된다 — 알림 실패로 큐를 다시 세우면 고치려던 병을 되만든다. */
  try {
    adminMail('[SYNK] ⏭ 문법 판정 — 학생 ' + sid + ' 구간 건너뜀', 글
      + '\n\n왜 버리나: 벽이 서 있는 동안 그 뒤 학생 전원이 미판정이라, 한 구간을 잃는 쪽을 골랐다'
      + '(v9.213 과 같은 판정 — 정체가 한 행 유실보다 나쁘다).'
      + '\n버린 것: 그 학생이 이번 구간에 말한/쓴 문장의 문법 판정. **다음 문장부터는 정상 판정된다.**'
      + '\n되읽고 싶으면: 스크립트 속성 `문법판정_대화포인터`(대화) 또는 `문법판정_음성마크`(말하기)를'
      + ' 그 구간 앞으로 되감으면 다시 읽는다 — 원인이 그대로면 다시 같은 자리에 선다.');
  } catch (e) { Logger.log('버림 통보 실패: ' + e); }
}

/* [v9.248 · #Q99] 🎙 C-2. 말하기 문법 판정 — **전사문이 처음으로 엔진에 닿는다** (시트층 도달 3/5)
 *
 * ■ 무엇이 비어 있었나
 *   `voice_log` 는 시트층 도달 장부에서 「읽는 곳이 전사 상태 관리·진단·삭제뿐」이었다.
 *   학생이 **말한 것**이 학원 안 어디로도 되돌아가지 않는다는 뜻이다 — 전사비를 내고 글로
 *   옮겨 놓고는 그 글을 아무도 안 읽었다.
 *
 * ■ 원신호가 **구조적으로** 못 보는 것 (이 층에서 값을 가장 빨리 내는 축 · §8-1)
 *   문법 도달 판정(`masteryFromFeedback_`)의 입력은 `hw_feedback` 제출문 하나 — 즉 **쓴 글**뿐이다.
 *   그래서 「글로는 아직 안 썼는데 말로는 쓰는 문법」은 진화·연습 노트 어디에도 없고,
 *   그 학생은 두 층 모두에서 **아직 그 문법을 모르는 학생**으로 남는다. 첨삭에 확신도 열이
 *   없어 「찍어서 맞힘」이 안 보이던 자리(2/5)와 같은 무늬다.
 *
 * ■ 왜 `masteryFromFeedback_` 에 합치지 않았나 — 그 함수의 커서는 `hw_feedback` 행 번호다.
 *   합치면 ①**숙제를 안 낸 학생의 전사문은 통째로 안 읽힌다**(커서가 hw 신규 0 이면 즉시 반환) —
 *   말하기만 하는 학생이 정확히 그 사각이다. ②판정 결과를 쓰기·말하기로 **귀속시킬 수 없어**
 *   위 `단독승격` 가드가 원리상 못 선다. 그래서 스트림도 판정도 갈라 두고, **쓰는 통로만** 공유한다.
 *
 * ■ 스트림을 «전사일시» 워터마크로 잡는 이유 (행 번호 커서를 안 쓴다)
 *   행 번호로 걸으면 «아직 전사 안 된 행»을 지나쳐 버리고, 그 행은 나중에 전사돼도 커서 뒤라
 *   **영구 누락**이다 — 오류뱅크 커서가 v9.211·v9.212 에서 두 번 고친 바로 그 병이다.
 *   전사가 끝나야 도장이 찍히므로, 도장 시각으로 흐름을 잡으면 행은 «전사되는 순간» 스트림에
 *   들어온다. 같은 전사를 두 번 먹지 않는 것도 이 워터마크가 진다(두 번 먹으면 같은 근거가
 *   «다른 날 2회»로 둔갑해 거짓 승격이 난다).
 *
 * ■ 대가 (지침 신뢰성 맹점④ — 틀릴 때의 모습 + 닫을 것)
 *   · 틀릴 때의 모습 = **조용히 적은 재료**. 전사는 끝났는데 전사일시가 비거나 깨진 행은
 *     스트림에 못 들어오는데, 겉으로는 「전사 대기」와 같은 모양이다 → 세어서 로그에 적는다.
 *   · 닫을 것 = **판정에 실패한 학생이 있으면 워터마크를 그 앞에서 세운다.** 안 그러면 그 학생의
 *     전사문은 다시 못 읽힌다(전진해 버린 커서 뒤라). 실패는 격리하되 **재료는 안 버린다.**
 *   · 남는 천장(안 닫았다) = 벽 뒤에 있던 «성공한 학생의 나중 행»은 다음 밤 다시 읽힌다.
 *     이때 승격이 나려면 마지막 근거가 쓰기여야 하는데, 그 경우는 애초에 승격이 옳은 자리다.
 *   · 새 시트·새 트리거 0 — 이미 쌓이는 탭을 읽고, 야간 오케스트레이터에 한 줄 붙는다.
 *   ⚠ **하루 지연이 있다** — 이 함수는 `voiceTranscribe_` **뒤**에 서므로 그날 밤 전사분을 그날
 *     밤에 판정한다. 반대로 `masteryFromFeedback_` 는 앞에 그대로 둔다(순서를 바꾸면 STT 가
 *     6분 실행 예산을 먼저 먹어 쓰기 판정이 굶는다 — 얻는 것보다 잃는 것이 크다). */
function masteryFromVoice_(ss) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  if (!apiKey) return; // 키 없으면 0초 스킵(전 AI 기능 공통 스위치 원칙)
  const vl = ss.getSheetByName('voice_log');
  if (!vl || vl.getLastRow() < 2) return;
  헤더보정_(vl, VOICE_LOG_HEADERS); // 구 9열 시트도 그대로 살아야 한다(voiceTranscribe_ 와 같은 공용 치유)
  /* 폭은 시트 물리 폭으로 클램프한다 — 구 시트에서 12열을 요구하면 예외가 나고, 그러면 이 재료가
   *   아니라 야간 오케스트레이터의 이 칸이 통째로 죽는다(v9.209 의 1710 교훈과 같은 자리). */
  const w = Math.min(VOICE_LOG_HEADERS.length, vl.getLastColumn());
  if (w < 9) return; // 전사일시 열이 없다 — 워터마크 스트림을 만들 수 없다(치유가 실패한 시트)

  const props = PropertiesService.getScriptProperties();
  const 마크전 = String(props.getProperty('문법판정_음성마크') || '');
  const tz = ss.getSpreadsheetTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  /* 전사일시는 문자열로 찍히지만 시트가 Date 로 되받는 자리가 있다(이 저장소가 네 번 밟은 월키
   *   Date 오염 계열) — 두 모양을 한 자로 눕혀야 사전순 비교가 «시간순»이 된다. */
  const 도장 = (v) => (v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd HH:mm') : String(v || '').trim());

  const rows = vl.getRange(2, 1, vl.getLastRow() - 1, w).getValues();
  const 새행 = [];
  let 버린행 = 0;
  rows.forEach(r => {
    const sid = String(r[0] || '').trim();
    const 전사 = String(r[6] || '').trim();
    if (!sid || !전사) return;                                   // 아직 전사 전이거나 실패 — 재료가 아니다
    if (String(r[7] || '').trim() !== '완료') return;            // 상태 정본은 voiceTranscribe_ 가 찍는 '완료' 하나
    const t = 도장(r[8]);
    if (!t) { 버린행++; return; }                                // 전사는 있는데 도장이 없다 — 스트림에 못 넣는다(조용한 손실)
    if (t <= 마크전) return;                                     // 이미 먹은 구간
    새행.push({ sid: sid, 글: 전사, t: t });
  });
  if (버린행) Logger.log('🎙 말하기 판정 — 전사일시가 없어 못 읽은 행 ' + 버린행 + '건(전사는 완료돼 있다)');
  if (!새행.length) return;

  /* 도장 순으로 걷는다 — 상한에 걸려 멈출 때 **같은 도장을 가진 행은 통째로** 담는다.
   *   중간에서 자르면 그 도장은 워터마크가 되는데, 못 담은 동률 행은 `t <= 마크전` 에 걸려
   *   영원히 안 읽힌다(경계에서만 새는 종류의 유실이라 평소엔 안 보인다). */
  새행.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
  const 글 = {};
  const sid순 = [];
  let 마지막도장 = '', 담은행 = 0;
  for (const x of 새행) {
    const 새학생 = sid순.indexOf(x.sid) === -1;
    if (새학생 && sid순.length >= TB_VOICE_JUDGE_MAX_PER_RUN && x.t !== 마지막도장) break;
    if (새학생) { 글[x.sid] = ''; sid순.push(x.sid); }
    글[x.sid] = (글[x.sid] + '\n' + x.글).slice(-TB_JUDGE_TEXT_CAP);
    마지막도장 = x.t;
    담은행++;
  }

  const bankList = 문법판정목록_();
  if (!bankList.length) return;
  const schema = {
    type: 'object', additionalProperties: false, required: ['used', 'wrong'],
    properties: {
      used: { type: 'array', items: { type: 'string' }, description: '학생이 명백히 올바르게 사용한 문법 ID만(확신 없으면 제외)' },
      wrong: { type: 'array', items: { type: 'string' }, description: '사용을 시도했으나 틀린 문법 ID만' }
    }
  };
  /* 지문이 «말한 문장»임을 밝혀야 하는 이유 둘 — 안 밝히면 판정관이 글의 잣대를 그대로 댄다.
   *   ①구어는 어미를 줄이고 군말·되풀이가 섞인다(그건 오류가 아니다) ②전사는 기계가 옮긴
   *   것이라 학생이 안 한 실수가 섞일 수 있다(그래서 애매하면 제외가 더 강하게 걸려야 한다). */
  const 음성지문 = '한국어 교육 문법 판정관. 아래 문장은 학생이 **말한 것을 기계가 글로 옮긴 것**이다. ' +
    '구어의 특징(어미 줄임·군말·되풀이·띄어쓰기 흐트러짐)은 오류로 보지 않는다. ' +
    '전사 오류가 섞일 수 있으니 명백한 것만 담고, 조금이라도 애매하면 제외한다. 목록에 없는 ID는 절대 만들지 않는다.';

  const 판정들 = [];
  const 실패 = {};
  for (const sid of sid순) {
    let out;
    try {
      out = aiCall_(apiKey, 음성지문,
        '문법 목록(ID=이름):\n' + bankList.join('\n') + '\n\n학생이 말한 문장(전사):\n' + 글[sid],
        schema, 2048);
    } catch (e) { Logger.log('말하기 문법판정 실패(' + sid + '): ' + e); 실패[sid] = 1; continue; } // 학생 단위 격리
    판정들.push({ sid: sid, used: out.used, wrong: out.wrong });
  }

  /* 워터마크 — 실패한 학생이 하나라도 있으면 **그 학생의 가장 이른 도장 앞**에서 세운다.
   *   전진시키면 그 전사문은 커서 뒤로 넘어가 다시 못 읽힌다(실패는 격리하되 재료는 안 버린다).
   *   [v9.253 · #Q106] 단 그 벽엔 **만료**가 있다 — 영구 실패 하나가 스트림을 영영 막던 자리
   *   (통로·대가는 위 `판정벽_` 머리말). 만료된 학생만 버리고 벽을 다시 찾는다. */
  const 지금 = new Date().getTime();
  const 버린 = {};
  let 벽 = '';
  for (;;) {
    벽 = '';
    let 벽sid = '';
    새행.forEach(x => { if (실패[x.sid] && !버린[x.sid] && (!벽 || x.t < 벽)) { 벽 = x.t; 벽sid = x.sid; } });
    if (!벽) break;
    const 판 = 판정벽_(props, '음성', 벽sid + '@' + 벽, 지금);
    if (!판.만료) break;
    버린[벽sid] = 1;
    판정벽지움_(props, '음성');   // 다음 벽이 이 시계를 물려받지 않게(자리가 달라도 명시적으로 끊는다)
    판정버림보고_('🎙 말하기', 벽sid, 판.밤);
  }
  if (!벽) 판정벽지움_(props, '음성'); // 벽이 내려갔다
  let 마크후 = 마크전;
  새행.forEach(x => { if ((!벽 || x.t < 벽) && x.t <= 마지막도장 && x.t > 마크후) 마크후 = x.t; });

  /* [v9.251] 🔴 **쓰기가 끝난 «뒤에» 찍는다** — 위 벽은 «AI 호출» 실패만 막았고, 그 아래 시트 쓰기가
   *   던지는 경우를 안 봤다. 먼저 찍으면 `masteryApply_` 예외를 야간 오케스트레이터가 삼키는 동안
   *   워터마크만 전진해, 그 전사문은 `t <= 마크전` 에 걸려 **영구 미판정**이 된다(오류뱅크 커서가
   *   v9.211·v9.212 에서 두 번 고친 그 병 · ①배포 검수 P1 `bfe9cce47844`).
   *   던져서 다시 읽히는 쪽은 안전하다 — `masteryApply_` 가 부분 기록을 남겼어도 그 근거는
   *   같은 층(`AI음성`)이라 `같은층연속` 가드가 거짓 승격을 막는다. */
  const 결과 = masteryApply_(ss, tz, today, 판정들, { 이름: 'AI음성', 단독승격: true }); // [유호 08-27 §7-④] 말하기 단독 승격 열림 — 근거·방벽·개원 전 표본 검증 큐는 masteryApply_ 머리말
  if (마크후 !== 마크전) props.setProperty('문법판정_음성마크', 마크후);
  /* 0 은 분모와 함께 읽는다(유호 확정 08-14) — 안 그러면 「말하기가 진화에 닿는다」가
   *   실제로 판정된 학생 0명이어도 참이 된다. */
  Logger.log('🎙 말하기 문법 판정 — 새 전사 ' + 새행.length + '행 = 이번에 읽은 ' + 담은행
    + '행(학생 ' + sid순.length + '명 = 판정 ' + 판정들.length + ' + 실패 ' + Object.keys(실패).length
    + ') + 상한 밖 ' + (새행.length - 담은행) + '행 · 신규 기록 ' + 결과.신규 + ' · 도달 승격 ' + 결과.승격);
}

/* [v9.249 · #Q99] 🗣 C-3. 대화 문법 판정 — **스스로 고른 문장이 처음으로 엔진에 닿는다** (시트층 도달 4/5)
 *
 * ■ 무엇이 비어 있었나
 *   `talk_log` 는 도달 장부에서 「읽는 곳이 진단 리포트뿐 — 턴 수·최장 턴만 센다」였다.
 *   회화 앱의 핵심 재료라고 골격 주석이 스스로 적어 둔 탭인데, 그 안의 한국어를 아무도 안 읽었다.
 *
 * ■ 🔴 사유가 낡은 **네 번째 방식** — 이번엔 처방이 «이미 서 있었다»
 *   그 칸의 사유는 「다회차 이력을 다음 답장의 맥락으로 싣는 배선이 서면 닿는다」였다. 그런데
 *   `talkBatch_` 는 이미 `talkHistory_(logRows, sid)` 로 직전 6턴을 프롬프트에 싣는다(v9.138 이래).
 *   즉 처방을 글자대로 따르면 **아무것도 안 짓고 도달 칸만 뒤집게** 된다 — 이 장부가 스스로 금지한
 *   「소비자 없이 도달 칸 채우기」다. 앞선 셋과 나란히 두면 사유가 낡는 방식이 네 가지다:
 *     1/5 지목이 참 · 2/5 지목한 **이름이 없었다**(F531) · 3/5 처방이 **이미 기각된 통로**였다 ·
 *     4/5 처방이 **이미 서 있었다**(그래서 따르면 빈 도장이 된다).
 *   🔑 그리고 사유의 첫 문장도 틀렸다 — 읽는 곳은 진단 리포트«뿐»이 아니었다(답장이 읽는다).
 *      다만 그 읽기는 **같은 기능 안에서 도는 고리**라 학생 이해가 한 칸도 안 자란다: 대화를 읽어
 *      대화를 쓴다. 도달의 뜻은 「읽는 자리가 있다」가 아니라 **「다음에 줄 것이 바뀐다」**다.
 *
 * ■ 원신호가 **구조적으로** 못 보는 것 (이 층에서 값을 가장 빨리 내는 축 · §8-0)
 *   문법 판정관 둘의 입력은 숙제 제출문(C)과 전사문(C-2)이다 — **둘 다 우리가 낸 과제의 산출**이다.
 *   과제는 쓸 문법을 정해 주므로, 「과제가 안 물어봤는데 학생이 스스로 쓴 문법」은 어느 층에도 없다.
 *   대화는 학생이 화제도 문장도 고른다 — 자발적으로 맞게 쓴 문법은 도달의 **더 강한** 증거다.
 *   (1/5 결석·3인조 · 2/5 찍어서 맞힘 · 3/5 말한 것 — 같은 축이 네 번 연속 통했다.)
 *
 * ■ 왜 판정관 둘에 합치지 않았나 — 커서가 다르다
 *   `masteryFromFeedback_` 의 커서는 `hw_feedback` 행이라 **숙제를 안 낸 학생의 대화문은 통째로
 *   안 읽힌다**(신규 0 이면 즉시 반환). 대화만 하는 학생이 정확히 그 사각이다. 그리고 합치면
 *   판정을 층별로 귀속할 수 없어 아래 `단독승격` 가드가 원리상 못 선다. 스트림·지문은 갈라 두고
 *   **쓰는 통로(`masteryApply_`)만** 공유한다 — 판정관이 셋이 되어도 불변식은 한 곳에만 적힌다.
 *
 * ■ 스트림은 «행 번호» 포인터다 (말하기의 워터마크를 안 베낀다)
 *   전사는 행이 앉은 **뒤에** 채워지므로 행 번호로 걸으면 미전사 행을 영구 누락한다 — 그래서 C-2 는
 *   전사일시 도장을 쓴다. 대화는 반대다: `talkBatch_` 가 학생문을 **append 시점에** 넣고(API 가
 *   실패한 행조차 학생문은 남긴다) 나중에 채우는 칸이 없다. 없는 병에 약을 쓰면 그 약이 새 병이 된다.
 *   ⚠ 그래서 `from > last` 되감기를 둔다 — `wipe`·시연 종료로 탭이 짧아지면 포인터가 끝 밖에 선다.
 *
 * ■ `출처.단독승격 = false` — 이유가 말하기와 **다르다**(같은 칸, 다른 병)
 *   말하기가 false 인 것은 재는 층이 ASR 이라서다. 대화가 false 인 것은 **직전 답장이 올바른 형태를
 *   방금 보여줬기** 때문이다 — 지문이 「틀린 곳은 답장에서 살짝 고쳐 준다」라, 학생이 그 형태를
 *   되받아 쓰면 이 층에서 **모방과 습득이 구분되지 않는다**. 진화 게이트는 강등이 없어 되돌릴 수
 *   없으니 이 층 근거 **단독**으로는 «도달»까지 안 보낸다(쓰기 확인이 한 번 겹치면 승격한다).
 *   ⚠ 다시 여는 조건 = 첫 학생들의 대화에서 「답장에 안 나온 문법을 학생이 먼저 썼는가」를 사람이
 *      표본으로 재고 난 뒤다(지금은 학생 0명이라 그 표본이 없다 — 못 재는 것을 근거로 열지 않는다).
 *
 * ■ 대가 (지침 신뢰성 맹점④ — 틀릴 때의 모습 + 닫을 것)
 *   · 틀릴 때의 모습 = **조용히 좁아진 재료**. 구 8열 시트에서도 학생문은 D열이라 읽히지만, 폭이
 *     4 미만으로 깨진 시트는 재료 0 인데 「대화가 없는 밤」과 같은 모양이다 → 폭 미달은 즉시 반환하고
 *     읽은 행·학생·판정·실패를 **분모와 함께** 로그에 적는다(0 은 분모와 함께 · 유호 확정 08-14).
 *   · 닫을 것 = **판정에 실패한 학생이 있으면 포인터를 그 학생의 첫 행 앞에서 세운다.** 전진시키면
 *     그 문장은 커서 뒤라 다시 못 읽힌다(실패는 격리하되 재료는 안 버린다 · C-2 와 같은 규율).
 *   · 남는 천장(안 닫았다) = 상한에 걸려 못 읽은 학생은 다음 밤에 읽힌다. 대화는 하루 1턴 가드가
 *     있어 밤당 신규 행이 학생 수를 못 넘으므로, 상한 15 는 실제로는 미개원 규모에서 안 걸린다.
 *   · 헤더 치유를 **안 한다** — 읽는 자가 쓰면 진단이 대상을 바꾼다(`talkBatch_`·`menuTalkLogCheck`
 *     가 이미 치유를 진다). 폭은 물리 폭으로 클램프한다(구 시트에서 13열을 요구하면 이 칸이 죽는다).
 *   · 새 시트·새 트리거 0 — 이미 쌓이는 탭을 읽고, 야간 오케스트레이터에 한 줄 붙는다. */
function masteryFromTalk_(ss) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  if (!apiKey) return; // 키 없으면 0초 스킵(전 AI 기능 공통 스위치 원칙)
  const tl = ss.getSheetByName('talk_log');
  if (!tl || tl.getLastRow() < 2) return;
  const w = Math.min(TALK_LOG_HEADERS.length, tl.getLastColumn());
  if (w < 4) return; // 학생문(D열)이 없다 — 재료가 아니다(구 8열 시트는 통과한다)

  const props = PropertiesService.getScriptProperties();
  const last = tl.getLastRow();
  const from = Number(props.getProperty('문법판정_대화포인터')) || 1;
  if (from > last) { props.setProperty('문법판정_대화포인터', String(last)); return; } // wipe·감축 뒤 되감기
  if (from >= last) return;

  const tz = ss.getSpreadsheetTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const rows = tl.getRange(from + 1, 1, last - from, w).getValues();

  /* 상한에 걸리면 **그 앞 행에서 멈춘다** — 포인터가 담지도 않은 학생의 행을 넘어가면 그 문장은
   *   영구 누락이다(경계에서만 새는 종류라 평소엔 안 보인다 · C-2 가 동률 도장으로 배운 것과 같은 병). */
  const 글 = {};
  const sid순 = [];
  let 담은행 = 0;
  for (let i = 0; i < rows.length; i++) {
    const sid = String(rows[i][1] || '').trim();
    const 문장 = String(rows[i][3] || '').trim();
    if (!sid || !문장) { 담은행 = i + 1; continue; } // 빈 행은 재료가 아니다 — 지나가도 잃는 것이 없다
    const 새학생 = sid순.indexOf(sid) === -1;
    if (새학생 && sid순.length >= TB_TALK_JUDGE_MAX_PER_RUN) break;
    if (새학생) { 글[sid] = ''; sid순.push(sid); }
    글[sid] = (글[sid] + '\n' + 문장).slice(-TB_JUDGE_TEXT_CAP); // 상한은 쓰기·말하기와 공용(한 함수에 자 하나)
    담은행 = i + 1;
  }
  if (!sid순.length) { // 재료 0 — 빈 행만 지났다면 포인터는 그만큼 전진해도 안전하다
    if (담은행) props.setProperty('문법판정_대화포인터', String(from + 담은행));
    return;
  }

  const bankList = 문법판정목록_();
  if (!bankList.length) return; // 뱅크를 못 읽었다 — 지어낸 ID 차단이 죽으니 아무것도 안 판정한다
  const schema = {
    type: 'object', additionalProperties: false, required: ['used', 'wrong'],
    properties: {
      used: { type: 'array', items: { type: 'string' }, description: '학생이 명백히 올바르게 사용한 문법 ID만(확신 없으면 제외)' },
      wrong: { type: 'array', items: { type: 'string' }, description: '사용을 시도했으나 틀린 문법 ID만' }
    }
  };
  /* 지문이 «자유 대화»임을 밝혀야 하는 이유 둘 — 안 밝히면 판정관이 작문 과제의 잣대를 그대로 댄다.
   *   ①채팅은 짧고 반말·이모지·줄임이 섞인다(그건 오류가 아니다) ②직전 답장이 올바른 형태를 보여준
   *   뒤라, 되받아 쓴 것은 습득의 증거로 약하다 → 애매하면 제외가 더 강하게 걸려야 한다. */
  const 대화지문 = '한국어 교육 문법 판정관. 아래 문장은 학생이 **자유 대화에서 스스로 쓴 것**이다. ' +
    '과제가 정해 준 문법이 아니라 학생이 고른 표현이므로, 채팅의 특징(짧은 문장·구어체·줄임·이모지)은 오류로 보지 않는다. ' +
    '직전 답장이 올바른 형태를 보여준 뒤 그대로 되받아 쓴 것일 수 있으니, 명백한 것만 담고 조금이라도 애매하면 제외한다. ' +
    '목록에 없는 ID는 절대 만들지 않는다.';

  const 판정들 = [];
  const 실패 = {};
  for (const sid of sid순) {
    let out;
    try {
      out = aiCall_(apiKey, 대화지문,
        '문법 목록(ID=이름):\n' + bankList.join('\n') + '\n\n학생이 대화에서 쓴 문장:\n' + 글[sid],
        schema, 2048);
    } catch (e) { Logger.log('대화 문법판정 실패(' + sid + '): ' + e); 실패[sid] = 1; continue; } // 학생 단위 격리
    판정들.push({ sid: sid, used: out.used, wrong: out.wrong });
  }

  /* 포인터 — 실패한 학생이 하나라도 있으면 **그 학생의 첫 행 앞**에서 세운다.
   *   전진시키면 그 문장은 커서 뒤로 넘어가 다시 못 읽힌다(실패는 격리하되 재료는 안 버린다).
   *   [v9.253 · #Q106] 단 그 벽엔 **만료**가 있다 — 영구 실패 하나가 큐를 영영 막던 자리
   *   (통로·대가는 위 `판정벽_` 머리말). 만료된 학생만 버리고 벽을 다시 찾는다. */
  const 지금 = new Date().getTime();
  const 버린 = {};
  let 벽 = 0;
  for (;;) {
    벽 = 0;
    let 벽sid = '';
    for (let i = 0; i < 담은행; i++) {
      const s = String(rows[i][1] || '').trim();
      if (실패[s] && !버린[s]) { 벽 = i + 1; 벽sid = s; break; }
    }
    if (!벽) break;
    const 판 = 판정벽_(props, '대화', 벽sid + '@' + (from + 벽), 지금);
    if (!판.만료) break;
    버린[벽sid] = 1;
    판정벽지움_(props, '대화');   // 다음 벽이 이 시계를 물려받지 않게(자리가 달라도 명시적으로 끊는다)
    판정버림보고_('🗣 대화', 벽sid, 판.밤);
  }
  if (!벽) 판정벽지움_(props, '대화'); // 벽이 내려갔다
  const 전진 = 벽 ? 벽 - 1 : 담은행;

  /* [v9.251] 🔴 **쓰기가 끝난 «뒤에» 전진한다** — 위 벽은 «AI 호출» 실패만 막았고, 그 아래 시트 쓰기가
   *   던지는 경우를 안 봤다. 먼저 전진시키면 `masteryApply_` 예외를 야간 오케스트레이터가 삼키는 동안
   *   포인터만 나아가, 그 문장은 커서 뒤라 **영구 미판정**이 된다(①배포 검수 P1 `bfe9cce47844`).
   *   🔑 셋 중 이 둘만 순서가 뒤집혀 있었다 — `masteryFromFeedback_` 는 처음부터 apply 뒤에 찍는다.
   *   같은 판정을 세 곳에 적으면 갈라진다는 것을 «순서»가 그대로 보여준 자리다(신뢰성 ④). */
  const 결과 = masteryApply_(ss, tz, today, 판정들, { 이름: 'AI대화', 단독승격: false });
  if (전진 > 0) props.setProperty('문법판정_대화포인터', String(from + 전진));
  /* 0 은 분모와 함께 읽는다(유호 확정 08-14) — 안 그러면 「대화가 진화에 닿는다」가 실제로 판정된
   *   학생 0명이어도 참이 된다. 상한 밖·실패·전진 폭이 한 줄에서 갈린다. */
  Logger.log('🗣 대화 문법 판정 — 새 행 ' + rows.length + '행 = 이번에 읽은 ' + 담은행
    + '행(학생 ' + sid순.length + '명 = 판정 ' + 판정들.length + ' + 실패 ' + Object.keys(실패).length
    + ') + 상한 밖 ' + (rows.length - 담은행) + '행 · 포인터 전진 ' + 전진 + '행'
    + ' · 신규 기록 ' + 결과.신규 + ' · 도달 승격 ' + 결과.승격);
}
