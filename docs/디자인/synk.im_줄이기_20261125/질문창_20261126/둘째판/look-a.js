/* 가 · 고객센터: 흰 판 하나. 맨 위에 찾기 줄 하나, 그 아래 주제 글자 탭과 질문 줄. 적는 동안 맞는 질문이 바로 아래 뜬다.
   답은 목록 자리에서 글 한 편으로 열린다(제목 · 첫 문장 · 이어지는 문단 · 행동 · 함께 묻는 질문). 그림과 상자 없이 글자 · 여백 · 가는 선만 쓴다. */
import { STARTERS, BOOK, ask, askRecord, rank, byBook } from './ask-core.js';
import { el, para } from './ui.js';

const TABS = [['all', '전체'], ['path', '한국 유학'], ['shift', 'AI 강의'], ['pulse', '광고'], ['company', '회사'], ['guide', '이용 안내']];
const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSc4Z1BdhPxMi0bWP7enSganI4xCIsTcCxRJ8EpxiWRxyVfsIg/viewform';

export function mount(root, hooks) {
  root.innerHTML = `
  <div class="a-scrim"></div>
  <div class="a-sheet" role="dialog" aria-modal="true" aria-labelledby="a-t">
    <button class="a-x" type="button" aria-label="닫기"></button>
    <div class="a-in">
      <header class="a-head">
        <p class="a-eye">SYNK 안내</p>
        <h2 id="a-t">무엇이든 물어보세요</h2>
      </header>
      <form class="a-search" autocomplete="off" role="search">
        <svg class="a-ico" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.75"/><path d="m13 13 4.5 4.5"/></svg>
        <label class="sr" for="a-in">질문</label>
        <input id="a-in" type="text" maxlength="200" placeholder="궁금한 것을 적어 보세요" role="combobox" aria-expanded="false" aria-controls="a-sug" aria-autocomplete="list">
        <kbd class="a-enter" aria-hidden="true">Enter ↵</kbd>
        <ul class="a-sug" id="a-sug" role="listbox" aria-label="맞는 질문" hidden></ul>
      </form>
      <div class="a-view">
        <div class="a-browse">
          <div class="a-tabs" role="tablist" aria-label="주제"></div>
          <ol class="a-list"></ol>
        </div>
        <article class="a-doc" hidden></article>
      </div>
      <footer class="a-foot">
        <p>찾는 답이 없으면 <a href="mailto:hello@synk.im">hello@synk.im</a> 또는 <a href="${FORM}" target="_blank" rel="noopener">웹 문의 양식 ↗</a>으로 보내 주세요.</p>
        <p class="a-note">이 창은 공개한 안내만 찾아 답합니다. 대화는 저장하지 않습니다.</p>
      </footer>
    </div>
  </div>`;
  const $ = s => root.querySelector(s);
  const sheet = $('.a-sheet'), input = $('#a-in'), sug = $('#a-sug'), list = $('.a-list'), doc = $('.a-doc'), browse = $('.a-browse');
  let tab = 'all', pick = -1, items = [], back = null;

  /* 주제 탭 */
  TABS.forEach(([id, name]) => {
    const b = el('button', 'a-tab', name); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.tab = id; b.setAttribute('aria-selected', String(id === tab));
    b.addEventListener('click', () => setTab(id)); $('.a-tabs').append(b);
  });
  async function setTab(id) {
    tab = id;
    root.querySelectorAll('.a-tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    const rows = id === 'all' ? STARTERS.map(s => ({ id: s.id, q: s.q })) : await byBook(id, 7);
    list.replaceChildren(...rows.map(r => row(r.q, () => open(askRecord(r.id, r.q), r.q))));
    showList();
  }
  function row(text, go) {
    const b = el('button', 'a-row'); b.type = 'button';
    b.append(el('span', 'a-q', text), el('span', 'a-arr', '→'));
    b.querySelector('.a-arr').setAttribute('aria-hidden', 'true');
    b.addEventListener('click', go);
    const li = el('li'); li.append(b); return li;
  }
  function showList() { doc.hidden = true; browse.hidden = false; }

  /* 적는 동안 맞는 질문 */
  let t = 0;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      const v = input.value.trim();
      items = v ? await rank(v, 5) : [];
      pick = -1;
      sug.replaceChildren(...items.map((x, i) => {
        const li = el('li', 'a-opt'); li.id = 'a-o' + i; li.setAttribute('role', 'option');
        li.append(el('span', '', x.q), el('span', 'a-tag', TABNAME(x.topic)));
        li.addEventListener('mousedown', e => { e.preventDefault(); choose(i); });
        return li;
      }));
      const on = items.length > 0;
      sug.hidden = !on; input.setAttribute('aria-expanded', String(on));
    }, 90);
  });
  const TABNAME = id => (TABS.find(x => x[0] === id) || [0, BOOK[id] ? BOOK[id].split(' · ').pop() : ''])[1];
  function mark(i) {
    pick = i; sug.querySelectorAll('.a-opt').forEach((o, k) => o.setAttribute('aria-selected', String(k === i)));
    if (i >= 0) input.setAttribute('aria-activedescendant', 'a-o' + i); else input.removeAttribute('aria-activedescendant');
  }
  function choose(i) { const x = items[i]; closeSug(); open(askRecord(x.id, x.q), x.q); input.value = ''; }
  function closeSug() { sug.hidden = true; input.setAttribute('aria-expanded', 'false'); mark(-1); }
  input.addEventListener('keydown', e => {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); mark((pick + 1) % items.length); }
    else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); mark((pick - 1 + items.length) % items.length); }
    else if (e.key === 'Escape' && !sug.hidden) { e.stopPropagation(); closeSug(); }
  });
  input.addEventListener('blur', () => setTimeout(closeSug, 120));
  $('.a-search').addEventListener('submit', e => {
    e.preventDefault();
    if (pick >= 0) return choose(pick);
    const q = input.value.trim(); if (!q) return;
    closeSug(); input.value = ''; open(ask(q), q);
  });

  /* 답 한 편 */
  async function open(p, q) {
    back = document.activeElement;
    const r = await p;
    const head = el('div', 'a-dhead');
    const bk = el('button', 'a-back', '← 목록'); bk.type = 'button'; bk.addEventListener('click', () => { showList(); (back && back.isConnected ? back : list.querySelector('.a-row'))?.focus(); });
    head.append(bk, el('span', 'a-src', r.found ? r.source : '공개 안내'));
    const h = el('h3', 'a-dq', r.question); h.tabIndex = -1;
    const body = el('div', 'a-dbody');
    body.append(el('p', 'a-lead', r.lead), ...r.body.slice(0, 1).map(para));
    if (r.body.length > 1) { const d = el('details', 'a-more'); d.append(el('summary', '', `더 읽기 (${r.body.length - 1})`), ...r.body.slice(1).map(para)); body.append(d); }
    const act = el('div', 'a-act');
    if (r.action) { const a = el('a', 'a-btn'); a.href = r.action.href.startsWith('/#') ? '#' : r.action.href; if (!r.action.href.startsWith('/#')) { a.target = '_blank'; a.rel = 'noopener'; } else a.addEventListener('click', e => { e.preventDefault(); hooks.close(); }); a.append(el('span', '', r.action.label), el('span', '', ' →')); act.append(a); }
    const rel = el('div', 'a-rel');
    if (r.related.length) { rel.append(el('p', 'a-label', '함께 많이 묻는 질문')); const ol = el('ol'); r.related.forEach(x => ol.append(row(x.q, () => open(askRecord(x.id, x.q), x.q)))); rel.append(ol); }
    doc.replaceChildren(head, h, body, act, rel);
    browse.hidden = true; doc.hidden = false;
    $('.a-in').scrollTop = 0; sheet.scrollTop = 0;
    h.focus({ preventScroll: true });
  }

  const onKey = e => { if (e.key === 'Escape') hooks.close(); };
  $('.a-x').addEventListener('click', () => hooks.close());
  $('.a-scrim').addEventListener('click', () => hooks.close());
  setTab('all');
  return {
    open() { document.addEventListener('keydown', onKey); showList(); requestAnimationFrame(() => input.focus({ preventScroll: true })); },
    close() { document.removeEventListener('keydown', onKey); },
  };
}
