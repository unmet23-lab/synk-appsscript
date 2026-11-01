'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function identity(target) {
  if (!/^telegram:[1-9][0-9]*$/.test(target)) throw new Error('등록 실패 알림은 기존 Telegram 개인 대화로만 보낸다');
  const file = path.join(process.env.SYNK_HERMES_HOME || path.join(process.env.LOCALAPPDATA, 'hermes'), '.env');
  const line = /^\s*(?:export\s+)?TELEGRAM_BOT_TOKEN\s*=\s*(.*?)\s*$/m.exec(fs.readFileSync(file, 'utf8'));
  const token = line?.[1].replace(/^(['"])(.*)\1$/, '$2');
  const botId = /^([1-9][0-9]*):[A-Za-z0-9_-]{20,}$/.exec(token || '')?.[1];
  if (!botId) throw new Error('기존 Telegram 봇 설정을 확인하지 못했다');
  return { botId, target };
}
function run(request, { spawn = spawnSync } = {}) {
  const root = path.join(os.homedir(), '.synk', 'telegram-mtproto', 'venv');
  const python = process.env.SYNK_TELEGRAM_PYTHON || path.join(root, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const r = spawn(python, ['-I', '-X', 'utf8', '-B', path.join(__dirname, 'telegram-mtproto.py')], {
    input: JSON.stringify(request), encoding: 'utf8', windowsHide: true, timeout: 150000, maxBuffer: 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1' },
  });
  let result;
  try { result = JSON.parse(r.stdout || ''); } catch { /* 비밀값이 섞일 수 있는 원본 출력은 오류에 넣지 않는다. */ }
  if (r.status !== 0 || result?.ok !== true) {
    const code = /^[A-Z][A-Z0-9_]{0,60}$/.test(result?.code || '') ? result.code : 'MTPROTO_WORKER_UNAVAILABLE';
    const retryAfter = Number.isSafeInteger(result?.retryAfter) && result.retryAfter > 0 ? result.retryAfter : 0;
    throw Object.assign(new Error(`알림은 전송 대기 기록에 남아 있다 (${code})`), { code, retryAfter });
  }
  if (result.botId !== request.botId || result.target !== request.target
    || (request.mode === 'send' && (!/^[1-9][0-9]*$/.test(result.messageId || '') || result.randomId !== request.randomId))) {
    throw new Error('Telegram의 전송 확인 결과가 알림의 계정·대상·ID와 다르다');
  }
  return result;
}
function send(text, delivery, options) {
  const { botId, target, randomId } = delivery;
  return run({ mode: 'send', text, botId, target, randomId }, options);
}
function check(target, options) { return run({ mode: 'check', ...identity(target) }, options); }
module.exports = { identity, send, check };
