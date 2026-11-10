'use strict';
/* 계정 시간대 · 하루 칸(2026-11-10 LAB 하루 두 편 · 39계정 — 설계 1, docs/마케팅/LAB_하루두편_설계_20261110/README.md).
 *
 * sns-계정.json 계정 칸:
 *   timeZone      IANA 시간대(서머타임 포함, 없으면 Asia/Seoul — 11-10 앞의 계정은 모두 한국 시각으로 적혀 있었다)
 *   dailyTimes    그 시간대의 현지 시각 목록(「HH:MM」, 이른 것부터). 칸마다 따로 센다(tools/예약큐.js)
 *   dailyFormats  dailyTimes와 같은 순서의 칸 형식(「이야기」 · 「퀴즈」) — 돌림표(tools/돌림표.js)가 칸마다 맞는 원본을 고른다
 *   dailyTimesFrom 그날(현지 날짜)부터 앞 칸들이 열린다(그 앞은 맨 끝 칸 하나만)
 *   dailyFrom     그날(현지 날짜)부터 그 계정 줄이 열린다 — 앞 날은 모든 칸이 「시작 전」이라 비축 · 빈 칸 · 알림에 안 든다
 * 날짜는 모두 그 계정의 현지 날짜다(나라 · 언어 · 계정은 서로 다른 단위 — 설계 1).
 */
const DEFAULT_TZ = 'Asia/Seoul';
const formatters = new Map();

function formatter(tz) {
  if (!formatters.has(tz)) {
    formatters.set(tz, new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }));
  }
  return formatters.get(tz);
}

function parts(ms, tz = DEFAULT_TZ) {
  const out = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) out[p.type] = p.value;
  if (out.hour === '24') out.hour = '00';
  return out;
}

// 시간대 이름이 Intl에 있는지(오타면 RangeError).
function validZone(tz) {
  try { formatter(tz); return true; } catch { return false; }
}

const tzOf = (account) => (account && account.timeZone) || DEFAULT_TZ;
function localDate(ms, tz = DEFAULT_TZ) { const p = parts(ms, tz); return `${p.year}-${p.month}-${p.day}`; }
function localMinute(ms, tz = DEFAULT_TZ) { const p = parts(ms, tz); return Number(p.hour) * 60 + Number(p.minute); }
function localTime(ms, tz = DEFAULT_TZ) { const p = parts(ms, tz); return `${p.hour}:${p.minute}`; }

// 그 순간 그 시간대가 UTC보다 몇 분 앞서는지(서울 +540, 뉴욕 여름 −240).
function offsetMinutes(ms, tz = DEFAULT_TZ) {
  const p = parts(ms, tz);
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

// 현지 날짜 + 현지 시각 → 그 순간(ms). 서머타임 경계를 넘을 수 있어 두 번 맞춘다.
function zonedMs(day, hhmm, tz = DEFAULT_TZ) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const guess = Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), h, m);
  let ms = guess - offsetMinutes(guess, tz) * 60000;
  ms = guess - offsetMinutes(ms, tz) * 60000;
  return ms;
}

// 그 순간을 그 시간대의 「YYYY-MM-DDTHH:MM:00+hh:mm」로(판 「시각」 꼴).
function isoAt(ms, tz = DEFAULT_TZ) {
  const p = parts(ms, tz);
  const off = offsetMinutes(ms, tz);
  const a = Math.abs(off);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00${off < 0 ? '-' : '+'}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

const minuteOf = (t) => Number(String(t).slice(0, 2)) * 60 + Number(String(t).slice(3, 5));
const isTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ''));

// 그 계정의 하루 칸 전부(현지 시각 · 형식). dailyTimes가 없으면 칸 하나(형식 없음).
function allSlots(account) {
  const times = Array.isArray(account?.dailyTimes) && account.dailyTimes.length ? account.dailyTimes : null;
  if (!times) return [{ time: null, format: Array.isArray(account?.dailyFormats) ? account.dailyFormats[0] || null : null }];
  return times.map((time, i) => ({ time, format: Array.isArray(account.dailyFormats) ? account.dailyFormats[i] || null : null }));
}

// 「미정」은 아직 안 연 칸(5일치 비축을 건 날 날짜로 바꾼다 — sns-계정.json labRotation.시작).
const PENDING = '미정';
const before = (day, from) => Boolean(from) && (from === PENDING || day < from);
const notStarted = (account) => account?.dailyFrom === PENDING;

// 그날(현지) 열린 칸 — dailyFrom 앞이면 없음, dailyTimesFrom 앞이면 맨 끝 칸만. 형식마다 여는 날(dailyFormatsFrom — {"노래": "미정"})이
// 있으면 그 형식의 칸은 그날 전에는 닫힌다(11-10: 나라별 계정은 13:00 이야기 칸부터 열고, 21:00 노래 칸은 노래 비축이 찬 뒤 —
// 11-10 밤 21:00 칸이 퀴즈에서 노래로 바뀌었다).
function slotsOn(account, day) {
  if (before(day, account?.dailyFrom)) return [];
  let slots = allSlots(account);
  if (slots.length > 1 && before(day, account.dailyTimesFrom)) slots = slots.slice(-1);
  const byFormat = account?.dailyFormatsFrom;
  return byFormat && typeof byFormat === 'object' ? slots.filter((s) => !(s.format && before(day, byFormat[s.format]))) : slots;
}

// 판 시각이 그 계정의 어느 칸인지 — 현지 시각이 가장 가까운 칸.
function slotFor(timeIso, account) {
  const slots = allSlots(account);
  const ms = Date.parse(timeIso || '');
  if (!Number.isFinite(ms) || slots.length === 1 || !slots[0].time) return slots[slots.length - 1];
  const m = localMinute(ms, tzOf(account));
  return slots.reduce((best, s) => (Math.abs(minuteOf(s.time) - m) < Math.abs(minuteOf(best.time) - m) ? s : best), slots[slots.length - 1]);
}

// 칸 이름 — 맨 끝 칸은 계정 이름 그대로, 앞 칸은 「<계정> <형식>」(형식이 없으면 「<계정> <시>시」).
function slotKey(key, account, slot) {
  const slots = allSlots(account);
  if (slots.length < 2 || slot === slots[slots.length - 1] || slot?.time === slots[slots.length - 1].time) return key;
  return slot.format ? `${key} ${slot.format}` : `${key} ${Number(String(slot.time).slice(0, 2))}시`;
}

module.exports = { DEFAULT_TZ, PENDING, tzOf, validZone, localDate, localMinute, localTime, offsetMinutes, zonedMs, isoAt, minuteOf, isTime, allSlots, slotsOn, slotFor, slotKey, notStarted };
