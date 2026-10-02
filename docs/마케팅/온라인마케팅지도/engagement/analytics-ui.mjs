import { analyze, METRICS, shiftDate, analyticsCsv, companyOverview, REACTION_KEYS } from './analytics.mjs';

const $ = id => document.getElementById(id);
const fmt = value => value == null ? '—' : value.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
const signed = value => value == null ? '비교 불가' : (value > 0 ? '+' : '') + fmt(value);
const rate = comparison => comparison.rate == null ? (comparison.baseline === 0 ? '기준 0 · 비율 없음' : '비율 없음') : signed(comparison.rate) + '%';
const color = value => value == null || value === 0 ? '' : value < 0 ? 'negative' : 'positive';
const coverage = c => `${fmt(c.count)} / ${fmt(c.eligible)} 대상${c.count < c.eligible ? ' · 일부' : ''}`;
const compareNote = c => coverage(c) + (c.newCount ? ` · 새 게시물 ${c.newCount}건 포함` : '');
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
function action(text, callback, className = 'text-button') {
  const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', callback); return node;
}
function cell(row, text, className = '') { const node = el('td', className, text); row.append(node); return node; }
function changeCell(row, c) {
  const node = cell(row, signed(c.delta), 'numeric ' + color(c.delta));
  node.append(el('small', 'muted', rate(c)));
  return node;
}
function emptyRow(body, message, columns) { const row = el('tr'); const node = cell(row, message, 'empty-row'); node.colSpan = columns; body.append(row); }
function svgNode(tag, attrs = {}, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  if (text != null) node.textContent = text;
  return node;
}
function plot(host, report, metric, type, inspect) {
  host.replaceChildren();
  const points = report.daily.map(day => ({ date: day.date, m: day.metrics[metric], value: type === 'delta' ? day.metrics[metric].change.delta : day.metrics[metric].total }));
  const values = points.filter(p => p.value != null).map(p => p.value);
  if (!values.length) { host.append(el('p', 'chart-empty', type === 'delta' ? '비교할 기록이 쌓이면 하루 증가량이 표시됩니다.' : '선택한 기간에 이 지표의 기록이 없습니다.')); return; }
  const W = Math.max(240, Math.min(560, host.clientWidth || 560)), H = 248, left = 52, right = 16, top = 16, bottom = 37;
  const lo = Math.min(0, ...values), hi = Math.max(1, ...values), span = hi - lo;
  const x = i => left + (i + .5) * (W - left - right) / points.length;
  const y = v => top + (hi - v) / span * (H - top - bottom);
  const svg = svgNode('svg', { viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': `${METRICS.find(m => m.key === metric).label} ${type === 'delta' ? '하루 증가량' : '날짜별 기록 합계'}` });
  for (let tick = 0; tick <= 4; tick++) {
    const value = lo + span * tick / 4;
    svg.append(svgNode('line', { x1: left, x2: W - right, y1: y(value), y2: y(value), stroke: '#e4eaf3' }));
    svg.append(svgNode('text', { x: left - 9, y: y(value) + 4, 'text-anchor': 'end', class: 'axis-label' }, new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)));
  }
  svg.append(svgNode('line', { x1: left, x2: W - right, y1: y(0), y2: y(0), stroke: '#97a8c1' }));
  const labelStep = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor((W - left - right) / 70))));
  points.forEach((point, i) => {
    if (i % labelStep === 0 || i === points.length - 1) {
      if (i !== points.length - 1 || points.length === 1 || i % labelStep > 1 || i % labelStep === 0)
        svg.append(svgNode('text', { x: x(i), y: H - 10, 'text-anchor': 'middle', class: 'axis-label' }, point.date.slice(5).replace('-', '/')));
    }
    if (point.value == null) return;
    const c = type === 'delta' ? point.m.change : point.m;
    const complete = c.count === c.eligible;
    const fill = !complete ? '#b76a0b' : type === 'delta' ? (point.value < 0 ? '#ad4736' : '#14795a') : '#2451cb';
    if (type === 'total' && i > 0) {
      const previous = points[i - 1];
      if (complete && previous.value != null && previous.m.count === previous.m.eligible)
        svg.append(svgNode('line', { x1: x(i - 1), y1: y(previous.value), x2: x(i), y2: y(point.value), stroke: '#2451cb', 'stroke-width': 2 }));
    }
    const mark = type === 'delta' ? svgNode('rect', { x: x(i) - Math.max(1, (W - left - right) / points.length * .31), y: point.value >= 0 ? y(point.value) : y(0),
      width: Math.max(2, (W - left - right) / points.length * .62), height: Math.max(2, Math.abs(y(point.value) - y(0))), rx: 2, fill })
      : svgNode('circle', { cx: x(i), cy: y(point.value), r: points.length > 90 ? 2.5 : 4, fill });
    const description = `${point.date} · ${type === 'delta' ? '증가 ' + signed(point.value) : '기록 합계 ' + fmt(point.value)} · ${coverage(c)}`;
    mark.setAttribute('tabindex', '0'); mark.setAttribute('role', 'button'); mark.setAttribute('aria-label', description);
    mark.append(svgNode('title', {}, description));
    mark.addEventListener('click', () => inspect(point.date));
    mark.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inspect(point.date); } });
    svg.append(mark);
  });
  host.append(svg);
}

export function createAnalyticsUI({ getState, chooseScope, openRecord, openNew }) {
  let report, metric = 'likes', page = 0;
  const metricSelect = $('metricFilter');
  for (const item of METRICS) { const option = el('option', '', item.label); option.value = item.key; metricSelect.append(option); }
  metricSelect.value = metric;
  const metricLabel = () => METRICS.find(item => item.key === metric).label;
  const groupDimension = () => $('groupFilter').value;
  const order = (a, b) => (b.metrics[metric].period.delta ?? -Infinity) - (a.metrics[metric].period.delta ?? -Infinity) || (b.metrics[metric].latest ?? -Infinity) - (a.metrics[metric].latest ?? -Infinity) || (a.label || a.title).localeCompare(b.label || b.title, 'ko');
  function renderOverview() {
    const state = getState();
    const all = companyOverview(state.records, state.catalog, state.date);
    $('overviewScope').textContent = `${all.end} 기준 · 모든 브랜드·국가·플랫폼 합산`;
    $('overviewInventory').textContent = `전체 채널 ${all.channelCount}곳 · 등록 게시물 ${all.postCount}건 · 당일 새 게시물 ${all.newPosts}건`;
    const totals = $('overviewTotals'); totals.replaceChildren();
    for (const [key, label, m, definition, unit] of [
      ['reactions', '총 반응', all.reactions, '좋아요 + 댓글 + 공유 + 저장', '항목'],
      ['views', '총 조회수', all.metrics.views, '모든 게시물의 조회수 합계', '게시물'],
      ['followers', '총 팔로워·구독자', all.metrics.followers, '모든 채널의 팔로워·구독자 합계', '채널']
    ]) {
      const block = el('div', 'overview-total ' + (key === 'reactions' ? 'featured' : ''));
      block.dataset.metric = key;
      block.append(el('span', 'overview-total-label', label), el('strong', 'overview-value', fmt(m.latest)), el('span', 'overview-definition', definition));
      block.append(el('span', 'overview-change ' + color(m.day.delta), `하루 ${signed(m.day.delta)}${m.day.rate != null ? ' · ' + rate(m.day) : ''}`));
      block.append(el('small', 'muted', `최근값 ${m.latestCount}/${m.eligible} ${unit} · 이전 기록 ${m.stale}`));
      block.append(el('small', 'muted', `전일 비교 ${m.day.count}/${m.day.eligible} ${unit}${m.day.count < m.day.eligible ? ' · 일부' : ''}`));
      totals.append(block);
    }
    const breakdown = $('overviewBreakdown'); breakdown.replaceChildren();
    for (const key of [...REACTION_KEYS, 'reach']) {
      const item = el('div'); item.dataset.metric = key;
      item.append(el('span', '', METRICS.find(row => row.key === key).label + (key === 'reach' ? ' 합계' : '')), el('strong', '', fmt(all.metrics[key].latest)));
      breakdown.append(item);
    }
    $('overviewNote').textContent = '아래에서 채널을 골라도 이 요약은 항상 전체입니다. 기준 날짜까지 확인한 최근값을 합산하며, 미확인 항목은 제외합니다. 반응은 횟수이며 도달·팔로워는 중복 인원을 포함할 수 있습니다.';
  }
  function inspect(date) {
    const m = report.daily.find(row => row.date === date).metrics[metric];
    $('chartReadout').textContent = `${date} · ${metricLabel()} 기록 합계 ${fmt(m.total)} (${coverage(m)}) · 하루 증가 ${signed(m.change.delta)} / ${rate(m.change)} (${compareNote(m.change)})`;
    for (const row of $('dailyRows').rows) row.classList.toggle('selected-date', row.dataset.date === date);
  }
  function renderCards() {
    const host = $('growthCards'); host.replaceChildren();
    for (const { key, label } of METRICS) {
      const m = report.metrics[key];
      const card = action('', () => { metric = key; metricSelect.value = key; page = 0; renderViews(); }, 'growth-card' + (key === metric ? ' active' : ''));
      card.setAttribute('aria-pressed', String(key === metric));
      card.append(el('span', 'card-label', label), el('strong', '', fmt(m.latest)));
      card.append(el('span', 'card-change ' + color(m.day.delta), `하루 ${signed(m.day.delta)}${m.day.rate != null ? ' · ' + rate(m.day) : ''}`));
      card.append(el('small', '', `최근값 ${m.latestCount}/${m.eligible} 대상 · 당일 ${m.count} · 이전 ${m.stale}`));
      card.append(el('small', '', '전일 비교 ' + compareNote(m.day)));
      host.append(card);
    }
  }
  function renderTrend() {
    const m = report.metrics[metric];
    const boxes = $('periodStats'); boxes.replaceChildren();
    for (const [label, c] of [['하루 증가', m.day], ['선택 기간 증가', m.period], ['직전 같은 길이 기간 증가', m.previousPeriod]]) {
      const box = el('div'); box.append(el('span', 'muted', label), el('strong', color(c.delta), signed(c.delta)), el('span', '', rate(c)),
        el('small', 'muted', `${shiftDate(c.baseDate, 1)} ~ ${c.endDate}`), el('small', 'muted', compareNote(c)));
      boxes.append(box);
    }
    const comparable = report.daily.filter(row => row.metrics[metric].change.count > 0).length;
    const complete = report.daily.filter(row => row.metrics[metric].change.complete).length;
    const box = el('div'); box.append(el('span', 'muted', '하루 비교가 가능한 날짜'), el('strong', '', `${comparable} / ${report.dates.length}일`),
      el('span', '', `전체 대상 비교 ${complete}일`), el('small', 'muted', `그 외 ${comparable - complete}일은 일부 대상만 비교`)); boxes.append(box);
    plot($('deltaChart'), report, metric, 'delta', inspect);
    plot($('totalChart'), report, metric, 'total', inspect);
    $('chartReadout').textContent = `${metricLabel()} · 증가량은 같은 대상의 기록 차이에 새 게시물 반응을 더한 값입니다. 막대나 점을 선택하면 상세 수치를 볼 수 있습니다.`;
  }
  function renderGroups() {
    const rows = report.groups(groupDimension()).filter(row => row.postCount || row.metrics[metric].latestCount).sort(order);
    const body = $('groupRows'); body.replaceChildren();
    $('groupCaption').textContent = `${metricLabel()} · ${report.start} ~ ${report.end} · 기록 또는 등록 게시물이 있는 ${rows.length}개 묶음`;
    if (!rows.length) emptyRow(body, '이 범위에 집계할 기록이 없습니다.', 6);
    const choose = row => chooseScope(groupDimension(), row.id);
    for (const item of rows) {
      const m = item.metrics[metric], row = el('tr');
      cell(row, '').append(action(item.label, () => choose(item), 'text-button group-link'));
      cell(row, fmt(item.postCount), 'numeric');
      cell(row, fmt(m.latest), 'numeric').append(el('small', 'muted', `${m.latestCount}/${m.eligible} 대상 · 이전 기록 ${m.stale}`));
      changeCell(row, m.day); changeCell(row, m.period);
      cell(row, compareNote(m.period)); body.append(row);
    }
    const chart = $('contributionChart'); chart.replaceChildren();
    const known = rows.filter(row => row.metrics[metric].period.delta != null);
    if (known.length < 2 || new Set(known.map(row => row.metrics[metric].period.delta)).size < 2) return;
    const top = [...known].sort((a, b) => Math.abs(b.metrics[metric].period.delta) - Math.abs(a.metrics[metric].period.delta)).slice(0, 8).sort(order);
    chart.append(el('p', 'help', `기간 변화의 크기가 큰 ${top.length}개 · 0 기준 왼쪽은 감소, 오른쪽은 증가`));
    const max = Math.max(...top.map(row => Math.abs(row.metrics[metric].period.delta)), 1);
    for (const item of top) {
      const c = item.metrics[metric].period;
      const row = action('', () => choose(item), 'contribution-row');
      row.append(el('span', 'contribution-label', item.label));
      const track = el('span', 'contribution-track');
      const bar = el('span', 'contribution-bar ' + color(c.delta) + (c.complete ? '' : ' partial'));
      const width = Math.abs(c.delta) / max * 50;
      bar.style.width = width + '%'; bar.style.left = (c.delta < 0 ? 50 - width : 50) + '%'; track.append(bar);
      row.append(track, el('strong', color(c.delta), signed(c.delta)), el('small', 'muted', coverage(c)));
      chart.append(row);
    }
  }
  function renderDaily() {
    const mode = $('dailyMode').value;
    const head = el('tr');
    head.append(el('th', '', '날짜'), el('th', 'numeric', '새 게시물'));
    for (const { label } of METRICS) head.append(el('th', 'numeric', label));
    $('dailyHead').replaceChildren(head);
    $('dailyCaption').textContent = `${report.start} ~ ${report.end} · ${mode === 'delta' ? '하루 증가량 / 증가율 / 비교 대상 수' : '그 날짜 확인된 누적값 합 / 확인 대상 수'} · 날짜 선택 시 그날의 기록 화면으로 이동`;
    const body = $('dailyRows'); body.replaceChildren();
    for (const day of [...report.daily].reverse()) {
      const row = el('tr'); row.dataset.date = day.date;
      cell(row, '').append(action(day.date, () => openRecord(null, day.date), 'text-button date-link'));
      cell(row, fmt(day.newPosts), 'numeric');
      for (const { key } of METRICS) {
        const m = day.metrics[key];
        if (mode === 'delta') {
          const node = changeCell(row, m.change);
          node.append(el('small', 'muted', `${m.change.count}/${m.change.eligible} 대상${m.change.count < m.change.eligible ? ' · 일부' : ''}`));
        } else cell(row, fmt(m.total), 'numeric').append(el('small', 'muted', `${m.count}/${m.eligible} 대상${m.count < m.eligible ? ' · 일부' : ''}`));
      }
      body.append(row);
    }
  }
  function renderPosts() {
    const body = $('performanceRows'); body.replaceChildren();
    const query = $('performanceSearch').value.trim().toLowerCase();
    const rows = report.byPost.filter(row => [row.title, row.account?.handle, row.account?.platform].join(' ').toLowerCase().includes(query)).sort(order);
    $('performanceCaption').textContent = metric === 'followers' ? '팔로워·구독자는 채널 지표입니다. 위 채널별 집계에서 확인하세요.' : `${metricLabel()} · ${rows.length}개 게시물 · 검색은 이 표에만 적용`;
    $('postPagination').replaceChildren();
    if (metric === 'followers') { emptyRow(body, '팔로워·구독자를 게시물별 성과로 나누어 계산하지 않습니다.', 6); return; }
    if (!rows.length) { emptyRow(body, '표시할 게시물이 없습니다.', 6); return; }
    page = Math.min(page, Math.floor((rows.length - 1) / 20));
    for (const post of rows.slice(page * 20, page * 20 + 20)) {
      const m = post.metrics[metric], row = el('tr');
      const title = cell(row, '', 'post-title');
      title.append(action(post.title, () => openRecord(post.id), 'text-button post-link'), el('small', 'muted', [post.account?.brand, post.account?.country, post.account?.platform, post.account?.handle].filter(Boolean).join(' · ')));
      if (post.archived) title.append(el('small', 'muted', '관리 종료 · 기록 포함'));
      cell(row, post.publishedDate); cell(row, fmt(m.latest), 'numeric');
      changeCell(row, m.day); changeCell(row, m.period);
      cell(row, m.newest || '미기록').append(el('small', 'muted', m.stale ? '기준 날짜보다 이전 기록' : ''));
      body.append(row);
    }
    const pager = $('postPagination'); pager.append(el('span', 'muted', `${page * 20 + 1}–${Math.min(rows.length, page * 20 + 20)} / ${rows.length}건`));
    if (page > 0) pager.append(action('이전', () => { page--; renderPosts(); }, 'small-button'));
    if ((page + 1) * 20 < rows.length) pager.append(action('다음', () => { page++; renderPosts(); }, 'small-button'));
  }
  function renderViews() {
    if (!report) return;
    renderCards(); renderTrend(); renderGroups(); renderDaily(); renderPosts();
  }
  function render() {
    const state = getState();
    if (!state.catalog || !state.records) return;
    renderOverview();
    try {
      const period = $('periodFilter').value;
      const start = period === 'custom' ? $('startFilter').value : shiftDate(state.date, 1 - Number(period));
      report = analyze(state.records, state.catalog, { start, end: state.date, brand: state.brand, channel: state.channel, platform: state.platform, country: state.country });
      $('analyticsError').hidden = true; $('analyticsBody').hidden = false; $('exportSummary').disabled = false;
      $('periodLabel').textContent = `${start} ~ ${state.date} · ${report.dates.length}일`;
      $('scopeSummary').textContent = `선택 채널 ${report.channels.length}곳 · 등록 게시물 ${report.posts.length}건 · 기간 내 새 게시물 ${report.newPosts}건`;
      $('growthEmpty').hidden = report.posts.length > 0 || report.metrics.followers.latestCount > 0;
      page = 0; renderViews();
    } catch (error) {
      report = null; $('analyticsError').textContent = error.message; $('analyticsError').hidden = false;
      $('periodLabel').textContent = '집계 기간을 다시 선택해 주세요.';
      $('analyticsBody').hidden = true; $('exportSummary').disabled = true;
    }
  }
  metricSelect.addEventListener('change', () => { metric = metricSelect.value; page = 0; renderViews(); });
  $('periodFilter').addEventListener('change', () => {
    $('customStartLabel').hidden = $('periodFilter').value !== 'custom';
    if (!$('startFilter').value) $('startFilter').value = shiftDate(getState().date, -29);
    render();
  });
  $('startFilter').addEventListener('change', render);
  $('groupFilter').addEventListener('change', () => { if (report) renderGroups(); });
  $('dailyMode').addEventListener('change', () => { if (report) renderDaily(); });
  $('performanceSearch').addEventListener('input', () => { page = 0; if (report) renderPosts(); });
  $('startRecording').addEventListener('click', openNew);
  let resizing;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizing);
    resizing = requestAnimationFrame(() => { if (report && !$('growthPanel').hidden) renderTrend(); });
  });
  $('exportSummary').addEventListener('click', () => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([analyticsCsv(report, groupDimension())], { type: 'text/csv;charset=utf-8' }));
    const link = el('a'); link.href = url; link.download = `synk-sns-growth-${report.start}-${report.end}.csv`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  return { render };
}
