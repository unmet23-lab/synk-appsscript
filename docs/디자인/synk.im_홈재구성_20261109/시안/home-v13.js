// synk.im 홈 시안 v13 · 2026-11-09 — 네 가지 일: 줄에 손을 올리거나 닿으면 오른쪽 무대가 그 사업으로 바뀐다. 저절로 돌지 않는다(홈은 회사 설명, 어필은 각 사업 쪽).
// 예약표 시각 · 지도 이름표는 공개본 home-v12.js와 같은 규칙. 움직임 줄이기면 영상을 틀지 않고 동선을 다시 그리지 않는다.
// 옮긴 구역의 옛 주소는 그 사업 쪽으로 잇는다.
const 옮김 = { '#drama': '/lab/#drama', '#learner': '/lab/' };
if (옮김[location.hash]) location.replace(옮김[location.hash]);
// 비교 쪽에서 회사 한 줄 후보를 얹어 볼 때만 쓴다(시안 전용).
const 후보 = new URLSearchParams(location.search).get('line');
if (후보) { const [a, b] = 후보.split('|'), h1 = document.querySelector('.gate-say'); if (h1) { h1.textContent = ''; for (const [글, 칸] of b ? [[a, 'a'], [b, 'b']] : [[a, 'b']]) { const s = document.createElement('span'); s.className = 칸; s.textContent = 글; h1.append(s, ' '); } } }
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const root = $('[data-biz]');
if (root) {
  const rows = [...root.querySelectorAll('[data-row]')];
  const frames = [...root.querySelectorAll('.v13-stage .hs-frame')];

  const rowsEl = $('[data-rows]', root), clock = $('[data-clock]', root);
  const seoul = () => {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date());
    const g = t => f.find(x => x.type === t).value;
    return { hm: g('hour') + ':' + g('minute'), day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday')) };
  };
  function tickBoard() {
    if (!rowsEl) return;
    const { hm, day } = seoul();
    if (clock) clock.textContent = hm;
    let next = -1;
    [...rowsEl.children].forEach((li, i) => {
      const days = li.dataset.days ? li.dataset.days.split(',').map(Number) : null, off = days && !days.includes(day);
      li.classList.toggle('is-off', !!off); li.classList.toggle('is-past', !off && li.dataset.at < hm);
      const isNext = next < 0 && !off && li.dataset.at >= hm; if (isNext) next = i; li.classList.toggle('is-next', isNext);
    });
  }
  tickBoard(); setInterval(tickBoard, 20000);

  const box = $('.hs-map', root);
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
  const drawRoute = () => { if (reduce) return; for (const r of routes) { r.style.transition = 'none'; r.style.strokeDasharray = r._len; r.style.strokeDashoffset = r._len; r.getBoundingClientRect(); r.style.transition = 'stroke-dashoffset 2.6s cubic-bezier(.45,0,.2,1) .3s'; r.style.strokeDashoffset = 0; } };

  let active = 0;
  const load = v => { if (v && !v.src) v.src = v.dataset.src; };
  function show(i) {
    if (i === active) { const v = $('video', frames[i]); if (v && !reduce) { load(v); v.play().catch(() => {}); } return; }
    active = i;
    rows.forEach((r, k) => r.classList.toggle('is-on', k === i));
    frames.forEach((f, k) => {
      const on = k === i, v = $('video', f);
      f.classList.toggle('is-on', on);
      if (v) { if (on && !reduce) { load(v); v.currentTime = 0; v.play().catch(() => {}); } else v.pause(); }
    });
    const key = rows[i].dataset.row;
    if (key === 'path') drawRoute();
  }
  const wide = matchMedia('(min-width:901px)');
  rows.forEach((r, i) => {
    r.addEventListener('pointerenter', () => { if (wide.matches) show(i); });
    r.addEventListener('focusin', () => { if (wide.matches) show(i); });
  });
  // 줄에서 손을 떼면 영상만 멈춘다(그림은 그 자리). 화면 밖에서는 돌지 않는다.
  $('.v13-rows', root).addEventListener('pointerleave', () => { for (const v of root.querySelectorAll('video')) v.pause(); });
}
