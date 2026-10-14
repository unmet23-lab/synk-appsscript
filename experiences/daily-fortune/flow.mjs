// 30일 흐름 달력. 날짜마다 오늘 카드(daily.mjs)와 같은 계산을 써서 overall 값이 늘 일치한다.
import { seoulDateKey } from './core.mjs';
import { deepFreeze, addDays, weekdayOf, assertSupportedDate } from './fortune-base.mjs';
import { getDailyCard, TAGS } from './daily.mjs';
import { SAJU_MIN_DATE, SAJU_MAX_DATE } from './saju-core.mjs';

/**
 * @param {{ mode: 'western'|'korean', signId?: string, saju?: object, startDate?: string, days?: number }} options
 * @returns 흐름 객체(얼림). 사주 일간이 유보되면 null.
 */
export function getMonthFlow({ mode, signId, saju, startDate = seoulDateKey(), days = 30 } = {}) {
  assertSupportedDate(startDate);
  if (!Number.isInteger(days) || days < 1 || days > 62) throw new RangeError('흐름은 1일부터 62일까지 볼 수 있어요.');
  // 첫날로 입력을 먼저 검사한다(잘못된 별자리·사주는 여기서 오류, 일간 유보는 null).
  const first = getDailyCard({ mode, signId, saju, date: startDate });
  if (!first) return null;
  const items = Array.from({ length: days }, (_, index) => {
    const date = addDays(startDate, index);
    const reason = date > SAJU_MAX_DATE || date < SAJU_MIN_DATE ? '계산 지원 범위 밖의 날짜예요.' : null;
    if (reason) return { date, weekday: weekdayOf(date), available: false, overall: null, tag: null, tagLabel: null, label: reason };
    const card = index === 0 ? first : getDailyCard({ mode, signId, saju, date });
    return { date, weekday: weekdayOf(date), available: true, overall: card.levels.overall, tag: card.tag, tagLabel: card.tagLabel, label: card.label };
  });
  const pick = tag => items.filter(item => item.tag === tag).map(({ date, weekday, overall, label, tagLabel }) => ({ date, weekday, overall, label, tagLabel }));
  const goodDays = pick('good'), calmDays = pick('calm'), careDays = pick('care');
  const parts = [];
  if (goodDays.length) parts.push(`${TAGS.good}은 ${goodDays.length}일`);
  if (careDays.length) parts.push(`${TAGS.care}은 ${careDays.length}일`);
  return deepFreeze({
    mode, startDate, endDate: items.at(-1).date, length: days, items, goodDays, calmDays, careDays,
    summary: parts.length ? `앞으로 ${days}일 중 ${parts.join(', ')}이에요.` : `앞으로 ${days}일은 대체로 고르게 흘러가요.`,
    note: mode === 'korean'
      ? '날마다 오늘 일진과 내 일간의 관계로 고른 흐름이에요. 일정이나 결정을 정하는 기준으로 쓰지 않아요.'
      : '날짜와 별자리 원소로 고른 창작 흐름이에요. 실제 천체 위치를 계산하지 않아요.',
  });
}
