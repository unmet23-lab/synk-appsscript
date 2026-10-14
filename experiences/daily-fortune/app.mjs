import { getSigns, seoulDateKey, millisecondsUntilNextSeoulDay } from './core.mjs';
import { getSaju, sajuText } from './saju-core.mjs';
import { suggestZodiac, getZodiacProfile, getSajuGuide } from './insights.mjs';
import { getDailyCard } from './daily.mjs';
import { getMonthFlow } from './flow.mjs';
import { getCompatibility } from './compat.mjs';
import { drawCard } from './tarot.mjs';
import { getYearReading, getZodiacYear } from './year.mjs';
import { getMeCard } from './me.mjs';
import { createFortuneAccount } from './account.mjs';
import { emptyState, birthProfile, saveReading, readingKey, entryKey, recentReflections, setVerdict, savePerson, removePerson } from './account-state.mjs';
import { initTheme, cycleTheme, THEME_LABEL, esc, keepDots, poster, secHead, level, icon, createToast, createSheet, dayLabel } from '/member-signal/signal.mjs';

// 무료 운세(2026-10-14 시그널 판). 비회원 입력·결과는 이 화면 메모리에만 두고, 저장 단추를 누를 때만 계정에 보낸다.
const app = document.querySelector('#app');
const toast = createToast(document.querySelector('#notice'));
initTheme();
const sheet = createSheet(document.querySelector('#account-sheet'));
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const LEVELS = [['overall', '총운'], ['love', '애정'], ['money', '금전'], ['work', '일']];
const VERDICT = Object.freeze({ hit: '맞았어요', meh: '글쎄요', miss: '아니었어요' });
const RELATION = Object.freeze({ family: '가족', friend: '친구', partner: '연인', work: '동료', other: '그 밖' });
const TAG = Object.freeze({ good: '좋은 날', calm: '무난한 날', care: '천천히 가면 좋은 날' });

let mode = null, signId = null, birth = null, date = seoulDateKey(), readingDate = date, view = 'today', setupOpen = false;
let vault = emptyState(), accountState = { configured: false, status: 'loading', ready: false, message: '계정 연결을 확인하고 있어요.' }, accountBusy = false, loadedIdentity = null, screenVersion = 0;
let deletePending = false, vaultFilter = 'all', matchInput = { name: '', relation: 'friend', birthDate: '', birthTime: '', timeUnknown: true }, matchResult = null, myBirthForMatch = '';
const drafts = new Map();
// 제출 전 생년월일 칸(사주·별자리 찾기). 화면을 다시 그려도(계정 응답 등) 사람이 고친 값을 이전 프로필로 덮지 않는다.
let birthInput = null, zodiacInput = '';
let dayTimer;

// ── 계산 ─────────────────────────────────────────────
const hasProfile = () => mode === 'western' ? !!signId : mode === 'korean' ? !!birth : false;
function sajuFor(day = readingDate) { return birth ? getSaju(birth, day) : null; }
function reading(day = readingDate) {
  if (!hasProfile()) return null;
  const saju = mode === 'korean' ? sajuFor(day) : null;
  const card = getDailyCard({ mode, signId, saju, date: day });
  if (!card) return null;
  // 보관함 형식(entries)은 기존 계약 그대로: 제목·실천 문장·날짜·방식.
  return { ...card, mode, date: day, signId: mode === 'western' ? signId : null, birthDate: birth?.birthDate, birthTime: birth?.birthTime ?? null, title: card.headline, action: card.do, saju };
}
const seed = () => mode === 'korean' ? `saju:${birth.birthDate}:${birth.birthTime ?? '?'}` : `sign:${signId}`;
function addDays(day, n) { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function weekDays(anchor) { const dow = new Date(`${anchor}T00:00:00Z`).getUTCDay(), start = addDays(anchor, -((dow + 6) % 7)); return Array.from({ length: 7 }, (_, i) => addDays(start, i)); }
const profileLabel = () => mode === 'western' ? `${getZodiacProfile(signId).label}` : birth ? `${dayLabel(birth.birthDate, { weekday: false, today: '' })} · ${birth.birthTime ?? '시간 모름'}` : '';
// 받침 있는 이름 뒤는 「과」, 없으면 「와」
const wa = name => { const c = name.charCodeAt(name.length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? '과' : '와'; };
const shortDate = day => { const [, m, d] = day.split('-').map(Number); return `${m}.${d}`; };

// ── 화면 조각 ─────────────────────────────────────────
function intro() {
  return `<section class="intro">
    <div class="copy"><p class="kicker">SYNK FOR YOU · FORTUNE</p><h1 tabindex="-1">오늘의 좋은 기운,<br><span class="hl">내 방식으로.</span></h1>
      <p class="lead">별자리나 한국 사주로 오늘의 기운을 가볍게 읽어요. 궁합과 올해의 흐름도 보고, 맞았는지 남겨 두면 다음에 더 재밌어져요.</p>
      <ul class="meta"><li><small>01</small>별자리·사주</li><li><small>02</small>오늘의 기운</li><li><small>03</small>궁합</li><li><small>04</small>내 보관함</li></ul>
      <p class="small muted">무료 · 광고 없음 · 비회원도 바로 · 로그인하면 기록 보관</p><div class="actions"><a class="btn soft" href="#setup">별자리·사주 고르기 ${icon('arrow')}</a></div></div>
    <div class="art">${poster({ word: '운세', label: '01 / FORTUNE', chip: dayLabel(date), art: './assets/art/shooting.webp', alt: '꼬리를 달고 날아가는 노란 펠트 별똥별' })}</div>
  </section>`;
}
function setup() {
  const signs = getSigns('western');
  const shown = birthInput || { birthDate: birth?.birthDate || vault.profile?.birthDate || '', birthTime: birth?.birthTime || vault.profile?.birthTime || '', timeUnknown: birth ? birth.birthTime === null : vault.profile?.birthTime === null };
  return `<section class="sec setup" id="setup">${secHead(1, '어떻게 볼까요?')}
    <div class="seg mode-seg" role="group" aria-label="운세 방식"><button type="button" data-mode="western" aria-pressed="${mode !== 'korean'}">별자리로</button><button type="button" data-mode="korean" aria-pressed="${mode === 'korean'}">한국 사주로</button></div>
    ${mode === 'korean' ? `<form id="saju-form" class="saju-form">
      <div class="field-row"><div class="field"><label for="birth-date">양력 생년월일</label><input id="birth-date" name="birthDate" type="date" min="1900-01-01" max="${date}" required value="${esc(shown.birthDate)}"></div>
      <div class="field"><label for="birth-time">태어난 시간 <span class="opt-note">24시간 · 한국 표준시</span></label><input id="birth-time" name="birthTime" type="time" value="${esc(shown.birthTime)}" ${shown.timeUnknown ? 'disabled' : ''}></div></div>
      <label class="check"><input type="checkbox" name="timeUnknown" ${shown.timeUnknown ? 'checked' : ''}><span>태어난 시간을 몰라요 <span class="small muted">시주는 비워 두고 볼 수 있어요</span></span></label>
      <div class="actions"><button class="btn primary" type="submit">사주로 보기</button></div><p id="error" class="error-text" role="alert" tabindex="-1"></p></form>`
    : `<div class="signs" role="group" aria-label="별자리">${signs.map(s => `<button class="opt sign" type="button" data-sign="${s.id}" aria-pressed="${signId === s.id}"><span><strong>${esc(s.label)}</strong><small>${esc(s.range)}</small></span><span class="tag">${esc(s.english)}</span></button>`).join('')}</div>
      <form id="find-sign" class="find-sign"><div class="field"><label for="zodiac-birth">생일로 내 별자리 찾기 <span class="opt-note">양력</span></label><div class="inline"><input id="zodiac-birth" name="birthDate" type="date" min="1900-01-01" max="${date}" value="${esc(zodiacInput)}"><button class="btn soft" type="submit">찾기</button></div></div><p id="error" class="error-text" role="alert" tabindex="-1"></p></form>`}
  </section>`;
}
function profileStrip() {
  const me = birth ? getMeCard(birth) : null;
  return `<div class="profile-strip"><div class="who"><span class="eyebrow">${mode === 'korean' ? '한국 사주' : '별자리'}</span><strong>${esc(profileLabel())}</strong></div>
    ${me ? `<ul class="meta me" data-cols="3"><li><small class="ko">띠</small>${esc(me.animal?.label || me.animal || '')}</li><li><small class="ko">일간</small>${esc(me.dayMaster?.label || me.dayMaster || '확인 필요')}</li><li><small class="ko">별자리</small>${esc(me.zodiac?.label || me.zodiac || '')}</li></ul>` : ''}
    <button class="btn small soft" type="button" data-action="change">바꾸기</button></div>`;
}
function todayView() {
  if (!hasProfile() || setupOpen) return intro() + setup();
  const r = reading();
  if (!r) return profileStrip() + `<div class="empty"><strong>이 날은 계산할 수 없어요.</strong><p>태어난 날 이전이거나 일간을 확정할 수 없는 날이에요.</p></div>`;
  const key = readingKey(r), saved = vault.entries.find(item => entryKey(item) === key), draft = drafts.get(key);
  const completed = draft ? draft.completed : !!saved?.completed, note = draft ? draft.note : saved?.note || '';
  const tarot = drawCard({ seed: seed(), date: readingDate });
  const isToday = readingDate === date;
  return `${profileStrip()}
  <div class="split today">
    <div class="main">
      <div class="day-nav"><p class="kicker">${isToday ? 'TODAY' : 'READING'} · <b class="ko">${esc(dayLabel(readingDate))}</b></p>${isToday ? '' : `<button class="linkbtn" type="button" data-action="back-today">오늘로 돌아가기</button>`}</div>
      <h1 class="page-title" tabindex="-1">${keepDots(r.headline)}</h1>
      <p class="lead">${keepDots(r.message)}</p>
      <div class="grid four levels">${LEVELS.map(([id, label]) => `<div class="card lv"><span class="eyebrow">${label}</span>${level(r.levels[id], `${label} 기운 다섯 칸 중 ${r.levels[id]}칸`)}</div>`).join('')}</div>
      <div class="grid two dodont"><div class="card"><span class="eyebrow">해 보면 좋은 것</span><p class="big-line">${keepDots(r.do)}</p></div><div class="card"><span class="eyebrow">미뤄 두면 좋은 것</span><p class="big-line">${keepDots(r.dont)}</p></div></div>
      <ul class="meta lucky"><li><small class="ko">행운의 색</small><span class="swatch" data-color="${esc(r.luckyColor?.hex || '')}"></span>${esc(r.luckyColor?.name || '')}</li><li><small class="ko">행운의 숫자</small><span class="num">${esc(r.luckyNumber)}</span></li><li><small class="ko">행운의 물건</small>${esc(r.luckyItem || '')}</li><li><small class="ko">${r.luckyTime ? '좋은 시간' : '방식'}</small>${esc(r.luckyTime || (mode === 'western' ? '별자리' : '사주'))}</li></ul>
      ${r.basis ? `<p class="note-line">${keepDots(r.basis)}</p>` : ''}
      <form id="keep" class="card keep">
        <div class="card-top"><span class="eyebrow">오늘의 작은 실천</span>${saved ? `<span class="led-chip plain">보관함에 있어요${saved.verdict ? ` · ${VERDICT[saved.verdict]}` : ''}</span>` : ''}</div>
        <label class="check"><input type="checkbox" name="completed" ${completed ? 'checked' : ''}><span>${keepDots(r.do)} <span class="small muted">해 봤어요</span></span></label>
        <div class="field"><label for="note">한 줄 메모 <span class="opt-note" data-note-count>${[...note].length} / 1000</span></label><textarea id="note" name="note" maxlength="1000" placeholder="오늘 있었던 일, 맞았던 것, 기억하고 싶은 것">${esc(note)}</textarea></div>
        <div class="actions"><button class="btn primary" type="submit" ${accountBusy || !accountState.ready ? 'disabled' : ''}>보관함에 담기</button><button class="btn soft" type="button" data-action="copy">${icon('copy')} 복사</button>${accountState.ready ? '' : '<button class="linkbtn" type="button" data-action="account">로그인하면 담을 수 있어요</button>'}</div>
        ${accountState.ready ? '<p class="small muted">결과·실천 여부·메모를 내 SYNK 계정에 저장해요. 담기 전 수정은 이 화면에만 남아요.</p>' : ''}
        <div class="manual-copy" hidden><label for="copy-text">아래 글을 직접 복사해 주세요</label><textarea id="copy-text" readonly></textarea></div>
      </form>
    </div>
    <aside class="side sticky-side">
      ${poster({ word: '오늘', size: 'low', label: `${isToday ? 'TODAY' : 'READING'} · ${shortDate(readingDate)}`, art: './assets/art/sun.webp', alt: '노란 펠트 해' })}
      ${tarot ? `<article class="card tarot"><div class="card-top"><span class="eyebrow">오늘의 카드 한 장</span><span class="mono muted">${esc(tarot.english || '')}</span></div><h3>${esc(tarot.name)}</h3><p class="keys">${(tarot.keywords || []).map(k => `<span class="chip tag">${esc(k)}</span>`).join('')}</p><p>${keepDots(tarot.meaning)}</p>${tarot.practice ? `<p class="small muted">${keepDots(tarot.practice)}</p>` : ''}</article>` : ''}
    </aside>
  </div>
  <section class="sec">${secHead(2, '이번 주')}<div class="week">${weekDays(date).map(day => {
    let c = null; try { c = getDailyCard({ mode, signId, saju: mode === 'korean' ? sajuFor(day) : null, date: day }); } catch { c = null; }
    return `<button class="day${day === readingDate ? ' on' : ''}${day === date ? ' today' : ''}" type="button" data-day="${day}" ${c ? '' : 'disabled'}><span class="d">${WEEK[new Date(`${day}T00:00:00Z`).getUTCDay()]} <span class="num">${shortDate(day)}</span></span>${c ? `${level(c.levels.overall, `총운 ${c.levels.overall}칸`)}<span class="t">${esc(c.headline)}</span>` : '<span class="t muted">계산할 수 없는 날</span>'}</button>`;
  }).join('')}</div><p class="hint">날짜를 누르면 그날의 운세를 다시 열어요. 재미로 읽는 짧은 글이에요.</p></section>
  <section class="sec">${secHead(3, mode === 'korean' ? '내 사주 네 기둥' : '내 별자리 이야기')}${mode === 'korean' ? sajuBlock(r.saju) : zodiacBlock()}</section>`;
}
function sajuBlock(saju) {
  if (!saju) return '';
  const guide = getSajuGuide(saju);
  return `<div class="pillars">${saju.pillars.map(p => `<div class="pillar${p.known ? '' : ' unknown'}"><span class="eyebrow">${esc(p.label)}</span>${p.known ? `<span class="hanja">${esc(p.stem.hanja)}${esc(p.branch.hanja)}</span><span class="small">${esc(p.stem.hangul)}${esc(p.branch.hangul)} · ${esc(p.stem.element)}${esc(p.branch.element)}</span>` : '<span class="hanja">—</span><span class="small muted">시각 확인 필요</span>'}</div>`).join('')}</div>
  <ul class="meta elements">${saju.elements.map(e => `<li><small class="ko">${esc(e.label)} ${esc(e.hanja)}</small><span class="num">${e.count}</span></li>`).join('')}</ul>
  <details class="more"><summary>사주를 읽는 법</summary><p>${keepDots(guide.intro)}</p>${guide.pillars.map(item => `<p><strong>${esc(item.label)} · ${esc(item.title)}</strong> ${esc(item.description)} ${esc(item.reading)}</p>`).join('')}<p><strong>${esc(guide.dayMaster.title)}</strong> ${esc(guide.dayMaster.description)}</p></details>
  ${saju.notes.length ? `<ul class="notes">${saju.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}`;
}
function zodiacBlock() {
  const info = getZodiacProfile(signId);
  return `<div class="grid three"><div class="card"><span class="eyebrow">${esc(info.keywords.join(' · '))}</span><p>${esc(info.description)}</p></div><div class="card"><span class="eyebrow">${esc(info.element.label)} · ${esc(info.element.english)}</span><p>${esc(info.element.description)}</p></div><div class="card"><span class="eyebrow">나에게 던지는 질문</span><p>${esc(info.question)}</p></div></div><p class="hint">점성술에서 쓰는 문화적 상징이에요. 이 설명만으로 성격이나 능력을 판단하지 않아요.</p>`;
}
function needProfile(title, word, art) {
  return `<div class="split"><div class="main"><p class="kicker">FORTUNE</p><h1 class="page-title" tabindex="-1">${title}</h1><p class="lead">먼저 오늘 탭에서 별자리나 생년월일을 골라 주세요.</p><button class="btn primary" type="button" data-view="today">별자리·사주 고르기</button></div><aside class="side">${poster({ word, size: 'low', art, alt: '' })}</aside></div>`;
}
function monthView() {
  if (!hasProfile()) return needProfile('한 달의 흐름을<br><span class="hl">미리 살펴봐요.</span>', '흐름', './assets/art/calendar.webp');
  const flow = getMonthFlow({ mode, signId, saju: mode === 'korean' ? sajuFor(date) : null, birth, startDate: date, days: 30 });
  const days = flow.days || flow.items || flow;
  const lead = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
  return `<div class="month-head"><div><p class="kicker">NEXT 30 DAYS · <b class="ko">${esc(profileLabel())}</b></p><h1 class="page-title" tabindex="-1">한 달의 흐름,<br><span class="hl">가볍게 미리.</span></h1><p class="lead">기운이 좋은 날과 천천히 가면 좋은 날을 모았어요. 날짜를 누르면 그날 운세를 열어요.</p></div>${poster({ word: '흐름', size: 'low', label: '30 DAYS', art: './assets/art/calendar.webp', alt: '펠트 달력' })}</div>
  <div class="cal" role="grid" aria-label="30일 흐름">${WEEK.map(w => `<span class="wk" role="columnheader">${w}</span>`).join('')}${'<span class="blank"></span>'.repeat(lead)}${days.map(d => `<button class="cell${d.tag ? ` ${d.tag}` : ''}${d.date === date ? ' today' : ''}" type="button" role="gridcell" data-day="${d.date}" aria-label="${dayLabel(d.date)} 총운 ${d.overall}칸${d.tag ? ` · ${TAG[d.tag]}` : ''}"><span class="num">${Number(d.date.slice(8))}</span>${level(d.overall, '')}${d.tag ? `<span class="tagdot" aria-hidden="true"></span>` : ''}</button>`).join('')}</div>
  <div class="legend"><span><i class="tagdot good"></i>좋은 날</span><span><i class="tagdot care"></i>천천히 가면 좋은 날</span></div>
  <div class="grid two days-two"><div class="card"><span class="eyebrow">기운이 좋은 날</span><ul class="daylist">${(flow.goodDays || days.filter(d => d.tag === 'good')).slice(0, 6).map(d => `<li><button class="linkbtn" type="button" data-day="${d.date}">${dayLabel(d.date)}</button><span class="small muted">${esc(d.label || '')}</span></li>`).join('') || '<li class="muted">이번 30일에는 따로 고른 날이 없어요.</li>'}</ul></div>
  <div class="card"><span class="eyebrow">천천히 가면 좋은 날</span><ul class="daylist">${(flow.careDays || days.filter(d => d.tag === 'care')).slice(0, 6).map(d => `<li><button class="linkbtn" type="button" data-day="${d.date}">${dayLabel(d.date)}</button><span class="small muted">${esc(d.label || '')}</span></li>`).join('') || '<li class="muted">특별히 천천히 갈 날이 없어요.</li>'}</ul></div></div>
  <p class="hint">재미로 보는 흐름이에요. 중요한 일정이나 결정을 이 표로 정하지 않아요.</p>`;
}
function matchView() {
  const myBirth = birth?.birthDate || vault.profile?.birthDate || '';
  const people = vault.people || [];
  const r = matchResult;
  return `<div class="split match">
    <div class="main">
      <p class="kicker">COMPATIBILITY</p><h1 class="page-title" tabindex="-1">우리 둘은<br><span class="hl">어떤 결일까요?</span></h1>
      <p class="lead">두 사람의 생년월일로 대화·속도·배려 세 가지 결을 가볍게 읽어요. 같은 두 사람은 언제나 같은 결과예요.</p>
      <form id="match-form" class="card match-form">
        ${myBirth ? `<p class="small muted">나 · 양력 ${esc(dayLabel(myBirth, { weekday: false, today: '' }))}${birth?.birthTime ? ` · ${esc(birth.birthTime)}` : ''}</p>` : `<div class="field"><label for="my-birth">내 양력 생년월일</label><input id="my-birth" name="myBirth" type="date" min="1900-01-01" max="${date}" required value="${esc(myBirthForMatch)}"></div>`}
        ${people.length ? `<fieldset><legend>저장한 사람</legend><div class="chips">${people.map(p => `<button class="chip" type="button" data-person="${esc(p.id)}">${esc(p.name)} <span class="small muted">${RELATION[p.relation] || ''}</span></button>`).join('')}</div></fieldset>` : ''}
        <div class="field-row"><div class="field"><label for="partner-name">상대 이름 <span class="opt-note">선택</span></label><input id="partner-name" name="name" maxlength="20" value="${esc(matchInput.name)}" placeholder="예: 지민"></div>
        <div class="field"><label for="partner-relation">관계</label><select id="partner-relation" name="relation">${Object.entries(RELATION).map(([id, label]) => `<option value="${id}" ${matchInput.relation === id ? 'selected' : ''}>${label}</option>`).join('')}</select></div></div>
        <div class="field-row"><div class="field"><label for="partner-birth">상대 양력 생년월일</label><input id="partner-birth" name="birthDate" type="date" min="1900-01-01" max="${date}" required value="${esc(matchInput.birthDate)}"></div>
        <div class="field"><label for="partner-time">태어난 시간 <span class="opt-note">모르면 비워 두세요</span></label><input id="partner-time" name="birthTime" type="time" value="${esc(matchInput.birthTime)}"></div></div>
        <div class="actions"><button class="btn primary" type="submit">궁합 보기</button>${r && accountState.ready ? `<button class="btn soft" type="button" data-action="save-person">${icon('plus')} 이 사람 저장</button>` : ''}</div>
        <p id="error" class="error-text" role="alert" tabindex="-1"></p>
      </form>
    </div>
    <aside class="side sticky-side">${poster({ word: '궁합', size: 'low', label: 'TWO OF US', art: './assets/art/heart.webp', alt: '분홍 실로 꿰맨 크림색 펠트 하트' })}<div class="card tip"><span class="eyebrow">가볍게 봐요</span><p>사주 일간의 오행, 띠의 어울림, 별자리 원소를 함께 읽은 재미용 결과예요. 관계를 판단하는 기준으로 쓰지 않아요.</p></div></aside>
  </div>
  ${r ? `<section class="sec match-result" aria-labelledby="match-title"><p class="eyebrow">${esc(matchInput.name ? `${matchInput.name}${wa(matchInput.name)}` : '상대와')} 나</p><h2 id="match-title" class="result-title" tabindex="-1">${keepDots(r.headline)}</h2><div class="overall">${level(r.overall, `전체 결 다섯 칸 중 ${r.overall}칸`)}</div>
        <div class="grid three">${r.aspects.map(a => `<div class="card"><div class="card-top"><span class="eyebrow">${esc(a.title)}</span>${level(a.level, `${a.title} ${a.level}칸`)}</div><p>${keepDots(a.text)}</p></div>`).join('')}</div>
        ${r.tip ? `<p class="note-line">${keepDots(r.tip)}</p>` : ''}
        ${r.basis?.length ? `<details class="more"><summary>이렇게 읽었어요</summary><ul class="notes">${r.basis.map(b => `<li>${esc(b)}</li>`).join('')}</ul></details>` : ''}</section>` : ''}`;
}
function yearView() {
  const year = Number(date.slice(0, 4));
  if (!hasProfile()) return needProfile(`${year}년,<br><span class="hl">나의 한 해.</span>`, String(year), './assets/art/firework.webp');
  const y = mode === 'korean' ? getYearReading({ saju: sajuFor(date), year }) : getZodiacYear({ signId, year });
  const month = Number(date.slice(5, 7));
  return `<div class="month-head"><div><p class="kicker">${year} · <b class="ko">${esc(y.ganji ? `${y.ganji}년` : profileLabel())}</b></p><h1 class="page-title" tabindex="-1">${keepDots(y.headline)}</h1><p class="lead">${keepDots(y.message)}</p>${y.keywords?.length ? `<div class="chips">${y.keywords.map(k => `<span class="chip tag">${esc(k)}</span>`).join('')}</div>` : ''}</div>${poster({ word: String(year), size: 'low', label: 'THIS YEAR', art: './assets/art/firework.webp', alt: '알록달록한 펠트 폭죽' })}</div>
  <section class="sec">${secHead(1, '달마다')}<div class="months">${(y.months || []).map(m => `<div class="card mon${m.month === month ? ' now' : ''}"><div class="card-top"><span class="eyebrow">${m.month}월${m.month === month ? ' · 이번 달' : ''}</span>${level(m.level, `${m.month}월 ${m.level}칸`)}</div><p>${keepDots(m.line)}</p></div>`).join('')}</div></section>
  <p class="hint">신년 운세처럼 가볍게 읽는 한 해 이야기예요. 실제 사건이나 성패를 예측하지 않아요.</p>`;
}
function vaultView() {
  if (!accountState.ready) return `<div class="split"><div class="main"><p class="kicker">MY FORTUNE</p><h1 class="page-title" tabindex="-1">맞았는지,<br><span class="hl">남겨 두면 재밌어요.</span></h1><p class="lead">SYNK ID로 로그인하면 오늘의 운세와 메모를 담고, 맞았는지 표시하고, 최근 7일을 돌아볼 수 있어요.</p><button class="btn primary" type="button" data-action="account">SYNK ID로 이어가기</button></div><aside class="side">${poster({ word: '보관함', size: 'low', art: './assets/art/star.webp', alt: '노란 펠트 별' })}</aside></div>`;
  const entries = vault.entries.filter(e => vaultFilter === 'all' || (vaultFilter === 'completed' ? e.completed : ['hit', 'meh', 'miss'].includes(vaultFilter) ? e.verdict === vaultFilter : e.mode === vaultFilter));
  const hits = vault.entries.filter(e => e.verdict === 'hit').length, judged = vault.entries.filter(e => e.verdict).length;
  const recent = recentReflections(vault, date);
  return `<div class="month-head"><div><p class="kicker">MY FORTUNE</p><h1 class="page-title" tabindex="-1">내 보관함</h1>
    <ul class="meta"><li><small class="ko">담은 운세</small><span class="big">${vault.entries.length}</span></li><li><small class="ko">해 본 실천</small><span class="big">${vault.entries.filter(e => e.completed).length}</span></li><li><small class="ko">맞았어요</small><span class="big">${hits}${judged ? `<span class="small muted"> / ${judged}</span>` : ''}</span></li><li><small class="ko">한도</small>90개</li></ul></div>${poster({ word: '보관함', size: 'low', art: './assets/art/star.webp', alt: '노란 펠트 별' })}</div>
  <section class="sec">${secHead(1, '담아 둔 운세')}
    <div class="seg filters" role="group" aria-label="보관함 거르기">${[['all', '전체'], ['western', '별자리'], ['korean', '사주'], ['completed', '실천'], ['hit', '맞았어요']].map(([id, label]) => `<button type="button" data-filter="${id}" aria-pressed="${vaultFilter === id}">${label}</button>`).join('')}</div>
    ${entries.length ? `<ul class="rows entries">${entries.map(e => `<li><div><span class="s">${dayLabel(e.date)} · ${e.mode === 'korean' ? '한국 사주' : esc(getZodiacProfile(e.signId).label)}${e.completed ? ' · 실천했어요' : ''}</span><span class="t">${esc(e.title)}</span>${e.note ? `<span class="note">${esc(e.note)}</span>` : ''}</div>
      <div class="row-actions"><div class="seg verdict" role="group" aria-label="이날 운세가 맞았나요">${Object.entries(VERDICT).map(([id, label]) => `<button type="button" data-verdict="${id}" data-entry="${esc(e.id)}" aria-pressed="${e.verdict === id}" ${accountBusy ? 'disabled' : ''}>${label}</button>`).join('')}</div><button class="btn small soft" type="button" data-open="${esc(e.id)}">다시 보기</button><button class="btn small ghost danger" type="button" data-remove="${esc(e.id)}" ${accountBusy ? 'disabled' : ''}>삭제</button></div></li>`).join('')}</ul>` : `<div class="empty"><strong>아직 담은 운세가 없어요.</strong><p>오늘의 운세에서 「보관함에 담기」를 눌러 보세요.</p></div>`}
  </section>
  <section class="sec">${secHead(2, '최근 7일 돌아보기', `<span class="small">${esc(recent.startDate)} – ${esc(recent.endDate)}</span>`)}
    <div class="recent">${recent.days.map(day => `<div class="rday${day.entries.length ? '' : ' empty-day'}"><span class="d">${day.date === date ? '오늘' : dayLabel(day.date)}</span>${day.entries.length ? day.entries.map(e => `<button class="rec" type="button" data-open="${esc(e.id)}"><strong>${esc(e.title)}</strong>${e.completed ? `<span class="small">실천 · ${esc(e.action)}</span>` : ''}${e.note.trim() ? `<span class="small muted">“${esc(e.note)}”</span>` : ''}</button>`).join('') : '<span class="small muted">남긴 기록 없음</span>'}</div>`).join('')}</div>
  </section>
  ${(vault.people || []).length ? `<section class="sec">${secHead(3, '저장한 사람')}<ul class="rows">${vault.people.map(p => `<li><div><span class="t">${esc(p.name)}</span><span class="s">${RELATION[p.relation] || ''} · ${esc(dayLabel(p.birthDate, { weekday: false, today: '' }))}${p.birthTime ? ` · ${esc(p.birthTime)}` : ''}</span></div><div class="row-actions"><button class="btn small soft" type="button" data-person="${esc(p.id)}" data-go-match>궁합 보기</button><button class="btn small ghost danger" type="button" data-remove-person="${esc(p.id)}" ${accountBusy ? 'disabled' : ''}>삭제</button></div></li>`).join('')}</ul></section>` : ''}`;
}
function accountBody() {
  const signedIn = accountState.status === 'signed-in';
  return `<div class="acct-status"><span class="led-chip ${accountState.ready ? '' : signedIn ? 'check' : 'plain'}">${accountState.ready ? '연결됨' : signedIn ? '확인 중' : accountState.status === 'signing-in' ? '로그인 중' : '로그인 전'}</span><p>${esc(accountState.account?.display_name ? `${accountState.account.display_name}님 · ` : '')}${esc(accountState.message || '')}</p></div>
  <div class="actions">${!signedIn && (accountState.configured || accountState.retryable) ? `<button class="btn primary" type="button" data-acct="login" ${accountBusy || accountState.status === 'signing-in' ? 'disabled' : ''}>${accountState.retryable ? '계정 연결 다시 확인' : 'SYNK ID로 로그인'}</button>` : ''}${accountState.status === 'signing-in' ? '<button class="btn soft" type="button" data-acct="cancel">취소</button>' : ''}${signedIn ? `<button class="btn soft" type="button" data-acct="reload" ${accountBusy ? 'disabled' : ''}>${icon('refresh')} 다시 불러오기</button><button class="btn ghost" type="button" data-acct="logout">로그아웃</button>` : ''}</div>
  ${accountState.ready ? `<section class="acct-sec"><h3>내 정보</h3><p class="small muted">${vault.profile ? `저장된 출생정보 · 양력 ${esc(vault.profile.birthDate)} · ${esc(vault.profile.birthTime ?? '시간 모름')} · 한국 표준시` : '저장된 출생정보가 없어요. 화면에서 고른 정보를 저장할 수 있어요.'}</p><button class="btn small soft" type="button" data-acct="save-profile" ${accountBusy || !hasProfile() ? 'disabled' : ''}>지금 고른 방식과 정보 저장</button></section>
  <section class="acct-sec"><h3>내 기록</h3><p class="small muted">출생정보·메모가 들어간 파일로 내보내거나, 이 계정의 운세 정보만 지울 수 있어요. SYNK 계정 자체는 지우지 않아요.</p><div class="actions"><button class="btn small soft" type="button" data-acct="export" ${accountBusy ? 'disabled' : ''}>${icon('download')} 내보내기</button><button class="btn small ghost danger" type="button" data-acct="delete" ${accountBusy ? 'disabled' : ''}>운세 정보 전체 삭제</button></div>
    ${deletePending ? `<div class="notice-box alert"><span class="lbl">확인</span><strong>저장한 출생정보·선호·보관함을 모두 지울까요?</strong><p>지운 뒤에는 되돌릴 수 없어요.</p><div class="actions"><button class="btn small primary" type="button" data-acct="confirm-delete" ${accountBusy ? 'disabled' : ''}>모두 지우기</button><button class="btn small soft" type="button" data-acct="cancel-delete">취소</button></div></div>` : ''}</section>` : ''}
  <p class="small muted">비회원 입력은 이 화면 메모리에만 있어요. 출생정보는 저장 단추를 누를 때만 계정으로 보내요.</p>`;
}

const VIEWS = { today: todayView, month: monthView, match: matchView, year: yearView, vault: vaultView };
function render({ focus = true } = {}) {
  app.innerHTML = VIEWS[view]();
  for (const swatch of app.querySelectorAll('[data-color]')) if (/^#[0-9a-f]{6}$/i.test(swatch.dataset.color)) swatch.style.setProperty('--sw', swatch.dataset.color);
  for (const meta of app.querySelectorAll('.meta[data-cols]')) meta.style.setProperty('--cols', meta.dataset.cols);
  paintNav(); paintAccount();
  if (focus) { window.scrollTo({ top: 0, behavior: 'instant' }); app.querySelector('h1[tabindex]')?.focus({ preventScroll: true }); }
  document.documentElement.dataset.ready = 'true';
}
function paintNav() {
  for (const b of document.querySelectorAll('.tabs [data-view], .tabbar [data-view]')) { if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
  const count = document.querySelector('[data-vault-count]'); if (count) count.textContent = accountState.ready && vault.entries.length ? String(vault.entries.length) : '';
}
function paintAccount() {
  const chip = document.querySelector('[data-action="account"].acct');
  if (chip) {
    chip.dataset.state = accountState.ready ? 'ok' : ['loading', 'signing-in'].includes(accountState.status) ? 'busy' : accountState.status === 'error' || accountState.retryable ? 'alert' : '';
    chip.querySelector('span').textContent = accountState.ready ? (accountState.account?.display_name || '내 계정') : accountState.status === 'signing-in' ? '로그인 중' : accountState.status === 'signed-in' ? '확인 중' : '로그인';
  }
  const body = document.querySelector('#account-body'); if (body && !sheet.open_) body.innerHTML = accountBody(); else if (body) { const focused = document.activeElement?.dataset?.acct; body.innerHTML = accountBody(); if (focused) body.querySelector(`[data-acct="${focused}"]`)?.focus(); }
}
function paintTheme() {
  const button = document.querySelector('[data-action="theme"]'), theme = document.documentElement.dataset.theme || 'night';
  button.innerHTML = icon(theme === 'day' ? 'sun' : theme === 'system' ? 'monitor' : 'moon');
  button.setAttribute('aria-label', `화면 밝기: ${THEME_LABEL[theme]} (눌러서 바꾸기)`);
}
function error(text) { const t = app.querySelector('#error'); if (t) { t.textContent = text; t.focus(); } else toast(text); }

// ── 날짜 ─────────────────────────────────────────────
function refreshDay() {
  const current = seoulDateKey();
  if (current === date) return false;
  if (readingDate === date) readingDate = current;
  date = current; render({ focus: false });
  toast('한국 시간이 새날로 바뀌어 오늘의 내용을 새로 준비했어요.');
  return true;
}
function scheduleDay() { clearTimeout(dayTimer); dayTimer = setTimeout(() => { refreshDay(); scheduleDay(); }, millisecondsUntilNextSeoulDay() + 100); }

// ── 입력 ─────────────────────────────────────────────
function setView(next) { if (!VIEWS[next]) return; refreshDay(); view = next; setupOpen = false; render(); }
function captureDraft() {
  const form = app.querySelector('#keep'); if (!form || !hasProfile()) return;
  const r = reading(); if (!r) return;
  drafts.set(readingKey(r), { note: form.elements.note.value, completed: form.elements.completed.checked });
}
// 계정을 불러오거나 지우는 동안 사람이 화면을 바꿨는지는 입력·선택에서만 센다(다시 그리기는 세지 않는다).
const touched = () => { screenVersion++; };
function keepSetupInput(form) {
  if (form?.id === 'saju-form') birthInput = { birthDate: form.elements.birthDate.value, birthTime: form.elements.birthTime.value, timeUnknown: form.elements.timeUnknown.checked };
  else if (form?.id === 'find-sign') zodiacInput = form.elements.birthDate.value;
}
app.addEventListener('input', event => {
  touched(); keepSetupInput(event.target.form);
  if (event.target.name === 'note' || event.target.name === 'completed') { captureDraft(); const c = app.querySelector('[data-note-count]'); if (c) c.textContent = `${[...app.querySelector('#note').value].length} / 1000`; }
  if (event.target.form?.id === 'match-form') { const f = event.target.form; if (f.elements.myBirth) myBirthForMatch = f.elements.myBirth.value; matchInput = { ...matchInput, name: f.elements.name.value, relation: f.elements.relation.value, birthDate: f.elements.birthDate.value, birthTime: f.elements.birthTime.value }; }
});
app.addEventListener('change', event => {
  touched();
  if (event.target.name === 'completed') captureDraft();
  if (event.target.name === 'timeUnknown') { const time = app.querySelector('#birth-time'); time.disabled = event.target.checked; if (event.target.checked) time.value = ''; }
  keepSetupInput(event.target.form);
});
app.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  try {
    refreshDay();
    if (form.id !== 'keep') touched();
    if (form.id === 'saju-form') {
      const unknown = form.elements.timeUnknown.checked, input = { birthDate: form.elements.birthDate.value, birthTime: unknown ? null : form.elements.birthTime.value || null };
      if (!unknown && !input.birthTime) throw new Error('태어난 시간을 적거나 「태어난 시간을 몰라요」를 골라 주세요.');
      getSaju(input, date); birth = input; birthInput = null; mode = 'korean'; readingDate = date; setupOpen = false; render();
    } else if (form.id === 'find-sign') {
      birthProfile(form.elements.birthDate.value);
      const s = suggestZodiac(form.elements.birthDate.value); signId = s.signId; zodiacInput = ''; mode = 'western'; readingDate = date; setupOpen = false; render();
      toast(`${s.label} · ${s.note}`);
    } else if (form.id === 'keep') {
      void accountTask(async () => {
        const r = reading(); if (!r) return;
        const key = readingKey(r), submitted = drafts.get(key);
        const next = saveReading(vault, r, { note: form.elements.note.value.trim(), completed: form.elements.completed.checked });
        next.preferences = { mode, signId }; if (mode === 'korean') next.profile = birthProfile(birth.birthDate, birth.birthTime);
        await connection.save(next); if (drafts.get(key) === submitted) drafts.delete(key); applyAccount();
      }, '오늘의 운세와 한 줄을 보관함에 담았어요.');
    } else if (form.id === 'match-form') {
      const me = birth?.birthDate ? { birthDate: birth.birthDate, birthTime: birth.birthTime } : vault.profile ? { birthDate: vault.profile.birthDate, birthTime: vault.profile.birthTime } : { birthDate: form.elements.myBirth.value, birthTime: null };
      if (!me.birthDate) throw new Error('내 생년월일을 먼저 적어 주세요.');
      if (!matchInput.birthDate) throw new Error('상대의 생년월일을 적어 주세요.');
      birthProfile(me.birthDate); birthProfile(matchInput.birthDate, matchInput.birthTime || null);
      matchResult = getCompatibility({ birthDate: me.birthDate, birthTime: me.birthTime ?? null }, { birthDate: matchInput.birthDate, birthTime: matchInput.birthTime || null, name: matchInput.name });
      render({ focus: false }); app.querySelector('#match-title')?.focus();
    }
  } catch (err) { error(err.message || '입력을 확인해 주세요.'); }
});
document.addEventListener('click', event => {
  const t = event.target.closest('button,[data-view]'); if (!t) return;
  if (t.dataset.view) { event.preventDefault(); captureDraft(); setView(t.dataset.view); return; }
  if (t.dataset.mode || t.dataset.sign || t.dataset.day || t.dataset.person) touched();
  if (t.dataset.mode) { mode = t.dataset.mode; render({ focus: false }); return; }
  if (t.dataset.sign) { refreshDay(); signId = t.dataset.sign; mode = 'western'; readingDate = date; setupOpen = false; render(); return; }
  if (t.dataset.day) { captureDraft(); readingDate = t.dataset.day; view = 'today'; render(); return; }
  if (t.dataset.filter) { vaultFilter = t.dataset.filter; render({ focus: false }); return; }
  if (t.dataset.verdict) { const id = t.dataset.entry, value = t.dataset.verdict, entry = vault.entries.find(e => e.id === id); void accountTask(async () => { await connection.save(setVerdict(vault, id, entry?.verdict === value ? null : value)); applyAccount(); }, '표시를 남겼어요.'); return; }
  if (t.dataset.open) { const e = vault.entries.find(item => item.id === t.dataset.open); if (e) openEntry(e); return; }
  if (t.dataset.remove) { void accountTask(async () => { await connection.save({ ...vault, entries: vault.entries.filter(e => e.id !== t.dataset.remove) }); applyAccount(); }, '기록을 삭제했어요.'); return; }
  if (t.dataset.removePerson) { void accountTask(async () => { await connection.save(removePerson(vault, t.dataset.removePerson)); applyAccount(); }, '저장한 사람을 지웠어요.'); return; }
  if (t.dataset.person) { const p = (vault.people || []).find(item => item.id === t.dataset.person); if (p) { matchInput = { name: p.name, relation: p.relation, birthDate: p.birthDate, birthTime: p.birthTime || '', timeUnknown: !p.birthTime }; matchResult = null; view = 'match'; render(); } return; }
  if (t.dataset.acct) { accountAction(t.dataset.acct); return; }
  const action = t.dataset.action;
  if (action === 'theme') { const next = cycleTheme(); paintTheme(); toast(`${THEME_LABEL[next]}으로 바꿨어요.`); }
  else if (action === 'account') sheet.open(t);
  else if (action === 'change') { setupOpen = true; render(); app.querySelector('#setup')?.scrollIntoView({ block: 'start' }); }
  else if (action === 'back-today') { captureDraft(); readingDate = date; render(); }
  else if (action === 'copy') void copyReading();
  else if (action === 'save-person') void accountTask(async () => { await connection.save(savePerson(vault, { name: matchInput.name || '이름 없음', relation: matchInput.relation, birthDate: matchInput.birthDate, birthTime: matchInput.birthTime || null })); applyAccount(); }, '이 사람을 저장했어요. 다음엔 바로 궁합을 볼 수 있어요.');
});
async function copyReading() {
  refreshDay();
  const r = reading(); if (!r) return;
  const text = [`${dayLabel(r.date)} · ${mode === 'korean' ? '한국 사주' : getZodiacProfile(signId).label}`, r.headline, r.message, `해 보면 좋은 것: ${r.do}`, `행운의 색: ${r.luckyColor?.name} · 숫자: ${r.luckyNumber}`, 'SYNK 무료 운세 · synk.im/fortune'].join('\n');
  try { if (!navigator.clipboard?.writeText) throw new Error('clipboard'); await navigator.clipboard.writeText(text); toast('오늘의 운세를 복사했어요.'); }
  catch { const box = app.querySelector('.manual-copy'); box.hidden = false; const area = box.querySelector('textarea'); area.value = text; area.focus(); area.select(); toast('자동 복사가 어려워 직접 복사할 글을 열었어요.'); }
}
function openEntry(entry) {
  if (entry.mode === 'western') { mode = 'western'; signId = entry.signId; }
  else { mode = 'korean'; birth = { birthDate: entry.birth.birthDate, birthTime: entry.birth.birthTime }; birthInput = null; }
  readingDate = entry.date; view = 'today'; setupOpen = false; render();
}

// ── 계정 ─────────────────────────────────────────────
function applyAccount({ restore = false } = {}) {
  const snapshot = connection.snapshot(); if (!snapshot.ready) return;
  vault = snapshot.state;
  const identity = snapshot.account.synk_user_id;
  if (restore || loadedIdentity !== identity) {
    loadedIdentity = identity;
    if (vault.profile) { birth = { birthDate: vault.profile.birthDate, birthTime: vault.profile.birthTime }; birthInput = null; }
    mode = vault.preferences.mode; signId = vault.preferences.signId; readingDate = date;
    if (mode === 'western' && !signId) mode = birth ? 'korean' : null;
  }
  render({ focus: false });
}
function clearScreen() { drafts.clear(); mode = null; signId = null; birth = null; birthInput = null; zodiacInput = ''; readingDate = date; matchResult = null; matchInput = { name: '', relation: 'friend', birthDate: '', birthTime: '', timeUnknown: true }; myBirthForMatch = ''; deletePending = false; }
const connection = createFortuneAccount({
  onState(next) { accountState = next; if (next.ready) applyAccount(); else { render({ focus: false }); } },
  onReset() { vault = emptyState(); loadedIdentity = null; clearScreen(); render({ focus: false }); },
});
async function accountTask(action, success) {
  if (accountBusy) return; accountBusy = true; paintAccount(); render({ focus: false });
  try { const message = await action(); if (success) toast(typeof message === 'string' ? message : success); }
  catch (err) { if (err.code !== 'ACCOUNT_CHANGED') toast(err.message || '계정 연결을 확인해 주세요.'); }
  finally { accountBusy = false; render({ focus: false }); }
}
function accountAction(name) {
  if (name === 'login') void accountTask(() => connection.signIn());
  else if (name === 'cancel') void accountTask(() => connection.cancel());
  else if (name === 'logout') void connection.signOut().catch(err => toast(err.message));
  else if (name === 'reload') void accountTask(async () => {
    const expected = screenVersion; await connection.load();
    if (expected !== screenVersion) { applyAccount(); return '계정의 최신 정보를 불러왔어요. 기다리는 동안 바꾼 입력은 저장하지 않고 화면에 남겨 두었어요.'; }
    clearScreen(); applyAccount({ restore: true });
  }, '계정의 최신 정보를 불러왔어요.');
  else if (name === 'save-profile') void accountTask(async () => { const profile = birth ? birthProfile(birth.birthDate, birth.birthTime) : vault.profile; await connection.save({ ...vault, profile, preferences: { mode: mode || 'western', signId } }); applyAccount(); }, '내 정보와 보는 방식을 계정에 저장했어요.');
  else if (name === 'export') { if (!accountState.ready) return; const file = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...vault }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(file), link = document.createElement('a'); link.href = url; link.download = 'synk-fortune.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); toast('출생정보와 메모가 들어간 내 기록 파일을 준비했어요.'); }
  else if (name === 'delete') { deletePending = true; paintAccount(); }
  else if (name === 'cancel-delete') { deletePending = false; paintAccount(); }
  else if (name === 'confirm-delete') void accountTask(async () => {
    const expected = screenVersion; await connection.remove();
    const changed = expected !== screenVersion; if (!changed) clearScreen(); deletePending = false; applyAccount();
    if (changed) return '계정의 운세 정보와 기록을 삭제했어요. 기다리는 동안 바꾼 입력은 화면에 남겨 두었어요.';
  }, '계정에 저장한 운세 정보와 기록을 삭제했어요.');
}

for (const slot of document.querySelectorAll('.tabbar [data-icon]')) slot.outerHTML = icon(slot.dataset.icon);
document.querySelector('[data-sheet-close]').innerHTML = icon('close');
paintTheme();
render({ focus: false });
scheduleDay();
window.addEventListener('focus', () => { refreshDay(); scheduleDay(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshDay(); scheduleDay(); } });
void connection.start().catch(err => { accountState = { ...accountState, message: err.message }; paintAccount(); });
window.addEventListener('pagehide', () => connection.dispose());
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
