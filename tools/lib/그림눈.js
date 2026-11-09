'use strict';
/* 그림눈 — 시각 검수 도구(미학맹검 · 그림검사 · 합성미리보기)가 같이 쓰는 손발(2026-11-10, LAB 하루 두 편 설계 15~18).
 *
 * - GPT묻기: GPT(ChatGPT 구독 Codex — tools/codex계정.js 굽기 계정 돌려쓰기, 돈 안 나감)에게 그림 몇 장과 글을 보여 답을 받는다.
 *   빈 임시 폴더 · 읽기 전용 · 「도구 쓰지 말 것」 머리 — tools/GPT시험관.mjs 구독 경로와 같은 꼴. 시험은 SYNK_CODEX_ROTATE로 가짜를 준다.
 * - 프레임뽑기 · 띠만들기 · 줄시트: ffmpeg로 영상의 프레임 번호를 정확히 뽑아(-ss는 한두 프레임 밀린다 — 현장 노트 영상) 칸을 붙인다.
 * - 정본시트: 몽글 정본(tools/lib/마스코트자산.js — 생김새 참고로만, 화면에 얹지 않는다)을 흰 바탕 한 장으로(투명 PNG는 참고가 안 먹는다 — 장부 S17).
 * - 격자 · 격자같음: 그림 지문(32×32 회색 칸 평균). 다시 렌더한 영상에서 같은 컷인지 견준다(미세한 인코딩 차이는 같은 컷으로).
 * ffmpeg 부르기는 바꿔 끼울 수 있다(시험은 가짜 실행기 — CI에는 ffmpeg가 없다).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

const 뿌리 = path.resolve(__dirname, '..', '..');
const 도구머리 = 'Do not run any shell commands, do not open, create or edit any files and do not use any tools. Answer only from the text and images in this message.';

/* ── ffmpeg ─────────────────────────────────────────────────────────── */

function ffmpeg돌리기(args, { 바이트 = false } = {}) {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-v', 'error', ...args], { encoding: 바이트 ? 'buffer' : 'utf8', windowsHide: true, maxBuffer: 256 << 20 });
  if (r.error) throw new Error(`ffmpeg를 못 불렀다: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`ffmpeg 실패: ${String(r.stderr || '').trim().split(/\r?\n/).slice(-2).join(' ')}`);
  return r.stdout;
}

function ffprobe돌리기(args) {
  const r = spawnSync('ffprobe', ['-v', 'error', ...args], { encoding: 'utf8', windowsHide: true });
  if (r.error) throw new Error(`ffprobe를 못 불렀다: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`ffprobe 실패: ${String(r.stderr || '').trim().split(/\r?\n/).pop()}`);
  return r.stdout;
}

/** 영상 정보 — fps(분수 풀어 씀) · 길이(초) · 너비 · 높이. */
function 영상정보(영상, 묻기 = ffprobe돌리기) {
  const j = JSON.parse(묻기(['-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate,width,height,duration,nb_frames:format=duration', '-of', 'json', 영상]));
  const s = (j.streams || [])[0] || {};
  const [a, b] = String(s.r_frame_rate || '30/1').split('/').map(Number);
  const fps = b ? a / b : a;
  const 길이 = Number(s.duration) || Number(j.format?.duration) || (Number(s.nb_frames) && fps ? Number(s.nb_frames) / fps : 0);
  return { fps: Number.isFinite(fps) && fps > 0 ? fps : 30, 길이, 너비: Number(s.width) || 0, 높이: Number(s.height) || 0 };
}

// drawtext 글꼴 — 맑은 고딕(한글 · 라틴)이 있으면 그것, 없으면 라틴 글꼴(칸 이름은 되도록 ASCII로 쓴다). 없으면 글 없이 붙인다
function 글꼴() {
  for (const f of ['C:/Windows/Fonts/malgun.ttf', 'C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/System/Library/Fonts/Supplemental/Arial.ttf']) if (fs.existsSync(f)) return f;
  return null;
}
const 글꼴인자 = (f) => String(f).replace(/\\/g, '/').replace(/:/g, '\\:');
const 이름표 = (글, f = 글꼴()) => (f ? `,drawtext=fontfile='${글꼴인자(f)}':text='${String(글).replace(/[':\\]/g, '')}':x=12:y=12:fontsize=40:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=10` : '');

/** 영상에서 프레임 번호들을 한 번에 정확히 뽑는다 → Map(번호 → 그림 경로). 번호는 0부터(select n). */
function 프레임뽑기(영상, 번호들, 밖폴더, { 폭 = 540, 실행 = ffmpeg돌리기 } = {}) {
  const 고유 = [...new Set(번호들.map((n) => Math.max(0, Math.round(n))))].sort((a, b) => a - b);
  if (!고유.length) return new Map();
  fs.mkdirSync(밖폴더, { recursive: true });
  const 틀 = path.join(밖폴더, 'f_%03d.png');
  const 고르기 = 고유.map((n) => `eq(n\\,${n})`).join('+');
  실행(['-i', 영상, '-vf', `select='${고르기}',scale=${폭}:-2:flags=lanczos`, '-fps_mode', 'passthrough', '-start_number', '0', 틀]);
  return new Map(고유.map((n, i) => [n, path.join(밖폴더, `f_${String(i).padStart(3, '0')}.png`)]));
}

/** 칸 그림들을 열 수만큼 한 장으로 — 칸마다 이름표, 강조 칸은 빨간 테. xstack 레이아웃은 칸 크기가 같다고 본다. */
function 띠필터(칸수, { 열 = 4, 이름들 = [], 강조 = -1, 글꼴파일 = 글꼴() } = {}) {
  const 줄 = [];
  for (let i = 0; i < 칸수; i += 1) {
    const 테 = i === 강조 ? '0xFF3B30' : 'white';
    줄.push(`[${i}:v]format=rgb24${이름표(이름들[i] ?? '', 글꼴파일)},pad=iw+16:ih+16:8:8:color=${테}[c${i}]`);
  }
  if (칸수 === 1) return `${줄[0].replace(/\[c0\]$/, '[out]')}`;
  const 자리 = [];
  for (let i = 0; i < 칸수; i += 1) {
    const x = i % 열, y = Math.floor(i / 열);
    자리.push(`${x ? Array.from({ length: x }, (_, k) => `w${k}`).join('+') : '0'}_${y ? Array.from({ length: y }, (_, k) => `h${k * 열}`).join('+') : '0'}`);
  }
  줄.push(`${Array.from({ length: 칸수 }, (_, i) => `[c${i}]`).join('')}xstack=inputs=${칸수}:layout=${자리.join('|')}:fill=white[out]`);
  return 줄.join(';');
}

function 띠만들기(칸들, 밖파일, { 열 = 4, 이름들 = [], 강조 = -1, 실행 = ffmpeg돌리기 } = {}) {
  if (!칸들.length) throw new Error('띠에 넣을 칸이 없다');
  fs.mkdirSync(path.dirname(밖파일), { recursive: true });
  실행([...칸들.flatMap((f) => ['-i', f]), '-filter_complex', 띠필터(칸들.length, { 열, 이름들, 강조 }), '-map', '[out]', '-frames:v', '1', '-q:v', '2', 밖파일]);
  return 밖파일;
}

/** 몽글 정본 시트 — 정면 · 오른쪽 3/4 · 왼쪽 3/4를 흰 바탕 한 장으로(검사 기준일 뿐 화면에 쓰지 않는다). */
function 정본시트(밖파일, { 표정들 = ['본체', '우34', '좌34'], 칸 = 640, 실행 = ffmpeg돌리기, 경로 = null } = {}) {
  const 찾기 = 경로 || ((이름) => require('./마스코트자산.js').절대경로(이름));
  const 파일들 = 표정들.map(찾기);
  for (const f of 파일들) if (!fs.existsSync(f)) throw new Error(`몽글 정본 그림이 없다: ${f}`);
  const 안 = Math.round(칸 * 0.92);
  const 줄 = 파일들.map((_, i) => `[${i + 1}:v]scale=${안}:${안}:force_original_aspect_ratio=decrease[m${i}]`);
  let 앞 = '0:v';
  파일들.forEach((_, i) => { const 다음 = i === 파일들.length - 1 ? 'out' : `t${i}`; 줄.push(`[${앞}][m${i}]overlay=x=${i * 칸}+(${칸}-w)/2:y=(${칸}-h)/2[${다음}]`); 앞 = 다음; });
  fs.mkdirSync(path.dirname(밖파일), { recursive: true });
  실행(['-f', 'lavfi', '-i', `color=c=white:s=${칸 * 파일들.length}x${칸}:d=1`, ...파일들.flatMap((f) => ['-i', f]), '-filter_complex', 줄.join(';'), '-map', '[out]', '-frames:v', '1', '-q:v', '2', 밖파일]);
  return 밖파일;
}

/* ── 지문 ───────────────────────────────────────────────────────────── */

const 파일해시 = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');

/** 그림 지문 — 64×64 회색 칸 평균(4,096바이트)을 base64로(결과.json에만 — 공개 기록에는 파일 해시만). */
function 격자(파일, 실행 = ffmpeg돌리기) {
  const b = 실행(['-i', 파일, '-vf', 'scale=64:64:flags=area,format=gray', '-frames:v', '1', '-f', 'rawvideo', '-'], { 바이트: true });
  const buf = Buffer.isBuffer(b) ? b : Buffer.from(b || '');
  if (buf.length !== 4096) throw new Error(`지문 크기가 이상하다(${buf.length}바이트): ${파일}`);
  return buf.toString('base64');
}

/** 두 지문이 같은 컷인가 — 칸 차이의 최댓값 · 평균이 문턱 안. 같은 렌더를 다시 뽑으면 0, 글자 몇 px 옮김(11-07 처음쓰는ㅈ v3b→v3c 「both right!」)은 32×32에서 최대 7이라 문턱을 좁게 둔다 — 잘못 「다름」은 다시 볼 뿐이지만 잘못 「같음」은 고친 컷을 안 본다. */
function 격자같음(a, b, { 최대 = 4, 평균 = 0.35 } = {}) {
  if (!a || !b) return false;
  const x = Buffer.from(a, 'base64'), y = Buffer.from(b, 'base64');
  if (x.length !== y.length || !x.length) return false;
  let 큰 = 0, 합 = 0;
  for (let i = 0; i < x.length; i += 1) { const d = Math.abs(x[i] - y[i]); 합 += d; if (d > 큰) 큰 = d; }
  return 큰 <= 최대 && 합 / x.length <= 평균;
}

/* ── GPT(구독) ──────────────────────────────────────────────────────── */

/**
 * GPT에게 그림 몇 장 + 글을 보여 답 글을 받는다(구독 Codex — 돈 안 나감).
 * → { 결과: '받음' | '막힘', 답, 꼴?, 첫줄?, 초, 코드 }. 꼴: 계정 없음(종료 3 — 굽기 계정이 모두 막힘 · 로그인 필요) · 답 없음 · 부르기 실패.
 */
function GPT묻기({ 그림들 = [], 글, 답파일, 시간 = 15 * 60 * 1000 }) {
  const 돌림 = process.env.SYNK_CODEX_ROTATE || path.join(뿌리, 'tools', 'codex계정.js');
  const 작업 = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-eye-'));
  fs.mkdirSync(path.dirname(답파일), { recursive: true });
  try { fs.rmSync(답파일, { force: true }); } catch { /* 없다 */ }
  const 입력 = `${도구머리}\n\n(첨부 그림은 이 순서로 붙였다: ${그림들.map((f) => path.basename(f)).join(', ') || '없음'})\n\n${글}`;
  const 인자 = [돌림, 'exec', '--skip-git-repo-check', '-C', 작업, '-s', 'read-only', ...그림들.flatMap((f) => ['-i', path.resolve(f)]), '-o', 답파일, '-'];
  const 시작 = Date.now();
  return new Promise((resolve) => {
    const c = spawn(process.execPath, 인자, { windowsHide: true });
    let 로그 = '', 끝남 = false;
    const 담기 = (d) => { 로그 = (로그 + d).slice(-16384); };
    c.stdout.on('data', 담기);
    c.stderr.on('data', 담기);
    const 타이머 = setTimeout(() => { if (!끝남) { 로그 += '\n[그림눈] 시간 넘김 — 끔'; if (process.platform === 'win32') spawn('taskkill', ['/pid', String(c.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); else c.kill(); } }, 시간);
    const 끝 = (code) => {
      if (끝남) return; 끝남 = true; clearTimeout(타이머);
      try { fs.rmSync(작업, { recursive: true, force: true }); } catch { /* 남겨도 된다 */ }
      const 초 = Math.round((Date.now() - 시작) / 1000);
      const 답 = fs.existsSync(답파일) ? fs.readFileSync(답파일, 'utf8').trim() : '';
      if (code === 0 && 답) return resolve({ 결과: '받음', 답, 초, 코드: code });
      const 끝줄 = 로그.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).filter((l) => !/^\s*(tokens used|codex|user|thinking)\b/i.test(l)).pop() || '';
      const 꼴 = code === 3 ? '계정 없음' : 답 || code === 0 ? '답 없음' : /시간 넘김/.test(로그) ? '답 없음' : '부르기 실패';
      resolve({ 결과: '막힘', 답, 꼴, 첫줄: (/시간 넘김/.test(로그) ? '시간 넘김' : 끝줄).slice(0, 200) || `종료 ${code}`, 초, 코드: code });
    };
    c.on('error', (e) => { 로그 += `\n${e.message}`; 끝(1); });
    c.on('close', (code) => 끝(code ?? 1));
    c.stdin.end(입력);
  });
}

module.exports = { ffmpeg돌리기, ffprobe돌리기, 영상정보, 프레임뽑기, 띠필터, 띠만들기, 정본시트, 파일해시, 격자, 격자같음, GPT묻기, 도구머리, 글꼴 };
