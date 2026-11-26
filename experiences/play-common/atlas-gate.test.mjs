// 새 길 문 확인(5-3 게임): 앱 안의 atlasGate가 원본(atlas-gate.mjs)과 글자까지 같고 키트의 nextDoor || devFlag와 같은 답을 내며,
// 앱이 키트를 정적으로 부르지 않는다 — 키트를 못 받아도(404 · 응답 없음 · 깨진 글) 꺼진 판 게임이 열린다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atlasGate } from './atlas-gate.mjs';
import { ATLAS_NEXT_ALSO, KIT_GAMES } from './build-kit.mjs';
import { devFlag, nextDoor } from './kit/atlas-next.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
// 게임 문을 받는 게임의 앱 파일(주문 러시는 첫걸음 화면도 따로 연다).
const GATE_APPS = ['blank-slice/app.mjs', 'entry-check/app.mjs', 'korean-racing/app.js', 'korean-rhythm/app.mjs', 'korean-runner/app.mjs', 'order-rush/app.mjs', 'order-rush/beginner.mjs',
  'snap-words/app.mjs', 'subway-rush/app.mjs', 'talk-rally/app.mjs', 'story-classroom/app.mjs', 'word-magic/app.mjs'];
const read = rel => fs.readFileSync(path.join(here, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const SOURCE = atlasGate.toString().replace(/\r\n/g, '\n');

test('문 확인은 키트의 nextDoor(win) || devFlag(win)와 같은 답을 낸다(위 창의 문 · 다른 출처 · 로컬 개발 깃발 · 학습 허브 안 · 막힌 주소)', () => {
  const door = { open() {} };
  const foreign = new Proxy({}, { get() { throw new Error('다른 출처'); } });
  const at = (hostname, search = '') => ({ hostname, search });
  const alone = win => Object.assign(win, { parent: win, top: win });
  const cases = [
    alone({ location: at('synk.im') }),
    { parent: { SYNKAtlasGame: door }, top: {}, location: at('synk.im') },
    { parent: {}, top: { SYNKAtlasGame: door }, location: at('synk.im') },
    { parent: { SYNKAtlasGame: {} }, top: {}, location: at('synk.im') },
    { parent: { SYNKAtlasGame: { open: 1 } }, top: {}, location: at('synk.im') },
    { parent: foreign, top: foreign, location: at('synk.im') },
    { parent: foreign, top: { SYNKAtlasGame: door }, location: at('synk.im') },
    alone({ location: at('localhost', '?atlas=next') }),
    alone({ location: at('127.0.0.1', '?x=1&atlas=next') }),
    alone({ location: at('[::1]', '?atlas=next') }),
    alone({ location: at('app.localhost', '?atlas=next') }),
    alone({ location: at('localhost', '?atlas=old') }),
    alone({ location: at('synk.im', '?atlas=next') }),
    alone({ location: at('localhost.synk.im', '?atlas=next') }),
    { parent: { SYNKLearningHost: {} }, top: {}, location: at('localhost', '?atlas=next') },
    { parent: foreign, top: foreign, location: at('localhost', '?atlas=next') },
    { parent: null, top: null, location: at('localhost', '?atlas=next') },
    { get location() { throw new Error('막힘'); } },
    {},
    undefined,
  ];
  const answers = cases.map(win => atlasGate(win));
  assert.deepEqual(answers, cases.map(win => Boolean(nextDoor(win) || devFlag(win))));
  assert.ok(answers.includes(true) && answers.includes(false));
});

test('문을 받는 게임마다 앱 파일이 목록에 있다(새 게임을 더하면 그 앱도 여기에)', () => {
  for (const game of [...KIT_GAMES, ...ATLAS_NEXT_ALSO]) assert.ok(GATE_APPS.some(rel => rel.startsWith(`${game}/`)), game);
});

for (const rel of GATE_APPS) {
  test(`${rel} — 키트를 정적으로 부르지 않고, 문 확인을 원본 글자 그대로 한 번 적어 쓴다`, () => {
    const source = read(rel);
    const statics = [...source.matchAll(/^import\s[^;]*?from\s+['"]([^'"]+)['"]/gm)].map(m => m[1]);
    assert.ok(!statics.some(s => s.includes('kit/atlas-next')), '키트를 정적으로 부르지 않는다');
    assert.equal(source.split(SOURCE).length - 1, 1, '원본(play-common/atlas-gate.mjs)과 같은 글자');
    assert.equal(source.match(/\bfunction atlasGate\(/g).length, 1);
    assert.doesNotMatch(source, /(?<![.\w])(nextDoor|devFlag|ended)\(/, '키트 이름을 부르지 않는다');
    assert.equal(source.match(/\batlasGate\(window\)/g).length, 1, '문 확인은 한 자리');
  });
}
