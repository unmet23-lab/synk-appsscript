#!/usr/bin/env node
'use strict';
/**
 * 흠 장부 — 편 폴더마다 쌓인 흠 기록을 슬롭 점검표 번호로 모아, 만드는 길(컷표영상 · 그래픽 · LAB)마다 센다. 읽기만 한다. AI 없이 돈다.
 *
 * 왜: 유호님 11-15 「작업 하나 마무리될때 그 과정에서 중요한것들 (실수내용 고친내용) 반영이 잘 되서 가면갈수록 실수없는 제대로 된
 * 자동화 에이전트를 만들고싶어」. 11-15 첫 판은 브랜드로 줄을 나누고 갈래 열네 개를 새로 지었는데, 설계 검토(Fable 「고쳐서 만듦」)에서
 * 세는 이름은 점검표 번호 하나로 묶고 줄은 만드는 길로 나누기로 고쳤다 — docs/마케팅/제작양식/흠장부_설계_20261115.md 「② 세기」 「⑤ 재기」.
 *
 *   node tools/흠장부.js [길(컷표영상 · 그래픽 · LAB) 또는 브랜드] [--일수 N] [--최근 20] [--json] [--폴더 <docs/마케팅>]
 *   node tools/흠장부.js 시작 <편 폴더 | 컷표 파일 | 길> [--최근 20] [--json] [--폴더 <docs/마케팅>]   새 편을 시작할 때 읽을 줄(아래 「시작」)
 *
 * 읽는 것(편 폴더마다, docs/마케팅 아래 네 층까지):
 *   게시/최종확인_이력.jsonl  최종 확인 판정(tools/lib/최종확인.js). 이력이 없는 옛 편은 게시/최종확인.json의 마지막 판정 하나(「옛 기록」).
 *   게시/검사이력.jsonl       기계 검사가 돌 때마다 남긴 줄(tools/lib/검사이력.js) — 등급 「걸림」만 흠으로 센다(「확인」은 기계가 확신 못 한 것).
 *                             걸림 · 확인 모두 「기계가 띄운 것」으로는 본다 — 띄운 흠이 최종 확인에서 다시 잡히면 「기계가 잡았는데 넘김」(아래 숫자).
 *   게시/최종본검사.json      검사이력이 생기기 전(11-15 전)의 최종 확인 판정에만 — 올리기 전 검사 ⑳의 마지막 잰 값. 지금 영상과 같을 때 「기계가 띄운 것」으로만 읽는다.
 *   게시/미학맹검.json · 미학맹검_대체.json  기각 화면의 약점 번호 — [K7]은 점검표 7, [C10]과 [C010]은 모음 지적 C010. 세기만 한다.
 *   docs/마케팅/제작양식/슬롭점검_모음.json  유호님 말씀 — 편과 길이 없는 기록이라 번호별 횟수만 보인다.
 *   docs/마케팅/제작양식/흠갈래.json         번호 → 묶음 · 올린 검사, 최종 확인 갈래 이름 → 번호, 검사 규칙 → 번호.
 *                             번호가 없는 갈래(「소리」)에 둔 올린 검사의 규칙은 그 갈래 열쇠(「항목:소리」)로 센다(11-15 3단계).
 * 열쇠: 점검표 번호(「#26」). 번호가 없는 갈래 이름은 「항목:이름」, 번호에 안 이은 기계 규칙은 「규칙:검사:이름」으로 센다.
 *   갈래 없이 쓴 옛 판정은 「미분류」로만 센다 — 메모 글로 갈래를 어림하지 않는다(어림이 「음량 −14.6 LUFS」 같은 잰 값을 소리 흠으로 셌다).
 * 올릴 차례: 최종 확인과 기계 검사에서 온 흠만 센다. 그 길에서 이력이 있는 편을 최근 순으로 스무 개(--최근) 골라, 그 가운데
 *   세 편 이상이고 15% 넘게 난 열쇠(기계 규칙은 점검표 번호에 이은 것만). 미학 맹검 기각은 권고라(결정 11-12) 세기만 하고 셈에 넣지 않는다.
 *   올릴 차례는 트랙에 한 줄로 남기고 작업 세션이 검수와 함께 올린다 — 편을 닫는 세션과 최종 확인 세션은 올리지 않는다(설계 ③).
 * 숫자(길마다): 최종 확인 첫 판 통과율 · 편당 판정 수 · 맨 끝 관문에서 처음 잡힌 흠의 비율 · 기계가 잡았는데 넘김(앞선 기계 검사가 걸림이나
 *   확인으로 먼저 띄웠는데 최종 확인에서 다시 잡힌 흠 — 설계 ⑤ 「걸림 무시로 넘긴 횟수」, 11-15 3단계). 기록이 없으면 「자료 없음」이다.
 *   열쇠마다의 상태: 올린 검사가 있으면 「검사로 올림」 · 「기계가 잡았는데 넘김」(띄웠는데 다시 잡힘) · 「검사가 못 잡음」(올린 날 뒤 띄우지도 못함).
 *   잰 값으로 가를 문턱이 없어 검사 없이 기본값 · 칸 · 검수 질문으로만 올린 흠(흠갈래.json의 「올린곳」, 11-16 인물튐)은 「올릴 차례」 대신
 *   「기계 검사 없이 올림」과 그 뒤에도 최종 확인에서 잡힌 횟수를 보인다. 시작 줄에는 그대로 내고 「올린 자리: … — 눈으로 본다」를 붙인다.
 *   올린 자리에 「할것」(그 편을 만들 때 할 일 한 문장)이 있으면 시작 줄의 그 흠 바로 아래에 「→ 할 것: …」 한 줄로 낸다(11-16). 기본값은
 *   「할것」을 꼭 적는다(tests/흠갈래.test.js) — 절차 문서의 문장으로만 두면 새 편을 시작하는 세션이 그 자리에서 보지 못한다.
 *   올린 검사가 그 흠의 일부만 재서 나머지를 기본값 · 검수 질문으로도 올린 열쇠(11-16 점검표 2 끝의 힘)는 상태 끝에 「… 으로도 올림(날짜~)」을 붙인다.
 *
 * 시작(설계 ④ · 2단계, 2026-11-15): 그 길의 최근 스무 편에서 최종 확인이나 기계 검사(등급 걸림)에 걸렸는데 검사가 아직 못 잡는 흠만
 *   셋 이하로 낸다 — ① 흠갈래.json의 그 번호에 올린 검사가 없는 것(점검표 줄이 없는 갈래 이름도. 「기타」 · 묶음 없는 이름은 뺀다),
 *   ② 올린 검사가 있는데 그 뒤(날짜가 없으면 언제든) 최종 확인에서 앞선 기계 검사가 띄우지 않은 채 다시 잡힌 것(장부의 「검사가 못 잡음」).
 *   기계가 먼저 띄운 흠(「기계가 잡았는데 넘김」)은 검사가 받는 흠이라 이 묶음에는 내지 않고, 아래에 「검사가 띄웠는데 넘겨서 최종 확인에서
 *   다시 잡힌 흠」 묶음으로 따로 둘 이하를 낸다(JSON 「넘김줄」) — 검사가 못 잡은 것이 아니라 만드는 세션이 「확인할 것」을 넘긴 것이라, 검사가
 *   띄우면 넘기기 전에 고치라고 알린다(11-15 3단계 뒤: 사람 굳음 세 편이 이 꼴이었다). 같은 흠이 못 잡은 묶음에 있으면 거기에만 낸다.
 *   올린 검사가 모두 「범위: 일부」(그 흠의 한 갈래만 잼)면
 *   날짜와 상관없이 기계가 띄우지 못한 최종 확인 흠을 「검사가 일부만 잼」으로 낸다(11-15 소리 · 조용구간, GPT 검수 GA2).
 *   맹검에만 나온 번호, 미분류, 번호에 안 이은 기계 규칙은 내지 않는다. 낼 것이 없으면 글 출력은 아무것도 없다(--json은 빈 「줄」).
 *   줄마다 번호와 이름 · 몇 편 · 가장 최근에 걸린 편에서 보인 것 한 줄(기계 검사면 그 걸림의 글, 최종 확인이면 메모에서 그 흠의 낱말이 가장 많은
 *   조각 — 보이기만 하고 세는 데는 쓰지 않는다. 낱말이 하나도 안 맞으면 「메모 첫 흠」이라고 밝히고 메모의 첫 흠 조각).
 *   길: 길 이름을 주면 그 길. 편 폴더 · 컷표 파일을 주면 그 편의 길이다 — 브랜드 LAB은 LAB, 컷표.json · 컷순서.json이 있거나 컷표 파일을 주면
 *   컷표영상, 아직 컷표가 없는 새 편은 같은 브랜드의 가장 최근 편의 길(없으면 그래픽). 편 폴더가 docs/마케팅 아래가 아니면(시험의 임시 폴더 ·
 *   .tmp의 공모 폴더) 아무것도 내지 않는다. 부르는 곳: tools/새편.js(새 편을 세울 때) · tools/컷연속성검사.py(컷표를 직접 돌릴 때, 글 출력만).
 *   두 곳 모두 장부가 실패해도 제 출력과 끝 코드를 바꾸지 않는다. 끄기: 환경 변수 SYNK_FLAW_LEDGER=off. 장부 자료 자리: --폴더 ·
 *   SYNK_FLAW_LEDGER_DIR(시험) · 그 밖에는 공용 작업본의 docs/마케팅. 머리 줄의 「[흠 장부]」는 tools/영상세션재기.js가 「세션에 나왔나」를 세는 표지다.
 */
const fs = require('node:fs');
const path = require('node:path');
const { 공용작업본 } = require('./lib/공용작업본.js');
const 이력 = require('./lib/검사이력.js');

const REPO = path.resolve(__dirname, '..');
const 길들 = ['컷표영상', '그래픽', 'LAB'];
const OPEN = new Set(['통과', '작은 흠']);
const 올릴편수 = 3;
const 올릴비율 = 0.15;

function json읽기(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')); } catch { return null; } }
function 줄들(p) {
  let 글; try { 글 = fs.readFileSync(p, 'utf8'); } catch { return null; }
  return 글.split(/\r?\n/).filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

// ── 기준 표 ──
function 기준읽기(repo = REPO) {
  const 갈래 = json읽기(path.join(repo, 'docs', '마케팅', '제작양식', '흠갈래.json')) || { 줄: [], 항목: {} };
  const 자리 = new Map();
  const 말씀칸 = new Map();   // 번호 → 점검표 셋째 칸(유호님 말씀 · 날짜) — 「같은 뿌리 말씀이 다시 나온 횟수」(말씀다시세기)가 읽는다
  try {
    for (const l of fs.readFileSync(path.join(repo, 'docs', '마케팅', '제작양식', '광고영상_슬롭점검표.md'), 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\| (\d+) \| ([^|]*)\|(?: ([^|]*)\|)?/);
      if (m) { 자리.set(Number(m[1]), m[2].trim()); if (m[3] !== undefined) 말씀칸.set(Number(m[1]), m[3].trim()); }
    }
  } catch { /* 이름 없이 번호만 보인다 */ }
  const 줄 = new Map([].concat(갈래.줄 || []).map((x) => [x.번호, x]));
  const 규칙번호 = new Map();
  for (const x of 줄.values()) for (const o of [].concat(x.올린검사 || [])) for (const r of [].concat(o.규칙 || [])) 규칙번호.set(`${o.검사}:${r}`, x.번호);
  // 「<검사>:<규칙>」 → 열쇠. 점검표 줄의 규칙은 「#번호」, 번호가 없는 갈래(「항목」)에 올린 규칙은 「항목:이름」(11-15 3단계 소리 · 조용구간)
  const 규칙열쇠 = new Map([...규칙번호].map(([k, n]) => [k, `#${n}`]));
  for (const [이름, x] of Object.entries(갈래.항목 || {})) {
    for (const o of [].concat(x?.올린검사 || [])) for (const r of [].concat(o.규칙 || [])) if (!규칙열쇠.has(`${o.검사}:${r}`)) 규칙열쇠.set(`${o.검사}:${r}`, `항목:${이름}`);
  }
  const 모음 = json읽기(path.join(repo, 'docs', '마케팅', '제작양식', '슬롭점검_모음.json')) || { 지적: [] };
  return { 줄, 항목: 갈래.항목 || {}, 자리, 말씀칸, 규칙번호, 규칙열쇠, 모음, 묶음이름: 갈래.묶음 || {}, 후보: 갈래.새묶음후보 || {} };
}

// 열쇠에 올린 검사 목록 — 「#번호」는 그 점검표 줄, 「항목:이름」은 그 갈래의 「올린검사」.
// 길을 주면 그 길에서 도는 검사만 — 올린 검사의 「길」(목록, 없으면 모든 길) 밖이면 그 길에서는 올린 것으로 치지 않는다(11-16 — 최종본검사는
// 올리기 전 검사 ⑳이 synkbrief · yuhobuilds만 재는데 LAB 장부에도 「검사로 올림」이라 보였다)
function 올린검사of(열쇠, 기준, 길 = null) {
  const m = /^#(\d+)$/.exec(열쇠);
  const h = /^항목:(.+)$/.exec(열쇠);
  const 목록 = m ? [].concat(기준.줄.get(Number(m[1]))?.올린검사 || []) : h ? [].concat(기준.항목[h[1]]?.올린검사 || []) : [];
  return 길 ? 목록.filter((o) => !o || !Array.isArray(o.길) || o.길.includes(길)) : 목록;
}
// 편들이 모두 한 길이면 그 길(장부는 길마다 센다) — 섞였으면 null(길로 거르지 않는다)
function 한길of(편들) {
  const 길 = 편들.length ? 편들[0].길 : null;
  return 길 && 편들.every((p) => p.길 === 길) ? 길 : null;
}

// 열쇠에 기계 검사 없이 올린 자리(기본값 · 칸 · 검수 질문 — 「올린곳」, 날짜가 있는 것만). 잰 값으로 걸릴 편과 지나갈 편을 가르지 못해
// 검사를 못 올린 흠이 「올릴 차례」로 계속 뜨지 않게 한다(11-16 인물튐). 시작 줄에는 그대로 낸다 — 기계가 받는 흠이 아니라서 만드는 세션이 직접 본다
function 올린곳of(열쇠, 기준) {
  const m = /^#(\d+)$/.exec(열쇠);
  const h = /^항목:(.+)$/.exec(열쇠);
  const x = m ? 기준.줄.get(Number(m[1])) : h ? 기준.항목[h[1]] : null;
  return [].concat(x?.올린곳 || []).filter((o) => o && o.날짜 && o.단계);
}

// 올린 자리마다 적어 둔 「할것」(그 편을 만들 때 실제로 할 일 한 문장). 시작 줄의 그 흠 아래에 「→ 할 것」으로 낸다 — 기본값은 긴 절차 문서의
// 문장으로만 있어, 새 편을 시작하는 세션이 그 문서를 다시 읽지 않아도 그 자리에서 보게 한다(11-16 유호님 「다음에 무조건 적용하게 해줘야해」)
function 할것of(종류) {
  return [].concat(종류?.곳 || []).map((o) => String(o.할것 || '').trim()).filter(Boolean);
}

// 검사이력 걸림 한 줄 → 열쇠. 번호 칸 → 「<눈>:<규칙>」 → 올리기 전 검사의 final-cut-<항목>은 최종본검사의 그 항목 → 없으면 「규칙:눈:규칙」
function 규칙열쇠of(눈, g, 기준) {
  if (Number.isInteger(g?.번호)) return `#${g.번호}`;
  const 규칙 = String(g?.규칙 || '');
  const fc = /^final-cut-(.+)$/.exec(규칙);
  return 기준.규칙열쇠.get(`${눈}:${규칙}`) || (fc ? 기준.규칙열쇠.get(`최종본검사:${fc[1]}`) : undefined) || `규칙:${눈}:${규칙}`;
}

// 검사이력이 아직 없던 옛 편(11-15 1단계 전) — 올리기 전 검사 ⑳이 남긴 게시/최종본검사.json(영상 바이트 · 수정 시각과 함께 둔 마지막 잰 값)을
// 「기계가 띄운 것」으로만 읽는다. 지금 영상과 바이트 · 수정 시각이 같은 줄만 믿는다. 때는 기록의 「잰때」(11-15 3단계부터 적음)이고, 그 칸이 없는
// 옛 줄은 영상의 수정 시각이다(잰 때는 그 뒤 — 옛 줄은 3단계 전 도구가 쓴 것이라 그때도 최종 확인 묶음이 같은 값을 검수자에게 보였다).
// 판정 뒤에 새 도구로 다시 잰 줄은 「잰때」가 판정보다 늦어 앞선 경고로 세지 않는다(GPT 검수 GA1).
// 편 수 · 올릴 차례 · 숫자 셈에는 넣지 않고 「기계가 잡았는데 넘김」을 가르는 데만 쓴다(11-15 3단계 — 사람 굳음 세 편이 이 기록에 있었다).
function 옛최종본띄움(dir, 기준) {
  const j = json읽기(path.join(dir, '게시', '최종본검사.json'));
  if (!j || typeof j !== 'object' || Array.isArray(j)) return [];
  const 이름 = path.basename(dir);
  const out = [];
  for (const [key, row] of Object.entries(j)) {
    if (!row || typeof row !== 'object' || !row.결과 || !row.수정) continue;
    const 조각 = String(key).split(/[\\/]+/).filter(Boolean);
    const i = 조각.lastIndexOf(이름);
    const 후보 = [i >= 0 ? path.join(dir, ...조각.slice(i + 1)) : null, path.join(dir, ...조각), path.join(dir, '게시', 조각[조각.length - 1] || '')].filter(Boolean);
    let st = null;
    for (const f of 후보) { try { const s = fs.statSync(f); if (s.isFile()) { st = s; break; } } catch { /* 다음 후보 */ } }
    if (!st || st.size !== row.바이트 || new Date(st.mtimeMs).toISOString() !== row.수정) continue;   // 영상이 바뀌었거나 없다 — 믿지 않는다
    const 열쇠로 = (항목들) => [...new Set(항목들.filter(Boolean).map((x) => 규칙열쇠of('최종본검사', { 규칙: x }, 기준)))];
    const 열쇠들 = 열쇠로([].concat(row.결과.걸림 || []).map((h) => h && h.항목));
    if (열쇠들.length) out.push({ 때: String(row.잰때 || row.수정), 열쇠들 });
    // 같은 영상을 도구 판이 바뀌어 다시 잰 줄 — 처음 잰 때와 그때 걸린 항목(최종본관문.js remember 「처음」)도 앞선 증거로 둔다
    const 처음 = row.처음 && typeof row.처음 === 'object' ? 열쇠로([].concat(row.처음.걸림항목 || [])) : [];
    if (처음.length && row.처음.잰때) out.push({ 때: String(row.처음.잰때), 열쇠들: 처음 });
  }
  return out;
}

// 최종 확인 갈래(이름이나 번호) → 열쇠
function 갈래열쇠(g, 기준) {
  const s = String(g || '').trim();
  const m = /^[Kk#]?(\d{1,3})$/.exec(s);
  if (m) return `#${Number(m[1])}`;
  const 항목 = 기준.항목[s];
  if (항목 && Number.isInteger(항목.번호)) return `#${항목.번호}`;
  return `항목:${s}`;
}

// 맹검 약점 번호 → 열쇠. [K7] · [K07] → #7(점검표 줄), [C10] · [C010] → C010(모음 지적 id 꼴). 미학맹검.js가 붙이게 한 대괄호 꼴만 읽는다
// (글 속 컷 이름 「C10」을 지적 번호로 잘못 읽지 않게). 강점의 [P…] · [G…]는 열쇠가 아니다 — [G번호]는 묶음이 아니라 「통과한 판」 번호다.
function 맹검열쇠들(글) {
  const out = [];
  for (const m of String(글 || '').matchAll(/\[\s*([KkCc])\s*(\d{1,3})\s*\]/g)) {
    out.push(m[1].toUpperCase() === 'K' ? `#${Number(m[2])}` : `C${String(Number(m[2])).padStart(3, '0')}`);
  }
  return [...new Set(out)];
}

// ── 모으기 ──
function 편폴더들(root) {
  const out = [];
  const walk = (d, depth) => {
    let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    if (depth > 0 && es.some((e) => e.isDirectory() && e.name === '게시')) { out.push(d); return; }
    if (depth >= 4) return;
    for (const e of es) {
      if (!e.isDirectory() || /^(받음|정지|node_modules|remotion|\.tmp|frames|판본|판|검수|게시|\.git)$/.test(e.name)) continue;
      walk(path.join(d, e.name), depth + 1);
    }
  };
  walk(root, 0);
  return out.sort();
}

// 한 편의 사건들 — {때, 출처('최종 확인' · '기계 검사' · '맹검'), 단계, 눈, 판, 결과, 열쇠들, 미분류?, 옛기록?}
function 편읽기(dir, 기준) {
  const 게시 = path.join(dir, '게시');
  const 준비 = json읽기(path.join(게시, '준비.json'));
  const 사건 = [];
  const 확인줄 = 줄들(path.join(게시, '최종확인_이력.jsonl'));
  if (확인줄) {
    for (const x of 확인줄) {
      if (!x.결과) continue;
      const 갈래 = Array.isArray(x.갈래) ? x.갈래 : [];
      사건.push({ 때: String(x.시각 || ''), 출처: '최종 확인', 단계: '최종 확인', 눈: '최종확인', 판: x.판 || '', 결과: x.결과,
        열쇠들: x.결과 === '통과' ? [] : 갈래.map((g) => 갈래열쇠(g, 기준)), 미분류: x.결과 !== '통과' && !갈래.length, 메모: String(x.메모 || '') });
    }
  } else {
    const r = json읽기(path.join(게시, '최종확인.json'));
    if (r && r.결과) {
      const 갈래 = Array.isArray(r.갈래) ? r.갈래 : [];
      사건.push({ 때: String(r.시각 || ''), 출처: '최종 확인', 단계: '최종 확인', 눈: '최종확인', 판: '', 결과: r.결과, 옛기록: true,
        열쇠들: r.결과 === '통과' ? [] : 갈래.map((g) => 갈래열쇠(g, 기준)), 미분류: r.결과 !== '통과' && !갈래.length, 메모: String(r.메모 || '') });
    }
  }
  const 검사줄 = 줄들(path.join(게시, 이력.HISTORY)) || [];
  for (const x of 검사줄) {
    const 열쇠들 = [];
    const 띄운 = [];   // 걸림이든 확인이든 기계가 띄운 열쇠 — 「기계가 잡았는데 넘김」을 가른다(셈은 걸림만)
    const 글들 = {};   // 열쇠 → 그 열쇠로 처음 걸린 줄의 글(시작 줄이 「무엇이 보였나」로 쓴다)
    for (const g of [].concat(x.걸림 || [])) {
      if (!g || !['걸림', '확인'].includes(g.등급)) continue;
      if (/^못 잼/.test(String(g.글 || ''))) continue;   // 최종본검사가 못 잰 항목(등급 확인 · 글 「못 잼 — …」)은 띄운 것이 아니다
      const k = 규칙열쇠of(x.눈, g, 기준);
      띄운.push(k);
      if (g.등급 !== '걸림') continue;
      열쇠들.push(k);
      if (!(k in 글들)) 글들[k] = String(g.글 || '');
    }
    사건.push({ 때: String(x.때 || ''), 출처: '기계 검사', 단계: x.단계 || '', 눈: x.눈 || '', 판: x.판 || '', 결과: x.결과 || '', 열쇠들: [...new Set(열쇠들)], 띄운: [...new Set(띄운)], 글들 });
  }
  // 옛 기록은 검사이력이 생기기 전의 최종 확인에만 쓴다 — 11-15부터는 최종 확인 묶음도 이력 줄을 남기므로 새 편의 판정은 늘 첫 이력 줄 뒤다.
  // 옛 편에 뒤늦게 이력이 생겨도(올리기 전 검사를 다시 돌림) 그 전 판정의 넘김은 그대로 보인다
  const 이력첫때 = 검사줄.map((x) => String(x.때 || '')).filter(Boolean).sort()[0] || '';
  const 옛띄움 = 옛최종본띄움(dir, 기준);
  for (const f of ['미학맹검.json', '미학맹검_대체.json']) {
    const j = json읽기(path.join(게시, f));
    if (!j) continue;
    for (const s of [].concat(j.낱장 || [])) {
      if (!s || s.판정 !== '기각') continue;
      const 열쇠들 = [...new Set([].concat(s.약점 || []).flatMap(맹검열쇠들))];
      사건.push({ 때: String(j.만든때 || ''), 출처: '맹검', 단계: '맹검', 눈: f.replace('.json', ''), 판: '', 결과: '기각', 열쇠들 });
    }
  }
  if (!사건.length) return null;
  return {
    편: path.basename(dir), 폴더: dir, 길: 이력.길of(dir, 준비), 브랜드: String(준비?.브랜드 || path.basename(dir).split('_')[0] || ''),
    사건, 마지막: 사건.reduce((m, x) => (x.때 > m ? x.때 : m), ''), 옛띄움, 이력첫때,
  };
}

function 모으기(root, 기준, { 부터 = '' } = {}) {
  const out = [];
  for (const d of 편폴더들(root)) {
    const p = 편읽기(d, 기준);
    if (!p) continue;
    if (부터 && p.마지막 < 부터) continue;
    out.push(p);
  }
  return out;
}

// ── 세기 ──
function 이름(열쇠, 기준) {
  const m = /^#(\d+)$/.exec(열쇠);
  if (m) {
    const n = Number(m[1]);
    const 줄 = 기준.줄.get(n);
    const 자리 = (기준.자리.get(n) || '').replace(/\s+/g, ' ');
    return `${열쇠} ${자리.length > 26 ? `${자리.slice(0, 25)}…` : 자리}${줄?.묶음 ? `(${줄.묶음})` : ''}`;
  }
  const h = /^항목:(.+)$/.exec(열쇠);
  if (h) { const x = 기준.항목[h[1]]; return `${h[1]}${x?.묶음 ? `(${x.묶음} · 점검표 줄 없음)` : '(점검표 줄 없음)'}`; }
  return 열쇠;
}

// 앞선 기계 검사 — 최종 확인 단계(최종확인묶음이 부른 최종본 검사)가 아닌 기계 검사가 그 판정보다 먼저 같은 열쇠를 걸었나(GPT 검수 GA3 · GA4)
function 앞서잡음(편, 열쇠, 때) {
  return 편.사건.some((m) => m.출처 === '기계 검사' && m.단계 !== '최종 확인' && m.때 < 때 && m.열쇠들.includes(열쇠));
}

// 앞서 띄움 — 위와 같은 앞선 기계 검사가 걸림이든 확인이든 같은 열쇠를 먼저 띄웠나. 옛 편은 게시/최종본검사.json(옛띄움)도 본다.
// 띄웠는데 최종 확인에서 다시 잡히면 「기계가 잡았는데 넘김」이다 — 검사가 못 잡은 것이 아니라 등급이나 판단으로 넘어온 것(설계 ⑤ 「걸림 무시로 넘긴 횟수」).
// 돌려주는 것은 띄운 검사 이름들(없으면 빈 목록) — 옛 기록은 「최종본검사(옛 기록)」
function 앞서띄운눈(편, 열쇠, 때) {
  const 눈 = 편.사건.filter((m) => m.출처 === '기계 검사' && m.단계 !== '최종 확인' && m.때 < 때 && (m.띄운 || m.열쇠들).includes(열쇠)).map((m) => m.눈 || '모름');
  const 이력전 = !편.이력첫때 || 때 < 편.이력첫때;   // 옛 기록은 검사이력이 생기기 전의 판정에만
  if (이력전 && [].concat(편.옛띄움 || []).some((o) => o.때 < 때 && o.열쇠들.includes(열쇠))) 눈.push('최종본검사(옛 기록)');
  return [...new Set(눈)];
}
function 앞서띄움(편, 열쇠, 때) { return 앞서띄운눈(편, 열쇠, 때).length > 0; }

// 최종놓침: 최종 확인에서 잡혔는데 그 편의 앞선 기계 검사가 먼저 띄우지 못한 때들 — 검사를 올린 날 뒤에도 있으면 「검사가 못 잡음」.
// 넘김: 앞선 기계 검사가 먼저 띄웠는데 최종 확인에서 다시 잡힌 것들({때, 눈}) — 띄운 기록이 곧 검사가 돌던 증거라 날짜로 거르지 않는다
// 일부만 올림: 올린 검사가 모두 「범위: 일부」 — 그 흠의 한 갈래만 잰다(11-15 소리 · 조용구간). 그 검사가 띄우지 못한 흠은 올린 날 전 것도
// 「검사가 일부만 잼」으로 계속 보인다 — 검사 하나를 올렸다고 그 갈래의 못 재는 흠이 시작 줄에서 사라지지 않게(GPT 검수 GA2)
function 일부만(올린) { return 올린.length > 0 && 올린.every((o) => o.범위 === '일부'); }

function 올림상태(열쇠, 기준, 최종놓침, 넘김 = [], 길 = null) {
  const 올린 = 올린검사of(열쇠, 기준, 길).filter((o) => o.날짜);
  if (!올린.length) {
    // 기계 검사 없이 기본값 · 칸 · 검수 질문으로만 올린 흠(「올린곳」) — 「올릴 차례」 대신 올린 자리와, 그 뒤에도 최종 확인에서 잡혔는지를 보인다
    const 곳 = 올린곳of(열쇠, 기준);
    if (!곳.length) return '';
    const 곳첫날 = 곳.map((o) => o.날짜).sort()[0];
    const 곳뒤 = 최종놓침.filter((t) => t.slice(0, 10) > 곳첫날);
    return `기계 검사 없이 올림(${[...new Set(곳.map((o) => o.단계))].join(' · ')} ${곳첫날}~)${곳뒤.length ? ` — 그 뒤에도 최종 확인에서 ${곳뒤.length}번` : ''}`;
  }
  const 첫날 = 올린.map((o) => o.날짜).sort()[0];
  const 검사 = [...new Set(올린.map((o) => o.검사))].join(' · ');
  const 넘김글 = 넘김.length ? ` · 기계가 잡았는데 넘김 ${넘김.length}번` : '';
  // 검사가 그 흠의 일부만 재서 나머지를 기본값 · 검수 질문으로도 올렸으면(「올린곳」, 11-16 끝약함) 그 자리와 그 뒤에 다시 잡힌 횟수를 덧붙인다
  const 곳 = 올린곳of(열쇠, 기준);
  const 곳첫날 = 곳.map((o) => o.날짜).sort()[0];
  const 곳뒤 = 곳.length ? 최종놓침.filter((t) => t.slice(0, 10) > 곳첫날).length : 0;
  const 곳글 = 곳.length ? ` · ${[...new Set(곳.map((o) => o.단계))].join(' · ')}으로도 올림(${곳첫날}~${곳뒤 ? `, 그 뒤 ${곳뒤}번` : ''})` : '';   // 단계는 기본값 · 칸 · 검수 질문(모두 받침)
  if (일부만(올린)) {
    if (최종놓침.length) return `검사가 일부만 잼 — ${검사}(${첫날}~)가 띄우지 못한 흠이 최종 확인에서 ${최종놓침.length}번${넘김글}${곳글}`;
    if (넘김.length) return `기계가 잡았는데 넘김 — ${[...new Set(넘김.flatMap((x) => x.눈))].join(' · ')}가 먼저 띄웠는데 최종 확인에서 ${넘김.length}번 다시 잡힘${곳글}`;
    return `검사로 일부 올림(${검사} ${첫날}~)${곳글}`;
  }
  const 뒤 = 최종놓침.filter((t) => t.slice(0, 10) > 첫날);
  if (뒤.length) return `검사가 못 잡음 — ${검사}(${첫날}~) 뒤에도 최종 확인에서 ${뒤.length}번${넘김글}${곳글}`;
  if (넘김.length) return `기계가 잡았는데 넘김 — ${[...new Set(넘김.flatMap((x) => x.눈))].join(' · ')}가 먼저 띄웠는데 최종 확인에서 ${넘김.length}번 다시 잡힘${곳글}`;
  return `검사로 올림(${검사} ${첫날}~)${곳글}`;
}

// 그 길에서 이력이 있는 편을 최근 순으로 최근 개 — 길세기와 시작줄들이 같은 스무 편을 본다
function 최근편들(편들, 최근 = 20) {
  return [...편들].sort((a, b) => String(b.마지막).localeCompare(String(a.마지막)) || a.편.localeCompare(b.편, 'ko')).slice(0, 최근);
}

// 길: 올린 검사의 「길」로 거를 길(주지 않으면 편들이 모두 한 길일 때 그 길)
function 길세기(편들, 기준, { 최근 = 20, 길 = 한길of(편들) } = {}) {
  const 고른 = 최근편들(편들, 최근);
  const N = 고른.length;
  const 표 = new Map();
  const 칸 = (k) => { if (!표.has(k)) 표.set(k, { 열쇠: k, 최종: new Set(), 기계: new Set(), 맹검: new Set(), 판정: 0, 단계: {}, 최종놓침: [], 넘김: [] }); return 표.get(k); };
  let 미분류 = 0;
  for (const p of 고른) {
    for (const x of p.사건) {
      if (x.미분류) 미분류 += 1;
      for (const k of x.열쇠들) {
        const c = 칸(k);
        // 편은 폴더 경로로 센다 — 깊은 연재 폴더의 같은 이름 회차(A/E01 · B/E01)가 한 편으로 합쳐지지 않게(GPT 검수 GA2)
        if (x.출처 === '맹검') { c.맹검.add(p.폴더); continue; }
        (x.출처 === '최종 확인' ? c.최종 : c.기계).add(p.폴더);
        c.판정 += 1;
        c.단계[x.단계 || '모름'] = (c.단계[x.단계 || '모름'] || 0) + 1;
        if (x.출처 === '최종 확인') {
          const 눈 = 앞서띄운눈(p, k, x.때);
          if (눈.length) c.넘김.push({ 때: x.때, 눈 }); else c.최종놓침.push(x.때);
        }
      }
    }
  }
  const 줄 = [...표.values()].map((c) => {
    const 셀편 = new Set([...c.최종, ...c.기계]);
    // 기계 규칙은 점검표 번호에 이은 것만 올린다(올리기 전 검사의 시각 · 슬롯 같은 운영 규칙이 올릴 차례로 뜨지 않게). 최종 확인의 갈래 이름은 그대로 센다
    const 셀만한 = !c.열쇠.startsWith('규칙:') && !/^C\d{3}$/.test(c.열쇠);
    const 차례 = 셀만한 && 셀편.size >= 올릴편수 && N > 0 && 셀편.size / N > 올릴비율 - 1e-9;
    const 상태 = 올림상태(c.열쇠, 기준, c.최종놓침, c.넘김, 길);
    return { 열쇠: c.열쇠, 이름: 이름(c.열쇠, 기준), 편수: 셀편.size, 최종편: c.최종.size, 기계편: c.기계.size, 맹검편: c.맹검.size, 판정: c.판정, 단계: c.단계,
      넘김: c.넘김.length, 올릴차례: 차례, 상태: 상태 || (차례 ? '올릴 차례' : '') };
  }).sort((a, b) => b.편수 - a.편수 || b.판정 - a.판정 || b.맹검편 - a.맹검편 || a.열쇠.localeCompare(b.열쇠, 'ko'));
  return { 편수: N, 전체편수: 편들.length, 편: 고른.map((p) => p.편), 줄, 미분류, 숫자: 숫자내기(고른) };
}

// 길마다 낼 수 있는 숫자만 — 없으면 「자료 없음」
function 숫자내기(편들) {
  const 이력편 = 편들.map((p) => ({ p, 판정: p.사건.filter((x) => x.출처 === '최종 확인' && !x.옛기록).sort((a, b) => a.때.localeCompare(b.때)) }))
    .filter((x) => x.판정.length);
  const 옛만 = 편들.filter((p) => p.사건.some((x) => x.옛기록)).length;
  const 첫통과 = 이력편.filter((x) => OPEN.has(x.판정[0].결과)).length;
  const 판정합 = 이력편.reduce((s, x) => s + x.판정.length, 0);
  // 맨 끝 관문: 최종 확인에서 잡힌 번호 흠 가운데 그 편의 앞선 기계 검사가 먼저 잡지 못한 몫 — 두 기록이 다 있는 편만
  let 끝흠 = 0, 끝처음 = 0, 끝편 = 0;
  for (const p of 편들) {
    // 최종 확인 단계에서 돈 기계 검사(최종확인묶음의 최종본 검사)는 맨 끝 관문의 눈이라 「앞선 검사」로 세지 않는다(GPT 검수 GA3)
    const 기계 = p.사건.filter((x) => x.출처 === '기계 검사' && x.단계 !== '최종 확인');
    const 최종 = p.사건.filter((x) => x.출처 === '최종 확인' && x.열쇠들.length);
    if (!기계.length || !최종.length) continue;
    끝편 += 1;
    for (const f of 최종) {
      for (const k of f.열쇠들.filter((k) => k.startsWith('#'))) {
        끝흠 += 1;
        if (!앞서잡음(p, k, f.때)) 끝처음 += 1;
      }
    }
  }
  // 기계가 잡았는데 넘김(설계 ⑤ 「걸림 무시로 넘긴 횟수」): 앞선 기계 검사가 걸림이나 확인으로 먼저 띄웠는데 최종 확인에서 다시 잡힌 흠 — 기계 기록이 있는 편만
  let 넘김수 = 0, 넘김편 = 0, 기계기록편 = 0;
  for (const p of 편들) {
    if (!p.사건.some((x) => x.출처 === '기계 검사' && x.단계 !== '최종 확인') && ![].concat(p.옛띄움 || []).length) continue;
    기계기록편 += 1;
    let n = 0;
    for (const f of p.사건.filter((x) => x.출처 === '최종 확인')) n += f.열쇠들.filter((k) => 앞서띄움(p, k, f.때)).length;
    if (n) { 넘김수 += n; 넘김편 += 1; }
  }
  const 비 = (a, b) => `${a}/${b}(${Math.round((a / b) * 100)}%)`;
  return {
    넘김: 기계기록편 ? `${넘김수}번(${넘김편}편)` : '자료 없음',
    넘김_분모: 기계기록편 ? `앞선 기계 검사 기록(검사이력 · 옛 편은 게시/최종본검사.json)이 있는 편 ${기계기록편}개` : '앞선 기계 검사 기록이 있는 편이 아직 없다',
    첫판통과율: 이력편.length ? 비(첫통과, 이력편.length) : '자료 없음',
    첫판통과율_분모: `최종 확인 이력이 있는 편 ${이력편.length}개${옛만 ? ` · 옛 기록(마지막 판정 하나)만 있는 편 ${옛만}개는 뺌` : ''}`,
    편당판정수: 이력편.length ? (판정합 / 이력편.length).toFixed(1) : '자료 없음',
    맨끝비율: 끝흠 ? 비(끝처음, 끝흠) : '자료 없음',
    맨끝비율_분모: 끝편 ? `검사이력과 최종 확인 흠이 둘 다 있는 편 ${끝편}개` : '검사이력과 최종 확인 흠이 둘 다 있는 편이 아직 없다',
  };
}

// 유호님 말씀(모음) — 번호별 횟수(같은 뜻 포함). 편 · 길이 없어 올릴 차례 셈 밖
function 말씀세기(기준) {
  const 셈 = new Map();
  for (const x of [].concat(기준.모음.지적 || [])) {
    if (!Number.isInteger(x?.점검표행)) continue;
    const k = `#${x.점검표행}`;
    셈.set(k, (셈.get(k) || 0) + 1 + [].concat(x['같은 뜻'] || []).length);
  }
  return [...셈.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko', { numeric: true }));
}

// 유호님이 같은 뿌리의 지적을 다시 하신 횟수(설계 ⑤, 11-16) — 점검표 줄의 말씀 칸(셋째 칸)에서 날짜(MM-DD · YYYY-MM-DD)를 읽어
// 흠갈래.json의 묶음으로 모은다. 묶음마다 처음 말씀 날짜, 그 뒤에 붙은 날짜 수와 줄, 가장 최근 날짜. AI 없이 센다.
// 「(심사에서 나옴)」으로 시작하는 줄은 유호님 말씀이 아니라 빼고, 날짜를 못 읽은 줄은 세지 않고 몇 줄인지만 낸다. 장부 본문에만 보인다(시작 줄에는 넣지 않는다).
const 말씀날 = /(?<![\d:.~/-])(?:20\d\d-)?(\d{1,2})-(\d{1,2})(?![\d:])/g;
function 말씀다시세기(기준, { 상한 = 10 } = {}) {
  const 묶음별 = new Map();
  let 못읽음 = 0, 심사 = 0, 묶음없음 = 0, 읽은줄 = 0;
  for (const [번호, 칸] of [...(기준.말씀칸 || new Map())].sort((a, b) => a[0] - b[0])) {
    if (/^\(심사에서 나옴\)/.test(칸)) { 심사 += 1; continue; }
    const 날들 = [...new Set([...String(칸).matchAll(말씀날)]
      .map((m) => [Number(m[1]), Number(m[2])]).filter(([월, 일]) => 월 >= 1 && 월 <= 12 && 일 >= 1 && 일 <= 31)
      .map(([월, 일]) => `${String(월).padStart(2, '0')}-${String(일).padStart(2, '0')}`))];
    if (!날들.length) { 못읽음 += 1; continue; }
    const 묶음 = 기준.줄.get(번호)?.묶음;
    if (!묶음) { 묶음없음 += 1; continue; }
    읽은줄 += 1;
    if (!묶음별.has(묶음)) 묶음별.set(묶음, []);
    for (const 날 of 날들) 묶음별.get(묶음).push({ 번호, 날 });
  }
  const 묶음들 = [...묶음별].map(([묶음, xs]) => {
    const 날순 = [...xs].sort((a, b) => a.날.localeCompare(b.날) || a.번호 - b.번호);
    const 처음 = 날순[0].날;
    const 뒤 = 날순.filter((x) => x.날 > 처음);
    return { 묶음, 이름: 기준.묶음이름[묶음] || 기준.후보[묶음]?.이름 || '', 처음, 다시: 뒤.length,
      줄: [...new Set(뒤.map((x) => x.번호))], 날: 뒤.map((x) => `#${x.번호} ${x.날}`), 최근: 날순[날순.length - 1].날 };
  }).sort((a, b) => b.다시 - a.다시 || b.최근.localeCompare(a.최근) || a.묶음.localeCompare(b.묶음, 'ko'));
  return { 묶음: 묶음들.slice(0, 상한), 묶음수: 묶음들.length, 읽은줄, 못읽음, 심사, 묶음없음 };
}

// ── 시작할 때 읽힘(설계 ④ · 2단계) ──
const 시작상한 = 3;
const 넘김상한 = 2;   // 「검사가 띄웠는데 넘긴 흠」 묶음의 줄 수 — 못 잡는 흠 셋과 따로 센다
const 시작표지 = '[흠 장부]';
// 최종 확인 메모에서 그 흠을 적은 조각을 고르는 낱말 — 보이기만 한다. 셈은 갈래 · 번호로만 한다(메모로 갈래를 어림하지 않는다).
const 메모낱말 = {
  멈춘화면: ['멈춘', '멈춤', '멈춰', '그대로', '정지', '머묾', '머문'],
  끝약함: ['끝', '꼬리', '마지막', '센 그림'],
  사람굳음: ['굳', '멈춤', '멈춰', '거의 그대로', '머묾', '머문', '정지', '입이'],
  인물튐: ['얼굴', '다른 사람', '머리', '체격', '갸름', '둥글', '화장', '안경알'],
  소품튐: ['넥타이', '안경', '소매', '옷', '소품', '바지', '구두'],
  점프컷: ['점프', '같은 판', '튐', '튄', '잘라'],
  같은구도반복: ['같은 구도', '같은 앵글', '같은 판', '되풀이', '반복', '당겨 잡은'],
  글자표: ['글', '표', '자막', '읽', '줄', 'px'],
  숫자불일치: ['숫자', 'GB', '원', '건', '%', '맞지', '다르'],
  사실: ['사실', '출처', '틀', '아니'],
  이해안됨: ['못 읽', '안 읽', '이해', '모르', '읽힌', '보일 수', '뜻'],
  소리: ['음량', '무음', '소리', '음악', '말 없', '조용', 'dB', '배경음', '받아쓰기', '말이'],
  화면작음어두움: ['작', '어두', '안 읽'],
};

function 끔() { return String(process.env.SYNK_FLAW_LEDGER || '').trim().toLowerCase() === 'off'; }
function 자료자리(폴더) {
  if (폴더) return path.resolve(폴더);
  if (process.env.SYNK_FLAW_LEDGER_DIR) return path.resolve(process.env.SYNK_FLAW_LEDGER_DIR);
  return path.join(공용작업본(REPO), 'docs', '마케팅');
}
// docs/마케팅/<무엇> 아래인가 — 장부는 docs/마케팅의 편만 센다. 시험의 임시 폴더나 .tmp의 공모 폴더에는 아무것도 내지 않는다
function 마케팅아래(p) {
  const 조각 = path.resolve(String(p)).split(/[\\/]+/).filter(Boolean);
  return 조각.some((x, i) => x.toLowerCase() === 'docs' && 조각[i + 1] === '마케팅' && i + 2 < 조각.length);
}

// 시작 줄을 낼 열쇠인가 — 번호(올린 검사 목록과 함께) · 묶음이 있는 갈래 이름만. 「기타」 · 모르는 이름 · 기계 규칙 · 맹검 모음 번호는 null
function 시작종류(열쇠, 기준, 길 = null) {
  const m = /^#(\d+)$/.exec(열쇠);
  if (m) return { 번호: Number(m[1]), 올린: 올린검사of(열쇠, 기준, 길), 곳: 올린곳of(열쇠, 기준) };
  const h = /^항목:(.+)$/.exec(열쇠);
  if (h && 기준.항목[h[1]]?.묶음) return { 번호: null, 올린: 올린검사of(열쇠, 기준, 길), 곳: 올린곳of(열쇠, 기준) };
  return null;
}

// 메모 → 흠 조각들. 「큰 흠:」 · 「작은 흠:」 · 「흠은 이렇다」 뒤만 보고(앞은 무엇을 봤는지의 목록), 괄호 · 낫표 밖의 「 · 」 · 「. 」 · 「 — 」 · 「; 」에서 자른다
function 흠조각(메모) {
  let s = String(메모 || '');
  const m = /(?:큰|작은)\s*흠\s*(?:\([^)]*\))?\s*[:：]|흠은\s*이렇다[.:：]?/.exec(s);
  if (m) s = s.slice(m.index + m[0].length);
  const out = [];
  let 깊이 = 0, 시작 = 0;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if ('(「“『'.includes(ch)) { 깊이 += 1; continue; }
    if (')」”』'.includes(ch)) { 깊이 = Math.max(0, 깊이 - 1); continue; }
    if (깊이) continue;
    const 끊 = [' · ', ' — ', '. ', '; '].find((t) => s.startsWith(t, i));
    if (끊) { out.push(s.slice(시작, i)); 시작 = i + 끊.length; i += 끊.length - 1; }
  }
  out.push(s.slice(시작));
  return out.map((t) => t.replace(/^\s*(?:남은\s*)?(?:큰|작은)\s*흠\s*[:：]\s*/, '').replace(/[.\s]+$/, '').trim())
    .filter((t) => t.length >= 4 && !/^(?:남은\s*)?(?:큰|작은)?\s*흠은?\s*없다$/.test(t));
}

// 그 열쇠의 메모 낱말 — 번호면 그 번호에 이은 갈래 이름들의 낱말, 없으면 점검표 줄 이름의 두 글자 넘는 낱말
function 열쇠낱말(열쇠, 기준) {
  const h = /^항목:(.+)$/.exec(열쇠);
  if (h) return 메모낱말[h[1]] || [];
  const m = /^#(\d+)$/.exec(열쇠);
  if (!m) return [];
  const n = Number(m[1]);
  const 이름들 = Object.entries(기준.항목).filter(([, x]) => x && x.번호 === n).map(([k]) => k);
  const 낱말 = [...new Set(이름들.flatMap((k) => 메모낱말[k] || []))];
  if (낱말.length) return 낱말;
  return [...new Set(String(기준.자리.get(n) || '').split(/[^가-힣A-Za-z0-9]+/).filter((w) => w.length >= 2))];
}

const 줄임 = (t, n = 90) => { const s = 이력.글다듬기(t); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

// 가장 최근에 걸린 사건에서 보인 것 한 줄 → { 글, 출처: '검사 글' · '메모' · '메모 첫 흠' · '' }
function 보인글(x, 열쇠, 기준) {
  if (x.출처 === '기계 검사') { const g = (x.글들 || {})[열쇠] || ''; return g ? { 글: 줄임(g), 출처: '검사 글' } : { 글: '', 출처: '' }; }
  const 조각들 = 흠조각(x.메모);
  const 낱말 = 열쇠낱말(열쇠, 기준);
  let 고른 = null, 점수 = 0;
  for (const t of 조각들) {
    const n = 낱말.filter((w) => t.includes(w)).length;
    if (n > 점수) { 점수 = n; 고른 = t; }
  }
  if (고른) return { 글: 줄임(고른), 출처: '메모' };
  return 조각들.length ? { 글: 줄임(조각들[0]), 출처: '메모 첫 흠' } : { 글: '', 출처: '' };
}

const 한국날 = (t) => { const d = new Date(t); return Number.isNaN(d.getTime()) ? '' : new Date(d.getTime() + 9 * 36e5).toISOString().slice(5, 10); };

// 그 길(편들은 이미 그 길의 편)에서 아직 검사가 받지 못하는 흠 — 셋 이하
function 시작줄들(편들, 기준, { 최근 = 20, 상한 = 시작상한, 뿌리 = '', 길 = 한길of(편들) } = {}) {
  const s = 길세기(편들, 기준, { 최근, 길 });
  const 고른 = 최근편들(편들, 최근);
  const 후보 = [];
  const 넘김후보 = [];   // 검사가 먼저 띄웠는데 넘겨서 최종 확인에서 다시 잡힌 흠 — 못 잡는 흠과 따로 낸다
  const 편글 = (p) => (뿌리 ? path.relative(뿌리, p.폴더).split(path.sep).join('/') : p.편);
  for (const c of s.줄) {
    if (!c.편수) continue;   // 맹검에만 나온 열쇠
    const 종류 = 시작종류(c.열쇠, 기준, 길);
    if (!종류) continue;
    const 사건들 = [];
    for (const p of 고른) {
      for (const x of p.사건) {
        if (x.출처 === '맹검' || !x.열쇠들.includes(c.열쇠)) continue;
        const 눈 = x.출처 === '최종 확인' ? 앞서띄운눈(p, c.열쇠, x.때) : [];   // 그 판정 전에 이 흠을 띄운 검사들
        사건들.push({ p, x, 눈, 놓침: x.출처 === '최종 확인' && !눈.length });   // 기계가 먼저 띄웠으면 검사가 받는 흠이다
      }
    }
    let 까닭 = '올린 검사 없음', 볼 = 사건들;
    const 검사들 = [...new Set(종류.올린.map((o) => o.검사).filter(Boolean))];
    if (종류.올린.length) {
      // 올린 검사가 있으면 그 뒤 최종 확인에서 앞선 기계 검사 없이 다시 잡힌 것만(올림상태와 같은 셈 — 날짜를 모르면 언제든).
      // 「범위: 일부」만 올린 갈래는 날짜와 상관없이 기계가 띄우지 못한 최종 확인 흠을 모두 본다(GPT 검수 GA2)
      const 일부 = 일부만(종류.올린.filter((o) => o.날짜));
      const 첫날 = 일부 ? '' : 종류.올린.map((o) => o.날짜).filter(Boolean).sort()[0] || '';
      볼 = 사건들.filter((e) => e.놓침 && (!첫날 || e.x.때.slice(0, 10) > 첫날));
      if (!볼.length) {
        // 못 잡은 것은 없는데 검사가 띄운 것을 넘겨서 다시 잡힌 것 — 띄운 기록이 곧 검사가 돌던 증거라 날짜로 거르지 않는다(올림상태와 같다)
        const 넘긴 = 사건들.filter((e) => e.눈.length);
        if (넘긴.length) {
          const 끝 = 넘긴.reduce((m, e) => (!m || e.x.때 > m.x.때 ? e : m), null);
          const 보임 = 보인글(끝.x, c.열쇠, 기준);
          넘김후보.push({
            열쇠: c.열쇠, 번호: 종류.번호, 이름: c.이름, 편수: new Set(넘긴.map((e) => e.p.폴더)).size, 넘김: 넘긴.length,
            띄운검사: [...new Set(넘긴.flatMap((e) => e.눈))],
            ...(할것of(종류).length ? { 할것: 할것of(종류) } : {}),
            최근: { 편: 편글(끝.p), 때: 끝.x.때, 출처: 끝.x.출처, 결과: 끝.x.결과, 글: 보임.글, 글출처: 보임.출처 },
          });
        }
        continue;
      }
      까닭 = 일부 ? '검사가 일부만 잼' : '검사가 못 잡음';
    }
    const 최근사건 = 볼.reduce((m, e) => (!m || e.x.때 > m.x.때 ? e : m), null);
    const 보임 = 보인글(최근사건.x, c.열쇠, 기준);
    후보.push({
      열쇠: c.열쇠, 번호: 종류.번호, 이름: c.이름, 편수: c.편수, 판정: c.판정, 까닭, 올린검사: 검사들,
      ...(까닭 !== '올린 검사 없음' ? { 놓침: 볼.length } : {}),
      ...(까닭 === '올린 검사 없음' && 종류.곳.length ? { 올린곳: [...new Set(종류.곳.map((o) => o.단계))] } : {}),
      ...(할것of(종류).length ? { 할것: 할것of(종류) } : {}),
      최근: { 편: 편글(최근사건.p), 때: 최근사건.x.때, 출처: 최근사건.x.출처,
        ...(최근사건.x.출처 === '최종 확인' ? { 결과: 최근사건.x.결과 } : { 눈: 최근사건.x.눈, 단계: 최근사건.x.단계 }), 글: 보임.글, 글출처: 보임.출처 },
    });
  }
  // 열쇠 순서는 'ko'로 못 박는다 — 기본 로캘에 맡기면 이 PC(ko-KR)와 Linux CI(en-US)에서 한글과 영문이 섞인 열쇠의 순서가 갈린다(11-16 지금상태 시험)
  후보.sort((a, b) => b.편수 - a.편수 || b.판정 - a.판정 || String(b.최근.때).localeCompare(String(a.최근.때)) || a.열쇠.localeCompare(b.열쇠, 'ko'));
  넘김후보.sort((a, b) => b.편수 - a.편수 || b.넘김 - a.넘김 || String(b.최근.때).localeCompare(String(a.최근.때)) || a.열쇠.localeCompare(b.열쇠, 'ko'));
  return { 편수: s.편수, 줄: 후보.slice(0, 상한).map(({ 판정, ...x }) => x), 넘김줄: 넘김후보.slice(0, 넘김상한) };
}

// 편 폴더 · 컷표 파일 → 그 편의 길. 파일이면 위로 여섯 층까지 편 폴더(게시/준비.json · 컷표.json · 컷순서.json)를 찾는다
function 시작길(입력, 편들) {
  const abs = path.resolve(String(입력));
  let 파일 = false;
  try { 파일 = fs.statSync(abs).isFile(); } catch { /* 아직 없는 새 편 폴더 */ }
  let 편 = null;
  for (let d = 파일 ? path.dirname(abs) : abs, i = 0; i < 6; i += 1) {
    if (이력.편인가(d)) { 편 = d; break; }
    if (path.basename(d) === '마케팅' || path.dirname(d) === d) break;
    d = path.dirname(d);
  }
  if (!편) {
    if (파일) return { 까닭: '컷표 파일 곁에 편 폴더(게시/준비.json · 컷표.json · 컷순서.json)가 없다' };
    편 = abs;
  }
  const 준비 = json읽기(path.join(편, '게시', '준비.json'));
  const 길 = 이력.길of(편, 준비);
  const 이름 = path.basename(편);
  if (길 !== '그래픽') return { 길, 근거: 길 === 'LAB' ? 'LAB 브랜드' : '컷표', 편: 이름 };
  if (파일 && /^(컷표|컷순서).*\.json$/i.test(path.basename(abs))) return { 길: '컷표영상', 근거: '컷표', 편: 이름 };
  // 컷표가 아직 없는 새 편 — 같은 브랜드의 가장 최근 편이 간 길(그래픽으로 끝날 편인지 컷표를 쓸 편인지 아직 모른다)
  const 브랜드 = String(준비?.브랜드 || 이름.split('_')[0] || '').trim();
  const 앞 = 편들.filter((p) => 브랜드 && p.브랜드 === 브랜드 && path.resolve(p.폴더) !== path.resolve(편))
    .sort((a, b) => String(b.마지막).localeCompare(String(a.마지막)))[0];
  if (앞 && 앞.길 !== '그래픽') return { 길: 앞.길, 근거: '같은 브랜드 최근 편', 편: 이름 };
  return { 길: '그래픽', 근거: 앞 ? '같은 브랜드 최근 편' : '컷표 없음', 편: 이름 };
}

// 시작 — { 길, 근거, 편?, 편수, 줄: [...] } 또는 { 줄: [], 까닭 }. 던지지 않는다(못 읽은 것은 「까닭」에)
function 시작(입력, { 폴더 = '', 최근 = 20, 상한 = 시작상한 } = {}) {
  try {
    if (끔()) return { 줄: [], 까닭: 'SYNK_FLAW_LEDGER=off' };
    const s = String(입력 || '').trim();
    if (!s) return { 줄: [], 까닭: '편 폴더 · 컷표 파일 · 길 가운데 하나를 준다' };
    const 길이름 = 길들.includes(s) ? s : null;
    if (!길이름 && !마케팅아래(s)) return { 줄: [], 까닭: '편 폴더가 docs/마케팅 아래가 아니다' };
    const 뿌리 = 자료자리(폴더);
    const 기준 = 기준읽기();
    const 편들 = 모으기(뿌리, 기준);
    const g = 길이름 ? { 길: 길이름, 근거: '길 이름' } : 시작길(s, 편들);
    if (!g.길) return { 줄: [], 까닭: g.까닭 };
    const r = 시작줄들(편들.filter((p) => p.길 === g.길), 기준, { 최근, 상한, 뿌리, 길: g.길 });
    return { 길: g.길, 근거: g.근거, ...(g.편 ? { 편: g.편 } : {}), 편수: r.편수, 줄: r.줄, ...(r.넘김줄.length ? { 넘김줄: r.넘김줄 } : {}) };
  } catch (e) {
    return { 줄: [], 까닭: `장부를 못 읽음 — ${String(e && e.message || e).slice(0, 200)}` };
  }
}

// 시작 결과 → 사람이 읽는 글. 낼 것이 없으면 빈 글
function 시작글(r) {
  const 못잡음 = r && Array.isArray(r.줄) ? r.줄 : [];
  const 넘김 = r && Array.isArray(r.넘김줄) ? r.넘김줄 : [];
  if (!못잡음.length && !넘김.length) return '';
  const 길글 = r.근거 === '같은 브랜드 최근 편' ? `${r.길}(컷표가 아직 없어 같은 브랜드 최근 편의 길)` : r.길;
  const 글of = (c) => (c.최근.글 ? `: ${c.최근.글출처 === '메모 첫 흠' ? '메모 첫 흠 ' : ''}「${c.최근.글}」` : '');
  const 줄 = [];
  if (못잡음.length) 줄.push(`${시작표지} ${길글} · 최근 ${r.편수}편에서 검사가 아직 못 잡는 흠 ${못잡음.length}개 — 이 편을 만들 때 직접 본다`);
  for (const c of 못잡음) {
    const 까닭 = c.까닭 === '검사가 못 잡음' ? `검사(${c.올린검사.join(' · ')})를 지나 최종 확인에서 ${c.놓침}번 잡힘`
      : c.까닭 === '검사가 일부만 잼' ? `검사(${c.올린검사.join(' · ')})는 일부만 재고, 띄우지 못한 흠이 최종 확인에서 ${c.놓침}번 잡힘`
      : c.올린곳 ? `재는 검사 없음(올린 자리: ${c.올린곳.join(' · ')} — 눈으로 본다)` : '재는 검사 없음';
    const 어디 = c.최근.출처 === '최종 확인' ? `최종 확인 「${c.최근.결과}」` : `${c.최근.눈}${c.최근.단계 ? ` · ${c.최근.단계}` : ''}`;
    줄.push(`  · ${c.이름} — ${c.편수}편 · ${까닭} · 가장 최근 ${c.최근.편}(${한국날(c.최근.때)} ${어디})${글of(c)}`);
    if (c.할것 && c.할것.length) 줄.push(`    → 할 것: ${c.할것.join(' / ')}`);
  }
  // 검사가 먼저 띄웠는데 넘겨서 최종 확인에서 다시 잡힌 흠 — 검사는 받는다. 넘기지 말라고 알린다(머리 꼴은 tools/영상세션재기.js 흠시작식이 센다)
  if (넘김.length) 줄.push(`${시작표지} ${길글} · 최근 ${r.편수}편에서 검사가 띄웠는데 넘겨서 최종 확인에서 다시 잡힌 흠 ${넘김.length}개 — 검사가 띄우면 넘기기 전에 그 자리를 고친다`);
  for (const c of 넘김) {
    줄.push(`  · ${c.이름} — ${c.편수}편 · ${c.띄운검사.join(' · ')}가 먼저 띄웠는데 최종 확인에서 ${c.넘김}번 다시 잡힘 · 가장 최근 ${c.최근.편}(${한국날(c.최근.때)} 최종 확인 「${c.최근.결과}」)${글of(c)}`);
    if (c.할것 && c.할것.length) 줄.push(`    → 할 것: ${c.할것.join(' / ')}`);
  }
  return 줄.join('\n');
}

function 시작main(argv) {
  const 값자리 = new Set(['--폴더', '--최근'].map((n) => argv.indexOf(n)).filter((i) => i >= 0).map((i) => i + 1));
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const 자리값 = argv.filter((a, i) => !값자리.has(i) && !a.startsWith('--'));
  const 모르는 = argv.filter((a, i) => !값자리.has(i) && a.startsWith('--') && !['--json', '--폴더', '--최근'].includes(a));
  if (자리값.length !== 1 || 모르는.length) {
    console.error('사용: node tools/흠장부.js 시작 <편 폴더 | 컷표 파일 | 길(컷표영상 · 그래픽 · LAB)> [--최근 20] [--json] [--폴더 <docs/마케팅>]');
    return 2;
  }
  const 최근 = Number(opt('--최근')) > 0 ? Math.floor(Number(opt('--최근'))) : 20;
  const r = 시작(자리값[0], { 폴더: opt('--폴더') || '', 최근 });
  if (argv.includes('--json')) { console.log(JSON.stringify(r, null, 1)); return 0; }
  const 글 = 시작글(r);
  if (글) console.log(글);
  return 0;
}

function main(argv) {
  if (argv[0] === '시작') return 시작main(argv.slice(1));
  const 값자리 = new Set(['--일수', '--폴더', '--최근'].map((n) => argv.indexOf(n)).filter((i) => i >= 0).map((i) => i + 1));
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const 거르기 = argv.find((a, i) => !값자리.has(i) && !a.startsWith('--')) || '';
  const 일수 = Number(opt('--일수')) > 0 ? Number(opt('--일수')) : 0;
  const 최근 = Number(opt('--최근')) > 0 ? Math.floor(Number(opt('--최근'))) : 20;
  const root = opt('--폴더') ? path.resolve(opt('--폴더')) : path.join(공용작업본(REPO), 'docs', '마케팅');
  const 기준 = 기준읽기();
  const 부터 = 일수 ? new Date(Date.now() - 일수 * 86400000).toISOString() : '';
  let 편들 = 모으기(root, 기준, { 부터 });
  if (거르기) {
    if (길들.includes(거르기)) 편들 = 편들.filter((p) => p.길 === 거르기);
    else if (편들.some((p) => p.브랜드 === 거르기)) 편들 = 편들.filter((p) => p.브랜드 === 거르기);
    else { console.error(`길(${길들.join(' · ')})이나 기록이 있는 브랜드 가운데 하나다: ${거르기}`); return 2; }
  }
  const 길별 = {};
  for (const 길 of 길들) {
    const xs = 편들.filter((p) => p.길 === 길);
    if (xs.length) 길별[길] = 길세기(xs, 기준, { 최근, 길 });
  }
  const 말씀 = 말씀세기(기준);
  const 다시 = 말씀다시세기(기준);
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ 거르기: 거르기 || '모두', 일수: 일수 || '제한 없음', 최근, 길: 길별, 말씀: Object.fromEntries(말씀), 말씀다시: 다시 }, null, 2));
    return 0;
  }
  console.log(`흠 장부 · ${거르기 || '모든 길'} · 길마다 이력이 있는 최근 ${최근}편${일수 ? ` · 지난 ${일수}일` : ''} · 열쇠는 슬롭 점검표 번호`);
  if (!Object.keys(길별).length) { console.log('  기록이 있는 편이 없다.'); return 0; }
  for (const [길, s] of Object.entries(길별)) {
    console.log(`[${길}] 편 ${s.편수}개(기록 있는 편 ${s.전체편수}) · 첫 판 통과율 ${s.숫자.첫판통과율} · 편당 판정 ${s.숫자.편당판정수} · 맨 끝 관문에서 처음 잡힌 흠 ${s.숫자.맨끝비율} · 기계가 잡았는데 넘김 ${s.숫자.넘김}`);
    const 보일 = s.줄.filter((c) => c.편수 > 0 && !c.열쇠.startsWith('규칙:'));
    for (const c of 보일.slice(0, 12)) {
      const 맹 = c.맹검편 ? ` · 맹검 기각 ${c.맹검편}편(세기만)` : '';
      console.log(`  ${c.이름} — ${c.편수}편(최종 확인 ${c.최종편} · 기계 ${c.기계편})${맹}${c.상태 ? ` — ${c.상태}` : ''}`);
    }
    const 규칙 = s.줄.filter((c) => c.열쇠.startsWith('규칙:') && c.편수 > 0).slice(0, 6);
    if (규칙.length) console.log(`  점검표 번호에 안 이은 기계 규칙: ${규칙.map((c) => `${c.열쇠.replace(/^규칙:/, '')} ${c.편수}편`).join(' · ')}`);
    const 맹만 = s.줄.filter((c) => c.편수 === 0 && c.맹검편 > 0).slice(0, 6);
    if (맹만.length) console.log(`  맹검 기각에만 나온 번호(세기만): ${맹만.map((c) => `${c.열쇠} ${c.맹검편}편`).join(' · ')}`);
    if (s.미분류) console.log(`  미분류(갈래 없이 쓴 옛 판정) ${s.미분류}건`);
    console.log(`  숫자 분모: 첫 판 통과율 — ${s.숫자.첫판통과율_분모} · 맨 끝 — ${s.숫자.맨끝비율_분모} · 넘김 — ${s.숫자.넘김_분모}`);
  }
  if (다시.묶음.length) {
    console.log(`같은 뿌리의 지적을 다시 하신 횟수(점검표 말씀 칸의 날짜를 흠갈래 묶음으로 모음 · AI 없이 셈 · 묶음 ${다시.묶음수}개 가운데 ${다시.묶음.length}개):`);
    for (const g of 다시.묶음) {
      const 날글 = g.날.length ? `(${g.날.slice(0, 8).join(' · ')}${g.날.length > 8 ? ` 외 ${g.날.length - 8}` : ''})` : '';
      console.log(`  ${g.묶음} ${줄임(g.이름, 28)} — 처음 ${g.처음} · 그 뒤 ${g.다시}번 · 줄 ${g.줄.length}개${날글} · 가장 최근 ${g.최근}`);
    }
    console.log(`  읽은 줄 ${다시.읽은줄}개 · 날짜를 못 읽은 줄 ${다시.못읽음}개(세지 않음)${다시.묶음없음 ? ` · 묶음이 없는 줄 ${다시.묶음없음}개` : ''} · 「(심사에서 나옴)」 줄 ${다시.심사}개는 유호님 말씀이 아니라 뺐다`);
  }
  if (말씀.length) console.log(`유호님 말씀(슬롭점검_모음.json ${기준.모음.만든때 || '날짜 모름'} 판 — 그 뒤 말씀은 이 숫자에 없다 · 편 · 길과 이어진 기록이 없어 올릴 차례 셈 밖): ${말씀.slice(0, 8).map(([k, n]) => `${k} ${n}번`).join(' · ')}`);
  if (Object.values(길별).some((s) => s.줄.some((c) => c.상태 === '올릴 차례'))) {
    console.log('「올릴 차례」는 docs/_ops/트랙.md에 한 줄로 남기고 작업 세션이 검수와 함께 올린다(기본값 → 기계 검사 → 칸 → 검수 질문). 편을 닫는 세션과 최종 확인 세션은 올리지 않는다.');
  }
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { 기준읽기, 갈래열쇠, 맹검열쇠들, 편폴더들, 편읽기, 모으기, 길세기, 숫자내기, 말씀세기, 말씀다시세기, 올린검사of, 올림상태, main, 올릴편수, 올릴비율,
  최근편들, 시작, 시작글, 시작줄들, 시작길, 흠조각, 보인글, 마케팅아래, 시작상한, 시작표지 };
