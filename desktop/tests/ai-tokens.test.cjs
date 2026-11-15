'use strict';
// 모델별 토큰(11-15) 본체 시험: 도구마다 기록을 읽는 법, 같은 응답을 한 번만 세는지, 이어 읽기 · 줄어든 파일 · 지워진 파일 · 끄기.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { createTokenUsage, claudeLine, codexLine, grokFile, geminiFile, readLines, readZstLines, dayKey } = require('../src/ai-tokens.cjs');

const T = Date.parse('2026-11-15T03:00:00.000Z');
// 판의 순서 번호(epoch · seq)는 견주기에서 뺀다.
const plain = ({ epoch, seq, ...rest } = {}) => rest;
const iso = t => new Date(t).toISOString();
// Claude Code 2.1.325 줄 모양(열쇠 순서 그대로): message의 첫 열쇠가 model · id, 맨 위 type은 끝 가까이.
function claudeRow({ id = 'msg_1', model = 'claude-opus-5-5', out = 100, inp = 3, cr = 1000, cw = 50, think = 40, t = T, content = [{ type: 'text', text: 'hi' }], sidechain = false } = {}) {
  return JSON.stringify({ parentUuid: 'p', isSidechain: sidechain, message: { model, id, type: 'message', role: 'assistant', content, stop_reason: null, usage: { input_tokens: inp, cache_creation_input_tokens: cw, cache_read_input_tokens: cr, output_tokens: out, output_tokens_details: { thinking_tokens: think }, iterations: [{ input_tokens: inp, output_tokens: out }] } }, requestId: 'req_1', type: 'assistant', uuid: 'u-' + id + '-' + out, timestamp: iso(t), cwd: 'C:\\x', sessionId: 's', version: '2.1.325' });
}
const userRow = text => JSON.stringify({ parentUuid: 'p', isSidechain: false, promptId: 'x', type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: text }] }, uuid: 'uu', timestamp: iso(T) });

test('Claude 줄: 같은 응답은 한 번만 세고, 뒤 줄의 더 큰 값만 메운다', () => {
  const st = { seen: new Map(), recent: [] };
  const a = claudeLine(claudeRow({ out: 2, think: 0 }), st);
  assert.deepEqual([a.model, a.in, a.out, a.cr, a.cw, a.rs, a.n], ['claude-opus-5-5', 3, 2, 1000, 50, 0, undefined]);
  // 같은 id의 뒤 줄(스트리밍 끝값): 출력 1,093 · 생각 40 — 차이만, 응답 수 0.
  const b = claudeLine(claudeRow({ out: 1093, think: 40 }), st);
  assert.deepEqual([b.out, b.rs, b.in, b.cr, b.n], [1091, 40, 0, 0, 0]);
  // 같은 값이 또 오면 아무것도 더하지 않는다.
  assert.equal(claudeLine(claudeRow({ out: 1093, think: 40 }), st), null);
  // 다른 응답은 새로 센다.
  assert.equal(claudeLine(claudeRow({ id: 'msg_2', out: 7 }), st).out, 7);
});

test('Claude 줄: 도구 결과 · 합성 응답 · 다른 종류 줄은 세지 않고, 도구 입력 속 model · usage 열쇠에 속지 않는다', () => {
  const st = { seen: new Map(), recent: [] };
  assert.equal(claudeLine(userRow('"type":"assistant" 처럼 보이는 글'), st), null);
  assert.equal(claudeLine(claudeRow({ model: '<synthetic>' }), st), null);
  assert.equal(claudeLine(JSON.stringify({ type: 'progress', data: { message: JSON.parse(claudeRow()) } }), st), null);
  // 도구 호출 입력(객체)에 model과 usage 열쇠가 있어도 message의 값을 쓴다.
  const tricky = claudeRow({ id: 'msg_t', out: 55, content: [{ type: 'tool_use', name: 'Agent', input: { model: 'fable', usage: { output_tokens: 999999 }, prompt: 'x'.repeat(5000) } }] });
  const r = claudeLine(tricky, st);
  assert.deepEqual([r.model, r.out], ['claude-opus-5-5', 55]);
  // 열쇠 순서가 다른 줄(빠른 길이 못 읽는 모양)은 줄 전체를 읽어 같은 값을 낸다.
  const odd = JSON.stringify({ type: 'assistant', timestamp: iso(T), message: { id: 'msg_o', usage: { output_tokens: 9, input_tokens: 1 }, model: 'claude-fable-5-2' } });
  const o = claudeLine(odd, st);
  assert.deepEqual([o.model, o.out, o.in], ['claude-fable-5-2', 9, 1]);
});

test('Codex 줄: 모델은 앞 turn_context에서, 되풀이된 사건은 한 번, 캐시 읽기는 입력에서 뺀다', () => {
  const st = { model: null, total: null, prev: null };
  const ctx = model => JSON.stringify({ timestamp: iso(T), type: 'turn_context', payload: { turn_id: 't', cwd: 'C:\\x', model, collaboration_mode: { settings: { model } } } });
  const tc = (total, last) => JSON.stringify({ timestamp: iso(T), ordinal: 1, type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: total, last_token_usage: last } } });
  const u = (i, c, o, r) => ({ input_tokens: i, cached_input_tokens: c, cache_write_input_tokens: 0, output_tokens: o, reasoning_output_tokens: r, total_tokens: i + o });
  assert.equal(codexLine(ctx('gpt-6-astra'), st), null);
  const a = codexLine(tc(u(1000, 900, 50, 10), u(1000, 900, 50, 10)), st);
  assert.deepEqual([a.model, a.in, a.cr, a.out, a.rs], ['gpt-6-astra', 100, 900, 50, 10]);
  // 같은 누적값을 다시 알린 사건은 건너뛴다.
  assert.equal(codexLine(tc(u(1000, 900, 50, 10), u(1000, 900, 50, 10)), st), null);
  codexLine(ctx('gpt-6.1-sol'), st);
  const b = codexLine(tc(u(3000, 2700, 80, 0), u(2000, 1800, 30, 0)), st);
  assert.deepEqual([b.model, b.in, b.cr, b.out], ['gpt-6.1-sol', 200, 1800, 30]);
  // last가 없는 옛 기록은 누적의 늘어난 만큼.
  const c = codexLine(tc(u(3500, 3000, 100, 0), null), st);
  assert.deepEqual([c.in, c.cr, c.out], [200, 300, 20]);
  // 다른 사건 줄은 무시.
  assert.equal(codexLine(JSON.stringify({ timestamp: iso(T), type: 'response_item', payload: { type: 'message', text: '"type":"token_count"' } }), st), null);
});

test('Grok · Gemini CLI 파일: 회차 · 메시지마다 모델별로, Gemini는 생각을 출력에 더한다', () => {
  const grok = grokFile(JSON.stringify({ turns: [{ endedAt: iso(T), modelUsage: { 'grok-4.7-build': { inputTokens: 613025, outputTokens: 20561, cachedReadTokens: 445312, reasoningTokens: 17281, modelCalls: 2 } } }] }));
  assert.deepEqual(grok.map(g => [g.model, g.in, g.out, g.cr, g.rs, g.calls]), [['grok-4.7-build', 167713, 20561, 445312, 17281, 2]]);
  const meta = JSON.stringify({ sessionId: 's', kind: 'main' });
  const msg = (id, out, th) => ({ id, timestamp: iso(T), type: 'gemini', model: 'gemini-3.5-flash', tokens: { input: 13859, output: out, cached: 1000, thoughts: th, tool: 0, total: 0 } });
  // 같은 메시지가 $set으로 다시 오면 마지막 값 하나.
  const text = [meta, JSON.stringify({ $set: { messages: [msg('a', 1, 85)] } }), JSON.stringify({ $set: { messages: [msg('a', 5, 85), msg('b', 10, 0)] } })].join('\n');
  const gem = geminiFile(text);
  assert.deepEqual(gem.map(g => [g.model, g.in, g.out, g.cr, g.rs]).sort(), [['gemini-3.5-flash', 12859, 10, 1000, 0], ['gemini-3.5-flash', 12859, 90, 1000, 85]]);
  // 옛 .json 한 덩이 모양도.
  assert.equal(geminiFile(JSON.stringify({ messages: [msg('c', 3, 0)] })).length, 1);
});

test('줄 읽기: 덩이(4MB)를 넘는 긴 줄과 쓰는 중인 마지막 줄', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tokens-lines-'));
  try {
    const file = path.join(dir, 'a.jsonl');
    const long = 'x'.repeat(9 * 1024 * 1024);
    fs.writeFileSync(file, `one\n${long}\nthree\npartial`);
    const lines = [];
    const end = await readLines(file, 0, fs.statSync(file).size, b => lines.push(b.length > 20 ? b.length : b.toString()));
    assert.deepEqual(lines, ['one', long.length, 'three']);
    assert.equal(end, fs.statSync(file).size - 'partial'.length);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

function fakeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tokens-home-'));
  const write = (rel, text) => { const f = path.join(home, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return f; };
  return { home, write, root: path.join(home, 'AppData', 'AiSubscriptions') };
}

test('본체: 켜야 세고, 파일을 가로질러 날짜 · 도구 · 모델로 모으고, 이어 읽기 · 줄어든 파일 · 지워진 파일 · 끄기를 지킨다', async () => {
  const { home, write, root } = fakeHome();
  try {
    let now = T + 3600e3;
    const events = [];
    const main = write('.claude/projects/p/s1.jsonl', [claudeRow({ id: 'm1', out: 2 }), userRow('big'), claudeRow({ id: 'm1', out: 300 }), claudeRow({ id: 'm2', model: 'claude-fable-5-2', out: 40 })].join('\n') + '\n');
    write('.claude/projects/p/s1/subagents/agent-a1.jsonl', claudeRow({ id: 'm3', model: 'claude-sonnet-5-5', out: 5, sidechain: true }) + '\n');
    write('.codex/sessions/2026/11/15/rollout-x.jsonl', [
      JSON.stringify({ timestamp: iso(T), type: 'turn_context', payload: { model: 'gpt-6-astra' } }),
      JSON.stringify({ timestamp: iso(T), type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 10, cached_input_tokens: 0, output_tokens: 4, total_tokens: 14 }, last_token_usage: { input_tokens: 10, cached_input_tokens: 0, output_tokens: 4, total_tokens: 14 } } } }),
    ].join('\n') + '\n');
    write('.grok/sessions/c/s/usage.json', JSON.stringify({ turns: [{ endedAt: iso(T), modelUsage: { 'grok-4.7-build': { inputTokens: 10, outputTokens: 6, cachedReadTokens: 0, modelCalls: 1 } } }] }));
    fs.mkdirSync(path.join(home, '.gemini/antigravity-cli/conversations'), { recursive: true });
    const u = createTokenUsage({ root, home, env: {}, now: () => now, onChange: s => events.push(s) });
    // 꺼져 있으면 아무것도 읽지 않는다.
    assert.deepEqual(plain(await u.scan({ force: true })), { ok: true, enabled: false });
    assert.equal(fs.existsSync(path.join(root, 'token-usage.json')), false);
    await u.setEnabled(true);
    let s = await u.scan({ force: true });
    const day = dayKey(T);
    const cell = (svc, model) => s.cells.find(c => c[0] === day && c[1] === svc && c[2] === model);
    assert.deepEqual(cell('claude', 'claude-opus-5-5').slice(3), [3, 300, 1000, 50, 40, 1]);
    assert.deepEqual(cell('claude', 'claude-fable-5-2').slice(3, 5), [3, 40]);
    assert.equal(cell('claude', 'claude-sonnet-5-5')[4], 5);
    assert.deepEqual(cell('gpt', 'gpt-6-astra').slice(3, 5), [10, 4]);
    assert.deepEqual(cell('grok', 'grok-4.7-build').slice(3, 5), [10, 6]);
    assert.deepEqual([s.tools.claude, s.tools.gpt, s.tools.grok, s.tools.gemini, s.tools.agy], [2, 1, 1, 0, true]);
    assert.ok(events.some(e => e.progress && e.progress.total === 4));
    // 저장 파일에는 숫자와 자리만 — 대화 글은 없다.
    const saved = fs.readFileSync(path.join(root, 'token-usage.json'), 'utf8');
    assert.equal(saved.includes('big'), false);
    assert.equal(saved.includes('hi'), false);
    // 이어 쓰기: 앞 회차 끝 응답(m2)의 뒤 줄과 새 응답(m4)만 더한다. 쓰는 중인 마지막 줄은 다음에.
    fs.appendFileSync(main, claudeRow({ id: 'm2', model: 'claude-fable-5-2', out: 45 }) + '\n' + claudeRow({ id: 'm4', out: 1 }) + '\n' + claudeRow({ id: 'm5', out: 1000 }));
    now += 10 * 60e3;
    s = await u.scan({ force: true });
    assert.deepEqual([cell('claude', 'claude-fable-5-2')[4], cell('claude', 'claude-fable-5-2')[8]], [45, 1]);
    assert.deepEqual([cell('claude', 'claude-opus-5-5')[4], cell('claude', 'claude-opus-5-5')[8]], [301, 2]);
    // 다 쓴 줄은 다음 회차에 센다.
    fs.appendFileSync(main, '\n');
    s = await u.scan({ force: true });
    assert.equal(cell('claude', 'claude-opus-5-5')[4], 1301);
    // 5분 안에는 다시 세지 않는다(force가 아니면).
    fs.appendFileSync(main, claudeRow({ id: 'm6', out: 1 }) + '\n');
    s = await u.scan();
    assert.equal(cell('claude', 'claude-opus-5-5')[4], 1301);
    // 파일이 줄었으면(새로 쓴 파일) 앞에서 센 숫자는 두고 처음부터 읽으며 새 응답만 더한다(같은 응답을 가진 다른 파일의 몫이 빠지지 않게).
    fs.writeFileSync(main, claudeRow({ id: 'm1', out: 300 }) + '\n' + claudeRow({ id: 'n1', out: 9 }) + '\n');
    s = await u.scan({ force: true });
    assert.equal(cell('claude', 'claude-opus-5-5')[4], 1310);
    // 원래 기록이 지워져도 센 숫자는 남는다.
    fs.rmSync(path.join(home, '.grok'), { recursive: true, force: true });
    s = await u.scan({ force: true });
    assert.equal(cell('grok', 'grok-4.7-build')[4], 6);
    // 다시 만든 판(앱을 다시 켬)도 저장한 데서 잇는다.
    const again = createTokenUsage({ root, home, env: {}, now: () => now });
    assert.equal(again.state().cells.find(c => c[1] === 'grok')[4], 6);
    // 끄면 모은 숫자와 파일을 지운다.
    assert.deepEqual(plain(await u.setEnabled(false)), { ok: true, enabled: false });
    assert.equal(fs.existsSync(path.join(root, 'token-usage.json')), false);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('본체: 계정판이 연결한 Claude 계정 폴더 · CLAUDE_CONFIG_DIR · CODEX_HOME도 읽고, 오래된 날은 화면 판에서 뺀다', async () => {
  const { home, write, root } = fakeHome();
  try {
    const now = T;
    write('custom-claude/projects/p/a.jsonl', claudeRow({ id: 'c1', out: 11 }) + '\n');
    write('acct/projects/p/b.jsonl', claudeRow({ id: 'c2', out: 22 }) + '\n' + claudeRow({ id: 'old', out: 99, t: T - 60 * 864e5 }) + '\n');
    write('codex-home/sessions/rollout-r.jsonl', [JSON.stringify({ timestamp: iso(T), type: 'turn_context', payload: { model: 'gpt-6.1-sol' } }), JSON.stringify({ timestamp: iso(T), type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 }, last_token_usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 } } } })].join('\n') + '\n');
    const u = createTokenUsage({ root, home, env: { CLAUDE_CONFIG_DIR: path.join(home, 'custom-claude'), CODEX_HOME: path.join(home, 'codex-home') }, now: () => now, claudeDirs: () => [path.join(home, 'acct')] });
    await u.setEnabled(true);
    const s = await u.scan({ force: true });
    const out = s.cells.filter(c => c[1] === 'claude').reduce((n, c) => n + c[4], 0);
    assert.equal(out, 33);
    assert.equal(s.cells.find(c => c[1] === 'gpt')[2], 'gpt-6.1-sol');
    // 60일 전 응답은 저장은 하되(400일까지) 화면 판(35일)에는 없다.
    assert.equal(s.cells.some(c => c[4] === 99), false);
    assert.equal(s.since, dayKey(T - 60 * 864e5));
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

// Codex 줄 모양(11-15 이 PC 기록): 회차 정보 · 응답 기록(token_usage_record) · 사건(token_count).
const cx = {
  ctx: model => JSON.stringify({ timestamp: iso(T), type: 'turn_context', payload: { model } }),
  rec: (id, i, c, o) => JSON.stringify({ timestamp: iso(T), type: 'token_usage_record', payload: { response_id: id, usage: { input_tokens: i, cached_input_tokens: c, cache_write_input_tokens: 0, output_tokens: o, reasoning_output_tokens: 0, total_tokens: i + o } } }),
  tc: (ti, to, li, lo) => JSON.stringify({ timestamp: iso(T), type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: ti, cached_input_tokens: 0, output_tokens: to, total_tokens: ti + to }, last_token_usage: { input_tokens: li, cached_input_tokens: 0, output_tokens: lo, total_tokens: li + lo } } } }),
};

test('Codex: 응답 기록이 있으면 그것으로 세고(사건은 버림), 없으면 사건으로 센다', async () => {
  const { home, write, root } = fakeHome();
  try {
    // 응답 둘 사이에 사건이 하나뿐이라 사건으로 세면 30만 잡히는 파일(실제 이 PC에서 10.6% 적게 잡힌 까닭).
    write('.codex/sessions/2026/11/15/rollout-a.jsonl', [cx.ctx('gpt-6-astra'), cx.rec('r1', 100, 0, 20), cx.rec('r2', 100, 0, 30), cx.tc(200, 50, 100, 30)].join('\n') + '\n');
    write('.codex/sessions/2026/11/15/rollout-old.jsonl', [cx.ctx('gpt-5-codex'), cx.tc(10, 4, 10, 4), cx.tc(25, 9, 15, 5)].join('\n') + '\n');
    const u = createTokenUsage({ root, home, env: {}, now: () => T });
    await u.setEnabled(true);
    const s = await u.scan({ force: true });
    const cell = m => s.cells.find(c => c[2] === m);
    assert.deepEqual(cell('gpt-6-astra').slice(3, 5).concat(cell('gpt-6-astra')[8]), [200, 50, 2]);
    assert.deepEqual(cell('gpt-5-codex').slice(3, 5).concat(cell('gpt-5-codex')[8]), [25, 9, 2]);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('Codex: 보관 폴더로 옮기거나 압축해도 한 세션으로 한 번만 센다', async () => {
  const { home, write, root } = fakeHome();
  try {
    const body = [cx.ctx('gpt-6-astra'), cx.rec('r1', 1000, 0, 1000)].join('\n') + '\n';
    const live = write('.codex/sessions/2026/11/15/rollout-x.jsonl', body);
    let now = T;
    const u = createTokenUsage({ root, home, env: {}, now: () => now });
    await u.setEnabled(true);
    const out = s => s.cells.filter(c => c[1] === 'gpt').reduce((n, c) => n + c[4], 0);
    assert.equal(out(await u.scan({ force: true })), 1000);
    // 옮기기(Fable 설계 검토 1 재현: 1,000 → 2,000이던 것).
    fs.mkdirSync(path.join(home, '.codex/archived_sessions'), { recursive: true });
    fs.renameSync(live, path.join(home, '.codex/archived_sessions/rollout-x.jsonl'));
    now += 600e3;
    assert.equal(out(await u.scan({ force: true })), 1000);
    // 압축본으로 바뀌기(.jsonl은 사라지고 .jsonl.zst만).
    fs.writeFileSync(path.join(home, '.codex/archived_sessions/rollout-x.jsonl.zst'), zlib.zstdCompressSync(Buffer.from(body)));
    fs.rmSync(path.join(home, '.codex/archived_sessions/rollout-x.jsonl'));
    now += 600e3;
    let s = await u.scan({ force: true });
    assert.deepEqual([out(s), s.cells.find(c => c[1] === 'gpt')[8], s.failed], [1000, 1, 0]);
    // 압축본만 있는 옛 세션도 읽는다(마지막 줄바꿈이 없어도).
    fs.writeFileSync(path.join(home, '.codex/archived_sessions/rollout-y.jsonl.zst'), zlib.zstdCompressSync(Buffer.from([cx.ctx('gpt-6.1-sol'), cx.rec('y1', 5, 0, 7)].join('\n'))));
    now += 600e3;
    s = await u.scan({ force: true });
    assert.equal(s.cells.find(c => c[2] === 'gpt-6.1-sol')[4], 7);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('Claude: 두 프로젝트 폴더에 같은 세션이 있어도 응답은 한 번, 다시 쓴 파일은 제 몫을 놓아주고 다시 센다', async () => {
  const { home, write, root } = fakeHome();
  try {
    const rows = [claudeRow({ id: 'a1', out: 100 }), claudeRow({ id: 'a2', out: 50 })].join('\n') + '\n';
    const one = write('.claude/projects/main/s.jsonl', rows);
    write('.claude/projects/main-worktree/s.jsonl', rows + claudeRow({ id: 'a3', out: 7 }) + '\n');
    let now = T;
    const u = createTokenUsage({ root, home, env: {}, now: () => now });
    await u.setEnabled(true);
    const out = s => s.cells.filter(c => c[1] === 'claude').reduce((n, c) => n + c[4], 0);
    assert.equal(out(await u.scan({ force: true })), 157);
    // 한쪽을 새로 써도(줄어든 파일) 다른 쪽이 센 응답은 두 번 세지 않고, 새 응답만 더한다.
    fs.writeFileSync(one, claudeRow({ id: 'a1', out: 100 }) + '\n' + claudeRow({ id: 'b1', out: 1 }) + '\n');
    now += 600e3;
    assert.equal(out(await u.scan({ force: true })), 158);
    // 앱을 다시 켜도(저장한 주인표로) 같은 값.
    const again = createTokenUsage({ root, home, env: {}, now: () => now });
    assert.equal(out(await again.scan({ force: true })), 158);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('본체: 도구마다 시작 날, 지워진 지 40일 뒤에는 숫자만 남기기, 뒤에서 세기는 3시간마다, 옛 판 저장 파일은 다시 센다', async () => {
  const { home, write, root } = fakeHome();
  try {
    write('.claude/projects/p/a.jsonl', claudeRow({ id: 'c1', out: 11, t: T - 20 * 864e5 }) + '\n');
    write('.codex/sessions/rollout-z.jsonl', [cx.ctx('gpt-6-astra'), cx.rec('z1', 1, 0, 2)].join('\n') + '\n');
    let now = T;
    const u = createTokenUsage({ root, home, env: {}, now: () => now });
    await u.setEnabled(true);
    let s = await u.scan({ force: true });
    assert.deepEqual(s.sinceBy, { claude: dayKey(T - 20 * 864e5), gpt: dayKey(T) });
    // 원래 파일이 지워지면: 숫자는 남고, 40일이 지나면 항목 없이 「지워진 기록」 합으로.
    fs.rmSync(path.join(home, '.claude'), { recursive: true, force: true });
    now += 600e3; s = await u.scan({ force: true });
    assert.equal(s.cells.find(c => c[1] === 'claude')[4], 11);
    now += 41 * 864e5; await u.scan({ force: true });
    const saved = JSON.parse(fs.readFileSync(path.join(root, 'token-usage.json'), 'utf8'));
    assert.equal(Object.keys(saved.files).some(k => k.includes('.claude')), false);
    assert.equal(Object.values(saved.goneAgg).reduce((n, c) => n + c[1], 0), 11);
    // 뒤에서 세기: 3시간이 안 지났으면 읽지 않는다.
    write('.codex/sessions/rollout-z2.jsonl', [cx.ctx('gpt-6-astra'), cx.rec('z2', 1, 0, 5)].join('\n') + '\n');
    now += 3600e3; s = await u.auto();
    assert.equal(s.tools.gpt, 1);
    now += 3 * 3600e3; s = await u.auto();
    assert.equal(s.tools.gpt, 2);
    // 옛 판(schema 1) 저장 파일: 켠 상태만 잇고 처음부터 다시 센다. 남은 임시 파일은 치운다.
    fs.writeFileSync(path.join(root, 'token-usage.json'), JSON.stringify({ schemaVersion: 1, enabled: true, enabledAt: T, files: { x: { agg: { [dayKey(T) + '|gpt|old']: [1, 999, 0, 0, 0, 1] } } } }));
    fs.writeFileSync(path.join(root, 'token-usage.json.1.2.tmp'), 'left over');
    const fresh = createTokenUsage({ root, home, env: {}, now: () => now });
    assert.deepEqual([fresh.state().enabled, fresh.state().scannedAt, fresh.state().cells.length], [true, null, 0]);
    assert.equal(fs.existsSync(path.join(root, 'token-usage.json.1.2.tmp')), false);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('Claude: 사본이 스트리밍 중간값만 가진 채 먼저 읽혀도 원래 파일의 최종값으로 한 번 센다(GPT 지적)', async () => {
  // 어느 쪽을 먼저 읽든 같아야 한다 — 폴더 이름을 바꿔 두 차례로 본다.
  for (const [copyDir, origDir] of [['a-copy', 'b-orig'], ['b-copy', 'a-orig']]) {
    const { home, write, root } = fakeHome();
    try {
      write(`.claude/projects/${copyDir}/s.jsonl`, claudeRow({ id: 'x1', out: 2, think: 0 }) + '\n');
      write(`.claude/projects/${origDir}/s.jsonl`, [claudeRow({ id: 'x1', out: 2, think: 0 }), claudeRow({ id: 'x1', out: 1093, think: 40 })].join('\n') + '\n');
      const u = createTokenUsage({ root, home, env: {}, now: () => T });
      await u.setEnabled(true);
      const s = await u.scan({ force: true });
      const cells = s.cells.filter(c => c[1] === 'claude');
      const sum = i => cells.reduce((n, c) => n + c[i], 0);
      assert.deepEqual([sum(4), sum(7), sum(8), sum(5)], [1093, 40, 1, 1000], copyDir);
      // 다시 세도(둘 다 바뀌지 않음) 같은 값, 앱을 다시 켜도 같은 값.
      assert.equal((await u.scan({ force: true })).cells.filter(c => c[1] === 'claude').reduce((n, c) => n + c[4], 0), 1093);
      const again = createTokenUsage({ root, home, env: {}, now: () => T });
      assert.equal((await again.scan({ force: true })).cells.filter(c => c[1] === 'claude').reduce((n, c) => n + c[4], 0), 1093);
    } finally { fs.rmSync(home, { recursive: true, force: true }); }
  }
});

test('Claude 줄: 줄 끝 가까이 도구 입력의 timestamp 칸에 속지 않고, 시각을 못 읽은 응답은 id를 잡지 않는다(카본 지적)', () => {
  const st = { seen: new Map(), recent: [], owners: new Map(), mine: [], file: 'f' };
  const row = claudeRow({ id: 'msg_ts', out: 12, content: [{ type: 'tool_use', name: 'Write', input: { body: 'x'.repeat(3000), timestamp: 'not-a-date!!' } }] });
  const r = claudeLine(row, st);
  assert.deepEqual([r.out, r.t], [12, T]);
  // 맨 위 시각이 깨진 줄은 세지 않고, 주인표에도 남기지 않는다(남기면 그 응답이 다른 파일에서도 영영 빠진다).
  const broken = claudeRow({ id: 'msg_bad', out: 5 }).replace(/"timestamp":"[^"]+"/, '"timestamp":"??"');
  assert.equal(claudeLine(broken, st), null);
  assert.equal(st.mine.length, 1);
});

test('Codex: 옛 판으로 쓴 세션을 새 판으로 이어 쓰면 앞 사건과 뒤 응답 기록을 모두 한 번씩 센다(GPT 지적)', async () => {
  const { home, write, root } = fakeHome();
  try {
    const f = write('.codex/sessions/2026/11/15/rollout-old.jsonl', [cx.ctx('gpt-5-codex'), cx.tc(10, 4, 10, 4)].join('\n') + '\n');
    let now = T;
    const u = createTokenUsage({ root, home, env: {}, now: () => now });
    await u.setEnabled(true);
    const out = s => s.cells.filter(c => c[1] === 'gpt').reduce((n, c) => n + c[4], 0);
    const n = s => s.cells.filter(c => c[1] === 'gpt').reduce((k, c) => k + c[8], 0);
    assert.equal(out(await u.scan({ force: true })), 4);
    // 새 판으로 이어 쓰기: 응답마다 기록을 먼저, 같은 응답의 사건을 뒤에 적는다.
    fs.appendFileSync(f, [cx.ctx('gpt-6-astra'), cx.rec('r1', 5, 0, 5), cx.tc(15, 9, 5, 5)].join('\n') + '\n');
    now += 600e3;
    let s = await u.scan({ force: true });
    assert.deepEqual([out(s), n(s)], [9, 2]);
    // 처음부터 다시 세어도(새 본체) 같은 값.
    const fresh = createTokenUsage({ root: root + '-2', home, env: {}, now: () => now });
    await fresh.setEnabled(true);
    s = await fresh.scan({ force: true });
    assert.deepEqual([out(s), n(s)], [9, 2]);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('압축 기록: 열지 못한 파일 · 깨진 압축본은 읽지 못한 파일로 세고 멈추지 않는다(카본 지적)', async () => {
  const { home, write, root } = fakeHome();
  try {
    // 읽기 쪽 오류(없는 파일)도 반복에서 던진다 — pipe()로 이으면 처리 안 된 오류로 본체가 멈췄다.
    await assert.rejects(readZstLines(path.join(home, 'nope.jsonl.zst'), () => {}), { code: 'ENOENT' });
    write('.codex/archived_sessions/rollout-bad.jsonl.zst', 'not zstd at all');
    write('.codex/archived_sessions/rollout-ok.jsonl.zst', '');
    fs.writeFileSync(path.join(home, '.codex/archived_sessions/rollout-ok.jsonl.zst'), zlib.zstdCompressSync(Buffer.from([cx.ctx('gpt-6-astra'), cx.rec('k1', 1, 0, 3)].join('\n') + '\n')));
    const u = createTokenUsage({ root, home, env: {}, now: () => T });
    await u.setEnabled(true);
    const s = await u.scan({ force: true });
    assert.deepEqual([s.failed, s.cells.find(c => c[1] === 'gpt')[4]], [1, 3]);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('끄기: 세는 중에 끄면 새로 세지 않고 지우며, 지우지 못하면 켜진 채로 실패를 알린다(카본 · GPT 지적)', async () => {
  const { home, write, root } = fakeHome();
  try {
    for (let i = 0; i < 40; i++) write(`.claude/projects/p/s${i}.jsonl`, claudeRow({ id: 'k' + i, out: 1 }) + '\n');
    const events = [];
    const u = createTokenUsage({ root, home, env: {}, now: () => T, onChange: s => events.push(s) });
    await u.setEnabled(true);
    // 켜자마자 세기가 돈다. 그 사이 끄고, 끄는 동안 타이머처럼 세기를 또 부른다.
    const off = u.setEnabled(false);
    const during = await u.scan({ force: true });
    assert.deepEqual(plain(during), { ok: true, enabled: false });
    assert.deepEqual(plain(await off), { ok: true, enabled: false });
    await new Promise(r => setTimeout(r, 50));
    assert.equal(fs.existsSync(path.join(root, 'token-usage.json')), false);
    assert.deepEqual(plain(events.at(-1)), { ok: true, enabled: false });
    // 저장 파일을 지우지도 덮지도 못하면(여기서는 그 자리가 폴더) 지운 것처럼 말하지 않고 켜진 채로 둔다.
    await u.setEnabled(true);
    await u.scan({ force: true });
    fs.rmSync(path.join(root, 'token-usage.json'));
    fs.mkdirSync(path.join(root, 'token-usage.json', 'x'), { recursive: true });
    assert.deepEqual(await u.setEnabled(false), { ok: false, code: 'DELETE_FAILED' });
    assert.equal(u.state().enabled, true);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('본체: 처음 세는 동안에도 찾은 파일 수를 판에 올린다(카본 지적)', async () => {
  const { home, write, root } = fakeHome();
  try {
    for (let i = 0; i < 20; i++) write(`.claude/projects/p/s${i}.jsonl`, claudeRow({ id: 'q' + i, out: 1 }) + '\n');
    const seen = [];
    const u = createTokenUsage({ root, home, env: {}, now: () => T, onChange: s => seen.push(s) });
    await u.setEnabled(true);
    await u.scan({ force: true });
    const firstScanning = seen.find(s => s.enabled && s.scanning && s.progress && !s.scannedAt);
    assert.ok(firstScanning, '처음 세는 중 알림이 있다');
    assert.equal(firstScanning.tools.claude, 20);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('일꾼 스레드: 앱이 쓰는 감싸개도 같은 숫자를 내고, 알림을 넘기고, 끄면 지운다', async () => {
  const { createTokenUsageWorker } = require('../src/ai-tokens.cjs');
  const { home, write, root } = fakeHome();
  const extra = path.join(home, 'accounts', 'c2');
  write('.claude/projects/p/a.jsonl', [claudeRow({ id: 'w1', out: 2 }), claudeRow({ id: 'w1', out: 30 })].join('\n') + '\n');
  write('accounts/c2/projects/q/b.jsonl', claudeRow({ id: 'w2', out: 5, model: 'claude-fable-5-2' }) + '\n');
  const events = [];
  const u = createTokenUsageWorker({ root, home, env: {}, claudeDirs: () => [extra], onChange: s => events.push(s) });
  try {
    assert.deepEqual(plain(await u.state()), { ok: true, enabled: false });
    await u.setEnabled(true);
    const s = await u.scan({ force: true });
    const out = s.cells.filter(c => c[1] === 'claude').reduce((n, c) => n + c[4], 0);
    assert.deepEqual([out, s.tools.claude, s.scanning], [35, 2, false]);
    assert.ok(events.some(e => e.enabled && e.progress), '세는 중 알림이 주 프로세스로 넘어온다');
    assert.equal((await u.state()).scannedAt > 0, true);
    assert.deepEqual(plain(await u.setEnabled(false)), { ok: true, enabled: false });
    assert.equal(fs.existsSync(path.join(root, 'token-usage.json')), false);
    u.dispose();
    assert.deepEqual(await u.state(), { ok: false, code: 'TOKENS_WORKER_STOPPED' });
  } finally { u.dispose(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('일꾼 스레드: 켠 적이 없으면 띄우지 않고, 판에는 순서 번호가 붙고, 세다 죽으면 멈춘 판을 알리고 다음 부르기에서 잇는다(Fable 최종 검수 지적)', async () => {
  const { createTokenUsageWorker } = require('../src/ai-tokens.cjs');
  const { home, write, root } = fakeHome();
  for (let i = 0; i < 300; i++) write(`.claude/projects/p/s${i}.jsonl`, Array.from({ length: 40 }, (_, k) => claudeRow({ id: `z${i}-${k}`, out: 1 })).join('\n') + '\n');
  const events = [];
  const u = createTokenUsageWorker({ root, home, env: {}, onChange: s => events.push(s) });
  try {
    // 저장 파일이 없으면 일꾼 없이 꺼짐(순서 번호 0 — 일꾼이 낸 어느 판보다 앞).
    assert.deepEqual([await u.state(), await u.auto(), await u.scan({ force: true })], [{ ok: true, enabled: false, epoch: 0, seq: 0 }, { ok: true, enabled: false, epoch: 0, seq: 0 }, { ok: true, enabled: false, epoch: 0, seq: 0 }]);
    // 켜면 일꾼이 뜨고, 판의 순서 번호는 늘기만 한다.
    const on = await u.setEnabled(true);
    assert.ok(on.epoch > 0 && on.seq > 0);
    await new Promise(r => setTimeout(r, 30));
    // 세는 도중 일꾼이 죽으면: 화면이 「세는 중」에 머물지 않게 멈춘 판이 온다.
    const before = events.filter(e => e.scanning).length;
    assert.ok(before > 0, '세는 중 알림이 있다');
    u.__crashForTest();
    await new Promise(r => setTimeout(r, 200));
    const stopped = events.at(-1);
    assert.deepEqual([stopped.enabled, stopped.scanning, stopped.error], [true, false, 'SCAN_FAILED']);
    const seqs = events.filter(e => e.epoch === on.epoch).map(e => e.seq);
    assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b));
    // 다음 부르기는 새 일꾼이 저장 파일부터 잇는다(새 epoch).
    const done = await u.scan({ force: true });
    assert.ok(done.epoch > on.epoch, '새 일꾼은 더 큰 세대 번호를 쓴다');
    assert.equal(done.cells.filter(c => c[1] === 'claude').reduce((n, c) => n + c[4], 0), 12000);
    // 끄면 일꾼을 내리고, 그 뒤 부르기는 일꾼 없이 꺼짐.
    assert.deepEqual(plain(await u.setEnabled(false)), { ok: true, enabled: false });
    assert.deepEqual(await u.state(), { ok: true, enabled: false, epoch: 0, seq: 0 });
  } finally { u.dispose(); fs.rmSync(home, { recursive: true, force: true }); }
});
