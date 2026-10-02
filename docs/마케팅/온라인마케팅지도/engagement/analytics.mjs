export const METRICS = [
  { key: 'views', label: '조회수' }, { key: 'likes', label: '좋아요' },
  { key: 'comments', label: '댓글' }, { key: 'shares', label: '공유' },
  { key: 'saves', label: '저장' }, { key: 'reach', label: '도달' },
  { key: 'followers', label: '팔로워·구독자' }
];
export function shiftDate(date, offset) {
  const value = new Date(date + 'T00:00:00Z');
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}
export function dateRange(start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) throw new Error('집계 시작일과 종료일을 확인해 주세요.');
  if ([start, end].some(date => !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error('실제 달력 날짜를 선택해 주세요.');
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  if (!Number.isFinite(days) || days < 1 || days > 366) throw new Error('집계 기간은 최대 366일로 선택해 주세요.');
  return Array.from({ length: days }, (_, i) => shiftDate(start, i));
}
const known = value => typeof value === 'number' && Number.isFinite(value);
const sum = values => values.length ? values.reduce((a, b) => a + b, 0) : null;
function indexRows(rows, idKey) {
  const index = new Map();
  for (const row of rows) {
    if (!index.has(row[idKey])) index.set(row[idKey], new Map());
    index.get(row[idKey]).set(row.date, row);
  }
  return index;
}
function source(records, key, posts, accounts, postIndex, accountIndex) {
  return key === 'followers'
    ? { entities: accounts, index: accountIndex, isPost: false }
    : { entities: posts, index: postIndex, isPost: true };
}
function point(src, key, date) {
  const entities = src.entities.filter(row => !src.isPost || row.publishedDate <= date);
  const exact = [], latest = [], dates = [];
  for (const entity of entities) {
    const rows = src.index.get(entity.id);
    const today = rows?.get(date)?.[key];
    if (known(today)) exact.push(today);
    let recent;
    for (const row of rows?.values() || []) {
      if (row.date <= date && known(row[key]) && (!recent || row.date > recent.date)) recent = row;
    }
    if (recent) { latest.push(recent[key]); dates.push(recent.date); }
  }
  dates.sort();
  return { total: sum(exact), latest: sum(latest), count: exact.length, latestCount: latest.length,
    stale: latest.length - exact.length, eligible: entities.length, oldest: dates[0] || null, newest: dates.at(-1) || null };
}
function compare(src, key, baseDate, endDate) {
  const entities = src.entities.filter(row => !src.isPost || row.publishedDate <= endDate);
  let baseline = 0, change = 0, count = 0, newCount = 0, newValue = 0, increases = 0, decreases = 0;
  for (const entity of entities) {
    const rows = src.index.get(entity.id);
    const end = rows?.get(endDate)?.[key];
    if (!known(end)) continue;
    const isNew = src.isPost && entity.publishedDate > baseDate && !entity.requiresRecordedBaseline;
    const base = isNew ? 0 : rows?.get(baseDate)?.[key];
    if (!known(base)) continue;
    // A company attribution report must not bridge a different owner's interval.
    if (!isNew && rows?.get(baseDate)?.comparisonGroup !== rows?.get(endDate)?.comparisonGroup) continue;
    baseline += base; change += end - base; count++;
    increases += Math.max(0, end - base); decreases += Math.min(0, end - base);
    if (isNew) { newCount++; newValue += end; }
  }
  return { delta: count ? change : null, rate: count && baseline > 0 ? change / baseline * 100 : null,
    baseline: count ? baseline : null, count, eligible: entities.length, newCount, newValue: newCount ? newValue : null,
    complete: entities.length > 0 && count === entities.length, baseDate, endDate,
    increases: count ? increases : null, decreases: count ? decreases : null };
}
function stats(src, key, start, end, days) {
  const baseline = shiftDate(start, -1);
  const previousStart = shiftDate(start, -days);
  return { ...point(src, key, end), day: compare(src, key, shiftDate(end, -1), end),
    period: compare(src, key, baseline, end), previousPeriod: compare(src, key, shiftDate(previousStart, -1), baseline) };
}
export function analyze(records, catalog, options) {
  const { start, end, brand = '', channel = '', platform = '', country = '' } = options;
  const dates = dateRange(start, end);
  const channels = catalog.channels.filter(row => row.ready && (!brand || row.brand === brand) && (!channel || row.id === channel)
    && (!platform || row.platform === platform) && (!country || row.country === country));
  const channelIds = new Set(channels.map(row => row.id));
  const posts = records.posts.filter(row => channelIds.has(row.channelId) && row.publishedDate <= end);
  const postIndex = indexRows(records.snapshots, 'postId');
  const accountIndex = indexRows(records.channelSnapshots, 'channelId');
  const getSource = (key, subset = posts, accounts = channels) => source(records, key, subset, accounts, postIndex, accountIndex);
  const metrics = Object.fromEntries(METRICS.map(({ key }) => [key, stats(getSource(key), key, start, end, dates.length)]));
  const daily = dates.map(date => ({ date, newPosts: posts.filter(row => row.publishedDate === date).length,
    metrics: Object.fromEntries(METRICS.map(({ key }) => [key, { ...point(getSource(key), key, date),
      change: compare(getSource(key), key, shiftDate(date, -1), date) }])) }));
  const aggregate = (selectedPosts, accounts) => Object.fromEntries(METRICS.map(({ key }) =>
    [key, stats(getSource(key, selectedPosts, accounts), key, start, end, dates.length)]));
  const byPost = posts.map(post => ({ ...post, account: channels.find(row => row.id === post.channelId),
    metrics: aggregate([post], []) }));
  const groups = dimension => {
    const grouped = new Map();
    for (const account of channels) {
      const id = dimension === 'channel' ? account.id : account[dimension] || '미지정';
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id).push(account);
    }
    return [...grouped].map(([id, accounts]) => {
      const ids = new Set(accounts.map(row => row.id));
      const selectedPosts = posts.filter(row => ids.has(row.channelId));
      return { id, label: dimension === 'channel' ? [accounts[0].brand, accounts[0].country, accounts[0].platform, accounts[0].handle].filter(Boolean).join(' · ') : id,
        postCount: selectedPosts.length, channelCount: accounts.length, metrics: aggregate(selectedPosts, accounts) };
    });
  };
  return { start, end, dates, channels, posts, metrics, daily, byPost, groups,
    scope: { brand, channel, platform, country },
    newPosts: posts.filter(row => row.publishedDate >= start).length };
}
export function analyticsCsv(report, dimension = 'channel') {
  const rows = [
    ['집계 시작일', report.start, '종료일', report.end],
    ['브랜드', report.scope.brand || '전체', '채널', report.scope.channel || '전체', '플랫폼', report.scope.platform || '전체', '국가', report.scope.country || '전체'],
    ['정의', '최근 기록 합계는 종료일까지 지표별 마지막 확인값의 합. 날짜별 누적값을 여러 날에 걸쳐 더하지 않음.'],
    ['증가량', '종료일과 기준일에 모두 기록한 동일 대상의 차이. 새 게시물은 게시 전 0을 기준으로 포함. 기존 게시물의 첫 관측은 제외.'],
    ['증가율', '비교 대상 증가량 합 / 같은 대상 기준일 합 * 100. 기준 0 또는 비교 없음은 빈칸. 미기록은 0이 아님.'],
    ['단위', '도달과 팔로워는 중복 제거한 사람이 아닌 게시물 또는 계정별 보고값 합계.'],
    ['범위', '관리 종료 게시물 포함. 기록 검색과 관리 기간 체크는 성장 집계에 적용하지 않음.'],
    [], ['구분', '대상', '날짜', '지표', '최근 기록 합계', '당일 기록 합계', '당일 확인 대상', '전체 대상', '이전 날짜 기록 포함', '하루 증가량', '하루 증가율(%)', '하루 비교 대상', '신규 게시물 포함 수', '기간 증가량', '기간 증가율(%)', '기간 비교 대상', '기간 기준일']
  ];
  const add = (type, label, date, key, metric, daily = false) => {
    const change = daily ? metric.change : metric.day;
    rows.push([type, label, date, key, metric.latest, metric.total, metric.count, metric.eligible, metric.stale,
      change.delta, change.rate, change.count, change.newCount,
      daily ? null : metric.period.delta, daily ? null : metric.period.rate, daily ? null : metric.period.count, daily ? null : metric.period.baseDate]);
  };
  for (const { key, label } of METRICS) add('전체', '선택 범위', report.end, label, report.metrics[key]);
  for (const day of report.daily) for (const { key, label } of METRICS) add('일별', '선택 범위', day.date, label, day.metrics[key], true);
  for (const group of report.groups(dimension)) for (const { key, label } of METRICS) add(dimension, group.label, report.end, label, group.metrics[key]);
  for (const post of report.byPost) for (const { key, label } of METRICS.filter(row => row.key !== 'followers')) add('게시물', post.title + ' | ' + post.url, report.end, label, post.metrics[key]);
  const escape = value => {
    let str = value === null || value === undefined ? '' : String(value);
    if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(str)) str = "'" + str;
    return '"' + str.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + rows.map(row => row.map(escape).join(',')).join('\r\n');
}

export const REACTION_KEYS = ['likes', 'comments', 'shares', 'saves'];
export { point as metricPoint, compare as compareMetric, indexRows as metricIndex };
export function companyOverview(records, catalog, end) {
  // The company overview always covers every ready channel, independently of detail filters.
  const report = analyze(records, catalog, { start: end, end });
  const parts = REACTION_KEYS.map(key => report.metrics[key]);
  const sumKnown = values => sum(values.filter(known));
  const add = key => parts.reduce((total, part) => total + part[key], 0);
  const dayParts = parts.map(part => part.day);
  const delta = sumKnown(dayParts.map(part => part.delta));
  const baseline = sumKnown(dayParts.map(part => part.baseline));
  const dayCount = dayParts.reduce((total, part) => total + part.count, 0);
  const eligible = add('eligible');
  const reactions = {
    latest: sumKnown(parts.map(part => part.latest)), total: sumKnown(parts.map(part => part.total)),
    count: add('count'), latestCount: add('latestCount'), stale: add('stale'), eligible,
    day: { delta, baseline, rate: baseline > 0 && delta !== null ? delta / baseline * 100 : null,
      count: dayCount, eligible, complete: eligible > 0 && dayCount === eligible }
  };
  return { end, channelCount: report.channels.length, postCount: report.posts.length,
    newPosts: report.newPosts, metrics: report.metrics, reactions };
}
