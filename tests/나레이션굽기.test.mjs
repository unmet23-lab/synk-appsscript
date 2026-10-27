// 나레이션 굽기(tools/나레이션굽기.mjs) — 이 컴퓨터의 가짜 Typecast(127.0.0.1)로만 돈다. 진짜 Typecast·크레딧·실제 키 파일 없음.
//   미리보기는 아무것도 부르지 않고, --굽기는 캐시에 없는 줄만 산다(같은 요청은 한 번), 다시 굽기는 0줄, 키는 어떤 파일·출력에도 남지 않는다.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import T from '../tools/lib/타입캐스트.cjs';
import { onsetSeconds, shiftWords, filterFor, loadPlan, readWavMono16, clippedSamples, REQUEST_LUFS } from '../tools/나레이션굽기.mjs';

const run = promisify(execFile);
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = path.join(REPO, 'tools', '나레이션굽기.mjs');
const KEY = 'test-key-' + crypto.randomBytes(12).toString('hex');
const VOICE = 'tc_5c3c52cb5827e00008dd7f3b';
const hasFfmpeg = (() => { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); execFileSync('ffprobe', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
const dirs = [];
after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

// 가짜 Typecast: 잔량은 보낸 글자만큼 줄고, 말소리 대신 0.25초 무음 + 글 길이만큼 떨리는 소리(44.1kHz 16비트 wav)를 돌려준다.
// amp가 1을 넘으면 진짜 Typecast처럼 16비트 끝에서 잘라 보낸다.
function toneWav(text, amp = 0.3) {
  const rate = 44100, speech = Math.min(3, Math.max(0.6, [...text].length * 0.08)), seconds = speech + 0.6;
  const n = Math.round(rate * seconds), data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / rate, on = t > 0.25 && t < 0.25 + speech ? 1 : 0;
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(32767 * on * amp * Math.sin(2 * Math.PI * 220 * t)))), i * 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8); head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
  head.writeUInt32LE(rate, 24); head.writeUInt32LE(rate * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(data.length, 40);
  const words = text.trim().split(/\s+/).map((w, i, all) => ({ text: w, start: +(0.25 + (speech * i) / all.length).toFixed(3), end: +(0.25 + (speech * (i + 1)) / all.length).toFixed(3) }));
  return { audio: Buffer.concat([head, data]).toString('base64'), audio_duration: seconds, audio_format: 'wav', words };
}
function mockTypecast() {
  // loud: 목표 크기를 −20보다 높게 요청하면 잘린 소리를 돌려준다(진짜 Typecast가 −15.5·−17에서 그런다)
  const m = { tts: 0, subs: 0, used: 0, plan: 200000, refuse: false, loud: false, keys: new Set(), bodies: [] };
  m.server = http.createServer(async (req, res) => {
    let raw = ''; for await (const c of req) raw += c;
    m.keys.add(req.headers['x-api-key']);
    const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.headers['x-api-key'] !== KEY || m.refuse) return send(401, { message: 'invalid key' });
    if (req.url === '/v1/users/me/subscription') { m.subs++; return send(200, { plan: 'lite', credits: { plan_credits: m.plan, used_credits: m.used } }); }
    if (req.url === '/v1/text-to-speech/with-timestamps' && req.method === 'POST') {
      const body = JSON.parse(raw);
      m.tts++; m.used += [...body.text].length; m.bodies.push(body);
      return send(200, toneWav(body.text, m.loud && body.output.target_lufs > -20 ? 1.4 : 0.3));
    }
    send(404, {});
  });
  return new Promise((r) => m.server.listen(0, '127.0.0.1', () => { m.origin = 'http://127.0.0.1:' + m.server.address().port; r(m); }));
}
function workspace(planBody) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-narration-test-'));
  dirs.push(dir);
  fs.writeFileSync(path.join(dir, 'key.txt'), KEY + '\n');
  const planFile = path.join(dir, '계획.json');
  fs.writeFileSync(planFile, JSON.stringify(planBody, null, 1));
  return { dir, planFile, cache: path.join(dir, 'cache'), key: path.join(dir, 'key.txt') };
}
const PLAN = {
  voice: { id: VOICE, name: '범수' },
  defaults: { model: 'ssfm-v30', lang: 'ko', emotion: 'normal', intensity: 1, tempo: 1.12, seed: 1018, lufs: -17 },
  out: 'vo',
  ts: 'vo.ts',
  lines: [
    { id: 'a01', text: '클릭 한 번에 계정 열여섯 개가 보여요.' },
    { id: 'a02', text: '남은 사용량을 한눈에 봐요.', show: 'SYNK 계정판' },
    { id: 'a03', text: '클릭 한 번에 계정 열여섯 개가 보여요.' },
  ],
  take: { lead: 0.3, gap: 0.35, breakGap: 0.5, breaks: ['a02'], tail: 0.4, lufs: -15.9, wav: 'take/take.wav', mp3: '듣기/take.mp3' },
};
async function tool(args, env) {
  try {
    const r = await run(process.execPath, [TOOL, ...args], { env: { ...process.env, ...env }, windowsHide: true, maxBuffer: 1 << 24 });
    return { code: 0, out: r.stdout + r.stderr };
  } catch (e) { return { code: e.code, out: String(e.stdout) + String(e.stderr) }; }
}
const filesUnder = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? filesUnder(path.join(dir, e.name)) : [path.join(dir, e.name)]) : [];

test('요청 본문·캐시 열쇠는 옛 도구(LAB 관용구 나레이션.cjs·미니게임 목소리)와 같은 셈이다', () => {
  // 옛 나레이션.cjs의 request()·hash()를 그대로 옮겨 견준다 — 이 셈이 같아야 옛 원본을 다시 사지 않는다.
  const oldRequest = (s) => ({ seed: s.seed, model: 'ssfm-v30', voice_id: 'tc_61659cc118732016a95fe7c6', text: s.text, language: s.lang === 'ko' ? 'kor' : 'eng',
    output: { audio_format: 'wav', audio_tempo: s.tempo, target_lufs: s.lufs },
    prompt: s.emotion === 'smart' ? { emotion_type: 'smart', previous_text: s.prev || '', next_text: s.next || '' } : { emotion_type: 'preset', emotion_preset: s.emotion, emotion_intensity: s.intensity } });
  const oldHash = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 32);
  for (const s of [{ seed: 1310, text: '손이 크다!', lang: 'ko', tempo: 1.05, lufs: -17, emotion: 'happy', intensity: 0.8 },
    { seed: 1310, text: 'Nope!', lang: 'en', tempo: 1.15, lufs: -17, emotion: 'smart', prev: 'Belly button out?', next: 'Three!' }]) {
    const mine = T.request({ ...s, model: 'ssfm-v30', voiceId: 'tc_61659cc118732016a95fe7c6' }, s.text);
    assert.deepEqual(mine, oldRequest(s));
    assert.equal(T.cacheKey(mine), oldHash(oldRequest(s)));
  }
});

test('낱말 시각은 다듬은 줄 파일의 첫 소리에 맞춰 옮기고 speed만큼 줄인다', () => {
  const rate = 1000, x = new Float32Array(1000);
  for (let i = 300; i < 900; i++) x[i] = 0.5;
  assert.equal(onsetSeconds({ rate, x }), 0.3);
  const words = [{ text: '클릭', start: 0.25, end: 0.5 }, { text: '한', start: 0.55, end: 0.7 }];
  assert.deepEqual(shiftWords(words, { onset: 0.02, speed: 1 }), [{ text: '클릭', start: 0.02, end: 0.27 }, { text: '한', start: 0.32, end: 0.47 }]);
  assert.deepEqual(shiftWords(words, { onset: 0.02, speed: 1.25 }).map((w) => w.start), [0.02, 0.26]);
  assert.match(filterFor({ speed: 1.05, cut: 1.06 }, 'both'), /^atempo=1\.05,silenceremove.*areverse.*,atrim=end=1\.06,afade=t=out:st=1\.000:d=0\.06$/);
  assert.doesNotMatch(filterFor({}, 'start'), /areverse/);
  // 크기 맞춤은 무음 자르기 앞(자르기 문턱이 말소리에 견줘 옛 판과 같은 자리), 옛 원본(gain null)은 손대지 않는다
  assert.match(filterFor({ speed: 0.85, gain: 9 }, 'both'), /^atempo=0\.85,volume=9dB,alimiter=limit=0\.89:attack=5:release=50:level=false:latency=1,silenceremove/);
  assert.doesNotMatch(filterFor({ gain: null }, 'both'), /volume|alimiter/);
  assert.equal(clippedSamples({ x: Float32Array.from([0.2, 1, -1, 32766 / 32768, 0.99]) }), 3);
});

test('Typecast에는 낮은 크기(−26)로 요청하고 줄의 lufs까지는 우리 쪽에서 키운다 — lufs만 바꾸면 다시 사지 않는다', () => {
  const w = workspace({ voice: VOICE, defaults: { lufs: -15.5 }, lines: [{ id: 'b1', text: '아니?!' }, { id: 'n1', text: 'Not always no!', lang: 'en', lufs: -17 }] });
  const [b1, n1] = loadPlan(w.planFile).versions[0].lines;
  assert.equal(REQUEST_LUFS, -26);
  assert.deepEqual([b1.req.output.target_lufs, b1.gain, n1.req.output.target_lufs, n1.gain], [-26, 10.5, -26, 9]);
  assert.equal(b1.legacyKey, T.cacheKey(T.request(b1.settings, b1.text)), '옛 열쇠 = 줄의 lufs로 요청하던 셈');
  fs.writeFileSync(w.planFile, JSON.stringify({ voice: VOICE, defaults: { lufs: -17 }, lines: [{ id: 'b1', text: '아니?!' }] }));
  assert.equal(loadPlan(w.planFile).versions[0].lines[0].key, b1.key, 'lufs가 달라도 같은 원본');
  fs.writeFileSync(w.planFile, JSON.stringify({ voice: VOICE, requestLufs: 'line', defaults: { lufs: -15.5 }, lines: [{ id: 'b1', text: '아니?!' }] }));
  const legacy = loadPlan(w.planFile).versions[0].lines[0];
  assert.deepEqual([legacy.req.output.target_lufs, legacy.gain, legacy.key, legacy.legacyKey], [-15.5, null, b1.legacyKey, null]);
  for (const bad of [-10, 'loud']) {
    fs.writeFileSync(w.planFile, JSON.stringify({ voice: VOICE, requestLufs: bad, lines: [{ id: 'b1', text: '아니?!' }] }));
    assert.match(loadPlan(w.planFile).problems.join('\n'), /requestLufs는/);
  }
});

test('가짜 Typecast로: 잘린 옛 원본만 낮은 크기로 다시 사고, 깨끗한 옛 원본은 그대로 다듬고, 잘림은 알린다', { skip: !hasFfmpeg && 'ffmpeg 없음', timeout: 120000 }, async () => {
  const m = await mockTypecast();
  m.loud = true;
  try {
    const w = workspace({ voice: { id: VOICE, name: '범수' }, defaults: { model: 'ssfm-v30', lang: 'ko', emotion: 'normal', intensity: 1, tempo: 1, seed: 1027, lufs: -15.5 }, out: 'vo',
      lines: [{ id: 'b1', text: '아니?!' }, { id: 'b2', text: '서비스예요!' }] });
    const env = { SYNK_TYPECAST_API: m.origin, SYNK_TYPECAST_CACHE: w.cache };
    // 옛 도구가 줄의 lufs(−15.5)로 산 원본: b1은 잘려 왔고 b2는 깨끗하다
    const [b1, b2] = loadPlan(w.planFile).versions[0].lines;
    T.saveCached(T.request(b1.settings, b1.text), toneWav(b1.text, 1.4), {}, env);
    T.saveCached(T.request(b2.settings, b2.text), toneWav(b2.text, 0.3), {}, env);
    const preview = await tool([w.planFile], env);
    assert.equal(preview.code, 0, preview.out);
    assert.match(preview.out, /b1 .*잘린 옛 원본\(\d+\) → 새로 삼/);
    assert.match(preview.out, /b2 .*옛 크기 원본/);
    assert.match(preview.out, /새로 살 줄 1개 4자/);
    const baked = await tool([w.planFile, '--굽기', '--키파일', w.key], env);
    assert.equal(baked.code, 0, baked.out);
    assert.deepEqual(m.bodies.map((b) => [b.text, b.output.target_lufs]), [['아니?!', -26]]);
    assert.doesNotMatch(baked.out, /잘려 왔습니다|꽉 찬 표본/);
    const j1 = JSON.parse(fs.readFileSync(path.join(w.dir, 'vo', 'b1.json'), 'utf8')), j2 = JSON.parse(fs.readFileSync(path.join(w.dir, 'vo', 'b2.json'), 'utf8'));
    assert.deepEqual(j1.level, { requestLufs: -26, gainDb: 10.5, limit: 0.89, clippedSource: 0, clippedOut: 0 });
    assert.deepEqual([j1.source.key, j2.source.key, j2.level.requestLufs, j2.level.gainDb], [b1.key, b2.legacyKey, -15.5, null]);
    // −26 원본(0.3)을 10.5 dB 키우면 1을 넘는다 → 리미터가 −1 dBFS 아래로 누른다(잘리지 않음)
    const x = readWavMono16(path.join(w.dir, 'vo', 'b1.wav')).x;
    const peak = x.reduce((p, v) => Math.max(p, Math.abs(v)), 0);
    assert.ok(peak > 0.8 && peak <= 0.9, '리미터 천장 근처 ' + peak);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(w.dir, 'vo', 'vo.json'), 'utf8')).lines.map((l) => l.key), [b1.key, b2.legacyKey]);
    // 옛 판 그대로("requestLufs": "line") 다듬으면 잘린 원본을 쓰되 알린다
    fs.writeFileSync(w.planFile, JSON.stringify({ ...JSON.parse(fs.readFileSync(w.planFile, 'utf8')), requestLufs: 'line' }));
    const legacy = await tool([w.planFile, '--다듬기'], env);
    assert.equal(legacy.code, 0, legacy.out);
    assert.match(legacy.out, /b1: Typecast 원본이 \d+표본 잘려 왔습니다\(-15\.5 LUFS로 요청\)/);
    assert.equal(m.tts, 1);
  } finally { m.server.close(); }
});

test('옛 계획 모양(segments·variants·previous·smart)도 읽고 틀린 설정은 굽기 전에 잡는다', () => {
  const w = workspace({ voice: VOICE, segments: [{ id: 'h1', text: '한 줄', smart: true, previous: '앞', next: '뒤' }], variants: { h1e: { replaces: 'h1', text: '다른 한 줄' } } });
  const p = loadPlan(w.planFile);
  assert.deepEqual(p.problems, []);
  assert.deepEqual(p.versions[0].lines.map((l) => [l.id, l.settings.emotion, l.settings.prev, l.variant]), [['h1', 'smart', '앞', false], ['h1e', 'normal', undefined, true]]);
  // --목소리는 판·줄·배역 단위 목소리까지 모두 덮는다(다른 목소리로 사지 않게)
  const A = 'tc_aaaaaaaaaaaaaaaaaaaaaaaa', B = 'tc_bbbbbbbbbbbbbbbbbbbbbbbb';
  fs.writeFileSync(w.planFile, JSON.stringify({ voice: A, voices: { host: A }, defaults: { voice: A },
    versions: { fun: { voice: A, lines: [{ id: 'x1', text: '하나' }, { id: 'x2', text: '둘', voice: A }, { id: 'x3', text: '셋', role: 'host' }] } } }));
  const forced = loadPlan(w.planFile, { voice: B + ':B' });
  assert.deepEqual(forced.versions[0].lines.map((l) => l.req.voice_id), [B, B, B]);
  assert.deepEqual(loadPlan(w.planFile).versions[0].lines.map((l) => l.req.voice_id), [A, A, A]);
  fs.writeFileSync(w.planFile, JSON.stringify({ voice: { id: 'tc_x' }, lines: [] }));
  assert.throws(() => loadPlan(w.planFile), /목소리 id 모양/);
  fs.writeFileSync(w.planFile, JSON.stringify({ voice: VOICE, lines: [{ id: 'a', text: '가', emotion: 'smart', model: 'ssfm-v21' }, { id: 'a', text: '' }, { id: 'b/c', text: '나', tempo: 3 }] }));
  const bad = loadPlan(w.planFile).problems.join('\n');
  for (const why of [/smart 감정은 ssfm-v30만/, /같은 id가 두 번/, /읽을 글\(text\)이 비었음/, /파일 이름에 못 쓰는 글자/, /tempo는 0\.5~2/]) assert.match(bad, why);
});

test('가짜 Typecast로: 미리보기는 부르지 않고, --굽기는 없는 줄만 한 번씩 사고, 다시 굽기는 0줄', { skip: !hasFfmpeg && 'ffmpeg 없음', timeout: 120000 }, async () => {
  const m = await mockTypecast();
  try {
    const w = workspace(PLAN);
    const env = { SYNK_TYPECAST_API: m.origin, SYNK_TYPECAST_CACHE: w.cache };
    // 1) 미리보기: 네트워크·파일 쓰기 없음
    const preview = await tool([w.planFile, '--json'], env);
    assert.equal(preview.code, 0, preview.out);
    assert.deepEqual(JSON.parse(preview.out.trim().split('\n').pop()), { lines: 3, unique: 2, cached: 0, fromLegacy: 0, newLines: 2, newChars: [...PLAN.lines[0].text].length + [...PLAN.lines[1].text].length, credits: [...PLAN.lines[0].text].length + [...PLAN.lines[1].text].length, cacheRoot: w.cache, cacheExists: false });
    assert.equal(m.tts + m.subs, 0);
    assert.equal(fs.existsSync(path.join(w.dir, 'vo')), false);
    // 2) 굽기: 같은 글·설정의 a01·a03은 한 번만 산다
    const first = await tool([w.planFile, '--굽기', '--키파일', w.key], env);
    assert.equal(first.code, 0, first.out);
    assert.equal(m.tts, 2);
    for (const id of ['a01', 'a02', 'a03']) {
      const wav = path.join(w.dir, 'vo', id + '.wav');
      const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate,channels,codec_name', '-of', 'json', wav]).toString()).streams[0];
      assert.deepEqual([probe.codec_name, probe.sample_rate, probe.channels], ['pcm_s16le', '48000', 1]);
      const meta = JSON.parse(fs.readFileSync(path.join(w.dir, 'vo', id + '.json'), 'utf8'));
      assert.equal(meta.words.length, PLAN.lines.find((l) => l.id === id).text.split(' ').length);
      assert.ok(meta.words[0].start < 0.06, '첫 낱말은 다듬은 파일의 첫 소리(앞 무음 0.02초 남김) 근처');
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(w.dir, 'vo', 'vo.json'), 'utf8'));
    assert.deepEqual(manifest.lines.map((l) => l.id), ['a01', 'a02', 'a03']);
    assert.equal(manifest.lines[1].show, 'SYNK 계정판');
    const take = JSON.parse(fs.readFileSync(path.join(w.dir, 'take', 'take.json'), 'utf8'));
    assert.deepEqual(Object.keys(take.segs), ['a01', 'a02', 'a03']);
    assert.ok(Math.abs(take.segs.a01.start - 0.3) < 0.06, '첫 말소리는 앞 무음 0.3초 뒤');
    assert.ok(take.segs.a02.start - take.segs.a01.end >= 0.5, 'breaks 앞은 더 길게 쉰다');
    assert.ok(Math.abs(take.loudness.after - -15.9) < 1, '듣기 판 크기');
    assert.ok(fs.existsSync(path.join(w.dir, '듣기', 'take.mp3')));
    const log = fs.readFileSync(path.join(w.cache, '구매기록.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(log.map((l) => l.id), ['a01', 'a02']);
    // 3) 다시 굽기: 다 캐시에 있어 Typecast를 부르지 않는다(키도 안 읽는다)
    const again = await tool([w.planFile, '--굽기'], env);
    assert.equal(again.code, 0, again.out);
    assert.equal(m.tts, 2);
    assert.match(again.out, /살 줄 없음/);
    // 4) 한 줄만 고치면 그 줄만 산다
    const changed = { ...PLAN, lines: PLAN.lines.map((l) => l.id === 'a02' ? { ...l, text: '남은 사용량을 바로 봐요.' } : l) };
    fs.writeFileSync(w.planFile, JSON.stringify(changed));
    const third = await tool([w.planFile, '--굽기', '--키파일', w.key], env);
    assert.equal(third.code, 0, third.out);
    assert.equal(m.tts, 3);
    assert.equal(m.bodies.at(-1).text, '남은 사용량을 바로 봐요.');
    // 5) 계획에서 뺀 줄은 이 도구가 만든 파일만 지운다(남이 둔 파일은 그대로)
    fs.writeFileSync(path.join(w.dir, 'vo', 'other.wav'), 'not mine');
    fs.writeFileSync(w.planFile, JSON.stringify({ ...changed, lines: changed.lines.filter((l) => l.id !== 'a03') }));
    const fourth = await tool([w.planFile, '--다듬기'], env);
    assert.equal(fourth.code, 0, fourth.out);
    assert.equal(fs.existsSync(path.join(w.dir, 'vo', 'a03.wav')) || fs.existsSync(path.join(w.dir, 'vo', 'a03.json')), false);
    assert.equal(fs.readFileSync(path.join(w.dir, 'vo', 'other.wav'), 'utf8'), 'not mine');
    assert.equal(m.tts, 3);
    assert.match(fs.readFileSync(path.join(w.dir, 'vo.ts'), 'utf8'), /export const VO = \[[\s\S]*"a02"[\s\S]*\] as const;/);
    // 6) 캐시를 안 옮긴 새 PC처럼 빈 캐시로 다듬으면: 종료 3, 목록(vo.json)·Remotion 목록은 그대로
    const listBefore = fs.readFileSync(path.join(w.dir, 'vo', 'vo.json')), tsBefore = fs.readFileSync(path.join(w.dir, 'vo.ts'));
    const emptyCache = { ...env, SYNK_TYPECAST_CACHE: path.join(w.dir, 'empty-cache') };
    const fifth = await tool([w.planFile, '--다듬기'], emptyCache);
    assert.equal(fifth.code, 3, fifth.out);
    assert.match(fifth.out, /목록\(vo\.json\)은 그대로 둡니다/);
    assert.deepEqual(fs.readFileSync(path.join(w.dir, 'vo', 'vo.json')), listBefore);
    assert.deepEqual(fs.readFileSync(path.join(w.dir, 'vo.ts')), tsBefore);
    assert.ok(fs.existsSync(path.join(w.dir, 'vo', 'a01.wav')));
    // 키는 어떤 출력·파일에도 없다
    for (const f of filesUnder(w.dir).filter((f) => f !== w.key)) assert.equal(fs.readFileSync(f).includes(KEY), false, f);
    for (const r of [preview, first, again, third, fourth, fifth]) assert.equal(r.out.includes(KEY), false);
    assert.deepEqual([...m.keys], [KEY]);
  } finally { m.server.close(); }
});

test('가짜 API에서는 실제 키 파일을 읽지 않고, 401·상한 초과·캐시에 없는 다듬기는 멈추거나 알린다', { skip: !hasFfmpeg && 'ffmpeg 없음', timeout: 120000 }, async () => {
  const m = await mockTypecast();
  try {
    const w = workspace(PLAN);
    const env = { SYNK_TYPECAST_API: m.origin, SYNK_TYPECAST_CACHE: w.cache, SYNK_TYPECAST_KEY_FILE: '' };
    const noKey = await tool([w.planFile, '--굽기'], env);
    assert.equal(noKey.code, 1);
    assert.match(noKey.out, /실제 키 파일을 읽지 않습니다/);
    const capped = await tool([w.planFile, '--굽기', '--키파일', w.key, '--최대', '5'], env);
    assert.equal(capped.code, 1);
    assert.match(capped.out, /상한 5자보다 많습니다/);
    assert.equal(m.tts, 0);
    m.refuse = true;
    const refused = await tool([w.planFile, '--굽기', '--키파일', w.key], env);
    assert.equal(refused.code, 1);
    assert.match(refused.out, /키를 거절했습니다\(401\)/);
    assert.equal(filesUnder(w.cache).filter((f) => f.endsWith('.part')).length, 0);
    const missing = await tool([w.planFile, '--다듬기'], env);
    assert.equal(missing.code, 3, missing.out);
    assert.match(missing.out, /원본 없음 a01,a02,a03/);
    const noFile = await tool([w.planFile, '--굽기', '--키파일', path.join(w.dir, '없는키.txt')], env);
    assert.equal(noFile.code, 2);
    assert.match(noFile.out, /키 파일이 없습니다/);
  } finally { m.server.close(); }
});
