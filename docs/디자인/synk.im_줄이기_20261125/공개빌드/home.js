/* synk.im 홈 v12. 강의장 화면(서울 시각과 예약된 일), 창 셋(묻기 · 새 소식 · 솔리오 받기), 들어오는 주소, 영상과 큰 synk, 묻기 창의 검정 무대. */
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
  if (d.open) {
    if (k === 'ask') { $('[data-stage]')?.toList?.(); const a = $('.st-mail a', d); a?.focus({ preventScroll: true }); a?.scrollIntoView({ block: 'nearest' }); return d; }
    d.scrollTop = 0; $('.head a, .pf-get a, li a', d)?.focus({ preventScroll: true }); return d;
  }
  $$('.sheet[open]').forEach(x => x.close());
  back = from || back;
  d.showModal(); d.scrollTop = 0;
  if (k === 'ask') $('[data-stage]')?.load?.();
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

/* 묻기 창 · 검정 무대(유호님 11-26 「다로 하돼」). 질문 줄이 곧 큰 글자이고, 고르면 그 질문이 제목이 되어 답이 열린다.
   자료는 /assets/v12/ask-ko.json · ask-en.json의 질문 열여덟 개다(한국 유학 · AI 강의 · 광고 · 회사). 한국 유학은 LAB과 PATH를 하나로 합쳤다.
   공개본 질문 엔진은 옛 질문 128개의 이름에 묶여 있어 줄인 자료로는 돌지 않는다. 그래서 작은 검색기로 고른다. */
const stage = $('[data-stage]');
if (stage) {
  const S = en
    ? { all: 'All', faq: 'Common questions', inScope: n => `Common questions in ${n}`, match: 'Matching questions', none: 'No matching question yet. Try other words, or pick a part above.',
        hello: 'What would you like to know?', back: 'All questions', from: n => `From our ${n} notes`, found: 'Where we found it', next: 'Ask next', more: 'Keep reading',
        missT: 'We could not find an answer to this in our public notes.', missB: 'Pick Study in Korea, AI training, Advertising or Company and ask again, or write to hello@synk.im.', missSrc: 'Not in our public notes', missIn: n => `We could not find this in our ${n} notes.`, missInB: 'Pick All and ask again, or write to hello@synk.im.',
        ph: 'Type a question or pick one above', ph2: 'Ask a follow-up', fail: 'Could not load the questions. Please try again in a moment.', mail: 'Send an email' }
    : { all: '전체', faq: '자주 묻는 질문', inScope: n => `${n}에서 자주 묻는 질문`, match: '맞는 질문', none: '맞는 질문이 아직 없어요. 다른 말로 적어 보시거나 위에서 사업을 골라 보세요.',
        hello: '무엇이 궁금하세요?', back: '질문 목록', from: n => `${n} 안내에서 찾았어요`, found: '찾은 곳', next: '이어서', more: '이어서 읽기',
        missT: '공개한 안내에서 이 질문에 맞는 답을 찾지 못했어요.', missB: '한국 유학, AI 강의, 광고, 회사 가운데 궁금한 쪽을 골라 다시 물어보시거나, hello@synk.im으로 메일을 보내 주세요.', missSrc: '공개한 안내에 없는 질문', missIn: n => `${n} 안내에서는 이 질문에 맞는 답을 찾지 못했어요.`, missInB: '「전체」를 골라 다시 물어보시거나, hello@synk.im으로 메일을 보내 주세요.',
        ph: '질문을 적거나 위에서 고르세요', ph2: '이어서 물어보세요', fail: '질문을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.', mail: '메일 보내기' };
  const pick = $('.st-pick', stage), art = $('.st-art', stage), list = $('.st-qs', stage), label = $('.st-main>.st-k', stage), scopesEl = $('.st-scopes', stage);
  const form = $('.st-dock', stage), input = $('#st-in', stage), send = $('.st-send', stage), toastEl = $('#toast');
  const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x !== undefined) n.textContent = x; return n; };
  let ready = null, data = null, recs = null, scope = 'all', items = [], active = -1, keyed = false, toastTimer;
  const fine = () => matchMedia('(pointer:fine)').matches;
  const say = t => { if (!toastEl) return; toastEl.textContent = t; toastEl.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600); };
  /* 같은 사이트 주소와 메일만 링크로 단다 */
  const safe = h => typeof h === 'string' && (h === 'mailto:hello@synk.im' || (/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]*(?:\?[A-Za-z0-9=&_-]+)?(?:#[A-Za-z][A-Za-z0-9_-]*)?$/.test(h) && !h.split(/[\/#?]/).some(x => x === '.' || x === '..')));

  /* 작은 검색기: 낱말 끝의 조사를 떼어 견주고, 열쇠말 · 질문 낱말 · 두 글자 조각이 겹치는 만큼 점수를 준다 */
  const END = /(인가요|이에요|예요|해요|하나요|할까요|되나요|있나요|없나요|주세요|싶어요|은요|는요|나요|까요|에서|으로|부터|까지|은|는|이|가|을|를|에|로|도|와|과|의|요|랑)$/;
  const norm = s => String(s).toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
  const toks = s => String(s).toLowerCase().split(/[^0-9a-z가-힣]+/).filter(Boolean).map(w => { let x = w; for (let i = 0; i < 2; i++) { const y = x.replace(END, ''); if (y && y !== x) x = y; } return x; });
  const grams = s => { const t = words(s).join(''), g = new Set(); for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2)); return g; };
  const dice = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; for (const x of a) if (b.has(x)) n++; return 2 * n / (a.size + b.size); };
  const GREET = /^(안녕|안녕하세요|하이|hi|hello|hey|hithere|hellothere|howdoesitwork|howdoesthiswork|처음왔어요|반가워요|반갑습니다|사용법|어떻게써요|어떻게쓰나요|어떻게사용하나요)$/;
  /* 군말: 낱말은 어미를 뗀 뒤에 견주므로 뗀 꼴도 함께 넣는다(「궁금해요」 → 「궁금」) */
  const STOP = new Set(['되나요', '있나요', '없나요', '주세요', '알려', '보여', '해요', '하나요', '인가요', '뭐예요', '어떻게', '무엇', '뭐', '좀', '수', '있어요', '싶어요', '싶어', '해', '알고', '알고싶어요',
    '궁금해요', '궁금해', '궁금', '있어', '어때', '어때요', '거예요', '건가요', '돼요',
    'how', 'what', 'is', 'the', 'a', 'an', 'do', 'does', 'i', 'you', 'your', 'can', 'to', 'of', 'in', 'for', 'me', 'my', 'we', 'our', 'it', 'are', 'and', 'with', 'there', 'please', 'tell', 'about',
    'where', 'when', 'who', 'why', 'which', 'have', 'has', 'had', 'be', 'am', 'was', 'were', 'this', 'that', 'from', 'at', 'on', 'by', 'or', 'if', 'any', 'will', 'would', 'should', 'could', 'want', 'get', 'know', 'like', 'much', 'many', 'so', 'just', 'use', 'using', 'anything', 'something'].flatMap(w => [w, ...toks(w)]));
  const words = s => toks(s).filter(w => !STOP.has(w));
  /* 열쇠말: 영어는 낱말 경계로, 한 글자 한국어는 낱말 그대로일 때만, 그 밖은 띄어쓰기를 뺀 글에 들어 있으면 */
  const key = k => {
    k = String(k).toLowerCase().trim();
    const re = /^[0-9a-z ]+$/.test(k) ? new RegExp('(?<![0-9a-z])' + k.replace(/ +/g, '[^0-9a-z]+') + '(?:e?s)?(?![0-9a-z])') : null;
    const n = Math.max(norm(k).length, 2);
    return { k, re, w: 3 * Math.min(1, n / 3) + Math.min(n, 12) / 12 };
  };
  const hit = (o, flat, low, qt) => o.re ? o.re.test(low) : o.k.length === 1 ? qt.includes(o.k) : flat.includes(norm(o.k));
  /* 질문에 적힌 사업 이름(유학 · 강의 · 광고 …): 있으면 그 사업 안에서만 답을 고른다 */
  const named = q => { const flat = norm(q), low = String(q).toLowerCase(), qt = words(q); return data.scopes.filter(x => (x._m || []).some(o => hit(o, flat, low, qt))).map(x => x.id); };
  /* 고를 자리: 질문에 사업 이름이 있으면 그 사업 답과 회사 일 답(문의 · 대표 · 사업자 정보 · 솔리오)에서 고른다.
     회사 소개(company-what)는 이때 빼서, 넓은 열쇠말(SYNK · 소개 · 사업)이 사업 답을 이기지 않게 한다.
     사업을 골라 두었으면 그 사업 답을 먼저 주고, 문턱을 넘는 답이 없을 때만 회사 답에서 고른다 */
  const work = x => x.r.s === 'company' && x.r.id !== 'company-what';
  const fits = (x, ns) => ns.length ? ns.includes(x.r.s) || work(x) : scope === 'all' || x.r.s === scope || x.r.s === 'company';
  const best = (all, ns) => {
    if (ns.length || scope === 'all') return all.find(x => fits(x, ns));
    const mine = all.find(x => x.r.s === scope);
    return mine && mine.s >= 1.6 ? mine : all.find(x => x.r.s === 'company');
  };
  let df = null;
  function score(q, only) {
    const flat = norm(q), low = String(q).toLowerCase(), qt = words(q), qg = grams(q);
    if (!df) { df = new Map(); for (const r of recs.values()) for (const t of r._t) df.set(t, (df.get(t) || 0) + 1); }
    const out = [];
    for (const r of recs.values()) {
      if (only && r.s !== only) continue;
      let s = 0;
      for (const o of r._k) if (hit(o, flat, low, qt)) s += o.w;
      const k = s;
      for (const t of qt) if (r._t.has(t)) s += 1.2 * Math.log(1 + recs.size / (df.get(t) || 1)) / 3;
      s += 3 * Math.max(...r._g.map(g => dice(qg, g)));
      out.push({ r, s, k });
    }
    return out.sort((a, b) => b.s - a.s);
  }

  function load() {
    ready ??= fetch(stage.dataset.src).then(r => { if (!r.ok) throw new Error('ask'); return r.json(); }).then(j => {
      if (!j || !Array.isArray(j.records) || !Array.isArray(j.scopes)) throw new Error('ask');
      data = j; recs = new Map(j.records.map(r => [r.id, r]));
      for (const x of j.scopes) x._m = (x.mark || []).map(key);
      for (const r of j.records) { r._k = r.k.map(key); r._t = new Set([r.t, ...r.q].flatMap(words)); r._g = [r.t, ...r.q].map(grams); }
      const shown = j.records.filter(r => r.id !== 'company-biz'), n = { all: shown.length }; for (const r of shown) n[r.s] = (n[r.s] || 0) + 1;
      scopesEl.replaceChildren(...[{ id: 'all', name: S.all }, ...j.scopes].map(x => {
        const li = el('li'), b = el('button', 'st-sc'); b.type = 'button'; b.dataset.k = x.id; b.setAttribute('aria-pressed', String(x.id === scope));
        const c = n[x.id] || 0;
        b.append(el('span', '', x.name), el('span', 'st-scc', String(c)));
        b.lastChild.setAttribute('aria-hidden', 'true'); b.setAttribute('aria-label', en ? `${x.name}, ${c} questions` : `${x.name}, 질문 ${c}개`);
        b.addEventListener('click', e => { setScope(x.id); if (fine() && e.detail > 0) input.focus({ preventScroll: true }); });
        li.append(b); return li;
      }));
      setScope(scope);
    }).catch(e => { ready = null; throw e; });
    return ready;
  }
  /* 창을 새로 열면 질문 목록으로 돌아가고, 마우스 · 자판이면 입력칸에 선다(휴대폰은 자판이 목록을 덮어 서지 않는다) */
  stage.toList = () => { if (!data) return; input.value = ''; send.disabled = true; input.placeholder = S.ph; setScope('all'); $('.st-stage', stage).scrollTop = 0; };
  stage.load = () => load().then(() => { stage.toList(); if (fine()) input.focus({ preventScroll: true }); }).catch(() => say(S.fail));
  const scopeName = id => data.scopes.find(x => x.id === id)?.name || '';

  function show(xs, k) {
    items = xs; label.textContent = k;
    list.replaceChildren(...xs.map((r, i) => {
      const li = el('li', 'st-q'); li.id = 'st-o' + i; li.setAttribute('role', 'option'); li.style.animationDelay = i * 40 + 'ms';
      const arr = el('span', 'st-arr', '→'); arr.setAttribute('aria-hidden', 'true');
      li.append(arr, el('span', '', r.t));
      li.addEventListener('click', () => answer(r, r.t));
      li.addEventListener('mousemove', () => { keyed = false; mark(i); });
      return li;
    }));
    keyed = false; mark(-1);
  }
  function mark(i) {
    active = i;
    $$('.st-q', list).forEach((o, k) => o.setAttribute('aria-selected', String(k === i)));
    if (i >= 0) { input.setAttribute('aria-activedescendant', 'st-o' + i); $('#st-o' + i, list)?.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' }); }
    else input.removeAttribute('aria-activedescendant');
    input.setAttribute('aria-expanded', String(!pick.hidden && items.length > 0));
  }
  function toPick() { if (!art.hidden) { art.hidden = true; pick.hidden = false; input.placeholder = S.ph; } }
  function setScope(k) {
    scope = k;
    $$('.st-sc', scopesEl).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
    toPick();
    if (input.value.trim()) { suggest(); return; }
    const xs = k === 'all' ? data.starters.map(id => recs.get(id)).filter(Boolean) : [...recs.values()].filter(r => r.s === k && r.id !== 'company-biz');
    show(xs, k === 'all' ? S.faq : S.inScope(scopeName(k)));
  }
  function suggest() {
    const q = input.value.trim();
    if (!q) { setScope(scope); return; }
    toPick();
    const ns = named(q);
    const xs = score(q).filter(x => x.s >= 1.2 && fits(x, ns)).slice(0, 6).map(x => x.r);
    show(xs, xs.length ? S.match : S.none);
  }
  /* 적은 글로 답하기: 인사면 목록을, 맞는 답이 없으면 못 찾았다고 말한다 */
  function ask(q, keep = false) {
    if (GREET.test(norm(q))) { input.value = ''; send.disabled = true; setScope('all'); label.textContent = S.hello; return; }
    /* 질문에 사업 이름이 있으면 그 사업 안에서 고른다(「광고 환불」이 유학 수속 돈 답으로 가지 않게).
       사업을 골라 두었고 다른 사업 이름이 없으면 그 사업 안에서만 답하고, 없으면 그 사업 안내에는 없다고 알린다 */
    const top = best(score(q), named(q));
    answer(top && top.s >= 1.6 ? top.r : null, q, keep);
  }

  function answer(r, q, keep = false) {
    input.value = ''; send.disabled = true; input.placeholder = S.ph2;
    pick.hidden = true; art.hidden = false; art.replaceChildren(); mark(-1);
    const back = el('button', 'st-back', S.back); back.type = 'button';
    back.addEventListener('click', () => { input.placeholder = S.ph; setScope(scope); mark(-1); if (fine()) input.focus({ preventScroll: true }); else $('.st-sc[aria-pressed="true"]', scopesEl)?.focus({ preventScroll: true }); });
    const h = el('h3', 'st-asked', r ? r.t : q), lead = el('p', 'st-lead'), grid = el('div', 'st-grid'), text = el('div', 'st-text'), side = el('aside', 'st-aside');
    const paras = r ? r.a : scope === 'all' ? [S.missT, S.missB] : [S.missIn(scopeName(scope)), S.missInB];
    String(paras[0]).split(/(\s+)/).forEach((w, i) => { if (/^\s+$/.test(w)) lead.append(w); else { const s = el('span', 'w', w); s.style.animationDelay = calm ? '0ms' : Math.min(i * 7, 600) + 'ms'; lead.append(s); } });
    text.append(...paras.slice(1, 3).map(t => el('p', '', t)));
    if (paras.length > 3) { const rest = el('div'); rest.hidden = true; rest.append(...paras.slice(3).map(t => el('p', '', t))); const m = el('button', 'st-more', S.more); m.type = 'button'; m.addEventListener('click', () => { rest.hidden = false; const p = rest.firstChild; p.tabIndex = -1; p.focus({ preventScroll: true }); m.remove(); }); text.append(rest, m); }
    const src = el('p', 'st-src'); src.append(el('span', 'st-dot'), r ? S.from(scopeName(r.s)) : S.missSrc);
    side.append(el('p', 'st-k', S.found), src);
    const go = r ? r.go : { label: S.mail, href: 'mailto:hello@synk.im' };
    if (go && safe(go.href)) { const a = el('a', 'st-go'); a.href = go.href; a.append(el('span', '', go.label), el('span', '', '→')); a.lastChild.setAttribute('aria-hidden', 'true'); side.append(a); }
    const rel = r ? r.rel.map(id => recs.get(id)).filter(Boolean) : data.starters.slice(0, 3).map(id => recs.get(id)).filter(Boolean);
    if (rel.length) {
      side.append(el('p', 'st-k st-k2', S.next));
      const ul = el('ul', 'st-rel'); rel.forEach(x => { const li = el('li'), b = el('button', '', x.t); b.type = 'button'; b.dataset.askRecord = x.id; li.append(b); ul.append(li); }); side.append(ul);
    }
    grid.append(text, side);
    art.append(back, h, lead, grid);
    $('.st-stage', stage).scrollTop = 0;
    if (keep) input.focus({ preventScroll: true }); else { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }

  /* 입력칸 초점은 자료만 불러온다 — 목록으로 되돌리는 일은 창을 열 때만(고른 사업 · 답을 지우지 않게) */
  input.addEventListener('focus', () => { if (!data) load().catch(() => say(S.fail)); });
  input.addEventListener('input', () => { send.disabled = !input.value.trim(); if (data) suggest(); });
  input.addEventListener('keydown', e => {
    if (e.isComposing) return;
    if (!data) { if (e.key === 'Enter') { e.preventDefault(); form.requestSubmit(); } return; }
    if (e.key === 'ArrowDown' && items.length && !pick.hidden) { e.preventDefault(); keyed = true; mark((active + 1) % items.length); }
    else if (e.key === 'ArrowUp' && items.length && !pick.hidden) { e.preventDefault(); keyed = true; mark(active < 0 ? items.length - 1 : (active - 1 + items.length) % items.length); }
    else if (e.key === 'Enter') { e.preventDefault(); if (!pick.hidden && keyed && active >= 0 && items[active]) answer(items[active], items[active].t, true); else if (input.value.trim()) ask(input.value.trim(), true); }
  });
  /* 자료를 못 불러왔으면 보낼 때 다시 불러 보고, 그래도 안 되면 알린다 */
  form.addEventListener('submit', e => {
    e.preventDefault(); const q = input.value.trim(); if (!q) return;
    if (data) ask(q, true); else load().then(() => ask(q, true)).catch(() => say(S.fail));
  });
  /* 이어 물을 것 · 바닥의 사업자 정보 단추: 창 밖에서 누르면 위의 창 열기가 먼저 돈다 */
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-ask-q],[data-ask-record]');
    if (!b) return;
    e.preventDefault();
    try { await load(); } catch { say(S.fail); return; }
    const r = b.dataset.askRecord && recs.get(b.dataset.askRecord);
    if (r) answer(r, r.t); else ask(b.dataset.askQ || '');
  });
  if ($('#sheet-ask')?.open) stage.load();
}
