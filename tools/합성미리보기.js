#!/usr/bin/env node
'use strict';
/* 합성 미리보기 — 움직이는 소품(연필 · 잎 · 봉투 등)이 있는 장면을 전체 렌더 전에 Remotion에 얹은 그대로 첫 · 가운데 · 끝 프레임만 뽑아 한 장 시트로 본다
 * (2026-11-10, LAB 하루 두 편 설계 16).
 *
 * 왜: 「봉투 옆에 2초 넘게 떠 있는 은행잎」 · 「손 없이 움직이는 연필」 · 「기둥 위에 뜬 마스코트」는 그림 한 장이 아니라 Remotion에서 바탕 · 소품 ·
 * 마스코트를 겹치고 움직일 때 생겼다(설계 검토 아르곤 · 아스트라) — 그림 굽자마자 보는 검사(tools/그림검사.js)로는 못 잡고, 영상을 다 만든 뒤
 * 맹검에서야 잡혔다. 그래서 그 장면만 몇 프레임 먼저 굽는다(npx remotion still — 한 장 8초쯤, 전체 렌더 없음).
 *
 *   node tools/합성미리보기.js <remotion 폴더> --구성 <컴포지션 id> --구간 <시작초>-<끝초>[::<이름>] … [--fps <n>] [--입구 src/index.ts]
 *        [--밖 <폴더>] [--이름 <작업 이름>] [--검사 --의도 "<장면 의도 한 줄>" [--마스코트 몽글|없음] [--눈 gpt|haiku]]
 *   · 구간마다 첫 · 가운데 · 끝 프레임(그 구간 안, 끝은 끝 초 바로 앞 프레임)을 굽고 한 줄 세 칸 시트로(칸 이름 「A1 6.85s」), 모든 구간은 한 장에 더.
 *   · fps는 `npx remotion compositions`에서 읽는다(--fps로 건너뜀). 프로젝트 폴더에는 아무것도 쓰지 않는다 — 결과는 <밖>.
 *   · --검사: 구간 시트마다 tools/그림검사.js(--종류 합성)로 다섯 실수를 본다 — 프레임 사이 움직임을 무엇이 일으키는지(손 · 몸)까지.
 *   결과: <밖>/합성미리보기.json(구간 · 프레임 · 시트) · 구간_<글자>.jpg · 합성미리보기.jpg. 끝 코드: 0 · 1(검사에서 다시 굽기) · 2(실패).
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 공용작업본 } = require('./lib/공용작업본.js');
const 그림눈 = require('./lib/그림눈.js');

const 뿌리 = path.resolve(__dirname, '..');
const 글자들 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function 인자(argv) {
  const o = { 폴더: null, 구성: null, 구간: [], fps: null, 입구: null, 밖: null, 이름: null, 검사: false, 의도: '', 마스코트: '몽글', 눈: 'gpt' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--구성') o.구성 = argv[++i] || null;
    else if (a === '--구간') o.구간.push(구간풀기(argv[++i]));
    else if (a === '--fps') { o.fps = Number(argv[++i]); if (!(o.fps > 0)) throw new Error('--fps는 양수'); }
    else if (a === '--입구') o.입구 = argv[++i] || null;
    else if (a === '--밖') o.밖 = argv[++i] || null;
    else if (a === '--이름') o.이름 = argv[++i] || null;
    else if (a === '--검사') o.검사 = true;
    else if (a === '--의도') o.의도 = String(argv[++i] || '').trim();
    else if (a === '--마스코트') { o.마스코트 = String(argv[++i] || ''); if (!['몽글', '없음'].includes(o.마스코트)) throw new Error('--마스코트는 몽글 · 없음'); }
    else if (a === '--눈') { o.눈 = String(argv[++i] || '').toLowerCase(); if (!['gpt', 'haiku'].includes(o.눈)) throw new Error('--눈은 gpt · haiku'); }
    else if (a.startsWith('--')) throw new Error(`모르는 인자: ${a}`);
    else if (!o.폴더) o.폴더 = a;
    else throw new Error(`남는 인자: ${a}`);
  }
  if (!o.폴더 || !o.구성 || !o.구간.length) throw new Error('사용: node tools/합성미리보기.js <remotion 폴더> --구성 <컴포지션 id> --구간 <시작초>-<끝초>[::<이름>] …');
  if (o.구간.length > 글자들.length) throw new Error(`구간은 ${글자들.length}개까지`);
  if (o.검사 && !o.의도) throw new Error('--검사에는 --의도 "<장면 의도 한 줄>"을 준다(그림검사 — 의도한 엉뚱함을 실수로 읽지 않게)');
  return o;
}

/** 「6.85-7.3::연필 나감」 → { 시작, 끝, 이름 } */
function 구간풀기(글) {
  const [범위, ...이름] = String(글 || '').split('::');
  const m = /^\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*$/.exec(범위);
  if (!m) throw new Error(`--구간은 <시작초>-<끝초>[::<이름>]: ${글}`);
  const 시작 = Number(m[1]), 끝 = Number(m[2]);
  if (!(끝 > 시작)) throw new Error(`--구간 끝이 시작보다 커야 한다: ${글}`);
  return { 시작, 끝, 이름: 이름.join('::').trim() };
}

/** 구간 안 첫 · 가운데 · 끝 프레임(끝은 끝 초 바로 앞 프레임, 영상 끝 넘지 않게). */
function 세프레임(구간, fps, 총프레임 = Infinity) {
  const 마지막 = Number.isFinite(총프레임) ? 총프레임 - 1 : Infinity;
  const 첫 = Math.min(마지막, Math.max(0, Math.round(구간.시작 * fps)));
  const 끝 = Math.min(마지막, Math.max(첫, Math.ceil(구간.끝 * fps) - 1));
  return [...new Set([첫, Math.round((첫 + 끝) / 2), 끝])];
}

/** `npx remotion compositions` 출력에서 그 구성의 fps · 프레임 수를 읽는다(색 코드 걷고 「id fps WxH 프레임 (초)」 줄). */
function 구성읽기(출력, 구성) {
  for (const 줄 of String(출력).replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/)) {
    const m = /^(\S+)\s+(\d+(?:\.\d+)?)\s+(\d+)x(\d+)\s+(\d+)/.exec(줄.trim());
    if (m && m[1] === 구성) return { fps: Number(m[2]), 너비: Number(m[3]), 높이: Number(m[4]), 프레임: Number(m[5]) };
  }
  return null;
}

/** 그 프로젝트의 Remotion CLI(node_modules/@remotion/cli — npx remotion이 부르는 것)를 node로 바로 부른다(셸 없이). */
function remotion돌리기(args, cwd) {
  let cli;
  try { const 패키지 = require.resolve('@remotion/cli/package.json', { paths: [cwd] }); cli = path.join(path.dirname(패키지), String(require(패키지).bin?.remotion || 'remotion-cli.js')); }
  catch { throw new Error(`이 폴더에서 @remotion/cli를 못 찾았다(node_modules 없음?): ${cwd}`); }
  const r = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 64 << 20, timeout: 10 * 60 * 1000 });
  if (r.error) throw new Error(`remotion을 못 불렀다: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`remotion ${args[0]} 실패: ${String(`${r.stdout || ''}${r.stderr || ''}`).replace(/\x1b\[[0-9;]*m/g, '').trim().split(/\r?\n/).slice(-3).join(' ')}`);
  return `${r.stdout || ''}${r.stderr || ''}`;
}

/** remotion still 인자. */
function still인자(입구, 구성, 밖파일, 프레임) {
  return ['still', 입구, 구성, 밖파일, `--frame=${프레임}`];
}

async function main(argv, 손 = {}) {
  const o = 인자(argv);
  const 폴더 = path.resolve(o.폴더);
  const 입구 = o.입구 || ['src/index.ts', 'src/index.tsx', 'src/index.js'].find((f) => fs.existsSync(path.join(폴더, f)));
  if (!입구) throw new Error(`Remotion 입구(src/index.ts)를 못 찾았다 — --입구로 준다: ${폴더}`);
  const 이름 = o.이름 || `합성-${path.basename(path.dirname(폴더))}-${o.구성}-${new Date(Date.now() + 9 * 3600e3).toISOString().slice(5, 16).replace(/[-:T]/g, '')}`;
  const 밖 = path.resolve(o.밖 || path.join(공용작업본(뿌리), '.tmp', '합성미리보기', 이름));
  fs.mkdirSync(밖, { recursive: true });
  const 돌리기 = 손.remotion || remotion돌리기;
  const 정보 = o.fps ? { fps: o.fps, 프레임: Infinity } : 구성읽기(돌리기(['compositions', 입구], 폴더), o.구성);
  if (!정보) throw new Error(`구성 ${o.구성}을 못 찾았다 — npx remotion compositions ${입구}로 이름을 본다`);
  const 구간들 = o.구간.map((g, k) => ({ ...g, 글자: 글자들[k], 프레임: 세프레임(g, 정보.fps, 정보.프레임) }));
  const 칸파일 = new Map();
  for (const g of 구간들) for (const n of g.프레임) {
    if (칸파일.has(n)) continue;
    const f = path.join(밖, `f${String(n).padStart(5, '0')}.png`);
    if (!fs.existsSync(f)) { process.stdout.write(`  프레임 ${n}(${(n / 정보.fps).toFixed(2)}s) 굽는 중…\n`); 돌리기(still인자(입구, o.구성, f, n), 폴더); }
    if (!fs.existsSync(f)) throw new Error(`still이 그림을 안 남겼다: ${f}`);
    칸파일.set(n, f);
  }
  const 실행 = 손.ffmpeg || 그림눈.ffmpeg돌리기;
  const 이름표 = (g, i, n) => `${g.글자}${i + 1} ${(n / 정보.fps).toFixed(2)}s`;
  for (const g of 구간들) {
    g.시트 = path.join(밖, `구간_${g.글자}.jpg`);
    그림눈.띠만들기(g.프레임.map((n) => 칸파일.get(n)), g.시트, { 열: 3, 이름들: g.프레임.map((n, i) => 이름표(g, i, n)), 실행 });
  }
  const 모두 = path.join(밖, '합성미리보기.jpg');
  const 칸들 = 구간들.flatMap((g) => [0, 1, 2].map((i) => g.프레임[Math.min(i, g.프레임.length - 1)]).map((n) => ({ g, n })));
  그림눈.띠만들기(칸들.map((x) => 칸파일.get(x.n)), 모두, { 열: 3, 이름들: 칸들.map((x) => 이름표(x.g, x.g.프레임.indexOf(x.n), x.n)), 실행 });
  const 기록 = { 판: 1, 만든때: new Date().toISOString(), 폴더: path.relative(공용작업본(뿌리), 폴더).split(path.sep).join('/'), 구성: o.구성, fps: 정보.fps,
    구간: 구간들.map((g) => ({ 글자: g.글자, 이름: g.이름, 시작: g.시작, 끝: g.끝, 프레임: g.프레임, 시트: path.basename(g.시트) })), 모두: path.basename(모두) };
  fs.writeFileSync(path.join(밖, '합성미리보기.json'), `${JSON.stringify(기록, null, 1)}\n`);
  console.log(`합성 미리보기: 구간 ${구간들.length}개 · 프레임 ${칸파일.size}장 → ${모두}`);
  for (const g of 구간들) console.log(`  ${g.글자} ${g.이름 || ''} ${g.시작}~${g.끝}s → 프레임 ${g.프레임.join(' · ')} · ${g.시트}`);
  if (!o.검사) return 0;
  const 검사 = 손.그림검사 || require('./그림검사.js').main;
  const 검사인자 = [...구간들.map((g) => `${g.시트}${g.이름 ? `::${g.이름}` : ''}`), '--의도', o.의도, '--종류', '합성', '--마스코트', o.마스코트, '--눈', o.눈, '--밖', path.join(밖, '그림검사')];
  console.log(`  그림검사(합성): node tools/그림검사.js ${검사인자.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}`);
  return 검사(검사인자);
}

if (require.main === module) { main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => { console.error(e.message); process.exitCode = 2; }); }

module.exports = { 인자, 구간풀기, 세프레임, 구성읽기, still인자, main };
