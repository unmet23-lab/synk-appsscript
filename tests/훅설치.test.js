'use strict';
/**
 * install-githooks 의 F391 축 — **설치본에만 있는 줄을 조용히 덮지 않는다.**
 *
 * 🔴 왜 있나 (2026-08-12 local_91cd3a7c 실측): 세션이 커밋 게이트 조각을 `.git/hooks`(설치본)에만
 *   넣고 원본(tools/githooks/)을 안 찾았다. 그대로 두면 다음 `install-githooks` 실행이 그 줄을
 *   **조용히** 덮는다 — `.git/hooks` 는 git 밖이라 덮인 내용은 복구 경로가 0이고, 증상은
 *   「가드가 없다」가 아니라 「있었는데 사라졌다」라 어디에도 안 남는다.
 *
 * 픽스처가 탐지력을 못박고(임시 저장소), 실저장소는 건드리지 않는다 — 이음매는
 * `SYNK_GITHOOKS_ROOT`(도구 머리말) 하나다.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'tools', 'install-githooks.js');

function 픽스처() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '훅설치-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  fs.mkdirSync(path.join(dir, 'tools', 'githooks'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'tools', 'githooks', 'testhook'), '#!/bin/sh\necho 원본1\n');
  return dir;
}

function 실행(dir, ...args) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...args], {
      encoding: 'utf8', cwd: dir, env: { ...process.env, SYNK_GITHOOKS_ROOT: dir },
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

const 설치본 = (dir) => path.join(dir, '.git', 'hooks', 'testhook');

test('F391 — 설치본에만 있는 줄이 있으면 덮지 않고 거부한다(그 줄과 처방을 말한다)', () => {
  const dir = 픽스처();
  assert.equal(실행(dir).code, 0, '최초 설치가 실패했다 — 픽스처 배선이 깨졌다');
  const 게이트줄 = 'node tools/새게이트.js || exit 1';
  fs.appendFileSync(설치본(dir), `${게이트줄}\n`);
  const r = 실행(dir);
  assert.equal(r.code, 1, '설치본 단독 줄을 덮으면서 0으로 끝났다 — 조용한 삼킴이 F391 그 자체다');
  assert.match(r.out, /설치본에만 있는 줄/, '무엇이 걸렸는지 축을 안 말한다');
  assert.ok(r.out.includes('새게이트'), '어느 줄인지 안 보여준다 — 사람이 판정할 재료가 없다');
  assert.match(r.out, /원본\(tools\/githooks\/\)에 먼저/, '따를 처방이 없다 — 처방 없는 거부는 우회를 만든다(F103)');
  assert.ok(fs.readFileSync(설치본(dir), 'utf8').includes(게이트줄), '거부한다면서 이미 덮었다 — 말과 행동이 갈렸다');
});

test('F391 — --check 도 단독 줄을 드러낸다(보고 모드에서 안 보이면 write 에서야 처음 만난다)', () => {
  const dir = 픽스처();
  실행(dir);
  fs.appendFileSync(설치본(dir), 'node tools/새게이트.js || exit 1\n');
  const r = 실행(dir, '--check');
  assert.equal(r.code, 1, '드리프트인데 --check 가 0으로 끝났다');
  assert.match(r.out, /설치본에만 있는 줄/, '--check 가 단독 줄을 안 보여준다');
});

test('F391 음성 — 원본만 앞선 갱신(설치본 단독 줄 0)은 그대로 덮는다', () => {
  /* 새는 방향 주의: 원본이 줄을 **빼는** 개정도, 원본이 줄을 **더하는** 개정도 여기다.
   * 이 갈래가 막히면 원본 개정이 영영 못 나가고, 거짓양성이 쌓이면 이 장치는 곧 꺼진다. */
  const dir = 픽스처();
  실행(dir);
  fs.writeFileSync(path.join(dir, 'tools', 'githooks', 'testhook'), '#!/bin/sh\necho 원본1\necho 원본2\n');
  const r = 실행(dir);
  assert.equal(r.code, 0, `원본 갱신이 막혔다 — 거짓양성:\n${r.out}`);
  assert.ok(fs.readFileSync(설치본(dir), 'utf8').includes('원본2'), '통과했다면서 갱신이 안 실렸다');
});

test('F391 — 처방 되먹임: 단독 줄을 원본에 옮기면 같은 실행이 통과한다 (F103)', () => {
  const dir = 픽스처();
  실행(dir);
  const 게이트줄 = 'node tools/새게이트.js || exit 1';
  fs.appendFileSync(설치본(dir), `${게이트줄}\n`);
  assert.equal(실행(dir).code, 1, '전제가 깨졌다 — 거부부터 서야 되먹임을 잰다');
  fs.appendFileSync(path.join(dir, 'tools', 'githooks', 'testhook'), `${게이트줄}\n`);
  const r = 실행(dir);
  assert.equal(r.code, 0, `처방대로 원본에 옮겼는데도 막힌다 — 따를 수 없는 처방(F103):\n${r.out}`);
});
