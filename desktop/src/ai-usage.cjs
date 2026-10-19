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
// h(10-19 2차부터): 한도형의 5시간 창 %. 요금제 맞추기가 「5시간 한도에 막힌 적이 없는지」를 세려고 남긴다(그 전 줄에는 없다).
function sampleOf(row, t) {
  if (!row || typeof row.id !== 'string' || !(WEEKLY.has(row.service) || CREDIT.has(row.service))) return null;
  const weekly = row.live?.weekly, credits = row.live?.credits, session = row.live?.session;
  const w = weekly && finite(weekly.usedPercent) ? Math.min(100, Math.max(0, Number(weekly.usedPercent))) : null;
  const c = finite(credits) ? Number(credits) : null;
  if (w === null && c === null) return null;
  const h = WEEKLY.has(row.service) && session && finite(session.usedPercent) ? Math.min(100, Math.max(0, Number(session.usedPercent))) : null;
  return { t: Math.round(Number(t)), id: row.id, s: row.service, p: row.plan || null, w, wr: w !== null && finite(weekly.resetsAt) ? Number(weekly.resetsAt) : null, c, ...(h === null ? {} : { h }) };
}
// 기록 파일 → 줄 배열. 깨진 줄·모양이 다른 줄·보관 기간(180일)이 지난 줄은 버린다.
function parseHistory(text, from = -Infinity) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    if (!line.trim()) continue;
    let s; try { s = JSON.parse(line); } catch { continue; }
    if (!s || typeof s !== 'object' || typeof s.id !== 'string' || !finite(s.t) || s.t < from) continue;
    if (!(WEEKLY.has(s.s) || CREDIT.has(s.s))) continue;
    out.push({ t: Number(s.t), id: s.id, s: s.s, p: typeof s.p === 'string' ? s.p : null, w: finite(s.w) ? Number(s.w) : null, wr: finite(s.wr) ? Number(s.wr) : null, c: finite(s.c) ? Number(s.c) : null, h: finite(s.h) ? Number(s.h) : null });
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
      // wt: 그 소비가 일어날 때의 요금제 무게(사건별 무게 — 요금제를 바꾼 계정의 옛 구간을 지금 무게로 세지 않는다, 10-19 2차).
      const wt = weightOf(s.s, s.p);
      if (!prev) {
        firstAt = s.t; coverFrom = s.wr && s.wr > s.t ? Math.max(s.wr - WEEK, s.t - WEEK) : s.t;
        if (s.w > 0) events.push({ t: s.t, v: s.w, first: true, wt });
      } else {
        const same = prev.wr && s.wr ? Math.abs(prev.wr - s.wr) < SAME_WINDOW : !prev.wr && !s.wr;
        // 같은 창이면 늘어난 만큼만 센다. 같은 창에서 %가 줄거나(공급자 보정) 요금제가 바뀌어 %의 기준이 달라지면
        // 그 사이 소비는 모르는 것으로 둔다(누적 전체를 새 소비로 세면 막대와 속도가 부푼다 — Fable 구현 검수 P1).
        // 창이 바뀌었으면(초기화) 새 창의 %가 그대로 소비다.
        // 요금제는 이름이 아니라 무게로 견준다(등급을 한 번 못 읽어 max_5x가 max로 읽혀도 같은 5배다).
        const v = same ? (wt === weightOf(prev.s, prev.p) ? Math.max(0, s.w - prev.w) : 0) : s.w;
        if (v > 0) events.push({ t: s.t, v, wt });
      }
      prev = s;
    } else {
      if (s.c === null) continue;
      if (!prev) { firstAt = s.t; coverFrom = s.t; }
      else {
        const d = prev.c - s.c;
        if (d > 1e-6) events.push({ t: s.t, v: d, wt: 1 });
        else if (d < -1e-6) refills.push(s.t);
      }
      prev = s;
    }
  }
  return { events, refills, firstAt, coverFrom };
}

// 등급 없이 「max」로 남은 Claude 읽기(Claude Code 설정 파일을 한 번 못 읽은 때)는 앞뒤 읽기의 Max 등급을 따른다.
// 한 번 흔들린 읽기가 무게를 바꿔 막대를 부풀리거나 「왜 이 숫자?」를 켜지 않게(Fable 2차 검수 P1-4). 등급을 아는 읽기가 없으면 그대로 둔다.
function steadyTiers(samples) {
  const tier = s => s.s === 'claude' && /^max(5x|20x)$/.test(planKey(s.p)), loose = s => s.s === 'claude' && planKey(s.p) === 'max';
  const first = samples.find(tier);
  if (!first || !samples.some(loose)) return samples;
  let last = first.p;
  return samples.map(s => { if (tier(s)) last = s.p; return loose(s) ? { ...s, p: last } : s; });
}

// rows: 지금 판의 계정 줄(지운 계정의 기록은 세지 않는다). 반환: 구간 다섯(오래된 → 지난 7일), 서비스별 막대, 계정별 통계.
function usageSummary({ rows = [], history = [], now = Date.now() } = {}) {
  const live = new Map(rows.filter(r => r && r.source === 'auto' && (WEEKLY.has(r.service) || CREDIT.has(r.service))).map(r => [r.id, r]));
  const byId = new Map();
  for (const s of history) { if (!live.has(s.id) || s.t > now) continue; if (!byId.has(s.id)) byId.set(s.id, []); byId.get(s.id).push(s); }
  const buckets = [4, 3, 2, 1, 0].map(k => ({ start: now - (k + 1) * WEEK, end: now - k * WEEK }));
  const accounts = {}, perService = new Map();
  let since = null;
  for (const [id, read] of byId) {
    const samples = steadyTiers(read), row = live.get(id), { events, refills, firstAt, coverFrom } = accountEvents(samples);
    if (firstAt === null) continue;
    since = since === null ? firstAt : Math.min(since, firstAt);
    const sum = (from, to, skipFirst = false) => events.reduce((n, e) => (e.t >= from && e.t <= to && !(skipFirst && e.first) ? n + e.v : n), 0);
    const used7 = sum(now - WEEK, now);
    // 최근 3일 속도: 기록이 3일 넘게 쌓였을 때만(처음 읽은 창 전체를 3일 소비로 오해하지 않게).
    const rate3 = firstAt <= now - 3 * DAY ? sum(now - 3 * DAY, now, true) / 3 : null;
    // 크레딧 하루 속도: 지난 7일(기록이 짧으면 있는 날만큼).
    const days = Math.max(1, Math.min(7, (now - firstAt) / DAY));
    const cur = weightOf(row.service, row.plan || samples[samples.length - 1].p);
    accounts[id] = { since: firstAt, used7: Math.round(used7 * 100) / 100, rate3: rate3 === null ? null : Math.round(rate3 * 100) / 100, perDay: Math.round((sum(now - WEEK, now, true) / days) * 100) / 100, refillAt: refills.length ? refills[refills.length - 1] : null, weeks4: lastFourWeeks(samples, events, coverFrom, buckets, cur), weeks12: lastTwelveWeeks(samples, events, firstAt, now, cur, row.plan || samples[samples.length - 1].p) };
    if (!perService.has(row.service)) perService.set(row.service, []);
    // weightAt: 그 구간 끝까지 마지막으로 읽은 요금제의 무게(그 전 읽기가 없으면 첫 읽기). 평균의 분모를 그때의 한도 크기로 센다.
    const weightAt = end => { let w = weightOf(samples[0].s, samples[0].p); for (const s of samples) { if (s.t >= end) break; w = weightOf(s.s, s.p); } return w; };
    // weights: 보이는 다섯 구간 안에서 읽은 요금제 무게만(그 앞에서 바꾼 요금제로 「왜 이 숫자?」를 180일 동안 켜지 않게 — Fable 2차 P2-3).
    const shown = samples.filter(s => s.t >= buckets[0].start);
    perService.get(row.service).push({ row, events, coverFrom, firstAt, weightAt, weights: new Set((shown.length ? shown : samples.slice(-1)).map(s => weightOf(s.s, s.p))) });
  }
  const services = {};
  for (const [service, list] of perService) {
    const pct = WEEKLY.has(service);
    const bars = buckets.map(({ start, end }) => {
      const present = list.filter(a => a.coverFrom < end || (end === now && a.coverFrom <= now));
      if (!present.length) return null;
      const inBucket = e => e.t >= start && (e.t < end || (end === now && e.t <= end));
      const used = a => a.events.reduce((n, e) => (inBucket(e) ? n + e.v : n), 0);
      // 한도형 평균은 그 구간을 처음부터 덮은 계정끼리만 낸다(구간 중간에 연결한 계정의 반 주치가 평균을 끌어내리지 않게).
      // 그런 계정이 없을 때만 있는 계정으로 내고 「일부」로 둔다. 크레딧은 쓴 양의 합이라 있는 계정을 다 더한다.
      // 무게는 사건별: 소비는 그때의 요금제 무게로, 분모는 그 구간 끝의 요금제 무게로 센다(10-19 2차, Fable 4차에서 미룬 것).
      const whole = present.filter(a => a.coverFrom <= start);
      if (pct) {
        const use = whole.length ? whole : present;
        const weighted = a => a.events.reduce((n, e) => (inBucket(e) ? n + e.v * (e.wt || 1) : n), 0);
        return { v: Math.round(use.reduce((n, a) => n + weighted(a), 0) / use.reduce((n, a) => n + a.weightAt(end), 0)), partial: !whole.length };
      }
      return { v: Math.round(present.reduce((n, a) => n + used(a), 0)), partial: !whole.length };
    });
    // 비교는 보이는 앞 막대 넷 가운데 꽉 찬 구간의 평균. 바로 앞 구간(지난 7일의 앞 7일)이 꽉 차야, 곧 기록이 14일 넘어야 보인다.
    const full = bars.slice(0, 4).filter(b => b && !b.partial);
    const base = bars[3] && !bars[3].partial && full.length ? Math.round(full.reduce((n, b) => n + b.v, 0) / full.length) : null;
    // 「왜 이 숫자?」: 계정끼리든 한 계정이 요금제를 바꿔서든 무게가 둘 이상 섞였을 때.
    const plans = new Set(list.flatMap(a => [...a.weights]));
    services[service] = { kind: pct ? 'pct' : 'credit', accounts: list.length, since: Math.min(...list.map(a => a.firstAt)), bars, base, baseWeeks: base === null ? 0 : full.length, mixed: pct && plans.size > 1 };
  }
  return { since, buckets, services, accounts };
}

// 계정 하나의 지난 4주(구간 1~4, 7일씩): 요금제 맞추기·안 쓰는 구독(10-19 2차, Fable 1차 아이디어 3·4)이 쓴다.
//  값은 모두 지금 요금제(cur) 기준이다 — 그때 요금제 무게 ÷ 지금 무게로 바꿔, 4주 사이에 요금제를 바꾼 계정도 같은 잣대로 본다.
//  used: 그 7일에 쓴 양(한도형 %p · 크레딧), peak: 그 7일에 읽은 가장 높은 주간 %(둘 중 큰 값을 본다), reads: 그 7일에 읽은 횟수.
//  cover: 4주를 처음부터 덮었는지. known: 그 사이 소비를 놓친 틈이 없는지(Fable 2차 검수 P1-2) —
//   한도형은 같은 창 안의 틈은 누적 %가 메우므로, 4주 안에 끝난 주간 창마다 끝나기 하루 안에 읽었고 빠진 창이 없을 때.
//   크레딧형은 틈 사이에 충전이 끼면 그 전 소비가 가려지므로 읽기 사이가 모두 이틀 안일 때. 마지막 읽기도 하루 안이어야 한다.
//  hCover: 5시간 %를 남기기 시작한 때도 4주 앞인지(하루 여유). hPeak: 4주 동안 읽은 5시간 % 가운데 가장 높은 값 —
//   6시간마다 읽어서는 5시간 창이 꽉 찬 순간을 대부분 놓치므로 「막힌 적」 대신 가장 바빴던 읽기로 본다(Fable 2차 검수 P1-3).
function lastFourWeeks(samples, events, coverFrom, buckets, cur) {
  const four = buckets.slice(1), start = four[0].start, now = four[3].end, weekly = WEEKLY.has(samples[0].s);
  const scale = s => weightOf(s.s, s.p) / cur, reads = samples.filter(s => (weekly ? s.w !== null : s.c !== null));
  const round = v => Math.round(v * 100) / 100;
  const weeks = four.map(({ start: from, end }) => {
    const inside = t => t >= from && (t < end || (end === now && t <= end));
    const used = events.reduce((n, e) => (inside(e.t) ? n + (e.v * (e.wt || 1)) / cur : n), 0);
    const seen = reads.filter(s => inside(s.t)), peaks = weekly ? seen.map(s => s.w * scale(s)) : [];
    return { used: round(used), peak: peaks.length ? round(Math.max(...peaks)) : null, reads: seen.length };
  });
  let known = reads.length > 0 && now - reads[reads.length - 1].t <= DAY;
  for (let i = 1; known && i < reads.length; i++) {
    const a = reads[i - 1], b = reads[i];
    if (b.t <= start) continue;
    // 크레딧형: 잔액이 그대로여도 그 사이 충전이 쓴 만큼을 채웠을 수 있어(이월 없는 구독) 잔액만으로는 틈을 메우지 않는다.
    if (!weekly) known = b.t - a.t <= 2 * DAY;
    // 창이 없던 읽기(그 주에 안 씀) 뒤에는 다음 읽기의 누적 %가 새 창 시작부터 덮는다 — 그 사이에 창 하나가 통째로 시작하고 끝날 수 없을 때(7일 안).
    else if (!a.wr) known = b.t - a.t < WEEK;
    // 같은 창이면 틈이 있어도 누적 %가 메운다. 창이 바뀌었으면 끝나기 하루 안에 읽었고, 빠진 창이 없어야 한다
    // (다음 읽기에 창이 없으면 옛 창이 끝난 뒤 7일 안이어야 그 사이 창 하나를 통째로 놓치지 않는다 — Fable 2차 반영 확인 P2).
    else if (!(b.wr && Math.abs(a.wr - b.wr) < SAME_WINDOW)) known = a.wr - a.t <= DAY && (b.wr ? b.wr - a.wr <= WEEK + DAY : b.t - a.wr < WEEK);
  }
  const withH = samples.filter(s => s.h !== null && s.h !== undefined), recentH = withH.filter(s => s.t >= start).map(s => s.h * scale(s));
  return {
    cover: coverFrom !== null && coverFrom <= start,
    known,
    hCover: withH.length > 0 && withH[0].t <= start + DAY,
    hPeak: recentH.length ? round(Math.max(...recentH)) : null,
    weeks,
  };
}

// 계정 하나의 지난 12주(7일씩, 오래된 → 최근): 연간 결제 팁(10-19 3차, Fable 1차 아이디어 7)이 「12주 내내 꾸준히」를 본다.
//  used는 그 7일에 쓴 양만 센다(지금 요금제 기준). 읽은 가장 높은 %는 앞 구간에서 이어진 창의 누적까지 담아 「많이 썼다」를 부풀리므로 쓰지 않고,
//  놓친 틈은 적게 잡히는 쪽이라 그대로 둔다. cover: 첫 읽기가 12주 앞이었는지(첫 읽기의 누적 %가 12주 안 소비로 들어오지 않게). reads: 그 7일에 읽은 횟수.
//  samePlan: 12주 동안 읽은 요금제가 모두 지금과 같은지 — Max에서 Pro로 내린 계정의 옛 구간이 지금 무게로 ×5·×20 부풀어
//  「12주 내내 꾸준히」가 되지 않게 연간 결제 팁은 같은 요금제 12주만 본다(Fable 3차 시안 P3-3).
//  한도형은 무게로 견주고(등급을 한 번 못 읽은 「max」를 봐준다), 크레딧형은 무게가 늘 1이라 요금제 이름으로 견준다(Ultra → Plus로 내린 계정 — 구현 검수 P3-A).
function lastTwelveWeeks(samples, events, firstAt, now, cur, plan) {
  const weekly = WEEKLY.has(samples[0].s), reads = samples.filter(s => (weekly ? s.w !== null : s.c !== null));
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const from = now - (12 - i) * WEEK, end = now - (11 - i) * WEEK, inside = t => t >= from && (t < end || (i === 11 && t <= end));
    return { used: Math.round((events.reduce((n, e) => (inside(e.t) ? n + (e.v * (e.wt || 1)) / cur : n), 0)) * 100) / 100, reads: reads.filter(s => inside(s.t)).length };
  });
  const samePlan = samples.filter(s => s.t >= now - 12 * WEEK).every(s => (weekly ? weightOf(s.s, s.p) === cur : planKey(s.p) === planKey(plan)));
  return { cover: firstAt !== null && firstAt <= now - 12 * WEEK, samePlan, weeks };
}

module.exports = { usageSummary, sampleOf, parseHistory, accountEvents, weightOf, KEEP, WEEKLY, CREDIT };
