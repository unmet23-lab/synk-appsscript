// 빌드(tools/build.mjs): 같은 커밋이면 같은 바이트, 나무는 공개 경로 그대로, 판 이름은 빌드가 찍고, 공개 판은 조건을 다 채울 때만.
// 마지막에 진짜 묶음과 진짜 입구로 await coach.ready까지 돌린다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { build, EDITION_FORM, editionFor, PACKAGE_ROOT } from '../../tools/build.mjs';
import { tempDir } from '../support/temp.mjs';

const STATE = { commit: 'a'.repeat(40), dirty: false };
const EDITION = '0.0.0-dev.aaaaaaa';
// 지도 나무(atlas/<판>/map/)는 test/build/map-build.test.mjs가 따로 본다(단계 1) — 여기서는 엔진 묶음 · 입구만.
const listFiles = dir =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'map' ? [] : listFiles(full);
    return [full];
  });

const first = await build({ out: tempDir('atlas-build-a-'), state: STATE });
const second = await build({ out: tempDir('atlas-build-b-'), state: STATE });

test('같은 커밋이면 같은 바이트다 — 시각 · 절대 경로가 들지 않는다', () => {
  const relative = out =>
    listFiles(out)
      .map(file => path.relative(out, file).replace(/\\/g, '/'))
      .sort();
  assert.deepEqual(relative(first.out), relative(second.out));
  for (const name of relative(first.out)) {
    assert.ok(
      fs
        .readFileSync(path.join(first.out, name))
        .equals(fs.readFileSync(path.join(second.out, name))),
      name,
    );
  }
});

// 단계 2부터 두뇌가 ts-fsrs(MIT)를 묶음에 넣으므로 판 폴더에 제3자 고지(LICENSES.txt)가 함께 난다.
test('나무는 공개 경로 그대로 — 입구 둘과 판 폴더(묶음 · manifest · 제3자 고지)', () => {
  assert.equal(first.edition, EDITION);
  assert.match(first.edition, EDITION_FORM);
  const names = listFiles(first.out)
    .map(file => path.relative(first.out, file).replace(/\\/g, '/'))
    .sort();
  assert.deepEqual(names, [
    `atlas/${EDITION}/LICENSES.txt`,
    `atlas/${EDITION}/atlas.mjs`,
    `atlas/${EDITION}/manifest.json`,
    'atlas/loader.js',
    'atlas/loader.mjs',
  ]);
  const loader = fs.readFileSync(path.join(first.out, 'atlas/loader.js'), 'utf8');
  assert.ok(loader.includes(`const EDITION = '${EDITION}';`));
  assert.equal(loader.includes('__ATLAS_EDITION__'), false);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(first.out, `atlas/${EDITION}/manifest.json`), 'utf8'),
  );
  assert.equal(manifest.edition, EDITION);
  assert.equal(manifest.release, false);
  assert.equal(manifest.commit, STATE.commit);
  assert.deepEqual(
    manifest.thirdParty,
    [{ name: 'ts-fsrs', version: '5.4.2', license: 'MIT' }],
    '두뇌가 ts-fsrs를 묶음에 넣는다(단계 2) — 판 5.4.2 · MIT',
  );
  assert.deepEqual(Object.keys(manifest.files), ['atlas.mjs', 'LICENSES.txt']);
  assert.deepEqual(Object.keys(manifest.entry), ['loader.js', 'loader.mjs']);
});

test('묶음은 빌드가 찍은 판 이름을 말한다', async () => {
  const bundle = await import(
    pathToFileURL(path.join(first.out, `atlas/${EDITION}/atlas.mjs`)).href
  );
  assert.equal(bundle.EDITION, EDITION);
  assert.equal(typeof bundle.createCoach, 'function');
  assert.equal('attachLegacyCoach' in bundle, false, '지금 판 덧대기는 묶음에 들지 않는다');
});

test('진짜 입구 + 진짜 묶음: 지도 없는 코치는 ready가 MAP_FAILED로 거절되고, 지도 · 저장소를 주면 await coach.ready 뒤 고른다', async () => {
  const context = vm.createContext({ setTimeout, clearTimeout, URL });
  context.window = context;
  context.parent = context;
  context.document = {
    currentScript: { src: pathToFileURL(path.join(first.out, 'atlas/loader.js')).href },
  };
  new vm.Script(fs.readFileSync(path.join(first.out, 'atlas/loader.js'), 'utf8'), {
    importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
  }).runInContext(context);
  const empty = context.SynkAtlas.coach({});
  await assert.rejects(empty.ready, error => error.code === 'MAP_FAILED');
  const bundle = await import(
    pathToFileURL(path.join(first.out, `atlas/${EDITION}/atlas.mjs`)).href
  );
  const read = name => JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'map', name), 'utf8'));
  const coach = context.SynkAtlas.coach({
    gameId: 'build-check',
    mapData: { index: read('index.json'), units: read('units.json') },
    host: { guest: true, port: bundle.memoryPort() },
  });
  await coach.ready;
  assert.equal(coach.edition, EDITION);
  assert.equal(coach.recommend([]).status, 'none', '후보가 없으면 낼 것이 없다');
  assert.throws(
    () => coach.live(),
    error => error.code === 'NOT_IMPLEMENTED',
  );
  coach.dispose();
});

test('판 이름: 개발 판은 커밋 앞 7자(+ .dirty), 공개 판은 깨끗하고 origin/master에 든 커밋의 0.0.0이 아닌 판만', () => {
  const base = { version: '1.2.3', commit: 'b'.repeat(40), release: false, inOrigin: false };
  assert.equal(editionFor({ ...base, dirty: false }), '1.2.3-dev.bbbbbbb');
  assert.equal(editionFor({ ...base, dirty: true }), '1.2.3-dev.bbbbbbb.dirty');
  assert.equal(editionFor({ ...base, dirty: false, release: true, inOrigin: true }), '1.2.3');
  assert.throws(
    () => editionFor({ ...base, dirty: true, release: true, inOrigin: true }),
    /커밋하지 않은/,
  );
  assert.throws(
    () => editionFor({ ...base, dirty: false, release: true, inOrigin: false }),
    /origin\/master/,
  );
  assert.throws(
    () => editionFor({ ...base, version: '0.0.0', dirty: false, release: true, inOrigin: true }),
    /0\.0\.0/,
  );
  assert.throws(() => editionFor({ ...base, version: 'next', dirty: false }), /판 꼴/);
});

test('빈 폴더가 아니면 덮지 않는다', async () => {
  await assert.rejects(build({ out: first.out, state: STATE }), /덮지 않는다/);
});

// 묶음에 제3자 코드가 들면 고지 파일을 내고, 이 PC의 경로가 남으면 멈춘다 — 패키지 안 임시 뿌리(.fixtures/, git 밖)에서 본다.
function fixtureRoot(source) {
  const root = path.join(
    PACKAGE_ROOT,
    '.fixtures',
    `build-${process.pid}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.cpSync(path.join(PACKAGE_ROOT, 'loader'), path.join(root, 'loader'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), '{"version":"0.0.0"}\n');
  fs.writeFileSync(path.join(root, 'src', 'index.mjs'), source);
  return root;
}

test('제3자 코드가 들면 LICENSES.txt와 manifest의 제3자 목록을 낸다', async () => {
  const root = fixtureRoot(
    "import { FSRSVersion } from 'ts-fsrs';\nexport const EDITION = 'x';\nexport const v = FSRSVersion;\n",
  );
  try {
    const result = await build({ out: tempDir('atlas-build-licence-'), root, state: STATE });
    assert.deepEqual(result.manifest.thirdParty, [
      { name: 'ts-fsrs', version: '5.4.2', license: 'MIT' },
    ]);
    const text = fs.readFileSync(
      path.join(result.out, `atlas/${result.edition}/LICENSES.txt`),
      'utf8',
    );
    assert.match(text, /^ts-fsrs 5\.4\.2 \(MIT\)/);
    assert.match(text, /MIT License/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('묶음에 이 PC의 경로가 남으면 멈춘다', async () => {
  const root = fixtureRoot(
    "export const EDITION = 'x';\nexport const where = 'C:/Users/someone/x';\n",
  );
  try {
    await assert.rejects(build({ out: tempDir('atlas-build-leak-'), root, state: STATE }), /경로/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
