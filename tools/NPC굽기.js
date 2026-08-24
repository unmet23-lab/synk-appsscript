#!/usr/bin/env node
/**
 * NPC 굽기 — 무대 4 + 배지 4역×4상태 = **20장**을 한 통로로 굽는다 (유호 지시 2026-08-24 「NPC 20장도 이어서」).
 *
 * ■ 왜 이 파일이 서나
 *   이 갈래는 여태 «스크래치패드에만» 살았다 — 트랙 §2-G 가 그 사실을 적어 두지 않았으면
 *   다음 세션이 `find . -ipath '*npc*'` → 0건을 보고 「없는 갈래」로 오독했을 자리다(피어 둘이 실제로 그랬다).
 *   유호님이 이 갈래를 되살린 날, 통로를 저장소가 쥔다. 장면은 `tools/NPC세트굽기.py` 가 쥔다.
 *
 * ■ 무엇을 굽나 (형상 2판 = 처방 ② 「크기·비례를 가른다」 집행분 · 유호 확정 08-24)
 *   1판은 네 역이 98.5~99.4% 같은 그림이었다(같은 반지름·같은 색·같은 털). 이번 판은 실루엣부터 가른다:
 *     prof 세로 타원 0.96배 · lead 정원 0.88배 · boss 가로 타원 1.06배(최대) · insp 둥근 사각 0.78배(최소)
 *
 * ■ 색
 *   `요소굽기.py` 의 기본값(Khronos PBR Neutral · 노출 +0.25)을 그대로 탄다 — 이 파일은 색을 안 넘긴다.
 *   🔑 유호님이 반려하며 보신 20장은 **옛 자(AgX)** 다(마지막 산출 07:09 < 색 교체 07:12:20 · 색계보 실측).
 *     그래서 이번 판은 «형상 + 색» 둘 다 새것이다. 반려를 푸는 것은 형상이고, 색은 그 위에 얹힌다.
 *
 * ■ 규율
 *   · 블렌더는 한 줄로만 돈다. 이미 돌면 걸지 말고 물러난다(트랙 §0).
 *   · 성공 판정은 **「이 굽기가 새로 썼나」(mtime)** — 「있나」로 물으면 옛 판이 늘 그 자리에 있어
 *     죽은 굽기도 ✅ 로 찍힌다(`644716a4` 실사고 · 이 갈래는 08-24 에 그 함정을 실제로 밟을 뻔했다).
 *
 * 쓰기:
 *   node tools/NPC굽기.js                       (20장 · 1800px · 샘플 256)
 *   node tools/NPC굽기.js --것 "boss-win,무대_벨"
 *   node tools/NPC굽기.js --너비 900 --샘플 64    (시험용 빠른 판)
 */
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const 인자 = {};
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const 이름 = a.slice(2);
  if (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) { 인자[이름] = process.argv[i + 1]; i += 1; }
  else 인자[이름] = true;
}
const 너비 = String(인자['너비'] || '1800');
const 견본 = String(인자['샘플'] || '256');
const 밖 = path.join(루트, 'docs', '캐릭터', 'NPC공방_0824');

/** 블렌더 찾기 — 오브굽기.js·요소전량굽기.js 와 같은 순서. */
function 블렌더() {
  if (process.env.BLENDER_EXE && fs.existsSync(process.env.BLENDER_EXE)) return process.env.BLENDER_EXE;
  if (process.env.BLENDER && fs.existsSync(process.env.BLENDER)) return process.env.BLENDER;
  for (const b of ['C:\\Program Files\\Blender Foundation', 'C:\\Program Files (x86)\\Blender Foundation']) {
    if (!fs.existsSync(b)) continue;
    for (const d of fs.readdirSync(b).sort().reverse()) {
      const p = path.join(b, d, 'blender.exe');
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/* 20장 — 무대 넷이 «이 게임이 뭔지»를 말하고(자기설명 축), 배지 열여섯이 학생 답에 반응한다.
 * 상태 넷: calm 평상 · lean 몸을 기울여 듣는다 · win 흡족(«>< 찡긋» · 유호 문법) · back 물러선다. */
const 무대들 = ['벨', '책', '클립보드', '도장'];
const 역들 = ['boss', 'prof', 'lead', 'insp'];
const 상태들 = ['calm', 'lean', 'win', 'back'];

const 할것 = [
  ...무대들.map((안) => ({ 이름: `무대_${안}`, 옵션: [`안=${안}`] })),
  ...역들.flatMap((역) => 상태들.map((상태) => ({ 이름: `${역}-${상태}`, 옵션: ['안=배지', `역=${역}`, `상태=${상태}`] }))),
];

const 분 = (ms) => (ms / 60000).toFixed(1);
const 시각 = () => new Date().toTimeString().slice(0, 8);

function main() {
  const BL = 블렌더();
  if (!BL) { console.error('🔴 blender.exe 를 못 찾았다 — BLENDER_EXE 로 경로를 준다.'); process.exit(1); }
  fs.mkdirSync(밖, { recursive: true });

  let 대상 = 할것;
  if (인자['것'] && 인자['것'] !== true) {
    const 고른 = String(인자['것']).split(',').map((s) => s.trim());
    const 모름 = 고른.filter((n) => !할것.some((k) => k.이름 === n));
    if (모름.length) { console.error('🔴 모르는 것:', 모름.join(', ')); process.exit(2); }
    대상 = 할것.filter((k) => 고른.includes(k.이름));
  }

  console.log(`■ NPC 굽기 — 합계 ${대상.length}장(무대 ${무대들.length} + 배지 ${역들.length}×${상태들.length}) · `
    + `${너비}px · 샘플 ${견본} · 색은 요소굽기 기본값(PBR 중립) · 시작 ${시각()}`);
  const 시작 = Date.now();
  const 실패 = [];

  대상.forEach((k, i) => {
    const 파일 = path.join(밖, `${k.이름}.png`);
    process.stdout.write(`  [${String(i + 1).padStart(2)}/${대상.length}] ${k.이름.padEnd(14)} `);
    const 하나 = Date.now();
    spawnSync(BL, ['-b', '-P', path.join(루트, 'tools', 'NPC세트굽기.py'), '--',
      ...k.옵션, `샘플=${견본}`, `너비=${너비}`, '장치=GPU', `저장소=${루트}`, `출력=${파일}`],
    { cwd: 루트, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    /* 판정은 «이 굽기가 새로 썼나» — 크기도 개수도 아니고 시각이다(644716a4). */
    let 새로 = false; let KB = 0;
    try { const s = fs.statSync(파일); 새로 = s.mtimeMs >= 하나 - 1000; KB = Math.round(s.size / 1024); } catch (_) { 새로 = false; }
    console.log(`${새로 ? '✅' : '🔴'} ${KB}KB · ${분(Date.now() - 하나)}분`);
    if (!새로) 실패.push(k.이름);
  });

  console.log(`\n■ 끝 — 성공 ${대상.length - 실패.length} · 실패 ${실패.length} · ${분(Date.now() - 시작)}분 · ${시각()}`);
  if (실패.length) console.log(`  🔴 ${실패.join(' · ')}`);
  process.exit(실패.length ? 1 : 0);
}

if (require.main === module) main();
module.exports = { 할것, 무대들, 역들, 상태들, 밖 };
