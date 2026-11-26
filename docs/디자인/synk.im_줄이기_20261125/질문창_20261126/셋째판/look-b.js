/* 나 유리 검색 — apple.com 검색 짜임. 홈이 흐려지고 위에서 판이 내려온다. 상자 없는 큰 입력 글자, 화살표 줄.
   물으면 판이 아래로 늘어나 지원 글처럼 답한다(왼쪽 답, 오른쪽 할 일). */
import { ask, askRecord, rank, firsts, load } from './ask-core.js';
import { el, para, words, linkOut, icon, DOT_LIGHT, KIND, FROM } from './ui.js';
import { preview } from './ask-core.js';

const QUICK = [['한국 유학 사전예약', '/#reserve'], ['솔리오 PC 앱 받기', '/#platform'], ['새 소식', '/#now'], ['hello@synk.im으로 메일 보내기', '/#contact']];

export function mount(root, hooks) {
  root.innerHTML = `
  <section class="B" role="dialog" aria-modal="true" aria-labelledby="b-t">
    <div class="b-veil"></div>
    <div class="b-sheet">
      <div class="b-in">
        <h2 id="b-t" class="sr">무엇이든 물어보세요</h2>
        <form class="b-field" autocomplete="off">
          <label class="sr" for="b-in">질문</label>
          <input id="b-in" type="text" enterkeyhint="search" placeholder="무엇이든 물어보세요" role="combobox" aria-expanded="true" aria-controls="b-list-live" aria-autocomplete="list">
          <button type="button" class="b-x" aria-label="닫기"></button>
        </form>
        <div class="b-body">
          <div class="b-view b-home">
            <div><p class="b-k">자주 묻는 질문</p><ul class="b-list b-faq"></ul></div>
            <div><p class="b-k">바로 가기</p><ul class="b-list b-quick"></ul></div>
          </div>
          <div class="b-view b-live" hidden><p class="b-k">맞는 질문</p><ul class="b-list" id="b-list-live" role="listbox" aria-label="맞는 질문"></ul></div>
          <article class="b-view b-art" hidden aria-live="polite"></article>
        </div>
      </div>
    </div>
  </section>`;
  const $ = s => root.querySelector(s);
  const B = $('.B'), input = $('#b-in'), body = $('.b-body'), home = $('.b-home'), live = $('.b-live'), art = $('.b-art'), liveList = $('#b-list-live');
  $('.b-field').prepend(icon('mag')); $('.b-x').append(icon('x'));
  let rows = [], active = -1, mode = 'home';

  const row = (text, onPick, tail) => {
    const li = el('li'), b = el('button', 'b-row'); b.type = 'button';
    b.append(icon('arr'), el('span', 'b-rt', text)); if (tail) b.append(tail);
    b.addEventListener('click', onPick); li.append(b); return li;
  };
  /* 판 높이가 내용에 맞춰 부드럽게 바뀐다 */
  function swap(fn) {
    const h0 = body.getBoundingClientRect().height; fn();
    const h1 = body.scrollHeight;
    if (Math.abs(h1 - h0) < 2 || matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    body.style.height = h0 + 'px'; void body.offsetHeight; body.style.height = h1 + 'px';
    body.addEventListener('transitionend', () => { body.style.height = ''; }, { once: true });
  }
  function view(m) { mode = m; home.hidden = m !== 'home'; live.hidden = m !== 'live'; art.hidden = m !== 'art'; rows = [...B.querySelectorAll('.b-view:not([hidden]) .b-row')]; mark(m === 'live' && rows.length ? 0 : -1); }
  function mark(i) { active = i; rows.forEach((r, k) => r.classList.toggle('on', k === i)); }

  load().then(async () => {
    const f = await firsts('all', 5);
    $('.b-faq').replaceChildren(...f.map(x => row(x.q, () => answer(askRecord(x.id, x.q), x.q))));
    $('.b-quick').replaceChildren(...QUICK.map(([t, h]) => row(t, () => hooks.home(h.slice(1)))));
    view('home');
  });

  async function suggest() {
    const q = input.value.trim();
    if (!q) { swap(() => view('home')); return; }
    const items = await rank(q, 6);
    if (input.value.trim() !== q) return;
    swap(() => {
      liveList.replaceChildren(...items.slice(0, 5).map(x => { const li = row(x.q, () => answer(askRecord(x.id, x.q), x.q), (() => { const t = el('span', 'b-tag'); const d = el('span', 'b-dot'); d.style.background = DOT_LIGHT[x.topic] || '#999'; t.append(d, KIND[x.topic] || ''); return t; })()); li.querySelector('.b-rt').append(el('span', 'b-sub', preview(x.id))); return li; }));
      const go = el('button', 'b-ask'); go.type = 'button'; go.append(`「${q}」 그대로 물어보기`, Object.assign(el('kbd'), { textContent: 'Enter' })); go.addEventListener('click', () => answer(ask(q), q)); liveList.append(go);
      view('live');
    });
  }
  input.addEventListener('input', suggest);
  input.addEventListener('keydown', e => {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown' && rows.length) { e.preventDefault(); mark((active + 1) % rows.length); }
    else if (e.key === 'ArrowUp' && rows.length) { e.preventDefault(); mark((active - 1 + rows.length) % rows.length); }
    else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0 && rows[active]) rows[active].click(); else if (input.value.trim()) answer(ask(input.value.trim()), input.value.trim()); }
  });

  async function answer(p, q) {
    input.value = q;
    const r = await p;
    swap(() => {
      art.replaceChildren();
      const main = el('div', 'b-main'), side = el('aside', 'b-side');
      const crumb = el('p', 'b-crumb'), dot = el('span', 'b-dot'); dot.style.background = r.found ? (DOT_LIGHT[r.sourceId] || '#999') : '#bbb';
      crumb.append(dot, r.found ? FROM(r.sourceId) : '공개 안내에서 찾지 못했어요');
      const lead = el('p', 'b-lead'); words(lead, r.lead, 12);
      main.append(crumb, lead);
      if (r.body.length) {
        const t = el('div', 'b-text'); t.append(para(r.body[0]));
        if (r.body.length > 1) {
          const rest = el('div'); rest.hidden = true; rest.append(...r.body.slice(1).map(para));
          const more = el('button', 'b-more', '더 읽기'); more.type = 'button'; more.append(icon('arr'));
          more.addEventListener('click', () => swap(() => { rest.hidden = false; more.remove(); }));
          t.append(rest, more);
        }
        main.append(t);
      }
      if (r.action) side.append(linkOut(r.action, 'b-go', hooks));
      if (r.related.length) {
        side.append(el('p', 'b-k', '관련 질문'));
        const ul = el('ul', 'b-list'); r.related.forEach(x => ul.append(row(x.q, () => answer(askRecord(x.id, x.q), x.q)))); side.append(ul);
      }
      const note = el('p', 'b-note'); note.append('찾는 답이 없으면 ', Object.assign(el('a', '', 'hello@synk.im'), { href: 'mailto:hello@synk.im' }), '으로 보내 주세요.'); side.append(note);
      art.append(main, side);
      view('art');
    });
    body.scrollTop = 0;
  }

  const onKey = e => { if (e.key === 'Escape') hooks.close(); };
  $('.b-x').addEventListener('click', () => hooks.close());
  $('.b-veil').addEventListener('click', () => hooks.close());
  return {
    open() { document.addEventListener('keydown', onKey); B.classList.remove('in'); void B.offsetWidth; B.classList.add('in'); if (matchMedia('(pointer:fine)').matches) requestAnimationFrame(() => input.focus({ preventScroll: true })); },
    close() { document.removeEventListener('keydown', onKey); },
    ask(q) { load().then(() => answer(ask(q), q)); },
  };
}
