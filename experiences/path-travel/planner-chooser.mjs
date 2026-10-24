// 첫 화면 고르기(하고 싶은 것 → 몇 시간)의 시간·장소·동선 제약. DOM과 화면 전역 없이 명시한 입력만 받아 결과를 돌려준다.
// 화면(planner-ui.mjs)은 출발 입력·고른 것·시간을 읽어 넘기고 돌아온 창·후보·짝·곳 수를 그리기만 한다.
// 걷기는 엔진의 estimateWalkingLeg, 운영 시각은 real-conditions의 evaluateRealStay를 그대로 불러 쓴다 — 정책 사본을 두지 않는다.
//
// 요청(request)
//  now      ISO 시각. 「오늘」「지금」의 기준(Asia/Seoul로 읽는다).
//  query    출발 입력 { origin:{id,name,lat,lon}, date, startTime }. date·startTime은 사용자가 폼에서 직접 정했을 때만 주고
//           아니면 null(고르기가 폼에 써 넣은 값은 직접 정한 것으로 보지 않는다).
//  picks    고른 것(CHOOSER_INTENTS의 id, 최대 3개).
//  hours    쓸 시간(CHOOSER_HOURS의 키: 1·2·3·5·8).
//  places   장소 자료(보통 TRAVEL_PLACES).
//  routeLeg 지도 길 찾기 함수 또는 null(직선 추정).
//  calendar 공휴일 달력(생략하면 엔진과 같은 REAL_CONDITION_CALENDAR).
import { estimateWalkingLeg } from './planner.mjs';
import { evaluateRealStay } from './real-conditions.mjs';
import { REAL_CONDITION_CALENDAR } from './real-places.mjs';

const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) freeze(child); } return value; };
// 하고 싶은 것 → 엔진 취향(prefs)과 실제 장소 표시(check). 궁궐은 역사+산책, 골목은 산책+야외라서
// 취향으로 서로 갈리고, 넣었는지는 진짜 궁·한옥 골목·시장 표시로 확인한다.
export const CHOOSER_INTENTS = freeze({ food: { short: '맛집', prefs: { food: true }, check: { category: 'food' } }, tea: { short: '차', prefs: { tea: true }, check: { category: 'tea' } }, art: { short: '전시', prefs: { art: true }, check: { feature: 'art' } },
  palace: { short: '궁궐', prefs: { history: true, walk: true }, check: { feature: 'palace' } }, alley: { short: '골목', prefs: { walk: true, outdoor: true }, check: { feature: 'hanok', category: 'culture' } }, market: { short: '시장', prefs: { marketFood: true }, check: { feature: 'market' } } });
// 고르기가 켜고 끄는 취향(고른 것들의 prefs). 순서는 CHOOSER_INTENTS 순서다.
export const CHOOSER_MANAGED_PREFERENCES = freeze([...new Set(Object.values(CHOOSER_INTENTS).flatMap(intent => Object.keys(intent.prefs)))]);
// 쓸 시간 → 장소 수·걷기 상한. 상한은 넉넉히 두고 엔진이 덜 걷는 쪽을 고른다.
export const CHOOSER_HOURS = freeze({ 1: { label: '1시간', stops: 1, walk: 20 }, 2: { label: '2시간', stops: 2, walk: 50 }, 3: { label: '3시간', stops: 3, walk: 70 }, 5: { label: '반나절', stops: 4, walk: 100 }, 8: { label: '하루', stops: 5, walk: 150 } });
export const CHOOSER_HOUR_STEPS = freeze(Object.keys(CHOOSER_HOURS).map(Number));
// 점심을 걸치는 반나절 이상이면 식사 한 끼를 넣는다.
const lunchIncluded = (span, hours) => hours >= 5 && span.start <= 720 && span.end >= 810;
// 다른 곳 하나를 더 붙일 때 어림하는 가장 짧은 곳(걷고 머무는 시간 ≈ 40분)
const SHORT_STOP = 40;

export const minutesOf = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
export const clockText = value => String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
export const seoulDate = at => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
export const seoulMinutes = at => minutesOf(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at)));
export const seoulDay = date => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(date + 'T12:00:00+09:00'));
const nextDate = date => { const day = new Date(date + 'T00:00:00Z'); day.setUTCDate(day.getUTCDate() + 1); return day.toISOString().slice(0, 10); };

// 저장한 조건이나 엔진 결과의 취향에서 고른 것을 다시 읽는다.
export function dayIntents(query) { return Object.keys(CHOOSER_INTENTS).filter(id => Object.entries(CHOOSER_INTENTS[id].prefs).every(([key, value]) => query.preferences?.[key] === value)); }
// 엔진에 넘기는 고른 것의 장소 표시(planTravel의 intents). 여행 조건에는 들어가지 않는다.
export function dayIntentRules(query) { return dayIntents(query).map(id => ({ id, ...CHOOSER_INTENTS[id].check })); }
export function servesDayIntent(place, id) { const rule = CHOOSER_INTENTS[id].check; return (!rule.category || place.category === rule.category) && (!rule.feature || place.features?.[rule.feature] === true); }

function checked(request, { picks = false } = {}) {
  const { now, query, hours, places, routeLeg = null } = request ?? {};
  if (typeof now !== 'string' || !Number.isFinite(Date.parse(now))) throw new TypeError('고르기 기준 시각(now)을 ISO 문자열로 주세요.');
  if (!Object.hasOwn(CHOOSER_HOURS, hours)) throw new TypeError('고르기 시간(hours)은 1·2·3·5·8 가운데 하나예요.');
  if (!Array.isArray(places)) throw new TypeError('고르기 장소 자료(places)를 주세요.');
  if (!Number.isFinite(query?.origin?.lat) || !Number.isFinite(query?.origin?.lon)) throw new TypeError('고르기 출발점(query.origin)의 위치를 주세요.');
  if (routeLeg !== null && typeof routeLeg !== 'function') throw new TypeError('길 찾기(routeLeg)는 함수 또는 null이에요.');
  if (picks && (!Array.isArray(request.picks) || request.picks.some(id => !Object.hasOwn(CHOOSER_INTENTS, id)))) throw new TypeError('고른 것(picks)을 확인해 주세요.');
  return request;
}
const intentOf = id => { if (!Object.hasOwn(CHOOSER_INTENTS, id)) throw new TypeError('고른 것을 확인해 주세요.'); return id; };

// 사용자가 직접 정한 날짜·출발 시각이 있으면 그날 그 시각부터(오늘이면 지금 이후로). 아니면 오늘 남은 시간에 들어갈 때
// 10분 뒤 출발, 안 되면 내일 10시. 긴 일정은 저녁 8시, 짧은 일정은 9시까지 끝낸다.
// 직접 정한 시각을 옮겼으면 까닭(shift: 이미 지남 past · 너무 이른 시각 early · 늦게 끝남 late)을 같이 돌려준다.
export function chooserWindow(request) {
  const { now, hours, query } = checked(request);
  const today = seoulDate(now), tomorrow = nextDate(today), span = hours * 60, latest = hours >= 5 ? 1200 : 1260;
  const soon = Math.ceil((seoulMinutes(now) + 10) / 10) * 10, soonest = Math.max(600, soon);
  const date = query.date ?? null;
  if (date !== null && date >= today) {
    const asked = /^\d\d:\d\d$/.test(query.startTime) ? minutesOf(query.startTime) : 600, first = date === today ? Math.max(540, soon) : 540, start = Math.max(first, Math.min(asked, latest - span));
    const shift = asked === start ? null : asked > start ? 'late' : date === today && asked < soon ? 'past' : 'early';
    if (start + span <= latest) return { date, start, end: start + span, when: date === today ? '오늘' : date === tomorrow ? '내일' : seoulDay(date), today: date === today, asked, shift };
  }
  return soonest + span <= latest ? { date: today, start: soonest, end: soonest + span, when: '오늘', today: true } : { date: tomorrow, start: 600, end: 600 + span, when: '내일', moved: true };
}

// 계산 기억. 같은 입력(장소 자료·달력·길 찾기 함수는 객체 그대로)이면 같은 결과라 다시 세지 않는다.
const identities = new WeakMap(); let identity = 0;
const idOf = value => { if (value == null) return 0; if (!identities.has(value)) identities.set(value, ++identity); return identities.get(value); };
const optionMemo = new Map(), legMemo = new Map();
const remember = (memo, key, make) => { if (!memo.has(key)) { if (memo.size >= 2000) memo.clear(); memo.set(key, make()); } return memo.get(key); };
const opensAt = (place, span, arrive, now, calendar) => evaluateRealStay(place, { date: span.date, time: clockText(arrive), stayMinutes: place.planningStayMinutes }, { now, calendar }).status !== 'unmatched';

// 고른 것 하나에 대해 출발점에서 갈 수 있는 곳의 걷는 상단(walk)·걷고 머무는 시간(total). 엔진이 일정을 짜기 전에 시간 화면에서 미리 알려 준다.
// 그 시간에 고르기가 잡을 날짜·시각에 문을 연 곳만 센다(쉬는 날인 궁·미술관은 빼고, 안내가 없는 곳은 엔진처럼 후보로 둔다).
export function chooserPickOptions(id, request) {
  const { now, query: { origin }, places, routeLeg = null, calendar = REAL_CONDITION_CALENDAR } = checked(request);
  intentOf(id);
  const span = chooserWindow(request);
  const key = [id, origin.lat, origin.lon, idOf(routeLeg), span.date, span.start, span.end, seoulDate(now), idOf(places), idOf(calendar)].join('|');
  return remember(optionMemo, key, () => {
    const opens = (place, walk) => { for (let arrive = span.start + walk; arrive + place.planningStayMinutes <= span.end; arrive += 30) if (opensAt(place, span, arrive, now, calendar)) return true; return false; };
    return Object.freeze(places.filter(place => place.dayPlannerEligible !== false && place.coordinates && servesDayIntent(place, id))
      .map(place => { const leg = estimateWalkingLeg(origin, place, { routeLeg }); return Object.freeze({ place, walk: leg.maxMinutes, total: leg.maxMinutes + place.planningStayMinutes }); })
      .filter(row => opens(row.place, row.walk)));
  });
}
const walkable = (id, request) => chooserPickOptions(id, request).filter(row => row.walk <= CHOOSER_HOURS[request.hours].walk);
// 이 시간 안에 걸어가 머물 곳이 하나라도 있는지
export function chooserPickFits(id, request) { return chooserPickOptions(id, request).some(row => row.total <= request.hours * 60 && row.walk <= CHOOSER_HOURS[request.hours].walk); }
// 한 곳을 더 붙일 여유(가장 짧은 다른 곳 ≈ 40분)가 있는지
const pickPairs = (id, request) => chooserPickOptions(id, request).some(row => row.total + SHORT_STOP <= request.hours * 60 && row.walk <= CHOOSER_HOURS[request.hours].walk);
// 걷기 상한 안의 곳 가운데 가장 짧은 걷고 머무는 시간(없으면 Infinity)
export function chooserPickMinutes(id, request) { return Math.min(...walkable(id, request).map(row => row.total)); }

// 길 찾기(경로 거리÷50+3분)와 직선 추정 어느 쪽보다도 길지 않은 하한
const legFloor = (a, b) => { const plain = estimateWalkingLeg(a, b); return Math.min(Math.max(2, Math.ceil(plain.distanceMeters / 50 + 3)), plain.maxMinutes); };
const legBetween = (a, b, routeLeg) => remember(legMemo, [idOf(a), idOf(b), idOf(routeLeg)].join('|'), () => estimateWalkingLeg(a, b, { routeLeg }).maxMinutes);
// 고른 두 가지를 그 시간에 한 일정으로 이을 수 있는지: 모든 후보 짝을 두 순서로, 엔진과 같은 걷기 추정(상단)·머무는 시간·
// 운영 시각으로 본다. 여는 시각까지는 15분씩 1시간까지 기다려 본다. 길 찾기는 직선거리 하한으로 거른 짝에만 돌린다.
export function chooserPairFits(a, b, request) {
  const { now, routeLeg = null, calendar = REAL_CONDITION_CALENDAR } = checked(request);
  intentOf(a); intentOf(b);
  const span = chooserWindow(request);
  const enter = (place, from) => { for (let arrive = from; arrive <= from + 60 && arrive + place.planningStayMinutes <= span.end; arrive += 15) if (opensAt(place, span, arrive, now, calendar)) return arrive; return null; };
  const rowsA = walkable(a, request), rowsB = walkable(b, request);
  for (const x of rowsA) for (const y of rowsB) for (const [first, second] of [[x, y], [y, x]]) {
    if (first.place.id === second.place.id) continue;
    const stay = second.place.planningStayMinutes, earliest = span.start + first.walk + first.place.planningStayMinutes;
    if (earliest + legFloor(first.place, second.place) + stay > span.end) continue;
    const arrive = enter(first.place, span.start + first.walk); if (arrive === null) continue;
    const next = enter(second.place, arrive + first.place.planningStayMinutes + legBetween(first.place, second.place, routeLeg));
    if (next !== null) return true;
  }
  return false;
}

// 이 시간에 넣을 고른 것과 들어갈 곳 수.
//  fits·misses  이 시간에 들어가는/못 들어가는 고른 것
//  long·left·together  2시간에 다른 곳과 짝을 못 짓는 긴 곳(전시·궁궐 등)을 고르면 그 한 곳으로 잡고, 같이 고른 다른 것(left)은
//                      이번에 빼며 몇 시간부터 같이 들어가는지(together) 알린다.
//  apart        따로는 들어가도 한 일정으로 잇지 못하는 두 가지(예: 늦은 오후의 궁궐과 찻집). 긴 쪽 없이 곳 수를 다시 어림한다.
//  count·used   들어갈 곳 수(고른 곳의 걷고 머무는 시간으로 어림)와 이번에 취향을 켤 고른 것
export function planChooser(request) {
  checked(request, { picks: true });
  const picks = [...request.picks], span = chooserWindow(request), hours = CHOOSER_HOURS[request.hours], minutes = request.hours * 60;
  const fits = picks.filter(id => chooserPickFits(id, request)), misses = picks.filter(id => !fits.includes(id));
  const long = hours.stops === 2 ? fits.find(id => !pickPairs(id, request)) : undefined;
  if (long) {
    const left = fits.filter(id => id !== long), both = [long, ...left];
    const together = [3, 5, 8].find(h => { const at = { ...request, hours: h }; return both.every(id => chooserPickFits(id, at)) && both.reduce((sum, id) => sum + chooserPickMinutes(id, at), 0) <= h * 60; });
    return { span, fits, misses, long, left, count: 1, used: picks.filter(id => !left.includes(id)), together };
  }
  // 고른 곳들의 걷고 머무는 시간에 짧은 곳(≈40분)을 더해 몇 곳쯤 들어갈지 어림한다.
  const estimate = list => { const need = list.slice(0, hours.stops).map(id => chooserPickMinutes(id, request)); let count = need.length, used = need.reduce((sum, value) => sum + value, 0);
    while (count < hours.stops && (!need.length || used + SHORT_STOP <= minutes)) { count++; used += SHORT_STOP; } return count; };
  let count = estimate(fits);
  const shown = fits.slice(0, Math.min(hours.stops, count)); let apart = null;
  for (let i = 0; i < shown.length && !apart; i++) for (let j = i + 1; j < shown.length && !apart; j++) if (!chooserPairFits(shown[i], shown[j], request)) apart = [shown[i], shown[j]];
  if (apart) { const longer = chooserPickMinutes(apart[0], request) >= chooserPickMinutes(apart[1], request) ? apart[0] : apart[1]; count = estimate(fits.filter(id => id !== longer)); }
  return { span, fits, misses, long, left: [], count: Math.max(1, count), used: picks, apart };
}

// 이 시간에 못 들어가는 고른 것이 몇 시간부터 넉넉한지. 같은 날 안에서 먼저 찾고(sameDay), 없으면 다른 날까지(anyDay).
export function chooserLaterHours(id, request) {
  checked(request); intentOf(id);
  const span = chooserWindow(request), at = hours => ({ ...request, hours });
  const sameDay = CHOOSER_HOUR_STEPS.find(h => chooserWindow(at(h)).date === span.date && chooserPickFits(id, at(h)));
  return { sameDay, anyDay: sameDay ?? CHOOSER_HOUR_STEPS.find(h => chooserPickFits(id, at(h))) };
}

// 폼에서 읽은 여행 조건(raw)에 고르기의 시간·곳 수·걷기 상한·고른 것의 취향을 덮는다. 폼 값을 먼저 검사하지 않고 덮은 뒤
// 엔진의 normalizePlannerInput이 한 번만 검사한다. 고른 것이 아닌 폼의 선택(피하기·세부 맛·필수 조건·동행·인원·예산·출발점)은 그대로 둔다.
//  handPreferences  폼에서 직접 켠 취향(고르기가 끄지 않는다)
//  foodByHand       「식사를 꼭 포함」을 폼에서 직접 고쳤는지(고쳤으면 그 값을 따른다)
// changes는 이 시간 밖이라 뺀 예약·약속(appointments)과 식사 시간대(meal), 폼에 그대로 둘 원래 약속(kept)이다.
export function chooserTripInput(raw, request, { plan = planChooser(request), handPreferences = [], foodByHand = false } = {}) {
  checked(request);
  const span = plan.span, hours = CHOOSER_HOURS[request.hours], hand = new Set(handPreferences);
  const input = { ...raw, planningMode: 'day', date: span.date, startTime: clockText(span.start), endTime: clockText(span.end), stopCount: plan.long ? 1 : hours.stops, maxWalkMinutes: hours.walk, lockedIds: [], excludedIds: [] };
  const changes = { appointments: [], kept: [], meal: null };
  // 이번에 넣을 고른 것의 취향만 켜고, 고르기가 켰던 나머지는 끈다. 폼에서 직접 켠 것과 피하기는 그대로 둔다.
  const owned = new Set(plan.used.flatMap(id => Object.keys(CHOOSER_INTENTS[id].prefs))), preferences = { ...raw.preferences };
  for (const key of CHOOSER_MANAGED_PREFERENCES) if (owned.has(key)) preferences[key] = true; else if (preferences[key] === true && !hand.has(key)) delete preferences[key];
  input.preferences = preferences;
  if (input.meal.mode === 'none' && plan.used.includes('food')) input.meal = { mode: 'any', startTime: '12:00', endTime: '13:00' };
  if (input.meal.mode === 'window' && (input.meal.endTime < input.startTime || input.meal.startTime >= input.endTime)) { changes.meal = { ...input.meal }; input.meal = { mode: 'any', startTime: '12:00', endTime: '13:00' }; }
  // 식사 필수는 직접 고친 폼 값을 따르고, 아니면 이 시간에 들어가는 맛집을 골랐거나 반나절 이상이 점심을 걸칠 때만 넣는다.
  const meal = foodByHand ? raw.requiredCategories.includes('food') : input.meal.mode !== 'none' && (plan.used.includes('food') && plan.fits.includes('food') || lunchIncluded(span, request.hours));
  input.requiredCategories = [...raw.requiredCategories.filter(key => key !== 'food'), ...(meal ? ['food'] : [])];
  // 이 시간 밖의 예약·약속은 빼고 시간 화면에 알린다.
  const inside = row => row.time >= input.startTime && row.time < input.endTime;
  changes.kept = raw.appointments; changes.appointments = raw.appointments.filter(row => !inside(row)); input.appointments = raw.appointments.filter(inside);
  return { input, changes };
}

// 저장한 여행을 열 때: 앞날의 여행이면 그 날짜·출발 시각을 직접 정한 것으로 둔다(오늘·지난 여행은 고르기가 다시 잡는다).
export function chooserTimeFromSaved(query, now) {
  return query.date > seoulDate(now) ? { date: query.date, startTime: query.startTime } : null;
}
