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
  'snap-words/app.mjs', 'subway-rush/app.mjs', 'talk-rally/app.mjs', 'story-classroom/app.mjs', 'word-magic/app.mjs', 'hangul-stage/app.mjs'];
const read = rel => fs.readFileSync(path.join(here, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const SOURCE = atlasGate.toString().replace(/\r\n/g, '\n');
// 정적 가져오기 — 이름을 받는 꼴(import { x } from '…')과 실행만 하는 꼴(import '…') 둘 다(검수 GA2).
const staticImports = source => [...source.matchAll(/^import\s+(?:[^;]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)].map(m => m[1]);

test('정적 가져오기 검사는 이름을 받는 꼴과 실행만 하는 꼴을 모두 잡는다', () => {
  assert.deepEqual(staticImports("import './kit/atlas-next.mjs';\nimport { a } from './x.mjs';\nimport * as b from \"./y.mjs\";\nconst c = import('./z.mjs');"), ['./kit/atlas-next.mjs', './x.mjs', './y.mjs']);
});

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
    const statics = staticImports(source);
    assert.ok(!statics.some(s => s.includes('kit/atlas-next')), '키트를 정적으로 부르지 않는다');
    assert.equal(source.split(SOURCE).length - 1, 1, '원본(play-common/atlas-gate.mjs)과 같은 글자');
    assert.equal(source.match(/\bfunction atlasGate\(/g).length, 1);
    assert.doesNotMatch(source, /(?<![.\w])(nextDoor|devFlag|ended)\(/, '키트 이름을 부르지 않는다');
    assert.equal(source.match(/\batlasGate\(window\)/g).length, 1, '문 확인은 한 자리');
  });
}

// 공개 직후 10분 섞임 창: 앱 파일은 html의 토큰이 바뀌어 곧바로 새 판이 실리지만, 앱이 토큰 없이 부르는 의존 모듈은 캐시의 옛 판이 남는다.
// 5-3 게임에서 바뀐 의존 모듈은 판 표시(?v=)로 불러 새 앱이 옛 판과 섞이지 않게 한다(검수 GC1 · F1).
test('5-3 게임에서 바뀐 의존 모듈은 판 표시로 부른다 — 새 앱이 옛 audio.mjs · listening-check-ui.mjs 같은 판과 섞이지 않는다', () => {
  const tokened = [
    ['korean-rhythm/app.mjs', './audio.mjs'], ['korean-rhythm/app.mjs', './supplemental-player.mjs'], ['korean-rhythm/world-play.mjs', './audio.mjs'],
    ['korean-runner/app.mjs', './listening-check-ui.mjs'], ['korean-racing/app.js', './race-controller.js'],
    // 4-7 한글: 라이브와 다른 learning.mjs · 새 내보내기를 더한 core.mjs
    ['hangul-stage/app.mjs', './core.mjs'], ['hangul-stage/app.mjs', './learning.mjs'], ['hangul-stage/atlas-next-play.mjs', './core.mjs'], ['hangul-stage/atlas-next-play.mjs', './learning.mjs'],
  ];
  for (const [file, dep] of tokened) {
    const statics = staticImports(read(file));
    assert.equal(statics.includes(dep), false, `${file}가 ${dep}를 토큰 없이 부른다`);
    assert.ok(statics.some(p => p.startsWith(`${dep}?v=`)), `${file} → ${dep}?v=`);
  }
  // 리듬은 audio.mjs를 한 주소로만 부른다 — 두 주소면 모듈이 둘이 되어 곡 · 문장 소리 캐시를 나눠 갖는다.
  const audio = ['korean-rhythm/app.mjs', 'korean-rhythm/world-play.mjs'].map(file => staticImports(read(file)).find(p => p.startsWith('./audio.mjs')));
  assert.equal(new Set(audio).size, 1, audio.join(' · '));
  // 한글은 core.mjs · learning.mjs를 앱과 새 길 모듈이 같은 주소로 부른다(한 판만 실린다).
  for (const dep of ['./core.mjs', './learning.mjs']) {
    const urls = ['hangul-stage/app.mjs', 'hangul-stage/atlas-next-play.mjs'].map(file => staticImports(read(file)).find(p => p.startsWith(dep)));
    assert.equal(new Set(urls).size, 1, urls.join(' · '));
  }
});
