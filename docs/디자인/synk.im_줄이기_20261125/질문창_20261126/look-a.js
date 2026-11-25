/* 가 · 강의장: 적은 질문이 강의장 큰 화면에 뜨고, 강사가 그 화면을 가리킨다. 답 첫 문장도 화면에 뜨고 나머지는 아래에 이어진다. */
import { STARTERS, ask, askRecord, load } from './ask-core.js';
import { el, para, linkOut } from './ui.js';

export function mount(root, hooks) {
  root.innerHTML = `
  <div class="a-top"><div class="a-stage"><div class="a-frame">
    <img class="a-hall" src="a/hall-wide.webp" width="1536" height="1024" alt="강사가 청중을 보며 큰 화면을 가리키는 강의장">
    <div class="a-screen" aria-live="polite">
      <p class="a-kicker"><span>Q</span><span class="a-time"></span><span class="a-book"></span></p>
      <p class="a-q"><span class="a-qt">무엇이든 물어보세요</span><i class="a-caret" aria-hidden="true"></i></p>
      <p class="a-lead"></p>
    </div>
    <button type="button" class="a-cue" hidden>답 이어 읽기 <span aria-hidden="true">↓</span></button>
  </div></div>
    <div class="a-left">
      <h2 class="a-title" id="a-title">무엇이든<br>물어보세요</h2>
      <form class="a-form" autocomplete="off">
        <label class="sr" for="a-in">질문</label>
        <textarea id="a-in" rows="1" maxlength="500" placeholder="질문을 적으면 화면에 뜹니다"></textarea>
        <button type="submit" class="a-send" disabled>묻기</button>
      </form>
      <ul class="a-starters" aria-label="자주 묻는 질문"></ul>
    </div>
  </div>
  <article class="a-rest" hidden>
    <div class="a-body"></div>
    <div class="a-do"></div>
    <div class="a-next"></div>
  </article>
  <footer class="a-foot"><a href="mailto:hello@synk.im">hello@synk.im</a><a href="https://docs.google.com/forms/d/e/1FAIpQLSc4Z1BdhPxMi0bWP7enSganI4xCIsTcCxRJ8EpxiWRxyVfsIg/viewform" target="_blank" rel="noopener">웹 문의 양식 ↗</a><span>이 창은 공개 안내만 찾아 답합니다. 문의 접수는 메일과 양식으로 받습니다.</span></footer>`;

  const $ = s => root.querySelector(s);
  const input = $('#a-in'), send = $('.a-send'), qt = $('.a-qt'), lead = $('.a-lead'), screen = $('.a-screen');
  const rest = $('.a-rest');
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const stamp = () => { $('.a-time').textContent = clock.format(new Date()) + ' SEOUL'; };
  stamp();
  STARTERS.forEach(s => {
    const b = el('button', 'a-st', s.q); b.type = 'button';
    b.addEventListener('click', () => show(askRecord(s.id, s.q), s.q, b));
    const li = el('li'); li.append(b); $('.a-starters').append(li);
  });
  /* 적는 동안 화면에 그대로 뜬다 */
  input.addEventListener('input', () => {
    input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 132) + 'px';
    send.disabled = !input.value.trim();
    if (!root.dataset.busy) { screen.classList.toggle('typing', !!input.value); qt.textContent = input.value || '무엇이든 물어보세요'; if (input.value) lead.textContent = ''; }
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (input.value.trim()) $('.a-form').requestSubmit(); } });
  $('.a-form').addEventListener('submit', e => { e.preventDefault(); const q = input.value.trim(); if (q) show(ask(q), q, null, true); });
  input.addEventListener('focus', () => load());

  async function show(p, q, btn, typed) {
    root.dataset.busy = '1'; send.disabled = true;
    root.querySelectorAll('.a-st').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    screen.classList.remove('typing'); screen.classList.add('swap');
    qt.textContent = q; lead.textContent = ''; $('.a-book').textContent = ''; stamp();
    const r = await p;
    await new Promise(res => setTimeout(res, 180));
    screen.classList.remove('swap');
    /* 큰 화면에는 답의 첫 문장이 뜨고, 아래는 그다음 문장부터 이어진다 */
    lead.textContent = r.lead;
    $('.a-book').textContent = r.found ? r.source : '';
    $('.a-body').replaceChildren(...r.body.slice(0, 1).map(t => { const p = para(t); p.className = 'a-leadp'; return p; }));
    if (r.body.length > 1) {
      const d = el('details', 'a-more'), s = el('summary', '', '더 읽기');
      d.append(s, ...r.body.slice(1).map(t => para(t))); $('.a-body').append(d);
    }
    $('.a-do').replaceChildren(...(r.action ? [linkOut(r.action, 'a-act', hooks)] : []));
    const next = $('.a-next'); next.replaceChildren();
    if (r.related.length) {
      next.append(el('p', 'a-label', '이어서 물어보기'));
      r.related.forEach(x => { const b = el('button', 'a-rel', x.q); b.type = 'button'; b.addEventListener('click', () => show(askRecord(x.id, x.q), x.q)); next.append(b); });
    }
    rest.hidden = false; $('.a-cue').hidden = false;
    if (typed) { input.value = ''; input.style.height = 'auto'; }
    delete root.dataset.busy;
    /* 넓은 화면은 큰 화면 속 답을 그대로 두고, 좁은 화면은 화면이 보이는 자리로 올린다 */
    if (innerWidth <= 860) hooks.after($('.a-stage'));
  }
  $('.a-cue').addEventListener('click', () => hooks.after(rest, true));
}
