#!/usr/bin/env node
// doc-graph — 정본과 그 파생 문서 사이의 엣지를 읽는다.
//
// 왜 있나: doc-audit(2026-07-28)의 발견 — "정본 개정이 대외 문서에 전파 안 된다".
// 급여 정본 v1.3을 36종 문서에 손으로 전파한 게 그 대가였다(synk-docs-overhaul).
// 정본→파생 엣지가 없으니 정본이 바뀌어도 **무엇이 낡았는지 알 방법이 없었다.**
//
// 표기 — 파생 쪽 문서 아무 곳에 한 줄:
//   <!-- 파생: docs/브랜드_폰트_정본.md -->
// 여러 정본을 따르면 줄을 여러 개 두거나 쉼표로 나열한다.
// **정본 쪽은 손대지 않는다** — 정본이 자기 파생을 나열하면 파생이 늘 때마다 정본을 고쳐야 하고,
// 그 갱신을 잊는 것이 바로 지금 고치려는 문제다. 엣지는 항상 파생이 선언한다.
//
// 사용법:
//   node tools/doc-graph.js              리포트(정본별 파생·깨진 참조·심을 후보)
//   node tools/doc-graph.js --of <파일>  그 정본을 따르는 파생 목록만(훅이 쓴다)
//   node tools/doc-graph.js --json
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['docs'];
const SKIP = [/[\\/]_archive[\\/]/, /[\\/]worktrees[\\/]/, /세션보드_아카이브/, /[\\/]_구본[\\/]/, /[\\/]pixelart_draft[\\/]/];
const TEXT_EXT = /\.(md|txt)$/i;
const EDGE_RE = /<!--\s*파생\s*:\s*([^>]+?)\s*-->/g;

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

/** 제외 판정 — 반드시 **상대경로**를 받는다(절대경로를 넣으면 저장소 위치가 규칙을 바꾼다). */
const shouldSkip = (relPath) => SKIP.some((r) => r.test(relPath));

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    /* [2026-08-03] SKIP은 **저장소 기준 상대경로**에 걸어야 한다 — 절대경로에 걸면 저장소가 놓인
     * 자리가 규칙을 바꾼다. 실제 사고: Claude Code 세션 worktree는 `.claude/worktrees/<이름>/`에
     * 만들어지는데, 그 절대경로에 `worktrees`가 들어 있어 `/worktrees/` 규칙이 **docs 전체**를
     * 걸러냈다. 결과는 에러가 아니라 침묵 — 그래프가 0개로 build되고, 정본을 고쳐도 파생 알림이
     * 안 뜬다. 「장치가 죽었다」가 「알릴 게 없다」와 똑같이 생겼다. */
    if (shouldSkip(rel(full))) continue;
    if (e.isDirectory()) walk(full, out);
    else if (TEXT_EXT.test(e.name)) out.push(full);
  }
  return out;
}

// 정본 판별 — 파일명에 '정본'이 있거나 docs/정본/ 아래에 있으면 정본.
function isCanon(relPath) {
  return /정본/.test(path.basename(relPath)) || relPath.startsWith('docs/정본/');
}

function parseEdges(text) {
  const out = [];
  let m;
  EDGE_RE.lastIndex = 0;
  while ((m = EDGE_RE.exec(text)) !== null) {
    for (const part of m[1].split(',')) {
      const t = part.trim().replace(/\\/g, '/');
      if (t) out.push(t);
    }
  }
  return out;
}

function build() {
  const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));
  const docs = new Map(); // relPath -> {rel, full, canon, follows:[], text}
  for (const full of files) {
    const r = rel(full);
    let text = '';
    try { text = fs.readFileSync(full, 'utf8'); } catch (_) { continue; }
    docs.set(r, { rel: r, full, canon: isCanon(r), follows: parseEdges(text), text });
  }

  const derivedOf = new Map(); // 정본 relPath -> [파생 relPath...]
  const broken = [];
  for (const d of docs.values()) {
    for (const target of d.follows) {
      if (!docs.has(target) && !fs.existsSync(path.join(ROOT, target))) {
        broken.push({ from: d.rel, target });
        continue;
      }
      if (!derivedOf.has(target)) derivedOf.set(target, []);
      derivedOf.get(target).push(d.rel);
    }
  }

  // 심을 후보 — 본문이 정본을 이름으로 언급하는데 파생 선언이 없는 문서.
  // 자동으로 심지 않는다(오탐이 엣지를 오염시키면 알림 전체가 신뢰를 잃는다). 후보만 보여준다.
  const canons = [...docs.values()].filter((d) => d.canon);
  const candidates = [];
  for (const d of docs.values()) {
    if (d.canon) continue;
    for (const c of canons) {
      const stem = path.basename(c.rel).replace(TEXT_EXT, '');
      if (d.follows.includes(c.rel)) continue;
      if (d.text.includes(stem)) candidates.push({ doc: d.rel, canon: c.rel });
    }
  }
  return { docs, derivedOf, broken, candidates, canons };
}

// 파생 선언을 문서에 심는다. 손으로 10곳에 같은 주석을 붙이면 형식이 흔들리고,
// 흔들린 형식은 파서가 조용히 놓친다 — 그러면 "엣지가 없다"와 "엣지를 못 읽는다"를 구분할 수 없다.
// 제목(첫 # 줄) 바로 다음에 넣어 사람 눈에도 먼저 보이게 한다. 이미 있으면 병합·정렬만 한다.
function addEdge(docRel, canons) {
  const full = path.join(ROOT, docRel);
  const text = fs.readFileSync(full, 'utf8');
  const existing = parseEdges(text);
  const merged = [...new Set([...existing, ...canons])].sort();
  if (existing.length === merged.length && existing.every((e, i) => e === merged.sort()[i])) return false;

  const line = `<!-- 파생: ${merged.join(', ')} -->`;
  let next;
  if (existing.length) {
    let first = true;
    next = text.replace(EDGE_RE, () => (first ? ((first = false), line) : ''));
  } else {
    const lines = text.split('\n');
    let at = lines.findIndex((l) => /^#\s/.test(l));
    at = at === -1 ? 0 : at + 1;
    lines.splice(at, 0, '', line);
    next = lines.join('\n');
  }
  if (next === text) return false;
  fs.writeFileSync(full, next, 'utf8');
  return true;
}

function main() {
  const args = process.argv.slice(2);

  const addIdx = args.indexOf('--add');
  if (addIdx !== -1) {
    const [doc, ...canons] = args.slice(addIdx + 1);
    if (!doc || !canons.length) {
      console.error('사용법: node tools/doc-graph.js --add <파생문서> <정본1> [정본2...]');
      process.exit(1);
    }
    for (const c of canons) {
      if (!fs.existsSync(path.join(ROOT, c))) {
        console.error(`[doc-graph] 정본이 없다: ${c}  — 오탈자 엣지는 심지 않는다`);
        process.exit(1);
      }
    }
    console.log(addEdge(doc, canons) ? `  + ${doc}  →  ${canons.join(', ')}` : `  = ${doc} (변경 없음)`);
    return;
  }

  const g = build();

  const ofIdx = args.indexOf('--of');
  if (ofIdx !== -1) {
    const raw = args[ofIdx + 1] || '';
    const target = path.isAbsolute(raw) ? rel(raw) : raw.replace(/\\/g, '/');
    const list = g.derivedOf.get(target) || [];
    if (args.includes('--json')) console.log(JSON.stringify({ canon: target, derived: list }));
    else list.forEach((d) => console.log(d));
    return;
  }

  if (args.includes('--json')) {
    console.log(JSON.stringify({
      derivedOf: Object.fromEntries(g.derivedOf),
      broken: g.broken,
      candidates: g.candidates,
      canons: g.canons.map((c) => c.rel),
    }, null, 2));
    return;
  }

  const totalEdges = [...g.derivedOf.values()].reduce((a, l) => a + l.length, 0);
  console.log(`\n[doc-graph] 문서 ${g.docs.size}개 · 정본 ${g.canons.length}개 · 파생 엣지 ${totalEdges}개\n`);

  if (g.derivedOf.size) {
    console.log('  정본별 파생:');
    for (const [canon, list] of [...g.derivedOf].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`    ${canon}  ←  ${list.length}종`);
      for (const d of list) console.log(`        ${d}`);
    }
  } else {
    console.log('  아직 파생 엣지가 없다. 파생 문서에 다음 한 줄을 넣으면 잡힌다:');
    console.log('    <!-- 파생: docs/브랜드_폰트_정본.md -->');
  }

  if (g.broken.length) {
    console.log(`\n  ⚠ 깨진 참조 — ${g.broken.length}건(가리키는 정본이 없다)`);
    for (const b of g.broken) console.log(`    ${b.from} → ${b.target}`);
  }

  if (g.candidates.length) {
    const byCanon = new Map();
    for (const c of g.candidates) {
      if (!byCanon.has(c.canon)) byCanon.set(c.canon, []);
      byCanon.get(c.canon).push(c.doc);
    }
    console.log(`\n  ℹ 심을 후보 — 정본을 언급하는데 파생 선언이 없는 문서 ${g.candidates.length}건`);
    console.log('    (자동으로 심지 않는다. 진짜 파생인지는 사람이 판정한다.)');
    for (const [canon, docs] of [...byCanon].sort((a, b) => b[1].length - a[1].length).slice(0, 10)) {
      console.log(`    ${canon}`);
      for (const d of docs.slice(0, 8)) console.log(`        ${d}`);
      if (docs.length > 8) console.log(`        … 외 ${docs.length - 8}종`);
    }
  }
  console.log('');
}

if (require.main === module) main();
module.exports = { build, parseEdges, isCanon, addEdge, rel, shouldSkip, ROOT };
