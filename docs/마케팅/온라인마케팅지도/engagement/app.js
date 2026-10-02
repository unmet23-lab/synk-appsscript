import { createAnalyticsUI } from './analytics-ui.mjs';
import { createCalendarUI } from './calendar-ui.mjs';
const $ = id => document.getElementById(id);
const metricKeys = ['views', 'reach', 'likes', 'comments', 'shares', 'saves'];
const state = { catalog: null, records: null, date: '', brand: '', channel: '', platform: '', country: '', search: '', selectedPostId: null };
function switchMode(mode) {
  $('companyOverview').hidden = mode !== 'growth';
  for (const name of ['growth', 'calendar', 'records']) {
    $(name + 'Panel').hidden = name !== mode;
    $(name + 'Tab').setAttribute('aria-selected', String(name === mode));
    $(name + 'Tab').tabIndex = name === mode ? 0 : -1;
  }
  if (mode === 'growth' && state.records) analytics.render();
  if (mode === 'calendar' && state.records) calendar.render();
}
const analytics = createAnalyticsUI({
  getState: () => state,
  chooseScope: (dimension, id) => {
    state[dimension] = id;
    if (dimension !== 'channel') state.channel = '';
    render();
    $('growthTab').scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  openRecord: (postId, date) => {
    if (date) { state.date = date; $('dateFilter').value = date; $('followerDate').value = date; render(); }
    switchMode('records');
    if (postId) openSnapshot(postId);
    else { $('snapshotEditor').hidden = true; $('postEditor').hidden = true; state.selectedPostId = null; $('recordsTab').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  },
  openNew: () => { switchMode('records'); openPost(); }
});
const calendar = createCalendarUI({
  getState: () => state,
  openRecord: (postId, date) => {
    state.date = date;
    $('dateFilter').value = date;
    $('followerDate').value = date;
    switchMode('records');
    render();
    openSnapshot(postId);
  }
});

function kstToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function dayShift(date, offset) {
  const day = new Date(date + 'T00:00:00Z');
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}
function elem(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  return element;
}
function appendCell(row, text, className) {
  const cell = elem('td', className, text);
  row.append(cell);
  return cell;
}
function button(text, action, className = 'small-button') {
  const control = elem('button', className, text);
  control.type = 'button';
  control.addEventListener('click', action);
  return control;
}
function option(value, label) {
  const item = elem('option', '', label);
  item.value = value;
  return item;
}
function setOptions(select, options, firstLabel, selected = '') {
  select.replaceChildren(option('', firstLabel), ...options.map(item => option(item.id, item.label)));
  if ([...select.options].some(item => item.value === selected)) select.value = selected;
}
function channel(id) { return state.catalog.channels.find(row => row.id === id); }
function channelName(row) { return row.brand + ' · ' + row.country + ' · ' + row.platform + ' ' + (row.handle || ''); }
function number(value) { return value === null || value === undefined ? '—' : Number(value).toLocaleString('ko-KR'); }
function snapshot(postId, date) { return state.records.snapshots.find(row => row.postId === postId && row.date === date); }
function followerSnapshot(channelId, date) { return state.records.channelSnapshots.find(row => row.channelId === channelId && row.date === date); }
function due(post) { return !post.archived && post.publishedDate <= state.date && state.date <= dayShift(post.publishedDate, post.monitorDays - 1); }
function showNotice(message, error = false) {
  $('notice').textContent = message;
  $('notice').classList.toggle('error', error);
}
function filtersMatch(post) {
  const account = channel(post.channelId);
  if (state.brand && account?.brand !== state.brand) return false;
  if (state.channel && post.channelId !== state.channel) return false;
  if (state.platform && account?.platform !== state.platform) return false;
  if (state.country && account?.country !== state.country) return false;
  const haystack = [post.title, post.url, account?.handle, account?.country, account?.platform].join(' ').toLowerCase();
  return !state.search || haystack.includes(state.search);
}
function relevantChannels() {
  return state.catalog.channels.filter(row => row.ready && (!state.brand || row.brand === state.brand) && (!state.channel || row.id === state.channel) && (!state.platform || row.platform === state.platform) && (!state.country || row.country === state.country));
}
function renderFilters() {
  $('resetFilters').hidden = ![state.brand, state.channel, state.platform, state.country].some(Boolean);
  const ready = state.catalog.channels.filter(row => row.ready);
  const brands = [...new Set(ready.map(row => row.brand))].sort((a, b) => a.localeCompare(b, 'ko'));
  setOptions($('brandFilter'), brands.map(id => ({ id, label: id })), '전체 브랜드', state.brand);
  const filtered = ready.filter(row => (!state.brand || row.brand === state.brand) && (!state.platform || row.platform === state.platform) && (!state.country || row.country === state.country));
  for (const [key, label] of [['platform', '플랫폼'], ['country', '국가']]) {
    const values = [...new Set(ready.map(row => row[key]))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko'));
    setOptions($(key + 'Filter'), values.map(id => ({ id, label: id })), '전체 ' + label, state[key]);
  }
  setOptions($('channelFilter'), filtered.map(row => ({ id: row.id, label: channelName(row) })), '전체 채널', state.channel);
  setOptions($('postChannel'), ready.map(row => ({ id: row.id, label: channelName(row) })), '게시 채널을 선택하세요', $('postChannel').value || state.channel);
  setOptions($('followerChannel'), ready.map(row => ({ id: row.id, label: channelName(row) })), '채널을 선택하세요', $('followerChannel').value || state.channel);
  setOptions($('postContent'), state.catalog.contents.map(row => ({ id: row.id, label: row.id + ' · ' + row.title })), '연결 안 함', $('postContent').value);
}
function metricCell(row, key, current, previous) {
  const cell = appendCell(row, number(current?.[key]), 'numeric');
  if (current?.[key] !== null && current?.[key] !== undefined && previous?.[key] !== null && previous?.[key] !== undefined) {
    const delta = current[key] - previous[key];
    const marker = elem('small', delta < 0 ? 'delta negative' : 'delta', (delta >= 0 ? '+' : '') + number(delta) + ' 전일 대비');
    cell.append(marker);
  }
}
function renderPosts() {
  const visible = state.records.posts.filter(post => filtersMatch(post) && ($('allPosts').checked || due(post)));
  visible.sort((a, b) => {
    const aMissing = due(a) && !snapshot(a.id, state.date);
    const bMissing = due(b) && !snapshot(b.id, state.date);
    return Number(bMissing) - Number(aMissing) || b.publishedDate.localeCompare(a.publishedDate) || a.title.localeCompare(b.title, 'ko');
  });
  const tbody = $('postRows');
  tbody.replaceChildren();
  $('postsEmpty').hidden = visible.length > 0;
  for (const post of visible) {
    const account = channel(post.channelId);
    const current = snapshot(post.id, state.date);
    const previous = snapshot(post.id, dayShift(state.date, -1));
    const row = elem('tr');
    const titleCell = appendCell(row, '', 'post-title');
    const title = elem('strong', '', post.title);
    const label = elem('small', '', account ? channelName(account) : post.channelId);
    const link = elem('a', '', '게시물 열기 ↗');
    link.href = post.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    titleCell.append(title, label, link);
    if (post.archived) titleCell.append(elem('small', 'archived', '관리 종료'));
    appendCell(row, post.publishedDate);
    appendCell(row, current ? '기록됨' : '미기록', current ? 'status done' : 'status missing');
    metricCell(row, 'views', current, previous);
    metricCell(row, 'likes', current, previous);
    metricCell(row, 'comments', current, previous);
    metricCell(row, 'shares', current, previous);
    const actions = appendCell(row, '', 'actions');
    actions.append(button(current ? '수정·내역' : '수치 입력', () => openSnapshot(post.id)));
    actions.append(button('게시물 편집', () => openPost(post.id), 'text-button'));
    actions.append(button(post.archived ? '관리 재개' : '관리 종료', () => archive(post), 'text-button'));
    tbody.append(row);
  }
  const duePosts = state.records.posts.filter(post => filtersMatch(post) && due(post));
  const recorded = duePosts.filter(post => snapshot(post.id, state.date)).length;
  $('dueCount').textContent = number(duePosts.length);
  $('recordedCount').textContent = number(recorded);
  $('missingCount').textContent = number(duePosts.length - recorded);
}
function renderFollowers() {
  const tbody = $('followerRows');
  tbody.replaceChildren();
  const list = relevantChannels();
  for (const account of list) {
    const current = followerSnapshot(account.id, state.date);
    const previous = followerSnapshot(account.id, dayShift(state.date, -1));
    const row = elem('tr');
    appendCell(row, channelName(account));
    appendCell(row, current ? '기록됨' : '미기록', current ? 'status done' : 'status missing');
    const value = appendCell(row, number(current?.followers), 'numeric');
    if (current && previous) {
      const delta = current.followers - previous.followers;
      value.append(elem('small', delta < 0 ? 'delta negative' : 'delta', (delta >= 0 ? '+' : '') + number(delta) + ' 전일 대비'));
    }
    appendCell(row, '', 'actions').append(button(current ? '수정' : '입력', () => {
      $('followerChannel').value = account.id;
      $('followerDate').value = state.date;
      $('followers').value = current?.followers ?? '';
      $('followerForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('followers').focus();
    }));
    tbody.append(row);
  }
  $('followerCount').textContent = number(list.filter(row => followerSnapshot(row.id, state.date)).length) + ' / ' + number(list.length);
}
function renderHistory() {
  const tbody = $('historyRows');
  tbody.replaceChildren();
  const list = state.records.snapshots.filter(row => row.postId === state.selectedPostId).sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) {
    const row = elem('tr');
    const cell = appendCell(row, '기록이 없습니다. 위에서 첫 수치를 입력해 주세요.', 'empty-row');
    cell.colSpan = 8;
    tbody.append(row);
    return;
  }
  for (const item of list) {
    const row = elem('tr');
    appendCell(row, item.date);
    for (const key of ['views', 'likes', 'comments', 'shares', 'saves', 'reach']) appendCell(row, number(item[key]), 'numeric');
    appendCell(row, new Date(item.checkedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
    tbody.append(row);
  }
}
function render() {
  if (!state.catalog || !state.records) return;
  renderFilters();
  renderPosts();
  renderFollowers();
  analytics.render();
  calendar.render();
  if (state.selectedPostId) renderHistory();
}
function openPost(id = '') {
  const post = state.records.posts.find(row => row.id === id);
  $('postEditorHeading').textContent = post ? '게시물 편집' : '게시물 등록';
  $('postId').value = post?.id || '';
  $('postChannel').value = post?.channelId || state.channel || '';
  $('postDate').value = post?.publishedDate || state.date;
  $('postTitle').value = post?.title || '';
  $('postUrl').value = post?.url || '';
  $('postFormat').value = post?.format || '';
  $('postContent').value = post?.contentId || '';
  $('postMonitorDays').value = post?.monitorDays ?? 14;
  $('postNote').value = post?.note || '';
  $('postEditor').hidden = false;
  $('postEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('postTitle').focus();
}
function openSnapshot(id) {
  state.selectedPostId = id;
  const post = state.records.posts.find(row => row.id === id);
  $('snapshotPostLabel').textContent = post.title + ' · ' + channelName(channel(post.channelId));
  $('snapshotDate').value = state.date;
  fillSnapshot();
  $('snapshotEditor').hidden = false;
  $('snapshotEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('likes').focus();
}
function fillSnapshot() {
  const item = snapshot(state.selectedPostId, $('snapshotDate').value);
  for (const key of metricKeys) $(key).value = item?.[key] ?? '';
  renderHistory();
}
async function request(path, body) {
  const response = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '처리하지 못했습니다.');
  return result;
}
async function refreshRecords() {
  state.records = await request('/api/records');
  render();
}
async function archive(post) {
  try {
    await request('/api/posts/archive', { id: post.id, archived: !post.archived });
    await refreshRecords();
    showNotice(post.archived ? '관리 목록에 다시 넣었습니다.' : '관리 목록에서 제외했습니다. 기록은 그대로 보존됩니다.');
  } catch (error) { showNotice(error.message, true); }
}
function setupEvents() {
  $('dateFilter').addEventListener('change', event => {
    if (!event.target.value || event.target.value > kstToday()) { event.target.value = state.date; return; }
    state.date = event.target.value;
    $('followerDate').value = state.date;
    if (state.selectedPostId) { $('snapshotDate').value = state.date; fillSnapshot(); }
    render();
  });
  $('brandFilter').addEventListener('change', event => { state.brand = event.target.value; state.channel = ''; render(); });
  $('channelFilter').addEventListener('change', event => { state.channel = event.target.value; render(); });
  $('resetFilters').addEventListener('click', () => { state.brand = ''; state.channel = ''; state.platform = ''; state.country = ''; render(); });
  for (const key of ['platform', 'country']) $(key + 'Filter').addEventListener('change', event => { state[key] = event.target.value; state.channel = ''; render(); });
  const modes = ['growth', 'calendar', 'records'];
  for (const name of modes) {
    $(name + 'Tab').addEventListener('click', () => switchMode(name));
    $(name + 'Tab').addEventListener('keydown', event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? modes[0] : event.key === 'End' ? modes.at(-1) : modes[(modes.indexOf(name) + (event.key === 'ArrowRight' ? 1 : -1) + modes.length) % modes.length];
        switchMode(next); $(next + 'Tab').focus();
      }
    });
  }
  $('searchFilter').addEventListener('input', event => { state.search = event.target.value.trim().toLowerCase(); renderPosts(); });
  $('allPosts').addEventListener('change', renderPosts);
  $('newPostButton').addEventListener('click', () => openPost());
  $('cancelPost').addEventListener('click', () => { $('postEditor').hidden = true; });
  $('cancelSnapshot').addEventListener('click', () => { $('snapshotEditor').hidden = true; state.selectedPostId = null; });
  $('snapshotDate').addEventListener('change', fillSnapshot);
  $('postForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const result = await request('/api/posts', {
        id: $('postId').value, channelId: $('postChannel').value, publishedDate: $('postDate').value,
        title: $('postTitle').value, url: $('postUrl').value, format: $('postFormat').value,
        contentId: $('postContent').value, monitorDays: $('postMonitorDays').value, note: $('postNote').value
      });
      await refreshRecords();
      $('postEditor').hidden = true;
      showNotice('게시물 기록을 저장했습니다. 이제 날짜별 수치를 입력할 수 있습니다.');
      openSnapshot(result.record.id);
    } catch (error) { showNotice(error.message, true); }
  });
  $('snapshotForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const body = { postId: state.selectedPostId, date: $('snapshotDate').value };
      for (const key of metricKeys) body[key] = $(key).value;
      await request('/api/snapshots', body);
      await refreshRecords();
      fillSnapshot();
      showNotice('게시물의 ' + body.date + ' 수치를 저장했습니다.');
    } catch (error) { showNotice(error.message, true); }
  });
  $('followerForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const body = { channelId: $('followerChannel').value, date: $('followerDate').value, followers: $('followers').value };
      await request('/api/channel-snapshots', body);
      await refreshRecords();
      showNotice('채널의 ' + body.date + ' 팔로워·구독자 수를 저장했습니다.');
    } catch (error) { showNotice(error.message, true); }
  });
}
async function init() {
  try {
    state.date = kstToday();
    $('dateFilter').value = state.date;
    $('dateFilter').max = state.date;
    $('startFilter').max = state.date;
    $('postDate').max = state.date;
    $('snapshotDate').max = state.date;
    $('followerDate').value = state.date;
    $('followerDate').max = state.date;
    setupEvents();
    [state.catalog, state.records] = await Promise.all([request('/api/catalog'), request('/api/records')]);
    const stale = state.catalog.staleSources.length;
    if (stale) {
      $('staleNotice').hidden = false;
      $('staleNotice').textContent = '계정 원장 ' + stale + '개가 지도 생성 뒤 바뀌었습니다. 지도를 다시 갱신한 후 새 채널을 등록해 주세요.';
    }
    const ready = state.catalog.channels.filter(row => row.ready).length;
    showNotice('기록 가능 공개 채널 ' + ready + '곳 · 기존 기록 ' + state.records.posts.length + '건 · 계정 원장 기준 ' + state.catalog.sourceAsOf.registry + '.');
    render();
  } catch (error) { showNotice('기록을 불러오지 못했습니다. 로컬 기록 서버와 파일을 확인해 주세요. ' + error.message, true); }
}
init();
