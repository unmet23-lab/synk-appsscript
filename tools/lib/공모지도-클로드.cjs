'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const { spawn, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { atomicJson } = require('./backup-primitives.cjs');

const 확인한도 = 60000;
const 실행한도 = 150000;

function 실행환경(profile) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(CLAUDECODE$|CLAUDE_CODE_|CLAUDE_CONFIG_DIR$|ANTHROPIC_(API_KEY|AUTH_TOKEN|BASE_URL)$)/i.test(key)) {
      delete env[key];
    }
  }
  return {
    ...env,
    CLAUDE_CONFIG_DIR: profile,
    CLAUDE_CODE_ARTIFACT: '1',
    CLAUDE_CODE_ARTIFACT_PUBLISH_EDITS: '0',
  };
}

function 소유계정확인(cli, env, cwd, owner) {
  const result = spawnSync(cli, ['auth', 'status', '--json'], {
    cwd, env, encoding: 'utf8', windowsHide: true, timeout: 확인한도, stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) throw Error('Claude 소유 계정 확인에 실패했습니다. ' + result.error.code);
  let auth;
  try { if (result.status === 0) auth = JSON.parse(result.stdout); } catch { /* 로그인 정보를 읽지 못했다. */ }
  if (!auth?.loggedIn || auth.authMethod !== 'claude.ai' || auth.apiProvider !== 'firstParty' ||
      auth.email?.toLowerCase() !== owner.toLowerCase()) {
    throw Error('Claude 공모 지도의 소유 계정 로그인을 확인하지 못했습니다.');
  }
}

async function Artifact연결(cli, env, cwd, 작업) {
  const child = spawn(cli, ['mcp', 'serve'], { cwd, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = readline.createInterface({ input: child.stdout });
  const pending = new Map();
  let sequence = 0;
  let stopped;

  function 중단(error) {
    stopped = error;
    for (const call of pending.values()) call.reject(error);
    pending.clear();
  }

  function 전송(message) {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
  }

  function 요청(method, params) {
    if (stopped) return Promise.reject(stopped);
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      전송({ id, method, params });
    });
  }

  lines.on('line', (line) => {
    let response;
    try { response = JSON.parse(line); } catch { return; }
    const call = pending.get(response.id);
    if (!call) return;
    pending.delete(response.id);
    if (response.error) call.reject(Error('Claude Artifact 요청이 거절됐습니다. ' + response.error.code));
    else call.resolve(response.result);
  });
  child.stderr.resume();
  child.on('error', () => 중단(Error('Claude Artifact 실행기를 열지 못했습니다.')));
  child.stdin.on('error', () => 중단(Error('Claude Artifact 실행기 연결이 끊겼습니다.')));
  child.on('close', () => 중단(Error('Claude Artifact 실행기가 응답을 마치기 전에 종료됐습니다.')));
  const timer = setTimeout(() => 중단(Error('Claude Artifact 응답 시간이 초과됐습니다.')), 실행한도);

  try {
    await 요청('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'synk-contest-map', version: '1.0.0' },
    });
    전송({ method: 'notifications/initialized' });
    const list = await 요청('tools/list', {});
    const artifact = list?.tools?.find((tool) => tool.name === 'Artifact');
    if (!artifact?.inputSchema?.properties?.action?.enum?.includes('publish')) {
      throw Error('이 Claude Code 실행 환경에는 Artifact 게시 도구가 없습니다.');
    }
    return await 작업(async (action, args) => {
      const result = await 요청('tools/call', { name: 'Artifact', arguments: { action, ...args } });
      const content = result?.content?.find((block) => block.type === 'text')?.text;
      if (result?.isError) {
        const reason = content?.trim().replace(/\s+/g, ' ').slice(0, 320);
        throw Error('Claude Artifact ' + action + ' 요청이 실패했습니다.' + (reason ? ' ' + reason : ''));
      }
      if (!content) throw Error('Claude Artifact ' + action + ' 응답을 읽지 못했습니다.');
      return content;
    });
  } finally {
    clearTimeout(timer);
    lines.close();
    child.stdin.end();
    child.kill();
  }
}

function 지도본문(text) {
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
}

function 같은지도(remote, local) {
  // 같은 날에는 생성 시각만 바뀐 판을 다시 올릴 필요가 없다.
  const time = /^(const 자료 = \{"기준":)"[^"]*"/m;
  return remote.replace(time, '$1""').includes(local.replace(time, '$1""'));
}

function 게시판정보(response, profile) {
  let read;
  try { read = JSON.parse(response).read; } catch { /* Artifact 원문을 받지 못했다. */ }
  const header = String(read?.result || '').split('\n', 1)[0];
  const info = /^\[Artifact ([0-9a-f-]{36}) \(version ([\w-]+)\) — owned by you, private\b/i.exec(header);
  const sourceFile = / — full HTML saved to (.+?\.html) — /.exec(header)?.[1];
  if (read?.code !== 200 || !info || !sourceFile || !path.isAbsolute(sourceFile)) {
    throw Error('같은 소유 계정의 비공개 Claude 공모 지도 원문을 확인하지 못했습니다.');
  }
  const relative = path.relative(profile, sourceFile);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw Error('Claude 공모 지도의 원문 경로가 소유 계정 폴더를 벗어났습니다.');
  }
  return { id: info[1], version: info[2], html: 지도본문(fs.readFileSync(sourceFile, 'utf8')) };
}

function Claude결과(cli, args, env, cwd, timeout, input) {
  const child = spawn(cli, [...args, '--output-format', 'stream-json', '--verbose'], {
    cwd, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const lines = readline.createInterface({ input: child.stdout });
  child.stderr.resume();
  child.stdin.on('error', () => { /* 실행기가 먼저 끝나면 종료 이벤트가 결과를 전한다. */ });
  child.stdin.end(input);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(Error('Claude Code 결과 응답 시간이 초과됐습니다.'));
    }, timeout);
    lines.on('line', (line) => {
      let message;
      try { message = JSON.parse(line); } catch { return; }
      if (message?.type !== 'result') return;
      resolve({ parsed: message, ok: !message.is_error });
    });
    child.on('error', (error) => reject(Error('Claude Code 실행에 실패했습니다. ' + error.code)));
    child.on('close', () => {
      clearTimeout(timer);
      lines.close();
      reject(Error('Claude Code가 결과를 보내기 전에 종료됐습니다.'));
    });
  });
}

async function 구독확인(cli, env, cwd) {
  const { parsed, ok } = await Claude결과(cli, [
    '-p', '/usage', '--strict-mcp-config', '--no-session-persistence',
  ], env, cwd, 확인한도);
  const message = typeof parsed.result === 'string' ? parsed.result : '';
  const week = /^Current week \(all models\): (\d+)% used(?: · resets ([^\r\n]+))?/m.exec(message);
  if (!ok || !message.includes('using your subscription to power your Claude Code usage') || !week) {
    throw Error('Claude 구독과 주간 사용량을 확인하지 못했습니다.');
  }
  return Number(week[1]) >= 100 ? { status: 'deferred', reset: week[2] || '다음 주간 초기화' } : null;
}

function 한도초기화시각(label, now) {
  const m = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{1,2})(?::(\d{2}))?\s*(am|pm) \(Asia\/Seoul\)$/i.exec(label || '');
  if (!m) return null;
  const month = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ').indexOf(m[1].toLowerCase());
  const day = Number(m[2]), hour = Number(m[3]), minute = Number(m[4] || 0);
  if (day < 1 || day > 31 || hour < 1 || hour > 12 || minute > 59) return null;
  const year = new Date(now + 9 * 3600000).getUTCFullYear();
  const localHour = hour % 12 + (m[5].toLowerCase() === 'pm' ? 12 : 0);
  for (const y of [year, year + 1]) {
    const local = Date.UTC(y, month, day, localHour, minute);
    const reset = local - 9 * 3600000;
    if (new Date(local).getUTCDate() === day && reset > now && reset - now <= 8 * 86400000) return reset;
  }
  return null;
}

async function 게시한도확인(file, ownerKey, query, now = Date.now()) {
  let saved;
  try { saved = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* 처음이거나 읽지 못하면 구독의 현재 값을 확인한다. */ }
  const reset = 한도초기화시각(saved?.reset, now);
  if (saved?.key === ownerKey && reset && saved.checkedAt <= now && now - saved.checkedAt < 86400000) {
    return { status: 'deferred', reset: saved.reset, usageCheck: 'cached' };
  }
  const limit = await query();
  if (limit && 한도초기화시각(limit.reset, now)) {
    try { atomicJson(file, { key: ownerKey, checkedAt: now, reset: limit.reset }); } catch { /* 다음 회차에서 다시 조회한다. */ }
  }
  return limit;
}

function 예약허용(call, url, map) {
  const input = call?.tool_input;
  if (call?.tool_name !== 'Artifact' || !input || !url || !map || input.url !== url) return false;
  const keys = Object.keys(input);
  if (input.action === 'read') return keys.length === 2;
  return input.action === 'publish' && keys.length === 3 && typeof input.file_path === 'string' &&
    path.isAbsolute(input.file_path) && path.resolve(input.file_path).toLowerCase() === path.resolve(map).toLowerCase();
}

async function 예약게시(cli, env, cwd, url, map) {
  const settings = JSON.stringify({ hooks: { PreToolUse: [{
    matcher: '*',
    hooks: [{ type: 'command', command: process.execPath, args: [__filename, '--artifact-permission'], timeout: 10 }],
  }] } });
  const prompt = [
    'Use the Artifact tool to read the latest version of this existing private artifact in this same session:',
    url,
    'After a successful read, publish the exact local HTML below at that same URL using only action, url, and file_path:',
    map,
    'This is a file transfer. Do not rewrite, review, use force, change access, or create a new artifact. Stop on a refusal or version conflict.',
  ].join('\n');
  const { parsed, ok } = await Claude결과(cli, [
    '-p', '--model', 'haiku', '--tools', 'Artifact', '--permission-mode', 'dontAsk',
    '--strict-mcp-config', '--no-session-persistence', '--max-turns', '4',
    '--settings', settings,
  ], { ...env, SYNK_CONTEST_ARTIFACT_URL: url, SYNK_CONTEST_ARTIFACT_HTML: map }, cwd, 190000, prompt);
  if (ok) return null;
  const limit = /(?:weekly|usage) limit[^\n]*resets ([^\n]+)/i.exec(String(parsed.result || ''));
  if (limit) return { status: 'deferred', reset: limit[1] };
  throw Error('Claude Code가 기존 공모 지도 게시 작업을 마치지 못했습니다.');
}

async function 클로드지도갱신(config, map, observe) {
  const target = new URL(config.artifact_url);
  const { profile, owner } = config.artifact_sync || {};
  if (!/^https:\/\/claude\.ai\/(?:code\/)?artifact\/[\w-]+$/.test(target.href) ||
      typeof profile !== 'string' || !path.isAbsolute(profile) || typeof owner !== 'string' || !owner.includes('@')) {
    throw Error('공모지도.json의 비공개 Claude 지도 설정을 확인해 주세요.');
  }
  const source = 지도본문(fs.readFileSync(map, 'utf8'));
  if (!source.includes('<title>공모 지도</title>') || !/^const 자료 = \{.+\};$/m.test(source)) {
    throw Error('PC 공모 지도 HTML이 올바르지 않습니다.');
  }
  const cwd = path.dirname(map);
  const env = 실행환경(profile);
  const cli = path.join(os.homedir(), '.local', 'bin', 'claude.exe');
  const url = target.href;
  소유계정확인(cli, env, cwd, owner);
  const live = () => Artifact연결(cli, env, cwd, async (call) => 게시판정보(await call('read', { url }), profile));
  const old = await live();
  observe?.(old.html, old.version);
  if (같은지도(old.html, source)) return { status: 'current', version: old.version };

  const ownerKey = createHash('sha256').update(JSON.stringify([url, path.resolve(profile), owner.toLowerCase()])).digest('hex');
  const cache = path.join(cwd, '그록공모전', '웹게시한도.json');
  const deferred = await 게시한도확인(cache, ownerKey, () => 구독확인(cli, env, cwd)) || await 예약게시(cli, env, cwd, url, map);
  if (deferred) return deferred;
  const updated = await live();
  if (updated.id !== old.id || updated.version === old.version || !updated.html.includes(source)) {
    throw Error('동일한 비공개 Claude 주소에서 새 지도 원문을 확인하지 못했습니다.');
  }
  observe?.(updated.html, updated.version);
  return { status: 'updated', version: updated.version };
}

if (require.main === module && process.argv[2] === '--artifact-permission') {
  let call;
  try { call = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { /* 잘못된 입력은 거절한다. */ }
  const permit = 예약허용(call, process.env.SYNK_CONTEST_ARTIFACT_URL, process.env.SYNK_CONTEST_ARTIFACT_HTML);
  console.log(JSON.stringify({ hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: permit ? 'allow' : 'deny',
    permissionDecisionReason: '이 회차는 같은 비공개 공모 지도 읽기와 생성한 HTML 게시만 허용합니다.',
  } }));
}

module.exports = { 클로드지도갱신, 게시한도확인 };
