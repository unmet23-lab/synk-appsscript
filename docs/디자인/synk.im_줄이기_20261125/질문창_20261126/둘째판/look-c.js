/* 다 · 옆 창: 홈을 덮지 않고 오른쪽에서 창이 나온다. 물음과 답이 위에서 아래로 쌓이고, 입력칸은 늘 맨 아래다.
   답마다 어느 안내에서 찾았는지 한 줄로 먼저 적고, 창 맨 위의 가는 띠가 그 사업의 색으로 바뀐다. */
import { STARTERS, ask, askRecord } from './ask-core.js';
import { el, para } from './ui.js';

const COLOR = { path: '#7f98c9', lab: '#8ea052', shift: '#1d1d1f', pulse: '#5f6b78', company: '#f96859', guide: '#a89c86', vision: '#3b4a6b', philosophy: '#c2a56c' };

export function mount(root, hooks) {
  root.innerHTML = `
  <div class="c-scrim"></div>
  <aside class="c-panel" role="dialog" aria-modal="true" aria-labelledby="c-t">
    <header class="c-top">
      <i class="c-band" aria-hidden="true"></i>
      <h2 id="c-t">묻기</h2>
      <span class="c-ctx">SYNK 공개 안내</span>
      <button class="c-x" type="button" aria-label="닫기"></button>
    </header>
    <div class="c-thread">
      <div class="c-intro">
        <p class="c-big">무엇이든 물어보세요.</p>
        <p class="c-sub">SYNK가 공개한 안내에서 찾아 바로 답합니다. 상담과 제안은 <a href="mailto:hello@synk.im">hello@synk.im</a>으로 받습니다.</p>
        <p class="c-h">자주 묻는 질문</p>
        <ul class="c-start"></ul>
      </div>
      <div class="c-turns" aria-live="polite"></div>
    </div>
    <form class="c-ask" autocomplete="off">
      <label class="sr" for="c-in">질문</label>
      <textarea id="c-in" rows="1" maxlength="500" placeholder="질문을 적어 보세요"></textarea>
      <button type="submit" class="c-send" aria-label="묻기" disabled><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 16V4M5 9l5-5 5 5"/></svg></button>
    </form>
    <p class="c-note">대화는 저장하지 않습니다. 개인정보는 적지 말아 주세요.</p>
  </aside>`;
  const $ = s => root.querySelector(s);
  const panel = $('.c-panel'), thread = $('.c-thread'), turns = $('.c-turns'), input = $('#c-in'), send = $('.c-send');

  STARTERS.slice(0, 5).forEach(s => {
    const b = el('button', 'c-row'); b.type = 'button'; b.append(el('span', '', s.q), el('span', 'c-arr', '→'));
    b.querySelector('.c-arr').setAttribute('aria-hidden', 'true');
    b.addEventListener('click', () => turn(askRecord(s.id, s.q), s.q));
    const li = el('li'); li.append(b); $('.c-start').append(li);
  });

  async function turn(p, q) {
    const t = el('section', 'c-turn');
    t.append(el('p', 'c-me', q));
    const a = el('div', 'c-a c-wait'); a.append(el('p', 'c-from', '찾는 중'));
    t.append(a); turns.append(t);
    t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    const r = await p;
    const from = el('p', 'c-from');
    const dot = el('i', 'c-dot'); dot.style.background = COLOR[r.sourceId] || COLOR.guide; dot.setAttribute('aria-hidden', 'true');
    from.append(dot, el('span', '', r.found ? `${r.source}에서 찾음` : '맞는 답을 찾지 못했어요'));
    const body = el('div', 'c-body'); body.append(el('p', 'c-lead', r.lead), ...r.body.slice(0, 1).map(para));
    if (r.body.length > 1) { const d = el('details', 'c-more'); d.append(el('summary', '', `더 읽기 (${r.body.length - 1})`), ...r.body.slice(1).map(para)); body.append(d); }
    const kids = [from, body];
    if (r.action) {
      const go = el('a', 'c-go'); go.append(el('span', '', r.action.label), el('span', '', ' →'));
      if (r.action.href.startsWith('/#')) { go.href = '#'; go.addEventListener('click', e => { e.preventDefault(); hooks.close(); }); } else { go.href = r.action.href; go.target = '_blank'; go.rel = 'noopener'; }
      kids.push(go);
    }
    if (r.related.length) {
      const f = el('div', 'c-follow');
      r.related.forEach(x => { const b = el('button', 'c-chip', x.q); b.type = 'button'; b.addEventListener('click', () => turn(askRecord(x.id, x.q), x.q)); f.append(b); });
      kids.push(f);
    }
    a.classList.remove('c-wait'); a.replaceChildren(...kids);
    /* 창 맨 위 띠와 이름이 지금 답의 사업으로 바뀐다 */
    panel.style.setProperty('--band', COLOR[r.sourceId] || COLOR.guide);
    $('.c-ctx').textContent = r.found ? r.source : 'SYNK 공개 안내';
  }

  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; send.disabled = !input.value.trim(); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (input.value.trim()) $('.c-ask').requestSubmit(); } });
  $('.c-ask').addEventListener('submit', e => { e.preventDefault(); const q = input.value.trim(); if (!q) return; input.value = ''; input.style.height = 'auto'; send.disabled = true; turn(ask(q), q); });
  const onKey = e => { if (e.key === 'Escape') hooks.close(); };
  $('.c-x').addEventListener('click', () => hooks.close());
  $('.c-scrim').addEventListener('click', () => hooks.close());
  return {
    open() { document.addEventListener('keydown', onKey); if (matchMedia('(pointer:fine)').matches) requestAnimationFrame(() => input.focus({ preventScroll: true })); },
    close() { document.removeEventListener('keydown', onKey); },
  };
}
