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
 * 🔴 **둘째 층 — 위 ⚠ 가 적어 둔 대가가 실제로 청구됐다**(2026-08-17 `local_ed3b362b`).
 *   첫 판은 판정을 **경로 모양**(`.claude/worktrees/` 정규식)에 걸었고, 스스로 「밖에 놓이면
 *   조용히 수리 전으로 돌아간다」고 적어 뒀다. 그 판이 이 기계에 **이미 살아 있었다** —
 *   얼린 트리로 master 를 재는 `head-ci` 워크트리는 스크래치패드에 있다(`.claude/worktrees/` 밖).
 *   그리고 같은 질문의 답이 저장소에 **네 벌**로 갈라져 있었다(보드낡음·보드근거·이해대장·형제초록).
 *   그래서 규칙을 짐작에서 사실로 옮겼다: 워크트리의 `<root>/.git` 은 `gitdir:` 한 줄로
 *   주저장소를 가리킨다 — `worktrees.mainWorktree()` 가 그걸 이미 읽고 있었다.
 *   정본 = `.claude/hooks/lib/형제저장소.js` · 사본 금지 래치 = `tests/형제경로통로.test.js`.
 *
 * 🔑 이 파일이 지키는 것 다섯:
 *  ① 워크트리 ROOT 에서도 형제가 목록에 든다 (구멍을 막은 자리)
 *  ② `as` 뿌리는 **워크트리 그대로**다 — 그 세션이 지금 고치는 판이 거기라, 주저장소로 밀리면
 *     아직 커밋 안 된 새 파일이 「어디에도 없다」로 적색이 된다(고치려던 것보다 나쁜 방향)
 *  ③ 가지 이름의 마디가 여럿이어도 푼다 — 워크트리 이름은 `feat/foo` 처럼 갈릴 수 있다
 *  ④ 형제가 정말 없으면 여전히 `형제있음=false` — 부재를 「있다」로 지어내지 않는다
 *  ⑤ **`.claude/worktrees/` 밖의 워크트리도 푼다** — 옛 경로 규칙이 원리상 못 보던 자리(둘째 층)
 *
 * ⚠ 남은 대가(맞는 얼굴로 틀릴 자리) — `.git` 을 못 읽으면 `root` 를 그대로 쓴다(= 고치기 전 동작).
 *    「모름」을 새 동작으로 번역하지 않는 의도된 성질이지만, 그 자리에서는 아무것도 안 고쳐 준다.
 *    아래 ④ 가 그 모양을 값으로 남긴다(형제가 없으면 픽스처가 무엇이든 `false`).
 * ⚠ 픽스처만 쓴다 — 실저장소로 재면 이 기계에 형제가 실제로 있어서 ①이 옛 형태로도 초록이다.
 *    그리고 픽스처는 **`.git` 배치까지** 짓는다(fs 만 · git 바이너리 0) — 디렉터리만 있는 옛
 *    픽스처는 「워크트리처럼 생긴 폴더」였지 워크트리가 아니었고, 그래서 글자 규칙만 재고 있었다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { 저장소들 } = require('../tools/lib/보드낡음.js');

/** 픽스처 한 벌 — `<임시>/주저장소` 와 그 옆의 `<임시>/SYNK-talk`.
 *
 * 🔑 워크트리를 **git 이 짓는 모양 그대로** 짓는다(fs 만 쓴다 · git 바이너리에 안 기댄다 · F296):
 *   주저장소는 `.git/` **디렉터리**, 워크트리는 `.git` **파일** 한 줄(`gitdir: …/.git/worktrees/<n>`).
 *   `<상대마디들>` 로 자리를 정하므로 `.claude/worktrees/` **밖**도 그대로 지을 수 있다(⑤).
 */
function 픽스처(상대마디들) {
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-형제-'));
  const 주 = path.join(임시, '주저장소');
  const 마디 = Array.isArray(상대마디들) ? 상대마디들 : ['.claude', 'worktrees', ...String(상대마디들).split('/')];
  const 워크 = path.join(주, ...마디);
  const gitdir = path.join(주, '.git', 'worktrees', 마디.join('-'));
  fs.mkdirSync(path.join(주, '.git'), { recursive: true });
  fs.writeFileSync(path.join(주, '.git', 'HEAD'), 'ref: refs/heads/master\n', 'utf8');
  fs.mkdirSync(gitdir, { recursive: true });
  fs.mkdirSync(워크, { recursive: true });
  fs.writeFileSync(path.join(워크, '.git'), `gitdir: ${gitdir}\n`, 'utf8');
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

test('③ 가지 이름의 마디가 여럿이어도 푼다 — `feat/foo`', () => {
  const f = 픽스처('feat/foo');
  try {
    const 저 = 저장소들(f.워크);
    assert.strictEqual(저.형제있음, true,
      '마디가 갈리자 주저장소를 못 찾았다 — 형제를 `.claude/worktrees/…` 안에서 찾고 있다');
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

test('⑤ `.claude/worktrees/` **밖**의 워크트리도 푼다 — 옛 경로 규칙이 원리상 못 보던 자리', () => {
  /* 이 기계에 실재하는 모양이다 — 얼린 트리로 master 를 재는 `head-ci` 는 스크래치패드에 산다.
   * 옛 규칙(경로 모양 정규식)은 여기서 `형제있음=false` 를 냈고, 그 접힘의 방향은 「통과」였다.
   *
   * 🔴 **자리를 깊게 둔다**(변이 검사가 잡은 자리 · 2026-08-17). 첫 픽스처는 이 워크트리를
   *   주저장소의 «형제 자리»(`<임시>/밖에둔워크`)에 뒀는데, 그러면 옛 규칙이 아무것도 못 벗기고도
   *   `root/../SYNK-talk` 가 **우연히 맞는다** — 즉 옛 규칙을 되돌려도 이 검사가 초록이었다.
   *   픽스처가 판정을 못 가르면 그 초록은 아무 말도 안 한 것이다. */
  const f = 픽스처(['..', '밖', '깊은', '자리']);
  try {
    const 저 = 저장소들(f.워크);
    assert.strictEqual(저.형제있음, true,
      '`.claude/worktrees/` 밖의 워크트리를 못 알아본다 — 경로 «모양»으로 짐작하는 규칙이 돌아왔다');
    const talk = 저.목록.find((r) => r.이름 === 'talk');
    assert.ok(talk && 같은가(talk.뿌리, f.talk), `talk 뿌리가 어긋났다: ${talk && talk.뿌리}`);
    assert.ok(같은가(저.목록.find((r) => r.이름 === 'as').뿌리, f.워크), 'as 뿌리가 주저장소로 밀렸다(②와 같은 축)');
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
