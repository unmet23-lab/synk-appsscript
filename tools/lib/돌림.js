'use strict';
/* 돌림표 셈(2026-11-10 LAB 하루 두 편 · 39계정 — 설계 2 · 3, docs/마케팅/LAB_하루두편_설계_20261110/README.md). 읽기만 한다.
 *
 * 원본은 매일 이야기 1편 · 퀴즈 1편이고, 계정마다 날짜를 어긋나게 돌린다(유호님 11-10 「국가별 계정마다 5일치 영상을 동일한걸
 * 업로드하는게 아니라 순서를 뒤죽박죽으로」). 지키는 것:
 *   ① 같은 플랫폼에서 같은 원본은 20시간 안에 두 번 나가지 않는다(⑫ — 10-26 「글자만 다른 거의 같은 영상이 같은 날 두 계정에」).
 *      시간대가 25개라 「같은 날」을 한국 날짜로 보면 멕시코 저녁 판과 몽골 다음 날 아침 판(10시간 차이)이 다른 날로 빠져나가고,
 *      24시간으로 보면 이웃 시간대의 이틀 잇단 13:00 판(21~23시간)까지 막혀 틱톡 다섯 곳도 못 채운다 — 그래서 20시간(11-10 Claude).
 *      유튜브만 언어가 다른 판은 같은 날 여러 채널에 갈 수 있고(한 원본이 하루 다섯 채널까지), 같은 언어 판은 20시간 안에 둘이 안 된다.
 *   ② 씨앗 먼저: 원본은 씨앗 계정(sns-계정.json rotationSeed)이 먼저 올리고, 다른 계정은 씨앗 첫 판에서 24시간 넘게 지난 뒤(14시 점검 때 씨앗의 24시간 숫자가 있게)
 *      첫 한국 시각 14시(14시 게시 회차의 비상 정지 점검 — 설계 3) 뒤 칸에만 잇는다.
 *   ③ 한 계정은 같은 원본을 두 번 올리지 않는다. 칸 형식(dailyFormats — 13:00 이야기 · 21:00 퀴즈)이 원본 형식과 같아야 한다.
 *   ④ 순서 섞기: 계정마다 가장 오래 기다린 원본 다섯(창) 가운데서 계정 이름으로 정한 순서(같은 입력이면 늘 같은 표)로 고르고,
 *      한 플랫폼 · 한 날 · 한 형식 칸들은 맞물림(증가 경로)으로 가장 많이 채운다 — 원본이 모자라면 빈 칸이 남는다
 *      (틱톡 7곳은 원본 7편이 쌓이기 전까지 다 못 채운다).
 *   ⑤ 멈춘 원본(돌림.멈춤)은 쓰지 않고, 예비편(돌림.예비)은 useSpares일 때만 쓴다(설계 21).
 */
const crypto = require('node:crypto');
const T = require('./계정시간.js');

const DEFAULTS = Object.freeze({ followHours: 24, checkTime: '14:00', checkZone: 'Asia/Seoul', apartHours: 20, youtubeCap: 5, window: 5 });
const HOUR = 3600000;

function addDays(day, n) {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const hashOf = (text) => crypto.createHash('sha256').update(text).digest('hex');

// 씨앗 첫 판 뒤 다른 계정이 이을 수 있는 가장 이른 때 — 24시간 뒤의 첫 한국 시각 14시(점검 때 씨앗의 24시간 숫자가 있어야 한다).
function checkpointOf(seedMs, cfg = DEFAULTS) {
  const after = seedMs + cfg.followHours * HOUR;
  const day = T.localDate(after, cfg.checkZone);
  let at = T.zonedMs(day, cfg.checkTime, cfg.checkZone);
  if (at < after) at = T.zonedMs(addDays(day, 1), cfg.checkTime, cfg.checkZone);
  return at;
}

// 원본 o를 계정 a의 칸(ms)에 둘 때 같은 플랫폼의 다른 판과 부딪히는지. 유튜브는 같은 언어 판만 부딪힌다.
function clashes(plates, account, ms, cfg) {
  return plates.some((p) => p.platform === account.platform && Math.abs(p.ms - ms) < cfg.apartHours * HOUR
    && (account.platform !== 'youtube' || (p.language || null) === (account.language || null)));
}

/**
 * plan({ accounts, originals, existing, from, days, cfg, useSpares })
 *   accounts: { key: { platform, language, versionKey, timeZone, dailyTimes, dailyFormats, dailyFrom, dailyTimesFrom, seed, blocked } }
 *   originals: [{ id, format, stopped, spare, readyFrom, versions: { <versionKey>: { ready: true } } }]
 *   existing: [{ original, account, time(ISO), fixed }] — 이미 있는 판(예약 · 게시 · 만든 사람이 단 판 · 지난 돌림 판)
 *   → { cells: [{ account, day, slot, format, time, ms, original|null, why|null }], seeds: { id: ms } }
 * existing에는 원본이 아닌 편의 판도 넣는다(original: null) — 그 칸은 이미 찼다.
 */
function plan({ accounts, originals, existing = [], from, days = 5, cfg: given = {}, useSpares = false }) {
  const cfg = { ...DEFAULTS, ...given };
  const byId = new Map(originals.map((o) => [o.id, o]));
  const platesOf = new Map(originals.map((o) => [o.id, []])); // 원본마다 판(ms · 플랫폼 · 언어)
  const posted = new Map(Object.keys(accounts).map((k) => [k, new Set()]));
  const occupied = new Set(); // `${account}|${day}|${slot time}`
  const seeds = {};
  const note = (originalId, key, ms) => {
    const a = accounts[key];
    if (!a || !platesOf.has(originalId)) return;
    platesOf.get(originalId).push({ account: key, platform: a.platform, language: a.language || null, ms });
    posted.get(key)?.add(originalId);
    if (a.seed && (seeds[originalId] === undefined || ms < seeds[originalId])) seeds[originalId] = ms;
  };
  for (const p of existing) {
    const a = accounts[p.account];
    const ms = Date.parse(p.time || '');
    if (!a || !Number.isFinite(ms)) continue;
    const day = T.localDate(ms, T.tzOf(a));
    const slot = T.slotFor(p.time, a);
    occupied.add(`${p.account}|${day}|${slot.time}`);
    if (p.original) note(p.original, p.account, ms);
  }
  // 원본마다 기다린 순서(씨앗 첫 판 · 쓸 수 있게 된 날 · 이름) — 오래 기다린 것부터 창에 든다.
  const ageOf = (o) => seeds[o.id] ?? (o.readyFrom ? Date.parse(o.readyFrom + 'T00:00:00Z') : Infinity);

  const cells = [];
  const range = Array.from({ length: days }, (_, k) => addDays(from, k));
  for (const day of range) {
    // 플랫폼 · 형식마다 한 무리(같은 현지 날짜의 칸들)
    const groups = new Map();
    for (const [key, a] of Object.entries(accounts)) {
      if (a.blocked) continue;
      for (const slot of T.slotsOn(a, day)) {
        if (!slot.time || !slot.format) continue;
        const ms = T.zonedMs(day, slot.time, T.tzOf(a));
        const cell = { account: key, day, slot: slot.time, format: slot.format, time: T.isoAt(ms, T.tzOf(a)), ms, original: null, why: null };
        if (occupied.has(`${key}|${day}|${slot.time}`)) { cell.why = '이미 찬 칸'; cell.taken = true; cells.push(cell); continue; }
        const g = `${a.platform}|${slot.format}`;
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(cell);
        cells.push(cell);
      }
    }
    // 씨앗 무리를 먼저(씨앗 첫 판이 그날 정해져야 같은 원본의 다른 판 셈이 맞다) — 플랫폼 이름으로 고정 순서.
    const ordered = [...groups.entries()].sort(([x, xs], [y, ys]) => Number(ys.some((c) => accounts[c.account].seed)) - Number(xs.some((c) => accounts[c.account].seed)) || x.localeCompare(y));
    for (const [, list] of ordered) {
      const platform = accounts[list[0].account].platform;
      const cap = platform === 'youtube' ? cfg.youtubeCap : 1;
      const cand = new Map();
      for (const cell of list) {
        const a = accounts[cell.account];
        const ok = originals.filter((o) => {
          if (o.format !== cell.format || o.stopped || (o.spare && !useSpares)) return false;
          if (!o.versions?.[a.versionKey]?.ready) return false;
          if (o.readyFrom && cell.day < o.readyFrom) return false;
          if (posted.get(cell.account).has(o.id)) return false;
          if (!a.seed) {
            const seed = seeds[o.id];
            if (seed === undefined || cell.ms < checkpointOf(seed, cfg)) return false;
          }
          return !clashes(platesOf.get(o.id), a, cell.ms, cfg);
        });
        ok.sort((x, y) => ageOf(x) - ageOf(y) || x.id.localeCompare(y.id));
        const win = ok.slice(0, cfg.window).sort((x, y) => hashOf(`${cell.account}|${x.id}`).localeCompare(hashOf(`${cell.account}|${y.id}`)));
        cand.set(cell, [...win, ...ok.slice(cfg.window)].map((o) => o.id));
        if (!ok.length) cell.why = whyEmpty(cell, a, originals, posted.get(cell.account), seeds, cfg, useSpares);
      }
      match(list, cand, cap, accounts, platform);
      for (const cell of list) if (cell.original) { cell.why = null; note(cell.original, cell.account, cell.ms); }
        else if (!cell.why) cell.why = '같은 플랫폼에서 원본이 겹침(원본 모자람)';
    }
  }
  return { cells, seeds, range, byId };
}

// 한 무리 안 맞물림 — 원본마다 칸 cap개(유튜브는 언어가 다른 칸만), 증가 경로로 가장 많이 채운다.
function match(list, cand, cap, accounts, platform) {
  const holders = new Map(); // 원본 → 그 원본을 받은 칸들
  const fits = (o, cell, without = null) => {
    const held = (holders.get(o) || []).filter((c) => c !== without);
    if (held.length >= cap) return false;
    if (platform === 'youtube') return !held.some((c) => (accounts[c.account].language || null) === (accounts[cell.account].language || null));
    return true;
  };
  const take = (cell, o) => { cell.original = o; holders.set(o, [...(holders.get(o) || []), cell]); };
  const drop = (cell) => { holders.set(cell.original, holders.get(cell.original).filter((c) => c !== cell)); cell.original = null; };
  const augment = (cell, seen) => {
    for (const o of cand.get(cell) || []) {
      if (seen.has(o)) continue;
      seen.add(o);
      if (fits(o, cell)) { take(cell, o); return true; }
      // 그 원본을 쥔 칸 하나를 다른 원본으로 옮길 수 있으면 자리를 낸다(유튜브는 같은 언어 칸이 막는 경우를 먼저 옮긴다)
      const held = holders.get(o) || [];
      const blockers = platform === 'youtube' && held.length < cap
        ? held.filter((c) => (accounts[c.account].language || null) === (accounts[cell.account].language || null)) : held;
      for (const other of blockers) {
        drop(other);
        if (augment(other, seen)) { take(cell, o); return true; }
        take(other, o);
      }
    }
    return false;
  };
  for (const cell of list) augment(cell, new Set());
}

function whyEmpty(cell, a, originals, mine, seeds, cfg, useSpares) {
  const same = originals.filter((o) => o.format === cell.format && !(o.spare && !useSpares));
  if (!same.length) return `${cell.format} 원본 없음`;
  const live = same.filter((o) => !o.stopped);
  if (!live.length) return `${cell.format} 원본이 모두 멈춤`;
  const ver = live.filter((o) => o.versions?.[a.versionKey]?.ready && !(o.readyFrom && cell.day < o.readyFrom));
  if (!ver.length) return `${a.versionKey} 판본이 검수를 넘긴 ${cell.format} 원본 없음`;
  const fresh = ver.filter((o) => !mine.has(o.id));
  if (!fresh.length) return `이 계정이 ${cell.format} 원본을 다 올림`;
  if (!a.seed && fresh.every((o) => seeds[o.id] === undefined || cell.ms < checkpointOf(seeds[o.id], cfg))) return '씨앗 계정이 아직 안 올렸거나 14시 점검 전';
  return '같은 플랫폼 20시간 겹침';
}

module.exports = { DEFAULTS, plan, checkpointOf, clashes, addDays, hashOf };
