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
 * ■ 색·실감
 *   `요소굽기.py` 의 기본값을 그대로 탄다 — 이 파일은 색·실감을 안 넘긴다. 그래서 기본값이 바뀌면
 *   (PBR 중립 반려 → AgX Punchy 08-24 · 섬유+잔털 승격 08-25) 이 통로는 자동으로 새 자를 탄다.
 *   정본이 어디인지는 결정.md 가 쥔다 — 여기 값을 다시 적지 않는다(적으면 이 주석이 다음 낡은 참조가 된다).
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
 *   node tools/NPC굽기.js --더 "받침=0,투명=1"     (앱 자산용 누끼 — 아래 절)
 *   node tools/NPC굽기.js --이어                  (끊긴 배치를 잇는다 · 4시간 배치의 안전줄)
 *
 * ■ 🔑 판정 지면용과 «앱 자산»용은 굽는 꼴이 다르다 (08-27)
 *   기본(받침 켬)은 밤천 위에 놓인 판이다 — 「물건은 놓여야 부피가 생긴다」의 그 판이고
 *   유호님이 나란히 놓고 보시는 지면이 이 꼴을 쓴다.
 *   🔴 그런데 그 판은 **알파가 프레임을 꽉 채운다**(08-27 실측: 08-24 산출 20장 전부
 *   bbox = 900×738 전면). talk `tools/NPC변환.py` 는 알파 바운딩박스로 잘라 앱 자산을 만드는데,
 *   꽉 찬 알파에서는 그 크롭이 **원리상 아무것도 못 자른다** — 그래서 08-24 굽기는 예뻤어도
 *   앱까지 못 갔고 평면 SVG 16종이 여태 정본으로 남아 있었다.
 *   ⇒ 앱에 넣을 판은 `--더 "받침=0,투명=1"` 로 굽는다(밤천을 걷고 배경을 알파로 비운다).
 *     형상은 같으므로 «형상 대조»는 어느 꼴로 재도 같은 값이 나온다 — 다만 옛 문턱과 나란히
 *     놓을 때는 **옛 값과 같은 꼴(받침 켬)** 로 재야 대조가 정직하다(before-after 출처 규율).
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
/* --더 "받침=0,투명=1" — 장면·렌더 인자를 그대로 흘려보낸다(요소전량굽기.js 의 `k.더` 와 같은 문법).
 * 여기서 해석하지 않는다: 아는 낱말만 통과시키면 새 손잡이가 생길 때마다 이 파일도 고쳐야 하고,
 * 그러면 「굽기 인자의 정본이 둘」이 된다(요소굽기.py 가 유일한 주인이다). */
const 더인자 = 인자['더'] && 인자['더'] !== true
  ? String(인자['더']).split(',').map((s) => s.trim()).filter(Boolean)
  : [];
/* --밖 은 «검증 판»을 정본 폴더에서 떼어 놓으려고 있다 — 900px 시험 4장이 1800px 정본과 한 폴더에
 * 섞이면 다음 사람이 「왜 넷만 작지?」로 읽는다(세트가 갈리는 그 병의 작은 얼굴). */
const 밖 = 인자['밖'] && 인자['밖'] !== true
  ? path.resolve(루트, String(인자['밖']))
  : path.join(루트, 'docs', '캐릭터', 'NPC공방_0824');

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

  /* --이어 : 4시간이 넘는 배치의 안전줄(08-27 신설). 재부팅·세션 사망으로 끊기면 그냥 다시 부른다.
   * 🔑 판정 축이 «있나»가 아니라 **«장면 정본보다 새것인가»** 다 —
   *   ·「있나」로 물으면 옛 판이 늘 그 자리에 있어 죽은 굽기도 건너뛴다(`644716a4` 의 반대 얼굴).
   *   ·「가로폭이 그 너비인가」로도 못 가른다: 옛 판도 이미 같은 해상도다(08-26 실측).
   *   ⇒ `NPC세트굽기.py`(장면·역형상 표)가 움직인 뒤에 구운 것만 «최신»으로 본다.
   *     몸색을 고치면 그 파일 시각이 올라가므로 전량이 자동으로 다시 대상이 된다
   *     (memory bake-from-a-moving-canon 이 말하는 그 자리).
   * ⚠ 요소굽기.py(재질 정본)까지는 안 본다 — 그쪽은 저장소 전체가 공유해서 잦게 움직이고,
   *   그걸 축으로 삼으면 이어굽기가 사실상 늘 «전량 다시»가 된다. 재질을 바꿔 다시 구울 때는
   *   `--이어` 를 빼면 된다(안전줄은 «끊긴 것을 잇는» 자리이지 «재굽기 판정»이 아니다). */
  if (인자['이어']) {
    const 정본시각 = fs.statSync(path.join(루트, 'tools', 'NPC세트굽기.py')).mtimeMs;
    const 전체 = 대상.length;
    const 건너뜀 = 대상.filter((k) => {
      try { return fs.statSync(path.join(밖, `${k.이름}.png`)).mtimeMs > 정본시각; } catch (_) { return false; }
    });
    대상 = 대상.filter((k) => !건너뜀.includes(k));
    console.log(`■ 이어굽기 — 합계 ${전체} = 굽는다 ${대상.length} + 건너뛴다 ${건너뜀.length}`
      + (건너뜀.length ? `\n  (장면 정본보다 새것: ${건너뜀.map((k) => k.이름).join(', ')})` : ''));
    if (!대상.length) { console.log('■ 굽을 것이 없다 — 전량이 이미 새 장면으로 구워져 있다'); return; }
  }

  console.log(`■ NPC 굽기 — 합계 ${대상.length}장(무대 ${무대들.length} + 배지 ${역들.length}×${상태들.length}) · `
    + `${너비}px · 샘플 ${견본} · 색·실감은 요소굽기 기본값 · 시작 ${시각()}`);
  const 시작 = Date.now();
  const 실패 = [];

  대상.forEach((k, i) => {
    const 파일 = path.join(밖, `${k.이름}.png`);
    process.stdout.write(`  [${String(i + 1).padStart(2)}/${대상.length}] ${k.이름.padEnd(14)} `);
    const 하나 = Date.now();
    spawnSync(BL, ['-b', '-P', path.join(루트, 'tools', 'NPC세트굽기.py'), '--',
      ...k.옵션, `샘플=${견본}`, `너비=${너비}`, '장치=GPU', `저장소=${루트}`, ...더인자, `출력=${파일}`],
    { cwd: 루트, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    /* 판정은 «이 굽기가 새로 썼나» — 크기도 개수도 아니고 시각이다(644716a4). */
    let 새로 = false; let KB = 0;
    try { const s = fs.statSync(파일); 새로 = s.mtimeMs >= 하나 - 1000; KB = Math.round(s.size / 1024); } catch (_) { 새로 = false; }
    console.log(`${새로 ? '✅' : '🔴'} ${KB}KB · ${분(Date.now() - 하나)}분`);
    if (!새로) 실패.push(k.이름);
  });

  console.log(`\n■ 끝 — 성공 ${대상.length - 실패.length} · 실패 ${실패.length} · ${분(Date.now() - 시작)}분 · ${시각()}`);
  if (실패.length) console.log(`  🔴 ${실패.join(' · ')}`);

  /* 🔑 굽기와 «판정 지면»은 한 벌이다(트랙 §0) — 굽고 안 그리면 아무도 그 굽기를 못 본다.
   * 단 «검증 판»(--밖 으로 딴 폴더에 900px 로 굽는 것)은 정본 지면을 덮으면 안 된다. */
  const 정본방 = 밖 === path.join(루트, 'docs', '캐릭터', 'NPC공방_0824');
  if (정본방 && !인자['지면없이']) {
    console.log(`\n■ 판정 지면 — ${시각()}`);
    const r = spawnSync(process.execPath, [path.join(루트, 'tools', 'NPC시트.js'), '--방', 밖],
      { cwd: 루트, stdio: 'inherit' });
    if (r.status !== 0) console.log('  🔴 지면 그리기 실패 — node tools/NPC시트.js 를 따로 돌려 본다.');
  } else if (!정본방) {
    console.log('  ↪ 검증 판이라 정본 지면(docs/NPC_시안.html)은 안 건드린다.');
  }
  process.exit(실패.length ? 1 : 0);
}

if (require.main === module) main();
module.exports = { 할것, 무대들, 역들, 상태들, 밖 };
