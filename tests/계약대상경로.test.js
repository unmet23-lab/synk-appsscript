'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 형제대상, 대상들 } = require('../tools/계약동기화.js');
const { 형제경로 } = require('../.claude/hooks/lib/형제저장소.js');
const { 표기접기 } = require('./lib/소스검사.js');
const ROOT = path.resolve(__dirname, '..');

function 임시Talk(t, 이름 = 'synk-talk') {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-contract-target-'));
  fs.mkdirSync(path.join(뿌리, '.git'));
  fs.writeFileSync(path.join(뿌리, 'package.json'), JSON.stringify({ name: 이름 }));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true }));
  return 뿌리;
}

function 실행(대상, check = true) {
  return spawnSync(process.execPath, [path.join(ROOT, 'tools', '계약동기화.js'), ...(check ? ['--check'] : [])], {
    cwd: ROOT, env: { ...process.env, SYNK_TALK_ROOT: 대상 }, encoding: 'utf8', timeout: 10000,
  });
}

test('명시 대상이 없으면 기존 주저장소의 형제를 그대로 고른다', () => {
  assert.deepEqual(형제대상(ROOT, {}), { 뿌리: 형제경로(ROOT), 명시: false });
});

test('명시한 Talk 작업 사본을 고르고 빈 값·상대경로는 거부한다', (t) => {
  const 대상 = 임시Talk(t);
  assert.deepEqual(형제대상(ROOT, { SYNK_TALK_ROOT: 대상 }), { 뿌리: 대상, 명시: true });
  for (const 지정 of ['', ' ', '../SYNK-talk']) assert.throws(() => 형제대상(ROOT, { SYNK_TALK_ROOT: 지정 }), /절대경로/);
});

test('없는 대상·다른 저장소는 명시 경로 오류이며 건너뛰거나 쓰지 않는다', (t) => {
  const 다른곳 = 임시Talk(t, 'synk-appsscript');
  for (const 대상 of [다른곳, path.join(다른곳, 'missing')]) {
    const r = 실행(대상, false);
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /Talk 저장소를 가리키지 않는다/);
    assert.equal(fs.existsSync(path.join(대상, '계약')), false);
  }
});

test('지정 대상만 동기화하고 검사 모드는 불일치를 고치지 않으며 두 경로를 밝힌다', (t) => {
  const 대상 = 임시Talk(t);
  const 목록 = 대상들();
  assert.ok(목록.length >= 2);
  let r = 실행(대상);
  assert.equal(r.status, 1, r.stderr);
  assert.equal(fs.existsSync(path.join(대상, '계약')), false, '검사는 파일을 만들지 않는다');
  r = 실행(대상, false);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes(`정본=${ROOT}`));
  assert.ok(r.stdout.includes(`대상=${대상} (명시)`));
  for (const 상대 of 목록) assert.equal(fs.readFileSync(path.join(대상, 상대), 'utf8'), 표기접기(fs.readFileSync(path.join(ROOT, 상대), 'utf8')));
  assert.equal(실행(대상).status, 0);
  const 파일 = path.join(대상, 목록[0]);
  fs.appendFileSync(파일, '\n{"syntheticMismatch":true}\n');
  const 전 = fs.readFileSync(파일);
  r = 실행(대상);
  assert.equal(r.status, 1, r.stderr);
  assert.deepEqual(fs.readFileSync(파일), 전, '다른 계약도 검사에서 그대로 보존한다');
});
