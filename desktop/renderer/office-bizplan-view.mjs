/* 기획부 「사업계획서」 작업 화면 그리기(사업계획서_설계.md 6절, 14.1).
   검토 화면 새 시안(docs/디자인/솔리오_사업계획서_검토화면_20261126)의 짜임이다. 흰 종이를 두지 않는다(결정 11-26).
   놓는 자리 하나에 계획서 · 회사 자료 · 평가 기준 · 직원이 모이고, 고칠 곳은 한 번에 한 장씩 묻는다.
   글은 모두 textContent로 넣는다. 다시 그릴 때 쓰던 칸의 글과 초점을 지킨다 */

const ART = { desk: '/assets/bizplan/desk.jpg', orb: '/assets/bizplan/orb.webp' };
/* 심사 무대(14.3): 쓰기 시안의 블렌더 그림. 판 위에 발표자와 심사위원 셋, 점수판 셋을 겹친다(자리.json의 자리는 CSS에) */
const STAGE = '/assets/bizplan/stage/';
const STAGE_ART = { plate: STAGE + 'plate.webp', presenter: STAGE + 'presenter.webp', judge: [0, 1, 2].map(k => `${STAGE}judge${k}.webp`), paddle: [0, 1, 2].map(k => `${STAGE}paddle${k}.webp`) };
/* 쓰는 동안 솔리오의 한마디(쓰기 시안 coach와 같다). 숫자가 필요한 장은 숫자를 묻는다 */
const HAS_NUM = t => /[0-9]/.test(t) || /(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|스무|서른|마흔|쉰|백|천|만|억)\s?(?:명|개|곳|원|번|달|해|배|가지|살|시간|년|퍼센트)/.test(t);
const coach = (num, v) => { const t = String(v || '').trim(); if (!t) return ['open', '']; if (t.length < 16) return ['look', '듣고 있어요.']; if (num && !HAS_NUM(t)) return ['curious', '숫자를 하나 넣으면 훨씬 잘 믿어요.']; return ['happy', num ? '숫자가 들어갔어요.' : '좋아요. 이대로 넘어가도 돼요.']; };
const DEFAULT_ITEMS = ['문제 인식', '실현 가능성', '성장 전략', '팀 구성']; // 본체 office-bizplan-check.cjs와 같다
const SVG = 'http://www.w3.org/2000/svg';
/* 구의 눈(팀 고르기 4판 결: 작고 둥근 점 눈). 표정은 눈 모양과 보는 곳만 바꾼다 */
const MOOD = { open: ['calm', 0, 0], look: ['calm', 3, 5], happy: ['smile', 0, 0], curious: ['calm', 5, -3], side: ['calm', 6, 2], sleepy: ['half', 0, 4], drop: ['calm', 2, 9], read: ['calm', -3, 10], nervous: ['half', -2, 2] };
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
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.isComposing && e.target.closest?.('[data-biz-write]')) { e.preventDefault(); host.querySelector('.biz-write .go:not([disabled])')?.click(); return; }
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
    else if (e.key === 'ArrowRight') { e.preventDefault(); if (n.kind !== 'thin' && n.kind !== 'empty') send({ act: 'biz-choose', arg: n.key + '|keep', fields: {} }); else send({ act: 'biz-go', arg: nextOf(cur, n)[0], fields: {} }); }
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
  const menu = (id, label, opts, act, sc, tail = null) => {
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
      if (tail) m.append(...tail());
      wrap.append(m);
    }
    return wrap;
  };
  /* 직원 메뉴 아래의 켜고 끄는 줄(설계 14.7 손님 설정). 고른 직원과 따로 저장된다 */
  const othersSwitch = sc => {
    // 저장하는 동안 잠그면 다시 그릴 때 초점이 머리글로 날아간다. 잠그지 않아 자판 초점이 스위치에 남는다(Opus 대체 화면 검수 P2)
    const o = btn('', 'biz-others', '', 'opt switch', false); o.setAttribute('role', 'menuitemcheckbox'); o.setAttribute('aria-checked', String(!!sc.others?.on));
    const t = el('span', 'tx'); t.append(el('b', '', sc.others.label), el('small', '', sc.others.small));
    const tg = el('i', 'tg'); tg.setAttribute('aria-hidden', 'true');
    o.append(t, tg);
    return [el('hr', 'sep'), o];
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
      menu('crit', sc.criteria.mode === 'pasted' ? '공고문 기준' : '창업 지원사업 기준', [['창업 지원사업 기준', 'default', sc.criteria.mode === 'default', DEFAULT_ITEMS.join(' · ')], ['공고문 기준', 'pasted', sc.criteria.mode === 'pasted', sc.list.criteria?.mode === 'pasted' && sc.list.criteria.text ? `붙여 넣은 평가 항목 ${sc.list.items.length}개` : '공고의 평가 항목을 붙여 넣습니다']], 'biz-criteria', sc),
      menu('staff', sc.provider === 'codex' ? 'GPT 직원' : 'Claude 직원', [['Claude 직원', 'claude', sc.provider === 'claude', '내 Claude 구독으로 읽습니다'], ['GPT 직원', 'codex', sc.provider === 'codex', '내 ChatGPT 구독으로 읽습니다']], 'biz-provider', sc, sc.others ? () => othersSwitch(sc) : null),
      el('span', 'sp'), btn(sc.draftReady ? '고치기 · 채우기' : '읽기', 'biz-start', '', 'go', !plan || !!sc.busy));
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
    if (!para.childNodes.length) para.append(el('span', 'dim', n.kind === 'empty' ? '이 장은 아직 비어 있습니다.' : '이 항목을 다룬 곳이 계획서에 없습니다.'));
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
    const write = n.acts.find(x => x[1] === 'biz-write-open');
    if (edit && (fix || hand)) acts.append(btn('직접 쓰기', edit[1], edit[2], 'chip', !!sc.busy));
    if (hand && fix) acts.append(btn(hand[0], hand[1], hand[2], 'chip', !!sc.busy));
    // 빈약한 항목은 그대로 두기가 없다. 쓰지 않고 다음 장으로 넘어갈 수 있게 한다
    if (n.kind === 'thin' || n.kind === 'empty') { const [nk, nl] = nextOf(sc, n); acts.append(key(btn(nl, 'biz-go', nk, 'chip'), '→')); }
    acts.append(el('span', 'sp'));
    const main = fix ? ['이렇게 고치기', fix[1], fix[2]] : hand ? [hand[0], hand[1], hand[2]] : edit ? ['직접 쓰기', edit[1], edit[2]] : ask ? ['같이 쓰기', ask[1], ask[2]] : write ? ['직접 쓰기', write[1], write[2]] : null;
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
      steps.append(segs, el('span', 'count', `${sc.at + 1} / ${sc.notes.length}`));
      if (sc.scoreLink) steps.append(btn('심사 결과 보기', 'biz-score-open', '', 'chip'));
      steps.append(btn('전체 보기', 'biz-sheet', '', 'chip'));
      root.append(steps, card(selCard, sc));
      return;
    }
    root.append(say(sc), hero(sc.saved ? 'happy' : 'happy', true));
    if (sc.scoreLink) {
      const line = el('p', 'biz-scoreline');
      if (sc.scoreLink.tally) line.append(el('span', '', `심사 결과 ${sc.scoreLink.tally}`));
      line.append(btn('심사 결과 보기', 'biz-score-open', '', 'link'));
      root.append(line);
    }
    const comp = el('div', 'biz-comp done');
    const bar = el('div', 'biz-bar');
    const f = el('div', 'file bare'); f.append(icon('plan'));
    const fname = sc.saved ? sc.saved.name : sc.planName || '', fb = el('b', '', fname); fb.title = fname;
    const t = el('span'); t.append(fb, el('small', '', sc.saved ? '방금 저장 · 원본 옆' : '고친 판을 원본 옆에 새 파일로 저장합니다'));
    f.append(t);
    if (sc.saved || sc.changes) bar.append(f);
    bar.append(el('span', 'sp'));
    if (sc.notes.length) bar.append(btn('다시 보기', 'biz-go', sc.notes[0].key, 'chip'));
    // 고른 고침을 넣은 판으로 같은 심사위원에게 다시 묻는다(14.3). 계획서가 바뀌었으면 다시 읽어야 한다
    if (sc.rescore) bar.append(btn('다시 심사받기', 'biz-rescore', '', 'chip', !!sc.busy));
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

  /* 직접 쓰기(14.2): 물음 하나, 쓰는 칸 하나. 솔리오가 그 장이 왜 필요한지 말한다 */
  function writeStage(sc, root) {
    const steps = el('div', 'biz-steps'), segs = el('div', 'segs');
    sc.segs.forEach((s, k) => { const b = btn('', 'biz-write-go', k, 'seg' + (s.state ? ' ' + s.state : ''), !!sc.busy); b.setAttribute('aria-label', `${k + 1}번째 장 · ${s.name}${s.state === 'ok' ? ' · 씀' : s.state === 'skip' ? ' · 건너뜀' : ''}`); if (s.state === 'on') b.setAttribute('aria-current', 'step'); segs.append(b); });
    steps.append(segs, el('span', 'count', `${sc.q + 1} / ${sc.segs.length}`), btn('나중에 쓰기', 'biz-write-later', '', 'chip', !!sc.busy));
    const box = el('section', 'biz-card biz-write'); box.tabIndex = -1;
    const head = el('div', 'stagearea qhead');
    const no = el('p', 'qno'); no.append(el('span', '', sc.chapter.no), doc.createTextNode(sc.chapter.name));
    const qq = el('h2', 'qq', sc.chapter.q); qq.id = 'biz-write-q'; qq.tabIndex = -1; qq.dataset.bizHead = '';
    head.append(no, qq);
    const comp = el('div', 'biz-comp ask');
    const [mood, tip] = coach(sc.chapter.num, sc.text);
    const row = el('div', 'ask-row'), sp = sprite(mood); sp.dataset.mood = mood;
    const words = el('div'); words.append(el('p', 'say-line', sc.chapter.why), el('span', 'tip', tip));
    row.append(sp, words);
    const ta = field('answer-' + sc.q, sc.text, sc.chapter.q, 4, 'biz-ta serif ans');
    ta.dataset.bizWrite = ''; ta.placeholder = '예: ' + sc.chapter.ex; ta.maxLength = 4000; ta.setAttribute('aria-labelledby', 'biz-write-q'); ta.removeAttribute('aria-label');
    const acts = el('div', 'acts');
    acts.append(btn('이 장 건너뛰기', 'biz-write-skip', '', 'chip', !!sc.busy), el('span', 'sp'), key(btn(sc.last ? '다 썼습니다' : '다음', 'biz-write-next', '', 'go', !!sc.busy || !sc.text.trim()), 'Ctrl Enter'));
    comp.append(row, ta, acts);
    box.append(head, comp);
    root.append(steps, box);
    if (sc.edited) root.append(el('p', 'biz-foot', sc.editedNote));
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

  /* ── 심사 무대(14.3) ──
     같은 무대(show.key)는 한 번 짓고 바뀐 곳만 고친다. 사무실이 15초마다 다시 그려도 처음부터 틀지 않고, 옅어짐이 끊기지 않는다.
     움직임은 옅어짐과 눈만. 생각하는 점 셋은 읽는 심사위원 위에만 */
  let show = null;
  /* ○ △ ✕ 표시(설계 14.3): 첫 업무 심사 시안의 그림과 같은 선. 색은 CSS가 표시마다 하나씩 준다 */
  const MARK_D = { v: 'M4.1 10.4 8.2 14.5 15.9 5.3', t: 'M10 3.4 16.9 15.6H3.1Z', x: 'M4.6 4.6 15.4 15.4M15.4 4.6 4.6 15.4' };
  const MARK_W = { v: '2.5', o: '2.4', t: '2.3', x: '2.5' };
  const MARK_NAME = { v: '✓ 강점', o: '○ 갖춤', t: '△ 보완', x: '✕ 빠짐' };
  const markSvg = (m, hidden = false) => {
    const s = doc.createElementNS(SVG, 'svg');
    s.setAttribute('class', 'mk mk-' + m); s.setAttribute('viewBox', '0 0 20 20');
    if (hidden) s.setAttribute('aria-hidden', 'true'); else { s.setAttribute('role', 'img'); s.setAttribute('aria-label', MARK_NAME[m]); }
    const g = doc.createElementNS(SVG, m === 'o' ? 'circle' : 'path');
    if (m === 'o') { g.setAttribute('cx', '10'); g.setAttribute('cy', '10'); g.setAttribute('r', '6.3'); } else g.setAttribute('d', MARK_D[m]);
    g.setAttribute('fill', 'none'); g.setAttribute('stroke-width', MARK_W[m]); g.setAttribute('stroke-linecap', 'round'); g.setAttribute('stroke-linejoin', 'round');
    s.append(g); return s;
  };
  /* 표시 수 한 줄: [[표시, 수], …]. label이면 갖춤 · 보완 · 빠짐도 붙인다 */
  const tallyEl = (list, label = false) => {
    const t = el('span', 'tally');
    for (const [m, n] of list) { const s = el('span', 'tl tl-' + m); s.append(markSvg(m), el('b', '', String(n))); if (label) { const sm = el('small', '', MARK_NAME[m].slice(2)); sm.setAttribute('aria-hidden', 'true'); s.append(sm); } t.append(s); }
    return t;
  };
  /* 표시 방식 고르기(설계 14.3): 회색 홈 안에서 고른 칸만 어두운 젤리 알약이 옮겨 간다.
     화면은 그릴 때마다 새로 짓지만 이 노드는 한 번 지어 옮겨 단다. 다시 그려도 젤리가 끊기지 않는다 */
  let pick = null;
  const still = () => doc.documentElement?.dataset?.motion === 'reduced' || !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function marksPick(p) {
    if (!pick) {
      const g = el('div', 'biz-marks'); g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', p.label);
      const jelly = el('span', 'jelly'); jelly.setAttribute('aria-hidden', 'true'); g.append(jelly);
      const bs = p.options.map(o => {
        const b = btn('', 'biz-marks', String(o.value), 'mpick'); b.setAttribute('role', 'radio');
        b.setAttribute('aria-label', `${o.label}: ${o.marks.map(m => MARK_NAME[m].slice(0, 1)).join(' ')}`);
        const ms = el('span', 'seg-m'); for (const m of o.marks) ms.append(markSvg(m, true));
        b.append(el('span', '', o.label), ms); g.append(b); return b;
      });
      // 화살표 · Home · End로 고른다(라디오 묶음)
      g.addEventListener('keydown', e => {
        const k = bs.findIndex(b => b.getAttribute('aria-checked') === 'true');
        const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? Math.min(bs.length - 1, k + 1) : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? Math.max(0, k - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? bs.length - 1 : -1;
        if (to < 0) return;
        e.preventDefault();
        if (to !== k) { bs[to].focus(); bs[to].click(); }
      });
      pick = { g, jelly, bs, value: null, at: null };
    }
    const on = p.options.find(o => o.on)?.value ?? 3;
    pick.bs.forEach((b, i) => { const c = p.options[i].value === on; b.setAttribute('aria-checked', String(c)); b.tabIndex = c ? 0 : -1; });
    pick.move = pick.value !== null && pick.value !== on;
    pick.value = on;
    return pick.g;
  }
  /* 젤리를 고른 칸에 둔다. 옮겨 갈 때만 앞쪽 끝이 먼저 닿고 뒤쪽 끝이 따라오게 늘었다 줄어든다(움직임 줄이기면 바로) */
  function placePick() {
    if (!pick || !pick.g.isConnected) return;
    const on = pick.bs.find(b => b.getAttribute('aria-checked') === 'true'); if (!on) return;
    const to = { x: on.offsetLeft, w: on.offsetWidth }, from = pick.at, jelly = pick.jelly;
    if (!to.w) return;
    jelly.style.transform = `translateX(${to.x}px)`; jelly.style.width = to.w + 'px';
    if (pick.move && from && from.x !== to.x && !still() && jelly.animate) {
      const r = to.x > from.x, L = (a, c, t) => a + (c - a) * t;
      const l = r ? L(from.x, to.x, 0.22) : L(from.x, to.x, 0.78), rr = r ? L(from.x + from.w, to.x + to.w, 0.78) : L(from.x + from.w, to.x + to.w, 0.22);
      jelly.animate([
        { transform: `translateX(${from.x}px) scaleY(1)`, width: from.w + 'px' },
        { transform: `translateX(${l}px) scaleY(.88)`, width: (rr - l) + 'px', offset: 0.45 },
        { transform: `translateX(${to.x}px) scaleY(1.05)`, width: to.w + 'px', offset: 0.78 },
        { transform: `translateX(${to.x}px) scaleY(1)`, width: to.w + 'px' },
      ], { duration: 480, easing: 'cubic-bezier(.3,.7,.25,1)' });
    }
    pick.move = false; pick.at = to;
    pick.g.classList.add('on');
  }
  const layer = src => { const i = el('img', 'lay'); i.src = src; i.alt = ''; i.decoding = 'async'; return i; };
  const dots = () => { const s = el('span', 'dots'); s.setAttribute('aria-hidden', 'true'); s.append(el('i'), el('i'), el('i')); return s; };
  const setText = (node, t) => { if (node.textContent !== t) node.textContent = t; };
  const replay = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };
  function buildShow(sc) {
    const n = { judges: [], cards: [], built: false };
    const head = el('div', 'biz-say'); head.tabIndex = -1; head.dataset.bizHead = '';
    n.h = el('h2'); n.p = el('p'); head.append(n.h, n.p);
    const stage = el('div', 'biz-stage'); stage.setAttribute('role', 'img'); n.stage = stage;
    const scene = el('div', 'scene'); stage.append(scene);
    scene.append(layer(STAGE_ART.plate));
    n.ez = el('div', 'ez'); n.ez.setAttribute('aria-hidden', 'true'); scene.append(n.ez);
    const pr = el('div', 'actor presenter in'); n.prOrb = el('span', 'orb'); pr.append(layer(STAGE_ART.presenter), n.prOrb); scene.append(pr);
    for (let k = 0; k < 3; k++) {
      const a = el('div', `actor judge j${k}`), tag = el('span', 'jtag');
      a.append(layer(STAGE_ART.judge[k]), tag); scene.append(a);
      n.judges[k] = { a, tag };
    }
    for (let k = 0; k < 3; k++) { const pd = el('div', `pd pd${k}`), num = el('b', 'pd-n'); pd.append(layer(STAGE_ART.paddle[k]), num); scene.append(pd); Object.assign(n.judges[k], { pd, num }); }
    for (let k = 0; k < 3; k++) { const sb = el('div', `sb sb-j${k}`); sb.setAttribute('aria-hidden', 'true'); scene.append(sb); n.judges[k].sb = sb; }
    n.stot = el('div', 'stot'); n.stotB = el('b'); n.stotS = el('small'); n.stot.append(n.stotB, n.stotS); scene.append(n.stot);
    n.cap = el('p', 'cap');
    const cards = el('div', 'biz-judges');
    for (let k = 0; k < 3; k++) {
      const c = el('div', 'jc'), b = el('b'), sm = el('small'), jr = el('div', 'jr'), bar = el('i'), st = el('span', 'st');
      jr.setAttribute('aria-hidden', 'true'); jr.append(bar); c.append(b, sm, jr, st); cards.append(c);
      n.cards[k] = { c, b, sm, st };
    }
    n.under = el('div', 'under');
    n.parts = [head, stage, n.cap, cards, n.under];
    return n;
  }
  function patchShow(n, sc) {
    const v = sc.show;
    setText(n.h, sc.head[0]); setText(n.p, sc.head[1] || ''); n.p.hidden = !sc.head[1];
    const sat = v.judges.filter(j => j.seated).map(j => j.name);
    // 말풍선의 혼잣말도 읽히게 무대 설명에 넣는다(카본 A6)
    const says = v.judges.filter(j => j.bubble?.say).map(j => `${j.name} 심사위원: ${j.bubble.say}`);
    n.stage.setAttribute('aria-label', `조명 아래 단상의 발표자 구와, 앞쪽 탁자에 뒷모습으로 앉은 심사위원 구가 있는 심사 무대. 앉은 심사위원: ${sat.join(', ')}${says.length ? '. ' + says.join('. ') : ''}`);
    if (n.ez.dataset.k !== v.sign.key) {
      n.ez.dataset.k = v.sign.key;
      n.ez.replaceChildren(el('span', 'mono', v.sign.top), el('b', '', v.sign.title), el('i'), el('i'), el('i'));
      if (n.built) replay(n.ez, 'flip');
    }
    if (n.prOrb.dataset.mood !== v.presenter) { n.prOrb.dataset.mood = v.presenter; n.prOrb.replaceChildren(eyes(v.presenter, 1.2)); }
    v.judges.forEach((j, k) => {
      const J = n.judges[k], C = n.cards[k];
      J.a.classList.toggle('in', j.seated); J.a.classList.toggle('rest', j.state === 'rest');
      if (!J.tag.childNodes.length) J.tag.append(doc.createTextNode(j.name), el('small', '', j.tag));
      const bs = j.bubble ? j.bubble.kind + '|' + j.bubble.say : '';
      if (J.sb.dataset.s !== bs) {
        J.sb.dataset.s = bs;
        if (j.bubble) { J.sb.className = `sb sb-j${k} ${j.bubble.kind}`; J.sb.replaceChildren(j.bubble.kind === 'dots' ? dots() : doc.createTextNode(j.bubble.say)); }
      }
      J.sb.classList.toggle('on', !!j.bubble);
      // 채점판: 그 심사위원의 표시 수를 세로로(○ 3 · △ 2 · ✕ 1)
      const ps = j.paddle ? JSON.stringify(j.paddle.tally) + '|' + j.paddle.name : '';
      if (J.num.dataset.s !== ps) {
        J.num.dataset.s = ps;
        if (j.paddle) J.num.replaceChildren(tallyEl(j.paddle.tally), el('small', '', j.paddle.name));
      }
      J.pd.classList.toggle('on', !!j.paddle);
      const cls = 'jc s-' + j.state + (j.fin ? ' fin' : '');
      if (C.c.className !== cls) C.c.className = cls;
      setText(C.b, j.name); setText(C.sm, `${j.co} · ${j.eye}`); setText(C.st, j.status);
    });
    n.stage.classList.toggle('m4', v.marks === 4);
    const ts = v.total ? JSON.stringify(v.total.tally) + '|' + v.total.small + '|' + v.total.was : '';
    if (n.stot.dataset.s !== ts) {
      n.stot.dataset.s = ts;
      if (v.total) { n.stotB.replaceChildren(tallyEl(v.total.tally)); n.stotS.replaceChildren(doc.createTextNode(v.total.small), ...(v.total.was ? [el('span', 'gain', ' · ' + v.total.was)] : [])); }
    }
    n.stot.classList.toggle('on', !!v.total);
    const cs = JSON.stringify(v.cap);
    if (n.cap.dataset.s !== cs) {
      n.cap.dataset.s = cs;
      n.cap.replaceChildren(...v.cap.map(([t, b]) => (b ? el('b', '', t) : doc.createTextNode(t))));
      if (n.built) replay(n.cap, 'swap');
    }
    const us = v.mode + '|' + (sc.taskId || '') + '|' + !!sc.busy;
    if (n.under.dataset.s !== us) {
      n.under.dataset.s = us;
      n.under.replaceChildren(v.mode === 'judging' ? btn('멈추기', 'biz-cancel', sc.taskId || '', 'chip', !!sc.busy || !sc.taskId) : btn('기다리지 않고 결과 보기', 'biz-score-skip', '', 'chip'));
    }
    n.built = true;
  }

  /* 점수 결과(w06): 표시 수와 가장 약한 항목, 표시 방식 고르기, 항목 × 심사위원 표시표(누르면 한마디 · 인용 · 채점 기준), 심사위원의 한 줄, 「고칠 곳 n 보기」 */
  function scoreStage(sc, root) {
    const v = sc.score, m4 = v.marks === 4 ? ' m4' : '';
    const top = el('section', 'biz-score' + m4);
    const words = el('div', 'words');
    if (v.tally.length) {
      const tot = el('div', 'total');
      tot.append(el('span', 'lab', v.lab), tallyEl(v.tally, true));
      if (v.was) tot.append(el('span', 'was', v.was));
      words.append(tot);
    }
    const h = el('h2', '', v.head[0]); h.tabIndex = -1; h.dataset.bizHead = '';
    words.append(h);
    if (v.head[1]) words.append(el('p', 'sub', v.head[1]));
    top.append(sprite(v.raised ? 'happy' : 'look', 'biz-sprite lg'), words);
    root.append(top);
    if (v.cols.length && v.rows.length) {
      const card = el('div', 'biz-scorecard' + m4), t = el('table', 'sc');
      const set = el('div', 'res-set'); set.append(el('h3', '', v.title), marksPick(v.pick));
      const thead = el('thead'), hr = el('tr');
      hr.append(el('th', '', '항목'), ...v.cols.map(c => el('th', '', c)));
      thead.append(hr);
      const tbody = el('tbody');
      for (const r of v.rows) {
        const tr = el('tr', [r.weak ? 'weak' : '', r.open ? 'open' : ''].filter(Boolean).join(' '));
        const first = el('td'), b = btn('', 'biz-score-row', r.crit, 'crit');
        b.setAttribute('aria-expanded', String(r.open));
        const ch = el('span', 'ch', '›'); ch.setAttribute('aria-hidden', 'true');
        b.append(ch, el('b', '', r.crit));
        if (r.weak) b.append(el('span', 'tag weak', '가장 약함'));
        if (r.split) b.append(el('span', 'tag split', '의견이 갈림'));
        if (r.fixed) b.append(el('span', 'tag fixed', '고친 뒤 나아짐'));
        first.append(b); tr.append(first);
        for (const c of r.cells) {
          const td = el('td', 'n'), cell = el('span', 'cell' + (c.up ? ' better' : ''));
          if (c.mark) { const g = markSvg(c.mark); if (c.up) g.setAttribute('aria-label', MARK_NAME[c.mark] + ', 고친 뒤 나아짐'); cell.append(g); }
          td.append(cell); tr.append(td);
        }
        tbody.append(tr);
        if (r.open) {
          const more = el('tr', 'expl'), td = el('td');
          td.colSpan = v.cols.length + 1;
          for (const m of r.more) {
            const w = el('div', 'why'), d = el('div'), pt = el('span', 'pt');
            if (m.mark) pt.append(markSvg(m.mark));
            d.append(el('p', '', m.why));
            if (m.quote) { const q = el('p', 'qs'); if (m.where) q.append(el('span', 'where', m.where)); q.append(el('span', 'qt', m.quote)); d.append(q); }
            w.append(el('span', 'who', m.name), pt, d);
            td.append(w);
          }
          // 채점 기준: 이 항목의 표시마다 뜻(시안의 「채점 기준 보기」)
          if (r.rubric.length) {
            const rub = el('div', 'rub'), dl = el('dl');
            for (const [mk, text] of r.rubric) { const row = el('div'); const dt = el('dt'); dt.append(markSvg(mk)); row.append(dt, el('dd', '', text)); dl.append(row); }
            rub.append(el('p', 'rub-h', '채점 기준'), dl); td.append(rub);
          }
          more.append(td); tbody.append(more);
        }
      }
      t.append(thead, tbody); card.append(set, t); root.append(card);
    }
    const ul = el('ul', 'biz-verdicts' + m4);
    for (const j of v.judges) {
      const li = el('li', 'verdict' + (j.rest ? ' rest' : ''));
      const name = el('b', '', j.name); if (j.co) name.append(el('small', '', `${j.co} · ${j.eye}`));
      const g = el('span', 'g'); if (j.tally.length) g.append(tallyEl(j.tally));
      li.append(sprite(j.rest ? 'sleepy' : 'look', 'biz-sprite'), name, g, el('p', '', j.line));
      ul.append(li);
    }
    root.append(ul);
    const go = el('div', 'res-go'); go.append(btn(v.go, 'biz-score-close', '', 'go'));
    root.append(go, el('p', 'biz-fine', v.fine));
  }

  // 알림 자리는 한 번 만들어 두고 글만 바꾼다. 그릴 때마다 새로 만들면 화면 읽기 프로그램이 알림을 놓친다(코드 검수 P2-9)
  const body = doc.createElement('div');
  const liveEl = doc.createElement('p'); liveEl.className = 'more-note biz-live'; liveEl.setAttribute('role', 'status'); liveEl.setAttribute('aria-live', 'polite');
  function syncWrite() {
    const a = host.querySelector('[data-biz-write]'); if (!a || cur?.stage !== 'write') return;
    const [mood, tip] = coach(cur.chapter.num, a.value);
    const t = host.querySelector('.biz-write .tip'); if (t) t.textContent = tip;
    const s = host.querySelector('.biz-write .biz-sprite'); if (s && s.dataset.mood !== mood) { s.dataset.mood = mood; s.querySelector('.biz-eyes')?.replaceWith(eyes(mood, 1.6)); }
    const g = host.querySelector('.biz-write .go'); if (g) { const off = !!cur.busy || !a.value.trim(); g.disabled = off; if (off) g.setAttribute('aria-disabled', 'true'); else g.removeAttribute('aria-disabled'); }
  }
  let typeTimer = 0;
  host.addEventListener('input', e => {
    const a = e.target.closest?.('[data-biz-write]'); if (!a || cur?.stage !== 'write') return;
    syncWrite();
    // 쓰던 글을 방에 남긴다(다시 그리지 않는다). 사무실이 다시 그려도, 방을 떠나도 글이 남는다
    const q = cur.q; clearTimeout(typeTimer);
    typeTimer = setTimeout(() => send({ act: 'biz-write-type', arg: String(q), fields: { ['answer-' + q]: a.value } }), 300);
  });
  host.addEventListener('compositionstart', () => { composing = true; });
  host.addEventListener('compositionend', () => { composing = false; if (pending !== undefined) { const p = pending; pending = undefined; render(p); } });
  function render(sc) {
    // 결과 화면을 떠나면 고르기의 앞 자리를 비운다. 표시 방식은 부서마다 설정이라, 다른 부서를 열 때 젤리가 미끄러지지 않게(Opus 대체 화면 검수 F4)
    if (pick && sc?.stage !== 'score') { pick.value = null; pick.at = null; pick.move = false; }
    if (sc && composing && host.contains(doc.activeElement)) { pending = sc; cur = sc; return; }
    pending = undefined;
    cur = sc || null;
    if (!sc) { host.hidden = true; host.replaceChildren(); liveEl.textContent = ''; lastKey = ''; show = null; return; }
    host.hidden = false;
    if (body.parentNode !== host || liveEl.parentNode !== host) host.replaceChildren(body, liveEl);
    // 같은 무대면 고쳐 쓰기만 한다(다시 그려도 무대가 처음부터 돌지 않게)
    if ((sc.stage === 'judging' || sc.stage === 'reveal') && show && show.key === sc.show.key && body.firstChild === show.root) {
      patchShow(show, sc);
      if (liveEl.textContent !== (sc.live || '')) liveEl.textContent = sc.live || '';
      liveEl.classList.remove('sr');
      lastKey = sc.stage + ':';
      return;
    }
    show = null;
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
    if (sc.planChanged && sc.stage !== 'write' && sc.stage !== 'reveal') { const w = el('div', 'biz-warn'); w.append(el('p', '', '계획서가 읽은 뒤에 바뀌었습니다. 다시 읽은 뒤 저장할 수 있습니다.'), btn('다시 읽기', 'biz-start', '', 'chip', !!sc.busy)); root.append(w); }
    if (sc.notice && sc.stage === 'notes') root.append(el('p', 'biz-notice', sc.notice));

    if (sc.stage === 'notes') notesStage(sc, root);
    else if (sc.stage === 'judging' || sc.stage === 'reveal') {
      show = buildShow(sc); show.key = sc.show.key; show.root = root;
      root.append(...show.parts);
      patchShow(show, sc);
    } else if (sc.stage === 'score') scoreStage(sc, root);
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
    } else if (sc.stage === 'write') {
      writeStage(sc, root);
    } else if (sc.stage === 'start' || sc.stage === 'failed' || sc.stage === 'stopped') {
      root.append(say(sc), hero(sc.stage === 'start' ? (sc.draftReady ? 'happy' : sc.list?.plan ? 'drop' : 'open') : 'sleepy', !!sc.draftReady), composer(sc));
      if (sc.chapters) {
        const ol = el('ol', 'biz-chapters');
        sc.chapters.forEach((c, k) => { const li = el('li', c.first ? '' : 'blank'); li.append(el('span', 'no', String(k + 1).padStart(2, '0')), el('b', '', c.name), el('span', 'first', c.first || '비어 있음')); ol.append(li); });
        root.append(ol);
      }
      const w = sc.writing;
      if (w && (!sc.list?.plan || w.isPlan)) {
        const p = el('p', 'biz-write-link');
        p.append(el('span', '', w.isPlan ? '초안을 더 쓰거나 고치려면' : '계획서가 아직 없으면'),
          btn(w.isPlan ? '초안 고쳐 쓰기' : w.written ? `쓰던 초안 이어 쓰기 (${w.written}/7)` : '직접 쓰기', 'biz-write-open', w.isPlan ? 0 : w.resume, 'link', !!sc.busy));
        root.append(p);
        // 파일이 정본이다. 파일에서 고친 글은 이 쓰기 화면에 없다(설계 검토 지적 2)
        if (w.edited) root.append(el('p', 'biz-foot', w.note));
      }
      root.append(el('p', 'biz-foot', sc.privacy));
    } else {
      root.append(say(sc));
    }
    if (!['loading', 'reading', 'waiting', 'write', 'judging', 'reveal', 'score'].includes(sc.stage) && (sc.stage !== 'start' || sc.broken) && !(sc.stage === 'notes' && !sc.broken && sc.notes.some(n => n.sel) && sc.notes.some(n => n.state === 'open'))) {
      const c = el('div', 'biz-clear');
      if (sc.clearAsk) c.append(el('p', '', '읽은 결과, 고른 것, 쓰던 초안을 지웁니다. 만든 초안 파일과 계획서 · 회사 자료 파일은 그대로 둡니다.'), btn('지우기', 'biz-clear', '', 'chip', !!sc.busy), btn('그만두기', 'biz-clear-ask', '', 'link'));
      else c.append(btn('기록 지우기', 'biz-clear-ask', '', 'link'));
      root.append(c);
    }
    if (sc.stage === 'notes' && sc.sheet) { for (const c of root.children) c.inert = true; root.append(sheetNode(sc)); }
    if (sc.toast) {
      const t = el('div', 'biz-toast'); t.append(el('span', '', sc.toast.text), btn('되돌리기', 'biz-choose', sc.toast.key + '|undo', 'link', !!sc.busy));
      root.append(t);
    }
    body.replaceChildren(root);
    placePick();
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
    syncWrite();
    if (!hadEdit && sc.stage === 'notes' && sc.notes.find(n => n.sel)?.editing) host.querySelector('[data-biz-f="edit"]')?.focus({ preventScroll: true });
    if (sc.stage === 'notes' && sc.sheet && !host.querySelector('.biz-sheet')?.contains(doc.activeElement)) host.querySelector('.biz-sheet .row, .biz-sheet button')?.focus({ preventScroll: true });
    const k2 = sc.stage + ':' + (sc.stage === 'write' ? sc.q : sc.sel || '');
    if (k2 !== lastKey) {
      const first = lastKey === '' || lastKey.startsWith('loading:');
      lastKey = k2;
      if (sc.stage === 'write' && globalThis.matchMedia?.('(pointer:fine)').matches) host.querySelector('[data-biz-write]')?.focus({ preventScroll: true });
      if (!first) host.querySelector('.biz-steps, .biz-say, .biz-score')?.scrollIntoView?.({ block: 'nearest' });
    }
  }
  return { render, focusHead: () => (host.querySelector('[data-biz-head]') || host.querySelector('.biz-card .go'))?.focus() };
}
