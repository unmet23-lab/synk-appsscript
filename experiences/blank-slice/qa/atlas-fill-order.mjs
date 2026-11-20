// 넘친 #4 잰 장면(단계 4 계획 §23-13 · §6 학생 전체 켜기 조건): 빈 기억 손님이 빈칸 베기를 같은 날 네 판 한다(넷째 · 여덟째 · 열두째 문장을 틀림,
// 판 사이 1분). 옛 엔진(지금 판 — rankItems · composeRound)과 새 길(문 · 키트 · 진짜 엔진 코치)에서 판마다 앞 판과 같은 자리 같은 문장 수와
// 처음 보는 문장 수를 센다. 채우기 차례(§23-14)를 고친 뒤의 수는 blank-slice/atlas-fill-order.test.mjs가 지킨다.
//   node experiences/blank-slice/qa/atlas-fill-order.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = new URL('../', import.meta.url);
const repo = new URL('../../', here);
const { ITEMS } = await import(new URL('content.mjs', here));
const { composeRound } = await import(new URL('core.mjs', here));
const { rankItems, missedPractice, createReadingConfirmation, itemMetadata } = await import(new URL('learning.mjs', here));
export const ROUNDS = 4;
const wrongAt = i => i % 4 === 3;
const answerWith = (item, i) => (wrongAt(i) ? item.options.find(option => option !== item.answer) : item.answer);

export function oldRounds() {
  const require = createRequire(new URL('learning.mjs', here));
  const { createGame } = require('../../atlas/game-learning.js');
  const { createMap } = require('../../strata/index.js');
  const map = createMap(require('../../strata/topik-i.js').topikMap());
  const store = new Map();
  let clock = Date.parse('2026-11-19T01:00:00Z');
  const coach = createGame({
    gameId: 'blank-slice',
    map,
    storage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
    clock: () => new Date((clock += 1000)).toISOString(),
  });
  const rounds = [];
  for (let plays = 0; plays < ROUNDS; plays++) {
    const ranked = plays === 0 ? null : rankItems(coach, ITEMS);
    const lead = missedPractice(coach)?.target.id ?? null;
    const queue = composeRound(ITEMS, { ranked: ranked?.order, firstTime: plays === 0, seed: plays + 1, lead });
    queue.forEach((item, i) => {
      const check = createReadingConfirmation(coach, item);
      clock += 3000;
      check.confirm(answerWith(item, i));
      clock += 1000;
    });
    rounds.push({ ids: queue.map(item => item.id) });
    clock += 60000;
  }
  return rounds;
}

export async function newRounds() {
  const atlas = await import(new URL('packages/atlas/src/index.mjs', repo));
  const { openSlice } = await import(new URL('atlas-next-play.mjs', here));
  const { createGameDoor } = await import(new URL('experiences/synk-world-app/world-atlas-game.mjs', repo));
  const json = file => JSON.parse(readFileSync(new URL(file, repo), 'utf8'));
  const mapData = {
    index: json('packages/atlas/map/index.json'),
    units: json('packages/atlas/map/units.json'),
    words: json('packages/atlas/map/words.json'),
  };
  const time = { t: Date.UTC(2026, 10, 19, 1) };
  const port = atlas.memoryPort();
  const coach = atlas.createCoach({
    gameId: 'blank-slice',
    mapData,
    dayOffset: 540,
    host: { guest: true, port, key: 'synk-atlas:fill-order', now: () => time.t },
  });
  await coach.ready;
  const statuses = [];
  const idles = new Set();
  const spy = {
    ...Object.fromEntries(
      Object.keys(coach)
        .filter(name => typeof coach[name] === 'function')
        .map(name => [name, (...args) => coach[name](...args)]),
    ),
    recommend: (candidates, options) => {
      const result = coach.recommend(candidates, options);
      statuses.push(result.status);
      if (result.status === 'idle' && result.selected) idles.add(result.selected.itemKey);
      return result;
    },
  };
  const door = createGameDoor({ entry: { gameCoach: async () => spy, retired: () => () => {} }, gameId: 'blank-slice', later: fn => fn() });
  const top = { SYNKAtlasGame: door.api };
  const slice = await openSlice({ win: { parent: top, top, addEventListener() {} } });
  const rounds = [];
  for (let r = 1; r <= ROUNDS; r++) {
    statuses.length = 0;
    idles.clear();
    const plan = slice.round({ firstTime: r === 1, seed: r });
    for (let i = 0; i < 12; i++) {
      const item = plan.at(i);
      const check = createReadingConfirmation(slice.coach, item);
      time.t += 3000;
      check.confirm(answerWith(item, i));
      time.t += 1000;
    }
    plan.end();
    const count = status => statuses.filter(s => s === status).length;
    const filled = new Set(plan.queue.filter(item => idles.has(itemMetadata(item).itemKey)).map(item => item.id));
    await new Promise(resolve => setTimeout(resolve, 0));
    const presented = (await port.read()).map(row => row.value?.event).filter(event => event?.type === 'practice.presented');
    const shown = presented.slice(-plan.queue.length).map(event => ({ itemKey: event.itemKey, units: event.units, idle: event.reason?.code === 'idle' }));
    rounds.push({ ids: plan.queue.map(item => item.id), filled, shown, picks: `ready ${count('ready')} · idle ${count('idle')} · none ${count('none')}` });
    time.t += 60000;
  }
  return rounds;
}

function report(name, rounds) {
  const seen = new Set();
  console.log(name);
  rounds.forEach((round, r) => {
    const fresh = round.ids.filter(id => !seen.has(id)).length;
    const same = r ? round.ids.filter((id, i) => rounds[r - 1].ids[i] === id).length : '-';
    const again = r ? round.ids.filter(id => rounds[r - 1].ids.includes(id)) : [];
    const againFilled = round.filled ? again.filter(id => round.filled.has(id)).length : null;
    round.ids.forEach(id => seen.add(id));
    console.log(`  판 ${r + 1}: 앞 판과 같은 자리 같은 문장 ${same} · 앞 판에 나온 문장 ${r ? again.length : '-'}${againFilled != null && r ? `(채우기 ${againFilled})` : ''} · 처음 보는 문장 ${fresh}${round.picks ? ` · ${round.picks}` : ''}`);
    console.log(`         ${round.ids.join(' ')}`);
  });
  console.log(`  네 판에 나온 문장 ${seen.size} / 은행 ${ITEMS.length}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  report('옛 엔진(지금 판)', oldRounds());
  report('새 길', await newRounds());
}
