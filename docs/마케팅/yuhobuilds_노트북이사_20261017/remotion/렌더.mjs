// Remotion 판 두 훅을 렌더하고 소리만 마감해 ../renders/에 둔다.
// 마감: Remotion 믹스는 피크가 0dBFS를 넘는다(10-17 A 첫 렌더 −13.0 LUFS · 피크 +0.1) → volume + alimiter로 −1dB 아래·−14 LUFS 근처
// (현장 노트 영상_ffmpeg_자막.md 「띄엄띄엄 효과음 믹스 음량」: loudnorm 대신 volume+alimiter 뒤 ebur128으로 잰다). 영상은 다시 인코딩하지 않는다.
// 실행(remotion 폴더에서): node 준비.mjs && node 렌더.mjs [A|C|AC]
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const which = (process.argv[2] || 'AC').toUpperCase();
const OUT = { A: 'yuhobuilds_노트북이사_A_인스타.mp4', C: 'yuhobuilds_노트북이사_C_유튜브.mp4' };
fs.mkdirSync(path.join(here, '..', 'renders'), { recursive: true });

for (const k of ['A', 'C'].filter((x) => which.includes(x))) {
  const raw = path.join(here, 'out', `move-${k}.mp4`);
  const r = spawnSync('npx', ['remotion', 'render', `move-${k}`, raw], { cwd: here, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error('렌더 실패: move-' + k);
  const fin = path.join(here, '..', 'renders', OUT[k]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-c:v', 'copy', '-af', 'volume=-1.5dB,alimiter=limit=0.84:attack=3:release=60:level=false', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', fin]);
  console.log(k, path.relative(path.join(here, '..'), fin));
}
