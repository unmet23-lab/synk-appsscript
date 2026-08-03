// SYNK 엔진 분할부 — 학습 데이터 수집 — 퀴즈 응답 로그·숙제 문항 연결·재작성문·오류 태그·회화 로그.
// 원본은 Code.js 단일 파일이었다. 로드 순서 정본 = .clasp.json filePushOrder(상수 정본 Code.js가 선두).
//
/* ═══════════════════ [v9.138] 이 파일이 존재하는 이유 ═══════════════════
 * 유호님 확정 계획: **개원 후 2년간 학원 앱으로 학습 데이터를 축적 → 그 데이터로 AI 한국어 회화 앱 출시.**
 * 즉 이 앱은 운영 도구이면서 동시에 **수집기**다. 그런데 08-03 실측에서 새는 곳이 드러났다:
 *
 *   ① 퀴즈 — 문항 100개를 매일 카드로 띄우는데 **학생이 무엇을 골랐는지 저장하는 곳이 없었다.**
 *      정답은 버튼이 열어주고 끝. 2년이면 수만 번의 선택이 통째로 허공으로 간다.
 *   ② 숙제 — 폼이 자유 텍스트라 **210개 문항 풀과 제출문이 연결돼 있지 않았다.**
 *      어느 과제가 어떤 오류를 유발하는지 영원히 알 수 없다.
 *   ③ 첨삭 — 원문·교정문은 남지만 오류 유형이 **자연어 문장으로만** 남아 집계가 불가능했다.
 *
 * 설계 원칙 3개 (여기 있는 모든 함수가 따른다):
 *   🔑 **수집이 채점보다 우선.** 채점은 틀려도 나중에 다시 할 수 있지만, 안 받아둔 응답은 영원히 없다.
 *      그래서 채점 실패는 행을 버리는 사유가 되지 않는다 — 원문을 적재하고 판정만 비운다.
 *   🔑 **문항 텍스트를 함께 스냅샷한다.** contents는 개정된다. ID만 저장하면 2년 뒤 "QZ31에 뭘 물었더라"가
 *      되어 데이터가 통째로 해석 불능이 된다. 지금 묻고 있는 문장을 그 자리에 박아 둔다.
 *   🔑 **Glide update 0.** 입구는 전부 Google Form이다(행 추가는 update를 안 먹는다).
 *      월 500 update 제약이 출시 최대 리스크라, 수집 때문에 운영이 죽으면 본말전도다.
 * ═══════════════════════════════════════════════════════════════════ */

/* ──────────────── ⓪ 숙제 첨삭 — 3단 데이터 + 오류 태그 어휘 ──────────────── */

/* [v9.138] hw_feedback 헤더 단일 정본 — 구 구조는 시트 골격(sheetSkeleton_)과 배치(aiFeedbackBatch_의
 *   ensureSheet)가 **각자 배열을 들고** 있어, 한쪽만 고치면 조용히 갈라진다(teacher_stats가 v9.40에서
 *   정확히 그렇게 3열 vs 8열로 벌어져 있었다). 새 열은 **끝에만** 붙인다 — 읽기 폭이 9·10·11로 고정된
 *   소비처 4곳이 인덱스로 접근하므로, 중간 삽입은 첨삭 카드 내용을 통째로 한 칸씩 밀어버린다.
 *
 * 뒤 4열이 「2년 축적 → AI 회화 앱」의 실제 재료다:
 *   숙제ID    — 어느 과제가 어떤 오류를 부르는지. 구 폼은 자유 텍스트라 210문항과 끊겨 있었다(교재 개정 근거이기도 하다)
 *   오류태그  — 같은 API 호출에서 함께 받는다(추가 비용 ≈ 0). 자연어 설명만으로는 3만 건을 집계할 수 없다
 *   재작성원본 — 이 제출이 어떤 첨삭에 대한 **2차 시도**인지. 원문→교정→재작성 3단이 여기서 조인으로 복원된다
 *   다시쓰기URL — 그 2차 시도로 들어가는 입구(스크립트가 채운다) */
const HW_FEEDBACK_HEADERS = ['id', 'student_id', '제출일', '제출문', '고친문장', '오늘의포인트', '칭찬', '다음미션',
  '상태', '학생확인', '포인트지급', '숙제ID', '오류태그', '재작성원본', '다시쓰기URL'];

/* 오류 태그 통제 어휘 — **자유 문자열이면 같은 오류가 열 가지 이름으로 쌓여 태그를 넣은 의미가 사라진다.**
 * JSON schema의 enum으로 모델에 강제하고, 집계도 이 상수를 읽는다(어휘와 집계가 갈라지지 않게).
 * 축의 근거: 몽골어 화자가 한국어에서 무너지는 지점은 대부분 ①조사 체계 ②활용/불규칙 ③높임 등급이다
 *   (몽골어도 SOV라 어순은 상대적으로 안전하다 — 그래서 어순은 1칸이면 충분하고 조사는 7칸을 준다).
 * ⚠ 이 목록을 고치면 **과거 데이터와 어휘가 갈라진다.** 늘리는 것은 안전하지만 이름 변경·삭제는
 *   2년치 집계를 깨뜨린다 — 바꿔야 한다면 새 태그를 추가하고 옛 태그는 남겨 둔다. */
const HW_ERROR_TAGS = [
  '조사:주격(이/가·은/는)', '조사:목적격(을/를)', '조사:처소(에·에서)', '조사:여격(에게·한테)',
  '조사:도구·방향(로/으로)', '조사:접속(와/과·하고)', '조사:기타',
  '어미:시제', '어미:연결어미', '어미:불규칙활용', '어미:종결',
  '높임:주체', '높임:상대(존댓말 등급)',
  '어휘:유의어혼동', '어휘:연어(자연스러운 짝)', '어휘:없는말',
  '맞춤법:받침', '맞춤법:띄어쓰기', '맞춤법:기타',
  '어순', '누락:필수성분', '중복:불필요', '오류없음'
];

/* 모델이 돌려준 태그를 어휘로 자른다 — schema enum이 1차 방어지만, 응답이 어긋나도
 * 시트에 정체불명 문자열이 쌓이는 것보다 버리는 편이 낫다(집계가 오염되면 되돌리기 어렵다). */
function hwTagsClean_(tags) {
  if (!tags || !tags.length) return '';
  const ok = {};
  HW_ERROR_TAGS.forEach(t => { ok[t] = 1; });
  const out = [];
  [].concat(tags).forEach(t => {
    const s = String(t || '').trim();
    if (ok[s] && out.indexOf(s) === -1) out.push(s);
  });
  return out.join(', ');
}

/* 기존 11열 hw_feedback을 15열로 증분 — 헤더만 보고 없는 것만 붙인다(멱등).
 * 이게 없으면 appendRow가 시트 폭을 넘는 칸을 조용히 버려, 태그·재작성 연결이 **적재되는 척하며 사라진다**. */
function hwFeedbackEnsureCols_(fb) {
  const need = HW_FEEDBACK_HEADERS.length;
  if (fb.getMaxColumns() < need) fb.insertColumnsAfter(fb.getMaxColumns(), need - fb.getMaxColumns());
  const cur = fb.getRange(1, 1, 1, need).getValues()[0];
  HW_FEEDBACK_HEADERS.forEach((h, i) => {
    if (String(cur[i] || '').trim() !== h) fb.getRange(1, i + 1).setValue(h);
  });
}

/* 「다시 써보기」 링크 — 학생ID + 원본 첨삭 id를 함께 프리필한다.
 * 틀이 없으면(폼 마이그레이션 전) 빈칸 — 링크 없는 카드는 구 동작 그대로다. */
function hwRedoUrlOf_(tmpl, sid, fbId) {
  if (!tmpl || !sid || !fbId) return '';
  return String(tmpl).replace(/SIDTOKEN/g, encodeURIComponent(sid)).replace(/REDOTOKEN/g, encodeURIComponent(fbId));
}

/* [v9.138] ▶ 1회 — 이미 만들어진 숙제 폼에 수집 문항 2개를 증분 추가한다.
 * createHwForm은 formAlreadyMade_ 가드로 **재실행 시 아무것도 하지 않으므로**, 라이브 폼은 영원히 구 2문항으로 남는다
 *   (동의 문구가 v9.103 전까지 라이브에 안 닿던 것과 같은 계급의 구멍이다).
 * 설계: ① 멱등 — 같은 제목이 있으면 스킵 ② 두 문항 모두 **선택 응답** — 필수로 만들면 이미 배포된
 *   구 프리필 링크(숙제ID 없이 열리는)가 전부 제출 불가가 된다 ③ URL 틀 2종을 여기서 재생성한다
 *   (기본 링크 = 학생ID+숙제ID / 다시쓰기 링크 = 학생ID+재작성원본). */
function migrateHwFormV9138() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const fid = String(getState(st, '숙제폼ID').val || '');
  if (!fid) { const m = '⚠️ 숙제폼ID 미연결 — createHwForm ▶ 먼저 실행하세요'; Logger.log(m); return m; }
  const out = [];
  try {
    const form = FormApp.openById(fid);
    const titles = form.getItems().map(x => String(x.getTitle()).trim());
    if (titles.indexOf('숙제ID') === -1) {
      form.addTextItem().setTitle('숙제ID').setRequired(false)
        .setHelpText('앱에서 열었다면 자동으로 채워져 있어요 — 비워 두셔도 제출됩니다');
      out.push('숙제ID: 추가(선택 응답)');
    } else out.push('숙제ID: 이미 있음 — 스킵');
    if (titles.indexOf('재작성원본') === -1) {
      form.addTextItem().setTitle('재작성원본').setRequired(false)
        .setHelpText('첨삭 카드의 「다시 써보기」로 들어왔다면 자동으로 채워져 있어요 — 처음 내는 숙제라면 비워 두세요');
      out.push('재작성원본: 추가(선택 응답)');
    } else out.push('재작성원본: 이미 있음 — 스킵');
    // URL 틀 2종 — 문항이 생긴 **뒤에** 만들어야 프리필 자리가 잡힌다
    setState(st, '숙제폼URL틀', prefillTemplate2_(form, '학생ID', '숙제ID', 'QZTOKEN'));
    setState(st, '숙제폼재작성틀', prefillTemplate2_(form, '학생ID', '재작성원본', 'REDOTOKEN'));
    out.push('URL 틀 2종 갱신 — 다음 calcAll부터 학생 행에 반영됩니다');
  } catch (e) { out.push('⚠️ 폼 접근 실패 — 숙제폼ID/권한 확인: ' + e); }
  const report = '📝 숙제 폼 수집 문항(v9.138)\n' + out.join('\n')
    + '\n\n이 두 문항이 하는 일: ①어느 과제가 어떤 오류를 부르는지 연결 ②원문→교정→재작성 3단 데이터'
    + '\n다음: calcAll ▶ → Glide 첨삭 카드에 「다시 써보기」 버튼(hw_feedback 다시쓰기URL 열)을 연결하세요.';
  Logger.log(report);
  if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 📝 숙제 폼 수집 문항 추가(v9.138)', report);
  return report;
}

/* ───────────────────────── ① 퀴즈 응답 로그 ───────────────────────── */

/* 문항 텍스트·정답을 행에 함께 박는다(위 원칙 2). '확신도'는 소요 시간의 대체재 —
 * 폼으로는 초를 잴 수 없지만, 맞았는지보다 **얼마나 확신했는지**가 회화 앱 개인화에 더 쓸모 있다
 * (정답이어도 '찍었어요'면 모르는 것이고, 오답인데 '확실해요'면 잘못 배운 것이다 — 둘은 처방이 다르다). */
const QUIZ_LOG_HEADERS = ['id', 'student_id', '퀴즈ID', '유형', '문제', '고른답', '정답', '정답여부', '확신도', '제출일', 'created_at'];
const QUIZ_CONFIDENCE = ['확실해요', '아마도', '찍었어요'];

/* 채점 정규화 — 원문자·공백·문장부호를 걷어낸다. 학생이 '①'로 쓰든 '1'로 쓰든 '1 번'으로 쓰든 같은 답이다. */
function quizNorm_(s) {
  return String(s == null ? '' : s)
    .replace(/[①②③④⑤]/g, m => String('①②③④⑤'.indexOf(m) + 1))
    .replace(/번째|번/g, '')
    .replace(/[\s.,·、，。!?！？'"'"「」（）()]/g, '')
    .toLowerCase();
}

/* 정답 문자열 → 허용 답 후보들.
 * contents의 정답부는 '① 에 — 방향·도착점은 에' 처럼 [핵심 — 해설] 형태가 많다. 해설은 채점 대상이 아니다.
 * 또 '의사 또는 간호사'처럼 복수 정답이 한 칸에 들어오기도 한다. */
function quizAnswerKeys_(correctRaw) {
  const raw = String(correctRaw || '').trim();
  if (!raw) return [];
  const head = raw.split(/[—–]/)[0].trim();     // em/en dash만 해설 구분자로 본다(하이픈은 답 안에 올 수 있다)
  const keys = {};
  const add = v => { const n = quizNorm_(v); if (n) keys[n] = 1; };
  head.split(/\s*또는\s*|\s*\/\s*/).forEach(part => {
    add(part);
    const m = String(part).match(/^([①②③④⑤]|\d)\s*(.*)$/); // '① 에' → 번호만·답만도 정답으로 받는다
    if (m) { add(m[1]); if (m[2]) add(m[2]); }
  });
  add(head);
  return Object.keys(keys);
}

/* 채점 — { ok: true|false|null, keys }. null = 판정 보류(정답 미등록·무응답).
 * 보류를 false(오답)로 뭉개면 2년치 정답률이 조용히 왜곡된다 — 모르는 것과 틀린 것은 다르다. */
function quizGrade_(ans, correctRaw) {
  const keys = quizAnswerKeys_(correctRaw);
  const a = quizNorm_(ans);
  if (!keys.length || !a) return { ok: null, keys: keys };
  return { ok: keys.indexOf(a) !== -1, keys: keys };
}

/* [v9.138] 🧠 오늘의 퀴즈 응답 폼 — 카드가 묻기만 하던 것을 받아 적는다.
 * 학생ID·퀴즈ID를 프리필로 받는 이유: 학생이 자기 ID를 손으로 치게 하면 오타가 곧 데이터 유실이고,
 *   퀴즈ID가 없으면 "무엇에 대한 답인지" 모르는 답만 쌓인다(구 숙제폼이 정확히 그 상태였다).
 * 재실행 안전 — formAlreadyMade_ 가드(구 폼 URL이 죽고 유령 응답 시트가 쌓이는 것을 막는다). */
function createQuizForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const doneQ = formAlreadyMade_(ss, '퀴즈폼_응답', '퀴즈폼URL틀', '퀴즈폼ID', '학생ID', '퀴즈 응답 폼');
  if (doneQ) return doneQ;
  const before = ss.getSheets().map(s => s.getName());
  const form = FormApp.create('SYNK 오늘의 퀴즈')
    .setDescription('오늘의 퀴즈에 답해 보세요 — 맞고 틀리고보다, 무엇을 골랐는지가 다음 수업을 만듭니다 🧠')
    .setCollectEmail(false);
  setState(ensureSheet(ss, 'app_state', ['key', 'value']), '퀴즈폼ID', form.getId()); // [v9.94 패턴] 생성 즉시 기록 — 뒤 단계가 타임아웃돼도 폼을 잃지 않는다
  form.addTextItem().setTitle('학생ID').setRequired(true).setHelpText('앱에서 열었다면 자동으로 채워져 있어요');
  form.addTextItem().setTitle('퀴즈ID').setRequired(true).setHelpText('앱에서 열었다면 자동으로 채워져 있어요 — 오늘 카드에 뜬 문제 번호입니다');
  form.addTextItem().setTitle('내 답').setRequired(true).setHelpText('번호(①/1)로 답해도 되고, 단어로 답해도 됩니다');
  // 확신도는 필수다 — 선택으로 두면 대부분 비게 되고, 그러면 이 축이 있으나 마나가 된다
  form.addMultipleChoiceItem().setTitle('얼마나 확신하나요?').setRequired(true)
    .setChoiceValues(QUIZ_CONFIDENCE)
    .setHelpText('솔직하게 골라주세요 — 찍었다고 해서 불이익은 전혀 없고, 오히려 다음 문제가 더 잘 맞춰집니다');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  linkFormTab_(ss, before, '퀴즈폼_응답');
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  setState(st, '퀴즈폼ID', form.getId());
  setState(st, '퀴즈폼URL틀', prefillTemplate2_(form, '학생ID', '퀴즈ID'));
  Logger.log('✅ 퀴즈 응답 폼 생성 완료! 다음 calcAll부터 profiles 퀴즈폼URL 열에 학생별 링크가 채워집니다.');
  Logger.log('편집용: ' + form.getEditUrl());
  return '퀴즈 응답 폼 생성 완료 — Glide 학생 홈에 「퀴즈 답하기」 버튼(퀴즈폼URL 열)을 연결하세요.';
}

/* 두 필드 프리필 틀 — prefillTemplateOf_(1개)의 확장. SIDTOKEN + 지정 토큰 자리를 치환해 쓴다.
 * 한 필드씩 두 번 만들면 두 URL이 되어 합칠 수 없다(프리필은 응답 1벌 단위로 직렬화된다).
 * token2를 인자로 받는 이유: 같은 폼에서 용도가 다른 링크를 두 벌 뽑기 때문이다
 *   (숙제 폼 = 기본 링크에 숙제ID / 다시쓰기 링크에 재작성원본 — 토큰이 같으면 서로를 덮어쓴다). */
function prefillTemplate2_(form, title1, title2, token2) {
  const items = form.getItems();
  const i1 = items.find(i => i.getTitle() === title1);
  const i2 = items.find(i => i.getTitle() === title2);
  return form.createResponse()
    .withItemResponse(i1.asTextItem().createResponse('SIDTOKEN'))
    .withItemResponse(i2.asTextItem().createResponse(token2 || 'QZTOKEN'))
    .toPrefilledUrl();
}

/* 숙제 폼 기본 링크 — 숙제ID는 **선택**이라 없어도 링크를 준다(그날 게시된 숙제가 없을 수 있고,
 * 무엇보다 숙제 제출 자체를 막으면 안 된다). 퀴즈와 규칙이 다른 이유가 여기 있다:
 * 퀴즈는 "무엇에 답했는지 모르는 답"이 무가치하지만, 숙제는 문장 자체가 이미 자산이다. */
function hwFormUrlOf_(tmpl, sid, hwId) {
  if (!tmpl || !sid) return '';
  return String(tmpl).replace(/SIDTOKEN/g, encodeURIComponent(sid)).replace(/QZTOKEN/g, encodeURIComponent(hwId || ''));
}

/* ──────────────── ③ AI 한국어 대화 — 회화 앱의 1세대이자 수집기 ──────────────── */

/* [v9.138] 🗣 「한국어로 말 걸기」 — 2년 뒤 만들 회화 앱을 **지금 허접하게 열어** 2년간 고친다.
 *
 * 정직하게 말하면 이것은 실시간 음성 회화가 아니라 **비동기 AI 펜팔**이다. 이 플랫폼에서 실시간은
 *   만들 수 없다 — 웹앱(HtmlService) 경로는 익명 google.script.run 브릿지 때문에 보안 철회됐고
 *   (`_보류_두뇌_웹화면.js`), Glide는 월 500 update 상한이 있어 왕복 대화를 감당하지 못한다.
 * 그런데 목표 관점에서는 오히려 이 형태가 맞다:
 *   ① **없던 데이터를 만든다.** 지금 쌓이는 것은 전부 단문·단답이라 「대화」가 0건이었다. 회화 앱을
 *      만들겠다면서 다회차 주고받기가 한 건도 없는 상태였다 — 이 구멍이 숙제·퀴즈보다 크다.
 *   ② 즉답이 아니라 **생각하고 쓴다.** 학습 효과가 오히려 높고, 비용·상한 통제가 쉽다.
 *   ③ 2년 뒤 처음 만드는 대신 **2년간 고친 것**을 내놓게 된다(데이터 결함은 쓸 때 드러난다).
 *
 * 안전: CLAUDE_API_KEY 없으면 0초 스킵 · 리허설이면 입구 차단(비용 0) · 학생당 하루 1턴 ·
 *   실행당 상한 · 응답은 시트에만 쓴다(외부 발송 0). */
/* [v9.145] 뒤 2열(`model`·`prompt_ver`)은 **소급 불가 항목**이라 학생이 쓰기 전에 넣는다.
 * 왜 필요한가: 이 데이터의 값은 「몽골어 화자가 어디서 무너지는지의 지도」인데(아래 커버리지 리포트 주석),
 *   2년간 프롬프트·모델을 바꿔가며 쌓으면 **「학생이 어려워한 것」과 「그때 우리 답이 나빴던 것」이 한 덩어리로 섞인다.**
 *   섞이면 지도가 틀어지고, 무엇으로 만든 답인지는 **되돌아가 알 수 없다**(원본 음성 보관과 같은 계열).
 * [v9.151] `audio_ref`(맨 끝) — 음성 원본 참조(Drive 파일ID 등). 보존 정책 = **무제한**(유호 확정 2026-08-04 ·
 *   판정 정본 = memory masterplan-v3-2026-08-04). 텍스트 폼 수집인 지금은 빈칸이고, 회화 앱(SYNK-talk)이
 *   녹음을 시작하는 날부터 원본 참조가 여기 착지한다 — 원본 없이 전사만 남기면 윗줄의 「원본 음성 보관」
 *   소급 불가가 그대로 실현된다(동의 문구는 이미 녹음 수집을 약속했다 — 약속만 있고 데이터가 없던 구멍).
 * ⚠ 새 열은 **반드시 끝에** 붙인다 — 이 시트는 r[1]·r[2]·r[3]·r[4]·r[6] 위치 접근을 쓴다(앞에 끼우면 전부 밀린다). */
const TALK_LOG_HEADERS = ['id', 'student_id', '턴', '학생문', 'AI답', '오류태그', '제출일', 'created_at', 'model', 'prompt_ver', 'audio_ref'];
const TALK_MAX_PER_RUN = 25;   // 야간 1회 상한 — 초과분은 포인터가 남아 다음 밤 이어진다(첨삭 배치와 같은 규약)
const TALK_CONTEXT_TURNS = 6;  // 문맥으로 되돌려 보내는 직전 턴 수 — 「대화」가 되려면 앞말을 기억해야 한다

/* 대화 시스템 프롬프트 — 상수로 뽑은 이유는 재사용이 아니라 **버전을 기계가 계산하게** 하기 위해서다. */
const TALK_SYSTEM_PROMPT = 'SYNK LAB(몽골 울란바토르 한국어 학원)의 한국어 대화 상대. 학생과 한국어로 편지처럼 주고받는다. '
  + '학생의 급수(1~6, 0=미정)에 맞춰 어휘·문장 길이를 조절한다 — 급수가 낮으면 짧고 쉬운 문장만 쓴다. '
  + '규칙: ①먼저 학생이 쓴 **내용**에 사람처럼 반응한다(교정부터 하지 않는다 — 말이 막히는 이유는 문법이 아니라 재미가 없어서다) '
  + '②틀린 표현은 답장 맨 끝에 한 줄로만, 「이렇게 하면 더 자연스러워요: …」 형태로 ③반드시 질문 하나로 끝낸다 '
  + '④"패배·실패·부족" 같은 부정 단어 금지 ⑤AI·시스템 자기 언급 금지 ⑥학생이 몽골어로 써도 한국어로 답하되, '
  + '아주 어려워하면 핵심 단어만 몽골어를 괄호 병기한다 ⑦개인정보(주소·전화·비밀번호)를 묻지 않는다.';

/* prompt_ver — **사람이 올리는 번호가 아니라 프롬프트에서 계산한 지문(8자리)**이다.
 *
 * 손으로 관리하는 버전 상수는 언젠가 반드시 안 올라간다. 그 순간 이 열은 「참인 채 거짓을 말하는」 열이 된다
 *   — 값이 v3이라고 적혀 있는데 실제 프롬프트는 다른 것(하루에 2건 겪은 실패 유형: catch의 「대체했다」·
 *   getSharingAccess의 파일 자신만 보기). 잘못 쓸 수 없는 통로를 만드는 쪽이 조항을 하나 더 붙이는 것보다 낫다.
 * 무엇이 답을 바꾸는가 = 시스템 프롬프트 + 모델 + 문맥 턴 수. 셋 중 **하나라도 바뀌면 지문이 바뀐다.**
 *   해시만으로는 「무엇이」 바뀌었는지 모르지만, 데이터를 층으로 가르는 데 필요한 것은 「언제 갈렸는가」이고
 *   실제 내용은 git 이력에 있다.
 * ⚠ 톱레벨에서 계산하지 않는다 — AI_FEEDBACK_MODEL은 Code.js에 있고 라이브 파일 로드 순서가 보장되지 않는다
 *   (Code.js 주석 190번 · 골격 지연 평가와 같은 이유). 반드시 호출 시점에 계산한다. */
function talkPromptVer_() {
  const raw = TALK_SYSTEM_PROMPT + '|model=' + (typeof AI_FEEDBACK_MODEL === 'undefined' ? '?' : AI_FEEDBACK_MODEL)
    + '|ctx=' + TALK_CONTEXT_TURNS;
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw, Utilities.Charset.UTF_8);
  return d.map(b => ((b & 0xFF) + 0x100).toString(16).slice(1)).join('').slice(0, 8);
}

/* 이미 만들어진 talk_log에 **새 열의 이름표를 붙인다.**
 * `ensureSheet`는 시트가 **없을 때만** 헤더를 쓴다(Code.js) — 그래서 v9.139로 이미 8열짜리가
 * 라이브에 서 있으면, 10칸짜리 행을 append해도 데이터만 들어가고 머리글은 8개인 채로 남는다.
 * 값은 있는데 그 열이 무엇인지 아무도 모르는 상태 = 「모름」을 「정상」으로 바꾸는 그 형태다.
 * 멱등하다 — 이미 길면 즉시 반환하므로 야간 배치가 매일 불러도 무비용이다. */
function talkHeaderHeal_(sh) {
  const need = TALK_LOG_HEADERS.length;
  if (sh.getMaxColumns() < need) sh.insertColumnsAfter(sh.getMaxColumns(), need - sh.getMaxColumns());
  const cur = sh.getRange(1, 1, 1, need).getValues()[0];
  if (String(cur[need - 1] || '').trim() === TALK_LOG_HEADERS[need - 1]) return; // 이미 붙어 있다
  sh.getRange(1, 1, 1, need).setValues([TALK_LOG_HEADERS]);
}

function createTalkForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const done = formAlreadyMade_(ss, '대화폼_응답', '대화폼URL틀', '대화폼ID', '학생ID', '한국어 대화 폼');
  if (done) return done;
  const before = ss.getSheets().map(s => s.getName());
  const form = FormApp.create('SYNK 한국어로 말 걸기')
    .setDescription('오늘 있었던 일, 궁금한 것, 아무거나 한국어로 써 보세요. 내일 아침에 답장이 와 있어요 💬')
    .setCollectEmail(false);
  setState(ensureSheet(ss, 'app_state', ['key', 'value']), '대화폼ID', form.getId());
  form.addTextItem().setTitle('학생ID').setRequired(true).setHelpText('앱에서 열었다면 자동으로 채워져 있어요');
  form.addParagraphTextItem().setTitle('하고 싶은 말').setRequired(true)
    .setHelpText('틀려도 괜찮아요 — 틀린 곳은 답장에서 살짝 고쳐 줍니다. 짧아도 좋아요');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  linkFormTab_(ss, before, '대화폼_응답');
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  setState(st, '대화폼ID', form.getId());
  setState(st, '대화폼URL틀', prefillTemplateOf_(form, '학생ID'));
  Logger.log('✅ 한국어 대화 폼 생성 완료! 야간 배치(22시)가 답장을 만듭니다.');
  return '한국어 대화 폼 생성 완료 — Glide 학생 홈에 「한국어로 말 걸기」 버튼(대화폼URL)을 연결하세요.';
}

/* 직전 턴들을 Claude messages 형식으로 — 이게 있어야 「대화」이고, 없으면 매번 처음 만난 사이가 된다.
 * rows를 **인자로 받는다**: 학생마다 시트를 다시 읽으면 25명 배치가 전체 읽기를 25번 한다
 *   (attDayMapCached_가 반 18개 × 전체 읽기로 배운 것과 같은 계급 — 호출부가 이미 한 번 읽으므로 추가 읽기 0).
 * 답장이 빈 행(API 실패로 학생 문장만 남은 행)은 assistant 턴을 만들지 않는다 — 빈 assistant는 API가 거부한다. */
function talkHistory_(rows, sid) {
  if (!rows || !rows.length) return [];
  const mine = rows.filter(r => String(r[1] || '').trim() === sid).slice(-TALK_CONTEXT_TURNS);
  const msgs = [];
  mine.forEach(r => {
    if (String(r[3] || '').trim()) msgs.push({ role: 'user', content: String(r[3]) });
    if (String(r[4] || '').trim()) msgs.push({ role: 'assistant', content: String(r[4]) });
  });
  return msgs;
}

function callClaudeTalk_(apiKey, stu, history, text) {
  if (isRehearsal_()) { rehearsalNote_('AI 대화 callClaudeTalk_ (차단·비용 0)'); throw new Error('리허설 모드: AI 호출 차단'); }
  const schema = {
    type: 'object', additionalProperties: false,
    required: ['reply', 'error_tags'],
    properties: {
      reply: { type: 'string', description: '한국어 답장 2~4문장. 먼저 내용에 진짜로 반응하고, 틀린 표현이 있으면 마지막에 한 줄로 부드럽게 고쳐 준다. 반드시 질문 하나로 끝내 대화가 이어지게 한다' },
      error_tags: { type: 'array', maxItems: 4, items: { type: 'string', enum: HW_ERROR_TAGS }, description: '학생 문장에서 발견한 오류 유형(집계용·학생에게 안 보임). 없으면 ["오류없음"]' }
    }
  };
  const body = {
    model: AI_FEEDBACK_MODEL,
    max_tokens: 2048,
    system: TALK_SYSTEM_PROMPT,   // 상수 참조 — 여기 인라인으로 되돌리면 prompt_ver가 변경을 못 본다
    messages: history.concat([{ role: 'user', content: text }]),
    output_config: { format: { type: 'json_schema', schema: schema } }
  };
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(body), muteHttpExceptions: true
  });
  const permErr = msg => { const e = new Error(msg); e.permanent = true; return e; };
  const rc = res.getResponseCode();
  if (rc !== 200) {
    const e = new Error('Claude API ' + rc + ': ' + res.getContentText().slice(0, 200));
    e.permanent = (rc === 400 || rc === 404 || rc === 413 || rc === 422);
    throw e;
  }
  const j = JSON.parse(res.getContentText());
  if (j.stop_reason === 'refusal') throw permErr('Claude 거부(refusal)');
  if (j.stop_reason === 'max_tokens') throw permErr('출력 잘림(max_tokens)');
  const tb = (j.content || []).filter(b => b.type === 'text')[0];
  if (!tb || !tb.text) throw permErr('응답에 text 블록 없음(stop_reason=' + j.stop_reason + ')');
  try { return JSON.parse(tb.text); } catch (e) { throw permErr('대화 JSON 파싱 실패: ' + String(tb.text).slice(0, 80)); }
}

/* 야간 배치 — 대화폼_응답 → talk_log(학생문 + AI답).
 * 포인터·상한·오류 분류는 aiFeedbackBatch_와 같은 규약을 그대로 쓴다(같은 실패 모드를 두 번 배우지 않게). */
function talkBatch_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('CLAUDE_API_KEY');
  if (!apiKey) return; // 키 미설정 = 기능 OFF
  const src = ss.getSheetByName('대화폼_응답');
  if (!src || src.getLastRow() < 2) return;
  const last = src.getLastRow();
  const from = Number(props.getProperty('대화폼_포인터')) || 1;
  if (from > last) { props.setProperty('대화폼_포인터', String(last)); return; }
  if (from >= last) return;
  const tz = ss.getSpreadsheetTimeZone();
  const rows = src.getRange(from + 1, 1, last - from, 3).getValues(); // 타임스탬프·학생ID·하고 싶은 말
  if (isRehearsal_()) { rehearsalNote_('AI 대화 배치: 대기 ' + rows.length + '건 전량 차단(비용 0·포인터 불변)'); return; }

  const info = {};
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 67).getValues().forEach(r => {
    if (r[0] && r[3] === 'student') info[String(r[0]).trim()] = { name: r[1] || r[0], lv: Number(r[66]) || 0 };
  });
  const tl = ensureSheet(ss, 'talk_log', TALK_LOG_HEADERS);
  talkHeaderHeal_(tl);   // [v9.145] 이미 서 있는 8열 시트에 model·prompt_ver 이름표를 붙인다
  // 학생당 하루 1턴 — 상한이 없으면 한 명이 밤새 눌러 그날 예산을 혼자 태운다(비용은 사람 수가 아니라 열정에 비례한다)
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const turns = {}, todayDone = {};
  // 전체를 **한 번만** 읽고 턴 수·오늘 여부·대화 문맥을 같은 배열에서 얻는다(학생마다 재읽기 금지)
  const logRows = tl.getLastRow() >= 2 ? tl.getRange(2, 1, tl.getLastRow() - 1, TALK_LOG_HEADERS.length).getValues() : [];
  logRows.forEach(r => {
    const s = String(r[1] || '').trim();
    if (!s) return;
    turns[s] = Math.max(turns[s] || 0, Number(r[2]) || 0);
    if (String(r[6] || '') === today) todayDone[s] = 1;
  });

  const pver = talkPromptVer_();          // 실행 1회 계산 — 배치 중엔 안 바뀐다
  const model = typeof AI_FEEDBACK_MODEL === 'undefined' ? '' : AI_FEEDBACK_MODEL;
  const t0 = Date.now();
  const BUDGET_MS = 120000;
  let made = 0, processed = 0, skipped = 0, permFails = 0, lastErr = '';
  const badSid = [];
  for (let i = 0; i < rows.length; i++) {
    if (made >= TALK_MAX_PER_RUN || Date.now() - t0 > BUDGET_MS) break;
    const ts = rows[i][0] instanceof Date ? rows[i][0] : new Date();
    const sid = String(rows[i][1] || '').trim();
    const text = String(rows[i][2] || '').trim().slice(0, 1500);
    const stu = info[sid];
    if (!sid || !stu || !text) { if (sid && !stu) badSid.push(sid); processed = i + 1; continue; }
    if (todayDone[sid]) { skipped++; processed = i + 1; props.setProperty('대화폼_포인터', String(from + processed)); continue; }
    try {
      const turn = (turns[sid] || 0) + 1;
      const card = callClaudeTalk_(apiKey, stu, talkHistory_(logRows, sid), text);
      // 🔒 학생문은 물론 AI답도 감싼다 — 프롬프트 인젝션으로 모델에게 `=…`로 시작하는 답을 뱉게 할 수 있다
      const row = ['TK' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd') + '-' + sid + '-' + turn, sid, turn,
        셀안전_(text), 셀안전_(String(card.reply || '')), hwTagsClean_(card.error_tags), dstr(ts, tz), new Date(),
        model, pver, '']; // [v9.151] audio_ref — 텍스트 폼 경로는 빈칸(녹음이 붙는 날 원본 참조가 들어온다)
      tl.appendRow(row);
      logRows.push(row); // 같은 실행 안에서 같은 학생이 여러 번 나와도 문맥이 이어지게(하루 1턴 가드가 있어 드물지만 공짜다)
      turns[sid] = turn; todayDone[sid] = 1;
      made++; processed = i + 1;
      props.setProperty('대화폼_포인터', String(from + processed)); // 성공분 즉시 전진 — 6분 하드킬에도 중복 과금 0
      Utilities.sleep(300);
    } catch (e) {
      if (e && e.permanent) {
        // 답장을 못 만들어도 **학생이 쓴 문장은 남긴다** — 대화 데이터의 절반은 이미 여기 있다
        permFails++;
        // 실패 행에도 model·prompt_ver를 남긴다 — 「어느 버전에서 실패가 몰렸나」가 나중에 유일한 단서다
        tl.appendRow(['TK' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd') + '-' + sid + '-오류', sid, (turns[sid] || 0) + 1,
          셀안전_(text), '', '', dstr(ts, tz), new Date(), model, pver, '']);
        processed = i + 1;
        props.setProperty('대화폼_포인터', String(from + processed));
        continue;
      }
      lastErr = String(e && e.message ? e.message : e).slice(0, 200);
      break;
    }
  }
  if (processed > 0) props.setProperty('대화폼_포인터', String(from + processed));
  notifyDroppedSids_('대화폼', badSid);
  if (made || permFails || lastErr) adminMail('[SYNK] 🗣 AI 대화 답장 ' + made + '건'
    + (skipped ? ' · 하루 1턴 초과 스킵 ' + skipped : '') + (permFails ? ' · 오류 ' + permFails + '건' : '') + (lastErr ? ' · 중단됨' : ''),
    '답장은 talk_log에 적재됐습니다(외부 발송 0 — 학생은 앱에서 읽습니다).\n'
    + (permFails ? '\n오류 ' + permFails + '건은 학생 문장만 남기고 답장을 비웠습니다(대화 데이터의 절반은 보존).' : '')
    + (lastErr ? '\n마지막 오류: ' + lastErr + '\n실패 지점부터 내일 밤 자동 재시도합니다.' : ''));
}

/* [v9.146] 🔎 대화 수집 점검 — 「오늘 밤 배치에 잘 들어갔나」를 10초에 답한다.
 *
 * 왜 필요한가: v9.145로 `model`·`prompt_ver` 2열을 넣었는데, **확인할 방법이 없었다.**
 *   시트를 눈으로 열어도 「비어 있는 게 정상인지 고장인지」를 구분할 수 없다 —
 *   `talkBatch_`는 조기 반환이 4개(키 없음·응답 0건·포인터 끝·리허설)이고, 그중 무엇에 걸려도
 *   증상은 똑같이 **「아무 일도 안 일어남」**이다. 「모름」과 「정상」이 같은 모양인 그 형태다.
 * 그래서 이 함수는 결과가 아니라 **조건부터** 보여준다 — 안 생겼다면 넷 중 무엇 때문인지 지목한다.
 *
 * ⚠ 읽기 전용이 **아니다**(헤더 치유를 겸한다). 그게 의도다 —
 *   `talkHeaderHeal_`은 `talkBatch_` 안쪽 조기 반환 **뒤에** 있어서, 학생이 첫 대화를 쓰기 전까지는
 *   영영 실행되지 않는다. 여기서 부르면 배치를 기다리지 않고 지금 이름표가 붙는다. 멱등이라 여러 번 눌러도 안전. */
function talkLogCheck() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const out = [];

  out.push('■ 배치가 돌기 위한 조건');
  out.push(props.getProperty('CLAUDE_API_KEY')
    ? '  ✅ CLAUDE_API_KEY 설정됨'
    : '  ⛔ CLAUDE_API_KEY 없음 → 대화 기능 전체가 꺼져 있습니다(밤 배치가 0초에 끝납니다)');
  const src = ss.getSheetByName('대화폼_응답');
  if (!src) {
    out.push('  ⛔ 「대화폼_응답」 시트 없음 → SYNK 메뉴 「🗣 한국어 대화 폼 만들기」를 먼저 누르세요');
  } else {
    const answered = Math.max(0, src.getLastRow() - 1);
    if (!answered) {
      out.push('  ⏸ 대화폼 응답 0건 → 학생이 쓴 글이 없어 오늘 밤 배치는 **아무것도 만들지 않습니다**(고장 아님)');
    } else {
      const ptr = Number(props.getProperty('대화폼_포인터')) || 1;
      out.push('  ✅ 응답 ' + answered + '건 · 아직 답장 안 만든 것 ' + Math.max(0, src.getLastRow() - ptr) + '건');
    }
  }
  if (isRehearsal_()) out.push('  ⚠ 지금 리허설 모드 → 배치가 입구에서 차단됩니다(비용 0·기록도 0)');

  out.push('', '■ talk_log 상태');
  const tl = ss.getSheetByName('talk_log');
  if (!tl) {
    out.push('  아직 없음 — 첫 답장이 만들어질 때 자동 생성됩니다');
  } else {
    talkHeaderHeal_(tl);   // 배치를 기다리지 않고 지금 이름표를 붙인다
    out.push('  머리글: ' + tl.getRange(1, 1, 1, TALK_LOG_HEADERS.length).getValues()[0].join(' · '));
    const n = Math.max(0, tl.getLastRow() - 1);
    out.push('  기록 ' + n + '행');
    if (n) {
      const show = Math.min(3, n);
      tl.getRange(tl.getLastRow() - show + 1, 1, show, TALK_LOG_HEADERS.length).getValues()
        .forEach(r => out.push('   · ' + r[0] + '   model=' + (r[8] || '(빈칸)') + '   prompt_ver=' + (r[9] || '(빈칸)')));
      out.push('  ※ v9.145 이전에 쌓인 행은 두 칸이 비어 있습니다 — 소급이 안 되는 값이라 정상입니다');
    }
  }

  out.push('', '■ 지금 배치가 쓸 값(위 기록과 대조하세요)');
  out.push('  model = ' + (typeof AI_FEEDBACK_MODEL === 'undefined' ? '(못 읽음)' : AI_FEEDBACK_MODEL));
  out.push('  prompt_ver = ' + talkPromptVer_());
  return out.join('\n');
}

/* ──────────────── ② 커버리지 계기판 — 양이 아니라 「유형」을 잰다 ──────────────── */

/* [v9.138] 📊 수집 커버리지 리포트 — 아무도 안 재던 지표.
 *
 * 왜 건수가 아니라 커버리지인가: 학생 150명 × 2년이면 3만 건 안팎이다. LLM 관점에서 그 양은
 *   모델을 바꾸지 못하고, 애초에 Claude는 이미 한국어를 안다. **이 데이터의 값은 「한국어를 가르치는
 *   재료」가 아니라 「몽골어 화자가 어디서 무너지는지의 지도」**이고, 지도는 넓이가 아니라 빈칸으로 평가된다.
 *   200명이 같은 조사 실수만 반복하면 3만 건이어도 유형 30개짜리 데이터다.
 *
 * 그래서 이 리포트는 **비어 있는 칸을 먼저 보여준다.** 그 칸이 곧 다음 시즌에 일부러 유도할 숙제·퀴즈다
 *   — 수집이 수동적 축적에서 능동적 사냥으로 바뀌는 지점이고, 「6개월마다 열어본다」의 실행 수단이다
 *   (데이터의 결함은 쌓을 때가 아니라 **쓸 때** 드러난다. 2년 뒤 처음 열어보면 되돌릴 방법이 없다).
 * 읽기 전용 — 시트를 쓰지 않는다(언제 눌러도 안전). */
function dataCoverageReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const L = [];
  const 태그수 = {};
  HW_ERROR_TAGS.forEach(t => { 태그수[t] = 0; });

  // ① 숙제 첨삭 — 오류 태그 분포 + 3단 데이터(원문→교정→재작성) 완성 수
  const fb = ss.getSheetByName('hw_feedback');
  let 첨삭 = 0, 태그있음 = 0, 재작성 = 0, 문항연결 = 0;
  if (fb && fb.getLastRow() >= 2) {
    const w = Math.min(HW_FEEDBACK_HEADERS.length, fb.getLastColumn());
    fb.getRange(2, 1, fb.getLastRow() - 1, w).getValues().forEach(r => {
      첨삭++;
      if (String(r[11] || '').trim()) 문항연결++;              // L 숙제ID
      const tg = String(r[12] || '').trim();                    // M 오류태그
      if (tg) { 태그있음++; tg.split(',').forEach(t => { const k = t.trim(); if (k in 태그수) 태그수[k]++; }); }
      if (String(r[13] || '').trim()) 재작성++;                 // N 재작성원본
    });
  }
  const 빈칸 = HW_ERROR_TAGS.filter(t => t !== '오류없음' && !태그수[t]);
  const 상위 = HW_ERROR_TAGS.filter(t => 태그수[t] > 0).sort((a, b) => 태그수[b] - 태그수[a]).slice(0, 8);

  L.push('■ 숙제 첨삭 (원문↔교정 병렬쌍 — 가장 값나가는 자산)');
  L.push('  전체 ' + 첨삭 + '건 · 오류 태그 있음 ' + 태그있음 + '건 · 문항 연결 ' + 문항연결 + '건 · 재작성(3단) ' + 재작성 + '건');
  if (첨삭 && !태그있음) L.push('  ⚠️ 태그가 한 건도 없습니다 — v9.138 이전 제출분이거나 배치가 아직 안 돌았습니다(원문이 남아 있어 소급 재처리는 가능).');
  if (상위.length) L.push('  많이 틀리는 순: ' + 상위.map(t => t + ' ' + 태그수[t]).join(' · '));
  L.push('  🕳 아직 한 건도 못 잡은 오류 유형 ' + 빈칸.length + '/' + (HW_ERROR_TAGS.length - 1) + (빈칸.length ? ': ' + 빈칸.join(', ') : ' — 전 유형 확보'));

  // ② 퀴즈 — 「무엇을 골랐나」. 확신도 축이 실제로 채워지는지가 관건(비면 그 축은 없는 것과 같다)
  const ql = ss.getSheetByName('quiz_log');
  let 응답 = 0, 정답 = 0, 보류 = 0, 문항종 = {}, 찍음 = 0;
  if (ql && ql.getLastRow() >= 2) {
    ql.getRange(2, 1, ql.getLastRow() - 1, QUIZ_LOG_HEADERS.length).getValues().forEach(r => {
      응답++;
      문항종[String(r[2] || '')] = 1;
      const v = String(r[7] || '');
      if (v === '정답') 정답++; else if (v === '판정보류') 보류++;
      if (String(r[8] || '') === '찍었어요') 찍음++;
    });
  }
  L.push('');
  L.push('■ 퀴즈 응답 (소급 절대 불가 축 — 그날 고른 답은 다시 못 받는다)');
  L.push('  응답 ' + 응답 + '건 · 다룬 문항 ' + Object.keys(문항종).length + '종 · 정답 ' + 정답 + ' · 판정보류 ' + 보류 + ' · 「찍었어요」 ' + 찍음);
  if (!응답) L.push('  ⚠️ 0건 — 퀴즈 응답 폼이 없거나(SYNK 메뉴 ▸ 퀴즈 응답 폼 만들기) Glide 버튼이 아직 안 붙었습니다.');
  else if (정답 + 보류 < 응답 * 0.99 && 응답 > 20) {
    const 정답률 = Math.round(정답 / Math.max(1, 응답 - 보류) * 100);
    L.push('  정답률 ' + 정답률 + '%(판정보류 제외) — 「찍었어요」인데 정답인 건은 아직 모르는 것으로 읽습니다.');
  }

  // ③ 음성 — 전사(STT)가 붙어야 라벨 있는 데이터가 된다
  const vl = ss.getSheetByName('voice_log');
  let 녹음 = 0, 전사 = 0;
  if (vl && vl.getLastRow() >= 2) {
    const w = Math.min(9, vl.getLastColumn());
    vl.getRange(2, 1, vl.getLastRow() - 1, w).getValues().forEach(r => { 녹음++; if (String(r[6] || '').trim()) 전사++; });
  }
  L.push('');
  L.push('■ 목소리  녹음 ' + 녹음 + '건 · 전사 완료 ' + 전사 + '건' + (녹음 && !전사 ? ' ⚠️ 전사 0 — 라벨 없는 오디오는 나중에 소급 가능하지만, 지금 붙이면 발음 오류 사전이 함께 자랍니다.' : ''));

  // ④ 대화 — 회화 앱의 핵심 재료. 「턴이 이어지는가」가 관건이다(1턴짜리만 쌓이면 그건 대화가 아니라 단문이다)
  const tl = ss.getSheetByName('talk_log');
  let 턴 = 0, 최장 = 0, 참여 = {};
  if (tl && tl.getLastRow() >= 2) {
    tl.getRange(2, 1, tl.getLastRow() - 1, TALK_LOG_HEADERS.length).getValues().forEach(r => {
      턴++;
      const s = String(r[1] || '').trim();
      if (s) 참여[s] = Math.max(참여[s] || 0, Number(r[2]) || 0);
      최장 = Math.max(최장, Number(r[2]) || 0);
    });
  }
  const 학생수 = Object.keys(참여).length;
  L.push('');
  L.push('■ AI 대화 (회화 앱의 핵심 — 다른 어디서도 안 나오는 데이터)');
  L.push('  누적 ' + 턴 + '턴 · 참여 ' + 학생수 + '명 · 가장 긴 대화 ' + 최장 + '턴'
    + (학생수 ? ' · 평균 ' + (Math.round(턴 / 학생수 * 10) / 10) + '턴' : ''));
  if (!턴) L.push('  ⚠️ 0턴 — 대화 폼이 없거나(SYNK 메뉴 ▸ 한국어 대화 폼 만들기) CLAUDE_API_KEY가 없습니다.');
  else if (최장 < 3) L.push('  ⚠️ 아직 이어지는 대화가 없습니다(최장 ' + 최장 + '턴) — 답장이 질문으로 끝나는지, 학생이 답장을 읽는 화면이 있는지 확인하세요.');

  /* ⑤ [v9.147] 참여율 — **기능 압축의 부작용을 재는 유일한 계기다.**
   *   압축 판정의 축이 「학생을 로그 입구까지 데려오는가」였는데, 그걸 재는 숫자가 없으면
   *   압축이 감량인지 출혈인지 영영 모른 채 지나간다(적대 리뷰가 지목한 가장 큰 구멍).
   *   분모는 재원 학생 수, 분자는 최근 7일에 **무엇이든 하나라도 낸** 학생 수다 —
   *   총량(건수)은 소수의 열성 학생이 혼자 끌어올릴 수 있어 참여를 못 잰다. */
  const 최근 = new Date(Date.now() - 7 * 86400000);
  const 활동 = new Set();
  const 최근카운트 = (name, sidCol, dateCol, width) => {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;
    const w = Math.min(width, sh.getLastColumn());
    sh.getRange(2, 1, sh.getLastRow() - 1, w).getValues().forEach(r => {
      const s = String(r[sidCol] || '').trim();
      const d = r[dateCol] ? asDate_(r[dateCol]) : null;
      if (s && d && d >= 최근) 활동.add(s);
    });
  };
  최근카운트('hw_feedback', 1, 2, 3);   // 숙제 제출(첨삭 행 = 제출의 증거)
  최근카운트('quiz_log', 1, 9, 10);      // 퀴즈 응답
  최근카운트('talk_log', 1, 6, 7);       // 대화
  let 재원 = 0;
  const pfC = ss.getSheetByName('profiles');
  if (pfC && pfC.getLastRow() >= 2) pfC.getRange(2, 1, pfC.getLastRow() - 1, 4).getValues().forEach(r => {
    if (r[0] && r[3] === 'student') 재원++;
  });
  L.push('');
  L.push('■ 참여율 (압축이 감량인지 출혈인지를 가르는 숫자)');
  L.push('  최근 7일에 하나라도 낸 학생 ' + 활동.size + '/' + 재원 + '명'
    + (재원 ? ' (' + Math.round(활동.size / 재원 * 100) + '%)' : ''));
  if (재원 && 활동.size < 재원 * 0.5) L.push('  ⚠️ 절반 아래입니다 — 총량이 늘어도 이 숫자가 내려가면 압축이 접속을 깎고 있다는 뜻입니다(끈 기능을 되살릴 판단 재료).');

  // ⑥ [v9.147] 골든셋 — 학생이 아니라 **정답**을 쌓는 칸. 이게 비면 2년 뒤 모델 선택을 감으로 한다
  const gd = ss.getSheetByName('teacher_gold');
  let 표본 = 0, 응답G = 0, 수정 = 0;
  if (gd && gd.getLastRow() >= 2) gd.getRange(2, 1, gd.getLastRow() - 1, GOLD_HEADERS.length).getValues().forEach(r => {
    표본++;
    const v = String(r[6] || '').trim(); // G 강사판정
    if (v) 응답G++;
    if (String(r[7] || '').trim()) 수정++; // H 강사교정
  });
  L.push('');
  L.push('■ 강사 교정 골든셋 (2년 뒤 「어느 모델이 우리 학생에게 맞는가」의 채점표)');
  L.push('  표본 ' + 표본 + '건 · 강사 응답 ' + 응답G + '건 · 그중 교정 수정 ' + 수정 + '건');
  if (표본 && !응답G) L.push('  ⚠️ 표본은 뽑히는데 응답이 0 — 강사가 그 탭을 안 보고 있습니다(유인이 0인 업무라 예상된 실패 모드입니다).');
  else if (응답G && 수정 === 응답G) L.push('  ⚠️ 전부 「고칠 곳이 있다」로만 쌓였습니다 — 「AI가 맞았다」 라벨이 0이면 재현율을 못 재는 반쪽 채점표가 됩니다.');

  const head = '📊 학습 데이터 커버리지 — ' + Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') + '\n'
    + '(「2년 축적 → AI 회화 앱」 진척. 중요한 것은 총량이 아니라 **비어 있는 유형**입니다)\n\n';
  const report = head + L.join('\n')
    + '\n\n다음 수: 빈 유형이 있으면 그 문법을 겨냥한 숙제·퀴즈를 다음 시즌에 넣으세요 — 안 나오는 오류는 안 쌓입니다.';
  Logger.log(report);
  return report;
}

/* 학생별 퀴즈 폼 링크 — SIDTOKEN·QZTOKEN 두 자리를 함께 치환한다(formUrlOf는 sid 한 자리 전용).
 * 퀴즈ID가 없으면 **빈 링크를 준다**: ID 없는 응답은 "무엇에 대한 답인지 모르는 답"이라 해석이 불가능하고,
 * 그런 행이 섞이면 2년치 집계에서 분모만 키운다 — 안 받는 편이 낫다. */
function quizFormUrlOf_(tmpl, sid, qid) {
  if (!tmpl || !qid) return '';
  return String(tmpl).replace(/SIDTOKEN/g, encodeURIComponent(sid)).replace(/QZTOKEN/g, encodeURIComponent(qid));
}

/* [v9.138] 퀴즈폼_응답 → quiz_log 전개(10분 스위프 편승).
 * 포인터 전진 규약은 sweepAttendanceForm_과 동일 — 재실행해도 행이 늘지 않는다.
 * ⚠ 무효 행(미등록 sid)도 **버리되 통보**한다(notifyDroppedSids_) — 조용한 드롭은 결함을 영원히 숨긴다. */
function quizSweep_(ss) {
  const src = ss.getSheetByName('퀴즈폼_응답');
  if (!src || src.getLastRow() < 2) return;
  const props = PropertiesService.getScriptProperties();
  const last = src.getLastRow();
  const from = Number(props.getProperty('퀴즈폼_포인터')) || 1;
  if (from > last) { props.setProperty('퀴즈폼_포인터', String(last)); return; }
  if (from >= last) return;
  const tz = ss.getSpreadsheetTimeZone();
  const rows = src.getRange(from + 1, 1, last - from, 5).getValues(); // 타임스탬프·학생ID·퀴즈ID·내 답·확신도

  const valid = new Set();
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 4).getValues().forEach(r => {
    if (r[0] && r[3] === 'student') valid.add(String(r[0]).trim());
  });

  // 문항 스냅샷 재료 — contents A=ID · B=유형 · C=분류 · D='문제|정답'
  const qMap = {};
  const ct = ss.getSheetByName('contents');
  if (ct && ct.getLastRow() >= 2) ct.getRange(2, 1, ct.getLastRow() - 1, 4).getValues().forEach(r => {
    if (String(r[1] || '') !== 'quiz' || !r[0]) return;
    const parts = String(r[3] || '').split('|');
    qMap[String(r[0]).trim()] = { cat: String(r[2] || ''), q: parts[0] || '', a: parts.length > 1 ? parts.slice(1).join('|') : '' };
  });

  const ql = ensureSheet(ss, 'quiz_log', QUIZ_LOG_HEADERS);
  const seen = {}; // '퀴즈ID|sid' — 같은 문항 재제출은 첫 답만 센다(고쳐 낸 답은 "무엇을 골랐나"를 오염시킨다)
  if (ql.getLastRow() >= 2) ql.getRange(2, 2, ql.getLastRow() - 1, 2).getValues().forEach(r => {
    if (r[0] && r[1]) seen[String(r[1]).trim() + '|' + String(r[0]).trim()] = 1;
  });

  const out = [], badSid = [];
  rows.forEach(r => {
    const ts = r[0] instanceof Date ? r[0] : new Date();
    const sid = String(r[1] || '').trim();
    const qid = String(r[2] || '').trim();
    const ans = String(r[3] || '').trim().slice(0, 300); // 폭주 입력 상한(숙제폼 2000자 패턴)
    const conf = String(r[4] || '').trim();
    if (!sid || !qid || !ans) return;
    if (!valid.has(sid)) { badSid.push(sid); return; }
    const key = qid + '|' + sid;
    if (seen[key]) return;
    seen[key] = 1;
    const meta = qMap[qid] || { cat: '', q: '', a: '' };
    const g = quizGrade_(ans, meta.a);
    /* 🔒 셀 수식 인젝션 차단 — 학생이 낸 답이 `=`로 시작하면 시트가 그것을 **수식으로 실행**한다.
     *   이 스프레드시트에는 profiles(학생·보호자 연락처)가 함께 있어,
     *   `=IMPORTDATA("...?d="&TEXTJOIN(",",1,profiles!B2:B60))` 한 줄로 개인정보가 외부로 나간다
     *   — 사람이 셀을 클릭할 필요도 없다(시트가 스스로 평가한다).
     *   상담AI가 페이스북 텍스트를 받으며 같은 이유로 셀안전_를 도입했다(v9.137) — 학생 입력도 남의 글이다. */
    out.push(['QL' + Utilities.formatDate(ts, tz, 'yyyyMMdd') + '-' + sid + '-' + qid, sid, 셀안전_(qid),
      meta.cat, meta.q, 셀안전_(ans), meta.a,
      g.ok === null ? '판정보류' : (g.ok ? '정답' : '오답'), // 원칙: 판정 못 해도 행은 남는다
      셀안전_(conf), dstr(ts, tz), new Date()]);
  });
  if (out.length) ql.getRange(ql.getLastRow() + 1, 1, out.length, QUIZ_LOG_HEADERS.length).setValues(out);
  props.setProperty('퀴즈폼_포인터', String(last));
  notifyDroppedSids_('퀴즈폼', badSid);
  if (out.length) Logger.log('퀴즈 응답 ' + out.length + '건 적재(quiz_log)');
  퀴즈응답포인트_(ss, out, tz); // [v9.147] 적재된 응답에만 지급 — 지급이 적재보다 앞서면 "받았는데 안 쌓인 답"이 생긴다
}

/* [v9.147] 🎯 퀴즈 응답 포인트 — 「데이터를 낳는 행동」에 보상을 옮기는 두 경로 중 하나(다른 하나는 재작성).
 * 설계 결정 3개:
 *   ① **정답 여부와 무관하게 지급한다.** 정답에만 주면 확신도 3택이 거짓말을 시작한다 — '찍었어요'를 고르면
 *      손해라고 느끼는 순간 그 축이 죽고, 확신도는 quiz_log에서 가장 값비싼 열이다(정답인데 찍음 = 모르는 것).
 *   ② **1일 1회 상한.** 퀴즈는 10초짜리 행동이라 무제한이면 파밍이 되고, 파밍된 응답은 데이터도 오염시킨다.
 *   ③ 지급은 **적재 뒤**에만(위 호출 위치) — 순서가 뒤집히면 "포인트는 받았는데 로그엔 없는" 행이 생긴다.
 * 멱등: 오늘 이미 '퀴즈응답'을 받은 학생은 건너뛴다(sweepFeedbackAck_ 패턴) + DAILY_LIMIT 야간 정정이 2차 그물. */
function 퀴즈응답포인트_(ss, loaded, tz) {
  if (!loaded || !loaded.length) return;
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const doneToday = new Set();
  const pl = ss.getSheetByName('point_logs');
  if (pl && pl.getLastRow() >= 2) pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues().forEach(r => {
    if (r[1] && r[5] && String(r[3] || '') === '퀴즈응답' &&
        Utilities.formatDate(asDate_(r[5]), tz, 'yyyy-MM-dd') === today) doneToday.add(String(r[1]).trim());
  });
  const grants = [];
  loaded.forEach(row => {
    const sid = String(row[1] || '').trim();
    // 이 스위프에서 같은 학생이 3문항을 냈어도 1회 — doneToday에 즉시 넣어 루프 안에서도 상한이 선다
    if (!sid || doneToday.has(sid)) return;
    doneToday.add(sid);
    grants.push([sid, PT.퀴즈응답, '퀴즈응답', '시스템']);
  });
  if (grants.length) appendPoints(ss, grants);
}

/* ═══════════════ [v9.147] 🔁 재작성 보상 — 3단 데이터의 마지막 단에 유인을 붙인다 ═══════════════
 * 「교정을 받고 실제로 고쳐 썼는가」는 학습이 일어났는지의 유일한 신호인데, 이 행동에는 보상이 0이었다
 * (숙제 제출·첨삭 확인 탭에는 있었다). 기능 압축의 핵심 교환 = 손일의 몫을 데이터를 낳는 행동으로 옮긴다.
 *
 * 🔴 **복붙 게이트가 이 보상의 전제다.** 무인 발행(AI_FEEDBACK_AUTOPUBLISH=true)이라 학생은 교정문을 먼저 본다 —
 *   제출 자체에 포인트를 걸면 합리적 학생은 교정문을 그대로 에코한다. 그러면 3단의 마지막 단이 「몽골어 화자의
 *   언어」가 아니라 **모델 출력의 복제물**이 되어, 이 데이터의 값(유형 커버리지) 자체가 훼손된다.
 * ⚠ 잡는 것은 「그대로 베낀 것」뿐이다 — 교정문을 참고해 자기 말로 다시 쓰는 것은 정상 학습이고 막지 않는다.
 * ⚠ 상한(주 1회)은 **지급 상한이지 재작성 횟수 제한이 아니다** — 더 써도 데이터는 전부 쌓인다.
 * ⚠ 이 게이트는 지급만 막는다. 지급을 못 받은 재작성도 hw_feedback에는 그대로 남는다(수집이 채점보다 우선). */
/* 정규화 후 교정문이 제출문의 이 비율 이상을 덮으면 「그대로 베낌」으로 본다.
 * 0.7인 이유(회귀가 정한 값): 0.8에서는 **교정문을 통째로 붙이고 "감사합니다" 다섯 글자만 더한 제출이
 *   통과**했다(tests/기능압축.test.js가 잡았다). 0.7이면 그건 막히고, 교정문 뒤에 자기 문장을 한 줄
 *   더 쓴 제출(새 글이 30%를 넘음)은 통과한다 — 후자는 막으면 안 되는 정상 학습이다. */
const REWRITE_ECHO_RATIO = 0.7;
const REWRITE_COOLDOWN_DAYS = 7;  // 지급 상한 주기(주 1회)

/* 정규화 — 공백·문장부호·대소문자를 걷어낸다. "띄어쓰기만 바꾼 복붙"이 게이트를 통과하지 않게. */
function 재작성정규화_(s) {
  return String(s || '').toLowerCase().replace(/[\s.,!?~"'()‘’“”]/g, '');
}

/* 에코 판정 — 교정문이 없으면(첨삭 실패·구 행) 판정 불가라 **지급한다**
 *   (「모름」을 불리하게 세지 않는다 — 결석 복귀율에서 세운 원칙과 같다). */
function 재작성에코_(text, corrected) {
  const a = 재작성정규화_(text), b = 재작성정규화_(corrected);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.indexOf(b) > -1 && b.length >= a.length * REWRITE_ECHO_RATIO) return true;
  return false;
}

/* 배치 1회분 준비 — hw_feedback(id→고친문장)과 최근 지급 이력을 각 1회만 읽는다.
 * 재작성 제출이 한 건도 없는 밤에는 호출되지 않는다(호출부가 첫 재작성에서 지연 생성). */
function 재작성준비_(ss, tz) {
  const corr = {};
  const fb = ss.getSheetByName('hw_feedback');
  if (fb && fb.getLastRow() >= 2) fb.getRange(2, 1, fb.getLastRow() - 1, 5).getValues().forEach(r => {
    if (r[0]) corr[String(r[0]).trim()] = String(r[4] || ''); // A id · E 고친문장
  });
  const recent = new Set();
  const since = new Date(Date.now() - REWRITE_COOLDOWN_DAYS * 86400000);
  const pl = ss.getSheetByName('point_logs');
  if (pl && pl.getLastRow() >= 2) pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues().forEach(r => {
    if (r[1] && r[5] && String(r[3] || '') === '재작성' && asDate_(r[5]) >= since) recent.add(String(r[1]).trim());
  });
  return { corr: corr, recent: recent, grants: [], echo: 0, tz: tz };
}

/* 한 행 판정 — 지급 대상이면 grants에 쌓는다(실지급은 배치 끝에 1회). 반환값은 로그·집계용 사유. */
function 재작성판정_(prep, sid, text, reDo) {
  if (!prep || !sid || !reDo) return '';
  if (prep.recent.has(sid)) return '상한';                              // 주 1회 — 이번 주 이미 받음
  if (재작성에코_(text, prep.corr[reDo])) { prep.echo++; return '에코'; } // 교정문 복붙 — 무지급
  prep.recent.add(sid);
  prep.grants.push([sid, PT.재작성, '재작성', '시스템']);
  return '지급';
}

function 재작성지급_(ss, prep) {
  if (!prep || !prep.grants.length) return;
  appendPoints(ss, prep.grants);
  Logger.log('재작성 보상 ' + prep.grants.length + '건 지급' + (prep.echo ? ' · 에코 ' + prep.echo + '건 무지급' : ''));
}

/* ═══════════════ [v9.147] 🥇 강사 교정 골든셋 — 2년 뒤 모델 선택의 채점표 ═══════════════
 * 문제: AI 첨삭이 무인 발행이라 **「강사가 실제로 한 교정」이 어디에도 안 남는다.** 2년치 학생 데이터가 있어도
 *   "어느 모델이 우리 학생에게 더 나은 교정을 하는가"는 **정답이 붙은 평가 세트** 없이는 못 잰다 —
 *   없으면 2년 뒤에도 감으로 고른다. 나중에 만들려면 강사를 다시 앉혀야 하므로 그릇은 지금 만든다.
 *
 * 🔑 **무작위 표본**이 이 설계의 핵심이다(적대 리뷰가 잡은 편향):
 *   강사에게 "틀린 걸 골라 고쳐 주세요"라고 하면 눈에 띄게 틀린 것만 쌓여 「AI가 맞았다」 라벨이 0이 된다 —
 *   정밀도만 있고 재현율이 없는 **반쪽 채점표**가 된다. 그래서 매주 무작위 n건을 뽑아 그 카드에 대해 묻는다
 *   ("이 교정, 그대로 두시겠어요? 고치시겠어요?"). **동의도 답이고 수정도 답이다.**
 * 🔑 **평가 전용이다 — 발행된 첨삭을 소급 정정하지 않는다.** 학생이 이미 본 카드를 뒤늦게 바꾸면
 *   3단 데이터(원문→교정→재작성)의 정합이 깨진다(어느 교정에 대한 재작성인지 모호해진다).
 *   강사가 "이건 학생에게 다시 알려야 한다"고 판단하면 그건 수업에서 말하는 일이고, 이 시트의 일이 아니다.
 * ⚠ 운용 시작 = **파일럿 첫 첨삭 발행 시점**(지금은 실학생 0명이라 표본이 안 뽑힌다). 그릇만 먼저 둔다. */
const GOLD_HEADERS = ['id', 'fb_id', 'student_id', '제출일', '원문', 'AI교정', '강사판정', '강사교정', '사유', '오류태그', '강사', 'created_at'];
const GOLD_VERDICTS = ['AI 교정이 맞다', '고칠 곳이 있다', '원문이 이미 맞다'];
const GOLD_SAMPLE_PER_WEEK = 5; // 주당 무작위 표본 — 강사 1인 5건이 현실적 상한(유인이 0인 업무다)

/* 표본 추출 — 지난 7일 '노출' 카드 중 아직 안 뽑힌 것에서 무작위 n건. 매주 월요일 1회(weeklyJobs).
 * 무작위성은 hashPick_ 같은 결정적 해시가 아니라 진짜 난수를 쓴다 — 결정적이면 같은 학생·같은 유형이
 * 매주 뽑혀 표본이 한쪽으로 굳는다(그게 정확히 이 시트가 피하려는 편향이다). */
function goldenSampleWeekly_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const fb = ss.getSheetByName('hw_feedback');
  if (!fb || fb.getLastRow() < 2) return;
  const tz = ss.getSpreadsheetTimeZone();
  const gold = ensureSheet(ss, 'teacher_gold', GOLD_HEADERS);
  const already = new Set();
  if (gold.getLastRow() >= 2) gold.getRange(2, 2, gold.getLastRow() - 1, 1).getValues().forEach(r => {
    if (r[0]) already.add(String(r[0]).trim());
  });
  const since = new Date(Date.now() - 7 * 86400000);
  const pool = [];
  fb.getRange(2, 1, fb.getLastRow() - 1, 13).getValues().forEach(r => {
    const id = String(r[0] || '').trim();
    if (!id || already.has(id)) return;
    if (String(r[8] || '') !== '노출') return;      // I 상태 — 학생에게 실제로 나간 카드만이 평가 대상이다
    if (!String(r[4] || '').trim()) return;          // E 고친문장 없음(오류 행)
    const d = r[2] ? asDate_(r[2]) : null;
    if (!d || d < since) return;
    pool.push({ id: id, sid: String(r[1] || ''), d: dstr(r[2], tz), src: String(r[3] || ''), corr: String(r[4] || ''), tags: String(r[12] || '') });
  });
  if (!pool.length) return;
  for (let i = pool.length - 1; i > 0; i--) { // Fisher-Yates — slice(0,n)만 하면 시트 순서(=시간순)가 그대로 표본이 된다
    const j = Math.floor(Math.random() * (i + 1));
    const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
  }
  const pick = pool.slice(0, GOLD_SAMPLE_PER_WEEK);
  const now = new Date();
  const rows = pick.map((p, i) => ['GD' + Utilities.formatDate(now, tz, 'yyyyMMdd') + '-' + (i + 1),
    p.id, p.sid, p.d, 셀안전_(p.src), 셀안전_(p.corr), '', '', '', p.tags, '', now]);
  gold.getRange(gold.getLastRow() + 1, 1, rows.length, GOLD_HEADERS.length).setValues(rows);
  Logger.log('골든셋 표본 ' + rows.length + '건 적재(teacher_gold)');
}
