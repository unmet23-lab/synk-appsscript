/* SYNK · 울란바토르 한국 유학 준비 관심 등록 — 화면 동작.
 * 원본: SYNK-appsscript/experiences/ub-korea/src/app.js
 * 하는 일: 화면 언어 고르기(?lang → 기기 언어가 한국어면 한국어 → 몽골어), 들어온 곳 표시(?from), 목록 그리기, 관심 등록 보내기.
 * 보내기: 홈페이지 문의 구글 폼(copy.js FORM)에 바로 보낸다. 회사 서버가 그 폼을 5분마다 모아 분류·답변 초안·할 일로 만든다.
 *   고른 갈래(학원·유학 상담)마다 응답을 하나씩 보낸다 — 문의 유형이 달라 서버가 따로 분류하고, 첫 줄 표식으로 갈래별 등록을 센다.
 *   no-cors라 응답을 읽지 못한다 — 요청이 네트워크에서 끝나면 접수로 본다. 둘 중 하나만 끝나고 끊기면 다시 누를 때 남은 것만 보낸다.
 *   그래서 이메일은 폼보다 깐깐하게 미리 보고, 완료 판에 「다시 등록하기」와 문의 주소를 둔다.
 * 보내는 것: 사용자가 적은 칸 + 들어온 링크 표시(from) + 화면 언어. 앞 사이트 주소는 보내지 않는다(안내문과 맞춤).
 * 기록: 이 기기에는 아무것도 남기지 않는다(화면 언어만 주소에 남긴다).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./copy.js'));
  else root.SynkUb = factory(root.SynkUbCopy);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 「·」로 이은 말은 한 덩어리로(word-break:keep-all이 「·」 앞뒤에서 줄을 가른다 — 시그널 도구와 같은 규칙).
  // 몽골어 서수 「3-р」·「1–2-р」, 요일 묶음 「Даваа–Баасан」도 하이픈에서 갈리지 않게 묶는다.
  const keepDots = s => esc(s)
    .replace(/[^\s·]+(?:·[^\s·]+)+/g, m => `<span class="nw">${m}</span>`)
    .replace(/\d+(?:[–-]\d+)?-[а-яёөү]+/gi, m => `<span class="nw">${m}</span>`)
    .replace(/[А-ЯЁӨҮ][а-яёөү]+–[А-ЯЁӨҮ][а-яёөү]+/g, m => `<span class="nw">${m}</span>`);

  /** 화면 언어: 주소의 ?lang이 먼저, 없으면 기기 언어에 한국어가 있으면 한국어, 아니면 몽골어(울란바토르 기기는 영어·러시아어도 많다). */
  function pickLang(search, navLangs) {
    const q = new URLSearchParams(search || '').get('lang');
    if (q && C.LANGS.includes(q)) return q;
    const list = (navLangs || []).map(x => String(x || '').toLowerCase());
    return list.some(x => x === 'ko' || x.startsWith('ko-')) ? 'ko' : 'mn';
  }

  /** 들어온 곳(?from): 게시물·학교·기관마다 다른 짧은 이름. 영소문자·숫자·하이픈 40자까지만 받고, 아니면 direct. */
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
  // 궁금한 점은 한 줄로 편다 — 문의 내용은 한 줄에 한 칸이라 줄바꿈이 다른 칸처럼 보이지 않게(10-21 아르곤 검수)
  const noteText = s => clip(String(s || '').replace(/\s*[\r\n]+\s*/g, ' / '), 300);
  const pick = (list, id) => list.find(x => x.id === id);
  const branch = id => pick(C.BRANCHES, id);

  /** 고른 갈래 — 화면에 늘어놓은 순서(학원 → 유학 상담)로, 모르는 값은 버린다. */
  function selectedBranches(v) {
    const set = new Set(Array.isArray(v.interest) ? v.interest : []);
    return C.BRANCHES.filter(b => set.has(b.id)).map(b => b.id);
  }

  /** 아직 안 보낸 갈래(앞서 하나만 끝나고 끊겼으면 남은 것만). */
  function pendingBranches(selected, sent) {
    const done = new Set(sent || []);
    return (selected || []).filter(id => !done.has(id));
  }

  /** 빈칸·잘못된 칸 → { 칸: 오류 글 키 }. 이름·다니기 좋은 때·생각하는 유학·궁금한 점은 선택이다.
   *  양식에 놓인 순서대로 본다 — 첫 오류 칸으로 초점을 옮기므로 맨 위 칸이 먼저여야 한다. */
  function validate(v) {
    const err = {};
    if (!selectedBranches(v).length) err.interest = 'errInterest';
    if (!pick(C.WHO, v.who)) err.who = 'errPick';
    if (!pick(C.LEVELS, v.level)) err.level = 'errPick';
    if (!pick(C.WHEN, v.when)) err.when = 'errPick';
    if (!validEmail(v.email)) err.email = 'errEmail';
    if (v.consent !== true) err.consent = 'errConsent';
    return err;
  }

  /** 폼의 「문의 내용」 칸에 들어갈 글(갈래 하나). 받는 쪽이 한국어로 읽고, 첫 줄 표식으로 갈래별 등록을 거른다. */
  function buildBody(v, branchId) {
    const b = branch(branchId);
    if (!b) throw new Error(`모르는 갈래: ${branchId}`);
    const who = pick(C.WHO, v.who);
    const level = pick(C.LEVELS, v.level);
    const when = pick(C.WHEN, v.when);
    const lines = [
      b.marker,
      `이름: ${clip(v.name, 40) || '(안 적음)'}`,
      `누가 적었나: ${who ? who.record : '(안 고름)'}`,
      `학생 한국어: ${level ? level.record : '(안 고름)'}`,
      `한국에 가려는 때: ${when ? when.record : '(안 고름)'}`,
    ];
    if (b.id === 'academy') {
      const times = C.TIMES.filter(t => (v.times || []).includes(t.id)).map(t => t.record);
      lines.push(`다니기 좋은 때: ${times.length ? times.join(' · ') : '(안 고름)'}`);
    }
    if (b.id === 'consult') {
      const study = pick(C.STUDY, v.study);
      lines.push(`생각하는 유학: ${study ? study.record : '(안 고름)'}`);
    }
    const others = selectedBranches(v).filter(id => id !== b.id).map(id => branch(id).record);
    if (others.length) lines.push(`함께 등록: ${others.join(' · ')}`);
    const note = noteText(v.note);
    if (note) lines.push(`궁금한 점: ${note}`);
    lines.push(`들어온 곳: ${v.from || 'direct'} · 화면 언어 ${v.lang === 'ko' ? '한국어' : '몽골어'}`);
    // 앞 응답과 짝지을 수 있게 앞서 보낸 이메일을 적는다(같은 이메일이면 그렇다고) — 셀 때 앞 등록을 버린다
    if (v.resubmit) {
      const prev = String(v.prevEmail || '').trim();
      const same = !prev || prev.toLowerCase() === String(v.email || '').trim().toLowerCase();
      lines.push(`다시 등록: 앞서 ${same ? '같은 이메일' : prev}로 보낸 등록을 고쳐 다시 보냄(앞 등록은 버림)`);
    }
    return lines.join('\n');
  }

  /** 보낸 뒤 바뀌었는지 볼 답의 지문 — 둘 중 하나만 보내고 끊긴 뒤 답을 바꾸면 고른 갈래를 모두 「다시 등록」으로 보낸다. */
  function answerKey(v) {
    return JSON.stringify([String(v.email || '').trim().toLowerCase(), selectedBranches(v), v.who || '', v.level || '', v.when || '', v.times || [], v.study || '', clip(v.name, 40), noteText(v.note)]);
  }

  /** 구글 폼 formResponse에 보낼 값(갈래 하나). 문의 유형은 그 갈래의 선택지, 동의는 폼 선택지 글 그대로(화면에서 고른 경우에만 부른다). */
  function buildPayload(v, branchId) {
    const b = branch(branchId);
    if (!b) throw new Error(`모르는 갈래: ${branchId}`);
    const p = new URLSearchParams();
    p.set(C.FORM.email, String(v.email || '').trim());
    p.set(C.FORM.type, b.typeValue);
    p.set(C.FORM.body, buildBody(v, branchId));
    p.set(C.FORM.consent, C.FORM.consentValue);
    p.set('fvv', '1');
    p.set('pageHistory', '0');
    return p;
  }

  /** 완료 판 글의 갈래 키 — 하나면 그 갈래, 둘이면 both. */
  function doneKey(selected) {
    return selected.length > 1 ? 'both' : (selected[0] || 'academy');
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

  /** 한국에 있는 유학생용 TOPIK 4급 반 — 이 페이지에서 건너간 것을 따로 센다. */
  function topikUrl(lang) {
    return `https://synk.im/lab/topik4/?from=ub-page&lang=${lang === 'ko' ? 'ko' : 'mn'}`;
  }

  const api = { pickLang, fromKey, validEmail, validate, selectedBranches, pendingBranches, buildBody, buildPayload, answerKey, doneKey, shareUrl, topikUrl, keepDots };
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
    done: null,      // { name, email, selected }
    resubmit: false, // 「이메일을 고쳐 다시 등록하기」 뒤의 등록, 또는 일부만 보낸 뒤 답을 바꾼 등록
    prevEmail: '',   // 다시 등록할 때 앞서 보낸 이메일(문의 내용의 「다시 등록」 줄에 적는다)
    sent: [],        // 이번 등록에서 이미 보낸 갈래(끊긴 뒤 같은 답으로 다시 누르면 남은 것만)
    sentEmail: '',   // 위 갈래를 보낸 이메일
    sentKey: '',     // 위 갈래를 보낸 답의 지문(answerKey) — 바뀌면 처음부터 「다시 등록」으로
  };
  const T = () => C[state.lang];
  const live = msg => { const el = $('#live'); if (el) { el.textContent = ''; setTimeout(() => { el.textContent = msg; }, 40); } };

  // 꼭 고를 칸은 fieldset의 aria-required로 알린다 — 입력마다 required를 달면 보내기 전부터 :invalid로 읽힌다(10-21 아르곤 검수).
  function choices(type, name, list) {
    const cls = type === 'checkbox' ? 'ub-opt multi' : 'ub-opt';
    return list.map(o => `<label class="${cls}"><input type="${type}" name="${name}" value="${esc(o.id)}"><span>${keepDots(o[state.lang])}</span></label>`).join('');
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
    C.BRANCHES.forEach(b => {
      const w = t.what[b.id];
      const card = $(`[data-branch-card="${b.id}"]`);
      if (!card) return;
      $('.ub-k', card).innerHTML = keepDots(w.k);
      $('h3', card).innerHTML = keepDots(w.t);
      $('.ub-d', card).innerHTML = keepDots(w.d);
      $('.ub-go', card).innerHTML = `${keepDots(w.go)} <span aria-hidden="true">→</span>`;
    });
    $('#who-list').innerHTML = t.who.map(x => `<li>${keepDots(x)}</li>`).join('');
    $('#topik-link').setAttribute('href', topikUrl(state.lang));
    $('#terms-list').innerHTML = t.terms.map(x => `<div class="ub-term"><dt>${keepDots(x.b)}</dt><dd>${keepDots(x.d)}</dd></div>`).join('');
    $('#free-list').innerHTML = t.free.map(x => `<a class="ub-free-card" href="${esc(x.href)}" target="_blank" rel="noopener"><h3>${keepDots(x.t)}</h3><p>${keepDots(x.d)}</p><span class="ub-go">${esc(x.go)} <span aria-hidden="true">→</span></span></a>`).join('');

    // 선택지는 언어가 바뀌어도 고른 값을 지킨다.
    const keep = {};
    ['interest', 'who', 'level', 'when', 'times', 'study'].forEach(n => { keep[n] = $$(`input[name="${n}"]:checked`).map(c => c.value); });
    $('#opt-interest').innerHTML = choices('checkbox', 'interest', C.BRANCHES);
    $('#opt-who').innerHTML = choices('radio', 'who', C.WHO);
    $('#opt-level').innerHTML = choices('radio', 'level', C.LEVELS);
    $('#opt-when').innerHTML = choices('radio', 'when', C.WHEN);
    $('#opt-times').innerHTML = choices('checkbox', 'times', C.TIMES);
    $('#opt-study').innerHTML = choices('radio', 'study', C.STUDY);
    Object.entries(keep).forEach(([n, vals]) => vals.forEach(v => { const el = $(`input[name="${n}"][value="${v}"]`); if (el) el.checked = true; }));
    syncBranchFields();
    markChecked();
    showErrors();
    const se = $('#send-error');
    se.textContent = state.sendErr ? t[state.sendErr] : '';
    se.hidden = !state.sendErr;
    $('#share-state').textContent = state.share ? (state.share.key ? t[state.share.key] : state.share.url) : '';
    if (state.done) renderDone();
  }

  function values() {
    const f = $('#form');
    const one = n => { const c = $(`input[name="${n}"]:checked`, f); return c ? c.value : ''; };
    const many = n => $$(`input[name="${n}"]:checked`, f).map(c => c.value);
    const interest = many('interest');
    return {
      name: f.elements.name.value, email: f.elements.email.value, interest, who: one('who'), level: one('level'), when: one('when'),
      times: interest.includes('academy') ? many('times') : [], study: interest.includes('consult') ? one('study') : '',
      note: f.elements.note.value, consent: f.elements.consent.checked, from: state.from, lang: state.lang, resubmit: state.resubmit, prevEmail: state.prevEmail,
    };
  }

  /** 갈래에 딸린 칸(다니기 좋은 때 · 생각하는 유학)은 그 갈래를 골랐을 때만 보인다. */
  function syncBranchFields() {
    const picked = new Set($$('input[name="interest"]:checked').map(c => c.value));
    $$('[data-for-branch]').forEach(el => { el.hidden = !picked.has(el.dataset.forBranch); });
  }

  /** 고른 선택지 칸에 on — :has()를 못 쓰는 브라우저에서도 고른 칸이 보이게. */
  function markChecked() {
    $$('.ub-opt').forEach(l => { const i = l.querySelector('input'); l.classList.toggle('on', Boolean(i && i.checked)); });
  }

  /** 오류 글·테두리·aria-invalid를 state.errors대로. 오류가 없는 칸은 aria-invalid를 지운다(처음부터 false를 찍지 않는다). */
  function showErrors() {
    const t = T();
    const err = state.errors;
    ['email', 'interest', 'who', 'level', 'when', 'consent'].forEach(k => {
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
    $('#done-body').textContent = t.doneBody[doneKey(v.selected)].replace('{email}', String(v.email || '').trim());
  }

  async function submit(e) {
    e.preventDefault();
    if (state.sending) return;
    const t = T();
    const f = $('#form');
    state.sendErr = '';
    $('#send-error').hidden = true;
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
    const email = String(v.email || '').trim();
    const key = answerKey(v);
    // 하나만 보내고 끊긴 뒤 답(이메일·갈래·문항)을 바꿨으면 남은 것만 보내면 두 응답이 어긋난다 — 고른 갈래를 모두 「다시 등록」으로 보낸다
    if (state.sent.length && state.sentKey !== key) {
      state.resubmit = true;
      state.prevEmail = state.sentEmail;
      state.sent = [];
      v.resubmit = true;
      v.prevEmail = state.prevEmail;
    }
    const selected = selectedBranches(v);
    state.sending = true;
    const btn = $('#f-submit');
    btn.disabled = true;
    btn.textContent = t.sending;
    try {
      for (const id of pendingBranches(selected, state.sent)) {
        await fetch(C.FORM.action, { method: 'POST', mode: 'no-cors', body: buildPayload(v, id) });
        state.sent.push(id);
        state.sentEmail = email;
        state.sentKey = key;
      }
      state.done = { name: v.name, email: v.email, selected };
      state.sent = [];
      state.sentEmail = '';
      state.sentKey = '';
      f.hidden = true;
      $('#done').hidden = false;
      $('#signup').setAttribute('aria-labelledby', 'done-title');
      const dock = $('.ub-dock');
      if (dock) dock.hidden = true;
      heroPill(false);
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
      if (state.sendErr) btn.focus(); // disabled로 잃은 초점을 되돌린다
    }
  }

  /** 첫 화면 단추: 등록을 마치면 선 알약으로 — 완료 판의 「링크 보내기」와 흰 알약이 한 화면에 둘 보이지 않게(10-22 Fable 검수, 1440×900에서 783px 거리). */
  function heroPill(on) {
    const b = $('.ub-actions [data-go-form]');
    if (!b) return;
    b.classList.toggle('primary', on);
    b.classList.toggle('soft', !on);
  }

  /** 완료 판 → 다시 등록(이메일을 잘못 적었을 때). 다른 답은 그대로 두고 이메일 칸으로 간다. */
  function again() {
    state.prevEmail = state.done ? String(state.done.email || '').trim() : state.prevEmail;
    state.done = null;
    state.share = null;
    state.resubmit = true;
    state.sent = [];
    state.sentEmail = '';
    state.sentKey = '';
    $('#done').hidden = true;
    const f = $('#form');
    f.hidden = false;
    f.elements.consent.checked = false;
    $('#signup').setAttribute('aria-labelledby', 'form-title');
    const dock = $('.ub-dock');
    if (dock) dock.hidden = false;
    heroPill(true);
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

  /** 등록 판으로 — 갈래 카드의 단추면 그 갈래를 골라 둔다(이미 고른 다른 갈래는 그대로). */
  function goForm(e) {
    const target = $('#signup');
    if (!target) return;
    e.preventDefault();
    const want = e.currentTarget.dataset.pick;
    if (want && !$('#form').hidden) {
      const box = $(`input[name="interest"][value="${want}"]`);
      if (box && !box.checked) { box.checked = true; syncBranchFields(); markChecked(); if (Object.keys(state.errors).length) { state.errors = validate(values()); showErrors(); } }
    }
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    // 갈래 단추가 아니면 양식 제목으로 — 이름 칸으로 가면 위의 꼭 고를 칸 넷을 건너뛰고, 휴대폰에서는 자판이 올라와 가린다(10-21 아르곤 검수)
    const first = $('#form').hidden ? $('#done-title') : want ? $(`input[name="interest"][value="${want}"]`) : $('#form-title');
    setTimeout(() => first && first.focus({ preventScroll: true }), reduce ? 0 : 420);
  }

  function start() {
    render();
    $$('[data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
    $$('[data-go-form]').forEach(a => a.addEventListener('click', goForm));
    $('#form').addEventListener('submit', submit);
    // 오류가 난 뒤에는 입력하는 동안 다시 본다 — change(blur)에서만 보면 고친 뒤 첫 클릭 순간 오류 줄이 사라지며 단추가 움직여 클릭이 빗나간다.
    const recheck = () => { syncBranchFields(); markChecked(); if (Object.keys(state.errors).length) { state.errors = validate(values()); showErrors(); } };
    $('#form').addEventListener('input', recheck);
    $('#form').addEventListener('change', recheck);
    $('#share').addEventListener('click', share);
    $('#again').addEventListener('click', again);
    // 휴대폰 아래 단추: 등록 판이나 첫 화면의 흰 단추가 보이면 숨긴다 — 흰 알약은 한 화면에 하나(숨은 동안은 초점도 받지 않게 CSS가 visibility로 감춘다).
    const dock = $('.ub-dock');
    if (dock && 'IntersectionObserver' in window) {
      const seen = new Set();
      // 아래 여백을 줄이지 않는다 — 대상이 화면 아래 끝에 들어오는 순간 숨겨야 흰 알약 둘이 함께 보이지 않는다(10-21 아르곤 검수)
      const io = new IntersectionObserver(es => {
        es.forEach(x => { if (x.isIntersecting) seen.add(x.target); else seen.delete(x.target); });
        dock.classList.toggle('away', seen.size > 0);
      }, { rootMargin: '0px' });
      io.observe($('#signup'));
      io.observe($('.ub-actions'));
    }
    document.documentElement.classList.add('js');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  return api;
});
