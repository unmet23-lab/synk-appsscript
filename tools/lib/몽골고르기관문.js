'use strict';

// ㉑ LAB 몽골 편 고르기(2026-11-18) — 인스타 @synk.mn 21:00 칸 편의 기획.md 칸을 본다. 규칙 원문은 LAB 장부 머리말
// 「몽골 편 고르기 — 한 상황에 쓸 말 여러 개」(docs/마케팅/기획장부/LAB.md)다. 유호님 11-18 「잘된편들 모아서 왜 잘됬는지 분석해서
// 다음편부터 적용해서 … 특징을 잘 살려줄래」에 따라 스무 편을 견줬더니, 1만 회를 넘긴 편을 가른 것은 3초 유지율이 아니라 도달 대비
// 공유와 저장이었고 한 상황에 쓸 말을 여러 개 주는 편이 그랬다. 규칙을 글로만 두면 회차 세션이 놓치므로 여기서 칸을 센다.
//
//   고칠 것 — 기획에 「꼴」 칸이 없거나 값이 「쓸 말 여러 개(N마디)」 · 「한 가지」로 시작하지 않는다.
//             「누구에게」 칸에 「보낼 사람」과 「저장할 까닭」이 둘 다 없다(장부: 둘 다 못 적는 편은 21:00 칸에 두지 않는다).
//   확인할 것 — 쓸 말 여러 개 편인데 「첫 2초」에 숫자가 없거나 마디 수가 셋 밑이다. 「근거」에 공유율 · 저장율(%)이 없다.
//             한 가지 편을 21:00에 두었으면 그 주 21:00 칸의 꼴별 수를 보인다(목표: 쓸 말 여러 개 넷 이상).
//
// 편 폴더 이름 끝 날짜가 11-19 이후인 편만 본다. 11-18 회차들은 규칙이 올라가기 전에 시작했다. 13:00 칸과 나라 판본(돌림) 판은 보지 않는다.
// 12-06 판정(장부 머리말)은 「꼴」 칸으로 두 묶음을 가른다.
const fs = require('node:fs');
const path = require('node:path');
const { FIX, LOOK } = require('./게시글규칙.js');

const FROM = '20261119';
const ACCOUNT = 'lab-instagram';
const EVENING = 21;
const TARGET = 4; // 한 주 21:00 일곱 칸 가운데 쓸 말 여러 개 편
const MANY = '쓸 말 여러 개';
const ONE = '한 가지';

// 기획.md 칸표 한 줄 = `| 칸 이름 | 값 |`. 굵게(**) 쓴 이름도 받는다. 같은 이름이 여럿이면 처음 것.
function rowsOf(text) {
  const rows = new Map();
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = line.match(/^\|\s*\**\s*([^|*]+?)\s*\**\s*\|(.*)\|\s*$/);
    if (!m || /^-+$/.test(m[1]) || m[1] === '칸') continue;
    if (!rows.has(m[1])) rows.set(m[1], m[2].trim());
  }
  return rows;
}

function kindOf(value) {
  const v = String(value || '').replace(/\*/g, '').trim();
  if (v.startsWith(MANY)) {
    const n = v.match(/(\d+)\s*마디/);
    return { kind: MANY, count: n ? Number(n[1]) : null };
  }
  if (v.startsWith(ONE)) return { kind: ONE, count: null };
  return { kind: null, count: null };
}

const folderDate = (name) => (String(name).match(/_(\d{8})$/) || [])[1] || null;

function kstParts(iso) {
  const at = Date.parse(iso || '');
  if (Number.isNaN(at)) return null;
  const d = new Date(at + 9 * 3600e3);
  return { day: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
}

// 월요일부터 일요일까지(슬롯 기준 — 제작 절차 「같은 뼈대는 주 1편」과 같은 셈)
function weekStart(day) {
  const d = new Date(`${day}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 86400e3).toISOString().slice(0, 10);
}

const eveningPlateOf = (plates) => (plates || []).find((p) => {
  if (p.account !== ACCOUNT || p.raw?.돌림) return false;
  const t = kstParts(p.time);
  return t && t.hour === EVENING;
});

// 같은 주 21:00 칸 편을 꼴별로 센다. 편 폴더 날짜가 FROM 앞인 편은 「꼴」 칸이 없어 「모름」으로 센다.
function weekCount(repo, week, { self = null } = {}) {
  const base = path.join(repo, 'docs', '마케팅');
  const count = { [MANY]: 0, [ONE]: 0, 모름: 0, 편: [] };
  let names = [];
  try { names = fs.readdirSync(base).filter((n) => /^LAB_/.test(n)); } catch { return count; }
  for (const name of names) {
    let prep;
    try { prep = JSON.parse(fs.readFileSync(path.join(base, name, '게시', '준비.json'), 'utf8')); } catch { continue; }
    if (/^버림/.test(String(prep.상태 || ''))) continue;
    const plates = (prep.판 || []).map((p) => ({ account: p.계정, time: p.시각, raw: p }));
    const plate = eveningPlateOf(plates);
    const t = plate && kstParts(plate.time);
    if (!t || weekStart(t.day) !== week) continue;
    let kind = null;
    try { kind = kindOf(rowsOf(fs.readFileSync(path.join(base, name, '기획.md'), 'utf8')).get('꼴')).kind; } catch { /* 기획 없음 */ }
    count[kind || '모름'] += 1;
    count.편.push({ 편: name, 날: t.day, 꼴: kind || '모름', 이편: name === self });
  }
  return count;
}

function mnPickFindings(bundle, plates, { repo = bundle.repo } = {}) {
  const out = [];
  const date = folderDate(bundle.name);
  if (!date || date < FROM || bundle.prep?.브랜드 !== 'LAB') return out;
  const plate = eveningPlateOf(plates);
  if (!plate) return out;
  const add = (level, code, where, message) => out.push({ level, code, where, message });
  let text = '';
  try { text = fs.readFileSync(path.join(bundle.dir, '기획.md'), 'utf8'); } catch {
    add(FIX, 'mn-pick-plan', '기획.md', '몽골 21:00 칸 편인데 기획.md가 없다 — LAB 장부 머리말 「몽골 편 고르기」의 칸을 적는다');
    return out;
  }
  const rows = rowsOf(text);
  const { kind, count } = kindOf(rows.get('꼴'));
  if (!rows.has('꼴')) add(FIX, 'mn-pick-kind', '기획.md', '「꼴」 칸이 없다 — 「쓸 말 여러 개(N마디)」나 「한 가지」로 적는다(LAB 장부 「몽골 편 고르기」)');
  else if (!kind) add(FIX, 'mn-pick-kind', '기획.md', `「꼴」 칸 값이 「쓸 말 여러 개(N마디)」나 「한 가지」로 시작하지 않는다: ${String(rows.get('꼴')).slice(0, 40)}`);
  const who = rows.get('누구에게') || '';
  const missing = ['보낼 사람', '저장할 까닭'].filter((w) => !who.includes(w));
  if (missing.length) add(FIX, 'mn-pick-who', '기획.md 누구에게', `「${missing.join('」 · 「')}」을 적지 않았다 — 둘 다 못 적는 편은 21:00 칸에 두지 않는다(LAB 장부 「몽골 편 고르기」 3)`);
  const evidence = rows.get('근거') || '';
  if (!(/공유/.test(evidence) && /저장/.test(evidence) && /%/.test(evidence))) {
    add(LOOK, 'mn-pick-rate', '기획.md 근거', '지난 세 편의 공유 ÷ 도달 · 저장 ÷ 도달(%)이 근거에 없다(LAB 장부 「몽골 편 고르기」 4)');
  }
  if (kind === MANY) {
    if (count !== null && count < 3) add(LOOK, 'mn-pick-count', '기획.md 꼴', `쓸 말 여러 개 편인데 ${count}마디다 — 3~5마디가 이 꼴이다`);
    if (!/\d/.test(rows.get('첫 2초') || '')) add(LOOK, 'mn-pick-hook', '기획.md 첫 2초', '첫 화면 머리 글에 몇 마디를 얻는지 숫자가 없다(LAB 장부 「몽골 편 고르기」 2)');
  }
  if (kind === ONE) {
    const t = kstParts(plate.time);
    const week = weekStart(t.day);
    const c = weekCount(repo, week, { self: bundle.name });
    add(LOOK, 'mn-pick-week', `${ACCOUNT} ${t.day} 21:00`,
      `한 가지 편을 21:00 칸에 두었다 — ${week} 주 21:00 칸: 쓸 말 여러 개 ${c[MANY]}편 · 한 가지 ${c[ONE]}편 · 꼴 모름 ${c.모름}편(목표: 쓸 말 여러 개 ${TARGET}편 이상, LAB 장부 「몽골 편 고르기」 1)`);
  }
  return out;
}

module.exports = { mnPickFindings, rowsOf, kindOf, weekStart, weekCount, FROM, MANY, ONE };
