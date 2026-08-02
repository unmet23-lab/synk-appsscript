#!/usr/bin/env node
// friction — 마찰 신호를 세는 장부. 1인 규모의 eval.
//
// 왜 있나: CLAUDE.md는 마찰 신호를 "진화의 연료"라 부르는데, 지금까지 그 연료는
// **기록만 되고 세어지지 않았다.** 지침이 v6.10까지 오는 동안 어느 개정이 실제로 작동했는지
// 잴 수단이 없었다. 풀 eval 하네스는 1인 규모에 유지비가 효용을 넘으니, 세는 것부터 한다.
//
// 사용법:
//   node tools/friction.js                          집계
//   node tools/friction.js add 실수 "설명"           신호 추가(오늘 날짜, ID 자동)
//   node tools/friction.js add 교정 "설명" --date 2026-08-01
//   node tools/friction.js resolve F006 "무엇이 막았나"
//   node tools/friction.js --open                   살아있는 신호만
'use strict';
const fs = require('fs');
const path = require('path');

// 테스트는 실제 장부를 건드리면 안 된다 — 회귀 테스트가 기록을 오염시키면 그 기록은 증거가 못 된다
const LEDGER = process.env.SYNK_FRICTION_LEDGER || path.resolve(__dirname, '..', 'docs', '_ops', '마찰신호.md');
const KINDS = ['교정', '거절', '실수', '마찰'];

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function read() {
  const text = fs.readFileSync(LEDGER, 'utf8');
  const lines = text.split('\n');
  const rows = [];
  lines.forEach((line, i) => {
    const m = /^\|\s*(F\d+)\s*\|(.*)\|\s*$/.exec(line.trim());
    if (!m) return;
    const cells = m[2].split('|').map((c) => c.trim());
    rows.push({ id: m[1], date: cells[0], kind: cells[1], signal: cells[2], resolved: cells[3] || '', line: i });
  });
  return { text, lines, rows };
}

function nextId(rows) {
  const max = rows.reduce((a, r) => Math.max(a, parseInt(r.id.slice(1), 10) || 0), 0);
  return 'F' + String(max + 1).padStart(3, '0');
}

function add(kind, signal, date) {
  if (!KINDS.includes(kind)) {
    console.error(`[friction] 종류는 ${KINDS.join('·')} 중 하나여야 한다 (받은 값: ${kind})`);
    process.exit(1);
  }
  if (!signal || !signal.trim()) {
    console.error('[friction] 신호 설명이 비었다. 무엇이 마찰이었는지 한 문장으로 적는다.');
    process.exit(1);
  }
  // '|'는 표를 깨뜨린다 — 삼키지 말고 치환해서 장부가 파싱 불가가 되는 것을 막는다
  const safe = signal.replace(/\|/g, '/').replace(/\n/g, ' ').trim();
  const { lines, rows } = read();
  const id = nextId(rows);
  const row = `| ${id} | ${date || today()} | ${kind} | ${safe} | |`;
  // 표의 마지막 행 뒤에 넣는다(파일 끝이 아니라) — 아래에 다른 서술이 붙어도 안전하게
  let at = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^\|\s*F\d+\s*\|/.test(lines[i].trim())) { at = i + 1; break; }
  }
  lines.splice(at, 0, row);
  fs.writeFileSync(LEDGER, lines.join('\n'), 'utf8');
  console.log(`  + ${id}  ${kind}  ${safe}`);
}

function resolve(id, by) {
  const { lines, rows } = read();
  const r = rows.find((x) => x.id.toUpperCase() === String(id).toUpperCase());
  if (!r) {
    console.error(`[friction] ${id} 를 못 찾았다.`);
    process.exit(1);
  }
  if (r.resolved) {
    console.error(`[friction] ${r.id} 는 이미 해소로 기록돼 있다: ${r.resolved}`);
    process.exit(1);
  }
  const safe = String(by || '').replace(/\|/g, '/').trim();
  if (!safe) {
    console.error('[friction] 무엇이 이 신호를 막았는지 적는다(조항·훅·커밋). 빈 해소는 기록하지 않는다.');
    process.exit(1);
  }
  lines[r.line] = `| ${r.id} | ${r.date} | ${r.kind} | ${r.signal} | ${safe} |`;
  fs.writeFileSync(LEDGER, lines.join('\n'), 'utf8');
  console.log(`  ✔ ${r.id} 해소 → ${safe}`);
}

function report(openOnly) {
  const { rows } = read();
  const open = rows.filter((r) => !r.resolved);
  const closed = rows.filter((r) => r.resolved);

  if (openOnly) {
    console.log(`\n[마찰 신호] 살아있는 신호 ${open.length}건\n`);
    for (const r of open) console.log(`  ${r.id}  ${r.date}  [${r.kind}]  ${r.signal}`);
    console.log('');
    return;
  }

  console.log(`\n[마찰 신호] 전체 ${rows.length}건 · 해소 ${closed.length} · 살아있음 ${open.length}\n`);

  console.log('  종류별 (살아있음/전체):');
  for (const k of KINDS) {
    const all = rows.filter((r) => r.kind === k);
    if (!all.length) continue;
    const o = all.filter((r) => !r.resolved).length;
    const bar = '█'.repeat(all.length);
    console.log(`    ${k}  ${String(o).padStart(2)}/${String(all.length).padStart(2)}  ${bar}`);
  }

  // 어느 장치가 실제로 신호를 막았나 — 이게 "지침이 작동했는가"의 유일한 실측치
  console.log('\n  해소 수단별 (무엇이 실제로 막았나):');
  const byMeans = new Map();
  for (const r of closed) {
    const key = r.resolved.replace(/^\d{4}-\d{2}-\d{2}\s*/, '');
    byMeans.set(key, (byMeans.get(key) || 0) + 1);
  }
  for (const [k, v] of [...byMeans].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(v).padStart(2)}건  ${k}`);
  }

  if (open.length) {
    console.log('\n  ⚠ 살아있는 신호 — /evolve 의 개정 재료:');
    for (const r of open) console.log(`    ${r.id}  ${r.date}  [${r.kind}]  ${r.signal}`);
  }

  // 월별 추이 — 신호가 줄고 있는지가 하네스가 나아지는지의 신호
  const byMonth = new Map();
  for (const r of rows) {
    const m = (r.date || '').slice(0, 7);
    if (!m) continue;
    byMonth.set(m, (byMonth.get(m) || 0) + 1);
  }
  console.log('\n  월별 발생:');
  for (const [m, v] of [...byMonth].sort()) console.log(`    ${m}  ${'▇'.repeat(v)} ${v}`);
  console.log('');
}

function main() {
  const args = process.argv.slice(2);
  if (!fs.existsSync(LEDGER)) {
    console.error(`[friction] 장부가 없다: ${LEDGER}`);
    process.exit(1);
  }
  const cmd = args[0];
  if (cmd === 'add') {
    const di = args.indexOf('--date');
    const date = di !== -1 ? args[di + 1] : null;
    const rest = di !== -1 ? args.slice(1, di) : args.slice(1);
    add(rest[0], rest.slice(1).join(' '), date);
  } else if (cmd === 'resolve') {
    resolve(args[1], args.slice(2).join(' '));
  } else {
    report(args.includes('--open'));
  }
}

if (require.main === module) main();
module.exports = { read, nextId, LEDGER, KINDS };
