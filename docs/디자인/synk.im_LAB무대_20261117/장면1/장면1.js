// LAB 「직접 풀어 보기」 첫 장면 — 빨랫줄과 단어 카드(2026-11-18, 둘째 판).
// 30일은 줄 하나다. 보기 세 낱말이 「지금」 자리에 나무 집게로 물린 단어 카드다. 카드를 누르면 답이 되고, 잡아 끌면 흔들린다.
// 답하면 틀린 보기는 집게가 열리며 떨어져 나가고, 남은 카드(배울 말)는 뒤집혀 기록 면에 도장을 받은 뒤 줄을 따라 다음에 돌아올 날로 간다.
// 이 쪽은 첫 장면(첫 문제 → 맞힘 · 틀림 → 1분 뒤 감기 → 둘째 문제 → 내일로)까지 짓는다. 글은 공개본 원고(../원고.json) 그대로다.
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrowMQ = matchMedia('(max-width:900px)');
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sign = () => (Math.random() < 0.5 ? -1 : 1);
  const root = $('#sc');
  const head = $('.sc-head'), stage = $('.sc-stage'), after = $('.sc-after');
  const qhead = $('.sc-qhead'), ctxEl = $('.sc-ctx'), promptEl = $('.sc-prompt');
  const say = $('.sc-say'), sub = $('.sc-sub'), next = $('.sc-next');
  const line = $('.sc-line'), layer = $('.sc-cards'), cordPath = $('.sc-cord-path'), cordShadow = $('.sc-cord-shadow'), stopsEl = $('.sc-stops'), hint = $('.sc-hint');
  const ff = $('.sc-ff'), ffNum = $('.sc-ff-num'), ffCap = $('.sc-ff-cap');
  const soundBtn = $('.sc-sound');
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? Math.min(ms, 60) : ms));

  /* ── 원고(공개본 그대로) ── */
  const Q = {
    first: { head: '처음 만난 날 · 표현 익히기', say: '일부러 틀려 봐도 좋습니다', sub: '틀린 말과 맞힌 말이 각각 언제, 어떻게 돌아오는지 30일을 이어서 보여 드립니다.', context: '교실에 들어가 선생님을 처음 만났어요.', prompt: '처음 만난 선생님에게 어떤 인사를 할까요?', answer: 'a', choices: [['a', '안녕하세요.'], ['b', '감사합니다.'], ['c', '다녀왔어요.']] },
    second: { head: '1분 뒤 · 같은 말, 다른 장면', say: '어? 전에 만난 말인데\n장면이 달라!', sub: '답의 자리만 외우지 않게, 장면을 바꿔 묻습니다.', context: '아직 도움을 받거나 헤어지는 상황은 아니에요.', prompt: '학교에서 처음 만난 직원에게 인사해요.', answer: 'b', choices: [['a', '다녀왔어요.'], ['b', '안녕하세요.'], ['c', '감사합니다.']] },
    right: { say: '맞았습니다', sub: '이 말은 내일 다른 장면으로 다시 옵니다.' },
    wrong: { say: '이 말은 1분 뒤에 돌아옵니다', sub: '같은 문제가 아니라 다른 장면으로 옵니다. 틀린 답도 첫 기록이 되어 1 · 7 · 30일 뒤 다시 확인합니다.' },
    backRight: { say: '다시 만나 맞혔습니다', sub: '이제 내일 또 옵니다. 맞힐수록 간격이 1 · 3 · 7 · 14 · 30일로 벌어집니다.' },
    backWrong: { say: '또 1분 뒤에 돌아옵니다', sub: '맞힐 때까지 간격이 벌어지지 않습니다.' },
    toMinute: '1분 뒤로', toDay1: '내일로', again: '처음부터 다시',
  };

  /* ── 소리: 동작마다 다른 효과음(Web Audio). 쪽이 열릴 때 받아 두고, 처음 누르는 순간부터 난다. ── */
  const SND = {
    hover: { f: 'sound/hover.mp3', g: 0.28, vary: 0.12 }, press: { f: 'sound/press.mp3', g: 0.7, vary: 0.06 },
    strike: { f: 'sound/strike.mp3', g: 0.7 }, underline: { f: 'sound/underline.mp3', g: 0.62 }, stamp: { f: 'sound/stamp.mp3', g: 0.95 },
    flip: { f: 'sound/flip.mp3', g: 0.62, vary: 0.08 }, clipopen: { f: 'sound/clipopen.mp3', g: 0.7, vary: 0.08 }, clipsnap: { f: 'sound/clipsnap.mp3', g: 0.9, vary: 0.08 },
    slide: { f: 'sound/slide.mp3', g: 0.3 }, tick: { f: 'sound/tick.mp3', g: 0.6 }, whoosh: { f: 'sound/whoosh.mp3', g: 0.26, vary: 0.1 }, pop: { f: 'sound/pop.mp3', g: 0.5 },
    chime: { f: 'sound/chime.wav', g: 0.5 }, notify: { f: 'sound/notify.wav', g: 0.4 },
  };
  const AC = window.AudioContext || window.webkitAudioContext;
  let ac = null, master = null, soundOn = true;
  const bufs = {};
  window.__snd = [];
  try { soundOn = localStorage.getItem('synk-lab-sound') !== 'off'; } catch { /* 기억 못 해도 켠다 */ }
  const loadAudio = () => {
    if (ac || !AC) return;
    ac = new AC(); master = ac.createGain(); const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; master.connect(comp).connect(ac.destination);
    for (const [k, s] of Object.entries(SND)) fetch(s.f).then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b)).then((d) => { bufs[k] = d; }).catch(() => {});
  };
  const play = (k, { g = 1, rate = 1, delay = 0 } = {}) => {
    if (!soundOn) return;
    const s = SND[k], r = rate * (1 + (Math.random() - 0.5) * (s.vary || 0));
    window.__snd.push({ t: Date.now() + delay * 1000, k, g: s.g * g, r });
    if (!ac || !bufs[k]) return;
    const src = ac.createBufferSource(); src.buffer = bufs[k]; src.playbackRate.value = r;
    const gn = ac.createGain(); gn.gain.value = s.g * g; src.connect(gn).connect(master); src.start(ac.currentTime + delay);
  };
  const paintSound = () => { soundBtn.setAttribute('aria-pressed', String(soundOn)); soundBtn.querySelector('span').textContent = soundOn ? '소리 켬' : '소리 꺼짐'; };
  root.addEventListener('pointerdown', () => { loadAudio(); ac?.resume(); }, { capture: true });
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn; try { localStorage.setItem('synk-lab-sound', soundOn ? 'on' : 'off'); } catch { /* 이번만 */ }
    paintSound(); if (soundOn) { loadAudio(); ac?.resume(); play('pop'); }
  });
  paintSound();

  /* ── 줄: 왼쪽 「지금」 자리(보기 세 칸)와 오른쪽 날 매듭 ── */
  const STOPS = [{ l: '지금', s: '지금' }, { l: '1분 뒤', s: '1분' }, { l: '내일', s: '1일' }, { l: '7일 뒤', s: '7일' }, { l: '30일 뒤', s: '30일' }];
  stopsEl.replaceChildren(...STOPS.map((s, i) => {
    const li = document.createElement('li'); li.className = 'sc-stop' + (i ? '' : ' is-today');
    li.innerHTML = `<b></b><span class="sc-l"></span><span class="sc-s"></span><i></i>${i ? '' : '<span class="sc-bracket"></span>'}`;
    li.querySelector('.sc-l').textContent = s.l; li.querySelector('.sc-s').textContent = s.s; return li;
  }));
  const stopLis = [...stopsEl.children], bracket = $('.sc-bracket', stopLis[0]);
  const endTag = document.createElement('span'); endTag.className = 'sc-end'; endTag.textContent = '내 위치'; endTag.setAttribute('aria-hidden', 'true'); endTag.style.cssText = 'left:0;top:0'; line.append(endTag);
  // 카드 크기는 CSS가 정한다(화면 폭에 따라 줄어든다). 보이지 않는 견본 한 장으로 잰다.
  const probe = document.createElement('div'); probe.className = 'sc-card'; probe.style.cssText = 'visibility:hidden;pointer-events:none'; probe.setAttribute('aria-hidden', 'true'); layer.append(probe);

  let W = 0, CY = 96, SAG = 16, CW = 232, CH = 150, narrow = false;
  let slotX = [0, 0, 0], knotX = [0, 0, 0, 0, 0];
  const cards = new Set();
  const wave = { a: 0, v: 0, x: 0 };
  const SIG2 = 2 * 95 * 95;
  // 줄의 높이(줄 구역 좌표): 양 끝 못에서 가운데로 처지고, 카드가 걸린 자리마다 그 무게만큼 더 처지고, 부딪히면 떨린다
  const baseY = (x) => { const u = clamp((x + 20) / (W + 40), 0, 1); return CY + SAG * 4 * u * (1 - u); };
  const cordY = (x) => {
    let y = baseY(x);
    for (const c of cards) if (c.dip) { const d = x - c.dx; y += c.dip * Math.exp(-(d * d) / SIG2); }
    return y + wave.a * Math.sin(x / 38) * Math.exp(-Math.abs(x - wave.x) / 420);
  };
  const kick = (x, v) => { wave.x = x; wave.v += v; };
  const posX = (at) => (at.kind === 'slot' ? slotX[at.i] : knotX[at.i]);
  const layout = () => {
    narrow = narrowMQ.matches;
    W = line.clientWidth; CY = narrow ? 80 : 96; SAG = narrow ? 9 : 16;
    CW = probe.offsetWidth || 232; CH = probe.offsetHeight || 150;
    const gut = parseFloat(getComputedStyle(head).paddingLeft) || 20;
    if (narrow) {
      // 휴대폰: 보기 세 장이 폭을 다 쓴다. 날 매듭은 보기가 떨어져 나간 뒤에 나타난다.
      const sp = (W - 2 * gut - CW) / 2;
      slotX = [0, 1, 2].map((i) => gut + CW / 2 + i * sp);
      const A = gut + (W - 2 * gut) * 0.52, B = W - gut - 14;
      knotX = [slotX[1], A, A + (B - A) * Math.sqrt(1 / 30), A + (B - A) * Math.sqrt(7 / 30), B];
    } else {
      const sp = CW + 26;
      slotX = [0, 1, 2].map((i) => gut + 8 + CW / 2 + i * sp);
      const A = slotX[2] + CW + 20, B = W - gut - 40;
      knotX = [slotX[1], A, A + (B - A) * Math.sqrt(1 / 30), A + (B - A) * Math.sqrt(7 / 30), B];
    }
    bracket.style.width = (slotX[2] - slotX[0] + CW) + 'px';
    line.classList.toggle('is-short', narrow || knotX[2] - knotX[1] < 56);
    endTag.style.display = narrow ? 'none' : '';
    for (const c of cards) if (c.home === 'line' && !c.moving && c.at) c.x = c.px = c.dx = posX(c.at);
  };

  /* ── 카드 ── */
  const makeCard = (id, text, num) => {
    const el = document.createElement('div'); el.className = 'sc-card'; el.setAttribute('role', 'button'); el.setAttribute('aria-disabled', 'true'); el.tabIndex = 0;
    el.innerHTML = '<div class="sc-card-in"><div class="sc-flip"><div class="sc-face sc-front"><span class="sc-num" aria-hidden="true"></span><span class="sc-word"></span></div>'
      + '<div class="sc-face sc-back" aria-hidden="true"><span class="sc-back-tag"></span><span class="sc-back-word"></span><span class="sc-stamps"></span></div></div></div>'
      + '<span class="sc-pin" aria-hidden="true"><i class="sc-pin-a"></i><i class="sc-pin-b"></i><i class="sc-pin-spring"></i></span>';
    const sh = document.createElement('div'); sh.className = 'sc-shadow'; sh.setAttribute('aria-hidden', 'true');
    layer.insertBefore(sh, probe); layer.insertBefore(el, probe);
    const c = { el, sh, flip: $('.sc-flip', el), wordEl: $('.sc-word', el), numEl: $('.sc-num', el), backTag: $('.sc-back-tag', el), backWord: $('.sc-back-word', el), stamps: $('.sc-stamps', el), pin: $('.sc-pin', el),
      id, text, x: 0, y: -400, th: 0, w: 0, s: 1, lift: 0, op: 0, home: 'fly', at: null, moving: false, grab: false, vx: 0, px: 0, dip: 0, dipV: 0, dx: 0, fall: null, answerable: false };
    setFace(c, id, text, num);
    gsap.set(c.flip, { rotationY: 0, transformPerspective: 900 });
    bindCard(c); cards.add(c); return c;
  };
  function setFace(c, id, text, num) {
    c.id = id; c.text = text; c.wordEl.textContent = text; c.backWord.textContent = text; c.numEl.textContent = String(num);
    c.el.setAttribute('aria-label', `${num}번 ${text}`); c.el.classList.remove('is-right', 'is-wrong');
  }
  const removeCard = (c) => { cards.delete(c); c.el.remove(); c.sh.remove(); };

  /* ── 움직임: 카드마다 진자, 줄은 용수철 ── */
  let last = performance.now(), visible = true;
  const tick = (now) => {
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    wave.v += (-wave.a * 260 - wave.v * 7) * dt; wave.a += wave.v * dt;
    const L = narrow ? 70 : 110, om = 2 * Math.PI * (narrow ? 1 : 0.78), dipW = narrow ? 7 : 10;
    for (const c of cards) {
      const dipT = c.home === 'line' && !c.lift ? dipW : 0;
      c.dipV += ((dipT - c.dip) * 90 - c.dipV * 9) * dt; c.dip += c.dipV * dt;
      if (c.home !== 'fall') c.dx = c.x;
    }
    for (const c of cards) {
      if (c.home === 'fall') {
        // 집게에서 풀린 카드: 중력으로 떨어지며 공기에 팔랑인다
        const f = c.fall; f.t += dt;
        f.vy += 2300 * dt; f.vy *= 1 - 0.8 * dt;
        c.w += Math.sin(f.t * 8 + f.ph) * 7 * dt; c.w *= 1 - 0.4 * dt;
        c.y += f.vy * dt; c.x += (f.vx + Math.sin(f.t * 6 + f.ph) * 40) * dt; c.th += c.w * dt;
        c.op = clamp(1 - (f.t - 0.3) / 0.5, 0, 1);
        if (c.op <= 0) { removeCard(c); continue; }
      } else {
        // 집게가 옮겨 가는 속도가 바뀌면(가속 · 감속) 카드 아래쪽이 뒤로 처졌다가 흔들린다. 시계 방향이 + 이므로 Δω = +Δv / L · cosθ
        const vNew = (c.x - c.px) / dt, dv = vNew - c.vx; c.vx = vNew; c.px = c.x;
        if (!c.grab && !reduce) {
          if (Math.abs(dv) < 3000) c.w += (dv / L) * Math.cos(c.th) * 0.22;
          c.w += (-om * om * Math.sin(c.th) - 1.5 * c.w) * dt;
          c.th = clamp(c.th + c.w * dt, -0.75, 0.75);
        } else if (reduce) { c.th = 0; c.w = 0; }
        if (c.home === 'line') c.y = cordY(c.x) - 7 - c.lift;
      }
      const tx = c.x - CW / 2;
      c.el.style.transform = `translate(${tx}px, ${c.y}px) rotate(${c.th}rad) scale(${c.s})`;
      c.sh.style.transform = `translate(${tx - 10 - c.th * 26}px, ${c.y + 18 + Math.abs(c.th) * 6}px) rotate(${c.th * 0.85}rad) scale(${c.s})`;
      c.el.style.opacity = String(c.op); c.sh.style.opacity = String((c.home === 'line' ? 0.85 : 0.5) * c.op);
    }
    stopLis.forEach((li, i) => {
      const x = knotX[i], y = i ? cordY(x) + 4.5 : baseY(x) - (narrow ? 40 : 48);
      li.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    });
    endTag.style.transform = `translate(${W - 8}px, ${cordY(W - 8) - 12}px) translate(-100%, -50%)`;
    let d = '', ds = '';
    for (let x = -20; x <= W + 20; x += 8) { const y = cordY(x), m = x === -20 ? 'M' : 'L'; d += `${m}${x} ${y.toFixed(1)}`; ds += `${m}${x} ${(y + 6).toFixed(1)}`; }
    cordPath.setAttribute('d', d); cordShadow.setAttribute('d', ds);
    if (visible) requestAnimationFrame(tick);
  };
  new IntersectionObserver((es) => { const v = es[0].isIntersecting; if (v && !visible) { visible = true; last = performance.now(); requestAnimationFrame(tick); } visible = v; }, { rootMargin: '200px 0px' }).observe(root);

  /* ── 손: 지나가면 살짝 밀리고, 짧게 누르면 답, 잡아 끌면 따라 흔들린다 ── */
  let answering = null, hinted = false;
  function bindCard(c) {
    const el = c.el; let down = null, dragged = false, suppress = 0;
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && c.home === 'line' && !c.moving && !down) { play('hover'); c.w -= clamp(e.movementX * 0.02, -0.5, 0.5) || 0.25; } });
    el.addEventListener('pointermove', (e) => {
      if (!down) { if (e.pointerType === 'mouse' && c.home === 'line') c.w -= clamp(e.movementX * 0.006, -0.6, 0.6); return; }
      if (!dragged && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7) { dragged = true; c.grab = true; el.classList.add('is-grab'); el.classList.remove('is-down'); hideHint(); }
      if (!dragged) return;
      const R = layer.getBoundingClientRect(), px = e.clientX - R.left, py = e.clientY - R.top;
      const target = clamp(Math.atan2(c.x - px, Math.max(30, py - c.y)), -0.7, 0.7);
      const prev = c.th; c.th += (target - c.th) * 0.4; c.w = (c.th - prev) * 60;
    });
    el.addEventListener('pointerdown', (e) => {
      if (c.moving || c.home !== 'line') return;
      down = { x: e.clientX, y: e.clientY }; dragged = false;
      el.classList.add('is-down'); play('press');
      try { el.setPointerCapture(e.pointerId); } catch { /* 이미 놓음 */ }
    });
    const up = () => {
      if (!down) return; down = null; el.classList.remove('is-down');
      if (dragged) { c.grab = false; el.classList.remove('is-grab'); if (Math.abs(c.w) > 3) play('whoosh', { g: 0.5, rate: 1.3 }); suppress = performance.now(); }
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('click', () => {
      if (performance.now() - suppress < 400) return;
      if (c.answerable && answering) answering(c);
      else if (c.home === 'line' && !c.moving) { c.w += sign() * 1.4; play('hover', { g: 1.6 }); }
    });
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault(); if (!c.answerable || !answering) return;
      el.classList.add('is-down'); play('press'); setTimeout(() => { el.classList.remove('is-down'); answering?.(c); }, 110);
    });
  }
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || !visible || !answering) return;
    const n = Number(e.key); if (!(n >= 1 && n <= 3)) return;
    const c = [...cards].find((k) => k.answerable && k.at?.kind === 'slot' && k.at.i === n - 1); if (!c) return;
    c.el.classList.add('is-down'); play('press'); setTimeout(() => { c.el.classList.remove('is-down'); answering?.(c); }, 110);
  });
  const showHint = (c) => {
    if (hinted || reduce) return; hinted = true;
    if (narrow) { hint.style.left = clamp(c.x - 85, 12, W - 182) + 'px'; hint.style.top = (c.y + CH + 22) + 'px'; }
    else { hint.style.left = (c.x + CW / 2 + 16) + 'px'; hint.style.top = (c.y + CH * 0.42) + 'px'; }
    gsap.fromTo(hint, { opacity: 0, x: -6 }, { opacity: 1, x: 0, duration: 0.5, ease: 'power2.out' });
    setTimeout(hideHint, 4200);
  };
  function hideHint() { gsap.to(hint, { opacity: 0, duration: 0.3 }); }

  /* ── 글이 낱말마다 들어온다 ── */
  const kinetic = (el, text, delay = 0) => {
    el.replaceChildren(...String(text).split(/(\s+)/).map((w) => { if (/^\s+$/.test(w)) return document.createTextNode(w.includes('\n') ? '\n' : ' '); const s = document.createElement('span'); s.className = 'sc-w'; s.textContent = w; return s; }));
    if (reduce) return;
    gsap.fromTo(el.querySelectorAll('.sc-w'), { y: '0.45em', opacity: 0, filter: 'blur(5px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.6, ease: 'power3.out', stagger: 0.035, delay });
  };

  /* ── 카드 동작 ── */
  const PATH_UNDER = 'M3 9 C 44 4, 92 12, 138 7 S 214 4, 237 8';
  const PATH_STRIKE = 'M2 9 C 50 9, 120 6, 236 4 L 230 7';
  const mark = (wordEl, kind) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', `sc-mark is-${kind}`); svg.setAttribute('viewBox', '0 0 240 14'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', kind === 'under' ? PATH_UNDER : PATH_STRIKE); svg.append(p); wordEl.append(svg);
    const len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
    return gsap.to(p, { strokeDashoffset: 0, duration: kind === 'under' ? 0.45 : 0.3, ease: 'power2.inOut' });
  };
  // 처음: 카드가 위에서 떨어져 열린 집게가 줄을 물고 닫힌다
  const dropIn = (c, at, delay) => new Promise((res) => {
    c.at = at; const x1 = posX(at); c.x = c.px = c.dx = x1; c.home = 'fly'; c.th = sign() * (0.08 + Math.random() * 0.12); c.w = 0;
    c.el.classList.add('is-open');
    const y0 = -CH - 120; c.y = y0; c.op = 0;
    const o = { t: 0 };
    gsap.to(o, { t: 1, duration: reduce ? 0 : 0.6, ease: 'power3.in', delay: reduce ? 0 : delay,
      onUpdate: () => { c.y = y0 + (cordY(x1) - 7 - y0) * o.t; c.op = Math.min(1, o.t * 2.5); },
      onComplete: () => { c.home = 'line'; c.op = 1; c.el.classList.remove('is-open'); c.w += sign() * 1.1; c.dipV += 160; kick(x1, 110); play('clipsnap'); res(); } });
  });
  // 집게가 열리면 카드는 떨어지고, 빈 집게는 줄에 남아 닫혔다가 사라진다
  const leavePin = (c) => {
    const p = c.pin, ox = p.offsetLeft, oy = p.offsetTop;
    const k = p.cloneNode(true);
    k.style.cssText = `left:${c.x - CW / 2 + ox}px;top:${c.y + oy}px;margin-left:0`;
    layer.insertBefore(k, probe); p.style.visibility = 'hidden';
    gsap.set(k, { transformOrigin: `${CW / 2 - ox}px ${-oy}px`, rotation: (c.th * 180) / Math.PI });
    gsap.to(k, { rotation: 0, duration: reduce ? 0 : 0.9, ease: 'elastic.out(1, 0.35)' });
    gsap.to(k, { y: -(narrow ? 7 : 10), duration: 0.5, ease: 'power2.out' });
    gsap.to(k, { opacity: 0, scale: 0.86, duration: 0.45, delay: reduce ? 0 : 0.85, ease: 'power2.in', onComplete: () => k.remove() });
  };
  const unclip = (c, delay = 0) => new Promise((res) => setTimeout(() => {
    if (!cards.has(c) || c.home === 'fall') return res();
    c.answerable = false; c.el.classList.add('is-open'); play('clipopen', { g: 0.8 });
    setTimeout(() => {
      leavePin(c);
      c.home = 'fall'; c.fall = { vy: -40, vx: sign() * (20 + Math.random() * 50), t: 0, ph: Math.random() * 6 };
      c.w += sign() * (1.2 + Math.random()); c.el.style.pointerEvents = 'none'; if (document.activeElement === c.el) c.el.blur();
      kick(c.x, 70); play('whoosh', { g: 0.6, rate: 1.05 + Math.random() * 0.25 });
      res();
    }, reduce ? 0 : 110);
  }, reduce ? 0 : delay));
  const flipTo = (c, face) => new Promise((res) => { play('flip'); gsap.to(c.flip, { rotationY: face === 'front' ? 0 : 180, transformPerspective: 900, duration: reduce ? 0 : 0.62, ease: 'back.out(1.4)', onComplete: res }); c.w += 0.45; });
  const stamp = (c, ok, label) => {
    const s = document.createElement('span'); s.className = `sc-stamp ${ok ? 'is-ok' : 'is-x'}`; s.innerHTML = `<em>${ok ? '✓' : '✕'}</em><span></span>`; s.querySelector('span').textContent = label;
    c.stamps.append(s); while (c.stamps.children.length > 2) c.stamps.firstElementChild.remove();
    play('stamp'); c.w += sign() * (ok ? 0.7 : 1.1); kick(c.x, 40);
    if (!reduce) { gsap.fromTo(s, { scale: 1.9, opacity: 0, rotation: -24 }, { scale: 1, opacity: 1, rotation: -12, duration: 0.32, ease: 'back.out(2.4)' }); gsap.fromTo(c, { s: 0.955 }, { s: 1, duration: 0.4, ease: 'back.out(3)' }); }
  };
  // 줄을 따라 옮겨 간다: 집게가 살짝 열려 들리고, 미끄러지고, 닿으면 닫힌다
  const travel = (c, at) => new Promise((res) => {
    const x1 = posX(at), dist = Math.abs(x1 - c.x);
    c.moving = true; c.el.classList.add('is-open'); c.el.style.zIndex = '3'; play('clipopen');
    const dur = reduce ? 0 : Math.min(1.3, 0.55 + dist / 1400);
    gsap.timeline({ onComplete: () => { c.at = at; c.moving = false; c.el.classList.remove('is-open'); c.el.style.zIndex = ''; play('clipsnap'); kick(x1, 70); c.dipV += 60; res(); } })
      .to(c, { lift: 8, duration: reduce ? 0 : 0.16, ease: 'power2.out' })
      .call(() => play('slide', { rate: clamp(900 / Math.max(200, dist), 0.8, 1.3) }))
      .to(c, { x: x1, duration: dur, ease: 'power2.inOut' })
      .to(c, { lift: 0, duration: reduce ? 0 : 0.14, ease: 'power2.in' }, '>-0.06');
  });
  // 그 말이 돌아왔다: 줄 위에서 깡충 뛰며 앞면(낱말)으로 뒤집히고, 붉은 테로 「돌아온 말」임을 알린다
  const callBack = (c) => new Promise((res) => {
    play('whoosh', { g: 0.7, rate: 1.2 }); c.el.classList.add('is-called');
    c.wordEl.querySelectorAll('.sc-mark').forEach((m) => m.remove()); c.el.classList.remove('is-right', 'is-wrong');
    gsap.timeline({ onComplete: res })
      .to(c, { lift: 34, duration: reduce ? 0 : 0.28, ease: 'power2.out' })
      .call(() => { flipTo(c, 'front'); })
      .to(c, { lift: 0, duration: reduce ? 0 : 0.42, ease: 'bounce.out' }, reduce ? '>' : '+=0.3')
      .call(() => { play('clipsnap', { g: 0.6 }); kick(c.x, 60); });
  });
  const markStop = (i, ok) => { const b = stopLis[i].querySelector('b'); b.textContent = ok ? '✓' : '✕'; b.style.color = ok ? 'var(--ink)' : 'var(--stamp)'; if (!reduce) gsap.fromTo(b, { scale: 1.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' }); };
  const setClock = (k) => stopLis.forEach((li, i) => { if (!i) return; li.classList.toggle('is-now', i === k); li.classList.toggle('is-past', i < k); });
  const setFull = (on) => line.classList.toggle('is-full', on);

  /* ── 무대 글 ── */
  const setAfter = (s, t) => { kinetic(say, s, 0); sub.textContent = t; if (!reduce) gsap.fromTo(sub, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.25 }); };
  const button = (label, fn) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sc-btn'; b.innerHTML = '<span></span><span class="arr" aria-hidden="true">→</span>'; b.firstChild.textContent = label;
    b.addEventListener('pointerdown', () => { b.classList.add('is-down'); play('press'); });
    b.addEventListener('pointerup', () => b.classList.remove('is-down')); b.addEventListener('pointerleave', () => b.classList.remove('is-down'));
    let used = false; b.addEventListener('click', () => { if (used) return; used = true; fn(); });
    next.replaceChildren(b); play('pop', { delay: 0.05 });
    if (!reduce) gsap.fromTo(b, { scale: 0.7, opacity: 0, y: 8 }, { scale: 1, opacity: 1, y: 0, duration: 0.55, ease: 'back.out(2)' });
    b.focus({ preventScroll: true });
    return b;
  };
  const leaveStage = () => new Promise((res) => { if (reduce) return res(); gsap.to([stage, after], { y: -18, opacity: 0, filter: 'blur(6px)', duration: 0.34, ease: 'power2.in', onComplete: res }); });
  const enterStage = () => { if (!reduce) gsap.fromTo([stage, after], { y: 14, opacity: 0, filter: 'blur(6px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.5, ease: 'power3.out' }); };
  const fastForward = (cap, from, to, fmt, scene) => new Promise((res) => {
    ffCap.textContent = cap; play('tick');
    const o = { v: from };
    if (scene) root.dataset.scene = scene;
    gsap.timeline({ onComplete: res })
      .fromTo(ff, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(2)' })
      .to(o, { v: to, duration: reduce ? 0 : 1.15, ease: 'power3.out', onUpdate: () => { ffNum.textContent = fmt(o.v); } }, 0)
      .to(ff, { opacity: 0, scale: 1.04, duration: 0.3, ease: 'power2.in' }, '+=0.35');
  });
  const mmss = (v) => { const s = Math.round(v); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

  /* ── 흐름 ── */
  const showQuestion = (q) => { qhead.textContent = q.head; kinetic(ctxEl, q.context, 0.05); kinetic(promptEl, q.prompt, 0.18); setAfter(q.say, q.sub); next.replaceChildren(); };
  const takeAnswer = (cs, q) => new Promise((done) => {
    cs.forEach((c) => { c.answerable = true; c.el.removeAttribute('aria-disabled'); });
    answering = (picked) => {
      answering = null;
      cs.forEach((c) => { c.answerable = false; c.el.setAttribute('aria-disabled', 'true'); });
      const correct = cs.find((c) => c.id === q.answer), right = picked === correct;
      if (right) {
        picked.el.classList.add('is-right'); mark(picked.wordEl, 'under'); play('underline'); play('chime', { delay: 0.18 }); picked.w += sign() * 1.4;
      } else {
        picked.el.classList.add('is-wrong'); play('strike', { delay: 0.1 }); picked.w += sign() * 1.5; kick(picked.x, 50);
        if (!reduce) gsap.fromTo(picked.wordEl, { x: 0 }, { keyframes: [{ x: -7 }, { x: 6 }, { x: -4 }, { x: 3 }, { x: 0 }], duration: 0.4, ease: 'power1.inOut' });
        setTimeout(() => mark(picked.wordEl, 'strike'), 100);
        setTimeout(() => { correct.el.classList.add('is-right'); mark(correct.wordEl, 'under'); play('underline'); correct.w += sign() * 0.9; }, 640);
      }
      done({ right, correct });
    };
  });
  // 답한 뒤: 배울 말만 남기고 나머지는 떨어진다 → 남은 카드가 뒤집혀 기록 면에 도장을 받는다
  const settle = async (cs, r, tag) => {
    await wait(r.right ? 560 : 1250);
    cs.filter((c) => c !== r.correct).forEach((c, i) => unclip(c, i * 180));
    await wait(420); setFull(false);
    await wait(260);
    r.correct.backTag.textContent = tag;
    await flipTo(r.correct, 'back'); await wait(60);
    stamp(r.correct, r.right, r.right ? '내일' : '1분 뒤');
  };
  async function first() {
    root.dataset.scene = 'now'; setClock(0);
    stopLis.forEach((li) => { li.querySelector('b').textContent = ''; });
    showQuestion(Q.first); enterStage(); setFull(true);
    const cs = Q.first.choices.map(([id, text], i) => makeCard(id, text, i + 1));
    await Promise.all(cs.map((c, i) => dropIn(c, { kind: 'slot', i }, 0.3 + i * 0.2)));
    const r = await takeAnswer(cs, Q.first);
    await settle(cs, r, '오늘 처음 만난 말');
    setAfter(r.right ? Q.right.say : Q.wrong.say, r.right ? Q.right.sub : Q.wrong.sub);
    await wait(700);
    await travel(r.correct, { kind: 'knot', i: r.right ? 2 : 1 }); showHint(r.correct);
    await wait(260);
    if (r.right) button(Q.toDay1, () => toTomorrow(r.correct)); else button(Q.toMinute, () => toMinute(r.correct));
  }
  async function toMinute(c) {
    hideHint(); await leaveStage(); setClock(1);
    await fastForward('1분 뒤', 0, 60, mmss, null);
    c.backTag.textContent = '1분 전에 틀린 말';
    await callBack(c); await wait(80);
    await travel(c, { kind: 'slot', i: Q.second.choices.findIndex(([, t]) => t === c.text) });
    second(c);
  }
  async function second(c) {
    const q = Q.second;
    showQuestion(q); enterStage(); setFull(true);
    const drops = [];
    const cs = q.choices.map(([id, text], i) => {
      if (text === c.text) { setFace(c, id, text, i + 1); return c; }
      const k = makeCard(id, text, i + 1); drops.push(dropIn(k, { kind: 'slot', i }, 0.15 + drops.length * 0.2)); return k;
    });
    await Promise.all(drops);
    c.el.classList.remove('is-called');
    if (!root.contains(document.activeElement)) cs[0].el.focus({ preventScroll: true });
    const r = await takeAnswer(cs, q);
    await settle(cs, r, '1분 전에 틀린 말');
    markStop(1, r.right);
    setAfter(r.right ? Q.backRight.say : Q.backWrong.say, r.right ? Q.backRight.sub : Q.backWrong.sub);
    await wait(700);
    await travel(r.correct, { kind: 'knot', i: r.right ? 2 : 1 });
    await wait(260);
    if (r.right) button(Q.toDay1, () => toTomorrow(r.correct)); else button(Q.toMinute, () => toMinute(r.correct));
  }
  async function toTomorrow(c) {
    hideHint(); await leaveStage(); setClock(2); play('notify');
    await fastForward('내일 아침', 0, 1, (v) => `${Math.round(v)}일`, 'morning');
    qhead.textContent = ''; ctxEl.textContent = ''; promptEl.textContent = '';
    await callBack(c);
    // 첫 장면은 여기까지(다음 장면은 이 장면을 보신 뒤 짓는다)
    setAfter('첫 장면은 여기까지입니다', '내일은 이 말이 먼저 돌아와 다른 장면으로 묻습니다. 그 뒤(7일 뒤 · 30일 뒤 · 내 위치)는 이 장면을 보신 뒤에 이어서 짓습니다.');
    enterStage();
    button(Q.again, restart);
  }
  async function restart() {
    hideHint(); await leaveStage();
    [...cards].forEach((c, i) => unclip(c, i * 140));
    await wait(700);
    first();
  }

  /* ── 시작 ── */
  // 소리는 쪽이 열릴 때 미리 받아 둔다(재생은 처음 누르는 순간부터 — 브라우저 규칙). 그래야 첫 누름 · 첫 연필 소리가 빠지지 않는다.
  loadAudio();
  layout(); new ResizeObserver(layout).observe(root);
  narrowMQ.addEventListener('change', layout);
  requestAnimationFrame(tick);
  first();
})();
