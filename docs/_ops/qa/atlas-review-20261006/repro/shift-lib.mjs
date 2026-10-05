// 검수 재현 스크립트(2026-10-06). SHIFT 재현 두 개가 같이 쓰는 준비 코드.
// 저장소·네트워크·유료 호출을 건드리지 않는다. 실행: node <이 파일>
// Read-only review helpers. Imports repository modules by absolute file URL.
export const ROOT = new URL('../../../../../', import.meta.url).href;
const engineMod = await import(ROOT + 'atlas/personalization.js');
const coreMod = await import(ROOT + 'atlas/engine.js');
const temperMod = await import(ROOT + 'atlas/temper-outcomes.js');
const domainMod = await import(ROOT + 'atlas/domain.js');
export const engine = engineMod.default;
export const core = coreMod.default;
export const temper = temperMod.default;
export const domain = domainMod.default;
export const M = await import(ROOT + 'experiences/shift-workbench/model.mjs');
export const iso = ms => new Date(ms).toISOString();
export const T0 = Date.parse('2026-10-02T00:00:00.000Z');
export const DRAFT = '제공한 자료의 담당과 기한을 대조하고, 승인 여부와 확인해야 할 내용을 직접 고친 충분히 긴 결과입니다.';
// Fill the answers of the current run. wrongIds: check ids to answer incorrectly.
export function answer(state, wrongIds = []) {
  const task = M.TASKS[state.run.task];
  state.run.prompt = task.template;
  for (const id of state.run.checkIds) {
    const check = task.checks.find(c => c.id === id);
    state.run.answers[id] = { kind: wrongIds.includes(id) ? (check.answer === 'match' ? 'wrong' : 'match') : check.answer, source: check.source };
  }
  state.run.result = M.evaluate(state.run);
  state.run.draft = DRAFT;
  state.run.reviewed = true;
  return state;
}
// One full practice the way app.mjs drives it: start -> shown -> check -> complete.
export function practice(state, task, wrongIds, startMs, opts = {}) {
  const settings = { task, goal: opts.goal || 'work', minutes: opts.minutes || 10, support: opts.support || 'step' };
  const scope = opts.scope || M.SCOPE;
  let s = M.startRun(state, settings, engine, iso(startMs), scope);
  if (opts.shown !== false) s = M.recordPracticeExposure(s, iso(startMs + 5), scope);
  answer(s, wrongIds);
  return M.completeRun(s, engine, iso(startMs + (opts.took || 60000)), scope);
}
export function attempt(label, fn) {
  try { const value = fn(); console.log('[OK]   ' + label + (value === undefined ? '' : ' -> ' + (typeof value === 'string' ? value : JSON.stringify(value)))); return value; }
  catch (error) { console.log('[THROW] ' + label + ' -> ' + error.constructor.name + ': ' + error.message); return undefined; }
}
