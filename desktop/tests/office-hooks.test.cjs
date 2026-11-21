'use strict';
// 솔리오 「사무실」의 훅 받는 서버와 Claude Code 설정 파일 고치기(src/office-hooks.cjs, 구현설계.md 12.2 · 12.3 · 14.1의 office-hooks).
// 설정 폴더와 userData는 모두 임시 폴더다. 서버는 127.0.0.1의 실제 포트에서 돈다. 이 PC의 실제 ~/.claude와 %APPDATA%\SYNK Desktop은 건드리지 않는다(맨 끝 시험이 본다).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const {
  createOfficeHooks, runUnhook, isMarked, stripMarked, hookEvent, toolDetailOf, overrideDirs, hookUrl, EVENTS, OVERRIDE_ENV, BODY_MAX, SETTINGS_MAX, SILENT_MS, PATH_PREFIX, UNHOOK_EXIT, UNHOOK_WAIT_MS,
} = require('../src/office-hooks.cjs');

const APPDATA_SYNK = process.env.APPDATA ? path.join(process.env.APPDATA, 'SYNK Desktop') : null;
/* 시험이 만든 임시 폴더. 끝나면 지운다(GPT 검수 r9 GA5) */
const made = [];
test.after(() => { for (const d of made) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* 이미 없다 */ } } });
/* 모듈이 파일을 쓰는 자리를 모두 적는 fs(GPT 검수 r9 GA4). 이 PC의 실제 설정과 앱 폴더를 앞뒤 시각으로 견주면, 시험 도중 실제 앱이 쓴 것까지 실패로 센다.
   대신 모듈이 쓴 자리가 모두 시험의 임시 폴더 안인지 맨 끝 시험이 본다. 시험이 넘긴 fs(끼어드는 fs)도 이 감시로 싼다.
   이름 바꾸기와 사본 만들기는 떠나는 자리와 닿는 자리를 둘 다 적는다(GPT 검수 r10 GA3) */
const writes = [];
const WRITERS = ['writeFile', 'appendFile', 'rename', 'unlink', 'mkdir', 'rm', 'rmdir', 'copyFile'];
function guard(base = fs) {
  const p = base.promises || {};
  const out = { ...base, promises: { ...p } };
  for (const name of WRITERS) {
    const real = typeof p[name] === 'function' ? p[name].bind(p) : fs.promises[name].bind(fs.promises);
    out.promises[name] = (...args) => {
      if (name === 'rename' || name === 'copyFile') writes.push(String(args[0]), String(args[1])); else writes.push(String(args[0]));
      return real(...args);
    };
  }
  return out;
}
const guardedFs = guard(fs);

const S1 = '00000001-0000-4000-8000-000000000001';
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'office-hooks-')); made.push(d); return d; };
const read = f => fs.readFileSync(f, 'utf8');
const json = f => JSON.parse(read(f));
const settingsOf = dir => path.join(dir, 'settings.json');
const filesIn = dir => fs.readdirSync(dir).sort();
const marked = settings => Object.entries(settings.hooks || {}).flatMap(([event, groups]) => (Array.isArray(groups) ? groups : []).flatMap(g => (g.hooks || []).filter(isMarked).map(h => [event, h.url])));
const settle = () => new Promise(r => setTimeout(r, 30));

function setup({ dirs = 1, installed = false, override = true, accepts = () => true, files = {}, fsImpl = fs, ...rest } = {}) {
  const top = tmp();
  const userData = path.join(top, 'userData');
  const list = Array.from({ length: dirs }, (_, i) => path.join(top, 'claude' + i));
  for (const d of list) fs.mkdirSync(d, { recursive: true });
  for (const [i, text] of Object.entries(files)) fs.writeFileSync(settingsOf(list[i]), text);
  const delivered = [], changes = { n: 0 };
  const env = override ? { [OVERRIDE_ENV]: list.join(path.delimiter) } : {};
  const hooks = createOfficeHooks({ userData, installed, env, accepts, deliver: e => delivered.push(e), onChange: () => { changes.n += 1; }, baseDirs: () => [], listenRetries: 0, ...rest, fsImpl: guard(fsImpl) });
  return { top, userData, dirs: list, hooks, delivered, changes, state: () => json(path.join(userData, 'Office', 'hooks.json')) };
}
function post(port, urlPath, body, { headers = {}, method = 'POST' } = {}) {
  return new Promise(resolve => {
    const data = body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const req = http.request({ host: '127.0.0.1', port, path: urlPath, method, headers: { ...(data && !headers['transfer-encoding'] ? { 'content-length': data.length } : {}), 'content-type': 'application/json', ...headers } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', e => resolve(e.code || 'ERROR'));
    if (data) req.write(data);
    req.end();
  });
}
const where = f => { const st = f.state(); return { port: st.port, path: PATH_PREFIX + st.token }; };
const toolUse = extra => ({ hook_event_name: 'PostToolUse', session_id: S1, cwd: 'C:\\work\\shop', transcript_path: 'C:\\x.jsonl', permission_mode: 'default', prompt_id: 'p1', tool_use_id: 't1', duration_ms: 9, ...extra });

/* ── 받는 서버(12.2) ── */
test('the server binds 127.0.0.1 only; a wrong token, a GET, a body over 2 MB, a non-JSON body and an unknown event are dropped', async () => {
  const f = setup();
  assert.equal((await f.hooks.enable([])).ok, true);
  const { port, path: p } = where(f);
  assert.equal(f.hooks.address().address, '127.0.0.1', 'bound to the loopback address only');
  assert.equal(f.hooks.address().port, port);
  assert.equal(await post(port, PATH_PREFIX + 'wrong-token-' + 'x'.repeat(40), toolUse({ tool_name: 'Read' })), 404);
  assert.equal(await post(port, p + 'x', toolUse({ tool_name: 'Read' })), 404, 'a longer path is not the token');
  assert.equal(await post(port, p + '?a=1', toolUse({ tool_name: 'Read' })), 404, 'a query is not the token');
  assert.equal(await post(port, p, null, { method: 'GET' }), 404);
  assert.equal(await post(port, p, 'not json'), 204, 'the hook gets a quick answer');
  assert.equal(await post(port, p, { hook_event_name: 'UserPromptSubmit', session_id: S1, prompt: '손님이 친 글' }), 204);
  assert.equal(await post(port, p, { hook_event_name: 'SessionStart', session_id: S1 }), 204, 'SessionStart is not written, so it is not taken either');
  assert.equal(await post(port, p, { hook_event_name: 'Stop' }), 204, 'no session id');
  const big = await post(port, p, Buffer.alloc(BODY_MAX + 1, 0x20));
  assert.ok(big === 413 || big === 'ECONNRESET' || big === 'EPIPE', `a declared body over 2 MB is refused unread (${big})`);
  // 길이를 미리 말하지 않고 2MB를 넘겨 보내는 몸
  const streamed = await new Promise(resolve => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method: 'POST', headers: { 'transfer-encoding': 'chunked' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', e => resolve(e.code));
    const chunk = Buffer.alloc(256 * 1024, 0x20);
    let sent = 0;
    const pump = () => { while (sent <= BODY_MAX + chunk.length) { sent += chunk.length; if (!req.write(chunk)) { req.once('drain', pump); return; } } req.end(); };
    pump();
  });
  assert.ok(streamed === 413 || streamed === 'ECONNRESET' || streamed === 'EPIPE', `a streamed body over 2 MB is cut (${streamed})`);
  await settle();
  assert.deepEqual(f.delivered, [], 'nothing was folded');
  assert.equal(await post(port, p, toolUse({ tool_name: 'Read', tool_input: { file_path: 'C:\\work\\shop\\src\\auth.ts' } })), 204);
  await settle();
  assert.equal(f.delivered.length, 1, 'the server still takes good news after the refusals');
  await f.hooks.close();
});

test('only the agreed values are kept: no command text, file contents, tool result or last message; nothing is written to disk from news', async () => {
  const f = setup();
  await f.hooks.enable([]);
  const { port, path: p } = where(f);
  const before = { state: read(path.join(f.userData, 'Office', 'hooks.json')), office: filesIn(path.join(f.userData, 'Office')), dir: filesIn(f.dirs[0]), settings: read(settingsOf(f.dirs[0])) };
  const t0 = Date.now();
  await post(port, p, toolUse({ tool_name: 'Bash', tool_input: { command: 'npm test -- --token=sk-secret-123', description: '시험 돌리기' }, tool_response: { stdout: '비밀 결과 secret-output' } }));
  await post(port, p, toolUse({ tool_name: 'PowerShell', tool_input: { command: 'API_KEY=sk-live-999 node x.js' } }));
  await post(port, p, toolUse({ tool_name: 'Bash', tool_input: { command: '"C:\\Program Files\\Git\\bin\\git.exe" status' } }));
  await post(port, p, toolUse({ tool_name: 'Edit', tool_input: { file_path: 'C:\\work\\shop\\src\\비밀계획.md', old_string: '옛 글', new_string: '새 글 secret-edit' }, agent_id: 'agent-7', agent_type: 'Explore' }));
  await post(port, p, toolUse({ tool_name: 'Grep', tool_input: { pattern: 'password', path: 'C:\\work\\shop\\src\\' } }));
  await post(port, p, toolUse({ tool_name: 'mcp__x__read', tool_input: { path: 'C:\\private\\diary.txt' } }));
  await post(port, p, { hook_event_name: 'Notification', session_id: S1, cwd: 'C:\\work\\shop', notification_type: 'permission_prompt', message: 'Claude needs your permission to use Bash rm -rf' });
  await post(port, p, { hook_event_name: 'Stop', session_id: S1, cwd: 'C:\\work\\shop', last_assistant_message: '마지막 답 secret-answer', stop_hook_active: false, background_tasks: [] });
  await post(port, p, { hook_event_name: 'SubagentStart', session_id: S1, cwd: 'C:\\work\\shop', agent_id: 'agent-7', agent_type: 'Explore' });
  await post(port, p, { hook_event_name: 'SubagentStop', session_id: S1, cwd: 'C:\\work\\shop', agent_id: 'agent-7', agent_transcript_path: 'C:\\a.jsonl', last_assistant_message: 'secret-sub' });
  await post(port, p, { hook_event_name: 'SessionEnd', session_id: S1, cwd: 'C:\\work\\shop', reason: 'other' });
  await settle();
  const text = JSON.stringify(f.delivered);
  for (const word of ['secret', 'sk-', '비밀 결과', '옛 글', '새 글', 'password', 'diary', 'rm -rf', '마지막 답', 'transcript', 'C:\\x.jsonl', 'Explore', 'permission to use']) assert.ok(!text.includes(word), word);
  assert.deepEqual(f.delivered.map(e => [e.event, e.toolName ?? null, e.toolDetail ?? null, e.notificationType ?? null, e.agentId ?? null]), [
    ['PostToolUse', 'Bash', 'npm', null, null],
    ['PostToolUse', 'PowerShell', null, null, null],
    ['PostToolUse', 'Bash', 'git.exe', null, null],
    ['PostToolUse', 'Edit', '비밀계획.md', null, 'agent-7'],
    ['PostToolUse', 'Grep', 'src', null, null],
    ['PostToolUse', 'mcp__x__read', null, null, null],
    ['Notification', null, null, 'permission_prompt', null],
    ['Stop', null, null, null, null],
    ['SubagentStart', null, null, null, 'agent-7'],
    ['SubagentStop', null, null, null, 'agent-7'],
    ['SessionEnd', null, null, null, null],
  ]);
  for (const e of f.delivered) {
    assert.deepEqual(Object.keys(e).filter(k => !['kind', 'event', 'sessionId', 'cwd', 'at', 'toolName', 'toolDetail', 'notificationType', 'agentId'].includes(k)), [], 'no other field');
    assert.equal(e.kind, 'hook');
    assert.equal(e.sessionId, S1);
    assert.ok(e.at >= t0 && e.at <= Date.now(), 'the time is when Solio received it');
  }
  assert.equal(f.delivered[3].toolDetail, '비밀계획.md', 'a file tool keeps only the last part of the path');
  assert.deepEqual({ state: read(path.join(f.userData, 'Office', 'hooks.json')), office: filesIn(path.join(f.userData, 'Office')), dir: filesIn(f.dirs[0]), settings: read(settingsOf(f.dirs[0])) }, before, 'no file was written or changed by the news');
  assert.equal(toolDetailOf('Bash', { command: 'FOO=bar npm run x' }), null, 'an assignment as the first word is not kept');
  assert.equal(toolDetailOf('Read', { file_path: 'C:\\a\\b\\' }), 'b');
  assert.equal(toolDetailOf('WebFetch', { url: 'https://example.com/secret' }), null, 'other tools carry no detail');
  assert.equal(hookEvent({ hook_event_name: 'Stop', session_id: 'x'.repeat(200) }, 1), null, 'an overlong session id is refused');
  await f.hooks.close();
});

test('with no viewer signed in the body is not read and nothing is folded; the server stays open', async () => {
  let viewer = false, asked = 0;
  const f = setup({ accepts: () => { asked += 1; return viewer; } });
  await f.hooks.enable([]);
  const { port, path: p } = where(f);
  assert.equal(await post(port, p, toolUse({ tool_name: 'Read', tool_input: { file_path: 'C:\\a\\b.ts' } })), 204);
  assert.equal(await post(port, p, 'not json either'), 204);
  await settle();
  assert.deepEqual(f.delivered, []);
  assert.equal(asked, 2, 'the viewer is asked before the body is read');
  assert.equal(f.hooks.listening(), true, 'the server stays open while hooks are on');
  viewer = true;
  await post(port, p, toolUse({ tool_name: 'Read', tool_input: { file_path: 'C:\\a\\b.ts' } }));
  await settle();
  assert.equal(f.delivered.length, 1);
  // 묻다가 실패해도 읽지 않는다
  const g = setup({ accepts: () => { throw new Error('auth not ready'); } });
  await g.hooks.enable([]);
  assert.equal(await post(where(g).port, where(g).path, toolUse({ tool_name: 'Read' })), 204);
  await settle();
  assert.deepEqual(g.delivered, []);
  await f.hooks.close(); await g.hooks.close();
});

/* ── 설정 파일(12.3) ── */
test('enabling writes six http lines (no matcher, 2 s timeout) into each settings.json, keeps env and other hooks, and appends to an event that already has one', async () => {
  const theirs = { env: { ANTHROPIC_API_KEY: 'sk-ant-keep-this', N: '1' }, permissions: { allow: ['Bash(npm test)'] }, model: 'opus',
    hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'prettier --write' }] }], PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'guard.sh' }] }] }, '__proto__': { kept: true } };
  const text = '{\n    "env": ' + JSON.stringify(theirs.env) + ',\n    "permissions": ' + JSON.stringify(theirs.permissions) + ',\n    "model": "opus",\n    "hooks": ' + JSON.stringify(theirs.hooks) + ',\n    "__proto__": {"kept": true}\n}\n';
  const f = setup({ files: { 0: text } });
  const r = await f.hooks.enable([]);
  assert.deepEqual([r.ok, r.written, r.created, r.refused], [true, 1, 0, 0]);
  const { port } = where(f);
  const after = json(settingsOf(f.dirs[0]));
  assert.deepEqual(after.env, theirs.env, 'env is kept as it was');
  assert.deepEqual(after.permissions, theirs.permissions);
  assert.equal(after.model, 'opus');
  assert.ok(Object.prototype.hasOwnProperty.call(after, '__proto__'), 'an odd key stays a key');
  assert.deepEqual(Object.keys(after), ['env', 'permissions', 'model', 'hooks', '__proto__'], 'key order is kept');
  assert.deepEqual(after.hooks.PreToolUse, theirs.hooks.PreToolUse, 'a hook kind Solio does not use is untouched');
  assert.deepEqual(after.hooks.PostToolUse[0], theirs.hooks.PostToolUse[0], 'their PostToolUse stays first');
  const url = hookUrl(port, f.state().token);
  for (const event of EVENTS) assert.deepEqual(after.hooks[event].at(-1), { hooks: [{ type: 'http', url, timeout: 2 }] }, event);
  assert.deepEqual(Object.keys(after.hooks), ['PostToolUse', 'PreToolUse', 'Notification', 'Stop', 'SubagentStart', 'SubagentStop', 'SessionEnd']);
  assert.ok(!Object.keys(after.hooks).includes('SessionStart') && !Object.keys(after.hooks).includes('UserPromptSubmit'));
  assert.match(read(settingsOf(f.dirs[0])), /^\{\n {4}"env"/, 'the file keeps its four-space indent');
  assert.deepEqual(filesIn(f.dirs[0]), ['settings.json'], 'no backup or temp file is left');
  const st = f.state();
  assert.equal(st.enabled, true);
  assert.deepEqual(st.dirs, [f.dirs[0]]);
  assert.match(st.token, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(port >= 30000 && port <= 48999, 'the port is chosen below the Windows outgoing range');
  assert.equal(fs.existsSync(path.join(f.userData, 'desktop-preferences.json')), false, 'nothing goes into desktop-preferences.json');
  await f.hooks.close();
});

test('a missing settings.json in an existing folder is made with only Solio\'s lines; a missing folder is skipped; broken JSON and comments are refused untouched', async () => {
  const broken = '{ "env": { "A": "1" }, ';
  const commented = '{\n  // 내 설정\n  "env": { "A": "1" }\n}\n';
  const f = setup({ dirs: 4, files: { 1: broken, 2: commented } });
  fs.rmSync(f.dirs[3], { recursive: true });
  let status = await f.hooks.status([]);
  assert.deepEqual(status.dirs.map(d => [d.folder, d.file, d.on]), [[true, false, false], [true, true, false], [true, true, false], [false, false, false]], 'the plan says which file is new and which folder is missing');
  const r = await f.hooks.enable([]);
  assert.deepEqual([r.ok, r.code, r.written, r.created, r.refused], [true, 'READ', 1, 1, 2]);
  assert.deepEqual(Object.keys(json(settingsOf(f.dirs[0]))), ['hooks']);
  assert.deepEqual(marked(json(settingsOf(f.dirs[0]))).map(([e]) => e), EVENTS);
  assert.equal(read(settingsOf(f.dirs[1])), broken, 'broken JSON is left as it was');
  assert.equal(read(settingsOf(f.dirs[2])), commented, 'a file with comments is left as it was');
  assert.equal(fs.existsSync(f.dirs[3]), false, 'a missing folder is not made');
  assert.deepEqual(filesIn(f.dirs[1]), ['settings.json']);
  status = await f.hooks.status([]);
  assert.deepEqual(status.dirs.map(d => [d.on, d.code]), [[true, null], [false, 'READ'], [false, 'READ'], [false, null]]);
  assert.deepEqual(f.state().dirs, [f.dirs[0]], 'only the written folder is recorded');
  // 고칠 폴더가 하나도 없으면 켜지 않고 서버도 닫는다
  const g = setup({ files: { 0: broken } });
  const none = await g.hooks.enable([]);
  assert.deepEqual([none.ok, none.code], [false, 'READ']);
  assert.equal(g.hooks.listening(), false);
  assert.equal((await g.hooks.status([])).on, false);
  await f.hooks.close();
});

test('enabling twice leaves one set, old lines with another port or token are taken out first, and turning off removes only the marked lines', async () => {
  const foreign = [
    { type: 'command', command: 'node C:\\tools\\synk-office\\log.js /synk-office/x' }, // 글자만 든 손님의 명령 훅
    { type: 'http', url: 'http://localhost:4000/synk-office/abc' }, // 다른 주소
    { type: 'http', url: 'http://127.0.0.1:4000/other/synk-office/abc' }, // 길이 다르다
    { type: 'http', url: 'http://127.0.0.2:4000/synk-office/abc' },
  ];
  const stale = { type: 'http', url: 'http://127.0.0.1:41234/synk-office/OLDTOKENOLDTOKENOLDTOKENOLDTOKEN', timeout: 2 };
  const text = JSON.stringify({ hooks: { Stop: [{ hooks: [...foreign] }, { hooks: [stale] }], PostToolUse: [{ matcher: '*', hooks: [stale, { type: 'command', command: 'mine.sh' }] }] } }, null, 2) + '\n';
  const f = setup({ files: { 0: text } });
  await f.hooks.enable([]);
  await f.hooks.enable([]);
  const s = json(settingsOf(f.dirs[0]));
  const url = hookUrl(f.state().port, f.state().token);
  assert.deepEqual(marked(s).map(([, u]) => u), EVENTS.map(() => url), 'one set with the current place only');
  assert.deepEqual(s.hooks.Stop[0].hooks, foreign, 'look-alikes are not Solio\'s');
  assert.deepEqual(s.hooks.PostToolUse[0], { matcher: '*', hooks: [{ type: 'command', command: 'mine.sh' }] }, 'their hook in a shared group stays, only the old line goes');
  assert.equal(s.hooks.Stop.length, 2, 'the group that held only the old line is gone, Solio\'s new group is last');
  const off = await f.hooks.disable();
  assert.equal(off.ok, true);
  const back = json(settingsOf(f.dirs[0]));
  assert.deepEqual(marked(back), []);
  assert.deepEqual(back, { hooks: { Stop: [{ hooks: foreign }], PostToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: 'mine.sh' }] }] } });
  assert.equal(f.hooks.listening(), false, 'the server closes when hooks are off');
  assert.deepEqual([f.state().enabled, f.state().dirs], [false, []]);
  // 빈 배열과 빈 hooks는 솔리오가 걷어 내서 빈 것만 지운다. 손님이 둔 빈 배열은 솔리오의 줄이 없으면 그대로다
  const g = setup({ files: { 0: JSON.stringify({ env: {}, hooks: { Stop: [], PreToolUse: [] } }) } });
  await g.hooks.disable();
  assert.deepEqual(json(settingsOf(g.dirs[0])), { env: {}, hooks: { Stop: [], PreToolUse: [] } }, 'nothing of Solio\'s: untouched');
  await g.hooks.enable([]);
  await g.hooks.disable();
  assert.deepEqual(json(settingsOf(g.dirs[0])), { env: {}, hooks: { PreToolUse: [] } }, 'Stop held only Solio\'s line, so its emptied array goes; PreToolUse was never Solio\'s');
  const h = setup({ files: { 0: JSON.stringify({ env: {} }) } });
  await h.hooks.enable([]);
  await h.hooks.disable();
  assert.deepEqual(json(settingsOf(h.dirs[0])), { env: {} }, 'the hooks key Solio made is gone again');
  // 바뀔 것이 없으면 쓰지 않는다
  const quiet = setup({ files: { 0: '{"env":{}}' } });
  const m = fs.statSync(settingsOf(quiet.dirs[0])).mtimeMs;
  await new Promise(r => setTimeout(r, 20));
  await quiet.hooks.disable();
  assert.equal(fs.statSync(settingsOf(quiet.dirs[0])).mtimeMs, m, 'turning off where Solio wrote nothing does not write');
  assert.equal(read(settingsOf(quiet.dirs[0])), '{"env":{}}');
});

/* 읽고 쓰는 사이를 흉내 내는 파일 다리. 실제 fs를 그대로 쓰고, 정한 때에 한 번 끼어든다 */
function racingFs({ onRead = null, onRename = null } = {}) {
  const p = fs.promises;
  let reads = 0, renames = 0;
  return { promises: { ...p,
    readFile: async (file, ...a) => { const out = await p.readFile(file, ...a); if (onRead && String(file).endsWith('settings.json')) await onRead(++reads, file); return out; },
    rename: async (from, to) => { await p.rename(from, to); if (onRename && String(to).endsWith('settings.json')) await onRename(++renames, to); },
  } };
}

test('a change between reading and writing is never overwritten: one retry, then 「바뀌는 중」 with their change kept', async () => {
  const start = JSON.stringify({ env: { A: '1' } }, null, 2) + '\n';
  // 첫 번째 읽기 뒤에 한 번 바뀐다: 다시 해서 쓴다
  let f = setup({ files: { 0: start }, fsImpl: racingFs({ onRead: async (n, file) => { if (n === 1) fs.writeFileSync(file, JSON.stringify({ env: { A: '2' } })); } }) });
  let r = await f.hooks.enable([]);
  assert.equal(r.ok, true);
  let s = json(settingsOf(f.dirs[0]));
  assert.deepEqual(s.env, { A: '2' }, 'their change is kept');
  assert.equal(marked(s).length, 6);
  await f.hooks.close();
  // 읽을 때마다 바뀐다: 두 번 해 보고 그만둔다
  f = setup({ files: { 0: start }, fsImpl: racingFs({ onRead: async (n, file) => { if (n % 2 === 1) fs.writeFileSync(file, JSON.stringify({ env: { A: 'other-' + n } })); } }) });
  r = await f.hooks.enable([]);
  assert.deepEqual([r.ok, r.code], [false, 'BUSY']);
  s = json(settingsOf(f.dirs[0]));
  assert.equal(marked(s).length, 0, 'Solio did not write');
  assert.match(s.env.A, /^other-/);
  assert.deepEqual(filesIn(f.dirs[0]), ['settings.json']);
});

test('after the write: another program\'s edit is never rolled back or overwritten, and no copy of the old content is ever made (설계 검토 solio-office-hooks 고칠 것 1)', async () => {
  const start = JSON.stringify({ env: { SECRET: 'keep' } }, null, 2) + '\n';
  // 쓴 바로 뒤에 다른 도구가 솔리오의 줄을 남긴 채 고친다: 그 내용에 솔리오의 줄이 있으므로 확인된 것으로 센다. 남의 바뀜은 그대로다
  let copySeen = false;
  let f = setup({ files: { 0: start }, fsImpl: racingFs({ onRename: async (n, file) => {
    copySeen = copySeen || fs.readdirSync(path.dirname(file)).some(x => /synk-backup/.test(x));
    if (n === 1) { const v = JSON.parse(fs.readFileSync(file, 'utf8')); v.theme = 'dark'; fs.writeFileSync(file, JSON.stringify(v)); }
  } }) });
  let r = await f.hooks.enable([]);
  assert.equal(r.ok, true);
  let s = json(settingsOf(f.dirs[0]));
  assert.equal(s.theme, 'dark', 'the other program\'s change stays');
  assert.equal(marked(s).length, 6, 'Solio\'s lines are there');
  assert.equal(copySeen, false, 'no copy of the old content (with its env) is made');
  assert.deepEqual(filesIn(f.dirs[0]), ['settings.json']);
  await f.hooks.close();
  // 쓴 바로 뒤에 남이 쓰다 만 파일(깨진 JSON)이 된다: 되돌리지 않고 손대지 않는다. 켜지 않고, 그 폴더는 줄이 없음을 확인하지 못해 남는다
  f = setup({ files: { 0: start }, fsImpl: racingFs({ onRename: async (n, file) => { if (n === 1) fs.writeFileSync(file, '{ "half'); } }) });
  r = await f.hooks.enable([]);
  assert.deepEqual([r.ok, r.code], [false, 'UNCONFIRMED']);
  assert.equal(read(settingsOf(f.dirs[0])), '{ "half', 'the other program\'s bytes are left as they are');
  assert.deepEqual(filesIn(f.dirs[0]), ['settings.json']);
  assert.deepEqual([f.state().enabled, f.state().dirs], [false, [f.dirs[0]]], 'not accepting; the folder stays recorded');
  assert.equal(f.hooks.listening(), true, 'the port stays held while a folder may still point at it');
  assert.equal((await f.hooks.status([])).left, true, 'the screen offers to remove again');
  await f.hooks.close();
});

/* ── 포트(12.3 「포트가 바뀔 때」) ── */
test('at start, a saved port held by another program removes Solio\'s lines at once without asking, and does not write new ones', async () => {
  const f = setup();
  await f.hooks.enable([]);
  const st = f.state();
  await f.hooks.close();
  const other = net.createServer();
  await new Promise(r => other.listen({ host: '127.0.0.1', port: st.port }, r));
  try {
    const again = createOfficeHooks({ fsImpl: guardedFs, userData: f.userData, installed: false, env: { [OVERRIDE_ENV]: f.dirs.join(path.delimiter) }, accepts: () => true, baseDirs: () => [], listenRetries: 0 });
    const r = await again.start();
    assert.deepEqual([r.ok, r.code], [false, 'PORT']);
    assert.deepEqual(marked(json(settingsOf(f.dirs[0]))), [], 'the lines that pointed at another program are gone');
    const status = await again.status([]);
    assert.deepEqual([status.on, status.message], [false, 'port']);
    assert.equal(again.listening(), false);
    assert.equal(f.state().port, st.port, 'no new port is chosen and nothing new is written until the user turns it on again');
    // 다시 켜면(두 번 확인 뒤) 새 자리와 새 확인 값으로 적는다
    const on = await again.enable([]);
    assert.equal(on.ok, true);
    assert.notEqual(f.state().port, st.port);
    assert.notEqual(f.state().token, st.token);
    assert.equal((await again.status([])).message, null);
    await again.close();
  } finally { other.close(); }
});

test('a folder added after hooks are on is not written by itself; it shows as not connected until hooks are turned on again for it', async () => {
  const top = tmp();
  const a = path.join(top, 'a'), b = path.join(top, 'b');
  fs.mkdirSync(a); fs.mkdirSync(b);
  fs.writeFileSync(path.join(b, 'settings.json'), '{"env":{"B":"1"}}');
  const hooks = createOfficeHooks({ fsImpl: guardedFs, userData: path.join(top, 'ud'), installed: true, accepts: () => true, baseDirs: () => [], listenRetries: 0 });
  assert.equal((await hooks.enable([a])).ok, true);
  const status = await hooks.status([a, b]);
  assert.deepEqual(status.dirs.map(d => [path.basename(d.dir), d.on, d.file]), [['a', true, true], ['b', false, true]]);
  await hooks.start(); // 다시 켜도
  assert.equal(read(path.join(b, 'settings.json')), '{"env":{"B":"1"}}', 'the new folder\'s file is untouched');
  assert.equal((await hooks.enable([a, b])).ok, true);
  assert.deepEqual((await hooks.status([a, b])).dirs.map(d => d.on), [true, true]);
  assert.equal(marked(json(path.join(b, 'settings.json'))).length, 6);
  await hooks.disable();
  assert.equal(read(path.join(b, 'settings.json')).includes('synk-office'), false);
  await hooks.close();
});

test('runs that are not the installed build never touch real settings: without the override they refuse, with it they write only there', async () => {
  const top = tmp();
  const looksReal = path.join(top, 'Users', 'someone', '.claude');
  fs.mkdirSync(looksReal, { recursive: true });
  fs.writeFileSync(path.join(looksReal, 'settings.json'), '{}');
  const none = createOfficeHooks({ fsImpl: guardedFs, userData: path.join(top, 'ud'), installed: false, env: {}, accepts: () => true });
  assert.equal(none.available(), false);
  assert.deepEqual(await none.enable([looksReal]), { ok: false, code: 'NOT_HERE' });
  assert.equal(none.listening(), false);
  assert.equal(read(path.join(looksReal, 'settings.json')), '{}');
  assert.equal((await none.status([looksReal])).available, false);
  assert.deepEqual((await none.status([looksReal])).dirs, [], 'the roots are not even listed');
  const test1 = path.join(top, 'test-claude');
  fs.mkdirSync(test1);
  const given = createOfficeHooks({ fsImpl: guardedFs, userData: path.join(top, 'ud2'), installed: false, env: { [OVERRIDE_ENV]: test1 + path.delimiter + 'relative\\dir' }, accepts: () => true });
  assert.deepEqual(given.override, [test1], 'only absolute folders are taken from the override');
  assert.equal((await given.enable([looksReal])).ok, true);
  assert.equal(read(path.join(looksReal, 'settings.json')), '{}', 'the roots are ignored in such a run');
  assert.equal(marked(json(path.join(test1, 'settings.json'))).length, 6);
  await given.disable();
  // 설치본에서는 넘겨받은 값을 쓰지 않는다
  assert.deepEqual(createOfficeHooks({ fsImpl: guardedFs, userData: path.join(top, 'ud3'), installed: true, env: { [OVERRIDE_ENV]: test1 } }).override, []);
  assert.deepEqual(overrideDirs({}), []);
});

test('the unhook path removes marked lines from recorded folders without a server, and the installed build also cleans the default folder', async () => {
  const top = tmp();
  const recorded = path.join(top, 'recorded'), base = path.join(top, 'base');
  fs.mkdirSync(recorded); fs.mkdirSync(base);
  const ud = path.join(top, 'ud');
  const first = createOfficeHooks({ fsImpl: guardedFs, userData: ud, installed: true, accepts: () => true, baseDirs: () => [] });
  await first.enable([recorded]);
  await first.close();
  // 상태 파일에 없는 기본 폴더에도 솔리오의 줄이 남아 있다(다른 실행이 적었다)
  fs.writeFileSync(path.join(base, 'settings.json'), JSON.stringify({ env: { K: 'v' }, hooks: { Stop: [{ hooks: [{ type: 'http', url: 'http://127.0.0.1:40001/synk-office/' + 'z'.repeat(43), timeout: 2 }] }] } }));
  const unhook = createOfficeHooks({ fsImpl: guardedFs, userData: ud, installed: true, baseDirs: () => [base] });
  const r = await unhook.unhook();
  assert.equal(r.ok, true);
  assert.equal(unhook.listening(), false, 'no server is opened to unhook');
  assert.deepEqual(marked(json(path.join(recorded, 'settings.json'))), []);
  assert.deepEqual(json(path.join(base, 'settings.json')), { env: { K: 'v' } });
  assert.equal(json(path.join(ud, 'Office', 'hooks.json')).enabled, false);
  // 기본 폴더의 파일이 깨져 있어도(솔리오가 적어 두지 않은 폴더) 끄기는 된다
  const third = createOfficeHooks({ fsImpl: guardedFs, userData: path.join(top, 'ud4'), installed: true, accepts: () => true, baseDirs: () => [base] });
  await third.enable([recorded]);
  fs.writeFileSync(path.join(base, 'settings.json'), '{ broken');
  assert.equal((await third.disable()).ok, true);
  assert.equal(read(path.join(base, 'settings.json')), '{ broken');
});

test('r8 GA1: the account that allowed a hook is the one it is delivered for, even if the account changes while the body arrives', async () => {
  let who = { synk_user_id: 'account-a' };
  const seen = [];
  const f = setup({ accepts: () => who, deliver: (e, account) => seen.push([e.event, account?.synk_user_id]) });
  await f.hooks.enable([]);
  const { port, path: p } = where(f);
  const body = Buffer.from(JSON.stringify(toolUse({ tool_name: 'Read', tool_input: { file_path: 'C:\\a\\b.ts' } })));
  await new Promise(resolve => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method: 'POST', headers: { 'content-length': body.length, 'content-type': 'application/json' } }, res => { res.resume(); res.on('end', resolve); });
    req.on('error', resolve);
    req.write(body.subarray(0, 10));
    // 몸의 앞만 보낸 사이에 계정이 바뀐다
    setTimeout(() => { who = { synk_user_id: 'account-b' }; req.end(body.subarray(10)); }, 60);
  });
  await settle();
  assert.deepEqual(seen, [['PostToolUse', 'account-a']]);
  await f.hooks.close();
});

test('turning off where a recorded file cannot be read stops taking news, keeps that folder recorded as left, and says why', async () => {
  const f = setup({ dirs: 2 });
  await f.hooks.enable([]);
  fs.writeFileSync(settingsOf(f.dirs[1]), '{ "hooks": // 손님이 주석을 넣었다\n}');
  const off = await f.hooks.disable();
  assert.deepEqual([off.ok, off.code], [false, 'READ']);
  const status = await f.hooks.status([]);
  assert.deepEqual([status.on, status.left], [false, true], 'off, with lines possibly left in one file (설계 검토 solio-office-hooks (나))');
  assert.deepEqual(status.dirs.map(d => [d.on, d.code]), [[false, null], [false, 'READ']]);
  assert.deepEqual([f.state().enabled, f.state().dirs], [false, [f.dirs[1]]]);
  assert.equal(f.hooks.listening(), true, 'the port stays held for the lines that remain');
  assert.equal(await post(where(f).port, where(f).path, toolUse({ tool_name: 'Read' })), 404, 'but news is not taken after the turn-off was asked');
  assert.deepEqual(marked(json(settingsOf(f.dirs[0]))), []);
  await f.hooks.close();
});

test('30 minutes after turning on with no news at all the status says news may be blocked; one arrival clears it', async () => {
  let t = Date.now();
  const f = setup({ now: () => t });
  await f.hooks.enable([]);
  assert.equal((await f.hooks.status([])).message, null);
  t += SILENT_MS - 1;
  assert.equal((await f.hooks.status([])).message, null);
  t += 1;
  assert.equal((await f.hooks.status([])).message, 'silent');
  const n = f.changes.n;
  await post(where(f).port, where(f).path, { hook_event_name: 'Stop', session_id: S1 });
  await settle();
  assert.equal((await f.hooks.status([])).message, null);
  assert.ok(f.changes.n > n, 'the screen is told when the first news arrives');
  await f.hooks.close();
});

test('stripMarked and isMarked follow the three-part mark exactly', () => {
  assert.equal(isMarked({ type: 'http', url: 'http://127.0.0.1:1/synk-office/a' }), true);
  assert.equal(isMarked({ type: 'command', command: 'curl http://127.0.0.1:1/synk-office/a' }), false);
  assert.equal(isMarked({ type: 'http', url: 'http://localhost:1/synk-office/a' }), false);
  assert.equal(isMarked({ type: 'http', url: 'http://127.0.0.1:1/synk-officex/a' }), false);
  assert.equal(isMarked({ type: 'http', url: 'not a url' }), false);
  const v = { hooks: { Stop: 'odd', Notification: [{ hooks: [{ type: 'http', url: 'http://127.0.0.1:9/synk-office/q' }] }] } };
  assert.equal(stripMarked(v), 1);
  assert.deepEqual(v, { hooks: { Stop: 'odd' } }, 'an odd value is left alone');
});

/* ── 받기(설계 검토의 단일 실행 잠금 설계, GPT 검수 r8 GA2 · r9 GA6 · r10 GA5) ── 받을지는 메모리의 받기 값으로 정하고, 끄기는 부른 틱에 닫는다 */
/* 몸의 앞 10바이트만 보낸 요청. finish()가 나머지를 보내고 답의 상태(또는 연결 잘못)를 돌려준다 */
function partial(port, urlPath, body) {
  const data = Buffer.from(JSON.stringify(body));
  let done;
  const ended = new Promise(r => { done = r; });
  const req = http.request({ host: '127.0.0.1', port, path: urlPath, method: 'POST', headers: { 'content-length': data.length, 'content-type': 'application/json' } }, res => { const status = res.statusCode; res.resume(); res.on('end', () => done(status)); });
  req.on('error', e => done(e.code || 'ERROR'));
  req.write(data.subarray(0, 10));
  return { finish: () => { req.end(data.subarray(10)); return ended; } };
}
/* settings.json의 lstat을 붙잡아 두는 fs. arm() 뒤의 첫 lstat이 release()까지 끝나지 않는다. arm()은 그 lstat에 닿을 때 풀리는 약속을 준다 */
function holdingSettings() {
  let hold = null, release = () => {}, reached = () => {};
  return {
    arm() { hold = new Promise(r => { release = r; }); return new Promise(r => { reached = r; }); },
    release: () => { const r = release; release = () => {}; r(); },
    fsImpl: { ...fs, promises: { ...fs.promises, lstat: async (file, ...a) => { if (hold && path.basename(String(file)) === 'settings.json') { const h = hold; hold = null; reached(); await h; } return fs.promises.lstat(file, ...a); } } },
  };
}
const READ_NEWS = () => toolUse({ tool_name: 'Read', tool_input: { file_path: 'C:\\a\\b.ts' } });

test('turning off closes acceptance in the calling tick: a hook allowed before, whose body ends while the turn-off is still running, is refused and never delivered', async () => {
  let asked;
  const allowed = new Promise(r => { asked = r; });
  const h = holdingSettings();
  const f = setup({ accepts: () => { asked(); return true; }, fsImpl: h.fsImpl });
  await f.hooks.enable([]);
  const { port, path: p } = where(f);
  const req = partial(port, p, READ_NEWS());
  await allowed;
  await settle();
  const reached = h.arm();
  const off = f.hooks.disable(); // 받기는 여기서 닫힌다. 끄기는 settings.json을 읽다가 붙잡혀 있다
  await reached;
  assert.equal(f.hooks.listening(), true, 'the turn-off has not finished: the server is still open');
  const status = await req.finish();
  assert.equal(status, 404, 'the body ended after the close: refused');
  assert.equal(await post(port, p, READ_NEWS()), 404, 'a new hook is refused at once too');
  await settle();
  assert.deepEqual(f.delivered, [], 'nothing was delivered');
  h.release();
  assert.equal((await off).ok, true);
  assert.equal(f.hooks.listening(), false);
});

test('the ticket handed over with each hook stops matching in the same tick as the turn-off; turning on again opens a new generation', async () => {
  const tickets = [];
  const f = setup({ deliver: (e, a, ticket) => tickets.push(ticket) });
  await f.hooks.enable([]);
  await post(where(f).port, where(f).path, READ_NEWS());
  await settle();
  assert.equal(tickets.length, 1);
  const first = tickets[0];
  assert.equal(f.hooks.accepting(first), true, 'office.cjs may fold it');
  const off = f.hooks.disable();
  assert.equal(f.hooks.accepting(first), false, 'closed before any await: an ingest that re-checks now drops it');
  await off;
  assert.equal((await f.hooks.enable([])).ok, true);
  await post(where(f).port, where(f).path, READ_NEWS());
  await settle();
  assert.equal(tickets.length, 2);
  assert.equal(f.hooks.accepting(tickets[1]), true, 'turned on again: the new hook is accepted');
  assert.equal(f.hooks.accepting(first), false, 'the old ticket never matches again');
  await f.hooks.close();
});

test('a turn-off asked while a turn-on is still queued wins: the turn-on does not reopen acceptance when it finishes first', async () => {
  const h = holdingSettings();
  const f = setup({ fsImpl: h.fsImpl });
  const on = f.hooks.enable([]);
  const off = f.hooks.disable(); // 켜기가 차례에 있는 동안 끄기를 눌렀다
  assert.equal((await on).ok, true);
  const reached = h.arm(); // 켜기는 끝났고 끄기는 settings.json을 읽다가 붙잡힌다. 서버는 열려 있다
  await reached;
  assert.equal(f.hooks.listening(), true);
  const { port, path: p } = where(f);
  assert.equal(await post(port, p, READ_NEWS()), 404, 'not accepted between the two jobs');
  await settle();
  assert.deepEqual(f.delivered, []);
  h.release();
  assert.equal((await off).ok, true);
  assert.deepEqual(marked(json(settingsOf(f.dirs[0]))), []);
  assert.equal(f.state().enabled, false);
});

test('GA2: the viewer is asked in the tick the request arrives, so a sign-in change right after it does not move the news to the new login', async () => {
  let who = 'login-a';
  const seen = [];
  // 서버의 첫 듣는 이는 office-hooks의 handle이다. 그 바로 뒤, 같은 틱에 계정이 바뀐다
  const httpImpl = { createServer: handler => { const s = http.createServer(handler); s.on('request', () => { who = 'login-b'; }); return s; } };
  const f = setup({ httpImpl, accepts: () => ({ synk_user_id: who }), deliver: (e, account) => seen.push(account.synk_user_id) });
  await f.hooks.enable([]);
  assert.equal(await post(where(f).port, where(f).path, READ_NEWS()), 204);
  await settle();
  assert.deepEqual(seen, ['login-a']);
  await f.hooks.close();
});

/* ── --office-unhook(runUnhook) ── 단일 실행 잠금을 얻으면 혼자 끄고, 못 얻으면 켜진 앱이 끄기를 마치기를 상태 파일로 8초까지 기다린다 */
const unhookHooks = (dirs, fsImpl = guardedFs) => options => createOfficeHooks({ ...options, env: { [OVERRIDE_ENV]: dirs.join(path.delimiter) }, fsImpl, baseDirs: () => [] });
/* 기다림마다 그만큼 때를 앞당기는 가짜 시계 */
function jumpingClock() {
  const c = { t: 0, waits: 0 };
  c.now = () => c.t;
  c.setTimeout = (fn, ms) => { c.waits += 1; c.t += ms; setImmediate(fn); return { unref() {} }; };
  return c;
}

test('runUnhook with the lock asks for it in the first tick, turns off alone and exits 0; a folder it cannot clean exits 2', async () => {
  const f = setup({ dirs: 2 });
  await f.hooks.enable([]);
  await f.hooks.close();
  let locks = 0;
  const run = runUnhook({ userData: f.userData, lock: () => { locks += 1; return true; }, createHooks: unhookHooks(f.dirs) });
  assert.equal(locks, 1, 'the lock is asked before anything waits');
  assert.equal(await run, UNHOOK_EXIT.OK);
  for (const d of f.dirs) assert.deepEqual(marked(json(settingsOf(d))), []);
  assert.deepEqual([f.state().enabled, f.state().dirs], [false, []]);
  const g = setup({ dirs: 2 });
  await g.hooks.enable([]);
  await g.hooks.close();
  fs.writeFileSync(settingsOf(g.dirs[1]), '{ "hooks": // 손님이 주석을 넣었다\n}');
  assert.equal(await runUnhook({ userData: g.userData, lock: () => true, createHooks: unhookHooks(g.dirs) }), UNHOOK_EXIT.LEFT);
  assert.deepEqual(g.state().dirs, [g.dirs[1]], 'the folder that was left stays recorded');
  assert.equal(UNHOOK_EXIT.OK, 0);
  assert.ok(UNHOOK_EXIT.LEFT !== 0 && UNHOOK_EXIT.UNCONFIRMED !== 0 && UNHOOK_EXIT.FAILED !== 0);
});

test('runUnhook without the lock only watches the state file: 0 once the running app has turned off; a folder the app could not clean gives up after 8 s as could-not-confirm', async () => {
  const f = setup();
  await f.hooks.enable([]);
  let nonce = null;
  const waiting = runUnhook({ userData: f.userData, lock: n => { nonce = n; return false; }, createHooks: () => { throw new Error('the unhook run must not write when the app runs'); }, pollMs: 5 });
  assert.match(nonce, /^[0-9a-f]{32}$/, 'the unhook run hands a one-time value with its lock request (Electron additionalData)');
  void f.hooks.unhook({ nonce }); // 켜진 앱의 second-instance가 하는 일
  assert.equal(await waiting, UNHOOK_EXIT.OK);
  assert.deepEqual(marked(json(settingsOf(f.dirs[0]))), []);
  // 지우지 못한 폴더가 남는다: 켜진 앱이 남은 수와 함께 적으므로 기다리지 않고 2로 끝난다
  const g = setup({ dirs: 2 });
  await g.hooks.enable([]);
  fs.writeFileSync(settingsOf(g.dirs[1]), '{ // 주석\n}');
  let gn = null;
  const run = runUnhook({ userData: g.userData, lock: n => { gn = n; return false; }, pollMs: 5 });
  const off = await g.hooks.unhook({ nonce: gn });
  assert.deepEqual([off.ok, off.code], [false, 'READ']);
  assert.equal(await run, UNHOOK_EXIT.LEFT);
  await g.hooks.close();
  // 앞 실행이 남긴 꺼짐(이 확인 값이 아님)은 끝으로 보지 않는다(GPT 검수 be3 GA12, 카본 be2 A2). 8초까지 보고 확인하지 못함으로 끝난다
  const h = setup();
  await h.hooks.enable([]);
  await h.hooks.disable();
  assert.deepEqual([h.state().enabled, h.state().dirs], [false, []]);
  const clock = jumpingClock();
  assert.equal(await runUnhook({ userData: h.userData, lock: () => false, now: clock.now, setTimeout: clock.setTimeout }), UNHOOK_EXIT.UNCONFIRMED);
  assert.equal(UNHOOK_WAIT_MS, 8000, 'under the installer limit of 10 s');
  assert.ok(clock.t >= UNHOOK_WAIT_MS && clock.t <= UNHOOK_WAIT_MS + 100, `gave up at ${clock.t} ms`);
  assert.ok(clock.waits >= 50, 'it kept looking until then');
  // 상태 파일이 없거나 깨졌으면 끝을 확인하지 못한다
  const none = jumpingClock();
  assert.equal(await runUnhook({ userData: path.join(tmp(), 'no-state'), lock: () => false, now: none.now, setTimeout: none.setTimeout }), UNHOOK_EXIT.UNCONFIRMED);
});

test('the waiting unhook run opens the state file only when it changed, so its reads do not keep refusing the running app\'s rename on Windows', async () => {
  const f = setup();
  await f.hooks.enable([]);
  const calls = { stat: 0, readFile: 0 };
  const counting = { ...fs, promises: { ...fs.promises,
    stat: (...a) => { calls.stat += 1; return fs.promises.stat(...a); },
    readFile: (...a) => { calls.readFile += 1; return fs.promises.readFile(...a); },
  } };
  let nonce = null;
  const waiting = runUnhook({ userData: f.userData, lock: n => { nonce = n; return false; }, fsImpl: counting, pollMs: 1 });
  await new Promise(r => setTimeout(r, 150));
  assert.ok(calls.stat >= 5, `it kept looking (${calls.stat} looks)`);
  assert.equal(calls.readFile, 1, 'the unchanged file was opened once');
  const off = await f.hooks.unhook({ nonce });
  assert.equal(off.ok, true, 'the running app could write its state file while being watched');
  assert.equal(await waiting, UNHOOK_EXIT.OK);
  assert.ok(calls.readFile <= 3, `opened again only after it changed (${calls.readFile})`);
});

/* ── GPT 검수(solio-office-be-20261120) ── */
test('GA1: a change saved while Solio writes its temp file is not overwritten; Solio tries once more, and stops with 「바뀌는 중」 if it keeps changing', async () => {
  const start = JSON.stringify({ env: { EXAMPLE: 'old' } }, null, 2) + '\n';
  const theyWrite = when => ({ ...fs, promises: { ...fs.promises, writeFile: async (file, data, opts) => {
    const out = await fs.promises.writeFile(file, data, opts);
    // 임시 파일을 쓴 바로 뒤, 바꿔 넣기 전에 다른 프로그램이 저장한다
    if (/^\.settings\.json\.synk-.*\.tmp$/.test(path.basename(String(file))) && when()) fs.writeFileSync(path.join(path.dirname(String(file)), 'settings.json'), JSON.stringify({ env: { EXAMPLE: 'new' + when.n } }, null, 2) + '\n');
    return out;
  } } });
  const once = () => (once.n = (once.n || 0) + 1) === 1;
  let f = setup({ files: { 0: start }, fsImpl: theyWrite(once) });
  assert.equal((await f.hooks.enable([])).ok, true);
  let s = json(settingsOf(f.dirs[0]));
  assert.equal(s.env.EXAMPLE, 'new1', 'their save is kept');
  assert.equal(marked(s).length, 6, 'Solio\'s lines went in on the second try');
  assert.deepEqual(filesIn(f.dirs[0]), ['settings.json']);
  await f.hooks.close();
  const always = () => { always.n = (always.n || 0) + 1; return true; };
  f = setup({ files: { 0: start }, fsImpl: theyWrite(always) });
  const r = await f.hooks.enable([]);
  assert.deepEqual([r.ok, r.code], [false, 'BUSY']);
  s = json(settingsOf(f.dirs[0]));
  assert.match(s.env.EXAMPLE, /^new/, 'their latest save is kept');
  assert.equal(marked(s).length, 0);
  assert.deepEqual(filesIn(f.dirs[0]), ['settings.json'], 'no copy or temp file is left');
});

test('GPT 검수 be3 GA1: when a rename is refused for a moment and another program saves meanwhile, the retry compares again and does not overwrite their save', async () => {
  const start = JSON.stringify({ env: { EXAMPLE: 'old' } }, null, 2) + '\n';
  let refused = 0;
  const busyOnce = { ...fs, promises: { ...fs.promises, rename: async (from, to) => {
    if (path.basename(String(to)) === 'settings.json' && refused === 0) {
      refused += 1;
      fs.writeFileSync(String(to), JSON.stringify({ env: { EXAMPLE: 'theirs' } }, null, 2) + '\n'); // 거절된 사이에 남이 저장한다
      const e = new Error('busy'); e.code = 'EBUSY'; throw e;
    }
    return fs.promises.rename(from, to);
  } } };
  const f = setup({ files: { 0: start }, fsImpl: busyOnce, setTimeout: fn => { setImmediate(fn); return { unref() {} }; } });
  assert.equal((await f.hooks.enable([])).ok, true);
  const s = json(settingsOf(f.dirs[0]));
  assert.equal(s.env.EXAMPLE, 'theirs', 'their save made during the refused rename is kept');
  assert.equal(marked(s).length, 6, 'Solio\'s lines went in on top of their save');
  assert.equal(refused, 1);
  assert.deepEqual(filesIn(f.dirs[0]), ['settings.json']);
  await f.hooks.close();
});

test('GA3: when hooks.json cannot be written, turning on stops before settings.json, and turning off and both unhook paths do not report success', async () => {
  let failState = false;
  const failing = { ...fs, promises: { ...fs.promises, rename: async (from, to) => { if (failState && path.basename(String(to)) === 'hooks.json') { const e = new Error('locked'); e.code = 'EPERM'; throw e; } return fs.promises.rename(from, to); } } };
  const fast = fn => { setImmediate(fn); return { unref() {} }; };
  const f = setup({ fsImpl: failing, setTimeout: fast });
  failState = true;
  const on = await f.hooks.enable([]);
  assert.deepEqual([on.ok, on.code], [false, 'STATE']);
  assert.equal(fs.existsSync(settingsOf(f.dirs[0])), false, 'settings.json was not touched');
  assert.equal(f.hooks.listening(), false);
  failState = false;
  assert.equal((await f.hooks.enable([])).ok, true);
  const { port, path: p } = where(f);
  failState = true;
  const off = await f.hooks.disable();
  assert.deepEqual([off.ok, off.code], [false, 'STATE']);
  assert.deepEqual(marked(json(settingsOf(f.dirs[0]))), [], 'the lines are gone');
  assert.equal(f.state().enabled, true, 'the state file could not say off');
  assert.notEqual(await post(port, p, READ_NEWS()), 204, 'the running app takes no more news anyway');
  await settle();
  assert.deepEqual(f.delivered, []);
  const clock = jumpingClock();
  assert.equal(await runUnhook({ userData: f.userData, lock: () => false, now: clock.now, setTimeout: clock.setTimeout }), UNHOOK_EXIT.UNCONFIRMED, 'the waiting unhook run cannot confirm it');
  assert.equal(await runUnhook({ userData: f.userData, lock: () => true, createHooks: o => createOfficeHooks({ ...o, env: { [OVERRIDE_ENV]: f.dirs[0] }, fsImpl: guard(failing), baseDirs: () => [], setTimeout: fast }) }), UNHOOK_EXIT.UNCONFIRMED, 'the unhook run with the lock does not say 0 either');
});

test('GA4: an 「name=value」 first word is dropped before the path is cut, so no part of the value becomes the tool detail', () => {
  assert.equal(toolDetailOf('Bash', { command: 'DEMO_TOKEN=example/samplepart true' }), null);
  assert.equal(toolDetailOf('Bash', { command: 'DEMO_TOKEN=C:\\keys\\samplepart run' }), null);
  assert.equal(toolDetailOf('PowerShell', { command: '"DEMO_TOKEN=example/samplepart" x' }), null, 'quoted too');
  assert.equal(toolDetailOf('Bash', { command: '/usr/bin/git status' }), 'git', 'a plain path still gives its last part');
  assert.equal(toolDetailOf('Bash', { command: 'npm test -- --token=x' }), 'npm', 'an assignment later in the command does not matter');
});

test('GA5: a run that is not the installed build turns off only in the folders passed to it; a folder recorded by an earlier run is left as it is and stays recorded', async () => {
  const f = setup();
  await f.hooks.enable([]);
  await f.hooks.close();
  const before = read(settingsOf(f.dirs[0]));
  const bare = createOfficeHooks({ fsImpl: guardedFs, userData: f.userData, installed: false, env: {}, baseDirs: () => [] });
  assert.equal(bare.available(), false);
  const off = await bare.disable();
  assert.deepEqual([off.ok, off.code], [false, 'NOT_HERE']);
  assert.equal(read(settingsOf(f.dirs[0])), before, 'the folder this run was not given is untouched');
  assert.deepEqual(f.state().dirs, [f.dirs[0]], 'and stays recorded');
  const other = path.join(f.top, 'other-claude');
  fs.mkdirSync(other);
  const elsewhere = createOfficeHooks({ fsImpl: guardedFs, userData: f.userData, installed: false, env: { [OVERRIDE_ENV]: other }, baseDirs: () => [] });
  assert.equal((await elsewhere.unhook()).code, 'NOT_HERE');
  assert.equal(read(settingsOf(f.dirs[0])), before);
  assert.deepEqual(fs.readdirSync(other), [], 'nothing is made in the folder it was given either');
  const given = createOfficeHooks({ fsImpl: guardedFs, userData: f.userData, installed: false, env: { [OVERRIDE_ENV]: f.dirs[0] }, baseDirs: () => [] });
  assert.equal((await given.disable()).ok, true, 'the run given that folder cleans it');
  assert.deepEqual(marked(json(settingsOf(f.dirs[0]))), []);
  assert.deepEqual([f.state().enabled, f.state().dirs], [false, []]);
});

test('GA6: no copy of the old content (with its env secrets) is ever written; a file lying at the old copy name is left alone, and a temp file that failed half-way is deleted', async () => {
  const f = setup({ files: { 0: '{"env":{"A":"1"}}' } });
  const theirs = path.join(f.dirs[0], 'settings.json.synk-backup');
  fs.writeFileSync(theirs, '{"env":{"A":"older copy"}}');
  assert.equal((await f.hooks.enable([])).ok, true);
  assert.equal((await f.hooks.disable()).ok, true);
  assert.equal(read(theirs), '{"env":{"A":"older copy"}}', 'the file that was there is kept as it was');
  assert.deepEqual(filesIn(f.dirs[0]), ['settings.json', 'settings.json.synk-backup'], 'nothing else was left');
  const halfway = { ...fs, promises: { ...fs.promises, writeFile: async (file, data, opts) => {
    if (/\.tmp$/.test(String(file)) && path.basename(String(file)).startsWith('.settings.json')) { await fs.promises.writeFile(file, String(data).slice(0, 8), opts); const e = new Error('disk full'); e.code = 'ENOSPC'; throw e; }
    return fs.promises.writeFile(file, data, opts);
  } } };
  const g = setup({ files: { 0: '{"env":{"SECRET":"x"}}' }, fsImpl: halfway });
  const r = await g.hooks.enable([]);
  assert.deepEqual([r.ok, r.code], [false, 'WRITE']);
  assert.deepEqual(filesIn(g.dirs[0]), ['settings.json'], 'the half-written temp file is deleted');
  assert.equal(read(settingsOf(g.dirs[0])), '{"env":{"SECRET":"x"}}');
  assert.deepEqual([g.state().enabled, g.state().dirs], [false, []], 'a folder Solio never wrote to is not kept');
  assert.equal(g.hooks.listening(), false);
});

test('GA7: a recorded folder that cannot be looked at is not counted as cleaned; it stays recorded (left, not taking news), and the next turn-off cleans it', async () => {
  let denied = null;
  const fsImpl = { ...fs, promises: { ...fs.promises, stat: async (p, ...a) => {
    if (denied && path.resolve(String(p)) === path.resolve(denied)) { const e = new Error('denied'); e.code = 'EACCES'; throw e; }
    return fs.promises.stat(p, ...a);
  } } };
  const f = setup({ dirs: 2, fsImpl });
  await f.hooks.enable([]);
  denied = f.dirs[1];
  const off = await f.hooks.disable();
  assert.deepEqual([off.ok, off.code], [false, 'READ']);
  assert.equal(marked(json(settingsOf(f.dirs[1]))).length, 6, 'its lines are still there');
  assert.deepEqual([f.state().enabled, f.state().dirs], [false, [f.dirs[1]]], 'so it stays recorded, and news is not taken (설계 검토 solio-office-hooks (나))');
  assert.equal((await f.hooks.status([])).left, true);
  denied = null;
  assert.equal((await f.hooks.disable()).ok, true);
  assert.deepEqual(marked(json(settingsOf(f.dirs[1]))), []);
  assert.deepEqual(f.state().dirs, []);
  // 정말 없는 폴더는 그대로 건너뛴다
  fs.rmSync(f.dirs[1], { recursive: true });
  assert.equal((await f.hooks.disable()).ok, true);
});

test('GA8: lines that would push settings.json past 4 MB are not written; the file stays as it was and can still be turned off', async () => {
  const text = JSON.stringify({ env: { BIG: 'x'.repeat(SETTINGS_MAX - 200) } });
  assert.ok(Buffer.byteLength(text) < SETTINGS_MAX);
  const f = setup({ files: { 0: text } });
  const r = await f.hooks.enable([]);
  assert.deepEqual([r.ok, r.code], [false, 'SIZE']);
  assert.equal(read(settingsOf(f.dirs[0])), text);
  assert.deepEqual(filesIn(f.dirs[0]), ['settings.json']);
  assert.equal(f.hooks.listening(), false);
  assert.equal((await f.hooks.disable()).ok, true, 'nothing of Solio\'s to remove');
});

/* ── 설계 검토 solio-office-hooks 5의 3: 이 종류를 닫는 불변식 시험 ── */
/* 손님 파일: 켜기와 끄기가 settings.json · 그 임시 파일에 대해 하는 파일 호출마다 차례로 「남의 저장」(읽고 고쳐 쓰기)을 끼워 넣는다.
   ① 남이 마지막에 쓴 칸이 사라지지 않는다. ② 끝난 뒤 파일에 솔리오의 줄이 있으면 그 폴더는 상태 파일의 dirs에 있다.
   이름 바꾸기는 그 호출 바로 뒤에 끼운다. 마지막 확인과 이름 바꾸기 사이의 틈은 받아들인 남는 틈이다(설계 검토 2번 답, 구현설계 12.3) */
function interleavingFs(dir, at, kind = 'save') {
  const p = fs.promises;
  const settings = path.join(dir, 'settings.json');
  const ours = file => { const s = String(file); return s === settings || (s.startsWith(dir) && /settings\.json/.test(path.basename(s))); };
  const box = { n: 0, theirs: null };
  const theyWrite = () => {
    let v = {};
    try { const t = fs.readFileSync(settings, 'utf8'); const x = JSON.parse(t.replace(/^﻿/, '')); if (x && typeof x === 'object' && !Array.isArray(x)) v = x; } catch { v = {}; }
    v.theirs = 'save-' + box.n;
    box.theirs = v.theirs;
    fs.writeFileSync(settings, JSON.stringify(v, null, 2) + '\n');
  };
  /* kind: 'save' 남이 저장한다 · 'busy' 이름 바꾸기가 잠깐 거절되고 그사이 남이 저장한다 · 'fail' 읽기가 한 번 거절된다 */
  const refuse = code => { const e = new Error(code); e.code = code; throw e; };
  const wrap = name => async (file, ...a) => {
    if (ours(file)) {
      box.n += 1;
      if (box.n === at) {
        if (kind === 'fail' && (name === 'readFile' || name === 'lstat')) refuse('EACCES');
        if (kind === 'save') theyWrite();
      }
    }
    return p[name](file, ...a);
  };
  box.fsImpl = { ...fs, promises: { ...p, stat: wrap('stat'), lstat: wrap('lstat'), readFile: wrap('readFile'), writeFile: wrap('writeFile'), open: wrap('open'), unlink: wrap('unlink'),
    rename: async (from, to) => {
      if (!ours(to)) return p.rename(from, to);
      box.n += 1;
      if (box.n === at && kind === 'busy') { theyWrite(); refuse('EBUSY'); }
      const r = await p.rename(from, to);
      if (box.n === at && kind === 'save') theyWrite();
      return r;
    } } };
  return box;
}
test('invariant: another program saving settings.json at any step of turning on or off never loses its save, and a folder left with Solio\'s lines is always recorded', async () => {
  const start = JSON.stringify({ env: { KEEP: 'yes' } }, null, 2) + '\n';
  let steps = 0;
  const fast = fn => { setImmediate(fn); return { unref() {} }; };
  for (const [mode, kind] of [['on', 'save'], ['off', 'save'], ['on', 'busy'], ['off', 'busy'], ['on', 'fail'], ['off', 'fail']]) {
    for (let at = 1; at < 60; at++) {
      const top = tmp();
      const dir = path.join(top, 'claude0');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'settings.json'), start);
      const userData = path.join(top, 'userData');
      let box = interleavingFs(dir, mode === 'on' ? at : -1, kind);
      let hooks = createOfficeHooks({ fsImpl: guard(box.fsImpl), userData, installed: false, env: { [OVERRIDE_ENV]: dir }, accepts: () => true, baseDirs: () => [], listenRetries: 0, setTimeout: fast });
      await hooks.enable([]);
      if (mode === 'off') {
        await hooks.close();
        box = interleavingFs(dir, at, kind);
        hooks = createOfficeHooks({ fsImpl: guard(box.fsImpl), userData, installed: false, env: { [OVERRIDE_ENV]: dir }, accepts: () => true, baseDirs: () => [], listenRetries: 0, setTimeout: fast });
        await hooks.start();
        await hooks.disable();
      }
      await hooks.close();
      const text = read(path.join(dir, 'settings.json'));
      let value = null;
      try { value = JSON.parse(text); } catch { value = null; }
      assert.ok(value, `${mode} @${at}: the file is still JSON`);
      const tag = `${mode}/${kind} @${at}`;
      if (box.theirs) assert.equal(value.theirs, box.theirs, `${tag}: their last save is kept`);
      assert.equal(value.env?.KEEP, 'yes', `${tag}: the other fields are kept`);
      const state = json(path.join(userData, 'Office', 'hooks.json'));
      if (marked(value).length) assert.ok(state.dirs.some(d => path.resolve(d).toLowerCase() === path.resolve(dir).toLowerCase()), `${tag}: lines are left, so the folder is recorded`);
      assert.deepEqual(fs.readdirSync(dir).filter(n => n !== 'settings.json'), [], `${tag}: no copy or temp file is left`);
      if (box.n < at) break; // 이 차례까지 닿지 않았다. 더 늦은 차례는 없다
      steps += 1;
    }
  }
  assert.ok(steps >= 30, `it went through the steps (${steps})`);
});

/* 상태 파일: 켜기의 save()를 차례로 하나씩 실패시키고 앱을 다시 연다. 켜기가 ok로 끝나지 않았으면 다시 연 앱은 받지 않는다.
   솔리오의 줄이 있는 폴더는 다시 연 앱의 dirs에 있다(다시 연 앱이 그 줄을 지우러 간다) */
test('invariant: whichever state-file write fails while turning on, a reopened app takes news only if the turn-on finished, and every folder with Solio\'s lines is recorded', async () => {
  let tried = 0;
  for (let k = 1; k < 8; k++) {
    const top = tmp();
    const dirs = [path.join(top, 'claude0'), path.join(top, 'claude1')];
    for (const d of dirs) fs.mkdirSync(d, { recursive: true });
    const userData = path.join(top, 'userData');
    let saves = 0;
    const failing = { ...fs, promises: { ...fs.promises, rename: async (from, to) => {
      if (path.basename(String(to)) === 'hooks.json' && ++saves === k) { const e = new Error('disk'); e.code = 'EIO'; throw e; }
      return fs.promises.rename(from, to);
    } } };
    const env = { [OVERRIDE_ENV]: dirs.join(path.delimiter) };
    const delivered = [];
    const first = createOfficeHooks({ fsImpl: guard(failing), userData, installed: false, env, accepts: () => true, deliver: e => delivered.push(e), baseDirs: () => [], listenRetries: 0 });
    const r = await first.enable([]);
    if (saves < k) { await first.close(); break; } // 이 차례의 저장이 없었다
    tried += 1;
    if (r.ok) assert.equal(first.listening(), true, `k=${k}: on`);
    // 켜기가 ok로 끝나지 않았으면 이 실행도 받지 않는다(GPT 검수 be3 GA6)
    const addr = first.address();
    if (!r.ok && addr) {
      const disk = json(path.join(userData, 'Office', 'hooks.json'));
      await post(addr.port, PATH_PREFIX + disk.token, READ_NEWS());
      await settle();
      assert.deepEqual(delivered, [], `k=${k}: a turn-on that failed (${r.code}) delivers nothing in the same run`);
    }
    await first.close();
    const again = createOfficeHooks({ fsImpl: guardedFs, userData, installed: false, env, accepts: () => true, baseDirs: () => [], listenRetries: 0 });
    await again.start();
    const st = await again.status([]);
    if (!r.ok) {
      assert.equal(st.on, false, `k=${k}: a turn-on that did not finish (${r.code}) is not taking news after a restart`);
      if (again.listening()) {
        const disk = json(path.join(userData, 'Office', 'hooks.json'));
        assert.notEqual(await post(disk.port, PATH_PREFIX + disk.token, READ_NEWS()), 204, `k=${k}: news is refused`);
      }
    }
    // 다시 연 앱이 지우기를 마친 뒤에도 줄이 남은 폴더는 기록되어 있다
    const disk = fs.existsSync(path.join(userData, 'Office', 'hooks.json')) ? json(path.join(userData, 'Office', 'hooks.json')) : { dirs: [] };
    for (const d of dirs) {
      const file = path.join(d, 'settings.json');
      if (fs.existsSync(file) && marked(json(file)).length) assert.ok(disk.dirs.some(x => path.resolve(x).toLowerCase() === path.resolve(d).toLowerCase()), `k=${k}: ${path.basename(d)} has lines and is recorded`);
    }
    await again.close();
  }
  assert.ok(tried >= 2, `several writes were failed in turn (${tried})`);
});

test('GPT 검수 be3 GA3: when the sign-in changes after the first folder is written, the next folder is not touched and the first folder\'s new lines are removed at once', async () => {
  const f = setup({ dirs: 2, installed: true, override: false });
  let signedIn = true;
  const watching = { ...fs, promises: { ...fs.promises, rename: async (from, to) => {
    const r = await fs.promises.rename(from, to);
    if (path.resolve(String(to)) === path.resolve(settingsOf(f.dirs[0]))) signedIn = false; // 첫 폴더를 바꿔 넣은 직후 로그아웃
    return r;
  } } };
  const hooks = createOfficeHooks({ fsImpl: guard(watching), userData: f.userData, installed: true, accepts: () => true, baseDirs: () => [], listenRetries: 0 });
  const r = await hooks.enable(f.dirs, { guard: () => signedIn });
  assert.deepEqual([r.ok, r.code], [false, 'AUTH_CHANGED']);
  assert.deepEqual(marked(json(settingsOf(f.dirs[0]))), [], 'the lines written before the change are taken back');
  assert.equal(fs.existsSync(settingsOf(f.dirs[1])), false, 'the second folder was never touched');
  const st = json(path.join(f.userData, 'Office', 'hooks.json'));
  assert.deepEqual([st.enabled, st.dirs], [false, []]);
  assert.equal(hooks.listening(), false);
  await hooks.close();
});

test('the module writes only inside the test folders (never the real Claude settings or the app folders)', () => {
  const under = (p, root) => { const a = path.resolve(p).toLowerCase(), b = path.resolve(root).toLowerCase(); return a === b || a.startsWith(b + path.sep); };
  assert.ok(writes.length > 0, 'the guard saw the module write');
  assert.deepEqual(writes.filter(p => !made.some(root => under(p, root))), [], 'every write of the module is inside a test folder');
  if (APPDATA_SYNK) assert.ok(!path.resolve(os.tmpdir()).toLowerCase().startsWith(APPDATA_SYNK.toLowerCase()), 'the test folders are not inside the app folder');
});

test('카본 검수 solio-office-be2 A1: an enable that writes no folder this time fails and leaves the on/off state as it was, even with folders recorded before', async () => {
  // 켜져 있을 때: 더하는 폴더가 깨져 있으면 실패로 답하고, 앞서 켠 폴더는 그대로 켜진 채다
  const f = setup({ dirs: 2, installed: true, override: false });
  assert.equal((await f.hooks.enable([f.dirs[0]])).ok, true);
  fs.writeFileSync(settingsOf(f.dirs[1]), '{ broken');
  const more = await f.hooks.enable([f.dirs[1]]);
  assert.equal(more.ok, false, 'nothing was added');
  assert.equal(typeof more.code, 'string');
  assert.deepEqual([f.state().enabled, f.state().dirs], [true, [f.dirs[0]]], 'still on for the first folder only');
  assert.equal(f.hooks.listening(), true);
  await f.hooks.disable();
  // 꺼져 있을 때: 지우지 못해 남은 폴더가 적혀 있어도, 이번에 한 폴더도 못 고치면 켜지 않는다
  const g = setup({ dirs: 2, installed: true, override: false });
  const stateFile = path.join(g.userData, 'Office', 'hooks.json');
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({ enabled: false, port: null, token: null, dirs: [g.dirs[0]], enabledAt: null, notice: null }));
  fs.writeFileSync(settingsOf(g.dirs[1]), '{ broken');
  const r = await g.hooks.enable([g.dirs[1]]);
  assert.equal(r.ok, false);
  assert.deepEqual([g.state().enabled, g.state().dirs], [false, [g.dirs[0]]], 'not turned on, and the leftover folder stays recorded for the next turn-off');
  assert.equal(g.hooks.listening(), true, 'the port stays held for the leftover folder, without taking news');
  assert.deepEqual([(await g.hooks.status([])).on, (await g.hooks.status([])).left], [false, true]);
  await g.hooks.close();
});
