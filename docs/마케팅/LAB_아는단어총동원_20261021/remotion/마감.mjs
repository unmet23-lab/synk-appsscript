// 소리 크기 마감: node 마감.mjs <렌더본.mp4> → 같은 폴더에 _final.mp4 (그림은 그대로 복사)
// 잰 만큼 volume을 올리고 alimiter로 피크만 막은 뒤 다시 재서 −14.5±0.5 LUFS · 최대 −1.2 dBFS 안인지 본다.
import { execFileSync, spawnSync } from 'node:child_process';

const src = process.argv[2];
if (!src) throw new Error('쓰기: node 마감.mjs out/topik-quiz-vN.mp4');
const out = src.replace(/\.mp4$/, '_final.mp4');

const measure = (f) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const s = r.stderr.slice(r.stderr.lastIndexOf('Summary'));
  return { I: Number(/I:\s+(-?[\d.]+) LUFS/.exec(s)[1]), peak: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(s)[1]) };
};

const before = measure(src);
const gain = (-14 - before.I).toFixed(2);
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-c:v', 'copy',
  '-af', `volume=${gain}dB,alimiter=limit=0.84:attack=1:release=60:level=false`,
  '-c:a', 'aac', '-b:a', '384k', '-ar', '48000', '-movflags', '+faststart', out]); // 유튜브 권장 AAC 스테레오 384kbps·48kHz
const after = measure(out);
const ok = Math.abs(after.I + 14.5) <= 0.5 && after.peak <= -1.2;
console.log(`${before.I} LUFS / ${before.peak} dBFS → +${gain}dB → ${after.I} LUFS / ${after.peak} dBFS ${ok ? '통과' : '⚠ 범위 밖'} → ${out}`);
if (!ok) process.exitCode = 1;
