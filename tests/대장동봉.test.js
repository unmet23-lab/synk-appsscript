/* 이해대장 «동봉» 게이트 회귀 (유호 지시 2026-08-14 「정본 고칠 때 이해대장 재생성 자동으로」)
 *
 * 무엇을 지키나 — `docs/SYNK_철학.md` 를 고치면서 그 파생인 `docs/이해대장.html` 을 두고 가는 커밋을
 *   **커밋 전에** 막는다. 안 막으면 `tests/이해대장.test.js` 가 HEAD 에서 빨개지고, 그 적색은 낸
 *   사람이 아니라 **그 뒤 커밋하는 모든 세션의 배포**를 막는다(08-14 하루에 회수 커밋 넷).
 *
 * 🔑 탐지력은 **픽스처가 진다** — 실저장소에는 거짓양성만 묻는다(가드 맹점 ②: 버그가 아직 있을 것을
 *   요구하는 회귀 금지). 형제 저장소가 없는 기계는 fail 이 아니라 skip 으로 드러낸다(F296·F207).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
/* 🔑 공용 통로로 띄운다 — 직접 `spawnSync` 하면 **미실행이 「차단」으로 번역된다**: 스폰이 실패하면
 *   `status` 가 null 이고 `null !== 0` 이라 아래 「막는다」 단언이 전부 초록이 된다. 실제로 이 파일의
 *   첫 판이 그랬고 `tests/훅통로.test.js` 가 잡았다(그 가드가 노린 바로 그 모양). */
const { 훅띄우기 } = require('./lib/훅띄우기.js');

const ROOT = path.join(__dirname, '..');
const 도구 = path.join(ROOT, 'tools', '이해대장.js');
const 정본실물 = path.join(ROOT, 'docs', 'SYNK_철학.md');
const 산출실물 = path.join(ROOT, 'docs', '이해대장.html');
const 훅원본 = path.join(ROOT, 'tools', 'githooks', 'pre-commit');

/** `--검사` 를 사본 두 벌에 대고 돌린다 — 저장소 파일은 읽기만 한다(옆 세션의 작업본을 흔들지 않는다).
 *  @param {string[]} [방아쇠] 게이트가 넘기는 «담아야 할 경로»(F520). 안 주면 이음매 없이 부르는
 *         옛 자리 그대로다 — 그 기본값이 정본인지도 아래에서 함께 잰다. */
function 검사(화면내용, 방아쇠) {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-대장시험-'));
  try {
    const 정본 = path.join(방, 'a.md');
    const 산출 = path.join(방, 'b.html');
    fs.copyFileSync(정본실물, 정본);
    if (화면내용 !== null) fs.writeFileSync(산출, 화면내용, 'utf8');
    const env = { ...process.env, SYNK_대장_정본: 정본, SYNK_대장_산출: 산출 };
    if (방아쇠) env.SYNK_대장_방아쇠 = 방아쇠.join('\n');
    // 통과코드 = 0(같다)·1(차단) 둘뿐이다 — 그 밖은 결과가 아니라 오류다(통로가 던진다).
    const r = 훅띄우기([도구, '--검사'], { cwd: ROOT, encoding: 'utf8', 통과코드: [0, 1], env });
    return { 막혔나: r.status !== 0, 출력: String(r.stderr || '') + String(r.stdout || '') };
  } finally { try { fs.rmSync(방, { recursive: true, force: true }); } catch (_) { /* 청소 실패는 판정이 아니다 */ } }
}

/* 형제 저장소가 없는 기계에서는 판정층이 「못 쟀다」로 접는다(그게 옳다 · F103) — 그 환경에서
 * 탐지력을 단언하면 **환경 탓 적색**이 되므로, 미실행을 fail 아닌 skip 으로 드러낸다(F296). */
const 잴수있나 = () => !/못 했다/.test(검사(fs.readFileSync(산출실물, 'utf8')).출력);

/* ── 탐지력 ──────────────────────────────────────────────────────────── */

test('🔴 급소 — 화면이 정본을 안 따라오면 막는다 (이 커밋이 만드는 HEAD 가 빨갛다)', (t) => {
  if (!fs.existsSync(산출실물)) return t.skip('산출물이 없다 — 이 환경에선 못 잰다');
  if (!잴수있나()) return t.skip('형제 저장소를 못 읽어 판정층이 접혔다(F296)');
  const r = 검사(fs.readFileSync(산출실물, 'utf8') + '<!-- 낡음 -->');
  assert.ok(r.막혔나, '낡은 화면을 실은 커밋이 그대로 나갔다 — 그 뒤 모든 세션의 배포가 막힌다');
  assert.match(r.출력, /이해대장\.html/, '막히긴 했는데 어느 파일인지 안 말한다 — 처방이 없으면 다음 수는 BYPASS 다');
});

test('🔴 화면이 아예 없어도 막는다 — 「없다」와 「같다」가 같은 모양이면 안 된다', (t) => {
  if (!잴수있나()) return t.skip('형제 저장소를 못 읽어 판정층이 접혔다(F296)');
  const r = 검사(null);
  assert.ok(r.막혔나, '화면이 없는데 통과시켰다');
  assert.match(r.출력, /없다/, '없다는 사실을 안 말한다');
});

/* ── 줄끝은 판정 대상이 아니다 (맹점 ④ — 장치가 «맞는 얼굴로» 틀린 값을 내던 자리) ─────
 * 08-14 실측: 같은 내용인데 LF 는 통과, CRLF 는 차단(exit 1)이었다. 이 저장소는
 * core.autocrlf=true 라 **체크아웃이 CRLF 로 내려주므로** 새 클론·`git checkout` 직후의
 * 첫 검사가 곧 거짓 적색이고, 그 적색은 `/deploy` 2단계 게이트라 모든 세션의 배포를 멈춘다.
 * 위 두 「막는다」 시험과 짝이다 — 여기서 접는 것은 줄끝뿐이고 내용 차이는 그대로 막힌다. */
test('🔴 줄끝만 다른 판(CRLF 체크아웃)은 막지 않는다 — 거짓 적색 하나가 저장소 전체 배포를 멈춘다', (t) => {
  if (!fs.existsSync(산출실물)) return t.skip('산출물이 없다 — 이 환경에선 못 잰다');
  if (!잴수있나()) return t.skip('형제 저장소를 못 읽어 판정층이 접혔다(F296)');
  const r = 검사(fs.readFileSync(산출실물, 'utf8').replace(/\r?\n/g, '\r\n'));
  assert.strictEqual(r.막혔나, false,
    `줄끝만 CRLF 인 같은 화면을 「안 따라온다」로 읽었다 — 새 체크아웃마다 남의 배포가 멈춘다:\n${r.출력}`);
});

/* ── 자기 처방이 실제로 통하는가 (맹점 ③ — 따를 수 없는 처방은 우회를 정상 통로로 만든다) ── */

test('🔑 차단문이 시키는 대로 다시 그리면 그대로 통과한다', (t) => {
  if (!fs.existsSync(산출실물)) return t.skip('산출물이 없다 — 이 환경에선 못 잰다');
  if (!잴수있나()) return t.skip('형제 저장소를 못 읽어 판정층이 접혔다(F296)');
  const r = 검사(fs.readFileSync(산출실물, 'utf8'));
  assert.strictEqual(r.막혔나, false, `처방대로 했는데 또 막혔다 — 그러면 남는 문은 BYPASS 뿐이다:\n${r.출력}`);
});

test('🔑 차단문이 **그대로 칠 수 있는 명령**을 내민다 (손으로 옮겨 적게 하면 안 따른다 · F103)', (t) => {
  if (!잴수있나()) return t.skip('형제 저장소를 못 읽어 판정층이 접혔다(F296)');
  const r = 검사(null);
  assert.match(r.출력, /node tools\/이해대장\.js/, '다시 그리는 명령이 없다');
  assert.match(r.출력, /git add -- docs\/이해대장\.html/, '같은 커밋에 담는 방법을 안 준다(F302 가 이 가드의 이유다)');
});

/* ── 처방의 «경로»는 방아쇠를 따라간다 (F520 — 화면의 부모가 둘이라 문장 하나로는 못 맞춘다) ──
 * 판정은 여전히 이 한 곳이 지고, «무엇이 방아쇠였나»만 게이트가 이음매로 넘긴다. 그래서
 * 처방 문장도 한 곳에서만 찍힌다 — 두 곳에서 각자 찍으면 갈라지고, 갈라진 처방은 못 따른다. */

test('🔑 생성기가 방아쇠면 처방이 **생성기 경로**를 댄다 (정본을 대면 따를수록 트랙이 갈린다 · F302)', (t) => {
  if (!잴수있나()) return t.skip('형제 저장소를 못 읽어 판정층이 접혔다(F296)');
  const r = 검사(null, ['tools/이해대장.js']);
  assert.ok(r.막혔나, r.출력);
  assert.match(r.출력, /git commit[^\n]*tools\/이해대장\.js/,
    `방아쇠를 넘겼는데 처방이 그 경로를 안 댄다 — 그대로 따르면 생성기가 커밋에서 빠진다:\n${r.출력}`);
  assert.doesNotMatch(r.출력, /git commit[^\n]*SYNK_철학\.md/,
    `생성기 커밋인데 정본을 담으라고 한다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103):\n${r.출력}`);
});

test('🔑 부모 둘이 함께 방아쇠면 처방이 **둘 다** 댄다 (하나만 대면 나머지가 조용히 빠진다)', (t) => {
  if (!잴수있나()) return t.skip('형제 저장소를 못 읽어 판정층이 접혔다(F296)');
  const r = 검사(null, ['docs/SYNK_철학.md', 'tools/이해대장.js']);
  assert.match(r.출력, /git commit[^\n]*docs\/SYNK_철학\.md[^\n]*tools\/이해대장\.js/,
    `방아쇠 둘 중 하나만 처방에 실렸다 — 빠진 쪽이 그 커밋에서 조용히 떨어진다:\n${r.출력}`);
});

test('이음매가 안 오면 옛 기본값(정본)이다 — 게이트를 안 거쳐 부르는 자리를 깨지 않는다', (t) => {
  if (!잴수있나()) return t.skip('형제 저장소를 못 읽어 판정층이 접혔다(F296)');
  const r = 검사(null);
  assert.match(r.출력, /git commit[^\n]*docs\/SYNK_철학\.md/,
    `이음매 없이 부르니 처방에서 정본이 사라졌다 — 옛 호출 자리가 못 따를 명령을 받는다:\n${r.출력}`);
});

/* ── 등재 — 도구만 두고 안 부르면 장치는 안 돈다 ─────────────────────── */

test('실저장소: pre-commit 이 이 게이트를 부른다 (스스로 발화하지 않는 장치는 안 돈다)', () => {
  assert.match(fs.readFileSync(훅원본, 'utf8'), /대장동봉검사\.js/,
    '훅이 이 게이트를 안 부른다 — 장치와 발동 조건은 같은 커밋에서 정한다');
});

test('실저장소: 설치본(.git/hooks)도 최신이라 실제로 돈다', (t) => {
  const 설치본 = path.join(ROOT, '.git', 'hooks', 'pre-commit');
  if (!fs.existsSync(설치본)) return t.skip('훅이 이 기계에 안 깔렸다 — node tools/install-githooks.js');
  assert.match(fs.readFileSync(설치본, 'utf8'), /대장동봉검사\.js/,
    '설치본이 낡았다(원본만 고쳤다) — node tools/install-githooks.js 로 다시 깐다');
});

/* ── 실저장소: 거짓양성만 묻는다 ─────────────────────────────────────── */

test('실저장소: 지금 커밋된 화면은 정본과 같다 (거짓양성 검사 — 탐지력은 위 픽스처가 진다)', (t) => {
  if (!fs.existsSync(산출실물)) return t.skip('산출물이 없다 — 이 환경에선 못 잰다');
  const r = 검사(fs.readFileSync(산출실물, 'utf8'));
  if (/못 했다/.test(r.출력)) return t.skip('형제 저장소를 못 읽어 판정층이 접혔다(F296)');
  assert.strictEqual(r.막혔나, false, `실저장소가 이미 갈라져 있다 — node tools/이해대장.js:\n${r.출력}`);
});

/* ── 방아쇠 목록이 화면의 입력을 덮는가 (F520 의 남은 칸 — 부모는 둘이 아니라 다섯이었다) ──
 * 「정본+생성기」로 넓힌 뒤에도, 생성기가 `require` 하는 부품만 담은 커밋은 여전히 조용히 통과한다.
 * 🔑 게이트를 **require 해서 값을 잰다** — 소스 글자를 grep 하면 주석 처리된 줄까지 「있다」로 세고,
 *   그 초록은 목록이 실제로 좁아진 것과 모양이 같다(변이로 실측한 자리).
 * 🔑 재는 것은 «한 홉»뿐이다 — 전이 입력(시트도달 → 엔진 원본)까지 넣으면 사실상 매 커밋이라
 *   E2E 의 「소음 0」과 부딪는다. 그 축은 사후 회귀가 진다. */
const { 방아쇠목록 } = require(path.join(ROOT, 'tools', '대장동봉검사.js'));

test('🔴 급소 — 방아쇠 목록이 생성기 자신을 포함한다 (F520 이 난 바로 그 칸)', () => {
  assert.ok(방아쇠목록.includes('tools/이해대장.js'),
    `생성기가 방아쇠에 없다 — 도구만 담은 커밋에서 이 게이트는 눈이 먼다. 지금 목록: ${방아쇠목록.join(' · ')}`);
});

test('🔴 급소 — 생성기가 읽는 in-repo 부품이 방아쇠 목록에서 빠지지 않는다 (**전이 폐포**)', () => {
  /* 🔴 2026-08-19: 이 검사는 «한 홉»만 봤고, 그래서 두 홉째(`loom얹기` → `loom.js`)가 샜다 —
   *   `loom.js` 만 고친 커밋에서 대장 화면이 낡았는데 방아쇠가 안 물었다. 홉 수를 하나 늘리는
   *   대신 **폐포로** 올린다: 손 목록은 홉이 늘 때마다 같은 방식으로 다시 눈이 먼다. */
  const 본것 = new Set(); const 읽는것 = []; const 큐 = [도구];
  while (큐.length) {
    const f = 큐.shift();
    if (본것.has(f) || !fs.existsSync(f)) continue;
    본것.add(f);
    const 글 = fs.readFileSync(f, 'utf8');
    /* `require('./lib/…')` 만 센다 — `node:` 내장과 동적 require(형제 저장소)는 이 저장소 밖이거나
     * 경로가 실행 시점에 정해져서, 스테이징 목록과 대조할 수 있는 이름이 아니다. */
    for (const m of 글.matchAll(/require\('(\.\.?\/[^']+)'\)/g)) {
      const abs = path.resolve(path.dirname(f), m[1].endsWith('.js') ? m[1] : `${m[1]}.js`);
      const rel = path.relative(ROOT, abs).split(path.sep).join('/');
      if (!rel.startsWith('tools/')) continue;      // 정본 JSON·문서는 따로 등재돼 있다
      읽는것.push(rel); 큐.push(abs);
    }
  }
  assert.ok(읽는것.length, '생성기의 in-repo require 를 하나도 못 뽑았다 — 이 검사가 0건 위에서 초록이 됐다(F207)');
  const 빠진것 = [...new Set(읽는것)].filter((p) => !방아쇠목록.includes(p));
  assert.deepStrictEqual(빠진것, [],
    `생성기가 (전이로) 읽는데 방아쇠에 없다 — 그 파일만 고친 커밋에서 화면이 조용히 낡는다:\n  ${빠진것.join('\n  ')}`);
});
