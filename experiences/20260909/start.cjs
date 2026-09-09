'use strict';
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

function probeHealth(port) {
  return new Promise(resolve => {
    let settled = false;
    const finish = status => { if (!settled) { settled = true; resolve(status); } };
    const request = http.get({ hostname: '127.0.0.1', port, path: '/api/health', timeout: 1000 }, response => {
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 8192) { finish('occupied'); response.destroy(); }
        else chunks.push(chunk);
      });
      response.on('error', () => finish('occupied'));
      response.on('end', () => {
        try {
          const health = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          finish(response.statusCode === 200 && health.ok === true && health.mode === 'local-preview' && health.episode === 'last-light-v1' ? 'ready' : 'occupied');
        } catch { finish('occupied'); }
      });
    });
    request.on('timeout', () => { finish('occupied'); request.destroy(); });
    request.on('error', error => finish(error.code === 'ECONNREFUSED' ? 'free' : 'occupied'));
  });
}

async function startPreview({ port = 4399, timeoutMs = 8000 } = {}) {
  if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('Node.js 20 이상이 필요합니다. 현재 Node.js를 업데이트한 뒤 다시 실행해 주세요.');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('포트는 1~65535 사이의 정수여야 합니다. 예: node start.cjs --port=4409');
  const url = `http://127.0.0.1:${port}/`;
  const firstStatus = await probeHealth(port);
  if (firstStatus === 'ready') return { url, alreadyRunning: true };
  const occupiedError = () => new Error(`${port}번 포트에서 다른 프로그램이 응답하거나 상태를 확인할 수 없습니다. 기존 프로그램은 종료하지 않았습니다. 다른 번호로 실행해 주세요: node start.cjs --port=4409`);
  if (firstStatus === 'occupied') throw occupiedError();

  const child = spawn(process.execPath, [path.join(__dirname, 'server.cjs'), `--port=${port}`], {
    cwd: __dirname, detached: true, windowsHide: true, stdio: 'ignore',
  });
  let childExit;
  child.once('exit', (code, signal) => { childExit = { code, signal }; });
  await new Promise((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', reject);
  });
  child.unref();

  const deadline = Date.now() + timeoutMs;
  do {
    const status = await probeHealth(port);
    if (status === 'ready') return { url, alreadyRunning: false, pid: child.pid };
    if (status === 'occupied') throw occupiedError();
    if (childExit) throw new Error(`체험 서버가 시작되지 않았습니다. 자세히 확인하려면 이 폴더에서 node server.cjs --port=${port} 를 실행해 주세요.`);
    await new Promise(resolve => setTimeout(resolve, 150));
  } while (Date.now() < deadline);
  throw new Error(`체험 서버의 준비 완료를 확인하지 못했습니다. 잠시 뒤 다시 실행하거나, 이 폴더에서 node server.cjs --port=${port} 로 오류를 확인해 주세요.`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && !/^--port=\d+$/.test(args[0]))) throw new Error('사용법: node start.cjs 또는 node start.cjs --port=4409');
  const result = await startPreview({ port: args.length ? Number(args[0].slice(7)) : 4399 });
  process.stdout.write(`${result.alreadyRunning ? '이미 실행 중인 SYNK 체험을 사용합니다.' : 'SYNK 체험 서버가 준비되었습니다.'}\n${result.url}\n\n이 창을 닫아도 체험 서버는 계속 실행됩니다. 컴퓨터를 다시 켠 뒤에는 체험열기.cmd를 다시 실행해 주세요.\n`);
}

if (require.main === module) main().catch(error => { process.stderr.write(`체험을 열 수 없습니다: ${error.message}\n`); process.exitCode = 1; });
module.exports = { startPreview, probeHealth };
