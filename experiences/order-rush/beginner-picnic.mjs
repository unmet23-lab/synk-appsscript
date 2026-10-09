import { makeOrder, readProgress, ITEMS, VOICE_LINES } from './beginner-core.mjs';
export const PICNIC_ID = 'order-playset-picnic';
export const PICNIC_VISITS_KEY = 'synk.order-rush.picnic.v1';
export const PICNIC_FRIENDS = Object.freeze(['rabbit', 'squirrel', 'deer']);
const friendNames = { rabbit: '토끼 · Rabbit', squirrel: '다람쥐 · Squirrel', deer: '사슴 · Deer' };
const permutations = list => list.flatMap((value, index) => list.length === 1 ? [[value]] : permutations(list.filter((_, i) => i !== index)).map(rest => [value, ...rest]));
const key = list => list.join('|');
const roll = seed => { let x = seed >>> 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) || 1; };
export function readPicnicVisits(value, seed = 1) {
  const integer = n => Number.isSafeInteger(n) && n >= 0;
  const valid = value?.version === 1;
  const previous = valid && Array.isArray(value.previous?.voices) && value.previous.voices.length === 3 && value.previous.voices.every(id => VOICE_LINES.some(v => v.id === id)) && Array.isArray(value.previous?.friends) && value.previous.friends.length === 3 && new Set(value.previous.friends).size === 3 && value.previous.friends.every(id => PICNIC_FRIENDS.includes(id)) ? { voices: [...value.previous.voices], friends: [...value.previous.friends] } : null;
  return { version: 1, seed: valid && integer(value.seed) && value.seed > 0 && value.seed <= 0xffffffff ? value.seed : (seed >>> 0) || 1, visits: valid && integer(value.visits) ? Math.min(value.visits, Number.MAX_SAFE_INTEGER - 1) : 0, previous };
}
export function picnicRound(saved) {
  const progress = readProgress(saved), completed = progress.completed.length;
  const stage = Math.max(0, Math.min(3, completed - 1));
  const recipes = completed < 2 ? [makeOrder('water'), makeOrder('bread'), makeOrder('bread')]
    : completed === 2 ? [makeOrder('water', 1, 'please'), makeOrder('bread', 1, 'please'), makeOrder('apple', 1, 'please')]
      : [makeOrder('water', 1, 'please'), makeOrder('bread', 2, 'count'), makeOrder('apple', 3, 'count')];
  // Quantity practice also uses water, already learned in the first chapter.
  return { stage, guided: completed === 0, items: completed < 2 ? ['water', 'bread'] : ['water', 'bread', 'apple'], orders: recipes.map((o, i) => ({ ...o, guest: PICNIC_FRIENDS[i], serial: `picnic-${i}` })) };
}
export function nextPicnicRound(saved, visitState) {
  const progress = readProgress(saved), state = readPicnicVisits(visitState, progress.seed), round = picnicRound(progress), completed = progress.completed.length;
  let recipes = round.orders.map(({ item, count, voice, text }) => ({ item, count, voice, text })), friends = [...PICNIC_FRIENDS];
  const seed = roll(state.seed);
  // The first visit stays gentle and predictable; later visits vary within the same taught range.
  if (state.visits > 0 || state.previous) {
    const candidates = completed < 2 ? [['water', 'water', 'bread'], ['water', 'bread', 'water'], ['water', 'bread', 'bread'], ['bread', 'water', 'water'], ['bread', 'water', 'bread'], ['bread', 'bread', 'water']].map(row => row.map(id => makeOrder(id)))
      : completed === 2 ? permutations(['water', 'bread', 'apple'].map(id => makeOrder(id, 1, 'please')))
        : ['please', 1, 2, 3].flatMap(bread => ['please', 1, 2, 3].flatMap(apple => permutations([makeOrder('water', 1, 'please'), makeOrder('bread', bread === 'please' ? 1 : bread, bread === 'please' ? 'please' : 'count'), makeOrder('apple', apple === 'please' ? 1 : apple, apple === 'please' ? 'please' : 'count')])));
    const previousItems = key((state.previous?.voices || []).map(id => id.split('-')[0]));
    const differentOrders = candidates.filter(row => key(row.map(o => o.item)) !== previousItems);
    const differentFriends = permutations(PICNIC_FRIENDS).filter(row => key(row) !== key(state.previous?.friends || []));
    recipes = differentOrders[seed % differentOrders.length]; friends = differentFriends[roll(seed) % differentFriends.length];
  }
  round.orders = recipes.map((order, i) => ({ ...order, guest: friends[i], serial: `picnic-${state.visits + 1}-${i}` }));
  return { round, state: { version: 1, seed, visits: state.visits + 1, previous: { voices: recipes.map(o => o.voice), friends } } };
}
// Keep variation history separate from the main chapter/checkpoint, Atlas and wallet.
// A failed write still advances the current page's memory, so free replay continues.
export function createPicnicVisits(storage, seed = 1) {
  let memory = readPicnicVisits(null, seed);
  return { next(saved) {
    let readable = false;
    try { const raw = storage.getItem(PICNIC_VISITS_KEY); readable = true; let parsed; try { parsed = JSON.parse(raw); } catch { parsed = null; } const loaded = readPicnicVisits(parsed, seed); if (loaded.visits >= memory.visits) memory = loaded; } catch { /* Continue in this page. */ }
    const result = nextPicnicRound(saved, memory); memory = result.state; let stored = false;
    if (readable) try { storage.setItem(PICNIC_VISITS_KEY, JSON.stringify(memory)); stored = true; } catch { /* Do not claim reload continuity. */ }
    return { ...result, stored };
  } };
}
export function picnicScene(orders, served = 0, { active = null, preview = false } = {}) {
  const count = Math.max(0, Math.min(3, served));
  return `<div class="b-scene-view b-picnic-scene ${preview ? 'preview' : ''}" aria-label="${preview ? '소풍 놀이 미리보기 · Picnic preview' : `${count}명에게 음식을 건넨 소풍 · ${count} of 3 friends served`}"><span class="b-picnic-sign">${preview ? '우리 셋의 소풍' : count === 3 ? '함께라서 더 맛있어요' : '소풍을 준비해요'}<small lang="en">${preview ? 'OUR LITTLE PICNIC' : count === 3 ? 'A PICNIC MADE TOGETHER' : 'ONE FRIEND AT A TIME'}</small></span><div class="b-picnic-blanket" aria-hidden="true"></div>${orders.map((order, i) => i < count || order.guest === active || preview ? `<img class="b-picnic-friend friend-${i}" src="assets/cast/${order.guest}.webp" alt="${friendNames[order.guest]}">` : '').join('')}<img class="b-picnic-roll" src="assets/picnic/rolled-mat.webp" alt="">${orders.slice(0, count).map((o, i) => `<div class="b-picnic-food food-${i}" aria-label="${ITEMS[o.item].name} ${o.count}개 · ${o.count} ${ITEMS[o.item].english}">${Array.from({ length: o.count }, () => `<img src="${ITEMS[o.item].image}" alt="">`).join('')}</div>`).join('')}<span class="b-picnic-progress">${preview ? '3명 초대 · 3번 건네기' : `${count} / 3 · 소풍에 도착한 주문`}<small lang="en">${preview ? 'Three friends · Three orders' : `${count} of 3 orders delivered`}</small></span></div>`;
}
