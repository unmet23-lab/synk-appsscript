/**
 * 형제 저장소 해석 — 워크트리에서도 형제(SYNK-talk)를 찾는다
 *
 * 왜 있나 — 2026-08-17 실측. 워크트리는 `<주저장소>/.claude/worktrees/<가지>/` 에 살아서
 *   **형제가 자기 옆에 없다.** `저장소들()` 이 `root/../SYNK-talk` 만 보던 동안 워크트리에서는
 *   목록이 `[as]` 로 줄었고, talk 파일을 가리키는 인용이 「못잼」으로 접혔다. citation-guard 는
 *   **적색만** 알리므로 그 접힘은 조용하다 — 즉 워크트리에서 쓴 **거짓 talk 인용이 통과했다.**
 *
 *   같은 문장 네 벌을 ROOT 만 바꿔 잰 값(수리 전):
 *     메인      as맞는 🟢 / as거짓 🔴 / talk맞는 🟢 / talk거짓 🔴
 *     워크트리   as맞는 🟢 / as거짓 🔴 / talk맞는 🟢 / talk거짓 **🟢 ← 구멍**
 *   CLAUDE.md 가 코드 트랙에 워크트리를 «의무»로 만든 뒤라 이 통로는 상시 열려 있었다.
 *   새는 방향이 「통과」라 증상이 없다 — 그래서 회귀로 못박는다.
 *
 * 🔑 이 파일이 지키는 것 넷:
 *  ① 워크트리 ROOT 에서도 형제가 목록에 든다 (구멍을 막은 자리)
 *  ② `as` 뿌리는 **워크트리 그대로**다 — 그 세션이 지금 고치는 판이 거기라, 주저장소로 밀리면
 *     아직 커밋 안 된 새 파일이 「어디에도 없다」로 적색이 된다(고치려던 것보다 나쁜 방향)
 *  ③ 꼬리를 **통째로** 벗긴다 — 워크트리 이름은 `feat/foo` 처럼 마디가 여럿일 수 있다
 *  ④ 형제가 정말 없으면 여전히 `형제있음=false` — 부재를 「있다」로 지어내지 않는다
 *
 * ⚠ 대가(맞는 얼굴로 틀릴 자리) — 판정이 **경로 모양**에 기댄다. 워크트리가 `.claude/worktrees/`
 *    밖에 놓이면(손으로 `git worktree add` 한 경우) 이 규칙은 그 판을 못 알아보고 수리 전으로
 *    되돌아간다 — 조용히. 그때도 방향은 「통과」다. 지금 통로(EnterWorktree·`작업가지.js`)가 전부
 *    그 자리에 만들기 때문에 규칙을 경로로 뒀고, 통로가 늘면 이 줄이 먼저 낡는다.
 * ⚠ 픽스처만 쓴다 — 실저장소로 재면 이 기계에 형제가 실제로 있어서 ①이 옛 형태로도 초록이다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { 저장소들 } = require('../tools/lib/보드낡음.js');

/** 픽스처 한 벌 — `<임시>/주저장소` 와 그 옆의 `<임시>/SYNK-talk`. */
function 픽스처(가지이름) {
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-형제-'));
  const 주 = path.join(임시, '주저장소');
  const 워크 = path.join(주, '.claude', 'worktrees', ...String(가지이름).split('/'));
  fs.mkdirSync(워크, { recursive: true });
  fs.mkdirSync(path.join(임시, 'SYNK-talk'), { recursive: true });
  return { 임시, 주, 워크, talk: path.join(임시, 'SYNK-talk') };
}

const 같은가 = (a, b) => path.resolve(a) === path.resolve(b);

test('① 워크트리 ROOT 에서도 형제가 목록에 든다', () => {
  const f = 픽스처('가지하나');
  try {
    const 저 = 저장소들(f.워크);
    assert.strictEqual(저.형제있음, true,
      '워크트리에서 형제를 못 찾았다 — talk 인용이 「못잼」으로 접혀 거짓 인용이 조용히 통과한다');
    const talk = 저.목록.find((r) => r.이름 === 'talk');
    assert.ok(talk && 같은가(talk.뿌리, f.talk), `talk 뿌리가 어긋났다: ${talk && talk.뿌리}`);
  } finally {
    fs.rmSync(f.임시, { recursive: true, force: true });
  }
});

test('② `as` 뿌리는 워크트리 그대로다 — 주저장소로 밀리면 안 된다', () => {
  const f = 픽스처('가지하나');
  try {
    const 저 = 저장소들(f.워크);
    const as = 저.목록.find((r) => r.이름 === 'as');
    assert.ok(같은가(as.뿌리, f.워크),
      `as 뿌리가 주저장소로 밀렸다(${as.뿌리}) — 워크트리의 새 파일이 「어디에도 없다」로 적색이 된다`);
  } finally {
    fs.rmSync(f.임시, { recursive: true, force: true });
  }
});

test('③ 워크트리 이름의 마디가 여럿이어도 꼬리를 통째로 벗긴다', () => {
  const f = 픽스처('feat/foo');
  try {
    const 저 = 저장소들(f.워크);
    assert.strictEqual(저.형제있음, true,
      '마디 하나만 벗겨 형제를 `.claude/SYNK-talk` 에서 찾고 있다');
    const talk = 저.목록.find((r) => r.이름 === 'talk');
    assert.ok(talk && 같은가(talk.뿌리, f.talk), `talk 뿌리가 어긋났다: ${talk && talk.뿌리}`);
  } finally {
    fs.rmSync(f.임시, { recursive: true, force: true });
  }
});

test('④ 형제가 정말 없으면 `형제있음=false` — 부재를 지어내지 않는다', () => {
  const f = 픽스처('가지하나');
  try {
    fs.rmSync(f.talk, { recursive: true, force: true });
    for (const [이름, root] of [['주저장소', f.주], ['워크트리', f.워크]]) {
      const 저 = 저장소들(root);
      assert.strictEqual(저.형제있음, false, `${이름}: 없는 형제를 있다고 했다`);
      assert.deepStrictEqual(저.목록.map((r) => r.이름), ['as'], `${이름}: 목록이 어긋났다`);
    }
  } finally {
    fs.rmSync(f.임시, { recursive: true, force: true });
  }
});

test('④-b 주저장소 ROOT 는 고치기 전과 같다 — 회귀가 옆칸을 안 밀었다', () => {
  const f = 픽스처('가지하나');
  try {
    const 저 = 저장소들(f.주);
    assert.strictEqual(저.형제있음, true);
    assert.ok(같은가(저.목록.find((r) => r.이름 === 'as').뿌리, f.주));
    assert.ok(같은가(저.목록.find((r) => r.이름 === 'talk').뿌리, f.talk));
  } finally {
    fs.rmSync(f.임시, { recursive: true, force: true });
  }
});
