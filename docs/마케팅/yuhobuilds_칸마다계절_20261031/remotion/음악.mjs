// 배경음: node 음악.mjs → public/bgm.wav. 회사 보유 곡 「퀴즈120_테크팝」(docs/홍보물/BGM, Suno Pro 상업 사용) — 밝은 캠퍼스 웹툰 편이라
// 밝은 곡으로, 지난 두 편(Y25 「시티팝_147」 · Y27 「따뜻_118」)과 다른 곡. 첫 마디(0.812초)부터 50.3초를 잘라 끝 1.5초를 줄인다.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', '..', '..', '홍보물', 'BGM', '퀴즈120_테크팝_f4f3682d.wav');
const LEN = 50.3;
const out = path.join(HERE, 'public', 'bgm.wav');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '0.812', '-t', String(LEN), '-i', SRC, '-af', `afade=t=in:d=0.3,afade=t=out:st=${LEN - 1.5}:d=1.5`, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', out]);
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
console.log(`public/bgm.wav ${(+dur).toFixed(2)}초`);
