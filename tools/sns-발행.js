#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
  REPO_ROOT,
  DEFAULT_ACCOUNTS,
  buildPlan,
  approvePlan,
  checkAllConnections,
  migrateLegacyYoutubeLab,
  authorizeYoutube,
  openCredentialForm,
  publishPlan,
  openManualItem,
} = require('./lib/sns-publisher.js');

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exitCode = 1;
}

function usage() {
  console.log(`
SYNK SNS 발행기

  node tools/sns-발행.js --연결점검
  node tools/sns-발행.js --youtube-lab-이관
  node tools/sns-발행.js --youtube-연결 <계정키>
  node tools/sns-발행.js --자격-연결 <계정키>
  node tools/sns-발행.js --준비 --묶음 <폴더> --출력 <계획.json>
  node tools/sns-발행.js --승인 <계획.json> [--항목 id,id] --근거 "유호님 최종 검수"
  node tools/sns-발행.js --발행 <계획.json> [--항목 id,id]
  node tools/sns-발행.js --수동열기 <계획.json> --항목 <id>

원칙
  · --준비는 파일만 검사하며 게시하지 않습니다.
  · --발행은 현재 해시로 승인된 항목만 처리합니다.
  · 성공 결과는 계획 옆 .결과.json에 남아 중복 발행을 막습니다.
  · 비밀키는 Windows 자격 증명 보관소에만 들어갑니다.
`);
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function ids() {
  const value = arg('--항목');
  return value ? value.split(',').map((part) => part.trim()).filter(Boolean) : [];
}

function absolute(value) {
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

function printConnections(rows) {
  console.log('\nSNS 공식 연결 상태\n');
  for (const row of rows) {
    const icon = row.state === 'connected' || row.state === 'manual-ready' ? '✅'
      : row.state === 'blocked' || row.state === 'error' ? '❌' : '⏳';
    console.log(`${icon} ${row.accountKey.padEnd(24)} ${String(row.state).padEnd(24)} ${row.detail || ''}`);
  }
  const connected = rows.filter((row) => row.state === 'connected').length;
  const manual = rows.filter((row) => row.state === 'manual-ready').length;
  const remaining = rows.length - connected - manual;
  console.log(`\n직접 연결 ${connected} · 공식 편집기 준비 ${manual} · 최초 승인/설정 남음 ${remaining}\n`);
}

async function main() {
  if (process.argv.length <= 2 || process.argv.includes('--도움') || process.argv.includes('--help')) {
    usage(); return;
  }

  const accountsFile = arg('--계정설정') ? absolute(arg('--계정설정')) : DEFAULT_ACCOUNTS;

  if (process.argv.includes('--연결점검')) {
    printConnections(await checkAllConnections(accountsFile));
    return;
  }

  if (process.argv.includes('--youtube-lab-이관')) {
    migrateLegacyYoutubeLab();
    console.log('\n✅ LAB YouTube 자격을 Windows 보관소에 복제했습니다. 기존 라디오 설정은 건드리지 않았습니다.\n');
    return;
  }

  if (arg('--youtube-연결')) {
    const accountKey = arg('--youtube-연결');
    console.log(`\nChrome에서 ${accountKey} YouTube 채널을 고르고 허용하세요. 다른 채널을 고르면 저장하지 않습니다.\n`);
    const result = await authorizeYoutube(accountKey, accountsFile);
    console.log(`\n✅ YouTube 연결 완료: ${result.title} ${result.handle || ''}\n`);
    return;
  }

  if (arg('--자격-연결')) {
    const accountKey = arg('--자격-연결');
    console.log(`\nChrome에 ${accountKey} 연결 폼을 열었습니다. 값은 Windows 보관소에만 저장됩니다.\n`);
    await openCredentialForm(accountKey, accountsFile);
    console.log(`\n✅ ${accountKey} 자격 저장 완료\n`);
    return;
  }

  if (process.argv.includes('--준비')) {
    const root = arg('--묶음');
    const output = arg('--출력');
    if (!root || !output) throw new Error('--준비에는 --묶음과 --출력이 필요합니다.');
    const plan = buildPlan({ root: absolute(root), accountsFile, outputFile: absolute(output) });
    const errors = plan.items.flatMap((item) => item.errors.map((error) => `${item.id}: ${error}`));
    console.log(`\n✅ 발행 검수판 ${plan.items.length}개 생성\n   ${absolute(output)}\n`);
    if (errors.length) {
      console.log('⚠️ 고쳐야 할 항목');
      errors.forEach((error) => console.log(`   · ${error}`));
      process.exitCode = 2;
    }
    return;
  }

  if (arg('--승인')) {
    const planFile = absolute(arg('--승인'));
    const note = arg('--근거') || '유호님 최종 검수';
    const plan = approvePlan(planFile, ids(), note);
    const count = plan.items.filter((item) => item.approval).length;
    console.log(`\n✅ 현재 해시로 ${count}개 항목 승인 기록\n`);
    return;
  }

  if (arg('--발행')) {
    const planFile = absolute(arg('--발행'));
    const { resultFile, result } = await publishPlan(planFile, ids(), { accountsFile });
    console.log(`\n✅ 발행 처리 종료\n   결과: ${resultFile}\n`);
    for (const [id, item] of Object.entries(result.items)) console.log(`   · ${id}: ${item.state}${item.url ? ` · ${item.url}` : ''}`);
    console.log('');
    return;
  }

  if (arg('--수동열기')) {
    const planFile = absolute(arg('--수동열기'));
    const selected = ids();
    if (selected.length !== 1) throw new Error('--수동열기는 --항목을 하나만 지정합니다.');
    const result = openManualItem(planFile, selected[0], accountsFile);
    console.log(`\n✅ 본문을 클립보드에 넣고 Chrome 공식 편집기·자료 폴더를 열었습니다.\n   ${result.folder}\n`);
    return;
  }

  throw new Error('알 수 없는 명령입니다. --도움을 보세요.');
}

main().catch((error) => fail(error.message));
