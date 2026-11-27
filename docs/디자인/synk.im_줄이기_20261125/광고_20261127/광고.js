(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ko = document.documentElement.lang !== 'en';
  const navEl = $('.nav'), menuBtn = $('.menu-btn');
  menuBtn.addEventListener('click', () => menuBtn.setAttribute('aria-expanded', String(navEl.classList.toggle('open'))));
  $$('.nav ul a').forEach(a => a.setAttribute('aria-current', String(a.dataset.g === 'ad')));
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('still');

  // 이름이 나오는 때는 공개본 영상에서 쟀다(도담 58.0초 — 11-27, 다리는 최종본 라x에서 1970 현수막 8초 · 젊은 할머니 29초 · 제목 173.2초 — 11-27 밤)
  const F = ko ? {
    dodam: { src: '/assets/v10/pulse-film-dodam-20261109c.mp4', poster: '/assets/v10/pulse-film-dodam-20261109c.webp', wide: false,
      note: '도담중공업 「이 아이를 보냅니다」 · 1분 1초 · 지어낸 회사로 만든 자체 기업 홍보영상',
      s: [['이름의 뜻', '도담도담, 아이가 탈 없이 자라는 모양', 2.2, 0], ['그 뜻으로 지은 이야기', '가스터빈 한 대를 아이처럼 키워 떠나보냅니다', 24.8, 0], ['마지막에 처음 나오는 이름', '도담중공업', 58.0, 1]] },
    bridge: { src: '/assets/v10/pulse-film-seoullo-20261119.mp4', poster: '/assets/v10/pulse-film-seoullo-20261117.webp', wide: true,
      note: '「다리가 기억하는 것」 · 2분 58초 · 2026 서울로미디어캔버스 단편 애니메이션 공모 당선작 · 2026년 12월부터 2027년 2월까지 서울로미디어캔버스 전시',
      s: [['이름의 뜻', '서울로7017, 1970년의 찻길이 2017년에 걷는 길로', 8, 0], ['그 뜻으로 지은 이야기', '할머니가 손주와 걸으며 다리의 옛이야기를 들려줍니다', 29, 0], ['이야기 끝에 남는 이름', '다리가 기억하는 것', 173.3, 1]] },
  } : {
    dodam: { src: '/assets/v10/pulse-film-dodam-20261109c.mp4', poster: '/assets/v10/pulse-film-dodam-20261109c.webp', wide: false,
      note: 'Dodam Heavy Industries “We Send This One Off” · 1:01 · our own corporate film for an invented company',
      s: [['What the name means', 'Dodam-dodam: a child growing up safe and sound', 2.2, 0], ['The story built on it', 'A gas turbine raised like a child, then sent off', 24.8, 0], ['The name, shown only at the end', 'Dodam Heavy Industries', 58.0, 1]] },
    bridge: { src: '/assets/v10/pulse-film-seoullo-20261119.mp4', poster: '/assets/v10/pulse-film-seoullo-20261117.webp', wide: true,
      note: '“What the Bridge Remembers” · 2:58 · selected in the 2026 Seoullo Media Canvas short animation open call · on show Dec 2026 to Feb 2027',
      s: [['What the name means', 'Seoullo 7017: a 1970 road for cars that became a walkway in 2017', 8, 0], ['The story built on it', 'A grandmother walks it with her grandchild and tells its old story', 29, 0], ['The name left at the end', 'What the Bridge Remembers', 173.3, 1]] },
  };

  // 고르는 줄(11-27 유호님 「굿 훨씬 낫다」): 회색 홈 안에 고른 칸만 말랑한 흰 알약이 떠 있다. 옮길 때 앞쪽 끝이 먼저 닿고 뒤쪽 끝이 따라오며
  // 살짝 눌렸다 돌아온다(0.48초). 움직임 줄이기면 바로 옮긴다. 줄이 넘치면 더 있는 쪽 끝을 흐리게 지운다.
  function jellyBar(bar, now) {
    const jelly = $('.jelly', bar); let at = null;
    const place = (b, move) => {
      if (!b) return;
      const to = { x: b.offsetLeft, w: b.offsetWidth };
      if (move && at && !still && jelly.animate && (at.x !== to.x || at.w !== to.w)) {
        const r = to.x > at.x, L = (a, c, t) => a + (c - a) * t;
        const l = r ? L(at.x, to.x, .22) : L(at.x, to.x, .78), rr = r ? L(at.x + at.w, to.x + to.w, .78) : L(at.x + at.w, to.x + to.w, .22);
        jelly.animate([{ transform: `translateX(${at.x}px) scaleY(1)`, width: at.w + 'px' }, { transform: `translateX(${l}px) scaleY(.88)`, width: (rr - l) + 'px', offset: .45 },
          { transform: `translateX(${to.x}px) scaleY(1.05)`, width: to.w + 'px', offset: .78 }, { transform: `translateX(${to.x}px) scaleY(1)`, width: to.w + 'px' }], { duration: 480, easing: 'cubic-bezier(.3,.7,.25,1)' });
      }
      jelly.style.transform = `translateX(${to.x}px)`; jelly.style.width = to.w + 'px'; at = to;
    };
    const edge = () => { const m = bar.scrollWidth - bar.clientWidth; bar.classList.toggle('more-l', m > 2 && bar.scrollLeft > 2); bar.classList.toggle('more-r', m > 2 && bar.scrollLeft < m - 2); };
    const fit = () => { place(now(), false); edge(); };
    bar.classList.add('on'); fit(); bar.addEventListener('scroll', edge, { passive: true });
    addEventListener('resize', fit); if (document.fonts) document.fonts.ready.then(fit);
    const btns = $$('button', bar);
    if (window.ResizeObserver && btns.length) new ResizeObserver(fit).observe(btns[btns.length - 1]);
    return { go: (b, move) => { place(b, move); b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: still ? 'auto' : 'smooth' }); } };
  }
  const pickEl = $('.y-pick');
  const pickBar = pickEl && jellyBar(pickEl, () => $('.y-pick button[aria-pressed="true"]'));

  // PULSE 앱 화면 여섯: 탭(왼쪽 · 오른쪽 · Home · End)으로 고르면 그 화면과 한 줄이 바뀐다
  const tour = $('.y-tour');
  if (tour) {
    const tabs = $$('[role=tab]', tour);
    const bar = jellyBar(tour, () => tabs.find(t => t.getAttribute('aria-selected') === 'true') || tabs[0]);
    const show = (b, focus) => {
      tabs.forEach(t => { const on = t === b; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; document.getElementById(t.getAttribute('aria-controls')).hidden = !on; });
      bar.go(b, true); if (focus) b.focus({ preventScroll: true });
    };
    tabs.forEach((b, i) => {
      b.addEventListener('click', () => show(b));
      b.addEventListener('keydown', e => {
        if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); show(tabs[e.key === 'Home' ? 0 : tabs.length - 1], true); return; }
        const k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (k) { e.preventDefault(); show(tabs[(i + k + tabs.length) % tabs.length], true); }
      });
    });
  }

  const v = $('#film'), st = $('#steps'), scr = $('#scr'), stage = $('.y-stage');
  let k = 'dodam', cur = 0;
  function draw() {
    const f = F[k];
    st.innerHTML = f.s.map((x, i) => `<li><button type="button" data-i="${i}" aria-pressed="${i === cur}"><span>${x[0]}</span><b class="${x[3] ? 'nm' : ''}">${x[1]}</b></button></li>`).join('');
    $('#note').textContent = f.note;
    $$('button', st).forEach(b => b.addEventListener('click', () => play(+b.dataset.i)));
  }
  function mark(i) { if (i === cur) return; cur = i; $$('button', st).forEach((b, n) => b.setAttribute('aria-pressed', String(n === i))); }
  function play(i) {
    cur = -1; mark(i); scr.classList.add('on'); v.controls = true;
    const go = () => { v.currentTime = F[k].s[i][2]; v.play().catch(() => {}); };
    if (v.readyState) go(); else { v.preload = 'auto'; v.addEventListener('loadedmetadata', go, { once: true }); v.load(); }
  }
  function pick(key) {
    k = key; cur = 0;
    $$('.y-pick button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.f === key)));
    if (pickBar) pickBar.go($(`.y-pick button[data-f="${key}"]`), true);
    v.pause(); v.controls = false; v.preload = 'none'; v.poster = F[key].poster; v.src = F[key].src;
    stage.classList.toggle('wide', F[key].wide); scr.classList.remove('on'); draw();
  }
  $$('.y-pick button').forEach(b => b.addEventListener('click', () => pick(b.dataset.f)));
  $('.y-big').addEventListener('click', () => play(0));
  v.addEventListener('timeupdate', () => { if (v.paused) return; const s = F[k].s; let i = 0; s.forEach((x, n) => { if (v.currentTime >= x[2] - .2) i = n; }); mark(i); });
  draw();

  // 첫 화면 카드 더미: 뒤 카드를 누르면 앞으로, 앞 카드를 누르면 그 작품의 「이름이 남는 자리」로 간다
  const stack = $('[data-stack]');
  if (stack) {
    const cards = $$('.y-card', stack);
    const order = () => cards.slice().sort((a, b) => +a.dataset.k - +b.dataset.k);
    cards.forEach((c, i) => { c.dataset.k = String(i); });
    const front = c => { const o = order().filter(x => x !== c); [c, ...o].forEach((x, i) => { x.dataset.k = String(i); x.tabIndex = 0; }); };
    cards.forEach(c => c.addEventListener('click', e => {
      if (c.dataset.k !== '0') { e.preventDefault(); front(c); return; }
      e.preventDefault(); pick(c.dataset.f);
      $('#way').scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
      setTimeout(() => play(F[k].s.length - 1), still ? 0 : 650);
    }));
  }

  // 솔리오는 눈만 움직인다(멀미, 11-20). 움직임 줄이기면 가만히 둔다
  const orb = $('.y-orb');
  if (orb && !still) {
    addEventListener('pointermove', e => {
      const r = orb.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / innerWidth * 2)), dy = Math.max(-1, Math.min(1, (e.clientY - cy) / innerHeight * 2));
      orb.style.setProperty('--ex', (dx * 9).toFixed(1) + 'px'); orb.style.setProperty('--ey', (dy * 6).toFixed(1) + 'px');
    }, { passive: true });
    const blink = () => { orb.classList.add('blink'); setTimeout(() => orb.classList.remove('blink'), 140); setTimeout(blink, 3200 + Math.random() * 2600); };
    setTimeout(blink, 2400);
  }
})();
