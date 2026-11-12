#!/usr/bin/env node
// 판본 렌더(11-10 LAB 하루 두 편 · 39계정 — 판본 틀 S0, 설계 6 · 20 · 22). 이 편의 판본 글 하나를 그 판본 영상 · 표지로 굽는다. 유료 호출 없음.
//
//   node 판본렌더.mjs <KEY…|전부> [--확인] [--표지만]
//     KEY = 계정 원장 LAB 계정의 rotationVersion, 없으면 countryCode(MN · EN · US · CN …). 전부 = 판본 폴더의 JSON 전부.
//     --확인: 굽지 않고 키마다 글이 다 찼는지(컴포지션으로 등록됐는지)와 빈 칸만 보인다.
//     --표지만: 영상은 두고 cover.png만 다시 뜬다.
//   → 게시/판본/<KEY>/video.mp4(음량 마감 −14.5 LUFS) · cover.png(그 판본 coverAt 초 — 새 판본은 첫 2초 카드) · 렌더.json(글 지문 · 잰 값)
//
// 하는 일:
//   ① remotion bundle 한 번 → remotion compositions로 등록된 판본을 읽는다. Root는 글이 다 찬 판본만 등록하므로(src/…/판본.ts 「빈칸」),
//      글 파일이 없거나 빈 칸이 있는 키는 건너뛰고 빈 칸을 알린다(_설명이 「(선택)」으로 시작하는 칸은 비워도 된다).
//   ② 키마다 차례로 하나씩 렌더한다(현장 노트 영상 「Remotion 렌더 둘을 동시에 돌리면 한쪽이 child_process 오류로 죽고…」) → remotion/out/판본_<KEY>.mp4(git 밖)
//   ③ tools/음량마감.mjs(−14.5 LUFS · AAC 384k) → video.mp4. 봉우리가 −1.2 dBFS를 넘으면 리미터 0.84 → 0.76 → 0.7로 다시,
//      음량은 맞는데 AAC 실측만 320kbps 아래면(말 사이가 조용한 편) 비트를 아끼는 세 기능을 끄고 소리만 다시 담아 한 번 더 잰다(현장 노트 11-05).
//      끝내 「통과」가 아니면 그 키는 실패로 남기고 옛 video.mp4를 덮지 않는다.
//   ④ 영상 비트레이트가 8.5Mbps 아래면 고정 10Mbps로 다시 담는다(현장 노트 「videoBitrate 12M으로 렌더해도 단순한 화면은 4~7Mbps…」).
//   ⑤ 마감한 video.mp4에서 round(coverAt × 30)번째 프레임을 뽑아 cover.png(손실 없는 PNG — 11-05 영어판 게시 표지와 같은 방법).
//   ⑥ 렌더.json — 글 파일 · 글 SHA-256(판본 글 원천의 지문 — 렌더 관문이 지금 원천과 견준다. 뜻 검수 지문은 이것이 아니라 글.json이다) · 영상 SHA-256 · 자산 SHA-256(번들에 든 그림 · 소리 · 틀) · 컴포지션 · 음량 · 비트레이트 · 시각.
//      나라 인사가 켜진 판본(판본 지도 「인사」 — tools/lib/판본잇기.js 머리말)은 그 판본의 인사 그림 · 목소리 지문(인사sha256)과 인사 길이(인사초)도 적는다.
//      --표지만은 영상을 다시 굽지 않으니 글 · 영상 · 자산 지문은 옛 기록 그대로 둔다(옛 기록이 없으면 지문 없는 기록 — 돌림에 못 든다).
// 그림 · 목소리 · 소리 · 박자는 정본 하나라 판본마다 바뀌지 않는다(원본 동결). 판본은 글 자리와 글꼴만 바꾼다.
// 이 파일은 다섯 편(화날때 · 미안죄송합니다 · 사층F · 물고기 · 지마)이 같은 몸통을 쓴다 — 편마다 다른 것은 아래 「편」 한 줄뿐.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const 편 = { 접두: 'angry', 판본폴더: 'remotion/src/film/판본' };

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..');
const 리모션 = path.join(여기, 'remotion');
const 판본폴더 = path.join(여기, 편.판본폴더);
const 낼곳 = path.join(여기, '게시', '판본');
// 자산 지문(11-11) — 이 렌더가 읽은 원본 그림 · 소리 · 틀(remotion public · src, 판본 글 빼고)의 지문을 렌더.json 「자산sha256」에 적는다.
// 돌림표가 지금 자산과 견줘, 원본 그림을 고친 뒤 다시 굽지 않은 판본을 돌림에서 뺀다(tools/lib/판본잇기.js 자산지문 · 렌더문제).
const 잇기 = createRequire(import.meta.url)(path.join(뿌리, 'tools', 'lib', '판본잇기.js'));
// 판본 지도가 있으면 그 지도의 자산 자리(「자산」 칸 — 없으면 판본폴더가 든 remotion의 public · src)로 센다 — 돌림표와 같은 셈이어야 한다
const 자산재기 = () => 잇기.자산지문(여기, 잇기.있나(여기) ? 잇기.지도읽기(여기).지도 : { 판본폴더: 편.판본폴더 });
const CLI = path.join(리모션, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const FPS = 30;
const 낮은비트 = 8.5e6;

const 인자 = process.argv.slice(2);
const 확인만 = 인자.includes('--확인');
const 표지만 = 인자.includes('--표지만');
const 키인자 = 인자.filter((a) => !a.startsWith('--'));
if (!키인자.length) {
  console.error('사용: node 판본렌더.mjs <KEY…|전부> [--확인] [--표지만]');
  process.exit(2);
}
const 있는키 = fs.existsSync(판본폴더) ? fs.readdirSync(판본폴더).filter((f) => /^[A-Z]{2}\.json$/.test(f)).map((f) => f.slice(0, 2)).sort() : [];
const 키들 = 키인자.includes('전부') ? 있는키 : 키인자.map((k) => k.toUpperCase());
for (const k of 키들) if (!/^[A-Z]{2}$/.test(k)) { console.error(`판본 키가 아니다: ${k}(두 글자 대문자)`); process.exit(2); }

const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const rel = (p) => path.relative(뿌리, p).split(path.sep).join('/');

// 자식 실행 — 출력은 로그 파일로(끝 줄만 보이면 미통과를 놓친다 — 현장 노트 「음량 마감을 | tail -1로 이으면…」)
function 실행(cmd, args, { cwd = 리모션, 로그 = null } = {}) {
  return new Promise((resolve) => {
    const 자식 = spawn(cmd, args, { cwd, windowsHide: true });
    let out = '';
    const 받기 = (d) => { out += d.toString('utf8'); if (로그) fs.appendFileSync(로그, d); };
    자식.stdout.on('data', 받기);
    자식.stderr.on('data', 받기);
    자식.on('close', (code) => resolve({ code, out }));
  });
}
const 리모션실행 = (args, 로그) => 실행(process.execPath, [CLI, ...args], { 로그 });

async function ffprobe(file) {
  const r = await 실행('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,bit_rate,nb_frames:format=duration', '-of', 'json', file], { cwd: 여기 });
  const j = JSON.parse(r.out);
  const v = j.streams.find((s) => s.codec_type === 'video');
  const a = j.streams.find((s) => s.codec_type === 'audio');
  return { 영상bps: Number(v?.bit_rate) || 0, 소리bps: Number(a?.bit_rate) || 0, 프레임: Number(v?.nb_frames) || 0, 길이: Number(j.format.duration) };
}

// 소리 마감 — tools/음량마감.mjs를 리미터 차례로 부른다. 성공하면 { LUFS, 봉우리dBFS, 리미터, 소리다시담기? }, 아니면 null(옛 video.mp4는 그대로).
//   봉우리가 −1.2 dBFS를 넘으면(AAC가 참 봉우리를 올린다 — 현장 노트 「봉우리가 −1.0으로 솟으면 --리미터 0.76」) 다음 리미터로,
//   음량 · 봉우리는 맞는데 AAC 실측만 320kbps 아래면 소리다시담기로(말 사이가 조용한 편).
const 리미터들 = [0.84, 0.76, 0.7];
async function 소리마감(날것, 영상, 로그) {
  // 음량마감은 출력이 없을 때 음량만 벗어난 판도 그 이름에 쓴다 — 끝내 미통과면 이번에 새로 생긴 video.mp4는 지운다(있던 판은 덮이지 않는다)
  const 있던 = fs.existsSync(영상);
  const 결과 = await 소리마감차례(날것, 영상, 로그);
  if (!결과 && !있던) fs.rmSync(영상, { force: true });
  return 결과;
}
async function 소리마감차례(날것, 영상, 로그) {
  for (const 리미터 of 리미터들) {
    const m = await 실행(process.execPath, [path.join(뿌리, 'tools', '음량마감.mjs'), 날것, 영상, '--덮어쓰기', '--json', '--리미터', String(리미터)], { cwd: 뿌리, 로그 });
    let r = null;
    try { r = JSON.parse(m.out.trim().split('\n').pop()); } catch { /* 아래에서 실패로 */ }
    const 검토 = r?.reviewPath && fs.existsSync(r.reviewPath) ? r.reviewPath : null;
    const 치우기 = () => { if (검토) fs.rmSync(path.dirname(검토), { recursive: true, force: true }); };
    if (m.code === 0 && r?.ok && r?.written) { 치우기(); return { LUFS: r.after.I, 봉우리dBFS: r.after.peak, 리미터 }; }
    const 음량맞음 = r?.after && r.window && r.after.I >= r.window[0] && r.after.I <= r.window[1] && r.after.peak <= r.ceiling;
    if (음량맞음 && r.bitrate && !r.bitrate.ok && 검토) {
      const 다시 = await 소리다시담기(검토, 영상, 로그, r);
      치우기();
      if (다시) return { LUFS: 다시.LUFS, 봉우리dBFS: 다시.봉우리dBFS, 리미터, 소리다시담기: 다시 };
    } else 치우기();
    fs.appendFileSync(로그, `\n[소리 마감] 리미터 ${리미터} 미통과 — ${r ? `${r.after?.I} LUFS / ${r.after?.peak} dBFS · AAC ${r.bitrate?.actualBps}` : '판정을 못 읽음'}\n`);
  }
  return null;
}

// AAC 하한 다시 담기 — 성공하면 { 소리kbps, LUFS, 봉우리dBFS }, 아니면 null(옛 video.mp4는 그대로)
const 소리하한 = 320000;
async function 소리다시담기(검토본, 영상, 로그, 마감) {
  const 임시 = 영상.replace(/\.mp4$/, '.aac.tmp.mp4');
  const e = await 실행('ffmpeg', ['-v', 'error', '-y', '-i', 검토본, '-map', '0:v', '-map', '0:a', '-c:v', 'copy', '-c:a', 'aac', '-aac_coder', 'twoloop', '-aac_ms', '0', '-aac_is', '0', '-aac_pns', '0', '-b:a', '384k', '-ar', '48000', '-movflags', '+faststart', 임시], { cwd: 여기, 로그 });
  if (e.code !== 0) return null;
  const { measure } = await import(pathToFileURL(path.join(뿌리, 'tools', '음량마감.mjs')).href);
  const 잰 = await measure(임시);
  const p = await ffprobe(임시);
  const 통과 = p.소리bps >= 소리하한 && 잰.I >= 마감.window[0] && 잰.I <= 마감.window[1] && 잰.peak <= 마감.ceiling;
  fs.appendFileSync(로그, `\n[소리 다시 담기] ${Math.round(p.소리bps / 1000)}kbps · ${잰.I} LUFS / ${잰.peak} dBFS → ${통과 ? '통과' : '미통과'}\n`);
  if (!통과) { fs.rmSync(임시, { force: true }); return null; }
  fs.renameSync(임시, 영상);
  return { 소리kbps: Math.round(p.소리bps / 1000), LUFS: 잰.I, 봉우리dBFS: 잰.peak, 방법: 'aac twoloop · ms · is · pns 끔 · 384k(현장 노트 11-05)' };
}

// 글 파일의 빈 칸(알림용) — 등록 여부는 Root(판본.ts 「빈칸」)가 정하고, 여기서는 무엇이 비었는지만 보인다
function 빈칸보기(file) {
  let j;
  try { j = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch (e) { return [`JSON을 못 읽음 — ${e.message}`]; }
  const 선택 = (k) => String(j._설명?.[k] ?? '').startsWith('(선택)');
  const out = [];
  for (const [k, v] of Object.entries(j)) {
    if (k.startsWith('_')) continue;
    if (typeof v === 'string' && !v.trim() && !선택(k)) out.push(k);
    if (Array.isArray(v) && !선택(k)) v.forEach((x, i) => { if (typeof x === 'string' && !x.trim()) out.push(`${k}[${i}]`); });
  }
  return out;
}

const 번들 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-판본번들-'));
let 실패 = 0;
try {
  console.log(`[판본] ${path.basename(여기)} — 번들 만드는 중…`);
  const 자산앞 = 자산재기();
  const b = await 리모션실행(['bundle', 'src/index.ts', '--out-dir', 번들]);
  if (b.code !== 0) throw Error(`번들 실패(종료 ${b.code})\n${b.out.slice(-2000)}`);
  // 번들은 이때의 public · src를 담는다 — 번들을 만드는 사이 자산이 바뀌었으면 어느 그림으로 굽는지 알 수 없으니 멈춘다
  const 자산 = 자산재기();
  if (자산.지문 !== 자산앞.지문) throw Error('번들을 만드는 사이 원본 자산(remotion public · src)이 바뀌었다 — 다시 돌린다');
  const c = await 리모션실행(['compositions', 번들, '--quiet']);
  if (c.code !== 0) throw Error(`컴포지션 목록 실패(종료 ${c.code})\n${c.out.slice(-2000)}`);
  const 등록 = new Set(c.out.split(/\s+/).filter((x) => x.startsWith(`${편.접두}-`)));
  const 할키 = [];
  const 빈키 = [];
  for (const k of 키들) {
    const 글 = path.join(판본폴더, `${k}.json`);
    if (!fs.existsSync(글)) { 빈키.push([k, `글 파일 없음(${rel(글)})`]); continue; }
    if (!등록.has(`${편.접두}-${k}`)) {
      const 빈 = 빈칸보기(글);
      빈키.push([k, `글이 아직 없다(빈 칸 ${빈.length}: ${빈.slice(0, 12).join(' · ')}${빈.length > 12 ? ' …' : ''})`]);
      continue;
    }
    할키.push(k);
    if (확인만) console.log(`  ${k}: 준비됨 — ${편.접두}-${k}`);
  }
  // 건너뛴 키 — 셋 이하이거나 --확인이면 키마다 빈 칸까지, 많으면 한 줄로
  if (빈키.length <= 3 || 확인만) for (const [k, 왜] of 빈키) console.log(`  ${k}: 건너뜀 — ${왜}`);
  else console.log(`  건너뜀 ${빈키.length}개(글이 아직 없다 — 빈 칸은 --확인으로 본다): ${빈키.map(([k]) => k).join(' · ')}`);
  if (!확인만 && !할키.length) console.log('  구울 판본이 없다.');

  for (const k of 확인만 ? [] : 할키) {
    const 컴 = `${편.접두}-${k}`;
    const 글 = path.join(판본폴더, `${k}.json`);
    const pack = JSON.parse(fs.readFileSync(글, 'utf8').replace(/^﻿/, ''));
    const 폴더 = path.join(낼곳, k);
    fs.mkdirSync(폴더, { recursive: true });
    const 영상 = path.join(폴더, 'video.mp4');
    const 표지 = path.join(폴더, 'cover.png');
    const 로그 = path.join(리모션, 'out', `판본_${k}.log`);
    fs.mkdirSync(path.dirname(로그), { recursive: true });
    fs.writeFileSync(로그, `${new Date().toISOString()} ${컴}\n`);
    const 기록 = { 판본: k, 컴포지션: 컴, 언어: pack.lang, 글: rel(글), 글sha256: sha(글), 시각: null, 영상: rel(영상), 표지: rel(표지), 표지초: pack.coverAt,
      // 준비.json 「돌림」.판본[KEY]에 옮길 꼴(편 폴더 기준 경로 — tools/돌림표.js 머리말). 「글」은 판본 글 원천이 아니라 지도가 뽑는 글.json이다 —
      // 원천(<판본폴더>/<키>.json)을 적어 주면 그 꼴을 준비.json에 옮긴 판본이 글 · 렌더 관문과 안 이어진다(11-11 밤 Fable 5.2 다시 검수 P1-렌1).
      // 지도가 있으면 tools/판본글잇기.js 「돌림」이 넣는 것과 같은 셈(판본잇기 돌림판본)으로 적는다. 뜻 검수 지문 = 글.json, 글자 검수 지문 = 영상sha256
      돌림판본: 잇기.있나(여기) ? 잇기.돌림판본(여기, k) : { 언어: pack.lang, 파일: `게시/판본/${k}/video.mp4`, 표지: `게시/판본/${k}/cover.png`, 글: `게시/판본/${k}/글.json` } };
    const t0 = Date.now();
    // 나라 인사(11-12) — 인사가 켜진 판본은 그 판본의 인사 그림 · 목소리 지문을 따로 적는다(공통 자산 지문 밖 — tools/lib/판본잇기.js 인사지문)
    const 인사지도 = 잇기.있나(여기) ? 잇기.지도읽기(여기).지도 : null;
    const 인사켜짐 = 인사지도 ? 잇기.인사초(인사지도, pack, k) : 0;
    const 인사 = 인사켜짐 ? 잇기.인사지문(여기, 인사지도, k) : null;
    if (인사켜짐 && !인사) { console.log(`  ${k}: 인사가 켜진 판본인데 인사 그림 · 목소리가 없다(${잇기.인사폴더(인사지도)}/${k}.*)`); 실패++; continue; }

    if (!표지만) {
      const 날것 = path.join(리모션, 'out', `판본_${k}.mp4`);
      console.log(`  ${k}: 렌더 중(${컴}) — 로그 ${rel(로그)}`);
      const r = await 리모션실행(['render', 번들, 컴, 날것, '--audio-bitrate', '384k'], 로그);
      if (r.code !== 0 || !fs.existsSync(날것) || fs.statSync(날것).mtimeMs < t0) { console.log(`  ${k}: 렌더 실패(종료 ${r.code}) — ${rel(로그)}`); 실패++; continue; }
      const 마감 = await 소리마감(날것, 영상, 로그);
      if (!마감) {
        console.log(`  ${k}: 음량 마감 미통과(리미터 ${리미터들.join(' · ')} 모두) — video.mp4를 만들지 않았다 · ${rel(로그)}`);
        실패++;
        continue;
      }
      기록.음량 = 마감;
      let p = await ffprobe(영상);
      if (p.영상bps < 낮은비트) {
        const 임시 = path.join(폴더, 'video.cbr.tmp.mp4');
        const e = await 실행('ffmpeg', ['-v', 'error', '-y', '-i', 영상, '-map', '0:v', '-map', '0:a', '-c:a', 'copy', '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-b:v', '10M', '-minrate', '10M', '-maxrate', '10M', '-bufsize', '10M', '-x264-params', 'nal-hrd=cbr', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', 임시], { cwd: 여기, 로그 });
        if (e.code !== 0) { console.log(`  ${k}: 고정 10Mbps 다시 담기 실패 — ${rel(로그)}`); 실패++; continue; }
        fs.renameSync(임시, 영상);
        기록.고정비트 = '10M(렌더가 8.5Mbps 아래)';
        p = await ffprobe(영상);
      }
      Object.assign(기록, { 길이초: p.길이, 프레임: p.프레임, 영상Mbps: +(p.영상bps / 1e6).toFixed(2), 소리kbps: Math.round(p.소리bps / 1000), 영상sha256: sha(영상),
        자산sha256: 자산.지문, 자산수: 자산.수, 구운때: new Date().toISOString() });
      if (인사) Object.assign(기록, { 인사sha256: 인사.지문, 인사초: 인사켜짐 });
    } else if (fs.existsSync(path.join(폴더, '렌더.json'))) {
      Object.assign(기록, JSON.parse(fs.readFileSync(path.join(폴더, '렌더.json'), 'utf8')), { 표지: rel(표지), 표지초: pack.coverAt });
    } else {
      // 렌더 기록 없이 표지만 뜬다 — 있는 영상이 어느 글 · 자산으로 구운 것인지 모르니 글 지문을 지금 글로 적지 않는다(돌림에 못 든다 — 다시 렌더)
      delete 기록.글sha256;
      기록.표지만 = '렌더 기록 없이 표지만 떴다 — 영상의 글 · 자산 지문 없음';
    }

    // 표지 — 마감한 video.mp4에서 그 프레임을 그대로 뽑는다(11-05 영어판 표지와 같은 방법 · -ss 대신 프레임 번호 — 현장 노트 「-ss로 뽑은 확인 프레임은 한두 장 밀린다」)
    if (!fs.existsSync(영상)) { console.log(`  ${k}: 표지 실패 — video.mp4가 없다(먼저 렌더)`); 실패++; continue; }
    const 표지프레임 = Math.max(0, Math.round(pack.coverAt * FPS));
    const s = await 실행('ffmpeg', ['-v', 'error', '-y', '-i', 영상, '-vf', `select=eq(n\\,${표지프레임})`, '-frames:v', '1', 표지], { cwd: 여기, 로그 });
    if (s.code !== 0 || !fs.existsSync(표지) || fs.statSync(표지).mtimeMs < t0) { console.log(`  ${k}: 표지 실패 — ${rel(로그)}`); 실패++; continue; }
    기록.표지프레임 = 표지프레임;
    기록.시각 = new Date().toISOString();
    fs.writeFileSync(path.join(폴더, '렌더.json'), JSON.stringify(기록, null, 2) + '\n');
    console.log(`  ${k}: 끝 — ${rel(영상)}${기록.영상Mbps ? ` · ${기록.영상Mbps}Mbps · ${기록.음량?.LUFS} LUFS / ${기록.음량?.봉우리dBFS} dBFS` : ''} · 표지 ${pack.coverAt}초 · ${Math.round((Date.now() - t0) / 1000)}초`);
  }
} catch (e) {
  console.error(`[판본] ${e.message}`);
  실패++;
} finally {
  fs.rmSync(번들, { recursive: true, force: true });
}
process.exit(실패 ? 1 : 0);
