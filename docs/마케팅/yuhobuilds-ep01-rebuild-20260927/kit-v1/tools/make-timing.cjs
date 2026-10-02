#!/usr/bin/env node
/**
 * 자막·낱말 시각 만들기 → data/timing.js (index.html과 make-sfx.cjs가 읽는다)
 *
 * 지금(임시 음성, 정의로 1.2배):
 *   node tools/make-timing.cjs                       # ../revision-v2/timing.json의 낱말·자막 시각을 그대로 옮긴다
 *
 * 유호님 육성으로 바꿀 때:
 *   node tools/make-timing.cjs --voice <녹음.wav> --words <transcript.json>
 *     --voice  녹음 파일. assets/audio/voice.m4a로 변환해 넣고(AAC 256k) 그 길이를 영상 길이로 쓴다.
 *     --words  낱말 시각 [{text,start,end}] (npx hyperframes transcribe <녹음> --model small --language ko 의 결과).
 *              대본(data/script.json)과 글자 단위로 맞춰 각 낱말의 시각을 정한다. 6월/유월처럼 표기가 달라도 맞춘다.
 *     --duration <초>  영상 길이를 직접 정한다(기본: 녹음 길이).
 *
 * 하는 일: data/timing.js를 쓰고, index.html에서 data-ep-dur 표시가 있는 태그(루트·음성·음악·효과음)의
 * data-duration을 새 길이로 고친다. 그다음 tools/make-sfx.cjs → 음악 깎기(carve) → npm run check 순서(README).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const script = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'script.json'), 'utf8')).captions;
const r3 = (x) => Math.round(x * 1000) / 1000;

// 대본 낱말: 띄어쓰기로 나누고, *별표* 구간을 강조로 표시
function tokens(text) {
  const out = [];
  let em = false;
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    let t = raw;
    const open = t.startsWith('*');
    if (open) { em = true; t = t.slice(1); }
    const close = t.endsWith('*');
    if (close) t = t.slice(0, -1);
    out.push({ t, em: em ? 1 : 0 });
    if (close) em = false;
  }
  return out;
}

function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const d = parseFloat(r.stdout);
  return Number.isFinite(d) ? d : null;
}

let captions; let duration; let source;

const wordsFile = opt('--words');
if (!wordsFile) {
  // ── 임시 음성: revision-v2 시각 그대로 ──
  const v2 = path.resolve(opt('--v2') || path.join(ROOT, '..', 'revision-v2', 'timing.json'));
  const T = JSON.parse(fs.readFileSync(v2, 'utf8'));
  const bySeg = {};
  T.words.forEach((w) => { (bySeg[w.segment] = bySeg[w.segment] || []).push(w); });
  const used = {};
  if (T.captions.length !== script.length) throw new Error(`자막 수가 다르다: v2 ${T.captions.length} · 대본 ${script.length}`);
  captions = script.map((c, i) => {
    const src = T.captions[i];
    if (src.segment !== c.seg) throw new Error(`${c.id} 구간이 다르다(${src.segment} ≠ ${c.seg})`);
    const toks = tokens(c.text);
    const k = used[c.seg] || 0;
    const ws = bySeg[c.seg].slice(k, k + toks.length);
    used[c.seg] = k + toks.length;
    if (ws.length !== toks.length) throw new Error(`${c.id} 낱말 수가 모자란다`);
    return { id: c.id, hide: c.hide ? 1 : 0, start: r3(src.start), end: r3(src.end),
      words: toks.map((tk, j) => ({ t: tk.t, s: r3(ws[j].start), e: r3(ws[j].end), em: tk.em, said: ws[j].text })) };
  });
  duration = T.duration;
  source = 'revision-v2/timing.json (정의로 임시 음성, 1.2배)';
} else {
  // ── 새 녹음: 대본 글자 ↔ 받아쓰기 글자를 맞춘다(편집 거리 정렬) ──
  let W = JSON.parse(fs.readFileSync(path.resolve(wordsFile), 'utf8'));
  if (!Array.isArray(W)) W = W.words || W.segments?.flatMap((s) => s.words) || [];
  W = W.filter((w) => w && typeof w.start === 'number' && String(w.text || w.word || '').trim())
    .map((w) => ({ text: String(w.text ?? w.word).trim(), start: w.start, end: w.end ?? w.start + 0.2 }));
  const norm = (s) => s.replace(/[\s.,!?…“”"'·~\-*()]/g, '').toLowerCase();
  const A = []; // 대본 글자 {ch, ci, ti}
  const capToks = script.map((c) => tokens(c.text));
  capToks.forEach((toks, ci) => toks.forEach((tk, ti) => { for (const ch of norm(tk.t)) A.push({ ch, ci, ti }); }));
  const B = []; // 받아쓰기 글자 {ch, s, e}
  W.forEach((w) => { const cs = [...norm(w.text)]; const d = (w.end - w.start) / Math.max(1, cs.length); cs.forEach((ch, i) => B.push({ ch, s: w.start + i * d, e: w.start + (i + 1) * d })); });
  const n = A.length; const m = B.length;
  const D = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = 0; i <= n; i++) D[i][0] = i;
  for (let j = 0; j <= m; j++) D[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (A[i - 1].ch === B[j - 1].ch ? 0 : 1));
  }
  const hit = new Array(n).fill(null);
  for (let i = n, j = m; i > 0 && j > 0;) {
    if (D[i][j] === D[i - 1][j - 1] + (A[i - 1].ch === B[j - 1].ch ? 0 : 1)) { hit[i - 1] = B[j - 1]; i--; j--; }
    else if (D[i][j] === D[i - 1][j] + 1) i--;
    else j--;
  }
  const times = capToks.map((toks) => toks.map(() => ({ s: null, e: null })));
  A.forEach((a, k) => { const h = hit[k]; if (!h) return; const x = times[a.ci][a.ti]; x.s = x.s == null ? h.s : Math.min(x.s, h.s); x.e = x.e == null ? h.e : Math.max(x.e, h.e); });
  // 못 맞춘 낱말은 앞뒤 낱말 사이로 고르게 채운다
  const flat = times.flat();
  flat.forEach((x, k) => {
    if (x.s != null) return;
    let a = k - 1; while (a >= 0 && flat[a].s == null) a--;
    let b = k + 1; while (b < flat.length && flat[b].s == null) b++;
    const t0 = a >= 0 ? flat[a].e : 0; const t1 = b < flat.length ? flat[b].s : t0 + 0.5;
    const f = (k - a) / (b - a);
    x.s = t0 + (t1 - t0) * f; x.e = x.s + 0.15;
  });
  const voice = opt('--voice');
  if (voice) {
    const outVoice = path.join(ROOT, 'assets', 'audio', 'voice.m4a');
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.resolve(voice), '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', outVoice], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('녹음 변환 실패: ' + r.stderr);
  }
  const lastEnd = flat[flat.length - 1].e;
  duration = parseFloat(opt('--duration')) || probe(path.join(ROOT, 'assets', 'audio', 'voice.m4a')) || lastEnd + 0.6;
  captions = script.map((c, i) => ({ id: c.id, hide: c.hide ? 1 : 0, words: capToks[i].map((tk, j) => ({ t: tk.t, s: r3(times[i][j].s), e: r3(times[i][j].e), em: tk.em })) }));
  captions.forEach((c, i) => {
    const first = c.words[0].s; const last = c.words[c.words.length - 1].e;
    const prevEnd = i ? captions[i - 1].end : 0;
    const next = captions[i + 1];
    c.start = r3(Math.max(prevEnd + 0.02, first - 0.03, 0));
    c.end = r3(next ? Math.min(next.words[0].s - 0.03, last + 0.45) : Math.min(duration - 0.1, last + 0.8));
  });
  source = `${path.basename(wordsFile)} (육성 받아쓰기 정렬)`;
}

const data = { source, duration: r3(duration), captions };
const body = '/* 자동 생성 파일: node tools/make-timing.cjs — 손으로 고치지 말고 data/script.json이나 녹음을 바꾼 뒤 다시 만든다 */\n'
  + 'window.EP01_TIMING = ' + JSON.stringify(data) + ';\n';
fs.writeFileSync(path.join(ROOT, 'data', 'timing.js'), body);

// index.html의 길이 표시(data-ep-dur 붙은 태그의 data-duration) 고치기
const idx = path.join(ROOT, 'index.html');
if (fs.existsSync(idx)) {
  let html = fs.readFileSync(idx, 'utf8'); let n = 0;
  html = html.replace(/<[^>]*\bdata-ep-dur\b[^>]*>/g, (tag) => { n++; return tag.replace(/data-duration="[^"]*"/, `data-duration="${r3(duration)}"`); });
  fs.writeFileSync(idx, html);
  console.log(`index.html 길이 ${r3(duration)}초로 맞춤(${n}곳)`);
}
console.log(`data/timing.js · 자막 ${captions.length}개 · 낱말 ${captions.reduce((a, c) => a + c.words.length, 0)}개 · ${r3(duration)}초 · ${source}`);
