#!/usr/bin/env node
/**
 * 뇌그물 — 회사의 뇌를 «점과 선으로 이어진 한 장»으로 그린다.
 *
 * 왜 있나 (2026-09-04 · 유호님 「아틀라스를 옵시디언처럼 한눈에 확인하고싶어. 우리의 뇌인거지」):
 *   그날 시트 안 제미나이 캔버스를 실측했더니 «숫자 대시보드»는 2분에 뽑아 주는데
 *   **점·선 관계도는 못 그렸다** — 노드 종류와 색까지 말로 설계해 놓고 새 탭은 0개였다.
 *   시트가 «칸» 위에만 그림을 얹기 때문이고, 관계도는 시트가 아는 차트 종류에 아예 없다.
 *   그래서 그 지면만 우리가 짓는다(정본 판정 = docs/_ops/결정.md 2026-09-04).
 *
 * 🔑 설계 하나 — **틀과 데이터를 가른다.**
 *   `docs/뇌그물_틀.html` 이 그리는 법을 쥐고, 이 도구가 데이터를 만들어 끼운다.
 *   그래서 12월에 학생 데이터를 같은 모양으로 넣으면 **같은 지면이 그대로 아틀라스**가 된다
 *   (memory `core-engine-obsidian` 의 SYNK Atlas 자리).
 *
 * 옵시디언 실물과 갈리는 자리 넷(09-04 유호님이 화면을 보시고 짚은 것):
 *   ①색이 진단이다(갈래 넷) ②이름이 겹치면 뒤엣것을 접는다 ③누르면 이어진 곳만 밝다 ④설명으로도 찾는다
 *
 * 쓰기: node tools/뇌그물.js            → docs/SYNK_기억그물.html 생성
 *       node tools/뇌그물.js --json     → 데이터만 stdout 으로(끼우지 않는다)
 *       SYNK_MEMORY_DIR=... 로 대상 기억 폴더를 덮어쓸 수 있다(테스트용).
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const 저장소 = path.resolve(__dirname, '..');
const 틀경로 = path.join(저장소, 'docs', '뇌그물_틀.html');
const 낼곳 = path.join(저장소, 'docs', 'SYNK_기억그물.html');
const 자리표시 = '/*__DATA__*/';

// 기억 폴더 — memory-graph 와 같은 규약(작업 경로 이름에 산다)
function 기억폴더() {
  if (process.env.SYNK_MEMORY_DIR) return process.env.SYNK_MEMORY_DIR;
  // 한 글자씩 바꾼다 — `+` 를 붙이면 `C:\` 가 `-` 하나로 뭉쳐 실제 폴더명과 갈린다
  const 이름 = 저장소.replace(/[:\\/]/g, '-');
  return path.join(os.homedir(), '.claude', 'projects', 이름, 'memory');
}

function 모으기(DIR) {
  const 색인 = fs.existsSync(path.join(DIR, 'MEMORY.md')) ? fs.readFileSync(path.join(DIR, 'MEMORY.md'), 'utf8') : '';
  const 지도 = fs.existsSync(path.join(DIR, '지도.md')) ? fs.readFileSync(path.join(DIR, '지도.md'), 'utf8') : '';
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.md') && f !== 'MEMORY.md' && f !== '지도.md');

  const nodes = [], edges = [], 오늘 = Date.now();

  for (const f of files) {
    const p = path.join(DIR, f);
    const raw = fs.readFileSync(p, 'utf8');
    const st = fs.statSync(p);
    const name = f.replace(/\.md$/, '');

    let desc = '', type = '';
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fm) {
      const d = fm[1].match(/^description:\s*"?(.*?)"?\s*$/m);
      if (d) desc = d[1].replace(/\s+/g, ' ').trim();
      const t = fm[1].match(/^\s*type:\s*(.+)$/m);
      if (t) type = t[1].trim();
    }
    if (desc.length > 150) desc = desc.slice(0, 150) + '…';

    // 역링크 블록은 memory-graph 가 자동 생성한다 — 사람이 쓴 이음새만 센다(안 그러면 선이 두 배)
    const body = raw.split('<!-- memory-graph:역링크 시작')[0];
    const 본 = new Set();
    for (const m of body.matchAll(/\[\[([^\]]+)\]\]/g)) {
      const v = m[1], i = v.indexOf('>');
      const 갈래 = i > -1 ? v.slice(0, i) : '관련';
      const 대상 = i > -1 ? v.slice(i + 1) : v;
      const 열쇠 = 대상 + '|' + 갈래;
      if (본.has(열쇠)) continue;   // 한 문서가 같은 곳을 여러 번 가리켜도 선은 하나
      본.add(열쇠);
      edges.push({ s: name, t: 대상, k: 갈래 });
    }

    nodes.push({
      id: name,
      t: type || '?',
      d: desc,
      kb: Math.round(st.size / 102.4) / 10,
      out: 본.size,
      in: 0,
      days: Math.floor((오늘 - st.mtime.getTime()) / 86400000),
      // 1 = 상주(세션마다 실리는 색인에 있다) · 2 = 보존 서가 · 0 = 어디에도 없다
      live: 색인.includes('(' + name + '.md)') ? 1 : (지도.includes('(' + name + '.md)') ? 2 : 0),
    });
  }

  const 색인맵 = new Map(nodes.map(n => [n.id, n]));
  // 파일 없는 대상(결정 노드 등)은 그릴 자리가 없으니 버린다
  const 산선 = edges.filter(e => 색인맵.has(e.t) && 색인맵.has(e.s));
  for (const e of 산선) 색인맵.get(e.t).in++;

  return {
    자료: { 잰날: new Date().toISOString().slice(0, 10), nodes, edges: 산선.map(e => [e.s, e.t, e.k]) },
    버린선: edges.length - 산선.length,
  };
}

function 끼우기(자료) {
  const 틀 = fs.readFileSync(틀경로, 'utf8');
  if (!틀.includes(자리표시)) {
    console.error(`틀에 자리표시 ${자리표시} 가 없다 — ${path.relative(저장소, 틀경로)} 를 확인한다.`);
    process.exit(1);
  }
  // </script> 가 자료 안에 있으면 지면이 그 자리에서 끊긴다
  const 안전 = JSON.stringify(자료).replace(/<\//g, '<\\/');
  return 틀.replace(자리표시, 안전);
}

/* ── 실행 ─────────────────────────────────────────────────────── */
const DIR = 기억폴더();
if (!fs.existsSync(DIR)) {
  console.error(`기억 폴더가 없다: ${DIR}\n  다른 기계면 SYNK_MEMORY_DIR 로 지정하거나 node tools/기억데려오기.js 를 먼저 돌린다.`);
  process.exit(1);
}

const { 자료, 버린선 } = 모으기(DIR);

if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(자료));
  process.exit(0);
}

const 지면 = 끼우기(자료);
fs.writeFileSync(낼곳, 지면);

const 갈래 = 자료.nodes.reduce((a, n) => (a[n.t] = (a[n.t] || 0) + 1, a), {});
const 상주 = 자료.nodes.filter(n => n.live === 1).length;
const 큰것 = [...자료.nodes].sort((a, b) => b.in - a.in).slice(0, 5);
console.log(`[뇌그물] ${DIR}`);
console.log(`  점 ${자료.nodes.length} · 선 ${자료.edges.length}${버린선 ? ` (파일 없는 대상 ${버린선} 버림)` : ''}`);
console.log(`  갈래 ${Object.entries(갈래).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`  상주 ${상주} · 서가 ${자료.nodes.length - 상주}`);
console.log(`  가장 많이 인용: ${큰것.map(n => `${n.id}(${n.in})`).join(' · ')}`);
console.log(`  → ${path.relative(저장소, 낼곳)} (${(Buffer.byteLength(지면) / 1024).toFixed(0)}KB)`);
console.log(`  발행: Artifact 도구에 그 파일을 준다(같은 URL 로 갱신하려면 같은 경로로 다시 발행).`);
