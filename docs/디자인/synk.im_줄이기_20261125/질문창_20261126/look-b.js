/* 나 · 질문 목록: 자주 묻는 질문 목록의 마지막 줄이 곧 입력칸이다. 적은 질문은 목록에 한 줄로 더해지고 그 자리에서 답이 펼쳐진다.
   줄은 「Q」와 질문 한 줄뿐이고, 답은 상자 없이 문단으로 편다. 답 위에는 어느 안내에서 찾았는지 이름표 하나를 둔다. */
import { STARTERS, ask, askRecord, load } from './ask-core.js';
import { el, para, linkOut } from './ui.js';


export function mount(root, hooks) {
  root.innerHTML = `
  <div class="b-wrap">
    <header class="b-head">
      <h2 id="b-title">무엇이든 물어보세요</h2>
      <p>SYNK가 공개한 안내에서 찾아, 여기서 바로 답합니다.</p>
    </header>
    <ol class="b-list"></ol>
    <form class="b-form" autocomplete="off">
      <label class="sr" for="b-in">질문</label>
      <textarea id="b-in" rows="1" maxlength="500" placeholder="다른 질문을 적어 보세요"></textarea>
      <button type="submit" class="b-go" aria-label="묻기" disabled><span aria-hidden="true">→</span></button>
    </form>
    <footer class="b-foot"><a href="mailto:hello@synk.im">hello@synk.im</a><a href="https://docs.google.com/forms/d/e/1FAIpQLSc4Z1BdhPxMi0bWP7enSganI4xCIsTcCxRJ8EpxiWRxyVfsIg/viewform" target="_blank" rel="noopener">웹 문의 양식 ↗</a><span>문의 접수는 메일과 양식으로 받습니다.</span></footer>
  </div>`;
  const $ = s => root.querySelector(s);
  const list = $('.b-list'), input = $('#b-in'), go = $('.b-go');

  function row(q, load) {
    const li = el('li', 'b-item'), b = el('button', 'b-q'), id = 'b-a' + Math.random().toString(36).slice(2, 8);
    b.type = 'button'; b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', id);
    b.append(el('span', 'b-mark', 'Q'), el('span', 'b-qt', q), el('i', 'b-sign'));
    const ans = el('div', 'b-a'); ans.id = id; ans.hidden = true;
    let ready = false;
    b.addEventListener('click', async () => {
      const open = b.getAttribute('aria-expanded') === 'true';
      list.querySelectorAll('.b-q[aria-expanded="true"]').forEach(x => { if (x !== b) { x.setAttribute('aria-expanded', 'false'); x.nextElementSibling.hidden = true; x.parentElement.classList.remove('open'); } });
      b.setAttribute('aria-expanded', String(!open)); ans.hidden = open; li.classList.toggle('open', !open);
      if (!open && !ready) { ready = true; fill(ans, await load(), li); }
    });
    li.append(b, ans);
    return li;
  }
  function fill(ans, r, li) {
    const text = el('div', 'b-text');
    const chip = el('p', 'b-from b-' + r.sourceId); chip.append(el('span', '', r.found ? `${r.source} 안내에서 찾음` : '맞는 답을 찾지 못함'));
    text.append(chip, el('p', 'b-lead', r.lead), ...r.body.slice(0, 1).map(para));
    if (r.body.length > 1) { const d = el('details', 'b-more'); d.append(el('summary', '', '더 읽기'), ...r.body.slice(1).map(para)); text.append(d); }
    const act = el('div', 'b-act');
    if (r.action) act.append(linkOut(r.action, 'b-btn', hooks));
    r.related.forEach(x => { const b = el('button', 'b-rel'); b.type = 'button'; b.append(el('span', '', x.q), el('span', 'arr', '→')); b.addEventListener('click', () => add(x.q, () => askRecord(x.id, x.q))); act.append(b); });
    ans.append(text);
  }
  function add(q, load) {
    const li = row(q, load); li.classList.add('mine'); li.querySelector('.b-mark').textContent = '나'; list.append(li);
    li.querySelector('.b-q').click();
    hooks.after(li);
  }
  STARTERS.forEach(s => list.append(row(s.q, () => askRecord(s.id, s.q))));
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; go.disabled = !input.value.trim(); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (input.value.trim()) $('.b-form').requestSubmit(); } });
  input.addEventListener('focus', () => load());
  $('.b-form').addEventListener('submit', e => { e.preventDefault(); const q = input.value.trim(); if (!q) return; input.value = ''; input.style.height = 'auto'; go.disabled = true; add(q, () => ask(q)); });
}
