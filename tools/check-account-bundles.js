#!/usr/bin/env node
'use strict';
// PC 계정 라이브러리 묶음(desktop/renderer/platform-continuity.mjs), 계정 포털(experiences/synk-account/dist 등), 회사 교사 연결 묶음이
// 지금 원천과 맞는지 본다. CI 「verify account library and portal bundles」 단계가 부른다.
// 원천(experiences/synk-account/src, 회원 화면 renderer, atlas 회원 모듈, 그림·글꼴 원본)만 고치고 생성기를 안 돌리면 여기서 멈춘다.
//
// 포털 생성기는 SYNK-talk 작업본의 lib 세 파일과 마스코트 그림 둘을 사본으로 옮긴다. CI·앱 워크트리에는 그 작업본이 없으니
// --talk-root를 주지 않으면 저장소에 있는 사본(src/generated/*.cjs, assets/wardrobe/*-basic.webp)으로 임시 Talk 폴더를 만들어 넘긴다 —
// 그 다섯은 제자리 대조라 talk 쪽이 바뀐 것까지는 못 보고, 나머지(회원 활동 생성물·그림·글꼴·묶음 일곱·preview·manifest)는 다 본다.
// 쓰기: node tools/check-account-bundles.js [--build] [--talk-root <SYNK-talk 폴더>]
//   --build: 세 생성기로 먼저 다시 만든 뒤 대조한다(원천을 고친 커밋에 같이 올릴 생성물. talk 사본 다섯은 --talk-root 없이는 저장소 판 그대로).
//   포털에는 experiences/synk-account의 의존성이 있어야 한다: (cd experiences/synk-account && npm ci --ignore-scripts --no-audit --no-fund)
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const usage = () => { console.error('쓰기: node tools/check-account-bundles.js [--build] [--talk-root <SYNK-talk 폴더>]'); process.exit(2); };
const args = process.argv.slice(2);
let build = false, talkRoot = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--build' && !build) build = true;
  else if (args[i] === '--talk-root' && !talkRoot && args[i + 1]) talkRoot = path.resolve(args[++i]);
  else usage();
}
const run = (label, file, extra = []) => {
  const result = spawnSync(process.execPath, [path.join(root, file), ...extra], { cwd: root, encoding: 'utf8' });
  const text = `${result.stdout || ''}${result.stderr || ''}`.trim();
  const ok = result.status === 0;
  const reason = ok ? text.split('\n').pop() : (/Error: (.+)/.exec(text)?.[1] || text.split('\n').pop() || `exit ${result.status}`);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label} — ${reason}`);
  return ok;
};

function generatedTalkRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-talk-from-generated-'));
  const account = path.join(root, 'experiences/synk-account');
  const copy = (from, to) => { fs.mkdirSync(path.dirname(path.join(dir, to)), { recursive: true }); fs.copyFileSync(path.join(account, from), path.join(dir, to)); };
  copy('src/generated/account-client.cjs', 'lib/synk-account-client.js');
  // 생성기는 wardrobe-client의 require('./wardrobe-catalog.js')를 .cjs로 바꿔 쓴다 — 이미 바뀐 사본을 넣으면 그대로 나온다.
  copy('src/generated/wardrobe-client.cjs', 'lib/wardrobe-client.js');
  copy('src/generated/wardrobe-catalog.cjs', 'lib/wardrobe-catalog.js');
  copy('assets/wardrobe/mongle-basic.webp', 'assets/마스코트/몽글_본체.webp');
  copy('assets/wardrobe/marin-basic.webp', 'assets/마스코트/마린_본체.webp');
  return dir;
}

const results = [];
const portalReady = fs.existsSync(path.join(root, 'experiences/synk-account/node_modules/@supabase/supabase-js'));
const talk = portalReady ? talkRoot || generatedTalkRoot() : null;
const talkLabel = talkRoot ? 'Talk ' + talkRoot : '저장소 사본으로 만든 임시 Talk';
try {
  if (build) {
    results.push(run('PC 계정 라이브러리 묶음 다시 만들기', 'desktop/tools/build-platform-continuity.cjs'));
    if (talk) results.push(run(`계정 포털 다시 만들기(${talkLabel})`, 'tools/build-synk-account.js', ['--talk-root', talk]));
    if (portalReady) results.push(run('회사 교사 연결 묶음 다시 만들기', 'tools/build-messenger-teaching.cjs'));
  }
  results.push(run('PC 계정 라이브러리 묶음', 'desktop/tools/build-platform-continuity.cjs', ['--check']));
  if (talk) results.push(run(`계정 포털(${talkLabel})`, 'tools/build-synk-account.js', ['--check', '--talk-root', talk]));
  else {
    console.log('FAIL 계정 포털 — experiences/synk-account 의존성이 없다: (cd experiences/synk-account && npm ci --ignore-scripts --no-audit --no-fund)');
    results.push(false);
  }
  if (portalReady) results.push(run('회사 교사 연결 묶음', 'tools/build-messenger-teaching.cjs', ['--check']));
} finally { if (talk && !talkRoot) fs.rmSync(talk, { recursive: true, force: true }); }
if (results.includes(false)) {
  if (!build) console.log('→ 원천을 고친 커밋에서 생성물을 다시 만들어 같이 올린다: node tools/check-account-bundles.js --build (talk 사본까지 새로 받을 때만 --talk-root <SYNK-talk 작업본>)');
  process.exit(1);
}
