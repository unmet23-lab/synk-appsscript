#!/usr/bin/env node
/**
 * 입장 검사 목소리 굽기 — 손님 대사와 안내 목소리(나레이션)를 한 번 구워 정적 파일로 둔다.
 *
 *  - 접속마다 AI를 부르지 않는다. 굽는 비용은 한 번뿐이고 학습자 수와 상관없다(api-cost-must-not-leak).
 *  - 엔진: Gemini TTS(Vertex, 무료 크레딧 문). 저장소의 로컬 한국어 엔진(tools/목소리굽기.js · Qwen3-TTS Sohee)은
 *    2026-10-02 현재 이 PC에 가상환경·모델이 없고, 한국어 목소리가 하나뿐이라 손님 열두 명을 가를 수 없다.
 *  - 숫자는 읽는 법이 갈린다(65살 = 예순다섯 살, 3년 = 삼 년). 숫자가 든 줄은 SPOKEN에 읽을 글을 따로 적어야 굽는다.
 *  - 종량제라 --유료-api 없이는 부르지 않는다.
 *
 *   node experiences/entry-check/art-source/voice.mjs --목록
 *   node experiences/entry-check/art-source/voice.mjs --유료-api                 (없는 것만 굽기)
 *   node experiences/entry-check/art-source/voice.mjs --유료-api --다시 line-pool-01,nar-memo
 *   node experiences/entry-check/art-source/voice.mjs --유료-api --만 nar-      (이름이 nar-로 시작하는 것만)
 * 결과: art-source/voice-raw/(git 제외 원본 wav) → assets/voice/<id>.mp3 + assets/voice/voices.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { CAST, VENUES } from '../content.mjs';
import { BRIEF_LEAD, MEMO_LINE, RESULT_LINES, TUTORIAL, VOICE_ID, GENERIC_THANKS, GENERIC_WHY } from '../narration.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const game = path.resolve(here, '..');
const repo = path.resolve(here, '../../..');
const require = createRequire(import.meta.url);
const 정책 = require(path.join(repo, 'tools', '모델정책.js'));

const MODEL = process.env.SYNK_TTS_MODEL || 'gemini-3.8-flash-tts';
const RAW = path.join(here, 'voice-raw');
const OUT = path.join(game, 'assets', 'voice');
const MANIFEST = path.join(OUT, 'voices.json');

// 배역: 그림(art-source 손님 판)에 맞춘 나이·성격. 목소리 이름은 Gemini TTS 기본 목소리.
export const VOICES = {
  narrator: { voice: 'Sulafat', who: 'a warm, calm female storyteller reading a picture book aloud to Korean learners' },
  bear: { voice: 'Achird', who: 'a cheerful, friendly young man in his early twenties' },
  raccoon: { voice: 'Zubenelgenubi', who: 'an easygoing, chatty middle-aged man in his mid-forties' },
  rabbit: { voice: 'Gacrux', who: 'a kind, gentle grandmother in her seventies who speaks slowly and softly' },
  fox: { voice: 'Iapetus', who: 'a polite office worker in his early thirties, a little hurried' },
  squirrel: { voice: 'Leda', who: 'a bubbly six-year-old girl with a high, bright child voice' },
  hedgehog: { voice: 'Laomedeia', who: 'an energetic nine-year-old boy with a bright child voice' },
  penguin: { voice: 'Zephyr', who: 'a bright, friendly young woman in her mid-twenties' },
  ducks: { voice: 'Callirrhoe', who: 'a warm, gentle mother in her thirties' },
  otter: { voice: 'Algenib', who: 'a good-natured grandfather in his sixties with a low, slightly gravelly voice' },
  deer: { voice: 'Despina', who: 'a calm, soft-spoken young woman in her twenties' },
  panda: { voice: 'Autonoe', who: 'a fifteen-year-old middle school girl, bright and a little shy' },
  sheep: { voice: 'Aoede', who: 'an excited, sweet young woman in her early twenties' },
};

// 숫자가 든 글은 읽는 법을 직접 적는다(화면 글은 그대로 숫자).
const SPOKEN = {
  'reply-library-02': '그럼 일 층에서 카드를 새로 만들게요.',
  'nar-oops-library-08': '도치가 시계를 가리켰어요. “아직 다섯 시 삼십 분 전인데요?”',
  'nar-oops-museum-04': '토순 할머니가 안내문을 가리켰어요. “예순다섯 살 이상은 무료라고 쓰여 있어요.”',
  'nar-oops-concert-01': '솜이 씨가 안내문을 가리켰어요. “구 일 표로 들어올 수 있다고 쓰여 있어요.”',
  'reply-museum-05': '허허, 삼 년만 더 기다릴게요.',
};

// 줄마다 덧붙이는 연출 메모(받아쓰기 확인에서 글과 소리가 어긋난 줄). 화면 글과 소리를 맞추려고 쓴다.
const NOTES = {
  'line-museum-07': 'Pronounce 되지요 fully as three syllables 되-지-요. Do not contract it to 되죠.',
  'reply-library-04': 'Start with the short interjection 아 (a soft "ah"), then the rest of the line.',
};

/** 구울 줄 전부: { id, text(화면 글), spoken(읽을 글), speaker } */
export function voiceLines() {
  const lines = [];
  const add = (id, text, speaker) => lines.push({ id, text, spoken: SPOKEN[id] || text, speaker });
  for (const step of TUTORIAL) add(VOICE_ID.tutorial(step.id), step.text, 'narrator');
  for (const v of VENUES) {
    add(VOICE_ID.brief(v.id), `${BRIEF_LEAD[v.id]} ${v.briefing}`, 'narrator');
    for (const c of v.cases) {
      add(VOICE_ID.line(c.id), c.line, c.who);
      add(VOICE_ID.reply(c.id), c.reply, c.who);
      add(VOICE_ID.oops(c.id), c.oops, 'narrator');
    }
  }
  add(VOICE_ID.memo(), MEMO_LINE, 'narrator');
  RESULT_LINES.forEach((t, i) => add(VOICE_ID.result(i), t, 'narrator'));
  for (const who of Object.keys(CAST)) {
    add(VOICE_ID.thanks(who), GENERIC_THANKS, who);
    add(VOICE_ID.why(who), GENERIC_WHY, who);
  }
  const ids = new Set();
  for (const l of lines) {
    if (ids.has(l.id)) throw new Error(`같은 이름이 둘: ${l.id}`);
    ids.add(l.id);
    if (/\d/.test(l.spoken)) throw new Error(`숫자는 읽는 법을 SPOKEN에 적는다: ${l.id} «${l.text}»`);
    if (!VOICES[l.speaker]) throw new Error(`배역 없음: ${l.speaker}`);
  }
  return lines;
}

// 2026-10-02 시험: 한 문장 지시(「…as X. Say only the Korean words after the colon: 대사」)는 9줄 중 5줄에서
// 지시문까지 소리로 읽었고 1줄은 없는 말을 지어냈다(받아쓰기로 확인). 그래서 연출 메모와 대본을 머리글로 가른다.
const PROMPT_MODE = process.env.SYNK_TTS_PROMPT || 'notes';
function prompt(line) {
  const v = VOICES[line.speaker];
  if (PROMPT_MODE === 'plain') return line.spoken;
  return [
    "### DIRECTOR'S NOTES (never read these notes aloud)",
    `Voice: ${v.who}.`,
    'Language: Korean, standard Seoul accent. Pace: relaxed and clear for beginner learners.',
    'Read only the transcript, exactly as written. Do not add or change any words.',
    ...(NOTES[line.id] ? [`Note: ${NOTES[line.id]}`] : []),
    '',
    '### TRANSCRIPT',
    line.spoken,
  ].join('\n');
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} 실패: ${(r.stderr || '').slice(-400)}`);
  return r.stdout;
}

async function tts(line) {
  const proj = 정책.벌텍스프로젝트();
  const url = `https://aiplatform.googleapis.com/v1/projects/${proj}/locations/global/publishers/google/models/${MODEL}:generateContent`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt(line) }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES[line.speaker].voice } } } },
  };
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await fetch(url, { method: 'POST', headers: await 정책.제미나이헤더('돈'), body: JSON.stringify(body) });
    const t = await r.text();
    if (r.status === 429 || r.status >= 500) { await new Promise((res) => setTimeout(res, 4000 * attempt)); continue; }
    if (!r.ok) throw new Error(`${r.status} ${t.slice(0, 200)}`);
    const part = JSON.parse(t).candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) throw new Error(`소리가 안 왔다: ${t.slice(0, 200)}`);
    return { mime: part.inlineData.mimeType, data: Buffer.from(part.inlineData.data, 'base64') };
  }
  throw new Error('네 번 시도해도 실패');
}

/** 원본 → 웹용 mp3: 앞뒤 정적 걷기, 크기 맞추기(-17 LUFS), 모노 24kHz. */
function encode(rawPath, mime, outPath) {
  const input = /wav/i.test(mime) ? ['-i', rawPath] : ['-f', 's16le', '-ar', '24000', '-ac', '1', '-i', rawPath];
  const af = 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.04,areverse,'
    + 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.06,areverse,'
    + 'loudnorm=I=-17:TP=-1.5:LRA=11,adelay=40|40,apad=pad_dur=0.12';
  run('ffmpeg', ['-y', '-v', 'error', ...input, '-af', af, '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '48k', outPath]);
  return Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', outPath]).trim());
}

function readManifest() { try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { return { model: MODEL, lines: {} }; } }

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const lines = voiceLines();
  if (argv.includes('--목록')) {
    const by = {}; for (const l of lines) by[l.speaker] = (by[l.speaker] || 0) + 1;
    console.log(`${lines.length}줄 · 글자 ${lines.reduce((n, l) => n + l.spoken.length, 0)}`);
    for (const [k, n] of Object.entries(by)) console.log(`  ${k.padEnd(9)} ${String(n).padStart(3)}줄 · ${VOICES[k].voice}`);
    return;
  }
  정책.유료API요구('Gemini TTS(Vertex)');
  // 값을 낸 소리를 못 싸서 버리는 일이 없게, 부르기 전에 ffmpeg·ffprobe부터 확인한다
  for (const tool of ['ffmpeg', 'ffprobe']) {
    if (spawnSync(tool, ['-version'], { encoding: 'utf8' }).status !== 0) throw new Error(`${tool}이 없다 — 설치 뒤 다시(유료 호출 전 멈춤)`);
  }
  fs.mkdirSync(RAW, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
  const again = new Set((arg('--다시') || '').split(',').filter(Boolean));
  const only = arg('--만');
  const manifest = readManifest();
  const todo = lines.filter((l) => (!only || l.id.startsWith(only))
    && (again.has(l.id) || !fs.existsSync(path.join(OUT, `${l.id}.mp3`)) || manifest.lines[l.id]?.spoken !== l.spoken || manifest.lines[l.id]?.voice !== VOICES[l.speaker].voice));
  console.log(`굽기 ${todo.length}줄 / 전체 ${lines.length}줄 · ${MODEL}`);
  let done = 0, failed = 0;
  const worker = async () => {
    while (todo.length) {
      const l = todo.shift();
      try {
        // 같은 글·같은 목소리·같은 지시 방식으로 받아 둔 원본이 있으면 다시 부르지 않고 싸기만 한다(--다시는 언제나 새로)
        const sidecar = path.join(RAW, `${l.id}.json`);
        const want = { spoken: l.spoken, voice: VOICES[l.speaker].voice, model: MODEL, prompt: PROMPT_MODE };
        let prev = null; try { prev = JSON.parse(fs.readFileSync(sidecar, 'utf8')); } catch { prev = null; }
        let raw, mime;
        if (!again.has(l.id) && prev && JSON.stringify(prev.want) === JSON.stringify(want) && fs.existsSync(path.join(RAW, prev.file))) {
          raw = path.join(RAW, prev.file); mime = prev.mime;
        } else {
          const got = await tts(l);
          mime = got.mime; raw = path.join(RAW, `${l.id}${/wav/i.test(mime) ? '.wav' : '.pcm'}`);
          fs.writeFileSync(raw, got.data);
          fs.writeFileSync(sidecar, JSON.stringify({ want, file: path.basename(raw), mime }));
        }
        const dur = encode(raw, mime, path.join(OUT, `${l.id}.mp3`));
        manifest.lines[l.id] = { text: l.text, spoken: l.spoken, speaker: l.speaker, voice: VOICES[l.speaker].voice, dur: Math.round(dur * 100) / 100 };
        done += 1;
        fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');   // 줄마다 저장(중간에 멈춰도 다음에 다시 부르지 않게)
        if (done % 10 === 0) console.log(`  ${done}줄…`);
      } catch (e) { failed += 1; console.log(`  ✗ ${l.id}: ${e.message}`); }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  manifest.model = MODEL; manifest.at = new Date().toISOString();
  // 원고에서 빠진 줄은 목록에서도 뺀다
  const keep = new Set(lines.map((l) => l.id));
  for (const id of Object.keys(manifest.lines)) if (!keep.has(id)) delete manifest.lines[id];
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
  console.log(`끝: 새로 ${done}줄 · 실패 ${failed}줄 · 목록 ${Object.keys(manifest.lines).length}줄`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
