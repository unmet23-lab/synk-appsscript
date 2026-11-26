/* synk.im 홈 v12. 강의장 화면(서울 시각과 예약된 일), 창 셋(묻기 · 새 소식 · 솔리오 받기), 들어오는 주소, 영상과 큰 synk, 묻기 창의 책장. */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const en = document.documentElement.lang === 'en';
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 날마다 같은 시각에 걸어 둔 일. 예약된 시각을 보이고 끝났는지는 재지 않는다. 새 광고 의뢰 확인은 10분마다 5분에 돈다.
   근거: 저장소 docs/_ops/관문_자동화.md (2026-11-26) */
const J = [
  ['03:30', '회사 자료 백업', 'Data backup'], ['04:00', '복원본 만들기', 'Restore copies'], ['05:00', '잘된 콘텐츠 조사', 'Content research'],
  ['05:10', '지원사업 공고 읽기', 'Grant notice scan'], ['05:30', '서버 암호화 백업', 'Encrypted backup'], ['06:00', '앱 새 판 올리기', 'App updates'],
  ['07:00', '오늘 영상 만들기', 'Today’s videos'], ['08:30', '공모전 찾기', 'Contest search'], ['09:00', '게시물 성과 모으기', 'Post results'],
  ['09:10', '나라별 말로 옮기기', 'Local translations'], ['10:30', '여행 자료 다시 확인', 'Travel data check'], ['10:40', '유학 접수 마감 확인', 'Admission dates'],
  ['12:30', '영상 원본 백업', 'Video backup'], ['13:10', '지원사업 공고 읽기', 'Grant notice scan'], ['14:00', 'SNS 검수와 게시', 'Review and publish'],
  ['15:00', '오늘 영상 만들기', 'Today’s videos'], ['17:00', '앱 새 판 올리기', 'App updates'], ['18:30', '메일 훑어보기', 'Mail scan'],
  ['19:30', '내일 주제 찾기', 'Topic search'], ['20:00', '인기 영상 조사', 'Video research'], ['21:00', '스레드 글 올리기', 'Threads post'],
  ['22:10', '나라별 말로 옮기기', 'Local translations'], ['23:00', '브랜드 광고 조사', 'Ad research'],
].map(x => [+x[0].slice(0, 2) * 60 + +x[0].slice(3), x[0], x[en ? 2 : 1]]);
const T = en ? { now: 'just now', ten: 'every 10 min', ad: 'Ad requests' } : { now: '방금', ten: '10분마다', ad: '새 광고 의뢰 확인' };
const p2 = n => String(n).padStart(2, '0');
const later = m => { const h = Math.floor(m / 60), r = m % 60; return en ? 'in ' + (h ? h + 'h' + (r ? ' ' + r + 'm' : '') : r + ' min') : (h ? h + '시간' + (r ? ' ' + r + '분' : '') : r + '분') + ' 뒤'; };
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const scr = $('.scr');
let shown = '';
function tick() {
  const [h, m, s] = clock.format(new Date()).split(':'), k = h + ':' + m;
  $('.sec', scr).textContent = s;
  if (k === shown) return;
  shown = k; $('.now', scr).textContent = k;
  const n = +h * 60 + +m, gap = x => (x - n + 1440) % 1440, past = x => (n - x + 1440) % 1440;
  let i = J.findIndex(x => x[0] > n); if (i < 0) i = 0;
  const a = J[(i + J.length - 1) % J.length], b = J[i], c = J[(i + 1) % J.length];
  const q = (Math.floor((n - 5) / 10) * 10 + 5 + 1440) % 1440;
  const first = past(a[0]) <= past(q) ? [a[1], a[2], T.now] : [p2(Math.floor(q / 60)) + ':' + p2(q % 60), T.ad, T.ten];
  $('.jb', scr).replaceChildren(...[first, [b[1], b[2], later(gap(b[0]))], [c[1], c[2], later(gap(c[0]))]].map(x => {
    const li = document.createElement('li');
    ['time', 'span', 'em'].forEach((t, j) => li.appendChild(document.createElement(t)).textContent = x[j]);
    return li;
  }));
  $('.pg i', scr).style.width = past(a[0]) / (past(a[0]) + gap(b[0])) * 100 + '%';
  scr.classList.add('on'); fit();
}
/* 이름이 잘리면 남은 시간 칸을 세 줄에서 함께 뺀다 */
function fit() { scr.classList.remove('tight'); scr.classList.toggle('tight', $$('.jb span', scr).some(x => x.scrollWidth > x.clientWidth + 1)); }
tick(); setInterval(tick, 1000);
if ('ResizeObserver' in window) new ResizeObserver(fit).observe(scr);
document.fonts?.ready.then(fit);

/* 영상: 움직임 줄이기면 멈춘 그림, 화면 밖이면 쉰다 */
const film = $('.k3 video');
if (calm) { film.removeAttribute('autoplay'); film.pause(); }
else if ('IntersectionObserver' in window) new IntersectionObserver(e => { e[e.length - 1].isIntersecting ? film.play().catch(() => {}) : film.pause(); }, { threshold: .05 }).observe(film);

/* 맨 아래 큰 synk */
const wm = $('.wm');
if ('IntersectionObserver' in window) { wm.classList.add('io'); new IntersectionObserver((e, o) => { if (e.some(x => x.isIntersecting)) { wm.classList.add('on'); o.disconnect(); } }, { threshold: .2 }).observe(wm); }

/* 창: 다른 쪽이 부르는 /#platform · /#now · /#contact도 이 창을 연다 */
const SHEET = { ask: ['ask', 'contact', 'contact-web', 'questions'], now: ['now', 'news'], platform: ['platform', 'platform-get', 'start'] };
const sheetOf = id => Object.keys(SHEET).find(k => SHEET[k].includes(id));
let back = null;
function open(k, from) {
  const d = $('#sheet-' + k);
  if (!d) return d;
  /* 이미 열린 창을 다시 부르면(답의 「문의하기」) 맨 위로 올리고 첫 링크에 선다 */
  if (d.open) { d.scrollTop = 0; $('.head a, .pf-get a, li a', d)?.focus({ preventScroll: true }); return d; }
  $$('.sheet[open]').forEach(x => x.close());
  back = from || back;
  d.showModal(); d.scrollTop = 0;
  if (k === 'ask') $('[data-shelf]')?.load?.();
  return d;
}
$$('.sheet').forEach(d => {
  d.addEventListener('close', () => { if ($('.sheet[open]')) return; if (sheetOf(location.hash.slice(1))) history.replaceState(null, '', location.pathname + location.search); back?.focus?.(); back = null; });
});
$$('[data-sheet]').forEach(b => b.addEventListener('click', () => open(b.dataset.sheet, b)));
/* 창을 닫되 초점을 돌려보내지 않는다(쪽의 다른 자리로 갈 때) */
const leave = () => { const d = $('.sheet[open]'); if (d) { back = null; d.close(); } };
/* 같은 쪽 주소: 창을 가리키면 그 창으로, 쪽의 자리를 가리키면 창을 닫고 그 자리로. 사업자 정보 단추는 묻기 창으로 */
document.addEventListener('click', e => {
  if (e.target.closest('[data-ask-q],[data-ask-record]') && !e.target.closest('#sheet-ask')) open('ask', e.target.closest('button'));
  const a = e.target.closest('a[href*="#"]');
  if (!a || a.target || a.origin !== location.origin || a.pathname !== location.pathname || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const k = sheetOf(a.hash.slice(1));
  if (k) { e.preventDefault(); open(k); } else leave();
}, true);
const byHash = () => { const k = sheetOf(location.hash.slice(1)); if (k) open(k); else leave(); };
/* 브라우저도 주소 자리로 창 안을 내린다 — 다 불러온 뒤 한 번 맨 위로 되돌린다(그사이 사람이 움직였으면 그대로 둔다) */
let touched = false;
for (const e of ['wheel', 'touchstart', 'keydown', 'pointerdown']) addEventListener(e, () => { touched = true; }, { passive: true, once: true });
const toTop = () => { const d = $('.sheet[open]'); if (d && !touched) d.scrollTop = 0; };
addEventListener('hashchange', () => { byHash(); requestAnimationFrame(toTop); }); byHash();
addEventListener('load', () => requestAnimationFrame(() => requestAnimationFrame(toTop)));

const out = $('#ask-out');
$('#ask-copy')?.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText('hello@synk.im'); out.textContent = en ? 'Email address copied.' : '이메일 주소를 복사했습니다.'; }
  catch { out.textContent = en ? 'Copying is not available. The address is hello@synk.im.' : '복사하지 못했습니다. 주소는 hello@synk.im입니다.'; }
});

/* 묻기 창 · 책장. 공개 안내 여덟 묶음이 책이다. 답은 공개본 질문 엔진(/knowledge-engine.js)이 고르고, 답이 든 책이 나와 펼쳐진다.
   첫 장에는 질문과 답의 첫 문장을, 다음 장에는 이어지는 문단 하나와 행동 · 이어 물을 것을 둔다. 나머지는 「다음 쪽」에 접는다. */
const shelf = $('[data-shelf]');
if (shelf) {
  const S = en
    ? { found: b => `Found in “${b}”`, pick: 'Which one do you mean?', none: 'No matching answer', reply: 'From SYNK', more: n => `Read more (+${n})`, next: 'Ask next', often: 'Often asked in this book',
        count: n => ['', `${n}`, n === 1 ? ' answer in this book' : ' answers in this book'], fail: 'Could not load the notes. Please ask again in a moment.', notes: 'Public notes',
        copy: 'Copy answer', copied: 'Answer copied.', nocopy: 'Copy is not available here. Select the answer to copy it.' }
    : { found: b => `「${b}」 책에서 찾음`, pick: '어느 쪽이 궁금하신가요', none: '맞는 답을 찾지 못했어요', reply: 'SYNK 안내', more: n => `더 읽기 (+${n})`, next: '이어서 물어보기', often: '이 책에서 자주 묻는 것',
        count: n => ['이 책의 답 ', `${n}`, '개'], fail: '안내 자료를 불러오지 못했어요. 잠시 뒤 다시 물어봐 주세요.', notes: '공개 안내',
        copy: '답 복사', copied: '답을 복사했어요.', nocopy: '복사를 쓸 수 없어요. 답을 선택해 복사해 주세요.' };
  const board = $('.sh-board', shelf), form = $('.sh-form', shelf), input = $('#sh-q', shelf), go = $('button', form);
  const books = $$('.sh-book', shelf), toastEl = $('#toast');
  const BR = ['lab', 'shift', 'pulse', 'path'];
  let ready = null, eng = null, recs = null, docs = null, ctx = { brand: 'synk' }, busy = false, toastTimer;
  const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x !== undefined) n.textContent = x; return n; };
  const say = t => { if (!toastEl) return; toastEl.textContent = t; toastEl.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600); };
  /* site.js와 같은 행동 링크 규칙: 같은 사이트 주소와 허락한 바깥 주소만 */
  const OUT = new Set(['https://www.youtube.com/@synkkorean/live', 'https://www.youtube.com/@synkkorean', 'https://www.instagram.com/synk.mn/', 'https://t.me/synkmn', 'mailto:hello@synk.im', 'https://synk.im/name/', 'https://synk.im/privacy/#website-questions', 'https://synk.im/privacy/#ko']);
  const safe = h => typeof h === 'string' && !!h && !/[\s\\\u0000-\u001f\u007f]/u.test(h) && (OUT.has(h) || /^#[A-Za-z][A-Za-z0-9_-]*$/.test(h) || (/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]*(?:#[A-Za-z][A-Za-z0-9_-]*)?$/.test(h) && !h.split(/[\/#]/).some(x => x === '.' || x === '..')));
  /* 문장 나누기: 마침표 · 물음표 · 느낌표 뒤에 빈칸이 올 때만(메일 주소 · 판 번호의 점은 그대로) */
  function sentences(t) {
    const out = []; let a = 0; t = String(t || '');
    for (let i = 0; i < t.length; i++) if ('.?!'.includes(t[i]) && (i + 1 === t.length || /\s/.test(t[i + 1]))) { out.push(t.slice(a, i + 1).trim()); a = i + 1; }
    if (t.slice(a).trim()) out.push(t.slice(a).trim());
    return out;
  }
  const cut = t => { const s = sentences(t); const n = s.length > 2 && s[0].length < 45 ? 2 : 1; return [s.slice(0, n).join(' '), s.slice(n).join(' ')]; };
  /* 책임 범위를 밝히는 문단(결과를 보장하지 않음)은 지우지 않고 접힌 쪽 맨 뒤로 보낸다 */
  const late = t => /보장하지 않|책임지지 않|guarantee|does not replace|not a substitute/i.test(t);
  const nameOf = id => $(`.sh-book[data-book="${id}"] .sh-name`, shelf)?.textContent || S.notes;

  function load() {
    ready ??= Promise.all([
      fetch(shelf.dataset.knowledge).then(r => { if (!r.ok) throw new Error('knowledge'); return r.json(); }),
      import(shelf.dataset.engine),
    ]).then(([j, m]) => {
      if (!j || !Array.isArray(j.docs) || !Array.isArray(j.records)) throw new Error('knowledge');
      recs = new Map(j.records.map(r => [r.id, r])); docs = new Map(j.docs.map(d => [d.id, d]));
      eng = m.createKnowledgeEngine(j);
      const n = {}; for (const r of j.records) n[r.sourceId] = (n[r.sourceId] || 0) + 1;
      books.forEach(b => {
        const c = n[b.dataset.book] || 0, k = $('.sh-n', b), small = el('small', '', en ? '' : '답');
        k.replaceChildren(...(en ? [] : [small]), String(c));
        b.setAttribute('aria-label', `${$('.sh-name', b).textContent}${$('.sh-sub', b).textContent ? ' (' + $('.sh-sub', b).textContent + ')' : ''} — ${en ? c + (c === 1 ? ' answer' : ' answers') : '답 ' + c + '개'}`);
      });
    }).catch(e => { ready = null; throw e; });
    return ready;
  }
  shelf.load = () => load().catch(() => {});

  function pull(id) { books.forEach(b => { const on = b.dataset.book === id; b.classList.toggle('out', on); b.setAttribute('aria-pressed', String(on)); }); }
  function book(id) { const o = el('div', 'sh-open o-' + id), l = el('section', 'sh-page sh-left'), r = el('section', 'sh-page sh-right'); o.append(l, r); return [o, l, r]; }
  const relBtn = (id, label) => { const r = recs.get(id); if (!r) return null; const b = el('button', 'sh-rel'); b.type = 'button'; b.dataset.askRecord = id; b.dataset.askQ = label || r.title; b.append(el('span', '', label || r.title), el('span', 'arr', '→')); b.querySelector('.arr').setAttribute('aria-hidden', 'true'); return b; };
  /* 책을 바꿔 펴면 누른 단추가 사라진다 — 초점을 새 책의 제목으로 옮겨 Tab이 책 안으로 이어지게 한다(입력칸에서 물었으면 입력칸에 둔다) */
  function show(node, from) {
    const lost = from && from !== input && (board.contains(from) || from === go || from.closest?.('.sh-marks,.sh-books'));
    board.replaceChildren(node); board.classList.remove('turning');
    if (lost) { const h = $('.sh-q', board); h.tabIndex = -1; h.focus({ preventScroll: true }); }
    const d = board.closest('dialog'), top = board.getBoundingClientRect().top, dt = d.getBoundingClientRect().top;
    if (top - dt > d.clientHeight * .55 || top < dt) board.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  }

  /* 왼쪽 쪽은 답이다: 질문, 첫 문장, 엔진이 짚은 문단(focus — 공개본 site.js처럼 늘 펼쳐 둔다), 나머지는 「더 읽기」.
     기록이 여럿이면 기록마다 제목과 첫 문장을 보인다. 오른쪽 쪽은 다음에 할 일이다: 행동 링크, 이어 물을 것, 답 복사. */
  function render(q, res, from) {
    const list = res.records || [], first = list[0];
    /* 되묻기는 고를 질문들이 든 책을 꺼낸다(「강의」 → AI 강의) */
    const id = first?.sourceId || (res.status === 'clarify' && recs.get(res.relatedIds?.[0])?.sourceId) || res.sourceIds?.[0] || (res.status === 'courtesy' ? 'company' : 'guide');
    pull(id);
    const [o, l, r] = book(id);
    const msg = String(res.message || '').split(/\n\n/).filter(Boolean);
    const kick = res.status === 'courtesy' ? S.reply : res.status === 'clarify' ? S.pick : first ? S.found(nameOf(id)) : S.none;
    l.append(el('p', 'sh-kick', kick), el('h3', 'sh-q', q));
    const folded = [];
    if (!first) {
      l.append(el('p', 'sh-lead', msg[0] || S.none), ...msg.slice(1).map(t => el('p', '', t)));
    } else {
      l.append(...msg.map(t => el('p', '', t)));
      list.forEach((x, k) => {
        const parts = String(x.answer || '').split(/\n\n/).filter(Boolean), f = res.focus?.[x.id];
        const [head, tail] = cut(parts[0]);
        let rest = [tail, ...parts.filter((_, i) => i > 0 && i !== f)].filter(Boolean);
        rest = [...rest.filter(t => !late(t)), ...rest.filter(late)];
        if (k) l.append(el('h4', 'sh-also', x.title));
        l.append(el('p', k ? '' : 'sh-lead', head));
        if (f > 0 && f < parts.length) l.append(el('p', '', parts[f]));
        else if (!k && rest[0] && !late(rest[0])) l.append(el('p', '', rest.shift()));
        if (rest.length) folded.push([list.length > 1 ? x.title : null, rest]);
      });
    }
    const n = folded.reduce((a, [, t]) => a + t.length, 0);
    if (n) {
      const d = el('details', 'sh-more'); d.append(el('summary', '', S.more(n)));
      for (const [t, ps] of folded) { if (t) d.append(el('h4', 'sh-also', t)); d.append(...ps.map(x => el('p', '', x))); }
      l.append(d);
    }
    const seen = new Set();
    for (const x of list) {
      const a = x.action;
      if (!a?.href || seen.has(a.href) || typeof a.label !== 'string' || !a.label.trim() || !safe(a.href) || seen.size > 1) continue;
      seen.add(a.href);
      const link = el('a', seen.size === 1 ? 'sh-go' : 'sh-go2'); link.href = a.href; link.append(el('span', '', a.label), el('span', '', '→')); link.lastChild.setAttribute('aria-hidden', 'true');
      r.append(link);
    }
    const rel = [...list.slice(1).map(x => x.id), ...(res.relatedIds || []).slice(0, res.status === 'clarify' ? 3 : 2)].filter((x, i, a) => a.indexOf(x) === i && x !== first?.id).slice(0, 3).map(x => relBtn(x)).filter(Boolean);
    if (rel.length) { const w = el('div', 'sh-rels'); r.append(el('p', 'sh-label', res.status === 'clarify' ? S.pick : S.next)); w.append(...rel); r.append(w); }
    if (first) {
      const c = el('button', 'sh-copy', S.copy); c.type = 'button';
      c.addEventListener('click', async () => { try { await navigator.clipboard.writeText([...msg, ...list.map(x => x.answer)].filter(Boolean).join('\n\n')); say(S.copied); } catch { say(S.nocopy); } });
      r.append(c);
    }
    show(o, from);
  }

  async function browse(id, from) {
    pull(id);
    /* 사업 책을 펴면 다음 질문은 그 사업 문맥으로 읽는다 */
    ctx = { brand: BR.includes(id) ? id : 'synk' };
    try { await load(); } catch { pull(null); say(S.fail); return; }
    const d = docs.get(id), rs = [...recs.values()].filter(r => r.sourceId === id);
    const [o, l, r] = book(id);
    const [c0, c1, c2 = ''] = S.count(rs.length), c = el('p', 'sh-count', c0); c.append(el('b', '', c1), c2);
    l.append(el('p', 'sh-kick', nameOf(id)), el('h3', 'sh-q', d ? (d.title.split(' — ').slice(1).join(' — ') || d.title) : nameOf(id)), c);
    const w = el('div', 'sh-rels'); w.append(...rs.slice(0, 3).map(x => relBtn(x.id)).filter(Boolean));
    r.append(el('p', 'sh-label', S.often), w);
    show(o, from);
  }

  async function ask(text, record, typed) {
    const q = String(text || '').trim();
    if (busy || (!q && !record)) return;
    const from = document.activeElement;
    busy = true; form.setAttribute('aria-busy', 'true'); go.disabled = true; board.classList.add('turning');
    try {
      await load();
      const r = record && recs.get(record);
      let res;
      if (r) {
        res = { status: 'matched', records: [r], sourceIds: [r.sourceId], relatedIds: (r.relatedIds || []).slice(0, 2), brand: r.brand };
        ctx = { brand: BR.includes(r.brand) ? r.brand : ctx.brand, recordIds: [r.id] };
      } else {
        res = await eng.answer(q, ctx);
        if (['matched', 'needs_confirmation'].includes(res.status)) ctx = { brand: BR.includes(res.brand) ? res.brand : ctx.brand, recordIds: (res.records || []).map(x => x.id) };
        else if (!['clarify', 'courtesy'].includes(res.status)) ctx = { brand: ctx.brand };
      }
      render(q || r.title, res, from);
      if (typed) { input.value = ''; size(); }
    } catch {
      board.classList.remove('turning'); say(S.fail);
    } finally {
      busy = false; form.setAttribute('aria-busy', 'false'); go.disabled = !input.value.trim();
    }
  }

  function size() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; go.disabled = busy || !input.value.trim(); }
  input.addEventListener('focus', () => shelf.load());
  input.addEventListener('input', size);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (input.value.trim()) form.requestSubmit(); } });
  form.addEventListener('submit', e => { e.preventDefault(); ask(input.value, null, true); });
  books.forEach(b => b.addEventListener('click', () => browse(b.dataset.book, b)));
  /* 책갈피 · 이어 물을 것 · 바닥의 사업자 정보 단추: 창 밖에서 누르면 위의 창 열기가 먼저 돈다 */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ask-q],[data-ask-record]');
    if (!b) return;
    e.preventDefault();
    ask(b.dataset.askQ, b.dataset.askRecord || null);
  });
  if ($('#sheet-ask')?.open) shelf.load();
}
