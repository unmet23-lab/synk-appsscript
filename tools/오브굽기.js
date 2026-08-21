#!/usr/bin/env node
/**
 * 오브굽기 — 킷 색마다 «실물» 오브를 굽는다 (Blender Cycles · `tools/요소굽기.py 형태=오브`).
 *
 * 왜 있나 (유호 교정 2026-08-21 「이 정도 퀄리티가 나와야 해」):
 *   오브 시안 첫 두 판은 **CSS 흉내**였다 — `.오브` 클래스(box-shadow + 배경 타일)로 만든 «그림»이라
 *   글자공방 3종(자수·레터프레스·라벨)의 실굽기와 같은 세계가 아니었다. 결정.md 08-20
 *   「앱 UI·UX 는 블렌더로 굽는 펠트 실물 오브젝트로 전부 대체 — Loom 이 존재하는 이유」의 오브 갈래.
 *
 * 🔑 **사진 재염색(`펠트천굽기.py`)과 다른 통로다.** 저쪽은 밝은 원료 «사진»의 채널 게인이라
 *   어두운 색에서 결이 죽는다(실측: Ink 36.8% · Ink Deep 6.3%). 이쪽은 3D 털을 그 색으로 «직접»
 *   심으므로 **어두운 오브도 결을 잃지 않는다** — 어두운 양모 사진이 없어도 Ink·Ink Deep 이 나온다.
 *
 * 사용:  node tools/오브굽기.js [--밖 폴더] [--샘플 96] [--너비 900] [--색 "Coral,Oat"]
 */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const 루트 = path.resolve(__dirname, '..');
const 인자 = (() => {
  const a = {}; const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i += 2) if (v[i].startsWith('--')) a[v[i].slice(2)] = v[i + 1];
  return a;
})();
const 밖 = path.join(루트, 인자['밖'] || path.join('docs', '캐릭터', '오브공방_0821'));
const 견본 = 인자['샘플'] || '96';
const 너비 = 인자['너비'] || '900';

/** 블렌더 찾기 — 룸굽기.js 와 같은 순서(환경변수 → 표준 설치 경로). */
function 블렌더() {
  if (process.env.BLENDER_EXE && fs.existsSync(process.env.BLENDER_EXE)) return process.env.BLENDER_EXE;
  const 뿌리들 = ['C:\\Program Files\\Blender Foundation', 'C:\\Program Files (x86)\\Blender Foundation'];
  for (const b of 뿌리들) {
    if (!fs.existsSync(b)) continue;
    for (const d of fs.readdirSync(b).sort().reverse()) {
      const p = path.join(b, d, 'blender.exe');
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/* 구울 색 — 현행 킷에서 오브가 «입을 수 있는» 것만.
 * ⏳퇴역 대기는 새 산출물에 안 쓰고, KC 4색은 Part 6 전용이라 본채 오브가 못 입는다(철칙 ④).
 * 손 목록을 적지 않고 **토큰에서 판정한다** — 색이 늘거나 퇴역해도 여기가 안 갈린다. */
function 구울색들() {
  const 킷 = JSON.parse(fs.readFileSync(path.join(루트, 'docs', '디자인_토큰.json'), 'utf8'))['색']['킷'];
  return 킷
    .filter((c) => !String(c['직책'] || '').trimStart().startsWith('⏳'))
    .filter((c) => !String(c['팔레트'] || '').includes('K-Culture'))
    .map((c) => c['이름']);
}

function main() {
  const BL = 블렌더();
  if (!BL) { console.error('🔴 blender.exe 를 못 찾았다 — BLENDER_EXE 로 경로를 준다.'); process.exit(1); }
  fs.mkdirSync(밖, { recursive: true });

  const 색들 = 인자['색'] ? 인자['색'].split(',').map((s) => s.trim()) : 구울색들();
  console.log(`■ 오브 굽기 ${색들.length}색 · 샘플 ${견본} · ${너비}px · → ${path.relative(루트, 밖)}`);
  const 시작 = Date.now();
  let 실패 = 0;

  색들.forEach((c, i) => {
    const 파일 = path.join(밖, c.replace(/\s+/g, '_') + '.png');
    process.stdout.write(`  [${String(i + 1).padStart(2)}/${색들.length}] ${c.padEnd(12)} `);
    const r = spawnSync(BL, [
      '-b', '-P', path.join(루트, 'tools', '요소굽기.py'), '--',
      '형태=오브', `색=${c}`, `샘플=${견본}`, `너비=${너비}`, '장치=GPU', `출력=${파일}`,
    ], { cwd: 루트, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    // ⚠blender 는 스크립트가 죽어도 exit 0 을 낼 수 있다(룸굽기 주석의 실사고) — 파일로 판정한다.
    const 됐나 = r.status === 0 && fs.existsSync(파일) && fs.statSync(파일).size > 2048;
    if (됐나) console.log(`✅ ${Math.round(fs.statSync(파일).size / 1024)}KB`);
    else { console.log('🔴 실패'); 실패++; if (r.stderr) console.log('     ' + String(r.stderr).trim().split('\n').slice(-2).join(' / ')); }
  });

  const 초 = Math.round((Date.now() - 시작) / 1000);
  console.log(`■ 끝 — 성공 ${색들.length - 실패} · 실패 ${실패} · ${Math.floor(초 / 60)}분 ${초 % 60}초`);
  process.exit(실패 ? 1 : 0);
}

if (require.main === module) main();
module.exports = { 구울색들, 블렌더 };
