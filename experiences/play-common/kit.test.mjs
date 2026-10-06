// SYNK LAB PLAY 키트: 게임마다 둔 사본이 원본과 바이트까지 같은지, 키트 CSS가 부르는 그림·글꼴이 키트 안에 있는지.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { KIT_SRC, KIT_GAMES, kitFiles } from './build-kit.mjs';

test('키트 CSS가 부르는 파일이 모두 키트 안에 있다', () => {
  const css = fs.readFileSync(path.join(KIT_SRC, 'lab.css'), 'utf8');
  const refs = [...css.matchAll(/url\((?!["']?data:)["']?([^)"']+)["']?\)/g)].map((m) => m[1]);
  assert.ok(refs.length > 10);
  for (const r of refs) assert.ok(fs.existsSync(path.join(KIT_SRC, r)), r);
});

for (const game of KIT_GAMES) {
  test(`${game}/kit 사본이 원본과 같다(node experiences/play-common/build-kit.mjs)`, () => {
    const dst = path.join(KIT_SRC, '..', '..', game, 'kit');
    assert.deepEqual(kitFiles(dst), kitFiles());
    for (const rel of kitFiles()) assert.ok(fs.readFileSync(path.join(dst, rel)).equals(fs.readFileSync(path.join(KIT_SRC, rel))), rel);
  });
}
