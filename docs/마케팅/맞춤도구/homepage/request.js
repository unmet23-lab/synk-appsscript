/* 우리 가게 요청문 만들기의 셈 — 브라우저 안에서만 돈다(서버 전송 · 저장 없음). 시험은 tests/홈페이지물건자료.test.js.
 * 틀은 page.js가 내용.json에서 읽어 data-template으로 넘긴다. 쪽과 PDF가 같은 틀을 쓴다.
 */
(function (root) {
  'use strict';
  var MAX = { kind: 40, object: 60 };

  // 줄바꿈 · 겹친 띄어쓰기를 한 칸으로. 붙여 넣은 글이 요청문 한 줄을 깨지 않게 한다.
  function clean(text, max) {
    var s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    return s.length > max ? s.slice(0, max).trim() : s;
  }

  // 한 번에 바꾼다 — 차례로 바꾸면 업종 칸에 적은 「{물건}」이 다시 바뀐다. 함수로 넘겨 「$」도 그대로 둔다
  function build(template, kind, object) {
    return String(template).replace(/\{업종\}|\{물건\}/g, function (m) { return m === '{업종}' ? kind : object; });
  }

  // 두 칸이 다 차야 완성이다. 비었으면 빈칸 자리를 【】로 보이고 복사는 막는다.
  function request(template, kind, object) {
    var k = clean(kind, MAX.kind), o = clean(object, MAX.object);
    return { ready: !!(k && o), text: build(template, k || '【업종】', o || '【물건】') };
  }

  var api = { request: request, clean: clean, MAX: MAX };
  root.SynkHomepage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
