/* 내 이름, 한글로 — 로마자 이름(스페인어·포르투갈어·영어)을 외래어 표기법대로 한글로 옮긴다.
 * 근거: 국립국어원 외래어 표기법(문화체육관광부 고시) — 표 2 에스파냐어 자모와 한글 대조표 · 제3장 제4절 에스파냐어의 표기,
 *       표 17 포르투갈어 자모와 한글 대조표 · 제3장 제19절 포르투갈어의 표기, 제1장 제3·4항(받침 일곱 개, 된소리 쓰지 않음).
 * 영어는 철자만으로 소리를 알 수 없어 규칙을 돌리지 않고 이름 목록(names.js)만 쓴다.
 * AI·네트워크·기록 없음. 같은 입력에는 늘 같은 결과.
 */
(function (root) {
  'use strict';

  var BASE = 0xAC00;
  var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  var JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  var JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  function compose(s) {
    return String.fromCharCode(BASE + (CHO.indexOf(s.cho) * 21 + JUNG.indexOf(s.jung)) * 28 + JONG.indexOf(s.jong || ''));
  }

  // 모음과 반모음이 합쳐진 한글 모음
  var V = { a: 'ㅏ', e: 'ㅔ', i: 'ㅣ', o: 'ㅗ', u: 'ㅜ', y: 'ㅡ' };   // y = 「으」(포르투갈어 어말 e)
  var YV = { a: 'ㅑ', e: 'ㅖ', i: 'ㅣ', o: 'ㅛ', u: 'ㅠ' };
  var WV = { a: 'ㅘ', e: 'ㅞ', i: 'ㅟ', o: 'ㅝ', u: 'ㅜ' };

  function strip(ch) {
    return ({ 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'à': 'a', 'è': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u' })[ch] || ch;
  }
  var isV = function (ch) { return /[aeiouáéíóúü]/.test(ch || ''); };

  /* ── 스페인어 ──────────────────────────────────────────────────────────
   * 소리 조각 목록을 만든 뒤(표 2), 받침·홀로 서기를 정해 음절로 묶는다.
   * 조각: { t:'C', on:초성, coda:받침 또는 null, alone:홀로 설 때의 음절, rule } · { t:'G', g:'y'|'w', rule } · { t:'V', v:'a'…, rule }
   */
  function esTokens(w) {
    var s = w.toLowerCase().normalize('NFC');
    var out = [], i = 0, n = s.length;
    function C(on, coda, alone, rule, src) { out.push({ t: 'C', on: on, coda: coda, alone: alone, rule: rule, src: src }); }
    while (i < n) {
      var ch = s[i], nx = s[i + 1], nx2 = s[i + 2];
      var vNext = isV(nx);
      if (isV(ch)) {
        out.push({ t: 'V', v: strip(ch === 'ü' ? 'u' : ch), rule: 'vowel', src: ch });
        i++; continue;
      }
      switch (ch) {
        case 'c':
          if (nx === 'h') { C('ㅊ', null, '치', 'ch', 'ch'); i += 2; continue; }
          if (nx === 'c') { C('ㄱ', 'ㄱ', '크', 'cc', 'c'); i++; continue; }          // -cc- → ㄱㅅ(제2항 다만)
          if (nx === 'e' || nx === 'i' || nx === 'é' || nx === 'í') { C('ㅅ', null, '스', 'c-soft', 'c'); i++; continue; }  // 제3항
          C('ㅋ', (nx === 'l' || nx === 'r') ? null : 'ㄱ', '크', 'c', 'c'); i++; continue;
        case 'q':
          if (nx === 'u') {
            if (/[eéií]/.test(nx2 || '')) { C('ㅋ', null, '크', 'qu-ei', 'qu'); i += 2; continue; }   // 제1항: qu + e·i → ㅋ
            if (/[aá]/.test(nx2 || '')) { C('ㅋ', null, '크', 'qu-a', 'qu'); out.push({ t: 'G', g: 'w', rule: 'qu-a', src: '' }); i += 2; continue; }  // 콰
            C('ㅋ', null, '크', 'qu-o', 'q'); i++; continue;                                           // qu + o → 쿠
          }
          C('ㅋ', null, '크', 'k', 'q'); i++; continue;
        case 'g':
          if (nx === 'u' && /[eéií]/.test(nx2 || '')) { C('ㄱ', null, '그', 'gu-ei', 'gu'); i += 2; continue; }   // 제1항: gu + e·i → ㄱ
          if (nx === 'u' && /[aá]/.test(nx2 || '')) { C('ㄱ', null, '그', 'gu-a', 'gu'); out.push({ t: 'G', g: 'w', rule: 'gu-a', src: '' }); i += 2; continue; }  // 과
          if (nx === 'ü') { C('ㄱ', null, '그', 'g', 'g'); i++; continue; }                         // güe·güi → 구에·구이
          if (/[eéií]/.test(nx || '')) { C('ㅎ', null, '흐', 'g-soft', 'g'); i++; continue; }      // 제3항: g + e·i → ㅎ
          C('ㄱ', null, '그', 'g', 'g'); i++; continue;
        case 'j':
          if (i === n - 1) { out.push({ t: 'X', rule: 'j-final', src: 'j' }); i++; continue; }      // reloj 렐로
          C('ㅎ', null, '흐', 'j', 'j'); i++; continue;
        case 'h':
          out.push({ t: 'X', rule: 'h', src: 'h' }); i++; continue;                                   // hipo 이포
        case 'l':
          if (nx === 'l') { out.push({ t: 'G', g: 'y', rule: 'll', src: 'll' }); i += 2; continue; } // llama 야마
          C('ㄹ', 'ㄹ', '르', 'l', 'l'); i++; continue;
        case 'r':
          if (nx === 'r') { C('ㄹ', null, '르', 'rr', 'rr'); i += 2; continue; }                      // 제2항 carrera 카레라
          C('ㄹ', null, '르', 'r', 'r'); i++; continue;
        case 'ñ':
          C('ㄴ', null, '니', 'enye', 'ñ'); out.push({ t: 'G', g: 'y', rule: 'enye', src: '' }); i++; continue;  // 마냐나
        case 'y':
          if (vNext) { out.push({ t: 'G', g: 'y', rule: 'y', src: 'y' }); i++; continue; }
          out.push({ t: 'V', v: 'i', rule: 'y-vowel', src: 'y' }); i++; continue;                    // rey 레이
        case 'w':
          out.push({ t: 'G', g: 'w', rule: 'w', src: 'w' }); i++; continue;
        case 'x':
          if (vNext && out.length === 0) { C('ㅅ', null, '스', 'x-initial', 'x'); i++; continue; }   // 제4항: 어두 → ㅅ
          C('ㄱ', 'ㄱ', '크', 'x', 'x');                                                              // 어중 → ㄱㅅ, 자음 앞·어말 → ㄱ스
          C('ㅅ', null, '스', 'x', '');
          i++; continue;
        case 'n':
          C('ㄴ', 'ㄴ', '느', 'n', 'n'); i++; continue;
        case 'm':
          C('ㅁ', 'ㅁ', '므', 'm', 'm'); i++; continue;
        case 'p':
          C('ㅍ', (nx === 'l' || nx === 'r' || !nx) ? null : 'ㅂ', '프', 'p', 'p'); i++; continue;
        case 'b': C('ㅂ', null, '브', 'b', 'b'); i++; continue;
        case 'v': C('ㅂ', null, '브', 'v', 'v'); i++; continue;
        case 'd': C('ㄷ', null, '드', 'd', 'd'); i++; continue;
        case 'f': C('ㅍ', null, '프', 'f', 'f'); i++; continue;
        case 'k': C('ㅋ', null, '크', 'k', 'k'); i++; continue;
        case 's': C('ㅅ', null, '스', 's', 's'); i++; continue;
        case 't': C('ㅌ', null, '트', 't', 't'); i++; continue;
        case 'z': C('ㅅ', null, '스', 'z', 'z'); i++; continue;
        default: i++; continue;   // 따옴표 등은 건너뛴다
      }
    }
    // 같은 자음이 겹치면 하나로(제2항). ll·rr·cc는 위에서 따로 다뤘다. 묵음(X)은 규칙 기록만 남기고 뺀다.
    var merged = [];
    merged.silent = [];
    out.forEach(function (tk) {
      if (tk.t === 'X') { merged.silent.push(tk.rule); return; }
      var prev = merged[merged.length - 1];
      if (tk.t === 'C' && prev && prev.t === 'C' && prev.src === tk.src && tk.src && tk.src.length === 1 && tk.src !== 'c' && tk.src !== 'x') {
        prev.doubled = true; return;
      }
      merged.push(tk);
    });
    return merged;
  }

  var VELAR_ON = { 'ㄱ': 1, 'ㅋ': 1 };

  function assemble(tokens, lang) {
    var syl = [], used = {};
    function last() { return syl[syl.length - 1]; }
    function note(rule) { used[rule] = true; }
    (tokens.silent || []).forEach(note);
    for (var k = 0; k < tokens.length; k++) {
      var tk = tokens[k];
      if (tk.t === 'X') { note(tk.rule); continue; }
      note(tk.rule);
      if (tk.doubled) note('double');
      if (tk.t === 'V') { syl.push({ cho: 'ㅇ', jung: V[tk.v], jong: '' }); continue; }
      if (tk.t === 'G') {
        var nv = tokens[k + 1];
        if (nv && nv.t === 'V') { syl.push({ cho: 'ㅇ', jung: (tk.g === 'y' ? YV : WV)[nv.v], jong: '' }); note(nv.rule); k++; }
        else syl.push({ cho: 'ㅇ', jung: tk.g === 'y' ? 'ㅣ' : 'ㅜ', jong: '' });
        continue;
      }
      // 자음
      var nx = tokens[k + 1], nx2 = tokens[k + 2];
      if (tk.rule === 'nasal') { if (syl.length && !last().jong) last().jong = 'ㅇ'; continue; }
      if (nx && nx.t === 'V') {
        // 어중의 l이 모음 앞에 오면 ㄹㄹ(제5항): 앞 음절에 받침이 없으면 ㄹ을 받친다
        if (tk.src === 'l' && syl.length && !last().jong) { last().jong = 'ㄹ'; note('l-double'); }
        syl.push({ cho: tk.on, jung: V[nx.v], jong: '' }); note(nx.rule); k++;
        continue;
      }
      if (nx && nx.t === 'G' && nx2 && nx2.t === 'V') {
        if (tk.src === 'l' && syl.length && !last().jong) { last().jong = 'ㄹ'; note(tk.lh ? 'lh' : 'l-double'); }
        syl.push({ cho: tk.on, jung: (nx.g === 'y' ? YV : WV)[nx2.v], jong: '' }); note(nx.rule); note(nx2.rule); k += 2;
        continue;
      }
      if (nx && nx.t === 'G' && (!nx2 || nx2.t !== 'V')) {   // ñ·ch·x 뒤 모음이 없으면 「니·시」
        syl.push({ cho: tk.on, jung: 'ㅣ', jong: '' }); k++; continue;
      }
      // 자음 앞·어말: 받침으로 앉거나 홀로 선다
      var coda = tk.coda;
      if (tk.rule === 'n' && nx && nx.t === 'C' && VELAR_ON[nx.on] && nx.rule !== 'c-soft') { coda = 'ㅇ'; note('n-velar'); }
      if (tk.rule === 'n' && nx && nx.t === 'C' && nx.on === 'ㅎ' && nx.rule === 'g-soft') { coda = 'ㅇ'; note('n-velar'); }
      if (coda && syl.length && !last().jong) { last().jong = coda; continue; }
      // 홀로 서는 음절은 대조표의 「자음 앞·어말」 칸(브·드·스…) 그대로. ch·ñ만 「치·니」
      syl.push({ cho: tk.on, jung: (tk.rule === 'ch' || tk.rule === 'enye') ? 'ㅣ' : 'ㅡ', jong: '' });
      if (last().jung === 'ㅡ') note('eu');
    }
    return { text: syl.map(compose).join(''), rules: Object.keys(used) };
  }

  function es(word) { return assemble(esTokens(word), 'es'); }

  /* ── 포르투갈어 ─────────────────────────────────────────────────────────
   * 표 17과 제19절. br=true면 「브라질 포르투갈어에서」 조항(제3항·제5항 2·제14항·제15항 2)과 표 17의 (브)를 켠다.
   * 강세(※): 강세 표시 → l·r·z·i·u·im·um·ã·ão·ões(그리고 -is·-us)로 끝나면 끝 음절 → 그 밖에는 끝에서 둘째 음절.
   */
  var PV = /[aeiouáéíóúâêôãõàü]/;
  var DIPH = ['ãe', 'ão', 'õe', 'ai', 'au', 'ei', 'eu', 'iu', 'oi', 'ou', 'ui'];
  function ptNuclei(s) {
    // 음절 핵(모음 덩어리)의 시작·끝 위치. gu·qu + e·i의 u는 소리 나지 않아 빼고 센다
    var out = [], i = 0;
    while (i < s.length) {
      var ch = s[i];
      if (ch === 'u' && (s[i - 1] === 'g' || s[i - 1] === 'q') && /[eéêií]/.test(s[i + 1] || '')) { i++; continue; }
      if (!PV.test(ch)) { i++; continue; }
      var two = s.slice(i, i + 2);
      var plain = two.normalize('NFD').replace(/[́̂̀]/g, '').normalize('NFC');
      if (DIPH.indexOf(plain) >= 0 && !/[íú]/.test(two[1])) { out.push({ a: i, b: i + 1 }); i += 2; continue; }
      out.push({ a: i, b: i }); i++;
    }
    return out;
  }
  function ptStress(s, nuc) {
    for (var k = 0; k < nuc.length; k++) if (/[áéíóúâêô]/.test(s.slice(nuc[k].a, nuc[k].b + 1))) return k;
    for (k = 0; k < nuc.length; k++) if (/[ãõ]/.test(s.slice(nuc[k].a, nuc[k].b + 1))) return k;
    if (/(l|r|z|i|u|im|um|is|us|ins|uns)$/.test(s)) return nuc.length - 1;
    return Math.max(0, nuc.length - 2);
  }

  function ptTokens(w, br, opts) {
    var s = w.toLowerCase().normalize('NFC').replace(/th/g, 't').replace(/ph/g, 'f').replace(/y(?![aeiouáéíóúâêôãõ])/g, 'i')
      .replace(/([bcdfgklmnptvz])\1/g, function (m, c) { return c; });
    var n = s.length, out = [], silent = [];
    var nuc = ptNuclei(s), st = ptStress(s, nuc);
    var stressedAt = {};
    if (nuc[st]) for (var q = nuc[st].a; q <= nuc[st].b; q++) stressedAt[q] = true;
    var isVowel = function (c) { return PV.test(c || ''); };
    function C(on, coda, alone, rule, src) { out.push({ t: 'C', on: on, coda: coda, alone: alone, rule: rule, src: src }); }
    function Vt(v, rule) { out.push({ t: 'V', v: v, rule: rule || 'vowel' }); }
    function nasal() { out.push({ t: 'C', on: 'ㅇ', coda: 'ㅇ', alone: null, rule: 'nasal', src: '' }); }
    // 어말 e(강세 없음)·어말 -es 판정
    var finalE = function (k) { return k === n - 1 && s[k] === 'e'; };
    var finalEs = function (k) { return k === n - 2 && s[k] === 'e' && s[n - 1] === 's' && !stressedAt[k]; };
    var i = 0;
    while (i < n) {
      var ch = s[i], nx = s[i + 1], nx2 = s[i + 2];
      if (isVowel(ch)) {
        if (ch === 'ã') { Vt('a'); nasal(); if (nx === 'o') { i += 2; continue; } if (nx === 'e') { Vt('i', 'ae'); i += 2; continue; } i++; continue; }
        if (ch === 'õ') { Vt('o'); nasal(); if (nx === 'e') { Vt('i', 'oe'); i += 2; continue; } i++; continue; }
        if (ch === 'o' && nx === 'u') { Vt('o', 'ou'); i += 2; continue; }                                    // ou → 오
        if (ch === 'e' || ch === 'é' || ch === 'ê') {
          if (ch === 'e' && i === 0 && !stressedAt[0] && n > 1 && !(nuc[0] && nuc[0].b > nuc[0].a) && !(opts && opts.keepE)) { Vt('i', 'e-initial'); i++; continue; }   // 제14항 어두 무강세 e → 이
          if (ch === 'e' && finalE(i)) { Vt(br ? 'i' : 'y', 'e-final'); i++; continue; }                     // 어말 e → 으 / (브) 이
          if (ch === 'e' && finalEs(i)) {
            var pc = s[i - 1];
            if (/[pbmfv]/.test(pc || '')) Vt('e', 'es-final-e');                                              // 제15항 1
            else Vt(br ? 'i' : 'y', 'es-final');                                                              // 제15항 2
            i++; continue;
          }
          Vt('e'); i++; continue;
        }
        if (ch === 'o') {
          if (i === n - 1 || (i === n - 2 && nx === 's')) { Vt('u', 'o-final'); i++; continue; }           // 제13항
          Vt('o'); i++; continue;
        }
        Vt(strip(ch === 'ü' ? 'u' : ch === 'â' ? 'a' : ch === 'ô' ? 'o' : ch)); i++; continue;
      }
      var vNext = isVowel(nx);
      // 브라질: d·t + i, d·t + 어말 e, d·t + 어말 -es → ㅈ·ㅊ (제3항)
      var brSoft = br && (nx === 'i' || nx === 'í' || finalE(i + 1) || finalEs(i + 1));
      switch (ch) {
        case 'c':
          if (nx === 'h') {
            if (i === n - 3 && nx2 === 'e') { C('ㅅ', null, '시', 'che-final', 'ch'); Vt('i', 'che-final'); i += 3; continue; }  // 제4항
            C('ㅅ', null, '시', 'ch', 'ch'); out.push({ t: 'G', g: 'y', rule: 'ch' }); i += 2; continue;
          }
          if (/[eéêií]/.test(nx || '')) { C('ㅅ', null, '스', 'c-soft', 'c'); i++; continue; }               // 제1항
          if (vNext) { C('ㅋ', null, '크', 'c', 'c'); i++; continue; }
          C('ㅋ', (nx === 'l' || nx === 'r') ? null : 'ㄱ', '크', 'c', 'c'); i++; continue;
        case 'ç': C('ㅅ', null, '스', 'cedilla', 'ç'); i++; continue;
        case 'd': if (brSoft) { C('ㅈ', null, '지', 'dt-br', 'd'); i++; continue; } C('ㄷ', null, '드', 'd', 'd'); i++; continue;
        case 't': if (brSoft) { C('ㅊ', null, '치', 'dt-br', 't'); i++; continue; } C('ㅌ', null, '트', 't', 't'); i++; continue;
        case 'g':
          if (nx === 'u' && /[eéêií]/.test(nx2 || '')) { C('ㄱ', null, '그', 'gu-ei', 'gu'); i += 2; continue; }   // 제2항
          if (/[eéêií]/.test(nx || '')) { C('ㅈ', null, '즈', 'g-soft', 'g'); i++; continue; }                    // 제1항
          C('ㄱ', null, '그', 'g', 'g'); i++; continue;
        case 'q':
          if (nx === 'u' && /[eéêií]/.test(nx2 || '')) { C('ㅋ', null, '크', 'qu-ei', 'qu'); i += 2; continue; }
          C('ㅋ', null, '크', 'k', 'q'); i++; continue;
        case 'h': silent.push('h'); i++; continue;
        case 'j': C('ㅈ', null, '즈', 'j-pt', 'j'); i++; continue;
        case 'l':
          if (nx === 'h') { C('ㄹ', null, '리', 'lh', 'l'); out[out.length - 1].lh = true; out.push({ t: 'G', g: 'y', rule: 'lh' }); i += 2; continue; }
          if (vNext) { C('ㄹ', 'ㄹ', '르', 'l', 'l'); i++; continue; }
          if (br && !(i === n - 1 && s[i - 1] === 'u')) { Vt('u', 'l-br'); i++; continue; }                   // (브) 자음 앞·어말 l → 우
          C('ㄹ', 'ㄹ', '르', 'l', 'l'); i++; continue;
        case 'm':
          if (vNext) { C('ㅁ', null, '므', 'm', 'm'); i++; continue; }
          C('ㅁ', i === n - 1 ? 'ㅇ' : 'ㅁ', '므', i === n - 1 ? 'mn-final' : 'm', 'm'); i++; continue;          // 제6항
        case 'n':
          if (nx === 'h') { C('ㄴ', null, '니', 'nh', 'n'); out.push({ t: 'G', g: 'y', rule: 'nh' }); i += 2; continue; }
          if (vNext) { C('ㄴ', null, '느', 'n', 'n'); i++; continue; }
          if (i === n - 1 || (i === n - 2 && nx === 's')) { C('ㄴ', 'ㅇ', '느', 'mn-final', 'n'); i++; continue; }  // 제6항(-ns 포함)
          var velar = nx === 'q' || ((nx === 'c' || nx === 'g') && !/[eéêií]/.test(nx2 || ''));
          C('ㄴ', velar ? 'ㅇ' : 'ㄴ', '느', velar ? 'n-velar' : 'n', 'n'); i++; continue;                        // 제7항
        case 'r':
          if (nx === 'r') { C('ㅎ', null, '흐', 'rr', 'rr'); i += 2; continue; }                                    // 제12항
          if (i === 0 || /[nls]/.test(s[i - 1] || '')) { C('ㅎ', null, '흐', 'r-h', 'r'); i++; continue; }          // 제8항
          C('ㄹ', null, '르', 'r', 'r'); i++; continue;
        case 's':
          if (nx === 's') { C('ㅅ', null, '스', 'ss', 'ss'); i += 2; continue; }
          if ((nx === 'c' && /[eéêií]/.test(nx2 || '')) || nx === 'ç') { C('ㅅ', null, '스', 'sc', 'sc'); i += 2; continue; }  // 제10항
          if (vNext) { C(isVowel(s[i - 1]) ? 'ㅈ' : 'ㅅ', null, '스', isVowel(s[i - 1]) ? 's-between' : 's', 's'); i++; continue; }  // 제9항 1
          if (!nx) { C('ㅅ', null, '스', 's', 's'); i++; continue; }
          if (/[bdgmnlrvjz]/.test(nx)) { C('ㅈ', null, '즈', 's-voiced', 's'); i++; continue; }                   // 제9항 2
          C('ㅅ', null, '스', 's', 's'); i++; continue;
        case 'x':
          if (nx === 'c' && /[eéêií]/.test(nx2 || '')) { C('ㅅ', null, '스', 'sc', 'xc'); i += 2; continue; }
          if (vNext && i === 1 && s[0] === 'e') { C('ㅈ', null, '즈', 'x-ex', 'x'); i++; continue; }              // 제11항: 어두 e + x + 모음 → ㅈ
          if (vNext) { C('ㅅ', null, '시', 'x-pt', 'x'); out.push({ t: 'G', g: 'y', rule: 'x-pt' }); i++; continue; }  // 시*
          C('ㅅ', null, '스', 'x-pt', 'x'); i++; continue;
        case 'z': if (vNext) { C('ㅈ', null, '즈', 'z-pt', 'z'); i++; continue; } C('ㅅ', null, '스', 'z-pt', 'z'); i++; continue;
        case 'b': C('ㅂ', null, '브', 'b', 'b'); i++; continue;
        case 'v': C('ㅂ', null, '브', 'v', 'v'); i++; continue;
        case 'w': C('ㅂ', null, '브', 'w-pt', 'w'); i++; continue;
        case 'y': out.push({ t: 'G', g: 'y', rule: 'y' }); i++; continue;
        case 'f': C('ㅍ', null, '프', 'f', 'f'); i++; continue;
        case 'k': C('ㅋ', null, '크', 'k', 'k'); i++; continue;
        case 'p': C('ㅍ', null, '프', 'p', 'p'); i++; continue;
        default: i++; continue;
      }
    }
    var merged = [];
    merged.silent = silent;
    out.forEach(function (tk) {
      var prev = merged[merged.length - 1];
      if (tk.t === 'C' && prev && prev.t === 'C' && prev.src === tk.src && tk.src && tk.src.length === 1 && /[bdfgklmnptvz]/.test(tk.src)) { prev.doubled = true; return; }  // 제12항
      merged.push(tk);
    });
    return merged;
  }

  function pt(word, br) { return assemble(ptTokens(word, br), br ? 'br' : 'pt'); }

  /* ── 이름 전체 ─────────────────────────────────────────────────────────
   * lookup(이름, 언어, 사전) → { text, words:[{ src, ko, source, rules, alts:[{ko, why}], common, wrong }], other:{…} }
   * source: usage(용례) · rule(규칙) · list(영어 용례 목록) · estimated(영어 추정) · missing(영어 목록에 없음)
   * 언어: es 에스파냐어 · br 브라질 포르투갈어 · pt 포르투갈 포르투갈어 · en 영어
   */
  var PARTICLES = { es: ['de', 'del'], br: ['da', 'das', 'de', 'do', 'dos'], pt: ['da', 'das', 'de', 'do', 'dos'] };
  var ARTICLES = { es: ['la', 'las', 'los'], br: [], pt: [] };

  function one(word, lang, dict) {
    var low = word.toLowerCase().normalize('NFC');
    var exc = dict && dict.exceptions && dict.exceptions[lang] && dict.exceptions[lang][low];
    if (lang === 'en') {
      var e = dict && dict.en && dict.en[low];
      if (!e) return { src: word, ko: '', source: 'missing', rules: [], alts: [] };
      return { src: word, ko: e.ko, source: e.status === 'estimated' ? 'estimated' : 'list', rules: [], alts: (e.common || []).map(function (c) { return { ko: c, why: 'common' }; }), wrong: e.wrong || [] };
    }
    var r = lang === 'es' ? es(word) : pt(word, lang === 'br');
    var res = { src: word, ko: r.text, source: 'rule', rules: r.rules, alts: [] };
    if (exc) { res.alts.push({ ko: r.text, why: 'rule' }); res.ko = exc.ko; res.source = 'usage'; }
    if (lang === 'es') {
      if (/^x[aeiouáéíóú]/.test(low)) res.alts.push({ ko: es('j' + word.slice(1)).text, why: 'x-mexico' });
      if (/tz/.test(low)) res.alts.push({ ko: es(word.replace(/tz/gi, 'ch')).text, why: 'tz-sound' });
      if (/ll(a|o)$/.test(low) && /ell(a|o)$/.test(low)) res.alts.push({ ko: es(word.replace(/ll/gi, 'l')).text, why: 'll-italian' });
    } else if (r.rules.indexOf('e-initial') >= 0 && !exc) {
      res.alts.push({ ko: assemble(ptTokens(word, lang === 'br', { keepE: true }), lang).text, why: 'e-initial' });
    }
    res.alts = res.alts.filter(function (a, i, all) { return a.ko && a.ko !== res.ko && all.findIndex(function (b) { return b.ko === a.ko; }) === i; });
    return res;
  }

  function lookup(name, lang, dict, noOther) {
    var raw = String(name || '').normalize('NFC').replace(/[^\p{L}\s'\-]/gu, ' ').trim();
    var parts = raw.split(/[\s\-]+/).filter(Boolean);
    var words = [], i = 0, P = PARTICLES[lang] || [], A = ARTICLES[lang] || [];
    while (i < parts.length) {
      var low = parts[i].toLowerCase();
      // 소사(de·del·da·dos…)는 뒤 요소에 붙여 쓴다(용례: 펠리페 데헤수스, 두스산투스). 접속사 y는 「이」
      if (lang === 'es' && low === 'y' && i > 0 && i < parts.length - 1) { words.push({ src: 'y', ko: '이', source: 'rule', rules: ['y-and'], alts: [] }); i++; continue; }
      if (P.indexOf(low) >= 0 && i < parts.length - 1) {
        var glue = [parts[i]]; i++;
        while (i < parts.length - 1 && A.indexOf(parts[i].toLowerCase()) >= 0) { glue.push(parts[i]); i++; }
        var head = glue.map(function (g) { return one(g, lang, dict); });
        var body = one(parts[i], lang, dict);
        words.push({ src: glue.concat([parts[i]]).join(' '), ko: head.map(function (h) { return h.ko; }).join('') + body.ko,
          source: body.source, rules: [].concat.apply(body.rules, head.map(function (h) { return h.rules; })).concat(['particle']), alts: [] });
        i++; continue;
      }
      words.push(one(parts[i], lang, dict)); i++;
    }
    var text = words.map(function (w) { return w.ko; }).join(' ');
    var other = {};
    if (lang !== 'en' && !noOther) ['es', 'br', 'pt'].forEach(function (L) {
      if (L === lang) return;
      var t = lookup(name, L, dict, true).text;
      if (t && t !== text) other[L] = t;
    });
    return { text: text, words: words, other: other, missing: words.some(function (w) { return w.source === 'missing'; }) };
  }

  // 자기소개 문장: 받침이 있으면 「이에요」, 없으면 「예요」
  function intro(ko) {
    var lastCh = String(ko || '').replace(/\s+$/, '').slice(-1);
    var code = lastCh.charCodeAt(0) - BASE;
    var hasJong = code >= 0 && code < 11172 && code % 28 !== 0;
    return '제 이름은 ' + ko + (hasJong ? '이에요' : '예요') + '.';
  }

  // 읽기 도우미: 음절마다 국어의 로마자 표기(소리 바뀜은 반영하지 않는다)
  var R_CHO = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
  var R_JUNG = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
  var R_JONG = ['','k','k','k','n','n','n','t','l','k','m','l','l','l','p','l','m','p','p','t','t','ng','t','t','k','t','p','t'];
  function readAloud(ko) {
    return String(ko || '').split(' ').map(function (word) {
      return Array.prototype.map.call(word, function (ch, i) {
        var c = ch.charCodeAt(0) - BASE;
        if (c < 0 || c > 11171) return ch;
        var prev = i > 0 ? word.charCodeAt(i - 1) - BASE : -1;
        var on = R_CHO[Math.floor(c / 588)];
        if (on === 'r' && prev >= 0 && prev <= 11171 && prev % 28 === 8) on = 'l';
        return on + R_JUNG[Math.floor((c % 588) / 28)] + R_JONG[c % 28];
      }).join('·');
    }).join('  ');
  }

  // 이름 전체: 낱말마다 옮기고 띄어 쓴다
  function convert(name, lang, opts) {
    var words = String(name || '').trim().split(/[\s\-]+/).filter(Boolean);
    var res = words.map(function (w) {
      if (lang === 'es') return es(w);
      if (lang === 'pt') return pt(w, false);
      if (lang === 'br') return pt(w, true);
      return { text: '', rules: [] };
    });
    var rules = {};
    res.forEach(function (r) { r.rules.forEach(function (x) { rules[x] = true; }); });
    return { text: res.map(function (r) { return r.text; }).join(' '), words: res, rules: Object.keys(rules) };
  }

  var API = { convert: convert, lookup: lookup, intro: intro, readAloud: readAloud, es: es, esTokens: esTokens, pt: pt, ptTokens: ptTokens, compose: compose };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.SynkName = API;
})(typeof self !== 'undefined' ? self : this);
