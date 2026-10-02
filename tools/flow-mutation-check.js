#!/usr/bin/env node
'use strict';
// Plants known defects in a temporary copy of the moment-level challenge and checks that the tests
// catch every one. Run after changing atlas/flow.js, temper-flow.js, vellum-flow.js, ask.js or
// game-flow.js (or the WORLD host's guard). The working tree is never modified.
// Usage: node tools/flow-mutation-check.js
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-mutation-'));
const TESTS = ['atlas-flow', 'atlas-temper-flow', 'atlas-vellum-flow', 'atlas-ask', 'atlas-game-flow', 'world-learning-host'].map(name => `tests/${name}.test.js`);
// [file, original text, defective text, what the defect means]
const MUTATIONS = [
  ['atlas/flow.js', "assisted ? 0 : Infinity)", "Infinity)", 'help on a hard item lifts the estimate'],
  ['atlas/flow.js', "const raise = !calm && outcome === 'success' && !assisted", "const raise = !calm && outcome === 'success'", 'a raise right after an assisted success'],
  ['atlas/flow.js', "const raise = !calm && outcome === 'success' && !assisted", "const raise = !calm && outcome !== 'timeout' && !assisted", 'a missed answer raises the other part'],
  ['atlas/temper-flow.js', "if (live.some(c => c.step === step)) return { ok: false, rail: 'one-change-per-response' };", '', 'two changes in one response'],
  ['atlas/temper-flow.js', "if (to > from && live.some(c => c.direction > 0 && step - c.step <= COOL_DOWN)) return { ok: false, rail: 'cool-down' };", '', 'no pause after a raise'],
  ['atlas/temper-flow.js', '|| Math.abs(to - from) !== 1) return', ') return', 'jumps of several steps'],
  ['atlas/flow.js', "const locked = knob => Object.hasOwn(locks, knob.id) || knob.follows === 'declared';", 'const locked = knob => false;', 'declared choices ignored'],
  ['atlas/flow.js', "Object.keys(options).some(key => !START.includes(key))", 'false', 'unlisted inputs such as demographics accepted'],
  ['atlas/flow.js', "if (outcome === 'timeout') learn('pace', 0, 1);", "if (outcome === 'timeout') learn('content', 0, 1);", 'a timeout blamed on content'],
  ['atlas/flow.js', 'if (remembered) {', 'if (false && remembered) {', 'memory ignored'],
  ['atlas/vellum-flow.js', 'Math.max(floorMs, factor * median)', 'factor * median', 'help offered sooner than the floor'],
  ['atlas/vellum-flow.js', "if (declinedAt !== null && time(now) - time(declinedAt) < quietDays * DAY) return { offer: false, reason: 'declined-recently' };", '', 'less help offered again right after a no'],
  ['atlas/ask.js', 'return canonical(a) === canonical(b) ? 0 : 1;', 'return 1;', 'every question counted as decisive'],
  ['atlas/game-flow.js', "response.correct === false ? 'fail' : 'void'", "response.correct === false ? 'fail' : 'fail'", 'a response without an answer counted as a miss'],
  ['atlas/game-learning.js', 'assisted: actual?.assisted ?? null,', 'assisted: false,', 'Trail help hidden from the challenge'],
  ['atlas/flow.js', "const calm = condition === 'tired';", 'const calm = false;', 'a tired day still makes things harder'],
  ['atlas/flow.js', 'const pace = clamp(PACE_TARGET * Math.sqrt(overall / spec.target), 0.75, 0.97);', 'const pace = PACE_TARGET;', 'an easier day tightens time sooner'],
  ['atlas/flow.js', 'if (evidence) step += 1;', 'step += 1;', 'a skipped response counted as a pause'],
  ['atlas/flow.js', 'adaptive && !locked(k) ? indices[k.id] : reached[k.id]', 'indices[k.id]', 'a fixed round overwrites where adapted play reached'],
  ['atlas/flow.js', 'if (change && chance(dimension) < aim[dimension] - 0.15)', 'if (false)', 'a quiet streak steps beyond reach'],
  ['atlas/flow.js', "const fixed = knob => knob.follows === 'declared' ? indices[knob.id] : null;", 'const fixed = knob => locked(knob) ? indices[knob.id] : null;', 'a knob set by hand erases what was learned'],
  ['atlas/game-flow.js', 'const own = chosen === recommendation.selected ? recommendation : coach.recommend([chosen], rest);', 'const own = recommendation;', 'the reason shown belongs to another item'],
  ['atlas/game-flow.js', 'if (since !== undefined && since !== current) return false;', '', 'an open tab writes memory back after a reset'],
  ['account/world-learning-host.js', "name === 'live' ? live(value) : guarded(value)", 'guarded(value)', 'an open round skips the WORLD guard'],
  ['atlas/flow.js', "if (direction > 0 && phase === 'response' && reason !== 'quiet-streak' && gap(dimension) - knob.weight <= -DEADBAND) continue;", '', 'a raise that lands where it is eased straight back'],
];
try {
  for (const dir of ['atlas', 'strata', 'account']) fs.cpSync(path.join(root, dir), path.join(work, dir), { recursive: true });
  fs.mkdirSync(path.join(work, 'tests'));
  for (const test of TESTS) fs.copyFileSync(path.join(root, test), path.join(work, test));
  const run = () => { try { execFileSync(process.execPath, ['--test', ...TESTS], { cwd: work, stdio: 'pipe' }); return true; } catch { return false; } };
  if (!run()) throw new Error('the tests fail before any defect is planted');
  let caught = 0;
  for (const [file, from, to, meaning] of MUTATIONS) {
    const target = path.join(work, file), original = fs.readFileSync(target, 'utf8');
    if (!original.includes(from)) throw new Error(`source changed; update this check: ${meaning}`);
    fs.writeFileSync(target, original.replace(from, to));
    const passed = run();
    fs.writeFileSync(target, original);
    if (!passed) caught += 1;
    console.log(`${passed ? 'MISSED' : 'caught'}  ${meaning}`);
  }
  console.log(`${caught}/${MUTATIONS.length} planted defects caught`);
  if (caught !== MUTATIONS.length) process.exitCode = 1;
} finally { fs.rmSync(work, { recursive: true, force: true }); }
