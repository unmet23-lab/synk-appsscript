// B 콘택트 시트 2판 — 「모든 컷을 먼저 보여 드린다」를 말 대신 그대로 보여 준다. 들어오자마자 작품들의 컷이 필름 띠 두 줄로 천천히 흐르고, 손을 올린 컷은 인화지로 크게 떠오르며, 누르면 그 순간부터 소리와 함께 튼다.
import { HERO, WORKS, CHECKS, PROMISES, STAGES, MAKER, PRICES, FOOT, REVIEW, M, fmtShort, reduced } from '../shared/copy.mjs';
import { FILMS, CONTEST, ownNote, screen } from '../shared/works.mjs';
import { SHEET, WALL, tc } from '../shared/sheet-data.mjs';

const pad = (n) => String(n).padStart(2, '0');
const CAST = ['f08', 'm07', 'f10', 'm08', 'm02'];
const ARW = '<svg class="arw" viewBox="0 0 40 16" aria-hidden="true"><path d="M0 8h38M31 1l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const cutAttrs = (c) => `data-work="${c.work}" data-t="${c.t}" data-src="${c.src}" data-ratio="${c.ratio}"`;
const frame = (c, cls = '', load = 'lazy') => `<button type="button" class="cut is-${c.ratio} ${cls}" ${cutAttrs(c)} aria-label="${FILMS[c.work].name} ${tc(c.t)}부터 보기"><img src="${M(c.src)}" alt="" decoding="async" loading="${load}"><span class="cap"><span>${FILMS[c.work].name}</span><span class="mono">${tc(c.t)}</span></span></button>`;
// 띠는 두 벌을 이어 끊김 없이 돈다. 둘째 벌은 보조 기술과 키보드에서 뺀다.
const track = (cuts) => `${cuts.map((c) => frame(c, '', 'eager')).join('')}<span class="dup" aria-hidden="true">${cuts.map((c) => frame(c, '', 'eager').replace('<button ', '<button tabindex="-1" ')).join('')}</span>`;
const roll = (id, cols, cls = '') => {
  const f = FILMS[id];
  return `<article class="roll ${cls}" data-reveal>
    <header class="roll-head"><h3>${f.name}</h3><p>${f.line}${f.tag ? ` · ${f.tag}` : ''}</p>${ownNote(f) ? `<p class="dim">${ownNote(f)}</p>` : ''}<button type="button" class="watch" data-watch="${id}">소리와 함께 보기 ${ARW}</button></header>
    <div class="roll-frames c${cols}">${SHEET[id].map((c) => frame(c)).join('')}</div>
  </article>`;
};

const app = document.getElementById('app');
app.innerHTML = `
  <header class="top">
    <a class="logo" href="./"><img src="${M('brand/brand-pulse.webp')}" alt="SYNK PULSE" width="154" height="41"></a>
    <nav class="top-nav"><button type="button" data-open>${HERO.open}</button><a href="review.html">${HERO.demo}</a></nav>
  </header>
  <form class="invite" data-invite hidden><label><span>담당자에게 받은 링크</span><input name="invite" type="text" placeholder="https://workspace.synk.im/pulse-app/#invite=…" autocomplete="off" spellcheck="false" inputmode="url"></label><button type="submit">열기 →</button><p>가입이나 비밀번호 없이 열려요. 연결하면 이 프로젝트의 자료와 대화만 볼 수 있어요.</p></form>
  <main>
    <section class="hero">
      <div class="wall" data-wall>${WALL.map((cuts, i) => `<div class="row r${i + 1}"><div class="track">${track(cuts)}</div></div>`).join('')}</div>
      <div class="band">
        <div class="band-main">
          <h1 class="title" data-fit><span>${HERO.title[0]}</span> <span>${HERO.title[1]}</span> <span>${HERO.title[2]}</span></h1>
          <div class="lead-box"><p class="kicker">${HERO.kicker}</p><p class="lead">${HERO.lead}</p></div>
        </div>
        <div class="act"><button type="button" class="cta" data-start><span>${HERO.start}</span>${ARW}</button><p class="note">${HERO.note}</p><button type="button" class="open-m" data-open>${HERO.open}</button></div>
      </div>
    </section>

    <section class="works">
      <header class="sec-head" data-reveal><p class="kicker">${WORKS.kicker}</p><h2>${WORKS.title}</h2><p class="lead">${WORKS.text}</p></header>
      ${roll('gift', 12)}${roll('maejin', 6)}
      ${roll(CONTEST, 6, 'is-contest')}
    </section>

    <section class="three" data-reveal>
      <header class="sec-head"><p class="kicker">${CHECKS.kicker}</p><h2>${CHECKS.title}</h2></header>
      <ol class="three-list">
        <li><p class="no"><span class="mono">1/3</span></p><h3>${CHECKS.three[0]}</h3><div class="ev cast" aria-hidden="true">${CAST.map((id) => `<img src="${M(`cast/full/${id}.webp`)}" alt="" loading="lazy" width="402" height="720">`).join('')}</div></li>
        <li><p class="no"><span class="mono">2/3</span></p><h3>${CHECKS.three[1]}</h3><div class="ev script"><p class="one">${REVIEW.oneLine}</p>${REVIEW.scenes.map((c) => `<p class="ln"><span class="mono">${fmtShort(c.from)}</span> ${c.title}</p>`).join('')}</div></li>
        <li><p class="no"><span class="mono">3/3</span></p><h3>${CHECKS.three[2]}</h3><div class="ev cuts" aria-hidden="true">${[1, 4, 6, 7, 8, 11, 12, 5].map((n) => `<img src="${M(`sheet/gift-${pad(n)}.webp`)}" alt="" loading="lazy" width="360" height="640">`).join('')}</div></li>
      </ol>
      <p class="fine">장면 이미지는 영상의 첫 장면이라 움직이는 동안 작은 부분은 달라질 수 있고, 제품·로고·글자는 합성이라 달라지지 않아요.</p>
    </section>

    <section class="rows" data-reveal>
      <ol>${PROMISES.map(([t, d], i) => `<li><span class="mono">${pad(i + 1)}</span><h3>${t}</h3><p>${d}</p></li>`).join('')}</ol>
    </section>

    <section class="how" data-reveal>
      <h2>${STAGES.title}</h2>
      <ol>${STAGES.list.map(([t, d], i) => `<li><span class="mono">${pad(i + 1)}</span><h3>${t}</h3><p>${d}</p></li>`).join('')}</ol>
      <p class="after">${STAGES.after} <a href="review.html">${STAGES.afterLink} →</a></p>
    </section>

    <section class="maker" data-reveal>
      <div class="maker-faces" aria-hidden="true">${[8, 10, 12, 26].map((n) => `<img src="${M(`sheet/mj-${pad(n)}.webp`)}" alt="" loading="lazy" width="480" height="270">`).join('')}</div>
      <div class="maker-text"><p class="kicker">${MAKER.kicker}</p><h2>${MAKER.title}</h2><p>${MAKER.text}</p><ul>${MAKER.credits.map((c) => `<li>${c}</li>`).join('')}</ul></div>
    </section>

    <section class="end">
      <div class="end-act"><h2>${HERO.title.join(' ')}</h2><div class="end-go"><button type="button" class="cta is-big" data-start><span>${HERO.start}</span>${ARW}</button><p>${HERO.note}</p></div></div>
      <ul class="prices">${PRICES.list.map(([k, v]) => `<li><span>${k}</span><span>${v}</span></li>`).join('')}</ul>
      <footer class="foot"><p>${FOOT.note}</p><button type="button" data-creator>${FOOT.creator}</button></footer>
    </section>
  </main>
  <figure class="print" data-print hidden aria-hidden="true"><img alt=""><figcaption><span data-p-name></span><span class="mono" data-p-tc></span></figcaption></figure>`;

const $ = (q) => app.querySelector(q), $$ = (q) => [...app.querySelectorAll(q)];

// 제목을 폭에 꼭 맞춘다.
const title = $('[data-fit]'), band = title.closest('.band');
function fit() {
  title.style.removeProperty('font-size');
  if (innerWidth < 720) { title.classList.add('is-stack'); return; }
  title.classList.remove('is-stack');
  // 띠 폭을 기준으로 잰다. 제목을 담은 칸은 제목 크기를 따라 변해 기준이 못 된다. 오른쪽에 단추 자리를 남기고, 높이의 8%를 넘지 않게.
  const cs = getComputedStyle(band), room = band.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - $('.act').getBoundingClientRect().width - 32;
  let lo = 26, hi = 120;
  for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; title.style.fontSize = `${mid}px`; if (title.getBoundingClientRect().width > room) hi = mid; else lo = mid; }
  title.style.fontSize = `${Math.min(lo, innerHeight * 0.08)}px`;
}
fit(); document.fonts?.ready.then(fit); addEventListener('resize', fit);

// 벽의 줄 높이를 재서 컷 크기를 정한다(제목 크기에 따라 벽 높이가 달라진다).
const wall = $('[data-wall]');
new ResizeObserver(() => wall.style.setProperty('--rh', `${Math.floor(wall.clientHeight / 2 - 1)}px`)).observe(wall);

// 손을 올린 컷은 인화지로 크게 떠오른다.
const print = $('[data-print]'), pImg = print.querySelector('img');
const canHover = matchMedia('(hover:hover) and (pointer:fine)').matches;
function showPrint(el) {
  pImg.src = M(el.dataset.src); print.dataset.ratio = el.dataset.ratio;
  print.querySelector('[data-p-name]').textContent = FILMS[el.dataset.work].name;
  print.querySelector('[data-p-tc]').textContent = tc(Number(el.dataset.t));
  print.hidden = false;
  const r = el.getBoundingClientRect(), w = print.offsetWidth, h = print.offsetHeight, gap = 12;
  const x = Math.max(gap, Math.min(innerWidth - w - gap, r.left + r.width / 2 - w / 2));
  const y = Math.max(gap, Math.min(innerHeight - h - gap, r.top + r.height / 2 - h / 2));
  print.style.setProperty('--x', `${Math.round(x)}px`); print.style.setProperty('--y', `${Math.round(y)}px`);
  requestAnimationFrame(() => print.classList.add('is-on'));
}
const hidePrint = () => { print.classList.remove('is-on'); print.hidden = true; };
if (canHover && !reduced()) {
  app.addEventListener('pointerover', (e) => { const el = e.target.closest('.cut'); if (el) showPrint(el); });
  app.addEventListener('pointerout', (e) => { if (e.target.closest('.cut') && !e.relatedTarget?.closest?.('.cut')) hidePrint(); });
  addEventListener('scroll', hidePrint, { passive: true });
}

// 상영: 필름 옆에 슬레이트 한 줄.
function openFilm(id, t = 0) {
  hidePrint();
  const work = FILMS[id];
  return screen(work, {
    className: 'screen', t,
    html: `<div class="screen-side"><p><b>${work.name}</b> ${work.line}</p><p class="dim">${work.note}</p><div class="sc-time"><span class="mono" data-t>0:00</span><div class="sc-line" data-line><i data-fill></i></div></div><button type="button" data-close>닫기</button></div>`,
    onOpen: (box, v) => {
      const fill = box.querySelector('[data-fill]'), out = box.querySelector('[data-t]');
      v.addEventListener('timeupdate', () => { fill.style.setProperty('--p', String(v.currentTime / (v.duration || 1))); out.textContent = fmtShort(v.currentTime); });
      v.addEventListener('click', () => { if (v.paused) v.play(); else v.pause(); });
      box.querySelector('[data-line]').addEventListener('pointerdown', (e) => { const r = e.currentTarget.getBoundingClientRect(); v.currentTime = (e.clientX - r.left) / r.width * (v.duration || 0); });
      return null;
    },
  });
}
app.addEventListener('click', (e) => {
  const cut = e.target.closest('.cut'); if (cut) { openFilm(cut.dataset.work, Number(cut.dataset.t)); return; }
  const w = e.target.closest('[data-watch]'); if (w) { openFilm(w.dataset.watch); return; }
  if (e.target.closest('[data-start]')) { toast('실제 앱에서는 여기서 의뢰서가 열려요.'); return; }
  if (e.target.closest('[data-creator]')) { toast('실제 앱에서는 여기서 제작자 공간이 열려요.'); return; }
  if (e.target.closest('[data-open]')) { const f = $('[data-invite]'); f.hidden = !f.hidden; if (!f.hidden) f.querySelector('input').focus(); }
});
$('[data-invite]').addEventListener('submit', (e) => { e.preventDefault(); location.href = 'review.html'; });
function toast(text) { let t = document.querySelector('.toast'); if (!t) { t = document.createElement('p'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); } t.textContent = text; t.classList.add('is-on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('is-on'), 2600); }

// 나타나기: 줄 단위로 조용히.
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.08 });
$$('[data-reveal]').forEach((el) => io.observe(el));
requestAnimationFrame(() => document.body.classList.add('is-ready'));
