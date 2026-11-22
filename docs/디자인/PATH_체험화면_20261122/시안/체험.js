// 체험 화면 시안 — 실제 장면표(job.json)를 읽어 장면 하나하나를 눌러 볼 수 있게 돈다.
// 진행기의 모든 규칙을 옮긴 것은 아니다(영상 · 음성 인식 · PDF는 흉내만). 화면의 짜임을 고르시는 데 쓰는 판이다.
(async () => {
  const $ = (id) => document.getElementById(id);
  const make = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const icon = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  const ARROW = 'M5 12h14m-6-6 6 6-6 6', CHEV = 'm9 6 6 6-6 6', CHECK = 'M5 12.5 10 17.5 19 7.5';
  const pan = window.mockPan; document.body.dataset.pan = pan;
  const jobId = new URLSearchParams(location.search).get('job') || 'care-home';
  const base = `../../../../experiences/path-vr/workday/jobs/${jobId}/`;
  const job = await (await fetch(base + 'job.json')).json();
  const photoOf = (place) => base + (job.places[place]?.photo || job.places.office.photo);
  const who = (id) => job.cast[id] ? `${job.cast[id].name} · ${job.cast[id].role}` : '';

  // ── 시작 전 ──
  $('intro-photo').src = photoOf(job.scenes[0].place); $('intro-photo').alt = job.places[job.scenes[0].place]?.alt || '';
  $('job-role').textContent = job.role; $('job-title').textContent = job.title; $('job-summary').textContent = job.summary;
  $('f-scenes').textContent = `${job.scenes.length}개`; $('f-minutes').textContent = `${job.minutes}분쯤`;
  job.scenes.forEach((s, i) => { const li = make('li'); li.append(make('span', 'n', String(i + 1).padStart(2, '0')), make('b', '', s.title), make('span', '', `${s.minutes}분쯤 · ${job.places[s.place]?.name || ''}`)); $('scene-list').append(li); });
  const mode = () => document.querySelector('input[name=mode]:checked').value;
  document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => { $('voice-note').hidden = mode() !== 'voice'; }));

  // ── 진행 상태 ──
  let S = null;
  const hintLang = () => $('hint-language').value;
  const hintOf = (h) => (h && hintLang() && h[hintLang()]) || '';
  function steps() {
    for (const list of [$('steps'), $('steps-m')]) {
      list.replaceChildren(...job.scenes.map((s, i) => { const li = make('li', i < S.scene ? 'done' : i === S.scene ? 'now' : ''); li.append(make('span', '', `${i + 1} ${s.title}`)); return li; }));
    }
    $('mobile-step').textContent = `장면 ${S.scene + 1} / ${job.scenes.length} · ${job.scenes[S.scene].title}`;
  }
  function photo(place) {
    const img = $('photo'), src = photoOf(place);
    S.place = place; $('place-chip').textContent = job.places[place]?.name || '';
    if (img.getAttribute('src') === src) return;
    img.classList.add('fading'); setTimeout(() => { img.src = src; img.alt = job.places[place]?.alt || ''; img.onload = () => img.classList.remove('fading'); }, 180);
    renderPoints(false);
  }
  function sub(line, quiet) {
    $('sub-who').textContent = line ? who(line.who) : '';
    $('sub-text').textContent = line ? line.text : (quiet || '');
    $('sub-text').classList.toggle('sub-quiet', !line);
    const h = line ? hintOf(line.hint) : ''; $('sub-hint').hidden = !h; $('sub-hint').textContent = h;
  }
  function task(...nodes) { $('task').replaceChildren(...nodes); }
  const label = (text, listen) => make('span', 'task-label' + (listen ? ' listen' : ''), text);
  const title = (text) => make('h2', 'task-title', text);
  const button = (text, cls, onClick, ic) => { const b = make('button', 'btn ' + (cls || '')); b.type = 'button'; b.textContent = text; if (ic) b.insertAdjacentHTML('beforeend', icon(ic)); b.addEventListener('click', () => { if (!S.paused) onClick(b); }); return b; };

  function start() {
    S = { scene: 0, queue: [], choices: {}, seen: new Set(), done: new Set(), paused: false, place: null, said: [] };
    document.body.classList.add('in-session'); document.body.classList.remove('in-closing'); scrollTo(0, 0);
    enter();
  }
  function enter() {
    const scene = job.scenes[S.scene]; steps(); photo(scene.place); S.queue = [...scene.steps]; sub(null, ''); next();
  }
  function next() {
    const step = S.queue.shift();
    if (!step) return sceneEnd();
    ({ line, say, tour, move, report }[step.type] || next)(step);
  }

  // 사람이 말한다 — 자막만, 할 일 칸은 「듣는 중」
  function line(step) {
    sub(step); mockSound.turn();
    const nextBtn = button('다음', 'go big wide', next, ARROW); nextBtn.disabled = true;
    task(label('듣는 중', true), title(`${job.cast[step.who]?.name || ''} 님의 말을 들어요.`), nextBtn, make('p', 'small', hintLang() ? '자막 아래에 고른 언어의 뜻이 나와요.' : '힌트 언어를 고르면 자막 아래에 뜻이 나와요.'));
    setTimeout(() => { nextBtn.disabled = false; }, 900);
  }

  // 내가 말한다 — 지금 할 일 한 문장, 답 칸, 결정 단추 하나
  function answerBox(example, onSubmit, submitLabel = '답하기') {
    const wrap = make('div', 'task'); wrap.style.cssText = 'gap:12px;padding:0;background:none;box-shadow:none;width:100%';
    let heard = '';
    if (mode() === 'voice') {
      const mic = make('div', 'mic'); const b = make('button'); b.type = 'button'; b.setAttribute('aria-label', '말하기'); b.innerHTML = icon('M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3');
      const lv = make('div', 'level'); const bar = make('i'); lv.append(bar); const st = make('small', '', '눌러서 말하기');
      let timer = null;
      b.addEventListener('click', () => {
        if (timer) { clearInterval(timer); timer = null; mic.classList.remove('rec'); bar.style.width = '0'; heard = example || '안녕하세요.'; st.textContent = '다 들었어요'; out.textContent = `들린 말: ${heard}`; out.hidden = false; return; }
        mic.classList.add('rec'); st.textContent = '듣고 있어요'; timer = setInterval(() => { bar.style.width = `${20 + Math.random() * 70}%`; }, 140);
      });
      mic.append(b, lv, st); const out = make('p', 'small'); out.hidden = true; wrap.append(mic, out);
    } else {
      const ta = make('textarea', 'textarea'); ta.rows = 2; ta.placeholder = '한국어로 써 주세요.'; ta.addEventListener('input', () => { heard = ta.value.trim(); }); wrap.append(ta);
      wrap.fill = (text) => { ta.value = text; heard = text; };
    }
    const go = button(submitLabel, 'go big wide', () => { S.said.push(heard || example || ''); onSubmit(); }, ARROW);
    wrap.append(go); return wrap;
  }
  function say(step) {
    const helpers = make('div', 'helpers');
    const hint = make('p', 'hint-text'); hint.hidden = true; if (hintLang()) hint.lang = hintLang();
    const nodes = [label('지금 할 일'), title(step.prompt), helpers, hint];
    if (step.options) {
      const opts = make('div', 'options'); const after = make('div', 'task'); after.style.cssText = 'gap:12px;padding:0;background:none;box-shadow:none;width:100%';
      for (const o of step.options) {
        const b = make('button', 'option'); b.type = 'button'; b.setAttribute('aria-pressed', 'false'); b.innerHTML = `<span></span>${icon(CHEV)}`; b.firstChild.textContent = o.label;
        b.addEventListener('click', () => {
          if (S.paused) return; mockSound.tap();
          opts.querySelectorAll('.option').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          const ex = make('div', 'example'); ex.append(make('b', '', '이렇게 말해 볼 수 있어요'), make('p', '', o.example));
          const box = answerBox(o.example, () => { S.choices[step.id] = o.id; S.queue.unshift(...(o.then || [])); next(); });
          const use = button('이 말로 답하기', 'line', () => { box.fill?.(o.example); });
          after.replaceChildren(ex, ...(mode() === 'text' ? [use] : []), box);
        });
        opts.append(b);
      }
      nodes.push(opts, after);
    } else {
      const ex = make('div', 'example'); ex.hidden = true; ex.append(make('b', '', '예시 문장'), make('p', '', step.example || ''));
      const box = answerBox(step.example, next);
      helpers.append(button('예시 문장 보기', '', (b) => { ex.hidden = false; b.hidden = true; if (box.fill) { const use = button('예시 문장으로 답하기', 'line', () => box.fill(step.example)); helpers.prepend(use); } }));
      nodes.push(ex, box);
    }
    if (hintOf(step.hint)) helpers.append(button(hintLang() ? `할 일을 ${({ mn: '몽골어', vi: '베트남어', en: '영어' })[hintLang()]}로 보기` : '힌트 보기', '', (b) => { hint.hidden = false; hint.textContent = hintOf(step.hint); b.hidden = true; }));
    if (!helpers.children.length) helpers.hidden = true;
    task(...nodes);
  }

  // 둘러보기 — 자리를 고르고, 사진 위 점을 눌러 이름을 본다
  function renderPoints(open) {
    const box = $('points'); box.replaceChildren();
    if (!open) return;
    for (const p of job.places[S.place]?.points || []) {
      const b = make('button', 'point' + (S.done.has(`${S.place}:${p.id}`) ? ' seen' : '')); b.type = 'button'; b.style.left = `${p.x * 100}%`; b.style.top = `${p.y * 100}%`; b.setAttribute('aria-label', p.label);
      b.addEventListener('click', () => {
        if (S.paused) return; mockSound.tap(); S.done.add(`${S.place}:${p.id}`);
        box.querySelectorAll('.point-label').forEach((x) => x.remove());
        b.classList.add('seen'); const l = make('span', 'point-label'); l.append(make('span', '', p.label)); b.append(l);
      });
      box.append(b);
    }
  }
  function tour(step) {
    sub(null, '사진 속 흰 점을 누르면 이름이 나와요.');
    const board = make('div', 'board');
    const done = button('다 둘러봤어요', 'go big wide', () => { photo(step.home); next(); }, ARROW);
    for (const id of step.board) {
      const b = make('button', 'place'); b.type = 'button'; b.setAttribute('aria-pressed', 'false');
      const img = make('img'); img.src = photoOf(id); img.alt = ''; b.append(img, make('span', '', job.places[id].name));
      b.addEventListener('click', () => { if (S.paused) return; mockSound.tap(); S.seen.add(id); board.querySelectorAll('.place').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); b.classList.add('seen'); photo(id); setTimeout(() => renderPoints(true), 200); });
      board.append(b);
    }
    task(label('지금 할 일'), title('가 보고 싶은 자리를 골라요.'), board, done);
  }
  function move(step) { photo(step.place); sub(null, step.caption ? `자리를 옮겨요 · ${step.caption}` : '자리를 옮겨요'); task(label('자리를 옮기는 중', true)); setTimeout(next, 900); }
  function report(step) {
    const items = step.items.filter((it) => !it.when || Object.entries(it.when).every(([k, v]) => S.choices[k] === v));
    const list = make('div', 'check-list');
    for (const it of items) { const l = make('label'); const c = make('input'); c.type = 'checkbox'; c.dataset.key = it.key ? '1' : ''; l.append(c, make('span', '', it.text)); list.append(l); }
    const box = answerBox('', () => { const inc = [...list.querySelectorAll('input')].some((c) => c.checked && c.dataset.key); S.choices[step.id] = inc ? 'included' : 'omitted'; S.queue.unshift(...(step.then[S.choices[step.id]] || [])); next(); }, '보고하기');
    task(label('지금 할 일'), title(step.prompt), list, box);
  }
  function sceneEnd() {
    const scene = job.scenes[S.scene], nextScene = job.scenes[S.scene + 1]; mockSound.done();
    sub(null, `${scene.title} 장면을 마쳤어요.`);
    const mark = make('span', 'done-mark'); mark.innerHTML = icon(CHECK);
    const nodes = [mark, title(`${scene.title}을 마쳤어요.`), make('p', 'small', '여기서 쉬어도 돼요. 이어서 하면 다음 장면이 바로 시작돼요.')];
    if (nextScene) {
      const nu = make('div', 'next-up'); nu.innerHTML = '<span>다음 장면</span>'; const b = make('b', '', `${nextScene.title} · ${nextScene.minutes}분쯤`); nu.append(b);
      nodes.push(nu, button('다음 장면', 'go big wide', () => { S.scene++; enter(); }, ARROW), button('여기까지 하고 기록 보기', 'quiet', closing));
    } else nodes.push(button('맺음과 기록 보기', 'go big wide', closing, ARROW));
    const t = make('div', 'rest'); t.append(...nodes); task(t);
    const lis = $('steps').children; if (lis[S.scene]) lis[S.scene].className = 'done';
  }

  $('start').addEventListener('click', () => { mockSound.tap(); start(); });
  $('pause').addEventListener('click', () => { if (!S) return; S.paused = !S.paused; $('paused').hidden = !S.paused; $('pause').textContent = S.paused ? '이어서 하기' : '일시 정지'; });
  $('leave').addEventListener('click', () => { document.body.classList.remove('in-session'); S = null; scrollTo(0, 0); });

  // ── 맺음과 기록: 세 단계로 나눈다(오늘 고른 것 → 내 생각 → 기록 한 장). 한 화면에 할 일 하나. ──
  const STEPS = [['오늘 고른 것', '오늘 하루를 마쳤어요.'], ['내 생각', '해 보니 어땠어요?'], ['기록 한 장', '기록 한 장을 받아요.']];
  function closing(at = 0) {
    document.body.classList.remove('in-session'); document.body.classList.add('in-closing'); scrollTo(0, 0);
    const c = job.closing, el = $('closing'); el.replaceChildren();
    const nav = make('ol', 'close-steps'); nav.setAttribute('aria-label', '맺음 단계');
    const head = make('section', 'closing-head'); const h = make('div'); const h1 = make('h1', 'display'); h.append(make('p', 'kicker', '맺음'), h1); const lead = make('p', 'lead', c.lead); head.append(h, lead);
    el.append(nav, head);
    const steps = STEPS.map(() => { const s = make('div', 'close-step'); el.append(s); return s; });
    const block = (into, titleText, leadText, body) => { const s = make('section', 'block'); const hd = make('div', 'block-head'); hd.append(make('h2', 'h3', titleText)); if (leadText) hd.append(make('p', 'small', leadText)); s.append(hd, body); into.append(s); return s; };

    const forks = make('div', 'forks');
    const later = c.forks.filter((f) => !S?.choices[f.id]);
    for (const f of c.forks.filter((x) => S?.choices[x.id])) {
      const p = c.principles.find((x) => x.id === f.principle); const mine = S.choices[f.id];
      const row = make('div', 'fork'); row.append(make('span', 'fork-scene', f.scene));
      const m = make('div', 'fork-mine'); m.append(make('b', '', '내가 한 것'), make('p', '', f.mine[mine]));
      const v = make('div', 'fork-value'); v.append(make('b', '', '이 일에서 지키는 것'), make('p', '', p.title), make('span', '', p.body), make('q', '', f.say));
      row.append(m, v); forks.append(row);
    }
    if (later.length) forks.append(make('p', 'fork-later', `아직 하지 않은 갈림길 ${later.length}개(${later.map((f) => f.scene).join(', ')})는 해 보면 여기에 나와요.`));
    block(steps[0], '내가 고른 것과 이 일이 지키는 것', '', forks);
    const conds = make('dl', 'conds');
    for (const it of c.conditions.items) { const d = make('div'); d.append(make('dt', '', it.title), make('dd', '', it.body)); if (it.source) d.append(make('dd', 'src', `출처: ${it.source}`)); conds.append(d); }
    block(steps[0], '이 일의 실제 조건', c.conditions.lead, conds);

    const ref = make('div'); ref.style.cssText = 'display:grid;gap:18px';
    const dec = make('div', 'decide'); dec.setAttribute('role', 'radiogroup'); dec.setAttribute('aria-label', c.reflection.decisionLabel);
    for (const d of c.reflection.decisions) { const l = make('label'); const r = make('input'); r.type = 'radio'; r.name = 'decision'; r.value = d.id; r.addEventListener('change', paper); l.append(r, make('span', '', d.label)); dec.append(l); }
    const hard = make('div', 'field'); const hl2 = make('label', '', c.reflection.hardLabel); hl2.htmlFor = 'hard'; const ta = make('textarea', 'textarea'); ta.id = 'hard'; ta.rows = 3; ta.maxLength = 300; hard.append(hl2, ta, make('span', 'small', c.reflection.hardHelp));
    ref.append(dec, make('p', 'small', c.reflection.decisionNote), hard);
    block(steps[1], '이 일을 더 알아볼까요?', '', ref);
    const lad = make('div', 'ladder');
    for (const it of c.ladder.items) { const f = make('div', 'field'); const l = make('label', '', it.label); l.htmlFor = `lad-${it.id}`; const i = make('input', 'input'); i.id = `lad-${it.id}`; i.placeholder = it.placeholder; i.addEventListener('input', paper); f.append(l, i); lad.append(f); }
    const nm = make('div', 'field'); const nl = make('label', '', '기록에 적을 이름'); nl.htmlFor = 'name'; const ni = make('input', 'input'); ni.id = 'name'; ni.maxLength = 40; ni.autocomplete = 'name'; ni.placeholder = '이름'; ni.addEventListener('input', paper); nm.append(nl, ni); lad.append(nm);
    block(steps[1], '지금까지 준비한 것', `${c.ladder.lead} 적지 않아도 돼요.`, lad);

    const rec = make('section', 'record'); rec.setAttribute('aria-label', '체험 기록 한 장');
    const side = make('div', 'record-side');
    side.append(make('p', 'lead', '점수나 등급이 없어요. 체험에서 일어난 일만 적어요. 지원할 때 본인이 직접 내요.'));
    side.append(button('PDF로 받기', 'go big wide', () => alert('시안이라 PDF는 만들지 않아요.'), 'M12 4v11m-5-5 5 5 5-5M5 20h14'), button('인쇄하기', 'line wide', () => print()));
    const wipe = make('button', 'link', '이 기기에서 지우기'); wipe.type = 'button'; wipe.style.justifySelf = 'start'; side.append(wipe);
    const nx = make('a', 'next-card'); nx.href = './면접.html'; const nt = make('div'); nt.append(make('b', '', c.next.label), make('span', '', c.next.body)); nx.append(nt); nx.insertAdjacentHTML('beforeend', icon(ARROW)); side.append(nx);
    const pp = make('article', 'paper'); pp.id = 'paper'; pp.setAttribute('aria-label', '체험 기록 미리 보기');
    rec.append(pp, side); steps[2].append(rec);

    const foot = make('div', 'close-nav');
    const show = (i) => {
      steps.forEach((s, k) => { s.hidden = k !== i; });
      nav.replaceChildren(...STEPS.map(([t], k) => { const li = make('li', k < i ? 'done' : k === i ? 'now' : ''); const b = make('button', '', `${k + 1} ${t}`); b.type = 'button'; b.onclick = () => show(k); li.append(b); return li; }));
      h1.textContent = STEPS[i][1]; lead.hidden = i !== 0;
      foot.replaceChildren(...(i > 0 ? [button('이전', 'quiet', () => show(i - 1))] : []), ...(i < 2 ? [button(`다음 · ${STEPS[i + 1][0]}`, 'go big', () => { mockSound.tap(); show(i + 1); }, ARROW)] : []));
      scrollTo(0, 0); paper();
    };
    el.append(foot); show(at);
  }
  function paper() {
    const pp = $('paper'); if (!pp) return; const c = job.closing;
    const name = $('name')?.value.trim() || '이름을 적어 주세요';
    const dec = document.querySelector('input[name=decision]:checked');
    const done = S ? job.scenes.slice(0, S.scene + 1).map((s) => s.title) : [];
    pp.innerHTML = '';
    const top = make('div', 'paper-top'); const lg = make('img'); lg.src = '../../../../experiences/path-vr/assets/logo-path-320.webp'; lg.alt = 'SYNK PATH';
    const meta = make('div', 'paper-no'); const no = make('span', 'mono', 'PW-20261122-K7Q2MD'); meta.append(make('span', '', '기록 번호 '), no, make('br'), make('span', '', '2026년 11월 22일')); top.append(lg, meta);
    pp.append(top, make('h3', '', `일터 체험 기록 · ${job.title}`), make('p', 'who', name));
    const list = (t, rows) => { pp.append(make('h4', '', t)); const ul = make('ul'); for (const r of rows) ul.append(make('li', '', r)); pp.append(ul); };
    list('마친 장면', done.length ? [done.join(' · ')] : ['아직 마친 장면이 없어요']);
    list('갈림길에서 한 것', c.forks.filter((f) => S?.choices[f.id]).map((f) => `${f.scene}: ${f.mine[S.choices[f.id]]}`).concat(c.forks.some((f) => S?.choices[f.id]) ? [] : ['고른 갈림길이 아직 없어요']));
    list('체험 뒤 내 답', [dec ? c.reflection.decisions.find((d) => d.id === dec.value).label : '아직 고르지 않았어요']);
    const lad = c.ladder.items.map((it) => [it.label, $(`lad-${it.id}`)?.value.trim()]).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
    list('본인이 적은 준비', lad.length ? lad : ['적은 것이 없어요']);
    pp.append(make('p', 'notice', '점수나 등급, 추천이 없는 기록이에요. 체험에서 일어난 일만 적었어요. SYNK는 이 기록을 보관하거나 보내지 않아요.'));
  }

  // 시안 바로 가기: ?장면=say|tour|choice|rest|closing, ?힌트=vi
  const hl = new URLSearchParams(location.search).get('힌트'); if (hl) $('hint-language').value = hl;
  const jump = new URLSearchParams(location.search).get('장면');
  if (jump) {
    if (jump.startsWith('closing')) { S = { scene: 2, choices: { handover: 'ask', wake: 'later' }, queue: [] }; closing(Number(jump.slice(7)) || 0); }
    else {
      start();
      const at = { say: [0, 1], tour: [0, 3], choice: [1, 2], rest: [0, 99], line: [0, 0] }[jump];
      if (at) { S.scene = at[0]; const scene = job.scenes[at[0]]; steps(); photo(scene.place); if (at[1] === 99) { S.queue = []; sceneEnd(); } else { const lastLine = scene.steps.slice(0, at[1]).reverse().find((s) => s.type === 'line'); S.queue = scene.steps.slice(at[1]); if (lastLine) sub(lastLine); next(); if (lastLine && (jump === 'say' || jump === 'choice')) sub(lastLine); if (jump === 'tour') setTimeout(() => { document.querySelector('.place')?.click(); setTimeout(() => document.querySelector('.point')?.click(), 450); }, 300); } }
    }
  }
})();
