/* 다 · 책장: 질문창이 답하는 곳은 SYNK가 공개한 안내 여덟 묶음이다. 그 묶음을 책장의 책으로 세운다.
   물으면 답이 든 책이 앞으로 나오고, 그 책이 펼쳐져 답을 보인다. 책을 눌러 그 책에서 자주 묻는 것을 고를 수도 있다. */
import { STARTERS, BOOK, ask, askRecord, shelf } from './ask-core.js';
import { el, para, linkOut } from './ui.js';

const BOOKS = [
  ['company', 'SYNK', '회사'],
  ['path', '한국 유학', 'PATH'],
  ['lab', '한국어', 'LAB'],
  ['shift', 'AI 강의', 'SHIFT'],
  ['pulse', '광고', 'PULSE'],
  ['vision', '비전', '회사'],
  ['philosophy', '일하는 방식', '원칙'],
  ['guide', '공개 안내', '이용 · 문의'],
];

export function mount(root, hooks) {
  root.innerHTML = `
  <div class="c-wrap">
    <header class="c-head">
      <h2 id="c-title">무엇이든 물어보세요</h2>
      <p>SYNK가 공개한 안내 여덟 권에서 찾아 답합니다.</p>
    </header>
    <div class="c-room">
      <div class="c-shelf" role="list" aria-label="공개 안내 여덟 권"></div>
      <div class="c-board"></div>
    </div>
    <form class="c-form" autocomplete="off">
      <label class="sr" for="c-in">질문</label>
      <textarea id="c-in" rows="1" maxlength="500" placeholder="궁금한 것을 적어 보세요"></textarea>
      <button type="submit" class="c-go" disabled>찾기</button>
    </form>
    <ul class="c-marks" aria-label="자주 묻는 질문"></ul>
    <footer class="c-foot"><a href="mailto:hello@synk.im">hello@synk.im</a><a href="https://docs.google.com/forms/d/e/1FAIpQLSc4Z1BdhPxMi0bWP7enSganI4xCIsTcCxRJ8EpxiWRxyVfsIg/viewform" target="_blank" rel="noopener">웹 문의 양식 ↗</a><span>문의 접수는 메일과 양식으로 받습니다.</span></footer>
  </div>`;
  const $ = s => root.querySelector(s);
  const shelfEl = $('.c-shelf'), board = $('.c-board'), input = $('#c-in'), go = $('.c-go');
  let data = null;

  BOOKS.forEach(([id, name, sub], i) => {
    const b = el('button', 'c-book c-' + id); b.type = 'button'; b.dataset.book = id; b.setAttribute('role', 'listitem');
    b.style.setProperty('--h', [92, 84, 96, 88, 94, 80, 86, 90][i] + '%');
    b.append(el('span', 'c-name', name), el('span', 'c-sub', sub), el('span', 'c-n'));
    b.addEventListener('click', () => browse(id));
    shelfEl.append(b);
  });
  shelf().then(m => { data = m; shelfEl.querySelectorAll('.c-book').forEach(b => { const d = m.get(b.dataset.book); const n = b.querySelector('.c-n'); n.replaceChildren(el('small', '', '답'), String(d ? d.count : 0)); b.setAttribute('aria-label', `${b.querySelector('.c-name').textContent} — 답 ${d?.count || 0}개`); }); });

  STARTERS.forEach(s => { const b = el('button', 'c-mark', s.q); b.type = 'button'; b.addEventListener('click', () => show(askRecord(s.id, s.q))); const li = el('li'); li.append(b); $('.c-marks').append(li); });

  function pick(id) {
    shelfEl.querySelectorAll('.c-book').forEach(b => b.classList.toggle('out', b.dataset.book === id));
  }
  async function browse(id) {
    pick(id);
    const m = data || await shelf(), d = m.get(id), name = BOOKS.find(b => b[0] === id)[1];
    const page = el('div', 'c-book-open c-' + id + '-open');
    const left = el('section', 'c-page c-left'), right = el('section', 'c-page c-right');
    left.append(el('p', 'c-kick', name), el('h3', 'c-q', d.title.split(' — ')[1] || d.title), (() => { const p = el('p', 'c-count', '이 책의 답 '); p.append(el('b', '', String(d.count)), '개'); return p; })());
    right.append(el('p', 'c-label', '이 책에서 자주 묻는 것'));
    d.first.forEach(x => { const b = el('button', 'c-rel'); b.type = 'button'; b.append(el('span', '', x.q), el('span', 'arr', '→')); b.addEventListener('click', () => show(askRecord(x.id, x.q))); right.append(b); });
    page.append(left, right);
    board.replaceChildren(page);
    hooks.after(board);
  }
  async function show(p) {
    board.classList.add('turning');
    const r = await p;
    pick(r.sourceId);
    const name = BOOKS.find(b => b[0] === r.sourceId)?.[1] || '공개 안내';
    const page = el('div', 'c-book-open c-' + r.sourceId + '-open');
    const left = el('section', 'c-page c-left'), right = el('section', 'c-page c-right');
    left.append(el('p', 'c-kick', r.found ? `「${name}」 책에서 찾음` : '맞는 답을 찾지 못함'), el('h3', 'c-q', r.question), el('p', 'c-lead', r.lead));
    right.append(...r.body.slice(0, 1).map(para));
    if (r.body.length > 1) { const d = el('details', 'c-more'); d.append(el('summary', '', '다음 쪽'), ...r.body.slice(1).map(para)); right.append(d); }
    const act = el('div', 'c-act');
    if (r.action) act.append(linkOut(r.action, 'c-btn', hooks));
    right.append(act);
    if (r.related.length) { right.append(el('p', 'c-label', '이어서')); r.related.forEach(x => { const b = el('button', 'c-rel'); b.type = 'button'; b.append(el('span', '', x.q), el('span', 'arr', '→')); b.addEventListener('click', () => show(askRecord(x.id, x.q))); right.append(b); }); }
    page.append(left, right);
    board.replaceChildren(page);
    requestAnimationFrame(() => board.classList.remove('turning'));
    hooks.after(board);
  }
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; go.disabled = !input.value.trim(); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (input.value.trim()) $('.c-form').requestSubmit(); } });
  $('.c-form').addEventListener('submit', e => { e.preventDefault(); const q = input.value.trim(); if (!q) return; input.value = ''; input.style.height = 'auto'; go.disabled = true; show(ask(q)); });
}
