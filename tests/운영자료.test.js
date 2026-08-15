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
/* 부정 단언의 주어만 정제한다 — 주석이 금지 패턴을 «설명»하면 그 설명이 위반으로 잡힌다(대기열 #Q72). */
const { 코드만 } = require('./lib/소스검사.js');

const { 다음번호, 바로가기냐, 안전한이름, 이미있나, 짝찾기, 정본후보, 폴더명, 기저키, 짝의심,
  상태판정, 스냅샷원본 } = require('../tools/운영자료.js');

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

/* ── 짝찾기 (`--갱신` — 사본이 낡는 뒷문) ─────────────────────
 * 실사고 2026-08-09: 정본 `docs/운영_한눈에.html` 의 주말가를 고쳤는데 유호님이 여는
 * 바탕화면 사본은 옛값 그대로였다. 바로가기는 원래 최신인데 **사본만 이 구멍이 있다.**
 * 덮는 일이라 비가역이다 — 그래서 「1개일 때만 덮는다」를 픽스처로 못박는다.
 */

test('짝찾기: 번호를 뗀 이름으로 정본을 찾는다', () => {
  const 후보 = [path.resolve('/repo/docs/운영_한눈에.html'), path.resolve('/repo/docs/DESIGN.md')];
  assert.strictEqual(짝찾기('01_운영_한눈에.html', 후보), 후보[0]);
});

test('짝찾기: 후보가 없으면 null — 「출처 모름」이지 「안 바뀐 것」이 아니다', () => {
  /* 옛 실제 사례: `00_컴퓨터를 잃어버렸을 때.html` 의 정본이 `docs/복구_절차서.html` 이라 이름이 갈렸고,
   * 그래서 **복구 절차서만 자동 갱신 밖에** 남아 있었다(2026-08-10 실측 — 정본을 고쳐도 사본은 옛 판).
   * 하필 가장 낡으면 안 되는 문서라 정본을 사본 이름에 맞춰 개명해 사슬에 넣었다.
   * 이 검사는 그대로 둔다 — 「짝을 못 찾으면 짐작해서 덮지 않는다」는 성질 자체가 지킬 값이다. */
  const 후보 = [path.resolve('/repo/docs/이름이 다른 정본.html')];
  assert.strictEqual(짝찾기('00_컴퓨터를 잃어버렸을 때.html', 후보), null);
});

test('짝찾기: **후보가 둘이면 안 고른다** — 짐작해서 덮으면 되돌릴 수 없다', () => {
  const 후보 = [
    path.resolve('/repo/docs/운영_한눈에.html'),
    path.resolve('/repo/docs/발표/운영_한눈에.html'),
  ];
  assert.strictEqual(짝찾기('01_운영_한눈에.html', 후보), null);
});

test('짝찾기: 번호가 없는 사본 이름도 그대로 찾는다', () => {
  const 후보 = [path.resolve('/repo/docs/메모.html')];
  assert.strictEqual(짝찾기('메모.html', 후보), 후보[0]);
});

test('정본후보: `_archive`(구판)와 `_ops`(장부)는 후보가 아니다', () => {
  // 구판이 같은 이름으로 남아 있으면 「후보 2개」가 되어 갱신이 통째로 멈춘다.
  // 더 나쁜 경우엔 구판으로 덮는다 — `가격_수업표_추천_v3` 이 그 모양이었다.
  const 소스 = require('node:fs').readFileSync(
    path.join(__dirname, '..', 'tools', '운영자료.js'),
    'utf8'
  );
  assert.match(소스, /'_archive',\s*'_ops'/, '구판·장부 폴더를 후보에서 빼야 한다');
});

test('정본후보: 실저장소에서 실제로 몇 개를 걷는지 — 0건이면 갱신이 통째로 미실행이다', () => {
  const 후보 = 정본후보();
  assert.ok(후보.length > 0, '후보 0건이면 모든 사본이 「출처 모름」으로 조용히 넘어간다');
  assert.ok(
    후보.some((p) => path.basename(p) === '운영_한눈에.html'),
    '유호님이 여는 사본의 정본이 후보에 들어 있어야 한다'
  );
  assert.ok(
    !후보.some((p) => p.includes(`${path.sep}_archive${path.sep}`)),
    '_archive 가 섞이면 구판으로 덮을 수 있다'
  );
});

/* ── 폴더 이름 ────────────────────────────────────────────── */

test('폴더명은 유호님이 쓰는 그 이름 그대로다', () => {
  // 이름이 바뀌면 유호님 바탕화면에 폴더가 둘로 갈라진다 — 바꾸려면 여기부터 고친다
  assert.strictEqual(폴더명, 'SYNK 운영자료');
});

/* ── 바탕화면 경로: 몫이 공용 통로로 옮겨갔다 ─────────────────
 * 2026-08-10: 같은 탐지가 세 파일에 흩어져 있었고(여기 + 철학열람빌드 + 교재읽기본),
 * 회귀는 **이 파일 것만** 물었다 — 다른 둘이 갈라져도 아무 데도 안 빨갰다.
 * 이제 정본은 `tools/lib/바탕화면.js` 고, 「상수로 쓰지 말고 셸에 묻는다」는 그쪽 회귀가 진다
 * (`tests/바탕화면통로.test.js`). 여기 남는 몫은 **이 파일이 그 통로를 쓴다**는 것과,
 * 폴백을 조용히 넘기지 않는다는 것 둘뿐이다. */

test('운영자료는 바탕화면을 직접 찾지 않고 공용 통로를 쓴다', () => {
  const 소스 = require('node:fs').readFileSync(
    path.join(__dirname, '..', 'tools', '운영자료.js'),
    'utf8'
  );
  assert.match(소스, /require\('\.\/lib\/바탕화면\.js'\)/, '바탕화면 탐지는 공용 통로 하나만 쓴다');
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
  assert.match(소스, /stdio:\s*\['ignore',\s*'pipe',\s*'pipe'\]/,
    'stderr 는 **받아야 한다** — execFileSync 는 stdout 과 따로 담으므로 섞이지 않는다. ' +
    '버리면 실패가 「stderr 없이 exit 1」로 보인다(2026-08-13 유호 신고 그 모양).');
  assert.match(소스, /PS오류읽기\(e\.stderr\)/,
    'CLIXML 을 사람이 읽는 문장으로 풀어 던져야 원인이 보인다');
});

/* ── 옛 판 자동 걷기 (유호 지시 2026-08-13) ──────────────────────
 * "캐릭터 시안 1,2,3,4 있으면 1,2,3은 자동삭제되고 확정된 4만 유지".
 * 🔴 이 기능의 급소는 **비가역**이다 — 계열을 넓게 잡으면 필요한 것을 지운다.
 * 그래서 회귀는 「지우는가」보다 **「안 지우는가」**를 더 많이 문다.
 */
const { 계열키, 옛판고르기, 갈래들, 갈래폴더 } = require('../tools/운영자료.js');

test('판 표기가 없으면 계열이 아니다 — 병렬 후보를 서로의 옛 판으로 보면 안 된다', () => {
  // BGM 후보 A·B 는 「같이 놓고 고르는 것」이지 A 가 B 의 구판인 게 아니다.
  assert.equal(계열키('21_BGM 후보 A (물결 — 패드 중심).wav'), null);
  assert.equal(계열키('22_BGM 후보 B (별빛 — 아르페지오).wav'), null);
  assert.equal(계열키('23_BGM 개정판 (깔림만 — 튀는 소리 제거).wav'), null);
  assert.equal(계열키('01_운영_한눈에.lnk'), null);
  assert.equal(계열키('02_급여·인센티브 정본 (원문).lnk'), null);
  assert.deepEqual(
    옛판고르기([
      '21_BGM 후보 A (물결 — 패드 중심).wav',
      '22_BGM 후보 B (별빛 — 아르페지오).wav',
      '23_BGM 개정판 (깔림만 — 튀는 소리 제거).wav',
    ]),
    [],
    '판 표기 없는 것들끼리는 절대 안 걷힌다'
  );
});

test('판 번호와 날짜를 판으로 읽는다 — 밑줄이 앞에 와도(단어경계가 없다)', () => {
  assert.equal(계열키('20_NPC 시안 v2 (확정판 전체 실물).lnk').계열, 'npc 시안');
  assert.equal(계열키('20_NPC 시안 v2 (확정판 전체 실물).lnk').판, 2000);
  // 🔴 `_2026` 은 밑줄이 \w 라 `\b` 가 안 먹는다 — 옛 정규식이 날짜 판을 통째로 놓쳤다(실측).
  const 날짜 = 계열키('SYNK_홈페이지_시안_2026-08-09.lnk');
  assert.equal(날짜.계열, 'synk 홈페이지 시안');
  assert.equal(날짜.판, 20260809);
});

test('같은 계열에서 최신 하나만 남기고 고른다 — 그리고 최신은 절대 안 고른다', () => {
  const 걷을것 = 옛판고르기([
    '18_캐릭터 시안 v1 (초안).lnk',
    '18_캐릭터 시안 v3 (중간).lnk',
    '18_캐릭터 시안 v4 (유령 확장판).lnk',
  ]);
  assert.deepEqual(걷을것.map((x) => x.이름).sort(), [
    '18_캐릭터 시안 v1 (초안).lnk',
    '18_캐릭터 시안 v3 (중간).lnk',
  ]);
  assert.ok(!걷을것.some((x) => x.이름.includes('v4')), '최신 판이 걷히면 그 기능은 사고다');
});

test('판이 하나뿐이거나 판이 다 같으면 안 걷는다', () => {
  assert.deepEqual(옛판고르기(['18_캐릭터 시안 v4 (유령).lnk']), [], '혼자면 옛 판이란 게 없다');
  assert.deepEqual(
    옛판고르기(['A 지도 v2 (가).pdf', 'A 지도 v2 (나).html']),
    [],
    '판이 같으면 어느 쪽이 최신인지 모른다 — 모르면 안 지운다'
  );
});

test('계열이 다르면 서로를 안 걷는다', () => {
  assert.deepEqual(옛판고르기(['NPC 시안 v1.lnk', '캐릭터 시안 v4.lnk']), [],
    '이름이 달라 계열이 갈리면 판 번호가 낮아도 남는다');
});

/* ── 짝 의심 — 「없다」가 초록의 얼굴로 구판을 덮던 자리 ────────────
 * 2026-08-14 실측: `--옛판` 이 "걷어낼 옛 판이 없다"고 답한 폴더에 FB 구판 4쌍이 그대로 있었다.
 * 옛것 쪽에 판 표기가 없어 계열키가 null 이라, 묶일 상대가 아예 없었다.
 * 🔑 탐지력은 **여기 픽스처가 진다** — 실저장소엔 그 4쌍이 이미 없으니 실물로 검사하면
 *    「버그가 아직 있을 것」을 요구하는 회귀가 된다. */

test('짝의심: 무표기 기저판 ↔ v2 를 짝으로 드러낸다 (유호 신고 08-14 그 4쌍)', () => {
  const 의심 = 짝의심([
    '14_FB 첫 게시물 인사카드.png',
    '22_FB 첫 게시물 티저영상 6초.mp4',
    '23_FB 페이지 커버.png',
    '24_FB 프로필 마스코트.png',
    '26_FB 첫 게시물 인사카드 v2 체리젤리.png',
    '27_FB 첫 게시물 티저영상 6초 v2 체리젤리.mp4',
    '28_FB 페이지 커버 v2 체리젤리.png',
    '29_FB 프로필 v2 체리젤리.png',
  ]);
  assert.deepEqual(의심.map((x) => x.이름).sort(), [
    '14_FB 첫 게시물 인사카드.png',
    '22_FB 첫 게시물 티저영상 6초.mp4',
    '23_FB 페이지 커버.png',
    '24_FB 프로필 마스코트.png',
  ], '옛판고르기가 못 잡는 4쌍을 의심층이 전부 들어야 한다');
  // 🔴 꼬리 낱말이 갈린 짝도 든다 — 「프로필 마스코트」 ↔ 「프로필 … 체리젤리」는
  //    접두 일치가 두 낱말뿐이라, 좁게 잡으면 이것만 조용히 빠진다.
  const 프로필 = 의심.find((x) => x.이름.includes('프로필'));
  assert.ok(프로필.짝.includes('29_FB 프로필 v2 체리젤리.png'), '두 낱말만 겹치는 짝을 놓치면 안 된다');
});

test('짝의심: 판이 «양쪽 다» 있어도 계열이 갈린 짝을 든다 (실측 08-14 · v2 ↔ v3)', () => {
  const 의심 = 짝의심([
    '27_FB 첫 게시물 티저영상 6초 v2 체리젤리.mp4',
    '31_FB 첫 게시물 티저영상 v3 (열일곱 번째).mp4',
  ]);
  assert.deepEqual(의심.map((x) => x.이름), ['27_FB 첫 게시물 티저영상 6초 v2 체리젤리.mp4'],
    '꼬리 낱말이 판마다 바뀌면 계열이 둘로 갈려 옛판고르기가 영영 안 묶는다');
  assert.deepEqual(의심[0].짝, ['31_FB 첫 게시물 티저영상 v3 (열일곱 번째).mp4']);
});

test('짝의심: 최신은 의심 목록에 안 올린다 — 올리면 사람이 최신을 지운다', () => {
  const 의심 = 짝의심(['A 지도 v2 가지.pdf', 'A 지도 v3 나지.pdf', 'A 지도 v5 다지.pdf']);
  assert.ok(!의심.some((x) => x.이름.includes('v5')), '가장 새 판은 어느 줄에도 나오면 안 된다');
  assert.deepEqual(의심.map((x) => x.이름).sort(), ['A 지도 v2 가지.pdf', 'A 지도 v3 나지.pdf']);
});

test('짝의심: 판 표기가 «양쪽 다» 없으면 안 부른다 — 병렬 후보를 짝으로 만들지 않는다', () => {
  assert.deepEqual(짝의심([
    '17_BGM 후보 A (물결 — 패드 중심).wav',
    '18_BGM 후보 B (별빛 — 아르페지오).wav',
    '19_BGM 개정판 (깔림만 — 튀는 소리 제거).wav',
  ]), [], '서로의 옛 판이 아니라 같이 놓고 고르는 것이다');
});

test('짝의심: 낱말 하나짜리 이름은 안 부른다 — 무엇과도 겹쳐 보인다', () => {
  assert.deepEqual(짝의심(['01_지도.pdf', '02_지도 v2.pdf']), [],
    '한 낱말만으로 짝을 부르면 거짓양성이 폴더 전체로 번진다');
});

test('짝의심은 «보고만» 한다 — 옛판고르기의 삭제 판정은 넓어지지 않았다', () => {
  const 이름들 = ['14_FB 페이지 커버.png', '28_FB 페이지 커버 v2 체리젤리.png'];
  assert.equal(짝의심(이름들).length, 1, '의심은 든다');
  assert.deepEqual(옛판고르기(이름들), [], '그래도 자동 삭제 대상은 0 — 넓게 잡아 지운 것은 못 되돌린다');
});

test('기저키: 판 표기가 있으면 기저판이 아니다', () => {
  assert.equal(기저키('26_FB 페이지 커버 v2 체리젤리.png'), null);
  assert.equal(기저키('23_FB 페이지 커버.png'), 'fb 페이지 커버');
  assert.equal(기저키('23_FB 페이지 커버 (구 코랄).png'), 'fb 페이지 커버', '끝 괄호는 계열키와 같은 규칙으로 떨어진다');
});

/* ── 지금상태 — 「모름」을 초록으로 접지 않는다 ─────────────────────────
 * 이 표가 새로 만드는 위험은 「초록이면 최신」으로 읽히는 자리다. 그래서 판을 모르는 항목이
 * ✅ 쪽으로 새지 않는지를 회귀가 붙든다 — 모르는 것과 최신인 것은 **다른 상태**다. */

const 옛때 = new Date('2026-08-10T00:00:00Z');
const 새때 = new Date('2026-08-14T00:00:00Z');

test('상태판정: 바로가기가 원본을 직접 가리키면 낡을 수 없다', () => {
  assert.equal(상태판정({ 바로가기: true, 정본시각: null, 실체시각: 옛때 }), '원본');
});

test('상태판정: 구운 것이 정본보다 옛것이면 «낡음» — 유호님이 v1.6 을 읽던 그 자리', () => {
  assert.equal(상태판정({ 바로가기: true, 정본시각: 새때, 실체시각: 옛때 }), '스냅샷낡음');
  assert.equal(상태판정({ 바로가기: true, 정본시각: 옛때, 실체시각: 새때 }), '스냅샷최신');
});

test('상태판정: 🔴 정본을 못 찾은 실물은 «모름» — 초록으로 접지 않는다', () => {
  assert.equal(상태판정({ 바로가기: false, 정본시각: null, 실체시각: 새때 }), '모름',
    '짝이 없는 산출물(BGM·이미지·영상)을 「최신」이라 부르면 이 표 전체가 거짓말이 된다');
  assert.equal(상태판정({ 바로가기: false, 정본시각: 새때, 실체시각: null }), '모름',
    '실체 시각을 못 읽어도 모름이다 — 못 잰 것을 통과로 세지 않는다');
});

test('상태판정: 사본은 정본과 견준다 · 끊긴 링크와 바깥 링크는 갈라 적는다', () => {
  assert.equal(상태판정({ 바로가기: false, 정본시각: 새때, 실체시각: 옛때 }), '사본낡음');
  assert.equal(상태판정({ 바로가기: false, 정본시각: 옛때, 실체시각: 새때 }), '사본최신');
  assert.equal(상태판정({ 바로가기: true, 대상없음: true }), '끊김');
  assert.equal(상태판정({ 외부: true, 대상없음: true }), '외부', '바깥 링크는 끊김보다 먼저 갈린다');
});

test('스냅샷원본: 구운 PDF 만 원본 md 를 찾는다 — 아닌 것에 짝을 지어내지 않는다', () => {
  const 후보 = [path.join(ROOT, 'docs', 'SYNK_철학.md')];
  assert.equal(스냅샷원본(path.join(ROOT, 'docs', '인쇄본', 'SYNK_철학.pdf'), 후보), 후보[0]);
  assert.equal(스냅샷원본(path.join(ROOT, 'docs', '이해대장.html'), 후보), null, 'PDF 가 아니면 짝을 안 찾는다');
  assert.equal(스냅샷원본(path.join(ROOT, 'docs', '인쇄본', '없는것.pdf'), 후보), null, '후보에 없으면 null');
});

test('닫힌 손잡이 — `--갱신` 은 소스에서 사라졌다(사본을 다시 굽는 통로 0)', () => {
  const 소스 = fs.readFileSync(path.join(ROOT, 'tools', '운영자료.js'), 'utf8');
  assert.ok(!/function 갱신\s*\(/.test(코드만(소스)),
    '사람이 불러야 도는 손잡이는 안 부르면 낡는다 — 처방은 --링크화 이고, 낡음 보고는 --지금상태 다');
});

/* ── 번호로 가리키지 않는다 — 프로즈였던 규칙을 기계가 문다 ──────────────
 * 2026-08-14 실측: 08-13 재편으로 번호가 전부 밀렸는데 이미 박힌 참조는 그대로였다.
 * 메모리 18곳 중 **16곳**이 딴 문서를 가리켰다(자율주행 결정록 「09번」 → 철학정합 전층점검 ·
 * 몽골어 검수표 「26번」 → FB 인사카드 v2). 규칙은 08-13 에 세웠지만 글로만 있어 앞으로만 지켜졌다.
 * 🔑 탐지력은 픽스처가 지고, 실저장소는 **거짓양성만** 본다.
 * 🔑 아카이브(세션보드_아카이브 · 지도)는 「그때 그렇게 적혔다」는 기록이라 뺀다 — 고치면 역사를 고치는 것이다.
 * 🔑 메모리는 repo 밖이라 CI 엔 없다 — 없으면 fail 이 아니라 **skip** 으로 드러낸다(F296). */

/* 🔑 판정은 **여기 안 적는다** — `.claude/hooks/lib/번호참조.js` 가 정본이고 쓰는 순간 층
 *   (board-guard ⑧)도 거기서 읽는다. 두 벌이 되면 갈라지고, 갈라지는 방향은 언제나 「통과」다
 *   (CLAUDE.md 신뢰성 ④). 방향은 이쪽뿐이다 — 훅이 `tests/` 나 `tools/` 에 기대게 만들지 않는다. */
const { 번호참조, 걸린줄, 처방 } = require('../.claude/hooks/lib/번호참조.js');
const ROOT = path.resolve(__dirname, '..');
/* 훑지 않는 자리 — 「기록」이라 고치면 역사를 고치는 것이 된다.
 *  · 세션보드_아카이브 · 지도 = 그때 그렇게 적혔다는 보존분.
 *  · 인계문 = **파생**이다. `tools/인계문.js` 가 git log 의 커밋 제목을 그대로 인용해 굽는다 —
 *    여기서 고쳐도 다음 생성이 되돌리고, 커밋 제목은 이미 불변이다.
 *  ⚠ 남는 구멍을 적어 둔다(조용한 절단 금지): 이 자리들에 새로 박히는 번호 참조는 이 가드가 못 본다.
 *    대신 유호님 발언 인용(「23번으로」처럼 접두 없는 것)은 정규식이 애초에 안 문다 — 인용은 안 고친다. */
const 안봄 = (rel) => /(^|[\\/])(세션보드_아카이브\.md|지도\.md|인계문\.md)$/.test(rel)
  || /(^|[\\/])인계문[\\/]/.test(rel);

test('번호참조 탐지: 실제로 깨졌던 표기를 전부 문다 (픽스처)', () => {
  for (const s of ['바탕화면 09번', '운영자료 26번', '운영 25번', '바탕화면 운영자료 10번',
    '운영자료 34번', '바탕화면 운영자료 26번 바로가기', '운영자료 운영 25번']) {
    assert.ok(번호참조().test(s), `못 잡았다: ${s}`);
  }
});

test('번호참조 탐지: 이름으로 적은 것은 안 문다 (거짓양성 0)', () => {
  for (const s of ['운영 「이해 대장 (어디가 비었나)」', '바탕화면 운영 「자율주행 결정 기록」',
    '정원은 16명, 선생님은 17명입니다', '대기열 P1 줄49', '2026-08-14', '큐#103']) {
    assert.ok(!번호참조().test(s), `거짓양성: ${s}`);
  }
});

/* 🔴 CLAUDE.md 가드 4맹점 ③ — **자기 처방을 막지 않는지.** 이 칸이 없어서 실제로 물렸다.
 *   2026-08-14: `71748fd0` 이 이 적색을 대기열에 신고했는데, 무엇이 금지인지 말하려면 그 표기를
 *   적어야 해서 **신고문이 위반을 두 개 더 만들었다**(샌 자리 1곳 → 2곳). 그 줄이 스스로
 *   「새는 자리는 한 곳뿐이다」라고 적었는데 저장한 순간 거짓이 됐다.
 *   따를 수 없는 처방은 우회를 정상 통로로 만든다(F103) — 여기서 그 우회는 「검사에서 보드/를
 *   빼서 초록 만들기」였고, 그건 «지금 사는 선언»을 검사 밖으로 내보내는 짓이다.
 *   그래서 **신고 통로가 열려 있는지**를 못박는다. 정규식을 넓히면 이 칸이 먼저 빨개진다. */
test('번호참조: 위반을 «신고·인용»하는 표기는 안 문다 — 처방이 따를 수 있어야 한다 (F103)', () => {
  for (const s of ['바탕화면을 «35번» 같은 번호로 가리킨다', '그 줄의 「35번」 표기',
    '「바탕화면 …번」 꼴로 적힌 줄', '바탕화면 N번 꼴']) {
    assert.ok(!번호참조().test(s),
      `신고문이 위반이 된다 — 그러면 아무도 신고를 못 한다(F103): ${s}`);
  }
  // 처방문이 실제로 그 길을 알려 주는가 — 알려 주지 않으면 아무도 그 길을 못 찾는다.
  assert.match(처방, /신고·인용/, '처방이 «쓰는 사람»에게만 말하고 «신고하는 사람»에겐 침묵한다');
});

/* ⚠ 그 통로가 **우회로는 안 열려 있어야** 한다 — 백틱으로 감싸면 통과하는 순간, 진짜 참조를
 *   백틱에 넣어 가드 입을 막는 길이 열린다. 신고는 되고 우회는 안 되는 그 폭을 못박는다. */
test('번호참조: 백틱으로 감싸는 것은 신고 통로가 아니다 — 그대로 문다', () => {
  assert.ok(번호참조().test('`바탕화면 35번`'), '감싸기만 하면 통과라면 그건 신고가 아니라 우회다');
});

function 훑기(뿌리, 라벨) {
  const 샌것 = [];
  const 걷기 = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { 걷기(p); continue; }
      const rel = path.relative(뿌리, p);
      if (!e.name.endsWith('.md') || 안봄(rel)) continue;
      // 줄 훑기도 정본이 진다 — 여기 다시 적으면 훅과 스위트가 다른 자리를 짚는다.
      샌것.push(...걸린줄(`${라벨}/${rel.replace(/\\/g, '/')}`, fs.readFileSync(p, 'utf8')));
    }
  };
  걷기(뿌리);
  return 샌것;
}

test('실저장소 docs/ — 바탕화면을 번호로 가리키는 줄이 없다', () => {
  const 샌것 = 훑기(path.join(ROOT, 'docs'), 'docs');
  assert.deepEqual(샌것, [], 처방
    /* ⚠ 샌 자리가 **남의 보드 줄**이면 여기서 멈춰라 — 고치는 게 아니라 주인에게 넘기는 자리다.
     *   남의 보드 파일은 F250·F073 이 편집을 금지하고 `board-move` 는 원칙 ⑦ 로 이관도 거절한다.
     *   즉 그 적색은 **그 트랙이 끝나야** 풀린다. 실측 08-14: 그 상태가 저장소 전체의 `/deploy`
     *   를 막았고, 그때 사람이 손대고 싶어지는 곳이 「검사에서 보드/를 빼기」다 — 그러면 «지금
     *   사는 선언»이 통째로 검사 밖으로 나간다(아카이브를 빼는 이유와 정반대). 그 길은 막혔다.
     *   앞으로의 재발은 board-guard ⑧ 이 쓰는 순간에 막는다. */
    + '\n  ⚠ 샌 자리가 **남의 보드 줄**이면 내가 고칠 자리가 아니다 — 주인(또는 그 트랙을 승계한\n'
    + '     세션)이 끝내고 `node tools/board-move.js` 로 아카이브에 넣을 때 풀린다.\n'
    + '     🚫 검사에서 `보드/` 를 빼서 초록 만들기 — «지금 사는 선언»이 검사 밖으로 나간다.');
});

test('메모리 — 바탕화면을 번호로 가리키는 줄이 없다 (repo 밖이라 없으면 skip)', (t) => {
  const 뿌리 = path.join(os.homedir(), '.claude', 'projects',
    ROOT.replace(/[:\\/]/g, '-'), 'memory');
  if (!fs.existsSync(뿌리)) { t.skip(`메모리 폴더가 없다 — CI 다: ${뿌리}`); return; }
  assert.deepEqual(훑기(뿌리, 'memory'), [], 처방);
});

test('갈래는 3+엔진 4(유호 지시 08-15)이고, 모르는 갈래는 조용히 기본으로 안 떨어진다', () => {
  assert.deepEqual(Object.keys(갈래들), ['철학', '정본', '운영', '엔진', '코어', '룸', '몽글']);
  assert.match(갈래폴더('C:\\뿌리', '운영'), /3_SYNK LAB 운영$/);
  // 엔진 하위 셋은 중첩 경로다 — 「4_SYNK 엔진」 아래로 들어가야 한다(평평하게 서면 유호님 화면이 갈라진다).
  assert.match(갈래폴더('C:\\뿌리', '코어'), /4_SYNK 엔진[\\/]1_SYNK Core$/);
  assert.match(갈래폴더('C:\\뿌리', '몽글'), /4_SYNK 엔진[\\/]3_몽글 엔진$/);
  assert.throws(() => 갈래폴더('C:\\뿌리', '없는갈래'), /모르는 갈래/);
});

test('파일인자 — 플래그가 없어도 0번째 파일을 값 자리로 오인하지 않는다 (🔴 -1+1=0 구멍 · 실측 08-13)', () => {
  /* 실사고 2026-08-13: `--갈래` 없이 `<파일> --이름 X` 로 부르면 `indexOf('--갈래')`가 -1,
   * `-1+1=0` 이라 0번째 인자(파일)가 걸러져 파일 목록이 비었다. 루프 0회 = **조용히 exit 0**
   * — 세 파일을 넣었다고 믿었는데 폴더는 그대로였다(성공의 얼굴을 한 무동작). */
  const { 파일인자 } = require('../tools/운영자료.js');
  assert.deepEqual(파일인자(['a.png']), ['a.png']);
  assert.deepEqual(파일인자(['a.png', '--이름', '표시']), ['a.png']); // 사고 그 모양 그대로
  assert.deepEqual(파일인자(['a.png', '--갈래', '운영']), ['a.png']);
  assert.deepEqual(
    파일인자(['--갈래', '운영', 'a.png', '--이름', '표시', 'b.png']),
    ['a.png', 'b.png'],
    '플래그 값 자리는 플래그가 실제로 있을 때만 뺀다'
  );
});

test('🔴 소스에 날 제어문자가 없다 — git 이 binary 로 보면 diff 가 통째로 안 보인다', () => {
  /* 실사고 2026-08-13(같은 자리 두 번): ① 자리표에 공백 대신 NUL 이 박혀 `grep` 이
   * "Binary file matches" 를 뱉었다 → NUL 만 검사하게 고쳤더니 ② 같은 줄에 0x01 이 남아
   * `훅이식성` 회귀가 잡았다. **NUL 만 보는 검사는 그 옆 바이트를 놓친다** — 범위로 본다. */
  const 소스 = require('node:fs').readFileSync(path.join(__dirname, '..', 'tools', '운영자료.js'), 'utf8');
  // eslint-disable-next-line no-control-regex
  const 날문자 = 소스.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g);
  assert.equal(날문자, null, '제어문자가 들어가면 diff·검색·가드가 전부 눈이 먼다');
});

/* ── 바로가기 통로: ANSI(CP949) 코드페이지 층 — 유호 신고 2026-08-13 ──────────
 * 신고: `--이름 "캐릭터 시안 v5 — 살아있음 반응 시연"` 이 **stderr 없이 exit 1**.
 * 층을 하나씩만 바꿔 대조하니(F045) 인코딩(UTF-16LE base64 왕복)도 파일시스템(fs 로 같은
 * 이름 생성)도 멀쩡했고 **CreateShortcut 만** 죽었다 — 그 층이 경로를 시스템 ANSI 코드페이지
 * (이 기계 949)로 깎는다. 오류문이 스스로 자백한다: `Unable to save shortcut "…\x ? y.lnk"`.
 *
 * 실패는 **세 얼굴이고 둘은 조용하다** — 그래서 「긴 줄표가 죽는다」만 막으면 나머지 둘이 샌다:
 *   ㉠ 죽는다        — — – “ ✅ ⚠ 🔴   (→ `?` → 파일명 금지문자)
 *   ㉡ 딴 이름으로 만든다 — é → e (exit 0 · 요청한 경로엔 파일이 없다)
 *   ㉢ 빈 값을 준다   — 그 이름 lnk 의 TargetPath 가 `''` → 「대상 없음」 오보의 씨앗
 *
 * 🔑 **처방이 「특수문자를 지운다」가 아닌 이유**: 코드페이지 안의 표기는 전부 멀쩡했다
 * (― · → 「 ㉠ … ’ ① Ⅰ √ 한글 ß). 넓게 잡아 지우면 유호님이 읽는 이름을 훼손한다 —
 * 가드 맹점 ①은 「사람이 실제로 쓰는 표기로 검사한다」이지 「그 표기를 없앤다」가 아니다.
 * 통로가 그 문자를 **만날 일 자체를** 없앤다(COM 에 ASCII 임시 이름만 → fs.rename 으로 확정).
 *
 * 탐지력은 아래 **CP949 모사 셸**이 진다 — 실측한 세 얼굴을 그대로 흉내내므로 PowerShell 이
 * 없는 CI 리눅스에서도 돈다(repo 밖 환경에 기대는 검사는 CI 에서 깨진다 · F296).
 * 실기계 검사는 맨 아래 한 건뿐이고, win32 가 아니면 fail 이 아니라 **skip 으로 드러낸다**.
 */
const fs = require('node:fs');
const os = require('node:os');
const {
  임시링크이름, PS오류읽기, 바로가기만들기, 바로가기대상읽기,
} = require('../tools/운영자료.js');

/* 실측한 경계 **그대로**. 넓히지 않는다 — 넓히는 순간 이 회귀는 「이름을 훼손하라」는 요구가 된다. */
const 죽는문자 = ['—', '–', '“', '✅', '⚠', '🔴'];
const 뭉개지는문자 = { é: 'e' };
const 멀쩡한문자 = ['―', '·', '→', '「', '㉠', '…', '’', '①', 'Ⅰ', '√', '가', 'ß'];

function 밭에서(fn) {
  const 밭 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-lnk-'));
  const 대상 = path.join(밭, 'target.html');
  fs.writeFileSync(대상, '<html>정본</html>');
  try {
    fn(밭, 대상);
  } finally {
    try { fs.rmSync(밭, { recursive: true, force: true }); } catch { /* 청소 실패는 삼킨다 */ }
  }
}

/** CP949 모사 셸 — 실측한 세 얼굴을 그대로. 이게 이 회귀의 탐지력 전부다. */
function CP949모사셸() {
  const 링크경로 = (s) => {
    const m = /CreateShortcut\((".*?")\)/.exec(s);
    return m ? JSON.parse(m[1]) : null;
  };
  return (스크립트) => {
    const 요청 = 링크경로(스크립트);
    if (요청 == null) throw new Error('모사셸: CreateShortcut 인자를 못 읽었다');
    const 쓰기냐 = /\$l\.Save\(\)$/.test(스크립트);
    if ([...요청].some((c) => 죽는문자.includes(c))) {
      if (!쓰기냐) return ''; // ㉢ 읽기는 **안 죽고** 빈 문자열을 준다
      const 깎임 = [...요청].map((c) => (죽는문자.includes(c) ? '?' : c)).join('');
      throw new Error(`Unable to save shortcut "${깎임}".`); // ㉠
    }
    const 실제 = [...요청].map((c) => 뭉개지는문자[c] || c).join(''); // ㉡ 조용히 딴 이름
    if (쓰기냐) {
      const t = /TargetPath=(".*?");/.exec(스크립트);
      fs.writeFileSync(실제, `LNK>${t ? JSON.parse(t[1]) : ''}`);
      return '';
    }
    if (!fs.existsSync(실제)) return '';
    const 내용 = fs.readFileSync(실제, 'utf8');
    return 내용.startsWith('LNK>') ? 내용.slice(4) : '';
  };
}

test('임시링크이름: 무엇을 줘도 ASCII 만 남는다 — COM 이 보는 유일한 이름이다', () => {
  assert.match(임시링크이름('w-1234-1'), /^[\x20-\x7E]+\.lnk$/);
  assert.match(임시링크이름('읽기-— ✅-7'), /^[\x20-\x7E]+\.lnk$/,
    '한글·긴 줄표·이모지가 임시 이름으로 새면 우회 자체가 무효다');
  assert.match(임시링크이름(''), /^[\x20-\x7E]+\.lnk$/, '빈 꼬리도 이름이 되어야 한다');
  assert.ok(임시링크이름('x').endsWith('.lnk'),
    'WScript.Shell 은 .lnk/.url 이 아니면 CreateShortcut 자체를 거부한다(08-13 실측)');
});

test('바로가기만들기: 긴 줄표(—) 이름도 **정확히 그 이름으로** 만들어진다 — 유호 신고 08-13 그 호출', () => {
  밭에서((밭, 대상) => {
    const 최종 = path.join(밭, '01_캐릭터 시안 v5 — 살아있음 반응 시연.lnk');
    바로가기만들기(최종, 대상, { 셸: CP949모사셸() });
    assert.ok(fs.existsSync(최종), '유호님이 부른 그 이름 그대로 파일이 있어야 한다');
  });
});

test('바로가기만들기: 실측한 「죽는 문자」가 하나라도 이름에 있으면 죽던 자리 — 전부 만들어진다', () => {
  밭에서((밭, 대상) => {
    const 셸 = CP949모사셸();
    for (const c of 죽는문자) {
      const 최종 = path.join(밭, `${c} 정본.lnk`);
      바로가기만들기(최종, 대상, { 셸 });
      assert.ok(fs.existsSync(최종), `${c} 가 든 이름에서 죽었다`);
    }
  });
});

test('바로가기만들기: **조용히 딴 이름으로 가던** 문자(é→e)도 요청한 이름에 만들어진다', () => {
  // exit 0 이라 「됐다」로 보이던 자리 — 새는 방향은 언제나 「통과」다.
  밭에서((밭, 대상) => {
    바로가기만들기(path.join(밭, 'café 정본.lnk'), 대상, { 셸: CP949모사셸() });
    assert.ok(fs.existsSync(path.join(밭, 'café 정본.lnk')));
    assert.ok(!fs.existsSync(path.join(밭, 'cafe 정본.lnk')), '깎인 이름으로 새면 안 된다');
  });
});

test('바로가기만들기: 코드페이지 안의 표기(― · → 「 ㉠ 한글)는 원래도 멀쩡했고 계속 멀쩡하다', () => {
  밭에서((밭, 대상) => {
    const 셸 = CP949모사셸();
    for (const c of 멀쩡한문자) {
      const 최종 = path.join(밭, `${c}_정본.lnk`);
      바로가기만들기(최종, 대상, { 셸 });
      assert.ok(fs.existsSync(최종), `${c} 를 깎으면 유호님이 읽는 이름이 훼손된다`);
    }
  });
});

test('바로가기만들기: 성공해도 실패해도 `__mk-` 임시 파일이 안 남는다', () => {
  밭에서((밭, 대상) => {
    바로가기만들기(path.join(밭, '가 — 나.lnk'), 대상, { 셸: CP949모사셸() });
    /* ⚠셸이 **파일을 만든 뒤** 죽는 모양으로 문다 — 만들기 전에 죽는 셸로는 치울 것이 없어
     * 「안 치운다」로 바꿔도 이 회귀가 통과했다(2026-08-13 변이 시험 M4 가 잡은 구멍). */
    assert.throws(() => 바로가기만들기(path.join(밭, '다.lnk'), 대상, {
      셸: (스크립트) => {
        const m = /CreateShortcut\((".*?")\)/.exec(스크립트);
        fs.writeFileSync(JSON.parse(m[1]), 'LNK>중간까지 쓰고 죽었다');
        throw new Error('셸이 파일을 만든 뒤 죽었다');
      },
    }));
    assert.deepEqual(fs.readdirSync(밭).filter((n) => n.startsWith('__mk-')), [],
      '임시가 남으면 유호님 폴더에 정체불명 파일이 쌓인다');
  });
});

test('못 만들면 **이름과 대상을 말하고** 죽는다 — 「stderr 없이 exit 1」이던 자리', () => {
  밭에서((밭, 대상) => {
    const 최종 = path.join(밭, '01_캐릭터 시안 v5 — 살아있음 반응 시연.lnk');
    assert.throws(
      () => 바로가기만들기(최종, 대상, {
        셸: () => { throw new Error('Unable to save shortcut "…\\x ? y.lnk".'); },
      }),
      (e) => {
        assert.match(e.message, /링크:/, '어느 링크에서 죽었는지');
        assert.match(e.message, /대상:/, '무엇을 가리키려다 죽었는지');
        assert.match(e.message, /코드페이지/, '어느 층에서 죽었는지 — 다음 사람이 층을 다시 안 가르게');
        assert.ok(e.message.includes('캐릭터 시안 v5'), '이름을 말해야 유호님이 무엇을 바꿀지 안다');
        assert.ok(e.message.includes('Unable to save shortcut'), '셸이 한 말을 삼키지 않는다');
        return true;
      }
    );
  });
});

test('셸이 성공을 알려도 그 자리에 파일이 없으면 성공이라 하지 않는다 (㉡의 안전망)', () => {
  밭에서((밭, 대상) => {
    assert.throws(
      () => 바로가기만들기(path.join(밭, '가.lnk'), 대상, { 셸: () => '' }),
      /파일이 없다/
    );
  });
});

test('바로가기대상읽기: 긴 줄표 이름의 링크도 대상을 읽는다 — 빈 값을 「대상 없음」으로 번역하지 않는다', () => {
  밭에서((밭, 대상) => {
    const 셸 = CP949모사셸();
    const 최종 = path.join(밭, '01_캐릭터 시안 v5 — 살아있음 반응 시연.lnk');
    바로가기만들기(최종, 대상, { 셸 });
    assert.strictEqual(바로가기대상읽기(최종, { 셸 }), path.resolve(대상));
    assert.deepEqual(fs.readdirSync(밭).filter((n) => n.startsWith('__mk-')), [],
      '읽기용 임시 사본도 안 남는다');
  });
});

test('바로가기대상읽기: 진짜 못 읽으면 null — 빈 문자열로 눙치지 않는다', () => {
  밭에서((밭) => {
    assert.strictEqual(바로가기대상읽기(path.join(밭, '없는것.lnk'), { 셸: () => '' }), null);
  });
});

test('PS오류읽기: 실측 CLIXML 에서 원인 문장을 뽑는다 — 그 문장이 범인을 자백했다', () => {
  const 실측 =
    '#< CLIXML\n<Objs Version="1.1.0.1" xmlns="http://schemas.microsoft.com/powershell/2004/04">' +
    '<S S="Error">Unable to save shortcut "C:\\Temp\\x ? y.lnk"._x000D__x000A_</S>' +
    '<S S="Error"> + FullyQualifiedErrorId : System.IO.FileNotFoundException_x000D__x000A_</S></Objs>';
  const 말 = PS오류읽기(실측);
  assert.match(말, /Unable to save shortcut/);
  assert.match(말, /x \? y\.lnk/, '깎인 `?` 가 보여야 원인이 한눈에 잡힌다');
  assert.match(말, /FileNotFoundException/, '뒷줄도 버리지 않는다');
  assert.ok(!말.includes('_x000D_'), '이스케이프를 안 풀면 사람이 못 읽는다');
  assert.ok(!말.includes('<S S='), 'CLIXML 태그가 남으면 그냥 원문 덤프다');
});

test('PS오류읽기: stderr 가 비면 빈 문자열 — 없는 원인을 지어내지 않는다', () => {
  assert.strictEqual(PS오류읽기(''), '');
  assert.strictEqual(PS오류읽기(null), '');
});

test('🔴 COM 에 가는 경로는 통로가 쥔 이름뿐이다 — 옛 통로(부르는 쪽 이름 직행)를 금지한다', () => {
  /* 호출부마다 고치는 대신 **잘못 쓸 수 없는 통로**를 두고 옛 통로를 회귀로 막는다.
   * `링크경로`·`놓을곳`·`최종` 같은 바깥 이름이 CreateShortcut 에 직접 들어가는 순간
   * 그 자리는 다시 코드페이지에 깎인다 — 그때 실패는 또 조용하다. */
  const 소스 = require('node:fs').readFileSync(
    path.join(__dirname, '..', 'tools', '운영자료.js'), 'utf8');
  // ⚠`\w` 로 잡으면 **한글 변수명이 안 걸려** 자리 0건 → 검사가 조용히 공회전한다
  //   (2026-08-13 이 검사를 쓰다 그대로 밟았다 — 가드 맹점 ①: 사람이 실제로 쓰는 표기로 검사한다).
  const 자리 = [...소스.matchAll(/CreateShortcut\(\$\{JSON\.stringify\(([^)]+)\)\}/g)].map((m) => m[1]);
  assert.ok(자리.length >= 2, 'CreateShortcut 호출 자리를 못 찾았다 — 이 검사가 공회전한다');
  assert.deepEqual(
    [...new Set(자리)].sort(),
    ['p', '임시'],
    'COM 에는 통로가 만든 ASCII 임시 이름(만들기=임시 · 읽기=p)만 준다'
  );
});

test('안전한이름: 긴 줄표·중점을 **안 깎는다** — 고친 것은 통로지 유호님 이름이 아니다', () => {
  assert.strictEqual(
    안전한이름('캐릭터 시안 v5 — 살아있음 반응 시연'),
    '캐릭터 시안 v5 — 살아있음 반응 시연',
    '이름을 깎아 문제를 피하면 유호님이 화면에서 읽는 표기가 훼손된다'
  );
});

/* ── repo 밖 환경: 진짜 PowerShell·COM — 못 재면 skip 으로 드러낸다 ────────── */

test('실기계: 진짜 WScript.Shell 로 긴 줄표 이름 바로가기를 만들고 읽는다 (유호 신고 재현)', (t) => {
  if (process.platform !== 'win32') {
    t.skip('win32 아님(CI) — WScript.Shell 은 Windows COM 이다. 탐지력은 위 CP949 모사 셸이 진다');
    return;
  }
  밭에서((밭, 대상) => {
    const 최종 = path.join(밭, '01_캐릭터 시안 v5 — 살아있음 반응 시연.lnk');
    바로가기만들기(최종, 대상);
    assert.ok(fs.existsSync(최종), '유호 신고 그 호출 — 실기계에서도 그 이름 그대로 만들어져야 한다');
    assert.strictEqual(바로가기대상읽기(최종), path.resolve(대상), '만든 것을 다시 읽지도 못하면 목록이 오보한다');
    assert.deepEqual(fs.readdirSync(밭).filter((n) => n.startsWith('__mk-')), []);
  });
});
