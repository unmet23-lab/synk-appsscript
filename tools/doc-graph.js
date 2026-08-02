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
// [2026-08-03] 시간축 — 엣지 뒤에 @버전을 붙이면 "이 파생은 정본의 그 버전을 보고 썼다"가 된다:
//   <!-- 파생: docs/정본/…/급여 인센티브 정본.txt@v1.1 -->
// 정본이 v1.3으로 오르는 순간 이 엣지는 저절로 '낡음'이 된다. 사실이 **모순되는 대신 만료**된다.
// 왜 필요한가: 엣지만 있으면 "누가 이 정본을 따르나"는 알아도 **"그 파생이 아직 맞나"는 모른다.**
// 실측(2026-08-03) — 급여 정본은 v1.3인데 파생 3종이 본문에서 v1.1 수치를 인용 중이었고,
// 엣지는 셋 다 멀쩡히 붙어 있었다. 즉 연결은 참인데 내용이 거짓인 상태를 그래프가 못 봤다.
// 버전이 없는 엣지는 '최신'이 아니라 **'모름'**으로 집계한다(모름을 정상으로 바꾸지 않는다).
//
// 사용법:
//   node tools/doc-graph.js              리포트(정본별 파생·깨진 참조·낡은 인용·심을 후보)
//   node tools/doc-graph.js --of <파일>  그 정본을 따르는 파생 목록만(훅이 쓴다)
//   node tools/doc-graph.js --add <파생> <정본[@v1.1]>...   엣지 심기
//   node tools/doc-graph.js --stamp <파생>  그 파생의 엣지를 정본 현재 버전으로 = "지금 맞다" 선언
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

/** `경로@v1.1` → {target, version}. '@'가 없으면 version=null(= 모름). */
function splitVersion(raw) {
  const s = String(raw).trim().replace(/\\/g, '/');
  const at = s.lastIndexOf('@');
  // 경로 안의 '@'(폴더명 등)를 버전으로 오인하지 않게 — 뒤가 v숫자 꼴일 때만 버전으로 본다.
  if (at > 0 && /^v\d+(\.\d+)*$/i.test(s.slice(at + 1))) {
    return { target: s.slice(0, at).trim(), version: s.slice(at + 1).trim() };
  }
  return { target: s, version: null };
}

/** 엣지 전문(버전 포함). build()가 쓴다. */
function parseEdgesFull(text) {
  const out = [];
  let m;
  EDGE_RE.lastIndex = 0;
  while ((m = EDGE_RE.exec(text)) !== null) {
    for (const part of m[1].split(',')) {
      if (!part.trim()) continue;
      const e = splitVersion(part);
      if (e.target) out.push(e);
    }
  }
  return out;
}

/** 대상 경로만. 버전 표기가 생기기 전부터 있던 호출자·훅이 그대로 쓴다. */
function parseEdges(text) {
  return parseEdgesFull(text).map((e) => e.target);
}

/* 정본의 **현재** 버전을 정본 자신에게서 읽는다.
 * 파일명에서 읽지 않는다 — 「문서 파일명에 버전을 박지 않는다」가 규약이고,
 * 실제로 `반편성_정본_v2.md`의 본문은 v2.3이다(파일명을 믿으면 0.3만큼 틀린다).
 * 못 찾으면 null을 돌려주고 '미상'으로 리포트한다 — 못 읽은 것을 '최신'으로 바꾸지 않는다. */
const VERSION_SCAN_LINES = 12;
function canonVersion(text) {
  const head = String(text).split('\n').slice(0, VERSION_SCAN_LINES).join('\n');
  const m = head.match(/\bv\d+(?:\.\d+)*\b/i);
  return m ? m[0].toLowerCase() : null;
}

const sameVersion = (a, b) =>
  String(a).toLowerCase().replace(/^v/, '') === String(b).toLowerCase().replace(/^v/, '');

function build() {
  const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));
  const docs = new Map(); // relPath -> {rel, full, canon, follows:[], text}
  for (const full of files) {
    const r = rel(full);
    let text = '';
    try { text = fs.readFileSync(full, 'utf8'); } catch (_) { continue; }
    docs.set(r, {
      rel: r, full, canon: isCanon(r),
      edges: parseEdgesFull(text),
      follows: parseEdges(text),
      version: isCanon(r) ? canonVersion(text) : null,
      text,
    });
  }

  const derivedOf = new Map(); // 정본 relPath -> [파생 relPath...]
  const broken = [];
  const stale = [];        // 정본이 그 뒤로 올라갔다 — 파생이 낡은 판을 인용 중
  const unversioned = [];  // 버전 미기입 = 맞는지 **모른다**(최신이 아니다)
  const canonUnknown = []; // 정본에서 버전을 못 읽었다 — 판정 자체가 불가
  for (const d of docs.values()) {
    for (const e of d.edges) {
      const target = e.target;
      if (!docs.has(target) && !fs.existsSync(path.join(ROOT, target))) {
        broken.push({ from: d.rel, target });
        continue;
      }
      if (!derivedOf.has(target)) derivedOf.set(target, []);
      derivedOf.get(target).push(d.rel);

      // 시간축 판정
      const canonDoc = docs.get(target);
      const now = canonDoc ? canonDoc.version : null;
      if (!e.version) unversioned.push({ from: d.rel, target, now });
      else if (!now) canonUnknown.push({ from: d.rel, target, cited: e.version });
      else if (!sameVersion(e.version, now)) stale.push({ from: d.rel, target, cited: e.version, now });
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
  return { docs, derivedOf, broken, candidates, canons, stale, unversioned, canonUnknown };
}

// 파생 선언을 문서에 심는다. 손으로 10곳에 같은 주석을 붙이면 형식이 흔들리고,
// 흔들린 형식은 파서가 조용히 놓친다 — 그러면 "엣지가 없다"와 "엣지를 못 읽는다"를 구분할 수 없다.
// 제목(첫 # 줄) 바로 다음에 넣어 사람 눈에도 먼저 보이게 한다. 이미 있으면 병합·정렬만 한다.
function addEdge(docRel, canons) {
  const full = path.join(ROOT, docRel);
  const text = fs.readFileSync(full, 'utf8');
  const existing = parseEdgesFull(text);

  // 대상 경로를 키로 병합한다 — 새 지정에 버전이 있으면 그것이 이긴다.
  // (같은 정본이 `x.md`와 `x.md@v1.1` 두 줄로 갈라지면 하나는 영원히 '모름'으로 남는다.)
  const byTarget = new Map();
  for (const e of existing) byTarget.set(e.target, e.version);
  for (const raw of canons) {
    const e = splitVersion(raw);
    const prev = byTarget.get(e.target);
    byTarget.set(e.target, e.version || prev || null);
  }
  const merged = [...byTarget.entries()]
    .map(([t, v]) => (v ? `${t}@${v}` : t))
    .sort();

  const before = existing.map((e) => (e.version ? `${e.target}@${e.version}` : e.target)).sort();
  if (before.length === merged.length && before.every((e, i) => e === merged[i])) return false;

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
      const { target } = splitVersion(c); // @버전은 경로가 아니다 — 떼고 실재를 확인한다
      if (!fs.existsSync(path.join(ROOT, target))) {
        console.error(`[doc-graph] 정본이 없다: ${target}  — 오탈자 엣지는 심지 않는다`);
        process.exit(1);
      }
    }
    console.log(addEdge(doc, canons) ? `  + ${doc}  →  ${canons.join(', ')}` : `  = ${doc} (변경 없음)`);
    return;
  }

  // --stamp <파생> : 그 파생의 모든 엣지를 정본의 **현재** 버전으로 갱신한다.
  // 이건 조회가 아니라 **선언**이다 — "이 파생을 지금 정본에 맞춰 읽었다". 확인 없이 찍으면
  // 낡은 문서가 최신이라고 거짓말하게 된다(도구가 잡던 바로 그 사고를 도구로 만드는 셈).
  const stampIdx = args.indexOf('--stamp');
  if (stampIdx !== -1) {
    const doc = args[stampIdx + 1];
    if (!doc) {
      console.error('사용법: node tools/doc-graph.js --stamp <파생문서>');
      process.exit(1);
    }
    const g0 = build();
    const d = g0.docs.get(doc.replace(/\\/g, '/'));
    if (!d) {
      console.error(`[doc-graph] 문서가 없다: ${doc}`);
      process.exit(1);
    }
    const specs = [];
    for (const e of d.edges) {
      const canonDoc = g0.docs.get(e.target);
      const now = canonDoc && canonDoc.version;
      if (!now) { console.log(`  ? ${e.target} — 정본에서 버전을 못 읽었다(그대로 둔다)`); continue; }
      specs.push(`${e.target}@${now}`);
    }
    if (!specs.length) { console.log('  = 찍을 엣지가 없다'); return; }
    console.log(addEdge(doc, specs) ? `  ✔ ${doc}  →  ${specs.join(', ')}` : `  = ${doc} (변경 없음)`);
    console.log('    ↑ 이 파일이 정본의 그 판과 실제로 맞는지는 **사람이 확인한 것**으로 기록된다.');
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
      stale: g.stale,
      unversioned: g.unversioned,
      canonUnknown: g.canonUnknown,
      candidates: g.candidates,
      canons: g.canons.map((c) => ({ rel: c.rel, version: c.version })),
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

  if (g.stale.length) {
    console.log(`\n  🔴 낡은 인용 — ${g.stale.length}건(정본은 올라갔는데 파생이 옛 판을 보고 있다)`);
    for (const s of g.stale) {
      console.log(`    ${s.from}`);
      console.log(`        ${s.target}  인용 ${s.cited} → 현재 ${s.now}`);
    }
    console.log('    고친 뒤:  node tools/doc-graph.js --stamp <파생문서>');
  }
  if (g.canonUnknown.length) {
    console.log(`\n  ⚠ 정본 버전 미상 — ${g.canonUnknown.length}건(정본 머리말에서 vN을 못 읽어 낡음 판정 불가)`);
    for (const c of g.canonUnknown) console.log(`    ${c.target}  ← ${c.from}(인용 ${c.cited})`);
  }
  if (g.unversioned.length) {
    // '최신'이 아니라 '모름'이다. 조용히 통과시키면 그래프가 안심을 지어낸다.
    console.log(`\n  ℹ 버전 미기입 — ${g.unversioned.length}건(맞는지 **모름**. 확인했으면 --stamp)`);
    for (const u of g.unversioned.slice(0, 10)) {
      console.log(`    ${u.from} → ${u.target}${u.now ? ` (정본 현재 ${u.now})` : ''}`);
    }
    if (g.unversioned.length > 10) console.log(`    … 외 ${g.unversioned.length - 10}건`);
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
module.exports = {
  build, parseEdges, parseEdgesFull, splitVersion, canonVersion, sameVersion,
  isCanon, addEdge, rel, shouldSkip, ROOT,
};
