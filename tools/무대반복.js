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
 *     0.45 이상이면 확인할 것(「캡션에 있어요」 ~ 「고정 댓글에 있어요」 0.71).
 *   지난 편 — 판에 그 계정이 있고 영상이 있는 편 가운데 이 판 시각보다 이른 두 편. 게시결과 보류 · 취소됨 · 지움 판과 준비.json 상태가
 *     「버림」인 편은 나가지 않으니 뺀다. 영상은 git 밖이라 공용 작업본에서 찾는다(워크트리에서 돌려도).
 * tools/올리기전검사.js ⑯이 require('./무대반복.js').repeatFindings(bundle, plates)로 같은 셈을 한다.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const 묶음 = require('./lib/게시묶음.js');
const { 공용작업본 } = require('./lib/공용작업본.js');

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
function core(text) {
  return String(text || '').normalize('NFKC').toLowerCase().replace(BRAND, ' ').replace(/[^\p{L}\p{N}]/gu, '');
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

// 영상 하나 → { dur, first, last } (첫 · 끝 축소판)
function stageOf(file) {
  const dur = duration(file);
  return { dur, first: thumb(file, EDGE), last: thumb(file, dur - EDGE) };
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
// docs/마케팅 아래 편마다 { name, dir, prep, 판: [{ account, video, time, state }] } — 영상이 있는 판만
function episodes(roots = [공용작업본(ROOT)]) {
  const found = new Map();
  for (const root of [...new Set(roots.map((r) => path.resolve(r)))]) {
    const base = path.join(root, 'docs', '마케팅');
    let names = [];
    try { names = fs.readdirSync(base); } catch { continue; }
    for (const name of names) {
      if (found.has(name) || !fs.existsSync(path.join(base, name, '게시', '준비.json'))) continue;
      let bundle, plates;
      try { bundle = 묶음.load(path.join(base, name)); plates = 묶음.plates(bundle); } catch { continue; }
      const states = {};
      try { for (const p of 묶음.readJson(path.join(bundle.dir, '게시', '게시결과.json')).판 || []) if (p.계정) states[p.계정] = p.상태; } catch { /* 아직 없다 */ }
      const 판 = plates.filter((p) => p.video?.exists && Number.isFinite(Date.parse(p.time || '')))
        .map((p) => ({ account: p.account, video: p.video.path, time: Date.parse(p.time), state: states[p.account] || '' }));
      if (판.length) found.set(name, { name, dir: bundle.dir, prep: bundle.prep, 판 });
    }
  }
  return [...found.values()];
}

// 그 계정의 지난 n편 — 이 편(exclude) 말고, before보다 이른 판, 나가지 않는 판(보류 · 취소됨 · 지움 · 버린 편) 뺌, 늦은 것부터
function previousOf(list, account, before, { exclude = null, n = 2 } = {}) {
  const out = [];
  for (const e of list) {
    if (e.name === exclude || /^버림/.test(String(e.prep?.상태 || ''))) continue;
    const plate = e.판.find((p) => p.account === account && p.time < before && !GONE.has(p.state));
    if (plate) out.push({ name: e.name, dir: e.dir, prep: e.prep, video: plate.video, time: plate.time });
  }
  return out.sort((a, b) => b.time - a.time || a.name.localeCompare(b.name)).slice(0, n);
}

function day(ms) {
  return new Date(ms + 9 * 3600 * 1000).toISOString().slice(5, 10);
}

// ⑯ 지난 편 되풀이. 같은 영상 · 같은 지난 편은 계정을 모아 한 줄로 낸다(인스타 · 유튜브 · 틱톡이 같은 영상).
// 시험에서는 list(편 목록) · stage(영상 → 첫 · 끝 축소판) · screen(영상들 → 끝 줄) · narration(편 폴더 → 끝 줄)을 바꿔 넣는다.
function repeatFindings(bundle, plates, { list = null, stage = stageOf, screen = null, narration = narrationEnding, skipOcr = false, work = null } = {}) {
  const findings = [];
  const pairs = new Map(); // `${우리 영상}\t${지난 편}` → { ours, prev, accounts }
  const all = list || episodes([공용작업본(bundle.repo), bundle.repo]);
  for (const p of plates) {
    const at = Date.parse(p.time || '');
    if (!p.account || !p.video?.exists || !Number.isFinite(at)) continue;
    for (const prev of previousOf(all, p.account, at, { exclude: bundle.name })) {
      const key = `${p.video.path}\t${prev.name}`;
      if (!pairs.has(key)) pairs.set(key, { ours: p.video.path, prev, accounts: [] });
      pairs.get(key).accounts.push(p.account);
    }
  }
  if (!pairs.size) return { findings, summary: { 지난편: [] } };

  const stages = new Map();
  const stageFor = (file) => {
    if (!stages.has(file)) { try { stages.set(file, stage(file)); } catch (error) { stages.set(file, { error: error.message }); } }
    return stages.get(file);
  };
  const files = [...new Set([...pairs.values()].flatMap((x) => [x.ours, x.prev.video]))];
  let screens = new Map();
  if (!skipOcr) {
    try { screens = (screen || ((f) => screenEndings(f, work || path.join(bundle.repo, '.tmp', '올리기전검사', bundle.name))))(files); } catch (error) {
      findings.push({ level: LOOK, code: 'ending-ocr', where: '끝 줄', message: `끝 장면 글자 인식을 못 했다(${error.message}) — 끝 화면 글은 눈으로 견준다` });
    }
  }
  const ours = [...preparedEnding(bundle.prep), ...narration(bundle.dir)];
  const summary = [];
  for (const { ours: file, prev, accounts } of pairs.values()) {
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
    const mine = [...ours, ...(screens.get(file) || [])];
    const theirs = [...preparedEnding(prev.prep), ...narration(prev.dir), ...(screens.get(prev.video) || [])];
    const best = closestEnding(mine, theirs);
    row.끝줄 = Math.round(best.score * 100) / 100;
    if (best.score >= LINE_SAME) findings.push({ level: FIX, code: 'ending-repeat', where, message: `끝 줄이 지난 편 ${label}과 같다 — 「${best.ours}」 ~ 「${best.theirs}」 — 지난 두 편과 다른 끝 한마디로(준비.json 「끝줄」에 새 줄을 적는다)` });
    else if (best.score >= LINE_NEAR) findings.push({ level: LOOK, code: 'ending-similar', where, message: `끝 줄이 지난 편 ${label}과 비슷하다 — 「${best.ours}」 ~ 「${best.theirs}」` });
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
  for (const s of r.summary.지난편) console.log(`  ${s.편} · ${s.판.join(' · ')} · 첫 장면 ${s.첫장면 ?? '모름'} · 끝 장면 ${s.끝장면 ?? '모름'} · 끝 줄 ${s.끝줄}`);
  for (const f of r.findings) console.log(`  ${f.level === FIX ? '✗' : '?'} ${f.where} · ${f.message}`);
  if (!r.summary.지난편.length) console.log('  지난 편 없음(이 편 판 시각보다 이른 같은 계정 편이 없다)');
  if (r.findings.some((f) => f.level === FIX)) process.exitCode = 1;
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { repeatFindings, previousOf, episodes, stageVerdict, similar, core, screenEnding, narrationEnding, closestEnding, linesOfImage, mad, STAGE_SAME, LINE_SAME, LINE_NEAR };
