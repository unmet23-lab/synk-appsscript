(function () {
  'use strict';
  const D = JSON.parse(document.getElementById('data').textContent);
  const L = window.CastingLogic;
  const TAX = { industries: D.industries, moods: D.moods, genderWords: D.genderWords };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const E = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 「음료·디저트」 같은 가운뎃점 덩어리가 줄 끝에서 갈리지 않게 묶고, 띄어 쓴 「 · 」는 앞 낱말에 붙인다
  const K = (s) => E(s).replace(/ · /g, '&nbsp;· ').replace(/([^\s&;·]+(?:·[^\s&;·]+)+)/g, '<span class="nw">$1</span>');
  const dot = (...xs) => xs.filter(Boolean).join(' · ');
  const byCode = (c) => D.models.find((m) => m.code === c);
  const indLabel = (id) => (D.industries.find((i) => i.id === id) || {}).label || '';
  const moodLabel = (id) => (D.moods.find((i) => i.id === id) || {}).label || '';
  const MAX_COMPARE = 3;

  /* 저장: 이 브라우저에만 남는 편의 기능. 막혀 있어도 화면은 그대로 쓴다 */
  const KEY = 'pulse-casting-v2';
  const EXAMPLE_BRIEF = { industry: 'food', product: '딸기 라떼 신메뉴', moods: ['fresh'], gender: '', age: '', touched: false };
  const state = Object.assign({ picks: [], compare: [], brief: { ...EXAMPLE_BRIEF }, format: 'kmong' }, load());
  state.picks = state.picks.filter((p) => byCode(p.code));
  state.compare = state.compare.filter((c) => byCode(c)).slice(0, MAX_COMPARE);
  const filters = { gender: '전체', age: '전체', concept: '전체', height: '전체', industry: '' };
  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && typeof v === 'object') return v;
      const old = JSON.parse(localStorage.getItem('pulse-casting-picks-v1') || '[]');
      return Array.isArray(old) && old.length ? { picks: old } : {};
    } catch { return {}; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ picks: state.picks, compare: state.compare, brief: state.brief, format: state.format })); } catch { /* 저장이 막힌 브라우저 */ } }
  const pickOf = (c) => state.picks.find((p) => p.code === c);
  const inCompare = (c) => state.compare.includes(c);

  const toastEl = $('#toast');
  function toast(msg) {
    toastEl.textContent = msg;
    try { if (toastEl.matches(':popover-open')) toastEl.hidePopover(); toastEl.showPopover(); } catch { toastEl.classList.add('show'); }
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { try { toastEl.hidePopover(); } catch { toastEl.classList.remove('show'); } }, 2400);
  }

  /* ── 키 눈금 ───────────────────────────────────────────── */
  const TICKS = [150, 160, 170, 180, 190];
  function lineupHTML(list, opts = {}) {
    return `<div class="lu${opts.big ? ' big' : ''}${opts.cols ? ' cols' : ''}" data-lu data-max="${opts.maxH || 360}" style="--n:${list.length}">
      <div class="lu-ticks" aria-hidden="true">${TICKS.map((cm) => `<span class="lu-tick" style="--cm:${cm}"><i class="mono">${cm}</i></span>`).join('')}</div>
      <div class="lu-row">${list.map((m) => {
        const cls = opts.current ? (m.code === opts.current ? ' on' : ' dim') : opts.cols ? ' on' : '';
        const body = m.stand ? `<img src="${E(m.stand.src)}" alt="" loading="lazy">` : '<span class="lu-ghost"></span>';
        return `<button type="button" class="lu-fig${cls}" data-act="open" data-code="${E(m.code)}" style="--cm:${Number(m.height) || 160};--r:${m.stand ? m.stand.ratio : 0.3}" aria-label="${E(m.code + ' ' + m.name)}, 키 ${E(m.height || '정보 없음')}cm, 자세히 보기">${body}<span class="lu-cap"><b>${E(m.name)}</b><span class="mono">${E(m.height || '')}</span></span></button>`;
      }).join('')}</div>
    </div>`;
  }
  // 눈금 배율(1cm당 px)을 칸 너비와 최대 높이에 맞춘다
  function fitLineup(lu) {
    const row = lu && $('.lu-row', lu), figs = row ? $$('.lu-fig', row) : [];
    if (!figs.length || !row.clientWidth) return;
    const gap = parseFloat(getComputedStyle(row).columnGap) || 8;
    const w = (f) => Number(f.style.getPropertyValue('--cm')) * Number(f.style.getPropertyValue('--r'));
    const room = row.clientWidth - gap * (figs.length - 1);
    // 비교 창(cols)은 모델마다 제 칸 가운데에 서고, 나머지는 한 줄에 나란히 선다
    const byWidth = lu.classList.contains('cols') ? (room / figs.length) * 0.9 / Math.max(...figs.map(w)) : room / figs.reduce((t, f) => t + w(f), 0);
    const k = Math.min(Number(lu.dataset.max) / 196, byWidth);
    lu.style.setProperty('--k', Math.max(0.3, k).toFixed(4));
    // 눈금 숫자가 겹치지 않게: 10cm 간격이 18px보다 좁으면 20cm마다, 그보다 좁으면 150·190만
    lu.classList.toggle('dense', k * 10 < 18 && k * 20 >= 18);
    lu.classList.toggle('sparse', k * 20 < 18);
  }
  const fitLineups = (scope = document) => $$('[data-lu]', scope).forEach(fitLineup);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver((es) => es.forEach((e) => fitLineup(e.target.closest('[data-lu]')))) : null;
  function watchLineups(scope) {
    fitLineups(scope);
    if (ro) $$('[data-lu] .lu-row', scope).forEach((r) => ro.observe(r));
  }

  /* ── 첫 화면 ───────────────────────────────────────────── */
  function renderHero() {
    const sorted = D.models.filter((m) => m.height).slice().sort((a, b) => a.height - b.height);
    $('#hero-lineup').innerHTML = lineupHTML(sorted, { maxH: 380 });
    // 모든 모델에 있는 만큼만 「모델마다」라고 쓴다(더 있는 모델은 장면 사진 칸에서 따로 말한다)
    const shots = Math.min(...D.models.filter((m) => m.shotCount).map((m) => m.shotCount));
    const voices = Math.min(...D.models.map((m) => m.voices.length));
    const withScenes = D.models.filter((m) => m.scenes.length);
    const scenes = withScenes.reduce((s, m) => s + m.scenes.length, 0);
    const facts = [[D.models.length, '명', '고를 수 있는 모델'], [shots, '컷', '모델마다 보는 사진']];
    if (voices) facts.push([voices, '가지', '모델마다 들어 보는 목소리']);
    if (scenes) facts.push([scenes, '장', withScenes.length === 1 ? `${withScenes[0].name}의 장면 사진` : '장면 사진']);
    $('#facts').innerHTML = facts.map(([n, u, s]) => `<div><dt><b class="num">${n}</b>${E(u)}</dt><dd>${E(s)}</dd></div>`).join('');
    $('#updated').textContent = D.updated.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y, mo, d) => `${y}년 ${Number(mo)}월 ${Number(d)}일 기준`);
  }

  /* ── 브리프 추천 ───────────────────────────────────────── */
  const chip = (attrs, label, on) => `<button type="button" class="chip" ${attrs} aria-pressed="${on ? 'true' : 'false'}">${K(label)}</button>`;
  function renderBriefForm() {
    const b = state.brief;
    const ages = [...new Set(D.models.map((m) => m.ageBand).filter(Boolean))].sort();
    $('#brief-form').innerHTML = `
      <div class="bf-row"><span class="bf-label" id="bf-ind-l">업종</span>
        <div class="chips" role="group" aria-labelledby="bf-ind-l">${D.industries.map((i) => chip(`data-act="bf-ind" data-v="${i.id}" title="${E(i.hint)}"`, i.label, b.industry === i.id)).join('')}</div></div>
      <div class="bf-row"><label class="bf-label" for="bf-product">제품·서비스</label>
        <input class="input" id="bf-product" name="product" type="text" maxlength="80" value="${E(b.product)}" placeholder="예: 수분 크림, 가계부 앱, 가을 니트"></div>
      <div class="bf-row"><span class="bf-label" id="bf-mood-l">분위기 <small>두 개까지</small></span>
        <div class="chips" role="group" aria-labelledby="bf-mood-l">${D.moods.map((x) => chip(`data-act="bf-mood" data-v="${x.id}"`, x.label, (b.moods || []).includes(x.id))).join('')}</div></div>
      <div class="bf-row bf-pair">
        <div><span class="bf-label" id="bf-g-l">성별</span><div class="seg" role="group" aria-labelledby="bf-g-l">${[['', '상관없음'], ['여', '여자'], ['남', '남자']].map(([v, l]) => chip(`data-act="bf-gender" data-v="${v}"`, l, b.gender === v)).join('')}</div></div>
        <div><span class="bf-label" id="bf-a-l">나이대</span><div class="seg" role="group" aria-labelledby="bf-a-l">${[['', '상관없음'], ...ages.map((a) => [a, a])].map(([v, l]) => chip(`data-act="bf-age" data-v="${v}"`, l, b.age === v)).join('')}</div></div>
      </div>
      <div class="bf-foot">${b.touched ? '<span class="bf-state">고른 내용은 문의 글에도 같이 들어가요</span>' : '<span class="tag butter"><i class="led"></i>예시로 채워 둔 브리프예요</span>'}<button type="button" class="text-btn" data-act="bf-reset">비우기</button></div>`;
  }
  function touchBrief() { state.brief.touched = true; save(); }
  function renderBriefOut() {
    const out = $('#brief-out'), b = state.brief;
    if (L.briefIsEmpty(b)) {
      out.innerHTML = '<div class="bo-empty"><p class="lead-s">업종이나 분위기를 하나만 골라도 추천이 나와요.</p><p>제품 이름을 적으면 그 안의 낱말(라떼, 크림, 앱처럼)로 업종과 분위기를 같이 찾아요.</p></div>';
      return;
    }
    const recs = L.recommend(D.models, b, TAX, 3);
    const { inds, moods, gender, genderWord } = L.readBrief(b, TAX);
    const found = [...inds.entries()].filter(([, v]) => v.words.length).map(([id, v]) => `‘${v.words[0]}’ → ${indLabel(id)}`)
      .concat([...moods.entries()].filter(([, v]) => v.words.length && !v.picked).map(([id, v]) => `‘${v.words[0]}’ → ${moodLabel(id)}`))
      .concat(gender && !b.gender ? [`‘${genderWord}’ → ${gender}자 모델`] : []);
    const sub = dot(indLabel(b.industry), ...(b.moods || []).map(moodLabel), b.gender && b.gender + '자', b.age);
    if (!recs.length) {
      out.innerHTML = !inds.size && !moods.size
        ? '<div class="bo-empty"><p class="lead-s">설명에서 업종이나 분위기를 찾지 못했어요.</p><p>위에서 업종이나 분위기를 하나 골라 주세요. 제품 이름에 라떼·크림·앱·니트처럼 종류를 넣어도 찾아요.</p></div>'
        : '<div class="bo-empty"><p class="lead-s">조건에 맞는 모델이 아직 없어요.</p><p>성별·나이대를 「상관없음」으로 바꾸거나, 필요한 모델을 문의 글에 적어 주세요. 같은 방식으로 새 모델을 만들어 드려요.</p></div>';
      return;
    }
    out.innerHTML = `
      <div class="bo-head"><p class="bo-title">추천 모델 <b class="num">${recs.length}</b>명</p><p class="bo-sub">${K(sub)}${found.length ? `<span class="bo-found">${K(found.join(', '))}</span>` : ''}</p></div>
      <ol class="bo-list">${recs.map((r, i) => {
        const m = r.model, ev = r.evidence;
        return `<li class="bo-card">
          <button type="button" class="bo-photo" data-act="open" data-code="${E(m.code)}" aria-label="${E(m.code + ' ' + m.name)} 자세히 보기">
            <img src="${E((ev || m.hero || {}).s || '')}" alt="" loading="lazy">
            ${ev ? `<span class="bo-cap">${K(ev.label)}</span><img class="bo-face" src="${E(m.hero.s)}" alt="">` : ''}
            <span class="bo-rank num">${i + 1}</span>
          </button>
          <div class="bo-body">
            <div class="bo-name"><b>${E(m.name)}</b><span class="mono">${E(m.code)}</span>${r.strong ? '<span class="tag ok"><i class="led"></i>잘 맞아요</span>' : '<span class="tag"><i class="led"></i>어울려요</span>'}</div>
            <p class="bo-line">${K(dot(m.gender, m.age, m.height && m.height + 'cm'))}</p>
            <ul class="bo-why">${r.reasons.map((x) => `<li>${K(x.text)}</li>`).join('')}</ul>
            <div class="bo-acts"><button type="button" class="btn sm line" data-act="open" data-code="${E(m.code)}">자세히</button>${cmpBtn(m.code, 'btn sm')}</div>
          </div>
        </li>`;
      }).join('')}</ol>
      ${recs.length > 1 ? `<button type="button" class="text-btn" data-act="cmp-set" data-codes="${E(recs.map((r) => r.model.code).join(','))}">이 ${recs.length}명 나란히 비교하기</button>` : ''}`;
  }
  const cmpBtn = (code, cls = '') => `<button type="button" class="${cls} cmp-toggle" data-act="cmp" data-code="${E(code)}" aria-pressed="${inCompare(code)}">${inCompare(code) ? '비교에 담김' : '비교에 넣기'}</button>`;

  /* ── 거르기·카드 ───────────────────────────────────────── */
  function renderFilters() {
    const uniq = (xs) => [...new Set(xs.filter(Boolean))];
    const order = ['상큼', '지적', '섹시', '개성'];
    const concepts = uniq(D.models.map((m) => m.concept)).sort((a, b) => (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99);
    const groups = [
      ['gender', '성별', ['전체', ...uniq(D.models.map((m) => m.gender)).sort().reverse()]],
      ['age', '나이대', ['전체', ...uniq(D.models.map((m) => m.ageBand)).sort()]],
      ['concept', '콘셉트', ['전체', ...concepts]],
      ['height', '키', ['전체', ...uniq(D.models.map((m) => L.heightBand(m.height))).sort()]],
    ];
    const count = (id) => D.models.filter((m) => m.industries.includes(id)).length;
    $('#filters').innerHTML = groups.map(([k, label, opts]) => `<div class="f-group"><span class="f-label" id="f-${k}">${E(label)}</span><div class="chips" role="group" aria-labelledby="f-${k}">${opts.map((o) => chip(`data-act="filter" data-f="${k}" data-v="${E(o)}"`, o, filters[k] === o)).join('')}</div></div>`).join('')
      + `<div class="f-group"><label class="f-label" for="f-industry">업종</label><select class="select" id="f-industry" data-act="filter-industry"><option value="">모든 업종</option>${D.industries.filter((i) => count(i.id)).map((i) => `<option value="${i.id}" ${filters.industry === i.id ? 'selected' : ''}>${E(i.label)} (${count(i.id)}명)</option>`).join('')}</select></div>`;
  }
  function renderGrid() {
    const list = L.filterModels(D.models, filters);
    const any = Object.entries(filters).some(([k, v]) => (k === 'industry' ? v : v !== '전체'));
    $('#result-note').innerHTML = any ? `조건에 맞는 모델 <b class="num">${list.length}</b>명` : `모델 <b class="num">${list.length}</b>명`;
    $('#clear-filters').hidden = !any;
    $('#grid').innerHTML = list.length ? list.map(card).join('')
      : '<div class="empty"><p class="lead-s">조건에 맞는 모델이 아직 없어요.</p><p>필요한 모델의 성별·나이대·분위기를 알려 주시면 같은 방식으로 새로 만들어 드려요.</p></div>';
  }
  function card(m) {
    const mat = [m.shotCount && `사진 ${m.shotCount}컷`, m.scenes.length && `장면 ${m.scenes.length}장`, m.voices.length && `목소리 ${m.voices.length}`].filter(Boolean).join(' · ');
    const picked = pickOf(m.code);
    return `<article class="card${inCompare(m.code) ? ' in-cmp' : ''}">
      <button type="button" class="card-open" data-act="open" data-code="${E(m.code)}" aria-label="${E(m.code + ' ' + m.name)} 자세히 보기">
        <span class="photo">
          ${m.hero ? `<img src="${E(m.hero.s)}" srcset="${E(m.hero.s)} 1x, ${E(m.hero.l)} 2x" alt="" loading="lazy">` : '<span class="ph"></span>'}
          ${m.alt ? `<img class="alt" src="${E(m.alt.s)}" srcset="${E(m.alt.s)} 1x, ${E(m.alt.l)} 2x" alt="" loading="lazy">` : ''}
          <span class="flags">${m.realPerson ? '<span class="tag dark">실제 인물</span>' : ''}${m.spec ? '<span class="tag light">상세 프로필</span>' : ''}</span>
          ${picked ? '<span class="picked" title="내 선택에 담김"></span>' : ''}
        </span>
        <span class="meta">
          <span class="name"><b>${E(m.name)}</b><span class="mono">${E(m.code)}</span></span>
          <span class="line">${K(dot(m.gender, m.age, m.height && m.height + 'cm'))}</span>
          <span class="imp">${K(m.impression.join(' · '))}</span>
          <span class="tags"><span class="tag berry">${E(m.concept)}</span>${m.industries.slice(0, 2).map((id) => `<span class="tag">${K(indLabel(id))}</span>`).join('')}</span>
          <span class="mat">${K(mat)}</span>
        </span>
      </button>
      ${cmpBtn(m.code, 'card-cmp')}
    </article>`;
  }

  /* ── 비교 담기 ─────────────────────────────────────────── */
  function toggleCompare(code) {
    if (inCompare(code)) state.compare = state.compare.filter((c) => c !== code);
    else if (state.compare.length >= MAX_COMPARE) { toast(`비교는 ${MAX_COMPARE}명까지 담을 수 있어요. 한 명을 빼고 담아 주세요.`); return; }
    else state.compare.push(code);
    save(); syncCompare();
  }
  function syncCompare() {
    $('#compare-count').textContent = state.compare.length;
    for (const b of $$('[data-act="cmp"]')) { const on = inCompare(b.dataset.code); b.setAttribute('aria-pressed', on); b.textContent = on ? '비교에 담김' : '비교에 넣기'; b.closest('.card')?.classList.toggle('in-cmp', on); }
    const tray = $('#tray');
    tray.hidden = !state.compare.length;
    tray.innerHTML = `<div class="tray-in"><span class="tray-faces">${state.compare.map((c) => { const m = byCode(c); return `<button type="button" class="tray-face" data-act="cmp" data-code="${E(c)}" aria-label="${E(m.name)} 비교에서 빼기"><img src="${E((m.hero || {}).s || '')}" alt=""><span class="x" aria-hidden="true"></span></button>`; }).join('')}${Array.from({ length: MAX_COMPARE - state.compare.length }, () => '<span class="tray-slot" aria-hidden="true"></span>').join('')}</span>
      <span class="tray-text">${state.compare.length < 2 ? '한 명 더 담으면 나란히 볼 수 있어요' : `${state.compare.length}명을 같은 컷으로 비교해요`}</span>
      <button type="button" class="pill dark" data-act="open-compare" ${state.compare.length < 2 ? 'disabled' : ''}>비교하기</button></div>`;
    if ($('#compare').open) renderCompare();
  }

  /* ── 목소리 ───────────────────────────────────────────── */
  const audio = new Audio();
  let playing = null;
  const svgPlay = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4l8.6-5.2z" fill="currentColor"/></svg>';
  const svgStop = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1.6" fill="currentColor"/></svg>';
  const voiceBtn = (m, i, cls = 'play') => `<button type="button" class="${cls}" data-act="voice" data-code="${E(m.code)}" data-i="${i}" aria-pressed="false" aria-label="${E(m.name)} 목소리 ${i + 1} ${E(m.voices[i].label)} 듣기">${svgPlay}</button>`;
  function stopAudio() {
    audio.pause();
    for (const b of $$(`[data-act="voice"][aria-pressed="true"]`)) { b.setAttribute('aria-pressed', 'false'); b.innerHTML = svgPlay; }
    playing = null;
  }
  function toggleVoice(btn) {
    const key = btn.dataset.code + ':' + btn.dataset.i;
    if (playing === key) { stopAudio(); return; }
    stopAudio();
    const v = byCode(btn.dataset.code).voices[Number(btn.dataset.i)];
    audio.src = v.src; audio.currentTime = 0;
    audio.play().then(() => {
      playing = key;
      for (const b of $$(`[data-act="voice"][data-code="${btn.dataset.code}"][data-i="${btn.dataset.i}"]`)) { b.setAttribute('aria-pressed', 'true'); b.innerHTML = svgStop; }
    }).catch(() => toast('소리를 재생하지 못했어요. 다시 눌러 주세요.'));
  }
  audio.addEventListener('ended', stopAudio);

  /* ── 모델 창 ──────────────────────────────────────────── */
  let current = null, lbList = [], lbIndex = 0;
  const SECTIONS = [
    { id: 'angle', title: '얼굴 각도', en: 'ANGLES', why: '옆과 뒤에서도 같은 사람으로 보이는지, 헤어 뒷모양은 어떤지 보세요.', keys: ['angle-front', 'angle-left', 'angle-right', 'angle-back'], cls: 'c4' },
    { id: 'full', title: '전신 각도', en: 'FULL BODY', why: '같은 옷으로 앞·옆·뒤·45도를 찍었어요. 몸의 비율과 서 있는 자세를 보세요.', keys: ['fullbody', 'full-left', 'full-back', 'full-45'], cls: 'c4 tall', need: 'full-left' },
    { id: 'face', title: '표정', en: 'EXPRESSIONS', why: '상황극이나 리액션 광고라면 감정 표현이 자연스러운지 보세요.', keys: ['hero', 'exp-smile', 'exp-angry', 'exp-surprised'], cls: 'c4' },
    { id: 'hair', title: '헤어', en: 'HAIR', why: '얼굴은 그대로 두고 헤어만 바꿨어요. 마음에 드는 헤어를 바로 고를 수 있어요.', keys: ['hair-1', 'hair-2', 'hair-3'], cls: 'c3' },
    { id: 'look', title: '전신·룩', en: 'LOOKS', why: '옷 광고와 룩북은 전신 비율과 옷 태가 중요해요.', keys: ['fullbody', 'look-1', 'look-2'], cls: 'c3 tall' },
    { id: 'detail', title: '디테일·광고 장면', en: 'DETAILS', why: '뷰티 광고의 확대 컷, 제품을 드는 손, 광고 장면에서의 느낌이에요.', keys: ['skin', 'hands', 'context'], cls: 'c3 wide' },
  ];
  const fig = (m, key, extra = '') => {
    const s = m.shots[key]; if (!s) return '';
    const i = lbList.findIndex((g) => g.l === s.l);
    return `<figure class="shot"><button type="button" class="shot-img" data-act="lb" data-i="${i}" aria-label="${E(s.label)} 크게 보기"><img src="${E(s.s)}" alt="${E(m.name + ' ' + s.label)}" loading="lazy"></button><figcaption><span>${K(s.label)}</span><span class="mono">${E(s.en || '')}</span></figcaption>${extra}</figure>`;
  };
  const secHead = (id, title, en, why) => `<div class="sh-head"><h3 id="h-${id}">${E(title)}<span class="mono">${E(en)}</span></h3>${why ? `<p class="why">${K(why)}</p>` : ''}</div>`;

  function bodyBlock(m) {
    if (!m.body && !m.height) return '';
    const g = m.gender === '여' ? '여자' : m.gender === '남' ? '남자' : '';
    const rows = [
      ['키', (x) => x.height, (v) => `${v}<small>cm</small>`, '정수리부터 신발 바닥까지예요.'],
      ['등신', (x) => x.body && x.body.heads, (v) => v.toFixed(2), '키를 머리 길이(정수리~턱)로 나눈 값이에요. 클수록 머리가 작아 보여요.'],
      ['어깨 ÷ 얼굴 폭', (x) => x.body && x.body.shoulderFace, (v) => v.toFixed(2), '어깨너비가 얼굴 폭의 몇 배인지예요. 클수록 어깨가 넓어 보여요.'],
      ['다리 비율', (x) => x.body && x.body.leg, (v) => v.toFixed(3), '골반 관절부터 바닥까지 길이를 키로 나눈 값이에요. 클수록 다리가 길어 보여요.'],
    ];
    const metric = ([label, pick, fmt, help]) => {
      const v = pick(m); if (v == null) return '';
      const r = L.rankAmong(D.models, m, pick);
      let bar = '', note = '';
      if (r) {
        const pos = (x) => (r.max === r.min ? 50 : ((x - r.min) / (r.max - r.min)) * 100);
        const peers = D.models.filter((x) => x.gender === m.gender && pick(x) != null);
        bar = `<div class="rb" aria-hidden="true"><span class="rb-track"></span>${peers.map((x) => `<span class="rb-dot${x.code === m.code ? ' me' : ''}" style="left:${pos(pick(x)).toFixed(1)}%" title="${E(x.name)} ${E(fmt(pick(x)).replace(/<[^>]+>/g, ''))}"></span>`).join('')}</div>
          <div class="rb-ends"><span class="num">${fmt(r.min).replace(/<[^>]+>/g, '')}</span><span>${E(g)} 모델 ${r.count}명</span><span class="num">${fmt(r.max).replace(/<[^>]+>/g, '')}</span></div>`;
        note = r.lowest ? `${g} 모델 중 가장 작아요` : r.highest ? `${g} 모델 중 가장 커요` : '';
      }
      return `<div class="metric"><div class="mt-top"><span class="mt-label">${E(label)}</span><span class="mt-val num">${fmt(v)}</span></div>${bar}<p class="mt-help">${E(help)}${note ? ` <b>${E(note)}</b>` : ''}</p></div>`;
    };
    const sorted = D.models.filter((x) => x.height).slice().sort((a, b) => a.height - b.height);
    return `<section class="shots" id="s-body" aria-labelledby="h-body">
      ${secHead('body', '몸과 비율', 'BODY', '전신 사진을 같은 방법으로 쟀어요. 점은 같은 성별 모델들이고, 진한 점이 이 모델이에요.')}
      <div class="body-lineup">${lineupHTML(sorted, { current: m.code, maxH: 330 })}</div>
      <div class="metrics">${rows.map(metric).join('')}</div>
      ${m.bodyNote ? `<p class="body-note">${K(m.bodyNote)}</p>` : ''}
    </section>`;
  }

  function openModel(code, opts = {}) {
    const m = byCode(code); if (!m) return;
    current = m;
    lbList = [];
    const pushLb = (s) => { if (s && !lbList.some((g) => g.l === s.l)) lbList.push({ s: s.s, l: s.l, label: s.label || [s.place, s.label].filter(Boolean).join(' · ') }); };
    if (m.hero) pushLb(m.hero.label ? m.hero : { ...m.hero, label: '대표' });
    for (const sec of SECTIONS) for (const k of sec.keys) pushLb(m.shots[k]);
    for (const sc of m.scenes) pushLb({ s: sc.s, l: sc.l, label: `${sc.place} · ${sc.label}` });

    const fullShown = !!m.shots['full-left'];
    const secs = SECTIONS.map((sec) => {
      if (sec.need && !m.shots[sec.need]) return '';
      let keys = sec.keys.filter((k) => m.shots[k]);
      if (sec.id === 'look' && fullShown) keys = keys.filter((k) => k !== 'fullbody');
      if (!keys.length) return '';
      const p = pickOf(m.code);
      const body = keys.map((k) => sec.id === 'hair'
        ? fig(m, k, `<button type="button" class="hair-pick" data-act="hair" data-i="${Number(k.slice(-1)) - 1}" aria-pressed="${(p ? p.hair : 0) === Number(k.slice(-1)) - 1}">이 헤어로</button>`)
        : fig(m, k)).join('');
      return { id: sec.id, title: sec.title, html: `<section class="shots" id="s-${sec.id}" aria-labelledby="h-${sec.id}">${secHead(sec.id, sec.title, sec.en, sec.why)}<div class="shot-row ${sec.cls}">${body}</div></section>` };
    }).filter(Boolean);

    if (m.scenes.length) {
      const tagIds = D.industries.map((i) => i.id).filter((id) => m.scenes.some((s) => s.tags.includes(id)));
      const tagCount = (id) => m.scenes.filter((s) => s.tags.includes(id)).length;
      secs.push({ id: 'scene', title: '장면 사진', html: `<section class="shots" id="s-scene" aria-labelledby="h-scene">${secHead('scene', '장면 사진', 'SCENES', `장소·빛·옷을 바꿔 찍은 ${m.scenes.length}장이에요. 업종을 누르면 그 광고에 가까운 장면만 보여요.`)}
        <div class="chips scene-filter" role="group" aria-label="장면 업종">${chip('data-act="scene-tag" data-v=""', '전체', true)}${tagIds.map((id) => chip(`data-act="scene-tag" data-v="${id}"`, `${indLabel(id)} ${tagCount(id)}`, false)).join('')}</div>
        <div class="scene-grid">${m.scenes.map((sc) => { const i = lbList.findIndex((g) => g.l === sc.l); return `<figure class="scene" data-tags="${E(sc.tags.join(' '))}"><button type="button" data-act="lb" data-i="${i}" aria-label="${E(sc.place)} 크게 보기"><img src="${E(sc.s)}" alt="${E(m.name + ' ' + sc.place + ' ' + sc.label)}" loading="lazy"></button><figcaption><b>${K(sc.place)}</b><span>${K(sc.label)}</span></figcaption></figure>`; }).join('')}</div></section>` });
    }
    if (m.motion.length) secs.push({ id: 'motion', title: '움직임', html: `<section class="shots" id="s-motion" aria-labelledby="h-motion">${secHead('motion', '움직임 샘플', 'MOTION', '짧은 움직임 시안이에요. 소리는 들어 있지 않아요.')}<div class="motion-row">${m.motion.map((v) => `<figure class="motion"><video src="${E(v.src)}" controls muted playsinline loop preload="metadata"></video><figcaption><b>${K(v.label)}</b>${v.note ? `<span>${K(v.note)}</span>` : ''}</figcaption></figure>`).join('')}</div></section>` });
    const info = [['성별', m.gender], ['나이대', m.age || m.ageBand], ['콘셉트', m.concept], ['키', m.height && m.height + 'cm'], ['몸무게', m.weightKg && m.weightKg + 'kg (설정값)'], ['체형', m.build], ['옷 사이즈', dot(m.sizes.top && '상의 ' + m.sizes.top, m.sizes.bottom && '하의 ' + m.sizes.bottom)], ['신발', m.sizes.shoe && m.sizes.shoe + 'mm'], ['피부 톤', m.skin], ['눈', m.eyes], ['기본 헤어', m.hairBase]].filter(([, v]) => v);
    secs.unshift({ id: 'info', title: '기본 정보', html: `<section class="shots" id="s-info" aria-labelledby="h-info">${secHead('info', '기본 정보', 'PROFILE', '')}<dl class="spec-grid">${info.map(([k, v]) => `<div><dt>${E(k)}</dt><dd>${K(v)}</dd></div>`).join('')}</dl></section>` });
    const bodyHTML = bodyBlock(m);
    if (bodyHTML) secs.push({ id: 'body', title: '몸과 비율', html: bodyHTML });
    if (m.face || m.colors) {
      secs.push({ id: 'look-guide', title: '얼굴과 색', html: `<section class="shots" id="s-look-guide" aria-labelledby="h-look-guide">${secHead('look-guide', '얼굴과 색', 'FACE & COLOR', '광고 사진을 몇 장 더 만들어도 바뀌지 않게 지키는 기준이에요.')}
        <div class="guide-grid">${m.face ? `<dl class="facekeys">${m.face.map((f) => `<div><dt>${E(f.label)}</dt><dd>${K(f.text)}</dd></div>`).join('')}</dl>` : ''}
        ${m.colors ? `<div class="swatches">${m.colors.map((c) => `<div class="sw"><span class="sw-chip" style="background:${E(c.hex)}"></span><span class="sw-label">${E(c.label)}</span><span class="mono">${E(c.hex)}</span>${c.range ? `<span class="sw-range"><i style="background:${E(c.range[0])}"></i><i style="background:${E(c.range[1])}"></i></span>` : ''}</div>`).join('')}<p class="sw-note">사진 네 장에서 잰 색이에요. 왼쪽 큰 칸이 기준, 오른쪽 두 칸이 잰 범위예요.</p></div>` : ''}</div></section>` });
    }
    if (m.direction) {
      secs.push({ id: 'direction', title: '어울리는 연출', html: `<section class="shots" id="s-direction" aria-labelledby="h-direction">${secHead('direction', '어울리는 연출', 'DIRECTION', '')}
        <ul class="dir-list">${m.direction.fit.map((t) => `<li>${K(t)}</li>`).join('')}</ul>${(m.direction.avoid || []).map((t) => `<p class="dir-avoid">${K(t)}</p>`).join('')}</section>` });
    }

    const p = pickOf(m.code) || { hair: 0, voice: 0, memo: '' };
    const nums = [m.height && ['키', `${m.height}<small>cm</small>`], m.body && ['등신', m.body.heads.toFixed(2)], m.body && ['다리 비율', m.body.leg.toFixed(2)]].filter(Boolean);
    const mat = [m.shotCount && `사진 ${m.shotCount}컷`, m.scenes.length && `장면 ${m.scenes.length}장`, m.voices.length && `목소리 ${m.voices.length}가지`, m.motion.length && `움직임 ${m.motion.length}편`].filter(Boolean).join(' · ');
    const sheet = $('#sheet');
    sheet.innerHTML = `
      <div class="sheet-bar">
        <div class="sb-title"><span class="mono">${E(m.code)}</span><b>${E(m.name)}</b><span class="sb-sub">${K(dot(m.gender, m.age, m.concept))}</span></div>
        <div class="sb-acts">${cmpBtn(m.code, 'pill line sm')}<button type="button" class="pill dark sm" data-act="to-choose">이 모델 고르기</button><button type="button" class="icon-btn" data-act="close-sheet" aria-label="창 닫기"><span class="x" aria-hidden="true"></span></button></div>
      </div>
      <div class="sheet-body">
        <div class="sheet-main">
          <div class="ov">
            <button type="button" class="ov-hero" data-act="lb" data-i="0" aria-label="대표 사진 크게 보기">${m.hero ? `<img src="${E(m.hero.l)}" alt="${E(m.name)} 대표 사진">` : ''}</button>
            <div class="ov-info">
              ${m.realPerson ? '<span class="tag dark">실제 인물</span>' : ''}
              <h2 id="sheet-title">${E(m.name)} <span class="mono">${E(m.code)}</span></h2>
              <p class="ov-imp">${K(m.impression.join(' · '))}</p>
              ${nums.length ? `<dl class="ov-nums">${nums.map(([k, v]) => `<div><dt>${E(k)}</dt><dd class="num">${v}</dd></div>`).join('')}</dl>` : ''}
              <div class="ov-fits"><span class="ov-k">어울리는 업종</span><div class="tags">${m.fits.map((f) => `<span class="tag">${K(f)}</span>`).join('')}</div></div>
              ${mat ? `<p class="ov-mat">${K(mat)}</p>` : ''}
              ${m.realPerson ? '<p class="ov-real">SYNK 대표 본인의 얼굴로, 본인 동의를 받아 만든 모델이에요. 신체 정보는 본인이 알려 준 값이에요.</p>' : ''}
            </div>
          </div>
          <nav class="jump" aria-label="모델 자료 구역">${secs.map((s) => `<a href="#s-${s.id}" data-act="jump">${E(s.title)}</a>`).join('')}<a href="#choose" data-act="jump">목소리·고르기</a></nav>
          ${secs.map((s) => s.html).join('')}
        </div>
        <aside class="side" aria-label="헤어·목소리 고르기">
          <form class="panel choose" id="choose">
            <h3>이 조합으로 고르기</h3>
            <fieldset><legend>헤어</legend><div class="opts">${m.hair.map((h, i) => { const s = m.shots[`hair-${i + 1}`]; return `<label class="opt"><input type="radio" name="hair" id="hair-${i}" value="${i}" ${i === p.hair ? 'checked' : ''}>${s ? `<img src="${E(s.s)}" alt="">` : ''}<span>${i + 1} · ${K(h.label)}</span></label>`; }).join('')}</div></fieldset>
            ${m.voices.length ? `<fieldset id="voices"><legend>목소리 <small>재생 단추로 들어 보세요</small></legend><div class="opts">${m.voices.map((v, i) => `<div class="opt-v"><label class="opt"><input type="radio" name="voice" id="voice-${i}" value="${i}" ${i === p.voice ? 'checked' : ''}><span class="v-text"><b>${i + 1} · ${K(v.label)}</b><small>${K(v.note)}</small>${v.text ? `<small class="v-line">“${E(v.text)}”</small>` : ''}</span></label>${voiceBtn(m, i)}</div>`).join('')}</div>${m.script ? `<p class="script">읽은 문장 “${E(m.script)}”</p>` : ''}</fieldset>` : '<p class="muted" id="voices">목소리는 상담에서 골라 드려요.</p>'}
            <label class="legend" for="memo">메모 <small>선택</small></label>
            <textarea class="input" id="memo" name="memo" rows="2" placeholder="예: 헤어는 2번인데 조금 더 짧게, 목소리는 1번 톤으로">${E(p.memo)}</textarea>
            <button class="btn dark wide" type="submit">${pickOf(m.code) ? '선택 내용 고치기' : '선택 목록에 담기'}</button>
            <p class="done" id="choose-done" role="status"></p>
          </form>
        </div>
      </div>`;
    if (!sheet.open) sheet.showModal();
    $('.sheet-body', sheet).scrollTop = 0; sheet.scrollTop = 0;
    watchLineups(sheet);
    try { history.replaceState(null, '', '#' + m.code); } catch { /* 주소를 못 바꿔도 창은 연다 */ }
    if (opts.choose) setTimeout(() => toChoose(), 60);
  }
  function toChoose() { const f = $('#choose'); if (!f) return; f.scrollIntoView({ block: 'start', behavior: 'smooth' }); $('input[name="hair"]:checked', f)?.focus({ preventScroll: true }); }
  function closeSheet() { stopAudio(); const s = $('#sheet'); if (s.open) s.close(); }
  $('#sheet').addEventListener('close', () => { stopAudio(); current = null; try { history.replaceState(null, '', location.pathname + location.search); } catch { /* 무시 */ } });

  /* ── 비교 창 ──────────────────────────────────────────── */
  let cmpShot = 'hero';
  function openCompare() {
    if (state.compare.length < 2) { toast('비교할 모델을 두 명 이상 담아 주세요. 카드 오른쪽 아래 「비교에 넣기」를 누르면 돼요.'); return; }
    renderCompare();
    const d = $('#compare'); if (!d.open) d.showModal();
    watchLineups(d);
  }
  function renderCompare() {
    const list = state.compare.map(byCode).filter(Boolean);
    const n = list.length;
    const brief = L.briefIsEmpty(state.brief) ? [] : L.recommend(list, state.brief, TAX, 9);
    const cell = (fn) => list.map((m) => `<div class="cc">${fn(m) || '<span class="muted">—</span>'}</div>`).join('');
    const row = (label, fn, cls = '') => `<div class="cr-label${cls}">${E(label)}</div>${cell(fn)}`;
    const shots = D.compareShots.filter((s) => list.some((m) => m.shots[s.key]));
    if (!shots.some((s) => s.key === cmpShot)) cmpShot = 'hero';
    const maxOf = (pick) => Math.max(...list.map((m) => pick(m) ?? -Infinity));
    const numCell = (pick, fmt, mark) => (m) => { const v = pick(m); if (v == null) return ''; return `<span class="num big">${fmt(v)}</span>${mark && v === maxOf(pick) && list.filter((x) => pick(x) === v).length === 1 ? `<span class="tag light">${E(mark)}</span>` : ''}`; };
    const d = $('#compare');
    d.innerHTML = `
      <div class="sheet-bar">
        <div class="sb-title"><span class="mono">COMPARE</span><b id="compare-title">모델 비교</b><span class="sb-sub">${n}명</span></div>
        <div class="sb-acts"><button type="button" class="icon-btn" data-act="close-compare" aria-label="비교 닫기"><span class="x" aria-hidden="true"></span></button></div>
      </div>
      <div class="cmp-body">
        <div class="seg cmp-shots" role="group" aria-label="같은 컷 고르기">${shots.map((s) => chip(`data-act="cmp-shot" data-v="${s.key}"`, s.label, s.key === cmpShot)).join('')}</div>
        <div class="cmp-scroll"><div class="cmp-grid" style="--n:${n}">
          ${list.map((m) => { const s = m.shots[cmpShot] || m.hero; return `<div class="cc cc-photo"><button type="button" data-act="open" data-code="${E(m.code)}" aria-label="${E(m.name)} 자세히 보기"><img src="${E(s.l)}" alt="${E(m.name + ' ' + (s.label || ''))}"></button>${m.shots[cmpShot] ? '' : '<span class="cc-miss">이 컷은 아직 없어 대표 사진을 보여요</span>'}</div>`; }).join('')}
          ${list.map((m) => `<div class="cc cc-name"><b>${E(m.name)}</b><span class="mono">${E(m.code)}</span><span class="cc-sub">${K(dot(m.gender, m.age, m.concept))}</span><div class="cc-acts"><button type="button" class="btn sm dark" data-act="choose" data-code="${E(m.code)}">고르기</button><button type="button" class="btn sm line" data-act="open" data-code="${E(m.code)}">자세히</button><button type="button" class="text-btn" data-act="cmp" data-code="${E(m.code)}">빼기</button></div></div>`).join('')}
          <div class="cr-wide"><div class="cr-label">키 비교 <span class="muted">같은 눈금, 정수리부터 신발 바닥까지</span></div>${lineupHTML(list, { maxH: 420, big: true, cols: true })}</div>
          ${brief.length ? row('브리프와 맞는 점', (m) => { const r = brief.find((x) => x.model.code === m.code); return r ? `<ul class="bo-why">${r.reasons.map((x) => `<li>${K(x.text)}</li>`).join('')}</ul>` : '<span class="muted">고른 업종·분위기와 겹치는 점이 적어요</span>'; }) : ''}
          ${row('인상', (m) => K(m.impression.join(' · ')))}
          ${row('키', numCell((m) => m.height, (v) => `${v}<small>cm</small>`, '가장 커요'))}
          ${row('등신', numCell((m) => m.body && m.body.heads, (v) => v.toFixed(2)))}
          ${row('어깨 ÷ 얼굴 폭', numCell((m) => m.body && m.body.shoulderFace, (v) => v.toFixed(2)))}
          ${row('다리 비율', numCell((m) => m.body && m.body.leg, (v) => v.toFixed(3)))}
          ${row('옷·신발', (m) => K(dot(m.sizes.top && '상의 ' + m.sizes.top, m.sizes.bottom && '하의 ' + m.sizes.bottom, m.sizes.shoe && '신발 ' + m.sizes.shoe)))}
          ${row('피부·눈', (m) => K(dot(m.skin, m.eyes)))}
          ${row('헤어 3가지', (m) => `<div class="cc-hair">${m.hair.map((h, i) => { const s = m.shots[`hair-${i + 1}`]; return `<figure>${s ? `<img src="${E(s.s)}" alt="">` : '<span class="ph"></span>'}<figcaption><b>${i + 1}</b><span> · ${K(h.label)}</span></figcaption></figure>`; }).join('')}</div>`)}
          ${row('목소리', (m) => m.voices.map((v, i) => `<div class="voice sm">${voiceBtn(m, i)}<span>${i + 1} · ${K(v.label)}</span></div>`).join(''))}
          ${row('어울리는 업종', (m) => `<div class="tags">${m.fits.map((f) => `<span class="tag">${K(f)}</span>`).join('')}</div>`)}
          ${row('자료', (m) => K([m.shotCount && `사진 ${m.shotCount}컷`, m.scenes.length && `장면 ${m.scenes.length}장`, m.motion.length && `움직임 ${m.motion.length}편`].filter(Boolean).join(' · ')))}
        </div></div>
      </div>`;
    watchLineups(d);
  }

  /* ── 내 선택 ──────────────────────────────────────────── */
  function renderCount() { $('#pick-count').textContent = state.picks.length; }
  function inquiry() { return L.inquiryText({ picks: state.picks, models: D.models, brief: state.brief, compare: state.compare, taxonomy: TAX, format: state.format }); }
  function openDrawer() {
    const d = $('#drawer');
    const body = state.picks.length ? state.picks.map((p) => { const m = byCode(p.code); return `<div class="pick"><img src="${E(m.hero.s)}" alt=""><div><h3>${E(m.name)} <span class="mono">${E(m.code)}</span></h3><p>${K(`헤어 ${p.hair + 1} · ${m.hair[p.hair]?.label || ''}`)}${m.voices[p.voice] ? `<br>${K(`목소리 ${p.voice + 1} · ${m.voices[p.voice].label}`)}` : ''}${p.memo ? `<br>메모: ${E(p.memo)}` : ''}</p><div class="pick-acts"><button type="button" class="text-btn" data-act="edit" data-code="${E(m.code)}">고치기</button><button type="button" class="text-btn" data-act="rm" data-code="${E(m.code)}">빼기</button></div></div></div>`; }).join('')
      : `<div class="bo-empty"><p class="lead-s">아직 고른 모델이 없어요.</p><p>모델 창에서 헤어와 목소리를 고른 뒤 「선택 목록에 담기」를 눌러 주세요.${state.compare.length ? ' 비교 중인 모델만 적어 보낼 수도 있어요.' : ''}</p></div>`;
    const canCopy = state.picks.length || state.compare.length;
    d.innerHTML = `<div class="drawer-head"><h2 id="drawer-title">내 선택 <span class="num">${state.picks.length}</span></h2><button type="button" class="icon-btn" data-act="close-drawer" aria-label="내 선택 닫기"><span class="x" aria-hidden="true"></span></button></div>
      <div class="drawer-body">${body}</div>
      ${canCopy ? `<div class="drawer-foot">
        <div class="seg" role="group" aria-label="글 모양">${chip('data-act="format" data-v="kmong"', '크몽 메시지', state.format === 'kmong')}${chip('data-act="format" data-v="order"', '발주서 메모', state.format === 'order')}</div>
        <label for="copy-out" class="legend">보낼 글</label>
        <textarea class="input copy-out" id="copy-out" readonly rows="9">${E(inquiry())}</textarea>
        <button type="button" class="btn dark wide" data-act="copy">글 복사하기</button>
        <p class="small">${state.format === 'order' ? '발주서 「장면·모델」 메모 칸에 붙여 넣어 주세요.' : '크몽 메시지 창에 그대로 붙여 넣어 주세요.'} 이 페이지에서 자동으로 보내지는 않아요.</p>
      </div>` : ''}`;
    if (!d.open) d.showModal();
  }

  /* ── 크게 보기 ────────────────────────────────────────── */
  function openLb(i) { if (i < 0 || !lbList.length) return; lbIndex = i; drawLb(); const el = $('#lightbox'); if (!el.open) el.showModal(); }
  function drawLb() {
    const g = lbList[lbIndex];
    $('#lightbox').innerHTML = `<div class="lb-top"><span>${E(current ? current.name : '')} · ${K(g.label)} <span class="num muted">${lbIndex + 1} / ${lbList.length}</span></span><button type="button" class="icon-btn light" data-act="close-lb" aria-label="크게 보기 닫기"><span class="x" aria-hidden="true"></span></button></div>
      <div class="lb-img"><img src="${E(g.l)}" alt="${E(g.label)}"></div>
      <div class="lb-nav"><button type="button" class="pill line light" data-act="lb-step" data-d="-1">이전 사진</button><button type="button" class="pill line light" data-act="lb-step" data-d="1">다음 사진</button></div>`;
  }

  /* ── 이벤트 ───────────────────────────────────────────── */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act, code = t.dataset.code, v = t.dataset.v;
    switch (act) {
      case 'open': if ($('#compare').open) $('#compare').close(); openModel(code); break;
      case 'choose': if ($('#compare').open) $('#compare').close(); openModel(code, { choose: true }); break;
      case 'cmp': toggleCompare(code); break;
      case 'cmp-set': state.compare = t.dataset.codes.split(',').slice(0, MAX_COMPARE); save(); syncCompare(); openCompare(); break;
      case 'open-compare': openCompare(); break;
      case 'close-compare': $('#compare').close(); break;
      case 'cmp-shot': cmpShot = v; renderCompare(); break;
      case 'filter': filters[t.dataset.f] = v; renderFilters(); renderGrid(); break;
      case 'bf-ind': state.brief.industry = state.brief.industry === v ? '' : v; touchBrief(); renderBriefForm(); renderBriefOut(); break;
      case 'bf-mood': {
        const ms = state.brief.moods || [];
        if (ms.includes(v)) state.brief.moods = ms.filter((x) => x !== v);
        else { state.brief.moods = [...ms, v].slice(-2); }
        touchBrief(); renderBriefForm(); renderBriefOut(); break;
      }
      case 'bf-gender': state.brief.gender = v; touchBrief(); renderBriefForm(); renderBriefOut(); break;
      case 'bf-age': state.brief.age = v; touchBrief(); renderBriefForm(); renderBriefOut(); break;
      case 'bf-reset': state.brief = { industry: '', product: '', moods: [], gender: '', age: '', touched: true }; save(); renderBriefForm(); renderBriefOut(); $('#bf-product')?.focus(); break;
      case 'voice': toggleVoice(t); break;
      case 'lb': openLb(Number(t.dataset.i)); break;
      case 'lb-step': lbIndex = (lbIndex + Number(t.dataset.d) + lbList.length) % lbList.length; drawLb(); break;
      case 'close-lb': $('#lightbox').close(); break;
      case 'close-sheet': closeSheet(); break;
      case 'to-choose': toChoose(); break;
      case 'jump': e.preventDefault(); $(t.getAttribute('href'), $('#sheet'))?.scrollIntoView({ block: 'start', behavior: 'smooth' }); break;
      case 'hair': {
        const r = $(`#hair-${t.dataset.i}`); if (r) r.checked = true;
        for (const b of $$('[data-act="hair"]')) b.setAttribute('aria-pressed', b === t ? 'true' : 'false');
        toast(`헤어 ${Number(t.dataset.i) + 1}번을 골랐어요. 오른쪽 「선택 목록에 담기」로 저장해 주세요.`); break;
      }
      case 'scene-tag': {
        for (const b of $$('[data-act="scene-tag"]')) b.setAttribute('aria-pressed', b === t ? 'true' : 'false');
        for (const f of $$('.scene')) f.hidden = !!v && !f.dataset.tags.split(' ').includes(v);
        break;
      }
      case 'open-picks': openDrawer(); break;
      case 'close-drawer': $('#drawer').close(); break;
      case 'rm': state.picks = state.picks.filter((p) => p.code !== code); save(); renderCount(); renderGrid(); openDrawer(); break;
      case 'edit': $('#drawer').close(); openModel(code, { choose: true }); break;
      case 'format': state.format = v; save(); openDrawer(); break;
      case 'copy': {
        const text = inquiry();
        const fallback = () => { const ta = $('#copy-out'); ta.focus(); ta.select(); toast('글을 선택해 두었어요. 복사해서 붙여 넣어 주세요.'); };
        try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('글을 복사했어요. 붙여 넣기만 하면 돼요.'), fallback); else fallback(); } catch { fallback(); }
        break;
      }
      default: break;
    }
  });
  $('#open-compare').addEventListener('click', openCompare);
  $('#open-picks').addEventListener('click', openDrawer);
  $('#clear-filters').addEventListener('click', () => { Object.assign(filters, { gender: '전체', age: '전체', concept: '전체', height: '전체', industry: '' }); renderFilters(); renderGrid(); });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'f-industry') { filters.industry = e.target.value; renderGrid(); }
  });
  let typing = 0;
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'bf-product') return;
    state.brief.product = e.target.value; state.brief.touched = true;
    clearTimeout(typing); typing = setTimeout(() => { save(); renderBriefOut(); const s = $('.bf-foot'); if (s && !$('.bf-state', s)) renderBriefFormKeepFocus(); }, 220);
  });
  function renderBriefFormKeepFocus() {
    const pos = $('#bf-product')?.selectionStart; renderBriefForm();
    const i = $('#bf-product'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch { /* 무시 */ } }
  }
  $('#brief-form').addEventListener('submit', (e) => e.preventDefault());
  $('#sheet').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!current) return;
    const f = e.target, hair = Number(f.hair.value), voice = f.voice ? Number(f.voice.value) : 0, memo = f.memo.value.trim();
    const had = !!pickOf(current.code);
    state.picks = state.picks.filter((p) => p.code !== current.code).concat({ code: current.code, hair, voice, memo });
    save(); renderCount(); renderGrid();
    $('#choose-done').textContent = `${current.name}${L.josa(current.name, '을', '를')} ${had ? '고쳐 담았어요' : '선택 목록에 담았어요'}. 위쪽 「내 선택」에서 문의 글로 복사할 수 있어요.`;
    f.querySelector('button[type=submit]').textContent = '선택 내용 고치기';
  });
  // 바깥(배경)을 누르면 닫는다
  for (const id of ['sheet', 'compare', 'drawer', 'lightbox']) {
    const d = document.getElementById(id);
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  }
  $('#compare').addEventListener('close', stopAudio);
  document.addEventListener('keydown', (e) => {
    if (!$('#lightbox').open) return;
    if (e.key === 'ArrowLeft') { lbIndex = (lbIndex - 1 + lbList.length) % lbList.length; drawLb(); }
    if (e.key === 'ArrowRight') { lbIndex = (lbIndex + 1) % lbList.length; drawLb(); }
  });

  renderHero(); renderBriefForm(); renderBriefOut(); renderFilters(); renderGrid(); renderCount(); syncCompare();
  watchLineups(document);
  const h = (location.hash || '').slice(1);
  if (byCode(h)) openModel(h);
  window.addEventListener('hashchange', () => { const c = (location.hash || '').slice(1); if (byCode(c) && (!current || current.code !== c)) openModel(c); });
})();
