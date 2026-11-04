// C 한글 창 2판 — 승인 제목의 글자가 곧 창이다. 인화지 면에 뚫린 글자 안에서 작품들이 돌고, 내리면 「컷」 획 속으로 들어가 영상이 화면이 된다. 작품 이름도 글자 속에 그 작품을 담는다.
import { HERO, WORKS, CHECKS, PROMISES, STAGES, MAKER, PRICES, FOOT, REVIEW, M, fmtShort, reduced } from '../shared/copy.mjs';
import { FILMS, WORK_ORDER, CONTEST, ownNote, mountReel, screen } from '../shared/works.mjs';
import { TITLE } from './title-paths.mjs';

const pad = (n) => String(n).padStart(2, '0');
const isM = () => innerWidth < 760 || innerWidth / innerHeight < 0.9;
const CAST = ['f08', 'm07', 'f10', 'm08'];
const ARW = '<svg class="arw" viewBox="0 0 40 16" aria-hidden="true"><path d="M0 8h38M31 1l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const app = document.getElementById('app');
app.innerHTML = `
  <header class="top" data-top>
    <a class="logo" href="./"><img class="on-paper" src="${M('brand/brand-pulse.webp')}" alt="SYNK PULSE" width="154" height="41"><img class="on-dark" src="${M('brand/logo-paper.webp')}" alt="" width="164" height="44"></a>
    <nav class="top-nav"><button type="button" data-open>${HERO.open}</button><a href="review.html">${HERO.demo}</a></nav>
  </header>
  <form class="invite" data-invite hidden><label><span>담당자에게 받은 링크</span><input name="invite" type="text" placeholder="https://workspace.synk.im/pulse-app/#invite=…" autocomplete="off" spellcheck="false" inputmode="url"></label><button type="submit">열기 →</button><p>가입이나 비밀번호 없이 열려요. 연결하면 이 프로젝트의 자료와 대화만 볼 수 있어요.</p></form>
  <main>
    <section class="reel" data-reel data-tone="paper">
      <div class="pin">
        <video class="film" data-film></video>
        <svg class="cut" data-cut aria-hidden="true" preserveAspectRatio="xMinYMin meet"><path fill-rule="evenodd"/></svg>
        <h1 class="sr">${HERO.title.join(' ')}</h1>
        <div class="void" data-void>
          <div class="void-text"><p class="kicker">${HERO.kicker}</p><p class="lead">${HERO.lead}</p></div>
          <div class="void-act"><button type="button" class="cta" data-start><span>${HERO.start}</span>${ARW}</button><p class="note">${HERO.note}</p><button type="button" class="open-m" data-open>${HERO.open}</button></div>
        </div>
        <button type="button" class="credit" data-credit><b data-cr-name></b> <span data-cr-line></span><em data-cr-note></em><span class="play">소리와 함께 보기</span></button>
      </div>
    </section>

    <section class="works" data-tone="paper">
      <header class="works-head" data-reveal><p class="kicker">${WORKS.kicker}</p><p class="lead"><b>${WORKS.title}</b> ${WORKS.text}</p></header>
      <ol class="names">${WORK_ORDER.map((id) => { const f = FILMS[id]; return `<li data-reveal><button type="button" class="name" data-watch="${id}" data-fill="works/fill-${id}.webp">${f.name}</button><p class="name-line">${[f.line, f.tag, ownNote(f)].filter(Boolean).join(' · ')}</p></li>`; }).join('')}</ol>
      <button type="button" class="contest" data-watch="${CONTEST}" data-reveal><span>${FILMS[CONTEST].note}</span><b>${FILMS[CONTEST].name}</b><span>${FILMS[CONTEST].line}</span></button>
    </section>

    <section class="three" data-tone="ink">
      <header data-reveal><p class="kicker">${CHECKS.kicker}</p><h2 class="big">${CHECKS.title}</h2></header>
      <ol class="three-list" data-reveal>
        <li><p class="mono">1/3</p><h3>${CHECKS.three[0]}</h3><div class="ev-cast" aria-hidden="true">${CAST.map((id) => `<img src="${M(`cast/full/${id}.webp`)}" alt="" loading="lazy" width="402" height="720">`).join('')}</div></li>
        <li><p class="mono">2/3</p><h3>${CHECKS.three[1]}</h3><div class="ev-word"><p class="one">${REVIEW.oneLine}</p>${REVIEW.scenes.map((c) => `<p class="ln"><span class="mono">${fmtShort(c.from)}</span> ${c.title}</p>`).join('')}</div></li>
        <li><p class="mono">3/3</p><h3>${CHECKS.three[2]}</h3><div class="ev-cuts" aria-hidden="true">${[1, 4, 6, 7, 8, 11, 12, 5].map((n) => `<img src="${M(`sheet/gift-${pad(n)}.webp`)}" alt="" loading="lazy" width="360" height="640">`).join('')}</div></li>
      </ol>
      <p class="fine" data-reveal>장면 이미지는 영상의 첫 장면이라 움직이는 동안 작은 부분은 달라질 수 있고, 제품·로고·글자는 합성이라 달라지지 않아요.</p>
    </section>

    <section class="list" data-tone="paper">
      <ol>${PROMISES.map(([t, d]) => `<li data-reveal><h3>${t}</h3><p>${d}</p></li>`).join('')}</ol>
    </section>

    <section class="how" data-tone="paper">
      <h2 class="big" data-reveal>${STAGES.title}</h2>
      <ol>${STAGES.list.map(([t, d], i) => `<li data-reveal><span class="mono">${pad(i + 1)}</span><div><h3>${t}</h3><p>${d}</p></div></li>`).join('')}</ol>
      <p class="after" data-reveal>${STAGES.after} <a href="review.html">${STAGES.afterLink} →</a></p>
    </section>

    <section class="maker" data-tone="paper">
      <p class="kicker" data-reveal>${MAKER.kicker}</p>
      <h2 class="big" data-reveal>${MAKER.title}</h2>
      <div class="maker-row" data-reveal><p>${MAKER.text}</p><ul>${MAKER.credits.map((c) => `<li>${c}</li>`).join('')}</ul></div>
    </section>

    <section class="end" data-tone="ink">
      <button type="button" class="band" data-start><span>${HERO.start}</span>${ARW}</button>
      <p class="end-note">${HERO.note}</p>
      <ul class="prices">${PRICES.list.map(([k, v]) => `<li><span>${k}</span><span>${v}</span></li>`).join('')}</ul>
      <footer class="foot"><p>${FOOT.note}</p><button type="button" data-creator>${FOOT.creator}</button></footer>
    </section>
  </main>`;

const $ = (q) => app.querySelector(q), $$ = (q) => [...app.querySelectorAll(q)];
const reelApi = mountReel($('[data-film]'), {
  startCut: 1, // 글자가 먼저 읽히도록 어두운 컷부터 시작한다.
  onCut: (f) => { const n = $('[data-cr-name]'); n.textContent = f.name; $('[data-cr-line]').textContent = f.line; $('[data-cr-note]').textContent = f.note; },
});
$$('[data-fill]').forEach((el) => el.style.setProperty('--fill', `url("${M(el.dataset.fill)}")`));

// 글자 창: 화면을 덮는 면에 글자 모양 구멍을 뚫고, 그 구멍을 viewBox로 키운다.
const E = 1e5;
const svg = $('[data-cut]'), path = svg.querySelector('path');
let T = null;
function layout() {
  T = TITLE[isM() ? 'm' : 'd'];
  path.setAttribute('d', `M${-E} ${-E}H${E}V${E}H${-E}Z ${T.d}`);
  render();
}
function fitBox(W, H) {
  const top = isM() ? 56 : 62, side = isM() ? 16 : 28, bottom = isM() ? 262 : 22;
  const k = Math.min((W - side * 2) / T.w, (H - top - bottom) / T.h);
  return { k, x: side, y: top };
}
function setView(p) {
  const W = innerWidth, H = innerHeight, b = fitBox(W, H);
  // p=0: 제목. p=1: 획 속으로 들어가 영상이 화면 가득. 움직임 줄이기면 제목에 머문다.
  const startW = W / b.k, startH = H / b.k, startX = -b.x / b.k, startY = -b.y / b.k;
  const zoom = Math.pow((Math.max(W, H) / (T.target.r * b.k * 0.6)) * 1.4, p);
  const vw = startW / zoom, vh = startH / zoom;
  const tx = T.target.x - vw / 2, ty = T.target.y - vh / 2;
  const q = Math.min(1, p * 3.2), e = q * q * (3 - 2 * q);
  svg.setAttribute('viewBox', `${(startX + (tx - startX) * e).toFixed(2)} ${(startY + (ty - startY) * e).toFixed(2)} ${vw.toFixed(2)} ${vh.toFixed(2)}`);
  svg.style.setProperty('opacity', p > 0.985 ? '0' : '1');
  return b;
}
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const reel = $('[data-reel]'), void1 = $('[data-void]'), cred = $('[data-credit]'), filmEl = $('[data-film]');
function render() {
  if (!T) return;
  const H = innerHeight, y = scrollY, h1 = reel.offsetHeight - H;
  const p = reduced() ? 0 : clamp((y - reel.offsetTop) / Math.max(1, h1 * 0.86));
  const b = setView(p);
  // 글을 셋째 줄(AI 광고) 옆 빈자리에 둔다.
  if (!isM()) { const third = T.rows[2], w3 = b.k * 640; void1.style.setProperty('--vx', `${b.x + w3 + 32}px`); void1.style.setProperty('--vy', `${b.y + third.y * b.k}px`); void1.style.setProperty('--vh', `${third.h * b.k}px`); }
  void1.classList.toggle('is-off', p > 0.03);
  // 제목일 때는 영상을 살짝 눌러 글자 모양이 먼저 읽히게 한다. 획 속으로 들어가면 제 밝기로.
  filmEl.style.setProperty('--lit', (0.68 + 0.32 * Math.min(1, p * 4)).toFixed(3));
  document.body.classList.toggle('is-past', y > reel.offsetTop + h1 - 4);
  cred.classList.toggle('is-on', p > 0.96);
  // 머리글: 영상이 화면을 채운 동안과 어두운 절 위에서는 밝게.
  const under = $$('[data-tone]').find((s) => { const r = s.getBoundingClientRect(); return r.top <= 30 && r.bottom > 30; });
  document.body.classList.toggle('is-dark-top', p > 0.5 && y < reel.offsetTop + h1 + 10 || (under?.dataset.tone === 'ink'));
  // 보이는 동안만 돌린다.
  if (y < reel.offsetTop + reel.offsetHeight) reelApi.play(); else reelApi.pause();
}
let ticking = false;
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; render(); }); } }, { passive: true });
addEventListener('resize', layout);
layout();

// 상영
function openFilm(id) {
  const work = FILMS[id];
  return screen(work, {
    className: 'screen',
    html: `<div class="sc-top"><p><b>${work.name}</b> ${work.line} · ${work.note}</p><button type="button" class="close" data-close>닫기</button></div><div class="sc-time"><span class="mono" data-t>0:00</span><div class="sc-line" data-line><i data-fill-bar></i></div></div>`,
    onOpen: (box, v) => {
      reelApi.pause();
      const fill = box.querySelector('[data-fill-bar]'), out = box.querySelector('[data-t]');
      v.addEventListener('timeupdate', () => { fill.style.setProperty('--p', String(v.currentTime / (v.duration || 1))); out.textContent = fmtShort(v.currentTime); });
      v.addEventListener('click', () => { if (v.paused) v.play(); else v.pause(); });
      box.querySelector('[data-line]').addEventListener('pointerdown', (e) => { const r = e.currentTarget.getBoundingClientRect(); v.currentTime = (e.clientX - r.left) / r.width * (v.duration || 0); });
      return () => render();
    },
  });
}
app.addEventListener('click', (e) => {
  const w = e.target.closest('[data-watch]'); if (w) { openFilm(w.dataset.watch); return; }
  if (e.target.closest('[data-credit]')) { openFilm(reelApi.current().id); return; }
  if (e.target.closest('[data-start]')) { toast('실제 앱에서는 여기서 의뢰서가 열려요.'); return; }
  if (e.target.closest('[data-creator]')) { toast('실제 앱에서는 여기서 제작자 공간이 열려요.'); return; }
  if (e.target.closest('[data-open]')) { const f = $('[data-invite]'); f.hidden = !f.hidden; if (!f.hidden) f.querySelector('input').focus(); }
});
$('[data-invite]').addEventListener('submit', (e) => { e.preventDefault(); location.href = 'review.html'; });
function toast(text) { let t = document.querySelector('.toast'); if (!t) { t = document.createElement('p'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); } t.textContent = text; t.classList.add('is-on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('is-on'), 2600); }

// 손가락에는 올릴 곳이 없으니, 화면 가운데에 온 이름의 글자 속에 그 작품이 비친다.
if (matchMedia('(hover:none)').matches) {
  const near = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('is-near', e.isIntersecting)), { rootMargin: '-46% 0px -46% 0px' });
  $$('.name').forEach((el) => near.observe(el));
}

// 나타나기
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.1 });
$$('[data-reveal]').forEach((el) => io.observe(el));
requestAnimationFrame(() => document.body.classList.add('is-ready'));
