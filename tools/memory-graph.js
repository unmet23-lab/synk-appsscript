#!/usr/bin/env node
// memory-graph — 메모리 파일들을 "그래프"로 읽는다.
//
// 왜 있나 (2026-08-03 실측): 메모리 102파일에 [[링크]]가 210개 있었지만
// ①타입이 없고 ②역링크가 없고 ③순회 도구가 없어서 **그래프 연산이 원리적으로 불가능**했다.
// 그 대가가 "정본 개정이 대외 문서에 전파 안 된다"(doc-audit)와
// "결정 대기 15건+ 중 뭐부터인지 모른다"(decision-queue-bottleneck)였다.
//
// 새 표기법을 만들지 않는다 — 기존 [[x]]는 '관련'으로 그대로 유효하고,
// 앞에 한 단어만 붙이면 타입이 생긴다:  [[대체>x]] [[근거>x]] [[막힘>x]]
//
// 사용법:
//   node tools/memory-graph.js              리포트(고아·깨진 링크·인덱스 불일치·미지 타입)
//   node tools/memory-graph.js --decisions  결정 큐 — '막힘>' 엣지를 위상정렬해 우선순위 산출
//   node tools/memory-graph.js --write      각 파일 하단에 역링크 섹션 삽입/갱신(멱등)
//   node tools/memory-graph.js --json       위 결과를 기계 판독용 JSON으로
//   SYNK_MEMORY_DIR=... 로 대상 디렉터리를 덮어쓸 수 있다(테스트용).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { 인자게이트 } = require(path.join(__dirname, 'lib', '인자게이트.js'));

/* ── 표기 규약 ───────────────────────────────────────────────────────────── */
// 링크 타입. 무타입 [[x]] = '관련'. 미지 타입은 리포트에 올리되 '관련'으로 취급한다
// (오탈자가 조용히 엣지를 지우면 그래프가 거짓말을 하므로, 삼키지 않고 드러낸다).
const TYPES = {
  대체: '이 문서가 대상을 대체함(대상은 역사 기록)',
  근거: '이 문서의 판정이 대상을 근거로 삼음',
  막힘: '이 문서가 대상의 결정/완료를 기다림',
  관련: '단순 연관',
};
const DEFAULT_TYPE = '관련';

// 결정 노드 — 파일이 없어도 정상인 유일한 대상.
// 유호님의 ⏳ 항목들은 토픽 간 의존이 아니라 **사람의 결정**이라, 토픽 노드만으로는
// 그래프가 서지 않는다(실측: 명시적 토픽 의존은 2건뿐이었다).
// 결정마다 메모리 파일을 만들면 102개가 150개로 부푸니, 파일 없는 노드로 둔다.
//   예) [[막힘>결정-동의문구-몽골어병기]]
const DECISION_PREFIX = '결정-';
const isDecision = (t) => t.startsWith(DECISION_PREFIX);

const MARK_START = '<!-- memory-graph:역링크 시작 · 이 구간은 자동 생성이다. 손으로 고치지 말 것 -->';
const MARK_END = '<!-- memory-graph:역링크 끝 -->';
/* 인덱스는 **두 파일**이다(2026-08-07 쪼개기 · 장부 F184).
 * 상한이 「줄」이라 지도(어느 토픽 파일을 열까)를 상주분 밖으로 내보냈다 — MEMORY.md 에는
 * 🚫·⏳ 조각만 남고 원문 줄은 지도.md 에 있다. 한 파일만 인덱스로 세면 옮긴 98건이
 * 「인덱스 누락」으로 뜬다 — 옮긴 것과 잃은 것이 같은 모양이 되는 자리다.
 * ⚠ 목록은 여기 하나에서만 파생시킨다(두 곳에 적으면 갈라진다). */
const INDEX_FILES = ['MEMORY.md', '지도.md'];
const INDEX_FILE = INDEX_FILES[0];   // 보고 문구의 대표 이름
const INDEX_SLUGS = new Set(INDEX_FILES.map((f) => f.replace(/\.md$/, '')));

/* ── 대상 디렉터리 ───────────────────────────────────────────────────────── */
// Claude Code의 프로젝트 메모리는 repo 밖(~/.claude/projects/<슬러그>/memory)에 산다.
// 슬러그는 프로젝트 절대경로에서 ':'와 경로 구분자를 '-'로 바꾼 것.
//
// ⚠ 기준은 **메인 작업 트리**다 (장부 F206 · 2026-08-07 실측).
//   `__dirname/..` 을 그대로 쓰면 워크트리 세션에서 슬러그가
//   `…-SYNK-appsscript-.claude-worktrees-<이름>` 으로 파생돼 **없는 폴더**를 가리킨다.
//   증상이 오류가 아니라 「메모리 0건」이라 결정 큐·상태가드·rot-check 가 조용히 비고,
//   그건 「깨끗함」과 정확히 같은 모양이다 — 새는 방향은 언제나 통과다.
//   F079 가 상태 폴더 키에 이미 낸 처방(메인 트리 하나로 통일)이 이 파생에만 미적용이었다.
//   ⚠ 메인에서 부르면 값이 지금까지와 **완전히 같다**(worktrees.mainWorktree 계약) —
//     넓히기만 하고 되돌리지 않는 변경이라 이미 굴러가는 메모리 경로가 안 깨진다.
let wt = null;
try { wt = require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'worktrees.js')); } catch (_) { wt = null; }

/** 이 프로젝트의 하네스 폴더(`~/.claude/projects/<슬러그>`). 전사·메모리가 그 아래 산다.
 *  ⚠ **이 조립은 여기 한 곳에서만 한다.** 실측 F206: 다섯 곳이 각자 조립하고 있었고
 *    ⓐ 둘은 이 기계 이름을 **하드코딩**했고(다른 기계에선 통째로 죽는다)
 *    ⓑ 하나는 `process.cwd()` 라 하위 폴더에서 부르면 어긋나고
 *    ⓒ 나머지는 워크트리에서 어긋난다. 셋 다 증상이 **「0건」**이라 서로 구별도 안 된다.
 *    호출부마다 고치는 대신 통로를 하나로 만들고 옛 통로는 회귀가 금지한다. */
function projectDir() {
  let root = path.resolve(__dirname, '..');
  if (wt) { try { root = wt.mainWorktree(root) || root; } catch (_) { /* 모름 — 옛 동작 그대로 */ } }
  return path.join(os.homedir(), '.claude', 'projects', root.replace(/:/g, '-').replace(/[\\/]/g, '-'));
}

function memoryDir() {
  return process.env.SYNK_MEMORY_DIR || path.join(projectDir(), 'memory');
}

/* ── 읽기 ────────────────────────────────────────────────────────────────── */
function stripBacklinks(text) {
  // 역링크 섹션은 파싱에서 제외한다 — 넣지 않으면 자기가 만든 엣지를 다시 읽어
  // a→b→a 왕복이 매 실행마다 증식한다(자기증식 방지).
  const s = text.indexOf(MARK_START);
  if (s === -1) return text;
  const e = text.indexOf(MARK_END, s);
  return e === -1 ? text.slice(0, s) : text.slice(0, s) + text.slice(e + MARK_END.length);
}

// 코드 스팬·펜스 제외. 첫 실행에서 바로 물린 함정이다 — 표기법을 **설명하는** 문서가
// 그 예시(`[[대체>x]]`)를 진짜 엣지로 내보내 없는 노드 4개를 만들어냈다.
// 그래프에 대해 쓴 글이 그래프를 오염시키면 도구가 자기 자신을 못 믿는다.
function stripCode(text) {
  return text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}

function parseLinks(body) {
  const out = [];
  const re = /\[\[([^[\]]+)\]\]/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const raw = m[1].trim();
    const gt = raw.indexOf('>');
    let type = DEFAULT_TYPE;
    let target = raw;
    if (gt !== -1) {
      type = raw.slice(0, gt).trim();
      target = raw.slice(gt + 1).trim();
    }
    if (!target) continue;
    if (target.startsWith('#')) continue; // [[#섹션-앵커]] = 문서 내부 이동, 노드 엣지가 아니다
    out.push({ type, target, known: Object.prototype.hasOwnProperty.call(TYPES, type) });
  }
  return out;
}

// 메모리 노드가 아닌 대상이라고 다 오탈자는 아니다 — 스킬을 가리키는 링크가 실제로 있다
// (content-engine-ops → synk-brand). 실재를 확인해 '외부 참조'와 '깨짐'을 가른다.
function externalKind(target) {
  const skill = path.resolve(__dirname, '..', '.claude', 'skills', target, 'SKILL.md');
  if (fs.existsSync(skill)) return '스킬';
  return null;
}

function load(dir) {
  let names;
  try {
    names = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch (_) {
    return null;
  }
  const nodes = new Map();
  for (const file of names) {
    const full = path.join(dir, file);
    const text = fs.readFileSync(full, 'utf8');
    const slug = file.replace(/\.md$/, '');
    nodes.set(slug, {
      slug,
      file,
      full,
      isIndex: INDEX_FILES.includes(file),
      links: parseLinks(stripCode(stripBacklinks(text))),
      incoming: [],
    });
  }
  // 역방향 채우기
  for (const n of nodes.values()) {
    for (const l of n.links) {
      const t = nodes.get(l.target);
      if (t) t.incoming.push({ type: l.type, from: n.slug });
    }
  }
  return nodes;
}

/* ── 진단 ────────────────────────────────────────────────────────────────── */
function diagnose(nodes) {
  const broken = [];   // 가리키는 대상 파일이 없음
  const external = []; // 메모리 밖의 실재 대상(스킬 등) — 정상
  const orphans = [];  // 들어오지도 나가지도 않음 = 그래프에서 떨어져 나온 섬
  const unknown = [];  // 미지 링크 타입(오탈자 의심)
  for (const n of nodes.values()) {
    if (n.isIndex) continue;
    for (const l of n.links) {
      if (!nodes.has(l.target) && !isDecision(l.target)) {
        const kind = externalKind(l.target);
        if (kind) external.push({ from: n.slug, target: l.target, kind });
        else broken.push({ from: n.slug, target: l.target, type: l.type });
      }
      if (!l.known) unknown.push({ from: n.slug, type: l.type, target: l.target });
    }
    // 인덱스에서 오는 링크는 '연결'로 세지 않는다 — 인덱스는 모두를 가리키므로
    // 그걸 세면 고아가 영원히 0이 되어 검사가 무의미해진다.
    const realIn = n.incoming.filter((i) => !INDEX_SLUGS.has(i.from));
    if (n.links.length === 0 && realIn.length === 0) orphans.push(n.slug);
  }

  // 인덱스 대조 — MEMORY.md의 `](파일.md)` 목록 vs 실제 파일
  const listed = new Set();
  for (const slug of INDEX_SLUGS) {
    const idx = nodes.get(slug);
    if (!idx) continue;
    const text = stripCode(fs.readFileSync(idx.full, 'utf8')); // 인덱스 머리말의 서식 설명 예시를 실제 줄로 오인하지 않게
    const re = /\]\(([^)]+?\.md)\)/g;
    let m;
    while ((m = re.exec(text)) !== null) listed.add(path.basename(m[1]).replace(/\.md$/, ''));
  }
  const missingFromIndex = [];
  const ghostInIndex = [];
  for (const n of nodes.values()) {
    if (n.isIndex) continue;
    if (!listed.has(n.slug)) missingFromIndex.push(n.slug);
  }
  for (const s of listed) if (!nodes.has(s)) ghostInIndex.push(s);

  return { broken, external, orphans, unknown, missingFromIndex, ghostInIndex };
}

/* ── 결정 큐 ─────────────────────────────────────────────────────────────── */
// A --막힘> B  는 "A가 B를 기다린다" = B가 A를 막는다.
// B를 풀면 A가 풀리고, A를 기다리던 것들도 연쇄로 풀린다 → 그 도달 집합 크기가 B의 값이다.
function decisions(nodes) {
  const waitsOn = new Map(); // A -> [B...]  (A가 기다리는 대상)
  const blocks = new Map();  // B -> [A...]  (B가 막고 있는 것)
  for (const n of nodes.values()) {
    if (n.isIndex) continue;
    for (const l of n.links) {
      if (l.type !== '막힘') continue;
      if (!waitsOn.has(n.slug)) waitsOn.set(n.slug, []);
      waitsOn.get(n.slug).push(l.target);
      if (!blocks.has(l.target)) blocks.set(l.target, []);
      blocks.get(l.target).push(n.slug);
    }
  }

  // 순환 감지 — 서로 기다리면 영원히 안 풀린다. 조용히 넘기면 순위가 거짓말을 한다.
  const cycles = [];
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const stack = [];
  function dfs(u) {
    color.set(u, GRAY);
    stack.push(u);
    for (const v of waitsOn.get(u) || []) {
      const c = color.get(v) || WHITE;
      if (c === GRAY) cycles.push([...stack.slice(stack.indexOf(v)), v]);
      else if (c === WHITE) dfs(v);
    }
    stack.pop();
    color.set(u, BLACK);
  }
  for (const u of waitsOn.keys()) if ((color.get(u) || WHITE) === WHITE) dfs(u);

  // 각 차단자가 푸는 것들(연쇄 포함)
  const ranked = [];
  for (const b of blocks.keys()) {
    const seen = new Set();
    const queue = [...(blocks.get(b) || [])];
    while (queue.length) {
      const cur = queue.shift();
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const nxt of blocks.get(cur) || []) if (!seen.has(nxt)) queue.push(nxt);
    }
    ranked.push({
      blocker: b,
      unblocks: seen.size,
      direct: (blocks.get(b) || []).length,
      items: [...seen],
      kind: isDecision(b) ? '결정' : (nodes.has(b) ? '토픽' : '미상'),
    });
  }
  ranked.sort((a, b) => b.unblocks - a.unblocks || a.blocker.localeCompare(b.blocker));
  return { ranked, cycles, waiting: waitsOn.size };
}

/* ── 역링크 쓰기 ─────────────────────────────────────────────────────────── */
function writeBacklinks(nodes) {
  let changed = 0;
  for (const n of nodes.values()) {
    if (n.isIndex) continue;
    const original = fs.readFileSync(n.full, 'utf8');
    const base = stripBacklinks(original).replace(/\s+$/, '');
    let section = '';
    if (n.incoming.length) {
      const lines = n.incoming
        .slice()
        .sort((a, b) => a.from.localeCompare(b.from))
        .map((i) => `- ${i.type} ← [[${i.from}]]`);
      section = `\n\n${MARK_START}\n## ← 역링크 (${n.incoming.length})\n${lines.join('\n')}\n${MARK_END}\n`;
    } else {
      section = '\n';
    }
    const next = base + section;
    if (next !== original) {
      fs.writeFileSync(n.full, next, 'utf8');
      changed++;
    }
  }
  return changed;
}

/* ── 출력 ────────────────────────────────────────────────────────────────── */
function main() {
  const args = process.argv.slice(2);
  /* 🔑 목록은 눈으로 정하지 않았다 — `CLI도구들()` 이 재고, 회귀 ④ 가 매번 다시 센다. */
  const 아는플래그 = ['--decisions', '--json', '--write'];
  const 플래그오류 = 인자게이트('memory-graph', args, 아는플래그);
  if (플래그오류) { console.error(`\n🔴 ${플래그오류}\n`); process.exit(1); }
  const dir = memoryDir();
  const nodes = load(dir);
  if (!nodes) {
    console.error(`[memory-graph] 메모리 디렉터리를 못 찾음: ${dir}`);
    console.error('  SYNK_MEMORY_DIR 환경변수로 직접 지정할 수 있다.');
    process.exit(1);
  }

  const totalLinks = [...nodes.values()].reduce((a, n) => a + n.links.length, 0);
  const typed = [...nodes.values()].reduce(
    (a, n) => a + n.links.filter((l) => l.type !== DEFAULT_TYPE).length, 0);

  if (args.includes('--write')) {
    const changed = writeBacklinks(nodes);
    console.log(`[memory-graph] 역링크 갱신 — ${changed}개 파일 변경 (전체 ${nodes.size - 1}개)`);
    return;
  }

  const d = diagnose(nodes);
  const dec = decisions(nodes);

  if (args.includes('--json')) {
    console.log(JSON.stringify({ dir, nodes: nodes.size, totalLinks, typed, ...d, decisions: dec }, null, 2));
    return;
  }

  if (args.includes('--decisions')) {
    console.log(`\n[결정 큐] '막힘>' 엣지 기준 — 기다리는 항목 ${dec.waiting}개\n`);
    if (!dec.ranked.length) {
      console.log('  막힘> 엣지가 아직 없다. 메모리 파일에 [[막힘>대상]]을 심으면 여기서 순위가 나온다.');
      console.log('  예) speech-quality-engine 문서에  [[막힘>유호-정원-결정]]');
    }
    for (const r of dec.ranked) {
      const flag = r.kind === '미상' ? '  ⚠대상 불명(오탈자 의심)' : ` [${r.kind}]`;
      console.log(`  ${String(r.unblocks).padStart(3)}건 해소  ←  ${r.blocker}${flag}`);
      console.log(`        ${r.items.join(', ')}`);
    }
    if (dec.cycles.length) {
      console.log('\n  ☠️ 순환 대기 — 서로 기다려서 영원히 안 풀린다:');
      for (const c of dec.cycles) console.log('    ' + c.join(' → '));
    }
    console.log('');
    return;
  }

  console.log(`\n[memory-graph] ${dir}`);
  console.log(`  노드 ${nodes.size - 1}개(+인덱스) · 엣지 ${totalLinks}개 · 그중 타입 지정 ${typed}개\n`);
  const sec = (title, items, fmt) => {
    if (!items.length) { console.log(`  ✅ ${title} — 없음`); return; }
    console.log(`  ⚠ ${title} — ${items.length}건`);
    for (const i of items.slice(0, 20)) console.log(`     ${fmt(i)}`);
    if (items.length > 20) console.log(`     … 외 ${items.length - 20}건`);
  };
  sec('깨진 링크(대상 파일 없음)', d.broken, (b) => `${b.from} --${b.type}> ${b.target}`);
  if (d.external.length) console.log(`  ℹ 외부 참조(메모리 밖 실재 대상) — ${d.external.length}건: ` + d.external.map((e) => `${e.target}(${e.kind})`).join(', '));
  sec('미지 링크 타입(오탈자 의심)', d.unknown, (u) => `${u.from}: [[${u.type}>${u.target}]] — 아는 타입: ${Object.keys(TYPES).join('·')}`);
  sec('인덱스 유령(MEMORY.md 줄은 있는데 파일 없음)', d.ghostInIndex, (g) => g);
  sec('인덱스 누락(파일은 있는데 MEMORY.md에 줄 없음)', d.missingFromIndex, (m) => m);
  sec('고아 노드(들어오지도 나가지도 않음)', d.orphans, (o) => o);
  console.log(`\n  결정 큐: 기다리는 항목 ${dec.waiting}개 · 차단자 ${dec.ranked.length}개 → 상세는 --decisions`);
  console.log(`  역링크 삽입: --write\n`);
}

if (require.main === module) main();
module.exports = { parseLinks, stripBacklinks, load, diagnose, decisions, writeBacklinks, projectDir, memoryDir, TYPES, MARK_START, MARK_END, INDEX_FILES };
