/* 보드 줄의 «생사 필터»가 실제로 도는가 — `주인없는줄들` 의 한 축만 따로 잰다.
 *
 * 왜 파일이 갈렸나 (2026-08-18 · F630 곁가지):
 *   이 축은 **가짜 심장박동**을 상태 폴더에 써야 잴 수 있고, 그러려면 `tests/lib/상태격리.js` 의
 *   `격리된store(__filename)` 를 **`handoff-store` 가 require 되기 전에** 불러야 한다. 그런데
 *   `tests/보드주인.test.js` 에는 **실저장소**를 재는 검사가 함께 있다 — 그 파일 전체를 격리하면
 *   그쪽이 보는 상태 폴더가 빈 임시 폴더가 되어, 산 세션인 내 줄이 「주인 없음」으로 잡힌다.
 *   즉 한 파일 안에서 두 요구가 서로를 깨뜨린다. 그래서 축을 파일로 가른다.
 *
 * 무엇을 못박나 — **새는 방향은 「주인 있음」이다**(`보드주인.test.js` 머리 ①).
 *   그쪽으로 틀리면 다음 세션이 죽은 주인의 낡은 🎫 를 집는다. 반대로 틀리면 사람이 실물을
 *   한 번 더 여는 비용뿐이다.
 *
 * 🔴 왜 생겼나 (변이 실측 2026-08-18): 「생사를 안 재고 **전부 산 것으로**」 망가뜨렸는데
 *   그 파일 7건이 전부 초록이었다. 기존 픽스처의 지문은 상태 폴더에 **아예 없는** 값이라,
 *   생사 판정을 통째로 지워도 여전히 「주인 없음」으로 잡혔기 때문이다 — 그 검사들은
 *   «필터가 있다»를 원리상 못 잰다. 새는 방향이 「통과」인 자리였다.
 */
'use strict';

/* 🔴 순서가 이 파일의 급소다 — `격리된store` 가 env 를 세운 **뒤**에만 `보드.js`(→ 작업본소유자
 *   → handoff-store)를 require 한다. 뒤집으면 STATE_DIR 이 공유 폴더로 굳고, 그때 이 픽스처는
 *   남의 sweep 에 지워지거나 남의 판정에 섞인다(상태격리 머리말의 ①②). */
const { 격리된store } = require('./lib/상태격리');
const store = 격리된store(__filename);

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 보드 = require(path.join(__dirname, '..', 'tools', 'lib', '보드.js'));

const 머리 = '# 보드\n\n| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |\n|---|---|---|---|\n';
const 보통줄 = '| 2026-08-12 | **설계 v3** | docs/설계.md | ▶작업중 |';

/** 박동 나이를 **파일 mtime** 으로 준다 — `작업본소유자.세션들()` 이 재는 값이 그것이다. */
function 박동쓰기(sid, 뿌리, 분전) {
  const dir = store.stateDir();
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `track-${store.projectKey(뿌리)}-${sid}.json`);
  fs.writeFileSync(p, '{}', 'utf8');
  if (분전 > 0) {
    const t = new Date(Date.now() - 분전 * 60 * 1000);
    fs.utimesSync(p, t, t);
  }
  return p;
}

test('🔴 산 세션의 줄은 «빼고», 죽은 세션의 줄만 잡는다 (생사 필터가 실제로 도는가)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'board-owner-live-'));
  try {
    const 폴더 = path.join(root, 'docs', '_ops', '보드');
    fs.mkdirSync(폴더, { recursive: true });

    /* 지문은 실재하는 어느 세션과도 안 겹치는 값이라, `살았나` 의 자기면제(내 id 와 같으면 무조건 산다)가
     * 이 픽스처에 낄 자리가 없다 — 재려는 축이 그 예외에 가려지지 않는다. */
    박동쓰기('local_aaaaaaaa-1111-2222-3333-444444444444', root, 0);     // 방금 뛰었다 = 산다
    박동쓰기('local_bbbbbbbb-5555-6666-7777-888888888888', root, 200);   // 200분 = 어떤 문턱에도 죽는다
    fs.writeFileSync(path.join(폴더, 'aaaaaaaa.md'), 머리 + 보통줄 + '\n', 'utf8');
    fs.writeFileSync(path.join(폴더, 'bbbbbbbb.md'), 머리 + 보통줄 + '\n', 'utf8');

    const r = 보드.주인없는줄들(root);
    assert.notStrictEqual(r, null, '생사를 못 쟀다 — 0건과 가른다(F207)');
    assert.deepStrictEqual(r.map((x) => x.지문).sort(), ['bbbbbbbb'],
      '죽은 세션의 줄만 잡아야 한다 — 산 줄까지 잡으면 거짓양성이고, 죽은 줄을 놓치면 '
      + '**새는 방향(「주인 있음」)**이라 다음 세션이 낡은 🎫 를 집는다');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('🔑 격리가 실제로 걸렸다 — 공유 폴더가 아니다(이 검사가 없으면 위가 남의 폴더를 쓴다)', () => {
  const 공유 = path.join(os.tmpdir(), 'synk-context-budget');
  assert.notStrictEqual(path.resolve(store.stateDir()), path.resolve(공유),
    `상태 폴더가 공유 폴더다(${store.stateDir()}) — 격리된store 가 require 순서에 밀렸다`);
});
