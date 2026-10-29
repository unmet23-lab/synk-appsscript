/* 목소리 깨짐 셈 — 같은 글을 목소리 후보마다 만든 파일에서, 모음 프레임의 배음이 흩어진(지지직 깨지는) 비율과 최고 음높이를 잰다.
 * 원본 셈: SYNK-appsscript/tools/목소리엉킴.py(2026-10-28)와 synk.im/prompts/#voice-crackle-check의 요청문. 숫자가 그 둘과 같게 줄마다 옮겼다.
 *   깨짐 %: 모노 16kHz, 40ms Hann 창을 10ms씩. 창을 씌운 RMS가 최대 진폭의 12% 아래면 뺀다. 자기상관(0 지연으로 나눔)의 90~600Hz 지연 중
 *          가장 큰 자리를 기본 주파수로(보간 없음), 그 값이 0.3 아래면 뺀다. 4096점 FFT로 80~5000Hz 에너지 중 배음(정수배 ±12%) 밖 비율을 내고,
 *          0.35를 넘는 창이 모음 창 중 몇 %인지 센다.
 *   최고 음높이: 48kHz로 따로 읽어 YIN(문턱 0.1, 120~850Hz, 40ms 창을 10ms씩, 포물선 보간). 이어진 세 창이 2반음 안에서 고른 자리의 가운데 값 중 가장 높은 값.
 * 파일은 서버로 보내지 않는다. 같은 입력에는 늘 같은 결과. 브라우저(window·Worker)와 Node(시험)에서 같이 쓴다.
 */
(function (root) {
  'use strict';

  var SR = 16000;
  var LIMIT = 0.35;          // 배음 밖 비율이 이보다 크면 「깨진 창」
  var PASS_CRACKLE = 5;      // 깨짐 % 이 아래
  var PASS_PITCH = 560;      // 최고 음높이 Hz 이 아래 — 600Hz 안팎부터 목소리가 뒤집혀 깨졌다(10-28 귀로 들은 판들)
  var LOW_VOICE = 165;       // 가운데 기본 주파수가 이 아래인 낮은 목소리는 멀쩡해도 깨짐 %가 높게 나와 판정하지 않는다

  // np.hanning(n): 양끝이 0인 대칭 창
  function hann(n) {
    var w = new Float64Array(n);
    for (var k = 0; k < n; k++) w[k] = 0.5 - 0.5 * Math.cos(2 * Math.PI * k / (n - 1));
    return w;
  }

  // 길이 n(2의 거듭제곱) 복소 FFT, 제자리
  function fftTables(n) {
    var rev = new Uint32Array(n), bits = Math.round(Math.log2(n));
    for (var i = 0; i < n; i++) { var r = 0; for (var b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
    var cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
    for (var k = 0; k < n / 2; k++) { cos[k] = Math.cos(-2 * Math.PI * k / n); sin[k] = Math.sin(-2 * Math.PI * k / n); }
    return { n: n, rev: rev, cos: cos, sin: sin };
  }
  function fft(re, im, t) {
    var n = t.n, i, j, tmp;
    for (i = 0; i < n; i++) { j = t.rev[i]; if (j > i) { tmp = re[i]; re[i] = re[j]; re[j] = tmp; tmp = im[i]; im[i] = im[j]; im[j] = tmp; } }
    for (var size = 2; size <= n; size <<= 1) {
      var half = size >> 1, step = n / size;
      for (var s = 0; s < n; s += size) {
        for (var k = 0; k < half; k++) {
          var wr = t.cos[k * step], wi = t.sin[k * step], a = s + k, b = a + half;
          var xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        }
      }
    }
  }

  function bessel0(x) {
    var s = 1, t = 1;
    for (var k = 1; k < 60; k++) { t *= (x / (2 * k)) * (x / (2 * k)); s += t; if (t < 1e-14 * s) break; }
    return s;
  }

  // 48kHz → 16kHz. ffmpeg 기본 변환(swresample: filter_size 32 · 차단 0.97 · Kaiser β 9)과 같은 꼴의 99탭 저역 필터로 셋에 하나를 고른다.
  // 브라우저마다 다른 16kHz 변환 대신 이 셈을 쓰면 48kHz 원본은 파이썬(ffmpeg -ar 16000)과 같은 창 수가 나온다(예시 둘 53 · 71, 시험).
  var DECIMATE = (function () {
    var taps = 99, m = 49, beta = 9, fc = 0.97 / 3, h = new Float64Array(taps), sum = 0;
    for (var j = 0; j < taps; j++) {
      var t = j - m, s = t === 0 ? 1 : Math.sin(Math.PI * fc * t) / (Math.PI * fc * t);
      h[j] = s * bessel0(beta * Math.sqrt(Math.max(0, 1 - (t / (m + 0.5)) * (t / (m + 0.5))))) / bessel0(beta);
      sum += h[j];
    }
    for (j = 0; j < taps; j++) h[j] /= sum;
    return { h: h, m: m };
  })();
  function decimate3(x) {
    var h = DECIMATE.h, m = DECIMATE.m, n = Math.ceil(x.length / 3), y = new Float32Array(n);
    for (var k = 0; k < n; k++) {
      var s = 0, c0 = 3 * k - m, j0 = Math.max(0, -c0), j1 = Math.min(h.length, x.length - c0);
      for (var j = j0; j < j1; j++) s += h[j] * x[c0 + j];
      y[k] = s;
    }
    return y;
  }

  function peak(x) {
    var p = 0;
    for (var i = 0; i < x.length; i++) { var a = Math.abs(x[i]); if (a > p) p = a; }
    return p;
  }

  function median(v) {
    var s = Array.prototype.slice.call(v).sort(function (a, b) { return a - b; }), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // [{t: 초, ratio: 배음 밖 비율, f0}] — 큰 소리의 모음 프레임만(목소리엉킴.py analyse)
  function analyse(x) {
    var n = 640, hop = 160, nfft = 4096, w = hann(n), tables = fftTables(nfft);
    var pk = peak(x) + 1e-9;
    var lo = Math.floor(SR / 600), hi = Math.floor(SR / 90);
    var seg = new Float64Array(n), re = new Float64Array(nfft), im = new Float64Array(nfft);
    var kLo = 0, kHi = nfft / 2;
    // 80 < fq < 5000 인 칸
    while (kLo * SR / nfft <= 80) kLo++;
    while (kHi * SR / nfft >= 5000) kHi--;
    var out = [];
    for (var i = 0; i < x.length - n; i += hop) {
      var e = 0, j, k;
      for (j = 0; j < n; j++) { seg[j] = x[i + j] * w[j]; e += seg[j] * seg[j]; }
      if (Math.sqrt(e / n) < pk * 0.12) continue;
      // 자기상관: 0 지연과 lo..hi-1 지연만 있으면 된다(np.argmax는 같은 값이면 앞 자리)
      var bestK = lo, best = -Infinity;
      for (k = lo; k < hi; k++) {
        var s = 0;
        for (j = 0; j + k < n; j++) s += seg[j] * seg[j + k];
        if (s > best) { best = s; bestK = k; }
      }
      var r = best / (e + 1e-12);
      if (r < 0.3) continue;
      var f0 = SR / bestK;
      re.fill(0); im.fill(0);
      re.set(seg);
      fft(re, im, tables);
      var all = 0, near = 0;
      for (k = kLo; k <= kHi; k++) {
        var p = re[k] * re[k] + im[k] * im[k], h = (k * SR / nfft) / f0, m = Math.round(h);
        all += p;
        if (m >= 1 && Math.abs(h - m) < 0.12) near += p;
      }
      out.push({ t: i / SR, ratio: 1 - near / all, f0: f0 });
    }
    return out;
  }

  // YIN 최고 음높이(Hz) 또는 null(목소리엉킴.py top_pitch, 48kHz)
  function topPitch(x, sr, onProgress) {
    sr = sr || 48000;
    var fmin = 120, fmax = 850, w = 1920, hop = 480, th = 0.1;
    var tmin = Math.floor(sr / fmax), tmax = Math.floor(sr / fmin);
    var pk = peak(x) + 1e-9;
    if (pk < 1e-4) return null;
    var d = new Float64Array(tmax + 2), dn = new Float64Array(tmax + 2);
    var track = [], end = x.length - w - tmax - 2;
    for (var i = 0; i < end; i += hop) {
      if (onProgress && track.length % 200 === 0) onProgress(i / end);
      track.push(null);
      var e = 0, j, t;
      for (j = 0; j < w; j++) e += x[i + j] * x[i + j];
      if (Math.sqrt(e / w) < pk * 0.12) continue;
      for (t = 0; t < tmax + 2; t++) {
        var s = 0;
        for (j = 0; j < w; j++) { var df = x[i + j] - x[i + t + j]; s += df * df; }
        d[t] = s;
      }
      dn[0] = 1;
      var cum = 0;
      for (t = 1; t < tmax + 2; t++) { cum += d[t]; dn[t] = d[t] * t / (cum + 1e-12); }
      var c = -1;
      for (t = tmin; t < tmax; t++) if (dn[t] < th) { c = t; break; }
      if (c < 0) continue;
      while (c + 1 < tmax && dn[c + 1] < dn[c]) c++;
      var a = dn[c - 1], b = dn[c], cc = dn[c + 1];
      track[track.length - 1] = sr / (c + 0.5 * (a - cc) / (a - 2 * b + cc + 1e-12));
    }
    var top = null, limit = Math.pow(2, 2 / 12);
    for (var k = 1; k < track.length - 1; k++) {
      var trio = [track[k - 1], track[k], track[k + 1]];
      if (trio.indexOf(null) >= 0) continue;
      trio.sort(function (p, q) { return p - q; });
      if (trio[2] / trio[0] > limit) continue;
      if (top === null || trio[1] > top) top = trio[1];
    }
    return top;
  }

  // x16: 모노 16kHz, x48: 모노 48kHz(Float32Array 등). x16을 비우면 x48에서 decimate3로 만든다.
  // 돌려주는 것: 모음 창 수 · 깨짐 % · 최악 세 창 · 가운데 비율 · 가운데 기본 주파수 · 최고 음높이 · 가장 깨진 창의 초 · marks(모음 창마다 [초, 깨졌나]) · 판정
  function measure(x16, x48, onProgress) {
    if (!x16) x16 = decimate3(x48);
    var frames = analyse(x16);
    var hz = topPitch(x48, 48000, onProgress);
    if (!frames.length) return { frames: 0, topHz: hz, marks: [], verdict: 'none' };
    var bad = 0, worst = frames[0];
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].ratio > LIMIT) bad++;
      if (frames[i].ratio > worst.ratio) worst = frames[i];
    }
    var res = {
      frames: frames.length,
      crackle: 100 * bad / frames.length,
      worst3: frames.map(function (f) { return f.ratio; }).sort(function (a, b) { return a - b; }).slice(-3).reduce(function (s, v, _, l) { return s + v / l.length; }, 0),
      medianRatio: median(frames.map(function (f) { return f.ratio; })),
      medianF0: median(frames.map(function (f) { return f.f0; })),
      topHz: hz,
      worstAt: worst.t,
      marks: frames.map(function (f) { return [f.t, f.ratio > LIMIT ? 1 : 0]; })
    };
    res.verdict = verdict(res);
    return res;
  }

  // 화면에 보이는 값(깨짐은 소수 첫째 자리, 음높이는 정수)으로 판정한다 — 「5.0%」인데 통과로 보이지 않게
  function shownCrackle(r) { return Number(r.crackle.toFixed(1)); }
  function shownHz(v) { return v === null || v === undefined ? null : Math.round(v); }
  function pitchFails(r) { return shownHz(r.topHz) !== null && shownHz(r.topHz) >= PASS_PITCH; }
  function crackleFails(r) { return r.medianF0 >= LOW_VOICE && shownCrackle(r) >= PASS_CRACKLE; }

  // pass 통과 · fail 미통과 · low 낮은 목소리(깨짐 %는 판정 안 함, 귀로 확인) · ear 음높이를 못 잡음(귀로 확인) · none 잴 모음 없음
  // 음높이는 목소리 높낮이와 상관없이 본다(파이썬도 기본음과 따로 ⚠) — 낮은 목소리라도 560Hz를 넘으면 미통과
  function verdict(r) {
    if (!r.frames) return 'none';
    if (pitchFails(r)) return 'fail';
    if (r.medianF0 < LOW_VOICE) return 'low';
    if (crackleFails(r)) return 'fail';
    if (shownHz(r.topHz) === null) return 'ear';
    return 'pass';
  }

  var api = { SR: SR, LIMIT: LIMIT, PASS_CRACKLE: PASS_CRACKLE, PASS_PITCH: PASS_PITCH, LOW_VOICE: LOW_VOICE, decimate3: decimate3, analyse: analyse, topPitch: topPitch, measure: measure, verdict: verdict, pitchFails: pitchFails, crackleFails: crackleFails };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SynkCrackle = api;

  // Worker로 불렸을 때: {id, x48}을 받아 진행(progress)과 결과를 돌려준다(긴 파일도 화면이 멈추지 않게)
  if (typeof WorkerGlobalScope !== 'undefined' && root instanceof WorkerGlobalScope) {
    root.onmessage = function (ev) {
      var m = ev.data;
      try { root.postMessage({ id: m.id, result: measure(null, m.x48, function (p) { root.postMessage({ id: m.id, progress: p }); }) }); }
      catch (err) { root.postMessage({ id: m.id, error: String(err && err.message || err) }); }
    };
  }
})(typeof self !== 'undefined' ? self : this);
