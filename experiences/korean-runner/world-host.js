// WORLD 안에서 열렸는지 첫 그림 전에 표시한다(2026-10-14 WORLD 화면 개편).
// WORLD 앱은 게임을 같은 출처의 iframe(.game-frame)으로 연다 → <html data-host="world">가 붙고 world-skin.css가 그때만 걸린다.
// 따로 연 LAB 화면, 계정 페이지의 게임 틀, 다른 출처의 틀에서는 아무것도 바꾸지 않는다.
// 인라인 스크립트는 WORLD 데스크톱 CSP(script-src 'self')가 막아서 파일로 둔다. 게임 흐름은 건드리지 않는다.
(function () {
  try {
    var frame = window.frameElement;
    if (frame && frame.classList && frame.classList.contains('game-frame')) document.documentElement.setAttribute('data-host', 'world');
  } catch (error) { /* 다른 출처의 틀: LAB 화면 그대로 */ }
})();
