'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const tool = path.join(__dirname, '..', 'tools', '옷GPT굽기.js');
const source = fs.readFileSync(tool, 'utf8');
const expectedModel = 'gpt-image-2.5-sunburst';

// 실제 자격증명·네트워크·이미지·쓰기에는 닿지 않고 CLI 전체 흐름을 실행한다.
async function run(args, apiError = null) {
  const calls = [], writes = [], logs = [];
  let reads = 0, preparations = 0;
  const fakeProcess = {
    argv: ['node', tool, ...args], env: { OPENAI_KEY_FILE: '/test-only/key' },
    exitCode: 0, exit(code) { this.exitCode = code; },
  };
  const fakeFs = {
    existsSync: () => true, statSync: () => ({ mtimeMs: 1 }), mkdirSync() {},
    readFileSync(p) {
      reads++;
      return p === '/test-only/key' ? 'sk-' + 'x'.repeat(24) : Buffer.from('test-image');
    },
    writeFileSync(p, bytes) { writes.push({ p, bytes }); },
  };
  const list = {
    마스코트들: [{ 이름: '까몽', 참조: 'test-body.png', 표식: 'Preserve the reference dragon.' }],
    목록: () => [{ 이름: '목도리', 설명: 'A felt scarf around the neck.' }],
  };
  await vm.runInNewContext(source, {
    __dirname: path.dirname(tool), Buffer, Blob, FormData, process: fakeProcess,
    console: { log: (...xs) => logs.push(xs.join(' ')), error: (...xs) => logs.push(xs.join(' ')) },
    require(id) {
      if (id === 'fs') return fakeFs;
      if (id === 'path') return path;
      if (id === 'child_process') return { spawnSync: () => { preparations++; return { status: 0 }; } };
      if (id.endsWith('옷목록.js')) return list;
      throw new Error(`Unexpected dependency: ${id}`);
    },
    fetch: async (url, options) => {
      calls.push({ url, model: options.body.get('model'), size: options.body.get('size'),
        images: options.body.getAll('image[]').length, prompt: options.body.get('prompt') });
      return { json: async () => apiError ? { error: { message: apiError } } :
        { data: [{ b64_json: Buffer.from('generated-test').toString('base64') }], usage: {} } };
    },
  }, { filename: tool });
  return { calls, writes, logs, reads, preparations, exitCode: fakeProcess.exitCode };
}

test('설정 조회는 2.5 Sunburst 고정이며 자격증명·생성·가공에 닿지 않는다', async () => {
  const r = await run(['--설정']);
  assert.deepEqual(JSON.parse(r.logs[0]), { 모델: expectedModel, 대체모델: null, 기본크기: 2560, 생성: false });
  assert.equal(r.reads + r.preparations + r.calls.length + r.writes.length, 0);
});

test('실제 전송 폼의 모델만 2.5로 바꾸고 몸·옷 참조와 크기를 유지한다', async () => {
  const r = await run(['--것', '목도리']);
  assert.equal(r.exitCode, 0);
  assert.equal(r.calls.length, 1);
  assert.equal(r.calls[0].url, 'https://api.openai.com/v1/images/edits');
  assert.equal(r.calls[0].model, expectedModel);
  assert.equal(r.calls[0].size, '2560x2560');
  assert.equal(r.calls[0].images, 2);
  assert.match(r.calls[0].prompt, /soft contact shadow/);
  assert.match(r.calls[0].prompt, /same light/);
  assert.equal(r.writes.length, 1);
  assert.ok(r.logs.some(s => s.includes('장당 비용은 미실측')));
});

test('2.0 지정은 자격증명 읽기나 생성 전에 거절한다', async () => {
  const r = await run(['--모델', 'gpt-image-2', '--것', '목도리']);
  assert.equal(r.exitCode, 1);
  assert.equal(r.reads + r.preparations + r.calls.length + r.writes.length, 0);
  assert.ok(r.logs.some(s => s.includes('고정')));
});

test('2.5 사용 불가여도 2.0이나 다른 모델로 다시 요청하지 않는다', async () => {
  const r = await run(['--것', '목도리'], 'Model unavailable');
  assert.equal(r.exitCode, 1);
  assert.deepEqual(r.calls.map(c => c.model), [expectedModel]);
  assert.equal(r.writes.length, 0);
});

test('목록은 기존처럼 생성 없이 조회한다', async () => {
  const r = await run(['--목록']);
  assert.equal(r.exitCode, 0);
  assert.ok(r.logs.some(s => s.includes('목도리')));
  assert.equal(r.reads + r.preparations + r.calls.length + r.writes.length, 0);
});
