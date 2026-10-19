'use strict';
// AI 구독 계정판의 사용 기록(이 PC 앱 데이터 폴더의 history.jsonl) → 「지난 7일 사용량」 막대와 계정별 소비 속도.
// 기록 한 줄은 읽기 한 번의 숫자뿐이다(계정 줄 id·서비스·요금제·주간 %·초기화 시각·크레딧). 이메일·토큰은 넣지 않는다.
//  · 한도형(Claude·GPT·Gemini): 같은 주간 창 안에서 늘어난 %p가 소비다. 창이 바뀌면(초기화) 새 창의 %가 그대로 소비이고,
//    초기화 전 마지막 읽기 뒤의 소비는 모른다(그래서 본체가 초기화 10분 전에 한 번 더 읽는다).
//    처음 읽은 값은 그 창이 시작된 뒤의 소비다. 창은 7일이고 아직 안 끝났으니 첫 읽기 시각의 구간에 넣는다.
//  · 크레딧형(Higgsfield·Typecast): 잔액이 줄어든 만큼이 소비, 늘어난 것은 충전으로 따로 둔다(한 구간에 둘이 겹치면 소비가 덜 잡힌다).
// 구간은 달력 주가 아니라 지금 기준 7일씩이다(계정마다 초기화 요일이 다르다 — Fable 검수 10-19 P1-2).
const DAY = 864e5, WEEK = 7 * DAY, SAME_WINDOW = 15 * 60e3, KEEP = 180 * DAY;
const WEEKLY = new Set(['claude', 'gpt', 'gemini']), CREDIT = new Set(['higgsfield', 'typecast']);
// Claude 요금제 배수(claude.com/pricing 10-19: Max는 Pro의 5배·20배). GPT·Gemini는 공식 배수가 없어 같은 무게로 센다.
const CLAUDE_WEIGHT = Object.freeze({ pro: 1, max: 5, max5x: 5, max20x: 20 });
const planKey = plan => String(plan || '').toLowerCase().replace(/[\s_-]/g, '');
const weightOf = (service, plan) => (service === 'claude' ? CLAUDE_WEIGHT[planKey(plan)] || 1 : 1);
const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

// 읽기 한 번 → 기록 한 줄. 숫자가 하나도 없으면 남기지 않는다.
function sampleOf(row, t) {
  if (!row || typeof row.id !== 'string' || !(WEEKLY.has(row.service) || CREDIT.has(row.service))) return null;
  const weekly = row.live?.weekly, credits = row.live?.credits;
  const w = weekly && finite(weekly.usedPercent) ? Math.min(100, Math.max(0, Number(weekly.usedPercent))) : null;
  const c = finite(credits) ? Number(credits) : null;
  if (w === null && c === null) return null;
  return { t: Math.round(Number(t)), id: row.id, s: row.service, p: row.plan || null, w, wr: w !== null && finite(weekly.resetsAt) ? Number(weekly.resetsAt) : null, c };
}
// 기록 파일 → 줄 배열. 깨진 줄·모양이 다른 줄·보관 기간(180일)이 지난 줄은 버린다.
function parseHistory(text, from = -Infinity) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    if (!line.trim()) continue;
    let s; try { s = JSON.parse(line); } catch { continue; }
    if (!s || typeof s !== 'object' || typeof s.id !== 'string' || !finite(s.t) || s.t < from) continue;
    if (!(WEEKLY.has(s.s) || CREDIT.has(s.s))) continue;
    out.push({ t: Number(s.t), id: s.id, s: s.s, p: typeof s.p === 'string' ? s.p : null, w: finite(s.w) ? Number(s.w) : null, wr: finite(s.wr) ? Number(s.wr) : null, c: finite(s.c) ? Number(s.c) : null });
  }
  return out.sort((a, b) => a.t - b.t);
}

// 계정 하나의 기록(시간순) → 소비·충전 사건. first: 기록이 시작된 때(from: 그 소비가 시작됐을 수 있는 가장 이른 때).
function accountEvents(samples) {
  const events = [], refills = [];
  let prev = null, firstAt = null, coverFrom = null;
  for (const s of samples) {
    if (WEEKLY.has(s.s)) {
      if (s.w === null) continue;
      if (!prev) {
        firstAt = s.t; coverFrom = s.wr && s.wr > s.t ? Math.max(s.wr - WEEK, s.t - WEEK) : s.t;
        if (s.w > 0) events.push({ t: s.t, v: s.w, first: true });
      } else {
        const same = prev.wr && s.wr ? Math.abs(prev.wr - s.wr) < SAME_WINDOW : !prev.wr && !s.wr;
        // 같은 창이면 늘어난 만큼만 센다. 같은 창에서 %가 줄거나(공급자 보정) 요금제가 바뀌어 %의 기준이 달라지면
        // 그 사이 소비는 모르는 것으로 둔다(누적 전체를 새 소비로 세면 막대와 속도가 부푼다 — Fable 구현 검수 P1).
        // 창이 바뀌었으면(초기화) 새 창의 %가 그대로 소비다.
        // 요금제는 이름이 아니라 무게로 견준다(등급을 한 번 못 읽어 max_5x가 max로 읽혀도 같은 5배다).
        const v = same ? (weightOf(s.s, s.p) === weightOf(prev.s, prev.p) ? Math.max(0, s.w - prev.w) : 0) : s.w;
        if (v > 0) events.push({ t: s.t, v });
      }
      prev = s;
    } else {
      if (s.c === null) continue;
      if (!prev) { firstAt = s.t; coverFrom = s.t; }
      else {
        const d = prev.c - s.c;
        if (d > 1e-6) events.push({ t: s.t, v: d });
        else if (d < -1e-6) refills.push(s.t);
      }
      prev = s;
    }
  }
  return { events, refills, firstAt, coverFrom };
}

// rows: 지금 판의 계정 줄(지운 계정의 기록은 세지 않는다). 반환: 구간 다섯(오래된 → 지난 7일), 서비스별 막대, 계정별 통계.
function usageSummary({ rows = [], history = [], now = Date.now() } = {}) {
  const live = new Map(rows.filter(r => r && r.source === 'auto' && (WEEKLY.has(r.service) || CREDIT.has(r.service))).map(r => [r.id, r]));
  const byId = new Map();
  for (const s of history) { if (!live.has(s.id) || s.t > now) continue; if (!byId.has(s.id)) byId.set(s.id, []); byId.get(s.id).push(s); }
  const buckets = [4, 3, 2, 1, 0].map(k => ({ start: now - (k + 1) * WEEK, end: now - k * WEEK }));
  const accounts = {}, perService = new Map();
  let since = null;
  for (const [id, samples] of byId) {
    const row = live.get(id), { events, refills, firstAt, coverFrom } = accountEvents(samples);
    if (firstAt === null) continue;
    since = since === null ? firstAt : Math.min(since, firstAt);
    const sum = (from, to, skipFirst = false) => events.reduce((n, e) => (e.t >= from && e.t <= to && !(skipFirst && e.first) ? n + e.v : n), 0);
    const used7 = sum(now - WEEK, now);
    // 최근 3일 속도: 기록이 3일 넘게 쌓였을 때만(처음 읽은 창 전체를 3일 소비로 오해하지 않게).
    const rate3 = firstAt <= now - 3 * DAY ? sum(now - 3 * DAY, now, true) / 3 : null;
    // 크레딧 하루 속도: 지난 7일(기록이 짧으면 있는 날만큼).
    const days = Math.max(1, Math.min(7, (now - firstAt) / DAY));
    accounts[id] = { since: firstAt, used7: Math.round(used7 * 100) / 100, rate3: rate3 === null ? null : Math.round(rate3 * 100) / 100, perDay: Math.round((sum(now - WEEK, now, true) / days) * 100) / 100, refillAt: refills.length ? refills[refills.length - 1] : null };
    if (!perService.has(row.service)) perService.set(row.service, []);
    perService.get(row.service).push({ row, events, coverFrom, firstAt, weight: weightOf(row.service, row.plan || samples[samples.length - 1].p) });
  }
  const services = {};
  for (const [service, list] of perService) {
    const pct = WEEKLY.has(service);
    const bars = buckets.map(({ start, end }) => {
      const present = list.filter(a => a.coverFrom < end || (end === now && a.coverFrom <= now));
      if (!present.length) return null;
      const used = a => a.events.reduce((n, e) => (e.t >= start && (e.t < end || (end === now && e.t <= end)) ? n + e.v : n), 0);
      // 한도형 평균은 그 구간을 처음부터 덮은 계정끼리만 낸다(구간 중간에 연결한 계정의 반 주치가 평균을 끌어내리지 않게).
      // 그런 계정이 없을 때만 있는 계정으로 내고 「일부」로 둔다. 크레딧은 쓴 양의 합이라 있는 계정을 다 더한다.
      const whole = present.filter(a => a.coverFrom <= start);
      if (pct) {
        const use = whole.length ? whole : present;
        return { v: Math.round(use.reduce((n, a) => n + used(a) * a.weight, 0) / use.reduce((n, a) => n + a.weight, 0)), partial: !whole.length };
      }
      return { v: Math.round(present.reduce((n, a) => n + used(a), 0)), partial: !whole.length };
    });
    // 비교는 보이는 앞 막대 넷 가운데 꽉 찬 구간의 평균. 바로 앞 구간(지난 7일의 앞 7일)이 꽉 차야, 곧 기록이 14일 넘어야 보인다.
    const full = bars.slice(0, 4).filter(b => b && !b.partial);
    const base = bars[3] && !bars[3].partial && full.length ? Math.round(full.reduce((n, b) => n + b.v, 0) / full.length) : null;
    const plans = new Set(list.map(a => a.weight));
    services[service] = { kind: pct ? 'pct' : 'credit', accounts: list.length, since: Math.min(...list.map(a => a.firstAt)), bars, base, baseWeeks: base === null ? 0 : full.length, mixed: pct && plans.size > 1 };
  }
  return { since, buckets, services, accounts };
}

module.exports = { usageSummary, sampleOf, parseHistory, accountEvents, weightOf, KEEP, WEEKLY, CREDIT };
