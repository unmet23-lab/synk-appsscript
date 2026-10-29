// 배경음: node 음악.mjs → public/bgm.wav. 원곡 「Building Momentum」 122.863 BPM — 지난 편(Y19 v2)이 앞머리부터 쓴 곡이라
// 이 편은 32박(약 15.7초)부터 38.8초를 잘라 쓰고 끝 1.6초를 줄인다(같은 곡이어도 같은 첫 마디가 되풀이되지 않게).
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, 'public', 'bgm.mp3');
const BEAT = 60 / 122.863;
const start = +(0.054 + 32 * BEAT).toFixed(4);
const LEN = 38.8;
const out = path.join(HERE, 'public', 'bgm.wav');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(start), '-t', String(LEN), '-i', SRC, '-af', `afade=t=in:d=0.08,afade=t=out:st=${LEN - 1.6}:d=1.6`, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', out]);
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
console.log(`public/bgm.wav ${(+dur).toFixed(2)}초 · 원곡 ${start.toFixed(2)}초부터`);
