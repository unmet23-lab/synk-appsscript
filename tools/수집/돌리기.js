#!/usr/bin/env node
'use strict';
/**
 * 수집 돌리기 — tools/수집/목록.json에서 종류가 「수집 예약」인 일 가운데 때가 된 것만 돌린다(2026-11-25).
 * Windows 예약 「SYNK 수집」이 30분마다 부른다(tools/run-collection.py, 운영 사본). 때가 아닌 일은 AI를 부르지 않고 바로 끝난다.
 *
 *   node tools/수집/돌리기.js [--마른] [--하나 <id>] [--지금 <ISO 시각>]
 *     --마른     돌릴 일만 보이고 돌리지 않는다.
 *     --하나 id  때와 상관없이 그 일 하나를 지금 돌린다(손으로 다시 돌리기).
 *
 * 때: 주기 {"매일": "HH:MM"}은 오늘 그 시각이 지났고 그 시각 뒤에 돈 기록이 없을 때다. {"간격일": N, "시각": "HH:MM"}은
 * 거기에 더해 마지막으로 받은 회차가 (N일 − 6시간) 전보다 오래됐을 때다. 시각에서 12시간 넘게 늦었으면 그날은 건너뛴다.
 * 같은 회차는 두 번까지 돈다. 둘째는 첫째가 「실패」 · 「꼴 아님」이고 30분이 지났을 때만이다. 「못 부름」(한도 · 로그인)은 다음 회차를 기다린다.
 * 기록: <공용 작업본>/.tmp/수집/기록.jsonl(한 번 돌 때 한 줄). 두 번 다 실패했거나 로그인 · 설치가 막혔으면 텔레그램 한 통(회차마다 한 번).
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { 공용작업본 } = require('../lib/공용작업본.js');

const 뿌리 = path.resolve(__dirname, '..', '..');
const 기록폴더 = () => process.env.SYNK_COLLECT_DIR || path.join(공용작업본(뿌리), '.tmp', '수집');
const HERMES = process.env.SYNK_HERMES_EXE || path.join(process.env.LOCALAPPDATA || '', 'hermes', 'bin', 'hermes.exe');
const TELEGRAM = 'telegram:6017495834';
const 늦음한도ms = 12 * 3600e3;
const 다시ms = 30 * 60e3;
const 서울 = (ms) => new Date(ms + 9 * 3600e3).toISOString();

function 목록읽기(파일 = path.join(__dirname, '목록.json')) {
  const j = JSON.parse(fs.readFileSync(파일, 'utf8'));
  if (!Array.isArray(j.수집)) throw new Error('목록.json에 수집 배열이 없다');
  return j.수집;
}

function 기록읽기(폴더 = 기록폴더()) {
  try {
    return fs.readFileSync(path.join(폴더, '기록.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

/** 한국 시각 날짜 + HH:MM → ms. */
function 서울시각(날짜, 시각) { return Date.parse(`${날짜}T${시각}:00+09:00`); }

/** 오늘 회차 — { 열쇠, 때ms } 또는 null(이 일은 수집 예약이 아님 · 주기 꼴이 아님). */
function 오늘회차(일, 지금) {
  const 주기 = 일.주기 || {};
  const 시각 = 주기.매일 || 주기.시각;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(시각 || '')) return null;
  const 날짜 = 서울(지금).slice(0, 10);
  return { 열쇠: `${날짜} ${시각}`, 때ms: 서울시각(날짜, 시각) };
}

/** 지금 돌릴까 → { 돌림: bool, 까닭 } */
function 때인가(일, 기록, 지금) {
  if (일.돌리는곳?.종류 !== '수집 예약') return { 돌림: false, 까닭: '수집 예약이 아님' };
  if (일.켜짐 === false) return { 돌림: false, 까닭: '꺼짐' };
  const 회차 = 오늘회차(일, 지금);
  if (!회차) return { 돌림: false, 까닭: '주기 꼴이 아님' };
  if (지금 < 회차.때ms) return { 돌림: false, 까닭: `오늘 ${회차.열쇠.slice(11)} 전` };
  if (지금 - 회차.때ms > 늦음한도ms) return { 돌림: false, 까닭: '시각에서 12시간 넘게 늦음 — 다음 회차' };
  const 내것 = 기록.filter((r) => r.id === 일.id);
  const N = Number(일.주기?.간격일) || 0;
  if (N > 1) {
    const 받은때 = 내것.filter((r) => r.결과 === '받음').map((r) => Date.parse(r.시작)).filter(Number.isFinite);
    const 마지막 = 받은때.length ? Math.max(...받은때) : null;
    if (마지막 && 지금 - 마지막 < (N * 24 - 6) * 3600e3) return { 돌림: false, 까닭: `${N}일 간격 — 마지막 받음 ${서울(마지막).slice(0, 16).replace('T', ' ')}` };
  }
  const 이번 = 내것.filter((r) => r.회차 === 회차.열쇠);
  if (!이번.length) return { 돌림: true, 까닭: `${회차.열쇠} 회차`, 회차 };
  const 끝 = 이번[이번.length - 1];
  if (['받음', '못 부름'].includes(끝.결과)) return { 돌림: false, 까닭: `${회차.열쇠} 회차 ${끝.결과}` };
  if (이번.length >= 2) return { 돌림: false, 까닭: `${회차.열쇠} 회차 두 번 실패 — 다음 회차` };
  if (지금 - Date.parse(끝.끝 || 끝.시작) < 다시ms) return { 돌림: false, 까닭: '실패 뒤 30분 기다림' };
  return { 돌림: true, 까닭: `${회차.열쇠} 회차 다시`, 회차 };
}

/** 명령 하나를 돌려 끝줄 JSON 요약을 받는다. */
function 일돌리기(일, { 시간ms } = {}) {
  const 제한 = 시간ms || ((Number(일.시간분) || 45) + 5) * 60e3;
  const 시작 = Date.now();
  return new Promise((resolve) => {
    const c = spawn(process.execPath, 일.명령.map((x, i) => (i === 0 ? path.join(뿌리, x) : x)), { cwd: 뿌리, windowsHide: true });
    let out = '', err = '', 넘김 = false;
    c.stdout.on('data', (d) => { out = (out + d).slice(-200_000); });
    c.stderr.on('data', (d) => { err = (err + d).slice(-20_000); });
    const 타이머 = setTimeout(() => {
      넘김 = true;
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else c.kill('SIGKILL');
    }, 제한);
    c.on('close', (code) => {
      clearTimeout(타이머);
      let 요약 = null;
      for (const l of out.trim().split(/\r?\n/).reverse()) { try { const j = JSON.parse(l); if (j && typeof j === 'object') { 요약 = j; break; } } catch { /* 다음 줄 */ } }
      const 결과 = 넘김 ? '실패' : code === 0 ? '받음' : code === 3 ? '못 부름' : code === 1 && 요약?.결과 === '꼴 아님' ? '꼴 아님' : '실패';
      resolve({ 코드: code, 결과, 요약, 까닭: 넘김 ? '시간 넘김' : 결과 === '실패' ? (err.trim().split(/\r?\n/).pop() || '').slice(0, 200) : undefined, 초: Math.round((Date.now() - 시작) / 1000) });
    });
    c.on('error', (e) => { clearTimeout(타이머); resolve({ 코드: 127, 결과: '실패', 까닭: e.message.slice(0, 200), 초: 0 }); });
  });
}

function 알림문(일, 줄) {
  const 까닭 = 줄.요약?.까닭 || 줄.까닭 || '';
  return `[수집] ${일.이름} ${줄.회차} 회차: ${줄.결과}${줄.요약?.막힘 ? `(${줄.요약.막힘})` : ''}${까닭 ? ` — ${까닭}` : ''}\n상태 보기: node tools/수집/상태.js`;
}

/** 이 줄 뒤에 알릴까 — 두 번째 실패, 또는 로그인 · 설치 막힘. 한도는 다음 회차에 풀리니 알리지 않는다. */
function 알릴까(줄, 같은회차) {
  if (줄.결과 === '못 부름') return ['로그인', '설치'].includes(줄.요약?.막힘);
  return ['실패', '꼴 아님'].includes(줄.결과) && 같은회차 >= 2;
}

function 잠그기(폴더) {
  const 파일 = path.join(폴더, '돌리기.lock');
  try {
    const 전 = JSON.parse(fs.readFileSync(파일, 'utf8'));
    if (Date.now() - Date.parse(전.때) < 4 * 3600e3) {
      try { process.kill(전.pid, 0); return null; } catch { /* 주인이 없다 — 가져간다 */ }
    }
  } catch { /* 잠금 없음 */ }
  fs.writeFileSync(파일, JSON.stringify({ pid: process.pid, 때: new Date().toISOString() }));
  return () => { try { fs.rmSync(파일, { force: true }); } catch { /* 다음 회차가 치운다 */ } };
}

async function main(argv) {
  const 값 = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : '');
  const 마른 = argv.includes('--마른');
  const 하나 = 값('--하나');
  const 지금 = 값('--지금') ? Date.parse(값('--지금')) : Date.now();
  const 폴더 = 기록폴더();
  fs.mkdirSync(폴더, { recursive: true });
  const 목록 = 목록읽기();
  const 기록 = 기록읽기(폴더);
  const 할일 = 하나
    ? 목록.filter((x) => x.id === 하나).map((일) => ({ 일, 판정: { 돌림: true, 까닭: '손으로', 회차: { 열쇠: `손 ${서울(지금).slice(0, 16).replace('T', ' ')}` } } }))
    : 목록.map((일) => ({ 일, 판정: 때인가(일, 기록, 지금) })).filter((x) => x.판정.돌림);
  if (하나 && !할일.length) { console.error(`목록에 없는 id: ${하나}`); return 2; }
  if (!할일.length) { console.log('돌릴 일 없음'); return 0; }
  if (마른) { for (const x of 할일) console.log(`돌릴 일: ${x.일.id} — ${x.판정.까닭}`); return 0; }
  const 풀기 = 잠그기(폴더);
  if (!풀기) { console.log('다른 돌리기가 도는 중 — 이번은 넘긴다'); return 0; }
  try {
    for (const { 일, 판정 } of 할일) {
      if (!Array.isArray(일.명령) || !일.명령.length) { console.log(`${일.id}: 명령 없음`); continue; }
      const 시작 = new Date().toISOString();
      console.log(`${일.id}: 시작 — ${판정.까닭}`);
      const r = await 일돌리기(일);
      const 줄 = { id: 일.id, 회차: 판정.회차.열쇠, 시작, 끝: new Date().toISOString(), 코드: r.코드, 결과: r.결과, 초: r.초, ...(r.까닭 && { 까닭: r.까닭 }), ...(r.요약 && { 요약: r.요약 }) };
      fs.appendFileSync(path.join(폴더, '기록.jsonl'), JSON.stringify(줄) + '\n');
      console.log(`${일.id}: ${r.결과}${r.요약?.찾음 != null ? ` · 찾음 ${r.요약.찾음} · 새 공고 ${r.요약.새공고 ?? '?'}` : ''}`);
      const 같은회차 = 기록.filter((x) => x.id === 일.id && x.회차 === 줄.회차).length + 1;
      if (알릴까(줄, 같은회차) && fs.existsSync(HERMES)) {
        const { 보내기 } = require('../lib/헤르메스보내기.js');
        const 보냄 = 보내기(HERMES, TELEGRAM, 알림문(일, 줄));
        if (!보냄.ok) console.log(`알림 못 보냄: ${보냄.error}`);
      }
    }
  } finally { 풀기(); }
  return 0;
}

if (require.main === module) main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => { console.error(e.stack || e.message); process.exitCode = 2; });

module.exports = { 목록읽기, 기록읽기, 오늘회차, 때인가, 알릴까, 알림문, 서울시각 };
