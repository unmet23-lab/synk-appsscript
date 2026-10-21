/* SYNK LAB · TOPIK 4급 온라인 반 관심 등록 — 화면 동작.
 * 원본: SYNK-appsscript/experiences/lab-topik4/src/app.js
 * 하는 일: 화면 언어 고르기(?lang → 기기 언어 → 한국어), 들어온 곳 표시(?from), 목록 그리기, 관심 등록 보내기.
 * 보내기: 홈페이지 문의 구글 폼(copy.js FORM)에 바로 보낸다. 회사 서버가 그 폼을 5분마다 모아 분류·답변 초안·할 일로 만든다.
 *   no-cors라 응답을 읽지 못한다 — 요청이 네트워크에서 끝나면 접수로 본다. 그래서 이메일은 폼보다 깐깐하게 미리 보고,
 *   완료 판에 「다시 등록하기」와 문의 주소를 둔다. 등록을 셀 때는 문의 내용 첫 줄의 FORM.marker로 거른다.
 * 보내는 것: 사용자가 적은 칸 + 들어온 링크 표시(from) + 화면 언어. 앞 사이트 주소는 보내지 않는다(안내문과 맞춤, 아르곤 10-21).
 * 기록: 이 기기에는 아무것도 남기지 않는다(화면 언어만 주소에 남긴다).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./copy.js'));
  else root.SynkTopik4 = factory(root.SynkTopik4Copy);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 「·」로 이은 말은 한 덩어리로(word-break:keep-all이 「·」 앞뒤에서 줄을 가른다 — 시그널 도구와 같은 규칙).
  // 몽골어 서수 「4-р」·「51–54-р」도 하이픈에서 갈리지 않게 묶는다.
  const keepDots = s => esc(s)
    .replace(/[^\s·]+(?:·[^\s·]+)+/g, m => `<span class="nw">${m}</span>`)
    .replace(/\d+(?:[–-]\d+)?-[а-яёөү]+/gi, m => `<span class="nw">${m}</span>`);

  /** 화면 언어: 주소의 ?lang이 먼저, 없으면 기기 언어에 몽골어가 있으면 몽골어, 아니면 한국어. */
  function pickLang(search, navLangs) {
    const q = new URLSearchParams(search || '').get('lang');
    if (q && C.LANGS.includes(q)) return q;
    const list = (navLangs || []).map(x => String(x || '').toLowerCase());
    return list.some(x => x === 'mn' || x.startsWith('mn-')) ? 'mn' : 'ko';
  }

  /** 들어온 곳(?from): 게시물·학교마다 다른 짧은 이름. 영소문자·숫자·하이픈 40자까지만 받고, 아니면 direct. */
  function fromKey(search) {
    const raw = String(new URLSearchParams(search || '').get('from') || '').trim().toLowerCase();
    return /^[a-z0-9][a-z0-9-]{0,39}$/.test(raw) ? raw : 'direct';
  }

  /** 이메일: 구글 폼이 거절할 꼴(연속 점·쉼표·하이픈으로 시작하거나 끝나는 도메인 칸 등)을 미리 막는다. */
  function validEmail(s) {
    const v = String(s || '').trim();
    const m = /^([^\s@,;:"<>()[\]\\]{1,64})@((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24})$/i.exec(v);
    if (!m || v.length > 254) return false;
    return !/^\.|\.$|\.\./.test(m[1]);
  }
  const clip = (s, n) => String(s || '').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim().slice(0, n);
  const pick = (list, id) => list.find(x => x.id === id);

  /** 빈칸·잘못된 칸 → { 칸: 오류 글 키 }. 이름·시간·하고 싶은 말은 선택이다. */
  function validate(v) {
    const err = {};
    if (!validEmail(v.email)) err.email = 'errEmail';
    if (!pick(C.LEVELS, v.level)) err.level = 'errPick';
    if (!pick(C.WHEN, v.when)) err.when = 'errPick';
    if (v.consent !== true) err.consent = 'errConsent';
    return err;
  }

  /** 폼의 「문의 내용」 칸에 들어갈 글. 받는 쪽이 한국어로 읽고, 첫 줄 표식으로 관심 등록만 거른다. */
  function buildBody(v) {
    const level = pick(C.LEVELS, v.level);
    const when = pick(C.WHEN, v.when);
    const time = pick(C.TIMES, v.time);
    const lines = [
      C.FORM.marker,
      `이름: ${clip(v.name, 40) || '(안 적음)'}`,
      `지금 급수: ${level ? level.record : '(안 고름)'}`,
      `4급이 필요한 때: ${when ? when.record : '(안 고름)'}`,
      `토요일 시간: ${time ? time.record : '(안 고름)'}`,
    ];
    const note = clip(v.note, 300);
    if (note) lines.push(`쓰기에서 어려운 점: ${note}`);
    lines.push(`들어온 곳: ${v.from || 'direct'} · 화면 언어 ${v.lang === 'mn' ? '몽골어' : '한국어'}`);
    return lines.join('\n');
  }

  /** 구글 폼 formResponse에 보낼 값. 동의는 폼 선택지 글 그대로 보낸다(화면에서 고른 경우에만 부른다). */
  function buildPayload(v) {
    const p = new URLSearchParams();
    p.set(C.FORM.email, String(v.email || '').trim());
    p.set(C.FORM.type, C.FORM.typeValue);
    p.set(C.FORM.body, buildBody(v));
    p.set(C.FORM.consent, C.FORM.consentValue);
    p.set('fvv', '1');
    p.set('pageHistory', '0');
    return p;
  }

  /** 친구에게 보낼 주소 — 들어온 곳은 friend로 바꾸고 화면 언어는 그대로. */
  function shareUrl(base, lang) {
    const u = new URL(base);
    u.search = '';
    u.hash = '';
    u.searchParams.set('from', 'friend');
    u.searchParams.set('lang', lang);
    return u.toString();
  }

  const api = { pickLang, fromKey, validEmail, validate, buildBody, buildPayload, shareUrl, keepDots };
  if (typeof document === 'undefined') return api;

  /* ───────── 화면 ───────── */
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const state = {
    lang: pickLang(location.search, navigator.languages || [navigator.language]),
    from: fromKey(location.search),
    openedAt: Date.now(),
    sending: false,
    errors: {},      // 칸 → 오류 글 키(보낸 뒤에만 보인다)
    sendErr: '',     // 보내기 오류 글 키
    share: null,     // { key } 또는 { url } — 언어를 바꿔도 다시 그린다
    done: null,      // { name, email }
  };
  const T = () => C[state.lang];
  const live = msg => { const el = $('#live'); if (el) { el.textContent = ''; setTimeout(() => { el.textContent = msg; }, 40); } };

  function radios(name, list, required) {
    return list.map(o => `<label class="t4-opt"><input type="radio" name="${name}" value="${esc(o.id)}"${required ? ' required' : ''}><span>${keepDots(o[state.lang])}</span></label>`).join('');
  }

  function render() {
    const t = T();
    document.documentElement.lang = t.htmlLang;
    document.title = t.title;
    const desc = $('meta[name="description"]');
    if (desc) desc.setAttribute('content', t.description);
    $$('[data-t]').forEach(el => { const v = t[el.dataset.t]; if (typeof v === 'string') el.innerHTML = keepDots(v); });
    $$('[data-t-attr]').forEach(el => el.dataset.tAttr.split(',').forEach(pair => { const [attr, key] = pair.split(':'); if (t[key] != null) el.setAttribute(attr, t[key]); }));
    $$('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));

    $('#facts').innerHTML = t.facts.map(([b, s]) => `<li><b>${keepDots(b)}</b><span>${keepDots(s)}</span></li>`).join('');
    $('#who-list').innerHTML = t.who.map(x => `<li>${keepDots(x)}</li>`).join('');
    $('#what-list').innerHTML = t.what.map(x => `<article class="t4-card"><p class="t4-k">${keepDots(x.k)}</p><h3>${keepDots(x.t)}</h3><p>${keepDots(x.d)}</p></article>`).join('');
    $('#weeks-list').innerHTML = C.WEEKS.map((w, i) => `<li><span class="t4-wk">${esc(t.weekLabel)} ${String(i + 1).padStart(2, '0')}</span><span class="t4-wt">${keepDots(w[state.lang])}</span><span class="t4-wg"><span class="sr">${esc(t.grammarLabel)}: </span><span lang="ko">${keepDots(w.grammar)}</span></span></li>`).join('');
    $('#terms-list').innerHTML = t.terms.map(x => `<div class="t4-term"><dt>${keepDots(x.b)}</dt><dd>${keepDots(x.d)}</dd></div>`).join('');
    $('#free-list').innerHTML = t.free.map(x => `<a class="t4-free-card" href="${esc(x.href)}" target="_blank" rel="noopener"><h3>${keepDots(x.t)}</h3><p>${keepDots(x.d)}</p><span class="t4-go">${esc(x.go)} <span aria-hidden="true">→</span></span></a>`).join('');

    // 선택지는 언어가 바뀌어도 고른 값을 지킨다.
    const keep = {};
    ['level', 'when', 'time'].forEach(n => { const c = $(`input[name="${n}"]:checked`); if (c) keep[n] = c.value; });
    $('#opt-level').innerHTML = radios('level', C.LEVELS, true);
    $('#opt-when').innerHTML = radios('when', C.WHEN, true);
    $('#opt-time').innerHTML = radios('time', C.TIMES, false);
    Object.entries(keep).forEach(([n, v]) => { const el = $(`input[name="${n}"][value="${v}"]`); if (el) el.checked = true; });
    showErrors();
    const se = $('#send-error');
    se.textContent = state.sendErr ? t[state.sendErr] : '';
    se.hidden = !state.sendErr;
    $('#share-state').textContent = state.share ? (state.share.key ? t[state.share.key] : state.share.url) : '';
    if (state.done) renderDone();
  }

  function values() {
    const f = $('#form');
    const val = n => { const c = $(`input[name="${n}"]:checked`, f); return c ? c.value : ''; };
    return {
      name: f.elements.name.value, email: f.elements.email.value, level: val('level'), when: val('when'), time: val('time'),
      note: f.elements.note.value, consent: f.elements.consent.checked, from: state.from, lang: state.lang,
    };
  }

  /** 오류 글·테두리·aria-invalid를 state.errors대로. 오류가 없는 칸은 aria-invalid를 지운다(처음부터 false를 찍지 않는다). */
  function showErrors() {
    const t = T();
    const err = state.errors;
    ['email', 'level', 'when', 'consent'].forEach(k => {
      const box = $(`#err-${k}`);
      if (box) { box.textContent = err[k] ? t[err[k]] : ''; box.hidden = !err[k]; }
      const field = $(`[data-field="${k}"]`);
      if (field) field.classList.toggle('bad', Boolean(err[k]));
      const inputs = k === 'email' ? [$('#f-email')] : k === 'consent' ? [$('#f-consent')] : $$(`input[name="${k}"]`);
      inputs.forEach(el => { if (!el) return; if (err[k]) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); });
    });
  }

  function renderDone() {
    const t = T();
    const v = state.done;
    const name = clip(v.name, 40);
    $('#done-title').textContent = name ? t.doneTitleNamed.replace('{name}', name) : t.doneTitle;
    $('#done-body').textContent = t.doneBody.replace('{email}', String(v.email || '').trim());
  }

  async function submit(e) {
    e.preventDefault();
    if (state.sending) return;
    const t = T();
    const f = $('#form');
    state.sendErr = '';
    $('#send-error').hidden = true;
    if (f.elements.website && f.elements.website.value) return; // 자동 입력 덫 칸 — 사람은 보지 못한다
    const v = values();
    const err = validate(v);
    if (!err.email && !$('#f-email').checkValidity()) err.email = 'errEmail';
    state.errors = err;
    showErrors();
    const first = Object.keys(err)[0];
    if (first) {
      const target = first === 'email' ? $('#f-email') : first === 'consent' ? $('#f-consent') : $(`input[name="${first}"]`);
      if (target) target.focus();
      live(t[err[first]]);
      return;
    }
    if (Date.now() - state.openedAt < 2500) { state.sendErr = 'errTooFast'; render(); live(t.errTooFast); return; }
    state.sending = true;
    const btn = $('#f-submit');
    btn.disabled = true;
    btn.textContent = t.sending;
    try {
      await fetch(C.FORM.action, { method: 'POST', mode: 'no-cors', body: buildPayload(v) });
      state.done = { name: v.name, email: v.email };
      f.hidden = true;
      $('#done').hidden = false;
      $('#signup').setAttribute('aria-labelledby', 'done-title');
      const dock = $('.t4-dock');
      if (dock) dock.hidden = true;
      renderDone();
      $('#done-title').focus();
    } catch (x) {
      state.sendErr = 'errSend';
      render();
      live(t.errSend);
    } finally {
      state.sending = false;
      btn.disabled = false;
      btn.textContent = T().submit;
    }
  }

  /** 완료 판 → 다시 등록(이메일을 잘못 적었을 때). 다른 답은 그대로 두고 이메일 칸으로 간다. */
  function again() {
    state.done = null;
    state.share = null;
    $('#done').hidden = true;
    const f = $('#form');
    f.hidden = false;
    f.elements.consent.checked = false;
    $('#signup').setAttribute('aria-labelledby', 'form-title');
    const dock = $('.t4-dock');
    if (dock) dock.hidden = false;
    state.openedAt = Date.now() - 2500;
    render();
    $('#f-email').focus();
    $('#f-email').select();
  }

  async function share() {
    const t = T();
    const url = shareUrl(location.href, state.lang);
    try {
      if (navigator.share) { await navigator.share({ title: t.title, text: t.shareText, url }); return; }
    } catch (x) { if (x && x.name === 'AbortError') return; }
    try {
      await navigator.clipboard.writeText(url);
      state.share = { key: 'copied' };
      live(t.copied);
    } catch (x) {
      state.share = { url };
    }
    $('#share-state').textContent = state.share.key ? t[state.share.key] : state.share.url;
  }

  function setLang(lang) {
    if (!C.LANGS.includes(lang) || lang === state.lang) return;
    state.lang = lang;
    const u = new URL(location.href);
    u.searchParams.set('lang', lang);
    history.replaceState(null, '', u.toString());
    render();
  }

  function goForm(e) {
    const target = $('#signup');
    if (!target) return;
    e.preventDefault();
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    const first = $('#form').hidden ? $('#done-title') : $('#f-name');
    setTimeout(() => first && first.focus({ preventScroll: true }), reduce ? 0 : 420);
  }

  function start() {
    render();
    $$('[data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
    $$('[data-go-form]').forEach(a => a.addEventListener('click', goForm));
    $('#form').addEventListener('submit', submit);
    $('#form').addEventListener('change', () => { if (Object.keys(state.errors).length) { state.errors = validate(values()); showErrors(); } });
    $('#share').addEventListener('click', share);
    $('#again').addEventListener('click', again);
    // 휴대폰 아래 단추: 등록 판이 화면에 보이면 숨긴다(숨은 동안은 초점도 받지 않게 CSS가 visibility로 감춘다).
    const dock = $('.t4-dock');
    if (dock && 'IntersectionObserver' in window) {
      new IntersectionObserver(es => es.forEach(x => dock.classList.toggle('away', x.isIntersecting)), { rootMargin: '0px 0px -20% 0px' }).observe($('#signup'));
    }
    document.documentElement.classList.add('js');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  return api;
});
