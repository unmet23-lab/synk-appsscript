#!/usr/bin/env node
/**
 * 브리핑 — 세션 첫머리 알림을 «클로드 밖»에서도 낸다.
 *
 * 왜: 클로드 코드는 세션이 열릴 때 SessionStart 훅 12벌을 스스로 돌려
 *     「확정 몇 건 · 미커밋 몇 건 · 검수 런 몇 건 · 판이 뒤진 도구」를 보여 준다.
 *     코덱스(GPT)에는 그런 자리가 없다 — 그래서 GPT 가 라우터로 설 때
 *     이 도구를 첫 명령으로 부른다.
 *
 * 정본이 갈리지 않게: 명령을 여기 베껴 적지 않는다.
 *     `.claude/settings.json` 의 hooks.SessionStart 를 «그 자리에서 읽어» 돌린다.
 *     훅이 늘거나 바뀌면 이 도구는 고칠 것이 없다.
 *
 * 쓰는 법:
 *   node tools/브리핑.js          — 전부 돌린다
 *   node tools/브리핑.js --목록    — 무엇을 돌릴지만 보여 준다(안 돌린다)
 *   node tools/브리핑.js --조용    — 죽은 훅만 보고한다
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const 설정경로 = [
  path.join(ROOT, '.claude', 'settings.json'),
  path.join(ROOT, '.claude', 'settings.local.json'),
];

const 인자 = process.argv.slice(2);
const 목록만 = 인자.includes('--목록');
const 조용히 = 인자.includes('--조용');

/** settings.json 들에서 SessionStart 훅 명령을 순서대로 모은다. */
function 훅명령모으기() {
  const 명령들 = [];
  for (const p of 설정경로) {
    if (!fs.existsSync(p)) continue;
    let j;
    try {
      j = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
      console.error(`⚠ ${path.relative(ROOT, p)} 를 못 읽었다(${e.message}) — 이건 「훅이 없다」가 아니라 «확인 불가»다`);
      continue;
    }
    const 무리 = j && j.hooks && j.hooks.SessionStart;
    if (!Array.isArray(무리)) continue;
    for (const g of 무리) {
      for (const h of (g.hooks || [])) {
        if (h && typeof h.command === 'string' && h.command.trim()) {
          명령들.push({ 출처: path.relative(ROOT, p), 명령: h.command });
        }
      }
    }
  }
  return 명령들;
}

/** bash 를 찾는다 — 훅 명령은 POSIX 문법이라 PowerShell 로는 못 돈다. */
function bash찾기() {
  const 후보 = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    'bash',
  ];
  for (const b of 후보) {
    const r = spawnSync(b, ['-c', 'echo ok'], { encoding: 'utf8' });
    if (r.status === 0 && String(r.stdout).trim() === 'ok') return b;
  }
  return null;
}

const 명령들 = 훅명령모으기();

if (명령들.length === 0) {
  console.log('🧾 세션 첫머리 알림을 못 찾았다 — `.claude/settings.json` 에 SessionStart 훅이 없다.');
  console.log('   이건 「알릴 게 없다」가 아니라 «확인 불가»다.');
  process.exit(0);
}

if (목록만) {
  console.log(`📋 세션 첫머리에 도는 것 ${명령들.length}벌:\n`);
  명령들.forEach((c, i) => {
    const 첫줄 = c.명령.split('\n')[0].slice(0, 110);
    console.log(`  ${String(i + 1).padStart(2)}. [${c.출처}] ${첫줄}${c.명령.length > 110 ? ' …' : ''}`);
  });
  process.exit(0);
}

const BASH = bash찾기();
if (!BASH) {
  console.error('⚠ bash 를 못 찾았다 — 훅 명령은 POSIX 문법이라 PowerShell 로는 안 돈다.');
  console.error('   Git for Windows 가 깔려 있는지 본다. 이건 «확인 불가»다.');
  process.exit(1);
}

console.log(`🧭 세션 첫머리 브리핑 — 알림 ${명령들.length}벌\n`);

let 죽은것 = 0;
for (const { 명령 } of 명령들) {
  const r = spawnSync(BASH, ['-c', 명령], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
  });

  const 낸것 = [r.stdout, r.stderr].filter(Boolean).join('').trim();

  if (r.error || (r.status !== 0 && r.status !== null)) {
    죽은것++;
    const 첫줄 = 명령.split('\n')[0].slice(0, 80);
    console.log(`⚠ 알림 하나가 죽었다(종료 ${r.status}) — «확인 불가»다: ${첫줄}`);
    if (낸것) console.log(낸것);
    console.log('');
    continue;
  }

  if (!조용히 && 낸것) {
    console.log(낸것);
    console.log('');
  }
}

if (죽은것 > 0) {
  console.log(`\n🔴 알림 ${죽은것}벌이 죽었다 — 그만큼은 «없다»가 아니라 «안 재봤다»다.`);
} else if (조용히) {
  console.log('✅ 알림 전부가 돌았다.');
}

// 라우터가 다음 일을 배치하기 전에 기존 장부의 판정·재작업 근거를 함께 본다.
if (!조용히) console.log('\n' + require('./워크플로성과.js').화면());
