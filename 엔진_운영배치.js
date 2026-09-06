// SYNK 엔진 분할부 — 운영 배치 — 상담 동기화·백업·알림·주간/월간 리포트·KPI·생일·레이드·출결 보드·숙제 전개·학습추적·다이제스트·한도 가드·결석 추적·진화·강사 케어·아카이빙·월간 게임 배치·누적 업적.
// 원본은 Code.js 단일 파일이었다. 로드 순서 정본 = .clasp.json filePushOrder(상수 정본 Code.js가 선두). 표식 기반 테스트는 tests/_engine-source.js가 전 파일을 합본해 본다.
// <!-- 파생: docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/SYNK LAB 급여 인센티브 정본.txt@v3 -->
//   ↑ 강사 인센티브 채점(정본 §7)을 이 파일이 그대로 구현한다 — 배점 구간·첫 시즌 표·미측정 재정규화·
//   등급 배수가 전부 그 문서의 값이다. 정본이 오르면 doc-graph 가 이 줄을 「낡은 인용」으로 잡고,
//   그 문서를 편집하는 세션에게는 doc-propagation 이 이 파일을 파생으로 띄운다. 대조 뒤 갱신 =
//   `node tools/doc-graph.js --stamp 엔진_운영배치.js`. F243: v1.6 의 재등록 30점이 4일간 20점 고정인 채
//   갔는데, 그때 문서 파생 5종은 전부 @v1.6 이었고 엣지가 없던 코드만 낡아 아무도 안 울렸다.
/* ===================== 상담시트 → profiles 동기화 ===================== */

// [v9.84] 자유서술 blob에서 [문항명] 섹션 1개 추출 — importFormResponses가 '[제목] 값'을 '\n\n'로 이어 쌓는
//   형식의 역파싱. 문단 답 안의 이중 개행은 다음 섹션이 '['로 시작할 때만 경계로 본다(lookahead).
//   [v9.125] 경계를 \n+로 완화 — 원장이 동의 마커를 수기로 붙여넣을 때 Enter 1번(단일 개행)만 치면
//   구 \n\n 경계가 안 생겨 blob 전체가 한 세그먼트가 되고 그 학생의 고충 파싱만 조용히 죽었다.
//   사람이 손으로 편집하는 칸이라 개행 개수를 신뢰할 수 없다 — '['로 시작하는 다음 줄이면 경계로 본다.
function consultBlobField_(blob, title) {
  if (!blob) return '';
  const seg = String(blob).split(/\n+(?=\[)/).find(s => s.indexOf('[' + title + ']') === 0);
  return seg ? seg.slice(title.length + 2).trim() : '';
}

// [v9.125] 행 단위 동의 판정 단일 소스 — v9.98이 노션 이관에만 걸었던 마커 게이트를 헬퍼로 뽑았다.
//   같은 blob에서 뽑는 profiles 고충(DW127 강사 뷰)도 이 게이트를 지나야 「행 단위 동의」 선언이 참이 된다.
function consultRowConsented_(blob) {
  return String(blob || '').indexOf('[' + CONSENT_Q_TITLE + ']') !== -1;
}

// [v9.84·도전안] 페이스라인 — TOPIK목표+기한+하루 학습가능시간을 역산해 한 줄로. 판정·보장 없이 "남은 주"만
//   (과장 금지). 기한 파싱 실패·이미 경과·5년+(오입력)면 침묵('') — 그 구간은 사람 상담의 영역.
function consultPace_(goalLv, dueRaw, hoursRaw, now) {
  /* [v9.181] 급수가 「아직 미정」이면 침묵한다 — 「🎯 TOPIK 아직 미정까지 약 48주」는 응원이 아니라
   * 학생이 정직하게 「모르겠다」를 고른 대가다. 판정은 공용 통로(Code.js 미정값_) 하나를 지난다. */
  if (미정값_(goalLv) || !dueRaw) return '';
  const m = String(dueRaw).match(/(20\d{2})\s*[.\-\/년]?\s*(\d{1,2})/);
  if (!m) return '';
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return '';
  const due = new Date(Number(m[1]), mo, 0); // 그 달 말일(여유 쪽 해석)
  const weeks = Math.ceil((due.getTime() - now.getTime()) / (7 * 86400000));
  if (weeks < 1 || weeks > 260) return '';
  // 「닿아요」류 도달 약속 금지(codex c0f8674eb618 수용) — 도달 판정은 자동이 아니라 시즌 회고 사람 몫이다
  return '🎯 TOPIK ' + goalLv + '까지 약 ' + weeks + '주' + (hoursRaw ? ' — 하루 ' + hoursRaw + '씩 가는 페이스예요' : '');
}

/* ── 진로 4칸 정본 ─ 「의도」가 사는 곳 ─────────────────────────────────────
 * 로드맵 ④(유학 집약 봇)의 재료는 **의도 → 결과**의 짝이다. 결과 쪽은 outcome_log(엔진_궤적.js)가
 * 맡고, 의도 쪽이 여기다. 넷 다 상담시트에 이미 들어와 있는데 앱은 한 칸도 안 읽고 있었다.
 *
 * 🔑 왜 한 칸으로 접지 않고 **4열 그대로** 옮기나: 옆의 DT124~DX128(상담 디테일)은 사람이 읽는
 *   문장이라 접는 게 맞았다. 이 넷은 사람이 아니라 **집계가 읽는다**(「학사를 목표한 92명 중 몇 명이
 *   실제로 학사로 갔나」). 문장으로 접으면 그 질문에 다시 대답할 수 없다 — 접는 순간 자유서술이 된다.
 * ⚠ TOPIK목표는 여기 없다 — 이미 DU125(상담목표)에 기한과 함께 들어가 있다(같은 값 두 열 금지). */
const CAREER_HEADS_ = ['졸업후진로', '희망진학과정', '목표비자', '관심전공'];
const CAREER_SRC_ = ['졸업후진로', '희망진학과정', '졸업후목표비자', '관심전공분야']; // 상담시트 헤더명(같지 않은 둘이 있다)
/* ⚠ **이 블록에는 고정 열 번호가 없다.** 처음엔 EA131로 박았다가 두 번 연속 틀렸다:
 *   ① 「DT128 다음이니 129」로 셌는데 129는 오늘의만남(v9.99)·130은 대화폼URL(SHARED4)이 주인이었다
 *      → 회귀(tests/수집.test.js 선점 구간 — ⚠삭제됨 08-19 e75fc7fc)가 잡았다.
 *   ② 131로 옮겼더니 **라이브 profiles에는 이미 「학교」·「동네」가 거기 있었다**(08-04 타 세션 라이브 실측).
 *      코드 레지스트리는 131이 비었다고 말하는데 시트는 아니었다 — 레지스트리가 **코드가 만드는 열만**
 *      알기 때문이다. 라이브에는 코드가 모르는 열이 자란다: Glide가 심는 「🔒 Row ID」,
 *      langColOf_가 이름으로 만드는 「학교」·「동네」(조 편성).
 * 🔑 그래서 자리를 **이름으로 찾는다**(profilesBlockAt_). v9.39가 contents에서 정확히 같은 사고를
 *   겪고 langColOf_를 만든 것과 같은 규약이다 — 「현재 상태는 현재를 읽어 판정한다」의 열 판.
 *   레지스트리에 번호를 등록하지 않는 대신, **번호를 안 쓴다는 것**을 회귀가 지킨다. */

/* 핵심비전(BA53) 폴백 — 원장이 손으로 쓴 V열이 **언제나 우선**이고, 비었을 때만 합성한다.
 *
 * 왜 필요한가: BA53은 웰컴 스토리·미래 편지·데일리·여정 카드 4곳이 개인화 앵커로 읽는 칸인데,
 *   그 칸을 채우던 것은 사람이 하는 상담이었다. 접수가 크루카드로 넘어오면 **신규 학생 전원이
 *   빈 앵커로 들어온다** — 4개 산출물이 조용히 「누구에게나 같은 말」이 된다(F050 계열: 조용한 공백).
 * 왜 자유서술(성공한 유학이란)을 안 쓰나: 그 blob은 행 단위 동의 마커 게이트 뒤에 있고(v9.125),
 *   크루카드 blob엔 그 마커가 없다. 게이트를 우회하는 대신 **동의와 무관한 선택형 답**만 조합한다.
 * 파생값임이 드러나야 한다 — 원장이 이 칸을 보고 「내가 쓴 줄」로 착각하면 안 고친다. */
function 진로비전_(cv, row) {
  /* ⚠ 「아직 미정」은 문장에 싣지 않는다 — 「자기신고: 아직 미정 · 아직 미정(미정) · TOPIK 아직 미정」이
   *   케어 한 줄로 나가면 그건 개인화가 아니라 소음이다. 판정은 공용 통로(Code.js 미정값_) 하나. */
  const 산 = (n) => { const v = cv(row, n); return 미정값_(v) ? '' : v; };
  const 진로 = 산('졸업후진로'), 과정 = 산('희망진학과정'), 급수 = 산('TOPIK목표');
  /* ⚠ 전공은 **다중 요약**(「IT·컴공, 미정」처럼 쉼표로 이어진다)이라 통째로 미정값_에 물리면
   *   멀쩡한 답까지 지워진다(변이 실측이 잡았다). 조각별로 걸러 **첫 진짜 답**을 쓴다. */
  const 전공 = String(cv(row, '관심전공분야') || '').split(',')
    .map((s) => s.trim()).filter((s) => s && !미정값_(s))[0] || '';
  const 조각 = [진로, 과정 && (과정 + (전공 ? '(' + 전공 + ')' : '')), 급수 && ('TOPIK ' + 급수)].filter(String);
  return 조각.length ? '자기신고: ' + 조각.join(' · ') : '';
}

/* ── profiles 뒤쪽 블록 기입 — 점거 가드·헤더 보장·writeIfChanged·tail-clear의 **단일 통로** ──
 *
 * 왜 통로로 뽑았나: 이 저장소는 열 충돌로 **세 번** 당했다(오늘의알림 덮임 · 리그 DO119 선점 · 리뷰 B1).
 *   그 뒤 v9.84가 DT124 블록에 점거 가드를 손으로 얹었는데, 두 번째 블록(진로 4열)을 붙이는 순간
 *   같은 12줄을 다시 베끼게 됐다 — CLAUDE.md 「같은 절차에서 2번째 = 실수가 아니라 시스템 결함」.
 *   베끼면 세 번째 블록에서 한 줄이 빠지고, **빠지는 방향은 언제나 「그냥 덮어쓴다」**다.
 *
 * 🔑 새 블록을 붙일 때 손으로 쓸 것은 (시작 열 · 헤더 · 값) 셋뿐이다. 방어는 여기 한 곳에만 있다.
 * ⚠ 시작 열은 눈으로 세지 말고 tests/safety.test.js 열 레지스트리에서 읽고, 거기에 등록도 한다.
 *
 * @param holdCnt 학생 뒤에 보존되는 행 수(데모 학생) — tail-clear가 그 시연값을 매일 지우지 않게.
 * @return 기입했으면 true / 남의 헤더를 발견해 보류했으면 false.
 */
/* 블록 시작 열을 **이름으로** 찾는다 — 없으면 맨 끝+1에 새로 연다(langColOf_와 같은 규약).
 *
 * 왜 이름인가: 라이브 profiles 에는 **코드가 모르는 열이 자란다.** Glide 가 심는 「🔒 Row ID」,
 *   `langColOf_`가 이름으로 만드는 「학교」·「동네」. 코드 안의 열 레지스트리는 *코드가 만드는 열*만
 *   알기 때문에, 거기서 「비었다」고 읽은 번호가 라이브에선 이미 남의 것일 수 있다(08-04 실측).
 * ⚠ 첫 헤더만 찾는다 — 나머지가 어긋나 있으면 그건 **점거**이고, 판정은 profilesBlockWrite_ 의
 *   가드가 한다(여기서 또 판정하면 같은 판정이 두 곳에 살고, 두 곳은 언제나 갈라진다).
 * ⚠ 「Row ID」가 든 헤더는 절대 반환하지 않는다 — 덮으면 Glide 행 식별이 파괴된다(v9.39 실사고).
 */
function profilesBlockAt_(dst, heads) {
  const w = dst.getLastColumn();
  const cur = dst.getRange(1, 1, 1, w).getValues()[0].map(h => String(h || '').trim());
  for (let c = 0; c < cur.length; c++) {
    if (cur[c].indexOf('Row ID') > -1) continue;
    if (cur[c] === heads[0]) return c + 1;
  }
  return w + 1; // 맨 끝에 새로 연다 — 다음 실행부터는 위 탐색이 같은 자리를 되찾는다
}

function profilesBlockWrite_(dst, start, heads, rows, stateKey, label, lastNow, holdCnt) {
  const st = ensureSheet(SpreadsheetApp.getActiveSpreadsheet(), 'app_state', ['key', 'value']);
  const end = start + heads.length - 1;
  if (dst.getMaxColumns() < end) dst.insertColumnsAfter(dst.getMaxColumns(), end - dst.getMaxColumns());
  const cur = dst.getRange(1, start, 1, heads.length).getValues()[0].map(h => String(h || '').trim());
  const clash = cur.map((h, i) => (h && h !== heads[i]) ? (h + '(' + (start + i) + '열)') : '').filter(String);
  if (clash.length) {
    const sig = clash.join(',');
    if (String(getState(st, stateKey).val || '') !== sig) {
      adminMail('[SYNK] ⚠️ ' + label + ' 열 충돌 — 기입 보류',
        'profiles ' + start + '~' + end + '열에 다른 주인 헤더가 있어 ' + label + ' 기입을 멈췄습니다: ' + sig +
        '\n열 이동·개명 후 syncProfiles가 다음 아침 자동 재개합니다. (같은 상태면 다시 알리지 않습니다)');
      setState(st, stateKey, sig);
    }
    return false; // 🔑 보류의 뜻은 「덮지 않는다」다 — 여기서 계속 내려가면 가드가 장식이 된다
  }
  if (String(getState(st, stateKey).val || '') !== '') setState(st, stateKey, ''); // 해소 → 재무장
  heads.forEach((h, i) => { if (cur[i] !== h) dst.getRange(1, start + i).setValue(h); });
  if (rows.length) writeIfChanged(dst, 2, start, rows);
  const tail = lastNow - 1 - rows.length - holdCnt;
  if (tail > 0) dst.getRange(rows.length + holdCnt + 2, start, tail, heads.length).clearContent();
  return true;
}

/* [함께한날 막1] 퇴소 스냅샷의 승계 열 목록 — 절단 수리의 심장. 구판은 전 열 JSON.slice(49500)이라 카드
 * HTML(BD·BY 수만 자)이 낀 행은 **깨진 JSON**으로 잘렸다. 재계산 가능한 열은 버리고 재계산 «불가» 열만
 * {열번호: 값}으로 저장한다(수백 자 — 상한과 원리상 안 만난다). '{' 시작 = 신판 표식(구판은 '[').
 * 목록 근거 = [v9.34] 「지워지는 열」 주석 + 래칫·자기선언·함께한날 열. 저장(스냅샷)과 복원(재등록)이
 * **같은 목록**을 봐야 손으로 고친 스냅샷이 다른 열을 침범 못 한다(보안 검토 08-27) — 그래서 모듈 상수다. */
const EXIT_KEEP_COLS_ = [27, 28, 30, 31, 32, 37, 41, 44, 45, 46, 49, 50, 54, 55, 80, 105];
//                      AA  AB  AD  AE  AF  AK  AO  AR  AS  AT  AW  AX  BB  BC  CB  DA

/* ═══════════════════════════════════════════════════════════════════
 * [2026-09-02 · 학생ID 종단 ㉡] 퇴소 «사건» 원장 exit_log — 헤더 정본은 여기 하나다
 *   (골격 `엔진_셋업확장.js` sheetSkeleton_ 과 아래 syncProfiles 가 둘 다 이 상수를 참조한다 — 두 곳이 알면 갈린다).
 *   설계 = docs/학생ID_종단_설계.md §5㉡ · 판정 Ⅲ-1·Ⅲ-2·Ⅳ-1 · 결정.md 08-30(칸 · 목록 여섯).
 *
 * ■ append 전용이다 — 한 학생의 둘째 사건은 «새 줄»이지 «수정»이 아니다(휴학→복학→재퇴소). 행을 고치거나 지우는
 *   코드를 만들지 않는다. 표(enrollment_episodes)로 접는 것은 개원 전 칸이다(결정 08-30).
 * ■ 칸은 «끝»에만 는다 — 읽는 쪽(`엔진_콘텐츠AI.js` 복귀창_ 의 r[3] 퇴소감지일)이 열 번호로 집는다.
 *   라이브 시트의 헤더 증분은 `헤더보정_`(엔진_수집.js)이 한다 — ensureSheet 는 시트가 없을 때만 헤더를 쓴다.
 * ■ 두 시각을 가른다(판정 Ⅲ-2 「관측 시각 대 효력 시각」):
 *   · 퇴소감지일 = 기계가 알아챈 날(배치가 돈 날 · 자동)
 *   · 종료일     = 실제로 끝난 날 — **사람이 적는다**(자동으로 알 수 없다). 🔑 비어 있으면 읽는 쪽은 퇴소감지일을 쓴다.
 * ■ 종료사유 = 사람이 적는 드롭다운(값 = EXIT_REASONS_). 비어 있음 = «아직 안 적음»이지 「기타」가 아니다.
 * ■ `마지막_완료_시즌ID` 는 **일부러 없다** — 커리큘럼 정본(docs/커리큘럼_정본_v1.md)에 시즌 «식별자» 규격이 없다
 *   (있는 것은 「1권 = 1시즌 8주」와 Lv1~6 뿐 · 엔진의 시즌 라벨은 시작일 yyyy-MM-dd 다). 규격 없이 적으면 뜻 모를
 *   숫자가 쌓인다(판정 Ⅶ-1) — 규격이 서는 날 «끝에» 한 칸 더한다.
 * ═══════════════════════════════════════════════════════════════════ */
const EXIT_LOG_HEADERS = ['student_id', '이름', '반', '퇴소감지일', '재원일수', '종료사유', '종료일',
  '이름_몽골']; // [v9.312] 몽골어 표기(상담시트 B) — 퇴소하면 profiles 의 C 칸이 사라지는데 골든 픽스처 이름 살균 사전은 그 표기도 알아야 한다(코덱스 09-06 P1)
/* 종료사유 — 원장 수기 드롭다운의 정본(결정.md 08-30 · 여섯). 「미정」이 있는 까닭: 사람이 손으로 적는 칸인데
 * «아직 모른다»를 적을 낱말이 없으면 미분류가 전부 「기타」로 가고 이탈률이 조용히 갈린다.
 * ⚠ 문구를 고치면 이미 적힌 행과 갈라진다. **늘리는 것은 안전하고, 고치는 것은 소급 마이그레이션이다**(OUTCOME_KINDS_ 와 같은 규약). */
const EXIT_REASONS_ = ['졸업', '중도이탈', '휴학', '이사', '미정', '기타'];
const EXIT_REASON_VALIDATION_VER_ = 'v1'; // 목록이 «늘면» 판을 올린다 — 다음 실행에서 500행에 1회 재적용된다(궤적_결과시트_ 와 같은 꼴)

/* exit_log 시트 준비 — 헤더 정본 + 종료사유 드롭다운. 매일 아침 syncProfiles 가 부른다(멱등 · 검증 재적용은 판이 바뀔 때만).
 *   setAllowInvalid(true) = 경고만 — 기계가 append 하는 행은 종료사유가 빈 채로 들어오고, 사람이 목록 밖 낱말을
 *   적어도 배치가 죽지 않는다(가드가 데이터 유입을 끊으면 안 된다 · 궤적_결과시트_ 의 판단 그대로). */
function exitLog시트_(ss) {
  const sh = ensureSheet(ss, 'exit_log', EXIT_LOG_HEADERS);
  헤더보정_(sh, EXIT_LOG_HEADERS);   // 이미 서 있는 5칸 시트에 종료사유·종료일 이름표 — 없으면 새 칸이 조용히 버려진다
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  if (String(getState(st, '퇴소사유검증판').val || '') === EXIT_REASON_VALIDATION_VER_) return sh;
  const rows = 500; // 선반영 구간 — 500명이 나간 뒤의 이야기다
  if (sh.getMaxRows() < rows + 1) sh.insertRowsAfter(sh.getMaxRows(), rows + 1 - sh.getMaxRows());
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(EXIT_REASONS_, true).setAllowInvalid(true).build();
  sh.getRange(2, EXIT_LOG_HEADERS.indexOf('종료사유') + 1, rows, 1).setDataValidation(rule);
  setState(st, '퇴소사유검증판', EXIT_REASON_VALIDATION_VER_);
  return sh;
}

/* exit_log 에 사건이 하나라도 있는 학생 — A열 전량(append 전용이라 같은 학생이 여러 줄일 수 있다). */
function exitLog기록자_(exitSh) {
  const ids = new Set();
  if (exitSh.getLastRow() >= 2) exitSh.getRange(2, 1, exitSh.getLastRow() - 1, 1).getValues().forEach(r => { if (r[0]) ids.add(String(r[0])); });
  return ids;
}

/* 퇴소 사건을 «지금» 적나 — 설계 §5㉡ 「학생」이 아니라 **「학생 + 마지막 사건 이후」**.
 *   옛 규칙(exitedIds 에 있으면 영영 건너뜀)은 같은 아침 재실행의 중복은 막았지만 **복학 뒤 재퇴소도 같이 막았다**(판정 Ⅳ-1).
 *   «마지막 사건 뒤에 돌아왔나»는 profiles 행의 유무로 안다 — 퇴소 감지 = 그 실행에서 profiles 행 삭제(v9.34 행 정합)이고,
 *   행이 다시 있다는 것은 그 뒤 payStatus 가 퇴소가 아닌 아침이 한 번은 있었다는 뜻이다(재등록 → 명부 재진입 → 행 생성).
 *   ⚠ 실패 방향 — 사건을 적은 뒤 행 삭제 전에 그 실행이 죽으면 다음 아침 같은 사건이 한 줄 더 적힌다. 겹친 줄은 사람이
 *     보고 가를 수 있지만 안 적힌 사건은 되돌릴 수 없다(설계 §5㉠ 「실패의 방향」과 같은 규율). 그래서 쓰는 자리는
 *     행 삭제 «바로 앞»이다(syncProfiles). */
function 퇴소사건필요_(sid, exitedIds, keep) {
  const k = String(sid);
  if (!exitedIds.has(k)) return true;   // 첫 사건
  return !!keep[k];                      // 사건 뒤 명부에 돌아온 적이 있다 → 새 사건(복학 후 재퇴소)
}

function syncProfiles() {
  try { // [v8.2] 상담시트 미연결·권한 오류에도 앱 본체는 무사
  const book = SpreadsheetApp.openById(CONSULT_SHEET_ID);
  const src = book.getSheetByName('상담데이터입력');
  const paySh = book.getSheetByName('수강·납입'); // [v8.3] 수강료·재원상태 조인
  const payFee = {}, payStatus = {};
  if (paySh && paySh.getLastRow() >= 5) {
    paySh.getRange(5, 1, paySh.getLastRow() - 4, 11).getValues().forEach(pr => {
      if (pr[0]) { payFee[pr[0]] = pr[4] || ''; payStatus[pr[0]] = String(pr[10] || ''); }
    });
  }
  const dst = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('profiles');

  const lastRow = src.getLastRow();
  // [opt] 빈 상담시트(<3행)도 조기 return 대신 data=[]로 진행 → 아래 급감/0 가드가 로스터 보호 + 중복제거 알림 발동. '상담시트 공백 → 로스터 갱신 조용히 중단' 버그 수정.
  const lastC = Math.max(62, src.getLastColumn()); // [v9.84] v18.4 증분 열(63~)까지 — 기존 62열 고정이 상담 취향·목표를 통째로 못 읽던 사각 해소
  const data = lastRow >= 3 ? src.getRange(3, 1, lastRow - 2, lastC).getValues() : []; // [v8.3] v18.1 = 62열 + [v9.84] 증분
  // [v9.84] 증분 문항은 위치 가변(migrateConsultV184가 "뒤에 추가"만 보장) — importFormResponses와 같은 헤더 이름 해석. 중복 헤더는 첫 열 우선.
  const cHdr = src.getRange(2, 1, 1, lastC).getValues()[0];
  const cCol = {}; cHdr.forEach((h, i) => { const k = String(h || '').trim(); if (k && cCol[k] === undefined) cCol[k] = i; });
  // [v9.126] Date 정규화 — 상담시트의 「TOPIK목표기한」처럼 `2027-10` 형태로 적은 칸을 시트가 날짜로 자동 파싱하면
  //   getValues()가 Date를 돌려주고, String(Date)가 그대로 학생 카드에 실린다(08-02 라이브 실측:
  //   홈 「🌟 나의 목표: TOPIK 3~4급 · Fri Oct 01 2027 15:00:00 GMT+0800 (Ulaanbaatar Standard Time)」).
  //   화면에서 셀은 `2027-10`으로 보이므로 눈으로는 절대 안 걸린다 — 읽는 지점에서 한 번에 막는다.
  const cv = (row, name) => {
    const i = cCol[name];
    if (i === undefined) return '';
    const raw = row[i];
    if (raw instanceof Date && !isNaN(raw.getTime())) {
      /* 날짜만 — 상담시트 칸(목표기한·생일 등)에 시각은 의미가 없다. [v9.128] 08-02 실측에서 시각까지 붙이니
       * 학생 홈에 `2027-10-01 15:00`이 떴는데, 그 15:00은 유호님이 적은 값이 아니라 시트가 `2027-10`을
       * 파싱하며 생긴 타임존 잔재였다 — 원시 Date만큼은 아니어도 화면에 남을 이유가 없는 노이즈다. */
      const p2 = n => (n < 10 ? '0' : '') + n;
      return raw.getFullYear() + '-' + p2(raw.getMonth() + 1) + '-' + p2(raw.getDate());
    }
    return String(raw || '').trim();
  };

  const dstLast = dst.getLastRow();
  const keep = {};
  const nonStudents = []; // [v7.0] teacher/parent/admin 행 보존 — 기존엔 매 동기화마다 지워지던 결함
  const demoStu = []; // [v9.42] DEMO- 학생 행 보존 — 상담시트에 없는 시연용 로스터가 매일 아침 삭제되지 않게(급감 가드 분모에서도 제외)
  const existingStu = []; // [v9.34] {id,row} — 기존 학생의 물리 행 순서(행 안정화의 기준)
  let prevStudentCnt = 0; // [v9.19] 부분 축소 방어용 — 기존 학생 수
  if (dstLast >= 2) {
    dst.getRange(2, 1, dstLast - 1, 26).getValues().forEach((r, i) => {
      if (!r[0]) return;
      keep[r[0]] = { parent_of: r[9] || '', pEmail: r[25] || '', created_at: r[14] || '' }; // [v9.22] created_at 보존
      if (r[3] && r[3] !== 'student') nonStudents.push(r.slice(0, 15));
      else if (r[3] === 'student') {
        if (String(r[0]).indexOf('DEMO-') === 0) { demoStu.push(r.slice(0, 15)); return; } // [v9.42]
        prevStudentCnt++; existingStu.push({ id: String(r[0]), row: i + 2 });
      }
    });
  }

  const now = new Date();
  const newById = {}, newSeq = []; // [v9.34] 상담시트 신본 — id별 큐(중복 id도 기존처럼 행 수 보존)
  // [v9.28] 퇴소 이벤트 로그 — 진짜 이탈률·재원기간(LTV 기초) 확보.
  // [2026-09-02 · 학생ID 종단 ㉡] append 전용 «사건» 원장(정본·규칙 = 위 EXIT_LOG_HEADERS 머리말). 여기서는 사건을 «모으기만» 한다 —
  //   쓰는 자리는 아래 급감 가드 «뒤» · 행 삭제 «바로 앞»이다(까닭은 그 자리 주석). 구판 「학생당 최초 감지 1회만」(exitedIds 영구 차단)은
  //   복학 뒤 재퇴소를 영영 못 적었다 → 퇴소사건필요_(학생 + 마지막 사건 이후)로 갈았다.
  const exitSh = exitLog시트_(SpreadsheetApp.getActiveSpreadsheet());
  const exitedIds = exitLog기록자_(exitSh);
  const 퇴소사건 = [], 퇴소본것 = {}; // 퇴소본것 = 이 실행에서 모은 학생 — 상담시트 중복 행이 같은 아침에 두 줄을 만들지 않게
  data.forEach(row => {
    if (!row[0]) return;               // A 이름
    const userId = row[59];            // [v8.3] BH 학생ID (v18.1)
    if (!userId) return;
    if (payStatus[userId] === '퇴소') { // [v8.3] 퇴소자는 앱 제외 (이력은 시트 보관)
      if (!퇴소본것[String(userId)] && 퇴소사건필요_(userId, exitedIds, keep)) {
        퇴소본것[String(userId)] = 1;
        const caK = keep[userId] && keep[userId].created_at;
        const caD = caK ? (caK instanceof Date ? caK : toDate_(caK)) : null;
        const tenureDays = caD ? Math.floor((now - caD) / 86400000) : '';
        // 종료사유·종료일은 빈 채로 — 사람이 적는 칸이다(자동으로 알 수 없는 것을 자동인 척하지 않는다)
        퇴소사건.push([userId, row[0] || '', row[3] || '',
          Utilities.formatDate(now, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd'), tenureDays, '', '',
          row[1] || '']); // [v9.312] 이름_몽골 — 퇴소 뒤에도 이름 살균 사전(엔진_수집.js 명단이름_)이 두 표기를 다 알게
      }
      return;
    }
    // [v9.22] created_at 안정화: 등록일 우선(yyyymmdd 문자열도 파싱) → 보존값 → now. 매일 now로 덮여 리텐션이 고장나던 버그 수정
    const regD = toDate_(row[2]);
    const createdAt = regD || ((keep[userId] && keep[userId].created_at) ? keep[userId].created_at : now);
    const ent = {
      id: String(userId),
      main: [userId, row[0], row[1], 'student', row[3], row[4],
        row[9], row[7], row[8],
        (keep[userId] ? keep[userId].parent_of : ''),
        payFee[userId] || '', row[2], row[12], row[14], createdAt],
      lvl: row[18] || '',    // S 한국어수준 → AY(51): 강사 뷰 '레벨'
      risk: row[60] || '',   // BI ⚠위험신호 → AZ(52): 원장 콕핏 전용
      vision: row[21] || 진로비전_(cv, row), // V 핵심비전 → BA(53): 케어 대화용 한 줄. 비면 크루카드 선택형 답으로 합성(원장 수기가 우선)
      career: CAREER_SRC_.map(n => cv(row, n)), // → 「의도」 4칸(자리는 profilesBlockAt_가 이름으로 찾는다). 결과(outcome_log)와 짝지어야 궤적이 된다
      // [v9.84] 상담 디테일 2차 — 받아둔 답을 앱이 쓰게(콜드스타트 해소·강사뷰·0점 좌표·페이스). 전부 이름 해석이라 열 이동에 안전.
      taste: [cv(row, '선호그룹'), cv(row, '인생드라마'), cv(row, '취미관심사')].filter(String).join(' · ').slice(0, 120), // → DT124: AI 최애 폴백
      // ⚠ 「아직 미정」이면 목표줄을 만들지 않는다 — 「TOPIK 아직 미정 · 2027-06」은 목표가 아니다(미정값_ 통로)
      cGoal: (미정값_(cv(row, 'TOPIK목표')) ? '' : 'TOPIK ' + cv(row, 'TOPIK목표') + (cv(row, 'TOPIK목표기한') ? ' · ' + cv(row, 'TOPIK목표기한') : '')), // → DU125: 목표 폴백
      // → DV126: 입학 시점 실측(성장 서사 0점 좌표). [v9.98] 라벨 부착 — 08-01 실데이터가 '없음 20'(급수 없음·점수 20)으로
      //   붙어 학부모 편지 프롬프트에 뜻 모를 문자열로 들어가던 것(AI가 20을 급수로 읽을 여지)을 제거.
      topik0: [cv(row, 'TOPIK급수') ? '급수 ' + cv(row, 'TOPIK급수') : '', cv(row, 'TOPIK점수') ? cv(row, 'TOPIK점수') + '점' : ''].filter(String).join(' · ').slice(0, 40),
      // [v9.125] 동의 마커 게이트 — v9.98의 「마커 없는 행은 내보내지 않는다」가 노션에만 걸리고 이 칸은 무검사로
      //   흐르던 구멍. 마커 없으면 강사 뷰에도 싣지 않는다(기기록분은 writeIfChanged가 자동으로 비운다).
      pain: consultRowConsented_(cv(row, '📝자유서술→노션')) ? consultBlobField_(cv(row, '📝자유서술→노션'), '한국어고충').slice(0, 120) : '', // → DW127: 강사 뷰 전용("수업 설계 반영" 약속의 배선)
      pace: consultPace_(cv(row, 'TOPIK목표'), cv(row, 'TOPIK목표기한'), cv(row, '학습가능시간'), now) // → DX128: 여정 카드 페이스라인(도전안)
    };
    (newById[ent.id] = newById[ent.id] || []).push(ent);
    newSeq.push(ent);
  });

  // [v9.34] P0 행 어긋남 수정 — 기존 profiles 학생 행 순서를 보존하고 신규만 뒤에 append.
  //   구 방식(상담시트 순서로 A~O만 재작성)은 중간 퇴소 시 아래 학생 전원의 상태열(P~CB: Glide 소유
  //   AK·AO·AR·BC·CB, 래칫 AB·AS·AT, 비교열 AA·AD)이 남의 행에 영구 오귀속되던 결함.
  //   퇴소자 행은 deleteRow로 '전 열'을 함께 제거해 아래 행 전체가 정합을 유지한 채 당겨진다.
  const ordered = [], removedRows = [];
  existingStu.forEach(s => {
    const q = newById[s.id];
    if (q && q.length) { const e = q.shift(); e.used = true; ordered.push(e); }
    else removedRows.push(s.row); // 퇴소·상담시트 삭제 — 행 통째 삭제 대상
  });
  let apCnt = 0; // 신규 학생 수 (뒤에 append)
  newSeq.forEach(e => { if (!e.used) { ordered.push(e); apCnt++; } });
  // [v9.44] 상담시트에 DEMO- 학생ID가 실제 입력된 경우(상담→앱 파이프라인 검증 시나리오): 그 행은 정상 경로
  //   (ordered)로 유입되므로 보존본(demoStu)에서 제거 — 안 하면 같은 학생이 두 줄로 복제되던 결함.
  if (demoStu.length) {
    const inNew = {}; ordered.forEach(e => { inNew[e.id] = 1; });
    for (let di = demoStu.length - 1; di >= 0; di--) if (inNew[String(demoStu[di][0])]) demoStu.splice(di, 1);
  }

  // [v9.19] 안전 가드 — 빈/부분 손상 상담시트가 원본일 때 실학생 대량 삭제 방지 (백업 복구 이전 예방)
  //   ① 신규 학생 0명  또는  ② 기존 5명+ 인데 30% 넘게 급감 → 덮어쓰지 않고 원장 알림
  const newStudentCnt = ordered.length;
  if (dstLast > 1 && (newStudentCnt === 0 || (prevStudentCnt >= 5 && newStudentCnt < prevStudentCnt * 0.7))) {
    Logger.log('syncProfiles 중단: 학생 ' + prevStudentCnt + '→' + newStudentCnt + ' 급감/0 — profiles 보호(덮어쓰기 안 함)');
    // [v9.22] 상태(신규/기존)가 바뀔 때만 1회 알림 — 빈 상담시트(테스트/미모집)가 매일 경보를 도배하는 것 방지
    const stHold = ensureSheet(SpreadsheetApp.getActiveSpreadsheet(), 'app_state', ['key', 'value']);
    const holdSig = newStudentCnt + '/' + prevStudentCnt;
    if (String(getState(stHold, '동기화보류_상태').val || '') !== holdSig) {
      adminMail('[SYNK] ⚠️ 동기화 보류 — 학생 급감 감지',
        '상담시트 기준 학생이 ' + prevStudentCnt + '명 → ' + newStudentCnt + '명으로 급감/0이라 profiles 덮어쓰기를 보류했습니다.\n' +
        '상담시트(CONSULT_SHEET_ID) 연결·데이터를 확인하세요. 정상이면 다음 동기화에서 자동 반영됩니다.\n\n' +
        '※ 상태가 바뀌기 전까지 이 알림은 다시 오지 않습니다.');
      setState(stHold, '동기화보류_상태', holdSig);
    }
    return;
  }
  // [v9.151] 소급 불가 수리 ②·④ (판정 정본 = memory masterplan-v3-2026-08-04)
  //   ② 삭제 전 전 열 스냅샷 — 아래 deleteRow는 상태열(P~CB 래칫·Glide 소유열)까지 통째로 지우는데 백업은
  //      30일뿐이라 31일 뒤엔 복구 불가였다. 삭제 자체는 유지한다(행 오귀속 방지 불변식 [v9.34]) — 지우기
  //      전에 전 열을 JSON 1칸으로 보관만 한다(열이 늘어도 안 깨지게 열 나열 대신 JSON).
  //   ④ 학생ID 불변 가드 — 같은 이름이 「삭제+신규」로 동시에 관측되면 id 교체로 본다. id가 바뀌면
  //      talk_log·quiz_log·point_logs의 과거 이력이 새 id에 붙지 않는다(조인 단절 = 소급 불가).
  //      id는 영구 불변이 규율 — 동명이인 구분·개명은 이름 칸에서 한다(실사례 = profiles 김재헌21).
  const removedInfo = [];
  if (removedRows.length) {
    const snapSh = ensureSheet(SpreadsheetApp.getActiveSpreadsheet(), 'exit_snapshot', ['보관일', 'student_id', '이름', 'row_json']);
    const wide = dst.getMaxColumns();
    const tzSnap = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    const todaySnap = Utilities.formatDate(now, tzSnap, 'yyyy-MM-dd');
    const snaps = removedRows.map(rn => {
      const v = dst.getRange(rn, 1, 1, wide).getValues()[0];
      removedInfo.push({ id: String(v[0] || ''), name: String(v[1] || '').trim() });
      const keepJ = {};
      EXIT_KEEP_COLS_.forEach(c3 => {
        if (c3 > wide) return;
        const val3 = v[c3 - 1];
        if (val3 === '' || val3 == null) return;
        keepJ[String(c3)] = (val3 instanceof Date) ? Utilities.formatDate(val3, tzSnap, 'yyyy-MM-dd') : val3;
      });
      return [todaySnap, String(v[0] || ''), String(v[1] || ''), JSON.stringify(keepJ)];
    });
    writeIfChanged(snapSh, snapSh.getLastRow() + 1, 1, snaps); // [v9.153] 소독 채널로 append(통로 통일) — 이름 칸은 원문 왕복값, row_json은 '[' 시작이라 소독 미적용=JSON.parse 복원 무해
    const addedNew = newSeq.filter(e => !e.used).map(e => ({ id: String(e.id), name: String(e.main[1] || '').trim() }));
    const idSwap = removedInfo.filter(rm => rm.name && addedNew.some(ad => ad.name === rm.name && ad.id !== rm.id));
    if (idSwap.length) {
      adminMail('[SYNK] ⚠️ 학생ID 변경 의심 — 이력 단절 위험',
        idSwap.map(rm => '· ' + rm.name + ': 구 id ' + rm.id + ' 행이 삭제되고 같은 이름의 새 id가 등록됐습니다').join('\n') +
        '\n\nid가 바뀌면 그 학생의 talk_log·quiz_log·point_logs 이력이 새 id에 붙지 않습니다(소급 불가).' +
        '\nid는 바꾸지 말고 유지하세요 — 동명이인·개명은 이름 칸에서 구분합니다.' +
        '\n실수라면 상담시트 학생ID(BH)를 구 id로 되돌리면 다음 동기화가 정상 복원합니다(전 열 보관 = exit_snapshot).');
    }
  }
  // [v9.34] 물리 행 정리 — ① 사라진 학생 행은 전 열 통째 삭제(아래 행이 상태열과 함께 당겨져 정합 유지)
  //   ② 신규 학생은 기존 학생 블록 끝에 '빈 행'을 삽입해 배치(비학생 행의 잔존 상태열을 물려받지 않게).
  //   비학생 행은 학생 뒤 배치 불변식([v7.0]) 그대로 유지된다.
  // [2026-09-02 · 학생ID 종단 ㉡] 퇴소 사건 기입 — 급감 가드 «뒤»(로스터를 믿는 아침에만 사건을 적는다 · 보류된 아침에 적으면 행이 안 지워져
  //   다음 아침 같은 사건이 매일 한 줄씩 는다) · 행 삭제 «바로 앞»(사이에서 죽으면 겹친 줄이 남지, 사건이 사라지진 않는다 — 안전한 쪽으로 틀린다).
  //   [v9.153] 소독 채널로 append — 이름·반은 상담시트 원문(남의 글). skip 비교는 append라 도달 불가지만, 시트 쓰기 통로를 writeIfChanged 하나로 통일한다
  if (퇴소사건.length) writeIfChanged(exitSh, exitSh.getLastRow() + 1, 1, 퇴소사건);
  removedRows.sort((a, b) => b - a).forEach(rn => dst.deleteRow(rn));
  const survCnt = ordered.length - apCnt;
  if (apCnt > 0 && dst.getLastRow() > survCnt + 1) dst.insertRowsAfter(survCnt + 1, apCnt);

  const out = ordered.map(e => e.main);
  demoStu.forEach(r => out.push(r)); // [v9.42] 데모 학생은 실학생 뒤·비학생 앞에 그대로 보존(상담시트 무관)
  nonStudents.forEach(r => out.push(r)); // [v7.0] 학생 뒤에 비학생 행 재기록
  // [v9.25] A7-1: 로스터 writeIfChanged — JSON 동일이면 setValues 생략(대부분 상담시트 무변동이라 A~O/Z/AY~BA 통째 skip).
  //   writeIfChanged는 셀값을 JSON.stringify로 비교 → Date는 ISO 전체 직렬화라 오탐(같은데 다르다고 판단)해도 '그냥 쓰기'(안전측), 반대(다른데 같다고)는 없음.
  //   로스터 축소 대응: writeIfChanged는 겹치는 구간만 갱신하므로, 남는 옛 꼬리 행은 별도로 비운다(tail-clear).
  if (out.length > 0) {
    if (dst.getMaxRows() < out.length + 1) dst.insertRowsAfter(dst.getMaxRows(), out.length + 1 - dst.getMaxRows()); // 그리드 부족 안전판
    writeIfChanged(dst, 2, 1, out);                                       // A~O(15열)
    const lastNow = dst.getLastRow();                                     // [v9.34] 삭제·삽입 반영 후 실측
    const oTail = lastNow - 1 - out.length;                              // >0: 남은 옛 꼬리 행
    if (oTail > 0) dst.getRange(out.length + 2, 1, oTail, dst.getMaxColumns()).clearContent(); // [v9.34] 전 열 tail-clear(구 15열 — Z 등 잔존 개인정보 포함 제거)
    const zOut = out.map(r => [keep[r[0]] ? keep[r[0]].pEmail : '']);
    writeIfChanged(dst, 2, 26, zOut);                                     // Z(pEmail)
    /* [함께한날 막1] 퇴소→재등록 승계 복원 — exit_snapshot 은 그동안 «쓰는 자리만 있고 읽는 자리가 0»
     * 이었다(설계 §8-⑭: 「승계 열은 1회 백필하면 된다」가 기각된 이유 — 퇴소·재등록이 매일 지운다).
     * 신규 append 행의 id 가 스냅샷에 있으면(같은 id 재등록 — id 불변 규율 위) 승계 열을 되살린다.
     * 구판 '[' 배열 JSON 은 절단으로 깨졌을 수 있어 복원하지 않는다 — 반쪽 복원이 침묵 오염보다 나쁘다. */
    if (apCnt > 0) {
      const snapR = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('exit_snapshot');
      if (snapR && snapR.getLastRow() >= 2) {
        const snapById = {};
        snapR.getRange(2, 1, snapR.getLastRow() - 1, 4).getValues().forEach(sr => {
          const sid3 = String(sr[1] || '').trim();
          if (sid3) snapById[sid3] = String(sr[3] || ''); // 아래 행이 최신 — 마지막 승자
        });
        ordered.slice(survCnt).forEach((e3, k3) => {
          const raw3 = snapById[String(e3.id)];
          if (!raw3 || raw3.charAt(0) !== '{') return;
          let keep3 = null;
          try { keep3 = JSON.parse(raw3); } catch (ePs) { return; }
          const rowN3 = survCnt + 2 + k3; // 헤더 1행 + 기존 학생 survCnt + k3번째 신규
          Object.keys(keep3 || {}).forEach(cK => {
            const c4 = Number(cK) || 0;
            if (EXIT_KEEP_COLS_.indexOf(c4) === -1) return; // 승계 목록에 없는 키는 버린다 — 손으로 고친 스냅샷이 계산·카드 열을 침범하지 못하게(보안 검토 08-27 심층방어 · 로스터 A~O 불가침 포함)
            const v4 = keep3[cK];
            if (v4 === '' || v4 == null) return;
            writeIfChanged(dst, rowN3, c4, [[v4]]); // 소독 채널 — 스냅샷 값에 학생이 친 글(드림한줄 등)이 실려 있다
          });
        });
      }
    }

    // [v8.5] 디테일 3종 → AY·AZ·BA (계산열 50 이후 안전 지대)
    if (dst.getMaxColumns() < 53) dst.insertColumnsAfter(dst.getMaxColumns(), 53 - dst.getMaxColumns());
    if (String(dst.getRange('AY1').getValue()) !== '한국어수준') dst.getRange('AY1').setValue('한국어수준');
    if (String(dst.getRange('AZ1').getValue()) !== '⚠상담위험') dst.getRange('AZ1').setValue('⚠상담위험');
    if (String(dst.getRange('BA1').getValue()) !== '핵심비전') dst.getRange('BA1').setValue('핵심비전');
    // [v9.25] AY~BA는 out과 별개 소스(row[18]/[60]/[21])라 반드시 별도 비교 — out 무변동이어도 레벨/위험/비전만 바뀔 수 있음
    const trio = ordered.map(e => [e.lvl, e.risk, e.vision]); // [v8.7] 3열 1회 쓰기 (학생만, 비학생 제외)
    if (trio.length) writeIfChanged(dst, 2, 51, trio);
    // [v9.42] tail-clear 시작을 데모 행 뒤로 — 데모 학생의 AY(한국어수준) 시연값이 매일 지워지지 않게
    const tTail = lastNow - 1 - trio.length - demoStu.length;            // 데모·학생 뒤(비학생·삭제) 행의 AY~BA는 비움
    if (tTail > 0) dst.getRange(trio.length + demoStu.length + 2, 51, tTail, 3).clearContent();

    // [v9.84] 상담 디테일 2차 5열 → DT124~DX128 (취향·목표·입학TOPIK·고충·페이스라인). AY~BA 트리오와 같은 계급
    //   (학생만·데모 보존 tail-clear·writeIfChanged). ⚠ 점거 가드: 24시간 내 열 충돌 계열 사고 2건(오늘의알림 덮임·
    //   리그 DO119 선점)의 회귀 장치 — 5칸 중 하나라도 남의 헤더가 있으면 기입 전체를 멈추고 상태 변화 시 1회만 알린다.
    const DT_HEADS = ['상담취향', '상담목표', '입학TOPIK', '상담고충', '페이스라인'];
    const quint = ordered.map(e => [e.taste || '', e.cGoal || '', e.topik0 || '', e.pain || '', e.pace || '']);
    profilesBlockWrite_(dst, 124, DT_HEADS, quint, '상담열충돌', '상담 디테일', lastNow, demoStu.length);

    /* [궤적] 「의도」 4열. 위 블록과 **같은 통로**를 지난다 — 방어를 손으로 베끼지 않는다.
     * 시작 열은 상수가 아니라 **이름으로 찾는다**(라이브에 코드가 모르는 열이 자라기 때문 · 위 주석). */
    profilesBlockWrite_(dst, profilesBlockAt_(dst, CAREER_HEADS_), CAREER_HEADS_,
      ordered.map(e => e.career || ['', '', '', '']), '진로열충돌', '진로 4열', lastNow, demoStu.length);
  }
  setState(ensureSheet(SpreadsheetApp.getActiveSpreadsheet(), 'app_state', ['key', 'value']), '동기화보류_상태', ''); // [v9.22] 정상 동기화 → 보류 알림 재무장
  // [v9.50·F4] 신규 학생 웰컴 스토리 대기열 — 등록 감지 즉시 큐에 넣고, 학부모 이메일(§1-3)이 채워진 아침에 welcomeStoryBatch_가 발송
  try {
    if (apCnt > 0) {
      const newIds = ordered.slice(survCnt).map(e => String(e.id)).filter(id => id.indexOf('DEMO-') !== 0);
      if (newIds.length) {
        const pW = PropertiesService.getScriptProperties();
        let curW = [];
        try { curW = JSON.parse(pW.getProperty('웰컴대기') || '[]') || []; } catch (eQ) { curW = []; }
        newIds.forEach(id => { if (curW.indexOf(id) < 0) curW.push(id); });
        pW.setProperty('웰컴대기', JSON.stringify(curW.slice(-60)));
      }
    }
  } catch (eW) { Logger.log('웰컴 대기열 등록 실패: ' + eW); }
  // [v9.151] 동의 행 단위 스탬프 — 응답이 관측된 날의 정본 판을 상담시트 행에 남긴다(구현·원칙 = 엔진_폼리포트.js).
  //   src를 그대로 넘겨 openById 중복을 피한다. 자체 try로 격리돼 있어 실패해도 동기화는 계속된다.
  if (typeof 동의버전스탬프_ === 'function') 동의버전스탬프_(src);
  /* [궤적] 의도(상담시트 진로 4문항) × 결과(면접폼·수기 관측) → outcome_log·trajectory.
   *   왜 여기가 발동층인가: ① 이 함수가 이미 상담시트를 열어 두었다(openById 중복 회피 —
   *   동의버전스탬프_와 같은 이유) ② morningJobs가 매일 부른다 = 스스로 발화하는 자리다.
   *   메뉴 버튼을 만들지 않은 것은 의도다 — 유호님이 눌러야 도는 장치는 결국 안 눌린다.
   *   typeof 가드 = 엔진_궤적.js가 라이브에 안 올라간 배포에서도 동기화 본체는 살아남는다. */
  if (typeof 궤적갱신_ === 'function') 궤적갱신_(src);
  Logger.log(out.length + '명 동기화 완료');
  /* [v9.215·E²] 명부 스윕 — profiles 가 최신이 된 자리에서 engine.learners 로 붓는다.
   * 🔴 2026-09-01 순서 수정 (codex P1 `e3f303172d01`·`32a9b36a8b8a` · 대상 `ca2c3742`)
   *   옛 판은 `명부스윕_()` 을 `calcAll()` **앞**에서 불렀다. 그런데 스윕이 붓는 「현재급수」는
   *   `calcAll()` 안의 `calcAcademic_()` 가 갱신한다 — 즉 **갱신 «전» 스냅숏이 서버로 나갔다.**
   *   급수가 처음 계산되거나 바뀐 날이면 engine.learners 에 옛 급수나 빈 값이 실리고, 그 값은
   *   게임 배정·강사 콘솔이 그대로 읽는다(급수 동봉 심문 S7 이 세운 그 열이다).
   *   ⇒ `calcAll()` 을 먼저 돌려 급수를 확정한 뒤 붓는다.
   * 🔴 try 는 그대로 둔다 — 이 함수는 네트워크를 탄다. Supabase 가 느린 아침에 여기서 던지면
   *   위 catch 가 「상담 동기화 실패」로 잘못 보고하고 관리자 메일이 나간다(원인은 명부인데).
   *   순서가 바뀌어도 «명부 실패가 다른 것을 끌고 내려가지 않는다»는 값은 이 try 가 계속 진다. */
  calcAll();
  try { 명부스윕_(); } catch (eR) { Logger.log('명부스윕 스킵: ' + eR); }
  } catch (e) { // [v9.19] 조용한 실패 방지 — 연결 끊기면 매일 아침 알림 (profiles 스테일 조기 감지)
    Logger.log('syncProfiles 스킵(상담시트 연결 확인): ' + e);
    adminMail('[SYNK] ⚠️ 상담 동기화 실패', 'syncProfiles가 상담시트를 읽지 못했습니다: ' + e + '\nCONSULT_SHEET_ID·권한·탭명(상담데이터입력)을 확인하세요. profiles는 마지막 정상 상태로 유지됩니다.');
  }
}

/* ===================== 명부 스윕 — profiles → engine.learners (E²) ===================== */

/* [v9.215] 「수집은 엔진 도달까지가 한 벌이다」의 마지막 손 — 사람이 `tools/명부등록.js` 를 돌리던
 *   그 한 칸을 아침 배치로 옮긴다. 사람 게이트(크루카드 접수 → 반배정 확인 → 학생ID 발급)는 그대로다.
 *
 * ■ 판정은 여기 없다 — 표를 그대로 싣는다
 *   학생인지·번호가 맞는지·연락처가 어긋났는지는 전부 `roster-ingest` 동봉 `명부규칙` 한 벌이 진다
 *   (F269 — 문이 둘이어도 규칙은 한 벌. 여기서 한 줄이라도 더 거르면 그게 곧 두 번째 규칙이다).
 *   그래서 profiles **A:H 를 머리글째** 보낸다. 표시값(getDisplayValues)인 이유: 연락처는 시트에서
 *   문자열이지만 getValues 는 숫자로 접어 앞자리 0 을 날린다 — 증상은 「명부엔 있는데 로그인이 안 된다」뿐이다.
 *
 * ■ 원천 제외는 둘뿐, 둘 다 판정이 아니다
 *   ① `DEMO-` 행(상담시트 밖 시연용 · 웰컴대기 계보) ② A:H 가 통째로 빈 행(그리드 여백 — 명부 행이
 *   아니다). 번호만 빈 행은 **거르지 않는다** — 그건 사람이 고쳐야 할 진짜 문제고, 규칙 lib 이 이름과
 *   사유로 되돌려 준다. 여기서 조용히 빼면 그 학생은 영원히 안 보인다.
 *
 * ■ 배선 전에는 0초 스킵 (CLAUDE_API_KEY 계보)
 *   속성 3칸이 비면 조용히 돌아선다 — 운영 Edge Fn 배포와 한 묶음으로 채운다. 리허설에는 상시
 *   배선하지 않는다(왕복 15/15 가 이미 증명했고, 도달이 필요한 것은 운영뿐).
 *
 * ■ 소리는 상태가 바뀔 때 1회 (동기화보류_상태 계보)
 *   매일 도는 배치라 같은 문제로 매일 울리면 그 메일함이 곧 필터가 된다. 문제 **서명**이 바뀔 때만
 *   보내고, 깨끗해지면 상태를 비워 다음 문제에 다시 울리도록 재무장한다.
 *   🔴 서명은 **개수가 아니라 이름**이다 — 「3건」으로 접으면 A 가 고쳐지고 B 가 깨진 날 서명이 그대로라
 *   B 는 영영 안 울린다. 개수 서명은 그 자체가 유실 지점이다.
 */
/** 긴 서명을 **자르지 않고** 12자리로 접는다 — 자르면 뒤쪽 변화가 안 보인다(talkPromptVer_ 와 같은 관용구). */
function 접기_(원문) {
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(원문), Utilities.Charset.UTF_8);
  return d.map(b => ((b & 0xFF) + 0x100).toString(16).slice(1)).join('').slice(0, 12);
}

function 명부스윕_() {
  const props = PropertiesService.getScriptProperties();
  const url = String(props.getProperty('ROSTER_INGEST_URL') || '').trim();
  const key = String(props.getProperty('ROSTER_INGEST_KEY') || '').trim();
  const anon = String(props.getProperty('ROSTER_INGEST_ANON') || '').trim();
  if (!url || !key || !anon) return;   // 미배선 = 0초 스킵(알림도 없다 — 아직 안 켠 것이지 고장이 아니다)

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let 서명 = '';   // 빈 문자열 = 문제 없음 → 상태 비움 = 알림 재무장
  let 본문 = '';
  try {
    const pf = ss.getSheetByName('profiles');
    const 몸 = [];
    let 머리 = null;
    /* 🔴 **시트 부재는 「보낼 게 없다」가 아니라 고장이다.** 조용히 지나가면 명부가 몇 달째 안 서
     *   있어도 아무 데도 안 남는다 — 미실행과 통과가 같은 모양이면 안 된다(F207 · ①배포 검수 P1).
     *   ⚠ 학생 0행(머리글만)은 고장이 **아니다** — 개원 전 정상이고, 급감·0 은 syncProfiles 가 이미 본다. */
    if (!pf) throw new Error('profiles 시트를 찾지 못했다');
    /* 🔴 「머리글만 있는 시트」와 「통째로 빈 탭」은 다르다(①배포 검수 P1 `03006c6e68a0`).
     *   앞은 개원 전 정상이고, 뒤는 시트가 지워졌거나 새로 만들어진 **고장**이다 — 같은 분기를 타면
     *   명부가 통째로 사라진 아침에도 옛 오류만 조용히 지워진다. 머리글 유무로 가른다. */
    const 마지막행 = pf.getLastRow();
    if (마지막행 < 1) throw new Error('profiles 시트가 통째로 비었다(머리글조차 없다)');
    const 표 = pf.getRange(1, 1, 마지막행, 8).getDisplayValues();   // A:H — user_id·이름·이름_몽골·role·class_name·생일·email·연락처
    if (!표[0].some(c => String(c == null ? '' : c).trim() !== '')) throw new Error('profiles 머리글 행이 비었다');
    /* 급수 동봉(심문 S7 · 08-24) — 「현재급수」(BO 부근 · academic_log 실측 · calcAcademic_ 산출)를
     *   이름으로 찾아 **아홉째 칸**으로 싣는다. A:H 창은 그 열에 구조상 안 닿아 talk
     *   `learners.level_current` 가 전원 영구 NULL 이었다 — 생성 모드가 켜지면 전원 «비대상/미정»
     *   (경보 0) · 게임 전원 G2 · 강사 콘솔 급수 빈칸. 위치 상수 금지는 PROFILE_LEVEL_HEADER 규율
     *   그대로(같은 자리에서 두 번 틀렸다) — 이름으로 찾고, 없으면 열을 **아예 안 싣는다**(서버는
     *   급수 열 부재 = 무동작 · 옛 판 호환). 변환(정수→Lv{n})·검증은 서버 `급수정규화` 가 정본이다. */
    const 전머리 = pf.getRange(1, 1, 1, pf.getLastColumn()).getDisplayValues()[0];
    const 급수칸 = 전머리.indexOf('현재급수') + 1;   // 1-기반 · 0 = 열 없음
    if (급수칸 > 0) {
      const 급수들 = pf.getRange(1, 급수칸, 마지막행, 1).getDisplayValues();
      표.forEach((r, i) => r.push(String(급수들[i][0] == null ? '' : 급수들[i][0])));   // 머리행엔 '현재급수' 가 그대로 실린다
    }
    if (마지막행 >= 2) {
      머리 = 표[0];
      표.slice(1).forEach(r => {
        if (!r.some(c => String(c == null ? '' : c).trim() !== '')) return;   // 그리드 여백 — 명부 행이 아니다
        if (String(r[0] || '').indexOf('DEMO-') === 0) return;                // 시연 행
        몸.push(r);
      });
    }
    /* 조·좌석 동봉(숙제서클 §10-3 · talk 20260814100000) — groups 시트의 **현 시즌 스냅샷**을
     * [[학생ID, 조, 좌석]] 로 싣는다. 신판 서버는 빈 스냅샷을 받으면 남아 있던 조를 비운다
     * (재편성에서 빠진 학생의 옛 조가 남으면 검수 콘솔이 그 학생을 남의 조에 계속 그린다).
     * 값 검증은 서버가 지고 행별로 이름·사유로 되돌린다.
     *
     * 🔴 **「편성이 없다」와 「모른다」를 같은 빈 배열로 보내지 않는다**(반박 P2-④ · 실측 경로).
     *   그전엔 시즌 셀이 지워지기만 해도 — groups 시트에 편성이 멀쩡히 있는데도 — 조편성이 `[]`
     *   로 나가 서버가 **전원 조 해제**로 읽었다. 아침 배치가 조용히 반을 흩뜨리고, 검수 콘솔은
     *   그날 전원을 「조 미편성」으로 그린다. 사람이 시트에서 잘못 만진 곳은 시즌 셀 하나다.
     *   ⇒ 셋을 가른다: 시트·시즌을 **아는데 편성이 없다** = `[]`(스냅샷) · **모른다**(시트 없음·
     *     시즌 미설정) = `null` → **키 자체를 안 싣는다** = 서버 무동작(옛 서버 호환과 같은 길).
     *   같은 파일 안에서 profiles 부재는 throw 인데 groups 부재는 단정이던 의미 갈림도 여기서
     *   닫힌다 — 명부는 **필수**라 고장이고, 조 편성은 개원 전 **아직 없을 수 있어** 모름이다. */
    var 조편성 = null;   // null = 「모른다」 → 아래에서 키를 안 싣는다
    const gs = ss.getSheetByName('groups');
    if (gs) {
      const 조tz = ss.getSpreadsheetTimeZone();
      const 조시즌 = seasonLabelOf_(ss, 조tz);
      if (조시즌) {
        조편성 = [];   // 시트도 있고 시즌도 안다 — 여기서부터는 **스냅샷**이다(빈 것도 사실이다)
        if (gs.getLastRow() >= 2) {
          gs.getRange(2, 1, gs.getLastRow() - 1, GROUPS_HEADERS.length).getValues().forEach(function (r) {
            if (seasonKeyOf_(r[0], 조tz) !== 조시즌) return; // 지난 시즌 행 — 스냅샷이 아니다
            const sid = String(r[2] || '').trim();
            if (!sid || sid.indexOf('DEMO-') === 0) return; // 시연 행 — 명부와 같은 게이트
            조편성.push([sid, String(r[4] == null ? '' : r[4]), String(r[5] == null ? '' : r[5])]);
          });
        }
      }
    }

    /* 보낼 행이 없으면 왕복도 하지 않는다 — 단 **돌아서지는 않는다.** 아래 상태 블록까지 흘려보내
     * 어제의 문제 서명을 비운다(여기서 return 하면 낡은 서명이 남아 다음 문제가 조용해진다). */
    if (머리 && 몸.length) {
      /* 🔑 「모른다」(null)면 **키를 아예 안 싣는다** — 서버 계약에서 `조편성` 키 부재 = 무동작이고,
       *   빈 배열 = 「편성이 없다」(전원 해제)다. 둘을 같은 몸통으로 보내면 모름이 지시가 된다. */
      const 몸통 = { 표: [머리].concat(몸) };
      if (조편성 !== null) 몸통.조편성 = 조편성;
      const res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        headers: { apikey: anon, Authorization: 'Bearer ' + anon, 'x-roster-ingest-key': key },
        payload: JSON.stringify(몸통),
        muteHttpExceptions: true,
      });
      const code = res.getResponseCode();
      const txt = String(res.getContentText() || '');
      if (code !== 200) {
        /* 🔴 서명에 **응답 본문을 섞지 않는다**(①배포 검수 P2 `6fc6c72a930e`). 프록시 오류 페이지에는
         *   요청ID·시각이 박혀 있어, 섞으면 서명이 매 아침 달라져 「1회 알림」이 통째로 무너진다(매일 운다).
         *   서명이 지는 것은 **분류**고, 무엇이 왔는지는 본문이 진다. */
        서명 = 'http' + code;
        본문 = '명부 스윕이 거절됐습니다(HTTP ' + code + ').\n' + txt.slice(0, 500) +
          '\n\n※ 401=시크릿 어긋남 · 503=서버에 ROSTER_INGEST_SECRET 미설정 · 400=머리글/행수 문제.';
      } else {
        /* 🔴 **200 을 성공으로 읽지 않는다 — 봉투를 본다**(①배포 검수 P1 3키 · fail closed).
         *   프록시가 HTML 504 를 200 으로 주거나, 빈 몸통·`{ok:false}` 가 오면 옛 코드는 `{}` 로 접어
         *   모든 오류 배열이 비고 → 상태가 **경고 없이 초기화**됐다. 명부는 안 섰는데 배치는 성공한
         *   얼굴을 한다 — 「미실행」이 「통과」와 같은 모양이 되는 자리(F207 · 방향 불변식 3). */
        let j = null;
        try { j = JSON.parse(txt); } catch (eP) { j = null; }
        const 봉투아님 = !j || typeof j !== 'object' || j.ok !== true
          || !Array.isArray(j.문제들) || !Array.isArray(j.막힘);
        if (봉투아님) {
          서명 = 'http200_봉투아님';   // 분류만 — 본문을 섞으면 요청ID·시각 때문에 매일 운다(P2)
          본문 = '명부 스윕이 200 을 받았지만 **우리 응답이 아닙니다** — 붓기가 실제로 돌았는지 알 수 없어\n' +
            '실패로 답니다(성공으로 읽으면 명부가 안 선 채로 매일 조용히 지나갑니다).\n\n받은 것: ' + txt.slice(0, 500) +
            '\n\n※ 프록시 HTML·빈 응답·{ok:false} 가 이 모양입니다 — Edge Function 배포 상태와 URL 을 확인하세요.';
        } else {
          const 문제들 = j.문제들;
          const 막힘 = j.막힘;
          const 역할오류들 = j.역할오류들 || [];
          const 무동의 = j.무동의 || [];
          const 조문제들 = j.조편성문제 || [];   // 신판 서버만 낸다 — 옛 서버 응답에선 빈 배열
          Logger.log('명부스윕: 읽은행 ' + (j.읽은행 || 0) + ' · 넣음 ' + (j.넣음 || 0) + ' · 건너뜀 ' + (j.건너뜀 || 0) +
            ' · 경쟁흡수 ' + (j.경쟁흡수 || 0) + ' · 문제 ' + 문제들.length + ' · 막힘 ' + 막힘.length + ' · 무동의 ' + 무동의.length +
            ' · 조갱신 ' + ((j.조갱신 || []).length) + ' · 조해제 ' + (j.조해제 || 0) + ' · 조문제 ' + 조문제들.length);
          /* 🔴 **대량 조 해제는 여태 아무도 안 울렸다**(반박 P2-④). 해제만 일어나고 갱신이 0이면
           *   그건 「재편성」이 아니라 **스냅샷이 통째로 비었다**는 뜻이다 — 시즌 셀이 지워졌거나
           *   groups 시트가 비었거나 학생 번호가 전부 안 맞은 자리다. 위 무동작 갈래가 그 원인
           *   대부분을 막지만, 막는 것과 **보이는 것**은 다른 일이다(남은 원인은 시트 쪽이다).
           *   ⚠ 갱신이 하나라도 있으면 정상 재편성이라 안 운다 — 매 아침 우는 알림은 안 읽힌다. */
          const 조해제수 = Number(j.조해제 || 0);
          const 조갱신수 = (j.조갱신 || []).length;
          const 통째해제 = 조해제수 > 0 && 조갱신수 === 0;
          if (문제들.length || 막힘.length || 역할오류들.length || 무동의.length || 조문제들.length || 통째해제) {
            /* 🔴 **자르지 말고 접는다**(①배포 검수 P2). `slice(0, 900)` 은 앞 900자가 같은 두 판을
             *   같다고 읽어, 뒤쪽에서 새로 깨진 학생이 영영 안 울렸다 — 개수 서명과 같은 병이 길이
             *   축으로 재발한 것이다. 세는 눈(개수)은 사람이 읽게 남기고, 가르는 눈은 전문 해시가 진다. */
            const 원서명 = ['p:' + 문제들.map(p => p.번호 || p.줄).join(','),
              'b:' + 막힘.map(p => p.번호).join(','),
              'r:' + 역할오류들.join(','),
              'c:' + 무동의.join(','),
              'g:' + 조문제들.map(p => p.번호 || p.줄).join(','),
              'u:' + (통째해제 ? 조해제수 : 0)].join('|');
            서명 = 'p' + 문제들.length + '/b' + 막힘.length + '/r' + 역할오류들.length + '/c' + 무동의.length
              + '/g' + 조문제들.length + '/u' + (통째해제 ? 조해제수 : 0) + '#' + 접기_(원서명);
            const 줄 = [];
            if (문제들.length) 줄.push('■ 명부에 못 실린 행 — 시트를 고치면 다음 아침 자동 반영됩니다\n' +
              문제들.map(p => '· ' + (p.줄 || '?') + '행 ' + (p.번호 || '') + ': ' + (p.사유 || '')).join('\n'));
            if (막힘.length) 줄.push('■ 연락처가 기존 등록과 다릅니다 — 사람만 판단할 수 있어 덮지 않았습니다\n' +
              막힘.map(p => '· ' + (p.번호 || '') + ': ' + (p.사유 || '')).join('\n'));
            if (역할오류들.length) 줄.push('■ role 열 문제\n' + 역할오류들.map(s => '· ' + s).join('\n'));
            if (무동의.length) 줄.push('■ 오늘 명부에 새로 선 학생 중 동의가 0건입니다 — 다음 걸음은 동의 발급입니다\n' +
              무동의.map(c => '· ' + c).join('\n') +
              '\n(오늘 새로 선 학생만 셉니다 — 내일은 이 목록에 다시 안 뜹니다)');
            if (통째해제) 줄.push('■ 오늘 아침 학생 ' + 조해제수 + '명의 조·좌석이 **해제**됐고, 새로 배정된 학생은 0명입니다\n' +
              '· 정상 재편성이면 해제와 배정이 같이 납니다 — 배정이 0이라는 것은 groups 시트에서 읽은 편성이 통째로 비었다는 뜻입니다.\n' +
              '· 확인 순서: ① groups 시트에 이번 시즌 행이 있는지 ② 학생 번호가 명부(profiles)와 같은지(위 「조 편성에 못 실린 행」 참고)\n' +
              '· 그동안 검수 콘솔의 그 학생들은 「조 미편성」으로 뜹니다(남의 조에 조용히 앉지는 않습니다).');
            if (조문제들.length) 줄.push('■ 조 편성에 못 실린 행 — groups 시트를 고치면 다음 아침 자동 반영됩니다\n' +
              조문제들.map(p => '· ' + (p.줄 || '?') + '행 ' + (p.번호 || '') + ': ' + (p.사유 || '')).join('\n') +
              '\n(그 학생은 검수 콘솔에 「조 미편성」으로 뜹니다 — 남의 조에 조용히 앉는 것보다 낫습니다)');
            본문 = 줄.join('\n\n');
          }
        }
      }
    }
  } catch (e) {
    서명 = '왕복실패';   // 분류만(P2) — 예외 메시지에도 시각·URL 이 박힌다
    본문 = '명부 스윕이 돌지 못했습니다: ' + e +
      '\nprofiles 시트·ROSTER_INGEST_URL·네트워크·Edge Function 배포 상태를 확인하세요.';
  }

  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  if (String(getState(st, '명부스윕_상태').val || '') !== 서명) {
    if (서명) adminMail('[SYNK] ⚠️ 명부 스윕 — 확인이 필요합니다', 본문 + '\n\n※ 상태가 바뀌기 전까지 이 알림은 다시 오지 않습니다.');
    setState(st, '명부스윕_상태', 서명);
  }
}

/* ===================== 매일 백업 (30일 보관) ===================== */

function dailyBackup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const stamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const file = DriveApp.getFileById(ss.getId());

  const it = DriveApp.getFoldersByName('SYNK_백업');
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder('SYNK_백업');
  file.makeCopy('SYNK_앱데이터_백업_' + stamp, folder);

  // [v9.32] 상담 스프레드시트도 백업 — 별도 파일이라 앱 백업에 안 담긴다. 학생 로스터 원본(상담데이터입력)
  //   이자 수강·납입 장부이고, 사람 손 편집 + 폼 자동기록(10분마다)이 겹쳐 가장 손상되기 쉽다. 앱 백업과
  //   격리(자체 try/catch)해 상담 백업이 실패해도 앱 백업은 남게 한다.
  try {
    DriveApp.getFileById(CONSULT_SHEET_ID).makeCopy('SYNK_상담백업_' + stamp, folder);
  } catch (e) {
    Logger.log('상담시트 백업 실패(앱 백업은 정상): ' + e);
    adminMail('[SYNK] ⚠️ 상담시트 백업 실패', '상담 스프레드시트 사본 생성 실패: ' + e + '\nCONSULT_SHEET_ID·Drive 용량·권한을 확인하세요. 앱 데이터 백업은 정상입니다.');
  }

  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    const nm = f.getName();
    if ((nm.startsWith('SYNK_앱데이터_백업_') || nm.startsWith('SYNK_상담백업_')) && f.getDateCreated() < cutoff) {
      f.setTrashed(true); // [v9.32] 정리 대상에 상담 백업 접두사 포함(안 넣으면 무한 누적)
    }
  }
  Logger.log('백업 완료: ' + stamp);
}

/* ===================== 알림: 미납 / 학부모 / 재등록 / 상담지연 ===================== */

function checkTuition(asText) {
  const wantText = asText === true; // [v9.25] 텍스트 반환 모드(주간 통합) — 트리거 이벤트객체는 false로 강제
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pf = ss.getSheetByName('profiles');
  const last = pf.getLastRow();
  if (last < 2) return wantText ? '프로필 데이터 없음' : undefined;
  const data = pf.getRange(2, 1, last - 1, 15).getValues();
  const unpaid = [];
  data.forEach(r => {
    if (r[0] && r[3] === 'student' && !r[10]) {
      unpaid.push(r[0] + ' ' + r[1] + ' (' + (r[4] || '반 미정') + ')');
    }
  });
  if (wantText) {
    return unpaid.length
      ? '미납 ' + unpaid.length + '명\n' + unpaid.map(s => '· ' + s).join('\n') +
        '\n\n※ profiles의 tuition 칸이 비어있는 학생 기준입니다.'
      : '미납 없음 — 전원 납부 완료 ✅';
  }
  if (unpaid.length === 0 || !quotaOk(1)) return;
  MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 미납 ' + unpaid.length + '명 - 확인 필요',
    'SYNK 미납 현황\n\n' + unpaid.map(s => '· ' + s).join('\n') +
    '\n\n※ profiles의 tuition 칸이 비어있는 학생 기준입니다.');
  Logger.log('미납 메일: ' + unpaid.length + '명');
}

// [v9.28] 학부모 문의 인바운드 — inquiries 시트(Glide "Add Row"로 학부모가 직접 씀)를 읽기만. 주간 통합 리포트 섹션 규약(asText). — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md)
function checkNewInquiries_(asText) {
  const wantText = asText === true;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const iq = ensureSheet(ss, 'inquiries', ['student_id', '이름', '문의내용', '상태', '접수시각']);
  const last = iq.getLastRow();
  if (last < 2) return wantText ? '신규 문의 없음' : undefined;
  const rows = iq.getRange(2, 1, last - 1, 5).getValues();
  const pending = rows.filter(r => r[0] && (!r[3] || String(r[3]).trim() === '' || String(r[3]).trim() === '신규'));
  if (wantText) {
    return pending.length
      ? '신규 문의 ' + pending.length + '건\n' + pending.map(r => '· ' + (r[1] || r[0]) + ': ' + String(r[2] || '').slice(0, 80)).join('\n')
      : '신규 문의 없음';
  }
  if (pending.length === 0 || !quotaOk(1)) return;
  MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 💬 새 학부모 문의 ' + pending.length + '건',
    pending.map(r => '· ' + (r[1] || r[0]) + ': ' + String(r[2] || '')).join('\n\n') +
    '\n\ninquiries 시트에서 상태를 "처리완료"로 바꿔주세요.');
}

// [v9.32] 신규 학부모 문의 → 아침 브리핑 큐(익일 08시). 주간 리포트(월요일)의 checkNewInquiries_는 상태
//   필터라 응답이 최대 7일 지연됐다. 여기선 '아직 안 본 행'을 포인터로 잡아 하루 안에 인지시킨다. 즉시
//   발송이 아니라 아침 1통(adminMail 큐)에 합류해 알림 다이어트를 지킨다. 시트 쓰기 0(포인터=Properties).
function queueNewInquiries_(ss) {
  const iq = ss.getSheetByName('inquiries');
  if (!iq || iq.getLastRow() < 2) return;
  const props = PropertiesService.getScriptProperties();
  const last = iq.getLastRow();
  const from = Number(props.getProperty('문의알림_포인터')) || 1;
  if (from > last) { props.setProperty('문의알림_포인터', String(last)); return; } // [v9.34] 행 정리로 시트가 줄면 클램프 — 이후 신규 문의 영구 누락 방지 (min 보정은 정상 정지 상태에서 마지막 행 무한 재큐잉이라 오답)
  if (from >= last) return;
  const rows = iq.getRange(from + 1, 1, last - from, 5).getValues();
  const fresh = [];
  rows.forEach(function (r) {
    if (r[0] && String(r[2] || '').trim()) fresh.push('· ' + (r[1] || r[0]) + ': ' + String(r[2]).slice(0, 120));
  });
  if (fresh.length) {
    adminMail('[SYNK] 💬 새 학부모 문의 ' + fresh.length + '건',
      fresh.join('\n') + '\n\ninquiries 시트에서 상태를 "처리완료"로 바꿔주세요.');
  }
  props.setProperty('문의알림_포인터', String(last)); // 내용 없는 행도 전진(주간 리포트 상태필터가 백업)
}

function notifyParents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');

  const pf = ss.getSheetByName('profiles');
  const pfLast = pf.getLastRow();
  if (pfLast < 2) return;
  const pfData = pf.getRange(2, 1, pfLast - 1, 26).getValues();
  const students = {};
  pfData.forEach(r => {
    if (r[0] && r[3] === 'student') {
      students[r[0]] = { name: r[1], cls: r[4] || '', pEmail: String(r[25] || '').trim() };
    }
  });

  const pl = ss.getSheetByName('point_logs');
  const plLast = pl.getLastRow();
  const todayPts = {};
  if (plLast >= 2) {
    pl.getRange(2, 1, plLast - 1, 6).getValues().forEach(r => {
      const sid = r[1], d = r[5];
      if (!sid || !d || dstr(d, tz) !== todayStr) return;
      if (!todayPts[sid]) todayPts[sid] = [];
      todayPts[sid].push({ pts: Number(r[2]) || 0, reason: r[3] || '', by: r[4] || '' });
    });
  }

  const at = ss.getSheetByName('attendance');
  const atLast = at.getLastRow();
  const todayAtt = new Set();
  if (atLast >= 2) {
    at.getRange(2, 1, atLast - 1, 4).getValues().forEach(r => { // [v9.54] method 열까지 읽어 '출석' 판정 — todayBoard_·주간 다이제스트와 동일 방어(현 유입값은 전부 '출석*'이라 동작 동일)
      if (r[1] && r[2] && dstr(r[2], tz) === todayStr && String(r[3]).indexOf('출석') > -1) todayAtt.add(r[1]);
    });
  }

  // [v9.28] 결석 사전신고 — 학부모가 미리 알린 학생은 미출석 오경보에서 제외 (Glide "Add Row"로 직접 씀) — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md)
  const an = ensureSheet(ss, 'absence_notice', ['student_id', '반', '날짜', '사유', '등록시각']);
  const preNotified = new Set();
  if (an.getLastRow() >= 2) {
    an.getRange(2, 1, an.getLastRow() - 1, 3).getValues().forEach(r => {
      if (r[0] && r[2] && dstr(r[2], tz) === todayStr) preNotified.add(String(r[0]).trim());
    });
  }

  // 발송 대상 먼저 집계 (쿼터 확인용)
  const schMap = scheduleMap(ss); // [v9.22] 루프 밖 1회
  const jobs = [];
  Object.keys(students).forEach(sid => {
    const s = students[sid];
    if (!s.pEmail || s.pEmail.indexOf('@') === -1) return;
    const goodPts = (todayPts[sid] || []).filter(p => p.pts > 0);
    const attended = todayAtt.has(sid);
    if (PARENT_MAIL_PRAISE && goodPts.length > 0) jobs.push({ s: s, type: 'praise', pts: goodPts, att: attended }); // [v5.4] 칭찬은 인앱 전용
    else if (PARENT_MAIL_ABSENT && !attended && !preNotified.has(sid) && hasClassToday(ss, s.cls, schMap)) jobs.push({ s: s, type: 'absent' }); // [v9.28] 사전신고 제외
  });
  if (jobs.length === 0) { Logger.log('학부모 알림 대상 없음'); return; }
  if (!quotaOk(jobs.length)) return;

  jobs.forEach(j => {
    const s = j.s;
    if (j.type === 'praise') {
      let body = s.name + ' 학생의 오늘 활동입니다 (' + todayStr + ')\n\n';
      j.pts.forEach(p => {
        body += '⭐ ' + p.reason + ' +' + p.pts + 'P' + (p.by ? ' (' + p.by + ' 선생님)' : '') + '\n';
      });
      if (j.att) body += '\n✅ 오늘 정상 출석했습니다.\n';
      body += '\n항상 ' + s.name + ' 학생을 응원해주셔서 감사합니다.\n- SYNK 학원';
      MailApp.sendEmail(s.pEmail, '[SYNK] ' + s.name + ' 학생, 오늘 칭찬받았어요! 🎉', body);
    } else {
      // [v9.28] 한몽 병기 — 유일하게 발송되는 안전 알림인데 한국어 전용이던 문제 수정 (등원 메일과 동일 패턴)
      // [v9.120] quotaOk 가드 신설 — 이 발송만 관문 밖이었다(쿼터 소진 시 무방비 + 리허설 누수)
      if (quotaOk(1)) MailApp.sendEmail(s.pEmail, '[SYNK] ' + s.name + ' өнөөдөр ирээгүй байна',
        'Сайн байна уу! 👋\n\n' + s.name + ' сурагч өнөөдөр(' + todayStr + ') ирц бүртгэгдээгүй байна.\n' +
        'Хэрэв шалтгаантай бол багшид мэдэгдээрэй эсвэл дараагийн удаа хичээлийн өмнө урьдчилан мэдэгдээрэй.\n\n' +
        '(' + s.name + ' 학생이 오늘(' + todayStr + ') 출석 기록이 없습니다. 사정이 있으셨다면 담당 선생님께 알려주시거나, 다음부터는 수업 전 결석 사전신고를 이용해 주세요.)\n\n' +
        '— SYNK · Тархи судлалд суурилсан солонгос хэлний академи');
    }
  });
  Logger.log('학부모 알림: ' + jobs.length + '건');
}

function checkReenrollment(asText) {
  const wantText = asText === true; // [v9.25] 텍스트 반환 모드(주간 통합) — 트리거 이벤트객체는 false로 강제
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');

  const pf = ss.getSheetByName('profiles');
  const last = pf.getLastRow();
  if (last < 2) return wantText ? '프로필 데이터 없음' : undefined;
  const data = pf.getRange(2, 1, last - 1, 15).getValues();

  function parseReg(v) { // [opt] toDate_ 재사용 + 비8자리 문자열 new Date 폴백 유지
    if (!v) return null;
    return toDate_(v) || (isNaN(new Date(v)) ? null : new Date(v));
  }

  const hits = [];
  data.forEach(r => {
    if (!r[0] || r[3] !== 'student') return;
    const reg = parseReg(r[11]);
    if (!reg) return;
    [3, 6, 12].forEach(m => {
      const target = new Date(reg);
      target.setMonth(target.getMonth() + m);
      // [v9.34] 주 1회(월) 실행인데 '당일 정확 일치'만 보면 화~일 도래분 ~86%가 영구 미보고 — 지난 7일 내 도래로 판정
      const diffDays = (now - target) / 86400000;
      if (diffDays >= 0 && diffDays < 7) {
        hits.push('· ' + r[0] + ' ' + r[1] + ' (' + (r[4] || '') + ') — ' + m + '개월차');
      }
    });
  });
  if (wantText) {
    return hits.length
      ? '재등록 시점 ' + hits.length + '명 (지난 7일 내 도래)\n' + hits.join('\n')
      : '지난 7일 내 재등록 시점 학생 없음';
  }
  if (hits.length === 0 || !quotaOk(1)) return;
  MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 🔄 재등록 시점 학생 ' + hits.length + '명',
    '지난 7일 내 재등록 상담 시점이 도래한 학생입니다.\n\n' + hits.join('\n') +
    '\n\n재등록 안내 및 상담을 진행해주세요.');
  Logger.log('재등록 알림: ' + hits.length + '명');
}

function checkConsultDelay() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const now = new Date();
  const fr = ensureSheet(ss, 'form_responses', ['접수ID', '타임스탬프', '이름', '경로', '처리상태']); // [v9.34] 무가드 → 시트 부재 시 매일 아침 크래시 차단
  const last = fr.getLastRow();
  if (last < 2) { Logger.log('상담 응답 없음'); return; }
  if (fr.getRange('E1').getValue() !== '처리상태') fr.getRange('E1').setValue('처리상태');

  const data = fr.getRange(2, 1, last - 1, 5).getValues();
  const overdue = [];
  data.forEach(r => {
    const ts = r[1], status = String(r[4] || '').trim();
    if (!ts || status === '완료') return;
    const t = (ts instanceof Date) ? ts : new Date(ts);
    if (isNaN(t)) return;
    const hours = (now - t) / 3600000;
    if (hours >= 24) overdue.push('· ' + (r[2] || '(이름 미입력)') + ' — ' + Math.floor(hours) + '시간 경과');
  });
  if (overdue.length === 0) { Logger.log('지연 상담 없음'); return; }
  if (!quotaOk(1)) return;
  MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] ⏰ 미처리 상담 ' + overdue.length + '건',
    '24시간 이상 미처리 상담:\n\n' + overdue.join('\n') +
    '\n\n처리 후 form_responses의 처리상태에 "완료"를 입력하세요.');
  Logger.log('상담 지연: ' + overdue.length + '건');
}

/* ===================== 주간 리포트 ===================== */

function weeklyReport(asText) {
  const wantText = asText === true; // [v9.25] 텍스트 반환 모드(주간 통합) — 트리거 이벤트객체는 false로 강제
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const pf = ss.getSheetByName('profiles');
  const cs = ss.getSheetByName('class_stats');
  const last = pf.getLastRow();
  if (last < 2) return wantText ? '프로필 데이터 없음' : undefined;
  if (!wantText && !quotaOk(1)) return;

  const pfData = pf.getRange(2, 1, last - 1, 25).getValues();
  const top = pfData.filter(r => r[0] && (Number(r[16]) || 0) > 0)
    .sort((a, b) => (Number(b[16]) || 0) - (Number(a[16]) || 0)).slice(0, 3);

  const title = '📊 SYNK 주간 리포트 (' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd') + ')'; // [v9.25]
  let body = '🏆 이번달 TOP 3\n';
  body += top.length ? top.map((r, i) =>
    (i + 1) + '위 ' + r[1] + ' (' + (r[4] || '') + ') - ' + r[16] + 'P').join('\n') + '\n'
    : '아직 포인트 기록 없음\n';

  body += '\n⚠️ 이탈위험 학생 (상)\n';
  const risky = pfData.filter(r => r[0] && String(r[24]).startsWith('상'));
  body += risky.length === 0 ? '없음\n'
    : risky.map(r => '· ' + r[1] + ' (' + (r[4] || '') + ') - ' + r[24]).join('\n') + '\n';

  body += '\n🏫 반별 현황\n';
  if (cs && cs.getLastRow() >= 2) {
    cs.getRange(2, 1, cs.getLastRow() - 1, 6).getValues().forEach(r => {
      body += '· ' + r[0] + ': ' + r[1] + '명, 월간 ' + r[3] + 'P, 캐릭터 ' + r[4] + '\n';
    });
  }
  // [v7.7] 🔕 무포인트 경보 — 최근 QUIET_DAYS일간 포인트 0 (조용히 멀어지는 학생)
  body += '\n🔕 ' + QUIET_DAYS + '일+ 무포인트\n';
  const colsOk = pf.getMaxColumns() >= 48;
  const lpCol = colsOk ? pf.getRange(2, 48, last - 1, 1).getValues() : [];
  const nowQ = Date.now(), quiet = [];
  pfData.forEach((r, i) => {
    if (!r[0] || r[3] !== 'student') return;
    const lp = colsOk ? String(lpCol[i][0] || '') : '';
    if (!lp) { quiet.push('· ' + r[1] + ' (' + (r[4] || '') + ') — 포인트 기록 없음'); return; }
    const dq = Math.floor((nowQ - new Date(lp).getTime()) / 86400000);
    if (dq >= QUIET_DAYS) quiet.push('· ' + r[1] + ' (' + (r[4] || '') + ') — ' + dq + '일째');
  });
  body += quiet.length ? quiet.join('\n') + '\n' : '없음 — 전원이 이번 주 포인트를 받았어요 🎉\n';

  // [v7.8] 🧯 복구 리허설 경과 — 백업의 존재와 복구 능력은 다른 문제
  const stW = ss.getSheetByName('app_state');
  const drill = stW ? String(getState(stW, '복구리허설일').val || '') : '';
  const dDays = drill ? Math.floor((Date.now() - new Date(drill).getTime()) / 86400000) : -1;
  body += '\n🧯 복구 리허설: ' + (dDays < 0 ? '기록 없음 — restoreDrill을 한 번 실행해주세요 (10분, 안전)'
    : dDays + '일 전' + (dDays > 30 ? ' ⚠️ 30일 초과 — 이번 주 권장' : ' ✅')) + '\n';

  // [v9.233] 🗣 발화 지수 꼬리 — 라이브 계산이 아니라 talk_index_log(매주 월 적재)에 «남긴 결과»를 읽는다.
  //   시즌이 지나도 궤적이 남는 것이 이 칸의 존재 이유(세계판 대조 08-14). 전주 대비 = 어제의 그 학생과만 비교.
  //   하위 3 지명은 원장 내부 계기판 — 학생·학부모 화면에 싣지 않는다(㉢).
  body += '\n🗣 발화 지수(주간 스냅샷)\n';
  const tl = ss.getSheetByName(TALK_INDEX_LOG_SHEET);
  if (!tl || tl.getLastRow() < 2) {
    body += '기록 없음 — 편성·수업 시작 후 매주 월요일 쌓입니다\n';
  } else {
    const rowsT = tl.getRange(2, 2, tl.getLastRow() - 1, 9).getValues(); // B시즌 ~ J pct
    /* [v9.234] 현재 시즌·주차는 «지금»에서 계산한다 — 예전엔 마지막 «물리» 행을 이번 주로 삼아서, 이번 주
     *   적재가 0행이면(첫 수업 전 · 시즌 경계 · 모든 max=0 · 적재 실패) **지난주 숫자를 이번 주라고 보고**했다.
     *   「이번 주 기록 없음」과 「낡은 기록」이 같은 모양이면 안 된다 — 원장이 그 차이를 못 본다.
     *   시즌 칸도 seasonKeyOf_ 로 접어 읽는다(시트가 날짜로 삼킨 옛 행까지 같은 글자로 맞춘다). */
    const startT = seasonStartOf_(ss);
    const curSeason = seasonLabelOf_(ss, tz);
    const curWeek = startT ? seasonWeekOf_(startT, new Date()) : 0;
    const prevPct = {}, cur = [];
    rowsT.forEach(r => {
      if (seasonKeyOf_(r[0], tz) !== curSeason) return;
      const w = Number(r[1]);
      if (w === curWeek - 1) prevPct[String(r[3])] = Number(r[8]);
      else if (w === curWeek) cur.push(r);
    });
    if (!cur.length) body += '이번 주 기록 0행 (시즌 ' + curSeason + ' · ' + curWeek + '주차)\n';
    else {
      body += curWeek + '주차 ' + cur.length + '명 기록 · 하위 3 (전주 대비):\n';
      cur.sort((a, b) => Number(a[8]) - Number(b[8])).slice(0, 3).forEach(r => {
        const p = prevPct[String(r[3])];
        body += '· ' + (r[4] || r[3]) + ' (' + r[2] + ') — ' + r[8] + '%' +
          (p === undefined ? ' (전주 기록 없음)' : ' (전주 ' + p + '%)') + '\n';
      });
    }
  }

  if (wantText) return body;
  if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 주간 리포트', title + '\n\n' + body);
  Logger.log('주간 리포트 발송');
}

/* ===================== [v9.26] KPI 계측 (이탈률·전환율) =====================
 * 정의·한계 상세 주석은 파일 상단 KPI_CHURN_DAYS 블록 참조. 시간대는 스프레드시트 tz 관례.
 * 빈 시트·데이터 0건·분모 0(0나눗셈) 전부 안전 처리 · 월 키(yyyy-MM) 멱등 upsert. */

function ensureKpiSheet_() { // kpi_metrics 시트 보장 (bootstrapSynk 스켈레톤에도 등록)
  return ensureSheet(SpreadsheetApp.getActiveSpreadsheet(), KPI_SHEET_NAME, KPI_HEADERS);
}

function kpiParseDate_(v) { // 관용 날짜 파싱 — Date/yyyymmdd(문자·숫자)/일반 문자열 → Date, 실패 시 null
  if (!v && v !== 0) return null;
  return toDate_(v) || (isNaN(new Date(v).getTime()) ? null : new Date(v));
}

function kpiReadRow_(ym) { // kpi_metrics에서 월 키 행을 객체로 (없으면 null)
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KPI_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return null;
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, KPI_HEADERS.length).getValues();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[0]) === ym) {
      return {
        ym: ym, opening: Number(r[1]) || 0, newReg: Number(r[2]) || 0, churn: Number(r[3]) || 0,
        churnRate: Number(r[4]) || 0, consult: Number(r[5]) || 0, conv: Number(r[6]) || 0,
        convRate: Number(r[7]) || 0, confirm: String(r[9] || '')
      };
    }
  }
  return null;
}

// 해당 월(yyyy-MM) KPI 계산 후 월 키로 멱등 upsert. yearMonth 미지정=당월. confirm===true면 확정여부='확정'.
function computeKpiMetrics(yearMonth, confirm) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const ym = (yearMonth && /^\d{4}-\d{2}$/.test(String(yearMonth)))
    ? String(yearMonth) : Utilities.formatDate(now, tz, 'yyyy-MM'); // 기본 = 당월
  const y = Number(ym.slice(0, 4)), mo = Number(ym.slice(5, 7));
  const monthStart = new Date(y, mo - 1, 1, 0, 0, 0);            // 해당 월 1일 00:00
  const monthEnd = new Date(y, mo, 0, 23, 59, 59);              // 해당 월 말일 23:59:59
  const refDate = (monthEnd.getTime() < now.getTime()) ? monthEnd : now; // 과거월=월말·당월=현재
  const msDay = 86400000;
  const wantConfirm = confirm === true;

  // ── 재원생 로스터 (profiles, role=student) — created_at으로 코호트 분리 ──
  const pf = ss.getSheetByName('profiles');
  const students = []; // {id, createdAt(Date|null)}
  if (pf && pf.getLastRow() >= 2) {
    pf.getRange(2, 1, pf.getLastRow() - 1, 15).getValues().forEach(r => { // A~O
      if (!r[0] || r[3] !== 'student') return;
      students.push({ id: String(r[0]), createdAt: kpiParseDate_(r[14]) }); // O created_at
    });
  }
  // 기초재원 = 월 시작 전 등록(레거시·created_at 불명 포함). 신규등록 = created_at이 해당 월.
  const opening = students.filter(s => !s.createdAt || s.createdAt.getTime() < monthStart.getTime());
  const newReg = students.filter(s => s.createdAt &&
    s.createdAt.getTime() >= monthStart.getTime() && s.createdAt.getTime() <= monthEnd.getTime());

  // ── 마지막 출석일(기준일 이하) — attendance 시트에서 산출(과거월 스냅샷 재현 가능) ──
  const lastAtt = {}; // id -> ms(가장 최근, refDate 이하)
  const at = ss.getSheetByName('attendance');
  if (at && at.getLastRow() >= 2) {
    at.getRange(2, 1, at.getLastRow() - 1, 3).getValues().forEach(r => {
      const sid = r[1], dd = kpiParseDate_(r[2]);
      if (!sid || !dd || dd.getTime() > refDate.getTime()) return; // 기준일 이후 출석 제외
      const t = dd.getTime();
      if (!lastAtt[sid] || t > lastAtt[sid]) lastAtt[sid] = t;
    });
  }

  // ── 이탈 = 기초재원 코호트 중 기준일 활동공백 >= KPI_CHURN_DAYS (출석 없으면 created_at 기준) ──
  let churn = 0;
  opening.forEach(s => {
    const anchor = lastAtt[s.id] || (s.createdAt ? s.createdAt.getTime() : null);
    if (anchor == null) return; // 출석·created_at 둘 다 없으면 판정 보류
    if (Math.floor((refDate.getTime() - anchor) / msDay) >= KPI_CHURN_DAYS) churn++;
  });
  const openingN = opening.length;
  const churnRate = openingN ? Math.round((churn / openingN) * 1000) / 10 : 0; // 소수1자리·0나눗셈 가드

  // ── 전환 = 해당 월 상담 접수 중 profiles 신규 등록(학생ID 매칭)으로 이어진 비율 ──
  const newIds = {}; newReg.forEach(s => { newIds[s.id] = 1; });
  let consultCnt = 0, convCnt = 0;
  const chConsult = {}, chConv = {}; // [v9.84·⑤] 인지채널별 상담/등록 — 이미 돌던 스캔에 열 1개만 추가(마케팅 예산 배분의 실측 근거)
  try { // 상담시트 접근 실패해도 이탈 지표는 산출 — 전환만 0 처리
    const src = SpreadsheetApp.openById(CONSULT_SHEET_ID).getSheetByName('상담데이터입력');
    if (src && src.getLastRow() >= 3) {
      const chIdx = src.getRange(2, 1, 1, Math.max(62, src.getLastColumn())).getValues()[0]
        .map(h => String(h || '').trim()).indexOf('인지채널'); // [v9.84·⑤] 헤더 이름 해석 — 없으면 -1(집계 생략)
      src.getRange(3, 1, src.getLastRow() - 2, 62).getValues().forEach(r => { // v18.1 = 62열
        const intake = kpiParseDate_(r[2]); // C 등록일 = 폼 접수 ts (상담 접수 시점)
        if (!intake || intake.getTime() < monthStart.getTime() || intake.getTime() > monthEnd.getTime()) return;
        consultCnt++; // 학생ID 없는 행도 분모 포함(매칭 한계 — 전환 0 취급)
        const sid = String(r[59] || '').trim(); // BH 학생ID
        const matched = !!(sid && newIds[sid]);
        if (matched) convCnt++;                  // 같은 달 profiles 신규 등록과 매칭
        if (chIdx > -1 && chIdx < 62) {          // [v9.84·⑤] 채널 집계(8버킷 — 미기입은 '미기입' 버킷)
          const ch = String(r[chIdx] || '').trim() || '미기입';
          chConsult[ch] = (chConsult[ch] || 0) + 1;
          if (matched) chConv[ch] = (chConv[ch] || 0) + 1;
        }
      });
    }
  } catch (e) {
    Logger.log('computeKpiMetrics 상담시트 접근 실패(전환 0 처리): ' + e);
  }
  const convRate = consultCnt ? Math.round((convCnt / consultCnt) * 1000) / 10 : 0; // 0나눗셈 가드

  // ── 월 키 멱등 upsert (재실행 안전 · 확정여부 보존) ──
  const sh = ensureKpiSheet_();
  const calcStamp = Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm');
  const last = sh.getLastRow();
  let target = -1, prevConfirm = '';
  if (last >= 2) {
    const keys = sh.getRange(2, 1, last - 1, 1).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === ym) { target = i + 2; prevConfirm = String(sh.getRange(target, 10).getValue() || ''); break; }
    }
  }
  const confirmVal = wantConfirm ? '확정' : prevConfirm; // 확정 표기는 유지(잠정 재계산이 지우지 않음)
  const rowArr = [ym, openingN, newReg.length, churn, churnRate, consultCnt, convCnt, convRate, calcStamp, confirmVal];
  if (target > 0) sh.getRange(target, 1, 1, KPI_HEADERS.length).setValues([rowArr]);
  else sh.getRange(last + 1, 1, 1, KPI_HEADERS.length).setValues([rowArr]);

  Logger.log('KPI ' + ym + ' → 기초 ' + openingN + '·신규 ' + newReg.length + '·이탈 ' + churn +
    '(' + churnRate + '%)·상담 ' + consultCnt + '·전환 ' + convCnt + '(' + convRate + '%)' + (confirmVal ? '·' + confirmVal : ''));
  return {
    ym: ym, opening: openingN, newReg: newReg.length, churn: churn, churnRate: churnRate,
    consult: consultCnt, conv: convCnt, convRate: convRate, confirm: confirmVal,
    chConsult: chConsult, chConv: chConv // [v9.84·⑤] 채널별 상담/등록(KPI 시트 스키마는 불변 — 리포트 텍스트 전용)
  };
}

// [v9.84·⑤] 채널별 등록 한 줄 — "페이스북 2/5 · 추천 1/2" (등록/상담). 등록 많은 순 → 상담 많은 순, 상위 5개.
function kpiChannelLine_(cur) {
  if (!cur || !cur.chConsult) return '';
  const keys = Object.keys(cur.chConsult);
  if (!keys.length) return '';
  keys.sort((a, b) => ((cur.chConv[b] || 0) - (cur.chConv[a] || 0)) || (cur.chConsult[b] - cur.chConsult[a]));
  return keys.slice(0, 5).map(k => k + ' ' + (cur.chConv[k] || 0) + '/' + cur.chConsult[k]).join(' · ');
}

// 주간 통합 리포트 섹션 — 당월 잠정치 + 전월(확정 우선) 한 줄 비교. asText 패턴(기존 섹션과 동일).
function kpiSection_(asText, kpiData) {
  const wantText = asText === true; // 트리거 이벤트객체 방어 — true일 때만 텍스트 모드
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const y = Number(Utilities.formatDate(now, tz, 'yyyy')), m = Number(Utilities.formatDate(now, tz, 'MM'));
  // [v9.29] weeklyJobs 주입치(kpiData) 재사용 — 이중 계산 제거. 주입 없거나 형태가 다르면(단독 실행·트리거 이벤트객체) 기존처럼 자체 계산.
  const inj = (kpiData && kpiData.cur) ? kpiData : null;
  const curYm = inj ? inj.curYm : Utilities.formatDate(now, tz, 'yyyy-MM');
  const prevYm = inj ? inj.prevYm : Utilities.formatDate(new Date(y, m - 2, 1), tz, 'yyyy-MM'); // 전월(연 경계 안전)
  const cur = inj ? inj.cur : computeKpiMetrics(curYm);                       // 당월 잠정 재계산(멱등)
  const prev = inj ? inj.prev : (kpiReadRow_(prevYm) || computeKpiMetrics(prevYm)); // 전월 확정 우선·없으면 잠정

  // [v9.29] KPI 섹션은 '전월 대비 변화'에 집중 — 당월 현재값·신호등 판정은 경영계기판 섹션이 담당(같은 메일 중복 표시 정리).
  const dChurn = prev ? Math.round((cur.churnRate - (prev.churnRate || 0)) * 10) / 10 : null;
  const dConv = prev ? Math.round((cur.convRate - (prev.convRate || 0)) * 10) / 10 : null;
  const sgn = v => v > 0 ? '+' + v : String(v);
  let body = '· 이탈률 ' + curYm + ' ' + cur.churn + '/' + cur.opening + '명=' + cur.churnRate + '%' +
    (prev ? ' (전월 ' + (prev.churnRate || 0) + '% · Δ' + sgn(dChurn) + '%p)' : '') + '\n';
  body += '· 전환율 ' + cur.conv + '/' + cur.consult + '건=' + cur.convRate + '%' +
    (prev ? ' (전월 ' + (prev.convRate || 0) + '% · Δ' + sgn(dConv) + '%p)' : '') + '\n';
  const chLine = kpiChannelLine_(cur); // [v9.84·⑤] 채널별 등록/상담 — 상담폼 인지채널 자동 집계(leads 수기 이관과 별개 축)
  if (chLine) body += '· 채널별 등록/상담: ' + chLine + '\n';
  body += '· 전월(' + prevYm + ') ' + (prev && prev.confirm === '확정' ? '확정치' : '잠정치') + ' 기준';
  body += '\n※ 이탈=마지막출석 ' + KPI_CHURN_DAYS + '일+ 무활동 기초재원 · 전환=당월 상담 접수→신규등록';

  if (wantText) return body;
  Logger.log(body);
  return body;
}

// 전월 KPI 확정 스냅샷 (monthlyJobs 1일 실행 — safeRun 래핑용 무인자 함수)
function kpiSnapshotPrevMonth_() {
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const now = new Date();
  const y = Number(Utilities.formatDate(now, tz, 'yyyy')), m = Number(Utilities.formatDate(now, tz, 'MM'));
  const prevYm = Utilities.formatDate(new Date(y, m - 2, 1), tz, 'yyyy-MM'); // 전월(연 경계 안전)
  computeKpiMetrics(prevYm, true); // 확정여부='확정'
}

// 수동 실행용: 당월 즉시 계산 + Logger 출력
function kpiNow() {
  const r = computeKpiMetrics();
  Logger.log('kpiNow ' + r.ym + ': 기초재원 ' + r.opening + ' · 신규 ' + r.newReg + ' · 이탈 ' + r.churn +
    '(' + r.churnRate + '%) · 상담 ' + r.consult + ' · 전환 ' + r.conv + '(' + r.convRate + '%) · ' + (r.confirm || '잠정'));
  return r;
}

/* ===================== 생일 자동 +20 ===================== */

function birthdayCheck() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const mmdd = Utilities.formatDate(now, tz, 'MM-dd');
  const thisYear = Utilities.formatDate(now, tz, 'yyyy');

  const pf = ss.getSheetByName('profiles');
  const pfLast = pf.getLastRow();
  if (pfLast < 2) return;
  const pfData = pf.getRange(2, 1, pfLast - 1, 26).getValues();

  function birthMMDD(v) { const d = toDate_(v); return d ? Utilities.formatDate(d, tz, 'MM-dd') : ''; } // [opt] toDate_로 일원화

  const pl = ss.getSheetByName('point_logs');
  const given = new Set();
  ['point_logs', 'point_logs_archive'].forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(r => {
      if (String(r[3]) === '생일축하' && r[5] && dstr(r[5], tz, 'yyyy-MM').substring(0, 4) === thisYear) {
        given.add(r[1]);
      }
    });
  });

  const kids = pfData.filter(r =>
    r[0] && r[3] === 'student' && birthMMDD(r[5]) === mmdd && !given.has(r[0]));
  if (kids.length === 0) return;

  appendPoints(ss, kids.map(r => [r[0], PT.생일, '생일축하', '시스템']));

  const emails = PARENT_MAIL_BIRTHDAY ? kids.filter(r => String(r[25] || '').indexOf('@') > -1) : []; // [v5.4]
  if (emails.length && quotaOk(emails.length)) {
    emails.forEach(r => {
      // [v9.28] 한몽 병기 — 유일 연 1회 발송인데 한국어 전용이던 문제 수정
      MailApp.sendEmail(String(r[25]).trim(),
        '[SYNK] 🎂 ' + r[1] + ' — Төрсөн өдрийн мэнд хүргэе!',
        r[1] + ' сурагчийн төрсөн өдрийг SYNK гэр бүл бүгд тэмдэглэж байна!\n' +
        'Баяр хүргэсэн оноо +' + PT.생일 + 'P бэлэглэлээ 🎁\n\n' +
        '(' + r[1] + ' 학생의 생일을 SYNK 가족 모두가 축하합니다! 축하 포인트 +' + PT.생일 + 'P를 선물로 드렸어요 🎁)\n\n' +
        '— SYNK · Тархи судлалд суурилсан солонгос хэлний академи');
    });
  }
  adminMail('[SYNK] 오늘 생일 ' + kids.length + '명',
    kids.map(r => '· ' + r[0] + ' ' + r[1]).join('\n') + '\n\n+' + PT.생일 + 'P 자동 지급 완료'); // [v5.4] 브리핑 통합 · [v9.34] quotaOk 게이트 밖 — 큐(쿼터 0)라 쿼터 부족 날에도 지급 사실이 원장 브리핑에 남게
  calcAll();
  Logger.log('생일 지급: ' + kids.length + '명');
}

/* ===================== 반 레이드 ===================== */

function raidMonday() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekKey = Utilities.formatDate(monday, tz, 'yyyy-MM-dd');

  const rd = ensureSheet(ss, 'raid',
    ['week', 'class_name', '목표', '달성포인트', '상태', '보상지급']);
  const rdLast = rd.getLastRow();
  if (rdLast >= 2) {
    const exists = rd.getRange(2, 1, rdLast - 1, 1).getValues()
      .some(r => dstr(r[0], tz) === weekKey);
    if (exists) { Logger.log('이번주 레이드 이미 생성됨'); return; }
  }
  const cs = ss.getSheetByName('class_stats');
  if (!cs || cs.getLastRow() < 2) return;
  // [v7.8] 🏖️ 보스 휴식 주 — 원장이 app_state '보스휴식주'에 날짜(그 주 아무 날, 쉼표로 여러 주)를 넣으면 소환 스킵
  const stR = ss.getSheetByName('app_state');
  const restRaw = stR ? String(getState(stR, '보스휴식주').val || '') : '';
  if (restRaw) {
    const tzR = ss.getSpreadsheetTimeZone();
    const nowR = new Date();
    const m0 = new Date(nowR); m0.setDate(nowR.getDate() - ((nowR.getDay() + 6) % 7)); m0.setHours(0, 0, 0, 0);
    const weekKeyR = Utilities.formatDate(m0, tzR, 'yyyy-MM-dd');
    const restKeys = restRaw.split(',').map(s => {
      const d = new Date(String(s).trim());
      if (isNaN(d.getTime())) return '';
      const w = new Date(d); w.setDate(d.getDate() - ((d.getDay() + 6) % 7)); w.setHours(0, 0, 0, 0);
      return Utilities.formatDate(w, tzR, 'yyyy-MM-dd');
    });
    if (restKeys.indexOf(weekKeyR) > -1) {
      const rsR = ensureSheet(ss, 'raid_story', ['date','class_name','유형','제목','스토리']);
      const dupR = rsR.getLastRow() >= 2 && rsR.getRange(2, 1, rsR.getLastRow() - 1, 3).getValues()
        .some(r => dstr(r[0], tzR) === weekKeyR && String(r[2]) === '휴식');
      if (!dupR) rsR.getRange(rsR.getLastRow() + 1, 1, 1, 5).setValues([[weekKeyR, '전체', '휴식', '🏖️ 보스도 방학!',
        '이번 주 보스는 온천 여행을 떠났다… 크루들도 재충전 타임! 다음 주 월요일, 새로운 보스가 돌아온다 💤']]);
      Logger.log('레이드: 보스 휴식 주(' + weekKeyR + ') — 소환 스킵');
      return;
    }
  }
  const smR = scheduleMap(ss);
  // [v7.2 → v9.95] 보스 HP = 반 정원 × 계수(RAID_HP_PER 평일 28 · 주말 8). 매주 같은 HP = 외울 수 있는 보스.
  //   [v9.95] 정원 출처가 **반 이름 → schedule 시트 D열**로 바뀌었다(구 v8.3 이름 판정 폐기).
  //     전 반 16명이면 평일 448 · 주말 128. 계수는 안 건드린다 — 1인당 주간 획득량에서 나온 값이라
  //     정원이 20→16으로 줄면 HP도 비례해 줄 뿐, 학생 1명이 져야 할 몫은 그대로다(v9.83 산정 근거 유효).
  //   시간표에 없는 반(데모·수기 추가)은 실인원 폴백 — 옛 '번호 ≤4면 20명' 추측을 되살리지 않는다.
  const rows = (cs.getLastRow() < 2 ? [] : cs.getRange(2, 1, cs.getLastRow() - 1, 2).getValues()) // [v8.2] 콜드 가드
    .filter(r => r[0])
    .map(r => {
      const s0 = String(r[0]);
      const eS = schedOf(smR, s0); // 정원·요일유형을 같은 시간표 항목에서 한 번에 읽는다
      let cap = eS ? eS.cap : (Number(r[1]) || 1);
      // [v9.83·리뷰 H1] HP를 정원으로만 잡으면 **덜 찬 반은 구조적으로 격파 불가**다(정원 20 자리에 9명이면
      //   20명분 데미지를 9명이 내야 한다). 개원 초가 정확히 그 상태이고, 사기가 가장 중요한 시기다.
      //   실인원(class_stats 학생수)이 정원보다 적으면 그쪽으로 낮춘다 — 보스가 파티 규모를 따라간다.
      //   "매주 같은 HP = 외울 수 있는 보스"는 유지된다(로스터가 바뀔 때만 움직인다).
      const live = Number(r[1]) || 0;
      if (live > 0 && live < cap) cap = live;
      const per = (eS && eS.type === '주말') ? RAID_HP_PER.주말 : RAID_HP_PER.평일;
      return [weekKey, r[0], cap * per, 0, '진행중', ''];
    });
  if (rows.length) rd.getRange(rd.getLastRow() + 1, 1, rows.length, 6).setValues(rows);

  /* [08-27 유호 지시 A] 🚫 반 대항 리그를 통째로 걷었다 — 「랭킹 시스템은 전부 삭제해줘」.
   *   여기 있던 것 = 인원 비슷한 반끼리 자동 짝짓기(league_pairs 제안 행 생성).
   * 🔑 레이드는 그대로다. 리그와 레이드는 «같이 하는 재미»를 주는 방식이 반대다 —
   *   리그는 옆 반을 이겨서, 레이드는 옆 반과 «같이» 아직 이름 없는 것에 닿아서.
   *   그래서 리그를 걷어도 소속감·주간 리듬은 하나도 안 잃는다(레이드가 이미 주간이다).
   * 근거: 철학 정본 §48 「등수·평균을 어느 화면에도 두지 않는다」 · §177 학부모께
   *   「반 평균도 아이 화면에 두지 않았습니다」 — 그런데 리그 승패 판정이 «반 평균»이었다. */
  Logger.log('레이드 생성: ' + rows.length + '개 반');
}

/* [v9.25] 연료 주간집계 헬퍼 — class_fuel을 (반|미션) 주 1회 dedup 합산 (calcAll·raidFriday·raidStoryDaily 3곳 공통).
   fuelMap: 미션명→P (호출부에서 contents로 구성) · monday: 이번주 월요 0시 경계
   todayStr(옵션)/tz: 넘기면 오늘 날짜분을 today에 별도 집계(raidStoryDaily용), 없으면 today는 빈 객체.
   반환: { week:{반→주간연료합}, today:{반→오늘연료합} } */
function weeklyFuel_(ss, fuelMap, monday, todayStr, tz) {
  const week = {}, today = {}, seen = new Set(); // [v7.5] 같은 미션은 주 1회만 (중복 행 2배 방지)
  const cf = ss.getSheetByName('class_fuel');
  if (cf && cf.getLastRow() >= 2) {
    cf.getRange(2, 1, cf.getLastRow() - 1, 4).getValues().forEach(r => {
      const cls = r[0], m = String(r[1] || ''), d = r[3];
      if (!cls || !d || !fuelMap[m]) return;
      const dd = asDate_(d);
      if (dd >= monday && !seen.has(cls + '|' + m)) {
        seen.add(cls + '|' + m);
        week[cls] = (week[cls] || 0) + fuelMap[m];
        if (todayStr && Utilities.formatDate(dd, tz, 'yyyy-MM-dd') === todayStr) {
          today[cls] = (today[cls] || 0) + fuelMap[m];
        }
      }
    });
  }
  return { week: week, today: today };
}

function raidFriday() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const weekKey = Utilities.formatDate(monday, tz, 'yyyy-MM-dd');

  const rd = ss.getSheetByName('raid');
  if (!rd || rd.getLastRow() < 2) return;

  const pl = ss.getSheetByName('point_logs');
  const plLast = pl.getLastRow();
  const pf = ss.getSheetByName('profiles');
  const pfData = (!pf || pf.getLastRow() < 2) ? [] : pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues(); // [v8.7]
  const classOf = {}, members = {}, nameOf = {}; // [v7.3] nameOf: 결산 스토리용
  pfData.forEach(r => {
    if (r[0] && r[3] === 'student' && r[4]) {
      classOf[r[0]] = r[4];
      nameOf[r[0]] = r[1] || r[0];
      if (!members[r[4]]) members[r[4]] = [];
      members[r[4]].push(r[0]);
    }
  });
  const smS = scheduleMap(ss); // [v7.3] 금요일 run = 평일반만 · 일요일 run = 주말반만 정산
  const isSunday = (now.getDay() === 0);
  function clsType(c) { const e = schedOf(smS, c); return e ? e.type : '평일'; } // [v8.3]
  const weekPts = {};
  const sidWeek = {}, lastHit = {}; // [v7.3] 결산 스토리 — 개인 주간 데미지 · 마지막 타격 시각
  if (plLast >= 2) {
    pl.getRange(2, 1, plLast - 1, 6).getValues().forEach(r => {
      const sid = r[1], pts = Number(r[2]) || 0, d = r[5];
      const isE = pts > 0 || String(r[3] || '').indexOf('정정') > -1; // [v7.4] 정정은 데미지도 되돌림
      if (!sid || !d || !isE || pts === 0) return;
      const dd = asDate_(d);
      if (dd >= monday && classOf[sid]) {
        weekPts[classOf[sid]] = (weekPts[classOf[sid]] || 0) + pts;
        sidWeek[sid] = (sidWeek[sid] || 0) + pts;
        if (!lastHit[sid] || dd.getTime() > lastHit[sid]) lastHit[sid] = dd.getTime();
      }
    });
  }

  // [v5.7] 레이드 연료 — 강사가 반 단위 1행으로 주입한 수업 미션 보너스를 반 합계에 합산
  const fuelMap = {};
  const ctF = ss.getSheetByName('contents');
  if (ctF && ctF.getLastRow() >= 2) {
    ctF.getRange(2, 1, ctF.getLastRow() - 1, 6).getValues().forEach(r => {
      if (r[1] === 'fuel' && r[2]) fuelMap[String(r[2])] = Number(r[5]) || 0;
    });
  }
  const fuelByCls = weeklyFuel_(ss, fuelMap, monday).week; // [v9.25] 연료 주간집계 헬퍼 통합 · [v7.3] 결산 스토리용 반별 연료합
  Object.keys(fuelByCls).forEach(cls => { weekPts[cls] = (weekPts[cls] || 0) + fuelByCls[cls]; });

  const rdLast = rd.getLastRow();
  const rdData = rd.getRange(2, 1, rdLast - 1, 6).getValues();
  const rewardSids = [];
  const winners = []; // [v5] 자동 공지용 성공 반 목록
  const settled = []; // [v7.3] 결산 스토리 대상
  const winRowIdx = []; // [v9.34] F열 '지급완료' 마킹은 appendPoints 성공 뒤로 — 선마킹 후 크래시 시 보상 영구 미지급 결함 수정
  rdData.forEach((r, i) => {
    if (dstr(r[0], tz) !== weekKey) return;
    const cls = r[1], target = Number(r[2]) || 0;
    if ((clsType(cls) === '주말') !== isSunday) return; // [v7.3] 금=평일 · 일=주말
    const wasPaid = (r[5] === '지급완료');
    const got = weekPts[cls] || 0;
    r[3] = got;
    if (got >= target && target > 0 && !wasPaid) {
      r[4] = '달성 🎉';
      winRowIdx.push(i);
      winners.push(cls + ' (' + got + 'P)'); // [v5]
      (members[cls] || []).forEach(sid => rewardSids.push(sid));
    } else if (!wasPaid) {
      r[4] = got >= target * 0.7 ? '아쉬움' : '미달성';
    }
    if (!wasPaid) settled.push({ cls: cls, target: target, got: got, win: got >= target && target > 0 });
    rdData[i] = r;
  });
  rd.getRange(2, 1, rdData.length, 6).setValues(rdData);

  // [v7.3] 결산 스토리 — 격파 서사 / 도주 서사 / 무공격 서사 (raid_story → Glide 레이드 탭) — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md)
  const rsSh = ensureSheet(ss, 'raid_story', ['date','class_name','유형','제목','스토리']);
  const dupe = new Set();
  if (rsSh.getLastRow() >= 2) {
    rsSh.getRange(2, 1, rsSh.getLastRow() - 1, 3).getValues().forEach(r => {
      if (String(r[2]) === '결산') dupe.add(dstr(r[0], tz) + '|' + r[1]);
    });
  }
  const bossS = bossOfMonth(ss, Number(Utilities.formatDate(now, tz, 'M')));
  const bN = bossS ? bossS.name : '이달의 보스';
  const stOut = [];
  settled.forEach(o => {
    if (dupe.has(weekKey + '|' + o.cls)) return;
    const roster = (members[o.cls] || [])
      .map(sid => ({ n: nameOf[sid] || sid, d: sidWeek[sid] || 0, t: lastHit[sid] || 0 }))
      .filter(x => x.d > 0).sort((a, b) => b.d - a.d);
    const top = roster[0], second = roster[1];
    let last = null;
    roster.forEach(x => { if (!last || x.t > last.t) last = x; });
    const fuel = fuelByCls[o.cls] || 0;
    let title, text;
    if (o.win) {
      title = '⚔️ ' + o.cls + ' — ' + bN + ' 격파!';
      text = '일주일의 총공세, ' + o.got + ' 데미지로 ' + bN + '(HP ' + o.target + ')를 쓰러뜨렸다! ' +
        (top ? '선봉 ' + top.n + josa(top.n, '이', '가') + ' ' + top.d + ' 데미지로 최다 타격' +
          (second ? ', ' + second.n + josa(second.n, '이', '가') + ' ' + second.d + ' 데미지로 뒤를 이었다' : '') + '. ' : '') +
        (fuel ? '🔥 연료 미션 합동 공격 ' + fuel + ' 데미지가 결정적이었다. ' : '') +
        (last ? bN + josa(bN, '이', '가') + ' 비틀거리며 도망치려는 순간 — ' + last.n + '의 마지막 일격이 작렬! ' : '') +
        '반 전원 +' + PT.레이드 + 'P 🏆';
    } else if (o.got > 0) {
      title = '🌫️ ' + o.cls + ' — ' + bN + ' 도주…';
      text = o.got + ' 데미지를 입혔지만, ' + bN + '(HP ' + o.target + ')' + josa('P', '은', '는') + ' ' + Math.max(o.target - o.got, 0) +
        '의 체력을 남기고 어둠 속으로 도망쳤다. ' +
        (top ? '가장 용감했던 전사는 ' + top.n + '(' + top.d + ' 데미지)! ' : '') +
        '다음 주 월요일, 복수전이 시작된다 🔥';
    } else {
      title = '😴 ' + o.cls + ' — ' + bN + '의 코웃음';
      text = '이번 주 아무도 ' + bN + josa(bN, '을', '를') + ' 공격하지 않았다. ' + bN + josa(bN, '은', '는') + ' 하품을 하며 유유히 사라졌다… ' +
        '다음 주, 반격 개시! (숙제·칭찬·MVP 하나하나가 전부 데미지가 된다 ⚡)';
    }
    stOut.push([weekKey, o.cls, '결산', title, text]);
  });
  if (stOut.length) rsSh.getRange(rsSh.getLastRow() + 1, 1, stOut.length, 5).setValues(stOut);

  if (rewardSids.length) {
    // [v9.34] 지급 멱등 가드 — 이전 실행이 지급 후 마킹 전에 죽었어도 이번 주 '레이드보상' 기지급자는 재지급하지 않음(expandHwBatch 재조회 패턴)
    const paidSet = {};
    if (pl.getLastRow() >= 2) {
      pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues().forEach(r => {
        if (String(r[3]) === '레이드보상' && r[1] && r[5] && asDate_(r[5]) >= monday) paidSet[String(r[1])] = 1;
      });
    }
    const toPay = rewardSids.filter(sid => !paidSet[String(sid)]);
    if (toPay.length) appendPoints(ss, toPay.map(sid => [sid, PT.레이드, '레이드보상', '시스템'])); // [v7.1] 50→20 · [v9.83] 20→10
    winRowIdx.forEach(i => rd.getRange(i + 2, 6).setValue('지급완료')); // [v9.34] 지급 성공 뒤에만 마킹 — 실패 시 다음 실행이 재시도(중복은 위 가드가 차단)
    // [v5] 레이드 성공 자동 공지 → 앱 공지 탭에 노출 ([v9.22] bossS 재사용 — bossOfMonth 중복 호출 제거)
    addNotice(ss,
      '🎉 이번 주 레이드 성공' + (bossS ? ' — ' + bossS.name + ' 격파!' : '!'),
      winners.join(' · ') + ' — 목표 달성! 반 전원 보상 지급 완료 🏆' +
      (bossS ? '\n"' + bossS.win + '"' : ''));
    calcAll();
  }
  Logger.log('레이드 정산: 보상 ' + rewardSids.length + '명 / 결산 스토리 ' + stOut.length + '건');
}

/* ===================== [v8.1] 오늘의 출결 보드 ===================== */
// 원장 탭 한눈 뷰 — parentSweep(10분)마다 재구성. 강사 = 출근·퇴근을 한 줄에(HH:mm),
// 학생 = 반별 등원 시각, 오늘 수업 반의 미등원자는 '—'(빈자리가 보여야 한눈). GPS 기록 자체는 분 단위 원본 유지.
function todayBoard_(ss) {
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const bd = ensureSheet(ss, 'today_board', ['유형','이름','반','시각','퇴근']);
  const hhmm = function (d) { return Utilities.formatDate(asDate_(d), tz, 'HH:mm'); };
  const isToday = function (d) {
    const dd = asDate_(d);
    return Utilities.formatDate(dd, tz, 'yyyy-MM-dd') === today;
  };

  const tin = {}, tout = {};
  const tc = ss.getSheetByName('teacher_checkins');
  if (tc && tc.getLastRow() >= 2) {
    tc.getRange(2, 1, tc.getLastRow() - 1, 3).getValues().forEach(r => {
      const nm = String(r[TC_NAME_COL - 1] || '').trim(), tp = String(r[TC_TYPE_COL - 1] || ''), d = r[TC_TIME_COL - 1];
      if (!nm || !d || !isToday(d)) return;
      const t = (d instanceof Date) ? d.getTime() : new Date(d).getTime();
      if (tp.indexOf('출근') > -1) { if (!tin[nm] || t < tin[nm]) tin[nm] = t; }
      else if (tp.indexOf('퇴근') > -1) { if (!tout[nm] || t > tout[nm]) tout[nm] = t; }
    });
  }
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return;
  const pfData = pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues();
  const rows = [];
  pfData.forEach(r => {
    if (r[0] && r[3] === 'teacher') {
      const nm = String(r[1] || r[0]).trim();
      if (tin[nm] || tout[nm]) {
        rows.push(['👩‍🏫 강사', nm, String(r[4] || ''),
          tin[nm] ? hhmm(new Date(tin[nm])) : '—', tout[nm] ? hhmm(new Date(tout[nm])) : '—']);
      }
    }
  });
  const arr = {};
  const weekCls = {}; // [2026-09-02 걸음1] 이번 주 «출석 사건이 있었던» 반(class_snapshot) — 순간 0건 경보의 분모(수업이 없었던 반·개원 전엔 울지 않는다)
  const mondayMo = (function () { const m = new Date(now); m.setDate(now.getDate() - ((now.getDay() + 6) % 7)); return Utilities.formatDate(m, tz, 'yyyy-MM-dd'); })();
  const at = ss.getSheetByName('attendance');
  if (at && at.getLastRow() >= 2) {
    at.getRange(2, 1, at.getLastRow() - 1, ATTENDANCE_HEADERS.length).getValues().forEach(r => { // 5열 = class_snapshot(같은 읽기에 실어 10분 스위프 읽기 수 무증)
      const sid = r[1], d = r[2];
      if (!sid || !d) return;
      const cls5 = String(r[4] || '').trim();
      if (cls5 && Utilities.formatDate(asDate_(d), tz, 'yyyy-MM-dd') >= mondayMo) weekCls[cls5] = 1;
      if (!isToday(d) || String(r[3]).indexOf('출석') === -1) return;
      const t = (d instanceof Date) ? d.getTime() : new Date(d).getTime();
      if (!arr[sid] || t < arr[sid]) arr[sid] = t;
    });
  }
  const schMap = scheduleMap(ss); // [v9.22] 루프 밖 1회 — hasClassToday의 학생별 schedule 재읽기 제거
  const stuRows = [];
  pfData.forEach(r => {
    if (!(r[0] && r[3] === 'student' && r[4])) return;
    const came = arr[r[0]];
    if (came) stuRows.push(['🧑‍🎓 학생', r[1] || r[0], String(r[4]), hhmm(new Date(came)), '']);
    else if (hasClassToday(ss, String(r[4]), schMap)) stuRows.push(['🧑‍🎓 학생', r[1] || r[0], String(r[4]), '—', '']);
  });
  stuRows.sort((a, b) => a[2] === b[2] ? String(a[3]).localeCompare(String(b[3])) : String(a[2]).localeCompare(String(b[2])));
  /* [v9.126] 빈 상태 안내 — 08-02 라이브 실측: 일요일(무수업)에 출결 탭이 **완전한 백지**로 뜬다.
   *   데이터상으로는 정상이지만 강사·원장 화면에서는 「오늘 수업이 없음」과 「앱이 고장남」이 구별되지 않는다
   *   (성장 리포트 탭은 '첫 리포트는 다음 달 1일에 도착해요'라고 말해 주는데 여기만 침묵했다).
   *   Glide 컬렉션은 행이 0이면 아무것도 안 그리므로, 안내를 **행 하나로** 만들어 준다. — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md) */
  if (!rows.length && !stuRows.length) {
    const dow = now.getDay();
    stuRows.push(dow === 0
      ? ['ℹ️ 안내', '오늘은 일요일 — 수업이 없는 날이에요', '', '—', '']
      : ['ℹ️ 안내', '아직 등원·출근 기록이 없어요 (10분마다 자동 갱신)', '', '—', '']);
  }
  /* [2026-09-02 · 가져가는것 걸음1] 📷 원장 오늘판에 얹는 두 줄(설계 §3-b 실패 경로 · 새 화면 0 · 새 판단 0):
   *   「어제 미분류 목록」(폴더 이름을 고치면 다음 밤에 담긴다) + 「이번 주 순간 0건 반」. 실패는 격리한다 — 순간 줄이 출결 보드를 깨면 안 된다. */
  let momentRows = [];
  try { momentRows = momentBoardRows_(ss, tz, schMap, now, weekCls); } catch (eMo) { Logger.log('순간 원장줄 실패(출결 보드는 그대로): ' + eMo); }
  const all = rows.concat(stuRows).concat(momentRows);
  const last = bd.getLastRow();
  if (last - 1 > all.length) bd.getRange(all.length + 2, 1, Math.max(last - 1 - all.length, 1), 5).clearContent();
  if (all.length) writeIfChanged(bd, 2, 1, all);
  updateTeacherInOut_(ss, tz, pf); // [v9.74] 강사 행 오늘출근·오늘퇴근(DD·DE) 10분 갱신 — 출퇴근 버튼 가시성 소스
  updateParentAbsence_(ss, tz, pf); // [v9.82] 학부모 결석신고 카드(DQ121) — 제출 후 10분 내 ✅ 접수 표시

  // [v9.56] 📺 교실 스크린 모드 — 반 TV/프로젝터용 한 장(app_state '교실스크린HTML').
  //   10분 스위프 편승·읽기 3(raid·league_pairs·app_state)·쓰기는 setAppState_(동일값 무기록).
  //   분 단위 시계는 넣지 않는다(넣으면 매 스위프가 강제 변경 → 야간·주말에도 sync를 깨움).
  //   조립 = screen 계정 1개 + Rich Text 탭 1개(docs/조립후_트렌드_증분_v956.md).
  try {
    const stScr = ss.getSheetByName('app_state');
    if (stScr) {
      const dowNm = ['일', '월', '화', '수', '목', '금', '토'][now.getDay()];
      const nowMin2 = Number(Utilities.formatDate(now, tz, 'H')) * 60 + Number(Utilities.formatDate(now, tz, 'm'));
      const typeToday = now.getDay() === 0 ? null : (now.getDay() === 6 ? '주말' : '평일'); // 일요일=무수업(v9.46)
      let nextTxt = '오늘은 수업 없는 날';
      if (typeToday) {
        let best = null;
        Object.keys(schMap).forEach(cn6 => {
          const e6 = schMap[cn6];
          if (e6.name !== cn6 || e6.type !== typeToday || !e6.time) return;
          const p6 = String(e6.time).split(':'); const stMin = Number(p6[0]) * 60 + Number(p6[1] || 0);
          if (stMin + 90 < nowMin2) return; // 끝난 수업 제외(90분 수업 기준)
          if (!best || stMin < best.min) best = { cn: cn6, min: stMin, hm: e6.time };
        });
        nextTxt = best ? ((best.min <= nowMin2 ? '지금 수업 중 · ' : '다음 수업 · ') + best.cn + ' ' + best.hm) : '오늘 수업 종료 — 내일 만나!';
      }
      let stageTxt = '';
      try { stageTxt = String((getState(stScr, '이달의시즌') || {}).val || ''); } catch (eSt) {}
      let raidB = '';
      const rdScr = ss.getSheetByName('raid');
      if (rdScr && rdScr.getLastRow() >= 2) {
        const byCls = {};
        rdScr.getRange(2, 1, rdScr.getLastRow() - 1, 5).getValues().forEach(rr => {
          const wk6 = rr[0] ? dstr(rr[0], tz) : '', cn6 = String(rr[1] || ''); if (!cn6) return;
          if (!byCls[cn6] || wk6 > byCls[cn6].w) byCls[cn6] = { w: wk6, goal: Number(rr[2]) || 0, dmg: Number(rr[3]) || 0, stt: String(rr[4] || '') };
        });
        const items = Object.keys(byCls).sort().slice(0, 4).map(cn6 => {
          const b6 = byCls[cn6]; const pct = b6.goal > 0 ? Math.min(Math.round(b6.dmg / b6.goal * 100), 100) : 0;
          return '<div style="padding:5px 0;"><div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;"><span>' + cn6 + '</span><span>' + b6.dmg + '/' + b6.goal + (b6.stt.indexOf('격파') > -1 ? ' 🏆' : '') + '</span></div><div style="height:10px;border-radius:5px;background:rgba(255,255,255,.18);"><div style="width:' + pct + '%;height:10px;border-radius:5px;background:linear-gradient(90deg,#FFD447,#F96859);"></div></div></div>';
        });
        if (items.length) raidB = '<div style="font-size:13px;opacity:.8;padding:12px 0 2px;">⚔️ 이번 주 보스 레이드</div>' + items.join('');
      }
      /* [08-27 유호 지시 A] 교실 스크린의 「🏆 이번 주 리그」 대진표를 걷었다 — 리그 폐지 동행.
       *   raid 블록(위)은 그대로 — 레이드는 옆 반과 «겨루는» 게 아니라 «같이» 하는 것이다. */
      const scrHtml = CARD_WEBFONT + '<div style="' + CARD_FONT + 'background:linear-gradient(150deg,#08090C,#262626 60%,#373737);border-radius:20px;padding:22px 24px;color:#fff;">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;"><div style="font-size:22px;font-weight:800;">📺 SYNK LIVE</div><div style="font-size:15px;opacity:.85;">' + (now.getMonth() + 1) + '월 ' + now.getDate() + '일 (' + dowNm + ')</div></div>' +
        (stageTxt ? '<div style="font-size:14px;opacity:.9;padding-top:4px;">🎪 ' + stageTxt + '</div>' : '') +
        '<div style="background:rgba(255,255,255,.12);border-radius:14px;padding:10px 14px;margin-top:12px;font-size:17px;font-weight:700;">🕐 ' + nextTxt + ' · 오늘 등원 ' + Object.keys(arr).length + '명</div>' +
        raidB +
        // [v9.200] 교실 스크린 = 대외 집행면 — 구 슬로건 은퇴(철학_리라이팅_장부 §1). 「17」은 부연 없이 내보내지 않는다(문서_지도 §113 조건).
        '<div style="font-size:12px;opacity:.6;padding-top:12px;">SYNK LAB · 정원은 16명, 선생님은 17명입니다</div>' +
        '<div style="font-size:11px;opacity:.45;padding-top:2px;">한 명 한 명에게 나만의 선생님, 교실엔 진짜 선생님</div></div>';
      setAppState_(ss, '교실스크린HTML', scrHtml);
    }
  } catch (eScr) { Logger.log('교실스크린 생략: ' + eScr.message); } // 스크린 실패가 출결 보드를 깨지 않게
}

/* ===================== [v8.0] 숙제 일괄 전개 ===================== */
// 강사: 완료 학생 멀티 선택 → 저장 1탭 = 수업당 1업데이트 (개별 버튼: 학생당 1업데이트).
// 밤 22시 스크립트가 학생별 +10으로 전개 — 시트→앱 sync는 묶음당 1업데이트라 ~85% 절감.
// 개별 버튼과 병행 가능: 같은 날 이미 지급된 학생은 자동 스킵. 행 재실행은 '전개완료' 마킹으로 멱등.
function expandHwBatch() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const hb = ensureSheet(ss, 'hw_batch', ['date','class_name','완료자목록','입력자','created_at','처리상태']);
  if (hb.getLastRow() < 2) return;
  const rows = hb.getRange(2, 1, hb.getLastRow() - 1, 6).getValues();

  const doneToday = new Set(); // 오늘 이미 지급된 학생 (개별 버튼 병행 대비)
  const pl = ss.getSheetByName('point_logs');
  if (pl && pl.getLastRow() >= 2) {
    pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues().forEach(r => {
      const d = r[5];
      if (!r[1] || !d) return;
      const dd = asDate_(d);
      if (Utilities.formatDate(dd, tz, 'yyyy-MM-dd') === today &&
          String(r[3] || '').indexOf('숙제완료') > -1 && Number(r[2]) > 0) doneToday.add(String(r[1]).trim());
    });
  }
  const valid = new Set();
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) {
    pf.getRange(2, 1, pf.getLastRow() - 1, 4).getValues().forEach(r => {
      if (r[0] && r[3] === 'student') valid.add(String(r[0]).trim());
    });
  }
  const outRows = [];
  const doneIdx = []; // [v9.31] 전개 대상 행 인덱스 — 지급 성공 뒤에 일괄 마킹
  let skip = 0;
  rows.forEach((r, i) => {
    const d = r[0];
    if (!d || String(r[5]) === '전개완료') return;
    const dd = asDate_(d);
    if (Utilities.formatDate(dd, tz, 'yyyy-MM-dd') !== today) return; // 당일 행만 전개
    const by = String(r[3] || '강사');
    const seen = new Set();
    String(r[2] || '').split(',').forEach(tok => {
      const sid = String(tok).trim();
      if (!sid || seen.has(sid) || !valid.has(sid)) return;
      seen.add(sid);
      if (doneToday.has(sid)) { skip++; return; }
      doneToday.add(sid);
      outRows.push([sid, PT.숙제, '숙제완료', by]);
    });
    doneIdx.push(i); // 마킹은 아직 하지 않는다 (지급 성공 후로 미룸)
  });
  // [v9.31] 지급 → 성공 후 마킹 순서. 지급 전 크래시면 미마킹으로 재시도되고,
  //         doneToday(point_logs 재조회)가 이미 지급된 학생을 걸러 중복 지급을 막는다.
  if (outRows.length) appendPoints(ss, outRows);
  doneIdx.forEach(i => hb.getRange(i + 2, 6).setValue('전개완료'));
  Logger.log('숙제 일괄 전개: +' + outRows.length + '명 / 중복 스킵 ' + skip);
}

/* ===================== [v9.36] 학습추적(W3) — weekly_topics 제자리 승격 · mastery · 출석 일괄 ===================== */

// weekly_topics 5열 → 12열 멱등 확장(ensureSheet는 기존 시트 헤더를 보정하지 않음 — c02 지도 한계 보완).
// A~E 기존 5열 위치 불변. F문법태그(ID 쉼표) G전체도달도('도달'/'더연습') H예외학생 I숙제완료자 J연료미션 K처리상태 L학습전개상태.
function ensureLessonCols_(tp) {
  if (tp.getMaxColumns() < 12) tp.insertColumnsAfter(tp.getMaxColumns(), 12 - tp.getMaxColumns());
  ['문법태그', '전체도달도', '예외학생', '숙제완료자', '연료미션', '처리상태', '학습전개상태'].forEach((h, i) => {
    if (String(tp.getRange(1, 6 + i).getValue()) !== h) tp.getRange(1, 6 + i).setValue(h);
  });
}

// [v9.36] 수업 로그 전개 — 승격된 weekly_topics의 I(숙제완료자)→학생별 +10 '숙제완료' 지급, J(연료미션)→class_fuel append.
//   expandHwBatch의 멱등 패턴 그대로: ID 검증 · 당일 기지급 재조회(doneToday) 스킵 · 지급 성공 후 K열 마킹(v9.31 규율).
//   nightJobs에서 calcAll보다 앞 — 지급분이 그날 밤 게이지·랭킹에 즉시 반영된다. 기존 hw_batch·expandHwBatch와 병존(하위호환).
function expandLessonLog_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const tp = ss.getSheetByName('weekly_topics');
  if (!tp) return;
  ensureLessonCols_(tp); // [v9.38] 열 보장을 행수 가드보다 앞으로 — 빈 시트에도 F~L 승격돼 마감폼 바인딩이 선행 가능
  if (tp.getLastRow() < 2) return;
  const rows = tp.getRange(2, 1, tp.getLastRow() - 1, 12).getValues();

  const doneToday = new Set(); // 오늘 이미 숙제 지급된 학생 (hw_batch·개별 버튼 병행 대비 — point_logs 재조회)
  const pl = ss.getSheetByName('point_logs');
  if (pl && pl.getLastRow() >= 2) {
    pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues().forEach(r => {
      const d = r[5];
      if (!r[1] || !d) return;
      if (Utilities.formatDate(asDate_(d), tz, 'yyyy-MM-dd') === today &&
          String(r[3] || '').indexOf('숙제완료') > -1 && Number(r[2]) > 0) doneToday.add(String(r[1]).trim());
    });
  }
  const valid = new Set();
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) {
    pf.getRange(2, 1, pf.getLastRow() - 1, 4).getValues().forEach(r => {
      if (r[0] && r[3] === 'student') valid.add(String(r[0]).trim());
    });
  }
  const outRows = [], fuelRows = [], doneIdx = [];
  let skip = 0;
  rows.forEach((r, i) => {
    if (String(r[10]) === '전개완료') return;                 // K 처리상태
    if (!r[3] || dstr(r[3], tz) !== today) return;            // 당일 행만 (hw_batch와 동일)
    const hwList = String(r[8] || '').trim();                 // I 숙제완료자
    const fuel = String(r[9] || '').trim();                   // J 연료미션
    if (!hwList && !fuel) return;                             // 전개할 것 없음 — 태그만 있는 행은 expandMasteryLog_가 담당
    const by = String(r[2] || '강사');
    const seen = new Set();
    hwList.split(',').forEach(tok => {
      const sid = String(tok).trim();
      if (!sid || seen.has(sid) || !valid.has(sid)) return;
      seen.add(sid);
      if (doneToday.has(sid)) { skip++; return; }
      doneToday.add(sid);
      outRows.push([sid, PT.숙제, '숙제완료', by]);
    });
    if (fuel && r[0]) fuelRows.push([r[0], fuel, by, now]);   // 주 1회 dedup은 기존 weeklyFuel_(seen cls|mission)이 처리
    doneIdx.push(i); // 마킹은 지급 성공 뒤로 미룸
  });
  if (outRows.length) appendPoints(ss, outRows);
  if (fuelRows.length) {
    const cf = ensureSheet(ss, 'class_fuel', ['class_name', '미션', '입력자', 'created_at']);
    cf.getRange(cf.getLastRow() + 1, 1, fuelRows.length, 4).setValues(fuelRows);
  }
  doneIdx.forEach(i => tp.getRange(i + 2, 11).setValue('전개완료'));
  Logger.log('수업 로그 전개: 숙제 +' + outRows.length + '명 (중복 스킵 ' + skip + ') · 연료 ' + fuelRows.length + '건');
}

// [v9.36 → 함께한날 막2] 문법 «연습» 전개 — 당일 문법태그 행 × 출석자 → mastery_log upsert('연습'까지만).
//   구 동작(G열 '도달'이면 출석 전원에게 '도달')은 「앉아만 있던 학생도 최대 12개를 받는」 병이었다
//   (설계 §4-3 · 막0 실측: lesson발 '도달' 61행 vs AI발 0행). 처방 ① = 수업 경로는 '연습'으로 낮춘다.
//   승격(도달)은 masteryApply_(교재연동 · 「서로 다른 날 2회 올바름」 · 출처 AI첨삭/AI음성/AI대화) 한 문뿐이다.
//   G열(전체도달도)·H열(예외학생)은 수업 «보고»로 시트에 그대로 남는다 — mastery 상태에만 안 얹는다.
//   결석자는 미전개(다음 태깅 때 자연 커버). 처리 후 L열 마킹. nightJobs에서 expandLessonLog_ 다음 · calcAll 앞.
function expandMasteryLog_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const tp = ss.getSheetByName('weekly_topics');
  if (!tp) return;
  ensureLessonCols_(tp); // [v9.38] 열 보장을 행수 가드보다 앞으로 — 빈 시트에도 F~L 승격돼 마감폼 바인딩이 선행 가능
  if (tp.getLastRow() < 2) return;
  const rows = tp.getRange(2, 1, tp.getLastRow() - 1, 12).getValues();
  // 미처리(L열)·당일·태그 있는 행만 — 없으면 시트 읽기 없이 종료(6분 예산 보호)
  const targets = [];
  rows.forEach((r, i) => {
    if (String(r[11]) === '전개완료') return;                 // L 학습전개상태
    if (!r[3] || dstr(r[3], tz) !== today) return;
    if (!String(r[5] || '').trim()) return;                   // F 문법태그 없음 → 기존 행과 100% 동일 동작(하위호환)
    targets.push({ r: r, i: i });
  });
  if (!targets.length) return;

  const attendedToday = new Set();
  const at = ss.getSheetByName('attendance');
  if (at && at.getLastRow() >= 2) {
    at.getRange(2, 1, at.getLastRow() - 1, 4).getValues().forEach(r => {
      if (r[1] && r[2] && dstr(r[2], tz) === today) attendedToday.add(String(r[1]).trim());
    });
  }
  const roster = {}; // 반 → 학생 sid 목록
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) {
    pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
      if (r[0] && r[3] === 'student' && r[4]) (roster[String(r[4])] = roster[String(r[4])] || []).push(String(r[0]).trim());
    });
  }
  const ml = ensureSheet(ss, 'mastery_log', MASTERY_LOG_HEADERS); // [v9.240] 헤더 정본 공유(엔진_셋업확장)
  const mkey = {}; // 'sid|gid' → {row(시트 행번호), st}
  if (ml.getLastRow() >= 2) {
    ml.getRange(2, 1, ml.getLastRow() - 1, 3).getValues().forEach((r, i) => {
      if (r[0] && r[1]) mkey[String(r[0]).trim() + '|' + String(r[1]).trim()] = { row: i + 2, st: String(r[2] || '') };
    });
  }
  const newRows = [], doneIdx = [];
  targets.forEach(t => {
    const r = t.r;
    const tags = String(r[5]).split(',').map(s => s.trim()).filter(g => grammarStageOf_(g) > 0); // ID(G3xx) 검증 — 문자열 연성 결합 회피
    if (!tags.length) { doneIdx.push(t.i); return; }
    // [함께한날 막2] 수업 경로는 '연습'까지만 — G열 '도달'·H열 예외 명단이 상태를 못 바꾼다(위 머리말).
    //   '도달' 기존 행 불변(강등 없음)·'연습' 기존 행도 그대로 — 이 경로가 만드는 것은 «새 연습 행»뿐이다.
    (roster[String(r[0])] || []).forEach(sid => {
      if (!attendedToday.has(sid)) return;
      tags.forEach(gid => {
        const k = sid + '|' + gid;
        if (mkey[k]) return; // 이미 기록 있음(연습이든 도달이든) — 수업 경로는 안 만진다
        mkey[k] = { row: 0, st: '연습' }; // 같은 실행 내 중복 태그 방지
        newRows.push([sid, gid, '연습', today, '', 'lesson', now]);
      });
    });
    doneIdx.push(t.i);
  });
  if (newRows.length) ml.getRange(ml.getLastRow() + 1, 1, newRows.length, 7).setValues(newRows);
  // [함께한날 막2] 구 상향(upgrades — '연습'→'도달') 적용부는 걷었다 — 수업 경로에 '도달' 쓰기 통로를 남기면
  //   「막는 척만 하는」 강등이 된다(문이 둘인데 하나만 잠근 꼴). 승격 통로는 masteryApply_ 하나다.
  doneIdx.forEach(i => tp.getRange(i + 2, 12).setValue('전개완료')); // 전개(쓰기) 성공 후 마킹
  Logger.log('문법 연습 전개: 신규 ' + newRows.length + ' · 행 ' + doneIdx.length);
}

// [v9.36] 수업 시작 출석 1탭(B안) 착지 — attendance_batch 미처리 행의 출석자를 attendance로 전개(parentSweep 편승, 10분).
//   기존 attendance 스키마(id·student_id·timestamp·method) 준수 · 같은 학생·같은 날 중복 방지 · 전개 성공 후 마킹.
function expandAttendanceBatch_(ss) {
  const ab = ss.getSheetByName('attendance_batch');
  if (!ab || ab.getLastRow() < 2) return;
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const rows = ab.getRange(2, 1, ab.getLastRow() - 1, 6).getValues();
  const pending = [];
  rows.forEach((r, i) => {
    if (!r[0] || String(r[5]) === '전개완료') return;
    if (dstr(r[0], tz) !== today) return; // 당일 행만 (과거 미처리 행은 재전개하지 않음 — 옛 출석 소급 오염 방지)
    pending.push({ r: r, i: i });
  });
  if (!pending.length) return; // 미처리 없으면 attendance·profiles 스캔 없이 종료 (10분 스위프 부담 0)

  const at = ensureSheet(ss, 'attendance', ATTENDANCE_HEADERS);
  헤더보정_(at, ATTENDANCE_HEADERS); // [2026-09-02 걸음1] 구 4열 라이브 시트에 class_snapshot 을 끝에 — ensureSheet 는 있는 시트를 안 늘린다
  const seenToday = new Set(); // 오늘 이미 출석 기록된 학생 (개별 체크 병행 대비)
  if (at.getLastRow() >= 2) {
    at.getRange(2, 1, at.getLastRow() - 1, 3).getValues().forEach(r => {
      if (r[1] && r[2] && dstr(r[2], tz) === today) seenToday.add(String(r[1]).trim());
    });
  }
  const valid = new Set();
  const clsOf = {}; // [2026-09-02 걸음1] sid → profiles.class_name «지금 값» — 배치 행에 반이 비었을 때의 폴백(쓰는 시점에 얼려 넣는다)
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) {
    pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
      if (r[0] && r[3] === 'student') { valid.add(String(r[0]).trim()); clsOf[String(r[0]).trim()] = String(r[4] || '').trim(); }
    });
  }
  const ymd = Utilities.formatDate(now, tz, 'yyyyMMdd');
  const newRows = [], doneIdx = [];
  pending.forEach(p => {
    /* [2026-09-02 · 가져가는것 걸음1] class_snapshot = 이 출석 «사건»의 반. 일괄 출석은 강사가 «그 수업»에서 찍으므로 배치 행의
     *   class_name(p.r[1])이 가장 정확한 스냅샷이다 — 비어 있으면 그 학생의 지금 반(profiles)으로. 둘 다 없으면 빈칸(지어 넣지 않는다). */
    const clsBatch = String(p.r[1] || '').trim();
    String(p.r[2] || '').split(',').forEach(tok => {
      const sid = String(tok).trim();
      if (!sid || !valid.has(sid) || seenToday.has(sid)) return;
      seenToday.add(sid);
      newRows.push(['ATB' + ymd + '-' + sid, sid, now, '출석(일괄)', clsBatch || clsOf[sid] || '']); // method에 '출석' 포함 — 다이제스트 집계 호환
    });
    doneIdx.push(p.i);
  });
  if (newRows.length) at.getRange(at.getLastRow() + 1, 1, newRows.length, ATTENDANCE_HEADERS.length).setValues(newRows);
  doneIdx.forEach(i => ab.getRange(i + 2, 6).setValue('전개완료')); // 전개 성공 후 마킹
  Logger.log('출석 일괄 전개: +' + newRows.length + '명 / 행 ' + doneIdx.length);
}

/* ===================== [v7.9] 학부모 주간 다이제스트 ===================== */
// 일요일 22시 — 등원·포인트·도전·성장·레이드·배운 것을 학부모에게 한 통으로 (등원 즉시 메일 대체)
function parentWeeklyDigest() { parentWeeklyDigestCore_(''); } // 일요일 밤 본발송

// [v9.34] 다이제스트 보류 재시도 — 일요일 발송이 쿼터로 끊기면 app_state '다이제스트보류'(weekKey|발송완료 sid,…)가 남고,
//   morningJobs가 매일 이 함수를 호출해 해당 주(monday 창) 미발송분만 재집계·재발송한다. 완료 또는 주 월요일+13일 경과 시 키 삭제.
//   ('마킹 보류'만으로는 같은 weekKey 안에 다음 실행이 없어 no-op — 재시도 경로 자체가 정답. digest #31 교정)
function parentWeeklyDigestRetry_() {
  const ssR = SpreadsheetApp.getActiveSpreadsheet();
  const stR = ssR.getSheetByName('app_state');
  if (!stR) return;
  const raw = String(getState(stR, '다이제스트보류').val || '');
  if (!raw) return;
  if ((Date.now() - new Date(raw.split('|')[0]).getTime()) / 86400000 > 13) { setState(stR, '다이제스트보류', ''); return; } // 다음 주 소식이 이미 도래 — 옛 소식 폐기
  parentWeeklyDigestCore_(raw);
}

function parentWeeklyDigestCore_(holdRaw) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const retry = !!holdRaw;
  const sentSet = {}; // [v9.34] 재시도 모드: 기발송 sid — 중복 발송 금지
  let monday;
  if (retry) {
    monday = new Date(holdRaw.split('|')[0]);
    String(holdRaw.split('|')[1] || '').split(',').forEach(x => { if (x) sentSet[x] = 1; });
  } else {
    monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  }
  monday.setHours(0, 0, 0, 0);
  const weekEnd = new Date(monday.getTime() + 7 * 86400000); // [v9.34] 주 창 상한 — 재시도가 다음 주 기록을 지난주 소식에 섞지 않게
  const weekKey = Utilities.formatDate(monday, tz, 'yyyy-MM-dd');
  const st = ss.getSheetByName('app_state');
  if (!retry && st && String(getState(st, '학부모다이제스트주').val) === weekKey) return; // 재실행 방지

  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return;
  const kids = [];
  pf.getRange(2, 1, pf.getLastRow() - 1, 26).getValues().forEach(r => {
    if (r[0] && r[3] === 'student' && String(r[25] || '').indexOf('@') > -1)
      kids.push({ sid: r[0], n: r[1] || r[0], cls: r[4] || '', m: String(r[25]) });
  });
  if (!kids.length) return;

  const attW = {};
  const at = ss.getSheetByName('attendance');
  if (at && at.getLastRow() >= 2) {
    at.getRange(2, 1, at.getLastRow() - 1, 4).getValues().forEach(r => {
      const d = r[2];
      if (!r[1] || !d) return;
      const dd = asDate_(d);
      if (dd >= monday && dd < weekEnd && String(r[3]).indexOf('출석') > -1) attW[r[1]] = (attW[r[1]] || 0) + 1; // [v9.34] 주 창 상한
    });
  }
  const ptsW = {}, mvpW = {}, synW = {};
  const tagW = {}; // [v9.0] 칭찬 태그 — pl 루프보다 앞에 선언
  const pl = ss.getSheetByName('point_logs');
  if (pl && pl.getLastRow() >= 2) {
    pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues().forEach(r => { // [v9.51] 6열이면 충분 — 구 8열(H 태그) 읽기는 폐기(라이브 H열=🔒 Row ID라, 도전·성장 행의 Row ID 문자열이 '크루의 눈'에 태그로 새던 결함 차단)
      const sid = r[1], pts = Number(r[2]) || 0, rs = String(r[3] || ''), d = r[5];
      if (!sid || !d) return;
      const dd = asDate_(d);
      if (dd < monday || dd >= weekEnd) return; // [v9.34] 주 창 상한
      const isE = pts > 0 || rs.indexOf('정정') > -1;
      if (isE && pts !== 0) ptsW[sid] = (ptsW[sid] || 0) + pts;
      if (rs.indexOf('MVP') > -1 || rs.indexOf('도전') > -1) mvpW[sid] = (mvpW[sid] || 0) + (pts > 0 ? 1 : (rs.indexOf('정정') > -1 ? -1 : 0)); // [v9.0] 건수 — 금액 독립
      else if (rs.indexOf('시냅스') > -1 || rs.indexOf('성장') > -1) synW[sid] = (synW[sid] || 0) + (pts > 0 ? 1 : (rs.indexOf('정정') > -1 ? -1 : 0));
      if (pts > 0 && rs.indexOf('칭찬·') === 0) { // [v9.51·B4] 💝 태그=사유 접미 — Glide 버튼은 reason='칭찬·발음↑' 등 4종 고정값으로 기록 — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md)
        const tg = rs.slice(3).trim();
        if (tg) (tagW[sid] = tagW[sid] || []).push(tg);
      }
    });
  }
  const raidBy = {};
  const rd = ss.getSheetByName('raid');
  if (rd && rd.getLastRow() >= 2) {
    rd.getRange(2, 1, rd.getLastRow() - 1, 5).getValues().forEach(r => {
      if (r[1] && dstr(r[0], tz) === weekKey) raidBy[r[1]] = String(r[4] || '');
    });
  }
  const topicBy = {};
  const wt = ss.getSheetByName('weekly_topics');
  if (wt && wt.getLastRow() >= 2) {
    wt.getRange(2, 1, wt.getLastRow() - 1, 5).getValues().forEach(r => {
      const d = r[3];
      if (!r[0] || !d) return;
      const dd = asDate_(d);
      if (dd >= monday && dd < weekEnd) topicBy[r[0]] = String(r[4] || r[1] || ''); // [v9.34] 주 창 상한
    });
  }
  let sent = 0, unsent = 0;
  const sentIds = []; // [v9.34] 이번 실행 발송 성공 sid
  kids.forEach(k => {
    if (retry && sentSet[String(k.sid)]) return; // [v9.34] 재시도: 기발송 스킵 — 중복 발송 금지
    const att = attW[k.sid] || 0;
    const pts = Math.max(ptsW[k.sid] || 0, 0);
    const mvpN = Math.max(mvpW[k.sid] || 0, 0); // [v9.0] 건수 방식 — 시냅스 +10 상향에도 정확
    const synN = Math.max(synW[k.sid] || 0, 0);
    const raidSt = raidBy[k.cls] || '';
    const lines = [];
    lines.push('이번 주 등원 ' + att + '회 · 포인트 +' + pts + 'P');
    if (mvpN || synN) lines.push([mvpN ? '🔥 도전 ' + mvpN + '회' : '',
      synN ? '🌱 성장 ' + synN + '회' : ''].filter(String).join(' · '));
    if (tagW[k.sid] && tagW[k.sid].length) { // [v9.0] 크루의 눈 — 한/몽 병기
      const uniq = tagW[k.sid].filter((v, i, a) => a.indexOf(v) === i);
      lines.push('💬 크루의 눈: ' + uniq.join(' · ') + ' / ' + uniq.map(t => TAG_MN[t] || t).join(' · '));
    }
    if (raidSt) lines.push('⚔️ 반 레이드: ' + (raidSt.indexOf('달성') > -1 ? '보스 격파! 반 전원 +' + PT.레이드 + 'P 🏆'
      : raidSt.indexOf('아쉬움') > -1 ? '목표까지 조금 남았어요 — 다음 주에 다시 도전해요!' : '다음 주에 다시 도전해요!'));
    if (topicBy[k.cls]) lines.push('📖 이번 주 배운 것: ' + topicBy[k.cls]);
    // 철학 Ⅰ-3 ① 의 «앞 반» — 학부모 소식이 아이를 말하게 만드는 한 줄(유호 확정 09-05 밤 · 철학 v1.20 예외 · 트랙 25행 닫음).
    //   몽골어 병기는 본문 몽골어판(짓는 중)과 함께 — 감수자 전엔 기계 검문 통과분만이라 여기선 한국어 한 줄만.
    lines.push('🗣 오늘 배운 말을 아이에게 한 번 물어봐 주세요 — 아이가 직접 말할 때 가장 오래 남습니다.');
    const body = k.n + ' 학생의 한 주 소식입니다.\n\n' + lines.join('\n') +
      '\n\n자세한 내용은 SYNK 앱에서 확인하실 수 있어요 😊\n\n' +
      'Долоо хоногийн тойм — ирц ' + att + ' · оноо +' + pts + 'P' +
      ((mvpN + synN) > 0 ? ' · 🔥 Сорилт·Өсөлт ' + (mvpN + synN) + ' удаа' : '') + ' 🎉';
    // [v9.125] 관문 단일화 — v9.120의 이중 quotaOk(루프 첫 줄+여기)는 뒤쪽이 도달 불가 코드였고 학생당 조회만 2배였다.
    //   발송 직전 1곳만 남긴다. 실패 시 sent·sentIds를 안 건드려 마킹은 성공분만(재시도가 그 학생을 다시 잡는다).
    if (!quotaOk(1)) { unsent++; return; }
    MailApp.sendEmail(k.m, '[SYNK] 📮 ' + k.n + ' — 이번 주 소식', body);
    sent++;
    sentIds.push(String(k.sid));
  });
  if (!retry && st && sent) setState(st, '학부모다이제스트주', weekKey); // 같은 날 수동 재실행 중복 방지(정상 가드 유지)
  if (st) { // [v9.34] 미발송 잔여 → 보류 키(발송완료 sid 누적) 기록 · 전원 완료 시 삭제
    if (unsent > 0) setState(st, '다이제스트보류', weekKey + '|' + Object.keys(sentSet).concat(sentIds).join(','));
    else if (retry) setState(st, '다이제스트보류', '');
  }
  Logger.log('학부모 주간 다이제스트' + (retry ? '(재시도)' : '') + ': ' + sent + '통 · 미발송 ' + unsent + '명');
}

/* ===================== [v7.8] 복구 리허설 ===================== */
// 월 1회 원장이 실행: 최신 백업을 '읽기만' 해서 복원 가능 여부 검증 (원본 덮어쓰기 없음 — 100% 안전)
function restoreDrill() {
  if (typeof DriveApp === 'undefined') { Logger.log('복구 리허설: Drive 미지원 환경 — 스킵'); return; }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  try {
    const it = DriveApp.getFoldersByName('SYNK_백업');
    if (!it.hasNext()) { adminMail('[SYNK] 🧯 복구 리허설 실패', '백업 폴더(SYNK_백업)가 없습니다. dailyBackup 트리거(새벽 3시)를 확인하세요.'); return; }
    const files = it.next().getFiles();
    let latest = null;
    while (files.hasNext()) {
      const f = files.next();
      if (f.getName().indexOf('SYNK_앱데이터_백업_') === 0 && (!latest || f.getDateCreated() > latest.getDateCreated())) latest = f;
    }
    if (!latest) { adminMail('[SYNK] 🧯 복구 리허설 실패', '백업 파일이 없습니다.'); return; }
    const bk = SpreadsheetApp.openById(latest.getId());
    const bp = bk.getSheetByName('profiles'), op = ss.getSheetByName('profiles');
    const bRows = bp ? bp.getLastRow() - 1 : -1, oRows = op ? op.getLastRow() - 1 : -1;
    const bH = bp ? String(bp.getRange(1, 1, 1, 5).getValues()[0].join('|')) : '';
    const oH = op ? String(op.getRange(1, 1, 1, 5).getValues()[0].join('|')) : '';
    const ok = !!bp && bRows > 0 && bH === oH && Math.abs(bRows - oRows) <= 5;
    const st = ss.getSheetByName('app_state');
    if (st) setState(st, '복구리허설일', Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'));
    if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 🧯 복구 리허설 ' + (ok ? '✅ 통과' : '⚠️ 확인 필요'),
      '최신 백업: ' + latest.getName() + '\n' +
      'profiles — 백업 ' + bRows + '행 / 원본 ' + oRows + '행 · 헤더 ' + (bH === oH ? '일치 ✅' : '불일치 ⚠️') + '\n\n' +
      (ok ? '언제든 복구 가능한 상태입니다. 다음 리허설: 한 달 뒤 🗓' : '차이가 큽니다 — 백업 파일을 직접 열어 확인해주세요.') + '\n\n' +
      '[실제 복구 절차 — 3단계]\n① Drive의 SYNK_백업 폴더에서 원하는 날짜 파일 열기\n② 손상된 시트만 전체 선택 → 복사\n③ 원본 같은 이름 시트에 붙여넣기 (스크립트·트리거는 원본에 살아있으므로 그대로)\n\n' +
      '※ 코드/트리거 장애·배포 사고 복구는 저장소 docs/응급복구_런북.md 참고.');
  } catch (e) {
    adminMail('[SYNK] 🧯 복구 리허설 오류', String(e));
  }
}

/* ===================== [v7.5] 일일 한도 가드 (dailyGuard) ===================== */
// 매일 22시. ① MVP·오늘의 시냅스: 같은 날·같은 반 각 1명(최초 지급만 유효)  ② 숙제완료·생일축하: 학생당 하루 1회
// 초과분은 자동 정정(-P) + 원장 경고. 정정은 성장·잔액·레이드 데미지·칭호 카운트까지 대칭으로 되돌린다.
// today 기준 검사라 자정이 지나면 자동 초기화 — 다음 날은 다시 지급 가능.
const DAILY_LIMIT = { '숙제완료': 1, '생일축하': 1, '오늘의다짐': 1, '칭찬': 1, '첨삭확인': 1, '퀴즈응답': 1, '재작성': 1,
  '오늘의 도전': 1, '오늘의 성장': 1, '오늘의 MVP': 1, '오늘의 시냅스': 1 }; // 사유(정확 일치)별 학생당 일일 한도 — [v9.28] 학생 셀프 미션 1일 1회 · [v9.47·B4] 칭찬(PT.칭찬)도 학생당 1일 1회(왕관과 차별화되는 "작은 인정"·경제 보호, 초과분 야간 자동 정정+강사 통보)
/* [재구성 08-20 · 유호 확정] 「반당 하루 1명」 강제(CLASS_AWARDS)를 걷었다 — 철학 ㉢(학생끼리
 * 비교하지 않는다)과 제도 층에서 충돌했다: 매일 반에서 1등을 뽑는 장치였고, 왕관편중%·미수혜자
 * 명단이 그 병을 덮는 순번 운영을 만들고 있었다(판정안 docs/왕관제도_재구성_판정안.md §3).
 * 새 제도 = 기준을 채우면 그날 «전원» 받는다 · 상한은 학생당 하루 각 1회(위 DAILY_LIMIT).
 * ⚠ 옛 rs('오늘의 MVP'·'오늘의 시냅스')는 point_logs 역사·Glide 버튼에 남아 판독은 전부 겸용이다. */
const CLASS_AWARDS = []; // 반당 정원 제도 폐지 — 배열은 하위 코드 모양 보존용(빈 배열 = 어느 상도 반당 강제 없음)
const TAG_MN = { '발음↑': 'Дуудлага ↑', '열정': 'Хичээл зүтгэл', '친구도움': 'Найздаа тусалсан', '집중력': 'Төвлөрөл' }; // [v9.0] 칭찬 태그 몽골어
function dailyGuard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const pf = ss.getSheetByName('profiles');
  const pl = ss.getSheetByName('point_logs');
  if (!pf || !pl || pf.getLastRow() < 2 || pl.getLastRow() < 2) return;
  const classOf = {};
  pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
    if (r[0] && r[3] === 'student' && r[4]) classOf[r[0]] = r[4];
  });
  const byAward = {}, fixedA = {};   // [v7.6 잔형] 옛 반당 정원 집계 — CLASS_AWARDS 가 비어 지금은 안 돈다(모양 보존)
  const bySR = {}, fixedSR = {};     // [v7.5] 학생×사유: 하루 1회
  (pl.getLastRow() < 2 ? [] : pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues()).forEach(r => { // [v8.2]
    const sid = r[1], pts = Number(r[2]) || 0, rs = String(r[3] || ''), d = r[5];
    if (!sid || !d || !classOf[sid]) return;
    const dd = asDate_(d);
    if (Utilities.formatDate(dd, tz, 'yyyy-MM-dd') !== today) return;
    const cls = classOf[sid];
    if (rs.indexOf('정정') > -1) { // 오늘 이미 만든 정정 집계 (재실행 멱등)
      if (rs.indexOf('MVP') > -1) { fixedA['MVP|' + cls] = (fixedA['MVP|' + cls] || 0) + 1; return; }
      if (rs.indexOf('시냅스') > -1) { fixedA['시냅스|' + cls] = (fixedA['시냅스|' + cls] || 0) + 1; return; }
      if (rs.indexOf('일일한도') > -1) {
        Object.keys(DAILY_LIMIT).forEach(k => {
          if (rs.indexOf(k) > -1) fixedSR[sid + '|' + k] = (fixedSR[sid + '|' + k] || 0) + 1;
        });
      }
      return;
    }
    for (let a = 0; a < CLASS_AWARDS.length; a++) {
      if (pts > 0 && rs.indexOf(CLASS_AWARDS[a]) > -1) {
        const key = a + '|' + cls;
        if (!byAward[key]) byAward[key] = [];
        byAward[key].push({ sid: sid, pts: pts, t: dd.getTime(), by: String(r[4] || '') }); // [v9.28] by 추가(강사 통보용)
        return;
      }
    }
    const rsBase = rs.split('·')[0]; // [v9.51·B4] 💝 칭찬 태그=사유 접미('칭찬·집중력') — 라이브 point_logs 8열이 🔒 Row ID라 태그 열 방식 폐기. 한도는 기본 사유로 판정
    if (pts > 0 && DAILY_LIMIT[rsBase]) { // 기본 사유 정확 일치(오탐 방지 — '스토어·…' 등은 목록에 없어 무해)
      const key = sid + '|' + rsBase;
      if (!bySR[key]) bySR[key] = [];
      bySR[key].push({ sid: sid, pts: pts, t: dd.getTime(), rs: rsBase, by: String(r[4] || '') }); // [v9.28] by 추가
    }
  });
  const fixRows = [], teacherNotices = {}; // [v9.28] teacherNotices: 강사명 → 정정 라인들(본인 통보용)
  Object.keys(byAward).forEach(key => {
    const a = Number(key.split('|')[0]), cls = key.split('|')[1];
    const tag = a === 0 ? 'MVP' : '시냅스';
    const list = byAward[key].sort((x, y) => x.t - y.t); // 최초 지급이 유효
    const need = (list.length - 1) - (fixedA[tag + '|' + cls] || 0);
    for (let k = 0; k < need; k++) {
      const x = list[list.length - 1 - k];
      fixRows.push([x.sid, -x.pts, '정정·' + tag + ' 중복(하루 1명)', 'SYSTEM']);
      if (x.by) (teacherNotices[x.by] = teacherNotices[x.by] || []).push('· ' + x.sid + ' ' + tag + ' 중복(하루 1명) ' + (-x.pts) + 'P');
    }
  });
  Object.keys(bySR).forEach(key => {
    const list = bySR[key].sort((a, b) => a.t - b.t);
    const limit = DAILY_LIMIT[list[0].rs];
    const need = (list.length - limit) - (fixedSR[key] || 0);
    for (let k = 0; k < need; k++) {
      const x = list[list.length - 1 - k];
      fixRows.push([x.sid, -x.pts, '정정·일일한도(' + x.rs + ')', 'SYSTEM']);
      if (x.by) (teacherNotices[x.by] = teacherNotices[x.by] || []).push('· ' + x.sid + ' 일일한도(' + x.rs + ') ' + (-x.pts) + 'P');
    }
  });
  { // [v9.41·자동화] 잔액 음수 학생 야간 감지 — 스토어 과소비(Visibility 미설정·조작)를 다음날 아침 브리핑으로. 서명 dedup(같은 명단이면 재알림 없음)
    const negB = [];
    if (pf.getMaxColumns() >= 43) {
      const balN = pf.getRange(2, 43, pf.getLastRow() - 1, 1).getValues();
      pf.getRange(2, 1, pf.getLastRow() - 1, 4).getValues().forEach((r, i) => {
        if (r[0] && r[3] === 'student' && Number(balN[i] && balN[i][0]) < 0) negB.push(r[0] + ' ' + (r[1] || '') + '(' + balN[i][0] + 'P)');
      });
    }
    if (negB.length) {
      const stNB = ensureSheet(ss, 'app_state', ['key', 'value']);
      const sigNB = negB.join(',');
      if (String(getState(stNB, '음수잔액_상태').val || '') !== sigNB) {
        adminMail('[SYNK] ⚠️ 잔액 음수 학생 ' + negB.length + '명', negB.join('\n') + '\n\n스토어 교환 버튼의 잔액 조건(가이드 §6-3)을 확인하세요. 테스트 구매면 point_logs의 음수 행 삭제.');
        setState(stNB, '음수잔액_상태', sigNB);
      }
    } else { const stNB2 = ss.getSheetByName('app_state'); if (stNB2 && String(getState(stNB2, '음수잔액_상태').val || '') !== '') setState(stNB2, '음수잔액_상태', ''); }
  }
  if (fixRows.length) {
    appendPoints(ss, fixRows);
    adminMail('[SYNK] ⚠️ 일일 한도 초과 자동 정정 ' + fixRows.length + '건',
      '도전·성장을 포함한 일일 항목은 학생당 하루 1회 규칙입니다(반당 정원 없음 — 기준을 채우면 전원).\n' +
      '초과 지급분을 자동 정정했습니다 (내일이 되면 다시 지급 가능).\n\n' +
      fixRows.map(r => '· ' + r[0] + ' ' + r[2] + ' ' + r[1] + 'P').join('\n'));
    // [v9.28] 강사 본인 통보 — 정정 사실이 원장에게만 가서 교실에서 이유도 모른 채 포인트가 깎이던 문제 수정
    const emapDG = teacherEmailMap_(ss);
    Object.keys(teacherNotices).forEach(byName => {
      const email = emapDG.byKey[byName];
      if (email && quotaOk(1)) MailApp.sendEmail(email, '[SYNK] 오늘 지급하신 포인트 일부가 자동 정정됐어요',
        '하루 한도(도전·성장·숙제완료·생일 = 학생당 하루 1회)를 넘어 자동으로 되돌린 내역입니다:\n\n' +
        teacherNotices[byName].join('\n') + '\n\n같은 학생·같은 항목은 내일부터 다시 지급 가능해요.');
    });
  }
  Logger.log('일일 가드: 정정 ' + fixRows.length + '건');
}

/* [v7.6→재구성 08-20] 일일 인정(오늘의 도전·오늘의 성장) 학부모 알림 — 기준을 채운 학생 전원에게 (한·몽 병기, 통합 1통) */
function notifyDailyAwards() {
  if (!PARENT_MAIL_MVP) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const st = ss.getSheetByName('app_state');
  if (st && String(getState(st, 'MVP메일발송일').val) === today) return; // 재실행 중복 방지
  const pf = ss.getSheetByName('profiles');
  const pl = ss.getSheetByName('point_logs');
  if (!pf || !pl || pf.getLastRow() < 2 || pl.getLastRow() < 2) return;
  const info = {};
  pf.getRange(2, 1, pf.getLastRow() - 1, 26).getValues().forEach(r => {
    if (r[0] && r[3] === 'student') info[r[0]] = { n: r[1] || r[0], c: r[4] || '', m: String(r[25] || '') };
  });
  const netM = {}, netS = {}; // 오늘 순계 (dailyGuard 정정 반영)
  (pl.getLastRow() < 2 ? [] : pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues()).forEach(r => { // [v8.7]
    const sid = r[1], pts = Number(r[2]) || 0, rs = String(r[3] || ''), d = r[5];
    if (!sid || !d || !info[sid]) return;
    const dd = asDate_(d);
    if (Utilities.formatDate(dd, tz, 'yyyy-MM-dd') !== today) return;
    if (rs.indexOf('MVP') > -1 || rs.indexOf('도전') > -1) netM[sid] = (netM[sid] || 0) + pts;
    else if (rs.indexOf('시냅스') > -1 || rs.indexOf('성장') > -1) netS[sid] = (netS[sid] || 0) + pts;
  });
  let sent = 0;
  const sids = {};
  Object.keys(netM).forEach(k => { sids[k] = 1; });
  Object.keys(netS).forEach(k => { sids[k] = 1; });
  Object.keys(sids).forEach(sid => {
    const hasM = (netM[sid] || 0) > 0, hasS = (netS[sid] || 0) > 0;
    if (!hasM && !hasS) return; // 정정으로 상쇄된 지급은 알림 제외
    const o = info[sid];
    if (o.m.indexOf('@') === -1) return;
    const title = hasM && hasS ? '🔥 ' + o.n + ' — 오늘의 도전 + 성장!'
      : hasM ? '🔥 ' + o.n + ' — 오늘의 도전!'
      : '🌱 ' + o.n + ' — 오늘의 성장!';
    let body = '';
    if (hasM) body += o.n + ' 학생이 오늘 ' + o.c + ' 수업에서 「오늘의 도전」을 받았습니다! (+' + netM[sid] + 'P)\n' +
      '처음 손 들기, 처음 발표처럼 그날 처음 해본 도전에 선생님이 드리는 인정입니다.\n\n';
    if (hasS) body += o.n + ' 학생이 오늘 「오늘의 성장」을 받았습니다! (+' + netS[sid] + 'P)\n' +
      '어제의 나보다 한 걸음 — 전에 틀린 것을 오늘 맞힌 그 성장에 드리는 인정입니다.\n\n';
    body += '많이 칭찬해주세요 🎉\n\n';
    if (hasM) body += o.n + ' сурагч өнөөдөр шинэ зүйлд зориглон оролдсоноороо «Өнөөдрийн сорилт» авлаа! (+' + netM[sid] + 'P)\n';
    if (hasS) body += o.n + ' сурагч өчигдрийн өөрөөсөө нэг алхам урагшилж «Өнөөдрийн өсөлт» авлаа! (+' + netS[sid] + 'P)\n';
    body += 'Гэртээ магтаж урамшуулаарай 🎉';
    if (quotaOk(1)) { MailApp.sendEmail(o.m, '[SYNK] ' + title, body); sent++; } // [v9.34] 발송 성공분만 카운트 — 쿼터 미발송을 '발송'으로 세어 허위 마킹·수동 복구 차단하던 결함 수정
  });
  if (st && sent) setState(st, 'MVP메일발송일', today);
  Logger.log('일일 도전·성장 학부모 메일: ' + sent + '통');
}

/* [v7.3] 조사 헬퍼 — 받침 판정(바트카가/테무진이), 비한글(이모지 등)은 병기 폴백 */
function josa(w, a, b) {
  const s = String(w || '');
  const c = s.charCodeAt(s.length - 1);
  if (c >= 0xAC00 && c <= 0xD7A3) return ((c - 0xAC00) % 28 !== 0) ? a : b;
  return a + '(' + b + ')';
}

/* ===================== [v7.3] 일일 전투 리포트 ===================== */
// 월~목·토 22시 (nightJobs) — 오늘 반별 데미지를 RPG 전투 서사로 자동 변환 → raid_story 시트
function raidStoryDaily() {
  if (!RAID_DAILY_STORY) return; // [v9.50] 일일 전투 OFF(유호 07-21 처방) — 주간 결산만 발간. 상수 true로 재개
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const dy = now.getDay();
  if (dy === 5 || dy === 0) return; // 금·일은 결산 스토리가 담당
  const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const weekKey = Utilities.formatDate(monday, tz, 'yyyy-MM-dd');

  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return;
  const classOf = {}, nameOf = {};
  pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
    if (r[0] && r[3] === 'student' && r[4]) { classOf[r[0]] = r[4]; nameOf[r[0]] = r[1] || r[0]; }
  });
  const pl = ss.getSheetByName('point_logs');
  if (!pl || pl.getLastRow() < 2) return;
  const dayD = {}, weekD = {}, topReason = {}, crM = {}, crS = {}; // [v7.7]
  pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues().forEach(r => {
    const sid = r[1], pts = Number(r[2]) || 0, d = r[5];
    const isE = pts > 0 || String(r[3] || '').indexOf('정정') > -1; // [v7.4]
    if (!sid || !d || !isE || pts === 0 || !classOf[sid]) return;
    const dd = asDate_(d);
    const cls = classOf[sid];
    if (dd >= monday) weekD[cls] = (weekD[cls] || 0) + pts;
    if (Utilities.formatDate(dd, tz, 'yyyy-MM-dd') === today) {
      if (!dayD[cls]) dayD[cls] = {};
      dayD[cls][sid] = (dayD[cls][sid] || 0) + pts;
      if (!topReason[sid]) topReason[sid] = String(r[3] || '');
      const rsC = String(r[3] || ''); // [v7.7] 오늘의 도전·성장 순계(정정 자동 상쇄)
      if (rsC.indexOf('MVP') > -1 || rsC.indexOf('도전') > -1) { if (!crM[cls]) crM[cls] = {}; crM[cls][sid] = (crM[cls][sid] || 0) + pts; }
      else if (rsC.indexOf('시냅스') > -1 || rsC.indexOf('성장') > -1) { if (!crS[cls]) crS[cls] = {}; crS[cls][sid] = (crS[cls][sid] || 0) + pts; }
    }
  });
  // 연료 (주간 게이지 + 오늘 합동 공격)
  const fuelMap = {};
  const ct = ss.getSheetByName('contents');
  if (ct && ct.getLastRow() >= 2) {
    ct.getRange(2, 1, ct.getLastRow() - 1, 6).getValues().forEach(r => {
      if (r[1] === 'fuel' && r[2]) fuelMap[String(r[2])] = Number(r[5]) || 0;
    });
  }
  const fuelWk = weeklyFuel_(ss, fuelMap, monday, today, tz); // [v9.25] 연료 주간집계 헬퍼 통합
  const fuelToday = fuelWk.today;
  Object.keys(fuelWk.week).forEach(cls => { weekD[cls] = (weekD[cls] || 0) + fuelWk.week[cls]; });
  Object.keys(fuelToday).forEach(cls => { if (!dayD[cls]) dayD[cls] = {}; }); // 오늘 연료만 있는 반도 일일 스토리에 포함
  // 이번 주 보스 HP
  const hpOf = {};
  const rd = ss.getSheetByName('raid');
  if (rd && rd.getLastRow() >= 2) {
    rd.getRange(2, 1, rd.getLastRow() - 1, 3).getValues().forEach(r => {
      if (dstr(r[0], tz) === weekKey) hpOf[r[1]] = Number(r[2]) || 0;
    });
  }
  const boss = bossOfMonth(ss, Number(Utilities.formatDate(now, tz, 'M')));
  const bN = boss ? boss.name : '이달의 보스';
  const PARTS = ['왼쪽 눈', '오른쪽 뿔', '꼬리', '왼팔', '코어', '등딱지', '오른발'];
  const VERB = { '숙제': '숙제 완검으로', '도전': '오늘의 도전의 힘으로', 'MVP': '오늘의 도전의 힘으로', '성장': '한 뼘 성장의 기세로', '시냅스': '반짝이는 시냅스 스파크로', '칭찬': '빛나는 태도 광선으로',
                 '생일': '생일 축포로', '출석': '출석 러시로', '레이드': '승리의 기세로' };
  function verbOf(rs) { for (var k in VERB) { if (rs.indexOf(k) > -1) return VERB[k]; } return '기습 공격으로'; }
  function pick(arr, seed) {
    let h = 0; const s = String(seed);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
    return arr[h % arr.length];
  }
  const rsSh = ensureSheet(ss, 'raid_story', ['date','class_name','유형','제목','스토리']);
  const dupe = new Set();
  if (rsSh.getLastRow() >= 2) {
    rsSh.getRange(2, 1, rsSh.getLastRow() - 1, 3).getValues().forEach(r => {
      if (String(r[2]) === '일일') dupe.add(dstr(r[0], tz) + '|' + r[1]);
    });
  }
  const out = [];
  Object.keys(dayD).forEach(cls => {
    if (dupe.has(today + '|' + cls)) return;
    const hits = Object.keys(dayD[cls])
      .map(sid => ({ sid: sid, n: nameOf[sid] || sid, d: dayD[cls][sid] }))
      .filter(x => x.d > 0).sort((a, b) => b.d - a.d); // [v7.4] 정정 상쇄분 제외
    const tot = hits.reduce((s, x) => s + x.d, 0) + (fuelToday[cls] || 0);
    if (tot <= 0) return;
    const lines = [];
    if (hits[0]) {
      const p0 = pick(PARTS, today + cls + hits[0].sid);
      lines.push('⚡ ' + hits[0].n + josa(hits[0].n, '이', '가') + ' ' + verbOf(topReason[hits[0].sid] || '') + ' ' + bN +
        '의 ' + p0 + josa(p0, '을', '를') + ' 강타! (' + hits[0].d + ' 데미지)');
    }
    if (hits[1]) lines.push('연이어 ' + hits[1].n + '의 공격이 ' + pick(PARTS, today + cls + hits[1].sid) + '에 명중! (' + hits[1].d + ')');
    if (hits.length > 2) lines.push('그리고 ' + (hits.length - 2) + '명의 동료들이 함께 몰아붙였다! (+' +
      hits.slice(2).reduce((s, x) => s + x.d, 0) + ')');
    if (fuelToday[cls]) lines.push('🔥 연료 미션 합동 공격 작렬! (+' + fuelToday[cls] + ')');
    const hp = hpOf[cls] || 0;
    if (hp > 0) {
      const remain = Math.max(hp - (weekD[cls] || 0), 0);
      if (remain === 0) lines.push('💥 ' + bN + '이(가) 힘이 거의 다 빠졌다 — 마지막 한 번만 치면 쓰러진다!');
      else lines.push('🩸 ' + bN + ' 남은 HP: ' + remain + ' / ' + hp);
    }
    const crowns = []; // [v7.7→08-20] 오늘의 도전·성장 코너
    if (crM[cls]) Object.keys(crM[cls]).forEach(s => { if (crM[cls][s] > 0) crowns.push('🔥 도전: ' + (nameOf[s] || s)); }); // [09-02] 라벨도 새 이름으로 — 분류는 08-20 에 옮겼는데 학생이 읽는 낱말만 옛 이름(MVP·시냅스)이 남아 있었다
    if (crS[cls]) Object.keys(crS[cls]).forEach(s => { if (crS[cls][s] > 0) crowns.push('🌱 성장: ' + (nameOf[s] || s)); });
    if (crowns.length) lines.push('✨ 오늘의 도전·성장 — ' + crowns.join(' · '));
    out.push([today, cls, '일일', '⚔️ ' + cls + ' — 오늘 ' + tot + ' 데미지!', lines.join(' ')]);
  });
  if (out.length) rsSh.getRange(rsSh.getLastRow() + 1, 1, out.length, 5).setValues(out);
  Logger.log('일일 전투 리포트: ' + out.length + '개 반');
}

/* ===================== 시간표 / 미등원 ===================== */

// [v9.125] rooms 생략 = 4실 24반(v9.102 기준선 — CORE_ROOMS_DEFAULT=4). 구 주석 "3실 18반"은 v9.95 잔재.
//   구조·명명·정원의 근거는 파일 상단 「[v9.95] 반 편성 정본」 블록(classNumOf 위)에 있다.
function setupSchedule(rooms) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sc = ss.getSheetByName('schedule');
  if (!sc) { sc = ss.insertSheet('schedule'); sc.setFrozenRows(1); }

  // 표시명 보존 — E열에는 시즌마다 각 반이 직접 지은 이름이 산다. 이 함수는 시트를 통째로 지우므로,
  //   보존 장치가 없으면 재실행 한 번에 전 반의 이름이 영영 사라진다(복구 경로 없음).
  //   반명(A열)이 같으면 옛 표시명을 그대로 물려준다 — 4실 개방(3→4실 재실행)이 이름을 안 건드린다.
  const prev = {};
  if (sc.getLastRow() >= 2) {
    const w = Math.max(sc.getLastColumn(), 1);
    sc.getRange(2, 1, sc.getLastRow() - 1, w).getValues().forEach(function (r) {
      const nm = String(r[0] || '').trim();
      const disp = w >= 5 ? String(r[4] || '').trim() : '';
      if (nm && disp) prev[nm] = disp;
    });
  }

  const rows = buildCoreSchedule_(rooms);
  let kept = 0;
  rows.forEach(function (r) { if (prev[r[0]]) { r[4] = prev[r[0]]; kept++; } });

  sc.clear();
  sc.getRange(1, 1, 1, SCHEDULE_HEADERS.length).setValues([SCHEDULE_HEADERS]);
  sc.getRange(2, 1, rows.length, SCHEDULE_HEADERS.length).setValues(rows);
  const seats = rows.reduce(function (s, r) { return s + Number(r[3]); }, 0);
  Logger.log('시간표 ' + rows.length + '개 반 · ' + seats + '석 생성(' + (rows.length / CORE_SLOTS.length) +
    '실 · 전 반 정원 ' + CLASS_CAP_DEFAULT + '명)' + (kept ? ' · 기존 표시명 ' + kept + '건 보존' : ''));
}

/* ===================== [v9.89] 🔁 결석 추적 — 「결석 복귀율」의 측정 레일 =====================
 * 결함: checkNoShow(v9.34~)는 미등원자를 메일로만 알리고 app_state에 "N명"이라는 카운트만 남겼다.
 *   → 24시간 뒤 "이 학생에게 연락했는가"를 대조할 학생별 행이 어디에도 없다.
 *   그런데 「결석 복귀율」은 강사 시즌 등급 심사 20점(개원 첫 시즌 30점) · 채점 방식 "앱 자동" 항목이다
 *   (급여 인센티브 정본 §7 배점표 · 강사 수업 규칙 「결석자 복귀 — 24시간 안에」(v3.0 기준 7장)).
 *   돈이 걸린 지표가 측정 불가 상태였다 — 규칙서는 절차를 정해뒀는데 앱에 데이터가 없었다.
 * → 감지 1건 = absence_followup 1행. 연락은 구글 폼(Glide update 0), 복귀는 attendance 대조로 자동 판정.
 *
 * ⚠ 구조적 전제 — 출석 1탭이 이 지표의 유일한 입구:
 *   checkNoShow는 "당일 그 반 출석 0건이면 스킵"한다(v9.34 — 휴강·강사 미입력을 미등원으로 오경보하지
 *   않기 위한 가드). 즉 강사가 출석 1탭을 안 하면 결석 추적 자체가 열리지 않고, 그 반의 결석 복귀율은
 *   측정 자체가 안 된다(0점이 아니라 무데이터). 이 침묵은 preflightGlide가 경고로 잡는다.
 *
 * 판정 규약(돈이 걸린 지표라 "모르는 것"을 불리하게 세지 않는다):
 *   '지각'   = 감지 후 같은 날 출석이 들어옴 → checkNoShow의 구조적 오탐(수업 시작 +30분 판정이라
 *              늦게 온 학생이 결석으로 잡힌다). 분모에서 제외 — 데이터가 스스로 정정한다.
 *   '복귀:d' = 결석일 이후 ABSENCE_RETURN_DAYS 안에 첫 출석. 며칠 만인지도 함께 남긴다.
 *   '미복귀' = 유예 창을 넘겨도 출석 없음.
 *   ''       = 아직 판정 보류(유예 창 안) — 분모에도 분자에도 넣지 않는다.
 */
const ABSENCE_FOLLOWUP_HEADERS = ['날짜', 'student_id', '반', '담당강사', '감지시각', '연락여부', '연락시각', '연락수단', '복귀여부', '비고'];
const ABSENCE_NAG_DAYS = 3;      // 미연락 재알림 창 D+1~D+3 — 정확일 매칭이면 배치가 하루 죽을 때 영영 건너뛴다(MJ_expiryDaily_ 창 방식 계보)
const ABSENCE_RETURN_DAYS = 14;  // 복귀 판정 유예 — 이 안에 출석이 없으면 '미복귀' 확정
const ABSENCE_ESCALATE_N = 3;    // 유예 창 안 결석 N회 → 원장 보고(수업 규칙 「결석자 복귀」 "3회면 원장에게 보고" · v3.0 기준 절차 6)
const ABSENCE_SEASON_DAYS = 56;  // 등급 심사 주기 = 8주 시즌(주간 리포트의 복귀율 집계 창)

// [v9.89] 복귀 판정(순수 함수 — tests/safety.test.js가 직접 로드해 검증).
//   attDates = 그 학생의 출석일 문자열 배열(yyyy-MM-dd). 반환 '' = 판정 보류(다음 밤에 재판정).
function absenceReturnState_(dateStr, attDates, todayStr, returnDays) {
  const d = String(dateStr || '').slice(0, 10);
  if (!d) return '';
  const list = attDates || [];
  if (list.indexOf(d) > -1) return '지각'; // 같은 날 출석이 뒤늦게 들어옴 = 애초에 결석이 아니었다
  const gap = s => Math.round((new Date(s + 'T00:00:00') - new Date(d + 'T00:00:00')) / 86400000);
  let first = '';
  for (let i = 0; i < list.length; i++) { // 결석일 이후 첫 출석(yyyy-MM-dd는 문자열 비교 = 날짜 비교)
    const s = String(list[i] || '').slice(0, 10);
    if (s > d && (!first || s < first)) first = s;
  }
  if (first) { const g = gap(first); return g <= returnDays ? '복귀:' + first + '(+' + g + '일)' : '미복귀'; }
  const elapsed = gap(String(todayStr || '').slice(0, 10));
  return (!isNaN(elapsed) && elapsed >= returnDays) ? '미복귀' : '';
}

// [v9.89] 강사별 집계(순수 함수) — 「결석 복귀율」 계산 정본. rows = absence_followup 값 그대로.
//   분모 = 판정이 끝난 결석만(복귀+미복귀). '지각'(오탐)과 판정 보류는 제외한다.
//   [v9.125] 날짜 정규화를 이 안으로 — 시트가 A열을 날짜 서식으로 되읽으면 getValues()가 Date를 주는데,
//   String(Date)="Mon Jul 20…"이 창 검사에서 전 행을 탈락시켜 복귀율이 통째로 빈다(teacher_stats 실결함).
//   호출자 4곳 중 1곳만 변환을 잊어도 조용히 죽으므로, 정본이 직접 받는다(guard-must-check-result).
function absenceReturnStats_(rows, fromStr, toStr) {
  const by = {};
  const pad2 = n => (n < 10 ? '0' : '') + n;
  const dnorm = v => (v instanceof Date && !isNaN(v.getTime()))
    ? v.getFullYear() + '-' + pad2(v.getMonth() + 1) + '-' + pad2(v.getDate())
    : String(v == null ? '' : v).slice(0, 10);
  (rows || []).forEach(r => {
    const d = dnorm(r[0]);
    if (!d) return;
    if (fromStr && d < fromStr) return;
    if (toStr && d > toStr) return;
    const key = String(r[3] || '').trim() || '(담당 미배정)';
    const o = by[key] || (by[key] = { tot: 0, contacted: 0, judged: 0, ret: 0, pending: 0, late: 0 });
    const st = String(r[8] || '').trim();
    if (st === '지각') { o.late++; return; } // 오탐 — 어느 분모에도 안 들어간다
    o.tot++;
    if (String(r[5] || '').trim()) o.contacted++;
    if (st.indexOf('복귀:') === 0) { o.judged++; o.ret++; }
    else if (st === '미복귀') o.judged++;
    else o.pending++;
  });
  Object.keys(by).forEach(k => {
    const o = by[k];
    o.rate = o.judged ? Math.round(o.ret / o.judged * 100) : null;        // 복귀율 — 판정 0건이면 null(0%가 아니다)
    o.contactRate = o.tot ? Math.round(o.contacted / o.tot * 100) : null; // 24시간 연락 이행률
  });
  return by;
}

// [v9.89] 급여 인센티브 정본 §7 배점표 그대로 — 90%+ 20 / 85~89 16 / 80~84 12 / 75~79 6 / 미만 0.
//   판정 데이터가 없으면 null(미측정) — 무데이터를 0점으로 환산하면 강사가 앱 결함으로 돈을 잃는다.
function absenceReturnScore_(rate, 첫) {
  // [v9.194] 첫 = 개원 첫 시즌 — 재등록률 30점이 없어져 이 항목이 20 → 30 으로 커진다(정본 §7 첫 시즌 표).
  if (rate == null || isNaN(rate)) return null;
  return 첫 ? (rate >= 90 ? 30 : rate >= 85 ? 24 : rate >= 80 ? 18 : rate >= 75 ? 10 : 0)
            : (rate >= 90 ? 20 : rate >= 85 ? 16 : rate >= 80 ? 12 : rate >= 75 ? 6 : 0);
}

function checkNoShow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const day = now.getDay();
  if (day === 0) return; // [v9.46] 일요일은 어느 반도 수업이 없다(주말반=토요일만) — 미등원 판정 자체를 안 연다
  const type = day === 6 ? '주말' : '평일';
  const nowMin = Number(Utilities.formatDate(now, tz, 'H')) * 60 + Number(Utilities.formatDate(now, tz, 'm')); // [v9.34] 시트TZ 기준 — getHours(스크립트TZ) 혼용 시 판정 창이 어긋남

  const map = scheduleMap(ss);
  const targets = Object.keys(map).filter(num => map[num].name === num).filter(num => { // [v8.3] 반명 키만
    if (map[num].type !== type) return false;
    const p = map[num].time.split(':');
    const start = Number(p[0]) * 60 + Number(p[1]);
    return nowMin >= start + 30 && nowMin < start + 90;
  });
  if (targets.length === 0) return;

  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const at = ss.getSheetByName('attendance');
  if (!at) return; // [v9.54] 재건 직후 attendance 부재 가드 — 출석표 없이 판정을 열면 전원 미등원 오경보가 된다(다음 스위프에서 재시도)
  const atLast = at.getLastRow();
  const todayAtt = new Set();
  if (atLast >= 2) {
    at.getRange(2, 1, atLast - 1, 3).getValues().forEach(r => {
      if (r[1] && r[2] && dstr(r[2], tz) === todayStr) todayAtt.add(r[1]);
    });
  }
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return; // [v8.2] 콜드 가드
  const pfData = pf.getRange(2, 1, pf.getLastRow() - 1, 15).getValues();
  const emapNS = teacherEmailMap_(ss); // [v9.28] 담당 강사에게도 라우팅

  // [v9.89] 결석 추적 적재 준비 — 감지 1건 = 1행. (날짜|sid) 중복 가드는 app_state 마커와 이중 방어라,
  //   적재 뒤 메일이 throw해 다음 스위프가 이 반을 재처리해도 행은 늘지 않는다.
  const af = ensureSheet(ss, 'absence_followup', ABSENCE_FOLLOWUP_HEADERS);
  const afSeen = {};
  let afRow = af.getLastRow() + 1; // 쓰기 행은 직접 전진시킨다 — 반마다 getLastRow()를 다시 읽으면 flush 타이밍에 의존하게 된다
  if (af.getLastRow() >= 2) af.getRange(2, 1, af.getLastRow() - 1, 2).getValues().forEach(r => {
    if (r[1] && dstr(r[0], tz) === todayStr) afSeen[String(r[1]).trim()] = 1;
  });
  // 학부모 사전신고(absence_notice) 조인 — 사유가 이미 확인된 결석은 비고에 남기고 밤 미연락 알림에서 제외한다
  const preN = {};
  const an = ss.getSheetByName('absence_notice');
  if (an && an.getLastRow() >= 2) an.getRange(2, 1, an.getLastRow() - 1, 4).getValues().forEach(r => {
    if (r[0] && dstr(r[2], tz) === todayStr) preN[String(r[0]).trim()] = String(r[3] || '사유 미기재').slice(0, 60);
  });
  const nowHm = Utilities.formatDate(now, tz, 'HH:mm');
  const formUrlNS = String((getState(st, '결석폼URL') || {}).val || ''); // [v9.89] 연락 기록 한 클릭 — 루프 밖 1회 조회

  targets.forEach(num => {
    const key = '미등원_' + todayStr + '_' + num; // [v9.34] v8.3 반명 키 전환 후 남은 '정규반' 이중 접두 화석 정리
    if (getState(st, key).row > 0) return;
    const clsStu = pfData.filter(r =>
      r[0] && r[3] === 'student' && (String(r[4]) === num || (map[classNumOf(r[4])] && map[classNumOf(r[4])].name === num))); // [v8.8] 번호 폴백은 '유일 번호'일 때만 — 신체계 트랙 간 오매칭 차단
    // [v9.34] 당일 그 반 출석 0건이면 스킵(마킹도 보류) — 강사 미입력·휴강을 미등원으로 오경보하지 않고, 출석이 들어온 다음 스위프에 판정
    if (!clsStu.some(r => todayAtt.has(r[0]))) return;
    const absent = clsStu.filter(r => !todayAtt.has(r[0]));
    // [v9.89] 시트 적재가 메일보다 먼저 — 지표 원본이 쿼터·메일 실패에 종속되면 안 된다(메일은 알림, 행은 데이터).
    if (absent.length > 0) {
      // 담당 강사 = 등급 심사 귀속 주체. [v9.100] teacher_stats(케어지수)와 같은 헬퍼로 통일 — 「결석 복귀율」과
      //   「케어지수」가 서로 다른 강사를 가리키면 인센티브 산정(급여 정본 §7)이 어긋난다. byClass[num] 직접 조회 대비
      //   괄호 반명('정규반1(9시)')·번호 폴백(강사 유일할 때만)·중복 제거가 붙어 담당 강사를 더 넓게 잡는다
      //   → '담당 강사 미배정' 오경보 감소. 누락 방향이 아니므로 야간 통보(byKey 역조회)가 그대로 커버한다.
      const tNames = teachersOfClass_(emapNS, num).join('·');
      const add = [];
      absent.forEach(r => {
        const sid = String(r[0]).trim();
        if (afSeen[sid]) return; // 오늘 이미 적재됨(재시도·다른 반 중복 배정)
        afSeen[sid] = 1;
        add.push([todayStr, sid, num, tNames, nowHm, '', '', '', '',
          preN[sid] ? '사전신고:' + preN[sid] : '']);
      });
      if (add.length) { af.getRange(afRow, 1, add.length, ABSENCE_FOLLOWUP_HEADERS.length).setValues(add); afRow += add.length; }
    }
    if (absent.length > 0) {
      // [v9.125] 발송 성공에만 마킹 — 구 코드는 관문(리허설·쿼터)이 닫혀 메일이 0통 나가도 키를 찍어,
      //   리허설 20분이 그날의 미등원 알림(원장+강사 24시간 연락 지시)을 영구 소실시켰다. 판정 창이 60분이라
      //   다음 스위프(10분)가 재시도한다(absence_followup 적재는 afSeen 가드로 중복 없음).
      if (!quotaOk(1)) { Logger.log('미등원 통보 보류(' + num + ' ' + absent.length + '명) — 발송 관문 닫힘, 다음 스위프 재시도'); return; }
      MailApp.sendEmail(ADMIN_EMAIL,
        '[SYNK] ⚠️ ' + num + ' 미등원 ' + absent.length + '명 (' + map[num].time + ')',
        map[num].time + ' 시작 ' + num + ' 수업 30분 경과, 미출석:\n\n' +
        absent.map(r => '· ' + r[0] + ' ' + r[1] +
          (r[13] ? ' (보호자 ' + r[13] + ')' : '')).join('\n') +
        '\n\n학부모 연락을 권장합니다.');
      (emapNS.byClass[num] || []).forEach(t => { // [v9.28] 담당 강사 통보
        if (quotaOk(1)) MailApp.sendEmail(t.email,
          '[SYNK] ⚠️ ' + num + ' 미등원 ' + absent.length + '명 (' + map[num].time + ')',
          map[num].time + ' 시작 ' + num + ' 수업 30분 경과, 미출석:\n\n' +
          absent.map(r => '· ' + r[0] + ' ' + r[1]).join('\n') +
          '\n\n📌 24시간 안에 연락하고 아래 폼에 남겨주세요(시즌 등급 심사 「결석 복귀율」 항목).' +
          (formUrlNS ? '\n' + formUrlNS : '\n※ 연락 기록 폼이 아직 없습니다 — 원장에게 알려주세요(createAbsenceForm 1회 실행).'));
      });
    }
    setState(st, key, absent.length + '명');
  });
  Logger.log('미등원 체크: ' + targets.length + '개 반');
}

/* [v9.89] 밤 22시 — ①복귀 자동 판정(attendance 대조) ②24시간 경과 미연락 강사 알림 ③원장 요약·에스컬레이션.
 * 알림은 창 방식(D+1~D+3)이라 배치가 하루 죽어도 따라잡고, 창을 넘기면 조용해진다 — 강사 1인당 밤 최대 1통.
 * 미연락 행은 지우지 않는다: 연락여부 빈칸 = 미이행 증거이고, 그것이 등급 심사가 읽는 값이다. */
function absenceFollowupNightly_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('absence_followup');
  if (!sh || sh.getLastRow() < 2) return; // 감지 0건 = 무비용 휴면
  const tz = ss.getSpreadsheetTimeZone();
  const todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const W = ABSENCE_FOLLOWUP_HEADERS.length;
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, W).getValues();

  // ① 복귀 판정 — 빈칸만 채운다(확정값은 재기입 없음 = 멱등). 판정 보류 학생의 출석만 인덱싱.
  const need = {};
  rows.forEach(r => { const s = String(r[1] || '').trim(); if (s && !String(r[8] || '').trim()) need[s] = 1; });
  const attBy = {};
  if (Object.keys(need).length) {
    const at = ss.getSheetByName('attendance');
    if (at && at.getLastRow() >= 2) at.getRange(2, 1, at.getLastRow() - 1, 3).getValues().forEach(r => {
      const sid = String(r[1] || '').trim();
      if (!sid || !need[sid] || !r[2]) return;
      (attBy[sid] = attBy[sid] || []).push(dstr(r[2], tz));
    });
  }
  const retCol = rows.map(r => {
    const cur = String(r[8] || '').trim();
    if (cur) return [cur];
    const sid = String(r[1] || '').trim();
    if (!sid) return ['']; // 미매칭 행 — sid를 채우면 다음 밤에 자동 판정
    return [absenceReturnState_(dstr(r[0], tz), attBy[sid] || [], todayStr, ABSENCE_RETURN_DAYS)];
  });
  writeIfChanged(sh, 2, 9, retCol);

  // 이름 조회(메일 가독성) — sid만 적힌 알림은 강사가 누구인지 모른다
  const nameOf = {};
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 2).getValues().forEach(r => {
    if (r[0]) nameOf[String(r[0]).trim()] = String(r[1] || '');
  });

  // ② 미연락 창 스캔 + ③ 반복 결석 집계
  const byT = {}, stuCnt = {}, adminLines = [];
  rows.forEach((r, i) => {
    const d = dstr(r[0], tz);
    const sid = String(r[1] || '').trim();
    if (!d || !sid) return;
    const days = Math.round((new Date(todayStr + 'T00:00:00') - new Date(d + 'T00:00:00')) / 86400000);
    if (isNaN(days)) return;
    if (days >= 0 && days <= ABSENCE_RETURN_DAYS && retCol[i][0] !== '지각') stuCnt[sid] = (stuCnt[sid] || 0) + 1;
    if (String(r[5] || '').trim()) return;                    // 연락 기록됨 — 이행 완료
    if (retCol[i][0] === '지각') return;                       // 오탐(당일 늦게 등원) — 연락 의무 없음
    if (String(r[9] || '').indexOf('사전신고') === 0) return;   // 학부모가 미리 알려온 결석 — 사유 확인됨
    if (days < 1 || days > ABSENCE_NAG_DAYS) return;           // 창 밖(오늘 감지분·지난 건)은 조용히
    const t = String(r[3] || '').trim();
    (byT[t] = byT[t] || []).push('· ' + d + ' ' + (nameOf[sid] || sid) + ' (' + String(r[2] || '') + ') — 감지 ' +
      String(r[4] || '') + ' · ' + days + '일 경과');
  });

  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const formUrl = String((getState(st, '결석폼URL') || {}).val || '');
  const emap = teacherEmailMap_(ss);
  let sent = 0, pend = 0;
  Object.keys(byT).forEach(t => {
    pend += byT[t].length;
    const names = t ? t.split('·').map(s => s.trim()).filter(Boolean) : []; // 담당 강사 복수 표기 분해
    if (!names.length) { adminLines.push('⚠ 담당 강사 미배정 ' + byT[t].length + '건 — profiles의 강사 class_name을 확인하세요\n' + byT[t].join('\n')); return; }
    names.forEach(nm => {
      const em = emap.byKey[nm];
      if (!em) { adminLines.push('⚠ 강사 "' + nm + '" 이메일 미상 — ' + byT[t].length + '건 미통보'); return; }
      if (!quotaOk(1)) { adminLines.push('⚠ 쿼터 부족 — ' + nm + ' ' + byT[t].length + '건 미통보(내일 밤 재시도)'); return; }
      MailApp.sendEmail(em, '[SYNK] 🔁 결석 연락 미이행 ' + byT[t].length + '건 — 24시간 규칙',
        nm + ' 선생님,\n\n아래 학생은 결석이 감지됐는데 아직 연락 기록이 없습니다.\n\n' + byT[t].join('\n') +
        '\n\n── 수업 규칙 「결석자 복귀」 ──\n· 24시간 안에 메신저로 3문장(오늘 뭘 했는지 · 걱정 한마디 · 다음 시간 예고)\n' +
        '· 2회 연속이면 전화 · 3회 연속이면 원장 보고\n· "왜 안 왔어요?"로 시작하지 않기\n\n' +
        '연락하셨으면 기록해 주세요(30초). 이 기록이 시즌 등급 심사 「결석 복귀율」의 원본입니다.\n' +
        (formUrl || '※ 기록 폼 미생성 — 원장에게 알려주세요') +
        '\n\n※ 이 알림은 감지 후 ' + ABSENCE_NAG_DAYS + '일까지만 갑니다. 그 뒤에도 빈칸이면 미이행으로 남습니다.');
      sent++;
    });
  });

  Object.keys(stuCnt).forEach(sid => {
    if (stuCnt[sid] >= ABSENCE_ESCALATE_N) adminLines.push('🚨 ' + (nameOf[sid] || sid) + ' — 최근 ' + ABSENCE_RETURN_DAYS +
      '일 결석 ' + stuCnt[sid] + '회(연속 여부는 판정하지 않음 — 감지 횟수 기준). 수업 규칙 「결석자 복귀」의 원장 개입 지점(3회 연속 결석 보고)에 해당합니다');
  });
  if (adminLines.length || pend) adminMail('[SYNK] 🔁 결석 연락 점검 — 미이행 ' + pend + '건',
    '강사 통보 ' + sent + '통 발송.\n\n' + (adminLines.length ? adminLines.join('\n') : '(추가 조치 사항 없음)') +
    '\n\n※ 복귀 판정은 자동입니다(출석 대조). absence_followup 시트의 연락여부 빈칸이 곧 미이행 기록입니다.');
  Logger.log('결석 추적: ' + rows.length + '행 · 미연락 ' + pend + '건 · 강사 통보 ' + sent + '통');
}

/* [v9.89] 주간 통합 리포트 섹션 — 「결석 복귀율」을 원장이 실제로 볼 수 있게(등급 심사 8주 시즌 창).
 * 침묵(학생은 있는데 감지 0건)은 성과가 아니라 출석 1탭 미입력 신호라고 명시한다 — 이 지표의 최대 오독 지점. */
function absenceSection_(wantText) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('absence_followup');
  const tz = ss.getSpreadsheetTimeZone();
  const today0 = new Date(Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd') + 'T00:00:00');
  const fromStr = Utilities.formatDate(new Date(today0.getTime() - ABSENCE_SEASON_DAYS * 86400000), tz, 'yyyy-MM-dd');
  if (!sh || sh.getLastRow() < 2) return '결석 감지 0건 — 성과가 아니라 신호입니다. checkNoShow는 "당일 그 반 출석 0건이면 스킵"하므로, 강사가 출석 1탭을 안 하면 결석 추적이 아예 열리지 않습니다(= 결석 복귀율 측정 불가).';
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, ABSENCE_FOLLOWUP_HEADERS.length).getValues();
  const by = absenceReturnStats_(rows.map(r => r.map(v => v instanceof Date ? dstr(v, tz) : v)), fromStr, null);
  const keys = Object.keys(by).sort();
  if (!keys.length) return '최근 ' + ABSENCE_SEASON_DAYS + '일 결석 감지 0건 — 출석 1탭이 들어오고 있는지 확인하세요(1탭이 없으면 판정 창 자체가 안 열립니다).';
  const L = ['최근 ' + ABSENCE_SEASON_DAYS + '일(8주 시즌 창) · 배점표 = 급여 인센티브 정본 §7'];
  keys.forEach(k => {
    const o = by[k];
    const sc = absenceReturnScore_(o.rate);
    L.push('· ' + k + ' — 결석 ' + o.tot + '건 · 24h 연락 ' + (o.contactRate == null ? '—' : o.contactRate + '%') +
      ' · 복귀율 ' + (o.rate == null ? '판정 대기(0건)' : o.rate + '% (' + o.ret + '/' + o.judged + ')') +
      (sc == null ? ' · 점수 미측정' : ' · 등급점수 ' + sc + '/20') +
      (o.pending ? ' · 보류 ' + o.pending : '') + (o.late ? ' · 지각정정 ' + o.late : ''));
  });
  return L.join('\n');
}

/* ===================== [함께한날 막5] 장면 감지 + 원장 네 블록 + 강사 D-1 =====================
 * checkEvolution 의 자리를 잇는다(nightJobs 같은 줄 · calcAll 뒤 = 그날 만남·도달이 그날 밤 장면이 된다).
 * 중복 방지 세 겹(설계 §4-4): ① scene_log 멱등키 sid|장면번호(본진 — 「어제 값과 비교」 한 칸 덮어쓰기 병의 처방)
 * ② AD30 마지막발화장면 마커 ③ 하루 1회 상한(여럿 동시 성립 시 가장 높은 장면 하나만 발화).
 * 실사고 교정 승계: 마커 갱신은 기입·발송 «뒤»(v9.34 — 앞이면 실패 시 알림 영구 유실). 원장 알림은
 * DIGEST 큐(쿼터 무관)고 학부모 발송은 없다(인앱 배너 BN66 몫) — 쿼터 되돌림이 필요한 발송은 강사 D-1 뿐인데
 * 그건 마커와 무관한 «그날의 상태»(AG33=1)라 되돌릴 마커 자체가 없다. */
function checkScene() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const pf = ss.getSheetByName('profiles');
  const last = pf.getLastRow();
  if (last < 2) return;
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const thisMonth = today.slice(0, 7);
  /* 전환 판독만 여기서 — 헤더 «개명»은 마커 기록 직전으로 미뤘다(codex P2 fedb767e: 개명 뒤 중간 사망이면
   * 다음 회차가 구 몬스터 이름을 새 축 값으로 읽는다. 값이 먼저, 이름은 마지막 — calcAll AP1 과 같은 규약). */
  const aaIsScene = String(pf.getRange('AA1').getValue()) === '이전장면';

  const w = Math.min(pf.getMaxColumns(), 82); // CD82(다음장면조건)까지 — D-1 판정의 말 게이트 재료
  /* 🔒 CD82 가 **실재할 때만** D-1 을 판정한다(fail-closed · codex P2 f49d02f5a234 · 09-02).
   *   열이 82개 미만이거나 헤더가 「다음장면조건」이 아니면 r[81] 은 undefined/딴 값이고, 아래 «조건문이 없다 = 게이트 통과»
   *   판독이 AG33=1 인 학생 전원에게 「내일 새 장면」을 보낸다 — 새 시트·부분 실패 셋업에서 나는 거짓 알림이다.
   *   못 재면 «안 보낸다»가 맞는 방향이고, 건너뛴 사실은 아래 원장 메일·로그에 그 이름으로 남긴다(침묵 금지). */
  const cdGate = w >= 82 && String(pf.getRange(1, 82).getValue() || '').trim() === '다음장면조건';
  const data = pf.getRange(2, 1, last - 1, w).getValues();
  const log = ensureSheet(ss, 'scene_log', SCENE_LOG_HEADERS);
  // 재료 — 오늘 «직접» 맞힌 문형(조건문형 칸) · 오늘 제출문(그날의문장 칸) · 60일 게이트 해제 판정(마지막 AI 도달일)
  const todayForm = {}, lastAIDone = {};
  {
    const ml = ss.getSheetByName('mastery_log');
    if (ml && ml.getLastRow() >= 2) {
      const nameOfG = (typeof grammarNameMap_ === 'function') ? grammarNameMap_() : {};
      ml.getRange(2, 1, ml.getLastRow() - 1, 6).getValues().forEach(r => {
        const sid = String(r[0] || '').trim(), srcM = String(r[5] || '');
        if (!sid || String(r[2]) !== '도달') return;
        if (!(srcM === 'AI첨삭' || srcM === 'AI음성' || srcM === 'AI대화')) return;
        const dn = r[4] ? dstr(r[4], tz) : '';
        if (!dn) return;
        if (dn === today && !todayForm[sid]) todayForm[sid] = nameOfG[String(r[1]).trim()] || String(r[1]).trim();
        if (dn > (lastAIDone[sid] || '')) lastAIDone[sid] = dn;
      });
    }
  }
  const todaySent = {};
  {
    const fb = ss.getSheetByName('hw_feedback');
    if (fb && fb.getLastRow() >= 2) {
      const from = Math.max(2, fb.getLastRow() - 199);
      fb.getRange(from, 1, fb.getLastRow() - from + 1, 4).getValues().forEach(r => {
        const sid = String(r[1] || '').trim();
        if (sid && r[2] && dstr(r[2], tz) === today && !todaySent[sid]) todaySent[sid] = String(r[3] || '').slice(0, 120);
      });
    }
  }
  const newAA = [], newAD = [], opened = [], quiet14 = [], gateFreeL = [], 후보들 = [];
  const d1ByCls = {};
  let monthMastered = 0; // 「이번 달 우리 학생들이 새로 맞힌 말」 — AI 출처 도달의 이달 합(설계 §3 마지막 줄)
  {
    const ml2 = ss.getSheetByName('mastery_log');
    if (ml2 && ml2.getLastRow() >= 2) ml2.getRange(2, 1, ml2.getLastRow() - 1, 6).getValues().forEach(r => {
      const srcM = String(r[5] || '');
      if (String(r[2]) === '도달' && (srcM === 'AI첨삭' || srcM === 'AI음성' || srcM === 'AI대화') && r[4] && dstr(r[4], tz).indexOf(thisMonth) === 0) monthMastered++;
    });
  }
  data.forEach(r => {
    const sid = String(r[0] || '').trim();
    const isStu = sid && r[3] === 'student';
    const nSc = Number(r[41]) || 0;          // AP 지나온장면수
    const prevRaw = r[26];                   // AA 이전장면(전환 첫 회 = 구 몬스터 이름)
    const adPrev = Number(r[29]) || 0;       // AD 마지막발화장면
    let aaNext = isStu ? nSc : '';
    let adNext = adPrev;
    if (isStu) {
      const prevN = aaIsScene ? (Number(prevRaw) || 0) : nSc; // 전환 첫 회 — 발화 없이 원장만 맞춘다
      if (nSc > prevN) 후보들.push({ sid: sid, from: prevN, to: nSc }); // scene_log 기입 후보 — 실제 append 는 아래 잠금 창에서
      /* 발화 판정은 scene_log «존재»가 아니라 **AD 마커**다(codex P2 004e4ddf) — 기입 뒤 알림 전에 죽으면
       * 다음 실행이 has 에서 그 장면을 「끝난 것」으로 읽어 알림이 영구 유실되던 자리. 마커는 발송 «뒤»에만
       * 오르므로(v9.34) 재실행이 알림을 되살린다. 하루 1회 상한 = 가장 높은 장면 하나만. */
      if (aaIsScene && nSc > adPrev) {
        opened.push({ id: sid, name: r[1] || sid, n: nSc, form: todayForm[sid] || '' });
        adNext = nSc;
      }
      if (!aaIsScene) adNext = nSc; // 전환 회차 — 마커 개시(구 몬스터 이름 잔값을 수로 안 읽는다)
      // 원장 네 블록 재료(설계 §3 — 「이 체계의 안전핀」)
      const afRaw = r[31]; // AF 마지막만남일
      const afYmd = afRaw instanceof Date ? dstr(afRaw, tz) : String(afRaw || '').slice(0, 10);
      if (afYmd && Math.floor((new Date(today) - new Date(afYmd)) / 86400000) >= 14) quiet14.push({ name: r[1] || sid, d: afYmd });
      const daysT = Number(r[30]) || 0; // AE 함께한날
      const lastD = lastAIDone[sid] || '';
      if (daysT >= 60 && (!lastD || Math.floor((new Date(today) - new Date(lastD)) / 86400000) >= 60)) gateFreeL.push(r[1] || sid);
      /* D-1 = 「내일 «정말» 새 장면」 — 날(AG33=1)만으로는 부족하다(codex P2 ca2c813e): 말 게이트가 남은
       * 학생은 내일 안 열린다. CD82(다음장면조건)는 같은 calcAll 이 결정론으로 쓴 문구라('내가 맞힌 말 N개'
       * 조각은 toMastered>0 일 때만 실린다) 그 부재가 곧 게이트 통과다 — calcAll 의 clsEvoSoon 과 같은 판정. */
      /* 🔴 그런데 «부재»에는 두 얼굴이 있다 — 「게이트가 없다」와 「CD82 를 못 읽었다」(codex 지적
       *   f49d02f5a234 · 08-27). profiles 물리 열이 82개에 못 미치면 r[81] 이 undefined 이고,
       *   `String(undefined || '')` 는 빈 문자열이라 indexOf 가 -1 을 내 **모두 통과**시킨다:
       *   신규·부분 실패 설정에서 AG33=1 인 학생 «전원»에게 D-1 알림이 나간다.
       *   ⇒ 모르면 안 보낸다(fail closed). 가르는 자는 «값»이 아니라 «칸이 있나»다 —
       *     칸이 있고 비었으면(=게이트 없음) 예전처럼 보낸다. 그 갈림이 `undefined` 검사다. */
      const cd82있나 = r.length > 81 && typeof r[81] !== 'undefined';
      if (cd82있나 && (Number(r[32]) || 0) === 1 && String(r[81] || '').indexOf('내가 맞힌 말') === -1) (d1ByCls[String(r[4] || '')] = d1ByCls[String(r[4] || '')] || []).push('· ' + sid + ' ' + (r[1] || sid) + ' — 내일 새 장면'); // AG 다음장면까지 × CD 조건
    }
    newAA.push([aaNext]);
    newAD.push([isStu ? adNext : '']);
  });
  /* 기입 → 알림 → 마커(v9.34). 잠금은 **기입 창만** 감싼다 — 넓게 잡으면 그 안의 adminMail 이 같은
   * 비재진입 잠금을 재획득하다 죽는다(codex P1 ebee661a·1c371cb8 — selfDeclare 주석이 경고한 그 함정).
   * 멱등맵(has) 로드와 append 가 같은 잠금 안이라 동시 실행 중복 append 도 막힌다(P2 7694bee6). */
  {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) throw new Error('장면 원장 기입 — 스크립트 잠금 획득 실패(이 밤의 기입을 건너뛴다 · 알림·마커도 안 나간다)');
    try {
      const has = {};
      if (log.getLastRow() >= 2) log.getRange(2, 1, log.getLastRow() - 1, 2).getValues().forEach(r => {
        if (r[0]) has[String(r[0]).trim() + '|' + (Number(r[1]) || 0)] = 1;
      });
      const addRows = [];
      후보들.forEach(c => {
        for (let k = c.from + 1; k <= c.to; k++) {
          if (has[c.sid + '|' + k]) continue;
          has[c.sid + '|' + k] = 1;
          addRows.push([c.sid, k, today, todayForm[c.sid] || '', todaySent[c.sid] || '', new Date()]);
        }
      });
      // 소독 채널 — 그날의문장은 학생이 친 글이다
      if (addRows.length) writeIfChanged(log, log.getLastRow() + 1, 1, addRows);
      Logger.log('장면 원장: 새 기입 ' + addRows.length + '행');
    } finally { lock.releaseLock(); }
  }
  // 반 태깅 14일 끊긴 반(weekly_topics 최근 입력일)
  const staleCls = [];
  {
    const tp = ss.getSheetByName('weekly_topics');
    const lastByCls = {};
    if (tp && tp.getLastRow() >= 2) tp.getRange(2, 1, tp.getLastRow() - 1, 4).getValues().forEach(r => {
      if (r[0] && r[3]) { const d6 = dstr(r[3], tz); if (d6 > (lastByCls[String(r[0])] || '')) lastByCls[String(r[0])] = d6; }
    });
    Object.keys(lastByCls).forEach(c => {
      if (Math.floor((new Date(today) - new Date(lastByCls[c])) / 86400000) >= 14) staleCls.push(c + ' (마지막 ' + lastByCls[c] + ')');
    });
  }
  /* 강사 D-1 — 반별 «상위 3명»까지만(알림 물량 방어 · 설계 §4-4). 원장 메일보다 «먼저» 돈다 —
   * 쿼터로 못 나간 반은 AG33 이 내일 0 이 되어 재시도 자리가 없으므로(codex P2 e7787886) 그 목록을
   * 원장 다이제스트(DIGEST 큐 — 쿼터 무관)에 실어 정보만은 사람에게 닿게 한다. */
  const d1Missed = [];
  {
    const emap = teacherEmailMap_(ss);
    Object.keys(d1ByCls).forEach(cls => {
      const lines = d1ByCls[cls].slice(0, 3);
      (emap.byClass[cls] || []).forEach(t => {
        if (quotaOk(1)) MailApp.sendEmail(t.email, '[SYNK] 🧶 ' + cls + ' — 내일 새 장면 ' + lines.length + '명',
          '내일 가이드가 한 걸음 다가가는 크루입니다. 수업에서 살짝 반겨 주세요.\n\n' + lines.join('\n'));
        else d1Missed.push(cls + '(' + lines.length + '명)');
      });
    });
  }
  if (opened.length || quiet14.length || gateFreeL.length || staleCls.length || d1Missed.length || !cdGate) {
    const L = [];
    if (!cdGate) L.push('⚠ profiles 에 CD82(다음장면조건)가 없어 강사 D-1 판정을 **건너뛰었다**(안 보낸 것이지 대상 0명이 아니다) — calcAll 이 한 번 돌면 열이 선다. 계속 뜨면 열 배치를 확인해 주세요');
    if (opened.length) L.push('🧶 새 장면이 열린 크루 ' + opened.length + '명\n' + opened.map(o => '· ' + o.name + ' — 장면 ' + o.n + (o.form ? ' (' + o.form + ')' : '')).join('\n'));
    if (quiet14.length) L.push('🕯️ 2주째 만남이 없는 크루 ' + quiet14.length + '명\n' + quiet14.map(q => '· ' + q.name + ' (마지막 ' + q.d + ')').join('\n'));
    if (gateFreeL.length) L.push('🔴 문법 도달이 60일 끊겨 게이트가 해제된 크루 ' + gateFreeL.length + '명 — 학생 잘못이 아닌 이유(채점 통로·수업)를 먼저 보세요\n' + gateFreeL.map(n => '· ' + n).join('\n'));
    if (staleCls.length) L.push('📋 반 태깅이 14일 끊긴 반 ' + staleCls.length + '개\n' + staleCls.map(c => '· ' + c).join('\n'));
    if (d1Missed.length) L.push('⚠ 강사 D-1 알림이 메일 쿼터로 못 나간 반 ' + d1Missed.length + '개 — 내일 아침 그 반 강사에게 한마디 전해 주세요\n· ' + d1Missed.join(' · '));
    L.push('이번 달 우리 학생들이 새로 맞힌 말 ' + monthMastered + '개');
    adminMail('[SYNK] 🧶 함께한 날 — 새 장면 ' + opened.length + '명', L.join('\n\n'));
  }
  /* 헤더 개명은 마커 «직전» — 값(마커·원장)이 다 선 뒤에야 이름을 바꾼다(위 fedb767e 원자성). */
  if (pf.getRange('AA1').getValue() !== '이전장면') pf.getRange('AA1').setValue('이전장면');
  if (pf.getRange('AD1').getValue() !== '마지막발화장면') pf.getRange('AD1').setValue('마지막발화장면');
  writeIfChanged(pf, 2, 27, newAA);
  writeIfChanged(pf, 2, 30, newAD);
  Logger.log('장면: 발화 ' + opened.length + '명 · D-1 반 ' + (cdGate ? Object.keys(d1ByCls).length : '판정 건너뜀(CD82 부재)') + (d1Missed.length ? ' · 쿼터 유실 ' + d1Missed.length + '반(다이제스트 합류)' : ''));
}

/* ===================== 강사 케어 지수 ===================== */

// [v9.87] teacher_stats 헤더 정본 — SHEET_SKELETON(골격)과 calcTeacherStats(실사용)가 이 상수 하나를 함께 쓴다.
//   v9.40에서 골격 구 3열 vs 실사용 8열이 어긋난 드리프트가 이미 한 번 났다 → 주석 경고 대신 단일 소스로 기계 강제.
// [v9.108] 인센티브 3지표(10~14열) 편입 — 축(A열 강사)이 v9.87에서 고쳐진 뒤 비로소 얹을 수 있게 된 것.
//   ⚠ 무데이터는 0%가 아니라 **빈칸(미측정)**이다 — 앱이 못 잰 것을 0으로 환산하면 강사가 앱 결함으로 돈을 잃는다
//   (v9.89 absenceReturnScore_가 세운 원칙을 3지표 전체로 확장). 분모는 '지표모수' 열에 그대로 노출해
//   "80%"가 5명 중 4명인지 100명 중 80명인지 원장이 바로 판별하게 한다.
//   [v9.113] 지표별 (비율, 배점) 쌍을 나란히 둔다 — 흩어져 있으면 원장이 "이 점수가 어느 비율에서 나왔나"를
//   눈으로 잇지 못한다. 인센티브점수는 '획득 / 가능' 문자열(미측정 지표는 분모에서도 빠진다).
//   [v9.194] 숙제·근태 2지표 + 등급판정 편입 — 정본 §7 이 「앱 자동 90점 5항목」이라 잡은 표를 열로 다 편다.
//   등급판정은 총점이 아니라 **판정 문장**이다('88점 · 실버 ×1.15 · 미측정 20점 제외' / '심사 스킵(…)').
const TEACHER_STATS_HEADERS = ['강사', '담당학생수', '1인당출석', '1인당포인트', '1인당칭찬', '케어지수', '지난달인정', '인정편중%', '담당반',
                               '승급통과율%', '승급배점', '결석복귀율%', '복귀배점', '재등록률%', '재등록배점',
                               '숙제제출률%', '숙제배점', '근태위반', '근태배점', '인센티브점수', '등급판정', '지표모수'];

/* [v9.193] 승급·재등록 배점 — **정본이 회수했다**. v9.113 은 급여 정본 §7 에 구간표가 없어
 * 「임의 기준」으로 두고 「문서가 확정되면 임계값만 갈아끼우라」고 적어 뒀는데, 정본 v1.6(2026-08-04)이
 * 7개 항목 구간표를 전부 채웠다. 대조 결과 **임계값은 맞고 배점이 틀렸다**:
 *   · 승급   60/50/40/30 → 20/16/12/6/0   ✅ 정본과 일치(정본이 오히려 이 코드 값을 채택했다)
 *   · 복귀   90/85/80/75 → 20/16/12/6/0   ✅ 처음부터 정본 근거
 *   · 재등록 90/85/80/75 → **30/24/18/10/0** — v9.113 은 20/16/12/6 이었다(만점 자체가 20 vs 30)
 * 재등록만 만점이 다른 이유는 정본이 배점을 그렇게 정했기 때문이다(등급 심사 100점 중 재등록 30).
 * 「셋 다 만점 20 동률」은 근거가 없던 시절의 잠정값이었고 이 판으로 폐기한다. */
/* [v9.194] `첫`(개원 첫 시즌) 인자 — 정본 §7 「개원 첫 시즌 전용 배점표」. 첫 시즌엔 재등록률이
 *   **존재하지 않아**(재등록할 이전 시즌이 없다) 그 30점을 복귀·승급·숙제·근태에 옮겨 담는다.
 *   ⚠ 임계는 그대로고 **점수만** 커진다 — 승급의 임계(60/50/40/30)가 복귀(90/85/80/75)와 다른 것도 그대로다. */
function promotionScore_(rate, 첫) {
  // 도달제 승급(급수 6단계를 여러 시즌에 걸쳐 오른다) — 한 시즌에 전원이 오르는 것은 비현실적이라
  // 복귀·재등록보다 임계를 낮게 잡는다. 절반이 오르면 우수.
  if (rate == null || isNaN(rate)) return null;
  return 첫 ? (rate >= 60 ? 30 : rate >= 50 ? 24 : rate >= 40 ? 18 : rate >= 30 ? 10 : 0)
            : (rate >= 60 ? 20 : rate >= 50 ? 16 : rate >= 40 ? 12 : rate >= 30 ? 6 : 0);
}
function reenrollScore_(rate) {
  // 이탈은 곧 매출 손실 — '지켜내는' 지표라 복귀율과 같은 높은 임계를 쓰되, 배점은 정본이 가장 무겁게
  // 잡은 항목이다(30점 — 등급 심사 7항목 중 최고). 구간은 정본 §7 그대로.
  // (첫 시즌 인자가 없는 유일한 지표다 — 첫 시즌엔 이 항목 자체가 사라진다.)
  if (rate == null || isNaN(rate)) return null;
  return rate >= 90 ? 30 : rate >= 85 ? 24 : rate >= 80 ? 18 : rate >= 75 ? 10 : 0;
}
function homeworkScore_(rate, 첫) {
  // 학생이 낸 것을 강사 점수로 읽는다 — 분모(기대 제출 수)의 정의는 정본에 없다(§7 「가능(학생 제출 기준)」뿐).
  // 그래서 아래 집계는 아직 붙이지 않았고 이 함수는 **구간만** 정본대로 확정해 둔다.
  if (rate == null || isNaN(rate)) return null;
  return 첫 ? (rate >= 80 ? 15 : rate >= 70 ? 10 : rate >= 60 ? 6 : 0)
            : (rate >= 80 ? 10 : rate >= 70 ? 7  : rate >= 60 ? 4 : 0);
}
function punctualityScore_(위반, 첫) {
  // ⚠ 이 지표만 입력이 **비율이 아니라 위반 건수**다(정본 「무위반 / 1회 / 2회 / 3회 이상」).
  //   0 과 미측정을 절대 섞지 않는다 — 0 은 「무위반」이고 null 은 「잴 기준이 없다」다.
  if (위반 == null || isNaN(위반)) return null;
  return 첫 ? (위반 === 0 ? 15 : 위반 === 1 ? 9 : 위반 === 2 ? 4 : 0)
            : (위반 === 0 ? 10 : 위반 === 1 ? 6 : 위반 === 2 ? 3 : 0);
}
/* 측정된 지표만 합산해 '획득 / 가능'으로 낸다. 미측정을 0점으로 더하면 앱 결함이 급여 삭감이 된다.
 * 🔑 분모는 **채점 함수에게 되묻는다**(100%를 넣으면 그 지표의 만점이 나온다). 상수로 따로 적으면
 *   배점표가 바뀔 때 구간표만 고치고 분모가 낡는다 — 정본 v1.6 이 재등록을 30점으로 확정한 뒤에도
 *   이 자리가 `개수 × 20` 이라 「30 / 20」 같은 값이 나올 수 있었다. 그래서 짝으로 받는다. */
function incentiveTotal_(pairs) {
  const got = (pairs || []).filter(p => p && p[0] != null);
  return got.length
    ? (got.reduce((a, p) => a + p[0], 0) + ' / ' + got.reduce((a, p) => a + p[1](100), 0))
    : '';
}

/* [v9.194] 등급 판정 — 급여 정본 §7 의 **재정규화·미측정 스킵·필수 관문·등급 배수**를 앱으로 옮긴다.
 *   여태 앱은 「획득 / 가능」 문자열만 내고 그 다음을 사람이 머리로 계산했다. 정본은 규칙을 전부
 *   명세해 뒀는데 구현이 0이었다 — 그래서 규칙이 있어도 매 시즌 손계산이었고, 손계산은 소리 없이 틀린다.
 *
 * 입력 `항목` = [{이름, 점수(null=미측정), 만점}] · 앱 자동 채점 5항목(90점)만 넣는다.
 *   릴스 5 · 자격 5 는 수동 항목이라 여기 안 들어온다 — 그 둘은 **미측정으로도 안 센다**(0 도 아니다).
 *   ⚠ 그래서 분모의 기준은 100 이 아니라 **넣은 항목의 만점 합**이다. 100 을 박으면 수동 10점이
 *     영원히 미측정으로 잡혀 전 강사가 상시 스킵된다(정본이 말하는 미측정과 다른 것이 섞인다).
 *
 * 정본 규칙 그대로:
 *   · 미측정은 분자에서도 분모에서도 뺀다 — 총점 = 획득 ÷ (만점합 − 미측정 배점) × 100
 *   · 미측정 배점 합 ≥ 30 이면 그 시즌 등급 심사를 건너뛰고 직전 등급 유지(첫 시즌은 브론즈 ×1.0)
 *   · 관문 ① 재등록률 80% 미만 → 골드 불가(첫 시즌엔 승급 통과율 80% 미만으로 대체)
 *   · 관문 ② 근태 3회 이상 위반 → 등급 1단계 강등(총점 무관)
 *   · 관문 ③ 어느 항목이든 0점 → 골드 불가 (미측정은 0점으로 안 센다)
 * ponytail: 직전 등급을 앱이 모른다 — 스킵일 때 등급을 **지어내지 않고** '심사 스킵'으로 낸다. */
const INCENTIVE_SKIP_AT = 30;              // 정본이 「이 판에서 정한 값」이라 밝힌 경계 — 첫 시즌 실측 뒤 조정
const INCENTIVE_GRADES = [                 // 위에서부터 내려오며 처음 걸리는 칸(경계는 이상)
  { 점: 92, 등급: '골드', 배수: 1.3 }, { 점: 82, 등급: '실버', 배수: 1.15 },
  { 점: 70, 등급: '브론즈', 배수: 1.0 }, { 점: 0, 등급: '미달', 배수: 0.5 }];
function incentiveGrade_(항목, 옵션) {
  const o = 옵션 || {};
  const list = (항목 || []).filter(x => x && x.만점 > 0);
  if (!list.length) return { 총점: null, 등급: '', 표기: '' };
  const 미측정 = list.filter(x => x.점수 == null).reduce((a, x) => a + x.만점, 0);
  const 만점합 = list.reduce((a, x) => a + x.만점, 0);
  if (미측정 >= INCENTIVE_SKIP_AT) {
    return { 총점: null, 등급: '', 스킵: true,
      표기: '심사 스킵(미측정 ' + 미측정 + '점' + (o.첫시즌 ? ' · 첫 시즌 = 브론즈 ×1.0' : ' · 직전 등급 유지') + ')' };
  }
  const 획득 = list.filter(x => x.점수 != null).reduce((a, x) => a + x.점수, 0);
  const 총점 = Math.round(획득 * 100 / (만점합 - 미측정));
  let i = INCENTIVE_GRADES.findIndex(g => 총점 >= g.점);
  if (i < 0) i = INCENTIVE_GRADES.length - 1;
  const 막힘 = [];
  /* 관문 ①·③ 은 「골드 불가」라 실버까지 끌어내린다. 미측정은 관문을 발동시키지 않는다 —
   *   0점(재봤는데 못 했다)과 미측정(재지 못했다)은 다르다는 것이 이 표의 관통 원칙이다. */
  const 관문1 = o.첫시즌 ? o.승급률 : o.재등록률;
  if (관문1 != null && 관문1 < 80) 막힘.push(o.첫시즌 ? '승급<80' : '재등록<80');
  if (list.some(x => x.점수 === 0)) 막힘.push('0점 항목');
  if (막힘.length && i === 0) i = 1;
  // 관문 ② 는 총점과 무관한 **강등**이라 위 두 관문 뒤에 따로 적용한다(겹치면 두 칸 내려간다).
  if (o.근태위반 != null && o.근태위반 >= 3) { 막힘.push('근태 3회↑'); i = Math.min(i + 1, INCENTIVE_GRADES.length - 1); }
  const g = INCENTIVE_GRADES[i];
  return { 총점: 총점, 등급: g.등급, 배수: g.배수, 막힘: 막힘,
    표기: 총점 + '점 · ' + g.등급 + ' ×' + g.배수 + (막힘.length ? ' (관문: ' + 막힘.join('·') + ')' : '')
      + (미측정 ? ' · 미측정 ' + 미측정 + '점 제외' : '') };
}
const TEACHER_UNASSIGNED = '(미지정)'; // 담당 강사 매핑이 없는 반의 라벨 접두 — 학생이 조용히 증발하지 않게

// [v9.87] 반명 → 담당 강사명 — 정본 매핑은 teacherEmailMap_.byClass(profiles 강사 행 E열, 쉼표 구분)다.
//   조회 순서 ①반명 정확 일치 ②괄호 주석 제거본('월수 A(9시)' → '월수 A') ③번호 폴백은 강사가 유일할 때만
//   (v8.8 선례 — 번호만 같은 신·구 트랙이 엉뚱한 강사에게 붙는 오매칭 차단).
//   ⚠ byClass는 이메일이 있는 강사 행만 담는다(메일 라우팅용 정본) → 이메일 공란 강사의 반은 (미지정)으로 떨어져
//   teacher_stats에 그대로 보인다. 조용한 누락보다 눈에 보이는 결손이 낫다는 판단(고치는 법 = profiles 강사 행 이메일).
function teachersOfClass_(emap, cls) {
  const raw = String(cls == null ? '' : cls).trim();
  if (!raw) return [];
  const pick = list => { // 같은 강사가 반명 키·번호 키로 두 번 담긴 경우 dedupe(이메일 기준)
    const seen = {}, out = [];
    (list || []).forEach(x => {
      const nm = String((x && x.name) || '').trim();
      if (!nm) return;
      const key = String((x && x.email) || nm);
      if (seen[key]) return;
      seen[key] = 1;
      out.push(nm);
    });
    return out;
  };
  const exact = pick(emap.byClass[raw]);
  if (exact.length) return exact;
  const bare = 반키_(raw);   // [v9.238] 손으로 적던 접기를 공용 통로로 — 한쪽만 바뀌면 조용히 갈라진다(#Q78 실사고)
  if (bare && bare !== raw) {
    const byBare = pick(emap.byClass[bare]);
    if (byBare.length) return byBare;
  }
  const n = classNumOf(raw);
  const byNum = n ? pick(emap.byClass[n]) : [];
  return byNum.length === 1 ? byNum : []; // 번호가 여러 강사로 갈리면 폴백 포기(오귀속보다 미지정이 낫다)
}

/* ── [v9.108] 인센티브 3지표 — 학생 단위 판정 순수 함수 3종 ──────────────────
 * 셋 다 "판정 불가 = null"을 반환한다(false가 아니다). 강사별 합산은 calcTeacherStats가
 * null을 분모에서 빼는 방식으로 처리 — 무데이터가 0%로 둔갑하면 급여가 틀어진다.
 * 시즌 창(8주=ABSENCE_SEASON_DAYS)은 결석 복귀율과 동일 창을 쓴다(등급 심사 주기 일치). */

const REENROLL_GRACE_DAYS = 14; // 만료 후 이 기간이 안 지났으면 재등록 판정 보류(결석 '복귀 유예'와 같은 계급)

// 승급 = 창 이전 마지막 급수 대비 창 내 마지막 급수가 올랐는가.
//   levelRows = [{sid, date:'yyyy-MM-dd', level:Number}] (academic_log 유형 'level'만)
//   기준 급수(창 이전 기록)가 없으면 신규 학생 → 비교 불가라 null(분모 제외).
function promotionByStudent_(levelRows, fromStr, toStr) {
  const agg = {};
  (levelRows || []).forEach(r => {
    const sid = String((r && r.sid) || '').trim();
    const d = String((r && r.date) || '').slice(0, 10);
    const lv = Number(r && r.level);
    if (!sid || !d || !isFinite(lv)) return;
    const o = agg[sid] || (agg[sid] = { base: null, baseD: '', last: null, lastD: '' });
    if (d < fromStr) {                       // 창 이전 — 가장 나중 것이 기준 급수
      if (!o.baseD || d >= o.baseD) { o.baseD = d; o.base = lv; }
    } else if (d <= toStr) {                 // 창 안 — 가장 나중 것이 현재 급수
      if (!o.lastD || d >= o.lastD) { o.lastD = d; o.last = lv; }
    }
  });
  const out = {};
  Object.keys(agg).forEach(sid => {
    const o = agg[sid];
    out[sid] = (o.base == null || o.last == null) ? null : (o.last > o.base);
  });
  return out;
}

// 재등록 = 창 안에 만료된 수강 건이, 만료일 이후 시작하는 후속 등록으로 이어졌는가.
//   rows = [{sid, start:'yyyy-MM-dd', expire:'yyyy-MM-dd'}] (enrollments)
//   만료 후 유예(REENROLL_GRACE_DAYS)가 안 지났고 후속도 없으면 아직 판정하지 않는다(null).
function reenrollByStudent_(rows, fromStr, toStr, todayStr) {
  const bySid = {};
  (rows || []).forEach(r => {
    const sid = String((r && r.sid) || '').trim();
    if (!sid) return;
    (bySid[sid] = bySid[sid] || []).push({
      start: String((r && r.start) || '').slice(0, 10),
      expire: String((r && r.expire) || '').slice(0, 10),
      state: String((r && r.state) || '').trim()
    });
  });
  const out = {};
  Object.keys(bySid).forEach(sid => {
    const list = bySid[sid];
    const due = list.filter(e => e.expire && e.expire >= fromStr && e.expire <= toStr);
    if (!due.length) { out[sid] = null; return; }          // 창 안 만료 없음 = 판정 대상 아님
    const last = due.sort((a, b) => (a.expire < b.expire ? -1 : 1))[due.length - 1];
    // [v9.125] 갱신 인정 2경로 — ① 상태 칸 '갱신'(만료 안내 체계·주간 섹션과 같은 신호. 이것만 적어도 인정)
    //   ② 후속 행 시작일 ≥ 만료일(연속 수강은 같은 날 이어 적는 것이 자연 표기 — 구 '>'는 이 경우를 이탈로 셌다)
    const renewed = last.state === '갱신' || list.some(e => e !== last && e.start && e.start >= last.expire);
    if (renewed) { out[sid] = true; return; }
    out[sid] = daysBetweenStr_(last.expire, todayStr) >= REENROLL_GRACE_DAYS ? false : null; // 유예 중이면 보류
  });
  return out;
}

function daysBetweenStr_(a, b) { // 'yyyy-MM-dd' 두 개의 일수 차(b - a). 파싱 실패는 0.
  const t1 = Date.parse(String(a) + 'T00:00:00Z'), t2 = Date.parse(String(b) + 'T00:00:00Z');
  return (isFinite(t1) && isFinite(t2)) ? Math.round((t2 - t1) / 86400000) : 0;
}

// 학생별 판정({sid: true|false|null})을 강사별 비율로 접는다. null은 분모에서 빠진다.
//   sidsOf = {강사: {sid:1,...}} — 판정이 없는 학생도 분모에 넣지 않는다(미측정 ≠ 실패).
function rateByTeacher_(verdictBySid, sidsOf) {
  const out = {};
  Object.keys(sidsOf || {}).forEach(tn => {
    let tot = 0, hit = 0;
    Object.keys(sidsOf[tn] || {}).forEach(sid => {
      const v = verdictBySid ? verdictBySid[sid] : undefined;
      if (v === true || v === false) { tot++; if (v === true) hit++; }
    });
    out[tn] = { tot: tot, hit: hit, rate: tot ? Math.round(hit * 100 / tot) : null };
  });
  return out;
}

function calcTeacherStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pf = ss.getSheetByName('profiles');
  const last = pf.getLastRow();
  if (last < 2) return [];
  const data = pf.getRange(2, 1, last - 1, 25).getValues();

  // [v9.87] 축 교정 — 구버전은 학생 행의 r[4](class_name)를 그대로 '강사'로 썼다. A열 헤더는 '강사'인데 값은 반명이라
  //   "강사별" 지표가 실은 존재한 적이 없다(승급 통과율·결석 복귀율·재등록률 등 인센티브 지표가 올라탈 축이 통째로 공백).
  //   진짜 매핑은 teacherEmailMap_.byClass(강사 행 E열). 집계 정의(확정):
  //   ① 한 반에 강사 여러 명 = 그 반 전원을 각 강사에게 온전히 귀속. 1인당 지표(출석·포인트·칭찬)가 공동 담당에서도
  //      단독 담당과 같은 척도여야 비교가 되므로 분수 분할하지 않는다 → 담당학생수 합계는 재적을 넘을 수 있다.
  //   ② 한 강사 여러 반 = 담당 반 전체를 한 행으로 합산(인정 편중%만 예외 — 아래 반 단위 최댓값).
  //   ③ 매핑 없는 반 = '(미지정) 반명'으로 반별 1행 유지. 한 줄로 뭉치면 반별 케어 신호가 사라지고, 빼버리면 학생이
  //      조용히 증발한다. 매핑을 채우는 순간 자동으로 강사 행에 접힌다(별도 마이그레이션 없음).
  const emap = teacherEmailMap_(ss);
  const t = {};
  const clsOfT = {};
  const memo = {}; // 반명 → 강사 배열(반복 조회 절감)
  data.forEach(r => {
    if (!r[0] || r[3] !== 'student' || !r[4]) return;
    const rawCls = String(r[4]).trim();
    // [v9.238] 접기는 공용 통로 `반키_`(엔진_셋업확장.js) — `|| rawCls` 폴백은 뜻이 달라 그대로 둔다:
    //   반명이 「(9시)」처럼 괄호로 시작하면 접은 값이 빈 문자열이라, 그때는 원문을 키로 살린다.
    const cls = 반키_(rawCls) || rawCls;
    clsOfT[String(r[0]).trim()] = cls; // [v9.196] 키를 sids와 같은 규칙으로 — 갈라지면 숙제 분모가 조용히 0이 된다
    if (!memo[rawCls]) memo[rawCls] = teachersOfClass_(emap, rawCls);
    const names = memo[rawCls].length ? memo[rawCls] : [TEACHER_UNASSIGNED + ' ' + cls];
    names.forEach(nm => {
      if (!t[nm]) t[nm] = { n: 0, att: 0, pts: 0, praise: 0, cls: {}, sids: {} };
      t[nm].n++;
      t[nm].att += Number(r[21]) || 0;
      t[nm].pts += Number(r[16]) || 0;
      t[nm].praise += Number(r[23]) || 0;
      t[nm].cls[cls] = 1;
      t[nm].sids[String(r[0]).trim()] = 1; // [v9.108] 인센티브 3지표는 학생 단위 판정 → 강사별로 접는다
    });
  });

  // [v7.8→08-20 재정의] 도전·성장 기회 사각 — 강사별 지난달 인정 수 + 편중도. 정원제 폐지로 이 열의 뜻이
  //   «공정하게 돌렸나»(감시)에서 «기회가 안 닿는 아이가 있나»(사각 탐지)로 바뀌었다(판정안 §4 ㉯).
  // [v9.34] 당월→전월 + 병합 읽기 — 매월 1일(monthlyReport) 실행 시점엔 당월 로그 0건 + archiveMonthly가
  //   전월 로그를 이미 아카이브로 옮긴 뒤라, point_logs 단독 당월 집계는 항상 0/0으로 덮여 v7.8 공정성 감지가 무력했음
  const tz8 = ss.getSpreadsheetTimeZone();
  const ym8 = ymShift_(Utilities.formatDate(new Date(), tz8, 'yyyy-MM'), -1); // 전월
  const crownBy = {}; // 반 단위 집계 — 강사 롤업은 아래에서(반 단위가 기회 사각을 읽는 자연스러운 창이다)
  readPointLogs_(ss, 7).forEach(r => { // 병합 읽기(monthlyReport와 동일 패턴) — G열(연월) 기준 전월 필터
    const rs = String(r[3] || ''), pts = Number(r[2]) || 0;
    if (pts <= 0 || rs.indexOf('정정') > -1) return;
    if (rs.indexOf('MVP') === -1 && rs.indexOf('도전') === -1 && rs.indexOf('시냅스') === -1 && rs.indexOf('성장') === -1) return;
    if (String(r[6]) !== ym8) return;
    const cl = clsOfT[r[1]];
    if (!cl) return;
    if (!crownBy[cl]) crownBy[cl] = { tot: 0, bySid: {} };
    crownBy[cl].tot++;
    crownBy[cl].bySid[r[1]] = (crownBy[cl].bySid[r[1]] || 0) + 1;
  });
  /* ── [v9.108] 인센티브 3지표 — 시즌 창(8주 = ABSENCE_SEASON_DAYS, 등급 심사 주기와 동일).
   *   세 지표 모두 시트가 없거나 비어 있으면 조용히 건너뛴다(빈칸=미측정). 개원 전 로스터가 비어도
   *   케어지수 계산 자체는 계속 돌아야 하므로 지표별로 격리한다 — 한 시트의 부재가 전체를 죽이면 안 된다. */
  const todayS = Utilities.formatDate(new Date(), tz8, 'yyyy-MM-dd');
  const fromS = Utilities.formatDate(new Date(Date.now() - ABSENCE_SEASON_DAYS * 86400000), tz8, 'yyyy-MM-dd');
  const sidsOf = {};
  Object.keys(t).forEach(k => { sidsOf[k] = t[k].sids; });

  let promoBy = {};   // ① 승급 통과율 — academic_log 유형 'level'(급수 1~6, 강사 월 1회 입력)
  try {
    const ac = ss.getSheetByName('academic_log');
    if (ac && ac.getLastRow() >= 2) {
      const lv = ac.getRange(2, 1, ac.getLastRow() - 1, 7).getValues()
        .filter(r => String(r[3] || '').trim() === 'level')
        .map(r => ({ sid: String(r[1] || '').trim(), date: dstr(r[2], tz8), level: Number(r[4]) }));
      promoBy = rateByTeacher_(promotionByStudent_(lv, fromS, todayS), sidsOf);
    }
  } catch (ePr) { Logger.log('승급 통과율 스킵: ' + ePr); }

  const absBy = {};   // ② 결석 복귀율 — 정본은 absenceReturnStats_(v9.89). 규칙 중복 없이 그대로 재사용한다.
  try {              //    담당강사 칸이 '김·박'처럼 복수면 각자에게 온전 귀속(v9.87 공동 담당 규칙과 동일 —
    const af = ss.getSheetByName('absence_followup'); //  두 지표가 다른 귀속 규칙을 쓰면 강사별 합산이 어긋난다).
    if (af && af.getLastRow() >= 2) {
      const st = absenceReturnStats_(af.getRange(2, 1, af.getLastRow() - 1, ABSENCE_FOLLOWUP_HEADERS.length).getValues(), fromS, todayS);
      Object.keys(st).forEach(key => {
        const o = st[key];
        String(key).split('·').map(s => s.trim()).filter(Boolean).forEach(nm => {
          const a = absBy[nm] || (absBy[nm] = { judged: 0, ret: 0 });
          a.judged += o.judged; a.ret += o.ret;
        });
      });
      // [v9.125] 담당 미배정 버킷은 강사 행에 절대 매칭되지 않아 조용히 증발한다 — 최소한 로그로 남긴다.
      //   (주간 리포트 결석 섹션에는 보이는데 teacher_stats엔 없는 「두 화면 불일치」의 원인 표식)
      if (absBy['(담당 미배정)'] && absBy['(담당 미배정)'].judged) {
        Logger.log('⚠ 결석 복귀 판정 ' + absBy['(담당 미배정)'].judged + '건이 담당 미배정 — teacher_stats 어느 행에도 실리지 않음(profiles 강사 행 이메일 확인)');
      }
    }
  } catch (eAb) { Logger.log('결석 복귀율 스킵: ' + eAb); }

  let reBy = {};      // ③ 재등록률 — enrollments(유호님 수기 시트). 만료 후 유예 중이면 판정 보류(null).
  try {
    const en = ss.getSheetByName('enrollments');
    if (en && en.getLastRow() >= 2) {
      const er = en.getRange(2, 1, en.getLastRow() - 1, 8).getValues()
        .map(r => ({ sid: String(r[0] || '').trim(), start: dstr(r[2], tz8), expire: dstr(r[4], tz8), state: String(r[5] || '').trim() })); // [v9.125] F열 상태 — '갱신' 표기 인정
      reBy = rateByTeacher_(reenrollByStudent_(er, fromS, todayS, todayS), sidsOf);
    }
  } catch (eRe) { Logger.log('재등록률 스킵: ' + eRe); }

  /* [v9.196] 시즌 창의 날짜·요일 — 아래 두 지표가 같은 창을 본다. **오늘은 뺀다**: 근태는 하루 단위 판정이라
   *   아직 안 끝난 날을 세면 매일 오전마다 전 강사가 결근이 된다(숙제는 오늘을 넣어도 분모만 늘어 손해라 같이 뺀다).
   *   요일 판정은 `classDowOk_` 하나만 쓴다 — 여기 요일을 다시 적으면 주말반 규칙이 갈라진다.
   * ponytail: 요일은 스크립트 시계(`getDay`)로, 날짜 문자열은 시트 시간대로 낸다 — 이 파일이 이미 쓰는 짝이고
   *   둘이 다르면 하루 밀린다. 갈라지면 시트 시간대를 스크립트에도 맞춘다(프로젝트 설정 1칸). */
  const 시즌날 = [];
  for (let i = 1; i <= ABSENCE_SEASON_DAYS; i++) {
    const d = new Date(Date.now() - i * 86400000);
    시즌날.push({ day: Utilities.formatDate(d, tz8, 'yyyy-MM-dd'), dow: d.getDay() });
  }
  /* 분자도 이 창을 쓴다 — 위쪽 3지표의 fromS·todayS 는 **오늘을 포함**하는 다른 축이라, 그걸 분자에
   *   쓰면 오늘치 제출은 세면서 오늘은 분모에 없어 비율이 부푼다(구간 임계를 넘길 수 있다). */
  const 창시작 = 시즌날[시즌날.length - 1].day, 창끝 = 시즌날[0].day;
  const 수업일캐시 = {};
  const 시즌수업일_ = tp => (수업일캐시[tp] != null ? 수업일캐시[tp]
    : (수업일캐시[tp] = 시즌날.filter(x => classDowOk_(tp, x.dow)).length));
  /* 시간표는 두 지표가 함께 쓰는 재료라 한 번만 읽고, 실패도 여기서 격리한다 —
   *   지표 하나의 사고가 케어지수까지 죽이면 안 된다는 것이 이 구역의 관통 원칙이다. */
  let smap = {};
  try { smap = scheduleMap(ss); } catch (eSc) { Logger.log('시간표 읽기 스킵: ' + eSc); }

  /* [v9.196] ④ 숙제 제출률 — 유호 확정 2026-08-08 「릴스·자격 외 전부 자동화」의 남은 두 칸 중 하나.
   *   분자 = hw_feedback 의 **서로 다른 (학생, 제출일) 쌍**(첨삭 행 = 제출의 증거 · 엔진_수집 최근카운트와 같은 읽기).
   *   분모 = 담당 학생 각각의 **그 반 시즌 수업일 수**(schedule 요일유형에서 유도 — 새 입력 0).
   *   ⚠ 이 분모 정의는 **정본 §7 에 없다**. §7 은 「가능(학생 제출 기준)」까지만 적었고 v9.194 가 그래서
   *     미측정으로 뒀다. v9.113 이 배점을 그렇게 뒀던 자리와 같은 처지라, 정본이 채울 때까지 이 파일이 정본이다.
   * ponytail: 수업일 밖 제출(주말 보충)도 분자에 세므로 비율이 100 을 넘을 수 있다 — 자르지 않는다.
   *   자르면 「많이 냈다」와 「딱 맞췄다」가 같아지고, 원수치는 지표모수 칸이 그대로 말한다. */
  const hwBy = {};
  try {
    const fb = ss.getSheetByName('hw_feedback');
    const 제출 = {};
    let 원천 = 0;                                  // 창 안의 쓸 만한 행 수 — 0이면 **잰 적이 없다**
    if (fb && fb.getLastRow() >= 2) {
      const seen = {};
      /* [v9.199] 🔴 강의 한줄요약 행은 **숙제 제출이 아니다.** v9.198 이 그 요약을 같은 `hw_feedback` 에
       *   `숙제ID` = `강의:<강의ID>` 로 적는데(새 시트를 안 파는 것이 그 판정이었다), 이 집계는 A:C 만
       *   읽어 그 접두를 **못 본다**. 그러면 숙제만 안 낸 날의 요약 한 건이 제출로 세어져 제출률 →
       *   인센티브 점수 → **급여**까지 부풀린다(이종 검수 2회차가 독립으로 같은 자리를 짚었다).
       * ⚠ 폭은 **물리 열수로 클램프**한다 — 구 시트(11열)에서 12열을 무조건 요구하면 이 집계가 통째로
       *   죽는다. v9.198 이 자기 대기줄에서 겪은 형태 그대로라, 같은 실수를 반대편에서 반복하지 않는다.
       *   좁은 시트에선 접두 칸이 없어 `''` 이 되고 아무 행도 안 걸린다 — 그 시트엔 강의 행 자체가 없다. */
      const 강의열 = HW_FEEDBACK_HEADERS.indexOf('숙제ID');
      const 폭 = Math.min(강의열 + 1, fb.getLastColumn());
      fb.getRange(2, 1, fb.getLastRow() - 1, 폭).getValues().forEach(r => {
        if (String(r[강의열] == null ? '' : r[강의열]).indexOf(LECTURE_SRC_PREFIX) === 0) return;
        const sid = String(r[1] || '').trim(), d = dstr(r[2], tz8);
        if (!sid || !d || d < 창시작 || d > 창끝 || seen[sid + '|' + d]) return;
        seen[sid + '|' + d] = 1;
        원천++;
        제출[sid] = (제출[sid] || 0) + 1;
      });
    }
    /* 🔑 원천이 통째로 비면 **미측정**이다 — 근태의 「출근 기록 0 = 미측정」과 같은 규칙이다.
     *   여기서 안 막으면 `0 / 80` = 0% 가 나오고 `homeworkScore_(0)` 은 그걸 **잰 0점**으로 읽는다.
     *   개원 전이 정확히 그 상태라(hw_feedback 빈 시트) 전 강사가 즉시 0점 + 관문 ③(0점 항목) 발동이다.
     *   「내 학생만 0건」은 반대로 진짜 0% 다(시트에 남의 행이 있다) — 그래서 판정 단위가 원천이다. */
    if (원천) Object.keys(t).forEach(nm => {
      let sub = 0, exp = 0;
      Object.keys(t[nm].sids).forEach(sid => {
        const s = schedOf(smap, clsOfT[sid]);
        if (!s) return;  // 시간표에 없는 반 = 기대 제출 수를 못 센다 → 그 학생만 분모에서 빠진다(전체는 계속 잰다)
        exp += 시즌수업일_(s.type);
        sub += 제출[sid] || 0;
      });
      hwBy[nm] = { sub: sub, exp: exp, rate: exp ? Math.round(sub * 100 / exp) : null };
    });
  } catch (eHw) { Logger.log('숙제 제출률 스킵: ' + eHw); }

  /* [v9.196] ⑤ 근태 위반 건수 — 강사 **근무표를 담당 반 시간표에서 유도한다**(별도 근무표 입력 0).
   *   그날 담당 반의 첫 수업 시작 시각보다 늦은 출근 = 지각 · 수업 있는 날 출근 기록 0 = 결근. 둘 다 1건.
   *   원천 = teacher_checkins(이름·구분·시각 · 열 순서는 TC_* 상수).
   *   ⚠ 이 정의도 정본 §7 에 없다(정본은 「무위반/1회/2회/3회 이상」 구간만 준다).
   * 🔑 **출근 기록이 창 안에 하나도 없는 강사는 미측정(null)이다 — 전원 결근으로 읽지 않는다.**
   *   이름 표기가 profiles 와 어긋나기만 해도 위반 40건이 되고, 그 순간 관문 ②(3회↑ 강등)와 ③(0점 항목)이
   *   함께 터져 앱 결함이 그대로 급여 삭감이 된다. 「못 잰 것을 0으로 환산하지 않는다」(v9.89 원칙)의 최대 위험처. */
  const puBy = {};
  try {
    const tc = ss.getSheetByName('teacher_checkins');
    const 출근 = {};
    if (tc && tc.getLastRow() >= 2) {
      tc.getRange(2, 1, tc.getLastRow() - 1, 3).getValues().forEach(r => {
        const nm = String(r[TC_NAME_COL - 1] || '').trim(), v = r[TC_TIME_COL - 1];
        if (!nm || !v || String(r[TC_TYPE_COL - 1] || '').indexOf('출근') === -1) return;
        const d = asDate_(v);
        if (isNaN(d.getTime())) return;   // 깨진 시각 **한 행**이 formatDate 예외 → catch → 전 강사 미측정이 된다
        const day = Utilities.formatDate(d, tz8, 'yyyy-MM-dd');
        if (day < 창시작 || day > 창끝) return;
        const hm = Utilities.formatDate(d, tz8, 'HH:mm');
        const m = 출근[nm] || (출근[nm] = {});
        if (!m[day] || hm < m[day]) m[day] = hm;  // 하루 여러 번 찍으면 가장 이른 것 — 연타 정정(v9.127)과 같은 규칙
      });
    }
    Object.keys(t).forEach(nm => {
      const rec = 출근[nm];
      if (!rec) return;                         // 미측정 — 위 🔑
      const 첫수업 = {};                            // 요일 → 그날 담당 반 중 가장 이른 수업 'HH:mm'
      Object.keys(t[nm].cls).forEach(cn => {
        const s = schedOf(smap, cn);
        if (!s || !s.time) return;
        for (let dw = 0; dw < 7; dw++) {
          if (!classDowOk_(s.type, dw)) continue;
          if (!첫수업[dw] || s.time < 첫수업[dw]) 첫수업[dw] = s.time;
        }
      });
      let 위반 = 0, 근무일 = 0;
      시즌날.forEach(x => {
        const 시작 = 첫수업[x.dow];
        if (!시작) return;                          // 담당 수업이 없는 날 = 근무일이 아니다
        근무일++;
        const 찍은 = rec[x.day];
        if (!찍은 || 찍은 > 시작) 위반++;
      });
      if (근무일) puBy[nm] = { 위반: 위반, 근무일: 근무일 };
    });
  } catch (ePu) { Logger.log('근태 스킵: ' + ePu); }

  /* [v9.194] 개원 첫 시즌인가 — **설정값이 아니라 데이터에서 유도한다.** 정본이 첫 시즌 표를 따로 둔
   *   이유가 「재등록할 이전 시즌이 없다」 하나이므로, 재등록을 판정할 수 있는 강사가 한 명도 없으면
   *   그것이 곧 첫 시즌이다. 스위치를 두면 시즌이 바뀔 때 아무도 안 내려서 표가 조용히 낡는다.
   * ponytail: enrollments 가 비어 있을 뿐인 경우도 첫 시즌으로 읽는다 — 그래도 결론은 같다
   *   (재등록 미측정 30점 ≥ 경계라 어차피 심사 스킵으로 떨어진다). 갈릴 때 손해가 안 나는 쪽이다. */
  const 첫시즌 = !Object.keys(reBy).some(x => reBy[x] && reBy[x].rate != null);
  const pmFn = r => promotionScore_(r, 첫시즌), abFn = r => absenceReturnScore_(r, 첫시즌);
  const hwFn = r => homeworkScore_(r, 첫시즌), puFn = n => punctualityScore_(n, 첫시즌);

  const rows = Object.keys(t).map(k => {
    const v = t[k];
    const perAtt = v.att / v.n, perPts = v.pts / v.n, perPraise = v.praise / v.n;
    const clsList = Object.keys(v.cls).sort();
    const pm = promoBy[k] || { tot: 0, rate: null };
    const ab = absBy[k] || { judged: 0, ret: 0 };
    const abRate = ab.judged ? Math.round(ab.ret * 100 / ab.judged) : null;
    const abScore = abFn(abRate); // 급여 정본 §7 배점 — 셋 중 유일하게 처음부터 문서 근거가 있던 것
    const re = reBy[k] || { tot: 0, rate: null };
    const pmScore = pmFn(pm.rate), reScore = 첫시즌 ? null : reenrollScore_(re.rate);
    /* [v9.196] 숙제·근태 — v9.194 는 분모 정의가 정본에 없어 미측정으로 뒀는데, 유호 확정 08-08
     *   「릴스·자격 외 전부 자동화」가 그 판단을 뒤집었다: 정의를 이 파일이 지고 근거를 위 두 블록 주석에
     *   남긴다. 못 잰 경우(시간표 없는 반뿐 / 출근 기록 0)는 여전히 null 로 떨어져 등급 판정이 분모에서 뺀다. */
    const hw = hwBy[k] || null, pu = puBy[k] || null;
    const hwRate = hw ? hw.rate : null, 근태위반 = pu ? pu.위반 : null;
    const hwScore = hwFn(hwRate), puScore = puFn(근태위반);
    // [v9.87] 인정 총계 = 담당 반 합산 / 편중% = 반 단위 최댓값(가장 쏠린 반). 여러 반 학생을 한 통에 섞으면
    //   한 반의 100% 쏠림이 반 수만큼 희석돼 60% 경보가 죽는다 — 기회 사각을 읽는 단위도 반이다(08-20 재정의).
    let tot = 0, worst = 0;
    clsList.forEach(cn => {
      const cb = crownBy[cn];
      if (!cb || !cb.tot) return;
      tot += cb.tot;
      let mx = 0;
      Object.keys(cb.bySid).forEach(s => { if (cb.bySid[s] > mx) mx = cb.bySid[s]; });
      const share = Math.round(mx * 100 / cb.tot);
      if (share > worst) worst = share;
    });
    return [k, v.n, Number(perAtt.toFixed(1)), Number(perPts.toFixed(1)),
            Number(perPraise.toFixed(1)),
            Math.round(perAtt * 12 + perPts * 1), // [v7.9] 시냅스(반당 1명) 체제에서 praise 변별력 소멸 — 출석 중심 재조정
            tot, worst, clsList.join(', '),
            // [v9.108] 인센티브 지표 — 미측정은 빈칸(0%가 아니다). 분모는 '지표모수'에 그대로 노출한다.
            pm.rate == null ? '' : pm.rate, pmScore == null ? '' : pmScore,
            abRate == null ? '' : abRate,   abScore == null ? '' : abScore,
            re.rate == null ? '' : re.rate, reScore == null ? '' : reScore,
            hwRate == null ? '' : hwRate,   hwScore == null ? '' : hwScore,
            근태위반 == null ? '' : 근태위반, puScore == null ? '' : puScore,
            // [v9.193] 점수와 **그 점수를 낸 함수**를 짝으로 넘긴다 — 분모(만점)를 여기서 따로 적으면
            //   배점표가 바뀔 때 이 줄만 낡는다(정본 v1.6 재등록 30점이 정확히 그렇게 새던 자리다).
            //   [v9.194] 첫 시즌엔 재등록 항목이 **사라진다**(0점이 아니라 없다) — 짝에서 통째로 뺀다.
            incentiveTotal_([[pmScore, pmFn], [abScore, abFn], [hwScore, hwFn], [puScore, puFn]]
              .concat(첫시즌 ? [] : [[reScore, reenrollScore_]])),
            // [v9.194] 등급 판정 — 재정규화·미측정 스킵·필수 관문을 정본 §7 그대로 앱이 낸다.
            incentiveGrade_([{ 이름: '승급', 점수: pmScore, 만점: pmFn(100) },
                             { 이름: '복귀', 점수: abScore, 만점: abFn(100) },
                             { 이름: '숙제', 점수: hwScore, 만점: hwFn(100) },
                             { 이름: '근태', 점수: puScore, 만점: puFn(0) }]
              .concat(첫시즌 ? [] : [{ 이름: '재등록', 점수: reScore, 만점: reenrollScore_(100) }]),
            { 첫시즌: 첫시즌, 재등록률: re.rate, 승급률: pm.rate, 근태위반: 근태위반 }).표기,
            // [v9.196] 숙제·근태 모수도 같이 편다 — "80%"가 몇 분의 몇인지 원장이 바로 판별하는 칸이고,
            //   두 지표는 분모 정의가 정본 밖이라 더더욱 원수치가 보여야 한다(근태는 분모가 근무일 수).
            '승급 ' + pm.tot + ' · 복귀 ' + ab.judged + ' · 재등록 ' + re.tot
              + ' · 숙제 ' + (hw ? hw.sub + '/' + hw.exp : '미측정') + ' · 근태 ' + (pu ? pu.근무일 + '일' : '미측정')
              + (첫시즌 ? ' · 첫 시즌(재등록 항목 없음)' : '')];
  }).sort((a, b) => b[5] - a[5]);

  const ts = ensureSheet(ss, 'teacher_stats', TEACHER_STATS_HEADERS);
  const W = TEACHER_STATS_HEADERS.length;
  if (ts.getMaxColumns() < W) ts.insertColumnsAfter(ts.getMaxColumns(), W - ts.getMaxColumns()); // 물리 그리드 부족 시 Range 예외로 주간 배치가 죽는다
  // [v9.87] ensureSheet는 '시트가 없을 때만' 헤더를 쓴다 — 살아있는 시트의 헤더 보정은 여기서 한다
  //   (구 v7.8·v9.34 개별 셀 보정 2줄을 정본 배열 대조 1블록으로 흡수 — 열이 늘어도 자동으로 따라온다).
  const hdr = ts.getRange(1, 1, 1, W).getValues()[0];
  if (TEACHER_STATS_HEADERS.some((h, i) => String(hdr[i] || '') !== h)) ts.getRange(1, 1, 1, W).setValues([TEACHER_STATS_HEADERS]);
  const tsLast = ts.getLastRow();
  // [v9.87] 라벨 축이 반명 → 강사명으로 바뀌면 첫 실행에서 행 수가 줄어든다(반 15 → 강사 6). 꼬리 정리가 곧 마이그레이션 —
  //   안 지우면 구 반명 행이 강사인 척 그대로 남는다. 전량 재계산이라 별도 이관 절차는 필요 없다.
  if (tsLast - 1 > rows.length) ts.getRange(rows.length + 2, 1, tsLast - 1 - rows.length, W).clearContent();
  if (rows.length) writeIfChanged(ts, 2, 1, rows);
  return rows;
}

/* ===================== 월말 경영 리포트 ===================== */

// [v9.47·C9] 경영 보고 단일화 — 본문은 buildExecReport_(경영 월보)에 전부 흡수됐다(재적·활성률·포인트
//   발행/사용·TOP3·반 온도·이탈·강사 케어지수·인사이트 → 월보 1통). 1일 07시 트리거(monthlyReportJob)는
//   그대로 두되 이 위임이 월보 멱등 키('경영리포트발송_ym')에 걸려 조용히 통과 — 05시 월간 배치가 이미
//   발간한 달엔 아무것도 다시 보내지 않는다(원장 월간 수신 = 정확히 1통).
function monthlyReport() { return buildExecReport_(); }

/* ===================== 월별 아카이빙 (잔액 보존) ===================== */

function archiveMonthly() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const thisMonth = Utilities.formatDate(new Date(), tz, 'yyyy-MM');
  const lock = LockService.getScriptLock();
  lock.waitLock(60000);
  try {
    const pl = ss.getSheetByName('point_logs');
    const plLast = pl.getLastRow();
    if (plLast < 2) return;

    const arc = ensureSheet(ss, 'point_logs_archive',
      ['log_id','student_id','points','reason','given_by','created_at','연월','태그']); // [v9.31] H열(태그) 보존 — 8열
    const co = ensureSheet(ss, 'carryover', ['student_id', 'points']);
    if (co.getRange(1, 3).getValue() !== 'earned') co.getRange(1, 3).setValue('earned'); // [v7.1]

    const carry = {}; // [v7.1] {n: 잔액, e: 획득 누계}
    if (co.getLastRow() >= 2) {
      co.getRange(2, 1, co.getLastRow() - 1, 3).getValues().forEach(r => {
        if (!r[0]) return;
        const n = Number(r[1]) || 0;
        carry[r[0]] = { n: n, e: (r[2] !== '' && r[2] !== null && r[2] !== undefined) ? (Number(r[2]) || 0) : n };
      });
    }
    const data = pl.getRange(2, 1, plLast - 1, 8).getValues(); // [v9.31] 8열(H=태그 포함) — 태그 유실·오배치 방지
    const keep = [], move = [];
    data.forEach(r => {
      const ym = String(r[6]);
      if (ym && ym < thisMonth) {
        move.push(r);
        if (r[1]) {
          if (!carry[r[1]]) carry[r[1]] = { n: 0, e: 0 };
          const p = Number(r[2]) || 0;
          carry[r[1]].n += p;
          if (p > 0 || String(r[3]).indexOf('정정') > -1) carry[r[1]].e += p; // [v7.1]
        }
      } else keep.push(r);
    });
    if (move.length === 0) { Logger.log('아카이빙 대상 없음'); return; }

    arc.getRange(arc.getLastRow() + 1, 1, move.length, 8).setValues(move);
    pl.getRange(2, 1, data.length, 8).clearContent(); // 8열 클리어 — 남은 태그가 다음 행에 밀려붙는 오배치 차단
    if (keep.length) pl.getRange(2, 1, keep.length, 8).setValues(keep);
    /* [v9.244 · #Q100] **의도한 축소이므로 기준선도 내린다** — point_logs 가 수집 표식을 받은 순간
     *   이 월간 아카이빙은 「수집 장부가 줄었다」의 발원지가 된다. 우리가 시킨 이동이라 따를 처방이
     *   없는 경보다(F103). 행을 지우는 자리는 전수로 셋뿐이고(데모 퇴장 `wipe` · 음성 철회
     *   `교재연동.js` · 여기), 셋 다 **그 자리에서** 내린다 — 목록을 따로 두면 갈라진다. */
    if (move.length) 탭수축기준선지움_('point_logs');

    const coOut = Object.keys(carry).map(k => [k, carry[k].n, carry[k].e]); // [v7.1]
    if (co.getLastRow() > 1) co.getRange(2, 1, co.getLastRow() - 1, 3).clearContent();
    if (coOut.length) co.getRange(2, 1, coOut.length, 3).setValues(coOut);

    pruneAppState(ss, thisMonth);
    Logger.log('아카이빙: ' + move.length + '건, 이월 ' + coOut.length + '명');
  } finally { lock.releaseLock(); }
  calcAll();
}

// app_state에서 오래된 미등원 키 정리
function pruneAppState(ss, thisMonth) {
  const st = ss.getSheetByName('app_state');
  if (!st || st.getLastRow() < 2) return;
  const data = st.getRange(1, 1, st.getLastRow(), 2).getValues();
  const kept = data.filter((r, i) => {
    if (i === 0) return true; // 헤더
    const k = String(r[0]);
    if (!k) return false;
    if (k.startsWith('미등원_')) return k.substring(4, 11) === thisMonth; // 이번달만 유지
    return true;
  });
  st.getRange(1, 1, data.length, 2).clearContent();
  st.getRange(1, 1, kept.length, 2).setValues(kept);
}

/* ===================== 월간 게임 배치 (칭호·스냅샷·스토리) ===================== */

function monthlyGameBatch() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const ym = ymShift_(Utilities.formatDate(now, tz, 'yyyy-MM'), -1); // [v9.34] 월키 TZ 단일화 — 혼용 시 ym이 밀려 완료월 가드에 걸려 그달 칭호·스냅샷이 통째 증발
  const lastMonthDate = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1); // 달력 산술용(연·월 필드만 사용)

  // [v7.5] 월 1회 강제 — 재실행 시 출석정산·칭호보너스 중복 지급 원천 차단
  const stG5 = ss.getSheetByName('app_state');
  if (stG5 && String(getState(stG5, '게임배치완료월').val) === ym) {
    Logger.log('게임배치: ' + ym + ' 이미 완료 — 스킵 (재실행하려면 app_state 키 삭제)');
    return;
  }

  // 중복 실행 방지
  const snap = ensureSheet(ss, 'monthly_snapshot', ['월', 'student_id', '월간포인트', '랭킹']);
  ymTextColFix_(snap, 1, tz); // [v9.97] 월 열 Date 오염 → 멱등 가드 무력화(게임배치 재실행) 차단
  if (snap.getLastRow() >= 2) {
    const done = snap.getRange(2, 1, snap.getLastRow() - 1, 1).getValues()
      .some(r => ymTextOf_(r[0], tz) === ym);
    if (done) { Logger.log(ym + ' 게임배치 이미 완료 — 스킵'); return; }
  }

  const logs = readPointLogs_(ss, 7) // [v9.22] 병합 읽기 헬퍼
    .filter(r => String(r[6]) === ym && r[1]);

  const mPts = {}, praiseCnt = {}, hwCnt = {}, spkCnt = {}; // [v5.1] ([v5.2] storeUse 제거)
  logs.forEach(r => {
    const sid = r[1], p = Number(r[2]) || 0;
    const rs = String(r[3]);
    if (p > 0 || rs.indexOf('정정') > -1) mPts[sid] = (mPts[sid] || 0) + p; // [v7.1] 획득 기준
    if ((rs.indexOf('시냅스') > -1 || rs.indexOf('성장') > -1) && rs.indexOf('정정') === -1) praiseCnt[sid] = (praiseCnt[sid] || 0) + 1; // [v7.6] 오늘의 시냅스 최다
    if (rs.indexOf('숙제') > -1 && rs.indexOf('정정') === -1) hwCnt[sid] = (hwCnt[sid] || 0) + 1; // [v7.5]
    if ((rs.indexOf('MVP') > -1 || rs.indexOf('도전') > -1) && rs.indexOf('정정') === -1) spkCnt[sid] = (spkCnt[sid] || 0) + 1; // [v7.4] 정정 제외
  });

  const pf = ss.getSheetByName('profiles');
  const pfLast = pf.getLastRow();
  if (pfLast < 2) return;
  const pfData = pf.getRange(2, 1, pfLast - 1, 26).getValues();
  const students = pfData.filter(r => r[0] && r[3] === 'student');
  const clsOf = {}, nameOf = {}, regOf = {};
  students.forEach(r => {
    clsOf[r[0]] = r[4] || '';
    nameOf[r[0]] = r[1];
    regOf[r[0]] = r[11];
  });

  // 랭킹 (0P 이하 = 999)
  const ranked = students.map(r => ({ id: r[0], m: mPts[r[0]] || 0 }))
    .sort((a, b) => b.m - a.m);
  const rank = {};
  ranked.forEach((s, i) => {
    if (s.m <= 0) { rank[s.id] = 999; return; }
    rank[s.id] = (i > 0 && s.m === ranked[i-1].m) ? rank[ranked[i-1].id] : i + 1;
  });

  // 전월 스냅샷
  const prevYm = ymShift_(ym, -1); // [v9.34] 월키 TZ 단일화
  const prevPts = {}, prevRank = {};
  if (snap.getLastRow() >= 2) {
    snap.getRange(2, 1, snap.getLastRow() - 1, 4).getValues().forEach(r => {
      if (String(r[0]) === prevYm) {
        prevPts[r[1]] = Number(r[2]) || 0;
        prevRank[r[1]] = Number(r[3]) || 999;
      }
    });
  }

  // 출석 (지난달)
  const at = ss.getSheetByName('attendance');
  const attDays = {}, lateCnt = {};
  if (at.getLastRow() >= 2) {
    at.getRange(2, 1, at.getLastRow() - 1, 4).getValues().forEach(r => {
      const sid = r[1]; const d = r[2];
      if (!sid || !d) return;
      const ds = dstr(d, tz);
      if (!ds.startsWith(ym)) return;
      if (!attDays[sid]) attDays[sid] = new Set();
      attDays[sid].add(ds);
      if (String(r[3]).indexOf('지각') > -1) lateCnt[sid] = (lateCnt[sid] || 0) + 1;
    });
  }

  const anyLate = Object.keys(lateCnt).length > 0; // [v5.1] 지각 기록이 있는 달만 지각 제로 수여

  // 수업일 리스트 (반 유형 + 등록일 반영)
  const schMap = scheduleMap(ss);
  const y = lastMonthDate.getFullYear(), mIdx = lastMonthDate.getMonth();
  const daysInMonth = new Date(y, mIdx + 1, 0).getDate();
  function parseReg(v) { return toDate_(v); } // [opt] toDate_로 일원화 (동작 동일 + isNaN 가드)
  function schedDaysOf(sid) {
    const eG = schedOf(schMap, clsOf[sid]); // [v8.3]
    const type = eG ? eG.type : '평일';
    const reg = parseReg(regOf[sid]);
    const list = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(y, mIdx, d);
      if (!classDowOk_(type, dt.getDay())) continue; // [v9.46] 주말반=토요일만 — 일요일 포함 리스트가 개근왕을 불가능하게 만들던 것 해소
      if (reg && dt < reg) continue;
      list.push(ym + '-' + ('0' + d).slice(-2));
    }
    return list;
  }
  function schedRun(sid, list) { // 수업일 기준 최장 연속 출석
    const set = attDays[sid];
    if (!set) return 0;
    let best = 0, run = 0;
    list.forEach(ds => {
      if (set.has(ds)) { run++; best = Math.max(best, run); }
      else run = 0;
    });
    return best;
  }

  // 레이드 주차/참여
  const rd = ss.getSheetByName('raid');
  const raidWeeks = new Set();
  if (rd && rd.getLastRow() >= 2) {
    rd.getRange(2, 1, rd.getLastRow() - 1, 1).getValues().forEach(r => {
      const wk = dstr(r[0], tz);
      if (wk.startsWith(ym)) raidWeeks.add(wk);
    });
  }
  const weekPos = {};
  logs.forEach(r => {
    const sid = r[1], p = Number(r[2]) || 0, d = r[5];
    if (p <= 0 || !d) return;
    const dd = asDate_(d);
    const mon = new Date(dd);
    mon.setDate(dd.getDate() - ((dd.getDay() + 6) % 7));
    const wk = Utilities.formatDate(mon, tz, 'yyyy-MM-dd');
    if (!weekPos[sid]) weekPos[sid] = new Set();
    weekPos[sid].add(wk);
  });

  // ---- 칭호 산출 ----
  const won = {};
  function give(sid, t) { if (!won[sid]) won[sid] = []; won[sid].push(t); }

  const runBySid = {}, daysBySid = {};
  students.forEach(r => {
    const sid = r[0];
    const list = schedDaysOf(sid);
    const days = attDays[sid] ? [...attDays[sid]].filter(ds => list.indexOf(ds) > -1).length : 0;
    const run = schedRun(sid, list);
    runBySid[sid] = run;
    daysBySid[sid] = days; // [v7.1] 출석 정산용
    const eG2 = schedOf(schMap, clsOf[sid]); // [v8.3]
    const type = eG2 ? eG2.type : '평일';

    if (list.length >= 4 && days >= list.length) give(sid, '🌟 하루도 안 빠진 달'); // [08-27] 구 「개근왕」
    if (anyLate && days > 0 && !(lateCnt[sid] > 0)) give(sid, '⏰ 지각 제로'); // [v5.1]
    if (run >= (type === '주말' ? 4 : 5)) give(sid, '🔥 불꽃 출석러');
    if (raidWeeks.size > 0 && weekPos[sid] &&
        [...raidWeeks].every(wk => weekPos[sid].has(wk))) give(sid, '🤝 레이드 개근'); // [08-27] 구 「⚔️ 레이드 영웅」
  });
  /* [08-27 유호 지시] 🚫 «1등 시상» 칭호 일곱을 걷었다 — 「비교하는거 최대한 없애자 ·
   *   일반적으로 과제 점수로 분류하는 랭킹 시스템은 전부 삭제해줘」.
   * 걷어낸 것(전부 «남을 이겨야» 받는 것이었다):
   *   💝 정성왕(칭찬 최다 1등) · 📚 숙제왕(숙제 최다 1등) · 🌟 이달의 스타(MVP 최다 1등)
   *   🧠 시냅스 챔피언(월간 포인트 «전교 1위») · 🚀 로켓 성장(성장률 1등)
   *   🐎 다크호스(순위 5계단 상승 — 순위를 없앴으니 계산 자체가 불가) · 🏋️ 우리 반 캐리(반 1등)
   * 🔑 남긴 넷은 전부 «자기 기준»이다 — 하루도 안 빠진 달 · 지각 제로 · 불꽃 출석러 · 레이드 개근.
   *   남이 어떻든 내가 해내면 받는다. 08-20 확정(「기준 충족 전원」)과 같은 결이다.
   * ⏳ 유호님이 「숙제를 열심히 해서 점수가 높은 랭킹은 이해 된다」고 하셨다 — 그것은 «1등»이 아니라
   *   «그 달 낼 숙제를 다 낸 전원»이어야 하고 분모(그 달 숙제 수)를 새로 세야 하므로 별개 설계다.
   *   지금 짓지 않는다 — 없는 것을 있는 척하지 않는다. */

  // ---- 기록 ----
  const tt = ensureSheet(ss, 'titles', ['월', 'student_id', '칭호']);
  const ttRows = [];
  Object.keys(won).forEach(sid => won[sid].forEach(t => ttRows.push([ym, sid, t])));
  if (ttRows.length) tt.getRange(tt.getLastRow() + 1, 1, ttRows.length, 3).setValues(ttRows);

  const snapRows = students.map(r => [ym, r[0], mPts[r[0]] || 0, rank[r[0]] || 999]);
  snap.getRange(snap.getLastRow() + 1, 1, snapRows.length, 4).setValues(snapRows);

  /* [08-27 유호 지시] 🚫 월간 「명예의 전당 · 챔피언 공지」를 껐다 — 「비교하는거 최대한 없애자」.
   *   이것이 내던 것: 학생 홈 고정 배너 「🏛 8월의 전당 — 챔피언 (반) · MVP (실명)」 +
   *   전교 공지 「챔피언: (반) · 이달의 MVP: (실명) (N P) — 명예의 전당에 기록되었습니다!」.
   *   순위표보다 더 넓게 나가던 자리다(공지 탭은 전원이 본다).
   * 🔑 함수는 남긴다 — 지우면 되살릴 때 통째로 다시 짜야 하고, 지금은 «부르지 않는 것»으로 충분하다.
   *   함수 안에도 은퇴 표시를 박아 실수로 다시 부르면 바로 보이게 했다. */
  // writeLeagueHistory(ss, tz, ym, mPts, rank, clsOf, nameOf);  ← 08-27 폐지

  // [v5.7] 새 달 세계관 오프닝 — 이달의 보스 등장 공지 + 시즌 인트로 배너
  const nowMonth = Number(Utilities.formatDate(new Date(), tz, 'M'));
  const bossNew = bossOfMonth(ss, nowMonth);
  if (bossNew) {
    addNotice(ss, '⚔️ ' + nowMonth + '월의 보스 등장 — ' + bossNew.name,
      '"' + bossNew.entry + '"\n이번 달 레이드에서 우리 반의 힘으로 쓰러뜨리자! 🔥');
  }
  const stG = ss.getSheetByName('app_state');
  if (stG) {
    const ctS = ss.getSheetByName('contents');
    let sName = '', sTheme = '';
    if (ctS && ctS.getLastRow() >= 2) {
      ctS.getRange(2, 1, ctS.getLastRow() - 1, 6).getValues().forEach(r => {
        if (r[1] === 'season' && Number(r[5]) === nowMonth) { sName = String(r[2]); sTheme = String(r[3] || ''); }
      });
    }
    if (sName) setState(stG, '이달의시즌', nowMonth + '월의 무대 · ' + sName + (sTheme ? ' — ' + sTheme : '')); // [v9.56] 월 테마 개명 「이달의 무대」(유호 07-24) — "시즌"은 커리큘럼 8주 트랙 전용. app_state 키명은 Glide 바인딩 보호로 유지 — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md)
  }

  // [v7.1] 월간 정산 — ① 칭호보너스: 조건형만 포인트(경쟁형 1위류는 명예만) ② 출석 1회당 +3P
  const TITLE_BONUS = { '🌟 하루도 안 빠진 달': [PT.개근, '칭호보너스·개근'], '🤝 레이드 개근': [PT.레이드영웅, '칭호보너스·레이드개근'] }; // [08-27] 칭호 개명과 «같은 커밋»에서 따라간다 — 안 따라가면 보너스가 조용히 0이 된다
  const settleRows = [];
  Object.keys(won).forEach(sid => won[sid].forEach(t => {
    if (TITLE_BONUS[t]) settleRows.push([sid, TITLE_BONUS[t][0], TITLE_BONUS[t][1], '시스템']);
  }));
  students.forEach(r => {
    const d = daysBySid[r[0]] || 0;
    if (d > 0) settleRows.push([r[0], d * PT.출석, '출석정산 ' + ym + ' (' + d + '회)', '시스템']);
  });
  if (settleRows.length) appendPoints(ss, settleRows);

  ensureSheet(ss, 'manual_titles', ['student_id', '칭호', '부여자', '날짜']);

  // ---- SYNK 스토리 ----
  const story = ensureSheet(ss, 'story', ['월', 'student_id', '이름', '스토리']);
  const stRows = [];
  students.forEach(r => {
    const sid = r[0];
    const parts = [];
    if (won[sid] && won[sid].length) parts.push(won[sid].join(', ') + ' 칭호 획득!');
    const mp = mPts[sid] || 0;
    if (mp !== 0) parts.push('월간 ' + (mp > 0 ? '+' : '') + mp + 'P');
    if (runBySid[sid] >= 3) parts.push('최고 연속 출석 ' + runBySid[sid] + '일(수업일)');
    // [08-27 유호 지시] 「랭킹 5위→2위」를 걷었다 — 순위는 «남이 어디 있나»로만 움직인다.
    //   내가 그대로여도 남이 빠지면 오르고, 내가 늘어도 남이 더 늘면 떨어진다.
    //   그 자리에 «나 자신의 지난달 대비»를 놓는다 — 이건 남이 없어도 성립한다.
    if (prevPts[sid] !== undefined && mp > prevPts[sid])
      parts.push('지난달보다 +' + (mp - prevPts[sid]) + 'P');
    if (!parts.length) parts.push('꾸준히 함께한 한 달');
    stRows.push([ym, sid, nameOf[sid], ym.replace('-', '년 ') + '월 — ' + parts.join(' · ')]);
  });
  story.getRange(story.getLastRow() + 1, 1, stRows.length, 4).setValues(stRows);

  // [v7.8→08-20] 🏆 도전·성장 시상식 준비 메일 — 상장·스티커 수여 명단 + 상장 문구(로어 재사용)
  if (ttRows.length && quotaOk(1)) {
    const loreMap = {};
    const ctA = ss.getSheetByName('contents');
    if (ctA && ctA.getLastRow() >= 2) {
      ctA.getRange(2, 1, ctA.getLastRow() - 1, 4).getValues()
        .forEach(r => { if (r[1] === 'lore' && r[2]) loreMap[String(r[2])] = String(r[3] || ''); });
    }
    const nmA = {}, clA = {};
    pfData.forEach(r => { if (r[0]) { nmA[r[0]] = r[1] || r[0]; clA[r[0]] = r[4] || ''; } });
    const byTitle = {};
    ttRows.forEach(t => {
      if (!byTitle[t[2]]) byTitle[t[2]] = [];
      byTitle[t[2]].push(nmA[t[1]] + (clA[t[1]] ? ' (' + clA[t[1]] + ')' : ''));
    });
    let aBody = ym + ' 이 달의 도전·성장 시상식 준비물입니다.\n월 첫 수업 30초 세리머니 추천 — 상장·스티커 수여 + 📸 학부모 공유용 사진!\n\n';
    Object.keys(byTitle).forEach(t => {
      aBody += t + ' — ' + byTitle[t].join(', ') + '\n';
      if (loreMap[t]) aBody += '   상장 문구: "' + loreMap[t] + '"\n';
    });
    // [v9.120] quotaOk 가드 신설 — 관문 밖이던 마지막 발송
    if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 🏆 ' + ym + ' 도전·성장 시상식 준비', aBody);
  }

  // [v7.3] 최고 월간 기록(자기 경신 AS·AT) + 이달의 스토리(AU) — 학부모·여정 탭 원클릭 바인딩용
  if (pf.getMaxColumns() < 50) pf.insertColumnsAfter(pf.getMaxColumns(), 50 - pf.getMaxColumns()); // [v7.7]
  const stMap = {};
  stRows.forEach(r => { stMap[r[1]] = r[3]; });
  const prevBT = pf.getRange(2, 45, pfLast - 1, 2).getValues(); // AS·AT
  const bestOut = [], storyOut = [];
  pfData.forEach((r, i) => {
    if (!(r[0] && r[3] === 'student')) {
      bestOut.push([prevBT[i][0] || '', prevBT[i][1] || '']);
      storyOut.push(['']);
      return;
    }
    const cur = mPts[r[0]] || 0;
    const pb = Number(prevBT[i][0]) || 0;
    if (cur > pb) bestOut.push([cur, ym]);
    else bestOut.push([prevBT[i][0] || '', prevBT[i][1] || '']);
    storyOut.push([stMap[r[0]] || '']);
  });
  writeIfChanged(pf, 2, 45, bestOut);
  writeIfChanged(pf, 2, 47, storyOut);

  if (stG5) setState(stG5, '게임배치완료월', ym); // [v7.5]
  calcAll();
  Logger.log('게임배치 완료: 칭호 ' + ttRows.length + ' / 스토리 ' + stRows.length);
}

/* ===================== 누적 업적 ===================== */

// [v7.9] ⚠️ 업적 신규 추가 동결 — 일일 도전·성장 + 월간 칭호 + 영구 업적의 명예 3중 체계로 충분.
//        더 늘리면 전부 안 귀해진다. 여정 탭 노출은 최근 3개만 (마스터 체크리스트 참조).

/* [v9.252 · #Q104] 등수에서 나온 업적의 이름 — **정본은 여기 하나다.** 아래 `award` 호출부도
 *   이 상수를 쓴다. 이름을 두 곳에 적으면 갈라지고, 갈라진 쪽의 증상은 언제나 「통과」다:
 *   소비층(`엔진_콘텐츠AI.js` `성취맵_`)이 **이름으로** 거르는데 여기서만 이름이 바뀌면
 *   거름망이 조용히 빈다 — 그때 새는 방향은 「비교로 얻은 업적이 학생에게 가는 글의 근거로
 *   실린다」이고, 그건 철학 「하지 않는 것 ㉢」(학생끼리 비교하지 않는다) 위반이 **초록으로
 *   도는** 모양이다. 회귀 `tests/성취도달.test.js` 가 두 파일이 같은 값을 보는지 직접 잰다. */
/* 🔴 [08-27 유호 지시] 이 둘은 이제 «수여되지 않는다» — checkAchievements 의 부여 줄을 걷었다.
 *   그런데 이름과 거름망은 «남긴다»: 옛 시트에 이미 박힌 배지가 학생 글로 새는 것을 막는 것이
 *   이 목록의 일이라, 부여를 멈췄다고 거름망까지 걷으면 그 순간 옛 데이터가 샌다. */
const ACH_명예의전당_ = '명예의 전당 입성';
const ACH_TOP10단골_ = 'TOP10 단골';
/** 남과의 비교가 조건인 업적 목록 — 학생 산출의 근거로 쓰지 않는다(철학 ㉢).
 *  ⚠ `진짜 주인공`(제 점수가 3연속 오름)은 **자기 경신**이라 여기 없다. 철학이 허용한 유일한
 *  비교가 「어제의 그 학생과」라, 「랭킹 계열」로 뭉쳐 지우면 허용된 축까지 함께 죽는다.
 *  ⚠ 톱레벨 상수가 아니라 **함수**인 이유는 v9.135 규약이다 — 소비층이 다른 파일이라
 *  로드 순서에 걸린다(호출 시점엔 전 파일이 로드돼 있다). */
function 순위파생업적_() { return [ACH_명예의전당_, ACH_TOP10단골_]; }

/* [v9.252 · #Q104] 히든 3종 — 이름과 **뜻을 붙여** 둔다. 이름만으로는 소비층이 뜻을 지어낸다
 *   (「🎨 하루 세 빛깔」이 무엇을 뜻하는지는 아래 조건식에만 있다). 뜻을 소비층에 따로 적으면
 *   그게 둘째 정본이 되어 조건이 바뀔 때 **말만 낡는다** — 맞는 얼굴로 틀린 값이 나온다.
 * 🔑 이 셋이 이 탭의 급소다: `checkAchievements` 는 히든을 **라이브 point_logs 당월**로만 잡고
 *   아카이브는 안 본다(소급지급 방지 · 아래 [v9.25] 주석). 그래서 월간 아카이빙이 지나가면
 *   그 사실은 `achievements` 말고 **어디에도 안 남는다** — 재계산이 원리상 불가능하다.
 *   실제로 `getHours()` 는 이 저장소 엔진 전체에서 아래 한 곳뿐이라, 「언제 움직이는가」의
 *   유일한 영구 흔적이 이 셋이다(철학 ㉡ 사람 이해 — 대장에서 «돈다» 0인 층). */
const ACH_히든_ = {
  밤: { 이름: '🌙 한밤의 시냅스', 결: '밤 9시 넘어 움직인다' },
  세빛깔: { 이름: '🎨 하루 세 빛깔', 결: '하루에 세 갈래를 건드린다' },
  첫발자국: { 이름: '🌅 새 달의 첫 발자국', 결: '달 첫날에 시작을 끊는다' }
};
/** 히든 업적 이름 → 뜻. 소비층(`성취맵_`)이 학생에게 갈 글의 근거로 쓴다. */
function 히든업적결_() {
  const m = {};
  Object.keys(ACH_히든_).forEach(k => { m[ACH_히든_[k].이름] = ACH_히든_[k].결; });
  return m;
}

function checkAchievements() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  const pf = ss.getSheetByName('profiles');
  const pfLast = pf.getLastRow();
  if (pfLast < 2) return;
  const pfData = pf.getRange(2, 1, pfLast - 1, Math.min(81, pf.getMaxColumns())).getValues(); // [함께한날 막7] CC81(맞힌말수)까지 — 맞힌 말 업적 셋의 재료

  const ach = ensureSheet(ss, 'achievements', ['student_id', '업적', '등급', '달성일']);
  const has = new Set();
  if (ach.getLastRow() >= 2) {
    ach.getRange(2, 1, ach.getLastRow() - 1, 2).getValues()
      .forEach(r => has.add(r[0] + '|' + r[1]));
  }

  // [v9.25] A7-3: point_logs 1회 스캔 — 히든·누적 동시 집계(구 2패스 통합, 라이브 재읽기 제거).
  //   히든 3종은 매일 실행이라 라이브(당월) 로그로 실시간 포착됨 → 아카이브는 스캔하지 않는다(스코프 보존, 소급지급 방지).
  //   누적 카운트는 전 기간 필요 → 라이브+아카이브 합산(readPointLogs_와 동일 병합규칙 인라인). 지급 멱등성은 has 셋이 담당.
  const night = {}, tricolor = {}, firstStep = {}, dayKinds = {}; // [v9.13] 히든: 라이브 point_logs만
  const raidWins = {}, hwAll = {}, spkAll = {}, praiseAll = {};   // [v5.9] 누적 노력 카운트(라이브+아카이브)
  const tallyCumulative_ = r => { // [v5.1] 레이드 승수·숙제·MVP·시냅스 누적(정정 로그 제외)
    const sid0 = r[1];
    if (!sid0) return;
    const rs0 = String(r[3]);
    if (rs0 === '레이드보상') raidWins[sid0] = (raidWins[sid0] || 0) + 1;
    if (rs0.indexOf('숙제') > -1 && rs0.indexOf('정정') === -1) hwAll[sid0] = (hwAll[sid0] || 0) + 1; // [v7.5]
    if ((rs0.indexOf('MVP') > -1 || rs0.indexOf('도전') > -1) && rs0.indexOf('정정') === -1) spkAll[sid0] = (spkAll[sid0] || 0) + 1; // [v7.4]
    if ((rs0.indexOf('시냅스') > -1 || rs0.indexOf('성장') > -1) && rs0.indexOf('정정') === -1) praiseAll[sid0] = (praiseAll[sid0] || 0) + 1; // [v7.6]
  };
  const plH = ss.getSheetByName('point_logs');
  if (plH && plH.getLastRow() >= 2) {
    plH.getRange(2, 1, plH.getLastRow() - 1, 6).getValues().forEach(rr => {
      tallyCumulative_(rr);                        // 누적: 라이브
      const sid = rr[1], pts = Number(rr[2]) || 0, rsH = String(rr[3] || ''), byH = String(rr[4] || ''); // 히든: 라이브 당월만
      if (!sid || !rr[5] || pts <= 0) return;
      // [v9.28] 히든 실결함 수정 — 정산·보상 등 시스템 일괄지급(given_by=SYSTEM/시스템)은 매월 1일·22시에
      //   전원 동시 발생해 '하루 세 빛깔'·'새 달의 첫 발자국'을 사실상 자동 지급시킴 → 히든 스코프에서 제외.
      //   '숙제완료'는 hw_batch(22시 일괄 전개)가 지배적 경로라 given_by가 강사라도 '한밤의 시냅스'에서 별도 제외.
      if (byH === 'SYSTEM' || byH === '시스템') return;
      const dObj = (rr[5] instanceof Date) ? rr[5] : new Date(rr[5]);
      const d6 = dstr(dObj, tz);
      if (dObj.getHours() >= 21 && rsH !== '숙제완료') night[sid] = 1;
      if (d6.slice(8) === '01') firstStep[sid] = 1;
      const k = sid + '|' + d6;
      (dayKinds[k] = dayKinds[k] || {})[rsH] = 1;
    });
    Object.keys(dayKinds).forEach(k => {
      if (Object.keys(dayKinds[k]).length >= 3) tricolor[k.split('|')[0]] = 1;
    });
  }
  const plArc = ss.getSheetByName('point_logs_archive'); // 누적: 아카이브만(히든 미포함 — 스코프 보존)
  if (plArc && plArc.getLastRow() >= 2) {
    plArc.getRange(2, 1, plArc.getLastRow() - 1, 6).getValues().forEach(tallyCumulative_);
  }

  { // [v9.13] 🎯 히든 업적 3종 — 조건 비공개('?????'), 달성 순간 등급 '히든'으로 반짝 공개
    const hidRows = [];
    const hid = (map, name) => Object.keys(map).forEach(sid => {
      if (!has.has(sid + '|' + name)) { hidRows.push([sid, name, '히든', today]); has.add(sid + '|' + name); }
    });
    hid(night, ACH_히든_.밤.이름);
    hid(tricolor, ACH_히든_.세빛깔.이름);
    hid(firstStep, ACH_히든_.첫발자국.이름);
    if (hidRows.length) ach.getRange(ach.getLastRow() + 1, 1, hidRows.length, 4).setValues(hidRows);
  }

  const snap = ss.getSheetByName('monthly_snapshot');
  const bySid = {};
  if (snap && snap.getLastRow() >= 2) {
    snap.getRange(2, 1, snap.getLastRow() - 1, 4).getValues().forEach(r => {
      if (!bySid[r[1]]) bySid[r[1]] = [];
      bySid[r[1]].push({ ym: String(r[0]), pts: Number(r[2]) || 0, rank: Number(r[3]) || 999 });
    });
    Object.keys(bySid).forEach(k => bySid[k].sort((a, b) => a.ym < b.ym ? -1 : 1));
  }

  // [v5.9] 첫 출석일 — 재원 기념 업적용
  const firstAtt = {};
  const atA = ss.getSheetByName('attendance');
  if (atA && atA.getLastRow() >= 2) {
    atA.getRange(2, 1, atA.getLastRow() - 1, 3).getValues().forEach(r => {
      const sid0 = r[1], d0 = r[2];
      if (!sid0 || !d0) return;
      const t = (d0 instanceof Date) ? d0.getTime() : new Date(d0).getTime();
      if (t && (!firstAtt[sid0] || t < firstAtt[sid0])) firstAtt[sid0] = t;
    });
  }
  const newRows = [];
  function award(sid, name, grade) {
    if (has.has(sid + '|' + name)) return;
    newRows.push([sid, name, grade, today]);
    has.add(sid + '|' + name);
  }

  pfData.forEach(r => {
    const sid = r[0];
    if (!sid || r[3] !== 'student') return;
    const best = Math.max(Number(r[20]) || 0, Number(r[27]) || 0);
    const attended = r[22];

    if (attended) award(sid, '첫 발걸음', '🥉');
    if (best >= 30) award(sid, '한 달의 약속', '🥈');
    if (best >= 60) award(sid, '두 달의 전설', '🥇');
    if (best >= 100) award(sid, '100일의 기적', '🌟'); // [08-27] 👑 → 🌟
    /* [함께한날 막7] 구 진화 업적 6종(알 깨고 나왔다!·폭풍 성장기·회로의 완성·거인의 증표·몰입의 경지·
     * SYNK 마스터의 탄생)은 단계 축과 함께 은퇴 — 이미 준 행은 achievements 에 남는다(막0 실측: 상위 4종 수여 0 ·
     * 「알 깨고」 4건·「첫 발걸음」 11건뿐). 빈 자리 = «내가 맞힌 말» 누계 문턱 셋(설계 §4-6 업적 행). */
    const mastA = Number(r[80]) || 0; // CC81 맞힌말수(AI 출처 도달 누계)
    if (mastA >= 10) award(sid, '내 손으로 열 마디', '🥉');
    if (mastA >= 30) award(sid, '내 손으로 서른 마디', '🥈');
    if (mastA >= 60) award(sid, '내 손으로 예순 마디', '🥇');

    const hist = (bySid[sid] || []);
    /* [08-27 유호 지시] 🚫 «순위» 업적 둘을 걷었다 — 명예의전당(전교 3위 안)·TOP10 단골(전교 10위 안 3개월).
     *   유호 「비교하는거 최대한 없애자」. 그리고 순위 자체를 없앴으므로(R열 빈 칸) 남겨 두면
     *   «영영 안 뜨는 업적»이 되어 조용히 죽는다 — 지우는 것이 정직하다. */

    // [v5.1] 신규 업적: 레이드
    if ((raidWins[sid] || 0) >= 1) award(sid, '레이드 첫 승', '🥉');
    if ((raidWins[sid] || 0) >= 5) award(sid, '레이드 5승 클럽', '🥇');

    // [v5.9] 누적 노력 + 재원 기념 (조용한 꾸준함이 반드시 보상받는 라인)
    if ((hwAll[sid] || 0) >= 30) award(sid, '숙제 30 클럽', '🥉');
    if ((hwAll[sid] || 0) >= 100) award(sid, '숙제 100 마스터', '🥇');
    if ((spkAll[sid] || 0) >= 8) award(sid, '무대 체질', '🥈'); // [v7.2] MVP 8회
    if ((praiseAll[sid] || 0) >= 10) award(sid, '시냅스 컬렉터', '🥈'); // [v7.6] 오늘의 시냅스 10회
    if (firstAtt[sid] && (Date.now() - firstAtt[sid]) >= 365 * 86400000) award(sid, '시냅스 1주년', '🥇');
    if (firstAtt[sid] && (Date.now() - firstAtt[sid]) >= 730 * 86400000) award(sid, '싱크 베테랑', '🌟'); // [08-27] 👑 → 🌟
    const pos = hist.filter(h => h.pts > 0);
    for (let i = 2; i < pos.length; i++) {
      if (pos[i].pts > pos[i-1].pts && pos[i-1].pts > pos[i-2].pts) {
        award(sid, '진짜 주인공', '🌟'); break; // [08-27] 👑 → 🌟
      }
    }
  });

  if (newRows.length) {
    ach.getRange(ach.getLastRow() + 1, 1, newRows.length, 4).setValues(newRows);
    adminMail('[SYNK] 🏅 새 업적 ' + newRows.length + '건',
      newRows.map(r => '· ' + r[0] + ' — ' + r[2] + ' ' + r[1]).join('\n')); // [v5.4] 브리핑 통합
  }

  // [v7.7→08-20] 도전·성장 컬렉션 — 누적 횟수를 AW·AX에 따로 (여정 탭 "🔥 ×4 · 🌱 ×7" 표시용)
  if (pf.getMaxColumns() < 50) pf.insertColumnsAfter(pf.getMaxColumns(), 50 - pf.getMaxColumns());
  const crownOut = pfData.map(r =>
    (r[0] && r[3] === 'student') ? [spkAll[r[0]] || 0, praiseAll[r[0]] || 0] : ['', '']);
  writeIfChanged(pf, 2, 49, crownOut);

  Logger.log('업적: 신규 ' + newRows.length);
}

