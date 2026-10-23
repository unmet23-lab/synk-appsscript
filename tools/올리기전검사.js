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

const { FIX, LOOK } = 규칙;
const SAFE = { left: 65, right: 920, top: 269, bottom: 1428 };
const TOLERANCE = 6;
const SMALL_TEXT = 16; // 글자 상자 높이(1080 폭 기준). 키트 최소 24px 글자는 상자가 18~22px쯤이다.
const END_CARD = [2.5, 6];
const FRAME_STEP = 0.5;
const API_PLATFORMS = new Set(['youtube', 'instagram', 'facebook']);
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

const KINDS = { right: '오른쪽 단추 자리', bottom: '아래 앱 글자 자리', top: '위 머리 자리', left: '왼쪽 가장자리', small: '작은 글자' };

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
  const texts = [];
  for (const image of images) {
    const t = (Number(String(image.name).match(/(\d+)/)[1]) - 1) * FRAME_STEP;
    for (const line of linesOf(image, { allowHan })) {
      texts.push(line.text);
      const problems = problemsOf(line);
      if (!problems.length) continue;
      const key = `${norm(line.text).slice(0, 20)}|${Math.round(line.x0 / 24)}|${Math.round(line.y0 / 24)}`;
      const item = seen.get(key) || { text: line.text, problems, times: [], frames: [], box: line.box };
      item.times.push(t);
      item.frames.push(image.name);
      seen.set(key, item);
    }
  }
  const steady = [...seen.values()].filter((item) => item.times.some((t, i) => i > 0 && Math.abs(t - item.times[i - 1] - FRAME_STEP) < 0.01));
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
    findings.push({ level: LOOK, code: `text-${kind}`, kind, where: label, count: hits.length, examples, sheet: sheetRel });
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
    return { level: LOOK, code: top.code, where: group.length > 1 ? `영상 ${group.length}개` : top.where,
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
      사전검사: path.relative(repo, report.reportPath).split(path.sep).join('/') },
  };
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
      if (slotOk && kst(at).slice(0, 10) !== prep.슬롯) add(LOOK, 'time-slot', where, `시각 ${plate.time}이 슬롯 ${prep.슬롯} 날이 아니다`);
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

  const fileSummaries = [];
  const ocrFindings = [];
  const screenTexts = [];
  const hanLanguage = (plate) => /^(zh|ja)/.test(plate.language || '') || plate.platform === 'xiaohongshu';
  for (const [file, users] of videos) {
    try {
      const label = path.relative(bundle.dir, file).split(path.sep).join('/');
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
  const script = 묶음.scriptText(bundle);
  findings.push(...규칙.compareNumbers(docs, [...texts, ...screenTexts, script.text]));
  if (!opts.skipLinks) findings.push(...await checkLinks([...links]));
  findings.push(...await promptFindings(prep, { repo: bundle.repo, skipLinks: opts.skipLinks }));

  const fixes = findings.filter((f) => f.level === FIX);
  const looks = findings.filter((f) => f.level === LOOK);
  const result = fixes.length ? FIX : looks.length ? LOOK : '통과';
  const line = (f) => `${f.where} · ${f.message}`;
  const record = {
    도구: 'tools/올리기전검사.js', 시각: kst(), 결과: result,
    고칠것: fixes.map(line), 확인할것: looks.map(line), 파일: fileSummaries,
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
    for (const f of record.파일) console.log(`  영상 ${f.경로.split('/').slice(-2).join('/')} · ${f.길이}초 · ${f.해상도} · 평균 ${f.평균Mbps}Mbps · ${f.음량} LUFS / ${f.봉우리} dBFS · 정지 ${f.정지} · 끝 화면 ${f.끝화면 ?? '모름'}초`);
    if (record.고칠것.length) { console.log(`고칠 것 ${record.고칠것.length}`); record.고칠것.forEach((x) => console.log(`  ✗ ${x}`)); }
    if (record.확인할것.length) { console.log(`확인할 것 ${record.확인할것.length}`); record.확인할것.forEach((x) => console.log(`  ? ${x}`)); }
    console.log(`  기록: ${record.기록}`);
  }
  if (record.결과 === FIX) process.exitCode = 1;
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 2; });

module.exports = { run, linesOf, problemsOf, promptFindings, SAFE };
