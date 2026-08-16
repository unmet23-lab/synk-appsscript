/**
 * 훅발동 회귀 — 「`context-budget` 이 몇 번 울었나」를 재는 통로 (#Q98 · F500 의 짝)
 *
 * 왜 있나 — 이 축은 **세 번 재고 세 번 다 거짓양성이었다**(F500). 세 판 다 transcript 를
 *   «문자열»로 뒤졌고, 세 번째 판은 «내가 읽은 소스 코드»가 섞였을 수 있었다 — 이 훅 파일을
 *   연 세션은 패턴이 그냥 잡힌다. 첫 판을 그대로 냈으면 잘 도는 훅을 뜯어고칠 뻔했다.
 *   그래서 이 시험의 **급소는 ㉢ 「문자열 함정」**이다: 본문에 경고문이 통째로 들어 있어도
 *   한 건도 안 세어져야 한다. 그게 통과해야 나머지 숫자를 읽을 자격이 생긴다.
 *
 * 🔴 **네 번째 거짓양성이 실제로 났다**(2026-08-16 · 이 파일의 첫 판): 「도구를 안 부르는 assistant
 *   레코드」를 Stop 으로 셌다. 한 턴의 응답은 텍스트 레코드와 도구 레코드로 **쪼개져** 나오므로
 *   턴 «중간»이 전부 걸린다 — 사용자 메시지가 **2개**인 세션에서 그 방식은 **95**를 셌다.
 *   첫 판의 시험은 그 버그를 **통과시켰다**: 픽스처에 사용자 메시지가 아예 없었기 때문이다.
 *   → 아래 픽스처는 전부 **사람 턴을 실제로 놓는다**. 그게 이 파일이 배운 것이다.
 *
 * 탐지 능력은 **픽스처가 진다** — 실전사·실저장소에 안 기댄다(CI에서 깨지거나 조용히 미실행된다).
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
const { 되감기, 되감기층 } = require(path.join(ROOT, 'tools', '훅발동.js'));

/** assistant 레코드 한 줄. `도구` 가 참이면 그 레코드가 도구를 부른다(턴은 이어진다). */
function 턴(ctx, { 도구 = false, model = 'claude-opus-5', 본문 = null } = {}) {
  const content = [];
  if (본문) content.push({ type: 'text', text: 본문 });
  if (도구) content.push({ type: 'tool_use', id: 'x', name: 'Read', input: {} });
  return JSON.stringify({
    type: 'assistant',
    timestamp: '2026-08-16T00:00:00.000Z',
    message: {
      role: 'assistant',
      model,
      content,
      // 세 항목의 **합**이 컨텍스트다 — 하나만 크면 안 걸려야 한다.
      usage: { input_tokens: 100, cache_read_input_tokens: ctx - 100, cache_creation_input_tokens: 0 },
    },
  });
}

/** 🔑 사람이 보낸 턴 — 훅이 도는 경계는 여기고, 여기밖에 없다. */
function 사용자(글 = '다음') {
  return JSON.stringify({ type: 'user', message: { role: 'user', content: 글 } });
}

/** 도구 결과 — role 은 user 지만 **사람이 보낸 것이 아니다**(경계가 아니다). */
function 도구결과() {
  return JSON.stringify({
    type: 'user',
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }] },
  });
}

/** ctx 수열을 «한 턴에 하나씩» 놓은 대화 — 턴 사이마다 사람 턴이 들어간다. */
function 대화(ctxs, opts) {
  const 줄 = [사용자('시작')];
  ctxs.forEach((c, i) => {
    줄.push(턴(c, opts));
    if (i < ctxs.length - 1) 줄.push(사용자());
  });
  return 줄;
}

function 전사쓰기(줄들) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-훅발동-'));
  const f = path.join(d, 'a0000000-1111-2222-3333-444444444444.jsonl');
  fs.writeFileSync(f, `${줄들.join('\n')}\n`);
  return { dir: d, file: f };
}

test('㉠ 임계를 넘으면 운다 — 그리고 같은 단계에서 두 번 울지 않는다', async () => {
  const { file } = 전사쓰기(대화([100_000, 310_000, 320_000, 330_000]));
  const r = await 되감기(file, false);
  assert.strictEqual(r.발동들.length, 1, '300k 대에서는 한 번만 울어야 한다');
  assert.strictEqual(r.발동들[0].단계, 2);
  assert.strictEqual(r.최대, 330_000);
  assert.strictEqual(r.평가, 4, '판정 자리는 네 턴 전부여야 한다(0 이면 「안 쟀다」다)');
});

test('㉠ STEP 마다 다시 운다 — 🔴 위가 침묵 구간이던 결함 ⑤ 가 되살아나면 여기서 빨개진다', async () => {
  const { file } = 전사쓰기(대화([310_000, 410_000, 510_000, 610_000]));
  const r = await 되감기(file, false);
  assert.deepStrictEqual(r.발동들.map((x) => x.단계), [2, 3, 4, 5]);
});

test('㉠ 컨텍스트가 내려가면 단계도 따라 내려간다 — 컴팩트 뒤 다음 사이클이 다시 운다', async () => {
  // 08-04 실측: 760k 까지 갔다가 컴팩트로 174k 가 된 세션의 stage 가 4로 남아
  // 300·400·500·600k 를 다시 넘어도 전부 억제됐다. 그 자리를 못박는다.
  const { file } = 전사쓰기(대화([310_000, 410_000, 174_000, 310_000, 410_000]));
  const r = await 되감기(file, false);
  assert.deepStrictEqual(r.발동들.map((x) => x.단계), [2, 3, 2, 3], '컴팩트 뒤에 다시 울어야 한다');
});

test('㉠ 내려갈 때는 말하지 않는다 — 줄어든 건 좋은 일이다', async () => {
  const { file } = 전사쓰기(대화([610_000, 310_000, 100_000]));
  const r = await 되감기(file, false);
  assert.strictEqual(r.발동들.length, 1, '오를 때 한 번만 — 내려가는 두 턴은 조용해야 한다');
});

test('🔴 ㉠ 턴 경계는 «사람 턴»이다 — 텍스트 전용 레코드를 Stop 으로 세면 발동이 부풀려진다', async () => {
  // 실제로 난 오차다(2026-08-16). 한 턴의 응답이 [텍스트]·[도구]·[텍스트]로 쪼개져 나오는데
  // 옛 판정은 「도구 없는 레코드」를 전부 Stop 으로 셌다 → 이 판에서 3번 운다고 나온다.
  // 훅은 그 턴의 **마지막 usage** 하나만 보므로 **한 번**, 그것도 도달한 단계로 운다.
  const { file } = 전사쓰기([
    사용자('시작'),
    턴(310_000),                    // 텍스트만 — 턴 중간이다(옛 판정이 여기서 샜다)
    턴(410_000, { 도구: true }),
    도구결과(),
    턴(510_000),                    // 텍스트만 — 역시 중간
    턴(610_000),                    // 이 턴의 마지막 usage
    사용자('다음'),                  // ← 훅이 도는 자리는 «여기» 하나뿐이다
  ]);
  const r = await 되감기(file, false);
  assert.strictEqual(r.평가, 1, '판정 자리는 사람 턴 앞 하나뿐이다');
  assert.strictEqual(r.발동들.length, 1, 'Stop 은 한 번');
  assert.strictEqual(r.발동들[0].단계, 5, '그 한 번은 도달한 단계로 운다');

  const 턴마다 = await 되감기(file, true);
  assert.strictEqual(턴마다.발동들.length, 4, '--턴마다 는 상한값이라 넷을 센다');
});

test('🔴 ㉠ 도구 결과는 사람 턴이 아니다 — 안 빼면 턴 중간이 전부 경계가 된다', async () => {
  const { file } = 전사쓰기([사용자('시작'), 턴(310_000, { 도구: true }), 도구결과(), 턴(410_000)]);
  const r = await 되감기(file, false);
  assert.strictEqual(r.평가, 1, 'tool_result 를 사람 턴으로 세면 2가 된다');
  assert.deepStrictEqual(r.발동들.map((x) => x.단계), [3], '한 번, 도달한 단계로');
});

test('🔴 ㉢ 문자열 함정 — 본문에 경고문이 통째로 있어도 한 건도 안 센다 (F500 이 세 번 속은 자리)', async () => {
  const 함정 = [
    '🔴 [context-budget] 컨텍스트 850k — 한참 지났다 — 지금 끊어라.',
    '"usage": {"input_tokens": 999999, "cache_read_input_tokens": 999999}',
    'const ctx = info.tokens; if (ctx >= t.HARD) return 2;',
  ].join('\n');
  const { file } = 전사쓰기(대화([100_000, 120_000], { 본문: 함정 }));
  const r = await 되감기(file, false);
  assert.strictEqual(r.발동들.length, 0, '본문의 경고문·소스코드는 발동이 아니다');
  assert.strictEqual(r.최대, 120_000, '컨텍스트는 usage 구조에서만 온다 — 본문의 999999 가 아니다');
  assert.strictEqual(r.깨움, 0, '㉢ 도 본문에 안 속는다');
});

test('㉢ 깨움은 훅 전용 레코드에서만 온다 — 그 자리에 있으면 센다', async () => {
  const 레코드 = JSON.stringify({
    type: 'system',
    subtype: 'stop_hook_summary',
    hookInfos: [{ command: '컨텍스트 예산 확인', durationMs: 400 }],
    hookAdditionalContext: ['[context-budget] 컨텍스트가 430k 를 넘었다.'],
    hasOutput: true,
  });
  const { file } = 전사쓰기([사용자('시작'), 턴(430_000), 레코드, 사용자('다음')]);
  const r = await 되감기(file, false);
  assert.strictEqual(r.훅요약, 1, '분모 — 훅 배치 기록이 있는 자리');
  assert.strictEqual(r.깨움, 1, '그 레코드 안에 context-budget 이 있으면 깨움 1');
});

test('㉠ 창이 작은 모델은 비율 축이 먼저 걸린다 — haiku 164k 발동이 정상인 자리', async () => {
  // 절대값만 쓰면 haiku(창 200k)는 영원히 안 울린다. 실측 발동 최소값 164k 가 여기서 나온다.
  const { file } = 전사쓰기(대화([164_000], { model: 'claude-haiku-4-5-20251001' }));
  const r = await 되감기(file, false);
  assert.strictEqual(r.발동들.length, 1, 'haiku 는 150k(=200k×0.75)에서 🔴 다');
  assert.strictEqual(r.발동들[0].색, '🔴', '⚫ 는 180k(=창×0.90)부터 — 164k 는 아직 🔴 다');

  const { file: 끝 } = 전사쓰기(대화([185_000], { model: 'claude-haiku-4-5-20251001' }));
  assert.strictEqual((await 되감기(끝, false)).발동들[0].색, '⚫', '180k 를 넘으면 ⚫');

  const { file: 큰창 } = 전사쓰기(대화([164_000], { model: 'claude-opus-5' }));
  assert.strictEqual((await 되감기(큰창, false)).발동들.length, 0, '같은 164k 라도 1M 창에서는 조용해야 한다');
});

test('㉠ usage 가 없는 전사는 「안 울었다」가 아니라 「안 쟀다」로 나온다 (F207)', async () => {
  const { dir } = 전사쓰기([사용자('혼잣말')]);
  const r = await 되감기층(dir, 30, false);
  assert.strictEqual(r.rows.length, 1);
  assert.strictEqual(r.rows[0].턴, 0, '턴 0 = 빈 전사');
  assert.strictEqual(r.rows[0].평가, 0, '판정 자리 0 — 이 숫자가 있어야 통과와 미실행을 가른다');
});

test('🔑 판정은 한 곳에서만 온다 — 훅과 되감기가 같은 함수를 쓴다 (등록층 ④)', () => {
  // 베껴 적으면 한쪽만 고쳐도 조용히 갈라지고, 갈라진 계기는 「맞는 얼굴로 틀린 값」을 낸다.
  const 훅 = fs.readFileSync(path.join(ROOT, '.claude', 'hooks', 'context-budget.js'), 'utf8');
  const 도구 = fs.readFileSync(path.join(ROOT, 'tools', '훅발동.js'), 'utf8');
  for (const [이름, 원문] of [['훅', 훅], ['도구', 도구]]) {
    assert.match(원문, /발동판정/, `${이름} 이 발동판정을 안 쓴다`);
    assert.match(원문, /context-size/, `${이름} 이 공용 통로를 안 부른다`);
    assert.doesNotMatch(원문, /function\s+stageOf/, `${이름} 안에 판정 사본이 생겼다`);
    assert.doesNotMatch(원문, /const\s+HARD_ABS/, `${이름} 안에 임계 사본이 생겼다`);
  }
});
