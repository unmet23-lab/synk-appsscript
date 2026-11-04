#!/usr/bin/env node
/**
 * 환승 러시 목소리 굽기(2026-11-04): 원고(journeys.mjs · people.mjs)의 줄을 Typecast로 굽는다. 월 제공 크레딧만 쓴다(결제 · 충전 없음).
 * ELEVEN에 든 역은 일레븐 v4(힉스필드 founder CLI, 줄마다 최소 0.23크레딧 · 받은 줄은 공용 작업본 `.tmp/subway-rush-20261104/일레븐/`에 두고 다시 사지 않는다) — 장부 S39.
 * 줄과 목소리 · 설정이 같으면 공용 캐시(`tools/lib/타입캐스트.cjs`)에서 다시 사지 않는다. 키는 메모리로만 읽는다.
 * 굽고 나면 앞뒤 무음을 다듬고 크기를 맞춰 `assets/voice/<줄>.mp3`, 줄 길이는 `assets/voice/manifest.json`.
 * 배역은 첫 판(유호님이 후보를 듣고 고르면 ROLES만 바꾼다 — 바뀐 줄만 다시 산다).
 *
 *   node experiences/subway-rush/qa/목소리굽기.mjs --어림     줄 수 · 글자 수만
 *   node experiences/subway-rush/qa/목소리굽기.mjs            굽기
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { allLines } from '../journeys.mjs';
import { allPeopleLines } from '../people.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const T = createRequire(import.meta.url)('../../../tools/lib/타입캐스트.cjs');
const OUT = path.join(여기, '..', 'assets', 'voice');

// 배역(역할마다 하나). 기계 목소리 둘은 또박또박, 사람은 문맥에 맞는 감정(smart).
export const ROLES = {
  announcer: { voiceId: 'tc_63745dd5e0b6db6f3cf10924', name: '미진', tempo: 0.96, emotion: 'normal', lufs: -17 },
  guide: { voiceId: 'tc_65571d3fb22102b993a24350', name: '재영', tempo: 0.98, emotion: 'normal', lufs: -17 },
  worker: { voiceId: 'tc_662a05b17419f60500ac5630', name: '이준', tempo: 1.0, emotion: 'smart', lufs: -17 },
  traveler: { voiceId: 'tc_692799c46508f6b9468c54c7', name: '다은', tempo: 0.96, emotion: 'smart', lufs: -17 },
  fan: { voiceId: 'tc_6335061c3c90cf9e5b6b9fff', name: '다나', tempo: 1.0, emotion: 'smart', lufs: -17 },
  grandma: { voiceId: 'tc_6731b3ac075b04a944644234', name: '한영', tempo: 0.98, emotion: 'smart', lufs: -17 },
  hiker: { eleven: true },   // 일레븐(아래) — 유호님이 10-10에 뺀 강일을 쓰지 않는다
  freshman: { voiceId: 'tc_66c6ce224dadfe518fbbdef2', name: '태민', tempo: 1.02, emotion: 'smart', lufs: -17 },
};
const BASE = { seed: 1104, model: 'ssfm-v30', lang: 'ko', intensity: 1 };
export const ELEVEN = { hiker: { name: 'Gideon', id: '1ad38ba4-9cc4-4f2f-9fde-b0fefdf67ae5' } };
// 줄마다 연기 꼬리표(일레븐 v4)
const TAG = { 'p-hiker-ask': '[friendly]', 'p-hiker-yes': '[laughs]', 'p-hiker-no': '[confused]', 'p-hiker-hi': '[chuckles]', 'p-worker-ask': '[sleepy]', 'p-worker-thanks': '[relieved]', 'p-worker-huh': '[confused]', 'p-traveler-thanks': '[cheerful]', 'p-traveler-huh': '[confused]', 'p-traveler-first': '[laughs]', 'p-fan-ask': '[excited]', 'p-fan-school': '[playful]', 'p-fan-yes': '[excited]', 'p-fan-what': '[surprised]', 'p-grandma-ask': '[tired]', 'p-grandma-sit': '[warmly]', 'p-grandma-next': '[warmly]', 'p-grandma-me': '[laughs]', 'p-freshman-ask': '[excited]', 'p-freshman-together': '[cheerful]', 'p-freshman-first': '[cheerful]', 'p-freshman-hi': '[cheerful]' };
const 일레븐폴더 = path.join(createRequire(import.meta.url)('../../../tools/lib/공용작업본.js').공용작업본(path.resolve(여기, '..', '..', '..')), '.tmp', 'subway-rush-20261104', '일레븐');
const 힉스집 = path.join(os.homedir(), '.ai-accounts', 'higgsfield-founder');
const hf = (인자) => {
  const r = spawnSync(path.join(process.env.APPDATA, 'npm', 'higgsfield'), [...인자, '--json'], { encoding: 'utf8', env: { ...process.env, HOME: 힉스집, USERPROFILE: 힉스집 }, timeout: 15 * 60 * 1000 });
  try { return JSON.parse((r.stdout || '').trim()); } catch { throw Error(`힉스필드 답을 못 읽었다: ${(r.stdout || r.stderr || '').slice(0, 300)}`); }
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const 번호찾기 = (o) => { if (!o || typeof o !== 'object') return null; for (const k of ['id', 'job_id']) if (typeof o[k] === 'string' && UUID.test(o[k])) return o[k]; for (const v of Object.values(o)) { const x = 번호찾기(v); if (x) return x; } return null; };
const 주소찾기 = (o) => { if (!o || typeof o !== 'object') return null; if (typeof o.result_url === 'string') return o.result_url; for (const v of Object.values(o)) { const x = 주소찾기(v); if (x) return x; } return null; };
async function 일레븐줄(l) {
  const v = ELEVEN[l.role], 폴더 = path.join(일레븐폴더, `${l.role}-${v.name}`), 끝 = path.join(폴더, `${l.voice}.mp3`), 글 = path.join(폴더, `${l.voice}.txt`), 말 = `${TAG[l.voice] || ''} ${l.say}`.trim();
  fs.mkdirSync(폴더, { recursive: true });
  if (fs.existsSync(끝) && fs.existsSync(글) && fs.readFileSync(글, 'utf8') === 말) return { wav: 끝, 새로: false };
  const 이전 = Date.now();
  let 작업 = 번호찾기(hf(['generate', 'create', 'elevenlabs_v4', '--dialogue', JSON.stringify([{ text: 말, voice_id: v.id, voice_type: 'preset' }]), '--stability', '0.5']));
  if (!작업) { const 목록 = hf(['generate', 'list', '--size', '3']); const a = Array.isArray(목록) ? 목록 : 목록.jobs || 목록.items || 목록.data || []; 작업 = a.find((x) => x.job_type === 'elevenlabs_v4' && Date.parse(x.created_at) >= 이전 - 5000)?.id; }
  if (!작업) throw Error('접수 번호를 못 찾았다: ' + l.voice);
  const 주소 = 주소찾기(hf(['generate', 'wait', 작업]));
  if (!주소) throw Error(`결과 주소가 없다: ${작업}`);
  fs.writeFileSync(끝, Buffer.from(await (await fetch(주소)).arrayBuffer())); fs.writeFileSync(글, 말);
  return { wav: 끝, 새로: true };
}

const lines = [...allLines(), ...allPeopleLines()];
const chars = lines.filter((l) => !ELEVEN[l.role]).reduce((n, l) => n + T.chars(l.say), 0);
console.log(`줄 ${lines.length} · 글자 ${chars}`);
if (process.argv.includes('--어림')) process.exit(0);

const key = T.readKey(T.keyFilePath());
fs.mkdirSync(OUT, { recursive: true });
const before = T.credits(await T.call('/v1/users/me/subscription', { key }));
let bought = 0, cached = 0, eleven = 0; const manifest = {};
for (const l of lines) {
  if (!ROLES[l.role]) throw Error('배역 없음: ' + l.role);
  let found;
  if (ELEVEN[l.role]) {
    found = await 일레븐줄(l); if (found.새로) eleven += 1; else cached += 1;
  } else {
    const s = { ...BASE, ...ROLES[l.role] };
    const req = T.request(s, l.say), k = T.cacheKey(req);
    found = T.findCached(s.voiceId, k);
    if (!found) {
      const data = await T.call('/v1/text-to-speech/with-timestamps', { method: 'POST', body: req, key });
      const saved = T.saveCached(req, data, { game: 'subway-rush', line: l.voice, role: l.role });
      T.logPurchase({ game: 'subway-rush', line: l.voice, chars: T.chars(l.say), voice: s.name });
      found = { wav: saved.wav }; bought += 1;
    } else cached += 1;
  }
  const mp3 = path.join(OUT, l.voice + '.mp3');
  // 앞뒤 무음을 다듬고 크기를 맞춘다. 대역 · 울림은 건드리지 않는다(듣기 재료를 깎지 않는다, 설계 6절).
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', found.wav, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,loudnorm=I=-17:TP=-2:LRA=11', '-ar', '44100', '-ac', '1', '-b:a', '80k', mp3], { encoding: 'utf8' });
  if (r.status !== 0) throw Error('ffmpeg: ' + r.stderr);
  const d = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3], { encoding: 'utf8' });
  manifest[l.voice] = { role: l.role, seconds: Number(Number(d.stdout).toFixed(2)), text: l.text };
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 0) + '\n');
const after = T.credits(await T.call('/v1/users/me/subscription', { key }));
console.log(JSON.stringify({ 새로굽기: bought, 일레븐새로: eleven, 캐시: cached, 쓴크레딧: after.used - before.used, 남은크레딧: after.left }));
