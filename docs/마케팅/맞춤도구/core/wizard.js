/* SYNK 맞춤 도구 — 질문 흐름 공통 엔진.
 * 원본: SYNK-appsscript/docs/마케팅/맞춤도구/core/wizard.js
 * 도구 하나 = content(질문·문장) + rules(계산) + view(그림·결과). 이 파일은 셋을 이어 화면을 만든다.
 * 네트워크·AI 호출이 없다. 고른 답과 Atlas 기록은 이 기기의 localStorage에만 둔다.
 * Atlas(atlas/engine.js)가 없거나 저장이 막힌 브라우저에서도 기본값으로 끝까지 동작한다.
 * 예외 하나: 'SYNK 설정 불러오기'를 누르면 core/account.js가 SYNK 계정에서 본인이 고른 설정만 읽어 온다.
 * 이 도구에서 직접 정한 것(팁 스위치, 결과 분량 반응)이 있으면 그쪽이 이긴다.
 */
(function (root) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* 저장이 막힌 브라우저 */ } },
  };
  const reduced = () => { try { return document.documentElement.classList.contains('synk-motion-reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  // SYNK 계정에서 고른 설명 길이 → 결과 분량(간단히·기본·자세히).
  const ACCOUNT_LAYOUT = Object.freeze({ brief: 'quick', standard: 'guided', detailed: 'deep' });
  const ICON = {
    check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  // Atlas 기억: 도움 방식(팁 켬·끔)은 같은 채널의 다른 도구에도 이어지고, 결과 분량은 이 도구의 반응으로 조정된다.
  function memory(scope) {
    const key = `synk.atlas.v2.${scope.domain}.${scope.workspace}`;
    const A = root.SynkAtlas;
    let session = null;
    if (A) {
      try { session = A.createSession({ scope, events: store.get(key, []) }); }
      catch { store.del(key); try { session = A.createSession({ scope }); } catch { session = null; } }
    }
    const save = () => { if (session) store.set(key, session.events()); };
    const safe = (fn, fallback = null) => { try { const v = fn(); save(); return v; } catch { return fallback; } };
    return {
      ok: !!session,
      support: () => { try { return session ? session.state().context.support || null : null; } catch { return null; } },
      setSupport: v => safe(() => session && session.set('support', v)),
      plan: (id, candidates) => safe(() => { const p = session && session.plan(id, candidates); return p && p.status === 'ready' ? p : null; }),
      // 기록을 남기지 않고 지금 기억으로 무엇을 고를지만 본다(새로고침으로 다시 연 결과).
      peek: (id, candidates) => { try { if (!session) return null; const p = A.decide({ events: session.events(), scope, at: new Date().toISOString(), experienceId: id, candidates }); return p && p.status === 'ready' ? p : null; } catch { return null; } },
      complete: plan => safe(() => (session && plan ? session.complete(plan) : null)),
      feedback: (completionId, value) => safe(() => (session && completionId ? session.feedback(completionId, value) : null)),
      clear: () => { try { if (session) session.clear(); } catch { /* 없음 */ } store.del(key); },
    };
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* 권한이 막힌 인앱 브라우저 */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove(); return ok;
  }
  // 복사 알림(토스·당근처럼 하단에 잠깐). 화면 낭독기는 알림 줄(say)이 읽으므로 여기선 숨긴다.
  let toastTimer = null;
  function toast(text) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('aria-hidden', 'true'); document.body.appendChild(t); }
    t.textContent = text; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }
  const encode = obj => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const decode = str => { try { return JSON.parse(decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))))); } catch { return null; } };

  function start(cfg) {
    const el = cfg.root, tool = cfg.tool, C = tool.content, R = tool.rules, V = tool.view;
    const KEY = `synk.tool.${tool.id}`;
    const mem = memory(tool.scope);
    const live = document.getElementById(cfg.liveId || 'live');
    const say = msg => { if (live) { live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 30); } };
    let state = { answers: {}, at: 'intro', checks: {} };
    const saved = store.get(KEY, null);
    const fromHash = /^#r=/.test(location.hash) ? decode(location.hash.slice(3)) : null;
    if (fromHash && typeof fromHash === 'object') state = { answers: R.sanitize(fromHash), at: 'result', checks: {} };
    else if (saved && saved.v === C.version && saved.answers) state = { answers: R.sanitize(saved.answers), at: saved.at || 'intro', checks: saved.checks || {} };
    // SYNK 계정에서 불러온 고른 설정(있으면). 이 도구의 팁 스위치를 한 번도 안 건드렸을 때만 팁을 정한다.
    const account = root.SynkToolAccount || null;
    let chosen = account ? account.read() : null;
    const chosenTips = () => { const s = chosen && chosen.presentation && chosen.presentation.support; return s ? s === 'step' : true; };
    let tipsOn = mem.support() ? mem.support() !== 'choose' : chosenTips();
    function applyLook() {
      const p = (chosen && chosen.presentation) || {};
      try {
        document.documentElement.classList.toggle('synk-text-large', p.textSize === 'large');
        document.documentElement.classList.toggle('synk-motion-reduced', p.motion === 'reduced');
      } catch { /* 문서가 없는 시험 환경 */ }
    }
    applyLook();
    let plan = null, completion = null, layout = null, feedbackGiven = null, lastTip = null;
    // 이번 방문에서 결과에 '도착'했는지. 공유 링크로 처음 연 결과도 도착으로 본다.
    // 같은 탭에서 같은 링크를 새로고침하면 도착이 아니다(기록이 두 번 쌓이지 않게).
    let arrived = !!(fromHash && typeof fromHash === 'object');
    if (arrived) {
      try {
        const seenKey = `${KEY}.seen`;
        if (sessionStorage.getItem(seenKey) === location.hash) arrived = false;
        else sessionStorage.setItem(seenKey, location.hash);
      } catch { /* 저장소가 막힌 브라우저는 매번 도착으로 본다 */ }
    }
    const persist = () => store.set(KEY, { v: C.version, answers: state.answers, at: state.at, checks: state.checks });

    const steps = () => C.steps.filter(s => !s.when || s.when(state.answers));
    const stepById = id => steps().find(s => s.id === id);
    const answered = s => {
      const v = state.answers[s.id];
      if (s.type === 'single') return typeof v === 'string' && s.options.some(o => o.id === v);
      if (s.type === 'multi') return Array.isArray(v) && v.length > 0;
      if (s.type === 'group') return !!v && s.fields.every(f => f.optional || f.options.some(o => o.id === v[f.id]));
      return true;
    };

    function optButton(s, o, pressed, multi, chip) {
      const role = multi ? 'checkbox' : 'radio';
      const cls = chip ? 'glass chip' : `glass opt${multi ? ' multi' : ''}`;
      const inner = chip ? `<span>${esc(o.label)}</span>` : `<span><strong>${esc(o.label)}</strong>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span><span class="mark">${ICON.check}</span>`;
      return `<button type="button" class="${cls}" role="${role}" aria-checked="${pressed}" data-opt="${esc(o.id)}"${chip && o.sub ? ` title="${esc(o.sub)}"` : ''}>${inner}</button>`;
    }

    function tipHtml(s) {
      if (!s.tip) return '';
      const body = s.tip.body.map(p => `<p>${esc(p)}</p>`).join('');
      const vis = s.tip.visual && V.visual ? `<div class="vis">${V.visual(s.tip.visual, state.answers)}</div>` : '';
      if (!tipsOn) return `<details class="tip-closed"><summary>${ICON.bulb}<span>알아 두면 좋은 팁 · ${esc(s.tip.title)}</span></summary><div class="tip">${`<h3>${esc(s.tip.title)}</h3>`}${body}${vis}</div></details>`;
      return `<section class="tip" aria-label="알아 두면 좋은 팁"><p class="tip-head">${ICON.bulb}<span>알아 두면 좋은 팁</span></p><h3>${esc(s.tip.title)}</h3>${body}${vis}</section>`;
    }

    const hasAnswers = () => steps().some(s => answered(s));
    function renderIntro() {
      const i = C.intro;
      const resume = hasAnswers() ? '<p class="hint"><button type="button" class="linkbtn" data-action="resume">지난번 답에 이어서 하기</button></p>' : '';
      // 질문 없이 바로 받을 자료(피드에서 약속한 PDF·ZIP 등). 있으면 시작 버튼 아래에 둔다.
      const links = (i.links || []).length ? `<div class="quick"><p>${esc(i.linksLabel || '바로 받기')}</p><ul>${i.links.map(l => `<li><a href="${esc(l.href)}"${l.download ? ' download' : ' target="_blank" rel="noopener"'}>${esc(l.label)}</a>${l.sub ? `<small>${esc(l.sub)}</small>` : ''}</li>`).join('')}</ul></div>` : '';
      // SYNK 계정에서 고른 설정: 따르고 있으면 무엇인지와 끊기, 아니면 불러오기(등록한 synk.im 주소에서만).
      const words = chosen && chosen.presentation && account ? account.describe(chosen.presentation) : [];
      const accountNote = words.length ? `<p class="hint account-note">SYNK 계정에서 고른 설정을 따라요 · ${esc(words.join(' · '))} <button type="button" class="linkbtn" data-action="account">끊기</button></p>`
        : account && account.available() ? `<p class="hint account-note"><button type="button" class="linkbtn" data-action="account">SYNK 계정의 내 설정 불러오기</button> · 로그인해 고른 설정(도움 방식·설명 길이·글씨 크기)만 읽어 와요</p>` : '';
      el.innerHTML = `<section class="intro fade-in"><div><p class="eyebrow">${esc(i.eyebrow)}</p><h1 id="q" tabindex="-1">${i.title}</h1><p class="lead">${esc(i.lead)}</p><ul class="meta">${i.meta.map(m => `<li>${esc(m)}</li>`).join('')}</ul><span class="start"><button type="button" class="btn primary" data-action="begin">${esc(i.start)} ${ICON.right}</button></span>${resume}${links}<p class="privacy">${esc(i.privacy)}</p>${accountNote}</div><div class="art" aria-hidden="true">${V.hero ? V.hero() : ''}</div></section>`;
    }
    function forget() {
      mem.clear(); store.del(KEY);
      if (account) account.forget();
      chosen = null; applyLook(); syncAccount();
      state = { answers: {}, at: 'intro', checks: {} }; plan = null; completion = null; layout = null; feedbackGiven = null; tipsOn = true;
      syncTips();
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      render(); say('이 기기에 저장된 선택과 기록을 지웠어요.');
    }
    function toggleTips() {
      tipsOn = !tipsOn; mem.setSupport(tipsOn ? 'step' : 'choose'); syncTips(); render(false);
      say(tipsOn ? '팁을 함께 보여 드릴게요.' : '팁을 접어 둘게요. 필요할 때 펼쳐 보세요.');
    }

    function renderStep(s) {
      const list = steps(), idx = list.indexOf(s), total = list.length;
      const multi = s.type === 'multi';
      let opts = '';
      if (s.type === 'group') {
        const v = state.answers[s.id] || {};
        opts = s.fields.map(f => `<div class="field"><h3 id="f-${esc(f.id)}">${esc(f.label)}</h3><div class="opts chips" role="radiogroup" aria-labelledby="f-${esc(f.id)}" data-field="${esc(f.id)}">${f.options.map(o => optButton(s, o, v[f.id] === o.id, false, true)).join('')}</div></div>`).join('');
      } else {
        const v = state.answers[s.id];
        const two = s.options.length > 3 ? '' : ' one';
        opts = `<div class="opts${two}" role="${multi ? 'group' : 'radiogroup'}" aria-labelledby="q">${s.options.map(o => optButton(s, o, multi ? (v || []).includes(o.id) : v === o.id, multi, false)).join('')}</div>`;
      }
      const ready = answered(s);
      const pickedTip = lastTip && lastTip.step === s.id ? lastTip.text : '';
      const aside = V.aside ? V.aside(state.answers, R, s) : '';
      el.innerHTML = `<div class="stage fade-in"><div class="main"><div class="progress"><div class="meter" role="progressbar" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${idx + 1}" aria-label="질문 진행"><i style="width:${Math.round(((idx + 1) / total) * 100)}%"></i></div><span>${idx + 1} / ${total}</span></div>${s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : ''}<h2 class="q" id="q" tabindex="-1">${esc(s.title)}</h2>${s.sub ? `<p class="q-sub">${esc(s.sub)}</p>` : ''}${opts}<div class="picked"${pickedTip ? '' : ' hidden'} aria-live="polite">${ICON.bulb}<p>${esc(pickedTip)}</p></div><div class="nav"><button type="button" class="btn ghost" data-action="back">${ICON.left} 이전</button><span class="grow"></span><button type="button" class="btn primary" data-action="next"${ready ? '' : ' disabled'}>${idx === total - 1 ? '결과 보기' : '다음'} ${ICON.right}</button></div>${multi ? '<p class="hint">여러 개를 고를 수 있어요.</p>' : ''}</div><aside class="aside">${tipHtml(s)}${aside ? `<div style="margin-top:18px">${aside}</div>` : ''}</aside></div>`;
    }

    // 질문을 끝내고 결과에 도착했거나 공유 링크로 처음 열었을 때만 한 회차로 기록한다. 새로고침은 기억만 읽는다.
    function startRound() {
      plan = mem.plan(tool.id, tool.candidates);
      completion = plan ? mem.complete(plan) : null;
    }
    function renderResult() {
      const rec = R.compute(state.answers);
      if (!plan) {
        if (arrived) startRound();
        else plan = mem.peek(tool.id, tool.candidates);
      }
      // 이 도구에서 분량 반응을 준 적이 없으면 SYNK 계정에서 고른 설명 길이를 따른다.
      const fromAccount = !(plan && plan.outcomeBasis && plan.outcomeBasis !== 'unobserved') && chosen && chosen.presentation && ACCOUNT_LAYOUT[chosen.presentation.explanation];
      if (!layout) layout = fromAccount || (plan && plan.selected && plan.selected.id) || tool.defaultLayout || 'guided';
      const out = V.result({ rec, answers: state.answers, layout, plan, tipsOn, checks: state.checks, feedbackGiven, content: C, rules: R });
      el.innerHTML = `<div class="stage single fade-in">${out.html}</div>`;
      el._texts = out.texts || {};
      if (V.bindResult) V.bindResult(el, { rec, answers: state.answers, rules: R, content: C });
    }

    function render(focus = true) {
      if (state.at === 'intro') renderIntro();
      else if (state.at === 'result') renderResult();
      else { const s = stepById(state.at) || steps()[0]; state.at = s.id; renderStep(s); }
      if (V.bindAny) V.bindAny(el, { answers: state.answers, rules: R, content: C });
      persist();
      if (focus) {
        const q = el.querySelector('#q, h1');
        if (q) { q.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); }
      }
    }

    function go(to) { state.at = to; lastTip = null; render(); const s = stepById(to); if (s) say(s.title); }
    function next() {
      const list = steps(), i = list.findIndex(s => s.id === state.at);
      if (i < 0) return go(list[0].id);
      if (!answered(list[i])) return;
      if (i === list.length - 1) { state.at = 'result'; arrived = true; plan = null; completion = null; layout = null; feedbackGiven = null; render(); say('맞춤 추천 결과가 나왔어요.'); return; }
      go(list[i + 1].id);
    }
    function back() {
      const list = steps(), i = list.findIndex(s => s.id === state.at);
      if (i <= 0) { state.at = 'intro'; render(); return; }
      go(list[i - 1].id);
    }

    function choose(btn) {
      const s = stepById(state.at); if (!s) return;
      const id = btn.dataset.opt;
      let tip = null;
      if (s.type === 'single') { state.answers[s.id] = id; tip = (s.options.find(o => o.id === id) || {}).tip; }
      else if (s.type === 'multi') {
        const cur = new Set(state.answers[s.id] || []);
        if (cur.has(id)) cur.delete(id); else { cur.add(id); tip = (s.options.find(o => o.id === id) || {}).tip; }
        state.answers[s.id] = s.options.map(o => o.id).filter(x => cur.has(x));
      } else if (s.type === 'group') {
        const field = btn.closest('[data-field]').dataset.field;
        const f = s.fields.find(x => x.id === field);
        state.answers[s.id] = { ...(state.answers[s.id] || {}), [field]: id };
        tip = (f.options.find(o => o.id === id) || {}).tip;
      }
      lastTip = tip ? { step: s.id, text: tip } : (lastTip && lastTip.step === s.id ? lastTip : null);
      // 앞 답이 바뀌어 사라진 조건부 질문의 답은 남겨 두되, rules가 보이는 용도만 계산에 넣는다.
      const focusKey = s.type === 'group' ? `[data-field="${btn.closest('[data-field]').dataset.field}"] [data-opt="${id}"]` : `[data-opt="${id}"]`;
      render(false);
      const again = el.querySelector(focusKey); if (again) again.focus({ preventScroll: true });
      if (tip) say(tip);
    }

    el.addEventListener('click', async e => {
      // 떠 있는 하단 바의 버튼은 본문의 같은 버튼을 대신 누른다(복사가 막히면 그 자리에서 글자 상자를 편다).
      const proxy = e.target.closest('[data-proxy]');
      if (proxy) {
        const target = el.querySelector(`[data-action="${proxy.dataset.proxy}"]`);
        if (target) { target.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); target.click(); }
        return;
      }
      const opt = e.target.closest('[data-opt]');
      if (opt && el.contains(opt) && state.at !== 'intro' && state.at !== 'result') { choose(opt); return; }
      const act = e.target.closest('[data-action]');
      if (!act) return;
      const [name, arg] = act.dataset.action.split(':');
      if (name === 'begin') { state.answers = {}; state.checks = {}; plan = null; completion = null; layout = null; feedbackGiven = null; go(steps()[0].id); }
      else if (name === 'resume') { const list = steps(); const first = list.find(s => !answered(s)); if (first) go(first.id); else { state.at = 'result'; arrived = true; render(); } }
      else if (name === 'next') next();
      else if (name === 'back') back();
      else if (name === 'edit') { go(arg); }
      else if (name === 'restart') { state = { answers: {}, at: 'intro', checks: {} }; plan = null; completion = null; layout = null; feedbackGiven = null; if (location.hash) history.replaceState(null, '', location.pathname + location.search); render(); say('처음부터 다시 시작해요.'); }
      else if (name === 'layout') { layout = arg; render(false); const b = el.querySelector(`[data-action="layout:${arg}"]`); if (b) b.focus({ preventScroll: true }); say({ quick: '간단히 보기로 바꿨어요.', guided: '기본 보기로 바꿨어요.', deep: '자세히 보기로 바꿨어요.' }[arg] || ''); }
      else if (name === 'feedback') {
        if (!feedbackGiven) { if (!completion) startRound(); if (completion && completion.id) mem.feedback(completion.id, arg); }
        feedbackGiven = arg; render(false); say('고마워요. 다음에 반영할게요.');
      }
      else if (name === 'copy' || name === 'share') {
        const text = name === 'share' ? `${location.origin}${location.pathname}#r=${encode(state.answers)}` : (el._texts || {})[arg];
        if (!text) return;
        const ok = await copyText(text);
        const row = act.parentElement, st = row.querySelector('.status');
        const done = name === 'share' ? '내 결과 링크를 복사했어요. 나중에 이 링크로 다시 열 수 있어요.' : '복사했어요.';
        // 인앱 브라우저처럼 복사가 막히면 글자 상자를 펼쳐 직접 고를 수 있게 한다.
        let box = row.parentElement.querySelector('textarea.fallback');
        if (!ok) {
          if (!box) { box = document.createElement('textarea'); box.className = 'fallback'; box.readOnly = true; box.setAttribute('aria-label', '직접 복사할 내용'); row.after(box); }
          box.value = text; box.hidden = false; box.focus({ preventScroll: true }); box.select();
        } else if (box) box.hidden = true;
        const msg = ok ? done : '이 브라우저에서는 자동 복사가 막혀 있어요. 아래 상자의 글자를 길게 눌러 복사해 주세요.';
        if (st) st.textContent = msg; say(msg);
        if (ok) {
          // ‘요청문 복사’ 단추면 “요청문을 복사했어요”. 받침에 맞춰 을·를을 고른다.
          const what = act.dataset.what || act.textContent.replace(/\s*복사\s*$/, '').trim() || '글';
          const code = what.charCodeAt(what.length - 1) - 0xac00;
          const obj = what + (code >= 0 && code <= 11171 && code % 28 === 0 ? '를' : '을');
          toast(name === 'share' ? '내 결과 링크를 복사했어요' : `${obj} 복사했어요`);
        }
      }
      else if (name === 'print') { window.print(); }
      else if (name === 'tips') toggleTips();
      else if (name === 'account') accountAction();
      else if (name === 'forget') forget();
    });

    el.addEventListener('change', e => {
      const box = e.target.closest('[data-check]');
      if (!box) return;
      state.checks = { ...state.checks, [box.dataset.check]: box.checked };
      persist();
    });

    // 질문의 라디오 묶음은 화살표로 옮겨 고른다. 그림 안의 칩(램 용량 등)은 view가 따로 다룬다.
    el.addEventListener('keydown', e => {
      const btn = e.target.closest('[role="radio"][data-opt]');
      if (!btn || !['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) return;
      const group = [...btn.parentElement.querySelectorAll('[role="radio"]')];
      const i = group.indexOf(btn), d = ['ArrowDown', 'ArrowRight'].includes(e.key) ? 1 : -1;
      const target = group[(i + d + group.length) % group.length];
      e.preventDefault(); choose(target);
    });

    // 머리줄의 팁 스위치와 기록 지우기는 도구 바깥에 있다.
    const tipsBtn = document.querySelector('[data-tips]');
    function syncTips() { if (tipsBtn) tipsBtn.setAttribute('aria-checked', String(tipsOn)); }
    if (tipsBtn) tipsBtn.addEventListener('click', toggleTips);
    document.querySelectorAll('[data-forget]').forEach(b => b.addEventListener('click', forget));
    // 머리줄의 'SYNK 설정 불러오기'(core/account.js). 등록된 synk.im 주소에서만 보인다.
    function syncAccount() {
      if (!accountBtn) return;
      const slot = accountBtn.closest('[data-account-slot]') || accountBtn;
      slot.hidden = !(account && account.available());
      const has = !!(chosen && chosen.presentation);
      accountBtn.textContent = has ? 'SYNK 설정 끊기' : 'SYNK 설정 불러오기';
      accountBtn.setAttribute('aria-label', has ? 'SYNK 계정에서 불러온 설정을 이 기기에서 지우기' : 'SYNK 계정에 로그인해 고른 설정(도움 방식·설명 길이·글씨 크기)만 불러오기');
    }
    function announce(text) { say(text); toast(text); }
    const accountBtn = document.querySelector('[data-account]');
    function accountAction() {
      if (!account) return;
      if (chosen && chosen.presentation) {
        account.forget(); chosen = null; tipsOn = mem.support() ? mem.support() !== 'choose' : true; layout = null;
        applyLook(); syncTips(); syncAccount(); render(false);
        announce('SYNK 계정에서 불러온 설정을 이 기기에서 지웠어요.');
        return;
      }
      if (accountBtn) accountBtn.disabled = true;
      account.begin().catch(error => { if (accountBtn) accountBtn.disabled = false; announce(error.message || 'SYNK 계정을 불러오지 못했어요.'); });
    }
    if (accountBtn) accountBtn.addEventListener('click', accountAction);
    syncTips();
    syncAccount();
    render(false);
    // SYNK 로그인에서 돌아온 경우: 고른 설정만 받아 적용한다(core/account.js가 토큰을 바로 버린다).
    if (account && account.available()) account.finish().then(result => {
      if (!result) return;
      if (result.status === 'loaded' && result.presentation) {
        chosen = account.read();
        if (!mem.support()) tipsOn = chosenTips();
        layout = null; applyLook(); syncTips(); syncAccount(); render(false);
        announce(`SYNK 계정에서 고른 설정을 불러왔어요 · ${account.describe(chosen.presentation).join(' · ')}`);
      } else if (result.status === 'loaded') {
        account.forget(); chosen = null; syncAccount();
        announce('SYNK 계정에 아직 고른 설정이 없어요. 계정의 학습 기록 저장을 켜고 앱에서 도움 방식이나 글씨 크기를 고르면 여기서도 따라요.');
      } else announce(result.message);
    });
    return { state: () => JSON.parse(JSON.stringify(state)), memory: mem };
  }

  root.SynkWizard = Object.freeze({ start, esc, copyText, encode, decode });
})(typeof globalThis !== 'undefined' ? globalThis : this);
