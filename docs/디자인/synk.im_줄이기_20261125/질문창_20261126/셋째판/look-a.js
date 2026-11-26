/* 가 흰 입력창 — ChatGPT · Perplexity · Claude의 첫 화면 짜임. 가늘고 큰 제목 하나, 입력 판 하나, 판 안의 사업 고르기.
   물으면 대화처럼 쌓이고 입력 판은 아래로 내려가 붙는다. */
import { ask, askRecord, rank, firsts, scopeCounts, load } from './ask-core.js';
import { el, para, words, linkOut, icon, DOT_LIGHT, KIND, FROM } from './ui.js';

const SCOPE_NAMES = [['all', '전체'], ['study', '한국 유학'], ['ai', 'AI 강의'], ['ads', '광고'], ['company', '회사']];

export function mount(root, hooks) {
  root.innerHTML = `
  <section class="A" role="dialog" aria-modal="true" aria-labelledby="a-t">
    <header class="a-top"><span class="a-logo">synk</span><button type="button" class="a-x" aria-label="닫기"></button></header>
    <div class="a-scroll">
      <div class="a-hero"><h2 id="a-t">무엇이든 물어보세요</h2><p class="a-sub">synk.im에 공개한 안내에서 찾아 바로 답합니다.</p></div>
      <ol class="a-thread" aria-live="polite"></ol>
    </div>
    <div class="a-dock">
      <form class="a-box" autocomplete="off">
        <label class="sr" for="a-in">질문</label>
        <textarea id="a-in" rows="1" enterkeyhint="send" role="combobox" aria-expanded="false" aria-controls="a-sug" aria-autocomplete="list"></textarea>
        <ul class="a-sug" id="a-sug" role="listbox" aria-label="맞는 질문" hidden></ul>
        <div class="a-row">
          <div class="a-scope" role="radiogroup" aria-label="어느 사업에서 찾을까요"></div>
          <button type="submit" class="a-send" aria-label="보내기" disabled></button>
        </div>
      </form>
      <div class="a-chips" aria-label="자주 묻는 질문"></div>
      <p class="a-fine">대화는 저장하지 않습니다. 개인정보는 적지 말아 주세요.</p>
    </div>
  </section>`;
  const $ = s => root.querySelector(s);
  const A = $('.A'), input = $('#a-in'), sug = $('#a-sug'), send = $('.a-send'), thread = $('.a-thread'), scroll = $('.a-scroll'), chips = $('.a-chips'), scopeBox = $('.a-scope');
  $('.a-x').append(icon('x')); send.append(icon('up'));
  let scope = 'all', items = [], active = -1, ph = [], phi = 0, phTimer = 0;

  /* 사업 고르기: Perplexity 입력 판 아래 줄의 갈래 단추 자리 */
  SCOPE_NAMES.forEach(([k, name]) => {
    const b = el('button', '', name); b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.k = k; b.setAttribute('aria-checked', String(k === scope));
    b.addEventListener('click', () => setScope(k)); scopeBox.append(b);
  });
  scopeCounts().then(c => scopeBox.querySelectorAll('button').forEach(b => b.title = `공개 안내 ${c[b.dataset.k]}개`));

  async function setScope(k) {
    scope = k;
    scopeBox.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.k === k)));
    const f = await firsts(k, 4);
    ph = []; tickPh();
    chips.replaceChildren(...f.map(x => { const c = el('button', 'a-chip', x.q); c.type = 'button'; c.addEventListener('click', () => go(askRecord(x.id, x.q), x.q)); return c; }));
    if (input.value.trim()) suggest();
    input.focus({ preventScroll: true });
  }
  /* 입력 판 안의 예시 질문이 바뀐다(Fin의 판 안 예시) */
  function tickPh() { input.placeholder = A.classList.contains('has-thread') ? '이어서 물어보세요' : scope === 'all' ? '궁금한 것을 적어 보세요' : `${SCOPE_NAMES.find(s => s[0] === scope)[1]}에 대해 물어보세요`; }
  function startPh() { clearInterval(phTimer); phTimer = setInterval(() => { if (!input.value && document.activeElement !== input) { phi++; tickPh(); } }, 3200); }

  function grow() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 168) + 'px'; }
  async function suggest() {
    const q = input.value.trim();
    items = q ? await rank(q, 5, scope) : [];
    if (input.value.trim() !== q) return;
    active = items.length ? 0 : -1;
    sug.replaceChildren(...items.map((x, i) => {
      const li = el('li', 'a-opt'); li.id = 'a-o' + i; li.setAttribute('role', 'option');
      const dot = el('span', 'a-dot'); dot.style.background = DOT_LIGHT[x.topic] || '#999';
      li.append(el('span', 'a-oq', x.q), dot, el('span', 'a-ob', KIND[x.topic] || ''));
      li.addEventListener('mousedown', e => { e.preventDefault(); pick(i); });
      li.addEventListener('mousemove', () => mark(i));
      return li;
    }));
    sug.hidden = !items.length; input.setAttribute('aria-expanded', String(!sug.hidden)); mark(active);
  }
  function mark(i) {
    active = i;
    sug.querySelectorAll('.a-opt').forEach((o, k) => o.setAttribute('aria-selected', String(k === i)));
    if (i >= 0) input.setAttribute('aria-activedescendant', 'a-o' + i); else input.removeAttribute('aria-activedescendant');
  }
  function pick(i) { const x = items[i]; clear(); go(askRecord(x.id, x.q), x.q); }
  function clear() { input.value = ''; grow(); sug.hidden = true; items = []; input.setAttribute('aria-expanded', 'false'); send.disabled = true; }

  input.addEventListener('input', () => { grow(); send.disabled = !input.value.trim(); suggest(); });
  input.addEventListener('keydown', e => {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); mark((active + 1) % items.length); }
    else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); mark((active - 1 + items.length) % items.length); }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sug.hidden && active >= 0) pick(active); else if (input.value.trim()) $('.a-box').requestSubmit(); }
    else if (e.key === 'Escape' && !sug.hidden) { e.stopPropagation(); sug.hidden = true; input.setAttribute('aria-expanded', 'false'); }
  });
  input.addEventListener('blur', () => setTimeout(() => { sug.hidden = true; }, 120));
  input.addEventListener('focus', () => { if (input.value.trim()) suggest(); });
  $('.a-box').addEventListener('submit', e => { e.preventDefault(); const q = input.value.trim(); if (!q) return; clear(); go(ask(q), q); });

  /* 한 번 묻고 답하기 */
  async function go(p, q) {
    A.classList.add('has-thread'); tickPh();
    const li = el('li', 'a-turn'), you = el('p', 'a-q', q), ans = el('div', 'a-ans a-wait');
    ans.append(el('span', 'a-think', '공개 안내에서 찾는 중'));
    li.append(you, ans); thread.append(li);
    requestAnimationFrame(() => scroll.scrollTo({ top: li.offsetTop - 24, behavior: 'smooth' }));
    const r = await p;
    await new Promise(res => setTimeout(res, 260));
    ans.classList.remove('a-wait'); ans.replaceChildren();
    const src = el('p', 'a-src'), dot = el('span', 'a-dot'); dot.style.background = r.found ? (DOT_LIGHT[r.sourceId] || '#999') : '#bbb';
    src.append(dot, el('span', '', r.found ? FROM(r.sourceId) : '공개 안내에서 찾지 못했어요'));
    const lead = el('p', 'a-lead'); words(lead, r.lead);
    ans.append(src, lead);
    if (r.body.length) {
      const body = el('div', 'a-body'); body.append(para(r.body[0]));
      if (r.body.length > 1) {
        const rest = el('div', 'a-rest'); rest.hidden = true; rest.append(...r.body.slice(1).map(para));
        const more = el('button', 'a-more', `더 보기 · ${r.body.length - 1}`); more.type = 'button';
        more.addEventListener('click', () => { rest.hidden = false; more.remove(); });
        body.append(rest, more);
      }
      ans.append(body);
    }
    const acts = el('div', 'a-acts');
    if (r.action) acts.append(linkOut(r.action, 'a-go', hooks));
    const cp = el('button', 'a-tool'); cp.type = 'button'; cp.append(icon('copy'), el('span', '', '복사'));
    cp.addEventListener('click', () => { navigator.clipboard?.writeText([r.lead, ...r.body].join('\n\n')); cp.lastChild.textContent = '복사함'; setTimeout(() => cp.lastChild.textContent = '복사', 1600); });
    acts.append(cp); ans.append(acts);
    if (r.related.length) {
      const rel = el('div', 'a-rel'); rel.append(el('p', 'a-k', '이어서 물어보기'));
      r.related.forEach(x => { const b = el('button', 'a-rq'); b.type = 'button'; b.append(el('span', '', x.q), icon('plus')); b.addEventListener('click', () => go(askRecord(x.id, x.q), x.q)); rel.append(b); });
      ans.append(rel);
    }
  }

  const onKey = e => { if (e.key === 'Escape') hooks.close(); };
  $('.a-x').addEventListener('click', () => hooks.close());
  load().then(() => setScope('all'));
  return {
    open() { document.addEventListener('keydown', onKey); startPh(); A.classList.remove('in'); void A.offsetWidth; A.classList.add('in'); if (matchMedia('(pointer:fine)').matches) requestAnimationFrame(() => input.focus({ preventScroll: true })); },
    close() { document.removeEventListener('keydown', onKey); clearInterval(phTimer); },
    ask(q) { go(ask(q), q); },
  };
}
