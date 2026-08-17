// tests/수집.test.js — [v9.138] 학습 데이터 수집층 회귀 테스트
// 실행: node tests/수집.test.js  (CI: syntax-check.yml이 tests/*.test.js 전체 구동)
//
// 이 테스트가 지키는 것 = **소급이 불가능한 것들**.
//   코드 결함은 고치면 되고 데이터는 다시 계산하면 되지만, 그날 학생이 무엇을 골랐는지는
//   받아두지 않으면 영원히 없다. 「2년 축적 → AI 회화 앱」 계획에서 여기가 무너지면
//   2년 뒤에야 알게 되고, 그때는 되돌릴 방법이 없다.
//
// 특히 채점기는 **실제 문항 전수로 성능을 잰다**(표본이 아니라 전수) — "잘 될 것"이라는 추정 대신
//   지금 몇 %를 판정할 수 있는지 숫자로 남긴다. 판정 못 하는 문항이 늘면 이 테스트가 먼저 운다.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { ROOT, engineSource } = require('./_engine-source');
/* 주석 제거 통로는 공용 하나다 — `tests/lib/소스검사.js` (F401 계열 · 대기열 P3 줄73). */
const { 코드만, 구간, 파일소스 } = require('./lib/소스검사.js');
/* 줄끝 표기 정규화는 **`_engine-source` 이음매가 진다** — 여기서 다시 접지 않는다(F526 ㉠).
 * 08-03 실측: 리베이스 직후 이 파일의 9건이 「섹션 끝 표식을 찾지 못함」으로 한꺼번에 죽었다(CRLF) —
 * 코드는 멀쩡한데 테스트만 죽는 형태라, 원인을 모르면 진짜 결함을 찾아 헤매게 된다.
 * 그 처방이 호출부 세 곳의 손 접기였고 **축 하나(CRLF)만** 막았다. 08-17 실측: 형제 축인 줄끝 공백은
 * 그대로 열려 있어 이 파일에서만 24건이 같은 메시지로 죽었다. 그래서 이음매 하나로 옮겼다. */
const code = engineSource();
/* 🔑 **부정 단언 전용** 정제본 — 「없어야 한다」를 원문에 대고 재면 누군가 그 문구를 주석에 적는 순간
 *   가드가 엉뚱하게 빨개진다(대기열 P3 #Q72). 긍정 단언과 `section()` 앵커는 원문 `code` 를 그대로 본다.
 *   ⚠ **토큰 스캐너(:790)만은 예외로 원문을 본다** — 주석에 붙여넣은 토큰도 git 이력에 박히면 유출이다.
 *   대가: 엔진을 한 번 렉싱한다(≈0.6초 · 모듈 적재 시 1회). 자리마다 감싸면 3회다. */
const 코드정제 = 코드만(code);

function section(startMarker, endMarker) {
  const s = code.indexOf(startMarker);
  assert.notEqual(s, -1, `섹션 시작 표식을 찾지 못함: ${startMarker}`);
  const e = code.indexOf(endMarker, s + startMarker.length);
  assert.notEqual(e, -1, `섹션 끝 표식을 찾지 못함: ${endMarker}`);
  return code.slice(s, e);
}

/* 채점 3종을 실값으로 로드 — 순수 함수라 시트 없이 그대로 돌릴 수 있다(문자열 검사보다 강한 증거). */
function loadGrader() {
  const s = code.indexOf('function quizNorm_(');
  const e = code.indexOf('/* [v9.138] 🧠 오늘의 퀴즈 응답 폼');
  assert.notEqual(s, -1, 'quizNorm_ 정의를 찾지 못함');
  assert.notEqual(e, -1, '채점 구역 끝 표식을 찾지 못함');
  return new Function(`${code.slice(s, e)}
    return { quizNorm_, quizAnswerKeys_, quizGrade_ };`)();
}

/* 라이브에 실제로 심기는 퀴즈 문항 전수 — setupQuiz의 replaceContentType 배열이 정본이다.
 * 테스트가 자기 픽스처를 들고 있으면 문항이 개정될 때 함께 늙는다(정본을 읽어야 같이 움직인다). */
function loadQuizBank() {
  const marker = "replaceContentType(ss, 'quiz', [";
  const s = code.indexOf(marker);
  assert.notEqual(s, -1, 'quiz 문항 뱅크를 찾지 못함');
  const e = code.indexOf('\n  ]);', s);
  assert.notEqual(e, -1, 'quiz 문항 뱅크 끝을 찾지 못함');
  const rows = new Function(`return ${code.slice(s + marker.length - 1, e)}\n];`)();
  return rows.filter(r => r && r[1] === 'quiz' && r[3]).map(r => {
    const parts = String(r[3]).split('|');
    return { id: r[0], cat: r[2], q: parts[0], a: parts.length > 1 ? parts.slice(1).join('|') : '' };
  });
}

const G = loadGrader();

/* ── ① 채점기 — 전수 자기일관성 ── */

test('[v9.138] 채점기는 실제 문항 전수에서 정답을 정답으로 판정한다', () => {
  const bank = loadQuizBank();
  assert.ok(bank.length >= 90, `퀴즈 문항이 ${bank.length}개뿐 — 뱅크 파싱이 깨졌다(기대 100 부근)`);
  const 판정불가 = [], 오판 = [];
  bank.forEach(item => {
    const keys = G.quizAnswerKeys_(item.a);
    if (!keys.length) { 판정불가.push(item.id); return; }
    // 정답 문자열의 핵심부를 그대로 낸 학생은 반드시 정답이어야 한다(채점기 자기일관성의 최소 조건)
    const 핵심 = String(item.a).split(/[—–]/)[0].trim();
    const g = G.quizGrade_(핵심, item.a);
    if (g.ok !== true) 오판.push(item.id + ' (정답="' + item.a + '" 핵심="' + 핵심 + '")');
  });
  assert.equal(오판.length, 0, '정답을 그대로 냈는데 오답으로 판정되는 문항: ' + 오판.join(' · '));
  // 판정 불가(정답 미등록) 문항은 있을 수 있다 — 다만 몇 개인지 **알고 있어야** 한다. 조용히 늘면 정답률 통계가 썩는다
  assert.ok(판정불가.length <= 2,
    `정답이 비어 채점 불가인 문항이 ${판정불가.length}개 — 늘었다면 문항 개정에서 정답부(|뒤)가 빠진 것: ${판정불가.join(', ')}`);
});

test('[v9.138] 채점기는 학생이 쓰는 여러 표기를 같은 답으로 본다', () => {
  // 실제 문항 QZ01 = '빈칸은? 학교( ) 가요 — ①에 ②에서' / 정답 '① 에 — 방향·도착점은 에'
  ['①', '1', '1번', '에', ' 에 ', '①에'].forEach(ans =>
    assert.equal(G.quizGrade_(ans, '① 에 — 방향·도착점은 에').ok, true, `'${ans}'가 정답으로 안 잡힌다`));
  assert.equal(G.quizGrade_('②', '① 에 — 방향·도착점은 에').ok, false, '다른 번호가 정답으로 잡힌다');
  assert.equal(G.quizGrade_('에서', '① 에 — 방향·도착점은 에').ok, false, '오답이 정답으로 잡힌다');
  // 복수 정답('의사 또는 간호사')은 어느 쪽을 써도 정답 — 한쪽만 인정하면 맞은 학생이 틀린 것으로 쌓인다
  assert.equal(G.quizGrade_('의사', '의사 또는 간호사').ok, true, '복수 정답의 앞쪽이 인정되지 않는다');
  assert.equal(G.quizGrade_('간호사', '의사 또는 간호사').ok, true, '복수 정답의 뒤쪽이 인정되지 않는다');
  // 문장부호·띄어쓰기는 오답 사유가 아니다(내용을 아는지가 관심사)
  assert.equal(G.quizGrade_('부터, 까지', '부터, 까지').ok, true, '쉼표 표기가 오답이 된다');
  assert.equal(G.quizGrade_('부터 까지', '부터, 까지').ok, true, '띄어쓰기 차이가 오답이 된다');
});

test('[v9.138] 판정 보류는 오답으로 뭉개지지 않는다 — 모르는 것과 틀린 것은 다르다', () => {
  assert.equal(G.quizGrade_('아무거나', '').ok, null, '정답 미등록인데 오답으로 판정한다(정답률 통계가 왜곡된다)');
  assert.equal(G.quizGrade_('', '작다').ok, null, '무응답을 오답으로 판정한다');
  assert.equal(G.quizGrade_('   ', '작다').ok, null, '공백 응답을 오답으로 판정한다');
  // 적재 코드가 이 3값을 그대로 문자열로 옮기는지(true/false/null → 정답/오답/판정보류)
  const sweep = section('function quizSweep_(ss)', '\n}\n');
  assert.ok(sweep.includes("g.ok === null ? '판정보류'"), '판정 보류가 시트에서 오답과 구분되지 않는다');
});

/* ── ①-b AI 개인퀴즈 보기 마커 — 생산자(프롬프트)와 소비자(채점기)를 한 자리에서 묶는다 ──
 *
 * 왜 이 검사가 있나: 개인퀴즈의 문제·정답은 **모델이 짓는다**. 채점기가 아는 마커는
 *   원문자 ①②③④⑤ 와 맨숫자뿐인데(quizNorm_·quizAnswerKeys_), 프롬프트는 그 규약을 말하지 않고
 *   「빈칸/선택 문제」라고만 했다. 모델이 갈리면 마커가 갈리고, 갈린 마커는 **판정보류가 아니라 오답**으로
 *   적힌다 — 조용한 왜곡이라 정답률을 볼 때까지 안 보인다.
 * 탐지력은 아래 ②의 픽스처가 진다(실저장소에 버그가 남아 있기를 요구하지 않는다 — 실저장소 몫은 ①·③뿐).
 */

/* 채점기가 실제로 아는 마커 집합을 **소스에서** 뽑는다 — 손 목록을 두면 채점기가 넓어질 때 갈라진다. */
function 채점기마커() {
  const m = code.match(/\.replace\(\/\[([①②③④⑤가-힣\d]+)\]\/g, m => String\('([^']+)'\.indexOf/);
  assert.ok(m, 'quizNorm_ 의 원문자 치환 자리를 찾지 못함 — 마커 정본이 어디인지 이 검사가 모른다');
  assert.equal(m[1], m[2], 'quizNorm_ 한 줄 안에서 마커 목록이 이미 둘로 갈렸다');
  return m[1].split('');
}

test('[v9.221]① AIQ 프롬프트가 보기 마커를 못박고, 그 마커가 채점기가 아는 것과 같다', () => {
  const 마커 = 채점기마커();
  const 스키마 = section("q: { type: 'string', description: '오늘의 퀴즈", '\n    };');
  assert.ok(/선택 문제면 보기를 문제 안에 [①②③④⑤]+ 마커로 적는다/.test(스키마),
    'AIQ 프롬프트가 보기 마커를 안 정한다 — 모델이 갈리면 「(나) 이에요」·「가. 이에요」가 한 열에 섞인다');
  const 프롬프트마커 = (스키마.match(/보기를 문제 안에 ([①②③④⑤]+) 마커로/) || [])[1].split('');
  프롬프트마커.forEach((c, i) => assert.equal(c, 마커[i],
    `프롬프트가 시키는 마커 '${c}' 를 채점기가 그 자리에서 모른다 — 정답 키가 통짜 문자열로 굳는다`));
  // 정답 칸도 같은 규약 아래 있어야 한다 — 문제만 ①②로 적고 정답을 본문만 쓰면 번호로 답한 학생이 오답이 된다
  assert.ok(/마커와 보기 본문을 함께 적는다/.test(스키마),
    '정답 칸의 마커 규약이 없다 — 「정답: 이에요」로만 오면 「②」로 답한 학생이 오답으로 적힌다');
});

/* [v9.222] ①이 「적는다」까지만 보다가 그 **뒤**를 통째로 놓쳤다 — v9.221 이 실제로 그렇게 샜다.
 * 금지 목록을 `적는다(1) · (1) · 가. … 금지)` 로 적었더니 열린 괄호를 목록의 첫 항목 `1)` 이 닫아,
 * 모델이 읽는 문장이 「적는다(1)」이 됐다 — **금지하려던 마커가 예시 자리에 붙는다.**
 * 사람 눈에는 목록으로 보이고 정규식에는 안 걸리는 자리라, 여기서 기계가 본다. */
test('[v9.222] AIQ 프롬프트 설명문의 괄호가 짝이 맞는다 — 금지 목록이 자기가 연 괄호를 닫으면 금지가 예시로 뒤집힌다', () => {
  const 스키마 = section("q: { type: 'string', description: '오늘의 퀴즈", '\n    };');
  ["'오늘의 퀴즈", "'정답 —"].forEach(머리 => {
    const 설명 = (스키마.match(new RegExp(머리.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "[^']*")) || [''])[0];
    assert.ok(설명, `설명문을 못 찾았다(${머리}) — 이 검사가 무엇을 재는지 모르는 채 초록이 된다`);
    /* 「」 안은 **마커 리터럴**이라 짝이 안 맞는 게 정상이다(`「1)」`·`「(1)」`가 금지 목록의 알맹이다).
     * 인용부호가 경계를 지므로 걷어낸 뒤 센다 — 안 걷으면 이 검사가 정답을 오답이라 부른다. */
    const 밖 = 설명.replace(/「[^」]*」/g, '');
    let 깊이 = 0, 어긋 = false;
    for (const ch of 밖) {
      if (ch === '(') 깊이++;
      else if (ch === ')' && --깊이 < 0) { 어긋 = true; break; }
    }
    assert.ok(!어긋 && 깊이 === 0,
      `괄호 짝이 안 맞는다 — 모델이 읽는 경계가 사람이 의도한 경계와 다르다: ${설명.slice(0, 160)}`);
  });
  // 금지 마커는 **금지로 읽히는 자리**에 있어야 한다 — 괄호가 아니라 인용부호로 감싸 경계를 못박는다
  assert.ok(/「1\)」·「\(1\)」·「가\.」 같은 다른 마커 금지/.test(스키마),
    '금지 목록이 인용부호 밖에 있다 — 괄호로 적으면 v9.221 처럼 첫 항목이 괄호를 닫는다');
});

test('[v9.221]② 마커 규약을 지킨 정답은 번호로도 본문으로도 정답이고, 어긴 마커는 «오답»을 만든다', () => {
  // 규약을 지킨 모양 — quizSweep_ 이 '정답: ' 접두를 벗긴 뒤 채점기에 넣는 그 문자열
  const 지킨정답 = '② 이에요 — Энэ бол эелдэг хэлбэр.';
  ['②', '2', '이에요', '2 이에요'].forEach(ans =>
    assert.equal(G.quizGrade_(ans, 지킨정답).ok, true, `규약을 지켰는데 '${ans}' 가 정답으로 안 잡힌다`));
  assert.equal(G.quizGrade_('①', 지킨정답).ok, false, '다른 번호가 정답으로 잡힌다');

  /* 어긴 모양 — 왜 프롬프트를 못박아야 하는지를 이 픽스처가 증명한다.
   * 「판정보류(null)면 그래도 정직하다」가 아니라 **false(오답)** 로 굳는 것이 급소다:
   * 학생은 보기 본문을 그대로 썼는데 시트에는 「오답」이 남고, 정답률 통계가 조용히 왜곡된다. */
  [['(나) 이에요', '이에요'], ['가. 이에요', '이에요'], ['2) 이에요', '2']].forEach(([어긴정답, 학생답]) => {
    const g = G.quizGrade_(학생답, 어긴정답);
    assert.notEqual(g.ok, null, `'${어긴정답}' — 이 픽스처는 «오답으로 굳는 것»을 재는 자리다(보류면 검사가 헛돈다)`);
  });
  assert.equal(G.quizGrade_('이에요', '(나) 이에요').ok, false,
    '괄호 마커가 정답 본문과 한 덩이로 굳지 않는다 — 이 픽스처가 늙었으니 위 프롬프트 조항의 근거를 다시 쓴다');
});

test('[v9.221]③ 개인퀴즈 정답의 「정답: 」 접두는 채점 전에 벗겨진다 — 안 벗기면 전건 오답이다', () => {
  const sweep = section('function quizSweep_(ss)', '\n}\n');
  assert.ok(/replace\(\/\^\\s\*정답\\s\*\[:：\]\\s\*\/, ''\)/.test(sweep),
    'ai_daily 정답의 「정답: 」 접두를 안 벗긴다 — 정답 키가 「정답:②이에요」가 되어 아무도 못 맞힌다');
  // 벗긴 뒤의 문자열이 실제로 채점을 통과하는지까지 본다(문자열 검사만으로는 접두 정규식이 맞는지 모른다)
  const 벗긴 = '정답: ② 이에요 — 해설'.replace(/^\s*정답\s*[:：]\s*/, '');
  assert.equal(G.quizGrade_('②', 벗긴).ok, true, '접두를 벗긴 정답이 채점을 통과하지 못한다');
});

/* ── ② 수집 원칙 — 채점 실패가 데이터를 버리는 사유가 되면 안 된다 ── */

test('[v9.138] 수집이 채점보다 우선 — 채점 못 한 응답도 원문이 남는다', () => {
  const sweep = section('function quizSweep_(ss)', '\n}\n');
  // 적재 배열에 고른답(ans)이 채점 결과와 **무관하게** 들어가는지 — 조건부로 들어가면 판정불가 응답이 유실된다
  assert.ok(/out\.push\(\[[\s\S]*?셀안전_\(ans\),[\s\S]*?g\.ok === null/.test(sweep),
    '고른 답이 채점 결과보다 뒤에 조건부로 들어간다 — 판정 못 한 응답이 통째로 버려질 수 있다');
  assert.ok(!/if \(g\.ok === null\) return/.test(코드만(sweep)), '판정 보류 행을 return으로 버린다(수집 원칙 위반)');
  // 문항 텍스트 스냅샷 — contents가 개정되면 ID만으로는 2년 뒤 해석이 불가능해진다
  assert.ok(sweep.includes('meta.cat') && sweep.includes('meta.q') && sweep.includes('meta.a'),
    '문항 분류·문제·정답 스냅샷이 행에 없다 — 문항 개정 후 과거 데이터가 해석 불능이 된다');
  // [v9.188] 문구가 아니라 **의도**를 잰다 — 조회 키가 바뀌어도(개인 퀴즈는 학생별 짝이다) 기본값 폴백은 남아야 한다.
  //   구 회귀는 `qMap[qid] || ` 리터럴에 묶여 있어, 폴백이 멀쩡한데도 조회 키를 넓히자 죽었다.
  assert.ok(/const meta = [^;\n]*\|\| \{ cat: '', q: '', a: '' \}/.test(sweep),
    'contents에 없는 문항(AI 개인 퀴즈)에서 스위프가 죽는다 — 기본값 폴백이 없다');
});

test('[v9.138] 퀴즈 스위프는 재실행 안전 — 포인터 전진·같은 문항 중복 차단·무효 sid 통보', () => {
  const sweep = section('function quizSweep_(ss)', '\n}\n');
  assert.ok(sweep.includes("props.setProperty('퀴즈폼_포인터'"), '포인터 전진이 없다 — 매 틱마다 같은 응답이 다시 쌓인다');
  assert.ok(/if \(from > last\)[\s\S]{0,120}return/.test(sweep), '포인터가 시트 끝을 넘었을 때 클램프하지 않는다(행 삭제 후 영구 정지)');
  assert.ok(sweep.includes("seen[key]"), '같은 학생·같은 문항 중복 제출 차단이 없다');
  assert.ok(sweep.includes("notifyDroppedSids_('퀴즈폼', badSid)"), '미등록 sid가 조용히 드롭된다(무통보 드롭 결함)');
  // 게이트 순서 — 유효성 검사가 적재보다 앞
  assert.ok(sweep.indexOf('valid.has(sid)') < sweep.indexOf('out.push('), '유효 학생 검사가 적재보다 뒤에 있다');
});

/* ── ③ 숙제 3단 데이터 + 오류 태그 ── */

test('[v9.138] 오류 태그는 통제 어휘 — 어휘 밖 문자열이 시트로 새지 않는다', () => {
  const s = code.indexOf('const HW_ERROR_TAGS = [');
  const e = code.indexOf('\n}', code.indexOf('function hwTagsClean_('));
  const M = new Function(`${code.slice(s, e + 2)}
    return { HW_ERROR_TAGS, hwTagsClean_ };`)();
  assert.ok(M.HW_ERROR_TAGS.length >= 20, `태그 어휘가 ${M.HW_ERROR_TAGS.length}개뿐 — 축이 너무 거칠면 "조사 오류 3만 건"밖에 안 나온다`);
  assert.ok(M.HW_ERROR_TAGS.indexOf('오류없음') !== -1, '「오류없음」이 없으면 잘 쓴 제출이 태그 없는 행과 구분되지 않는다');
  // 몽골어 화자의 실제 병목 3축이 충분히 세분화돼 있는가(조사·활용·높임)
  assert.ok(M.HW_ERROR_TAGS.filter(t => t.indexOf('조사:') === 0).length >= 5, '조사 축이 너무 거칠다 — 몽골어 화자 최대 병목이라 여기가 뭉개지면 지도가 안 된다');
  assert.ok(M.HW_ERROR_TAGS.filter(t => t.indexOf('높임:') === 0).length >= 2, '높임 축이 없다');
  // 실행 검증 — 어휘 밖·중복·빈값 처리
  assert.equal(M.hwTagsClean_(['조사:목적격(을/를)', '어미:시제']), '조사:목적격(을/를), 어미:시제');
  assert.equal(M.hwTagsClean_(['조사:목적격(을/를)', '조사:목적격(을/를)']), '조사:목적격(을/를)', '중복 태그가 그대로 쌓인다');
  assert.equal(M.hwTagsClean_(['내맘대로태그']), '', '어휘 밖 문자열이 시트에 들어간다 — 집계가 오염된다');
  assert.equal(M.hwTagsClean_([]), '', '빈 배열 처리가 없다');
  assert.equal(M.hwTagsClean_(null), '', 'null 처리가 없다(모델이 필드를 빠뜨리면 배치가 죽는다)');
  // 프롬프트가 같은 상수를 enum으로 쓰는지 — 어휘와 프롬프트가 갈라지면 모델이 못 고르는 태그가 생긴다
  const call = section('function callClaudeFeedback_(', 'const res = UrlFetchApp.fetch');
  assert.ok(call.includes('enum: HW_ERROR_TAGS'), '프롬프트 schema가 태그 어휘 정본을 쓰지 않는다');
  assert.ok(call.includes("'error_tags'"), 'error_tags가 required에 없다 — 선택 필드면 모델이 자주 생략한다');
});

test('[v9.138] 숙제 폼 증분은 멱등이고, 구 링크를 죽이지 않는다', () => {
  const fn = section('function migrateHwFormV9138()', '\n}\n');
  ['숙제ID', '재작성원본'].forEach(t =>
    assert.ok(fn.includes(`titles.indexOf('${t}') === -1`), `${t} 문항이 멱등 가드 없이 추가된다(재실행마다 중복 문항)`));
  // 필수로 만들면 이미 배포된 구 프리필 링크(그 문항이 없는)가 전부 제출 불가가 된다
  assert.ok(!/setTitle\('숙제ID'\)\.setRequired\(true\)/.test(코드만(fn)), '숙제ID가 필수 응답이다 — 구 링크로 들어온 학생이 숙제를 못 낸다');
  assert.ok(!/setTitle\('재작성원본'\)\.setRequired\(true\)/.test(코드만(fn)), '재작성원본이 필수 응답이다 — 최초 제출이 불가능해진다');
  // URL 틀 2종이 서로 다른 토큰을 써야 한다(같으면 한쪽이 다른 쪽을 덮어쓴다)
  assert.ok(fn.includes("prefillTemplate2_(form, '학생ID', '숙제ID', 'QZTOKEN')"), '기본 링크 틀이 없다');
  assert.ok(fn.includes("prefillTemplate2_(form, '학생ID', '재작성원본', 'REDOTOKEN')"), '다시쓰기 링크 틀이 없다');
  // 문항을 만들기 전에 틀을 뽑으면 프리필 자리가 안 잡힌다
  assert.ok(fn.indexOf("addTextItem().setTitle('재작성원본')") < fn.indexOf("setState(st, '숙제폼URL틀'"),
    'URL 틀 생성이 문항 추가보다 앞이다 — 프리필 자리가 안 잡힌 틀이 저장된다');
});

test('[v9.138] 커버리지 리포트는 총량이 아니라 빈 유형을 먼저 말한다', () => {
  const fn = section('function dataCoverageReport(', '\n}\n'); // 인자 목록은 앵커에 넣지 않는다(v9.166에서 opts가 붙어 한 번 죽었다)
  assert.ok(fn.includes('아직 한 건도 못 잡은 오류 유형'), '빈 유형 표기가 없다 — 총량만 보면 "많이 모았다"는 착시가 생긴다');
  assert.ok(/HW_ERROR_TAGS\.filter\(t => t !== '오류없음' && !태그수\[t\]\)/.test(fn), '빈칸 계산에서 「오류없음」을 빼지 않는다(영원히 안 채워지는 칸이 섞인다)');
  // [v9.198] 강의 한줄요약은 같은 칸(L 숙제ID)에 '강의:' 접두로 실린다 — 함께 세면 「문항 연결」이 부풀고
  //   ㉡ 배선이 실제로 도는지도 못 읽는다(한 숫자가 두 가지를 뜻하면 둘 다 못 읽는 것과 같다)
  assert.ok(/LECTURE_SRC_PREFIX\) === 0\) 강의요약\+\+;[\s\S]{0,140}else if \(출처\) 문항연결\+\+;/.test(fn),
    '강의 한줄요약을 숙제 문항연결과 같이 센다');
  assert.ok(fn.includes("'  강의 한줄요약 편입 '"), '편입 실측이 리포트에 안 뜬다 — 「배선했다」가 선언으로만 남는다');
  // 읽기 전용이어야 아무 때나 눌러도 안전하다(6개월마다 열어보는 용도)
  const 리포트코드 = 코드만(fn); // 부정 단언 전용 — 루프 안에서 감싸면 낱말 수만큼 다시 렉싱된다
  ['setValue', 'appendRow', 'setValues', 'insertColumns'].forEach(w =>
    assert.ok(!리포트코드.includes(w), `커버리지 리포트가 ${w}로 시트를 쓴다 — 읽기 전용이어야 한다`));
  assert.ok(fn.includes('quiz_log') && fn.includes('hw_feedback') && fn.includes('voice_log'), '수집 3종을 모두 재지 않는다');
});

/* ── ④ AI 대화 — 회화 앱의 핵심 재료(다른 어디서도 안 나온다) ── */

test('[v9.138] 대화는 문맥을 안고 간다 — 매 턴 처음 만난 사이가 되면 그건 대화가 아니다', () => {
  const s = code.indexOf('function talkHistory_(');
  assert.notEqual(s, -1, 'talkHistory_ 정의를 찾지 못함');
  const e = code.indexOf('function callClaudeTalk_(');
  const M = new Function(`const TALK_LOG_HEADERS = ${JSON.stringify(['id', 'student_id', '턴', '학생문', 'AI답', '오류태그', '제출일', 'created_at'])};
    const TALK_CONTEXT_TURNS = 6;
    ${code.slice(s, e)}
    return { talkHistory_ };`)();
  // 두 학생의 로그가 섞여 있어도 내 대화만 문맥으로 가야 한다(남의 대화가 새면 개인정보 사고다)
  const rows = [
    ['TK1', 'S1', 1, '안녕하세요', '안녕하세요! 오늘 어땠어요?', '', '2026-08-01', ''],
    ['TK2', 'S2', 1, '다른 학생 문장', '다른 답장', '', '2026-08-01', ''],
    ['TK3', 'S1', 2, '학교에 갔어요', '재미있었어요?', '', '2026-08-02', '']
  ];
  const h = M.talkHistory_(rows, 'S1');
  assert.equal(h.length, 4, '내 턴 2개(각 user+assistant)가 문맥으로 안 돌아온다');
  assert.equal(h[0].role, 'user');
  assert.equal(h[1].role, 'assistant');
  assert.ok(!JSON.stringify(h).includes('다른 학생'), '남의 대화가 내 문맥에 섞인다 — 개인정보 유출이자 대화 붕괴');
  assert.equal(M.talkHistory_(null, 'S1').length, 0, '로그가 없을 때 죽는다(첫 턴이 영원히 불가능해진다)');
  // 답장이 빈 행(API 실패로 학생 문장만 남은 행)은 assistant 턴을 만들지 않아야 한다 — 빈 assistant는 API가 거부한다
  assert.equal(M.talkHistory_([['TK9', 'S3', 1, '학생만', '', '', '2026-08-02', '']], 'S3').length, 1,
    '답장이 빈 행에서 빈 assistant 턴이 만들어진다');
  // 문맥은 배치가 이미 읽어 둔 배열을 받아야 한다 — 학생마다 시트를 다시 읽으면 25명 배치가 전체 읽기를 25번 한다
  const batch = section('function talkBatch_()', '\n}\n');
  assert.ok(batch.includes('talkHistory_(logRows, sid)'), '대화 문맥이 학생마다 시트를 재읽기한다(반 18개 × 전체 읽기와 같은 계급)');
  assert.equal((batch.match(/tl\.getRange\(/g) || []).length, 1, `talk_log를 ${(batch.match(/tl\.getRange\(/g) || []).length}회 읽는다 — 1회여야 한다`);
});

test('[v9.138] 대화 배치 — 하루 1턴 상한·리허설 차단·실패해도 학생 문장은 남는다', () => {
  const fn = section('function talkBatch_()', '\n}\n');
  assert.ok(fn.includes("if (!apiKey) return"), 'API 키 없이도 도는 경로가 있다(배포만으로 과금될 수 있다)');
  assert.ok(/isRehearsal_\(\)[\s\S]{0,200}return/.test(fn), '리허설이 입구에서 차단되지 않는다 — 개원 시뮬이 실제 과금된다');
  // 비용은 사람 수가 아니라 열정에 비례한다 — 한 명이 밤새 눌러 그날 예산을 혼자 태우는 것을 막는다
  assert.ok(fn.includes('todayDone[sid]'), '학생당 하루 1턴 상한이 없다');
  assert.ok(fn.includes('made >= TALK_MAX_PER_RUN'), '실행당 상한이 없다');
  // 답장 생성에 실패해도 학생이 쓴 문장은 대화 데이터의 절반이다
  assert.ok(/permanent[\s\S]{0,400}tl\.appendRow\(/.test(fn), '영구 오류에서 학생 문장을 버린다(수집 원칙 위반)');
  assert.ok(fn.includes("props.setProperty('대화폼_포인터'"), '포인터 전진이 없다 — 같은 응답에 매일 밤 재과금된다');
  // 외부 발송 0 — 학생에게 가는 경로는 앱 화면뿐이어야 한다(메일·메신저로 새면 승인 없는 외부 발송이 된다)
  assert.ok(!/MailApp\.sendEmail\([^)]*sid/.test(코드만(fn)), '학생에게 직접 메일을 보낸다 — 답장은 시트에만 쓴다');
  const call = section('function callClaudeTalk_(', 'const res = UrlFetchApp.fetch');
  assert.ok(call.includes('enum: HW_ERROR_TAGS'), '대화에서도 오류 태그를 같은 어휘로 받지 않는다(두 축이 갈라진다)');
  /* [v9.145] 프롬프트 제약은 이제 TALK_SYSTEM_PROMPT 상수에 산다(prompt_ver 해시가 변경을 보게 하려고 뽑았다).
   * 검사 대상을 함수 본문에 둔 채로 두면, 상수에서 제약을 지워도 테스트가 통과한다 — 가드가 눈머는 그 형태다. */
  const sysM = code.match(/const TALK_SYSTEM_PROMPT =[\s\S]*?';\n/);
  assert.ok(sysM, 'TALK_SYSTEM_PROMPT 상수를 찾지 못함');
  const sys = sysM[0];
  assert.ok(sys.includes('질문 하나로 끝'), '답장이 질문으로 끝나도록 강제하지 않는다 — 턴이 1에서 멈추면 대화 데이터가 안 쌓인다');
  assert.ok(/개인정보\(주소·전화·비밀번호\)를 묻지 않는다/.test(sys), '봇이 개인정보를 묻지 않는다는 제약이 없다');
  assert.ok(/AI·시스템 자기 언급 금지/.test(sys), '봇이 자기가 AI라고 말하지 않는다는 제약이 없다');
});

/* ── ⑤ [v9.145] 대화 출처 기록 — 「학생이 어려워한 것」과 「그때 우리 답이 나빴던 것」을 가른다 ── */

test('[v9.145] talk_log는 model·prompt_ver를 남기고, 새 열은 반드시 끝에 붙는다', () => {
  const m = code.match(/const TALK_LOG_HEADERS = (\[[^\]]*\]);/);
  assert.ok(m, 'TALK_LOG_HEADERS 정의를 찾지 못함');
  const H = JSON.parse(m[1].replace(/'/g, '"'));
  assert.ok(H.includes('model') && H.includes('prompt_ver'),
    '출처가 안 남는다 — 2년 뒤 이 대화를 무엇이 만들었는지 되돌아가 알 수 없다(소급 불가)');
  // 앞에 끼우면 r[1]·r[2]·r[3]·r[4]·r[6] 위치 접근이 통째로 밀린다(이 저장소는 열 밀림으로 여러 번 당했다)
  assert.deepEqual(H.slice(0, 8), ['id', 'student_id', '턴', '학생문', 'AI답', '오류태그', '제출일', 'created_at'],
    '기존 8열의 순서가 바뀌었다 — 위치로 읽는 코드가 전부 어긋난다');
  /* [v9.207] 구간을 **닫는다**(`slice(8)` → `slice(8, 12)`). 열린 slice 는 「오늘의 끝」을 못박아,
   *   규약(새 열은 끝에만)대로 붙이는 **정상 변경마다** 빨개진다 — 가드가 자기 처방을 막는 그 형태다.
   *   v9.190이 voice_log에서 같은 병을 이미 한 번 고쳤는데(그때 앵커를 push 배열 안으로 옮겼다) 이 자리엔
   *   안 옮겼고, schema_ver 추가가 세 번째다. 닫힌 구간은 이 넷의 **존재와 서로의 순서**를 그대로 지키면서
   *   뒤에 붙는 열만 허용한다 — 삭제·중간삽입·순서변경은 여전히 빨갛다(잃는 탐지력이 없다). */
  assert.deepEqual(H.slice(8, 12), ['model', 'prompt_ver', 'audio_ref', '급수'], '증분 4열의 순서가 바뀌었거나 하나가 사라졌다'); // [v9.151] audio_ref = 음성 원본 참조(무제한 보존 · 유호 확정 08-04) · [v9.187] 급수 = 레벨 스냅샷
});

test('[v9.145] 성공 행과 실패 행이 **둘 다** 헤더 길이만큼 쓴다 — 하나만 고치면 열이 어긋난다', () => {
  const m = code.match(/const TALK_LOG_HEADERS = (\[[^\]]*\]);/);
  const need = JSON.parse(m[1].replace(/'/g, '"')).length;
  const fn = section('function talkBatch_()', '\n}\n');
  // 성공 경로: const row = [ ... ]  · 실패 경로: tl.appendRow([ ... ])
  const rowLit = fn.match(/const row = \[([\s\S]*?)\];/);
  assert.ok(rowLit, '성공 행 리터럴을 찾지 못함');
  const failLit = fn.match(/permanent[\s\S]*?tl\.appendRow\(\[([\s\S]*?)\]\);/);
  assert.ok(failLit, '실패 행 리터럴을 찾지 못함');
  // 최상위 콤마만 센다(중첩 호출 안의 콤마는 제외)
  const countTop = (s) => {
    let d = 0, n = 1;
    for (const ch of s) {
      if ('([{'.includes(ch)) d++;
      else if (')]}'.includes(ch)) d--;
      else if (ch === ',' && d === 0) n++;
    }
    return n;
  };
  assert.equal(countTop(rowLit[1]), need, `성공 행이 ${countTop(rowLit[1])}칸 — 헤더는 ${need}칸이다`);
  assert.equal(countTop(failLit[1]), need, `실패 행이 ${countTop(failLit[1])}칸 — 헤더는 ${need}칸이다(실패 행을 빠뜨렸다)`);
  assert.ok(/\bmodel\b/.test(rowLit[1]) && /\bpver\b/.test(rowLit[1]), '성공 행에 model·pver가 안 들어간다');
  assert.ok(/\bmodel\b/.test(failLit[1]) && /\bpver\b/.test(failLit[1]), '실패 행에 model·pver가 안 들어간다');
});

test('[v9.145] prompt_ver는 손으로 올리는 상수가 아니라 프롬프트에서 계산된다', () => {
  const fn = section('function talkPromptVer_()', '\n}\n');
  assert.ok(fn.includes('computeDigest'), 'prompt_ver가 해시가 아니다 — 손으로 관리하는 번호는 언젠가 안 올라가고, 그 순간 이 열은 거짓을 말한다');
  // 답을 바꾸는 세 가지가 전부 지문에 들어가야 한다
  assert.ok(fn.includes('TALK_SYSTEM_PROMPT'), '시스템 프롬프트가 지문에 안 들어간다');
  assert.ok(fn.includes('AI_FEEDBACK_MODEL'), '모델이 지문에 안 들어간다');
  assert.ok(fn.includes('TALK_CONTEXT_TURNS'), '문맥 턴 수가 지문에 안 들어간다(길이가 바뀌면 답도 바뀐다)');
  // 시스템 프롬프트는 상수를 참조해야 한다 — 인라인으로 되돌리면 지문이 변경을 못 본다
  const call = section('function callClaudeTalk_(', 'const res = UrlFetchApp.fetch');
  assert.ok(/system:\s*TALK_SYSTEM_PROMPT/.test(call),
    '시스템 프롬프트가 인라인이다 — 프롬프트를 고쳐도 prompt_ver가 그대로여서 데이터가 조용히 섞인다');
  // 톱레벨 계산 금지 — AI_FEEDBACK_MODEL은 Code.js에 있고 라이브 파일 로드 순서가 보장되지 않는다
  assert.ok(!/^const TALK_PROMPT_VER\s*=/m.test(코드정제),
    'prompt_ver를 톱레벨에서 계산한다 — 로드 순서에 따라 undefined를 지문에 넣는다(v9.57 계열 사고)');
});

test('[v9.145] 이미 서 있는 시트에 새 열 이름표를 붙인다 — ensureSheet는 시트가 없을 때만 헤더를 쓴다', () => {
  const batch = section('function talkBatch_()', '\n}\n');
  assert.ok(batch.includes('talkHeaderHeal_'),
    '헤더 치유 호출이 없다 — v9.139로 이미 만들어진 8열 시트는 값만 들어가고 머리글이 없는 채로 남는다');
  // [v9.187] 치유 본체는 공용 하나(헤더보정_) — 로직이 시트마다 제 벌이면 한쪽만 고쳐져 조용히 갈라진다
  const heal = section('function 헤더보정_(', '\n}\n');
  assert.ok(heal.includes('getMaxColumns'), '시트 물리 열이 모자랄 때 넓히지 않는다');
  assert.ok(heal.includes("!== h"), '멱등이 아니다 — 이미 맞는 헤더도 매일 다시 쓴다(변경 있을 때만 setValue여야 한다)');
  assert.ok(section('function talkHeaderHeal_(', '\n}\n').includes('헤더보정_'), 'talk 치유가 공용 본체를 안 쓴다(두 벌 갈라짐)');
  assert.ok(section('function hwFeedbackEnsureCols_(', '\n}\n').includes('헤더보정_'), 'hw 치유가 공용 본체를 안 쓴다');
  assert.ok(section('function quizSweep_(ss)', '\n}\n').includes('헤더보정_(ql, QUIZ_LOG_HEADERS)'),
    'quiz_log에 치유가 없다 — 라이브 11열 시트에서 급수 칸이 조용히 버려진다');
  const 교재 = fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(교재.includes('헤더보정_(vl, VOICE_LOG_HEADERS)'), 'voice_log에 공용 치유가 없다 — 9열 시트에서 급수 칸이 버려진다');
});

/* ─────────────────────────────────────────────────────────────
 * [v9.187] 학습데이터 스키마 감사분 — 제품방향 §설계 불변식 2 「학생·레벨·시점을 키로 남긴다」.
 * 레벨(급수)이 수집 4시트 전부에 없었고, 첨삭엔 출처(model·prompt_ver)와 문항 텍스트도 없었다.
 * 전부 소급 불가 계열 — profiles 급수는 승급하면 과거가 지워지는 현재값이다.
 * ───────────────────────────────────────────────────────────── */

const 교재소스 = () => fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8').replace(/\r\n/g, '\n');

/* [v9.190] 제목을 「급수가 맨 끝」에서 「증분은 끝에만」으로 고친다 — hw_feedback은 이미 급수 뒤에
 *   3열이 더 있어(model·prompt_ver…) 구 제목이 자기 본문과 어긋나 있었다. 지키는 것은 처음부터
 *   **기존 열 순서 불변 + 새 열은 끝에 추가**였고, 그래야 위치로 읽는 코드가 안 밀린다. */
test('[v9.187] 수집 4시트 — 기존 열 순서 불변, 새 열은 맨 끝에만 붙는다', () => {
  const QH = JSON.parse(code.match(/const QUIZ_LOG_HEADERS = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));
  assert.deepEqual(QH.slice(0, 11), ['id', 'student_id', '퀴즈ID', '유형', '문제', '고른답', '정답', '정답여부', '확신도', '제출일', 'created_at'],
    'quiz_log 기존 11열 순서가 바뀌었다 — 위치로 읽는 코드가 전부 어긋난다');
  assert.deepEqual(QH.slice(11, 12), ['급수'], 'quiz_log 급수가 12번째 자리에서 사라졌거나 밀렸다'); // [v9.207] 구간을 닫는다 — 사유는 위 [v9.145] 검사 주석
  const HH = JSON.parse(code.match(/const HW_FEEDBACK_HEADERS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
  assert.deepEqual(HH.slice(0, 15), ['id', 'student_id', '제출일', '제출문', '고친문장', '오늘의포인트', '칭찬', '다음미션',
    '상태', '학생확인', '포인트지급', '숙제ID', '오류태그', '재작성원본', '다시쓰기URL'], 'hw_feedback 기존 15열 순서가 바뀌었다');
  assert.deepEqual(HH.slice(15, 19), ['숙제문항', '급수', 'model', 'prompt_ver'], 'hw_feedback 감사 4열의 순서가 바뀌었거나 하나가 사라졌다'); // [v9.207] 구간을 닫는다
  const VH = JSON.parse(code.match(/const VOICE_LOG_HEADERS = (\[[^\]]*\]);/)[1].replace(/'/g, '"')); // [vNEXT] 정의가 엔진_셋업확장(engineSource 안)으로 이사
  assert.deepEqual(VH.slice(0, 9), ['student_id', '제출일', '미션', '파일URL', 'file_id', 'created_at', '전사', '전사상태', '전사일시'],
    'voice_log 기존 9열 순서가 바뀌었다');
  assert.deepEqual(VH.slice(9, 11), ['급수', '미션ID'], 'voice_log 증분 2열(급수·미션ID)이 이 자리에 이 순서로 있지 않다 — 라이브 시트가 이 순서로 서 있어 바꾸면 이름표와 값이 어긋난다'); // [v9.208] 구간을 닫는다 — 열린 slice(9)는 규약대로 끝에 붙는 새 열(schema_ver)마다 거짓 적색(quiz·hw 가 v9.207 에서 닫은 같은 병)
  // talk_log는 [v9.145] 검사(H.slice(8))가 급수까지 함께 못박는다 — 여기 다시 적으면 정본이 두 벌이 된다
});

test('[v9.187] 급수가 행에 실제로 실린다 — 열만 만들면 이름표 붙은 빈 칸이다', () => {
  const quiz = section('function quizSweep_(ss)', '\n}\n');
  assert.ok(/lvOf\[k\] = Number\(r\[66\]\) \|\| 0/.test(quiz), 'quiz가 profiles BO67(급수)을 읽지 않는다');
  /* [v9.207] 앵커에서 닫는 `])`를 뗀다 — v9.190이 voice에 적용한 처방을 quiz·talk에도 옮긴다.
   *   구 앵커는 "급수가 **마지막 칸**이다"를 요구해서, 뒤에 열이 붙으면 정상 적재가 ❌로 보였다.
   *   이 검사의 뜻은 "급수가 행에 실린다"이고, push 배열을 잘라 보므로 범위는 오히려 좁다. */
  const qPush = (quiz.match(/out\.push\(\[[\s\S]*?\]\);/) || [''])[0];
  assert.ok(/lvOf\[sid\] \|\| 0/.test(qPush), 'quiz 적재 행에 급수가 없다');
  const talk = section('function talkBatch_()', '\n}\n');
  assert.equal((talk.match(/Number\(stu\.lv\) \|\| 0/g) || []).length, 2,
    'talk 성공·실패 행 중 한쪽에 급수가 빠졌다(실패 행도 학생 문장 절반을 담는 데이터다)');
  const vs = (() => { const t = 교재소스(); return t.slice(t.indexOf('function voiceSweep_(ss)'), t.indexOf('function writeVoiceLinks_')); })();
  assert.ok(/lvOf\[k\] = Number\(r\[66\]\) \|\| 0/.test(vs), 'voice가 profiles BO67(급수)을 읽지 않는다');
  /* [v9.190] 앵커를 `0])`(=급수가 맨 끝)에서 **push 배열 안**으로 옮긴다. 이 검사의 뜻은 "급수가 행에
   *   실린다"인데 구 앵커는 "급수가 마지막 칸이다"를 요구했다 — 미션ID가 뒤에 붙자 정상 적용이 ❌로 보였다.
   *   push 배열을 잘라서 보므로 범위는 오히려 좁아진다(함수 아무 데나 있는 문자열로는 통과 못 한다). */
  const vPush = (vs.match(/vOut\.push\(\[[\s\S]*?\]\);/) || [''])[0];
  assert.ok(/lvOf\[sid\] \|\| 0/.test(vPush), 'voice 적재 행에 급수가 없다');
});

test('[v9.187] 대화가 급수를 실제로 전달한다 — 「급수에 맞춰 조절」 지시만 있고 급수를 안 보내던 결함의 회귀', () => {
  // 결함의 실물: callClaudeTalk_가 stu를 인자로 받고도 본문에서 한 번도 안 썼다 — 모델은 급수를 추측할 수밖에 없었다
  const call = section('function callClaudeTalk_(', 'const res = UrlFetchApp.fetch');
  assert.ok(/system:\s*TALK_SYSTEM_PROMPT \+ [^,]*stu\.lv/.test(call),
    '시스템 프롬프트에 학생 급수가 안 실린다 — 「급수에 맞춰 조절한다」가 죽은 지시로 돌아간다');
});

test('[v9.187] 첨삭도 출처(model·prompt_ver)와 문항 텍스트를 남긴다 — 행 폭은 헤더와 같다', () => {
  const fn = section('function fbPromptVer_()', '\n}\n');
  assert.ok(fn.includes('computeDigest'), 'fbPromptVer_가 해시가 아니다 — 손 번호는 언젠가 안 올라간다');
  assert.ok(fn.includes('FB_SYSTEM_PROMPT') && fn.includes('AI_FEEDBACK_MODEL'), '프롬프트·모델이 지문에 안 들어간다');
  assert.ok(!/^const FB_PROMPT_VER\s*=/m.test(코드정제), 'prompt_ver를 톱레벨에서 계산한다 — 로드 순서에 따라 undefined가 지문에 들어간다');
  const call = section('function callClaudeFeedback_(', 'const res = UrlFetchApp.fetch');
  assert.ok(/system:\s*FB_SYSTEM_PROMPT/.test(call),
    '첨삭 시스템 프롬프트가 인라인이다 — 프롬프트를 고쳐도 prompt_ver가 그대로여서 병렬쌍이 조용히 섞인다');
  const batch = section('function aiFeedbackBatch_()', 'function callClaudeFeedback_(');
  assert.ok(batch.includes('fbPromptVer_()'), '배치가 지문을 계산하지 않는다');
  assert.ok(/hwQ = hwQuestionMap_\(ss\)/.test(batch), '문항 텍스트 스냅샷 로드가 없다 — ID만 남으면 2년 뒤 해석 불능(원칙 2)');
  // 성공·실패 행 폭 = 헤더 폭(19) — 주석의 문장 콤마가 세어지지 않게 라인 주석은 걷어내고 센다
  const HH = JSON.parse(code.match(/const HW_FEEDBACK_HEADERS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
  const countTop = (s) => {
    let d = 0, n = 1;
    for (const ch of 코드만(s)) {   // 주석 제거는 공용 통로 하나다(F401 계열)
      if ('([{'.includes(ch)) d++;
      else if (')]}'.includes(ch)) d--;
      else if (ch === ',' && d === 0) n++;
    }
    return n;
  };
  const okLit = batch.match(/fb\.appendRow\(\[fbId,([\s\S]*?)\]\);/);
  assert.ok(okLit, '성공 행 리터럴을 찾지 못함');
  assert.equal(countTop(okLit[1]) + 1, HH.length, `성공 행이 ${countTop(okLit[1]) + 1}칸 — 헤더는 ${HH.length}칸이다`);
  /* 앵커는 `e.permanent`(코드)다 — 그냥 'permanent'는 위쪽 v9.125 **주석**의 같은 단어에 먼저 걸려
   * 성공 행을 실패 행으로 오인하고 19=19 자기일관 초록이 된다(변이 시험이 실제로 잡은 구멍). */
  const failLit = batch.match(/e\.permanent[\s\S]*?fb\.appendRow\(\[([\s\S]*?)\]\);/);
  assert.ok(failLit, '실패 행 리터럴을 찾지 못함');
  assert.equal(countTop(failLit[1]), HH.length, `실패 행이 ${countTop(failLit[1])}칸 — 헤더는 ${HH.length}칸이다(실패 행을 빠뜨렸다)`);
});

test('[v9.146] 점검 함수는 「왜 안 생겼나」의 원인 넷을 전부 지목하고, 헤더 치유를 겸한다', () => {
  const fn = section('function talkLogCheck()', '\n}\n');
  // 조기 반환 4개가 전부 같은 증상(아무 일도 안 일어남)을 내므로, 넷을 구분해 주지 않으면 점검이 아니다
  assert.ok(fn.includes('CLAUDE_API_KEY'), '키 미설정을 진단하지 않는다');
  assert.ok(fn.includes('대화폼_응답'), '응답 0건(가장 흔한 원인)을 진단하지 않는다');
  assert.ok(fn.includes('대화폼_포인터'), '이미 처리된 건지(포인터)를 진단하지 않는다');
  assert.ok(fn.includes('isRehearsal_'), '리허설 차단 상태를 진단하지 않는다');
  // 배치 안쪽 치유는 조기 반환 뒤에 있어 첫 대화 전까지 안 돈다 — 여기서 불러야 지금 붙는다
  assert.ok(fn.includes('talkHeaderHeal_'), '점검이 헤더 치유를 겸하지 않는다 — 배치를 기다려야만 이름표가 붙는다');
  // 지금 쓸 값을 보여줘야 시트의 기록과 대조할 수 있다(대조 없이는 「맞는 값인지」를 모른다)
  assert.ok(fn.includes('talkPromptVer_()'), '지금 배치가 쓸 prompt_ver를 보여주지 않는다');
  assert.ok(/menuTalkLogCheck/.test(code) && /addItem\([^)]*menuTalkLogCheck|'menuTalkLogCheck'/.test(code),
    '점검이 메뉴에 배선되지 않았다 — 유호님이 부를 수단이 없으면 만든 것과 도는 것은 다르다');
});

test('[v9.138] 새 학생 열은 선점 구간을 침범하지 않는다 — 이 저장소는 열 충돌로 세 번 당했다', () => {
  const s4 = code.match(/const SHARED4_COL_START = (\d+)/);
  assert.ok(s4, '4차 블록 시작 상수가 없다');
  assert.ok(Number(s4[1]) >= 130, `4차 블록이 ${s4[1]}열에서 시작 — DT124~DX128(상담 5열)·DY129(오늘의만남) 선점 구간을 침범한다`);
  const s3 = Number(code.match(/const SHARED3_COL_START = (\d+)/)[1]);
  const h3 = code.match(/const SHARED3_COL_HEADERS = \[([\s\S]*?)\];/)[1].split(',').filter(x => x.trim()).length;
  assert.ok(s3 + h3 - 1 <= 123, `3차 블록이 ${s3 + h3 - 1}열까지 뻗어 상담 디테일(DT124)을 침범한다`);
  // 블록이 늘면 분리 쓰기도 함께 늘어야 한다 — 안 그러면 마지막 블록이 통째로 안 써지거나 앞 블록을 덮는다
  const fn = section('function writeSharedCols_(', 'const WORLD_HP_PER');
  assert.ok(fn.includes('writeIfChanged(pf, 2, SHARED4_COL_START,'), '4차 블록 분리 쓰기가 없다 — 열은 만들어지고 값은 영원히 안 채워진다');
  assert.ok(fn.includes('a.slice(cut3, cut3 + SHARED3_COL_HEADERS.length)'), '3차 블록 slice가 끝까지 열려 있다 — 4차 몫까지 3차 자리에 쏟는다');
  assert.ok(fn.includes('.concat(SHARED4_COL_HEADERS)'), 'HEADS_ALL이 4차 블록을 모른다 — 행 길이 가드가 오탐으로 전 계산을 죽인다');
});

/* ── ⑤ 보안 — 학생 입력은 「남의 글」이다 ── */

test('[v9.138] 학생이 낸 글은 셀 수식 인젝션 차단을 거쳐 시트에 들어간다', () => {
  /* 이 스프레드시트에는 profiles(학생·보호자 연락처)가 함께 있다. `=`로 시작하는 문자열을 시트가
   *   **수식으로 실행**하므로, 학생이 답 칸에 `=IMPORTDATA("...?d="&TEXTJOIN(",",1,profiles!B2:B60))`를
   *   넣으면 개인정보가 외부로 나간다 — 사람이 셀을 클릭할 필요도 없다(시트가 스스로 평가한다).
   *   상담AI가 페이스북 텍스트를 받으며 같은 이유로 셀안전_를 도입했다(v9.137). 학생 입력도 똑같이 남의 글이다.
   *   ⚠ 모델 출력도 감싼다 — 프롬프트 인젝션으로 `=…`로 시작하는 답을 뱉게 만들 수 있다. */
  const quiz = section('function quizSweep_(ss)', '\n}\n');
  ['셀안전_(ans)', '셀안전_(qid)', '셀안전_(conf)'].forEach(g =>
    assert.ok(quiz.includes(g), `퀴즈 적재에 ${g}가 없다 — 학생 입력이 수식으로 실행될 수 있다`));
  const talk = section('function talkBatch_()', '\n}\n');
  assert.ok(talk.includes('셀안전_(text)'), '대화 적재에 학생문 방어가 없다');
  assert.ok(talk.includes("셀안전_(String(card.reply || ''))"), '대화 적재에 모델 출력 방어가 없다(프롬프트 인젝션 경로)');
  assert.equal((talk.match(/셀안전_\(text\)/g) || []).length, 2, '정상 경로와 오류 경로 중 한쪽만 방어된다');
  const fbBatch = section('function aiFeedbackBatch_()', 'function callClaudeFeedback_(');
  ['셀안전_(text)', "셀안전_(String(card.corrected || ''))", '셀안전_(hwId)', '셀안전_(reDo)'].forEach(g =>
    assert.ok(fbBatch.includes(g), `첨삭 적재에 ${g}가 없다`));
  // 방어 함수 자체가 살아 있는지 — 상담AI.js에 있고 이 파일들이 런타임에 부른다(로드 순서 무관)
  const talkSrc = fs.readFileSync(path.join(ROOT, '상담AI.js'), 'utf8');
  assert.ok(/function 셀안전_\(v\)[\s\S]{0,200}\^\[=\+\\-@/.test(talkSrc), '셀안전_ 정의가 없거나 차단 문자 집합이 바뀌었다');
});

/* ── ⑥ 배선 — 만들어만 두고 아무도 안 부르는 상태를 막는다(v9.90 ROLE_TALK 사고 계열) ── */

test('[v9.138] 퀴즈 수집이 실제로 배선돼 있다 — 시트·스위프·폼·열·경고', () => {
  // [v9.241] 골격 행에 세 번째 칸(수집 표식)이 붙을 수 있다 — 지키는 사실은 「골격에 있고 헤더 정본을 쓴다」다.
  assert.ok(/\['quiz_log', QUIZ_LOG_HEADERS[,\]]/.test(code), 'quiz_log가 시트 골격 정본에 없다 — 재건·preflight가 이 시트를 모른다');
  assert.ok(code.includes("safeRun('quizSweep', function () { quizSweep_(ss); })"), 'quizSweep_가 10분 스위프에 배선되지 않았다(폼 응답이 영원히 안 옮겨진다)');
  assert.ok(code.includes("formAlreadyMade_(ss, '퀴즈폼_응답', '퀴즈폼URL틀', '퀴즈폼ID'"), '퀴즈 폼 생성이 재실행 안전 가드를 통과하지 않는다');
  assert.ok(code.includes("setState(st, '퀴즈폼URL틀', prefillTemplate2_(form, '학생ID', '퀴즈ID'))"), '퀴즈 폼 URL 틀이 두 필드 프리필로 저장되지 않는다');
  // 학생 행에 링크가 실제로 실리는지 — 열만 만들고 값을 안 넣으면 버튼이 조용히 안 뜬다(v9.61이 잡았던 그 결함)
  assert.ok(code.includes("quizFormUrlOf_(kv['퀴즈폼URL틀'], sid,"), '학생 행에 퀴즈 폼 링크가 채워지지 않는다');
  // [v9.138] 대화층도 같은 3종 배선 — 시트·배치·폼이 하나라도 빠지면 「대화 0건」 상태가 그대로 유지된다
  assert.ok(/\['talk_log', TALK_LOG_HEADERS[,\]]/.test(code), 'talk_log가 시트 골격 정본에 없다');
  assert.ok(code.includes("safeRun('talkBatch', talkBatch_)"), 'talkBatch_가 야간 배치에 배선되지 않았다(답장이 영원히 안 만들어진다)');
  assert.ok(code.includes("formAlreadyMade_(ss, '대화폼_응답', '대화폼URL틀', '대화폼ID'"), '대화 폼 생성이 재실행 안전 가드를 통과하지 않는다');
  assert.ok(code.includes("formUrlOf(kv['대화폼URL틀'], sid)"), '학생 행에 대화 폼 링크가 채워지지 않는다');
  // preflight — 수집 입구 2종이 없으면 경고해야 한다(조용히 0건인 상태가 가장 위험하다)
  const pre = section('function preflightGlide()', 'function safeRun(name, fn)');
  ['퀴즈폼URL틀', '대화폼URL틀'].forEach(k => assert.ok(pre.includes(`'${k}'`), `preflight가 ${k} 부재를 경고하지 않는다`));
  // 메뉴 — 비개발자가 누를 수 있는 경로가 있어야 실제로 켜진다(편집기 드롭다운은 유호님 동선이 아니다)
  ['menuCreateQuizForm', 'menuMigrateHwForm', 'menuCreateTalkForm', 'menuDataCoverage'].forEach(m =>
    assert.ok(code.includes(`'${m}'`) && code.includes(`function ${m}()`), `시트 메뉴 항목 ${m}이(가) 없다`));
});

test('[v9.138] 퀴즈ID와 문제는 같은 선택에서 나온다 — 두 사슬이 갈라지면 조용히 오염된다', () => {
  const fn = section('function writeSharedCols_(', 'const WORLD_HP_PER');
  // 값과 ID를 각각 폴백 사슬로 고르면(구 구조) 언젠가 어긋나고, 그 오염은 2년 뒤에야 드러난다
  assert.ok(fn.includes('const qPick = qSuffix.map(s => ({ q: kv[\'오늘의퀴즈\' + s] || \'\', id: kv[\'오늘의퀴즈ID\' + s] || \'\' }))'),
    '문제와 퀴즈ID가 한 번의 선택으로 짝지어지지 않는다 — 문제와 ID가 어긋날 수 있다');
  assert.ok(fn.includes('const quizRaw = qPick.q'), '표시 문제가 선택 결과에서 오지 않는다');
  // 난이도 3종 모두 ID가 저장돼야 중·고급 학생의 응답이 문항과 연결된다(구 코드는 초급만 저장했다)
  ['초급', '중급', '고급'].forEach(lv =>
    assert.ok(code.includes("setState(st, '오늘의퀴즈ID_" + lv + "'"), `${lv} 퀴즈ID가 저장되지 않는다 — 그 난이도 학생의 응답이 문항과 끊긴다`));
  // 개인 퀴즈(AI 생성)는 contents에 없다 — 표식을 남기되 링크는 살아 있어야 한다
  assert.ok(fn.includes("pq ? ('AIQ-' + tdQ) : qPick.id"), '개인 퀴즈에 표식이 없다 — contents ID와 섞이면 집계가 오염된다');
  // ID가 없으면 링크를 주지 않는다(해석 불능 응답 방지)
  const url = section('function quizFormUrlOf_(', '\n}\n');
  assert.ok(/if \(!tmpl \|\| !qid\) return ''/.test(url), '퀴즈ID 없이도 링크를 준다 — 무엇에 대한 답인지 모르는 행이 쌓인다');
});

/* [v9.188] 개인 퀴즈가 학생당 평생 1행만 남던 자리 — 라이브에서 **매일 데이터를 버리고 있었다**.
 * 원인은 한 줄이었다: 퀴즈ID가 상수 'AIQ'라 quiz_log의 dedup 키('퀴즈ID|학생')가 첫 제출에서 굳는다.
 * 두 번째 날부터 그 학생의 응답은 `if (seen[key]) return;`에 걸려 조용히 사라졌다 — 오류도 로그도 없이.
 * 소급이 불가능한 종류라(그날 무엇을 골랐는지는 다시 못 만든다) 회귀로 못박는다. */
test('[v9.188] 개인 퀴즈ID는 날짜로 갈라진다 — 상수로 되돌아오면 그날부터 응답이 사라진다', () => {
  const fn = section('function writeSharedCols_(', 'const WORLD_HP_PER');
  // ① 상수 복귀 금지 — 이 한 줄이 되돌아오는 것이 곧 데이터 유실의 재발이다
  assert.ok(!/pq \? 'AIQ' :/.test(코드만(fn)),
    "개인 퀴즈ID가 상수 'AIQ'로 되돌아왔다 — dedup 키가 학생당 하나로 굳어 이틀째부터 응답이 통째로 버려진다");
  // ② 날짜 재료가 실제로 그 자리에 있어야 한다(선언이 블록 안에 갇히면 참조 불가라 조용히 깨진다)
  assert.ok(/const tdQ = Utilities\.formatDate\(new Date\(\), ss\.getSpreadsheetTimeZone\(\), 'yyyy-MM-dd'\)/.test(fn),
    '개인 퀴즈ID에 쓸 날짜(tdQ)가 없다 — ai_daily 조인 키와 같은 형식이어야 한다');
  // ③ ai_daily 조인 형식 일치 — 여기가 갈라지면 문항 스냅샷이 영원히 빈칸이 된다
  const sweep = section('function quizSweep_(', 'function 퀴즈응답포인트_(');
  assert.ok(sweep.includes("qMap['AIQ-' + dA + '|' + sidA]"),
    '개인 퀴즈 문항 스냅샷을 ai_daily에서 담지 않는다 — 「무엇을 물었는지 모르는 답」은 학습 재료가 못 된다');
  assert.ok(sweep.includes("qMap[qid + '|' + sid] || qMap[qid]"),
    '문항 조회가 (문항ID, 학생) 짝을 먼저 보지 않는다 — 개인 퀴즈는 학생마다 문제가 다르다');
  // ④ 정답 접두어 제거 — "정답: X — 해설" 그대로면 채점 키가 '정답: x'가 되어 학생 답과 영원히 안 맞는다
  assert.ok(/replace\(\/\^\\s\*정답\\s\*\[:：\]\\s\*\/, ''\)/.test(sweep),
    '개인 퀴즈 정답의 "정답:" 접두어를 벗기지 않는다 — 정답을 맞혀도 오답으로 채점된다');
  /* ⑤ 문항 스냅샷 3칸도 수식 소독을 거친다.
   *   구 코드는 이 셋만 맨몸이었다 — 출처가 contents(우리 콘텐츠)라 안전하다는 전제였는데,
   *   개인 퀴즈부터 출처가 **AI 생성물**이고 그 재료는 학생의 약점 메모·첨삭이다.
   *   즉 학생 입력이 흘러오는 경로가 생겼으므로 전제가 깨졌다. */
  assert.ok(/셀안전_\(meta\.cat\), 셀안전_\(meta\.q\), 셀안전_\(ans\), 셀안전_\(meta\.a\)/.test(sweep),
    '문항 스냅샷이 맨몸으로 시트에 들어간다 — 학생 입력에서 유래한 수식이 셀에서 평가될 수 있다(profiles 동거 시트)');
});

/* [v9.188] ai_daily 야간 전량 삭제 — 학생별 맞춤 문제·해설이 매일 밤 영구 소실되던 자리.
 * 두 결함이 겹쳐 있었다: 아카이브가 없었고(소급 불가), clearContent가 setValues보다 앞서서
 * 그 사이 타임아웃이 나면 **남겼어야 할 오늘 것까지** 사라졌다. */
test('[v9.188] ai_daily 프룬은 아카이브 뒤에만·지우기는 쓰기 뒤에만', () => {
  const fn = section('function aiStudioBatch_(', '// ② ');
  const iArc = fn.indexOf("ensureSheet(ss, 'ai_daily_archive'");
  const iClear = fn.indexOf('clearContent()');
  assert.notEqual(iArc, -1, 'ai_daily 프룬이 아카이브 없이 지운다 — 그날의 맞춤 문항이 영구 소실된다(소급 불가)');
  assert.notEqual(iClear, -1, '프룬 자체가 사라졌다 — 이 테스트의 대상이 바뀌었으니 함께 갱신하라');
  assert.ok(iArc < iClear, '아카이브보다 삭제가 먼저다 — 옮기기가 실패하면 그대로 유실이다');
  // 살릴 행을 먼저 쓰고 남은 구간만 지운다(구 코드는 전체를 지우고 다시 썼다)
  const iSet = fn.indexOf('ad.getRange(2, 1, rowsD.length, 5).setValues(rowsD)');
  assert.notEqual(iSet, -1, '남길 행을 다시 쓰지 않는다');
  assert.ok(iSet < iClear, '지우기가 쓰기보다 먼저다 — 그 사이 6분 타임아웃이면 오늘 것까지 사라진다');
  assert.ok(!/ad\.getRange\(2, 1, ad\.getLastRow\(\) - 1, 5\)\.clearContent\(\)/.test(코드만(fn)),
    '시트 전체를 통째로 지우는 구 코드가 되돌아왔다');
});

/* ─────────────────────────────────────────────────────────────
 * [v9.166] 커버리지 자동 발화 + 강사 정답 모음 → 회화 앱 픽스처 내보내기
 *
 * 내보내기는 **실제 출력을 검사**한다. 「식별자를 안 담는다」는 소스 문자열로 증명할 수 없다 —
 * 담기는 곳이 출력이라서, 소스에 student_id가 안 보여도 열 인덱스 하나만 밀리면 그대로 실린다.
 * 그리고 이 실패는 되돌릴 수 없다(목적지가 git 저장소다).
 * ───────────────────────────────────────────────────────────── */

const GOLD_H = ['id', 'fb_id', 'student_id', '제출일', '원문', 'AI교정', '강사판정', '강사교정', '사유', '오류태그', '강사', 'created_at'];

/* [v9.170] 판정 문자열은 **소스에서 뽑아 쓴다** — 손으로 베끼면 픽스처만 통과하는 테스트가 된다.
 * (여기 값은 Glide 강사 탭 「정답 모음」 Choice 옵션 표와 같아야 하는 그 문자열이다) */
const GOLD_V = (() => {
  const m = code.match(/const GOLD_VERDICTS = (\[[^\]]*\]);/);
  assert.ok(m, 'GOLD_VERDICTS 정의를 찾지 못함 — 판정 분기가 죽은 채 초록이 된다');
  return JSON.parse(m[1].replace(/'/g, '"'));
})();

/* [v9.187] 오류태그 어휘도 소스에서 뽑는다 — 픽스처가 어휘 전량을 동봉하므로 샌드박스에 실값이 필요하다. */
const HW_TAGS = (() => {
  const m = code.match(/const HW_ERROR_TAGS = \[([\s\S]*?)\];/);
  assert.ok(m, 'HW_ERROR_TAGS 정의를 찾지 못함');
  return new Function(`return [${m[1]}];`)();
})();

function loadExport(rows) {
  const s = code.indexOf('const FIXTURE_MIN_LEN');
  assert.notEqual(s, -1, 'FIXTURE_MIN_LEN 정의를 찾지 못함');
  let saved = null;
  const sheet = { getLastRow: () => rows.length + 1, getRange: () => ({ getValues: () => rows }) };
  const ctx = {
    GOLD_HEADERS: GOLD_H,
    GOLD_VERDICTS: GOLD_V,
    HW_ERROR_TAGS: HW_TAGS, // [v9.187] 픽스처가 어휘 전량을 동봉한다(두 저장소 어휘 잠금)
    SpreadsheetApp: { getActiveSpreadsheet: () => ({
      getSheetByName: n => (n === 'teacher_gold' ? sheet : null),
      getSpreadsheetTimeZone: () => 'Asia/Seoul'
    }) },
    Utilities: { formatDate: () => '20260804' },
    DriveApp: { createFile: (name, content) => { saved = { name: name, content: content }; return { getUrl: () => 'https://drive/x' }; } },
    MimeType: { PLAIN_TEXT: 'text/plain' },
    Logger: { log: () => {} }
  };
  const api = new Function(...Object.keys(ctx), `${code.slice(s)}
    return { exportGoldenFixture: exportGoldenFixture_, fixtureDiff_: fixtureDiff_, 역소독_: 역소독_ };`)(...Object.values(ctx));
  return { api: api, saved: () => saved };
}

test('[v9.166] 픽스처에 식별자는 한 글자도 나가지 않는다 — 목적지가 git이라 되돌릴 수 없다', () => {
  const rows = [['GD20260804-1', 'FB-77', 'SYNK-012', '2026-08-01',
    '저가 몽골 사람입니다.', '저는 몽골 사람입니다.', GOLD_V[1], '저는 몽골 사람이에요.',
    '조사 오류', '조사:주격(이/가·은/는)', '바트 선생님', '2026-08-04T00:00:00']];
  const { api, saved } = loadExport(rows);
  api.exportGoldenFixture();
  const out = saved().content;
  assert.equal(out.includes('SYNK-012'), false, 'student_id가 실렸다 — 동의 v18.9의 「비식별 사용」 약속 위반');
  assert.equal(out.includes('FB-77'), false, 'fb_id 유출');
  assert.equal(out.includes('바트'), false, '강사명 유출');
  assert.equal(out.includes('2026-08-01'), false, '제출일 유출 — 소수 인원에선 날짜가 사실상 식별자로 동작한다');
  const doc = JSON.parse(out);
  assert.equal(doc.항목.length, 1);
  assert.equal(doc.항목[0].기대교정, '저는 몽골 사람이에요.', '강사교정이 있으면 그것이 정답이어야 한다(AI교정이 아니라)');
  assert.deepEqual(doc.항목[0].기대태그, ['조사:주격(이/가·은/는)']);
  // [v9.187] 어휘 동봉 — 두 저장소는 태그 23종을 이름만 공유한다(사본). 전량을 실어야 받는 쪽이 갈라짐을 그날 안다
  assert.deepEqual(doc.어휘, HW_TAGS, '오류태그 어휘 전량이 픽스처에 동봉되지 않는다 — 사본이 갈라져도 아무도 모른다');
});

test('[v9.166] 강사가 아직 안 본 행은 픽스처가 되지 않는다 — 정답 없는 항목은 채점표가 아니다', () => {
  const rows = [
    ['GD-1', 'FB1', 'S1', 'D', '원문 하나입니다.', 'AI 교정본입니다.', '', '', '', '조사:주격(이/가·은/는)', '', ''],
    ['GD-2', 'FB2', 'S2', 'D', '저가 학생입니다.', '저는 학생입니다.', GOLD_V[1], '저는 학생이에요.', '', '조사:주격(이/가·은/는)', '', '']
  ];
  const { api, saved } = loadExport(rows);
  api.exportGoldenFixture();
  const doc = JSON.parse(saved().content);
  assert.equal(doc.항목.length, 1, '강사 무응답 행이 픽스처에 섞였다 — AI 출력을 정답으로 채점하게 된다');
  assert.equal(doc.항목[0].입력, '저가 학생입니다.');
});

test('[v9.166] 「AI가 맞았다」 승인 행도 담는다 — 빠지면 재현율 없는 반쪽 채점표가 된다', () => {
  const rows = [['GD-1', 'FB1', 'S1', 'D', '저는 학생입니다.', '저는 학생입니다.', GOLD_V[0], '', '', '오류없음', '', '']];
  const { api, saved } = loadExport(rows);
  api.exportGoldenFixture();
  const doc = JSON.parse(saved().content);
  assert.equal(doc.항목.length, 1, '강사가 승인만 한 행이 통째로 버려졌다');
  assert.equal(doc.항목[0].출처, 'AI교정_강사승인');
  assert.equal(doc.항목[0].종류, '정상', '오류없음 + 원문=교정이면 거짓양성 검사용 정상 항목이다');
});

/* [v9.170] 아래 3건 = Glide 「강사 정답 모음」 조립 중 드러난 구멍. 셋 다 **조용히 틀린 정답**을 만든다 —
 * 픽스처는 정상으로 보이고, 2년 뒤 모델 선택이 그 표를 기준으로 갈린다. */
test('[v9.170] 「원문이 이미 맞다」의 정답은 원문이다 — AI교정을 정답으로 실으면 판정이 뒤집힌다', () => {
  const rows = [['GD-1', 'FB1', 'S1', 'D', '저는 학교에 가요.', '저는 학교에 갑니다.', GOLD_V[2], '', '', '높임:종결어미', '', '']];
  const { api, saved } = loadExport(rows);
  api.exportGoldenFixture();
  const doc = JSON.parse(saved().content);
  assert.equal(doc.항목.length, 1, '강사가 「원문이 맞다」고 답한 행이 버려졌다 — 거짓양성 검사 표본이 사라진다');
  assert.equal(doc.항목[0].기대교정, '저는 학교에 가요.',
    'AI교정이 정답으로 실렸다 — 강사는 AI가 과교정했다고 판정했는데 채점표는 AI를 정답으로 친다');
  assert.equal(doc.항목[0].출처, '원문유지_강사판정');
  assert.deepEqual(doc.항목[0].기대태그, ['오류없음'], 'AI가 붙인 오류태그가 남았다 — 강사가 함께 부정한 태그다');
  assert.equal(doc.항목[0].종류, '정상', '원문=교정이고 태그가 없으면 정상(거짓양성) 표본이다');
});

/* [v9.173] 아래 1건 = 두 저장소 이음매에서 실측된 구멍. SYNK-talk 채점기는 `if (fx.불변)`으로만
 * 거짓양성 검사에 들어가는데 우리가 그 필드를 안 만들고 있었다 — 정상 표본이 오류 항목으로
 * 채점되고, 오류 채점은 포함·불포함·기대태그가 모두 비면 **무조건 통과**라 과교정이 만점이 된다.
 * 계약 c1의 필드 목록에도 없어서 양쪽 회귀가 둘 다 못 봤다(c2에서 추가). */
test('[v9.173] 정상(거짓양성) 표본은 `불변: true` + 기대태그 [오류없음]로 나간다 — 채점기의 유일한 스위치다', () => {
  const rows = [
    ['GD-1', 'FB1', 'S1', 'D', '저는 학교에 가요.', '저는 학교에 갑니다.', GOLD_V[2], '', '', '높임:종결어미', '', ''],
    ['GD-2', 'FB2', 'S2', 'D', '저가 학생입니다.', '저는 학생입니다.', GOLD_V[1], '저는 학생이에요.', '', '조사:주격(이/가·은/는)', '', '']
  ];
  const { api, saved } = loadExport(rows);
  api.exportGoldenFixture();
  const doc = JSON.parse(saved().content);
  const 정상 = doc.항목.filter(x => x.종류 === '정상');
  const 오류 = doc.항목.filter(x => x.종류 === '오류');
  assert.equal(정상.length, 1, '정상 표본이 안 나왔다 — 거짓양성을 잴 항목이 사라진다');
  assert.equal(정상[0].불변, true,
    '`불변`이 없다 — SYNK-talk 채점기가 이 항목을 오류로 채점하고, 포함·불포함이 비어 무조건 통과시킨다');
  assert.deepEqual(정상[0].기대태그, ['오류없음'],
    '채점기는 정상 항목에 태그 하나(`오류없음`)를 요구한다 — 빈 배열이면 그 검사가 죽는다');
  assert.equal(오류[0].불변, false, '오류 항목까지 불변이면 교정 채점이 통째로 건너뛰어진다');
});

test('[v9.176] 정답이 쌓였는데 전송 통로가 안 열려 있으면 월간 계기판이 말한다 — 설치는 6개월 뒤에나 값을 한다', () => {
  const 본문 = section('function dataCoverageMonthly_()', '\n}\n');
  assert.ok(/s\.골든응답 && !PropertiesService\.getScriptProperties\(\)\.getProperty\(GH_TOKEN_KEY\)/.test(본문),
    '통로 미개통을 아무도 말하지 않는다 — 안 해도 그 사이 아무 일이 없어서 「채점표는 있는데 못 읽는」 상태로 2년이 간다');
  assert.ok(/골든픽스처_자동전송_설치\.md/.test(본문), '무엇을 하면 되는지 문서를 지목하지 않는다');
  assert.ok(/내보내기/.test(본문), '대안(드라이브로 받아 옮기기)이 살아 있다는 것을 안 알린다 — 못 하면 막힌 줄 안다');
  assert.equal(/getProperty\(GH_TOKEN_KEY\)\s*\)?\s*[;,]?\s*\n?\s*.*\+\s*(token|tok)/.test(코드만(본문)), false,
    '토큰 값을 메일 본문에 싣는다 — 존재 여부만 봐야 한다');
});

test('[v9.179] 설치 확인은 편집기에서도 돈다 — 확인 수단이 하나뿐이면 그 하나가 막힌 날 영영 모른다', () => {
  // 밑줄 함수는 편집기 드롭다운에 안 뜨고 메뉴는 시트 UI가 필요하다. 이 시트는 무거워
  // 원격에서 못 여는 날이 있다(08-04 렌더러 정지 실측) → 공개 진입점을 하나 둔다.
  assert.ok(/\nfunction checkGoldenPush\(\)/.test(code), '공개 진입점이 없다 — 시트가 안 열리면 확인 방법이 0이 된다');
  const 본문 = section('function checkGoldenPush()', '\n}\n');
  assert.ok(/골든전송점검_\(\)/.test(본문), '점검 본체를 부르지 않는다 — 두 벌이 되면 갈라진다');
  assert.equal(/getProperty\(GH_TOKEN_KEY\)/.test(코드만(본문)), false, '공개 함수가 토큰을 직접 만진다 — 노출 표면에 비밀을 올리지 않는다');
  assert.equal(/UrlFetchApp|method:\s*'put'/.test(코드만(본문)), false, '공개 함수가 직접 네트워크를 친다 — 점검 본체에 위임해야 조준이 한 곳이다');
});

test('[v9.177] 연결 점검은 읽기 전용이고, 실패를 구별해서 말한다 — 설치한 날 확인돼야 설치가 끝난 것이다', () => {
  const 점검 = section('function 골든전송점검_()', '\n}\n');
  assert.equal(/method:\s*'put'|method:\s*'post'|method:\s*'delete'/i.test(코드만(점검)), false,
    '점검이 쓰기를 한다 — 확인하려다 저장소를 건드리면 점검을 못 누르게 된다');
  assert.ok(/api\.github\.com\/repos\/' \+ GH_OWNER \+ '\/' \+ GH_REPO/.test(점검), '저장소 자체를 보지 않는다');
  for (const [코드, 단서] of [['401', '만료'], ['404', 'Repository access'], ['push', 'Read and write']]) {
    assert.ok(점검.includes(코드) && 점검.includes(단서),
      `${코드} 실패에 고칠 곳을 안 알려준다 — 「실패했습니다」 한 줄이면 어디를 손볼지 모른다`);
  }
  assert.equal(/msg:[^}]*\+\s*token/.test(코드만(점검)), false, '토큰 값을 메시지에 싣는다');

  // 보낼 것이 없을 때도 점검 결과를 함께 낸다(여기서 조용히 끝나면 6개월 뒤에나 알게 된다)
  const 전송 = section('function pushGoldenFixture_()', '\n}\n');
  assert.ok(/골든전송점검_\(\)/.test(전송), '보낼 것이 없으면 그냥 끝난다 — 토큰이 맞는지 확인할 방법이 없어진다');
});

/* ── [v9.175] 픽스처 자동 전송 — 바깥으로 나가는 쓰기라 「무엇을 향해 쏘는가」를 못박는다 ── */
const 전송 = () => section('function pushGoldenFixture_()', '\n}\n');

test('[v9.175] 토큰은 소스에 없다 — 스크립트 속성에서만 읽는다', () => {
  const 본문 = 전송();
  assert.ok(/PropertiesService\.getScriptProperties\(\)\.getProperty\(GH_TOKEN_KEY\)/.test(본문),
    '토큰을 스크립트 속성에서 읽지 않는다');
  /* 🚫 여기만은 `코드만()` 으로 감싸지 않는다 — 이 축의 유일한 예외다.
   *   위의 다른 부정 단언들은 「코드가 무엇을 하는가」를 물으니 주석은 과녁 밖이지만,
   *   토큰은 **주석에 붙여넣어도 유출**이다(git 이력에 박히면 되돌릴 수 없다 · 아래 메시지 그대로).
   *   감싸는 순간 「주석에 붙여넣기」가 이 스캐너의 사각이 된다. 그래서 원문 `code` 를 본다. */
  assert.equal(/gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,}/.test(code), false,
    '소스에 GitHub 토큰처럼 생긴 문자열이 있다 — git 이력에 박히면 되돌릴 수 없다');
});

test('[v9.175] 토큰이 로그·반환문으로 새지 않는다 (실패 응답도 잘라서 낸다)', () => {
  const 본문 = 전송();
  assert.equal(/Logger\.log\([^)]*token/.test(코드만(본문)), false, '토큰을 로그에 싣는다 — 실행 로그는 화면에 그대로 뜬다');
  assert.equal(/return[^;]*\+\s*token|token\s*\+/.test(본문.replace(/'Bearer ' \+ token/g, '')), false,
    '토큰을 문자열에 이어 붙여 돌려준다 — 메뉴 alert에 그대로 뜬다');
  assert.ok(/getContentText\(\)\.slice\(0,/.test(본문), 'GitHub 응답 본문을 통째로 돌려준다 — 자르지 않으면 무엇이 섞일지 모른다');
});

test('[v9.175] 조준이 상수다 — 소유자·저장소·경로·브랜치를 인자로 받지 않는다', () => {
  assert.ok(/function pushGoldenFixture_\(\)/.test(code), '인자를 받는다 — 잘못 조준할 여지를 남기면 언젠가 그렇게 된다');
  for (const c of ['GH_OWNER', 'GH_REPO', 'GH_PATH', 'GH_BRANCH']) {
    assert.ok(new RegExp(`const ${c} = '`).test(code), `${c}가 상수로 고정돼 있지 않다`);
  }
  assert.equal(/const GH_PATH = 'evals\/픽스처\.json'/.test(코드정제), false,
    '합성 픽스처를 덮어쓴다 — 유형 커버리지를 재던 표본이 사라진다(둘은 다른 질문에 답한다)');
});

test('[v9.175] 자동 배치에 넣지 않는다 — 바깥으로 나가는 쓰기는 사람이 누를 때만 돈다', () => {
  /* 🔑 이 시험이 #Q101 의 「부정 단언 뒤집힘」 실물이다: 옛 판은 손 접기(CRLF 축만) + 손 자르기라,
   *   줄 끝에 공백 한 칸만 들어가도 `indexOf('\n}\n')` 이 -1 → `slice(i, -1)` 로 **파일 나머지 전부**가
   *   본문이 됐다. 그러면 「배치에 pushGoldenFixture_ 가 없다」가 파일 어딘가의 정의 때문에 뒤집혀
   *   빨개진다. 접기·자르기 둘 다 이음매(`구간()`)가 진다 — 못 찾으면 조용히 넘기지 않고 던진다. */
  const 셋업 = 파일소스(path.join(ROOT, '엔진_셋업확장.js'));
  for (const 배치 of ['morningJobs', 'nightJobs', 'weeklyJobs', 'monthlyJobs']) {
    if (셋업.indexOf(`function ${배치}(`) === -1) continue;
    assert.equal(/pushGoldenFixture_|menuPushGolden/.test(구간(셋업, `function ${배치}(`, '\n}\n')), false,
      `${배치}가 픽스처를 자동 전송한다 — 비가역 외부 쓰기가 승인 없이 도는 경로가 생긴다`);
  }
});

test('[v9.175] 메뉴에 등록돼 있다 — 만들어도 안 불리면 없는 것이다', () => {
  const 셋업 = 파일소스(path.join(ROOT, '엔진_셋업확장.js'));
  assert.ok(/function menuPushGolden\(\)\s*\{\s*menuRun_\(pushGoldenFixture_\);/.test(셋업), '메뉴 래퍼가 없다');
  assert.ok(/addItem\('[^']*SYNK-talk[^']*', 'menuPushGolden'\)/.test(셋업),
    'onOpen 메뉴에 항목이 없다 — 함수는 있는데 누를 자리가 없다(등록층 누락)');
});

/* [2026-08-07] 같은 사고 3번째라 개별 수정을 접고 규칙으로 올렸다.
 *   ①08-03 `migrateConsentV186` — 유호님 "어디 있냐" → 그때 그것 하나만 메뉴에 올렸다.
 *   ②08-07 `createInterviewLogForm` — 유호님 "아무리 찾아도 없더라고".
 *   ③같은 날 실측 `createTeacherMemoForm` — 아무도 안 물었을 뿐 같은 상태였다.
 *   원인은 함수가 아니라 **표기와 실행 경로가 따로 논 것**이다: Code.js 는 `(▶…)` 로
 *   "사람이 누른다"고 적는데, 누를 자리(onOpen 메뉴)는 손으로 따로 올려야 했다.
 *   ⚠ 검사 축이 「정의가 살아 있는 것」인 이유 — 대체된 구판(`migrateConsentV185`)은 주석에만
 *   남고 정의가 지워진다. 주석만 보고 요구하면 **버그가 아직 있을 것을 요구하는 회귀**가 된다. */
test('[2026-08-07] ▶ 표기는 메뉴가 실행 경로다 — 편집기 드롭다운은 비개발자에게 경로가 아니다', () => {
  const 셋업 = 파일소스(path.join(ROOT, '엔진_셋업확장.js'));
  const code = 파일소스(path.join(ROOT, 'Code.js'));
  const 손실행 = [...new Set([...code.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\(▶/g)].map((m) => m[1]))];
  assert.ok(손실행.length >= 3, `Code.js 의 (▶ 표기를 못 찾았다 — 표기가 바뀌었으면 이 검사부터 고친다(현재 ${손실행.length}건)`);

  const 살아있음 = 손실행.filter((fn) => {
    const re = new RegExp(`^function ${fn}\\s*\\(`, 'm');
    return fs.readdirSync(ROOT).filter((n) => n.endsWith('.js'))
      .some((n) => re.test(fs.readFileSync(path.join(ROOT, n), 'utf8')));
  });
  assert.ok(살아있음.length >= 3, `정의가 살아 있는 ▶ 함수가 ${살아있음.length}건뿐이다 — 검사가 헛돈다`);

  for (const fn of 살아있음) {
    assert.ok(new RegExp(`menuRun_\\(${fn}\\)`).test(셋업),
      `${fn} 은 Code.js 가 (▶ 로 "사람이 누른다"고 적었는데 메뉴 래퍼가 없다 — 실행 경로가 편집기뿐이다`);
    const 래퍼 = (셋업.match(new RegExp(`function (menu[A-Za-z0-9_]*)\\(\\)\\s*\\{\\s*menuRun_\\(${fn}\\)`)) || [])[1];
    assert.ok(래퍼 && new RegExp(`addItem\\('[^']*', '${래퍼}'\\)`).test(셋업),
      `${fn} 은 래퍼(${래퍼})만 있고 onOpen 메뉴에 항목이 없다 — 누를 자리가 없으면 없는 것이다(등록층 누락)`);
  }
});

test('[v9.175] 두 출구가 같은 문서 생성부를 쓴다 — 비식별 규칙이 한쪽에서만 갱신되면 조용히 샌다', () => {
  for (const fn of ['function exportGoldenFixture_()', 'function pushGoldenFixture_()']) {
    const 본문 = section(fn, '\n}\n');
    assert.ok(/골든픽스처_\(\)/.test(본문), `${fn}가 문서 생성부를 따로 조립한다 — 두 벌이 되면 갈라진다`);
  }
});

test('[v9.174] 대조 근거가 없는 오류 표본은 「채점불가」로 따로 센다 — 표본 부족이 점수로 위장된다', () => {
  // 전면 재작성이라 어절 diff가 비고(추측을 확신처럼 적지 않는다) 오류태그 열도 빈 행.
  // SYNK-talk 채점기는 이런 항목을 분모에서 빼므로, 내보낸 건수만 보면 채점 가능 수를 오해한다.
  const rows = [['GD-1', 'FB1', 'S1', 'D', '어제 친구 만나서 밥 먹고 영화 봤다',
    '어제는 친구를 만나 저녁을 먹은 뒤 영화를 보았습니다', GOLD_V[1], '어제는 친구를 만나 저녁을 먹은 뒤 영화를 보았습니다', '', '', '', '']];
  const { api, saved } = loadExport(rows);
  api.exportGoldenFixture();
  const doc = JSON.parse(saved().content);
  assert.equal(doc.항목.length, 1);
  assert.deepEqual([doc.항목[0].포함, doc.항목[0].불포함, doc.항목[0].기대태그], [[], [], []],
    '전제가 깨졌다 — 이 행은 대조 근거가 하나도 없어야 이 검사가 의미를 갖는다');
  assert.ok(doc.한계.some(l => /채점 불가 1건/.test(l)),
    '채점 불가 건수를 안 센다 — 「N건 내보냄」이 N건 채점 가능으로 읽힌다');
});

test('[v9.170] 「고칠 곳이 있다」인데 교정칸이 비면 픽스처가 아니다 — 반쪽 응답은 정답이 아니다', () => {
  const rows = [['GD-1', 'FB1', 'S1', 'D', '저가 학생입니다.', '저는 학생입니다.', GOLD_V[1], '', '', '조사:주격(이/가·은/는)', '', '']];
  const { api, saved } = loadExport(rows);
  api.exportGoldenFixture();
  const doc = JSON.parse(saved().content);
  assert.equal(doc.항목.length, 0,
    '강사가 「AI가 틀렸다」고만 하고 교정을 안 적었는데 그 AI교정이 정답으로 실렸다');
  assert.ok(doc.한계.some(l => /제외 1건/.test(l)),
    '반쪽 응답이 제외 수에 안 잡혔다 — 픽스처가 「다 채워졌다」로 보인다');
});

test('[v9.170] 모르는 판정 문자열은 정답으로 치지 않는다 — Glide 옵션표가 어긋나면 조용히 오염된다', () => {
  const rows = [['GD-1', 'FB1', 'S1', 'D', '저가 학생입니다.', '저는 학생입니다.', '대충 맞음', '', '', '', '', '']];
  const { api, saved } = loadExport(rows);
  api.exportGoldenFixture();
  const doc = JSON.parse(saved().content);
  assert.equal(doc.항목.length, 0, 'GOLD_VERDICTS에 없는 판정이 AI교정을 정답으로 승격시켰다');
});

test('[v9.166] diff는 교정 지점을 뽑고, 확신이 없으면 비운다', () => {
  const { api } = loadExport([]);
  const d = api.fixtureDiff_('저가 몽골 사람입니다.', '저는 몽골 사람입니다.');
  assert.deepEqual(d.불포함, ['저가'], '틀린 어절을 못 짚었다');
  assert.deepEqual(d.포함, ['저는'], '고친 어절을 못 짚었다');
  // 1글자는 우연히 겹쳐 근거가 못 된다
  assert.equal(api.fixtureDiff_('나 밥 먹다', '나 밥 먹었다').포함.some(w => w.length < 2), false);
  // 전면 재작성이면 「이 단어가 핵심」이라는 의미를 잃는다 → 빈 배열(추측을 확신처럼 적지 않는다)
  const 전면 = api.fixtureDiff_('어제 친구 만나서 밥 먹고 영화 봤다', '어제는 친구를 만나 저녁을 먹은 뒤 영화를 보았습니다');
  assert.deepEqual(전면, { 포함: [], 불포함: [] }, '전면 재작성인데 일부 어절을 근거로 내놨다');
  assert.deepEqual(api.fixtureDiff_('', '저는 학생입니다'), { 포함: [], 불포함: [] });
});

test('[v9.166] 역소독은 수식 문자 앞의 아포스트로피만 벗긴다', () => {
  const { api } = loadExport([]);
  assert.equal(api.역소독_("'=IMPORTDATA(x)"), '=IMPORTDATA(x)', '소독 흔적이 픽스처 입력에 그대로 남는다');
  assert.equal(api.역소독_("'-저는 학생입니다"), '-저는 학생입니다');
  assert.equal(api.역소독_("'저는 학생입니다"), "'저는 학생입니다", '문장이 정당하게 쓴 아포스트로피를 벗겼다');
  assert.equal(api.역소독_(''), '');
});

test('[v9.166] 커버리지 월간 발화 — 배선·침묵 조건이 발송보다 앞에 있다', () => {
  // ① 어느 트리거에도 안 걸리면 영원히 안 돈다(강사 정답 모음과 같은 형태의 실패)
  const mj = section('function monthlyJobs()', 'function runExecReportNow');
  assert.ok(mj.includes("safeRun('dataCoverageMail', dataCoverageMonthly_)"),
    '커버리지 월간 발화가 monthlyJobs에 없다 — 계기판이 다시 사람 기억에 걸린다');
  // ② 개원 전(재원 0) 침묵과 ⚠️ 없을 때 침묵이 **메일 발송보다 앞에** 있어야 한다.
  //    순서가 뒤집히면 「정상인데 매달 오는 메일」이 되고, 그러면 정작 필요할 때 안 읽힌다.
  const fn = section('function dataCoverageMonthly_()', '\n}\n');
  const i재원 = fn.indexOf('if (!s.재원)');
  const i경고 = fn.indexOf("indexOf('⚠️') === -1");
  const i메일 = fn.indexOf('MailApp.sendEmail');
  assert.ok(i재원 > -1 && i경고 > -1 && i메일 > -1, '침묵 조건 또는 발송부가 사라졌다');
  assert.ok(i재원 < i메일 && i경고 < i메일, '침묵 조건이 발송 뒤에 있다 — 조용해야 할 때 메일이 나간다');
  assert.ok(fn.indexOf('quotaOk(1)') > -1 && fn.indexOf('quotaOk(1)') < i메일, '메일 쿼터 가드 없이 발송한다');
});

/* ────────── [v9.197] 자기선언 이력 — 셀 덮어쓰기로 사라지던 3칸 ──────────
 * 지키는 것 = 「그날 학생이 무엇을 선언했는지」. 드림한줄·최애·몬스터이름은 앱이 Set Column 으로
 * 덮어쓰는 «셀»이라 바뀌는 순간 이전 값이 영영 없다(엔진도달 전수감사 ㉠ = 수집의 최악 형태).
 * 판정 코어는 순수 함수라 시트 없이 실값으로 돌린다 — 문자열 검사보다 강한 증거. */
function loadSelfDeclare() {
  const s = code.indexOf('function selfDeclareDiff_(');
  assert.notEqual(s, -1, 'selfDeclareDiff_ 정의를 찾지 못함');
  const e = code.indexOf('function selfDeclareLogNightly_(', s);
  assert.notEqual(e, -1, 'selfDeclareDiff_ 끝 표식을 찾지 못함');
  return new Function(code.slice(s, e) + '\nreturn selfDeclareDiff_;')();
}

test('[v9.197] 자기선언 — 바뀐 것만 적고, 안 바뀌면 한 줄도 안 적는다', () => {
  const diff = loadSelfDeclare();
  const last = {};
  // ① 첫 관측: 값이 있는 칸만 적힌다(빈칸까지 적으면 전 학생 × 3줄이 의미 없이 깔린다)
  const 첫날 = diff([{ sid: 'S1', 필드: '드림한줄', 값: '한국 대학 가기' },
                     { sid: 'S1', 필드: '최애', 값: '' },
                     { sid: 'S2', 필드: '드림한줄', 값: '  ' }], last, '2026-08-08');
  assert.deepEqual(첫날, [['S1', '드림한줄', '한국 대학 가기', '2026-08-08']]);
  // ② 같은 값으로 다시 돌면 쓰기 0 — 매일 도는 배치라 여기가 새면 이력이 중복으로 폭발한다
  assert.equal(diff([{ sid: 'S1', 필드: '드림한줄', 값: '한국 대학 가기' }], last, '2026-08-09').length, 0);
  // ③ 바뀌면 «옛 값을 지우지 않고» 새 줄이 는다 — 이 한 줄이 ㉠ 수리의 전부다
  assert.deepEqual(diff([{ sid: 'S1', 필드: '드림한줄', 값: '서울대 가기' }], last, '2026-08-10'),
    [['S1', '드림한줄', '서울대 가기', '2026-08-10']]);
  // ④ 값이 있던 칸을 «비운 것»도 선언이다(마음이 바뀐 시점 자체가 재료다)
  assert.deepEqual(diff([{ sid: 'S1', 필드: '드림한줄', 값: '' }], last, '2026-08-11'),
    [['S1', '드림한줄', '', '2026-08-11']]);
  // ⑤ 그 뒤로 계속 비어 있으면 다시 안 적는다
  assert.equal(diff([{ sid: 'S1', 필드: '드림한줄', 값: '' }], last, '2026-08-12').length, 0);
  // ⑥ 같은 값이라도 필드가 다르면 다른 이력이다(키가 sid 하나면 서로를 덮는다)
  assert.equal(diff([{ sid: 'S1', 필드: '최애', 값: '서울대 가기' }], last, '2026-08-12').length, 1);
  // ⑦ student_id 공란 행(유령 행 — profilesIntegrity가 따로 잡는다)은 이력에 안 들어간다
  assert.equal(diff([{ sid: '', 필드: '최애', 값: 'BTS' }], last, '2026-08-12').length, 0);
});

test('[v9.197] 자기선언 — 읽는 열이 라이브 헤더 자리와 같은가', () => {
  // 열 번호가 두 곳에 손으로 적혀 있다(헤더 보장부 A1 표기 ↔ 이 장부의 숫자).
  // 어긋나면 «엉뚱한 칸»이 이력에 쌓이는데, 값이 채워지긴 하므로 아무 데서도 안 빨개진다.
  const a1col = (s) => s.split('').reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0);
  const m = code.match(/const SELF_DECLARE_COLS_ = \[([\s\S]*?)\];/);
  assert.ok(m, 'SELF_DECLARE_COLS_ 장부를 찾지 못함');
  const 장부 = {};
  m[1].replace(/\['([^']+)',\s*(\d+)\]/g, (_, 명, n) => { 장부[명] = Number(n); return ''; });
  assert.deepEqual(Object.keys(장부).sort(), ['드림한줄', '몬스터이름', '최애'], '읽는 칸 3종이 아니다');
  [['드림한줄', 'CB'], ['최애', 'DA'], ['몬스터이름', 'AO']].forEach(([명, a1]) => {
    assert.ok(new RegExp(`getRange\\('${a1}1'\\)`).test(code), `${명} 헤더 보장부(${a1}1)가 사라졌다`);
    assert.equal(장부[명], a1col(a1), `${명} 열 번호가 헤더 자리(${a1})와 어긋난다 — 엉뚱한 칸이 이력에 쌓인다`);
  });
});

/* 줄어듦 감시 — append-only 장부의 자기검사. 워치독의 「누락 시트」는 이 사고를 못 본다(야간 배치가
 * 매일 ensureSheet 로 되살리니 주간 워치독이 볼 땐 탭이 있다). ①배포 검수 P1 이 지적한 자리. */
function loadShrinkGuard(props, mails) {
  const s = code.indexOf("const SELF_DECLARE_HWM_ = '");
  assert.notEqual(s, -1, 'SELF_DECLARE_HWM_ 을 찾지 못함');
  const e = code.indexOf('function aiFeedbackHealth_(', s);
  assert.notEqual(e, -1, 'selfDeclareShrinkGuard_ 끝 표식을 찾지 못함');
  const PropertiesService = { getScriptProperties: () => ({
    getProperty: (k) => (k in props ? props[k] : null),
    setProperty: (k, v) => { props[k] = String(v); } }) };
  return new Function('adminMail', 'PropertiesService', 'SELF_DECLARE_TAB_',
    code.slice(s, e) + '\nreturn selfDeclareShrinkGuard_;')(
    (subject) => mails.push(subject), PropertiesService, 'self_declare_log');
}

/* 기록 n건짜리 시트 — 마지막 «행 인덱스»와 «남은 기록 수»를 따로 준다(가운데를 파낸 삭제를 흉내낸다). */
function 이력시트(ids) {
  return { getName: () => 'self_declare_log', // [v9.241] 공용 통로가 탭 이름으로 기준선 키를 짓는다
    getLastRow: () => ids.length + 1,
    getRange: (r, c, nRows) => ({ getValues: () => ids.slice(0, nRows).map(v => [v]) }) };
}

test('[v9.197] 자기선언 — 이력이 줄면 외친다(탭 삭제·이름 변경·잘림이 같은 증상)', () => {
  const props = {}, mails = [];
  const guard = loadShrinkGuard(props, mails);
  const 채움 = (n) => 이력시트(Array.from({ length: n }, (_, i) => 'S' + i));
  assert.equal(guard(채움(40)), 40, '기준선 건수를 안 돌려준다 — 부르는 쪽이 같은 단위로 못 올린다');
  assert.deepEqual(mails, [], '① 첫 관측은 기준선만 잡고 조용해야 한다');
  guard(채움(57));  // ② 늘어난 것은 정상
  assert.deepEqual(mails, []);
  guard(채움(12));  // ③ 줄었다 = 소급 불가 데이터가 사라진 것
  assert.equal(mails.length, 1, '이력이 줄었는데 아무도 안 외쳤다 — 지워진 선언은 다시 못 받는다');
  assert.match(mails[0], /줄었다/);
  guard(채움(12));  // ④ 같은 상태로 매일 같은 메일을 보내지 않는다(새 기준으로 간다)
  assert.equal(mails.length, 1, '같은 이상을 매일 재통보한다 — 알림이 소음이 되면 안 읽힌다');
});

test('[v9.197] 자기선언 — 가운데를 파낸 삭제도 잡는다(마지막 행은 그대로다)', () => {
  /* ①배포 검수 P2: `getLastRow()` 는 «마지막» 비지 않은 행만 말한다. 중간 기록을 지우면
   * 그 값이 그대로라 행 인덱스로 재는 감시는 통째로 눈이 먼다 — 그래서 실제 기록 수를 센다. */
  const props = {}, mails = [];
  const guard = loadShrinkGuard(props, mails);
  const 온전 = { getName: () => 'self_declare_log', getLastRow: () => 6, getRange: () => ({ getValues: () => [['S1'], ['S2'], ['S3'], ['S4'], ['S5']] }) };
  const 파냄 = { getName: () => 'self_declare_log', getLastRow: () => 6, getRange: () => ({ getValues: () => [['S1'], [''], [''], [''], ['S5']] }) };
  guard(온전);
  assert.deepEqual(mails, []);
  guard(파냄); // 마지막 행 인덱스는 6 그대로인데 기록은 5 → 2 로 줄었다
  assert.equal(mails.length, 1, '중간을 파낸 삭제를 못 본다 — 행 인덱스만 재면 이 형태가 영원히 조용하다');
});

test('[v9.197] 자기선언 — 학생 행만 적는다(학부모·강사·DEMO 제외)', () => {
  // profiles 에는 role 이 parent/teacher/director 인 행과 DEMO- 시연 행이 함께 산다(syncProfiles 가 보존한다).
  // 그 값까지 학습자 선언으로 적으면 나중에 원료가 «조용히» 오염된다 — 걸러진 뒤라 어디서도 안 빨개진다.
  const fn = section('function selfDeclareLogNightly_()', '\n/* 줄어들면 외친다');
  assert.match(fn, /!==\s*'student'/, 'role 이 student 인 행만 적는다는 판정이 없다');
  assert.match(fn, /indexOf\('DEMO-'\) === 0/, 'DEMO- 시연 행을 안 걸러낸다');
  assert.match(fn, /getRange\(2,\s*1,\s*n,\s*4\)/, 'role(D열)까지 안 읽는다 — 읽지도 않고 거를 수는 없다');
});

test('[v9.197] 자기선언 — 읽기→차이→쓰기가 직렬화된다', () => {
  // 야간 배치와 손 실행이 겹치면 둘이 같은 getLastRow()+1 을 잡아 뒤엣것이 앞엣것을 덮는다.
  // 덮이는 것이 「다시 물어볼 수 없는 선언」이라 여기만은 append 를 잠근다(저장소의 다른 8곳과 같은 통로).
  const fn = section('function selfDeclareLogNightly_()', '\n/* 줄어들면 외친다');
  assert.ok(fn.includes('LockService.getScriptLock()'), '잠금 없이 append 한다');
  const i잠금 = fn.indexOf('tryLock'), i읽기 = fn.indexOf('getLastRow() >= 2'), i쓰기 = fn.indexOf('writeIfChanged(');
  assert.ok(i잠금 > -1 && i잠금 < i읽기 && i읽기 < i쓰기, '잠금이 읽기보다 뒤에 있다 — 그럼 읽은 값이 이미 낡았다');
  assert.ok(/finally\s*\{\s*lock\.releaseLock\(\)/.test(fn), 'finally 로 안 풀면 예외 한 번에 다음 밤들이 통째로 막힌다');
  // ① 잠금을 못 잡았을 때 «조용히» 끝내면 「안 돌았다」와 「바뀐 게 없었다」가 같은 모양이 된다.
  assert.match(fn, /tryLock\(30000\)\)\s*throw new Error/, '잠금 실패를 조용한 0 으로 삼킨다 — 그 밤의 관측이 기록 없이 사라진다');
  // ② 줄어듦 감시는 잠금 «밖»이어야 한다 — 그 안의 adminMail 이 같은 스크립트 잠금을 다시 잡는다(비재진입).
  assert.ok(fn.indexOf('selfDeclareShrinkGuard_(log)') < i잠금,
    '줄어듦 감시가 잠금 안에 있다 — adminMail 이 같은 잠금을 재획득해 매일 밤 같은 자리에서 죽는다');
  /* ③ 기준선은 «쓴 뒤 시트를 다시 세어» 올린다. 잠금 밖에서 읽어 둔 수에 더하면 그 사이 남이 적은
   *    줄만큼 모자라게 박히고, 그만큼의 삭제가 다음 밤에 안 보인다(감시가 헐거워지는 방향으로 샌다). */
  /* [v9.241] 키 이름은 `탭수축키_(SELF_DECLARE_TAB_)` 로 옮겼다(옛 키에 쓰면 승계가 밤마다 되살아난다 —
   *   ①배포 검수 2회차 P2). 여기서 지키는 사실은 그대로다: **기준선을 실측으로 올린다.** */
  assert.match(fn, /setProperty\(탭수축키_\(SELF_DECLARE_TAB_\),\s*String\(selfDeclareCount_\(log\)\)\)/,
    '기준선을 실측이 아니라 더하기로 올린다 — 감시가 조용히 헐거워진다');
});

test('[v9.197] 자기선언 — 배선 4자리(안 걸리면 영원히 안 돈다)', () => {
  const nj = section('function nightJobs()', 'function dailyBackupJob(');
  // ⚠ 「문자열이 있나」로는 부족하다 — 주석 처리한 줄도 그대로 통과한다(변이가 실측했다).
  //    줄머리 앵커로 «살아 있는 호출»만 센다. 새는 방향은 언제나 「통과」다.
  assert.ok(/^\s*safeRun\('selfDeclareLog', selfDeclareLogNightly_\)/m.test(nj),
    '야간 배치에 «살아 있는» 호출이 없다 — 코드는 있는데 아무도 안 부르는 상태가 된다(강사 정답 모음과 같은 형태)');
  assert.ok(/\[SELF_DECLARE_TAB_, SELF_DECLARE_HEADERS[,\]]/.test(code),
    'SHEET_SKELETON에 없다 — 원버튼 재건 뒤 이력 탭이 사라진다');
  /* [v9.241] 워치독의 손 목록(`reqSheets`)이 **골격 도출**로 바뀌었다(대기열 #Q89). 지키는 사실은 그대로다 —
   *   「이 탭이 워치독 눈에 든다」. 이제 그 답은 위 골격 등재가 지고, 워치독은 거기서 파생한다.
   *   그리고 존재 검사만으로는 이 탭의 사고를 못 본다(ensureSheet 가 빈 시트로 되살린다) —
   *   그래서 수집 표식으로 «몇 줄 남았나»까지 함께 잰다. 전문 회귀 = tests/수집탭워치독.test.js. */
  assert.ok(/const 골격탭 = sheetSkeleton_\(\)/.test(code),
    '워치독이 골격에서 도출하지 않는다 — 손 목록으로 되돌아가면 새 시트가 감시 밖으로 샌다');
  assert.ok(/\[SELF_DECLARE_TAB_, SELF_DECLARE_HEADERS, 수집표식_\]/.test(code),
    '자기선언 탭에 수집 표식이 없다 — 탭이 지워져도 배치는 정상을 보고한다(소급 불가)');
  const fn = section('function selfDeclareLogNightly_()', '\nfunction aiFeedbackHealth_');
  assert.ok(fn.includes('writeIfChanged('), '소독 통로를 안 쓴다 — 학생이 친 `=`가 라이브 수식이 된다');
  assert.equal(/appendRow\(/.test(코드만(fn)), false, 'appendRow 직기입은 소독 우회다(v9.157)');
});
