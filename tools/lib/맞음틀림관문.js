'use strict';

// ㉒ LAB 맞는 말 · 틀린 말 색(2026-11-19) — 규칙 원문은 제작 절차 「근거 · 틀 · 화면」의 「맞는 말 · 틀린 말」(docs/마케팅/기획장부/제작절차.md#right-wrong-marks)이다.
// 유호님 11-19 「맞았을때 표현이랑 틀렸을때 표현이랑 글씨 색이 똑같아서 외국인 입장에서 보면 많이 헷갈리거든」 — 그날 13시 편 「사요 · 찍어요」는
// 맞는 말 「붕어빵 사자!」와 틀린 말 「사진도 사자!」의 짚는 낱말이 둘 다 산호색이었고, 맞음 알약은 붉은색 · 틀림 알약은 검정이었다.
// 맞는 말은 초록(OK) + ✓, 틀린 말은 빨강(NG) + ✗로 가른다. 규칙을 글로만 두면 회차 세션이 놓치므로 기획 칸과 화면 코드의 두 색을 여기서 본다.
//
//   고칠 것 — 기획.md 칸표에 「맞음틀림」 칸이 없다(규칙: 모든 LAB 편이 「없음」이나 「있음」을 적는다). 칸 값이 「없음」 · 「있음」으로 시작하지 않는다.
//             칸이 「있음」인데 화면 코드(remotion/src의 .ts · .tsx, 주석 뺌)에 두 색이 다 있지 않다. 기획.md가 없다(칸을 적을 자리가 없다 —
//             틀림 표시가 보이든 안 보이든 같다. 11-20 설계 검토: 새 편에서 틀림 표시 짐작이 고칠 것과 확인할 것을 가르지 않게 한다).
//   확인할 것 — 칸은 「없음」인데 화면 코드에 틀림 표시가 있다. 「있음」인데 화면 코드가 없거나 못 읽은 코드 파일이 있어 색을 못 봤다.
//             검사하다 오류가 났다(올리기 전 검사 전체를 멈추지 않는다).
//
// 편 폴더 이름 끝 날짜가 11-20 이후인 LAB 편은 위 전부를 본다. 노래 · 퀴즈 틀(LAB_노래_ · LAB_퀴즈_)은 짜임이 달라 보지 않는다.
//
// 그 앞에 만든 옛 편(날짜가 11-20 앞이거나 이름에 날짜가 없는 편)은 좁게 본다(2026-11-20 유호님 「네, 넓혀 줘」). 옛 편을 나라별 계정으로 돌릴 때
// 색을 맞추는 일이 제작 절차 한 줄에만 있어, 손이 놓치면 옛 모양으로 나갔다 — 11-20에 세어 보니 틀림 표시가 있는데 두 색이 없는 옛 편이 아홉(퀴즈 틀 셋 빼고)이었다.
//   고칠 것 — 「맞음틀림」 칸이 없는데(기획.md가 없어도 같다) 화면 코드나 판본 글 값에 틀림 글자(✗ ✕ ✖ ❌)가 적혀 있고 두 색이 다 있지 않다.
//             색을 맞추거나, 틀린 말 표시가 아니면 칸에 「없음(그 글자가 무엇인지)」을 적는다. 칸을 적은 옛 편은 새 편과 똑같이 본다.
//   확인할 것 — 못 읽은 파일 · 폴더가 하나라도 있다(코드든 판본 글이든). 옛 편은 다 읽은 편만 고칠 것을 낸다.
//   보지 않는 것 — 칸이 없고 틀림 글자도 없는 옛 편. 표시 없이 글자 색만 같은 옛 편은 여기서 못 잡는다 — 제작 절차 「새 원본은 어떻게 올리나」의 걸음이 본다.
//   계약(제작 절차 「맞는 말 · 틀린 말」에 같은 글이 있다) — 옛 편의 고칠 것은 「틀림 글자가 적혀 있으니 칸 한 줄로 판단을 적어 달라」는 요청이다.
//   방아쇠는 둘뿐이다: 화면 코드에 그대로 적힌 틀림 글자(주석은 뺀다), 판본 글(「판본」 폴더의 JSON)에서 이름이 _로 시작하지 않는 칸의 값.
//   코드를 푸는 파서가 아니다 — 주석은 한 줄 짐작(따옴표 · 백틱 글과 // · /* */ 꼴)으로 빼고, 글자가 화면에 실제로 나가는지는 가리지 않는다.
//   그래서 양쪽으로 어긋날 수 있고, 그것은 결함이 아니라 이 계약이다.
//     더 막는 쪽 — 글자를 지우는 식, 글자를 든 형 선언, 따옴표가 섞인 줄(JSX 글의 홑따옴표 등)이라 주석으로 못 읽힌 주석의 글자.
//                  칸에 「없음(그 글자가 무엇인지)」 한 줄로 푼다.
//     놓치는 쪽 — 코드에 유니코드 이스케이프나 HTML 엔티티로 적은 글자, 글자 번호로 지은 글자, SVG로 그린 ✗, .js 파일, 판본 폴더 밖의 JSON,
//                  글 안의 // · /* 꼴 때문에 주석으로 읽힌 글자, 글자 색만 같은 편. 제작 절차의 옮기는 걸음이 본다.
//   표시 값 쓰임(mark: 'ng')은 옛 편의 방아쇠로 쓰지 않는다 — 형 선언과 글로 가르지 못하고, 그 값은 11-19에 색과 함께 들어온 꼴이라 옛 화면에는 없다
//   (GPT 검수 lab-right-wrong-old-20261120 · 20261120b GA2 · 설계 검토 .tmp/검수/설계검토_맞음틀림_옛편_20261120.md).
//   이미 걸린 예약은 이 검사가 내리지 않는다 — 고칠 것은 그 편의 새 예약을 막을 뿐이다.
// 색은 주석을 뺀 코드에서 찾고 rgb(…) 꼴도 같은 값이면 받는다. 그 색을 맞는 자리에 썼는지는 못 본다 — 이해 시험과 사람 눈의 몫이다.
// 틀림 표시는 글자(✗ ✕ ✖ ❌ — 코드의 글자열 · JSX 글 · 판본 글 값)와 표시 값 쓰임(mark: 'ng')이다. 주석과 낱말 wrong은 세지 않는다.
// 코드에 역슬래시 u 꼴(유니코드 이스케이프)로 적은 글자는 세지 않는다. 풀려면 그 꼴이 글자열 안인지 JSX 맨글 · 정규식 안인지를 알아야 하는데,
// 파서 없이 따옴표 문맥을 가르면 양쪽으로 틀린다(20261120b GA1 · 20261120d GA1 · 20261120e GA1 · GA2). 실제 편 1,441개 파일에 그 꼴은 없다(설계 검토).
// 표시 값 쓰임에서 형 선언은 여러 값 가운데 하나로 적은 꼴(mark: 'ng' | 'ok')만 가려 뺀다 — 새 편의 「없음」 칸과 견주는 확인할 것에만 쓴다.
// 판본 글(JSON)은 풀어서 값만 본다(JSON의 유니코드 이스케이프는 풀린다). 이름이 _로 시작하는 칸(_설명 · _원문 · _한도)은 화면에 안 나가는 작업 메모라 건너뛴다 —
// 11-20에 세어 보니 판본 글에서 틀림 글자가 든 글자열 223개 가운데 220개가 그 칸이었다(GPT 검수 lab-right-wrong-old-20261120 GA1).
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
// 값 쓰임 mark: 'ng' · mark="ng". 뒤에 | 가 오면 형 선언(mark: 'ng' | 'ok')이라 세지 않는다.
const MARK_USE = /\bmark\s*[:=]\s*\{?\s*['"]ng['"](?!\s*\|)/;
const MAX_BYTES = 400 * 1024;
const MAX_FILES = 2000;
const VERSIONS_DIR = '판본'; // 판본 글(JSON)이 든 폴더 이름 — remotion/src 아래 어느 깊이든

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

// 코드에 그대로 적힌 틀림 글자(주석 뺌). 이스케이프나 엔티티로 적은 글자는 풀지 않는다 — 머리말의 계약
const glyphOfCode = (code) => (stripComments(code).match(GLYPH) || [])[0] || null;
// 코드의 틀림 표시 — 글자가 먼저, 없으면 표시 값 쓰임
const signOfCode = (code) => glyphOfCode(code) || (stripComments(code).match(MARK_USE) || [])[0] || null;
const signOfText = (text) => (String(text || '').match(GLYPH) || [])[0] || null;

// 판본 글(JSON)의 틀림 글자 — 풀어서 값만 본다(유니코드 이스케이프도 풀린다). 이름이 _로 시작하는 칸은 작업 메모라 건너뛴다.
// 찾으면 그 글자, 없으면 null, JSON으로 못 풀면 undefined(못 읽음).
function signOfJson(text) {
  let data;
  const raw = String(text || '');
  try { data = JSON.parse(raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw); } catch { return undefined; }
  const todo = [data];
  while (todo.length) {
    const v = todo.pop();
    if (typeof v === 'string') { const m = v.match(GLYPH); if (m) return m[0]; }
    else if (Array.isArray(v)) { for (const x of v) todo.push(x); }
    else if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v)) if (!k.startsWith('_')) todo.push(x); }
  }
  return null;
}

// remotion/src 아래를 파일마다 읽어 색 · 틀림 표시만 적는다(글을 이어 붙이지 않는다 — 큰 편에서 글자열 길이 한도를 넘지 않게).
// 글자 = 틀림 글자만(옛 편의 방아쇠). 표시 = 글자나 표시 값 쓰임(새 편의 확인할 것).
// 못읽음 = 못 읽은 코드 파일 · 폴더(색도 표시도 모른다). 글못읽음 = 못 읽은 판본 글(표시만 모른다 — 색은 코드에서만 찾는다).
// 판본 글 = 이름이 「판본」인 폴더 안의 JSON이다. 그 밖의 JSON(langProfile · beats · episode 같은 설정 · 제작 메모)은 읽지 않는다 —
// 11-20 실제 편의 JSON 404개 가운데 388개가 판본 폴더였고, 밖의 16개에는 틀림 글자가 없었다(lab-right-wrong-old-20261120g GA1).
// 판본 글은 글자를 이미 찾았어도 모두 풀어 본다 — 못 푼 파일이 읽는 차례에 따라 적히거나 빠지지 않게(같은 사슬 GA2).
function sourceOf(dir) {
  const root = path.join(dir, 'remotion', 'src');
  const out = { 코드있음: false, 초록: false, 빨강: false, 글자: null, 표시: null, 못읽음: [], 글못읽음: [], 파일수: 0 };
  const ok = OK.toLowerCase(), ng = NG.toLowerCase();
  const relOf = (abs) => path.relative(root, abs).split(path.sep).join('/');
  const walk = (at) => {
    let names = [];
    try { names = fs.readdirSync(at, { withFileTypes: true }); } catch (error) {
      // 화면 코드 폴더가 아예 없는 편은 못 읽은 것이 아니다. 그 밖(권한 · 폴더가 아님 · 아래 폴더)은 그 안의 색과 표시를 모른다.
      if (!(at === root && error && error.code === 'ENOENT')) out.못읽음.push(`${relOf(at) || '.'}/(폴더 읽기 실패)`);
      return;
    }
    for (const e of names) {
      if (e.name === 'node_modules') continue;
      const abs = path.join(at, e.name);
      if (e.isDirectory()) { walk(abs); continue; }
      const isCode = /\.tsx?$/.test(e.name);
      const rel = relOf(abs);
      if (!isCode && !(/\.json$/.test(e.name) && rel.split('/').slice(0, -1).includes(VERSIONS_DIR))) continue;
      const unread = isCode ? out.못읽음 : out.글못읽음;
      if (isCode) out.코드있음 = true;
      if (out.파일수 >= MAX_FILES) { unread.push(`${rel}(파일 ${MAX_FILES}개 넘음)`); continue; }
      out.파일수 += 1;
      let text;
      try {
        if (fs.statSync(abs).size > MAX_BYTES) { unread.push(`${rel}(${Math.round(MAX_BYTES / 1024)}KB 넘음)`); continue; }
        text = fs.readFileSync(abs, 'utf8');
      } catch { unread.push(`${rel}(읽기 실패)`); continue; }
      if (isCode) {
        const colors = normalColors(stripComments(text));
        if (colors.includes(ok)) out.초록 = true;
        if (colors.includes(ng)) out.빨강 = true;
        if (!out.글자) out.글자 = glyphOfCode(text);
        if (!out.표시) out.표시 = signOfCode(text);
      } else {
        const sign = signOfJson(text);
        if (sign === undefined) out.글못읽음.push(`${rel}(JSON으로 못 풂)`);
        else if (sign) { if (!out.글자) out.글자 = sign; if (!out.표시) out.표시 = sign; }
      }
    }
  };
  walk(root);
  return out;
}

// 화면 코드에서 못 찾은 색 — 「맞는 말 초록 #0A9A66」 꼴의 글 목록
const missingColors = (src) => [[src.초록, OK, '맞는 말 초록'], [src.빨강, NG, '틀린 말 빨강']].filter(([found]) => !found).map(([, hex, label]) => `${label} ${hex}`);

function rightWrongFindings(bundle) {
  const out = [];
  const add = (level, code, where, message) => out.push({ level, code, where, message });
  const rule = '제작 절차 「맞는 말 · 틀린 말」';
  try {
    if (bundle.prep?.브랜드 !== 'LAB' || OTHER_FRAME.test(bundle.name)) return out;
    const date = folderDate(bundle.name);
    const old = !date || date < FROM;
    const src = sourceOf(bundle.dir);
    let plan = null;
    try { plan = fs.readFileSync(path.join(bundle.dir, '기획.md'), 'utf8'); } catch (error) {
      // 파일이 없는 것(ENOENT)만 「기획.md 없음」이다. 그 밖의 읽기 실패는 칸이 있는지 모르는 것이라 막지 않고 알린다(20261120e GA4)
      if (!(error && error.code === 'ENOENT')) {
        add(LOOK, 'right-wrong-error', '기획.md', `기획.md를 못 읽어(${String((error && (error.code || error.message)) || '').slice(0, 60)}) 「${ROW}」 칸을 못 봤다 — 다시 돌려 보고, 그대로면 영상에서 색을 본다(${rule})`);
        return out;
      }
      plan = null;
    }
    // 옛 편 — 칸을 적지 않았으면 틀림 글자가 적혀 있는데 두 색이 없을 때만 걸린다. 칸을 적었으면 아래 새 편의 길로 간다.
    if (old && !(plan !== null && planRows(plan).has(ROW))) {
      const missing = missingColors(src);
      // 옛 편은 못 읽은 파일 · 폴더가 하나라도 있으면(코드든 판본 글이든) 막지 않는다 — 다 읽은 편만 고칠 것을 낸다
      const unread = [...src.못읽음, ...src.글못읽음];
      const 못읽은곳 = unread.slice(0, 3).join(' · ');
      if (!src.글자) {
        // 글자를 못 찾았어도 못 읽은 것이 있으면 없다고 못 한다 — 영상에서 보게 한다
        if (unread.length) add(LOOK, 'right-wrong-old', 'remotion/src', `옛 편(11-20 앞)에 못 읽은 파일이 있어 틀림 글자가 적혀 있는지 못 봤다(${못읽은곳}) — 맞는 말과 틀린 말이 함께 나오면 영상에서 색을 본다(${rule})`);
        return out;
      }
      if (!missing.length) return out;
      const how = `색을 맞추거나, 틀린 말 표시가 아니면 기획.md 칸표에 「${ROW} | ${NONE}(그 글자가 무엇인지)」을 적는다`;
      if (unread.length) add(LOOK, 'right-wrong-old', 'remotion/src', `옛 편(11-20 앞)의 화면 코드나 판본 글에 틀림 글자(${src.글자})가 적혀 있고 ${missing.join(' · ')}을 못 찾았는데, 못 읽은 파일이 있어 막지 않는다(${못읽은곳}) — 영상에서 색을 본다(${rule})`);
      else add(FIX, 'right-wrong-old', 'remotion/src', `옛 편(11-20 앞)의 화면 코드(주석 뺌)나 판본 글에 틀림 글자(${src.글자})가 적혀 있는데 ${missing.join(' · ')}이 없다 — ${how}(${rule})`);
      return out;
    }
    if (plan === null) {
      // 새 편은 기획.md가 없으면 틀림 표시와 상관없이 고칠 것이다 — 표시 짐작은 글에 덧붙이기만 한다(칸이 없을 때와 같은 원칙)
      add(FIX, 'right-wrong-row', '기획.md', `기획.md가 없어 「${ROW}」 칸이 없다${src.표시 ? `(화면 코드에 틀림 표시 ${src.표시}가 있다)` : ''} — 칸표에 「${ROW}」 칸을 「${HAS}(무엇이 틀린 말인지)」이나 「${NONE}」으로 적는다(${rule})`);
      return out;
    }
    const rows = planRows(plan);
    if (!rows.has(ROW)) {
      add(FIX, 'right-wrong-row', '기획.md', `「${ROW}」 칸이 없다${src.표시 ? `(화면 코드에 틀림 표시 ${src.표시}가 있다)` : ''} — 「${NONE}」이나 「${HAS}(무엇이 틀린 말인지)」으로 적는다(${rule})`);
      return out;
    }
    const value = String(rows.get(ROW) || '').replace(/\*/g, '').trim();
    if (value.startsWith(HAS)) {
      const missing = missingColors(src);
      if (!missing.length) return out;
      // 못 읽은 것을 먼저 본다 — 화면 코드 폴더를 못 읽으면 코드가 「없는」 것이 아니라 「못 읽은」 것이다(lab-right-wrong-old-20261120g GA4)
      if (src.못읽음.length) add(LOOK, 'right-wrong-color', 'remotion/src', `「${ROW}」이 「${HAS}」인데 못 읽은 코드 파일 · 폴더가 있어 ${missing.join(' · ')}을 못 찾았다(${src.못읽음.slice(0, 3).join(' · ')}) — 영상에서 본다(${rule})`);
      else if (!src.코드있음) add(LOOK, 'right-wrong-color', 'remotion/src', `「${ROW}」이 「${HAS}」인데 화면 코드가 없어 색을 못 봤다 — 맞는 말이 초록 ${OK} + ✓, 틀린 말이 빨강 ${NG} + ✗인지 영상에서 본다(${rule})`);
      else add(FIX, 'right-wrong-color', 'remotion/src', `「${ROW}」이 「${HAS}」인데 화면 코드(주석 뺌)에 ${missing.join(' · ')}이 없다 — 맞는 말은 초록 + ✓, 틀린 말은 빨강 + ✗로 가른다(${rule})`);
      return out;
    }
    if (value.startsWith(NONE)) {
      const unread = [...src.못읽음, ...src.글못읽음];
      if (src.표시) add(LOOK, 'right-wrong-sign', 'remotion/src', `「${ROW}」은 「${NONE}」인데 화면 코드에 틀림 표시(${src.표시})가 있다 — 틀린 말이 화면에 나오면 「${HAS}」으로 고치고 색을 맞춘다(${rule})`);
      // 표시를 못 찾았어도 못 읽은 파일이 있으면 없다고 못 한다(lab-right-wrong-old-20261120g GA3 — 못 푼 판본 글의 틀림 글자)
      else if (unread.length) add(LOOK, 'right-wrong-sign', 'remotion/src', `「${ROW}」은 「${NONE}」인데 못 읽은 파일이 있어 틀림 표시가 있는지 못 봤다(${unread.slice(0, 3).join(' · ')}) — 영상에서 본다(${rule})`);
      return out;
    }
    add(FIX, 'right-wrong-row', '기획.md', `「${ROW}」 칸 값이 「${NONE}」이나 「${HAS}」으로 시작하지 않는다: ${value.slice(0, 40)}`);
  } catch (error) {
    add(LOOK, 'right-wrong-error', '맞음틀림', `맞는 말 · 틀린 말 색을 보다가 오류가 났다(${String(error && error.message).slice(0, 120)}) — 영상에서 직접 본다(${rule})`);
  }
  return out;
}

module.exports = { rightWrongFindings, sourceOf, planRows, stripComments, normalColors, signOfCode, glyphOfCode, signOfText, signOfJson, FROM, OK, NG, ROW, NONE, HAS, MAX_BYTES };
