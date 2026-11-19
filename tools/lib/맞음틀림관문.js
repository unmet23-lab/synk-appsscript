'use strict';

// ㉒ LAB 맞는 말 · 틀린 말 색(2026-11-19) — 규칙 원문은 제작 절차 「근거 · 틀 · 화면」의 「맞는 말 · 틀린 말」(docs/마케팅/기획장부/제작절차.md#right-wrong-marks)이다.
// 유호님 11-19 「맞았을때 표현이랑 틀렸을때 표현이랑 글씨 색이 똑같아서 외국인 입장에서 보면 많이 헷갈리거든」 — 그날 13시 편 「사요 · 찍어요」는
// 맞는 말 「붕어빵 사자!」와 틀린 말 「사진도 사자!」의 짚는 낱말이 둘 다 산호색이었고, 맞음 알약은 붉은색 · 틀림 알약은 검정이었다.
// 맞는 말은 초록(OK) + ✓, 틀린 말은 빨강(NG) + ✗로 가른다. 규칙을 글로만 두면 회차 세션이 놓치므로 기획 칸과 화면 코드의 두 색을 여기서 본다.
//
//   고칠 것 — 기획.md 칸표에 「맞음틀림」 칸이 없다(규칙: 모든 LAB 편이 「없음」이나 「있음」을 적는다). 칸 값이 「없음」 · 「있음」으로 시작하지 않는다.
//             칸이 「있음」인데 화면 코드(remotion/src의 .ts · .tsx, 주석 뺌)에 두 색이 다 있지 않다. 기획.md가 없는데 화면 코드에 틀림 표시가 있다.
//   확인할 것 — 칸은 「없음」인데 화면 코드에 틀림 표시가 있다. 「있음」인데 화면 코드가 없거나 못 읽은 코드 파일이 있어 색을 못 봤다.
//             기획.md가 없다(틀림 표시도 없음). 검사하다 오류가 났다(올리기 전 검사 전체를 멈추지 않는다).
//
// 편 폴더 이름 끝 날짜가 11-20 이후인 LAB 편만 본다. 노래 · 퀴즈 틀(LAB_노래_ · LAB_퀴즈_)은 짜임이 달라 보지 않는다.
// 색은 주석을 뺀 코드에서 찾고 rgb(…) 꼴도 같은 값이면 받는다. 그 색을 맞는 자리에 썼는지는 못 본다 — 이해 시험과 사람 눈의 몫이다.
// 틀림 표시는 화면에 나가는 글자(✗ ✕ ✖ ❌ — 코드의 글자열 · JSX 글 · 판본 글)와 표시 값 쓰임(mark: 'ng')만 센다. 주석과 형 선언, 낱말 wrong은 세지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const { FIX, LOOK } = require('./게시글규칙.js');

const FROM = '20261120';
const OK = '#0A9A66';
const NG = '#D92D20';
const ROW = '맞음틀림';
const NONE = '없음';
const HAS = '있음';
const OTHER_FRAME = /^LAB_(노래|퀴즈)_/;
const GLYPH = /[✗✕✖❌]/;
const MARK_USE = /\bmark\s*[:=]\s*\{?\s*['"]ng['"]/;
const MAX_BYTES = 400 * 1024;
const MAX_FILES = 2000;

const folderDate = (name) => (String(name).match(/_(\d{8})$/) || [])[1] || null;

// 기획.md 칸표 한 줄 = `| 칸 이름 | 값 |`. 끝의 `|`는 없어도 되고 굵게(**) 쓴 이름도 받는다. 같은 이름이 여럿이면 처음 것.
function planRows(text) {
  const rows = new Map();
  for (const line of String(text || '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.slice(1).replace(/\|\s*$/, '').split('|');
    if (cells.length < 2) continue;
    const name = cells[0].replace(/\*/g, '').trim();
    if (!name || /^:?-+:?$/.test(name) || name === '칸') continue;
    if (!rows.has(name)) rows.set(name, cells.slice(1).join('|').trim());
  }
  return rows;
}

// 주석(/* … */ · // …)을 뺀다. 글자열 안의 // 는 건드리지 않는다.
const stripComments = (code) => String(code || '').replace(/("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m, str) => str || ' ');

const hex2 = (n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0');
// 색 값을 견줄 꼴로 — 소문자, rgb(10, 154, 102) · rgba(…)는 #0a9a66으로
const normalColors = (code) => String(code || '').toLowerCase().replace(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)/g, (m, r, g, b) => `#${hex2(r)}${hex2(g)}${hex2(b)}`);

const signOfCode = (code) => { const body = stripComments(code); return (body.match(GLYPH) || body.match(MARK_USE) || [])[0] || null; };
const signOfText = (text) => (String(text || '').match(GLYPH) || [])[0] || null;

// remotion/src 아래를 파일마다 읽어 색 · 틀림 표시만 적는다(글을 이어 붙이지 않는다 — 큰 편에서 글자열 길이 한도를 넘지 않게).
function sourceOf(dir) {
  const root = path.join(dir, 'remotion', 'src');
  const out = { 코드있음: false, 초록: false, 빨강: false, 표시: null, 못읽음: [], 파일수: 0 };
  const ok = OK.toLowerCase(), ng = NG.toLowerCase();
  const walk = (at) => {
    let names = [];
    try { names = fs.readdirSync(at, { withFileTypes: true }); } catch { return; }
    for (const e of names) {
      if (e.name === 'node_modules') continue;
      const abs = path.join(at, e.name);
      if (e.isDirectory()) { walk(abs); continue; }
      const isCode = /\.tsx?$/.test(e.name);
      if (!isCode && !/\.json$/.test(e.name)) continue;
      const rel = path.relative(root, abs).split(path.sep).join('/');
      if (isCode) out.코드있음 = true;
      if (out.파일수 >= MAX_FILES) { if (isCode) out.못읽음.push(`${rel}(파일 ${MAX_FILES}개 넘음)`); continue; }
      out.파일수 += 1;
      let text;
      try {
        if (fs.statSync(abs).size > MAX_BYTES) { if (isCode) out.못읽음.push(`${rel}(${Math.round(MAX_BYTES / 1024)}KB 넘음)`); continue; }
        text = fs.readFileSync(abs, 'utf8');
      } catch { if (isCode) out.못읽음.push(`${rel}(읽기 실패)`); continue; }
      if (isCode) {
        const colors = normalColors(stripComments(text));
        if (colors.includes(ok)) out.초록 = true;
        if (colors.includes(ng)) out.빨강 = true;
        if (!out.표시) out.표시 = signOfCode(text);
      } else if (!out.표시) out.표시 = signOfText(text);
    }
  };
  walk(root);
  return out;
}

function rightWrongFindings(bundle) {
  const out = [];
  const add = (level, code, where, message) => out.push({ level, code, where, message });
  const rule = '제작 절차 「맞는 말 · 틀린 말」';
  try {
    const date = folderDate(bundle.name);
    if (!date || date < FROM || bundle.prep?.브랜드 !== 'LAB' || OTHER_FRAME.test(bundle.name)) return out;
    const src = sourceOf(bundle.dir);
    let plan = null;
    try { plan = fs.readFileSync(path.join(bundle.dir, '기획.md'), 'utf8'); } catch { plan = null; }
    if (plan === null) {
      if (src.표시) add(FIX, 'right-wrong-row', '기획.md', `화면 코드에 틀림 표시(${src.표시})가 있는데 기획.md가 없다 — 칸표에 「${ROW}」 칸을 「${HAS}(무엇이 틀린 말인지)」이나 「${NONE}(그 표시가 무엇인지)」으로 적는다(${rule})`);
      else add(LOOK, 'right-wrong-row', '기획.md', `기획.md가 없어 「${ROW}」 칸을 못 봤다 — 맞는 말과 틀린 말이 화면에 함께 나오는 편이면 색을 맞춘다(${rule})`);
      return out;
    }
    const rows = planRows(plan);
    if (!rows.has(ROW)) {
      add(FIX, 'right-wrong-row', '기획.md', `「${ROW}」 칸이 없다${src.표시 ? `(화면 코드에 틀림 표시 ${src.표시}가 있다)` : ''} — 「${NONE}」이나 「${HAS}(무엇이 틀린 말인지)」으로 적는다(${rule})`);
      return out;
    }
    const value = String(rows.get(ROW) || '').replace(/\*/g, '').trim();
    if (value.startsWith(HAS)) {
      const missing = [[src.초록, OK, '맞는 말 초록'], [src.빨강, NG, '틀린 말 빨강']].filter(([found]) => !found).map(([, hex, label]) => `${label} ${hex}`);
      if (!missing.length) return out;
      if (!src.코드있음) add(LOOK, 'right-wrong-color', 'remotion/src', `「${ROW}」이 「${HAS}」인데 화면 코드가 없어 색을 못 봤다 — 맞는 말이 초록 ${OK} + ✓, 틀린 말이 빨강 ${NG} + ✗인지 영상에서 본다(${rule})`);
      else if (src.못읽음.length) add(LOOK, 'right-wrong-color', 'remotion/src', `「${ROW}」이 「${HAS}」인데 못 읽은 코드 파일이 있어 ${missing.join(' · ')}을 못 찾았다(${src.못읽음.slice(0, 3).join(' · ')}) — 영상에서 본다(${rule})`);
      else add(FIX, 'right-wrong-color', 'remotion/src', `「${ROW}」이 「${HAS}」인데 화면 코드(주석 뺌)에 ${missing.join(' · ')}이 없다 — 맞는 말은 초록 + ✓, 틀린 말은 빨강 + ✗로 가른다(${rule})`);
      return out;
    }
    if (value.startsWith(NONE)) {
      if (src.표시) add(LOOK, 'right-wrong-sign', 'remotion/src', `「${ROW}」은 「${NONE}」인데 화면 코드에 틀림 표시(${src.표시})가 있다 — 틀린 말이 화면에 나오면 「${HAS}」으로 고치고 색을 맞춘다(${rule})`);
      return out;
    }
    add(FIX, 'right-wrong-row', '기획.md', `「${ROW}」 칸 값이 「${NONE}」이나 「${HAS}」으로 시작하지 않는다: ${value.slice(0, 40)}`);
  } catch (error) {
    add(LOOK, 'right-wrong-error', '맞음틀림', `맞는 말 · 틀린 말 색을 보다가 오류가 났다(${String(error && error.message).slice(0, 120)}) — 영상에서 직접 본다(${rule})`);
  }
  return out;
}

module.exports = { rightWrongFindings, sourceOf, planRows, stripComments, normalColors, signOfCode, signOfText, FROM, OK, NG, ROW, NONE, HAS, MAX_BYTES };
