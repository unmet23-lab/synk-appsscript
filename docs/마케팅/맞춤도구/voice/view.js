/* AI 목소리 깨짐 검사 화면 — 파일 넣기 → 브라우저에서 48kHz로 한 번 풀기 → crackle.js(Worker)로 재기 → 표 · 시간 띠 · 듣기 · 표 복사.
 * 파일과 결과는 이 탭의 메모리에만 있다(서버 전송 · 저장 없음). 듣기는 넣은 파일 그대로(blob 주소)를 재생하고, 푼 소리 배열은 잰 뒤 버린다.
 */
(function () {
  'use strict';
  var C = window.SynkCrackle;
  var MAX_BYTES = 50 * 1024 * 1024;
  var MAX_SECONDS = 180;
  var SR = 48000;
  var SAMPLES = [
    { key: 'sample-a', src: 'samples/voice-a.wav', name: '목소리 A.wav', note: '예시 · 영상에서 깨져 들린 판' },
    { key: 'sample-b', src: 'samples/voice-b.wav', name: '목소리 B.wav', note: '예시 · 다른 목소리로 다시 뽑은 판' }
  ];

  var $ = function (s) { return document.querySelector(s); };
  var drop = $('[data-drop]'), input = $('[data-file]'), section = $('[data-results]'), rows = $('[data-rows]');
  var countEl = $('[data-count]'), bestEl = $('[data-best]'), toastEl = $('[data-toast]'), live = $('#live');
  var items = [], queue = [], running = null, seq = 0;
  var playing = null, stopAt = Infinity, raf = 0, playSeq = 0;
  var worker = null, workerDead = false, pending = {};
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── 넣기 ──
  // 손가락 기기에서는 끌어다 놓을 수 없으니 넣는 칸 글을 바꾼다
  if (window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches) $('.drop-title').textContent = '목소리 파일을 골라 주세요';
  $('[data-pick]').addEventListener('click', function () { input.click(); });
  input.addEventListener('change', function () { addFiles(input.files); input.value = ''; });
  $('[data-sample]').addEventListener('click', addSamples);
  // 창 어디에 떨어뜨려도 받는다(브라우저가 파일을 열어 버리지 않게)
  var dragDepth = 0;
  function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
  window.addEventListener('dragenter', function (e) { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; drop.classList.add('over'); });
  window.addEventListener('dragover', function (e) { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  window.addEventListener('dragleave', function (e) { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) drop.classList.remove('over'); });
  window.addEventListener('drop', function (e) { if (!hasFiles(e)) return; e.preventDefault(); dragDepth = 0; drop.classList.remove('over'); addFiles(e.dataTransfer.files); });

  function addFiles(list) {
    Array.prototype.slice.call(list || []).forEach(function (f) { add(f, f.name + '|' + f.size + '|' + f.lastModified, ''); });
  }

  function addSamples() {
    var btn = $('[data-sample]');
    btn.disabled = true;
    // 차례를 지키려고 둘을 다 받은 뒤 A · B 순서로 넣는다
    Promise.all(SAMPLES.map(function (s) {
      if (find(s.key)) return null;
      return fetch(s.src).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); });
    })).then(function (blobs) {
      SAMPLES.forEach(function (s, i) {
        if (blobs[i]) add(new File([blobs[i]], s.name, { type: 'audio/wav' }), s.key, s.note);
        else flash(find(s.key));
      });
      if (!blobs.some(Boolean)) toast('예시 두 개는 이미 표에 있어요.');
    }).catch(function () { toast('예시 파일을 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요.'); })
      .then(function () { btn.disabled = false; });
  }

  function find(key) { for (var i = 0; i < items.length; i++) if (items[i].key === key) return items[i]; return null; }

  function add(file, key, note) {
    var dup = find(key);
    if (dup) { flash(dup); say(file.name + '은 이미 넣은 파일이에요.'); toast('이미 넣은 파일이에요: ' + file.name); return; }
    var it = { id: ++seq, key: key, file: file, name: file.name, note: note, status: 'wait', progress: 0 };
    items.push(it);
    it.row = document.createElement('tr');
    it.row.setAttribute('role', 'row');
    rows.appendChild(it.row);
    render(it);
    showResults();
    queue.push(it);
    pump();
  }

  function showResults() {
    var first = section.hidden;
    section.hidden = false;
    summary();
    if (first) section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  // ── 재기: 한 번에 한 파일씩(풀어 둔 소리가 쌓이지 않게) ──
  function pump() {
    if (running || !queue.length) return;
    var it = running = queue.shift();
    measure(it).then(function () { if (running === it) running = null; pump(); });
  }

  function alive(it) { return items.indexOf(it) >= 0; }

  function measure(it) {
    if (it.file.size > MAX_BYTES) return Promise.resolve(fail(it, '50MB가 넘는 파일은 재지 않아요. 같은 글 한 줄씩 넣어 주세요.'));
    it.status = 'read'; render(it);
    return it.file.arrayBuffer().then(decode).then(function (x48) {
      if (!alive(it)) return;
      it.duration = x48.length / SR;
      if (it.duration > MAX_SECONDS) return fail(it, '3분이 넘는 파일은 재지 않아요. 같은 글 한 줄씩 넣어 주세요.');
      it.status = 'busy'; render(it);
      return compute(it, x48).then(function (res) {
        if (!alive(it)) return;
        it.result = res; it.status = 'done';
        // 듣기 준비: 클릭 순간 바로 재생할 수 있게 길이 정보를 미리 읽어 둔다(iOS는 클릭 안에서 play()를 불러야 한다)
        it.url = URL.createObjectURL(it.file);
        it.audio = new Audio();
        it.audio.preload = 'metadata';
        it.audio.src = it.url;
        it.audio.addEventListener('ended', function () { if (playing === it) stop(); });
        render(it); summary();
        say(it.name + ': ' + spoken(res));
      });
    }).catch(function (err) {
      if (!alive(it)) return;
      if (err && err.retry) return measure(it);   // Worker가 죽어 화면 스레드로 다시 잰다
      fail(it, err && err.decode ? '이 브라우저가 읽지 못하는 파일이에요. wav나 mp3로 넣어 주세요.' : '재는 중에 문제가 생겼어요. 다시 넣어 주세요.');
    });
  }

  function fail(it, msg) { it.status = 'error'; it.error = msg; render(it); summary(); say(it.name + ': ' + msg); }

  // 48kHz로 한 번만 푼다. 원본 채널을 평균해 모노로(스테레오는 (L+R)/2 = ffmpeg -ac 1). 16kHz는 crackle.js가 ffmpeg와 같은 꼴로 만든다.
  function decode(buf) {
    var Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Ctx) return Promise.reject({ decode: true });
    var ctx;
    try { ctx = new Ctx(1, 1, SR); } catch (e) { return Promise.reject({ decode: true }); }
    return new Promise(function (resolve, reject) {
      var done = false;
      var ok = function (ab) { if (done) return; done = true; resolve(ab); };
      var no = function () { if (done) return; done = true; reject({ decode: true }); };
      var p = ctx.decodeAudioData(buf, ok, no);
      if (p && p.then) p.then(ok, no);
    }).then(function (ab) {
      var n = ab.length, ch = ab.numberOfChannels, out = new Float32Array(n);
      for (var c = 0; c < ch; c++) { var d = ab.getChannelData(c); for (var i = 0; i < n; i++) out[i] += d[i] / ch; }
      return out;
    });
  }

  function startWorker() {
    try { worker = new Worker('crackle.js'); } catch (err) { workerDead = true; worker = null; return; }
    worker.onmessage = function (e) {
      var m = e.data, job = pending[m.id];
      if (!job) return;
      if (m.progress !== undefined) { job.it.progress = m.progress; renderProgress(job.it); return; }
      delete pending[m.id];
      if (m.error) job.reject(new Error(m.error)); else job.resolve(m.result);
    };
    worker.onerror = function (e) {
      // Worker를 못 쓰는 곳이면 화면 스레드로 다시 잰다(파일은 그대로 있어 다시 푼다)
      if (e && e.preventDefault) e.preventDefault();
      workerDead = true; worker = null;
      Object.keys(pending).forEach(function (id) { var job = pending[id]; delete pending[id]; job.reject({ retry: true }); });
    };
  }

  function compute(it, x48) {
    if (!worker && !workerDead) startWorker();
    if (!worker) return new Promise(function (resolve) { setTimeout(function () { resolve(C.measure(null, x48)); }, 30); });
    return new Promise(function (resolve, reject) {
      pending[it.id] = { it: it, resolve: resolve, reject: reject };
      worker.postMessage({ id: it.id, x48: x48 }, [x48.buffer]);
    });
  }

  // ── 그리기 ──
  var LABEL = { pass: '통과', fail: '미통과', low: '낮은 목소리 — 귀로 확인', ear: '귀로 확인', none: '잴 모음 없음' };
  var CHIP = { pass: 'pass', fail: 'fail', low: 'ear', ear: 'ear', none: '' };
  var PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.8v10.4L13 8z" fill="currentColor"/></svg>';
  var STOP = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="currentColor"/></svg>';
  var CROSS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7m0-7l-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pct(r) { return r.crackle.toFixed(1); }
  function hz(v) { return v === null || v === undefined ? '—' : String(Math.round(v)); }
  function size(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB'; }
  function sec(t) { return t.toFixed(1) + '초'; }
  // 낮은 목소리(가운데 기본음 165Hz 아래)는 깨짐 %를 판정하지 않는다 — 음높이로 미통과가 된 줄도 같다(verdict가 아니라 기본음으로 본다)
  function low(r) { return !!(r && r.frames && r.medianF0 < C.LOW_VOICE); }
  // 깨진 순간은 깨짐을 판정하는 목소리에서만 센다
  function cracks(r) { return r && r.marks && !low(r) ? r.marks.filter(function (m) { return m[1]; }).length : 0; }
  function listenLabel(r) { return cracks(r) ? '깨진 곳 듣기' : '처음부터 듣기'; }

  function why(r) {
    if (r.verdict === 'pass') return '깨짐 5% 아래 · 최고 음높이 560Hz 아래';
    if (r.verdict === 'fail') {
      var w = [];
      if (C.crackleFails(r)) w.push('깨짐 ' + pct(r) + '% (기준 5% 아래)');
      if (C.pitchFails(r)) w.push('최고 음높이 ' + hz(r.topHz) + 'Hz (기준 560Hz 아래)');
      if (r.medianF0 < C.LOW_VOICE) w.push('낮은 목소리라 깨짐 %는 판정하지 않아요');
      return w.join(' · ');
    }
    if (r.verdict === 'low') return '가운데 기본음 ' + hz(r.medianF0) + 'Hz — 낮은 목소리는 멀쩡해도 깨짐 %가 높게 나와요';
    if (r.verdict === 'ear') return '음높이를 고르게 잡지 못했어요';
    return '소리가 너무 작거나, 한 번 크게 튄 소리 때문에 잴 모음 구간이 없어요.';
  }

  function spoken(r) {
    if (r.verdict === 'none') return LABEL.none;
    return '깨짐 ' + pct(r) + '%, 최고 음높이 ' + (r.topHz === null ? '못 잡음' : hz(r.topHz) + '헤르츠') + ', ' + LABEL[r.verdict];
  }

  function td(cls, label, html, span) { return '<td role="cell"' + (cls ? ' class="' + cls + '"' : '') + (label ? ' data-label="' + label + '"' : '') + (span ? ' colspan="' + span + '"' : '') + '>' + html + '</td>'; }

  function render(it) {
    var r = it.result, n = cracks(r);
    var meta = [it.note, it.duration ? sec(it.duration) : '', size(it.file.size)].filter(Boolean).join(' · ');
    var name = '<span class="fname">' + esc(it.name) + '</span><span class="fmeta">' + esc(meta) + '</span>';
    if (it.status === 'done' && r.frames) {
      // 띠는 마우스·손가락용(가장 깨진 자리는 글자와 「깨진 곳 듣기」로 키보드에서도 닿는다)
      name += '<div class="strip' + (low(r) ? ' calm' : '') + '" data-strip aria-hidden="true" title="누르면 그 자리부터 들어요"><canvas></canvas></div>' +
        '<span class="fmeta">' + (n ? '깨진 순간 ' + n + '곳 · 가장 깨진 자리 ' + sec(r.worstAt) : low(r) ? '깨짐을 판정하지 않는 낮은 목소리' : '깨진 순간 없음') + '</span>';
    }
    var rm = '<button type="button" class="rm" data-rm aria-label="' + esc(it.name) + ' 지우기" title="이 줄 지우기">' + CROSS + '</button>';
    it.row.className = it.status === 'done' ? '' : 'busy';
    if (it.status === 'done') {
      var over = function (bad) { return bad ? ' class="over"' : ''; };
      it.row.innerHTML = td('', '', name) +
        td('num', '깨짐', r.frames ? (low(r) ? '<span class="muted">' + pct(r) + '</span>' : '<span' + over(C.crackleFails(r)) + '>' + pct(r) + '</span>') + '<small>%</small>' : '—') +
        td('num', '최고 음높이', r.topHz === null ? '—' : '<span' + over(C.pitchFails(r)) + '>' + hz(r.topHz) + '</span><small>Hz</small>') +
        td('num', '가운데 기본음', r.frames ? hz(r.medianF0) + '<small>Hz</small>' : '—') +
        td('vd', '', '<span class="verdict ' + CHIP[r.verdict] + '">' + LABEL[r.verdict] + '</span><span class="why">' + esc(why(r)) + '</span>') +
        td('act', '', '<button type="button" class="btn soft listen" data-listen>' + PLAY + '<span>' + listenLabel(r) + '</span></button>' + rm);
      it.row.querySelector('[data-listen]').addEventListener('click', function () { toggle(it, null); });
      var strip = it.row.querySelector('[data-strip]');
      if (strip) {
        strip.addEventListener('click', function (e) {
          var box = strip.getBoundingClientRect(), pad = 8;
          var t = Math.min(1, Math.max(0, (e.clientX - box.left - pad) / Math.max(1, box.width - pad * 2))) * it.duration;
          toggle(it, t);
        });
        draw(it);
      }
    } else if (it.status === 'error') {
      // 데스크톱 표에서도 숫자 · 판정 네 칸을 합쳐 지우기 단추가 마지막 칸에 오게 한다
      it.row.innerHTML = td('', '', name) + td('wide err', '', esc(it.error), 4) + td('act', '', rm);
    } else {
      it.row.innerHTML = td('', '', name) + td('wide', '', '<span data-prog>' + (it.status === 'busy' ? '재는 중' : it.status === 'read' ? '읽는 중' : '기다리는 중') + '</span>', 4) + td('act', '', rm);
      renderProgress(it);
    }
    it.row.querySelector('[data-rm]').addEventListener('click', function () { remove(it); });
  }

  function renderProgress(it) {
    var el = it.row.querySelector('[data-prog]');
    if (el && it.status === 'busy' && it.progress > 0.02) el.innerHTML = '재는 중 <span class="progress">' + Math.round(it.progress * 100) + '%</span>';
  }

  // 파일 수와 판정 수, 둘 넘게 판정했으면 지금까지 가장 덜 깨진 판
  function summary() {
    var n = { pass: 0, fail: 0, ear: 0, none: 0 };
    items.forEach(function (it) { if (it.result) n[it.result.verdict === 'none' ? 'none' : CHIP[it.result.verdict]]++; });
    countEl.textContent = '파일 ' + items.length + '개 · 통과 ' + n.pass + ' · 미통과 ' + n.fail + (n.ear ? ' · 귀로 확인 ' + n.ear : '') + (n.none ? ' · 잴 모음 없음 ' + n.none : '');
    var judged = items.filter(function (it) { return it.result && (it.result.verdict === 'pass' || it.result.verdict === 'fail'); });
    if (judged.length < 2) { bestEl.hidden = true; return; }
    judged.sort(function (a, b) {
      var pa = a.result.verdict === 'pass' ? 0 : 1, pb = b.result.verdict === 'pass' ? 0 : 1;
      return pa - pb || a.result.crackle - b.result.crackle || (a.result.topHz || 0) - (b.result.topHz || 0);
    });
    var b = judged[0], r = b.result;
    bestEl.innerHTML = (r.verdict === 'pass' ? '지금까지 가장 덜 깨진 판은 ' : '통과한 판이 없어요. 그중 가장 덜 깨진 판은 ') +
      '<b>' + esc(b.name) + '</b> — 깨짐 ' + pct(r) + '% · 최고 음높이 ' + (r.topHz === null ? '못 잡음' : hz(r.topHz) + 'Hz') + '. 고르기 전에 한 번 들어 보세요.';
    bestEl.hidden = false;
  }

  function remove(it) {
    if (playing === it) stop();
    items.splice(items.indexOf(it), 1);
    queue = queue.filter(function (q) { return q !== it; });
    if (running === it) { cancelWork(); running = null; pump(); }
    if (it.url) URL.revokeObjectURL(it.url);
    var next = it.row.nextElementSibling || it.row.previousElementSibling;
    it.row.remove();
    say(it.name + ' 줄을 지웠어요.');
    if (!items.length) { section.hidden = true; $('[data-pick]').focus(); return; }
    summary();
    var f = next && next.querySelector('[data-rm]');
    if (f) f.focus();
  }

  // 재는 중인 일을 멈춘다: Worker를 끝내고 다음에 새로 띄운다
  function cancelWork() {
    if (worker) { worker.terminate(); worker = null; }
    Object.keys(pending).forEach(function (id) { var job = pending[id]; delete pending[id]; job.reject({ cancelled: true }); });
  }

  function flash(it) {
    if (!it) return;
    it.row.classList.remove('flash');
    void it.row.offsetWidth;
    it.row.classList.add('flash');
    it.row.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  }

  // 시간 띠: 가운데 줄 위에 모음 창은 짧은 옅은 줄, 깨진 창은 길고 굵은 코랄 줄(낮은 목소리는 중립색), 듣는 중이면 지금 자리
  function draw(it, at) {
    var strip = it.row.querySelector('[data-strip]');
    if (!strip) return;
    var cv = strip.querySelector('canvas'), dpr = window.devicePixelRatio || 1;
    var w = Math.max(1, Math.round(strip.clientWidth * dpr)), h = Math.max(1, Math.round(strip.clientHeight * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    var g = cv.getContext('2d'), css = getComputedStyle(document.body);
    var faint = css.getPropertyValue('--ink-4').trim(), base = css.getPropertyValue('--line-2').trim(), ink = css.getPropertyValue('--ink').trim();
    var hot = low(it.result) ? css.getPropertyValue('--ink-3').trim() : css.getPropertyValue('--led-alert').trim();
    var pad = Math.round(8 * dpr), span = w - pad * 2, dur = it.duration || 1, tick = Math.max(1, Math.round(1.5 * dpr));
    g.clearRect(0, 0, w, h);
    g.fillStyle = base; g.fillRect(pad, Math.round(h / 2), span, Math.max(1, Math.round(dpr)));
    // 픽셀 칸마다 한 번만 칠한다(긴 파일에서 옅은 줄이 겹쳐 하얗게 뭉치지 않게). 깨진 창은 양옆 칸까지 굵게
    var cols = new Uint8Array(span + 1), marks = it.result.marks, i, x;
    for (i = 0; i < marks.length; i++) {
      x = Math.min(span, Math.max(0, Math.round((marks[i][0] + 0.02) / dur * span)));
      if (marks[i][1]) { for (var k = -tick; k <= tick; k++) if (x + k >= 0 && x + k <= span) cols[x + k] = 2; }
      else if (!cols[x]) for (var j = 0; j < tick && x + j <= span; j++) if (!cols[x + j]) cols[x + j] = 1;
    }
    var runs = function (val, color, y0, y1) {
      g.fillStyle = color;
      for (var s = 0; s <= span; s++) {
        if (cols[s] !== val) continue;
        var e = s;
        while (e + 1 <= span && cols[e + 1] === val) e++;
        g.fillRect(pad + s, Math.round(h * y0), e - s + 1, Math.round(h * (y1 - y0)));
        s = e;
      }
    };
    runs(1, faint, 0.32, 0.68);
    runs(2, hot, 0.12, 0.88);
    if (at !== undefined) { g.fillStyle = ink; g.fillRect(Math.round(pad + Math.min(at, dur) / dur * span), 0, Math.max(1, Math.round(dpr)), h); }
  }

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { items.forEach(function (it) { if (it.status === 'done') draw(it, playing === it ? it.audio.currentTime : undefined); }); }, 80);
  });

  // ── 듣기: 한 번에 하나. 깨진 곳은 0.5초 앞부터 1.5초, 띠를 누르면 그 0.5초 앞부터 2초, 깨진 곳이 없으면 처음부터 끝까지 ──
  function toggle(it, t) {
    var fromStrip = t !== null && t !== undefined;
    if (playing === it && !fromStrip) { stop(); return; }
    stop();
    var r = it.result, a = it.audio, start = 0;
    stopAt = Infinity;
    if (fromStrip) { start = Math.max(0, t - 0.5); stopAt = start + 2; }
    else if (cracks(r)) { start = Math.max(0, r.worstAt - 0.5); stopAt = start + 1.5; }
    playing = it;
    var my = ++playSeq;
    // 단추 이름이 「멈추기」로 바뀌므로 aria-pressed는 쓰지 않는다(「멈추기, 눌림」으로 읽혀 뜻이 엇갈린다). 모양은 data-playing으로
    var btn = it.row.querySelector('[data-listen]');
    btn.setAttribute('data-playing', '');
    btn.innerHTML = STOP + '<span>멈추기</span>';
    // 클릭 안에서 바로 play()를 부른다(iOS). 길이 정보가 아직이면 읽히는 대로 자리를 옮긴다.
    if (a.readyState >= 1) a.currentTime = start;
    else a.addEventListener('loadedmetadata', function () { if (playing === it && my === playSeq) a.currentTime = start; }, { once: true });
    var p = a.play();
    // 바로 앞 재생을 pause()로 끊으면 그 play()가 AbortError로 끝난다 — 지금 재생까지 멈추지 않게 이번 요청의 실패만 알린다
    if (p && p.catch) p.catch(function (err) { if (err && err.name === 'AbortError') return; if (playing === it && my === playSeq) { stop(); toast('소리를 재생하지 못했어요.'); } });
    tick();
  }

  function tick() {
    cancelAnimationFrame(raf);
    if (!playing) return;
    var a = playing.audio;
    if (a.currentTime >= stopAt || a.ended) { stop(); return; }
    draw(playing, a.currentTime);
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(raf);
    if (!playing) return;
    var it = playing;
    playing = null;
    it.audio.pause();
    if (!alive(it)) return;
    var btn = it.row.querySelector('[data-listen]');
    if (btn) { btn.removeAttribute('data-playing'); btn.innerHTML = PLAY + '<span>' + listenLabel(it.result) + '</span>'; }
    draw(it);
  }

  // ── 표 복사 · 모두 지우기 ──
  $('[data-copy]').addEventListener('click', function () {
    var done = items.filter(function (it) { return it.status === 'done' || it.status === 'error'; });
    if (!done.length) { toast('아직 잰 파일이 없어요.'); return; }
    var lines = [['파일', '깨짐 %', '최고 음높이 Hz', '가운데 기본음 Hz', '판정', '이유'].join('\t')];
    done.forEach(function (it) {
      var r = it.result;
      lines.push(r ? [it.name, r.frames ? pct(r) : '', hz(r.topHz), r.frames ? hz(r.medianF0) : '', LABEL[r.verdict], why(r)].join('\t') : [it.name, '', '', '', '재지 못함', it.error].join('\t'));
    });
    lines.push('', '같은 글을 목소리끼리 견줄 때만 쓰는 숫자예요. 귀로 듣기를 대신하지 않아요. — synk.im/builds/voice-check');
    copy(lines.join('\n'));
  });

  function copy(text) {
    var ok = '표를 복사했어요. 시트나 메모에 붙여 넣으세요.';
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var done = false;
      try { done = document.execCommand('copy'); } catch (e) { done = false; }
      ta.remove();
      toast(done ? ok : '복사하지 못했어요. 표를 길게 눌러 골라 주세요.');
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast(ok); }, fallback);
    else fallback();
  }

  $('[data-clear]').addEventListener('click', function () {
    stop();
    cancelWork();
    items.forEach(function (it) { if (it.url) URL.revokeObjectURL(it.url); });
    items = []; queue = []; running = null;
    rows.innerHTML = '';
    section.hidden = true;
    say('결과를 모두 지웠어요.');
    $('[data-pick]').focus();
  });

  var toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }
  function say(msg) { live.textContent = ''; setTimeout(function () { live.textContent = msg; }, 30); }
})();
