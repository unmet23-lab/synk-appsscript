#!/usr/bin/env node
'use strict';
/* 관문 대조 — 편마다 우리 관문 판정(장부 상태 칸)과 실제 반응(평소 대비 배수)을 한 줄씩 본다(2026-11-08, AI 없음 · 읽기만).
 * 셈과 규칙은 tools/lib/관문대조.js. 3시간 성과 판정(tools/게시성과.js)이 요약 docs/마케팅/게시성과.md 「관문과 실제 반응」 절에 줄마다 셈을 붙이고,
 * 이 명령은 편마다 다 보여 준다.
 *
 *   node tools/관문대조.js [--날 30] [--json] [--저장소 <경로>]
 */
const path = require('node:path');
const 도구 = require('./게시성과.js');
const 편 = require('./lib/게시성과편.js');
const 연결 = require('./lib/게시성과연결.js');
const 관문 = require('./lib/관문대조.js');

const argValue = name => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };

function 판정목록(repo) {
  const ledger = 도구.readLedger(path.join(repo, 'docs', '_ops', '게시성과.jsonl'));
  const connections = 연결.latest(ledger);
  const usable = ledger.filter(l => !connections.has(l.post) || connections.get(l.post).group === '콘텐츠');
  const index = 편.buildIndex(path.join(repo, 'docs', '마케팅'), connections);
  const judgments = [...도구.latestJudgments(usable).values()].map(l => {
    const found = index.resolve(l.post);
    return found && found.info ? { ...l, folder: found.info.folder, account: found.account || l.account } : l;
  });
  return { judgments, index };
}

function main() {
  const repo = path.resolve(argValue('--저장소') || path.join(__dirname, '..'));
  const 날 = Math.max(1, Number(argValue('--날') || 30) || 30);
  const { judgments, index } = 판정목록(repo);
  const rows = 관문.표({ judgments, index, 날 });
  if (process.argv.includes('--json')) { console.log(JSON.stringify({ rows, 셈: 관문.셈(rows), 자리: 관문.자리셈(rows) }, null, 2)); return; }
  console.log(`관문 대조 · 최근 ${날}일 · 편 ${rows.length}개(배수를 잰 편 ${rows.filter(r => r.배수 !== null).length})`);
  console.log('게시(KST)   배수        관문      번호  편 — 못 넘은 자리');
  for (const r of rows) {
    const 날짜 = r.게시 ? new Date(Date.parse(r.게시) + 9 * 3_600_000).toISOString().slice(5, 10) : '—';
    const 배 = r.배수 === null ? '—' : `${r.배수}배${r.시점 === '24h' ? '(24h)' : ''}`;
    const 반응 = [r.조회 != null ? `조회 ${r.조회}` : null, r.저장 != null ? `저장 ${r.저장}` : null, r.공유 != null ? `공유 ${r.공유}` : null].filter(Boolean).join(' · ');
    console.log(`${날짜.padEnd(11)} ${배.padEnd(11)} ${r.결과.padEnd(8)} ${String(r.번호 || '—').padEnd(5)} ${r.folder}${r.다시살림 ? ' · 다시 살림' : ''}${r.자리.length ? ` — ${r.자리.join(' · ')}` : ''}${반응 ? `  [${r.계정} ${반응}]` : ''}`);
  }
  console.log('');
  for (const line of 관문.요약절(rows, { 날 }).slice(4)) if (line) console.log(line);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(e.stack || e.message); process.exitCode = 1; }
}

module.exports = { 판정목록 };
