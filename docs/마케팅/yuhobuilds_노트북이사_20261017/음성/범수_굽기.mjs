// 이 편 나레이션을 Typecast 범수로 굽는다 — 10-17 유호님 「나레이션이 너무 별론데?」(Gemini TTS Achird) → 「앞으로 이거 쓰지 마. 범수로 하자.」(결정 표 10-17).
// 설정은 같은 날 세션 공유 편(yuhobuilds_세션공유_20261017/음성/범수_굽기.mjs)·synkbrief GPTs·젬 편과 같다: 범수 · ssfm-v30 · 보통 감정 · 1.12배.
//   node 음성/범수_굽기.mjs --견적     글자 수·크레딧만(키 필요 없음)
//   node 음성/범수_굽기.mjs           대사마다(훅 C 첫 줄 h1c 포함) 음성/범수/<id>.wav, 이어 붙인 판 음성/후보/범수_A.wav(+ .json), 듣기용 음성/듣기/범수_A.mp3
// 다음 단계(바뀐 것 없음): 한번에_맞추기.py 후보/범수_A.wav → 테이크_다듬기.py → (h1c) C안_잇기.py → 넣기.cjs → remotion/준비.mjs
// 키: ~/SYNK_보안/타입캐스트.txt(메모리에서만 읽고 버린다). 1글자 1크레딧.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KEY_FILE = path.join(os.homedir(), 'SYNK_보안', '타입캐스트.txt');
const VOICE = { name: '범수', id: 'tc_5c3c52cb5827e00008dd7f3b' };
const SETTINGS = { model: 'ssfm-v30', emotion: 'normal', intensity: 1.0, tempo: 1.12, seed: 1017 };
const plan = JSON.parse(fs.readFileSync(path.join(HERE, 'voice-plan.json'), 'utf8'));
const LINES = [...plan.segments.map((s) => [s.id, s.text]), ['h1c', plan.variants.h1c.text]];
const BREAKS = new Set(plan.take.breaks);
const GAP = 0.35;        // 문장 사이 쉼
const GAP_BREAK = 0.5;   // 화제가 바뀌는 대사 앞
const TARGET_LUFS = -15.9;

const chars = LINES.reduce((n, [, t]) => n + [...t].length, 0);
if (process.argv.includes('--견적')) {
  console.log(JSON.stringify({ lines: LINES.length, chars, credits: chars }));
  process.exit(0);
}
if (!fs.existsSync(KEY_FILE)) {
  console.error(`Typecast 키 파일이 없다: ${KEY_FILE}`);
  process.exit(2);
}
let key = fs.readFileSync(KEY_FILE, 'utf8').split(/\r?\n/).map((s) => s.trim()).find(Boolean) || '';
if (key.length < 10) throw Error('키 파일이 비어 있음');
const api = async (route, method = 'GET', body) => {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch('https://api.typecast.ai' + route, { method, headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(180000) });
    if ((res.status === 429 || res.status >= 500) && attempt < 4) { await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); continue; }
    if (!res.ok) throw Error('Typecast HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
    return res.json();
  }
};
const left = (sub) => sub.credits.plan_credits - sub.credits.used_credits;
const before = await api('/v1/users/me/subscription');
if (left(before) < chars + 1000) throw Error('월 제공 크레딧이 부족함');

const OUT = path.join(HERE, '범수');
fs.mkdirSync(OUT, { recursive: true });
const done = {};
for (const [id, text] of LINES) {
  const wav = path.join(OUT, id + '.wav');
  if (fs.existsSync(wav) && !process.argv.includes('--다시')) { done[id] = wav; continue; }
  const data = await api('/v1/text-to-speech/with-timestamps', 'POST', {
    seed: SETTINGS.seed, model: SETTINGS.model, voice_id: VOICE.id, text, language: 'kor',
    output: { audio_format: 'wav', audio_tempo: SETTINGS.tempo, target_lufs: -17 },
    prompt: { emotion_type: 'preset', emotion_preset: SETTINGS.emotion, emotion_intensity: SETTINGS.intensity },
  });
  const bytes = Buffer.from(data.audio || '', 'base64');
  if (bytes.length < 1000) throw Error('빈 음성: ' + id);
  const raw = path.join(OUT, id + '.raw.wav');
  fs.writeFileSync(raw, bytes);
  // 앞뒤 무음만 다듬는다(말 사이 쉼은 그대로)
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af',
    'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse',
    '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
  fs.rmSync(raw);
  const meta = { ...data }; delete meta.audio;
  fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify(meta, null, 1));
  done[id] = wav;
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).toString().trim());
  console.log(id, dur.toFixed(2) + 's', text);
}
const after = await api('/v1/users/me/subscription');
key = '';

const lufs = (f) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = [...String(r.stderr).matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop();
  if (!m) throw Error('크기를 못 쟀다: ' + f);
  return Number(m[1]);
};
/** 대사 id 목록을 쉼을 넣어 잇고 -15.9 LUFS로 맞춘 16비트 wav. 앞에 0.3초 무음(넣기.cjs가 첫 말소리를 0.3초에 둔다). */
const join = (ids, out) => {
  const args = ['-f', 'lavfi', '-t', '0.3', '-i', 'anullsrc=r=48000:cl=mono'];
  let graph = '';
  let labels = '[0:a]';
  ids.forEach((id, i) => {
    args.push('-i', done[id]);
    const next = ids[i + 1];
    const pad = next ? (BREAKS.has(next) ? GAP_BREAK : GAP) : 0.4;
    graph += `[${i + 1}:a]apad=pad_dur=${pad}[a${i}];`;
    labels += `[a${i}]`;
  });
  const tmp = out.replace(/\.wav$/, '._이음.wav');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args, '-filter_complex', `${graph}${labels}concat=n=${ids.length + 1}:v=0:a=1[out]`, '-map', '[out]', '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', tmp]);
  const gain = +(TARGET_LUFS - lufs(tmp)).toFixed(2);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-af', `volume=${gain}dB,alimiter=limit=0.89:level=false`, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', out]);
  fs.rmSync(tmp);
  return out;
};
fs.mkdirSync(path.join(HERE, '후보'), { recursive: true });
const ids = plan.segments.map((s) => s.id);
const made = new Date().toISOString();
const candA = join(ids, path.join(HERE, '후보', '범수_A.wav'));
const candH = join(['h1c'], path.join(HERE, '후보', '범수_h1c.wav'));
for (const f of [candA, candH]) {
  fs.writeFileSync(f.replace(/\.wav$/, '.json'), JSON.stringify({ engine: 'Typecast', model: SETTINGS.model, voice: VOICE.name, voice_id: VOICE.id, settings: SETTINGS, made, gaps: { GAP, GAP_BREAK } }, null, 1));
}
fs.mkdirSync(path.join(HERE, '듣기'), { recursive: true });
const mp3 = path.join(HERE, '듣기', '범수_A.mp3');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', candA, '-c:a', 'libmp3lame', '-b:a', '160k', mp3]);
const total = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', candA]).toString().trim());
console.log(JSON.stringify({ chars, creditsBefore: left(before), creditsAfter: left(after), used: left(before) - left(after), seconds: +total.toFixed(2), lufs: lufs(candA), mp3: path.relative(HERE, mp3) }));
