// 크롬 확장 10MB 상한 올림판(10-19 유호님 「10MB 판으로 제가 올리기」, 제작 방식 v2 §2-4 예외): 고화질 원본에서 x264 2패스로 9.4MB를 노린다.
//   node 올림판_10MB.mjs <원본.mp4> [<원본.mp4> …]   → 같은 폴더 upload_10MB.mp4 (BT.709 표시·yuv420p·AAC 128k 48kHz 스테레오, faststart)
// 소리는 다시 담기만 하고 음량은 원본 그대로다(−14.5 LUFS 마감은 원본에서 끝남).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const TARGET = 9.4 * 1024 * 1024; // 바이트
const AUDIO = 128_000;
const LIMIT = 10 * 1000 * 1000; // 확장 설명의 「under 10 MB」를 보수적으로

const probe = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
for (const src of process.argv.slice(2)) {
  const dur = probe(src);
  const video = Math.floor((TARGET * 8) / dur - AUDIO - 40_000); // 컨테이너 몫 40kbps
  const out = path.join(path.dirname(src), 'upload_10MB.mp4');
  const log = path.join(os.tmpdir(), `q3pass_${process.pid}`);
  const common = ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-c:v', 'libx264', '-preset', 'slow', '-b:v', String(video), '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-passlogfile', log];
  execFileSync('ffmpeg', [...common, '-pass', '1', '-an', '-f', 'mp4', os.platform() === 'win32' ? 'NUL' : '/dev/null']);
  execFileSync('ffmpeg', [...common, '-pass', '2', '-c:a', 'aac', '-b:a', String(AUDIO), '-ar', '48000', '-ac', '2', '-movflags', '+faststart', out]);
  for (const f of fs.readdirSync(os.tmpdir())) if (f.startsWith(`q3pass_${process.pid}`)) fs.rmSync(path.join(os.tmpdir(), f), { force: true });
  const size = fs.statSync(out).size;
  console.log(`${out} · ${(size / 1024 / 1024).toFixed(2)}MB · 영상 ${(video / 1e6).toFixed(2)}Mbps · ${dur.toFixed(2)}초 ${size < LIMIT ? '통과' : '⚠ 10MB 넘음'}`);
}
