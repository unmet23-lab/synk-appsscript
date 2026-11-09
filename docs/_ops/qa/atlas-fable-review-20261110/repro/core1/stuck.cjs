const __ROOT = require('node:path').resolve(__dirname, '../../../../../..').split(require('node:path').sep).join('/');
// 작은 문항 은행(한 칸에 6가족)에서 처음 두 번 틀린 뒤 계속 맞히는 학습자: 칸 상태가 언제 풀리나.
const { map, GL, memoryStorage, makeClock, play } = require('./common.cjs');
const DAY = 86400000;
function scenario(families, label) {
  const clock = makeClock('2026-11-01T09:00:00.000Z');
  const coach = GL.createGame({ gameId: 'small', map, storage: memoryStorage(), clock });
  const skill = 'ko.listening.negation';
  const mk = (s, d, i) => ({ id: `${s}.d${d}.${i}`, itemKey: `${s}.d${d}.${i}`, familyKey: `${s}.d${d}.${i}`, skillId: s, skillIds: [s], modality: 'listening', difficulty: d, responseFormat: 'cup-compose', audioRequired: false });
  const cell = Array.from({ length: families }, (_, i) => mk(skill, 2, i));
  const others = ['ko.listening.detail', 'ko.listening.condition'].flatMap(s => Array.from({ length: 6 }, (_, i) => mk(s, 1, i)));
  const all = [...cell, ...others];
  const state = () => { const s = coach.summary().skills.find(x => x.id === skill).levels[2].formats['cup-compose']; return `${s.status}(n=${s.n}, 맞음 ${s.correct}, 틀림 ${s.incorrect}, 우선도 ${s.priority})`; };
  console.log(`\n=== ${label}`);
  let step = 0, picks = { cell: 0, other: 0 };
  const turn = (correctFn) => { const r = coach.recommend(all, { audioAvailable: true }); const it = r.selected; const inCell = it.skillId === skill; picks[inCell ? 'cell' : 'other'] += 1; const res = play(coach, it, correctFn(it, step)); step += 1; clock.advance(20000); return { it, r, res }; };
  // 1) 그 칸 문항만 직접 내서 처음 둘 틀림, 셋째 맞음
  play(coach, cell[0], false); clock.advance(20000); play(coach, cell[1], false); clock.advance(20000); play(coach, cell[2], true); clock.advance(20000);
  console.log('처음 셋(틀림·틀림·맞음) 뒤:', state());
  // 2) 그 뒤 40문항은 추천대로, 전부 맞힘
  picks = { cell: 0, other: 0 }; let firstTry = 0, repeats = 0; const reasons = new Map();
  for (let i = 0; i < 40; i += 1) { const { it, r, res } = turn(() => true); if (it.skillId === skill) { if (res.exposure === 'new') firstTry += 1; else repeats += 1; } reasons.set(r.reason, (reasons.get(r.reason) || 0) + 1); }
  console.log(`추천대로 40문항 전부 정답 → 그 칸 ${picks.cell}회(새 문항 ${firstTry}, 다시 본 문항 ${repeats}), 다른 칸 ${picks.other}회`);
  console.log('상태:', state());
  console.log('이유 문장 분포:', JSON.stringify([...reasons]));
  for (const days of [8, 29, 31]) { clock.set(new Date(Date.parse('2026-11-01T09:00:00.000Z') + days * DAY).toISOString()); console.log(`${days}일 뒤 상태:`, state(), '| 추천:', coach.recommend(all, { audioAvailable: true }).reason); }
}
scenario(6, '한 칸에 문항 6가족(주문 폭주의 빼기·바꾸기 칸과 비슷한 크기)');
scenario(14, '한 칸에 문항 14가족');
