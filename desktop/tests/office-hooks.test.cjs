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
  createOfficeHooks, isMarked, stripMarked, hookEvent, toolDetailOf, overrideDirs, hookUrl, EVENTS, OVERRIDE_ENV, BODY_MAX, SILENT_MS, PATH_PREFIX,
} = require('../src/office-hooks.cjs');

const APPDATA_SYNK = process.env.APPDATA ? path.join(process.env.APPDATA, 'SYNK Desktop') : null;
/* 시험이 만든 임시 폴더. 끝나면 지운다(GPT 검수 r9 GA5) */
const made = [];
test.after(() => { for (const d of made) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* 이미 없다 */ } } });
/* 모듈이 파일을 쓰는 자리를 모두 적는 fs(GPT 검수 r9 GA4). 이 PC의 실제 설정과 앱 폴더를 앞뒤 시각으로 견주면, 시험 도중 실제 앱이 쓴 것까지 실패로 센다.
   대신 모듈이 쓴 자리가 모두 시험의 임시 폴더 안인지 맨 끝 시험이 본다 */
const writes = [];
const WRITERS = ['writeFile', 'appendFile', 'rename', 'unlink', 'mkdir', 'rm', 'rmdir', 'copyFile'];
const guardedFs = { ...fs, promises: { ...fs.promises } };
for (const name of WRITERS) {
  const real = fs.promises[name].bind(fs.promises);
  guardedFs.promises[name] = (...args) => { writes.push(String(name === 'rename' || name === 'copyFile' ? args[1] : args[0])); return real(...args); };
}

const S1 = '00000001-0000-4000-8000-000000000001';
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'office-hooks-')); made.push(d); return d; };
const read = f => fs.readFileSync(f, 'utf8');
const json = f => JSON.parse(read(f));
const settingsOf = dir => path.join(dir, 'settings.json');
const filesIn = dir => fs.readdirSync(dir).sort();
const marked = settings => Object.entries(settings.hooks || {}).flatMap(([event, groups]) => (Array.isArray(groups) ? groups : []).flatMap(g => (g.hooks || []).filter(isMarked).map(h => [event, h.url])));
const settle = () => new Promise(r => setTimeout(r, 30));

function setup({ dirs = 1, installed = false, override = true, accepts = () => true, files = {}, ...rest } = {}) {
  const top = tmp();
  const userData = path.join(top, 'userData');
  const list = Array.from({ length: dirs }, (_, i) => path.join(top, 'claude' + i));
  for (const d of list) fs.mkdirSync(d, { recursive: true });
  for (const [i, text] of Object.entries(files)) fs.writeFileSync(settingsOf(list[i]), text);
  const delivered = [], changes = { n: 0 };
  const env = override ? { [OVERRIDE_ENV]: list.join(path.delimiter) } : {};
  const hooks = createOfficeHooks({ fsImpl: guardedFs, userData, installed, env, accepts, deliver: e => delivered.push(e), onChange: () => { changes.n += 1; }, baseDirs: () => [], listenRetries: 0, fsImpl: guardedFs, ...rest });
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

test('after the write: another program\'s edit is not rolled back (Solio tries again), a broken file is restored from the copy, and the copy is always deleted', async () => {
  const start = JSON.stringify({ env: { SECRET: 'keep' } }, null, 2) + '\n';
  // 쓴 바로 뒤에 다른 도구가 고친다(읽히는 파일): 되돌리지 않고 처음부터 한 번 더 한다
  let backupSeen = false;
  let f = setup({ files: { 0: start }, fsImpl: racingFs({ onRename: async (n, file) => {
    backupSeen = backupSeen || fs.existsSync(path.join(path.dirname(file), 'settings.json.synk-backup'));
    if (n === 1) { const v = JSON.parse(fs.readFileSync(file, 'utf8')); v.theme = 'dark'; fs.writeFileSync(file, JSON.stringify(v)); }
  } }) });
  let r = await f.hooks.enable([]);
  assert.equal(r.ok, true);
  let s = json(settingsOf(f.dirs[0]));
  assert.equal(s.theme, 'dark', 'the other program\'s change stays');
  assert.equal(marked(s).length, 6, 'Solio\'s lines are there after the second try');
  assert.ok(backupSeen, 'a copy of the old content existed while writing');
  assert.deepEqual(filesIn(f.dirs[0]), ['settings.json'], 'the copy is deleted');
  await f.hooks.close();
  // 쓴 바로 뒤에 파일이 깨진다: 그때만 사본으로 되돌린다
  f = setup({ files: { 0: start }, fsImpl: racingFs({ onRename: async (n, file) => { if (n === 1) fs.writeFileSync(file, '{ "half'); } }) });
  r = await f.hooks.enable([]);
  assert.deepEqual([r.ok, r.code], [false, 'WRITE']);
  assert.equal(read(settingsOf(f.dirs[0])), start, 'the old content is back');
  assert.deepEqual(filesIn(f.dirs[0]), ['settings.json'], 'and the copy (with its env) is gone');
  assert.equal(f.hooks.listening(), false);
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

test('r8 GA2: after an unhook run, a hook from an old session is refused at once and the minute check closes the server with no request', async () => {
  let tick = null;
  const f = setup({ setInterval: fn => { tick = fn; return { unref() {} }; }, clearInterval: () => { tick = null; } });
  await f.hooks.enable([]);
  const { port, path: p } = where(f);
  const other = createOfficeHooks({ fsImpl: guardedFs, userData: f.userData, installed: false, env: { [OVERRIDE_ENV]: f.dirs.join(path.delimiter) }, baseDirs: () => [] });
  await other.unhook();
  // 이미 돌던 Claude Code 세션은 옛 설정을 쥐고 있어 같은 주소로 보낸다. 받지 않는다
  const answer = await post(port, p, toolUse({ tool_name: 'Read', tool_input: { file_path: 'C:\\a\\b.ts' } }));
  assert.notEqual(answer, 204);
  await settle();
  assert.deepEqual(f.delivered, []);
  assert.equal(f.hooks.listening(), false, 'the refused request also closes the server');
  // 요청이 없어도 1분 확인이 닫는다
  const g = setup({ setInterval: fn => { tick = fn; return { unref() {} }; }, clearInterval: () => { tick = null; } });
  await g.hooks.enable([]);
  assert.equal(typeof tick, 'function', 'the server starts a minute check');
  await createOfficeHooks({ fsImpl: guardedFs, userData: g.userData, installed: false, env: { [OVERRIDE_ENV]: g.dirs.join(path.delimiter) }, baseDirs: () => [] }).unhook();
  tick();
  for (let i = 0; i < 20 && g.hooks.listening(); i++) await settle();
  assert.equal(g.hooks.listening(), false);
  assert.equal(tick, null, 'the check stops with the server');
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

test('a running app notices that the unhook run turned hooks off and closes its server', async () => {
  const f = setup();
  await f.hooks.enable([]);
  assert.equal(f.hooks.listening(), true);
  const other = createOfficeHooks({ fsImpl: guardedFs, userData: f.userData, installed: false, env: { [OVERRIDE_ENV]: f.dirs.join(path.delimiter) }, baseDirs: () => [] });
  await other.unhook();
  const status = await f.hooks.status([]);
  assert.equal(status.on, false);
  assert.equal(f.hooks.listening(), false);
});

test('turning off where a recorded file cannot be read keeps that folder on and says why', async () => {
  const f = setup({ dirs: 2 });
  await f.hooks.enable([]);
  fs.writeFileSync(settingsOf(f.dirs[1]), '{ "hooks": // 손님이 주석을 넣었다\n}');
  const off = await f.hooks.disable();
  assert.deepEqual([off.ok, off.code], [false, 'READ']);
  const status = await f.hooks.status([]);
  assert.equal(status.on, true, 'still on: lines are left in one file');
  assert.deepEqual(status.dirs.map(d => [d.on, d.code]), [[false, null], [true, 'READ']]);
  assert.equal(f.hooks.listening(), true, 'the server stays open for the lines that remain');
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

/* GPT 검수 r9 GA6: 받을지는 소식마다 상태 파일을 새로 읽어 정한다(12.2 「받을지 정하는 때」) */
test('r9 GA6: a hook allowed before an unhook run is not delivered when its body ends after the run finished', async () => {
  let allowedNow;
  const allowedSeen = new Promise(r => { allowedNow = r; });
  const f = setup({ accepts: () => { allowedNow(); return true; } });
  await f.hooks.enable([]);
  const { port, path: p } = where(f);
  const body = Buffer.from(JSON.stringify(toolUse({ tool_name: 'Read', tool_input: { file_path: 'C:\\a\\b.ts' } })));
  let status = null;
  const done = new Promise(resolve => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method: 'POST', headers: { 'content-length': body.length, 'content-type': 'application/json' } }, res => { status = res.statusCode; res.resume(); res.on('end', resolve); });
    req.on('error', () => resolve());
    req.write(body.subarray(0, 10));
    // 받기를 허락한 뒤, 몸이 끝나기 전에 다른 실행이 끄기를 마친다
    allowedSeen.then(async () => {
      await createOfficeHooks({ fsImpl: guardedFs, userData: f.userData, installed: false, env: { [OVERRIDE_ENV]: f.dirs.join(path.delimiter) }, baseDirs: () => [] }).unhook();
      req.end(body.subarray(10));
    });
  });
  await done;
  await settle();
  assert.deepEqual(f.delivered, [], 'the news is not delivered');
  assert.notEqual(status, 204);
  for (let i = 0; i < 20 && f.hooks.listening(); i++) await settle();
  assert.equal(f.hooks.listening(), false, 'the server closes after seeing the change');
});

test('r9 GA6: a change made while the app reads its state file is not lost; the next look rereads it', async () => {
  let armed = false;
  const f = setup({
    fsImpl: { ...guardedFs, promises: { ...guardedFs.promises, readFile: async (file, enc) => {
      const out = await guardedFs.promises.readFile(file, enc);
      // 앱이 상태 파일을 읽은 바로 뒤에 다른 실행이 끔을 적는다
      if (armed && String(file).endsWith('hooks.json')) { armed = false; const v = JSON.parse(out); fs.writeFileSync(file, JSON.stringify({ ...v, enabled: false, dirs: [] }, null, 2) + '\n'); }
      return out;
    } } },
  });
  await f.hooks.enable([]);
  armed = true;
  await f.hooks.status([]); // 읽는 사이에 바뀌었다
  const later = await f.hooks.status([]);
  assert.equal(later.on, false, 'the change made during the read is seen on the next look');
  assert.equal(f.hooks.listening(), false);
});

test('the module writes only inside the test folders (never the real Claude settings or the app folders)', () => {
  const under = (p, root) => { const a = path.resolve(p).toLowerCase(), b = path.resolve(root).toLowerCase(); return a === b || a.startsWith(b + path.sep); };
  assert.ok(writes.length > 0, 'the guard saw the module write');
  assert.deepEqual(writes.filter(p => !made.some(root => under(p, root))), [], 'every write of the module is inside a test folder');
  if (APPDATA_SYNK) assert.ok(!path.resolve(os.tmpdir()).toLowerCase().startsWith(APPDATA_SYNK.toLowerCase()), 'the test folders are not inside the app folder');
});
