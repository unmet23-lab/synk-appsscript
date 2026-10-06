// 말 랠리 — 하루 도전(2026-10-07): 서울 날짜마다 누구에게나 같은 12번 주고받기와, 이 브라우저에 남는 개인 기록.
// 한 판은 보통 판과 같은 규칙(composeRound: 두 학습 항목 4개 이상씩, 쉬운 것부터)으로 고르되 씨앗은 날짜뿐이다 —
// 학습 기록(아틀라스)을 읽지 않아야 같은 날 모두에게 같은 판이 된다. 대답 카드 순서도 날짜와 말로 정한다.
// 다른 사람과 견주는 순위는 서버가 있어야 해서 만들지 않았다(정적 사이트). 화면 없이 시험할 수 있는 순수 함수만 둔다.
import { ITEMS } from './content.mjs';
import { composeRound, shuffled, rng } from './core.mjs';

export const DAILY_KEY = 'synk.talk-rally.daily.v1';
export const KEEP_DAYS = 60;   // 기록은 최근 60일만 둔다(저장 공간이 끝없이 늘지 않게)
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** 서울 날짜(YYYY-MM-DD). 공통 코인의 하루(korean-racing/garage-core.js seoulDate)와 같은 셈이다. */
export const seoulDate = (now = Date.now()) => new Date((Number.isFinite(now) ? now : Date.now()) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
export const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
export const weekday = (date) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

/** 날짜 문자열 → 32비트 씨앗(FNV-1a). 같은 글자면 어느 기기에서나 같은 값이다. */
export function dateSeed(text) {
  let h = 0x811c9dc5;
  for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h || 1;
}
/** 그날의 12번. 날짜만으로 정하고 학습 기록은 쓰지 않는다. */
export const dailyRound = (date, items = ITEMS) => composeRound(items, { seed: dateSeed(`talk-rally:${date}`) });
/** 그날 그 말의 대답 카드 순서(왼쪽부터 1·2·3). 모두에게 같다. */
export const dailyOptions = (item, date) => shuffled(item.options, rng(dateSeed(`talk-rally:${date}:${item.id}`)));

/* ── 개인 기록: { v: 1, days: { 'YYYY-MM-DD': { plays, best: { score, correct, total, stars, rally } } } } ── */
export const emptyRecords = () => ({ v: 1, days: {} });
const count = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);
function cleanBest(b) {
  if (!b || typeof b !== 'object') return null;
  const best = { score: count(b.score, 100000), correct: count(b.correct, 100), total: count(b.total, 100), stars: count(b.stars, 3), rally: count(b.rally, 100) };
  return Object.values(best).every((v) => v !== null) && best.correct <= best.total ? best : null;
}
/** 저장된 기록을 칸마다 확인한다. 깨진 날은 버리고, 최근 KEEP_DAYS일만 남긴다. */
export function normalizeRecords(saved) {
  const out = emptyRecords();
  const days = saved && typeof saved === 'object' && saved.days && typeof saved.days === 'object' && !Array.isArray(saved.days) ? saved.days : {};
  const kept = Object.keys(days).filter((d) => DAY.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`))).sort().slice(-KEEP_DAYS);
  for (const d of kept) {
    const best = cleanBest(days[d]?.best), plays = count(days[d]?.plays, 100000);
    if (best && plays) out.days[d] = { plays, best };
  }
  return out;
}
/**
 * 끝까지 마친 하루 도전 한 판을 남긴다. s는 core.mjs scoreRound의 결과.
 * newBest는 그날 앞선 기록을 넘었을 때만 참이다(그날 첫 판은 넘을 기록이 없다). 점수가 같으면 앞선 기록을 둔다.
 */
export function recordDaily(records, date, s) {
  const next = normalizeRecords(records), prev = next.days[date] || null;
  const mine = { score: s.score, correct: s.correct, total: s.total, stars: s.stars, rally: s.bestRally };
  const newBest = !!prev && mine.score > prev.best.score;
  next.days[date] = { plays: Math.min(100000, (prev?.plays || 0) + 1), best: !prev || newBest ? mine : prev.best };
  const trimmed = normalizeRecords(next);
  return { records: trimmed, newBest, first: !prev, prevBest: prev ? prev.best.score : null, best: trimmed.days[date]?.best || mine, plays: trimmed.days[date]?.plays || 1 };
}
/**
 * 연속 일수: 오늘까지 하루도 빠지지 않고 하루 도전을 끝까지 마친 서울 날짜 수.
 * 오늘 아직 안 했으면 어제까지를 센다(오늘이 끝나기 전에는 이어 갈 수 있으니까).
 */
export function streak(records, today) {
  const days = normalizeRecords(records).days;
  let d = days[today] ? today : addDays(today, -1), n = 0;
  while (days[d]) { n += 1; d = addDays(d, -1); }
  return n;
}
/** 입구 한 줄에 쓸 오늘의 상태. */
export function dailyStatus(records, today) {
  const day = normalizeRecords(records).days[today] || null;
  return { played: !!day, best: day?.best || null, plays: day?.plays || 0, streak: streak(records, today) };
}
/** 최근 n일(오래된 날 → 오늘): 날짜·요일·그날 최고 점수(안 했으면 null). */
export function recentDays(records, today, n = 7) {
  const days = normalizeRecords(records).days;
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1);
    return { date, weekday: weekday(date), today: date === today, best: days[date]?.best.score ?? null };
  });
}
