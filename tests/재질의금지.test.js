/**
 * 재질의 금지 가드 — 유호님이 **이미 답한** 항목이 대기 표식을 달고 되살아나는 것을 막는다.
 *
 * 왜 (F126, 2026-08-06): 「동의문」은 유호님이 이미 준비했다고 여러 번 말했는데
 * 대기 표기가 17곳에 흩어져 각자 배달됐다. 유호님 원문: *"왜 계속 뜨는거야 몇번말하냐"*.
 * F114(이미 답 나온 대기를 안 읽고 재제안)와 같은 축의 **2번째**다.
 *
 * 🔑 grep 전수 청소로는 안 닫힌다 — **그 시점만** 청소하고 새로 쓰는 문서는 못 막는다.
 *    실측: 17곳을 닫은 같은 세션 안에서 보드에 「CHK-5 동의」가 다시 생겼다.
 *    그래서 「청소」가 아니라 「유입 차단」이 처방이다.
 *
 * 설계 (F125 가드와 같은 형태)
 *  ① **해소 표기가 같은 줄에 있으면 통과**(F103 자기처방). 「동의문 = ✅유호님 준비
 *     완료·🚫재질의」라고 적는 것은 위반이 아니라 정확히 우리가 원하는 문장이다.
 *  ② 탐지력은 **픽스처**가 지고, repo 밖(메모리 폴더)은 없으면 **skip 으로 드러낸다**.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');

/* 판정은 tools/lib/재질의금지.js **한 벌**에서 온다 (F389) — rot-check(메모리 실물 warn)와
 * 이 스위트(픽스처 + repo 실물)가 같은 것을 요구한다. 여기 사본을 되살리면 갈라진 쪽이
 * 조용히 통과한다. 아래 픽스처 전부가 그 lib 의 탐지력을 못박는 회귀다. */
const { 재질의금지, 위반인가, 파일검사, 폴더검사 } = require(path.join(REPO, 'tools', 'lib', '재질의금지.js'));

// ── 1. 목록이 살아 있는가 ────────────────────────────────────
test('재질의 금지 목록이 비어 있지 않고 사유가 붙어 있다', () => {
  assert.ok(재질의금지.length > 0, '목록이 비면 이 가드 전체가 무력해진다');
  for (const 항목 of 재질의금지) {
    assert.ok(항목.확정 && 항목.확정.length > 10, `${항목.주제}: 확정 사유가 없다 — 사유 없는 금지는 지울 수 없다`);
  }
});

// ── 2. 탐지력 — 픽스처 ───────────────────────────────────────
test('픽스처: 대기 표식을 단 금지 주제를 잡는다', () => {
  const 항목 = 재질의금지[0];
  assert.ok(위반인가('⏳ 남은 것은 동의 문구의 몽골어 병기다', 항목), '⏳ 형태를 못 잡았다');
  assert.ok(위반인가('⛔선행 3건: 동의 문구 몽골어 병기 · Supabase', 항목), '⛔ 형태를 못 잡았다');
  assert.ok(위반인가('④ [038] 동의 조항(최우선 · [[막힘>결정-동의문구-몽골어병기]])', 항목), '막힘 엣지를 못 잡았다');
  assert.ok(위반인가('**다음**=①⏳배포 ②CHK-5 동의 문구 ③Codex 발주', 항목), '보드 표기를 못 잡았다');
  // ⚠ 한계를 명시한다: 대기 표식이 **아예 없는** 줄은 못 잡는다.
  // 「②CHK-5 동의」처럼 표식 없이 대기를 표현하면 통과한다 — 넓히면 평서문까지 잡혀
  // 거짓양성이 늘고, 거짓양성 가드는 사람이 꺼버린다(F049).
  assert.ok(!위반인가('②CHK-5 동의 문구 ③Codex 발주', 항목), '표식 없는 줄까지 잡으면 거짓양성이 된다');
});

test('픽스처: 해소를 적은 줄은 통과시킨다 (F103 자기처방)', () => {
  const 항목 = 재질의금지[0];
  const 정당 = [
    '✅ 동의 문구 = 유호님이 직접 준비 완료(2026-08-06)',
    '⏳유호: 개정안 7 승인 · ~~동의 6항목~~ ✅완료 · 3신 설계안',
    '⛔선행 2건: Supabase · EXPO_TOKEN (동의 문구는 🚫재질의)',
    '②CHK-5(동의=유호완료🚫재질의F126) ③Codex 발주',
  ];
  for (const 줄 of 정당) {
    assert.ok(!위반인가(줄, 항목), `해소 표기가 있는데 위반으로 잡았다: ${줄}`);
  }
});

test('픽스처: 대기 표식이 없으면 잡지 않는다 (산문 언급은 자유)', () => {
  const 항목 = 재질의금지[0];
  assert.ok(!위반인가('동의 문구는 v18.9 이고 학생이 읽는 문장이 정본이다', 항목), '평서문을 잡았다');
  assert.ok(!위반인가('⏳유호=Navy2 하향 렌더 답', 항목), '무관한 대기를 잡았다');
});

// ── 3. 실물 검사 — repo 안 ───────────────────────────────────
test('세션보드에 금지 주제가 대기로 되살아나지 않았다', () => {
  const 보드 = path.join(REPO, 'docs', '세션보드.md');
  assert.deepStrictEqual(
    파일검사(보드, 'docs/세션보드.md'),
    [],
    '유호님이 이미 답한 항목이 보드에 대기로 다시 올라왔다(F126 재발)'
  );
});

test('docs 정본 문서에 금지 주제가 대기로 되살아나지 않았다', (t) => {
  const docs = path.join(REPO, 'docs');
  if (!fs.existsSync(docs)) return t.skip('docs 없음 — 실행되지 않았다');

  // 이력·기록물은 제외 — 과거 상태를 그대로 보존하는 것이 목적인 파일들이다
  const 제외 = /^(_archive|_ops|세션보드_아카이브|버전_이력|지침_이력)/;
  const 위반 = [];
  for (const f of fs.readdirSync(docs)) {
    if (제외.test(f) || !f.endsWith('.md')) continue;
    위반.push(...파일검사(path.join(docs, f), `docs/${f}`));
  }
  assert.deepStrictEqual(위반, [], `유호님이 이미 답한 항목이 대기로 다시 등장했다(F126 재발):\n  ${위반.join('\n  ')}`);
});

// ── 4. 실물 검사 — 메모리 폴더(repo 밖 · 없으면 skip) ────────
test('메모리 토픽·인덱스에 금지 주제가 대기로 되살아나지 않았다', (t) => {
  const 메모리 = path.join(
    process.env.USERPROFILE || process.env.HOME || '',
    '.claude', 'projects', 'C--Users-q1212-Documents-SYNK-appsscript', 'memory'
  );
  if (!fs.existsSync(메모리)) {
    t.skip(`메모리 폴더 없음(${메모리}) — repo 밖이라 CI 에는 없다. 탐지력은 위 픽스처가 진다`);
    return;
  }
  // rot-check 재질의 절이 쓰는 것과 같은 통로(폴더검사)로 훑는다 — 두 소비자가 같은 눈으로 본다.
  const 위반 = 폴더검사(메모리, 'memory');
  assert.deepStrictEqual(위반, [], `메모리에 대기가 되살아났다 — 결정 큐가 이걸 읽어 유호님께 배달한다:\n  ${위반.join('\n  ')}`);
});

// ── 6. 폴더검사 탐지력 + 발동 자리 배선 (F389) ───────────────────
test('픽스처: 폴더검사 — md 만 읽고, 위반을 접두 달아 짚는다', () => {
  const os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'requery-'));
  try {
    fs.writeFileSync(path.join(dir, '걸림.md'), '⏳ 남은 것은 동의 문구 몽골어\n', 'utf8');
    fs.writeFileSync(path.join(dir, '깨끗.md'), '✅ 동의 문구 = 준비 완료\n', 'utf8');
    fs.writeFileSync(path.join(dir, '무시.txt'), '⏳ 동의 문구\n', 'utf8'); // md 아님 — 안 읽는다
    const 위반 = 폴더검사(dir, 'memory');
    assert.deepStrictEqual(위반, ['memory/걸림.md:1 [동의문]'],
      'md 하나의 위반 하나를 접두와 함께 짚어야 rot-check 경보가 읽힌다');
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 윈도우 잠금 */ }
  }
});

test('발동 자리: rot-check 가 이 한 벌로 메모리를 훑는다 (F389 — 게이트에서 뗀 자리를 잇는 배선)', () => {
  /* F389 처방이 배포 게이트(clasp-guard)를 CI 모사 눈금으로 옮기며 이 검사의 메모리 실물은
   * 게이트에서 skip 이 됐다 — 그 발동 자리를 rot-check 가 잇지 않으면 「유입 차단」(F126)이
   * 기계 없이 프로즈만 남는다. 등록층이 새는 방향은 언제나 「통과」라 소스로 못박는다. */
  const src = fs.readFileSync(path.join(REPO, 'tools', 'rot-check.js'), 'utf8');
  assert.ok(/function 재질의Section/.test(src), 'rot-check 에 재질의 절이 없다 — 메모리 위생의 발동 자리가 사라졌다');
  assert.ok(/attempt\('재질의금지', 재질의Section\)/.test(src), '절이 있어도 collect 에 등록되지 않으면 안 돈다(스스로 발화하지 않는 장치는 안 도는 장치다)');
  assert.ok(/lib\/재질의금지(\.js)?/.test(src), 'rot-check 가 lib 한 벌이 아니라 사본을 들고 있다 — 갈라지는 방향은 통과다');
  assert.ok(/폴더검사\(/.test(src), 'rot-check 가 폴더검사 통로를 안 쓴다 — 스위트와 다른 눈으로 보게 된다');
});

/* ── 5. 실물 검사 — 형제 저장소 SYNK-talk (repo 밖 · 없으면 skip) ─────────────
 * 🔴 2026-08-06 실측: F126 을 「전수 종결」로 닫은 뒤에도 **SYNK-talk 에 3건이 그대로 살아
 *    있었다** — 이 가드가 appsscript 만 훑었기 때문이다. 로직은 멀쩡했고 **등록층이 좁았다**
 *    (CLAUDE.md 「가드는 로직보다 등록층에서 샌다 — 새는 방향은 언제나 통과」의 3번 형태).
 *    그중 하나는 단순 잔여가 아니라 **반대 지시**였다: 발주서가 「문구 초안 = 클로드 몫」이라
 *    적고 있었다(유호님 확정과 정반대 · 다음 세션이 그대로 따랐을 자리).
 * 🔑 목록(재질의금지)을 복사하지 않고 **같은 배열을 그대로 쓴다** — 두 저장소에 판정을 각자
 *    적으면 갈라지고, 갈라지면 어느 쪽이 진실인지 알 방법이 없다.
 * ⚠ 두 저장소는 각자 클론되므로 CI 에는 형제가 없다 → **skip 으로 드러낸다**(통과와 미실행이
 *    같은 모양이면 안 된다). 탐지력은 위 픽스처가 진다. */
test('형제 저장소(SYNK-talk) docs 에 금지 주제가 대기로 되살아나지 않았다', (t) => {
  // 자리는 정본 통로에서 — 손으로 `REPO/..` 를 적으면 워크트리에서 늘 skip 이다(`..` = `worktrees/`).
  const talk = path.join(require(path.join(REPO, '.claude', 'hooks', 'lib', '형제저장소.js')).형제경로(REPO), 'docs');
  if (!fs.existsSync(talk)) {
    t.skip(`SYNK-talk 없음(${talk}) — 각자 클론이라 CI 에는 없다. 탐지력은 픽스처가 진다`);
    return;
  }
  const 제외 = /^(_archive|_ops)/;
  const 위반 = [];
  let 스캔 = 0;
  for (const f of fs.readdirSync(talk)) {
    if (제외.test(f) || !f.endsWith('.md')) continue;
    스캔 += 1;
    위반.push(...파일검사(path.join(talk, f), `SYNK-talk/docs/${f}`));
  }
  // 🔴 「위반 0」과 「한 파일도 안 읽었다」는 같은 모양이다 — 폴더가 비거나 제외 규칙이
  //    넓어지면 이 검사는 영원히 초록이 된다. 대상 소실은 통과가 아니다.
  assert.ok(스캔 >= 5, `SYNK-talk/docs 에서 ${스캔}개만 읽었다 — 대상이 사라졌거나 제외 규칙이 너무 넓다`);
  // 🔑 2026-08-07: 이 적색을 **두 세션이 각자 처음부터 조사했다**(보드 29번 줄이 이미 「남의 것」으로
  //    적어둔 뒤에 또 한 번). 형제 파일은 남의 트랙이 선언한 것일 수 있어 고치는 쪽이 아니라
  //    **주인을 가르는 쪽**이 먼저다 → 그 길을 실패문에 박는다(같은 조사 3번째를 막는다).
  assert.deepStrictEqual(위반, [],
    `형제 저장소에 유호님이 이미 답한 항목이 대기로 살아 있다(F126 등록층 누수):\n  ${위반.join('\n  ')}\n` +
    `  ↳ 고치기 전에 주인부터 가른다(F073) — 보드에서 그 파일명, 그리고 git -C ../SYNK-talk log -1 -- <파일>.\n` +
    `     남의 선언이면 편집하지 않는다. 이 검사는 CI 에 형제가 없어 skip 이므로 막는 것은 로컬뿐이다.\n` +
    `  ↳ 해소는 그 줄에 ✅ 나 🚫재질의 를 붙이는 것이다 — 산문 「재질의 금지」만으론 안 통과한다.`);
});
