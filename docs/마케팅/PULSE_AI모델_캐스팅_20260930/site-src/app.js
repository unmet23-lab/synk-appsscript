(function () {
  'use strict';
  // PULSE 모델 캐스팅북 2판(10-18). 한 페이지 안에서 주소 뒤 #으로 화면을 바꾼다.
  // claude.ai 페이지 링크에는 글자·숫자·. _ ~ - 만 넘어오므로 그 글자만 쓴다(1판의 #F02, #/m/F02도 연다).
  //   #board            모델 보드(광고 내용으로 순서 바꾸기·거르기)   #lineup  키 순서
  //   #m-F02[-탭]       모델 북(북·디지털·장면·움직임·프로필)         #swipe   넘기며 고르기
  //   #pkg[-inq]        패키지(컴프 카드·나란히 비교·문의 글)        #p-F02.1.0~F04.0.2  공유받은 패키지
  const D = JSON.parse(document.getElementById('data').textContent);
  const L = window.CastingLogic;
  const TAX = { industries: D.industries, moods: D.moods, genderWords: D.genderWords };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const E = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 「음료·디저트」 같은 가운뎃점 덩어리가 줄 끝에서 갈리지 않게 묶는다
  const K = (s) => E(s).replace(/ · /g, '&nbsp;· ').replace(/([^\s&;·]+(?:·[^\s&;·]+)+)/g, '<span class="nw">$1</span>');
  const dot = (...xs) => xs.filter(Boolean).join(' · ');
  const byCode = (c) => D.models.find((m) => m.code === c);
  const indLabel = (id) => (D.industries.find((i) => i.id === id) || {}).label || '';
  const sexWord = (g) => (g === '여' ? '여자' : g === '남' ? '남자' : '');
  const pad2 = (n) => String(n).padStart(2, '0');
  const whoOf = (m) => dot(sexWord(m.gender), m.age || m.ageBand, m.impression.some((w) => w.includes(m.concept)) ? '' : m.concept, m.impression.join(' · '));
  const view = $('#view');

  /* ── 저장: 이 브라우저에만 남는 편의 기능. 막혀 있어도 화면은 그대로 쓴다 ── */
  const KEY = 'pulse-casting-v3';
  const state = { pkg: [], sel: {}, ask: '', format: 'kmong', ...load() };
  state.pkg = state.pkg.filter(byCode);
  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && typeof v === 'object') return v;
      // 1판(비교·내 선택 따로)에서 옮겨 온다: 둘 다 패키지로
      const o = JSON.parse(localStorage.getItem('pulse-casting-v2') || 'null');
      if (o && typeof o === 'object') {
        const sel = {}; for (const p of o.picks || []) sel[p.code] = { hair: p.hair || 0, voice: p.voice || 0, memo: p.memo || '' };
        return { pkg: [...new Set([...(o.picks || []).map((p) => p.code), ...(o.compare || [])])], sel, ask: (o.brief && o.brief.touched && o.brief.product) || '', format: o.format || 'kmong' };
      }
    } catch { /* 저장이 막힌 브라우저 */ }
    return {};
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ pkg: state.pkg, sel: state.sel, ask: state.ask, format: state.format })); } catch { /* 무시 */ } }
  const selOf = (c) => ({ hair: 0, voice: 0, memo: '', ...(state.sel[c] || {}) });
  const inPkg = (c) => state.pkg.includes(c);
  function setSel(c, patch) { state.sel[c] = { ...selOf(c), ...patch }; save(); }
  function togglePkg(c, on = !inPkg(c)) {
    if (on && !inPkg(c)) state.pkg.push(c);
    if (!on) state.pkg = state.pkg.filter((x) => x !== c);
    save(); syncPkg();
    const m = byCode(c);
    toast(on ? `${m.name}${L.josa(m.name, '을', '를')} 패키지에 담았어요` : `${m.name}${L.josa(m.name, '을', '를')} 패키지에서 뺐어요`);
  }
  function syncPkg() {
    const n = $('#pkg-n');
    const changed = n.textContent !== String(state.pkg.length);
    n.textContent = state.pkg.length;
    n.classList.toggle('has', state.pkg.length > 0);
    if (changed) { n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); setTimeout(() => n.classList.remove('bump'), 220); }
    for (const b of $$('[data-act="pkg"]')) {
      const on = inPkg(b.dataset.code);
      b.setAttribute('aria-pressed', on);
      b.textContent = on ? (b.dataset.on || '패키지에 담김') : (b.dataset.off || '+ 패키지');
    }
  }

  const toastEl = $('#toast');
  function toast(msg) {
    toastEl.textContent = msg;
    try { if (toastEl.matches(':popover-open')) toastEl.hidePopover(); toastEl.showPopover(); } catch { toastEl.classList.add('show'); }
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { try { toastEl.hidePopover(); } catch { toastEl.classList.remove('show'); } }, 2400);
  }
  function copy(text, done) {
    const fallback = () => { const ta = $('#inq-text'); if (ta) { ta.focus(); ta.select(); } toast('글을 선택해 두었어요. 복사해서 붙여 넣어 주세요.'); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast(done), fallback); else fallback(); } catch { fallback(); }
  }

  /* ── 키 눈금 ───────────────────────────────────────────── */
  const TICKS = [150, 160, 170, 180, 190];
  function lineupHTML(list, opts = {}) {
    return `${opts.minK ? '<div class="lu-scroll">' : ''}<div class="lu${opts.cols ? ' cols' : ''}" data-lu data-max="${opts.maxH || 360}"${opts.minK ? ` data-mink="${opts.minK}"` : ''} style="--n:${list.length}">
      <div class="lu-ticks" aria-hidden="true">${TICKS.map((cm) => `<span class="lu-tick" style="--cm:${cm}"><i class="num">${cm}</i></span>`).join('')}</div>
      <div class="lu-row">${list.map((m) => {
        const cls = opts.current ? (m.code === opts.current ? ' on' : ' dim') : opts.dim && opts.dim.has(m.code) ? ' dim' : '';
        const body = m.stand ? `<img src="${E(m.stand.src)}" alt="" loading="lazy">` : '';
        return `<a class="lu-fig${cls}" href="#m-${E(m.code)}" style="--cm:${Number(m.height) || 160};--r:${m.stand ? m.stand.ratio : 0.3}" aria-label="${E(m.name)}, 키 ${E(m.height || '정보 없음')}cm, 모델 북 보기">${body}<span class="lu-cap"><b>${E(m.name)}</b><span class="num">${E(m.height || '')}</span></span></a>`;
      }).join('')}</div>
    </div>${opts.minK ? '</div>' : ''}`;
  }
  // 눈금 배율(1cm당 px)을 칸 너비와 최대 높이에 맞춘다
  function fitLineup(lu) {
    const row = lu && $('.lu-row', lu), figs = row ? $$('.lu-fig', row) : [];
    if (!figs.length) return;
    const minK = Number(lu.dataset.mink || 0);
    if (minK) lu.style.width = '';
    if (!row.clientWidth) return;
    const gap = parseFloat(getComputedStyle(row).columnGap) || 8;
    const w = (f) => Number(f.style.getPropertyValue('--cm')) * Number(f.style.getPropertyValue('--r'));
    const room = row.clientWidth - gap * (figs.length - 1);
    const byWidth = lu.classList.contains('cols') ? (room / figs.length) * 0.9 / Math.max(...figs.map(w)) : room / figs.reduce((t, f) => t + w(f), 0);
    let k = Math.min(Number(lu.dataset.max) / 196, byWidth);
    if (minK && k < minK) {
      k = minK;
      const padL = parseFloat(getComputedStyle(lu).paddingLeft) || 0;
      lu.style.width = Math.ceil(figs.reduce((t, f) => t + w(f), 0) * k + gap * (figs.length - 1) + padL + 24) + 'px';
    }
    lu.style.setProperty('--k', Math.max(0.3, k).toFixed(4));
    lu.classList.toggle('dense', k * 10 < 18 && k * 20 >= 18);
    lu.classList.toggle('sparse', k * 20 < 18);
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver((es) => es.forEach((e) => fitLineup(e.target.closest('[data-lu]')))) : null;
  function watchLineups(scope) {
    $$('[data-lu]', scope).forEach(fitLineup);
    if (ro) $$('[data-lu] .lu-row', scope).forEach((r) => ro.observe(r));
  }

  /* ── 목소리 ───────────────────────────────────────────── */
  const audio = new Audio();
  let playing = null;
  const svgPlay = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4l8.6-5.2z" fill="currentColor"/></svg>';
  const svgStop = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1.6" fill="currentColor"/></svg>';
  const voiceBtn = (m, i) => `<button type="button" class="play" data-act="voice" data-code="${E(m.code)}" data-i="${i}" aria-pressed="false" aria-label="${E(m.name)} 목소리 ${i + 1} ${E(m.voices[i].label)} 듣기">${svgPlay}</button>`;
  function stopAudio() {
    audio.pause();
    for (const b of $$('[data-act="voice"][aria-pressed="true"],[data-act="say"][aria-pressed="true"]')) { b.setAttribute('aria-pressed', 'false'); if (b.dataset.act === 'voice') b.innerHTML = svgPlay; }
    playing = null;
  }
  function playSrc(src, key, btns) {
    stopAudio();
    audio.src = src; audio.currentTime = 0;
    return audio.play().then(() => {
      playing = key;
      for (const b of btns()) { b.setAttribute('aria-pressed', 'true'); if (b.dataset.act === 'voice') b.innerHTML = svgStop; }
    }).catch(() => toast('소리를 재생하지 못했어요. 다시 눌러 주세요.'));
  }
  function toggleVoice(btn) {
    const key = btn.dataset.code + ':' + btn.dataset.i;
    if (playing === key) { stopAudio(); return; }
    const v = byCode(btn.dataset.code).voices[Number(btn.dataset.i)];
    playSrc(v.src, key, () => $$(`[data-act="voice"][data-code="${btn.dataset.code}"][data-i="${btn.dataset.i}"]`));
  }
  audio.addEventListener('ended', stopAudio);

  /* ── 크게 보기 ────────────────────────────────────────── */
  let lbList = [], lbIndex = 0, lbName = '';
  function openLb(list, i, name) {
    lbList = list; lbIndex = i; lbName = name || '';
    drawLb();
    const el = $('#lightbox'); if (!el.open) el.showModal();
  }
  function drawLb() {
    const g = lbList[lbIndex];
    $('#lightbox').innerHTML = `<div class="lb-top"><span>${E(lbName)}${lbName ? ' · ' : ''}${K(g.label)}<span class="num">${lbIndex + 1} / ${lbList.length}</span></span><button type="button" data-act="lb-close">닫기</button></div>
      <div class="lb-img"><img src="${E(g.l)}" alt="${E(lbName + ' ' + g.label)}"></div>
      ${lbList.length > 1 ? '<div class="lb-nav"><button type="button" data-act="lb-step" data-d="-1">이전 사진</button><button type="button" data-act="lb-step" data-d="1">다음 사진</button></div>' : '<div class="lb-nav"></div>'}`;
  }

  /* ── 모델 자료 묶음 ───────────────────────────────────── */
  const shot = (m, k) => m.shots[k] && { s: m.shots[k].s, l: m.shots[k].l, label: m.shots[k].label, key: k };
  const sceneShot = (sc) => ({ s: sc.s, l: sc.l, label: `${sc.place} · ${sc.label}`, key: 'scene:' + sc.id });
  // 북: 대표 → 웃음 → 룩 → 전신 → 광고 장면 → 장면 사진 → 손·피부
  const bookOf = (m) => [shot(m, 'hero'), shot(m, 'exp-smile'), shot(m, 'look-1'), shot(m, 'look-2'), shot(m, 'fullbody'), shot(m, 'context'), ...m.scenes.map(sceneShot), shot(m, 'hands'), shot(m, 'skin')].filter(Boolean);
  // 디지털: 꾸미지 않은 각도·표정·헤어(캐스팅에서 실제 얼굴·몸을 보는 사진)
  const digOf = (m) => ['angle-front', 'angle-left', 'angle-right', 'angle-back', 'full-left', 'full-back', 'full-45', 'exp-smile', 'exp-angry', 'exp-surprised', 'hair-2', 'hair-3'].map((k) => shot(m, k)).filter(Boolean);
  const colorOf = (m, k) => ((m.colors || []).find((c) => c.label === k) || {}).hex;
  const first = (s) => String(s || '').split(/[,·(]/)[0].trim();
  function compCells(m) {
    const sw = (hex) => (hex ? `<span class="dotc" style="background:${E(hex)}"></span>` : '');
    return [
      ['키', m.height ? `${m.height}<small>cm</small>` : '—'],
      m.weightKg ? ['몸무게', `${m.weightKg}<small>kg</small>`] : ['체형', E(first(m.build) || '—')],
      ['상의', E(m.sizes.top || '—')],
      ['하의', E(m.sizes.bottom || '—')],
      ['신발', m.sizes.shoe ? `${E(m.sizes.shoe)}<small>mm</small>` : '—'],
      ['등신', m.body ? m.body.heads.toFixed(2) : '—'],
      ['머리', `${sw(colorOf(m, '머리'))}${E(first(m.hairBase) || '—')}`],
      ['피부', `${sw(colorOf(m, '피부'))}${E(first(m.skin) || '—')}`],
      ['입술', colorOf(m, '입술') ? `${sw(colorOf(m, '입술'))}<small>${E(colorOf(m, '입술'))}</small>` : '—'],
    ];
  }
  const compHTML = (m) => `<dl class="comp">${compCells(m).map(([k, v]) => `<div><dt>${E(k)}</dt><dd class="num">${v}</dd></div>`).join('')}</dl>`;
  const pkgBtn = (m, cls = 'btn line', on = '패키지에 담김', off = '+ 패키지에 넣기') => `<button type="button" class="${cls}" data-act="pkg" data-code="${E(m.code)}" data-on="${E(on)}" data-off="${E(off)}" aria-pressed="${inPkg(m.code)}">${inPkg(m.code) ? on : off}</button>`;

  /* ── 보드 ─────────────────────────────────────────────── */
  const filters = { gender: '', age: '', concept: '', industry: '', height: '' };
  const uniq = (xs) => [...new Set(xs.filter(Boolean))];
  function ranked() {
    const list = L.filterModels(D.models, filters);
    const q = state.ask.trim();
    const brief = { product: q, industry: '', moods: [] };
    const recs = q ? L.recommend(list, brief, TAX, list.length) : [];
    const order = recs.length ? [...recs.map((r) => r.model), ...list.filter((m) => !recs.some((r) => r.model.code === m.code))] : list;
    return { list, recs, order, brief };
  }
  const whyOf = (r) => r.reasons.map((x) => x.text.replace(/ 광고에 어울려요$/, '').replace(/ 인상이에요$/, '').replace(/ 콘셉트예요$/, '')).join(' · ');
  function heardHTML(recs, brief) {
    if (!state.ask.trim()) return `<span>업종이나 제품을 적으면 맞는 모델이 앞으로 와요.</span><span class="eg">${['딸기 라떼 신메뉴', '가계부 앱', '여성 가을 니트', '남성 향수'].map((w) => `<button type="button" data-act="eg" data-v="${E(w)}">${E(w)}</button>`).join('')}</span>`;
    const { inds, moods, gender, genderWord } = L.readBrief(brief, TAX);
    const words = uniq([...inds.values(), ...moods.values()].flatMap((v) => v.words).concat(gender ? [genderWord] : []));
    if (!recs.length) return `<span>${words.length ? `「${E(words.join('·'))}」에 맞는 모델이 아직 없어요. 같은 방식으로 새로 만들어 드려요.` : '이 설명에서는 업종이나 분위기를 찾지 못했어요. 라떼·크림·앱·니트처럼 제품 종류를 넣어 보세요.'}</span><button type="button" class="link muted" data-act="ask-clear">지우기</button>`;
    return `<span>「${E(words.join('·'))}」에 맞는 <b class="num">${recs.length}명</b>을 앞에 세웠어요</span><button type="button" class="link muted" data-act="ask-clear">지우기</button>`;
  }
  function tileHTML(m, r, rank, dim) {
    const loop = m.loop ? `<video data-loop muted loop playsinline preload="none" poster="${E(m.hero.s)}" src="${E(m.loop.src)}" aria-hidden="true"></video>` : '';
    return `<article class="tile${dim ? ' dim' : ''}" data-code="${E(m.code)}">
      <a class="tile-open" href="#m-${E(m.code)}" aria-label="${E(m.name)} 모델 북 보기">
        <div class="ph">
          ${m.hero ? `<img class="base" src="${E(m.hero.s)}" srcset="${E(m.hero.s)} 720w, ${E(m.hero.l)} 1600w" sizes="(max-width:760px) 50vw, 25vw" alt="" loading="lazy">` : ''}
          ${!loop && m.alt ? `<img class="alt" src="${E(m.alt.s)}" alt="" loading="lazy">` : ''}${loop}
          ${rank ? `<span class="rank num">${pad2(rank)}</span>` : ''}
          ${m.realPerson ? '<span class="badge">실제 인물</span>' : ''}
        </div>
        <div class="cap"><span class="name">${E(m.name)}</span><span class="code num">${E(m.code)}</span>
          <span class="line">${K(dot(m.height && m.height + 'cm', m.age || m.ageBand, m.concept))}</span>
          ${r ? `<span class="why">${K(whyOf(r))}</span>` : ''}</div>
      </a>
      ${pkgBtn(m, 'add', '패키지에 담김', '+ 패키지')}
    </article>`;
  }
  function filtersHTML(mode) {
    const order = ['상큼', '지적', '섹시', '개성'];
    const concepts = uniq(D.models.map((m) => m.concept)).sort((a, b) => (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99);
    const sel = (k, label, opts) => `<label class="g"><span class="k">${E(label)}</span><select data-f="${k}" aria-label="${E(label)}"><option value="">전체</option>${opts.map(([v, l]) => `<option value="${E(v)}"${filters[k] === v ? ' selected' : ''}>${E(l)}</option>`).join('')}</select></label>`;
    const count = (id) => D.models.filter((m) => (m.industries || []).includes(id)).length;
    return `<div class="filters pad" role="group" aria-label="모델 거르기">
      ${sel('gender', '성별', [['여', '여자'], ['남', '남자']])}
      ${sel('age', '나이', uniq(D.models.map((m) => m.ageBand)).sort().map((a) => [a, a]))}
      ${sel('concept', '콘셉트', concepts.map((c) => [c, c]))}
      ${sel('industry', '업종', D.industries.filter((i) => count(i.id)).map((i) => [i.id, `${i.label} ${count(i.id)}`]))}
      ${sel('height', '키', uniq(D.models.map((m) => L.heightBand(m.height))).sort().map((h) => [h, h]))}
      <span class="g view" role="group" aria-label="보기"><a class="tg" href="#board"${mode !== 'lineup' ? ' aria-current="page"' : ''}>사진</a><a class="tg" href="#lineup"${mode === 'lineup' ? ' aria-current="page"' : ''}>키 순서</a></span>
    </div>`;
  }
  function renderBoard(mode = 'board', anchor = '') {
    view.innerHTML = `
      <section class="board-head pad">
        <div><h1 class="crumb">모델<sup class="num">${D.models.length}</sup></h1>
          <p class="crumb-sub">광고 내용을 적으면 맞는 모델이 앞으로 와요. 마음에 드는 모델은 패키지에 담아 한 장짜리 카드와 문의 글로 보내 주세요.</p></div>
        <form class="ask" id="ask" role="search">
          <label for="q">어떤 광고를 만드시나요?</label>
          <div class="field"><input id="q" type="search" value="${E(state.ask)}" placeholder="예: 딸기 라떼 신메뉴, 상큼하게" autocomplete="off" maxlength="80"></div>
          <p class="heard" id="heard" aria-live="polite"></p>
        </form>
        <a class="swipe-cta" href="#swipe">한 명씩 넘기며 고르기<span aria-hidden="true">→</span></a>
      </section>
      ${filtersHTML(mode)}
      <p class="result pad" id="result" role="status"></p>
      <div id="board-body"></div>
      ${$('#guide-tpl').innerHTML}`;
    drawBoard(mode);
    $('#ask').addEventListener('submit', (e) => { e.preventDefault(); $('#q').blur(); });
    let t = 0;
    $('#q').addEventListener('input', (e) => { state.ask = e.target.value; clearTimeout(t); t = setTimeout(() => { save(); drawBoard(mode); }, 160); });
    for (const s of $$('.filters select')) s.addEventListener('change', () => { filters[s.dataset.f] = s.value; drawBoard(mode); });
    if (anchor) requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  }
  function drawBoard(mode) {
    const { list, recs, order, brief } = ranked();
    $('#heard').innerHTML = heardHTML(recs, brief);
    const any = Object.values(filters).some(Boolean);
    $('#result').innerHTML = `${any ? `조건에 맞는 모델 <b class="num">${list.length}</b>명` : `모델 <b class="num">${list.length}</b>명`}${any ? '<button type="button" class="link muted" data-act="filters-clear">조건 지우기</button>' : ''}`;
    const body = $('#board-body');
    if (mode === 'lineup') {
      const sorted = list.filter((m) => m.height).slice().sort((a, b) => a.height - b.height);
      const dim = new Set(recs.length ? list.filter((m) => !recs.some((r) => r.model.code === m.code)).map((m) => m.code) : []);
      body.innerHTML = `<section class="lineup-view pad" aria-label="키 순서">${sorted.length ? lineupHTML(sorted, { maxH: 440, dim, minK: 1.45 }) : ''}<p class="note">모든 모델을 같은 눈금에 세웠어요. 정수리부터 신발 바닥까지 잰 키예요. 사람을 누르면 모델 북이 열려요.</p></section>`;
      watchLineups(body);
      return;
    }
    const tiles = order.map((m) => { const r = recs.find((x) => x.model.code === m.code); return tileHTML(m, r, r ? recs.indexOf(r) + 1 : 0, recs.length && !r); }).join('');
    body.innerHTML = `<section class="board pad" aria-label="모델 보드">${tiles || ''}
      <div class="slot"><h3>찾는 얼굴이 없나요?</h3><p>10대·40대 모델은 준비하고 있어요. 원하는 나이·분위기를 알려 주시면 같은 방식으로 새 모델을 만들어 드려요.</p><button type="button" class="link" data-act="new-model">새 모델 문의 글 복사</button></div></section>`;
    wireLoops(body);
  }
  // 움직이는 사진: 마우스를 올리면(휴대폰은 화면에 보이면) 짧게 돈다
  const hoverable = typeof matchMedia === 'function' && matchMedia('(hover:hover)').matches;
  let io = null;
  function wireLoops(scope) {
    const vids = $$('video[data-loop]', scope);
    if (!vids.length || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const on = (v) => { v.play().then(() => v.classList.add('on')).catch(() => {}); };
    const off = (v) => { v.pause(); v.classList.remove('on'); };
    if (hoverable) {
      for (const v of vids) { const t = v.closest('.tile'); t.addEventListener('mouseenter', () => on(v)); t.addEventListener('mouseleave', () => off(v)); }
    } else if (typeof IntersectionObserver === 'function') {
      // 휴대폰: 화면에 보이는 것 중 가운데에 가장 가까운 한 명만 돈다(여러 명이 한꺼번에 움직이면 어지럽다)
      if (io) io.disconnect();
      const seen = new Map();
      const pick = () => {
        let best = null, bd = Infinity;
        for (const [v, r] of seen) {
          if (r < 0.6 || !v.isConnected) continue;
          const b = v.getBoundingClientRect(), d = Math.abs(b.top + b.height / 2 - innerHeight / 2);
          if (d < bd) { bd = d; best = v; }
        }
        for (const v of seen.keys()) { if (v === best) { if (v.paused) on(v); } else if (!v.paused || v.classList.contains('on')) off(v); }
      };
      io = new IntersectionObserver((es) => { es.forEach((e) => seen.set(e.target, e.intersectionRatio)); pick(); }, { threshold: [0, 0.3, 0.6, 0.9, 1] });
      vids.forEach((v) => io.observe(v));
      if (!wireLoops.scroll) { let raf = 0; wireLoops.scroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => wireLoops.pick && wireLoops.pick()); }; addEventListener('scroll', wireLoops.scroll, { passive: true }); }
      wireLoops.pick = pick;
    }
  }

  /* ── 모델 북 ──────────────────────────────────────────── */
  let bookList = [];
  function renderBook(code, tab = 'book') {
    const m = byCode(code); if (!m) { go('#board'); return; }
    const book = bookOf(m), dig = digOf(m);
    const tabs = [['book', '북', book.length], ['dig', '디지털', dig.length], m.scenes.length && ['scene', '장면', m.scenes.length], (m.motion.length || m.loop) && ['motion', '움직임', m.motion.length + (m.loop ? 1 : 0)], ['prof', '프로필', 0]].filter(Boolean);
    if (!tabs.some(([k]) => k === tab)) tab = 'book';
    const s = selOf(m.code);
    view.innerHTML = `
      <section class="book-head pad">
        <a class="back" href="#board">← 모델 보드</a>
        <div>
          <h1>${E(m.name)} <small class="num">${E(m.code)}</small></h1>
          <p class="who">${K(whoOf(m))}</p>
          ${m.realPerson ? '<p class="real">실제 인물 · SYNK 대표 본인의 얼굴로, 본인 동의를 받아 만든 모델이에요. 신체 정보는 본인이 알려 준 값이에요.</p>' : ''}
        </div>
        <div class="acts">${pkgBtn(m)}<a class="btn ink" href="#pkg-inq" data-act="ask-this" data-code="${E(m.code)}">이 모델로 문의</a></div>
      </section>
      <div class="pad"><nav class="tabs" role="tablist" aria-label="모델 자료">${tabs.map(([k, l, n]) => `<button type="button" role="tab" data-act="tab" data-v="${k}" aria-selected="${k === tab}">${E(l)}${n ? `<small class="num">${n}</small>` : ''}</button>`).join('')}</nav></div>
      <div id="tab-body"></div>
      <div class="pad">${compHTML(m)}</div>
      <section class="pick pad" aria-label="이 모델로 고르기">
        <div><h2>헤어 고르기</h2><div class="hairs" role="group" aria-label="헤어">${m.hair.map((h, i) => { const sh = m.shots['hair-' + (i + 1)]; return `<button type="button" data-act="hair" data-i="${i}" aria-pressed="${i === s.hair}">${sh ? `<img src="${E(sh.s)}" alt="" loading="lazy">` : ''}<span>${i + 1} · ${K(h.label)}</span></button>`; }).join('')}</div></div>
        <div><h2>목소리 고르기</h2>
          ${m.voices.length ? `<div class="voices">${m.voices.map((v, i) => `<div class="voice">${voiceBtn(m, i)}<div><b>${i + 1} · ${K(v.label)}</b><small>${K(v.note)}</small>${v.text ? `<small class="line">“${E(v.text)}”</small>` : ''}</div><button type="button" class="sel" data-act="vsel" data-i="${i}" aria-pressed="${i === s.voice}">${i === s.voice ? '고름' : '고르기'}</button></div>`).join('')}</div>${m.script ? `<p class="mt-help">읽은 문장 “${E(m.script)}”</p>` : ''}` : '<p class="muted">목소리는 상담에서 골라 드려요.</p>'}
          ${sayHTML(m)}
        </div>
        <div class="fit"><h2>어울리는 광고</h2><p>${K(m.fits.join(' · '))}</p>
          ${m.direction ? `<ul>${m.direction.fit.slice(0, 4).map((t) => `<li>${K(t)}</li>`).join('')}</ul>` : ''}
          <label class="sec-h" for="memo">메모 <span class="muted">선택</span></label>
          <textarea class="memo" id="memo" rows="2" placeholder="예: 헤어는 2번인데 조금 더 짧게">${E(s.memo)}</textarea>
          ${pkgBtn(m, 'btn ink wide', '패키지에 담김 · 빼려면 누르기', '이 조합으로 패키지에 넣기')}</div>
      </section>`;
    drawTab(m, tab);
    $('#memo').addEventListener('input', (e) => setSel(m.code, { memo: e.target.value }));
    wireSay(m);
  }
  function drawTab(m, tab) {
    for (const b of $$('[data-act="tab"]')) b.setAttribute('aria-selected', b.dataset.v === tab);
    const body = $('#tab-body');
    if (tab === 'book' || tab === 'dig') {
      bookList = tab === 'dig' ? digOf(m) : bookOf(m);
      body.innerHTML = `<div class="strip pad" id="strip" tabindex="0" aria-label="${tab === 'dig' ? '디지털' : '북'} 사진, 옆으로 넘겨 보세요">${bookList.map((g, i) => `<figure><button type="button" data-act="lb" data-i="${i}" aria-label="${E(g.label)} 크게 보기"><img src="${E(g.l)}" alt="${E(m.name + ' ' + g.label)}" ${i > 2 ? 'loading="lazy"' : ''}></button><figcaption>${K(g.label)}</figcaption></figure>`).join('')}</div>
        <div class="strip-nav pad"><button type="button" class="sq" data-act="strip" data-d="-1" aria-label="이전 사진">←</button><button type="button" class="sq" data-act="strip" data-d="1" aria-label="다음 사진">→</button><span class="count num" id="strip-count">01 / ${pad2(bookList.length)}</span><button type="button" class="link" data-act="strip-grid">한눈에 보기</button></div>`;
      const strip = $('#strip');
      strip.addEventListener('scroll', () => { const i = stripIndex(strip); $('#strip-count').textContent = `${pad2(i + 1)} / ${pad2(bookList.length)}`; }, { passive: true });
      return;
    }
    if (tab === 'scene') {
      bookList = m.scenes.map(sceneShot);
      const tagIds = D.industries.map((i) => i.id).filter((id) => m.scenes.some((s) => s.tags.includes(id)));
      body.innerHTML = `<section class="panel pad"><p class="mt-help">장소·빛·옷을 바꿔 찍은 ${m.scenes.length}장이에요. 업종을 누르면 그 광고에 가까운 장면만 보여요.</p>
        <div class="shot-pick" role="group" aria-label="장면 업종"><button type="button" class="tg" data-act="scene-tag" data-v="" aria-pressed="true">전체</button>${tagIds.map((id) => `<button type="button" class="tg" data-act="scene-tag" data-v="${id}" aria-pressed="false">${E(indLabel(id))} <span class="num">${m.scenes.filter((s) => s.tags.includes(id)).length}</span></button>`).join('')}</div>
        <div class="scene-grid">${m.scenes.map((sc, i) => `<figure class="scene" data-tags="${E(sc.tags.join(' '))}"><button type="button" data-act="lb" data-i="${i}" aria-label="${E(sc.place)} 크게 보기"><img src="${E(sc.s)}" alt="${E(m.name + ' ' + sc.place + ' ' + sc.label)}" loading="lazy"></button><figcaption><b>${K(sc.place)}</b>${K(sc.label)}</figcaption></figure>`).join('')}</div></section>`;
      return;
    }
    if (tab === 'motion') {
      const vids = [...(m.loop ? [{ src: m.loop.src, label: '짧은 움직임', note: '보드에서 사진에 마우스를 올리면 도는 영상이에요' }] : []), ...m.motion];
      body.innerHTML = `<section class="panel pad"><p class="mt-help">짧은 움직임 시안이에요. 소리는 들어 있지 않아요.</p><div class="motions">${vids.map((v) => `<figure><video src="${E(v.src)}" controls muted playsinline loop preload="metadata"></video><figcaption><b>${K(v.label)}</b>${v.note ? K(v.note) : ''}</figcaption></figure>`).join('')}</div></section>`;
      return;
    }
    // 프로필
    const info = [['성별', sexWord(m.gender)], ['나이대', m.age || m.ageBand], ['콘셉트', m.concept], ['키', m.height && m.height + 'cm'], ['몸무게', m.weightKg && m.weightKg + 'kg (설정값)'], ['체형', m.build], ['옷 사이즈', dot(m.sizes.top && '상의 ' + m.sizes.top, m.sizes.bottom && '하의 ' + m.sizes.bottom)], ['신발', m.sizes.shoe && m.sizes.shoe + 'mm'], ['피부 톤', m.skin], ['눈', m.eyes], ['기본 헤어', m.hairBase], ['어울리는 업종', m.fits.join(' · ')]].filter(([, v]) => v);
    const sorted = D.models.filter((x) => x.height).slice().sort((a, b) => a.height - b.height);
    body.innerHTML = `<section class="panel pad prof">
      <div><h2 class="sec-h">기본 정보</h2><dl class="info">${info.map(([k, v]) => `<div><dt>${E(k)}</dt><dd>${K(v)}</dd></div>`).join('')}</dl>
        ${m.face ? `<h2 class="sec-h top">얼굴 기준</h2><dl class="face">${m.face.map((f) => `<div><dt>${E(f.label)}</dt><dd>${K(f.text)}</dd></div>`).join('')}</dl>` : ''}
        ${m.direction ? `<h2 class="sec-h top">어울리는 연출</h2><ul class="dir">${m.direction.fit.map((t) => `<li>${K(t)}</li>`).join('')}</ul>${(m.direction.avoid || []).map((t) => `<p class="avoid">${K(t)}</p>`).join('')}` : ''}
      </div>
      <div><h2 class="sec-h">몸과 비율</h2>${metricsHTML(m)}
        <div class="prof-lineup">${lineupHTML(sorted, { current: m.code, maxH: 300, minK: 1.2 })}</div>
        ${m.bodyNote ? `<p class="mt-help">${K(m.bodyNote)}</p>` : ''}
        ${m.colors ? `<h2 class="sec-h top">색 기준</h2><div class="swatches">${m.colors.map((c) => `<div class="sw"><span class="sw-chip" style="background:${E(c.hex)}"></span><b>${E(c.label)}</b><span class="num">${E(c.hex)}</span>${c.range ? `<span class="sw-range"><i style="background:${E(c.range[0])}"></i><i style="background:${E(c.range[1])}"></i></span>` : ''}</div>`).join('')}</div><p class="mt-help">사진 네 장에서 잰 색이에요. 큰 칸이 기준, 아래 두 칸이 잰 범위예요.</p>` : ''}
      </div></section>`;
    watchLineups(body);
  }
  function metricsHTML(m) {
    const g = sexWord(m.gender);
    const rows = [
      ['키', (x) => x.height, (v) => `${v}<small>cm</small>`, '정수리부터 신발 바닥까지예요.'],
      ['등신', (x) => x.body && x.body.heads, (v) => v.toFixed(2), '키를 머리 길이로 나눈 값이에요. 클수록 머리가 작아 보여요.'],
      ['어깨 ÷ 얼굴 폭', (x) => x.body && x.body.shoulderFace, (v) => v.toFixed(2), '클수록 어깨가 넓어 보여요.'],
      ['다리 비율', (x) => x.body && x.body.leg, (v) => v.toFixed(3), '골반 관절부터 바닥까지를 키로 나눈 값이에요.'],
    ];
    return `<div class="metrics">${rows.map(([label, pick, fmt, help]) => {
      const v = pick(m); if (v == null) return '';
      const r = L.rankAmong(D.models, m, pick);
      let bar = '', note = '';
      if (r) {
        const pos = (x) => (r.max === r.min ? 50 : ((x - r.min) / (r.max - r.min)) * 100);
        const peers = D.models.filter((x) => x.gender === m.gender && pick(x) != null);
        bar = `<div class="rb" aria-hidden="true"><span class="rb-track"></span>${peers.map((x) => `<span class="rb-dot${x.code === m.code ? ' me' : ''}" style="left:${pos(pick(x)).toFixed(1)}%"></span>`).join('')}</div>`;
        note = r.lowest ? `${g} 모델 ${r.count}명 중 가장 작아요` : r.highest ? `${g} 모델 ${r.count}명 중 가장 커요` : `${g} 모델 ${r.count}명 사이`;
      }
      return `<div class="metric"><div class="mt-top"><span class="mt-label">${E(label)}</span><span class="mt-val num">${fmt(v)}</span></div>${bar}<p class="mt-help">${E(help)}${note ? ` <b>${E(note)}</b>` : ''}</p></div>`;
    }).join('')}</div>`;
  }
  function stripIndex(strip) {
    const figs = $$('figure', strip), padL = parseFloat(getComputedStyle(strip).paddingLeft) || 0, x = strip.scrollLeft + 4;
    if (strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 4) return figs.length - 1;
    let i = 0; figs.forEach((f, j) => { if (f.offsetLeft - padL <= x) i = j; });
    return i;
  }
  function stepStrip(d) {
    const strip = $('#strip'); if (!strip) return;
    const figs = $$('figure', strip), i = Math.max(0, Math.min(figs.length - 1, stripIndex(strip) + d));
    strip.scrollTo({ left: figs[i].offsetLeft - (parseFloat(getComputedStyle(strip).paddingLeft) || 0), behavior: 'smooth' });
  }

  /* ── 우리 광고 문장 ───────────────────────────────────── */
  // 문장은 늘 적어 둘 수 있고(문의 글에 들어간다), 읽어 주는 서버가 있고 그 목소리가 준비돼 있을 때만 바로 들려준다.
  const sayApi = (D.say && D.say.api) || '';
  const sayMax = (D.say && D.say.max) || 60;
  const canSay = (m, i) => !!(sayApi && m.voices[i] && m.voices[i].say);
  function sayNote(m) {
    const i = selOf(m.code).voice;
    if (canSay(m, i)) return `고른 목소리(${i + 1}번)로 바로 읽어 드려요. ${sayMax}자까지, 하루 ${(D.say && D.say.daily) || 10}번까지예요.`;
    return '적어 두면 문의 글에 같이 들어가요. 고른 목소리로 이 문장을 만들어 보내 드려요.';
  }
  function sayHTML(m) {
    if (!m.voices.length) return '';
    const i = selOf(m.code).voice;
    return `<form class="say" id="say" autocomplete="off"><label class="sec-h" for="say-in">우리 광고 문장으로 듣기 <span class="muted">선택</span></label>
      <div class="row"><input id="say-in" maxlength="${sayMax}" value="${E(selOf(m.code).line || '')}" placeholder="예: 이번 주말, 딸기 라떼 한 잔 어때요?"><button type="submit" class="btn ink sm" id="say-go" data-act="say" aria-pressed="false"${canSay(m, i) ? '' : ' hidden'}>듣기</button></div>
      <small id="say-note">${E(sayNote(m))}</small></form>`;
  }
  function syncSay(m) {
    const go = $('#say-go'); if (!go) return;
    go.hidden = !canSay(m, selOf(m.code).voice);
    $('#say-note').textContent = sayNote(m);
  }
  function wireSay(m) {
    const f = $('#say'); if (!f) return;
    $('#say-in').addEventListener('input', (e) => setSel(m.code, { line: e.target.value.trim() }));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = $('#say-in').value.trim(), btn = $('#say-go'), note = $('#say-note');
      const v = selOf(m.code).voice;
      if (!text) { $('#say-in').focus(); return; }
      if (!canSay(m, v)) { note.textContent = sayNote(m); return; }
      btn.disabled = true; btn.textContent = '만드는 중';
      try {
        const res = await fetch(sayApi, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: m.code, voice: v, text }) });
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw Error(j.message || '지금은 만들 수 없어요. 잠시 뒤 다시 눌러 주세요.'); }
        const url = URL.createObjectURL(await res.blob());
        await playSrc(url, 'say', () => [btn]);
        note.textContent = `${v + 1}번 ${m.voices[v].label} 목소리로 읽었어요. 문장은 문의 글에도 들어가요.`;
      } catch (err) { note.textContent = err.message; }
      btn.disabled = false; btn.textContent = '듣기';
    });
  }

  /* ── 패키지 ───────────────────────────────────────────── */
  let pkgMode = 'cards', cmpShot = 'hero';
  // 공유 주소: #p-F02.1.0~F04.0.2 (코드.헤어.목소리)
  const shareCode = (items) => items.map((x) => `${x.code}.${x.hair}.${x.voice}`).join('~');
  function readShare(s) {
    return String(s || '').split('~').map((t) => { const [code, h, v] = t.split('.'); const m = byCode(code); return m && { code, hair: Math.min(Number(h) || 0, m.hair.length - 1), voice: Math.min(Number(v) || 0, Math.max(0, m.voices.length - 1)), memo: '' }; }).filter(Boolean);
  }
  const myItems = () => state.pkg.map((c) => ({ code: c, ...selOf(c) }));
  function cardHTML(x, shared) {
    const m = byCode(x.code), hairShot = m.shots['hair-' + (x.hair + 1)] || m.hero;
    const side = [m.shots['exp-smile'] || m.shots['look-1'], m.shots['fullbody'] || m.shots['look-2']].filter(Boolean);
    const cells = compCells(m);
    const v = m.voices[x.voice];
    return `<article class="comp-card" data-code="${E(m.code)}">
      <div class="cc-photos"><img src="${E(hairShot.l)}" alt="${E(m.name)} ${E(hairShot.label || '')}" loading="lazy">${side.map((s) => `<img src="${E(s.s)}" alt="" loading="lazy">`).join('')}</div>
      <div class="cc-body">
        <div class="cc-top"><h2>${E(m.name)}</h2><span class="num">${E(m.code)}${m.realPerson ? ' · 실제 인물' : ''}</span></div>
        <p class="cc-who">${K(whoOf(m))}</p>
        <dl class="cc-comp">${cells.map(([k, val]) => `<div><dt>${E(k)}</dt><dd class="num">${val}</dd></div>`).join('')}</dl>
        <dl class="cc-pick">
          <dt>헤어</dt><dd>${x.hair + 1} · ${K(m.hair[x.hair].label)}</dd>
          ${v ? `<dt>목소리</dt><dd style="display:flex;align-items:center;gap:10px">${voiceBtn(m, x.voice)}${x.voice + 1} · ${K(v.label)}</dd>` : ''}
          <dt>어울림</dt><dd>${K(m.fits.slice(0, 3).join(' · '))}</dd>
          ${m.direction ? `<dt>연출</dt><dd>${K(m.direction.fit.slice(0, 2).join(' · '))}</dd>` : ''}
          ${x.line ? `<dt>문장</dt><dd>“${E(x.line)}”</dd>` : ''}
          ${x.memo ? `<dt>메모</dt><dd>${E(x.memo)}</dd>` : ''}
        </dl>
        <div class="cc-row">
          <a class="btn line sm" href="#m-${E(m.code)}">모델 북</a>
          <button type="button" class="btn line sm" data-act="save-card" data-code="${E(m.code)}">이미지로 저장</button>
          ${shared ? '' : `<button type="button" class="link muted" data-act="pkg-rm" data-code="${E(m.code)}">빼기</button>`}
        </div>
      </div></article>`;
  }
  function compareHTML(items) {
    const list = items.map((x) => byCode(x.code));
    const n = list.length;
    const shots = D.compareShots.filter((s) => list.some((m) => m.shots[s.key]));
    if (!shots.some((s) => s.key === cmpShot)) cmpShot = 'hero';
    const brief = state.ask.trim() ? L.recommend(list, { product: state.ask, industry: '', moods: [] }, TAX, 9) : [];
    const row = (label, fn) => `<div class="lab">${E(label)}</div>${list.map((m) => `<div class="c">${fn(m) || '<span class="muted">—</span>'}</div>`).join('')}`;
    const num = (pick, fmt) => (m) => { const v = pick(m); return v == null ? '' : `<span class="big num">${fmt(v)}</span>`; };
    return `<div class="shot-pick pad" role="group" aria-label="같은 컷 고르기">${shots.map((s) => `<button type="button" class="tg" data-act="cmp-shot" data-v="${s.key}" aria-pressed="${s.key === cmpShot}">${E(s.label)}</button>`).join('')}</div>
      <div class="compare-wrap pad"><div class="cmp" style="--n:${n}">
        ${list.map((m) => { const s = m.shots[cmpShot] || m.hero; return `<div class="c photo"><a href="#m-${E(m.code)}" aria-label="${E(m.name)} 모델 북"><img src="${E(s.l)}" alt="${E(m.name + ' ' + (s.label || ''))}"></a></div>`; }).join('')}
        ${list.map((m) => `<div class="c name"><b>${E(m.name)}</b>${K(dot(m.code, sexWord(m.gender), m.age || m.ageBand, m.concept))}</div>`).join('')}
        <div class="wide">${lineupHTML(list, { maxH: 400, cols: true })}</div>
        ${brief.length ? row('광고 내용과 맞는 점', (m) => { const r = brief.find((y) => y.model.code === m.code); return r ? K(r.reasons.map((y) => y.text).join(' · ')) : '<span class="muted">겹치는 점이 적어요</span>'; }) : ''}
        ${row('인상', (m) => K(m.impression.join(' · ')))}
        ${row('키', num((m) => m.height, (v) => `${v}<small>cm</small>`))}
        ${row('등신', num((m) => m.body && m.body.heads, (v) => v.toFixed(2)))}
        ${row('어깨 ÷ 얼굴 폭', num((m) => m.body && m.body.shoulderFace, (v) => v.toFixed(2)))}
        ${row('다리 비율', num((m) => m.body && m.body.leg, (v) => v.toFixed(3)))}
        ${row('옷·신발', (m) => K(dot(m.sizes.top && '상의 ' + m.sizes.top, m.sizes.bottom && '하의 ' + m.sizes.bottom, m.sizes.shoe && '신발 ' + m.sizes.shoe)))}
        ${row('고른 헤어', (m) => { const h = items.find((x) => x.code === m.code).hair; return K(`${h + 1} · ${m.hair[h].label}`); })}
        ${row('고른 목소리', (m) => { const i = items.find((x) => x.code === m.code).voice; return m.voices[i] ? `<span style="display:flex;align-items:center;gap:10px">${voiceBtn(m, i)}${K(`${i + 1} · ${m.voices[i].label}`)}</span>` : ''; })}
        ${row('어울리는 업종', (m) => K(m.fits.join(' · ')))}
      </div></div>`;
  }
  function inquiryOf(items) {
    return L.inquiryText({ picks: items, models: D.models, brief: { product: state.ask, industry: '', moods: [], touched: !!state.ask.trim() }, compare: [], taxonomy: TAX, format: state.format });
  }
  const topLevel = (() => { try { return window.top === window.self && /^https?:/.test(location.protocol); } catch { return false; } })();
  const shareBase = topLevel ? `${location.origin}${location.pathname}${location.search}` : (D.shareBase || '');
  const canShareLink = !!shareBase;
  let downloads = null;
  try { if (window.claude && typeof window.claude.use === 'function') window.claude.use('downloads').then((x) => { downloads = x; }, () => {}); } catch { /* 일반 브라우저 */ }
  function renderPkg(anchor = '', shared = null) {
    const items = shared || myItems();
    const n = items.length;
    if (!n) {
      view.innerHTML = `<section class="pk-head pad"><div><h1>패키지<sup class="num">0</sup></h1><p>마음에 드는 모델을 담으면 여기에서 한 장짜리 컴프 카드로 정리하고, 나란히 비교하고, 문의 글로 보낼 수 있어요.</p></div></section>
        <section class="empty pad"><h2>아직 담은 모델이 없어요</h2><p>보드에서 사진 위 「+ 패키지」를 누르거나, 한 명씩 넘기며 오른쪽으로 밀어 담아 보세요.</p><div class="pk-acts"><a class="btn ink" href="#swipe">넘기며 고르기</a><a class="btn line" href="#board">모델 보드</a></div></section>
        ${inqHTML([])}`;
      wireInq([]);
      if (anchor === 'inq') $('#inq')?.scrollIntoView({ block: 'start' });
      return;
    }
    view.innerHTML = `
      <section class="pk-head pad">
        <div><h1>${shared ? '받은 패키지' : '패키지'}<sup class="num">${n}</sup></h1>
          <p>${shared ? '공유받은 모델 조합이에요. 내 패키지로 담아 고치거나, 이대로 문의할 수 있어요.' : '모델마다 한 장짜리 컴프 카드로 정리했어요. 이미지로 저장해 팀에 공유하거나, 문의 글로 바로 보낼 수 있어요.'}</p></div>
        <div class="pk-acts">
          ${shared ? '<button type="button" class="btn ink" data-act="take-share">내 패키지로 담기</button>' : ''}
          <button type="button" class="btn line" data-act="save-sheet">한 장으로 저장</button>
          ${canShareLink ? '<button type="button" class="btn line" data-act="share-link">공유 링크 복사</button>' : ''}
          <a class="btn ink" href="#pkg-inq" data-act="to-inq">문의 글 보기</a>
        </div>
      </section>
      <div class="pad" style="padding-top:18px"><div class="pk-modes" role="group" aria-label="보기"><button type="button" class="tg" data-act="pk-mode" data-v="cards" aria-pressed="${pkgMode === 'cards'}">컴프 카드</button><button type="button" class="tg" data-act="pk-mode" data-v="compare" aria-pressed="${pkgMode === 'compare'}"${n < 2 ? ' disabled title="두 명부터 나란히 볼 수 있어요"' : ''}>나란히 비교</button></div></div>
      <div id="pk-body">${pkgMode === 'compare' && n > 1 ? compareHTML(items) : `<div class="cards pad">${items.map((x) => cardHTML(x, !!shared)).join('')}</div>`}</div>
      ${inqHTML(items)}`;
    watchLineups(view);
    wireInq(items);
    view.dataset.shared = shared ? shareCode(shared) : '';
    if (anchor === 'inq') requestAnimationFrame(() => $('#inq')?.scrollIntoView({ block: 'start' }));
  }
  function inqHTML(items) {
    return `<section class="inq pad" id="inq" aria-labelledby="inq-title">
      <div><h2 id="inq-title">문의 글</h2>
        <p>${items.length ? '담은 모델과 고른 헤어·목소리, 보드에 적은 광고 내용이 들어가요. 복사해서 붙여 넣기만 하면 돼요. 이 페이지에서 자동으로 보내지는 않아요.' : '아직 담은 모델이 없어요. 새 모델이 필요하거나 상담부터 받고 싶다면 이 글로 시작해 주세요.'}</p>
        <div class="fmt" role="group" aria-label="글 모양"><button type="button" class="tg" data-act="format" data-v="kmong" aria-pressed="${state.format === 'kmong'}">크몽 메시지</button><button type="button" class="tg" data-act="format" data-v="order" aria-pressed="${state.format === 'order'}">발주서 메모</button></div>
      </div>
      <div><label class="sec-h" for="inq-text">보낼 글</label><textarea id="inq-text" readonly rows="10"></textarea>
        <div class="row"><button type="button" class="btn ink" data-act="copy-inq">글 복사하기</button><span class="mt-help" id="inq-where"></span></div></div>
    </section>`;
  }
  function wireInq(items) {
    const ta = $('#inq-text'); if (!ta) return;
    ta.value = items.length ? inquiryOf(items) : newModelText();
    $('#inq-where').textContent = state.format === 'order' ? '발주서 「장면·모델」 메모 칸에 붙여 넣어 주세요.' : '크몽 메시지 창에 그대로 붙여 넣어 주세요.';
  }
  function newModelText() {
    const blocks = [['안녕하세요. PULSE 모델 캐스팅북을 보고 문의드려요.'], ['[찾는 모델]', '성별·나이대: ', '분위기: ']];
    if (state.ask.trim()) blocks.push(['[광고 내용]', `제품·서비스: ${state.ask.trim()}`]);
    blocks.push(['상담에서 함께 정하고 싶은 것: 사용 매체와 기간, 업종 전속 여부, 사진·영상 수량']);
    return blocks.map((x) => x.join('\n')).join('\n\n');
  }

  /* ── 컴프 카드 이미지(그림판에 직접 그린다) ─────────────── */
  const FONT = "'SYNK Latin','SUIT Variable',system-ui,sans-serif";
  function loadImg(src) {
    return new Promise((ok) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
  }
  function cover(ctx, img, x, y, w, h, focusY = 0.3) {
    ctx.fillStyle = '#F2F2F0'; ctx.fillRect(x, y, w, h);
    if (!img) return;
    const r = Math.max(w / img.width, h / img.height), sw = w / r, sh = h / r;
    ctx.drawImage(img, (img.width - sw) / 2, Math.max(0, (img.height - sh) * focusY), sw, sh, x, y, w, h);
  }
  const fontsReady = () => (document.fonts ? Promise.all([`600 40px ${FONT}`, `450 20px ${FONT}`, `550 20px ${FONT}`].map((f) => document.fonts.load(f, '가나A1').catch(() => {}))) : Promise.resolve());
  function text(ctx, s, x, y, size, weight = 450, color = '#0F0F0F', maxW = 0) {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic';
    let t = String(s);
    if (maxW) while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -2) + '…';
    ctx.fillText(t, x, y);
    return ctx.measureText(t).width;
  }
  function wrap(ctx, s, x, y, size, maxW, lh, weight = 450, color = '#45453F', maxLines = 3) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    const words = String(s).split(' '); let line = '', n = 0;
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { text(ctx, line, x, y + n * lh, size, weight, color); line = w; n++; if (n >= maxLines) return n; } else line = t;
    }
    if (line) { text(ctx, line, x, y + n * lh, size, weight, color, maxW); n++; }
    return n;
  }
  async function drawCard(x) {
    const m = byCode(x.code), W = 1800, H = 1200, P = 56;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    const hairShot = m.shots['hair-' + (x.hair + 1)] || m.hero;
    const sides = [m.shots['exp-smile'] || m.shots['look-1'], m.shots['fullbody'] || m.shots['look-2']].filter(Boolean);
    const [main, ...rest] = await Promise.all([loadImg(hairShot.l), ...sides.map((s) => loadImg(s.l))]);
    await fontsReady();
    // 사진: 큰 대표 + 작은 두 장
    const bigW = 780, smallW = 380, ph = H - P * 2;
    cover(ctx, main, P, P, bigW, ph);
    rest.forEach((img, i) => cover(ctx, img, P + bigW + 12, P + i * ((ph - 12) / 2 + 12), smallW, (ph - 12) / 2, i === 1 ? 0.15 : 0.3));
    // 글
    const X = P + bigW + 12 + smallW + 48, R = W - P, TW = R - X;
    text(ctx, 'SYNK PULSE · MODEL', X, P + 22, 20, 550, '#77776F');
    text(ctx, m.code + (m.realPerson ? ' · 실제 인물' : ''), R - ctx.measureText(m.code + (m.realPerson ? ' · 실제 인물' : '')).width, P + 22, 20, 550, '#77776F');
    text(ctx, m.name, X - 4, P + 140, 104, 600, '#0F0F0F', TW);
    let y = P + 140 + 50;
    y += 30 * wrap(ctx, whoOf(m), X, y, 22, TW, 30, 450, '#45453F', 2);
    y += 18;
    ctx.fillStyle = '#0F0F0F'; ctx.fillRect(X, y, TW, 3); y += 3;
    const plain = (h) => h.replace(/<span[^>]*><\/span>/g, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    const cells = compCells(m).map(([k, v]) => [k, plain(v)]);
    const colW = TW / 3, colors = { 머리: colorOf(m, '머리'), 피부: colorOf(m, '피부'), 입술: colorOf(m, '입술') };
    cells.forEach(([k, v], i) => {
      const cx = X + (i % 3) * colW, cy = y + Math.floor(i / 3) * 86;
      if (i % 3) { ctx.fillStyle = '#E4E4E0'; ctx.fillRect(cx - 1, cy + 14, 1, 60); }
      text(ctx, k, cx + (i % 3 ? 16 : 0), cy + 40, 18, 450, '#77776F');
      let vx = cx + (i % 3 ? 16 : 0);
      if (colors[k]) { ctx.fillStyle = colors[k]; ctx.beginPath(); ctx.arc(vx + 10, cy + 68, 10, 0, Math.PI * 2); ctx.fill(); vx += 28; }
      text(ctx, v, vx, cy + 76, 26, 550, '#0F0F0F', colW - 30);
      if (i % 3 === 2 || i === cells.length - 1) { ctx.fillStyle = '#E4E4E0'; ctx.fillRect(X, cy + 85, TW, 1); }
    });
    y += Math.ceil(cells.length / 3) * 86 + 40;
    const pick = [['헤어', `${x.hair + 1} · ${m.hair[x.hair].label}`], m.voices[x.voice] && ['목소리', `${x.voice + 1} · ${m.voices[x.voice].label}`], ['어울리는 업종', m.fits.slice(0, 3).join(' · ')], m.direction && ['연출', m.direction.fit.slice(0, 2).join(' · ')], x.line && ['문장', `“${x.line}”`], x.memo && ['메모', x.memo]].filter(Boolean);
    for (const [k, v] of pick) { text(ctx, k, X, y, 20, 450, '#77776F'); y += 6; y += 34 * wrap(ctx, v, X + 150, y - 6, 24, TW - 150, 34, 550, '#0F0F0F', 2) + 10; }
    // 바닥: 브랜드·표시
    ctx.fillStyle = '#A3265F'; ctx.fillRect(X, H - P - 74, 36, 4);
    wrap(ctx, m.realPerson ? '실제 인물을 바탕으로, 본인 동의를 받아 만든 모델이에요.' : 'AI로 만든 가상인물이에요. 광고에는 가상인물 표시가 필요해요.', X, H - P - 36, 18, TW, 26, 450, '#77776F', 2);
    return c;
  }
  async function drawSheet(items) {
    const n = items.length, colW = 520, gap = 24, P = 56, W = P * 2 + n * colW + (n - 1) * gap;
    const rowsMax = Math.max(...items.map((x) => (byCode(x.code).voices[x.voice] ? 4 : 3)));
    const H = P + 64 + colW * 4 / 3 + 76 + 40 + 26 + rowsMax * 44 + 40 + 60 + P;
    const c = document.createElement('canvas'); c.width = Math.min(W, 6000); c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, H);
    const imgs = await Promise.all(items.map((x) => { const m = byCode(x.code); return loadImg((m.shots['hair-' + (x.hair + 1)] || m.hero).l); }));
    await fontsReady();
    text(ctx, 'SYNK PULSE · 모델 패키지', P, P + 28, 26, 600);
    ctx.font = `550 26px ${FONT}`; text(ctx, `${n}명`, W - P - ctx.measureText(`${n}명`).width, P + 28, 26, 550, '#77776F');
    items.forEach((x, i) => {
      const m = byCode(x.code), X = P + i * (colW + gap), Y = P + 64;
      cover(ctx, imgs[i], X, Y, colW, colW * 4 / 3);
      let y = Y + colW * 4 / 3 + 76;
      text(ctx, m.name, X, y, 60, 600); ctx.font = `550 20px ${FONT}`; text(ctx, m.code, X + colW - ctx.measureText(m.code).width, y, 20, 550, '#77776F');
      y += 40; text(ctx, dot(sexWord(m.gender), m.age || m.ageBand, m.concept), X, y, 22, 450, '#45453F', colW);
      y += 26; ctx.fillStyle = '#0F0F0F'; ctx.fillRect(X, y, colW, 2);
      const rows = [['키', m.height ? m.height + 'cm' : '—'], ['헤어', `${x.hair + 1} · ${m.hair[x.hair].label}`], m.voices[x.voice] && ['목소리', `${x.voice + 1} · ${m.voices[x.voice].label}`], ['어울림', m.fits.slice(0, 2).join(' · ')]].filter(Boolean);
      rows.forEach(([k, v], j) => { const ry = y + 44 + j * 44; text(ctx, k, X, ry, 19, 450, '#77776F'); text(ctx, v, X + 92, ry, 22, 550, '#0F0F0F', colW - 92); ctx.fillStyle = '#E4E4E0'; ctx.fillRect(X, ry + 16, colW, 1); });
    });
    text(ctx, 'AI로 만든 가상인물이 포함돼 있어요. 광고에는 가상인물 표시가 필요해요.', P, H - P + 10, 18, 450, '#77776F');
    return c;
  }
  async function exportCanvas(make, name) {
    const d = $('#export');
    d.innerHTML = '<div class="ex-top"><p>이미지를 만드는 중이에요…</p><button type="button" class="btn line sm" data-act="ex-close">닫기</button></div>';
    if (!d.open) d.showModal();
    let blob = null;
    try { const c = await make(); blob = await new Promise((ok) => c.toBlob(ok, 'image/png')); } catch { blob = null; }
    if (!blob) { d.innerHTML = '<div class="ex-top"><p>이 화면에서는 이미지를 만들지 못했어요. 화면을 캡처하거나 문의 글로 보내 주세요.</p><button type="button" class="btn line sm" data-act="ex-close">닫기</button></div>'; return; }
    const url = URL.createObjectURL(blob), file = `${name}.png`;
    let canShare = false;
    try { canShare = topLevel && !!(navigator.canShare && navigator.canShare({ files: [new File([blob], file, { type: 'image/png' })] })); } catch { canShare = false; }
    const canCopy = typeof ClipboardItem === 'function' && !!(navigator.clipboard && navigator.clipboard.write);
    d.innerHTML = `<div class="ex-top"><p>${downloads || topLevel ? '저장 단추가 안 되면 이미지를 길게 누르거나 오른쪽 클릭으로 저장해 주세요.' : '이미지를 길게 누르거나 오른쪽 클릭해서 저장해 주세요. 「이미지 복사」 뒤 메신저에 바로 붙여 넣어도 돼요.'}</p><span class="pk-acts">${canCopy ? '<button type="button" class="btn line sm" data-act="ex-copy">이미지 복사</button>' : ''}${canShare ? '<button type="button" class="btn line sm" data-act="ex-share">보내기</button>' : ''}${downloads ? '<button type="button" class="btn ink sm" data-act="ex-save">이미지 저장</button>' : topLevel ? `<a class="btn ink sm" href="${url}" download="${E(file)}">이미지 저장</a>` : ''}<button type="button" class="btn line sm" data-act="ex-close">닫기</button></span></div><img src="${url}" alt="${E(name)}">`;
    d.dataset.file = file; d.dataset.url = url; exportCanvas.blob = blob;
    d.setAttribute('aria-label', name);
  }

  /* ── 넘기며 고르기 ────────────────────────────────────── */
  let deck = [], deckAt = 0, deckPhoto = 0, deckTaken = [], deckKey = '';
  const deckSig = () => JSON.stringify([state.ask.trim(), filters]);
  function startDeck() {
    deckKey = deckSig();
    const { order, recs } = ranked();
    deck = order.map((m) => ({ m, r: recs.find((x) => x.model.code === m.code) || null }));
    deckAt = 0; deckPhoto = 0; deckTaken = [];
  }
  const deckPhotos = (m) => [m.hero, m.shots['exp-smile'], m.shots['look-1'], m.shots['fullbody'], m.scenes[0]].filter(Boolean);
  function renderSwipe() {
    if (!deck.length || deckKey !== deckSig()) startDeck();
    view.innerHTML = `<section class="deck-wrap pad" aria-label="넘기며 고르기"><div class="deck-top"><b>넘기며 고르기</b><span class="num" id="deck-n"></span></div><div class="deck-prog"><i id="deck-prog"></i></div><div id="deck-body" style="display:contents"></div></section>`;
    drawDeck();
  }
  function drawDeck() {
    const body = $('#deck-body'); if (!body) return;
    $('#deck-n').textContent = deckAt < deck.length ? `${deckAt + 1} / ${deck.length}` : `${deck.length} / ${deck.length}`;
    $('#deck-prog').style.width = `${(Math.min(deckAt, deck.length) / deck.length) * 100}%`;
    if (deckAt >= deck.length) {
      const took = deckTaken.map(byCode);
      body.innerHTML = `<div class="deck-end"><h2>${took.length ? `${took.length}명을 패키지에 담았어요` : '담은 모델이 없어요'}</h2>
        ${took.length ? `<div class="deck-faces">${took.map((m) => `<img src="${E(m.hero.s)}" alt="${E(m.name)}">`).join('')}</div>` : '<p class="mt-help">조건을 바꾸거나 처음부터 다시 볼 수 있어요.</p>'}
        <div class="pk-acts">${state.pkg.length ? `<a class="btn ink" href="#pkg">패키지 보기 <span class="num">${state.pkg.length}</span></a>` : ''}<button type="button" class="btn line" data-act="deck-restart">처음부터 다시</button><a class="btn line" href="#board">모델 보드</a></div></div>`;
      return;
    }
    const cur = deck[deckAt], next = deck[deckAt + 1];
    const photos = deckPhotos(cur.m), p = photos[deckPhoto % photos.length];
    body.innerHTML = `<div class="deck" id="deck">
        ${next ? `<div class="dcard under" aria-hidden="true"><img src="${E(next.m.hero.l)}" alt=""></div>` : ''}
        <div class="dcard" id="dcard" role="group" aria-label="${E(cur.m.name)}">
          <img src="${E(p.l)}" alt="${E(cur.m.name)}">
          <span class="stamp yes" id="st-yes">담기</span><span class="stamp no" id="st-no">넘기기</span>
          <div class="meta"><b>${E(cur.m.name)}</b><span>${K(dot(cur.m.height && cur.m.height + 'cm', cur.m.age || cur.m.ageBand, cur.m.concept))}</span>${cur.r ? `<span class="why">${K(whyOf(cur.r))}</span>` : `<span>${K(cur.m.impression.join(' · '))}</span>`}</div>
        </div>
      </div>
      <div class="deck-acts"><button type="button" class="btn line" data-act="deck-no">넘기기</button><a class="btn line" href="#m-${E(cur.m.code)}">자세히</a><button type="button" class="btn ink" data-act="deck-yes">${inPkg(cur.m.code) ? '담겨 있음 · 다음' : '패키지에 담기'}</button></div>
      <p class="deck-hint">사진을 누르면 다른 컷 (${deckPhoto % photos.length + 1}/${photos.length}) · 오른쪽으로 밀면 담기, 왼쪽은 넘기기</p>`;
    const img = new Image(); if (next) img.src = next.m.hero.l; // 다음 사진 미리 받기
    wireDrag($('#dcard'));
  }
  function deckDecide(yes) {
    const card = $('#dcard'), cur = deck[deckAt]; if (!cur) return;
    if (yes && !inPkg(cur.m.code)) { state.pkg.push(cur.m.code); save(); syncPkg(); }
    if (yes && !deckTaken.includes(cur.m.code)) deckTaken.push(cur.m.code);
    const fly = () => { deckAt++; deckPhoto = 0; drawDeck(); };
    if (card && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      card.style.transition = 'transform .28s ease-in, opacity .28s';
      card.style.transform = `translateX(${yes ? 130 : -130}%) rotate(${yes ? 14 : -14}deg)`; card.style.opacity = '0';
      setTimeout(fly, 240);
    } else fly();
  }
  function wireDrag(card) {
    if (!card) return;
    let x0 = 0, y0 = 0, dx = 0, drag = false, id = null, moved = false;
    const yes = $('#st-yes'), no = $('#st-no');
    card.addEventListener('pointerdown', (e) => { drag = true; moved = false; id = e.pointerId; x0 = e.clientX; y0 = e.clientY; dx = 0; card.style.transition = 'none'; });
    card.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== id) return;
      dx = e.clientX - x0; const dy = e.clientY - y0;
      if (!moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { moved = true; try { card.setPointerCapture(id); } catch { /* 무시 */ } }
      if (!moved) return;
      card.style.transform = `translateX(${dx}px) rotate(${dx / 22}deg)`;
      yes.style.opacity = Math.max(0, Math.min(1, dx / 90)); no.style.opacity = Math.max(0, Math.min(1, -dx / 90));
    });
    const end = (e) => {
      if (!drag || (e && e.pointerId !== id)) return; drag = false;
      if (moved && Math.abs(dx) > Math.min(120, card.clientWidth * 0.28)) { deckDecide(dx > 0); return; }
      card.style.transition = ''; card.style.transform = ''; yes.style.opacity = 0; no.style.opacity = 0;
      if (!moved && e && e.type === 'pointerup') { deckPhoto++; const cur = deck[deckAt], ph = deckPhotos(cur.m); $('img', card).src = ph[deckPhoto % ph.length].l; const h = $('.deck-hint'); if (h) h.textContent = `사진을 누르면 다른 컷 (${deckPhoto % ph.length + 1}/${ph.length}) · 오른쪽으로 밀면 담기, 왼쪽은 넘기기`; }
    };
    card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  }

  /* ── 경로 ─────────────────────────────────────────────── */
  let route = 'board', curModel = '', boardY = 0;
  const jump = (y) => { try { window.scrollTo({ top: y, left: 0, behavior: 'instant' }); } catch { window.scrollTo(0, y); } };
  const go = (h) => { if (location.hash !== h) location.hash = h; else render(); };
  function render() {
    const h = decodeURIComponent(location.hash || '');
    const prev = route;
    if (prev === 'board' || prev === 'lineup') boardY = window.scrollY;
    stopAudio();
    if ($('#lightbox').open) $('#lightbox').close();
    if ($('#export').open) $('#export').close();
    const old = h.match(/^#([A-Z]\d\d)$/);
    const parts = (old ? ['m', old[1]] : h.replace(/^#\/?/, '').split(/[-/]/)).filter(Boolean);
    route = parts[0] || 'board'; curModel = '';
    let nav = 'board';
    if (route === 'm' && byCode(parts[1])) { curModel = parts[1]; renderBook(parts[1], parts[2]); nav = ''; jump(0); }
    else if (route === 'pkg') { renderPkg(parts[1]); nav = 'pkg'; if (parts[1] !== 'inq') jump(0); }
    else if (route === 'p') { renderPkg(parts[2], readShare(parts[1])); nav = 'pkg'; jump(0); }
    else if (route === 'swipe') { renderSwipe(); nav = 'swipe'; jump(0); }
    else if (route === 'lineup') { renderBoard('lineup'); nav = 'lineup'; jump(prev === 'm' ? boardY : 0); }
    else if (route === 'guide') { renderBoard('board', 'guide'); nav = 'guide'; }
    else { route = 'board'; renderBoard('board'); jump(prev === 'm' ? boardY : 0); }
    for (const x of $$('[data-nav]')) { if (x.dataset.nav === nav) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current'); }
    syncPkg();
  }
  window.addEventListener('hashchange', render);

  /* ── 누르기 ───────────────────────────────────────────── */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const act = t.dataset.act, code = t.dataset.code, v = t.dataset.v;
    const curCode = curModel;
    switch (act) {
      case 'pkg': e.preventDefault(); togglePkg(code); break;
      case 'skip': e.preventDefault(); $('#view').focus(); break;
      case 'eg': state.ask = v; save(); $('#q').value = v; drawBoard(route === 'lineup' ? 'lineup' : 'board'); break;
      case 'ask-clear': state.ask = ''; save(); $('#q').value = ''; drawBoard(route === 'lineup' ? 'lineup' : 'board'); $('#q').focus(); break;
      case 'filters-clear': for (const k of Object.keys(filters)) filters[k] = ''; for (const s of $$('.filters select')) s.value = ''; drawBoard(route === 'lineup' ? 'lineup' : 'board'); break;
      case 'new-model': copy(newModelText(), '새 모델 문의 글을 복사했어요. 크몽 메시지에 붙여 넣어 주세요.'); break;
      case 'ask-this': if (!inPkg(code)) { state.pkg.push(code); save(); } break;
      case 'tab': drawTab(byCode(curCode), v); try { history.replaceState(null, '', `#m-${curCode}-${v}`); } catch { /* 무시 */ } break;
      case 'strip': stepStrip(Number(t.dataset.d)); break;
      case 'strip-grid': { const s = $('#strip'); const on = s.classList.toggle('grid'); t.textContent = on ? '옆으로 넘겨 보기' : '한눈에 보기'; $$('.strip-nav .sq, #strip-count').forEach((x) => { x.hidden = on; }); break; }
      case 'lb': { const m = byCode(curCode); openLb(bookList, Number(t.dataset.i), m ? m.name : ''); break; }
      case 'lb-step': lbIndex = (lbIndex + Number(t.dataset.d) + lbList.length) % lbList.length; drawLb(); break;
      case 'lb-close': $('#lightbox').close(); break;
      case 'scene-tag': for (const b of $$('[data-act="scene-tag"]')) b.setAttribute('aria-pressed', b === t); for (const f of $$('.scene')) f.hidden = !!v && !f.dataset.tags.split(' ').includes(v); break;
      case 'hair': setSel(curCode, { hair: Number(t.dataset.i) }); for (const b of $$('[data-act="hair"]')) b.setAttribute('aria-pressed', b === t); break;
      case 'vsel': setSel(curCode, { voice: Number(t.dataset.i) }); for (const b of $$('[data-act="vsel"]')) { const on = b === t; b.setAttribute('aria-pressed', on); b.textContent = on ? '고름' : '고르기'; } syncSay(byCode(curCode)); break;
      case 'voice': toggleVoice(t); break;
      case 'pk-mode': if (t.disabled) break; pkgMode = v; stopAudio(); { const items = view.dataset.shared ? readShare(view.dataset.shared) : myItems(); $('#pk-body').innerHTML = pkgMode === 'compare' ? compareHTML(items) : `<div class="cards pad">${items.map((x) => cardHTML(x, !!view.dataset.shared)).join('')}</div>`; watchLineups($('#pk-body')); for (const b of $$('[data-act="pk-mode"]')) b.setAttribute('aria-pressed', b === t); } break;
      case 'cmp-shot': cmpShot = v; { const items = view.dataset.shared ? readShare(view.dataset.shared) : myItems(); $('#pk-body').innerHTML = compareHTML(items); watchLineups($('#pk-body')); } break;
      case 'pkg-rm': state.pkg = state.pkg.filter((x) => x !== code); save(); syncPkg(); renderPkg(); break;
      case 'take-share': { const items = readShare(view.dataset.shared); for (const x of items) { if (!inPkg(x.code)) state.pkg.push(x.code); setSel(x.code, { hair: x.hair, voice: x.voice }); } save(); toast(`${items.length}명을 내 패키지에 담았어요`); go('#pkg'); break; }
      case 'share-link': copy(`${shareBase}#p-${shareCode(myItems())}`, '공유 링크를 복사했어요. 받은 사람도 같은 조합으로 볼 수 있어요.'); break;
      case 'to-inq': e.preventDefault(); $('#inq')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); break;
      case 'format': state.format = v; save(); for (const b of $$('[data-act="format"]')) b.setAttribute('aria-pressed', b === t); wireInq(view.dataset.shared ? readShare(view.dataset.shared) : myItems()); break;
      case 'copy-inq': copy($('#inq-text').value, '글을 복사했어요. 붙여 넣기만 하면 돼요.'); break;
      case 'save-card': { const items = view.dataset.shared ? readShare(view.dataset.shared) : myItems(); const x = items.find((y) => y.code === code); const m = byCode(code); exportCanvas(() => drawCard(x), `PULSE_${m.code}_${m.name}_컴프카드`); break; }
      case 'save-sheet': { const items = view.dataset.shared ? readShare(view.dataset.shared) : myItems(); exportCanvas(() => drawSheet(items), `PULSE_모델패키지_${items.length}명`); break; }
      case 'ex-close': $('#export').close(); break;
      case 'ex-save': {
        const f = $('#export').dataset.file;
        downloads.save({ filename: f, data: exportCanvas.blob }).then(() => toast('이미지를 저장했어요.'), (err) => {
          const c = err && err.code;
          if (c === 'declined') return;
          if (c === 'rate_limited') { toast('저장 창이 이미 열려 있어요. 잠시 뒤 다시 눌러 주세요.'); return; }
          t.hidden = true; toast('이 화면에서는 저장할 수 없어요. 이미지를 길게 누르거나 오른쪽 클릭으로 저장해 주세요.');
        });
        break;
      }
      case 'ex-copy': {
        try { navigator.clipboard.write([new ClipboardItem({ 'image/png': exportCanvas.blob })]).then(() => toast('이미지를 복사했어요. 메신저나 문서에 붙여 넣어 주세요.'), () => toast('이 화면에서는 이미지 복사가 막혀 있어요. 이미지를 길게 누르거나 오른쪽 클릭으로 저장해 주세요.')); } catch { toast('이 화면에서는 이미지 복사가 막혀 있어요. 이미지를 길게 누르거나 오른쪽 클릭으로 저장해 주세요.'); }
        break;
      }
      case 'ex-share': { const b = exportCanvas.blob, f = $('#export').dataset.file; navigator.share({ files: [new File([b], f, { type: 'image/png' })], title: f }).catch(() => {}); break; }
      case 'deck-yes': deckDecide(true); break;
      case 'deck-no': deckDecide(false); break;
      case 'deck-restart': startDeck(); drawDeck(); break;
      default: break;
    }
  });
  document.addEventListener('keydown', (e) => {
    if ($('#lightbox').open) {
      if (e.key === 'ArrowLeft') { lbIndex = (lbIndex - 1 + lbList.length) % lbList.length; drawLb(); }
      if (e.key === 'ArrowRight') { lbIndex = (lbIndex + 1) % lbList.length; drawLb(); }
      return;
    }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) return;
    if (route === 'swipe' && deckAt < deck.length) { if (e.key === 'ArrowRight') deckDecide(true); if (e.key === 'ArrowLeft') deckDecide(false); }
  });
  for (const id of ['lightbox', 'export']) { const d = document.getElementById(id); d.addEventListener('click', (e) => { if (e.target === d) d.close(); }); }
  $('#export').addEventListener('close', () => { const u = $('#export').dataset.url; if (u) URL.revokeObjectURL(u); $('#export').dataset.url = ''; });

  $('#updated').textContent = D.updated.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y, mo, d) => `${y}년 ${Number(mo)}월 ${Number(d)}일 기준`);
  render();
})();
