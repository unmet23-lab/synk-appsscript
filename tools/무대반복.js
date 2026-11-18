#!/usr/bin/env node
'use strict';
/* 지난 편 되풀이(2026-10-30, 제작 절차 「한 장면 먼저」) — 같은 계정의 지난 두 편과 무대 · 끝 줄이 같은지 본다. 읽기만 한다.
 *
 *   node tools/무대반복.js <편 폴더> [--json] [--글자인식건너뛰기]
 *
 * 10-28 · 29 전수 평가(Fable): synkbrief B8 · B14가 이틀 잇달아 같은 청금석 전후 틀에 끝 줄 「그대로 붙여 쓸 요청문은 캡션에 있어요」까지
 * 같았고, LAB 코랄 채팅 틀은 나흘에 일곱 판이었다. 「지난 두 편과 다르게」는 장부 머리말과 시험관 9번에만 있어 기계가 막지 않았다.
 *   무대 — 첫 장면(0.3초)과 끝 장면(끝 0.3초 앞)을 9×16 색 축소판으로 줄여 평균 차이(0~1)를 잰다. 두 끝이 다 0.12 아래면 고칠 것,
 *     하나만이면 확인할 것. 10-30 실측: B8~B14 0.074 · 0.099, LAB 코랄 채팅끼리 0.006~0.07 · 0.022~0.03, 다른 무대는 대부분 0.14 넘음.
 *     펠트 카페처럼 늘 같은 우리 장소는 첫 장면만 닮으면 확인할 것에 그친다(LAB 「아니」~「밥 한번」 0.061 · 0.164) — 두 끝이 다 같은 구도면
 *     그 계정 고정 장소여도 구도 · 장면을 바꾼다(「밥 한번」~「앱으로 배운」 0.053 · 0.111은 POV 딱지 · 몽글 · 바리스타 · 잔까지 같았다).
 *   끝 줄 — 끝 장면의 화면 글(글자 인식 — 24px 넘는 줄 가운데 끝 7초 앞 장면에 없던 줄, 그래서 내내 떠 있는 이름표 · 출처 줄은 빠진다) ·
 *     나레이션 마지막 줄(remotion/public/<폴더>/place.json의 판마다 가장 늦게 놓인 줄) · 준비.json 「끝줄」(글 하나 또는 목록).
 *     이름표 낱말(synk · SHIFT · 브리핑 · @계정)을 떼고 일곱 글자 넘는 줄만, 두 글자씩 겹친 비율(Dice)이 0.6 이상이면 고칠 것,
 *     0.45 이상이면 확인할 것(「캡션에 있어요」 ~ 「고정 댓글에 있어요」 0.71). 모음 기호(데바나가리 · 타이 · 버마 글자의 붙는 기호)도 글자로 센다.
 *     돌림 판(준비.json 판에 「돌림」: true — tools/돌림표.js가 단 나라 판본 판)은 끝 장면 화면 글을 글자 인식 대신 그 판본의 글.json
 *     (「돌림」.판본[키].글 — 판의 「파일」이 판본의 「파일」인 판본)으로 고른다(versionEnding — 11-18): 윈도우 글자 인식은 키릴 글자를
 *     라틴 글자로 엉뚱하게 읽고 데바나가리는 한 줄도 못 읽어, 러시아 미안 · 화날때가 둘 다 「только про себя!」로 끝나는데 0.09로 봤다.
 *     판본 글이 없거나 못 읽으면 전처럼 글자 인식이다. 손으로 단 판(「돌림」 없음)과 다른 브랜드 편은 그대로 글자 인식이다.
 *     돌림 판의 끝 줄 「같음」은 게시결과로 세 갈래다(⑩ 닫힌 칸 · 막힌 계정과 같은 셈) — 나간 판(게시됨)은 막지 않고, 걸린 판(예약됨 · 거는 중)은
 *     확인할 것(ending-repeat-booked), 안 건 판만 고칠 것. 준비.json 「돌림」.끝줄되부름에 적은 짝(일부러 끝 한마디를 되부르는 두 원본)의 돌림 판은
 *     확인할 것(ending-callback)이다. 손으로 단 판은 전처럼 상태 · 되부름을 보지 않고 고칠 것이다.
 *   지난 편 — 판에 그 계정이 있고 영상이 있는 편 가운데 이 판 시각보다 이른 두 편. 게시결과 보류 · 취소됨 · 지움 판과 준비.json 상태가
 *     「버림」인 편은 나가지 않으니 뺀다. 영상은 git 밖이라 공용 작업본에서 찾는다(워크트리에서 돌려도).
 * tools/올리기전검사.js ⑯이 require('./무대반복.js').repeatFindings(bundle, plates)로 같은 셈을 한다.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const 묶음 = require('./lib/게시묶음.js');
const { 공용작업본 } = require('./lib/공용작업본.js');
const { rowOf } = require('./게시장부.js');

const FIX = '고칠 것';
const LOOK = '확인할 것';
const THUMB = { w: 9, h: 16 };
const STAGE_SAME = 0.12;
const LINE_SAME = 0.6;
const LINE_NEAR = 0.45;
const LINE_MIN_H = 24; // 1080×1920 기준 글자 상자 높이 — 출처 줄(22px) · 작은 꼬리표는 끝 줄이 아니다
const LINE_MIN_LEN = 7;
const PRE_GAP = 7; // 끝 화면은 6초까지(검사 ③) — 그 앞 장면에 이미 있던 줄은 내내 떠 있는 줄이다
const EDGE = 0.3;
const GONE = new Set(['보류', '취소됨', '지움']);
const BRAND = /@[\p{L}\p{N}._]+|synk\s*(lab|brief)?|shift|브리핑|yuho\s*builds|유호/giu;
const ROOT = path.resolve(__dirname, '..');

// ── 끝 줄 견주기 ──
// 붙는 모음 기호(\p{Mn} · \p{Mc})는 남긴다 — 데바나가리 「मनमै राख!」에서 ै · ा를 떼면 「मनमरख」 여섯 글자로 줄어 끝 줄에서 빠지고, 기호만 다른 낱말끼리
// 같아진다(11-18). 이모지 변형 선택자(U+FE0F 등 — 이것도 \p{Mn})는 뗀다 — 남기면 「우리의 한국어 ❤️」가 일곱 글자로 늘어 손 판 끝 줄이 새로 걸린다(GPT 검수 GA3).
const VARIATION = /[︀-️\u{E0100}-\u{E01EF}]/gu;
function core(text) {
  return String(text || '').normalize('NFKC').toLowerCase().replace(BRAND, ' ').replace(VARIATION, '').replace(/[^\p{L}\p{Mn}\p{Mc}\p{N}]/gu, '');
}

function grams(s) {
  const m = new Map();
  for (let i = 0; i < s.length - 1; i += 1) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) || 0) + 1);
  return m;
}

// 두 글자씩 겹친 비율(0~1). 일곱 글자 아래 줄(이름표 · 「글 티 나면,」 같은 조각)은 0이다.
function similar(a, b) {
  const x = core(a), y = core(b);
  if (x.length < LINE_MIN_LEN || y.length < LINE_MIN_LEN) return 0;
  if (x === y) return 1;
  const A = grams(x), B = grams(y);
  let both = 0;
  for (const [g, n] of A) both += Math.min(n, B.get(g) || 0);
  return (2 * both) / (x.length - 1 + y.length - 1);
}

// 글자 인식 그림 하나 → [{ text, h }](1080×1920 기준 높이)
function linesOfImage(image) {
  const sy = 1920 / (image.height || 1920);
  return [].concat(image.lines || []).map((line) => {
    const words = [].concat(line.words || []).filter((w) => w && w.h > 0);
    return { text: String(line.text || '').trim(), h: words.length ? Math.max(...words.map((w) => w.h)) * sy : 0 };
  }).filter((l) => l.text);
}

// 끝 장면 줄 가운데 끝 줄로 볼 것: 크고(24px 넘음) 일곱 글자 넘고, 끝 7초 앞 장면에 없던 줄
function screenEnding(endLines, preLines = []) {
  return endLines.filter((l) => l.h >= LINE_MIN_H && core(l.text).length >= LINE_MIN_LEN && !preLines.some((p) => similar(p.text, l.text) >= LINE_SAME)).map((l) => l.text);
}

// 나레이션 마지막 줄: remotion/public/<폴더>/place.json({판: [{id, start}]})마다 판의 가장 늦은 줄 → 그 폴더 <id>.json의 show · text
function narrationEnding(dir) {
  const out = [];
  const pub = path.join(dir, 'remotion', 'public');
  let names = [];
  try { names = fs.readdirSync(pub, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return out; }
  for (const name of names) {
    const place = path.join(pub, name, 'place.json');
    if (!fs.existsSync(place)) continue;
    try {
      for (const list of Object.values(묶음.readJson(place))) {
        const last = [].concat(list || []).filter((x) => x && x.id).sort((a, b) => (b.start ?? 0) - (a.start ?? 0))[0];
        if (!last) continue;
        const line = 묶음.readJson(path.join(pub, name, `${last.id}.json`));
        const text = line.show || line.text;
        if (text && !out.includes(text)) out.push(text);
      }
    } catch { /* 깨진 배치 · 줄 파일은 건너뛴다 */ }
  }
  return out;
}

function preparedEnding(prep) {
  return [].concat(prep?.끝줄 || []).filter((x) => typeof x === 'string' && x.trim());
}

// 판본 글(tools/lib/판본글.js 꼴 — { 줄: [{ 칸, 글, 초: [시작, 끝] }] }) → 끝 장면에 뜬 줄(11-18). 글자 인식이 읽던 자리를 「초」로 고른다:
// 끝(초가 있는 줄이 가장 늦게 사라지는 때 — 판본 영상 길이와 같다) 0.3초 앞에 떠 있고 끝 7초 앞에는 없던 줄, 그리고 「끝」 · 「끝질문」 칸.
// 끝 장면에 함께 뜬 해설 · 개그 · 한국어 줄도 넣는다 — 러시아 미안의 「только про себя!」는 해설 칸이다. 게시글 칸(화면 밖)과 초 없이
// 내내 떠 있는 줄(화 눈금 이름표)은 뺀다. 여러 줄 글은 한 줄로 잇고 줄 하나하나도 넣는다(글자 인식은 화면 줄마다 읽었다).
// 끝 7초 앞 장면에 떠 있던 줄과 닮은(0.6 이상) 줄도 뺀다 — 글자 인식 쪽 screenEnding과 같은 셈이다(GPT 검수 GA2: 배 브라질 판의 끝 「barriga」는
// 7초 앞 「Dor de barriga…」와 0.71이라 글자 인식은 뺐는데 판본 글은 넣었다).
// 돌려주는 값: 초가 있는 줄도 끝 · 끝질문 칸도 없어 처음부터 고를 줄이 없으면 null(그 영상은 글자 인식으로 떨어진다).
// 고른 줄이 7초 앞 줄과 닮아 다 빠지면 빈 목록이다(판본 글을 믿어 글자 인식으로 떨어지지 않는다 — 다시 검수 GA1).
const END_KAN = new Set(['끝', '끝질문']);
function versionEnding(data) {
  const lines = [].concat(data?.줄 || []).filter((z) => z && typeof z.글 === 'string' && z.글.trim() && z.칸 !== '게시글');
  const timed = lines.filter((z) => Array.isArray(z.초) && z.초.length === 2 && z.초.every(Number.isFinite));
  const end = timed.length ? Math.max(...timed.map((z) => z.초[1])) : null;
  const pre = end === null ? null : end > PRE_GAP + 1 ? end - PRE_GAP : Math.min(1, end / 2);
  const on = (z, t) => z.초[0] <= t && t <= z.초[1];
  const picked = lines.filter((z) => END_KAN.has(z.칸) || (timed.includes(z) && on(z, end - EDGE) && !on(z, pre)));
  if (!picked.length) return null;
  // 한 줄 글 → [이은 글, (여러 줄이면) 줄 하나하나]. {n} 같은 자리표는 지운다.
  const texts = (z) => {
    const clean = (s) => s.replace(/\{[^{}]*\}/g, ' ').replace(/\s+/g, ' ').trim();
    const parts = z.글.split(/\r?\n/);
    return [clean(z.글), ...(parts.length > 1 ? parts.map(clean) : [])].filter(Boolean);
  };
  const before = pre === null ? [] : timed.filter((z) => on(z, pre)).flatMap(texts);
  const out = [];
  for (const z of picked) {
    for (const t of texts(z)) if (!out.includes(t) && !before.some((p) => similar(p, t) >= LINE_SAME)) out.push(t);
  }
  return out;
}

// 돌림 판(「돌림」: true)의 판본 글 파일 — 판의 「파일」이 「돌림」.판본[키].파일과 같은 판본의 「글」. 손으로 단 판 · 글이 없는 판본은 null.
function versionTextFile(bundle, raw) {
  if (!raw || raw.돌림 !== true || !raw.파일) return null;
  const want = 묶음.resolve(bundle, raw.파일);
  for (const v of Object.values(bundle.prep?.돌림?.판본 || {})) {
    if (!v || typeof v.글 !== 'string' || typeof v.파일 !== 'string') continue;
    if (v.파일 !== raw.파일 && 묶음.resolve(bundle, v.파일) !== want) continue;
    const file = 묶음.resolve(bundle, v.글);
    return file && fs.existsSync(file) ? file : null;
  }
  return null;
}

// 우리 끝 줄 목록과 지난 편 끝 줄 목록에서 가장 닮은 한 쌍
function closestEnding(ours, theirs) {
  let best = { score: 0, ours: null, theirs: null };
  for (const a of ours) for (const b of theirs) {
    const score = similar(a, b);
    if (score > best.score) best = { score, ours: a, theirs: b };
  }
  return best;
}

// ── 무대 ──
function mad(a, b) {
  if (!a || !b || a.length !== b.length || !a.length) return null;
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += Math.abs(a[i] - b[i]);
  return s / a.length / 255;
}

// 두 편의 첫 · 끝 장면 차이 → { first, last, level }(level: 둘 다 같으면 고칠 것, 하나면 확인할 것, 아니면 null)
function stageVerdict(ours, theirs) {
  const first = mad(ours?.first, theirs?.first);
  const last = mad(ours?.last, theirs?.last);
  const same = [first, last].filter((d) => d !== null && d < STAGE_SAME).length;
  return { first, last, level: same === 2 ? FIX : same === 1 ? LOOK : null };
}

function duration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.resolve(file)], { encoding: 'utf8', windowsHide: true });
  const d = Number(String(r.stdout || '').trim());
  if (r.status !== 0 || !Number.isFinite(d) || d <= 0) throw new Error(`길이를 못 읽었다: ${path.basename(file)}`);
  return d;
}

function thumb(file, t) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(Math.max(0, t)), '-i', path.resolve(file), '-frames:v', '1', '-vf', `scale=${THUMB.w}:${THUMB.h}:flags=area`,
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1024 * 1024, windowsHide: true });
  if (r.status !== 0 || !r.stdout || r.stdout.length !== THUMB.w * THUMB.h * 3) throw new Error(`장면을 못 읽었다: ${path.basename(file)} ${t.toFixed(1)}초`);
  return r.stdout;
}

function stillFrame(file, t, out) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(Math.max(0, t)), '-i', path.resolve(file), '-frames:v', '1', '-vf', 'scale=1080:-2', out], { windowsHide: true });
  return r.status === 0 && fs.existsSync(out);
}

// 나라 인사 카드(11-12)가 붙은 판본 영상의 인사 길이(초) — 그 영상 옆 렌더.json 「인사초」(판본렌더.mjs가 적는다). 없으면 0.
// 렌더 기록이 다른 영상의 것이면(영상 이름이 다르다) 믿지 않는다.
function greetSec(file) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(path.dirname(path.resolve(file)), '렌더.json'), 'utf8').replace(/^﻿/, ''));
    const sec = Number(j && j.인사초);
    if (!(sec > 0 && sec <= 3)) return 0;
    if (j.영상 && path.basename(String(j.영상)) !== path.basename(file)) return 0;
    return sec;
  } catch { return 0; }
}

// 영상 하나 → { dur, first, last } (첫 · 끝 축소판)
// 「첫 장면」은 인사 뒤 원본의 첫 장면이다 — 인사 판본을 0.3초에서 뜨면 인사 그림이 잡혀, 인사 없는 지난 편과는 같은 무대여도 늘 다르고
// (새는 쪽) 같은 계정의 인사 판 둘은 원본이 달라도 늘 같다(헛막음 — 11-12 Fable 5.2 인사 카드 검수 P1).
// read = { duration, thumb } — 시험이 ffmpeg 없이 뜨는 자리(초)를 볼 때 바꿔 넣는다
function stageOf(file, read = { duration, thumb }) {
  const dur = read.duration(file);
  const greet = greetSec(file);
  return { dur, first: read.thumb(file, Math.min(greet + EDGE, Math.max(0, dur - EDGE))), last: read.thumb(file, dur - EDGE), ...(greet ? { greet } : {}) };
}

function ocrFolder(dir) {
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'lib', '글자인식.ps1'), '-Dir', dir],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(String(r.stderr || '').trim().slice(0, 300) || `종료 코드 ${r.status}`);
  const text = String(r.stdout || '').replace(/^﻿/, '').trim();
  return text ? [].concat(JSON.parse(text)) : [];
}

// 영상들의 끝 장면 화면 글 → Map(영상 경로 → [끝 줄]). 끝 0.3초 앞과 끝 7초 앞 장면 둘을 한 폴더에서 한 번에 읽는다.
function screenEndings(files, work) {
  const dir = path.join(work, '끝장면');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const names = new Map();
  [...new Set(files)].forEach((file, i) => {
    const dur = duration(file);
    const tag = String(i).padStart(2, '0');
    if (stillFrame(file, dur - EDGE, path.join(dir, `${tag}_end.png`))) names.set(file, tag);
    stillFrame(file, dur > PRE_GAP + 1 ? dur - PRE_GAP : Math.min(1, dur / 2), path.join(dir, `${tag}_pre.png`));
  });
  const byName = new Map(ocrFolder(dir).map((image) => [path.basename(String(image.name || image.file || '')), linesOfImage(image)]));
  const out = new Map();
  for (const [file, tag] of names) out.set(file, screenEnding(byName.get(`${tag}_end.png`) || [], byName.get(`${tag}_pre.png`) || []));
  return out;
}

// ── 지난 편 ──
// docs/마케팅 아래 편마다 { name, dir, prep, 판: [{ account, video, time, state }] } — 영상이 있는 판만.
// 뿌리가 여럿이면(회차 사본 + 공용 작업본) 편의 머리(prep · dir)는 앞 뿌리의 것이고, 판은 뿌리마다 읽어 합친다(계정 · 시각이 같으면 한 번).
// 11-11 Fable 5.2 끝 판 검수 P2-10: 「먼저 읽은 뿌리가 이긴다」로 공용 작업본을 먼저 읽어, 14시 회차가 제 사본의 준비.json에 방금 단 돌림 판을
// 「지난 두 편」에서 못 봤다(한 계정이 한 회차에 원본 둘을 받는 날부터 밟는다). 공용 작업본에만 있는 판(다른 세션의 새 편)도 그대로 든다.
function episodes(roots = [공용작업본(ROOT)]) {
  const found = new Map();
  for (const root of [...new Set(roots.map((r) => path.resolve(r)))]) {
    const base = path.join(root, 'docs', '마케팅');
    let names = [];
    try { names = fs.readdirSync(base); } catch { continue; }
    for (const name of names) {
      if (!fs.existsSync(path.join(base, name, '게시', '준비.json'))) continue;
      let bundle, plates;
      try { bundle = 묶음.load(path.join(base, name)); plates = 묶음.plates(bundle); } catch { continue; }
      const states = {};
      // 한 계정에 줄이 여럿이면 게시 장부 · 돌림표 · 예약큐와 같은 읽기(rowOf — 11-11 Fable 5.2 검수 P1-2)
      try {
        const rows = 묶음.readJson(path.join(bundle.dir, '게시', '게시결과.json')).판 || [];
        for (const account of new Set(rows.map((p) => p && p.계정).filter(Boolean))) states[account] = rowOf(rows, account)?.상태 || '';
      } catch { /* 아직 없다 */ }
      // 글 — 돌림 판이면 그 판본 글 파일(끝 줄을 글자 인식 대신 읽는다 — versionTextFile), 아니면 null
      const 판 = plates.filter((p) => p.video?.exists && Number.isFinite(Date.parse(p.time || '')))
        .map((p) => ({ account: p.account, video: p.video.path, time: Date.parse(p.time), state: states[p.account] || '', 글: versionTextFile(bundle, p.raw) }));
      const 있던 = found.get(name);
      if (!있던) { if (판.length) found.set(name, { name, dir: bundle.dir, prep: bundle.prep, 판 }); continue; }
      // 뒤 뿌리 — 앞 뿌리에 없는 판만 더하고, 앞 뿌리가 상태를 모르는 판은 뒤 뿌리의 상태를 쓴다
      for (const p of 판) {
        const same = 있던.판.find((x) => x.account === p.account && x.time === p.time);
        if (!same) 있던.판.push(p);
        else if (!same.state && p.state) same.state = p.state;
      }
    }
  }
  return [...found.values()];
}

// 그 계정의 지난 n편 — 이 편(exclude) 말고, before보다 이른 판, 나가지 않는 판(보류 · 취소됨 · 지움 · 버린 편) 뺌, 늦은 것부터.
// only(편 → 참/거짓)를 주면 그 편만 센다(11-10 — 이야기 편은 이야기 편끼리, 퀴즈는 퀴즈끼리).
function previousOf(list, account, before, { exclude = null, n = 2, only = null } = {}) {
  const out = [];
  for (const e of list) {
    if (e.name === exclude || /^버림/.test(String(e.prep?.상태 || ''))) continue;
    if (only && !only(e)) continue;
    const plate = e.판.find((p) => p.account === account && p.time < before && !GONE.has(p.state));
    if (plate) out.push({ name: e.name, dir: e.dir, prep: e.prep, video: plate.video, time: plate.time, 글: plate.글 || null });
  }
  return out.sort((a, b) => b.time - a.time || a.name.localeCompare(b.name)).slice(0, n);
}

function day(ms) {
  return new Date(ms + 9 * 3600 * 1000).toISOString().slice(5, 10);
}

// ⑯ 지난 편 되풀이. 같은 영상 · 같은 지난 편은 계정을 모아 한 줄로 낸다(인스타 · 유튜브 · 틱톡이 같은 영상).
// 시험에서는 list(편 목록) · stage(영상 → 첫 · 끝 축소판) · screen(영상들 → 끝 줄) · narration(편 폴더 → 끝 줄)을 바꿔 넣는다.
// 11-10 LAB 하루 두 편(설계 23): 퀴즈 형식 편(준비.json 「돌림」.형식 「퀴즈」 — 11-10 밤까지 21:00 칸, 지금은 예비 형식)은 매일 같은 뼈대 · 같은 진행자라 ⑯ 셈 밖이다 — 대신
// 개그 무대(「돌림」.무대 — 문제 은행의 무대 칸)가 그 계정의 지난 두 퀴즈와 같으면 고칠 것, 무대 칸이 없으면 확인할 것.
// 이야기 편은 지난 이야기 편끼리만 견준다(그 사이 퀴즈 · 노래는 건너뛴다).
// 11-10 밤 21:00 칸이 노래로 바뀌며(유호님): 21:00 노래(「돌림」.형식 「노래」)도 매일 같은 가사판 뼈대라 ⑯ 셈 밖이다 — 퀴즈의 개그 무대 검사는
// 퀴즈에만 걸고, 노래의 되풀이(꼴 · 장르 돌림)는 리듬 한국어 준비안이 정한다(docs/마케팅/LAB_리듬한국어_준비_20261110/README.md).
const formatOf = (prep) => prep?.돌림?.형식 || null;
const stageWord = (prep) => String(prep?.돌림?.무대 || '').replace(/\s+/g, ' ').trim();
function quizStageFindings(bundle, plates, all) {
  const findings = [];
  const mine = stageWord(bundle.prep);
  if (!mine) {
    findings.push({ level: LOOK, code: 'quiz-stage-missing', where: '준비.json', message: '퀴즈 편인데 「돌림」.무대(개그 무대)가 없다 — 문제 은행의 무대 칸을 적어 지난 퀴즈와 무대가 겹치지 않게 돌린다(설계 23)' });
    return { findings, summary: { 지난편: [] } };
  }
  const byPrev = new Map();
  for (const p of plates) {
    const at = Date.parse(p.time || '');
    if (!p.account || !Number.isFinite(at)) continue;
    for (const prev of previousOf(all, p.account, at, { exclude: bundle.name, only: (e) => formatOf(e.prep) === '퀴즈' })) {
      if (!byPrev.has(prev.name)) byPrev.set(prev.name, { prev, accounts: [] });
      byPrev.get(prev.name).accounts.push(p.account);
    }
  }
  const summary = [];
  for (const { prev, accounts } of byPrev.values()) {
    const theirs = stageWord(prev.prep);
    summary.push({ 편: prev.name, 판: accounts, 무대: theirs || null });
    if (theirs && theirs === mine) findings.push({ level: FIX, code: 'quiz-stage-repeat', where: accounts.join(' · '),
      message: `개그 무대 「${mine}」가 지난 퀴즈 ${prev.name}(${day(prev.time)})와 같다 — 문제 은행에서 다른 무대를 고른다(설계 23)` });
  }
  return { findings, summary: { 지난편: summary } };
}

// 돌림 판 끝 줄 「같음」의 세 갈래(11-18 — 올리기 전 검사 ⑩ 닫힌 칸 · 막힌 계정과 같은 셈): 나간 판(게시결과 「게시됨」)은 막지 않고,
// 플랫폼에 걸린 판(「예약됨」 · 「거는 중」)은 확인할 것(스스로 거두지 않는다 — 거둘지는 보고에서 정한다), 안 건 판만 고칠 것이다.
// 판본 글로 견주자 글자 인식이 못 보던 짝이 이미 나간 판에서도 새로 잡혔다(말레이 유튜브 미안 11-17 게시됨 ~ 지마 0.61). 고칠 것이면 14시 회차가
// 그 편의 다른 나라 판까지 하나도 못 거는데, 나간 판은 고칠 길이 없다. 손으로 단 판은 전처럼 상태를 보지 않고 고칠 것이다.
const ON_PLATFORM = new Set(['예약됨', '거는 중']);
function plateStates(bundle) {
  const out = new Map();
  try {
    const rows = 묶음.readJson(path.join(bundle.dir, '게시', '게시결과.json')).판 || [];
    for (const account of new Set(rows.map((p) => p && p.계정).filter(Boolean))) out.set(account, rowOf(rows, account)?.상태 || '');
  } catch { /* 아직 없다 */ }
  return out;
}

// 「돌림」.끝줄되부름(11-18): 끝 한마디를 일부러 되부르는 원본 짝 — [{"편": "<편 폴더 이름>", "까닭": "…"} | "<편 폴더 이름>"].
// 어느 쪽 준비.json에 적어도 그 두 편 사이 돌림 판의 끝 줄 「같음」은 확인할 것(ending-callback)으로 내린다(미안죄송합니다의 해설 딱지 「속으로만!」이
// 화날때의 끝 카드를 되부른다). 손으로 단 판은 내리지 않는다. 이름이 틀리면 내리지 않는다(고칠 것이 그대로 뜬다).
function callbackOf(ours, oursName, theirs, theirName) {
  const find = (prep, name) => [].concat(prep?.돌림?.끝줄되부름 || []).find((x) => (typeof x === 'string' ? x : x?.편) === name);
  const hit = find(ours, theirName) || find(theirs, oursName);
  if (!hit) return null;
  return { 까닭: typeof hit === 'object' && hit.까닭 ? String(hit.까닭) : null };
}

function repeatFindings(bundle, plates, { list = null, stage = stageOf, screen = null, narration = narrationEnding, skipOcr = false, work = null } = {}) {
  const findings = [];
  // `${우리 영상}\t${우리 판본 글}\t${지난 편}\t${지난 판본 글}` → { ours, oursText, prev, accounts }. 판본 글은 돌림 판에만 있어(versionTextFile),
  // 손으로 단 판끼리는 전처럼 영상 · 지난 편으로 묶인다. 같은 영상이어도 돌림 판과 손 판은 끝 줄 읽는 길이 달라 따로 한 줄이다.
  const pairs = new Map();
  const all = list || episodes([bundle.repo, 공용작업본(bundle.repo)]);
  if (formatOf(bundle.prep) === '퀴즈') return quizStageFindings(bundle, plates, all);
  if (formatOf(bundle.prep) === '노래') return { findings, summary: { 지난편: [], 셈밖: '21:00 노래 칸(설계 23 — 11-10 밤 퀴즈에서 노래로)' } };
  const notQuiz = (e) => !['퀴즈', '노래'].includes(formatOf(e.prep));
  for (const p of plates) {
    const at = Date.parse(p.time || '');
    if (!p.account || !p.video?.exists || !Number.isFinite(at)) continue;
    const oursText = versionTextFile(bundle, p.raw);
    for (const prev of previousOf(all, p.account, at, { exclude: bundle.name, only: notQuiz })) {
      const key = `${p.video.path}\t${oursText || ''}\t${prev.name}\t${prev.글 || ''}`;
      if (!pairs.has(key)) pairs.set(key, { ours: p.video.path, oursText, prev, accounts: [], rotation: new Set() });
      pairs.get(key).accounts.push(p.account);
      if (p.raw?.돌림 === true) pairs.get(key).rotation.add(p.account);
    }
  }
  if (!pairs.size) return { findings, summary: { 지난편: [] } };

  const stages = new Map();
  const stageFor = (file) => {
    if (!stages.has(file)) { try { stages.set(file, stage(file)); } catch (error) { stages.set(file, { error: error.message }); } }
    return stages.get(file);
  };
  // 판본 글 → 끝 줄(못 읽거나 고를 줄이 없으면 null — 그 영상은 글자 인식으로 떨어진다)
  const texts = new Map();
  const textFor = (file) => {
    if (!file) return null;
    if (!texts.has(file)) { let v = null; try { v = versionEnding(묶음.readJson(file)); } catch { v = null; } texts.set(file, v); }
    return texts.get(file);
  };
  // 글자 인식은 판본 글로 못 고른 쪽의 영상만 — 다 판본 글로 견주면 부르지 않는다
  const files = [...new Set([...pairs.values()].flatMap((x) => [...(textFor(x.oursText) ? [] : [x.ours]), ...(textFor(x.prev.글) ? [] : [x.prev.video])]))];
  let screens = new Map();
  if (!skipOcr && files.length) {
    try { screens = (screen || ((f) => screenEndings(f, work || path.join(bundle.repo, '.tmp', '올리기전검사', bundle.name))))(files); } catch (error) {
      findings.push({ level: LOOK, code: 'ending-ocr', where: '끝 줄', message: `끝 장면 글자 인식을 못 했다(${error.message}) — 끝 화면 글은 눈으로 견준다` });
    }
  }
  const readBy = (text) => (text ? '판본 글' : skipOcr ? '안 읽음' : '글자 인식');
  const ours = [...preparedEnding(bundle.prep), ...narration(bundle.dir)];
  const states = [...pairs.values()].some((x) => x.rotation.size) ? plateStates(bundle) : new Map();
  const summary = [];
  for (const { ours: file, oursText, prev, accounts, rotation } of pairs.values()) {
    const where = accounts.join(' · ');
    const label = `${prev.name}(${day(prev.time)})`;
    const a = stageFor(file), b = stageFor(prev.video);
    const row = { 편: prev.name, 판: accounts };
    if (a.error || b.error) {
      findings.push({ level: LOOK, code: 'stage-unknown', where, message: `지난 편 ${label}과 무대를 못 견줬다(${a.error || b.error}) — 첫 · 끝 장면을 눈으로 본다` });
    } else {
      const v = stageVerdict(a, b);
      row.첫장면 = Math.round(v.first * 1000) / 1000;
      row.끝장면 = Math.round(v.last * 1000) / 1000;
      if (v.level === FIX) findings.push({ level: FIX, code: 'stage-repeat', where, message: `무대가 지난 편 ${label}과 같다 — 첫 장면 ${row.첫장면} · 끝 장면 ${row.끝장면}(${STAGE_SAME} 아래면 같은 틀) — 제작 절차 「한 장면 먼저」: 무대 · 구도를 바꾸고 끝 3초엔 이 편의 핵심 장면` });
      else if (v.level === LOOK) findings.push({ level: LOOK, code: 'stage-similar', where, message: `${v.first < STAGE_SAME ? '첫' : '끝'} 장면이 지난 편 ${label}과 닮았다(첫 ${row.첫장면} · 끝 ${row.끝장면}) — 그 계정 고정 장소면 괜찮고, 같은 틀이면 바꾼다` });
    }
    const mineText = textFor(oursText), theirText = textFor(prev.글);
    const mine = [...ours, ...(mineText || screens.get(file) || [])];
    const theirs = [...preparedEnding(prev.prep), ...narration(prev.dir), ...(theirText || screens.get(prev.video) || [])];
    const best = closestEnding(mine, theirs);
    row.끝줄 = Math.round(best.score * 100) / 100;
    row.끝줄읽기 = `${readBy(mineText)} · ${readBy(theirText)}`;
    // 돌림 판은 게시결과로 세 갈래(나간 판 안 봄 · 걸린 판 확인할 것 · 안 건 판 고칠 것), 손으로 단 판은 늘 고칠 것
    const open = [], booked = [];
    for (const account of accounts) {
      if (!rotation.has(account)) { open.push(account); continue; }
      const state = states.get(account) || '';
      if (state === '게시됨') continue;
      (ON_PLATFORM.has(state) ? booked : open).push(account);
    }
    if (best.score >= LINE_SAME) {
      const same = `끝 줄이 지난 편 ${label}과 같다 — 「${best.ours}」 ~ 「${best.theirs}」`;
      // 되부름 짝은 돌림 판에만 듣는다 — 손으로 단 판은 짝으로 적혀 있어도 전처럼 고칠 것(GPT 검수 GA1)
      const callback = callbackOf(bundle.prep, bundle.name, prev.prep, prev.name);
      const called = callback ? [...open, ...booked].filter((x) => rotation.has(x)) : [];
      if (called.length) {
        row.끝줄되부름 = true;
        findings.push({ level: LOOK, code: 'ending-callback', where: called.join(' · '), message: `${same} — 준비.json 「돌림」.끝줄되부름에 일부러 되부르는 짝으로 적힌 두 편이다${callback.까닭 ? `(${callback.까닭})` : ''}. 이틀 잇달아 나가도 되는지 본다` });
      }
      const fixes = open.filter((x) => !called.includes(x)), looks = booked.filter((x) => !called.includes(x));
      // 돌림 판본의 끝 한마디는 동결이라 고쳐 쓸 수 없다 — 그 계정의 지난 두 편 밖으로 밀리게 한다(⑯은 지난 두 편을 본다 — GA4)
      const remedy = mineText && mineText.includes(best.ours)
        ? '돌림 판본의 끝 한마디는 동결이다 — 그 계정에서 이 두 편 사이에 다른 이야기 편이 두 편 이상 나가게 판을 옮기거나(⑯은 지난 두 편을 본다 — node tools/돌림표.js --다시 --쓰기), 받지 않을 계정이면 「돌림」.이미받음에 까닭과 함께 넣는다. 일부러 되부르는 짝이면 「돌림」.끝줄되부름에 까닭과 함께 적는다'
        : '지난 두 편과 다른 끝 한마디로(준비.json 「끝줄」에 새 줄을 적는다)';
      if (fixes.length) findings.push({ level: FIX, code: 'ending-repeat', where: fixes.join(' · '), message: `${same} — ${remedy}` });
      if (looks.length) findings.push({ level: LOOK, code: 'ending-repeat-booked', where: looks.join(' · '), message: `${same} — 그런데 이 판은 이미 플랫폼에 걸려 있다(「${looks.map((x) => states.get(x)).join(' · ')}」). 스스로 거두지 않는다 — 보고에 계정 · 공개 시각과 함께 적고, 거둘지는 유호님이 정한다` });
    } else if (best.score >= LINE_NEAR && open.length + booked.length) {
      findings.push({ level: LOOK, code: 'ending-similar', where: [...open, ...booked].join(' · '), message: `끝 줄이 지난 편 ${label}과 비슷하다 — 「${best.ours}」 ~ 「${best.theirs}」` });
    }
    summary.push(row);
  }
  return { findings, summary: { 지난편: summary } };
}

function main(argv) {
  const dirs = argv.filter((a) => !a.startsWith('--'));
  if (dirs.length !== 1) {
    console.error('사용: node tools/무대반복.js <편 폴더> [--json] [--글자인식건너뛰기]');
    process.exitCode = 2;
    return;
  }
  const bundle = 묶음.load(dirs[0]);
  const work = path.join(bundle.repo, '.tmp', '무대반복', bundle.name);
  fs.mkdirSync(work, { recursive: true });
  const r = repeatFindings(bundle, 묶음.plates(bundle), { skipOcr: argv.includes('--글자인식건너뛰기'), work });
  if (argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); return; }
  console.log(`지난 편 되풀이 · ${bundle.name}`);
  for (const s of r.summary.지난편) console.log(`  ${s.편} · ${s.판.join(' · ')} · 첫 장면 ${s.첫장면 ?? '모름'} · 끝 장면 ${s.끝장면 ?? '모름'} · 끝 줄 ${s.끝줄}${s.끝줄읽기 ? `(${s.끝줄읽기})` : ''}`);
  for (const f of r.findings) console.log(`  ${f.level === FIX ? '✗' : '?'} ${f.where} · ${f.message}`);
  if (!r.summary.지난편.length) console.log('  지난 편 없음(이 편 판 시각보다 이른 같은 계정 편이 없다)');
  if (r.findings.some((f) => f.level === FIX)) process.exitCode = 1;
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { stageOf, greetSec, repeatFindings, previousOf, episodes, stageVerdict, similar, core, screenEnding, narrationEnding, closestEnding, versionEnding, versionTextFile, linesOfImage, mad, STAGE_SAME, LINE_SAME, LINE_NEAR };
