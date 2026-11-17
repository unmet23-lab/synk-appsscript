// LAB 「직접 풀어 보기」 B 모션 층(시안, 2026-11-18).
// learner.js(공개본 그대로)가 그리는 상태를 보고 움직임 · 누르는 손맛 · 소리를 더한다. learner.js는 고치지 않는다.
//  - 무대 배경: 사진 대신 그날의 빛과 날씨가 움직인다(첫날 늦은 오후 먼지 · 다음 날 아침빛 · 7일 뒤 비 · 30일 뒤 해 질 녘 첫눈).
//  - 말 한 장: 답하면 그 말이 작은 표가 되어 시간 줄의 돌아올 날로 날아가 앉고, 그날이 오면 무대로 돌아온다.
//  - 시간 넘기기: 다음 단추를 누르면 무대가 빠지고, 가운데 큰 숫자가 날을 감은 뒤 다음 장면이 들어온다.
//  - 누르기: 보기 앞 번호는 눌리는 자판 단추(키보드 1 · 2 · 3도 된다). 맞으면 밑줄이 그려지고 조각이 튄다. 틀리면 흔들리고 붉은 줄.
//  - 소리: 브랜드 UI 킷 셋(획득 · 알림 · 성취)만 쓴다. 틀렸을 때 내는 소리는 없다(사운드킷 규칙 4).
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SCENE = ['now', 'now', 'morning', 'rain', 'snow', 'snow'];
  const CLOCK = [
    { n: 0, u: '일', cap: '지금' },
    { n: 1, u: '분 뒤', cap: '1분 뒤' },
    { n: 1, u: '일 뒤', cap: '내일' },
    { n: 7, u: '일 뒤', cap: '7일 뒤' },
    { n: 30, u: '일 뒤', cap: '30일 뒤' },
    { n: 30, u: '일 동안', cap: '내 위치' },
  ];
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));

  for (const root of document.querySelectorAll('[data-try][data-motion]')) {
    const $ = (s) => root.querySelector(s);
    const lis = [...root.querySelectorAll('[data-steps] li')];
    const stage = $('.mv-stage');
    const quiz = $('[data-quiz]');
    const ctx = $('[data-context]');
    const prompt = $('[data-prompt]');
    const box = $('[data-choices]');
    const say = $('[data-say]');
    const sub = $('[data-sub]');
    const next = $('[data-next]');
    const rail = $('.mv-rail');
    const warpEl = $('.mv-warp');
    const stamp = $('.mv-stamp');
    const card = $('.mv-card');
    const soundBtn = $('.mv-sound');

    /* ── 소리 ── */
    let soundOn = true;
    try { soundOn = localStorage.getItem('synk-lw-sound') !== 'off'; } catch { /* 저장 못 해도 켜 둔다 */ }
    const sounds = {};
    for (const k of ['earn', 'notify', 'achieve']) { const a = new Audio(root.dataset['sound' + k[0].toUpperCase() + k.slice(1)] || root.dataset.soundBase + k + '.wav'); a.preload = 'auto'; a.volume = 0.55; sounds[k] = a; }
    const play = (k) => { if (!soundOn) return; const a = sounds[k]; try { a.currentTime = 0; a.play().catch(() => {}); } catch { /* 소리 없이 간다 */ } };
    const paintSound = () => { soundBtn.setAttribute('aria-pressed', String(soundOn)); soundBtn.querySelector('span').textContent = soundOn ? '소리 켬' : '소리 끔'; };
    soundBtn.addEventListener('click', () => { soundOn = !soundOn; try { localStorage.setItem('synk-lw-sound', soundOn ? 'on' : 'off'); } catch { /* 이번만 */ } paintSound(); if (soundOn) play('earn'); });
    paintSound();

    /* ── 지금 단계 ── */
    const nowIdx = () => Math.max(0, lis.findIndex((li) => li.classList.contains('is-now')));
    let shownIdx = 0;

    /* ── 창빛(배경 움직임) ──
       교실 창으로 들어온 빛 한 덩어리가 벽에 놓인다. 장면마다 해의 높이 · 빛의 색 · 기울기가 바뀌고(CSS [data-scene]),
       비 · 눈 · 먼지는 그 빛 안에서만 그림자로 지나간다. 날을 감는 동안에는 빛이 벽을 여러 번 쓸고 지나간다(하루가 흐른다). */
    const win = $('.mv-win');
    const fx = $('.mv-fx');
    const g = fx.getContext('2d');
    let mode = 'now', parts = [], W = 0, H = 0, dpr = 1, running = false, visible = false;
    // 손(포인터)을 따라 빛이 반대쪽으로 조금 옮겨 간다(깊이감). 휴대폰은 움직이지 않는다.
    let px = 0, py = 0, pxTo = 0, pyTo = 0;
    root.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; const R = root.getBoundingClientRect(); pxTo = ((e.clientX - R.left) / R.width - 0.5) * -2; pyTo = ((e.clientY - R.top) / R.height - 0.5) * -2; });
    const size = () => { dpr = Math.min(2, devicePixelRatio || 1); W = win.offsetWidth; H = win.offsetHeight; fx.width = W * dpr; fx.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const seed = () => {
      const n = mode === 'rain' ? 46 : mode === 'now' ? 22 : 0; // 저녁 장면은 점 없이 창빛만(11-18 맹검: 눈 점이 흔한 밤하늘 효과로 읽혔다)
      parts = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random(), s: Math.random(), p: Math.random() * Math.PI * 2, run: Math.random() < 0.35 }));
    };
    const draw = (t) => {
      g.clearRect(0, 0, W, H);
      px += (pxTo - px) * 0.05; py += (pyTo - py) * 0.05;
      root.style.setProperty('--px', (px * 14).toFixed(2) + 'px'); root.style.setProperty('--py', (py * 10).toFixed(2) + 'px');
      if (mode === 'now') {
        // 햇빛 속 먼지: 빛 안에서만 반짝이며 천천히 떠오른다
        for (const q of parts) {
          q.y -= 0.08 + q.s * 0.1; q.x += Math.sin(t / 2600 + q.p) * 0.18;
          if (q.y < -4) { q.y = H + 4; q.x = Math.random() * W; }
          const a = 0.25 + 0.55 * Math.max(0, Math.sin(t / 1100 + q.p));
          g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.arc(q.x, q.y, 1 + q.r * 1.8, 0, 7); g.fill();
        }
      } else if (mode === 'rain') {
        // 유리에 맺혀 흘러내리는 빗방울의 그림자: 맺힌 방울은 거의 멈춰 있고, 셋에 하나꼴로 길을 내며 흘러내린다
        for (const q of parts) {
          if (q.run) { q.y += 1.4 + q.s * 2.6; q.x += Math.sin(t / 300 + q.p) * 0.25; if (q.y > H + 30) { q.y = -30; q.x = Math.random() * W; } }
          else { q.y += 0.04; if (q.y > H) q.y = 0; }
          const rr = 2 + q.r * 4;
          g.fillStyle = 'rgba(40,52,68,.16)'; g.beginPath(); g.ellipse(q.x, q.y, rr * 0.8, rr, 0, 0, 7); g.fill();
          if (q.run) { g.strokeStyle = 'rgba(40,52,68,.10)'; g.lineWidth = rr * 0.9; g.lineCap = 'round'; g.beginPath(); g.moveTo(q.x, q.y - 8); g.lineTo(q.x - Math.sin(t / 300 + q.p) * 2, q.y - 40 - q.s * 50); g.stroke(); }
        }
      } else if (mode === 'snow') {
        // 창 너머로 지나가는 눈: 빛 안에서만 보인다
        for (const q of parts) {
          q.y += 0.45 + q.s * 0.8; q.x += Math.sin(t / 1700 + q.p) * 0.4;
          if (q.y > H + 6) { q.y = -6; q.x = Math.random() * W; }
          g.fillStyle = `rgba(236,240,250,${0.35 + q.r * 0.5})`; g.beginPath(); g.arc(q.x, q.y, 1.2 + q.r * 2.6, 0, 7); g.fill();
        }
      }
    };
    const loop = (t) => { if (!running) return; draw(t); requestAnimationFrame(loop); };
    const startSky = () => { if (reduce || running || !visible) return; running = true; requestAnimationFrame(loop); };
    const setScene = (m) => { if (m === mode) return; mode = m; root.dataset.scene = m; seed(); if (reduce) draw(0); };
    // 날을 감는 동안: 빛이 벽을 n번 쓸고 지나간다(1분 뒤는 한 번 깜빡, 하루는 한 번, 7일 · 30일은 여러 번)
    const lapse = (laps, ms) => {
      if (reduce || !laps) return;
      win.getAnimations().forEach((a) => a.cancel());
      const cs = getComputedStyle(root);
      const home = cs.getPropertyValue('--win').trim(), homeA = Number(cs.getPropertyValue('--sun-a')) || 0.9;
      const FROM = 'translate(-95%, 4%) skewX(-34deg) scaleX(1.3)', TO = 'translate(95%, -4%) skewX(18deg) scaleX(0.9)';
      const k = [];
      for (let i = 0; i < laps; i++) {
        const a = i / laps, z = (i + 1) / laps, last = i === laps - 1;
        k.push({ offset: a, transform: FROM, opacity: 0, easing: 'cubic-bezier(.45,0,.55,1)' });
        k.push({ offset: a + 0.3 / laps, opacity: 0.95 });
        if (!last) { k.push({ offset: a + 0.7 / laps, opacity: 0.95 }); k.push({ offset: z - 0.0001, transform: TO, opacity: 0 }); }
        else k.push({ offset: 1, transform: home, opacity: homeA });
      }
      win.animate(k, { duration: ms });
    };
    new ResizeObserver(() => { size(); seed(); if (reduce) draw(0); }).observe(win);
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) startSky(); else running = false; }, { rootMargin: '120px 0px' }).observe(root);
    size(); seed(); if (reduce) draw(0);

    /* ── 글이 낱말마다 올라온다 ── */
    const splitting = new WeakSet();
    const kinetic = (el, base = 0) => {
      const text = el.textContent;
      if (!text || splitting.has(el)) return;
      splitting.add(el);
      el.replaceChildren(...text.split(/(\s+)/).map((w, i) => {
        if (/^\s+$/.test(w)) return document.createTextNode(w);
        const s = document.createElement('span'); s.className = 'mv-w'; s.textContent = w; s.style.setProperty('--d', `${base + i * 28}ms`); return s;
      }));
      queueMicrotask(() => splitting.delete(el));
    };

    /* ── 보기 단추에 자판 · 밑줄을 입힌다 ── */
    const dressChoices = () => {
      [...box.children].forEach((b, i) => {
        if (b.querySelector('.mv-key')) return;
        const word = b.textContent;
        b.setAttribute('aria-label', `${i + 1}번 ${word}`);
        b.replaceChildren();
        const key = document.createElement('span'); key.className = 'mv-key'; key.setAttribute('aria-hidden', 'true'); key.textContent = String(i + 1);
        const w = document.createElement('span'); w.className = 'mv-word'; w.textContent = word;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'mv-ul'); svg.setAttribute('viewBox', '0 0 240 14'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', 'M3 9 C 44 4, 92 12, 138 7 S 214 4, 237 8'); p.setAttribute('pathLength', '1'); svg.append(p);
        w.append(svg);
        b.append(key, w);
        b.style.setProperty('--i', i);
        const down = () => b.classList.add('is-down');
        const up = () => b.classList.remove('is-down');
        b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up);
      });
      box.classList.remove('is-in'); void box.offsetWidth; box.classList.add('is-in');
    };

    /* ── 맞음 · 틀림의 손맛 ── */
    const burst = (el) => {
      if (reduce) return;
      const r = el.getBoundingClientRect(), R = root.getBoundingClientRect();
      const cx = r.left - R.left + r.width / 2, cy = r.top - R.top + r.height * 0.55;
      for (let i = 0; i < 12; i++) {
        const d = document.createElement('i'); d.className = 'mv-bit'; d.style.left = cx + 'px'; d.style.top = cy + 'px';
        if (i % 3 === 0) d.classList.add('is-hot');
        root.append(d);
        const a = (Math.PI * 2 * i) / 12 + Math.random() * 0.4, dist = 60 + Math.random() * 70;
        d.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist * 0.7}px)) scale(.2)`, opacity: 0 }], { duration: 620 + Math.random() * 200, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => d.remove();
      }
    };

    /* ── 말 한 장(표)이 시간 줄을 오간다 ── */
    let token = null, tokenAt = -1;
    const ping = (i) => { const li = lis[i]; if (!li || reduce) return; li.classList.remove('is-ping'); void li.offsetWidth; li.classList.add('is-ping'); setTimeout(() => li.classList.remove('is-ping'), 700); };
    const stopPoint = (i) => { const li = lis[i]; const dot = li.querySelector('i'); const r = dot.getBoundingClientRect(), R = root.getBoundingClientRect(); return { x: r.left - R.left + r.width / 2, y: r.top - R.top }; };
    // 표가 구역 밖으로 잘리지 않게 안쪽으로 당기고, 꼭지(--stem)는 그 날 점을 그대로 가리킨다
    const spot = (i) => { const p = stopPoint(i); const w = token ? token.offsetWidth : 0; const x = Math.min(Math.max(p.x, w / 2 + 8), root.clientWidth - w / 2 - 8); return { x, y: p.y, stem: p.x - x }; };
    const setAt = (q) => { token.style.left = q.x + 'px'; token.style.top = q.y + 'px'; token.style.setProperty('--stem', q.stem + 'px'); };
    const placeToken = (i) => { if (!token) return; setAt(spot(i)); };
    const makeToken = (text) => { token?.remove(); token = document.createElement('div'); token.className = 'mv-token'; token.setAttribute('aria-hidden', 'true'); token.innerHTML = `<b></b><small></small>`; token.querySelector('b').textContent = text; root.append(token); return token; };
    // fromTop: 카드 · 앱 화면에서 떠날 때는 그 윗변에서 떠난다(글자 위에 겹쳐 잔상처럼 보이지 않게)
    const flyToken = async (fromEl, text, to, label, fromTop = false) => {
      makeToken(text);
      token.querySelector('small').textContent = label;
      const R = root.getBoundingClientRect(), r = fromEl.getBoundingClientRect();
      const from = { x: r.left - R.left + r.width / 2, y: r.top - R.top + (fromTop ? 0 : r.height + 18) };
      const end = spot(to);
      setAt(end);
      tokenAt = to;
      if (reduce) return;
      const dx = from.x - end.x, dy = from.y - end.y;
      await token.animate([
        { transform: `translate(calc(-50% + ${dx}px), calc(-100% + ${dy}px)) scale(0.85)`, opacity: 0 },
        { opacity: 1, offset: 0.16 },
        { transform: `translate(calc(-50% + ${dx * 0.55}px), calc(-100% + ${dy * 0.55 - 90}px)) scale(1.15)`, opacity: 1, offset: 0.45 },
        { transform: 'translate(-50%, calc(-100% - 6px)) scale(.96)', opacity: 1, offset: 0.86 },
        { transform: 'translate(-50%, -100%) scale(1)', opacity: 1 },
      ], { duration: 900, easing: 'cubic-bezier(.3,.6,.2,1)' }).finished;
      ping(to);
    };
    const hopToken = async (to) => {
      if (!token || tokenAt === to) return;
      const a = { x: parseFloat(token.style.left), y: parseFloat(token.style.top) }, b = spot(to); tokenAt = to;
      setAt(b);
      if (reduce) return;
      await token.animate([{ transform: `translate(calc(-50% + ${a.x - b.x}px), -100%)` }, { transform: `translate(calc(-50% + ${(a.x - b.x) / 2}px), calc(-100% - 26px))`, offset: 0.5 }, { transform: 'translate(-50%,-100%)' }], { duration: 700, easing: 'cubic-bezier(.4,0,.2,1)' }).finished;
      ping(to);
    };
    const riseToken = async () => {
      if (!token) return;
      const t = token; token = null; tokenAt = -1;
      if (reduce) { t.remove(); return; }
      const R = root.getBoundingClientRect(), s = stage.getBoundingClientRect();
      const p = { x: parseFloat(t.style.left), y: parseFloat(t.style.top) };
      const target = { x: s.left - R.left + s.width / 2, y: s.top - R.top + 40 };
      await t.animate([{ transform: 'translate(-50%,-100%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${target.x - p.x}px), calc(-100% + ${target.y - p.y}px)) scale(1.5)`, opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.5,0,.3,1)' }).finished;
      t.remove();
    };
    addEventListener('resize', () => { if (token && tokenAt >= 0) placeToken(tokenAt); });

    /* ── 가운데 감기(큰 숫자) ── */
    const roll = (el, from, to, ms) => new Promise((res) => {
      if (reduce || from === to) { el.textContent = String(to); return res(); }
      const t0 = performance.now();
      const step = (t) => { const k = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - k, 3); el.textContent = String(Math.round(from + (to - from) * e)); el.classList.toggle('is-tick', k < 1 && Math.round((t - t0) / 40) % 2 === 0); if (k < 1) requestAnimationFrame(step); else { el.classList.remove('is-tick'); res(); } };
      requestAnimationFrame(step);
    });

    /* ── 다음 단추: 무대를 빼고 날을 감은 뒤 다음 장면을 들인다 ── */
    let passing = false, busy = false, gen = 0;
    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-next] .btn');
      if (!btn || passing || btn.tagName === 'A') return;
      e.stopImmediatePropagation(); e.preventDefault();
      if (busy) return; // 감는 중에 또 누르면 하루를 건너뛰지 않게 한 번만 받는다
      busy = true;
      try { await go(btn); } finally { busy = false; }
    }, true);
    const go = async (btn) => {
      gen++;
      const from = nowIdx();
      btn.classList.add('is-go');
      root.classList.add('is-leaving');
      await wait(260);
      passing = true; btn.click(); passing = false; // learner.js가 다음 상태를 그린다(무대는 아직 가려 둔다)
      const to = nowIdx();
      await travel(from, to);
    };

    const travel = async (from, to) => {
      root.classList.add('is-warping');
      root.classList.remove('is-leaving');
      setScene(SCENE[to]);
      const a = CLOCK[from], b = CLOCK[to];
      warpEl.querySelector('.mv-unit').textContent = b.u;
      warpEl.querySelector('.mv-cap').textContent = b.cap;
      const num = warpEl.querySelector('.mv-num');
      const days = (c) => (c.u.startsWith('분') ? 0 : c.n);
      const jump = b.u.startsWith('분') ? [0, 1] : [days(a), b.n];
      const ms = to === 5 ? 0 : Math.min(1100, 520 + Math.abs(jump[1] - jump[0]) * 24);
      if (to !== 5) { warpEl.classList.add('is-on'); play('notify'); lapse(to === 1 ? 0 : to === 2 ? 1 : to === 3 ? 3 : 5, ms + 300); }
      const hops = [];
      // 「내 위치」는 날이 아니라 모아 보는 자리라, 남은 말(30일에 틀린 말)은 30일 칸에 그대로 둔다
      if (token && tokenAt !== to && tokenAt < to && to < 5) hops.push(hopToken(to));
      await Promise.all([roll(num, jump[0], jump[1], ms), ...hops]);
      await wait(to === 5 ? 120 : 380);
      warpEl.classList.remove('is-on');
      if (tokenAt === to) await riseToken();
      root.classList.remove('is-warping');
      if (to === 5) stamp.classList.remove('is-on');
      enter(to);
      shownIdx = to;
      // 문제가 없는 날(내일 · 7일 뒤)은 말이 다음 돌아올 날로 다시 내려간다. 그 사이 다음으로 넘어갔으면 내려가지 않는다(단추는 그동안에도 바로 받는다).
      if (to === 2 || to === 3) { const g = ++gen; wait(900).then(() => { if (g === gen && nowIdx() === to) flyToken(stage.querySelector('.mv-card:not([hidden]), [data-shot]:not([hidden])') || stage, lastWord, to + 1, to === 2 ? '7일 뒤에 다시' : '30일 뒤에 다시', true); }); }
    };

    /* ── 장면이 들어온다 ── */
    let lastWord = '';
    let marks = [];
    const enter = (i) => {
      // 7일 뒤: 상태표 대신, 이 말이 지나온 길을 뒤집어 보는 카드
      const isCard = i === 3;
      card.hidden = !isCard;
      if (isCard) {
        card.querySelector('.mv-card-word').textContent = lastWord;
        const ol = card.querySelector('ol'); ol.replaceChildren(...marks.map((m) => { const li = document.createElement('li'); li.innerHTML = `<b></b><span></span>`; li.querySelector('b').textContent = m.mark; li.querySelector('span').textContent = m.when; return li; }), Object.assign(document.createElement('li'), { className: 'is-now', innerHTML: '<b>●</b><span>7일 뒤 · 지금 다시 확인</span>' }));
        [...ol.children].forEach((li, k) => li.style.setProperty('--i', k));
        openTrail(false);
      }
      if (!quiz.hidden) { kinetic(ctx, 0); kinetic(prompt, 140); box.classList.remove('is-in'); void box.offsetWidth; box.classList.add('is-in'); }
      kinetic(say, 60);
      root.classList.remove('is-entered'); void root.offsetWidth; root.classList.add('is-entered');
    };

    /* ── 답할 때 ── */
    box.addEventListener('click', async (e) => {
      const b = e.target.closest('.lwq-choice');
      if (!b) return;
      const i = nowIdx();
      const right = b.classList.contains('is-right');
      const answer = [...box.children].find((x) => x.classList.contains('is-right'));
      lastWord = answer?.querySelector('.mv-word')?.firstChild?.textContent || answer?.textContent || '';
      lis[i].dataset.mark = right ? 'right' : 'wrong';
      const whenLabel = ['처음 만난 날', '1분 뒤', '다음 날', '7일 뒤', '30일 뒤', ''][i];
      marks = marks.filter((m) => m.i !== i).concat({ i, when: whenLabel + (right ? ' · 혼자 맞힘' : ' · 틀림'), mark: right ? '✓' : '✕' });
      kinetic(say, 0);
      if (right) {
        play('earn'); burst(b);
        if (i === 4) { await wait(420); stamp.classList.remove('is-on'); void stamp.offsetWidth; stamp.classList.add('is-on'); play('achieve'); return; }
        await wait(380);
        await flyToken(answer, lastWord, 2, '내일 다시');
      } else {
        b.classList.add('is-shake');
        await wait(520);
        b.classList.remove('is-shake');
        await flyToken(answer, lastWord, i === 4 ? 4 : 1, i === 4 ? '다시 연습' : '1분 뒤에 다시');
      }
    });

    // 7일 뒤: 낱말 아래 단추를 누르면 이 말이 지나온 길(틀림 · 맞힘 자국)이 하나씩 펼쳐진다
    const opener = card.querySelector('.mv-card-open');
    function openTrail(on) { card.classList.toggle('is-open', on); opener.setAttribute('aria-expanded', String(on)); opener.querySelector('span').textContent = on ? '접기' : '이 말이 지나온 길 보기'; }
    opener.addEventListener('click', () => { const on = !card.classList.contains('is-open'); openTrail(on); if (on) play('earn'); });

    // 처음부터 다시
    root.addEventListener('click', (e) => {
      if (!e.target.closest('.lw-again')) return;
      gen++; lis.forEach((li) => delete li.dataset.mark); token?.remove(); token = null; tokenAt = -1; marks = []; stamp.classList.remove('is-on');
      setScene('now'); card.hidden = true; queueMicrotask(() => enter(0));
    });

    // 보기가 새로 그려질 때마다 자판 · 밑줄을 입힌다
    new MutationObserver(() => dressChoices()).observe(box, { childList: true });
    dressChoices();

    // 키보드 1 · 2 · 3으로 고르기(구역이 화면에 있고, 글 칸에 쓰는 중이 아닐 때)
    addEventListener('keydown', (e) => {
      if (!visible || busy || e.altKey || e.ctrlKey || e.metaKey || /input|textarea|select/i.test(document.activeElement?.tagName || '')) return;
      const n = Number(e.key);
      if (!(n >= 1 && n <= 3) || quiz.hidden) return;
      const b = box.children[n - 1];
      if (!b || b.disabled) return;
      b.classList.add('is-down'); setTimeout(() => { b.classList.remove('is-down'); b.click(); }, 110);
    });

    // 다음 단추 누르는 손맛
    next.addEventListener('pointerdown', (e) => e.target.closest('.btn')?.classList.add('is-down'));
    next.addEventListener('pointerup', (e) => e.target.closest('.btn')?.classList.remove('is-down'));

    // 처음: 구역이 보이면 들어온다
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { enter(nowIdx()); o.disconnect(); } }, { threshold: 0.25 }).observe(root);
  }
})();
