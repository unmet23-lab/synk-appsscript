#!/usr/bin/env node
/**
 * 입장 검사 근무지 장면을 «끊김 없이 반복되는 8초 영상»으로 굽는다(Veo 3.1 · Vertex · 소리 없음).
 *
 * 교훈은 tools/라디오무대영상.js(10-20 보관 — docs/_ops/도구_보관목록.md)에서 가져왔다.
 *  - 첫 장면과 끝 장면을 같은 그림으로 못 박는다(lastFrame). 카메라가 제자리로 돌아와 이음매가 사라진다.
 *  - 장면에는 생명을 그리지 않는다. 손님은 지금 그림 그대로 화면에서 얹는다(영상 모델이 그리면 닮은 다른 동물이 된다).
 *  - 카메라가 밀려 들어가는 컷이 나온다(09-07 house). 그래서 굽고 나면 프레임 다섯을 뽑아 확대·이동을 먼저 잰다.
 *  - 종량제라 --유료-api 없이는 부르지 않는다. 영상은 사용자 승인 뒤에만 굽는다(2026-10-02: 도서관 1곳 시험 승인).
 *
 *   node experiences/entry-check/art-source/scene-video.mjs --장소 library --값만
 *   node experiences/entry-check/art-source/scene-video.mjs --장소 library --유료-api
 *   node experiences/entry-check/art-source/scene-video.mjs --장소 library --인코딩만 art-source/video-raw/<파일>.mp4
 *   node experiences/entry-check/art-source/scene-video.mjs --장소 library --작업 <작업 이름> --유료-api   (이미 낸 작업을 다시 받기만)
 *   같은 장소에 결과 없는 최근 작업이 영상기록.json에 있으면 새로 제출하지 않는다. 일부러 새로 구울 때만 --새로.
 * 결과: art-source/video-raw/(git 제외 원본) → assets/scenes/<장소>.mp4(1080p) · <장소>-m.mp4(720p) + 영상기록.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const game = path.resolve(here, '..');
const repo = path.resolve(here, '../../..');
const require = createRequire(import.meta.url);
const 정책 = require(path.join(repo, 'tools', '모델정책.js'));

const MODEL = process.env.SYNK_VEO_MODEL || 'veo-3.1-generate-001';
const SECONDS = 8;
const USD_PER_SEC = 0.40;   // 4K SKU 값(09-05 실측). 1080p·720p는 이보다 싸므로 «넉넉히 잡은 상한»이다
const KRW = 1452;           // 무료 크레딧 $300 = ₩435,523 실측 환율(tools/홍보영상굽기.js)
const RAW = path.join(here, 'video-raw');
const LOG = path.join(here, '영상기록.json');

const COMMON = 'Handmade needle-felted wool miniature diorama, macro photograph, shallow depth of field, warm golden-hour light. '
  + 'Locked-off tripod shot: the framing is identical from the first to the last frame. The set never changes shape. '
  + 'Only the motion described below happens, very gently and slowly, and everything returns to where it started. ';
const NEGATIVE = 'character, creature, animal, bird, insect, person, people, human, face, eyes, mascot, doll, toy figure, '
  + 'camera movement, zoom, dolly, push-in, pan, tilt, shake, handheld, cut, transition, '
  + 'text, letters, numbers, writing on signs, watermark, logo, subtitles, '
  + 'fog, haze, smoke, mist, rain, snow, falling particles, dust, strobe, fast motion';

// 장소마다 «무엇이 움직이나». 구조는 그대로 두고 결만 흔든다. 사람·동물 없이.
const SCENES = {
  library: {
    name: '별빛 도서관',
    motion: 'The small white felt flowers and green leaves in the planters sway softly in a light breeze. '
      + 'The tree leaves at the top corners rustle slightly. The pink clouds drift very slowly. '
      + 'The warm lamp lights and the pendant lights inside the open door glow and brighten softly. '
      + 'The blank cream sign boards stay blank. The doors stay open and still.',
  },
  pool: {
    name: '하늘 수영장',
    motion: 'The pool water ripples gently and sunlight sparkles move softly on the water surface. '
      + 'The leaves of the plants sway slightly in a light breeze. The clouds drift very slowly. Nothing else moves.',
  },
  museum: {
    name: '바람 미술관',
    motion: 'The banners and flags flutter gently in a light breeze. The leaves of the trees and the flowers sway slightly. '
      + 'The clouds drift very slowly. The warm lights glow softly. Nothing else moves.',
  },
  concert: {
    name: '노을 공원 음악회',
    motion: 'The small string lights twinkle softly one by one. The grass and the leaves sway slightly in a light breeze. '
      + 'The sunset clouds drift very slowly. The stage stays empty. Nothing else moves.',
  },
};

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const key = arg('--장소');
const resolution = arg('--해상도', '1080p');
if (!SCENES[key]) { console.error(`장소를 고른다: --장소 ${Object.keys(SCENES).join('|')}`); process.exit(2); }

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} 실패: ${(r.stderr || r.stdout || '').slice(-600)}`);
  return r.stdout;
}

/** 3:2 장면에서 16:9를 자른다. 화면이 50% 64%에 맞춰 보여 주므로 같은 높이 비율로 자른다. */
function startFrame() {
  fs.mkdirSync(RAW, { recursive: true });
  const src = path.join(game, 'art-source', 'raw');
  const scene = path.join(game, 'assets', 'scenes', `${key}.webp`);
  const out = path.join(RAW, `${key}_start.png`);
  const py = [
    'from PIL import Image',
    'import sys',
    'im = Image.open(sys.argv[1]).convert("RGB")',
    'w, h = im.size',
    'ch = round(w * 9 / 16)',
    'y = round((h - ch) * 0.64)',
    'im.crop((0, y, w, y + ch)).resize((1920, 1080), Image.LANCZOS).save(sys.argv[2])',
    'print(w, h, y, ch)',
  ].join('\n');
  run('python', ['-c', py, scene, out]);
  void src;
  return out;
}

function readLog() { try { return JSON.parse(fs.readFileSync(LOG, 'utf8')); } catch { return []; } }
function writeLog(entry) { const l = readLog(); l.push(entry); fs.writeFileSync(LOG, JSON.stringify(l, null, 2) + '\n'); }

const baseUrl = () => `https://us-central1-aiplatform.googleapis.com/v1/projects/${정책.벌텍스프로젝트()}/locations/us-central1/publishers/google/models/${MODEL}`;

/** 제출한 작업을 끝까지 기다려 받는다. 조회 오류(네트워크·토큰·401·403·5xx)는 견디고 이어 본다. 작업 이름은 이미 기록에 있다. */
async function fetchJob(jobName) {
  let strikes = 0;
  for (let i = 0; i < 120; i++) {
    await new Promise((res) => setTimeout(res, 10000));
    let pj;
    try {
      const h2 = await 정책.제미나이헤더('돈');   // 토큰은 부를 때마다 새로(중간 만료 대비)
      const p = await fetch(`${baseUrl()}:fetchPredictOperation`, { method: 'POST', headers: h2, body: JSON.stringify({ operationName: jobName }) });
      if (p.status === 404) throw Object.assign(new Error(`작업을 찾을 수 없다(404): ${jobName}`), { fatal: true });
      if (!p.ok) { strikes += 1; console.log(`  조회 ${p.status} — 다시 본다(${strikes}) · 작업 ${jobName}`); if (strikes >= 12) break; continue; }
      pj = await p.json();
      strikes = 0;
    } catch (e) {
      if (e.fatal) throw e;
      strikes += 1; console.log(`  조회 오류 ${e.message} — 다시 본다(${strikes})`); if (strikes >= 12) break; continue;
    }
    if (!pj.done) { if (i % 6 === 5) console.log(`  …${(i + 1) * 10}초`); continue; }
    if (pj.error) throw new Error(`작업 실패: ${pj.error.message || ''} · 작업 ${jobName}`);
    const v = pj.response?.videos?.[0] || pj.response?.generatedSamples?.[0]?.video;
    if (!v?.bytesBase64Encoded) throw new Error(`영상이 안 왔다: ${JSON.stringify(pj.response || {}).slice(0, 300)}`);
    const file = path.join(RAW, `${key}_${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`);
    fs.mkdirSync(RAW, { recursive: true });
    fs.writeFileSync(file, Buffer.from(v.bytesBase64Encoded, 'base64'));
    const l = readLog(); const last = l.findLast((e) => e.job === jobName); if (last) { last.file = path.relative(game, file).replace(/\\/g, '/'); fs.writeFileSync(LOG, JSON.stringify(l, null, 2) + '\n'); }
    return file;
  }
  throw new Error(`아직 받지 못했다. 다시 받기: --작업 ${jobName} (새로 제출하지 말 것)`);
}

async function bake(imagePath) {
  정책.유료API요구('Google Veo Vertex AI');
  // 같은 장소에 결과 없는 작업이 하루 안에 있으면 새로 내지 않는다(받기만 하면 되는데 다시 과금되는 사고 방지)
  const pending = readLog().filter((e) => e.scene === key && !e.file && Date.now() - Date.parse(e.at) < 24 * 3600e3);
  if (pending.length && !argv.includes('--새로')) {
    throw new Error(`결과를 아직 받지 않은 작업이 있다: ${pending.map((e) => e.job).join(', ')}\n  받기: --작업 <이름> · 정말 새로 구울 때만 --새로`);
  }
  const base = baseUrl();
  const b64 = fs.readFileSync(imagePath).toString('base64');
  const s = SCENES[key];
  const body = {
    instances: [{
      prompt: COMMON + s.motion + ' No living creature appears.',
      image: { bytesBase64Encoded: b64, mimeType: 'image/png' },
      lastFrame: { bytesBase64Encoded: b64, mimeType: 'image/png' },   // 끝을 시작과 같게: 카메라를 붙잡고 이음매를 없앤다
    }],
    parameters: {
      sampleCount: 1, durationSeconds: SECONDS, aspectRatio: '16:9', resolution,
      generateAudio: false, personGeneration: 'dont_allow', negativePrompt: NEGATIVE,
    },
  };
  const headers = await 정책.제미나이헤더('돈');
  const r = await fetch(`${base}:predictLongRunning`, { method: 'POST', headers, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.name) throw new Error(`요청 실패 ${r.status}: ${(j.error && j.error.message) || ''}`.replace(/\s+/g, ' '));
  // 낸 돈의 결과를 잃지 않게 작업 이름부터 적는다
  writeLog({ at: new Date().toISOString(), scene: key, model: MODEL, resolution, seconds: SECONDS, job: j.name, maxUsd: SECONDS * USD_PER_SEC });
  console.log(`작업 ${j.name.split('/').pop()} — 기다린다`);
  return fetchJob(j.name);
}

/** 웹용으로 다시 싼다: 소리 없음, 마지막 한 장(첫 장과 같은 그림) 빼기, 빠른 시작. */
function encode(rawFile) {
  const dur = Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', rawFile]).trim());
  const fps = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'default=nw=1:nk=1', rawFile]).trim();
  const [n, d] = fps.split('/').map(Number); const frame = d / n;
  const keep = (dur - frame).toFixed(3);
  const outs = [
    [path.join(game, 'assets', 'scenes', `${key}.mp4`), 'scale=1920:-2', '25'],
    [path.join(game, 'assets', 'scenes', `${key}-m.mp4`), 'scale=1280:-2', '27'],
  ];
  // --반복 T,d: 0~T초만 쓰고 끝 d초를 처음 d초와 겹쳐 잇는다(끝에서 멈추거나 처음과 다르게 끝난 영상도 이음매 없이 돈다).
  // 결과 길이는 T-d초이고 마지막 장면이 첫 장면으로 그대로 이어진다.
  const loop = arg('--반복');
  for (const [out, vf, crf] of outs) {
    const enc = ['-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out];
    if (loop) {
      const [T, d] = loop.split(',').map(Number);
      const fc = `[0:v]trim=0:${T},setpts=PTS-STARTPTS,${vf},split[a][b];[a]trim=${d}:${T},setpts=PTS-STARTPTS[A];`
        + `[b]trim=0:${d},setpts=PTS-STARTPTS[B];[A][B]xfade=transition=fade:duration=${d}:offset=${(T - 2 * d).toFixed(3)},format=yuv420p[v]`;
      run('ffmpeg', ['-y', '-v', 'error', '-i', rawFile, '-filter_complex', fc, '-map', '[v]', ...enc]);
    } else {
      run('ffmpeg', ['-y', '-v', 'error', '-i', rawFile, '-t', keep, '-vf', `${vf},format=yuv420p`, ...enc]);
    }
    console.log(`  ${path.relative(game, out)} ${(fs.statSync(out).size / 1024).toFixed(0)}KB`);
  }
  // 확인 프레임 다섯(0.2·2·4·6·끝 직전)
  const shots = path.join(RAW, `${key}_frames`); fs.mkdirSync(shots, { recursive: true });
  for (const t of [0.04, 2, 4, 6, Number(keep) - 0.05]) {
    run('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', rawFile, '-frames:v', '1', path.join(shots, `t${t.toFixed(2)}.png`)]);
  }
  console.log(`  확인 프레임: ${path.relative(game, shots)}`);
}

const est = SECONDS * USD_PER_SEC;
console.log(`${SCENES[key].name} — ${SECONDS}초 · ${resolution} · 소리 없음 · 상한 $${est.toFixed(2)} ≈ ₩${Math.round(est * KRW).toLocaleString()}`);
if (argv.includes('--값만')) process.exit(0);
const only = arg('--인코딩만');
if (only) { encode(path.resolve(game, only)); process.exit(0); }
const job = arg('--작업');
if (job) { 정책.유료API요구('Google Veo Vertex AI'); const raw = await fetchJob(job); console.log(`원본 ${path.relative(game, raw)}`); encode(raw); process.exit(0); }
const start = startFrame();
const raw = await bake(start);
console.log(`원본 ${path.relative(game, raw)}`);
encode(raw);
