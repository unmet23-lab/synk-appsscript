'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const reporter = path.join(root, 'tools/lib/시험제외보고기.cjs');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-skip-reporter-'));
  t.after(() => {
    assert.ok(path.resolve(dir).startsWith(path.join(path.resolve(os.tmpdir()), 'synk-skip-reporter-')));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

const source = `const {test,describe}=require('node:test');
test.skip('명시적 제외',()=>{});
test('자료 없음',{skip:'로컬 자료 없음'},()=>{});
test('실행 중 판단',t=>t.skip('Windows 권한 없음'));
describe('부모',()=>test('중첩 제외',{skip:'Linux에서만 실행'},()=>{}));
describe.skip('제외 묶음',()=>test('실행되지 않은 자식',()=>{}));
test.todo('다음 작업');
test('통과',()=>{});
`;

test('실제 node:test 이벤트의 네 제외만 위치·이유와 보존하고 suite·TODO·통과를 합산하지 않는다', t => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'fixture.cjs'), source);
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-reporter-destination=result.tap',
    `--test-reporter=${pathToFileURL(reporter).href}`, '--test-reporter-destination=skipped.jsonl', 'fixture.cjs'], { cwd: dir, env, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  const rows = fs.readFileSync(path.join(dir, 'skipped.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  const tests = rows.filter(r => r.종류 !== 'suite');
  assert.equal(tests.length, 4);
  assert.deepEqual(tests.map(r => r.까닭), ['명시적 skip', '로컬 자료 없음', 'Windows 권한 없음', 'Linux에서만 실행']);
  assert.ok(tests.every(r => r.파일 === 'fixture.cjs' && Number.isInteger(r.줄) && r.줄 > 0));
  const tap = fs.readFileSync(path.join(dir, 'result.tap'), 'utf8');
  assert.equal(Number(tap.match(/^# skipped (\d+)$/m)[1]), tests.length);
  assert.equal(rows.filter(r => r.종류 === 'suite').length, 1);
});

test('넓은 시험 CLI가 제외 목록을 기존 실패 후보와 함께 저장하고 실패 래칫을 유지한다', t => {
  const dir = fixture(t);
  for (const rel of ['tools/ci넓은시험.js', 'tools/lib/tap실패.js', 'tools/lib/시험제외보고기.cjs']) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.copyFileSync(path.join(root, rel), path.join(dir, rel));
  }
  fs.mkdirSync(path.join(dir, 'tests'));
  fs.writeFileSync(path.join(dir, 'tests/fixture.test.cjs'), source);
  fs.writeFileSync(path.join(dir, 'tests/ci넓은시험_알려진실패.json'), JSON.stringify({ 묶음: { 루트: [] } }));
  for (const args of [['init', '-q'], ['add', 'tests/fixture.test.cjs']]) {
    assert.equal(spawnSync('git', args, { cwd: dir, windowsHide: true }).status, 0);
  }
  const result = spawnSync(process.execPath, ['tools/ci넓은시험.js', '루트', '--후보', 'result.json'], {
    cwd: dir, encoding: 'utf8', windowsHide: true, env: { ...process.env, NODE_TEST_CONTEXT: '' },
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'result.json')));
  assert.deepEqual(saved.실패, []);
  assert.equal(saved.실행.건너뜀, 4);
  assert.equal(saved.제외.length, 4);
  assert.ok(saved.제외.every(r => r.파일 === 'tests/fixture.test.cjs'));
  const gate = require('../tools/ci넓은시험.js').종료판정;
  assert.equal(gate({ 파일: 1, 시험: 4, 통과: 0, 실패수: 0, 건너뜀: 4, 실패: [], 제외: saved.제외.slice(1) }, []).코드, 1);
});
