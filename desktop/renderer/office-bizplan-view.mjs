/* 기획부 「사업계획서」 작업 화면 그리기(사업계획서_설계.md 6절, 14.1).
   검토 화면 새 시안(docs/디자인/솔리오_사업계획서_검토화면_20261126)의 짜임이다. 흰 종이를 두지 않는다(결정 11-26).
   놓는 자리 하나에 계획서 · 회사 자료 · 평가 기준 · 직원이 모이고, 고칠 곳은 한 번에 한 장씩 묻는다.
   글은 모두 textContent로 넣는다. 다시 그릴 때 쓰던 칸의 글과 초점을 지킨다 */

const ART = { desk: '/assets/bizplan/desk.jpg', orb: '/assets/bizplan/orb.webp' };
const DEFAULT_ITEMS = ['문제 인식', '실현 가능성', '성장 전략', '팀 구성']; // 본체 office-bizplan-check.cjs와 같다
const SVG = 'http://www.w3.org/2000/svg';
/* 구의 눈(팀 고르기 4판 결: 작고 둥근 점 눈). 표정은 눈 모양과 보는 곳만 바꾼다 */
const MOOD = { open: ['calm', 0, 0], look: ['calm', 3, 5], happy: ['smile', 0, 0], curious: ['calm', 5, -3], side: ['calm', 6, 2], sleepy: ['half', 0, 4], drop: ['calm', 2, 9], read: ['calm', -3, 10] };
function eyesPath(shape, k) {
  const R = 50, X = 0.19 * R * (1 + 0.12 * (k - 1) / 0.85), f = n => +n.toFixed(2);
  const pill = (cx, hh) => { const w = 0.062 * R * k, h = hh * k; return `M${f(cx - w)} ${f(-h + Math.min(w, h))}v${f(2 * h - 2 * Math.min(w, h))}a${f(w)} ${f(Math.min(w, h))} 0 0 0 ${f(2 * w)} 0v${f(-(2 * h - 2 * Math.min(w, h)))}a${f(w)} ${f(Math.min(w, h))} 0 0 0 ${f(-2 * w)} 0z`; };
  const arc = cx => { const r = 0.1 * R * k, dx = f(0.894 * r), y0 = f(0.015 * R * k); return `M${f(cx - dx)} ${y0}A${f(r)} ${f(r)} 0 0 1 ${f(cx + dx)} ${y0}`; };
  return shape === 'smile' ? { d: arc(-X) + arc(X), stroke: true } : { d: pill(-X, R * (shape === 'half' ? 0.034 : 0.062)) + pill(X, R * (shape === 'half' ? 0.034 : 0.062)), stroke: false };
}

export function createBizplanView(host, send, doc = host.ownerDocument) {
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null && text !== '') n.textContent = String(text); return n; };
  const btn = (text, act, arg = '', cls = 'chip', disabled = false) => {
    const b = el('button', cls, text);
    b.type = 'button'; b.dataset.bizAct = act; b.dataset.bizArg = String(arg);
    if (disabled) { b.disabled = true; b.setAttribute('aria-disabled', 'true'); }
    return b;
  };
  const key = (b, k) => { const kb = el('kbd', '', k); kb.setAttribute('aria-hidden', 'true'); b.append(kb); return b; };
  const field = (name, value, label, rows = 3, cls = 'biz-ta') => {
    const t = el('textarea', cls); t.dataset.bizF = name; t.rows = rows; t.value = value || ''; t.spellcheck = false; t.setAttribute('aria-label', label);
    return t;
  };
  /* 구 하나: 그림 위에 눈을 얹는다 */
  const sprite = (mood = 'open', cls = 'biz-sprite') => {
    const s = el('span', cls); s.setAttribute('aria-hidden', 'true');
    const img = el('img'); img.src = ART.orb; img.alt = ''; img.decoding = 'async';
    s.append(img, eyes(mood, 1.6)); return s;
  };
  function eyes(mood, k = 1) {
    const [shape, dx, dy] = MOOD[mood] || MOOD.open, e = eyesPath(shape, k);
    const svg = doc.createElementNS(SVG, 'svg'); svg.setAttribute('viewBox', '-50 -50 100 100'); svg.setAttribute('class', 'biz-eyes'); svg.setAttribute('aria-hidden', 'true');
    const g = doc.createElementNS(SVG, 'g'); g.setAttribute('transform', `translate(${dx - 0.3} ${dy - 2.9})`);
    const path = doc.createElementNS(SVG, 'path'); path.setAttribute('d', e.d);
    if (e.stroke) { path.setAttribute('fill', 'none'); path.setAttribute('stroke-width', String(0.028 * 50 * k)); path.setAttribute('stroke-linecap', 'round'); }
    g.append(path); svg.append(g); return svg;
  }
  const hero = (mood, small = false) => {
    const h = el('div', 'biz-hero' + (small ? ' small' : '')); h.setAttribute('aria-hidden', 'true');
    const img = el('img'); img.src = ART.desk; img.alt = ''; img.decoding = 'async';
    const e = el('span', 'biz-hero-eyes'); e.append(eyes(mood));
    h.append(img, e); return h;
  };
  const icon = kind => { // 계획서는 종이, 자료는 표
    const svg = doc.createElementNS(SVG, 'svg'); svg.setAttribute('viewBox', '0 0 20 20'); svg.setAttribute('aria-hidden', 'true');
    const p = doc.createElementNS(SVG, 'path');
    p.setAttribute('d', kind === 'plan' ? 'M5 2.8h6.6L15.4 6.6v10.6H5ZM11.4 3v3.8h3.8M7.6 10.4h5M7.6 13.2h3.4' : 'M3.2 4h13.6v12H3.2ZM3.2 8.2h13.6M8.6 8.2V16');
    p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '1.3'); p.setAttribute('stroke-linejoin', 'round');
    svg.append(p); return svg;
  };
  let lastKey = '';
  /* 다음으로 갈 장(끝은 '').
     아직 고르지 않은 장: 차례상 뒤의 고칠 곳, 없으면 끝. 앞으로 돌아가 서로 오가지 않는다(Opus 대체 검수 F2).
     고른 장: 남은 고칠 곳이 먼저, 없으면 차례대로 다음 장(다 고른 뒤 다시 볼 때), 마지막이면 끝 */
  const nextOf = (sc, n) => {
    const i = sc.notes.findIndex(x => x.key === n.key);
    if (n.state === 'open') { const nx = sc.notes.slice(i + 1).find(x => x.state === 'open'); return nx ? [nx.key, '다음으로'] : ['', '끝으로']; }
    const open = sc.notes.find(x => x.state === 'open');
    if (open) return [open.key, '다음 고칠 곳'];
    const nx = sc.notes[i + 1];
    return nx ? [nx.key, '다음 장'] : ['', '끝으로'];
  };
  let composing = false, pending;

  host.addEventListener('click', e => {
    const b = e.target.closest?.('[data-biz-act]');
    if (b && !b.disabled && host.contains(b)) { send({ act: b.dataset.bizAct, arg: b.dataset.bizArg || '', fields: fields() }); return; }
    if (cur?.menu && !e.target.closest?.('.biz-menu')) send({ act: 'biz-menu', arg: cur.menu, fields: {} });
  });
  /* 자판(14.1): 고칠 곳에서 Enter는 주 단추, →는 그대로 두기, ←는 앞 장. 단추나 글 칸에 초점이 있으면 받지 않는다(설계 검토 18) */
  host.addEventListener('keydown', e => {
    if (e.key === 'Escape' && cur?.menu) { e.preventDefault(); send({ act: 'biz-menu', arg: cur.menu, fields: {} }); return; }
    if (e.key === 'Escape' && cur?.sheet) { e.preventDefault(); send({ act: 'biz-sheet', arg: '', fields: {} }); return; }
    if (!cur || cur.stage !== 'notes' || cur.sheet || cur.busy || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    // 글 칸에서는 받지 않는다. 단추에 초점이 있으면 Enter · 빈칸은 그 단추가 받고, 화살표는 여기서 받는다
    if (e.target.closest?.('textarea,input,select,[contenteditable]')) return;
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('button')) return;
    const n = cur.notes?.find(x => x.sel);
    if (!n || n.state !== 'open' || n.editing || n.handing || n.asking) {
      if (e.key === 'ArrowLeft' && cur.at > 0) { e.preventDefault(); send({ act: 'biz-go', arg: cur.notes[cur.at - 1].key, fields: {} }); }
      // 이미 고른 장에서는 →가 「다음 고칠 곳」과 같다. 남은 장이 없으면 끝 화면
      else if (e.key === 'ArrowRight' && n && n.state !== 'open') { e.preventDefault(); send({ act: 'biz-go', arg: nextOf(cur, n)[0], fields: {} }); }
      return;
    }
    if (e.key === 'Enter') { const m = host.querySelector('.biz-card .go:not([disabled])'); if (m) { e.preventDefault(); m.click(); } }
    else if (e.key === 'ArrowRight') { e.preventDefault(); if (n.kind !== 'thin') send({ act: 'biz-choose', arg: n.key + '|keep', fields: {} }); else send({ act: 'biz-go', arg: nextOf(cur, n)[0], fields: {} }); }
    else if (e.key === 'ArrowLeft' && cur.at > 0) { e.preventDefault(); send({ act: 'biz-go', arg: cur.notes[cur.at - 1].key, fields: {} }); }
  });
  /* 창에 파일을 놓으면 고르기 창을 연다. 놓은 경로는 받지 않는다(본체만 파일을 고른다, 설계 검토 18) */
  host.addEventListener('dragover', e => { if (cur?.stage === 'start' && e.target.closest?.('.biz-comp')) { e.preventDefault(); e.target.closest('.biz-comp').classList.add('over'); } });
  host.addEventListener('dragleave', e => e.target.closest?.('.biz-comp')?.classList.remove('over'));
  host.addEventListener('drop', e => {
    const c = e.target.closest?.('.biz-comp'); if (!c || cur?.stage !== 'start') return;
    e.preventDefault(); c.classList.remove('over');
    send({ act: cur.list?.plan ? 'biz-pick-data' : 'biz-pick-plan', arg: '', fields: {} });
  });
  const fields = () => Object.fromEntries([...host.querySelectorAll('[data-biz-f]')].map(n => [n.dataset.bizF, n.value]));
  let cur = null;

  const say = (sc, cls = '') => {
    const w = el('div', 'biz-say' + (cls ? ' ' + cls : '')); w.tabIndex = -1; w.dataset.bizHead = '';
    w.append(el('h2', '', sc.head[0]));
    if (sc.head[1]) w.append(el('p', '', sc.head[1]));
    return w;
  };
  const menu = (id, label, opts, act, sc) => {
    const wrap = el('span', 'biz-menu-wrap');
    const b = btn(label, 'biz-menu', id, 'chip'); b.setAttribute('aria-haspopup', 'menu'); b.setAttribute('aria-expanded', String(sc.menu === id));
    const chev = el('i', 'chev'); chev.setAttribute('aria-hidden', 'true'); b.append(chev);
    wrap.append(b);
    if (sc.menu === id) {
      const m = el('div', 'biz-menu'); m.setAttribute('role', 'menu');
      for (const [t, v, on, small] of opts) {
        const o = btn('', act, v, 'opt'); o.setAttribute('role', 'menuitemradio'); o.setAttribute('aria-checked', String(!!on));
        o.append(el('b', '', t)); if (small) o.append(el('small', '', small)); m.append(o);
      }
      wrap.append(m);
    }
    return wrap;
  };

  /* 처음 · 실패 · 멈춤: 놓는 자리 하나 */
  function composer(sc) {
    const comp = el('div', 'biz-comp');
    const plan = sc.list?.plan;
    if (!plan) {
      const b = btn('', 'biz-pick-plan', '', 'place', !!sc.busy);
      b.append(el('b', '', '계획서'), doc.createTextNode('와 '), el('b', '', '회사 자료'), doc.createTextNode('를 골라 주세요'));
      b.append(el('small', '', 'Word(.docx), 마크다운, 글 파일을 읽습니다. 한글과 PDF는 Word로 저장해 넣어 주세요.'));
      comp.append(b);
    } else {
      const files = el('div', 'biz-files');
      const pf = el('div', 'file'); pf.append(icon('plan'));
      const pt = el('span'); pt.append(el('b', '', plan.name), el('small', '', '계획서')); pf.append(pt, btn('바꾸기', 'biz-pick-plan', '', 'x', !!sc.busy));
      files.append(pf);
      (sc.list.data || []).forEach((d, i) => {
        const f = el('div', 'file'); f.append(icon('data'));
        const t = el('span'); t.append(el('b', '', d.name), el('small', '', '회사 자료'));
        const x = btn('빼기', 'biz-remove-data', i, 'x', !!sc.busy); x.setAttribute('aria-label', d.name + ' 빼기');
        f.append(t, x); files.append(f);
      });
      comp.append(files);
    }
    const bar = el('div', 'biz-bar');
    const add = btn('', 'biz-pick-data', '', 'chip round', !!sc.busy); add.setAttribute('aria-label', '회사 자료 더하기'); add.append(el('span', '', '+'));
    bar.append(add,
      menu('crit', sc.criteria.mode === 'pasted' ? '공고문 기준' : '창업 지원사업 기준', [['창업 지원사업 기준', 'default', sc.criteria.mode === 'default', DEFAULT_ITEMS.join(' · ')], ['공고문 기준', 'pasted', sc.criteria.mode === 'pasted', sc.criteria.mode === 'pasted' && sc.criteria.text ? `붙여 넣은 평가 항목 ${sc.list.items.length}개` : '공고의 평가 항목을 붙여 넣습니다']], 'biz-criteria', sc),
      menu('staff', sc.provider === 'codex' ? 'GPT 직원' : 'Claude 직원', [['Claude 직원', 'claude', sc.provider === 'claude', '내 Claude 구독으로 읽습니다'], ['GPT 직원', 'codex', sc.provider === 'codex', '내 ChatGPT 구독으로 읽습니다']], 'biz-provider', sc),
      el('span', 'sp'), btn('읽기', 'biz-start', '', 'go', !plan || !!sc.busy));
    comp.append(bar);
    if (sc.criteria.mode === 'pasted' && (sc.criteria.open || !sc.criteria.text)) {
      const crit = el('div', 'biz-crit');
      crit.append(field('criteria', sc.criteria.text, '공고의 평가 항목, 한 줄에 하나씩', 4), btn('평가 항목 저장', 'biz-criteria-save', '', 'chip', !!sc.busy));
      comp.append(crit);
    }
    return comp;
  }

  /* 고칠 곳 한 장 */
  function card(n, sc) {
    // 바쁜 동안 주 단추가 잠겨도 초점이 이 카드에 남게 한다(개발판 확인 11-26)
    const box = el('section', 'biz-card'); box.dataset.key = n.key; box.tabIndex = -1;
    const where = el('p', 'where'); where.id = 'biz-card-where'; where.append(el('span', '', n.place?.title || ''), el('span', 'kind', n.label)); box.append(where);
    const para = el('p', 'para'); para.id = 'biz-card-para';
    if (n.place?.before) para.append(el('span', 'dim', n.place.before + ' '));
    if (n.place?.mark) para.append(el('span', n.place.changed ? 'mark new' : n.state === 'kept' ? 'mark' : 'mark bad', n.place.mark));
    if (n.place?.after) para.append(el('span', 'dim', ' ' + n.place.after));
    if (n.kind === 'thin' && n.draft) para.append(el('span', 'mark new', ' ' + n.draft));
    if (!para.childNodes.length) para.append(el('span', 'dim', '이 항목을 다룬 곳이 계획서에 없습니다.'));
    if (!para.querySelector('.mark')) para.classList.add('plain');
    const stage = el('div', 'stagearea'); stage.append(para); box.append(stage);

    const comp = el('div', 'biz-comp ask');
    const row = el('div', 'ask-row'); row.append(sprite(n.state === 'open' ? (n.kind === 'mismatch' ? 'look' : 'curious') : 'happy'));
    const sayLine = el('p', 'say-line', n.state === 'open' ? n.what : n.done); sayLine.id = 'biz-card-say';
    const words = el('div'); words.append(sayLine);
    if (n.evidence && n.state === 'open') { const ev = el('p', 'ev'); ev.append(icon('data'), el('span', '', n.evidence.from), el('b', '', n.evidence.text)); words.append(ev); }
    row.append(words); comp.append(row);

    if (n.state !== 'open') {
      const a = el('div', 'acts'); for (const [t, act, arg] of n.acts) a.append(btn(t, act, arg, 'chip', !!sc.busy));
      a.append(el('span', 'sp'));
      const [nk, nl] = nextOf(sc, n);
      a.append(btn(nl, 'biz-go', nk, 'go'));
      comp.append(a); box.append(comp); return box;
    }
    if (n.editing) {
      comp.append(field('edit', n.editing.text, '고칠 문장', 3, 'biz-ta serif'));
      const a = el('div', 'acts'); a.append(btn('그만두기', 'biz-edit-cancel', '', 'chip'), el('span', 'sp'), btn('이 문장으로', 'biz-edit-save', '', 'go', !!sc.busy));
      comp.append(a); box.append(comp); return box;
    }
    if (n.handing) {
      const h = el('div', 'hand');
      h.append(el('small', '', '맡길 글'), el('p', 'pre', n.handing.text));
      const pickRow = (label, opts, act) => { const g = el('div', 'picks'); g.setAttribute('role', 'group'); g.setAttribute('aria-label', label); g.append(el('span', 'lab', label)); for (const [t, v, on] of opts) { const b = btn(t, act, v, 'chip'); b.setAttribute('aria-pressed', String(!!on)); g.append(b); } return g; };
      h.append(pickRow('맡을 부서', n.handing.depts.map(([t, v]) => [t, v, v === n.handing.dept]), 'biz-hand-dept'),
        pickRow('맡을 직원', [['Claude', 'claude', n.handing.provider === 'claude'], ['GPT', 'codex', n.handing.provider === 'codex']], 'biz-hand-provider'),
        field('extra', '', '덧붙일 말(쓰지 않아도 됩니다)', 2));
      comp.append(h);
      const a = el('div', 'acts'); a.append(btn('닫기', 'biz-hand', n.key, 'chip'), el('span', 'sp'), btn('맡기기', 'biz-hand-send', '', 'go', !!sc.busy));
      comp.append(a); box.append(comp); return box;
    }
    if (n.asking) {
      // 같이 쓰기: 물음을 하나씩. 다 고르면 초안과 「이 문단 넣기」
      const j = n.asking.asks.findIndex(a => !a.opts.some(o => o[2]));
      n.asking.asks.forEach((a, k) => {
        if (j >= 0 && k >= j) return;
        const got = a.opts.find(o => o[2]);
        const p = el('p', 'picked'); p.append(el('span', '', a.q), el('b', '', got ? got[0] : ''));
        const re = btn('바꾸기', 'biz-reanswer', `${n.item}|${k}`, 'x', !!sc.busy); re.setAttribute('aria-label', `${a.q} 다시 고르기`); p.append(re);
        comp.append(p);
      });
      if (j >= 0) {
        const a = n.asking.asks[j];
        comp.append(el('p', 'q', `${a.q}${n.asking.asks.length > 1 ? ` (${j + 1}/${n.asking.asks.length})` : ''}`));
        const opts = el('div', 'opts');
        for (const [label, arg] of a.opts) { const o = btn('', 'biz-answer', arg, 'opt'); o.append(el('b', '', label)); opts.append(o); }
        comp.append(opts);
      } else comp.append(el('p', 'fix', n.asking.draft));
      const a = el('div', 'acts'); a.append(btn('닫기', 'biz-ask', n.item, 'chip'), el('span', 'sp'), btn('이 문단 넣기', 'biz-draft-put', n.item, 'go', !n.asking.ready || !!sc.busy));
      comp.append(a); box.append(comp); return box;
    }
    if (n.fix) comp.append(el('p', 'fix', n.fix));
    if (n.locked) comp.append(el('p', 'note-line', n.locked));
    const acts = el('div', 'acts');
    const keep = n.acts.find(x => x[2] === n.key + '|keep');
    if (keep) acts.append(key(btn(keep[0], keep[1], keep[2], 'chip', !!sc.busy), '→'));
    const edit = n.acts.find(x => x[1] === 'biz-edit');
    const hand = n.acts.find(x => x[1] === 'biz-hand');
    const fix = n.acts.find(x => x[2] === n.key + '|fix');
    const ask = n.acts.find(x => x[1] === 'biz-ask');
    if (edit && (fix || hand)) acts.append(btn('직접 쓰기', edit[1], edit[2], 'chip', !!sc.busy));
    if (hand && fix) acts.append(btn(hand[0], hand[1], hand[2], 'chip', !!sc.busy));
    // 빈약한 항목은 그대로 두기가 없다. 쓰지 않고 다음 장으로 넘어갈 수 있게 한다
    if (n.kind === 'thin') { const [nk, nl] = nextOf(sc, n); acts.append(key(btn(nl, 'biz-go', nk, 'chip'), '→')); }
    acts.append(el('span', 'sp'));
    const main = fix ? ['이렇게 고치기', fix[1], fix[2]] : hand ? [hand[0], hand[1], hand[2]] : edit ? ['직접 쓰기', edit[1], edit[2]] : ask ? ['같이 쓰기', ask[1], ask[2]] : null;
    if (main) acts.append(key(btn(main[0], main[1], main[2], 'go', !!sc.busy), 'Enter'));
    comp.append(acts); box.append(comp);
    for (const b of acts.querySelectorAll('button')) b.setAttribute('aria-describedby', 'biz-card-where biz-card-para biz-card-say');
    return box;
  }

  function notesStage(sc, root) {
    const open = sc.notes.filter(n => n.state === 'open').length;
    const selCard = sc.notes.find(n => n.sel);
    const showDone = !sc.notes.length || !selCard;
    if (!showDone && selCard) {
      const steps = el('div', 'biz-steps');
      const segs = el('div', 'segs');
      sc.notes.forEach((n, i) => {
        const s = btn('', 'biz-go', n.key, 'seg' + (n.sel ? ' on' : n.state === 'kept' ? ' kept' : n.state !== 'open' ? ' ok' : ''));
        s.setAttribute('aria-label', `${i + 1}번째 · ${n.place?.title || n.label}${n.state !== 'open' ? ' · ' + n.done : ''}`);
        if (n.sel) s.setAttribute('aria-current', 'step');
        segs.append(s);
      });
      steps.append(segs, el('span', 'count', `${sc.at + 1} / ${sc.notes.length}`), btn('전체 보기', 'biz-sheet', '', 'chip'));
      root.append(steps, card(selCard, sc));
      return;
    }
    root.append(say(sc), hero(sc.saved ? 'happy' : 'happy', true));
    const comp = el('div', 'biz-comp done');
    const bar = el('div', 'biz-bar');
    const f = el('div', 'file bare'); f.append(icon('plan'));
    const fname = sc.saved ? sc.saved.name : sc.planName || '', fb = el('b', '', fname); fb.title = fname;
    const t = el('span'); t.append(fb, el('small', '', sc.saved ? '방금 저장 · 원본 옆' : '고친 판을 원본 옆에 새 파일로 저장합니다'));
    f.append(t);
    if (sc.saved || sc.changes) bar.append(f);
    bar.append(el('span', 'sp'));
    if (sc.notes.length) bar.append(btn('다시 보기', 'biz-go', sc.notes[0].key, 'chip'));
    bar.append(btn('다시 읽기', 'biz-start', '', 'chip', !!sc.busy));
    if (sc.saved) bar.append(btn('폴더에서 보기', 'biz-reveal', '', 'go', !!sc.busy));
    else bar.append(btn('저장', 'biz-save', '', 'go', !sc.changes || !!sc.busy || sc.planChanged));
    comp.append(bar); root.append(comp);
    if (sc.changed?.length) {
      const ul = el('ul', 'biz-diffs');
      for (const c of sc.changed) { const li = el('li', c.hand ? 'hand' : ''); li.append(el('span', '', c.text)); if (c.tag) li.append(el('small', '', c.tag)); ul.append(li); }
      root.append(ul);
    }
  }

  function sheetNode(sc) {
    const s = el('div', 'biz-sheet'); s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true'); s.setAttribute('aria-label', '고칠 곳 전체');
    const in_ = el('div', 'in');
    const h = el('div', 'sheet-h'); h.append(el('h3', '', `고칠 곳 ${sc.notes.length}`), btn('닫기', 'biz-sheet', '', 'chip'));
    in_.append(h);
    for (const n of sc.notes) {
      const r = btn('', 'biz-go', n.key, 'row' + (n.state === 'kept' ? ' kept' : n.state !== 'open' ? ' ok' : ''));
      const dot = el('i'); dot.setAttribute('aria-hidden', 'true');
      r.append(dot, el('span', '', n.kind === 'thin' ? `${n.item}에 빠진 내용` : n.quote || n.what), el('small', '', n.state === 'open' ? n.label : n.state === 'kept' ? '그대로' : n.state === 'handed' ? '맡김' : '고침'));
      in_.append(r);
    }
    s.append(in_); return s;
  }

  // 알림 자리는 한 번 만들어 두고 글만 바꾼다. 그릴 때마다 새로 만들면 화면 읽기 프로그램이 알림을 놓친다(코드 검수 P2-9)
  const body = doc.createElement('div');
  const liveEl = doc.createElement('p'); liveEl.className = 'more-note biz-live'; liveEl.setAttribute('role', 'status'); liveEl.setAttribute('aria-live', 'polite');
  host.addEventListener('compositionstart', () => { composing = true; });
  host.addEventListener('compositionend', () => { composing = false; if (pending !== undefined) { const p = pending; pending = undefined; render(p); } });
  function render(sc) {
    if (sc && composing && host.contains(doc.activeElement)) { pending = sc; cur = sc; return; }
    pending = undefined;
    cur = sc || null;
    if (!sc) { host.hidden = true; host.replaceChildren(); liveEl.textContent = ''; lastKey = ''; return; }
    host.hidden = false;
    if (body.parentNode !== host || liveEl.parentNode !== host) host.replaceChildren(body, liveEl);
    const values = fields(), focus = doc.activeElement && host.contains(doc.activeElement) ? doc.activeElement : null;
    // 머리글이나 이름 없는 곳에 있던 초점도 다시 그린 뒤 이 화면 안에 남긴다(열자마자 자판이 듣게)
    // 같은 동작이라도 다른 자리의 단추(단계 막대와 「다음 고칠 곳」)로 초점이 건너가지 않게 첫 class까지 맞춘다
    const fcls = focus?.classList?.[0] || '';
    const fkey = focus?.dataset?.bizF ? 'f:' + focus.dataset.bizF : focus?.dataset?.bizAct ? 'a:' + focus.dataset.bizAct + '|' + (focus.dataset.bizArg || '') : focus ? 'h:' : '';
    const sel = focus && 'selectionStart' in focus ? [focus.selectionStart, focus.selectionEnd] : null;
    const hadEdit = !!host.querySelector('[data-biz-f="edit"]');
    const root = el('div', 'biz');
    const top = el('div', 'biz-top'); top.append(btn(sc.back, 'biz-close', '', 'biz-back'));
    root.append(top);
    if (sc.planChanged) { const w = el('div', 'biz-warn'); w.append(el('p', '', '계획서 파일이 읽은 뒤에 바뀌었습니다. 다시 읽은 뒤 저장할 수 있습니다.'), btn('다시 읽기', 'biz-start', '', 'chip', !!sc.busy)); root.append(w); }

    if (sc.stage === 'notes') notesStage(sc, root);
    else if (sc.stage === 'reading' || sc.stage === 'waiting') {
      root.append(say(sc), hero(sc.stage === 'reading' ? 'read' : 'sleepy'));
      const comp = el('div', 'biz-comp');
      const r = el('div', 'biz-read');
      const line = el('div', 'line'); line.append(el('span', 'shine', sc.stage === 'reading' ? (sc.progress?.title ? `「${sc.progress.title}」 읽는 중` : '읽고 있습니다') : '자리를 기다리고 있습니다'));
      if (sc.progress) line.append(el('span', 'count', `${sc.progress.part} / ${sc.progress.total}`));
      r.append(line);
      if (sc.taskId) r.append(btn('멈추기', 'biz-cancel', sc.taskId, 'chip', !!sc.busy));
      if (sc.progress?.total) { const segs = el('div', 'segs'); for (let i = 1; i <= sc.progress.total; i++) segs.append(el('i', i < sc.progress.part ? 'full' : i === sc.progress.part ? 'on' : '')); r.append(segs); }
      comp.append(r); root.append(comp, el('p', 'biz-foot', '다른 일을 하셔도 됩니다. 끝나면 사무실 맨 위 문장과 이 화면이 알려 드립니다.'));
    } else if (sc.stage === 'start' || sc.stage === 'failed' || sc.stage === 'stopped') {
      root.append(say(sc), hero(sc.stage === 'start' ? (sc.list?.plan ? 'drop' : 'open') : 'sleepy'), composer(sc), el('p', 'biz-foot', sc.privacy));
    } else {
      root.append(say(sc));
    }
    if (sc.stage !== 'loading' && sc.stage !== 'reading' && sc.stage !== 'waiting' && (sc.stage !== 'start' || sc.broken) && !(sc.stage === 'notes' && sc.notes.some(n => n.sel) && sc.notes.some(n => n.state === 'open'))) {
      const c = el('div', 'biz-clear');
      if (sc.clearAsk) c.append(el('p', '', '읽은 결과와 고른 것을 지웁니다. 계획서와 회사 자료 파일은 그대로 둡니다.'), btn('지우기', 'biz-clear', '', 'chip', !!sc.busy), btn('그만두기', 'biz-clear-ask', '', 'link'));
      else c.append(btn('기록 지우기', 'biz-clear-ask', '', 'link'));
      root.append(c);
    }
    if (sc.stage === 'notes' && sc.sheet) { for (const c of root.children) c.inert = true; root.append(sheetNode(sc)); }
    if (sc.toast) {
      const t = el('div', 'biz-toast'); t.append(el('span', '', sc.toast.text), btn('되돌리기', 'biz-choose', sc.toast.key + '|undo', 'link', !!sc.busy));
      root.append(t);
    }
    body.replaceChildren(root);
    if (liveEl.textContent !== (sc.live || '')) liveEl.textContent = sc.live || '';
    // 알림(되돌리기)과 같은 글은 화면에 두 번 보이지 않게 낭독기에만 준다
    liveEl.classList.toggle('sr', !!sc.toast && sc.live === sc.toast.text);
    for (const n of host.querySelectorAll('[data-biz-f]')) if (Object.hasOwn(values, n.dataset.bizF)) n.value = values[n.dataset.bizF];
    if (fkey) {
      const [k, v] = [fkey.slice(0, 2), fkey.slice(2)];
      const again = k === 'f:' ? host.querySelector(`[data-biz-f="${CSS.escape(v)}"]`) : k === 'h:' ? host.querySelector('[data-biz-head]') : (same => same.find(x => (x.classList[0] || '') === fcls) || null)([...host.querySelectorAll('[data-biz-act]')].filter(x => x.dataset.bizAct + '|' + (x.dataset.bizArg || '') === v));
      if (again && !again.disabled) { again.focus({ preventScroll: true }); if (sel && 'setSelectionRange' in again) try { again.setSelectionRange(...sel); } catch {} }
      // 누른 단추가 사라지면 초점이 문서 처음으로 날아가지 않게, 지금 장의 주 단추나 머리글로 옮긴다
      else (host.querySelector('.biz-card .go:not([disabled])') || host.querySelector('.biz-card .opts .opt') || host.querySelector('[data-biz-head]') || host.querySelector('.biz-card'))?.focus({ preventScroll: true });
    }
    if (!hadEdit && sc.stage === 'notes' && sc.notes.find(n => n.sel)?.editing) host.querySelector('[data-biz-f="edit"]')?.focus({ preventScroll: true });
    if (sc.stage === 'notes' && sc.sheet && !host.querySelector('.biz-sheet')?.contains(doc.activeElement)) host.querySelector('.biz-sheet .row, .biz-sheet button')?.focus({ preventScroll: true });
    const k2 = sc.stage + ':' + (sc.sel || '');
    if (k2 !== lastKey) {
      const first = lastKey === '' || lastKey.startsWith('loading:');
      lastKey = k2;
      if (!first) host.querySelector('.biz-steps, .biz-say')?.scrollIntoView?.({ block: 'nearest' });
    }
  }
  return { render, focusHead: () => (host.querySelector('[data-biz-head]') || host.querySelector('.biz-card .go'))?.focus() };
}
