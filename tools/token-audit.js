#!/usr/bin/env node
// token-audit — 세션 전사에서 토큰 소비를 **실측**한다 (읽기 전용)
//
// 왜 있나 — 2026-08-04 유호님 「토큰이 너무 많다」에 답하려는데 잴 수단이 없어
// 매번 추정하게 됐다. 그 자리에서 만든 집계가 실측으로 전제를 뒤집었다:
// 지침 압축(예상 범인)은 4~5%가 상한이고, 실제 범인은 **컨텍스트 재읽기 88%**와
// **도구 결과의 89%를 먹은 이미지**였다. 정본 = memory `token-audit-2026-08-04`.
//
// 쓰는 법:
//   node tools/token-audit.js              # 최근 7일
//   node tools/token-audit.js --days 1     # 오늘치
//   node tools/token-audit.js --tools      # 도구별 컨텍스트 점유까지(느림)
//   node tools/token-audit.js --dir <경로> # 전사 폴더 지정(테스트·다른 프로젝트)
//
// ⚠ 전사는 **repo 밖**(~/.claude/projects)에 산다 — 없으면 조용히 통과하지 말고
//   그 사실을 말한다(통과와 미실행이 같은 모양이면 안 된다).
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

// 실제 과금 비율(입력 1 기준) — 캐시읽기는 싸고 출력은 비싸다.
// 절대액이 아니라 **어디를 고쳐야 효과가 큰지**를 가르는 용도다.
const W = { read: 0.1, create: 1.25, input: 1, output: 5 };

function parseArgs(argv) {
  const a = { days: 7, tools: false, dir: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--days') a.days = Number(argv[i + 1]) || 7;
    else if (argv[i] === '--tools') a.tools = true;
    else if (argv[i] === '--dir') a.dir = argv[i + 1];
  }
  return a;
}

function defaultDir() {
  // 프로젝트 경로 → 전사 폴더 이름(구분자를 -로 바꾼 형태)
  const slug = process.cwd().replace(/[\\/:]/g, '-');
  return path.join(os.homedir(), '.claude', 'projects', slug);
}

const n = (x) => Number(x || 0);
const fmt = (x) => x.toLocaleString('en-US');

async function scanFile(file, wantTools) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  const s = { turns: 0, input: 0, create: 0, read: 0, output: 0, firstIn: null, tools: {} };
  const useName = wantTools ? new Map() : null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    let j;
    try { j = JSON.parse(line); } catch (_) { continue; }
    const u = j && j.message && j.message.usage;
    if (u) {
      const total = n(u.input_tokens) + n(u.cache_creation_input_tokens) + n(u.cache_read_input_tokens);
      if (s.firstIn === null && total > 1000) s.firstIn = total; // 세션 시작 오버헤드
      s.turns += 1;
      s.input += n(u.input_tokens);
      s.create += n(u.cache_creation_input_tokens);
      s.read += n(u.cache_read_input_tokens);
      s.output += n(u.output_tokens);
    }
    if (!wantTools) continue;
    const content = j && j.message && j.message.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (b.type === 'tool_use') useName.set(b.id, b.name);
      if (b.type === 'tool_result') {
        const name = useName.get(b.tool_use_id) || 'unknown';
        let chars = 0;
        let imgs = 0;
        // 이미지의 base64도 **실제로 컨텍스트에 실리는 양**이라 함께 센다.
        const walk = (v) => {
          if (typeof v === 'string') chars += v.length;
          else if (Array.isArray(v)) v.forEach(walk);
          else if (v && typeof v === 'object') {
            if (v.type === 'image') { imgs += 1; chars += ((v.source && v.source.data) || '').length; }
            else Object.values(v).forEach(walk);
          }
        };
        walk(b.content);
        const t = s.tools[name] || (s.tools[name] = { chars: 0, imgs: 0, calls: 0 });
        t.chars += chars; t.imgs += imgs; t.calls += 1;
      }
    }
  }
  return s;
}

async function main() {
  const a = parseArgs(process.argv);
  const dir = a.dir || defaultDir();
  if (!fs.existsSync(dir)) {
    console.log(`[token-audit] 전사 폴더가 없다: ${dir}`);
    console.log('  (전사는 repo 밖에 산다 — 다른 기계·클라우드 세션에서는 잴 수 없다. --dir 로 지정할 수 있다.)');
    process.exit(0);
  }
  const since = Date.now() - a.days * 86400000;
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => ({ f, st: fs.statSync(path.join(dir, f)) }))
    .filter((x) => x.st.mtime.getTime() >= since)
    .sort((x, y) => x.st.mtime - y.st.mtime);

  if (!files.length) {
    console.log(`[token-audit] 최근 ${a.days}일 전사 없음 (${dir})`);
    process.exit(0);
  }

  const rows = [];
  for (const { f, st } of files) {
    const s = await scanFile(path.join(dir, f), a.tools);
    rows.push(Object.assign({ id: f.slice(0, 8), at: st.mtime.toISOString().slice(5, 16).replace('T', ' ') }, s));
  }

  const sum = (k) => rows.reduce((t, r) => t + r[k], 0);
  const weighted = sum('read') * W.read + sum('create') * W.create + sum('input') * W.input + sum('output') * W.output;

  console.log(`\n=== 토큰 실측 — 최근 ${a.days}일 · 세션 ${rows.length}개 ===\n`);
  console.log('id       시각          턴수      캐시읽기      캐시생성        출력   턴당비용');
  for (const r of rows) {
    const per = r.turns ? Math.round((r.read + r.create) / r.turns) : 0;
    console.log(
      `${r.id} ${r.at}  ${String(r.turns).padStart(5)} ${fmt(r.read).padStart(13)} ${fmt(r.create).padStart(13)} ${fmt(r.output).padStart(11)} ${fmt(per).padStart(10)}`
    );
  }

  console.log('\n--- 어디로 갔나 (가중 환산: 읽기 0.1× · 생성 1.25× · 출력 5×) ---');
  const parts = [
    ['컨텍스트 재읽기', sum('read') * W.read, sum('read')],
    ['캐시 생성', sum('create') * W.create, sum('create')],
    ['출력', sum('output') * W.output, sum('output')],
    ['순입력', sum('input') * W.input, sum('input')],
  ].sort((x, y) => y[1] - x[1]);
  for (const [label, w, raw] of parts) {
    console.log(`  ${String((w / weighted * 100).toFixed(1)).padStart(5)}%  ${label.padEnd(16)} 원값 ${fmt(raw)}`);
  }

  const fi = rows.map((r) => r.firstIn).filter(Boolean).sort((x, y) => x - y);
  if (fi.length) {
    console.log(`\n  세션 시작 오버헤드(지침·메모리·도구정의): 중앙값 ${fmt(fi[Math.floor(fi.length / 2)])}`);
    console.log(`  → 세션 ${rows.length}개 전부 합쳐도 가중 비용의 ${(fi.reduce((t, x) => t + x, 0) * W.create / weighted * 100).toFixed(2)}%.`);
    console.log('    긴 세션의 누적 재읽기가 압도적이다 — **세션은 짧게 끊는 편이 싸다.**');
  }

  if (a.tools) {
    const all = {};
    for (const r of rows) {
      for (const [k, v] of Object.entries(r.tools)) {
        const t = all[k] || (all[k] = { chars: 0, imgs: 0, calls: 0 });
        t.chars += v.chars; t.imgs += v.imgs; t.calls += v.calls;
      }
    }
    const tot = Object.values(all).reduce((t, v) => t + v.chars, 0) || 1;
    console.log('\n--- 도구가 컨텍스트에 넣은 양 (한 번 실리면 남은 턴 내내 재청구된다) ---');
    console.log('  점유    문자수      이미지  호출   도구');
    Object.entries(all).sort((x, y) => y[1].chars - x[1].chars).slice(0, 12).forEach(([k, v]) => {
      console.log(`  ${String((v.chars / tot * 100).toFixed(1)).padStart(5)}% ${fmt(v.chars).padStart(11)} ${String(v.imgs).padStart(6)} ${String(v.calls).padStart(6)}   ${k}`);
    });
  } else {
    console.log('\n  (도구별 점유는 --tools · 이미지가 대부분이면 read_page·find·get_page_text 로 갈아탄다)');
  }
  console.log('');
}

main().catch((e) => { console.error('[token-audit] 실패:', e.message); process.exit(1); });
