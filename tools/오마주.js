#!/usr/bin/env node
'use strict';
/* 오마주 — 이미 검증된 인기 원본의 구조를 1:1로 옮기고 우리 색만 바꾼다(2026-10-28).
 *
 * 유호님 10-28 「다른 이미 검증된 인기 컨텐츠를 오마주(벤치마킹)해서 우리 색을 입히는 작업이 가장 안전하고 성과도 좋다」.
 * 10-28 점검에서 제작은 튄 편의 주제와 「좋아한 까닭」만 가져오고 컷 · 박자 · 훅 · 사람 연기는 버린 채 우리 집 틀(펠트 정지 그림 +
 * 천천히 밀기 + 글 카드 + TTS)로 다시 지었다 — E4 「아니」는 원본의 억양 연기가 정지 그림 + TTS로 바뀌었고 E8은 45%가 멈춘 글 카드였다.
 * 튄 것은 실제 움직임이 있는 E5 「처음 쓰는 ㄹ」(72시간 13배)뿐이었다. 그래서 원본을 먼저 재고, 그 컷표 위에 우리 화면 · 말만 채운다
 * (docs/마케팅/기획장부/제작절차.md 「오마주」).
 *
 *   node tools/오마주.js 분해 <주소|원본.mp4> [--편 <편 폴더>] [--갈래 같은분야|형식만|우리편] [--주소 <원본 주소>] [--다시]
 *   node tools/오마주.js 아르곤 <원본 ID> [--u 4|1]        Gemini 웹 4 Argon에 원본을 올려 첫 분석을 받는다(ego, 차례를 잡은 뒤)
 *   node tools/오마주.js 나란히 <편 폴더> [--영상 <우리.mp4>] [--json]
 *
 * 분해: 원본을 git 밖 <공용 작업본>/.tmp/오마주/<원본 ID>/에 받는다(유튜브 · 틱톡은 yt-dlp — H.264 + AAC를 먼저 고른다.
 *   릴스는 로그인 벽이라 tools/수요스캔/릴스읽기.mjs가 받은 mp4를 주고 --주소에 릴스 주소). 길이 · 크기 · 컷 시작 초(0.1초마다 이웃 장면 상관) ·
 *   한 구성 구간(tools/한구성.js) · 0.25초 소리 크기를 재고, 첫 3초(0.5초마다) · 컷마다 가운데 장면 묶음, 아르곤 첫 분석 지시문을 같은 폴더에 둔다.
 *   --편을 주면 그 편 폴더에 오마주.json(원본 주소 · 숫자 · 컷 시작 초만)을 쓰고 기획.md에 붙일 컷표 뼈대를 찍는다.
 *   원본의 영상 · 소리 · 말 · 화면 글은 저장소에 넣지 않는다(공개 저장소) — 오마주.json과 컷표에는 초와 우리 말로 쓴 구조만 둔다.
 * 아르곤: 분해 폴더의 원본(소리째)을 Gemini 웹 「4 Argon」 · 사고 수준 「높음」 새 대화에 올려 지시문을 보내고 답을 받는다. 같은 계정을 여러
 *   세션이 쓰므로 먼저 `python synk-vendor/_공용차례/차례.py gemini 기다리기 <이름> <할 일>`로 차례를 잡고 --u에 그 줄의 계정 번호를 준다.
 *   영상 권리 동의 창 · 한도 · 로봇 확인이 보이면 누르지 않고 멈춘다. 답은 .tmp(git 밖)에만 남는다 — 남의 말 · 가사 · 화면 글이 들어 있다.
 * 나란히: 우리 영상의 컷을 같은 셈으로 재 오마주.json의 원본 컷과 견준다 — 길이 · 컷 수 · 첫 2초 · 박자(같은 순서로 0.5초 안에 짝지어지는
 *   컷 비율). 원본 파일이 .tmp에 있으면 같은 자리의 두 장면을 나란히 묶은 그림도 만든다(git 밖). tools/올리기전검사.js ⑮가 같은 셈을 쓴다.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 공용작업본 } = require('./lib/공용작업본.js');
const 한구성 = require('./한구성.js');
const 정지 = require('./정지구간.js');

const ROOT = path.resolve(__dirname, '..');
const W = 54, H = 96, FPS = 10;
const CUT = 0.55; // 이웃 장면(0.1초 차) 상관이 이보다 낮으면 컷
const FLAT = 6; // 표준편차가 이보다 작으면 거의 한 색인 화면
const FLAT_JUMP = 40; // 한 색 화면끼리는 평균 밝기가 이만큼 달라지면 컷
const MIN_GAP = 0.2; // 이보다 가까운 컷은 하나로
const FONT = "C\\:/Windows/Fonts/arial.ttf";
// 나란히 기준 — 뼈대 일치를 본다(유호님 10-28 「기본을 1:1 구조로 가는게 맞지만 완전 똑같이 할 필요는 없어」): 훅 자리 · 칸 수 · 박자 · 반전 · 끝 장치.
// 칸을 컷으로 나눌지 한 장면 안에서 바꿀지(화면 짜임)는 우리 판단이라 바로 넘기는 컷 수는 보지 않고 칸(박자) 수를 본다. 박자 짝은 원본 · 우리 가운데
// 많은 쪽으로 나눈다 — 2초마다 넘기는 옛 집 틀(E8)이 우연히 겹친 짝으로 통과하지 않게. 다르게 할 것은 오마주.json 「다르게」에 무엇 · 까닭.
const 기준 = { 길이비: [0.7, 1.4], 길이초: 3, 칸수비: 0.3, 칸수최소: 2, 첫초: 2, 첫어긋남: 0.5, 박자허용: 0.6, 박자비: 0.6, 뼈대허용: 0.7 };
const 갈래들 = ['같은분야', '형식만', '우리편'];

const ffmpeg = (args, what) => {
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg 실패(${what}): ` + String(r.stderr || '').trim().split('\n').slice(-2).join(' '));
  return r;
};

function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,avg_frame_rate:format=duration', '-of', 'json', file],
    { encoding: 'utf8', windowsHide: true });
  let info = null;
  try { info = JSON.parse(String(r.stdout)); } catch { /* 아래에서 멈춘다 */ }
  const 길이 = Number(info?.format?.duration);
  if (r.status !== 0 || !(길이 > 0)) throw new Error('ffprobe로 길이를 못 읽었다: ' + String(r.stderr || '').trim());
  const v = (info.streams || []).find((s) => s.codec_type === 'video') || {};
  const a = (info.streams || []).find((s) => s.codec_type === 'audio') || null;
  const [n, d] = String(v.avg_frame_rate || '0/1').split('/').map(Number);
  return { 길이: Math.round(길이 * 100) / 100, 폭: v.width, 높이: v.height, fps: d ? Math.round((n / d) * 100) / 100 : null, 영상코덱: v.codec_name || null, 소리코덱: a?.codec_name || null };
}

// 0.1초마다 작은 회색 장면 → [{ z, flat, mean }]
function frames(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', path.resolve(file), '-vf', `fps=${FPS},scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'],
    { windowsHide: true, maxBuffer: 512 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('ffmpeg 실패(장면 읽기): ' + String(r.stderr || '').trim().split('\n').slice(-2).join(' '));
  const out = [];
  for (let off = 0; off + W * H <= r.stdout.length; off += W * H) {
    const v = r.stdout.subarray(off, off + W * H);
    let m = 0;
    for (const x of v) m += x;
    m /= v.length;
    let s = 0;
    for (const x of v) s += (x - m) ** 2;
    s = Math.sqrt(s / v.length);
    const z = new Float64Array(v.length);
    if (s >= FLAT) for (let i = 0; i < v.length; i += 1) z[i] = (v[i] - m) / s;
    out.push({ z, flat: s < FLAT, mean: m });
  }
  return out;
}

function isCut(a, b) {
  if (a.flat || b.flat) return a.flat !== b.flat || Math.abs(a.mean - b.mean) > FLAT_JUMP;
  let c = 0;
  for (let i = 0; i < a.z.length; i += 1) c += a.z[i] * b.z[i];
  return c / a.z.length < CUT;
}

// 장면 목록 → 컷이 시작하는 초 [0, …](0.1초 단위)
function cutStarts(list) {
  const starts = [0];
  for (let i = 1; i < list.length; i += 1) {
    if (!isCut(list[i - 1], list[i])) continue;
    const t = Math.round((i / FPS) * 10) / 10;
    if (t - starts[starts.length - 1] >= MIN_GAP) starts.push(t);
  }
  return starts;
}

// 박자 — 컷 없이 한 장면 안에서 화면이 한 번에 바뀌는 순간(새 자세 · 새 글줄 · 새 물건)까지 센다. 10-28 첫 예시 doci_korean
// 「How Koreans say thank you」(283만)는 고정 카메라 한 컷 14.7초인데, 1~3초마다 정지 장면이 한 단계씩 바뀌는 것이 재미의 박자였다.
// 0.3초 앞 장면과의 차이(1 − 상관)가 주변(±2초) 중앙값보다 뚜렷이 큰 봉우리를 박자로 보고, 컷은 늘 박자다.
const BEAT_LAG = 3, BEAT_MIN = 0.02, BEAT_K = 2.5, BEAT_GAP = 0.5;
function beatTimes(list, cuts = cutStarts(list)) {
  const d = list.map((f, i) => {
    if (i < BEAT_LAG) return 0;
    const a = list[i - BEAT_LAG];
    if (f.flat || a.flat) return f.flat === a.flat && Math.abs(f.mean - a.mean) <= FLAT_JUMP ? 0 : 1;
    let c = 0;
    for (let k = 0; k < f.z.length; k += 1) c += f.z[k] * a.z[k];
    return Math.max(0, 1 - c / f.z.length);
  });
  const out = new Set(cuts.filter((t) => t > 0));
  let last = -Infinity;
  for (let i = BEAT_LAG; i < d.length; i += 1) {
    if (d[i] < BEAT_MIN || d[i - 1] >= d[i] * 0.8) continue; // 봉우리의 첫 칸만(앞 칸보다 뚜렷이 올라선 자리)
    const win = d.slice(Math.max(0, i - 20), i + 21).slice().sort((x, y) => x - y);
    const base = win[Math.floor(win.length / 2)];
    if (d[i] < base * BEAT_K + 0.01) continue;
    const t = Math.round((i / FPS) * 10) / 10;
    if (t - last >= BEAT_GAP) { out.add(t); last = t; }
  }
  const sorted = [...out].sort((x, y) => x - y);
  return sorted.filter((t, k) => k === 0 || t - sorted[k - 1] >= MIN_GAP);
}

const cutsOf = (file) => cutStarts(frames(file));
function measure(file) {
  const list = frames(file);
  const 컷 = cutStarts(list);
  return { 컷, 박자: beatTimes(list, 컷) };
}

// 0.25초마다 소리 크기(dBFS, 소리가 없으면 null)
function loudness(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', path.resolve(file), '-vn', '-ac', '1', '-ar', '8000', '-f', 's16le', '-'],
    { windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout.length) return null;
  const per = 2000; // 0.25초 = 8000 × 0.25
  const out = [];
  for (let off = 0; off + 2 <= r.stdout.length; off += per * 2) {
    let s = 0, n = 0;
    for (let k = off; k + 1 < Math.min(off + per * 2, r.stdout.length); k += 2) { const x = r.stdout.readInt16LE(k) / 32768; s += x * x; n += 1; }
    out.push(n ? Math.round(10 * Math.log10(s / n + 1e-10)) : -100);
  }
  return out;
}

// ── 비교 ──

// 원본 컷(시작 초)과 우리 컷을 같은 순서로 짝짓는다 — 우리 초는 원본 길이에 맞게 늘이거나 줄인 뒤(0.5초 안).
function pairCuts(orig, ours, scale = 1, tol = 기준.박자허용) {
  const a = orig.filter((t) => t > 0);
  const b = ours.filter((t) => t > 0).map((t) => t * scale);
  const pairs = [];
  let j = 0;
  for (const t of a) {
    let k = j;
    while (k < b.length && b[k] < t - tol) k += 1;
    if (k < b.length && Math.abs(b[k] - t) <= tol) { pairs.push([t, b[k]]); j = k + 1; }
  }
  const off = pairs.map(([x, y]) => Math.abs(x - y)).sort((x, y) => x - y);
  const 큰쪽 = Math.max(a.length, b.length);
  return { 짝: pairs.length, 원본컷: a.length, 우리컷: b.length, 비율: 큰쪽 ? pairs.length / 큰쪽 : 1, 중앙어긋남: off.length ? Math.round(off[Math.floor(off.length / 2)] * 100) / 100 : null };
}

const 첫컷 = (starts, end) => starts.filter((t) => t > 0 && t <= end);
// 첫 0.5초 안의 바뀜(첫 장면이 떠오르는 페이드 · 밀려 들어옴)은 훅 박자로 치지 않는다 — 1:1인 렌더가 첫 2초에서 거짓으로 걸렸다(10-28 Fable P2)
const 이른박자 = 0.5;
const 초 = (x) => `${Math.round(x * 10) / 10}초`;

// orig · ours: { 길이, 컷, 박자, 뼈대? } → { 맞음, 항목: [{ 이름, 맞음, 글, 다르게 }] }
// 뼈대(오마주.json) = { 훅, 반전, 끝 } — 원본에서 그 일이 시작하는 초(없으면 null). 반전 · 끝 자리에 우리 박자가 있어야 한다.
function compare(orig, ours, { 다르게 = [] } = {}) {
  const 허락 = new Map((다르게 || []).map((d) => [String(d.무엇 || '').trim(), String(d.까닭 || '').trim()]).filter(([k, v]) => k && v));
  const 항목 = [];
  const add = (이름, 맞음, 글) => 항목.push({ 이름, 맞음, 글, ...(허락.has(이름) && !맞음 ? { 다르게: 허락.get(이름) } : {}) });
  const 비 = ours.길이 / orig.길이;
  add('길이', (비 >= 기준.길이비[0] && 비 <= 기준.길이비[1]) || Math.abs(ours.길이 - orig.길이) <= 기준.길이초,
    `원본 ${초(orig.길이)} · 우리 ${초(ours.길이)}(${Math.round(비 * 100)}%)`);
  const 원박 = [0, ...(orig.박자 || orig.컷).filter((t) => t >= 이른박자)], 우박 = [0, ...(ours.박자 || ours.컷).filter((t) => t >= 이른박자)];
  const n원본 = 원박.length, n우리 = 우박.length;
  add('칸 수', Math.abs(n원본 - n우리) <= Math.max(기준.칸수최소, Math.round(n원본 * 기준.칸수비)),
    `원본 ${n원본}칸(바로 넘기는 컷 ${orig.컷.length}) · 우리 ${n우리}칸(컷 ${ours.컷.length})`);
  const scale = orig.길이 / ours.길이;
  // 첫 2초는 시청자가 넘길지 정하는 실제 초라 늘이거나 줄이지 않고 그대로 견준다
  const a = 첫컷(원박, 기준.첫초), b = 첫컷(우박, 기준.첫초);
  const 첫맞음 = Math.abs(a.length - b.length) <= 1 && (a.length === 0 ? b.length === 0 : b.length > 0 && Math.abs(a[0] - b[0]) <= 기준.첫어긋남);
  add('첫 2초', 첫맞음, `원본 첫 2초 박자 ${a.length}(${a.map(초).join(' · ') || '없음'}) · 우리 ${b.length}(${b.map(초).join(' · ') || '없음'})`);
  const p = pairCuts(원박, 우박, scale, 기준.박자허용);
  add('박자', p.원본컷 === 0 ? p.우리컷 <= 1 : p.비율 >= 기준.박자비,
    p.원본컷 === 0 ? `원본은 바뀌는 순간이 없다 · 우리 ${p.우리컷}번` : `원본 박자 ${p.원본컷}번 · 우리 ${p.우리컷}번 가운데 ${p.짝}번이 같은 순서로 ${기준.박자허용}초 안(많은 쪽의 ${Math.round(p.비율 * 100)}%) · 짝의 중앙 어긋남 ${p.중앙어긋남 ?? '—'}초`);
  const 뼈 = orig.뼈대 || null;
  if (뼈) {
    const 자리 = [['반전', 뼈.반전], ['끝', 뼈.끝]].filter(([, t]) => Number.isFinite(t) && t > 0);
    const 빠짐 = 자리.filter(([, t]) => !우박.some((u) => u > 0 && Math.abs(u * scale - t) <= 기준.뼈대허용));
    add('뼈대 자리', !빠짐.length, 자리.length
      ? `원본 ${자리.map(([k, t]) => `${k} ${초(t)}`).join(' · ')} — ${빠짐.length ? `우리 영상에서 ${빠짐.map(([k]) => k).join(' · ')} 자리(원본 길이에 맞춘 ±${기준.뼈대허용}초)에 바뀌는 순간이 없다` : '우리도 그 자리에서 바뀐다'}`
      : '반전 · 끝 자리가 비어 있다(오마주.json 「뼈대」)');
  }
  return { 맞음: 항목.every((x) => x.맞음 || x.다르게), 항목, 짝: p };
}

// ── 원본 받기 ──

function parseSource(text) {
  const s = String(text || '').trim();
  let m = s.match(/youtube\.com\/shorts\/([\w-]{11})/) || s.match(/youtu\.be\/([\w-]{11})/) || s.match(/[?&]v=([\w-]{11})/);
  if (m) return { 곳: '유튜브', id: m[1], 주소: `https://www.youtube.com/shorts/${m[1]}` };
  m = s.match(/tiktok\.com\/(@[\w.]+)\/video\/(\d+)/);
  if (m) return { 곳: '틱톡', id: m[2], 주소: `https://www.tiktok.com/${m[1]}/video/${m[2]}` };
  m = s.match(/instagram\.com\/(?:reel|reels|p)\/([\w-]+)/);
  if (m) return { 곳: '인스타', id: m[1], 주소: `https://www.instagram.com/reel/${m[1]}/` };
  if (/facebook\.com|fb\.watch/.test(s)) return { 곳: '페이스북', id: null, 주소: s };
  if (/^[\w-]{11}$/.test(s)) return { 곳: '유튜브', id: s, 주소: `https://www.youtube.com/shorts/${s}` };
  return null;
}

const 원본뿌리 = () => path.join(공용작업본(ROOT), '.tmp', '오마주');
const 안전이름 = (x) => String(x).replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60);

function download(src, dir) {
  const ytdlp = process.env.SYNK_YTDLP || 'yt-dlp';
  // 아르곤은 AV1 원본의 소리를 못 받는다(10-25 현장노트 gemini_사진) — H.264 + AAC를 먼저 고른다.
  const fmt = 'bv*[vcodec^=avc1][height<=1920]+ba[acodec^=mp4a]/b[ext=mp4][vcodec^=avc1]/bv*[height<=1920]+ba/b';
  const r = spawnSync(ytdlp, ['--ignore-config', '--no-playlist', '--no-progress', '-f', fmt, '--merge-output-format', 'mp4', '--write-info-json',
    '-o', path.join(dir, '원본.%(ext)s'), src.주소], { encoding: 'utf8', windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, maxBuffer: 64 * 1024 * 1024 });
  const file = path.join(dir, '원본.mp4');
  if (r.status !== 0 || !fs.existsSync(file)) throw new Error(`원본을 못 받았다(${src.주소}): ` + String(r.stderr || r.stdout || '').trim().split('\n').slice(-2).join(' '));
  let meta = {};
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, '원본.info.json'), 'utf8'));
    meta = { 채널: j.channel || j.uploader || null, 채널id: j.channel_id || null, 제목: j.title || null, 조회: j.view_count ?? null, 좋아요: j.like_count ?? null,
      댓글: j.comment_count ?? null, 올린날: j.upload_date ? `${j.upload_date.slice(0, 4)}-${j.upload_date.slice(4, 6)}-${j.upload_date.slice(6, 8)}` : null };
  } catch { /* 숫자 없이 간다 */ }
  return { file, meta };
}

// 아르곤에 올릴 판 — H.264 + AAC가 아니면 다시 담는다
function forArgon(dir, info) {
  const src = path.join(dir, '원본.mp4');
  if (info.영상코덱 === 'h264' && (!info.소리코덱 || info.소리코덱 === 'aac')) return src;
  const out = path.join(dir, '원본_h264.mp4');
  if (!fs.existsSync(out)) ffmpeg(['-i', src, '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', out], 'H.264로 다시 담기');
  return out;
}

// ── 묶음 그림 ──

function grab(file, at, w, h, label, out) {
  const vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,`
    + `drawtext=fontfile='${FONT}':text='${label}':x=6:y=6:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=5`;
  ffmpeg(['-ss', Math.max(0, at).toFixed(3), '-i', file, '-vf', vf, '-frames:v', '1', out], `${label} 장면`);
}

function tile(pngs, cols, out) {
  const dir = path.dirname(pngs[0]);
  const list = path.join(dir, '목록.txt');
  fs.writeFileSync(list, pngs.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-frames:v', '1', '-vf', `tile=${cols}x${Math.ceil(pngs.length / cols)}:nb_frames=${pngs.length}:padding=6:color=white`, '-q:v', '3', out], '묶기');
}

function sheet(file, shots, out, { w = 270, h = 480, cols = 4 } = {}) {
  const tmp = fs.mkdtempSync(path.join(path.dirname(out), '.장면-'));
  try {
    const pngs = shots.map((s, i) => { const p = path.join(tmp, `${String(i).padStart(3, '0')}.png`); grab(file, s.at, w, h, s.label, p); return p; });
    if (pngs.length) tile(pngs, cols, out);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

const 첫3초장면 = (길이) => [0, 0.5, 1, 1.5, 2, 2.5, 3].filter((t) => t < 길이).map((t) => ({ at: t, label: `${t.toFixed(1)}s` }));
// 칸 = 박자와 박자 사이(컷이 없는 원본도 바뀌는 순간마다 한 칸). 칸마다 그 칸 끝 조금 앞 장면(바뀐 뒤 가장 오래 보이는 모습)
const 칸들 = (starts, 길이) => [0, ...starts.filter((t) => t > 0)].map((s, i, a) => ({ s, e: i + 1 < a.length ? a[i + 1] : 길이 }));
const 칸장면 = (starts, 길이) => 칸들(starts, 길이).map(({ s, e }, i) => ({ at: Math.max(s, e - 0.15), label: `${i + 1} ${s.toFixed(1)}-${e.toFixed(1)}s` }));
// 원본에서 4초 넘게 이어진 한 구성(올리기 전 검사 ⑬이 같은 자리의 우리 구성을 「확인할 것」으로 내린다)
const 긴구성 = (segments, 상한 = 한구성.LIMIT) => segments.filter((x) => x.length > 상한 + 한구성.STEP + 1e-9).map((x) => [x.start, x.end]);

// ── 아르곤 지시문 ──

function argonPrompt(info) {
  return [
    `첨부한 영상은 짧은 세로 영상 하나다(${초(info.길이)}). 이 영상을 소리째 보고 듣고, 같은 구조로 다른 주제의 영상을 만들 사람이 그대로 따라 짤 수 있게 분해해 줘.`,
    '',
    '1. 기본 — 길이 · 비율 · 컷 수와 전환 종류(바로 넘김 · 녹임 · 밀기 등).',
    '2. 컷마다(표) — 시작–끝 초(소수 첫째 자리) · 크기(얼굴 · 상반신 · 손 · 화면 녹화 · 글 카드 등) · 카메라 자리와 움직임(고정 · 다가감 · 옆 · 흔들림, 몇 초에 얼마나) · 화면에서 일어나는 일 · 화면 글자(무엇이 어디에 몇 초부터 몇 초까지, 크기) · 소리(누가 말하나 · 입이 보이며 움직이나 · 효과음 · 음악).',
    '3. 첫 2초 — 시청자에게 무엇을 약속하나(왜 계속 보게 되나).',
    '4. 재미가 나는 자리 — 몇 초에 무엇 때문에(사람 억양 · 표정 · 몸 연기 / 글자 · 숫자 / 손으로 쓰기 · 그리기 / 화면 녹화 / 편집 박자 / 반전). 사람 연기가 없으면 재미가 남는지도 한 줄로.',
    '5. 끝 — 마지막 3초에 무엇을 주나(보상 · 반전 · 질문 · 저장할 거리), 몇 초에 끝나나.',
    '6. 소리 흐름 — 음악이 들어오고 빠지는 초 · 조용한 자리 · 말이 빠른 곳.',
    '7. 놓치기 쉬운 디테일, 그리고 확실하지 않은 것과 네가 잰 정밀도.',
    '',
    '보이고 들리는 것만 적고, 추측은 (추측)이라고 적어. 화면 글자 · 말은 원문 그대로 적어도 된다.',
  ].join('\n');
}

// ── 명령: 분해 ──

function decompose(arg, opts = {}) {
  const local = fs.existsSync(arg) && fs.statSync(arg).isFile();
  // 우리편 원본(우리 최종본 mp4)은 --주소(그 편 유튜브 주소)가 없으면 공용 작업본 안 경로를 주소로 쓴다 — ⑮가 원본을 알아보게(10-28 Fable P1)
  const 파일주소 = () => { const rel = path.relative(공용작업본(ROOT), path.resolve(arg)); return (rel.startsWith('..') ? path.resolve(arg) : rel).split(path.sep).join('/'); };
  // 편 폴더 밖 파일(예: .tmp/오마주/ig_<code>/원본.mp4)은 그 위 폴더 이름을 붙여 서로 다른 원본이 한 폴더를 덮지 않게
  const 편이름 = () => { const parts = 파일주소().split('/'); const k = parts.indexOf('마케팅'); const 앞 = k >= 0 && parts[k + 1] ? parts[k + 1] : parts[parts.length - 2]; return (앞 ? 앞 + '_' : '') + path.basename(arg, path.extname(arg)); };
  const src = local ? (parseSource(opts.주소) || { 곳: '파일', id: 편이름(), 주소: opts.주소 || 파일주소() }) : parseSource(arg);
  if (!src) throw new Error(`원본 주소를 모른다(유튜브 쇼츠 · 틱톡 · 인스타 릴스 주소나 mp4 파일): ${arg}`);
  if (!local && (src.곳 === '인스타' || src.곳 === '페이스북')) {
    throw new Error(`${src.곳}는 로그인 벽이라 yt-dlp로 못 받는다 — tools/수요스캔/릴스읽기.mjs가 받은 mp4를 주고 --주소 ${src.주소}`);
  }
  const dir = opts.밖 ? path.resolve(opts.밖) : path.join(원본뿌리(), 안전이름(`${src.곳 === '유튜브' ? 'yt' : src.곳 === '틱톡' ? 'tt' : src.곳 === '인스타' ? 'ig' : 'file'}_${src.id}`));
  fs.mkdirSync(dir, { recursive: true });
  let meta = {};
  const file = path.join(dir, '원본.mp4');
  if (local) { if (path.resolve(arg) !== file) fs.copyFileSync(arg, file); }
  else if (!fs.existsSync(file) || opts.다시) ({ meta } = download(src, dir));
  else { try { const j = JSON.parse(fs.readFileSync(path.join(dir, '측정.json'), 'utf8')); meta = j.원본 || {}; } catch { /* 숫자 없이 */ } }
  const info = probe(file);
  const { 컷, 박자 } = measure(file);
  const 구성 = 한구성.analyze(file);
  const 멈춤 = 정지.analyze(file);
  const 소리 = loudness(file);
  const argonFile = forArgon(dir, info);
  sheet(file, 첫3초장면(info.길이), path.join(dir, '첫3초.jpg'), { cols: 7, w: 216, h: 384 });
  sheet(file, 칸장면(박자, info.길이), path.join(dir, '칸.jpg'));
  fs.writeFileSync(path.join(dir, '아르곤_지시문.md'), argonPrompt(info) + '\n');
  const 원본 = { 주소: src.주소, 곳: src.곳, id: src.id, ...pick(meta, ['채널', '채널id', '조회', '좋아요', '댓글', '올린날']), 길이: info.길이, 크기: `${info.폭}x${info.높이}`, 잰날: today() };
  const 측정 = { 도구: 'tools/오마주.js 분해', 원본: { ...원본, 제목: meta.제목 || null }, 영상: info, 컷, 박자,
    한구성: 구성.segments.map((x) => [x.start, x.end]), 긴구성: 긴구성(구성.segments), 멈춤: 멈춤요약(멈춤), 소리0_25초: 소리, 아르곤판: path.basename(argonFile) };
  fs.writeFileSync(path.join(dir, '측정.json'), JSON.stringify(측정, null, 1) + '\n');
  let 편 = null;
  if (opts.편) 편 = writeEpisode(path.resolve(opts.편), { 원본, 컷, 박자, 긴구성: 측정.긴구성, 멈춤: 측정.멈춤, 갈래: opts.갈래, 폴더: dir });
  return { dir, 원본, 컷, 박자, 영상: info, 편 };
}

// 원본의 거의 멈춘 시간(tools/정지구간.js) — 올리기 전 검사 ②가 같은 만큼 멈춘 우리 편을 「확인할 것」으로 내린다
const 멈춤요약 = (r) => ({ 비율: Math.round(r.ratio * 100) / 100, 구간: r.runs.map((x) => [x.start, x.end]) });
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined && o[k] !== null).map((k) => [k, o[k]]));
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());

function writeEpisode(dir, { 원본, 컷, 박자, 긴구성: 길게, 멈춤, 갈래, 폴더 }) {
  if (갈래 && !갈래들.includes(갈래)) throw new Error(`--갈래는 ${갈래들.join(' · ')} 가운데 하나다: ${갈래}`);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, '오마주.json');
  let old = {};
  try { old = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* 처음 */ }
  // 「확정」 뒤에는 손으로 고친 컷 · 박자를 덮지 않는다
  const 손 = Boolean(old.확정);
  const next = { 판: 1, ...old, 원본, 갈래: 갈래 || old.갈래 || null, 컷: 손 ? old.컷 : 컷, 박자: 손 ? old.박자 : 박자, 긴구성: 손 && old.긴구성 ? old.긴구성 : 길게, 멈춤,
    // 뼈대는 Claude가 칸을 보고 정한다 — 처음엔 훅 = 첫 박자(2초 안이면) · 끝 = 마지막 칸 시작만 채우고 반전은 비운다
    뼈대: old.뼈대 || { 훅: 박자.find((t) => t > 0 && t <= 2) ?? null, 반전: null, 끝: 박자.length ? 박자[박자.length - 1] : null },
    확정: 손, 다르게: old.다르게 || [], 원본폴더: path.relative(공용작업본(ROOT), 폴더).split(path.sep).join('/') };
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
  return { file, 컷표: cutTable(next) };
}

// 기획.md 「원본 1:1」에 붙일 뼈대 — 원본 칸은 우리 말로 쓴 구조만(원본의 말 · 글을 옮기지 않는다)
function cutTable(j) {
  const 길이 = j.원본.길이;
  const cuts = new Set(j.컷);
  const rows = 칸들(j.박자 || j.컷, 길이).map(({ s, e }, i) => `| ${i + 1} | ${s.toFixed(1)}–${e.toFixed(1)}${cuts.has(s) ? ' 컷' : ''} |  |  |  |  |  |  |`);
  return [
    `원본 ${j.원본.주소} · ${초(길이)} · ${j.컷.length}컷 · 박자 ${(j.박자 || j.컷).length}번 · 갈래 ${j.갈래 || '(같은분야 · 형식만 · 우리편)'} — 측정 \`${j.원본폴더}\`(git 밖)`,
    `뼈대(지킬 것): 훅 ${j.뼈대?.훅 ?? '?'}초 · 반전 ${j.뼈대?.반전 ?? '?'}초 · 끝 ${j.뼈대?.끝 ?? '?'}초 · 칸 수 · 박자 — 우리 색 · 배울 것 · 화면 짜임은 바꿔도 된다(제작 절차 「오마주」)`,
    '',
    '| 칸 | 원본 초 | 원본에서 이 칸이 하는 일(우리 말로) | 크기 · 카메라 | 화면 글 꼴(자리 · 크기 · 초) | 소리 | 우리 화면 | 우리 말 · 글 |',
    '|---|---|---|---|---|---|---|---|',
    ...rows,
  ].join('\n');
}

// ── 명령: 나란히 ──

function episodeVideo(dir) {
  const prepFile = path.join(dir, '게시', '준비.json');
  if (!fs.existsSync(prepFile)) return null;
  const prep = JSON.parse(fs.readFileSync(prepFile, 'utf8'));
  for (const p of prep.판 || []) {
    const f = p.원본 || p.파일;
    if (typeof f === 'string' && /\.mp4$/i.test(f)) {
      const abs = [path.resolve(dir, f), path.resolve(dir, '게시', f), path.resolve(공용작업본(ROOT), f)].find((x) => fs.existsSync(x));
      if (abs) return abs;
    }
  }
  return null;
}

function sideBySide(origFile, ourFile, orig, ours, out) {
  const scale = ours.길이 / orig.길이;
  const at = [...첫3초장면(orig.길이).map((s) => s.at), ...칸장면(orig.박자 || orig.컷, orig.길이).map((s) => s.at)];
  const uniq = [...new Set(at.map((t) => Math.round(t * 10) / 10))].sort((a, b) => a - b);
  const tmp = fs.mkdtempSync(path.join(path.dirname(out), '.나란히-'));
  try {
    const pairs = uniq.map((t, i) => {
      const a = path.join(tmp, `${i}a.png`), b = path.join(tmp, `${i}b.png`), p = path.join(tmp, `${String(i).padStart(3, '0')}.png`);
      grab(origFile, t, 216, 384, `SRC ${t.toFixed(1)}s`, a);
      grab(ourFile, t * scale, 216, 384, `OURS ${(t * scale).toFixed(1)}s`, b);
      ffmpeg(['-i', a, '-i', b, '-filter_complex', 'hstack=inputs=2', p], '두 장면 잇기');
      return p;
    });
    tile(pairs, 3, out);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

function sideCheck(dir, opts = {}) {
  const file = path.join(dir, '오마주.json');
  if (!fs.existsSync(file)) throw new Error(`오마주.json이 없다: ${file} — 먼저 node tools/오마주.js 분해 <원본> --편 ${dir}`);
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const video = opts.영상 ? path.resolve(opts.영상) : episodeVideo(dir);
  if (!video || !fs.existsSync(video)) throw new Error('우리 영상을 못 찾았다 — --영상 <우리.mp4>');
  const ours = { 길이: probe(video).길이, ...measure(video) };
  const orig = { 길이: j.원본.길이, 컷: j.컷, 박자: j.박자 || j.컷, 뼈대: j.뼈대 || null };
  const result = compare(orig, ours, { 다르게: j.다르게 });
  let 그림 = null;
  const origFile = j.원본폴더 ? path.join(공용작업본(ROOT), j.원본폴더, '원본.mp4') : null;
  if (origFile && fs.existsSync(origFile)) {
    그림 = path.join(path.dirname(origFile), `나란히_${안전이름(path.basename(dir))}.jpg`);
    try { sideBySide(origFile, video, orig, ours, 그림); } catch (e) { 그림 = `못 만듦 — ${e.message}`; }
  }
  return { 영상: video, 우리: ours, ...result, 그림, 확정: Boolean(j.확정) };
}

// ── 명령: 아르곤(ego) ──

function argon(id, opts = {}) {
  const dir = fs.existsSync(id) ? path.resolve(id) : path.join(원본뿌리(), 안전이름(id));
  const 측정 = JSON.parse(fs.readFileSync(path.join(dir, '측정.json'), 'utf8'));
  const video = path.join(dir, 측정.아르곤판 || '원본.mp4');
  const prompt = fs.readFileSync(path.join(dir, '아르곤_지시문.md'), 'utf8').trim();
  const u = String(opts.u || 4);
  if (!/^\d$/.test(u)) throw new Error('--u는 Gemini 계정 번호 한 자리(a 줄 77yuhbs = 4 · b 줄 unmet25 = 1)');
  const job = { video: video.replace(/\\/g, '/'), prompt, out: path.join(dir, '아르곤_답.md').replace(/\\/g, '/'), shots: dir.replace(/\\/g, '/'), u: Number(u) };
  const body = fs.readFileSync(path.join(__dirname, '오마주_아르곤.mjs'), 'utf8');
  const script = `globalThis.JOB = ${JSON.stringify(job)};\n${body}`;
  const r = spawnSync('ego-browser nodejs', { input: script, encoding: 'utf8', windowsHide: true, timeout: 15 * 60_000, shell: true });
  process.stdout.write(r.stdout || '');
  if (r.status !== 0) throw new Error('아르곤 보내기 실패: ' + String(r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' '));
  return job.out;
}

// ── 입구 ──

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json' || a === '--다시') o[a.slice(2)] = true;
    else if (a.startsWith('--')) { const v = argv[i + 1]; if (v === undefined || v.startsWith('--')) throw new Error(`${a} 뒤에 값이 없다`); o[a.slice(2)] = v; i += 1; }
    else o._.push(a);
  }
  return o;
}

function main(argv) {
  const o = parseArgs(argv);
  const [cmd, arg] = o._;
  if (cmd === '분해' && arg) {
    const r = decompose(arg, o);
    if (o.json) { console.log(JSON.stringify(r, null, 1)); return 0; }
    console.log(`원본 ${r.원본.주소 || arg} · ${초(r.영상.길이)} · ${r.영상.폭}x${r.영상.높이} · ${r.컷.length}컷(${r.컷.map((t) => t.toFixed(1)).join(' ')}) · 박자 ${r.박자.length}칸(${r.박자.map((t) => t.toFixed(1)).join(' ')})`);
    console.log(`  측정 · 묶음 그림 · 아르곤 지시문: ${r.dir}(git 밖)`);
    if (r.편) { console.log(`  편: ${r.편.file}\n\n${r.편.컷표}\n`); }
    console.log('다음: 칸.jpg · 첫3초.jpg로 컷 · 박자를 눈으로 확정해 오마주.json 「컷」 · 「박자」 · 「뼈대」(훅 · 반전 · 끝이 시작하는 원본 초)를 고치고 「확정」: true → 아르곤 첫 분석(node tools/오마주.js 아르곤 <원본 ID> --u <계정 번호>, 차례를 잡은 뒤) → 컷표의 원본 칸을 우리 말로 채우고 우리 화면 · 말 칸을 쓴다.');
    return 0;
  }
  if (cmd === '아르곤' && arg) { console.log(`아르곤 답: ${argon(arg, o)}(git 밖)`); return 0; }
  if (cmd === '나란히' && arg) {
    const r = sideCheck(path.resolve(arg), o);
    if (o.json) { console.log(JSON.stringify(r, null, 1)); return r.맞음 ? 0 : 1; }
    console.log(`나란히 · ${path.basename(path.resolve(arg))} · ${r.맞음 ? '맞음' : '고칠 것'}${r.확정 ? '' : ' (원본 컷이 아직 「확정」 전)'}`);
    for (const x of r.항목) console.log(`  ${x.맞음 ? '✓' : x.다르게 ? '~' : '✗'} ${x.이름} — ${x.글}${x.다르게 ? ` · 다르게: ${x.다르게}` : ''}`);
    if (r.그림) console.log(`  나란히 그림: ${r.그림}(git 밖)`);
    return r.맞음 ? 0 : 1;
  }
  console.error('사용: node tools/오마주.js 분해 <주소|원본.mp4> [--편 <편 폴더>] [--갈래 같은분야|형식만|우리편] [--주소 <원본 주소>] [--다시]\n'
    + '      node tools/오마주.js 아르곤 <원본 ID> [--u 4|1]\n      node tools/오마주.js 나란히 <편 폴더> [--영상 <우리.mp4>] [--json]');
  return 2;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 2; }
}

module.exports = { compare, pairCuts, cutStarts, beatTimes, cutsOf, measure, parseSource, probe, cutTable, sideCheck, episodeVideo, 칸들, 기준, 갈래들 };
