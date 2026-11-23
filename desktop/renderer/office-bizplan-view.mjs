/* 기획부 「사업계획서」 작업 화면 그리기(사업계획서_설계.md 6절, 사무실 시안 #plan).
   흰 종이 한 장이 주인공이다. 종이 위 문단 옆에 메모 표시가 붙고, 오른쪽 메모마다 그 자리에서 고치는 단추가 있다.
   글은 모두 textContent로 넣는다. 다시 그릴 때 쓰던 칸의 글과 초점을 지킨다 */

export function createBizplanView(host, send, doc = host.ownerDocument) {
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null && text !== '') n.textContent = String(text); return n; };
  const btn = (text, act, arg = '', cls = 'quiet', disabled = false) => {
    const b = el('button', cls === 'main' ? 'pill' : cls === 'ghost' ? 'pill ghost' : cls === 'dark' ? 'pill dark' : 'quiet', text);
    b.type = 'button'; b.dataset.bizAct = act; b.dataset.bizArg = String(arg);
    if (disabled) { b.disabled = true; b.setAttribute('aria-disabled', 'true'); }
    return b;
  };
  const acts = list => { const p = el('div', 'acts'); for (const [t, a, g, c, off] of list) p.append(btn(t, a, g, c, off)); return p; };
  const pick = (label, opts, act, shown = false) => {
    const p = el('div', 'biz-pick'); p.setAttribute('role', 'group'); p.setAttribute('aria-label', label);
    if (shown) { const l = el('span', 'lab', label); l.setAttribute('aria-hidden', 'true'); p.append(l); }
    for (const [t, v, on] of opts) { const b = btn(t, act, v, 'quiet'); b.setAttribute('aria-pressed', String(!!on)); p.append(b); }
    return p;
  };
  const field = (name, value, label, rows = 3) => {
    const w = el('label', 'biz-fld'), t = el('textarea'); t.dataset.bizF = name; t.rows = rows; t.value = value || ''; t.spellcheck = false;
    w.append(el('span', 'lab', label), t); return w;
  };
  let lastKey = '';

  host.addEventListener('click', e => {
    const b = e.target.closest?.('[data-biz-act]');
    if (b && !b.disabled && host.contains(b)) { send({ act: b.dataset.bizAct, arg: b.dataset.bizArg || '', fields: fields() }); return; }
    const para = e.target.closest?.('[data-biz-note]');
    if (para && host.contains(para)) send({ act: 'biz-sel', arg: para.dataset.bizNote, fields: {} });
  });
  host.addEventListener('keydown', e => {
    const para = e.target.closest?.('[data-biz-note]');
    if (para && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); send({ act: 'biz-sel', arg: para.dataset.bizNote, fields: {} }); }
  });
  const fields = () => Object.fromEntries([...host.querySelectorAll('[data-biz-f]')].map(n => [n.dataset.bizF, n.value]));

  function paperNode(sc) {
    const blankStage = ['start', 'failed', 'stopped', 'loading', 'error'].includes(sc.stage) || !sc.paper;
    if (blankStage) {
      const s = el('div', 'sheet blank'), inner = el('div', 'blank-in');
      if (sc.stage === 'start') {
        if (sc.list?.plan) {
          inner.append(el('small', '', '고른 계획서'), el('b', '', sc.list.plan.name), btn('다른 파일 고르기', 'biz-pick-plan', '', 'dark', !!sc.busy));
        } else {
          inner.append(el('b', '', '계획서 파일을 골라 주세요'), el('small', '', 'Word(.docx), 마크다운, 글 파일을 읽습니다. 한글과 PDF는 Word로 저장해 넣어 주세요.'),
            btn('계획서 파일 고르기', 'biz-pick-plan', '', 'dark', !!sc.busy));
        }
      } else if (sc.stage === 'loading') inner.append(el('small', '', sc.head?.[0] || ''));
      else if (sc.stage === 'error') inner.append(el('b', '', sc.head[0]), el('small', '', sc.head[1]));
      else if (sc.stage === 'waiting' || sc.stage === 'reading') { inner.append(el('b', '', sc.planName || '')); if (sc.stage === 'reading') inner.append(el('small', '', '다 읽으면 고칠 곳이 문단 옆에 붙습니다.')); }
      else inner.append(el('b', '', sc.head[0]), el('small', '', sc.head[1]), btn('다시 읽기', 'biz-start', '', 'dark', !!sc.busy || !sc.list?.plan));
      s.append(inner);
      return s;
    }
    const s = el('article', 'sheet');
    const h = el('header', 'sheet-h');
    h.append(el('small', '', sc.planName), el('h3', '', (sc.planName || '').replace(/\.(docx|md|txt)$/i, '')));
    if (sc.stage === 'notes') h.append(el('p', '', sc.dataNames?.length ? '견준 자료 · ' + sc.dataNames.join(', ') : '회사 자료 없이 읽었습니다'));
    s.append(h);
    for (const sec of sc.paper.secs) {
      const box = el('section', 'sec' + (sec.has ? ' has' : '') + (sec.dim ? ' unread' : '') + (sec.on ? ' on' : ''));
      box.append(el('span', 'pg', sec.title));
      for (const p of sec.paras) {
        const node = el('p', p.changed ? 'changed' : '', p.text);
        if (p.notes.length) {
          node.dataset.bizNote = p.notes[0]; node.tabIndex = 0; node.setAttribute('role', 'button');
          node.setAttribute('aria-label', '메모가 있는 문단: ' + p.text.slice(0, 60));
          if (sc.notes?.some(n => n.sel && p.notes.includes(n.key))) node.classList.add('sel');
        }
        box.append(node);
      }
      if (sec.draft) box.append(el('p', 'draft', sec.draft));
      s.append(box);
    }
    return s;
  }

  function noteNode(n, sc) {
    const box = el('div', 'note' + (n.sel ? ' sel' : '') + (n.state !== 'open' ? ' done' : ''));
    box.dataset.key = n.key;
    box.append(el('span', 'pg', n.label));
    if (!n.sel) {
      const w = btn('', 'biz-sel', n.key, 'quiet'); w.className = 'what'; w.textContent = n.state !== 'open' ? n.done : n.what;
      const arw = el('span', 'arw', ' ›'); arw.setAttribute('aria-hidden', 'true'); w.append(arw);
      box.append(w);
      return box;
    }
    box.append(el('p', 'what', n.state !== 'open' ? n.done : n.what));
    if (n.quote) box.append(el('p', 'quote', '「' + n.quote + '」'));
    if (n.evidence) box.append(el('p', 'why', `근거 「${n.evidence.text}」 · ${n.evidence.from}`));
    // 맡길 부서가 있을 때만 말한다. 근거가 없다는 말은 메모 제목과 겹쳐 뺐다(11-23 앱 창 확인)
    if (n.kind === 'unsupported' && n.state === 'open' && n.acts.some(a => a[1] === 'biz-hand')) box.append(el('p', 'why', '만들면 사실이 되는 일이면 다른 부서에 맡길 수 있습니다.'));
    if (n.fix && n.state === 'open' && !n.editing) { const pr = el('div', 'prop'); pr.append(el('small', '', '고친 문장'), el('p', '', n.fix)); box.append(pr); }
    if (n.locked && n.state === 'open') box.append(el('p', 'why', n.locked));
    if (n.editing) {
      box.append(field('edit', n.editing.text, '고칠 문장', 3), acts([['종이에 넣기', 'biz-edit-save', '', 'main', !!sc.busy], ['그만두기', 'biz-edit-cancel', '', 'quiet']]));
      return box;
    }
    if (n.handing) {
      const pr = el('div', 'prop'); pr.append(el('small', '', '맡길 글'), el('p', 'pre', n.handing.text)); box.append(pr);
      box.append(pick('맡을 부서', n.handing.depts.map(([t, v]) => [t, v, v === n.handing.dept]), 'biz-hand-dept', true));
      box.append(pick('맡을 직원', [['Claude', 'claude', n.handing.provider === 'claude'], ['GPT', 'codex', n.handing.provider === 'codex']], 'biz-hand-provider', true));
      box.append(field('extra', '', '덧붙일 말(쓰지 않아도 됩니다)', 2), acts([['맡기기', 'biz-hand-send', '', 'main', !!sc.busy], ['닫기', 'biz-hand', n.key, 'quiet']]));
      return box;
    }
    if (n.asking) {
      const t = el('div', 'talk');
      n.asking.asks.forEach((a, j) => {
        t.append(el('p', 'q' + (a.opts.some(o => o[2]) ? '' : ' now'), a.q));
        const chips = el('div', 'chips');
        for (const [label, arg, on] of a.opts) { const c = btn(label, 'biz-answer', arg, 'ghost'); c.classList.add('small'); c.setAttribute('aria-pressed', String(!!on)); chips.append(c); }
        t.append(chips);
      });
      if (n.asking.draft) { const pr = el('div', 'prop'); pr.append(el('small', '', '초안'), el('p', '', n.asking.draft)); t.append(pr); }
      t.append(acts([['이 문단 넣기', 'biz-draft-put', n.item, 'main', !n.asking.ready || !!sc.busy], ['닫기', 'biz-ask', n.item, 'quiet']]));
      box.append(t);
      return box;
    }
    if (n.draft) { const pr = el('div', 'prop'); pr.append(el('small', '', '넣은 초안'), el('p', '', n.draft)); box.append(pr); }
    box.append(acts(n.acts.map(([t, a, g, c]) => [t, a, g, c, !!sc.busy])));
    return box;
  }

  function sideNode(sc) {
    const side = el('aside', 'biz-side');
    if (['start', 'failed', 'stopped'].includes(sc.stage)) {
      const data = el('div', 'biz-block');
      data.append(el('h4', '', '회사 자료'));
      if (sc.list?.data?.length) {
        const ul = el('ul', 'biz-files');
        sc.list.data.forEach((d, i) => { const li = el('li'); li.append(el('span', '', d.name), btn('빼기', 'biz-remove-data', i, 'quiet', !!sc.busy)); ul.append(li); });
        data.append(ul);
      } else data.append(el('p', 'why', '매출표, 고객 수처럼 계획서 숫자의 근거가 되는 파일입니다. 없어도 읽고, 그때는 평가 항목만 봅니다.'));
      data.append(acts([['회사 자료 고르기', 'biz-pick-data', '', 'ghost', !!sc.busy]]));
      const crit = el('div', 'biz-block');
      crit.append(el('h4', '', '평가 항목'));
      crit.append(pick('평가 항목', [['일반 창업 지원사업 네 항목', 'default', sc.criteria.mode === 'default'], ['공고의 평가 항목 붙여넣기', 'pasted', sc.criteria.mode === 'pasted']], 'biz-criteria'));
      if (sc.criteria.mode === 'pasted') crit.append(field('criteria', sc.criteria.text, '한 줄에 하나씩', 4), acts([['평가 항목 저장', 'biz-criteria-save', '', 'ghost', !!sc.busy]]));
      else crit.append(el('p', 'why', sc.list.items.join(' · ')));
      const who = el('div', 'biz-block');
      who.append(el('h4', '', '읽을 직원'), pick('읽을 직원', [['Claude', 'claude', sc.provider === 'claude'], ['GPT', 'codex', sc.provider === 'codex']], 'biz-provider'));
      side.append(data, crit, who, acts([['읽기 시작', 'biz-start', '', 'main', !sc.list?.plan || !!sc.busy]]), el('p', 'biz-privacy', sc.privacy));
    } else if (sc.stage === 'waiting' || sc.stage === 'reading') {
      const b = el('div', 'biz-block');
      // 몇 번째인지는 맨 위 둘째 줄에 있다. 여기서는 되풀이하지 않는다(11-23 앱 창 확인)
      b.append(el('p', 'why', '읽는 동안 다른 일을 해도 됩니다. 끝나면 사무실 맨 위 문장과 이 화면이 알려 드립니다.'));
      if (sc.taskId) b.append(acts([['멈추기', 'biz-cancel', sc.taskId, 'quiet', !!sc.busy]]));
      side.append(b, el('p', 'biz-privacy', sc.privacy));
    } else if (sc.stage === 'notes') {
      const list = el('div', 'notes');
      for (const n of sc.notes) list.append(noteNode(n, sc));
      side.append(list);
      if (sc.items?.length) {
        const ul = el('ul', 'items'); ul.setAttribute('aria-label', '평가 항목');
        for (const it of sc.items) { const li = el('li', it.state === '약함' ? 'weak' : ''); const dot = el('i'); dot.setAttribute('aria-hidden', 'true'); li.append(dot, el('span', '', it.item), el('small', '', it.state)); ul.append(li); }
        side.append(ul);
      }
      const end = el('div', 'biz-block biz-end');
      if (sc.saved) end.append(el('p', 'biz-saved', sc.saved.name), acts([['폴더에서 보기', 'biz-reveal', '', 'ghost', !!sc.busy]]));
      end.append(acts([['새 파일로 저장', 'biz-save', '', 'main', !sc.changes || !!sc.busy || sc.planChanged], ['다시 읽기', 'biz-start', '', 'quiet', !!sc.busy]]));
      side.append(end);
    }
    if (sc.stage !== 'loading' && sc.stage !== 'reading' && sc.stage !== 'waiting' && (sc.stage !== 'start' || sc.broken)) {
      if (sc.stage === 'error') side.append(el('p', 'why', sc.head[1]));
      side.append(sc.clearAsk ? (() => { const c = el('div', 'biz-block'); c.append(el('p', 'why', '읽은 결과와 고른 것을 지웁니다. 계획서와 회사 자료 파일은 그대로 둡니다.'), acts([['지우기', 'biz-clear', '', 'ghost', !!sc.busy], ['그만두기', 'biz-clear-ask', '', 'quiet']])); return c; })()
        : acts([['기록 지우기', 'biz-clear-ask', '', 'quiet']]));
    }
    return side;
  }

  // 알림 자리는 한 번 만들어 두고 글만 바꾼다. 그릴 때마다 새로 만들면 화면 읽기 프로그램이 알림을 놓친다(코드 검수 P2-9)
  const body = doc.createElement('div');
  const liveEl = doc.createElement('p'); liveEl.className = 'more-note biz-live'; liveEl.setAttribute('role', 'status'); liveEl.setAttribute('aria-live', 'polite');
  function render(sc) {
    if (!sc) { host.hidden = true; host.replaceChildren(); liveEl.textContent = ''; lastKey = ''; return; }
    host.hidden = false;
    if (body.parentNode !== host || liveEl.parentNode !== host) host.replaceChildren(body, liveEl);
    const values = fields(), focus = doc.activeElement && host.contains(doc.activeElement) ? doc.activeElement : null;
    const fkey = focus?.dataset?.bizF ? 'f:' + focus.dataset.bizF : focus?.dataset?.bizAct ? 'a:' + focus.dataset.bizAct + '|' + (focus.dataset.bizArg || '') : focus?.dataset?.bizNote ? 'n:' + focus.dataset.bizNote : '';
    const sel = focus && 'selectionStart' in focus ? [focus.selectionStart, focus.selectionEnd] : null;
    const root = el('div', 'biz');
    const top = el('div', 'biz-top'); top.append(btn(sc.back, 'biz-close', '', 'quiet'));
    root.append(top);
    const head = el('p', 'say biz-say'); head.tabIndex = -1; head.dataset.bizHead = '';
    head.append(el('span', '', sc.head[0]), el('span', 'then', sc.head[1]));
    root.append(head);
    if (sc.planChanged) { const w = el('div', 'biz-warn'); w.append(el('p', '', '계획서 파일이 읽은 뒤에 바뀌었습니다. 다시 읽은 뒤 저장할 수 있습니다.'), btn('다시 읽기', 'biz-start', '', 'ghost', !!sc.busy)); root.append(w); }
    const grid = el('div', 'biz-grid');
    grid.append(paperNode(sc), sideNode(sc));
    root.append(grid);
    body.replaceChildren(root);
    if (liveEl.textContent !== (sc.live || '')) liveEl.textContent = sc.live || '';
    for (const n of host.querySelectorAll('[data-biz-f]')) if (Object.hasOwn(values, n.dataset.bizF) && values[n.dataset.bizF] !== '') n.value = values[n.dataset.bizF];
    if (fkey) {
      const [k, v] = [fkey.slice(0, 2), fkey.slice(2)];
      const again = k === 'f:' ? host.querySelector(`[data-biz-f="${CSS.escape(v)}"]`) : k === 'n:' ? host.querySelector(`[data-biz-note="${CSS.escape(v)}"]`)
        : [...host.querySelectorAll('[data-biz-act]')].find(b => b.dataset.bizAct + '|' + (b.dataset.bizArg || '') === v);
      if (again && !again.disabled) { again.focus({ preventScroll: true }); if (sel && 'setSelectionRange' in again) try { again.setSelectionRange(...sel); } catch {} }
      // 누른 단추가 사라지면 초점이 문서 처음으로 날아가지 않게, 고른 메모의 첫 단추나 머리글로 옮긴다
      else (host.querySelector('.note.sel button:not([disabled])') || host.querySelector('[data-biz-head]'))?.focus({ preventScroll: true });
    }
    const key = sc.stage + ':' + (sc.sel || '');
    if (key !== lastKey) {
      lastKey = key;
      host.querySelector('.note.sel')?.scrollIntoView?.({ block: 'nearest' });
    }
  }
  return { render, focusHead: () => host.querySelector('[data-biz-head]')?.focus() };
}
