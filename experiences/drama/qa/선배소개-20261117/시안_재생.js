// 선배 소개 움직이는 시안의 화면 동작(11-17). 시안짓기.mjs가 DATA와 DUR을 앞에 붙여 한 장으로 만든다.
// 지킬 것: 두 줄은 무게가 같고 순서는 섞는다 · 고르기 전에는 두 사람이 함께 보인다 · 누름 세 번 안에 끝난다 · 소리는 누른 뒤에만 난다.
(function () {
  'use strict';
  var ph = document.getElementById('ph'), frame = document.getElementById('frame');
  var $ = function (s, r) { return (r || ph).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || ph).querySelectorAll(s)); };
  var qs = new URLSearchParams(location.search);
  var S = { order: [], cur: null, pick: null, by: null, stage: 'board', variant: 'b' };
  var gen = 0, sound = qs.get('mute') !== '1', voiceNow = null, ac = null;
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  // ── 크기: 390×844 좌표를 액자 폭에 맞춘다 ──
  function fit() { ph.style.setProperty('--zk', String(frame.clientWidth / 390)); }
  if (window.ResizeObserver) new ResizeObserver(fit).observe(frame);
  window.addEventListener('resize', fit); fit();

  // ── 소리: 목소리는 파일, 종이 · 펜 · 셔터는 파일 없이 합성 ──
  function ctx() {
    if (!sound) return null;
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); return ac; } catch (e) { return null; }
  }
  function noise(dur, o) {
    var c = ctx(); if (!c) return; o = o || {};
    var n = Math.max(1, Math.floor(c.sampleRate * dur)), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, o.pow || 2);
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; f.type = o.type || 'bandpass'; f.frequency.value = o.f || 2000; f.Q.value = o.q || 1; g.gain.value = o.g || 0.2;
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(c.currentTime + (o.at || 0));
  }
  function tone(freq, dur, o) {
    var c = ctx(); if (!c) return; o = o || {};
    var os = c.createOscillator(), g = c.createGain(), t = c.currentTime + (o.at || 0);
    os.type = 'sine'; os.frequency.value = freq; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.g || 0.12, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    os.connect(g); g.connect(c.destination); os.start(t); os.stop(t + dur + 0.05);
  }
  var sfx = {
    tick: function () { noise(0.05, { f: 3200, q: 2, g: 0.25 }); },
    paper: function () { noise(0.24, { f: 1400, q: 0.7, g: 0.22, pow: 1.2 }); },
    tack: function () { noise(0.07, { f: 800, q: 3, g: 0.5 }); },
    pen: function () { for (var i = 0; i < 5; i++) noise(0.17, { f: 2600 + Math.random() * 900, q: 1.2, g: 0.1, at: i * 0.2, pow: 0.8 }); },
    shutter: function () { noise(0.03, { f: 4200, q: 1, g: 0.5 }); noise(0.07, { f: 1700, q: 1.5, g: 0.4, at: 0.09 }); },
    done: function () { tone(784, 0.35); tone(1175, 0.5, { at: 0.12, g: 0.09 }); },
  };
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* 없는 기기 */ } }
  function stopVoice() { if (voiceNow) { var v = voiceNow; voiceNow = null; v(false); } }
  // 끝까지 들으면 true, 다른 소리나 다시 시작으로 끊기면 false. 소리가 꺼졌거나 막혀도 같은 길이만큼 기다린다.
  function voice(id) {
    stopVoice();
    return new Promise(function (res) {
      var a = null, done = false, t = setTimeout(function () { fin(true); }, (DUR[id] || 3) * 1000 + 300);
      function fin(ok) { if (done) return; done = true; clearTimeout(t); if (a) { try { a.pause(); } catch (e) { /* 이미 멈춤 */ } } if (voiceNow === fin) voiceNow = null; res(ok); }
      voiceNow = fin;
      if (!sound) return;
      a = new Audio('snd/' + id + '.mp3'); a.onended = function () { fin(true); };
      var p = a.play(); if (p && p.catch) p.catch(function () { /* 자동 재생이 막히면 글과 길이만 */ });
    });
  }

  // ── 화면 조각 ──
  function show(id) {
    // 휴대폰 상자는 안쪽으로 스크롤되면 안 된다(화면 밖에서 기다리는 포스트잇 때문에 내용이 상자보다 길다). overflow:clip이 막고, 못 막는 브라우저를 위해 자리도 되돌린다.
    ph.scrollTop = 0; frame.scrollTop = 0;
    $$('.layer').forEach(function (l) { l.classList.toggle('on', l.id === id); });
    ph.classList.toggle('dark', id === 'L-ep'); ph.classList.toggle('tdon', id === 'L-td');
    var step = { 'L-board': S.stage === 'board' ? 1 : 2, 'L-chap': 3, 'L-ep': 3, 'L-snap': 4, 'L-td': 5, 'L-a': 0 }[id];
    document.querySelectorAll('.steps li').forEach(function (li) { li.classList.toggle('on', Number(li.dataset.step) === step); });
  }
  function swapQ(box, l1, l2, sub) {
    var t = $('.t', box), s = $('.sub', box);
    [t, s].forEach(function (e) { e.classList.add('out'); });
    return wait(260).then(function () {
      $('.l1', t).textContent = l1; $('.l2', t).textContent = l2; s.textContent = sub || '';
      [t, s].forEach(function (e) { e.classList.remove('out'); });
    });
  }
  function setGo(el, ko, en, me) {
    el.innerHTML = ''; el.append(document.createTextNode(ko));
    if (en) { var sm = document.createElement('small'); sm.textContent = en; el.append(sm); }
    el.classList.toggle('me', !!me); el.classList.add('on');
  }
  function fakeTap(el) {
    var tap = $('#tap'), r = el.getBoundingClientRect(), p = ph.getBoundingClientRect(), k = p.width / 390;
    tap.style.left = ((r.left + r.width / 2 - p.left) / k) + 'px'; tap.style.top = ((r.top + r.height / 2 - p.top) / k) + 'px';
    tap.animate([{ opacity: 0, transform: 'scale(1.5)' }, { opacity: 1, transform: 'scale(1)', offset: 0.45 }, { opacity: 0, transform: 'scale(.8)' }], { duration: 520, easing: 'ease-out' });
    return wait(300).then(function () { el.click(); });
  }
  var senior = function () { return DATA.seniors[S.pick]; };

  // ── ① 게시판 ──
  var board = $('#L-board'), bd = $('.bd', board), q = $('.q', board), hb = $('.heard-box', board), go = $('.go', board), links = $('.links', board), hint = $('.hint', board), pi = $('.pi', board);
  function buildRows() {
    $$('.row', bd).forEach(function (r) { r.remove(); });
    S.order.forEach(function (k, i) {
      var d = DATA.seniors[k], b = document.createElement('button');
      b.type = 'button'; b.className = 'row r' + (i + 1); b.dataset.k = k; b.setAttribute('aria-label', d.name + ' 선배 소개. 누르면 인사를 듣습니다.');
      b.innerHTML = '<i class="pin"></i><span class="shot"><img alt="" src="' + d.photo + '"></span><span class="nm"></span><span class="yr"></span><span class="lb">신입생 때 나는<em>As a freshman, I…</em></span><span class="it"></span><span class="mean"></span>'
        + '<span class="sp"><svg viewBox="0 0 12 12"><path d="M2.5 1.2v9.6L10.6 6z"/></svg><span class="bars"><b></b><b></b><b></b></span></span>'
        + '<svg class="ring" viewBox="0 0 104 50"><path pathLength="1" d="M70 6C48 1 16 4 7 20s10 26 42 26 50-8 48-24C95 9 72 3 46 5"/></svg>';
      $('.nm', b).textContent = d.name; $('.yr', b).textContent = d.year; $('.it', b).textContent = d.intro; $('.mean', b).textContent = d.introEn;
      b.addEventListener('click', function () { if (S.stage === 'board') hear(k); });
      bd.append(b);
    });
  }
  // 2.5초쯤 아무 줄도 누르지 않으면 두 줄의 듣기 단추가 함께 한 번 뛴다(첫 시험에서 둘이 안내를 놓치기 쉽다고 했다). 한쪽만 뛰지 않는다.
  var nudgeT = 0;
  function nudge() {
    if (S.stage !== 'board' || S.cur || !board.classList.contains('on')) return;
    $$('.row', bd).forEach(function (r) { r.classList.remove('nudge'); void r.offsetWidth; r.classList.add('nudge'); });
    nudgeT = setTimeout(nudge, 6000);
  }
  function resetBoard() {
    clearTimeout(nudgeT); nudgeT = setTimeout(nudge, 2500);
    S.cur = null; S.pick = null; S.by = null; S.stage = 'board'; board.classList.remove('picked');
    buildRows(); bd.classList.remove('back', 'away'); pi.classList.remove('in'); $('.add', pi).classList.remove('w'); $('.add b', pi).textContent = '';
    hb.classList.remove('on'); go.classList.remove('on', 'me'); hint.classList.remove('off'); links.classList.remove('off');
    links.innerHTML = '<button type="button" data-act="seoha">서하가 정해 주세요<small>Let Seoha pick</small></button>';
    $('.keep', q).hidden = true;
    $('.l1', q).textContent = '학교 생활,'; $('.l2', q).textContent = '누구한테 물어볼래요?'; $('.sub', q).textContent = 'Who would you like to ask about school life?';
    $$('.swap', q).forEach(function (e) { e.classList.remove('out'); });
    show('L-board');
  }
  function hear(k) {
    var g = gen, d = DATA.seniors[k], row = $('.row[data-k="' + k + '"]', bd);
    clearTimeout(nudgeT); S.cur = k; hint.classList.add('off'); sfx.paper(); buzz(4);
    $$('.row', bd).forEach(function (r) { r.classList.toggle('cur', r === row); r.classList.remove('playing', 'nudge'); });
    row.classList.add('playing', 'heard');
    $('.sub', q).classList.add('out');
    hb.classList.remove('on');
    wait(140).then(function () {
      if (g !== gen || S.cur !== k) return;
      $('.hk span', hb).textContent = d.name + ' 선배의 인사'; $('.ht', hb).textContent = d.hi; $('.he', hb).textContent = d.hiEn; hb.classList.add('on');
      setGo(go, d.name + ' 선배한테 물어볼래요', 'Ask ' + d.en, true);
    });
    voice(k + '-intro').then(function () { if (g === gen) row.classList.remove('playing'); });
  }
  function choose(k, by) {
    var g = gen, d = DATA.seniors[k];
    S.pick = k; S.by = by; S.stage = 'picked'; stopVoice(); sfx.tick(); buzz(12);
    $$('.row', bd).forEach(function (r) { r.classList.remove('cur', 'playing'); r.classList.add(r.dataset.k === k ? (by === 'me' ? 'mine' : 'hers') : 'rest'); r.classList.add('heard'); });
    hb.classList.remove('on'); go.classList.remove('on'); links.classList.add('off'); hint.classList.add('off');
    document.querySelectorAll('.steps li').forEach(function (li) { li.classList.toggle('on', Number(li.dataset.step) === 2); });
    $('.keep em', q).textContent = 'You can switch after you meet ' + d.en + '.';
    // 이름은 동그라미와 포스트잇에 이미 있으니 서하의 말에서는 되풀이하지 않는다(11-18 미학 맹검 2차: 강조가 세 번 겹친다)
    swapQ(q, by === 'me' ? '좋아요.' : '그럼,', '이 선배한테 물어봐요.', 'Okay. Ask ' + d.en + ' about school life.').then(function () { if (g === gen) $('.keep', q).hidden = false; });
    // 포스트잇은 고르지 않은 줄 쪽에 붙는다. 고른 줄(이름과 동그라미)은 덮지 않는다.
    pi.style.top = S.order.indexOf(k) === 0 ? '232px' : '88px';
    wait(900).then(function () { if (g !== gen) return; bd.classList.add('back'); board.classList.add('picked'); pi.classList.add('in'); sfx.paper(); return wait(620); })
      .then(function () { if (g !== gen) return; sfx.tack(); buzz(8); return wait(500); })
      .then(function () { if (g !== gen) return; $('.add b', pi).textContent = d.name + ' 선배랑'; $('.add', pi).classList.add('w'); sfx.pen(); return wait(1900); })
      .then(function () {
        if (g !== gen) return;
        setGo(go, '다음', 'Next');
        links.innerHTML = '<button type="button" data-act="again">다시 고를래요<small>Choose again</small></button>'; links.classList.remove('off');
      });
  }
  go.addEventListener('click', function () {
    if (S.stage === 'board' && S.cur) choose(S.cur, 'me');
    else if (S.stage === 'picked') {
      S.stage = 'told'; go.classList.remove('on'); links.classList.add('off'); $('.keep', q).hidden = true; sfx.tick();
      var g = gen; swapQ(q, '선배한테는 이것만 말할게요.', '“신입생이 와요.”', 'I will tell ' + senior().en + ' only this: “A new student is coming.”').then(function () { return wait(700); }).then(function () { if (g === gen) setGo(go, '다음', 'Next'); });
    } else if (S.stage === 'told') chapter();
  });
  links.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'again') { gen++; resetBoard(); }
    else if (b.dataset.act === 'seoha' && S.stage === 'board') choose(S.order[Math.random() < 0.5 ? 0 : 1], 'seoha');
  });
  $('.hk button', hb).addEventListener('click', function () { if (S.cur && S.stage === 'board') hear(S.cur); });

  // ── ② 일주일 뒤 → ③ 1화 식당 ──
  function chapter() {
    var g = ++gen, d = senior();
    $('#L-chap .mini i').textContent = d.name + ' 선배랑'; show('L-chap'); sfx.paper();
    wait(2300).then(function () { if (g === gen) episode(); });
  }
  $('#L-chap').addEventListener('click', function () { if ($('#L-chap').classList.contains('on')) episode(); });
  var ep = $('#L-ep'), mine = $('.mine', ep);
  function cap(ko, en) {
    $('.ko', ep).textContent = ko; $('.en', ep).textContent = en;
    if (ko) $('.cap', ep).animate([{ opacity: 0.25, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'ease-out' });
  }
  // 자막은 한 화면에 한 문장만 둔다. 문장마다 소리의 쉼에 맞춰 바꾼다.
  function capParts(parts, g) { parts.forEach(function (p) { setTimeout(function () { if (g === gen) cap(p[1], p[2]); }, p[0] * 1000); }); }
  function episode() {
    var g = ++gen, d = senior();
    S.stage = 'ep'; $('img.bg', ep).src = d.still; $('.tag', ep).textContent = '3학년 선배'; cap('', '');
    mine.classList.remove('on', 'saying', 'said'); $('.memo', ep).classList.remove('on'); $('.go', ep).classList.remove('on');
    $('.memo i', ep).textContent = d.name + ' 선배랑';
    show('L-ep');
    wait(900).then(function () { if (g !== gen) return; capParts(d.ep1Parts, g); return voice(S.pick + '-ep-01'); })
      .then(function (ok) { if (g !== gen || ok === false) return; return wait(350).then(function () { if (g === gen) { mine.classList.add('on'); sfx.tick(); } }); });
  }
  $('.mic', ep).addEventListener('click', function () {
    if (!mine.classList.contains('on') || mine.classList.contains('saying') || mine.classList.contains('said')) return;
    var g = gen, d = senior(); mine.classList.add('saying'); tone(523, 0.12); tone(659, 0.16, { at: 0.1 }); buzz(8);
    wait(40).then(function () { mine.classList.add('said'); return wait(1500); })
      .then(function () { if (g !== gen) return; tone(659, 0.1); tone(523, 0.14, { at: 0.09 }); mine.classList.remove('saying'); return wait(450); })
      .then(function () {
        if (g !== gen) return; mine.classList.remove('on'); capParts(d.ep2Parts, g);
        wait(d.nameAt).then(function () { if (g !== gen) return; $('.tag', ep).textContent = d.name + ' 선배'; $('.tag', ep).animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.3,1.5,.4,1)' }); $('.memo', ep).classList.add('on'); sfx.tack(); buzz(10); });
        return voice(S.pick + '-ep-02');
      })
      .then(function (ok) { if (g !== gen || ok === false) return; setGo($('.go', ep), '다음', 'Next'); });
  });
  $('.go', ep).addEventListener('click', function () { selfie(); });

  // ── ④ 식당 셀카 ──
  var snap = $('#L-snap');
  function selfie() {
    var g = ++gen, d = senior();
    S.stage = 'snap'; snap.classList.remove('dev'); $('.go', snap).classList.remove('on'); $('img', snap).src = d.selfie;
    show('L-snap');
    wait(650).then(function () {
      if (g !== gen) return; sfx.shutter(); buzz([10, 40, 16]);
      $('.flash', snap).animate([{ opacity: 0 }, { opacity: 0.92, offset: 0.2 }, { opacity: 0 }], { duration: 520, easing: 'ease-out' });
      snap.classList.add('dev'); return wait(3300);
    }).then(function () { if (g === gen) { sfx.done(); setGo($('.go', snap), '다음', 'Next'); } });
  }
  $('.go', snap).addEventListener('click', function () { today(); });

  // ── ⑤ 「오늘」 한 장 ──
  var td = $('#L-td');
  function today() {
    var g = ++gen, d = senior(), bub = $('.bub', td), line = $('.line', td), say = $('.say', td);
    S.stage = 'td'; $('.go', td).classList.remove('on'); say.classList.remove('speaking');
    bub.innerHTML = d.today.video ? '<video muted playsinline preload="auto" poster="' + d.today.poster + '" src="' + d.today.video + '"></video>' : '<img alt="" src="' + d.today.poster + '">';
    $('.whoo', td).textContent = d.name + ' 선배'; $('.len', td).textContent = d.todayEn;
    line.innerHTML = ''; d.todayLine.split(' ').forEach(function (w) { var s = document.createElement('span'); s.className = 'w'; s.textContent = w; line.append(s, ' '); });
    show('L-td'); sfx.paper();
    wait(900).then(function () {
      if (g !== gen) return;
      var ws = $$('.w', line), per = (DUR[S.pick + '-today'] || 3) * 1000 * 0.8 / ws.length, v = $('video', bub);
      say.classList.add('speaking'); if (v) { try { v.currentTime = 0; v.play().catch(function () { /* 막히면 정지 사진 */ }); } catch (e) { /* 정지 사진 */ } }
      ws.forEach(function (w, i) { setTimeout(function () { if (g === gen) w.classList.add('in'); }, 150 + i * per); });
      return voice(S.pick + '-today');
    }).then(function (ok) { if (g !== gen || ok === false) return; say.classList.remove('speaking'); setGo($('.go', td), '시작', 'Start'); });
  }
  $('.go', td).addEventListener('click', function () { start(); });

  // ── 첫 안(사진 카드 두 장) ──
  var A = $('#L-a');
  function firstDraft() {
    gen++; stopVoice(); S.variant = 'a'; S.stage = 'a1'; S.cur = null; S.pick = null;
    var cards = $('.cards', A); cards.innerHTML = '';
    S.order.forEach(function (k) {
      var d = DATA.seniors[k], b = document.createElement('button'); b.type = 'button'; b.className = 'cd'; b.dataset.k = k;
      b.innerHTML = '<img alt="" src="' + d.face + '"><p class="nm"></p><p class="it"></p>';
      $('.nm', b).innerHTML = ''; $('.nm', b).append(document.createTextNode(d.name)); var sm = document.createElement('small'); sm.textContent = '3학년'; $('.nm', b).append(sm);
      $('.it', b).textContent = d.introA;
      b.addEventListener('click', function () {
        if (S.stage !== 'a2') return; S.cur = k; sfx.paper();
        $$('.cd', A).forEach(function (c) { c.classList.toggle('cur', c === b); });
        $('.sub', A).classList.add('out'); $('.hk span', A).textContent = d.name + ' 선배의 인사'; $('.ht', A).textContent = d.hiA; $('.he', A).textContent = d.hiAEn; $('.heard-box', A).classList.add('on');
        setGo($('.go', A), d.name + ' 선배랑 먹을래요', 'Eat with ' + d.en, true);
      });
      cards.append(b);
    });
    $('.memo2 i', A).textContent = ''; $('.memo2 em', A).hidden = false; $('.heard-box', A).classList.remove('on'); $('.links', A).classList.add('off');
    $('.who b', A).textContent = '지호 · 학생회'; $('.who em', A).textContent = 'Jiho, student council'; $('.who i', A).hidden = true;
    $('.l1', A).textContent = '신입생은 첫날 같은 과'; $('.l2', A).textContent = '선배 한 명과 밥을 먹습니다. 규정상.'; $('.sub', A).textContent = 'New students eat with one senior on day one. It is the rule.';
    setGo($('.go', A), '다음', 'Next'); show('L-a');
  }
  $('.go', A).addEventListener('click', function () {
    var g = gen;
    if (S.stage === 'a1') {
      S.stage = 'a2'; $('.go', A).classList.remove('on'); sfx.tick();
      $('.who b', A).textContent = '서하 · 신입생 도우미'; $('.who em', A).textContent = 'Seoha, student helper'; $('.who i', A).hidden = false;
      swapQ($('.q', A), '우리 과 3학년 선배들이에요.', '누구랑 먹을래요?', 'These are our third-years. Who will you eat with?'); $('.links', A).classList.remove('off');
    } else if (S.stage === 'a2' && S.cur) {
      S.stage = 'a3'; S.pick = S.cur; var d = senior(); sfx.tick();
      $$('.cd', A).forEach(function (c) { c.classList.toggle('rest', c.dataset.k !== S.pick); });
      $('.heard-box', A).classList.remove('on'); $('.go', A).classList.remove('on'); $('.links', A).classList.add('off');
      swapQ($('.q', A), '좋아요.', '포스트잇에 적어 둘게요.', 'Okay. I will write it on the note.').then(function () { if (g !== gen) return; $('.memo2 em', A).hidden = true; $('.memo2 i', A).textContent = '— 3학년 ' + d.name; sfx.pen(); });
    }
  });
  $('.links', A).addEventListener('click', function (e) { if (e.target.closest('button') && S.stage === 'a2') { $$('.cd', A)[Math.random() < 0.5 ? 0 : 1].click(); } });

  // ── 시작 · 저절로 보기 · 건너뛰기 ──
  function shuffle() { S.order = Math.random() < 0.5 ? ['taeo', 'yuna'] : ['yuna', 'taeo']; var o = qs.get('order'); if (o === 'ty') S.order = ['taeo', 'yuna']; if (o === 'yt') S.order = ['yuna', 'taeo']; }
  function start() { gen++; stopVoice(); S.variant = 'b'; shuffle(); resetBoard(); }
  var autoGen = 0;
  function until(test, run, max) { var t0 = Date.now(); return new Promise(function (res) { (function loop() { if (run !== autoGen) return res(false); if (test()) return res(true); if (Date.now() - t0 > (max || 30000)) return res(false); setTimeout(loop, 120); })(); }); }
  // 저절로 보기: 남색 동그라미가 누를 자리를 짚고 실제 단추를 누른다. 다른 단추를 누르면 그 자리에서 그만둔다.
  function auto(pick) {
    var run = ++autoGen, other = pick === 'yuna' ? 'taeo' : 'yuna', row = function (k) { return $('.row[data-k="' + k + '"]', bd); };
    var tapWhen = function (test, el, pause) { return function () { return until(test, run).then(function (ok) { if (!ok) return; return wait(pause).then(function () { if (run === autoGen) return fakeTap(typeof el === 'function' ? el() : el); }); }); }; };
    var on = function (el) { return function () { return el.classList.contains('on'); }; };
    start();
    wait(1500).then(function () { if (run === autoGen) return fakeTap(row(other)); })
      .then(function () { return wait((DUR[other + '-intro'] || 3) * 1000 + 700); })
      .then(function () { if (run === autoGen) return fakeTap(row(pick)); })
      .then(function () { return wait((DUR[pick + '-intro'] || 3) * 1000 + 900); })
      .then(function () { if (run === autoGen) return fakeTap(go); })
      .then(tapWhen(function () { return S.stage === 'picked' && go.classList.contains('on'); }, go, 1300))
      .then(tapWhen(function () { return S.stage === 'told' && go.classList.contains('on'); }, go, 1500))
      .then(tapWhen(on(mine), $('.mic', ep), 900))
      .then(tapWhen(on($('.go', ep)), $('.go', ep), 1300))
      .then(tapWhen(on($('.go', snap)), $('.go', snap), 1600));
  }
  function autoA(pick) {
    var run = ++autoGen; shuffle(); firstDraft(); var g = gen;
    wait(2200).then(function () { if (g === gen) return fakeTap($('.go', A)); })
      .then(function () { return wait(1900); })
      .then(function () { if (g === gen) return fakeTap($$('.cd', A).filter(function (c) { return c.dataset.k !== pick; })[0]); })
      .then(function () { return wait(2600); })
      .then(function () { if (g === gen) return fakeTap($('.cd[data-k="' + pick + '"]', A)); })
      .then(function () { return wait(2600); })
      .then(function () { if (g === gen) return fakeTap($('.go', A)); });
  }
  function jump(step) {
    var k = S.pick || S.cur || 'yuna';
    if (step === 1) return start();
    gen++; stopVoice(); S.variant = 'b'; if (!S.order.length) shuffle();
    if (step === 2) { resetBoard(); choose(k, 'me'); return; }
    S.pick = k;
    if (step === 3) chapter(); else if (step === 4) selfie(); else if (step === 5) today();
  }

  var hud = $('#hud');
  function paintHud() { hud.classList.toggle('muted', !sound); hud.setAttribute('aria-label', sound ? '소리 끄기' : '소리 켜기'); hud.setAttribute('aria-pressed', String(sound)); }
  hud.addEventListener('click', function () { sound = !sound; if (!sound) stopVoice(); else sfx.tick(); paintHud(); });
  paintHud();
  document.querySelectorAll('[data-run]').forEach(function (b) {
    b.addEventListener('click', function () {
      var r = b.dataset.run; autoGen++;
      if (r === 'try') start(); else if (r === 'auto-yuna') auto('yuna'); else if (r === 'auto-taeo') auto('taeo'); else if (r === 'first') { shuffle(); firstDraft(); } else if (r.indexOf('step-') === 0) jump(Number(r.slice(5)));
      frame.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  });

  shuffle();
  if (qs.get('v') === 'a') { if (qs.get('auto')) autoA(qs.get('auto')); else firstDraft(); }
  else if (qs.get('auto')) auto(qs.get('auto') === 'taeo' ? 'taeo' : 'yuna');
  else if (qs.get('step')) { S.pick = qs.get('pick') === 'taeo' ? 'taeo' : 'yuna'; jump(Number(qs.get('step'))); }
  else resetBoard();
})();
