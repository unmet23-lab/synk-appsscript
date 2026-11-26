(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ko = document.documentElement.lang !== 'en';
  const navEl = $('.nav'), menuBtn = $('.menu-btn');
  menuBtn.addEventListener('click', () => menuBtn.setAttribute('aria-expanded', String(navEl.classList.toggle('open'))));
  $$('.nav ul a').forEach(a => a.setAttribute('aria-current', String(a.dataset.g === 'ad')));
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('still');

  // 이름이 나오는 때는 공개본 영상에서 쟀다(도담 58.0초, 시스루 201.8초, 다리 174.0초 — 2026-11-27)
  const F = ko ? {
    dodam: { src: '/assets/v10/pulse-film-dodam-20261109c.mp4', poster: '/assets/v10/pulse-film-dodam-20261109c.webp', wide: false,
      note: '도담중공업 「이 아이를 보냅니다」 · 1분 1초 · 지어낸 회사로 만든 자체 기업 홍보영상',
      s: [['이름의 뜻', '도담도담, 아이가 탈 없이 자라는 모양', 2.2, 0], ['그 뜻으로 지은 이야기', '가스터빈 한 대를 아이처럼 키워 떠나보냅니다', 24.8, 0], ['마지막에 처음 나오는 이름', '도담중공업', 58.0, 1]] },
    opalin: { src: '/assets/v10/pulse-film-opalin-20261126.mp4', poster: '/assets/v11/pulse-film-opalin.webp', wide: false,
      note: '오팔린 「시스루」 · 3분 27초 · AI 아이돌 뮤직비디오',
      s: [['이름의 뜻', '시스루, 속이 다 비치는 것', 3, 0], ['그 뜻으로 지은 이야기', 'AI 아이돌 넷이 AI라는 사실을 숨기지 않겠다고 노래합니다', 58.8, 0], ['이야기 끝에 남는 이름', '시스루', 201.8, 1]] },
    bridge: { src: '/assets/v10/pulse-film-seoullo-20261119.mp4', poster: '/assets/v10/pulse-film-seoullo-20261117.webp', wide: true,
      note: '「다리가 기억하는 것」 · 2분 58초 · 2026 서울로미디어캔버스 단편 애니메이션 공모 당선작 · 2026년 12월부터 2027년 2월까지 서울로미디어캔버스 전시',
      s: [['이름의 뜻', '서울로7017, 1970년의 찻길이 2017년에 걷는 길로', 8, 0], ['그 뜻으로 지은 이야기', '할머니가 손주와 걸으며 다리의 옛이야기를 들려줍니다', 26, 0], ['이야기 끝에 남는 이름', '다리가 기억하는 것', 174.0, 1]] },
  } : {
    dodam: { src: '/assets/v10/pulse-film-dodam-20261109c.mp4', poster: '/assets/v10/pulse-film-dodam-20261109c.webp', wide: false,
      note: 'Dodam Heavy Industries “We Send This One Off” · 1:01 · our own corporate film for an invented company',
      s: [['What the name means', 'Dodam-dodam: a child growing up safe and sound', 2.2, 0], ['The story built on it', 'A gas turbine raised like a child, then sent off', 24.8, 0], ['The name, shown only at the end', 'Dodam Heavy Industries', 58.0, 1]] },
    opalin: { src: '/assets/v10/pulse-film-opalin-20261126.mp4', poster: '/assets/v11/pulse-film-opalin.webp', wide: false,
      note: 'OPALIN “See-Through” · 3:27 · AI idol music video',
      s: [['What the name means', 'See-through: nothing hidden', 3, 0], ['The story built on it', 'Four AI idols sing a promise not to hide that they are AI', 58.8, 0], ['The name left at the end', 'See-Through', 201.8, 1]] },
    bridge: { src: '/assets/v10/pulse-film-seoullo-20261119.mp4', poster: '/assets/v10/pulse-film-seoullo-20261117.webp', wide: true,
      note: '“What the Bridge Remembers” · 2:58 · selected in the 2026 Seoullo Media Canvas short animation open call · on show Dec 2026 to Feb 2027',
      s: [['What the name means', 'Seoullo 7017: a 1970 road for cars that became a walkway in 2017', 8, 0], ['The story built on it', 'A grandmother walks it with her grandchild and tells its old story', 26, 0], ['The name left at the end', 'What the Bridge Remembers', 174.0, 1]] },
  };

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
