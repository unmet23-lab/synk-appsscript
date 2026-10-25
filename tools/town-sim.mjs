#!/usr/bin/env node
/** 싱크타운 결정적 시뮬레이션 — 찻집 골목의 하루 세로 조각 설계 §15-1.
 *
 *   node tools/town-sim.mjs --check              씨앗 100 × 30생활일을 돌려 기준을 본다(실패가 있으면 종료 1, CI)
 *   node tools/town-sim.mjs --report             같은 실행의 보고서를 experiences/synk-town/qa/town-sim/에 쓴다
 *   node tools/town-sim.mjs --hash               결과 해시만 낸다(시간대를 바꿔 돌려 견주는 데 쓴다, §15-3)
 *   --seeds N · --days N                         규모를 바꾼다(시험은 씨앗 12)
 *
 * 마을 씨앗 × 시간대 넷(UTC+9·+8·+7·−5) × 플레이어 모습 다섯을 돈다. 런타임은 묶음마다 자란다 — 지금(W5)은 결산과 같은 길로
 * 구간을 닫아 두 주민·장소·반복·비, 기운·마음 한 줄, 카드·전해 듣기·쌍·카드 발생 지표를 잰다(계절을 타는 이유와 날씨·계절
 * 카드는 같은 씨앗의 겨울 판에서도 잰다). 아직 잴 수 없는 지표는 「대기」로 남긴다.
 * 시뮬레이션은 시각을 숫자(epoch ms)로만 다룬다. 기기 시간대·로캘을 읽지 않는다.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRng } from '../experiences/synk-town/town/rng.mjs';
import * as clock from '../experiences/synk-town/town/clock.mjs';
import * as plan from '../experiences/synk-town/town/plan.mjs';
import * as village from '../experiences/synk-town/town/village.mjs';
import * as cards from '../experiences/synk-town/town/cards.mjs';
import * as knowledge from '../experiences/synk-town/town/knowledge.mjs';
import { paramsFor } from '../experiences/synk-town/town/params.mjs';
import { SPOT_BY_ID, SPOT_GROUPS } from '../experiences/synk-town/town/places.mjs';
import { ROUTINES, CARDS } from '../experiences/synk-town/town/data.gen.mjs';
const cardsById = cards.CARD_BY_ID;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPORT_DIR = path.join(ROOT, 'experiences/synk-town/qa/town-sim');

const MINUTE = 60_000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
/** 2026-10-01T00:00Z. 시작을 고정해 같은 입력이면 같은 결과다. */
export const SIM_START_MS = 1790812800000;
export const TIMEZONES = Object.freeze([540, 480, 420, -300]);
export const PROFILES = Object.freeze(['absent', 'daily-random', 'night-only', 'away-7', 'daily-all']);
/** 내 시각 기준 구간(§4-2). 생활일은 05:00에 시작한다. 값은 생활일 시작부터의 분. */
export const BANDS = Object.freeze([
  { id: 'morning', from: 0, to: 6 * 60 },
  { id: 'day', from: 6 * 60, to: 12 * 60 },
  { id: 'evening', from: 12 * 60, to: 16 * 60 },
  { id: 'night', from: 16 * 60, to: 24 * 60 },
]);
const VISIT_MINUTES = 30;

export const villageSeeds = count => Array.from({ length: count }, (_, i) => `sim-v${String(i + 1).padStart(3, '0')}`);

/** 첫 생활일이 시작하는 순간(내 시각 05:00). */
export function firstLifeDayStart(tzOffsetMin, startMs = SIM_START_MS) {
  const local = startMs + tzOffsetMin * MINUTE;
  const lifeDay = Math.floor((local - 5 * HOUR) / DAY);
  return (lifeDay + 1) * DAY + 5 * HOUR - tzOffsetMin * MINUTE;
}

function visitIn(rng, dayStartMs, band) {
  const span = band.to - band.from - VISIT_MINUTES;
  const from = dayStartMs + (band.from + rng.between(0, span)) * MINUTE;
  return { fromMs: from, toMs: from + VISIT_MINUTES * MINUTE, band: band.id };
}

/** 플레이어 모습별 방문 일정(§15-1). 같은 씨앗·시간대·모습이면 같은 일정이다. */
export function visitPlan(profile, { villageSeed, tzOffsetMin, days, startMs = SIM_START_MS }) {
  if (!PROFILES.includes(profile)) throw new RangeError(`모르는 플레이어 모습: ${profile}`);
  const rng = createRng('town-sim', 'visits', villageSeed, tzOffsetMin, profile);
  const first = firstLifeDayStart(tzOffsetMin, startMs), visits = [];
  for (let day = 0; day < days; day++) {
    const dayStart = first + day * DAY;
    if (profile === 'absent') continue;
    if (profile === 'away-7' && day >= 10 && day < 17) continue;
    // 밤에만 오는 사람은 21:00~00:30 사이에 들어온다(주민이 깨어 있는 밤).
    const band = profile === 'night-only' ? { id: 'night', from: 16 * 60, to: 19 * 60 + 30 } : rng.pick(BANDS);
    visits.push({ lifeDayIndex: day, ...visitIn(rng, dayStart, band), acceptAll: profile === 'daily-all' });
  }
  return visits;
}

/** 런타임이 아직 없을 때의 빈 마을. 묶음이 붙을 때마다 이 자리를 실제 런타임으로 바꾼다. */
export const NULL_RUNTIME = Object.freeze({
  name: 'none',
  createVillage: ({ villageSeed, tzOffsetMin }) => ({ villageSeed, tzOffsetMin, events: [] }),
  visit: () => ({ changes: [] }),
  finish: village => ({ events: village.events.length }),
});

const percent = (n, d) => (d ? Math.round(n / d * 1000) / 10 : 0);
const ROUTINE_SPAN_MIN = 120;

/** 주민의 30생활일(W3~W5): 결산과 같은 길(village.mjs closeBands)로 구간을 하나씩 닫으며 지표에 쓸 것만 줄여 남긴다 — 카드·쌍·전해
 * 듣기가 구간을 넘어 이어진다(W5 검토 F13). 「나와 함께」는 매일 와서 다 받는 모습(accept)만 한다: 방문 안에서 카드가 생기면 1분 뒤 열고
 * 2분 뒤 첫 고르기로 확정하고 1분 뒤 닫는다 — core의 CARD_OPEN·CONFIRM·CLOSE가 마을에 남기는 것(take·주인을 붙잡는 예약·함께한 일
 * 표시·당사자의 앎)과 같다. 명령이 없는 모습은 마을이 같으므로(§15-2) 한 번만 센다. */
function lifeOfVillage({ villageSeed, tzOffsetMin, startMs, days, visits = [] }) {
  const result = { meetableShortMinutes: 0, placeDays: 0, placeShortDays: 0, repeats: 0, orderPairs: 0, sameOrder: 0, rainOutside: 0, segments: 0,
    // W4: 주민마다 깨어 있는 분·기운 문턱 아래 분·문턱 아래로 간 날, 줄이 뜬 이유(주민:이유 → 횟수), 하루 가장 많은 줄, 상한 전 이유가 넷을 넘은 날.
    awakeMinutes: {}, belowMinutes: {}, belowDays: {}, moods: {}, moodsMaxPerDay: 0, reasonsOverCap: 0, residentDays: 0,
    // W5: 카드마다 생긴 수·푼 길, 상한·쿨다운을 넘은 것, 플레이어 없이 「나와 함께」로 끝난 것, 퍼진 플레이어 사건, 하루 들은 것이 넘은 것, 쌍 장면이 넘은 날·내려간 단계.
    rose: {}, solved: {}, playerBy: {}, capOver: 0, cooldownOver: 0, playerPaths: 0, playerSpread: 0, heardOver: 0, scenesOverDays: 0, stepDown: 0, scenes: 0 };
  const P = paramsFor(), v = village.initialVillage();
  let rev = 1;
  const close = nowMs => village.closeBands(v, { nowMs, seed: villageSeed, offsetMin: tzOffsetMin, revision: rev });
  close(startMs);
  const lastOrder = new Map(), linesPerDay = P.state.moodLinesPerDay, endAll = startMs + days * clock.DAY, lastSolved = {};
  for (let day = 0; day < days; day++) {
    const dayStartMs = startMs + day * clock.DAY, daySegments = [], dayBelow = new Set(), dayMoods = {}, dayReasons = {}, roseToday = {};
    let scenesToday = 0;
    while (v.band.startMs < dayStartMs + clock.DAY && v.band.startMs < endAll) {
      const b = v.band;
      // A visit that takes every card it meets (the accept profile): open, choose, confirm, close — at the village's own fields.
      for (const visit of visits.filter(x => x.fromMs < b.endMs && x.toMs > b.startMs)) {
        let t = Math.max(visit.fromMs, b.startMs);
        const until = Math.min(visit.toMs, b.endMs);
        for (;;) {
          const out = village.planOf(v);
          const rise = out.log.find(e => e.atMs >= t && e.atMs + 4 * MINUTE < until && cardsById[e.card].paths.player.ready && !(v.takes || []).some(k => k.card === e.card && k.key === e.key));
          if (!rise) break;
          const open = rise.atMs + MINUTE, card = cardsById[rise.card], by = `card:${card.id}:${rise.key}`;
          if (cards.cardsAt(village.bandInput(v), out.segments, out.log, open).find(c => c.card === card.id)?.status !== 'triggered') { t = rise.atMs + 1; continue; }
          const take = { card: card.id, key: rise.key, at: open, status: 'with', open: true, choice: null };
          v.takes = [...(v.takes || []), take].slice(-P.cards.takesKept);
          const spot = name => SPOT_GROUPS[name]?.[0] ?? name;
          village.holdResidents(v, { [card.owner]: { by, spot: cards.holdSpotOf(card) }, ...Object.fromEntries((card.paths.player.with || []).map(npc => [npc, { by, spot: spot(card.paths.pair.partnerSpot) }])) }, open, ++rev);
          const done = open + 2 * MINUTE, place = cards.placeOfSpot(card.spot), actors = [card.owner, ...(card.paths.player.with || []), 'player'];
          Object.assign(take, { status: 'resolved', resolvedAt: done, ref: cards.cardRef(b.lifeDay, b.band, card.id), choice: card.paths.player.choices[0] });
          for (const r of v.reservations) if (r.by === by && r.toMs === null) r.with = true;
          knowledge.learnPrivate(v, { ref: take.ref, card: card.id, path: 'player', actors, place });
          take.open = false;
          village.holdResidents(v, {}, done + MINUTE, ++rev);
          t = done + MINUTE;
        }
      }
      const out = village.planOf(v), before = residentsOf(v);
      daySegments.push(...out.segments);
      // 기운은 구간 시작 값에 변화 기록을 시각 차례로 더해, 결정 시각마다(조각을 놓기 전) 문턱 아래였던 시간을 센다.
      for (const npc of plan.RESIDENT_IDS) {
        const log = out.stateLog.filter(e => e.npc === npc && e.stat === 'energy'), threshold = plan.RESIDENT_BY_ID[npc].restThreshold;
        let energy = before[npc]?.energy ?? P.state.wakeEnergy, i = 0;
        for (const s of out.segments.filter(x => x.npc === npc)) {
          // A merged segment is decided once a piece: each piece counts from its own decision time (review GA3).
          const pieces = s.pieceStarts ?? [s.startMs];
          pieces.forEach((at, k) => {
            const minutes = ((pieces[k + 1] ?? s.endMs) - at) / clock.MINUTE;
            while (i < log.length && log[i].atMs < at) energy += log[i++].delta;
            result.awakeMinutes[npc] = (result.awakeMinutes[npc] || 0) + minutes;
            if (energy < threshold) { result.belowMinutes[npc] = (result.belowMinutes[npc] || 0) + minutes; dayBelow.add(npc); }
          });
          if (s.reason) (dayReasons[npc] ||= new Set()).add(s.reason);
          if (s.mood) { (dayMoods[npc] ||= []).push(s.reason); result.moods[`${npc}:${s.reason}`] = (result.moods[`${npc}:${s.reason}`] || 0) + 1; }
        }
        const order = out.segments.filter(s => s.npc === npc).map(s => s.archetype).join(',');
        const key = `${npc}|${b.band}`;
        if (lastOrder.has(key) && order) { result.orderPairs++; if (lastOrder.get(key) === order) result.sameOrder++; }
        lastOrder.set(key, order);
      }
      // W5: what rose and how it was solved; the caps and the rests (§15-1 카드).
      for (const e of out.log) {
        result.rose[e.card] = (result.rose[e.card] || 0) + 1;
        (roseToday[e.npc] ||= []).push(e.card);
        if (lastSolved[e.card] !== undefined && b.lifeDay < lastSolved[e.card] + cardsById[e.card].cooldownLifeDays) result.cooldownOver++;
      }
      for (const line of out.resolved) {
        result.solved[`${line.card}:${line.path}`] = (result.solved[`${line.card}:${line.path}`] || 0) + 1;
        lastSolved[line.card] = b.lifeDay;
        if (line.path === 'player') { result.playerPaths++; for (const npc of line.actors) result.playerBy[npc] = (result.playerBy[npc] || 0) + 1; }
      }
      scenesToday += out.scenes.length; result.scenes += out.scenes.length;
      const steps = Object.fromEntries(Object.entries(b.pairs || {}).map(([key, s]) => [key, s.friction.step]));
      close(b.endMs);
      for (const [key, step] of Object.entries(steps)) if ((v.band.pairs?.[key]?.friction.step ?? 0) < step) result.stepDown++;
      // Nothing the player took part in spreads (G6), and no one hears more than a few things a day (§9-3).
      for (const list of Object.values(v.knowledge?.known || {})) result.playerSpread += list.filter(e => e.path === 'player' && e.how !== 'private').length;
      result.playerSpread += (v.news || []).filter(n => n.path === 'player').length;
      if (Object.values(v.knowledge?.heard || {}).some(n => n > P.knowledge.heardPerDay)) result.heardOver++;
    }
    if (scenesToday > P.pairs.scenesPerDay) result.scenesOverDays++;
    const all = Object.values(roseToday).flat();
    if (all.length > P.cards.perVillage || Object.values(roseToday).some(list => list.length > P.cards.perResident)) result.capOver++;
    result.segments += daySegments.length;
    for (const npc of plan.RESIDENT_IDS) {
      result.residentDays++;
      if (dayBelow.has(npc)) result.belowDays[npc] = (result.belowDays[npc] || 0) + 1;
      result.moodsMaxPerDay = Math.max(result.moodsMaxPerDay, (dayMoods[npc] || []).length);
      if ((dayReasons[npc]?.size || 0) > linesPerDay) result.reasonsOverCap++;
    }
    // 만날 수 있는 시각 05:30~23:30(§4-2): 분마다 깨어 있는 주민 수.
    const awake = new Uint8Array(24 * 60);
    for (const npc of plan.RESIDENT_IDS) {
      const mine = new Uint8Array(24 * 60);
      for (const s of daySegments) if (s.npc === npc) {
        for (let m = Math.max(0, Math.ceil((s.startMs - dayStartMs) / clock.MINUTE)); m < Math.min(24 * 60, Math.ceil((s.endMs - dayStartMs) / clock.MINUTE)); m++) mine[m] = 1;
      }
      for (let m = 0; m < 24 * 60; m++) awake[m] += mine[m];
    }
    for (let minute = 30; minute < 18 * 60 + 30; minute++) if (awake[minute] < 2) result.meetableShortMinutes++;
    for (const npc of plan.RESIDENT_IDS) {
      const mine = daySegments.filter(s => s.npc === npc);
      result.placeDays++;
      if (new Set(mine.map(s => SPOT_BY_ID[s.spot].place)).size < 3) result.placeShortDays++;
      for (let i = 1; i < mine.length; i++) {
        const kind = plan.ARCHETYPE_BY_ID[mine[i].archetype]?.kind;
        // The same work at the same spot across a band edge, moved under cover by rain, or a neighbour's call (a card's
        // pair, a chat — the neighbour's decision, not its own) is not a repeat.
        if (kind !== 'rest' && !mine[i].moved && !mine[i].cardRole && !mine[i].joined && mine[i].archetype === mine[i - 1].archetype
          && mine[i].startMs === mine[i - 1].endMs && mine[i].spot !== mine[i - 1].spot) result.repeats++;
      }
      for (const s of mine) if (!SPOT_BY_ID[s.spot].sheltered && s.arriveMs < s.endMs && clock.rainBetween(villageSeed, s.arriveMs, s.endMs)) result.rainOutside++;
    }
  }
  return result;
}
const residentsOf = v => v.band.residents;

/** 일과표 칸마다 활동 수(데이터 검사, §6-2). 깨어 있는 시간이 두 시간보다 짧은 칸(공방 주인의 밤 마무리 30분 같은)은 뺀다. */
function routineVariety() {
  const short = [];
  for (const cell of ROUTINES) {
    const resident = plan.RESIDENT_BY_ID[cell.npc], band = clock.BANDS.find(b => b.id === cell.band);
    const wake = cell.dayKind === 'off' && resident.wake.off !== undefined ? resident.wake.off : resident.wake.default;
    const awake = Math.min(band.to, resident.sleep) - Math.max(band.from, wake);
    const kinds = new Set(cell.pool.map(item => item.archetype));
    if (awake >= ROUTINE_SPAN_MIN && kinds.size < 3) short.push(`${cell.npc}|${cell.dayKind}|${cell.band}`);
  }
  return short;
}

/** 이유마다 「살아 있는」 마을 몫의 기준(§15-1 죽은 이유 0, 검토 P3-3): 마을(씨앗·시간대)마다 30일에 한 번 이상 뜬 비율. */
export const MOOD_ALIVE_SHARE = 0.75;
/** 카드마다 「살아 있는」 마을 몫(§15-1 카드 발생, W5 §2-10): 30일에 한 번 이상 생긴 마을의 비율. 비가 시작·그치는 순간에 서는 카드는
 * 그 계절의 날씨가 주는 만큼만 선다(가을 한 달에 마을마다 깨어 있는 동안 비가 시작되는 때는 서너 번) — 그 계절 판에서 절반 이상을 본다. */
export const CARD_ALIVE_SHARE = 0.9, RAIN_CARD_ALIVE_SHARE = 0.5;
/** 「나와 함께」 뒤의 이유는 그 주민과 함께한 마을에서 잰다 — 원래 하려던 일과 같으면 줄이 없으니(§7-3 귀속) 절반 이상을 본다. */
export const WITH_PLAYER_ALIVE_SHARE = 0.5;
/** 계절을 타는 날씨 이유(§7-3 cold-hands: 쌀쌀한 아침 = 비 오는 아침·겨울 아침)는 겨울 판(1월 1일 시작)에서도 잰다. */
export const WINTER_START_MS = 1798761600000; // 2027-01-01T00:00Z
/** 비가 가장 잦은 여름 판(7월 1일 시작) — 날씨 순간 카드를 그 계절로도 잰다. */
export const SUMMER_START_MS = 1814400000000; // 2027-07-01T00:00Z
/** 마음 표의 이유(주민:이유) — W4가 켠 것과 W5의 카드·이웃 일·밤샘 이유. */
export const MOOD_REASONS = Object.freeze(plan.RESIDENT_IDS.flatMap(npc => [...new Set(plan.RESIDENT_BY_ID[npc].moods.map(m => `${npc}:${m.tag}`))]));
/** 날씨·계절 카드(비 시작·비 그침·비 갠 뒤·계절의 잎)는 겨울 판에서도 잰다(§2-10 「날씨·계절 카드는 계절을 따로」). */
const SEASONAL = new Set(CARDS.filter(c => ['rain-start', 'rain-stop', 'after-rain', 'season-leaf'].includes(c.trigger.kind)).map(c => c.id));
const RAIN_MOMENT = new Set(CARDS.filter(c => ['rain-start', 'rain-stop', 'after-rain'].includes(c.trigger.kind)).map(c => c.id));
/** 「나와 함께」로만 나오는 이유는 매일 와서 다 받는 모습에서 잰다. */
const WITH_PLAYER = new Set(['with-player-glad']);

export const TOWN_RUNTIME = Object.freeze({
  name: 'town-w5',
  cache: new Map(),
  life(args, accept = false) {
    const key = `${args.villageSeed}|${args.tzOffsetMin}|${args.startMs}|${args.days}|${accept}`;
    if (!this.cache.has(key)) this.cache.set(key, lifeOfVillage({ ...args, visits: accept ? args.visits : [] }));
    return this.cache.get(key);
  },
  createVillage(args) { return { args, visits: [] }; },
  visit(village, visit) { village.visits.push(visit); return { changes: [] }; },
  // A profile that never takes a card leaves the village as absence does (§15-2): one life for all of them.
  finish(village) { const accept = village.args.profile === 'daily-all'; return this.life({ ...village.args, visits: village.visits }, accept); },
  measure(id, run) {
    const lives = [...new Map(run.villages.map(v => [`${v.villageSeed}|${v.tzOffsetMin}|${v.profile === 'daily-all'}`, v.result])).values()];
    const plain = [...new Map(run.villages.filter(v => v.profile !== 'daily-all').map(v => [`${v.villageSeed}|${v.tzOffsetMin}`, v.result])).values()];
    const accept = [...new Map(run.villages.filter(v => v.profile === 'daily-all').map(v => [`${v.villageSeed}|${v.tzOffsetMin}`, v.result])).values()];
    const sum = (key, list = lives) => list.reduce((n, life) => n + life[key], 0);
    const per = (key, npc) => lives.reduce((n, life) => n + (life[key][npc] || 0), 0);
    const season = startOf => [...new Set(run.villages.map(v => v.villageSeed))].map(villageSeed => this.life({ villageSeed, tzOffsetMin: run.timezones[0],
      startMs: firstLifeDayStart(run.timezones[0], startOf), days: run.days }));
    const winter = () => season(WINTER_START_MS);
    if (id === 'energy') {
      const rows = plan.RESIDENT_IDS.map(npc => ({ npc, share: per('belowMinutes', npc) / Math.max(1, per('awakeMinutes', npc)), week: per('belowDays', npc) / (lives.length * run.days) * 7 }));
      const ok = rows.every(r => r.share <= 0.15);
      return { status: ok ? 'pass' : 'fail', value: rows.map(r => `${plan.RESIDENT_BY_ID[r.npc].label} ${percent(r.share * 1000, 1000)}%·주 ${r.week.toFixed(1)}일`).join(' · ') };
    }
    if (id === 'mood-lines') {
      // 겨울 판: 같은 씨앗을 첫 시간대에서 1월부터 — 계절을 타는 이유는 두 판 가운데 하나에서 뜨면 산 것으로 본다.
      const cold = winter();
      const alive = MOOD_REASONS.map(key => {
        const among = list => list.filter(life => life.moods[key]).length / Math.max(1, list.length);
        // A reason only a card done with the player brings is counted where that resident did one (§7-3 with-player-glad).
        const [npc, tag] = key.split(':');
        return { key, share: WITH_PLAYER.has(tag) ? among(accept.filter(life => life.playerBy[npc])) : Math.max(among(plain), among(cold)), bar: WITH_PLAYER.has(tag) ? WITH_PLAYER_ALIVE_SHARE : MOOD_ALIVE_SHARE };
      });
      const dead = alive.filter(a => a.share < a.bar), maxPerDay = Math.max(...lives.map(l => l.moodsMaxPerDay), ...cold.map(l => l.moodsMaxPerDay));
      const overCap = sum('reasonsOverCap') / Math.max(1, sum('residentDays'));
      const ok = !dead.length && maxPerDay <= paramsFor().state.moodLinesPerDay && overCap <= 0.01;
      return { status: ok ? 'pass' : 'fail', value: `가장 드문 이유 ${alive.sort((a, b) => a.share - b.share).slice(0, 2).map(a => `${a.key} ${Math.round(a.share * 100)}%`).join('·')} · 하루 최대 ${maxPerDay}줄 · 상한 전 넷 넘은 날 ${percent(overCap * 1000, 1000)}%`,
        detail: dead.map(a => `${a.key} ${Math.round(a.share * 100)}%`).join(', ') };
    }
    if (id === 'cards') {
      const ok = sum('capOver') === 0 && sum('cooldownOver') === 0 && sum('playerPaths', plain) === 0 && sum('playerPaths', accept) > 0;
      return { status: ok ? 'pass' : 'fail', value: `상한 넘김 ${sum('capOver')} · 쿨다운 넘김 ${sum('cooldownOver')} · 플레이어 없이 나와 함께 ${sum('playerPaths', plain)} · 다 받는 모습의 나와 함께 ${sum('playerPaths', accept)}` };
    }
    if (id === 'hearsay') return { status: sum('playerSpread') === 0 && sum('heardOver') === 0 ? 'pass' : 'fail', value: `퍼진 플레이어 사건 ${sum('playerSpread')} · 하루 들은 것 넘김 ${sum('heardOver')}` };
    if (id === 'pairs') {
      const ok = sum('scenesOverDays') === 0 && sum('stepDown') === 0 && sum('scenes') > 0;
      return { status: ok ? 'pass' : 'fail', value: `쌍 장면 넘은 날 ${sum('scenesOverDays')} · 내려간 단계 ${sum('stepDown')} · 마을 하루 쌍 장면 ${(sum('scenes') / Math.max(1, lives.length * run.days)).toFixed(1)}` };
    }
    if (id === 'card-coverage') {
      // C4 waits for its scene (W9): its first rise is the player's, so it is not counted here.
      const cold = winter(), warm = season(SUMMER_START_MS), live = cards.CARD_IDS.filter(card => !cardsById[card].locked).map(card => {
        const among = list => list.filter(life => life.rose[card]).length / Math.max(1, list.length);
        return { card, share: SEASONAL.has(card) ? Math.max(among(plain), among(cold), among(warm)) : among(plain), bar: RAIN_MOMENT.has(card) ? RAIN_CARD_ALIVE_SHARE : CARD_ALIVE_SHARE };
      });
      const dead = live.filter(c => c.share < c.bar);
      return { status: dead.length ? 'fail' : 'pass', value: `가장 드문 카드 ${live.sort((a, b) => a.share - b.share).slice(0, 3).map(c => `${c.card} ${Math.round(c.share * 100)}%`).join('·')} · C4는 W9`,
        detail: dead.map(c => `${c.card} ${Math.round(c.share * 100)}%`).join(', ') };
    }
    if (id === 'meetable-residents') return { status: sum('meetableShortMinutes') === 0 ? 'pass' : 'fail', value: `둘 미만인 분 ${sum('meetableShortMinutes')}` };
    if (id === 'places-per-day') return { status: sum('placeShortDays') === 0 ? 'pass' : 'fail', value: `셋 미만 ${sum('placeShortDays')}/${sum('placeDays')}(${percent(sum('placeShortDays'), sum('placeDays'))}%)` };
    if (id === 'routine-variety') { const short = routineVariety(); return { status: short.length ? 'fail' : 'pass', value: short.length ? short.join(' · ') : '모든 칸 셋 이상', detail: short.join(', ') }; }
    if (id === 'repetition') {
      const ok = sum('repeats') === 0 && sum('sameOrder') <= sum('orderPairs') * 0.1;
      return { status: ok ? 'pass' : 'fail', value: `바로 이은 반복 ${sum('repeats')} · 이틀 같은 순서 ${percent(sum('sameOrder'), sum('orderPairs'))}%` };
    }
    if (id === 'rain-outside') return { status: sum('rainOutside') === 0 ? 'pass' : 'fail', value: `비 맞은 바깥 조각 ${sum('rainOutside')}` };
    return undefined;
  },
});

/** 지표(§15-1). 런타임이 runtime.measure(id, run) → { status: 'pass' | 'fail', value?, detail? }로 잰다.
 * 런타임이 아직 재지 못하는 지표는 「대기」다. */
export const METRICS = Object.freeze([
  ['meetable-residents', '만날 수 있는 주민 수 — 05:30~23:30 모든 분에 둘 이상'],
  ['places-per-day', '주민별 하루 장소 수 셋 이상'],
  ['routine-variety', '일과표 칸의 활동 수 셋 이상'],
  ['visible-change', '30분 방문당 눈에 띄는 변화 — 하나 이상 95%, 평균 둘 이상'],
  ['repetition', '같은 행동 반복 — 바로 이은 같은 원형 0, 이틀 같은 순서 10% 이하'],
  ['cards', '카드 상한·쿨다운·마모 주인'],
  ['hearsay', '전해 듣기 — 플레이어 사건 0, 주민당 생활일 2건 이하'],
  ['pairs', '쌍 장면 생활일 셋 이하, 의견 차이 내려감 0'],
  ['changes-summary', '그동안 달라진 것 1~3줄, 금지 말 0'],
  ['rain-outside', '비 오는 동안 바깥 자리에 앉은 주민 0'],
  ['energy', '기운 문턱 아래 시간 15% 이하'],
  ['mood-lines', '이유 태그마다 30일에 한 번 이상, 하루 넷 이하'],
  ['card-coverage', '18장 모두 30일에 한 번 이상, 첫 C4는 플레이어 몫'],
].map(([id, label]) => Object.freeze({ id, label })));

export function canonicalJson(value) {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : item);
}
export const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');

export function runSimulation({ seeds = 100, days = 30, timezones = TIMEZONES, profiles = PROFILES, runtime = TOWN_RUNTIME, startMs = SIM_START_MS } = {}) {
  if (!Number.isSafeInteger(seeds) || seeds < 1 || !Number.isSafeInteger(days) || days < 1) throw new RangeError('seeds·days는 1 이상의 정수예요.');
  const villages = [];
  for (const villageSeed of villageSeeds(seeds)) for (const tzOffsetMin of timezones) for (const profile of profiles) {
    // The profile that takes every card is measured in the first time zone: what it shows (cards with the player, their
    // gladness, what stays private) does not turn on the zone, and every other profile already runs in all four (W5).
    if (profile === 'daily-all' && tzOffsetMin !== timezones[0]) continue;
    const visits = visitPlan(profile, { villageSeed, tzOffsetMin, days, startMs });
    const village = runtime.createVillage({ villageSeed, tzOffsetMin, profile, startMs: firstLifeDayStart(tzOffsetMin, startMs), days });
    const observed = visits.map(visit => ({ ...visit, ...runtime.visit(village, visit) }));
    villages.push({ villageSeed, tzOffsetMin, profile, visits: observed, result: runtime.finish(village) });
  }
  const run = { runtime: runtime.name, seeds, days, timezones: [...timezones], profiles: [...profiles], villages };
  const metrics = METRICS.map(metric => ({ id: metric.id, label: metric.label, ...(runtime.measure?.(metric.id, run) ?? { status: 'pending' }) }));
  const hash = sha256(canonicalJson({ villages, metrics }));
  return { ...run, metrics, hash };
}

export function summarize(result) {
  const count = status => result.metrics.filter(m => m.status === status).length;
  return { runtime: result.runtime, villages: result.villages.length, visits: result.villages.reduce((n, v) => n + v.visits.length, 0),
    pass: count('pass'), fail: count('fail'), pending: count('pending'), hash: result.hash };
}

function report(result) {
  const s = summarize(result);
  const rows = result.metrics.map(m => `| ${m.label} | ${{ pass: '통과', fail: '실패', pending: '대기' }[m.status]} | ${m.value ?? ''} |`);
  return [`# 싱크타운 시뮬레이션 보고서`, '', `런타임 ${s.runtime} · 마을 씨앗 ${result.seeds} × 시간대 ${result.timezones.length} × 플레이어 모습 ${result.profiles.length} = ${s.villages}개 마을 · ${result.days}생활일 · 방문 ${s.visits}번`,
    `결과 해시 \`${s.hash}\``, '', '| 지표 | 판정 | 값 |', '|---|---|---|', ...rows, ''].join('\n');
}

function option(name, fallback) {
  const at = process.argv.indexOf(name);
  if (at < 0) return fallback;
  const value = Number(process.argv[at + 1]);
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${name} 뒤에는 1 이상의 정수를 적어요.`);
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const started = performance.now();
  const result = runSimulation({ seeds: option('--seeds', 100), days: option('--days', 30) });
  if (process.argv.includes('--hash')) {
    // tzName shows which time zone this process really ran in (the result must not depend on it).
    console.log(JSON.stringify({ hash: result.hash, tzName: Intl.DateTimeFormat().resolvedOptions().timeZone }));
  } else {
    const s = summarize(result), ms = Math.round(performance.now() - started);
    console.log(`싱크타운 시뮬레이션: 마을 ${s.villages}개 · 방문 ${s.visits}번 · 통과 ${s.pass} · 실패 ${s.fail} · 대기 ${s.pending} · ${ms}ms · ${s.hash.slice(0, 12)}`);
    for (const m of result.metrics.filter(m => m.status === 'fail')) console.log(`- 실패: ${m.label}${m.detail ? ` — ${m.detail}` : ''}`);
    if (process.argv.includes('--report')) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
      fs.writeFileSync(path.join(REPORT_DIR, 'report.md'), report(result));
      fs.writeFileSync(path.join(REPORT_DIR, 'report.json'), `${JSON.stringify({ summary: s, metrics: result.metrics }, null, 2)}\n`);
      console.log(`보고서: ${path.relative(ROOT, REPORT_DIR)}`);
    }
    if (s.fail) process.exitCode = 1;
  }
}
