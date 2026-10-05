#!/usr/bin/env node
// Offline measurement: when the computer consultation stops asking, does its advice
// still equal the advice the same product rules give once every eligible question is
// answered? Answers are drawn uniformly at random with a fixed seed, so this is a
// consistency check of the question policy against its own rules. It is not a sample
// of real people, a hardware oracle or evidence of user satisfaction.
// No model, network, storage or repository write.
//   node tools/probe-atlas-consultation-fidelity.mjs [samples=1500] [seed=20261006]
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createComputerConsultation, QUESTION_POLICY } from '../experiences/atlas-lab/consultation.mjs';

const require = createRequire(import.meta.url);
const Ask = require('../atlas/ask.js');
const content = require('../docs/마케팅/맞춤도구/computer/content.js');
const rules = require('../docs/마케팅/맞춤도구/computer/rules.js');
const own = (object, key) => Object.hasOwn(object, key);
const canonical = value => JSON.stringify(value, (_key, x) => x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map(key => [key, x[key]])) : x);
const round = (n, digits = 4) => Number(n.toFixed(digits));
const sorted = counts => Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));

export function measureFidelity({ samples = 1500, seed = 20261006 } = {}) {
  if (!Number.isInteger(samples) || samples < 1 || samples > 100000 || !Number.isInteger(seed)) throw new TypeError('usage: [samples 1..100000] [integer seed]');
  const consultation = createComputerConsultation({ Ask, content, rules });
  let state = seed;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  const pick = list => list[Math.floor(random() * list.length)];
  const uses = content.steps.find(step => step.id === 'uses').options.map(option => option.id);
  // Each rule decides which question to put next, or null to stop.
  const policies = {
    // The current product policy: only questions with a positive declared value.
    value: answers => { const choice = consultation.choose(answers); return choice.status === 'ask' ? choice.question : null; },
    // Core Ask without a declared evaluator: ask while some answer can change the advice.
    impact: answers => { const choice = Ask.choose({ questions: consultation.questions(answers), decide: consultation.decision, answers, budget: 99 }); return choice.status === 'ask' ? choice.question : null; },
  };
  const stats = Object.fromEntries(Object.keys(policies).map(name => [name, { asked: 0, different: 0, declaredLoss: 0, ready: 0, fields: {}, skipped: {} }]));
  let eligible = 0;
  for (let i = 0; i < samples; i++) {
    const chosen = uses.filter(() => random() < 0.3); if (!chosen.length) chosen.push(pick(uses));
    const drawn = new Map();
    // One fixed answer per question for this simulated person, whichever policy asks it.
    const answer = question => { if (!drawn.has(question.about)) { const option = pick(question.options); drawn.set(question.about, own(option, 'value') ? option.value : option.id); } return drawn.get(question.about); };
    const complete = () => { const answers = { uses: chosen }; for (let guard = 0; guard < 60; guard++) { const next = consultation.questions(answers).find(q => !own(answers, q.about)); if (!next) break; answers[next.about] = answer(next); } return answers; };
    complete();
    const runs = {};
    for (const [name, next] of Object.entries(policies)) {
      const answers = { uses: chosen }; let asked = 0;
      for (let guard = 0; guard < 60; guard++) { const question = next(answers); if (!question) break; answers[question.about] = answer(question); asked++; }
      runs[name] = { answers, asked };
    }
    const full = complete(), reference = consultation.decision(full);
    eligible += Object.keys(full).length - 1;
    for (const [name, run] of Object.entries(runs)) {
      const decision = consultation.decision(run.answers), s = stats[name];
      s.asked += run.asked;
      if (consultation.completion(run.answers).status === 'ready') s.ready++;
      if (canonical(decision) === canonical(reference)) continue;
      s.different++;
      if (consultation.evaluate({ decision, answers: full }).loss > 1e-9) s.declaredLoss++;
      for (const key of Object.keys(reference.content)) if (canonical(decision.content[key]) !== canonical(reference.content[key])) s.fields[key] = (s.fields[key] || 0) + 1;
      for (const key of Object.keys(full)) if (!own(run.answers, key)) s.skipped[key] = (s.skipped[key] || 0) + 1;
    }
  }
  return {
    kind: 'computer-consultation-stop-fidelity', questionPolicy: QUESTION_POLICY, ask: Ask.VERSION, samples, seed,
    basis: 'uniform random answers, fixed seed; reference = the same rules with every eligible question answered',
    meanEligibleQuestions: round(eligible / samples, 2),
    policies: Object.fromEntries(Object.entries(stats).map(([name, s]) => [name, {
      meanQuestionsAsked: round(s.asked / samples, 2), adviceDiffersFromFullAnswers: s.different, rate: round(s.different / samples),
      alsoWorseByDeclaredLoss: s.declaredLoss, productCompletionReadyWhenStopped: s.ready,
      differingAdviceFields: sorted(s.fields), unaskedQuestionsInThoseCases: sorted(s.skipped),
    }])),
    limits: ['Random answer combinations are not real users and include unusual combinations.',
      'Equal advice means agreement with the product rules, not that the hardware advice is correct.',
      'Both rules look one question ahead, so answers that only matter together can be missed by either.',
      'productCompletionReadyWhenStopped counts the product completion contract at the moment automatic questions end.'],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(measureFidelity({ samples: Number(process.argv[2] ?? 1500), seed: Number(process.argv[3] ?? 20261006) }), null, 2));
}
