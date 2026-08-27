/* 살아 있는 몽글 — 홈페이지 히어로의 4D 깊이층 + 감정 어휘 (유호 지시 08-28)
 *
 * 🔑 어디서 왔나: `docs/캐릭터/생명공방_0826/살아움직이는몽글.html` 의 4D 층.
 *   그 지면이 하는 일은 한 줄로 이렇다 — **사진 한 장에서 픽셀마다 깊이(z)를 재고,
 *   시점이 움직이면 z 만큼 반대로 민다.** 눈은 z 가 커서(+0.30) «먼저» 움직이고,
 *   그 어긋남이 사람 눈에 「고개를 돌렸다」로 읽힌다. 3D 로 다시 만들지 않는다 —
 *   재질이 100% 정본 사진이라 펠트 털도 실땀도 원본 그대로다.
 *
 * ⚠ 그 층은 08-26 까지 **한 번도 돈 적이 없었다**(`const v` 한 줄이 없어 `ReferenceError` 로
 *   깊이 함수가 통째로 죽어 있었고, 구조 검사 열 개는 「있나」만 봐서 못 잡았다).
 *   그래서 이 파일에는 **자기가 도는지 말하는 자리**를 뒀다 — `window.몽글.상태()`.
 *   검사는 「함수가 있나」가 아니라 「z 가 실제로 갈리나」를 본다.
 *
 * 🔴 캔버스로 그린다 — `<img>` 로는 못 한다. 깊이만큼 «부분마다 다르게» 밀어야 하는데
 *   CSS transform 은 그림 «통째»로만 움직인다. 그래서 격자 칸마다 따로 그린다.
 *
 * 🔑 죽어도 안 깨진다 — WebGL 이 없거나 컷이 안 뜨면 **정지 사진이 그대로 남는다**
 *   (캔버스를 아예 안 켠다). 이 지면은 학부모가 처음 보는 화면이라 「빈 자리」가 있으면 안 된다.
 *
 * 붙이기: 마운트 요소에 `data-살아있음`, 그 안에 `<img data-컷="본체|눈감음|눈웃음|놀람">`.
 *   페이지가 감정을 부르는 통로 = `window.몽글.<어휘>()`.
 */
(function () {
  'use strict';

  var 방 = document.querySelector('[data-살아있음]');
  if (!방) return;
  var 컷들 = {};
  Array.prototype.forEach.call(방.querySelectorAll('[data-컷]'), function (el) {
    컷들[el.getAttribute('data-컷')] = el;
  });
  if (!컷들['본체']) return;

  var 바탕 = 컷들['본체'];                       // WebGL 이 서면 숨고, 안 서면 이게 남는다
  var cv = document.createElement('canvas');
  cv.className = '살아있음';
  cv.setAttribute('aria-hidden', 'true');
  방.appendChild(cv);

  var gl = null;
  try {
    gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true });
  } catch (e) { gl = null; }
  if (!gl) { cv.remove(); return; }               // 조용히 사진으로 산다

  var N = 28;                                     // 격자 칸 수 — Live2D 의 «메시»에 해당
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 셰이더 ─────────────────────────────────────────────────
   * aShade = 정점의 «빛» — 깊이 기울기와 시점의 내적. 사진에 곱하기만 한다(색을 안 바꾼다). */
  var vs = 'attribute vec2 aPos; attribute vec2 aUV; attribute float aShade;'
    + 'varying vec2 vUV; varying float vShade;'
    + 'void main(){ vUV = aUV; vShade = aShade; gl_Position = vec4(aPos, 0.0, 1.0); }';
  var fs = 'precision mediump float; varying vec2 vUV; varying float vShade;'
    + 'uniform sampler2D uTex;'
    + 'void main(){ vec4 c = texture2D(uTex, vUV); gl_FragColor = vec4(c.rgb * vShade, c.a); }';
  function 셰이더(t, src) { var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  var prog = gl.createProgram();
  gl.attachShader(prog, 셰이더(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, 셰이더(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { cv.remove(); return; }
  gl.useProgram(prog);
  var aPos = gl.getAttribLocation(prog, 'aPos');
  var aUV = gl.getAttribLocation(prog, 'aUV');
  var aShade = gl.getAttribLocation(prog, 'aShade');

  /* 격자 — uv 와 인덱스는 고정, 위치만 매 프레임 다시 쓴다 */
  var uvArr = [], idx = [], i, j;
  for (j = 0; j <= N; j++) for (i = 0; i <= N; i++) uvArr.push(i / N, j / N);
  for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
    var a0 = j * (N + 1) + i, b0 = a0 + 1, c0 = a0 + N + 1, d0 = c0 + 1;
    idx.push(a0, b0, c0, b0, d0, c0);
  }
  var 정점수 = (N + 1) * (N + 1);
  var posArr = new Float32Array(정점수 * 2);
  var zArr = new Float32Array(정점수);
  var gxArr = new Float32Array(정점수);
  var gyArr = new Float32Array(정점수);
  var shArr = new Float32Array(정점수);
  var 깊이있음 = false;
  var posBuf = gl.createBuffer(), uvBuf = gl.createBuffer(),
      idxBuf = gl.createBuffer(), shBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvArr), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);

  /* ── 텍스처 — 컷이 몇 장이든 «있는 것만» 쓴다(없는 어휘는 조용히 본체로 접힌다) ──
   * 🔴 **거는 자리는 이 파일 맨 끝이다.** 여기서 걸면 안 된다 —
   *   자립형 판은 그림이 data URI 라 `img.complete` 가 «파싱 시점에 이미 true» 다.
   *   그러면 로딩 콜백이 아니라 **그 자리에서 바로** 켜기()→그리기()→격자() 가 돌고,
   *   격자가 쓰는 상태 `S` 는 아직 아래에서 선언되기 «전»이라 `S.기울임` 이 TypeError 로 죽는다.
   *   그 예외가 IIFE 를 통째로 끊어 `window.몽글` 이 아예 안 서고, 화면에는 **캔버스만 빈 채로**
   *   남는다(08-28 실측 — 탐침이 `캔버스 360x360 · API false · 오류 0` 을 냈다. 오류가 0인 것은
   *   지면의 오류 수집기가 그 «전»에 죽은 사건을 못 봤기 때문이다).
   *   ⇒ 원판(생명공방 지면)은 그림이 늦게 오는 순서라 이 함정이 안 드러났다. 자립형이 그것을 바꾼다. */
  var tex = {}, 준비 = 0, 컷수 = Object.keys(컷들).length;
  function 컷싣기() {
    Object.keys(컷들).forEach(function (k) {
      var im = 컷들[k];
      function 심기() {
        var t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        tex[k] = t; 준비++;
        if (k === '본체') 깊이재기(im);    // 깊이는 «본체» 한 장에서만 — 표정이 바뀌어도 몸은 같다
        if (준비 >= 컷수) 켜기();
      }
      if (im.complete && im.naturalWidth) 심기();
      else { im.addEventListener('load', 심기); im.addEventListener('error', function () { 컷수--; if (준비 >= 컷수) 켜기(); }); }
    });
  }

  /* ── 깊이 — 사진 알파에서 «역산»한다 ────────────────────────
   * 몸이 회전체(돔)에 가까우면, 어느 행이든 가로 반폭 hw 를 알면 그 행의 단면은 반지름 hw 인 원이다.
   * ⇒ z = √(1 − (dx/hw)²). 지어낸 값이 아니라 형태에서 «따라 나오는» 값이다 — 몽글은 돔 자체라 잘 맞는다.
   * 눈은 검은 유리 구슬이라 «몸 색에서 가장 먼 작은 영역»으로 찾아 앞으로 끌어낸다(+0.30).
   * 색을 박아 두지 않는 것이 핵심 — 몸 색 «중앙값»과의 거리로 재면 캐릭터가 바뀌어도 따라간다. */
  function 깊이재기(img) {
    var P = 256, c = document.createElement('canvas');
    c.width = c.height = P;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, P, P);
    var d;
    try { d = ctx.getImageData(0, 0, P, P).data; }
    catch (e) { return; }                          // 교차출처 오염 — 깊이 없이 «평면»으로 산다
    var rs = [], gs = [], bs = [], t;
    for (t = 3; t < d.length; t += 4 * 7) {
      if (d[t] > 60) { rs.push(d[t - 3]); gs.push(d[t - 2]); bs.push(d[t - 1]); }
    }
    function 중앙(arr) { if (!arr.length) return 128; arr.sort(function (x, y) { return x - y; }); return arr[arr.length >> 1]; }
    var 몸색 = [중앙(rs), 중앙(gs), 중앙(bs)];
    var 눈문턱 = 78;
    var k = 0, jj, ii;
    for (jj = 0; jj <= N; jj++) {
      var py = Math.min(P - 1, Math.round((1 - jj / N) * (P - 1)));   // v=0 이 바닥
      var v = jj / N;                              // 🔴 이 한 줄이 08-26 까지 «없어서» 4D 가 통째로 죽어 있었다
      var L = -1, R = -1, x;
      for (x = 0; x < P; x++) if (d[(py * P + x) * 4 + 3] > 60) { if (L < 0) L = x; R = x; }
      var cx = (L + R) / 2, hw = Math.max(1, (R - L) / 2);
      for (ii = 0; ii <= N; ii++) {
        var px = Math.min(P - 1, Math.round((ii / N) * (P - 1)));
        var o = (py * P + px) * 4, z = 0;
        if (L >= 0 && d[o + 3] > 60) {
          var s = (px - cx) / hw;
          z = Math.sqrt(Math.max(0, 1 - s * s));
          if (v >= 0.50 && v <= 0.92) {            // 얼굴 높이로 좁힌다 — 치맛단 실땀이 눈으로 안 잡히게
            var dr = d[o] - 몸색[0], dg = d[o + 1] - 몸색[1], db = d[o + 2] - 몸색[2];
            if (Math.sqrt(dr * dr + dg * dg + db * db) > 눈문턱) z += 0.30;
          }
        }
        zArr[k++] = z;
      }
    }
    // 법선 대신 «기울기»를 미리 잰다 — 시점이 움직일 때만 음영이 변하게 쓴다(정지하면 사진 그대로)
    for (jj = 0; jj <= N; jj++) for (ii = 0; ii <= N; ii++) {
      var b = jj * (N + 1) + ii;
      gxArr[b] = (zArr[jj * (N + 1) + Math.min(N, ii + 1)] - zArr[jj * (N + 1) + Math.max(0, ii - 1)]) * 0.5;
      gyArr[b] = (zArr[Math.min(N, jj + 1) * (N + 1) + ii] - zArr[Math.max(0, jj - 1) * (N + 1) + ii]) * 0.5;
    }
    깊이있음 = true;
  }

  /* ── 상태 — «생명감 상태 기계에 rAF 금지». 상태는 타이머, 그림은 rAF. ── */
  var S = {
    컷: '본체', 눈감은동안: 0,
    기울임: 0, 목표기울임: 0, 눌림: 0, 되튐속도: 0, 살랑: 0, 갸웃: 0, 도리: 0,
    잠: 0, 커짐: 0, 마지막접촉: 0, 연타: [],
    시점x: 0, 시점y: 0, 목표시점x: 0, 목표시점y: 0, 자동시점: 1
  };
  var now = function () { return performance.now(); };
  S.마지막접촉 = now();
  var 다음깜빡 = now() + 3500 + Math.random() * 3500;

  function 있는컷(k) { return tex[k] ? k : '본체'; }
  function 만짐() { S.마지막접촉 = now(); if (S.잠) 어휘.기지개(); }
  function 깜빡(ms) { S.컷 = 있는컷('눈감음'); S.눈감은동안 = ms || 130; }

  /* ── 감정 어휘 — 페이지가 부르는 통로 ───────────────────────
   * 🔑 세기를 만질 자리는 여기 하나다. 「늘 도는」 것(숨·시점)은 아래 격자에 있고,
   *   여기 있는 것은 전부 «사건»이다 — 크고 짧게 일어나 감쇠로 사라진다(멀미의 축은 상시 쪽이다). */
  var 어휘 = {
    톡: function () { S.눌림 = 0.30; 깜빡(); if (Math.random() < 0.35) S.갸웃 = 0.13; },
    되튐: function () { S.눌림 = 0.42; S.되튐속도 = 0; },
    갸웃: function () { S.갸웃 = 0.17; },
    도리도리: function () { S.도리 = 1; },
    살랑: function (켬) { S.살랑 = (켬 === undefined ? (S.살랑 > 0.05 ? 0 : 1) : (켬 ? 1 : 0)); },
    깜빡: function () { 깜빡(150); },
    기쁨: function () { S.컷 = 있는컷('눈웃음'); S.눈감은동안 = 1500; S.눌림 = -0.22; S.되튐속도 = 0.055; },
    놀람: function () { S.컷 = 있는컷('놀람'); S.눈감은동안 = 700; S.커짐 = 0.16; S.눌림 = -0.14; },
    간지럼: function () { S.도리 = 1; S.눌림 = 0.22; },
    잠: function () { S.잠 = 1; S.컷 = 있는컷('눈감음'); S.눈감은동안 = 1e9; },
    기지개: function () { S.잠 = 0; S.커짐 = 0.10; S.눈감은동안 = 0; S.컷 = '본체'; },
    평상: function () {
      S.잠 = 0; S.살랑 = 0; S.갸웃 = 0; S.도리 = 0; S.눌림 = 0; S.되튐속도 = 0;
      S.목표기울임 = 0; S.커짐 = 0; S.컷 = '본체'; S.눈감은동안 = 0;
    },
    /** 시점을 화면 좌표로 민다 — 페이지 어디서든 마스코트가 «그쪽을 본다». */
    본다: function (x, y) { S.자동시점 = 0; S.목표시점x = x; S.목표시점y = y; 만짐(); },
    놓는다: function () { S.자동시점 = 1; },
    /** 「도나」를 말하는 자리 — 있나가 아니라. 검사·콘솔에서 부른다. */
    상태: function () {
      var 최대 = 0, 산것 = 0, n;
      for (n = 0; n < zArr.length; n++) { if (zArr[n] > 0) 산것++; if (zArr[n] > 최대) 최대 = zArr[n]; }
      return { 깊이있음: 깊이있음, z최대: +최대.toFixed(3), 몸칸: 산것, 칸: zArr.length,
               컷: Object.keys(tex), 지금컷: S.컷, 프레임: 그린프레임, 잠: !!S.잠 };
    }
  };
  window.몽글 = 어휘;

  /* 만지기 — 마스코트 자체를 누르는 자리 */
  var 누름 = false;
  function 가로(e) { var r = 방.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 2 - 1; }
  방.addEventListener('pointerdown', function (e) {
    누름 = true; 만짐();
    S.눌림 = Math.max(S.눌림, 0.26); S.목표기울임 = 가로(e) * 0.16;
    var t = now();
    S.연타 = S.연타.filter(function (x) { return t - x < 1600; });
    S.연타.push(t);
    if (S.연타.length >= 3) { 어휘.간지럼(); S.연타 = []; } else 어휘.놀람();
  });
  방.addEventListener('pointermove', function (e) { if (누름) { S.목표기울임 = 가로(e) * 0.20; 만짐(); } });
  방.addEventListener('pointerenter', function () { 어휘.갸웃(); 만짐(); });
  addEventListener('pointerup', function () { if (!누름) return; 누름 = false; S.목표기울임 = 0; S.되튐속도 = 0.03; });
  addEventListener('pointercancel', function () { 누름 = false; S.목표기울임 = 0; });

  /* 상태 tick — 100ms 타이머(rAF 아님). rAF 는 숨은 탭에서 안 돈다. */
  setInterval(function () {
    var t = now();
    if (S.눈감은동안 > 0 && S.눈감은동안 < 1e8) {
      S.눈감은동안 -= 100;
      if (S.눈감은동안 <= 0) S.컷 = '본체';
    }
    if (!S.잠 && S.컷 === '본체' && t > 다음깜빡) { 깜빡(); 다음깜빡 = t + 3500 + Math.random() * 3500; }
    if (!S.잠 && t - S.마지막접촉 > 22000) 어휘.잠();
  }, 100);

  /* ── 그림 ───────────────────────────────────────────────── */
  function 격자(t) {
    S.기울임 += (S.목표기울임 - S.기울임) * 0.14;
    S.갸웃 *= 0.90; S.도리 *= 0.90; S.커짐 *= 0.90;
    S.되튐속도 += -S.눌림 * 0.22; S.되튐속도 *= 0.86; S.눌림 += S.되튐속도;
    if (Math.abs(S.눌림) < 0.0015 && Math.abs(S.되튐속도) < 0.0015) { S.눌림 = 0; S.되튐속도 = 0; }

    var 잠깊이 = S.잠 ? 1 : 0;
    var 숨주기 = 5.4 * (잠깊이 ? 1.7 : 1);           // 잘 때 숨이 느려진다
    var 숨 = reduce ? 0 : 0.022 * (잠깊이 ? 0.6 : 1) * Math.sin(t / 숨주기 * Math.PI * 2);
    var 살랑량 = reduce ? 0 : S.살랑 * 0.035 * Math.sin(t / 4.6 * Math.PI * 2);
    var 도리각 = S.도리 * 0.13 * Math.sin(t * 22);
    var 기울 = S.기울임 + 살랑량;
    var 각 = S.갸웃 * Math.sin(t * 9) + 도리각;
    var 커짐 = 1 + S.커짐;

    /* 4D 층 — 아무도 안 건드리면 아주 느린 원운동이 돈다.
       «거기 있다»는 느낌은 정지가 아니라 미세한 시차에서 온다. 손이 오면 그쪽이 이긴다. */
    if (S.자동시점 && !reduce) {
      S.목표시점x = Math.cos(t / 11 * Math.PI * 2) * 0.30;
      S.목표시점y = Math.sin(t / 14 * Math.PI * 2) * 0.18;
    }
    S.시점x += (S.목표시점x - S.시점x) * 0.06;
    S.시점y += (S.목표시점y - S.시점y) * 0.06;
    var 시차 = reduce ? 0 : 0.055;                  // 넘기면 사진이 «고무»로 읽힌다
    var 빛세기 = reduce ? 0 : 0.42;                 // 정지(시점 0)면 곱이 1 = 사진 그대로

    var k = 0, s = 0, jj, ii;
    for (jj = 0; jj <= N; jj++) {
      var v = jj / N;
      var h = Math.pow(v, 1.45);                    // 높이 가중치 — 아래는 고정, 위로 갈수록 크게
      for (ii = 0; ii <= N; ii++) {
        var u = ii / N;
        var x = (u - 0.5) * 2, y = (v - 0.5) * 2;

        // 숨쉬기 · 눌림 — 세로는 줄고 가로는 늘어난다(부피 보존의 흉내 = 젤리)
        y = -1 + (y + 1) * ((1 + 숨) * (1 - S.눌림 * 0.30));
        x *= (1 - 숨 * 0.5) * (1 + S.눌림 * 0.34);
        x += 기울 * h;                              // 기울임 · 살랑 — 위쪽만

        if (각) {                                   // 갸웃 · 도리도리 — 바닥을 축으로 회전
          var A = 각 * h, sa = Math.sin(A), ca = Math.cos(A), y0 = y + 1;
          var nx = x * ca - y0 * sa, ny = x * sa + y0 * ca;
          x = nx; y = ny - 1;
        }
        x *= 커짐; y = -1 + (y + 1) * 커짐;          // 놀람 — 전체 확대

        var b = jj * (N + 1) + ii;
        if (깊이있음) {
          x += S.시점x * zArr[b] * 시차;
          y += S.시점y * zArr[b] * 시차;
          shArr[s++] = 1 + (gxArr[b] * S.시점x + gyArr[b] * S.시점y) * 빛세기;
        } else shArr[s++] = 1;

        posArr[k++] = x * 0.94;
        posArr[k++] = y * 0.94;
      }
    }
  }

  function 크기맞춤() {
    var r = 방.getBoundingClientRect();
    if (!r.width) return;
    var dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    gl.viewport(0, 0, cv.width, cv.height);
  }

  var t0 = now(), 그린프레임 = 0, 켜졌나 = false;
  function 그리기(t) {
    if (준비 < 컷수 || !tex['본체']) return;
    격자(t);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, posArr, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.enableVertexAttribArray(aUV); gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, shBuf);
    gl.bufferData(gl.ARRAY_BUFFER, shArr, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(aShade); gl.vertexAttribPointer(aShade, 1, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, tex[S.컷] || tex['본체']);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    그린프레임++;
  }

  /* 🔑 첫 프레임을 «그린 뒤에» 사진을 숨긴다 — 순서를 바꾸면 한 프레임 동안 빈 자리가 번쩍인다. */
  function 켜기() {
    if (켜졌나) return;
    크기맞춤();
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    그리기(0);
    if (!그린프레임) { cv.remove(); return; }        // 한 장도 못 그렸으면 사진으로 되돌린다
    켜졌나 = true;
    방.classList.add('살아있음-켬');
    /* 🔑 지면이 «엔진이 섰다»를 알아야 CSS 숨쉬기를 끌 수 있다 — 안 끄면 숨을 두 번 쉰다
     *   (엔진의 숨 5.4초 + CSS breathe 6초가 서로 맞물려 «울렁»으로 읽힌다). */
    document.documentElement.classList.add('몽글-살아있음');
    바탕.style.visibility = 'hidden';
    addEventListener('resize', 크기맞춤);
    (function 프레임() { 그리기((now() - t0) / 1000); requestAnimationFrame(프레임); })();
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) 그리기((now() - t0) / 1000);
    });
  }

  /* 🔑 여기가 «시동»이다 — 위의 모든 선언이 끝난 뒤라야 켜기()가 안전하게 돈다.
   *   (자립형의 data URI 는 즉시 complete 라 이 줄이 그 자리에서 첫 프레임까지 그린다.) */
  컷싣기();
})();
