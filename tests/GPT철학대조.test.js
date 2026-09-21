'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 대조 } = require('../tools/GPT철학대조.js');
const SCRIPT = path.resolve(__dirname, '../tools/GPT철학대조.js');

function 실행(args = ['--json'], options = {}) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8', windowsHide: true, timeout: 5000, ...options,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

function 미검증(result) {
  assert.equal(result.측정, false);
  assert.equal(result.모두쟀나, false);
  assert.equal(result.모두실렸나, null);
  assert.deepEqual(result.역할들.map(r => r.이름), ['실행자', '발주검토자', '검수자', '심문자']);
  for (const role of result.역할들) {
    assert.equal(role.쟀나, false);
    assert.equal(role.글자수, null);
    assert.equal(role.실렸나, null);
  }
}

test('CLI는 은퇴와 미검증을 JSON으로 명시하고 성공 코드로 위장하지 않는다', () => {
  const r = 실행();
  assert.equal(r.status, 2);
  assert.equal(r.stderr, '');
  const result = JSON.parse(r.stdout);
  assert.equal(result.status, 'retired');
  미검증(result);
});

test('사람용 안내는 현행 품질 검증으로 오인할 통과 표시를 내지 않는다', () => {
  const r = 실행([]);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /은퇴한 진단 · 미검증/);
  assert.match(r.stdout, /공식 앱\/CLI/);
  assert.doesNotMatch(r.stdout + r.stderr, /4\/4|넷 다 실렸다|8,000|10,637|✅/);
});

test('기존 대조 export도 미검증을 반환하며 호출마다 독립 결과를 준다', () => {
  const first = 대조();
  assert.equal(first.종료코드, 2);
  미검증(first.결과);
  first.결과.역할들[0].쟀나 = true;
  assert.equal(대조().결과.역할들[0].쟀나, false);
});

test('알 수 없는 옵션은 검사를 다시 열지 않고 인자 내용도 노출하지 않는다', () => {
  const r = 실행(['--json', '--secret-value-do-not-print']);
  assert.equal(r.status, 2);
  const result = JSON.parse(r.stdout);
  assert.equal(result.status, 'invalid-arguments');
  미검증(result);
  assert.doesNotMatch(r.stdout + r.stderr, /secret-value-do-not-print/);
});

test('러너·원문이 없는 작업 폴더에서도 모델·자식·옛 조립기를 호출하지 않는다', (t) => {
  const parent = fs.realpathSync(os.tmpdir());
  const cwd = fs.mkdtempSync(path.join(parent, 'synk-retired-diagnostic-'));
  t.after(() => {
    const resolved = fs.realpathSync(cwd);
    assert.equal(path.dirname(resolved), parent);
    assert.ok(path.basename(resolved).startsWith('synk-retired-diagnostic-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const preload = path.join(cwd, 'no-runner.cjs');
  fs.writeFileSync(preload, `
    const cp = require('node:child_process');
    for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync']) {
      cp[name] = () => { throw new Error('unexpected child process'); };
    }
    const Module = require('node:module');
    const original = Module._load;
    Module._load = function(name, ...args) {
      if (/codex-(?:build|review)|검수런|모델정책/.test(name)) throw new Error('unexpected legacy dependency');
      return original.call(this, name, ...args);
    };
  `);
  const r = spawnSync(process.execPath, ['--require', preload, SCRIPT, '--json'], {
    cwd, encoding: 'utf8', windowsHide: true, timeout: 5000,
  });
  assert.ifError(r.error);
  assert.equal(r.status, 2);
  assert.equal(r.stderr, '');
  assert.equal(JSON.parse(r.stdout).status, 'retired');
  assert.deepEqual(fs.readdirSync(cwd), ['no-runner.cjs']);
});
