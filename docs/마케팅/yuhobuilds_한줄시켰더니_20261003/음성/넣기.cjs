// 한 번에 읽힌 내레이션(음성/take/take.wav·take.json)을 index.html에 넣고, 영상의 모든 시각을 실제 말에 맞춘다.
// 10-04 유호님 「흐름이 뚝뚝 끊기는 느낌」 → 대사를 한 줄씩 만들어 쉼을 넣고 이어 붙이던 10-03 방식(커밋 66b0a032f)을 버렸다.
// voice-plan.json의 segments는 화면·자막 단위이고, 시각은 테이크의 받아쓰기 정렬(한번에_맞추기.py → 테이크_다듬기.py)에서 온다.
// 1) 목소리: 테이크 하나를 첫 말소리가 FIRST초에 들리게 놓는다(voiceover 묶음, 트랙 14).
// 2) 음성/timing.js(window.VO): 대사마다 말 시작·끝, 띄어쓰기 낱말마다 시작 시각, 자막 묶음, 장면 전환 시각 x.
//    장면 전환 = 그 장면 첫 대사 시작 − lead(voice-plan.json scenes). 앞 대사가 그때까지 안 끝나면 앞 대사 끝 − 0.06초로 늦춘다
//    (말이 이어지는 곳에서 앞 자막이 말 도중에 잘리지 않게).
// 3) data-anchor="<대사>[.t<낱말>][.end][±초]" 또는 "x.<장면>[±초]"가 달린 요소(효과음·영상)의 data-start를,
//    data-anchor-end가 있으면 data-duration도 고친다.
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
const STRENGTH = Number(arg('--strength') || 0.6);
const DUCK_DB = -8;
const ATTACK = 0.15, RELEASE_HOLD = 0.15, RELEASE = 0.45, MERGE = 1.0;
const estimate = has('--estimate');
const fmt = (x) => Number(x.toFixed(3));
const ids = plan.segments.map((s) => s.id);

// ── 1) 대사 시각(영상 기준)
let take = null, fileStart = 0;
const segs = {};
if (estimate) {
  let t = FIRST;
  for (const s of plan.segments) {
    const tokens = s.text.split(/\s+/).filter(Boolean);
    const dur = s.text.replace(/[^\p{L}\p{N}]/gu, '').length / 7;   // 발화 초당 7음절 어림
    segs[s.id] = { start: fmt(t), end: fmt(t + dur), tokens: tokens.map((_, i) => fmt(t + (dur * i) / tokens.length)) };
    t += dur + (plan.take.breaks.includes(s.id) ? 0.5 : 0.25);
  }
} else {
  take = JSON.parse(fs.readFileSync(path.join(__dirname, 'take', 'take.json'), 'utf8'));
  fileStart = FIRST - take.segs[ids[0]].start;
  if (fileStart < 0) throw new Error('테이크 앞 무음이 FIRST보다 길다 — 테이크_다듬기.py를 다시 돌린다');
  for (const id of ids) {
    const g = take.segs[id];
    if (!g) throw new Error(id + ': take.json에 없음');
    segs[id] = { start: fmt(g.start + fileStart), end: fmt(g.end + fileStart), tokens: g.tokens.map((t) => fmt(t + fileStart)) };
  }
}
const lastEnd = segs[ids[ids.length - 1]].end;
const total = fmt(lastEnd + TAIL);

// ── 2) 장면 전환 시각
const x = {};
for (const [sc, { at, lead }] of Object.entries(plan.scenes)) {
  const i = ids.indexOf(at);
  if (i < 1) throw new Error('장면 ' + sc + ': 첫 대사 ' + at + '를 못 찾음');
  const want = segs[at].start - lead, prevEnd = segs[ids[i - 1]].end - 0.06;
  x[sc] = fmt(Math.min(segs[at].start - 0.02, Math.max(want, prevEnd)));
}

// ── 3) timing.js
const VO = { total, estimated: estimate, x, segs: {} };
for (const s of plan.segments) VO.segs[s.id] = { ...segs[s.id], cap: s.cap };
fs.writeFileSync(path.join(__dirname, 'timing.js'),
  '// 음성/넣기.cjs가 만든다. 손으로 고치지 않는다.' + (estimate ? ' (어림값: 녹음 전)' : '') + '\nwindow.VO = ' + JSON.stringify(VO, null, 1) + ';\n');

// ── 4) 목소리 블록
const label = take ? `${take.engine} · ${take.model} · ${take.voice}` : '';
const block = [`      <!-- 목소리 시작 · 대본 전체를 한 번에 읽힌 테이크${take ? '(' + label + ')' : ''} — 음성/넣기.cjs가 만든다 -->`]
  .concat(estimate ? ['      <!-- (녹음 전: 어림 시각만 씀) -->'] : [`      <audio id="vo-take" src="음성/take/take.wav" data-start="${fmt(fileStart)}" data-duration="${fmt(take.seconds)}" data-track-index="14" data-volume="1" data-audio-group="voiceover"></audio>`])
  .concat(['      <!-- 목소리 끝 -->']).join('\n');
if (/<!-- 목소리 시작[\s\S]*?<!-- 목소리 끝 -->/.test(html)) html = html.replace(/      <!-- 목소리 시작[\s\S]*?<!-- 목소리 끝 -->/, block);
else throw new Error('<!-- 목소리 시작 --> 자리를 못 찾음');

// ── 5) 기준점이 달린 요소와 영상 길이
const at = (spec) => {
  const sx = String(spec).match(/^x\.(s\d+)([+-][0-9.]+)?$/);
  if (sx) { if (x[sx[1]] == null) throw new Error('장면 전환이 없다: ' + spec); return Math.max(0, x[sx[1]] + Number(sx[2] || 0)); }
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
    const cmd = [arg('--carve'), '--comp', htmlPath, '--bed', 'music', '--voice', 'vo-take', '--strength', String(STRENGTH)];
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
  ids.forEach((id) => { const a = segs[id].start, b = segs[id].end, last = wins[wins.length - 1]; if (last && a - last[1] < MERGE) last[1] = Math.max(last[1], b); else wins.push([a, b]); });
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
  total, estimated: estimate, voice: label || undefined, fileStart: fmt(fileStart),
  segments: ids.map((id) => ({ id, speech: [segs[id].start, segs[id].end] })), x,
  carve: carveLog || '건너뜀', duck,
}, null, 1));
