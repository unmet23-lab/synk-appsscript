// 검수 재현 스크립트(2026-10-06). 방금 놓친 유형이 다수결에 묻혀 다음 실습에 반영되지 않는 것과 2:1이 엇갈림이 되는 것.
// 저장소·네트워크·유료 호출을 건드리지 않는다. 실행: node <이 파일>
// R2-R5: what the Domain policy actually selects in ordinary sequences.
import { M, engine, temper, practice, answer, iso, T0, attempt } from './shift-lib.mjs';
const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const field = (decision, id) => { const f = decision.understanding.fields.find(x => x.id === id); return f.status + '/' + f.value + ' agree=' + f.agreement + ' n=' + f.independent; };
function start(s, task, ms, opts = {}) { return M.startRun(s, { task, goal: opts.goal || 'work', minutes: opts.minutes || 10, support: 'step' }, engine, iso(ms)); }

console.log('--- R2: research task, evidence focus: Domain selected id vs first presented check / Temper selectedId');
{
  let s = practice(M.newState(), 'meeting', ['approval'], T0);         // evidence missed once
  s = start(s, 'research', T0 + 10 * MIN);
  const metric = s.evaluation.decisions.at(-1);
  console.log('Domain focusDecision.selected.id =', s.run.focusDecision.selected.id, '| ranked =', s.run.focusDecision.ranked.map(r => r.id + ':' + r.score).join(' '));
  console.log('presented checkIds =', s.run.checkIds.join(','), '| Temper decision selectedId =', metric.selectedId, 'policy =', metric.policy.id);
}

console.log('--- R3: a fresh miss after earlier successes');
{
  let s = M.newState();
  s = practice(s, 'meeting', [], T0);
  s = practice(s, 'planning', [], T0 + 1 * HOUR);
  s = practice(s, 'research', [], T0 + 2 * HOUR);
  s = practice(s, 'meeting', ['approval'], T0 + 3 * HOUR);        // just missed evidence (approval)
  console.log('history misses:', JSON.stringify(s.history.map(h => h.missed)));
  console.log('result screen suggestion right after the miss:', JSON.stringify(M.nextTaskSuggestion(s)));
  console.log('evidence field in nextDecision:', field(s.run.nextDecision, 'evidence'), '| needsCheck:', JSON.stringify(s.run.nextDecision.understanding.needsCheck));
  const n = start(s, 'planning', T0 + 4 * HOUR);
  console.log('next practice (planning) checkIds:', n.run.checkIds.join(','), '| reason:', n.run.reason);
  console.log('practiceBasis:', JSON.stringify(M.practiceBasis(n)));
}

console.log('--- R4: two misses and one success of the same focus (2 of 3)');
{
  let s = M.newState();
  s = practice(s, 'meeting', ['approval'], T0);
  s = practice(s, 'planning', [], T0 + 1 * HOUR);
  s = practice(s, 'meeting', ['approval'], T0 + 2 * HOUR);        // latest practice: missed again
  console.log('suggestion after latest miss:', JSON.stringify(M.nextTaskSuggestion(s)), '| evidence:', field(s.run.nextDecision, 'evidence'));
  const n = start(s, 'planning', T0 + 3 * HOUR);
  console.log('next practice checkIds:', n.run.checkIds.join(','), '| basis:', JSON.stringify(M.practiceBasis(n)));
}

console.log('--- R5: suggestion focus vs the item actually shown first');
{
  let s = practice(M.newState(), 'planning', ['audience', 'budget'], T0);   // missed evidence + numbers
  const next = M.nextTaskSuggestion(s);
  console.log('result screen: next task =', next.task, 'focus =', next.focus, '(' + M.FOCUS[next.focus] + ')');
  const n = start(s, next.task, T0 + 10 * MIN);
  console.log('practice opens with', n.run.checkIds.join(','), '| reason:', n.run.reason);
}

console.log('--- R8: cached next suggestion after the 30-day evidence lifetime');
{
  const base = Date.parse('2026-08-20T00:00:00.000Z');
  let s = practice(M.newState(), 'meeting', ['missing'], base); s.save = true;
  const restored = M.restore(JSON.stringify(s), engine, M.SCOPE, temper);     // restored today (46 days later)
  console.log('days since observation:', Math.round((Date.now() - base) / DAY));
  console.log('result screen after restore:', JSON.stringify(M.nextTaskSuggestion(restored)));
  const n = M.startRun({ ...restored, run: null }, { task: 'planning', goal: 'work', minutes: 10, support: 'step' }, engine, new Date().toISOString());
  console.log('practice started now: checkIds', n.run.checkIds.join(','), '| completeness:', field(n.run.focusDecision, 'completeness'), '| reason:', n.run.reason);
}
