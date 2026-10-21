// 마감한 영상을 올리기용으로 다시 담는다: 10MB 아래(크롬 확장 파일 올리기 한도) · bt709 · yuv420p · x264 2패스 · 소리 AAC 128k.
//   node scripts/upload.mjs <마감.mp4> <올리기.mp4> [목표MiB=9.3]
// 색 변환은 입력의 표시를 읽어 고른다: Remotion JPEG 프레임(yuvj420p·bt470bg·pc)이면 601→709로 바꾸고(현장 노트 브라우저_게시 10-19),
// 이미 709·tv인 마감본은 그대로 둔다. 10-21 음식 사진 편에서 옮긴 판이 709 마감본을 601·pc로 한 번 더 줄여 색이 바랬다(흰 235→217).
// 2패스가 목표를 넘을 수 있어(10-19 +18%) 담은 뒤 재고, 넘으면 목표를 낮춰 한 번 더 담는다.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [src, out, mib = '9.3'] = process.argv.slice(2);
if (!src || !out) throw Error('쓰는 법: node scripts/upload.mjs <마감.mp4> <올리기.mp4> [목표MiB]');
const LIMIT = 9.5 * 1024 * 1024; // 9,961,472바이트 — 10,000,000 아래
const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).toString().trim());
const [pixFmt, range, space] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=pix_fmt,color_range,color_space', '-of', 'csv=p=0', src]).toString().trim().split(',');
const inRange = range === 'pc' || pixFmt.startsWith('yuvj') ? 'pc' : 'tv';
const inMatrix = space === 'bt709' ? 'bt709' : 'bt601';
const vf = `scale=in_color_matrix=${inMatrix}:in_range=${inRange}:out_color_matrix=bt709:out_range=tv,format=yuv420p`;
const color = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709'];
const log = path.join(os.tmpdir(), `upload-2pass-${path.basename(out, '.mp4')}`);
console.log(JSON.stringify({ src, input: { pixFmt, range, space }, vf }));
const pass = (kbps) => {
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-b:v', `${kbps}k`, '-pass', '1', '-passlogfile', log, ...color, '-an', '-f', 'null', '-']);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-b:v', `${kbps}k`, '-pass', '2', '-passlogfile', log, ...color, '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-movflags', '+faststart', out]);
  return fs.statSync(out).size;
};
let kbps = Math.floor((Number(mib) * 1024 * 1024 * 8) / dur / 1000 - 128 - 8);
let size = pass(kbps);
console.log(JSON.stringify({ try: 1, kbps, MiB: +(size / 1048576).toFixed(2) }));
if (size > LIMIT) {
  kbps = Math.floor(kbps * (LIMIT / size) * 0.92);
  size = pass(kbps);
  console.log(JSON.stringify({ try: 2, kbps, MiB: +(size / 1048576).toFixed(2) }));
}
const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=pix_fmt,color_space,color_primaries,color_transfer', '-of', 'csv=p=0', out]).toString().trim();
console.log(JSON.stringify({ out, MiB: +(size / 1048576).toFixed(2), under10MB: size < 10 * 1000 * 1000, color: probe }));
