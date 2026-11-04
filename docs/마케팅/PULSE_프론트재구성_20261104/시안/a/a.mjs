// A 시사실 2판 — 들어오자마자 작품이 화면 전부다. 쇼릴 위에 제목, 다음 쪽은 작품 이름 목록(이름에 손을 올리면 뒤 화면이 그 작품으로 바뀐다), 그다음 세 번 확인 · 약속 · 진행 · 사람 · 값.
import { HERO, WORKS, CHECKS, PROMISES, STAGES, MAKER, PRICES, FOOT, REVIEW, M, reduced, fmtShort } from '../shared/copy.mjs';
import { FILMS, WORK_ORDER, CONTEST, ownNote, mountReel, screen } from '../shared/works.mjs';

const pad = (n) => String(n).padStart(2, '0');
const lines = (arr) => arr.map((t) => `<span class="ln"><span>${t}</span></span>`).join('');
const arrow = '<svg class="arw" viewBox="0 0 40 16" aria-hidden="true"><path d="M0 8h38M31 1l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
const CAST = ['f08', 'm07', 'f10', 'm08'];
const CUTS = Array.from({ length: 12 }, (_, i) => M(`sheet/gift-${pad(i + 1)}.webp`));

const SECTIONS = [
  { layer: 'reel', html: `
    <div class="hero-copy">
      <p class="kicker" data-in>${HERO.kicker}</p>
      <h1 class="display">${lines(HERO.title)}</h1>
    </div>
    <div class="hero-act">
      <button type="button" class="credit" data-watch-now data-in><b data-cr-name></b> <span data-cr-line></span><em data-cr-note></em></button>
      <button type="button" class="go is-solid" data-start data-in><span>${HERO.start}</span>${arrow}</button>
      <button type="button" class="open-m small" data-open data-in>${HERO.open}</button>
    </div>` },
  { layer: 'reel', cls: 'is-works', veil: true, html: `
    <header class="works-head"><p class="kicker" data-in>${WORKS.kicker}</p><p class="body" data-in>${WORKS.title}. ${WORKS.text}</p></header>
    <div class="works-wrap">
      <ol class="works">${WORK_ORDER.map((id) => { const f = FILMS[id]; return `<li data-in><button type="button" class="work" data-work="${id}"><span class="work-name serif">${f.name}</span><span class="work-line small"><span>${f.line}${f.tag ? ` · ${f.tag}` : ''}</span>${ownNote(f) ? `<span>${ownNote(f)}</span>` : ''}</span></button></li>`; }).join('')}</ol>
      <button type="button" class="work is-contest" data-work="${CONTEST}" data-in><span class="small">${FILMS[CONTEST].note}</span><span class="work-name serif">${FILMS[CONTEST].name}</span><span class="work-line small">${FILMS[CONTEST].line}</span></button>
    </div>` },
  { layer: 'none', cls: 'is-check', html: `
    <div class="check">
      <p class="kicker" data-in>${CHECKS.kicker}</p>
      <h2 class="display">${lines([CHECKS.title.replace('세 번', '세\u00a0번')])}</h2>
      <p class="body check-lead" data-in>${HERO.lead}</p>
      <ol class="check-list">${CHECKS.three.map((t, i) => `<li data-in><button type="button" data-check="${i}"><span class="no">${i + 1}/3</span><span class="serif">${t}</span></button></li>`).join('')}</ol>
      <p class="small" data-in>장면 이미지는 영상의 첫 장면이라 움직이는 동안 작은 부분은 달라질 수 있고, 제품·로고·글자는 합성이라 달라지지 않아요.</p>
    </div>
    <div class="check-stage" aria-hidden="true">
      <div class="pane pane-cast is-on">${CAST.map((id) => `<img src="${M(`cast/full/${id}.webp`)}" alt="" loading="lazy" decoding="async" width="402" height="720">`).join('')}</div>
      <div class="pane pane-word"><p class="serif one">${REVIEW.oneLine}</p><ol>${REVIEW.scenes.map((c) => `<li><span class="no">${fmtShort(c.from)}</span><span class="small">${c.text}</span></li>`).join('')}</ol></div>
      <div class="pane pane-cuts">${CUTS.map((src) => `<img src="${src}" alt="" loading="lazy" decoding="async" width="360" height="640">`).join('')}</div>
    </div>` },
  { layer: 'none', cls: 'is-paper', html: `
    <ol class="promises">${PROMISES.map(([t, d], i) => `<li data-in><span class="no">${pad(i + 1)}</span><h3 class="serif">${t}</h3><p class="body">${d}</p></li>`).join('')}</ol>` },
  { layer: 'shard', cls: 'is-stages', html: `
    <h2 class="display">${lines([STAGES.title])}</h2>
    <ol class="stages">${STAGES.list.map(([t, d], i) => `<li data-in><span class="no">${pad(i + 1)}</span><h3 class="serif">${t}</h3><p class="body">${d}</p></li>`).join('')}</ol>
    <p class="after" data-in><span class="body">${STAGES.after}</span> <a class="link" href="review.html">${STAGES.afterLink} →</a></p>` },
  { layer: 'reel', cls: 'is-maker', focus: 'maejin', html: `
    <div class="maker">
      <p class="kicker" data-in>${MAKER.kicker}</p>
      <h2 class="display">${lines([MAKER.title])}</h2>
      <p class="body" data-in>${MAKER.text}</p>
      <ul class="credits">${MAKER.credits.map((c) => `<li class="small" data-in>${c}</li>`).join('')}</ul>
    </div>` },
  { layer: 'end', cls: 'is-end', html: `
    <div class="end">
      <p class="display">${lines(HERO.title)}</p>
      <button type="button" class="go is-solid is-large" data-start data-in><span>${HERO.start}</span>${arrow}</button>
      <p class="small" data-in>${HERO.note}</p>
      <ul class="prices" data-in>${PRICES.list.map(([k, v]) => `<li><span class="small">${k}</span><span class="small">${v}</span></li>`).join('')}</ul>
      <footer class="foot" data-in><p class="small">${FOOT.note}</p><button type="button" class="small link" data-creator>${FOOT.creator}</button></footer>
    </div>` },
];
const LAYERS = [{ id: 'reel' }, { id: 'none' }, { id: 'shard', image: M('gift/wide2-shard.webp') }, { id: 'end', image: M('gift/end.webp') }];

const app = document.getElementById('app');
app.innerHTML = `
  <div class="stage" aria-hidden="true">${LAYERS.map((l) => `<div class="layer layer-${l.id}" data-layer="${l.id}">${l.image ? `<img src="${l.image}" alt="" decoding="async">` : ''}${l.id === 'reel' ? '<video data-reel></video>' : ''}</div>`).join('')}<div class="shade"></div><div class="veil" data-veil></div></div>
  <header class="top">
    <a class="logo" href="./"><img src="${M('brand/logo-paper.webp')}" alt="SYNK PULSE" width="164" height="44"></a>
    <nav class="top-nav"><button type="button" data-open>${HERO.open}</button><a href="review.html">${HERO.demo}</a></nav>
  </header>
  <main class="reel" tabindex="-1">${SECTIONS.map((s, i) => `<section class="s ${s.cls || ''}" data-i="${i}" data-layer="${s.layer}">${s.html}</section>`).join('')}</main>
  <nav class="numbers" aria-label="쪽">${SECTIONS.map((_, i) => `<button type="button" data-go="${i}" aria-label="${i + 1}쪽"><span>${i + 1}</span></button>`).join('')}<i class="bar" aria-hidden="true"></i></nav>
  <form class="invite" data-invite hidden><label><span class="small">담당자에게 받은 링크</span><input name="invite" type="text" placeholder="https://workspace.synk.im/pulse-app/#invite=…" autocomplete="off" spellcheck="false" inputmode="url"></label><button type="submit" class="go"><span>열기</span>${arrow}</button><p class="small">가입이나 비밀번호 없이 열려요. 연결하면 이 프로젝트의 자료와 대화만 볼 수 있어요.</p></form>`;

const $ = (q) => app.querySelector(q), $$ = (q) => [...app.querySelectorAll(q)];
const reelApi = mountReel($('[data-reel]'), {
  onCut: (f) => { const n = $('[data-cr-name]'); if (!n) return; n.textContent = f.name; $('[data-cr-line]').textContent = f.line; $('[data-cr-note]').textContent = f.note; },
});
const layerEls = new Map($$('.layer').map((el) => [el.dataset.layer, el]));
const numbers = $$('.numbers button'), sections = $$('.s');
let current = -1, cursor = null;

// 세 번 확인: 줄마다 오른쪽 화면이 바뀐다. 쪽에 머무는 동안 천천히 저절로 넘어가고, 손을 대면 멈춘다.
const panes = $$('.pane'), rows = $$('[data-check]');
let checkAt = 0, checkTimer = 0;
const setCheck = (k) => { checkAt = k; panes.forEach((p, n) => p.classList.toggle('is-on', n === k)); rows.forEach((b, n) => b.classList.toggle('is-now', n === k)); };
const autoCheck = (on) => { clearInterval(checkTimer); if (on && !reduced()) checkTimer = setInterval(() => setCheck((checkAt + 1) % panes.length), 3400); };
rows.forEach((b) => { const pick = () => { autoCheck(false); setCheck(Number(b.dataset.check)); }; b.addEventListener('pointerenter', pick); b.addEventListener('focus', pick); b.addEventListener('click', pick); });
setCheck(0);

function activate(i) {
  if (i === current) return; current = i;
  const sec = SECTIONS[i], id = sec.layer;
  layerEls.forEach((el, key) => el.classList.toggle('is-on', key === id));
  if (i !== 1) { reelApi.focus(sec.focus ?? null); document.body.classList.remove('has-work'); $$('.work').forEach((x) => x.classList.remove('is-on')); }
  if (id === 'reel') reelApi.play(); else reelApi.pause();
  autoCheck(sec.cls === 'is-check');
  $('[data-veil]').classList.toggle('is-on', !!sec.veil);
  numbers.forEach((b, k) => { b.classList.toggle('is-now', k === i); if (k === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
  $('.bar').style.setProperty('--x', String(i));
  document.body.dataset.section = String(i);
  document.body.classList.toggle('on-paper', sec.cls === 'is-paper');
  document.body.classList.toggle('on-maker', sec.cls === 'is-maker');
  document.body.classList.toggle('on-end', sec.cls === 'is-end');
  cursor?.classList.remove('is-on');
}
const reel = $('.reel');
// 천천히 내려도 놓치지 않게 문턱을 여럿 두고, 절반을 넘긴 쪽을 켠다.
const io = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting && e.intersectionRatio >= 0.5) { e.target.classList.add('is-in'); activate(Number(e.target.dataset.i)); } }, { root: reel, threshold: [0.5, 0.6, 0.8, 1] });
sections.forEach((s) => io.observe(s));
sections.forEach((s) => { s.querySelectorAll('[data-in]').forEach((n, k) => n.style.setProperty('--d', `${k * 60 + 160}ms`)); s.querySelectorAll('.ln > span').forEach((n, k) => n.style.setProperty('--d', `${k * 90 + 40}ms`)); });
numbers.forEach((b) => b.addEventListener('click', () => sections[Number(b.dataset.go)].scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' })));
addEventListener('keydown', (e) => {
  if (document.querySelector('.screening') || /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
  if (['ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); sections[Math.min(current + 1, sections.length - 1)].scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' }); }
  if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); sections[Math.max(current - 1, 0)].scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' }); }
});

// 마우스 휠 한 번(트랙패드 손짓 한 번)에 한 쪽씩. 쪽 넘김 맞물림은 작은 휠 눈금을 제자리로 되돌려 버리기 때문이다.
let wheelLock = 0, armed = true, prevAbs = 0, wheelIdle = 0;
reel.addEventListener('wheel', (e) => {
  if (document.querySelector('.screening')) return;
  const sec = sections[current], r = sec.getBoundingClientRect(), dir = Math.sign(e.deltaY);
  // 화면보다 긴 쪽(낮은 창)은 그 쪽 끝까지 평소처럼 내린다.
  if (r.height > innerHeight + 4 && !((dir > 0 && r.bottom <= innerHeight + 2) || (dir < 0 && r.top >= -2))) return;
  const to = Math.max(0, Math.min(sections.length - 1, current + dir));
  if (to === current) return; // 양 끝에서는 바깥 페이지가 움직이게 둔다.
  e.preventDefault();
  const now = performance.now(), abs = Math.abs(e.deltaY);
  clearTimeout(wheelIdle); wheelIdle = setTimeout(() => { armed = true; prevAbs = 0; }, 150);
  const notch = e.wheelDeltaY && e.wheelDeltaY % 120 === 0;
  if (!armed && now > wheelLock && (notch || (abs > 40 && abs > prevAbs * 1.6))) armed = true;
  prevAbs = abs;
  if (!armed || now < wheelLock || abs < 4) return;
  armed = false; wheelLock = now + 780;
  sections[to].scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
}, { passive: false });

// 작품 이름에 손을 올리면 뒤 화면이 그 작품으로.
$$('.work').forEach((b) => {
  const on = () => { document.body.classList.add('has-work'); $$('.work').forEach((x) => x.classList.toggle('is-on', x === b)); reelApi.focus(b.dataset.work); };
  b.addEventListener('pointerenter', on); b.addEventListener('focus', on);
});
$('.works-wrap')?.addEventListener('pointerleave', () => { document.body.classList.remove('has-work'); $$('.work').forEach((x) => x.classList.remove('is-on')); reelApi.focus(null); });

// 소리와 함께: 어두운 방.
function openScreening(work) {
  return screen(work, {
    html: `<div class="sc-ui"><button type="button" class="small sc-close" data-close>닫기</button><p class="sc-title"><b>${work.name}</b> <span>${work.line}</span><em>${work.note}</em></p><div class="sc-time"><span class="mono" data-t>0:00</span><div class="sc-line" data-line><i data-fill></i></div></div></div>`,
    onOpen: (box, v) => {
      reelApi.pause();
      const fill = box.querySelector('[data-fill]'), tc = box.querySelector('[data-t]'); let idle = 0;
      const wake = () => { box.classList.remove('is-idle'); clearTimeout(idle); idle = setTimeout(() => { if (!v.paused) box.classList.add('is-idle'); }, 2000); };
      wake(); box.addEventListener('pointermove', wake); box.addEventListener('pointerdown', wake);
      v.addEventListener('timeupdate', () => { fill.style.setProperty('--p', String(v.currentTime / (v.duration || 1))); tc.textContent = fmtShort(v.currentTime); });
      v.addEventListener('ended', wake);
      v.addEventListener('click', () => { if (v.paused) v.play(); else v.pause(); wake(); });
      box.querySelector('[data-line]').addEventListener('pointerdown', (e) => { const r = e.currentTarget.getBoundingClientRect(); v.currentTime = (e.clientX - r.left) / r.width * (v.duration || 0); });
      return () => { clearTimeout(idle); if (SECTIONS[current]?.layer === 'reel') reelApi.play(); };
    },
  });
}
app.addEventListener('click', (e) => {
  const w = e.target.closest('[data-work]'); if (w) { openScreening(FILMS[w.dataset.work]); return; }
  if (e.target.closest('[data-watch-now]')) { openScreening(reelApi.current()); return; }
  if (e.target.closest('[data-start]')) { e.preventDefault(); toast('실제 앱에서는 여기서 의뢰서가 열려요.'); return; }
  if (e.target.closest('[data-creator]')) { toast('실제 앱에서는 여기서 제작자 공간이 열려요.'); return; }
  if (e.target.closest('[data-open]')) { const f = $('[data-invite]'); f.hidden = !f.hidden; if (!f.hidden) f.querySelector('input').focus(); }
});
$('[data-invite]').addEventListener('submit', (e) => { e.preventDefault(); location.href = 'review.html'; });
function toast(text) { let t = document.querySelector('.toast'); if (!t) { t = document.createElement('p'); t.className = 'toast small'; t.setAttribute('role', 'status'); document.body.append(t); } t.textContent = text; t.classList.add('is-on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('is-on'), 2600); }

// 쇼릴 위에서는 커서가 곧 재생 안내다(마우스일 때만).
if (matchMedia('(hover:hover) and (pointer:fine)').matches && !reduced()) {
  cursor = document.createElement('div'); cursor.className = 'cursor'; cursor.setAttribute('aria-hidden', 'true'); cursor.innerHTML = '<span>소리와 함께 보기</span>'; document.body.append(cursor);
  let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
  addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; cursor.classList.toggle('is-on', current === 0 && !e.target.closest('button,a,input,form,.hero-copy,.numbers,.top')); });
  (function tick() { x += (tx - x) * 0.16; y += (ty - y) * 0.16; cursor.style.setProperty('--tx', `${x}px`); cursor.style.setProperty('--ty', `${y}px`); requestAnimationFrame(tick); })();
  reel.addEventListener('click', (e) => { if (current === 0 && !e.target.closest('button,a,input,form,.hero-copy')) openScreening(reelApi.current()); });
}
activate(0); sections[0].classList.add('is-in');
