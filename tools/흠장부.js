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
 *
 * 읽는 것(편 폴더마다, docs/마케팅 아래 네 층까지):
 *   게시/최종확인_이력.jsonl  최종 확인 판정(tools/lib/최종확인.js). 이력이 없는 옛 편은 게시/최종확인.json의 마지막 판정 하나(「옛 기록」).
 *   게시/검사이력.jsonl       기계 검사가 돌 때마다 남긴 줄(tools/lib/검사이력.js) — 등급 「걸림」만 흠으로 센다(「확인」은 기계가 확신 못 한 것).
 *   게시/미학맹검.json · 미학맹검_대체.json  기각 화면의 약점 번호 — [K7]은 점검표 7, [C10]과 [C010]은 모음 지적 C010. 세기만 한다.
 *   docs/마케팅/제작양식/슬롭점검_모음.json  유호님 말씀 — 편과 길이 없는 기록이라 번호별 횟수만 보인다.
 *   docs/마케팅/제작양식/흠갈래.json         번호 → 묶음 · 올린 검사, 최종 확인 갈래 이름 → 번호, 검사 규칙 → 번호.
 * 열쇠: 점검표 번호(「#26」). 번호가 없는 갈래 이름은 「항목:이름」, 번호에 안 이은 기계 규칙은 「규칙:검사:이름」으로 센다.
 *   갈래 없이 쓴 옛 판정은 「미분류」로만 센다 — 메모 글로 갈래를 어림하지 않는다(어림이 「음량 −14.6 LUFS」 같은 잰 값을 소리 흠으로 셌다).
 * 올릴 차례: 최종 확인과 기계 검사에서 온 흠만 센다. 그 길에서 이력이 있는 편을 최근 순으로 스무 개(--최근) 골라, 그 가운데
 *   세 편 이상이고 15% 넘게 난 열쇠(기계 규칙은 점검표 번호에 이은 것만). 미학 맹검 기각은 권고라(결정 11-12) 세기만 하고 셈에 넣지 않는다.
 *   올릴 차례는 트랙에 한 줄로 남기고 작업 세션이 검수와 함께 올린다 — 편을 닫는 세션과 최종 확인 세션은 올리지 않는다(설계 ③).
 * 숫자(길마다): 최종 확인 첫 판 통과율 · 편당 판정 수 · 맨 끝 관문에서 처음 잡힌 흠의 비율. 기록이 없으면 「자료 없음」이다.
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
  try {
    for (const l of fs.readFileSync(path.join(repo, 'docs', '마케팅', '제작양식', '광고영상_슬롭점검표.md'), 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\| (\d+) \| ([^|]*)\|/);
      if (m) 자리.set(Number(m[1]), m[2].trim());
    }
  } catch { /* 이름 없이 번호만 보인다 */ }
  const 줄 = new Map([].concat(갈래.줄 || []).map((x) => [x.번호, x]));
  const 규칙번호 = new Map();
  for (const x of 줄.values()) for (const o of [].concat(x.올린검사 || [])) for (const r of [].concat(o.규칙 || [])) 규칙번호.set(`${o.검사}:${r}`, x.번호);
  const 모음 = json읽기(path.join(repo, 'docs', '마케팅', '제작양식', '슬롭점검_모음.json')) || { 지적: [] };
  return { 줄, 항목: 갈래.항목 || {}, 자리, 규칙번호, 모음, 묶음이름: 갈래.묶음 || {}, 후보: 갈래.새묶음후보 || {} };
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
        열쇠들: x.결과 === '통과' ? [] : 갈래.map((g) => 갈래열쇠(g, 기준)), 미분류: x.결과 !== '통과' && !갈래.length });
    }
  } else {
    const r = json읽기(path.join(게시, '최종확인.json'));
    if (r && r.결과) {
      const 갈래 = Array.isArray(r.갈래) ? r.갈래 : [];
      사건.push({ 때: String(r.시각 || ''), 출처: '최종 확인', 단계: '최종 확인', 눈: '최종확인', 판: '', 결과: r.결과, 옛기록: true,
        열쇠들: r.결과 === '통과' ? [] : 갈래.map((g) => 갈래열쇠(g, 기준)), 미분류: r.결과 !== '통과' && !갈래.length });
    }
  }
  for (const x of 줄들(path.join(게시, 이력.HISTORY)) || []) {
    const 열쇠들 = [];
    for (const g of [].concat(x.걸림 || [])) {
      if (!g || g.등급 !== '걸림') continue;
      const fc = /^final-cut-(.+)$/.exec(String(g.규칙 || ''));
      const 번호 = Number.isInteger(g.번호) ? g.번호 : 기준.규칙번호.get(`${x.눈}:${g.규칙}`) ?? (fc ? 기준.규칙번호.get(`최종본검사:${fc[1]}`) : undefined);
      열쇠들.push(Number.isInteger(번호) ? `#${번호}` : `규칙:${x.눈}:${g.규칙}`);
    }
    사건.push({ 때: String(x.때 || ''), 출처: '기계 검사', 단계: x.단계 || '', 눈: x.눈 || '', 판: x.판 || '', 결과: x.결과 || '', 열쇠들: [...new Set(열쇠들)] });
  }
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
    사건, 마지막: 사건.reduce((m, x) => (x.때 > m ? x.때 : m), ''),
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

// 앞선 기계 검사 — 최종 확인 단계(최종확인묶음이 부른 최종본 검사)가 아닌 기계 검사가 그 판정보다 먼저 같은 열쇠를 잡았나(GPT 검수 GA3 · GA4)
function 앞서잡음(편, 열쇠, 때) {
  return 편.사건.some((m) => m.출처 === '기계 검사' && m.단계 !== '최종 확인' && m.때 < 때 && m.열쇠들.includes(열쇠));
}

// 최종놓침: 최종 확인에서 잡혔는데 그 편의 앞선 기계 검사가 먼저 잡지 못한 때들 — 검사를 올린 날 뒤에도 있으면 「검사가 못 잡음」
function 올림상태(열쇠, 기준, 최종놓침) {
  const m = /^#(\d+)$/.exec(열쇠);
  if (!m) return '';
  const 올린 = [].concat(기준.줄.get(Number(m[1]))?.올린검사 || []).filter((o) => o.날짜);
  if (!올린.length) return '';
  const 첫날 = 올린.map((o) => o.날짜).sort()[0];
  const 뒤 = 최종놓침.filter((t) => t.slice(0, 10) > 첫날);
  const 검사 = [...new Set(올린.map((o) => o.검사))].join(' · ');
  return 뒤.length ? `검사가 못 잡음 — ${검사}(${첫날}~) 뒤에도 최종 확인에서 ${뒤.length}번` : `검사로 올림(${검사} ${첫날}~)`;
}

function 길세기(편들, 기준, { 최근 = 20 } = {}) {
  const 순 = [...편들].sort((a, b) => String(b.마지막).localeCompare(String(a.마지막)) || a.편.localeCompare(b.편));
  const 고른 = 순.slice(0, 최근);
  const N = 고른.length;
  const 표 = new Map();
  const 칸 = (k) => { if (!표.has(k)) 표.set(k, { 열쇠: k, 최종: new Set(), 기계: new Set(), 맹검: new Set(), 판정: 0, 단계: {}, 최종놓침: [] }); return 표.get(k); };
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
        if (x.출처 === '최종 확인' && !앞서잡음(p, k, x.때)) c.최종놓침.push(x.때);
      }
    }
  }
  const 줄 = [...표.values()].map((c) => {
    const 셀편 = new Set([...c.최종, ...c.기계]);
    // 기계 규칙은 점검표 번호에 이은 것만 올린다(올리기 전 검사의 시각 · 슬롯 같은 운영 규칙이 올릴 차례로 뜨지 않게). 최종 확인의 갈래 이름은 그대로 센다
    const 셀만한 = !c.열쇠.startsWith('규칙:') && !/^C\d{3}$/.test(c.열쇠);
    const 차례 = 셀만한 && 셀편.size >= 올릴편수 && N > 0 && 셀편.size / N > 올릴비율 - 1e-9;
    const 상태 = 올림상태(c.열쇠, 기준, c.최종놓침);
    return { 열쇠: c.열쇠, 이름: 이름(c.열쇠, 기준), 편수: 셀편.size, 최종편: c.최종.size, 기계편: c.기계.size, 맹검편: c.맹검.size, 판정: c.판정, 단계: c.단계,
      올릴차례: 차례, 상태: 상태 || (차례 ? '올릴 차례' : '') };
  }).sort((a, b) => b.편수 - a.편수 || b.판정 - a.판정 || b.맹검편 - a.맹검편 || a.열쇠.localeCompare(b.열쇠));
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
  const 비 = (a, b) => `${a}/${b}(${Math.round((a / b) * 100)}%)`;
  return {
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
  return [...셈.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], undefined, { numeric: true }));
}

function main(argv) {
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
    if (xs.length) 길별[길] = 길세기(xs, 기준, { 최근 });
  }
  const 말씀 = 말씀세기(기준);
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ 거르기: 거르기 || '모두', 일수: 일수 || '제한 없음', 최근, 길: 길별, 말씀: Object.fromEntries(말씀) }, null, 2));
    return 0;
  }
  console.log(`흠 장부 · ${거르기 || '모든 길'} · 길마다 이력이 있는 최근 ${최근}편${일수 ? ` · 지난 ${일수}일` : ''} · 열쇠는 슬롭 점검표 번호`);
  if (!Object.keys(길별).length) { console.log('  기록이 있는 편이 없다.'); return 0; }
  for (const [길, s] of Object.entries(길별)) {
    console.log(`[${길}] 편 ${s.편수}개(기록 있는 편 ${s.전체편수}) · 첫 판 통과율 ${s.숫자.첫판통과율} · 편당 판정 ${s.숫자.편당판정수} · 맨 끝 관문에서 처음 잡힌 흠 ${s.숫자.맨끝비율}`);
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
    console.log(`  숫자 분모: 첫 판 통과율 — ${s.숫자.첫판통과율_분모} · 맨 끝 — ${s.숫자.맨끝비율_분모}`);
  }
  if (말씀.length) console.log(`유호님 말씀(슬롭점검_모음.json — 편 · 길과 이어진 기록이 없어 올릴 차례 셈 밖): ${말씀.slice(0, 8).map(([k, n]) => `${k} ${n}번`).join(' · ')}`);
  if (Object.values(길별).some((s) => s.줄.some((c) => c.올릴차례))) {
    console.log('「올릴 차례」는 docs/_ops/트랙.md에 한 줄로 남기고 작업 세션이 검수와 함께 올린다(기본값 → 기계 검사 → 칸 → 검수 질문). 편을 닫는 세션과 최종 확인 세션은 올리지 않는다.');
  }
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { 기준읽기, 갈래열쇠, 맹검열쇠들, 편폴더들, 편읽기, 모으기, 길세기, 숫자내기, 말씀세기, main, 올릴편수, 올릴비율 };
