// yuhobuilds 세션 공유 편 내레이션을 Typecast 범수로 굽는다(목소리 비교용 — 10-17 유호님 「둘 다 한번씩 들어볼수있을까 ?」).
//   node 음성/범수_굽기.mjs --견적     글자 수·크레딧만(키 필요 없음)
//   node 음성/범수_굽기.mjs           voice-plan.json 대사 전부를 음성/범수/에 굽고, 이어 붙인 판을 음성/듣기/3_범수_이편대본.mp3로
// 목소리: 범수(tc_5c3c52cb5827e00008dd7f3b, 다큐) — 새 나레이션 기본(결정 표 10-10). 설정은 synkbrief GPTs·젬 편(10-17)과 같은 1.12배.
// 키: ~/SYNK_보안/타입캐스트.txt(메모리에서만 읽고 버린다). 1글자 1크레딧. 새 노트북에는 아직 이 파일이 없다(현장 노트 영상_ffmpeg_자막.md).
// 크기는 Achird 비교 파일(음성/듣기/1_Achird_이편대본.mp3)과 같은 -15.9 LUFS로 맞춘다.
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
// --segs=h1e,f1 이면 그 줄만 굽는다(variants 포함). 이때는 이어 붙이지 않고 vo.json에 그 줄만 덧쓴다.
const segArg = process.argv.find((a) => a.startsWith('--segs='));
const ONLY = segArg ? new Set(segArg.slice('--segs='.length).split(',')) : null;
const ALL = [...plan.segments.map((s) => [s.id, s.text]), ...Object.entries(plan.variants || {}).map(([id, v]) => [id, v.text])];
const LINES = ONLY ? ALL.filter(([id]) => ONLY.has(id)) : plan.segments.map((s) => [s.id, s.text]);
if (ONLY && LINES.length !== ONLY.size) throw Error('없는 줄: ' + [...ONLY].filter((id) => !LINES.some(([x]) => x === id)).join(','));
const BREAKS = new Set(plan.take.breaks);
const GAP = 0.35;        // 문장 사이 쉼(Achird 테이크의 보통 쉼과 비슷하게)
const GAP_BREAK = 0.5;   // 화제가 바뀌는 대사 앞
const TARGET_LUFS = -15.9;

const chars = LINES.reduce((n, [, t]) => n + [...t].length, 0);
const syll = LINES.reduce((n, [, t]) => n + [...t].filter((c) => /[가-힣]/.test(c)).length, 0);
if (process.argv.includes('--견적')) {
  console.log(JSON.stringify({ lines: LINES.length, chars, syllables: syll, credits: chars }));
  process.exit(0);
}
if (!fs.existsSync(KEY_FILE)) {
  console.error(`Typecast 키 파일이 없다: ${KEY_FILE}\n  유호님이 키를 이 파일에 한 줄로 넣으면 된다(키는 채팅으로 받지 않는다).`);
  process.exit(2);
}

let key = (fs.readFileSync(KEY_FILE, 'utf8').split(/\r?\n/).map((s) => s.trim()).find(Boolean) || '');
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
const lines = [];
for (const [id, text] of LINES) {
  const data = await api('/v1/text-to-speech/with-timestamps', 'POST', {
    seed: SETTINGS.seed, model: SETTINGS.model, voice_id: VOICE.id, text, language: 'kor',
    output: { audio_format: 'wav', audio_tempo: SETTINGS.tempo, target_lufs: -17 },
    prompt: { emotion_type: 'preset', emotion_preset: SETTINGS.emotion, emotion_intensity: SETTINGS.intensity },
  });
  const bytes = Buffer.from(data.audio || '', 'base64');
  if (bytes.length < 1000) throw Error('빈 음성: ' + id);
  const raw = path.join(OUT, id + '.raw.wav');
  const wav = path.join(OUT, id + '.wav');
  fs.writeFileSync(raw, bytes);
  // 앞뒤 무음만 다듬는다(말 사이 쉼은 그대로)
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af',
    'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse',
    '-ar', '48000', '-ac', '1', wav]);
  fs.rmSync(raw);
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).toString().trim());
  const meta = { ...data }; delete meta.audio;
  fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify(meta, null, 1));
  const hs = [...text].filter((c) => /[가-힣]/.test(c)).length;
  lines.push({ id, text, dur: +dur.toFixed(3), syllablesPerSec: +(hs / dur).toFixed(2) });
  console.log(id, dur.toFixed(2) + 's', (hs / dur).toFixed(2) + '음절/초', text);
}
const after = await api('/v1/users/me/subscription');
key = '';
if (ONLY) {
  const voPath = path.join(OUT, 'vo.json');
  const vo = fs.existsSync(voPath) ? JSON.parse(fs.readFileSync(voPath, 'utf8')) : { voice: VOICE, settings: SETTINGS, lines: [] };
  for (const l of lines) vo.lines = [...vo.lines.filter((x) => x.id !== l.id), l];
  fs.writeFileSync(voPath, JSON.stringify(vo, null, 1) + '\n');
  console.log(JSON.stringify({ chars, creditsBefore: left(before), creditsAfter: left(after), only: [...ONLY] }));
  process.exit(0);
}
fs.writeFileSync(path.join(OUT, 'vo.json'), JSON.stringify({ voice: VOICE, settings: SETTINGS, lines }, null, 1) + '\n');

// 이어 붙이기: 대사 사이 GAP, 화제가 바뀌는 대사 앞은 GAP_BREAK. 그다음 크기를 Achird 파일과 같게.
const args = [];
let graph = '';
let labels = '';
lines.forEach((l, i) => {
  args.push('-i', path.join(OUT, l.id + '.wav'));
  const next = lines[i + 1];
  const pad = next ? (BREAKS.has(next.id) ? GAP_BREAK : GAP) : 0;
  graph += `[${i}:a]apad=pad_dur=${pad}[a${i}];`;
  labels += `[a${i}]`;
});
const joined = path.join(OUT, '_이어붙임.wav');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args, '-filter_complex', `${graph}${labels}concat=n=${lines.length}:v=0:a=1[out]`, '-map', '[out]', '-ar', '48000', '-ac', '1', joined]);
// ebur128 결과는 stderr로 나온다 → spawnSync로 받아 통합 크기(I)를 읽고, 그만큼 음량을 옮긴 뒤 꼭대기만 리미터로 누른다.
const lufs = (f) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = [...String(r.stderr).matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop();
  if (!m) throw Error('크기를 못 쟀다: ' + f);
  return Number(m[1]);
};
const gain = +(TARGET_LUFS - lufs(joined)).toFixed(2);
fs.mkdirSync(path.join(HERE, '듣기'), { recursive: true });
const mp3 = path.join(HERE, '듣기', '3_범수_이편대본.mp3');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', joined, '-af', `volume=${gain}dB,alimiter=limit=0.89:level=false`, '-ar', '48000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', mp3]);
const total = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString().trim());
console.log(JSON.stringify({ chars, creditsBefore: left(before), creditsAfter: left(after), gainDb: gain, lufs: lufs(mp3), seconds: +total.toFixed(2), mp3: path.relative(HERE, mp3) }));
