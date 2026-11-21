// 꿈 무대 4급 시험판의 판정 · 코치 노트 고르기 · 놓친 곳 계산. 화면과 시험(Node)이 같은 파일을 쓴다.
// 판정은 규칙이다(생성하지 않는다). 받아 적은 글에서 그 줄의 문형 표지를 찾고, 표지 바로 앞 꼴만 본다 — 학생이 대본과 다른 낱말로 말해도
// 문형을 맞게 쓰면 통과다. 확신할 수 없으면(한국어가 아님 · 너무 짧음) 판정하지 않는다(hold). 1화 시범판의 「확신 없는 판정은 보류」와 같다.
// 다시 만나기는 1화 시범판과 같은 규칙이다(takes.mjs: 3일 · 학습일은 새벽 4시에 바뀜 · 장면과 다시 만나기의 첫 판정만 셈 · 테이크 2는 세지 않음).
// 짓기.cjs가 이 파일을 시험판 폴더로 옮길 때 아래 가져오기 주소를 './takes.mjs'로 바꾼다.
import { REVISIT_DAYS, revisitDue, daysSince, learningDate } from '../../pilot/takes.mjs';
import { 문형 } from './대본.mjs';

export { REVISIT_DAYS };

const 한글 = /[가-힣]/;
const 받침 = (ch) => { const c = (ch || '').charCodeAt(0) - 0xAC00; return c >= 0 && c < 11172 ? c % 28 : -1; };
const ㄴ = 4, ㅆ = 20;

// 화면에 보일 받아쓰기: 앞뒤 빈칸만 정리한다(문장부호는 둔다).
export const 다듬기 = (글) => String(글 || '').replace(/\s+/g, ' ').trim();
// 판정용 글자열: 한글 · 글자 · 숫자만 남기고, 원래 글의 몇 번째 글자였는지를 함께 돌려준다.
function 붙이기(글) {
  const 글자 = [], 자리 = [];
  for (let i = 0; i < 글.length; i++) if (/[\p{L}\p{N}]/u.test(글[i])) { 글자.push(글[i]); 자리.push(i); }
  return { 붙인: 글자.join(''), 자리 };
}
// 원래 글에서 [가, 나] 글자를 품는 어절들의 범위. 끝의 문장부호는 뺀다.
function 어절범위(글, 가, 나) {
  let s = 가; while (s > 0 && 글[s - 1] !== ' ') s--;
  let e = 나 + 1; while (e < 글.length && 글[e] !== ' ') e++;
  while (e > s && /[^\p{L}\p{N}]/u.test(글[e - 1])) e--;
  return [s, e];
}

// 한 줄의 판정. 돌려줌 { 결과: 'pass' | 'note' | 'hold' | 'free', 갈래?: 'form' | 'missing', 규칙?, 보일?, 바른?, 위치?: [시작, 끝](들림 글에서 틀린 곳), 문형? }
export function 판정(줄, 들림) {
  const spec = 줄.판정;
  if (!spec) return { 결과: 'free' };
  const 글 = 다듬기(들림);
  const { 붙인, 자리 } = 붙이기(글);
  if (!한글.test(붙인) || 붙인.length < 3) return { 결과: 'hold' };
  const m = spec.표지.exec(붙인);
  if (!m) return { 결과: 'note', 갈래: 'missing', 문형: 줄.문형 };
  const 앞 = 붙인.slice(0, m.index);
  if (!앞) return { 결과: 'pass', 문형: 줄.문형 };
  const 위치 = 어절범위(글, 자리[m.index - 1], 자리[m.index + m[0].length - 1]);
  for (const t of spec.틀린꼴 || []) {
    if (t.꼴.some((c) => 앞.endsWith(c))) return { 결과: 'note', 갈래: 'form', 규칙: t.규칙, 보일: t.보일, 바른: t.바른, 위치, 문형: 줄.문형 };
  }
  const p1 = 앞.slice(-1), p2 = 앞.slice(-2, -1);
  const 보일 = 글.slice(...위치);
  for (const g of spec.일반 || []) {
    const 틀림 = g === 'tense' ? (p1 === '는' && 받침(p2) === ㅆ) || (줄.문형 === 'S316' && 받침(p1) === ㅆ)
      : (g === 'adnominal' || g === 'soon') ? 받침(p1) === ㄴ && p1 !== '는' : false;
    if (틀림) return { 결과: 'note', 갈래: 'form', 규칙: g, 보일, 바른: null, 위치, 문형: 줄.문형 };
  }
  return { 결과: 'pass', 위치, 문형: 줄.문형 };
}

// 장면 뒤 코치 노트는 하나다(1화 시범판과 같다). 틀린 곳(form)이 빠진 문형(missing)보다 먼저, 그다음 장면의 핵심 줄, 높은 급, 앞 줄 차례.
// 후보: [{ 줄, 판정 }]. 돌려줌: 고른 후보 | null.
export function 노트고르기(후보) {
  const 급 = (c) => 문형[c.줄.문형]?.급 || 0;
  return [...후보].filter((c) => c.판정?.결과 === 'note')
    .sort((a, b) => (a.판정.갈래 === 'form' ? 0 : 1) - (b.판정.갈래 === 'form' ? 0 : 1)
      || (b.줄.핵심 ? 1 : 0) - (a.줄.핵심 ? 1 : 0) || 급(b) - 급(a) || a.줄.번 - b.줄.번)[0] || null;
}

// 놓친 곳(다시 만나기). 기록: [{ 줄, 판: 'scene' | 'take2' | 'review' | 'item', 보임, 결과, 갈래, 보일, 바른, 들림, 시각, 봄 }].
// 장면과 다시 만나기의 보임마다 첫 판정(pass · note)만 센다. 테이크 2와 읽기 문항은 줄에 보이기만 하고 날을 바꾸지 않는다.
//  · 첫 판정이 note면 놓친 곳이 열린다(그 시각이 기준).
//  · 기준에서 3일째 전의 통과는 「고침」 표시만 하고 날은 그대로다. 3일째 전의 note는 기준을 옮기지 않는다.
//  · 3일째부터의 첫 판정이 통과이고 대본을 보지 않았으면 닫힌다(혼자 해냄). 대본을 보고 통과했으면 고침 표시만. note면 그 시각으로 다시 3일.
// 돌려줌: 줄마다 { 줄, 열림, 처음(처음 놓친 기록), 기준(지금 열린 기록), 고침, 닫음(닫은 기록), 다시날(Date), 지난날, 때됨 }.
export function 놓친곳(기록, { 지금 = Date.now(), 날 = REVISIT_DAYS } = {}) {
  const 셀 = new Map();
  const 첫 = new Set();
  for (const r of [...기록].sort((a, b) => a.시각 - b.시각)) {
    if (r.판 !== 'scene' && r.판 !== 'review') continue;
    if (r.결과 !== 'note' && r.결과 !== 'pass') continue;
    const 열쇠 = `${r.줄}|${r.보임}`;
    if (첫.has(열쇠)) continue;
    첫.add(열쇠);
    if (!셀.has(r.줄)) 셀.set(r.줄, []);
    셀.get(r.줄).push(r);
  }
  const 줄들 = [];
  for (const [줄, list] of 셀) {
    let 기준 = null, 고침 = false, 처음 = null, 닫음 = null;
    for (const r of list) {
      if (!기준) { if (r.결과 === 'note') { 기준 = r; 처음 = 처음 || r; 고침 = false; 닫음 = null; } continue; }
      if (!revisitDue(기준.시각, r.시각, 날)) { 고침 = r.결과 === 'pass'; continue; }
      if (r.결과 === 'note') { 기준 = r; 고침 = false; }
      else if (r.봄) 고침 = true;
      else { 닫음 = r; 기준 = null; 고침 = false; }
    }
    if (!처음) continue;
    const 다시날 = 기준 ? (() => { const d = learningDate(기준.시각); d.setDate(d.getDate() + 날); return d; })() : null;
    줄들.push({ 줄, 열림: !!기준, 처음, 기준, 고침, 닫음, 다시날, 지난날: 기준 ? daysSince(기준.시각, 지금) : null, 때됨: !!기준 && revisitDue(기준.시각, 지금, 날) });
  }
  return 줄들;
}

// 학습일 날짜(새벽 4시 전은 전날). 화면의 「11월 ○일」과 날 수가 어긋나지 않게 같은 자를 쓴다.
export { learningDate, daysSince };
