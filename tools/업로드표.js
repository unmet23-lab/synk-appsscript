#!/usr/bin/env node
'use strict';
/* 업로드표 — 앞뒤 1주 모든 매일 판 계정의 O · △ · X 표를 한 장 HTML로 쓴다(2026-10-30, 그림 · 판정은 tools/lib/업로드표.js).
 * 30분 정기 작업 「SYNK 예약큐」(예약큐.js --서버읽기)가 같은 표를 새로 쓰니, 손으로는 고친 기록을 바로 보고 싶을 때만 부른다.
 *
 *   node tools/업로드표.js [--앞뒤 7] [--출력 <파일>] [--오늘 YYYY-MM-DD(시험용)] [--폴더 <편 폴더들 — 예약큐와 같음>]
 *   기본 출력: 공용 작업본 .tmp/업로드표.html · 작업실 대조는 예약큐 캐시(%LOCALAPPDATA%\synk\예약큐\서버.json)를 읽는다.
 */
const path = require('node:path');
const 큐 = require('./예약큐.js');
const 표 = require('./lib/업로드표.js');

const argValue = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };

async function main() {
  const n = Math.max(1, Math.min(31, Number(argValue('--앞뒤') || 7) || 7));
  const accounts = (큐.readJson(path.join(큐.ROOT, 'sns-계정.json')) || {}).accounts || {};
  const today = argValue('--오늘') || 큐.kstDate();
  const now = argValue('--오늘') ? Date.parse(`${today}T12:00:00+09:00`) : Date.now();
  let server = null;
  try { server = await 큐.loadServer(false); } catch { server = null; }
  const report = 큐.build(큐.addDays(today, -n), 2 * n + 1, server, accounts, now);
  const out = 표.쓰기(report, { accounts, now, today, 출력: argValue('--출력') ? path.resolve(argValue('--출력')) : undefined });
  console.log(out);
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
