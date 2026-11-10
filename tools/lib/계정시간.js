'use strict';
/* 계정 시간대 · 하루 칸(2026-11-10 LAB 하루 두 편 · 39계정 — 설계 1, docs/마케팅/LAB_하루두편_설계_20261110/README.md).
 *
 * sns-계정.json 계정 칸:
 *   timeZone      IANA 시간대(서머타임 포함, 없으면 Asia/Seoul — 11-10 앞의 계정은 모두 한국 시각으로 적혀 있었다)
 *   dailyTimes    그 시간대의 현지 시각 목록(「HH:MM」, 이른 것부터). 칸마다 따로 센다(tools/예약큐.js)
 *   dailyFormats  dailyTimes와 같은 순서의 칸 형식(13:00 「이야기」 · 21:00 「노래」 — 11-10 밤 21:00 칸이 퀴즈에서 노래로 바뀌었고 「퀴즈」는 예비 형식)
 *                 — 돌림표(tools/돌림표.js)가 칸마다 맞는 원본을 고른다
 *   dailyTimesFrom 그날(현지 날짜)부터 앞 칸들이 열린다(그 앞은 맨 끝 칸 하나만)
 *   dailyFrom     그날(현지 날짜)부터 그 계정 줄이 열린다 — 앞 날은 모든 칸이 「시작 전」이라 비축 · 빈 칸 · 알림에 안 든다
 *   dailyFormatsFrom 형식마다 여는 날({"노래": "미정"}) — 열쇠는 그 계정 dailyFormats의 형식 글자 그대로
 * 날짜는 모두 그 계정의 현지 날짜다(나라 · 언어 · 계정은 서로 다른 단위 — 설계 1). 여는 날은 「YYYY-MM-DD」 또는 「미정」이다 —
 * 꼴이 틀리면(「2026-11-3」 · 열쇠 「노래 」) 글자 비교라 조용히 칸이 닫히거나 열리므로 checkLedger로 원장을 먼저 본다(11-11 Fable 5.2 P2-13).
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
// 선택 인자(성과 표 — 11-11 Fable 5.2 P2-12)를 주면 slotAt의 셈을 쓴다. 인자 없이 부르면 옛 셈 그대로다 — 돌림 셈 · 게시 장부 · 올리기 전 검사의
// 칸 열쇠(「현지 날짜|칸 시각」)가 이 결과에 기대므로 바꾸지 않는다.
function slotFor(timeIso, account, opts) {
  if (opts && typeof opts === 'object' && (opts.돌아서 || opts.열린칸만)) return slotAt(timeIso, account, opts).slot;
  const slots = allSlots(account);
  const ms = Date.parse(timeIso || '');
  if (!Number.isFinite(ms) || slots.length === 1 || !slots[0].time) return slots[slots.length - 1];
  const m = localMinute(ms, tzOf(account));
  return slots.reduce((best, s) => (Math.abs(minuteOf(s.time) - m) < Math.abs(minuteOf(best.time) - m) ? s : best), slots[slots.length - 1]);
}

function addDay(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* 판 시각 → { slot, day }(day = 그 칸의 현지 날짜). 옵션:
 *   돌아서   자정을 넘긴다 — 앞 날 · 다음 날 칸까지 흐른 시간으로 견줘, 현지 01:55 판은 그날 13:00(11시간 뒤)이 아니라 앞 날 21:00 칸(5시간 전)이다.
 *   열린칸만 그날 열린 칸(slotsOn)만 고른다 — 앞 칸이 닫힌 날(dailyTimesFrom · dailyFormatsFrom 앞)의 판은 닫힌 칸으로 세지 않는다.
 *            고를 칸이 하나도 없으면(dailyFrom 앞에 손으로 올린 판 등) 열림을 보지 않고 가장 가까운 칸이다.
 * 같은 거리면 판의 현지 날짜 · 늦은 칸이 먼저다. 시각을 못 읽거나 칸에 시각이 없으면 맨 끝 칸 · 판의 현지 날짜(못 읽으면 null).
 * 선택 인자 없이 부르면 slotFor의 옛 셈이 아니라 「돌아서도 열린칸만도 아닌」 셈(그날 칸 가운데 흐른 시간이 가장 가까운 칸)이다. */
function slotAt(timeIso, account, opts = {}) {
  const slots = allSlots(account);
  const ms = Date.parse(timeIso || '');
  const tz = tzOf(account);
  const last = slots[slots.length - 1];
  if (!Number.isFinite(ms) || !last.time) return { slot: last, day: Number.isFinite(ms) ? localDate(ms, tz) : null };
  const today = localDate(ms, tz);
  const days = opts && opts.돌아서 ? [today, addDay(today, -1), addDay(today, 1)] : [today];
  const pick = (open) => {
    let best = null;
    for (const day of days) {
      const list = open ? slots.filter((s) => slotsOn(account, day).some((o) => o.time === s.time)) : slots;
      for (const s of [...list].reverse()) {
        if (!isTime(s.time)) continue;
        const gap = Math.abs(zonedMs(day, s.time, tz) - ms);
        if (!best || gap < best.gap) best = { slot: s, day, gap };
      }
    }
    return best;
  };
  const best = (opts && opts.열린칸만 && pick(true)) || pick(false);
  return best ? { slot: best.slot, day: best.day } : { slot: last, day: today };
}

/* 원장 꼴 검사(11-11 Fable 5.2 P2-13). 여는 날 · 칸은 글자 그대로 견주므로 꼴이 틀리면 종료 0으로 조용히 칸이 닫히거나 열린다
 * (「2026-11-3」이면 칸 0, dailyFormatsFrom {"노래 ": "미정"}이면 노래 칸이 열림). LAB이고 dailyTimes가 있는 계정만 본다.
 *   checkAccount(key, account) → [「<계정>: …」 문제 글…] · checkLedger(accounts) → 원장 accounts(계정 키 → 값) 전체의 문제 글 */
const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const isFrom = (v) => v === PENDING || isDay(v);
const shown = (v) => (typeof v === 'string' ? `「${v}」${v.trim() !== v ? `(${JSON.stringify(v)} — 앞뒤 빈칸)` : ''}` : JSON.stringify(v) ?? String(v));

function checkAccount(key, account) {
  if (!account || typeof account !== 'object' || account.brand !== 'LAB' || account.dailyTimes === undefined) return [];
  const out = [];
  const bad = (text) => out.push(`${key}: ${text}`);
  const times = account.dailyTimes;
  if (!Array.isArray(times) || !times.length) bad(`dailyTimes ${shown(times)} — 「HH:MM」 현지 시각 목록이어야 한다`);
  else {
    for (const t of times) if (!isTime(t)) bad(`dailyTimes ${shown(t)} — 「HH:MM」(00:00~23:59) 꼴이 아니다`);
    const ok = times.filter(isTime);
    if (ok.some((t, i) => i > 0 && minuteOf(t) <= minuteOf(ok[i - 1]))) bad(`dailyTimes ${times.join(' · ')} — 이른 것부터 겹치지 않게 적는다(맨 끝 칸이 dailyTimesFrom 앞에도 열리는 칸이다)`);
  }
  const formats = account.dailyFormats;
  if (!Array.isArray(formats)) bad(`dailyFormats ${shown(formats)} — dailyTimes와 같은 순서의 형식 목록이어야 한다`);
  else {
    if (Array.isArray(times) && formats.length !== times.length) bad(`dailyFormats ${formats.length}개 · dailyTimes ${times.length}개 — 칸마다 형식 하나씩 같은 길이여야 한다`);
    for (const f of formats) if (typeof f !== 'string' || !f.trim() || f.trim() !== f) bad(`dailyFormats ${shown(f)} — 앞뒤 빈칸 없는 형식 이름(이야기 · 노래 · 퀴즈)이어야 한다`);
  }
  for (const field of ['dailyFrom', 'dailyTimesFrom']) {
    if (account[field] !== undefined && !isFrom(account[field])) bad(`${field} ${shown(account[field])} — 「YYYY-MM-DD」(있는 날짜) 또는 「${PENDING}」이어야 한다`);
  }
  const byFormat = account.dailyFormatsFrom;
  if (byFormat !== undefined) {
    if (!byFormat || typeof byFormat !== 'object' || Array.isArray(byFormat)) bad(`dailyFormatsFrom ${shown(byFormat)} — {"<형식>": "YYYY-MM-DD" | "${PENDING}"} 꼴이어야 한다`);
    else {
      for (const [f, from] of Object.entries(byFormat)) {
        if (!Array.isArray(formats) || !formats.includes(f)) bad(`dailyFormatsFrom 열쇠 ${shown(f)} — 이 계정 dailyFormats(${Array.isArray(formats) ? formats.join(' · ') : '없음'})에 없는 형식이라 어느 칸도 닫지 않는다`);
        if (!isFrom(from)) bad(`dailyFormatsFrom.${f} ${shown(from)} — 「YYYY-MM-DD」(있는 날짜) 또는 「${PENDING}」이어야 한다`);
      }
    }
  }
  if (account.timeZone !== undefined && !(typeof account.timeZone === 'string' && account.timeZone && validZone(account.timeZone))) bad(`timeZone ${shown(account.timeZone)} — Intl이 모르는 시간대 이름이다(IANA 이름, 예 Asia/Seoul)`);
  return out;
}

function checkLedger(accounts) {
  if (!accounts || typeof accounts !== 'object' || Array.isArray(accounts)) return ['원장 accounts가 계정 키 → 값 객체가 아니다'];
  return Object.entries(accounts).flatMap(([key, a]) => checkAccount(key, a));
}

// 칸 이름 — 맨 끝 칸은 계정 이름 그대로, 앞 칸은 「<계정> <형식>」(형식이 없으면 「<계정> <시>시」).
function slotKey(key, account, slot) {
  const slots = allSlots(account);
  if (slots.length < 2 || slot === slots[slots.length - 1] || slot?.time === slots[slots.length - 1].time) return key;
  return slot.format ? `${key} ${slot.format}` : `${key} ${Number(String(slot.time).slice(0, 2))}시`;
}

module.exports = { DEFAULT_TZ, PENDING, tzOf, validZone, localDate, localMinute, localTime, offsetMinutes, zonedMs, isoAt, minuteOf, isTime, allSlots, slotsOn, slotFor, slotAt, slotKey, notStarted, checkAccount, checkLedger };
