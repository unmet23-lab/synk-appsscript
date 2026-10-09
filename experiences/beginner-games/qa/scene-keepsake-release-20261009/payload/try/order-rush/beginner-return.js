import { GUESTS, STAGES, readProgress, readPracticeHistory, stageOrders, shuffle } from './beginner-core.js';

const same = (a, b) => a?.length === b?.length && a.every((value, i) => value === b[i]);
const rotate = list => [...list.slice(1), list[0]];
const historyFor = (history, orders) => ({ visits: history.visits + 1, previous: { voices: orders.map(order => order.voice), guests: orders.map(order => order.guest) } });

export function nextFestivalRound(saved) {
  const progress = readProgress(saved), history = readPracticeHistory(progress.festivalPractice, 9);
  const previous = history.previous || (() => { const story = stageOrders(3, progress.seed + 3); return { voices: story.map(order => order.voice), guests: story.map(order => order.guest) }; })();
  let orders = stageOrders(3, (progress.seed + 1009 + history.visits * 7919) % 0xffffffff);
  // Both sequences change, including the first replay after the final story stage.
  if (same(orders.map(order => order.voice), previous.voices)) orders = rotate(orders);
  if (same(orders.map(order => order.guest), previous.guests)) {
    const guests = rotate(orders.map(order => order.guest)); orders = orders.map((order, i) => ({ ...order, guest: guests[i] }));
  }
  orders = orders.map((order, i) => ({ ...order, serial: `festival-replay-${history.visits + 1}-${i}` }));
  return { orders, history: historyFor(history, orders), shelfSeed: (progress.seed + 104729 + history.visits * 53) % 0xffffffff };
}

// Only recently assisted or corrected story orders are candidates. No invented
// deficit is inferred from demos, skipped audio or an empty imported fixture.
export function memoryCandidates(saved) {
  const progress = readProgress(saved), latest = new Map();
  for (const record of progress.records) if (record.heard && !record.demo) latest.set(record.voice, record);
  return [...latest.values()].reverse().filter(record => !record.independent && (record.firstCorrect === false || record.helped || record.replayed || record.resumed)).map(record => {
    const storyOrders = stageOrders(record.stage, progress.seed + record.stage), storyIndex = Number.isInteger(record.orderIndex) && storyOrders[record.orderIndex]?.voice === record.voice ? record.orderIndex : storyOrders.findIndex(order => order.voice === record.voice), learned = storyOrders[storyIndex];
    return learned ? { ...learned, previousGuest: GUESTS.some(guest => guest.id === record.guest) ? record.guest : learned.guest, stage: record.stage, storyIndex } : null;
  }).filter(Boolean).slice(0, 2);
}

export function nextMemoryRound(saved) {
  const progress = readProgress(saved), history = readPracticeHistory(progress.memoryPractice, 2), candidates = memoryCandidates(progress);
  if (!candidates.length) return null;
  const seed = (progress.seed + 15485863 + history.visits * 97) % 0xffffffff;
  let picked = shuffle(candidates, seed);
  if (picked.length > 1 && same(picked.map(order => order.voice), history.previous?.voices)) picked = rotate(picked);
  const orders = picked.map((order, i) => {
    const blocked = [order.previousGuest, history.previous?.guests[i]];
    const guests = shuffle(GUESTS.map(guest => guest.id).filter(id => !blocked.includes(id)), seed + i * 31);
    return { ...order, guest: guests[0], serial: `memory-practice-${history.visits + 1}-${i}` };
  });
  const stage = Math.max(...orders.map(order => order.stage)), items = [...new Set([...STAGES[stage].items, ...orders.map(order => order.item)])];
  return { orders, stage, items, history: historyFor(history, orders), shelfSeed: seed };
}

export function memoryShelf(items, seed, previousStoryOrder, storySeed) {
  let layout = shuffle(items, seed);
  const previous = shuffle(STAGES[previousStoryOrder.stage].items, storySeed + previousStoryOrder.storyIndex + previousStoryOrder.stage * 71);
  if (same(layout, previous)) layout = rotate(layout);
  return layout;
}
