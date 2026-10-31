// 배경음: node 음악.mjs → public/bgm.wav. 회사 보유 곡 「시티팝_147」(docs/홍보물/BGM) — 지난 편들(Y23 「밝은_052」 · Y24 · Y25 「따뜻_118」)과 다른 곡.
// 곡에서 가장 꽉 찬 자리(86.1초)가 되돌리는 순간(19.9초)에 오게 66초부터 자른다. 끊고 다시 켜는 것은 Film.tsx의 music이 한다.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', '..', '..', '홍보물', 'BGM', '시티팝_147.wav');
const FROM = 66;
const LEN = 32;
const out = path.join(HERE, 'public', 'bgm.wav');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(FROM), '-t', String(LEN), '-i', SRC, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', out]);
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
console.log(`public/bgm.wav ${(+dur).toFixed(2)}초`);
