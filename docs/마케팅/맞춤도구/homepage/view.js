/* AI 홈페이지가 다 똑같을 때 쪽 — 요청문 만들기 · 복사, 화면 크게 보기, 색 빼고 보기.
 * 적은 글은 이 탭의 메모리에만 있다(서버 전송 · 저장 없음). 크게 보기는 링크를 가로챌 뿐이라 자바스크립트가 없어도 그림은 열린다.
 */
(function () {
  'use strict';
  var H = window.SynkHomepage;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  // ── 요청문 만들기 ──
  var form = $('[data-make]'), kindEl = $('#make-kind'), objectEl = $('#make-object');
  var out = $('[data-out]'), copyBtn = $('[data-copy]'), status = $('[data-status]');
  // 틀과 알림 글은 page.js가 내용.json에서 속성으로 넘긴다
  var template = form.getAttribute('data-template');
  var msg = { empty: form.getAttribute('data-msg-empty'), done: form.getAttribute('data-msg-done'), fail: form.getAttribute('data-msg-fail') };
  var current = { ready: false, text: '' };

  function update() {
    current = H.request(template, kindEl.value, objectEl.value);
    out.value = current.text;
    copyBtn.disabled = !current.ready;
    status.textContent = current.ready ? '' : msg.empty;
    $$('[data-kind]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-kind') === H.clean(kindEl.value, H.MAX.kind))); });
  }

  kindEl.addEventListener('input', update);
  objectEl.addEventListener('input', update);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  $$('[data-kind]').forEach(function (b) {
    b.addEventListener('click', function () { kindEl.value = b.getAttribute('data-kind'); update(); if (!objectEl.value.trim()) objectEl.focus(); });
  });
  // 휴대폰 자판의 「다음」 · 「완료」(한글 조합 중인 Enter는 넘긴다)
  kindEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); objectEl.focus(); } });
  objectEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); objectEl.blur(); } });

  copyBtn.addEventListener('click', function () {
    if (!current.ready) return;
    var ok = function () { status.textContent = msg.done; };
    var fallback = function () {
      // 앱 안 브라우저처럼 클립보드가 막힌 곳: 요청문 칸을 골라 execCommand로, 그것도 막히면 길게 눌러 복사하게 둔다
      out.focus();
      out.setSelectionRange(0, out.value.length);
      var done = false;
      try { done = document.execCommand('copy'); } catch (e) { done = false; }
      if (done) ok(); else status.textContent = msg.fail;
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(current.text).then(ok, fallback);
    else fallback();
  });

  // 화면을 다시 불러왔을 때 브라우저가 입력칸을 되살려 두면 그 값으로 그린다
  update();

  // ── 색 빼고 보기 ──
  $$('[data-gray]').forEach(function (btn) {
    var grid = $('#' + btn.getAttribute('data-gray'));
    btn.addEventListener('click', function () {
      var on = !grid.classList.contains('gray');
      grid.classList.toggle('gray', on);
      btn.setAttribute('aria-pressed', String(on));
    });
  });

  // ── 크게 보기: 같은 묶음(단계 · 물건 예시) 안에서 앞뒤로 넘긴다 ──
  var box = $('[data-box]');
  if (!box || typeof box.showModal !== 'function') return;
  var boxImg = $('img', box), boxCap = $('figcaption', box), prev = $('[data-prev]', box), next = $('[data-next]', box);
  var group = [], at = 0;

  function show(i) {
    at = (i + group.length) % group.length;
    var a = group[at];
    boxImg.src = a.getAttribute('href');
    boxImg.alt = a.getAttribute('data-alt') || '';
    boxCap.textContent = a.getAttribute('data-cap') || '';
    var preload = group[(at + 1) % group.length];
    if (preload) new Image().src = preload.getAttribute('href');
  }

  $$('[data-open]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      group = $$('[data-open="' + a.getAttribute('data-open') + '"]');
      show(group.indexOf(a));
      box.showModal();
    });
  });
  prev.addEventListener('click', function () { show(at - 1); });
  next.addEventListener('click', function () { show(at + 1); });
  $('[data-close]', box).addEventListener('click', function () { box.close(); });
  // 그림 밖(어두운 뒤판 · 그림 옆 빈자리)을 누르면 닫는다 — 휴대폰에선 figure가 화면 폭을 다 덮는다
  var figure = $('figure', box);
  box.addEventListener('click', function (e) { if (e.target === box || e.target === figure) box.close(); });
  box.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(at - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(at + 1); }
  });
  box.addEventListener('close', function () { boxImg.removeAttribute('src'); });
})();
