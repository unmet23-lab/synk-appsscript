'use strict';
// 검사 이력 — 검사 도구가 돌 때마다 편 폴더 게시/검사이력.jsonl에 한 줄을 덧붙인다(2026-11-15, 흠 장부 설계 1단계).
//
// 왜: 기계 검사는 마지막 결과만 남겨서, 고치고 다시 돌리면 걸렸던 흔적이 사라졌다(올리기 전 검사는 준비.json 「검사」를 덮어쓴다).
//   그래서 어떤 흠이 몇 편에서 어느 단계에 잡혔는지 셀 수 없었다. 유호님 11-15 「작업 하나 마무리될때 그 과정에서 중요한것들
//   (실수내용 고친내용) 반영이 잘 되서 가면갈수록 실수없는 제대로 된 자동화 에이전트를 만들고싶어」. 설계는
//   docs/마케팅/제작양식/흠장부_설계_20261115.md 「① 쌓임」, 세는 쪽은 tools/흠장부.js다.
//
// 가장 중요한 약속: 이 모듈은 검사의 결과와 끝 코드를 바꾸지 않는다. 남기기()는 어떤 경우에도 던지지 않고, 화면에 아무것도 찍지 않는다.
//   폴더가 없거나 권한이 없거나 잠겨 있으면 조용히 건너뛴다(돌려주는 값의 「까닭」에만 남는다). 파이썬 도구는 같은 일을 하는
//   tools/lib/검사이력.py를 쓴다 — 두 판의 줄 꼴은 tests/검사이력.test.js가 맞춘다.
//
// 한 줄: {"때","길","엔진"?,"판"?,"단계","눈","결과","끝코드"?,"걸림":[{"규칙","번호"?,"등급","글"}],"더있음"?}
//   길   만드는 길 — LAB(브랜드 LAB) · 컷표영상(편 폴더에 컷표.json이나 컷순서.json) · 그래픽(그 밖)
//   엔진 컷표.json 「엔진」(그림 엔진과 영상 모델) — 있을 때만
//   판   검사한 판의 지문(영상 · 컷표의 SHA-256 앞 12자) — 알 수 있을 때만
//   단계 콘티 · 지시문 · 이미지 콘티 · 받은 뒤 · 편집 · 올리기 전 · 최종 확인. 부른 도구가 SYNK_검사단계로 넘기면 그 값을 쓴다
//   눈   검사 이름(올리기전검사 · 최종본검사 · 컷연속성검사 · 받은뒤검사)
//   결과 걸림 · 확인 · 통과 · 못 잼 — 걸린 것이 없어도 한 줄을 남긴다(첫 통과율의 분모)
//   걸림 걸린 항목마다 검사의 규칙 이름, 점검표 번호(흠갈래.json 「올린검사」에 이어진 규칙만), 등급(걸림 · 확인), 글 한 줄
// 같은 눈 · 같은 단계의 바로 앞 줄과 판 · 결과 · 걸림이 모두 같으면 덧붙이지 않는다(같은 판을 여러 번 돌려도 줄이 불지 않게).
// 끄기: 환경 변수 SYNK_검사이력=끔.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const HISTORY = '검사이력.jsonl';
const REPO = path.resolve(__dirname, '..', '..');
const 갈래파일 = path.join(REPO, 'docs', '마케팅', '제작양식', '흠갈래.json');
const 걸림상한 = 40;
const 글상한 = 200;

function 있나(p) { try { fs.accessSync(p); return true; } catch { return false; } }
function 편인가(d) { return 있나(path.join(d, '게시', '준비.json')) || 있나(path.join(d, '컷표.json')) || 있나(path.join(d, '컷순서.json')); }

// 편 폴더 찾기 — 준 경로(파일이면 그 폴더)에서 위로 여섯 층까지 올라가며 게시/준비.json · 컷표.json · 컷순서.json이 있는 폴더.
// 저장소 뿌리(.git)나 docs/마케팅에 닿으면 멈춘다. 시험 픽스처(tests/fixtures 아래)에는 쓰지 않는다.
function 편찾기(시작) {
  try {
    if (process.env.SYNK_검사편) return 편인가(path.resolve(process.env.SYNK_검사편)) ? path.resolve(process.env.SYNK_검사편) : null;
    if (!시작) return null;
    let d = path.resolve(String(시작));
    try { if (!fs.statSync(d).isDirectory()) d = path.dirname(d); } catch { d = path.dirname(d); }
    if (/[\\/]tests[\\/]fixtures([\\/]|$)/.test(d)) return null;
    for (let i = 0; i < 6; i += 1) {
      if (편인가(d)) return d;
      if (있나(path.join(d, '.git')) || path.basename(d) === '마케팅') return null;
      const up = path.dirname(d);
      if (up === d) return null;
      d = up;
    }
  } catch { /* 못 찾으면 쓰지 않는다 */ }
  return null;
}

function json읽기(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')); } catch { return null; } }

// 만드는 길 — 흠은 길을 따라 생긴다(설계 「결론」). 브랜드 LAB이면 LAB, 컷표가 있으면 컷표영상, 그 밖은 그래픽.
function 길of(편, 준비 = undefined) {
  const prep = 준비 === undefined ? json읽기(path.join(편, '게시', '준비.json')) : 준비;
  const 브랜드 = String(prep?.브랜드 || '').trim();
  if (/^lab$/i.test(브랜드) || (!브랜드 && /^LAB[_-]/i.test(path.basename(편)))) return 'LAB';
  if (있나(path.join(편, '컷표.json')) || 있나(path.join(편, '컷순서.json'))) return '컷표영상';
  return '그래픽';
}

function 엔진of(편) {
  const 표 = json읽기(path.join(편, '컷표.json'));
  const e = 표 && 표.엔진;
  if (!e) return undefined;
  if (typeof e === 'string') return e.slice(0, 80);
  if (typeof e === 'object' && !Array.isArray(e)) {
    const out = {};
    for (const [k, v] of Object.entries(e)) if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 80);
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

// 판 지문 — 글 조각들을 이어 SHA-256 앞 12자
function 지문(조각들) {
  const xs = [].concat(조각들 || []).map(String).filter(Boolean);
  if (!xs.length) return undefined;
  return crypto.createHash('sha256').update(xs.join('\n')).digest('hex').slice(0, 12);
}

// 흠갈래.json 「줄」의 「올린검사」에서 「<검사>:<규칙>」 → 점검표 번호 표를 만든다(못 읽으면 빈 표)
let 번호표캐시 = null;
function 번호표() {
  if (번호표캐시) return 번호표캐시;
  const 표 = new Map();
  const j = json읽기(갈래파일);
  for (const 줄 of [].concat(j?.줄 || [])) {
    for (const 올림 of [].concat(줄?.올린검사 || [])) {
      for (const 규칙 of [].concat(올림?.규칙 || [])) if (올림.검사 && 규칙) 표.set(`${올림.검사}:${규칙}`, 줄.번호);
    }
  }
  번호표캐시 = 표;
  return 표;
}
function 번호찾기(눈, 규칙) { return 번호표().get(`${눈}:${규칙}`); }

// 경로 → 대소문자와 구분 기호(\ · / · JSON의 \\)를 가리지 않는 정규식 글.
// 맨 앞 구분 기호(POSIX 뿌리)는 남기고 그 앞이 글자면 맞추지 않는다 — 버리면 「/root」가 「root」가 되어 경로가 아닌 「rootDir」까지 걷고,
// 「/home/…/저장소/docs」가 「/docs」로 남는다(GPT 다시 검수 GA1, 11-15).
function 경로꼴(r) {
  const 조각 = String(r).split(/[\\/]+/).filter(Boolean).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\\\/]+');
  return /^[\\/]/.test(String(r)) ? `(?<![^\\s"'\`|(\\[=:,;])[\\\\/]+${조각}` : 조각;
}
const 이름끝 = '(?![^\\\\/\\s"\'`|)\\],;:])';   // 뒤가 이름 글자면 다른 경로다(「…\q1212x」 · 「/rootDir」)

// 글 한 줄 — 저장소 · 홈 절대 경로를 걷고(공개 저장소), 줄바꿈을 펴고, 길이를 줄인다. 둘째 인자는 시험이 다른 운영체제의 경로 꼴을 넣을 때만 쓴다.
function 글다듬기(글, 자리) {
  // 윈도우 경로는 대소문자와 구분 기호가 섞여 들어온다 — 둘 다 가리지 않고 맞춘다(GPT 검수 GA1: 「c:\Users\…」가 그대로 남았다)
  let s = String(글 ?? '');
  const 저장소 = (자리 && typeof 자리 === 'object' && 자리.저장소) || REPO;
  const 홈 = (자리 && typeof 자리 === 'object' && 자리.홈) || os.homedir();
  if (저장소.length > 3) s = s.replace(new RegExp(`${경로꼴(저장소)}(?:[\\\\/]+|${이름끝})`, 'gi'), (m) => (/[\\/]$/.test(m) ? '' : '.'));
  if (홈 && 홈.length > 3) s = s.replace(new RegExp(경로꼴(홈) + 이름끝, 'gi'), '~');
  s = s.replace(/[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"'`|]+/gi, '~');   // 다른 사용자 폴더도 이름을 남기지 않는다
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > 글상한 ? `${s.slice(0, 글상한 - 1)}…` : s;
}

const 결과들 = new Set(['걸림', '확인', '통과', '못 잼']);

function 줄만들기({ 편, 눈, 단계, 결과, 끝코드, 판, 걸림 = [], 길, 엔진 }) {
  const items = [];
  for (const x of [].concat(걸림 || [])) {
    if (!x) continue;
    const 등급 = x.등급 === '확인' ? '확인' : '걸림';
    const 규칙 = String(x.규칙 || '').trim() || '이름없음';
    const 번호 = Number.isInteger(x.번호) ? x.번호 : 번호찾기(눈, 규칙);
    items.push({ 규칙, ...(Number.isInteger(번호) ? { 번호 } : {}), 등급, 글: 글다듬기(x.글) });
  }
  const 엔진값 = 엔진 !== undefined ? 엔진 : 엔진of(편);
  const 줄 = {
    때: new Date().toISOString(),
    길: 길 || 길of(편),
    ...(엔진값 ? { 엔진: 엔진값 } : {}),
    ...(판 ? { 판: String(판) } : {}),
    단계: String(process.env.SYNK_검사단계 || 단계 || '').trim() || '모름',
    눈: String(눈 || '').trim() || '모름',
    결과: 결과들.has(결과) ? 결과 : '못 잼',
    ...(Number.isInteger(끝코드) ? { 끝코드 } : {}),
    걸림: items.slice(0, 걸림상한),
    ...(items.length > 걸림상한 ? { 더있음: items.length - 걸림상한 } : {}),
  };
  return 줄;
}

function 줄들읽기(파일) {
  let 글;
  try { 글 = fs.readFileSync(파일, 'utf8'); } catch { return []; }
  const out = [];
  for (const l of 글.split(/\r?\n/)) {
    if (!l.trim()) continue;
    try { out.push(JSON.parse(l)); } catch { /* 깨진 줄은 건너뛴다 */ }
  }
  return out;
}

const 같은꼴 = (a) => JSON.stringify({ 판: a.판 || '', 결과: a.결과, 걸림: (a.걸림 || []).map((x) => [x.규칙, x.번호 ?? null, x.등급, x.글]), 더있음: a.더있음 || 0 });

// 남기기 — 검사가 끝난 뒤 부른다. 던지지 않는다. → { 남김, 파일?, 까닭? }
function 남기기(o = {}) {
  try {
    if (String(process.env.SYNK_검사이력 || '') === '끔') return { 남김: false, 까닭: 'SYNK_검사이력=끔' };
    const 편 = 편찾기(o.편 || o.시작);   // SYNK_검사편이 있으면 그 폴더(부른 도구가 편을 알 때)
    if (!편) return { 남김: false, 까닭: '편 폴더를 못 찾음' };
    const 줄 = 줄만들기({ ...o, 편 });
    const 파일 = path.join(편, '게시', HISTORY);
    const 앞 = 줄들읽기(파일).reverse().find((x) => x && x.눈 === 줄.눈 && x.단계 === 줄.단계);
    if (앞 && 같은꼴(앞) === 같은꼴(줄)) return { 남김: false, 파일, 까닭: '바로 앞 줄과 같음' };
    fs.mkdirSync(path.dirname(파일), { recursive: true });
    let 앞글 = '';
    try { 앞글 = fs.readFileSync(파일, 'utf8'); } catch { /* 새 파일 */ }
    const 줄끝 = 앞글.includes('\r\n') ? '\r\n' : '\n';
    const 머리 = 앞글 && !/\n$/.test(앞글) ? 줄끝 : '';
    fs.appendFileSync(파일, `${머리}${JSON.stringify(줄)}${줄끝}`);
    return { 남김: true, 파일 };
  } catch (error) {
    return { 남김: false, 까닭: String(error && error.message || error) };
  }
}

module.exports = { HISTORY, 남기기, 줄만들기, 줄들읽기, 편찾기, 편인가, 길of, 엔진of, 지문, 번호찾기, 글다듬기, 경로꼴, 갈래파일 };
