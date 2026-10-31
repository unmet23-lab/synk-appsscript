// 배경음: node 음악.mjs → public/bgm.wav. 회사 보유 곡 「시티팝_147」(docs/홍보물/BGM) — 밤 장면 편이라 도시 밤 곡으로, 지난 두 편(Y24 「따뜻_118」 · Y23 「밝은_052」)과
// 다른 곡. 앞에서 41.2초를 잘라 끝 1.5초를 줄인다.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', '..', '..', '홍보물', 'BGM', '시티팝_147.wav');
const LEN = 41.2;
const out = path.join(HERE, 'public', 'bgm.wav');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-t', String(LEN), '-i', SRC, '-af', `afade=t=in:d=0.3,afade=t=out:st=${LEN - 1.5}:d=1.5`, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', out]);
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
console.log(`public/bgm.wav ${(+dur).toFixed(2)}초`);
