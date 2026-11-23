#!/usr/bin/env node
'use strict';
/* 판본 지금(2026-11-23 유호님 「사용량 많을때 지금 시작해줘 이런거 내가 쓰면 니가 아직 준비안된거 체크해서 전부 올려주는 기능」).
 * 나라 판본 회차(예약 synk-daily-lab-versions)를 「직접 시작 회차」로 띄우는 한 번짜리 표시를 다룬다. 표시는 git 밖에 둔다.
 *
 *   node tools/판본지금.js 요청 [--까닭 "<까닭>"]   표시를 쓴다 — 세 시간 안에 뜬 판본 회차 하나가 읽고 지운다
 *   node tools/판본지금.js 확인 [--json]            첫 낱말이 「있음」 · 「없음」(있으면 때 · 까닭 · 남은 분)
 *   node tools/판본지금.js 끝                       표시를 지운다(회차가 읽자마자 지운다)
 *   공통: --자리 <폴더>(시험용, 기본 %LOCALAPPDATA%\synk\판본회차)
 *
 * 회차가 표시를 보면 시각 가름(밤 · 낮 · 12:30~21:30 쉼)과 통과 상한 없이, 할 일 줄이 다하거나 주간 사용량 90% · 여섯 시간까지 만든다.
 * 쓰는 곳: .claude/skills/판본지금/SKILL.md(띄우는 쪽) · 예약 지시문 「시각 지키기」 ⓪(읽는 쪽).
 * 종료 코드: 0 = 했음(「없음」도 0) · 2 = 사용법 · 쓰기 오류.  시험: node --test tests/판본지금.test.js
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 유효시간 = 3 * 3600 * 1000;

function 자리(argv) {
  const i = argv.indexOf('--자리');
  if (i > -1 && argv[i + 1]) return path.resolve(argv[i + 1]);
  const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return path.join(base, 'synk', '판본회차');
}
const 파일 = (dir) => path.join(dir, '지금전부.json');

/** 표시 상태 — { 있음, 때?, 까닭?, 남은분?, 지남? } */
function 읽기(dir, now = Date.now()) {
  let j;
  try { j = JSON.parse(fs.readFileSync(파일(dir), 'utf8').replace(/^﻿/, '')); } catch (e) {
    if (e.code === 'ENOENT') return { 있음: false };
    return { 있음: false, 까닭: `표시를 못 읽음(${e.message})` };
  }
  const at = Date.parse(j && j.때);
  if (!Number.isFinite(at)) return { 있음: false, 까닭: '표시의 「때」가 시각 꼴이 아니다' };
  const 남은 = at + 유효시간 - now;
  if (남은 <= 0) return { 있음: false, 지남: true, 때: j.때 };
  return { 있음: true, 때: j.때, 까닭: j.까닭 || null, 남은분: Math.round(남은 / 60000) };
}

function main(argv) {
  const 명령 = argv[0];
  const dir = 자리(argv);
  const value = (name) => { const i = argv.indexOf(name); return i > -1 ? argv[i + 1] : null; };
  if (명령 === '요청') {
    const 표시 = { 때: new Date().toISOString(), 까닭: value('--까닭') || '유호님 직접' };
    try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(파일(dir), JSON.stringify(표시, null, 2) + '\n'); } catch (e) {
      console.error(`표시를 못 썼다 — ${e.message}`);
      return 2;
    }
    console.log(`요청함 — ${표시.때} · ${표시.까닭} · 세 시간 안에 뜬 판본 회차 하나가 「직접 시작 회차」로 돈다(${파일(dir)})`);
    return 0;
  }
  if (명령 === '확인') {
    const r = 읽기(dir);
    if (argv.includes('--json')) { console.log(JSON.stringify(r)); return 0; }
    if (r.있음) console.log(`있음 — ${r.때} · ${r.까닭 || '까닭 없음'} · ${r.남은분}분 남음`);
    else console.log(`없음${r.지남 ? ` — ${r.때}에 쓴 표시가 세 시간을 넘겨 쓰지 않는다` : r.까닭 ? ` — ${r.까닭}` : ''}`);
    return 0;
  }
  if (명령 === '끝') {
    try { fs.rmSync(파일(dir), { force: true }); } catch (e) {
      console.error(`표시를 못 지웠다 — ${e.message}`);
      return 2;
    }
    console.log('표시를 지웠다');
    return 0;
  }
  console.error('쓰는 법: node tools/판본지금.js 요청 [--까닭 "…"] | 확인 [--json] | 끝');
  return 2;
}

module.exports = { 읽기, 파일, 유효시간 };
if (require.main === module) process.exit(main(process.argv.slice(2)));
