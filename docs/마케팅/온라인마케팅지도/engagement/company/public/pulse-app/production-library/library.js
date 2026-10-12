(function () {
  'use strict';
  var tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  var panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));
  function select(index, focus) {
    tabs.forEach(function (tab, i) { var active = i === index; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; panels[i].hidden = !active; });
    if (focus) tabs[index].focus();
  }
  tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () { select(index, false); });
    tab.addEventListener('keydown', function (event) {
      var next = index;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault(); select(next, true);
    });
  });
  document.querySelectorAll('[data-copy]').forEach(function (button) {
    button.addEventListener('click', async function () {
      var target = document.getElementById(button.getAttribute('data-copy'));
      var status = button.closest('.prompt-box').querySelector('.copy-status');
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('clipboard unavailable');
        await navigator.clipboard.writeText(target.value);
        status.textContent = '프롬프트를 복사했습니다.';
      } catch (_) {
        target.focus(); target.select(); target.setSelectionRange(0, target.value.length);
        status.textContent = '복사 권한이 없어 내용을 선택했습니다. Ctrl+C 또는 길게 눌러 복사하세요.';
      }
    });
  });
  var modelCodes = ["F02","F01","M02","M01","F03","F04","M03"];
  var requested = new URLSearchParams(location.search).get('model');
  var requestedIndex = modelCodes.indexOf(requested);
  if(requestedIndex >= 0){ select(requestedIndex, false); document.getElementById('advertisements').scrollIntoView({block:'start'}); }
  var openedForPrint = [];
  window.addEventListener('beforeprint', function () {
    openedForPrint = Array.from(document.querySelectorAll('details:not([open])'));
    openedForPrint.forEach(function (detail) { detail.open = true; });
  });
  window.addEventListener('afterprint', function () { openedForPrint.forEach(function (detail) { detail.open = false; }); openedForPrint = []; });
  document.getElementById('print-report').addEventListener('click', function () { window.print(); });
}());
