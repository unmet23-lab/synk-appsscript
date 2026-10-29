// 배경음: node 음악.mjs → public/bgm.wav. 회사 보유 곡 「밝은_052」(95.45 BPM — synkbrief B16에서 옮김). 지난 두 편(Y22 · Y19)은
// 「Building Momentum」이라 다른 곡으로. 앞에서 37.9초를 잘라 끝 1.6초를 줄인다. 띵이 몰아치는 첫 2.7초 · 끝 장면은 Film이 소리를 뺀다.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, 'public', 'bgm.mp3');
const LEN = 37.9;
const out = path.join(HERE, 'public', 'bgm.wav');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-t', String(LEN), '-i', SRC, '-af', `afade=t=in:d=0.3,afade=t=out:st=${LEN - 1.6}:d=1.6`, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', out]);
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
console.log(`public/bgm.wav ${(+dur).toFixed(2)}초`);
