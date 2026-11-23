/* 화면 글 검사(tools/화면글검사.js)가 Remotion 묶음 맨 앞에 끼우는 페이지 쪽 스크립트(2026-11-23).
 * Remotion이 한 프레임을 다 그렸다고 표시하는 순간(window.remotion_renderReady = true)에 화면에 보이는 글 덩이를
 * 「__SYNK_TEXT__{…}」 한 줄로 콘솔에 낸다. 검사 도구가 renderFrames의 onBrowserLog로 받는다. 편 코드는 바꾸지 않는다.
 *
 * 글 덩이: 글 마디(text node)를 가장 가까운 블록 조상(display가 inline · contents가 아닌 요소)으로 묶는다 — 한 낱말을 글자마다
 *   다른 색 span으로 칠한 꼴(물개의 tint)도 한 덩이가 된다. 덩이마다 글 · 자리(뷰포트 px) · 보이는 정도(조상 opacity의 곱을 글자 수로 가중한 평균) ·
 *   글자 크기 · 색을 적는다. display:none · visibility:hidden · 화면 밖 · 0 크기는 뺀다.
 *   옅은 마디(보이는 정도 FAINT 아래 — 판정의 VISIBLE과 같은 0.5)는 같은 블록의 짙은 마디와 따로 한 덩이로 적는다. 옅은 느낌표 하나가 본문의 글을
 *   「한국어!」로 바꿔 본문이 새로 뜬 것처럼 읽히거나 본문을 숨긴 것으로 읽히지 않게(GPT 검수 GA8 · 다시 GA10). 옅은 덩이는 판정이 읽지 않고,
 *   원본 대조가 그 장의 글 자리로만 쓴다.
 * 못 보는 것: overflow · clip-path로 가린 글(타자 치듯 드러내는 가림), 색의 알파로만 숨긴 글, 그림 · 영상에 구워 넣은 글.
 * 의지하는 Remotion 내부 이름: window.remotion_setFrame(프레임, 틀, 시도) · window.remotion_renderReady(4.0.535에서 확인).
 *   이름이 바뀌면 덩이가 하나도 안 나오고, 검사 도구가 「못잼」으로 알린다.
 */
(function () {
  if (typeof window === 'undefined' || window.__synkTextHook) return;
  window.__synkTextHook = true;
  var lastFrame = null;
  var FAINT = 0.5;
  var setFrameFn;
  Object.defineProperty(window, 'remotion_setFrame', {
    configurable: true,
    get: function () { return setFrameFn && function (f, c, a) { lastFrame = f; return setFrameFn(f, c, a); }; },
    set: function (fn) { setFrameFn = fn; },
  });
  function blockOf(el) {
    while (el && el !== document.body) {
      var d = getComputedStyle(el).display;
      if (d !== 'inline' && d !== 'contents') return el;
      el = el.parentElement;
    }
    return document.body;
  }
  function opacityOf(el) {
    var o = 1;
    while (el && el.nodeType === 1) {
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
      o *= parseFloat(cs.opacity || '1');
      el = el.parentElement;
    }
    return o;
  }
  function dump() {
    if (lastFrame === null) return;
    var W = window.innerWidth, H = window.innerHeight;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var blocks = new Map();
    var faint = new Map();
    var n;
    while ((n = walker.nextNode())) {
      var t = n.nodeValue;
      if (!t || !t.trim()) continue;
      var p = n.parentElement;
      if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TITLE|TEMPLATE)$/.test(p.tagName)) continue;
      var r = document.createRange();
      r.selectNodeContents(n);
      var rect = r.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      if (rect.right < 0 || rect.bottom < 0 || rect.left > W || rect.top > H) continue;
      var op = opacityOf(p);
      if (op <= 0) continue;
      var cs = getComputedStyle(p);
      var b = blockOf(p);
      var 덩이들 = op < FAINT ? faint : blocks;
      var e = 덩이들.get(b);
      var size = parseFloat(cs.fontSize) || 0;
      var len = t.trim().length;
      var gap = '';
      if (!e) {
        e = { t: '', x0: rect.left, y0: rect.top, x1: rect.right, y1: rect.bottom, os: 0, ol: 0, fs: size, c: cs.color, cl: len };
        덩이들.set(b, e);
      } else {
        // 띄어쓰기 없이 따로 놓은 조각(「모자를」 · 「써요」를 span 둘로 띄운 꼴)은 화면에 틈이 있거나 줄이 바뀌면 띄어 쓴다.
        // 틈은 화면에 그려진 줄 높이로 잰다 — 튀어나오며 작게 그려진 장에서 글자 크기로 재면 틈을 놓쳐 「나이를먹어요!」가 됐다(11-23 먹어요 편)
        var last = e.last;
        var unit = Math.min(size || 1e9, rect.bottom - rect.top);
        if (last && (rect.left - last.right > unit * 0.15 || rect.top >= last.bottom - 1)) gap = ' ';
        e.x0 = Math.min(e.x0, rect.left); e.y0 = Math.min(e.y0, rect.top);
        e.x1 = Math.max(e.x1, rect.right); e.y1 = Math.max(e.y1, rect.bottom);
        e.fs = Math.max(e.fs, size);
        if (len > e.cl) { e.c = cs.color; e.cl = len; }
      }
      e.os += op * Math.max(1, len); e.ol += Math.max(1, len);
      e.t += gap + t;
      e.last = { right: rect.right, top: rect.top, bottom: rect.bottom };
    }
    var out = [];
    function put(e) {
      var txt = e.t.replace(/\s+/g, ' ').trim();
      // 보이는 정도는 내려 적는다 — 반올림하면 0.497인 옅은 덩이가 0.50으로 판정 문턱을 넘는다(GPT 다시 검수 3회차 GA5)
      if (txt) out.push({ t: txt, b: [Math.round(e.x0), Math.round(e.y0), Math.round(e.x1), Math.round(e.y1)], o: Math.floor((e.ol ? e.os / e.ol : 0) * 100) / 100, fs: Math.round(e.fs), c: e.c });
    }
    blocks.forEach(put);
    faint.forEach(put);
    console.log('__SYNK_TEXT__' + JSON.stringify({ f: lastFrame, w: W, h: H, items: out }));
  }
  var ready = false;
  Object.defineProperty(window, 'remotion_renderReady', {
    configurable: true,
    get: function () { return ready; },
    set: function (v) {
      ready = v;
      if (v === true) { try { dump(); } catch (err) { console.log('__SYNK_TEXT_ERR__' + String(err && err.message)); } }
    },
  });
})();
