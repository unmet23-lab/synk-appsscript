// v2 배경음: node 음악_v2.mjs → public/bgm_v2.wav. 원곡 「Building Momentum」 122.863 BPM(v1 · yuhobuilds 지난 편과 같은 곡).
// 끝맺음(원곡 108박부터, 약 5.1초)을 76박(37.17초 — 끝 카드 둘이 다 선 37.1초 바로 뒤 마디 경계)에 붙여 42.3초 안팎에 끝나게.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, 'public', 'bgm.mp3');
const BEAT = 60 / 122.863;
const t = (k) => +(0.054 + k * BEAT).toFixed(4);
const X = 0.02;
const K = 76;
const segs = [[0, t(K)], [t(108), 57.9]];
const parts = segs.map(([s, e], i) => `[0:a]atrim=start=${s}:end=${(i < segs.length - 1 ? e + X : e).toFixed(4)},asetpts=PTS-STARTPTS[s${i}]`);
const out = path.join(HERE, 'public', 'bgm_v2.wav');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', SRC, '-filter_complex', [...parts, `[s0][s1]acrossfade=d=${X}:c1=qsin:c2=qsin[mix]`].join(';'), '-map', '[mix]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', out]);
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
console.log(`public/bgm_v2.wav ${(+dur).toFixed(2)}초 · 끝맺음 ${t(K).toFixed(2)}초부터`);
