// 화면을 그리기 전에 웹 플랫폼에서 고른 밤·낮·기기 설정을 입힌다(인라인 스크립트를 막는 CSP 때문에 파일로 둔다).
(function () {
  var value = 'night';
  try { var saved = localStorage.getItem('synk.platform.theme'); if (saved === 'day' || saved === 'system' || saved === 'night') value = saved; } catch (e) { /* 밤 */ }
  document.documentElement.setAttribute('data-theme', value);
})();
