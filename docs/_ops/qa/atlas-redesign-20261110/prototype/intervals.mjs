// 기억 1판의 간격이 어떻게 늘어나는가: 제때 만나 답했을 때 다음 만남까지의 날 수(FSRS-6 기본 매개변수 · 목표 보유율 0.9 · 최대 60일).
// 등급: again 틀림 · hard 힌트 보고 맞힘 · weak 고르는 꼴을 혼자 맞힘(약한 성공) · good 만들어 내는 꼴을 혼자 맞힘.
// 「제때」 = 돌아올 때가 된 바로 그때. 다만 같은 자리(6시간) 안에는 다시 만나지 않으므로 놓친 뒤의 첫 만남은 하루 뒤로 둔다.
import { PARAMS, createMemory } from './brain.mjs';
import { loadFsrs } from './fsrs-path.mjs';
const DAY = 86400000, t0 = Date.parse('2026-12-01T09:00:00Z');
function walk(label, grades, params = PARAMS) {
  const memory = createMemory(loadFsrs(), params), answers = []; let at = t0, state = null; const gaps = [];
  for (const grade of grades) {
    answers.push({ at, grade }); state = memory.fold(answers);
    const gap = Math.max(memory.intervalDays(state), grade === 'again' ? 1 : 0);
    gaps.push(gap < 10 ? `${gap.toFixed(1)}일` : `${Math.round(gap)}일`); at += gap * DAY;
  }
  console.log(label, gaps.join(' → '), `(난이도 값 ${state.difficulty.toFixed(1)})`);
}
const six = grade => Array(6).fill(grade);
walk('고르는 꼴을 계속 혼자 맞힘(약한 성공):        ', six('weak'));
walk('만들어 내는 꼴을 계속 혼자 맞힘(Good):        ', six('good'));
walk('힌트를 보고 계속 맞힘(Hard):                  ', six('hard'));
walk('처음 틀리고 그 뒤 고르는 꼴을 계속 맞힘:      ', ['again', ...Array(5).fill('weak')]);
walk('고르는 꼴: 맞힘 · 맞힘 · 맞힘 · 틀림 · 맞힘 · 맞힘:', ['weak', 'weak', 'weak', 'again', 'weak', 'weak']);
walk('고르는 꼴 셋 뒤 만들어 내는 꼴 셋:            ', ['weak', 'weak', 'weak', 'good', 'good', 'good']);
console.log('— 견줄 값 —');
walk('약한 성공의 증가분을 0.6으로:                 ', six('weak'), { ...PARAMS, weakWeight: 0.6 });
walk('고르는 꼴도 Good으로(증가분 1.0):             ', six('weak'), { ...PARAMS, weakWeight: 1 });
