// 배경음: node 음악.mjs → public/bgm.wav. 회사 보유 곡 「따뜻_118」(docs/홍보물/BGM). 지난 두 편(Y23 「밝은_052」 · Y19 「Building Momentum」)과
// 다른 곡으로. 앞에서 38.9초를 잘라 끝 1.8초를 줄인다.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', '..', '..', '홍보물', 'BGM', '따뜻_118.wav');
const LEN = 38.9;
const out = path.join(HERE, 'public', 'bgm.wav');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-t', String(LEN), '-i', SRC, '-af', `afade=t=in:d=0.3,afade=t=out:st=${LEN - 1.8}:d=1.8`, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', out]);
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
console.log(`public/bgm.wav ${(+dur).toFixed(2)}초`);
