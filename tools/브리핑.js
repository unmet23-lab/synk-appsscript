#!/usr/bin/env node
/**
 * 브리핑 — 프로젝트에 등록한 SessionStart 명령을 수동으로 조회·실행하는 선택 도구.
 *
 * 2026-09-09: 옛 시작 훅 묶음은 해제했다. 등록이 비어 있는 것은 오류가 아니며
 *     이 도구가 필수 시작 절차도 아니다. 빈 등록을 이유로 훅을 복원하지 않는다.
 *     현재 작업 사본의 최신 상태는 `node tools/session-freshness.js --json`으로 조회한다.
 *
 * 명령은 프로젝트의 `.claude/settings.json`·`settings.local.json`에서 읽는다.
 *     사용자 홈의 훅이나 하네스의 신뢰·실행 상태까지 확인하는 도구는 아니다.
 *
 * 쓰는 법:
 *   node tools/브리핑.js          — 프로젝트에 등록된 명령을 실행한다
 *   node tools/브리핑.js --목록    — 등록된 명령만 보여 준다(실행하지 않는다)
 *   node tools/브리핑.js --조용    — 등록된 명령을 실행하고 실패를 보고한다
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
  console.log('🧾 실행할 프로젝트 SessionStart 명령이 없다. 빈 등록 자체는 오류가 아니며 옛 훅을 복원할 필요도 없다.');
  console.log('   최신 작업 상태는 `node tools/session-freshness.js --json`으로 조회한다. 설정 읽기 오류가 위에 표시됐다면 그 설정은 확인 불가다.');
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
