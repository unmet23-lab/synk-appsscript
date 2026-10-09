// Compare only sourced, bounded visiting conditions. This does not plan routes,
// infer cheaper products, confirm live opening, or consume the saved taste state.
export const REAL_CONDITION_LABELS = Object.freeze({
  none: '조건 없음', matched: '안내상 조건 맞음', unknown: '확인 필요', unmatched: '조건과 다름',
});
export const REAL_CONDITION_MAX_AGE_DAYS = 30;
export const REAL_CONDITION_MAX_BUDGET = 1000000;
const DAY = 86400000;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value))
  && Object.keys(value).every(key => !['__proto__', 'prototype', 'constructor'].includes(key));
const dateValid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith('0000-')
  && Number.isFinite(Date.parse(value + 'T00:00:00.000Z')) && new Date(value + 'T00:00:00.000Z').toISOString().slice(0, 10) === value;
const day = value => Date.parse(value + 'T00:00:00.000Z') / DAY;
const timeValid = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const minute = value => value === '24:00' ? 1440 : Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const https = value => { try { const url = new URL(value); return typeof value === 'string' && url.protocol === 'https:' && !url.username && !url.password; } catch { return false; } };
function invalid(field, message) { const error = new TypeError(message); error.field = field; throw error; }
export function normalizeRealQuery(input = {}) {
  if (!plain(input) || Object.keys(input).some(key => !['date', 'time', 'budget'].includes(key))) invalid('query', '방문 조건을 확인해 주세요.');
  const { date = '', time = '', budget = null } = input;
  if (date !== '' && !dateValid(date)) invalid('date', '실제 달력에 있는 날짜를 YYYY-MM-DD로 입력해 주세요.');
  if (time !== '' && !timeValid(time)) invalid('time', '시간을 00:00부터 23:59 사이로 입력해 주세요.');
  if (budget !== null && (!Number.isSafeInteger(budget) || budget < 0 || budget > REAL_CONDITION_MAX_BUDGET)) invalid('budget', '한 곳의 성인 1명 예산을 0~1,000,000원 정수로 입력해 주세요.');
  return { date, time, budget: budget === 0 ? 0 : budget };
}
function koreanToday(now) {
  const value = now ?? new Date().toISOString();
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) invalid('now', '조건을 확인하는 시각이 올바르지 않습니다.');
  return new Date(Date.parse(value) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
const check = (status, reason, extra = {}) => ({ status, label: REAL_CONDITION_LABELS[status], reason, ...extra });
const partialReason = (...sources) => sources.map(source => source?.note).find(note => typeof note === 'string' && note.trim())
  ?? '운영 안내가 일부만 확인되어 전체 방문 조건은 추가 확인이 필요해요.';
function freshIssue(data, date, today) {
  if (!plain(data) || !dateValid(data.verifiedAt) || !https(data.sourceUrl)) return '조건을 비교할 공식 출처나 확인일이 없어요.';
  if (day(data.verifiedAt) > day(today)) return '확인일이 현재보다 미래여서 안내를 다시 확인해야 해요.';
  if (day(today) - day(data.verifiedAt) > REAL_CONDITION_MAX_AGE_DAYS) return '공식 안내를 확인한 지 30일이 지나 다시 확인해야 해요.';
  if (date && day(date) - day(data.verifiedAt) > REAL_CONDITION_MAX_AGE_DAYS) return '방문일이 안내 확인일로부터 30일을 넘어 다시 확인해야 해요.';
  return null;
}
function calendarStatus(calendar, date, today) {
  if (freshIssue(calendar, date, today) || !dateValid(calendar.from) || !dateValid(calendar.through)
    || day(calendar.from) > day(calendar.through) || day(date) < day(calendar.from) || day(date) > day(calendar.through)
    || !Array.isArray(calendar.holidays) || calendar.holidays.length > 370 || new Set(calendar.holidays).size !== calendar.holidays.length
    || calendar.holidays.some(value => !dateValid(value) || day(value) < day(calendar.from) || day(value) > day(calendar.through))) return null;
  return calendar.holidays.includes(date);
}
const slotValid = slot => plain(slot) && timeValid(slot.open) && (timeValid(slot.close) || slot.close === '24:00')
  && minute(slot.open) < minute(slot.close)
  && (!Object.hasOwn(slot, 'lastEntry') || timeValid(slot.lastEntry) && minute(slot.lastEntry) >= minute(slot.open) && minute(slot.lastEntry) <= minute(slot.close));
const slotsValid = slots => Array.isArray(slots) && slots.length <= 8 && slots.every(slotValid)
  && slots.every((slot, index) => index === 0 || minute(slots[index - 1].close) <= minute(slot.open));
function partialAt(hours, query, weekday) {
  if (hours.partialExtensions === undefined) return false;
  if (!Array.isArray(hours.partialExtensions) || hours.partialExtensions.length > 32) return null;
  let partial = false;
  for (const row of hours.partialExtensions) {
    if (!plain(row) || !dateValid(row.from) || !dateValid(row.through) || day(row.from) > day(row.through)
      || !Array.isArray(row.weekdays) || !row.weekdays.length || row.weekdays.some(value => !Number.isInteger(value) || value < 0 || value > 6)
      || !slotsValid(row.slots) || row.sourceUrl !== undefined && !https(row.sourceUrl)) return null;
    if (day(query.date) >= day(row.from) && day(query.date) <= day(row.through) && row.weekdays.includes(weekday)
      && row.slots.some(slot => !query.time || minute(query.time) >= minute(slot.open) && minute(query.time) < minute(slot.lastEntry ?? slot.close))) partial ||= row;
  }
  return partial;
}
function scheduleCheck(place, query, today, calendar, stayMinutes = null) {
  if (!query.date && !query.time) return check('none', '방문 날짜·시간 조건을 고르지 않았어요.');
  if (!query.date) return check('unknown', '시간만으로는 운영 요일·공휴일을 확인할 수 없어요. 방문 날짜도 골라 주세요.');
  if (day(query.date) < day(today)) return check('unknown', '지난 날짜의 방문 계획은 현재 안내로 확정할 수 없어요.');
  const hours = place?.conditions?.hours, issue = freshIssue(hours, query.date, today);
  if (issue) return check('unknown', issue);
  if ((hours.validFrom !== undefined && (!dateValid(hours.validFrom) || day(query.date) < day(hours.validFrom)))
    || (hours.validThrough !== undefined && (!dateValid(hours.validThrough) || day(query.date) > day(hours.validThrough)))) return check('unknown', '이 날짜에 적용되는 운영기간 안내를 다시 확인해 주세요.');
  if (!['full', 'partial'].includes(hours.scope)) return check('unknown', '운영 안내가 어느 공간에 적용되는지 확인이 필요해요.');
  if (hours.exceptions !== undefined && (!plain(hours.exceptions) || Object.keys(hours.exceptions).some(date => !dateValid(date)))) return check('unknown', '날짜별 운영 예외 안내를 다시 확인해 주세요.');
  const override = hours.exceptions?.[query.date];
  let slots, scope = hours.scope, sourceUrl = hours.sourceUrl;
  if (override !== undefined) {
    if (!plain(override) || (override.scope !== undefined && !['full', 'partial'].includes(override.scope))) return check('unknown', '해당 날짜의 운영 예외를 다시 확인해 주세요.');
    const overrideIssue = freshIssue({ ...hours, ...override }, query.date, today);
    if (overrideIssue) return check('unknown', overrideIssue);
    sourceUrl = override.sourceUrl ?? sourceUrl;
    scope = override.scope ?? (override.closed === true ? 'full' : scope);
    if (scope === 'partial') return check('unknown', partialReason(override, hours), { sourceUrl });
    if (override.closed === true && !Object.hasOwn(override, 'slots')) return check('unmatched', '해당 날짜는 공식 안내상 휴관·휴무예요.', { sourceUrl });
    if (override.closed !== undefined && override.closed !== false) return check('unknown', '해당 날짜의 휴관 여부가 명확하지 않아요.');
    slots = override.slots;
  } else {
    const holiday = calendarStatus(calendar, query.date, today);
    if (holiday === null) return check('unknown', '방문일의 공휴일 달력 확인 범위가 없어 운영 확인이 필요해요.');
    if (holiday && hours.holidayPolicy === 'closed') return scope === 'partial'
      ? check('unknown', partialReason(hours), { sourceUrl })
      : check('unmatched', '해당 공휴일은 공식 안내상 휴관·휴무예요.', { sourceUrl });
    if (holiday && hours.holidayPolicy !== 'same') return check('unknown', '공휴일의 별도 운영시간·휴무를 공식 안내에서 확인해 주세요.');
    if (!plain(hours.weekly) || Object.keys(hours.weekly).some(value => !/^[0-6]$/.test(value))) return check('unknown', '요일별 운영 안내가 충분하지 않아요.');
    slots = hours.weekly[String(new Date(query.date + 'T00:00:00.000Z').getUTCDay())];
  }
  if (!slotsValid(slots)) return check('unknown', scope === 'partial' ? partialReason(hours) : '해당 요일의 운영시간·입장 마감 안내를 확인해 주세요.');
  const weekday = new Date(query.date + 'T00:00:00.000Z').getUTCDay();
  const partial = partialAt(hours, query, weekday);
  if (partial === null) return check('unknown', '기간 한정 일부 공간의 운영 안내를 다시 확인해 주세요.');
  // An empty weekly row declares a venue-wide regular closing day. Partial
  // areas on otherwise open days must not mask this confirmed closure. A
  // sourced holiday override or partial extension is resolved above first.
  if (!slots.length && !partial) return check('unmatched', '해당 요일은 공식 안내상 휴관·휴무예요.', { sourceUrl });
  if (scope === 'partial') return check('unknown', partialReason(hours), { sourceUrl });
  if (!slots.length && !query.time && partial) return check('unknown', '해당 날짜에는 일부 공간의 연장 운영만 안내되어 있어요. 대상 공간을 확인해 주세요.', { sourceUrl: partial.sourceUrl ?? sourceUrl });
  if (!query.time) return check('matched', '해당 날짜는 안내상 운영일이에요. 방문 시각과 당일 변동은 별도로 확인해 주세요.', { sourceUrl });
  const current = minute(query.time);
  const matchingSlot = slots.find(slot => current >= minute(slot.open) && current < minute(slot.lastEntry ?? slot.close));
  if (matchingSlot && stayMinutes !== null) {
    const end = current + stayMinutes;
    if (end > 1440) return check('unknown', '체류 종료가 자정을 넘어 당일 운영 안내로 연결할 수 없어요.', { sourceUrl });
    if (end > minute(matchingSlot.close)) {
      const extension = hours.partialExtensions?.find(row => day(query.date) >= day(row.from) && day(query.date) <= day(row.through)
        && row.weekdays.includes(weekday) && row.slots.some(slot => minute(slot.open) <= minute(matchingSlot.close) && end <= minute(slot.close)));
      if (extension) return check('unknown', '체류 중 일반 운영시간이 끝나 일부 공간의 연장 운영 대상인지 확인이 필요해요.', { sourceUrl: extension.sourceUrl ?? sourceUrl });
      return check('unmatched', '입장은 가능한 시각이지만 입력한 체류가 운영 종료나 쉬는 시간을 넘어요.', { sourceUrl });
    }
    return check('matched', matchingSlot.lastEntry
      ? '도착은 안내된 입장·운영시간 안이고 입력한 체류도 같은 운영 구간 안에 끝나요. 당일 변동은 확인해 주세요.'
      : '도착과 입력한 체류가 같은 운영 구간 안에 있어요. 입장·주문 마감과 당일 변동은 별도로 확인해 주세요.', { sourceUrl });
  }
  if (matchingSlot) return check('matched', matchingSlot.lastEntry
    ? '고른 시각은 공식 안내의 운영시간과 입장 마감 안에 있어요. 당일 변동은 확인해 주세요.'
    : '고른 시각은 공식 안내의 운영시간 안이에요. 입장·주문 마감과 당일 변동은 별도로 확인해 주세요.', { sourceUrl });
  if (partial) return check('unknown', '고른 시각에는 일부 공간의 연장 운영만 안내되어 있어요. 대상 공간과 입장 조건을 확인해 주세요.', { sourceUrl: partial.sourceUrl ?? sourceUrl });
  return check('unmatched', '고른 시각은 공식 안내의 운영시간·입장 마감 밖이에요.', { sourceUrl });
}
// Shared by the course builder: departure is bounded by closing, not by the
// earlier admission cutoff. Reuse every date/holiday/freshness/partial rule.
export function evaluateRealStay(place, input = {}, { now, calendar } = {}) {
  if (!plain(input) || Object.keys(input).some(key => !['date', 'time', 'stayMinutes'].includes(key))) invalid('stay', '방문과 체류 조건을 확인해 주세요.');
  const { date = '', time = '', stayMinutes = null } = input;
  const query = normalizeRealQuery({ date, time });
  if (stayMinutes !== null && (!Number.isSafeInteger(stayMinutes) || stayMinutes < 1 || stayMinutes > 1440)) invalid('stayMinutes', '체류 시간은 1~1,440분 정수로 입력해 주세요.');
  const result = scheduleCheck(place, query, koreanToday(now), calendar, stayMinutes);
  if (result.status === 'unmatched' || result.status === 'unknown') return result;
  if (!date || !time || stayMinutes === null) return check('unknown', '날짜·도착 시각·체류 시간을 모두 입력해야 방문 시간을 비교할 수 있어요.', result.sourceUrl ? { sourceUrl: result.sourceUrl } : {});
  return result;
}
const amountValid = value => Number.isSafeInteger(value) && value >= 0;
const won = value => value.toLocaleString('ko-KR') + '원';
function budgetCheck(place, query, today) {
  if (query.budget === null) return check('none', '한 곳의 성인 1명 예산을 고르지 않았어요.');
  if (query.date && day(query.date) < day(today)) return check('unknown', '지난 날짜의 요금은 현재 안내로 확정할 수 없어요.');
  if (place?.category === 'stay' || place?.conditions?.price?.scope === 'room') return check('unknown', '숙박은 날짜·객실·인원에 따라 달라 이 1인 예산 비교에서 제외해요.');
  let price = place?.conditions?.price;
  const issue = freshIssue(price, query.date, today);
  if (issue) return check('unknown', issue);
  if (price.exceptions !== undefined) {
    if (!plain(price.exceptions) || Object.keys(price.exceptions).some(date => !dateValid(date))) return check('unknown', '날짜별 가격 예외를 확인해 주세요.');
    if (Object.keys(price.exceptions).length && !query.date) return check('unknown', '날짜별 무료·별도 요금 안내가 있어 방문 날짜를 고른 뒤 비교해 주세요.');
    const override = price.exceptions[query.date];
    if (override !== undefined) {
      if (!plain(override)) return check('unknown', '해당 날짜의 가격 예외를 확인해 주세요.');
      price = { ...price, ...override };
      const overrideIssue = freshIssue(price, query.date, today);
      if (overrideIssue) return check('unknown', overrideIssue);
    }
  }
  if (!['adult-one', 'menu-item'].includes(price.scope) || typeof price.label !== 'string' || !price.label.trim()
    || !['included', 'not-stated'].includes(price.taxStatus)) return check('unknown', '성인 1명의 어떤 상품 가격인지 공식 안내를 확인해 주세요.');
  if (price.kind === 'unknown') return check('unknown', '비교할 성인 1명 상품의 공식 가격이 확인되지 않았어요.', { sourceUrl: price.sourceUrl });
  const qualifier = price.taxStatus === 'not-stated' ? ' 표시금액 기준이며 세금·추가비는 별도로 확인해 주세요.' : '';
  if (price.kind === 'free') {
    if (price.scope !== 'adult-one' || price.amount !== undefined && price.amount !== 0) return check('unknown', '무료로 이용할 수 있는 대상과 조건을 확인해 주세요.');
    return check('matched', `${price.label}은 성인 1명 무료 안내 기준으로 예산 안이에요.`, { sourceUrl: price.sourceUrl });
  }
  if (['exact', 'sample'].includes(price.kind)) {
    if (!amountValid(price.amount)) return check('unknown', '공식 가격의 금액을 다시 확인해 주세요.');
    const sample = price.kind === 'sample' || price.scope === 'menu-item';
    if (query.budget >= price.amount) return check('matched', `${price.label} ${won(price.amount)}의 ${sample ? '해당 예시 상품 ' : '성인 1명 '}표시금액 기준으로 예산 안이에요.${qualifier}`, { sourceUrl: price.sourceUrl });
    return sample
      ? check('unknown', `${price.label} ${won(price.amount)}은 예산을 넘지만 다른 저가 메뉴의 가격은 확인되지 않았어요.`, { sourceUrl: price.sourceUrl })
      : check('unmatched', `${price.label} 성인 1명 ${won(price.amount)}이 고른 예산 ${won(query.budget)}을 넘어요.`, { sourceUrl: price.sourceUrl });
  }
  if (['minimum', 'range'].includes(price.kind)) {
    if (!amountValid(price.min) || price.kind === 'range' && (!amountValid(price.max) || price.max < price.min)) return check('unknown', '안내된 가격 범위의 기준을 다시 확인해 주세요.');
    if (price.scope === 'adult-one' && price.min > query.budget) return check('unmatched', `${price.label}의 안내된 하한 ${won(price.min)}도 고른 예산을 넘어요.`, { sourceUrl: price.sourceUrl });
    return check('unknown', '최저 금액이나 가격 범위만으로 실제 고를 상품이 예산 안이라고 확정할 수 없어요.', { sourceUrl: price.sourceUrl });
  }
  return check('unknown', '비교할 수 있는 공식 가격 형태가 아니어서 확인이 필요해요.');
}
export function evaluateRealConditions(place, input = {}, { now, calendar } = {}) {
  const query = normalizeRealQuery(input), today = koreanToday(now);
  const checks = { schedule: scheduleCheck(place, query, today, calendar), budget: budgetCheck(place, query, today) };
  const active = Object.values(checks).filter(row => row.status !== 'none');
  const status = !active.length ? 'none' : active.some(row => row.status === 'unmatched') ? 'unmatched' : active.some(row => row.status === 'unknown') ? 'unknown' : 'matched';
  return { status, label: REAL_CONDITION_LABELS[status], reasons: active.map(row => row.reason), checks };
}
