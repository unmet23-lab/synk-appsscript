'use strict';

/* agy가 답(result 사건)을 내고도 끝나지 않던 일(10-19 긴 검수)을 가짜 agy로 재현한다. 가짜는 SYNK_AGY_BIN
 * (.js → node로 띄움)으로 바꿔 끼우고, 설정은 SYNK_AGY_SETTINGS의 빈 임시 파일만 읽는다.
 * 실제 agy·Google 로그인·API 키는 쓰지 않는다. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const 도구 = path.join(__dirname, '..', 'tools', 'lib', '제미나이구독호출.js');
const 구독 = require(도구);

/* FAKE_AGY_MODE: linger(결과 뒤 손주와 함께 버팀) · exit(결과 뒤 스스로 끝남) · status(SUCCESS 아님, 버팀)
 * · noresult(결과 없이 종료 3) · silent(아무것도 안 내고 버팀) · badline(JSON 아닌 줄, 버팀).
 * FAKE_AGY_LOG에 pid·작업 폴더·인자·받은 글 길이, 손주 pid를 한 줄씩 남긴다. */
const 가짜 = `
const fs = require('fs');
const { spawn } = require('child_process');
const 판 = process.env.FAKE_AGY_MODE;
const 남기 = (값) => fs.appendFileSync(process.env.FAKE_AGY_LOG, JSON.stringify(값) + '\\n');
const 사건 = (e) => process.stdout.write(JSON.stringify(e) + '\\n');
const 버티기 = () => setInterval(() => {}, 1000);
const 모델 = process.argv[process.argv.indexOf('--model') + 1];
let 입력 = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { 입력 += d; });
process.stdin.on('end', () => {
  const 글 = JSON.parse(입력).message.content;
  남기({ pid: process.pid, cwd: process.cwd(), argv: process.argv.slice(2), 유료허용: process.env.SYNK_ALLOW_PAID_API ?? null, 글자: 글.length });
  if (판 === 'silent') return 버티기();
  if (판 === 'badline') { console.log('새 판이 있습니다'); return 버티기(); }
  사건({ event: 'init', init: { model: 모델 } });
  사건({ event: 'step_update', step_update: { state: 'DONE' } });
  if (판 === 'noresult') { console.error('가짜 오류: 몫을 못 읽었다'); process.exit(3); }
  사건({ event: 'result', result: 판 === 'status'
    ? { status: 'ERROR', error: '가짜 몫 초과' }
    : { status: 'SUCCESS', response: '가짜 답 ' + 글.length, usage: { total_tokens: 7 } } });
  if (판 === 'exit') return;
  const 손주 = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'inherit' });
  남기({ 손주: 손주.pid });
  버티기();
});
`;

function 무대만들기(모드) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-agy-fake-'));
  const bin = path.join(뿌리, 'fake-agy.js');
  const 설정 = path.join(뿌리, 'settings.json');
  const 로그 = path.join(뿌리, 'fake.log');
  fs.writeFileSync(bin, 가짜);
  fs.writeFileSync(설정, '{}');
  const 남긴것 = () => (fs.existsSync(로그) ? fs.readFileSync(로그, 'utf8').split('\n').filter(Boolean).map((s) => JSON.parse(s)) : []);
  return {
    뿌리, bin, 남긴것,
    출력: path.join(뿌리, 'out', 'answer.json'),
    env: { ...process.env, SYNK_AGY_BIN: bin, SYNK_AGY_SETTINGS: 설정, FAKE_AGY_MODE: 모드, FAKE_AGY_LOG: 로그 },
    치우기() {
      for (const 줄 of 남긴것()) {
        for (const pid of [줄.pid, 줄.손주]) if (pid) { try { process.kill(pid, 'SIGKILL'); } catch { /* 이미 끝남 */ } }
      }
      fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
    },
  };
}

function 살았나(pid) {
  try { process.kill(pid, 0); } catch { return false; }
  /* 리눅스에서 거둬 가지 않은 좀비는 죽은 것으로 본다 */
  try { return !/^\d+ \(.*\) Z/.test(fs.readFileSync(`/proc/${pid}/stat`, 'utf8')); } catch { return true; }
}
async function 남은프로세스(pids, ms = 5_000) {
  const 끝 = Date.now() + ms;
  while (pids.some(살았나) && Date.now() < 끝) await new Promise((r) => setTimeout(r, 100));
  return pids.filter(살았나);
}

/* 손잡이(CLI)를 부르기와 같은 꼴(stdin 글 → -o 기록)로 띄운다. 비밀 걷기를 보려고 유료 허용 변수를 하나 얹는다. */
function CLI(무대, 인자, 글 = '짧은 질문') {
  return new Promise((resolve, reject) => {
    const 시작 = Date.now();
    const p = spawn(process.execPath, [도구, ...인자], {
      env: { ...무대.env, SYNK_ALLOW_PAID_API: '1' }, windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'],
    });
    let stderr = '';
    p.stderr.setEncoding('utf8');
    p.stderr.on('data', (d) => { stderr += d; });
    const 멈춤 = setTimeout(() => { p.kill('SIGKILL'); reject(new Error(`손잡이가 45초 안에 끝나지 않았다: ${stderr}`)); }, 45_000);
    p.on('error', reject);
    p.on('close', (code) => { clearTimeout(멈춤); resolve({ code, stderr, 걸린ms: Date.now() - 시작 }); });
    p.stdin.end(글, 'utf8');
  });
}
const 아르곤 = (무대, ...더) => ['--model', 'gemini-4-argon', '--thinking', 'high', '-o', 무대.출력, ...더];
const 사용자줄 = (글) => JSON.stringify({ event: 'user', message: { content: 글 } }) + '\n';

test('결과를 낸 뒤 끝나지 않는 agy(손주까지 버팀)에서도 답을 받고, 묶음째 닫아 제한보다 훨씬 빨리 끝난다', { timeout: 60_000 }, async () => {
  const 무대 = 무대만들기('linger');
  try {
    const r = await CLI(무대, 아르곤(무대, '--timeout', '60000'));
    assert.equal(r.code, 0, r.stderr);
    assert.ok(r.걸린ms < 30_000, `걸린 시간 ${r.걸린ms}ms — 제한은 60초 + 30초`);
    assert.match(r.stderr, /결과를 낸 뒤 5초 안에 끝나지 않아 프로세스 묶음을 닫았다/);
    const [첫, 손주] = 무대.남긴것();
    assert.deepEqual(JSON.parse(fs.readFileSync(무대.출력, 'utf8')), {
      text: `가짜 답 ${첫.글자}`,
      modelVersion: 'gemini-4-argon-high',
      finishReason: 'SUCCESS',
      usage: { total_tokens: 7 },
      route: 'google-ai-subscription',
      requestedModel: 'gemini-4-argon',
      requestedThinking: 'high',
      selectedModel: 'gemini-4-argon-high',
    });
    assert.deepEqual(첫.argv, ['--input-format', 'stream-json', '--output-format', 'stream-json',
      '--model', 'gemini-4-argon-high', '--effort', 'high', '--print-timeout', '60s', '--sandbox', '--disable-slash-commands']);
    assert.equal(첫.유료허용, null, 'agy에는 유료 API 허용 변수를 넘기지 않는다');
    assert.ok(첫.글자 > '짧은 질문'.length, '도구 없이 답하라는 머리말을 붙인다');
    assert.match(path.basename(첫.cwd), /^synk-agy-review-/);
    assert.equal(fs.existsSync(첫.cwd), false, '임시방을 지운다');
    assert.deepEqual(await 남은프로세스([첫.pid, 손주.손주]), [], 'agy와 손주가 모두 닫혔다');
  } finally {
    무대.치우기();
  }
});

test('스스로 끝나는 agy는 닫지 않고 받으며, 부르기도 손잡이와 같은 기록을 돌려준다', { timeout: 60_000 }, async () => {
  const 무대 = 무대만들기('exit');
  const 옛 = {};
  try {
    const r = await CLI(무대, 아르곤(무대));
    assert.equal(r.code, 0, r.stderr);
    assert.doesNotMatch(r.stderr, /묶음을 닫았다/);
    const 손잡이 = JSON.parse(fs.readFileSync(무대.출력, 'utf8'));

    for (const k of ['SYNK_AGY_BIN', 'SYNK_AGY_SETTINGS', 'FAKE_AGY_MODE', 'FAKE_AGY_LOG']) { 옛[k] = process.env[k]; process.env[k] = 무대.env[k]; }
    const 부른 = await 구독.부르기({ model: 'gemini-4-argon', thinking: 'high', prompt: '짧은 질문' });
    assert.deepEqual(부른, 손잡이);
    const 구조 = await 구독.부르기({ model: 'gemini-3.8-flash', thinking: 'medium', prompt: '짧은 질문', schema: { type: 'object' } });
    assert.equal(구조.selectedModel, 'gemini-3.8-flash-medium');
    assert.ok(무대.남긴것().at(-1).argv.includes('--json-schema'));
  } finally {
    for (const [k, v] of Object.entries(옛)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    무대.치우기();
  }
});

test('result 전에 끝나면 지금처럼 오류(종료 2)로 내고 agy 진단을 함께 보여 준다', { timeout: 60_000 }, async () => {
  const 무대 = 무대만들기('noresult');
  try {
    const r = await CLI(무대, 아르곤(무대));
    assert.equal(r.code, 2);
    assert.match(r.stderr, /확인 불가: 제미나이 구독 호출 실패 — agy가 결과 없이 끝났다\(종료 3\): 가짜 오류: 몫을 못 읽었다/);
    assert.equal(fs.existsSync(무대.출력), false);
  } finally {
    무대.치우기();
  }
});

test('상태가 SUCCESS가 아니면 지금처럼 오류로 내고, 남아 있는 agy 묶음도 닫는다', { timeout: 60_000 }, async () => {
  const 무대 = 무대만들기('status');
  try {
    const r = await CLI(무대, 아르곤(무대));
    assert.equal(r.code, 2);
    assert.match(r.stderr, /agy 상태 ERROR: 가짜 몫 초과/);
    assert.match(r.stderr, /프로세스 묶음을 닫았다/);
    assert.equal(fs.existsSync(무대.출력), false);
    const [첫, 손주] = 무대.남긴것();
    assert.deepEqual(await 남은프로세스([첫.pid, 손주.손주]), []);
  } finally {
    무대.치우기();
  }
});

test('제한 시간 안에 result가 없으면 묶음을 닫고 시간 제한 오류로 끝난다', { timeout: 60_000 }, async () => {
  const 무대 = 무대만들기('silent');
  try {
    const 시작 = Date.now();
    await assert.rejects(
      구독.agy받기({ bin: 무대.bin, args: ['--model', 'm'], cwd: 무대.뿌리, input: 사용자줄('글'), env: 무대.env, 제한Ms: 3_000 }),
      /3초 안에 결과를 내지 않았다\(시간 제한\)/,
    );
    assert.ok(Date.now() - 시작 < 15_000);
    const [첫] = 무대.남긴것();
    assert.deepEqual(await 남은프로세스([첫.pid]), []);
  } finally {
    무대.치우기();
  }
});

test('JSON이 아닌 줄이 오면 멈추고 agy를 닫는다', { timeout: 60_000 }, async () => {
  const 무대 = 무대만들기('badline');
  try {
    await assert.rejects(
      구독.agy받기({ bin: 무대.bin, args: ['--model', 'm'], cwd: 무대.뿌리, input: 사용자줄('글'), env: 무대.env, 제한Ms: 30_000 }),
      /agy 출력 1번째 줄이 JSON이 아니다: 새 판이 있습니다/,
    );
    const [첫] = 무대.남긴것();
    assert.deepEqual(await 남은프로세스([첫.pid]), []);
  } finally {
    무대.치우기();
  }
});

test('기록은 지금까지와 같은 모양으로 만들고, 구조 응답·모델 대조·빈 답·실패 상태를 그대로 가린다', () => {
  const 고름 = { model: 'gemini-3.8-flash', thinking: 'high', selectedModel: 'gemini-3.8-flash-high' };
  const 구조 = 구독.기록만들기({ init: { model: 'gemini-3.8-flash-high' }, result: { status: 'SUCCESS', response: '무시', structured_output: { 지적: [] } } }, 고름);
  assert.equal(구조.text, '{"지적":[]}');
  assert.equal(구조.usage, null);
  assert.throws(() => 구독.기록만들기({ init: { model: 'gemini-3.8-flash-low' }, result: { status: 'SUCCESS', response: '답' } }, 고름), /고른 모델이 요청과 다르다/);
  assert.throws(() => 구독.기록만들기({ init: null, result: { status: 'SUCCESS', response: '  ' } }, 고름), /빈 답/);
  assert.throws(() => 구독.기록만들기({ init: null, result: { status: 'CANCELLED' } }, 고름), /agy 상태 CANCELLED: \(원인 없음\)/);
});
