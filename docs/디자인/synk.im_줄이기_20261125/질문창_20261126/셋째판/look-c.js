/* 다 검정 무대 — Fin의 가는 세리프 제목과 아래에 떠 있는 입력 알약, Linear · Raycast의 검정 바탕, PULSE 캐스팅 복도의 명조 300.
   질문 줄 자체가 큰 글자이고, 답의 첫 문장이 화면의 주인공이다. */
import { ask, askRecord, rank, firsts, scopeCounts, load } from './ask-core.js';
import { el, para, words, linkOut, icon, DOT_DARK, FROM } from './ui.js';

const SCOPES = [['all', '전체'], ['study', '한국 유학'], ['ai', 'AI 강의'], ['ads', '광고'], ['company', '회사']];

export function mount(root, hooks) {
  root.innerHTML = `
  <section class="C" role="dialog" aria-modal="true" aria-labelledby="c-t">
    <header class="c-top"><span class="c-mark">synk</span><button type="button" class="c-x">닫기 <kbd>esc</kbd></button></header>
    <div class="c-stage">
      <div class="c-v c-pick">
        <h2 id="c-t" class="c-t">무엇이든 물어보세요<span>synk.im 공개 안내에서 찾아 답합니다</span></h2>
        <div class="c-main">
          <p class="c-k" aria-hidden="true"></p>
          <ul class="c-qs" role="listbox" id="c-qs" aria-label="질문"></ul>
        </div>
        <aside class="c-side"><p class="c-k">어느 사업이 궁금하세요</p><ul class="c-scopes"></ul></aside>
      </div>
      <article class="c-v c-art" hidden aria-live="polite"></article>
    </div>
    <form class="c-dock" autocomplete="off">
      <label class="sr" for="c-in">질문</label>
      <input id="c-in" type="text" enterkeyhint="send" role="combobox" aria-controls="c-qs" aria-expanded="true" aria-autocomplete="list">
      <button type="submit" class="c-send" aria-label="보내기" disabled></button>
    </form>
  </section>`;
  const $ = s => root.querySelector(s);
  const C = $('.C'), input = $('#c-in'), qs = $('.c-qs'), pickV = $('.c-pick'), art = $('.c-art'), send = $('.c-send'), label = $('.c-pick .c-k');
  send.append(icon('up'));
  let scope = 'all', items = [], active = -1, ph = [], phi = 0, phTimer = 0;

  function list(xs, k) {
    items = xs; label.textContent = k;
    qs.replaceChildren(...xs.map((x, i) => {
      const li = el('li', 'c-q'); li.id = 'c-o' + i; li.setAttribute('role', 'option'); li.style.animationDelay = i * 45 + 'ms';
      li.append(el('span', 'c-arr', '→'), el('span', 'c-qt', x.q));
      li.addEventListener('click', () => go(askRecord(x.id, x.q), x.q));
      li.addEventListener('mousemove', () => mark(i));
      return li;
    }));
    mark(-1);
  }
  function mark(i) { active = i; qs.querySelectorAll('.c-q').forEach((o, k) => o.setAttribute('aria-selected', String(k === i))); }

  async function setScope(k) {
    scope = k;
    $('.c-scopes').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
    const f = await firsts(k, 6);
    ph = []; input.placeholder = '질문을 적거나 위에서 고르세요';
    showPick();
    if (input.value.trim()) suggest(); else list(f, k === 'all' ? '자주 묻는 질문' : SCOPES.find(s => s[0] === k)[1] + '에서 자주 묻는 질문');
  }
  scopeCounts().then(c => {
    $('.c-scopes').replaceChildren(...SCOPES.map(([k, name]) => {
      const li = el('li'), b = el('button', 'c-sc'); b.type = 'button'; b.dataset.k = k; b.setAttribute('aria-pressed', String(k === scope));
      b.append(el('span', 'c-scn', name), el('span', 'c-scc', String(c[k])));
      b.addEventListener('click', () => setScope(k)); li.append(b); return li;
    }));
  });

  function showPick() { if (!art.hidden) { art.hidden = true; pickV.hidden = false; } }
  async function suggest() {
    const q = input.value.trim();
    if (!q) { setScope(scope); return; }
    const xs = await rank(q, 6, scope);
    if (input.value.trim() !== q) return;
    showPick();
    if (xs.length) { list(xs, '맞는 질문'); mark(0); }
    else list([], '맞는 질문이 없어요. 그대로 보내면 공개 안내 전체에서 찾습니다.');
  }
  input.addEventListener('input', () => { send.disabled = !input.value.trim(); suggest(); });
  input.addEventListener('keydown', e => {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); mark((active + 1) % items.length); }
    else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); mark((active - 1 + items.length) % items.length); }
    else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0 && items[active] && !pickV.hidden) { const x = items[active]; go(askRecord(x.id, x.q), x.q); } else if (input.value.trim()) $('.c-dock').requestSubmit(); }
  });
  $('.c-dock').addEventListener('submit', e => { e.preventDefault(); const q = input.value.trim(); if (!q) return; go(ask(q), q); });
  const startPh = () => { clearInterval(phTimer); phTimer = setInterval(() => { if (!input.value && document.activeElement !== input && ph.length) { phi++; input.placeholder = ph[phi % ph.length]; } }, 3200); };

  async function go(p, q) {
    input.value = ''; send.disabled = true;
    const r = await p;
    pickV.hidden = true; art.hidden = false; art.replaceChildren();
    const back = el('button', 'c-back', '← 질문 목록'); back.type = 'button'; back.addEventListener('click', () => { setScope(scope); input.focus({ preventScroll: true }); });
    const asked = el('h3', 'c-asked', q), lead = el('p', 'c-lead'); words(lead, r.lead, 14, 600);
    input.placeholder = '이어서 물어보세요';
    const grid = el('div', 'c-grid'), text = el('div', 'c-text'), side = el('aside', 'c-aside');
    text.append(...r.body.slice(0, 2).map(para));
    if (r.body.length > 2) { const rest = el('div'); rest.hidden = true; rest.append(...r.body.slice(2).map(para)); const m = el('button', 'c-more', '이어서 읽기'); m.type = 'button'; m.addEventListener('click', () => { rest.hidden = false; m.remove(); }); text.append(rest, m); }
    const src = el('p', 'c-src'), d = el('span', 'c-dot'); d.style.background = r.found ? (DOT_DARK[r.sourceId] || '#fff') : '#555';
    src.append(d, r.found ? FROM(r.sourceId) : '공개 안내에서 찾지 못했어요');
    side.append(el('p', 'c-k', '찾은 곳'), src);
    if (r.action) side.append(linkOut(r.action, 'c-go', hooks));
    if (r.related.length) {
      side.append(el('p', 'c-k c-k2', '이어서'));
      const ul = el('ul', 'c-rel'); r.related.forEach(x => { const li = el('li'), b = el('button', '', x.q); b.type = 'button'; b.addEventListener('click', () => go(askRecord(x.id, x.q), x.q)); li.append(b); ul.append(li); }); side.append(ul);
    }
    grid.append(text, side);
    art.append(back, asked, lead, grid);
    $('.c-stage').scrollTop = 0;
  }

  const onKey = e => { if (e.key === 'Escape') hooks.close(); };
  $('.c-x').addEventListener('click', () => hooks.close());
  load().then(() => setScope('all'));
  return {
    open() { document.addEventListener("keydown", onKey); startPh(); C.classList.remove('in'); void C.offsetWidth; C.classList.add('in'); if (matchMedia('(pointer:fine)').matches) requestAnimationFrame(() => input.focus({ preventScroll: true })); },
    close() { document.removeEventListener('keydown', onKey); clearInterval(phTimer); },
    ask(q) { load().then(() => go(ask(q), q)); },
  };
}
