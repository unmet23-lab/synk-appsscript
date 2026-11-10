// 패키지의 약속을 기계로 본다: 시험은 src · loader를 시험 대상(subject)으로만 부르고, 의존은 정확한 판으로 묶고,
// 입구의 판 이름 자리는 하나이며, 지금 판에 붙이는 덧대기(health/legacy.mjs)는 엔진 묶음에 들지 않는다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { PACKAGE_ROOT } from '../support/subject.mjs';

const read = relative => fs.readFileSync(path.join(PACKAGE_ROOT, relative), 'utf8');
const filesUnder = dir =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? filesUnder(full) : [full];
      })
    : [];

test('unit · properties 시험은 src · loader를 test/support/subject.mjs로만 부른다(변형 실행기가 사본을 시험하려면)', () => {
  const direct = /(?:from\s+|import\(\s*)['"](?:\.\.\/)+(?:src|loader)\//;
  for (const group of ['unit', 'properties']) {
    for (const file of filesUnder(path.join(PACKAGE_ROOT, 'test', group))) {
      if (!file.endsWith('.mjs')) continue;
      assert.equal(
        direct.test(fs.readFileSync(file, 'utf8')),
        false,
        path.relative(PACKAGE_ROOT, file),
      );
    }
  }
});

test('의존은 정확한 판으로 묶는다 — ts-fsrs는 08-22에 정한 5.4.2', () => {
  const pkg = JSON.parse(read('package.json'));
  for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
    assert.match(version, /^\d+\.\d+\.\d+$/, `${name} ${version}`);
  }
  assert.equal(pkg.dependencies['ts-fsrs'], '5.4.2');
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.packages['node_modules/ts-fsrs'].version, '5.4.2');
});

test('입구의 판 이름 자리는 꼭 하나다(빌드가 그 한 줄만 바꾼다)', () => {
  assert.equal(read('loader/loader.js').split("'__ATLAS_EDITION__'").length, 2);
  assert.match(read('loader/loader.js'), /^ {2}const EDITION = '__ATLAS_EDITION__';$/m);
  assert.equal(read('loader/loader.mjs').includes('EDITION'), false, 'ES 모듈 겉은 판과 무관하다');
});

test('엔진 묶음의 입구는 지금 판 덧대기를 부르지 않는다', () => {
  const index = read('src/index.mjs');
  assert.equal(/health\/legacy/.test(index.replace(/^\/\/.*$/gm, '')), false);
});

test('소스에 이 PC의 자리가 없다', () => {
  const local = /[A-Za-z]:[\\/](?:Users|SYNK)|\/Users\/|SYNK-worktrees/;
  for (const file of [
    ...filesUnder(path.join(PACKAGE_ROOT, 'src')),
    ...filesUnder(path.join(PACKAGE_ROOT, 'loader')),
  ]) {
    assert.equal(
      local.test(fs.readFileSync(file, 'utf8')),
      false,
      path.relative(PACKAGE_ROOT, file),
    );
  }
});
