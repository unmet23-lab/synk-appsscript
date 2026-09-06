/* [반출 통로] 「학생을 식별하는 데이터를 밖으로 내보내지 않는다」를 **기계가 재는** 자리.
 *
 * ■ 왜 이 파일이 있나 (2026-08-29 실측)
 *   저장소 지침이 기계로 막는 것은 넷이다(자격증명·라이브 배포·비가역 실행·커밋 범위).
 *   그런데 세션 요약에는 **「학생 식별 데이터 반출 금지」가 다섯째 잠금**으로 함께 뜬다.
 *   실측하니 그 축을 «값으로» 재는 기계는 `tools/geminilm-export.js` 의 `scanPII` 하나뿐이었고,
 *   **나가는 자리 자체를 세는 기계는 0벌**이었다. 실제로 이름 반출을 막고 있던 것은
 *   `const STORY_AI_ON = false;` 한 글자와 주석 몇 줄이다.
 *   정본 = `docs/제품방향.md` 설계 불변식 4(유호 확정 08-05 · A안 08-06) · `docs/SYNK_철학.md` Ⅰ㉣.
 *
 * ■ 이 파일이 재는 것 셋
 *   ① **나가는 자리 인구조사** — `UrlFetchApp.fetch` 자리 수를 벤더별로 소스에서 세어
 *      아래 선언표와 대조한다. 자리가 늘거나 줄면 **그 커밋에서** 빨개진다.
 *   ② **식별자 소스 검사** — AI 헬퍼(`aiText_`·`aiCall_`·`callClaude*_`)로 «가는 인자»에
 *      실명·이메일·연락처가 문자열 결합으로 실리는가.
 *   ③ **음성 반출 단일 문** — 학생 음성이 나가는 통로가 하나이고, 그 하나가 보내기 직전
 *      동의를 다시 확인하는가.
 *
 * ■ 🔑 설계 — 이 파일이 스스로 지키는 규율
 *   · **수는 여기 한 곳에만 산다.** 자리 수를 코드 주석과 테스트가 각자 알면 반드시 갈린다
 *     (`constant-known-in-two-places` · 실제로 `엔진_두뇌.js` 주석이 갈려 있다 — 아래 ①-나).
 *   · **줄 번호를 안 적는다.** 08-29 검증 중 7분 만에 두 자리의 줄 번호가 103줄 밀렸다
 *     — 줄 번호로 못박은 표는 태어나는 순간 틀린다. 파일·함수·벤더로 못박는다.
 *   · **분모를 손으로 안 적는다.** 검사 대상 파일은 `.claspignore` 에서 파생하는
 *     `liveFiles()`(라이브에 실제로 올라가는 .js 전량)에서 온다.
 *   · **「0건」이 성공 얼굴을 못 하게** — 분모가 비면 그 자체로 빨개진다.
 *   · 🔴 **구간을 자를 땐 못 찾으면 던진다.** `indexOf` 가 -1 인데 그대로 `slice` 에 먹이면
 *     오류가 아니라 «파일 끝까지»가 나온다 — 아래 `함수본문_` 머리말이 그 실사고를 적는다.
 *
 * ■ 이 검사가 «안» 보는 것 (「없다」가 아니다)
 *   · 형제 저장소(SYNK-talk·Supabase 엣지 함수) — 과녁 밖(`cross-repo-blindness`).
 *   · 나가는 «내용»의 런타임 실값. 소스만 본다 — 변수에 담겨 흐르는 식별자는 못 쫓는다.
 *   · 사람에게 나가는 축(`MailApp`·`adminMail`). 여기는 **모델·외부 API 로 나가는 축**만 잰다.
 *   · 스크립트 속성에만 있는 목적지(`ROSTER_INGEST_URL`) — 소스로는 못 잰다. 아래 「변수URL」로 분류한다.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ROOT, liveFiles } = require('./_engine-source');
const { 코드만 } = require('./lib/소스검사');

const 원문 = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const 소스 = (f) => 코드만(원문(f));

/* ── 구간 자르기 — 이 파일의 모든 「함수 하나만 본다」가 여기를 지난다 ──────────
 * 🔴 [08-30 실사고 · 이 자리가 조용히 무너져 있었다]
 *   첫 판은 끝 표식을 **주석**(절 구분선)으로 잡았다. 그런데 `코드만` 이 주석을 걷어내므로
 *   그 문자열은 검사하는 소스에 **아예 없다**. `indexOf` 가 -1 을 주고 `slice(시작, -1)` 은
 *   오류가 아니라 **파일 끝까지**를 준다. 실측(당시):
 *       stt요청_ 구간 = 22,689자 (진짜 함수는 920자) · voiceSttStatus 구간 = 17,865자
 *   그래서 ㉮ `assert.ok(/throw new Error/.test(문))` 은 파일 꼬리 어디에 throw 가 있어도
 *   통과하는 **빈 단언**이었고, ㉯ 그 뒤에 무관한 함수가 하나 들어오면 **거짓 사유로 빨개졌다**
 *   (「진단이 직접 fetch 한다」 — 진단 함수는 fetch 를 안 하는데도).
 *
 * ⇒ 규율 셋. **주석을 표식으로 쓰지 않는다**(주석 제거 뒤에도 남는 함수 선언만) ·
 *   **못 찾으면 그 자리에서 던진다**(0을 성공 얼굴로 만들지 않는다) ·
 *   **끝은 그 함수의 중괄호가 정한다** — 「다음 함수 선언」을 끝으로 삼는 판도 지어서 재봤는데,
 *   다음 함수가 한 칸이라도 들여쓰이면 구간이 그것까지 삼켰다(실측으로 확인). 짝맞추기는
 *   바깥 것을 원리상 못 삼킨다. 이 파일 톱레벨 함수 26벌에서 두 방식 결과가 같음을 대조했다
 *   (다른 셋은 함수 사이의 톱레벨 `const` 몇 줄 차이 — 짝맞추기 쪽이 더 좁다).
 *   ⚠ 문자열 리터럴은 건너뛰지만 **정규식 리터럴 안의 중괄호는 못 가린다**(이 파일엔 없음을
 *     위 26벌 대조로 확인 · 새로 생기면 아래 「안 닫힌다」로 드러난다). */
function 함수본문_(src, 선언) {
  const a = src.indexOf(선언);
  if (a === -1) {
    throw new Error(`구간 표식을 못 찾았다: «${선언}» — 함수 이름이 바뀌었으면 이 검사도 같이 고쳐라.\n`
      + '  (못 찾은 채 넘어가면 slice 가 파일 끝까지를 주고, 이 파일의 단언이 통째로 빈 단언이 된다)');
  }
  let i = src.indexOf('{', a);
  if (i === -1) throw new Error(`구간이 함수로 안 닫힌다: «${선언}» — 여는 중괄호가 없다`);
  let 깊이 = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {            // 문자열 안의 중괄호는 세지 않는다
      const q = c;
      for (i++; i < src.length && src[i] !== q; i++) if (src[i] === '\\') i++;
      continue;
    }
    if (c === '{') 깊이++;
    else if (c === '}' && --깊이 === 0) return src.slice(a, i + 1);
  }
  throw new Error(`구간이 함수로 안 닫힌다: «${선언}» — 중괄호 짝이 안 맞는다(구간이 파일 끝까지 샜다)`);
}

/* ══════════════════════════════════════════════════════════════════
 * ① 나가는 자리 인구조사
 * ══════════════════════════════════════════════════════════════════ */

/** 벤더 판정 — `UrlFetchApp.fetch(` 바로 뒤 인자에 보이는 호스트 리터럴로 가른다. */
const 벤더표_ = [
  ['anthropic', /api\.anthropic\.com/],
  ['GoogleSTT', /speech\.googleapis\.com/],
  ['GoogleOAuth', /oauth2\.googleapis\.com/],
  ['GoogleSlides', /docs\.google\.com/],
  ['MetaGraph', /graph\.facebook\.com/],
  ['GitHub', /api\.github\.com/],
  ['GoogleDrive', /drive\.google\.com/],   // [2026-09-02 · 가져가는것 걸음1] 순간 사진 축소본(썸네일 통로) — 나가는 것은 file id 하나
];

/** 🔑 **선언표 — 이 저장소에서 이 수가 사는 유일한 자리다.**
 *  자리 = (파일, 벤더) 쌍. 줄 번호는 일부러 없다(위 설계 절).
 *  ⚠ 늘리거나 줄일 때는 반드시 그 커밋에서 여기를 같이 고친다 — 그게 이 검사의 전부다. */
const 나가는자리_ = [
  { file: '상담AI.js',        vendor: 'anthropic',    n: 3, 뭐: '상담 응답 · 인계 초안 · 역번역' },
  { file: '엔진_콘텐츠AI.js', vendor: 'anthropic',    n: 3, 뭐: '첨삭 · 공용 헬퍼 aiCall_ · aiText_' },
  { file: '엔진_두뇌.js',     vendor: 'anthropic',    n: 1, 뭐: '벤더 중립 어댑터(3층)' },
  { file: '엔진_수집.js',     vendor: 'anthropic',    n: 1, 뭐: 'callClaudeTalk_(대화)' },
  { file: '교재연동.js',      vendor: 'GoogleSTT',    n: 1, 뭐: '🔒 stt요청_ — 학생 음성이 나가는 유일한 문(08-29 통합 전 2자리)' },
  { file: '교재연동.js',      vendor: 'GoogleOAuth',  n: 1, 뭐: '서비스 계정 토큰 발급(학생 데이터 0)' },
  { file: '엔진_폼리포트.js', vendor: '변수URL',      n: 1, 뭐: 'exportSlidePng — url 변수에 docs.google.com 이 담긴다(학생 데이터 0)' },
  { file: '엔진_폼리포트.js', vendor: 'GoogleDrive',  n: 1, 뭐: 'momentCopyOne_ — 순간 사진 축소본(drive.google.com/thumbnail · 우리 Drive 안 왕복 · 나가는 것 = 우리 file id + 우리 OAuth 토큰 · 학생 식별 데이터 0 · 사진은 «들어오는» 방향)' },
  { file: '상담AI.js',        vendor: 'MetaGraph',    n: 2, 뭐: '메신저 발송 · 프로필 조회' },
  { file: '만족도팩.js',      vendor: 'MetaGraph',    n: 1, 뭐: '메신저 발송' },
  { file: '엔진_수집.js',     vendor: 'GitHub',       n: 1, 뭐: '골든 픽스처 push — 저장소 공개 여부 조회(리터럴 api.github.com)' },
  /* 🔴 아래 둘은 `const api = 'https://api.github.com/…'` 를 거쳐 나가 리터럴 검사에 안 잡힌다.
   *   실려 나가는 것 = `evals/픽스처_실학생.json`(학생 문장 원문 · 코드가 「비식별 조립」이라 적는다).
   *   ⚠ 그 자리 주석은 *"대상 저장소는 비공개임을 실측 확인했다(2026-08-04)"* 라 적는데,
   *     기억 `repos-are-public` 의 **08-27 실측은 PUBLIC** 이다 — 주석이 스스로 이름 붙인 실패
   *     조건이 지금 성립한다. 이 트랙은 그 파일을 못 만지므로 **여기 적어 드러내기만 한다**(유호 판정 자리). */
  { file: '엔진_수집.js',     vendor: '변수URL',      n: 2, 뭐: '🔴 골든 픽스처 읽기·쓰기(GitHub contents API · 목적지가 변수라 리터럴로 안 잡힌다)' },
  { file: '엔진_운영배치.js', vendor: '변수URL',      n: 1, 뭐: '🔴 명부스윕_ — ROSTER_INGEST_URL(우리 백엔드). profiles A:H 전량이 나간다' },
  { file: '엔진_자율일.js',   vendor: '변수URL',      n: 2, 뭐: '🔴 자율일다리_ · 자율일말하기제출_ — SUNDAY_BUNDLE_URL·SUNDAY_PROGRESS_URL(우리 백엔드 talk · 09-07). 나가는 것 = 학생ID + 그날 묶음(문항·문장·오답 고리) · 들어오는 것 = 배정ID별 항목 충족 목록' },
];
const 선언합계_ = 나가는자리_.reduce((a, r) => a + r.n, 0);

function 실측자리_() {
  const 표 = new Map();   // "file|vendor" -> n
  let 총 = 0;
  for (const f of liveFiles()) {
    const src = 소스(f);
    let i = 0;
    while ((i = src.indexOf('UrlFetchApp.fetch(', i)) !== -1) {
      const 머리 = src.slice(i, i + 260);
      const v = (벤더표_.find(([, re]) => re.test(머리)) || ['변수URL'])[0];
      const k = f + '|' + v;
      표.set(k, (표.get(k) || 0) + 1);
      총++;
      i += 18;
    }
  }
  return { 표, 총 };
}

test('🔴 나가는 자리 분모가 살아 있다 — 0이면 검사가 죽은 것이지 통과가 아니다', () => {
  const 파일들 = liveFiles();
  assert.ok(파일들.length >= 10, `liveFiles() 가 ${파일들.length}벌 — .claspignore 파생이 깨졌다`);
  const { 총 } = 실측자리_();
  assert.ok(총 > 0, 'UrlFetchApp.fetch 를 한 자리도 못 찾았다 — 「0건」이 아니라 검사가 죽었다');
  // 🔴 구간 자르기 자신이 살아 있는가 — 아래 ③ 절의 단언들이 전부 이 자에 실린다.
  //    표식을 못 찾고도 조용히 「파일 전체」를 돌려주던 게 08-30 실사고다(위 함수본문_ 머리말).
  assert.throws(() => 함수본문_(소스('교재연동.js'), 'function 있을리없는함수_('), /구간 표식을 못 찾았다/,
    '구간 자르기가 없는 표식에도 안 던진다 — 그 순간 이 파일의 단언이 통째로 빈 단언이 된다');
  assert.ok(!함수본문_(소스('교재연동.js'), 'function stt요청_(').includes('function voiceTranscribe_('),
    '구간이 다음 함수까지 넘쳤다 — 자른 게 아니라 파일 꼬리를 재고 있다');
});

test('🔴 밖으로 나가는 자리 수가 선언표와 같다 (벤더·파일별)', () => {
  const { 표, 총 } = 실측자리_();
  const 선언 = new Map(나가는자리_.map((r) => [r.file + '|' + r.vendor, r.n]));
  const 어긋남 = [];
  for (const [k, n] of 표) {
    const d = 선언.get(k);
    if (d === undefined) 어긋남.push(`+ 새 자리 ${k} = ${n}개 — 무엇이 나가는지 확인하고 나가는자리_ 에 등재하라`);
    else if (d !== n) 어긋남.push(`~ ${k}: 선언 ${d} ≠ 실측 ${n}`);
  }
  for (const [k, d] of 선언) if (!표.has(k)) 어긋남.push(`- 사라진 자리 ${k}(선언 ${d}) — 없앴으면 나가는자리_ 에서 지워라`);
  assert.deepEqual(어긋남, [],
    `나가는 자리가 선언과 갈렸다(선언 합계 ${선언합계_} · 실측 합계 ${총}):\n  ` + 어긋남.join('\n  '));
  assert.equal(총, 선언합계_, `합계 불일치 — 선언 ${선언합계_} · 실측 ${총}`);
});

test('학생 식별자가 실릴 수 있는 벤더가 무엇인지 표가 스스로 말한다', () => {
  // 표의 모든 줄에 「뭐」가 있어야 한다 — 수만 맞고 뜻이 없으면 다음 사람이 못 읽는다
  const 빈설명 = 나가는자리_.filter((r) => !r.뭐 || r.뭐.length < 5).map((r) => r.file + '|' + r.vendor);
  assert.deepEqual(빈설명, [], `설명 없는 자리: ${빈설명.join(', ')}`);
  // 벤더 갈래가 실제로 여럿이다 — 하나로 접히면 판정이 「전부 같은 위험」이 된다
  const 벤더 = new Set(나가는자리_.map((r) => r.vendor));
  assert.ok(벤더.size >= 5, `벤더 갈래가 ${벤더.size}종뿐 — 분류가 접혔다`);
});

/* ── ①-나 「N군데」라 적은 주석은 이 표와 갈려 있다 ─────────────────────
 * 🔴 실측: `엔진_두뇌.js` 3층 머리말이 *"api.anthropic.com을 직접 부르는 곳은 7군데"* 라 적는데
 *   실측은 **8자리**다(`상담AI.js` 의 인계 초안이 그 셈에서 빠졌고, 그 함수는 주석보다 «먼저»
 *   생겼으니 셈이 태어날 때부터 틀렸다). 같은 주석이 *"여덟째 자리를 새로 낼 일이 생기면 이 셈을
 *   손으로 대조한다"* 고 적는데 **여덟째는 이미 있었다.**
 *   ⚠ 이 트랙은 그 파일을 못 만진다(다른 트랙 몫). 그래서 «고치지 않고 못박는다» —
 *     아래 목록과 정확히 같을 때만 통과한다. 누가 주석을 고치면 이 검사가 빨개지고,
 *     그때 이 줄을 지우면 된다. **새로 어긋난 주석이 생겨도 빨개진다.** 양방향으로 드러난다. */
const 알려진_어긋난_셈_ = [{ file: '엔진_두뇌.js', 적힌수: 7, 실측벤더: 'anthropic' }];

test('🔴 「N군데」라 적은 주석과 실측을 대조한다(알려진 어긋남은 목록으로 못박는다)', () => {
  const { 표 } = 실측자리_();
  const anthropic합 = [...표].filter(([k]) => k.endsWith('|anthropic')).reduce((a, [, n]) => a + n, 0);
  const 발견 = [];
  for (const f of liveFiles()) {
    for (const m of 원문(f).matchAll(/api\.anthropic\.com[^\n]{0,80}?\*\*(\d+)군데\*\*|\*\*(\d+)군데\*\*[^\n]{0,80}?api\.anthropic\.com/g)) {
      발견.push({ file: f, 적힌수: Number(m[1] || m[2]) });
    }
  }
  const 어긋남 = 발견.filter((d) => d.적힌수 !== anthropic합)
    .map((d) => ({ file: d.file, 적힌수: d.적힌수, 실측벤더: 'anthropic' }));
  assert.deepEqual(어긋남, 알려진_어긋난_셈_,
    `주석의 셈과 실측(${anthropic합}자리)이 «알려진 어긋남»과 다르다.\n` +
    '  · 주석을 고쳤으면 이 파일의 알려진_어긋난_셈_ 에서 그 줄을 지워라.\n' +
    '  · 새 주석이 어긋났으면 그 주석을 고쳐라(수의 정본은 이 파일의 나가는자리_ 다).\n' +
    `  실측 어긋남: ${JSON.stringify(어긋남)}`);
});

/* ══════════════════════════════════════════════════════════════════
 * ② 식별자 소스 검사 — 프롬프트 인자에 실명이 실리는가
 * ══════════════════════════════════════════════════════════════════
 * ■ 설계 의도 (🔴 이 절을 안 읽고 고치면 22시 배치가 멈춘다)
 *   실물 둘(`웰컴 스토리`·`미래의 나 편지`)이 `'신규 학생 "' + s.n + '"'` 꼴로 **실명을 싣는다.**
 *   그런데 지금 호출은 **0회**다 — `Code.js` 의 `const STORY_AI_ON = false;` 가 막고 있다.
 *   둘을 고치는 것은 기능 설계 변경이라 **유호님 판정 자리**다(이 트랙은 안 고친다).
 *   그래서 이 검사는 이렇게 짠다:
 *     · 잠금 플래그 뒤에 있는 위반 = **「잠긴 위반」으로 분류해 목록에 못박되 실패시키지 않는다.**
 *     · 🔴 **플래그가 true 로 바뀌는 순간 빨개진다.** 그날 이름이 실제로 나가기 시작하기 때문이다.
 *     · 잠금 없는 위반이 하나라도 생기면 그 자리에서 빨개진다.
 *   ⚠ 22시 배치(첨삭 `callClaudeFeedback_` · 대화 `callClaudeTalk_`)는 이름 없이 나간다 —
 *     실물로 확인했다(첨삭 = 급수+제출문 템플릿 · 대화 = history+text). 그래서 초록이어야 한다.
 */
const AI헬퍼_ = /\b(aiText_|aiCall_|callClaude[A-Za-z]*_)\s*\(/g;
const 식별자꼴_ = [
  { name: 's.n(실명)', re: /\b(?:s|stu|st|학생)\.n\b/ },
  { name: '.pEmail', re: /\.pEmail\b/ },
  { name: '.연락처', re: /\.연락처\b/ },
  { name: '.이름', re: /\.이름\b/ },
  { name: '.보호자*', re: /\.보호자[가-힣]*\b/ },
  { name: '.name', re: /\.name\b/ },
];
const 잠금플래그_ = 'STORY_AI_ON';

/** 여는 괄호에서 짝이 맞는 닫는 괄호까지 — 인자 원문. */
function 인자_(src, open) {
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (d === 0) return src.slice(open + 1, i); }
  }
  return '';
}
/** 이 호출을 품은 함수 이름 — 줄 번호 대신 쓴다(줄 번호는 태어나는 순간 낡는다).
 *  ⚠ 여기도 -1 을 slice 에 안 먹인다(위 `함수본문_` 머리말의 같은 병). */
function 품은함수_(src, at) {
  const 앞 = src.lastIndexOf('\nfunction ', at);
  if (앞 === -1) return '(톱레벨)';
  const 괄 = src.indexOf('(', 앞);
  if (괄 === -1) return '(이름불명)';
  return (src.slice(앞 + 10, 괄) || '?').trim();
}

function 식별자유입_() {
  const 결과 = [];
  for (const f of liveFiles()) {
    const src = 소스(f);
    AI헬퍼_.lastIndex = 0;
    let m;
    while ((m = AI헬퍼_.exec(src))) {
      const open = m.index + m[0].length - 1;
      const 인자 = 인자_(src, open);
      const 걸림 = 식별자꼴_.filter((k) => k.re.test(인자)).map((k) => k.name);
      if (!걸림.length) continue;
      const ls = src.lastIndexOf('\n', m.index) + 1;
      const le = src.indexOf('\n', m.index);                   // 🔴 -1(파일 마지막 줄)을 slice 에 먹이면
      const 줄 = src.slice(ls, le === -1 ? src.length : le);   //    「줄」이 파일 꼬리 전체가 되어 «잠김»이 거짓으로 선다
      결과.push({ file: f, fn: 품은함수_(src, m.index), 헬퍼: m[1], 걸림, 잠김: 줄.includes(잠금플래그_) });
    }
  }
  return 결과;
}

/** 🔒 잠긴 위반 — 플래그가 false 인 «동안만» 면제된다. 함수 이름으로 못박는다(줄 번호 금지).
 *
 *  ⚠ 「잠김」 판정은 **호출과 플래그가 같은 줄에 있을 때만** 선다(`if (apiKey && STORY_AI_ON) story = aiText_(…`).
 *    실물 둘이 지금 정확히 그 꼴이라 그렇게 잰다(08-30 재확인 · `엔진_콘텐츠AI.js` 웰컴 스토리·미래편지).
 *    누가 가드를 바깥 블록으로 올려 줄을 가르면 이 검사는 그 자리를 **「안 잠김」으로 보고 빨개진다.**
 *    귀찮지만 방향이 안전하다 — 놓치는 쪽이 아니라 **더 잡는 쪽**으로 틀린다. 그때 할 일은
 *    「검사를 느슨하게 푸는 것」이 아니라 그 자리에서 이름을 빼는 것이다(그게 원래 처방이다). */
const 잠긴위반_ = [
  { file: '엔진_콘텐츠AI.js', fn: 'welcomeStoryBatch_', 헬퍼: 'aiText_' },   // 웰컴 스토리 — `'신규 학생 "' + s.n + '"'`
  { file: '엔진_콘텐츠AI.js', fn: 'futureLetterBatch_', 헬퍼: 'aiText_' },   // 「미래의 나」 편지 — `'학생: ' + s.n`
];

test('🔴 잠금 플래그가 여전히 꺼져 있다 — 켜지면 아래 검사가 위반을 실패로 올린다', () => {
  const code = 원문('Code.js');
  const m = code.match(/const\s+STORY_AI_ON\s*=\s*(true|false)\s*;/);
  assert.ok(m, `Code.js 에서 ${잠금플래그_} 선언을 못 찾았다 — 잠금이 사라졌으면 잠긴위반_ 을 실패로 올려라`);
  assert.equal(m[1], 'false',
    `🔴 ${잠금플래그_} 가 true 다 — 지금부터 학생 실명이 모델로 나간다.\n` +
    '  나가는 자리: ' + 잠긴위반_.map((v) => v.file + ' ' + v.fn).join(' · ') + '\n' +
    '  켜기 전에 그 둘의 프롬프트에서 이름을 빼고(이름은 «템플릿이 머리에 끼운다» — ' +
    '엔진_콘텐츠AI.js 의 몽골어 진단 리포트가 이미 그 꼴로 돈다) 이 검사를 갱신하라.');
});

test('🔴 AI 프롬프트 인자에 실명·연락처가 문자열 결합으로 들어가지 않는다(잠긴 것 제외)', () => {
  const 전부 = 식별자유입_();
  const 안잠김 = 전부.filter((r) => !r.잠김)
    .map((r) => `${r.file} ${r.fn}() → ${r.헬퍼}(… ${r.걸림.join(',')} …)`);
  assert.deepEqual(안잠김, [],
    `잠금 없이 식별자가 프롬프트에 실린다 ${안잠김.length}자리 — 그 자리에서 이름을 빼라:\n  ` + 안잠김.join('\n  '));

  // 잠긴 위반이 «늘거나 줄면» 그것도 알아야 한다(0건이 성공 얼굴을 하지 못하게)
  const 잠김 = 전부.filter((r) => r.잠김).map((r) => ({ file: r.file, fn: r.fn, 헬퍼: r.헬퍼 }));
  assert.deepEqual(잠김, 잠긴위반_,
    '잠긴 위반 목록이 실물과 갈렸다 — 고쳤으면 잠긴위반_ 에서 지우고, 새로 생겼으면 등재하라(그리고 유호님께 알려라):\n' +
    `  실측: ${JSON.stringify(잠김)}`);
});

test('⚠ 22시 배치(첨삭·대화)는 이름 없이 나간다 — 이 검사가 그 둘을 멈추면 안 된다', () => {
  const 전부 = 식별자유입_();
  ['callClaudeFeedback_', 'callClaudeTalk_'].forEach((h) => {
    const 걸린 = 전부.filter((r) => r.헬퍼 === h);
    assert.deepEqual(걸린, [], `${h} 호출부가 식별자 검사에 걸렸다 — 22시 배치가 멈춘다: ${JSON.stringify(걸린)}`);
  });
  // 탐지력 — 헬퍼를 실제로 찾고 있는가(0건이 「없어서」인지 「못 찾아서」인지 가른다)
  const 소스전량 = liveFiles().map(소스).join('\n');
  ['callClaudeFeedback_(', 'callClaudeTalk_(', 'aiCall_(', 'aiText_('].forEach((h) => {
    assert.ok(소스전량.includes(h), `${h} 자체를 못 찾았다 — 검사가 빈 과녁을 쏘고 있다`);
  });
});

/* ══════════════════════════════════════════════════════════════════
 * ③ 음성 반출 단일 문 — 학생 목소리가 나가는 통로
 * ══════════════════════════════════════════════════════════════════ */
test('🔴 학생 음성이 나가는 문은 하나다 — speech.googleapis.com 호출 자리 1', () => {
  const 자리 = liveFiles().flatMap((f) =>
    (소스(f).match(/UrlFetchApp\.fetch\([^\n]{0,120}speech\.googleapis\.com/g) || []).map(() => f));
  assert.deepEqual(자리, ['교재연동.js'],
    `음성 반출 자리가 ${자리.length}곳(${자리.join(',')}) — 문이 둘이면 다음 게이트가 한쪽에만 걸린다. ` +
    '새 소비자는 stt요청_ 을 거쳐라.');
  const tb = 소스('교재연동.js');
  const 문 = 함수본문_(tb, 'function stt요청_(');
  assert.ok(문.includes('speech:recognize'), 'stt요청_ 안에 실제 호출이 없다 — 문이 빈 껍데기다');
});

test('🔴 그 문은 보내기 «직전»에 동의를 다시 확인한다 — 적재 시점 판정은 낡았다', () => {
  const tb = 소스('교재연동.js');
  const 문 = 함수본문_(tb, 'function stt요청_(');
  const 확인 = 문.indexOf('stt동의재확인_(sid)');
  const 호출 = 문.indexOf('UrlFetchApp.fetch');
  assert.ok(확인 !== -1, '보내기 직전 동의 재확인이 없다');
  assert.ok(확인 < 호출, '동의 재확인이 호출보다 뒤에 있다 — 이미 나간 뒤에 묻는다');
  // fail-closed 세 겹
  assert.ok(/상태 === null/.test(문), '동의 «확인 불가»를 통과시킨다 — 판정 불가는 보류여야 한다(v9.104 원칙)');
  assert.ok(/상태 !== 'yes'/.test(문), "'동의' 이외(거부·미응답)를 통과시킨다");
  assert.ok(/오디오 && !sid/.test(문) && /throw new Error/.test(문),
    '🔴 sid 없이 오디오를 보낼 수 있다 — 게이트를 지나지 않는 경로가 남는다');
});

test('🔴 동의 맵을 못 읽으면 전원 보류다(fail-closed) — 기존 설계 결을 안 깬다', () => {
  const tb = 소스('교재연동.js');
  const 맵 = 함수본문_(tb, 'function stt동의맵_(');
  assert.ok(맵.includes('voiceConsentMap_'), '동의 맵이 정본(voiceConsentMap_)에서 오지 않는다');
  assert.ok(/return _음성동의캐시_\.map/.test(맵), '맵을 그대로 돌려주지 않는다 — null(보류)이 접힐 수 있다');
  const 전사 = 함수본문_(tb, 'function voiceTranscribe_(');
  assert.ok(/consent === null[\s\S]{0,120}return/.test(전사), '맵 실패 시 배치가 보류하지 않는다');
  // 동의를 읽는 통로가 이 파일에 하나뿐인가 — 두 곳이 각자 읽으면 갈라진다
  assert.equal((tb.match(/voiceConsentMap_\(\)/g) || []).length, 2,
    'voiceConsentMap_() 직접 호출 자리가 둘이 아니다 — 적재(voiceSweep_)와 stt동의맵_ 둘만이어야 한다');
});

test('보류는 실패 낙인을 남기지 않는다 — 동의를 되찾으면 다음 밤에 자동 재개', () => {
  const tb = 소스('교재연동.js');
  const 전사 = 함수본문_(tb, 'function voiceTranscribe_(');
  const 보류 = 전사.indexOf('r.보류');
  const 낙인 = 전사.indexOf("'실패: '");
  assert.ok(보류 !== -1, '보류 분기가 없다 — 동의 미확인이 실패로 기록된다');
  assert.ok(낙인 !== -1, "실패 낙인('실패: ')을 못 찾았다 — 표식이 바뀌었으면 이 검사도 같이 고쳐라(못 찾은 채 비교하면 «뒤에 있다»는 거짓 사유가 나온다)");
  assert.ok(보류 < 낙인, '보류 분기가 실패 낙인보다 뒤에 있다 — 낙인이 먼저 찍힌다');
  assert.ok(/보류\+\+;[\s\S]{0,120}continue/.test(전사), '보류 뒤 continue 가 없다 — 시트에 무언가를 쓴다');
});

/* 🔴 [08-30] 사람에게 «말해주는» 것도 맞아야 한다 — 안내가 틀리면 유호님이 없는 칸을 찾아 헤맨다.
 *   첫 판은 보류 사유를 `errSample`(=메일의 「실패 사유」)에 담았다. 그 칸 아래에는
 *   *"실패 행은 자동 재시도하지 않습니다 — 「전사상태」 칸을 비우면 다시 시도합니다"* 가 붙는데
 *   보류 행은 정반대다(칸이 '대기' 그대로 · 자동 재개 · 비울 칸 없음). 덤으로 보류 다섯이
 *   표본 5칸을 채우면 진짜 실패 사유가 메일에서 통째로 사라졌다. */
test('🔴 보류 사유와 실패 사유가 같은 칸을 쓰지 않는다 — 안내가 뒤바뀌고 표본이 서로를 밀어낸다', () => {
  const tb = 소스('교재연동.js');
  const 전사 = 함수본문_(tb, 'function voiceTranscribe_(');
  const 보류시작 = 전사.indexOf('r.보류');
  assert.ok(보류시작 !== -1, '보류 분기(r.보류)를 못 찾았다 — 표식이 바뀌었으면 이 검사도 같이 고쳐라');
  const 보류줄 = 전사.slice(보류시작, 보류시작 + 200);
  assert.ok(!보류줄.includes('errSample'),
    '보류가 errSample(=메일의 「실패 사유」)에 담긴다 — 그 칸의 안내문("칸을 비우면 재시도")이 보류엔 거짓이다');
  assert.ok(보류줄.includes('보류표본'), '보류 사유를 따로 담지 않는다 — 사유 없이 건수만 보면 원인을 못 찾는다');
  // 두 표본이 서로의 5칸을 안 먹는가
  assert.ok(/보류표본\.length < 5/.test(전사) && /errSample\.length < 5/.test(전사),
    '표본 상한이 각자 서지 않았다');
});

test('진단(빈 오디오)도 같은 문으로 나간다 — 문이 둘이면 게이트가 한쪽에만 걸린다', () => {
  const tb = 소스('교재연동.js');
  const 진단 = 함수본문_(tb, 'function voiceSttStatus(');
  assert.ok(진단.includes('stt요청_('), '진단이 단일 문을 안 쓴다');
  assert.ok(!/UrlFetchApp\.fetch/.test(진단), '진단이 직접 fetch 한다 — 통로가 다시 둘이 됐다');
  assert.ok(/content: ''/.test(진단), '진단이 빈 오디오를 안 보낸다 — 학생 데이터 0의 보증이 사라진다');
});
