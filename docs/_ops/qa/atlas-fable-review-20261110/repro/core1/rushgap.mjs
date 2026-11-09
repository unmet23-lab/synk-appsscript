const __ROOT = (() => { let p = decodeURIComponent(new URL('../../../../../..', import.meta.url).pathname); if (p.endsWith('/')) p = p.slice(0, -1); return p.charAt(2) === ':' ? p.slice(1) : p; })();
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { ROOT, map, GL, memoryStorage, makeClock } = require('./common.cjs');
const load = f => import(pathToFileURL(ROOT + '/' + f).href);
const { ORDERS } = await load('experiences/order-rush/core.mjs');
const { orderCandidates, orderMetadata, chooseOrderLive, FLOW_PRACTICE, FLOW_WORDS, FLOW_SKILLS } = await load('experiences/order-rush/learning.mjs');
function run(label, answer, steps = 16) {
  const clock = makeClock(); const coach = GL.createGame({ gameId: 'order-rush', map, storage: memoryStorage(), clock });
  const live = coach.live(FLOW_PRACTICE, { skillIds: FLOW_SKILLS, responseFormat: 'cup-compose', words: FLOW_WORDS });
  const rows = [];
  for (let i = 1; i <= steps; i += 1) {
    const plan = chooseOrderLive(live, ORDERS); const order = plan.selected, m = orderMetadata(order);
    const pid = live.present({ ...m }); coach.delivery(pid, { audio: 'completed' });
    const ok = answer(m, i); const out = live.answer(pid, { correct: ok, assessable: true });
    rows.push(`${String(i).padStart(2)} ${order.id} ${m.skillId.split('.').at(-1).padEnd(9)} 난도 ${m.difficulty} ${ok ? 'O' : 'X'} ${out.recorded.exposure === 'repeat' ? '(다시 본 주문)' : ''} | 칸 상태 ${plan.state} | 손잡이 난도 ${out.settings.level}${out.line ? ` · 「${out.line.text}」` : ''}`);
    clock.advance(20000);
  }
  console.log(`\n=== ${label} (주문 ${ORDERS.length}개)`); console.log(rows.join('\n'));
}
run('한가한 오픈 · 전부 정답', () => true, 18);
run('한가한 오픈 · 빼기·바꾸기(negation)만 틀림', m => !m.skillId.endsWith('negation'), 18);
