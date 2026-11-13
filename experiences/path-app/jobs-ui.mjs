// experiences/path-app/jobs-ui.mjs
import { readConfig } from '../synk-account/src/core.mjs';
import { validateSavedJob } from './document.mjs';

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 12000;
const PAGE_SIZE = 12;
const BOARDS = ['moloco', 'coupang'];
const SOURCE_STATUS = ['fresh', 'stale', 'error'];
const ID_RE = /^greenhouse-(moloco|coupang)-(\d{1,20})$/;

const fail = (code) => Object.assign(new Error(code), { code });

async function boundedFetch(fetcher, url, init, signal) {
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  if (signal) signal.aborted ? ctl.abort() : signal.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => ctl.abort(fail('timeout')), TIMEOUT_MS);
  try {
    const res = await fetcher(url, { ...init, credentials: 'omit', redirect: 'error', signal: ctl.signal });
    if (!res || !res.ok) throw fail('http');
    const len = Number(res.headers?.get?.('content-length'));
    if (Number.isFinite(len) && len > MAX_BYTES) throw fail('too_large');
    let text = '';
    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) { try { await reader.cancel(); } catch {} throw fail('too_large'); }
        text += dec.decode(value, { stream: true });
      }
      text += dec.decode();
    } else {
      text = await res.text();
      if (new TextEncoder().encode(text).byteLength > MAX_BYTES) throw fail('too_large');
    }
    try { return JSON.parse(text); } catch { throw fail('invalid'); }
  } catch (e) {
    if (signal?.aborted) throw fail('aborted');
    if (ctl.signal.aborted) throw fail('timeout');
    throw e?.code ? e : fail('network');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onAbort);
  }
}

const str = (v, max = 2000) => typeof v === 'string' && v.length <= max;
const optStr = (v, max) => v === null || str(v, max);
const isDate = (v) => str(v, 64) && !Number.isNaN(Date.parse(v));
const optDate = (v) => v === null || isDate(v);

function normalizeJob(j) {
  if (!j || typeof j !== 'object') throw fail('invalid');
  const m = ID_RE.exec(j.id);
  if (!m || j.provider !== 'greenhouse' || j.board !== m[1] || j.jobId !== m[2]) throw fail('invalid');
  if (![j.company, j.title, j.location, j.url].every((s) => str(s)) || !optStr(j.employmentType, 200) || !isDate(j.observedAt)) throw fail('invalid');
  if (j.updatedAt !== undefined && !optDate(j.updatedAt)) throw fail('invalid');
  const saved = validateSavedJob({
    id: j.id, provider: j.provider, board: j.board, jobId: j.jobId,
    snapshot: { company: j.company, title: j.title, location: j.location, employmentType: j.employmentType, url: j.url, observedAt: j.observedAt },
    savedAt: j.observedAt,
  });
  return saved;
}

const ERROR_CODE_RE = /^[a-z0-9_.-]{1,64}$/i;
function sourceError(e) {
  if (e === null || e === undefined) return null;
  if (typeof e === 'string') {
    if (e.length > 200) throw fail('invalid');
    return ERROR_CODE_RE.test(e) ? e : 'unknown';
  }
  if (typeof e === 'object' && !Array.isArray(e)) {
    const hs = e.httpStatus;
    if (hs !== undefined && hs !== null && !(Number.isInteger(hs) && hs >= 100 && hs <= 599)) throw fail('invalid');
    return typeof e.code === 'string' && ERROR_CODE_RE.test(e.code) ? e.code : 'unknown';
  }
  throw fail('invalid');
}

function normalizeSource(s) {
  if (!s || typeof s !== 'object' || s.provider !== 'greenhouse' || !BOARDS.includes(s.board)) throw fail('invalid');
  if (!str(s.company, 200) || !SOURCE_STATUS.includes(s.status) || typeof s.complete !== 'boolean') throw fail('invalid');
  if (!optDate(s.observedAt) || !optDate(s.attemptedAt) || !optDate(s.retryAfter)) throw fail('invalid');
  const error = sourceError(s.error);
  const ev = s.evidence;
  if (!ev || !str(ev.careerUrl) || !str(ev.documentationUrl) || !isDate(ev.verifiedAt)) throw fail('invalid');
  const safeUrl = (u) => { try { const x = new URL(u); return x.protocol === 'https:' ? x.href : null; } catch { return null; } };
  return {
    provider: s.provider, board: s.board, company: s.company, status: s.status, complete: s.complete,
    observedAt: s.observedAt, attemptedAt: s.attemptedAt, retryAfter: s.retryAfter, error,
    evidence: { careerUrl: safeUrl(ev.careerUrl), documentationUrl: safeUrl(ev.documentationUrl), verifiedAt: ev.verifiedAt },
  };
}

function parsePayload(p) {
  if (!p || p.ok !== true || p.scope !== 'synk-path-jobs' || !Array.isArray(p.jobs) || !Array.isArray(p.sources)) throw fail('invalid');
  if (p.availability !== undefined && p.availability !== 'disabled') throw fail('invalid');
  if (p.availability === 'disabled') {
    if (p.jobs.length || p.sources.length) throw fail('invalid');
    return { disabled: true, jobs: [], sources: [] };
  }
  if (p.jobs.length > 3000 || p.sources.length > 2) throw fail('invalid');
  const sources = p.sources.map(normalizeSource);
  if (new Set(sources.map((s) => s.board)).size !== sources.length) throw fail('invalid');
  const jobs = p.jobs.map(normalizeJob);
  if (new Set(jobs.map((j) => j.id)).size !== jobs.length) throw fail('invalid');
  return { jobs, sources };
}

export function createJobsFeed({ fetcher = fetch, configUrl = './config.json', onChange = () => {}, getUrl = () => location.href } = {}) {
  let state = { status: 'idle', jobs: [], sources: [], error: null };
  let inflight = null;
  let disposed = false;
  const ctl = new AbortController();
  const snapshot = () => ({ ...state, jobs: state.jobs.slice(), sources: state.sources.slice() });
  const set = (next) => { if (disposed) return; state = next; try { onChange(snapshot()); } catch {} };

  async function run() {
    let config;
    try {
      const raw = await boundedFetch(fetcher, new URL(configUrl, getUrl()).href, { method: 'GET' }, ctl.signal);
      config = readConfig(raw, getUrl());
    } catch (e) {
      if (e?.code === 'aborted') return;
      if (e?.code === 'http' || e?.code === 'invalid' || !e?.code) config = null;
      else return set({ ...state, status: 'error', error: e.code, stale: state.jobs.length > 0 });
    }
    if (!config || !config.accountApiUrl || !config.supabasePublishableKey) {
      return set({ status: 'unconfigured', jobs: [], sources: [], error: null });
    }
    try {
      const url = new URL('functions/v1/synk-path', String(config.accountApiUrl).replace(/\/?$/, '/'));
      url.searchParams.set('action', 'jobs');
      const data = parsePayload(await boundedFetch(fetcher, url.href, {
        method: 'GET', headers: { apikey: config.supabasePublishableKey },
      }, ctl.signal));
      if (data.disabled) return set({ status: 'disabled', jobs: [], sources: [], error: null, stale: false });
      set({ status: 'ready', jobs: data.jobs, sources: data.sources, error: null, stale: false });
    } catch (e) {
      if (e?.code === 'aborted') return;
      set({ ...state, status: 'error', error: e?.code || 'unknown', stale: state.jobs.length > 0 });
    }
  }

  return {
    load() {
      if (disposed) return Promise.resolve(snapshot());
      if (!inflight) {
        inflight = run().finally(() => { inflight = null; });
        set({ ...state, status: 'loading' });
      }
      return inflight.then(snapshot);
    },
    snapshot,
    dispose() { disposed = true; ctl.abort(); },
  };
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const T = {
  ko: {
    h: '한국 근무 공고', refresh: '새로고침', loading: '불러오는 중…', search: '검색', query: '공고 검색', all: '전체 회사',
    company: '회사', saved: '저장한 공고만', note: '회사 채용 페이지에서 직접 가져온 공고입니다. 외국인 지원 가능 여부나 비자 지원을 보장하지 않습니다. 마감일은 제공되지 않습니다.',
    fetched: '가져온 시각', updated: '공고 수정일', prepare: '지원 준비', save: '저장', remove: '저장 해제', open: '원문 공고',
    fresh: '최신', stale: '캐시됨', errorS: '실패', unconfigured: '공고 서버가 설정되지 않았습니다.',
    err: '공고를 불러오지 못했습니다.', staleNote: '이전에 불러온 공고를 표시 중이며 최신이 아닐 수 있습니다.',
    noMatch: '검색 조건에 맞는 공고가 없습니다.', zero: '현재 게시된 공고가 없습니다.', noSaved: '저장한 공고가 없습니다.',
    gone: '현재 목록에 없음', unconfirmed: '현재 게시 여부 확인 불가', unavailable: '출처를 사용할 수 없음',
    inUse: '작업에서 사용 중이면 해제할 수 없습니다.', page: '페이지', prev: '이전', next: '다음', readonly: '현재는 자료를 바꿀 수 없어요. 내 정보에서 저장 상태를 확인해 주세요.',
    count: (n) => `${n}개 공고`, partial: '일부 출처가 최신이 아니거나 실패했습니다.',
    unknownEmpty: '일부 출처를 확인하지 못해 현재 게시된 공고가 없는지 확인할 수 없습니다.',
    disabled: '채용 공고 연결을 준비하고 있어요. 현재 공고는 아래 공식 사이트에서 확인해 주세요.', savedH: '저장한 공고',
  },
  en: {
    h: 'Jobs in Korea', refresh: 'Refresh', loading: 'Loading…', search: 'Search', query: 'Search jobs', all: 'All companies',
    company: 'Company', saved: 'Saved only', note: 'Listings come directly from company career feeds. They do not guarantee foreigner eligibility or visa sponsorship. No deadlines are provided.',
    fetched: 'Fetched', updated: 'Posting updated', prepare: 'Prepare application', save: 'Save', remove: 'Remove', open: 'Original posting',
    fresh: 'Latest', stale: 'Cached', errorS: 'Failed', unconfigured: 'The jobs service is not configured.',
    err: 'Could not load jobs.', staleNote: 'Showing previously loaded jobs; they may be out of date.',
    noMatch: 'No jobs match your filters.', zero: 'No jobs are currently posted.', noSaved: 'No saved jobs.',
    gone: 'No longer listed', unconfirmed: 'Cannot confirm current listing', unavailable: 'Source unavailable',
    inUse: 'Cannot be removed while used by a task.', page: 'Page', prev: 'Previous', next: 'Next', readonly: 'You can\'t change data right now. Please check the save status in Profile.',
    count: (n) => `${n} jobs`, partial: 'Some sources are stale or failed.',
    unknownEmpty: 'Some sources could not be checked, so we cannot confirm whether any jobs are currently posted.',
    disabled: 'We are preparing to connect job listings. For current openings, please check the official sites below.', savedH: 'Saved jobs',
  },
};
const OFFICIAL = [['Moloco', 'https://www.moloco.com/careers'], ['Coupang', 'https://www.coupang.jobs/kr/']];
const fmt = (iso, lang) => { const d = new Date(iso); return Number.isNaN(+d) ? '' : d.toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US'); };

function card(job, t, lang, { saved, live, freshness, canEdit }) {
  const s = job.snapshot, dis = canEdit ? '' : ' disabled';
  const id = esc(job.id);
  return `<li class="opportunity jobs-card" data-id="${id}"><h3>${esc(s.title)}</h3>
<p class="meta">${esc(s.company)} · ${esc(s.location)}${s.employmentType ? ` · ${esc(s.employmentType)}` : ''}</p>
<p class="meta">${esc(t.fetched)}: <time datetime="${esc(s.observedAt)}">${esc(fmt(s.observedAt, lang))}</time>${live?.updatedAt ? ` · ${esc(t.updated)}: <time datetime="${esc(live.updatedAt)}">${esc(fmt(live.updatedAt, lang))}</time>` : ''}</p>
${freshness ? `<p class="chip jobs-freshness">${esc(freshness)}</p>` : ''}
<div class="actions"><button type="button" class="primary" data-action="prepareJob" data-id="${id}"${dis}>${esc(t.prepare)}</button>
${saved ? `<button type="button" class="secondary" data-action="removeJob" data-id="${id}" title="${esc(t.inUse)}"${dis}>${esc(t.remove)}</button>`
    : `<button type="button" class="secondary" data-action="saveJob" data-id="${id}"${dis}>${esc(t.save)}</button>`}
<a class="secondary" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(t.open)}</a></div></li>`;
}

export function renderJobs({ feed, lang = 'ko', savedJobs = [], query = '', board = 'all', onlySaved = false, page = 0, canEdit = true } = {}) {
  const t = T[lang] || T.ko;
  const st = feed || { status: 'idle', jobs: [], sources: [], error: null };
  const boardSel = board === 'all' || BOARDS.includes(board) ? board : 'all';
  const savedMap = new Map();
  for (const j of savedJobs) { try { const v = validateSavedJob(j); savedMap.set(v.id, v); } catch {} }
  if (st.status === 'disabled') {
    const savedItems = [...savedMap.values()].map((j) => card(j, t, lang, { saved: true, live: null, freshness: null, canEdit })).join('');
    const links = OFFICIAL.map(([n, u]) => `<li><a class="secondary" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(n)}</a></li>`).join('');
    return `<section class="jobs" aria-labelledby="jobs-heading">
<div class="section-heading"><h2 id="jobs-heading">${esc(t.h)}</h2></div>
<p class="notice">${esc(t.disabled)}</p>
<ul class="jobs-official">${links}</ul>
${savedItems ? `<h3>${esc(t.savedH)}</h3>${canEdit ? '' : `<p class="notice">${esc(t.readonly)}</p>`}<ul class="opportunity-list">${savedItems}</ul>` : ''}</section>`;
  }
  const liveMap = new Map(st.jobs.map((j) => [j.id, j]));
  const srcMap = new Map(st.sources.map((s) => [s.board, s]));
  const busy = st.status === 'loading';
  const q = String(query).trim().toLowerCase();
  const base = onlySaved ? [...savedMap.values()] : st.jobs;
  const byBoard = base.filter((j) => boardSel === 'all' || j.board === boardSel);
  const list = byBoard.filter((j) => !q || [j.snapshot.title, j.snapshot.company, j.snapshot.location].some((x) => String(x).toLowerCase().includes(q)));
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const p = Math.min(Math.max(0, Math.floor(Number(page) || 0)), pages - 1);
  const freshnessOf = (j) => {
    if (liveMap.has(j.id)) return null;
    if (st.status === 'error' || st.stale || busy || st.status === 'idle') return t.unconfirmed;
    const src = srcMap.get(j.board);
    if (!src) return t.unavailable;
    return src.status === 'fresh' && src.complete ? t.gone : t.unconfirmed;
  };
  const sources = st.sources.map((s) => {
    const label = s.status === 'fresh' ? t.fresh : s.status === 'stale' ? t.stale : t.errorS;
    const when = s.observedAt ? ` · ${esc(t.fetched)} ${esc(fmt(s.observedAt, lang))}` : '';
    return `<li class="chip jobs-source jobs-${esc(s.status)}">${esc(s.company)}: ${esc(label)}${when}</li>`;
  }).join('');
  const notices = [];
  if (st.status === 'unconfigured') notices.push(t.unconfigured);
  if (st.status === 'error') notices.push(st.stale ? `${t.err} ${t.staleNote}` : t.err);
  if (st.sources.some((s) => s.status !== 'fresh' || !s.complete)) notices.push(t.partial);
  if (!canEdit) notices.push(t.readonly);
  let empty = '';
  if (!list.length && !busy && st.status !== 'unconfigured' && !(st.status === 'error' && !st.jobs.length && !onlySaved)) {
    const filtered = base.length > 0 || boardSel !== 'all' || !!q;
    empty = onlySaved && !savedMap.size ? t.noSaved : filtered ? t.noMatch
      : st.status === 'ready' && st.sources.length && st.sources.every((s) => s.status === 'fresh' && s.complete) ? t.zero : t.unknownEmpty;
  }
  const items = list.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE)
    .map((j) => card(j, t, lang, { saved: savedMap.has(j.id), live: liveMap.get(j.id), freshness: onlySaved ? freshnessOf(j) : null, canEdit })).join('');
  const opt = (v, l) => `<option value="${v}"${boardSel === v ? ' selected' : ''}>${esc(l)}</option>`;
  const companyName = (b) => srcMap.get(b)?.company || (b === 'moloco' ? 'Moloco' : 'Coupang');
  const pager = pages > 1 ? `<nav class="jobs-pager" aria-label="${esc(t.page)}">
<button type="button" class="secondary" data-action="jobPage" data-page="${p - 1}"${p === 0 ? ' disabled' : ''}>${esc(t.prev)}</button>
<span class="meta">${p + 1} / ${pages}</span>
<button type="button" class="secondary" data-action="jobPage" data-page="${p + 1}"${p >= pages - 1 ? ' disabled' : ''}>${esc(t.next)}</button></nav>` : '';
  return `<section class="jobs" aria-labelledby="jobs-heading" aria-busy="${busy}">
<div class="section-heading"><h2 id="jobs-heading">${esc(t.h)}</h2>
<button type="button" class="secondary" data-action="refreshJobs"${busy ? ' disabled' : ''}>${esc(busy ? t.loading : t.refresh)}</button></div>
<p class="notice">${esc(t.note)}</p>
${sources ? `<ul class="jobs-sources" aria-label="${esc(t.company)}">${sources}</ul>` : ''}
<div role="status" aria-live="polite" class="jobs-status">${busy ? `<p class="meta">${esc(t.loading)}</p>` : ''}${notices.map((n) => `<p class="notice">${esc(n)}</p>`).join('')}</div>
<form class="jobs-filters" role="search">
<label for="job-query">${esc(t.query)}</label>
<input id="job-query" type="search" data-action="jobQuery" value="${esc(query)}">
<button type="button" class="primary" data-action="searchJobs">${esc(t.search)}</button>
<label for="job-board">${esc(t.company)}</label>
<select id="job-board" data-action="jobBoard">${opt('all', t.all)}${BOARDS.map((b) => opt(b, companyName(b))).join('')}</select>
<label class="jobs-toggle"><input type="checkbox" data-action="savedJobs"${onlySaved ? ' checked' : ''}> ${esc(t.saved)}</label>
</form>
${list.length ? `<p class="meta">${esc(t.count(list.length))}</p>` : ''}
${empty ? `<p class="notice">${esc(empty)}</p>` : ''}
<ul class="opportunity-list">${items}</ul>${pager}</section>`;
}

export function jobOpportunity(savedJob) {
  const j = validateSavedJob(savedJob);
  const s = j.snapshot;
  const where = `${s.company} · ${s.location}`;
  return {
    id: j.id, goal: 'job', source: 'live',
    title: { ko: s.title, en: s.title },
    summary: { ko: `${where}. 세부 요건은 원문 공고에서 확인하세요.`, en: `${where}. Check the original posting for details.` },
    requirements: [
      { ko: '원문 공고의 자격 요건을 직접 확인하기', en: 'Review the qualifications in the original posting yourself' },
      { ko: '근무 자격과 비자 조건을 회사에 확인하기', en: 'Confirm work eligibility and visa terms with the company' },
    ],
    prompt: {
      ko: `${s.company}의 "${s.title}" (${s.location}) 지원을 위해 관련 경험과 성과를 사실대로 정리하세요.`,
      en: `List your relevant experience and results, factually, for "${s.title}" at ${s.company} (${s.location}).`,
    },
    url: s.url,
  };
}