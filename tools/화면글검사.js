#!/usr/bin/env node
'use strict';
/* 화면 글 검사(2026-11-23) — 짧은 SNS 영상의 화면 글이 읽을 만큼 머무는지, 한 편에 새 낱말이 너무 많지 않은지를 올리기 전에 잰다.
 * 판정과 문턱의 근거는 tools/lib/화면글판정.js 머리말, 관문 등급은 tools/lib/화면글관문.js(올리기 전 검사 ㉓). 영상 · 편 코드는 바꾸지 않는다.
 *
 *   node tools/화면글검사.js <편 폴더> [--영상 <영상 파일>]… [--틀 <composition id>] [--언어 mn] [--브랜드 LAB] [--json]
 *     --원본 <src 폴더>: 편 remotion/src 대신 그 폴더의 코드를 그린다(git archive로 꺼낸 옛 판 — 이미 나간 영상을 다시 잴 때). public은 편 것을 쓴다.
 *     --프레임저장 <폴더>: 영상마다 프레임 시간표 전체를 그 폴더에 JSON으로 남긴다(판정 문턱을 맞출 때 다시 그리지 않고 다시 판정하려고).
 *     --영상을 안 주면 준비.json 「최종본」의 첫 영상을 잰다. 여러 개를 주면 묶음을 한 번만 짓고 영상마다 잰다.
 *     끝 코드: 걸림 없음 0 · 걸림 있음 1 · 못 잼(원본 없음 · 렌더 실패 · 원본과 영상이 다름) 3 · 사용법 오류 2.
 *
 * 어떻게 재나 — 최종 영상에서 글자 인식으로 재지 않고, 그 영상을 만든 Remotion 원본을 다시 그려 화면 글을 그대로 읽는다:
 *   1) 편의 remotion/src를 공용 부품 자리(tools/새편.js 부품상태 — %LOCALAPPDATA%\synk\remotion-parts)의 Remotion으로 묶는다. 묶음 맨 앞에
 *      tools/lib/화면글주입.js를 끼워, 프레임을 다 그릴 때마다 보이는 글 덩이(글 · 자리 · 투명도 · 글자 크기 · 색)를 콘솔로 받는다.
 *      public은 임시 폴더에 걸고(하드 링크, 안 되면 복사) 빠진 브랜드 글꼴(docs/브랜드_폰트)을 채운다 — 편 폴더에 아무것도 쓰지 않는다.
 *   2) 영상 길이(±0.1초)가 같은 composition을 고른다. 여럿이면 언어 · 나라 이름(MN · CN · MM …)이 든 것, 그다음 scene · still이 아닌 것.
 *   3) 1/10초마다(30fps면 세 장마다) 원래 크기로 그려, 올릴 영상의 같은 프레임과 같은 방법(ffmpeg 넓이 평균)으로 줄여 견준다(회색, 장마다 밝기를
 *      직선으로 맞춘 뒤 108×192에서 장 전체 · 원본 글 자리 평균 차이, 216×384에서 반씩 겹친 8×8 칸 가운데 가장 큰 칸의 평균 차이).
 *      1/5 크기로 그리면 글자 테두리가 영상을 줄인 것과 달리 뭉개져 같은 원본도 칸 차이가 55까지 튀었다 — 원래 크기로 그리면 같은 원본 36편이 칸 최대 9 · 어긋난 장 0이다(11-23).
 *      MATCH_RATIO 넘게 맞아야 이 원본이 그 영상을 만든 것으로 보고 판정한다. 안 맞으면 다음 후보 composition을 해 보고, 끝내 안 맞으면 「못잼」이다 —
 *      영상을 뽑은 뒤 원본을 고쳤거나 편집에서 앞을 잘랐다는 뜻이다.
 * 왜 글자 인식이 아닌가(11-23 실측): 이 PC의 윈도우 글자 인식은 한국어 하나라 몽골 키릴을 못 읽고, 0.1초 간격으로 물개 v14를 읽혀 보니 3초 떠 있는
 *   큰 「물」을 0.4초로, 배경이 움직이는 1.5초 동안의 글을 통째로 놓쳤다. 원본을 다시 그리면 모든 문자를 1/10초 단위로 정확히 안다.
 * 못 보는 것: 그림 · 영상에 구워 넣은 글, overflow로 가린 글(타자 치듯 드러냄), Remotion이 아닌 편. 이런 편은 「못잼」으로 알린다.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const 판정 = require('./lib/화면글판정.js');

const REPO = path.resolve(__dirname, '..');
const INJECT = path.join(__dirname, 'lib', '화면글주입.js');
const FONTS = path.join(REPO, 'docs', '브랜드_폰트');
const TARGET_STEP = 0.1;
const THUMB = { w: 108, h: 192 }; // 장 전체 · 원본 글 자리 평균을 재는 크기
const FINE = { w: 216, h: 384 }; // 칸 검사 크기(1080×1920의 1/5). 108×192에서는 영상에만 구운 48px 가는 자막이 칸 12로 묻혔다(GPT 검수 다시 GA6)
const MATCH_DIFF = 12; // 장 전체 회색(0~255) 평균 차이 문턱(밝기를 직선으로 맞춘 뒤, 108×192). 같은 렌더는 장마다 6 아래, 글 하나를 0.8초 늦춘 원본은 그 사이 21(11-23 물개 실측)
const MATCH_TEXT_DIFF = 12; // 글 자리만의 평균 차이 문턱 — 같은 실측
const RUN_MAX = 1; // 안 맞는 장이 이만큼(0.1초) 넘게 잇달면 그 사이 글 · 장면이 다르다. 원래 크기로 그린 같은 원본 36편은 어긋난 장이 0이었다(11-23) —
// 원본에서 0.9초로 늘린 글이 영상에서 0.7초인 판(두 장 어긋남)을 놓치지 않게 낮췄다(설계 검토 7)
const BLOCK = 8; // 칸 크기(216×384 그림의 8×8 — 1080 폭으로 40px)
const BLOCK_DIFF = 12; // 칸 하나의 평균 차이 문턱(216×384 · 반씩 겹친 8×8 칸) — 영상에만 구운 자막을 잡는다(GPT 검수 GA1 · 다시 GA6 · 3회차 GA1 · GA9).
// 11-23 실측(원래 크기 렌더): 같은 원본 36편(LAB 27 · synkbrief 5 · yuhobuilds 4)은 칸 최대 9.
// 물개 v14에 0.6초 구운 Arial 가는 자막은 24px 15~16 · 30px 23~24 · 36px 31~32로 6장 잇달아 「못잼」이다. 원본 글 상자 안에 얹은 자막도 같은 칸으로 잡는다
const MATCH_RATIO = 0.85;
const DUR_TOL = 0.1;

const 빗금 = (p) => String(p).split(path.sep).join('/');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); }

function 편날짜(dir) { return (path.basename(dir).match(/_(\d{8})$/) || [])[1] || null; }

/** 편 폴더 → { src, public, entry, version } 또는 null. 다른src를 주면 그 폴더의 코드를 쓴다(git에서 꺼낸 옛 판 원본 — public은 편 것) */
function 원본찾기(편, 다른src = null) {
  const root = path.join(편, 'remotion');
  const src = 다른src ? path.resolve(다른src) : path.join(root, 'src');
  const entry = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'].map((f) => path.join(src, f)).find((f) => fs.existsSync(f));
  if (!entry) return null;
  let version = null;
  try { version = readJson(path.join(root, 'package.json')).dependencies?.remotion || null; } catch { /* 없다 */ }
  return { root, src, entry, public: path.join(root, 'public'), version };
}

/** 부품 자리의 node_modules — 편의 remotion 판이 든 열쇠 폴더를 먼저, 없으면 새편.js가 지금 까는 자리 */
function 부품찾기(version) {
  const 새편 = require('./새편.js');
  const 자리 = 새편.부품자리();
  const 후보 = [];
  try {
    for (const n of fs.readdirSync(자리)) {
      const m = path.join(자리, n, 'node_modules');
      if (!/^remotion-/.test(n) || !fs.existsSync(path.join(m, '@remotion', 'renderer', 'package.json')) || !fs.existsSync(path.join(m, '@remotion', 'bundler', 'package.json'))) continue;
      후보.push({ n, m, t: fs.statSync(path.join(자리, n)).mtimeMs });
    }
  } catch { /* 자리 없음 */ }
  if (!후보.length) return null;
  const 같은판 = version ? 후보.filter((c) => c.n.startsWith(`remotion-${version}-`)) : [];
  const 고름 = (같은판.length ? 같은판 : 후보).sort((a, b) => b.t - a.t)[0];
  return 고름.m;
}

function 영상정보(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate:format=duration', '-of', 'json', file], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`ffprobe 실패: ${String(r.stderr).trim().slice(0, 200)}`);
  const j = JSON.parse(r.stdout);
  const s = (j.streams || [])[0] || {};
  const [a, b] = String(s.r_frame_rate || '30/1').split('/').map(Number);
  return { 길이: Number(j.format?.duration) || 0, fps: b ? a / b : a, 폭: s.width, 높이: s.height };
}

/** 영상의 0 · every · 2×every … 번째 프레임(원본 fps 기준)을 작은 회색 그림으로 — Buffer(FINE.w×FINE.h) 목록.
 *  영상 fps가 원본과 다르면 같은 시각의 프레임을 고른다 */
function 영상작은그림(file, every, fps, info) {
  const pick = Math.abs(info.fps - fps) < 0.01 ? `select='not(mod(n\\,${every}))'` : `fps=${(fps / every).toFixed(6)}:round=near`;
  const r = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-i', file, '-vf', `${pick},scale=${FINE.w}:${FINE.h}:flags=area,format=gray`, '-fps_mode', 'passthrough', '-f', 'rawvideo', '-'], { windowsHide: true, maxBuffer: 1024 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg 실패: ${String(r.stderr).trim().slice(0, 200)}`);
  const n = FINE.w * FINE.h;
  const out = [];
  for (let i = 0; i + n <= r.stdout.length; i += n) out.push(r.stdout.subarray(i, i + n));
  return out;
}

/** 그리기가 폴더에 쓴 원래 크기 JPEG들(f00000.jpg …, 프레임 차례) → 작은 회색 그림 목록. 영상과 같은 ffmpeg 넓이 평균으로 줄인다 */
function 그림작은그림(dir) {
  const r = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-i', path.join(dir, 'f%05d.jpg'), '-vf', `scale=${FINE.w}:${FINE.h}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { windowsHide: true, maxBuffer: 1024 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg 실패: ${String(r.stderr).trim().slice(0, 200)}`);
  const n = FINE.w * FINE.h;
  const out = [];
  for (let i = 0; i + n <= r.stdout.length; i += n) out.push(r.stdout.subarray(i, i + n));
  return out;
}

/** FINE 그림 → THUMB 그림(2×2 평균 — 1080에서 곧장 1/10로 줄인 것과 같다) */
function 줄이기(b) {
  const out = new Uint8Array(THUMB.w * THUMB.h);
  for (let y = 0; y < THUMB.h; y++) for (let x = 0; x < THUMB.w; x++) {
    const i = 2 * y * FINE.w + 2 * x;
    out[y * THUMB.w + x] = Math.round((b[i] + b[i + 1] + b[i + FINE.w] + b[i + FINE.w + 1]) / 4);
  }
  return out;
}

/** 렌더 그림(a)과 영상(b)의 밝기를 장마다 직선으로 맞춘다(b ≈ k·a + c) — 렌더 JPEG와 영상 부호화의 밝기 범위(0~255와 16~235)가 달라
 *  같은 장면도 평균 7~13 차이가 났다(11-23 물개 실측). 맞춘 뒤 남은 차이만 잰다 */
function 밝기맞춤(a, b) {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let cov = 0, va = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma; cov += da * (b[i] - mb); va += da * da; }
  const k = va > 0 ? Math.min(1.5, Math.max(0.5, cov / va)) : 1;
  return { k, c: mb - k * ma };
}

function 평균차(a, b, mask, fit = { k: 1, c: 0 }) {
  let s = 0, n = 0;
  for (let i = 0; i < a.length; i++) {
    if (mask && !mask[i]) continue;
    s += Math.abs(b[i] - (fit.k * a[i] + fit.c)); n++;
  }
  return n ? s / n : 0;
}

/** 글 자리 — 시간표의 모든 글 덩이 상자를 작은 그림 칸으로 합친 판(1 = 글이 뜨는 자리). 렌더 뒤 글 시간만 고친 원본을 가르려고 쓴다 */
function 글자리(frames, comp) {
  const mask = new Uint8Array(THUMB.w * THUMB.h);
  const sx = THUMB.w / (comp.width || 1080), sy = THUMB.h / (comp.height || 1920);
  for (const fr of frames) for (const it of fr.items || []) {
    if (!((it.o ?? 1) >= 판정.VISIBLE) || !/\p{L}/u.test(it.t || '') || !it.b) continue;
    const x0 = Math.max(0, Math.floor(it.b[0] * sx) - 1), x1 = Math.min(THUMB.w - 1, Math.ceil(it.b[2] * sx));
    const y0 = Math.max(0, Math.floor(it.b[1] * sy) - 1), y1 = Math.min(THUMB.h - 1, Math.ceil(it.b[3] * sy));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) mask[y * THUMB.w + x] = 1;
  }
  return mask.some(Boolean) ? mask : null;
}

/** 칸마다 평균 차이의 가장 큰 값 — 원본에 없는 글이 영상에만 있으면 그 칸이 튄다. 칸은 반씩 겹쳐 옮긴다(작은 자막이 칸 경계에 걸쳐 둘로 나뉘면
 *  36px 자막도 25~27에 그쳤다 — 겹치면 33~34, 11-23 물개 v14 실측) */
function 칸최대(a, b, fit) {
  let max = 0;
  const 걸음 = BLOCK / 2;
  for (let by = 0; by + BLOCK <= FINE.h; by += 걸음) for (let bx = 0; bx + BLOCK <= FINE.w; bx += 걸음) {
    let s = 0, n = 0;
    for (let y = by; y < by + BLOCK; y++) for (let x = bx; x < bx + BLOCK; x++) {
      const i = y * FINE.w + x;
      s += Math.abs(b[i] - (fit.k * a[i] + fit.c)); n++;
    }
    max = Math.max(max, s / n);
  }
  return max;
}

/** 견주기 — 그림들 · 영상들은 FINE 크기. 장마다 THUMB로 줄여 전체 차이 · 글 자리(mask, THUMB) 차이를, FINE 그대로 칸 최대 차이를 잰다.
 *  셋 다 문턱 안이면 맞는 장. 안 맞는 장이 잇달아 RUN_MAX 넘으면 그 사이 글이나 장면이 다르다 */
function 견주기(그림들, 영상들, mask = null) {
  const n = Math.min(그림들.length, 영상들.length);
  const 전체 = [], 글 = [], 칸 = [];
  for (let i = 0; i < n; i++) {
    const a = 줄이기(그림들[i]), b = 줄이기(영상들[i]);
    const fit = 밝기맞춤(a, b);
    전체.push(평균차(a, b, null, fit));
    글.push(mask ? 평균차(a, b, mask, fit) : 0);
    칸.push(칸최대(그림들[i], 영상들[i], 밝기맞춤(그림들[i], 영상들[i])));
  }
  const 맞는장 = 전체.map((d, i) => d <= MATCH_DIFF && 글[i] <= MATCH_TEXT_DIFF && 칸[i] <= BLOCK_DIFF);
  const 맞음 = 맞는장.filter(Boolean).length;
  let run = 0, 가장긴 = 0;
  for (const ok of 맞는장) { run = ok ? 0 : run + 1; 가장긴 = Math.max(가장긴, run); }
  const 가운데 = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? Math.round(s[Math.floor(s.length / 2)] * 10) / 10 : null; };
  const 비율 = n ? Math.round((맞음 / n) * 1000) / 1000 : 0;
  return {
    장수: n, 그림수: 그림들.length, 영상수: 영상들.length, 맞음, 비율, 가장긴어긋남: 가장긴, 가운데차: 가운데(전체), 글가운데차: 가운데(글),
    통과: n > 0 && Math.abs(그림들.length - 영상들.length) <= 1 && 비율 >= MATCH_RATIO && 가장긴 <= RUN_MAX,
    차이: 글.map((d, i) => Math.round(Math.max(d, 전체[i]))), 칸차이: 칸.map((d) => Math.round(d)), 칸가운데: 가운데(칸),
  };
}

function 링크복사(from, to) {
  if (!fs.existsSync(from)) return;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) { fs.mkdirSync(b, { recursive: true }); 링크복사(a, b); continue; }
    try { fs.linkSync(a, b); } catch { fs.copyFileSync(a, b); }
  }
}

function 임시public(src, dir) {
  fs.mkdirSync(dir, { recursive: true });
  링크복사(src, dir);
  const fonts = path.join(dir, 'fonts');
  fs.mkdirSync(fonts, { recursive: true });
  try {
    for (const d of fs.readdirSync(FONTS, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      for (const f of fs.readdirSync(path.join(FONTS, d.name))) {
        if (/\.(ttf|otf|woff2?)$/i.test(f) && !fs.existsSync(path.join(fonts, f))) fs.copyFileSync(path.join(FONTS, d.name, f), path.join(fonts, f));
      }
    }
  } catch { /* 글꼴 폴더가 없으면 편 public 그대로 */ }
}

/** 언어 · 나라 힌트로 composition 후보 차례를 정한다 */
function 후보들(comps, info, 힌트 = []) {
  const ok = comps.filter((c) => Math.abs(c.durationInFrames / c.fps - info.길이) <= DUR_TOL && (!info.폭 || !c.width || Math.abs(c.width / c.height - info.폭 / info.높이) < 0.02));
  const re = 힌트.filter(Boolean).map((h) => new RegExp(`(^|[-_])${String(h).replace(/[^A-Za-z0-9]/g, '')}($|[-_])`, 'i'));
  const 점수 = (c) => (re.some((r) => r.test(c.id)) ? 0 : 2) + (/scene|still|thumb|music|cover|only/i.test(c.id) ? 1 : 0);
  return ok.sort((a, b) => 점수(a) - 점수(b));
}

/** 언어 코드 → 초당 글자(언어프로필.json) */
function 모국어초당(언어) {
  try {
    const p = require('./lib/현지화프로필.js').언어(언어);
    const v = p?.읽기속도?.초당글자;
    return v > 0 ? v : null;
  } catch { return null; }
}

/** 편 · 영상에서 보는 사람의 말을 짐작한다 — 판 「언어」, 폴더 이름의 _mn_, 그 밖 LAB은 en */
function 언어짐작(편, file, 브랜드) {
  try {
    const prep = readJson(path.join(편, '게시', '준비.json'));
    const rel = 빗금(path.relative(REPO, path.resolve(file)));
    for (const p of [].concat(prep.판 || [])) {
      const f = String(p.원본 || p.파일 || '');
      if (f && (rel === f || rel.endsWith(f) || path.basename(path.dirname(rel)) === path.basename(path.dirname(f))) && p.언어) return String(p.언어);
    }
  } catch { /* 없다 */ }
  const dirName = path.basename(path.dirname(file)).toLowerCase();
  const m = dirName.match(/-(mn|en|cn|mm|vi|ru|ky|kk|uz|ja|th|km|ne|hi|id|ms|si|es|pt)$/);
  if (m) return { cn: 'zh-Hans', mm: 'my', pt: 'pt-BR' }[m[1]] || m[1];
  if (/_mn_/.test(path.basename(편))) return 'mn';
  return 브랜드 === 'LAB' ? 'en' : 'ko';
}
const 나라힌트 = (언어) => ({ mn: ['MN', 'mn'], 'zh-Hans': ['CN', 'cn', 'zh'], my: ['MM', 'mm', 'my'], en: ['en', 'EN', 'US'], ko: ['ko', 'KR'] }[언어] || [언어]);

/** 원본 지문 — remotion/src의 모든 파일과 public 목록(이름 · 크기) */
function 원본지문(원본) {
  const h = crypto.createHash('sha256');
  const walk = (dir, withContent) => {
    let es = [];
    try { es = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)); } catch { return; }
    for (const e of es) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p, withContent); continue; }
      h.update(빗금(path.relative(원본.root, p)));
      if (withContent) h.update(fs.readFileSync(p)); else h.update(String(fs.statSync(p).size));
    }
  };
  walk(원본.src, true);
  walk(원본.public, false);
  return h.digest('hex').slice(0, 16);
}

async function 묶기(R, 원본, 일터) {
  const { bundle } = require(path.join(R.모듈, '@remotion', 'bundler'));
  const pub = path.join(일터, 'public');
  임시public(원본.public, pub);
  return bundle({
    entryPoint: 원본.entry,
    publicDir: pub,
    outDir: path.join(일터, 'bundle'),
    enableCaching: false,
    webpackOverride: (c) => {
      c.resolve = c.resolve || {};
      c.resolve.modules = [...(c.resolve.modules || ['node_modules']), R.모듈];
      c.resolveLoader = c.resolveLoader || {};
      c.resolveLoader.modules = [...(c.resolveLoader.modules || ['node_modules']), R.모듈];
      if (Array.isArray(c.entry)) c.entry = [INJECT, ...c.entry];
      else if (typeof c.entry === 'string') c.entry = [INJECT, c.entry];
      else if (c.entry && typeof c.entry === 'object') for (const k of Object.keys(c.entry)) c.entry[k] = [INJECT, ...[].concat(c.entry[k])];
      return c;
    },
  });
}

async function 브라우저열기(R) {
  const { openBrowser } = require(path.join(R.모듈, '@remotion', 'renderer'));
  const exe = path.join(R.모듈, '.remotion', 'chrome-headless-shell', process.platform === 'win32' ? 'win64' : 'linux64', process.platform === 'win32' ? 'chrome-headless-shell-win64' : 'chrome-headless-shell-linux64', process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell');
  const opts = { logLevel: 'error', ...(fs.existsSync(exe) ? { browserExecutable: exe } : {}) };
  try { return await openBrowser('chrome', opts); } catch (e) {
    // 다른 회차의 헤드리스 크롬이 몰리면 25초 안에 못 붙는 일이 있다(11-23 두 번) — 한 번 더 붙는다
    if (!/connect to the browser|Timed out/i.test(String(e.message))) throw e;
    return openBrowser('chrome', opts);
  }
}

/** composition 하나를 원래 크기로 그리며 프레임마다 글 덩이를 받고, JPEG는 dir에 바로 쓴다(긴 편도 메모리에 쌓지 않는다).
 *  다 그린 뒤 프레임 차례로 f00000.jpg …로 이름을 고친다 */
async function 그리기(R, browser, serveUrl, comp, dir) {
  const { renderFrames } = require(path.join(R.모듈, '@remotion', 'renderer'));
  const every = Math.max(1, Math.round(comp.fps * TARGET_STEP));
  const frames = new Map();
  const 그린장 = [];
  const errors = [];
  fs.mkdirSync(dir, { recursive: true });
  await renderFrames({
    composition: comp, serveUrl, inputProps: comp.props || {}, outputDir: null, imageFormat: 'jpeg', jpegQuality: 90, scale: 1,
    everyNthFrame: every, concurrency: 1, puppeteerInstance: browser, logLevel: 'error',
    onStart: () => {}, onFrameUpdate: () => {},
    onFrameBuffer: (buf, frame) => { fs.writeFileSync(path.join(dir, `raw-${frame}.jpg`), buf); 그린장.push(frame); },
    onBrowserLog: (log) => {
      const s = String(log.text || '');
      if (s.startsWith('__SYNK_TEXT__')) { try { const j = JSON.parse(s.slice(13)); frames.set(j.f, j); } catch { /* 깨진 줄 */ } }
      else if (s.startsWith('__SYNK_TEXT_ERR__')) errors.push(s.slice(17));
    },
  });
  const order = [...new Set(그린장)].sort((a, b) => a - b);
  order.forEach((f, i) => fs.renameSync(path.join(dir, `raw-${f}.jpg`), path.join(dir, `f${String(i).padStart(5, '0')}.jpg`)));
  return { every, frames: [...frames.values()].sort((a, b) => a.f - b.f), order, dir, errors };
}

/**
 * 후보 composition을 차례로 해 본다 — 그림이 영상과 맞고 글 기록이 온전한 첫 후보를 고른다. 한 후보의 렌더 오류 · 글 기록 빠짐은 다음 후보를
 * 막지 않는다(GPT 검수 다시 GA1 · GA9). 해보기(comp) → { 대조, g, 기록(글 기록이 온전하지 않으면 까닭) } 또는 던짐.
 * → { 고른: { comp, 대조, g } | null, 시도, 까닭 }. 못 고르면 렌더 오류가 하나라도 있을 때 「렌더하다 멈췄다」(관문이 다음에 다시 잰다),
 *   그다음 그림은 맞았는데 글 기록이 온전하지 않은 후보의 까닭, 그 밖은 「안 맞는다」다.
 */
async function 후보고르기(차례, 해보기, 남은후보 = []) {
  const 시도 = [];
  for (const comp of 차례) {
    let r;
    // 오류 문구의 첫 줄이 비어도 빈 문자열로 남기지 않는다(GPT 다시 검수 3회차 GA7)
    try { r = await 해보기(comp); } catch (e) { 시도.push({ 틀: comp.id, 오류: (String((e && e.message) || e || '').split('\n').map((x) => x.trim()).find(Boolean) || '알 수 없는 렌더 오류').slice(0, 200) }); continue; }
    시도.push({ 틀: comp.id, ...r.대조, ...(r.기록 ? { 기록: r.기록 } : {}) });
    if (r.대조.통과 && !r.기록) return { 고른: { comp, 대조: r.대조, g: r.g }, 시도, 까닭: null };
  }
  const 오류 = 시도.find((x) => x.오류 !== undefined);
  // 글 기록 빠짐 · 주입 오류(한 번 일어난 일일 수 있어 관문이 다시 잰다)를 글을 하나도 못 읽음(남긴다)보다 먼저 고른다(3회차 GA10)
  const 기록 = 시도.find((x) => x.기록 && !/하나도 못 읽었다/.test(x.기록)) || 시도.find((x) => x.기록);
  const 대조들 = 시도.filter((x) => !x.오류).map((x) => `${x.틀} ${Math.round(x.비율 * 100)}% · 가운데 차 ${x.가운데차}`).join(' / ');
  let 까닭;
  if (오류) 까닭 = `렌더하다 멈췄다: ${오류.틀} — ${오류.오류}${대조들 ? ` (그린 후보: ${대조들})` : ''}`;
  else if (기록) 까닭 = 기록.기록;
  // 그리지 않은 후보가 남았으면 「안 맞는다」로 단정하지 않는다 — 관문이 기록에 남기지 않고 다음에 다시 잰다(설계 검토 5)
  else if (남은후보.length) 까닭 = `그린 후보 ${시도.length}개가 영상과 안 맞고 길이가 같은 후보 ${남은후보.length}개(${남은후보.map((c) => c.id).join(' · ')})는 그리지 않았다 — --틀 <composition>으로 골라 다시 잰다`;
  else 까닭 = `원본을 다시 그린 그림이 영상과 안 맞는다(${대조들}) — 영상을 뽑은 뒤 원본을 고쳤는지, 편집에서 앞을 잘랐는지 본다`;
  return { 고른: null, 시도, 까닭 };
}

/**
 * 한 편을 잰다. opts: { 영상: [파일…], 틀, 언어, 브랜드 } → { 꼴, 편, 원본지문, 결과: [영상마다 { 영상, 틀, 언어, 대조, 판정…, 못잼 }] }
 */
async function 검사(편, opts = {}) {
  편 = path.resolve(편);
  let prep = {};
  try { prep = readJson(path.join(편, '게시', '준비.json')); } catch { /* 없다 */ }
  const 브랜드 = opts.브랜드 || prep.브랜드 || (path.basename(편).split('_')[0]);
  let 영상들 = [].concat(opts.영상 || []).filter(Boolean).map((f) => path.resolve(f));
  if (!영상들.length) {
    const first = [].concat(prep.최종본 || []).find((v) => typeof v === 'string' && v.trim());
    if (first) 영상들 = [path.resolve(REPO, first)];
  }
  const out = { 꼴: '화면글검사/1', 편: 빗금(path.relative(REPO, 편)), 브랜드, 잰때: new Date().toISOString(), 결과: [] };
  const 못 = (영상, 까닭) => ({ 영상: 영상 ? 빗금(path.relative(REPO, 영상)) : null, 못잼: 까닭 });
  if (!영상들.length) { out.결과.push(못(null, '잴 영상이 없다(--영상 또는 준비.json 「최종본」)')); return out; }
  const 원본 = 원본찾기(편, opts.원본);
  if (!원본) { for (const v of 영상들) out.결과.push(못(v, 'Remotion 원본(remotion/src/index.*)이 없다 — 화면 글 시간을 눈으로 본다')); return out; }
  out.원본지문 = 원본지문(원본);
  const 모듈 = 부품찾기(원본.version);
  if (!모듈) { for (const v of 영상들) out.결과.push(못(v, 'Remotion 부품 자리가 없다 — node tools/새편.js로 부품을 깐 뒤 다시')); return out; }
  const R = { 모듈 };
  const 일터 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-textcheck-'));
  let browser = null;
  let 그린수 = 0;
  try {
    const serveUrl = await 묶기(R, 원본, 일터);
    browser = await 브라우저열기(R);
    const { getCompositions } = require(path.join(R.모듈, '@remotion', 'renderer'));
    const comps = await getCompositions(serveUrl, { puppeteerInstance: browser, logLevel: 'error' });
    for (const file of 영상들) {
      if (!fs.existsSync(file)) { out.결과.push(못(file, '영상 파일이 없다')); continue; }
      // 영상 하나의 렌더 오류가 뒤 영상을 막지 않는다(GPT 검수 GA5) — 묶기 · 브라우저 · composition 읽기만 편 전체 오류다
      try {
        const info = 영상정보(file);
        const 언어 = opts.언어 || 언어짐작(편, file, 브랜드);
        let 차례 = opts.틀 ? comps.filter((c) => c.id === opts.틀) : 후보들(comps, info, 나라힌트(언어));
        if (!차례.length) { out.결과.push({ ...못(file, `영상 길이 ${info.길이.toFixed(2)}초와 같은 composition이 없다(${comps.map((c) => `${c.id} ${(c.durationInFrames / c.fps).toFixed(2)}초`).join(' · ')})`) }); continue; }
        const 남은후보 = 차례.slice(3);
        차례 = 차례.slice(0, 3);
        // 글 기록이 그린 장마다 다 있어야 판정한다 — 빠진 장을 글이 사라진 것으로 읽어 짧은 머묾을 지어내지 않게(GPT 검수 GA2)
        const { 고른, 시도, 까닭 } = await 후보고르기(차례, async (comp) => {
          const g = await 그리기(R, browser, serveUrl, comp, path.join(일터, `thumb-${++그린수}-${comp.id}`));
          const 그림 = 그림작은그림(g.dir);
          const 영상그림 = 영상작은그림(file, g.every, comp.fps, info);
          const 대조 = 견주기(그림, 영상그림, 글자리(g.frames, comp));
          return { 대조, g, 기록: 대조.통과 ? 기록확인(g) : null };
        }, 남은후보);
        if (!고른) { out.결과.push({ ...못(file, 까닭), 시도 }); continue; }
        const { comp, g, 대조 } = 고른;
        const 시간표 = { fps: comp.fps, step: g.every / comp.fps, 길이: comp.durationInFrames / comp.fps, frames: g.frames };
        if (opts.프레임저장) {
          fs.mkdirSync(opts.프레임저장, { recursive: true });
          fs.writeFileSync(path.join(opts.프레임저장, `${빗금(path.relative(REPO, file)).replace(/[\/:]/g, '__')}.json`), JSON.stringify({ 편: out.편, 영상: 빗금(path.relative(REPO, file)), 브랜드, 언어, 틀: comp.id, 시간표 }));
        }
        const { r, 목표어, cps } = 판정하기(시간표, 브랜드, 언어);
        out.결과.push({
          영상: 빗금(path.relative(REPO, file)), 틀: comp.id, 언어, 모국어초당: cps, 목표어,
          대조: { ...대조, 시도 }, 걸림: r.걸림, 낱말: r.낱말, 핵심: r.핵심, 요약: r.요약,
          시간표: 압축(r.나타남),
        });
      } catch (e) {
        out.결과.push(못(file, `렌더하다 멈췄다: ${String(e && e.message || e).split('\n')[0].slice(0, 300)}`));
      }
    }
  } catch (e) {
    const msg = String(e && e.message || e).split('\n')[0].slice(0, 300);
    for (const v of 영상들) if (!out.결과.some((x) => x.영상 === 빗금(path.relative(REPO, v)))) out.결과.push(못(v, `렌더하다 멈췄다: ${msg}`));
  } finally {
    if (browser) { try { await browser.close({ silent: true }); } catch { /* 이미 닫힘 */ } }
    fs.rmSync(일터, { recursive: true, force: true });
  }
  return out;
}

/** 그린 장마다 글 기록이 있고, 편 전체에 읽은 글이 하나라도 있는가 — 문제면 못잼 까닭, 괜찮으면 null */
function 기록확인(g) {
  const 있는장 = new Set(g.frames.map((x) => x.f));
  const 빠짐 = g.order.filter((f) => !있는장.has(f));
  if (g.errors.length) return `주입 스크립트가 오류를 냈다(${g.errors[0].slice(0, 120)}) — 화면 글을 눈으로 본다`;
  if (빠짐.length) return `그린 ${g.order.length}장 가운데 ${빠짐.length}장의 글 기록이 없다(처음 빠진 장 ${빠짐[0]}) — Remotion 판이 바뀌어 주입이 안 걸렸을 수 있다. 화면 글을 눈으로 본다`;
  if (!g.frames.some((x) => (x.items || []).some((it) => /\p{L}/u.test(it.t || '')))) return '원본에서 화면 글을 하나도 못 읽었다 — 글을 그림 · 영상에 구워 넣은 편이면 머무는 시간을 눈으로 본다';
  return null;
}

/** 브랜드 · 말에 맞춘 판정 — LAB은 한국어를 배우는 말로(초당 6자, 최소 1.2초, 낱말 셈), 그 밖은 한국 사람이 보는 모국어 자막(초당 12자, 최소 5/6초) */
function 판정하기(시간표, 브랜드, 언어) {
  const 목표어 = 브랜드 === 'LAB';
  const cps = 목표어 ? (모국어초당(언어) || 판정.DEFAULT_L1_CPS) : 판정.KO_L1_CPS;
  const r = 판정.판정(시간표, { 목표어, 낱말세기: 목표어, 모국어초당: cps, 최소머묾: 목표어 ? 판정.MIN_DWELL : 판정.PACE });
  return { r, 목표어, cps };
}

// 기록에 남길 시간표 — 새 글만, 글 · 시작 · 머묾
const 압축 = (목록) => 목록.filter((a) => a.처음).map((a) => [a.글, a.시작, a.머묾]);

function 글로(out) {
  const lines = [];
  for (const r of out.결과) {
    if (r.못잼) { lines.push(`화면 글 검사 · ${r.영상 || out.편}: 못 잼 — ${r.못잼}`); continue; }
    const 심함 = r.걸림.filter((h) => h.심함).length;
    lines.push(`화면 글 검사 · ${r.영상} (${r.틀}, ${r.언어}, 원본 대조 ${Math.round(r.대조.비율 * 100)}%): 걸림 ${r.걸림.length}(심함 ${심함}) · 새 글 ${r.요약.새글} · 가장 짧은 새 글 ${r.요약.가장짧은새글}초${r.목표어 ? ` · 가르치는 낱말 ${r.낱말.length}개(${r.낱말.map((x) => x.낱말).join(' · ')})` : ''}`);
    if (r.핵심.length) lines.push(`  답 · 뜻풀이: ${r.핵심.map((k) => `「${k.글}」 ${k.머묾}초`).join(' · ')}`);
    for (const h of r.걸림) lines.push(`  ${h.심함 ? '심함' : '    '} ${h.항목} ${h.설명}`);
  }
  return lines.join('\n');
}

function 인자읽기(argv) {
  const o = { 영상: [], json: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--영상') o.영상.push(argv[++i]);
    else if (a === '--틀') o.틀 = argv[++i];
    else if (a === '--언어') o.언어 = argv[++i];
    else if (a === '--브랜드') o.브랜드 = argv[++i];
    else if (a === '--원본') o.원본 = argv[++i];
    else if (a === '--프레임저장') o.프레임저장 = argv[++i];
    else if (a.startsWith('--')) return { 오류: `모르는 옵션 ${a}` };
    else rest.push(a);
  }
  if (rest.length !== 1) return { 오류: '편 폴더 하나를 준다' };
  o.편 = rest[0];
  return o;
}

if (require.main === module) {
  const o = 인자읽기(process.argv.slice(2));
  if (o.오류) {
    console.error(`${o.오류}\n사용: node tools/화면글검사.js <편 폴더> [--영상 <영상>]… [--원본 <src 폴더>] [--틀 <composition>] [--언어 mn] [--브랜드 LAB] [--프레임저장 <폴더>] [--json]`);
    process.exit(2);
  }
  검사(o.편, o).then((out) => {
    if (o.json) console.log(JSON.stringify(out));
    else console.log(글로(out));
    const 못잼 = out.결과.some((r) => r.못잼);
    const 걸림 = out.결과.some((r) => (r.걸림 || []).length);
    process.exit(못잼 ? 3 : 걸림 ? 1 : 0);
  }).catch((e) => { console.error(e); process.exit(3); });
}

module.exports = { THUMB, FINE, 검사, 판정하기, 기록확인, 원본찾기, 부품찾기, 후보들, 견주기, 글자리, 언어짐작, 원본지문, 글로, MATCH_DIFF, MATCH_TEXT_DIFF, MATCH_RATIO, RUN_MAX, BLOCK_DIFF, DUR_TOL, 편날짜, 후보고르기 };
