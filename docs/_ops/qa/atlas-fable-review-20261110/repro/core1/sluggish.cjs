const __ROOT = require('node:path').resolve(__dirname, '../../../../../..').split(require('node:path').sep).join('/');
const { map, GL, memoryStorage, makeClock, play } = require('./common.cjs');
const clock = makeClock(); const coach = GL.createGame({ gameId: 's', map, storage: memoryStorage(), clock });
const S = 'ko.reading.detail';
const mk = i => ({ id: `q${i}`, itemKey: `q${i}`, familyKey: `q${i}`, skillId: S, skillIds: [S], modality: 'reading', difficulty: 1, responseFormat: 'single-choice', audioRequired: false });
const cell = () => { const s = coach.summary().skills.find(x => x.id === S).levels[1].formats['single-choice']; return `${s.status} (최근 12개 중 맞음 ${s.correct}, 틀림 ${s.incorrect}, 우선도 ${s.priority})`; };
let i = 0; const go = ok => { play(coach, mk(i++), ok); clock.advance(20000); };
for (let k = 0; k < 12; k += 1) go(true);
console.log('새 문항 12개 연속 정답:', cell());
go(false); console.log('+ 오답 1:', cell(), '|', coach.recommend([mk(999)]).reason);
go(false); console.log('+ 오답 2(연속):', cell(), '|', coach.recommend([mk(999)]).reason);
go(false); console.log('+ 오답 3(연속):', cell());
let n = 0; while (!cell().startsWith('recent-independent') && n < 40) { go(true); n += 1; }
console.log(`그 뒤 새 문항 연속 정답 ${n}개째에 다시:`, cell());
