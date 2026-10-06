#!/usr/bin/env node
'use strict';
// Deliberately offline. Never imports lib.js (which can read management credentials).
const fs = require('node:fs/promises');
const { buildConfigPlan, applyConfigPlan } = require('./public-config.cjs');
(async () => {
  const args = process.argv.slice(2), source = args.filter(arg => arg.startsWith('--input='));
  if (source.length !== 1 || !source[0].slice(8) || args.some(arg => arg !== '--write' && !arg.startsWith('--input='))) throw Error('사용: node tools/synk-id/generate-public-config.cjs --input=등록결과.json [--write]');
  const info = await fs.stat(source[0].slice(8)); if (info.size > 1024 * 1024) throw Error('공개 등록 결과는 1 MB 이내여야 해요.');
  let input; try { input = JSON.parse(await fs.readFile(source[0].slice(8), 'utf8')); } catch { throw Error('공개 등록 결과 JSON 파일을 읽지 못했어요.'); }
  const plan = buildConfigPlan(input);
  const files = await applyConfigPlan(plan, { write: args.includes('--write') });
  console.log(JSON.stringify({ mode: args.includes('--write') ? 'local-write' : 'dry-run', environment: plan.environment, registered: plan.registered.map(item => item.registration), missing: plan.missing, unmappedCount: plan.unmapped.length, pendingServices: plan.services.filter(item => item.connection === 'pending-adapter').map(item => item.id), files }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
