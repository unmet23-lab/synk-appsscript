#!/usr/bin/env node
// 시나리오 기록을 실제 기록기로 심고(심기.mjs) 「오늘」 · 끝 꼴을 뽑는다 — 시안 · 시험의 값이 실제 기록에서 나오게.
//   node experiences/drama/qa/오늘한장-20261114/뽑기.mjs [A|B|F] [--now 2026-11-15T09:00:00+09:00] [--json]
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { seed } from './심기.mjs';
import { buildToday } from '../../pilot/today/plan.mjs';
import { STR } from '../../pilot/strings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(import.meta.url);

/** 합성 계정 하나(메모리 저장소)에 시나리오를 심고 읽을 것들을 돌려준다. */
export async function world({ scenario = 'A', now = Date.now() } = {}) {
 const D = require(path.join(ROOT, 'experiences/drama/pilot/learning-entry.cjs'));
 // 같은 영역(realm)에서 돌려야 한다 — Trail은 고른 칸 객체의 원형이 이 영역의 Object인지 본다.
 if (!globalThis.SynkLearning) vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'experiences/entry-check/atlas-learning.js'), 'utf8') + '\n;globalThis.SynkLearning = SynkLearning;');
 const E = globalThis.SynkLearning;
 const entryLearning = await import('../../../entry-check/learning.mjs');
 const { VENUES } = await import('../../../entry-check/content.mjs');
 const mem = new Map();
 const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
 const host = D.createRehearsalHost({ accountKey: 'synthetic-today', revision: 1, connected: false, storage, transport: null, win: null });
 const play = new Map();
 const playStorage = { getItem: (k) => (play.has(k) ? play.get(k) : null), setItem: (k, v) => play.set(k, String(v)), removeItem: (k) => play.delete(k) };
 await seed({ host, drama: D, entry: E, entryLearning, VENUES, playStorage, scenario, now });
 return { D, E, host, entryLearning, VENUES, playStorage, now };
}

/** gather.mjs와 같은 일을 Node에서: 드라마 사건 · C 차례 · 입장 검사 재방문 맞춤을 읽어 buildToday에 넘긴다. */
export async function read(w, lesson) {
 const { D, E, host, entryLearning, VENUES, playStorage, now } = w;
 const g = host.createGame({ gameId: 'drama-s1' }, D.engine.createGame, D.engine.createLearningSync);
 const events = g.events();
 const rec = D.createRecorder({ win: null, owner: host });
 const delayedDue = lesson.delayed ? rec.delayedDue({ lineId: lesson.delayed.id, skillId: lesson.delayed.skill }) : false;
 g.dispose?.();
 let entry = null;
 const progress = JSON.parse(playStorage.getItem('synk.entry-check.v1') || 'null');
 if (progress) {
  const coach = host.createGame({ gameId: 'entry-check' }, E.engine.createGame, E.engine.createLearningSync);
  const { unlocked } = await import('../../../entry-check/core.mjs');
  const ids = VENUES.filter((v) => unlocked(progress, v.id)).map((v) => v.id);
  const plan = entryLearning.shiftPlan(coach, ids, progress);
  coach.dispose?.();
  if (plan) {
   const v = VENUES.find((x) => x.id === plan.target.venueId);
   const { WORLD_VENUES } = await import('../../../entry-check/world-content.mjs'); // WORLD에서 보이는 이름(gather.mjs와 같게)
   entry = { patternId: plan.patternId, why: plan.why, next: plan.next, misses: plan.misses, seen: plan.seen, evidenceIds: plan.evidenceIds, targetId: plan.target.id,
    itemKey: plan.target.meta.itemKey, venue: { id: v.id, day: v.day, name: WORLD_VENUES[v.id]?.name || v.name } };
  }
 }
 return { events, delayedDue, entry, today: buildToday({ events, lesson, now, delayedDue, entry, strings: STR.ko }) };
}

/** 「오늘」 할 것을 해낸 것처럼 남긴다(끝 화면 값 뽑기): 다시 · 새 상황은 첫 테이크 통과, 입장 검사는 약속한 손님을 맞힌 한 근무. */
export async function doToday(w, today, { minutesAgo = 30, results = {} } = {}) {
 const { D, E, host, entryLearning, VENUES, playStorage, now } = w;
 const ago = (m) => m / 1440;
 const drama = [];
 let m = minutesAgo;
 const SKILL = Object.fromEntries((await import('../../pilot/today/content.mjs')).POOL.map((x) => [x.id, x.skill]));
 for (const item of today.items) {
  if (item.open.type !== 'situation') continue;
  m -= 4;
  const skill = SKILL[item.open.lineId] || 'ko.speaking.ask';
  const r = results[item.open.lineId] || 'pass';
  drama.push({ daysAgo: ago(m), phase: 'transfer', lineId: item.open.lineId, skill, lazy: item.open.source === 'delayed' ? true : 'transcribed', takes: [[r, r === 'pass']] });
 }
 const entryItem = today.items.find((x) => x.open.type === 'game');
 let entry = null, target = null;
 if (entryItem) {
  const plan = (await read(w, w.lesson)).entry;
  const progress = JSON.parse(playStorage.getItem('synk.entry-check.v1'));
  const v = VENUES.find((x) => x.id === entryItem.open.venueId);
  const tid = entryItem.why.evidence.targetId.replace(/^entry-check\./, '');
  const others = v.cases.filter((c) => !c.followupOnly && c.id !== tid && c.skill !== v.cases.find((x) => x.id === tid).skill).slice(0, 5).map((c) => [c.id, true]);
  m -= 6;
  entry = { progress: { ...progress, plays: progress.plays + 1 }, shifts: [{ daysAgo: ago(m), cases: [...others.slice(0, 2), [tid, results.entry !== 'miss'], ...others.slice(2)] }] };
  target = { itemKey: plan?.itemKey || entryLearning.caseMetadata(v.cases.find((c) => c.id === tid)).itemKey };
 }
 await seed({ host, drama: D, entry: E, entryLearning, VENUES, playStorage, scenario: { drama, entry }, now });
 return { startAt: now - minutesAgo * 60000, entryTarget: target };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('뽑기.mjs')) {
 const args = process.argv.slice(2);
 const scenario = args.find((a) => /^[A-Z]$/.test(a)) || 'A';
 const i = args.indexOf('--now');
 const now = i >= 0 ? Date.parse(args[i + 1]) : Date.now();
 const lesson = JSON.parse(fs.readFileSync(path.join(ROOT, 'experiences/drama/pilot/world-lesson.json'), 'utf8')).lesson;
 const w = await world({ scenario, now: args.includes('--after') ? now - 31 * 60000 : now });
 w.lesson = lesson;
 const r = await read(w, lesson);
 if (args.includes('--after')) {
  // 버튼을 누른 때(31분 전)의 오늘 → 그 뒤 해낸 기록 → 지금의 끝 꼴.
  w.now = now;
  const done = await doToday(w, r.today, { minutesAgo: 30 });
  const again = await read(w, lesson);
  const { buildAfter } = await import('../../pilot/today/plan.mjs');
  const after = buildAfter({ events: again.events, lesson, start: r.today, startAt: done.startAt, now, entryAfter: again.entry, entryTarget: done.entryTarget, strings: STR.ko });
  console.log(JSON.stringify({ today: r.today, after }, null, 1));
 } else if (args.includes('--json')) console.log(JSON.stringify(r.today, null, 1));
 else {
  console.log(`[${scenario}] 사건 ${r.events.length} · C 차례 ${r.delayedDue} · 입장 검사 ${r.entry ? r.entry.patternId : '없음'}`);
  console.log(JSON.stringify(r.today, null, 1));
 }
}
