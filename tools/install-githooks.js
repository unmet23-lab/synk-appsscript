#!/usr/bin/env node
/* install-githooks — repo의 훅 원본(tools/githooks/)을 이 저장소의 실제 훅 경로에 설치한다.
 *
 * 왜 설치가 필요한가: git 훅은 **버전 관리 밖**에 산다(.git/hooks). 이 저장소는 이미 그 관행으로
 * pre-commit(구문검사)을 쓰고 있어 core.hooksPath를 바꾸지 않는다 — 남의 세션이 커밋 중인데
 * 공유 설정을 갈아끼우는 것이 더 위험하다. 대신 **원본을 repo에 두고 사본을 설치**한다.
 *
 * 그래서 이 스크립트가 없으면 훅은 조용히 안 돈다. 그 상태를 tests/커밋트레일러.test.js가
 * skip으로 드러낸다(통과와 미설치가 같은 모양이면 안 된다 — CLAUDE.md 신뢰성 조항).
 *
 * 사용: node tools/install-githooks.js  [--check]
 *   --check = 설치 여부·드리프트만 보고하고 쓰지 않는다(종료코드 1 = 설치 필요)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'tools', 'githooks');
const check = process.argv.includes('--check');

function hooksDir() {
  const run = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  let dir;
  try { dir = run(['config', '--get', 'core.hooksPath']); } catch (_) { dir = ''; }
  if (!dir) dir = path.join(run(['rev-parse', '--git-common-dir']), 'hooks');
  return path.resolve(ROOT, dir);
}

const dest = hooksDir();
const names = fs.existsSync(SRC_DIR) ? fs.readdirSync(SRC_DIR) : [];
if (!names.length) {
  console.error('[install-githooks] tools/githooks/ 가 비었다.');
  process.exit(1);
}

let need = 0;
for (const name of names) {
  const src = path.join(SRC_DIR, name);
  const dst = path.join(dest, name);
  const want = fs.readFileSync(src, 'utf8');
  const have = fs.existsSync(dst) ? fs.readFileSync(dst, 'utf8') : null;
  if (have === want) { console.log(`  = ${name} (최신)`); continue; }
  need++;
  if (check) { console.log(`  ! ${name} ${have === null ? '미설치' : '원본과 다름(드리프트)'}`); continue; }
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(dst, want, 'utf8');
  try { fs.chmodSync(dst, 0o755); } catch (_) { /* Windows는 실행비트가 없다 */ }
  console.log(`  + ${name} ${have === null ? '설치' : '갱신'} → ${dst}`);
}

if (check && need) {
  console.error(`[install-githooks] ${need}건 설치 필요 — node tools/install-githooks.js`);
  process.exit(1);
}
console.log(check ? '[install-githooks] 설치 상태 최신' : '[install-githooks] 완료');
