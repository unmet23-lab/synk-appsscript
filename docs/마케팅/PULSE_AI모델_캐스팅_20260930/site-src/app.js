(function () {
  'use strict';
  // PULSE 모델 캐스팅북 2판(10-18). 한 페이지 안에서 주소 뒤 #으로 화면을 바꾼다.
  // 아티팩트 보기 링크에는 글자·숫자·. _ ~ - 만 넘어오므로 그 글자만 쓴다(1판의 #F02, #/m/F02도 연다).
  //   #board            모델 보드(광고 내용으로 순서 바꾸기·거르기)   #lineup  키 순서   #row[-F02]  영상으로 보기(모델 벽, 11-05)
  //   #m-F02[-탭]       모델 북(북·디지털·장면·프로필 — 10-22 「움직임」 탭은 뺐다, 옛 #m-…-motion은 북으로)         #swipe   넘기며 고르기
  //   #pkg[-inq]        패키지(컴프 카드·나란히 비교·문의 글)        #p-F02.1.0~F04.0.2  공유받은 패키지
  //   #g-OUTBLUE        그룹(11-02 아이돌 두 팀 — 단체 컷·멤버·콘셉트 룩·팀 통째로 담기)
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

  /* ── 그룹(11-02 아이돌 두 팀) ─────────────────────────── */
  // 모델의 group·position·memberColor는 빌드가 넣는다. 없으면(원고 그대로 여는 시험) 그룹 목록의 멤버 칸에서 채운다.
  // 단체 컷이 아직 없는 팀은 멤버 대표 사진을 이어 붙여 대신한다. 주소 #g-<id>의 id에는 「-」가 없다(빌드가 막는다).
  const GROUPS = (D.groups || []).filter((g) => g && /^[A-Z][A-Z0-9]{2,}$/.test(g.id));
  const groupById = (id) => GROUPS.find((g) => g.id === id);
  const hexOk = (h) => (/^#[0-9A-Fa-f]{6}$/.test(String(h || '')) ? h : '#9A9A93');
  for (const g of GROUPS) for (const x of g.members || []) { const m = byCode(x.code); if (m && !m.group) Object.assign(m, { group: g.id, position: x.position, memberColor: { label: x.color, hex: x.hex } }); }
  const teamOf = (m) => (m && m.group ? groupById(m.group) || null : null);
  const teamMembers = (g) => (g.members || []).map((x) => byCode(x.code)).filter(Boolean);
  const cutsOf = (g) => (g.cuts || []).filter((c) => c && c.s && c.l);
  const teamKind = (ms) => (ms.length && ms.every((m) => m.gender === '여') ? '걸그룹' : ms.length && ms.every((m) => m.gender === '남') ? '보이그룹' : '그룹');
  // 그룹 꼬리표: 「● OUTBLUE · 리더 · 메인보컬」, 누르면 그룹 페이지
  function gtagHTML(m) {
    const g = teamOf(m); if (!g) return '';
    return `<a class="gtag" href="#g-${E(g.id)}" style="--mc:${E(hexOk(m.memberColor && m.memberColor.hex))}" aria-label="${E(g.name)} 그룹 보기${m.position ? `, ${E(m.position)}` : ''}"><i aria-hidden="true"></i><b>${E(g.name)}</b>${m.position ? `<span>${K(m.position)}</span>` : ''}</a>`;
  }

  /* ── 저장: 이 브라우저에만 남는 편의 기능. 막혀 있어도 화면은 그대로 쓴다 ── */
  const KEY = 'pulse-casting-v3';
  const state = { pkg: [], sel: {}, ask: '', lead: '', ...load() };
  delete state.format; // 10-26 전 판의 글 모양(크몽 메시지 · 발주서 메모) 고르기는 뺐다
  state.pkg = state.pkg.filter(byCode);
  // 11-03 견본 목소리 · 「우리 광고 문장으로 듣기」를 뺐다 — 전 판에 저장된 목소리 번호 · 문장은 버리고 헤어 · 메모만 남긴다
  for (const [c, s] of Object.entries(state.sel || {})) state.sel[c] = { hair: Number((s && s.hair) || 0), memo: String((s && s.memo) || '') };
  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && typeof v === 'object') return v;
      // 1판(비교·내 선택 따로)에서 옮겨 온다: 둘 다 패키지로
      const o = JSON.parse(localStorage.getItem('pulse-casting-v2') || 'null');
      if (o && typeof o === 'object') {
        const sel = {}; for (const p of o.picks || []) sel[p.code] = { hair: p.hair || 0, memo: p.memo || '' };
        return { pkg: [...new Set([...(o.picks || []).map((p) => p.code), ...(o.compare || [])])], sel, ask: (o.brief && o.brief.touched && o.brief.product) || '' };
      }
    } catch { /* 저장이 막힌 브라우저 */ }
    return {};
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ pkg: state.pkg, sel: state.sel, ask: state.ask, lead: state.lead })); } catch { /* 무시 */ } }
  const selOf = (c) => ({ hair: 0, memo: '', ...(state.sel[c] || {}) });
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
    // 클립보드를 막는 브라우저(메신저 앱 안 브라우저 등): 문의 글이면 그 칸을 골라 두고, 공유 링크처럼 화면에 없는 글은 창에 띄워 직접 복사하게 한다
    const fallback = () => {
      const ta = $('#inq-text');
      if (ta && ta.value === text) { ta.focus(); ta.select(); toast('글을 선택해 두었어요. 복사해서 붙여 넣어 주세요.'); return; }
      try { window.prompt('아래 내용을 복사해 주세요.', text); } catch { toast('복사하지 못했어요. 잠시 뒤 다시 눌러 주세요.'); }
    };
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
    // 프로필의 키 띠는 모두를 한 눈금에 세워 화면보다 넓다 — 지금 모델이 띠 가운데 오게 옆으로 민다(10-24 화면 검수).
    // 위에서 너비를 비웠다 다시 잡을 때 스크롤이 처음으로 돌아가므로 맞출 때마다 다시 민다. 보드의 키 순서는 지금 모델이 없어 그대로다.
    const on = minK && $('.lu-fig.on', lu), sc = lu.parentElement;
    if (on && sc.classList.contains('lu-scroll')) sc.scrollLeft = on.offsetLeft + on.offsetWidth / 2 - sc.clientWidth / 2;
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver((es) => es.forEach((e) => fitLineup(e.target.closest('[data-lu]')))) : null;
  function watchLineups(scope) {
    $$('[data-lu]', scope).forEach(fitLineup);
    if (ro) $$('[data-lu] .lu-row', scope).forEach((r) => ro.observe(r));
  }

  /* ── 목소리 ───────────────────────────────────────────── */
  // 11-03 견본 목소리 · 듣기 단추 · 「우리 광고 문장으로 듣기」를 모두 뺐다(유호님 「둘 다 전부 빼기」). 실제 광고 목소리는
  // 장면마다 연기로 따로 만들어 견본과 같게 들릴 수 없었다. 모델 북에는 아래 한 줄만 남긴다.
  const VOICE_LINE = '목소리는 광고 장면에 맞춰 연기로 만들고, 시안 단계에서 들려 드려요.';

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
  const filters = { gender: '', group: '', age: '', concept: '', industry: '', height: '' };
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
          ${m.tagline ? `<span class="tagline">${K(`“${m.tagline}”`)}</span>` : ''}
          <span class="line">${K(dot(m.height && m.height + 'cm', m.age || m.ageBand, m.concept))}</span>
          ${r ? `<span class="why">${K(whyOf(r))}</span>` : ''}</div>
      </a>
      ${gtagHTML(m)}
      ${pkgBtn(m, 'add', '패키지에 담김', '+ 패키지')}
    </article>`;
  }
  // 보드 머리 아래 그룹 띠: 팀마다 카드 한 장(단체 컷 또는 멤버 대표 이어 붙임 · 이름 · 한 줄 · 멤버 색)
  function teamCardHTML(g) {
    const ms = teamMembers(g), cut = cutsOf(g)[0];
    const ph = cut
      ? `<img src="${E(cut.s)}" srcset="${E(cut.s)} 720w, ${E(cut.l)} 1600w" sizes="(max-width:760px) 100vw, 30vw" alt="" loading="lazy">`
      : `<span class="team-row">${(g.members || []).map((x) => { const m = byCode(x.code); return m ? `<span style="--mc:${E(hexOk(x.hex))}">${m.hero ? `<img src="${E(m.hero.s)}" alt="" loading="lazy">` : ''}</span>` : ''; }).join('')}</span>`;
    return `<a class="team" data-team="${E(g.id)}" href="#g-${E(g.id)}">
        <span class="team-ph">${ph}</span>
        <span class="team-tx">
          <span class="team-k">${E(dot(g.hanja, teamKind(ms)))}</span>
          <b class="team-name">${E(g.name)}</b>
          <span class="team-ko">${E(g.nameKo)}</span>
          <span class="team-line">${K(g.line)}</span>
          <span class="team-dots">${(g.members || []).map((x) => { const m = byCode(x.code); return m ? `<span><i style="background:${E(hexOk(x.hex))}"></i>${E(m.name)}</span>` : ''; }).join('')}</span>
          <span class="team-go">그룹 보기 <span aria-hidden="true">→</span></span>
        </span></a>`;
  }
  const teamsHTML = () => (GROUPS.length ? `<section class="teams pad" aria-label="아이돌 그룹">${GROUPS.map(teamCardHTML).join('')}</section>` : '');
  function filtersHTML(mode) {
    const order = ['상큼', '지적', '섹시', '개성'];
    const concepts = uniq(D.models.map((m) => m.concept)).sort((a, b) => (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99);
    const sel = (k, label, opts) => `<label class="g"><span class="k">${E(label)}</span><select data-f="${k}" aria-label="${E(label)}"><option value="">전체</option>${opts.map(([v, l]) => `<option value="${E(v)}"${filters[k] === v ? ' selected' : ''}>${E(l)}</option>`).join('')}</select></label>`;
    const count = (id) => D.models.filter((m) => (m.industries || []).includes(id)).length;
    return `<div class="filters pad" role="group" aria-label="모델 거르기">
      ${sel('gender', '성별', [['여', '여자'], ['남', '남자']])}
      ${GROUPS.length ? sel('group', '그룹', GROUPS.map((g) => [g.id, g.name])) : ''}
      ${sel('age', '나이', uniq(D.models.map((m) => m.ageBand)).sort().map((a) => [a, a]))}
      ${sel('concept', '콘셉트', concepts.map((c) => [c, c]))}
      ${sel('industry', '업종', D.industries.filter((i) => count(i.id)).map((i) => [i.id, `${i.label} ${count(i.id)}`]))}
      ${sel('height', '키', uniq(D.models.map((m) => L.heightBand(m.height))).sort().map((h) => [h, h]))}
      <span class="g view" role="group" aria-label="보기">${[['board', '사진'], ['row', '영상'], ['lineup', '키 순서'], ['swipe', '한 명씩']].map(([k, l]) => `<a class="tg" href="#${k}"${mode === k ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</span>
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
        <a class="swipe-cta" href="#row">영상으로 보기<span aria-hidden="true">→</span></a>
      </section>
      ${mode === 'board' ? teamsHTML() : ''}
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
      <div class="slot"><h2>찾는 얼굴이 없나요?</h2><p>원하는 나이·분위기를 알려 주시면 같은 방식으로 새 모델을 만들어 드려요. 아이돌 그룹처럼 여럿을 한 팀으로도 만들 수 있어요.</p><a class="link" href="${E(formUrl(newModelText()))}" target="_blank" rel="noopener" data-act="new-model">새 모델 문의하기 <span aria-hidden="true">↗</span></a></div></section>`;
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
    const tabs = [['book', '북', book.length], ['dig', '디지털', dig.length], m.scenes.length && ['scene', '장면', m.scenes.length], ['prof', '프로필', 0]].filter(Boolean);
    if (!tabs.some(([k]) => k === tab)) tab = 'book';
    const s = selOf(m.code);
    view.innerHTML = `
      <section class="book-head pad">
        <a class="back" href="#board">← 모델 보드</a>
        <div>
          <h1>${E(m.name)} <small class="num">${E(m.code)}</small></h1>
          ${m.tagline ? `<p class="tagline">${K(`“${m.tagline}”`)}</p>` : ''}
          <p class="who">${K(whoOf(m))}</p>
          ${teamOf(m) ? `<p class="g-of">${gtagHTML(m)}</p>` : ''}
          ${m.realPerson ? '<p class="real">실제 인물 · SYNK 대표 본인의 얼굴로, 본인 동의를 받아 만든 모델이에요. 신체 정보는 본인이 알려 준 값이에요.</p>' : ''}
        </div>
        <div class="acts">${pkgBtn(m)}<a class="btn ink" href="#pkg-inq" data-act="ask-this" data-code="${E(m.code)}">이 모델로 문의</a></div>
      </section>
      <div class="pad"><nav class="tabs" role="tablist" aria-label="모델 자료">${tabs.map(([k, l, n]) => `<button type="button" role="tab" data-act="tab" data-v="${k}" aria-selected="${k === tab}">${E(l)}${n ? `<small class="num">${n}</small>` : ''}</button>`).join('')}</nav></div>
      <div id="tab-body"></div>
      <div class="pad">${compHTML(m)}</div>
      <section class="pick pad" aria-label="이 모델로 고르기">
        <div><h2>헤어 고르기</h2><div class="hairs" role="group" aria-label="헤어">${m.hair.map((h, i) => { const sh = m.shots['hair-' + (i + 1)]; return `<button type="button" data-act="hair" data-i="${i}" aria-pressed="${i === s.hair}">${sh ? `<img src="${E(sh.s)}" alt="" loading="lazy">` : ''}<span>${i + 1} · ${K(h.label)}</span></button>`; }).join('')}</div></div>
        <div class="voice-note"><h2>목소리</h2><p>${E(VOICE_LINE)}</p></div>
        <div class="fit"><h2>어울리는 광고</h2><p>${K(m.fits.join(' · '))}</p>
          ${(m.roles || []).length ? `<p class="roles"><b>맡는 역할</b>${K(m.roles.join(' · '))}</p>` : ''}
          ${m.direction ? `<ul>${m.direction.fit.slice(0, 4).map((t) => `<li>${K(t)}</li>`).join('')}</ul>` : ''}
          <label class="sec-h" for="memo">메모 <span class="muted">선택</span></label>
          <textarea class="memo" id="memo" rows="2" placeholder="예: 헤어는 2번인데 조금 더 짧게">${E(s.memo)}</textarea>
          ${pkgBtn(m, 'btn ink wide', '패키지에 담김 · 빼려면 누르기', '이 조합으로 패키지에 넣기')}</div>
      </section>`;
    drawTab(m, tab);
    $('#memo').addEventListener('input', (e) => setSel(m.code, { memo: e.target.value }));
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
    // 프로필
    const info = [['한 줄 캐릭터', m.tagline && `“${m.tagline}”`], ['성별', sexWord(m.gender)], ['나이대', m.age || m.ageBand], ['콘셉트', m.concept], ['그룹', teamOf(m) && `${teamOf(m).name} (${teamOf(m).nameKo})`], ['포지션', teamOf(m) && m.position], ['멤버 색', teamOf(m) && m.memberColor && m.memberColor.label], ['맡는 역할', (m.roles || []).join(' · ')], ['키', m.height && m.height + 'cm'], ['몸무게', m.weightKg && m.weightKg + 'kg (설정값)'], ['체형', m.build], ['옷 사이즈', dot(m.sizes.top && '상의 ' + m.sizes.top, m.sizes.bottom && '하의 ' + m.sizes.bottom)], ['신발', m.sizes.shoe && m.sizes.shoe + 'mm'], ['피부 톤', m.skin], ['눈', m.eyes], ['기본 헤어', m.hairBase], ['어울리는 업종', m.fits.join(' · ')]].filter(([, v]) => v);
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

  /* ── 그룹 페이지(#g-<id>) ─────────────────────────────── */
  // 큰 단체 컷(여럿이면 넘기기) → 한 줄·왜 지금·의상 → 멤버 넷(누르면 모델 북) → 멤버별 콘셉트 룩 → 키 순서.
  // 「팀 통째로 담기」는 넷을 기존 패키지에 담는다(컴프 카드·나란히 비교·공유 #p-·문의 글을 그대로 쓴다).
  let gLists = { cuts: [], looks: [] }, gCut = 0, curGroup = '';
  function teamActsHTML(g) {
    const codes = teamMembers(g).map((m) => m.code), all = codes.length > 0 && codes.every(inPkg);
    return `${all ? `<a class="btn ink" href="#pkg" data-act="team-compare" data-g="${E(g.id)}">패키지에서 나란히 보기</a>` : `<button type="button" class="btn ink" data-act="team-pkg" data-g="${E(g.id)}">그룹 통째로 패키지에 담기 <span class="num">${codes.length}명</span></button>`}<a class="btn line" href="#pkg-inq" data-act="team-ask" data-g="${E(g.id)}">이 그룹으로 문의</a><a class="btn line" href="#row" data-act="team-row" data-g="${E(g.id)}">영상으로 보기</a>`;
  }
  function stageHTML(g, ms, cuts) {
    if (cuts.length) {
      const c = cuts[0];
      return `<figure class="g-cut"><button type="button" data-act="glb" data-list="cuts" data-i="0" id="g-cut-btn" aria-label="단체 컷 크게 보기"><img id="g-cut-img" src="${E(c.l)}" alt="${E(`${g.name} 단체 컷 · ${dot(c.place, c.label)}`)}"></button>
        <figcaption class="g-cut-bar"><span id="g-cut-cap">${K(dot(c.place, c.label))}</span>${cuts.length > 1 ? `<span class="g-cut-nav"><button type="button" class="sq" data-act="g-cut" data-d="-1" aria-label="이전 단체 컷">←</button><span class="num" id="g-cut-n">1 / ${cuts.length}</span><button type="button" class="sq" data-act="g-cut" data-d="1" aria-label="다음 단체 컷">→</button></span>` : ''}</figcaption></figure>`;
    }
    // 단체 컷이 아직 없으면 멤버 넷을 전신으로 나란히(아래 멤버 칸의 대표 사진과 겹치지 않게, 전신이 없으면 대표) — 누르면 그 모델 북
    return `<figure class="g-cut"><div class="g-collage">${ms.map((m) => { const ph = m.shots.fullbody || m.hero; return `<a href="#m-${E(m.code)}" style="--mc:${E(hexOk(m.memberColor && m.memberColor.hex))}" aria-label="${E(m.name)} 모델 북 보기">${ph ? `<img src="${E(ph.l)}" alt="${E(`${m.name} ${ph.label || ''}`)}" loading="lazy">` : ''}<span>${E(m.name)}</span></a>`; }).join('')}</div>
      <figcaption class="g-cut-bar"><span>멤버 ${ms.length}명의 전신 · 누르면 모델 북</span></figcaption></figure>`;
  }
  function renderGroup(id) {
    const g = groupById(id); if (!g) { go('#board'); return; }
    curGroup = g.id;
    const ms = teamMembers(g), cuts = cutsOf(g);
    const looks = ms.flatMap((m) => m.scenes.filter((s) => s.concept).map((s) => ({ s: s.s, l: s.l, label: `${m.name} · ${s.place} · ${s.label}`, name: m.name, place: s.place, tail: s.label.split(' · ').pop() })));
    gLists = { cuts: cuts.map((c) => ({ s: c.s, l: c.l, label: dot(c.place, c.label) })), looks };
    gCut = 0;
    const sorted = ms.filter((m) => m.height).slice().sort((a, b) => a.height - b.height);
    view.innerHTML = `
      <section class="g-band" data-team="${E(g.id)}" aria-labelledby="g-title">
        <div class="g-head pad">
          <a class="back" href="#board">← 모델 보드</a>
          <div>
            <p class="team-k">${E(dot(g.hanja, teamKind(ms), `${ms.length}명`))}</p>
            <h1 id="g-title">${E(g.name)}</h1>
            <p class="g-ko">${E(g.nameKo)}</p>
            <p class="g-line">${K(g.line)}</p>
          </div>
          <div class="acts" id="g-acts">${teamActsHTML(g)}</div>
        </div>
        <div class="g-stage pad">${stageHTML(g, ms, cuts)}</div>
      </section>
      <section class="g-about pad">
        <div><h2 class="sec-h">왜 지금 이 콘셉트인가</h2><p>${K(g.why)}</p></div>
        <div><h2 class="sec-h">무대 의상</h2><p>${K(g.look)}</p></div>
      </section>
      <section class="g-members pad" aria-labelledby="g-mem-title">
        <h2 class="sec-h" id="g-mem-title">멤버</h2>
        <div class="g-mems">${(g.members || []).map((x) => { const m = byCode(x.code); return m ? `<a class="g-mem" href="#m-${E(m.code)}" style="--mc:${E(hexOk(x.hex))}">
            <span class="g-mem-ph">${m.hero ? `<img src="${E(m.hero.s)}" alt="" loading="lazy">` : ''}</span>
            <span class="g-pos">${K(x.position)}</span>
            <span class="g-nm"><b>${E(m.name)}</b><span class="num">${E(m.code)}</span></span>
            <span class="g-col"><i aria-hidden="true"></i>${E(x.color)}</span>
            ${m.tagline ? `<span class="g-tl">${K(`“${m.tagline}”`)}</span>` : ''}</a>` : ''; }).join('')}</div>
      </section>
      <section class="g-looks pad" aria-labelledby="g-look-title">
        <h2 class="sec-h" id="g-look-title">멤버별 콘셉트 컷 <span class="muted">무대·화보</span></h2>
        ${looks.length ? `<div class="scene-grid">${looks.map((s, i) => `<figure class="scene"><button type="button" data-act="glb" data-list="looks" data-i="${i}" aria-label="${E(s.label)} 크게 보기"><img src="${E(s.s)}" alt="${E(s.label)}" loading="lazy"></button><figcaption><b>${E(s.name)}</b>${K(dot(s.place, s.tail))}</figcaption></figure>`).join('')}</div>`
          : '<p class="mt-help">무대·화보 콘셉트 컷은 준비하고 있어요. 지금은 모델 북에서 프로필 사진을 볼 수 있어요.</p>'}
      </section>
      ${sorted.length ? `<section class="g-lineup pad" aria-label="키 순서"><h2 class="sec-h">키 순서</h2>${lineupHTML(sorted, { maxH: 380 })}<p class="mt-help">멤버를 같은 눈금에 세웠어요. 정수리부터 신발 바닥까지 잰 키예요.</p></section>` : ''}`;
    watchLineups(view);
  }
  function stepCut(d) {
    const list = gLists.cuts; if (list.length < 2) return;
    gCut = (gCut + d + list.length) % list.length;
    const c = list[gCut], img = $('#g-cut-img'), g = groupById(curGroup);
    if (!img) return;
    img.src = c.l; img.alt = `${g ? g.name : ''} 단체 컷 · ${c.label}`;
    $('#g-cut-btn').dataset.i = gCut;
    $('#g-cut-cap').innerHTML = K(c.label);
    $('#g-cut-n').textContent = `${gCut + 1} / ${list.length}`;
  }
  function addTeam(g) {
    const codes = teamMembers(g).map((m) => m.code), fresh = codes.filter((c) => !inPkg(c));
    state.pkg.push(...fresh); save(); syncPkg();
    return fresh.length;
  }

  /* ── 패키지 ───────────────────────────────────────────── */
  let pkgMode = 'cards', cmpShot = 'hero';
  // 공유 주소: #p-F02.1.0~F04.0.0 (코드.헤어.0). 셋째 자리는 옛 목소리 번호 자리라 11-03부터 늘 0이고, 옛 링크의 그 자리는 읽지 않는다.
  const shareCode = (items) => L.castingCode(items);
  function readShare(s) {
    return String(s || '').split('~').map((t) => { const [code, h] = t.split('.'); const m = byCode(code); return m && { code, hair: Math.min(Number(h) || 0, m.hair.length - 1), memo: '' }; }).filter(Boolean);
  }
  const myItems = () => state.pkg.map((c) => { const s = selOf(c); return { code: c, hair: s.hair, memo: s.memo }; });
  function cardHTML(x, shared) {
    const m = byCode(x.code), hairShot = m.shots['hair-' + (x.hair + 1)] || m.hero;
    const side = [m.shots['exp-smile'] || m.shots['look-1'], m.shots['fullbody'] || m.shots['look-2']].filter(Boolean);
    const cells = compCells(m);
    return `<article class="comp-card" data-code="${E(m.code)}">
      <div class="cc-photos"><img src="${E(hairShot.l)}" alt="${E(m.name)} ${E(hairShot.label || '')}" loading="lazy">${side.map((s) => `<img src="${E(s.s)}" alt="" loading="lazy">`).join('')}</div>
      <div class="cc-body">
        <div class="cc-top"><h2>${E(m.name)}</h2><span class="num">${E(m.code)}${m.realPerson ? ' · 실제 인물' : ''}</span></div>
        <p class="cc-who">${K(whoOf(m))}</p>
        <dl class="cc-comp">${cells.map(([k, val]) => `<div><dt>${E(k)}</dt><dd class="num">${val}</dd></div>`).join('')}</dl>
        <dl class="cc-pick">
          <dt>헤어</dt><dd>${x.hair + 1} · ${K(m.hair[x.hair].label)}</dd>
          <dt>어울림</dt><dd>${K(m.fits.slice(0, 3).join(' · '))}</dd>
          ${m.direction ? `<dt>연출</dt><dd>${K(m.direction.fit.slice(0, 2).join(' · '))}</dd>` : ''}
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
        ${list.some((m) => m.tagline) ? row('한 줄 캐릭터', (m) => (m.tagline ? K(`“${m.tagline}”`) : '')) : ''}
        ${list.some(teamOf) ? row('그룹', (m) => (teamOf(m) ? K(dot(teamOf(m).name, m.position)) : '')) : ''}
        ${row('인상', (m) => K(m.impression.join(' · ')))}
        ${list.some((m) => (m.roles || []).length) ? row('맡는 역할', (m) => K((m.roles || []).join(' · '))) : ''}
        ${row('키', num((m) => m.height, (v) => `${v}<small>cm</small>`))}
        ${row('등신', num((m) => m.body && m.body.heads, (v) => v.toFixed(2)))}
        ${row('어깨 ÷ 얼굴 폭', num((m) => m.body && m.body.shoulderFace, (v) => v.toFixed(2)))}
        ${row('다리 비율', num((m) => m.body && m.body.leg, (v) => v.toFixed(3)))}
        ${row('옷·신발', (m) => K(dot(m.sizes.top && '상의 ' + m.sizes.top, m.sizes.bottom && '하의 ' + m.sizes.bottom, m.sizes.shoe && '신발 ' + m.sizes.shoe)))}
        ${row('고른 헤어', (m) => { const h = items.find((x) => x.code === m.code).hair; return K(`${h + 1} · ${m.hair[h].label}`); })}
        ${row('어울리는 업종', (m) => K(m.fits.join(' · ')))}
      </div></div>`;
  }
  // 「누구로 진행할까요?」(10-19): 고른 모델이 문의 글 맨 위 「진행하고 싶은 모델」이 된다. 'none'은 상담에서 정하기,
  // 아직 고르지 않았으면 한 명만 담았을 때 그 모델. 손님 글에 코드를 넣는 대신 손님이 직접 고르게 했다.
  const leadOf = (items) => (state.lead === 'none' ? '' : items.some((x) => x.code === state.lead) ? state.lead : items.length === 1 ? items[0].code : '');
  function leadHTML(items) {
    if (!items.length) return '';
    const lead = leadOf(items) || 'none';
    const opt = (code, label, img) => `<button type="button" class="lead-opt${img ? '' : ' none'}" data-act="lead" data-code="${E(code)}" aria-pressed="${lead === code}">${img ? `<img src="${E(img)}" alt="" loading="lazy">` : ''}${E(label)}</button>`;
    return `<div class="lead" role="group" aria-labelledby="lead-title"><span class="sec-h" id="lead-title">누구로 진행할까요?</span>
        <div class="lead-opts">${items.map((x) => { const m = byCode(x.code); return opt(x.code, m.name, m.hero && m.hero.s); }).join('')}${opt('none', '상담에서 정할게요')}</div>
        <p class="mt-help">고른 모델이 문의 글 맨 위에 「진행하고 싶은 모델」로 들어가요.</p></div>`;
  }
  function inquiryOf(items) {
    return L.inquiryText({ picks: items, models: D.models, brief: { product: state.ask, industry: '', moods: [], touched: !!state.ask.trim() }, compare: [], taxonomy: TAX, format: 'kmong', lead: leadOf(items) });
  }
  // 문의 보낼 곳(2026-10-26): synk.im의 문의 양식(Google Forms)과 hello@synk.im. 양식은 유형을 PULSE로 고르고 「문의 내용」 칸에 글을 채워 연다.
  // 칸 번호 · 유형 글은 그 양식 그대로이고, SYNK-website 원격 원고(10-26 02c8cbe) site-v10/content/ko.mjs의 PULSE 쪽 의뢰 양식과 같다.
  // 예전 안내(크몽 메시지 · 발주서 메모에 붙여 넣기)는 synk.im에서 그리로 가는 길이 없어 뺐다. 글 자체는 담당자 칸이 그대로 읽는 편지 꼴이다.
  const CONTACT = { email: 'hello@synk.im', form: 'https://docs.google.com/forms/d/e/1FAIpQLSc4Z1BdhPxMi0bWP7enSganI4xCIsTcCxRJ8EpxiWRxyVfsIg/viewform',
    type: ['entry.1425474537', 'PULSE · 제작 협업·작품 이용·광고'], text: 'entry.1372278933' };
  // 이보다 긴 주소는 글 없이 열고 글은 복사해 둔다. 양식은 10-26 4.5KB 주소가 그대로 채워짐을 확인했고,
  // 메일은 Windows에서 브라우저 → 메일 앱으로 넘어가는 mailto가 2,000자 안팎에서 본문이 비거나 잘릴 수 있어 더 짧게 둔다(한글 한 자 = 인코딩 9자).
  const FORM_MAX = 6000, MAIL_MAX = 1800;
  const fitUrl = (base, key, text, max) => { const full = `${base}&${key}=${encodeURIComponent(text)}`; return full.length <= max ? full : base; };
  const formUrl = (text) => fitUrl(`${CONTACT.form}?usp=pp_url&${CONTACT.type[0]}=${encodeURIComponent(CONTACT.type[1])}`, CONTACT.text, text, FORM_MAX);
  const mailUrl = (subject, text) => fitUrl(`mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}`, 'body', text, MAIL_MAX);
  function subjectOf(items) {
    const lead = leadOf(items), first = byCode(lead || (items[0] && items[0].code));
    if (!first) return '[PULSE] 모델 캐스팅 문의';
    return `[PULSE] 모델 캐스팅 문의 — ${first.name}${items.length > 1 ? ` 외 ${items.length - 1}명` : ''}`;
  }
  const topLevel = (() => { try { return window.top === window.self && /^https?:/.test(location.protocol); } catch { return false; } })();
  const shareBase = topLevel ? `${location.origin}${location.pathname}${location.search}` : (D.shareBase || '');
  const canShareLink = !!shareBase;
  // 메신저 앱 안 브라우저(카카오톡·네이버·인스타그램·페이스북·라인 등)는 내려받기·복사·보내기가 막힐 때가 많다 — 이미지 저장 창에서 다른 브라우저로 열도록 알린다
  const inAppBrowser = /KAKAOTALK|KAKAOSTORY|NAVER\(inapp|Instagram|Barcelona|FBAN|FBAV|\bLine\/|BAND\/|DaumApps|everytimeApp|MicroMessenger|Twitter/i.test(navigator.userAgent || '');
  let downloads = null;
  try { if (window.claude && typeof window.claude.use === 'function') window.claude.use('downloads').then((x) => { downloads = x; }, () => {}); } catch { /* 일반 브라우저 */ }
  function renderPkg(anchor = '', shared = null) {
    const items = shared || myItems();
    const n = items.length;
    view.dataset.shared = shared ? shareCode(shared) : ''; // 빈 패키지 화면에서도 앞서 본 받은 패키지 표시를 지운다(문의 글이 그 조합으로 바뀌지 않게)
    if (!n) {
      view.innerHTML = `<section class="pk-head pad"><div><h1>패키지<sup class="num">0</sup></h1><p>마음에 드는 모델을 담으면 여기에서 한 장짜리 컴프 카드로 정리하고, 나란히 비교하고, 문의 글로 보낼 수 있어요.</p></div></section>
        <section class="empty pad"><h2>아직 담은 모델이 없어요</h2><p>모델 화면에서 사진 위 「+ 패키지」를 누르거나, 영상으로 보기에서 「패키지에 담기」를 눌러 보세요.</p><div class="pk-acts"><a class="btn ink" href="#swipe">넘기며 고르기</a><a class="btn line" href="#board">모델 보드</a></div></section>
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
    if (anchor === 'inq') requestAnimationFrame(() => $('#inq')?.scrollIntoView({ block: 'start' }));
  }
  function inqHTML(items) {
    return `<section class="inq pad" id="inq" aria-labelledby="inq-title">
      <div><h2 id="inq-title">문의 글</h2>
        <p>${items.length ? '담은 모델과 고른 헤어, 보드에 적은 광고 내용이 들어가요. 이 글을 문의 양식이나 메일로 보내 주시면 제작을 시작할 때 같은 조합으로 준비해 드려요.' :'아직 담은 모델이 없어요. 새 모델이 필요하거나 상담부터 받고 싶다면 이 글로 시작해 주세요.'}</p>
        ${leadHTML(items)}
      </div>
      <div><label class="sec-h" for="inq-text">보낼 글</label><textarea id="inq-text" readonly rows="10"></textarea>
        <div class="row"><a class="btn ink" id="inq-form" href="${E(CONTACT.form)}" target="_blank" rel="noopener" data-act="send-inq" data-v="form">문의 양식으로 보내기 <span aria-hidden="true">↗</span></a><a class="btn line" id="inq-mail" href="mailto:${CONTACT.email}" data-act="send-inq" data-v="mail">메일로 보내기</a><button type="button" class="btn line" data-act="copy-inq">글 복사하기</button></div>
        <p class="mt-help" id="inq-where"></p></div>
    </section>`;
  }
  function wireInq(items) {
    const ta = $('#inq-text'); if (!ta) return;
    const text = items.length ? inquiryOf(items) : newModelText();
    ta.value = text;
    const form = formUrl(text), mail = mailUrl(items.length ? subjectOf(items) : '[PULSE] 새 모델 문의', text);
    const fa = $('#inq-form'), ma = $('#inq-mail');
    fa.href = form; fa.dataset.full = form.includes(`&${CONTACT.text}=`) ? '1' : '';
    ma.href = mail; ma.dataset.full = mail.includes('&body=') ? '1' : '';
    $('#inq-where').textContent = fa.dataset.full
      ? `문의 양식은 이 글이 채워진 채로 새 창에 열려요. 답장 받을 이메일을 적고 개인정보 동의에 표시한 뒤 보내 주세요. 메일은 ${CONTACT.email}으로 가요.`
      : `글이 길어 양식에 다 담지 못해요. 누르면 글을 복사해 둘 테니 양식의 「문의 내용」 칸에 붙여 넣고, 이메일과 개인정보 동의를 채워 보내 주세요. 메일은 ${CONTACT.email}으로 가요.`;
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
    const pick = [['헤어', `${x.hair + 1} · ${m.hair[x.hair].label}`], ['어울리는 업종', m.fits.slice(0, 3).join(' · ')], m.direction && ['연출', m.direction.fit.slice(0, 2).join(' · ')], x.memo && ['메모', x.memo]].filter(Boolean);
    for (const [k, v] of pick) { text(ctx, k, X, y, 20, 450, '#77776F'); y += 6; y += 34 * wrap(ctx, v, X + 150, y - 6, 24, TW - 150, 34, 550, '#0F0F0F', 2) + 10; }
    // 바닥: 브랜드·표시
    ctx.fillStyle = '#A3265F'; ctx.fillRect(X, H - P - 74, 36, 4);
    wrap(ctx, m.realPerson ? '실제 인물을 바탕으로, 본인 동의를 받아 만든 모델이에요.' : 'AI로 만든 가상인물이에요. 광고에는 가상인물 표시가 필요해요.', X, H - P - 36, 18, TW, 26, 450, '#77776F', 2);
    return c;
  }
  async function drawSheet(items) {
    const n = items.length, colW = 520, gap = 24, P = 56, W = P * 2 + n * colW + (n - 1) * gap;
    const rowsMax = 3; // 키 · 헤어 · 어울림(11-03 목소리 줄은 뺐다)
    const H =P + 64 + colW * 4 / 3 + 76 + 40 + 26 + rowsMax * 44 + 40 + 60 + P;
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
      const rows = [['키', m.height ? m.height + 'cm' : '—'], ['헤어', `${x.hair + 1} · ${m.hair[x.hair].label}`], ['어울림', m.fits.slice(0, 2).join(' · ')]];
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
    // 메신저 앱 안에서는 다른 브라우저로 옮겨 가야 하는데, 패키지는 이 브라우저에만 저장돼 있다 — 조합이 담긴 공유 링크를 같이 준다(10-23)
    const moveItems = inAppBrowser ? (view.dataset.shared ? readShare(view.dataset.shared) : myItems()) : [];
    const moveLink = inAppBrowser && shareBase && moveItems.length ? `${shareBase}#p-${shareCode(moveItems)}` : '';
    d.innerHTML = `<div class="ex-top"><p>${inAppBrowser ? (moveLink ? '메신저 앱 안에서는 저장이 막힐 수 있어요. 「링크 복사」로 이 패키지 링크를 복사해 Safari·Chrome 같은 다른 브라우저 주소창에 붙여 넣으면 그대로 열려요.' : '메신저 앱 안에서는 저장이 막힐 수 있어요. 메뉴나 공유 단추에서 Safari·Chrome 같은 다른 브라우저로 열어 저장해 주세요.') : downloads || topLevel ? '저장 단추가 안 되면 이미지를 길게 누르거나 오른쪽 클릭으로 저장해 주세요.' : '이미지를 길게 누르거나 오른쪽 클릭해서 저장해 주세요. 「이미지 복사」 뒤 메신저에 바로 붙여 넣어도 돼요.'}</p><span class="pk-acts">${moveLink ? '<button type="button" class="btn line sm" data-act="ex-link">링크 복사</button>' : ''}${canCopy ? '<button type="button" class="btn line sm" data-act="ex-copy">이미지 복사</button>' : ''}${canShare ? '<button type="button" class="btn line sm" data-act="ex-share">보내기</button>' : ''}${downloads ? '<button type="button" class="btn ink sm" data-act="ex-save">이미지 저장</button>' : topLevel ? `<a class="btn ink sm" href="${url}" download="${E(file)}">이미지 저장</a>` : ''}<button type="button" class="btn line sm" data-act="ex-close">닫기</button></span></div><img src="${url}" alt="${E(name)}">`;
    d.dataset.file = file; d.dataset.url = url; d.dataset.link = moveLink; exportCanvas.blob = blob;
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
          <div class="meta"><b>${E(cur.m.name)}</b><span>${K(dot(cur.m.height && cur.m.height + 'cm', cur.m.age || cur.m.ageBand, cur.m.concept, cur.m.realPerson && '실제 인물'))}</span>${cur.r ? `<span class="why">${K(whyOf(cur.r))}</span>` : `<span>${K(cur.m.tagline ? `“${cur.m.tagline}”` : cur.m.impression.join(' · '))}</span>`}</div>
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

  /* ── 영상으로 보기: 모델 벽(11-05, 팁 장부 45행) ─────────────── */
  // 모델마다 세로 칸 하나. 칸 너비만 바뀌고 그림은 그대로라 끌면 다음 사람이 커튼처럼 열린다.
  // 가운데 칸은 그 사람만의 움직임 → 광고 장면으로 돌고, 넓은 화면에서는 바로 옆 두 칸도 움직인다.
  //   #row   벽   ·   #row-F08   그 사람부터(옛 주소 그대로)
  let wall = null, wallLast = '';
  const wallDestroy = () => { if (wall) { wall.destroy(); wall = null; } document.documentElement.classList.remove('wall-on'); };
  function wallReel(m) {
    const reel = [];
    if (m.wall.src) reel.push({ kind: 'video', label: '움직임', src: m.wall.src, hold: 500 });
    else reel.push({ kind: 'image', label: '장면', src: m.wall.poster, dur: 2600 });
    const scene = (m.scenes || []).find((x) => !x.concept && x.l !== m.wall.poster && !/근접|위에서|침실|욕실/.test(`${x.label} ${x.place}`));
    const still = scene ? scene.l : [m.shots.context, m.shots['look-2'], m.shots['look-1'], m.hero].filter(Boolean).map((x) => x.l).find((x) => x !== m.wall.poster);
    if (still) reel.push({ kind: 'image', label: '광고 장면', src: still, dur: 3200 });
    return reel;
  }
  function wallEmpty() {
    view.innerHTML = '<div class="empty pad"><h2>조건에 맞는 모델이 없어요</h2><p>조건을 바꾸거나 지워 보세요.</p><button type="button" class="btn line" data-act="wall-clear">조건 지우기</button></div>';
  }
  function wallMount(code) {
    wallDestroy();
    if (code && !L.filterModels(D.models, filters).some((m) => m.code === code)) for (const k of Object.keys(filters)) filters[k] = ''; // 공유받은 주소의 모델이 거른 조건에 빠져 있을 때
    const { order, recs } = ranked();
    const q = state.ask.trim(), any = Object.values(filters).some(Boolean);
    const curated = (D.wallOrder || []).map(byCode).filter(Boolean);
    const M = (recs.length || any || curated.length !== D.models.length) ? order : curated; // 조건이 없으면 옆 칸과 색 · 장소가 겹치지 않게 손으로 세운 차례
    if (!M.length) { wallEmpty(); return; }
    const N = M.length, root = document.documentElement, ac = new AbortController(), on = { signal: ac.signal };
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const still = calm || !!(navigator.connection && navigator.connection.saveData); // 움직임 줄이기 · 데이터 절약에서는 영상을 저절로 틀지 않는다
    root.classList.add('wall-on');
    const reels = M.map(wallReel);
    const note = q || any ? `<p class="wall-note"><span>${q ? (recs.length ? `「${E(q)}」에 맞는 순서예요` : `「${E(q)}」에 맞는 모델을 찾지 못해 기본 순서예요`) : '조건에 맞는 모델만 세웠어요'}</span><button type="button" data-act="wall-clear">조건 지우기</button></p>` : '';
    view.innerHTML = `<div class="wall" id="wall" tabindex="0" role="group" aria-label="모델 ${N}명, 옆으로 끌어 넘겨 보세요. 화살표 키로도 넘어가요.">${M.map((m, i) => `<div class="wp" data-i="${i}"><div class="wp-in"><img class="wp-still" alt="" draggable="false" decoding="async"><span class="wp-dim"></span></div><span class="wp-lab">${E(m.name)}</span></div>`).join('')}</div>
      ${note}
      <div class="wall-hud" id="wall-hud">
        <div class="wall-who" id="wall-who"><div class="k num" id="wall-k"></div><h1 id="wall-nm"></h1><div class="m" id="wall-m"></div></div>
        <div class="wall-acts"><a class="wall-book" id="wall-book" href="#m-${E(M[0].code)}">모델 북</a>${pkgBtn(M[0], 'wall-add', '패키지에 담김', '패키지에 담기')}</div>
        <p class="wall-legal" id="wall-legal"></p>
      </div>
      <div class="wall-arrows"><button type="button" id="wall-prev" data-act="wall-step" data-d="-1" aria-label="이전 모델">←</button><button type="button" id="wall-next" data-act="wall-step" data-d="1" aria-label="다음 모델">→</button></div>
      <p class="vh" id="wall-live" aria-live="polite"></p>`;
    const el = $('#wall'), hud = $('#wall-hud'), who = $('#wall-who');
    const P = $$('.wp', el).map((box) => ({ box, inner: box.firstElementChild, still: $('.wp-still', box), dim: $('.wp-dim', box) }));
    let vw = 0, vh = 0, W = 0, phone = false, low = false, table = [], step = 180, last = NaN;
    const startAt = M.findIndex((m) => m.code === (code || wallLast));
    let f = startAt >= 0 ? startAt : Math.max(0, M.findIndex((m) => m.code === D.wallFirst)), target = f, vel = 0;
    const wAt = (d0) => { const d = Math.abs(d0), i = Math.min(Math.floor(d), table.length - 1), j2 = Math.min(i + 1, table.length - 1), t = Math.min(d - i, 1); return table[i] + (table[j2] - table[i]) * t; };
    function layout(x) {
      if (x === last) return;
      last = x;
      const ws = P.map((_, i) => wAt(i - x));
      let fixed = 0, free = 0;
      for (let i = 0; i < N; i++) { const nk = Math.max(0, 1 - Math.abs(i - x)); fixed += ws[i] * nk; free += ws[i] * (1 - nk); }
      const alone = free < .5; // 조건에 맞는 사람이 한 명이면 가운데에 세운다
      const fill = alone ? 1 : (vw - fixed) / free; // 가운데 몫은 그대로 두고 나머지를 풀어 화면을 정확히 채운다(넘기는 중에도 빈틈이 없게)
      let left = alone ? (vw - fixed) / 2 : 0;
      for (let i = 0; i < N; i++) {
        const d = Math.abs(i - x), nk = Math.max(0, 1 - d), w = ws[i] * (nk + (1 - nk) * fill);
        const p = P[i], px = Math.round(left), pw = Math.round(left + w) - px;
        if (p.px !== px) { p.px = px; p.box.style.transform = `translate3d(${px}px,0,0)`; }
        if (p.pw !== pw) { p.pw = pw; p.box.style.width = pw + 'px'; p.box.style.visibility = pw ? '' : 'hidden'; }
        const iw = Math.max(W, pw);
        if (p.iw !== iw) { p.iw = iw; p.inner.style.width = iw + 'px'; p.inner.style.marginLeft = -iw / 2 + 'px'; }
        const dim = Math.min(.2, d * .07);
        if (p.dv !== dim) { p.dv = dim; p.box.style.setProperty('--d', dim.toFixed(3)); }
        const lab = !phone && pw > 54 && d > .6 ? 1 : 0;
        if (p.lv !== lab) { p.lv = lab; p.box.style.setProperty('--l', lab); }
        if (d < 6 && !p.loaded) { p.loaded = true; p.still.src = M[i].wall.poster; } // 멀리 있는 사람 그림은 다가올 때 받는다
        left += w;
      }
    }
    function measure() {
      vw = window.innerWidth; vh = window.innerHeight; phone = vw <= 760; low = !phone && vh <= 520;
      W = phone ? vw - 44 : Math.min(vh * (low ? .95 : 9 / 16), vw * .44);
      el.style.setProperty('--w0', W + 'px');
      table = phone ? [W, 22, 0] : [W, W * .46, W * .28, W * .14, 0];
      step = phone ? Math.max(120, vw * .34) : Math.max(150, W * .36);
      last = NaN; layout(f);
    }
    // 끌기 · 놓으면 가까운 칸으로
    let dragging = false, sx = 0, sf = 0, moved = false, lx = 0, lt = 0, pid = null;
    el.addEventListener('pointerdown', (e) => { if (e.button || dragging) return; dragging = true; moved = false; sx = lx = e.clientX; sf = target; lt = performance.now(); vel = 0; pid = e.pointerId; el.setPointerCapture(pid); }, on);
    el.addEventListener('pointermove', (e) => {
      if (!dragging || e.pointerId !== pid) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 5) { moved = true; el.classList.add('drag'); }
      if (!moved) return;
      target = Math.max(-.4, Math.min(N - .6, sf - dx / step));
      const now = performance.now(), dt = now - lt;
      if (dt > 0) { vel = vel * .6 + (-(e.clientX - lx) / step / (dt / 1000)) * .4; lx = e.clientX; lt = now; }
    }, on);
    const up = (e) => {
      if (!dragging || e.pointerId !== pid) return;
      dragging = false; el.classList.remove('drag');
      if (e.type === 'pointercancel') { target = Math.max(0, Math.min(N - 1, Math.round(target))); return; }
      if (!moved) { // 옆 칸을 누르면 그 사람으로, 가운데를 누르면 모델 북으로
        const i = P.findIndex((p) => p.pw && p.px <= e.clientX && e.clientX < p.px + p.pw);
        if (i < 0) return;
        if (i !== Math.round(f)) target = i;
        else if (Math.abs(f - target) < .02) { inUrl = M[i].code; location.hash = `#m-${M[i].code}`; } // 넘어가는 중의 누름으로 모델 북이 열리지 않게
        return;
      }
      const held = performance.now() - lt > 90; // 멈췄다 놓으면 관성 없이 가까운 칸으로
      target = Math.max(0, Math.min(N - 1, Math.round(target + (held ? 0 : Math.max(-3, Math.min(3, vel * .18))))));
    };
    el.addEventListener('pointerup', up, on); el.addEventListener('pointercancel', up, on);
    el.addEventListener('lostpointercapture', (e) => { if (dragging) up({ type: 'pointercancel', pointerId: e.pointerId }); }, on);
    let wheelAt = 0;
    el.addEventListener('wheel', (e) => { e.preventDefault(); const now = performance.now(); if (now - wheelAt < 280) return; const v = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; if (Math.abs(v) < 6) return; wheelAt = now; target = Math.max(0, Math.min(N - 1, Math.round(target) + Math.sign(v))); }, { passive: false, signal: ac.signal });
    window.addEventListener('keydown', (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || $('dialog[open]') || /^(INPUT|SELECT|TEXTAREA)$/.test((e.target && e.target.tagName) || '')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); target = Math.min(N - 1, Math.round(target) + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); target = Math.max(0, Math.round(target) - 1); }
    }, on);
    window.addEventListener('resize', measure, on);
    // 가운데 칸의 짧은 릴
    const mkVideo = (loop) => { const v = document.createElement('video'); v.muted = true; v.defaultMuted = true; v.playsInline = true; v.loop = loop; v.preload = 'auto'; v.setAttribute('aria-hidden', 'true'); return v; };
    const vids = [mkVideo(false), mkVideo(false)], sides = [mkVideo(true), mkVideo(true)];
    let seq = 0, front = 0, playing = -1, focused = -1, settledAt = 0, raf = 0, inUrl = '';
    function placeHud(i) {
      const p = P[i], d = Math.abs(i - f), w = Math.max(W * .8, p.pw);
      if (hud.pw !== w) { hud.pw = w; hud.style.width = w + 'px'; }
      hud.style.transform = `translate3d(${(p.px + (p.pw - w) / 2).toFixed(1)}px,0,0)`;
      const o = Math.max(0, 1 - d * 5);
      if (hud.oo !== o) { hud.oo = o; hud.style.opacity = o.toFixed(3); hud.classList.toggle('moving', o < .5); }
    }
    function run(i, k) {
      const my = ++seq, reel = reels[i], p = P[i], r = reel[k];
      const next = () => { if (my === seq) run(i, (k + 1) % reel.length); };
      if (r.kind === 'video') {
        const v = vids[front], o = vids[1 - front];
        front = 1 - front;
        v.src = r.src; v.currentTime = 0;
        p.inner.insertBefore(v, p.dim); p.inner.insertBefore(o, v);
        const show = () => { if (my !== seq) return; v.classList.add('on'); o.classList.remove('on'); p.still.classList.remove('kb'); };
        if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(show); else v.addEventListener('playing', show, { once: true });
        v.onended = () => { if (my === seq) setTimeout(next, r.hold || 350); };
        v.onerror = () => { if (my === seq) setTimeout(next, 300); };
        const played = v.play();
        if (played && played.catch) played.catch(() => { if (my !== seq) return; p.still.src = M[i].wall.poster; p.still.classList.remove('kb'); setTimeout(next, 1500); }); // 저전력 모드 등 자동 재생이 막히면 첫 장면을 세우고 사진으로 넘어간다
      } else {
        p.still.src = r.src;
        p.still.classList.remove('kb'); void p.still.offsetWidth; p.still.classList.add('kb');
        vids.forEach((x) => x.classList.remove('on'));
        setTimeout(next, r.dur);
      }
      const after = reel[k + 1];
      if (after && after.kind === 'image') { const im = new Image(); im.src = after.src; }
    }
    function sidesOn(i) {
      if (phone || low || still) return;
      [i - 1, i + 1].forEach((n, k) => {
        const v = sides[k], m = M[n];
        if (!m || !m.wall.src) return;
        v.src = m.wall.src; v.currentTime = 0;
        P[n].inner.insertBefore(v, P[n].dim);
        const show = () => v.classList.add('on');
        if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(show); else v.addEventListener('playing', show, { once: true });
        const played = v.play();
        if (played && played.catch) played.catch(() => {});
      });
    }
    const sidesOff = () => sides.forEach((v) => { v.pause(); v.classList.remove('on'); });
    function stop(i) { sidesOff(); seq++; vids.forEach((v) => { v.pause(); v.classList.remove('on'); }); if (i >= 0) { P[i].still.classList.remove('kb'); P[i].still.src = M[i].wall.poster; } }
    function text(i, at0) {
      const m = M[i], r = recs.find((x) => x.model.code === m.code);
      $('#wall-book').href = `#m-${m.code}`;
      $('.wall-add', hud).dataset.code = m.code;
      syncPkg();
      $('#wall-prev').setAttribute('aria-disabled', i <= 0);
      $('#wall-next').setAttribute('aria-disabled', i >= N - 1);
      $('#wall-legal').textContent = m.realPerson ? '실제 인물을 바탕으로 만든 모델이에요.' : 'AI로 만든 가상인물이에요.';
      el.dataset.at = m.code;
      wallLast = m.code;
      $('#wall-live').textContent = `${i + 1}번째 ${m.name}, ${m.height ? `키 ${m.height}센티미터` : '키 정보 없음'}`;
      const paint = () => {
        $('#wall-k').textContent = `${m.code}  ${pad2(i + 1)} / ${pad2(N)}`;
        $('#wall-nm').textContent = m.name;
        const first = dot(m.height && m.height + 'cm', m.age || m.ageBand, m.wall.line || m.concept);
        const second = r ? whyOf(r) : (m.fits || []).slice(0, 3).map((x) => x.split('(')[0].trim()).join(', ');
        $('#wall-m').innerHTML = `<div>${K(first)}</div>${second ? `<div>${K(second)}</div>` : ''}`;
        who.classList.remove('swap');
      };
      clearTimeout(text.t);
      if (calm || at0) { paint(); return; } // 처음 열릴 때와 움직임 줄이기에서는 전환 없이 바로
      who.classList.add('swap');
      text.t = setTimeout(paint, 170);
    }
    function loop(now) {
      const k = calm ? 1 : dragging ? .3 : .085;
      f += (target - f) * k;
      if (Math.abs(target - f) < .002) f = target;
      layout(f);
      const nearest = Math.max(0, Math.min(N - 1, Math.round(f)));
      if (nearest !== focused) { focused = nearest; text(nearest); }
      placeHud(nearest);
      if (playing !== nearest && playing >= 0) { stop(playing); playing = -1; }
      if (!dragging && f === target && inUrl !== M[nearest].code) { inUrl = M[nearest].code; try { history.replaceState(null, '', `#row-${inUrl}`); } catch { /* 무시 */ } }
      if (!dragging && f === target && playing < 0 && !still && !document.hidden) {
        if (!settledAt) settledAt = now;
        if (now - settledAt > 120) { playing = nearest; run(nearest, 0); sidesOn(nearest); }
      } else settledAt = 0;
      raf = requestAnimationFrame(loop);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden && playing >= 0) { stop(playing); playing = -1; } }, on); // 다른 탭에 있는 동안 영상을 받지 않는다
    measure();
    focused = Math.round(f); text(focused, true); placeHud(focused);
    raf = requestAnimationFrame(loop);
    wall = {
      go: (c) => { if (!c) return; const i = M.findIndex((m) => m.code === c); if (i >= 0) target = i; else wallMount(c); },
      step: (d) => { target = Math.max(0, Math.min(N - 1, Math.round(target) + d)); },
      destroy: () => { ac.abort(); cancelAnimationFrame(raf); clearTimeout(text.t); seq++; [...vids, ...sides].forEach((v) => { v.pause(); v.onended = v.onerror = null; v.removeAttribute('src'); v.load(); }); },
    };
  }

  /* ── 경로 ─────────────────────────────────────────────── */
  let route = 'board', curModel = '', boardY = 0;
  const jump = (y) => { try { window.scrollTo({ top: y, left: 0, behavior: 'instant' }); } catch { window.scrollTo(0, y); } };
  const go = (h) => { if (location.hash !== h) location.hash = h; else render(); };
  function render() {
    const h = decodeURIComponent(location.hash || '').replace(/^#g-OPALINE$/, '#g-OFALIN'); // 11-05 팀 이름을 OFALIN으로 바꾸기 전 공유한 주소
    const prev = route;
    if (prev === 'board' || prev === 'lineup') boardY = window.scrollY;
    if ($('#lightbox').open) $('#lightbox').close();
    if ($('#export').open) $('#export').close();
    const old = h.match(/^#([A-Z]\d\d)$/);
    const parts = (old ? ['m', old[1]] : h.replace(/^#\/?/, '').split(/[-/]/)).filter(Boolean);
    route = parts[0] || 'board'; curModel = '';
    if (route !== 'row') wallDestroy();
    let nav = 'board';
    if (route === 'm' && byCode(parts[1])) { curModel = parts[1]; renderBook(parts[1], parts[2]); nav = ''; jump(0); }
    else if (route === 'g' && groupById(parts[1])) { renderGroup(parts[1]); nav = 'board'; jump(0); }
    else if (route === 'pkg') { renderPkg(parts[1]); nav = 'pkg'; if (parts[1] !== 'inq') jump(0); }
    else if (route === 'p') { renderPkg(parts[2], readShare(parts[1])); nav = 'pkg'; jump(0); }
    else if (route === 'swipe') { renderSwipe(); nav = 'board'; jump(0); }
    else if (route === 'row') {
      const code = byCode(parts[1]) ? parts[1] : '';
      if (prev === 'row' && wall) { wall.go(code); } else { wallMount(code); jump(0); }
      nav = 'row';
    }
    else if (route === 'lineup') { renderBoard('lineup'); nav = 'lineup'; jump(prev === 'm' ? boardY : 0); }
    else if (route === 'guide') { renderBoard('board', 'guide'); nav = 'guide'; }
    else { route = 'board'; renderBoard('board'); jump(prev === 'm' || prev === 'g' || prev === 'row' ? boardY : 0); }
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
      case 'wall-step': if (wall) wall.step(Number(t.dataset.d)); break;
      case 'wall-clear': for (const k of Object.keys(filters)) filters[k] = ''; state.ask = ''; save(); wallMount(); break;
      case 'team-row': for (const k of Object.keys(filters)) filters[k] = ''; filters.group = t.dataset.g; break; // 링크(#row)는 그대로 연다
      case 'ask-clear': state.ask = ''; save(); $('#q').value = ''; drawBoard(route === 'lineup' ? 'lineup' : 'board'); $('#q').focus(); break;
      case 'filters-clear': for (const k of Object.keys(filters)) filters[k] = ''; for (const s of $$('.filters select')) s.value = ''; drawBoard(route === 'lineup' ? 'lineup' : 'board'); break;
      case 'new-model': t.href = formUrl(newModelText()); break; // 보드에 적은 광고 내용이 그 사이 바뀌었을 수 있어 누를 때 다시 채운다(새 창 열기는 링크 그대로)
      case 'ask-this': if (!inPkg(code)) state.pkg.push(code); state.lead = code; save(); break;
      case 'team-pkg': { const g = groupById(t.dataset.g); if (!g) break; const n = addTeam(g); pkgMode = 'compare'; toast(n ? `${g.name} ${n}명을 패키지에 담았어요` : `${g.nameKo}${L.josa(g.nameKo, '은', '는')} 이미 패키지에 있어요`); const a = $('#g-acts'); if (a) a.innerHTML = teamActsHTML(g); break; }
      case 'team-compare': { const g = groupById(t.dataset.g); if (g) addTeam(g); pkgMode = 'compare'; break; } // 링크(#pkg)는 그대로 연다
      case 'team-ask': { const g = groupById(t.dataset.g); if (g) addTeam(g); state.lead = ''; save(); break; } // 진행할 모델은 문의 글에서 고르거나 상담에서 정한다
      case 'g-cut': stepCut(Number(t.dataset.d)); break;
      case 'glb': { const g = groupById(curGroup); const list = gLists[t.dataset.list] || []; if (list.length) openLb(list, Number(t.dataset.i) || 0, g ? g.name : ''); break; }
      case 'tab': drawTab(byCode(curCode), v); try { history.replaceState(null, '', `#m-${curCode}-${v}`); } catch { /* 무시 */ } break;
      case 'strip': stepStrip(Number(t.dataset.d)); break;
      case 'strip-grid': { const s = $('#strip'); const on = s.classList.toggle('grid'); t.textContent = on ? '옆으로 넘겨 보기' : '한눈에 보기'; $$('.strip-nav .sq, #strip-count').forEach((x) => { x.hidden = on; }); break; }
      case 'lb': { const m = byCode(curCode); openLb(bookList, Number(t.dataset.i), m ? m.name : ''); break; }
      case 'lb-step': lbIndex = (lbIndex + Number(t.dataset.d) + lbList.length) % lbList.length; drawLb(); break;
      case 'lb-close': $('#lightbox').close(); break;
      case 'scene-tag': for (const b of $$('[data-act="scene-tag"]')) b.setAttribute('aria-pressed', b === t); for (const f of $$('.scene')) f.hidden = !!v && !f.dataset.tags.split(' ').includes(v); break;
      case 'hair': setSel(curCode, { hair: Number(t.dataset.i) }); for (const b of $$('[data-act="hair"]')) b.setAttribute('aria-pressed', b === t); break;
      case 'pk-mode': if (t.disabled) break; pkgMode = v; { const items = view.dataset.shared ? readShare(view.dataset.shared) : myItems(); $('#pk-body').innerHTML = pkgMode === 'compare' ? compareHTML(items) : `<div class="cards pad">${items.map((x) => cardHTML(x, !!view.dataset.shared)).join('')}</div>`; watchLineups($('#pk-body')); for (const b of $$('[data-act="pk-mode"]')) b.setAttribute('aria-pressed', b === t); } break;
      case 'cmp-shot': cmpShot = v; { const items = view.dataset.shared ? readShare(view.dataset.shared) : myItems(); $('#pk-body').innerHTML = compareHTML(items); watchLineups($('#pk-body')); } break;
      case 'pkg-rm': state.pkg = state.pkg.filter((x) => x !== code); save(); syncPkg(); renderPkg(); break;
      case 'take-share': { const items = readShare(view.dataset.shared); for (const x of items) { if (!inPkg(x.code)) state.pkg.push(x.code); setSel(x.code, { hair: x.hair }); } save(); toast(`${items.length}명을 내 패키지에 담았어요`); go('#pkg'); break; }
      case 'share-link': copy(`${shareBase}#p-${shareCode(myItems())}`, '공유 링크를 복사했어요. 받은 사람도 같은 조합으로 볼 수 있어요.'); break;
      case 'to-inq': e.preventDefault(); $('#inq')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); break;
      // 양식 · 메일은 링크 그대로 열고, 글이 주소에 다 담기지 않았거나 메일 앱이 없을 때를 위해 글을 복사해 둔다
      case 'send-inq':
        if (v === 'mail') copy($('#inq-text').value, t.dataset.full ? `메일 앱을 여는 중이에요. 열리지 않으면 복사해 둔 글을 ${CONTACT.email}으로 보내 주세요.` : '메일 앱을 여는 중이에요. 본문에 복사해 둔 글을 붙여 넣어 보내 주세요.');
        else if (!t.dataset.full) copy($('#inq-text').value, '글을 복사해 뒀어요. 양식의 「문의 내용」 칸에 붙여 넣어 주세요.');
        break;
      case 'copy-inq': copy($('#inq-text').value, `글을 복사했어요. 문의 양식이나 ${CONTACT.email}으로 보내 주세요.`); break;
      case 'lead': { state.lead = code; save(); const items = view.dataset.shared ? readShare(view.dataset.shared) : myItems(), lead = leadOf(items) || 'none'; for (const b of $$('[data-act="lead"]')) b.setAttribute('aria-pressed', b.dataset.code === lead); wireInq(items); break; }
      case 'save-card': { const items = view.dataset.shared ? readShare(view.dataset.shared) : myItems(); const x = items.find((y) => y.code === code); const m = byCode(code); exportCanvas(() => drawCard(x), `PULSE_${m.code}_${m.name}_컴프카드`); break; }
      case 'save-sheet': { const items = view.dataset.shared ? readShare(view.dataset.shared) : myItems(); exportCanvas(() => drawSheet(items), `PULSE_모델패키지_${items.length}명`); break; }
      case 'ex-close': $('#export').close(); break;
      case 'ex-link': copy($('#export').dataset.link, '패키지 링크를 복사했어요. 다른 브라우저 주소창에 붙여 넣어 주세요.'); break;
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
