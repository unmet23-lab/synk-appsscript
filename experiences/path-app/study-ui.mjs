// PATH 「내 조건 · 대학」 화면. 상태를 받아 HTML 글을 내는 순수 함수만 둔다(창, DOM, 저장소를 쓰지 않는다).
// 결: 시안 2판(2026-11-21) — 그림 한 장으로 여는 판, 큰 숫자 하나, 알약 단추. 색은 .sx 아래에서만 쓴다.
// 공개 CSP가 style-src 'self'라 인라인 스타일을 쓰지 않는다.
import { RULES, PROGRAMS, announcedRules, applyWindow, programById, proofRule, rulesAt } from './study-data.mjs';
import { matchProgram, programCost, countFit, countNeeds, readyToCount, routes } from './match.mjs';
import { isEmptyProfile, MAX_COMPARE } from './study-profile.mjs';

export const STUDY_FILTERS = Object.freeze(['all', 'fit', 'language', 'undergraduate']);
export const GRADE_MAX = 100;
export const FUNDS_MAX_MAN = 20000;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (p) => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
const GO = svg('<path d="M4 10h11.5M11 5.5 15.5 10 11 14.5"/>');
const BACK = svg('<path d="M12.5 4.5 7 10l5.5 5.5"/>');
const NEXT = svg('<path d="M7.5 4.5 13 10l-5.5 5.5"/>');

const STATUS = { ok: ['맞음', 'Met'], lack: ['부족', 'Short'], check: ['확인 필요', 'To check'] };
const KEY_NAME = { education: ['학력', 'Education'], grade: ['성적', 'Grades'], topik: ['한국어', 'Korean'], finance: ['재정', 'Funds'] };
const EDU = { graduated: ['고등학교 졸업', 'Finished high school'], expected: ['졸업 예정', 'Graduating soon'], none: ['아직 아님', 'Not yet'] };
const LEVEL = { language: ['어학 과정', 'Language program'], undergraduate: ['학부', 'Undergraduate'] };

/** 화면 함수가 함께 받는 것을 한 번에 푼다. programs와 rules를 안 주면 모듈의 자료를 쓴다. */
function ctx(view) {
  const now = view.now || new Date();
  const en = view.lang === 'en';
  const L = (ko, e) => (en ? e : ko);
  const pick = (o) => (o ? (en ? o.en : o.ko) : '');
  const pair = (a) => (en ? a[1] : a[0]);
  // 한국어 금액은 만 단위로 끊어 읽는다: 733만 원, 637만 9,000원, 82만 500원.
  const won = (n) => (en ? `₩${n.toLocaleString('en-US')}` : n < 10000 ? `${n.toLocaleString('ko-KR')}원` : n % 10000 === 0 ? `${(n / 10000).toLocaleString('ko-KR')}만 원` : `${Math.floor(n / 10000).toLocaleString('ko-KR')}만 ${(n % 10000).toLocaleString('ko-KR')}원`);
  const topik = (n) => (n === null || n === undefined ? L('아직 안 넣음', 'Not entered') : n === 0 ? L('성적 없음', 'No score yet') : L(`TOPIK ${n}급`, `TOPIK level ${n}`));
  const programs = view.programs || PROGRAMS;
  const rules = view.rules || rulesAt(RULES, now);
  const profile = view.profile;
  // 과정이 모두 예시인 동안에는 「대학 N곳」이라고 세지 않는다(실제 대학 수로 읽히지 않게).
  const allExample = programs.length > 0 && programs.every((p) => p.example);
  // 협약한 대학이 있을 때만 「협력 대학」이라고 쓴다. 공개 요강을 옮겼을 뿐이면 그렇게 적는다.
  const anyPartner = programs.some((p) => p.partner === true);
  const fitText = (n) => (allExample
    ? L(`개의 예시 과정이 지금 조건에 맞아요 (예시 ${programs.length}개 중)`, `of ${programs.length} example programs fit your conditions`)
    : L('개 과정이 지금 조건에 맞아요', n === 1 ? 'program fits your conditions' : 'programs fit your conditions'));
  // 세기 전에 넣어야 하는 칸의 이름(조사까지). 지금 자료에 성적 기준이 없으면 한국어만 말한다.
  const needs = countNeeds(programs);
  const needWord = needs.length === 2 ? L('성적과 한국어를', 'your grades and Korean level') : needs[0] === 'gradePct' ? L('성적을', 'your grades') : L('한국어 급수를', 'your Korean level');
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const md = (d) => { const [, m, day] = d.split('-').map(Number); return L(`${m}월 ${day}일`, `${MON[m - 1]} ${day}`); };
  return { now, en, L, pick, pair, won, topik, programs, rules, profile, allExample, anyPartner, fitText, needs, needWord, md };
}

const tag = (status, T) => `<span class="sx-tag is-${status}">${T.pair(STATUS[status])}</span>`;
const meter = (match, T) => `<span class="sx-meter" role="img" aria-label="${esc(match.items.map((i) => `${T.pair(KEY_NAME[i.key])} ${T.pair(STATUS[i.status])}`).join(', '))}">${match.items.map((i) => `<i class="is-${i.status}"></i>`).join('')}</span>`;
const exampleTag = (p, T) => (p.example ? `<span class="sx-tag wait">${T.L('예시', 'Example')}</span>` : '');
export const programImage = (p) => image(p);
const image = (p) => (p.image
  ? `<img class="sx-img" src="./assets/${esc(p.image)}.webp" alt="" width="960" height="640">`
  : `<span class="sx-cover is-${esc(p.tone || 'lapis')}" aria-hidden="true"><span>${esc(p.place.en.split(',')[0].toUpperCase())}</span></span>`);
const newTab = (T) => `<span class="sr-only"> (${T.L('새 탭에서 열림', 'opens in new tab')})</span>`;
const sourceLine = (rule, T) => `<p class="sx-src"><b>${T.L('출처', 'Source')}</b> <a href="${esc(rule.source.url)}" target="_blank" rel="noopener noreferrer">${esc(T.pick(rule.source.title))}${newTab(T)}</a> · ${T.L(`${rule.basis} 시행 · 확인 ${rule.checkedAt}`, `in force from ${rule.basis} · checked ${rule.checkedAt}`)}</p>`;
const promise = (T) => `<p class="sx-fine">${T.L('이 결과는 입학이나 비자를 약속하지 않아요. 마지막 판단은 대학과 출입국이 해요.', 'This comparison does not promise admission or a visa. The university and immigration office make the final decision.')}</p>`;
// 접수가 여러 차수면 「1차 마감 D-6」처럼 차수를 붙인다. 상세 배지는 다음 차수가 열리는 날까지 적는다.
const inRound = (w, T) => (ko, en) => (w.round ? T.L(`${w.round}차 ${ko}`, `Round ${w.round} ${en[0].toLowerCase()}${en.slice(1)}`) : T.L(ko, en));
const opens = (p, T) => {
  const w = applyWindow(p, T.now), R = inRound(w, T);
  if (w.state === 'before') return R(`시작 D-${w.days}`, `Opens in ${w.days}d`);
  if (w.state === 'open') return w.days === null ? R('접수 중', 'Open now') : w.days === 0 ? R('오늘 마감', 'Closes today') : R(`마감 D-${w.days}`, `Closes in ${w.days}d`);
  if (w.state === 'closed') return T.L('접수 끝남', 'Closed');
  return T.L('일정 확인 필요', 'Check dates');
};
const opensLong = (p, T) => {
  const w = applyWindow(p, T.now), R = inRound(w, T);
  // 영어는 차수까지 붙이면 휴대폰 배지보다 길어져 차수가 있을 때 「Applications」를 뺀다.
  const E = (long, short) => (w.round ? short : long);
  const next = w.state === 'open' && w.nextOpens ? T.L(` · ${w.round + 1}차 ${T.md(w.nextOpens)}부터`, ` · round ${w.round + 1} from ${T.md(w.nextOpens)}`) : '';
  if (w.state === 'before') return R(`접수 시작 D-${w.days}`, E(`Applications open in ${w.days}d`, `Opens in ${w.days}d`));
  if (w.state === 'open') return (w.days === null ? R('지금 접수 중', E('Applications open now', 'Open now')) : w.days === 0 ? R('오늘 접수 마감', E('Applications close today', 'Closes today')) : R(`접수 마감 D-${w.days}`, E(`Applications close in ${w.days}d`, `Closes in ${w.days}d`))) + next;
  if (w.state === 'closed') return T.L('이번 접수 끝남', 'Applications closed');
  return T.L('접수 일정 확인 필요', 'Check application dates');
};
const costLabel = (c, T) => (c.missing.length ? T.L('확인된 비용의 합', 'Confirmed costs') : T.L('내가 낼 돈', 'What you pay'));
const needKorean = (p, T) => (p.requires.topik ? T.L(`${p.requires.topik}급`, `Level ${p.requires.topik}`) : T.L('없어도 됨', 'None'));

function needText(item, T) {
  if (item.key === 'education') return T.L('고등학교 졸업', 'High school graduation');
  if (item.key === 'grade') return item.need === 0 ? T.L('조건 없음', 'No requirement') : T.L(`평균 ${item.need}% 이상`, `Average ${item.need}% or higher`);
  if (item.key === 'topik') return item.need === 0 ? T.L('없어도 됨', 'Not required') : T.L(`TOPIK ${item.need}급 이상`, `TOPIK level ${item.need} or higher`);
  return item.need === null ? T.L('기준 확인 필요', 'Requirement to be checked') : T.L(`은행 잔고 ${T.won(item.need)}`, `Bank balance of ${T.won(item.need)}`);
}
function mineText(item, T) {
  const none = T.L('아직 안 넣음', 'Not entered');
  if (item.key === 'education') return item.mine ? T.pair(EDU[item.mine]) : none;
  if (item.key === 'grade') return item.mine === null ? none : `${item.mine}%`;
  if (item.key === 'topik') return T.topik(item.mine);
  return item.mine === null ? none : T.won(item.mine);
}

/**
 * 센 과정 가운데 학력이나 재정을 맞춰 보지 못한 것이 있으면 그 조건을 이름으로 적는다.
 * 안 넣은 학력 · 돈은 빼지 않고 세므로, 돈이 모자란데 조건이 맞는다고 읽지 않게 한다.
 */
function uncheckedNote(T) {
  const fit = T.programs.map((p) => matchProgram(T.profile, p, T.rules)).filter((m) => m.fits);
  const keys = ['education', 'finance'].filter((k) => fit.some((m) => m.items.find((i) => i.key === k).status === 'check'));
  if (!keys.length) return '';
  const blank = keys.every((k) => (k === 'education' ? T.profile.education : T.profile.fundsWon) == null);
  const ko = keys.length === 2 ? '학력과 준비한 돈은' : keys[0] === 'education' ? '학력은' : '준비한 돈은';
  const many = keys.length === 2 || keys[0] === 'finance';
  const en = keys.length === 2 ? 'Your education and funds' : keys[0] === 'education' ? 'Your education' : 'Your funds';
  return blank ? T.L(`${ko} 아직 넣지 않아서 빼지 않고 셌어요.`, `${en} ${many ? 'are' : 'is'} not entered yet, so no program was ruled out by ${many ? 'them' : 'it'}.`)
    : T.L(`${ko} 아직 맞춰 보지 못해 빼지 않고 셌어요.`, `${en} could not be checked yet, so no program was ruled out by ${many ? 'them' : 'it'}.`);
}

/** 대학 목록에서 거른 과정들. 「조건이 맞는 곳」은 머리 숫자와 같은 기준(fits)을 쓴다. */
export function filterPrograms(profile, filter, programs = PROGRAMS, rules = RULES) {
  if (filter === 'fit') return readyToCount(profile, programs) ? programs.filter((p) => matchProgram(profile, p, rules).fits) : [];
  return programs.filter((p) => filter === 'all' || p.level === filter);
}

/** 조건을 바꿀 때 화면 읽기 프로그램이 읽는 한 줄. 화면의 세기 안내와 같은 기준 · 같은 말을 쓴다. */
export function studyCountSay(view) {
  const T = ctx(view), n = countFit(T.profile, T.programs, T.rules);
  return n === null ? T.L(`${T.needWord} 넣으면 맞는 과정을 세어 줘요.`, `Enter ${T.needWord} to count the programs that fit.`)
    : T.L(`지금 조건에 맞는 과정 ${n}개`, `${n} program${n === 1 ? ' fits' : 's fit'} your conditions`);
}

/** 오늘 화면에 두는 입구 한 줄. */
export function renderStudyEntry(view) {
  const T = ctx(view), empty = isEmptyProfile(T.profile), n = countFit(T.profile, T.programs, T.rules);
  const title = T.allExample ? T.L('예시 과정으로 내 조건 맞춰 보기', 'Try your conditions on example programs')
    : n === null ? T.L('내 조건으로 갈 수 있는 대학을 알아봐요', 'See which schools fit your conditions')
      : T.L(`지금 조건에 맞는 과정 ${n}개`, `${n} program${n === 1 ? ' fits' : 's fit'} your conditions`);
  const sub = T.allExample ? T.L('협력 대학은 준비 중이에요. 한국어, 성적, 준비한 돈을 넣어 미리 맞춰 볼 수 있어요.', 'Partner universities are being prepared. Enter your Korean level, grades and funds to try it in advance.')
    : n === null ? T.L('한국어, 성적, 준비한 돈을 넣으면 맞는 과정과 모자란 것을 알려 줘요.', 'Enter your Korean level, grades and funds to see what fits and what is missing.')
      : uncheckedNote(T) || T.L('조건을 바꾸면 바로 다시 계산해요.', 'Change a condition and it recalculates right away.');
  return `<section class="sx sx-entry" aria-label="${T.L('대학', 'Schools')}"><button type="button" class="sx-entry-btn" data-action="nav" data-page="${empty ? 'cond' : 'univ'}"><span><b>${esc(title)}</b><small>${esc(sub)}</small></span><span class="sx-go" aria-hidden="true">${GO}</span></button></section>`;
}

function countCard(T) {
  const n = countFit(T.profile, T.programs, T.rules);
  if (n === null) {
    return `<section class="sx-card lapis"><h2>${T.L(`${T.needWord} 넣으면 맞는 과정을 세어 줘요.`, `Enter ${T.needWord} to count the programs that fit.`)}</h2><p>${T.L('학력과 준비한 돈도 넣으면 그 조건이 모자란 과정은 빼고 세요.', 'If you also enter your education and funds, programs where those fall short are left out.')}</p><button type="button" class="sx-cta" data-action="nav" data-page="cond">${T.L('내 조건 넣기', 'Enter my conditions')} ${GO}</button></section>`;
  }
  return `<section class="sx-card lapis"><p class="sx-k">${T.L('지금 조건으로', 'With your conditions now')}</p><p class="sx-big"><b>${n}</b><span>${esc(T.fitText(n))}</span></p><p>${T.L('넣은 조건 가운데 모자란 것이 없는 과정을 셌어요.', 'Counted programs where none of the conditions you entered fall short.')}${uncheckedNote(T) ? ` ${esc(uncheckedNote(T))}` : ''}</p><button type="button" class="sx-btn2" data-action="nav" data-page="cond">${T.L('내 조건 바꿔 보기', 'Change my conditions')}</button></section>`;
}

export function renderUniv(view) {
  const T = ctx(view), profile = T.profile, empty = isEmptyProfile(profile);
  const f = STUDY_FILTERS.includes(view.filter) ? view.filter : 'all';
  // 접수 중이거나 곧 시작하는 과정을 앞에, 접수가 끝난 과정을 뒤에 둔다(같은 상태끼리는 자료 순서).
  const rank = { open: 0, before: 1, unknown: 2, closed: 3 };
  const list = filterPrograms(profile, f, T.programs, T.rules).map((p, i) => [rank[applyWindow(p, T.now).state], i, p]).sort((x, y) => x[0] - y[0] || x[1] - y[1]).map((x) => x[2]);
  const chip = (id, label) => `<button type="button" class="sx-chip" aria-pressed="${f === id}" data-action="studyFilter" data-id="${id}">${esc(label)}</button>`;
  const openGuide = !T.allExample && !T.anyPartner && T.programs.length > 0;
  const kicker = openGuide ? `${T.L('대학 공개 모집 요강', 'Published admissions guides')} <span class="sx-tag wait">${T.L('협력 대학 준비 중', 'Partners coming soon')}</span>`
    : T.anyPartner ? T.L('협력 대학', 'Partner universities') : `${T.L('협력 대학', 'Partner universities')} <span class="sx-tag wait">${T.L('준비 중', 'Coming soon')}</span>`;
  const leadText = T.allExample ? T.L('협력 대학은 준비 중이에요. 지금 보이는 과정은 화면을 미리 보이려고 넣은 예시이고, 실제 대학이 아니에요.', 'Partner universities are being prepared. The programs below are examples to preview the screen, not real universities.')
    : openGuide ? T.L('대학이 공개한 모집 요강에서 옮긴 정보예요. SYNK와 협약한 대학은 아직 없어요. 지원하기 전에 대학 원문을 꼭 확인하세요.', 'This information is taken from each university’s published admissions guide. SYNK has no partner universities yet. Always check the university’s original guide before applying.') : '';
  const head = `<header class="sx-head"><p class="sx-kicker">${kicker}</p><h1 class="sx-title page-title" tabindex="-1">${T.L('내 조건으로 갈 수 있는 대학', 'Schools that fit your conditions')}</h1>${leadText ? `<p class="sx-lead">${leadText}</p>` : ''}</header>`;
  if (!T.programs.length) return `<div class="sx sx-wide">${head}<section class="sx-card"><h2>${T.L('협력 대학을 준비하고 있어요.', 'Partner universities are being prepared.')}</h2><p>${T.L('준비되면 여기에서 조건과 비용을 맞춰 볼 수 있어요.', 'Once ready, you can compare conditions and costs here.')}</p></section></div>`;
  const cards = list.map((p) => {
    const m = matchProgram(profile, p, T.rules), on = profile.compare.includes(p.id), full = profile.compare.length >= MAX_COMPARE && !on;
    return `<li class="sx-ucard"><div class="sx-ucard-top"><button type="button" class="sx-photo" data-action="univOpen" data-id="${esc(p.id)}">${image(p)}<span class="sx-photo-body"><small>${esc(T.pick(p.place))} · ${T.pair(LEVEL[p.level])}${p.term ? ` · ${esc(T.pick(p.term))}` : ''}</small><b>${esc(T.pick(p.name))}</b></span></button><button type="button" class="sx-pick" aria-pressed="${on}" data-action="studyCompare" data-id="${esc(p.id)}"${full ? ' disabled' : ''}>${on ? T.L('비교에 담음', 'In compare') : T.L('비교', 'Compare')}<span class="sr-only"> ${esc(T.pick(p.name))}</span></button></div>
<dl class="sx-facts"><div><dt>${p.level === 'language' ? T.L('한 해 수업료', 'Tuition per year') : T.L('한 해 등록금', 'Tuition per year')}</dt><dd>${T.won(p.costs.tuition)}</dd></div><div><dt>${T.L('필요한 한국어', 'Korean needed')}</dt><dd>${needKorean(p, T)}</dd></div><div><dt>${T.L('원서 접수', 'Applications')}</dt><dd>${esc(opens(p, T))}</dd></div></dl>
<p class="sx-fitline"><span>${exampleTag(p, T)} ${empty ? T.L('내 조건을 넣으면 맞춰 봐요', 'Enter your conditions to compare') : T.L(`내 조건 4개 중 ${m.okCount}개 맞음`, `${m.okCount} of 4 conditions met`)}</span>${empty ? '' : meter(m, T)}</p></li>`;
  }).join('');
  const none = list.length ? '' : `<section class="sx-card"><h2>${f === 'fit' && !readyToCount(profile, T.programs) ? T.L(`${T.needWord} 넣으면 맞는 과정만 골라 볼 수 있어요.`, `Enter ${T.needWord} to filter by fit.`) : f === 'fit' ? T.L('지금 조건에 맞는 과정이 아직 없어요.', 'Nothing fits your conditions yet.') : T.L('이 갈래의 과정은 아직 없어요.', 'No programs in this category yet.')}</h2><p>${T.L('전체 목록에서 과정을 열면 무엇이 모자란지 볼 수 있어요.', 'Open a program in the full list to see what is missing.')}</p><div class="sx-row2"><button type="button" class="sx-btn2" data-action="nav" data-page="cond">${T.L('내 조건 보기', 'My conditions')}</button><button type="button" class="sx-btn2" data-action="studyFilter" data-id="all">${T.L('전체 보기', 'Show all')}</button></div></section>`;
  const bar = profile.compare.length >= 2 ? `<div class="sx-cmpbar"><button type="button" class="sx-cta butter" data-action="nav" data-page="univCompare">${T.L(`${profile.compare.length}곳 나란히 보기`, `Compare ${profile.compare.length} side by side`)} ${GO}</button></div>` : profile.compare.length === 1 ? `<p class="sx-fine">${T.L('한 곳을 더 담으면 나란히 볼 수 있어요.', 'Add one more to compare side by side.')}</p>` : '';
  return `<div class="sx sx-wide">${head}
${countCard(T)}
<div class="sx-chips" role="group" aria-label="${T.L('거르기', 'Filter')}">${chip('all', T.L(`전체 ${T.programs.length}`, `All ${T.programs.length}`))}${chip('fit', T.L('조건이 맞는 과정', 'Fits me'))}${chip('language', T.pair(LEVEL.language))}${chip('undergraduate', T.pair(LEVEL.undergraduate))}</div>
${list.length ? `<ul class="sx-ulist">${cards}</ul>` : none}${bar}${promise(T)}</div>`;
}

function financeMore(i, T, visa) {
  const waiver = announcedRules(T.rules, 'finance-waiver')[0];
  const enter = i.mine === null ? `<button type="button" class="sx-link" data-action="nav" data-page="cond">${T.L('준비한 돈 넣기', 'Enter my funds')}${NEXT}</button>` : '';
  let note = '';
  if (i.rule && !i.firm) {
    note = `<p class="sx-note">${i.rule.stale ? T.L('이 금액을 확인한 지 오래돼 다시 확인하고 있어요. 그래서 맞는지 판정하지 않았어요.', 'This amount was checked a while ago and is being re-checked, so it is not judged here.') : T.L(`이 금액은 ${i.rule.basis}에 시행된 기준이에요. 지금 쓰는 안내에서도 같은지 확인하고 있어서 맞는지 판정하지 않았어요.`, `This amount took effect on ${i.rule.basis}. We are confirming it against the current guide, so it is not judged here.`)}${i.mine !== null && i.gap > 0 ? ` ${T.L(`이 기준으로는 ${T.won(i.gap)}이 더 필요해요.`, `By this figure, ${T.won(i.gap)} more would be needed.`)}` : ''}</p>`;
  } else if (i.status === 'lack') note = `<p class="sx-note">${T.L(`${T.won(i.gap)}이 더 필요해요.`, `${T.won(i.gap)} more is needed.`)}</p>`;
  const plan = waiver ? `<p class="sx-note plan"><b>${T.L('계획 발표', 'Announced plan')}</b> ${T.L(`TOPIK ${waiver.topik}급이 있으면 이 증명을 면제하는 계획이 ${waiver.basis}에 발표됐어요. 시작하는 날은 아직 정해지지 않았어요.`, `A plan to waive this proof for TOPIK level ${waiver.topik} was announced on ${waiver.basis}. No start date has been set.`)} <a href="${esc(waiver.source.url)}" target="_blank" rel="noopener noreferrer">${esc(T.pick(waiver.source.title))}${newTab(T)}</a></p>` : '';
  const proof = proofRule(T.rules, visa);
  const how = proof ? `<p class="sx-note">${T.L(`몽골에서 신청할 때는 본인이나 부모의 몽골 은행 잔고 증명서를 비자 신청일 기준 ${proof.issuedWithinDays}일 안에 발급받아 내고, 이 금액을 ${proof.heldDays}일 이상 유지해야 해요.`, `When applying in Mongolia, submit a balance certificate from your own or a parent’s Mongolian bank account issued within ${proof.issuedWithinDays} days of the visa application, and keep this amount for at least ${proof.heldDays} days.`)} <a href="${esc(proof.source.url)}" target="_blank" rel="noopener noreferrer">${esc(T.pick(proof.source.title))}${newTab(T)}</a></p>` : '';
  return enter + note + (i.rule ? sourceLine(i.rule, T) : '') + how + plan;
}

export function renderUnivDetail(view) {
  const T = ctx(view), profile = T.profile, p = programById(T.programs, view.programId);
  const back = `<button type="button" class="sx-back" data-action="nav" data-page="univ">${BACK}${T.L('대학', 'Schools')}</button>`;
  if (!p) return `<div class="sx">${back}<h1 class="sx-title page-title" tabindex="-1">${T.L('과정을 찾지 못했어요.', 'Program not found.')}</h1></div>`;
  const m = matchProgram(profile, p, T.rules), c = programCost(profile, p), on = profile.compare.includes(p.id), full = profile.compare.length >= MAX_COMPARE && !on;
  const items = m.items.map((i) => {
    let more = '';
    if (i.key === 'finance') more = financeMore(i, T, p.visa);
    else if (i.status === 'check') more = `<button type="button" class="sx-link" data-action="nav" data-page="cond">${T.L('내 조건에 넣기', 'Enter it in my conditions')}${NEXT}</button>`;
    else if (i.key === 'topik' && i.status === 'lack') more = `<p class="sx-note">${T.L(`${i.gap}급을 더 올리면 맞아요.`, `${i.gap} more level${i.gap === 1 ? '' : 's'} to meet this.`)}</p>`;
    else if (i.key === 'grade' && i.status === 'lack') more = `<p class="sx-note">${T.L(`${i.gap}%가 모자라요.`, `${i.gap}% short.`)}</p>`;
    return `<li><div class="sx-match-top"><b>${T.pair(KEY_NAME[i.key])}</b>${tag(i.status, T)}</div><dl class="sx-match-grid"><div><dt>${T.L('필요한 것', 'Needed')}</dt><dd>${esc(needText(i, T))}</dd></div><div><dt>${T.L('내 것', 'Mine')}</dt><dd>${esc(mineText(i, T))}</dd></div></dl>${more}</li>`;
  }).join('');
  const pct = Math.round(c.rate * 100);
  const schNote = c.scholarship ? (c.stepTopik === 0 ? T.L(`신입생 모두에게 주는 장학금 ${T.won(c.scholarship)}을 뺀 값이에요.`, `After the ${T.won(c.scholarship)} scholarship every freshman receives.`)
      : c.rate === null ? T.L(`한국어 ${c.stepTopik}급 장학금 ${T.won(c.scholarship)}을 뺀 값이에요.`, `After the ${T.won(c.scholarship)} scholarship for TOPIK level ${c.stepTopik}.`) : T.L(`한국어 ${c.stepTopik}급 장학금 ${pct}%를 뺀 값이에요.`, `After the ${pct}% scholarship for TOPIK level ${c.stepTopik}.`))
    : !p.scholarship.length ? T.L('이 과정은 한국어 급수 장학금이 없어요.', 'This program has no Korean-level scholarship.')
      : profile.topik === null ? T.L('한국어 급수를 넣으면 장학금을 빼서 보여 줘요.', 'Enter your Korean level to subtract the scholarship.')
        : p.scholarshipNote ? T.L('지금 급수로 정해진 장학금은 없어요. 아래 장학금 안내를 확인하세요.', 'No fixed scholarship at your current level. See the scholarship note below.') : T.L('지금 급수로는 장학금이 없어요.', 'No scholarship at your current level.');
  const next = c.nextLevel ? `<section class="sx-card meadow"><p class="sx-k">${T.L('급수를 올리면', 'If you raise your level')}</p><h2>${T.L(`${c.nextLevel.topik}급이면 ${c.missing.length ? '확인된 비용의 합이' : '내가 낼 돈이'} ${T.won(c.nextLevel.total)}으로 줄어요.`, `At level ${c.nextLevel.topik}, ${c.missing.length ? 'the confirmed costs drop' : 'what you pay drops'} to ${T.won(c.nextLevel.total)}.`)}</h2></section>` : '';
  const unknownCost = (key) => (key === 'dorm' ? T.L('합계에 없음 · 아래 안내', 'Not in total · see note') : T.L('대학이 안내하지 않음', 'Not stated by the university'));
  const note = (o) => (o ? `<p class="sx-note">${esc(T.pick(o))}</p>` : '');
  const small = (o) => (o ? `<p class="sx-note is-small">${esc(T.pick(o))}</p>` : '');
  const missingNote = c.missing.length ? `<p class="sx-note">${T.L(`합계에는 ${c.missing.length === 2 ? '기숙사비와 생활비가' : c.missing[0] === 'dorm' ? '기숙사비가' : '생활비가'} 빠져 있어요.`, `The total does not include ${c.missing.map((k) => (k === 'dorm' ? 'dormitory fees' : 'living costs')).join(' or ')}.`)}</p>` : '';
  const realSource = !p.example && p.source ? `<p class="sx-src"><b>${T.L('출처', 'Source')}</b> <a href="${esc(p.source.url)}" target="_blank" rel="noopener noreferrer">${esc(T.pick(p.source.title))}${newTab(T)}</a> · ${T.L('확인', 'checked')} ${esc(p.checkedAt)}</p>` : '';
  return `<div class="sx">${back}
<div class="sx-photo is-hero">${image(p)}<span class="sx-photo-top">${exampleTag(p, T)}<span class="sx-tag white">${esc(opensLong(p, T))}</span></span><span class="sx-photo-body"><small>${esc(T.pick(p.place))} · ${T.pair(LEVEL[p.level])} · ${esc(T.pick(p.majors))}${p.term ? ` · ${esc(T.pick(p.term))}` : ''}</small></span></div>
<h1 class="sx-title page-title" tabindex="-1">${esc(T.pick(p.name))}</h1>
${p.example ? `<p class="sx-lead">${T.L('화면을 미리 보이려고 넣은 예시 과정이에요. 금액, 일정, 입학 조건은 실제 대학의 것이 아니에요.', 'An example program to preview the screen. The amounts, dates and admission conditions are not from a real university.')}</p>` : `${p.partner ? '' : `<p class="sx-lead">${T.L('대학이 공개한 모집 요강에서 옮긴 정보예요. SYNK와 협약한 대학은 아니에요. 지원하기 전에 원문을 꼭 확인하세요.', 'Taken from the university’s published admissions guide. This is not a SYNK partner university. Check the original before applying.')}</p>`}${realSource}`}
${p.applyNote ? `<p class="sx-note is-box"><b>${T.L('원서 접수', 'Applications')}</b> ${esc(T.pick(p.applyNote))}</p>` : ''}${view.pathPick || ''}
<h2 class="sx-h">${T.L('내 조건과 맞춰 보기', 'Compare with my conditions')} ${meter(m, T)}</h2><ul class="sx-match">${items}</ul>${note(p.requiresNote)}
<h2 class="sx-h">${T.L('한 해에 드는 돈', 'Cost for one year')} ${exampleTag(p, T)}</h2>
<div class="sx-hero-num"><small>${costLabel(c, T)}</small><b>${T.won(c.total)}</b><small>${esc(schNote)}</small></div>
<ul class="sx-money"><li><span>${p.level === 'language' ? T.L('수업료', 'Tuition') : T.L('등록금', 'Tuition')}</span><span>${T.won(c.tuition)}</span></li><li${c.dorm === null ? ' class="is-unknown"' : ''}><span>${T.L('기숙사', 'Dormitory')}${p.dormLabel && c.dorm !== null ? `<small>${esc(T.pick(p.dormLabel))}</small>` : ''}</span><span>${c.dorm === null ? unknownCost('dorm') : T.won(c.dorm)}</span></li><li${c.living === null ? ' class="is-unknown"' : ''}><span>${T.L('생활비', 'Living costs')}</span><span>${c.living === null ? unknownCost('living') : T.won(c.living)}</span></li>${c.scholarship ? `<li class="minus"><span>${T.L('장학금', 'Scholarship')}</span><span>− ${T.won(c.scholarship)}</span></li>` : ''}</ul>${missingNote}${small(p.costsNote)}${small(p.scholarshipNote)}${next}
<div class="sx-row2"><button type="button" class="sx-btn2" data-action="nav" data-page="cond">${T.L('내 조건 바꿔 보기', 'Change my conditions')}</button><button type="button" class="sx-btn2" aria-pressed="${on}" data-action="studyCompare" data-id="${esc(p.id)}"${full ? ' disabled' : ''}>${on ? T.L('비교에 담음', 'In compare') : T.L('비교에 담기', 'Add to compare')}</button></div>
${profile.compare.length >= 2 ? `<button type="button" class="sx-cta butter" data-action="nav" data-page="univCompare">${T.L(`${profile.compare.length}곳 나란히 보기`, `Compare ${profile.compare.length} side by side`)} ${GO}</button>` : ''}${promise(T)}</div>`;
}

export function renderUnivCompare(view) {
  const T = ctx(view), profile = T.profile, list = profile.compare.map((id) => programById(T.programs, id)).filter(Boolean);
  const back = `<button type="button" class="sx-back" data-action="nav" data-page="univ">${BACK}${T.L('대학', 'Schools')}</button>`;
  const title = `<h1 class="sx-title page-title" tabindex="-1">${T.L('나란히 보기', 'Side by side')}</h1>`;
  if (list.length < 2) return `<div class="sx">${back}${title}<section class="sx-card"><h2>${T.L('두 곳 이상 담으면 나란히 볼 수 있어요.', 'Add at least two programs to compare.')}</h2><button type="button" class="sx-cta" data-action="nav" data-page="univ">${T.L('대학 보기', 'Browse schools')} ${GO}</button></section></div>`;
  const row = (h, fn) => `<tr><th scope="row">${h}</th>${list.map((p) => `<td>${fn(p)}</td>`).join('')}</tr>`;
  const anyMissing = list.some((p) => programCost(profile, p).missing.length);
  const costsWord = anyMissing ? T.L('확인된 비용의 합', 'Confirmed costs') : T.L('내가 낼 돈', 'What you pay');
  return `<div class="sx sx-wide">${back}${title}
<div class="sx-cmp-wrap" role="region" tabindex="0" aria-label="${T.L('나란히 보기 표', 'Comparison table')}"><table class="sx-cmp" data-cols="${list.length}"><thead><tr><td></td>${list.map((p) => `<th scope="col"><button type="button" class="sx-cmp-head" data-action="univOpen" data-id="${esc(p.id)}">${image(p)}<span>${esc(T.pick(p.name))}</span></button></th>`).join('')}</tr></thead><tbody>
${row(T.L('지역', 'Region'), (p) => esc(T.pick(p.place)))}${row(T.L('과정', 'Program'), (p) => T.pair(LEVEL[p.level]))}${row(T.L('한 해 등록금 · 수업료', 'Tuition per year'), (p) => T.won(p.costs.tuition))}
${row(T.L('한 해 기숙사', 'Dormitory per year'), (p) => (p.costs.dorm === null ? `<span class="sx-cmp-miss">${T.L('합계에 없음', 'Not in total')}</span>` : `${T.won(p.costs.dorm)}${p.dormLabel ? `<small>${esc(T.pick(p.dormLabel))}</small>` : ''}`))}
${row(T.L('지금 급수 장학금', 'Scholarship at your level'), (p) => { const c = programCost(profile, p); return c.scholarship ? `− ${T.won(c.scholarship)}` : T.L('없음', 'None'); })}
${row(costsWord, (p) => { const c = programCost(profile, p); return `<b>${T.won(c.total)}</b>${c.missing.length ? `<small>${esc(T.L(`${c.missing.length === 2 ? '기숙사 · 생활비' : c.missing[0] === 'dorm' ? '기숙사비' : '생활비'} 빠짐`, `excludes ${c.missing.map((k) => (k === 'dorm' ? 'dormitory' : 'living costs')).join(' and ')}`))}</small>` : ''}`; })}${row(T.L('필요한 한국어', 'Korean needed'), (p) => needKorean(p, T))}
${row(T.L('필요한 성적', 'Grades needed'), (p) => (p.requires.gradePct ? `${p.requires.gradePct}%` : T.L('조건 없음', 'None')))}${row(T.L('잔고 증명', 'Proof of funds'), (p) => { const i = matchProgram(profile, p, T.rules).items[3]; return i.need === null ? T.L('확인 필요', 'To check') : T.won(i.need); })}
${row(T.L('원서 접수', 'Applications'), (p) => esc(opens(p, T)))}${row(T.L('내 조건', 'My conditions'), (p) => { const m = matchProgram(profile, p, T.rules); return `${m.okCount} / 4${meter(m, T)}`; })}
${row(`<span class="sr-only">${T.L('비교에서 빼기', 'Remove from compare')}</span>`, (p) => `<button type="button" class="sx-link" data-action="studyCompare" data-id="${esc(p.id)}">${T.L('빼기', 'Remove')}<span class="sr-only"> ${esc(T.pick(p.name))}</span></button>`)}</tbody></table></div>
<p class="sx-fine">${anyMissing ? T.L('「확인된 비용의 합」은 한 해 금액을 알 수 있는 비용만 더하고 지금 급수의 장학금을 뺀 값이에요. 빠진 비용이 과정마다 달라서, 합계만 보지 말고 칸마다 견주어 보세요.', '“Confirmed costs” adds only the yearly costs that are known and subtracts the scholarship at your current level. Missing costs differ by program, so compare row by row rather than by the total alone.') : T.L('「내가 낼 돈」은 지금 내 한국어 급수의 장학금을 뺀 값이에요.', '“What you pay” subtracts the scholarship for your current Korean level.')}${list.some((p) => p.example) ? ` ${T.L('예시 과정의 금액은 실제 대학의 것이 아니에요.', 'Amounts for example programs are not from a real university.')}` : ''}</p>${promise(T)}</div>`;
}

/** 숫자 칸 아래 글. 입력 중에는 칸을 다시 그리지 않고 이 글만 바꾼다. */
export function condHint(lang, key, error) {
  const en = lang === 'en', max = key === 'gradePct' ? GRADE_MAX : FUNDS_MAX_MAN;
  if (error) return en ? `Enter a whole number from 0 to ${max.toLocaleString('en-US')}.` : `0부터 ${max.toLocaleString('ko-KR')}까지 소수점 없는 숫자로 적어 주세요.`;
  if (key === 'gradePct') return en ? 'Your average on a 100-point scale, rounded. Example: 82' : '100점 만점으로 바꾼 평균을 반올림해 적어요. 예: 82';
  return en ? 'Money you can show as a bank balance, in units of ₩10,000. Example: 1600' : '잔고 증명에 쓸 수 있는 돈을 만 원 단위로 적어요. 예: 1600';
}

/** 내 조건 화면의 결과 자리(#sx-cond-result 안). 조건이 바뀌면 이 자리만 갈아 끼운다. */
export function renderCondResult(view) {
  const T = ctx(view), profile = T.profile;
  const n = countFit(profile, T.programs, T.rules), r = routes(profile, T.programs, T.rules, T.now);
  let up = null;
  if (n !== null) for (let t = profile.topik + 1; t <= 6 && !up; t++) { const k = countFit(profile, T.programs, T.rules, t); if (k > n) up = { t, k }; }
  const lead = n === null ? '' : up ? (T.allExample ? T.L(`${up.t}급이면 예시 과정 ${up.k}개가 맞아요.`, `With level ${up.t}, ${up.k} example programs fit.`) : T.L(`${up.t}급을 따면 ${up.k}개 과정으로 늘어요.`, `With level ${up.t} it becomes ${up.k} programs.`))
    : n === 0 ? T.L('모자란 조건은 과정마다 달라요. 대학을 열어 무엇이 모자란지 확인하세요.', 'What is missing differs by program. Open a school to see it.') : T.L('과정을 열면 조건 넷을 하나씩 맞춰 볼 수 있어요.', 'Open a program to check all four conditions one by one.');
  const top = n === null
    ? `<section class="sx-card lapis"><h2>${T.L(`${T.needWord} 넣으면 맞는 과정을 세어 줘요.`, `Enter ${T.needWord} to count the programs that fit.`)}</h2>${T.needs.length === 2 ? `<p>${T.L('둘 중 하나라도 비어 있으면 세지 않아요.', 'Nothing is counted while either one is empty.')}</p>` : ''}<button type="button" class="sx-cta" data-action="nav" data-page="univ">${T.L('대학 보기', 'Browse schools')} ${GO}</button></section>`
    : `<section class="sx-card lapis"><p class="sx-k">${T.L('지금 조건으로', 'With your conditions now')}</p><p class="sx-big"><b>${n}</b><span>${esc(T.fitText(n))}</span></p>${uncheckedNote(T) ? `<p>${esc(uncheckedNote(T))}</p>` : ''}<p>${esc(lead)}</p><button type="button" class="sx-cta" data-action="nav" data-page="univ">${T.L('대학 보기', 'Browse schools')} ${GO}</button></section>`;
  const route = (title, x, visa, body) => {
    const st = x.status === 'none' ? '' : x.status === 'ok' ? `<span class="sx-tag is-ok">${T.L('조건 맞음', 'Fits')}</span>` : tag(x.status, T);
    return `<section class="sx-card line"><div class="sx-match-top"><h3>${esc(title)}</h3>${st}</div><p>${esc(body)}</p><p class="sx-src"><b>${T.L('비자', 'Visa')}</b> ${esc(visa)}</p></section>`;
  };
  // 「학부 과정이 N개」처럼 앞 말이 이미 과정이라 한국어는 수만 붙인다. 예시만 있으면 그렇다고 덧붙인다.
  const unit = (c) => (T.allExample ? T.L(`${c}개(예시)`, `${c} example program${c === 1 ? '' : 's'}`) : T.L(`${c}개`, `${c} program${c === 1 ? '' : 's'}`));
  const none = T.L('준비된 과정이 아직 없어요.', 'No programs are ready yet.');
  const openText = (x) => (x.open === x.count ? '' : x.open ? T.L(` 그 가운데 지금 접수 중이거나 곧 접수가 열리는 곳은 ${x.open}개예요.`, ` ${x.open} of them ${x.open === 1 ? 'is' : 'are'} open now or opening soon.`) : T.L(' 다만 지금은 모두 이번 접수가 끝났어요.', ' However, applications for all of them have closed for now.'));
  const lackText = (x, kind) => (x.academic > 0 ? T.L('성적과 한국어가 맞는 과정은 있지만 학력이나 준비한 돈이 모자라요. 과정을 열어 무엇이 모자란지 확인하세요.', 'Some programs fit your grades and Korean, but your education or funds fall short. Open a program to see what is missing.')
    : x.topikGap ? T.L(`가장 낮은 곳이 TOPIK ${x.lowestTopik}급을 요구해요. ${x.topikGap}급을 더 올리면 열려요.`, `The lowest requirement is TOPIK level ${x.lowestTopik}. ${x.topikGap} more level${x.topikGap === 1 ? '' : 's'} opens it.`)
      : kind === 'language' ? T.L('성적 조건이 맞는 어학 과정이 없어요.', 'No language program matches your grades.') : T.L('성적 조건이 맞는 학부 과정이 없어요.', 'No undergraduate program matches your grades.'));
  const checkText = T.L(`${T.needWord} 넣으면 맞는 과정을 알려 줘요.`, `Enter ${T.needWord} to see which programs fit.`);
  const directBody = r.direct.status === 'none' ? none
    : r.direct.status === 'ok' ? T.L(`조건이 맞는 학부 과정이 ${unit(r.direct.count)} 있어요.`, `${unit(r.direct.count)} for undergraduate study ${r.direct.count === 1 ? 'fits' : 'fit'} your conditions.`) + openText(r.direct)
      : r.direct.status === 'check' ? checkText : lackText(r.direct, 'undergraduate');
  const langBody = r.languageFirst.status === 'none' ? none
    : r.languageFirst.status === 'ok' ? T.L(`한국에서 한국어를 먼저 배운 뒤 학부에 들어가요. 조건이 맞는 어학 과정이 ${unit(r.languageFirst.count)} 있어요.`, `Learn Korean in Korea first, then enter an undergraduate program. ${unit(r.languageFirst.count)} for language study ${r.languageFirst.count === 1 ? 'fits' : 'fit'} your conditions.`) + openText(r.languageFirst)
      : r.languageFirst.status === 'check' ? T.L(`한국어 성적이 없어도 지원할 수 있는 과정이 많아요. ${checkText}`, `Many programs accept you without a Korean score. ${checkText}`) : lackText(r.languageFirst, 'language');
  return `${top}
<h2 class="sx-h">${T.L('갈 수 있는 길', 'Routes you can take')}</h2>
${route(T.L('어학 과정 먼저, 그다음 학부', 'Language program first, then undergraduate'), r.languageFirst, T.L('어학연수(D-4) → 유학(D-2)', 'Language training (D-4) → Study (D-2)'), langBody)}
${route(T.L('바로 학부 입학', 'Straight into undergraduate'), r.direct, T.L('유학(D-2)', 'Study (D-2)'), directBody)}
${isEmptyProfile(profile) ? '' : `<p class="sx-fine"><button type="button" class="sx-link" data-action="studyClear">${T.L('조건 모두 지우기', 'Clear all conditions')}</button></p>`}`;
}

export function renderCond(view) {
  const T = ctx(view), profile = T.profile, { persisted = true, text = {}, errors = {} } = view;
  const seg = (key, options, label) => `<div class="sx-seg${options.length > 4 ? ' is-many' : ''}" role="group" aria-label="${esc(label)}">${options.map(([v, l]) => `<button type="button" aria-pressed="${profile[key] === v}" data-action="studySet" data-key="${key}" data-id="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
  const field = (id, key, label, unit, value) => `<div class="sx-field"><label for="${id}">${esc(label)}</label><div class="sx-input"><input id="${id}" type="text" inputmode="numeric" autocomplete="off" maxlength="7" data-action="studyInput" data-key="${key}" value="${esc(value)}" aria-describedby="${id}-hint"${errors[key] ? ' aria-invalid="true"' : ''}><span aria-hidden="true">${esc(unit)}</span></div><p class="sx-hint${errors[key] ? ' is-error' : ''}" id="${id}-hint">${esc(condHint(view.lang, key, !!errors[key]))}</p></div>`;
  const gradeText = text.gradePct ?? (profile.gradePct === null ? '' : String(profile.gradePct));
  const fundsText = text.fundsWon ?? (profile.fundsWon === null ? '' : String(Math.round(profile.fundsWon / 10000)));
  return `<div class="sx"><button type="button" class="sx-back" data-action="nav" data-page="univ">${BACK}${T.L('대학', 'Schools')}</button>
<header class="sx-head"><h1 class="sx-title page-title" tabindex="-1">${T.L('내 조건', 'My conditions')}</h1><p class="sx-lead">${T.L('넣거나 바꾸면 갈 수 있는 길과 맞는 과정이 바로 따라 바뀌어요.', 'Enter or change a value and the routes and matches update right away.')}</p></header>
<p class="sx-store${persisted ? '' : ' is-warn'}" role="status">${persisted ? T.L('이 조건은 이 탭에만 저장돼요. 계정에는 저장되지 않고, 탭을 닫거나 로그아웃하면 사라져요.', 'These conditions are kept in this tab only. They are not saved to your account and disappear when you close the tab or sign out.') : T.L('이 브라우저에서는 저장할 수 없어서 지금 화면에서만 기억해요. 새로 고치면 사라져요.', 'This browser cannot store them, so they are remembered on this screen only and are lost on reload.')}</p>
<div class="sx-field"><span class="sx-label">${T.L('한국어', 'Korean')} <b>${esc(T.topik(profile.topik))}</b></span>${seg('topik', [[0, T.L('없음', 'None')], ...[1, 2, 3, 4, 5, 6].map((v) => [v, T.L(`${v}급`, `L${v}`)])], T.L('한국어 급수(TOPIK)', 'Korean level (TOPIK)'))}</div>
<div class="sx-field"><span class="sx-label">${T.L('학력', 'Education')} <b>${esc(profile.education ? T.pair(EDU[profile.education]) : T.L('아직 안 넣음', 'Not entered'))}</b></span>${seg('education', Object.keys(EDU).map((k) => [k, T.pair(EDU[k])]), T.L('학력', 'Education'))}</div>
${field('sx-grade', 'gradePct', T.L('고등학교 성적 평균', 'High school grade average'), '%', gradeText)}
${field('sx-funds', 'fundsWon', T.L('준비한 돈', 'Funds prepared'), T.L('만 원', '× ₩10,000'), fundsText)}
<p class="sx-fine">${T.L('누른 칸을 한 번 더 누르면 「아직 안 넣음」으로 돌아가요.', 'Press a selected option again to clear it.')}</p>
<div id="sx-cond-result">${renderCondResult(view)}</div>
${promise(T)}</div>`;
}
