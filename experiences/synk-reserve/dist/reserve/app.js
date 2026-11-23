/* SYNK 사전예약 — 화면 동작.
 * 원본: SYNK-appsscript/experiences/synk-reserve/src/app.js
 * 하는 일: 화면 언어 고르기(?lang → 기기 언어 → 영어), 들어온 곳(?from), 철수한 TOPIK 4급 반에서 온 사람에게 안내(?notice=topik4), 사전예약 보내기.
 * 보내기: 홈페이지 문의 구글 폼(copy.js FORM)의 formResponse에 바로 보낸다(no-cors라 응답을 못 읽는다 — 요청이 끝나면 접수로 본다).
 *   그래서 이메일은 폼보다 깐깐하게 미리 보고, 완료 판에 「다시 적기」와 문의 주소를 둔다.
 * 문의 내용(받는 쪽 website-inquiry-registration.mjs의 app-reserve가 이 꼴만 「사전예약」으로 센다):
 *   [SYNK 사전예약]
 *   관심: 한국어 · 유학          (안 골랐으면 「(안 고름)」)
 *   들어온 곳: <from> · 화면 언어 한국어|영어|몽골어
 *   다시 등록: …                 (이메일을 고쳐 다시 보낸 때만)
 * 기록: 이 기기에는 아무것도 남기지 않는다(화면 언어만 주소에 남긴다).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./copy.js'));
  else root.SynkReserve = factory(root.SynkReserveCopy);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 몽골어 서수 「2-р」와 「TOPIK-ийн」처럼 숫자 · 라틴 낱말에 붙은 키릴 어미가 하이픈에서 갈리지 않게 묶는다.
  const keep = s => esc(s).replace(/(?:\d+|[A-Za-z]+)-[а-яёөүА-ЯЁӨҮ]+/g, m => `<span class="nw">${m}</span>`);

  /** 화면 언어: ?lang이 먼저, 없으면 기기 언어(몽골어 → 몽골어, 한국어 → 한국어), 아니면 영어. */
  function pickLang(search, navLangs) {
    const q = new URLSearchParams(search || '').get('lang');
    if (q && C.LANGS.includes(q)) return q;
    for (const raw of navLangs || []) {
      const x = String(raw || '').toLowerCase();
      if (x === 'mn' || x.startsWith('mn-')) return 'mn';
      if (x === 'ko' || x.startsWith('ko-')) return 'ko';
    }
    return 'en';
  }

  /** 들어온 곳(?from): 영소문자 · 숫자 · 하이픈 40자까지만 받고, 아니면 direct. */
  function fromKey(search) {
    const raw = String(new URLSearchParams(search || '').get('from') || '').trim().toLowerCase();
    return /^[a-z0-9][a-z0-9-]{0,39}$/.test(raw) ? raw : 'direct';
  }

  /** 이메일: 구글 폼과 <input type="email">이 거절할 꼴을 미리 막는다. @ 앞은 브라우저와 같은 ASCII 글자만 받는다
   * (한글 · 키릴이 섞이면 checkValidity와 판정이 어긋나 오류 줄이 사라졌다 다시 뜬다 — 11-23 검수). */
  function validEmail(s) {
    const v = String(s || '').trim();
    const m = /^([a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64})@((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24})$/i.exec(v);
    if (!m || v.length > 254) return false;
    return !/^\.|\.$|\.\./.test(m[1]);
  }

  function validate(v) {
    const err = {};
    if (!validEmail(v.email)) err.email = 'errEmail';
    if (v.consent !== true) err.consent = 'errConsent';
    return err;
  }

  /** 고른 관심 → 「한국어 · 유학」. 목록 순서를 따르고 모르는 값은 버린다. 하나도 없으면 「(안 고름)」. */
  function interestRecord(ids) {
    const set = new Set(ids || []);
    const picked = C.INTERESTS.filter(x => set.has(x.id)).map(x => x.record);
    return picked.length ? picked.join(' · ') : '(안 고름)';
  }

  function buildBody(v) {
    const lines = [
      C.FORM.marker,
      `관심: ${interestRecord(v.interests)}`,
      `들어온 곳: ${v.from || 'direct'} · 화면 언어 ${(C[v.lang] || C.en).record}`,
    ];
    // 앞 응답과 짝지을 수 있게 앞서 보낸 이메일을 적는다(/ub/와 같은 꼴). 셀 때와 출시 안내 때 앞 등록을 버린다.
    if (v.resubmit) {
      const prev = String(v.prevEmail || '').trim();
      const same = !prev || prev.toLowerCase() === String(v.email || '').trim().toLowerCase();
      lines.push(`다시 등록: 앞서 ${same ? '같은 이메일' : prev}로 보낸 사전예약을 고쳐 다시 보냄(앞 등록은 버림)`);
    }
    return lines.join('\n');
  }

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

  /** 친구에게 보낼 주소 — 들어온 곳은 friend, 화면 언어는 그대로, 안내 띠(notice)는 뺀다. */
  function shareUrl(base, lang) {
    const u = new URL(base);
    u.search = '';
    u.hash = '';
    u.searchParams.set('from', 'friend');
    u.searchParams.set('lang', lang);
    return u.toString();
  }

  function worldUrl(lang) {
    return `/world/?lang=${lang}`;
  }

  const api = { pickLang, fromKey, validEmail, validate, interestRecord, buildBody, buildPayload, shareUrl, worldUrl };
  if (typeof document === 'undefined') return api;

  /* ───────── 화면 ───────── */
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const params = new URLSearchParams(location.search);
  const state = {
    lang: pickLang(location.search, navigator.languages || [navigator.language]),
    from: fromKey(location.search),
    notice: params.get('notice') === 'topik4',
    openedAt: Date.now(),
    sending: false,
    errors: {},
    sendErr: '',
    share: null,
    done: null,
    resubmit: false,
    prevEmail: '',
  };
  const T = () => C[state.lang];
  const live = msg => { const el = $('#live'); if (el) { el.textContent = ''; setTimeout(() => { el.textContent = msg; }, 40); } };

  function render() {
    const t = T();
    document.documentElement.lang = t.htmlLang;
    document.title = t.title;
    const desc = $('meta[name="description"]');
    if (desc) desc.setAttribute('content', t.description);
    $$('[data-t]').forEach(el => { const v = t[el.dataset.t]; if (typeof v === 'string') el.innerHTML = keep(v); });
    $$('[data-t-attr]').forEach(el => el.dataset.tAttr.split(',').forEach(pair => { const [attr, key] = pair.split(':'); if (t[key] != null) el.setAttribute(attr, t[key]); }));
    $$('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
    $('#notice').hidden = !state.notice;
    $('#world-go').setAttribute('href', worldUrl(state.lang));

    const picked = new Set($$('input[name="interest"]:checked').map(i => i.value));
    $('#opt-interest').innerHTML = C.INTERESTS.map(o =>
      `<label class="rs-chip"><input type="checkbox" name="interest" value="${esc(o.id)}"${picked.has(o.id) ? ' checked' : ''}><span>${keep(o[state.lang])}</span></label>`).join('');
    markChecked();
    showErrors();
    const se = $('#send-error');
    se.textContent = state.sendErr ? t[state.sendErr] : '';
    se.hidden = !state.sendErr;
    showShare();
    if (state.done) renderDone();
  }

  function values() {
    const f = $('#form');
    return {
      email: f.elements.email.value,
      interests: $$('input[name="interest"]:checked', f).map(i => i.value),
      consent: f.elements.consent.checked,
      from: state.from, lang: state.lang, resubmit: state.resubmit, prevEmail: state.prevEmail,
    };
  }

  /** 고른 칸에 on — :has()를 못 쓰는 브라우저에서도 고른 칸이 보이게. */
  function markChecked() {
    $$('.rs-chip').forEach(l => { const i = l.querySelector('input'); l.classList.toggle('on', Boolean(i && i.checked)); });
  }

  function showErrors() {
    const t = T();
    const err = state.errors;
    ['email', 'consent'].forEach(k => {
      const box = $(`#err-${k}`);
      if (box) { box.textContent = err[k] ? t[err[k]] : ''; box.hidden = !err[k]; }
      const field = $(`[data-field="${k}"]`);
      if (field) field.classList.toggle('bad', Boolean(err[k]));
      const el = k === 'email' ? $('#f-email') : $('#f-consent');
      if (err[k]) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    });
  }

  function renderDone() {
    // 함수로 끼운다 — 문자열로 넘기면 이메일 속 $&·$$ 같은 글자가 치환 패턴으로 읽힌다(11-23 검수).
    const email = String(state.done.email || '').trim();
    $('#done-body').textContent = T().doneBody.replace('{email}', () => email);
  }

  async function submit(e) {
    e.preventDefault();
    if (state.sending) return;
    const t = T();
    state.sendErr = '';
    $('#send-error').hidden = true;
    const v = values();
    const err = validate(v);
    if (!err.email && !$('#f-email').checkValidity()) err.email = 'errEmail';
    state.errors = err;
    showErrors();
    const first = Object.keys(err)[0];
    if (first) {
      (first === 'email' ? $('#f-email') : $('#f-consent')).focus();
      live(t[err[first]]);
      return;
    }
    if (Date.now() - state.openedAt < 2000) { state.sendErr = 'errTooFast'; render(); live(t.errTooFast); return; }
    state.sending = true;
    const btn = $('#f-submit');
    btn.disabled = true;
    btn.textContent = t.sending;
    try {
      await fetch(C.FORM.action, { method: 'POST', mode: 'no-cors', body: buildPayload(v) });
      state.done = { email: v.email };
      $('#form').hidden = true;
      $('#done').hidden = false;
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
      if (state.sendErr) btn.focus();
    }
  }

  /** 완료 판 → 다시 적기(이메일을 잘못 적었을 때). 고른 관심은 그대로 두고 이메일 칸으로 간다. */
  function again() {
    if (state.done) state.prevEmail = String(state.done.email || '').trim();
    state.done = null;
    state.share = null;
    state.resubmit = true;
    $('#done').hidden = true;
    const f = $('#form');
    f.hidden = false;
    f.elements.consent.checked = false;
    state.openedAt = Date.now() - 2000;
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
    } catch (x) {
      state.share = { url };
    }
    showShare();
  }

  /** 친구에게 보내기 결과 줄. 빈 줄은 숨겨 완료 판 아래에 빈 칸이 생기지 않게 한다(11-23 검수). */
  function showShare() {
    const el = $('#share-state');
    const t = T();
    el.textContent = state.share ? (state.share.key ? t[state.share.key] : state.share.url) : '';
    el.hidden = !el.textContent;
  }

  function setLang(lang) {
    if (!C.LANGS.includes(lang) || lang === state.lang) return;
    state.lang = lang;
    const u = new URL(location.href);
    u.searchParams.set('lang', lang);
    history.replaceState(null, '', u.toString());
    render();
  }

  function start() {
    render();
    $$('[data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
    $('#form').addEventListener('submit', submit);
    // 오류가 난 뒤에는 입력하는 동안 다시 본다(고친 뒤 첫 클릭 순간 오류 줄이 사라지며 단추가 움직이지 않게).
    const recheck = () => { markChecked(); if (Object.keys(state.errors).length) { state.errors = validate(values()); showErrors(); } };
    $('#form').addEventListener('input', recheck);
    $('#form').addEventListener('change', recheck);
    $('#share').addEventListener('click', share);
    $('#again').addEventListener('click', again);
    document.documentElement.classList.add('js');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  return api;
});
