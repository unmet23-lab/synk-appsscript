#!/usr/bin/env node
'use strict';
/**
 * 기록 닫기 — 결정 표와 트랙에서 닫힌 줄을 달별 보관으로 옮긴다(2026-11-11, 작업 방식 정리 2단계).
 *
 * 왜: 11-02에 판정으로 한 번 줄였는데(결정 표 833 → 504행) 여드레 뒤 958행 · 1.07MB로 돌아왔다(하루 순 +28~88행, 트랙은 하루 순 +4~40줄).
 *   사람이 읽고 판정해 옮기는 길은 쌓이는 속도를 못 따라간다. 판정 없이 날마다 할 수 있는 두 가지만 한다.
 *   ① 결정 표 — 성격이 `확정`이고 관찰 기간(tools/결정.js 관찰일 14일)이 지난 행. `안전` 행 · 성격을 못 읽은 행 · 깨진 줄은 남긴다.
 *      오래 지킬 규칙의 자리는 담당 원문(AGENTS · 운영 원칙 · 현장 노트 · 제작 규칙)이고 결정 표의 행은 그 근거다.
 *   ② 트랙 — 쓴 세션이 줄 끝에 「남은 일: 없음」이라고 적은 목록 줄(곁줄째). 닫힌 줄로 보는 조건은 좁다:
 *      그 줄에 「남은 …」 칸(남은 일 · 남은 것 · 남은 확인 · 남음 …)이 꼭 한 번, 그것이 「남은 일(것) 없음」 꼴이고,
 *      뒤에는 아무것도 없거나 「참고: · 근거: · 결과: …」 · 링크로 시작하는 곁들이는 글만 온다.
 *      괄호 · 「다만」 같은 조건이 붙거나, 곁줄에 열린 「남은 …」이 있거나, 낫표로 인용한 것이면 남긴다(애매하면 남긴다).
 *   지우는 것은 없다. 행 · 줄은 글자 그대로 docs/_ops/보관/<결정|트랙>_<달>.md 끝에 붙고 상대 링크만 그 폴더에 맞춘다.
 *
 *   node tools/기록닫기.js                      미리 보기 — 이 작업본의 결정 · 트랙에서 옮길 것
 *   node tools/기록닫기.js --실행               이 작업본의 파일을 고친다(올리지 않는다, 공용 작업본에서는 거절)
 *   node tools/기록닫기.js --올리기 [--실행]    origin 판에서 고쳐 올린다 — 잠깐 쓰는 작은 사본에서 tools/lib/git-publish-core.cjs 올리기로
 *                                               (공개 검사 · 저장 용량은 그 길 그대로). 계산한 판과 올리는 바탕이 같을 때만 올리고,
 *                                               그새 origin이 움직였으면 새 판에서 처음부터 다시 한다. 공간 지킴이가 하루 한 번 부른다.
 *   node tools/기록닫기.js --추이 [N]           날마다 남긴 한 줄(공용 작업본 output/크레딧작업/기록닫기/자동.jsonl)
 *   공통: --json · --일수 N(결정 표, 기본 14) · --오늘 YYYY-MM-DD(시험용) · --저장소 <폴더>
 *
 * 되돌리기: 옮긴 커밋을 git revert 하거나, 보관의 그 행 · 줄을 제자리에 다시 붙인다(보관 쪽 링크는 ../ 하나가 더 붙어 있다).
 * 시험: node --test tests/기록닫기.test.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const 결정도구 = require('./결정.js');
const { 공용작업본 } = require('./lib/공용작업본.js');

const 시작표식 = '<!-- 결정표 시작 · tools/결정.js 가 이 구간만 읽고 쓴다 -->';
const 끝표식 = '<!-- 결정표 끝 -->';
const 하루 = 86400000;
const 결정경로 = 'docs/_ops/결정.md';
const 트랙경로 = 'docs/_ops/트랙.md';
const 보관경로 = (무엇, 달) => `docs/_ops/보관/${무엇}_${달}.md`;
const 표머리 = ['| 날짜 | 성격 | 결정 | 근거 |', '|---|---|---|---|'];
const 다시한도 = 3;   // origin이 그새 움직였을 때 처음부터 다시 해 보는 횟수

/** 오늘(YYYY-MM-DD). 결정 표와 같은 기준 — 여기 사는 사람의 달력 날짜다(tools/결정.js 오늘값). */
function 오늘문자(기준) {
  if (기준) { if (결정도구.날짜값(기준) === null) throw new Error(`--오늘은 YYYY-MM-DD로 준다: ${기준}`); return 기준; }
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 줄 나누기 — 줄끝 \r은 줄에 붙여 둔다(안 건드린 줄은 바이트 그대로 남는다). */
const 줄들로 = (글) => String(글).split('\n');
const 맨줄 = (줄) => 줄.replace(/\r$/, '');
/** 그 글의 줄끝 — 줄의 절반 넘게 CRLF면 CRLF(한두 줄 섞인 것에 끌려가지 않는다). */
const 줄끝 = (글) => { const 다 = (글.match(/\n/g) || []).length, cr = (글.match(/\r\n/g) || []).length; return cr > 다 - cr ? '\r' : ''; };

/**
 * 옮긴 줄의 상대 링크를 보관 폴더(한 칸 아래)에 맞춘다. 백틱 안은 건드리지 않는다.
 *   http: · mailto: · C:\ · /뿌리 → 그대로 / #앵커 → ../<원본>#앵커 / 보관/X → X / ./X → ../X / 그 밖 → ../ + 그대로
 */
function 링크맞추기(줄, 원본이름) {
  return 줄.split('`').map((조각, i) => (i % 2 ? 조각 : 조각.replace(/\]\((<?)([^)\s>]*)/g, (전부, 꺾쇠, 곳) => {
    if (!곳) return 전부;
    if (/^([a-zA-Z][a-zA-Z0-9+.-]*:|\/|\\)/.test(곳)) return 전부;
    if (곳[0] === '#') return `](${꺾쇠}../${원본이름}${곳}`;
    if (곳.startsWith('보관/')) return `](${꺾쇠}${곳.slice('보관/'.length)}`;
    if (곳.startsWith('./')) return `](${꺾쇠}../${곳.slice(2)}`;
    return `](${꺾쇠}../${곳}`;
  }))).join('`');
}

/** 보관 글 끝에 덩어리를 붙인다. 없던 파일이면 머리부터 만든다. 줄끝은 그 파일 것을 따른다. */
function 보관에붙이기(보관글, 머리줄들, 덩어리) {
  const 있음 = 보관글 !== null && 보관글 !== undefined;
  const cr = 있음 ? 줄끝(보관글) : '';
  const 앞 = 있음 ? 줄들로(보관글) : 머리줄들.slice();
  while (앞.length && 맨줄(앞[앞.length - 1]) === '') 앞.pop();
  const 뒤 = ['', ...덩어리, ''];
  return [...앞, ...뒤.map((l, i) => (i === 뒤.length - 1 ? l : l + cr))].join('\n');
}

/** 보관 글에 이 줄들이 이 차례로 이어져 있는가(쓰다 끊긴 회차가 이미 붙여 둔 덩어리인지). */
function 이어져있나(보관줄, 붙일) {
  if (!붙일.length) return true;
  for (let i = 보관줄.indexOf(붙일[0]); i >= 0; i = 보관줄.indexOf(붙일[0], i + 1)) {
    if (붙일.every((l, k) => 보관줄[i + k] === l)) return true;
  }
  return false;
}

// ── 결정 표 ─────────────────────────────────────────────────────────────────

/**
 * 결정 표에서 관찰 기간이 지난 `확정` 행을 달별 보관으로 넘긴다(순수 함수 — 파일을 읽고 쓰지 않는다).
 * 보관읽기(달) → 그 달 보관 글 | null.
 * 돌려주는 것: { 문, 보관: Map<달, 글>, 옮김: [{달, 날짜, 머리}], 옮긴줄, 붙은: Map<달, 줄[]>, 못읽은: [머리], 셈 } 또는 { 멈춤 }.
 */
function 결정넘기기(문, 보관읽기, { 오늘, 일수 = 결정도구.관찰일 } = {}) {
  if (문 === null || 문 === undefined) return { 멈춤: '결정 표를 읽지 못했다' };
  const a = 문.indexOf(시작표식), b = 문.indexOf(끝표식);
  if (a < 0 || b < 0 || b < a) return { 멈춤: '결정 표의 시작 · 끝 표식을 찾지 못했다' };
  const 오늘값 = 결정도구.날짜값(오늘문자(오늘));
  const 앞 = 문.slice(0, a + 시작표식.length), 몸 = 문.slice(a + 시작표식.length, b), 뒤 = 문.slice(b);
  const 몸줄 = 줄들로(몸);
  const 남은 = [], 옮길 = [], 못읽은 = [];
  const 셈 = { 행: 0, 안전: 0, 최근: 0, 성격모름: 0, 깨짐: 0, 못읽음: 0, 옮김: 0 };
  for (let i = 0; i < 몸줄.length; i++) {
    const 줄 = 몸줄[i], 맨 = 맨줄(줄);
    const r = 줄.includes('|') ? 결정도구.줄읽기(맨) : null;
    if (!r) {
      // 날짜로 시작하는데 칸이 모자라 못 읽은 줄(결정과 근거 사이 | 가 빠진 행) — 남기고 드러낸다
      if (/^\s*\|\s*\d{4}-\d{1,2}-\d{1,2}\s*\|/.test(맨)) { 셈.못읽음++; 못읽은.push([...맨].slice(0, 70).join('')); }
      남은.push(줄); continue;
    }
    if (r.깨짐) { 셈.깨짐++; 남은.push(줄); continue; }
    셈.행++;
    const 지난일 = Math.floor((오늘값 - r.값) / 하루);
    if (r.성격원 === '안전') { 셈.안전++; 남은.push(줄); continue; }
    if (r.성격원 !== '확정') { 셈.성격모름++; 남은.push(줄); continue; }
    if (지난일 <= 일수) { 셈.최근++; 남은.push(줄); continue; }
    // 한 행이 줄바꿈으로 갈라져 있으면(끝이 | 가 아니거나 다음 줄이 표 줄이 아님) 앞 토막만 옮겨지므로 남긴다
    let 다음 = '';
    for (let j = i + 1; j < 몸줄.length; j++) if (맨줄(몸줄[j]).trim() !== '') { 다음 = 맨줄(몸줄[j]).trim(); break; }
    if (!맨.trimEnd().endsWith('|') || (다음 !== '' && !다음.startsWith('|'))) { 셈.깨짐++; 남은.push(줄); continue; }
    옮길.push({ 줄, 달: r.날짜.slice(0, 7), 날짜: r.날짜, 머리: [...r.결정].slice(0, 60).join('') });
  }
  셈.옮김 = 옮길.length;
  const 보관 = new Map(), 붙은 = new Map(), 붙인 = new Map();
  const 날 = 오늘문자(오늘);
  for (const 달 of [...new Set(옮길.map((x) => x.달))].sort()) {
    const 옛 = 보관읽기(달);
    const 있던 = new Set(옛 === null || 옛 === undefined ? [] : 줄들로(옛).map(맨줄));
    const 행들 = 옮길.filter((x) => x.달 === 달).map((x) => 링크맞추기(맨줄(x.줄), '결정.md'));
    붙은.set(달, 행들);
    // 같은 글자의 행이 이미 보관에 있으면 다시 붙이지 않는다(쓰다 끊긴 회차를 다시 돌려도 두 번 붙지 않게)
    const 새행 = 행들.filter((l) => !있던.has(l));
    붙인.set(달, 새행);
    if (!새행.length) continue;
    보관.set(달, 보관에붙이기(옛, [`# 지난 결정 · ${달}`, '', '> [현재 결정](../결정.md)에서 옮긴 행이다. 행은 글자 그대로이고 상대 링크만 이 폴더에 맞췄다.'],
      [`## ${날}에 옮김 · ${일수}일 지남`, '', ...표머리, ...새행]));
  }
  return { 문: 옮길.length ? 앞 + 남은.join('\n') + 뒤 : 문, 보관, 옮김: 옮길.map(({ 달, 날짜, 머리 }) => ({ 달, 날짜, 머리 })), 옮긴줄: 옮길.map((x) => x.줄), 붙은, 붙인, 못읽은, 셈 };
}

// ── 트랙 ────────────────────────────────────────────────────────────────────

/**
 * 낫표 · 둥근 따옴표로 인용한 글(「…」 · “…”)은 닫힘 표시로 읽지 않는다 — 이 규칙을 설명하는 줄이 스스로 닫히지 않게.
 * 글자 수를 그대로 둔 채 빈칸으로 덮는다(덮은 판의 자리 번호로 원문을 자를 수 있게). 곧은 따옴표는 덮지 않는다 — 27" 같은 인치 표시 둘 사이의 글이 가려진다.
 * 백틱은 빈칸으로만 바꾼다: 안내문이 표시를 `남은 일: 없음`으로 보여 주므로 그대로 따라 적은 줄도 닫힌 줄이다.
 */
const 인용덮기 = (글) => 글.replace(/「[^」\n]*」|“[^”\n]*”/g, (m) => ' '.repeat(m.length)).replace(/`/g, ' ');
/**
 * 「남은 일」 칸으로 보는 낱말 — 「남은」이 낱말로 서 있거나(남은 일 · 남은 것 · 남은 확인 · 남은 고를 것 · 남은 유호님 몫 …) 조사가 붙은 남은 일 · 남은 것,
 * 그리고 남음(뒤에 : ( — 없 이 오는 것 — 「파일이 남음.」은 아니다). 넓게 잡는다: 칸으로 세면 그 줄은 닫히지 않는 쪽으로만 간다.
 * 실제 트랙의 꼴: 남은 일: · 남은 일(유호님): · 남은 것 하나: · 남은 확인(10-21): · 남은 고를 것: · 남음(Claude): · 남은 일 — …
 */
const 낱말식 = /남은(?:(?![가-힣])|(?:일|것)(?:은|이|도|들|(?![가-힣])))|남음(?=\s*(?:[:：(（—–-]|없))/g;   // 붙여 쓴 「남은일:」 · 「남은것은」도 칸이다
/** 그 낱말 자리에서 시작하는 「없음」 꼴 — 남은 일: 없음 · 남은 것 없음 · 남음: 없음 · 남은 일은 없다 · 남은 일이 없습니다 */
const 닫힘꼴 = /^(?:남은\s*(?:일|것)|남음)\s*(?:[:：]|은|이|도)?\s*없(?:음|다|습니다)/;
/** 닫힘 표시 뒤에 와도 되는 것 — 「참고: · 근거: · 결과: …」(쌍점까지)나 링크로 시작하는 곁들이는 글. 그 밖의 글(괄호 · 조사 · 다른 문장)이 이어지면 닫힘이 아니다. */
const 뒤허용 = /^(?:(?:참고|근거|결과|경과|기록|원문|증거)\s*[:：]|\[[^\]\n]*\]\()/;
/** 곁들이는 글에도 있으면 안 되는 말 — 닫혔다고 적고 뒤에 조건을 다는 꼴 */
const 조건말 = /다만|하지만|그러나|단[, ]|대기|보류|미확인|확인 필요|남[은음]/;
const 낱말수 = (글) => [...인용덮기(글).matchAll(낱말식)].length;
const 낱말있음 = (글) => 낱말수(글) > 0;

/**
 * 한 목록 줄의 제 글(곁줄 빼고)을 읽는다 → { 닫힘, 열림, 까닭? }
 *   닫힘: 「남은 …」 칸이 꼭 하나, 「남은 일(것) · 남음 + 없음」 꼴이고, 그 뒤에 아무것도 없거나 허용된 곁들이는 글만 온다.
 *   열림: 칸이 있는데 닫힘이 아니다(열린 일이 적혀 있거나, 조건이 붙었거나, 칸이 여럿이다).
 */
function 닫힘읽기(글) {
  const 본 = 인용덮기(글);
  const 자리 = [...본.matchAll(낱말식)];
  if (!자리.length) return { 닫힘: false, 열림: false };
  const 꼴 = 자리.map((m) => 닫힘꼴.exec(본.slice(m.index)));
  if (꼴.every((m) => !m)) return { 닫힘: false, 열림: true };
  if (자리.length > 1) return { 닫힘: false, 열림: true, 까닭: '「남은 …」 칸이 여럿이다(닫힘 표시는 줄 끝에 하나만)' };
  // 뒤는 덮지 않은 원문에서 본다 — 인용한 글(「다만 …」)이 뒤에 붙어도 보이게
  const 뒤 = 글.slice(자리[0].index + 꼴[0][0].length).replace(/^[*_`'"’”)\]]+/, '').replace(/^[\s.。·—–\-,;:]+/, '');
  if (!(뒤 === '' || (뒤허용.test(뒤) && !조건말.test(뒤)))) return { 닫힘: false, 열림: true, 까닭: '닫힘 표시 뒤에 글이 이어진다(줄 끝에 적고, 뒤에는 「참고: …」 · 링크만)' };
  // 곧은 따옴표로 인용한 표시("남은 일: 없음")는 규칙을 설명하는 글이다
  if (/["']\s*$/.test(글.slice(0, 자리[0].index))) return { 닫힘: false, 열림: true, 까닭: '따옴표로 인용한 닫힘 표시는 닫힘으로 읽지 않는다' };
  return { 닫힘: true, 열림: false };
}

/** 코드 울타리를 여닫는 줄인가 — 같은 줄에서 닫히는 ```한 줄 코드```는 울타리가 아니다. */
const 울타리줄 = (l) => /^\s*(?:```+|~~~+)[^`]*$/.test(l);
/** 목록 줄인가(- · * · + · 1.). 번호는 두 자리까지, 뒤가 숫자로 이어지면(10. 20 처럼 이어 쓴 날짜 · 수) 목록이 아니다. */
const 목록줄 = (l) => /^\s*(?:[-*+]\s+\S|\d{1,2}[.)]\s+(?!\d)\S)/.test(l);

/**
 * 트랙 글 → 목록 줄(깊이 상관없이)의 덩어리들 [{ 시작, 끝(다음 줄 번호), 내끝(첫 곁줄 앞까지), 들여, 절, 부모(번호|null) }].
 * 코드 울타리 안은 읽지 않는다.
 */
function 트랙덩어리(줄) {
  const 맨 = 줄.map(맨줄);
  const 들여쓰기 = (l) => /^\s*/.exec(l)[0].length;
  const 덩이 = [];
  let 절 = '', 소절 = '', 울타리 = false;
  const 절이름 = [];
  for (let i = 0; i < 맨.length; i++) {
    const l = 맨[i];
    if (울타리줄(l)) 울타리 = !울타리;
    if (!울타리) {
      const h = /^(#{1,6})\s+(.*\S)\s*$/.exec(l);
      if (h) { if (h[1].length <= 2) { 절 = h[2]; 소절 = ''; } else 소절 = h[2]; }
    }
    절이름.push(소절 ? `${절} › ${소절}` : 절);
  }
  울타리 = false;
  for (let i = 0; i < 맨.length; i++) {
    const l = 맨[i];
    if (울타리줄(l)) { 울타리 = !울타리; continue; }
    if (울타리 || !목록줄(l)) continue;
    const 들여 = 들여쓰기(l);
    let 끝 = i + 1, 안울타리 = false;
    for (let j = i + 1; j < 맨.length; j++) {
      const t = 맨[j];
      if (t.trim() === '') continue;
      if (들여쓰기(t) <= 들여 && !안울타리) break;
      if (울타리줄(t)) 안울타리 = !안울타리;
      끝 = j + 1;
    }
    덩이.push({ 시작: i, 끝, 들여, 절: 절이름[i] });
  }
  for (let k = 0; k < 덩이.length; k++) {
    let 부모 = null;
    for (let p = k - 1; p >= 0; p--) if (덩이[p].들여 < 덩이[k].들여 && 덩이[p].끝 >= 덩이[k].끝) { 부모 = p; break; }
    덩이[k].부모 = 부모;
    const 첫자식 = 덩이[k + 1] && 덩이[k + 1].시작 < 덩이[k].끝 ? 덩이[k + 1].시작 : 덩이[k].끝;
    덩이[k].내끝 = 첫자식;
  }
  return 덩이;
}

const 줄머리 = (l) => { const b = /\*\*(.+?)\*\*/.exec(l); return [...(b ? b[1] : l.replace(/^\s*(?:[-*+]|\d+[.)])\s*/, '')).replace(/\]\([^)]*\)/g, '').replace(/[[\]`*]/g, '')].slice(0, 60).join('').trim(); };

/**
 * 트랙에서 줄 끝에 「남은 일: 없음」이라고 적힌 목록 줄을 곁줄째 그달 보관으로 옮긴다(순수 함수).
 * 돌려주는 것: { 문, 보관글, 옮김: [{절, 머리, 줄수, 곁줄}], 옮긴줄, 붙은줄, 남김: [{머리, 까닭}], 셈 }
 */
function 트랙닫기(문, 보관글, { 오늘 } = {}) {
  if (문 === null || 문 === undefined) return { 멈춤: '트랙을 읽지 못했다' };
  const 줄 = 줄들로(문), 맨 = 줄.map(맨줄);
  const 덩이 = 트랙덩어리(줄);
  const 남김 = [];
  let 칸없음 = 0;
  for (const d of 덩이) d.내 = 닫힘읽기(맨.slice(d.시작, d.내끝).join('\n'));
  for (const d of 덩이) {
    const 통째 = 맨.slice(d.시작, d.끝).join('\n');
    if (d.부모 === null && !d.내.닫힘 && !낱말있음(통째)) 칸없음++;
    d.닫힘 = false;
    const 머리 = 줄머리(맨[d.시작]);
    if (!d.내.닫힘) { if (d.내.까닭) 남김.push({ 머리, 까닭: d.내.까닭 }); continue; }
    // 곁줄 가운데 하나라도 열린 「남은 일」이 있으면 통째로 남긴다
    const 안 = 덩이.filter((x) => x.시작 >= d.시작 && x.끝 <= d.끝);
    if (안.some((x) => x !== d && x.내.열림)) { 남김.push({ 머리, 까닭: '곁줄에 열린 「남은 일」 칸이 있다' }); continue; }
    // 어느 목록 줄의 제 글에도 안 든 줄(곁줄들 뒤에 이어 쓴 문단)에 「남은 일」이 있어도 남긴다
    if (낱말수(통째) > 안.reduce((s, x) => s + 낱말수(맨.slice(x.시작, x.내끝).join('\n')), 0)) { 남김.push({ 머리, 까닭: '곁줄 아래 글에 「남은 일」이 있다' }); continue; }
    if (/<a\s+(id|name)=/i.test(통째)) { 남김.push({ 머리, 까닭: '앵커가 있어 손으로 옮긴다(다른 문서가 가리킬 수 있다)' }); continue; }
    d.닫힘 = true;
  }
  // 닫힌 부모 안의 닫힌 곁줄은 부모와 함께 간다
  const 고른 = 덩이.filter((d) => { if (!d.닫힘) return false; for (let p = d.부모; p !== null; p = 덩이[p].부모) if (덩이[p].닫힘) return false; return true; });
  const 셈 = { 목록줄: 덩이.filter((d) => d.부모 === null).length, 칸없음, 옮김: 고른.length };
  if (!고른.length) return { 문, 보관글: null, 옮김: [], 옮긴줄: [], 붙은줄: [], 남김, 셈 };

  const 뺄 = new Set();
  for (const d of 고른) for (let i = d.시작; i < d.끝; i++) 뺄.add(i);
  const 새 = [];
  for (let i = 0; i < 줄.length; i++) {
    if (뺄.has(i)) continue;
    // 덩어리를 뺀 자리의 앞뒤가 모두 빈 줄이면 하나만 남긴다
    if (맨[i].trim() === '' && i > 0 && 뺄.has(i - 1) && 새.length && 맨줄(새[새.length - 1]).trim() === '') continue;
    새.push(줄[i]);
  }
  let 새문 = 새.join('\n');
  // 끝 줄바꿈이 없던 CRLF 글에서 마지막 줄을 뺐으면 앞줄의 \r만 끝에 남는다 — 떼어 낸다
  if (!문.endsWith('\n') && 새문.endsWith('\r')) 새문 = 새문.slice(0, -1);
  const 날 = 오늘문자(오늘);
  const 보관줄 = 보관글 === null || 보관글 === undefined ? [] : 줄들로(보관글).map(맨줄);
  const 덩어리 = [], 붙은줄 = [], 붙인줄 = [];
  let 앞절 = null;
  const 옮김 = [];
  for (const d of 고른) {
    const 원 = 맨.slice(d.시작, d.끝);
    while (원.length && 원[원.length - 1].trim() === '') 원.pop();
    const 곁줄 = d.부모 !== null;
    // 곁줄은 부모 줄 머리를 한 줄 달고 그 아래로 들여 쓴다(부모 없이 떠 있으면 무엇의 곁줄인지 모른다)
    const 붙일 = (곁줄 ? [`- 「${줄머리(맨[덩이[d.부모].시작])}」의 곁줄`, ...원.map((l) => (l.trim() === '' ? '' : `  ${l.slice(Math.min(d.들여, /^\s*/.exec(l)[0].length))}`))] : 원)
      .map((l) => 링크맞추기(l, '트랙.md'));
    옮김.push({ 절: d.절, 머리: 줄머리(맨[d.시작]), 줄수: d.끝 - d.시작, 곁줄 });
    붙은줄.push(...붙일);
    // 덩어리가 통째로 이미 보관에 이어져 있을 때만 건너뛴다(보관은 붙였는데 트랙을 못 쓴 채 끊긴 회차). 첫 줄만 같으면 붙인다
    if (이어져있나(보관줄, 붙일)) continue;
    if (d.절 !== 앞절) { if (덩어리.length) 덩어리.push(''); 덩어리.push(`## ${d.절 || '트랙'}에서 (${날}, 닫힘 표시)`, ''); 앞절 = d.절; }
    덩어리.push(...붙일);
    붙인줄.push(...붙일);
  }
  const 새보관 = 덩어리.length
    ? 보관에붙이기(보관글, [`# 끝난 작업 · ${날.slice(0, 7)}`, '', '> [이어갈 작업](../트랙.md)에서 옮긴 완료 항목이다. 기존 본문과 증거는 보존하고 상대 링크를 이 폴더에 맞췄다.'], 덩어리)
    : null;
  return { 문: 새문, 보관글: 새보관, 옮김, 옮긴줄: [...뺄].sort((x, y) => x - y).map((i) => 줄[i]), 붙은줄, 붙인줄, 남김, 셈 };
}

// ── 검산 ────────────────────────────────────────────────────────────────────

const 자루 = (줄들) => { const m = new Map(); for (const l of 줄들) { const t = 맨줄(l); if (t.trim()) m.set(t, (m.get(t) || 0) + 1); } return m; };
const 빼기 = (x, y) => { const r = []; for (const [l, c] of x) for (let i = c - (y.get(l) || 0); i > 0; i--) r.push(l); return r; };
const 같은묶음 = (a, b) => a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n');

/**
 * 어긋나면 던진다(아무것도 쓰지 않게):
 *   원본에서 빠진 줄이 정확히 옮기기로 한 줄이다 · 원본에 없던 줄이 생기지 않았다 · 보관의 옛 내용이 그대로다 ·
 *   빠진 줄은 모두(링크를 맞춘 꼴로) 뒤 보관에 들어 있다 · 이번에 붙이기로 한 줄은 개수까지 그대로 이번에 붙인 꼬리에 들어 있다.
 * 보관쌍: [옛 보관 글 | null, 뒤 보관 글(새로 쓸 글, 안 바꾸면 옛 글), 그 보관에 있어야 할 줄들, 이번에 붙이기로 한 줄들]
 */
function 검산(이름, 옛문, 새문, 옮긴줄, 보관쌍) {
  const 옛 = 자루(줄들로(옛문)), 새 = 자루(줄들로(새문));
  if (!같은묶음(빼기(옛, 새), 옮긴줄.map(맨줄).filter((l) => l.trim()))) throw new Error(`${이름}: 빠진 줄이 옮기기로 한 줄과 다르다`);
  if (빼기(새, 옛).length) throw new Error(`${이름}: 원본에 없던 줄이 생겼다`);
  for (const [옛보관, 뒤보관, 있어야할 = [], 붙인 = []] of 보관쌍) {
    const 뒤글 = 뒤보관 === null || 뒤보관 === undefined ? '' : String(뒤보관);
    let 옛길이 = 0;
    if (옛보관 !== null && 옛보관 !== undefined) {
      const 옛줄 = 줄들로(옛보관);
      while (옛줄.length && 맨줄(옛줄[옛줄.length - 1]) === '') 옛줄.pop();
      if (!뒤글.startsWith(옛줄.join('\n'))) throw new Error(`${이름}: 보관의 옛 내용이 바뀌었다`);
      옛길이 = 옛줄.join('\n').length;
    }
    // 있어야 할 줄은 있음으로 본다 — 같은 글자의 줄이 둘인데 보관에 이미 하나 있어 다시 붙이지 않은 날도 통과해야 한다
    const 든 = 자루(줄들로(뒤글));
    const 빠짐 = [...자루(있어야할).keys()].filter((l) => !든.has(l));
    if (빠짐.length) throw new Error(`${이름}: 옮긴 줄 ${빠짐.length}개가 보관에 없다 — 「${[...빠짐[0]].slice(0, 40).join('')}」`);
    // 이번에 붙이기로 한 줄은 개수까지 본다 — 같은 글자의 줄이 보관의 다른 자리에 있다는 것만으로 통과하지 않게
    const 안붙음 = 빼기(자루(붙인), 자루(줄들로(뒤글.slice(옛길이))));
    if (안붙음.length) throw new Error(`${이름}: 붙이기로 한 줄 ${안붙음.length}개가 이번에 붙인 자리에 없다 — 「${[...안붙음[0]].slice(0, 40).join('')}」`);
  }
}

// ── 한 작업본에서 ────────────────────────────────────────────────────────────

const 읽기 = (파일) => { try { return fs.readFileSync(파일, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };
/** 크기(KB) — 줄끝 \r은 빼고 잰다(작업본은 CRLF, origin 판은 LF라 같은 글이 다르게 재이지 않게). */
const KB = (글) => (글 === null || 글 === undefined ? 0 : Math.round(Buffer.byteLength(글.replace(/\r\n/g, '\n')) / 102.4) / 10);

/**
 * 결정 · 트랙을 읽어 옮길 것을 정한다(쓰지 않는다). 읽는(상대 경로) → 글 | null.
 * 돌려주는 것: { 오늘, 결정, 트랙, 쓸: Map<상대 경로, 새 글>, 바뀐경로[], 재기 }
 */
function 닫기계산(읽는, { 오늘, 일수 } = {}) {
  const 결정문 = 읽는(결정경로), 트랙문 = 읽는(트랙경로);
  const 날 = 오늘문자(오늘);
  const 쓸 = new Map();
  const 결정 = 결정넘기기(결정문, (달) => 읽는(보관경로('결정', 달)), { 오늘: 날, 일수 });
  if (!결정.멈춤 && 결정.옮김.length) {
    검산('결정 표', 결정문, 결정.문, 결정.옮긴줄, [...결정.붙은].map(([달, 줄들]) => {
      const 옛 = 읽는(보관경로('결정', 달));
      return [옛, 결정.보관.has(달) ? 결정.보관.get(달) : 옛, 줄들, 결정.붙인.get(달) || []];
    }));
    const 다시 = 결정도구.읽기문(결정.문, 날), 앞 = 결정도구.읽기문(결정문, 날);
    if (다시.깨짐.length !== 앞.깨짐.length || 다시.목록.length !== 앞.목록.length - 결정.옮김.length) throw new Error('결정 표: 옮긴 뒤 다시 읽은 행 수가 맞지 않는다');
    쓸.set(결정경로, 결정.문);
    for (const [달, 글] of 결정.보관) 쓸.set(보관경로('결정', 달), 글);
  }
  const 트랙보관 = 보관경로('트랙', 날.slice(0, 7));
  const 옛트랙보관 = 읽는(트랙보관);
  const 트랙 = 트랙닫기(트랙문, 옛트랙보관, { 오늘: 날 });
  if (!트랙.멈춤 && 트랙.옮김.length) {
    검산('트랙', 트랙문, 트랙.문, 트랙.옮긴줄, [[옛트랙보관, 트랙.보관글 === null ? 옛트랙보관 : 트랙.보관글, 트랙.붙은줄, 트랙.붙인줄]]);
    쓸.set(트랙경로, 트랙.문);
    if (트랙.보관글 !== null) 쓸.set(트랙보관, 트랙.보관글);
  }
  const 뒤결정 = 결정.멈춤 ? 결정문 : 결정.문, 뒤트랙 = 트랙.멈춤 ? 트랙문 : 트랙.문;
  const 재기 = {
    결정: 결정.멈춤 ? null : { 행: 결정.셈.행 - 결정.셈.옮김, KB: KB(뒤결정), 안전: 결정.셈.안전, 못읽음: 결정.셈.못읽음 + 결정.셈.깨짐, 옮김: 결정.셈.옮김 },
    트랙: 트랙.멈춤 ? null : { 목록줄: 트랙.셈.목록줄 - 트랙.옮김.filter((x) => !x.곁줄).length, KB: KB(뒤트랙), 칸없음: 트랙.셈.칸없음, 옮김: 트랙.옮김.length, 남김: 트랙.남김.length },
  };
  return { 오늘: 날, 결정, 트랙, 쓸, 바뀐경로: [...쓸.keys()], 재기 };
}

/** 한 작업본(뿌리)의 파일로 닫기계산을 하고, 실행이면 그 작업본의 파일을 고친다(올리지 않는다). */
function 닫기(뿌리, { 오늘, 일수, 실행 = false } = {}) {
  const 자리 = (p) => path.join(뿌리, ...p.split('/'));
  const r = 닫기계산((p) => 읽기(자리(p)), { 오늘, 일수 });
  if (실행) {
    // 보관을 먼저 쓴다 — 중간에 끊겨도 원본에 줄이 남아 있고, 다시 돌리면 이미 붙은 덩어리는 건너뛴다
    const 순서 = [...r.쓸.keys()].sort((x, y) => Number(y.includes('/보관/')) - Number(x.includes('/보관/')));
    for (const p of 순서) { fs.mkdirSync(path.dirname(자리(p)), { recursive: true }); fs.writeFileSync(자리(p), r.쓸.get(p)); }
  }
  return r;
}

// ── origin 판에서 고쳐 올리기 ────────────────────────────────────────────────

function git부르기(폴더, 인자, { 허용 = [0], 입력 } = {}) {
  const r = spawnSync('git', ['-c', 'core.quotepath=false', ...인자], { cwd: 폴더, encoding: 'utf8', windowsHide: true, input: 입력, maxBuffer: 1 << 28, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
  if (r.error) throw r.error;
  if (허용 && !허용.includes(r.status)) throw new Error(`git ${인자.join(' ')} 실패(${r.status}): ${String(r.stderr || '').trim().slice(0, 400)}`);
  return r;
}

/** 한 번에 하나만. 주인이 죽었거나 2시간이 지난 잠금은 넘겨받는다. 잡으면 푸는 함수, 못 잡으면 null. */
function 잠그기(폴더) {
  fs.mkdirSync(폴더, { recursive: true });
  const 잠금 = path.join(폴더, '자동.lock');
  const 표 = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  for (let 번 = 0; 번 < 2; 번++) {
    try {
      fs.writeFileSync(잠금, JSON.stringify({ pid: process.pid, at: new Date().toISOString(), 표 }), { flag: 'wx' });
      return () => { try { if (JSON.parse(fs.readFileSync(잠금, 'utf8')).표 === 표) fs.unlinkSync(잠금); } catch { /* 이미 없거나 남의 것 */ } };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let 주인 = null, 고친때 = 0, 살았나 = false;
      try { 주인 = JSON.parse(fs.readFileSync(잠금, 'utf8')); } catch { /* 쓰는 중이거나 깨진 잠금 */ }
      try { if (주인 && Number.isInteger(주인.pid)) { process.kill(주인.pid, 0); 살았나 = true; } } catch (err) { 살았나 = err.code === 'EPERM'; }
      try { 고친때 = fs.statSync(잠금).mtimeMs; } catch { continue; }
      const 오래됨 = Date.now() - 고친때 > 2 * 60 * 60 * 1000;
      if (!오래됨 && (살았나 || !주인)) return null;
      try { fs.unlinkSync(잠금); } catch { return null; }
    }
  }
  return null;
}

/** 잠깐 쓰는 사본을 둘 자리. %TEMP% 밖에 둔다(임시 폴더 청소가 도는 중인 사본을 건드리지 않게). */
const 사본자리 = () => path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'synk', '기록닫기');
const 사본무늬 = ['/docs/_ops/결정.md', '/docs/_ops/트랙.md', '/docs/_ops/보관/결정_*.md', '/docs/_ops/보관/트랙_*.md'];

/** 앞 회차가 끊겨 남긴 사본을 치운다 — 우리 자리 아래에 등록된 사본만, git worktree remove로. prune은 부르지 않는다(D:가 잠깐 안 보일 때 남의 사본 등록이 지워진다). */
function 남은사본치우기(뿌리, 자리) {
  const 목록 = git부르기(뿌리, ['worktree', 'list', '--porcelain'], { 허용: null }).stdout || '';
  const 밑 = path.resolve(자리).toLowerCase() + path.sep;
  for (const l of 목록.split(/\r?\n/)) {
    if (!l.startsWith('worktree ')) continue;
    const p = path.resolve(l.slice(9));
    if (p.toLowerCase().startsWith(밑) && fs.existsSync(p)) git부르기(뿌리, ['worktree', 'remove', '--force', p], { 허용: null });
  }
}

class 움직임 extends Error {}
const 옮긴모습 = (r) => JSON.stringify([r.결정.멈춤 ? null : r.결정.옮긴줄.map(맨줄), r.트랙.멈춤 ? null : r.트랙.옮긴줄.map(맨줄)]);

/**
 * origin/master 판을 작은 사본에 꺼내 닫기를 하고, 바뀐 것이 있으면 올린다. 사본은 끝나면 치운다.
 * 계산한 판(머리)과 올리는 바탕이 같을 때만 올린다 — 올리기 핵심은 그새 origin이 움직이면 내 변경을 새 판 위에 다시 쌓는데,
 * 그러면 어제 판의 판정(이 줄은 닫혔다)이 방금 곁줄이 달린 줄에 얹힌다. 그래서 push 직전에 바탕을 다시 보고, 달라졌으면 새 판에서 처음부터 한다.
 * 옵션.올리기함수는 시험용이다(기본은 tools/lib/git-publish-core.cjs 올리기).
 */
async function 올려닫기(옵션 = {}) {
  const 뿌리 = 공용작업본(옵션.저장소 || path.resolve(__dirname, '..'));
  const 장부폴더 = 옵션.장부폴더 || path.join(뿌리, 'output', '크레딧작업', '기록닫기');
  const 풀기 = 옵션.실행 ? 잠그기(장부폴더) : () => {};
  if (!풀기) return { 멈춤: '다른 회차가 돌고 있다' };
  const 자리 = 옵션.사본자리 || 사본자리();
  const 오늘 = 오늘문자(옵션.오늘);   // 한 번만 정한다 — 계산과 올리기 사이에 자정이 끼어도 같은 날로 센다
  const 지금머리 = () => git부르기(뿌리, ['rev-parse', '--verify', 'refs/remotes/origin/master^{commit}']).stdout.trim();
  const 판읽기 = (판) => (p) => { const s = git부르기(뿌리, ['show', `${판}:${p}`], { 허용: null }); return s.status === 0 ? s.stdout : null; };
  try {
    let 결과 = null, 앞답 = null;   // 앞답: 버린 앞 시도에서 올리기가 준 답(움직임 때문에 버렸어도 까닭은 남긴다)
    for (let 번 = 1; 번 <= 다시한도; 번++) {
      const 받음 = git부르기(뿌리, ['fetch', '-q', 'origin', '+refs/heads/master:refs/remotes/origin/master'], { 허용: null });
      if (받음.status !== 0) { 결과 = { 멈춤: `fetch 실패 — ${String(받음.stderr).trim().slice(0, 200)}` }; break; }
      const 머리 = 지금머리();
      // 먼저 origin 판의 글만 읽어 계산한다 — 옮길 것이 없거나 미리 보기면 사본을 만들지 않는다
      const 미리 = 닫기계산(판읽기(머리), { 오늘, 일수: 옵션.일수 });
      결과 = { 오늘: 미리.오늘, 바탕: 머리.slice(0, 9), 결정: 미리.결정, 트랙: 미리.트랙, 바뀐경로: 미리.바뀐경로, 재기: 미리.재기, 올림: null,
        ...(번 > 1 ? { 다시한수: 번 - 1 } : {}), ...(앞답 ? { 앞시도: 앞답 } : {}) };
      if (미리.결정.멈춤 || 미리.트랙.멈춤) 결과.멈춤 = [미리.결정.멈춤, 미리.트랙.멈춤].filter(Boolean).join(' · ');
      if (!옵션.실행 || !미리.바뀐경로.length) break;

      const 사본 = path.join(자리, `wt-${Date.now()}-${process.pid}`);
      let 만듦 = false, 올린 = null, 움직였다 = false;
      try {
        fs.mkdirSync(자리, { recursive: true });
        남은사본치우기(뿌리, 자리);
        git부르기(뿌리, ['worktree', 'add', '--detach', '--no-checkout', 사본, 머리]);
        만듦 = true;
        git부르기(사본, ['sparse-checkout', 'set', '--no-cone', '--stdin'], { 입력: `${사본무늬.join('\n')}\n` });
        git부르기(사본, ['checkout', '--detach', '-q', 머리]);
        const r = 닫기(사본, { 오늘, 일수: 옵션.일수, 실행: true });
        if (옮긴모습(r) !== 옮긴모습(미리)) throw new Error('사본에서 다시 계산한 옮길 줄이 origin 판에서 계산한 것과 다르다');
        const 올리기 = 옵션.올리기함수 || require('./lib/git-publish-core.cjs').올리기;
        const 메시지 = `chore(기록 닫기): 결정 표 ${r.결정.멈춤 ? 0 : r.결정.옮김.length}행 · 트랙 ${r.트랙.멈춤 ? 0 : r.트랙.옮김.length}줄을 달별 보관으로\n\n`
          + `관찰 기간(${옵션.일수 || 결정도구.관찰일}일)이 지난 확정 행과 「남은 일: 없음」으로 닫힌 줄을 글자 그대로 옮겼다(tools/기록닫기.js, 하루 한 번).`;
        try {
          올린 = await 올리기({
            저장소: 사본, 경로들: r.바뀐경로, 메시지, 실행: true, 공용안따라감: true,
            // push 직전: 올리기 핵심이 방금 받은 origin이 내가 계산한 판이 아니면(다시 쌓았다는 뜻) 올리지 않는다
            시험고리: { push직전: () => { if (지금머리() !== 머리) throw new 움직임('origin이 그새 움직였다'); } },
          });
        } catch (e) {
          if (e instanceof 움직임) 움직였다 = true;
          else 올린 = { 결과: '실패', 이유: e.이유 || e.message };
        }
        // 고리까지 못 가고 멈춘 것도(그새 올라온 변경과 겹쳐 얹지 못함) origin이 움직여서면 새 판에서 다시 한다
        if (올린 && 올린.결과 !== '올림' && 지금머리() !== 머리) 움직였다 = true;
      } finally {
        if (만듦) git부르기(뿌리, ['worktree', 'remove', '--force', 사본], { 허용: null });
      }
      if (움직였다) {
        if (올린) 앞답 = { 결과: 올린.결과, 이유: 올린.이유 || null, 커밋: 올린.머리 ? String(올린.머리).slice(0, 9) : null };
        결과.멈춤 = `origin이 계속 움직여 ${다시한도}번 모두 올리지 못했다${앞답 ? ` — 마지막으로 올리기가 준 답: ${앞답.결과}${앞답.이유 ? `(${앞답.이유})` : ''}` : '(아무것도 바뀌지 않음)'}`;
        if (앞답) 결과.앞시도 = 앞답;
        continue;
      }
      결과.올림 = { 결과: 올린.결과, 이유: 올린.이유 || null, 커밋: 올린.머리 ? String(올린.머리).slice(0, 9) : null };
      if (올린.결과 !== '올림') { 결과.멈춤 = `올리지 못했다 — ${올린.결과}${올린.이유 ? `: ${올린.이유}` : ''}`; break; }
      delete 결과.멈춤;
      if (미리.결정.멈춤 || 미리.트랙.멈춤) 결과.멈춤 = [미리.결정.멈춤, 미리.트랙.멈춤].filter(Boolean).join(' · ');
      // 올라간 커밋의 부모가 계산한 판이 아니면(고리가 안 불렸다는 뜻) 그 부모 판에서 다시 계산해 같은 줄이었는지 본다
      if (올린.머리) {
        const 부모 = git부르기(뿌리, ['rev-parse', '--verify', `${올린.머리}^`], { 허용: null });
        const 부모판 = 부모.status === 0 ? 부모.stdout.trim() : null;
        if (부모판 && 부모판 !== 머리) {
          let 같음 = false;
          try { 같음 = 옮긴모습(닫기계산(판읽기(부모판), { 오늘, 일수: 옵션.일수 })) === 옮긴모습(미리); } catch { 같음 = false; }
          if (!같음) 결과.멈춤 = `올린 커밋 ${String(올린.머리).slice(0, 9)}이 계산한 판(${머리.slice(0, 9)})이 아닌 ${부모판.slice(0, 9)} 위에 쌓였고 그 판에서는 옮길 줄이 다르다 — 그 커밋을 확인한다(되돌리기는 git revert)`;
        }
      }
      break;
    }
    if (옵션.실행 && 결과 && 결과.결정) 장부적기(장부폴더, 결과);
    return 결과;
  } finally {
    풀기();
  }
}

// ── 장부 ────────────────────────────────────────────────────────────────────

function 장부적기(폴더, 결과) {
  try {
    fs.mkdirSync(폴더, { recursive: true });
    fs.appendFileSync(path.join(폴더, '자동.jsonl'), `${JSON.stringify({ 때: new Date().toISOString(), 오늘: 결과.오늘, ...결과.재기, 올림: 결과.올림, 멈춤: 결과.멈춤 || null, ...(결과.앞시도 ? { 앞시도: 결과.앞시도 } : {}) })}\n`);
  } catch { /* 장부를 못 적어도 옮긴 것은 그대로다 */ }
}

function 추이(폴더, 수 = 14) {
  let 줄 = [];
  try { 줄 = fs.readFileSync(path.join(폴더, '자동.jsonl'), 'utf8').split('\n').filter(Boolean); } catch { return []; }
  return 줄.slice(-수).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

function 추이글(행들) {
  if (!행들.length) return '아직 남긴 줄이 없다.';
  const 줄 = ['날짜        결정 표(행 · KB · 옮김)        트랙(맨 윗줄 · KB · 옮김 · 「남은 일」 칸 없는 줄)   올림'];
  for (const r of 행들) {
    const d = r.결정 || {}, t = r.트랙 || {};
    줄.push(`${r.오늘 || String(r.때).slice(0, 10)}  ${String(d.행 ?? '-').padStart(5)} · ${String(d.KB ?? '-').padStart(7)} · ${String(d.옮김 ?? '-').padStart(4)}        `
      + `${String(t.목록줄 ?? '-').padStart(5)} · ${String(t.KB ?? '-').padStart(6)} · ${String(t.옮김 ?? '-').padStart(3)} · ${String(t.칸없음 ?? '-').padStart(4)}   ${r.멈춤 ? `멈춤: ${r.멈춤}` : r.올림 ? `${r.올림.결과}${r.올림.커밋 ? ` ${r.올림.커밋}` : ''}` : '옮길 것 없음'}`);
  }
  return 줄.join('\n');
}

// ── 화면 ────────────────────────────────────────────────────────────────────

function 글로(r, { 실행 = false, 올리기 = false } = {}) {
  const 줄 = [];
  if (r.멈춤 && !r.결정) return `[멈춤] ${r.멈춤}`;
  const 한일 = 실행 ? (올리기 ? (r.올림 && r.올림.결과 === '올림' ? `[올림] ${r.올림.커밋 || ''}` : r.바뀐경로.length ? '[멈춤]' : '[옮길 것 없음]') : '[고침 — 올리지 않음]') : '[미리 보기]';
  줄.push(`${한일} 기록 닫기 · ${r.오늘}${r.바탕 ? ` · origin ${r.바탕}` : ''}${r.다시한수 ? ` · origin이 움직여 ${r.다시한수}번 다시` : ''}`);
  if (r.결정.멈춤) 줄.push(`  결정 표: ${r.결정.멈춤}`);
  else {
    const s = r.결정.셈;
    줄.push(`  결정 표: ${s.행}행 가운데 ${s.옮김}행을 보관으로 — 남는 것 ${s.행 - s.옮김}행(안전 ${s.안전} · 관찰 기간 안 ${s.최근}${s.성격모름 ? ` · 성격 모름 ${s.성격모름}` : ''}${s.깨짐 ? ` · 깨진 줄 ${s.깨짐}` : ''})`);
    const 달 = {};
    for (const x of r.결정.옮김) 달[x.달] = (달[x.달] || 0) + 1;
    if (s.옮김) 줄.push(`    ${Object.entries(달).sort().map(([k, v]) => `${k} ${v}행`).join(' · ')}`);
    if (s.못읽음) { 줄.push(`    칸이 모자라 못 읽은 행 ${s.못읽음}개(결정과 근거 사이 | 가 빠졌다 — 넣으면 읽힌다):`); for (const m of r.결정.못읽은.slice(0, 10)) 줄.push(`      ${m}…`); }
  }
  if (r.트랙.멈춤) 줄.push(`  트랙: ${r.트랙.멈춤}`);
  else {
    줄.push(`  트랙: 맨 윗줄 ${r.트랙.셈.목록줄}개 가운데 닫힘 표시 ${r.트랙.옮김.length}줄을 보관으로 · 「남은 일」 칸이 없는 줄 ${r.트랙.셈.칸없음}개`);
    for (const x of r.트랙.옮김.slice(0, 20)) 줄.push(`    옮김${x.곁줄 ? '(곁줄)' : ''}: ${x.머리} — ${x.절}`);
    for (const x of r.트랙.남김.slice(0, 20)) 줄.push(`    남김: ${x.머리} — ${x.까닭}`);
  }
  if (r.재기 && r.재기.결정 && r.재기.트랙) 줄.push(`  뒤 크기: 결정 표 ${r.재기.결정.KB}KB · 트랙 ${r.재기.트랙.KB}KB`);
  if (r.앞시도) 줄.push(`  버린 앞 시도의 올리기 답: ${r.앞시도.결과}${r.앞시도.이유 ? ` — ${r.앞시도.이유}` : ''}${r.앞시도.커밋 ? ` (${r.앞시도.커밋})` : ''}`);
  if (r.멈춤) 줄.push(`  멈춤: ${r.멈춤}`);
  if (!실행 && r.바뀐경로.length) 줄.push(`  실제로 하려면 ${올리기 ? '--올리기 --실행' : '--실행'}`);
  return 줄.join('\n');
}

const 쓰는법 = '쓰는 법: node tools/기록닫기.js [--실행] [--올리기] [--일수 N] [--오늘 YYYY-MM-DD] [--저장소 <폴더>] [--json] | --추이 [N]';

function 인자읽기(argv) {
  const o = { 실행: false, 올리기: false, json: false, 추이: null, 일수: undefined, 오늘: undefined, 저장소: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const 값 = () => { if (i + 1 >= argv.length) throw new Error(`${a} 뒤에 값이 없다\n${쓰는법}`); return argv[++i]; };
    if (a === '--실행') o.실행 = true;
    else if (a === '--올리기') o.올리기 = true;
    else if (a === '--json') o.json = true;
    else if (a === '--추이') { o.추이 = argv[i + 1] && /^\d+$/.test(argv[i + 1]) ? Number(argv[++i]) : 14; }
    else if (a === '--일수') { o.일수 = Number(값()); if (!Number.isInteger(o.일수) || o.일수 < 1) throw new Error('--일수는 1 이상의 정수다'); }
    else if (a === '--오늘') o.오늘 = 오늘문자(값());
    else if (a === '--저장소') o.저장소 = path.resolve(값());
    else throw new Error(`모르는 선택지: ${a}\n${쓰는법}`);
  }
  return o;
}

async function 실행(argv) {
  const o = 인자읽기(argv);
  const 여기 = o.저장소 || path.resolve(__dirname, '..');
  if (o.추이 !== null) {
    const 행 = 추이(path.join(공용작업본(여기), 'output', '크레딧작업', '기록닫기'), o.추이);
    return { 코드: 0, 글: o.json ? JSON.stringify(행) : 추이글(행) };
  }
  let r;
  if (o.올리기) r = await 올려닫기(o);
  else {
    // 공용 작업본에는 다른 세션이 쓰는 중인 결정 · 트랙이 있다 — 거기서는 파일을 고치지 않는다
    if (o.실행 && path.resolve(공용작업본(여기)) === path.resolve(여기)) return { 코드: 1, 글: '[멈춤] 공용 작업본에서는 파일을 고치지 않는다 — --올리기 --실행을 쓴다(origin 판에서 고쳐 올린다)' };
    r = 닫기(여기, o);
  }
  const 간추림 = r.결정 ? { ...r, 쓸: undefined, 결정: { ...r.결정, 문: undefined, 보관: undefined, 옮긴줄: undefined, 붙은: undefined, 붙인: undefined }, 트랙: { ...r.트랙, 문: undefined, 보관글: undefined, 옮긴줄: undefined, 붙은줄: undefined, 붙인줄: undefined } } : r;
  return { 코드: r.멈춤 ? 1 : 0, 글: o.json ? JSON.stringify(간추림) : 글로(r, o) };
}

if (require.main === module) {
  실행(process.argv.slice(2)).then((r) => { process.stdout.write(`${r.글}\n`); process.exitCode = r.코드; })
    .catch((e) => { process.stderr.write(`${e.message}\n`); process.exitCode = 1; });
}

module.exports = { 결정넘기기, 트랙닫기, 닫힘읽기, 트랙덩어리, 링크맞추기, 보관에붙이기, 이어져있나, 검산, 닫기계산, 닫기, 올려닫기, 추이, 추이글, 글로, 인자읽기, 실행, 잠그기, 쓰는법, 시작표식, 끝표식, 다시한도 };
