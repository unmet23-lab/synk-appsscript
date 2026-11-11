'use strict';
/* 판본 글(2026-11-10 LAB 하루 두 편 · 39계정 — 설계 11 · 12 · 13 · 22). 한 원본의 한 판본(나라 · 언어판)이 화면에 내는 글의 정본이다.
 * 원본 편 게시/준비.json 「돌림」.판본[키].글이 이 파일을 가리키고, 뜻 검사 지문은 이 파일의 SHA-256이다(tools/돌림표.js 머리말) —
 * 글을 고치면 뜻 검수가 저절로 무효가 된다. tools/글자검사.js(렌더 전 규칙 · 엔진 잼) · tools/뜻검사.js · tools/현지어대조.js가 읽는다.
 *
 * 꼴(JSON):
 * { "꼴": "판본글/1", "편": "<원본 편 폴더 이름>", "판본": "<판본 키 — rotationVersion · countryCode>", "언어": "th", "나라": ["TH"],
 *   "틀": "퀴즈" | "이야기" | "노래"(11-11 LAB 21:00 노래 — docs/마케팅/LAB_노래틀), "화면": { "폭": 1080, "높이": 1920 },
 *   "기준": { "한문장": "…", "핵심": [["약속", "안 와"], …], "웃음": "…" }   ← 뜻 검사 채점 기준(없으면 원본 기획.md에서 읽는다)
 *   "줄": [ { "id": "q1.보기.2", "칸": "보기", "글": "<현지어>", "원문": "<한국어 원문>", "초": [3.2, 5.0], "장면": "<그때 화면 그림 — 한국어>",
 *            "상자": { "폭": 760, "높이": 120, "글자크기": 46, "굵기": 800, "줄높이": 1.2, "최대줄": 2, "글꼴": "<CSS 글꼴 줄>",
 *                      "자간": "0.02em", "가운데": true, "줄바꿈": "keep-all", "x": 160, "y": 900 },
 *            "대조": "직역" | "웃음" } … ],
 *   "퀴즈": [ { "문제": 1, "관용구": "입이 무겁다", "보기": ["q1.보기.1", "q1.보기.2", "q1.보기.3"], "정답": 2, "딱지": "q1.딱지" } ] }
 * 「칸」은 아래 칸표 가운데 하나다. 「대조」를 비우면 칸이 정한다(뜻 · 정답 · 예문은 직역과 같은지, 개그 · 해설 · 딱지는 웃음 의도가 같은지 — 설계 13).
 * 「상자」의 x · y는 화면 안 글 상자 왼쪽 위(1080×1920 기준)다 — 있으면 글자검사가 안전 영역도 렌더 전에 본다.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const 칸표 = Object.freeze({
  머리: '직역', 다리: '직역', 진행: '직역', 질문: '직역', 보기: '직역', 정답: '직역', 뜻: '직역', 예문: '직역', 상황: '직역',
  복습: '직역', 끝: '직역', 끝질문: '직역', 게시글: '직역',
  딱지: '웃음', 개그: '웃음', 해설: '웃음',
  한국어: null, 읽기: null,
});
const 한국어칸 = new Set(['한국어', '읽기']);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
}
// 다 쓰고 바꿔 넣는다 — 쓰다 실패해 빈 파일이 남지 않게(tools/돌림표.js와 같은 꼴).
function writeJson(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, file);
}
function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** 칸 → 대조 방식(직역 · 웃음 · null = 대조 안 함) */
function 칸대조(줄) {
  if (줄.대조 === '직역' || 줄.대조 === '웃음') return 줄.대조;
  if (Object.prototype.hasOwnProperty.call(칸표, 줄.칸)) return 칸표[줄.칸];
  return '직역';
}

function 검증(data) {
  const 문제 = [];
  if (!data || typeof data !== 'object') return ['JSON 객체가 아니다'];
  if (data.꼴 !== '판본글/1') 문제.push(`꼴이 「판본글/1」이 아니다(${data.꼴})`);
  for (const k of ['언어', '줄']) if (!data[k]) 문제.push(`「${k}」 칸이 없다`);
  if (data.틀 && !['퀴즈', '이야기', '노래'].includes(data.틀)) 문제.push(`틀은 퀴즈 · 이야기 · 노래 가운데 하나다(${data.틀})`);
  const ids = new Set();
  for (const [i, 줄] of (data.줄 || []).entries()) {
    const 곳 = `줄 ${i + 1}${줄.id ? `(${줄.id})` : ''}`;
    if (!줄.id) 문제.push(`${곳}: id가 없다`);
    else if (ids.has(줄.id)) 문제.push(`${곳}: id가 겹친다`);
    ids.add(줄.id);
    if (typeof 줄.글 !== 'string') 문제.push(`${곳}: 글이 없다`);
    if (줄.칸 && !Object.prototype.hasOwnProperty.call(칸표, 줄.칸)) 문제.push(`${곳}: 모르는 칸 「${줄.칸}」(${Object.keys(칸표).join(' · ')})`);
    if (줄.초 !== undefined && !(Array.isArray(줄.초) && 줄.초.length === 2 && 줄.초[0] <= 줄.초[1])) 문제.push(`${곳}: 초는 [시작, 끝]`);
    if (줄.상자 && !(줄.상자.폭 > 0 && 줄.상자.글자크기 > 0)) 문제.push(`${곳}: 상자에는 폭 · 글자크기가 있어야 한다`);
  }
  for (const q of data.퀴즈 || []) {
    if (!Array.isArray(q.보기) || q.보기.length < 2) 문제.push(`퀴즈 ${q.문제}: 보기는 줄 id 둘 이상`);
    for (const id of q.보기 || []) if (!ids.has(id)) 문제.push(`퀴즈 ${q.문제}: 보기 줄 ${id}가 없다`);
    if (!(Number.isInteger(q.정답) && q.정답 >= 1 && q.정답 <= (q.보기 || []).length)) 문제.push(`퀴즈 ${q.문제}: 정답은 1부터 센 보기 번호`);
    if (q.딱지 && !ids.has(q.딱지)) 문제.push(`퀴즈 ${q.문제}: 딱지 줄 ${q.딱지}가 없다`);
  }
  return 문제;
}

/** 판본 글 파일 → { 파일, 지문, 자료, 줄 } (꼴이 틀리면 던진다) */
function 읽기(file) {
  const 파일 = path.resolve(file);
  const 자료 = readJson(파일);
  const 문제 = 검증(자료);
  if (문제.length) throw new Error(`판본 글 꼴이 틀렸다(${파일}):\n  - ${문제.join('\n  - ')}`);
  const 줄 = 자료.줄.map((x, i) => ({ 순번: i + 1, 칸: x.칸 || '진행', ...x, 대조방식: 칸대조(x) }));
  return { 파일, 지문: sha256(파일), 자료, 줄 };
}

const 편폴더 = (dir) => path.resolve(dir);
const 준비경로 = (dir) => path.join(편폴더(dir), '게시', '준비.json');
const resolveIn = (dir, p) => (p ? (path.isAbsolute(p) ? p : path.join(dir, p)) : null);

/** 원본 편의 판본 하나 → { 준비, 판본, 영상, 글 } (경로는 절대 — 「파일」 · 「글」은 편 폴더 기준, tools/돌림표.js와 같다) */
function 판본찾기(dir, 키) {
  const 준비 = 준비경로(dir);
  if (!fs.existsSync(준비)) throw new Error(`준비.json이 없다: ${준비}`);
  const prep = readJson(준비);
  const v = prep.돌림?.판본?.[키];
  if (!v) throw new Error(`준비.json 「돌림」.판본에 「${키}」가 없다(있는 것: ${Object.keys(prep.돌림?.판본 || {}).join(' · ') || '없음'})`);
  return { 준비, prep, 판본: v, 영상: resolveIn(편폴더(dir), v.파일), 글: resolveIn(편폴더(dir), v.글) };
}

/** 준비.json 「돌림」.판본[키].검수[갈래] = 값. 다른 칸은 건드리지 않고, 쓰기 직전에 다시 읽어 바꾼다(그사이 다른 세션이 쓴 칸을 지우지 않게). */
function 검수쓰기(dir, 키, 갈래, 값) {
  const 준비 = 준비경로(dir);
  const fresh = readJson(준비);
  const v = fresh.돌림?.판본?.[키];
  if (!v) throw new Error(`준비.json 「돌림」.판본에 「${키}」가 없다 — 기록하지 않았다`);
  v.검수 = { ...(v.검수 || {}), [갈래]: 값 };
  writeJson(준비, fresh);
  return 준비;
}

/** 원본 기획.md 표에서 「한 문장」 · 「재미가 나는 초와 장면」 칸을 읽는다(뜻 검사 채점 기준이 판본 글에 없을 때). */
function 기획기준(dir) {
  const file = path.join(편폴더(dir), '기획.md');
  if (!fs.existsSync(file)) return { 한문장: null, 웃음: null, 파일: null };
  const text = fs.readFileSync(file, 'utf8');
  const 칸 = (이름) => {
    for (const line of text.split(/\r?\n/)) {
      const cells = line.split('|').map((c) => c.trim());
      if (cells.length >= 4 && cells[1].replace(/\*/g, '').trim() === 이름) return cells[2].replace(/\*\*/g, '').trim();
    }
    return null;
  };
  const 한문장 = 칸('한 문장');
  return { 한문장: 한문장 ? 한문장.replace(/\s*\((?:영어로|몽골어로)[^)]*\)\s*$/, '').trim() : null, 웃음: 칸('재미가 나는 초와 장면'), 파일: file };
}

module.exports = { 칸표, 한국어칸, 칸대조, 검증, 읽기, sha256, readJson, writeJson, 판본찾기, 검수쓰기, 기획기준, 준비경로 };
