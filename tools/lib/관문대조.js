'use strict';
/* 관문 대조 — 편마다 우리 관문 판정과 실제 반응(평소 대비 배수)을 맞댄다(2026-11-08, AI 없음).
 *
 * 왜: 11-08 온라인 마케팅 전 과정 평가에서 LAB 몽골 인스타 · 페북 72시간이 평소의 6~257배였던 편 일곱이 모두 장부
 * 「완성(관문 못 넘음)」이었고(하나는 「버림」 뒤 다시 살림), 「지금까지 보이는 것」이 「넘은 편」으로 든 편(관용구 퀴즈 #6 ·
 * 「밥 한번」 · Y5)은 72시간 0.2배 안팎이었다. 유호님이 「AI 슬롭」으로 기각한 synkbrief B23 · B24는 관문을 다 넘었다.
 * 관문이 실제 반응을 맞히는지 잰 적이 없어서, 3시간 성과 판정(tools/게시성과.js)이 요약 docs/마케팅/게시성과.md에 이 표를 붙인다.
 * 이 표는 재기만 한다 — 관문 규칙은 제작 절차(docs/마케팅/기획장부/제작절차.md), 바꾸는 것은 유호님 결정이다.
 *
 * 판정 읽는 곳: 기획.md 첫 줄의 장부 번호(E · M · B · Y · Q + 숫자) → 그 브랜드 장부(기획장부/<LAB|synkbrief|yuhobuilds>.md) 표 줄의
 *   넷째 칸(상태). 「관문 못 넘음」 → 못 넘음, 「버림」 → 버림, 「완성」 → 넘음, 그 밖(제작 중 · 예비 · 고름 · 순위) → 모름.
 *   장부 줄을 못 찾으면 기획.md 첫 세 줄로 같은 셈을 한다.
 * 반응: 그 편 판 가운데 그 편 줄의 계정(sns-계정.json dailyLine — 몽골 편(_mn_)은 「LAB 몽골」, 그 밖 LAB 편은 「LAB 영어」) 판정의
 *   평소 대비 배수 가운데 가장 큰 값. 72시간 값이 있으면 72시간, 없으면 24시간(표에 「24h」). 두 채널 판(번역판)은 관문을 따로 거쳐 뺀다.
 *
 *   node tools/관문대조.js [--날 30] [--json]   편마다 한 줄씩 전부 본다(요약에는 줄마다 셈과 3배 넘은 편만)
 */
const fs = require('node:fs');
const path = require('node:path');

const 브랜드장부 = { LAB: 'LAB.md', synkbrief: 'synkbrief.md', yuhobuilds: 'yuhobuilds.md' };
// 「튐」 = 평소의 3배 이상(게시성과 요약 「튄 편」과 같은 셈), 「위」 = 1.5배 이상(검증된 틀 문턱 — 제작 절차 「근거 · 틀 · 화면」)
const 튐 = 3;
const 위 = 1.5;
// 못 넘은 까닭 낱말 → 자리 이름(장부 상태 칸 · 기획.md 첫 줄의 괄호 글에서 센다)
const 자리들 = [
  ['같아 보임', /같아 보임|9번/],
  ['재미', /재미/],
  ['볼 이유', /볼 이유/],
  ['장면 심사', /장면 심사/],
  ['이해 점수', /이해\s*[1-3](?:\D|$)|haiku 이해|이해 시험/],
  ['넘김', /넘김|넘긴/],
  ['같이 짚음', /같이 짚|둘이 짚|셋이 짚/],
];

const 읽기 = file => { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } };

/** 편 폴더 이름 → 그 편의 줄(관문을 거친 판의 줄) */
function 편줄(folder) {
  if (/^LAB_/.test(folder)) return /_mn_\d{8}$/.test(folder) ? 'LAB 몽골' : 'LAB 영어';
  if (/^synkbrief_/.test(folder)) return 'synkbrief';
  if (/^yuhobuilds_/.test(folder)) return 'yuhobuilds';
  return null;
}
const 줄브랜드 = 줄 => (줄 && 줄.startsWith('LAB') ? 'LAB' : 줄);

/** 기획.md 첫 줄의 장부 번호(「· M15 ·」) */
function 장부번호(planText) {
  const first = String(planText || '').split(/\r?\n/, 1)[0];
  const m = /(?:^|·)\s*\**([EMBYQ]\d{1,3}[a-z]?)\**\s*(?:·|$)/.exec(first);
  return m ? m[1] : null;
}

/** 상태 글(장부 넷째 칸 · 기획.md 첫머리) → { 결과, 까닭, 자리[], 다시살림 } */
function 판정읽기(text) {
  const t = String(text || '').replace(/\*\*/g, '');
  const 다시살림 = /다시 살림/.test(t);
  const 결과 = /관문 못 넘음/.test(t) ? '못 넘음' : /완성/.test(t) ? '넘음' : /버림/.test(t) ? '버림' : '모름';
  let 까닭 = null;
  const i = t.indexOf('관문 못 넘음');
  if (i >= 0) {
    // 괄호가 닫히는 데까지(안쪽 괄호는 세며), 길면 자른다
    let depth = 0, end = t.length;
    for (let k = i; k < t.length; k += 1) {
      if (t[k] === '(') depth += 1;
      else if (t[k] === ')') { if (depth === 0) { end = k; break; } depth -= 1; }
    }
    까닭 = t.slice(i + '관문 못 넘음'.length, end).replace(/^\s*[—-]\s*/, '').trim().slice(0, 140) || null;
  }
  const 자리 = 결과 === '못 넘음' && 까닭 ? 자리들.filter(([, re]) => re.test(까닭)).map(([name]) => name) : [];
  return { 결과, 까닭, 자리, 다시살림 };
}

/** 장부 글에서 그 번호의 표 줄 상태 칸들(넷째 칸) — 「완성」 · 「버림」이 든 줄을 앞에 */
function 장부상태(ledgerText, id) {
  if (!ledgerText || !id) return null;
  const rows = [];
  const re = new RegExp(`^\\|\\s*${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\|(.*)$`, 'gm');
  for (const m of ledgerText.matchAll(re)) {
    const cells = m[1].split('|');
    if (cells.length >= 3) rows.push(cells[2].trim());
  }
  if (!rows.length) return null;
  const done = rows.filter(c => /완성|버림/.test(c));
  return (done.length ? done[done.length - 1] : rows[rows.length - 1]) || null;
}

/** sns-계정.json → 계정 키 → dailyLine */
function 계정줄들(marketingRoot) {
  try {
    const { accounts } = JSON.parse(fs.readFileSync(path.join(marketingRoot, 'sns-계정.json'), 'utf8'));
    return new Map(Object.entries(accounts || {}).filter(([, a]) => a && a.dailyLine).map(([k, a]) => [k, a.dailyLine]));
  } catch { return new Map(); }
}

/**
 * 편마다 한 줄 — judgments: 판 × 시점마다 가장 늦은 판정(게시성과 요약의 latest — post · folder · account · point · multiple · metrics · publishedAt).
 * 판마다 72시간 판정이 있으면 그것, 없으면 24시간(7일은 시점이 달라 견주지 않는다).
 * index: 게시성과편.buildIndex 결과(folders: 편 → { dir, … })
 */
function 표({ judgments = [], index = null, now = Date.now(), 날 = 30 } = {}) {
  const folders = index && index.folders ? index.folders : new Map();
  const first = [...folders.values()][0];
  if (!first) return [];
  const marketingRoot = path.dirname(first.dir);
  const ledgerDir = path.join(marketingRoot, '기획장부');
  const ledgers = {};
  for (const [brand, file] of Object.entries(브랜드장부)) ledgers[brand] = 읽기(path.join(ledgerDir, file));
  const lineOf = 계정줄들(marketingRoot);
  const cut = now - 날 * 86_400_000;
  const byPost = new Map();
  for (const l of judgments) {
    if (!l || !l.folder || !folders.has(l.folder) || (l.point !== '72h' && l.point !== '24h')) continue;
    const 줄 = 편줄(l.folder);
    if (!줄 || lineOf.get(l.account) !== 줄) continue; // 두 채널 판 · 다른 줄 계정은 뺀다
    if (!(Date.parse(l.publishedAt) >= cut)) continue;
    const had = byPost.get(l.post);
    if (!had || (had.point === '24h' && l.point === '72h')) byPost.set(l.post, l);
  }
  const byFolder = new Map();
  for (const l of byPost.values()) {
    if (!byFolder.has(l.folder)) byFolder.set(l.folder, []);
    byFolder.get(l.folder).push(l);
  }
  const rows = [];
  for (const [folder, list] of byFolder) {
    const info = folders.get(folder);
    const plan = 읽기(path.join(info.dir, '기획.md'));
    const id = 장부번호(plan);
    const 줄 = 편줄(folder);
    const cell = 장부상태(ledgers[줄브랜드(줄)], id);
    const head = String(plan || '').split(/\r?\n/).slice(0, 3).join(' ');
    let g = 판정읽기(cell);
    const h = 판정읽기(head);
    if (g.결과 === '모름' || (h.결과 === '못 넘음' && g.결과 !== '못 넘음')) g = h.결과 !== '모름' ? h : g;
    const scored = list.filter(l => l.multiple && Number.isFinite(l.multiple.value));
    const best = scored.sort((a, b) => b.multiple.value - a.multiple.value)[0] || null;
    rows.push({
      folder, 줄, 번호: id, 결과: g.결과, 까닭: g.까닭, 자리: g.자리, 다시살림: g.다시살림 || h.다시살림,
      배수: best ? best.multiple.value : null, 시점: best ? best.point : null, 계정: best ? best.account : null,
      조회: best && best.metrics ? best.metrics.views ?? null : null,
      저장: best && best.metrics ? best.metrics.saves ?? null : null,
      공유: best && best.metrics ? best.metrics.shares ?? null : null,
      게시: list.map(l => l.publishedAt).sort()[0] || null,
    });
  }
  return rows.sort((a, b) => String(b.게시).localeCompare(String(a.게시)));
}

/** 줄마다 셈 — { 줄: { 넘음:{n, 튐, 위}, '못 넘음':…, 버림:…, 모름:… } } (배수를 못 잰 편은 n에서 뺀다) */
function 셈(rows) {
  const out = {};
  for (const r of rows) {
    if (r.배수 === null) continue;
    const s = (out[r.줄] ||= {});
    const c = (s[r.결과] ||= { n: 0, 튐: 0, 위: 0 });
    c.n += 1;
    if (r.배수 >= 튐) c.튐 += 1;
    if (r.배수 >= 위) c.위 += 1;
  }
  return out;
}

/** 못 넘은 까닭(자리)마다 — 그 자리로 못 넘은 편 수 · 그 가운데 3배 넘은 편 수 */
function 자리셈(rows) {
  const out = new Map();
  for (const r of rows) {
    if (r.결과 !== '못 넘음' || r.배수 === null) continue;
    for (const a of r.자리) {
      const c = out.get(a) || { n: 0, 튐: 0 };
      c.n += 1;
      if (r.배수 >= 튐) c.튐 += 1;
      out.set(a, c);
    }
  }
  return [...out.entries()].sort((a, b) => b[1].n - a[1].n);
}

const 배글 = v => (v === null || v === undefined ? '—' : `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}배`);
const 칸 = c => (c ? `${c.n}편 · 3배+ ${c.튐}` : '—');

/** 게시성과.md에 붙이는 절(줄 배열). 표가 비면 빈 배열 */
function 요약절(rows, { 날 = 30 } = {}) {
  const counted = rows.filter(r => r.배수 !== null);
  if (!counted.length) return [];
  const s = 셈(rows);
  const lines = [
    `## 관문과 실제 반응(최근 ${날}일 · 편마다)`,
    '',
    `우리 관문 판정(장부 상태 칸 — 넘음 · 못 넘음 · 버림)과 그 편 줄 계정의 평소 대비 배수(72시간, 없으면 24시간 중 가장 큰 값)를 맞댄 표다. 관문을 바꾸는 표가 아니라 재는 표다 — 관문 규칙은 [제작 절차](기획장부/제작절차.md), 바꾸기는 유호님 결정이다. 편마다 다 보려면 \`node tools/관문대조.js\`.`,
    '',
    '| 줄 | 관문 넘음 | 관문 못 넘음 | 버림 뒤 게시 | 판정 못 읽음 |',
    '|---|---|---|---|---|',
  ];
  for (const 줄 of ['LAB 영어', 'LAB 몽골', 'synkbrief', 'yuhobuilds']) {
    const c = s[줄];
    if (!c) continue;
    lines.push(`| ${줄} | ${칸(c['넘음'])} | ${칸(c['못 넘음'])} | ${칸(c['버림'])} | ${칸(c['모름'])} |`);
  }
  const 자리 = 자리셈(rows);
  if (자리.length) lines.push('', `못 넘은 까닭별(한 편이 여러 자리에 들 수 있다): ${자리.map(([a, c]) => `${a} ${c.n}편 중 3배+ ${c.튐}`).join(' · ')}`);
  const hot = counted.filter(r => r.배수 >= 튐).sort((a, b) => b.배수 - a.배수).slice(0, 12);
  if (hot.length) {
    lines.push('', '3배 넘은 편:', '');
    for (const r of hot) lines.push(`- ${r.folder}${r.번호 ? ` (${r.번호})` : ''} · ${배글(r.배수)}${r.시점 === '24h' ? '(24h)' : ''}${r.조회 != null ? ` · 조회 ${r.조회.toLocaleString('en-US')}` : ''} · 관문 ${r.결과}${r.다시살림 ? ' · 다시 살림' : ''}${r.자리.length ? ` — ${r.자리.join(' · ')}` : ''}`);
  }
  lines.push('');
  return lines;
}

module.exports = { 편줄, 장부번호, 판정읽기, 장부상태, 표, 셈, 자리셈, 요약절, 튐, 위 };
