// 찰칵 낱말 — 판 짜기 · 부탁 고르기 · 판정 · 앨범(화면과 갈라 시험한다, 설계 2 · 4 · 5절). 화면 · 소리 · 저장소를 모른다.
import { WORDS, wordOf } from './words.mjs';
import { placeWords } from './places.mjs';

export const STORE_KEY = 'synk.snap-words.v1';
export const MISSIONS_PER_ROUND = 4;
export const RECALL_PER_ROUND = 3;

/** mulberry32 — 시험에서 같은 판을 다시 만든다. */
export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const shuffle = (list, rng) => { const a = [...list]; for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** 부탁을 먼저 고르고, 그 정답이 반드시 들어가게 판마다 글자를 섞어 얹는다. */
export function layoutPlates(place, missions, rng) {
  const plates = [];
  for (const [groupId, group] of Object.entries(place.groups)) {
    const must = missions.filter((m) => m.group === groupId).map((m) => m.word);
    for (const word of [...must]) { const pair = group.pairs?.[word]; if (pair && !must.includes(pair)) must.push(pair); }
    const rest = shuffle(group.pool.filter((id) => !must.includes(id)), rng);
    const chosen = shuffle([...must, ...rest].slice(0, group.slots.length), rng);
    chosen.forEach((word, i) => plates.push({ id: `${groupId}-${i}`, kind: 'plate', group: groupId, style: group.style, word, text: wordOf(word).ko, q: group.slots[i], floor: group.floors?.[i] ?? null }));
  }
  for (const f of place.fixed) plates.push({ id: f.id, kind: f.decor ? 'decor' : 'fixed', style: f.style, word: f.word || null, text: f.text, q: f.q, vertical: !!f.vertical });
  return plates;
}

/**
 * 판의 부탁 넷: 뜻 둘 · 소리 하나 · 낱말 하나(안내문을 켜면 뜻 하나가 안내문 부탁으로). 정답은 weak(Atlas가 약하다고 본 낱말) → 앨범에 있는 낱말 → 나머지 순으로 고른다.
 * 소리 부탁은 소리 파일이 있는 낱말만이다. 무리에 판이 셋 이상인 곳에서만 고른다(안내문 받침판은 둘이라 뜻 부탁 하나까지만 — 둘 가운데 고르는 것도 뜻을 읽어야 한다).
 */
export function pickMissions(place, { collected = [], weak = [], notices = false, rng = Math.random, count = MISSIONS_PER_ROUND, voice = true } = {}) {
  const rank = (ids) => { const r = shuffle(ids, rng); const score = (id) => (weak.includes(id) ? 0 : collected.includes(id) ? 1 : 2); return r.sort((a, b) => score(a) - score(b)); };
  const pools = { meaning: [], sound: [], word: [], notice: [] };
  for (const [groupId, group] of Object.entries(place.groups)) {
    if (group.noMission) continue;
    for (const id of group.pool) {
      const w = wordOf(id);
      if (group.notice) { if (w.ask) pools.notice.push({ kind: 'notice', group: groupId, word: id }); continue; }
      if (w.ask) pools.meaning.push({ kind: 'meaning', group: groupId, word: id });
      if (w.voice) pools.sound.push({ kind: 'sound', group: groupId, word: id });
    }
  }
  for (const t of place.things) pools.word.push({ kind: 'word', group: null, word: t.word, thing: t.id });
  const take = (pool, used) => { for (const id of rank(pool.map((m) => m.word))) { if (!used.has(id)) { used.add(id); return pool.find((m) => m.word === id); } } return null; };
  const used = new Set(), out = [];
  // 소리를 끈 사람에게는 소리 부탁 대신 뜻 부탁을 낸다.
  const plan = (notices && pools.notice.length ? ['notice', 'meaning', 'sound', 'word'] : ['meaning', 'meaning', 'sound', 'word']).map((kind) => (kind === 'sound' && !voice ? 'meaning' : kind));
  for (const kind of plan.slice(0, count)) { const m = take(pools[kind], used); if (m) out.push({ ...m, tries: 0, doneFirst: null }); }
  // 판에 담을 수 있는 수를 넘지 않게: 같은 무리의 정답이 판 수보다 많으면 뒤의 것을 다른 꼴로 바꾸지 않고 뺀다(4장 판이면 넘지 않는다).
  const perGroup = {};
  return shuffle(out, rng).filter((m) => { if (!m.group) return true; perGroup[m.group] = (perGroup[m.group] || 0) + 1; return perGroup[m.group] <= place.groups[m.group].slots.length; });
}

/** 찍은 것이 부탁의 정답인가. shot = { word, kind:'plate'|'thing'|'fixed' }. 글을 얹는 고정 판은 정답이 아니다. */
export function judgeShot(mission, shot) {
  if (!mission || !shot) return false;
  if (mission.kind === 'word') return shot.kind === 'thing' && shot.word === mission.word;
  return shot.kind === 'plate' && shot.word === mission.word;
}

/**
 * 다름이 이어질 때의 도움(막히지 않게, 설계 검토 6): 첫 다름 = 찍은 곳이 무엇인지만 짚는다, 둘째 = 정답 낱말을 한국어로 보여 준다,
 * 셋째부터 = 정답 판을 깜빡인다. 낱말이 보인 뒤의 맞힘은 글자 모양 맞추기라 Atlas에 「도움 받음」으로 남기고 이름을 붙이지 않는다.
 */
export const helpLevel = (tries) => (tries >= 3 ? 'plate' : tries === 2 ? 'word' : 'point');

const syllables = (text) => [...String(text).replace(/\s/g, '')].length;
/**
 * 인화 문제 셋: 오늘 찍은 낱말에서. 물건 사진 → 낱말 고르기, 판 → 뜻 고르기. 선택지는 같은 꼴에서 고르고 음절 수 차이 1 안(길이로 못 맞힌다).
 * 같은 꼴에서 모자라면 길이 조건만 풀어 채운다. 틀려도 넘어간다.
 */
export function makeRecall(place, shots, { rng = Math.random, count = RECALL_PER_ROUND, lang = 'en', album = null } = {}) {
  const seen = new Set(), pool = [];
  for (const s of shuffle(shots, rng)) { if (s.word && !seen.has(s.word)) { seen.add(s.word); pool.push(s); } }
  // 아직 이름 없는 사진을 먼저 묻는다 — 인화가 곧 이름 붙이기다.
  if (album) pool.sort((a, b) => (album.cards[a.word]?.named ? 1 : 0) - (album.cards[b.word]?.named ? 1 : 0));
  const things = place.things.map((t) => t.word);
  const plates = Object.values(place.groups).filter((g) => !g.notice).flatMap((g) => g.pool);
  const noticePool = Object.values(place.groups).filter((g) => g.notice).flatMap((g) => g.pool);
  return pool.slice(0, count).map((shot) => {
    const w = wordOf(shot.word);
    const mode = shot.kind === 'thing' ? 'word' : 'meaning';
    // 뜻 고르기의 보기는 같은 무리에서 고른다(문은 문끼리 · 안내문은 안내문끼리 — 꼴이 다르면 꼴만 보고 풀린다, 1차 검수 11-04).
    const own = Object.values(place.groups).find((g) => g.pool.includes(shot.word));
    // 메뉴판처럼 장소가 아닌 고정 판은 「…곳」 풀이들 사이에서 꼴로 풀리지 않게 물건 풀이와 섞는다(2중 검수 11-04).
    const fromThings = place.fixed.find((f) => f.word === shot.word)?.recallFrom === 'things';
    const source = mode === 'word' || fromThings ? things : own && own.pool.length >= 3 ? own.pool : w.band === 'notice' ? noticePool : plates;
    const label = (id) => (mode === 'word' ? wordOf(id).ko : (wordOf(id).mean[lang] ?? wordOf(id).mean.en));
    const others = shuffle(source.filter((id) => id !== shot.word), rng);
    // 길이로 못 맞히게: 낱말은 음절 차이 1 안, 뜻은 글 길이가 가까운 차례로(화면 언어 기준, 설계 검토 14).
    const gap = (id) => Math.abs(syllables(label(id)) - syllables(label(shot.word)));
    const close = others.filter((id) => mode === 'meaning' || gap(id) <= 1);
    const rest = others.filter((id) => !close.includes(id));
    if (mode === 'meaning') close.sort((a, b) => gap(a) - gap(b));
    const picks = [...close, ...rest].slice(0, 2);
    return { shot, mode, answer: shot.word, options: shuffle([shot.word, ...picks], rng) };
  });
}

export const emptyAlbum = () => ({ v: 1, cards: {}, stamps: {}, daily: {}, streak: 0, plays: 0, notices: false, placePlays: {}, best: {} });
export function normalizeAlbum(raw) {
  const base = emptyAlbum();
  if (!raw || raw.v !== 1 || typeof raw !== 'object') return base;
  const cards = {};
  for (const [id, c] of Object.entries(raw.cards || {})) if (WORDS[id] && c && typeof c === 'object') cards[id] = { place: String(c.place || ''), at: Number(c.at) || 0, named: !!c.named, kind: c.kind === 'thing' ? 'thing' : c.kind === 'fixed' ? 'fixed' : 'plate', q: Array.isArray(c.q) ? c.q : null, style: typeof c.style === 'string' ? c.style : null, vertical: !!c.vertical, scene: Array.isArray(c.scene) ? c.scene.filter((p) => Array.isArray(p?.q)) : [], ...(c.namedAt ? { namedAt: Number(c.namedAt) || 0 } : {}) };
  return { ...base, ...raw, cards, stamps: { ...(raw.stamps || {}) }, daily: { ...(raw.daily || {}) }, placePlays: { ...(raw.placePlays || {}) }, best: { ...(raw.best || {}) }, plays: Number(raw.plays) || 0, streak: Number(raw.streak) || 0, notices: !!raw.notices };
}
/** 사진 한 장을 앨범에 꽂는다(아직 이름 없음). 돌려주는 값: 처음 찍은 낱말인가. */
export function addCard(album, shot, placeId, at) {
  if (!shot.word) return false;
  const fresh = !album.cards[shot.word];
  if (fresh) album.cards[shot.word] = { place: placeId, at, named: false, kind: shot.kind, q: shot.q, style: shot.style || null, vertical: !!shot.vertical };
  return fresh;
}
/**
 * 사진 아래에 이름을 쓴다 — 한 번에 맞힌 부탁 또는 인화 정답에서만(설계 검토 1: 벌 없이 Koe를 막는 자리).
 * 앨범의 「모은 낱말」 · 장소 도장은 이름 붙은 카드만 센다. 돌려주는 값: 이번에 이름이 새로 붙었는가.
 */
export function nameCard(album, word, at) {
  const card = album.cards[word];
  if (!card || card.named) return false;
  card.named = true; card.namedAt = at;
  return true;
}
/** 장소 완성도. 안내문은 켰을 때만 분모에 든다. 이름 붙은 낱말을 다 모으면 도장. shot = 찍기만 한 것까지. */
export function placeProgress(album, place) {
  const all = placeWords(place, { notices: album.notices });
  const shot = all.filter((id) => album.cards[id]), got = shot.filter((id) => album.cards[id].named);
  return { got: got.length, shot: shot.length, total: all.length, done: all.length > 0 && got.length === all.length };
}
/** 판 끝 기록. 보이지 않는 시계로 잰 부탁 시간과 한 번에 찾은 수(Shashingo 「기록 깨기」). 시간으로 막지 않는다 — 앨범 뒷면 「내 기록」에만 쓴다. */
export function recordRound(album, placeId, { ms, first, of }) {
  album.plays += 1; album.placePlays[placeId] = (album.placePlays[placeId] || 0) + 1;
  const best = album.best[placeId] || null;
  const newBest = !best || ms < best.ms;
  album.best[placeId] = { ms: newBest ? ms : best.ms, first: Math.max(first, best?.first || 0), of };
  return { newBest, previous: best };
}
/** 오늘의 찾기를 해냈다. 돌려주는 값: 이어 한 날 수(끊겨도 잃는 것은 없다 — 다시 하나부터). */
export function finishDaily(album, at) {
  const day = dayKey(at);
  if (album.daily[day]) return album.streak;
  const yesterday = dayKey(at - 86400000);
  album.streak = album.daily[yesterday] ? (album.streak || 0) + 1 : 1;
  album.daily[day] = 1;
  return album.streak;
}
/** 한국 날짜(YYYY-MM-DD). */
export const dayKey = (at) => new Date(at + 9 * 3600000).toISOString().slice(0, 10);
/** 오늘의 찾기: 날짜로 고른 뜻 부탁 하나(열린 장소 가운데). 같은 날은 늘 같다. */
export function dailyMission(places, at) {
  const day = dayKey(at), rng = makeRng(day.split('-').reduce((n, v) => n * 31 + Number(v), 7));
  const place = places[Math.floor(rng() * places.length)];
  const pool = Object.entries(place.groups).filter(([, g]) => !g.notice && !g.noMission).flatMap(([gid, g]) => g.pool.filter((id) => wordOf(id).ask).map((word) => ({ kind: 'meaning', group: gid, word })));
  return { day, place: place.id, ...pool[Math.floor(rng() * pool.length)] };
}
