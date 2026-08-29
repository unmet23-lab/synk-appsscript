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
 * MEMORY.md 가 커져 지도(어느 토픽 파일을 열까)를 상주분 밖으로 내보냈다 — MEMORY.md 에는
 * 🚫·⏳ 조각만 남고 원문 줄은 지도.md 에 있다. 한 파일만 인덱스로 세면 옮긴 98건이
 * 「인덱스 누락」으로 뜬다 — 옮긴 것과 잃은 것이 같은 모양이 되는 자리다.
 * ⚠ 목록은 여기 하나에서만 파생시킨다(두 곳에 적으면 갈라진다).
 * ⚠ 여기 「상한이 «줄»이라」고 적혀 있었다 — **08-30 에 반증됐다.** 28.6KB 판이 세션 첫 컨텍스트에
 *   끝줄까지 들어온 것을 두 세션이 각각 실측했다. 같은 주장이 이 주석(「줄」)과 지도.md(「24.4KB」)에
 *   **다른 단위로** 살아 있었고 둘 다 틀렸다. 진짜 한도는 아직 아무도 안 쟀다.
 *   쪼갠 것 자체는 옳았다(색인이 커졌다) — 틀린 것은 «까닭에 붙인 수»다. */
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
/* 🔴 표식이 «반쪽»인 파일 — 시작 표식은 있는데 끝 표식이 없다.
 * 예전 이 함수는 그때 `text.slice(0, s)` 로 **그 지점부터 파일 끝까지 통째로 버렸다.**
 * 읽기만 하는 자리에선 링크 몇 개를 놓치는 정도지만, `writeBacklinks` 가 그 결과를
 * `base` 로 삼아 다시 쓰므로 **뒷부분이 파일에서 영영 사라지고 도구는 「1개 파일 변경」으로
 * 성공을 보고한다.** 자동 쓰기를 켜기 전에 닫아야 하는 유일한 파괴 경로였다(08-30 실측 0벌 —
 * 즉 지금이 «아직 아무도 안 다친 채» 닫을 수 있는 창이다). */
function 표식깨짐(text) {
  const s = text.indexOf(MARK_START);
  return s !== -1 && text.indexOf(MARK_END, s) === -1;
}

function stripBacklinks(text) {
  // 역링크 섹션은 파싱에서 제외한다 — 넣지 않으면 자기가 만든 엣지를 다시 읽어
  // a→b→a 왕복이 매 실행마다 증식한다(자기증식 방지).
  const s = text.indexOf(MARK_START);
  if (s === -1) return text;
  const e = text.indexOf(MARK_END, s);
  // 끝 표식이 없으면 **아무것도 안 자른다.** 자르면 뒤가 사라진다(위 주석). 대신 표식깨짐()이 운다.
  if (e === -1) return text;
  return text.slice(0, s) + text.slice(e + MARK_END.length);
}

/* ── 프론트매터 ──────────────────────────────────────────────────────────────
 * 이 저장소에서 «기억 파일의 프론트매터를 읽는 코드는 여기 하나»다(08-30 신설).
 * 그전까지 0줄이었고, 그래서 08-29 에 `name:` 이 파일명과 어긋난 70벌을 기계가 **원리상**
 * 못 봤다 — 노드 키를 파일명으로만 만들었기 때문이다. 사람이 손으로 찾아 손으로 고쳤고,
 * 그것이 정본 Ⅰ-4 「같은 일이 사람 손을 두 번 거쳤다면 그것은 이미 시스템이 할 일이다」의 자리다.
 * ⚠ YAML 파서가 아니다 — 우리 기억 파일이 쓰는 평평한 `키: 값` 두 층만 읽는다.
 *   못 읽으면 «없다»가 아니라 `있나:false` 로 내서 미실행과 통과가 같은 얼굴이 안 되게 한다. */
function 프론트매터(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(text);
  if (!m) return { 있나: false };
  const 블록 = m[1];
  const 뽑기 = (키, 들여쓰기) => {
    const re = new RegExp('^' + (들여쓰기 ? '[ \\t]+' : '') + 키 + ':[ \\t]*(.*)$', 'm');
    const r = re.exec(블록);
    return r ? r[1].trim() : null;
  };
  return {
    있나: true,
    name: 뽑기('name', false),
    description: 뽑기('description', false),
    type: 뽑기('type', true),
    node_type: 뽑기('node_type', true),
    여러절: (뽑기('위생', false) || 뽑기('위생', true)) === '여러절',
  };
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
      // 위생 자가 쓰는 것들 — 원문을 여기서 이미 읽었으므로 다시 안 읽는다(재읽기 0회).
      fm: 프론트매터(text),
      본문: stripBacklinks(text),
      표식깨짐: 표식깨짐(text),
      바이트: Buffer.byteLength(text, 'utf8'),
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

/* ══ 기억 위생 ══════════════════════════════════════════════════════════════
 * 왜 여기 있나 (2026-08-30 · 유호 지시 「철학정본에 빗댄 완벽히 자동화로 구동되는 결과」):
 *   08-29 에 내가 «손으로» 기억 332벌을 감사해 `name` 불일치 70벌·`type` 없음 1벌·색인 중복 1벌을
 *   찾아 손으로 고쳤다. 그 셋을 기계는 **원리상 못 봤다** — 이 파일이 프론트매터를 한 줄도 안 읽었다.
 *   정본 Ⅰ-4 「반복되는 손일은 성실함이 아니라 시스템 결함이다 — 같은 일이 사람 손을 두 번
 *   거쳤다면 그것은 이미 시스템이 할 일이다」가 정확히 그 자리를 가리킨다.
 *
 * ■ 🔴 이 자가 지키는 «경계» — 넘으면 자동화가 아니라 판정 소실이다
 *   그 칸이 사람 앞에 있는 까닭이 **«기계가 아직 못 해서»면 기계 몫**이고,
 *                              **«기계가 하면 판정이 소실돼서»면 사람 몫**이다.
 *   앞엣것을 사람에게 넘기면 ㉡ 위반이고, 뒤엣것을 기계가 삼키면 자동화가 아니다.
 *   ⚠ 이 한 문장은 정본 :47 과 :106 을 겹쳐 만든 **조립**이고 정본에 그 형태로는 없다.
 *   ⚠ 정본 ㉡ 은 사람 칸을 **0 으로 만들라가 아니다** — 「판단이 필요한 자리 **하나**만 남긴다」이다.
 *     합격 모양은 :104 가 그린다: 「초안 3개를 붙여 넘기면 원장은 **고르고 클릭 한 번**」.
 *     ⇒ 그래서 이 자는 판정을 **한 건**만, 그러나 **후보를 달아서** 내민다(답이 한 낱말이 되게).
 *
 * ■ 무엇을 «고치나» — 하나뿐이다
 *   소비자가 실재하는 결함만 고친다. `name:`·`node_type` 은 이 저장소 안에 **읽는 코드가 0줄**이라
 *   「고쳤다」는 참이 되지만 「나아졌다」가 미측정이다 — 그래서 **판정거리로 올린다**(고치지 않는다).
 *
 * ■ 이 자가 «안 재는» 것 — 이미 재는 자가 있다(한 판정을 둘이 재면 갈린다)
 *   ⓐ `⏳` ↔ `[[막힘>]]` 어긋남 = rot-check `memorySection().unwired`
 *   ⓑ 색인 유령·누락 = 이 파일 `diagnose()`
 *   ⓒ 압축 후보(낡음×크기) = `tools/메모리실측.js`
 *   ⓓ MEMORY.md **바이트** = rot-check 상주 총량 절(옆 세션 c2 소유 · 08-29 합의)
 *
 * ■ 🔴 자를 «지어서는 안 되는» 자리 넷 — 전부 정상인데 운다(실측)
 *   연도 없는 MM-DD 표기 265벌 · 「재제안 금지」류 154벌 · `⏳` 91벌 · 12KB 초과 60벌.
 *   우는 검사는 꺼진다. 안 짓는 것이 부품이다.
 */

/** 자는 «한 곳»에만 산다 — 자가 흔들리면 「줄었다/늘었다」가 거짓이 된다. */
const 위생자판 = Object.freeze({
  판: 1,                    // 자를 고치면 이 수를 올린다 — 래칫이 «폴더가 변한 것»과 «자가 변한 것»을 가른다
  시각지문절: 4,             // 이만큼이면 「한 파일 = 한 사실」이 아니라 «세션 일지»다
  description최대: 200,
});

/* 절 제목에 박힌 «시각 지문» — 날짜·세션id·커밋해시·회차. 이게 여럿이면 일지다.
 * 해시는 «숫자를 하나라도 낀» 것만 센다(순수 알파벳 낱말이 걸리는 것을 막는다). */
const 시각지문 = /\d{4}-\d{2}-\d{2}|\b\d{2}-\d{2}\b|local_[0-9a-f]{6,}|\b(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b|\d+\s*회[전차]/;

const 래칫경로 = () => path.resolve(__dirname, '..', 'docs', '_ops', '기억래칫.json');

/**
 * 기억 폴더의 위생을 «잰다». 아무것도 안 고친다.
 * 🔑 반환은 «언제나 같은 모양»이다 — 못 쟀으면 `확인불가` 에 사유가 들고 나머지는 빈다.
 *    소비자(rot-check 한 줄)는 이 필드가 **아예 없으면** 「위생 자가 죽었다」로 울어야 한다.
 *    「0건」과 「미실행」이 같은 얼굴이면 그건 자가 아니다.
 */
function 위생(nodes, dir) {
  const 틀 = {
    자판: 위생자판.판, 대상폴더: dir || null, 잰시각: new Date().toISOString(),
    분모: 0, 확인불가: null,
    고칠것: { 역링크뒤처짐: [] },
    판정거리: { name불일치: [], node_type없음: [], type없음: [], description과길기: [], 일지형: [], 표식깨짐: [] },
  };
  if (!nodes) return { ...틀, 확인불가: '기억 폴더를 못 읽었다' };

  const 토픽 = [...nodes.values()].filter((n) => !n.isIndex);
  틀.분모 = 토픽.length;
  // 🔴 분모 0 은 «깨끗»이 아니다. 워크트리에서 딴 폴더를 가리키면 지금까지 이 얼굴이 「초록」이었다.
  if (!토픽.length) return { ...틀, 확인불가: '토픽 0벌을 읽었다 — 폴더가 비었거나 딴 곳을 가리킨다' };

  for (const n of 토픽) {
    if (n.표식깨짐) { 틀.판정거리.표식깨짐.push(n.slug); continue; }  // 이 파일은 «아무것도» 안 만진다
    const fm = n.fm || { 있나: false };
    if (!fm.있나) { 틀.판정거리.name불일치.push({ 파일: n.slug, name: null, 사유: '프론트매터 없음' }); continue; }
    if (fm.name !== n.slug) 틀.판정거리.name불일치.push({ 파일: n.slug, name: fm.name });
    if (!fm.node_type) 틀.판정거리.node_type없음.push(n.slug);
    if (!fm.type) 틀.판정거리.type없음.push(n.slug);
    if (fm.description && fm.description.length > 위생자판.description최대) {
      틀.판정거리.description과길기.push({ 파일: n.slug, 자: fm.description.length });
    }
    if (!fm.여러절) {                                   // «여러 절이 정상»이라고 파일 자신이 선언했으면 뺀다
      const 절 = (n.본문 || '').split('\n').filter((l) => /^#{2,3} /.test(l));
      const 지문절 = 절.filter((l) => 시각지문.test(l)).length;
      if (지문절 >= 위생자판.시각지문절) 틀.판정거리.일지형.push({ 파일: n.slug, 절: 지문절, 바이트: n.바이트 });
    }
    const 지금 = 역링크블록(n);
    if (지금.바뀌나) 틀.고칠것.역링크뒤처짐.push({ 파일: n.slug, 중복: 지금.중복 });
  }
  틀.판정거리.일지형.sort((a, b) => b.바이트 - a.바이트);
  return 틀;
}

/** 그 노드가 «지금 가져야 할» 역링크 블록과, 실제와 다른지. 쓰기는 안 한다(순수). */
function 역링크블록(n) {
  const 원문 = fs.readFileSync(n.full, 'utf8');
  /* 🔴 줄끝은 «이미 있는 블록의 것»을 그대로 쓴다. 블록이 없을 때만 파일의 우세한 줄끝을 따른다.
   *   두 번 좁혔다(둘 다 쓰기 «직전» 검산으로 잡았다 · 08-30):
   *     ①`includes('\r\n')` → CRLF 가 한 줄만 섞인 LF 파일까지 통째로 뒤집었다(247벌).
   *     ②「파일의 우세한 줄끝」 → 본문은 CRLF 인데 블록만 LF 인 파일 **74벌**이 여전히 뒤집혔다.
   *       그 74벌은 뜻이 하나도 안 바뀌는 쓰기고, git 이 커밋 때 되돌리면 **매 실행 진동**이 된다.
   *   ⇒ 「블록을 건드리는 목적」은 목록을 맞추는 것이지 줄끝을 통일하는 것이 아니다. */
  const s0 = 원문.indexOf(MARK_START);
  const 블록줄끝 = s0 === -1 ? null
    : (원문.slice(s0, 원문.indexOf(MARK_END, s0) + 1).includes('\r\n') ? '\r\n' : '\n');
  const crlf = (원문.match(/\r\n/g) || []).length;
  const lf = (원문.match(/\n/g) || []).length;
  const 줄끝 = 블록줄끝 || (crlf > 0 && crlf * 2 >= lf ? '\r\n' : '\n');
  const base = stripBacklinks(원문).replace(/\s+$/, '');
  // 🔴 `type|from` 으로 접는다 — 접지 않으면 같은 엣지가 여러 번 실리고 헤더 수까지 부푼다.
  const 본 = new Map();
  for (const i of n.incoming) 본.set(i.type + '|' + i.from, i);
  const 목록 = [...본.values()].sort((a, b) => a.from.localeCompare(b.from));
  const 절 = 목록.length
    ? `${줄끝}${줄끝}${MARK_START}${줄끝}## ← 역링크 (${목록.length})${줄끝}`
      + 목록.map((i) => `- ${i.type} ← [[${i.from}]]`).join(줄끝) + `${줄끝}${MARK_END}${줄끝}`
    : 줄끝;
  const 새것 = base + 절;
  return { 원문, 새것, 바뀌나: 새것 !== 원문, 중복: n.incoming.length - 목록.length };
}

/**
 * 안전 쓰기 — 임시 파일에 쓰고 갈아 끼운다. 검산에 실패하면 원문을 되돌린다.
 * 🔴 `open(p,'w')` 로 «먼저 0바이트로 만드는» 통로는 안 쓴다(08-28 에 기억 파일 하나를 그렇게 날렸다).
 * 🔴 rename 은 «시도»다 — 다른 프로세스가 그 파일을 읽기로 열고 있으면 윈도우에서 EPERM 이 난다.
 *    그때는 writeFileSync 로 떨어진다(원자성은 잃지만 파일은 산다). 잔해는 finally 가 지운다.
 */
function 안전쓰기(파일, 새것, 원문) {
  const tmp = `${파일}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, 새것, 'utf8');
    let 옮김 = false;
    for (let i = 0; i < 3 && !옮김; i++) {
      try { fs.renameSync(tmp, 파일); 옮김 = true; } catch (e) {
        if (i === 2) { fs.writeFileSync(파일, 새것, 'utf8'); 옮김 = true; }   // 폴백
      }
    }
    const 다시 = fs.readFileSync(파일, 'utf8');
    const 성함 = 다시.startsWith('---') === 원문.startsWith('---')
      && 다시.length >= stripBacklinks(원문).replace(/\s+$/, '').length
      && (!/^name:/m.test(원문) || /^name:/m.test(다시));
    if (!성함) { fs.writeFileSync(파일, 원문, 'utf8'); return { 됐나: false, 사유: '쓰기 뒤 검산 실패 — 되돌렸다' }; }
    return { 됐나: true };
  } catch (e) {
    return { 됐나: false, 사유: String(e.message || e).slice(0, 160) };
  } finally {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch { /* 잔해는 .gitignore 가 둘째 겹 */ }
  }
}

/* ── 폴더 잠금 — 여섯 세션이 같이 도는 기계다 ────────────────────────────────
 * 🔴 둘이 동시에 고치면 파일이 깨지는 게 아니라(안전쓰기가 막는다) **「고쳤다 N」이 무작위**가 된다.
 *   그리고 서로의 중간 상태를 base 로 읽어 같은 파일을 번갈아 다시 쓴다.
 * 잠금은 «못 잡으면 물러난다» — 남의 것을 죽이지 않는다(이 저장소가 굽기에서 배운 그 규율).
 * ⚠ 고아 잠금이 영원히 막지 않게 나이를 본다. 90초면 한 벌 고치기(실측 수 초)의 열 배가 넘는다. */
const 잠금나이_ms = 90 * 1000;

function 잠금잡기(dir) {
  const p = path.join(dir, '.위생잠금');
  try {
    const 나 = JSON.stringify({ pid: process.pid, 때: new Date().toISOString() });
    try { fs.writeFileSync(p, 나, { flag: 'wx' }); return { 잡았나: true, 놓기: () => { try { fs.unlinkSync(p); } catch { /* 이미 없다 */ } } }; }
    catch (e) {
      if (e.code !== 'EEXIST') return { 잡았나: false, 사유: String(e.code || e.message) };
      const 나이 = Date.now() - fs.statSync(p).mtimeMs;
      if (나이 < 잠금나이_ms) return { 잡았나: false, 사유: '다른 세션이 쓰는 중' };
      fs.unlinkSync(p);                                   // 고아 잠금 — 걷고 다시 시도
      fs.writeFileSync(p, 나, { flag: 'wx' });
      return { 잡았나: true, 고아걷음: true, 놓기: () => { try { fs.unlinkSync(p); } catch { /* 이미 없다 */ } } };
    }
  } catch (e) { return { 잡았나: false, 사유: String(e.message || e).slice(0, 80) }; }
}

/* 🔴 훅이 «스스로» 고쳐도 되는 크기의 상한.
 *   작은 표류(한둘)는 기계가 조용히 낫는 것이 옳다 — 그게 ㉡ 이 요구하는 모양이다.
 *   그런데 **뭉텅이**는 다르다: 첫 정리 때 198벌이었고, 그런 사건은 «제 커밋»으로 서야
 *   그날의 진짜 기억 변경이 그 안에 묻히지 않는다. 그래서 넘으면 고치지 않고 «말한다».
 *   값의 근거: 평시 실측은 0~3벌이고 198벌이 뭉텅이였다. 20 은 그 사이에서 평시 쪽에 가깝게 잡았다. */
const 훅자동교정_상한 = 20;

/** 무판정 교정 «하나»만 한다 — 역링크 블록 동기화. 그 밖엔 손대지 않는다. */
function 위생고치기(nodes) {
  const 고친것 = []; const 못고친것 = [];
  for (const n of nodes.values()) {
    if (n.isIndex || n.표식깨짐) continue;
    const b = 역링크블록(n);
    if (!b.바뀌나) continue;
    const r = 안전쓰기(n.full, b.새것, b.원문);
    (r.됐나 ? 고친것 : 못고친것).push({ 파일: n.slug, 중복: b.중복, 사유: r.사유 });
  }
  return { 고친것, 못고친것, 직전동기화커밋: 직전커밋() };
}

function 직전커밋() {
  try {
    // stderr 를 삼킨다 — 기억 폴더가 git 이 아닐 수도 있고(시험용 사본), 그 소음이 훅 화면에 새면 안 된다.
    return require('child_process')
      .execFileSync('git', ['-C', memoryDir(), 'rev-parse', '--short', 'HEAD'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
}

/* ── 래칫 — 오늘 값을 상한으로 삼되, «빚»은 따로 센다 ──────────────────────────
 * 🔴 상한만 두면 오늘의 일지형 46벌이 곧 «통과선»이 되어 사람 앞에 **영원히 0번** 온다.
 *   그래서 값을 둘로 가른다: `신규상한`(늘면 빨강) + `잔고`(줄여야 할 빚 · 0 이 될 때까지 판정 자리를 차지).
 * 🔴 조이기엔 유예를 건다 — 연속 두 번 같은 값일 때만 내린다. 동기화 중에 잠깐 낮게 읽힌
 *   세션 하나로 바닥이 박히면 그 뒤 모든 세션이 빨개지고, 그게 「검사를 끄는」 방아쇠다.
 * 값을 사람이 적는 칸은 없다(정본 :149 「값도 상태도 손으로 적지 않는다」). */
function 래칫(현재, 폴더) {
  const p = 래칫경로();
  /* 🔴 상한은 «폴더마다» 따로 산다. 안 가르면 사본(SYNK_MEMORY_DIR)에 대고 한 번 돌린 값이
   *   진짜 폴더의 상한이 되어 거짓 경보가 난다 — 08-30 에 실제로 「0→198 늘었다」가 났다.
   *   자를 짓다가 자기가 «자가 둘» 병에 걸린 자리다. 워크트리 포크(312벌)도 같은 이유로 갈린다. */
  const 칸 = String(폴더 || memoryDir());
  let 전체 = {};
  try { 전체 = JSON.parse(fs.readFileSync(p, 'utf8')) || {}; } catch { /* 없으면 오늘이 첫 판이다 */ }
  let 옛 = 전체[칸];
  if (!옛 || 옛.자판 !== 위생자판.판) 옛 = { 자판: 위생자판.판, 상한: {}, 잔고: {}, 대기: {} };
  const 넘음 = [];
  const 새 = { 자판: 위생자판.판, 갱신: new Date().toISOString(), 상한: {}, 잔고: {}, 대기: {} };
  for (const [갈래, 수] of Object.entries(현재)) {
    const 상 = Object.prototype.hasOwnProperty.call(옛.상한, 갈래) ? 옛.상한[갈래] : 수;
    if (수 > 상) 넘음.push({ 갈래, 수, 상한: 상 });
    // 조이기 유예 — 같은 값이 연속 두 번 나와야 상한을 내린다.
    const 대기 = 옛.대기 && 옛.대기[갈래] === 수 ? 수 : null;
    새.상한[갈래] = 수 < 상 ? (대기 === 수 ? 수 : 상) : 상;
    새.대기[갈래] = 수 < 상 ? 수 : null;
    새.잔고[갈래] = 수;
  }
  전체[칸] = 새;
  try { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(전체, null, 2) + '\n', 'utf8'); }
  catch { /* 못 써도 재는 것은 됐다 — 조용히 넘어가되 넘음은 그대로 낸다 */ }
  return { 넘음, 잔고: 새.잔고 };
}

/* ── 훅이 부르는 «한 줄» ─────────────────────────────────────────────────────
 * 평시엔 가장 짧은 한 줄. 판정거리가 있으면 **한 건만**, 후보를 달아서.
 * 던지지 않는다 — 세션을 막으면 다음 사람이 이 훅을 끈다. */
function 위생훅줄() {
  const 줄 = [];
  try {
    const dir = memoryDir();
    const nodes = load(dir);
    const w = 위생(nodes, dir);
    const 짧폴더 = String(dir).replace(/^.*[\\/]projects[\\/]/, '…/');
    const 때 = new Date().toLocaleTimeString('ko-KR', { hour12: false });

    if (w.확인불가) return `🧠 기억 위생 — 확인 불가: ${w.확인불가} (${짧폴더})`;
    // 🔴 자가 둘인 얼굴 — 잰 폴더와 이 세션이 읽는 폴더가 다르면 그건 «깨끗»이 아니다.
    if (w.대상폴더 && w.대상폴더 !== memoryDir()) {
      return `🧠 🔴 기억 자가 둘이다 — ${w.대상폴더} 를 쟀고 이 세션은 ${memoryDir()} 를 읽는다`;
    }

    const 판정 = [
      ['표식깨짐', w.판정거리.표식깨짐, (x) => `${x.length}벌 — 역링크 표식이 반쪽이다(자동 교정에서 뺀다)`],
      ['name 불일치', w.판정거리.name불일치, (x) => `${x.length}벌 — ${x[0].파일} 의 name=${x[0].name} · ⓐ파일명으로 ⓑname 으로 ⓒ둔다`],
      ['일지형', w.판정거리.일지형, (x) => `${x[0].파일}(${(x[0].바이트 / 1024).toFixed(0)}KB · 지문절 ${x[0].절}) — ⓐ닫힌 회차 걷기 ⓑ지도.md 로 ⓒ그대로`],
      ['node_type 없음', w.판정거리.node_type없음, (x) => `${x.length}벌 — 이 저장소 소비자 0건(하네스가 읽는지 안 재봤다) · ⓐ채운다 ⓑ먼저 잰다 ⓒ둔다`],
      ['type 없음', w.판정거리.type없음, (x) => `${x.length}벌`],
      ['description 과길기', w.판정거리.description과길기, (x) => `${x.length}벌 — ${x[0].파일} ${x[0].자}자`],
    ].filter(([, x]) => x.length);



    /* 🔴 여기서 «고친다» — 보고만 하면 미완성이다(정본 ㉡: 「누가 매번 확인하면 된다」는 미룬 결함).
     * 세 겹으로 좁혔다: ①정답이 하나인 것만(역링크) ②상한 안(뭉텅이는 제 커밋으로) ③잠금을 잡았을 때만. */
    let 고침 = null;
    const 고칠전 = w.고칠것.역링크뒤처짐.length;
    if (고칠전 && 고칠전 <= 훅자동교정_상한) {
      const L = 잠금잡기(dir);
      if (L.잡았나) { try { 고침 = 위생고치기(nodes); } finally { L.놓기(); } }
      else 고침 = { 미룸: L.사유 };
    }

    const 고칠 = 고침 && 고침.고친것 ? 고칠전 - 고침.고친것.length : 고칠전;
    const 머리 = `🧠 기억 ${w.분모}벌`;
    const 고쳤다 = 고침 && 고침.고친것 && 고침.고친것.length
      ? ` · 스스로 고침 ${고침.고친것.length}벌(역링크)` : '';
    /* 🔴 래칫은 «고친 뒤» 수로 잰다. 고치기 전 수로 재면 스스로 고쳐 놓고 그 자리에서
     *   「늘었다 0→16」이라 우는 자기모순이 난다(08-30 실측 — 자기가 낫게 한 것을 자기가 경보했다).
     *   래칫이 물어야 하는 것은 «남은 빚»이지 «지나간 표류»가 아니다. */
    const r = 래칫(Object.fromEntries([
      ...판정.map(([이름, x]) => [이름, x.length]),
      ['역링크뒤처짐', 고칠],
    ]), dir);

    if (!판정.length && !고칠) return `${머리}${고쳤다} · 위생 깨끗 (${때} · ${짧폴더})`;

    if (판정.length) {
      const [이름, 것, 문구] = 판정[0];
      줄.push(`${머리} · 판정 1건 — ${이름}: ${문구(것)}  ← 답은 한 낱말`);
      const 나머지 = 판정.slice(1);
      if (나머지.length) 줄.push(`   다음 차례: ${나머지.map(([n, x]) => `${n} ${x.length}`).join(' · ')}`);
    } else {
      줄.push(머리 + 고쳤다);
    }
    if (판정.length && 고쳤다) 줄.push(`  ${고쳤다.replace(/^ · /, '')}`);
    if (고칠) {
      /* 남은 것이 있는 세 가지 까닭을 «가려서» 말한다 — 뭉뚱그리면 왜 안 고쳤는지 모른다. */
      const 왜 = 고침 && 고침.미룸 ? `잠금 못 잡음(${고침.미룸})`
        : 고칠전 > 훅자동교정_상한 ? `뭉텅이라 안 건드린다(상한 ${훅자동교정_상한}) — 제 커밋으로 세울 자리다`
          : '못 고친 것이 남았다';
      줄.push(`   고칠 것 ${고칠}벌(역링크) · ${왜} — node tools/memory-graph.js --위생고침`);
    }
    if (r.넘음.length) 줄.push(`   🔴 늘었다: ${r.넘음.map((x) => `${x.갈래} ${x.상한}→${x.수}`).join(' · ')}`);
    return 줄.join('\n');
  } catch (e) {
    return `🧠 기억 위생 — 확인 불가(자가 스스로 넘어졌다): ${String(e.message || e).slice(0, 120)}`;
  }
}

/* ── 출력 ────────────────────────────────────────────────────────────────── */
function main() {
  const args = process.argv.slice(2);
  /* 모르는 낱말을 삼키지 않는다 — 지금까지 `--바나나` 가 EXIT 0 으로 통과해
   * 「딴 과녁을 재고 초록」이 됐다(08-30 실행 확인). 도구 스물 남짓이 이미 쓰는 공용 판정을 건다. */
  const { 인자게이트 } = require('./lib/인자게이트.js');
  const 막을말 = 인자게이트('memory-graph', args,
    ['--decisions', '--write', '--json', '--위생', '--위생고침', '--훅줄']);
  if (막을말) { console.error(막을말); process.exit(2); }

  const dir = memoryDir();
  /* 🔴 `--훅줄` 은 조기 종료 «앞»에 둔다 — 폴더를 못 읽는 것이야말로 이 줄이 말해야 하는 사건이다.
   *   아래로 두면 CLI 는 일반 오류로 빠지고 훅(require 경로)만 「확인 불가」를 내서 **두 통로가
   *   다른 얼굴**이 된다. 그러면 「자가 죽었을 때 무엇이 보이나」의 답이 부르는 자리마다 달라진다. */
  if (args.includes('--훅줄')) { console.log(위생훅줄()); return; }

  const nodes = load(dir);
  if (!nodes) {
    console.error(`[memory-graph] 메모리 디렉터리를 못 찾음: ${dir}`);
    console.error('  SYNK_MEMORY_DIR 환경변수로 직접 지정할 수 있다.');
    process.exit(1);
  }

  const totalLinks = [...nodes.values()].reduce((a, n) => a + n.links.length, 0);
  const typed = [...nodes.values()].reduce(
    (a, n) => a + n.links.filter((l) => l.type !== DEFAULT_TYPE).length, 0);

  if (args.includes('--위생') || args.includes('--위생고침')) {
    const w = 위생(nodes, dir);
    if (w.확인불가) { console.error(`[기억 위생] 확인 불가 — ${w.확인불가} (${dir})`); process.exit(1); }
    console.log(`\n[기억 위생] ${dir}\n  토픽 ${w.분모}벌 · 자판 v${w.자판} · ${new Date(w.잰시각).toLocaleString('ko-KR', { hour12: false })}\n`);
    const 표 = (제목, 것, 줄) => {
      if (!것.length) { console.log(`  ✅ ${제목} — 없음`); return; }
      console.log(`  ⚠ ${제목} — ${것.length}건`);
      for (const x of 것.slice(0, 12)) console.log(`     ${줄(x)}`);
      if (것.length > 12) console.log(`     … 외 ${것.length - 12}건`);
    };
    console.log('  ── 기계 몫(정답이 하나) ──');
    표('역링크 뒤처짐', w.고칠것.역링크뒤처짐, (x) => `${x.파일}${x.중복 ? ` (중복 ${x.중복}건)` : ''}`);
    console.log('\n  ── 사람 몫(정답이 여럿 · 기계가 삼키면 판정 소실) ──');
    표('표식깨짐(고치지 않는다)', w.판정거리.표식깨짐, (x) => x);
    표('name ↔ 파일명 불일치', w.판정거리.name불일치, (x) => `${x.파일} · name=${x.name}${x.사유 ? ` (${x.사유})` : ''}`);
    표('node_type 없음', w.판정거리.node_type없음, (x) => x);
    표('type 없음', w.판정거리.type없음, (x) => x);
    표('description 과길기', w.판정거리.description과길기, (x) => `${x.파일} ${x.자}자`);
    표(`일지형(지문절 ${위생자판.시각지문절}+)`, w.판정거리.일지형, (x) => `${x.파일} · 지문절 ${x.절} · ${(x.바이트 / 1024).toFixed(0)}KB`);

    if (args.includes('--위생고침')) {
      const r = 위생고치기(nodes);
      console.log(`\n  고쳤다 — 역링크 ${r.고친것.length}벌${r.못고친것.length ? ` · 못 고침 ${r.못고친것.length}벌` : ''}`);
      for (const x of r.못고친것) console.log(`     🔴 ${x.파일} — ${x.사유}`);
      if (r.고친것.length && r.직전동기화커밋) {
        /* 🔴 되돌리기는 `checkout -- 파일` 이 아니다 — 기억 폴더는 **10분마다** 자동 커밋·푸시된다
         *   (SYNK_MemoryPush 트리거 PT10M). 그 창이 지나면 그 명령은 아무것도 안 되돌린다.
         *   그래서 «실행 직전 해시»를 박아 낸다. */
        console.log(`     되돌리려면: git -C "${dir}" checkout ${r.직전동기화커밋} -- <파일>`);
      }
    } else if (w.고칠것.역링크뒤처짐.length) {
      console.log(`\n  고치려면: node tools/memory-graph.js --위생고침`);
    }
    console.log('');
    return;
  }

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
module.exports = {
  parseLinks, stripBacklinks, load, diagnose, decisions, writeBacklinks,
  projectDir, memoryDir, TYPES, MARK_START, MARK_END, INDEX_FILES,
  // 기억 위생(2026-08-30) — 자는 여기 하나뿐이다.
  프론트매터, 표식깨짐, 위생, 위생고치기, 역링크블록, 안전쓰기, 위생훅줄, 위생자판, 잠금잡기, 훅자동교정_상한,
};
