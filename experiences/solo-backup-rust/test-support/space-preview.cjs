#!/usr/bin/env node
'use strict';
/**
 * 공간 비우기 2판 4주 시험의 「미리 보기 2주」(SPACE_DESIGN.md 12.6 A): 원클릭을 누르지 않은 날,
 * 미리 보기 `pick free`(`preview: true`) 요청을 쓰고 요청 작업을 깨워 엔진의 「지울 것」 셈을 받는다.
 *
 *   node test-support/space-preview.cjs            쓸지 말지만 말한다
 *   node test-support/space-preview.cjs --실행     요청을 쓰고 요청 작업을 깨운다
 *
 * 쓰지 않는 날: 엔진이 2판을 열지 않았다(spaceFree가 off가 아님 — on이면 원클릭이 실제로 비운다),
 * 지난 20시간 안에 누름(원클릭이든 이 도구든)이 장부에 있다, 하루 안의 공간 보고서에 2판 번호가 없다.
 * 화면에는 수만 찍는다. 경로는 엔진 장부(space\freed.jsonl)에만 있고 space-compare.py가 읽는다.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const oneclick = require('../../../desktop/src/solio-oneclick.cjs');

const DAY_GAP = 20 * 3600000;
const root = path.join(process.env.APPDATA || '', 'SynkWorkBackup');
const solio = path.join(root, 'solio');
const paths = { root, solio, status: path.join(solio, 'status.json'), requests: path.join(solio, 'requests') };

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { return null; } }

/** 장부의 마지막 누름 시각(ms). 누름마다 report 칸이 있는 줄을 남긴다 */
function lastPress() {
  let text = '';
  try {
    const file = path.join(root, 'space', 'freed.jsonl');
    const st = fs.lstatSync(file);
    if (!st.isFile()) return null;
    const fd = fs.openSync(file, 'r');
    try { const size = Math.min(st.size, 1048576), buf = Buffer.alloc(size); fs.readSync(fd, buf, 0, size, st.size - size); text = buf.toString('utf8'); } finally { fs.closeSync(fd); }
  } catch { return null; }
  let at = null;
  for (const line of text.split(/\r?\n/)) {
    let row; try { row = JSON.parse(line); } catch { continue; }
    const t = row && typeof row.report === 'string' ? Date.parse(row.at) : NaN;
    if (Number.isFinite(t) && (at === null || t > at)) at = t;
  }
  return at;
}

function runPowerShell(script, { env = {} } = {}) {
  return new Promise(resolve => {
    let out = '';
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { env: { ...process.env, ...env }, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    const timer = setTimeout(() => child.kill(), 15000);
    child.stdout.on('data', d => { out += d; });
    child.on('close', () => { clearTimeout(timer); resolve(out); });
    child.on('error', () => { clearTimeout(timer); resolve(''); });
  });
}

async function main() {
  const go = process.argv.includes('--실행');
  const now = Date.now();
  const status = readJson(paths.status);
  const spaceFree = status && typeof status.spaceFree === 'string' ? status.spaceFree : 'unavailable';
  if (spaceFree !== 'off') {
    console.log(spaceFree === 'on' ? '엔진 창에서 누를 때 비우기를 켰습니다. 미리 보기 요청을 쓰지 않습니다(원클릭이 비웁니다).' : '이 PC의 엔진이 2판을 열지 않았습니다(0.8.0과 시험 표식이 필요합니다).');
    return 2;
  }
  const last = lastPress();
  if (last !== null && now - last < DAY_GAP) {
    console.log(`지난 누름이 ${Math.round((now - last) / 3600000)}시간 전에 있습니다. 오늘은 요청을 쓰지 않습니다.`);
    return 0;
  }
  const pick = await oneclick.readFreePick({ paths, now });
  if (!pick) { console.log('하루 안의 공간 보고서에 2판이 비울 번호가 없습니다. 오늘은 요청을 쓰지 않습니다.'); return 0; }
  if (!go) { console.log(`미리 보기 요청을 쓸 차례입니다(번호 ${pick.items.length}개). --실행을 붙이면 씁니다.`); return 0; }
  // 솔리오의 원클릭과 같은 이름 꼴 · 같은 쓰기(임시 이름 → 이름 바꾸기). preview 칸만 더한다
  fs.mkdirSync(paths.requests, { recursive: true });
  const owner = 'swbtest0', random = crypto.randomBytes(8).toString('hex');
  const name = `${String(now).padStart(13, '0')}-${owner}${random}.json`;
  const temp = path.join(paths.requests, `.${owner}${random}.tmp`);
  fs.writeFileSync(temp, JSON.stringify({ v: 1, kind: 'pick', action: 'free', report: pick.report, items: pick.items, preview: true }), { flag: 'wx' });
  fs.renameSync(temp, path.join(paths.requests, name));
  const word = await oneclick.wakeRequestTask({ run: runPowerShell });
  console.log(`미리 보기 요청을 썼습니다(번호 ${pick.items.length}개). 요청 작업 깨우기: ${word === 'started' ? '시작함' : word === 'no-task' ? '작업 없음 — 다음 매시 회차에 읽습니다' : '실패 — 다음 매시 회차에 읽습니다'}.`);
  return 0;
}

main().then(code => { process.exitCode = code; }, error => { console.error(String(error && error.message || error)); process.exitCode = 1; });
