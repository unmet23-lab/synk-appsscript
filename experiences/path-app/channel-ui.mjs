// PATH 「채널」 화면. 상태를 받아 HTML 글을 내는 순수 함수만 둔다(창, DOM, 저장소를 쓰지 않는다).
// 결: 시안 2판(2026-11-21)의 채널 · 채널 글. 색은 .sx 아래에서만 쓰고, 공개 CSP(style-src 'self')라 인라인 스타일을 쓰지 않는다.
import { CHANNELS, COLLECTING, monthDay, dateStatus, upcomingDates, featuredPost, latestPosts, nextDate, isStalePost, isNewPost, postById, dueDay, endDay } from './channel-data.mjs';
import { financeRule, programById, proofRule, announcedRules } from './study-data.mjs';
import { matchProgram } from './match.mjs';
import { isEmptyProfile } from './study-profile.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (p) => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
const GO = svg('<path d="M4 10h11.5M11 5.5 15.5 10 11 14.5"/>');
const BACK = svg('<path d="M12.5 4.5 7 10l5.5 5.5"/>');
const NEXT = svg('<path d="M7.5 4.5 13 10l-5.5 5.5"/>');
// 채널 표시: 글자를 넣은 네모 대신 선 그림 하나(시안 1판 검수의 지적).
const ICON = {
  topik: svg('<path d="M4 15.5 13.5 6l1.5 1.5L5.5 17H4z"/><path d="M12 7.5 13.5 9"/>'),
  visa: svg('<path d="M6 3h6l3 3v11H6z"/><path d="M12 3v3h3M8.5 10h4M8.5 13h4"/>'),
  scholarship: svg('<path d="M10 3.5l1.9 4 4.3.5-3.2 2.9.9 4.3L10 13.1l-3.9 2.1.9-4.3L3.8 8l4.3-.5z"/>'),
  scam: svg('<path d="M10 3.5 17 16H3z"/><path d="M10 8.5v3.5M10 14.2v.1"/>'),
  univ: svg('<path d="M2.5 8 10 4.5 17.5 8 10 11.5z"/><path d="M5.5 9.5v4c1.2 1.2 2.7 1.8 4.5 1.8s3.3-.6 4.5-1.8v-4"/>')
};
const ON = svg('<path d="m5 10.4 3.2 3.1L15 6.6"/>');
const CAL = svg('<rect x="3.5" y="4.5" width="13" height="12" rx="2"/><path d="M3.5 8.5h13M7 3v3M13 3v3"/>');

function ctx(view) {
  const now = view.now || new Date();
  const en = view.lang === 'en';
  const L = (ko, e) => (en ? e : ko);
  const pick = (o) => (o ? (en ? o.en : o.ko) : '');
  const won = (n) => (en ? `₩${n.toLocaleString('en-US')}` : n < 10000 ? `${n.toLocaleString('ko-KR')}원` : n % 10000 === 0 ? `${(n / 10000).toLocaleString('ko-KR')}만 원` : `${Math.floor(n / 10000).toLocaleString('ko-KR')}만 ${(n % 10000).toLocaleString('ko-KR')}원`);
  const thisYear = Number(new Date((now instanceof Date ? now.getTime() : new Date(now).getTime()) + 9 * 3600000).toISOString().slice(0, 4));
  const md = (d) => monthDay(d, en, thisYear);
  return { now, en, L, pick, won, md, posts: view.posts || [], programs: view.programs || [], rules: view.rules || [], profile: view.profile, lang: en ? 'en' : 'ko', condOn: view.condOn !== false, persisted: view.persisted !== false, note: typeof view.note === 'string' ? view.note : '' };
}

const channelOf = (id) => CHANNELS.find((c) => c.id === id) || null;
const newTab = (T) => `<span class="sr-only"> (${T.L('새 탭에서 열림', 'opens in new tab')})</span>`;
const promise = (T) => `<p class="sx-fine">${T.L('이 결과는 입학이나 비자, 장학금 선발을 약속하지 않아요. 마지막 판단은 대학과 출입국, 장학 기관이 해요.', 'This does not promise admission, a visa or a scholarship. The university, the immigration office and the scholarship body make the final decision.')}</p>`;
// 저장이 막힌 브라우저면 눈으로도 보이게 경고로 바꾼다(페이블 F3). 로그아웃해도 지워진다(페이블 F1).
const storeLine = (T) => (T.persisted
  ? `<p class="sx-fine sx-store-line">${T.L('넣은 날은 이 탭에만 있어요. 탭을 닫거나 로그아웃하면 사라지니 달력에도 넣어 두세요.', 'Dates you add stay in this tab only. They disappear when you close the tab or sign out, so add them to your calendar too.')}</p>`
  : `<p class="sx-store is-warn sx-store-line">${T.L('이 브라우저에서는 저장할 수 없어서 넣은 날을 지금 화면에서만 기억해요. 새로 고치면 사라지니 달력에 넣어 두세요.', 'This browser cannot store dates, so they are remembered on this screen only and are lost on reload. Add them to your calendar.')}</p>`);

/** 날의 남은 날 글. 보이는 글과 화면 읽기 글을 따로 낸다(「D-12」를 「12일 남음」으로 읽게). */
export function leftText(status, T) {
  const n = status.days, days = (k) => T.L(`${k}일`, `${k} day${k === 1 ? '' : 's'}`);
  switch (status.state) {
    case 'before': return { shown: T.L(`시작 D-${n}`, `Opens in ${days(n)}`), said: T.L(`${n}일 뒤 접수 시작`, `Opens in ${days(n)}`) };
    case 'open': return n === 0 ? { shown: T.L('오늘 마감', 'Closes today'), said: T.L('오늘 마감', 'Closes today') } : { shown: T.L(`마감 D-${n}`, `${days(n)} left`), said: T.L(`마감까지 ${n}일 남음`, `${days(n)} left to apply`) };
    case 'soon': return n === 0 ? { shown: T.L('오늘', 'Today'), said: T.L('오늘', 'Today') } : { shown: T.L(`D-${n}`, `${days(n)} left`), said: T.L(`${n}일 남음`, `${days(n)} left`) };
    case 'cancelled': return { shown: T.L('취소됨', 'Cancelled'), said: T.L('취소됨', 'Cancelled') };
    default: return { shown: T.L('지남', 'Past'), said: T.L('지난 날', 'Past') };
  }
}

/** 날짜 글: 접수 기간은 「12월 1일~11일」, 하루짜리는 「12월 3일」. */
export function spanText(d, T) {
  if (d.kind !== 'apply') return T.md(d.start);
  const [sy, sm] = d.start.split('-'), [ey, em, ed] = d.end.split('-');
  if (!T.en && sy === ey && sm === em) return `${T.md(d.start)}~${Number(ed)}일`;
  return `${T.md(d.start)} – ${T.md(d.end)}`;
}

const near = (st) => (st.state === 'open' || st.state === 'soon') && st.days !== null && st.days <= 14;
/** 날짜 칸: 시작 전이면 시작 날, 그 밖에는 그날(접수 기간은 끝 날). */
function dayBox(d, st, T) {
  const day = st.state === 'before' ? d.start : dueDay(d);
  const [, m, dd] = day.split('-').map(Number);
  return `<span class="sx-day${near(st) ? ' is-near' : ''}" aria-hidden="true"><small>${T.en ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1] : `${m}월`}</small><b>${dd}</b></span>`;
}

/* ── 「내게 해당되나요?」 ── */

/** 규칙마다 한두 줄. 판정 말(맞아요 · 모자라요) 대신 기준과 내 값을 쓴다. */
export function forYouLines(post, view) {
  const T = view.T || ctx(view), p = T.profile || {};
  const enter = (what) => ({ text: T.L(`${what.ko}을 넣으면 나란히 보여 줘요.`, `Enter ${what.en} to see it side by side.`), cond: true });
  if (post.forYou === 'program') {
    const prog = programById(T.programs, post.programId);
    if (!prog) return [];
    if (isEmptyProfile(p)) return [{ text: T.L('내 조건(한국어, 성적, 학력, 준비한 돈)을 넣으면 이 과정과 맞춰 봐요.', 'Enter your conditions (Korean, grades, education, funds) to compare them with this program.'), cond: true }];
    const m = matchProgram(p, prog, T.rules);
    return [{ text: T.L(`내 조건 4개 중 ${m.okCount}개 맞음. 「확인 필요」는 맞음으로 세지 않아요.`, `${m.okCount} of 4 conditions met. “To check” is not counted as met.`) }];
  }
  if (post.forYou === 'finance') {
    const lines = [];
    for (const [visa, name] of [['D-4', T.L('어학연수(D-4)', 'Language training (D-4)')], ['D-2', T.L('유학(D-2)', 'Study (D-2)')]]) {
      const parts = [['local', T.L('지방 대학', 'outside Seoul area')], ['metro', T.L('수도권 대학', 'Seoul area')]].map(([region, label]) => {
        const r = financeRule(T.rules, visa, region);
        if (!r) return null;
        const firm = r.inCurrentGuide === true && !r.stale;
        return firm ? `${label} ${T.won(r.won)}` : `${label} ${T.L('금액 확인 중(비교하지 않음)', 'amount being confirmed (not compared)')}`;
      }).filter(Boolean);
      if (parts.length) lines.push({ text: `${name}: ${parts.join(', ')}` });
    }
    lines.push(p.fundsWon === null || p.fundsWon === undefined ? enter({ ko: '준비한 돈', en: 'your funds' }) : { text: T.L(`내 값: ${T.won(p.fundsWon)}`, `Yours: ${T.won(p.fundsWon)}`) });
    const proof = proofRule(T.rules, 'D-2');
    if (proof) lines.push({ text: T.L(`잔고 증명서는 비자 신청일 기준 ${proof.issuedWithinDays}일 안에 발급받고, 그 금액을 ${proof.heldDays}일 이상 유지해야 해요.`, `The balance certificate must be issued within ${proof.issuedWithinDays} days of the visa application, and the amount kept for at least ${proof.heldDays} days.`) });
    const waiver = announcedRules(T.rules, 'finance-waiver')[0];
    if (waiver) lines.push({ text: T.L(`계획 발표: TOPIK ${waiver.topik}급이 있으면 이 증명을 면제하는 계획이 ${waiver.basis}에 발표됐어요. 시행일은 정해지지 않아 대조에 쓰지 않았어요.`, `Announced plan: waiving this proof for TOPIK level ${waiver.topik} was announced on ${waiver.basis}. No start date has been set, so it is not used here.`), plan: true });
    return lines;
  }
  if (post.forYou === 'gksGrade') {
    const c = post.criteria;
    const rule = { text: T.L(`기준: ${c.of ? `${c.of.ko} ` : ''}평균 ${c.gradePct}% 이상${c.other ? ` (${c.other.ko})` : ''}`, `Requirement: ${c.of ? `${c.of.en}, ` : ''}average of ${c.gradePct}% or higher${c.other ? ` (${c.other.en})` : ''}`) };
    return [rule, p.gradePct === null || p.gradePct === undefined ? enter({ ko: '성적 평균', en: 'your grade average' }) : { text: T.L(`내 값: 평균 ${p.gradePct}%`, `Yours: ${p.gradePct}% average`) }];
  }
  if (post.forYou === 'topikExam') {
    // 접수 하나에 한 줄: 마감 전에 나오는 성적을 붙인다(성적마다 접수를 늘어놓으면 같은 이름이 되풀이된다).
    const results = post.dates.filter((d) => d.kind === 'result' && !d.cancelled);
    const exam = (d) => T.pick(d.label).replace(/ 성적 발표$| results$/, '');
    const rows = [];
    for (const prog of T.programs) {
      if (prog.example || !Array.isArray(prog.applyRounds)) continue;
      prog.applyRounds.forEach((round, i) => {
        if (dateStatus({ kind: 'apply', start: round[0], end: round[1] }, T.now).state === 'past') return;
        const before = results.filter((r) => round[1] > r.start);
        if (!before.length) return;
        // 같은 대학의 학부와 어학 과정이 헷갈리지 않게 학부에는 「학부」를 붙인다(대학 소식 글 제목과 같은 이름).
        const name = `${T.pick(prog.name)}${prog.level === 'language' ? '' : T.L(' 학부', ' undergraduate')}${prog.applyRounds.length > 1 ? T.L(` ${i + 1}차`, ` round ${i + 1}`) : ''}`;
        rows.push({ end: round[1], text: T.L(`${name}(${T.md(round[1])} 마감): ${before.map(exam).join(', ')}`, `${name} (closes ${T.md(round[1])}): ${before.map(exam).join(', ')}`) });
      });
    }
    rows.sort((x, y) => (x.end < y.end ? -1 : x.end > y.end ? 1 : 0));
    const lines = rows.length
      ? [{ text: T.L('지금 목록의 접수 가운데 마감 전에 성적이 나오는 곳이에요.', 'Listed applications that close after these results come out:'), lead: true }, ...rows.map((r) => ({ text: r.text }))]
      : [{ text: T.L('지금 목록에는 이 성적 발표 뒤에 마감하는 접수가 없어요.', 'No listed application closes after these results.') }];
    lines.push({ text: T.L('성적표를 언제까지 내야 하는지는 과정마다 달라요. 요강에서 확인하세요.', 'Each program sets its own deadline for score reports. Check the guide.') });
    return lines;
  }
  return [];
}

function forYouCard(post, T) {
  const lines = forYouLines(post, { T }).filter((l) => T.condOn || !l.cond);
  if (!lines.length) return '';
  const cond = T.condOn && lines.some((l) => l.cond) ? `<button type="button" class="sx-link" data-action="nav" data-page="cond">${T.L('내 조건 넣기', 'Enter my conditions')}${NEXT}</button>` : '';
  return `<section class="sx-card butter sx-foryou"><p class="sx-k">${T.L('내게 해당되나요?', 'Does this apply to me?')}</p>${lines.filter((l) => l.lead).map((l) => `<p class="sx-fy-lead">${esc(l.text)}</p>`).join('')}<ul>${lines.filter((l) => !l.lead).map((l) => `<li${l.plan ? ' class="is-plan"' : ''}>${esc(l.text)}</li>`).join('')}</ul>${cond}${post.programId ? `<button type="button" class="sx-link" data-action="univOpen" data-id="${esc(post.programId)}">${T.L('과정 자세히 보기', 'See program details')}${NEXT}</button>` : ''}${promise(T)}</section>`;
}

/* ── 날 목록 ── */

function dateRow(post, d, T, saved) {
  const st = dateStatus(d, T.now), left = leftText(st, T), on = saved.some((s) => s.id === d.id);
  const gone = st.state === 'past' || st.state === 'cancelled';
  const name = T.pick(d.label);
  const add = gone && !on ? '' : `<button type="button" class="sx-btn2 sm" aria-pressed="${on}" data-action="dateToggle" data-id="${esc(d.id)}"><span class="sx-on">${ON}</span>${T.L('내 길에 넣기', 'Add to my path')}<span class="sr-only"> ${esc(name)}</span></button>`;
  const cal = gone ? '' : `<button type="button" class="sx-btn2 sm line" data-action="dateIcs" data-id="${esc(d.id)}">${CAL}${T.L('달력에 넣기', 'Add to calendar')}<span class="sr-only"> ${esc(name)}</span></button>`;
  return `<li class="sx-dayrow${gone ? ' is-gone' : ''}">${dayBox(d, st, T)}<span class="sx-day-main"><b>${esc(name)}</b><small>${esc(spanText(d, T))}</small>${d.url ? `<a class="sx-src-a" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${T.L('원문', 'Source')}${newTab(T)}</a>` : ''}</span><span class="sx-dleft${near(st) ? ' is-near' : ''}"><span aria-hidden="true">${esc(left.shown)}</span><span class="sr-only">${esc(left.said)}</span></span>${add || cal ? `<span class="sx-day-acts">${add}${cal}</span>` : ''}</li>`;
}

/* ── 채널 ── */

function cover(channel, T) {
  return `<span class="sx-cover is-${esc(channel.tone)}" aria-hidden="true"><span>${esc(channel.name.en.toUpperCase())}</span></span>`;
}
function postTag(post, T) {
  const n = nextDate(post, T.now);
  if (!n) return '';
  return `${T.pick(n.date.label)} · ${leftText(n.status, T).shown}`;
}

export function renderChannels(view) {
  const T = ctx(view), profile = T.profile || {}, off = profile.channelsOff || [];
  const one = view.channelId ? channelOf(view.channelId) : null;
  if (one) {
    const list = T.posts.filter((p) => p.channel === one.id);
    const rows = list.map((p) => {
      const n = nextDate(p, T.now), fresh = isNewPost(p, T.now);
      return `<li><button type="button" class="sx-postrow" data-action="postOpen" data-id="${esc(p.id)}"><span class="sx-postrow-main"><b>${fresh ? `<span class="sx-tag is-ok">${T.L('새 글', 'New')}</span> ` : ''}${p.status === 'announced' ? `<span class="sx-tag is-check">${T.L('계획 발표', 'Announced plan')}</span> ` : ''}${esc(T.pick(p.title))}</b><small>${T.L('확인', 'Checked')} ${esc(p.checkedAt)}${n ? ` · ${esc(T.pick(n.date.label))} ${esc(leftText(n.status, T).shown)}` : ''}</small></span><span class="sx-go-s" aria-hidden="true">${NEXT}</span></button></li>`;
    }).join('');
    return `<div class="sx"><button type="button" class="sx-back" data-action="channelOpen" data-id="">${BACK}${T.L('채널', 'News')}</button>
<header class="sx-head"><p class="sx-kicker"><span class="sx-ic is-${esc(one.tone)}">${ICON[one.id]}</span>${esc(T.pick(one.sub))}</p><h1 class="sx-title page-title" tabindex="-1">${esc(T.pick(one.name))}</h1></header>
${showButton(one, off, T)}
${list.length ? `<ul class="sx-postlist">${rows}</ul>` : `<p class="sx-note">${T.L('이 채널에는 아직 글이 없어요.', 'No posts in this channel yet.')}</p>`}${promise(T)}</div>`;
  }
  const feat = featuredPost(T.posts, T.now);
  const featCh = feat && channelOf(feat.channel);
  const hero = feat && featCh ? `<button type="button" class="sx-photo sx-feature" data-action="postOpen" data-id="${esc(feat.id)}">${cover(featCh, T)}<span class="sx-photo-body"><span class="sx-tag white">${esc(T.pick(featCh.name))}${postTag(feat, T) ? ` · ${esc(postTag(feat, T))}` : ''}</span><b>${esc(T.pick(feat.title))}</b><small>${esc(T.pick(feat.points[0]))}</small></span></button>` : '';
  const rows = CHANNELS.map((c) => {
    const list = T.posts.filter((p) => p.channel === c.id);
    if (!list.length) return '';
    const fresh = list.filter((p) => isNewPost(p, T.now)).length;
    return `<li class="sx-chrow"><button type="button" class="sx-ch" data-action="channelOpen" data-id="${esc(c.id)}"><span class="sx-ic is-${esc(c.tone)}">${ICON[c.id]}</span><span class="sx-ch-main"><b>${esc(T.pick(c.name))}</b><small>${esc(T.pick(c.sub))} · ${T.L(`글 ${list.length}개`, `${list.length} post${list.length === 1 ? '' : 's'}`)}${fresh ? T.L(` · 새 글 ${fresh}`, ` · ${fresh} new`) : ''}</small></span></button>${showButton(c, off, T)}</li>`;
  }).join('');
  return `<div class="sx sx-wide"><header class="sx-head"><h1 class="sx-title page-title" tabindex="-1">${T.L('채널', 'News')}</h1><p class="sx-lead">${T.L('한국 유학 소식을 주제별로 모았어요. 모든 글에 공식 출처와 확인한 날이 붙어 있어요.', 'Study-in-Korea news by topic. Every post shows its official source and the date we checked it.')}</p></header>
${hero}
<h2 class="sx-h">${T.L('채널', 'Channels')}</h2><ul class="sx-chlist">${rows}</ul>
<p class="sx-fine">${T.L('글을 모으는 중:', 'Collecting posts:')} ${COLLECTING.map((x) => esc(T.pick(x))).join(', ')}</p></div>`;
}

function showButton(c, off, T) {
  const on = !off.includes(c.id);
  return `<button type="button" class="sx-btn2 sm sx-show" aria-pressed="${on}" data-action="channelShow" data-id="${esc(c.id)}"><span class="sx-on">${ON}</span>${T.L('오늘 화면에 보이기', 'Show on Today')}<span class="sr-only"> ${esc(T.pick(c.name))}</span></button>`;
}

export function renderPost(view) {
  const T = ctx(view), profile = T.profile || {}, p = postById(T.posts, view.postId);
  const back = (c) => `<button type="button" class="sx-back" data-action="channelOpen" data-id="${c ? esc(c.id) : ''}">${BACK}${c ? esc(T.pick(c.name)) : T.L('채널', 'News')}</button>`;
  if (!p) return `<div class="sx">${back(null)}<h1 class="sx-title page-title" tabindex="-1">${T.L('글을 찾지 못했어요.', 'Post not found.')}</h1></div>`;
  const c = channelOf(p.channel), saved = profile.dates || [];
  const stale = isStalePost(p, T.now) ? `<p class="sx-note is-box">${T.L('확인한 지 90일이 지났어요. 날짜는 공식 안내에서 다시 확인하세요.', 'This was checked more than 90 days ago. Check the dates in the official notice.')}</p>` : '';
  const live = p.dates.some((d) => { const st = dateStatus(d, T.now).state; return st !== 'past' && st !== 'cancelled'; });
  const dates = p.dates.length ? `<h2 class="sx-h" id="sx-dates-h" tabindex="-1">${T.L('날짜', 'Dates')}</h2>${T.note ? `<p class="sx-store is-warn sx-date-note">${esc(T.note)}</p>` : ''}${live ? storeLine(T) : ''}<ul class="sx-days">${p.dates.map((d) => dateRow(p, d, T, saved)).join('')}</ul>` : '';
  const action = p.action ? `<a class="sx-cta" href="${esc(p.action.url)}" target="_blank" rel="noopener noreferrer">${esc(T.pick(p.action.label))}${newTab(T)} ${GO}</a><p class="sx-fine">${T.L('공식 쪽으로 연결해요. 접수와 신청은 본인이 직접 해요.', 'This opens the official site. You apply yourself.')}</p>` : '';
  const tag = postTag(p, T);
  return `<div class="sx">${back(c)}
<div class="sx-photo is-hero sx-post-hero">${cover(c, T)}${tag ? `<span class="sx-photo-body"><span class="sx-tag white">${esc(tag)}</span></span>` : ''}</div>
<p class="sx-kicker">${esc(T.pick(c.name))} · ${T.L('올린 날', 'Posted')} ${esc(p.postedAt)}${p.status === 'announced' ? ` <span class="sx-tag is-check">${T.L('계획 발표 · 시행일 미정', 'Announced plan · no start date')}</span>` : ''}</p>
<h1 class="sx-title page-title" tabindex="-1">${esc(T.pick(p.title))}</h1>${stale}
<ol class="sx-points">${p.points.map((x) => `<li>${esc(T.pick(x))}</li>`).join('')}</ol>
${p.note ? `<p class="sx-note is-box">${esc(T.pick(p.note))}</p>` : ''}
<p class="sx-src"><b>${T.L('출처', 'Source')}</b> <a href="${esc(p.source.url)}" target="_blank" rel="noopener noreferrer">${esc(T.pick(p.source.title))}${newTab(T)}</a> · ${T.L('확인', 'checked')} ${esc(p.checkedAt)}</p>
${forYouCard(p, T)}${dates}${action}</div>`;
}

/* ── 오늘 화면 ── */

/** 다가오는 날. 넣은 날이 하나도 없으면 빈 글(오늘 화면에 칸을 두지 않는다). */
export function renderUpcoming(view) {
  const T = ctx(view), saved = (T.profile && T.profile.dates) || [];
  if (!saved.length) return '';
  const { upcoming, past, missing } = upcomingDates(T.posts, saved, T.now);
  const row = (r) => {
    const left = leftText(r.status, T);
    const changed = r.changed ? `<span class="sx-changed">${T.L(`날짜가 바뀌었어요(전에 본 날 ${spanText({ kind: r.date.kind, start: r.changed.start, end: r.changed.end }, T)})`, `Date changed (you saw ${spanText({ kind: r.date.kind, start: r.changed.start, end: r.changed.end }, T)})`)} <button type="button" class="sx-link sm" data-action="dateConfirm" data-id="${esc(r.date.id)}">${T.L('확인했어요', 'Got it')}<span class="sr-only"> ${esc(T.pick(r.date.label))}</span></button></span>` : '';
    return `<li class="sx-dayrow${r.status.state === 'past' || r.status.state === 'cancelled' ? ' is-gone' : ''}"><button type="button" class="sx-dayrow-btn" data-action="postOpen" data-id="${esc(r.post.id)}" data-date="${esc(r.date.id)}">${dayBox(r.date, r.status, T)}<span class="sx-day-main"><b>${esc(T.pick(r.date.label))}</b><small>${esc(spanText(r.date, T))} · ${esc(T.pick(r.post.title))}</small></span><span class="sx-dleft${near(r.status) ? ' is-near' : ''}"><span aria-hidden="true">${esc(left.shown)}</span><span class="sr-only">${esc(left.said)}</span></span></button>${changed}</li>`;
  };
  const gone = missing ? `<p class="sx-note">${T.L(`글에서 빠지거나 바뀐 날이 ${missing}개 있어요.`, `${missing} saved date${missing === 1 ? ' was' : 's were'} removed or changed in the posts.`)} <button type="button" class="sx-link sm" data-action="datesClean">${T.L('목록에서 지우기', 'Remove from list')}</button></p>` : '';
  const pastList = past.length ? `<details class="sx-past"><summary>${T.L(`지난 날 ${past.length}개`, `${past.length} past date${past.length === 1 ? '' : 's'}`)}</summary><ul class="sx-days">${past.map(row).join('')}</ul></details>` : '';
  return `<section class="sx sx-today" aria-labelledby="sx-up-h"><h2 class="sx-h" id="sx-up-h" tabindex="-1">${T.L('다가오는 날', 'Coming up')}</h2>${storeLine(T)}
${upcoming.length ? `<ul class="sx-days">${upcoming.map(row).join('')}</ul>` : `<p class="sx-note">${T.L('다가오는 날이 없어요.', 'Nothing coming up.')}</p>`}${gone}${pastList}</section>`;
}

/** 새 소식 두 편(오늘 화면, 카드와 상관없이). 보이기로 둔 채널의 글이 없으면 빈 글. */
export function renderNews(view) {
  const T = ctx(view), off = (T.profile && T.profile.channelsOff) || [];
  const list = latestPosts(T.posts, off, 2);
  if (!list.length) return '';
  return `<section class="sx sx-today" aria-labelledby="sx-news-h"><div class="sx-h-row"><h2 class="sx-h" id="sx-news-h">${T.L('새 소식', 'Latest news')}</h2><button type="button" class="sx-link" data-action="nav" data-page="channels">${T.L('채널 모두 보기', 'All news')}${NEXT}</button></div>
<div class="sx-news">${list.map((p) => { const c = channelOf(p.channel); return `<button type="button" class="sx-newsbtn" data-action="postOpen" data-id="${esc(p.id)}"><span class="sx-ic is-${esc(c.tone)}">${ICON[c.id]}</span><small>${esc(T.pick(c.name))}</small><b>${esc(T.pick(p.title))}</b></button>`; }).join('')}</div></section>`;
}

/* ── 달력 파일(.ics) ── */

const icsEscape = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** RFC 5545의 줄 접기: 한 줄 75바이트 안. 글자 가운데를 자르지 않는다. */
function fold(line) {
  const enc = new TextEncoder(), out = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length, limit = out.length ? 74 : 75;
    if (bytes + b > limit) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}
const nextDay = (d) => new Date(Date.parse(d + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);

/** 날 하나의 달력 파일 글. 접수 기간은 끝 날(마감)에, 하루짜리는 그날에 종일 일정으로 둔다. */
export function icsText(post, date, lang, stamp = new Date()) {
  const en = lang === 'en', pick = (o) => (en ? o.en : o.ko);
  const day = endDay(date), compact = (d) => d.replace(/-/g, '');
  const dt = (stamp instanceof Date ? stamp : new Date(stamp)).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  // 대학 소식의 날 이름에는 대학이 없어서(「1차 원서 접수」) 달력 목록에서 구분되게 과정 이름을 붙인다.
  const name = date.who ? (en ? `${pick(date.label)} (${pick(date.who)})` : `${pick(date.who)} ${pick(date.label)}`) : pick(date.label);
  const what = date.kind === 'apply' ? (en ? `Deadline: ${name}` : `${name} 마감`) : name;
  const desc = `${pick(post.title)}\n${en ? 'Source' : '출처'}: ${post.source.url}\n${en ? 'Check the official notice before you act.' : '움직이기 전에 공식 안내를 다시 확인하세요.'}`;
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SYNK//PATH study//' + (en ? 'EN' : 'KO'), 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${date.id}@path.synk.im`, `DTSTAMP:${dt}`, `DTSTART;VALUE=DATE:${compact(day)}`, `DTEND;VALUE=DATE:${compact(nextDay(day))}`,
    `SUMMARY:${icsEscape(what)}`, `DESCRIPTION:${icsEscape(desc)}`, `URL:${post.source.url}`, 'END:VEVENT', 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}
