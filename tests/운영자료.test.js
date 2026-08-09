/* 운영자료 내보내기 회귀 — 유호 상시 지시(2026-08-09) "만든 건 여기로 다 넣어줘"의 통로.
 *
 * 실사고 둘을 못박는다:
 *   ① **바탕화면 경로 함정** — 실경로는 `OneDrive\Desktop` 인데 `USERPROFILE\Desktop` 도
 *      존재해서 `Test-Path` 가 True 다. 그 자리에 폴더를 만들고 "바탕화면에 넣었습니다"라고
 *      보고했다(유호님이 "안 보이는데?"로 잡음). 경로 확장은 repo 밖 환경이라 여기선
 *      **skip 으로 드러내고**, 기계가 지는 몫은 아래 순수 함수 넷이다.
 *   ② **사본이 매번 쌓이는 것** — `이미있나` 가 바로가기의 `대상`만 봤다. 사본은 대상 기록이
 *      없어 검사를 통과하고, 같은 파일을 두 번 넣으면 09·10·11… 로 늘어난다.
 *      **탐지력은 이 픽스처가 진다** — 실제 바탕화면 상태와 무관하게 잡힌다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const { 다음번호, 바로가기냐, 안전한이름, 이미있나, 폴더명 } = require('../tools/운영자료.js');

/* ── 다음번호 ─────────────────────────────────────────────── */

test('다음번호: 빈 폴더는 01', () => {
  assert.strictEqual(다음번호([]), '01');
});

test('다음번호: 최대값+1 — 중간이 비어도 뒤에 붙는다', () => {
  assert.strictEqual(다음번호(['01_가.html', '02_나.lnk', '05_다.pdf']), '06');
});

test('다음번호: 번호 없는 파일은 세지 않는다', () => {
  assert.strictEqual(다음번호(['desktop.ini', '메모.txt', '03_다.html']), '04');
});

test('다음번호: 두 자리를 넘어도 자리수만 늘고 깨지지 않는다', () => {
  assert.strictEqual(다음번호(['99_끝.html']), '100');
});

/* ── 바로가기냐 (repo 안=바로가기 · 밖=사본) ───────────────── */

test('바로가기냐: repo 안 문서는 바로가기 — 사본은 정본이 바뀌어도 안 바뀐다', () => {
  const 루트 = path.resolve('/repo');
  assert.strictEqual(바로가기냐(path.join(루트, 'docs', '정본.txt'), 루트), true);
});

test('바로가기냐: repo 밖(스크래치패드·바탕화면 생성물)은 사본', () => {
  const 루트 = path.resolve('/repo');
  assert.strictEqual(바로가기냐(path.resolve('/tmp', '만든것.html'), 루트), false);
});

test('바로가기냐: 루트 자기 자신은 바로가기 대상이 아니다', () => {
  const 루트 = path.resolve('/repo');
  assert.strictEqual(바로가기냐(루트, 루트), false);
});

test('바로가기냐: 이름이 겹치는 형제 폴더를 repo 안으로 오인하지 않는다', () => {
  const 루트 = path.resolve('/repo');
  // `/repo-talk` 는 `/repo` 로 시작하지만 repo 안이 아니다 — 문자열 startsWith 로 짜면 틀린다
  assert.strictEqual(바로가기냐(path.resolve('/repo-talk', 'a.js'), 루트), false);
});

/* ── 안전한이름 ───────────────────────────────────────────── */

test('안전한이름: Windows 금지 문자를 지운다', () => {
  assert.strictEqual(안전한이름('가:나*다?라"마<바>사|아/자\\차'), '가나다라마바사아자차');
});

test('안전한이름: 한글·중점·괄호는 살린다 — 유호님이 읽는 이름이다', () => {
  assert.strictEqual(안전한이름('급여·인센티브 정본 (원문)'), '급여·인센티브 정본 (원문)');
});

test('안전한이름: 앞뒤 공백을 떼고 연속 공백을 줄인다', () => {
  assert.strictEqual(안전한이름('  운영   한눈에  '), '운영 한눈에');
});

test('안전한이름: 너무 긴 이름은 잘라 경로 길이 한계를 안 넘긴다', () => {
  assert.ok(안전한이름('가'.repeat(300)).length <= 90);
});

/* ── 이미있나 (재실행 안전) ───────────────────────────────── */

test('이미있나: 같은 대상의 바로가기가 있으면 다시 안 넣는다', () => {
  const 대상 = path.resolve('/repo/docs/정본.txt');
  const 항목 = [{ 이름: '02_정본.lnk', 대상 }];
  assert.strictEqual(이미있나(항목, 대상), true);
});

test('이미있나: 대상 경로 표기가 달라도(상대·대소문자) 같은 파일로 본다', () => {
  const 항목 = [{ 이름: '02_정본.lnk', 대상: path.resolve('/repo/docs/../docs/정본.txt') }];
  assert.strictEqual(이미있나(항목, path.resolve('/repo/docs/정본.txt')), true);
});

test('이미있나: **사본도 잡는다** — 대상 기록이 없어 매번 쌓이던 자리', () => {
  // 바로가기가 아니라 복사본이라 `대상` 이 null 이다. 파일명으로 봐야 잡힌다.
  const 항목 = [{ 이름: '01_운영_한눈에.html', 대상: null }];
  assert.strictEqual(이미있나(항목, path.resolve('/tmp/운영_한눈에.html')), true);
});

test('이미있나: 다른 파일은 통과시킨다 — 무조건 막으면 아무것도 못 넣는다', () => {
  const 항목 = [{ 이름: '01_운영_한눈에.html', 대상: null }];
  assert.strictEqual(이미있나(항목, path.resolve('/tmp/복구_절차서.html')), false);
});

/* ── 폴더 이름 ────────────────────────────────────────────── */

test('폴더명은 유호님이 쓰는 그 이름 그대로다', () => {
  // 이름이 바뀌면 유호님 바탕화면에 폴더가 둘로 갈라진다 — 바꾸려면 여기부터 고친다
  assert.strictEqual(폴더명, 'SYNK 운영자료');
});

/* ── repo 밖 환경: 재지 못하는 것은 skip 으로 드러낸다 ────── */

test('바탕화면 실경로 확장은 이 기계에서만 잴 수 있다', (t) => {
  if (process.platform !== 'win32') {
    t.skip('win32 아님 — 바탕화면 리디렉션은 Windows 셸 개념이다');
    return;
  }
  if (!process.env.USERPROFILE) {
    t.skip('USERPROFILE 없음(CI) — 실경로 확장은 실기계에서만 검증된다');
    return;
  }
  // 여기까지 왔으면 실기계다. 값 자체는 기계마다 다르므로 「폴백을 조용히 쓰지 않는다」만 본다.
  const 소스 = require('node:fs').readFileSync(
    path.join(__dirname, '..', 'tools', '운영자료.js'),
    'utf8'
  );
  assert.match(소스, /GetFolderPath\('Desktop'\)/, '경로를 상수로 쓰지 말고 셸에 물어야 한다');
  assert.match(소스, /폴백을 썼다/, '폴백을 쓰면 조용히 넘어가지 않고 경고해야 한다');
});

test('읽는 층이 값을 깨뜨리지 않는다 — 한글 경로 오보를 막는 프리앰블', () => {
  // 실사고: 프리앰블이 없으면 출력이 CP949 라 한글 경로가 `????` 로 와서
  // **멀쩡한 바로가기 7개를 전부 「🔴 대상 없음」으로 오보**했다. 원본은 손대지 않았는데
  // 재는 층이 틀린 형태라 조용하다 — 그래서 소스로 못박는다(실행 결과로는 재현이 환경 의존).
  const 소스 = require('node:fs').readFileSync(
    path.join(__dirname, '..', 'tools', '운영자료.js'),
    'utf8'
  );
  assert.match(소스, /OutputEncoding\]::UTF8|OutputEncoding=\[Text\.Encoding\]::UTF8/,
    '출력 인코딩을 UTF8 로 고정하지 않으면 한글 경로가 깨져 「대상 없음」 오보가 난다');
  assert.match(소스, /ProgressPreference='SilentlyContinue'/,
    '진행률이 CLIXML 로 새어 출력을 덮는다');
  assert.match(소스, /stdio:\s*\['ignore',\s*'pipe',\s*'ignore'\]/,
    'stderr 를 stdout 과 섞으면 CLIXML 이 결과에 낀다');
});
