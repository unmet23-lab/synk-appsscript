// Computer-tool adapter for Core Ask. The existing computer rules own hardware
// requirements and advice. This adapter only compares that advice under each answer.
// One unmet condition is one policy-loss unit; capacity shortage/oversizing uses its
// fraction of the required/recommended capacity. These weights are product policy,
// not measured preference, money, answer likelihood or a prediction of satisfaction.
export const QUESTION_POLICY = 'computer-question-value-3';
// Product input completeness, independent of Ask's question-value stopping rule.
export const COMPLETION_POLICY = 'computer-completion-1';

export function structuredAnswers(flat) {
  const input = {};
  for (const [about, value] of Object.entries(flat)) {
    const [step, field] = about.split('.');
    if (field) input[step] = { ...(input[step] || {}), [field]: value };
    else input[step] = value;
  }
  return input;
}

const shortage = (available, needed) => needed > 0 ? Math.max(0, needed - available) / needed : 0;
const excess = (available, recommended) => available > 0 ? Math.max(0, available - recommended) / available : 0;
// Semantic codes are supplied at the original rule branch. Attribution (src) is
// not importance, and changing a sentence must not change the decision analysis.
const codes = items => [...new Set((items || []).map(item => {
  if (typeof item.code !== 'string' || !item.code) throw new TypeError('Computer consultation: action/conflict needs a semantic code');
  return item.code;
}))].sort();
const sameCodes = (a, b) => a.length === b.length && a.every((code, index) => code === b[index]);
function multiQuestion(step, title, limit) {
  const displayOptions = step.options.map(({ id, label }) => ({ id, label }));
  const count = 2 ** displayOptions.length - 1;
  if (count > limit) throw new RangeError('Computer consultation: too many answer combinations');
  // The original wizard allows every nonempty subset, including unsure with a
  // named workload. Keep that contract and its canonical option order.
  const options = Array.from({ length: count }, (_, index) => {
    const chosen = displayOptions.filter((_option, bit) => (index + 1) & (2 ** bit));
    return { id: `set.${chosen.map(option => option.id).join('.')}`, value: chosen.map(option => option.id) };
  });
  return { id: step.id, about: step.id, title, selection: 'multiple', displayOptions, options };
}

export function createComputerConsultation({ Ask, content, rules }) {
  const compute = flat => rules.compute(structuredAnswers(flat));
  const catalog = new Map();
  for (const step of content.steps) for (const field of step.type === 'group' ? step.fields : [step]) {
    const id = step.type === 'group' ? `${step.id}.${field.id}` : step.id;
    catalog.set(id, { id, title: step.type === 'group' ? `${step.short || step.eyebrow} · ${field.label}` : step.short || step.eyebrow || step.title,
      multiple: field.type === 'multi', options: field.options.map(option => option.id) });
  }
  const answerState = (id, value) => {
    const field = catalog.get(id);
    if (!field) return 'invalid';
    if (value === undefined) return 'missing';
    if (field.multiple) {
      if (!Array.isArray(value) || new Set(value).size !== value.length || value.some(item => !field.options.includes(item))) return 'invalid';
      if (!value.length) return 'missing';
      return value.includes('unsure') ? 'unknown' : 'known';
    }
    if (!field.options.includes(value)) return 'invalid';
    return ['unknown', 'unsure'].includes(value) ? 'unknown' : 'known';
  };
  const completion = flat => {
    const state = id => answerState(id, flat[id]);
    // Defaults may produce useful provisional advice, but never confirm a fact.
    // Ignore invalid/inactive values when deciding which requirements apply.
    const valid = Object.fromEntries([...catalog.keys()].filter(id => ['known', 'unknown'].includes(state(id))).map(id => [id, flat[id]]));
    valid.uses ||= [];
    const result = compute(valid), required = new Set(['uses', 'owned', 'os']);
    for (const use of valid.uses) {
      if (['photo', 'code', 'localai'].includes(use)) required.add(use);
      if (use === 'video') {
        required.add('video.app'); required.add('video.res');
        if (valid['video.res'] !== '4k') required.add('video.load');
      }
    }
    const hasDevice = ['have', 'extra'].includes(valid.owned);
    if (hasDevice) {
      for (const id of ['current.ram', 'current.os', 'current.feel']) required.add(id);
      if (result.form.heavy || ['tight', 'short'].includes(result.current?.verdict)) required.add('current.kind');
    }
    // An unknown existing machine is a diagnosis still to do, not a purchase.
    const currentBasisKnown = [...required].every(id => state(id) === 'known');
    const path = ['new', 'extra'].includes(valid.owned) ? 'purchase'
      : valid.owned === 'have' && currentBasisKnown ? result.headline.keep ? 'reuse' : 'purchase' : 'undetermined';
    if (path === 'purchase') { required.add('place'); required.add('budget'); }
    const active = new Set(['uses', ...questions(valid).map(question => question.about)]);
    const fields = [...catalog.values()].filter(field => active.has(field.id)).map(({ id, title }) => ({ id, title, state: state(id), required: required.has(id) }));
    const unresolvedRequiredFields = fields.filter(field => field.required && field.state !== 'known').map(field => field.id);
    const assumptions = [];
    if (state('uses') === 'known' && state('multitask') !== 'known') assumptions.push({ id: 'multitask', text: '동시에 켜 두는 양은 보통(탭 10~20개와 메신저)으로 가정했어요.' });
    return { policy: COMPLETION_POLICY, status: state('uses') !== 'known' ? 'not-started' : unresolvedRequiredFields.length ? 'provisional' : 'ready',
      scope: 'specification-guidance', path, requiredFields: fields.filter(field => field.required).map(field => field.id), unresolvedRequiredFields, fields,
      budget: { state: state('budget'), required: required.has('budget') }, assumptions };
  };
  const decision = flat => {
    const result = compute(flat);
    return { content: {
      form: result.form.pick, os: result.os.pick, ram: result.ram.value, storage: result.storage.value,
      gpu: { kind: result.gpu.kind, vram: result.gpu.vram },
      current: result.current ? { verdict: result.current.verdict, gb: result.current.gb, actions: codes(result.current.actions) } : null,
      keep: result.headline.keep, osConflicts: codes(result.os.conflicts),
      budgetWarning: result.budget.warn, budgetTight: result.budget.tight,
    } };
  };
  const evaluate = ({ decision: proposed, answers }) => {
    const candidate = proposed.content, target = compute(answers), settings = target.answers;
    // Unified memory and discrete VRAM must not be compared as interchangeable GB.
    // Reuse the same workload rules on the candidate's own platform; assess the
    // person's explicit platform choice separately below.
    const platform = rules.compute({ ...structuredAnswers(answers), os: candidate.os === 'either' ? 'any' : candidate.os });
    const availableRam = candidate.keep && candidate.current?.gb != null ? candidate.current.gb : candidate.ram;
    let loss = shortage(availableRam, platform.ram.workable);
    if (!candidate.keep) loss += excess(candidate.ram, platform.ram.value);
    loss += shortage(candidate.storage, platform.storage.min) + excess(candidate.storage, platform.storage.value);
    const neededVram = platform.gpu.need ?? platform.gpu.vram;
    if (platform.gpu.kind !== 'unified') loss += shortage(candidate.gpu.vram, neededVram) + excess(candidate.gpu.vram, platform.gpu.vram);
    // The screen shows the recommended capacity, not the lowest one that still runs. For a
    // purchase, advice below that recommendation is a shortfall too; otherwise a question
    // whose answer doubles the recommended memory has no value and is never asked.
    // Keeping the current computer is still judged against what is workable.
    if (!candidate.keep) {
      loss += shortage(candidate.ram, platform.ram.value) + shortage(candidate.storage, platform.storage.value);
      if (platform.gpu.kind !== 'unified') loss += shortage(candidate.gpu.vram, platform.gpu.vram);
    }
    if ((settings.place || target.form.heavy) && candidate.form !== target.form.pick) loss += 1;
    if (['mac', 'win'].includes(settings.os) && candidate.os !== settings.os) loss += 1;
    // Treat a changed current-device diagnosis/advice as one condition, even if
    // several codes change together. Do not count each sentence as another loss.
    if (target.current && (candidate.current?.verdict !== target.current.verdict || !sameCodes(candidate.current?.actions || [], codes(target.current.actions)))) loss += 1;
    if (!sameCodes(candidate.osConflicts, codes(target.os.conflicts))) loss += 1;
    if (candidate.budgetWarning !== target.budget.warn || candidate.budgetTight !== target.budget.tight) loss += 1;
    return { loss };
  };
  const questions = flat => {
    const list = [], answers = structuredAnswers(flat);
    for (const step of content.steps) {
      if (step.id === 'uses' || (step.when && !step.when(answers))) continue;
      const title = step.short || step.eyebrow || step.id;
      if (step.type === 'single') list.push({ id: step.id, about: step.id, title, options: step.options.map(o => ({ id: o.id, label: o.label })) });
      else if (step.type === 'group') for (const field of step.fields) list.push({ id: `${step.id}.${field.id}`, about: `${step.id}.${field.id}`, title: `${title} · ${field.label}`, options: field.options.map(o => ({ id: o.id, label: o.label })) });
      else if (step.type === 'multi') list.push(multiQuestion(step, title, Ask.MAX_OPTIONS));
    }
    return list;
  };
  const choose = answers => {
    const available = questions(answers);
    // No response-frequency or question-burden measurements exist here. Core uses
    // equal scenario assumptions and zero cost; no fabricated probabilities are sent.
    // For multi-select, a scenario is a complete nonempty answer combination.
    return { ...Ask.choose({ questions: available, decide: decision, evaluate, answers, budget: 99 }), policy: QUESTION_POLICY, questions: available, completion: completion(answers) };
  };
  const summary = result => [result.headline.sub,
    ...(result.current?.actions || []).filter(action => action.code !== 'monitor-memory-usage').map(action => action.t),
    ...result.os.conflicts.map(conflict => conflict.t),
    result.budget.warn ? result.budget.alternatives[0]?.t : result.budget.tips[0]?.t,
  ].filter((text, index, all) => text && all.indexOf(text) === index).join(' ');
  return Object.freeze({ compute, decision, evaluate, questions, choose, summary, completion, answerState });
}
