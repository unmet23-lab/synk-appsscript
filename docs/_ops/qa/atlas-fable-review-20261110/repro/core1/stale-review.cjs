const __ROOT = require('node:path').resolve(__dirname, '../../../../../..').split(require('node:path').sep).join('/');
// 다 써 버린 칸(새 문항 없음)이 7일 뒤 'review'가 되면 풀릴 수 있는가.
const { map, GL, memoryStorage, makeClock, play } = require('./common.cjs');
const DAY = 86400000;
const clock = makeClock('2026-11-01T09:00:00.000Z');
const coach = GL.createGame({ gameId: 'stale', map, storage: memoryStorage(), clock });
const mk = (s, d, i) => ({ id: `${s}.d${d}.${i}`, itemKey: `${s}.d${d}.${i}`, familyKey: `${s}.d${d}.${i}`, skillId: s, skillIds: [s], modality: 'reading', difficulty: d, responseFormat: 'single-choice', audioRequired: false });
const A = 'ko.reading.detail', B = 'ko.reading.reason';
const done = Array.from({ length: 4 }, (_, i) => mk(A, 1, i));       // 첫날 네 문항 모두 정답 → 칸 A는 새 문항 없음
const fresh = Array.from({ length: 12 }, (_, i) => mk(B, 1, i));     // 칸 B에는 새 문항 12개
const all = [...done, ...fresh];
for (const it of done) { play(coach, it, true); clock.advance(20000); }
const cellA = () => { const s = coach.summary().skills.find(x => x.id === A).levels[1].formats['single-choice']; return `${s.status}(n=${s.n}, 우선도 ${s.priority}, 마지막 근거 ${s.lastAt?.slice(0, 10)})`; };
console.log('첫날:', cellA());
clock.set(new Date(Date.parse('2026-11-01T09:00:00.000Z') + 8 * DAY).toISOString());
console.log('8일 뒤:', cellA());
let a = 0, b = 0; const seq = [];
for (let i = 0; i < 30; i += 1) { const r = coach.recommend(all, { audioAvailable: true }); const inA = r.selected.skillId === A; inA ? a += 1 : b += 1; seq.push(inA ? 'A' : 'b'); play(coach, r.selected, true); clock.advance(20000); }
console.log(`8일째 추천대로 30문항 전부 정답 → 다 쓴 칸 A ${a}회, 새 문항이 있는 칸 B ${b}회`);
console.log('순서:', seq.join(''));
console.log('그 뒤 칸 A:', cellA());
clock.advance(40 * DAY);
console.log('40일 더 지난 뒤 칸 A:', cellA(), '| 추천 이유:', coach.recommend(all, { audioAvailable: true }).reason);
