// 렌더한 영상의 소리만 마감한다: 통합 −14.5 LUFS로 맞추고 봉우리를 −1 dBFS 아래로 누른다(영상은 그대로 복사).
// 휴대폰 보내기용(30MiB 아래)도 같이 만든다(crf 28 · 소리 96k — 메모 「휴대폰 보내기 30MiB」).
//   node scripts/finish.mjs out/shift-subs-a-v3-raw.mp4 out/shift-subs-a-v3.mp4 [out/shift-subs-a-v3-phone.mp4]
// 같은 채널 「GPTs·젬」 편은 −14.6 LUFS · −0.6 dBFS, 「노트북 이사」 편은 −14.2 LUFS · −1.4 dBFS로 마감했다.
import { execFileSync, spawnSync } from 'node:child_process';

const [src, out, phone] = process.argv.slice(2);
if (!src || !out) throw Error('쓰는 법: node scripts/finish.mjs <렌더.mp4> <마감.mp4> [휴대폰.mp4]');
const TARGET = -14.5;
const measure = (f) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-vn', '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' });
  const s = String(r.stderr);
  const I = Number([...s.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop()[1]);
  const P = Number([...s.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].pop()[1]);
  return { I, P };
};
const before = measure(src);
// 리미터가 봉우리를 누르면 통합 크기가 조금 내려가니, 한 번 재고 모자란 만큼 한 번 더 올린다.
let gain = +(TARGET - before.I).toFixed(2);
const run = (g) => execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-c:v', 'copy', '-af', `volume=${g}dB,alimiter=limit=0.89:level=false:attack=3:release=60`, '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', out]);
run(gain);
let after = measure(out);
if (Math.abs(after.I - TARGET) > 0.3) { gain = +(gain + TARGET - after.I).toFixed(2); run(gain); after = measure(out); }
console.log(JSON.stringify({ src, out, before, gain, after }));
if (phone) {
  // 96k로 다시 누르면 봉우리가 0.3~0.6dB 솟는다(10-18: −1.0 → −0.7·−0.4) → 렌더 원본에서 같은 크기로, 리미터만 0.84(−1.5 dBFS)로.
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-c:v', 'libx264', '-crf', '28', '-preset', 'medium', '-pix_fmt', 'yuv420p',
    '-af', `volume=${gain}dB,alimiter=limit=0.84:level=false:attack=3:release=60`, '-c:a', 'aac', '-b:a', '96k', '-ar', '48000', '-movflags', '+faststart', phone]);
  console.log(JSON.stringify({ phone, ...measure(phone) }));
}
