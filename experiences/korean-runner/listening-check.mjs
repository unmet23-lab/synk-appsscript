import { INSTRUCTIONS } from './instructions.mjs';
import { instructionMetadata } from './learning.mjs';
// One authored check per existing voice clip; changing choices never creates a new family.
export const LISTENING_CHECKS = Object.freeze([
  { id: 'right', choices: ['가운데 길로 가기', '오른쪽 길로 가기', '왼쪽 길로 가기'], correct: 1 },
  { id: 'no-jump', choices: ['뛰지 않고 그대로 달리기', '울타리를 뛰어넘기', '몸을 숙여 지나가기'], correct: 0 },
  { id: 'jump-right', choices: ['오른쪽으로 간 뒤 뛰어넘기', '뛰어넘은 뒤 왼쪽으로 가기', '뛰어넘은 뒤 오른쪽으로 가기'], correct: 2 },
  { id: 'left', choices: ['오른쪽 길로 가기', '가운데 길로 가기', '왼쪽 길로 가기'], correct: 2 },
  { id: 'jump', choices: ['울타리를 뛰어넘기', '몸을 숙이기', '가운데 길로 이동하기'], correct: 0 },
  { id: 'slide', choices: ['표지판을 뛰어넘기', '표지판 아래로 몸을 숙여 지나가기', '오른쪽 길로 가기'], correct: 1 },
  { id: 'middle', choices: ['왼쪽 길로 가기', '가운데 길로 가기', '오른쪽 길로 가기'], correct: 1 },
  { id: 'left-jump', choices: ['뛰어넘은 뒤 왼쪽으로 가기', '왼쪽으로 간 뒤 몸 숙이기', '왼쪽으로 간 뒤 뛰어넘기'], correct: 2 },
  { id: 'middle-slide', choices: ['가운데로 간 뒤 몸 숙이기', '몸을 숙인 뒤 가운데로 가기', '가운데로 간 뒤 뛰어넘기'], correct: 0 },
  { id: 'not-right', choices: ['오른쪽으로 가기', '오른쪽을 피하고 왼쪽으로 가기', '왼쪽을 피하고 가운데로 가기'], correct: 1 },
  { id: 'slide-left', choices: ['왼쪽으로 간 뒤 몸 숙이기', '몸을 숙인 뒤 오른쪽으로 가기', '몸을 숙인 뒤 왼쪽으로 가기'], correct: 2 },
  { id: 'not-left', choices: ['왼쪽을 피하고 가운데로 가기', '가운데를 피하고 왼쪽으로 가기', '오른쪽으로 가기'], correct: 0 },
  { id: 'right-slide', choices: ['몸을 숙인 뒤 오른쪽으로 가기', '오른쪽으로 간 뒤 몸을 숙여 지나가기', '오른쪽으로 간 뒤 뛰어넘기'], correct: 1 },
  { id: 'jump-stay', choices: ['처음에는 뛰지 않고 다음에 뛰기', '두 표시선에서 모두 뛰기', '한 번 뛴 뒤 다음 표시선에서는 뛰지 않기'], correct: 2 },
  { id: 'right-middle', choices: ['오른쪽으로 간 뒤 가운데로 돌아오기', '가운데로 간 뒤 오른쪽으로 가기', '오른쪽으로 간 뒤 왼쪽으로 가기'], correct: 0 },
  { id: 'not-slide', choices: ['몸을 숙여 지나가기', '몸을 숙이지 않고 그대로 달리기', '울타리를 뛰어넘기'], correct: 1 },
].map(check => Object.freeze({ ...INSTRUCTIONS.find(item => item.id === check.id), ...check, choices: Object.freeze(check.choices) })));
export function checkMetadata(item) {
  return { ...instructionMetadata(item), id: `korean-runner.listening-check.${item.id}`,
    itemKey: `korean-runner.listening-check.${item.id}.v1`, responseFormat: 'single-choice', confounded: false };
}
export function selectListeningChecks(coach, { assignment = coach.assignment?.() ?? null, limit = 3 } = {}) {
  let pool = LISTENING_CHECKS.filter(item => {
    if (!assignment) return true;
    const m = checkMetadata(item);
    return m.skillId === assignment.skillId && m.difficulty === assignment.difficulty
      && m.responseFormat === assignment.responseFormat && m.modality === assignment.modality
      && Array.isArray(assignment.familyKeys) && assignment.familyKeys.includes(m.familyKey)
      && Array.isArray(assignment.itemKeys) && assignment.itemKeys.includes(m.itemKey);
  });
  const count = Math.min(limit, assignment?.requiredAttempts ?? limit), selected = [];
  while (pool.length && selected.length < count) {
    const candidates = pool.map(item => { const m = checkMetadata(item); return { ...item, ...m, id: item.id, skillIds: [m.skillId], label: item.skill }; });
    const plan = coach.recommend(candidates, { audioAvailable: true }), next = pool.find(item => item.id === plan?.selected?.id);
    if (!next) break;
    selected.push(next); pool = pool.filter(item => item.id !== next.id);
  }
  return selected;
}
// Audio completion gates scoring; cancelling/failing cannot become a wrong language answer.
export function createListeningCheck(coach) {
  let current = null, sequence = 0;
  return {
    get current() { return current && { ...current }; },
    begin(item) { this.cancel(); current = { item, token: ++sequence, pid: coach.present(checkMetadata(item)), audio: 'pending', answered: false, replayed: false }; return current.token; },
    delivery(token, status) {
      if (!current || token !== current.token || current.answered) return false;
      if (!['pending', 'completed', 'failed'].includes(status)) throw Error('Invalid audio state');
      current.audio = status; coach.delivery(current.pid, { audio: status }); return true;
    },
    replay() {
      if (!current || current.answered) return false;
      coach.help(current.pid, 'replay'); current.replayed = true; current.audio = 'pending';
      coach.delivery(current.pid, { audio: 'pending' }); return true;
    },
    answer(choice) {
      if (!current || current.answered || current.audio !== 'completed') return null;
      if (!Number.isInteger(choice) || choice < 0 || choice >= current.item.choices.length) throw Error('Invalid choice');
      const result = coach.answer(current.pid, { correct: choice === current.item.correct, assessable: true });
      current.answered = true; return result;
    },
    cancel() {
      if (current && !current.answered) coach.answer(current.pid, { correct: null, assessable: false, reason: current.audio === 'completed' ? 'unanswered' : 'audio' });
      current = null; sequence++;
    },
  };
}
