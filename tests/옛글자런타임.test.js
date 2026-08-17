/* [v9.223] 옛 글자(한자·가나) 런타임 게이트 — 「쓰는 문자는 한글·몽골어(키릴)·영어 셋뿐」(유호 확정 2026-08-07)을
 * **모델이 내는 글**에 세운 자리의 회귀.
 *
 * ■ 왜 이 파일이 생겼나
 *   그 확정을 지키던 장치 셋은 전부 «우리가 쓴 글»만 겨눴다 — 저장소 파일 스캔(F351 · `tests/문서문자.test.js`)·
 *   커밋 층(F379)·채팅 층. **모델 출력**은 어느 층에도 안 걸렸고, 형제 SYNK-talk 은 08-12 에 자기 쪽만 막았다
 *   (`lib/옛글자.js` + `교정엔진.교정값()`). 이 저장소의 일곱 깔때기는 그날까지 통째로 사각이었다.
 *
 * ■ 📏 프롬프트로는 안 막힌다는 것이 이 게이트의 근거다
 *   형제 eval 출력을 같은 채점기로 재니, 그 글자를 금지하는 규칙을 프롬프트에 실은 뒤에도
 *   v3 2건 · v4 1건 · v5 0건 · v6 1건(분모 ~102)으로 **네 판 연속 샜다**.
 *
 * ■ 🔴 이 파일에도 그 글자를 «리터럴로» 적지 않는다
 *   적으면 `tests/문서문자.test.js` 가 이 소스에 걸린다. 픽스처는 전부 `String.fromCodePoint` 로 짓는다 —
 *   그래야 **탐지력을 진짜로 재면서** 소스는 깨끗하다(F298: 위반을 신고하는 글이 새 위반이 되는 자리).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const { engineSource } = require('./_engine-source');

/* ── GAS 스텁 컨텍스트 — v9125회귀.test.js 와 같은 규약 ───────────────────── */
const stub = new Proxy(function () {}, { get: () => stub, apply: () => stub });
const ctx = {
  SpreadsheetApp: stub, PropertiesService: stub, Utilities: stub, Session: stub,
  MailApp: stub, GmailApp: stub, UrlFetchApp: stub, DriveApp: stub, FormApp: stub,
  DocumentApp: stub, ScriptApp: stub, CacheService: stub, LockService: stub,
  HtmlService: stub, Logger: { log: () => {} }, console,
};
vm.createContext(ctx);
vm.runInContext(engineSource(), ctx);

/* 픽스처용 글자 — 코드포인트로만 짓는다(위 🔴). 한자 U+683C · 가나 U+3042. */
const 한자 = String.fromCodePoint(0x683c);
const 가나 = String.fromCodePoint(0x3042);

/* ── ① 단일 출처 — 문자 클래스가 세 벌인데 갈리면 안 된다 ─────────────────
 * SQL 처럼 include 가 없는 자리라 사본을 없앨 수 없다. 없앨 수 없는 사본은 기계에 문다.
 * 갈리면 증상이 조용하다 — 한쪽 층만 통과시키고 「막았다」로 보인다. */
const 클래스뽑기 = (파일) => {
  const m = fs.readFileSync(파일, 'utf8').match(/\[\\\\u3040[^\]]*\]/);
  return m ? m[0] : null;
};

test('[단일 출처] 런타임 판정의 문자 클래스가 커밋 층(.claude/hooks/lib/옛글자.js)과 글자로 같다', () => {
  const 런타임 = 클래스뽑기(path.join(ROOT, '엔진_콘텐츠AI.js'));
  const 커밋층 = 클래스뽑기(path.join(ROOT, '.claude/hooks/lib/옛글자.js'));
  assert.ok(런타임, '엔진_콘텐츠AI.js 에서 문자 클래스를 못 찾았다 — 판정이 사라졌거나 모양이 바뀌었다');
  assert.ok(커밋층, '.claude/hooks/lib/옛글자.js 에서 문자 클래스를 못 찾았다');
  assert.equal(런타임, 커밋층, '런타임 게이트와 커밋 층의 문자 클래스가 갈렸다 — 한쪽만 막고 다른 쪽은 통과시킨다');
});

test('[단일 출처] 형제 SYNK-talk 의 런타임 판정과도 같다', (t) => {
  // ⚠ 형제는 repo 밖이라 CI 에 없다 — 없을 때 조용히 통과시키지 않고 skip 으로 드러낸다(F207).
  // 자리는 정본 통로에서 — 손으로 `ROOT/..` 를 적으면 워크트리에서 늘 skip 이다(`..` = `worktrees/`).
  const 형제뿌리 = require(path.join(ROOT, '.claude', 'hooks', 'lib', '형제저장소.js')).형제경로(ROOT);
  const 형제 = path.join(형제뿌리, 'lib', '옛글자.js');
  if (!fs.existsSync(형제)) return t.skip('형제 저장소 SYNK-talk 가 이 기계에 없다 — 실물 대조는 로컬에서만');
  assert.equal(클래스뽑기(path.join(ROOT, '엔진_콘텐츠AI.js')), 클래스뽑기(형제),
    '두 저장소의 런타임 게이트가 다른 글자를 막는다 — 같은 모델이 같은 글자를 내도 한쪽만 걸린다');
});

/* ── ② 탐지력 — 픽스처로 못박는다 ──────────────────────────────────────────
 * 🔑 탐지력은 픽스처가 지고, 실저장소에는 거짓양성만 검사한다(CLAUDE.md 가드 맹점 ②).
 *   「버그가 아직 있을 것을 요구하는 회귀」를 안 만들려면 이 자리가 임시 문자열이어야 한다. */
test('[탐지] 옛글자짚기_ — 한자·가나를 잡고, 짚음은 U+XXXX 표기로만 낸다', () => {
  assert.equal(ctx.옛글자짚기_('안녕하세요'), '', '한글만 든 글이 걸렸다 — 거짓양성');
  assert.equal(ctx.옛글자짚기_('тусах' + 한자 + 'ийн'), 'U+683C',
    '키릴 낱말 한복판의 한자를 못 잡았다 — 형제 eval E17 이 실제로 이 모양이었다');
  assert.equal(ctx.옛글자짚기_(가나 + 'test'), 'U+3042', '가나를 못 잡았다');
  // [vNEXT] 리뷰 P2-① 확장분 — 호환한자·반각 가나·astral 이 구판 클래스에서 «통과»로 샜다
  assert.equal(ctx.옛글자짚기_('앞' + String.fromCodePoint(0xf914) + '뒤'), 'U+F914', '호환한자(한국어 독음 구역)를 못 잡았다');
  assert.equal(ctx.옛글자짚기_('앞' + String.fromCodePoint(0xff71) + '뒤'), 'U+FF71', '반각 가나를 못 잡았다');
  assert.equal(ctx.옛글자짚기_('앞' + String.fromCodePoint(0x20000) + '뒤'), 'U+20000', 'astral 한자(확장B)를 못 잡았다 — u 플래그 없이는 서러게이트 반쪽으로 읽히는 자리');
  // 같은 글자가 여러 번 나와도 코드포인트 집합이라 한 번만 — 사유 한 줄이 읽혀야 한다
  assert.equal(ctx.옛글자짚기_(한자 + 'x' + 한자), 'U+683C');
});

test('[탐지] 옛글자짚기_ — 같은 입력을 두 번 물어도 같은 답(전역 정규식 lastIndex 함정)', () => {
  /* 🔴 전역 플래그 정규식을 상수로 들고 다니면 lastIndex 가 남아 **둘째 물음이 거짓**이 된다.
   *   부르는 쪽이 한 값을 두 번 재는 자리가 실제로 있고(aiText_ 의 로그+반환), 새는 방향은 「통과」다. */
  const 글 = 'тусах' + 한자 + 'ийн';
  assert.equal(ctx.옛글자짚기_(글), ctx.옛글자짚기_(글), '같은 입력에 번갈아 다른 답이 나온다 — lastIndex 오염');
});

/* ⚠ vm 컨텍스트와 호스트는 **렐름이 다르다** — 저쪽 객체는 이쪽 Object 가 아니라 deepStrictEqual 이
 *   내용이 같아도 실패한다(GAS 실환경은 단일 렐름이라 이 함정은 시험에만 있다). 평평하게 옮겨 잰다. */
const 옮김 = (o) => (o === null || o === undefined ? o : { 칸: o.칸, 짚음: o.짚음 });

test('[탐지] 옛글자걸림_ — 중첩 객체·배열의 «어느 칸»인지 짚는다', () => {
  assert.equal(ctx.옛글자걸림_({ a: '깨끗', b: '맑음' }), null, '깨끗한 객체가 걸렸다 — 거짓양성');
  assert.deepEqual(옮김(ctx.옛글자걸림_({ corrected: '맑음', point_mn: 'сайн' + 한자 })),
    { 칸: 'point_mn', 짚음: 'U+683C' });
  assert.deepEqual(옮김(ctx.옛글자걸림_({ 한국어들: ['맑음', '흐림' + 가나] })),
    { 칸: '한국어들[1]', 짚음: 'U+3042' }, '배열 안쪽을 못 짚는다 — 상담 역번역이 그 모양이다');
  assert.deepEqual(옮김(ctx.옛글자걸림_({ 겉: { 속: ['x', { 끝: 한자 }] } })),
    { 칸: '겉.속[1].끝', 짚음: 'U+683C' }, '구조화 출력(aiCall_)은 칸이 중첩이라 평면 검사로는 안 닿는다');
  // 숫자·불리언·null 은 글자가 들어갈 자리가 없다 — 훑되 안 걸린다
  assert.equal(ctx.옛글자걸림_({ n: 3, b: true, z: null }), null);
});

/* ── ③ 첫 깔때기의 처분 — 격리(학생에게 안 나감 · 행은 남음) ────────────── */
const 정상카드 = {
  corrected: '저는 학교에 갑니다.',
  point_mn: 'Энэ өгүүлбэрт "에" биш "에서" хэрэглэнэ (조사).',
  praise: '문장 구조를 정확하게 쓰셨어요!',
  mission: '오늘 배운 조사를 써서 새 문장 하나를 만들어 보세요.',
};

test('[거짓양성 0] 한글·키릴·라틴·숫자·문장부호만 든 정상 카드는 그대로 통과한다', () => {
  const g = ctx.fbQualityGate_(정상카드, '저는 학교에 가요');
  assert.equal(g.ok, true, `정상 카드가 막혔다(${g.reason}) — 거짓양성은 이 게이트의 유일한 사망 원인이다`);
});

test('[처분] fbQualityGate_ — 4칸 어디에 섞여도 격리 사유를 «칸 이름과 함께» 낸다', () => {
  for (const 칸 of ['corrected', 'point_mn', 'praise', 'mission']) {
    const 카드 = Object.assign({}, 정상카드, { [칸]: 정상카드[칸] + 한자 });
    const g = ctx.fbQualityGate_(카드, '저는 학교에 가요');
    assert.equal(g.ok, false, `${칸} 에 옛 글자가 있는데 통과했다 — 학생이 그대로 읽는다`);
    assert.equal(g.reason, '옛글자:' + 칸 + ':U+683C',
      `사유가 어느 칸인지 안 말한다 — 시트에서 원인을 못 찾는다 (${g.reason})`);
  }
});

test('[F298] 사유 문자열에 그 글자 자체를 싣지 않는다 — 신고문이 새 위반이 되는 자리', () => {
  const g = ctx.fbQualityGate_(Object.assign({}, 정상카드, { praise: 정상카드.praise + 한자 }), '가요');
  /* ⚠ 이 줄이 먼저다 — 없으면 게이트가 통째로 사라져도 `reason` 이 빈 문자열이라 **초록**이다.
   *   변이 실측에서 실제로 그랬다(다른 둘은 물었는데 이 검사만 안 물었다). 「안 잰 것」과 「깨끗한 것」이
   *   같은 모양이 되는 자리라 분모를 먼저 세운다(F207). */
  assert.equal(g.ok, false, '옛 글자가 든 카드가 통과했다 — 아래 사유 검사가 잴 대상 자체가 없어진다');
  assert.equal(ctx.옛글자짚기_(g.reason), '', '격리 사유에 그 글자가 실렸다 — 시트 칸이 곧 다음 사람이 읽는 글이다');
});

/* ── ④ 라우팅이 게이트보다 넓으면 안 된다 — 깔때기 «전수» ────────────────
 * 🔴 CLAUDE.md 가드 맹점 ③: 규칙만 늘리고 라우팅을 안 넓히면 조용히 샌다. 새 깔때기가
 *   검사 없이 태어나는 것이 이 게이트의 유일한 우회로라, 그 자리를 기계가 센다.
 * 🔑 판정 단위는 «파일»이 아니라 **함수**다 — 한 파일에 깔때기가 셋인 자리가 실재하고
 *   (엔진_콘텐츠AI.js), 파일 단위로 세면 하나만 걸어도 초록이 된다.
 * ⚠ v9.125 가 같은 자리에서 이미 겪었다: 리허설 게이트를 둘에만 두었더니 aiCall_ 직호출
 *   7곳이 리허설 중 그대로 과금됐다. 「깔때기가 몇 개인지」는 세어 봐야 아는 수다. */
const 깔때기찾기 = () => {
  const 표식 = "UrlFetchApp.fetch('https://api.anthropic.com";
  const 본 = [];
  for (const f of fs.readdirSync(ROOT).filter((n) => n.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (src.indexOf(표식) === -1) continue;
    // 최상위 함수 단위로 자른다 — 이 저장소의 깔때기는 전부 최상위 `function` 이다.
    src.split(/\nfunction /).forEach((덩이, i) => {
      if (덩이.indexOf(표식) === -1) return;
      본.push({ 파일: f, 이름: i === 0 ? '(머리)' : String(덩이.split(/[(\s]/)[0]), 덩이 });
    });
  }
  return 본;
};

/* 🔴 **면제는 「다른 층이 재고 있을 때만」 정당하다** — 안 그러면 예외는 그냥 눈을 감은 것이다
 *   (`tests/문서문자.test.js` 가 eval 출력 면제에 쓰는 것과 같은 규약). 그래서 면제마다 «대신 재는 곳»을
 *   적고, 그 자리가 정말 재고 있는지를 아래 검사가 기계로 대조한다. */
const 면제 = {
  // 이 깔때기의 처분은 «격리»여야 한다 — 행은 hw_feedback 에 그대로 적재되고(수집 보존) 학생에게만 안 나간다.
  // 판정을 깔때기 안에 넣으면 throw 가 되어 그 격리 칸을 못 쓴다. 그래서 소비자 쪽 품질 게이트가 진다.
  'callClaudeFeedback_': { 대신재는곳: 'fbQualityGate_', 파일: '엔진_콘텐츠AI.js' },
};

test('[라우팅] 모델을 부르는 함수는 «전부» 옛글자 판정을 지난다', () => {
  const 깔때기 = 깔때기찾기();
  // 🔑 분모부터 밝힌다 — 표식이 안 맞아 0개를 훑으면 그것도 초록으로 보인다(F207).
  assert.ok(깔때기.length >= 8,
    `모델 깔때기를 ${깔때기.length}개밖에 못 찾았다 — 실측 8개다. 표식이 낡았으면 이 검사는 아무것도 안 재고 초록이 된다`);
  const 샌곳 = 깔때기
    .filter((k) => k.덩이.indexOf('옛글자') === -1 && !면제[k.이름])
    .map((k) => `${k.파일}:${k.이름}`);
  assert.deepEqual(샌곳, [],
    '이 함수들이 모델 출력을 옛글자 검사 없이 돌려준다 — 새 깔때기를 지었으면 그 자리에도 게이트를 건다');
});

test('[라우팅] 면제의 근거가 살아 있다 — «대신 재는 곳»이 정말 재고 있다', () => {
  for (const [이름, 근거] of Object.entries(면제)) {
    const src = fs.readFileSync(path.join(ROOT, 근거.파일), 'utf8');
    const 덩이 = src.split(/\nfunction /).find((c) => c.startsWith(근거.대신재는곳));
    assert.ok(덩이, `면제 ${이름} 의 대신 재는 곳 ${근거.대신재는곳} 이 사라졌다 — 면제가 근거를 잃었다`);
    assert.ok(덩이.indexOf('옛글자') !== -1,
      `${근거.대신재는곳} 이 더는 옛글자를 안 잰다 — ${이름} 면제가 그대로면 그 깔때기는 아무 데서도 안 걸린다`);
  }
});

test('[라우팅] 깔때기가 든 파일 목록이 실측과 같다 — 새 파일이 늘면 사람이 본다', () => {
  const 파일들 = [...new Set(깔때기찾기().map((k) => k.파일))].sort();
  assert.deepEqual(파일들, ['상담AI.js', '엔진_두뇌.js', '엔진_수집.js', '엔진_콘텐츠AI.js'],
    '모델을 부르는 파일 구성이 바뀌었다 — 새 파일이면 게이트를, 사라진 파일이면 이 목록을 갱신한다');
});

/* ── ⑤ 처분의 두 함정 — 컨텍스트 독립 리뷰(08-13)가 잡은 자리 ──────────────
 * P1-1: aiCall_ 의 옛글자 throw 가 배치 호출부 둘(한문장·칭호)의 catch 에서 무조건 break 를 탔다 —
 *   한 청크의 옛 글자가 그날 밤 뒤쪽 학생 전원의 산출물을 지운다(게이트가 새로 만든 실패 모드).
 *   엔진_수집.js 가 스스로 서술한 「일시로 올리면 break 라 …」 함정과 같은 축인데 이쪽엔 적용이 빠졌었다.
 * P1-2: 격리 안내 메일의 「멀쩡하면 '노출'」 지시 — 옛글자 격리는 육안으로 멀쩡해 보여서 사람 손
 *   한 번이 게이트를 되돌린다(CLAUDE.md 가드 맹점 ③ «자기 처방을 막지 않는지»). */
const 콘텐츠소스 = () => fs.readFileSync(path.join(ROOT, '엔진_콘텐츠AI.js'), 'utf8');

test('[처분] aiCall_ 옛글자 throw 는 permanent 를 단다 — 배치가 백오프와 청크 스킵을 가른다 (P1-1)', () => {
  const 덩이 = 콘텐츠소스().split(/\nfunction /).find((c) => c.startsWith('aiCall_'));
  assert.ok(덩이, 'aiCall_ 이 사라졌다 — 표식이 낡았으면 이 검사는 공회전이다(F207)');
  const 줄 = 덩이.split('\n').filter((l) => l.indexOf('옛 글자 감지') !== -1 && l.indexOf('throw') !== -1);
  assert.ok(줄.length >= 1, 'aiCall_ 의 옛글자 throw 를 못 찾았다 — 문구를 바꿨으면 이 표식도 같이 옮긴다');
  줄.forEach((l) => assert.ok(/permanent\s*=\s*true/.test(l),
    'aiCall_ 옛글자 throw 가 permanent 표시를 잃었다 — 배치 catch 는 이 표시로 break/진행을 가른다'));
});

test('[처분] 청크 배치 catch 의 break 는 permanent 를 가른다 — 한 청크가 그날 밤 전원을 죽이지 않는다 (P1-1)', () => {
  const src = 콘텐츠소스();
  for (const 표식 of ['한문장 배치:', 'AI 칭호 배치 실패:']) {
    const i = src.indexOf(표식);
    assert.ok(i !== -1, `${표식} catch 를 못 찾았다 — 표식이 낡았으면 이 검사는 공회전이다(F207)`);
    const 끝 = src.indexOf('\n', i);
    const 줄 = src.slice(src.lastIndexOf('\n', i) + 1, 끝 === -1 ? undefined : 끝);
    assert.ok(줄.indexOf('break') !== -1 && 줄.indexOf('permanent') !== -1,
      `${표식} catch 의 break 가 permanent 를 안 가른다 — 옛글자 한 청크가 뒤쪽 청크 전부를 중단시킨다`);
  }
});

test('[백스톱] 격리 안내 메일이 옛글자 예외를 말한다 — 「멀쩡하면 공개」가 게이트를 되돌리지 않게 (P1-2)', () => {
  const src = 콘텐츠소스();
  const i = src.indexOf('🚧 품질 게이트 격리 '); // 🚧 까지가 표식이다 — 민 문구는 1888 줄 주석(held= 설명)에 먼저 걸린다
  assert.ok(i !== -1, '격리 안내 문구를 못 찾았다 — 표식이 낡았으면 이 검사는 공회전이다(F207)');
  const 근처 = src.slice(i, i + 1500);
  assert.ok(근처.indexOf('옛글자') !== -1 && 근처.indexOf("'노출'로 바꾸지 말고") !== -1,
    '격리 메일에 옛글자 예외 안내가 없다 — 옛글자 격리는 육안으로 멀쩡해 보여 「멀쩡하면 공개」 지시가 막은 글자를 학생에게 보낸다');
});

/* ── ⑥ 상담 층 처분 — 역번역 «검증 폐기»와 일시 오류를 가른다 (컨텍스트 독립 리뷰 P2-②③ · 08-13) ──
 * v9.223 은 옛 글자 걸림도 null 로 접어 확인 화면에 「역번역 실패」(일시 오류의 얼굴)로 떴다 —
 * 번역기는 원문의 그 글자를 그대로 옮겨 오므로 이 걸림은 «나갈 초안» 쪽 신호인데, 그 신호가
 * 네트워크 오류로 위장되던 자리. 갈래는 값의 모양이 진다: 배열=성공 · null=일시 · {사유:'옛글자'}=폐기.
 * ⚠ 상담AI.js 는 ENGINE_FILES 밖이라(상담지식.test.js 머리말) 별도 컨텍스트에 엔진과 «함께» 싣는다 —
 *   상담_역번역처분_ 이 부르는 옛글자걸림_ 은 엔진_콘텐츠AI.js 소유라 따로 실으면 ReferenceError 다. */
const 상담ctx = {
  SpreadsheetApp: stub, PropertiesService: stub, Utilities: stub, Session: stub,
  MailApp: stub, GmailApp: stub, UrlFetchApp: stub, DriveApp: stub, FormApp: stub,
  DocumentApp: stub, ScriptApp: stub, CacheService: stub, LockService: stub,
  HtmlService: stub, Logger: { log: () => {} }, console,
};
vm.createContext(상담ctx);
vm.runInContext(engineSource() + '\n' +
  fs.readFileSync(path.join(ROOT, 'contents_상담AI.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(ROOT, '상담AI.js'), 'utf8'), 상담ctx);

test('[상담] 상담_역번역처분_ — 깨끗한 배열은 그대로, 걸리면 {사유, 짚음} 마커 (P2-②)', () => {
  const 깨끗 = ['어머님, 확인 후 연락드리겠습니다.'];
  assert.equal(상담ctx.상담_역번역처분_(깨끗), 깨끗, '깨끗한 역번역이 마커로 바뀌었다 — 거짓양성');
  const 마커 = 상담ctx.상담_역번역처분_(['앞' + 한자 + '뒤']);
  assert.ok(마커 && !Array.isArray(마커), '옛 글자 걸림이 배열·null 로 접혔다 — 사유가 다시 위장된다');
  assert.equal(마커.사유, '옛글자');
  assert.equal(마커.짚음, 'U+683C', '짚음이 U+XXXX 표기가 아니다(F298)');
  // 갈래를 모르는 호출부의 안전 — [0]·[i] 접근이 undefined 라 「없음」으로 접힌다(새는 방향이 통과가 아니다)
  assert.equal(마커[0], undefined);
});

test('[상담] 시스템 프롬프트가 문자 규칙을 싣는다 — 이력 오염(매 턴 throw→인계초안 2차 호출)의 뿌리를 낮춘다 (P2-③)', () => {
  const sys = 상담ctx.상담_시스템_();
  assert.ok(sys.indexOf('한글·몽골어(키릴)·영어만 쓴다') !== -1,
    '상담 프롬프트에서 문자 규칙 줄이 사라졌다 — 프로즈는 확률을 낮추는 층일 뿐이지만(막는 것은 게이트), ' +
    '이 줄이 없으면 한자·가나 이력의 세션마다 매 턴 게이트 throw 와 인계초안 2차 호출이 반복된다');
});
