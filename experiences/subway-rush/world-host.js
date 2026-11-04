// WORLD 안에서 열렸는지 첫 그림 전에 표시한다(주문 폭주 world-host.js와 같은 글). 이 게임은 앱 전용이라 겉은 하나지만, 「우리 동네로」 · 기록은 이 표시를 본다.
// 인라인 스크립트는 WORLD 데스크톱 CSP(script-src 'self')가 막아서 파일로 둔다.
(function () {
  try {
    var frame = window.frameElement;
    if (frame && frame.classList && frame.classList.contains('game-frame')) document.documentElement.setAttribute('data-host', 'world');
  } catch (error) { /* 다른 출처의 틀 */ }
})();
