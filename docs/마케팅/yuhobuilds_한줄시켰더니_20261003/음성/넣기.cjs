// 유호님 학습 목소리 대사(음성/audio/<id>.wav·json)를 index.html에 넣고, 영상의 모든 시각을 실제 말에 맞춘다.
// LAB 한글날 편 음성/넣기.cjs를 이 편에 맞게 넓혔다.
// 1) 대사: 첫 대사는 0.3초에 말소리가 들리고, 다음 대사는 앞 대사의 말끝에서 gapBefore초 뒤에 시작한다.
//    파일 앞 무음을 재서 data-start = 말 시작 − 앞 무음. voiceover 묶음, 트랙 14·15를 번갈아 쓴다.
// 2) 음성/timing.js(window.VO): 대사마다 말 시작·끝, 띄어쓰기 낱말마다 시작 시각, 자막 묶음. 컴포지션 스크립트가 읽는다.
// 3) data-anchor="<대사>[.t<낱말>][±초]"가 달린 요소(효과음·영상)의 data-start를, data-anchor-end가 있으면 data-duration도 고친다.
// 4) 영상 길이 = 마지막 말끝 + TAIL. #root와 data-full="1" 요소의 data-duration을 고친다.
// 5) 음악: --carve를 주면 하이퍼프레임즈 carve(세기 0.6)로 목소리 대역만 비키고, 말할 때만 낮추는 duck 단계를 직접 쓴다.
// 녹음이 아직 없으면 --estimate로 글자 수로 어림한 시각을 쓴다(장면 배치 확인용, 소리 블록은 비운다).
// 실행(폴더 안에서): node 음성/넣기.cjs [--estimate] [--carve <carve.mjs> --core <@hyperframes/core 폴더>]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const has = (name) => process.argv.includes(name);
const dir = path.join(__dirname, '..');
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'voice-plan.json'), 'utf8'));
const htmlPath = path.join(dir, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const FIRST = 0.3;       // 첫 말소리 시각
const TAIL = 1.6;        // 마지막 말끝 뒤 여유(끝 장면이 읽히는 시간)
const THR = -40;         // 말소리로 보는 크기(dBFS, 10ms 창)
const STRENGTH = Number(arg('--strength') || 0.6);
const DUCK_DB = -8;
const ATTACK = 0.15, RELEASE_HOLD = 0.15, RELEASE = 0.45, MERGE = 1.0;
const estimate = has('--estimate');
const fmt = (x) => Number(x.toFixed(3));

function levels(file) {
  const b = fs.readFileSync(file);
  let p = 12, fmtc, data;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmtc = { ch: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') { data = { at: p + 8, size: Math.min(size, b.length - p - 8) }; break; }
    p += 8 + size + (size % 2);
  }
  if (!fmtc || !data || fmtc.bits !== 16) throw new Error(file + ': 16비트 PCM wav가 아님');
  const frame = 2 * fmtc.ch, n = Math.floor(data.size / frame), win = Math.round(fmtc.rate / 100), out = [];
  for (let i = 0; i + win <= n; i += win) {
    let sum = 0;
    for (let j = i; j < i + win; j++) { const v = b.readInt16LE(data.at + j * frame) / 32768; sum += v * v; }
    out.push(10 * Math.log10(sum / win + 1e-12));
  }
  return out;
}

// 띄어쓰기 낱말 → 파일 안 시작 시각. Typecast words가 같은 낱말이면 그대로, 아니면 글자 위치로 맞춘다
const norm = (s) => s.replace(/[^\p{L}\p{N}]/gu, '');
function tokenTimes(text, meta) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const words = meta.words || [];
  if (words.length === tokens.length && words.every((w, i) => norm(w.text) === norm(tokens[i]))) return tokens.map((_, i) => words[i].start);
  const flat = []; words.forEach((w) => { for (const ch of norm(w.text)) flat.push(w.start); });
  let k = 0;
  return tokens.map((tk) => { const at = flat[Math.min(k, flat.length - 1)] ?? 0; k += norm(tk).length; return at; });
}

// ── 1) 대사 길이와 말 시작·끝(파일 기준)
const segs = plan.segments.map((s) => {
  const tokens = s.text.split(/\s+/).filter(Boolean);
  if (estimate) {
    const dur = (norm(s.text).length * 0.15 + 0.25) / (s.tempo || 1);
    const per = (dur - 0.25) / tokens.length;
    return { ...s, dur, onset: 0.1, tail: dur - 0.1, tok: tokens.map((_, i) => 0.1 + i * per) };
  }
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'audio', s.id + '.json'), 'utf8'));
  const dur = Number(meta.audio_duration);
  if (!(dur > 0)) throw new Error(s.id + ' 길이 없음');
  const lv = levels(path.join(__dirname, 'audio', s.id + '.wav'));
  const from = Math.max(0, Math.floor(((meta.words?.[0]?.start ?? 0) - 0.1) * 100));
  const k0 = lv.findIndex((v, k) => k >= from && v > THR);
  let k1 = lv.length - 1;
  while (k1 > 0 && lv[k1] <= THR) k1--;
  if (k0 < 0) throw new Error(s.id + ': 말소리를 못 찾음');
  return { ...s, dur, onset: k0 / 100, tail: (k1 + 1) / 100, tok: tokenTimes(s.text, meta) };
});

// ── 2) 이어 붙이기
let cursor = FIRST;
segs.forEach((s, i) => {
  const speech = i === 0 ? FIRST : cursor + (s.gapBefore ?? 0.35);
  s.start = speech - s.onset;                 // 파일 시작(영상 시각)
  s.trim = 0;
  if (s.start < 0) { s.trim = -s.start; s.start = 0; }   // 앞 무음이 첫 시각보다 길면 파일 앞을 잘라(data-media-start) 말이 제때 들리게 한다
  s.speech = [speech, s.start - s.trim + s.tail];
  s.tokens = s.tok.map((t) => fmt(s.start - s.trim + Math.max(t, s.onset)));
  s.track = 14 + (i % 2);
  cursor = s.speech[1];
});
const total = fmt(cursor + TAIL);

// ── 3) timing.js
const VO = { total, estimated: estimate, segs: {} };
segs.forEach((s) => { VO.segs[s.id] = { start: fmt(s.speech[0]), end: fmt(s.speech[1]), tokens: s.tokens, cap: s.cap }; });
fs.writeFileSync(path.join(__dirname, 'timing.js'),
  '// 음성/넣기.cjs가 만든다. 손으로 고치지 않는다.' + (estimate ? ' (어림값: 녹음 전)' : '') + '\nwindow.VO = ' + JSON.stringify(VO, null, 1) + ';\n');

// ── 4) 목소리 블록
const block = ['      <!-- 목소리 시작 · Typecast 유호님 학습 목소리(음성/넣기.cjs가 만든다) -->']
  .concat(estimate ? ['      <!-- (녹음 전: 어림 시각만 씀) -->'] : segs.map((s) => `      <audio id="vo-${s.id}" src="음성/audio/${s.id}.wav" data-start="${fmt(s.start)}" data-duration="${fmt(s.dur - s.trim)}"${s.trim ? ` data-media-start="${fmt(s.trim)}"` : ''} data-track-index="${s.track}" data-volume="1" data-audio-group="voiceover"></audio>`))
  .concat(['      <!-- 목소리 끝 -->']).join('\n');
if (/<!-- 목소리 시작[\s\S]*?<!-- 목소리 끝 -->/.test(html)) html = html.replace(/      <!-- 목소리 시작[\s\S]*?<!-- 목소리 끝 -->/, block);
else throw new Error('<!-- 목소리 시작 --> 자리를 못 찾음');

// ── 5) 기준점이 달린 요소와 영상 길이
const at = (spec) => {
  const m = String(spec).match(/^([a-z0-9]+)(?:\.t(\d+))?(?:\.(end))?([+-][0-9.]+)?$/);
  if (!m || !VO.segs[m[1]]) throw new Error('기준점 해석 실패: ' + spec);
  const g = VO.segs[m[1]];
  const base = m[3] ? g.end : (m[2] != null ? g.tokens[Number(m[2])] : g.start);
  if (base == null) throw new Error('낱말 번호가 없다: ' + spec);
  return Math.max(0, base + Number(m[4] || 0));
};
html = html.replace(/<(audio|video|div|img)\b([^>]*\sdata-anchor="([^"]+)"[^>]*)>/g, (all, tag, attrs, spec) => {
  const s = at(spec);
  let a = attrs.replace(/\sdata-start="[^"]*"/, ` data-start="${fmt(s)}"`);
  const endSpec = (attrs.match(/\sdata-anchor-end="([^"]+)"/) || [])[1];
  if (endSpec) a = a.replace(/\sdata-duration="[^"]*"/, ` data-duration="${fmt(Math.max(0.1, at(endSpec) - s))}"`);
  return `<${tag}${a}>`;
});
html = html.replace(/(data-composition-id="main"[^>]*data-duration=")[0-9.]+(")/, `$1${total}$2`);
html = html.replace(/<(audio|video)\b([^>]*\sdata-full="1"[^>]*)>/g, (all, tag, attrs) => `<${tag}${attrs.replace(/\sdata-duration="[^"]*"/, ` data-duration="${total}"`)}>`);
fs.writeFileSync(htmlPath, html);

// ── 6) 음악: carve와 duck
let carveLog = null, duck = null;
if (!estimate) {
  if (arg('--carve')) {
    const cmd = [arg('--carve'), '--comp', htmlPath, '--bed', 'music', ...segs.flatMap((s) => ['--voice', 'vo-' + s.id]), '--strength', String(STRENGTH)];
    if (arg('--core')) cmd.push('--core', arg('--core'));
    carveLog = execFileSync(process.execPath, cmd, { encoding: 'utf8' }).trim().split('\n').filter((l) => /^(carve|bands|level|wrote)/.test(l));
    html = fs.readFileSync(htmlPath, 'utf8');
  }
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
  segs.forEach((s) => { const a = s.speech[0], b = s.speech[1], last = wins[wins.length - 1]; if (last && a - last[1] < MERGE) last[1] = Math.max(last[1], b); else wins.push([a, b]); });
  const pts = [{ t: 0, v: 0 }];
  wins.forEach(([a, b]) => pts.push({ t: fmt(Math.max(0, a - ATTACK)), v: 0 }, { t: fmt(Math.max(0.01, a - 0.02)), v: DUCK_DB }, { t: fmt(b + RELEASE_HOLD), v: DUCK_DB }, { t: fmt(Math.min(total, b + RELEASE_HOLD + RELEASE)), v: 0 }));
  const points = pts.filter((p, i) => i === 0 || p.t > pts[i - 1].t);
  auto.lanes = auto.lanes.filter((l) => !dropped.some((id) => String(l.target).startsWith(`fx.${id}.`))).concat([{ target: 'fx.duck.gain', points }]);
  let tag = musicTag;
  for (const name of ['data-fx-chain', 'data-automation']) tag = tag.replace(new RegExp('\\s' + name + '="[^"]*"'), '');
  tag = tag.replace(/>$/, ` data-fx-chain="${esc(JSON.stringify(chain))}" data-automation="${esc(JSON.stringify(auto))}">`);
  html = html.replace(musicTag, tag);
  fs.writeFileSync(htmlPath, html);
  duck = { windows: wins.map(([a, b]) => [fmt(a), fmt(b)]), removedCarveLevel: dropped.filter((id) => id !== 'duck') };
}

console.log(JSON.stringify({
  total, estimated: estimate,
  segments: segs.map((s) => ({ id: s.id, file: [fmt(s.start), fmt(s.start + s.dur - s.trim)], trim: s.trim ? fmt(s.trim) : undefined, onset: fmt(s.onset), speech: s.speech.map(fmt), track: s.track })),
  carve: carveLog || '건너뜀', duck,
}, null, 1));
