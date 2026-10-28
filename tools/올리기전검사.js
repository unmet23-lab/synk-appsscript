#!/usr/bin/env node
'use strict';
/* 올리기 전 검사(2026-10-21) — 1일 1편 편 폴더 하나의 올릴 묶음을 명령 하나로 본다. 영상·글은 바꾸지 않는다.
 *
 *   node tools/올리기전검사.js <편 폴더> [--json] [--저장안함] [--링크건너뛰기] [--글자인식건너뛰기]
 *
 * 묶은 검사(게시/준비.json의 판마다, 같은 영상 파일은 한 번):
 *   ① 영상사전검사(tools/영상사전검사.mjs) — 디코드·프레임 시각·소리 길이, 올림 화질(1080 이상이면 8Mbps·H.264·yuv420p, v2 §2-4)
 *   ② 정지 구간(tools/정지구간.js) — 거의 멈춘 시간 15% 이하, 끝 화면 말고 1.5초 넘는 정지 없음
 *   ③ 끝 화면 길이 — 마지막 컷부터 끝까지 2.5~6초(v2 §2-4 「끝 화면은 4초 안팎」)
 *   ④ 음량 — 공용 기준(tools/음량마감.mjs DEFAULTS) −14.5 LUFS ±0.5 · 최대 −1.2 dBFS
 *   ⑤ 글자·안전 영역 — 영상 0.5초마다와 표지를 윈도우 글자 인식(tools/lib/글자인식.ps1)으로 읽어, SNS 키트 cover916 안전 영역
 *      (1080×1920 기준 x 65~920 · y 269~1428, 키트를 따른 Remotion 편과 같은 값)과 작은 글자를 본다(tools/SNS키트굽기.js의 기준).
 *      준비.json에 「키트원고」(SNS 키트 원고 HTML)가 있으면 tools/SNS키트굽기.js 검사를 그대로 돌린다.
 *   ⑥ 게시글 규칙(tools/lib/게시글규칙.js) — 첫 125자 훅, 인스타 해시태그 5개, 상대 날짜·내부 번호·도구 이름, 플랫폼 한도,
 *      블로그·링크드인 원고의 숫자가 영상(화면 글·나레이션)·게시글과 맞는지
 *   ⑦ 올릴 칸 — 원본 파일(화질 낮춘 사본 아님), 유튜브 제목·언어·아동용 아님, AI 표시, 시각·슬롯·시한, 글 속 링크 응답 200
 *   ⑧ 가져갈 프롬프트(10-22, yuhobuilds만) — 준비.json 「프롬프트」가 없으면 확인할 것, 있으면 synk.im/prompts 응답 200과 그 항목이 공개본에 있는지
 *   ⑨ 틱톡 판(10-26, 제작 절차 4) — 인스타 영상 판에 짝 틱톡 판이 없거나(「틱톡없음」에 까닭이 없을 때), 틱톡 판이 키워드 DM 인스타 판 ·
 *      고정 댓글 유튜브 판과 같은 영상이면(끝 말이 틱톡에 없는 길을 가리킬 수 있다) 확인할 것
 *   ⑩ 매일 판(10-26) — 판 계정의 줄(sns-계정.json dailyLine)마다 그 줄의 (막힘 아닌) 계정 가운데 판이 없는 계정이면 확인할 것.
 *      못 가는 판(여러 장 편의 틱톡 · 그날 이미 다른 편이 찬 계정)은 준비.json 「빠진판」: {"계정": "까닭"}에 적는다(「틱톡없음」도 받는다)
 *   ⑪ 슬롯이 오늘이면 확인할 것 — 4일 앞(D+4)에 만드는 것이 기본(제작 절차 0). 같은 날 같은 계정의 두 편은 tools/예약큐.js가 본다
 *   ⑫ 한 편의 틱톡 판 둘(몽골 @synk.mn · 버마어 @synklab.mm 등)이 같은 날이면 고칠 것(10-26 — 거의 같은 영상이 같은 날 두 계정에 나가지 않게).
 *      LAB 두 채널 판은 그 줄의 목표 칸에 두니 편 슬롯과 날이 달라도 「시각이 슬롯 날이 아니다」를 내지 않는다
 *   ⑬ 한 구성(10-28, tools/한구성.js) — 끝 화면 말고 같은 구성(글 강조 · 테 · 밝기만 바뀜)이 4초를 넘으면 고칠 것. ②는 프레임 차이라
 *      LAB E8의 10초 흑백 글 카드를 정지 0%로 넘겼다
 *   ⑭ 목소리(10-28) — 편 폴더의 나레이션 줄 파일(나레이션굽기 vo.json 줄 · remotion/public/vo, 또는 준비.json 「목소리」에 적은 폴더)마다
 *      최고 음높이 560Hz 넘음 · Typecast 원본 잘림 · 영상보다 새 줄 파일(다시 산 목소리가 렌더에 안 들어감)을 고칠 것으로.
 *      ⑤에 더해 판 · 테두리 · 그림자 없이 그림 위에 바로 얹은 흰 글자(흰 기본 글자)도 고칠 것이다
 *
 * 「고칠 것」은 올리기 전에 꼭 고칠 것(서버·API가 거절하거나 기준을 어김), 「확인할 것」은 기계가 확신하지 못해 눈으로 볼 것이다.
 * 결과는 그 편 게시/준비.json의 「검사」 칸에 남긴다(--저장안함이면 안 남김). 영상마다 크기·수정 시각·SHA-256을 같이 적어 두어,
 * 검사 뒤 파일이 바뀌면 tools/예약큐.js·tools/작업실예약.js가 「다시 검사」로 본다. 영상사전검사 검토 클립과 걸린 장면 그림은
 * .tmp/올리기전검사/<편>/에 남는다. 종료 코드: 고칠 것 1 · 확인할 것만 또는 통과 0 · 사용법 오류 2.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const 묶음 = require('./lib/게시묶음.js');
const 규칙 = require('./lib/게시글규칙.js');
const 정지 = require('./정지구간.js');
const 한구성 = require('./한구성.js');
const 타입캐스트 = require('./lib/타입캐스트.cjs');

const { FIX, LOOK } = 규칙;
const SAFE = { left: 65, right: 920, top: 269, bottom: 1428 };
const TOLERANCE = 6;
const SMALL_TEXT = 16; // 글자 상자 높이(1080 폭 기준). 키트 최소 24px 글자는 상자가 18~22px쯤이다.
const END_CARD = [2.5, 6];
const FRAME_STEP = 0.5;
const API_PLATFORMS = new Set(['youtube', 'instagram', 'facebook']);
// 인스타 영상 판 → 같은 말을 쓰는 틱톡 계정(10-26 유호님 「틱톡 4계정도 매일」). 버마어 lab-mm-tiktok은 LAB 두 채널 판이 따로 만든다.
const TIKTOK_PAIR = { 'yuhobuilds-instagram': 'yuhobuilds-tiktok', 'synkbrief-instagram': 'synkbrief-tiktok', 'lab-instagram': 'lab-tiktok' };
const SERVER_YOUTUBE_LIMIT = 100 * 1024 * 1024;
const LANG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const DONE = new Set(['예약됨', '게시됨']);

function kst(ms = Date.now()) {
  return new Date(ms + 9 * 3600 * 1000).toISOString().replace(/\.\d+Z$/, '+09:00');
}

function norm(text) {
  return String(text || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

// ── 글자 인식 ──
function ocrFolder(dir) {
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'lib', '글자인식.ps1'), '-Dir', dir],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 256 * 1024 * 1024, timeout: 600000 });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(String(r.stderr || '').trim().slice(0, 300) || `종료 코드 ${r.status}`);
  const text = String(r.stdout || '').replace(/^\uFEFF/, '').trim();
  return text ? [].concat(JSON.parse(text)) : [];
}

// 한국어 엔진이 무늬·그림을 글자로 잘못 읽으면 드문 한자가 섞인 줄이 나온다. 중국어·일본어판이 아니면 그런 줄은 뺀다.
function looksLikeText(text, allowHan) {
  const chars = [...String(text).replace(/\s/g, '')];
  if (chars.length < 2) return false;
  const han = chars.filter((c) => /\p{Script=Han}/u.test(c)).length;
  return allowHan || han / chars.length <= 0.2;
}

// 그림 하나의 글자 줄을 1080×1920 좌표로: [{ text, x0, y0, x1, y1, h, box(원본 픽셀) }]
function linesOf(image, { allowHan = false } = {}) {
  const sx = 1080 / image.width, sy = 1920 / image.height;
  const out = [];
  for (const line of [].concat(image.lines || [])) {
    const words = [].concat(line.words || []).filter((w) => w && w.w > 0 && w.h > 0);
    const text = String(line.text || '').trim();
    if (!words.length || norm(text).length < 2 || !looksLikeText(text, allowHan)) continue;
    const box = { x: Math.min(...words.map((w) => w.x)), y: Math.min(...words.map((w) => w.y)) };
    box.w = Math.max(...words.map((w) => w.x + w.w)) - box.x;
    box.h = Math.max(...words.map((w) => w.y + w.h)) - box.y;
    const h = Math.max(...words.map((w) => w.h)) * sy;
    if (h < 9) continue; // 9px 아래 상자는 거의 늘 무늬다
    out.push({ text, x0: box.x * sx, y0: box.y * sy, x1: (box.x + box.w) * sx, y1: (box.y + box.h) * sy, h, box });
  }
  return out;
}

const KINDS = { right: '오른쪽 단추 자리', bottom: '아래 앱 글자 자리', top: '위 머리 자리', left: '왼쪽 가장자리', small: '작은 글자',
  white: '흰 기본 글자(판 · 테두리 없이 그림 위)', whiteShort: '판 없이 그림 위에 얹은 짧은 밝은 글자' };
const FIX_KINDS = new Set(['white']);

// ⑤-2 흰 기본 글자(10-28) — 판(글 상자) · 테두리 · 그림자 없이 그림 위에 바로 얹은 흰 글자. LAB E8 끝 화면의 흰 글 넉 줄이 바리스타
// 머리 위에 겹쳐 휴대폰에서 잘 안 읽혔다(10-28 점검). 글자 줄 상자(540×960 회색) 안에서 흰 칸(215 이상)이 5~42%이고, 흰 칸 둘레 2칸
// 가운데 어두운 칸(80 미만 — 외곽선 · 그림자)이 절반이 안 되며, 나머지 바탕이 그림처럼 얼룩지면(표준편차 25~60) 걸린다.
// 판 위 흰 글자는 바탕이 고르고(어두운 판 6~16, 색 판 0), 흰 판 · 도장 · 말풍선은 흰 칸이 43% 넘게, 밝은 판에 어두운 글자는 바탕
// 표준편차가 70 넘게 나와 걸리지 않는다(E8 · 퀴즈 #5 실측). 노란 글자처럼 밝은 글자도 판 없이 그림 위면 같이 걸린다.
// 고칠 것은 6자 넘는 줄이 1초 넘게 머물고 둘레 어두운 칸이 45% 아래일 때만이고, 짧은 낱말 · 잠깐 지나가는 줄(퀴즈 「NOPE!」 도장,
// 화면 속 앱 단추) · 그림자가 반쯤 있는 줄(E8 첫 화면 제목 48%) · 잘못 읽은 줄은 확인할 것이다.
const WHITE = 215;
function plainWhite(gray, w, h, line) {
  const s = w / 1080;
  const x0 = Math.max(0, Math.floor(line.x0 * s)), x1 = Math.min(w, Math.ceil(line.x1 * s));
  const y0 = Math.max(0, Math.floor(line.y0 * s)), y1 = Math.min(h, Math.ceil(line.y1 * s));
  const bw = x1 - x0, bh = y1 - y0;
  if (bw < 8 || bh < 6) return null;
  const at = (x, y) => gray[(y0 + y) * w + x0 + x];
  const bright = new Uint8Array(bw * bh);
  let nb = 0;
  for (let y = 0; y < bh; y += 1) for (let x = 0; x < bw; x += 1) if (at(x, y) >= WHITE) { bright[y * bw + x] = 1; nb += 1; }
  const frac = nb / (bw * bh);
  if (frac < 0.05 || frac > 0.42) return { frac, plain: false };
  const near = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y += 1) for (let x = 0; x < bw; x += 1) {
    if (!bright[y * bw + x]) continue;
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < bw && yy < bh && !bright[yy * bw + xx]) near[yy * bw + xx] = 1;
    }
  }
  let ring = 0, dark = 0, n = 0, sum = 0, sq = 0;
  for (let y = 0; y < bh; y += 1) for (let x = 0; x < bw; x += 1) {
    const i = y * bw + x, v = at(x, y);
    if (bright[i]) continue;
    if (near[i]) { ring += 1; if (v < 80) dark += 1; continue; }
    n += 1; sum += v; sq += v * v;
  }
  const ringDark = ring ? dark / ring : 0;
  const bgMean = n ? sum / n : 0;
  const bgStd = n ? Math.sqrt(Math.max(0, sq / n - bgMean * bgMean)) : 0;
  return { frac, ringDark, bgMean, bgStd, plain: n >= 20 && ringDark < 0.5 && bgStd >= 25 && bgStd < 60 };
}

// 0.5초마다(글자 인식과 같은 장면) 540×960 회색 프레임 → { w, h, frame(i) }
function grayFrames(file) {
  const w = 540, h = 960;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `fps=${1 / FRAME_STEP},scale=${w}:${h},format=gray`, '-f', 'rawvideo', '-'],
    { windowsHide: true, maxBuffer: 1024 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('회색 장면 뽑기 실패: ' + String(r.stderr || '').trim().slice(0, 200));
  const buf = r.stdout;
  return { w, h, frame: (i) => ((i + 1) * w * h <= buf.length ? buf.subarray(i * w * h, (i + 1) * w * h) : null) };
}

function problemsOf(line) {
  const out = [];
  if (line.x1 > SAFE.right + TOLERANCE) out.push({ kind: 'right', text: `오른쪽 끝 ${Math.round(line.x1)}px(안전선 ${SAFE.right})` });
  if (line.y1 > SAFE.bottom + TOLERANCE) out.push({ kind: 'bottom', text: `아래 끝 ${Math.round(line.y1)}px(안전선 ${SAFE.bottom})` });
  if (line.y0 < SAFE.top - TOLERANCE) out.push({ kind: 'top', text: `위 끝 ${Math.round(line.y0)}px(안전선 ${SAFE.top})` });
  if (line.x0 < SAFE.left - TOLERANCE) out.push({ kind: 'left', text: `왼쪽 끝 ${Math.round(line.x0)}px(안전선 ${SAFE.left})` });
  if (line.h < SMALL_TEXT) out.push({ kind: 'small', text: `글자 상자 ${Math.round(line.h)}px(키트 최소 24px 글자는 약 18px)` });
  return out;
}

// 걸린 장면에 빨간 상자를 그려 한 장(가로 6칸)으로 모은다. 사람이 이 한 장만 보고 넘기거나 고친다.
function sheet(frames, dir, file) {
  if (!frames.length) return null;
  const parts = [];
  frames.slice(0, 12).forEach(({ name, boxes }, i) => {
    const part = path.join(dir, `_칸${String(i).padStart(2, '0')}.jpg`);
    const draw = boxes.map((b) => `drawbox=x=${Math.max(0, b.x - 6)}:y=${Math.max(0, b.y - 6)}:w=${b.w + 12}:h=${b.h + 12}:color=red@0.9:t=8`);
    const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(dir, name), '-vf', [...draw, 'scale=270:-2'].join(','), part], { windowsHide: true });
    if (r.status === 0) parts.push(part);
  });
  if (!parts.length) return null;
  const cols = Math.min(6, parts.length), rows = Math.ceil(parts.length / cols);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(dir, '_칸%02d.jpg'), '-vf', `tile=${cols}x${rows}:padding=6:color=white`, '-frames:v', '1', file], { windowsHide: true });
  parts.forEach((p) => fs.rmSync(p, { force: true }));
  return r.status === 0 ? file : null;
}

// 영상 장면: 0.5초마다 뽑아 읽는다. 같은 글이 같은 자리에 두 장면 넘게(0.5초 넘게) 머문 것만 센다 — 들어오고 나가는 움직임은 뺀다.
// 결과는 걸린 종류마다 한 줄(몇 군데, 예 둘)과 빨간 상자를 그린 장면표 한 장이다. 화면 속 캡처 그림의 작은 글자도 걸리니 눈으로 가린다.
function ocrVideo(file, dir, label, { allowHan, repo, sheetFile: sheetPath }) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-vf', `fps=${1 / FRAME_STEP}`, '-q:v', '3', path.join(dir, 'f%04d.jpg')],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('장면 뽑기 실패: ' + String(r.stderr || '').trim().slice(0, 200));
  const images = ocrFolder(dir);
  const seen = new Map();
  const all = new Map(); // 걸리지 않은 줄까지 — 흰 기본 글자는 장면 그림을 봐야 안다
  const texts = [];
  for (const image of images) {
    const t = (Number(String(image.name).match(/(\d+)/)[1]) - 1) * FRAME_STEP;
    for (const line of linesOf(image, { allowHan })) {
      texts.push(line.text);
      const key = `${norm(line.text).slice(0, 20)}|${Math.round(line.x0 / 24)}|${Math.round(line.y0 / 24)}`;
      const one = all.get(key) || { text: line.text, line, times: [], frames: [], box: line.box };
      one.times.push(t);
      one.frames.push(image.name);
      all.set(key, one);
      const problems = problemsOf(line);
      if (!problems.length) continue;
      const item = seen.get(key) || { text: line.text, problems, times: [], frames: [], box: line.box };
      item.times.push(t);
      item.frames.push(image.name);
      seen.set(key, item);
    }
  }
  const isSteady = (item) => item.times.some((t, i) => i > 0 && Math.abs(t - item.times[i - 1] - FRAME_STEP) < 0.01);
  let gray = null;
  try { gray = grayFrames(file); } catch { /* 흰 기본 글자만 못 본다 — 나머지는 그대로 */ }
  for (const [key, one] of gray ? all : []) {
    if (!isSteady(one)) continue;
    // 들어오는 움직임 중간이 아니라 머무는 동안의 가운데 장면으로 잰다
    const frame = gray.frame(Math.round(one.times[Math.floor(one.times.length / 2)] / FRAME_STEP));
    const r = frame && plainWhite(frame, gray.w, gray.h, one.line);
    if (!r?.plain) continue;
    let run = 1, best = 1;
    one.times.forEach((t, i) => { run = i > 0 && Math.abs(t - one.times[i - 1] - FRAME_STEP) < 0.01 ? run + 1 : 1; best = Math.max(best, run); });
    const chars = [...String(one.text).replace(/\s/g, '')];
    const clean = chars.filter((c) => /[\p{L}\p{N}'"“”‘’.,!?…:-]/u.test(c)).length / Math.max(1, chars.length) >= 0.95; // 「c:℃아않 파리만 날려요」 같은 잘못 읽은 줄은 빼고
    const kind = norm(one.text).length > 6 && best >= 2 && clean && r.ringDark < 0.45 ? 'white' : 'whiteShort';
    const p = { kind, text: `바탕 얼룩 ${Math.round(r.bgStd)} · 흰 글자 둘레 어두운 칸 ${Math.round(r.ringDark * 100)}%` };
    if (seen.has(key)) seen.get(key).problems.push(p);
    else seen.set(key, { text: one.text, problems: [p], times: one.times, frames: one.frames, box: one.box });
  }
  const steady = [...seen.values()].filter(isSteady);
  const frames = new Map();
  for (const item of steady) {
    const name = item.frames[0];
    if (!frames.has(name)) frames.set(name, { name, boxes: [] });
    frames.get(name).boxes.push(item.box);
  }
  const sheetFile = sheet([...frames.values()], dir, sheetPath);
  fs.rmSync(dir, { recursive: true, force: true });
  const findings = [];
  const sheetRel = sheetFile ? path.relative(repo, sheetFile).split(path.sep).join('/') : null;
  for (const kind of Object.keys(KINDS)) {
    const hits = steady.filter((item) => item.problems.some((p) => p.kind === kind));
    if (!hits.length) continue;
    const examples = hits.slice(0, 2).map((item) => `${item.times[0].toFixed(1)}초 「${item.text.slice(0, 18)}」 ${item.problems.find((p) => p.kind === kind).text}`);
    findings.push({ level: FIX_KINDS.has(kind) ? FIX : LOOK, code: `text-${kind}`, kind, where: label, count: hits.length, examples, sheet: sheetRel });
  }
  return { findings, text: texts.join('\n') };
}

// 같은 틀로 만든 판(LAB 나라별 판 넷 등)은 같은 자리에서 같은 줄이 걸린다. 종류마다 한 줄로 합치되, 영상마다 군데 수와 장면표는 모두 남기고
// 예는 가장 많이 걸린 영상에서 든다.
function mergeAcrossFiles(list) {
  const byCode = new Map();
  for (const f of list) {
    if (!byCode.has(f.code)) byCode.set(f.code, []);
    byCode.get(f.code).push(f);
  }
  const short = (where) => where.split('/').slice(-2).join('/');
  return [...byCode.values()].map((group) => {
    const top = [...group].sort((a, b) => b.count - a.count)[0];
    const sheets = group.map((f) => f.sheet).filter(Boolean);
    const counts = group.length > 1 ? `(${group.map((f) => `${short(f.where)} ${f.count}`).join(' · ')})` : '';
    return { level: group.some((f) => f.level === FIX) ? FIX : LOOK, code: top.code, where: group.length > 1 ? `영상 ${group.length}개` : top.where,
      message: `${KINDS[top.kind]} ${group.reduce((n, f) => n + f.count, 0)}군데${counts} — ${top.examples.join(' · ')}${sheets.length ? ` · 장면표 ${sheets.join(' · ')}` : ''}` };
  });
}

function ocrCover(file, dir, label, { allowHan }) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(file, path.join(dir, 'cover' + (path.extname(file).toLowerCase() === '.png' ? '.png' : '.jpg')));
  const [image] = ocrFolder(dir);
  fs.rmSync(dir, { recursive: true, force: true });
  if (!image || Math.abs(image.width / image.height - 9 / 16) > 0.02) return [];
  const hits = linesOf(image, { allowHan }).map((line) => ({ line, problems: problemsOf(line) })).filter((x) => x.problems.length);
  // 영상과 같이 걸린 종류마다 한 줄(몇 군데, 예 둘)로 모은다.
  return Object.keys(KINDS).map((kind) => {
    const mine = hits.filter((x) => x.problems.some((p) => p.kind === kind));
    if (!mine.length) return null;
    const examples = mine.slice(0, 2).map((x) => `「${x.line.text.slice(0, 18)}」 ${x.problems.find((p) => p.kind === kind).text}`);
    return { level: LOOK, code: 'cover-safe-area', where: label, message: `표지 ${KINDS[kind]} ${mine.length}군데 — ${examples.join(' · ')}` };
  }).filter(Boolean);
}

// ── 영상 하나 ──
async function checkVideo(file, out, { skipOcr, repo, allowHan, label = path.basename(file) }) {
  const 사전 = await import(pathToFileURL(path.join(__dirname, '영상사전검사.mjs')).href);
  const 음량 = await import(pathToFileURL(path.join(__dirname, '음량마감.mjs')).href);
  const findings = [];
  const add = (level, code, message) => findings.push({ level, code, where: label, message });
  const slug = label.replace(/\.[^.]+$/, '').replace(/[\\/]+/g, '_');
  const report = await 사전.inspectMedia({ video: file, out: path.join(out, '영상사전검사_' + slug) });
  for (const issue of report.issues) {
    if (['audio-level', 'audio-peak'].includes(issue.code)) continue; // ④에서 공용 기준으로 본다
    const hard = issue.severity === 'error' || ['upload-video-bitrate', 'upload-video-codec', 'upload-pixel-format'].includes(issue.code);
    add(hard ? FIX : LOOK, 'media-' + issue.code, `${issue.at == null ? '' : `${issue.at.toFixed(1)}초 · `}${issue.message}`);
  }
  const m = report.media;
  if (Math.min(m.width, m.height) < 1080) add(FIX, 'resolution', `${m.width}×${m.height} — 올림 화질은 1080×1920 이상(v2 §2-4)`);
  if (Math.abs(m.width / m.height - 9 / 16) > 0.01) add(FIX, 'aspect', `${m.width}×${m.height} — 쇼츠·릴스는 9:16`);
  const loud = m.loudness;
  if (!loud || loud.integratedLufs == null) add(LOOK, 'loudness-unknown', '음량을 재지 못했다(소리가 없거나 무음)');
  else if (!음량.passes({ I: loud.integratedLufs, peak: loud.truePeakDbfs }, 음량.DEFAULTS)) {
    add(FIX, 'loudness', `${loud.integratedLufs} LUFS · 최대 ${loud.truePeakDbfs} dBFS — 공용 기준 ${음량.DEFAULTS.target}±${음량.DEFAULTS.tolerance} LUFS·최대 ${음량.DEFAULTS.ceiling} dBFS(node tools/음량마감.mjs <렌더.mp4>로 다시 담는다)`);
  }
  const still = 정지.analyze(file);
  if (!still.pass) {
    const long = still.runs.filter((x) => !x.endCard).map((x) => `${x.start.toFixed(1)}~${x.end.toFixed(1)}초`);
    add(FIX, 'still', `거의 멈춘 시간 ${still.still.toFixed(1)}초(${Math.round(still.ratio * 100)}%)${long.length ? ` · 1.5초 넘는 정지 ${long.join(', ')}` : ''} — 기준 15% 이하·끝 화면 말고 1.5초 넘는 정지 없음(v2 §2-4)`);
  }
  const 구성 = 한구성.analyze(file);
  for (const s of 구성.long) {
    add(FIX, 'one-composition', `${s.start.toFixed(1)}~${s.end.toFixed(1)}초 한 구성 ${s.length.toFixed(1)}초${s.endCard ? '(끝 화면 — 6초까지)' : ''} — 같은 장면에서 글 강조 · 테 · 밝기만 바뀌는 칸은 4초 안으로 줄이거나 장면을 바꾼다(제작 절차 3 · 10-28)`);
  }
  if (!still.end) add(LOOK, 'end-card-unknown', '끝 화면을 재지 못했다(마지막 12초 안에 화면 전체가 바뀌는 컷이 없음) — 4초 안팎인지 눈으로 본다');
  else if (still.end.length < END_CARD[0] || still.end.length > END_CARD[1]) add(LOOK, 'end-card', `끝 화면 ${still.end.length.toFixed(1)}초(${still.end.start.toFixed(1)}초 컷부터) — v2 §2-4 「4초 안팎」`);
  let ocr = { findings: [], text: '' };
  if (!skipOcr) {
    try { ocr = ocrVideo(file, path.join(out, '장면_' + slug), label, { allowHan, repo, sheetFile: path.join(out, `글자표_${slug}.jpg`) }); } catch (error) {
      add(LOOK, 'ocr-failed', `글자 인식을 못 했다(${error.message}) — 글자 크기·안전 영역은 눈으로 본다`);
    }
  }
  const stat = fs.statSync(file);
  const video = report.inputs.video;
  const stream = Math.round(((stat.size * 8) / m.duration) / 1e5) / 10;
  return {
    findings, ocrFindings: ocr.findings, ocrText: ocr.text, size: stat.size,
    summary: { 바이트: stat.size, 수정: new Date(stat.mtimeMs).toISOString(), sha256: video.sha256, 길이: Math.round(m.duration * 10) / 10,
      해상도: `${m.width}×${m.height}`, 평균Mbps: stream, 음량: loud?.integratedLufs ?? null, 봉우리: loud?.truePeakDbfs ?? null,
      정지: `${Math.round(still.ratio * 100)}%${still.pass ? ' 통과' : ' 고칠 것'}`, 끝화면: still.end ? Math.round(still.end.length * 10) / 10 : null,
      한구성: Math.round(구성.longest * 100) / 100,
      사전검사: path.relative(repo, report.reportPath).split(path.sep).join('/') },
  };
}

// ── ⑭ 목소리(10-28) ──
// 10-28 점검: Typecast 「하나」의 감탄사(「Nope!」)가 깨진 채 퀴즈 여섯 편에 나갔고(유호님 「전부 지지직, 특히 no」), E8에는 다시 산
// 바리스타 목소리가 아니라 그 전 파일이 들어갔다. 지금까지 목소리 결함은 tools/나레이션굽기.mjs 경고뿐이라 렌더 뒤에는 아무도 안 봤다.
// 기계로 가르는 것은 최고 음높이(560Hz — 깨진 줄은 594~645Hz, 깨끗한 소진 세기 1.0은 498Hz) · Typecast 원본 잘림 · 목소리 엉킴이다.
// 엉킴(tools/목소리엉킴.py)은 줄 하나로는 못 가른다(깨진 「Nope!」 11%, 깨끗한 줄도 자음이 많으면 20~60%) — 목소리마다 줄을 모아
// 프레임 가중 평균을 낸다. 여자 목소리는 하나 25~33% · 소진 0% · 진희 2% · 미선 4% · 혜리 5~8%로 갈리지만(현장노트 영상 「하나」),
// 기본음이 낮은 남자 목소리는 결함 없이도 45~65%라(범수) 중앙 기본음 165Hz 이상인 목소리만 15%를 문턱으로 본다. 파이썬 · numpy가
// 없으면 엉킴만 확인할 것으로 남긴다.
const TANGLE_LIMIT = 15;
const TANGLE_MIN_F0 = 165;

// 목소리엉킴.py 출력 「<경로>\t엉킨 프레임  12.1% · … · 프레임 66 · 최고 음높이 525Hz · 중앙 기본음 240Hz」 → { 경로: {pct, frames, f0} }
function parseTangle(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const [file, rest] = line.split('\t');
    const m = rest && rest.match(/엉킨 프레임\s+([\d.]+)%.*프레임 (\d+).*중앙 기본음 ([\d.]+)Hz/);
    if (m) out[path.resolve(file)] = { pct: Number(m[1]), frames: Number(m[2]), f0: Number(m[3]) };
  }
  return out;
}

// 목소리(Typecast 목소리 id, 모르면 폴더)마다 프레임 가중 엉킴 % · 중앙 기본음 → 엉킨 목소리 [{voice, pct, f0, lines}]
function tangledVoices(files, measured) {
  const groups = new Map();
  for (const v of files) {
    const r = measured[path.resolve(v.wav)];
    if (!r || !r.frames) continue;
    const g = groups.get(v.voice) || { voice: v.voice, frames: 0, sum: 0, f0s: [], lines: 0 };
    g.frames += r.frames; g.sum += r.pct * r.frames; g.f0s.push(r.f0); g.lines += 1;
    groups.set(v.voice, g);
  }
  return [...groups.values()].map((g) => {
    const f0s = g.f0s.sort((a, b) => a - b);
    return { voice: g.voice, pct: Math.round((g.sum / g.frames) * 10) / 10, f0: f0s[Math.floor(f0s.length / 2)], lines: g.lines };
  }).filter((g) => g.f0 >= TANGLE_MIN_F0 && g.pct > TANGLE_LIMIT);
}
// 줄 파일 찾기: 준비.json 「목소리」(편 폴더 기준 폴더 · 파일 목록)가 있으면 그것만, 없으면 편 폴더의 나레이션굽기 vo.json 줄과
// remotion/public/vo 아래 wav(관용구 퀴즈처럼 vo.json 없이 굽는 편). 시험 · 후보 폴더(억양시험 등)는 영상에 안 들어가니 뺀다.
const VOICE_SKIP = /^(node_modules|out|\.git|시안|판|게시|.*시험.*|.*후보.*|old|test)$/i;
const VOICE_TOOL = 'tools/나레이션굽기.mjs';

function voiceFiles(bundle) {
  const found = new Map();
  const add = (wav, json = null, made = null) => {
    if (!found.has(wav) && fs.existsSync(wav)) found.set(wav, { wav, json: json && fs.existsSync(json) ? json : null, id: path.basename(wav, path.extname(wav)), made });
  };
  const listed = [].concat(bundle.prep.목소리 || []).filter((x) => typeof x === 'string' && x.trim());
  const walk = (dir, depth, { all, skip }) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    const manifest = entries.find((e) => e.isFile() && e.name === 'vo.json');
    if (manifest) {
      try {
        const m = 묶음.readJson(path.join(dir, 'vo.json'));
        const made = Date.parse(m.made || '') || null;
        if (m.tool === VOICE_TOOL) for (const l of m.lines || []) add(path.join(dir, path.basename(l.src || `${l.id}.wav`)), path.join(dir, `${l.id}.json`), made);
      } catch { /* 깨진 목록은 아래 wav 훑기로 */ }
    }
    for (const e of entries) {
      if (e.isDirectory() && depth < 6 && !(skip && VOICE_SKIP.test(e.name))) walk(path.join(dir, e.name), depth + 1, { all: all || (e.name === 'vo' && /[\\/]public$/.test(dir)), skip });
      else if (e.isFile() && all && /\.wav$/i.test(e.name)) add(path.join(dir, e.name), path.join(dir, e.name.replace(/\.wav$/i, '.json')));
    }
  };
  if (listed.length) {
    for (const p of listed) {
      const f = 묶음.resolve(bundle, p);
      if (f && fs.existsSync(f) && fs.statSync(f).isFile()) add(f, f.replace(/\.wav$/i, '.json'));
      else if (f) walk(f, 0, { all: true, skip: false });
    }
  } else {
    walk(bundle.dir, 0, { all: false, skip: true });
  }
  return [...found.values()];
}

// 줄 파일마다 최고 음높이 · 잘림 · 영상보다 새것인지 → 고칠 것. 「영상보다 새것」은 나레이션굽기가 vo.json에 적은 만든 때(made)와
// 영상 파일 수정 시각(git 밖이라 체크아웃 · 따라가기가 안 건드린다)으로 본다 — wav 수정 시각은 git이 다시 쓰면 바뀌어 못 믿는다
// (퀴즈 #5 줄 57개가 렌더 뒤 시각으로 나왔다). vo.json 없이 구운 줄은 이 셈을 하지 않는다.
async function voiceFindings(bundle, videoFiles, { files = voiceFiles(bundle), scriptText = '' } = {}) {
  const 굽기 = await import(pathToFileURL(path.join(__dirname, '나레이션굽기.mjs')).href);
  const out = [];
  const high = [], clipped = [], newer = [], unread = [];
  let top = null;
  const times = videoFiles.filter((f) => fs.existsSync(f)).map((f) => fs.statSync(f).mtimeMs);
  const videoTime = times.length ? Math.min(...times) : null;
  for (const v of files) {
    let x;
    try { x = 굽기.readWavMono16(v.wav); } catch { unread.push(v.id); continue; }
    let meta = null;
    try { meta = v.json ? 묶음.readJson(v.json) : null; } catch { /* 줄 기록 없이 wav만 본다 */ }
    const voiceKey = meta?.source?.voice?.name || meta?.source?.voice?.id || (typeof meta?.source?.voice === 'string' ? meta.source.voice : null);
    v.voice = voiceKey || path.relative(bundle.dir, path.dirname(v.wav)).split(path.sep).join('/') || '.';
    const pitch = 굽기.topPitch(x);
    if (pitch !== null) top = Math.max(top ?? 0, pitch);
    if (pitch > 굽기.PITCH_WARN) high.push(`${v.id} ${pitch}Hz`);
    let clip = typeof meta?.level?.clippedSource === 'number' ? meta.level.clippedSource : null;
    const voiceId = meta?.source?.voice?.id || meta?.source?.voice;
    if (clip === null && meta?.source?.key && typeof voiceId === 'string') {
      const cached = 타입캐스트.findCached(voiceId, meta.source.key, { copyLegacy: false });
      if (cached?.wav) try { clip = 굽기.clippedSamples(굽기.readWavMono16(cached.wav)); } catch { /* 아래에서 줄 파일로 */ }
    }
    if (clip === null) clip = 굽기.clippedSamples(x);
    if (clip >= 굽기.CLIP_WARN) clipped.push(`${v.id} ${clip}표본`);
    if (videoTime !== null && v.made && v.made > videoTime + 60 * 1000) newer.push(v.id);
  }
  const readable = files.filter((v) => !unread.includes(v.id));
  let tangled = [];
  if (readable.length) {
    const r = measureTangle(readable.map((v) => v.wav));
    if (r.error) out.push({ level: LOOK, code: 'voice-tangle-unknown', where: '목소리', message: `목소리 엉킴을 못 쟀다(${r.error}) — 귀로 듣는다` });
    else tangled = tangledVoices(readable, r.measured);
  }
  const where = (list) => list.slice(0, 6).join(' · ') + (list.length > 6 ? ` 외 ${list.length - 6}` : '');
  if (tangled.length) out.push({ level: FIX, code: 'voice-tangle', where: '목소리', message: `목소리 엉킴 — ${tangled.map((g) => `${g.voice} 줄 ${g.lines}개 평균 ${g.pct}%(기본음 ${Math.round(g.f0)}Hz)`).join(' · ')} — 깨끗한 여자 목소리는 0~8%, 지지직 깨지는 하나는 25~33%다. 목소리를 바꿔 다시 굽고(LAB 장부 「목소리」) 다시 렌더한다` });
  if (high.length) out.push({ level: FIX, code: 'voice-pitch', where: '목소리', message: `최고 음높이 ${굽기.PITCH_WARN}Hz 넘는 줄 ${high.length}개 — ${where(high)} — 목소리가 뒤집혀 지지직 깨진다(10-28 「Nope!」 645Hz). 감정 세기 1.0 · seed를 바꿔 다시 사거나 목소리를 바꾸고(LAB 장부 「목소리」) 다시 렌더한다` });
  if (clipped.length) out.push({ level: FIX, code: 'voice-clipped', where: '목소리', message: `원본이 잘린 줄 ${clipped.length}개 — ${where(clipped)} — node tools/나레이션굽기.mjs <계획> --굽기 --줄 <id>로 낮은 크기로 다시 산다` });
  if (newer.length) out.push({ level: FIX, code: 'voice-newer', where: '목소리', message: `영상보다 나중에 바뀐 줄 파일 ${newer.length}개 — ${where(newer)} — 다시 산 목소리가 영상에 안 들어갔을 수 있다(10-28 E8). 다시 렌더한다` });
  if (unread.length) out.push({ level: LOOK, code: 'voice-unread', where: '목소리', message: `16비트 wav가 아니라 못 잰 줄 ${unread.length}개 — ${where(unread)} — 귀로 듣는다` });
  if (!files.length && String(scriptText).trim()) {
    out.push({ level: LOOK, code: 'voice-none', where: '목소리', message: '목소리 줄 파일(나레이션굽기 vo.json · remotion/public/vo)을 못 찾아 음높이 · 잘림을 못 쟀다 — 준비.json 「목소리」에 렌더에 쓴 줄 파일 폴더를 적는다' });
  }
  return { findings: out, summary: { 줄: files.length, 최고음높이: top, 잘림: clipped.length, 엉킨목소리: tangled.map((g) => `${g.voice} ${g.pct}%`) } };
}

// tools/목소리엉킴.py를 한 번 불러 줄마다 엉킴 % · 프레임 · 중앙 기본음을 잰다 → { measured } | { error }
function measureTangle(wavs) {
  const py = process.env.SYNK_PYTHON || 'python';
  const r = spawnSync(py, ['-X', 'utf8', path.join(__dirname, '목소리엉킴.py'), ...wavs], { encoding: 'utf8', windowsHide: true, timeout: 600000, maxBuffer: 16 * 1024 * 1024 });
  if (r.error || r.status !== 0) return { error: (r.error?.message || String(r.stderr || '').trim().split('\n').slice(-1)[0] || `종료 ${r.status}`).slice(0, 160) };
  return { measured: parseTangle(r.stdout) };
}

// ── 링크 ──
// 우리 주소(끝 행동 링크)는 응답 200이어야 한다. 남의 출처 주소는 봇을 막는 곳(401·403·429)이 있어 확인만 하고, 없는 주소(404·410)는 고친다.
const OWN_HOSTS = /(^|\.)(synk\.im|yuhobuilds\.tistory\.com|synklab\.substack\.com|blog\.naver\.com)$/i;

async function checkLinks(list) {
  const out = [];
  for (const raw of list) {
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let own = false;
    try { own = OWN_HOSTS.test(new URL(url).hostname); } catch { /* 주소 꼴이 아니면 남의 주소로 본다 */ }
    try {
      const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 (SYNK upload check)' } });
      if (r.status >= 200 && r.status < 300) continue;
      if (own || [404, 410].includes(r.status) || r.status >= 500) out.push({ level: FIX, code: 'link', where: '링크', message: `${raw} 응답 ${r.status} — ${own ? '끝 행동 링크는 응답 200이어야 한다' : '없는 주소다'}` });
      else out.push({ level: LOOK, code: 'link-blocked', where: '링크', message: `${raw} 응답 ${r.status} — 봇을 막는 곳일 수 있어 브라우저로 한 번 연다` });
    } catch (error) {
      out.push({ level: LOOK, code: 'link-unknown', where: '링크', message: `${raw} 확인 못 함(${error.name === 'TimeoutError' ? '시간 초과' : error.message}) — 나중에 다시 연다` });
    }
  }
  return out;
}

// ── 가져갈 프롬프트(10-22) ──
// yuhobuilds 편은 보는 사람이 가져갈 프롬프트를 synk.im/prompts에 한 항목으로 올리고 준비.json 「프롬프트」에 {id, 주소}를 적는다
// (docs/마케팅/맞춤도구/prompts/README.md). 칸이 없으면 확인할 것(맞지 않는 편이면 까닭을 남은위험에), 있으면 프롬프트.json에
// 그 항목이 있는지와 공개 페이지가 응답 200이고 그 항목(id="…")을 싣고 있는지 본다 — 주소 뒤 #id는 서버로 가지 않아 200만으로는 모른다.
const PROMPTS_PAGE = 'https://synk.im/prompts/';
const PROMPTS_DATA = ['docs', '마케팅', '맞춤도구', 'prompts', '프롬프트.json'];
const PROMPTS_FROM = '2026-10-23'; // 이 날 슬롯부터 — 그 전 편(이미 올라갔거나 예약된 편)은 칸이 없어도 짚지 않는다

async function promptFindings(prep, { repo, fetchImpl = fetch, skipLinks = false } = {}) {
  if (prep.브랜드 !== 'yuhobuilds' || !(String(prep.슬롯 || '') >= PROMPTS_FROM)) return [];
  const out = [];
  const add = (level, code, message) => out.push({ level, code, where: '프롬프트', message });
  const p = prep.프롬프트;
  if (!p || typeof p !== 'object' || !p.id) {
    add(LOOK, 'prompt-missing', '준비.json 「프롬프트」({"id","주소"})가 없다 — 이 편의 가져갈 프롬프트를 synk.im/prompts에 올려 적는다(프롬프트가 맞지 않는 편이면 까닭을 남은위험에)');
    return out;
  }
  const want = PROMPTS_PAGE + '#' + p.id;
  if (p.주소 !== want) add(FIX, 'prompt-url', `「주소」가 ${p.주소 || '없음'} — ${want}로 적는다`);
  let items = null;
  try { items = JSON.parse(fs.readFileSync(path.join(repo, ...PROMPTS_DATA), 'utf8')).항목 || []; } catch (error) { add(LOOK, 'prompt-data', `프롬프트.json을 읽지 못했다(${error.message})`); }
  if (items && !items.some((it) => it.id === p.id)) add(FIX, 'prompt-item', `프롬프트.json에 「${p.id}」 항목이 없다 — 항목을 더하고 빌드·공개한다`);
  if (skipLinks) return out;
  try {
    const r = await fetchImpl(PROMPTS_PAGE, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 (SYNK upload check)' } });
    if (r.status !== 200) add(FIX, 'prompt-page', `${PROMPTS_PAGE} 응답 ${r.status} — 공개 페이지가 열려야 한다`);
    else if (!(await r.text()).includes(`id="${p.id}"`)) add(FIX, 'prompt-unpublished', `공개된 ${PROMPTS_PAGE}에 「${p.id}」 항목이 아직 없다 — node docs/마케팅/맞춤도구/build.mjs prompts 뒤 tools/공개.js로 올린다`);
  } catch (error) {
    add(LOOK, 'prompt-unknown', `${PROMPTS_PAGE} 확인 못 함(${error.name === 'TimeoutError' ? '시간 초과' : error.message}) — 나중에 다시 연다`);
  }
  return out;
}

function kitCheck(bundle, file, out) {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'SNS키트굽기.js'), file, '--out', out], { encoding: 'utf8', windowsHide: true, timeout: 300000 });
  const failed = String(r.stdout || '').split('\n').filter((l) => l.includes('✗')).map((l) => ({ level: FIX, code: 'kit', where: path.basename(file), message: l.trim() }));
  // 검사 도구가 죽거나(크롬·시간 초과) 걸린 장 없이 실패로 끝나면 통과로 치지 않는다.
  if (r.error || (r.status !== 0 && !failed.length)) {
    const why = r.error ? r.error.message : String(r.stderr || r.stdout || '').trim().split('\n').slice(-2).join(' ');
    failed.push({ level: FIX, code: 'kit-run', where: path.basename(file), message: `SNS 키트 검사를 끝내지 못했다(${why.slice(0, 200) || `종료 ${r.status}`}) — 다시 돌린다` });
  }
  return failed;
}

// 편 폴더 기준 이름표(「게시/01-mn/video.mp4」). 워크트리에서 돌려 영상이 공용 작업본에 있어도 같은 이름표가 되게 저장소 기준 경로에서 편 경로를 뗀다.
function labelOf(bundle, file) {
  const 편 = path.relative(bundle.repo, bundle.dir).split(path.sep).join('/');
  const rel = 묶음.rel(bundle, file);
  return rel.startsWith(`${편}/`) ? rel.slice(편.length + 1) : rel;
}

// ⑨ 틱톡 판. 같은 말을 쓰는 틱톡 계정엔 같은 최종본을 올리되, 끝 말이 인스타 키워드 DM · 유튜브 고정 댓글을 가리키면 틱톡엔 그 길이 없다.
// 짝 틱톡 계정이 매일 판 줄에 있으면 빠진 판은 ⑩이 본다(같은 말을 두 번 하지 않는다).
function tiktokFindings(plates, prep, known = {}) {
  const out = [];
  const add = (code, where, message) => out.push({ level: LOOK, code, where, message });
  const accounts = new Set(plates.map((p) => p.account));
  for (const p of plates) {
    const pair = TIKTOK_PAIR[p.account];
    if (!pair || !p.video || accounts.has(pair) || prep.틱톡없음 || known[pair]?.dailyLine) continue;
    add('tiktok-plate', p.account, `짝 틱톡 판(${pair})이 없다 — 제작 절차 4 「틱톡 판」. 달지 않을 까닭이 있으면 준비.json 「틱톡없음」에 적는다`);
  }
  for (const t of plates.filter((p) => p.platform === 'tiktok' && p.video)) {
    for (const p of plates) {
      if (p === t || !p.video || p.video.path !== t.video.path) continue;
      if (p.platform === 'instagram' && p.keywordDm) add('tiktok-ending', t.account, `키워드 DM(「${p.keywordDm}」) 인스타 판과 같은 영상이다 — 끝 말이 DM을 약속하면 끝 말만 바꾼 틱톡판을 렌더한다`);
      if (p.platform === 'youtube' && p.texts.pinnedComment) add('tiktok-ending', t.account, '고정 댓글이 있는 유튜브 판과 같은 영상이다 — 끝 말이 고정 댓글을 가리키면 끝 말만 바꾼 틱톡판을 렌더한다');
    }
  }
  return out;
}

// ⑩ 매일 판. 한 편은 그 줄의 모든 계정에 간다(유호님 10-26 「하루에 모든 계정에 하나씩」). 막힌 계정(dailyBlocked)은 빼고 본다.
function dailyFindings(plates, prep, known = {}) {
  const out = [];
  const have = new Set(plates.map((p) => p.account));
  const excused = prep.빠진판 && typeof prep.빠진판 === 'object' && !Array.isArray(prep.빠진판) ? prep.빠진판 : {};
  const lines = [...new Set(plates.map((p) => known[p.account]?.dailyLine).filter(Boolean))];
  for (const line of lines) {
    for (const [key, a] of Object.entries(known)) {
      if (a.dailyLine !== line || a.dailyBlocked || have.has(key) || String(excused[key] || '').trim()) continue;
      if (a.platform === 'tiktok' && prep.틱톡없음) continue;
      out.push({ level: LOOK, code: 'daily-plate', where: key, message: `매일 판 「${line}」 계정인데 판이 없다 — 판을 달거나, 못 가면 준비.json 「빠진판」에 {"${key}": "까닭"}` });
    }
  }
  return out;
}

// ⑫ 한 편의 틱톡 판 둘이 같은 날(한국 시각)이면 고칠 것 — 글자만 다른 거의 같은 영상이 우리 틱톡 둘에 같은 날 나가지 않게
// (유호님 10-26, LAB 장부 「두 채널 판」 — 버마어 판 시각을 다른 날로).
function tiktokDayFindings(plates) {
  const byDay = new Map();
  for (const p of plates) {
    const at = Date.parse(p.time || '');
    if (p.platform !== 'tiktok' || !Number.isFinite(at)) continue;
    const day = kst(at).slice(0, 10);
    byDay.set(day, [...(byDay.get(day) || []), p.account]);
  }
  return [...byDay].filter(([, accounts]) => accounts.length > 1).map(([day, accounts]) => ({ level: FIX, code: 'tiktok-same-day', where: accounts.join(' · '),
    message: `같은 편의 틱톡 판 둘이 같은 날(${day})이다 — 하나(보통 버마어 판)의 「시각」을 다른 빈 날로(LAB 장부 「두 채널 판」)` }));
}

async function run(dir, opts = {}) {
  const bundle = 묶음.load(dir);
  const prep = bundle.prep;
  const out = path.join(bundle.repo, '.tmp', '올리기전검사', bundle.name);
  fs.rmSync(out, { recursive: true, force: true }); // 지난 검사의 검토 클립·장면표는 지운다(이 도구가 만든 폴더)
  fs.mkdirSync(out, { recursive: true });
  const findings = [];
  const add = (level, code, where, message) => findings.push({ level, code, where, message });
  const posted = new Map();
  try { for (const p of 묶음.readJson(path.join(bundle.dir, '게시', '게시결과.json')).판 || []) if (p.계정) posted.set(p.계정, p.상태); } catch { /* 아직 없다 */ }

  if (!prep.브랜드) add(FIX, 'brand', '준비.json', '「브랜드」가 없다');
  const slotOk = /^\d{4}-\d{2}-\d{2}$/.test(prep.슬롯 || '');
  if (!slotOk) add(FIX, 'slot', '준비.json', '「슬롯」(올릴 날 YYYY-MM-DD)이 없다');
  if (prep.시한 && slotOk && prep.슬롯 > prep.시한) add(FIX, 'deadline', '준비.json', `슬롯 ${prep.슬롯}이 시한 ${prep.시한}을 넘는다`);
  if (!prep.기획) add(LOOK, 'pitch', '준비.json', '「기획」(기획 장부 줄 — 10-23부터 고른 기획만 만든다)이 없다');
  if (!(prep.판 || []).length) add(FIX, 'plates', '준비.json', '「판」이 비었다');

  const plates = 묶음.plates(bundle);
  const videos = new Map();
  const links = new Set();
  const texts = [];
  for (const plate of plates) {
    const where = plate.account || `판 ${plate.index + 1}`;
    const done = DONE.has(posted.get(plate.account));
    if (!plate.account || !bundle.accounts[plate.account]) add(FIX, 'account', where, `계정 키를 docs/마케팅/sns-계정.json에서 찾지 못했다`);
    const at = plate.time ? Date.parse(plate.time) : NaN;
    if (!plate.time || Number.isNaN(at) || !/[+-]\d{2}:?\d{2}$|Z$/.test(plate.time)) add(FIX, 'time', where, `「시각」이 시간대가 붙은 시각(YYYY-MM-DDTHH:MM+09:00)이 아니다: ${plate.time || '없음'}`);
    else {
      // LAB 두 채널 판은 그 줄의 목표 칸에 두니(버마어 틱톡은 몽골 틱톡과 다른 날) 편 슬롯과 날이 달라도 된다(10-26).
      const ownDay = bundle.accounts[plate.account]?.dailyLine === 'LAB 두 채널';
      if (slotOk && !ownDay && kst(at).slice(0, 10) !== prep.슬롯) add(LOOK, 'time-slot', where, `시각 ${plate.time}이 슬롯 ${prep.슬롯} 날이 아니다`);
      if (at < Date.now() && !done) add(LOOK, 'time-past', where, `시각 ${plate.time}이 이미 지났다 — 슬롯을 옮긴다`);
    }
    if (plate.blog) {
      if (!plate.article || !fs.existsSync(plate.article)) add(FIX, 'article', where, `원고 파일이 없다: ${plate.raw.파일 || plate.raw.게시글 || '없음'}`);
      continue;
    }
    if (!plate.video) { add(FIX, 'no-video', where, '「파일」에 영상이 없다'); continue; }
    if (!plate.video.exists) add(FIX, 'video-missing', where, `영상 파일이 없다: ${묶음.rel(bundle, plate.video.path)}`);
    else {
      if (plate.video.reduced) add(API_PLATFORMS.has(plate.platform) ? FIX : LOOK, 'reduced-copy', where,
        `화질을 낮춘 사본(${path.basename(plate.video.path)})만 적혀 있다 — 「원본」에 마감 원본을 적는다(v2 §2-4, 서버·API는 원본으로 올린다)`);
      if (plate.video.from === '추정') add(LOOK, 'original-guessed', where, `원본을 이름으로 짐작했다(${path.basename(plate.video.path)}) — 판에 「원본」을 적는다`);
      if (!videos.has(plate.video.path)) videos.set(plate.video.path, []);
      videos.get(plate.video.path).push(plate);
    }
    if (!plate.texts.source.length) add(FIX, 'no-text', where, '게시글을 찾지 못했다 — 판에 「원고」(원고.json) 또는 「게시글」을 적는다');
    for (const f of 규칙.checkPlate(plate.texts, { brand: prep.브랜드, language: plate.language, platform: plate.platform })) add(f.level, f.code, `${where} ${f.where}`, f.message);
    for (const t of [plate.texts.title, plate.texts.caption, plate.texts.firstComment, plate.texts.pinnedComment]) if (t) { texts.push(t); 규칙.urls(t).forEach((u) => links.add(u)); }
    if (plate.platform === 'youtube') {
      if (!plate.language || !LANG.test(plate.language)) add(FIX, 'language', where, '제목·설명 언어가 없다(판 「언어」 또는 원고.json language — 예: ko·en)');
      if (!plate.audioLanguage || !LANG.test(plate.audioLanguage)) add(FIX, 'audio-language', where, '동영상 언어(실제로 말하는 언어)가 없다(원고.json audioLanguage)');
      if (plate.kids === null) add(FIX, 'kids', where, '「아동용」 칸이 없다(아동용 아님이면 false)');
      else if (plate.kids === true) add(LOOK, 'kids-true', where, '아동용으로 적혀 있다 — 댓글·알림이 막힌다. 맞는지 본다');
      if (plate.video?.exists && fs.statSync(plate.video.path).size > SERVER_YOUTUBE_LIMIT) add(LOOK, 'youtube-size', where, '100MiB가 넘는다 — 작업실 직접 게시는 100MiB까지다');
    }
    if (plate.ai === null) add(API_PLATFORMS.has(plate.platform) ? FIX : LOOK, 'ai-label', where, '「AI표시」 칸이 없다(AI 목소리·AI 그림이 있으면 true)');
    if (!plate.cover && ['youtube', 'instagram', 'tiktok', 'xiaohongshu'].includes(plate.platform)) add(LOOK, 'cover', where, '표지 파일이 없다 — 첫 화면이 표지가 된다');
  }

  findings.push(...tiktokFindings(plates, prep, bundle.accounts));
  findings.push(...dailyFindings(plates, prep, bundle.accounts));
  findings.push(...tiktokDayFindings(plates));
  if (slotOk && prep.슬롯 === kst().slice(0, 10) && ![...posted.values()].some((v) => DONE.has(v))) {
    add(LOOK, 'slot-today', '준비.json', `슬롯이 오늘(${prep.슬롯})이다 — 4일 앞(D+4)에 만들어 승인을 미리 받는 것이 기본(제작 절차 0)`);
  }

  const fileSummaries = [];
  const ocrFindings = [];
  const screenTexts = [];
  const hanLanguage = (plate) => /^(zh|ja)/.test(plate.language || '') || plate.platform === 'xiaohongshu';
  for (const [file, users] of videos) {
    try {
      const label = labelOf(bundle, file);
      const r = await checkVideo(file, out, { skipOcr: opts.skipOcr, repo: bundle.repo, allowHan: users.some(hanLanguage), label });
      findings.push(...r.findings);
      ocrFindings.push(...r.ocrFindings);
      screenTexts.push(r.ocrText);
      fileSummaries.push({ 경로: 묶음.rel(bundle, file), 판: users.map((p) => p.account), ...r.summary });
    } catch (error) {
      add(FIX, 'video-check', path.basename(file), `영상 검사 실패: ${error.message}`);
    }
  }
  if (!opts.skipOcr) {
    // 같은 표지 파일을 여러 판이 쓰면 한 번만 읽고, 한자 허용은 그 판들 가운데 하나라도 중국어·일본어면, 계정은 모두 적는다.
    const covers = new Map();
    for (const plate of plates) if (plate.cover) covers.set(plate.cover, [...(covers.get(plate.cover) || []), plate]);
    // 판마다 같은 표지 틀이면 같은 줄이 걸린다 — 글이 같은 줄은 한 줄로 합친다.
    const byMessage = new Map();
    for (const [cover, users] of covers) {
      const accounts = users.map((p) => p.account);
      try {
        for (const f of ocrCover(cover, path.join(out, '표지_' + users[0].index), `${accounts.join(' · ')} 표지`, { allowHan: users.some(hanLanguage) })) {
          byMessage.set(f.message, [...(byMessage.get(f.message) || []), ...accounts]);
        }
      } catch (error) {
        add(LOOK, 'ocr-failed', `${accounts.join(' · ')} 표지`, `표지 글자 인식을 못 했다(${error.message})`);
      }
    }
    for (const [message, accounts] of byMessage) add(LOOK, 'cover-safe-area', `표지(${accounts.join(' · ')})`, message);
  }
  findings.push(...mergeAcrossFiles(ocrFindings));
  const script = 묶음.scriptText(bundle);
  let voice = { findings: [], summary: null };
  try { voice = await voiceFindings(bundle, [...videos.keys()], { scriptText: script.text }); } catch (error) {
    voice.findings.push({ level: LOOK, code: 'voice-failed', where: '목소리', message: `목소리 검사를 못 했다(${error.message}) — 귀로 듣는다` });
  }
  findings.push(...voice.findings);
  for (const html of [].concat(prep.키트원고 || [])) {
    const file = 묶음.resolve(bundle, html);
    if (!file || !fs.existsSync(file)) { add(FIX, 'kit-missing', '키트원고', `키트 원고가 없다: ${html}`); continue; }
    findings.push(...kitCheck(bundle, file, path.join(out, '키트_' + path.basename(file, '.html'))));
  }

  const docs = 묶음.companionTexts(bundle).map((d) => ({ ...d, name: `${d.kind} ${path.basename(d.file)}` }));
  for (const doc of docs) {
    // 판에 없는 초안(링크드인 등)은 오늘 올라가지 않으니 확인만 한다.
    for (const f of 규칙.checkText(doc.text, { where: doc.name, brand: prep.브랜드, language: 'ko', platform: 'blog', article: true })) add(doc.scheduled ? f.level : LOOK, f.code, f.where, f.message);
  }
  findings.push(...규칙.compareNumbers(docs, [...texts, ...screenTexts, script.text]));
  if (!opts.skipLinks) findings.push(...await checkLinks([...links]));
  findings.push(...await promptFindings(prep, { repo: bundle.repo, skipLinks: opts.skipLinks }));

  const fixes = findings.filter((f) => f.level === FIX);
  const looks = findings.filter((f) => f.level === LOOK);
  const result = fixes.length ? FIX : looks.length ? LOOK : '통과';
  const line = (f) => `${f.where} · ${f.message}`;
  const record = {
    도구: 'tools/올리기전검사.js', 시각: kst(), 결과: result,
    고칠것: fixes.map(line), 확인할것: looks.map(line), 파일: fileSummaries, ...(voice.summary ? { 목소리: voice.summary } : {}),
    ...(opts.skipOcr || opts.skipLinks ? { 건너뜀: [opts.skipOcr && '글자 인식', opts.skipLinks && '링크'].filter(Boolean) } : {}),
    기록: path.relative(bundle.repo, out).split(path.sep).join('/'),
  };
  fs.writeFileSync(path.join(out, '검사.json'), JSON.stringify({ ...record, 항목: findings, 대본: script.files }, null, 2) + '\n');
  if (!opts.noSave) {
    const fresh = 묶음.readJson(bundle.file); // 검사하는 동안 다른 칸이 바뀌었을 수 있어 다시 읽고 「검사」만 바꾼다
    fresh.검사 = record;
    fs.writeFileSync(bundle.file, JSON.stringify(fresh, null, 2) + '\n');
  }
  return { bundle, record, findings };
}

function parseArgs(argv) {
  const opts = { json: argv.includes('--json'), noSave: argv.includes('--저장안함'), skipLinks: argv.includes('--링크건너뛰기'), skipOcr: argv.includes('--글자인식건너뛰기') };
  const dirs = argv.filter((a) => !a.startsWith('--'));
  return { opts, dirs };
}

async function main() {
  const { opts, dirs } = parseArgs(process.argv.slice(2));
  if (dirs.length !== 1) {
    console.error('사용: node tools/올리기전검사.js <편 폴더> [--json] [--저장안함] [--링크건너뛰기] [--글자인식건너뛰기]');
    process.exitCode = 2;
    return;
  }
  const { bundle, record, findings } = await run(dirs[0], opts);
  if (opts.json) console.log(JSON.stringify({ ...record, 항목: findings }, null, 2));
  else {
    console.log(`올리기 전 검사 · ${bundle.name} · ${record.결과}${opts.noSave ? '' : ' (준비.json 「검사」에 남김)'}`);
    for (const f of record.파일) console.log(`  영상 ${f.경로.split('/').slice(-2).join('/')} · ${f.길이}초 · ${f.해상도} · 평균 ${f.평균Mbps}Mbps · ${f.음량} LUFS / ${f.봉우리} dBFS · 정지 ${f.정지} · 끝 화면 ${f.끝화면 ?? '모름'}초 · 가장 긴 한 구성 ${f.한구성}초`);
    if (record.목소리) console.log(`  목소리 줄 ${record.목소리.줄}개 · 최고 음높이 ${record.목소리.최고음높이 ?? '모름'}Hz · 잘린 줄 ${record.목소리.잘림}`);
    if (record.고칠것.length) { console.log(`고칠 것 ${record.고칠것.length}`); record.고칠것.forEach((x) => console.log(`  ✗ ${x}`)); }
    if (record.확인할것.length) { console.log(`확인할 것 ${record.확인할것.length}`); record.확인할것.forEach((x) => console.log(`  ? ${x}`)); }
    console.log(`  기록: ${record.기록}`);
  }
  if (record.결과 === FIX) process.exitCode = 1;
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 2; });

module.exports = { run, linesOf, problemsOf, promptFindings, tiktokFindings, dailyFindings, tiktokDayFindings, labelOf, plainWhite, voiceFiles, voiceFindings, parseTangle, tangledVoices, SAFE };
