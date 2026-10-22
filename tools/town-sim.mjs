#!/usr/bin/env node
/** 싱크타운 결정적 시뮬레이션 — 찻집 골목의 하루 세로 조각 설계 §15-1.
 *
 *   node tools/town-sim.mjs --check              씨앗 100 × 30생활일을 돌려 기준을 본다(실패가 있으면 종료 1, CI)
 *   node tools/town-sim.mjs --report             같은 실행의 보고서를 experiences/synk-town/qa/town-sim/에 쓴다
 *   node tools/town-sim.mjs --hash               결과 해시만 낸다(시간대를 바꿔 돌려 견주는 데 쓴다, §15-3)
 *   --seeds N · --days N                         규모를 바꾼다(시험은 씨앗 12)
 *
 * 마을 씨앗 × 시간대 넷(UTC+9·+8·+7·−5) × 플레이어 모습 다섯을 돈다. 런타임은 묶음마다 자란다 — 지금(W3)은 계획기로
 * 주민 일과를 짜서 두 주민·장소·반복·비 지표를 잰다. 아직 잴 수 없는 지표는 「대기」로 남긴다.
 * 시뮬레이션은 시각을 숫자(epoch ms)로만 다룬다. 기기 시간대·로캘을 읽지 않는다.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRng } from '../experiences/synk-town/town/rng.mjs';
import * as clock from '../experiences/synk-town/town/clock.mjs';
import * as plan from '../experiences/synk-town/town/plan.mjs';
import { SPOT_BY_ID } from '../experiences/synk-town/town/places.mjs';
import { ROUTINES } from '../experiences/synk-town/town/data.gen.mjs';

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

/** 주민 일과(W3): 계획기로 30생활일을 짜고 지표에 쓸 것만 줄여 남긴다. 주민의 하루는 아직 플레이어와 상관없어
 * (W5·W6에서 달라진다) 마을 씨앗 × 시간대마다 한 번 계산해 플레이어 모습끼리 나눠 쓴다. */
function lifeOfVillage({ villageSeed, tzOffsetMin, startMs, days }) {
  const result = { meetableShortMinutes: 0, placeDays: 0, placeShortDays: 0, repeats: 0, orderPairs: 0, sameOrder: 0, rainOutside: 0, segments: 0 };
  let residents = {}, objects = { 'cafe-tray': { spot: 'cafe.prep' }, 'observation-board': { spot: 'greenhouse.board' } };
  const lastOrder = new Map();
  for (let day = 0; day < days; day++) {
    const dayStartMs = startMs + day * clock.DAY, lifeDay = clock.lifeDayAt(tzOffsetMin, dayStartMs);
    residents = Object.fromEntries(Object.entries(residents).map(([npc, r]) => [npc, { ...r, placesToday: [], firstOfDay: true }]));
    const daySegments = [];
    for (const w of clock.bandsBetween(tzOffsetMin, dayStartMs, dayStartMs + clock.DAY)) {
      const out = plan.planBand({ villageSeed, lifeDay, band: w.band, startMs: w.startMs, endMs: w.endMs, dayStartMs, planCmdRev: 0,
        weatherAt: ms => clock.weatherAt(villageSeed, ms), weatherTomorrow: clock.clockAt({ villageSeed, hostNowMs: w.startMs, tz: tzOffsetMin }).weatherTomorrow,
        season: clock.clockAt({ villageSeed, hostNowMs: w.startMs, tz: tzOffsetMin }).season, residents, objects });
      residents = out.residents; objects = out.objects;
      daySegments.push(...out.segments);
      for (const npc of plan.RESIDENT_IDS) {
        const order = out.segments.filter(s => s.npc === npc).map(s => s.archetype).join(',');
        const key = `${npc}|${w.band}`;
        if (lastOrder.has(key) && order) { result.orderPairs++; if (lastOrder.get(key) === order) result.sameOrder++; }
        lastOrder.set(key, order);
      }
    }
    result.segments += daySegments.length;
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
        // The same work at the same spot across a band edge, or moved under cover by rain, is one activity.
        if (kind !== 'rest' && !mine[i].moved && mine[i].archetype === mine[i - 1].archetype && mine[i].startMs === mine[i - 1].endMs && mine[i].spot !== mine[i - 1].spot) result.repeats++;
      }
      for (const s of mine) if (!SPOT_BY_ID[s.spot].sheltered && s.arriveMs < s.endMs && clock.rainBetween(villageSeed, s.arriveMs, s.endMs)) result.rainOutside++;
    }
  }
  return result;
}

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

export const TOWN_RUNTIME = Object.freeze({
  name: 'town-w3',
  cache: new Map(),
  createVillage(args) {
    const key = `${args.villageSeed}|${args.tzOffsetMin}|${args.startMs}|${args.days}`;
    if (!this.cache.has(key)) this.cache.set(key, lifeOfVillage(args));
    return { life: this.cache.get(key) };
  },
  visit: () => ({ changes: [] }),
  finish: village => village.life,
  measure(id, run) {
    const lives = [...new Map(run.villages.map(v => [`${v.villageSeed}|${v.tzOffsetMin}`, v.result])).values()];
    const sum = key => lives.reduce((n, life) => n + life[key], 0);
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
