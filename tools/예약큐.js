#!/usr/bin/env node
'use strict';
/* 1일 1편 예약 큐 (2026-10-20). 읽기만 한다.
 *
 * 브랜드마다 앞으로 며칠이 예약으로 채워져 있는지를 편 폴더의 게시/준비.json·게시/게시결과.json에서 모아 보여 준다.
 * 유호님 10-20 「1일 1편 업로드가 기준인데 만약이란게 있는거잖아 … 4일치를 미리 만들어서 업로드 예약을 걸어놓는거」.
 *
 *   node tools/예약큐.js [--일수 5] [--json] [--폴더 <편 폴더들이 있는 곳, 기본 docs/마케팅>]
 *
 * 준비.json(편 폴더 게시/): {"브랜드","날짜"(만든 날),"슬롯"(올릴 날 YYYY-MM-DD),"성격":"시의성"|"상시",
 *   "시한"(시의성이면 늦어도 올릴 날),"상태","제목","판":[{"계정","파일","시각"}]}
 * 게시결과.json(같은 폴더): {"판":[{"계정","상태":"예약됨"|"게시됨"|"실패","시각","주소"}]}
 * 한 편은 판이 모두 예약됨·게시됨이면 「채움」, 일부만이면 「일부」, 하나도 없으면 「승인 대기」다.
 * 비축 일수는 내일부터 이어서 「채움」인 날 수다. SYNK SHIFT는 판 계정이 shift- 로 시작하는 것을 따로 센다.
 */
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const ROOT_ARG = process.argv.indexOf('--폴더');
const ROOT = ROOT_ARG > -1 ? path.resolve(process.argv[ROOT_ARG + 1]) : path.join(REPO, 'docs', '마케팅');
const BRANDS = ['LAB', 'synkbrief', 'yuhobuilds', 'SHIFT'];
const DONE = new Set(['예약됨', '게시됨']);

function kstDate(ms = Date.now()) {
  return new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function addDays(day, n) {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { return null; }
}

function slotOf(prep) {
  if (prep.슬롯) return String(prep.슬롯).slice(0, 10);
  const first = (prep.판 || []).map((p) => p.시각).filter(Boolean).sort()[0];
  return first ? kstDate(Date.parse(first)) : null;
}

function collect() {
  const items = [];
  for (const dir of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const base = path.join(ROOT, dir.name, '게시');
    const prep = readJson(path.join(base, '준비.json'));
    if (!prep || !prep.브랜드) continue;
    const result = readJson(path.join(base, '게시결과.json')) || {};
    const done = new Map();
    for (const p of result.판 || []) if (p.계정) done.set(p.계정, p.상태);
    const groups = { [prep.브랜드]: [], SHIFT: [] };
    for (const p of prep.판 || []) (String(p.계정 || '').startsWith('shift-') ? groups.SHIFT : groups[prep.브랜드]).push(p);
    for (const [brand, plates] of Object.entries(groups)) {
      if (!plates.length) continue;
      const states = plates.map((p) => done.get(p.계정));
      const filled = states.filter((s) => DONE.has(s)).length;
      items.push({
        brand, folder: dir.name, title: prep.제목 || dir.name, slot: slotOf(prep),
        kind: prep.성격 || null, deadline: prep.시한 || null,
        state: filled === plates.length ? '채움' : filled ? '일부' : '승인 대기',
        failed: states.filter((s) => s === '실패').length,
      });
    }
  }
  return items;
}

function main() {
  const i = process.argv.indexOf('--일수');
  const days = Math.max(1, Number(i > -1 ? process.argv[i + 1] : 5) || 5);
  const today = kstDate();
  const range = Array.from({ length: days }, (_, k) => addDays(today, k));
  const items = collect();
  const report = { today, range, brands: {}, unslotted: items.filter((x) => !x.slot) };
  for (const brand of BRANDS) {
    const mine = items.filter((x) => x.brand === brand && x.slot);
    const byDay = Object.fromEntries(range.map((d) => [d, mine.filter((x) => x.slot === d)]));
    let reserve = 0;
    for (const d of range.slice(1)) {
      if (byDay[d].some((x) => x.state === '채움')) reserve += 1; else break;
    }
    const late = mine.filter((x) => x.deadline && x.state !== '채움' && x.deadline < (x.slot || today));
    report.brands[brand] = { reserve, byDay, late };
  }
  if (process.argv.includes('--json')) { console.log(JSON.stringify(report, null, 2)); return; }
  const mark = (list) => (!list.length ? '·' : list.some((x) => x.state === '채움') ? '●' : list.some((x) => x.state === '일부') ? '◐' : '○');
  console.log(`예약 큐 · 오늘 ${today} · ● 채움  ◐ 일부  ○ 승인 대기  · 빔`);
  console.log('브랜드'.padEnd(12) + range.map((d) => d.slice(5)).join('  ') + '  비축');
  for (const brand of BRANDS) {
    const b = report.brands[brand];
    console.log(brand.padEnd(12) + range.map((d) => mark(b.byDay[d]).padEnd(5)).join('  ') + `  ${b.reserve}일`);
  }
  for (const brand of BRANDS) {
    for (const d of range) for (const x of report.brands[brand].byDay[d]) {
      console.log(`  ${d} ${brand} ${x.state}${x.failed ? ` (실패 ${x.failed})` : ''} · ${x.title} · ${x.kind || '성격 없음'}${x.deadline ? ` · 시한 ${x.deadline}` : ''} · ${x.folder}`);
    }
    for (const x of report.brands[brand].late) console.log(`  ! ${brand} 시한 넘김: ${x.title}(시한 ${x.deadline}, 슬롯 ${x.slot})`);
  }
  for (const x of report.unslotted) console.log(`  ? 슬롯 없음: ${x.brand} · ${x.title} · ${x.folder}`);
}

main();
