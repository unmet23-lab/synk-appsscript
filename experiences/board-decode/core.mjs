// 게시판 해독 — 판 규칙(화면과 나눔, 설계 3 · 4 · 5절). DOM을 만지지 않는다.
// 틀려도 판은 끝까지 간다: 틀림은 장면을 돌려주고 같은 칸에 머문다. 시간 제한 · 점수는 없다.
// 수첩 · 앨범은 게임 저장소에만 둔다. Trail에 ko2 사건을 남기지 않는다(설계 6절, 결정 10-22).
import { ROUNDS, WORDS } from './content.mjs';

export const STORE_KEY = 'synk.board-decode.v1';
export const ROUND_IDS = Object.freeze(ROUNDS.map((r) => r.id));
export const roundOf = (id) => ROUNDS.find((r) => r.id === id) || ROUNDS[0];

export function makeRng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function shuffle(list, rng = Math.random) { const a = [...list]; for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** 이 판의 낱말 조합 전부. 예: [{f1:'제외',f2:'보관'}, …] */
export function combosOf(round) {
  const keys = Object.keys(round.forks);
  return keys.reduce((acc, k) => acc.flatMap((c) => round.forks[k].map((w) => ({ ...c, [k]: w }))), [{}]);
}
const comboKey = (fork) => Object.values(fork).join('+');

/** 다음 조합: 안 푼 갈림 말이 든 조합 먼저, 그다음 앞에서 틀린 말이 든 조합, 그다음 덜 한 조합. */
export function chooseCombo(round, save, rng = Math.random) {
  const seen = save.combos?.[round.id] || {};
  // 수첩에는 정정 쪽지 낱말까지 들어가 갈림 양쪽이 한 판에 다 찬다. 「안 푼 말」은 수첩이 아니라 이 판에서 실제로 갈림으로 풀어 본 조합으로 잰다.
  const played = new Set(Object.keys(seen).flatMap((k) => k.split('+')));
  const weight = (c) => {
    const words = Object.values(c);
    const fresh = words.filter((w) => !played.has(w)).length;
    const missed = words.filter((w) => save.missed?.[w]).length;
    return fresh * 100 + missed * 10 - (seen[comboKey(c)] || 0);
  };
  const scored = combosOf(round).map((c) => ({ c, s: weight(c), r: rng() })).sort((a, b) => b.s - a.s || a.r - b.r);
  return scored[0].c;
}

export const resolve = (fork, k) => fork[k] || k;
export const slotAnswer = (slot, fork) => fork[slot.fork];
export const isRight = (slot, fork, opt) => opt.ok === slotAnswer(slot, fork);
export const slotWords = (slot, fork) => slot.keys.map((k) => resolve(fork, k));
export const sayOf = (slot, fork) => (typeof slot.say === 'string' ? slot.say : slot.say[fork[slot.say.by]]);
export const patchOf = (round, fork) => round.patches[fork[round.slots.at(-1).fork]];

/** 빈 저장. 수첩 words = 낱말 → {round}, album = 본 장면 제목 → {pic}, last = 판마다 마지막 결과(다음 판 첫 줄을 고른다). */
export function emptySave() { return { v: 1, words: {}, missed: {}, album: {}, combos: {}, last: {}, done: {} }; }
export function normalizeSave(raw) {
  const base = emptySave();
  if (!raw || typeof raw !== 'object') return base;
  for (const k of Object.keys(base)) if (k !== 'v' && raw[k] && typeof raw[k] === 'object' && !Array.isArray(raw[k])) base[k] = raw[k];
  base.words = Object.fromEntries(Object.entries(base.words).filter(([w]) => WORDS[w]));
  base.missed = Object.fromEntries(Object.entries(base.missed).filter(([w]) => WORDS[w]));
  return base;
}

/** 다음 판: 안 끝낸 첫 판, 다 끝냈으면 앞 차례 다음 판. */
export function nextRoundId(save, afterId = null) {
  const open = ROUND_IDS.find((id) => !save.done?.[id]);
  if (open) return open;
  const i = ROUND_IDS.indexOf(afterId);
  return ROUND_IDS[(i + 1) % ROUND_IDS.length];
}

/** 첫 메시지: 앞 판 결과를 잇는다(이야기 줄기). 앞 판을 안 했으면 처음 만나는 말. */
export function openLine(round, save) {
  const i = ROUND_IDS.indexOf(round.id);
  const prev = i > 0 ? save.last?.[ROUND_IDS[i - 1]] : null;
  return (prev && round.open[prev]) || round.open.first;
}

/** 판 시작. rng는 보기 순서 · 조합 고르기에 쓴다. */
export function startRound(id, save, { rng = Math.random, fork = null } = {}) {
  const round = roundOf(id);
  const chosen = fork || chooseCombo(round, save, rng);
  const patch = patchOf(round, chosen);
  return {
    roundId: round.id, fork: chosen, patch, phase: 'ask', slot: 0, patched: false,
    order: round.slots.map((s) => shuffle(s.opts, rng)), patchOrder: shuffle(patch.opts, rng),
    got: [], firstTry: {}, misses: {}, memo: {}, helped: {}, scene: null, open: openLine(round, save),
  };
}

/** 지금 묻는 칸. */
export function currentAsk(state) {
  const round = roundOf(state.roundId);
  if (state.phase === 'patch') return { say: state.patch.say, opts: state.patchOrder, focus: round.slots.at(-1).focus };
  if (state.phase !== 'ask') return null;
  const s = round.slots[state.slot];
  return { say: sayOf(s, state.fork), opts: state.order[state.slot], focus: s.focus };
}

/** 답장 하나. 돌려주는 값: {right, scene?, finished?, patchedNow?} — state를 고친다. 틀려도 같은 칸에 머문다. */
export function answer(state, opt) {
  const round = roundOf(state.roundId);
  if (state.phase === 'patch') {
    const key = `patch`;
    const right = opt.ok === true;
    if (!(key in state.firstTry)) state.firstTry[key] = right;
    if (!right) { state.misses[state.patch.key] = true; state.scene = opt; return { right: false, scene: opt }; }
    if (!state.got.includes(state.patch.key)) state.got.push(state.patch.key);
    state.after = state.patch.after_say; state.sent = opt.t; state.phase = 'end';
    return { right: true, finished: true, words: [state.patch.key] };
  }
  const slot = round.slots[state.slot];
  const right = isRight(slot, state.fork, opt);
  const words = slotWords(slot, state.fork);
  if (!(state.slot in state.firstTry)) state.firstTry[state.slot] = right;
  if (!right) { for (const w of words) state.misses[w] = true; state.scene = opt; return { right: false, scene: opt }; }
  for (const w of words) if (!state.got.includes(w)) state.got.push(w);
  const after = slot.after; state.after = typeof after === 'string' ? after : after[state.fork[slot.fork]]; state.sent = opt.t;
  state.slot += 1;
  if (state.slot >= round.slots.length) { state.phase = 'waiting-patch'; return { right: true, patchNext: true, words }; }
  return { right: true, words };
}
export function applyPatch(state) { state.phase = 'patch'; state.patched = true; state.after = null; state.sent = null; }
export function closeScene(state) { state.scene = null; }

/** 연필 메모: 고른 뜻은 맞든 틀리든 그대로 남고, 그 말을 푼 순간 맞는 뜻으로 고쳐 적힌다(벌 없음). */
export function setMemo(state, word, meaning) { state.memo[word] = meaning; }
export const memoShown = (state, word) => (state.got.includes(word) ? (state.memo[word] ? WORDS[word].easy : null) : state.memo[word] || null);
export function memoChoices(word, rng = Math.random) { const w = WORDS[word]; return shuffle([w.easy, w.decoy || WORDS[w.twin].easy], rng); }

/** 판 끝: 저장에 넣는다. 앨범은 여기서 더하지 않는다 — 맞힌 뒤 「다르게 답했다면?」에서 본 것만 찬다. */
export function finishRound(state, save) {
  const round = roundOf(state.roundId);
  for (const w of state.got) save.words[w] = { round: round.id };
  for (const w of Object.keys(state.misses)) save.missed[w] = (save.missed[w] || 0) + 1;
  for (const w of state.got) if (!state.misses[w]) delete save.missed[w];
  save.combos[round.id] ||= {};
  const k = comboKey(state.fork); save.combos[round.id][k] = (save.combos[round.id][k] || 0) + 1;
  save.done[round.id] = (save.done[round.id] || 0) + 1;
  save.last[round.id] = round.outcome(state.fork);
  return save;
}

/** 이 판에서 볼 수 있는 「다르게 답했다면?」 장면(같은 제목은 한 번). */
export function otherScenes(state) {
  const round = roundOf(state.roundId);
  const all = [...round.slots.flatMap((s, i) => s.opts.filter((o) => !isRight(round.slots[i], state.fork, o))), ...state.patch.opts.filter((o) => !o.ok)];
  return all.filter((o, i, a) => a.findIndex((x) => x.title === o.title) === i);
}
/** 끝 화면 장면 칸: 그 칸을 맞혔으니 엿본다. 일부러 틀려도 이 함수를 지나지 않으면 앨범에 안 찬다. */
export function peekScene(save, opt) { save.album[opt.title] = { pic: opt.pic, line: opt.line }; return save; }
export function albumTotal() {
  const titles = new Set();
  for (const r of ROUNDS) { for (const s of r.slots) for (const o of s.opts) titles.add(o.title); for (const p of Object.values(r.patches)) for (const o of p.opts) if (o.title) titles.add(o.title); }
  return titles.size;
}

/** 공지 글: [[낱말]] 표시는 그대로 두고 갈림 자리를 낱말로 채운 판. */
export function noticeLines(round, fork, notice) {
  return notice.lines.map((l) => (l && l.key ? { text: round.variants[fork[l.key]], key: l.key } : l));
}
/** 공지의 밑줄 말 전부(정정 전). */
export function underlinedWords(round, fork) {
  const words = new Set();
  for (const n of round.notices) for (const l of noticeLines(round, fork, n)) { const t = typeof l === 'string' ? l : l.text || l.big || ''; for (const m of t.matchAll(/\[\[([^\]]+)\]\]/g)) words.add(m[1]); }
  return [...words];
}
