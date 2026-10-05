// 한글 단계의 판단(설계 §5·§7·§8). 화면·소리·저장은 모른다 — 진도(progress)를 받아 새 진도를 돌려준다.
// 문항은 결정적 시드로 만든다: 같은 사람·같은 날·같은 회차 = 같은 문항.
// 점수·등수·연속 기록·목숨·시간 제한은 없다. 틀리면 그 글자가 더 일찍 돌아올 뿐이다.

export const CORE_VER = 'hangul-core-2';
export const STATES = Object.freeze(['unmet', 'met', 'learning', 'mastered']);
// 설계값(시험장과 첫 학생으로 고친다).
export const SETTINGS = Object.freeze({
  amounts: [5, 10, 15], amount: 10,
  firstNew: 3,          // 기록이 없는 첫 회차에 만나는 새 글자(같은 꼴만 이어지지 않게 셋)
  window: 20,           // 「최근 스무 문항」
  smooth: 0.8, struggle: 0.6, great: 0.95,
  masteryStreak: 3, masterySessions: 2, // 「서로 다른 두 회차에 걸쳐 도움 없이 이어서 세 번」
  extraPerDay: 2,       // 「더 하기」는 하루 두 번까지
  maxRun: 3,            // 같은 꼴은 세 번 넘게 이어지지 않는다
  gradRatio: 0.9,       // 졸업: 최근 스무 문항의 혼자 맞힌 비율
  gradWords: 5,         // 졸업: 낱말 문항을 이어서 다섯 번 읽어 냄
  warmup: 5,            // 졸업 뒤 몸풀기 문항 수
});
const DAY = 86400000;
const STEPS = [0, 1, 2, 4, 8, 16]; // 다음 복습까지의 날(마지막 칸이 가장 길다)
// pair: 헷갈리는 짝 둘 중 들린 쪽 고르기. teach: 몽글이 잘못 쓴 글자를 바로잡아 주기(복습의 다른 모양).
const TYPES = Object.freeze(['listen_pick', 'see_pick', 'build', 'match', 'pair', 'teach']);
const LISTENING = new Set(['listen_pick', 'pair', 'teach']);
// 시범은 꼴마다 처음 한 번. 받침이 든 음절 만들기는 조각 줄이 하나 더 있어 따로 한 번 보인다.
const DEMOS = Object.freeze([...TYPES, 'build_final']);
const rank = state => STATES.indexOf(state);

// ── 시드 ──
export function seedOf(text) { let h = 0x811c9dc5; for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (list, rand) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (list, rand) => list[Math.floor(rand() * list.length)];
export const localDay = iso => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ── 진도 ──
export function emptyProgress() {
  return { v: 1, core: CORE_VER, letters: {}, pairs: {}, recent: [], sessions: [], difficulty: 1, trend: 0, amount: SETTINGS.amount, skipped: false, demoSeen: [],
    wordStreak: 0, graduated: null };
}
export function readProgress(value) {
  const p = value && typeof value === 'object' && value.v === 1 ? value : null;
  if (!p) return emptyProgress();
  const base = emptyProgress();
  return { ...base, ...p, letters: { ...(p.letters || {}) }, pairs: { ...(p.pairs || {}) }, recent: Array.isArray(p.recent) ? p.recent.slice(-SETTINGS.window) : [],
    sessions: Array.isArray(p.sessions) ? p.sessions.slice(-60) : [], difficulty: [1, 2, 3].includes(p.difficulty) ? p.difficulty : 1,
    amount: SETTINGS.amounts.includes(p.amount) ? p.amount : SETTINGS.amount, demoSeen: Array.isArray(p.demoSeen) ? p.demoSeen.filter(t => DEMOS.includes(t)) : [],
    wordStreak: Number.isInteger(p.wordStreak) && p.wordStreak > 0 ? p.wordStreak : 0, graduated: p.graduated && typeof p.graduated === 'object' ? p.graduated : null };
}
const blank = () => ({ state: 'unmet', best: 'unmet', streak: 0, streakSessions: [], step: 0, due: null, lapses: 0, seen: 0, correct: 0, lastAt: null, metAt: null });
export const letterOf = (progress, id) => ({ ...blank(), ...(progress.letters[id] || {}) });
const raise = (best, state) => (rank(state) > rank(best) ? state : best);

export function meet(progress, ids, at) {
  const next = readProgress(progress);
  for (const id of ids) {
    const l = letterOf(next, id);
    if (l.state === 'unmet') { l.state = 'met'; l.metAt = at; l.due = at; }
    l.best = raise(l.best, l.state);
    next.letters[id] = l;
  }
  return next;
}

/**
 * 응답 하나를 진도에 반영한다. focus는 그 문항이 가르는 글자들, confused는 고른 답이 가리킨 다른 글자.
 * perLetter가 있으면 글자마다 맞음을 따로 본다(음절 만들기에서 자음만 맞힌 경우). 「최근 스무 문항」에는 문항 하나로 한 번 센다.
 * 도움(손 내밀기)을 받은 정답은 「혼자 맞힘」이 아니라 이어서 센 횟수를 새로 시작한다.
 * 다시 듣고 맞힌 것은 맞힘으로 세되 복습 간격을 늘리지 않는다(설계 §5 「어렵게 맞힘」).
 * word는 낱말 문항: 이어서 혼자 읽어 낸 낱말 수(졸업 조건)를 센다.
 */
export function answer(progress, { focus = [], confused = [], correct, perLetter = null, assisted = false, replays = 0, at, sessionId, counts = true, word = false }) {
  const next = readProgress(progress);
  const now = Date.parse(at);
  if (counts) next.recent = [...next.recent, { ok: !!correct && !assisted }].slice(-SETTINGS.window);
  if (counts && word) next.wordStreak = correct && !assisted ? next.wordStreak + 1 : 0;
  for (const id of focus) {
    const l = letterOf(next, id);
    const ok = perLetter && Object.hasOwn(perLetter, id) ? !!perLetter[id] : !!correct;
    if (l.state === 'unmet') { l.state = 'met'; l.metAt = at; }
    l.seen += 1; l.lastAt = at;
    if (ok && !assisted) {
      l.correct += 1;
      l.streak += 1;
      if (!l.streakSessions.includes(sessionId)) l.streakSessions = [...l.streakSessions, sessionId].slice(-SETTINGS.masteryStreak);
      if (!replays) l.step = Math.min(l.step + 1, STEPS.length - 1); else l.step = Math.max(l.step, 1);
      if (l.state === 'met') l.state = 'learning';
      if (l.streak >= SETTINGS.masteryStreak && l.streakSessions.length >= SETTINGS.masterySessions) l.state = 'mastered';
    } else if (ok && assisted) {
      l.correct += 1; l.streak = 0; l.streakSessions = []; l.step = Math.max(0, l.step - 1);
      if (l.state === 'met') l.state = 'learning';
    } else {
      l.lapses += 1; l.streak = 0; l.streakSessions = []; l.step = 0;
      if (l.state === 'mastered' || l.state === 'met') l.state = 'learning';
    }
    // 간격 0은 「이번 회차 안에서 한 번 더, 그리고 내일」이다: 오늘 안에 다시 내도록 지금으로 둔다.
    l.due = new Date(now + STEPS[l.step] * DAY).toISOString();
    l.best = raise(l.best, l.state);
    next.letters[id] = l;
  }
  // confused: [가르려던 글자, 대신 고른 글자] 쌍들. 헷갈린 짝으로 남아 다음 회차의 이유 한 줄과 복습이 된다.
  for (const [id, other] of confused) {
    if (!id || !other || other === id) continue;
    const k = [id, other].sort().join('|');
    const pair = next.pairs[k] || { wrong: 0, lastAt: null };
    next.pairs[k] = { wrong: pair.wrong + 1, lastAt: at };
  }
  return next;
}

// ── 오늘의 묶음(Core의 일: 설계 §7 표) ──
const independentRatio = progress => (progress.recent.length ? progress.recent.filter(r => r.ok).length / progress.recent.length : null);
export function newCount(progress, overdue) {
  const ratio = independentRatio(progress);
  if (ratio == null) return SETTINGS.firstNew;
  if (ratio < SETTINGS.struggle) return 0;
  if (ratio >= SETTINGS.great && overdue <= 2) return 3;
  if (ratio >= SETTINGS.smooth && overdue <= 5) return 2;
  return 1;
}
// 단원은 선행이다: 앞 단원의 글자를 다 만난 뒤에 다음 단원의 새 글자가 나온다.
export function nextLetters(progress, pack, count) {
  const out = [];
  for (const unit of pack.units) {
    const unmet = unit.letters.filter(id => letterOf(progress, id).state === 'unmet');
    out.push(...unmet.slice(0, count - out.length));
    if (out.length >= count || unmet.length) break;
  }
  return out;
}
// 한글 길의 「지금」: 아직 다 익히지 않은 첫 단원. 길은 닿은 곳을 보이므로 한 번 익힌 글자를 다시 틀려도 뒤로 가지 않는다.
export function unitNow(progress, pack) {
  return pack.units.find(u => u.letters.some(id => letterOf(progress, id).best !== 'mastered')) || null;
}
const metIds = (progress, pack) => pack.letters.filter(l => letterOf(progress, l.id).state !== 'unmet').map(l => l.id);
// 졸업 조건의 글자: core:false인 단원(U8 된소리·U9 겹모음)은 졸업 앞뒤로 이어서 만나고 졸업 조건에 들지 않는다(설계 §8 「U7까지의 핵심 마디」).
const coreIds = pack => pack.units.filter(u => u.core !== false).flatMap(u => u.letters);
// 헷갈린 짝: 최근 두 주 안에 틀렸고, 그 뒤로 두 글자 모두 아직 이어서 두 번 혼자 맞히지 못한 짝.
function weakPairs(progress, now) {
  const settled = id => { const l = letterOf(progress, id); return l.streak >= 2; };
  return Object.entries(progress.pairs)
    .filter(([k, p]) => p.wrong > 0 && now - Date.parse(p.lastAt) <= 14 * DAY && !k.split('|').every(settled))
    .sort((a, b) => Date.parse(b[1].lastAt) - Date.parse(a[1].lastAt) || b[1].wrong - a[1].wrong)
    .map(([k, p]) => Object.assign(k.split('|'), { lastAt: p.lastAt }));
}
// ㄱ·ㄷ·ㅂ 같은 받침(U7)은 터지지 않는 소리라 귀로 가르기 어렵다 — 1단에서는 소리로 묻지 않고 보고 고르기로 낸다(설계 §3).
const hardByEar = (pack, id) => pack.byId.get(id)?.unit === 'U7';

/**
 * 졸업(설계 §8): 이 판의 핵심 글자(U1~U7 — 된소리·겹모음은 빼고)를 다 만났고, 최근 스무 문항의 혼자 맞힌 비율이 90% 이상이며,
 * 낱말 문항을 이어서 다섯 번 읽어 냈을 때. 졸업은 「읽기 시작할 수 있다」이지 「다 안다」가 아니다.
 */
export function graduationReady(progress, pack) {
  const p = readProgress(progress);
  if (p.graduated) return false;
  const ratio = independentRatio(p);
  return coreIds(pack).every(id => letterOf(p, id).state !== 'unmet') && p.recent.length >= SETTINGS.window && ratio >= SETTINGS.gradRatio && p.wordStreak >= SETTINGS.gradWords;
}
export function graduate(progress, at) { return { ...readProgress(progress), graduated: { at, day: localDay(at) } }; }

/** 회차를 짠다. 돌려주는 것: 이유 한 줄, 새 글자, 단계(step) 목록. step은 {kind:'meet'} 또는 {kind:'item'}. */
export function planSession(progress, pack, { now, scope = 'device', sessionNo = 0 }) {
  const p = readProgress(progress);
  const t = Date.parse(now), day = localDay(now);
  const rand = rng(seedOf(`${scope}|${day}|${sessionNo}`));
  const met = metIds(p, pack);
  const due = met.filter(id => { const d = letterOf(p, id).due; return d && Date.parse(d) <= t; })
    .sort((a, b) => Date.parse(letterOf(p, a).due) - Date.parse(letterOf(p, b).due));
  const weak = weakPairs(p, t).flat().filter(id => met.includes(id));
  // 졸업 뒤에는 헷갈리기 쉬운 글자의 짧은 몸풀기다(설계 §8).
  const amount = p.graduated ? Math.min(p.amount, SETTINGS.warmup) : p.amount;
  let fresh = nextLetters(p, pack, Math.min(newCount(p, due.length), Math.floor(amount / 2)));
  if (!met.length && fresh.length < 2) fresh = nextLetters(p, pack, 2); // 처음 회차는 두 글자 이상이어야 문항이 선다
  const allCoreMet = coreIds(pack).every(id => met.includes(id) || fresh.includes(id));
  const reviewFirst = [...new Set([...weak, ...due])];
  const steps = [];
  const known = new Set(met);
  const ctx = { pack, progress: p, rand, difficulty: p.difficulty, weak: weakPairs(p, t), fresh: new Set(fresh) };
  const items = [];
  const add = item => { if (item) items.push(item); };
  // 1. 복습 몇 문항(밀린 것·헷갈린 짝부터). 새 글자가 있으면 짧게. 복습의 한 문항은 몽글에게 가르쳐 주기일 수 있다.
  const reviewSlots = Math.max(0, Math.min(reviewFirst.length, fresh.length ? Math.min(3, amount - fresh.length * 2) : amount));
  // 첫 복습이 헷갈린 짝의 글자면 짝 고르기로, 복습 가운데 하나는 몽글에게 가르쳐 주기로 낸다(설계 §6 「복습 몇 문항(그중 하나는 가르쳐 주기)」).
  // 고른 꼴로 그 글자를 물을 수 없으면(받침 하나뿐인데 음절 만들기 등) 다른 꼴로 바꿔 복습 자리를 잃지 않는다.
  const teachAt = reviewSlots >= 2 ? 1 : 0;
  for (const [n, id] of reviewFirst.slice(0, reviewSlots).entries()) {
    const tried = new Set(n < teachAt ? ['teach'] : []); // 가르쳐 주기 자리 앞에서는 아껴 둔다(회차에 한 번)
    const taught = items.some(i => i.type === 'teach');
    const prefer = n === 0 && weak.includes(id) ? 'pair' : n === teachAt && known.size >= 6 && !taught ? 'teach' : null;
    let item = null;
    if (prefer) { tried.add(prefer); item = makeItem(prefer, id, known, ctx); }
    while (!item && tried.size < TYPES.length) {
      const type = pickType(items, ctx, known, { review: true, exclude: tried });
      if (tried.has(type)) break;
      tried.add(type);
      item = makeItem(type, id, known, ctx);
    }
    add(item);
  }
  steps.push(...items.map(item => ({ kind: 'item', item })));
  // 2. 새 글자: 만나기 카드 → 바로 확인 두 문항(듣고 고르기 · 보고 고르기). 비교할 글자가 아직 없으면 다음 카드 뒤로 미룬다.
  let pending = [];
  for (const id of fresh) {
    steps.push({ kind: 'meet', letter: id });
    known.add(id); pending.push(id);
    const still = [];
    for (const target of pending) {
      let made = 0;
      for (const type of hardByEar(pack, target) ? ['see_pick'] : ['listen_pick', 'see_pick']) {
        const item = makeItem(type, target, known, { ...ctx, difficulty: 1, check: true });
        if (item) { items.push(item); steps.push({ kind: 'item', item }); made += 1; }
      }
      if (!made) still.push(target);
    }
    pending = still;
  }
  // 3. 섞어 연습: 오늘의 글자 → 밀린 것 → 나머지 아는 글자. 2단부터 읽을 수 있는 낱말이 섞인다(핵심 글자를 다 만나면 졸업 준비로 더 자주).
  const pool = [...new Set([...fresh, ...reviewFirst, ...shuffle([...known], rand)])].filter(id => known.has(id));
  // 낱말 문항은 꼴 고르기와 따로 자리를 정한다(듣고 고르기·보고 고르기 모양) — 그래야 새 글자 확인 문항이 많은 날에도 낱말이 섞인다.
  const wordLimit = allCoreMet ? 4 : 2, wordChance = allCoreMet ? 0.5 : 0.3;
  let guard = 0;
  while (items.length < amount && pool.length && guard < amount * 6) {
    guard += 1;
    const id = pool[(items.length + guard) % pool.length];
    const wordy = (ctx.difficulty >= 2 || allCoreMet) && items.filter(i => i.word).length < wordLimit && rand() < wordChance;
    const item = (wordy && makeWordItem(pickType(items, ctx, known, { only: ['listen_pick', 'see_pick'] }), known, ctx)) || makeItem(pickType(items, ctx, known), id, known, ctx);
    if (item) { items.push(item); steps.push({ kind: 'item', item }); }
  }
  numberItems(steps, `${scope}|${day}|${sessionNo}`);
  return { day, sessionNo, fresh, reviews: reviewFirst.slice(0, reviewSlots), difficulty: p.difficulty, steps, warmup: !!p.graduated,
    reason: reasonLine({ p, pack, fresh, weak: weakPairs(p, t).filter(([a, b]) => met.includes(a) && met.includes(b))[0] || null, due, now: t }) };
}
/** 틀린 글자를 회차 안에서 한 번 더 낸다(설계 §5 「그 마디는 회차 안에서 한 번 더」). 막 틀린 꼴과 다른 꼴, 한 단계 쉽게. */
export function retryItem(progress, pack, letterId, { now, scope = 'device', sessionNo = 0, n = 0, avoid = null }) {
  const p = readProgress(progress);
  const known = new Set(metIds(p, pack)); known.add(letterId);
  const rand = rng(seedOf(`${scope}|${localDay(now)}|${sessionNo}|again|${letterId}|${n}`));
  const ctx = { pack, progress: p, rand, difficulty: Math.max(1, p.difficulty - 1), weak: [] };
  const order = ['listen_pick', 'see_pick'].sort((a, b) => (a === avoid) - (b === avoid));
  for (const type of order) {
    const item = makeItem(type, letterId, known, ctx);
    if (item) return { ...item, again: true, id: `hg-${seedOf(`${scope}|${localDay(now)}|${sessionNo}`).toString(36)}-r${n}` };
  }
  return null;
}
function numberItems(steps, key) {
  let n = 0;
  for (const step of steps) if (step.kind === 'item') { n += 1; step.item.n = n; step.item.id = `hg-${seedOf(key).toString(36)}-${n}`; }
}

// 꼴 고르기: 쓸 수 있는 꼴 가운데 바로 앞과 다른 꼴, 그중 적게 나온 꼴부터. 같은 꼴은 세 번 넘게 이어지지 않는다.
// 짝 맞추기는 한 판에 서너 글자를 한꺼번에 다루니 회차에 두 번까지, 음절 만들기는 세 번까지, 짝 문항은 두 번, 가르쳐 주기는 복습에서 한 번.
const LIMIT = { match: 2, build: 3, pair: 2, teach: 1 };
// 짝 고르기의 짝: 소리로 가를 수 있는 헷갈리는 짝. 오늘 처음 만난 글자는 짝 고르기에 쓰지 않는다(먼저 하루 익히고).
function earPartner(pack, id, known, skip = null) { return [...known].find(other => other !== id && !skip?.has(other) && pack.related(id, other)?.sound && pack.related(id, other)?.byEar); }
function pickType(items, ctx, known, { review = false, exclude = null, only = null } = {}) {
  const role = r => [...known].filter(id => ctx.pack.byId.get(id).role === r);
  const consonants = role('consonant').filter(id => id !== 'c-ng'), vowels = role('vowel');
  const counts = Object.fromEntries(TYPES.map(t => [t, items.filter(i => i.type === t).length]));
  const usable = TYPES.filter(type => type !== 'build' || (consonants.length >= 1 && vowels.length >= 2))
    .filter(type => type !== 'match' || known.size >= 3)
    .filter(type => type !== 'pair' || [...known].some(id => !ctx.fresh?.has(id) && earPartner(ctx.pack, id, known, ctx.fresh)))
    .filter(type => type !== 'teach' || (review && known.size >= 6))
    .filter(type => !(type in LIMIT) || counts[type] < LIMIT[type])
    .filter(type => !exclude?.has(type))
    .filter(type => !only || only.includes(type));
  const run = items.slice(-SETTINGS.maxRun);
  const blocked = run.length === SETTINGS.maxRun && run.every(i => i.type === run[0].type) ? run[0].type : null;
  const last = items.at(-1)?.type;
  let choices = usable.filter(t => t !== blocked);
  if (choices.some(t => t !== last)) choices = choices.filter(t => t !== last);
  if (!choices.length) choices = ['listen_pick', 'see_pick'].filter(t => t !== blocked);
  const least = Math.min(...choices.map(t => counts[t]));
  return pick(choices.filter(t => counts[t] === least), ctx.rand);
}

// ── 문항 만들기 ──
const optionCount = difficulty => difficulty + 1; // 1단 둘 · 2단 셋 · 3단 넷
// 보기로 쓸 글자 고르기: 1단은 먼 글자, 2단은 닮은 글자 하나, 3단은 헷갈리는 짝 하나. 소리로 묻는 문항에서는 by_ear:false 짝을 빼고, 같은 소리도 뺀다.
function distractors(target, candidates, ctx, count, { byEar }) {
  const rel = id => ctx.pack.related(target, id);
  const allowed = candidates.filter(id => id !== target && (!byEar || rel(id)?.byEar !== false));
  const near = allowed.filter(id => rel(id));
  const sound = allowed.filter(id => rel(id)?.sound && rel(id)?.byEar);
  const far = allowed.filter(id => !rel(id));
  const chosen = [];
  const take = list => { for (const id of shuffle(list, ctx.rand)) { if (chosen.length >= count) break; if (!chosen.includes(id)) { chosen.push(id); break; } } };
  if (ctx.difficulty >= 3) take(sound.length ? sound : near);
  if (ctx.difficulty >= 2) take(near);
  for (const id of shuffle(ctx.difficulty === 1 ? far : allowed, ctx.rand)) { if (chosen.length >= count) break; if (!chosen.includes(id)) chosen.push(id); }
  for (const id of shuffle(allowed, ctx.rand)) { if (chosen.length >= count) break; if (!chosen.includes(id)) chosen.push(id); }
  return chosen;
}
const skillOf = type => (type === 'see_pick' ? 'ko.hangul.read' : 'ko.hangul.sound');
const dedupeBySound = (pack, options) => options.filter((o, i, all) => all.findIndex(x => pack.sameSound(x.text, o.text)) === i);

function makeItem(type, targetId, known, ctx) {
  const { pack } = ctx;
  const target = pack.byId.get(targetId);
  if (!target) return null;
  const knownList = [...known];
  // 받침 ㄱ·ㄷ·ㅂ·ㅅ·ㅈ은 1단에서 소리로 묻지 않는다.
  if (LISTENING.has(type) && hardByEar(pack, targetId) && ctx.difficulty < 2) type = 'see_pick';
  if (type === 'match') return makeMatch(targetId, knownList, ctx);
  if (type === 'build') return makeBuild(targetId, knownList, ctx);
  if (type === 'pair') return makePair(targetId, knownList, ctx);
  if (target.role === 'final') return makeFinalItem(type, targetId, knownList, ctx);
  // 듣고 고르기·보고 고르기·가르쳐 주기: 같은 자리(모음이면 모음, 자음이면 자음)만 바꾼 음절을 보기로 낸다.
  if (targetId === 'c-ng') return withTeach(type, makeSilentItem(type, knownList, ctx), ctx);
  const frame = frameFor(target, knownList, ctx);
  // 자음을 받친 틀(과·귀)이면 ㅇ하고만 쓰는 모음(ㅒ·ㅖ·ㅢ)은 보기에서 뺀다.
  const sameRole = knownList.filter(id => pack.byId.get(id).role === target.role && id !== 'c-ng' && !(frame.c && pack.byId.get(id).alone));
  const others = distractors(targetId, sameRole, ctx, optionCount(ctx.difficulty) - 1, { byEar: true });
  const options = dedupeBySound(pack, [{ letter: targetId, text: frame(targetId) }, ...others.map(id => ({ letter: id, text: frame(id) }))]);
  if (options.length < 2) return null;
  return withTeach(type, { type, target: { letter: targetId, text: frame(targetId) }, options: shuffle(options, ctx.rand), focus: [targetId],
    difficulty: Math.min(ctx.difficulty, options.length - 1), skill: skillOf(type), check: !!ctx.check }, ctx);
}
// 몽글에게 가르쳐 주기(설계 §6의 5): 같은 듣고 고르기인데, 몽글이 보기 하나를 잘못 골라 들고 갸웃한다. 정오는 똑같이 센다.
function withTeach(type, item, ctx) {
  if (!item || type !== 'teach') return item;
  const wrong = item.options.filter(o => o.text !== item.target.text);
  return wrong.length ? { ...item, type: 'teach', wrong: pick(wrong, ctx.rand).text, skill: 'ko.hangul.sound' } : { ...item, type: 'listen_pick', skill: 'ko.hangul.sound' };
}
// 받침 문항: 정해진 틀(첫소리·모음)에 받침만 바꾼 음절을 보기로 낸다. 아는 받침이 하나뿐이거나 1단이면 「받침 없음」(안 / 아)도 보기로 쓴다
// — 먼저 받침이 들리는지를 가른다. 같은 소리로 나는 받침(ㄷ·ㅅ·ㅈ → [ㄷ])은 소리 문항에서 함께 내지 않는다.
function finalFrame(knownList, ctx) {
  const { pack } = ctx;
  const initials = pack.FINAL_FRAME.initials.filter(c => c === null || knownList.includes(c));
  const vowels = pack.FINAL_FRAME.vowels.filter(v => knownList.includes(v));
  const c = pick(initials, ctx.rand), v = vowels.length ? pick(vowels, ctx.rand) : 'v-a';
  return { c, v, text: f => pack.syllable(c, v, f) };
}
function makeFinalItem(type, targetId, knownList, ctx) {
  const { pack } = ctx;
  const finals = knownList.filter(id => pack.byId.get(id).role === 'final');
  const frame = finalFrame(knownList, ctx);
  // 보고 고르기도 보기가 소리라서 같은 소리 받침은 함께 내지 않는다.
  const others = distractors(targetId, finals, ctx, optionCount(ctx.difficulty) - 1, { byEar: true });
  let options = dedupeBySound(pack, [{ letter: targetId, text: frame.text(targetId) }, ...others.map(id => ({ letter: id, text: frame.text(id) }))]);
  if (options.length < optionCount(ctx.difficulty)) options = dedupeBySound(pack, [...options, { letter: null, text: frame.text(null), none: true }]);
  options = options.slice(0, optionCount(ctx.difficulty));
  if (options.length < 2) return null;
  return withTeach(type, { type, final: true, target: { letter: targetId, text: frame.text(targetId) }, options: shuffle(options, ctx.rand), focus: [targetId],
    difficulty: Math.min(ctx.difficulty, options.length - 1), skill: skillOf(type), check: !!ctx.check }, ctx);
}
// 짝 문항: 헷갈리는 짝(소리로 가를 수 있는 것) 둘 중 들린 쪽. 헷갈린 기록이 있는 짝을 먼저 고른다.
function makePair(targetId, knownList, ctx) {
  const { pack } = ctx;
  const known = new Set(knownList);
  const recent = (ctx.weak || []).find(([a, b]) => (a === targetId || b === targetId) && known.has(a) && known.has(b));
  if (!recent && ctx.fresh?.has(targetId)) return null;
  const partner = recent ? (recent[0] === targetId ? recent[1] : recent[0]) : earPartner(pack, targetId, known, ctx.fresh);
  if (!partner || hardByEar(pack, targetId) && ctx.difficulty < 2) return null;
  const t = pack.byId.get(targetId);
  const textOf = t.role === 'final' ? (() => { const f = finalFrame(knownList, ctx); return id => f.text(id); })()
    : (() => { const f = frameFor(t, knownList, ctx, { alone: !!pack.byId.get(partner).alone }); return id => f(id); })();
  const options = dedupeBySound(pack, [{ letter: targetId, text: textOf(targetId) }, { letter: partner, text: textOf(partner) }]);
  if (options.length < 2) return null;
  return { type: 'pair', target: { letter: targetId, text: textOf(targetId) }, options: shuffle(options, ctx.rand), focus: [targetId],
    difficulty: 1, skill: 'ko.hangul.sound', check: false };
}
// 낱말 읽기: 글자를 다 만난 낱말을 가끔 낸다(읽기의 쓸모). 낱말 문항은 글자 하나를 가르지 않아 글자 진도에는 넣지 않고,
// 「최근 스무 문항」·이어서 읽은 낱말 수(졸업)와 아틀라스 기록에만 든다. 같은 소리로 들리는 낱말(개/게)은 함께 내지 않는다.
export function readableWords(pack, known) { return pack.words.filter(w => w.letters.every(id => known.has(id))); }
function makeWordItem(type, known, ctx) {
  const { pack } = ctx;
  const words = readableWords(pack, known);
  if (words.length < 4) return null;
  const target = pick(words, ctx.rand);
  const same = shuffle(words.filter(w => w !== target && [...w.text].length === [...target.text].length && !pack.sameSound(w.text, target.text)), ctx.rand);
  const options = [target];
  for (const w of same) { if (options.length >= optionCount(ctx.difficulty)) break; if (!options.some(o => pack.sameSound(o.text, w.text))) options.push(w); }
  if (options.length < 2) return null;
  return { type, word: true, target: { letter: null, text: target.text }, options: shuffle(options.map(w => ({ letter: null, text: w.text })), ctx.rand), focus: [],
    difficulty: Math.min(ctx.difficulty, options.length - 1), skill: skillOf(type), check: false };
}
// 모음은 ㅇ을 받치거나 아는 자음 하나와, 자음은 아는 홑모음 하나와 음절을 이룬다(받침 없이). ㅒ·ㅖ·ㅢ가 든 문항은 ㅇ만 받친다.
// 모음 틀은 받친 자음(c)을 함께 돌려준다 — 보기를 고를 때 그 자음과 쓰지 않는 모음을 뺀다.
function frameFor(target, knownList, ctx, { alone = false } = {}) {
  const { pack } = ctx;
  if (target.role === 'vowel') {
    const consonants = knownList.filter(id => pack.byId.get(id).role === 'consonant' && id !== 'c-ng');
    const c = !alone && !target.alone && consonants.length && ctx.difficulty >= 2 && ctx.rand() < 0.5 ? pick(consonants, ctx.rand) : null;
    return Object.assign(id => pack.syllable(c, id), { c });
  }
  const vowels = knownList.filter(id => pack.byId.get(id).role === 'vowel' && pack.byId.get(id).frame);
  const v = vowels.includes('v-a') && ctx.rand() < 0.5 ? 'v-a' : pick(vowels.length ? vowels : ['v-a'], ctx.rand);
  return id => pack.syllable(id, v);
}
// ㅇ은 첫소리에서 소리가 없다: 「아」를 듣고 ㅇ이 들어간 음절을 고른다(보기는 다른 자음의 같은 모음).
function makeSilentItem(type, knownList, ctx) {
  const { pack } = ctx;
  const consonants = knownList.filter(id => pack.byId.get(id).role === 'consonant' && id !== 'c-ng');
  const vowels = knownList.filter(id => pack.byId.get(id).role === 'vowel' && pack.byId.get(id).frame);
  if (!consonants.length || !vowels.length) return null;
  const v = pick(vowels, ctx.rand);
  const others = shuffle(consonants, ctx.rand).slice(0, optionCount(ctx.difficulty) - 1);
  const options = [{ letter: 'c-ng', text: pack.syllable(null, v) }, ...others.map(id => ({ letter: id, text: pack.syllable(id, v) }))];
  return { type, target: { letter: 'c-ng', text: pack.syllable(null, v) }, options: shuffle(options, ctx.rand), focus: ['c-ng'],
    difficulty: Math.min(ctx.difficulty, options.length - 1), skill: skillOf(type), check: !!ctx.check };
}
// 음절 만들기: 들린 음절을 조각으로 만든다(U2부터). 받침이 목표면 자음·모음·받침 세 줄(아는 받침이 둘 이상일 때).
// ㅇ하고만 쓰는 모음(ㅒ·ㅖ·ㅢ)은 조각이 되지 않고, 겹모음은 겹모음을 만드는 문항에서만 조각으로 나온다.
// 같은 소리가 나는 조각(ㅐ·ㅔ, ㅚ·ㅙ·ㅞ)은 한 줄에 함께 내지 않는다.
function makeBuild(targetId, knownList, ctx) {
  const { pack } = ctx;
  const consonants = knownList.filter(id => pack.byId.get(id).role === 'consonant' && id !== 'c-ng');
  const vowels = knownList.filter(id => pack.byId.get(id).role === 'vowel' && !pack.byId.get(id).alone);
  const plain = vowels.filter(id => !pack.byId.get(id).compound);
  const finals = knownList.filter(id => pack.byId.get(id).role === 'final');
  if (!consonants.length || plain.length < 2) return null;
  const t = pack.byId.get(targetId);
  if (t.alone) return null;
  const distinct = (c, f) => (ids, made) => ids.filter((id, i) => !ids.slice(0, i).some(x => pack.sameSound(pack.syllable(c, x, f), pack.syllable(c, id, f))) && !pack.sameSound(pack.syllable(c, id, f), made));
  const per = { 1: 2, 2: 2, 3: 3 }[ctx.difficulty];
  if (t.role === 'final') {
    if (finals.length < 2 || hardByEar(pack, targetId) && ctx.difficulty < 2) return null;
    const cs = pack.FINAL_FRAME.initials.filter(c => c && consonants.includes(c)), vs = pack.FINAL_FRAME.vowels.filter(v => plain.includes(v));
    if (!cs.length || vs.length < 2) return null;
    const c = pick(cs, ctx.rand), v = pick(vs, ctx.rand), text = pack.syllable(c, v, targetId);
    const otherC = distractors(c, consonants, ctx, per - 1, { byEar: true });
    const otherV = distinct(c, targetId)(distractors(v, plain, ctx, per - 1, { byEar: true }), text);
    const otherF = distractors(targetId, finals, ctx, per - 1, { byEar: true }).filter(id => !pack.sameSound(pack.syllable(c, v, id), text));
    if (!otherF.length) return null;
    return { type: 'build', target: { letter: targetId, text, consonant: c, vowel: v, final: targetId },
      pieces: { consonants: shuffle([c, ...otherC], ctx.rand), vowels: shuffle([v, ...otherV], ctx.rand), finals: shuffle([targetId, ...otherF], ctx.rand) },
      focus: [c, v, targetId], difficulty: ctx.difficulty, skill: 'ko.hangul.sound', check: false };
  }
  const c = t.role === 'consonant' && targetId !== 'c-ng' ? targetId : pick(consonants, ctx.rand);
  const v = t.role === 'vowel' ? targetId : pick(plain, ctx.rand);
  const otherC = distractors(c, consonants, ctx, per - 1, { byEar: true });
  const text = pack.syllable(c, v);
  const otherV = distinct(c, null)(distractors(v, t.compound ? vowels : plain, ctx, (ctx.difficulty === 2 ? 3 : per) - 1, { byEar: true }), text);
  return { type: 'build', target: { letter: targetId, text, consonant: c, vowel: v },
    pieces: { consonants: shuffle([c, ...otherC], ctx.rand), vowels: shuffle([v, ...otherV], ctx.rand) },
    focus: [...new Set([c, v])], difficulty: ctx.difficulty, skill: 'ko.hangul.sound', check: false };
}
// 짝 맞추기: 글자 카드와 소리 카드 3~4쌍. 시간 제한이 없다. 같은 소리(ㅐ·ㅔ)는 한 판에 함께 넣지 않는다.
// 받침은 첫소리와 모양이 같아 카드로는 갈리지 않으니 넣지 않는다.
function makeMatch(targetId, knownList, ctx) {
  const { pack } = ctx;
  const size = ctx.difficulty >= 3 ? 4 : 3;
  if (pack.byId.get(targetId).role === 'final') return null;
  const cardable = knownList.filter(id => pack.byId.get(id).role !== 'final');
  const first = targetId;
  const chosen = [first];
  for (const id of shuffle(cardable.filter(id => id !== first), ctx.rand)) {
    if (chosen.length >= size) break;
    if (chosen.some(other => pack.sameSound(pack.byId.get(other).voice, pack.byId.get(id).voice))) continue;
    chosen.push(id);
  }
  if (chosen.length < 3) return null;
  const cards = chosen.map(id => ({ letter: id, text: pack.byId.get(id).glyph, voice: pack.byId.get(id).voice }));
  return { type: 'match', target: { letter: first, text: pack.byId.get(first).glyph }, cards: shuffle(cards, ctx.rand), sounds: shuffle(cards, ctx.rand),
    focus: chosen, difficulty: Math.min(ctx.difficulty, 2), skill: 'ko.hangul.sound', check: false };
}

// ── 이유 한 줄(설계 §7) ── 아는 것만 사실로 말한다. 글을 못 읽어도 글자 칩으로 뜻이 통하게 글자를 함께 돌려준다.
function reasonLine({ p, pack, fresh, weak, due, now }) {
  // letters는 글자 모양, finals는 그 글자가 받침인지(같은 순서).
  const chips = ids => ({ letters: ids.map(id => pack.byId.get(id).glyph), finals: ids.map(id => pack.byId.get(id).role === 'final') });
  if (p.graduated && !weak && !fresh.length) return { kind: 'warmup', text: '몸풀기예요. 헷갈리기 쉬운 글자를 짧게 봐요.', ...chips(due.slice(0, 4)) };
  if (weak) {
    const day = localDay(weak.lastAt), today = localDay(new Date(now).toISOString()), yesterday = localDay(new Date(now - DAY).toISOString());
    const when = day === today ? '방금' : day === yesterday ? '어제' : '지난번에';
    return { kind: 'pair', text: `${when} 헷갈린 글자예요. 오늘 다시 해요.`, ...chips([...weak]) };
  }
  const finals = fresh.filter(id => pack.byId.get(id).role === 'final');
  if (finals.length && finals.length === fresh.length) return { kind: 'new', text: `오늘은 새 받침 ${['', '하나를', '둘을', '셋을'][finals.length]} 만나요.`, ...chips(fresh) };
  if (fresh.length && due.length) return { kind: 'mixed', text: '다시 볼 글자와 새 글자예요.', ...chips([...due.slice(0, 2), ...fresh]) };
  if (fresh.length) return { kind: 'new', text: `오늘은 새 글자 ${['', '하나를', '둘을', '셋을'][fresh.length]} 만나요.`, ...chips(fresh) };
  if (due.length) return { kind: 'due', text: '다시 만날 때가 된 글자예요.', ...chips(due.slice(0, 4)) };
  return { kind: 'practice', text: '아는 글자로 연습해요.', letters: [], finals: [] };
}

// ── 회차 끝 ── 난이도: 이어서 두 회차 순조로우면 위로, 이어서 두 회차 막히면 아래로(설계 §7).
export function finishSession(progress, { day, sessionNo, total, independent }) {
  const next = readProgress(progress);
  const ratio = total ? independent / total : null;
  next.sessions = [...next.sessions, { day, sessionNo, total, independent }].slice(-60);
  if (ratio != null) {
    if (ratio >= SETTINGS.smooth) next.trend = next.trend > 0 ? next.trend + 1 : 1;
    else if (ratio < SETTINGS.struggle) next.trend = next.trend < 0 ? next.trend - 1 : -1;
    else next.trend = 0;
    if (next.trend >= 2) { next.difficulty = Math.min(3, next.difficulty + 1); next.trend = 0; }
    if (next.trend <= -2) { next.difficulty = Math.max(1, next.difficulty - 1); next.trend = 0; }
  }
  return next;
}
export function sessionsToday(progress, now) { const day = localDay(now); return readProgress(progress).sessions.filter(s => s.day === day).length; }
export function canPlayMore(progress, now) { return sessionsToday(progress, now) < 1 + SETTINGS.extraPerDay; }

// ── 보이는 것(진도에서 파생, 따로 저장하지 않는다) ──
// 타일의 자수는 닿은 가장 높은 상태를 보이고 되풀리지 않는다. 간판은 그 글자를 다 익혔을 때 또렷해지고 다시 흐려지지 않는다.
export function view(progress, pack, now) {
  const p = readProgress(progress);
  const letters = pack.letters.map(l => ({ id: l.id, glyph: l.glyph, voice: l.voice, unit: l.unit, role: l.role, state: letterOf(p, l.id).state, shown: letterOf(p, l.id).best }));
  const shown = new Map(letters.map(l => [l.id, l.shown]));
  const everMastered = id => shown.get(id) === 'mastered';
  const signs = pack.signs.map(s => ({ text: s.text, unit: s.unit, readable: s.letters.every(everMastered),
    syllables: s.syllables.map(x => ({ text: x.text, clear: x.letters.every(everMastered) })) }));
  const plate = pack.plate.map(s => ({ text: s.text, cells: s.cells.map(c => ({ glyph: c.glyph, final: !!c.final, later: !!c.later, filled: !!c.letter && everMastered(c.letter) })) }));
  const unit = unitNow(p, pack);
  const num = id => Number(id.slice(1));
  const units = [...pack.units.map(u => ({ id: u.id, label: u.label, glyphs: u.letters.map(id => pack.byId.get(id).glyph).join(''), final: u.letters.every(id => pack.byId.get(id).role === 'final'),
    status: u.letters.every(everMastered) ? 'done' : u.id === unit?.id ? 'now' : u.letters.some(id => shown.get(id) !== 'unmet') ? 'started' : 'next' })),
  ...pack.later.map(u => ({ id: u.id, label: u.label, glyphs: u.preview, status: 'later' }))].sort((a, b) => num(a.id) - num(b.id));
  const upcoming = nextLetters(p, pack, 2);
  const tomorrow = upcoming.map(id => pack.byId.get(id).glyph), tomorrowFinals = upcoming.map(id => pack.byId.get(id).role === 'final');
  return { letters, signs, plate, units, tomorrow, tomorrowFinals, difficulty: p.difficulty, amount: p.amount, skipped: p.skipped, graduated: p.graduated,
    started: letters.some(l => l.state !== 'unmet'), allMet: letters.every(l => l.state !== 'unmet') };
}
