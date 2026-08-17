/* 인용 검사 회귀 — 2026-08-12 신설(F350 처방과 같은 커밋).
 *
 * 왜: 「file:line 을 인용한 실측 주장」이 세 번째로 거짓이었다(F348→F350). 프로즈로는 못 막는다.
 *
 * 무엇을 지키나 — 이 파일이 **탐지력의 정본**이다:
 *   ① 사람이 실제로 쓰는 인용 표기를 다 읽는다(가드 맹점 ①). 변이는 저장소 실측에서 왔다.
 *   ② 첫 판이 실제로 낸 **거짓 적색 전량**을 픽스처로 못박는다 — 이게 이 도구의 급소다.
 *      거짓 적색이 나오는 검사는 꺼지고, 꺼진 검사는 없는 것과 같다.
 *   ③ 실저장소에는 **거짓양성만** 검사한다(가드 맹점 ②: 버그가 아직 있길 요구하는 회귀 금지).
 *      지금 저장소엔 진짜 🔴 2건이 있는데, 그 수를 못박으면 그 문서를 고치는 순간 회귀가 빨개진다.
 *   ④ 형제 저장소가 없으면 **skip 으로 드러낸다** — fail 도 통과도 아니다(F207·CLAUDE.md 신뢰성).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  인용들, 줄펴기, 창식별자들, 식별자인가, 문서판정, 파일풀기, 색인만들기,
  면제인가, 면제, 창줄수,
} = require('../tools/인용검사.js');

/* 픽스처 저장소 — 파일 읽기를 주입해 디스크 없이 판정을 전수 검사한다. */
function 가상(파일들) {
  const 풀기 = (p) => (Object.prototype.hasOwnProperty.call(파일들, p)
    ? { 종류: '찾음', 절대: p, 저장소: 'as' }
    : { 종류: '없음' });
  const 읽기 = (p) => (Object.prototype.hasOwnProperty.call(파일들, p) ? 파일들[p] : null);
  return { 풀기, 읽기 };
}
const 판정 = (본문, 파일들) => {
  const { 풀기, 읽기 } = 가상(파일들);
  return 문서판정(본문, 풀기, 읽기);
};
const 수준들 = (ps) => ps.map((p) => p.수준);

test('① 인용 표기 변이 — 사람이 실제로 쓰는 꼴을 다 읽는다', () => {
  /* 전부 저장소 실측에서 뽑은 표기다(docs/ 272건 훑기). */
  const 변이 = [
    ['기본',          '자리는 `Code.js:2900` 이다.',                      'Code.js', [2900]],
    ['중점 다중',     '두 자리(`Code.js:210·220`)에 있다.',               'Code.js', [210, 220]],
    ['물결 범위',     '`Code.js:2474~2475` 를 본다.',                     'Code.js', [2474, 2475]],
    ['하이픈 범위',   '`엔진_폼리포트.js:674-675` 이고,',                 '엔진_폼리포트.js', [674, 675]],
    ['경로 일부',     '`review/index.ts:572` 실측.',                      'review/index.ts', [572]],
    ['깊은 경로',     '`lib/학습자상태.js:147` 에서.',                    'lib/학습자상태.js', [147]],
    ['문서 인용',     '`docs/제품방향.md:62` 가 못박았다.',               'docs/제품방향.md', [62]],
    ['백틱 없음',     '그 자리는 Code.js:789 이다.',                      'Code.js', [789]],
    ['범위+다중 섞임', '`lib/성과회수.js:36~38·62` 참고.',                'lib/성과회수.js', [36, 37, 38, 62]],
  ];
  for (const [이름, 본문, 기대경로, 기대줄] of 변이) {
    const got = 인용들(본문);
    assert.equal(got.length, 1, `${이름}: 인용을 ${got.length}건 읽었다(1건이어야 한다)`);
    assert.equal(got[0].경로, 기대경로, `${이름}: 경로가 다르다`);
    assert.deepEqual(got[0].줄들, 기대줄, `${이름}: 줄 번호가 다르다`);
  }
});

test('① -b 코드 펜스 안은 인용이 아니다 — 붙여넣은 출력·예제다', () => {
  const 본문 = [
    '앞 문장 `Code.js:10` 하나.',
    '```',
    '거긴 예제다 `Code.js:99999`',
    '```',
    '뒤 문장 `Code.js:20` 하나.',
  ].join('\n');
  const got = 인용들(본문);
  assert.deepEqual(got.map((c) => c.줄들[0]), [10, 20], '펜스 안을 셌거나 밖을 놓쳤다');
});

test('② 줄펴기 — 범위·다중·뒤집힘·터무니없는 폭', () => {
  assert.deepEqual(줄펴기('5'), [5]);
  assert.deepEqual(줄펴기('5~7'), [5, 6, 7]);
  assert.deepEqual(줄펴기('5-7'), [5, 6, 7]);
  assert.deepEqual(줄펴기('10·20'), [10, 20]);
  assert.deepEqual(줄펴기('7~5'), [5, 6, 7], '뒤집힌 범위는 사람 오타지 뜻이 아니다');
  assert.deepEqual(줄펴기('1~9999'), [1, 9999], '터무니없이 넓은 범위는 양 끝만 — 메모리를 지킨다');
});

test('③ 🔴 탐지력 — F350 의 신고 원문 그대로가 잡힌다', () => {
  /* F350 원문: 「`estimator_version`·`estimator_confidence`·`as_of`·`창일수` 는 `learning_events` 에
   *   물리 열로 이미 있다(`L0_스키마.sql:2881~2883`)」 — 실제로 `as_of`·`창일수` 는 그 파일에 0건. */
  const 스키마 = [
    'create table learning_events (',
    '  id uuid primary key,',
    '  source_kind text,',
    '  estimator_confidence numeric,',
    '  estimator_version text,',
    '  evidence_refs jsonb',
    ');',
  ].join('\n');
  const 본문 = '`estimator_version`·`estimator_confidence`·`as_of`·`창일수` 는 `learning_events` 에 물리 열로 이미 있다(`L0_스키마.sql:4~6`)';
  const ps = 판정(본문, { 'L0_스키마.sql': 스키마 });
  assert.equal(ps.length, 1);
  assert.equal(ps[0].수준, '적색', 'F350 의 그 주장을 통과시켰다 — 이 도구의 존재 이유가 무너진다');
  assert.deepEqual(ps[0].없는것.sort(), ['as_of', '창일수'].sort(), '없는 이름을 정확히 대야 한다');
});

test('③ -b 🔴 줄 번호가 파일 줄 수를 넘는다', () => {
  const ps = 판정('그 자리(`a.js:500`).', { 'a.js': 'one\ntwo\nthree' });
  assert.equal(ps[0].수준, '적색');
  assert.match(ps[0].사유, /넘는다/);
});

test('③ -c 🔴 파일 자체가 없다', () => {
  const ps = 판정('`없는파일.js:3` 을 본다.', { 'a.js': 'x' });
  assert.equal(ps[0].수준, '적색');
});

test('③ -d 🟡 이름은 있는데 줄만 낡았다 — 적색이 아니다', () => {
  /* 코드가 움직이면 «저절로» 나는 낡음이라 적색으로 내면 저장소가 통째로 빨개지고 검사가 꺼진다. */
  const 파일 = Array.from({ length: 60 }, (_, i) => `line${i + 1}`);
  파일[55] = '  function 진짜자리_() {}';
  const ps = 판정('`진짜자리_` 함수는 `a.js:3` 이다.', { 'a.js': 파일.join('\n') });
  assert.equal(ps[0].수준, '주의', '자리 어긋남은 🟡 여야 한다');
  assert.deepEqual(ps[0].자리다름, ['진짜자리_']);
});

test('③ -e 뒤 괄호는 근거 자리다 — `Code.js:2357`(`gatedIdx_`) 관례', () => {
  /* 저장소 실측 관례. 이 자리를 안 보면 근거를 괄호로 다는 문서를 통째로 못 잰다. */
  const ps = 판정('그 자리 `a.js:2`(`없는이름_`)', { 'a.js': 'x\ny\nz' });
  assert.equal(ps[0].수준, '적색', '뒤 괄호의 이름을 안 봤다');
  assert.deepEqual(ps[0].없는것, ['없는이름_']);
});

test('④ 거짓양성 전량 — 첫 판이 실제로 낸 것들이 다시 안 난다', () => {
  /* 여기 넷은 전부 **실측**이다. 전량 1판에서 🔴18 중 16이 이 네 원인이었다. */

  // ㉠ 절 경계 밖 이름 — 앞 절이 대는 이름이 뒷 절의 인용에 매달렸다(실측 `engine.submissions`)
  {
    const 본문 = '`deliver` 가 `engine.submissions` 에 스냅샷을 넣고, 그 `호흡` 칸에 `출처` 가 실재(`오늘과제.js:2`)';
    const ps = 판정(본문, { '오늘과제.js': 'a\n  const 호흡 = [{ 출처: 1 }];\nb' });
    assert.equal(ps[0].수준, '통과', `앞 절의 이름을 끌어왔다: ${JSON.stringify(ps[0].없는것 || [])}`);
  }
  // ㉡ 세션 지문·커밋 해시 = 영수증이지 식별자가 아니다(실측 `local_99032bdf`·`a482b4c`)
  {
    const 본문 = '실측 `local_99032bdf` 의 `열람보내기` 는 `말하기화면.js:2`(`a482b4c`) 에 있다';
    const ps = 판정(본문, { '말하기화면.js': 'x\nfunction 열람보내기() {}\ny' });
    assert.equal(ps[0].수준, '통과', `영수증을 식별자로 셌다: ${JSON.stringify(ps[0].없는것 || [])}`);
  }
  // ㉢ 버전 번호
  assert.equal(식별자인가('v9.220'), false);
  assert.equal(식별자인가('1.2.3'), false);
  // ㉣ 대조할 식별자가 곁에 아예 없으면 통과다 — 없는 것을 지어내 재지 않는다
  {
    const ps = 판정('그 자리는 `a.js:2` 다.', { 'a.js': 'x\ny\nz' });
    assert.equal(ps[0].수준, '통과');
  }
  // ㉤ 앞 인용에 «붙은 괄호 근거»가 뒤 인용의 창으로 흘러들지 않는다(실측 `gatedIdx_`)
  {
    const 본문 = '표: `a.js:2`(`가나다_`) 와 `b.js:2`(`라마바_`)';
    const ps = 판정(본문, { 'a.js': 'x\nconst 가나다_ = 1;\ny', 'b.js': 'x\nconst 라마바_ = 2;\ny' });
    assert.deepEqual(수준들(ps), ['통과', '통과'],
      `앞 인용의 근거를 뒤 인용에 매달았다: ${JSON.stringify(ps.map((p) => p.없는것 || []))}`);
  }
  // ㉥ `` `:952` `` 꼴(앞 파일을 이어받는 짧은 인용)도 절 경계다(실측 `need`)
  {
    const 본문 = 'preflight `있다_`(`:952`)·워치독 `없다_`(`b.js:2`)';
    const ps = 판정(본문, { 'b.js': 'x\nconst 없다_ = 1;\ny' });
    assert.equal(ps[0].수준, '통과', `짧은 인용을 경계로 안 읽어 앞 절의 이름을 끌어왔다: ${JSON.stringify(ps[0].없는것 || [])}`);
  }
});

test('④ -d 낫표 안에 «옮겨 적은» 남의 말은 지금 주장이 아니다', () => {
  /* 실측: `상태기반_과제선택_설계.md:99` 는 F350 의 거짓 주장을 「…」 로 옮겨 적고 옆 칸에서
   *   반박하는 처분표 행이다. 그걸 잡으면 **정정을 정직하게 기록한 문서가 벌받는다**(F384 형태). */
  const 본문 = '| N — 「`없는이름_` 은 `a.js:2` 에 있다」 | 그 줄엔 없다 | 🔴 거짓 |';
  const ps = 판정(본문, { 'a.js': 'x\ny\nz' });
  assert.equal(ps[0].수준, '통과', '옮겨 적은 말을 지금 주장으로 셌다 — 낡음 기록 관습이 죽는다');
  assert.match(ps[0].사유, /옮겨 적/);

  /* 낫표 «밖»의 같은 문장은 그대로 잡힌다 — 면제가 넓어지면 그게 구멍이다. */
  const ps2 = 판정('`없는이름_` 은 `a.js:2` 에 있다', { 'a.js': 'x\ny\nz' });
  assert.equal(ps2[0].수준, '적색', '낫표 면제가 넓게 샜다');

  /* 이미 닫힌 낫표 뒤의 인용은 «밖»이다. */
  const ps3 = 판정('「옛 주장」 을 고쳤다 — 지금은 `없는이름_` 이 `a.js:2` 에 있다', { 'a.js': 'x\ny\nz' });
  assert.equal(ps3[0].수준, '적색', '앞에서 닫힌 낫표를 열린 것으로 읽었다');
});

test('④ -b 식별자 판별 — 구절·경로·파일명·짧은 것은 안 센다', () => {
  for (const t of [
    'ab', '12', '두 낱말', 'lib/a.js', 'Code.js:12', '(괄호)', '"따옴표"',
    'a482b4c', 'local_99032bdf', '1961779b',            // 영수증 — 커밋 해시·세션 지문
  ]) {
    assert.equal(식별자인가(t), false, `${t} 를 식별자로 셌다`);
  }
  for (const t of ['as_of', '창일수', 'estimator_version', 'gatedIdx_', 'corrections.actor_kind', '대기조건']) {
    assert.equal(식별자인가(t), true, `${t} 를 식별자로 안 셌다`);
  }
});

test('④ -c 창 자르기 — 다른 인용이 대는 이름을 내 것으로 세지 않는다', () => {
  const 줄 = '`가나다` 는 `a.js:10` 이고 `라마바` 는 `b.js:20` 이다';
  const cs = 인용들(줄);
  assert.equal(cs.length, 2);
  const a = 창식별자들(줄, cs[0]);
  const b = 창식별자들(줄, cs[1]);
  assert.ok(a.includes('가나다'), '자기 절의 이름을 놓쳤다');
  assert.ok(!a.includes('라마바'), '다음 인용의 이름을 끌어왔다');
  assert.ok(b.includes('라마바'), '자기 절의 이름을 놓쳤다');
  assert.ok(!b.includes('가나다'), '앞 인용의 이름을 끌어왔다');
});

test('⑤ 모호 — 같은 이름 파일이 여럿이면 «판정하지 않는다»', () => {
  const 색인 = new Map([['index.ts', [
    { 저장소: 'as', 뿌리: '/r1', 상대: 'a/index.ts' },
    { 저장소: 'as', 뿌리: '/r1', 상대: 'b/index.ts' },
  ]]]);
  const 저 = { 목록: [{ 이름: 'as', 뿌리: '/없는뿌리' }], 형제있음: true };
  const r = 파일풀기('index.ts', 저, 색인);
  assert.equal(r.종류, '모호', '어느 쪽을 골라도 그건 지어낸 판정이다');
});

test('⑥ 형제 부재 = 못잼 — 「파일이 없다」가 아니다 (F207)', () => {
  const 저 = { 목록: [{ 이름: 'as', 뿌리: '/없는뿌리' }], 형제있음: false };
  const r = 파일풀기('lib/형제것.js', 저, new Map());
  assert.equal(r.종류, '못잼', '못 잰 것을 「없다」로 단정하면 거짓 적색이 된다');
  const r2 = 파일풀기('SYNK-talk/lib/x.js', 저, new Map());
  assert.equal(r2.종류, '못잼');
});

test('⑦ 면제 — 역사 문서는 자동 과녁에서 빠진다(목록 하나에서 파생)', () => {
  assert.ok(면제.length >= 5);
  for (const rel of [
    'docs/_ops/심문결과/x.md', 'docs/_ops/보드/abc.md', 'docs/_ops/장부/F350.md',
    'docs/_archive/y.md', 'docs/세션보드_아카이브.md', 'docs/버전_이력.md',
  ]) assert.equal(면제인가(rel), true, `${rel} 을 면제 안 했다 — 역사 인용은 낡은 것이 정상이다`);

  for (const rel of [
    'docs/상태기반_과제선택_설계.md', 'docs/제품방향.md', 'docs/_ops/작업대기열.md', 'CLAUDE.md',
  ]) assert.equal(면제인가(rel), false, `${rel} 을 면제했다 — 지금 따르는 문서는 재야 한다`);
});

test('⑧ 실저장소 — 거짓양성만 본다(탐지력은 위 픽스처가 진다)', (t) => {
  const ROOT = path.resolve(__dirname, '..');
  // 자리는 정본 통로에서 — 손으로 `ROOT/..` 를 적으면 워크트리에서 늘 skip 이다(`..` = `worktrees/`).
  const 형제 = require(path.join(ROOT, '.claude', 'hooks', 'lib', '형제저장소.js')).형제경로(ROOT);
  let 형제있음 = false;
  try { 형제있음 = fs.statSync(형제).isDirectory(); } catch (_) { 형제있음 = false; }
  if (!형제있음) return t.skip('형제 저장소(SYNK-talk)가 없다 — fail 이 아니라 skip 이다(F207)');

  const 저 = { 목록: [{ 이름: 'as', 뿌리: ROOT }, { 이름: 'talk', 뿌리: 형제 }], 형제있음: true };
  const 색인 = 색인만들기(저);
  assert.ok(색인.size > 100, `색인이 ${색인.size}개뿐이다 — 훑기가 죽었을 수 있다`);
  /* 색인이 저장소 복제본을 안 담는지 — 담으면 모든 파일이 여러 벌로 보여 전부 「모호」로 접힌다. */
  for (const [, 목록] of 색인) {
    for (const c of 목록) {
      assert.ok(!c.상대.replace(/\\/g, '/').includes('worktrees/'),
        `색인에 워크트리 복제본이 들었다: ${c.상대}`);
    }
  }

  /* 정본 문서 하나를 실제로 재 본다 — 결함 «수»는 못박지 않는다(고치는 순간 빨개진다).
   * 여기서 지키는 것은 「도구가 죽지 않고 분모를 낸다」뿐이다. */
  const 표본 = ['docs/제품방향.md', 'CLAUDE.md'].map((r) => path.join(ROOT, r)).filter((p) => fs.existsSync(p));
  assert.ok(표본.length, '표본 문서가 없다 — 경로가 바뀌었는지 본다');
  const 읽기 = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return null; } };
  let 인용수 = 0;
  for (const p of 표본) {
    const ps = 문서판정(fs.readFileSync(p, 'utf8'), (경로) => 파일풀기(경로, 저, 색인), 읽기);
    인용수 += ps.length;
    for (const one of ps) assert.ok(['적색', '주의', '통과', '못잼'].includes(one.수준));
  }
  assert.ok(창줄수 >= 1, '창 반경이 0 이면 모든 인용이 「자리 다름」이 된다');
  assert.ok(인용수 >= 0);
});
