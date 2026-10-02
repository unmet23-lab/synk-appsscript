#!/usr/bin/env node
'use strict';
// Temper's check of Core's moment-level challenge on the real content declarations.
// Runs every behaviour-only virtual person through the adapted and the fixed setting over
// many seeds and prints the share of the second half spent near the target. This verifies the
// implementation and its rules; it is not evidence of learning, satisfaction or effect.
// Usage: node tools/flow-evaluate.js [--seeds 30] [--steps 60] [--json out.json]
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const Flow = require('../atlas/flow');
const Temper = require('../atlas/temper-flow');
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const seeds = Number(option('--seeds', 30)), steps = Number(option('--steps', 60)), out = option('--json', null);
if (!Number.isInteger(seeds) || seeds < 1 || seeds > 500 || !Number.isInteger(steps) || steps < 12 || steps > 2000) throw new Error('Usage: flow-evaluate.js [--seeds 1-500] [--steps 12-2000] [--json file]');
(async () => {
  const root = path.resolve(__dirname, '..');
  const load = file => import(pathToFileURL(path.join(root, file)).href);
  const { FLOW_RUSH, FLOW_PRACTICE } = await load('experiences/order-rush/learning.mjs');
  const { FLOW_RHYTHM } = await load('experiences/korean-rhythm/personalization.mjs');
  const contents = { 'order-rush.rush': FLOW_RUSH, 'order-rush.practice': FLOW_PRACTICE, 'korean-rhythm.timing': FLOW_RHYTHM };
  const report = { version: Temper.VERSION, policy: Flow.VERSION, seeds, steps, contents: {}, learningEffectClaim: false,
    note: '가상 사람으로 구현과 규칙을 확인한 결과다. 실제 사람의 학습 효과·만족·성과의 증거가 아니다.' };
  for (const [name, input] of Object.entries(contents)) {
    const spec = Flow.defineContent(input), people = {};
    for (let s = 0; s < seeds; s += 1) {
      for (const p of Temper.simulate({ spec, steps, seed: `eval-${s}` }).personas) {
        const a = people[p.id] || (people[p.id] = { label: p.label, adapted: 0, fixed: 0, adaptedError: 0, fixedError: 0, timeouts: 0, fixedTimeouts: 0, floor: 0, undone: 0, maxJump: 0, helpRaises: 0 });
        a.adapted += p.adapted.inBand / seeds; a.fixed += p.fixed.inBand / seeds;
        a.adaptedError += p.adapted.meanError / seeds; a.fixedError += p.fixed.meanError / seeds;
        a.timeouts += p.adapted.timeouts / seeds; a.fixedTimeouts += p.fixed.timeouts / seeds;
        a.floor += p.adapted.floorTooHard / seeds; a.undone += p.adapted.undone / seeds; a.maxJump = Math.max(a.maxJump, p.adapted.maxJump); a.helpRaises += p.adapted.helpRaises;
      }
    }
    const round = v => Math.round(v * 100) / 100;
    report.contents[name] = Object.fromEntries(Object.entries(people).map(([id, a]) => [id, Object.fromEntries(Object.entries(a).map(([k, v]) => [k, typeof v === 'number' ? round(v) : v]))]));
    console.log(`\n== ${name}`);
    for (const [id, a] of Object.entries(report.contents[name])) {
      console.log(`${a.label.padEnd(22)} 목표 근처 ${String(Math.round(a.adapted * 100)).padStart(3)}% (정해진 구성 ${String(Math.round(a.fixed * 100)).padStart(3)}%) · 시간 초과 ${a.timeouts} (${a.fixedTimeouts}) · 바닥 ${a.floor} · 성공했는데 되돌림 ${a.undone} · 한 번에 ${a.maxJump}칸 · 도움 뒤 올림 ${a.helpRaises}`);
    }
  }
  if (out) fs.writeFileSync(path.resolve(out), JSON.stringify(report, null, 2) + '\n');
})();
