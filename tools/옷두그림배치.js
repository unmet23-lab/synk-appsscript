#!/usr/bin/env node
/**
 * 옷 두 그림 «배치» — 여러 벌을 차례로, 한 장씩 40초 사이를 두고 굽는다 (2026-09-07 · 까몽 ⓑ 길).
 *
 * ■ 왜 따로 있나
 *   `옷두그림굽기.js` 는 한 번에 한 벌이다. 열네 벌을 손으로 열네 번 부르면 사이 시간을 못 지켜 429(분당 몫)를 맞는다
 *   (09-05 실측 · 넷째 장부터). 그리고 로그가 파일에 «즉시» 남아야 세션이 닫혀도 무엇이 났는지 안다(09-05 사고).
 *
 * ■ 무엇을 지키나
 *   · 이미 난 것(`docs/Loom_자산/옷/두그림/<마스코트>_<옷>.png`)은 건너뛴다 — 다시 돌려도 돈이 안 든다.
 *   · 한 벌이 실패하면 90초 뒤 한 번만 다시 던지고, 그래도 실패면 다음 벌로 간다(무한 재시도 금지).
 *   · 로그는 `--로그 <경로>` 에 줄마다 바로 적는다.
 *
 * 쓰기:
 *   node tools/옷두그림배치.js --마스코트 까몽 --것 "담요 망토,SYNK 후드,조끼" [--로그 <파일>] [--사이 40]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const 저장소 = path.join(__dirname, '..');
const 인자 = (() => {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) o[a[i].slice(2)] = a[i + 1] ?? true;
  return o;
})();

const 마스코트 = 인자.마스코트 || '까몽';
const 이름들 = String(인자.것 || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!이름들.length) { console.error('🔴 --것 "옷1,옷2" 가 있어야 한다'); process.exit(1); }
const 사이 = Number(인자.사이 || 40) * 1000;
const 낼방 = path.join(저장소, 'docs', 'Loom_자산', '옷', '두그림');
const 로그경로 = 인자.로그 || path.join(낼방, `배치로그_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt`);
fs.mkdirSync(낼방, { recursive: true });

function 적기(줄) {
  const 때 = new Date().toISOString().slice(11, 19);
  fs.appendFileSync(로그경로, `[${때}] ${줄}\n`);
  console.log(`[${때}] ${줄}`);
}

const 잠 = (ms) => new Promise((r) => setTimeout(r, ms));

function 한벌(이름) {
  const r = spawnSync('node', [path.join(저장소, 'tools', '옷두그림굽기.js'), '--마스코트', 마스코트, '--것', 이름],
    { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: 10 * 60 * 1000 });
  const 출력 = ((r.stdout || '') + (r.stderr || '')).trim().split('\n').slice(-6).join(' | ');
  return { 됐다: r.status === 0, 출력 };
}

(async () => {
  적기(`■ 배치 시작 — ${마스코트} ${이름들.length}벌 · 사이 ${사이 / 1000}초 · 로그 ${로그경로}`);
  let 구움 = 0, 건너뜀 = 0, 실패 = [];
  for (const 이름 of 이름들) {
    const 파일 = path.join(낼방, `${마스코트}_${이름.replace(/ /g, '')}.png`);
    if (fs.existsSync(파일) && fs.statSync(파일).size > 100000) { 적기(`⏭ ${이름} — 이미 있다(${파일})`); 건너뜀++; continue; }
    if (구움 > 0) await 잠(사이);
    적기(`▶ ${이름} 굽는다`);
    let r = 한벌(이름);
    if (!r.됐다) {
      적기(`⚠ ${이름} 실패 — ${r.출력}`);
      적기(`   90초 뒤 한 번만 다시`);
      await 잠(90 * 1000);
      r = 한벌(이름);
    }
    if (r.됐다 && fs.existsSync(파일)) { 구움++; 적기(`✅ ${이름} — ${(fs.statSync(파일).size / 1048576).toFixed(1)}MB`); }
    else { 실패.push(이름); 적기(`🔴 ${이름} — 두 번 다 실패. 다음 벌로 간다 — ${r.출력}`); }
  }
  적기(`■ 배치 끝 — 구움 ${구움} · 건너뜀 ${건너뜀} · 실패 ${실패.length}${실패.length ? ' (' + 실패.join(', ') + ')' : ''}`);
  process.exit(실패.length ? 2 : 0);
})();
