/* ㄹ 소리 판정 — 한글 낱말 안의 ㄹ이 혀를 튕기는 소리(r)인지, L인지, 겹 L인지, ㄴ으로 바뀌는지, 소리 나지 않는지.
 * 근거(국립국어원):
 *   국어의 로마자 표기법 제2장 제2항 [붙임 2] — ㄹ은 모음 앞에서 r, 자음 앞이나 어말에서 l, ㄹㄹ은 ll.
 *   국어의 로마자 표기법 제3장 제1항 — 소리가 바뀌면 바뀐 결과대로 적는다(신라 Silla, 종로 Jongno, 별내 Byeollae).
 *   표준 발음법 제13·14항(받침이 모음 앞으로 넘어감), 제10·11항(겹받침), 제12항(ㅀ), 제19항(ㅁ·ㅇ·ㄱ·ㅂ 뒤 ㄹ → ㄴ),
 *   제20항(ㄴ과 ㄹ이 만나면 ㄹㄹ, 다만 의견란 등은 ㄴ), 제29항 [붙임 1](ㄹ 받침 뒤 덧나는 ㄴ은 ㄹ: 서울역 [서울력]).
 * AI·네트워크·기록 없음. 같은 입력에는 늘 같은 결과.
 */
(function (root) {
  'use strict';

  var BASE = 0xAC00, LAST = 0xD7A3;
  var CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  var JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  var JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

  var C = { R: 5, N: 2, M: 6, NG: 11, IEUNG: 11, H: 18, G: 0 };
  var J = { NONE: 0, G: 1, GG: 2, GS: 3, N: 4, NJ: 5, NH: 6, D: 7, L: 8, LG: 9, LM: 10, LB: 11, LS: 12, LT: 13, LP: 14, LH: 15, M: 16, B: 17, BS: 18, S: 19, SS: 20, NG: 21, J: 22, CH: 23, K: 24, T: 25, P: 26, H: 27 };

  // 받침 ㄱ 무리 / ㅂ 무리 — 뒤 ㄹ을 ㄴ으로 만들고 자기는 ㅇ / ㅁ이 된다(제19항 붙임)
  var VELAR = [J.G, J.GG, J.GS, J.K];
  var LABIAL = [J.B, J.BS, J.P, J.LP];
  // 받침 소리가 ㄷ 무리인 것 — 낱말 안에서 ㄹ과 거의 만나지 않는다
  var DENTAL = [J.D, J.S, J.SS, J.J, J.CH, J.T, J.H];

  // 제20항 다만 — ㄴ 뒤의 ㄹ을 [ㄴ]으로 읽는 낱말(고시 예시 그대로)
  var N_EXCEPTIONS = ['의견란', '임진란', '생산량', '결단력', '공권력', '동원령', '상견례', '횡단로', '이원론', '입원료', '구근류'];
  // 제29항 [붙임 1] — ㄹ 받침 뒤에 ㄴ이 덧나 [ㄹ]로 읽는 낱말(고시 예시 그대로)
  var L_INSERT = ['들일', '솔잎', '설익', '물약', '불여우', '서울역', '물엿', '휘발유', '유들유들',
    '열여섯', '열여덟', '스물여섯', '스물여덟', '볼일', '별일', '불이익', '알약', '풀잎', '일일이'];

  function isHangul(ch) { var c = ch.charCodeAt(0); return c >= BASE && c <= LAST; }
  function parts(ch) {
    var n = ch.charCodeAt(0) - BASE;
    return { cho: Math.floor(n / 588), jung: Math.floor((n % 588) / 28), jong: n % 28 };
  }
  function compose(cho, jung, jong) { return String.fromCharCode(BASE + (cho * 21 + jung) * 28 + jong); }

  function hits(word, list) {
    // 낱말 안에서 목록 낱말이 시작하는 자리들
    var out = [];
    list.forEach(function (w) {
      var from = 0, at;
      while ((at = word.indexOf(w, from)) >= 0) { out.push({ at: at, len: w.length, word: w }); from = at + 1; }
    });
    return out;
  }

  // 한 낱말(한글 음절만 이어진 덩어리)의 ㄹ마다 판정
  // 낱말 끝 받침은 일곱 대표음으로 소리 난다(표준 발음법 제8·9항)
  var REP = {}; [[J.GG, J.G], [J.K, J.G], [J.GS, J.G], [J.S, J.D], [J.SS, J.D], [J.J, J.D], [J.CH, J.D], [J.T, J.D], [J.H, J.D], [J.P, J.B], [J.BS, J.B]].forEach(function (x) { REP[x[0]] = x[1]; });
  function neutral(ch) {
    var c = ch.charCodeAt(0) - BASE; if (c < 0 || c > 11171) return ch;
    var jong = c % 28; return REP[jong] !== undefined ? String.fromCharCode(BASE + c - jong + REP[jong]) : ch;
  }
  function analyzeWord(word) {
    var syl = Array.prototype.map.call(word, parts);
    var marks = [];
    var nExc = hits(word, N_EXCEPTIONS);
    var lIns = hits(word, L_INSERT);

    function inException(list, i) {
      // i번째 음절과 i+1번째 음절이 같은 예외 낱말 안에 함께 있는가
      return list.some(function (h) { return i >= h.at && i + 1 < h.at + h.len; });
    }
    function add(m) { marks.push(m); }
    function pair(i) { return word[i] + word[i + 1]; }

    for (var i = 0; i < syl.length; i++) {
      var s = syl[i], prev = syl[i - 1], next = syl[i + 1];

      // ── 첫소리 ㄹ ──
      if (s.cho === C.R) {
        if (!prev) {
          add({ i: i, part: 'onset', kind: 'start', roman: 'r', rule: 'start',
            heard: word[i] });
        } else if (prev.jong === J.NONE) {
          add({ i: i, part: 'onset', kind: 'tap', roman: 'r', rule: 'between-vowels', heard: pair(i - 1) });
        } else if (prev.jong === J.L || prev.jong === J.LB || prev.jong === J.LS || prev.jong === J.LT) {
          // 앞 받침의 ㄹ과 함께 겹 L — 받침 쪽에서 이미 'll'로 적었다
          add({ i: i, part: 'onset', kind: 'll', roman: 'l', rule: 'double-l', heard: pair(i - 1), with: i - 1 });
        } else if (prev.jong === J.LH) {
          add({ i: i, part: 'onset', kind: 'll', roman: 'l', rule: 'double-l', heard: compose(prev.cho, prev.jung, J.L) + word[i], with: i - 1 });
        } else if (prev.jong === J.N || prev.jong === J.NH) {
          if (inException(nExc, i - 1)) {
            add({ i: i, part: 'onset', kind: 'n', roman: 'n', rule: 'n-exception',
              heard: word[i - 1] + compose(C.N, s.jung, s.jong) });
          } else {
            add({ i: i, part: 'onset', kind: 'll', roman: 'l', rule: 'n-to-l', changed: i - 1,
              heard: compose(prev.cho, prev.jung, J.L) + word[i] });
          }
        } else if (prev.jong === J.M || prev.jong === J.NG) {
          add({ i: i, part: 'onset', kind: 'n', roman: 'n', rule: 'after-m-ng',
            heard: word[i - 1] + compose(C.N, s.jung, s.jong) });
        } else if (VELAR.indexOf(prev.jong) >= 0 || prev.jong === J.LG) {
          add({ i: i, part: 'onset', kind: 'n', roman: 'n', rule: 'after-k', changed: i - 1,
            heard: compose(prev.cho, prev.jung, J.NG) + compose(C.N, s.jung, s.jong) });
        } else if (LABIAL.indexOf(prev.jong) >= 0) {
          add({ i: i, part: 'onset', kind: 'n', roman: 'n', rule: 'after-p', changed: i - 1,
            heard: compose(prev.cho, prev.jung, J.M) + compose(C.N, s.jung, s.jong) });
        } else {
          // ㄷ 무리·ㄻ 등 — 한 낱말 안에서는 드물다
          add({ i: i, part: 'onset', kind: 'other', roman: '', rule: 'unusual', heard: pair(i - 1) });
        }
      }

      // ── 받침 ㄹ과 ㄹ이 든 겹받침 ──
      var j = s.jong;
      if (j === J.L) {
        if (!next) add({ i: i, part: 'coda', kind: 'l', roman: 'l', rule: 'end', heard: word[i] });
        else if (next.cho === C.R) add({ i: i, part: 'coda', kind: 'll', roman: 'll', rule: 'double-l', heard: pair(i), with: i + 1 });
        else if (next.cho === C.N) add({ i: i, part: 'coda', kind: 'll', roman: 'll', rule: 'l-n-to-ll', changed: i + 1,
          heard: word[i] + compose(C.R, next.jung, next.jong) });
        else if (next.cho === C.IEUNG) {
          if (inException(lIns, i)) {
            add({ i: i, part: 'coda', kind: 'll', roman: 'll', rule: 'l-insert',
              heard: word[i] + compose(C.R, next.jung, next.jong) });
          } else {
            add({ i: i, part: 'coda', kind: 'tap', roman: 'r', rule: 'slides',
              heard: compose(s.cho, s.jung, J.NONE) + compose(C.R, next.jung, next.jong) });
          }
        } else if (next.cho === C.H) add({ i: i, part: 'coda', kind: 'l', roman: 'l', rule: 'before-h', heard: word[i] });
        else add({ i: i, part: 'coda', kind: 'l', roman: 'l', rule: 'before-consonant', heard: word[i] });
      } else if (j === J.LG) {
        if (next && next.cho === C.IEUNG) add({ i: i, part: 'coda', kind: 'l', roman: 'l', rule: 'cluster-before-vowel',
          heard: compose(s.cho, s.jung, J.L) + compose(C.G, next.jung, next.jong) });
        else if (next && (next.cho === 0 || next.cho === 1)) add({ i: i, part: 'coda', kind: 'maybe', roman: 'l / —', rule: 'lg-before-g', heard: word[i] });
        else add({ i: i, part: 'coda', kind: 'silent', roman: '', rule: 'lg-silent', heard: compose(s.cho, s.jung, J.G) });
      } else if (j === J.LM) {
        if (next && next.cho === C.IEUNG) add({ i: i, part: 'coda', kind: 'l', roman: 'l', rule: 'cluster-before-vowel',
          heard: compose(s.cho, s.jung, J.L) + compose(C.M, next.jung, next.jong) });
        else add({ i: i, part: 'coda', kind: 'silent', roman: '', rule: 'lm-silent', heard: compose(s.cho, s.jung, J.M) });
      } else if (j === J.LB) {
        var isBalp = word[i] === '밟', isNeolp = word[i] === '넓' && next && (word[i + 1] === '죽' || word[i + 1] === '둥' || word[i + 1] === '적');
        if (next && next.cho === C.IEUNG) add({ i: i, part: 'coda', kind: 'l', roman: 'l', rule: 'cluster-before-vowel',
          heard: compose(s.cho, s.jung, J.L) + compose(7, next.jung, next.jong) });
        else if (isBalp || isNeolp) add({ i: i, part: 'coda', kind: 'silent', roman: '', rule: 'lb-silent', heard: compose(s.cho, s.jung, J.B) });
        else add({ i: i, part: 'coda', kind: 'l', roman: 'l', rule: 'lb-l', heard: compose(s.cho, s.jung, J.L) });
      } else if (j === J.LP) {
        if (next && next.cho === C.IEUNG) add({ i: i, part: 'coda', kind: 'l', roman: 'l', rule: 'cluster-before-vowel',
          heard: compose(s.cho, s.jung, J.L) + compose(17, next.jung, next.jong) });
        else add({ i: i, part: 'coda', kind: 'silent', roman: '', rule: 'lp-silent', heard: compose(s.cho, s.jung, J.B) });
      } else if (j === J.LT && next && next.cho === C.N) {
        // 제20항 [붙임]: ㄾ 뒤 첫소리 ㄴ도 ㄹ(핥네 [할레])
        add({ i: i, part: 'coda', kind: 'll', roman: 'll', rule: 'l-n-to-ll', changed: i + 1,
          heard: compose(s.cho, s.jung, J.L) + compose(C.R, next.jung, next.jong) });
      } else if (j === J.LS || j === J.LT) {
        add({ i: i, part: 'coda', kind: 'l', roman: 'l', rule: 'cluster-l', heard: compose(s.cho, s.jung, J.L) });
      } else if (j === J.LH) {
        if (next && next.cho === C.IEUNG) add({ i: i, part: 'coda', kind: 'tap', roman: 'r', rule: 'lh-slides',
          heard: compose(s.cho, s.jung, J.NONE) + compose(C.R, next.jung, next.jong) });
        else if (next && next.cho === C.N) add({ i: i, part: 'coda', kind: 'll', roman: 'll', rule: 'l-n-to-ll', changed: i + 1,
          heard: compose(s.cho, s.jung, J.L) + compose(C.R, next.jung, next.jong) });
        else add({ i: i, part: 'coda', kind: 'l', roman: 'l', rule: 'cluster-l', heard: compose(s.cho, s.jung, J.L) });
      }
    }
    marks.forEach(function (m) {
      // [ ] 안의 마지막 음절이 낱말 끝이면 대표음으로
      var endsAt = m.i + (m.heard.length - 1) - (m.part === 'onset' && m.heard.length > 1 ? 1 : 0);
      if (endsAt === word.length - 1 && m.heard) m.heard = m.heard.slice(0, -1) + neutral(m.heard.slice(-1));
    });
    return { word: word, marks: marks };
  }

  // 글 전체 — 한글 음절이 이어진 덩어리마다 판정. 띄어 쓴 낱말 사이로는 넘어가지 않는다.
  function analyze(text) {
    var words = [], cur = '', start = 0;
    var src = String(text || '').normalize('NFC');
    for (var k = 0; k <= src.length; k++) {
      var ch = src[k];
      if (ch && isHangul(ch)) { if (!cur) start = k; cur += ch; }
      else if (cur) { var w = analyzeWord(cur); w.start = start; words.push(w); cur = ''; }
    }
    return words;
  }

  // 낱말 하나를 한 줄로 요약할 때 쓰는 ㄹ 소리 목록(겹 L은 한 번만)
  function summary(result) {
    var seen = {};
    return result.marks.filter(function (m) {
      if (m.kind === 'll' && m.part === 'onset' && m.with !== undefined) { if (seen[m.with]) return false; }
      if (m.kind === 'll') seen[m.i] = true;
      return true;
    }).map(function (m) { return m.kind; });
  }

  var API = { analyze: analyze, analyzeWord: analyzeWord, summary: summary, N_EXCEPTIONS: N_EXCEPTIONS, L_INSERT: L_INSERT,
    _parts: parts, _compose: compose, CHO: CHO, JUNG: JUNG, JONG: JONG };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.SynkRL = API;
})(typeof self !== 'undefined' ? self : this);
