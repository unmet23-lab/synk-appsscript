// synk.im 뼈대 시안(2026-11-10) — 시안 전용. 원고에 지을 때는 home-v12.js를 이 규칙으로 바꾼다(home-v13.js).
// ① 홈에서 뺀 구역의 옛 주소를 사업 쪽으로 넘긴다
// ② 문 넷의 상영: 공개본 home-v12.js의 규칙(한 칸씩 차례로 · 손을 올리면 그 칸부터 · 예약표는 서울 시각 · 동선은 다시 그림)을 새 짜임에 맞춰 옮겼다.
//    넓은 화면은 차례로 돌고, 좁은 화면(문이 세로로 쌓임)은 화면 가운데에 가장 가까운 문 하나만 상영한다. 시안에서는 home-v12.js를 싣지 않는다.
// ③ 메뉴 막대의 밝기: 밤 구역이 입구 아래로 이어지므로 막대 밑이 밤이면 어둡게 둔다.
const 옮김 = { '#drama': '/lab/#drama', '#founder': '/founder/' };
if (옮김[location.hash]) location.replace(옮김[location.hash]);

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const stages = $('.k-doors-grid[data-stages]');
if (stages) {
  const cells = [...stages.querySelectorAll('.hs')];
  // 예약표 — 지난 줄은 흐리게, 다음 줄은 켜고, 그날 안 도는 줄은 「오늘 없음」
  const rowsEl = $('[data-rows]', stages), clock = $('[data-clock]', stages);
  const seoul = () => {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date());
    const g = t => f.find(x => x.type === t).value;
    return { hm: g('hour') + ':' + g('minute'), day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday')) };
  };
  function tickBoard(scroll) {
    if (!rowsEl) return;
    const { hm, day } = seoul();
    if (clock) clock.textContent = hm;
    let next = -1;
    [...rowsEl.children].forEach((li, i) => {
      const days = li.dataset.days ? li.dataset.days.split(',').map(Number) : null, off = days && !days.includes(day);
      li.classList.toggle('is-off', !!off); li.classList.toggle('is-past', !off && li.dataset.at < hm);
      const isNext = next < 0 && !off && li.dataset.at >= hm; if (isNext) next = i; li.classList.toggle('is-next', isNext);
    });
    if (scroll) { const li = rowsEl.children[Math.max(0, (next < 0 ? rowsEl.children.length - 1 : next) - 2)]; rowsEl.style.transform = `translateY(${-li.offsetTop}px)`; }
  }
  tickBoard(false); setInterval(() => tickBoard(false), 20000);
  // 지도 이름표 자리 — 칸 안에서 가장 덜 겹치는 쪽
  const box = $('.hs-map', stages);
  const routes = box ? [...box.querySelectorAll('[data-route]')] : [];
  for (const r of routes) r._len = r.getTotalLength();
  function untangle() {
    if (!box) return;
    const m = box.getBoundingClientRect(), pins = [...box.querySelectorAll('.hp-pin')];
    if (!m.width) return;
    const icons = pins.map(p => ($('img', p) || $('.hp-mk', p)).getBoundingClientRect()), tags = [];
    const area = (r, b) => Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left)) * Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top));
    pins.forEach((p, i) => {
      let best = null;
      for (const side of ['is-left', 'is-right', 'is-down', 'is-up']) {
        p.classList.remove('is-left', 'is-right', 'is-down', 'is-up'); p.classList.add(side);
        const r = $('.hp-tag', p).getBoundingClientRect();
        const out = r.left < m.left + 4 || r.right > m.right - 4 || r.top < m.top + 4 || r.bottom > m.bottom - 60 ? 1e6 : 0;
        const cost = out + [...tags, ...icons.filter((_, k) => k !== i)].reduce((n, b) => n + area(r, b), 0);
        if (!best || cost < best.cost) best = { side, cost };
      }
      p.classList.remove('is-left', 'is-right', 'is-down', 'is-up'); p.classList.add(best.side);
      tags.push($('.hp-tag', p).getBoundingClientRect());
    });
  }
  untangle(); addEventListener('resize', untangle);
  const drawRoute = () => { for (const r of routes) { r.style.transition = 'none'; r.style.strokeDasharray = r._len; r.style.strokeDashoffset = r._len; r.getBoundingClientRect(); r.style.transition = 'stroke-dashoffset 2.6s cubic-bezier(.45,0,.2,1) .3s'; r.style.strokeDashoffset = 0; } };

  if (!reduce) {
    let active = -1, timer = 0, held = false, inView = false;
    const narrow = matchMedia('(max-width:1100px)');
    function show(i) {
      if (i === active) return;
      cells.forEach((c, k) => {
        const on = k === i, v = $('video', c); c.classList.toggle('is-on', on);
        if (v) { if (on) { if (!v.src) v.src = v.dataset.src; v.currentTime = 0; v.play().catch(() => {}); } else v.pause(); }
      });
      active = i; if (i < 0) return;
      const c = cells[i]; c.style.setProperty('--dur', c.dataset.dur + 's');
      if (c.classList.contains('hs-shift')) tickBoard(true); else if (rowsEl) rowsEl.style.transform = '';
      if (c.classList.contains('hs-path')) drawRoute();
    }
    const run = i => { clearTimeout(timer); active = -1; show(i); if (!held && !narrow.matches) timer = setTimeout(() => run((i + 1) % cells.length), cells[i].dataset.dur * 1000); };
    const stop = () => { clearTimeout(timer); show(-1); };
    // 좁은 화면: 화면 가운데에 가장 가까운 문
    const nearest = () => { let best = -1, d = 1e9; cells.forEach((c, k) => { const r = $('.hs-frame', c).getBoundingClientRect(); if (r.bottom < 60 || r.top > innerHeight - 60) return; const x = Math.abs((r.top + r.bottom) / 2 - innerHeight / 2); if (x < d) { d = x; best = k; } }); return best; };
    const onScroll = () => { if (narrow.matches) { clearTimeout(timer); show(nearest()); } };
    addEventListener('scroll', onScroll, { passive: true });
    new IntersectionObserver(es => { for (const e of es) { inView = e.isIntersecting; if (narrow.matches) onScroll(); else if (!inView) stop(); else { held = false; run(active < 0 ? 0 : active); } } }, { threshold: .25 }).observe(stages);
    const resume = () => { held = false; clearTimeout(timer); const from = active < 0 ? 0 : active; timer = setTimeout(() => run((from + 1) % cells.length), 4000); };
    cells.forEach((c, i) => {
      c.addEventListener('pointerenter', () => { if (narrow.matches || !inView) return; held = true; if (active !== i) run(i); else clearTimeout(timer); });
      c.addEventListener('pointerleave', () => { if (narrow.matches || !inView) return; resume(); });
      const f = $('.hs-frame', c);
      f.addEventListener('focus', () => { if (narrow.matches) return; held = true; run(i); });
      f.addEventListener('blur', () => { if (!narrow.matches) resume(); });
    });
  }
}

const bar = $('[data-bar]');
if (bar) {
  const tone = () => {
    const under = document.elementsFromPoint(innerWidth / 2, 46).find(e => !bar.contains(e));
    const dark = !!under?.closest('.gate,.k-night,.lw,.sv-ask,.k-dark');
    if (bar.classList.contains('on-dark') !== dark) bar.classList.toggle('on-dark', dark);
  };
  // 공개본 site.js가 같은 스크롤에서 입구만 보고 다시 칠하므로, 그 뒤(다음 작업 차례)에 한 번 더 본다. 가려진 창에서는 rAF가 안 돌아 쓰지 않는다.
  const later = () => { tone(); setTimeout(tone, 0); };
  addEventListener('scroll', later, { passive: true });
  addEventListener('resize', later);
  new MutationObserver(tone).observe(bar, { attributes: true, attributeFilter: ['class'] });
  later();
}
