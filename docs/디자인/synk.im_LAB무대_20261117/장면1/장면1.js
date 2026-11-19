// LAB 「직접 풀어 보기」 — 줄에 매단 3D 낱말 배지(2026-11-18, 셋째 판 · 저녁에 나머지 장면을 더함).
// 30일은 줄 하나다. 보기 세 낱말이 「지금」 자리에 은색 집게로 물린 배지다. 배지 앞면 창에서는 그 말을 하는 인물이 움직인다(옴니 1.2로 구운 짧은 영상).
// 카드를 누르면 답이 되고, 잡아 끌면 흔들린다. 손을 올리면 그쪽으로 돌아보며 빛이 미끄러지고, 창 속 인물이 그 말을 몸으로 한다.
// 답하면 틀린 보기는 집게가 열리며 공중에서 돌며 떨어지고, 남은 배지(배울 말)는 뒤집혀 무지갯빛 기록 면에 도장을 받은 뒤 줄을 따라 다음에 돌아올 날로 간다.
// 흐름: 첫 문제 → (틀리면 1분 뒤 둘째 문제) → 내일(튜터 카드) → 7일 뒤(다시 확인할 때) → 30일 뒤(겨울, 같은 항목의 처음 보는 문제) → 내 위치(기록 면과 큰 도장).
// 날마다 SYNK WORLD 실제 화면 조각을 띄우고, 문제는 모두 앱의 실제 문항이다(유호님 11-18 「실제 앱에 맞춤」).
// 날이 바뀔 때는 탁상 달력이 넘어가고, 아침 · 비 · 눈으로 바탕과 소리가 바뀐다. 글은 공개본 원고(../원고.json)를 따른다.
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
  const specQ = $('.sc-spec-q'), dayN = $('.sc-day-n'), dayU = $('.sc-day-u'), dock = $('.sc-dock'), dockStack = $('.sc-dock-stack');
  const say = $('.sc-say'), sub = $('.sc-sub'), next = $('.sc-next');
  const line = $('.sc-line'), layer = $('.sc-cards'), cordPath = $('.sc-cord-path'), cordShadow = $('.sc-cord-shadow'), stopsEl = $('.sc-stops'), hint = $('.sc-hint');
  const ff = $('.sc-ff'), ffNum = $('.sc-ff-num'), ffCap = $('.sc-ff-cap');
  const soundBtn = $('.sc-sound');
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? Math.min(ms, 60) : ms));
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));   // 두 장 뒤 — 자리가 바뀐 카드가 그려진 다음

  /* ── 원고(공개본 그대로) ── */
  const Q = {
    first: { head: '처음 만난 날 · 표현 익히기', say: '일부러 틀려 봐도 좋습니다', sub: '틀린 말과 맞힌 말이 각각 언제, 어떻게 돌아오는지 30일을 이어서 보여 드립니다.', context: '교실에 들어가 선생님을 처음 만났어요.', prompt: '처음 만난 선생님에게 어떤 인사를 할까요?', answer: 'a', choices: [['a', '안녕하세요.'], ['b', '감사합니다.'], ['c', '다녀왔어요.']] },
    second: { head: '1분 뒤 · 같은 말, 다른 장면', say: '어? 전에 만난 말인데\n장면이 달라!', sub: '답의 자리만 외우지 않게, 장면을 바꿔 묻습니다.', context: '학교 사무실에 처음 가서 직원을 만났어요.', prompt: '처음 만난 직원에게 어떤 인사를 할까요?', answer: 'b', choices: [['a', '다녀왔어요.'], ['b', '안녕하세요.'], ['c', '감사합니다.']] },
    right: { say: '맞았습니다', sub: '이 말은 내일 다른 장면으로 다시 옵니다.' },
    wrong: { say: '이 말은 1분 뒤에 돌아옵니다', sub: '같은 문제가 아니라 다른 장면으로 옵니다. 틀린 답도 첫 기록이 되어 1 · 7 · 30일 뒤 다시 확인합니다.' },
    backRight: { say: '다시 만나 맞혔습니다', sub: '이제 내일 또 옵니다. 맞힐수록 간격이 1 · 3 · 7 · 14 · 30일로 벌어집니다.' },
    backWrong: { say: '또 1분 뒤에 돌아옵니다', sub: '맞힐 때까지 간격이 벌어지지 않습니다.' },
    toMinute: '1분 뒤로', toDay1: '내일로', again: '처음부터 다시',
  };
  // 날마다(원고 days). 화면 조각(shot)은 SYNK WORLD 실제 화면이고, 30일 문제는 앱의 첫 레슨 둘째 문제 그대로다 —
  // 앱의 1 · 7 · 30일 확인은 같은 항목(낱말 뜻 읽기)의 다른 표현으로 처음 보는 문제를 낸다(life-items.mjs · life-followups.mjs).
  // 돌아온 카드(기록)는 30일 매듭에 걸린 채 그 답으로 30일 칸을 채운다.
  const D = {
    d1: { head: '내일 아침 · 앱을 열면', shot: 'piece-tutor-review', say: '앱을 열면 튜터가 먼저 꺼냅니다', sub: '복습 시간표를 따로 열지 않습니다. 돌아올 말이 없는 날에는 다른 연습을 권합니다.', next: '7일 뒤로' },
    d7: { head: '7일 뒤 · 다시 확인할 때', shot: 'piece-check-d7', say: '맞혔다고 끝이 아닙니다', sub: '일주일 뒤, 다시 확인할 때입니다. 레슨이나 복습을 이어 가면 처음 보는 문제로 확인합니다.', next: '30일 뒤로' },
    d30: { head: '30일 뒤 · 처음 보는 문제', shot: 'piece-check-d30', say: '한 달 뒤, 처음 보는 문제', sub: '레슨을 이어 가면 같은 항목의 다른 문제가 나옵니다. 외웠는지가 아니라 아는지를 봅니다.', context: '친구가 떨어진 책을 주워 줬어요.', prompt: '도움을 받았어요. 어떤 말을 할까요?', answer: 'c', choices: [['a', '저는 수진이에요.'], ['b', '안녕하세요.'], ['c', '감사합니다.']],
      right: { say: '한 달 뒤에도 혼자 맞혔습니다', sub: '이 답이 30일 칸을 채웁니다. 하루 · 일주일 · 한 달 뒤 확인이 모두 끝났습니다.' }, wrong: { say: '이 칸은 「다시 연습」으로 남습니다', sub: '틀린 답도 그대로 남고, 이 말은 1분 뒤 다른 장면으로 돌아옵니다.' }, next: '내 위치 보기' },
    me: { head: '내 위치', shot: 'piece-evidence', say: '점수 말고 근거로 봅니다', sub: '게임 · 생활 레슨 · 짧은 진단의 답이 한 기록에 모입니다. 내 위치는 처음 보는 문제를 도움 없이 푼 답으로만 정합니다.', go: 'SYNK WORLD 열기', note: ['한글을 아직 못 읽으면 한글 자모부터 배웁니다.', '가입 없이 둘러볼 수 있고, 화면은 한국어 · 영어 · 몽골어로 볼 수 있습니다.'] },
    real: 'SYNK WORLD 실제 화면',
  };
  const WORLD = /(^|\.)synk\.im$/.test(location.hostname) ? '/world/' : 'https://synk.im/world/';

  // 낱말마다 창 속 장면(옴니 1.2로 구운 5초 영상과 첫 장 그림). 영상이 없으면 그림만 둔다. 30일 뒤에는 같은 인물이 겨울 옷을 입은 판을 쓴다.
  const PIC = { '안녕하세요.': { k: 'hello', v: 'hello', tone: '#ADD9F5', say: 0.7 }, '감사합니다.': { k: 'thanks', v: 'thanks', tone: '#F9C7B4', say: 0.8 }, '다녀왔어요.': { k: 'home', v: 'home', tone: '#BCE4D1', say: 0.25 } };
  const PICW = { '안녕하세요.': { k: 'hello-w', v: 'hello', tone: '#CFE6F5', say: 0.7 }, '감사합니다.': { k: 'thanks-w', v: 'thanks', tone: '#F5D3D3', say: 0.8 }, '다녀왔어요.': { k: 'home-w', v: 'home', tone: '#D3EBDD', say: 0.25 }, '저는 수진이에요.': { k: 'name-w', v: 'name', tone: '#E4DDF4', say: 0.6 } };
  PIC['저는 수진이에요.'] = PICW['저는 수진이에요.'];   // 이 보기는 30일 뒤(겨울)에만 나온다
  const shotSrc = (n) => (window.__CARDDATA && window.__CARDDATA[`shot/${n}.webp`]) || `shot/${n}.webp`;
  let winter = false;
  const VIDEO = window.__SCVIDEO !== false;
  const cardSrc = (k, ext) => (window.__CARDDATA && window.__CARDDATA[`${k}.${ext}`]) || `card/${k}.${ext}`;

  /* ── 힌트 언어(11-19): 질문 목소리 · 번역한 질문 · 보기 뜻 · 읽는 법을 고른 말로 돕는다. 쪽 언어가 기본이고, 고른 것은 이 기기에 남긴다.
       글은 앱 원천(life-content-lang.mjs의 상황 글 · 발문 · 보기 뜻) 그대로, 읽는 법은 LAB 발음 줄(tools/lib/한글표기.js latin · mn) ── */
  const HL = {
    base: 'ko', label: '힌트 언어', langs: [['ko', '한국어'], ['en', 'English'], ['mn', 'Монгол']],
    q: {
      first: { en: 'You walk into the classroom and meet the teacher for the first time. How do you greet a teacher you’re meeting for the first time?', mn: 'Та анги руу орж, багштайгаа анх удаа уулзлаа. Анх уулзаж буй багштайгаа хэрхэн мэндлэх вэ?' },
      second: { en: 'You go to the school office for the first time and meet a staff member. How do you greet a staff member you’re meeting for the first time?', mn: 'Та сургуулийн захиргаанд анх удаа очиж, тэндхийн нэг ажилтантай уулзлаа. Анх уулзаж буй ажилтантай хэрхэн мэндлэх вэ?' },
      d30: { en: 'A friend picked up the book you dropped. Someone helped you. What do you say?', mn: 'Найз тань таны унагаасан номыг түүж өглөө. Та тусламж авлаа. Юу гэж хэлэх вэ?' },
    },
    mean: {
      en: { '안녕하세요.': 'Hello', '감사합니다.': 'Thank you', '다녀왔어요.': 'I’m back', '저는 수진이에요.': 'I’m Sujin', '저는 몽글이에요.': 'I’m Mongle' },
      mn: { '안녕하세요.': 'Сайн байна уу?', '감사합니다.': 'Баярлалаа', '다녀왔어요.': 'Ирлээ', '저는 수진이에요.': 'Би Сүжин', '저는 몽글이에요.': 'Би Монгль' },
    },
    pron: {
      en: { '안녕하세요.': 'an-nyeong-ha-se-yo', '감사합니다.': 'gam-sa-ham-ni-da', '다녀왔어요.': 'da-nyeo-wa-sseo-yo', '저는 수진이에요.': 'jeo-neun su-ji-ni-e-yo', '저는 몽글이에요.': 'jeo-neun mong-geu-ri-e-yo' },
      mn: { '안녕하세요.': 'аннёнхасэё', '감사합니다.': 'гамсахамнида', '다녀왔어요.': 'данёвассөё', '저는 수진이에요.': 'жөнын сүжини-эё', '저는 몽글이에요.': 'жөнын монгыри-эё' },
    },
  };
  let hl = HL.base;
  try { const s = new URLSearchParams(location.search).get('hl') || localStorage.getItem('synk-lab-hl'); if (HL.langs.some(([c]) => c === s)) hl = s; } catch { /* 기억 못 하면 쪽 언어 */ }
  const meanOf = (t) => (HL.mean[hl] || {})[t] || '';
  const pronOf = (t) => (HL.pron[hl] || {})[t] || '';

  /* ── 소리: 동작마다 다른 효과음(Web Audio). 쪽이 열릴 때 받아 두고, 처음 누르는 순간부터 난다. ── */
  const SND = {
    hover: { f: 'sound/hover.mp3', g: 0.28, vary: 0.12 }, press: { f: 'sound/press.mp3', g: 0.7, vary: 0.06 },
    strike: { f: 'sound/strike.mp3', g: 0.7 }, underline: { f: 'sound/underline.mp3', g: 0.62 }, stamp: { f: 'sound/stamp.mp3', g: 0.95 },
    flip: { f: 'sound/flip.mp3', g: 0.62, vary: 0.08 }, clipopen: { f: 'sound/clipopen.mp3', g: 0.7, vary: 0.08 }, clipsnap: { f: 'sound/clipsnap.mp3', g: 0.9, vary: 0.08 },
    slide: { f: 'sound/slide.mp3', g: 0.3 }, tick: { f: 'sound/tick.mp3', g: 0.6 }, whoosh: { f: 'sound/whoosh.mp3', g: 0.26, vary: 0.1 }, pop: { f: 'sound/pop.mp3', g: 0.5 },
    chime: { f: 'sound/chime.wav', g: 0.5 }, notify: { f: 'sound/notify.wav', g: 0.4 },
    vhello: { f: 'sound/v-hello.mp3', g: 0.85 }, vthanks: { f: 'sound/v-thanks.mp3', g: 0.85 }, vhome: { f: 'sound/v-home.mp3', g: 0.85 }, vname: { f: 'sound/v-name.mp3', g: 0.85 },
    rain: { f: 'sound/rain.mp3', g: 0.3 }, wind: { f: 'sound/wind.mp3', g: 0.34 },
  };
  // 묻는 말 목소리는 힌트 언어마다 따로 받는다(고른 언어만 미리)
  const QV = (key, l) => { const k = `q-${key}-${l}`; if (!SND[k]) SND[k] = { f: 'sound/q-' + key + '-' + l + '.mp3', g: 0.95 }; return k; };
  ['first', 'second', 'd30'].forEach((key) => QV(key, hl));
  const AC = window.AudioContext || window.webkitAudioContext;
  let ac = null, master = null, soundOn = true;
  const bufs = {};
  window.__snd = [];
  try { soundOn = localStorage.getItem('synk-lab-sound') !== 'off'; } catch { /* 기억 못 해도 켠다 */ }
  const asked = {};
  const fetchSnd = (k) => { if (!ac || bufs[k] || asked[k] || !SND[k]) return; asked[k] = true; fetch(SND[k].f).then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b)).then((d) => { bufs[k] = d; }).catch(() => { delete asked[k]; }); };
  const loadAudio = () => {
    if (ac || !AC) return;
    ac = new AC(); master = ac.createGain(); master.gain.value = soundOn ? 1 : 0; const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; master.connect(comp).connect(ac.destination);
    for (const k of Object.keys(SND)) fetchSnd(k);
  };
  const play = (k, { g = 1, rate = 1, delay = 0 } = {}) => {
    if (!soundOn) return;
    const s = SND[k], r = rate * (1 + (Math.random() - 0.5) * (s.vary || 0));
    window.__snd.push({ t: Date.now() + delay * 1000, k, g: s.g * g, r });
    if (!ac || !bufs[k]) return;
    const src = ac.createBufferSource(); src.buffer = bufs[k]; src.playbackRate.value = r;
    const gn = ac.createGain(); gn.gain.value = s.g * g; src.connect(gn).connect(master); src.start(ac.currentTime + delay);
  };
  const paintSound = () => { if (master) master.gain.value = soundOn ? 1 : 0; soundBtn.setAttribute('aria-pressed', String(soundOn)); soundBtn.querySelector('span').textContent = soundOn ? '소리 켬' : '소리 꺼짐'; };
  root.addEventListener('pointerdown', () => { loadAudio(); ac?.resume(); }, { capture: true });
  const keyWake = (e) => { if (e.key === 'Enter' || e.key === ' ' || /^[1-3]$/.test(e.key)) { loadAudio(); ac?.resume(); } };   // 키보드만 쓰는 사람도 소리가 나게
  root.addEventListener('keydown', keyWake, { capture: true });
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn; try { localStorage.setItem('synk-lab-sound', soundOn ? 'on' : 'off'); } catch { /* 이번만 */ }
    paintSound(); if (soundOn) { loadAudio(); ac?.resume(); play('pop'); } else stopReading();
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

  let W = 0, CY = 96, SAG = 16, CW = 232, CH = 150, HW = 30, HH = 24, narrow = false, placeHl = null;
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
    placeHl?.();
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
      + '<div class="sc-face sc-front"><div class="sc-pic"><span class="sc-cap" aria-hidden="true"></span></div><div class="sc-meta"><span class="sc-num" aria-hidden="true"></span><span class="sc-wordbox"><span class="sc-word"></span><span class="sc-mean"></span></span></div><i class="sc-gloss"></i></div>'
      + '<div class="sc-face sc-back" aria-hidden="true"><span class="sc-back-tag"></span><span class="sc-back-word"></span><i class="sc-back-rule"></i><span class="sc-stamps"></span><i class="sc-gloss"></i></div>'
      + '<i class="sc-side is-l"></i><i class="sc-side is-r"></i><i class="sc-side is-t"></i><i class="sc-side is-b"></i></div>'
      + '<span class="sc-pin" aria-hidden="true"><i class="sc-pin-b"></i><i class="sc-pin-a"></i></span></div></div>';
    const sh = document.createElement('div'); sh.className = 'sc-shadow'; sh.setAttribute('aria-hidden', 'true');
    layer.insertBefore(sh, probe); layer.insertBefore(el, probe);
    const c = { el, sh, box: $('.sc-box', el), flip: $('.sc-flip', el), pic: $('.sc-pic', el), cap: $('.sc-cap', el), wordEl: $('.sc-word', el), meanEl: $('.sc-mean', el), numEl: $('.sc-num', el), backTag: $('.sc-back-tag', el), backWord: $('.sc-back-word', el), stamps: $('.sc-stamps', el), pin: $('.sc-pin', el),
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
    c.pic.replaceChildren(img, c.cap); c.video = null;
    if (!VIDEO || (window.__CARDDATA && !window.__CARDDATA[m.k + '.mp4'])) return;   // 한 파일로 묶은 쪽에 영상이 없으면 그림만
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.poster = cardSrc(m.k, 'jpg');
    v.addEventListener('loadeddata', () => { c.pic.insertBefore(v, c.cap); c.video = v; }, { once: true });
    v.src = cardSrc(m.k, 'mp4');
  }
  // 창 속 인물이 그 말을 몸으로 한다(처음부터 한 번). 이미 하고 있으면 그대로 둔다.
  // voice가 참이면 그 말을 소리로도 한다(처음 떨어질 때는 셋이 겹치므로 몸짓만).
  const sayCap = (c, delay) => {
    const t = pronOf(c.text); if (!t || !c.cap) return;
    c.cap.textContent = t; c.cap.lang = hl; gsap.killTweensOf(c.cap);
    gsap.timeline({ delay }).fromTo(c.cap, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: reduce ? 0 : 0.2 }).to(c.cap, { opacity: 0, duration: reduce ? 0 : 0.35, delay: 1.7 });
  };
  const act = (c, again = false, voice = false) => {
    const m = c.pm, v = c.video, busy = v && !v.paused && !v.ended;
    if (busy && !again) return;
    if (voice && m) { play('v' + m.v, { delay: v && !reduce ? m.say : 0 }); sayCap(c, v && !reduce ? m.say : 0); }
    if (!v || reduce) return;
    try { v.currentTime = 0; } catch { /* 아직 못 감음 */ } v.play().catch(() => {});
  };
  const paintMean = (c) => { const m = meanOf(c.text); c.meanEl.textContent = m; c.meanEl.lang = hl; c.el.classList.toggle('has-mean', !!m); c.el.classList.toggle('is-longmean', [...m].length > 10); if (c.num && c.home !== 'show') c.el.setAttribute('aria-label', cardLabel(c)); };
  const cardLabel = (c) => { const m = meanOf(c.text); return `${c.num}번 ${c.text}${m ? ` (${m})` : ''}`; };   // 화면에 보이는 뜻을 스크린 리더에도
  function setFace(c, id, text, num) {
    c.id = id; c.text = text; c.num = num; c.wordEl.textContent = text; c.backWord.textContent = text; c.numEl.textContent = String(num); setPic(c);
    paintMean(c);   // 힌트 언어가 쪽 언어가 아니거나 영어 판이면 한글 보기 밑에 뜻
    c.el.classList.toggle('is-long', [...text].length > 7);   // 긴 보기(「저는 몽글이에요.」)는 카드 모서리 점과 부딪히지 않게 조금 작게
    c.el.setAttribute('aria-label', cardLabel(c)); c.el.classList.remove('is-right', 'is-wrong');
  }
  const removeCard = (c) => { cards.delete(c); c.el.remove(); c.sh.remove(); };

  /* ── 움직임: 카드마다 진자, 줄은 용수철 ── */
  let last = performance.now(), visible = true, ticking = false;
  const startTick = () => { if (ticking) return; ticking = true; last = performance.now(); requestAnimationFrame(tick); };   // 고리는 하나만
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
      if (c.home === 'fall' && reduce) { removeCard(c); continue; }   // 움직임 줄이기면 떨어뜨리지 않고 바로 뺀다
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
        } else { c.ps = c.pv = c.fx = c.fv = 0; }   // 움직임 줄이기면 걸 때 준 비틀림이 풀리지 않아 카드가 옆면으로 남았다(11-19 공개 전 검수)
        // 집게가 옮겨 가는 속도가 바뀌면(가속 · 감속) 카드 아래쪽이 뒤로 처졌다가 흔들린다. 시계 방향이 + 이므로 Δω = +Δv / L · cosθ
        const vNew = dt > 0 ? (c.x - c.px) / dt : c.vx, dv = vNew - c.vx; c.vx = vNew; c.px = c.x;
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
    if (visible) requestAnimationFrame(tick); else ticking = false;
  };
  new IntersectionObserver((es) => { const v = es[0].isIntersecting; if (v && !visible) { visible = true; startTick(); if (skyKind && !skyRaf) { skyLast = 0; skyRaf = requestAnimationFrame(skyTick); } } visible = v; }, { rootMargin: '200px 0px' }).observe(root);

  /* ── 손: 지나가면 살짝 밀리고, 짧게 누르면 답, 잡아 끌면 따라 흔들린다 ── */
  let answering = null, hinted = false;
  const backSide = (c) => Math.abs(gsap.getProperty(c.flip, 'rotationY')) > 90;   // 기록 면이 보이는 카드
  function bindCard(c) {
    const el = c.el; let down = null, dragged = false, suppress = 0;
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && c.home === 'line' && !c.moving && !down) { c.hover = true; play('hover'); c.w -= clamp(e.movementX * 0.02, -0.5, 0.5) || 0.25; if (!backSide(c)) act(c, false, true); } });
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
      const ddx = e.clientX - down.x, ddy = e.clientY - down.y;
      if (!dragged && Math.hypot(ddx, ddy) > 7 && (!down.touch || Math.abs(ddx) > Math.abs(ddy))) { dragged = true; c.grab = true; el.classList.add('is-grab'); el.classList.remove('is-down'); hideHint(); }   // 터치는 가로로 끌 때만 흔든다
      if (!dragged) return;
      const R = layer.getBoundingClientRect(), px = e.clientX - R.left, py = e.clientY - R.top;
      const target = clamp(Math.atan2(c.x - px, Math.max(30, py - c.y)), -0.7, 0.7);
      const prev = c.th; c.th += (target - c.th) * 0.4; c.w = (c.th - prev) * 60;
    });
    el.addEventListener('pointerdown', (e) => {
      stopHand();
      if (c.home === 'show' && !c.moving) { if (e.pointerType !== 'touch') { el.classList.add('is-down'); play('press'); setTimeout(() => el.classList.remove('is-down'), 120); } return; }
      if (c.moving || c.home !== 'line') return;
      down = { x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' }; dragged = false;
      if (!down.touch) { el.classList.add('is-down'); play('press'); }   // 터치는 쪽을 쓸어 내리는 중일 수 있어 뗄 때 정한다
      try { el.setPointerCapture(e.pointerId); } catch { /* 이미 놓음 */ }
    });
    const up = () => {
      if (!down) return; down = null; el.classList.remove('is-down');
      if (dragged) { c.grab = false; el.classList.remove('is-grab'); if (Math.abs(c.w) > 3) play('whoosh', { g: 0.5, rate: 1.3 }); suppress = performance.now(); }
    };
    el.addEventListener('pointerup', () => { const tap = down?.touch && !dragged; up(); if (tap) { el.classList.add('is-down'); play('press'); setTimeout(() => el.classList.remove('is-down'), 120); } });
    el.addEventListener('pointercancel', up);
    el.addEventListener('click', () => {
      if (performance.now() - suppress < 400) return;
      if (c.answerable && answering) answering(c);
      else if (c.home === 'line' && !c.moving) { c.w += sign() * 1.4; c.pv += sign() * 4; play('hover', { g: 1.6 }); if (!backSide(c)) act(c, true, true); }
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
    keyWake(e);
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
  function hideHint() { gsap.to(hint, { opacity: 0, duration: 0.3 }); if (!qtrOn) untip(); stopHand(); }

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
  // ok: true(맞음) · false(틀림) · 'wait'(확인할 때가 됐다 — 앱의 「지금 확인」. 뒤에 확인되면 confirmStamp로 ✓)
  const stamp = (c, ok, label) => {
    const wait = ok === 'wait';
    const s = document.createElement('span'); s.className = `sc-stamp ${wait ? 'is-wait' : ok ? 'is-ok' : 'is-x'}`; s.dataset.label = label; s.innerHTML = `<em>${wait ? '?' : ok ? '✓' : '✕'}</em><span></span>`; s.querySelector('span').textContent = label;
    // 기록 면은 여권처럼 도장이 쌓인다(그날 확인한 결과). 셋째부터는 작게 겹쳐 찍는다.
    c.stamps.append(s); while (c.stamps.children.length > 6) c.stamps.firstElementChild.remove();
    c.stamps.classList.toggle('is-many', c.stamps.children.length > 2);
    const rot = -18 + Math.random() * 14; gsap.set(s, { rotation: rot });
    play('stamp'); c.w += sign() * (ok ? 0.7 : 1.1); c.fv -= 2.2; kick(c.x, 40);
    if (!reduce) { gsap.fromTo(s, { scale: 1.9, opacity: 0, rotation: rot - 12 }, { scale: 1, opacity: 1, rotation: rot, duration: 0.32, ease: 'back.out(2.4)' }); gsap.fromTo(c, { s: c.s * 0.955 }, { s: c.s, duration: 0.4, ease: 'back.out(3)' }); }
  };
  // 확인 중이던 칸이 그 사이 레슨에서 확인됐다: 물음표 도장 위에 ✓를 다시 찍는다
  const confirmStamp = (c, label) => {
    const s = [...c.stamps.children].find((x) => x.dataset.label === label && x.classList.contains('is-wait')); if (!s) return;
    s.classList.remove('is-wait'); s.classList.add('is-ok'); s.querySelector('em').textContent = '✓';
    play('stamp', { g: 0.8, rate: 1.1 }); c.fv -= 1.6; kick(c.x, 30);
    if (!reduce) gsap.fromTo(s, { scale: 1.5 }, { scale: 1, duration: 0.3, ease: 'back.out(2.4)' });
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
      .to(c, { lift: 0, duration: reduce ? 0 : 0.14, ease: 'power2.in' }, reduce ? '>' : '>-0.06');   // 움직임 줄이기면 길이 0 타임라인에 음수 자리가 생겨 끝 신호가 오지 않았다(11-19 공개 전 점검)
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
  // 머리: 지금 보는 날(숫자가 감긴다) · 장면 번호 · 탁상 달력 꽂이(머리 시안 C)
  let sceneNo = 0;
  const DAYS = [['첫날', ''], ['1', '분 뒤'], ['1', '일 뒤'], ['7', '일 뒤'], ['30', '일 뒤'], ['30', '일 뒤']];
  const DOCK = [[0, null], [0, null], [1, 'sun'], [7, 'rain'], [30, 'snow'], [30, 'snow']];
  const headDay = (k) => {
    sceneNo = k; root.dataset.day = String(k);
    const [n, u] = DAYS[k], num = Number(n);
    if (dayN) {   // 사양서 띠(data-head b)의 날 숫자 — 쪽에 그 칸이 있을 때만
      const was = Number(dayN.textContent); dayU.textContent = u;
      if (!reduce && Number.isFinite(num) && Number.isFinite(was) && num !== was) { const o = { v: was }; gsap.to(o, { v: num, duration: 0.9, ease: 'power3.out', onUpdate: () => { dayN.textContent = String(Math.round(o.v)); } }); }
      else dayN.textContent = n;
    }
    if (k <= 1 || k === 5) dockStack.replaceChildren(calPage(...DOCK[k]));
  };
  const setClock = (k) => { headDay(k); stopLis.forEach((li, i) => { if (!i) return; li.classList.toggle('is-now', i === k); li.classList.toggle('is-past', i < k); }); };
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
    if (kind) { const k = kind === 'rain' ? 'rain' : 'wind', go = () => { if (visible && !document.hidden) play(k); }; go(); ambT = setInterval(go, 3600); }
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
    const fade = () => gsap.to(cal, { opacity: 0, scale: 1.04, y: -6, duration: 0.3, delay: reduce ? 0 : 0.7, ease: 'power2.in', onComplete: res });
    const tl = gsap.timeline({ onComplete: () => { if (root.dataset.head === 'c' && !reduce) landOnDock(to, icon).then(res); else { dockStack.replaceChildren(calPage(to, icon)); fade(); } } });
    tl.fromTo(cal, { opacity: 0, scale: 0.9, y: 12 }, { opacity: 1, scale: 1, y: 0, duration: reduce ? 0 : 0.32, ease: 'back.out(2)' });
    tl.call(() => { root.dataset.stageScene = scene; setSky(scene === 'rain' || scene === 'snow' ? scene : null); play('whoosh', { g: 0.8, rate: 0.9 }); }, null, 0.1);
    for (let i = 0; i < N; i++) {
      const p = pages[pages.length - 1 - i], u = N === 1 ? 0 : i / (N - 1);
      const at = reduce ? 0 : 0.42 + T * (u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2);
      tl.to(p, { rotationX: -172, opacity: 0, duration: reduce ? 0 : 0.42, ease: 'power2.in', transformOrigin: '50% 0%', transformPerspective: 700 }, at)
        .call(() => { if (!reduce || i === 0) play('flip', { g: 0.5, rate: 1.3 + u * 0.5 }); }, null, at);   // 움직임 줄이기면 모든 장이 0초에 넘어가 소리가 한꺼번에 겹친다 — 한 번만
    }
    tl.call(() => { play('tick'); const last = pages[0]; if (!reduce) gsap.fromTo(last, { y: 3 }, { y: 0, duration: 0.3, ease: 'back.out(3)' }); }, null, reduce ? '>' : '>-0.1');
  });

  // 머리 시안 C: 넘긴 달력이 작아지며 문제 글 옆 꽂이에 앉는다
  const landOnDock = (to, icon) => new Promise((res) => {
    const body = $('.sc-cal-body', cal), a = body.getBoundingClientRect(), b = dock.getBoundingClientRect();
    const sx = b.width / a.width, dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    gsap.to(calCap, { opacity: 0, duration: 0.2, delay: 0.45 });
    gsap.to(body, { x: dx, y: dy, scale: sx, rotation: -4, duration: 0.62, delay: 0.45, ease: 'power3.inOut', onComplete: () => {
      dockStack.replaceChildren(calPage(to, icon)); play('clipsnap', { g: 0.5 });
      gsap.set(cal, { opacity: 0 }); gsap.set(body, { clearProps: 'transform' }); gsap.set(calCap, { opacity: 1 });
      gsap.fromTo(dock, { y: -4 }, { y: 0, duration: 0.4, ease: 'back.out(3)' }); res();
    } });
  });

  /* ── SYNK WORLD 실제 화면 조각: 그날 앱이 보이는 화면을 문제 자리에 띄운다(지어낸 말풍선 대신) ── */
  const ALT = {
    'piece-tutor-review': 'SYNK WORLD 튜터 카드: 복습할 시간이 된 내용이 있어요. 짧게 다시 만나 봐요.',
    'piece-check-d7': 'SYNK WORLD 다시 확인 표: 낱말 뜻 읽기 — 1일 뒤 혼자 맞힘, 7일 뒤 지금 확인.',
    'piece-check-d30': 'SYNK WORLD 다시 확인 표: 낱말 뜻 읽기 — 1일 뒤 혼자 맞힘, 7일 뒤 혼자 맞힘, 30일 뒤 지금 확인.',
    'piece-evidence': 'SYNK WORLD 내 위치: 이렇게 본 근거 — 혼자 맞힌 답들.',
  };
  const mkShot = (cls) => { const f = document.createElement('figure'); f.className = cls; f.innerHTML = '<img alt="" decoding="async"><figcaption></figcaption>'; f.lastChild.textContent = D.real; return f; };
  const shot = mkShot('sc-shot'); stage.append(shot);
  const evid = mkShot('sc-shot sc-evid'); line.append(evid);
  const showShot = async (f, name) => {
    const img = $('img', f); img.src = shotSrc(name); img.alt = ALT[name] || '';
    // 그날 앱 화면 조각은 비어 있는 「지금」 칸(줄 아래 왼쪽)에 놓는다 — 줄 · 돌아온 카드와 겹치지 않게. 휴대폰은 문제 자리 그대로.
    if (f === shot && root.dataset.head) {
      const r = stage.getBoundingClientRect();
      if (!narrow) {
        const lr = layer.getBoundingClientRect(), x0 = slotX[0] - CW / 2, x1 = slotX[2] + CW / 2, w = Math.min(420, x1 - x0);
        f.style.left = Math.round(x0 + (x1 - x0 - w) / 2) + 'px'; f.style.right = 'auto'; f.style.margin = '0'; f.style.width = Math.round(w) + 'px';
        f.style.top = Math.round(lr.top - r.top + cordY(slotX[1]) + 48) + 'px';
      } else { f.style.left = f.style.right = f.style.margin = f.style.width = ''; const qr = qhead.getBoundingClientRect(); if (qr.height) f.style.top = Math.round(qr.bottom - r.top + 12) + 'px'; }
    }
    try { await img.decode(); } catch { /* 그대로 띄운다 */ }
    play('notify'); if (f === shot) root.classList.add('has-shot');
    gsap.fromTo(f, { opacity: 0, y: 14, rotationX: -16, scale: 0.94 }, { opacity: 1, y: 0, rotationX: 0, scale: 1, duration: reduce ? 0 : 0.55, ease: 'back.out(1.8)', transformPerspective: 800 });
  };
  const hideShot = (f = shot) => { if (f === shot) root.classList.remove('has-shot'); return gsap.to(f, { opacity: 0, y: -6, duration: reduce ? 0 : 0.25 }); };

  /* ── 내 위치: 카드가 줄에서 풀려 앞으로 나오고, 기록 면에 큰 도장 ── */
  const showScale = () => (narrow ? 1.6 : 1.42);
  const seal = (c, ok, helped = false) => {
    const s = document.createElement('span'); s.className = `sc-seal ${ok ? 'is-ok' : 'is-x'}`;
    s.innerHTML = '<b></b><small></small>'; s.firstChild.textContent = ok ? '혼자 맞힘' : '다시 연습'; s.lastChild.textContent = ok ? '처음 보는 문제 · 도움 없이' : '1분 뒤 다시';
    if (ok && helped) { s.firstChild.textContent = '힌트 보고 맞힘'; s.lastChild.textContent = '처음 보는 문제 · 힌트 씀'; s.classList.add('is-help'); }
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
    // 끝 단추 밑 설명(11-19): 처음 오는 학생이 열기 전에 궁금한 두 가지 — 한글을 못 읽어도 되는지, 가입해야 하는지
    const note = document.createElement('p'); note.className = 'sc-endnote';
    for (const t of D.me.note || []) { const l = document.createElement('span'); l.textContent = t; note.append(l); }
    next.replaceChildren(a, b, note); play('pop', { delay: 0.05 });
    if (!reduce) gsap.fromTo(note, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.3 });
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
    // 다음 단추가 화면 아래로 밀렸으면(영어 판의 긴 장면 글) 구역을 보고 있을 때만 보일 만큼 부드럽게 내린다
    setTimeout(() => { const r = b.getBoundingClientRect(), R = root.getBoundingClientRect(); if (r.bottom > innerHeight - 8 && R.top < innerHeight / 2 && R.bottom > 0) window.scrollBy({ top: r.bottom - innerHeight + 24, behavior: reduce ? 'auto' : 'smooth' }); }, reduce ? 0 : 650);
    return b;
  };
  const leaveStage = () => new Promise((res) => { if (reduce) return res(); gsap.to([stage, after], { y: -18, opacity: 0, filter: 'blur(6px)', duration: 0.34, ease: 'power2.in', onComplete: res }); });
  const enterStage = () => { if (!reduce) gsap.fromTo([stage, after], { y: 14, opacity: 0, filter: 'blur(6px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.5, ease: 'power3.out' }); };
  const fastForward = (cap, from, to, fmt, scene) => new Promise((res) => {
    ffCap.textContent = cap; play('tick');
    const o = { v: from };
    if (scene) root.dataset.stageScene = scene;
    gsap.timeline({ onComplete: res })
      .fromTo(ff, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(2)' })
      .to(o, { v: to, duration: reduce ? 0 : 1.15, ease: 'power3.out', onUpdate: () => { ffNum.textContent = fmt(o.v); } }, 0)
      .to(ff, { opacity: 0, scale: 1.04, duration: 0.3, ease: 'power2.in' }, '+=0.35');
  });
  const mmss = (v) => { const s = Math.round(v); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

  /* ── 안내(11-19 · 처음 보는 사람용, 게임 첫 판처럼): 지금 할 일 한 가지를 그 자리 옆 말풍선으로 보이고, 처음 한 번은 손가락이 먼저 해 보인다 ── */
  const G = {
    pick: '알맞은 말을 골라 카드를 눌러 보세요', pickSub: '답하면 그 말이 언제 다시 나오는지 보여 드려요. 모르겠으면 「힌트」를 눌러 보세요.',
    record: '답한 말은 기록 카드가 돼요', recordSub: '이 카드에 「낱말 뜻 읽기」 실력이 기록돼요. 오늘 결과 도장이 찍혔어요.',
    line: '이 줄이 앞으로의 30일이에요', lineSub: '잊을 만할 때마다 1분 뒤, 내일, 7일 뒤, 30일 뒤에 다시 물어봐요.',
    right: '맞았어요!', wrong: '아쉬워요. 정답은 {n}번이에요', rightSub1: '맞힌 말은 조금 더 있다가, 내일 다시 나와요.', wrongSub1: '처음 만난 분께는 「안녕하세요」라고 인사해요. 틀린 말은 더 빨리, 1분 뒤에 다시 나와요.',
    next: '눌러서 그날로 가 보세요', back: '그 말이 돌아왔어요', backSub: '이번에는 장면이 달라요. 다시 골라 보세요.',
    shot: '그날 앱을 열면 보이는 화면이에요', check: '같은 실력을 처음 보는 문제로 확인해요', checkSub: '도움 없이 혼자 골라 보세요. 힌트를 쓰면 「힌트 보고 맞힘」으로 남아요.',
    me: '30일 동안 쌓인 기록이에요', meSub: '카드를 누르면 앞면과 기록 면이 바뀌어요.', off: '안내 끄기',
  };
  let guideOn = true, handTL = null, handBob = null, qtrOn = false;
  const fillT = (t, o) => String(t).replace(/\{(\w+)\}/g, (_, k) => (o[k] ?? ''));
  const guide = document.createElement('div'); guide.className = 'sc-guide'; guide.setAttribute('role', 'status'); guide.setAttribute('aria-live', 'polite');
  guide.innerHTML = '<p class="sc-guide-t"></p><p class="sc-guide-s"></p><button type="button" class="sc-guide-x"></button><i class="sc-guide-tail" aria-hidden="true"></i>';
  guide.inert = true;   // 숨은 말풍선의 「안내 끄기」가 초점을 받지 않게
  $('.sc-guide-x', guide).textContent = G.off;
  root.append(guide);
  const hand = document.createElement('div'); hand.className = 'sc-hand'; hand.setAttribute('aria-hidden', 'true');
  hand.innerHTML = '<svg viewBox="0 0 48 56"><path d="M18 30V9.5a4.5 4.5 0 0 1 9 0V25l1.2-.4a4.4 4.4 0 0 1 5.4 2.4l.4-.1a4.4 4.4 0 0 1 5.4 2.7 4.3 4.3 0 0 1 5.1 3.5l.5 4.6c.6 5.6-1.2 10-4.6 13.3l-1.2 1.2c-1.4 1.4-3.3 2.1-5.3 2.1H22.6c-2.4 0-4.6-1.1-6-3L7.9 40.6a4.6 4.6 0 0 1 7-5.9z"/></svg><i class="sc-hand-ring"></i>';
  root.append(hand);
  const rel = (el) => { const r = el.getBoundingClientRect(), R = root.getBoundingClientRect(); return { x: r.left - R.left, y: r.top - R.top, w: r.width, h: r.height }; };
  const union = (els) => { const bs = els.map(rel); const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y)); return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y }; };
  // side: right · left · top · bottom. 말풍선 꼬리는 대상 쪽을 가리킨다
  const tip = (t, s, box, side, always = false) => {   // always: 안내를 닫은 방문자에게도 보인다(힌트의 번역 질문)
    if (!guideOn && !always) return;
    $('.sc-guide-t', guide).textContent = t; $('.sc-guide-s', guide).textContent = s || '';
    guide.dataset.side = side; guide.classList.add('is-on'); guide.inert = false;
    const RW = root.clientWidth, m = 16;
    // 옆에 설 때는 남은 폭에 맞춰 줄을 바꾼다(대상을 덮지 않게)
    const cap = narrow ? 270 : 340, room = side === 'right' ? RW - (box.x + box.w + m) - 12 : side === 'left' ? box.x - m - 12 : cap;
    guide.style.maxWidth = Math.min(cap, Math.max(150, room)) + 'px';
    const gw = guide.offsetWidth, gh = guide.offsetHeight;
    let x, y;
    if (side === 'right') { x = box.x + box.w + m; y = box.y + box.h / 2 - gh / 2; }
    else if (side === 'left') { x = box.x - gw - m; y = box.y + box.h / 2 - gh / 2; }
    else if (side === 'top') { x = box.x + box.w / 2 - gw / 2; y = box.y - gh - m; }
    else { x = box.x + box.w / 2 - gw / 2; y = box.y + box.h + m; }
    const cx = clamp(x, 12, RW - gw - 12);
    const tail = side === 'top' || side === 'bottom' ? clamp(box.x + box.w / 2 - cx, 18, gw - 18) : clamp(box.y + box.h / 2 - y, 16, gh - 16);
    guide.style.setProperty('--tail', tail + 'px');
    // 말풍선이 장면 밑 설명 글 위에 서면 그 글을 잠깐 흐린다(글이 반쯤 가려져 잘린 것처럼 보이지 않게)
    const hit = (el) => { if (!el.textContent.trim()) return false; const r = rel(el); return cx < r.x + r.w && cx + gw > r.x && y < r.y + r.h && y + gh > r.y; };
    after.classList.toggle('is-tipped', hit(say) || hit(sub));
    play('pop', { g: 0.55, rate: 1.15 });
    if (reduce) { gsap.set(guide, { x: cx, y, opacity: 1, scale: 1 }); return; }
    gsap.killTweensOf(guide);
    gsap.fromTo(guide, { x: cx, y: y + (side === 'top' ? 8 : side === 'bottom' ? -8 : 0), opacity: 0, scale: 0.92 }, { x: cx, y, opacity: 1, scale: 1, duration: 0.42, ease: 'back.out(2.2)' });
  };
  const untip = () => { qtrOn = false; guide.removeAttribute('lang'); guide.classList.remove('is-qtr'); guide.classList.remove('is-on'); guide.inert = true; after.classList.remove('is-tipped'); gsap.to(guide, { opacity: 0, duration: reduce ? 0 : 0.2 }); };
  const stopHand = () => { handTL?.kill(); handTL = null; handBob?.kill(); handBob = null; gsap.killTweensOf(hand); gsap.to(hand, { opacity: 0, duration: reduce ? 0 : 0.2 }); };
  const ring = () => { const r = $('.sc-hand-ring', hand); gsap.fromTo(r, { scale: 0.2, opacity: 0.9 }, { scale: 1.7, opacity: 0, duration: 0.6, ease: 'power2.out' }); play('press', { g: 0.35 }); };
  // 처음 한 번: 손가락이 보기 카드를 하나씩 짚어 보고, 누르는 시늉을 한다(정답을 고르지는 않는다). 방문자가 손을 대면 멈춘다
  const demoCards = (cs) => {
    if (reduce || !guideOn) return;
    stopHand();
    const pts = cs.map((c) => { const b = rel(c.el); return [b.x + b.w * 0.58, b.y + b.h * 0.66]; });
    handTL = gsap.timeline({ repeat: 2, repeatDelay: 2.2, delay: 0.6 });
    handTL.set(hand, { x: pts[0][0] + 70, y: pts[0][1] + 90, opacity: 0, scale: 1 }).to(hand, { opacity: 1, duration: 0.3 });
    pts.forEach(([x, y], i) => handTL.to(hand, { x, y, duration: 0.55, ease: 'power2.inOut' }).call(() => { cs[i].w += sign() * 0.7; cs[i].pv += sign() * 1.5; }).to({}, { duration: 0.25 }));
    handTL.to(hand, { x: pts[1][0], y: pts[1][1], duration: 0.5, ease: 'power2.inOut' }).to(hand, { scale: 0.84, duration: 0.12 }).call(ring).to(hand, { scale: 1, duration: 0.2 }).to(hand, { opacity: 0, duration: 0.4, delay: 0.5 });
  };
  // 단추를 가리킨다: 손가락이 단추 오른쪽 아래에서 톡톡 친다
  const pointAt = (el) => {
    if (reduce || !guideOn) return;
    stopHand();
    const b = rel(el), x = b.x + b.w - 18, y = b.y + b.h * 0.55;
    gsap.set(hand, { x: x + 30, y: y + 40, opacity: 0, scale: 1 });
    gsap.to(hand, { x, y, opacity: 1, duration: 0.5, ease: 'power3.out' });
    handBob = gsap.to(hand, { y: y + 9, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 0.5 });
  };
  $('.sc-guide-x', guide).addEventListener('click', () => { guideOn = false; untip(); stopHand(); play('press'); });
  // 지금 할 일 — 장면마다 부른다
  // 좁은 화면: 고를 때는 카드 밑(묻는 말을 가리지 않는다), 답한 뒤에는 카드 위(결과 글을 가리지 않는다). 단추는 손가락만 가리킨다
  const guidePick = (cs, demo, t = G.pick, s = G.pickSub) => { tip(t, s, union(cs.map((c) => c.el)), narrow ? 'bottom' : 'right'); if (demo) demoCards(cs); };
  // 카드 옆에 빈자리가 있으면 옆에, 없으면 위에(좁은 화면에서 결과 글을 가리지 않는다)
  const guideCard = (c, t, s) => { const b = rel(c.el), RW = root.clientWidth; tip(t, s, b, !narrow || RW - (b.x + b.w) >= 190 ? 'right' : b.x >= 190 ? 'left' : 'top'); };
  // 「이 줄이 30일」: 좁은 화면에서는 날 이름(1분 뒤 · 내일 · 7일 뒤 · 30일 뒤)을 가리키며 그 위에 선다
  const guideLine = (c, t, s) => (narrow ? tip(t, s, union(stopLis.slice(1)), 'top') : guideCard(c, t, s));
  const guideButton = (b, t = G.next) => { if (!b) return; if (!narrow) tip(t, '', rel(b), 'right'); pointAt(b); b.addEventListener('click', () => { untip(); stopHand(); }, { once: true }); };

  /* ── 힌트(11-19): 모르면 두 단계로 돕는다 — ① 튜터가 방문자 말로 묻는 말을 읽어 준다 ② 그 상황을 짧은 장면 영상으로 보인다.
       30일 확인 문제에서 힌트를 쓰면 「혼자 맞힘」으로 세지 않는다(앱의 기록 원칙) ── */
  const H = { btn: '힌트', step1: '질문 듣기', step2: '장면 보기', again: '장면 다시 보기', cap: '힌트 · 이런 상황이에요', close: '힌트 닫기', d30Say: '힌트를 보고 맞혔습니다', d30Sub: '힌트를 쓴 답은 「혼자 맞힘」으로 세지 않습니다. 30일 기록에는 「힌트 보고 맞힘」으로 남습니다.' };
  const HINTS = { first: { v: 'class' }, second: { v: 'staff' }, d30: { v: 'book' } };
  const hintSrc = (k, ext) => (window.__CARDDATA && window.__CARDDATA[`hint/${k}.${ext}`]) || `hint/${k}.${ext}`;
  let hintKey = null, hintStep = 0, hintUsed = false, hintCards = [], qSrc = null, readTw = null, hearT = [];
  const qBox = promptEl.closest('.sc-q') || promptEl.parentElement;
  const hintBtn = document.createElement('button'); hintBtn.type = 'button'; hintBtn.className = 'sc-hintbtn'; hintBtn.tabIndex = -1; hintBtn.setAttribute('aria-hidden', 'true');
  hintBtn.innerHTML = '<svg class="sc-hint-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/></svg><b></b><span class="sc-hint-step"></span>';
  // 묻는 말과 힌트 단추를 한 줄로 묶는다: 넓은 화면은 묻는 말 옆, 좁으면 밑으로 접힌다(줄 무대를 아래로 밀지 않게)
  const pline = document.createElement('div'); pline.className = 'sc-pline'; promptEl.before(pline); pline.append(promptEl, hintBtn);
  const hintFig = document.createElement('figure'); hintFig.className = 'sc-hintfig'; hintFig.setAttribute('aria-hidden', 'true'); hintFig.inert = true;   // 숨긴 동안 닫기 단추가 초점을 받지 않게
  hintFig.innerHTML = '<figcaption></figcaption><div class="sc-hintfig-in"><video muted playsinline preload="none"></video></div><button type="button" class="sc-hintfig-x"></button>';
  $('.sc-hintfig-x', hintFig).setAttribute('aria-label', H.close);
  root.append(hintFig);
  const hintVid = $('video', hintFig); hintVid.muted = true; hintVid.loop = true; hintVid.setAttribute('muted', ''); hintVid.setAttribute('playsinline', '');
  const paintHint = () => {
    // 몇 번째 힌트인지 숫자로(점 두 개는 처음 보는 사람이 뜻을 몰랐다): 힌트 1/2 · 질문 듣기 → 힌트 2/2 · 장면 보기 → 힌트 · 장면 다시 보기
    $('b', hintBtn).textContent = hintStep < 2 ? `${H.btn} ${hintStep + 1}/2` : H.btn;
    $('.sc-hint-step', hintBtn).textContent = hintStep === 0 ? H.step1 : hintStep === 1 ? H.step2 : H.again;
    hintBtn.dataset.step = String(hintStep);
    hintBtn.setAttribute('aria-label', `${$('b', hintBtn).textContent}: ${$('.sc-hint-step', hintBtn).textContent}`);
  };
  const stopReading = () => { hearT.forEach(clearTimeout); hearT = []; try { qSrc?.stop(); } catch { /* 이미 끝남 */ } qSrc = null; readTw?.kill(); readTw = null; qBox.classList.remove('is-read'); hintBtn.classList.remove('is-reading'); };
  const hideHintFig = () => { if (hintFig.contains(document.activeElement)) hintBtn.focus({ preventScroll: true }); hintFig.classList.remove('is-on'); hintFig.setAttribute('aria-hidden', 'true'); hintFig.inert = true; gsap.to(hintFig, { opacity: 0, duration: reduce ? 0 : 0.2, onComplete: () => hintVid.pause() }); };
  // 장면마다 부른다: 그 문제의 힌트를 처음 단계로
  const setHint = (key, cs) => {
    hintKey = key; hintStep = 0; hintUsed = false; hintCards = cs; stopReading(); hideHintFig(); hideQtr(); paintHint();
    hintBtn.classList.add('is-on'); hintBtn.tabIndex = 0; hintBtn.removeAttribute('aria-hidden'); hlWrap.classList.add('is-on');
    gsap.killTweensOf(hintBtn);
    if (!reduce) gsap.fromTo(hintBtn, { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'back.out(2)', delay: 0.2 });
    else gsap.set(hintBtn, { y: 0, opacity: 1 });   // 움직임 줄이기면 앞 문제 끝에 남긴 투명을 바로 걷는다
  };
  const endHint = () => { const used = hintUsed; hintKey = null; stopReading(); hideHintFig(); hideQtr(); hintBtn.classList.remove('is-on'); hintBtn.tabIndex = -1; hintBtn.setAttribute('aria-hidden', 'true'); hlWrap.classList.remove('is-on'); gsap.to(hintBtn, { opacity: 0, duration: reduce ? 0 : 0.2 }); return used; };
  // ① 묻는 말 읽기: 소리가 꺼져 있어도 이 단추는 듣겠다는 뜻이라 켠다. 읽는 동안 묻는 말 밑에 진행 줄이 그어진다
  // 묻는 말을 읽은 뒤 보기 카드가 하나씩 제 말을 소리 내어 한다 — 휴대폰은 손을 올려 들어 볼 수 없어서다
  const hearChoices = (key) => { hearT.forEach(clearTimeout); hearT = hintCards.map((k, i) => setTimeout(() => { if (hintKey !== key || !k.answerable) return; act(k, true, true); k.pv += sign() * 1.6; k.w += sign() * 0.5; }, 300 + i * 1300)); };
  const sayQuestion = async (k) => {
    const key = hintKey;
    if (!soundOn) { soundOn = true; paintSound(); }
    loadAudio(); ac?.resume(); fetchSnd(k);
    for (let i = 0; i < 25 && ac && !bufs[k]; i++) await wait(80);
    if (hintKey !== key) return;
    stopReading();
    const d = bufs[k]?.duration || 4.8;
    if (ac && bufs[k]) { const src = ac.createBufferSource(); src.buffer = bufs[k]; const gn = ac.createGain(); gn.gain.value = SND[k].g; src.connect(gn).connect(master); src.start(); qSrc = src; }
    window.__snd?.push({ t: Date.now(), k, g: SND[k].g, r: 1 });
    qBox.classList.add('is-read'); hintBtn.classList.add('is-reading');
    readTw = gsap.fromTo(qBox, { '--rp': '0%' }, { '--rp': '100%', duration: d, ease: 'none', onComplete: () => { hintBtn.classList.remove('is-reading'); hearChoices(key); gsap.to(qBox, { '--ro': 0, duration: 0.4, onComplete: () => { qBox.classList.remove('is-read'); gsap.set(qBox, { '--ro': 1 }); } }); } });
  };
  // ② 장면 영상: 넓은 화면은 보기 카드 오른쪽 빈 줄 아래, 좁은 화면은 카드 밑
  const showHintFig = (v) => {
    if (hintVid.dataset.v !== v) { hintVid.poster = hintSrc(v, 'jpg'); hintVid.src = hintSrc(v, 'mp4'); hintVid.dataset.v = v; }
    $('figcaption', hintFig).textContent = H.cap;
    const b = union(hintCards.map((k) => k.el)), RW = root.clientWidth;
    let x, y, w;
    // 넓은 화면: 줄에 걸린 다른 카드(30일 문제의 기록 카드)를 가리지 않게 그 앞에서 멈춘다
    const others = [...cards].filter((k) => !hintCards.includes(k) && k.op > 0.5).map((k) => rel(k.el)).filter((o) => o.x > b.x + b.w);
    const stop = Math.min(RW - 32, ...others.map((o) => o.x - 24));
    if (narrow || stop - (b.x + b.w + 44) < 300) { w = Math.min(520, RW - 24); x = (RW - w) / 2; y = b.y + b.h + 12; }
    else { x = b.x + b.w + 44; w = Math.min(480, stop - x); y = b.y - 4; }
    hintFig.style.width = w + 'px';
    hintFig.classList.add('is-on'); hintFig.removeAttribute('aria-hidden'); hintFig.inert = false;
    gsap.killTweensOf(hintFig);
    if (reduce) gsap.set(hintFig, { x, y, opacity: 1, scale: 1 });
    else gsap.fromTo(hintFig, { x, y: y + 14, opacity: 0, scale: 0.96 }, { x, y, opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.8)' });
    try { hintVid.currentTime = 0; } catch { /* 아직 못 감음 */ }
    hintVid.play().catch(() => {});
    play('whoosh', { g: 0.5, rate: 1.1 }); play('pop', { delay: 0.12 });
    // 좁은 화면: 영상이 화면 아래로 잘리면 보일 만큼만 부드럽게 내린다
    if (narrow) setTimeout(() => { const r = hintFig.getBoundingClientRect(); if (r.bottom > innerHeight - 8) window.scrollBy({ top: r.bottom - innerHeight + 16, behavior: reduce ? 'auto' : 'smooth' }); }, reduce ? 0 : 480);
  };
  hintBtn.addEventListener('pointerdown', () => play('press'));
  hintBtn.addEventListener('click', () => {
    if (!hintKey) return;
    const h = HINTS[hintKey]; hintUsed = true; if (!qtrOn) untip(); stopHand();   // 번역 질문은 힌트 2를 봐도 남긴다
    if (hintStep === 0) { hintStep = 1; paintHint(); showQtr(); sayQuestion(QV(hintKey, hl)); }
    else { hintStep = 2; paintHint(); showHintFig(h.v); }
  });
  $('.sc-hintfig-x', hintFig).addEventListener('click', () => { play('press'); hideHintFig(); });
  // 힌트 1: 힌트 언어가 쪽 언어가 아니면 묻는 말을 그 말로 옮겨 묻는 말 밑(카드 위 빈 자리)에 말풍선으로 띄운다(줄 무대를 밀지 않게)
  // 좁은 화면은 말풍선이 보기 카드를 가려서, 묻는 말 밑에 글로 넣는다(카드가 그만큼 내려간다)
  const qtrEl = document.createElement('p'); qtrEl.className = 'sc-qtr'; qtrEl.hidden = true; qBox.append(qtrEl);
  const hideQtr = () => { qtrEl.hidden = true; qtrEl.textContent = ''; if (qtrOn) { qtrOn = false; untip(); } };
  const showQtr = () => {
    const t = hintKey && hl !== HL.base ? HL.q[hintKey]?.[hl] : '';
    if (!t) { hideQtr(); return; }
    if (narrow) {
      if (qtrOn) { qtrOn = false; untip(); }
      qtrEl.textContent = t; qtrEl.lang = hl; qtrEl.hidden = false;
      if (!reduce) gsap.fromTo(qtrEl, { opacity: 0, y: -4 }, { opacity: 1, y: 0, duration: 0.35 });
      return;
    }
    qtrEl.hidden = true; qtrOn = true; guide.lang = hl; guide.classList.add('is-qtr'); tip(t, '', rel(pline), 'bottom', true);
  };
  // 머리의 「힌트 언어」: 고르면 보기 뜻 · 읽는 법이 바로 바뀌고, 그 말의 묻는 말 목소리를 받아 둔다
  const hlWrap = document.createElement('label'); hlWrap.className = 'sc-hl';
  hlWrap.innerHTML = '<span class="sc-hl-l"></span><span class="sc-hl-box"><select></select><i aria-hidden="true"></i></span>';
  $('.sc-hl-l', hlWrap).textContent = HL.label;
  const hlSel = $('select', hlWrap);
  for (const [c, n] of HL.langs) { const o = document.createElement('option'); o.value = c; o.lang = c; o.textContent = n; hlSel.append(o); }
  hlSel.value = hl; hlSel.setAttribute('aria-label', HL.label);
  // 넓은 화면은 머리의 소리 스위치 앞, 좁은 화면은 힌트 단추 옆(머리에 줄을 하나 더 만들지 않게 — 힌트 단추가 보일 때만 함께 보인다)
  placeHl = () => { if (narrow) { if (hlWrap.parentNode !== pline) pline.append(hlWrap); } else if (hlWrap.nextSibling !== soundBtn) soundBtn.before(hlWrap); };
  placeHl();
  hlSel.addEventListener('change', () => {
    hl = hlSel.value; try { localStorage.setItem('synk-lab-hl', hl); } catch { /* 이번만 */ }
    play('press'); stopReading(); cards.forEach(paintMean);
    ['first', 'second', 'd30'].forEach((key) => fetchSnd(QV(key, hl)));
    if (hintStep >= 1) showQtr();
  });

  /* ── 흐름 ── */
  const setQhead = (t) => {
    const no = document.createElement('span'); no.className = 'sc-qno'; no.textContent = String(sceneNo + 1).padStart(2, '0');
    const all = document.createElement('i'); all.textContent = '/' + String(DAYS.length).padStart(2, '0'); no.append(all);
    const tx = document.createElement('span'); tx.className = 'sc-qtx'; tx.textContent = t;
    qhead.replaceChildren(no, tx); if (specQ) specQ.textContent = t;
  };
  // 묻는 말은 한 덩어리로 감싼다: 강조 「형광펜」(data-em="mark")은 글이 다 들어온 뒤 왼쪽에서 오른쪽으로 칠해진다
  const markPrompt = () => {
    const mk = document.createElement('span'); mk.className = 'sc-mk'; mk.append(...promptEl.childNodes); promptEl.replaceChildren(mk);
    if (root.dataset.em === 'mark' && !reduce) gsap.fromTo(mk, { backgroundSize: '0% 48%' }, { backgroundSize: '100% 48%', duration: 0.75, delay: 0.7, ease: 'power2.inOut' });
  };
  const showQuestion = (q) => { setQhead(q.head); kinetic(ctxEl, q.context, 0.05); kinetic(promptEl, q.prompt, 0.18); markPrompt(); setAfter(q.say, q.sub); next.replaceChildren(); };
  const takeAnswer = (cs, q, fb = {}) => new Promise((done) => {
    cs.forEach((c) => { c.answerable = true; c.el.removeAttribute('aria-disabled'); });
    answering = (picked) => {
      answering = null; stopHand(); untip();
      cs.forEach((c) => { c.answerable = false; c.el.setAttribute('aria-disabled', 'true'); });
      const correct = cs.find((c) => c.id === q.answer), right = picked === correct;
      const said = () => union(cs.map((k) => k.el)), side = narrow ? 'bottom' : 'right';
      if (right) tip(G.right, fb.right, said(), side);
      else setTimeout(() => tip(fillT(G.wrong, { n: cs.indexOf(correct) + 1 }), fb.wrong, said(), side), 640);
      if (right) {
        picked.el.classList.add('is-right'); mark(picked.wordEl, 'under'); play('underline'); play('chime', { delay: 0.18 }); picked.w += sign() * 1.4; picked.pv += sign() * 2; act(picked, true, true);
      } else {
        picked.el.classList.add('is-wrong'); play('strike', { delay: 0.1 }); picked.w += sign() * 1.5; kick(picked.x, 50);
        if (!reduce) gsap.fromTo(picked.wordEl, { x: 0 }, { keyframes: [{ x: -7 }, { x: 6 }, { x: -4 }, { x: 3 }, { x: 0 }], duration: 0.4, ease: 'power1.inOut' });
        setTimeout(() => mark(picked.wordEl, 'strike'), 100);
        if (picked.video) { picked.video.pause(); try { picked.video.currentTime = 0; } catch { /* 아직 못 감음 */ } }
        setTimeout(() => { correct.el.classList.add('is-right'); mark(correct.wordEl, 'under'); play('underline'); correct.w += sign() * 0.9; correct.pv += sign() * 2; act(correct, true, true); }, 640);
      }
      done({ right, correct, helped: endHint() });
    };
  });
  // 답한 뒤: 배울 말만 남기고 나머지는 떨어진다 → 남은 카드가 뒤집혀 기록 면에 그날의 도장을 받는다
  const settle = async (cs, r, tag, label) => {
    await wait(r.right ? 1500 : 2300);
    cs.filter((c) => c !== r.correct).forEach((c, i) => unclip(c, i * 180));
    await wait(420); setFull(false);
    await wait(900); untip();
    r.correct.backTag.textContent = tag;
    await flipTo(r.correct, 'back'); await wait(60);
    stamp(r.correct, r.right, label);
  };
  async function first(again = false) {
    root.dataset.stageScene = 'now'; setClock(0);
    stopLis.forEach((li) => { li.querySelector('b').textContent = ''; });
    showQuestion(Q.first); enterStage(); setFull(true);
    const cs = Q.first.choices.map(([id, text], i) => makeCard(id, text, i + 1));
    await Promise.all(cs.map((c, i) => dropIn(c, { kind: 'slot', i }, 0.3 + i * 0.2)));
    setHint('first', cs); await frames();   // 힌트 단추에 글이 들어가면 묻는 말 줄이 늘어 카드가 내려간다 — 그 뒤 카드가 제자리에 그려지고 나서 말풍선 자리를 잰다
    guidePick(cs, !again);
    if (again) cs[0].el.focus({ preventScroll: true });   // 다시 할 때는 첫 카드로(처음 열릴 때는 쪽의 포커스를 뺏지 않는다)
    const r = await takeAnswer(cs, Q.first, { right: G.rightSub1, wrong: G.wrongSub1 });
    await settle(cs, r, '오늘 처음 만난 말', '지금');
    guideCard(r.correct, G.record, G.recordSub);
    setAfter(r.right ? Q.right.say : Q.wrong.say, r.right ? Q.right.sub : Q.wrong.sub);
    await wait(1500);
    const at = r.right ? 2 : 1;
    untip(); await travel(r.correct, { kind: 'knot', i: at });
    guideLine(r.correct, G.line, fillT(G.lineSub, { d: STOPS[at].l }));
    if (!guideOn) showHint(r.correct);
    await wait(guideOn ? 1900 : 260);
    guideButton(r.right ? button(Q.toDay1, () => toTomorrow(r.correct)) : button(Q.toMinute, () => toMinute(r.correct)));
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
    setHint('second', cs); await frames();
    guidePick(cs, false, G.back, G.backSub);
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
    guideButton(r.right ? button(Q.toDay1, () => toTomorrow(r.correct)) : button(Q.toMinute, () => toMinute(r.correct)));
  }
  const clearStage = (h) => { endHint(); setQhead(h); ctxEl.textContent = ''; promptEl.textContent = ''; setAfter('', ''); next.replaceChildren(); };
  // 내일: 앱을 열면 튜터 카드가 먼저 꺼낸다(실제 화면) → 카드가 돌아와 그 말을 한다 → 「내일」 칸 ✓
  async function toTomorrow(c) {
    hideHint(); hideShot(); await leaveStage(); setClock(2);
    await flipDays(0, 1, 'morning', '다음 날 아침', 'sun');
    clearStage(D.d1.head); enterStage();
    c.backTag.textContent = '어제 만난 말';
    await showShot(shot, D.d1.shot);
    tip(G.shot, '', rel(shot), narrow ? 'bottom' : 'right');
    await wait(700);
    await callBack(c); untip();
    await wait(2300);
    await flipTo(c, 'back'); await wait(60);
    stamp(c, true, '내일'); markStop(2, true); c.el.classList.remove('is-called');
    setAfter(D.d1.say, D.d1.sub);
    await wait(900);
    await travel(c, { kind: 'knot', i: 3 });
    await wait(260);
    guideButton(button(D.d1.next, () => toWeek(c)));
  }
  // 7일 뒤: 다시 확인할 때(실제 화면 「7일 뒤 · 지금 확인」) → 카드가 돌아오고 7일 칸에 물음표 도장(확인 중)
  async function toWeek(c) {
    hideHint(); hideShot(); await leaveStage(); setClock(3);
    await flipDays(1, 7, 'rain', '일주일 뒤', 'rain');
    clearStage(D.d7.head); enterStage();
    c.backTag.textContent = '일주일 전에 만난 말';
    await showShot(shot, D.d7.shot);
    tip(G.shot, '', rel(shot), narrow ? 'bottom' : 'right');
    await wait(700);
    await callBack(c); untip();
    await wait(2300);
    await flipTo(c, 'back'); await wait(60);
    stamp(c, 'wait', '7일 뒤'); c.el.classList.remove('is-called');
    setAfter(D.d7.say, D.d7.sub);
    await wait(900);
    await travel(c, { kind: 'knot', i: 4 });
    await wait(260);
    guideButton(button(D.d7.next, () => toMonth(c)));
  }
  // 30일 뒤: 눈 오는 겨울. 7일 칸은 그 사이 레슨에서 확인됐고(실제 화면), 30일 칸은 같은 항목의 처음 보는 문제(앱의 첫 레슨 둘째 문제)로 채운다.
  // 돌아온 카드(기록)는 30일 매듭에 걸린 채로 있고, 보기 세 장은 새로 떨어진다.
  async function toMonth(c) {
    hideHint(); hideShot(); await leaveStage(); setClock(4);
    await flipDays(7, 30, 'snow', '한 달 뒤', 'snow');
    winter = true; setPic(c);
    c.backTag.textContent = '한 달 전에 만난 말';
    clearStage(D.d30.head); enterStage();
    await showShot(shot, D.d30.shot);
    await wait(500);
    c.el.classList.add('is-called'); play('whoosh', { g: 0.6, rate: 1.2 });
    await new Promise((res) => gsap.timeline({ onComplete: res }).to(c, { lift: 26, duration: reduce ? 0 : 0.26, ease: 'power2.out' }).to(c, { lift: 0, duration: reduce ? 0 : 0.4, ease: 'bounce.out' }));
    confirmStamp(c, '7일 뒤'); markStop(3, true);
    await wait(1500);
    hideShot();
    if (narrow) gsap.to(c, { op: 0, duration: reduce ? 0 : 0.3 });   // 휴대폰은 보기 세 장이 폭을 다 쓴다 — 기록 카드는 잠깐 비켜 둔다
    const q = D.d30;
    await wait(260);
    showQuestion(q); setFull(true);
    const cs = q.choices.map(([id, text], i) => makeCard(id, text, i + 1));
    await Promise.all(cs.map((k, i) => dropIn(k, { kind: 'slot', i }, 0.15 + i * 0.2)));
    setHint('d30', cs); await frames();
    guidePick(cs, false, G.check, G.checkSub);
    if (!root.contains(document.activeElement)) cs[0].el.focus({ preventScroll: true });
    const r = await takeAnswer(cs, q);
    await wait(r.right ? 1500 : 2300);
    cs.forEach((k, i) => unclip(k, i * 180));
    await wait(420); setFull(false); untip();
    gsap.to(c, { op: 1, duration: reduce ? 0 : 0.4 });   // 푸는 사이 화면 폭이 바뀌어도 기록 카드를 되살린다
    await wait(700);
    c.el.classList.remove('is-called');
    stamp(c, r.right, '30일 뒤'); markStop(4, r.right);
    setAfter(r.right ? (r.helped ? H.d30Say : q.right.say) : q.wrong.say, r.right ? (r.helped ? H.d30Sub : q.right.sub) : q.wrong.sub);
    await wait(900);
    guideButton(button(q.next, () => toMe(c, r.right, r.helped)));
  }
  // 내 위치: 집게에서 풀린 카드가 앞으로 나와 기록 면을 보이고 큰 도장을 받는다. 넓은 화면에서는 옆에 실제 「이렇게 본 근거」 화면.
  async function toMe(c, right, helped = false) {
    hideHint(); await leaveStage(); setClock(5); endTag.classList.add('is-now'); root.classList.add('is-me'); c.el.classList.remove('is-right', 'is-called');
    clearStage(D.me.head);
    c.backTag.textContent = '30일 기록';
    c.el.classList.add('is-open'); play('clipopen');
    await wait(160);
    leavePin(c); c.el.classList.remove('is-open');
    c.home = 'show'; c.grab = true; c.answerable = false; c.pt = 0; c.ft = 0; c.el.style.zIndex = '5'; c.el.classList.add('is-show');
    c.el.removeAttribute('aria-disabled'); c.el.setAttribute('aria-label', '내 기록 카드 — 눌러서 앞면과 기록 면을 오갑니다');
    play('whoosh', { g: 0.9, rate: 0.85 }); c.pv += 10;
    const wide = !narrow && W >= 1000, S = showScale(), cx = wide ? W / 2 - 150 : W / 2;
    c.moving = true;
    await new Promise((res) => gsap.to(c, { x: cx, y: narrow ? 18 : 6, s: S, th: 0, duration: reduce ? 0 : 1.0, ease: 'power3.inOut', onComplete: res }));
    c.moving = false; play('clipsnap', { g: 0.45, rate: 0.8 });
    await wait(260);
    seal(c, right, helped);
    setTimeout(() => tip(G.me, G.meSub, rel(c.el), narrow ? 'top' : 'left'), reduce ? 0 : 700);
    if (wide) {
      evid.style.left = (cx + (CW * S) / 2 + 36) + 'px'; evid.style.top = '18px'; evid.style.width = Math.min(380, W - (cx + (CW * S) / 2 + 36) - 24) + 'px';
      await wait(380); showShot(evid, D.me.shot);
    }
    await wait(520);
    enterStage(); setAfter(D.me.say, D.me.sub);
    await wait(300);
    finalButtons();
  }
  async function restart() {
    hideHint(); endHint(); guideOn = true; hideShot(); hideShot(evid); await leaveStage();
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
  startTick();
  first();
})();
