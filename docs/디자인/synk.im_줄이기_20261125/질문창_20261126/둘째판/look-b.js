/* 나 · 명령창: 홈 위에 뜨는 어두운 창 하나. 적는 동안 맞는 질문이 줄로 바뀌고, 방향키와 Enter로 고른다.
   사업 줄을 고르면 그 사업의 질문만 보인다. 답은 같은 창 안에서 열리고 Esc나 「뒤로」로 목록에 돌아간다. */
import { STARTERS, BOOK, ask, askRecord, rank, byBook, counts } from './ask-core.js';
import { el, para } from './ui.js';

const BIZ = [['path', '한국 유학', 'PATH'], ['shift', 'AI 강의', 'SHIFT'], ['pulse', '광고', 'PULSE'], ['lab', '한국어', 'LAB'], ['company', '회사', 'SYNK'], ['guide', '이용 안내', '문의 · 개인정보']];
const NAME = id => (BIZ.find(b => b[0] === id) || [0, BOOK[id] || '공개 안내'])[1];

export function mount(root, hooks) {
  root.innerHTML = `
  <div class="b-scrim"></div>
  <div class="b-pal" role="dialog" aria-modal="true" aria-label="무엇이든 물어보세요">
    <form class="b-bar" autocomplete="off">
      <svg class="b-ico" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.75"/><path d="m13 13 4.5 4.5"/></svg>
      <span class="b-scope" hidden></span>
      <label class="sr" for="b-in">질문</label>
      <input id="b-in" type="text" maxlength="200" placeholder="무엇이든 물어보세요" role="combobox" aria-expanded="true" aria-controls="b-list" aria-autocomplete="list">
      <button type="button" class="b-esc" aria-label="닫기"><kbd>esc</kbd></button>
    </form>
    <div class="b-body">
      <div class="b-list" id="b-list" role="listbox" aria-label="질문"></div>
      <article class="b-ans" hidden aria-live="polite"></article>
    </div>
    <footer class="b-foot">
      <span><kbd>↑</kbd><kbd>↓</kbd> 고르기</span><span><kbd>↵</kbd> 열기</span><span class="b-k-back" hidden><kbd>esc</kbd> 뒤로</span>
      <a class="b-mail" href="mailto:hello@synk.im">hello@synk.im</a>
    </footer>
  </div>`;
  const $ = s => root.querySelector(s);
  const input = $('#b-in'), list = $('.b-list'), ans = $('.b-ans'), scope = $('.b-scope');
  let opts = [], act = -1, sc = null, n = {}, view = 'list', seq = 0;
  counts().then(c => { n = c; if (view === 'list' && !input.value) draw(); });

  function sect(title) { const s = el('div', 'b-sect'); s.append(el('p', 'b-h', title)); list.append(s); return s; }
  function opt(parent, { text, sub, dot, run }) {
    const o = el('div', 'b-opt'); o.setAttribute('role', 'option'); o.id = 'b-o' + opts.length;
    if (dot) { const d = el('i', 'b-dot d-' + dot); d.setAttribute('aria-hidden', 'true'); o.append(d); }
    o.append(el('span', 'b-t', text)); if (sub) o.append(el('span', 'b-s', sub));
    const i = opts.length; o.addEventListener('mousemove', () => mark(i)); o.addEventListener('click', run);
    opts.push({ o, run }); parent.append(o); return o;
  }
  function mark(i) {
    act = i; opts.forEach((x, k) => x.o.setAttribute('aria-selected', String(k === i)));
    if (i >= 0) { input.setAttribute('aria-activedescendant', opts[i].o.id); opts[i].o.scrollIntoView({ block: 'nearest' }); }
  }
  async function draw() {
    const my = ++seq, v = input.value.trim();
    const rows = v ? await rank(v, 7) : sc ? await byBook(sc, 12) : null;
    if (my !== seq) return;
    list.replaceChildren(); opts = [];
    if (v) {
      const s = sect(rows.length ? '맞는 질문' : '맞는 질문이 아직 없어요');
      rows.forEach(r => opt(s, { text: r.q, sub: NAME(r.topic), run: () => open(askRecord(r.id, r.q), r.q) }));
      const f = sect('직접 묻기');
      opt(f, { text: `「${v}」 물어보기`, sub: '↵', run: () => open(ask(v), v) });
    } else if (sc) {
      const s = sect(`${NAME(sc)} — 질문 ${n[sc] || rows.length}개`);
      rows.forEach(r => opt(s, { text: r.q, run: () => open(askRecord(r.id, r.q), r.q) }));
    } else {
      const s = sect('자주 묻는 질문');
      STARTERS.forEach(x => opt(s, { text: x.q, run: () => open(askRecord(x.id, x.q), x.q) }));
      const b = sect('사업별로 보기');
      BIZ.forEach(([id, name, code]) => opt(b, { text: name, sub: `${code}${n[id] ? ' · ' + n[id] : ''}`, dot: id, run: () => setScope(id) }));
    }
    mark(opts.length ? 0 : -1);
  }
  function setScope(id) {
    sc = id; scope.hidden = !id; scope.textContent = id ? NAME(id) : '';
    input.placeholder = id ? `${NAME(id)}에서 찾기` : '무엇이든 물어보세요';
    input.value = ''; draw(); input.focus();
  }

  async function open(p, q) {
    const r = await p;
    view = 'ans'; list.hidden = true; ans.hidden = false; $('.b-k-back').hidden = false;
    const crumb = el('p', 'b-crumb');
    const d = el('i', 'b-dot d-' + (r.sourceId || 'guide')); d.setAttribute('aria-hidden', 'true');
    crumb.append(d, el('span', '', r.found ? r.source : '공개 안내'));
    const back = el('button', 'b-back', '← 뒤로'); back.type = 'button'; back.addEventListener('click', toList);
    const top = el('div', 'b-atop'); top.append(crumb, back);
    const body = el('div', 'b-abody'); body.append(el('p', 'b-lead', r.lead), ...r.body.slice(0, 1).map(para));
    if (r.body.length > 1) { const dd = el('details', 'b-more'); dd.append(el('summary', '', `더 읽기 (${r.body.length - 1})`), ...r.body.slice(1).map(para)); body.append(dd); }
    const nodes = [top, el('h3', 'b-q', q), body];
    if (r.action) {
      const a = el('a', 'b-go'); a.append(el('span', '', r.action.label), el('span', 'b-goarr', r.action.href.startsWith('/#') ? '→' : '↗'));
      if (r.action.href.startsWith('/#')) { a.href = '#'; a.addEventListener('click', e => { e.preventDefault(); hooks.close(); }); } else { a.href = r.action.href; a.target = '_blank'; a.rel = 'noopener'; }
      nodes.push(a);
    }
    if (r.related.length) {
      const rel = el('div', 'b-rel'); rel.append(el('p', 'b-h', '이어서'));
      r.related.forEach(x => { const b = el('button', 'b-relq'); b.type = 'button'; b.append(el('span', '', x.q), el('span', 'b-s', '→')); b.addEventListener('click', () => open(askRecord(x.id, x.q), x.q)); rel.append(b); });
      nodes.push(rel);
    }
    ans.replaceChildren(...nodes); $('.b-body').scrollTop = 0;
    input.value = ''; input.placeholder = '이어서 물어보세요';
  }
  function toList() { view = 'list'; ans.hidden = true; list.hidden = false; $('.b-k-back').hidden = true; input.placeholder = sc ? `${NAME(sc)}에서 찾기` : '무엇이든 물어보세요'; draw(); input.focus(); }

  let t = 0;
  input.addEventListener('input', () => { if (view === 'ans' && input.value) { view = 'list'; ans.hidden = true; list.hidden = false; $('.b-k-back').hidden = true; } clearTimeout(t); t = setTimeout(draw, 70); });
  input.addEventListener('keydown', e => {
    if (e.isComposing) return;
    if (view === 'list' && e.key === 'ArrowDown' && opts.length) { e.preventDefault(); mark((act + 1) % opts.length); }
    else if (view === 'list' && e.key === 'ArrowUp' && opts.length) { e.preventDefault(); mark((act - 1 + opts.length) % opts.length); }
    else if (e.key === 'Backspace' && !input.value && sc && view === 'list') { setScope(null); }
  });
  $('.b-bar').addEventListener('submit', e => {
    e.preventDefault();
    const v = input.value.trim();
    if (view === 'list' && act >= 0 && opts[act]) return opts[act].run();
    if (v) open(ask(v), v);
  });
  const onKey = e => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    if (view === 'ans') toList(); else if (sc) setScope(null); else hooks.close();
  };
  $('.b-esc').addEventListener('click', () => hooks.close());
  $('.b-scrim').addEventListener('click', () => hooks.close());
  draw();
  return {
    open() { document.addEventListener('keydown', onKey); if (matchMedia('(pointer:fine)').matches) requestAnimationFrame(() => input.focus({ preventScroll: true })); },
    close() { document.removeEventListener('keydown', onKey); },
  };
}
