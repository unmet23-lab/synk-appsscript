// 입구(loader/loader.js): 클래식 스크립트와 ES 모듈 두 꼴, await coach.ready 계약(LOAD_FAILED · 시간 상한 · NOT_READY · ready 전 dispose),
// 같은 문서와 같은 출처의 위 창에 먼저 실린 판 따르기. 클래식 꼴은 문서마다 vm 문맥 하나로 흉내 내고, 판 묶음 자리에는 가짜 atlas.mjs를 둔다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { loaderSource, subject } from '../support/subject.mjs';
import { tempDir } from '../support/temp.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const withEdition = edition => loaderSource().replace("'__ATLAS_EDITION__'", `'${edition}'`);
const fakeEngine = edition => `export const EDITION = ${JSON.stringify(edition)};
export function createCoach(options = {}) {
  options.created = true;
  return { ready: Promise.resolve(), recommend: (...args) => ['picked', ...args], dispose: () => { options.disposed = true; } };
}
`;

function editionFolder(edition, body) {
  const root = tempDir('atlas-loader-');
  const folder = path.join(root, edition);
  fs.mkdirSync(folder);
  if (body != null) fs.writeFileSync(path.join(folder, 'atlas.mjs'), body);
  return {
    folder,
    base: pathToFileURL(folder + path.sep).href,
    loaderUrl: pathToFileURL(path.join(root, 'loader.js')).href,
  };
}

// 문서 하나 = vm 문맥 하나. 창 자신 · 부모 창 · 지금 실리는 클래식 스크립트(document.currentScript)를 흉내 낸다.
function documentContext({ scriptSrc = null, parent = null, location = null } = {}) {
  const context = vm.createContext({ setTimeout, clearTimeout, URL });
  context.window = context;
  context.parent = parent ?? context;
  if (scriptSrc) context.document = { currentScript: { src: scriptSrc } };
  if (location) context.location = { href: location };
  return context;
}

function runClassic(context, source) {
  new vm.Script(source, {
    filename: 'loader.js',
    importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
  }).runInContext(context);
  return context.SynkAtlas;
}

test('클래식: 판 폴더는 입구 옆이고, 입구에 든 메서드 목록은 코치 3판 목록과 같다', async () => {
  const atlas = runClassic(
    documentContext({ scriptSrc: 'https://synk.im/atlas/loader.js' }),
    withEdition('1.0.0'),
  );
  assert.equal(atlas.edition, '1.0.0');
  assert.equal(atlas.base, 'https://synk.im/atlas/1.0.0/');
  assert.ok(Object.isFrozen(atlas));
  const listed = /const METHODS = \[([\s\S]*?)\];/.exec(loaderSource())[1].match(/'[^']+'/g);
  const { COACH_METHODS } = await subject('coach/methods.mjs');
  assert.deepEqual(
    listed.map(name => name.slice(1, -1)),
    [...COACH_METHODS],
  );
});

test('같은 문서에 입구가 두 번 실리면 먼저 실린 판 하나만 돈다', () => {
  const context = documentContext({ scriptSrc: 'https://synk.im/atlas/loader.js' });
  const first = runClassic(context, withEdition('1.0.0'));
  assert.equal(runClassic(context, withEdition('1.0.0')), first);
  assert.deepEqual(plain(first.conflicts), []);
  assert.equal(runClassic(context, withEdition('1.1.0')), first);
  assert.deepEqual(plain(first.conflicts), [{ edition: '1.1.0', where: 'document' }]);
});

test('틀 안의 입구는 같은 출처 위 창의 판을 따르고, 다른 출처에 닿으면 멈춘다', () => {
  const top = documentContext({ scriptSrc: 'https://synk.im/atlas/loader.js' });
  runClassic(top, withEdition('1.0.0'));
  const middle = documentContext({ scriptSrc: 'https://synk.im/atlas/loader.js', parent: top });
  const frame = documentContext({ scriptSrc: 'https://synk.im/atlas/loader.js', parent: middle });
  const atlas = runClassic(frame, withEdition('1.1.0'));
  assert.equal(atlas.edition, '1.0.0');
  assert.equal(atlas.base, top.SynkAtlas.base);
  assert.deepEqual(plain(atlas.conflicts), [{ edition: '1.1.0', where: 'ancestor' }]);

  const foreign = {
    get SynkAtlas() {
      throw new Error('SecurityError');
    },
  };
  foreign.parent = foreign;
  const embedded = runClassic(
    documentContext({ scriptSrc: 'https://synk.im/atlas/loader.js', parent: foreign }),
    withEdition('1.1.0'),
  );
  assert.equal(embedded.edition, '1.1.0');
  assert.deepEqual(plain(embedded.conflicts), []);
});

test('ready 전에는 NOT_READY로 던지고, ready 뒤에는 진짜 코치로 넘긴다', async () => {
  const { base, loaderUrl } = editionFolder('2.0.0', fakeEngine('2.0.0'));
  const atlas = runClassic(documentContext({ scriptSrc: loaderUrl }), withEdition('2.0.0'));
  assert.equal(atlas.base, base);
  const coach = atlas.coach({ learner: 'device' });
  assert.throws(
    () => coach.recommend(),
    error => error.code === 'NOT_READY',
  );
  assert.equal(await coach.ready, undefined);
  assert.deepEqual(plain(coach.recommend('a', 1)), ['picked', 'a', 1]);
  assert.equal(coach.edition, '2.0.0');
});

test('판 묶음이 없으면 LOAD_FAILED로 거절하고, 다시 부르면 새로 받는다', async () => {
  const { folder, loaderUrl } = editionFolder('2.1.0', null);
  const atlas = runClassic(documentContext({ scriptSrc: loaderUrl }), withEdition('2.1.0'));
  const coach = atlas.coach();
  await assert.rejects(
    coach.ready,
    error => error.code === 'LOAD_FAILED' && error.reason === 'IMPORT',
  );
  assert.throws(
    () => coach.recommend(),
    error => error.code === 'NOT_READY',
  );
  fs.writeFileSync(path.join(folder, 'atlas.mjs'), fakeEngine('2.1.0'));
  const module = await atlas.load();
  assert.equal(module.EDITION, '2.1.0');
});

test('시간 상한 안에 안 오면 LOAD_FAILED(TIMEOUT), 다른 판이 오면 LOAD_FAILED(EDITION_MISMATCH)', async () => {
  const slow = editionFolder(
    '3.0.0',
    'await new Promise(() => {});\nexport const EDITION = "3.0.0";\n',
  );
  const slowAtlas = runClassic(
    documentContext({ scriptSrc: slow.loaderUrl }),
    withEdition('3.0.0'),
  );
  await assert.rejects(
    slowAtlas.coach({}, { timeoutMs: 50 }).ready,
    error => error.code === 'LOAD_FAILED' && error.reason === 'TIMEOUT',
  );
  const odd = editionFolder('3.1.0', fakeEngine('9.9.9'));
  const oddAtlas = runClassic(documentContext({ scriptSrc: odd.loaderUrl }), withEdition('3.1.0'));
  await assert.rejects(
    oddAtlas.coach().ready,
    error => error.code === 'LOAD_FAILED' && error.reason === 'EDITION_MISMATCH',
  );
});

test('떠나는 화면은 ready 전에 닫을 수 있다 — 묶음이 오기 전이면 코치를 만들지 않는다', async () => {
  const { loaderUrl } = editionFolder('4.0.0', fakeEngine('4.0.0'));
  const atlas = runClassic(documentContext({ scriptSrc: loaderUrl }), withEdition('4.0.0'));
  const options = {};
  const coach = atlas.coach(options);
  coach.dispose();
  coach.dispose();
  assert.equal(
    await coach.ready,
    undefined,
    'ready는 거절하지 않는다(처리되지 않은 거절을 남기지 않는다)',
  );
  assert.equal(options.created, undefined, '닫은 뒤에는 코치를 만들지 않는다');
  assert.throws(
    () => coach.recommend(),
    error => error.code === 'DISPOSED',
  );
});

test('닫은 뒤에 판 묶음 받기가 실패해도 ready는 거절하지 않는다(떠난 화면에 처리되지 않은 거절을 남기지 않는다)', async () => {
  const { loaderUrl } = editionFolder('4.2.0', null);
  const atlas = runClassic(documentContext({ scriptSrc: loaderUrl }), withEdition('4.2.0'));
  const coach = atlas.coach({});
  coach.dispose();
  assert.equal(await coach.ready, undefined);
  assert.throws(
    () => coach.recommend(),
    error => error.code === 'DISPOSED',
  );
  const open = atlas.coach({});
  await assert.rejects(
    open.ready,
    error => error.code === 'LOAD_FAILED',
    '닫지 않은 코치는 그대로 알린다',
  );
});

test('코치를 만든 뒤 그 ready가 풀리기 전에 닫으면, 그 코치는 붙이지 않고 닫는다', async () => {
  const slowCoach = `export const EDITION = "4.1.0";
export function createCoach(options = {}) {
  options.created = true;
  return { ready: new Promise(resolve => setTimeout(resolve, 30)), recommend: () => 'picked', dispose: () => { options.disposed = true; } };
}
`;
  const { loaderUrl } = editionFolder('4.1.0', slowCoach);
  const atlas = runClassic(documentContext({ scriptSrc: loaderUrl }), withEdition('4.1.0'));
  const options = {};
  const coach = atlas.coach(options);
  await atlas.load();
  assert.equal(options.created, true);
  coach.dispose();
  assert.equal(await coach.ready, undefined);
  assert.equal(options.disposed, true);
  assert.throws(
    () => coach.recommend(),
    error => error.code === 'DISPOSED',
  );
});

test('코치의 ready가 거절되면 입구가 그 코치를 닫고 거절을 넘긴다 — 닫은 화면이면 거절도 남기지 않는다', async () => {
  const failingCoach = `export const EDITION = "4.3.0";
export function createCoach(options = {}) {
  options.created = true;
  const error = Object.assign(new Error('저장소를 열지 못했다'), { code: 'STORAGE_ERROR' });
  return { ready: new Promise((_, reject) => setTimeout(() => reject(error), 30)), recommend: () => 'picked', dispose: () => { options.disposed = true; } };
}
`;
  const { loaderUrl } = editionFolder('4.3.0', failingCoach);
  const atlas = runClassic(documentContext({ scriptSrc: loaderUrl }), withEdition('4.3.0'));
  const open = {};
  const coach = atlas.coach(open);
  await assert.rejects(
    coach.ready,
    error => error.code === 'STORAGE_ERROR',
    '코치의 거절은 그대로 알린다',
  );
  assert.equal(open.disposed, true, '거절된 코치는 입구가 닫는다(잠금 · 구독이 새지 않게)');
  assert.throws(
    () => coach.recommend(),
    error => error.code === 'NOT_READY',
  );
  const left = {};
  const leaving = atlas.coach(left);
  await atlas.load();
  assert.equal(left.created, true);
  leaving.dispose();
  assert.equal(await leaving.ready, undefined, '닫은 화면에는 거절을 남기지 않는다');
  assert.equal(left.disposed, true, '닫은 화면의 코치도 닫는다');
});

test('판 주소를 정할 수 없으면(문서도 주소도 없음) LOAD_FAILED(NO_BASE)', async () => {
  const atlas = runClassic(documentContext(), withEdition('5.0.0'));
  assert.equal(atlas.base, null);
  await assert.rejects(
    atlas.coach().ready,
    error => error.code === 'LOAD_FAILED' && error.reason === 'NO_BASE',
  );
});

test('ES 모듈 꼴: loader.mjs가 loader.js를 모듈로 실어 SynkAtlas와 coach를 내보낸다 — 판 폴더는 같은 출처의 /atlas/', async () => {
  const dir = tempDir('atlas-loader-module-');
  // 브라우저는 import한 .js를 늘 모듈로 읽는다 — Node도 모듈(엄격 모드 · 모듈 범위)로 읽게 한다.
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}\n');
  fs.writeFileSync(path.join(dir, 'loader.js'), withEdition('6.0.0'));
  fs.writeFileSync(path.join(dir, 'loader.mjs'), loaderSource('loader.mjs'));
  globalThis.location = { href: 'https://synk.im/world/home' };
  try {
    const entry = await import(pathToFileURL(path.join(dir, 'loader.mjs')).href);
    assert.equal(entry.SynkAtlas, globalThis.SynkAtlas);
    assert.equal(entry.default, globalThis.SynkAtlas);
    assert.equal(entry.SynkAtlas.edition, '6.0.0');
    assert.equal(entry.SynkAtlas.base, 'https://synk.im/atlas/6.0.0/');
    assert.equal(typeof entry.coach, 'function');
  } finally {
    delete globalThis.SynkAtlas;
    delete globalThis.location;
  }
});
