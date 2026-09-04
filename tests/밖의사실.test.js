'use strict';
/* 밖의 사실 장부 회귀 — 2026-09-05 (유호 지시 「밖의사실 조사원도 정리하자」)
 *
 * 무엇을 지키나: **「둘에게 물었다」가 정말 둘인가.**
 *   정본(docs/AI_스택_가이드.md §1-5 · 결정 08-31 두 건)은 조사원을 «남남 둘»로 못 박는다.
 *   그런데 09-05 실측에서 장부에 남은 판정 1건은 조사원이 **한 집안뿐**이었다 — 종이에는
 *   「둘」이라 적혀 있는데 실제로는 한 벌로 돌던 자리다. 그래서 세는 자를 세웠고, 이 시험이 그 자를 문다.
 *
 * 🔑 실제 장부를 안 건드린다 — 도구가 이미 읽는 `SYNK_OUTSIDE_LEDGER` 로 임시 장부를 물린다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const 장부 = require('../tools/밖의사실.js');

/* 줄들을 임시 장부에 적고 요약을 낸다. 환경변수를 되돌려 다른 시험에 안 샌다. */
function 요약으로(줄들) {
  const 옛값 = process.env.SYNK_OUTSIDE_LEDGER;
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-outside-'));
  const p = path.join(방, '밖의사실.jsonl');
  fs.writeFileSync(p, 줄들.map((x) => JSON.stringify(x)).join('\n') + '\n', 'utf8');
  process.env.SYNK_OUTSIDE_LEDGER = p;
  try { return 장부.요약(); }
  finally {
    if (옛값 === undefined) delete process.env.SYNK_OUTSIDE_LEDGER;
    else process.env.SYNK_OUTSIDE_LEDGER = 옛값;
    fs.rmSync(방, { recursive: true, force: true });
  }
}

const 세움 = { 종류: '세움', 시각: '2026-09-05T00:00:00Z', 키: 'aaa', 명제: '시험용 명제', 걸린것: '없다', 내답: '그렇다' };
const 반박 = (조사원) => ({ 종류: '반박', 시각: '2026-09-05T00:10:00Z', 키: 'aaa', 조사원, 결과: '반박 요약' });

test('🔴 같은 집안 둘은 «남남»이 아니다 — 사각이 겹쳐서 한 벌과 다르지 않다', () => {
  const s = 요약으로([세움, 반박('codex(live)'), 반박('ChatGPT Deep Research')]);
  const b = s.목록.find((x) => x.키 === 'aaa');
  assert.strictEqual(b.반박.length, 2, '반박 두 줄이 다 읽혀야 이 시험이 뜻을 가진다');
  assert.deepStrictEqual(b.집안들, ['openai']);
  assert.strictEqual(b.남남인가, false, '조사원 둘이 같은 집안인데 남남으로 셌다');
});

test('✅ 집안이 다른 둘이면 남남이다 — 정본(§1-5)이 요구하는 모양', () => {
  const s = 요약으로([세움, 반박('제미나이 Deep Research'), 반박('ChatGPT Deep Research')]);
  const b = s.목록.find((x) => x.키 === 'aaa');
  assert.strictEqual(b.남남인가, true);
  assert.strictEqual(b.집안들.length, 2);
});

test('🔴 집안을 모르는 조사원 둘은 남남이 아니다 — 모르는 것을 「다르다」로 세면 한 벌이 둘로 부푼다', () => {
  const s = 요약으로([세움, 반박('어떤조사원'), 반박('다른조사원')]);
  const b = s.목록.find((x) => x.키 === 'aaa');
  assert.strictEqual(b.남남인가, false);
  assert.deepStrictEqual(b.집안모름, ['어떤조사원', '다른조사원'], '모르는 조사원이 이름으로 드러나야 고칠 수 있다');
});

test('반박이 0건이면 남남도 0이다 — 「안 물어봤다」와 「물었는데 한 집안」이 같은 얼굴이면 안 된다', () => {
  const s = 요약으로([세움]);
  const b = s.목록.find((x) => x.키 === 'aaa');
  assert.strictEqual(b.상태, '열림');
  assert.deepStrictEqual(b.집안들, []);
  assert.strictEqual(b.남남인가, false);
});
