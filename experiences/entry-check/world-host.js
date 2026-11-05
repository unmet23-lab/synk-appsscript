// WORLD 안에서 열렸는지 첫 그림 전에 표시한다(2026-11-04 입장 검사 캠퍼스 판, 주문 폭주 · 말의 리듬 world-host.js와 같은 글).
// WORLD 앱은 게임을 같은 출처의 iframe(.game-frame)으로 연다 → <html data-host="world">가 붙고 world-skin.css가 그때만 걸린다.
// 앱 사본(/world/entry-check/)은 틀 밖에서 주소로 바로 열어도 같다 — 펠트 그림 · 몽글 · 안내 목소리를 싣지 않아 LAB 판으로는 뜰 수 없다(배포 점검이 잡음, 11-05).
// 따로 연 LAB 화면, 계정 페이지의 게임 틀, 다른 출처의 틀에서는 아무것도 바꾸지 않는다.
// 인라인 스크립트는 WORLD 데스크톱 CSP(script-src 'self')가 막아서 파일로 둔다. 게임 흐름은 건드리지 않는다.
(function () {
  if (/^\/world\/entry-check\//.test(location.pathname)) { document.documentElement.setAttribute('data-host', 'world'); return; }
  try {
    var frame = window.frameElement;
    if (frame && frame.classList && frame.classList.contains('game-frame')) document.documentElement.setAttribute('data-host', 'world');
  } catch (error) { /* 다른 출처의 틀: LAB 화면 그대로 */ }
})();
