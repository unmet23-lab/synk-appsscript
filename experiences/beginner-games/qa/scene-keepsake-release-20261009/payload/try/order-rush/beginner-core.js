// 한국어 처음: 들은 물건과 수량을 실제로 건네는 독립 모드. 시범/도움/재시도는 독립 듣기 성공과 분리한다.
export const SAVE_KEY = 'synk.order-rush.beginner.v1';
export const ITEMS = Object.freeze({
  water: { name: '물', english: 'water', image: 'beginner-assets/beginner/water.webp' },
  bread: { name: '빵', english: 'bread', image: 'beginner-assets/beginner/bread.webp' },
  apple: { name: '사과', english: 'apple', image: 'beginner-assets/beginner/apple.webp' },
});
export const COUNTS = ['', '한 개', '두 개', '세 개'];
export const VOICE_LINES = Object.freeze([
  ...Object.entries(ITEMS).map(([id, item]) => ({ id, text: item.name })),
  ...[1, 2, 3].map(n => ({ id: `count-${n}`, text: COUNTS[n] })),
  ...Object.entries(ITEMS).map(([id, item]) => ({ id: `${id}-please`, text: `${item.name} 주세요.` })),
  ...['bread', 'apple'].flatMap(id => [1, 2, 3].map(n => ({ id: `${id}-${n}`, text: `${ITEMS[id].name} ${COUNTS[n]} 주세요.` }))),
]);
export const STAGES = Object.freeze([
  { id: 'first', title: '작은 가게의 첫날', subtitle: '물 · 빵', reward: '가게에 첫 손님 사진이 걸렸어요.', scene: 'first', items: ['water', 'bread'], demos: ['water', 'bread'], rounds: 6 },
  { id: 'fruit', title: '소풍 가는 손님', subtitle: '사과 · 주세요', reward: '새 메뉴 사과가 진열됐어요.', scene: 'picnic', items: ['water', 'bread', 'apple'], demos: ['apple', 'water-please', 'bread-please', 'apple-please'], rounds: 6 },
  { id: 'together', title: '친구 몫도 함께', subtitle: '한 개 · 두 개 · 세 개', reward: '둘이 먹을 것도, 셋이 먹을 것도 준비했어요.', scene: 'friends', items: ['bread', 'apple'], demos: ['count-1', 'count-2', 'count-3', 'bread-2'], rounds: 6 },
  { id: 'festival', title: '우리 동네 작은 축제', subtitle: '배운 말로 새로운 주문', reward: '동네 친구들이 모두 모였어요. 첫 영업 완료!', scene: 'festival', items: ['water', 'bread', 'apple'], demos: [], rounds: 9 },
]);
export const GUESTS = Object.freeze([
  { id: 'bear', name: '곰', arrival: '산책하다 들렀어요.', thanks: '덕분에 산책할 힘이 났어요!', reaction: '든든한 한입' },
  { id: 'rabbit', name: '토끼', arrival: '소풍 가는 길이에요.', thanks: '소풍 가방이 준비됐어요!', reaction: '소풍 준비 끝' },
  { id: 'penguin', name: '펭귄', arrival: '오늘은 동네 구경 중.', thanks: '마음에 쏙 드는 가게를 찾았어요!', reaction: '단골 예약' },
  { id: 'squirrel', name: '다람쥐', arrival: '친구를 만나러 가요.', thanks: '친구와 나누어 먹을게요!', reaction: '친구에게 선물' },
  { id: 'otter', name: '수달', arrival: '물놀이하고 돌아왔어요.', thanks: '이제 조금 쉬어야겠어요!', reaction: '기분 좋은 휴식' },
  { id: 'deer', name: '사슴', arrival: '축제에 가져갈 거예요.', thanks: '우리 축제에서도 또 만나요!', reaction: '축제 초대장' },
  { id: 'fox', name: '여우', arrival: '좋은 냄새에 들어왔어요.', thanks: '기다린 보람이 있어요!', reaction: '향긋한 한때' },
  { id: 'panda', name: '판다', arrival: '천천히 골라 먹고 싶어요.', thanks: '서두르지 않아도 돼서 좋아요!', reaction: '느긋한 오후' },
  { id: 'hedgehog', name: '고슴도치', arrival: '조금 수줍은 첫 방문.', thanks: '다음에는 친구도 데려올게요!', reaction: '새 친구 한 명' },
]);
export function shuffle(list, seed = 1) {
  let x = (Number(seed) >>> 0) || 1; const copy = [...list];
  const rand = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
export function makeOrder(item, count = 1, style = 'word') {
  if (!ITEMS[item] || !Number.isInteger(count) || count < 1 || count > 3 || (item === 'water' && count !== 1)) throw new Error('Unknown beginner order');
  const voice = style === 'word' ? item : style === 'please' ? `${item}-please` : `${item}-${count}`;
  const clip = VOICE_LINES.find(line => line.id === voice);
  if (!clip) throw new Error('Unknown voice line');
  return { item, count, voice, text: clip.text };
}
export function stageOrders(index, seed = 1) {
  const recipes = [
    ['water', 'bread', 'water', 'bread', 'bread', 'water'].map(id => makeOrder(id)),
    ['apple', 'water', 'bread', 'apple', 'bread', 'water'].map(id => makeOrder(id, 1, 'please')),
    ['bread', 'apple'].flatMap(id => [1, 2, 3].map(n => makeOrder(id, n, 'count'))),
    [makeOrder('water', 1, 'please'), ...['bread', 'apple'].flatMap(id => [1, 2, 3].map(n => makeOrder(id, n, 'count'))), makeOrder('bread', 1, 'please'), makeOrder('apple', 1, 'please')],
  ];
  if (!STAGES[index]) throw new Error('Unknown stage');
  return shuffle(recipes[index], seed).map((order, i) => ({ ...order, guest: GUESTS[(i + index * 2 + seed % GUESTS.length) % GUESTS.length].id, serial: `${index}-${i}` }));
}
export function judge(order, tray) {
  const safe = Array.isArray(tray) ? tray : [];
  return { correct: safe.length === order.count && safe.every(item => item === order.item), empty: safe.length === 0, itemMismatch: safe.some(item => item !== order.item), countMismatch: safe.length !== order.count };
}
export function observation(order, attempt) {
  return { voice: order.voice, stage: attempt.stage, firstCorrect: !!attempt.firstCorrect, independent: !!attempt.firstCorrect && !!attempt.heard && !attempt.demo && !attempt.help && !attempt.replay && !attempt.resumed,
    heard: !!attempt.heard, helped: !!attempt.help, replayed: !!attempt.replay, retried: attempt.attempts > 1, demo: !!attempt.demo, resumed: !!attempt.resumed };
}
export function summary(records = []) {
  const real = records.filter(record => record && !record.demo);
  return { total: real.length, firstCorrect: real.filter(r => r.firstCorrect).length, independent: real.filter(r => r.independent).length,
    helped: real.filter(r => r.helped || r.replayed || r.resumed).length, retried: real.filter(r => r.retried).length };
}
export function metadata(order) {
  return { id: `order-rush.beginner.${order.voice}`, itemKey: `order-rush.beginner.${order.voice}.v1`, familyKey: `order-rush.beginner.${order.voice}.v1`,
    skillId: Object.hasOwn(ITEMS, order.voice) ? 'ko.listening.word' : 'ko.listening.detail', difficulty: /-[123]$/.test(order.voice) ? 2 : 1, modality: 'listening', responseFormat: 'action', audioRequired: true, confounded: false, conceptIds: [] };
}
export function newProgress(seed = Date.now() % 1000000) {
  return { version: 1, seed: Math.max(1, Math.trunc(seed)), stage: 0, completed: [], records: [], checkpoint: null, roundId: null, finished: false, festivalPractice: { visits: 0, previous: null }, memoryPractice: { visits: 0, previous: null } };
}
// Optional replay history lives inside the existing account-backed chapter key.
// It never unlocks a stage, changes the story seed or adds a listening result.
export function readPracticeHistory(value, count) {
  const visits = Number.isSafeInteger(value?.visits) && value.visits >= 0 ? Math.min(value.visits, Number.MAX_SAFE_INTEGER - 1) : 0;
  const previous = value?.previous;
  const valid = Array.isArray(previous?.voices) && previous.voices.length > 0 && previous.voices.length <= count && previous.voices.every(id => VOICE_LINES.some(line => line.id === id)) && Array.isArray(previous?.guests) && previous.guests.length === previous.voices.length && previous.guests.every(id => GUESTS.some(guest => guest.id === id));
  return { visits, previous: valid ? { voices: [...previous.voices], guests: [...previous.guests] } : null };
}
export function readProgress(value) {
  if (!value || value.version !== 1 || !Number.isInteger(value.seed) || value.seed < 1 || value.seed > 1e12) return newProgress();
  const out = newProgress(value.seed);
  out.completed = [...new Set((Array.isArray(value.completed) ? value.completed : []).filter(n => Number.isInteger(n) && n >= 0 && n < STAGES.length))].sort();
  // A later unlocked chapter cannot be imported without its predecessors.
  out.completed = out.completed.filter((n, i) => n === i);
  out.stage = Math.min(out.completed.length, STAGES.length - 1);
  out.finished = out.completed.length === STAGES.length;
  out.records = Array.isArray(value.records) ? value.records.filter(r => r && !r.demo && Number.isInteger(r.stage) && r.stage >= 0 && r.stage < STAGES.length && VOICE_LINES.some(v => v.id === r.voice)).slice(0, 300) : [];
  out.roundId = typeof value.roundId === 'string' && value.roundId.length < 180 ? value.roundId : null;
  out.festivalPractice = readPracticeHistory(value.festivalPractice, STAGES[3].rounds);
  out.memoryPractice = readPracticeHistory(value.memoryPractice, 2);
  const c = value.checkpoint;
  if (!out.finished && c && c.stage === out.stage && ['demo', 'order'].includes(c.phase) && Number.isInteger(c.index) && c.index >= 0 && c.index < (c.phase === 'demo' ? STAGES[out.stage].demos.length : STAGES[out.stage].rounds)) out.checkpoint = { phase: c.phase, index: c.index, stage: c.stage, touched: c.touched === true, attempts: Number.isInteger(c.attempts) ? Math.max(0, Math.min(999, c.attempts)) : 0, firstCorrect: typeof c.firstCorrect === 'boolean' ? c.firstCorrect : null, helped: c.helped === true, replayed: c.replayed === true, hint: c.hint === true, tray: Array.isArray(c.tray) ? c.tray.filter(item => STAGES[out.stage].items.includes(item)).slice(0, 3) : [] };
  return out;
}
export function validateVoiceManifest(manifest) {
  if (manifest?.version !== 1 || manifest.provider !== 'typecast' || manifest.approved !== true) throw new Error('한국어 목소리를 아직 준비하고 있어요. 준비된 뒤 시작할 수 있어요.');
  for (const line of VOICE_LINES) {
    const clip = manifest.clips?.[line.id];
    if (!clip || clip.text !== line.text || typeof clip.file !== 'string' || !/^audio\/[a-z0-9-]+\.(mp3|wav)$/.test(clip.file)) throw new Error('필요한 한국어 소리가 빠져 있어요. 다시 준비해 주세요.');
  }
  return true;
}
