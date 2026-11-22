// PATH 3단계 「내 길」 화면. 상태를 받아 HTML 글을 내는 순수 함수만 둔다(창, DOM, 저장소를 쓰지 않는다).
// 결: 시안 2판(.sx). 공개 CSP(style-src 'self')라 인라인 스타일을 쓰지 않는다(진행 줄은 <progress>).
import { docsFor, visaFor } from './docs-data.mjs';
import { programById } from './study-data.mjs';
import { programImage } from './study-ui.mjs';
import { renderDates } from './channel-ui.mjs';
import { postById, nextDate, monthDay, isStalePost } from './channel-data.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (p) => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
const GO = svg('<path d="M4 10h11.5M11 5.5 15.5 10 11 14.5"/>');
const BACK = svg('<path d="M12.5 4.5 7 10l5.5 5.5"/>');
const ON = svg('<path d="m5 10.4 3.2 3.1L15 6.6"/>');

function ctx(view) {
  const now = view.now || new Date();
  const en = view.lang === 'en';
  const L = (ko, e) => (en ? e : ko);
  const pick = (o) => (o ? (en ? o.en : o.ko) : '');
  const thisYear = Number(new Date((now instanceof Date ? now.getTime() : new Date(now).getTime()) + 9 * 3600000).toISOString().slice(0, 4));
  return { now, en, L, pick, md: (d) => monthDay(d, en, thisYear), profile: view.profile || {}, programs: view.programs || [], posts: view.posts || [], persisted: view.persisted !== false, store: ['account', 'blocked', 'wait'].includes(view.store) ? view.store : 'tab', storeNote: String(view.storeNote || ''), note: typeof view.note === 'string' ? view.note : '' };
}
const newTab = (T) => `<span class="sr-only"> (${T.L('새 탭에서 열림', 'opens in new tab')})</span>`;
const STAGE = {
  apply: { ko: '원서와 함께', en: 'With the application', who: { ko: '대학에 내요', en: 'To the university' } },
  admitted: { ko: '합격 뒤', en: 'After admission', who: { ko: '대학에 내요', en: 'To the university' } },
  visa: { ko: '비자', en: 'Visa', who: { ko: '비자신청센터(KVAC)에 내요', en: 'To the visa center (KVAC)' } }
};

/** 표지와 카드의 다음 날. 원서 차수를 먼저 보고, 남은 원서 차수가 없으면 「원서 접수 끝남」과 이미 낸 사람의 서류 기한을 낸다. */
function nextInfo(post, T) {
  const apply = post ? nextDate(post, T.now, { skipDocs: true }) : null;
  if (apply) {
    const st = apply.status.state, md = T.md(apply.due);
    const when = st === 'before' ? T.L(`${md} 시작`, `opens ${md}`) : st === 'open' ? T.L(`${md} 마감`, `closes ${md}`) : md;
    return { closed: false, text: `${T.pick(apply.date.label)} · ${when}` };
  }
  const docs = post ? nextDate(post, T.now) : null;
  return { closed: true, docs: docs ? `${T.pick(docs.date.label)} ${T.md(docs.due)}` : '' };
}

/** 고른 과정. 실제로 싣는 과정이 아니거나 서류 자료가 없으면 null. */
export function pathTarget(view) {
  const T = ctx(view), id = T.profile.target;
  const program = id ? programById(T.programs, id) : null;
  const set = program && !program.example ? docsFor(program, T.profile) : null;
  return set ? { program, set } : null;
}

const doneIds = (T) => new Set((T.profile.docs || []).map((d) => d.id));
/** 묶음마다 표시한 수와 전체(접힌 「해당자만」 서류는 세지 않는다). */
export function stageCounts(set, profile) {
  const done = new Set((profile.docs || []).map((d) => d.id));
  const out = {};
  for (const stage of ['apply', 'admitted', 'visa']) {
    const list = set.mine.filter((d) => d.stage === stage);
    out[stage] = { n: list.filter((d) => done.has(d.id)).length, total: list.length };
  }
  return out;
}

function docRow(d, T, done) {
  const on = done.has(d.id);
  const line = (label, o) => (o ? `<p class="sx-doc-line"><b>${label}</b> ${esc(T.pick(o))}</p>` : '');
  const visa = d.stage === 'visa';
  const unclear = !d.unclear ? '' : visa
    ? `<div class="sx-unclear"><p><b>${T.L('KVAC에 확인할 것', 'Check with KVAC')}</b> ${esc(T.pick(d.unclear))}</p></div>`
    : `<div class="sx-unclear"><p><b>${T.L('요강에서 두 가지로 읽혀요', 'The guide can be read two ways')}</b> ${esc(T.pick(d.unclear))}</p><p>${T.L('대학에 먼저 물어보세요.', 'Ask the university first.')}</p></div>`;
  return `<li class="sx-docrow"><div class="sx-doc-main"><b class="sx-doc-name">${esc(T.pick(d.name))}</b>${T.en ? `<small class="sx-doc-ko" lang="ko">${esc(d.name.ko)}</small>` : ''}${d.only ? `<p class="sx-doc-line"><b>${T.L('해당자', 'Who')}</b> ${esc(T.pick(d.only.cond))}</p>` : ''}${line(T.L('구하는 곳', 'Where to get it'), d.from)}${line(T.L('날짜 조건', 'Date rule'), d.when)}${d.note ? `<p class="sx-doc-note">${esc(T.pick(d.note))}</p>` : ''}${unclear}</div><button type="button" class="sx-btn2 sm sx-docbtn" aria-pressed="${on}" data-action="docToggle" data-id="${esc(d.id)}"><span class="sx-on">${ON}</span>${T.L('준비했어요', 'Ready')}<span class="sr-only"> ${esc(T.pick(d.name))}</span></button></li>`;
}

function stageBlock(stage, t, T, done, counts) {
  const docs = t.set.mine.filter((d) => d.stage === stage), folds = t.set.notMine.filter((d) => d.stage === stage);
  if (!docs.length && !folds.length) return '';
  const src = stage === 'visa' ? t.set.visa : t.set.program;
  const c = counts[stage];
  const label = stage === 'visa' ? `${T.pick(STAGE.visa)} · ${T.pick(t.set.visa.name)}` : T.pick(STAGE[stage]);
  const head = `<div class="sx-stage-head"><h2 class="sx-h" id="sx-stage-${stage}">${esc(label)}</h2><span class="sx-stage-who">${T.pick(STAGE[stage].who)}</span></div>`;
  const meta = `<p class="sx-src"><b>${T.L('출처', 'Source')}</b> <a href="${esc(src.source.url)}" target="_blank" rel="noopener noreferrer">${esc(T.pick(src.source.title))}${newTab(T)}</a> · ${T.L('확인', 'checked')} ${esc(src.checkedAt)}${stage !== 'visa' && t.set.program.term ? ` · ${esc(T.pick(t.set.program.term))}` : ''}</p>`;
  const stale = isStalePost({ checkedAt: src.checkedAt }, T.now) ? `<p class="sx-note is-box">${T.L('확인한 지 90일이 지났어요. 서류는 원문에서 다시 확인하세요.', 'This was checked more than 90 days ago. Check the documents in the original.')}</p>` : '';
  // 과정의 공통 규칙은 첫 대학 묶음(원서와 함께)에만 둔다(합격 뒤 묶음에서 되풀이하지 않는다).
  const rules = stage !== 'admitted' && ((src.rules || []).length || (src.unclear || []).length)
    ? `<ul class="sx-rules">${(src.rules || []).map((r) => `<li>${esc(T.pick(r))}</li>`).join('')}${(src.unclear || []).map((r) => `<li class="is-unclear"><b>${T.L('요강에서 두 가지로 읽혀요', 'The guide can be read two ways')}</b> ${esc(T.pick(r))}</li>`).join('')}</ul>` : '';
  const progress = `<div class="sx-prog-row"><progress class="sx-prog" value="${c.n}" max="${c.total}" aria-labelledby="sx-stage-${stage} sx-prog-${stage}"></progress><span class="sx-prog-text" id="sx-prog-${stage}">${T.L(`${c.n}/${c.total} 표시`, `${c.n} of ${c.total} marked`)}</span></div>`;
  let doneMsg = '';
  if (stage === 'apply' && c.total > 0 && c.n === c.total) {
    const folded = folds.length, unclear = docs.filter((d) => d.unclear).length + (t.set.program.unclear || []).length;
    const extra = [folded ? T.L(`해당하는 사람만 내는 서류 ${folded}개`, `${folded} document${folded === 1 ? '' : 's'} only some applicants submit`) : '', unclear ? T.L(`요강이 두 가지로 읽히는 곳 ${unclear}개`, `${unclear} place${unclear === 1 ? '' : 's'} where the guide reads two ways`) : ''].filter(Boolean);
    doneMsg = `<p class="sx-note is-box sx-done">${T.L('원서 서류를 다 표시했어요.', 'You have marked all application documents.')}${extra.length ? ` ${T.L(`${extra.join(', ')}는 따로 확인하세요.`, `Check separately: ${extra.join('; ')}.`)}` : ''} ${T.L('접수 방법은 요강에서 확인하세요.', 'Check how to apply in the guide.')} <a href="${esc(t.set.program.source.url)}" target="_blank" rel="noopener noreferrer">${T.L('요강 보기', 'Open the guide')}${newTab(T)}</a></p>`;
  }
  const marked = folds.filter((d) => done.has(d.id)).length;
  const foldedList = folds.length
    ? `<details class="sx-past sx-folded" data-fold="docs-${stage}"><summary>${T.L(`해당하는 사람만 내는 서류 ${folds.length}개`, `${folds.length} document${folds.length === 1 ? '' : 's'} only some applicants submit`)}${marked ? T.L(` · ${marked}개 표시`, ` · ${marked} marked`) : ''}</summary><ul class="sx-docs">${folds.map((d) => docRow(d, T, done)).join('')}</ul></details>` : '';
  return `<section class="sx-stage" aria-labelledby="sx-stage-${stage}">${head}${meta}${stale}${docs.length ? progress : ''}${rules}${docs.length ? `<ul class="sx-docs">${docs.map((d) => docRow(d, T, done)).join('')}</ul>` : ''}${foldedList}${doneMsg}</section>`;
}

function storeNote(T) {
  if ((T.store === 'blocked' || T.store === 'wait') && T.storeNote) return `<p class="sx-fine">${esc(T.storeNote)}</p>`;
  if (T.store === 'account') return `<p class="sx-fine">${T.L('표시는 계정에 저장돼요. 내 정보에서 지울 수 있어요.', 'Marks are saved to your account. You can delete them on the Profile page.')}</p>`;
  return T.persisted
    ? `<p class="sx-fine">${T.L('표시는 이 탭에만 있어요. 탭을 닫거나 로그아웃하면 사라져요.', 'Marks stay in this tab only. They disappear when you close the tab or sign out.')}</p>`
    : `<p class="sx-store is-warn">${T.L('이 브라우저에서는 저장할 수 없어서 표시를 지금 화면에서만 기억해요. 새로 고치면 사라져요.', 'This browser cannot store marks, so they are remembered on this screen only and are lost on reload.')}</p>`;
}

/** 「내 길」 화면. */
export function renderPath(view) {
  const T = ctx(view), t = pathTarget(view);
  const back = `<button type="button" class="sx-back" data-action="nav" data-page="today">${BACK}${T.L('오늘', 'Today')}</button>`;
  if (!t) {
    return `<div class="sx">${back}<header class="sx-head"><p class="sx-kicker">${T.L('내 길', 'My path')}</p><h1 class="sx-title page-title" tabindex="-1">${T.L('준비할 과정을 골라 주세요', 'Pick a program to prepare for')}</h1><p class="sx-lead">${T.L('대학 탭에서 과정을 열고 「이 과정으로 준비하기」를 누르면, 그 과정에 내는 서류와 기한을 여기에 모아 보여 줘요.', 'Open a program in the Schools tab and press “Prepare for this program”. Its documents and deadlines will be gathered here.')}</p></header><button type="button" class="sx-cta" data-action="nav" data-page="univ">${T.L('대학 보기', 'Browse schools')} ${GO}</button></div>`;
  }
  const { program, set } = t, done = doneIds(T), counts = stageCounts(set, T.profile);
  const post = postById(T.posts, 'univ-' + program.id);
  const n = nextInfo(post, T);
  const tag = !n.closed ? n.text : T.L('이번 원서 접수 끝남', 'Applications closed');
  const closed = n.closed ? `<p class="sx-note is-box">${n.docs ? T.L(`이번 원서 접수는 끝났어요. 이미 원서를 냈다면 남은 기한은 ${esc(n.docs)}이에요. 아니면 다음 요강을 기다려요.`, `Applications for this intake have closed. If you already applied, your remaining deadline is ${esc(n.docs)}. Otherwise, wait for the next guide.`) : T.L('이번 원서 접수는 끝났어요. 다음 요강을 기다려요.', 'Applications for this intake have closed. Wait for the next guide.')}</p>` : '';
  const status = set.program.status ? `<p class="sx-note is-box">${esc(T.pick(set.program.status))}</p>` : '';
  const ask = set.program.ask ? `<p class="sx-fine"><b>${T.L('물을 곳', 'Ask')}</b> ${esc(T.pick(set.program.ask))}</p>` : '';
  return `<div class="sx">${back}
<div class="sx-photo is-hero sx-post-hero">${programImage(program)}<span class="sx-photo-body"><span class="sx-tag white">${esc(tag)}</span></span></div>
<p class="sx-kicker">${T.L('준비 중인 과정', 'Preparing for')} · ${esc(T.pick(program.place))}</p>
<h1 class="sx-title page-title" tabindex="-1">${esc(T.pick(program.name))}${program.level !== 'language' ? T.L(' 학부', ' undergraduate') : ''}</h1>
<p class="sx-lead">${esc(T.pick(set.program.how))}</p>${closed}${status}${ask}
<p class="sx-note">${T.L('「준비했어요」는 내가 표시한 것이에요. 대학이나 비자신청센터(KVAC)가 확인한 것이 아니에요.', '“Ready” is your own mark. It is not a check by the university or the visa center (KVAC).')}</p>
${storeNote(T)}${view.docFull ? `<p class="sx-store is-warn">${T.L('표시가 예순 개라 더 넣을 수 없어요. 다른 과정의 표시를 뺀 뒤 넣어 주세요.', 'You already have 60 marks. Remove some from another program first.')}</p>` : ''}
${renderDates(view, post, T.L('이 과정의 날짜', 'Dates for this program'))}
${['apply', 'admitted', 'visa'].map((s) => stageBlock(s, t, T, done, counts)).join('')}
<div class="sx-row2"><button type="button" class="sx-btn2" data-action="univOpen" data-id="${esc(program.id)}">${T.L('과정 자세히 보기', 'Program details')}</button><button type="button" class="sx-btn2 line" data-action="pathPick" data-id="${esc(program.id)}">${T.L('준비 그만하기', 'Stop preparing')}</button></div>
<p class="sx-fine">${T.L('이 목록은 입학이나 비자를 약속하지 않아요. 마지막 판단은 대학과 출입국이 해요.', 'This list does not promise admission or a visa. The university and immigration office make the final decision.')}</p></div>`;
}

/** 오늘 화면의 내 길 카드. 고른 과정이 없으면 빈 글. */
export function renderPathCard(view) {
  const T = ctx(view), t = pathTarget(view);
  if (!t) return '';
  const c = stageCounts(t.set, T.profile).apply;
  const n = nextInfo(postById(T.posts, 'univ-' + t.program.id), T);
  const next = !n.closed ? T.L(`다음: ${n.text}`, `Next: ${n.text}`)
    : n.docs ? T.L(`이번 원서 접수는 끝났어요 · 이미 냈다면 ${n.docs}`, `Applications closed · if you applied: ${n.docs}`) : T.L('이번 원서 접수는 끝났어요', 'Applications closed');
  return `<section class="sx sx-today" aria-labelledby="sx-path-h"><h2 class="sx-h" id="sx-path-h">${T.L('내 길', 'My path')}</h2><button type="button" class="sx-pathcard" data-action="nav" data-page="path"><span class="sx-pathcard-main"><small>${T.L('준비 중인 과정', 'Preparing for')}</small><b>${esc(T.pick(t.program.name))}${t.program.level !== 'language' ? T.L(' 학부', ' undergraduate') : ''}</b><span class="sx-prog-row"><progress class="sx-prog" value="${c.n}" max="${c.total}" aria-hidden="true"></progress><span>${T.L(`원서 서류 ${c.n}/${c.total} 표시`, `Application documents ${c.n} of ${c.total} marked`)}</span></span><small>${esc(next)}</small></span><span class="sx-go" aria-hidden="true">${GO}</span></button></section>`;
}

/** 대학 자세히의 「이 과정으로 준비하기」 상자. 서류 자료가 없는 과정이면 빈 글. */
export function renderPathPick(view, program) {
  const T = ctx(view);
  if (!program || program.example) return '';
  const set = docsFor(program, T.profile);
  if (!set) return '';
  const on = T.profile.target === program.id;
  const visa = visaFor(program) === 'D-2' ? T.L('유학(D-2)', 'student (D-2)') : T.L('어학연수(D-4-1)', 'language trainee (D-4-1)');
  return `<section class="sx-card butter sx-pathpick"><p class="sx-k">${T.L('내 길', 'My path')}</p><h2>${T.L(`이 과정의 원서 · 합격 뒤 서류와 ${visa} 비자 서류를 한곳에서 챙겨요.`, `Keep this program’s application and post-admission documents and the ${visa} visa documents in one place.`)}</h2><div class="sx-row2"><button type="button" class="sx-btn2" aria-pressed="${on}" data-action="pathPick" data-id="${esc(program.id)}"><span class="sx-on">${ON}</span>${T.L('이 과정으로 준비하기', 'Prepare for this program')}</button>${on ? `<button type="button" class="sx-link" data-action="nav" data-page="path">${T.L('내 길 열기', 'Open my path')}${GO}</button>` : ''}</div></section>`;
}
