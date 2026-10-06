import { getSigns, FORTUNE_MODES, seoulDateKey, displayDate, millisecondsUntilNextSeoulDay, getFortune, fortuneText } from './core.mjs';
import { getSaju, sajuText } from './saju-core.mjs';
import { suggestZodiac, getZodiacProfile, getReadingSeries, getSajuGuide } from './insights.mjs';
import { createFortuneAccount } from './account.mjs';
import { emptyState, birthProfile, saveReading, readingKey, entryKey } from './account-state.mjs';

const $ = id => document.getElementById(id);
let selectedMode = null;
let selectedSign = null;
let birth = null;
let date = seoulDateKey();
let readingDate = date;
let view = 'today';
let vault = emptyState();
let accountState = { configured: false, status: 'loading', ready: false };
let accountBusy = false;
let loadedIdentity = null;
const drafts = new Map();
let fortune = null;
let dayTimer;
let noticeTimer;
const scroll = element => element.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });

function notify(message) {
  clearTimeout(noticeTimer);
  $('notice').textContent = message;
  $('notice').classList.add('visible');
  noticeTimer = setTimeout(() => $('notice').classList.remove('visible'), 4500);
}
function clearCopy() {
  $('manual-copy').hidden = true;
  $('copy-text').value = '';
  clearTimeout(noticeTimer);
  $('notice').classList.remove('visible');
  $('notice').textContent = '';
}
function showDate() {
  $('today').dateTime = date;
  $('today').textContent = displayDate(date);
  $('birth-date').max = date;
  $('zodiac-birth').max = date;
}
function textNode(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}
function renderSaju(result) {
  $('birth-summary').textContent = `양력 ${result.birthDate} · ${result.timeKnown ? result.birthTime : '태어난 시간 모름'} · 한국 표준시`;
  $('pillars').replaceChildren(...result.pillars.map(pillar => {
    const card = document.createElement('article');
    card.className = 'pillar';
    card.dataset.pillar = pillar.id;
    card.append(textNode('h4', pillar.label));
    if (pillar.known) {
      for (const [kind, part] of [['천간', pillar.stem], ['지지', pillar.branch]]) {
        const row = document.createElement('p');
        row.className = 'pillar-part';
        row.setAttribute('aria-label', `${kind} ${part.hangul}, ${part.element}`);
        row.append(textNode('span', part.hanja, 'hanja'), textNode('span', `${part.hangul} · ${part.element}`, 'hangul'));
        card.append(row);
      }
    } else {
      card.append(textNode('p', '—', 'hanja'), textNode('p', '시각 확인 필요', 'unknown'));
    }
    return card;
  }));
  $('day-master').textContent = `나의 일간 · ${result.dayMaster.hangul}(${result.dayMaster.hanja}) · ${result.dayMaster.element}`;
  $('elements').replaceChildren(...result.elements.map(element => {
    const item = document.createElement('li');
    item.append(textNode('span', `${element.label} ${element.hanja}`), textNode('strong', `${element.count}개`));
    return item;
  }));
  $('saju-notes').replaceChildren(...result.notes.map(note => textNode('li', note)));
}
function renderResult({ announce = true } = {}) {
  const western = selectedMode === 'western';
  if (!selectedMode || (western ? !selectedSign : !birth)) {
    fortune = null;
    $('result').hidden = true;
    renderWeek();
    return;
  }
  fortune = western ? getFortune(selectedSign, readingDate, 'western') : getSaju(birth, readingDate);
  $('saju-details').hidden = western;
  $('lucky-pair').hidden = !western;
  $('overall-label').textContent = western ? '총운' : '사주를 읽는 첫 단서';
  $('copy').textContent = western ? '오늘의 운세 복사' : '사주 결과 복사';
  $('change').textContent = western ? '다른 별자리도 보기' : '출생정보 다시 보기';
  if (western) {
    for (const button of $('signs').children) button.setAttribute('aria-pressed', String(button.dataset.sign === selectedSign));
    $('result-label').textContent = `${readingDate.replaceAll('-', '.')} · 별자리 운세 · ${fortune.signLabel}`;
    for (const field of ['color', 'number']) $(field).textContent = fortune[field];
    $('result-note').textContent = '같은 날, 같은 별자리에는 같은 운세가 나와요. 내일은 새로운 한 장을 만나 보세요.';
  } else {
    $('result-label').textContent = `${readingDate.replaceAll('-', '.')} · 한국 사주`;
    renderSaju(fortune);
    $('result-note').textContent = '네 기둥은 태어난 때를 기준으로 해요. 풀이는 전통 상징을 참고한 가벼운 제안이며, 성격이나 미래를 확정하지 않아요.';
  }
  $('fortune-title').textContent = fortune.title;
  for (const field of ['overall', 'relationship', 'focus', 'action']) $(field).textContent = fortune[field];
  const saved = drafts.get(readingKey(fortune)) || vault.entries.find(item => entryKey(item) === readingKey(fortune));
  $('complete-action').checked = saved?.completed || false;
  $('reflection-note').value = saved?.note || '';
  updateNoteCount();renderGuide();renderWeek();updateAccountControls();
  clearCopy();
  $('result').hidden = view !== 'today';
  if (announce) { $(view === 'week' ? 'week-title' : 'fortune-title').focus({ preventScroll: true }); scroll($(view === 'week' ? 'week-panel' : 'result')); }
}
function refreshDay() {
  const current = seoulDateKey();
  if (current === date) return false;
  if (readingDate === date) readingDate = current;
  date = current;
  showDate();
  renderResult({ announce: false });
  notify('한국 시간이 새날로 바뀌어 오늘의 내용을 새로 준비했어요.');
  return true;
}
function scheduleDay() {
  clearTimeout(dayTimer);
  dayTimer = setTimeout(() => { refreshDay(); scheduleDay(); }, millisecondsUntilNextSeoulDay() + 100);
}
function chooseMode(mode, { announce = true } = {}) {
  if (!FORTUNE_MODES.some(item => item.id === mode)) return;
  refreshDay();
  selectedMode = mode;
  clearCopy();
  const western = mode === 'western';
  document.documentElement.dataset.fortuneMode = mode;
  for (const button of document.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  $('picker').hidden = !western;
  $('saju-input').hidden = western;
  $('profile-tools').hidden = false;
  if (western) {
    $('choose-title').textContent = '내 별자리는 무엇인가요?';
    $('choose-help').textContent = '별자리를 고르면 오늘의 운세가 바로 열려요.';
    $('mode-note').textContent = '날짜는 일반적인 양력 생일 구간이에요. 경계일은 출생 연도·시간에 따라 달라질 수 있어요.';
    $('signs').replaceChildren();
    for (const sign of getSigns('western')) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'sign'; button.dataset.sign = sign.id;
      button.setAttribute('aria-pressed', String(selectedSign === sign.id));
      button.append(textNode('span', sign.label, 'sign-label'), textNode('span', sign.english, 'sign-english'), textNode('span', sign.range, 'sign-range'));
      button.addEventListener('click', () => { refreshDay();readingDate = date; selectedSign = sign.id; renderResult(); scheduleDay(); });
      $('signs').append(button);
    }
  }
  renderResult({ announce: false });
  if (announce) { $(western ? 'choose-title' : 'saju-title').focus({ preventScroll: true });scroll($(western ? 'picker' : 'saju-input')); }
  scheduleDay();
}
for (const button of document.querySelectorAll('[data-mode]')) button.addEventListener('click', () => chooseMode(button.dataset.mode));
function invalidateBirth() {
  birth = null;
  $('saju-error').hidden = true;
  clearCopy();
  if (selectedMode === 'korean') { fortune = null; $('result').hidden = true;$('week-panel').hidden = true; }
}
$('birth-date').addEventListener('input', invalidateBirth);
$('birth-time').addEventListener('input', invalidateBirth);
$('time-unknown').addEventListener('change', () => {
  $('birth-time').disabled = $('time-unknown').checked;
  $('birth-time').required = !$('time-unknown').checked;
  invalidateBirth();
});
$('saju-form').addEventListener('submit', event => {
  event.preventDefault();
  if (selectedMode !== 'korean') return;
  refreshDay();
  const input = { birthDate: $('birth-date').value, birthTime: $('time-unknown').checked ? null : $('birth-time').value };
  try {
    getSaju(input, date);
    birth = input;
    readingDate = date;
    $('saju-error').hidden = true;
    renderResult();
  } catch (error) {
    birth = null; fortune = null; $('result').hidden = true; clearCopy();
    $('saju-error').textContent = error.message || '생년월일과 태어난 시간을 확인해 주세요.';
    $('saju-error').hidden = false;
  }
});
$('change').addEventListener('click', () => {
  if (selectedMode === 'western') { $('signs').querySelector(`[data-sign="${selectedSign}"]`)?.focus(); scroll($('choose-title')); }
  else { $('birth-date').focus({ preventScroll: true }); scroll($('saju-input')); }
});
$('copy').addEventListener('click', async () => {
  refreshDay();
  if (!fortune) return;
  const copiedFortune = fortune;
  const text = selectedMode === 'korean' ? sajuText(copiedFortune) : fortuneText(copiedFortune);
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
    await navigator.clipboard.writeText(text);
    if (fortune !== copiedFortune) return;
    notify('결과를 복사했어요.');
  } catch {
    if (fortune !== copiedFortune) return;
    $('copy-text').value = text; $('manual-copy').hidden = false; $('copy-text').focus(); $('copy-text').select();
    notify('자동 복사가 어려워 직접 복사할 글을 열었어요.');
  }
});
function clearScreen({ announce = true } = {}) {
  drafts.clear();
  selectedMode = null; selectedSign = null; birth = null; fortune = null;
  $('saju-form').reset(); $('birth-time').disabled = false; $('birth-time').required = true;
  $('zodiac-birth').value = '';$('zodiac-hint').textContent = '';$('reflection-note').value = '';$('complete-action').checked = false;
  $('guide-content').replaceChildren();$('week-grid').replaceChildren();readingDate = date;
  $('signs').replaceChildren(); $('pillars').replaceChildren(); $('elements').replaceChildren(); $('saju-notes').replaceChildren();
  $('birth-summary').textContent = ''; $('day-master').textContent = ''; $('result-label').textContent = ''; $('fortune-title').textContent = '';
  for (const field of ['overall', 'relationship', 'focus', 'action', 'color', 'number']) $(field).textContent = '';
  for (const id of ['picker', 'saju-input', 'saju-details', 'result', 'saju-error', 'week-panel', 'profile-tools']) $(id).hidden = true;
  for (const button of document.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', 'false');
  delete document.documentElement.dataset.fortuneMode;
  clearCopy();
  if (announce) { setView('today');$('mode-title').focus({ preventScroll: true }); scroll($('mode-title'));notify('화면의 입력과 결과를 지웠어요. 계정에 저장한 기록은 보관함에 남아 있어요.'); }
}
$('clear-input').addEventListener('click', () => clearScreen());

function updateNoteCount() { $('note-count').textContent = `${[...$('reflection-note').value].length} / 1000`; }
function rememberDraft() { if (fortune) drafts.set(readingKey(fortune), { note: $('reflection-note').value, completed: $('complete-action').checked });updateNoteCount(); }
$('reflection-note').addEventListener('input', rememberDraft);
$('complete-action').addEventListener('change', rememberDraft);
function guideBlock(title, copy) { const block = document.createElement('article');block.append(textNode('h4', title), textNode('p', copy));return block; }
function renderGuide() {
  const target = $('guide-content');target.replaceChildren();
  if (!fortune) return;
  if (fortune.mode === 'western') {
    const info = getZodiacProfile(fortune.signId);
    $('guide-title').textContent = `${info.label}를 더 알아보기 · ${info.english}`;
    target.append(guideBlock(info.keywords.join(' · '), info.description), guideBlock(`${info.element.label} · ${info.element.english}`, info.element.description),
      guideBlock(`${info.modality.label} · ${info.modality.english}`, info.modality.description), guideBlock('나에게 던지는 질문', info.question));
    target.append(textNode('p', '점성술에서 쓰는 문화적 상징이에요. 이 설명만으로 성격이나 능력을 판단하지 않아요.', 'helper'));
  } else {
    const info = getSajuGuide(fortune);
    $('guide-title').textContent = '내 사주를 읽는 법 · 기둥부터 오행까지';
    target.append(textNode('p', info.intro));
    for (const item of info.pillars) target.append(guideBlock(`${item.label} · ${item.title}`, `${item.description} ${item.reading}`));
    target.append(guideBlock(info.dayMaster.title, `${info.dayMaster.description} ${info.dayMaster.question}`));
    for (const item of info.elements) target.append(guideBlock(`${item.label} · ${item.symbol}`, `${item.description} ${item.reading} ${item.question}`));
  }
}
function renderWeek() {
  const available = selectedMode === 'western' ? !!selectedSign : !!birth;
  $('week-panel').hidden = view !== 'week' || !available;
  if (!available || !selectedMode) return;
  const series = getReadingSeries({ mode: selectedMode, signId: selectedSign, ...(birth || {}), period: 'week', date });
  $('week-range').textContent = `${series.startDate} – ${series.endDate}`;
  $('week-grid').replaceChildren(...series.items.map(item => {
    const card = document.createElement('article');card.className = `week-card${item.isToday ? ' is-today' : ''}`;
    card.append(textNode('p', `${item.date.slice(5)} · ${item.weekday}${item.isToday ? ' · 오늘' : ''}`, 'eyebrow'));
    if (!item.fortune) { card.append(textNode('p', item.unavailableReason));return card; }
    card.append(textNode('h3', item.fortune.title), textNode('p', item.action.text));
    const button = textNode('button', '이날 자세히 보기', 'soft-button');button.type = 'button';
    button.addEventListener('click', () => { readingDate = item.date;setView('today');renderResult(); });card.append(button);return card;
  }));
}
function setView(next) {
  view = next;
  document.documentElement.dataset.view = next;
  for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === next));
  $('reading-area').hidden = next === 'history';$('history-panel').hidden = next !== 'history';
  $('result').hidden = next !== 'today' || !fortune;
  renderWeek();if (next === 'history') renderHistory();
}
for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => { refreshDay();setView(button.dataset.view); });
$('find-zodiac').addEventListener('click', () => {
  try {
    birthProfile($('zodiac-birth').value);
    const suggestion = suggestZodiac($('zodiac-birth').value);
    selectedSign = suggestion.signId;readingDate = date;renderResult();$('zodiac-hint').textContent = `${suggestion.label} · ${suggestion.note}`;
  } catch { $('zodiac-hint').textContent = '1900년부터 오늘 사이의 양력 생일을 입력해 주세요.'; }
});

function updateAccountControls() {
  const signedIn = accountState.status === 'signed-in';
  $('account-login').hidden = !accountState.configured || signedIn;
  $('account-login').disabled = accountBusy || accountState.status === 'signing-in';
  $('account-cancel').hidden = accountState.status !== 'signing-in';
  $('account-logout').hidden = !signedIn;$('account-reload').hidden = !signedIn;
  $('account-reload').disabled = accountBusy || !signedIn;
  for (const id of ['save-profile', 'save-reading', 'export-records', 'delete-data', 'confirm-delete-data']) $(id).disabled = accountBusy || !accountState.ready;
  $('save-reading').disabled ||= !fortune;
  $('reading-save-note').textContent = accountState.ready ? '결과·실천 여부·메모를 내 SYNK 계정에 저장해요. 저장 단추를 누르기 전 수정은 이 화면에만 남아요.' : '로그인하고 계정 저장이 연결되면 결과와 메모를 보관할 수 있어요.';
  $('saved-profile').hidden = !accountState.ready;
  $('saved-profile').textContent = vault.profile ? `저장된 내 정보 · 양력 ${vault.profile.birthDate} · ${vault.profile.birthTime ?? '시간 모름'} · 한국 표준시` : '저장된 출생정보가 없어요. 아래에서 입력한 뒤 계정에 저장해 주세요.';
}
function applyAccount({ restore = false } = {}) {
  const snapshot = connection.snapshot();if (!snapshot.ready) return;
  vault = snapshot.state;
  const identity = snapshot.account.synk_user_id;
  if (restore || loadedIdentity !== identity) {
    loadedIdentity = identity;
    if (vault.profile) {
      $('birth-date').value = vault.profile.birthDate;$('zodiac-birth').value = vault.profile.birthDate;
      $('birth-time').value = vault.profile.birthTime || '';$('time-unknown').checked = vault.profile.birthTime === null;
      $('birth-time').disabled = vault.profile.birthTime === null;$('birth-time').required = vault.profile.birthTime !== null;
      birth = { birthDate: vault.profile.birthDate, birthTime: vault.profile.birthTime };
    }
    selectedSign = vault.preferences.signId;readingDate = date;
    chooseMode(vault.preferences.mode, { announce: false });
  }
  renderHistory();updateAccountControls();
}
const connection = createFortuneAccount({
  onState(next) { accountState = next;$('account-status').textContent = `${next.account?.display_name ? `${next.account.display_name}님 · ` : ''}${next.message}`;if (next.ready) applyAccount();updateAccountControls(); },
  onReset() { vault = emptyState();loadedIdentity = null;clearScreen({ announce: false });renderHistory(); },
});
async function accountTask(action, success) {
  if (accountBusy) return;accountBusy = true;updateAccountControls();
  try { await action();if (success) notify(success); }
  catch (error) { if (error.code !== 'ACCOUNT_CHANGED') notify(error.message || '계정 연결을 확인해 주세요.'); }
  finally { accountBusy = false;updateAccountControls(); }
}
$('account-login').addEventListener('click', () => accountTask(() => connection.signIn()));
$('account-cancel').addEventListener('click', () => accountTask(() => connection.cancel()));
$('account-logout').addEventListener('click', () => { void connection.signOut().catch(error => notify(error.message)); });
$('account-reload').addEventListener('click', () => accountTask(async () => { await connection.load();clearScreen({ announce: false });applyAccount({ restore: true }); }, '계정의 최신 정보를 불러왔어요.'));
function currentProfile() {
  if (selectedMode === 'korean') return birthProfile($('birth-date').value, $('time-unknown').checked ? null : $('birth-time').value);
  if ($('zodiac-birth').value) return birthProfile($('zodiac-birth').value, vault.profile?.birthDate === $('zodiac-birth').value ? vault.profile.birthTime : null);
  return vault.profile;
}
const preferences = () => ({ mode: selectedMode || 'western', signId: selectedSign });
$('save-profile').addEventListener('click', () => accountTask(async () => { await connection.save({ ...vault, profile: currentProfile(), preferences: preferences() });applyAccount(); }, '내 정보와 선호 방식을 계정에 저장했어요.'));
$('save-reading').addEventListener('click', () => accountTask(async () => {
  if (!fortune) return;
  const next = saveReading(vault, fortune, { note: $('reflection-note').value.trim(), completed: $('complete-action').checked });
  const key = readingKey(fortune);
  const submittedDraft = drafts.get(key);
  next.preferences = preferences();if (fortune.mode === 'korean') next.profile = birthProfile(fortune.birthDate, fortune.birthTime);
  await connection.save(next);if (drafts.get(key) === submittedDraft) drafts.delete(key);applyAccount();
}, '결과와 한 줄 기록을 계정에 저장했어요.'));
function renderHistory() {
  $('history-count').textContent = String(vault.entries.length);
  $('history-summary').textContent = accountState.ready ? `${vault.entries.length}개 보관 · ${vault.entries.filter(item => item.completed).length}개 실천 · 최대 90개` : 'SYNK ID로 로그인하면 다른 기기에서도 내 기록을 불러올 수 있어요.';
  const filter = $('history-filter').value;
  const entries = vault.entries.filter(item => filter === 'all' || filter === 'completed' ? filter !== 'completed' || item.completed : item.mode === filter);
  $('history-list').replaceChildren();
  if (!entries.length) $('history-list').append(textNode('p', '아직 보관한 기록이 없어요. 마음에 드는 운세와 한 줄 메모를 담아 보세요.', 'empty-state'));
  for (const entry of entries) {
    const row = document.createElement('article');row.className = 'history-card';
    row.append(textNode('p', `${entry.date} · ${entry.mode === 'korean' ? '한국 사주' : getZodiacProfile(entry.signId).label}${entry.completed ? ' · 실천했어요' : ''}`, 'eyebrow'), textNode('h3', entry.title), textNode('p', entry.action));
    if (entry.note) row.append(textNode('blockquote', entry.note));
    const controls = document.createElement('div');controls.className = 'history-row-actions';
    const open = textNode('button', '다시 보기 · 메모 수정', 'soft-button');open.type = 'button';
    open.addEventListener('click', () => {
      if (entry.mode === 'western') selectedSign = entry.signId;
      else { birth = { birthDate: entry.birth.birthDate, birthTime: entry.birth.birthTime };$('birth-date').value = birth.birthDate;$('birth-time').value = birth.birthTime || '';$('time-unknown').checked = birth.birthTime === null;$('birth-time').disabled = birth.birthTime === null;$('birth-time').required = birth.birthTime !== null; }
      readingDate = entry.date;setView('today');chooseMode(entry.mode, { announce: false });renderResult();
    });
    const remove = textNode('button', '기록 삭제', 'text-button');remove.type = 'button';remove.disabled = accountBusy || !accountState.ready;
    remove.addEventListener('click', () => accountTask(async () => { await connection.save({ ...vault, entries: vault.entries.filter(item => item.id !== entry.id) });applyAccount(); }, '기록을 삭제했어요.'));
    controls.append(open, remove);row.append(controls);$('history-list').append(row);
  }
}
$('history-filter').addEventListener('change', renderHistory);
$('export-records').addEventListener('click', () => {
  if (!accountState.ready) return;
  const file = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...vault }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(file), link = document.createElement('a');link.href = url;link.download = 'synk-fortune.json';link.click();setTimeout(() => URL.revokeObjectURL(url), 30000);
  notify('출생정보와 메모가 포함된 내 기록 파일을 준비했어요.');
});
$('delete-data').addEventListener('click', () => { $('delete-confirm').hidden = false; });
$('cancel-delete-data').addEventListener('click', () => { $('delete-confirm').hidden = true; });
$('confirm-delete-data').addEventListener('click', () => accountTask(async () => { await connection.remove();clearScreen({ announce: false });applyAccount();$('delete-confirm').hidden = true; }, '계정에 저장한 운세 정보와 기록을 삭제했어요.'));
window.addEventListener('focus', () => { refreshDay(); scheduleDay(); });
window.addEventListener('pageshow', () => { refreshDay(); scheduleDay(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshDay(); scheduleDay(); } });
showDate(); scheduleDay();
document.documentElement.dataset.ready = 'true';
void connection.start().catch(error => { $('account-status').textContent = error.message;updateAccountControls(); });
window.addEventListener('pagehide', () => connection.dispose());
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
