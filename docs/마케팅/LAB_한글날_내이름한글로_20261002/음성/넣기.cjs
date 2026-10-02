// 생성된 서현 대사(음성/audio/<id>.wav·json)를 index.html에 넣고 음악이 비켜 주게 한다.
// 1) 대사: voice-plan의 cue = 첫 말소리가 들려야 하는 영상 시각. 파일 앞 무음을 재서 data-start = cue − 앞 무음.
//    낱말 앞 숨소리는 말 시작으로 치지 않는다(Typecast 낱말 시각 0.1초 앞부터 소리를 찾는다).
//    voiceover 묶음(data-audio-group)으로 두고, 앞뒤 파일이 겹칠 수 있어 트랙 14·15를 번갈아 쓴다.
// 2) 음악: --carve를 주면 하이퍼프레임즈 carve(세기 0.6)로 목소리 대역만 말을 따라 비켜 주게 한다.
// 3) 음악 크기: carve의 전체 크기 맞춤은 천천히 돌아오게 되어 있어(이 편에서는 22초 내내 약 −13dB),
//    그 단계를 빼고 말할 때만 DUCK_DB 낮췄다가 말 사이에 돌아오는 단계(id duck)를 직접 쓴다.
// 다시 실행해도 같은 결과다. 실행(폴더 안에서):
//   node 음성/넣기.cjs --carve <hyperframes-audio>/scripts/carve.mjs --core <@hyperframes/core 설치 폴더>
//   (--carve 없이 돌리면 대사와 duck 단계만 다시 쓴다. 대사 시각을 바꿨으면 carve도 다시 돌린다)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const dir = path.join(__dirname, '..');
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'voice-plan.json'), 'utf8'));
const htmlPath = path.join(dir, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const total = Number((html.match(/data-composition-id="main"[^>]*data-duration="([0-9.]+)"/) || [])[1]);
if (!total) throw new Error('컴포지션 길이를 못 읽음');

const GAP = 0.15;        // 앞 대사 말끝에서 다음 말 시작까지 최소 간격(초)
const THR = -40;         // 말소리로 보는 크기(dBFS, 10ms 창)
const STRENGTH = Number(arg('--strength') || 0.6);
const DUCK_DB = -8;      // 말할 때 음악 전체 크기(목소리 대역은 carve가 더 비킨다)
const ATTACK = 0.15, RELEASE_HOLD = 0.15, RELEASE = 0.45, MERGE = 1.0;   // 말 사이가 MERGE초보다 짧으면 낮춘 채 둔다

// 16비트 PCM wav → 10ms 창마다 dBFS. out[k]는 k×10ms부터 10ms
function levels(file) {
  const b = fs.readFileSync(file);
  let p = 12, fmt, data;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { ch: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') { data = { at: p + 8, size: Math.min(size, b.length - p - 8) }; break; }
    p += 8 + size + (size % 2);
  }
  if (!fmt || !data || fmt.bits !== 16) throw new Error(file + ': 16비트 PCM wav가 아님');
  const frame = 2 * fmt.ch, n = Math.floor(data.size / frame), win = Math.round(fmt.rate / 100), out = [];
  for (let i = 0; i + win <= n; i += win) {
    let sum = 0;
    for (let j = i; j < i + win; j++) { const v = b.readInt16LE(data.at + j * frame) / 32768; sum += v * v; }
    out.push(10 * Math.log10(sum / win + 1e-12));
  }
  return out;
}

// ── 1) 대사
const segs = plan.segments.map((s) => {
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'audio', s.id + '.json'), 'utf8'));
  const dur = Number(meta.audio_duration);
  if (!(dur > 0)) throw new Error(s.id + ' 길이 없음');
  if (typeof s.cue !== 'number') throw new Error(s.id + ' cue 없음');
  const lv = levels(path.join(__dirname, 'audio', s.id + '.wav'));
  const from = Math.max(0, Math.floor(((meta.words?.[0]?.start ?? 0) - 0.1) * 100));
  const k0 = lv.findIndex((v, k) => k >= from && v > THR);
  let k1 = lv.length - 1;
  while (k1 > 0 && lv[k1] <= THR) k1--;
  if (k0 < 0) throw new Error(s.id + ': 말소리를 못 찾음');
  const onset = k0 / 100, start = s.cue - onset;
  if (start < 0) throw new Error(`${s.id}: cue ${s.cue}가 파일 앞 무음 ${onset}초보다 이르다`);
  return { ...s, dur, onset, start, end: start + dur, speechEnd: start + (k1 + 1) / 100, words: (meta.words || []).map((w) => w.text).join(' ') };
});

const warn = [];
segs.forEach((s, i) => {
  s.track = 14 + (i % 2);
  const n = segs[i + 1], m = segs[i + 2];
  if (n && n.cue - s.speechEnd < GAP) warn.push(`${s.id} 말끝 ${s.speechEnd.toFixed(2)}과 ${n.id} 말 시작 ${n.cue}가 ${GAP}초보다 가까움`);
  if (m && s.end > m.start) warn.push(`${s.id}와 ${m.id}가 같은 트랙 ${s.track}에서 겹침`);
  if (s.speechEnd > total - 0.1) warn.push(`${s.id}가 영상 끝(${total})을 넘음: ${s.speechEnd.toFixed(2)}`);
});

const fmt = (x) => Number(x.toFixed(3));
const block = ['      <!-- 목소리 시작 · Typecast 서현(음성/넣기.cjs가 만든다. 음악 비키기는 같은 스크립트가 #music에 쓴다) -->']
  .concat(segs.map((s) => `      <audio id="vo-${s.id}" src="음성/audio/${s.id}.wav" data-start="${fmt(s.start)}" data-duration="${fmt(s.dur)}" data-track-index="${s.track}" data-volume="1" data-audio-group="voiceover"></audio>`))
  .concat(['      <!-- 목소리 끝 -->'])
  .join('\n');
if (/<!-- 목소리 시작[\s\S]*?<!-- 목소리 끝 -->/.test(html)) html = html.replace(/      <!-- 목소리 시작[\s\S]*?<!-- 목소리 끝 -->/, block);
else html = html.replace(/( *<!-- 소리 -->\r?\n)/, '$1' + block + '\n');
if (!html.includes('vo-' + segs[0].id)) throw new Error('목소리 블록을 넣을 자리(<!-- 소리 -->)를 못 찾음');
fs.writeFileSync(htmlPath, html);

// ── 2) carve(목소리 대역만 말을 따라 비키기)
let carveLog = null;
if (arg('--carve')) {
  const cmd = [arg('--carve'), '--comp', htmlPath, '--bed', 'music', ...segs.flatMap((s) => ['--voice', 'vo-' + s.id]), '--strength', String(STRENGTH)];
  if (arg('--core')) cmd.push('--core', arg('--core'));
  carveLog = execFileSync(process.execPath, cmd, { encoding: 'utf8' }).trim().split('\n').filter((l) => /^(carve|bands|level|wrote)/.test(l));
  html = fs.readFileSync(htmlPath, 'utf8');
}

// ── 3) 음악 크기: carve의 느린 크기 맞춤 단계를 빼고, 말할 때만 낮추는 duck 단계를 쓴다
const un = (v) => v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const esc = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const musicTag = (html.match(/<audio id="music"[^>]*>/) || [])[0];
if (!musicTag) throw new Error('#music을 못 찾음');
const attr = (name) => { const m = musicTag.match(new RegExp('\\s' + name + '="([^"]*)"')); return m ? JSON.parse(un(m[1])) : null; };
const chain = attr('data-fx-chain') || { version: 1, nodes: [] };
const auto = attr('data-automation') || { version: 1, lanes: [] };
const dropped = chain.nodes.filter((n) => (n.fromCarve && n.type === 'gain') || n.id === 'duck').map((n) => n.id);
chain.nodes = chain.nodes.filter((n) => !dropped.includes(n.id)).concat([{ type: 'gain', id: 'duck', label: '목소리 자리 비키기', enabled: true, params: { gain: 0 } }]);

const wins = [];
segs.forEach((s) => {
  const a = s.start + s.onset, b = s.speechEnd, last = wins[wins.length - 1];
  if (last && a - last[1] < MERGE) last[1] = Math.max(last[1], b); else wins.push([a, b]);
});
const pts = [{ t: 0, v: 0 }];
wins.forEach(([a, b]) => {
  pts.push({ t: fmt(Math.max(0, a - ATTACK)), v: 0 }, { t: fmt(Math.max(0.01, a - 0.02)), v: DUCK_DB },
    { t: fmt(b + RELEASE_HOLD), v: DUCK_DB }, { t: fmt(Math.min(total, b + RELEASE_HOLD + RELEASE)), v: 0 });
});
const points = pts.filter((p, i) => i === 0 || p.t > pts[i - 1].t);
auto.lanes = auto.lanes.filter((l) => !dropped.some((id) => String(l.target).startsWith(`fx.${id}.`))).concat([{ target: 'fx.duck.gain', points }]);

let tag = musicTag;
for (const name of ['data-fx-chain', 'data-automation']) tag = tag.replace(new RegExp('\\s' + name + '="[^"]*"'), '');
tag = tag.replace(/>$/, ` data-fx-chain="${esc(JSON.stringify(chain))}" data-automation="${esc(JSON.stringify(auto))}">`);
html = html.replace(musicTag, tag);
fs.writeFileSync(htmlPath, html);

console.log(JSON.stringify({
  segments: segs.map((s) => ({ id: s.id, cue: s.cue, start: fmt(s.start), speech: [fmt(s.start + s.onset), fmt(s.speechEnd)], fileEnd: fmt(s.end), track: s.track, words: s.words })),
  warn,
  carve: carveLog || '건너뜀(--carve 없음)',
  music: { removedCarveLevel: dropped.filter((id) => id !== 'duck'), duckDb: DUCK_DB, duckWindows: wins.map(([a, b]) => [fmt(a), fmt(b)]), nodes: chain.nodes.map((n) => n.id), lanes: auto.lanes.map((l) => l.target) },
}, null, 2));
