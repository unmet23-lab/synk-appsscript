// 기억 1판의 간격이 어떻게 늘어나는가: 제때 만나 답했을 때 다음 만남까지의 날 수(FSRS-6 기본 매개변수 · 목표 보유율 0.9 · 최대 60일).
import { loadFsrs } from './fsrs-path.mjs';
const { fsrs, generatorParameters, createEmptyCard } = loadFsrs();
const f = fsrs(generatorParameters({ request_retention: 0.9, maximum_interval: 60, enable_fuzz: false, enable_short_term: false }));
const DAY = 86400000, t0 = Date.parse('2026-12-01T09:00:00Z');
function walk(label, grades) {
  let card = createEmptyCard(new Date(t0)), at = t0; const gaps = [];
  for (const g of grades) { card = f.next(card, new Date(at), g).card; const gap = Math.min(60, Math.round((card.due - at) / DAY)); gaps.push(`${gap}일`); at += gap * DAY; }
  console.log(label, gaps.join(' → '));
}
walk('고르는 꼴로 계속 혼자 맞힘(Hard):          ', [2, 2, 2, 2, 2, 2]);
walk('만들어 내는 꼴로 계속 혼자 맞힘(Good):     ', [3, 3, 3, 3, 3, 3]);
walk('처음 틀리고 그 뒤 고르는 꼴로 계속 맞힘:   ', [1, 2, 2, 2, 2, 2]);
walk('고르는 꼴: 맞힘 · 맞힘 · 맞힘 · 틀림 · 맞힘 · 맞힘:', [2, 2, 2, 1, 2, 2]);
