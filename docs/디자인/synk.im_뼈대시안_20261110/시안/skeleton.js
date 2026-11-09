// synk.im 뼈대 시안(2026-11-10) — 시안 전용 보조. 원고에 지을 때는 home-v12.js에 합친다.
// ① 홈에서 뺀 구역의 옛 주소를 사업 쪽으로 넘긴다 ② 좁은 화면에서는 네 문이 세로로 쌓이므로, 화면 가운데에 온 문 하나만 상영한다(넓은 화면은 공개본 home-v12.js가 차례로 돌린다).
const 옮김 = { '#drama': '/lab/#drama', '#founder': '/founder/' };
if (옮김[location.hash]) location.replace(옮김[location.hash]);

const stages = document.querySelector('.k-doors-grid[data-stages]');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (stages && !reduce) {
  const narrow = matchMedia('(max-width:1100px)');
  const cells = [...stages.querySelectorAll('.hs')];
  const io = new IntersectionObserver(es => {
    if (!narrow.matches) return;
    for (const e of es) {
      const c = e.target, v = c.querySelector('video'), on = e.isIntersecting;
      c.classList.toggle('is-on', on); c.style.setProperty('--dur', c.dataset.dur + 's');
      if (v) { if (on) { if (!v.src) v.src = v.dataset.src; v.play().catch(() => {}); } else v.pause(); }
    }
  }, { rootMargin: '-35% 0px -35% 0px' });
  cells.forEach(c => io.observe(c));
}

// ③ 메뉴 막대의 밝기: 공개본은 입구 위에서만 어둡다. 밤 구역이 입구 아래로 이어지므로, 막대 밑에 깔린 구역이 밤이면 어둡게 둔다.
const bar = document.querySelector('[data-bar]');
if (bar) {
  const tone = () => {
    const under = document.elementsFromPoint(innerWidth / 2, 46).find(e => !bar.contains(e));
    const dark = !!under?.closest('.gate,.k-night,.lw,.sv-ask,.k-dark');
    if (bar.classList.contains('on-dark') !== dark) bar.classList.toggle('on-dark', dark);
  };
  addEventListener('scroll', () => requestAnimationFrame(tone), { passive: true });
  new MutationObserver(() => requestAnimationFrame(tone)).observe(bar, { attributes: true, attributeFilter: ['class'] });
  requestAnimationFrame(tone);
}
