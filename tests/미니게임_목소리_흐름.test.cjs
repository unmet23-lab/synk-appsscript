'use strict';
// 미니게임 목소리 도구를 가짜 Typecast(이 컴퓨터의 127.0.0.1 서버)에 붙여 처음부터 끝까지 돌려 본다. 진짜 Typecast·유료 호출 없음.
//   1) 화면 토큰으로 키 연결 → 샘플 만들기(배역마다 두 줄) → 같은 샘플을 다시 눌러도 다시 사지 않는다
//   2) 저장소 임시 사본의 바람길에 「전부 만들기」 → 확인 → 게임 파일·목록·기록이 바뀌고 도구 이름이 없다 → 다시 눌러도 다시 사지 않는다
//   3) 키가 거절되면(401) 곧바로 멈추고 연결을 지운다. 키는 어떤 파일·출력에도 남지 않는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const G = require('../tools/lib/미니게임목소리_게임.cjs'), V = require('../tools/lib/미니게임목소리.cjs');

const REPO = path.resolve(__dirname, '..');
const TOOL = path.join(REPO, 'tools', '미니게임_목소리.cjs');
const KEY = 'test-key-' + crypto.randomBytes(12).toString('hex');
const hasFfmpeg = !!(G.tool('ffmpeg') && G.tool('ffprobe'));

// 가짜 Typecast: 잔량은 보낸 글자만큼 줄고, 말소리 대신 글 길이만큼 떨리는 소리(44.1kHz wav)를 돌려준다.
function toneWav(text) {
  const rate = 44100, speech = Math.min(3, Math.max(0.8, [...text].length * 0.08)), seconds = speech + 0.5;
  const n = Math.round(rate * seconds), data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / rate, on = t > 0.25 && t < 0.25 + speech ? 1 : 0;
    data.writeInt16LE(Math.round(32767 * on * 0.25 * Math.sin(2 * Math.PI * 200 * t) * (0.55 + 0.45 * Math.sin(2 * Math.PI * 4 * t))), i * 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8); head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
  head.writeUInt32LE(rate, 24); head.writeUInt32LE(rate * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(data.length, 40);
  return { audio: Buffer.concat([head, data]).toString('base64'), audio_duration: seconds };
}
function mockTypecast() {
  const m = { calls: 0, used: 0, plan: 200000, refuse: false, seenKeys: new Set(), prompts: [] };
  m.server = http.createServer(async (req, res) => {
    let raw = ''; for await (const c of req) raw += c;
    m.seenKeys.add(req.headers['x-api-key']);
    const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.headers['x-api-key'] !== KEY) return send(401, { message: 'invalid key' });
    if (req.url === '/v1/users/me/subscription') return send(200, { plan: 'lite', credits: { plan_credits: m.plan, used_credits: m.used } });
    if (req.url === '/v1/text-to-speech/with-timestamps' && req.method === 'POST') {
      if (m.refuse) return send(401, { message: 'revoked' });
      const body = JSON.parse(raw);
      assert.equal(body.model, 'ssfm-v30'); assert.equal(body.output.audio_format, 'wav'); assert.match(body.voice_id, /^tc_[0-9a-f]{24}$/);
      m.calls++; m.used += [...body.text].length; m.prompts.push({ text: body.text, voice: body.voice_id, prompt: body.prompt });
      return send(200, { audio_format: 'wav', words: [{ text: body.text, start: 0.25, end: 1 }], ...toneWav(body.text) });
    }
    send(404, {});
  });
  return new Promise(r => m.server.listen(0, '127.0.0.1', () => { m.origin = 'http://127.0.0.1:' + m.server.address().port; r(m); }));
}
async function startTool(env) {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [TOOL, '--port', String(port)], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
  const base = 'http://127.0.0.1:' + port;
  let page, token;
  try {
    for (let i = 0; i < 100 && !out.includes('미니게임 목소리:'); i++) await new Promise(r => setTimeout(r, 100));
    assert.ok(out.includes('미니게임 목소리:'), '도구가 뜬다: ' + out);
    page = await (await fetch(base + '/')).text();
    token = /const T='([0-9a-f]+)'/.exec(page)?.[1];
    assert.ok(token, '화면 토큰: ' + page.slice(0, 300));
  } catch (error) { child.kill(); throw error; } // 아직 tools에 넣기 전이라 finally가 끄지 못한다.
  const call = async (url, body, browser = false) => {
    const res = await fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(browser ? { Origin: base, 'X-Local-Token': token } : {}) }, body: JSON.stringify(body || {}) });
    return { status: res.status, data: await res.json() };
  };
  const status = async () => (await fetch(base + '/status')).json();
  const finish = async () => {
    for (let i = 0; i < 600; i++) { const s = await status(); if (!s.state.running) return s; await new Promise(r => setTimeout(r, 200)); }
    throw Error('끝나지 않음');
  };
  return { child, call, status, finish, page, output: () => out };
}
const filesUnder = dir => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? filesUnder(path.join(dir, e.name)) : [path.join(dir, e.name)]) : [];
// 일곱 게임의 음성 파일과 게임이 읽는 목록(크기·수정 시각)
const GAME_LISTS = ['korean-racing/assets/narration', 'entry-check/assets/voice', 'story-classroom/assets/voice', 'korean-rhythm/assets/narration', 'talk-rally/assets/voice', 'talk-rally/assets/narration', 'korean-runner/assets/voice', 'order-rush/audio'];
const gameFileStats = () => Object.fromEntries([...GAME_LISTS.flatMap(d => filesUnder(path.join(REPO, 'experiences', ...d.split('/')))), ...['korean-rhythm/narration.mjs', 'korean-runner/voice-timing.mjs'].map(f => path.join(REPO, 'experiences', ...f.split('/')))]
  .map(f => { const s = fs.statSync(f); return [path.relative(REPO, f), `${s.size}:${s.mtimeMs}`]; }));

test('가짜 Typecast로 처음부터 끝까지: 키 연결 → 샘플 → 다시 사지 않기 → 한 게임 전부 적용 → 401이면 멈춤', { skip: !hasFfmpeg && 'ffmpeg 없음', timeout: 240000 }, async () => {
  const mock = await mockTypecast(), vendor = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-mv-vendor-')), copy = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-mv-repo-'));
  const tools = [];
  try {
    // ── 1) 실제 저장소(읽기만) + 임시 원본 폴더: 샘플 ──
    const statsBefore = gameFileStats();
    const a = await startTool({ SYNK_TYPECAST_API: mock.origin, SYNK_MINIGAME_VOICE_VENDOR: vendor }); tools.push(a);
    assert.equal((await a.call('/connect', { key: KEY })).data.error, 'Form token required', '명령으로는 키를 넣지 못한다');
    assert.equal((await a.call('/generate', { mode: 'sample' })).data.error, '먼저 Typecast 키를 연결해 주세요.');
    const connected = await a.call('/connect', { key: KEY }, true);
    assert.equal(connected.status, 200); assert.equal(connected.data.connected, true);
    assert.equal((await a.call('/generate', { mode: 'all', games: ['korean-runner'] })).data.error, '먼저 「샘플 만들기」로 한 글자당 크레딧을 잰다.');
    const started = await a.call('/generate', { mode: 'sample' });
    assert.equal(started.data.started, true);
    let s = await a.finish();
    assert.equal(s.state.phase, '끝', JSON.stringify(s.state));
    const casting = V.loadCasting(), tasks = V.sampleTasks(await V.allJobs({ casting }), casting);
    const expected = V.unique(tasks.map(t => t.job));
    assert.equal(mock.calls, expected.length, '샘플 줄마다 한 번');
    assert.equal(mock.used, V.chars(expected));
    const index = JSON.parse(fs.readFileSync(path.join(vendor, 'samples', 'index.json'), 'utf8'));
    assert.equal(index.length, tasks.length);
    for (const x of index) { assert.ok(fs.existsSync(path.join(vendor, 'samples', ...x.file.split('/'))), x.file); assert.deepEqual(x.problems, [], x.file); }
    assert.equal(JSON.parse(fs.readFileSync(path.join(vendor, 'meter.json'), 'utf8')).perChar, 1);
    assert.equal(s.meter.perChar, 1);
    // 같은 샘플을 다시 눌러도 Typecast를 다시 부르지 않는다
    await a.call('/generate', { mode: 'sample' }); s = await a.finish();
    assert.equal(mock.calls, expected.length, '다시 사지 않는다');
    // 들어 보기: 먼저 어림만 → 확인하면 줄 × 목소리 × 감정마다 한 번, smart에는 앞뒤 글 → 다시 눌러도 다시 사지 않는다
    const hana = { id: 'tc_61659cc118732016a95fe7c6', name: '하나' };
    const audition = { mode: 'audition', name: 'flow-test', voices: [hana], emotions: ['normal', 'smart'],
      lines: [{ game: 'talk-rally', id: 'result-0', previous: '랠리가 끝났어요.', next: '' }, { game: 'korean-racing', id: 'intro' }] };
    const atAudition = mock.calls, quote = await a.call('/generate', audition);
    assert.equal(quote.data.needConfirm, true, JSON.stringify(quote.data)); assert.equal(quote.data.lines, 4); assert.equal(quote.data.contextChars, [...'랠리가 끝났어요.'].length);
    assert.equal(mock.calls, atAudition, '확인 전에는 부르지 않는다');
    assert.equal((await a.call('/generate', { ...audition, confirmed: true })).data.started, true);
    s = await a.finish();
    assert.equal(s.state.phase, '끝', JSON.stringify(s.state)); assert.equal(s.state.audition.made, 4);
    assert.equal(mock.calls - atAudition, 4);
    const smartPrompts = mock.prompts.slice(atAudition).filter(p => p.prompt.emotion_type === 'smart');
    assert.equal(smartPrompts.length, 2);
    assert.deepEqual(smartPrompts.find(p => p.text.startsWith('괜찮아요')).prompt, { emotion_type: 'smart', previous_text: '랠리가 끝났어요.', next_text: '' });
    for (const p of mock.prompts.slice(atAudition)) assert.equal(p.voice, hana.id);
    const aIndex = JSON.parse(fs.readFileSync(path.join(vendor, 'audition', 'flow-test', 'index.json'), 'utf8'));
    assert.equal(aIndex.length, 4);
    for (const x of aIndex) assert.ok(fs.existsSync(path.join(vendor, 'audition', 'flow-test', ...x.file.split('/'))) && x.seconds > 0, x.file);
    assert.ok(!fs.existsSync(path.join(vendor, 'audition-stage', 'flow-test')), '무대는 치운다');
    await a.call('/generate', { ...audition, confirmed: true }); s = await a.finish();
    assert.equal(mock.calls - atAudition, 4, '다시 사지 않는다');
    // 샘플·들어 보기는 게임 폴더를 건드리지 않는다(모든 음성 파일·목록의 크기·수정 시각이 그대로)
    assert.deepEqual(gameFileStats(), statsBefore);
    // 키가 거절되면 곧바로 멈추고 연결을 지운다(후보 목소리 샘플은 새 요청이라 Typecast를 부른다)
    mock.refuse = true;
    await a.call('/generate', { mode: 'sample', alternates: true }); s = await a.finish();
    assert.equal(s.state.phase, '멈춤'); assert.match(s.state.stopReason, /API 키가 맞지 않습니다/); assert.equal(s.connected, false);
    mock.refuse = false;

    // ── 2) 저장소 임시 사본(바람길만): 전부 만들기 ──
    const runner = path.join(copy, 'experiences', 'korean-runner');
    fs.mkdirSync(path.join(runner, 'qa'), { recursive: true }); fs.mkdirSync(path.join(copy, 'tools'), { recursive: true });
    fs.cpSync(path.join(G.gameDir('korean-runner'), 'assets', 'voice'), path.join(runner, 'assets', 'voice'), { recursive: true });
    fs.copyFileSync(path.join(G.gameDir('korean-runner'), 'voice-timing.mjs'), path.join(runner, 'voice-timing.mjs'));
    fs.copyFileSync(V.CASTING_FILE, path.join(copy, 'tools', 'minigame-voice-casting.json'));
    const before = Object.fromEntries(fs.readdirSync(path.join(runner, 'assets', 'voice')).map(f => [f, fs.readFileSync(path.join(runner, 'assets', 'voice', f))]));
    const b = await startTool({ SYNK_TYPECAST_API: mock.origin, SYNK_MINIGAME_VOICE_VENDOR: vendor, SYNK_MINIGAME_VOICE_REPO: copy }); tools.push(b);
    assert.equal((await b.call('/connect', { key: KEY }, true)).status, 200);
    const callsBefore = mock.calls;
    // 샘플로 이미 받은 바람길 줄(같은 목소리·설정·글)은 다시 사지 않는다
    const sampled = expected.filter(j => j.game === 'korean-runner'), fresh = 28 - sampled.length;
    assert.ok(sampled.length >= 1);
    const ask = await b.call('/generate', { mode: 'all', games: ['korean-runner'] });
    assert.equal(ask.data.needConfirm, true, '먼저 어림을 보여 준다');
    assert.equal(ask.data.lines, fresh); assert.equal(ask.data.chars, 585 - V.chars(sampled)); assert.equal(ask.data.estimate, ask.data.chars);
    assert.equal(mock.calls, callsBefore, '확인 전에는 부르지 않는다');
    assert.equal((await b.call('/generate', { mode: 'all', games: ['korean-runner'], confirmed: true })).data.started, true);
    s = await b.finish();
    assert.equal(s.state.phase, '끝', JSON.stringify(s.state));
    assert.equal(s.state.applied['korean-runner'].ok, true, JSON.stringify(s.state.applied));
    assert.equal(mock.calls - callsBefore, fresh);
    const manifest = JSON.parse(fs.readFileSync(path.join(runner, 'assets', 'voice', 'manifest.json'), 'utf8'));
    assert.equal(manifest.voice, '바람'); assert.equal(manifest.clips.length, 28);
    for (const c of manifest.clips) {
      const mp3 = fs.readFileSync(path.join(runner, 'assets', 'voice', c.id + '.mp3'));
      assert.notDeepEqual(mp3, before[c.id + '.mp3'], c.id + '.mp3 바뀜');
      assert.notDeepEqual(fs.readFileSync(path.join(runner, 'assets', 'voice', c.id + '.wav')), before[c.id + '.wav'], c.id + '.wav 바뀜');
      assert.equal(c.bytes, mp3.length); assert.equal(c.sha256, crypto.createHash('sha256').update(mp3).digest('hex'));
    }
    for (const f of ['assets/voice/manifest.json', 'voice-timing.mjs']) assert.ok(!G.TOOL_NAMES.test(fs.readFileSync(path.join(runner, ...f.split('/')), 'utf8')), f);
    const timing = await import(require('node:url').pathToFileURL(path.join(runner, 'voice-timing.mjs')).href);
    for (const c of manifest.clips.filter(c => !c.id.startsWith('check-'))) assert.equal(timing.VOICE_SECONDS[c.id], Number(c.seconds.toFixed(4)));
    const record = JSON.parse(fs.readFileSync(path.join(runner, 'qa', 'voice.source.json'), 'utf8'));
    assert.equal(Object.keys(record.lines).length, 28); assert.equal(record.provider, 'Typecast');
    // 다시 눌러도 다시 사지 않고, 같은 결과로 다시 적용된다
    await b.call('/generate', { mode: 'all', games: ['korean-runner'], confirmed: true }); s = await b.finish();
    assert.equal(mock.calls - callsBefore, fresh, '다시 사지 않는다');
    assert.equal(s.state.applied['korean-runner'].ok, true);

    // ── 3) 키는 어디에도 남지 않는다 ──
    for (const file of [...filesUnder(vendor), ...filesUnder(copy)]) assert.ok(!fs.readFileSync(file).includes(KEY), '키가 파일에 남음: ' + file);
    assert.ok(!a.output().includes(KEY) && !b.output().includes(KEY), '키가 출력에 남음');
    assert.ok(!JSON.stringify(await b.status()).includes(KEY));
    // 키 값은 실패 문구에도 찍지 않는다(개수만).
    assert.equal([...mock.seenKeys].filter(k => k !== KEY).length, 0, '다른 키를 보내지 않는다');
  } finally {
    for (const t of tools) t.child.kill();
    await new Promise(r => mock.server.close(r));
    fs.rmSync(vendor, { recursive: true, force: true }); fs.rmSync(copy, { recursive: true, force: true });
  }
});
