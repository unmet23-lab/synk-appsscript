#!/usr/bin/env node
// 나레이션 굽기(Typecast) 공용 도구 — 회차마다 복사해 고쳐 쓰던 나레이션.cjs/.mjs·범수_굽기.mjs·voice-connection.cjs를 합쳤다(2026-10-19).
//   node tools/나레이션굽기.mjs <계획.json>                 미리보기: 줄·글자·캐시에 있는 줄·새로 살 글자(키·네트워크·파일 쓰기 없음)
//   node tools/나레이션굽기.mjs <계획.json> --굽기          캐시에 없는 줄만 사고(1글자 1크레딧) 모든 줄을 다듬어 출력 폴더에 둔다
//   node tools/나레이션굽기.mjs <계획.json> --다듬기        사지 않고 캐시에 있는 줄만 다시 다듬는다(유료 호출 없음)
//       [--줄 a01,b01] 그 줄만 산다 · [--판 natural,fun] 그 판만 · [--최대 3000] 한 번에 살 글자 상한(넘으면 멈춤)
//       [--목소리 tc_…[:이름]] 모든 줄의 목소리를 이것으로(판·줄·배역 단위 목소리도 덮음) · [--출력 폴더] [--src기준 폴더] [--ts 파일] 계획 파일의 값을 덮는다
//       [--키파일 파일] · [--json]
//   node tools/나레이션굽기.mjs --잔량                      Typecast 남은 크레딧만 읽는다(굽지 않음, 반영은 늦다)
//   node tools/나레이션굽기.mjs --키파일-열기               키 파일이 없으면 빈 파일을 만들고 메모장을 연다(키는 읽지 않는다)
// 키: ~/SYNK_보안/타입캐스트.txt 첫 줄을 메모리로만 읽는다. 결제·충전·키 만들기 기능은 없고, 잔량이 모자라면 멈춘다.
// 캐시: 저장소 밖 Documents/synk-vendor/typecast-cache/<목소리>/<요청 해시>.wav(+ 낱말 시각 .json). 목소리·설정·글이 같으면 다시 사지 않는다.
//   열쇠는 tools/lib/타입캐스트.cjs(미니게임 목소리·LAB 관용구 나레이션과 같은 셈)라 옛 원본(lab-topik-narration·minigame-voice)도 쓴다.
//   새 PC로 옮길 때 이 캐시 폴더를 같이 옮기지 않으면 같은 줄을 다시 산다(10-17 관용구 퀴즈 #2 277자).
// 사람이 하는 일은 그대로 둔다: 목소리 고르기(계획의 voice), 굽고 나서 귀로 듣기(take mp3·줄 파일), 받아쓰기 확인(tools/자막맞추기.py 대조).
//
// 계획 파일(JSON, 경로는 계획 파일 기준):
//   { "voice": {"id": "tc_…", "name": "범수"},
//     "defaults": {"model": "ssfm-v30", "lang": "ko", "emotion": "normal", "intensity": 1, "tempo": 1.12, "seed": 1018, "lufs": -17},
//     "out": "vo", "srcBase": null, "trim": "both", "ts": null, "limits": [{"from": 0, "to": 7.9}],
//     "lines": [{"id": "a01", "text": "읽는 글", "show": "화면 글(선택)", "at": 0.03, "cut": 1.06, "speed": 1.05, …줄마다 덮을 설정}],
//     "versions": {"fun": {"defaults": {…}, "lines": […]}},   ← lines 대신 판을 여럿 둘 때(출력은 out/<판>/)
//     "take": {"lead": 0.3, "gap": 0.35, "breakGap": 0.5, "breaks": ["c1"], "tail": 0.4, "lufs": -15.9, "limiter": 0.89,
//              "wav": "take/take.wav", "mp3": "듣기/take.mp3"} }   ← 이어 붙인 듣기 판(판이 없을 때)
//   옛 모양도 읽는다: segments(= lines)·variants(이어 붙이지 않는 추가 줄)·voices+role·previous(= prev)·smart:true(= emotion smart).
//   emotion은 normal·happy·sad·angry·whisper·toneup·tonedown 또는 smart(앞뒤 글 prev·next를 읽고 감정을 정함, ssfm-v30만).
//   speed는 굽고 나서 atempo(음높이 그대로, 요청에 안 들어가 다시 사지 않음), cut은 받아쓰기로 잰 말끝에서 자르고 0.06초 페이드.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import T from './lib/타입캐스트.cjs';

const run = promisify(execFile);
const FFMPEG = process.env.SYNK_FFMPEG_EXE || 'ffmpeg', FFPROBE = process.env.SYNK_FFPROBE_EXE || 'ffprobe';
const DEFAULTS = { model: 'ssfm-v30', lang: 'ko', emotion: 'normal', intensity: 1, tempo: 1, seed: 1003, lufs: -17 };
const ID = /^[A-Za-z0-9가-힣._-]{1,60}$/;
const TOOL = 'tools/나레이션굽기.mjs';
const hangul = (text) => [...String(text)].filter((c) => /[가-힣]/.test(c)).length;
const rel = (from, to) => path.relative(from, to).split(path.sep).join('/');

// ── 계획 읽기 ────────────────────────────────────────────────────────────
function pickVoice(v) {
  if (!v) return null;
  const voice = typeof v === 'string' ? { id: v.split(':')[0], name: v.split(':')[1] || v.split(':')[0] } : { id: v.id || v.voice_id, name: v.name || v.이름 || v.id };
  if (!T.VOICE_ID.test(voice.id || '')) throw Error('목소리 id 모양이 아닙니다(tc_… 24자리): ' + JSON.stringify(v));
  return voice;
}
function normLine(raw, base, voices, problems, where, forced = null) {
  const l = { ...raw };
  if (l.previous !== undefined && l.prev === undefined) l.prev = l.previous;
  if (l.smart === true) l.emotion = 'smart';
  const s = { ...base, ...l };
  // --목소리는 판·줄·배역 단위 목소리까지 모두 덮는다(다른 목소리로 사는 일이 없게)
  let voice = forced || (s.voice ? pickVoice(s.voice) : null);
  if (!voice && l.role && voices?.[l.role]) voice = pickVoice(voices[l.role]);
  if (!voice) voice = base.voiceObj;
  const id = String(l.id ?? '');
  if (!ID.test(id)) problems.push(`${where}: 줄 id가 비었거나 파일 이름에 못 쓰는 글자가 있음 ${JSON.stringify(l.id)}`);
  if (!String(l.text ?? '').trim()) problems.push(`${where}/${id}: 읽을 글(text)이 비었음`);
  if (!voice) problems.push(`${where}/${id}: 목소리가 없음(계획의 voice나 --목소리)`);
  if (s.emotion !== 'smart' && !T.PRESETS.includes(s.emotion)) problems.push(`${where}/${id}: 모르는 감정 ${s.emotion}`);
  if (s.emotion === 'smart' && s.model !== 'ssfm-v30') problems.push(`${where}/${id}: smart 감정은 ssfm-v30만`);
  if (!T.language(s.lang)) problems.push(`${where}/${id}: 모르는 언어 ${s.lang}`);
  if (!(s.tempo >= 0.5 && s.tempo <= 2)) problems.push(`${where}/${id}: tempo는 0.5~2 ${s.tempo}`);
  if (s.emotion !== 'smart' && !(s.intensity >= 0 && s.intensity <= 2)) problems.push(`${where}/${id}: 감정 세기는 0~2 ${s.intensity}`);
  if (l.speed !== undefined && !(l.speed >= 0.5 && l.speed <= 2)) problems.push(`${where}/${id}: speed는 0.5~2 ${l.speed}`);
  if (l.cut !== undefined && !(l.cut > 0.1)) problems.push(`${where}/${id}: cut은 0.1초보다 커야 함 ${l.cut}`);
  const settings = { model: s.model, lang: s.lang, emotion: s.emotion, intensity: s.intensity, tempo: s.tempo, seed: s.seed, lufs: s.lufs,
    voiceId: voice?.id, ...(s.emotion === 'smart' ? { prev: s.prev || '', next: s.next || '' } : {}) };
  const req = voice ? T.request(settings, String(l.text)) : null;
  return { id, text: String(l.text ?? ''), show: l.show, scene: l.scene, at: l.at, cut: l.cut, speed: l.speed, trim: l.trim, variant: !!raw.__variant,
    voice, settings, req, key: req ? T.cacheKey(req) : null, chars: T.chars(l.text ?? '') };
}
export function loadPlan(file, overrides = {}) {
  const planFile = path.resolve(file), dir = path.dirname(planFile);
  const raw = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  const problems = [];
  const forced = overrides.voice ? pickVoice(overrides.voice) : null;
  const topVoice = forced || (raw.voice ? pickVoice(raw.voice) : null);
  const versionEntries = raw.versions ? Object.entries(raw.versions) : [['', { lines: raw.lines || raw.segments || [] }]];
  if (!raw.versions && !(raw.lines || raw.segments)) problems.push('계획에 lines(또는 segments·versions)가 없음');
  const out = path.resolve(dir, overrides.out || raw.out || 'vo');
  const versions = versionEntries.map(([name, v]) => {
    const voiceObj = forced || (v.voice ? pickVoice(v.voice) : topVoice);
    const base = { ...DEFAULTS, ...(raw.defaults || {}), ...(v.defaults || {}), voiceObj };
    const extra = !raw.versions && raw.variants ? Object.entries(raw.variants).map(([id, x]) => ({ ...x, id, __variant: true })) : [];
    const lines = [...(v.lines || []), ...extra].map((l) => normLine(l, base, raw.voices, problems, name || '줄', forced));
    const seen = new Set();
    for (const l of lines) { if (seen.has(l.id)) problems.push(`${name || '줄'}: 같은 id가 두 번 ${l.id}`); seen.add(l.id); }
    return { name, lines, out: name ? path.join(out, name) : out };
  });
  const take = raw.take && !raw.versions && (raw.take.wav || raw.take.mp3) ? raw.take : null;
  return { file: planFile, dir, raw, out, versions, take, trim: raw.trim || 'both', limits: raw.limits || [],
    srcBase: overrides.srcBase || raw.srcBase ? path.resolve(dir, overrides.srcBase || raw.srcBase) : null, ts: overrides.ts || raw.ts ? path.resolve(dir, overrides.ts || raw.ts) : null, problems };
}

// ── 캐시와 미리보기 ──────────────────────────────────────────────────────
export function survey(plan, { only = null, versions = null, copyLegacy = false } = {}) {
  const chosen = plan.versions.filter((v) => !versions || versions.includes(v.name));
  const lines = chosen.flatMap((v) => v.lines.map((l) => ({ ...l, version: v.name })));
  const wanted = lines.filter((l) => !only || only.includes(l.id));
  const seen = new Set(), unique = wanted.filter((l) => l.key && !seen.has(l.key) && seen.add(l.key)); // 같은 요청은 먼저 나온 줄 하나로
  for (const l of unique) l.cached = T.findCached(l.voice.id, l.key, { copyLegacy });
  const todo = unique.filter((l) => !l.cached);
  return { chosen, lines, wanted, unique, todo, newChars: todo.reduce((n, l) => n + l.chars, 0),
    cacheRoot: T.cacheRoot(), cacheExists: fs.existsSync(T.cacheRoot()), fromLegacy: unique.filter((l) => l.cached?.from === 'legacy').length };
}
function printSurvey(plan, s) {
  console.log(`계획 ${plan.file}`);
  for (const v of s.chosen) {
    console.log(`\n${v.name ? `판 ${v.name}` : '줄'} → ${v.out}`);
    for (const l of v.lines) {
      const u = s.unique.find((x) => x.key === l.key);
      const state = !u ? '(이번엔 안 고름)' : u.cached ? (u.cached.from === 'legacy' ? '옛 캐시' : '캐시') : '새로 삼';
      console.log(`  ${l.id.padEnd(12)} ${String(l.chars).padStart(4)}자 ${state.padEnd(8)} ${l.voice?.name || '?'} ${l.settings.emotion}·${l.settings.tempo} ${l.text}`);
    }
  }
  console.log(`\n고른 줄 ${s.wanted.length}개(같은 요청은 한 번) · 캐시에 있음 ${s.unique.length - s.todo.length}개${s.fromLegacy ? `(옛 캐시 ${s.fromLegacy})` : ''} · 새로 살 줄 ${s.todo.length}개 ${s.newChars}자 ≈ ${s.newChars}크레딧`);
  if (!s.cacheExists) console.log(`⚠ 공용 캐시 폴더가 아직 없습니다: ${s.cacheRoot}\n  새 PC라면 옛 PC의 같은 폴더(Documents/synk-vendor/typecast-cache)를 먼저 옮겨 오세요. 안 옮기면 산 줄을 또 삽니다.`);
}

// ── 사기(유료) ───────────────────────────────────────────────────────────
async function buy(plan, s, { keyFile, maxChars, say = console.log }) {
  if (!s.todo.length) { say('살 줄 없음 — 모두 캐시에 있습니다.'); return { bought: 0, chars: 0 }; }
  if (s.newChars > maxChars) throw Error(`이번에 살 글자 ${s.newChars}자가 상한 ${maxChars}자보다 많습니다. 유호님께 줄 수·크레딧을 보여 드리고 승인받은 뒤 --최대 ${s.newChars}로 다시 실행하세요.`);
  let key = T.readKey(keyFile);
  const refused = (error) => (error.status === 401 ? Error('Typecast가 키를 거절했습니다(401). 키 파일을 확인해 주세요.') : error);
  try {
    let before;
    try { before = T.credits(await T.call('/v1/users/me/subscription', { key })); } catch (error) { throw refused(error); }
    if (before.left < s.newChars + 1000) throw Error(`월 제공 크레딧이 모자랍니다(남은 ${before.left}, 필요 ${s.newChars} + 여유 1000). 추가 결제 없이 멈춥니다.`);
    say(`사기 시작: ${s.todo.length}줄 ${s.newChars}자 · 남은 크레딧 ${before.left}`);
    let bought = 0, spentChars = 0, consecutive = 0;
    for (const l of s.todo) {
      try {
        const data = await T.call('/v1/text-to-speech/with-timestamps', { method: 'POST', body: l.req, key });
        T.saveCached(l.req, data, { plan: rel(T.cacheRoot(), plan.file), version: l.version, id: l.id, voiceName: l.voice.name });
        T.logPurchase({ key: l.key, voice: l.voice.id, voiceName: l.voice.name, chars: l.chars, plan: plan.file, version: l.version, id: l.id });
        bought++; spentChars += l.chars; consecutive = 0;
        say(`  산 줄 ${l.version ? l.version + '/' : ''}${l.id} ${l.chars}자`);
      } catch (error) {
        consecutive++;
        if (T.FATAL.has(error.status)) throw error.status === 401 ? refused(error) : Error(`Typecast가 거절했습니다(HTTP ${error.status}) — 크레딧·권한을 확인해 주세요. 산 줄은 캐시에 남아 있습니다.`);
        if ([400, 404, 413, 422].includes(error.status) || consecutive >= 3) throw Error(`${l.id}에서 멈춤: ${error.message} (산 줄 ${bought}개는 캐시에 남아 다시 실행하면 이어서 삽니다)`);
        say(`  ${l.id} 실패(다음 줄로): ${error.message}`);
      }
    }
    let after = null;
    try { after = T.credits(await T.call('/v1/users/me/subscription', { key })); } catch (error) { say(`끝 잔량을 읽지 못했습니다(산 줄은 캐시에 있음): ${error.message}`); }
    const used = after ? after.used - before.used : null;
    say(`사기 끝: ${bought}줄 ${spentChars}자 · 크레딧 ${used === 0 && spentChars > 0 ? '(잔량 반영 지연 — 나중에 --잔량으로 다시 읽기)' : used === null ? '(못 읽음)' : `이번 ${used}`}${after ? ` · 남은 ${after.left} / ${after.plan}` : ''}`);
    return { bought, chars: spentChars, creditsBefore: before.left, creditsAfter: after?.left ?? null };
  } finally { key = ''; }
}

// ── 다듬기(무료): 캐시 원본 → 출력 폴더의 줄 wav·낱말 시각·목록 ─────────────
function readWavMono16(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw Error('wav가 아님: ' + file);
  let p = 12, rate = 0, channels = 0, bits = 0, data = null;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === 'fmt ') { channels = b.readUInt16LE(p + 10); rate = b.readUInt32LE(p + 12); bits = b.readUInt16LE(p + 22); }
    if (id === 'data') { data = b.subarray(p + 8, Math.min(b.length, p + 8 + size)); break; }
    p += 8 + size + (size % 2);
  }
  if (!data || bits !== 16) throw Error('16비트 PCM wav가 아님: ' + file);
  const n = Math.floor(data.length / 2 / channels), x = new Float32Array(n);
  for (let i = 0; i < n; i++) { let v = 0; for (let c = 0; c < channels; c++) v += data.readInt16LE((i * channels + c) * 2); x[i] = v / channels / 32768; }
  return { rate, x };
}
// 첫 소리: 10ms 창 에너지가 −40 dBFS를 처음 넘는 곳(범수_시각.py와 같은 셈).
export function onsetSeconds({ rate, x }, threshold = -40) {
  const win = Math.round(rate * 0.01);
  for (let k = 0; (k + 1) * win <= x.length; k++) {
    let e = 0; for (let i = k * win; i < (k + 1) * win; i++) e += x[i] * x[i];
    if (10 * Math.log10(e / win + 1e-12) > threshold) return k / 100;
  }
  return 0;
}
// Typecast 낱말 시각(원본 기준)을 다듬은 줄 파일 기준으로 옮긴다: speed만큼 줄이고, 첫 낱말 시작을 첫 소리에 맞춘다.
export function shiftWords(words, { onset, speed = 1, duration = Infinity }) {
  if (!words?.length) return [];
  const shift = onset - words[0].start / speed;
  return words.map((w) => ({ text: w.text, start: +Math.max(0, w.start / speed + shift).toFixed(3), end: +Math.min(duration, w.end / speed + shift).toFixed(3) }));
}
export function filterFor(line, trim) {
  const tempo = line.speed && line.speed !== 1 ? `atempo=${line.speed},` : '';
  const head = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02';
  const tail = (line.trim || trim) === 'start' ? '' : ',areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse';
  const cut = line.cut ? `,atrim=end=${line.cut},afade=t=out:st=${Math.max(0, line.cut - 0.06).toFixed(3)}:d=0.06` : '';
  return tempo + head + tail + cut;
}
const probeSeconds = async (file) => Number((await run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { windowsHide: true })).stdout.trim());
async function ffmpegTo(out, args) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const part = out + '.part';
  await run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-nostdin', ...args, '-f', path.extname(out).slice(1) === 'mp3' ? 'mp3' : 'wav', part], { windowsHide: true, maxBuffer: 1 << 26 });
  fs.renameSync(part, out);
}
async function measureLufs(file) {
  const r = await run(FFMPEG, ['-hide_banner', '-nostats', '-nostdin', '-i', file, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'], { windowsHide: true, maxBuffer: 1 << 26 });
  const s = r.stderr.slice(r.stderr.lastIndexOf('Summary'));
  const I = /I:\s+(-?[\d.]+) LUFS/.exec(s), P = /Peak:\s+(-?[\d.]+) dBFS/.exec(s);
  return { I: I ? Number(I[1]) : null, peak: P ? Number(P[1]) : null };
}
function rateWarning(l, dur) {
  const syl = hangul(l.text);
  if (syl < 6 || !dur) return null;
  const rate = syl / dur, expected = 5.9 * l.settings.tempo * (l.speed || 1);
  if (rate < expected * 0.6) return `${l.id}: 초당 ${rate.toFixed(1)}음절로 느립니다(어림 ${expected.toFixed(1)}) — 지어냈거나 늘어진 줄일 수 있으니 받아쓰기로 확인하세요.`;
  if (rate > expected * 1.6) return `${l.id}: 초당 ${rate.toFixed(1)}음절로 빠릅니다(어림 ${expected.toFixed(1)}) — 잘렸는지 들어 보세요.`;
  return null;
}
async function processVersion(plan, v, say) {
  const manifestFile = path.join(v.out, 'vo.json');
  const previous = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : null;
  const made = [], missing = [], warnings = [];
  for (const l of v.lines) {
    const cached = l.key && T.findCached(l.voice.id, l.key);
    if (!cached) { missing.push(l.id); continue; }
    const wav = path.join(v.out, l.id + '.wav');
    await ffmpegTo(wav, ['-i', cached.wav, '-af', filterFor(l, plan.trim), '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le']);
    const dur = +(await probeSeconds(wav)).toFixed(3);
    const meta = cached.json ? JSON.parse(fs.readFileSync(cached.json, 'utf8')) : null;
    const words = meta?.words ? shiftWords(meta.words, { onset: onsetSeconds(readWavMono16(wav)), speed: l.speed || 1, duration: dur }) : [];
    const wordCount = l.text.trim().split(/\s+/).length;
    if (meta?.words && meta.words.length !== wordCount) warnings.push(`${l.id}: Typecast 낱말 ${meta.words.length}개 ≠ 띄어쓰기 낱말 ${wordCount}개(낱말 시각을 그대로 믿지 마세요)`);
    fs.writeFileSync(path.join(v.out, l.id + '.json'), JSON.stringify({ tool: TOOL, id: l.id, text: l.text, ...(l.show ? { show: l.show } : {}), dur, words,
      ...(meta ? {} : { note: '옛 캐시라 Typecast 낱말 시각이 없음' }), source: { key: l.key, voice: l.voice, settings: l.settings, speed: l.speed || 1, cut: l.cut || null } }, null, 1) + '\n');
    const w = rateWarning(l, dur); if (w) warnings.push(w);
    made.push({ id: l.id, text: l.text, ...(l.show ? { show: l.show } : {}), ...(l.scene ? { scene: l.scene } : {}), ...(l.at !== undefined ? { at: l.at } : {}),
      dur, syllablesPerSec: hangul(l.text) ? +(hangul(l.text) / dur).toFixed(2) : null, src: rel(plan.srcBase || plan.out, wav), key: l.key, words: words.length, ...(l.variant ? { variant: true } : {}) });
  }
  // 원본이 없는 줄이 하나라도 있으면 목록(vo.json)·지난 줄 정리를 건드리지 않는다 — 캐시를 안 옮긴 새 PC에서 목록이 비지 않게.
  if (missing.length) {
    say(`${v.name ? `판 ${v.name}` : '줄'}: 원본 없음 ${missing.join(',')} — 목록(vo.json)은 그대로 둡니다(사려면 --굽기, 새 PC면 캐시 폴더부터 옮기기).`);
    return { version: v.name, made, missing, warnings };
  }
  // 이 도구가 지난번에 만든 줄 가운데 계획에서 빠진 것만 지운다(이 도구가 만든 파일이 아니면 건드리지 않는다).
  if (previous?.tool === TOOL) for (const old of previous.lines || []) {
    if (v.lines.some((l) => l.id === old.id) || !ID.test(String(old.id))) continue;
    let mine = false;
    try { mine = JSON.parse(fs.readFileSync(path.join(v.out, old.id + '.json'), 'utf8')).tool === TOOL; } catch {}
    if (mine) for (const ext of ['.wav', '.json']) fs.rmSync(path.join(v.out, old.id + ext), { force: true });
  }
  const first = v.lines.find((l) => l.voice);
  fs.mkdirSync(v.out, { recursive: true });
  fs.writeFileSync(manifestFile, JSON.stringify({ tool: TOOL, plan: rel(v.out, plan.file), version: v.name || null, voice: first?.voice || null,
    defaults: first ? { ...first.settings, voiceId: undefined, prev: undefined, next: undefined } : null, made: new Date().toISOString(), lines: made }, null, 1) + '\n');
  // 겹침·넘침(at을 준 줄): 다음 줄 시작 전에 끝나는지, 구간 끝을 넘지 않는지
  const timed = made.filter((x) => x.at !== undefined);
  for (let i = 0; i < timed.length; i++) {
    const a = timed[i], b = timed[i + 1], end = a.at + a.dur - 0.05;
    if (b && end > b.at - 0.03) warnings.push(`${v.name || ''} ${a.id} ${end.toFixed(2)}초에 끝남 → 다음 ${b.id} ${b.at}초와 겹침`);
    const limit = plan.limits.find((x) => a.at >= x.from && a.at < x.to);
    if (limit && end > limit.to) warnings.push(`${v.name || ''} ${a.id} ${end.toFixed(2)}초에 끝남 → 구간 끝 ${limit.to}초 넘음`);
  }
  say(`${v.name ? `판 ${v.name}` : '줄'}: ${made.length}개 다듬음 → ${rel(plan.dir, v.out)}${missing.length ? ` · 원본 없음 ${missing.join(',')}` : ''}`);
  return { version: v.name, made, missing, warnings };
}
function writeTs(plan, results) {
  const prev = fs.existsSync(plan.ts) ? fs.readFileSync(plan.ts, 'utf8') : '';
  const pick = (x) => ({ id: x.id, at: x.at, dur: x.dur, text: x.show || x.text, src: x.src });
  if (!plan.raw.versions) {
    const body = `// ${TOOL}가 만든다(손으로 고치지 않음). 줄마다 시작 초·길이.\nexport const VO = ${JSON.stringify(results[0].made.map(pick), null, 1)} as const;\n`;
    fs.mkdirSync(path.dirname(plan.ts), { recursive: true }); fs.writeFileSync(plan.ts, body); return;
  }
  const old = (prev.match(/export const VO = (\{[\s\S]*\}) as const;/) || [])[1];
  const merged = { ...(old ? JSON.parse(old) : {}), ...Object.fromEntries(results.map((r) => [r.version, r.made.map(pick)])) };
  fs.mkdirSync(path.dirname(plan.ts), { recursive: true });
  fs.writeFileSync(plan.ts, `// ${TOOL}가 만든다(손으로 고치지 않음). 줄마다 시작 초·길이.\nexport const VO = ${JSON.stringify(merged, null, 1)} as const;\nexport type VoVersion = keyof typeof VO;\n`);
}
// 이어 붙인 듣기 판: 앞 무음 + 줄 + 쉼(breaks 앞은 더 길게) → 크기 맞춤·리미터 → wav·mp3 + 줄마다 시작·끝·낱말 시각(take.json)
async function buildTake(plan, result, say) {
  const t = { lead: 0.3, gap: 0.35, breakGap: 0.5, breaks: [], tail: 0.4, lufs: -15.9, limiter: 0.89, ...plan.take };
  const ids = t.lines || plan.versions[0].lines.filter((l) => !l.variant).map((l) => l.id);
  const lines = ids.map((id) => result.made.find((x) => x.id === id));
  if (lines.some((x) => !x)) { say(`이어 붙이기 건너뜀: 없는 줄 ${ids.filter((id, i) => !lines[i]).join(',')}`); return null; }
  const breaks = new Set(t.breaks), args = ['-f', 'lavfi', '-t', String(t.lead), '-i', 'anullsrc=r=48000:cl=mono'];
  let graph = '', labels = '[0:a]', pos = t.lead;
  const segs = {};
  lines.forEach((x, i) => {
    const file = path.join(plan.versions[0].out, x.id + '.wav');
    args.push('-i', file);
    const pad = lines[i + 1] ? (breaks.has(lines[i + 1].id) ? t.breakGap : t.gap) : t.tail;
    graph += `[${i + 1}:a]apad=pad_dur=${pad}[a${i}];`; labels += `[a${i}]`;
    const words = JSON.parse(fs.readFileSync(path.join(plan.versions[0].out, x.id + '.json'), 'utf8')).words || [];
    const on = words.length ? words[0].start : onsetSeconds(readWavMono16(file));
    segs[x.id] = { start: +(pos + on).toFixed(3), end: +(pos + (words.length ? words.at(-1).end : x.dur)).toFixed(3), tokens: words.map((w) => +(pos + w.start).toFixed(3)) };
    pos += x.dur + pad;
  });
  const joined = path.join(os.tmpdir(), `synk-take-${process.pid}-${Date.now()}.wav`);
  try {
    await ffmpegTo(joined, [...args, '-filter_complex', `${graph}${labels}concat=n=${lines.length + 1}:v=0:a=1[out]`, '-map', '[out]', '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le']);
    const before = await measureLufs(joined), gain = +(t.lufs - before.I).toFixed(2), af = `volume=${gain}dB,alimiter=limit=${t.limiter}:level=false`;
    const out = {};
    if (t.wav) { out.wav = path.resolve(plan.dir, t.wav); await ffmpegTo(out.wav, ['-i', joined, '-af', af, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le']); }
    if (t.mp3) { out.mp3 = path.resolve(plan.dir, t.mp3); await ffmpegTo(out.mp3, ['-i', joined, '-af', af, '-ar', '48000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k']); }
    const after = await measureLufs(out.wav || out.mp3), seconds = +(await probeSeconds(out.wav || out.mp3)).toFixed(3);
    const json = path.resolve(plan.dir, t.json || (t.wav ? t.wav.replace(/\.wav$/i, '.json') : t.mp3.replace(/\.mp3$/i, '.json')));
    fs.writeFileSync(json, JSON.stringify({ tool: TOOL, engine: 'Typecast', voice: lines.length ? plan.versions[0].lines[0].voice : null, made: new Date().toISOString(),
      timing: 'Typecast 낱말 시각 + 이은 자리 계산(받아쓰기 정렬 아님)', seconds, gaps: { lead: t.lead, gap: t.gap, breakGap: t.breakGap, breaks: t.breaks, tail: t.tail },
      loudness: { before: before.I, gainDb: gain, target: t.lufs, after: after.I, peak: after.peak }, files: Object.fromEntries(Object.entries(out).map(([k, f]) => [k, rel(plan.dir, f)])), segs }, null, 1) + '\n');
    say(`이어 붙인 판: ${seconds}초 · ${before.I} → ${after.I} LUFS · 최대 ${after.peak} dBFS → ${Object.values(out).map((f) => rel(plan.dir, f)).join(', ')} (귀로 듣고 고르세요)`);
    return { ...out, json, seconds, loudness: after };
  } finally { fs.rmSync(joined, { force: true }); }
}

// ── 키 파일·잔량 ─────────────────────────────────────────────────────────
function openKeyFile(file) {
  if (fs.existsSync(file)) { console.log(`키 파일이 이미 있습니다: ${file} (내용은 읽지 않았습니다)`); return; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '', { flag: 'wx' });
  console.log(`빈 키 파일을 만들었습니다: ${file}\n메모장에 Typecast API 키를 한 줄로 붙여 넣고 저장해 주세요. 키는 채팅으로 보내지 않습니다.`);
  if (process.platform === 'win32') spawn('notepad.exe', [file], { detached: true, stdio: 'ignore' }).unref();
}
async function readBalance(keyFile) {
  let key = T.readKey(keyFile);
  try { return T.credits(await T.call('/v1/users/me/subscription', { key })); }
  catch (error) { throw error.status === 401 ? Error('Typecast가 키를 거절했습니다(401). 키 파일을 확인해 주세요.') : error; }
  finally { key = ''; }
}

// ── 명령 ─────────────────────────────────────────────────────────────────
// 도움말 = 파일 머리의 주석 덩어리
const helpText = (src) => { const out = []; for (const l of src.split('\n')) { if (l.startsWith('//')) out.push(l.replace(/^\/\/ ?/, '')); else if (out.length) break; } return out.join('\n'); };
function parseArgs(argv) {
  const flags = new Set(['--굽기', '--다듬기', '--견적', '--json', '--잔량', '--키파일-열기', '--도움', '--help']);
  const values = new Set(['--줄', '--판', '--최대', '--목소리', '--출력', '--src기준', '--ts', '--키파일']);
  const o = { plan: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (flags.has(a)) o[a] = true;
    else if (values.has(a)) { if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw Error(`${a} 뒤에 값이 필요합니다.`); o[a] = argv[++i]; }
    else if (!a.startsWith('--') && !o.plan) o.plan = a;
    else throw Error('모르는 인자: ' + a);
  }
  return o;
}
export async function main(argv = process.argv.slice(2)) {
  const o = parseArgs(argv);
  if (o['--도움'] || o['--help'] || (!o.plan && !o['--잔량'] && !o['--키파일-열기'])) {
    console.log(helpText(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')));
    return 0;
  }
  if (o['--키파일-열기']) { openKeyFile(T.keyFilePath({ explicit: o['--키파일'] })); return 0; }
  if (o['--잔량']) { const c = await readBalance(T.keyFilePath({ explicit: o['--키파일'] })); console.log(JSON.stringify({ left: c.left, plan: c.plan, used: c.used, note: '굽고 한참 뒤에 반영됩니다' })); return 0; }
  const plan = loadPlan(o.plan, { voice: o['--목소리'], out: o['--출력'], srcBase: o['--src기준'], ts: o['--ts'] });
  if (plan.problems.length) { console.error('계획 파일 문제:\n  ' + plan.problems.join('\n  ')); return 1; }
  const only = o['--줄'] ? o['--줄'].split(',').map((s) => s.trim()).filter(Boolean) : null;
  const versions = o['--판'] ? o['--판'].split(',').map((s) => s.trim()).filter(Boolean) : null;
  for (const v of versions || []) if (!plan.versions.some((x) => x.name === v)) { console.error('계획에 없는 판: ' + v); return 1; }
  for (const id of only || []) if (!plan.versions.some((v) => (!versions || versions.includes(v.name)) && v.lines.some((l) => l.id === id))) { console.error('계획에 없는 줄: ' + id); return 1; }
  const buying = !!o['--굽기'], processing = buying || !!o['--다듬기'];
  const s = survey(plan, { only, versions, copyLegacy: processing });
  if (!processing || o['--견적']) {
    if (o['--json']) console.log(JSON.stringify({ lines: s.wanted.length, unique: s.unique.length, cached: s.unique.length - s.todo.length, fromLegacy: s.fromLegacy, newLines: s.todo.length, newChars: s.newChars, credits: s.newChars, cacheRoot: s.cacheRoot, cacheExists: s.cacheExists }));
    else printSurvey(plan, s);
    return 0;
  }
  const say = o['--json'] ? () => {} : (m) => console.log(m);
  if (!o['--json']) printSurvey(plan, s);
  let purchase = { bought: 0, chars: 0 };
  if (buying) purchase = await buy(plan, s, { keyFile: s.todo.length ? T.keyFilePath({ explicit: o['--키파일'] }) : null, maxChars: Number(o['--최대'] || 3000), say });
  else if (s.todo.length) say(`캐시에 없는 줄 ${s.todo.length}개는 건너뜁니다(사려면 --굽기).`);
  const results = [];
  for (const v of s.chosen) results.push(await processVersion(plan, v, say));
  const incomplete = results.some((r) => r.missing.length);
  if (plan.ts && incomplete) say(`Remotion 목록은 그대로 둡니다(원본 없는 줄이 있음): ${rel(plan.dir, plan.ts)}`);
  else if (plan.ts) { writeTs(plan, results); say(`Remotion 목록: ${rel(plan.dir, plan.ts)}`); }
  const take = plan.take && !versions ? await buildTake(plan, results[0], say) : null;
  const warnings = results.flatMap((r) => r.warnings);
  for (const w of warnings) say('⚠ ' + w);
  if (o['--json']) console.log(JSON.stringify({ purchase, versions: results.map((r) => ({ version: r.version, made: r.made.length, missing: r.missing })), take, warnings }));
  return incomplete ? 3 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }).catch((error) => { console.error(error.message); process.exitCode = error.code === 'NO_KEY_FILE' ? 2 : 1; });
}
