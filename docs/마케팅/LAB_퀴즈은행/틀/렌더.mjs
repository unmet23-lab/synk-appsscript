#!/usr/bin/env node
// 퀴즈 한 편 렌더(2026-11-10): 편 폴더의 remotion 사본(새편.mjs)을 한 번 묶고 판본마다 영상 → 소리 마감(tools/음량마감.mjs, −14.5 LUFS)
// → 게시/<판 폴더>/video.mp4 · cover.png. 올림 화질(v2 §2-4): PNG 프레임 · H.264 12Mbps slow · yuv420p · BT.709. 영상은 git 밖(*.mp4).
//   node docs/마케팅/LAB_퀴즈은행/틀/렌더.mjs <편 폴더> [--언어 mn,en] [--장면 [프레임,…]] [--표지 60] [--한장면 <판 번호>]
//   --장면: 영상 대신 정지 장면만(기본 문제마다 단계별 순간 + 끝) → <편>/시험/장면/<언어>/ + 모아 보기 한 장(눈으로 · 글자 검사로 먼저 본다)
//   --한장면 n: 「한 장면 먼저」 심사용 — 제목 · 글 없이 첫 문제의 장면만(5.4초) → <편>/장면/장면_v<n>.mp4(영상은 git 밖)
// 판 폴더 이름: 게시/01-<언어>(몽골어 01-mn). 표지는 2.0초(제목 · 다리 글 · 글자 그대로 장면의 둘째 박 · 띠가 다 보이는 첫 순간).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const 틀 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(틀, '..', '..', '..', '..');
const require = createRequire(path.join(틀, 'package.json'));
const { bundle } = require('@remotion/bundler');
const { renderMedia, renderStill, selectComposition } = require('@remotion/renderer');

const args = process.argv.slice(2);
const 편 = args[0] && !args[0].startsWith('--') ? path.resolve(args[0]) : null;
const val = (k) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : null; };
if (!편) { console.error('사용: node 렌더.mjs <편 폴더> [--언어 mn] [--장면 [프레임,…]] [--표지 60] [--한장면 n]'); process.exit(2); }
const 사본 = path.join(편, 'remotion');
const ep = JSON.parse(fs.readFileSync(path.join(사본, 'src', 'episode.json'), 'utf8'));
const beats = JSON.parse(fs.readFileSync(path.join(사본, 'src', 'beats.json'), 'utf8'));
const 언어들 = (val('--언어') || ep.langs.join(',')).split(',').filter(Boolean);
const 장면만 = args.includes('--장면');
const 장면값 = val('--장면');
const 한장면 = val('--한장면');
const 표지 = Number(val('--표지') || 60);

// 기본 정지 장면: 문제마다 0 · 둘째 박 뒤 · 띠 · 보기 · 카운트 가운데 · 정답 · 뒤집힌 뒤 · 따라 말하기 · (네 차례) + 끝 넷
const B = beats.beat;
const fr = (b) => Math.round(b * B);
let q0 = 0;
const 기본장면 = [];
for (const q of beats.questions) {
  for (const b of [0, q.beat2 + 0.6, q.band + 0.8, q.opts[q.opts.length - 1] + 1, q.count[1] + 0.4, q.reveal + 0.3, q.reveal + 1.4, q.say + 1.2, ...(q.turn ? [q.turn + 1] : [])]) 기본장면.push(q0 + fr(b));
  q0 += fr(q.len);
}
for (const b of [1, beats.end.recap[2] + 1.5, beats.end.ask + 3, beats.end.cheer + 1.5]) 기본장면.push(q0 + fr(b));
const 장면들 = 장면값 && /^\d/.test(장면값) ? 장면값.split(',').map(Number) : 기본장면;

const serveUrl = await bundle({ entryPoint: path.join(사본, 'src', 'index.ts'), publicDir: path.join(사본, 'public') });
if (한장면) {
  const composition = await selectComposition({ serveUrl, id: 'scene-only' });
  const dir = path.join(편, '장면');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `장면_v${한장면}.mp4`);
  await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: out, imageFormat: 'png', videoBitrate: '10M', pixelFormat: 'yuv420p', colorSpace: 'bt709', chromiumOptions: { gl: 'angle' } });
  console.log(`한 장면 → ${path.relative(뿌리, out)}`);
  process.exit(0);
}
for (const lang of 언어들) {
  const composition = await selectComposition({ serveUrl, id: `quiz-${lang}` });
  if (장면만) {
    const dir = path.join(편, '시험', '장면', lang);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) if (/^f\d+\.png$/.test(f) || f === '_모아보기.jpg') fs.unlinkSync(path.join(dir, f));
    for (const f of 장면들) {
      await renderStill({ composition, serveUrl, frame: f, output: path.join(dir, `f${String(f).padStart(4, '0')}.png`) });
    }
    // 모아 보기: 한 장에 6열(폰 크기 270×480)
    const py = `
import sys,glob,os
from PIL import Image
d=sys.argv[1]; fs=sorted(glob.glob(os.path.join(d,'f*.png'))); W,H=270,480; cols=6
rows=(len(fs)+cols-1)//cols; sheet=Image.new('RGB',(W*cols,H*rows),(30,30,30))
for i,f in enumerate(fs):
    im=Image.open(f).convert('RGB').resize((W,H)); sheet.paste(im,((i%cols)*W,(i//cols)*H))
sheet.save(os.path.join(d,'_모아보기.jpg'),quality=85)
print(os.path.join(d,'_모아보기.jpg'))`;
    execFileSync('python', ['-X', 'utf8', '-c', py, dir], { stdio: 'inherit' });
    continue;
  }
  const t0 = Date.now();
  const raw = path.join(사본, 'out', `quiz_${lang}.mp4`);
  fs.mkdirSync(path.dirname(raw), { recursive: true });
  await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: raw, imageFormat: 'png', videoBitrate: '12M', x264Preset: 'slow', pixelFormat: 'yuv420p', colorSpace: 'bt709', chromiumOptions: { gl: 'angle' } });
  const dir = path.join(편, '게시', `01-${lang}`);
  fs.mkdirSync(dir, { recursive: true });
  execFileSync('node', [path.join(뿌리, 'tools', '음량마감.mjs'), raw, path.join(dir, 'video.mp4'), '--덮어쓰기'], { stdio: 'inherit' });
  await renderStill({ composition, serveUrl, output: path.join(dir, 'cover.png'), frame: 표지 });
  console.log(`${lang} → ${path.relative(뿌리, dir)} · ${Math.round((Date.now() - t0) / 1000)}초`);
}
