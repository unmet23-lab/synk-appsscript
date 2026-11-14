#!/usr/bin/env node
'use strict';
// Read-only trace of one tip receipt: receipt → ledger copy → card → applied record → verification.
// No model, ledger request, receipt/card write or message delivery. The plugin already checked
// the owner; the owner hash is checked again here so a wrong caller gets nothing.
const path = require('node:path');
const os = require('node:os');
const status = require('./status.cjs');
const { ledgerSnapshot } = require('./overview.cjs');
const fs = require('node:fs');
const { traceReceipt, formatTrace, traceLine, sourceCoverage, sourceSentences, TIP_INTAKE_DIR } = require('./tip-intake-status.cjs');

const formatTime = value => !value || !Number.isFinite(Date.parse(value)) ? '미확인'
  : new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) + ' KST';

async function traceTip({ hermesHome, root, id, owner, now = new Date() }) {
  if (!/^tip-[a-f0-9]{24}$/.test(id || '') || !/^[a-f0-9]{64}$/.test(owner || '')) throw Object.assign(new Error('ARGS'), { code: 'TRACE_ARGUMENT' });
  const raw = JSON.parse(status.readText(hermesHome, TIP_INTAKE_DIR + '/' + id + '.json', 64_000).content);
  if (raw?.schemaVersion !== 1 || raw.id !== id || raw.ownerHash !== owner) throw Object.assign(new Error('OWNER'), { code: 'TRACE_NOT_OWNED' });
  const trace = traceReceipt(raw, await sources(hermesHome, root, now));
  return { trace, text: formatTrace(trace, { formatTime, clip: (value, n) => status.plain(value, n) }) };
}

function sources(hermesHome, root, now) {
  return ledgerSnapshot({ hermesHome, now, remoteRefresh: false }).then(ledger => {
    const cards = status.readCardStatus(root, () => true);
    return { ledger, cards: { available: cards.available, complete: cards.snapshot?.complete === true, items: cards.snapshot?.items || [] } };
  });
}
// The owner's newest receipts (bounded like the plugin listing), one line each. Read-only.
async function listTips({ hermesHome, root, owner, now = new Date(), limit = 10 }) {
  if (!/^[a-f0-9]{64}$/.test(owner || '')) throw Object.assign(new Error('ARGS'), { code: 'TRACE_ARGUMENT' });
  const directory = status.safePath(hermesHome, TIP_INTAKE_DIR);
  const all = fs.readdirSync(directory).filter(name => /^tip-[a-f0-9]{24}\.json$/.test(name))
    .map(name => { try { return { name, time: fs.lstatSync(path.join(directory, name)).mtimeMs }; } catch { return null; } })
    .filter(Boolean).sort((a, b) => b.time - a.time);
  // Same bound as the plugin listing (newest 100 files). Anything past it is reported, not hidden.
  const names = all.slice(0, 100), beyond = all.length - names.length;
  const found = await sources(hermesHome, root, now);
  const lines = [];
  let unreadable = 0, shown = 0;
  for (const { name } of names) {
    let raw;
    try { raw = JSON.parse(status.readText(hermesHome, TIP_INTAKE_DIR + '/' + name, 64_000).content); } catch { unreadable++; continue; }
    if (raw?.schemaVersion !== 1 || raw.ownerHash !== owner || raw.id !== name.slice(0, -5)) continue;
    if (shown++ >= limit) continue;
    lines.push(traceLine(traceReceipt(raw, found), raw.status, { formatTime }));
  }
  return { text: ['공유 자료 접수 목록입니다.', '「접수 당시 기록」은 접수하거나 「팁 확인」을 했을 때 저장한 대조 결과입니다.',
    '「지금 조회한 결과」는 장부 사본과 카드 원문을 방금 읽은 결과입니다.', ...sourceSentences(sourceCoverage(found), { formatTime }), '',
    ...(lines.length ? lines : ['이 조회 범위에는 접수 기록이 없습니다.']),
    ...(shown > limit ? ['', `그 밖에 ${shown - limit}건이 더 있습니다.${beyond ? ' 이 수는 최근 접수 파일 100개 안에서 센 것입니다.' : ''}`] : []),
    ...(beyond ? [`최근 접수 파일 100개까지만 읽었습니다. 더 오래된 접수 ${beyond}개는 이 목록에서 확인하지 않았습니다. 접수 ID를 알면 /synk 팁 <접수ID> 로 볼 수 있습니다.`] : []),
    ...(unreadable ? [`읽지 못한 접수 기록이 ${unreadable}건 있습니다. 그래서 전체 상태는 미확인입니다.`] : []),
    '배포와 사용자 효과는 검증 기록을 모으지 않아 보여 주지 않습니다.', '한 건씩 자세히 보려면 /synk 팁 <접수ID> 를 보내 주세요.'].join('\n') };
}

async function main(argv = process.argv.slice(2)) {
  const options = {};
  if (argv.length === 3 && argv[0] === '--list' && argv[1] === '--owner') {
    const hermesHome = process.env.HERMES_HOME || path.join(process.env.LOCALAPPDATA || os.homedir(), 'hermes');
    process.stdout.write((await listTips({ hermesHome, root: path.resolve(__dirname, '../..'), owner: argv[2] })).text + '\n');
    return;
  }
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--id', '--owner'].includes(argv[i]) || !argv[i + 1] || options[argv[i]]) throw Object.assign(new Error('ARGS'), { code: 'TRACE_ARGUMENT' });
    options[argv[i]] = argv[i + 1];
  }
  const hermesHome = process.env.HERMES_HOME || path.join(process.env.LOCALAPPDATA || os.homedir(), 'hermes');
  const { text } = await traceTip({ hermesHome, root: path.resolve(__dirname, '../..'), id: options['--id'], owner: options['--owner'] });
  process.stdout.write(text + '\n');
}
module.exports = { traceTip, listTips };
if (require.main === module) main().catch(() => { process.stderr.write('TIP_TRACE_UNAVAILABLE\n'); process.exitCode = 1; });
