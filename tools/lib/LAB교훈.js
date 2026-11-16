'use strict';
/**
 * LAB 교훈 표 — 이해 시험 기록의 「다음」 칸과 판본 회차 기록의 「다음 원본에서 바꿀 것」을 교훈 표 하나에 모은다. 읽기만 한다. AI 없이 돈다.
 *
 * 왜: 유호님 11-17 「검수받고 계속 고치는 과정에서 검수에서 지적된것들이 다음번에는 실수 안하게 반영 되고있어? 점점 발전하고 빨라져야하는데」.
 * 11-17 새벽에 재 보니 LAB은 지적을 두 기록에 적기만 하고, 다음 편을 만드는 07 · 15시 회차와 판본 회차는 그 칸을 읽지 않았다.
 * 「짧은 칸이 많은 편은 첫 시험부터 --컷」은 11-01부터 여섯 번, 「말풍선 뜻 줄은 한 줄 폭 안에서」는 11-14 · 11-15 두 번 다시 적혔다.
 * 11-15 흠 장부는 최종 확인과 기계 검사만 세서 LAB 칸이 「자료 없음」이었다.
 *
 * 표: docs/마케팅/제작양식/LAB_교훈.json
 *   교훈[]  { id, 단계: ['원본' | '판본' | '시험'], 할것, 근거: [원천 열쇠…], 올린날, 올린곳: '읽힘' | '기본값' | '검사', 자리? }
 *           근거는 그 교훈이 적힌 기록 줄이다. 올린날 뒤에 적힌 근거는 「올린 뒤 다시 나옴」으로 센다 — 읽힘으로 올린 교훈이 다시 나오면
 *           읽히기로는 안 막힌다는 뜻이라, 기본값이나 기계 검사로 올릴 차례다(흠 장부 「올릴 차례」와 같은 뜻).
 *   뺌[]    { 근거, 까닭 } 교훈이 없는 줄(닫힘 · 상태만 적은 칸 · 다른 장부가 받는 흠).
 *   지문{}  { 열쇠: 그 기록 글의 sha256 앞 10자 } — 받은 뒤 그 줄의 글이 고쳐졌는지 본다(node tools/LAB교훈.js --지문이 적는다).
 * 원천 열쇠:
 *   이해:<YYYY-MM-DD>:<줄>:<편 코드>   이해시험_기록.md 「떨어진 편」 표의 LAB 줄(줄은 「LAB 」을 뗀 브랜드 칸). 기록은 MM-DD만 적어서,
 *           맨 아래(가장 옛 줄, 2026년 10월)부터 위로 읽으며 11 · 12월 다음에 1 · 2월이 오면 해를 하나 올린다. 같은 열쇠가 또 나오면
 *           아래(옛 줄)부터 세어 위의 새 줄에 「#2」를 붙인다 — 새 줄은 표 맨 위에 더하므로, 위에서 세면 이미 받은 옛 줄의 열쇠가 바뀐다(Fable 5.2 P2-1).
 *   판본:<회차 머리>:<①…|전체>    판본회차_기록.md 회차 절의 「다음 원본에서 바꿀 것:」 줄(앞의 「- 」 · 「* 」 · 굵게 · 들여쓰기 · 줄표 모두 받는다).
 *           ①②로 나뉘면 번호마다, 아니면 「전체」. 「없음」은 뺀다. 회차 절 안에서 그 말이 있는데 꼴을 못 읽은 줄은 「못 읽은 줄」로 걸린다(P1-1).
 * 점검: 원천의 모든 열쇠가 교훈의 근거나 뺌에 있어야 한다(없으면 「안 올린 기록」). 받은 줄의 글이 지문과 다르면 「받은 뒤 바뀐 기록」이다.
 *   회차는 끝에 이것이 0이 될 때까지 표를 고친다. 제작 회차는 이해 줄만(--점검 이해), 판본 회차는 판본 줄만(--점검 판본) 본다 —
 *   다른 회차가 방금 올린 남의 줄 때문에 닫지 못하는 일을 막는다(P2-3).
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const 자리 = {
  표: ['docs', '마케팅', '제작양식', 'LAB_교훈.json'],
  이해: ['docs', '마케팅', '기획장부', '이해시험_기록.md'],
  판본: ['docs', '마케팅', 'LAB_하루두편_설계_20261110', '판본회차_기록.md'],
};
const 단계들 = ['원본', '판본', '시험'];
const 올린곳들 = ['읽힘', '기본값', '검사'];
const 동그라미 = '①②③④⑤⑥⑦⑧⑨⑩';

function 글읽기(p) { try { return fs.readFileSync(p, 'utf8').replace(/^﻿/, ''); } catch { return null; } }
const 칸들 = (줄) => 줄.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((x) => x.trim());

// 이해시험_기록.md → [{ 키, 날, 줄, 편, 글 }] — 「떨어진 편」 표의 LAB 줄만, 기록에 적힌 순서(위가 새 줄). 열쇠와 해는 맨 아래부터 정한다
const 첫해 = 2026;   // 이 기록은 2026-10-23에 시작했다 — 맨 아래 줄의 해
function 이해원천(글, { 해 = 첫해 } = {}) {
  if (!글) return [];
  const 줄들 = [];
  for (const 줄 of 글.split(/\r?\n/)) {
    if (!/^\|\s*\d{2}-\d{2}\s*\|/.test(줄)) continue;
    const c = 칸들(줄);
    if (c.length < 6 || !/^LAB\b/.test(c[1])) continue;
    줄들.push(c);
  }
  const out = new Array(줄들.length);
  const 본 = new Map();
  // 해 — 아래(옛 줄)부터 지금까지 본 가장 늦은 날을 기준으로, 그 해의 날이 60일 넘게 앞이면 다음 해(12월 → 1월), 그 해의 날이 300일 넘게
  // 뒤면 앞 해(1월 줄 위에 엇갈려 더한 12월 줄)로 친다. 「12월 다음 1월이면 해를 올린다」만 보면 12-31 · 01-02 · 12-31 · 01-03처럼
  // 엇갈린 줄에서 해가 두 번 올라 그 위의 모든 열쇠가 한 해씩 밀렸다(Fable 5.2 다시 검수 N3)
  const 일 = 86400000;
  const 때of = (y, md) => Date.UTC(y, Number(md.slice(0, 2)) - 1, Number(md.slice(3, 5)));
  let 지금해 = Number(해);
  let 늦은 = null;
  for (let i = 줄들.length - 1; i >= 0; i -= 1) {
    const c = 줄들[i];
    let y = 지금해;
    let t = 때of(y, c[0]);
    if (늦은 !== null && t < 늦은 - 60 * 일) { y += 1; t = 때of(y, c[0]); 지금해 = y; }
    else if (늦은 !== null && t > 늦은 + 300 * 일) { y -= 1; t = 때of(y, c[0]); }
    if (늦은 === null || t > 늦은) 늦은 = t;
    const 날 = `${y}-${c[0]}`;
    const 줄이름 = c[1].replace(/^LAB\s*/, '').trim() || 'LAB';
    const 코드 = (/^([A-Z]{1,2}\d{1,3})\b/.exec(c[2]) || [])[1] || (c[2].split(/\s+/)[0] || '편').replace(/[「」『』"]/g, '').slice(0, 12);
    let 키 = `이해:${날}:${줄이름}:${코드}`;
    const n = (본.get(키) || 0) + 1;
    본.set(키, n);
    if (n > 1) 키 = `${키}#${n}`;
    out[i] = { 키, 날, 줄: 줄이름, 편: c[2].slice(0, 80), 출처: '이해', 글: c[5] };
  }
  return out;
}

const 지문of = (글) => crypto.createHash('sha256').update(String(글 || '').replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 10);

// 회차 절 머리 「## 2026-11-15 20:00 회차(조율 …) — 통과 8 …」 → 「2026-11-15 20:00 회차」. 꼴 설명 절(<YYYY-…>)은 null
function 회차머리(h) {
  const s = h.replace(/^##\s*/, '').split(/\s+—\s+|\(/)[0].trim();
  return /^\d{4}-\d{2}-\d{2}\b/.test(s) ? s : null;
}

// 「다음 원본에서 바꿀 것」 글 → [{ 번호, 글 }]. ①②로 나뉘면 번호마다(번호 순서가 섞여 있어도 적힌 번호 그대로), 아니면 「전체」 하나.
// 괄호 · 낫표 안의 번호(「(「미안」 ③ · ④, 11-14에 이어 두 번째)」 — 다른 기록을 가리키는 것)와 글 가운데 붙은 번호는 항목 머리가 아니다
function 번호조각(글) {
  const 자리들 = [];
  let 깊이 = 0;
  for (let i = 0; i < 글.length; i += 1) {
    const ch = 글[i];
    if ('(「『“'.includes(ch)) { 깊이 += 1; continue; }
    if (')」』”'.includes(ch)) { 깊이 = Math.max(0, 깊이 - 1); continue; }
    if (!깊이 && 동그라미.includes(ch) && (i === 0 || /\s/.test(글[i - 1]))) 자리들.push(i);
  }
  if (자리들.length && 자리들[0] !== 0 && 글.slice(0, 자리들[0]).trim()) 자리들.length = 0;   // 머리 앞에 글이 있으면 번호 목록이 아니다
  if (!자리들.length) return [{ 번호: '전체', 글: 글.trim() }];
  return 자리들.map((s, k) => ({ 번호: 글[s], 글: 글.slice(s + 1, k + 1 < 자리들.length ? 자리들[k + 1] : 글.length).trim() }));
}

// 「다음 원본에서 바꿀 것」 줄 — 앞의 「- 」 · 「* 」 · 들여쓰기 · 굵게(**…**) · 작은 제목(### )과 쌍점 · 줄표를 모두 받는다(11-16 21:20 절은
// 「- 」 없이 적었다). 작은 제목은 쌍점이 없어도 된다
const 다음줄식 = /^\s*(?:#{3,6}\s+|[-*+]\s+)?(?:\*\*)?\s*다음 원본에서 바꿀 것\s*(?:\*\*)?\s*(?:(?:[:：]|—|–|-)\s*(?:\*\*)?\s*(.*)|$)$/;

// 판본회차_기록.md → [{ 키, 날, 줄: '판본', 편: 회차 머리, 글 }]. 머리 줄에 글이 없으면 바로 아래 목록(빈 줄 · 제목 · 다음 굵은 머리 전까지)을
// 그 줄의 글로 읽는다 — 「- 다음 원본에서 바꿀 것:」 아래에 「- ① …」 「- ② …」를 쓴 꼴이 말없이 빠졌다(다시 검수 N2)
function 판본원천(글) {
  if (!글) return [];
  const out = [];
  let 머리 = null;
  const 줄들 = 글.split(/\r?\n/);
  for (let i = 0; i < 줄들.length; i += 1) {
    const 줄 = 줄들[i];
    if (/^##\s/.test(줄)) { 머리 = 회차머리(줄); continue; }
    const m = 다음줄식.exec(줄);
    if (!m || !머리) continue;
    let 본문 = String(m[1] || '').replace(/\*\*/g, '').trim();
    if (!본문) {
      const 아래 = [];
      // 머리 줄이 목록 항목이면 그보다 더 들여쓴 줄만 그 아래 목록이다 — 같은 깊이의 「- 쉬는 판본: 없음」은 다음 항목이다(세 번째 확인 참고 1)
      const 머리목록 = /^(\s*)[-*+]\s/.exec(줄);
      const 머리깊이 = 머리목록 ? 머리목록[1].length : -1;
      for (let k = i + 1; k < 줄들.length; k += 1) {
        const n = 줄들[k];
        if (!n.trim() || /^#/.test(n) || /^\s*[-*+]\s+\*\*/.test(n) || 다음줄식.test(n)) break;
        if (머리깊이 >= 0 && /^\s*(?:[-*+]|\d+[.)])\s/.test(n) && /^(\s*)/.exec(n)[1].length <= 머리깊이) break;
        아래.push(n.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').trim());
      }
      본문 = 아래.join(' ').replace(/\*\*/g, '').trim();
    }
    if (!본문 || /^(없음|…)(\s*\/\s*없음)?[.\s]*$/.test(본문)) continue;
    for (const p of 번호조각(본문)) {
      if (!p.글 || /^없음[.\s]*$/.test(p.글)) continue;
      out.push({ 키: `판본:${머리}:${p.번호}`, 날: 머리.slice(0, 10), 줄: '판본', 편: 머리, 출처: '판본', 글: p.글 });
    }
  }
  return out;
}

// 회차 절 안에서 「다음 원본에서 바꿀」이 들어 있는데 위 꼴로 못 읽은 줄 → [{ 회차, 줄번호, 글 }]. 말없이 빠지면 점검이 0을 낸다(P1-1)
function 판본못읽음(글) {
  if (!글) return [];
  const out = [];
  let 머리 = null;
  const 줄들 = 글.split(/\r?\n/);
  줄들.forEach((줄, i) => {
    if (/^##\s/.test(줄)) { 머리 = 회차머리(줄); return; }
    if (!머리 || !줄.includes('다음 원본에서 바꿀')) return;
    const m = 다음줄식.exec(줄);
    if (m) {
      // 머리만 있고 그 줄에도 바로 아래에도 글이 없으면 「없음」인지 적다 만 것인지 모른다 — 「없음」이면 그렇게 적는다
      const 다음 = 줄들[i + 1];
      if (!String(m[1] || '').replace(/\*\*/g, '').trim() && (다음 === undefined || !다음.trim() || /^#/.test(다음))) out.push({ 회차: 머리, 줄번호: i + 1, 글: `${줄.trim().slice(0, 100)} (머리만 있고 글이 없다)` });
      return;
    }
    // 그 말로 시작하는 줄(목록 · 굵게 · 제목)과 표 칸(| 다음 원본에서 바꿀 것 | …)만 — 글 가운데 지나가며 쓴 말은 세지 않는다
    if (/^\s*(?:#{1,6}\s+|[-*+]\s*)?(?:\*\*)?\s*다음 원본에서 바꿀/.test(줄) || /^\s*\|\s*(?:\*\*)?\s*다음 원본에서 바꿀/.test(줄)) out.push({ 회차: 머리, 줄번호: i + 1, 글: 줄.trim().slice(0, 120) });
  });
  return out;
}

function 원천읽기(root) {
  return [...이해원천(글읽기(path.join(root, ...자리.이해))), ...판본원천(글읽기(path.join(root, ...자리.판본)))];
}

function 표읽기(root) {
  const t = 글읽기(path.join(root, ...자리.표));
  if (t === null) return { 교훈: [], 뺌: [], 지문: {}, 없음: true };
  const j = JSON.parse(t);
  return { 교훈: Array.isArray(j.교훈) ? j.교훈 : [], 뺌: Array.isArray(j.뺌) ? j.뺌 : [], 시작일: j.시작일 || '',
    지문: j.지문 && typeof j.지문 === 'object' && !Array.isArray(j.지문) ? j.지문 : {}, _원본: j };
}

// 받은 기록(근거 · 뺌에 든 열쇠)의 지문을 적은 표 JSON 글. 키는 정렬하고(이해 · 판본 줄이 갈라져 두 회차가 같은 줄을 덜 고친다)
// 배열은 한 줄에 하나씩 — 두 회차가 다른 교훈에 열쇠를 더하면 git이 저절로 합친다(P2-3). 출처를 주면 그 출처의 지문만 고친다.
// 이미 있는 지문은 덮지 않는다 — 덮으면 「받은 뒤 고쳐 쓴 줄」을 점검이 다시는 못 본다(다시 검수 N1). 고쳐 쓴 줄을 읽고 표에 반영한 뒤에만
// 바뀜받음으로 그 열쇠들(또는 true면 바뀐 줄 모두)의 지문을 지금 글로 덮는다
function 지문적은표(원천, 표, { 출처 = null, 바뀜받음 = false } = {}) {
  const 받은 = new Set([...표.교훈.flatMap((e) => e.근거 || []), ...표.뺌.map((x) => x.근거)]);
  const 지문 = { ...(표.지문 || {}) };
  const 덮을 = (k) => 바뀜받음 === true || (Array.isArray(바뀜받음) && 바뀜받음.includes(k));
  for (const x of 원천) if (받은.has(x.키) && (!출처 || x.출처 === 출처) && (!지문[x.키] || 덮을(x.키))) 지문[x.키] = 지문of(x.글);
  for (const k of Object.keys(지문)) if (!받은.has(k)) delete 지문[k];
  const 정렬 = Object.fromEntries(Object.keys(지문).sort((a, b) => a.localeCompare(b, 'ko')).map((k) => [k, 지문[k]]));
  const 원본 = { ...(표._원본 || {}) };
  const 설명 = 표._설명 ?? 원본._설명;
  return `${JSON.stringify({ ...원본, ...(설명 ? { _설명: 설명 } : {}), 시작일: 표.시작일 || 원본.시작일 || '', 교훈: 표.교훈, 뺌: 표.뺌, 지문: 정렬 }, null, 2)}\n`;
}

// 표의 꼴 — 틀린 곳 글 목록(시험이 막는다)
function 꼴점검(표) {
  const 틀림 = [];
  const ids = new Set();
  for (const e of 표.교훈) {
    const 이름 = e && e.id ? e.id : '(id 없음)';
    if (!e || typeof e.id !== 'string' || !/^[LP]\d{2}$/.test(e.id)) 틀림.push(`${이름}: id는 L00 · P00 꼴`);
    if (ids.has(e.id)) 틀림.push(`${이름}: id가 겹친다`);
    ids.add(e.id);
    if (!Array.isArray(e.단계) || !e.단계.length || e.단계.some((x) => !단계들.includes(x))) 틀림.push(`${이름}: 단계는 ${단계들.join(' · ')} 가운데`);
    if (typeof e.할것 !== 'string' || e.할것.trim().length < 8) 틀림.push(`${이름}: 할것은 한 문장`);
    if (!Array.isArray(e.근거) || !e.근거.length) 틀림.push(`${이름}: 근거가 없다`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.올린날 || ''))) 틀림.push(`${이름}: 올린날은 YYYY-MM-DD`);
    if (!올린곳들.includes(e.올린곳)) 틀림.push(`${이름}: 올린곳은 ${올린곳들.join(' · ')} 가운데`);
    if (e.올린곳 !== '읽힘' && !(typeof e.자리 === 'string' && e.자리.trim())) 틀림.push(`${이름}: 기본값 · 검사는 자리(도구와 무엇)를 적는다`);
  }
  for (const x of 표.뺌) if (!x || typeof x.근거 !== 'string' || typeof x.까닭 !== 'string' || x.까닭.trim().length < 4) 틀림.push(`뺌 ${x && x.근거}: 근거와 까닭`);
  return 틀림;
}

// 원천 ↔ 표 — 안 올린 기록(원천에 있는데 근거 · 뺌에 없음), 없는 근거(표에 있는데 원천에 없음 — 오타나 기록이 고쳐진 것),
// 받은 뒤 바뀐 기록(지문이 지금 글과 다름 — 줄을 고쳐 쓰며 새 교훈을 더한 것일 수 있다, P3-1), 지문 없는 받은 기록, 못 읽은 「다음 원본」 줄.
// 출처('이해' · '판본')를 주면 그 출처만 본다(꼴은 늘 본다). 표의 시작일 앞 기록은 셈 밖이다(11-01 — 그 앞은 「다음」 칸이 대부분 닫힘 · 버림 상태만 적었다)
function 점검(원천, 표, { 출처 = null, 못읽음 = [] } = {}) {
  const 볼 = (x) => !출처 || x.출처 === 출처;
  const 볼키 = (k) => !출처 || String(k).startsWith(`${출처}:`);
  const 있는 = new Set(원천.map((x) => x.키));
  const 받은 = new Set([...표.교훈.flatMap((e) => e.근거 || []), ...표.뺌.map((x) => x.근거)]);
  const 지문 = 표.지문 || {};
  const 셈안 = (x) => !표.시작일 || x.날 >= 표.시작일;
  return {
    안올림: 원천.filter((x) => 볼(x) && !받은.has(x.키) && 셈안(x)),
    없는근거: [...받은].filter((k) => 볼키(k) && !있는.has(k)),
    바뀜: 원천.filter((x) => 볼(x) && 받은.has(x.키) && 지문[x.키] && 지문[x.키] !== 지문of(x.글)),
    지문없음: 원천.filter((x) => 볼(x) && 받은.has(x.키) && 셈안(x) && !지문[x.키]),
    못읽음: 출처 && 출처 !== '판본' ? [] : 못읽음,
    꼴: 꼴점검(표),
  };
}
const 걸림수 = (r) => r.안올림.length + r.없는근거.length + r.바뀜.length + r.지문없음.length + r.못읽음.length + r.꼴.length;

// 교훈마다 셈 — 근거 수 · 처음 · 최근 · 올린 뒤 다시 나온 수
function 셈(표, 원천) {
  const 날of = new Map(원천.map((x) => [x.키, x.날]));
  return 표.교훈.map((e) => {
    const 날들 = (e.근거 || []).map((k) => 날of.get(k)).filter(Boolean).sort();
    const 다시 = 날들.filter((d) => d > e.올린날).length;
    return { ...e, 횟수: 날들.length, 처음: 날들[0] || '', 최근: 날들[날들.length - 1] || '', 다시 };
  });
}

// 판본 회차 절의 결과 표(머리 「| 편 | 키 | 결과 | 고친 횟수 |」) → [{ 회차, 판본, 통과, 고친평균 }]
function 판본숫자(글) {
  if (!글) return [];
  const out = [];
  let 머리 = null, 표안 = false, 지금 = null;
  for (const 줄 of 글.split(/\r?\n/)) {
    if (/^##\s/.test(줄)) { 머리 = 회차머리(줄); 표안 = false; 지금 = null; continue; }
    if (!머리) continue;
    if (/^\|/.test(줄)) {
      const c = 칸들(줄);
      if (!표안 && !지금 && c[0] === '편' && c[1] === '키' && c[2] === '결과' && /^고친/.test(c[3] || '')) { 표안 = true; 지금 = { 회차: 머리, 판본: 0, 통과: 0, 고친: [] }; out.push(지금); continue; }
      if (!표안 || /^-+$/.test(c[0].replace(/:/g, ''))) continue;
      지금.판본 += 1;
      if (/^통과/.test(c[2])) 지금.통과 += 1;
      const n = /^\d+$/.test(c[3]) ? Number(c[3]) : NaN;
      if (Number.isFinite(n)) 지금.고친.push(n);
      continue;
    }
    if (표안) 표안 = false;
  }
  return out.map((x) => ({ 회차: x.회차, 판본: x.판본, 통과: x.통과, 고친평균: x.고친.length ? Math.round((x.고친.reduce((a, b) => a + b, 0) / x.고친.length) * 10) / 10 : null }));
}

const 짧은날 = (d) => String(d || '').slice(5);
const 시작상한 = 12;

// 시작 — 그 단계에서 먼저 지킬 교훈(올린 뒤 다시 나온 것 · 많이 나온 것부터), 숫자, 안 올린 기록 수
function 시작(root, 단계, { 상한 = 시작상한 } = {}) {
  if (!단계들.includes(단계)) throw new Error(`단계는 ${단계들.join(' · ')} 가운데 하나다: ${단계}`);
  const 원천 = 원천읽기(root);
  const 표 = 표읽기(root);
  const 보는단계 = 단계 === '원본' ? ['원본', '시험'] : [단계];
  const 줄 = 셈(표, 원천).filter((e) => e.단계.some((x) => 보는단계.includes(x)))
    .sort((a, b) => b.다시 - a.다시 || b.횟수 - a.횟수 || String(b.최근).localeCompare(String(a.최근)) || a.id.localeCompare(b.id));
  const 안 = 점검(원천, 표, { 출처: 단계 === '판본' ? '판본' : '이해' }).안올림;
  return {
    단계, 교훈수: 줄.length, 줄: 줄.slice(0, 상한), 더있음: Math.max(0, 줄.length - 상한),
    안올림: 안.length, 안올림최근: 안.slice().sort((a, b) => String(b.날).localeCompare(String(a.날))).slice(0, 3).map((x) => x.키),
    판본숫자: 단계 === '판본' ? 판본숫자(글읽기(path.join(root, ...자리.판본))).slice(-5) : [],
    표없음: Boolean(표.없음),
  };
}

const 표지 = '[LAB 교훈]';
function 시작글(r) {
  if (!r || r.표없음 || (!r.줄.length && !r.안올림)) return '';
  const 무엇 = r.단계 === '판본' ? '판본 글과 원고를 쓰기 전에' : '이 편을 기획하고 콘티 · 화면 글을 쓰기 전에';
  const 줄 = [`${표지} ${무엇} 지킬 것 ${r.교훈수}개 — 이해 시험 · 판본 회차에서 떨어진 까닭을 모은 표(docs/마케팅/제작양식/LAB_교훈.json)에서 다시 나온 것부터`];
  for (const e of r.줄) {
    const 셈글 = `기록 ${e.횟수}번(${짧은날(e.처음)}${e.횟수 > 1 ? ` ~ ${짧은날(e.최근)}` : ''})`;
    const 다시글 = e.다시 ? ` · ${짧은날(e.올린날)}에 올린 뒤에도 ${e.다시}번 다시 — 읽히기로는 안 막혀 기본값이나 검사로 올릴 차례` : '';
    const 곳 = e.올린곳 === '읽힘' ? '' : ` · ${e.올린곳}: ${e.자리}`;
    줄.push(`  · ${e.id} ${e.할것} — ${셈글}${다시글}${곳}`);
  }
  if (r.더있음) 줄.push(`  · … 더 ${r.더있음}개는 node tools/LAB교훈.js 시작 ${r.단계} --모두`);
  if (r.판본숫자.length) 줄.push(`  판본 회차 숫자(통과 / 판본 · 고친 횟수 평균): ${r.판본숫자.map((x) => `${x.회차.replace(/ 회차$/, '')} ${x.통과}/${x.판본}${x.고친평균 === null ? '' : ` · ${x.고친평균}`}`).join(' | ')}`);
  if (r.안올림) 줄.push(`  교훈 표에 아직 안 올린 기록 ${r.안올림}개(${r.안올림최근.join(' · ')}${r.안올림 > 3 ? ' …' : ''}) — 회차를 닫기 전에 node tools/LAB교훈.js --점검 ${r.단계 === '판본' ? '판본' : '이해'}이 0이 되게 표를 고친다`);
  return 줄.join('\n');
}

module.exports = { 자리, 단계들, 올린곳들, 이해원천, 판본원천, 판본못읽음, 번호조각, 회차머리, 원천읽기, 표읽기, 꼴점검, 점검, 걸림수, 지문of, 지문적은표, 셈, 판본숫자, 시작, 시작글, 표지, 시작상한, 다음줄식 };
