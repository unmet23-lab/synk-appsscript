#!/usr/bin/env node
// 틀의 배경음(public/bgm.wav)을 박자표(src/beats.json)에 맞춰 원곡에서 다시 자른다(v6, 2026-11-10).
//   node docs/마케팅/LAB_퀴즈은행/틀/음악.mjs [--재기]   → 틀/public/bgm.wav (그다음 편마다 새편.mjs <편> --갱신)
// 원곡: 보유곡 「퀴즈120_키즈파티」(docs/홍보물/BGM/README.md — Suno Pro 요금제 WAV, 상업 사용 포함). 실측 120.12 BPM, 킥 어택 0.294 + 0.4995k초,
// 59~61박 세 박 킥 멈춤 → 62박에 다시 터짐, 125박 한 박 쉼 → 126 · 127박 마지막 타격. 이음매가 킥 앞 조용한 틈에 오게 첫 박을 어택보다 24ms 앞(0.27초)에 둔다.
// 100 BPM(한 박 0.6초)으로 늘인다(atempo) — 만족 사례 S23 · S29와 같은 빠르기.
// v5까지는 같은 「문제 신호」 9.6초(54~70박)를 세 번 이었다 — 문제 길이를 바꿀 수 없어 「같은 순서 세 번」이 됐다.
// v6: 문제마다 길이가 다르다. 문제 i의 조각 = [62 − reveal_i, 62 − reveal_i + len_i)박 — 정답이 늘 터지는 박(62)에, 카운트다운이 멈춘 박(59~61)에 온다.
//     이음매(앞 조각 끝 박 − 뒤 조각 첫 박)는 16박의 배수여야 마디 · 화음이 이어진다(아래에서 검사한다). 끝은 115박부터 — 마지막 두 타격(126 · 127박)이 응원 말 · 로고에 온다.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const 틀 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(틀, '..', '..', '..', '..');
const beats = JSON.parse(fs.readFileSync(path.join(틀, 'src', 'beats.json'), 'utf8'));
const M = beats.music;
const SRC = path.join(뿌리, M.원곡);
const OUT = path.join(틀, 'public', 'bgm.wav');
const SPB = (beats.beat / beats.fps); // 한 박(초) — 0.6
const TEMPO = (60 / M.bpm) / SPB; // atempo(0.8325 — 느리게)
const beat = (k) => M.첫박 / TEMPO + k * SPB; // 늘인 뒤 k번째 박의 시각

const 조각 = [
  ...beats.questions.map((q) => [M.터지는박 - q.reveal, M.터지는박 - q.reveal + q.len]),
  [M.끝시작박, M.끝시작박 + beats.end.len],
];
for (let i = 1; i < 조각.length; i++) {
  const 건너뜀 = 조각[i - 1][1] - 조각[i][0];
  if (((건너뜀 % 16) + 16) % 16 !== 0) { console.error(`이음매 ${i}: 앞 조각 끝 ${조각[i - 1][1]}박 → 뒤 조각 첫 ${조각[i][0]}박 — 16박의 배수가 아니라 마디가 어긋난다(${건너뜀}박). beats.json의 len · reveal을 맞춘다`); process.exit(1); }
}
const X = 0.02; // 이음매 교차 길이(초)
const 초 = 조각.map(([a, b]) => [beat(a), beat(b)]);
const parts = 초.map(([s, e], i) => `[t${i}]atrim=start=${s.toFixed(4)}:end=${(i < 초.length - 1 ? e + X : e).toFixed(4)},asetpts=PTS-STARTPTS[s${i}]`);
const split = `[0:a]atempo=${TEMPO.toFixed(6)},asplit=${초.length}${초.map((_, i) => `[t${i}]`).join('')}`;
let chain = '[s0]';
const fades = [];
for (let i = 1; i < 초.length; i++) {
  const out = i === 초.length - 1 ? '[mix]' : `[x${i}]`;
  fades.push(`${chain}[s${i}]acrossfade=d=${X}:c1=qsin:c2=qsin${out}`);
  chain = out;
}
const total = 초.reduce((t, [s, e]) => t + (e - s), 0);
const filter = [split, ...parts, ...fades, `[mix]afade=t=out:st=${(total - 0.25).toFixed(2)}:d=0.25[a]`].join(';');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', SRC, '-filter_complex', filter, '-map', '[a]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', OUT]);
const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', OUT]).toString().trim());
console.log(`public/bgm.wav ${dur.toFixed(2)}초(목표 ${total.toFixed(1)}초) · 조각(원곡 박) ${조각.map(([a, b]) => `${a}~${b}`).join(' · ')} · atempo ${TEMPO.toFixed(4)}`);

// --재기: 박마다 소리 크기(RMS dB)를 찍어 멈춘 박 · 터지는 박이 제자리에 왔는지 본다
if (process.argv.includes('--재기')) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', OUT, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], { maxBuffer: 1 << 28 });
  const n = raw.length / 2;
  const per = Math.round(8000 * SPB);
  const 줄 = [];
  let t0 = 0;
  const 구간 = [...beats.questions.map((q, i) => ({ 이름: `문제 ${i + 1}`, len: q.len, 표: { [q.count[0]]: '멈춤 시작', [q.reveal]: '정답' } })), { 이름: '끝', len: beats.end.len, 표: { [beats.end.cheer]: '응원 말' } }];
  for (const g of 구간) {
    const 칸 = [];
    for (let b = 0; b < g.len; b++) {
      const a = (t0 + b) * per;
      // 박 머리 0.18초(킥이 있는 자리)의 크기
      let s = 0; const m = Math.min(n, a + Math.round(8000 * 0.18));
      for (let k = a; k < m; k++) { const v = raw.readInt16LE(k * 2) / 32768; s += v * v; }
      const db = 10 * Math.log10(s / Math.max(1, m - a) + 1e-9);
      칸.push(`${b}${g.표[b] ? `(${g.표[b]})` : ''}:${db.toFixed(0)}`);
    }
    줄.push(`${g.이름} — ${칸.join(' ')}`);
    t0 += g.len;
  }
  console.log('박 머리 크기(dB):\n' + 줄.join('\n'));
}
