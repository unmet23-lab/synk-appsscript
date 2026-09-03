#!/usr/bin/env node
'use strict';
/**
 * 외부도구받기 — 밖에서 들여온 도구·자료를 «다시 받는» 통로 하나.
 *
 * ■ 왜 있나 (2026-09-03 · 유호 지시 「설치하고 구현까지 다 해보자」)
 *   들인 것 중 **큰 둘**(실행파일 15.6MB · 낱말 사전 33MB)은 git 에 안 넣는다 —
 *   저장소가 영원히 무거워지는데 값은 «언제든 다시 받을 수 있는 것»이기 때문이다.
 *   그러면 새 기계·새 워크트리에서 **조용히 없는 상태**가 되므로, 그 자리를 이 통로가 메운다.
 *   ⚠ 작은 것(브라우저에 붓는 파일 둘·발음 사전 둘)은 **git 에 넣었다** — 합쳐 1.8MB 이고,
 *     그건 «자료»라 판올림이 곧 내용 변화다(받아 오면 그날 판이 달라질 수 있다).
 *
 * ■ ⚠ 이 통로가 틀릴 때의 모습 = **받아 놓고 «있다»고 읽는 것.**
 *   그래서 받은 뒤 반드시 «돌려» 본다(실행파일은 version, 자료는 줄 수). 못 돌면 실패로 낸다.
 *
 * 쓰는 법:  node tools/외부도구받기.js          받을 것만 받는다(이미 있으면 건너뛴다)
 *           node tools/외부도구받기.js --확인    받지 않고 «무엇이 없는지»만 낸다
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const 뿌리 = path.resolve(__dirname, '..');
const { 인자게이트 } = require('./lib/인자게이트.js');

/** 받을 것 — 이름·자리·주소·「돌아가나」를 재는 법. 여기 손으로 적는 유일한 값이다. */
const 목록 = [
  {
    이름: 'pdfcpu (판짜기·PDF 구조 검사)',
    자리: 'tools/vendor/pdfcpu/pdfcpu.exe',
    주소: 'https://github.com/pdfcpu/pdfcpu/releases/download/v0.15.0/pdfcpu_0.15.0_Windows_x86_64.zip',
    푸는법: 'zip',
    재는법: (p) => execFileSync(p, ['version'], { encoding: 'utf8' }).split('\n')[0].trim(),
  },
  {
    이름: '국립국어원 낱말 사전 (초급·중급·고급 등급)',
    자리: 'docs/어휘/국립국어원_사전_2024_01.csv',
    주소: 'https://huggingface.co/datasets/binjang/NIKL-korean-english-dictionary/resolve/main/2024_01.csv',
    재는법: (p) => fs.readFileSync(p, 'utf8').split('\n').length + '줄',
  },
];

const 있나 = (m) => fs.existsSync(path.join(뿌리, m.자리));

function 받기(m) {
  const 낼곳 = path.join(뿌리, m.자리);
  fs.mkdirSync(path.dirname(낼곳), { recursive: true });
  if (m.푸는법 === 'zip') {
    const 임시 = path.join(require('node:os').tmpdir(), 'synk-외부-' + Date.now() + '.zip');
    execFileSync('curl', ['-sSL', '--max-time', '600', '-o', 임시, m.주소], { stdio: 'inherit' });
    const 방 = path.dirname(낼곳);
    execFileSync('tar', ['-xf', 임시, '-C', 방], { stdio: 'inherit' });   // 윈도 tar 가 zip 을 푼다
    /* 배포물이 폴더 한 겹을 품는다 — 실행파일을 자리로 끌어올린다. */
    for (const d of fs.readdirSync(방)) {
      const 안 = path.join(방, d);
      if (fs.statSync(안).isDirectory()) {
        for (const f of fs.readdirSync(안)) fs.renameSync(path.join(안, f), path.join(방, f));
        fs.rmSync(안, { recursive: true, force: true });
      }
    }
    fs.rmSync(임시, { force: true });
  } else {
    execFileSync('curl', ['-sSL', '--max-time', '600', '-o', 낼곳, m.주소], { stdio: 'inherit' });
  }
}

function 본다(argv) {
  const 오류 = 인자게이트('외부도구받기', argv, ['--확인']);
  if (오류) { console.error(오류); return 2; }
  const 확인만 = argv.includes('--확인');

  let 없음 = 0; let 받음 = 0; let 못돎 = 0;
  console.log('■ 밖에서 들여온 것 — git 에 안 넣은 큰 것들\n');
  for (const m of 목록) {
    if (!있나(m)) {
      없음 += 1;
      if (확인만) { console.log(`  ❌ ${m.이름}\n       없다 → ${m.자리}`); continue; }
      console.log(`  ⤓ ${m.이름} 받는 중…`);
      try { 받기(m); 받음 += 1; } catch (e) { console.error(`  🔴 못 받았다 — ${e.message}`); 못돎 += 1; continue; }
    }
    /* 「받았다」가 아니라 «돈다»를 잰다 — 반쪽 파일이 「있다」로 지나가면 안 된다. */
    try {
      console.log(`  ✅ ${m.이름}\n       ${m.자리} · ${m.재는법(path.join(뿌리, m.자리))}`);
    } catch (e) {
      못돎 += 1;
      console.error(`  🔴 ${m.이름} — 파일은 있는데 «안 돈다»: ${e.message}`);
    }
  }
  /* 0 은 분모와 함께 쓴다 — 몇 벌을 봤는지 안 밝히면 미실행이 통과와 같은 모양이다. */
  console.log(`\n  분모 ${목록.length} = 이미 있음 ${목록.length - 없음} + ${확인만 ? '없음' : '받음'} ${확인만 ? 없음 : 받음} · 안 도는 것 ${못돎}`);
  return 못돎 || (확인만 && 없음) ? 1 : 0;
}

if (require.main === module) process.exit(본다(process.argv.slice(2)));
module.exports = { 목록, 있나 };
