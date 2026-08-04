// shell-text — 「이 명령에서 **실제로 실행되는** 텍스트는 어디까지인가」 (가드 공용 통로)
//
// 왜 뗐나 — 가드가 사람이 쓴 문장을 명령으로 읽는 오탐이 **두 번** 났고, 둘 다 같은 계열이다:
//   2026-08-01  커밋 메시지 heredoc 안의 "clasp push" 가 매칭돼 **커밋 자체가 막혔다**
//   2026-08-04  F049 — `grep -n "…clasp pull 차단…"` 의 인용 인자가 매칭돼 **검색이 막혔다**
//               (heredoc만 덮고 인용 인자를 안 덮었다 — 같은 함정의 다른 입구)
//   문서화·검색을 벌하는 가드는 사람에게 BYPASS 를 습관으로 가르친다(v6.11). 그런데 이 판정을
//   가드마다 다시 적으면 **조용히 갈라진다** — 새 가드가 옛 오탐을 그대로 되밟는다.
//   CLAUDE.md 「호출부마다 고치는 대신 잘못 쓸 수 없는 공용 통로를 만든다」의 적용.
//
// ⚠ 이 함수는 **인용 안을 지운다**. 인라인 스크립트 본문(`node -e "…"`)처럼 인용 안이 곧
//   검사 대상인 규칙에는 쓰면 안 된다 — 그런 규칙은 실행기+플래그에 먼저 앵커를 걸고
//   **원본**을 봐야 한다(shell-inline-guard 가 그 형태다). 여기서 지우는 건 "산문"이지 "코드"가 아니다.
'use strict';

/**
 * 명령에서 실행되지 않는 텍스트(heredoc 본문 · 커밋 메시지 · 인용된 산문)를 걷어낸다.
 *
 * 지우지 않고 **치환**하는 이유: 통째로 지우면 인용된 **실행 경로**
 * (`"C:/…/clasp.cmd" push`, `> "docs/x.html"`)까지 사라져 진짜 위반을 놓친다.
 * 그래서 호출부가 「인용 안이 이러면 살린다」를 직접 정한다.
 *
 * @param {string} s          원본 명령
 * @param {object} [opts]
 * @param {RegExp} [opts.keepQuoted]  인용 본문이 이걸 만족하면 산문이 아니라 실행 텍스트로 본다
 * @param {string|function} [opts.keepAs]  살릴 때 무엇으로 바꿀지(문자열 또는 body=>문자열)
 * @returns {string} 실행부만 남은 텍스트 (길이는 보존하지 않는다 — 위치 기반 판정에 쓰지 말 것)
 */
function stripNonExecutedText(s, opts) {
  const o = opts || {};
  const keep = o.keepQuoted instanceof RegExp ? o.keepQuoted : null;
  const keepAs = o.keepAs === undefined ? ' KEPT ' : o.keepAs;
  const 살린다 = (body) => (typeof keepAs === 'function' ? keepAs(body) : keepAs);

  return String(s)
    // heredoc 본문: <<EOF / <<'EOF' / <<-"EOF" … 줄 처음의 같은 태그까지
    .replace(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[\s\S]*?^\s*\2\s*$/gm, ' <<HEREDOC ')
    // -m / --message 의 인용 문자열 본문 (커밋 메시지는 언제나 산문이다)
    .replace(/(-m|--message)\s+(['"])[\s\S]*?\2/g, '$1 MSG')
    // 나머지 인용 인자 — 호출부가 살리라고 한 것만 남긴다
    .replace(/(['"])([\s\S]*?)\1/g, (_m, _q, body) =>
      (keep && keep.test(body)) ? 살린다(body) : ' QUOTED ');
}

module.exports = { stripNonExecutedText };
