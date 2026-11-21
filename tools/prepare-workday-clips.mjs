// PATH 일터 체험 — 받은 인물 영상을 공개용으로 다듬고 영상 목록(manifest.json)을 채운다.
//
//   node tools/prepare-workday-clips.mjs <직업 id> --from <받은 mp4 폴더> [--only id,id] [--model "<만든 모델>"]
//   node tools/prepare-workday-clips.mjs <직업 id> --reviewed id,id|all      눈과 귀로 본 영상에만 검수 표시를 단다
//   node tools/prepare-workday-clips.mjs <직업 id> --report                   지금 목록을 표로 본다(바꾸지 않음)
//
// 받은 파일 이름은 <클립 id>.mp4 또는 <클립 id>_*.mp4(여럿이면 가장 새 것)다. 하는 일:
//   1. 장면표에서 클립마다 종류(말하는 영상, 경청 영상)와 자리를 읽는다.
//   2. 1280x720 H.264(+faststart)로 다시 담아 jobs/<id>/clips/<클립 id>.mp4 에 둔다. 경청 영상은 소리를 뺀다.
//      자리 사진을 잘라 쓴 자리는 production/clips.json 의 crop 대로 영상도 같게 자른다. 사진을 자른 그림의 크기와
//      사각형을 픽셀로 적는다({ "office": { "from": [2560, 1440], "rect": [62, 70, 2436, 1370] } }). 영상을 그 크기로
//      키운 뒤 같은 픽셀에서 잘라야 사진과 반 픽셀도 어긋나지 않는다.
//   3. 말이 끝나는 때(answerStartSeconds), 시작과 끝의 조용한 구간(head/tailHoldMs)을 소리에서 잰다.
//   4. 배경 고정(still)을 잰다. 자리 사진과 영상의 다섯 프레임을 견줘, 사람 영역(live) 밖의 평균 밝기 차이(outside, 0~255)와
//      전체 이동량(shift, 1280 폭 기준 픽셀)을 적는다. Quest 무대는 이 값이 한도 안인 영상만 그린다(engine/comfort.mjs).
//   5. manifest.json 을 쓴다. reviewed 는 --reviewed 로 따로 단다. 검수 표시가 없는 영상은 화면에서 사진과 자막으로 나간다.
// 원본 mp4는 git에 넣지 않는다(.gitignore). ffmpeg와 ffprobe가 있어야 한다.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateJob } from '../experiences/path-vr/workday/engine/job-schema.mjs';
import { clipHoldsStill } from '../experiences/path-vr/workday/engine/comfort.mjs';

const REPOSITORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JOBS = path.join(REPOSITORY, 'experiences/path-vr/workday/jobs');
const WIDTH = 1280, HEIGHT = 720, PROBE = { width: 640, height: 360 };

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: options.encoding === null ? null : 'utf8', maxBuffer: 1 << 28 });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) throw new Error(`${command} failed: ${String(result.stderr).slice(-600)}`);
  return result;
}

/** Clip id → { kind, place, action, text }. The place is where the learner is when the clip plays. */
export function clipPlan(job) {
  const plan = new Map();
  const add = (id, entry) => { if (id && !plan.has(id)) plan.set(id, entry); };
  for (const scene of job.scenes) {
    let place = scene.place;
    const walk = (steps, from) => {
      let here = from;
      for (const step of steps) {
        if (step.type === 'move') here = step.place;
        if (step.type === 'line') { if (step.place) here = step.place; add(step.clip, { kind: 'speaking', place: here, action: step.action === true, text: step.text, who: step.who }); }
        if (step.type === 'say' || step.type === 'report') add(step.listen, { kind: 'listening', place: here, action: false, text: '', who: '' });
        for (const option of step.options || []) walk(option.then, here);
        if (step.type === 'report') { walk(step.then.included, here); walk(step.then.omitted, here); }
      }
      return here;
    };
    place = walk(scene.steps, place);
  }
  return plan;
}

function probe(file) {
  const info = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate', '-of', 'json', file]).stdout);
  const video = info.streams.find((stream) => stream.codec_type === 'video');
  return { duration: Number(info.format.duration), width: video?.width, height: video?.height, fps: video?.r_frame_rate, audio: info.streams.some((stream) => stream.codec_type === 'audio') };
}

/** Quiet spans from the audio track: [{ start, end }]. `end` is the duration for a span that runs out. */
function quietSpans(file, duration) {
  const log = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'silencedetect=noise=-30dB:d=0.2', '-f', 'null', '-'], { allowFailure: true }).stderr;
  const spans = [];
  for (const line of log.split('\n')) {
    const start = /silence_start: (-?[\d.]+)/.exec(line), end = /silence_end: ([\d.]+)/.exec(line);
    if (start) spans.push({ start: Math.max(0, Number(start[1])), end: duration });
    if (end && spans.length) spans.at(-1).end = Number(end[1]);
  }
  return spans;
}

function grayFrame(file, seconds, filter) {
  const args = ['-hide_banner', '-loglevel', 'error', ...(seconds === null ? [] : ['-ss', seconds.toFixed(3)]), '-i', file, '-frames:v', '1', '-vf', `${filter ? `${filter},` : ''}scale=${PROBE.width}:${PROBE.height},format=gray`, '-f', 'rawvideo', '-'];
  const frame = run('ffmpeg', args, { encoding: null }).stdout;
  if (frame.length !== PROBE.width * PROBE.height) throw new Error(`could not read a frame at ${seconds}s of ${file}`);
  return frame;
}

/** Mean absolute difference outside the live rectangle, and the whole-frame offset that explains it best. */
export function stillness(reference, frame, live, { width = PROBE.width, height = PROBE.height, reach = 6 } = {}) {
  const [x0, y0, x1, y1] = live || [0, 0, 0, 0];
  const inside = (x, y) => live && x >= x0 * width && x < x1 * width && y >= y0 * height && y < y1 * height;
  const difference = (dx, dy) => {
    let sum = 0, count = 0;
    for (let y = reach; y < height - reach; y += 2) for (let x = reach; x < width - reach; x += 2) {
      if (inside(x, y) || inside(x + dx, y + dy)) continue;
      sum += Math.abs(reference[y * width + x] - frame[(y + dy) * width + x + dx]); count++;
    }
    return count ? sum / count : 0;
  };
  const still = difference(0, 0);
  let best = still, shift = 0;
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
    const value = difference(dx, dy);
    // A moved frame must explain the difference clearly better than the unmoved one.
    if (value < best - 0.15) { best = value; shift = Math.hypot(dx, dy); }
  }
  return { outside: still, shift: shift * (WIDTH / width) };
}

/** How much brighter the clip is than the photograph outside the live rectangle (mean, signed, 0~255).
 * A generated clip often comes back a few levels brighter; the transcode takes that back out so the
 * join between photograph and film does not flash. */
export function brightnessOffset(reference, frame, live, { width = PROBE.width, height = PROBE.height } = {}) {
  const [x0, y0, x1, y1] = live || [0, 0, 0, 0];
  let sum = 0, count = 0;
  for (let y = 4; y < height - 4; y += 2) for (let x = 4; x < width - 4; x += 2) {
    if (live && x >= x0 * width && x < x1 * width && y >= y0 * height && y < y1 * height) continue;
    sum += frame[y * width + x] - reference[y * width + x]; count++;
  }
  return count ? sum / count : 0;
}

function newest(folder, id) {
  const files = readdirSync(folder).filter((name) => name === `${id}.mp4` || (name.startsWith(`${id}_`) && name.endsWith('.mp4')));
  return files.map((name) => path.join(folder, name)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] || null;
}

function main() {
  const args = process.argv.slice(2), jobId = args[0];
  const option = (name) => { const index = args.indexOf(name); return index > -1 ? args[index + 1] : undefined; };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(jobId || '')) throw new Error('Usage: node tools/prepare-workday-clips.mjs <job> --from <folder> | --reviewed <ids|all> | --report');
  const folder = path.join(JOBS, jobId), manifestFile = path.join(folder, 'manifest.json');
  const job = JSON.parse(readFileSync(path.join(folder, 'job.json'), 'utf8'));
  const checked = validateJob(job);
  if (!checked.ok) throw new Error(`장면표가 검증을 통과하지 못했어요: ${checked.errors[0]}`);
  const plan = clipPlan(job);
  const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
  const clips = new Map((manifest.clips || []).map((clip) => [clip.id, clip]));
  const settingsFile = path.join(folder, 'production/clips.json');
  const settings = existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, 'utf8')) : {};

  if (args.includes('--from')) {
    const from = path.resolve(option('--from')), only = option('--only')?.split(',');
    mkdirSync(path.join(folder, 'clips'), { recursive: true });
    for (const [id, entry] of plan) {
      if (only && !only.includes(id)) continue;
      const source = newest(from, id);
      if (!source) continue;
      const place = job.places[entry.place], crop = settings.crop?.[entry.place];
      const cropFilter = crop ? `scale=${crop.from[0]}:${crop.from[1]}:flags=lanczos,crop=${crop.rect[2]}:${crop.rect[3]}:${crop.rect[0]}:${crop.rect[1]}` : '';
      const target = path.join(folder, 'clips', `${id}.mp4`), silent = entry.kind === 'listening';
      // Stillness and brightness are judged against the photograph the page shows (the published
      // one, not the 2K working copy).
      const reference = grayFrame(path.join(folder, place.photo), null, '');
      const offset = brightnessOffset(reference, grayFrame(source, 0.04, cropFilter), place.live);
      const eq = Math.abs(offset) >= 1 && Math.abs(offset) <= 12 ? `eq=brightness=${(-offset / 255).toFixed(4)},` : '';
      run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-vf', `${cropFilter ? `${cropFilter},` : ''}scale=${WIDTH}:${HEIGHT}:flags=lanczos,${eq}format=yuv420p`,
        '-c:v', 'libx264', '-profile:v', 'high', '-crf', '21', '-preset', 'slow', '-movflags', '+faststart', ...(silent ? ['-an'] : ['-c:a', 'aac', '-b:a', '128k', '-ac', '2']), target]);
      const info = probe(target);
      if (!silent && !info.audio) throw new Error(`${id}: 말하는 영상에 소리 줄기가 없어요.`);
      const quiet = silent ? [] : quietSpans(target, info.duration);
      const head = quiet[0]?.start <= 0.05 ? quiet[0].end : 0;
      const last = quiet.at(-1), speechEnd = last && last.end >= info.duration - 0.06 ? last.start : info.duration;
      const times = [0.04, 0.25, 0.5, 0.75].map((part) => Math.max(0.04, info.duration * part)).concat(Math.max(0.04, info.duration - 0.12));
      const measures = times.map((seconds) => stillness(reference, grayFrame(target, seconds, ''), place.live));
      const still = { outside: Number(Math.max(...measures.map((item) => item.outside)).toFixed(2)), shift: Number(Math.max(...measures.map((item) => item.shift)).toFixed(1)) };
      const bytes = readFileSync(target), prior = clips.get(id);
      clips.set(id, {
        id, src: `clips/${id}.mp4`, file: `clips/${id}.mp4`, status: 'ready', kind: entry.kind, audio: silent ? 'silent' : 'native',
        reviewed: false, dialogue: entry.action ? '' : entry.text, place: entry.place, loop: silent,
        durationSeconds: Number(info.duration.toFixed(2)), width: info.width, height: info.height, fps: info.fps, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
        ...(silent ? {} : { speechEndSeconds: Number(speechEnd.toFixed(2)), answerStartSeconds: Number(Math.min(Math.max(0.5, info.duration - 0.15), speechEnd + 0.35).toFixed(2)) }),
        transition: { headHoldMs: silent ? 250 : Math.round(head * 1000), tailHoldMs: silent ? 250 : Math.round((info.duration - speechEnd) * 1000), validated: false },
        still, brightnessTakenOut: eq ? Number(offset.toFixed(1)) : 0, ...(prior?.heard ? { heard: prior.heard } : {}),
      });
      console.log(`${id}: ${info.duration.toFixed(1)}초 · 말 끝 ${silent ? '-' : speechEnd.toFixed(2)} · 배경 차이 ${still.outside} · 이동 ${still.shift}px · ${clipHoldsStill(still) ? 'Quest 무대에 그림' : 'Quest에서는 사진과 소리만'}`);
    }
  }
  if (args.includes('--reviewed')) {
    const wanted = option('--reviewed'), ids = wanted === 'all' ? [...clips.keys()] : String(wanted || '').split(',');
    for (const id of ids) {
      const clip = clips.get(id);
      if (!clip) throw new Error(`목록에 없는 영상이에요: ${id}`);
      // The player needs a quiet moment at both ends to join clip and photograph without a jump.
      if (clip.kind === 'speaking' && (clip.transition.headHoldMs < 100 || clip.transition.tailHoldMs < 100)) throw new Error(`${id}: 시작이나 끝의 조용한 구간이 0.1초보다 짧아요(${clip.transition.headHoldMs}ms, ${clip.transition.tailHoldMs}ms).`);
      clip.reviewed = true; clip.transition.validated = true;
    }
  }
  const ordered = [...plan.keys()].map((id) => clips.get(id)).filter(Boolean);
  if (args.includes('--report')) { console.table(ordered.map((clip) => ({ id: clip.id, 초: clip.durationSeconds, 검수: clip.reviewed, 말끝: clip.speechEndSeconds ?? '', 배경차이: clip.still?.outside, 이동: clip.still?.shift, Quest: clipHoldsStill(clip.still) }))); return; }
  const anyReviewed = ordered.some((clip) => clip.reviewed);
  const output = {
    schemaVersion: 1, id: `workday-${jobId}`, status: anyReviewed ? 'ready' : 'making', title: job.title, projection: 'rectilinear-mono', stereo: false,
    source: { status: anyReviewed ? 'verified' : 'making', provider: 'Google Flow', model: option('--model') || manifest.source?.model || '', generationDate: manifest.source?.generationDate || new Date().toISOString().slice(0, 10),
      reviewScope: '영상마다 길이와 소리 줄기, 대사 받아쓰기 대조, 시작과 끝 프레임, 배경 고정(still)을 봤다. 헤드셋과 실제 휴대폰 확인은 아직이다.' },
    notice: '인물과 장소는 AI로 만든 그림과 영상입니다. 실제 사람이나 시설이 아닙니다.',
    clips: ordered,
  };
  writeFileSync(manifestFile, JSON.stringify(output, null, 2) + '\n');
  console.log(`manifest.json: 영상 ${ordered.length}개(검수 ${ordered.filter((clip) => clip.reviewed).length}개), 장면표의 클립 ${plan.size}개`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
