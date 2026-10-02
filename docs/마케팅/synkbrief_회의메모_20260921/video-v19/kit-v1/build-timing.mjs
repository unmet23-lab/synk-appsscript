// synkbrief 분할판 — 말 시각표 만들기
// 쓰는 법: node build-timing.mjs split1-45s   (또는 split2-60s)
//
// <분할>/plan.json의 문장(어느 Typecast 구간의 몇 번째 낱말부터 몇 번째까지)을 차례로 이어 붙이고,
// v19 audio/<구간>.json의 낱말 시각으로 자막 낱말마다 등장 시각을 계산한다.
// 그 결과로 <분할>/index.html의 표시 구역만 다시 쓴다(장면 디자인과 움직임은 손으로 쓴 그대로 둔다):
//   <!-- @audio --> … <!-- /@audio -->        내레이션 조각·BGM·효과음 <audio>
//   <!-- @cap 장면id --> … <!-- /@cap 장면id --> 그 장면의 낱말 자막 <p class="kv-cap">
//   /*@T*/ … /*/@T*/                           타임라인이 읽는 시각표(T)
//   data-duration="…" (루트)                   전체 길이
// 새 음성 합성은 하지 않는다. 문장을 자르고 순서를 바꾸고 사이를 띄울 뿐이다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const 분할 = process.argv[2];
if (!분할) { console.error('쓰는 법: node build-timing.mjs <split1-45s|split2-60s>'); process.exit(2); }
const P = path.join(HERE, 분할);
const plan = JSON.parse(fs.readFileSync(path.join(P, 'plan.json'), 'utf8'));
const 구간 = {};
const seg = (id) => (구간[id] ??= JSON.parse(fs.readFileSync(path.join(HERE, '..', 'audio', `${id}.json`), 'utf8')));
const r3 = (x) => Math.round(x * 1000) / 1000;

const PAD_IN = plan.padIn ?? 0.1, PAD_OUT = plan.padOut ?? 0.12;
// 장면 전환이 새 장면을 보여 주기 시작하는 지점(전환 시작 기준). motion.js의 전환 길이에 맞춘다
const 전환 = { patch: { d: -0.5, show: 0.36 }, seam: { d: -0.42, show: 0.04 }, arch: { d: -0.45, show: 0.02 }, paper: { d: -0.45, show: 0.04 }, cut: { d: -0.06, show: 0 } };

let t = plan.lead ?? 0.15;
const L = {};
const 줄 = [];
for (const [i, ln] of plan.lines.entries()) {
  const s = seg(ln.seg);
  const ws = s.words;
  const a = ws[ln.from], b = ws[ln.to - 1];
  const 앞 = ws[ln.from - 1], 뒤 = ws[ln.to];
  const inT = Math.max(0, a.start - PAD_IN, 앞 ? 앞.end + 0.02 : 0);
  const outT = Math.min(s.audio_duration, b.end + PAD_OUT, 뒤 ? 뒤.start - 0.03 : Infinity);
  if (i > 0) t += ln.gap ?? plan.gap ?? 0.3;
  const at = t, dur = outT - inT;
  t = at + dur;
  const 낱말 = ws.slice(ln.from, ln.to);
  // 화면 자막 낱말(표기). *로 감싼 부분은 강조(em)
  const 표기 = ln.text.split(/\s+/).filter(Boolean);
  if (표기.length !== 낱말.length) throw new Error(`${ln.id}: 자막 낱말 ${표기.length}개 ≠ 음성 낱말 ${낱말.length}개 (${낱말.map((w) => w.text).join(' ')})`);
  const w = 낱말.map((x) => r3(at + x.start - inT));
  const we = 낱말.map((x) => r3(at + x.end - inT));
  L[ln.id] = { at: r3(at), end: r3(at + dur), w, we, seg: ln.seg, in: r3(inT), out: r3(outT), scene: ln.scene };
  줄.push({ ...ln, at, dur, inT, outT, 표기, w, we });
}
const 끝말 = t;
const DUR = r3(끝말 + (plan.hold ?? 1.8));

// 장면: 첫 장면은 0초. 나머지는 그 장면 첫 문장의 시작에 맞춘 전환
const S = {};
for (const sc of plan.scenes) {
  if (!sc.line) { S[sc.id] = { tr: 0, type: 'start', v: 0 }; continue; }
  const ty = 전환[sc.tr]; if (!ty) throw new Error(`전환 이름 ${sc.tr}`);
  const tr = r3(L[sc.line].at + (sc.d ?? ty.d));
  S[sc.id] = { tr, type: sc.tr, v: r3(tr + ty.show) };
}

// 자막 묶음: 두 줄(약 20자) 안에서 끊고, 문장 끝(. ? !)에서는 새 묶음
const caps = [];
const 장면자막 = {};
for (const [k, ln] of 줄.entries()) {
  const 묶음 = [];
  let cur = [];
  const len = (arr) => arr.reduce((n, i) => n + ln.표기[i].replace(/\*/g, '').length, 0) + Math.max(0, arr.length - 1);
  let 강조중 = false; // 강조(*…*) 한 덩어리는 두 묶음으로 쪼개지 않는다
  ln.표기.forEach((tok, i) => {
    if (!강조중 && cur.length && len([...cur, i]) > (plan.capMax ?? 20)) { 묶음.push(cur); cur = []; }
    cur.push(i);
    if (tok.startsWith('*')) 강조중 = true;
    if (tok.endsWith('*')) 강조중 = false;
    const 마침 = /[.?!]\*?$/.test(tok);
    if (!강조중 && 마침 && i < ln.표기.length - 1 && len(cur) >= 6) { 묶음.push(cur); cur = []; }
  });
  if (cur.length) 묶음.push(cur);
  const 다음 = 줄[k + 1];
  묶음.forEach((idx, j) => {
    const id = `cap-${ln.id}-${j}`;
    const 다음묶음 = 묶음[j + 1];
    // 앞 묶음은 다음 묶음 첫 낱말보다 조금 먼저 사라진다(아래끝 정렬이라 두 묶음이 같은 자리에 겹치지 않게)
    let out = 다음묶음 ? ln.w[다음묶음[0]] - 0.16 : ln.we[ln.we.length - 1] + 0.45;
    if (!다음묶음 && 다음) out = Math.min(out, 다음.w[0] - 0.16);
    if (!다음묶음 && !다음) out = null; // 마지막 자막은 끝까지 둔다
    // 강조 표시: *가 연 곳부터 닫힌 곳까지 <em>
    let html = '', 열림 = false;
    idx.forEach((i, n) => {
      let tok = ln.표기[i];
      const 열기 = tok.startsWith('*'), 닫기 = tok.endsWith('*');
      tok = tok.replace(/^\*|\*$/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
      if (n) html += ' ';
      if (열기 && !열림) { html += '<em>'; 열림 = true; }
      html += tok;
      if (닫기 && 열림) { html += '</em>'; 열림 = false; }
    });
    if (열림) html += '</em>';
    caps.push({ id, w: idx.map((i) => ln.w[i]), out: out == null ? null : r3(out) });
    (장면자막[ln.scene] ??= []).push(`<p class="kv-cap" id="${id}">${html}</p>`);
  });
}

// 소리: 내레이션 조각(같은 그룹) · BGM(길이 끝에서 줄임) · 효과음(전환은 스치는 소리, 붙는 순간은 톡)
const vol = plan.voiceVolume ?? 0.708;
const 오디오 = [];
for (const ln of 줄) {
  오디오.push(`<audio id="vo-${ln.id}" src="audio/vo-${ln.seg}.wav" data-start="${r3(ln.at)}" data-duration="${r3(ln.dur)}" data-media-start="${r3(ln.inT)}" data-volume="${vol}" data-audio-group="voiceover" data-track-index="2"></audio>`);
}
const bg = plan.bgm ?? { volume: 0.43 };
const lane = { version: 1, lanes: [{ target: 'volume', points: [{ t: 0, v: 0 }, { t: 0.5, v: bg.volume }, { t: r3(DUR - 1.6), v: bg.volume }, { t: DUR, v: 0 }] }] };
오디오.push(`<audio id="music" src="audio/bgm.wav" data-start="0" data-duration="${DUR}" data-media-start="0" data-volume="1" data-audio-group="music" data-track-index="9" data-automation="${JSON.stringify(lane).replace(/"/g, '&quot;')}"></audio>`);
const 효과 = { swish: ['swish-soft.wav', 0.6, 0.16], pop: ['pop-soft.wav', 0.7, 0.12], click: ['click-soft.wav', 0.4, 0.22], chime: ['sfx_003.mp3', 2.5, 0.085] };
const 큐 = [];
for (const [id, s] of Object.entries(S)) if (s.type !== 'start') 큐.push({ at: s.type === 'cut' ? s.tr : s.tr + 0.02, type: s.type === 'cut' ? 'pop' : 'swish', why: `전환 ${s.type} → ${id}` });
for (const c of plan.cues ?? []) {
  const base = c.line ? (c.word != null ? L[c.line].w[c.word] : L[c.line].at) : S[c.scene].v;
  큐.push({ at: base + (c.d ?? 0), type: c.type, why: c.why ?? '' });
}
// 효과음은 겹치지 않게 트랙을 나눠 쓴다(13~17). 끝을 넘는 소리는 영상 길이에서 자른다
const 트랙끝 = { 13: -1, 14: -1, 15: -1, 16: -1, 17: -1 };
큐.sort((a, b) => a.at - b.at).forEach((c, i) => {
  const [f, d0, g] = 효과[c.type];
  const d = r3(Math.min(d0, DUR - c.at));
  const tr = Object.keys(트랙끝).map(Number).find((k) => 트랙끝[k] <= c.at + 1e-6);
  트랙끝[tr] = c.at + d;
  오디오.push(`<audio id="sfx-${String(i).padStart(2, '0')}" src="audio/${f}" data-start="${r3(c.at)}" data-duration="${d}" data-volume="${g}" data-audio-group="sfx" data-track-index="${tr}"></audio>`);
});

const T = { dur: DUR, l: L, s: S, caps };

// index.html 표시 구역 다시 쓰기
const 파일 = path.join(P, 'index.html');
let html = fs.readFileSync(파일, 'utf8');
const 바꾸기 = (열기, 닫기, 안) => {
  const a = html.indexOf(열기), b = html.indexOf(닫기);
  if (a < 0 || b < a) throw new Error(`표시 구역 없음: ${열기}`);
  html = html.slice(0, a + 열기.length) + 안 + html.slice(b);
};
바꾸기('<!-- @audio -->', '<!-- /@audio -->', '\n      ' + 오디오.join('\n      ') + '\n      ');
for (const sc of plan.scenes) {
  const 열기 = `<!-- @cap ${sc.id} -->`, 닫기 = `<!-- /@cap ${sc.id} -->`;
  if (html.includes(열기)) 바꾸기(열기, 닫기, (장면자막[sc.id] ?? []).join(''));
  else if (장면자막[sc.id]) throw new Error(`${sc.id} 장면에 자막 구역이 없다`);
}
바꾸기('/*@T*/', '/*/@T*/', JSON.stringify(T));
html = html.replace(/(data-composition-id="main"[^>]*?data-duration=")[\d.]+(")/, `$1${DUR}$2`);
fs.writeFileSync(파일, html);
fs.writeFileSync(path.join(P, 'timing.json'), JSON.stringify({ ...T, lines: 줄.map((l) => ({ id: l.id, seg: l.seg, text: l.text, at: r3(l.at), end: r3(l.at + l.dur), in: r3(l.inT), out: r3(l.outT) })), cues: 큐.map((c) => ({ ...c, at: r3(c.at) })) }, null, 2));

console.log(`${분할}: ${DUR}s · 문장 ${줄.length} · 장면 ${plan.scenes.length} · 자막 묶음 ${caps.length} · 효과음 ${큐.length}`);
for (const l of 줄) console.log(`  ${l.id.padEnd(4)} ${r3(l.at).toFixed(2).padStart(6)}–${r3(l.at + l.dur).toFixed(2).padStart(6)}  ${l.seg}[${r3(l.inT)}–${r3(l.outT)}]  ${l.text.replace(/\*/g, '')}`);
for (const [id, s] of Object.entries(S)) console.log(`  ${id.padEnd(4)} ${s.type.padEnd(6)} 전환 ${s.tr.toFixed(2)} 보임 ${s.v.toFixed(2)}`);
