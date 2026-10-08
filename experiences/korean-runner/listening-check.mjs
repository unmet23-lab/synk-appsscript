import { instructionMetadata } from './learning.mjs';
// Twelve checks the run never says (2026-10-03). Each has its own clip and its own family, so a run cannot
// spend its first try: before, the checks reused the sixteen run instructions and their families, and a
// check after running was only a repeat. Choices are the actions in plain words; the answer place varies.
const lane = (target) => ({ action: 'lane', target }), jump = () => ({ action: 'jump' }), slide = () => ({ action: 'slide' }), stay = () => ({ action: 'stay' });
export const LISTENING_CHECKS = Object.freeze([
  { id: 'check-star-middle', text: '가운데 길에 별이 있어요. 별이 있는 길로 가세요.', skill: '방향', explanation: '별이 있는 길은 가운데예요.', steps: [lane(1)],
    choices: ['가운데 길로 가기', '왼쪽 길로 가기', '오른쪽 길로 가기'], correct: 0 },
  { id: 'check-wide-left', text: '왼쪽 길이 넓어요. 넓은 길로 가세요.', skill: '방향', explanation: '넓은 길은 왼쪽이에요.', steps: [lane(0)],
    choices: ['오른쪽 길로 가기', '가운데 길로 가기', '왼쪽 길로 가기'], correct: 2 },
  { id: 'check-fence-jump', text: '앞에 낮은 울타리가 있어요. 울타리를 넘어가세요.', skill: '동작', explanation: '울타리를 넘어가려면 뛰어넘어요.', steps: [jump()],
    choices: ['몸을 숙이기', '울타리를 뛰어넘기', '오른쪽 길로 가기'], correct: 1 },
  { id: 'check-sign-duck', text: '앞에 낮은 표지판이 있어요. 머리를 숙이고 지나가세요.', skill: '위치 · 동작', explanation: '머리를 숙이면 낮은 표지판 아래로 지나갈 수 있어요.', steps: [slide()],
    choices: ['몸을 숙여 지나가기', '뛰어넘기', '그대로 달리기'], correct: 0 },
  { id: 'check-not-middle', text: '가운데로 가지 말고 오른쪽으로 가세요.', skill: '부정 · 방향', explanation: '가운데는 가지 말라고 했어요. 오른쪽으로 가요.', steps: [lane(2)],
    choices: ['가운데로 가기', '왼쪽으로 가기', '오른쪽으로 가기'], correct: 2 },
  { id: 'check-no-fence', text: '울타리가 없으니까 뛰지 않아도 돼요.', skill: '부정 지시', explanation: '울타리가 없어서 뛸 필요가 없어요. 그냥 달려요.', steps: [stay()],
    choices: ['뛰지 않고 그냥 달리기', '울타리를 뛰어넘기', '몸을 숙이기'], correct: 0 },
  { id: 'check-high-sign', text: '표지판이 높아서 숙이지 않아도 돼요.', skill: '부정 지시', explanation: '표지판이 높으니까 그대로 지나가도 돼요.', steps: [stay()],
    choices: ['몸을 숙여 지나가기', '숙이지 않고 그대로 지나가기', '뛰어넘기'], correct: 1 },
  { id: 'check-not-left', text: '왼쪽으로 가지 마세요. 오른쪽 길이 좋아요.', skill: '부정 · 방향', explanation: '왼쪽은 가지 말라고 했어요. 좋은 길은 오른쪽이에요.', steps: [lane(2)],
    choices: ['왼쪽 길로 가기', '가운데 길에서 숙이기', '오른쪽 길로 가기'], correct: 2 },
  { id: 'check-duck-jump', text: '먼저 몸을 숙이고, 그다음에 울타리를 뛰어넘으세요.', skill: '순서', explanation: '먼저 숙이고, 그다음에 뛰어넘어요.', steps: [slide(),jump()],
    choices: ['몸을 숙인 뒤 뛰어넘기', '뛰어넘은 뒤 몸을 숙이기', '몸을 숙이기만 하기'], correct: 0 },
  { id: 'check-middle-left', text: '가운데로 간 다음, 왼쪽으로 가세요.', skill: '순서 · 방향', explanation: '먼저 가운데로 가고, 그다음에 왼쪽으로 가요.', steps: [lane(1),lane(0)],
    choices: ['왼쪽으로 간 뒤 가운데로 가기', '가운데로만 가기', '가운데로 간 뒤 왼쪽으로 가기'], correct: 2 },
  { id: 'check-right-before-jump', text: '뛰어넘기 전에 오른쪽으로 가세요.', skill: '순서', explanation: '‘뛰어넘기 전에’라고 했으니까 오른쪽으로 먼저 가요.', steps: [lane(2),jump()],
    choices: ['뛰어넘은 뒤 오른쪽으로 가기', '오른쪽으로 간 뒤 뛰어넘기', '오른쪽으로 간 뒤 몸을 숙이기'], correct: 1 },
  { id: 'check-left-run', text: '왼쪽으로 간 다음, 그냥 달리세요.', skill: '순서 · 방향', explanation: '먼저 왼쪽으로 가고, 그다음에는 그냥 달려요.', steps: [lane(0),stay()],
    choices: ['그냥 달린 뒤 왼쪽으로 가기', '왼쪽으로 간 뒤 그냥 달리기', '왼쪽으로 간 뒤 뛰어넘기'], correct: 1 },
].map(check => Object.freeze({ ...check, steps: Object.freeze(check.steps), choices: Object.freeze(check.choices),
  choiceIds: Object.freeze(check.choices.map((_choice, index) => `runner-${check.id}-option-${index + 1}`)) })));

// Authored corrections identify the selected action, without inventing why a learner chose it.
const CORRECTIONS = Object.freeze({
  'check-star-middle': [null, '왼쪽이 아니라 별이 있는 가운데 길이에요.', '오른쪽이 아니라 별이 있는 가운데 길이에요.'],
  'check-wide-left': ['오른쪽이 아니라 넓다고 한 왼쪽 길이에요.', '가운데가 아니라 넓다고 한 왼쪽 길이에요.', null],
  'check-fence-jump': ['몸을 숙이면 울타리를 넘을 수 없어요. 울타리는 뛰어넘어요.', null, '길을 바꾸라는 부탁이 아니라 울타리를 넘어가라는 부탁이에요.'],
  'check-sign-duck': [null, '뛰면 머리가 더 높아져요. 낮은 표지판 아래에서는 머리를 숙여요.', '그대로 달리지 말고 머리를 숙이고 지나가세요.'],
  'check-not-middle': ['가운데로 가지 말라고 했어요. 오른쪽으로 가세요.', '왼쪽이 아니라 오른쪽으로 가라고 했어요.', null],
  'check-no-fence': [null, '‘뛰지 않아도 돼요’는 뛸 필요가 없다는 뜻이에요.', '숙이라는 부탁은 없어요. 뛰지 않고 그냥 달려도 돼요.'],
  'check-high-sign': ['‘숙이지 않아도 돼요’는 숙일 필요가 없다는 뜻이에요.', null, '뛰라는 부탁은 없어요. 높은 표지판 아래로 그대로 지나가도 돼요.'],
  'check-not-left': ['‘왼쪽으로 가지 마세요’라고 했어요. 오른쪽으로 가세요.', '가운데로 가거나 숙이라는 부탁은 없어요. 오른쪽으로 가세요.', null],
  'check-duck-jump': [null, '먼저 숙이고 그다음에 뛰어요. 고른 답은 순서가 반대예요.', '숙인 다음에 뛰어넘는 두 번째 동작도 필요해요.'],
  'check-middle-left': ['먼저 가운데로 가고 그다음에 왼쪽으로 가요. 고른 답은 순서가 반대예요.', '가운데로 간 다음에 왼쪽으로 가는 두 번째 동작도 필요해요.', null],
  'check-right-before-jump': ['뛰기 전에 오른쪽으로 가요. 오른쪽으로 가는 것이 먼저예요.', null, '오른쪽으로 간 다음에는 숙이는 것이 아니라 뛰어넘어요.'],
  'check-left-run': ['먼저 왼쪽으로 가고 그다음에 그냥 달려요. 고른 답은 순서가 반대예요.', null, '왼쪽으로 간 다음에는 뛰지 않고 그냥 달려요.'],
});
export function listeningCheckFeedback(item, selected) {
  if (!Number.isInteger(selected) || selected < 0 || selected >= item.choices.length) throw Error('Invalid choice');
  return { correct: selected === item.correct, selectedLabel: item.choices[selected], correctLabel: item.choices[item.correct],
    explanation: item.explanation || '이 문항의 해설은 아직 준비하지 못했어요.',
    correction: selected === item.correct ? null : CORRECTIONS[item.id]?.[selected] || '고른 행동과 들은 부탁을 다시 비교해 보세요.' };
}
// The TOPIK I grammar each check sentence uses, as Strata's grammarIn (strata/topik-i-forms.js) reads it.
// A test keeps this equal to grammarIn (a draft before teacher review).
export const CHECK_GRAMMAR = Object.freeze({ 'check-star-middle': ['G211'], 'check-wide-left': ['G211'], 'check-fence-jump': ['G211'], 'check-sign-duck': ['G211'], 'check-not-middle': ['S226', 'G211'], 'check-no-fence': ['G410', 'G304', 'G505'], 'check-high-sign': ['G304', 'G505'], 'check-not-left': ['S226', 'G211'], 'check-duck-jump': ['G211'], 'check-middle-left': ['G406', 'G211'], 'check-right-before-jump': ['G406', 'G211'], 'check-left-run': ['G406', 'G211'] });
export function checkMetadata(item) {
  const key = `korean-runner.listening-check.${item.id}.v1`;
  return { ...instructionMetadata(item), id: `korean-runner.listening-check.${item.id}`, itemKey: key, familyKey: key,
    responseFormat: 'single-choice', confounded: false, conceptIds: [...(CHECK_GRAMMAR[item.id] || [])] };
}
function allowedChecks(assignment) {
  return LISTENING_CHECKS.filter(item => {
    if (!assignment) return true;
    const m = checkMetadata(item);
    return m.skillId === assignment.skillId && m.difficulty === assignment.difficulty
      && m.responseFormat === assignment.responseFormat && m.modality === assignment.modality
      && Array.isArray(assignment.familyKeys) && assignment.familyKeys.includes(m.familyKey)
      && Array.isArray(assignment.itemKeys) && assignment.itemKeys.includes(m.itemKey);
  });
}
export function selectListeningChecks(coach, { assignment = coach.assignment?.() ?? null, limit = 3 } = {}) {
  let pool = allowedChecks(assignment);
  const count = Math.min(limit, assignment?.requiredAttempts ?? limit), selected = [];
  while (pool.length && selected.length < count) {
    const candidates = pool.map(item => { const m = checkMetadata(item); return { ...item, ...m, id: item.id, skillIds: [m.skillId], label: item.skill }; });
    const plan = coach.recommend(candidates, { audioAvailable: true }), next = pool.find(item => item.id === plan?.selected?.id);
    if (!next) break;
    selected.push(next); pool = pool.filter(item => item.id !== next.id);
  }
  return selected;
}

// The next check is picked after the answer. The teacher's exact list and round
// size remain fixed; follow-up never creates a question or changes the goal.
export function createListeningCheckRound(coach, { assignment = coach.assignment?.() ?? null, limit = 3 } = {}) {
  const allowed = allowedChecks(assignment), used = new Set();
  const total = Math.min(limit, assignment?.requiredAttempts ?? limit, allowed.length);
  const sameGoal = (a, b) => { const x = checkMetadata(a), y = checkMetadata(b); return ['skillId', 'difficulty', 'responseFormat', 'modality'].every(key => x[key] === y[key]); };
  const exposure = item => { try { return coach.exposure?.(checkMetadata(item))?.seen ?? null; } catch { return null; } };
  return {
    total,
    next(previous = null) {
      if (used.size >= total) return { status: 'finished', item: null };
      let pool = allowed.filter(item => !used.has(item.id));
      if (!pool.length) return { status: 'unavailable', item: null, note: '이 목표에서 남은 문항을 준비하지 못했어요.' };
      const followUp = previous?.item && (previous.result?.verdict === 'incorrect' || previous.result?.assisted === true);
      const freshSame = followUp ? pool.filter(item => sameGoal(item, previous.item) && exposure(item) === false) : [];
      let note = '';
      if (freshSame.length) { pool = freshSame; note = '같은 듣기 목표를 다른 새 문장으로 확인해요.'; }
      else if (followUp) {
        const unknownSame = pool.some(item => sameGoal(item, previous.item) && exposure(item) === null);
        note = unknownSame ? '같은 목표의 새 문항이 있는지 확인하지 못해서 남은 연습을 이어 가요.'
          : assignment ? '과제 목록에 같은 목표의 새 문항이 없어서 남은 과제 문항을 이어 가요.' : '같은 목표의 새 문항이 없어서 남은 연습을 이어 가요.';
      }
      if (!freshSame.length) {
        const fresh = pool.filter(item => exposure(item) === false);
        if (fresh.length) pool = fresh;
      }
      const candidates = pool.map(item => { const m = checkMetadata(item); return { ...item, ...m, id: item.id, skillIds: [m.skillId], label: item.skill }; });
      let plan;
      try { plan = coach.recommend(candidates, { audioAvailable: true }); }
      catch { return { status: 'unavailable', item: null, note: '학습 기록이나 과제 목표를 확인하지 못해서 다음 문항을 준비하지 못했어요.' }; }
      const item = pool.find(row => row.id === plan?.selected?.id);
      if (!item) return { status: 'unavailable', item: null, note: '이 목표에서 다음 문항을 준비하지 못했어요.' };
      used.add(item.id);
      const seen = exposure(item), kind = seen === false ? 'new' : seen === true ? 'review' : 'unknown';
      const exposureNote = kind === 'new' ? '처음 듣는 문항이에요.' : kind === 'review' ? '화면에 나온 적이 있는 문항을 다시 확인해요. 새 문항으로 표시하지 않아요.' : '전에 나온 문항인지 확인하지 못했어요. 새 문항이라고 표시하지 않아요.';
      // Only the deliberately chosen same-goal fresh question may carry the
      // immediately preceding answer into this round's read-only recheck.
      const followup = freshSame.length && kind === 'new'
        ? { status: 'new', sourceAttemptId: previous.result?.eventId ?? null } : null;
      return { status: 'ready', item, exposure: kind, followup, note: [note, exposureNote].filter(Boolean).join(' '), index: used.size - 1, total };
    },
  };
}
// Audio completion gates scoring; cancelling/failing cannot become a wrong language answer.
// Until the instruction has been heard in full, each play is its delivery. After that a play is a
// replay (help) and cannot make it unheard: a replay cut off by a hidden tab leaves the answer open.
export function createListeningCheck(coach) {
  let current = null, sequence = 0;
  return {
    get current() { return current && { ...current, result: current.result && { ...current.result } }; },
    begin(item) { this.cancel(); current = { item, token: ++sequence, pid: coach.present(checkMetadata(item)), audio: 'pending', heard: false, answered: false, replayed: false, result: null }; return current.token; },
    delivery(token, status) {
      if (!current || token !== current.token || current.answered) return false;
      if (!['pending', 'completed', 'failed'].includes(status)) throw Error('Invalid audio state');
      if (current.heard) return true;
      current.audio = status; if (status === 'completed') current.heard = true;
      coach.delivery(current.pid, { audio: status }); return true;
    },
    // Only a play after a full listen is help. A play after a failed or cut-off first play is still the first listen.
    replay() {
      if (!current) return false;
      // Post-answer listening is review only: no help/delivery/answer event may
      // change the scored attempt or its original independent qualification.
      if (current.answered) return true;
      if (current.heard) { coach.help(current.pid, 'replay'); current.replayed = true; return true; }
      current.audio = 'pending'; coach.delivery(current.pid, { audio: 'pending' }); return true;
    },
    answer(choice) {
      if (!current || current.answered || current.audio !== 'completed') return null;
      if (!Number.isInteger(choice) || choice < 0 || choice >= current.item.choices.length) throw Error('Invalid choice');
      const result = coach.answer(current.pid, { correct: choice === current.item.correct, assessable: true,
        choice: { selectedId: current.item.choiceIds[choice], correctId: current.item.choiceIds[current.item.correct] } });
      current.answered = true; current.result = { ...result }; return result;
    },
    cancel() {
      if (current && !current.answered) coach.answer(current.pid, { correct: null, assessable: false, reason: current.audio === 'completed' ? 'unanswered' : 'audio' });
      current = null; sequence++;
    },
  };
}
