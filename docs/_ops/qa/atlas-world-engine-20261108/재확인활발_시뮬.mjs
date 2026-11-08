// 한 달 반 넘게 활발한 학습자의 재확인 장부를 잰다(2026-11-08, 재확인 내구성 설계 §1의 근거).
// 실제 엔진(createGame)과 실제 문항 메타로 게임 여럿을 한 장부에서 돌려, 날마다 칸 · 보관(retention) · 접힘 · 공급을 찍는다.
//   node docs/_ops/qa/atlas-world-engine-20261108/재확인활발_시뮬.mjs [--atlas <atlas 폴더>] [--학생 보통|활발|리듬광] [--저장소 기기|계정] [--일 N] [--씨앗 N] [--전체기록] [--json <파일>]
// --atlas 없으면 이 작업본 atlas/. 고치기 전 판을 재려면 `git archive <커밋> atlas`로 푼 폴더를 준다.
// --전체기록: 접지 않고 칸마다 보관 묶음 크기를 잰다(접힘이 끼지 않은 수요 — 어느 게임이 얼마나 필요한가). 옛 판 전용(Ledger.retention)이다.
//   설계 §1-2의 「상한을 풀면」은 고치기 전 폴더(4b7af9c0f)에서 temper.js의 maxAnchors: 24만 9999로 바꿔 --atlas로 주고 잰 값이다. 상한이 남아 있으면 「빠진칸」이 0이 아니고 수요가 모자라게 찍힌다 — 끝에 경고한다.
// 근사: 게임 안의 고르기(추천 · 곡 순서)는 단순화했다. 칸 · 계열 · 반복은 실제 메타이고, 쉽게 못 부르는 게임(레이싱 · 한글 · 낱말 찍기 · 이야기 교실 ·
// 낱말 마법)만 조사한 칸 · 문항 수로 합성한다. 사람 수 · 효과를 말하지 않는다 — 장부가 버티는지만 본다.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const url = f => pathToFileURL(path.join(ROOT, f)).href;
const require = createRequire(import.meta.url);
const argv = process.argv.slice(2);
const opt = (name, fallback) => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : fallback; };
const ATLAS = path.resolve(opt('--atlas', path.join(ROOT, 'atlas')));
const WHO = opt('--학생', '활발'), STORE = opt('--저장소', '기기'), DAYS = Number(opt('--일', '60')), SEED = Number(opt('--씨앗', '7')), WHOLE = argv.includes('--전체기록');
const JSON_OUT = opt('--json', null);
const Game = require(path.join(ATLAS, 'game-learning.js')), Ledger = require(path.join(ATLAS, 'learning-ledger.js')), Learning = require(path.join(ATLAS, 'learning.js'));
const { createMap } = require(path.join(ROOT, 'strata'));
const { worldMapData } = require(path.join(ROOT, 'strata/world-map.js'));
const { followupRows } = await import(url('experiences/synk-world-app/world-learning-followups.mjs'));
const { lifeFollowupRows } = await import(url('experiences/synk-world-app/life-followups.mjs'));
const { delayedSupplemental } = await import(url('experiences/korean-rhythm/supplemental-player.mjs'));
const { delayedOrders } = await import(url('experiences/order-rush/learning.mjs'));
const data = worldMapData(), map = createMap(data), DAY = 86400000, MIN = 60000, START = Date.parse('2026-12-01T00:00:00Z');
const contentKinds = new Set(Learning.CONTENT);
// 지도에 없는 내용 낱말은 칸 · 계열에 영향이 없으니 뺀다(접힘표 크기만 조금 줄어든다).
const clean = item => ({ ...item, conceptIds: (item.conceptIds || []).filter(id => contentKinds.has(map.getNode(id)?.kind)).slice(0, 31) });
const usable = item => { const n = map.getNode(item.skillId); return n?.kind === 'skill' && n.domain === item.modality; };
function rngOf(seed) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
const rand = rngOf(SEED);
const pick = list => list[Math.floor(rand() * list.length)];
const shuffled = list => { const out = [...list]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; };

// ── 문항 풀(실제 메타) ──────────────────────────────────────────
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'experiences/synk-world-app/world-topik-items.json'), 'utf8'));
const followRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'experiences/synk-world-app/world-followup-items.json'), 'utf8'));
const { worldPosition } = await import(url('experiences/synk-world-app/world-position-kit.mjs'));
worldPosition.topik.use(raw); worldPosition.followups.bank.use(followRaw);
const blank = await (async () => { const c = await import(url('experiences/blank-slice/content.mjs')), l = await import(url('experiences/blank-slice/learning.mjs')); return c.ITEMS.map(l.itemMetadata); })();
const entry = await (async () => { const c = await import(url('experiences/entry-check/content.mjs')), l = await import(url('experiences/entry-check/learning.mjs')); return c.VENUES.flatMap(v => v.cases).map(l.caseMetadata); })();
const talk = await (async () => { const c = await import(url('experiences/talk-rally/content.mjs')), l = await import(url('experiences/talk-rally/learning.mjs')); return c.ITEMS.map(l.itemMetadata); })();
const town = await (async () => { const u = await import(url('experiences/synk-town/understanding.mjs')); return u.READING_CHECKS.map(u.readingMetadata); })();
const runner = await (async () => { const lc = await import(url('experiences/korean-runner/listening-check.mjs')); return lc.LISTENING_CHECKS.map(lc.checkMetadata); })();
const orders = await (async () => { const c = await import(url('experiences/order-rush/core.mjs')), l = await import(url('experiences/order-rush/learning.mjs')); return { base: c.BASE_ORDERS.map(l.orderMetadata), extra: c.ADDITIONAL_ORDERS, meta: l.orderMetadata, delayedPool: c.ADDITIONAL_ORDERS.filter(o => o.role === 'delayed') }; })();
const rhythmKit = await (async () => { const core = await import(url('experiences/korean-rhythm/core.mjs')), pz = await import(url('experiences/korean-rhythm/personalization.mjs')), sup = await import(url('experiences/korean-rhythm/supplemental.mjs')); return { core, pz, sup }; })();
const lifeKit = await import(url('experiences/synk-world-app/life-items.mjs'));
const life = lifeKit.lifeItems();
// 합성: 조사한 문항 · 칸 수 그대로. 칸은 지도에 있는 능력으로 맞춘다.
const synth = (game, count, cells, { audio = false, families = count, format = 'single-choice' } = {}) => {
  const skills = data.nodes.filter(n => n.kind === 'skill' && n.domain === (audio ? 'listening' : 'reading') && !n.id.startsWith('ko2.')).map(n => n.id), out = [];
  for (let i = 0; i < count; i++) { const c = i % cells; out.push({ id: `${game}.s${i}`, itemKey: `${game}.s${i}.v1`, familyKey: `${game}.f${i % families}`, skillId: skills[c % skills.length], difficulty: 1 + Math.floor(c / skills.length) % 3, modality: audio ? 'listening' : 'reading', responseFormat: format, audioRequired: audio, confounded: false, conceptIds: [] }); }
  return out;
};
const SYNTH = {
  'korean-racing': synth('korean-racing', 90, 14, { audio: true }),
  'hangul-stage': synth('hangul-stage', 1200, 9, { audio: true, families: 563 }),
  'snap-words': synth('snap-words', 70, 4),
  'story-classroom': synth('story-classroom', 9, 3, { audio: true }),
  'word-magic': synth('word-magic', 6, 1, { audio: true }),
  'subway-rush': synth('subway-rush', 51, 3, { audio: true, families: 34 }),
};

// ── 장부 · 코치 ─────────────────────────────────────────────────
let now = START; const mem = new Map();
const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
const clock = () => new Date(now += 1500 + Math.floor(rand() * 4000)).toISOString();
const ACCOUNT = STORE === '계정', ACCOUNT_KEY = 'sim-account';
const READERS = new Set(['korean-rhythm', 'order-rush', 'world-practice', 'world-life', 'world-mock', 'world-home', 'world-writing', 'world-speaking']);
function open(gameId) {
  const base = { gameId, map, storage, clock };
  if (ACCOUNT) { const coach = Game.createGame({ ...base, learnerKey: 'device', storageScope: 'account', accountKey: ACCOUNT_KEY, historyComplete: false, fold: WHOLE ? false : { remote: true }, followups: true }); coach.syncPort.markComplete(true); return coach; }
  return Game.createGame({ ...base, followups: READERS.has(gameId), ...(WHOLE ? { fold: false } : {}) });
}
let opened = null;
const leave = () => { if (opened) { opened.flush?.(); if (ACCOUNT && !WHOLE) opened.syncPort.settle(opened.events().map(e => e.id)); opened.dispose?.(); opened = null; } };
const coachFor = gameId => { leave(); return (opened = open(gameId)); };
const stats = { attempts: 0, sessions: 0, helps: 0, followupsDone: {} };
function play(coach, item, { help = 0.12, right = 0.72, explain = 0.25 } = {}) {
  const pid = coach.present(clean(item));
  if (item.audioRequired) coach.delivery(pid, { audio: 'completed' });
  if (rand() < help) { coach.help(pid, 'hint'); stats.helps += 1; }
  coach.answer(pid, { correct: rand() < right, assessable: true });
  if (rand() < explain) coach.help(pid, 'explanation');
  stats.attempts += 1;
}
const seenFalse = (coach, item) => { try { return coach.exposure(item).seen === false; } catch { return false; } };
const session = (gameId, fn) => { const coach = coachFor(gameId); stats.sessions += 1; fn(coach); leave(); now += 11 * MIN + Math.floor(rand() * 20 * MIN); };

// ── 게임별 한 판(조사한 판당 문항 수) ───────────────────────────
const practicePool = () => worldPosition.practice.pool.filter(usable).filter(i => WHO === '시험' || !i.skillId.startsWith('ko2.'));
const games = {
  practice(coach) { const fresh = shuffled(practicePool()).filter(i => seenFalse(coach, i)).slice(0, 5); for (const i of fresh) play(coach, i); },
  mock(coach) { const fresh = shuffled(worldPosition.mock.pool.filter(usable).filter(i => !i.skillId.startsWith('ko2.'))).filter(i => seenFalse(coach, i)).slice(0, 20); for (const i of fresh) play(coach, i, { help: 0, explain: 0.1 }); },
  diagnostic(coach) { const fresh = shuffled(worldPosition.items.filter(usable).filter(i => !i.skillId.startsWith('ko2.'))).filter(i => seenFalse(coach, i)).slice(0, 16); for (const i of fresh) play(coach, i, { help: 0.05, explain: 0 }); },
  rhythm(coach) { const t = pick(rhythmKit.core.TRACKS), round = new rhythmKit.core.RoundState(t); for (const q of round.questions) play(coach, rhythmKit.pz.rhythmItem(t.id, q), { right: 0.8 }); for (const q of round.questions.slice(0, 2)) play(coach, rhythmKit.pz.rhythmItem(t.id, q, { recall: true }), { right: 0.85, help: 0.05 }); },
  rhythmExtra(coach) { const fresh = shuffled(rhythmKit.sup.supplementalItems()).filter(i => seenFalse(coach, i)).slice(0, 3); for (const i of fresh) play(coach, i); },
  order(coach) { for (const i of shuffled(orders.base).slice(0, 8)) play(coach, i, { right: 0.8 }); },
  blank(coach) { for (const i of shuffled(blank).slice(0, 12)) play(coach, i); },
  entry(coach) { for (const i of shuffled(entry).slice(0, 6)) play(coach, i); },
  talk(coach) { for (const i of shuffled(talk).slice(0, 12)) play(coach, i); },
  town(coach) { for (const i of shuffled(town).slice(0, 3)) play(coach, i); },
  runner(coach) { for (const i of shuffled(runner).slice(0, 3)) play(coach, i); },
  racing(coach) { for (const i of shuffled(SYNTH['korean-racing']).slice(0, 5)) play(coach, i); },
  hangul(coach) { for (const i of shuffled(SYNTH['hangul-stage']).slice(0, 14)) play(coach, i, { right: 0.85 }); },
  snap(coach) { for (const i of shuffled(SYNTH['snap-words']).slice(0, 5)) play(coach, i); },
  story(coach) { for (const i of SYNTH['story-classroom']) play(coach, i); },
  magic(coach) { for (const i of shuffled(SYNTH['word-magic']).slice(0, 2)) play(coach, i); },
  subway(coach) { for (const i of shuffled(SYNTH['subway-rush']).slice(0, 7)) play(coach, i); },
};
const GAME_IDS = { practice: 'world-practice', mock: 'world-mock', diagnostic: 'world-home', rhythm: 'korean-rhythm', rhythmExtra: 'korean-rhythm', order: 'order-rush', blank: 'blank-slice', entry: 'entry-check', talk: 'talk-rally', town: 'synk-town', runner: 'korean-runner', racing: 'korean-racing', hangul: 'hangul-stage', snap: 'snap-words', story: 'story-classroom', magic: 'word-magic', subway: 'subway-rush' };
const run = name => session(GAME_IDS[name], games[name]);
// 생활 한국어: 하루 레슨 몇 개(본문항) + 돌아온 복습(1 · 3 · 7 · 14 · 30일).
const lessons = [...new Set(life.filter(i => !i.review).map(i => i.lessonId))];
const lessonItems = id => life.filter(i => i.lessonId === id && !i.review), reviewItems = id => life.filter(i => i.lessonId === id && i.review);
let nextLesson = 0; const lessonDay = new Map();
function lifeDay(day, count) {
  session('world-life', coach => {
    for (const [id, at] of lessonDay) if ([1, 3, 7, 14, 30].includes(day - at)) for (const i of reviewItems(id)) play(coach, i, { right: 0.75 });
    for (let n = 0; n < count && nextLesson < lessons.length; n++, nextLesson++) { const id = lessons[nextLesson]; lessonDay.set(id, day); for (const i of lessonItems(id)) play(coach, i); }
  });
}
// ── 학생 ────────────────────────────────────────────────────────
const LAB = ['blank', 'entry', 'talk', 'town', 'runner', 'racing', 'snap', 'story', 'magic', 'subway', 'hangul'];
const PLANS = {
  // 보통 활발: 매일 짧은 연습 + 생활 + 게임 한 판, 격주 모의.
  보통(day) { if (day % 14 === 0) run('mock'); if (day === 0) run('diagnostic'); run('practice'); lifeDay(day, 1); run(day % 3 === 0 ? 'rhythm' : day % 3 === 1 ? 'order' : pick(LAB)); },
  // 활발: 매일 연습 둘 + 생활 + 게임 셋, 주간 모의, 첫날 · 30일 진단.
  활발(day) { if (day % 7 === 0) run('mock'); if (day === 0 || day === 30) run('diagnostic'); run('practice'); run('practice'); lifeDay(day, 1); run('rhythm'); run('order'); run(pick(LAB)); if (day % 2) run(pick(LAB)); },
  // 시험 준비: 활발에 TOPIK II 풀까지, 모의 잦음.
  시험(day) { if (day % 4 === 0) run('mock'); if (day % 15 === 0) run('diagnostic'); run('practice'); run('practice'); run('practice'); lifeDay(day, 1); run('rhythm'); run(pick(LAB)); },
  // 리듬광: 곡을 하루 열 번 넘게 되풀이(같은 계열이 계속 돌아온다).
  리듬광(day) { for (let i = 0; i < 12; i++) run('rhythm'); run('rhythmExtra'); run('practice'); lifeDay(day, 1); },
};
// ── 재확인 소비: 실제 소비 함수로 「확인할 수 있는 줄」을 재고 일부를 푼다 ───────────
const scan = () => {
  const coach = coachFor('world-practice'), projection = coach.followups(), seen = item => coach.exposure(item).seen;
  const pool = [...worldPosition.practice.pool, ...worldPosition.followups.pool(seen)];
  const rows = followupRows({ projection, pool, seen, taskVersion: coach.mapVersion });
  const lifeRows = lifeFollowupRows({ projection, seen, snapshot: { lessons: Object.fromEntries([...lessonDay].map(([id, at]) => [id, { completedAt: START + at * DAY }])), reviews: {} }, now, life: { lifeItems: lifeKit.lifeItems, productMet: () => false, lifeAssessable: lifeKit.lifeAssessable }, taskVersion: coach.mapVersion });
  return { coach, projection, rows, lifeRows };
};
function followupWork() {
  const { coach, rows } = scan();
  const open = rows.rows.filter(r => r.status === 'due' && r.available).slice(0, WHO === '보통' ? 2 : 4);
  for (const r of open) if (seenFalse(coach, r.item)) { play(coach, r.item); stats.followupsDone['world-practice'] = (stats.followupsDone['world-practice'] || 0) + 1; }
  leave(); now += 11 * MIN;
  const rhythm = coachFor('korean-rhythm'), due = delayedSupplemental(rhythm).slice(0, 2);
  for (const i of due) { play(rhythm, i); stats.followupsDone['korean-rhythm'] = (stats.followupsDone['korean-rhythm'] || 0) + 1; }
  leave(); now += 11 * MIN;
  const order = coachFor('order-rush'), dueOrders = delayedOrders(order, orders.delayedPool).slice(0, 2);
  for (const o of dueOrders) { play(order, orders.meta(o)); stats.followupsDone['order-rush'] = (stats.followupsDone['order-rush'] || 0) + 1; }
  leave(); now += 11 * MIN;
}
// ── 재기 ────────────────────────────────────────────────────────
const groupsBy = (events, items) => {
  const parentOf = new Map(); for (const e of events) if (e.type === 'practice.attempted') parentOf.set(e.id, e.presentationId);
  const decisionOf = new Map(); for (const e of events) if (e.type === 'practice.presented') decisionOf.set(e.id, e.decisionId);
  const byGame = new Map();
  for (const r of items) { if (!byGame.has(r.gameId)) byGame.set(r.gameId, { cells: new Set(), decisions: new Set(), rows: 0 }); const g = byGame.get(r.gameId); g.cells.add(r.sourceAttemptId); g.rows += 1;
    for (const id of [r.sourceAttemptId, r.targetAttemptId]) { const d = id && decisionOf.get(parentOf.get(id)); if (d) g.decisions.add(d); } }
  return byGame;
};
const started = Date.now(), lines = [], events0 = [];
const report = day => {
  const t0 = Date.now(), { coach, projection, rows, lifeRows } = scan(), readMs = Date.now() - t0, stored = JSON.parse(storage.getItem(ACCOUNT ? `${Game.KEY}.device` : `${Game.KEY}.device`) || '{}'), led = stored.ledger || null;
  const events = coach.events(), byGame = groupsBy(events, projection.items), cov = projection.coverage;
  const games = Object.fromEntries([...byGame].map(([id, g]) => [id, g.cells.size]));
  const line = { 일: day, 시도: stats.attempts, 기록: events.length, 접힘: led?.folded || 0, 바이트: mem.get(`${Game.KEY}.device`)?.length || 0, 칸: Object.values(games).reduce((a, b) => a + b, 0), 빠진칸: cov.excludedAnchors || 0,
    보관건: cov.retainedEvents ?? null, 보관KB: cov.retainedBytes == null ? null : Math.round(cov.retainedBytes / 1024), 상한초과: cov.limited === true, 보관한계: cov.retentionLimited === true, 완전: projection.evidenceComplete, 까닭: cov.reason ?? null,
    연습줄: rows.rows.length, 연습확인: rows.rows.filter(r => r.status === 'due').length, 연습공급: rows.rows.filter(r => r.available).length, 공급중단: rows.limited, 생활줄: lifeRows.rows?.length ?? 0, 생활중단: lifeRows.limited, 읽기ms: readMs, 표KB: Math.round(JSON.stringify(led?.followups || null).length / 1024), 칸별: games, lost: Boolean(led?.followupsLost), preserved: led?.followupsPreserved ?? null };
  if (WHOLE) {
    if (typeof Ledger.retention !== 'function') throw Error('--전체기록은 Ledger.retention이 있는 옛 판 폴더를 --atlas로 준다');
    const whole = {}; for (const [id, g] of byGame) { const r = Ledger.retention(events, [...g.decisions], { maxEvents: Infinity, maxBytes: Infinity }); whole[id] = { 칸: g.cells.size, 결정: g.decisions.size, 보관건: r.events, KB: Math.round(r.bytes / 1024) }; }
    const all = Ledger.retention(events, [...byGame.values()].flatMap(g => [...g.decisions]), { maxEvents: Infinity, maxBytes: Infinity });
    line.게임별보관 = whole; line.합보관건 = all.events; line.합보관KB = Math.round(all.bytes / 1024);
  }
  lines.push(line); leave(); return line;
};
for (let day = 0; day < DAYS; day++) {
  now = Math.max(now, START + day * DAY + 9 * 3600000);
  PLANS[WHO](day);
  followupWork();
  // 최초 도달일 · 최댓값은 날마다 잰다. 찍는 것만 표본 날짜로.
  const l = report(day);
  if ([0, 1, 2, 4, 7, 10, 14, 21, 25, 30, 37, 45, 52, 59, 67, 75, 89].includes(day) || day === DAYS - 1) console.log(JSON.stringify({ ...l, 칸별: undefined, 게임별보관: undefined }));
}
const last = lines.at(-1);
if (WHOLE && lines.some(l => l.빠진칸)) console.log('경고: 상한에 걸려 빠진 칸이 있어 보관 수요가 모자라게 찍혔다 — 상한을 푼 --atlas 폴더로 다시 잰다');
console.log('칸별(마지막 날):', JSON.stringify(last.칸별));
if (WHOLE) console.log('게임별 보관 수요(마지막 날):', JSON.stringify(last.게임별보관), '합', last.합보관건, '건', last.합보관KB, 'KB');
console.log(JSON.stringify({ 학생: WHO, 저장소: STORE, 일: DAYS, 시도: stats.attempts, 판: stats.sessions, 재확인푼수: stats.followupsDone, 걸린초: Math.round((Date.now() - started) / 1000), 첫상한초과일: lines.find(l => l.상한초과)?.일 ?? null, 첫공급중단일: lines.find(l => l.공급중단)?.일 ?? null, 첫보관한계일: lines.find(l => l.보관한계)?.일 ?? null, 최대보관건: Math.max(...lines.map(l => l.보관건 || 0)), 최대KB: Math.max(...lines.map(l => l.보관KB || 0)), 최대바이트: Math.max(...lines.map(l => l.바이트)), 최대읽기ms: Math.max(...lines.map(l => l.읽기ms)), 최대표KB: Math.max(...lines.map(l => l.표KB)), 최대칸: Math.max(...lines.map(l => l.칸)) }));
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(lines, null, 1));
