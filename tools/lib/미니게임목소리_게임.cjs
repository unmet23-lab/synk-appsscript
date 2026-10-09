'use strict';
// 미니게임 일곱 개의 목소리 작업표와 후처리(2026-10-07 유호님 「미니게임 … 전부 타입캐스트로 바꿔줘」).
// tools/미니게임_목소리.cjs가 쓴다. 게임마다 세 가지를 맡는다.
//   jobs()      지금 게임이 쓰는 음성 파일과 같은 이름·같은 글로 작업 목록을 만든다. 글은 바꾸지 않는다.
//   process()   Typecast 원본 wav → 그 게임의 지금 파이프라인과 같은 형식·표본율·크기·앞뒤 여백(무대 폴더에 만든다).
//   finalize()  게임이 읽는 목록(길이·크기·해시)을 지금 스크립트와 같은 방식으로 고친다.
//               게임이 읽거나 공개되는 파일에는 제작 도구·목소리 이름·목소리 id를 넣지 않는다(설정은 *.source.json·qa/에만).
//
// 「같은 크기·같은 여백」을 맞추는 방법(2026-10-07 지금 파일을 재서 정함 — 숫자는 아래 EDGE·LOUD):
//   - 지금 스크립트에 자르기·크기 맞추기가 있는 게임(입장 검사·말 랠리·이야기 교실·말의 리듬의 loudnorm)은 그 필터를 그대로 쓴다.
//   - 자르지 않던 게임(레이싱·바람길·주문 폭주·이야기 교실·말의 리듬)은 옛 엔진이 붙인 앞뒤 빈 소리가 게임 타이밍에 들어가 있다
//     (레이싱 끝 0.85초는 차선 안내 사이의 쉼, 바람길 끝 0.74초는 말이 끝난 뒤 움직일 시간). Typecast 원본의 앞뒤를 걷고
//     지금 파일의 중앙값만큼 다시 붙인다.
//   - 크기를 맞추지 않던 게임(레이싱·바람길·주문 폭주 — Windows 음성 그대로)은 지금 파일의 통합 음량 중앙값으로 고정 이득을 준다.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { execFile, execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

// 저장소 뿌리. SYNK_MINIGAME_VOICE_REPO는 흐름 시험이 임시 사본에 적용해 볼 때만 쓴다.
const REPO = process.env.SYNK_MINIGAME_VOICE_REPO ? path.resolve(process.env.SYNK_MINIGAME_VOICE_REPO) : path.resolve(__dirname, '..', '..');
const gameDir = (game, repo = REPO) => path.join(repo, 'experiences', game);
const abs = (dir, rel) => path.join(dir, ...rel.split('/'));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const round = (x, n) => Number(Number(x).toFixed(n));
const importFile = file => import(pathToFileURL(file).href);

// ── 소리 도구 ─────────────────────────────────────────────────────────────
const WINGET_BIN = path.join(os.homedir(), 'AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin');
const toolCache = {};
function tool(name) {
  if (name in toolCache) return toolCache[name];
  let found = null;
  try { execFileSync(name, ['-version'], { stdio: 'ignore' }); found = name; } catch {
    const p = path.join(WINGET_BIN, name + '.exe');
    if (fs.existsSync(p)) found = p;
  }
  return (toolCache[name] = found);
}
function run(bin, args, { text = false } = {}) {
  const exe = tool(bin);
  if (!exe) return Promise.reject(Error(`${bin}이 없다 — 설치 뒤 다시`));
  return new Promise((resolve, reject) => execFile(exe, args, { encoding: 'buffer', maxBuffer: 1 << 30, windowsHide: true }, (error, stdout, stderr) => {
    if (error) return reject(Error(`${bin} 실패: ${String(stderr || error.message).slice(-500)}`));
    resolve(text ? { stdout: stdout.toString('utf8'), stderr: stderr.toString('utf8') } : { stdout, stderr });
  }));
}
const ff = args => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args]);
async function probe(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels,bit_rate,bits_per_sample', '-of', 'json', file], { text: true });
  const info = JSON.parse(stdout), s = info.streams[0] || {};
  return { duration: Number(info.format.duration), codec: s.codec_name, sampleRate: Number(s.sample_rate), channels: s.channels, bitRate: Number(s.bit_rate) || null, bits: s.bits_per_sample || null };
}
async function pcm(file, rate = 24000, format = 'f32le') {
  const { stdout } = await run('ffmpeg', ['-v', 'error', '-nostdin', '-i', file, '-f', format, '-ac', '1', '-ar', String(rate), 'pipe:1']);
  const ab = stdout.buffer.slice(stdout.byteOffset, stdout.byteOffset + stdout.length);
  return format === 'f32le' ? new Float32Array(ab) : new Int16Array(ab, 0, Math.floor(ab.byteLength / 2));
}
async function integratedLufs(file) {
  const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostats', '-nostdin', '-i', file, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], { text: true });
  const values = [...stderr.matchAll(/^\s*I:\s*(-?\d+(?:\.\d+)?) LUFS/gm)].map(m => Number(m[1]));
  if (!values.length) throw Error('통합 음량을 못 잼: ' + path.basename(file));
  return values.at(-1);
}
// 지금 스크립트의 inspect()(이야기 교실·말 랠리)와 같은 셈: ffprobe 길이, 24kHz f32로 풀어 꼭대기·RMS.
async function inspect(file, { minDuration = 0.2 } = {}) {
  const duration = (await probe(file)).duration, x = await pcm(file, 24000, 'f32le');
  let peak = 0, sum = 0;
  for (const v of x) { const a = Math.abs(v); if (a > peak) peak = a; sum += v * v; }
  const rms = Math.sqrt(sum / x.length);
  if (!(duration > minDuration && peak > 0.01 && peak < 1.0)) throw Error(`소리가 이상함 ${path.basename(file)} (길이 ${duration}, 꼭대기 ${peak})`);
  return { durationSeconds: round(duration, 3), peakDbfs: round(20 * Math.log10(peak), 2), rmsDbfs: round(20 * Math.log10(rms), 2) };
}
// RIFF wav에서 fmt·data를 읽는다(주문 폭주 qa/verify-assets.mjs와 같은 방식).
function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw Error('wav 아님: ' + file);
  let pos = 12, fmt = null, data = null;
  while (pos + 8 <= b.length) {
    const tag = b.toString('ascii', pos, pos + 4), n = b.readUInt32LE(pos + 4);
    if (tag === 'fmt ') fmt = b.subarray(pos + 8, pos + 8 + n);
    if (tag === 'data') data = b.subarray(pos + 8, pos + 8 + n);
    pos += 8 + n + (n % 2);
  }
  if (!fmt || !data) throw Error('wav 조각 없음: ' + file);
  const channels = fmt.readUInt16LE(2), sampleRate = fmt.readUInt32LE(4), bytesPerSecond = fmt.readUInt32LE(8), bits = fmt.readUInt16LE(14);
  const samples = new Int16Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.length - (data.length % 2)));
  return { bytes: b.length, channels, sampleRate, bits, bytesPerSecond, seconds: data.length / bytesPerSecond, frames: data.length / (channels * bits / 8), samples };
}

// ── 앞뒤 빈 소리·크기 ─────────────────────────────────────────────────────
// Typecast 원본의 앞뒤를 -50dB에서 걷고(앞 0.03초·끝 0.06초는 남김) 지금 파일과 같은 길이로 다시 붙인다.
const TRIM_KEEP = { lead: 0.03, tail: 0.06 };
const TRIM_EDGES = `silenceremove=start_periods=1:start_threshold=-50dB:start_silence=${TRIM_KEEP.lead},areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=${TRIM_KEEP.tail},areverse`;
const edgesFilter = ({ lead, tail }) => `${TRIM_EDGES},adelay=delays=${Math.round((lead - TRIM_KEEP.lead) * 1000)}:all=1,apad=pad_dur=${(tail - TRIM_KEEP.tail).toFixed(3)}`;
// 지금 파일의 실측 중앙값(2026-10-07, -45dB·10ms 틀로 잼). 통합 음량은 ffmpeg ebur128.
const EDGE = {
  'korean-racing': { lead: 0.15, tail: 0.85 },   // Windows 음성 rate -1 그대로(자르지 않음)
  'korean-runner': { lead: 0.12, tail: 0.74 },   // 끝 0.74초까지 안내 길이(voice-timing.mjs)에 들어가 움직일 시간이 된다
  'order-rush': { lead: 0.13, tail: 0.83 },
  'story-classroom': { lead: 0.23, tail: 0.93 },  // 줄과 줄 사이 쉼(대사를 이어 튼다)
  'korean-rhythm': { lead: 0.23, tail: 0.97 },
};
// 고정 이득의 목표(LUFS, MP3로 만들기 전의 wav 기준). MP3로 구우면 0.4dB쯤 작아진다(바람길 wav -21.35 → MP3 -21.8 실측):
// 레이싱은 지금 MP3 중앙값 -23.5가 되게 wav를 -23.1로, 바람길은 지금 wav -21.4, 주문 폭주는 wav를 그대로 튼다 -22.5.
const LOUD = { 'korean-racing': -23.1, 'korean-runner': -21.4, 'order-rush': -22.5 };
const PEAK_LIMIT = 0.891;   // -1 dBFS

// 걷고 붙인 뒤 통합 음량을 재어 한 번의 고정 이득으로 맞춘 s16 wav를 만든다.
async function matchedWav(raw, outWav, { edges, lufs, rate }) {
  const mid = outWav + '.mid.wav';
  await ff(['-i', raw, '-map_metadata', '-1', '-af', edgesFilter(edges), '-ac', '1', '-ar', String(rate), '-c:a', 'pcm_f32le', mid]);
  const measured = await integratedLufs(mid), x = await pcm(mid, rate, 'f32le');
  let peak = 0; for (const v of x) peak = Math.max(peak, Math.abs(v));
  let gain = lufs - measured, limited = false;
  if (peak * 10 ** (gain / 20) > PEAK_LIMIT) { gain = 20 * Math.log10(PEAK_LIMIT / peak); limited = true; }
  await ff(['-i', mid, '-map_metadata', '-1', '-fflags', '+bitexact', '-af', `volume=${gain.toFixed(2)}dB`, '-ac', '1', '-ar', String(rate), '-c:a', 'pcm_s16le', outWav]);
  fs.rmSync(mid, { force: true });
  return { measuredLufs: measured, gainDb: round(gain, 2), peakLimited: limited };
}

// ── 게임별 ───────────────────────────────────────────────────────────────
const ANIMALS = ['bear', 'raccoon', 'rabbit', 'fox', 'squirrel', 'hedgehog', 'penguin', 'ducks', 'otter', 'deer', 'panda', 'sheep'];
const RACING_GROUPS = [['manifest.json', 'jobs.json'], ['challenge-manifest.json', 'challenge-jobs.json'], ['choice-manifest.json', 'choice-jobs.json'],
  ['finale-manifest.json', 'finale-jobs.json'], ['garage-manifest.json', 'garage-jobs.json'], ['tutorial-manifest.json', 'tutorial-jobs.json']];
const listFiles = (dir, re) => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => re.test(f)).sort() : [];
const job = (game, id, role, text, outputs, extra = {}) => ({ game, id, role, text, outputs, ...extra });

// 레이싱: audio-source/*-jobs.json → wav(24kHz, 고정 이득·여백) → MP3 mono 24kHz 48kbps. 목록: 길이·RMS는 wav에서(encode-narration.py),
// 처음 하기 9개는 verify-tutorial-audio.py처럼 풀어 본 값과 sha256까지.
// 레이싱 안내문 문제의 「소리로 읽을 글」(10-07): 빗금(/)을 「슬래시」로 읽고 「화~일」을 「화일」로 읽어 뜻이 사라져서, 이 다섯 줄만
// 빗금을 끊어 읽기로, 「화~일」을 「화요일부터 일요일까지」로, 「:」를 쉼으로, 「..」을 마침표 하나로 바꿔 굽는다. 화면 글자와 목록의 text는 그대로다.
const RACING_SPOKEN = {
  c09q1q: '도서관 안내. 월요일 휴관. 화요일부터 일요일까지, 9시부터 18시까지. 도서관에 갈 수 없는 날은 언제예요?',
  c10q3q: '세탁소. 평일 10시부터 19시까지. 토요일 10시부터 15시까지. 일요일 휴무. 토요일 오후 4시에 이용할 수 있어요?',
  c10q5q: '한국어 동아리. 금요일 오후 5시. 2층 교실. 참가비 없음. 맞는 내용은 무엇이에요?',
  f03q3q: '일정표. 수요일, 청소. 목요일, 장보기. 금요일, 요리. 장을 보는 날은 언제예요?',
  f06q4q: '도서관 행사. 오후 1시, 영화 보기. 오후 3시, 작가와의 만남. 작가와의 만남은 미리 신청한 사람만 참가할 수 있습니다. 지수는 신청하지 않았고 오후 2시에 도착했습니다. 지수에 대한 설명으로 맞는 것은 무엇이에요?',
  // 낱말 하나짜리 중 옛 목소리는 받아쓰기가 알아듣고 새 목소리는 크게 틀린 19개(10-07 로컬 받아쓰기 대조)는 끝에 마침표를 붙여 다시 굽는다.
  f05q4o1: '집 안.', w1751: '너머.', w0476: '오래.', w1595: '도로.', w1813: '쏟다.', w1416: '무용.', w1217: '모임.', w0397: '일하다.', w0486: '나중.',
  w0604: '지하.', w0150: '그것.', w1799: '부근.', w1810: '시내.', w0393: '밑.', w1118: '군.', w0940: '뿐.', w1708: '오직.',
};
// 「년」(w0138)·「년대」(w1001)는 낱말 하나로 읽으면 두음법칙처럼 「연」으로 읽는다(10-07 서현·진희, 10-09 소진도 — 따옴표·붙임표·띄어쓰기로도 안 됨).
// 앞에 수를 붙여 「이천 년.」처럼 구운 뒤, 받은 원본의 낱말 시각(words)으로 그 낱말부터 잘라 쓴다(앞 0.02초 여유, 0.015초 페이드 인).
// 10-09 받아쓰기로 확인: 잘라 여백을 붙인 소리를 「년」·「년대」로 받아 적는다(낱말 하나만 읽은 소리는 「냥」·「연대」).
const RACING_KEEP = { w0138: { text: '이천 년.', keep: '년.' }, w1001: { text: '이천 년대.', keep: '년대.' } };
// 낱말 하나를 외치듯 읽어 흐려진 줄(10-09 소진 받아쓰기 대조)은 끝에 마침표 — 목록은 tools/minigame-voice-racing-period.json.
const RACING_PERIOD_FILE = path.join(__dirname, '..', 'minigame-voice-racing-period.json');
const RACING_PERIOD = new Set(fs.existsSync(RACING_PERIOD_FILE) ? readJson(RACING_PERIOD_FILE).ids : []);
const racingSpoken = (id, text) => RACING_KEEP[id]?.text || RACING_SPOKEN[id] || (RACING_PERIOD.has(id) && !/[.!?…]$/.test(text) ? text + '.' : null);
async function keepWord(raw, word, stage) {
  const meta = readJson(raw.replace(/\.wav$/, '.json')), w = (meta.words || []).find(x => x.text === word);
  if (!w) throw Error(`받은 원본에 낱말 시각이 없다: ${word}`);
  const out = path.join(stage, '_keep', path.basename(raw));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await ff(['-ss', Math.max(0, w.start - 0.02).toFixed(3), '-i', raw, '-map_metadata', '-1', '-af', 'afade=t=in:st=0:d=0.015', '-c:a', 'pcm_s16le', out]);
  return out;
}
const racing = {
  id: 'korean-racing', label: '레이싱', speakers: { narrator: 'narrator' },
  post: '앞 0.15초·끝 0.85초 여백, 고정 이득(MP3 -23.5 LUFS) → MP3 mono 24kHz 48kbps (지금 Windows 음성 파일의 실측과 같게)',
  async jobs(repo = REPO) {
    const dir = gameDir(this.id, repo), out = [];
    for (const [manifest, jobsFile] of RACING_GROUPS)
      for (const j of readJson(path.join(dir, 'audio-source', jobsFile)))
        out.push(job(this.id, j.id, 'narrator', racingSpoken(j.id, j.text) || j.text, [`assets/narration/${j.id}.mp3`],
          { group: manifest, ...(racingSpoken(j.id, j.text) ? { display: j.text } : {}), ...(RACING_KEEP[j.id] ? { keep: RACING_KEEP[j.id].keep } : {}) }));
    return out;
  },
  current(repo = REPO) { return listFiles(path.join(gameDir(this.id, repo), 'assets', 'narration'), /\.mp3$/).map(f => 'assets/narration/' + f); },
  shipped(repo = REPO) {
    const dir = path.join(gameDir(this.id, repo), 'assets', 'narration');
    return RACING_GROUPS.flatMap(([m]) => readJson(path.join(dir, m)).clips.map(c => ({ id: c.id, text: racingSpoken(c.id, c.text) || c.text })));
  },
  async process(j, raw, stage) {
    const wav = path.join(stage, '_wav', j.id + '.wav'), mp3 = abs(stage, j.outputs[0]);
    fs.mkdirSync(path.dirname(wav), { recursive: true }); fs.mkdirSync(path.dirname(mp3), { recursive: true });
    const src = j.keep ? await keepWord(raw, j.keep, stage) : raw;
    const loud = await matchedWav(src, wav, { edges: EDGE[this.id], lufs: LOUD[this.id], rate: 24000 });
    await ff(['-i', wav, '-map_metadata', '-1', '-ac', '1', '-ar', '24000', '-codec:a', 'libmp3lame', '-b:a', '48k', mp3]);
    const w = readWav(wav);
    let sum = 0; for (const s of w.samples) sum += s * s;
    const metrics = { duration: round(w.frames / w.sampleRate, 3), bytes: fs.statSync(mp3).size, rms: Math.round(Math.sqrt(sum / Math.max(1, w.samples.length))), ...loud };
    const p = await probe(mp3);
    metrics.format = { codec: p.codec, sampleRate: p.sampleRate, channels: p.channels, bitRate: p.bitRate };
    if (j.group === 'tutorial-manifest.json') {
      const data = fs.readFileSync(mp3), dec = await pcm(mp3, 24000, 's16le');
      let s2 = 0; for (const s of dec) s2 += s * s;
      Object.assign(metrics, { mp3Duration: round(p.duration, 3), decodedDuration: round(dec.length / 24000, 3), decodedRms: Math.round(Math.sqrt(s2 / dec.length)),
        header: data.subarray(0, 3).toString('latin1') === 'ID3' ? 'ID3' : 'MPEG frame sync', sha256: sha256(data) });
    }
    return { files: { [j.outputs[0]]: mp3 }, metrics };
  },
  validate(j, m) {
    const bad = [];
    if (!(m.duration > 0.1 && m.rms > 50)) bad.push(`비었거나 조용함(길이 ${m.duration}, rms ${m.rms})`);
    if (m.format.codec !== 'mp3' || m.format.sampleRate !== 24000 || m.format.channels !== 1 || m.format.bitRate !== 48000) bad.push('형식이 MP3 mono 24kHz 48kbps가 아님 ' + JSON.stringify(m.format));
    if (m.decodedDuration !== undefined && Math.abs(m.decodedDuration - m.duration) >= 0.025) bad.push(`풀어 본 길이 ${m.decodedDuration} ≠ ${m.duration}`);
    return bad;
  },
  // 목록 하나를 새로 쓴다: 다시 만든 줄만 값을 바꾸고 나머지는 그대로, 머리의 목소리·엔진 이름은 뺀다.
  buildManifest(old, updates) {
    const clips = old.clips.map(c => {
      const m = updates.get(c.id);
      if (!m) return c;
      const next = { id: c.id, text: m.text ?? c.text, duration: m.duration, bytes: m.bytes, rms: m.rms };
      if ('mp3Duration' in c || m.mp3Duration !== undefined) Object.assign(next, { mp3Duration: m.mp3Duration, decodedDuration: m.decodedDuration, decodedRms: m.decodedRms, header: m.header, sha256: m.sha256 });
      return next;
    });
    const out = { voice: '해설', format: 'MP3 mono 24kHz 48kbps', clips };
    if (old.verification) out.verification = old.verification;
    return out;
  },
  finalize(results, dir) {
    const changed = [];
    for (const [manifest] of RACING_GROUPS) {
      const mine = results.filter(r => r.job.group === manifest);
      if (!mine.length) continue;
      const file = path.join(dir, 'assets', 'narration', manifest), old = readJson(file);
      const next = this.buildManifest(old, new Map(mine.map(r => [r.job.id, { ...r.metrics, text: r.job.display || r.job.text }])));
      fs.writeFileSync(file, JSON.stringify(next, null, 2));   // encode-narration.py처럼 끝 줄바꿈 없음
      changed.push('assets/narration/' + manifest);
    }
    return changed;
  },
};

// 입장 검사: art-source/voice.mjs의 voiceLines()(숫자는 읽는 글 spoken) → 그 스크립트의 encode()와 같은 필터 → voices.json의 dur.
const ENTRY_AF = 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.04,areverse,'
  + 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.06,areverse,'
  + 'loudnorm=I=-17:TP=-1.5:LRA=11,adelay=40|40,apad=pad_dur=0.12';
const entry = {
  id: 'entry-check', label: '입장 검사', speakers: Object.fromEntries([['narrator', 'narrator'], ...ANIMALS.map(a => [a, a])]),
  post: '지금 voice.mjs encode()와 같음: 앞뒤 -48dB 자르기, loudnorm I=-17 TP=-1.5 LRA=11, 앞 40ms·끝 0.12초 → MP3 mono 24kHz 48kbps',
  async jobs(repo = REPO) {
    const { voiceLines } = await importFile(path.join(gameDir(this.id, repo), 'art-source', 'voice.mjs'));
    return voiceLines().map(l => job(this.id, l.id, this.speakers[l.speaker], l.spoken, [`assets/voice/${l.id}.mp3`], { speaker: l.speaker, display: l.text }));
  },
  current(repo = REPO) { return listFiles(path.join(gameDir(this.id, repo), 'assets', 'voice'), /\.mp3$/).map(f => 'assets/voice/' + f); },
  shipped(repo = REPO) { return Object.entries(readJson(path.join(gameDir(this.id, repo), 'assets', 'voice', 'voices.json')).lines).map(([id, l]) => ({ id, text: l.spoken, speaker: l.speaker })); },
  async process(j, raw, stage) {
    const mp3 = abs(stage, j.outputs[0]); fs.mkdirSync(path.dirname(mp3), { recursive: true });
    await ff(['-i', raw, '-map_metadata', '-1', '-af', ENTRY_AF, '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '48k', mp3]);
    const p = await probe(mp3);
    return { files: { [j.outputs[0]]: mp3 }, metrics: { dur: Math.round(p.duration * 100) / 100, format: { codec: p.codec, sampleRate: p.sampleRate, channels: p.channels, bitRate: p.bitRate } } };
  },
  validate(j, m) {
    const bad = [];
    if (!(m.dur > 0.3)) bad.push('너무 짧음 ' + m.dur);
    if (m.format.codec !== 'mp3' || m.format.sampleRate !== 24000 || m.format.channels !== 1 || m.format.bitRate !== 48000) bad.push('형식 ' + JSON.stringify(m.format));
    return bad;
  },
  buildVoices(old, jobs, updates, at) {
    const lines = {};
    for (const [id, l] of Object.entries(old.lines || {})) { const { voice, ...rest } = l; lines[id] = rest; }   // 옛 목소리 이름은 뺀다
    for (const j of jobs) {
      const m = updates.get(j.id);
      if (m) lines[j.id] = { text: j.display, spoken: j.text, speaker: j.speaker, dur: m.dur };
    }
    const { model, lines: _l, at: _a, ...rest } = old;
    return { lines, at, ...rest };
  },
  finalize(results, dir, { now = new Date().toISOString(), jobs } = {}) {
    const file = path.join(dir, 'assets', 'voice', 'voices.json');
    const next = this.buildVoices(readJson(file), jobs || results.map(r => r.job), new Map(results.map(r => [r.job.id, r.metrics])), now);
    fs.writeFileSync(file, JSON.stringify(next, null, 1) + '\n');
    return ['assets/voice/voices.json'];
  },
};

// 이야기 교실: assets/voice/jobs.json(export-voice.mjs가 얼린 원고) → 여백 맞춤 + loudnorm I=-18 TP=-2.5 LRA=7 → MP3 mono 24kHz 96kbps.
const STORY_AF = 'loudnorm=I=-18:TP=-2.5:LRA=7';
const story = {
  id: 'story-classroom', label: '이야기 교실', speakers: { teacher: 'teacher', narrator: 'narrator', mongle: 'mongle', marin: 'marin', kkamong: 'kkamong' },
  post: '앞 0.23초·끝 0.93초 여백(지금 파일 실측) + 지금 generate-voice.py와 같은 loudnorm I=-18 TP=-2.5 LRA=7 → MP3 mono 24kHz 96kbps',
  async jobs(repo = REPO) {
    const frozen = readJson(path.join(gameDir(this.id, repo), 'assets', 'voice', 'jobs.json'));
    return frozen.lines.map(l => job(this.id, l.id, this.speakers[l.speaker], l.text, [`assets/voice/${l.id}.mp3`], { speaker: l.speaker, line: l }));
  },
  async stale(repo = REPO) {   // export-voice.mjs를 다시 돌려야 하는지(얼린 원고와 지금 원고가 다른지)
    const frozen = readJson(path.join(gameDir(this.id, repo), 'assets', 'voice', 'jobs.json'));
    const { VOICE_LINES, VOICE_TEXT_VERSION } = await importFile(path.join(gameDir(this.id, repo), 'voice-lines.mjs'));
    return frozen.textVersion !== VOICE_TEXT_VERSION || JSON.stringify(frozen.lines) !== JSON.stringify(VOICE_LINES);
  },
  current(repo = REPO) { return listFiles(path.join(gameDir(this.id, repo), 'assets', 'voice'), /\.mp3$/).map(f => 'assets/voice/' + f); },
  shipped(repo = REPO) { return readJson(path.join(gameDir(this.id, repo), 'assets', 'voice', 'manifest.json')).lines.map(l => ({ id: l.id, text: l.text, speaker: l.speaker })); },
  async process(j, raw, stage) {
    const mp3 = abs(stage, j.outputs[0]); fs.mkdirSync(path.dirname(mp3), { recursive: true });
    await ff(['-i', raw, '-map_metadata', '-1', '-af', edgesFilter(EDGE[this.id]) + ',' + STORY_AF, '-ar', '24000', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '96k', mp3]);
    const data = fs.readFileSync(mp3), p = await probe(mp3);
    return { files: { [j.outputs[0]]: mp3 }, metrics: { sha256: sha256(data), bytes: data.length, ...(await inspect(mp3)), format: { codec: p.codec, sampleRate: p.sampleRate, channels: p.channels, bitRate: p.bitRate } } };
  },
  validate(j, m) {
    const bad = [];
    if (m.format.codec !== 'mp3' || m.format.sampleRate !== 24000 || m.format.channels !== 1 || m.format.bitRate !== 96000) bad.push('형식 ' + JSON.stringify(m.format));
    return bad;
  },
  buildManifest(old, frozen, updates, at) {
    const prev = new Map((old.lines || []).map(l => [l.id, l]));
    const lines = frozen.lines.map(l => {
      const m = updates.get(l.id), was = prev.get(l.id) || {};
      const { voice, rate, pitch, ...kept } = was;   // 옛 목소리 이름·설정은 뺀다
      return m ? { ...l, file: `assets/voice/${l.id}.mp3`, sha256: m.sha256, bytes: m.bytes, durationSeconds: m.durationSeconds, peakDbfs: m.peakDbfs, rmsDbfs: m.rmsDbfs } : kept;
    });
    return { storyVersion: frozen.storyVersion, textVersion: frozen.textVersion, sourceHashes: frozen.sourceHashes, generatedAt: at, humanRecording: false,
      normalization: 'ffmpeg loudnorm I=-18 TP=-2.5 LRA=7; mono 24 kHz MP3 96 kbps', lines };
  },
  finalize(results, dir, { now = new Date().toISOString() } = {}) {
    const file = path.join(dir, 'assets', 'voice', 'manifest.json'), frozen = readJson(path.join(dir, 'assets', 'voice', 'jobs.json'));
    const next = this.buildManifest(readJson(file), frozen, new Map(results.map(r => [r.job.id, r.metrics])), now);
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
    return ['assets/voice/manifest.json', ...results.map(r => `assets/voice/${r.job.id}.source.json`)];
  },
  sourceFile: j => `assets/voice/${j.id}.source.json`,
};

// 말의 리듬: audio-source/jobs.json → 여백 맞춤 + loudnorm I=-16 TP=-1 LRA=7 → MP3 mono 24kHz 64kbps. 목록과 narration.mjs(url·duration)는
// build-narration.py처럼 쓴다(.5 < 길이 < 14, 끝까지 풀리는지).
const RHYTHM_AF = 'loudnorm=I=-16:TP=-1:LRA=7';
// 파이썬 json.dumps 기본 구분자(', '·': ')로 쓴다 — build-narration.py가 쓰던 narration.mjs와 같은 모양.
const pyJson = v => Array.isArray(v) ? '[' + v.map(pyJson).join(', ') + ']'
  : v && typeof v === 'object' ? '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + pyJson(x)).join(', ') + '}' : JSON.stringify(v);
const rhythm = {
  id: 'korean-rhythm', label: '말의 리듬', speakers: { narrator: 'narrator' },
  post: '앞 0.23초·끝 0.97초 여백(지금 파일 실측) + 지금 build-narration.py와 같은 loudnorm I=-16 TP=-1 LRA=7 → MP3 mono 24kHz 64kbps',
  async jobs(repo = REPO) {
    return readJson(path.join(gameDir(this.id, repo), 'audio-source', 'jobs.json')).map(j => job(this.id, j.id, 'narrator', j.text, [`assets/narration/${j.id}.mp3`]));
  },
  async stale(repo = REPO) {
    const { LISTENING, spoken } = await importFile(path.join(gameDir(this.id, repo), 'listening.mjs'));
    const want = LISTENING.flatMap((items, t) => items.flatMap((q, i) => [...q.claims.map((claim, v) => ({ id: `t${t}q${i}v${v}`, text: spoken({ ...q, ...claim }) })), { id: `t${t}q${i}r`, text: spoken(q.recall) }]));
    return JSON.stringify(want) !== JSON.stringify(readJson(path.join(gameDir(this.id, repo), 'audio-source', 'jobs.json')));
  },
  current(repo = REPO) { return listFiles(path.join(gameDir(this.id, repo), 'assets', 'narration'), /\.mp3$/).map(f => 'assets/narration/' + f); },
  shipped(repo = REPO) { return readJson(path.join(gameDir(this.id, repo), 'assets', 'narration', 'manifest.json')).clips.map(c => ({ id: c.id, text: c.text })); },
  async process(j, raw, stage) {
    const mp3 = abs(stage, j.outputs[0]); fs.mkdirSync(path.dirname(mp3), { recursive: true });
    await ff(['-i', raw, '-map_metadata', '-1', '-af', edgesFilter(EDGE[this.id]) + ',' + RHYTHM_AF, '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '64k', mp3]);
    await run('ffmpeg', ['-v', 'error', '-nostdin', '-xerror', '-i', mp3, '-f', 'null', os.platform() === 'win32' ? 'NUL' : '/dev/null']);
    const data = fs.readFileSync(mp3), p = await probe(mp3);
    return { files: { [j.outputs[0]]: mp3 }, metrics: { duration: p.duration, bytes: data.length, sha256: sha256(data), completeDecode: true, format: { codec: p.codec, sampleRate: p.sampleRate, channels: p.channels, bitRate: p.bitRate } } };
  },
  validate(j, m) {
    const bad = [];
    if (!(m.duration > 0.5 && m.duration < 14)) bad.push('길이 ' + m.duration + '초(0.5~14초여야 리듬 판에 들어간다)');
    if (m.format.codec !== 'mp3' || m.format.sampleRate !== 24000 || m.format.channels !== 1 || m.format.bitRate !== 64000) bad.push('형식 ' + JSON.stringify(m.format));
    return bad;
  },
  buildManifest(old, updates) {
    const clips = old.clips.map(c => {
      const m = updates.get(c.id);
      return m ? { id: c.id, text: m.text ?? c.text, url: `assets/narration/${c.id}.mp3`, duration: m.duration, bytes: m.bytes, sha256: m.sha256, completeDecode: true } : c;
    });
    return { format: 'MP3 mono 24kHz 64kbps', clips };
  },
  narrationModule(manifest) {
    const data = Object.fromEntries(manifest.clips.map(c => [c.id, { url: c.url, duration: c.duration }]));
    return 'export const NARRATION=' + pyJson(data) + ';\n';
  },
  finalize(results, dir) {
    const file = path.join(dir, 'assets', 'narration', 'manifest.json');
    const next = this.buildManifest(readJson(file), new Map(results.map(r => [r.job.id, { ...r.metrics, text: r.job.text }])));
    fs.writeFileSync(file, JSON.stringify(next, null, 2));
    fs.writeFileSync(path.join(dir, 'narration.mjs'), this.narrationModule(next));
    return ['assets/narration/manifest.json', 'narration.mjs'];
  },
};

// 말 랠리: 몽글의 말(content.mjs) → generate-voice.py와 같은 자르기 + loudnorm I=-18 TP=-2.5 LRA=7 → MP3 96kbps.
// 안내(narration.mjs) → generate-narration.py와 같은 자르기·쉼 줄이기 → 재어서 -20.5 LUFS 고정 이득 → MP3 96kbps.
// 게임은 소리 길이에 맞춰 공을 친다(audio.mjs buf.duration) — 몽글의 말은 2.5초 미만, 안내는 4.5초 이하(core·narration 시험).
const RALLY_TRIM = 'silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse';
const RALLY_PAUSE = 'silenceremove=stop_periods=-1:stop_duration=0.25:stop_threshold=-40dB:stop_silence=0.28';
const RALLY_NARRATION_I = -20.5;
const rally = {
  id: 'talk-rally', label: '말 랠리', speakers: { mongle: 'mongle', narrator: 'narrator' },
  post: '몽글: 지금 generate-voice.py와 같은 앞뒤 자르기 + loudnorm I=-18 TP=-2.5 LRA=7 · 안내: generate-narration.py와 같은 자르기·쉼 0.28초 + 재어서 -20.5 LUFS → MP3 mono 24kHz 96kbps',
  async jobs(repo = REPO) {
    const dir = gameDir(this.id, repo);
    const { ITEMS, PRACTICE } = await importFile(path.join(dir, 'content.mjs'));
    const { NARRATION_LINES } = await importFile(path.join(dir, 'narration.mjs'));
    return [...[PRACTICE, ...ITEMS].map(x => job(this.id, x.id, 'mongle', x.line, [`assets/voice/${x.id}.mp3`], { group: 'voice' })),
      ...NARRATION_LINES.map(x => job(this.id, x.id, 'narrator', x.text, [`assets/narration/${x.id}.mp3`], { group: 'narration' }))];
  },
  current(repo = REPO) {
    const dir = gameDir(this.id, repo);
    return [...listFiles(path.join(dir, 'assets', 'voice'), /\.mp3$/).map(f => 'assets/voice/' + f), ...listFiles(path.join(dir, 'assets', 'narration'), /\.mp3$/).map(f => 'assets/narration/' + f)];
  },
  shipped(repo = REPO) {
    const dir = gameDir(this.id, repo);
    return ['voice', 'narration'].flatMap(g => readJson(path.join(dir, 'assets', g, 'manifest.json')).lines.map(l => ({ id: l.id, text: l.text, group: g })));
  },
  async process(j, raw, stage) {
    const mp3 = abs(stage, j.outputs[0]); fs.mkdirSync(path.dirname(mp3), { recursive: true });
    const extra = {};
    if (j.group === 'voice') {
      await ff(['-i', raw, '-map_metadata', '-1', '-af', RALLY_TRIM + ',loudnorm=I=-18:TP=-2.5:LRA=7', '-ar', '24000', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '96k', mp3]);
    } else {
      const mid = mp3 + '.mid.wav';
      await ff(['-i', raw, '-map_metadata', '-1', '-af', RALLY_TRIM + ',' + RALLY_PAUSE, '-ar', '24000', '-ac', '1', mid]);
      const gain = RALLY_NARRATION_I - await integratedLufs(mid);
      await ff(['-i', mid, '-map_metadata', '-1', '-af', `volume=${gain.toFixed(2)}dB`, '-ar', '24000', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '96k', mp3]);
      fs.rmSync(mid, { force: true });
      extra.integratedLufs = await integratedLufs(mp3);
    }
    const data = fs.readFileSync(mp3), p = await probe(mp3);
    const metrics = { sha256: sha256(data), bytes: data.length, ...(await inspect(mp3, { minDuration: j.group === 'voice' ? 0.2 : 0.3 })), ...extra,
      format: { codec: p.codec, sampleRate: p.sampleRate, channels: p.channels, bitRate: p.bitRate } };
    return { files: { [j.outputs[0]]: mp3 }, metrics };
  },
  validate(j, m) {
    const bad = [];
    if (j.group === 'voice' && !(m.durationSeconds < 2.5)) bad.push(`몽글의 말 ${m.durationSeconds}초(2.5초 미만이어야 — core.test)`);
    if (j.group === 'narration') {
      if (!(m.durationSeconds <= 4.5)) bad.push(`안내 ${m.durationSeconds}초(4.5초 이하 — narration.test)`);
      if (!(m.integratedLufs <= -19.9 && m.integratedLufs >= -22.4)) bad.push(`안내 크기 ${m.integratedLufs} LUFS(-22.4~-19.9)`);
      if (!(m.peakDbfs <= -3)) bad.push(`안내 꼭대기 ${m.peakDbfs} dBFS(-3 이하)`);
    }
    if (m.format.codec !== 'mp3' || m.format.sampleRate !== 24000 || m.format.channels !== 1 || m.format.bitRate !== 96000) bad.push('형식 ' + JSON.stringify(m.format));
    return bad;
  },
  buildManifest(old, group, updates, at) {
    const lines = old.lines.map(l => {
      const m = updates.get(l.id);
      if (!m) return l;
      const next = { id: l.id, text: m.text ?? l.text, file: `assets/${group}/${l.id}.mp3`, sha256: m.sha256, bytes: m.bytes, durationSeconds: m.durationSeconds, peakDbfs: m.peakDbfs, rmsDbfs: m.rmsDbfs };
      if (group === 'narration') next.integratedLufs = m.integratedLufs;
      return next;
    });
    const normalization = group === 'voice' ? '앞뒤 빈 소리 자름, loudnorm I=-18 TP=-2.5 LRA=7; mono 24 kHz MP3 96 kbps'
      : `앞뒤 빈 소리 자름, 문장 사이 쉼 0.28초로 줄임, 통합 음량을 재어 ${RALLY_NARRATION_I} LUFS로 고정 이득(몽글의 말 -18.4보다 조금 낮게); mono 24 kHz MP3 96 kbps`;
    return { generatedAt: at, humanRecording: false, normalization, lines };
  },
  finalize(results, dir, { now = new Date().toISOString() } = {}) {
    const changed = [];
    for (const group of ['voice', 'narration']) {
      const mine = results.filter(r => r.job.group === group);
      if (!mine.length) continue;
      const file = path.join(dir, 'assets', group, 'manifest.json');
      fs.writeFileSync(file, JSON.stringify(this.buildManifest(readJson(file), group, new Map(mine.map(r => [r.job.id, { ...r.metrics, text: r.job.text }])), now), null, 2) + '\n');
      changed.push(`assets/${group}/manifest.json`, ...mine.map(r => `assets/${group}/${r.job.id}.source.json`));
    }
    return changed;
  },
  sourceFile: j => `assets/${j.group}/${j.id}.source.json`,
};

// 바람길: assets/voice/jobs.json → wav(22050Hz s16, 고정 이득·여백 — 지금 원본 wav와 같은 형식) → 그 wav에서 MP3 64kbps(표본율 그대로).
// 목록·voice-timing.mjs는 build-voice-manifest.py처럼(부탁 0.5~5.3초, 듣기 확인 0.5~8초).
const runner = {
  id: 'korean-runner', label: '바람길', speakers: { wind: 'wind' },
  post: '앞 0.12초·끝 0.74초 여백, -21.4 LUFS 고정 이득 → wav 22050Hz 16bit mono → 그 wav에서 MP3 64kbps (지금 Windows 음성 파일의 실측과 같게)',
  async jobs(repo = REPO) {
    return readJson(path.join(gameDir(this.id, repo), 'assets', 'voice', 'jobs.json')).map(j => job(this.id, j.id, 'wind', j.text, [`assets/voice/${j.id}.wav`, `assets/voice/${j.id}.mp3`]));
  },
  current(repo = REPO) { return listFiles(path.join(gameDir(this.id, repo), 'assets', 'voice'), /\.(mp3|wav)$/).map(f => 'assets/voice/' + f); },
  shipped(repo = REPO) { return readJson(path.join(gameDir(this.id, repo), 'assets', 'voice', 'manifest.json')).clips.map(c => ({ id: c.id, text: c.text })); },
  async process(j, raw, stage) {
    const wav = abs(stage, j.outputs[0]), mp3 = abs(stage, j.outputs[1]);
    fs.mkdirSync(path.dirname(wav), { recursive: true });
    const loud = await matchedWav(raw, wav, { edges: EDGE[this.id], lufs: LOUD[this.id], rate: 22050 });
    await ff(['-i', wav, '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', '64k', mp3]);
    const data = fs.readFileSync(mp3), p = await probe(mp3), w = readWav(wav);
    return { files: { [j.outputs[0]]: wav, [j.outputs[1]]: mp3 },
      metrics: { seconds: p.duration, bytes: data.length, sha256: sha256(data), codec: p.codec, sampleRate: p.sampleRate, channels: p.channels, bitRate: p.bitRate,
        wav: { sampleRate: w.sampleRate, channels: w.channels, bits: w.bits }, ...loud } };
  },
  validate(j, m) {
    const bad = [], check = j.id.startsWith('check-');
    if (check ? !(m.seconds > 0.5 && m.seconds < 8) : !(m.seconds > 0.5 && m.seconds < 5.3)) bad.push(`${m.seconds.toFixed(2)}초 — ${check ? '듣기 확인은 0.5~8초' : '부탁은 0.5~5.3초(첫 동작 전에 끝나야 함, build-voice-manifest.py)'}`);
    if (m.codec !== 'mp3' || m.sampleRate !== 22050 || m.channels !== 1 || m.bitRate !== 64000) bad.push('MP3 형식 ' + JSON.stringify({ codec: m.codec, sampleRate: m.sampleRate, channels: m.channels, bitRate: m.bitRate }));
    if (m.wav.sampleRate !== 22050 || m.wav.channels !== 1 || m.wav.bits !== 16) bad.push('wav 형식 ' + JSON.stringify(m.wav));
    return bad;
  },
  buildManifest(old, updates) {
    const clips = old.clips.map(c => {
      const m = updates.get(c.id);
      return m ? { id: c.id, text: m.text ?? c.text, seconds: m.seconds, bytes: m.bytes, sha256: m.sha256, codec: m.codec, sampleRate: m.sampleRate, channels: m.channels } : c;
    });
    return { voice: '바람', clips, totalBytes: clips.reduce((n, c) => n + c.bytes, 0) };
  },
  timingModule(manifest) {
    return '// Generated from the local MP3 durations; allow full speech before the first action.\n'
      + 'export const VOICE_SECONDS=' + JSON.stringify(Object.fromEntries(manifest.clips.filter(c => !c.id.startsWith('check-')).map(c => [c.id, round(c.seconds, 4)])), null, 2) + ';\n';
  },
  finalize(results, dir) {
    const file = path.join(dir, 'assets', 'voice', 'manifest.json');
    const next = this.buildManifest(readJson(file), new Map(results.map(r => [r.job.id, { ...r.metrics, text: r.job.text }])));
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
    fs.writeFileSync(path.join(dir, 'voice-timing.mjs'), this.timingModule(next));
    return ['assets/voice/manifest.json', 'voice-timing.mjs'];
  },
};

// 주문 폭주: core.mjs의 주문 글(ORDERS·REVIEW)과 cafe.mjs의 손님 동물 → wav(22050Hz 16bit mono, 게임이 바로 튼다).
// 게임이 읽는 목록은 없다. qa/audio-assets.json은 qa/verify-assets.mjs(서버를 띄워 잼)가 쓴다.
const orderRush = {
  id: 'order-rush', label: '주문 폭주', speakers: Object.fromEntries(ANIMALS.map(a => [a, a])),
  post: '앞 0.13초·끝 0.83초 여백, -22.5 LUFS 고정 이득 → wav 22050Hz 16bit mono (지금 Windows 음성 파일의 실측과 같게)',
  async jobs(repo = REPO) {
    const dir = gameDir(this.id, repo);
    const { ORDERS, REVIEW } = await importFile(path.join(dir, 'core.mjs'));
    const { customerOf } = await importFile(path.join(dir, 'cafe.mjs'));
    return [...ORDERS, ...REVIEW].map(o => job(this.id, o.id, customerOf(o.id), o.text, [`audio/${o.id}.wav`], { speaker: customerOf(o.id) }));
  },
  current(repo = REPO) { return listFiles(path.join(gameDir(this.id, repo), 'audio'), /\.wav$/).map(f => 'audio/' + f); },
  shipped(repo = REPO) { return readJson(path.join(gameDir(this.id, repo), 'qa', 'voice-bank.json')).map(o => ({ id: o.id, text: o.text })); },
  async process(j, raw, stage) {
    const wav = abs(stage, j.outputs[0]); fs.mkdirSync(path.dirname(wav), { recursive: true });
    const loud = await matchedWav(raw, wav, { edges: EDGE[this.id], lufs: LOUD[this.id], rate: 22050 });
    const w = readWav(wav);
    let peak = 0; for (const s of w.samples) peak = Math.max(peak, Math.abs(s));
    return { files: { [j.outputs[0]]: wav }, metrics: { bytes: w.bytes, sampleRate: w.sampleRate, channels: w.channels, bits: w.bits, seconds: round(w.seconds, 3), peak, ...loud } };
  },
  validate(j, m) {
    const bad = [];
    if (!(m.seconds > 1 && m.seconds < 15)) bad.push(`${m.seconds}초(1~15초 — qa/verify-assets.mjs)`);
    if (!(m.peak > 500)) bad.push('너무 조용함 ' + m.peak);
    if (m.sampleRate !== 22050 || m.channels !== 1 || m.bits !== 16) bad.push('wav 형식 ' + JSON.stringify({ sampleRate: m.sampleRate, channels: m.channels, bits: m.bits }));
    return bad;
  },
  // 확인 목록(qa/voice-bank.json, 게임은 읽지 않음)의 글을 지금 주문 글로 — 글을 고친 뒤 다시 구우면 따라온다.
  finalize(results, dir) {
    const file = path.join(dir, 'qa', 'voice-bank.json');
    if (!results.length || !fs.existsSync(file)) return [];
    const now = new Map(results.map(r => [r.job.id, r.job.text]));
    fs.writeFileSync(file, JSON.stringify(readJson(file).map(o => (now.has(o.id) ? { ...o, text: now.get(o.id) } : o)), null, 2));
    return ['qa/voice-bank.json'];
  },
};

const GAMES = Object.fromEntries([racing, entry, story, rhythm, rally, runner, orderRush].map(g => [g.id, g]));

// 게임이 읽거나 공개되는 파일에 들어가면 안 되는 이름(제작 도구·모델·목소리 id). 시험과 적용 뒤 검사에 쓴다.
const TOOL_NAMES = /typecast|\btc_[0-9a-f]{6,}|ssfm|edge[-_ ]?tts|neural|heami|microsoft|system\.speech|gemini|vertex|sunhi|injoon|hyunsu/i;

// 무대에서 만든 결과를 게임 폴더로 옮기고 목록·기록을 고친다. 한 게임의 모든 줄이 검사를 통과했을 때만 부른다.
function install(adapter, results, { repo = REPO, now = new Date().toISOString(), jobs, record } = {}) {
  const dir = gameDir(adapter.id, repo);
  for (const r of results) for (const [rel, file] of Object.entries(r.files)) {
    const target = abs(dir, rel);
    if (!target.startsWith(dir + path.sep)) throw Error('게임 폴더 밖: ' + rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(file, target);
  }
  if (adapter.sourceFile) for (const r of results) fs.writeFileSync(abs(dir, adapter.sourceFile(r.job)), JSON.stringify(r.source, null, 2) + '\n');
  const changed = adapter.finalize(results, dir, { now, jobs });
  if (record) { fs.mkdirSync(path.join(dir, 'qa'), { recursive: true }); fs.writeFileSync(path.join(dir, 'qa', 'voice.source.json'), JSON.stringify(record, null, 1) + '\n'); }
  for (const rel of changed.filter(f => !/\.source\.json$/.test(f))) {
    const text = fs.readFileSync(abs(dir, rel), 'utf8');
    if (TOOL_NAMES.test(text)) throw Error(`게임이 읽는 파일에 제작 도구 이름이 남았다: ${adapter.id}/${rel}`);
  }
  return changed;
}

module.exports = { GAMES, ANIMALS, EDGE, LOUD, TOOL_NAMES, REPO, gameDir, tool, probe, pcm, integratedLufs, readWav, inspect, edgesFilter, install, sha256, readJson };
