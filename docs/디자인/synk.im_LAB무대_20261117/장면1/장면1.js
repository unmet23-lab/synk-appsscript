// LAB 「직접 풀어 보기」 — 줄에 매단 3D 낱말 배지(2026-11-18, 셋째 판 · 저녁에 나머지 장면을 더함).
// 30일은 줄 하나다. 보기 세 낱말이 「지금」 자리에 은색 집게로 물린 배지다. 배지 앞면 창에서는 그 말을 하는 인물이 움직인다(옴니 1.2로 구운 짧은 영상).
// 카드를 누르면 답이 되고, 잡아 끌면 흔들린다. 손을 올리면 그쪽으로 돌아보며 빛이 미끄러지고, 창 속 인물이 그 말을 몸으로 한다.
// 답하면 틀린 보기는 집게가 열리며 공중에서 돌며 떨어지고, 남은 배지(배울 말)는 뒤집혀 무지갯빛 기록 면에 도장을 받은 뒤 줄을 따라 다음에 돌아올 날로 간다.
// 흐름: 첫 문제 → (틀리면 1분 뒤 둘째 문제) → 내일(튜터가 먼저 꺼냄) → 7일 뒤(그림만 보고 떠올리기) → 30일 뒤(겨울, 처음 보는 문제) → 내 위치(기록 면과 큰 도장).
// 날이 바뀔 때는 탁상 달력이 넘어가고, 아침 · 비 · 눈으로 바탕과 소리가 바뀐다. 글은 공개본 원고(../원고.json)를 따르고, 30일 문제만 줄을 따라 돌아온 말로 바꿨다(README 「나머지 장면」).
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
  // 날마다(원고 days). 30일 문제는 원고의 「친구가 떨어진 책 → 감사합니다」 대신, 줄을 따라 돌아온 말(안녕하세요)을 처음 보는 장면으로 묻는다.
  const D = {
    d1: { head: '내일 아침 · 앱을 열면', chat: '어제 처음 만난 말이에요. 오늘 한 번 더 들어 볼까요?', say: '앱을 열면 튜터가 먼저 꺼냅니다', sub: '복습 시간표를 따로 열지 않습니다. 돌아올 말이 없는 날에는 다른 연습을 권합니다.', next: '7일 뒤로' },
    d7: { head: '7일 뒤 · 기억나요?', chat: '일주일 만이에요. 이 사람은 뭐라고 했을까요?', chat2: '속으로 말해 보고, 카드를 눌러 확인하세요.', say: '맞혔다고 끝이 아닙니다', sub: '일주일 뒤, 다시 확인할 때입니다. 레슨이나 복습을 이어 가면 처음 보는 문제로 확인합니다.', next: '30일 뒤로' },
    d30: { head: '30일 뒤 · 처음 보는 문제', say: '한 달 뒤, 처음 보는 문제', sub: '레슨을 이어 가면 같은 항목의 다른 문제가 나옵니다. 외웠는지가 아니라 아는지를 봅니다.', context: '눈 오는 아침, 엘리베이터에서 이웃을 만났어요.', prompt: '이웃에게 어떤 인사를 할까요?', answer: 'c', choices: [['a', '감사합니다.'], ['b', '다녀왔어요.'], ['c', '안녕하세요.']],
      right: { say: '한 달 뒤에도 혼자 맞혔습니다', sub: '이 답이 30일 칸을 채웁니다. 하루 · 일주일 · 한 달 뒤 확인이 모두 끝났습니다.' }, wrong: { say: '이 칸은 「다시 연습」으로 남습니다', sub: '틀린 답도 그대로 남고, 이 말은 1분 뒤 다른 장면으로 돌아옵니다.' }, next: '내 위치 보기' },
    me: { head: '내 위치', say: '점수 말고 근거로 봅니다', sub: '게임 · 생활 레슨 · 짧은 진단의 답이 한 기록에 모입니다. 내 위치는 처음 보는 문제를 도움 없이 푼 답으로만 정합니다.', go: 'SYNK WORLD 열기' },
  };
  const WORLD = /(^|\.)synk\.im$/.test(location.hostname) ? '/world/' : 'https://synk.im/world/';

  // 낱말마다 창 속 장면(옴니 1.2로 구운 5초 영상과 첫 장 그림). 영상이 없으면 그림만 둔다. 30일 뒤에는 같은 인물이 겨울 옷을 입은 판을 쓴다.
  const PIC = { '안녕하세요.': { k: 'hello', v: 'hello', tone: '#ADD9F5', say: 0.7 }, '감사합니다.': { k: 'thanks', v: 'thanks', tone: '#F9C7B4', say: 0.8 }, '다녀왔어요.': { k: 'home', v: 'home', tone: '#BCE4D1', say: 0.25 } };
  const PICW = { '안녕하세요.': { k: 'hello-w', v: 'hello', tone: '#CFE6F5', say: 0.7 }, '감사합니다.': { k: 'thanks-w', v: 'thanks', tone: '#F5D3D3', say: 0.8 }, '다녀왔어요.': { k: 'home-w', v: 'home', tone: '#D3EBDD', say: 0.25 } };
  let winter = false;
  const VIDEO = window.__SCVIDEO !== false;
  const cardSrc = (k, ext) => (window.__CARDDATA && window.__CARDDATA[`${k}.${ext}`]) || `card/${k}.${ext}`;

  /* ── 소리: 동작마다 다른 효과음(Web Audio). 쪽이 열릴 때 받아 두고, 처음 누르는 순간부터 난다. ── */
  const SND = {
    hover: { f: 'sound/hover.mp3', g: 0.28, vary: 0.12 }, press: { f: 'sound/press.mp3', g: 0.7, vary: 0.06 },
    strike: { f: 'sound/strike.mp3', g: 0.7 }, underline: { f: 'sound/underline.mp3', g: 0.62 }, stamp: { f: 'sound/stamp.mp3', g: 0.95 },
    flip: { f: 'sound/flip.mp3', g: 0.62, vary: 0.08 }, clipopen: { f: 'sound/clipopen.mp3', g: 0.7, vary: 0.08 }, clipsnap: { f: 'sound/clipsnap.mp3', g: 0.9, vary: 0.08 },
    slide: { f: 'sound/slide.mp3', g: 0.3 }, tick: { f: 'sound/tick.mp3', g: 0.6 }, whoosh: { f: 'sound/whoosh.mp3', g: 0.26, vary: 0.1 }, pop: { f: 'sound/pop.mp3', g: 0.5 },
    chime: { f: 'sound/chime.wav', g: 0.5 }, notify: { f: 'sound/notify.wav', g: 0.4 },
    vhello: { f: 'sound/v-hello.mp3', g: 0.85 }, vthanks: { f: 'sound/v-thanks.mp3', g: 0.85 }, vhome: { f: 'sound/v-home.mp3', g: 0.85 },
    rain: { f: 'sound/rain.mp3', g: 0.3 }, wind: { f: 'sound/wind.mp3', g: 0.34 },
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
  const hooks = [1, 2, 3, 4].map(() => { const h = document.createElement('span'); h.className = 'sc-pin sc-hook'; h.setAttribute('aria-hidden', 'true'); h.innerHTML = '<i class="sc-pin-b"></i><i class="sc-pin-a"></i>'; layer.insertBefore(h, probe); return h; });

  let W = 0, CY = 96, SAG = 16, CW = 232, CH = 150, HW = 30, HH = 24, narrow = false;
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
    W = line.clientWidth; CY = narrow ? 76 : 92; SAG = narrow ? 9 : 16;
    CW = probe.offsetWidth || 232; CH = probe.offsetHeight || 150; HW = hooks[0].offsetWidth || 30; HH = hooks[0].offsetHeight || 24;
    const gut = parseFloat(getComputedStyle(head).paddingLeft) || 20;
    if (narrow) {
      // 휴대폰: 보기 세 장이 폭을 다 쓴다. 날 매듭은 보기가 떨어져 나간 뒤에 나타난다.
      const sp = (W - 2 * gut - CW) / 2;
      slotX = [0, 1, 2].map((i) => gut + CW / 2 + i * sp);
      const A = gut + (W - 2 * gut) * 0.36, B = W - gut - CW / 2;
      knotX = [slotX[1], A, A + (B - A) * (1 / 30) ** 0.4, A + (B - A) * (7 / 30) ** 0.4, B];
    } else {
      const sp = CW + 30;
      slotX = [0, 1, 2].map((i) => gut + 8 + CW / 2 + i * sp);
      // 30일 매듭은 카드가 걸려도 오른쪽 끝(「내 위치」 글)에 닿지 않게 둔다. 날 간격은 30일을 0.4제곱으로 눌러 앞쪽 날도 떨어져 보이게 한다.
      const A = slotX[2] + CW + 40, B = W - gut - CW / 2 - 10;
      knotX = [slotX[1], A, A + (B - A) * (1 / 30) ** 0.4, A + (B - A) * (7 / 30) ** 0.4, B];
    }
    bracket.style.width = (slotX[2] - slotX[0] + CW) + 'px';
    line.classList.toggle('is-short', narrow || knotX[2] - knotX[1] < 56);
    endTag.style.display = narrow ? 'none' : '';
    for (const c of cards) if (c.home === 'line' && !c.moving && c.at) c.x = c.px = c.dx = posX(c.at);
    if (skyKind) sizeSky();
  };

  /* ── 카드 ── */
  const makeCard = (id, text, num) => {
    const el = document.createElement('div'); el.className = 'sc-card'; el.setAttribute('role', 'button'); el.setAttribute('aria-disabled', 'true'); el.tabIndex = 0;
    el.innerHTML = '<div class="sc-card-in"><div class="sc-box"><div class="sc-flip">'
      + '<div class="sc-face sc-front"><div class="sc-pic"></div><div class="sc-meta"><span class="sc-num" aria-hidden="true"></span><span class="sc-word"></span></div><i class="sc-dot"></i><i class="sc-gloss"></i></div>'
      + '<div class="sc-face sc-back" aria-hidden="true"><span class="sc-back-tag"></span><span class="sc-back-word"></span><i class="sc-back-rule"></i><span class="sc-stamps"></span><i class="sc-gloss"></i></div>'
      + '<i class="sc-side is-l"></i><i class="sc-side is-r"></i><i class="sc-side is-t"></i><i class="sc-side is-b"></i></div>'
      + '<span class="sc-pin" aria-hidden="true"><i class="sc-pin-b"></i><i class="sc-pin-a"></i></span></div></div>';
    const sh = document.createElement('div'); sh.className = 'sc-shadow'; sh.setAttribute('aria-hidden', 'true');
    layer.insertBefore(sh, probe); layer.insertBefore(el, probe);
    const c = { el, sh, box: $('.sc-box', el), flip: $('.sc-flip', el), pic: $('.sc-pic', el), wordEl: $('.sc-word', el), numEl: $('.sc-num', el), backTag: $('.sc-back-tag', el), backWord: $('.sc-back-word', el), stamps: $('.sc-stamps', el), pin: $('.sc-pin', el),
      id, text, x: 0, y: -400, th: 0, w: 0, s: 1, lift: 0, op: 0, home: 'fly', at: null, moving: false, grab: false, vx: 0, px: 0, dip: 0, dipV: 0, dx: 0, fall: null, answerable: false,
      ps: 0, pv: 0, pt: 0, fx: 0, fv: 0, ft: 0, hover: false, video: null, picKey: null };
    setFace(c, id, text, num);
    gsap.set(c.flip, { rotationY: 0, transformPerspective: 900 });
    bindCard(c); cards.add(c); return c;
  };
  function setPic(c) {
    const m = (winter && PICW[c.text]) || PIC[c.text]; if (!m || c.picKey === m.k) return; c.picKey = m.k; c.pm = m;
    c.pic.style.setProperty('--tone', m.tone);
    const img = new Image(); img.src = cardSrc(m.k, 'jpg'); img.alt = ''; img.decoding = 'async';
    c.pic.replaceChildren(img); c.video = null;
    if (!VIDEO || (window.__CARDDATA && !window.__CARDDATA[m.k + '.mp4'])) return;   // 한 파일로 묶은 쪽에 영상이 없으면 그림만
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.poster = cardSrc(m.k, 'jpg');
    v.addEventListener('loadeddata', () => { c.pic.append(v); c.video = v; }, { once: true });
    v.src = cardSrc(m.k, 'mp4');
  }
  // 창 속 인물이 그 말을 몸으로 한다(처음부터 한 번). 이미 하고 있으면 그대로 둔다.
  // voice가 참이면 그 말을 소리로도 한다(처음 떨어질 때는 셋이 겹치므로 몸짓만).
  const act = (c, again = false, voice = false) => {
    const m = c.pm, v = c.video, busy = v && !v.paused && !v.ended;
    if (busy && !again) return;
    if (voice && m) play('v' + m.v, { delay: v && !reduce ? m.say : 0 });
    if (!v || reduce) return;
    try { v.currentTime = 0; } catch { /* 아직 못 감음 */ } v.play().catch(() => {});
  };
  function setFace(c, id, text, num) {
    c.id = id; c.text = text; c.wordEl.textContent = text; c.backWord.textContent = text; c.numEl.textContent = String(num); setPic(c);
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
        c.ps += c.pv * dt; c.fx += c.fv * dt; c.pv *= 1 - 0.3 * dt; c.fv *= 1 - 0.3 * dt;
        c.op = clamp(1 - (f.t - 0.3) / 0.5, 0, 1);
        if (c.op <= 0) { removeCard(c); continue; }
      } else {
        // 세로 축 비틀림(ψ)과 앞뒤 기울임(φ): 줄에 매단 배지는 흔들릴 때 조금씩 돈다. 손을 올리면 그쪽으로 돌아본다.
        if (!reduce) {
          c.pv += ((c.pt - c.ps) * 38 - c.pv * 3.2) * dt; c.ps += c.pv * dt;
          c.fv += ((c.ft - c.fx) * 60 - c.fv * 7) * dt; c.fx += c.fv * dt;
        }
        // 집게가 옮겨 가는 속도가 바뀌면(가속 · 감속) 카드 아래쪽이 뒤로 처졌다가 흔들린다. 시계 방향이 + 이므로 Δω = +Δv / L · cosθ
        const vNew = (c.x - c.px) / dt, dv = vNew - c.vx; c.vx = vNew; c.px = c.x;
        if (!c.grab && !reduce) {
          if (Math.abs(dv) < 3000) { c.w += (dv / L) * Math.cos(c.th) * 0.22; c.pv += (dv / L) * 0.05; }
          c.w += (-om * om * Math.sin(c.th) - 1.5 * c.w) * dt;
          c.th = clamp(c.th + c.w * dt, -0.75, 0.75);
        } else if (reduce) { c.th = 0; c.w = 0; }
        if (c.home === 'line') c.y = cordY(c.x) + 2 - c.lift;
      }
      const tx = c.x - CW / 2;
      c.el.style.transform = `translate(${tx}px, ${c.y}px) rotate(${c.th}rad) scale(${c.s})`;
      c.box.style.transform = `rotateY(${c.ps}rad) rotateX(${c.fx}rad)`;
      c.el.style.setProperty('--g', (Math.sin(c.ps) * 0.9 + c.th * 0.6).toFixed(3));
      const sx = Math.max(0.12, Math.abs(Math.cos(c.ps)));
      c.sh.style.transform = `translate(${tx - 14 - c.th * 30}px, ${c.y + 26 + Math.abs(c.th) * 6}px) rotate(${c.th * 0.85}rad) scale(${c.s * sx}, ${c.s})`;
      c.el.style.opacity = String(c.op); c.sh.style.opacity = String((c.home === 'line' ? 0.85 : 0.5) * c.op);
    }
    stopLis.forEach((li, i) => {
      const x = knotX[i], y = i ? cordY(x) + 4.5 : baseY(x) - (narrow ? 40 : 48);
      li.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    });
    endTag.style.transform = `translate(${W - 8}px, ${cordY(W - 8) - 12}px) translate(-100%, -50%)`;
    const full = line.classList.contains('is-full');
    hooks.forEach((h, k) => {
      const i = k + 1, x = knotX[i];
      const taken = [...cards].some((c) => c.home === 'line' && !c.moving && c.at && c.at.kind === 'knot' && c.at.i === i);
      h.style.transform = `translate(${x - HW / 2}px, ${cordY(x) - HH + 11}px)`;
      h.style.opacity = taken || (narrow && full) ? '0' : '1';
    });
    let d = '', ds = '';
    for (let x = -20; x <= W + 20; x += 8) { const y = cordY(x), m = x === -20 ? 'M' : 'L'; d += `${m}${x} ${y.toFixed(1)}`; ds += `${m}${x} ${(y + 6).toFixed(1)}`; }
    cordPath.setAttribute('d', d); cordShadow.setAttribute('d', ds);
    if (visible) requestAnimationFrame(tick);
  };
  new IntersectionObserver((es) => { const v = es[0].isIntersecting; if (v && !visible) { visible = true; last = performance.now(); requestAnimationFrame(tick); if (skyKind && !skyRaf) { skyLast = 0; skyRaf = requestAnimationFrame(skyTick); } } visible = v; }, { rootMargin: '200px 0px' }).observe(root);

  /* ── 손: 지나가면 살짝 밀리고, 짧게 누르면 답, 잡아 끌면 따라 흔들린다 ── */
  let answering = null, hinted = false;
  function bindCard(c) {
    const el = c.el; let down = null, dragged = false, suppress = 0;
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && c.home === 'line' && !c.moving && !down) { c.hover = true; play('hover'); c.w -= clamp(e.movementX * 0.02, -0.5, 0.5) || 0.25; act(c, false, true); } });
    el.addEventListener('pointerleave', () => { c.hover = false; c.pt = 0; c.ft = 0; });
    el.addEventListener('pointermove', (e) => {
      if (!down) {
        if (e.pointerType === 'mouse' && c.home === 'line') {
          c.w -= clamp(e.movementX * 0.006, -0.6, 0.6);
          // 손이 있는 쪽으로 돌아본다(배지의 그 쪽 가장자리가 손 쪽으로 다가온다)
          const r = el.getBoundingClientRect(); const u = clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5), v = clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5);
          c.pt = -u * 0.62; c.ft = v * 0.32;
        }
        return;
      }
      if (!dragged && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7) { dragged = true; c.grab = true; el.classList.add('is-grab'); el.classList.remove('is-down'); hideHint(); }
      if (!dragged) return;
      const R = layer.getBoundingClientRect(), px = e.clientX - R.left, py = e.clientY - R.top;
      const target = clamp(Math.atan2(c.x - px, Math.max(30, py - c.y)), -0.7, 0.7);
      const prev = c.th; c.th += (target - c.th) * 0.4; c.w = (c.th - prev) * 60;
    });
    el.addEventListener('pointerdown', (e) => {
      if (c.home === 'show' && !c.moving) { el.classList.add('is-down'); play('press'); setTimeout(() => el.classList.remove('is-down'), 120); return; }
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
      else if (c.home === 'line' && !c.moving) { c.w += sign() * 1.4; c.pv += sign() * 4; play('hover', { g: 1.6 }); act(c, true, true); }
      else if (c.home === 'show' && !c.moving) turnShow(c);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (c.home === 'show' && !c.moving) { turnShow(c); return; }
      if (!c.answerable || !answering) return;
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
    if (narrow) { hint.style.left = clamp(c.x - 85, 12, W - 182) + 'px'; hint.style.top = (c.y + CH + 16) + 'px'; }
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
    c.at = at; const x1 = posX(at); c.x = c.px = c.dx = x1; c.home = 'fly'; c.th = sign() * (0.08 + Math.random() * 0.12); c.w = 0; c.ps = sign() * (1.2 + Math.random() * 0.6); c.pv = 0;
    c.el.classList.add('is-open');
    const y0 = -CH - 120; c.y = y0; c.op = 0;
    const o = { t: 0 };
    gsap.to(o, { t: 1, duration: reduce ? 0 : 0.6, ease: 'power3.in', delay: reduce ? 0 : delay,
      onUpdate: () => { c.y = y0 + (cordY(x1) + 2 - y0) * o.t; c.op = Math.min(1, o.t * 2.5); },
      onComplete: () => { c.home = 'line'; c.op = 1; c.el.classList.remove('is-open'); c.w += sign() * 1.1; c.pv += sign() * 3; c.dipV += 160; kick(x1, 110); play('clipsnap'); setTimeout(() => act(c), 120); res(); } });
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
      c.w += sign() * (1.2 + Math.random()); c.pv += sign() * (7 + Math.random() * 5); c.fv += sign() * (3 + Math.random() * 3); c.pt = c.ps; c.ft = c.fx;
      c.el.style.pointerEvents = 'none'; if (document.activeElement === c.el) c.el.blur();
      kick(c.x, 70); play('whoosh', { g: 0.6, rate: 1.05 + Math.random() * 0.25 });
      res();
    }, reduce ? 0 : 110);
  }, reduce ? 0 : delay));
  const flipTo = (c, face) => new Promise((res) => { play('flip'); gsap.to(c.flip, { rotationY: face === 'front' ? 0 : 180, transformPerspective: 900, duration: reduce ? 0 : 0.62, ease: 'back.out(1.4)', onComplete: res }); c.w += 0.45; c.pv += sign() * 1.5; });
  const stamp = (c, ok, label) => {
    const s = document.createElement('span'); s.className = `sc-stamp ${ok ? 'is-ok' : 'is-x'}`; s.innerHTML = `<em>${ok ? '✓' : '✕'}</em><span></span>`; s.querySelector('span').textContent = label;
    // 기록 면은 여권처럼 도장이 쌓인다(그날 확인한 결과). 셋째부터는 작게 겹쳐 찍는다.
    c.stamps.append(s); while (c.stamps.children.length > 6) c.stamps.firstElementChild.remove();
    c.stamps.classList.toggle('is-many', c.stamps.children.length > 2);
    const rot = -18 + Math.random() * 14; gsap.set(s, { rotation: rot });
    play('stamp'); c.w += sign() * (ok ? 0.7 : 1.1); c.fv -= 2.2; kick(c.x, 40);
    if (!reduce) { gsap.fromTo(s, { scale: 1.9, opacity: 0, rotation: rot - 12 }, { scale: 1, opacity: 1, rotation: rot, duration: 0.32, ease: 'back.out(2.4)' }); gsap.fromTo(c, { s: c.s * 0.955 }, { s: c.s, duration: 0.4, ease: 'back.out(3)' }); }
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
  // voice가 거짓이면 몸짓만 한다(답을 소리로 미리 알려 주지 않을 때).
  const callBack = (c, voice = true) => new Promise((res) => {
    play('whoosh', { g: 0.7, rate: 1.2 }); c.el.classList.add('is-called');
    c.wordEl.querySelectorAll('.sc-mark').forEach((m) => m.remove()); c.el.classList.remove('is-right', 'is-wrong');
    gsap.timeline({ onComplete: res })
      .to(c, { lift: 34, duration: reduce ? 0 : 0.28, ease: 'power2.out' })
      .call(() => { flipTo(c, 'front'); })
      .to(c, { lift: 0, duration: reduce ? 0 : 0.42, ease: 'bounce.out' }, reduce ? '>' : '+=0.3')
      .call(() => { play('clipsnap', { g: 0.6 }); kick(c.x, 60); act(c, true, voice); });
  });
  const markStop = (i, ok) => { const b = stopLis[i].querySelector('b'); b.textContent = ok ? '✓' : '✕'; b.style.color = ok ? 'var(--ink)' : 'var(--stamp)'; if (!reduce) gsap.fromTo(b, { scale: 1.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' }); };
  const setClock = (k) => stopLis.forEach((li, i) => { if (!i) return; li.classList.toggle('is-now', i === k); li.classList.toggle('is-past', i < k); });
  const setFull = (on) => line.classList.toggle('is-full', on);

  /* ── 날이 바뀐다: 탁상 달력이 넘어가고, 바탕 · 날씨 · 소리가 바뀐다 ── */
  const wall = $('.sc-wall');
  wall.insertAdjacentHTML('beforeend', '<i class="sc-tint is-rain"></i><i class="sc-tint is-snow"></i>');
  const sky = document.createElement('canvas'); sky.className = 'sc-sky'; sky.setAttribute('aria-hidden', 'true'); wall.after(sky);
  const skyCtx = sky.getContext('2d');
  let skyKind = null, flakes = [], skyRaf = 0, skyLast = 0, skyW = 0, skyH = 0, ambT = 0;
  const flake = (kind, top) => (kind === 'rain'
    ? { x: Math.random() * (skyW + 200), y: top ? Math.random() * skyH : -30 - Math.random() * 200, l: 14 + Math.random() * 16, v: 900 + Math.random() * 500, a: 0.16 + Math.random() * 0.2 }
    : { x: Math.random() * skyW, y: top ? Math.random() * skyH : -10 - Math.random() * 120, r: 1.4 + Math.random() * 3.2, v: 26 + Math.random() * 46, ph: Math.random() * 6.3, sw: 10 + Math.random() * 22 });
  const sizeSky = () => {
    const dpr = Math.min(2, devicePixelRatio || 1); skyW = root.clientWidth; skyH = root.clientHeight;
    sky.width = Math.round(skyW * dpr); sky.height = Math.round(skyH * dpr); skyCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const skyTick = (now) => {
    skyRaf = 0; if (!skyKind) { skyCtx.clearRect(0, 0, skyW, skyH); return; }
    const dt = Math.min(0.04, (now - (skyLast || now)) / 1000); skyLast = now;
    skyCtx.clearRect(0, 0, skyW, skyH);
    if (skyKind === 'rain') {
      skyCtx.lineCap = 'round'; skyCtx.lineWidth = 1.2;
      for (const f of flakes) {
        f.y += f.v * dt; f.x -= f.v * 0.16 * dt; if (f.y > skyH + 30) Object.assign(f, flake('rain', false));
        skyCtx.strokeStyle = `rgba(96,114,142,${f.a})`; skyCtx.beginPath(); skyCtx.moveTo(f.x, f.y); skyCtx.lineTo(f.x + f.l * 0.16, f.y - f.l); skyCtx.stroke();
      }
    } else {
      for (const f of flakes) {
        f.y += f.v * dt; f.ph += dt * 1.3; if (f.y > skyH + 10) Object.assign(f, flake('snow', false));
        const x = f.x + Math.sin(f.ph) * f.sw;
        skyCtx.fillStyle = 'rgba(255,255,255,.95)'; skyCtx.shadowColor = 'rgba(110,130,165,.35)'; skyCtx.shadowBlur = 3;
        skyCtx.beginPath(); skyCtx.arc(x, f.y, f.r, 0, 6.283); skyCtx.fill();
      }
      skyCtx.shadowBlur = 0;
    }
    if (visible) skyRaf = requestAnimationFrame(skyTick);
  };
  // 바탕 소리는 4초짜리 판을 겹쳐 이어 튼다(녹화 도구도 같은 기록으로 섞는다)
  const setSky = (kind) => {
    clearInterval(ambT); ambT = 0;
    skyKind = reduce ? null : kind;
    if (kind) { const k = kind === 'rain' ? 'rain' : 'wind', go = () => play(k); go(); ambT = setInterval(go, 3600); }
    if (!skyKind) { gsap.to(sky, { opacity: 0, duration: 0.8 }); return; }
    sizeSky(); const n = Math.round(skyW / (kind === 'rain' ? 9 : 13)); flakes = Array.from({ length: n }, () => flake(kind, true));
    gsap.fromTo(sky, { opacity: 0 }, { opacity: 1, duration: 1.2 });
    skyLast = 0; if (!skyRaf) skyRaf = requestAnimationFrame(skyTick);
  };

  const cal = document.createElement('div'); cal.className = 'sc-cal'; cal.setAttribute('aria-hidden', 'true');
  cal.innerHTML = '<div class="sc-cal-body"><i class="sc-cal-ring"></i><i class="sc-cal-ring"></i><div class="sc-cal-stack"></div></div><span class="sc-cal-cap"></span>';
  root.append(cal);
  const calStack = $('.sc-cal-stack', cal), calCap = $('.sc-cal-cap', cal);
  const DAY0 = new Date(), WK = '일월화수목금토';
  const ICON = {
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.6"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>',
    rain: '<svg viewBox="0 0 24 24"><path d="M7 15.5a4.5 4.5 0 0 1 .4-9 5.5 5.5 0 0 1 10.3 1.7A3.7 3.7 0 0 1 17.3 15.5z"/><path d="M8.5 18.2l-1 2.6M12.5 18.2l-1 2.6M16.5 18.2l-1 2.6"/></svg>',
    snow: '<svg viewBox="0 0 24 24"><path d="M12 2.8v18.4M4 7.4l16 9.2M4 16.6l16-9.2M9.6 4.2L12 6l2.4-1.8M9.6 19.8L12 18l2.4 1.8"/></svg>',
  };
  const calPage = (n, icon) => {
    const d = new Date(DAY0); d.setDate(d.getDate() + n);
    const p = document.createElement('div'); p.className = 'sc-cal-page';
    p.innerHTML = `<span class="sc-cal-m">${d.getMonth() + 1}월</span><span class="sc-cal-d">${d.getDate()}</span><span class="sc-cal-w">${WK[d.getDay()]}요일</span><span class="sc-cal-n">${n ? `+${n}일` : '오늘'}</span>${icon ? `<span class="sc-cal-i">${ICON[icon]}</span>` : ''}`;
    return p;
  };
  // from일 → to일: 한 장씩 넘어가며 처음과 끝은 느리고 가운데는 빠르다(장마다 종이 소리)
  const flipDays = (from, to, scene, cap, icon) => new Promise((res) => {
    calStack.replaceChildren(); const pages = [];
    for (let n = to; n >= from; n--) { const p = calPage(n, n === to ? icon : null); calStack.append(p); pages.push(p); }
    calCap.textContent = cap;
    const N = to - from, T = Math.min(2.1, 0.25 + N * 0.075);
    const tl = gsap.timeline({ onComplete: () => gsap.to(cal, { opacity: 0, scale: 1.04, y: -6, duration: 0.3, delay: reduce ? 0 : 0.7, ease: 'power2.in', onComplete: res }) });
    tl.fromTo(cal, { opacity: 0, scale: 0.9, y: 12 }, { opacity: 1, scale: 1, y: 0, duration: reduce ? 0 : 0.32, ease: 'back.out(2)' });
    tl.call(() => { root.dataset.scene = scene; setSky(scene === 'rain' || scene === 'snow' ? scene : null); play('whoosh', { g: 0.8, rate: 0.9 }); }, null, 0.1);
    for (let i = 0; i < N; i++) {
      const p = pages[pages.length - 1 - i], u = N === 1 ? 0 : i / (N - 1);
      const at = reduce ? 0 : 0.42 + T * (u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2);
      tl.to(p, { rotationX: -172, opacity: 0, duration: reduce ? 0 : 0.42, ease: 'power2.in', transformOrigin: '50% 0%', transformPerspective: 700 }, at)
        .call(() => play('flip', { g: 0.5, rate: 1.3 + u * 0.5 }), null, at);
    }
    tl.call(() => { play('tick'); const last = pages[0]; if (!reduce) gsap.fromTo(last, { y: 3 }, { y: 0, duration: 0.3, ease: 'back.out(3)' }); }, null, '>-0.1');
  });

  /* ── 튜터 말풍선(앱이 먼저 꺼내는 말) ── */
  const chat = document.createElement('div'); chat.className = 'sc-chat'; chat.setAttribute('aria-live', 'polite');
  chat.innerHTML = '<span class="sc-chat-who"><i aria-hidden="true"></i>튜터</span><p class="sc-chat-msg"></p><p class="sc-chat-more"></p>';
  stage.append(chat);
  const chatMsg = $('.sc-chat-msg', chat), chatMore = $('.sc-chat-more', chat);
  const showChat = async (text, more = '') => {
    chatMsg.innerHTML = '<span class="sc-typing" aria-hidden="true"><i></i><i></i><i></i></span>'; chatMore.textContent = '';
    gsap.fromTo(chat, { opacity: 0, y: 12, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: reduce ? 0 : 0.42, ease: 'back.out(2)' });
    play('notify');
    await wait(760);
    chatMsg.textContent = text; play('pop', { g: 0.5, rate: 1.2 });
    if (!reduce) gsap.fromTo(chatMsg, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.3 });
    if (more) { await wait(500); chatMore.textContent = more; if (!reduce) gsap.fromTo(chatMore, { opacity: 0 }, { opacity: 1, duration: 0.4 }); }
  };
  const hideChat = () => gsap.to(chat, { opacity: 0, y: -6, duration: reduce ? 0 : 0.25 });

  // 돌아온 카드를 한 번 누를 때까지 기다린다(누르면 답이 아니라 확인)
  const waitTap = (c, label) => new Promise((res) => {
    c.answerable = true; c.el.removeAttribute('aria-disabled'); c.el.setAttribute('aria-label', label);
    c.el.focus({ preventScroll: true });
    answering = () => { answering = null; c.answerable = false; c.el.setAttribute('aria-disabled', 'true'); c.el.setAttribute('aria-label', c.text); res(); };
  });

  /* ── 내 위치: 카드가 줄에서 풀려 앞으로 나오고, 기록 면에 큰 도장 ── */
  const showScale = () => (narrow ? 1.6 : 1.42);
  const seal = (c, ok) => {
    const s = document.createElement('span'); s.className = `sc-seal ${ok ? 'is-ok' : 'is-x'}`;
    s.innerHTML = '<b></b><small></small>'; s.firstChild.textContent = ok ? '혼자 맞힘' : '다시 연습'; s.lastChild.textContent = ok ? '처음 보는 문제 · 도움 없이' : '1분 뒤 다시';
    $('.sc-back', c.el).append(s);
    play('stamp', { g: 1.25, rate: 0.82 }); if (ok) play('chime', { delay: 0.25 }); c.fv -= 3.2; c.pv += sign() * 2;
    if (!reduce) { gsap.fromTo(s, { scale: 2.3, opacity: 0, rotation: -32 }, { scale: 1, opacity: 1, rotation: -13, duration: 0.36, ease: 'back.out(2.2)' }); gsap.fromTo(c, { s: showScale() * 0.94 }, { s: showScale(), duration: 0.5, ease: 'back.out(3)' }); }
  };
  // 앞으로 나온 카드를 누르면 앞면(인물)과 뒷면(기록)을 오간다
  const turnShow = (c) => {
    const front = Math.abs(gsap.getProperty(c.flip, 'rotationY')) > 90;
    flipTo(c, front ? 'front' : 'back'); c.pv += sign() * 3;
    if (front) setTimeout(() => act(c, true, true), 300);
  };
  const finalButtons = () => {
    const a = document.createElement('a'); a.className = 'sc-btn'; a.href = WORLD; if (/^https?:/.test(WORLD)) { a.target = '_blank'; a.rel = 'noopener'; }
    a.innerHTML = '<span></span><span class="arr" aria-hidden="true">↗</span>'; a.firstChild.textContent = D.me.go;
    a.addEventListener('pointerdown', () => play('press'));
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sc-btn is-ghost'; b.textContent = Q.again;
    b.addEventListener('pointerdown', () => play('press'));
    let used = false; b.addEventListener('click', () => { if (used) return; used = true; restart(); });
    next.replaceChildren(a, b); play('pop', { delay: 0.05 });
    if (!reduce) gsap.fromTo([a, b], { scale: 0.7, opacity: 0, y: 8 }, { scale: 1, opacity: 1, y: 0, duration: 0.55, ease: 'back.out(2)', stagger: 0.08 });
    a.focus({ preventScroll: true });
  };

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
        picked.el.classList.add('is-right'); mark(picked.wordEl, 'under'); play('underline'); play('chime', { delay: 0.18 }); picked.w += sign() * 1.4; picked.pv += sign() * 2; act(picked, true, true);
      } else {
        picked.el.classList.add('is-wrong'); play('strike', { delay: 0.1 }); picked.w += sign() * 1.5; kick(picked.x, 50);
        if (!reduce) gsap.fromTo(picked.wordEl, { x: 0 }, { keyframes: [{ x: -7 }, { x: 6 }, { x: -4 }, { x: 3 }, { x: 0 }], duration: 0.4, ease: 'power1.inOut' });
        setTimeout(() => mark(picked.wordEl, 'strike'), 100);
        if (picked.video) { picked.video.pause(); try { picked.video.currentTime = 0; } catch { /* 아직 못 감음 */ } }
        setTimeout(() => { correct.el.classList.add('is-right'); mark(correct.wordEl, 'under'); play('underline'); correct.w += sign() * 0.9; correct.pv += sign() * 2; act(correct, true, true); }, 640);
      }
      done({ right, correct });
    };
  });
  // 답한 뒤: 배울 말만 남기고 나머지는 떨어진다 → 남은 카드가 뒤집혀 기록 면에 그날의 도장을 받는다
  const settle = async (cs, r, tag, label) => {
    await wait(r.right ? 1500 : 2300);
    cs.filter((c) => c !== r.correct).forEach((c, i) => unclip(c, i * 180));
    await wait(420); setFull(false);
    await wait(900);
    r.correct.backTag.textContent = tag;
    await flipTo(r.correct, 'back'); await wait(60);
    stamp(r.correct, r.right, label);
  };
  async function first(again = false) {
    root.dataset.scene = 'now'; setClock(0);
    stopLis.forEach((li) => { li.querySelector('b').textContent = ''; });
    showQuestion(Q.first); enterStage(); setFull(true);
    const cs = Q.first.choices.map(([id, text], i) => makeCard(id, text, i + 1));
    await Promise.all(cs.map((c, i) => dropIn(c, { kind: 'slot', i }, 0.3 + i * 0.2)));
    if (again) cs[0].el.focus({ preventScroll: true });   // 다시 할 때는 첫 카드로(처음 열릴 때는 쪽의 포커스를 뺏지 않는다)
    const r = await takeAnswer(cs, Q.first);
    await settle(cs, r, '오늘 처음 만난 말', '지금');
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
  // 돌아온 카드는 제 자리에 그대로 두고, 나머지 보기만 새로 떨어진다
  async function askAgain(c, q, tag, label) {
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
    await settle(cs, r, tag, label);
    return r;
  }
  async function second(c) {
    const r = await askAgain(c, Q.second, '1분 전에 틀린 말', '1분 뒤');
    markStop(1, r.right);
    setAfter(r.right ? Q.backRight.say : Q.backWrong.say, r.right ? Q.backRight.sub : Q.backWrong.sub);
    await wait(700);
    await travel(r.correct, { kind: 'knot', i: r.right ? 2 : 1 });
    await wait(260);
    if (r.right) button(Q.toDay1, () => toTomorrow(r.correct)); else button(Q.toMinute, () => toMinute(r.correct));
  }
  const clearStage = (h) => { qhead.textContent = h; ctxEl.textContent = ''; promptEl.textContent = ''; setAfter('', ''); next.replaceChildren(); };
  // 내일: 앱을 열면 튜터가 먼저 꺼낸다 → 카드가 돌아와 그 말을 한다 → 「내일」 도장
  async function toTomorrow(c) {
    hideHint(); hideChat(); await leaveStage(); setClock(2);
    await flipDays(0, 1, 'morning', '다음 날 아침', 'sun');
    clearStage(D.d1.head); enterStage();
    c.backTag.textContent = '어제 만난 말';
    await showChat(D.d1.chat);
    await wait(300);
    await callBack(c);
    await wait(2300);
    await flipTo(c, 'back'); await wait(60);
    stamp(c, true, '내일'); markStop(2, true); c.el.classList.remove('is-called');
    setAfter(D.d1.say, D.d1.sub);
    await wait(900);
    await travel(c, { kind: 'knot', i: 3 });
    await wait(260);
    button(D.d1.next, () => toWeek(c));
  }
  // 7일 뒤: 낱말을 가린 채 돌아온다. 인물의 몸짓만 보고 떠올린 뒤 눌러서 확인한다
  async function toWeek(c) {
    hideHint(); hideChat(); await leaveStage(); setClock(3);
    await flipDays(1, 7, 'rain', '일주일 뒤', 'rain');
    clearStage(D.d7.head); enterStage();
    c.backTag.textContent = '일주일 전에 만난 말';
    c.el.classList.add('is-quiz');
    const said = showChat(D.d7.chat, D.d7.chat2);
    await wait(300);
    await callBack(c, false);
    await said;
    await waitTap(c, '돌아온 카드: 눌러서 낱말 확인');
    c.el.classList.remove('is-quiz'); mark(c.wordEl, 'under'); play('underline'); play('chime', { delay: 0.18 });
    c.w += sign() * 1.2; c.pv += sign() * 2; act(c, true, true);
    await wait(2100);
    hideChat();
    await flipTo(c, 'back'); await wait(60);
    stamp(c, true, '7일 뒤'); markStop(3, true); c.el.classList.remove('is-called');
    setAfter(D.d7.say, D.d7.sub);
    await wait(900);
    await travel(c, { kind: 'knot', i: 4 });
    await wait(260);
    button(D.d7.next, () => toMonth(c));
  }
  // 30일 뒤: 눈 오는 겨울. 같은 인물이 겨울 옷을 입고, 처음 보는 장면으로 다시 묻는다
  async function toMonth(c) {
    hideHint(); hideChat(); await leaveStage(); setClock(4);
    await flipDays(7, 30, 'snow', '한 달 뒤', 'snow');
    winter = true; setPic(c);
    c.backTag.textContent = '한 달 전에 만난 말';
    await callBack(c, false); await wait(80);
    const q = D.d30;
    await travel(c, { kind: 'slot', i: q.choices.findIndex(([, t]) => t === c.text) });
    const r = await askAgain(c, q, '한 달 전에 만난 말', '30일 뒤');
    markStop(4, r.right);
    setAfter(r.right ? q.right.say : q.wrong.say, r.right ? q.right.sub : q.wrong.sub);
    await wait(700);
    await travel(r.correct, { kind: 'knot', i: 4 });
    await wait(260);
    button(q.next, () => toMe(r.correct, r.right));
  }
  // 내 위치: 집게에서 풀린 카드가 앞으로 나와 기록 면을 보이고, 큰 도장을 받는다
  async function toMe(c, right) {
    hideHint(); await leaveStage(); setClock(5); endTag.classList.add('is-now'); root.classList.add('is-me'); c.el.classList.remove('is-right', 'is-called');
    clearStage(D.me.head);
    c.backTag.textContent = '30일 기록';
    c.el.classList.add('is-open'); play('clipopen');
    await wait(160);
    leavePin(c); c.el.classList.remove('is-open');
    c.home = 'show'; c.grab = true; c.answerable = false; c.pt = 0; c.ft = 0; c.el.style.zIndex = '5';
    c.el.removeAttribute('aria-disabled'); c.el.setAttribute('aria-label', '내 기록 카드 — 눌러서 앞면과 기록 면을 오갑니다');
    play('whoosh', { g: 0.9, rate: 0.85 }); c.pv += 10;
    c.moving = true;
    await new Promise((res) => gsap.to(c, { x: W / 2, y: narrow ? 18 : 6, s: showScale(), th: 0, duration: reduce ? 0 : 1.0, ease: 'power3.inOut', onComplete: res }));
    c.moving = false; play('clipsnap', { g: 0.45, rate: 0.8 });
    await wait(260);
    seal(c, right);
    await wait(520);
    enterStage(); setAfter(D.me.say, D.me.sub);
    await wait(300);
    finalButtons();
  }
  async function restart() {
    hideHint(); hideChat(); await leaveStage();
    [...cards].forEach((c, i) => unclip(c, i * 140));
    setSky(null); winter = false; endTag.classList.remove('is-now'); root.classList.remove('is-me');
    await wait(700);
    first(true);
  }

  /* ── 시작 ── */
  // 소리는 쪽이 열릴 때 미리 받아 둔다(재생은 처음 누르는 순간부터 — 브라우저 규칙). 그래야 첫 누름 · 첫 연필 소리가 빠지지 않는다.
  loadAudio();
  layout(); new ResizeObserver(layout).observe(root);
  narrowMQ.addEventListener('change', layout);
  requestAnimationFrame(tick);
  first();
})();
