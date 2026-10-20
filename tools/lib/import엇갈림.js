'use strict';
/**
 * import 엇갈림 — 공개 주소 캐시(10분) 동안 ES 모듈끼리 이름이 엇갈려 앱이 못 뜨는 짝을 센다(tools/공개.js 미리 보기).
 *
 * synk.im 공개 주소는 모두 `Cache-Control: max-age=600`이고 ES 모듈은 서로 ?v= 없이 부른다. 새로 고침은 진입 페이지만 다시
 * 묻고 하위 모듈은 10분 안이면 브라우저 캐시를 쓴다. 그래서 한 번에 올리면 「새 모듈 + 캐시에 남은 옛 모듈」이 만나
 * 「does not provide an export named …」로 모듈 연결이 깨진다(docs/현장노트/배포_공개.md 「새 화면이 계정 묶음의 새 이름을 부르면」).
 *
 * 공개본(옛 판)과 후보(새 판)의 .js·.mjs 정적 import·export를 읽어 짝(부르는 모듈 → 대상 모듈 + 이름들)을 센다.
 *   ① 바뀐 모듈(새 파일 포함)의 새 판이 바뀐 다른 모듈의 옛 판에 없는 이름을 부른다 — 대상 옛 판이 캐시에 남은 동안 깨진다.
 *   ② 바뀐 모듈의 옛 판이 새 판에서 없어진 이름·지운 모듈을 부른다 — 부르는 쪽 옛 판이 캐시에 남은 동안 깨진다.
 *   ③ 새 판끼리 안 맞는다 — 안 바뀌는 모듈(또는 바뀐 모듈의 새 판)이 새 판에 없는 이름·없는 모듈을 부른다. 캐시와 상관없이 깨진다.
 *      아무 파일도 부르지 않는 모듈(쓰이나)이 부르는 ③은 「안쓰임」으로 달아 나눔을 막지 않는다(공개.js는 알림으로 둔다).
 * 세지 않는 것: 새 파일로 가는 import의 ①(캐시에 옛 판이 없다) · ?v= 값이 공개본에서 그 모듈을 부르던 값과 다른 주소의 ①(처음
 * 쓰는 주소라 캐시에 없다) · 공개본에서 이미 깨져 있던 짝 · `export * from`이 있는 모듈에 없는 이름(default 말고는 「알 수 없음」) ·
 * 동적 import()·바깥 주소·맨 이름(bare) 지정자·.js·.mjs가 아닌 대상·HTML 안 모듈 스크립트.
 * 주석·문자열·틀 글·정규식은 토큰으로 읽어 걷어 낸다(정규식이 줄 끝까지 안 닫히면 나눗셈으로 다시 본다).
 *
 * ①·②가 있고 ③이 없으면(사람이 넘긴 ③ 말고) 1단계(옛 화면과도 맞는 쪽)를 고른다: ① 대상·② 부르는 쪽 가운데 남이 부르는 이름을 빼지 않고 바뀐
 * 모듈의 새 이름을 부르지 않는 모듈(같이 1단계에 올라가는 대상을 처음 쓰는 ?v= 주소로 부르는 것은 된다)과 그것이 부르는 새 판만.
 * import로는 맞아도 화면과 함께 바뀐 모듈은 2단계에 두고, 지우는 모듈은 늘 마지막 단계다. 1단계 뒤 10분이 지나 남은 것을 다시
 * 미리 보면 그 판 기준으로 다음 나눔이 나온다.
 *
 * 시험: node --test tests/공개.test.js
 */
const path = require('path');

// ── 토큰 ──────────────────────────────────────────────────────────────────────

const 낱말 = 1, 글 = 2, 틀 = 3, 식 = 4, 수 = 5, 부호 = 6;
/** 뒤에 오는 `/`가 정규식인 낱말(다른 낱말 뒤는 나눗셈) */
const 식앞낱말 = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'default', 'do', 'else', 'yield', 'await']);
/** 뒤에 오는 `{`가 객체(식)인 낱말 — 다른 낱말(else·do·클래스 이름…) 뒤는 블록 */
const 객체앞낱말 = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'yield', 'await']);
/** 이 머리의 `(…)` 뒤 `/`는 정규식이다(if (x) /re/.test(y)) */
const 조건낱말 = new Set(['if', 'while', 'for', 'with']);
/** 줄이 바뀐 뒤 이 낱말이 오면 앞 문장이 끝난 것으로 본다(export const a = 1 ⏎ export …) */
const 문장머리 = new Set(['export', 'import', 'const', 'let', 'var', 'function', 'class', 'if', 'for', 'while', 'do', 'return', 'switch', 'try', 'throw']);

const 줄끝인가 = (c) => c === 10 || c === 13 || c === 0x2028 || c === 0x2029;
const 빈칸인가 = (c) => c === 32 || c === 9 || c === 11 || c === 12 || c === 0xa0 || c === 0xfeff || c === 0x1680
  || (c >= 0x2000 && c <= 0x200a) || c === 0x202f || c === 0x205f || c === 0x3000;
const 숫자인가 = (c) => c >= 48 && c <= 57;
const 낱말글자 = (c) => (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || 숫자인가(c) || c === 36 || c === 95 || c === 35 || c === 92
  || (c > 127 && !빈칸인가(c) && !줄끝인가(c));

const 풀이표 = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' };
/** 따옴표 글의 이스케이프를 푼다(지정자·이름에 쓰이는 만큼) */
function 풀어쓰기(s) {
  if (!s.includes('\\')) return s;
  return s.replace(/\\(u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|\r\n|[\s\S])/g, (전체, 뒤, 큰, 넷, 둘) => {
    if (큰) return String.fromCodePoint(parseInt(큰, 16));
    if (넷 || 둘) return String.fromCharCode(parseInt(넷 || 둘, 16));
    if (뒤 === '\r\n' || 줄끝인가(뒤.charCodeAt(0))) return '';
    return 풀이표[뒤] ?? 뒤;
  });
}

/**
 * 글을 토큰으로 나눈다(주석은 버린다). 토큰: {k: 종류, v: 값(낱말·글·부호), 줄: 앞에 줄바꿈이 있었나}.
 * 틀 글은 `${`마다 부호 「`${」·「}${」와 끝 「}`」(종류 틀)로 나뉘고, 그 안의 식은 그대로 토큰이 된다.
 */
function 토큰나누기(src) {
  const 목록 = [];
  const 쌓임 = []; // 여는 괄호: {v: '(' | '[' | '{' | '`${', 조건, 식}
  const n = src.length;
  let i = 0, 줄 = false, 문제 = null;
  if (src.startsWith('#!')) while (i < n && !줄끝인가(src.charCodeAt(i))) i++;
  const 넣기 = (k, v, 덧) => { const t = { k, v, 줄 }; if (덧) Object.assign(t, 덧); 줄 = false; 목록.push(t); };
  const 점뒤 = () => { const u = 목록[목록.length - 2]; return Boolean(u && u.k === 부호 && (u.v === '.' || u.v === '?.')); };
  /** 지금 `/`가 정규식을 열 수 있나 */
  const 식자리 = () => {
    const t = 목록[목록.length - 1];
    if (!t) return true;
    if (t.k === 낱말) return 식앞낱말.has(t.v) && !점뒤();
    if (t.k !== 부호) return false;
    if (t.v === ')') return Boolean(t.조건);
    if (t.v === '}') return !t.식;
    return t.v !== ']' && t.v !== '++' && t.v !== '--';
  };
  /**
   * 지금 `{`가 객체(식)를 여나(아니면 블록). `:` 뒤는 블록 안이면 case·default·라벨의 블록, 맨 위에서는 문장 머리 낱말 뒤면
   * 라벨의 블록(outer: {), 그 밖(객체·괄호 안, 삼항)은 값(객체)으로 본다.
   */
  const 객체자리 = () => {
    const t = 목록[목록.length - 1];
    if (!t) return false;
    if (t.k === 낱말) return 객체앞낱말.has(t.v) && !점뒤();
    if (t.k !== 부호) return false;
    if (t.v === ':') {
      const 위 = 쌓임[쌓임.length - 1];
      if (위) return !(위.v === '{' && !위.식);
      const u = 목록[목록.length - 2], w = 목록[목록.length - 3];
      return !(u && u.k === 낱말 && (!w || u.줄 || (w.k === 부호 && (w.v === ';' || w.v === '{' || w.v === '}'))));
    }
    return !(t.v === ')' || t.v === ';' || t.v === '{' || t.v === '}' || t.v === '=>');
  };
  /** 틀 글을 ` 또는 }${ 다음부터 읽는다 → '끝'(`) | '안'(${) */
  const 틀읽기 = () => {
    while (i < n) {
      const c = src.charCodeAt(i);
      if (c === 92) { i += 2; continue; }
      if (c === 96) { i++; return '끝'; }
      if (c === 36 && src.charCodeAt(i + 1) === 123) { i += 2; return '안'; }
      i++;
    }
    문제 = 문제 || '닫히지 않은 틀 글';
    return '끝';
  };
  while (i < n) {
    const c = src.charCodeAt(i);
    if (줄끝인가(c)) { 줄 = true; i++; continue; }
    if (빈칸인가(c)) { i++; continue; }
    if (c === 47) { // /
      const d = src.charCodeAt(i + 1);
      if (d === 47) { while (i < n && !줄끝인가(src.charCodeAt(i))) i++; continue; }
      if (d === 42) {
        const e = src.indexOf('*/', i + 2);
        const 끝 = e < 0 ? n : e + 2;
        for (let j = i; j < 끝; j++) if (줄끝인가(src.charCodeAt(j))) { 줄 = true; break; }
        if (e < 0) 문제 = 문제 || '닫히지 않은 주석';
        i = 끝;
        continue;
      }
      if (식자리()) {
        // 정규식: 줄이 바뀌기 전에 닫히지 않으면 나눗셈으로 본다
        let j = i + 1, 칸 = false, 닫힘 = false;
        while (j < n) {
          const e = src.charCodeAt(j);
          if (줄끝인가(e)) break;
          if (e === 92) { j += 2; continue; }
          if (칸) { if (e === 93) 칸 = false; } else if (e === 91) 칸 = true; else if (e === 47) { 닫힘 = true; j++; break; }
          j++;
        }
        if (닫힘) {
          while (j < n && 낱말글자(src.charCodeAt(j))) j++;
          넣기(식, null);
          i = j;
          continue;
        }
      }
      넣기(부호, '/');
      i++;
      continue;
    }
    if (c === 39 || c === 34) { // ' "
      let j = i + 1, 닫힘 = false;
      while (j < n) {
        const e = src.charCodeAt(j);
        if (e === c) { 닫힘 = true; break; }
        if (e === 92) { j += src.charCodeAt(j + 1) === 13 && src.charCodeAt(j + 2) === 10 ? 3 : 2; continue; } // \ + CRLF 줄 이음
        if (e === 10 || e === 13) break;
        j++;
      }
      넣기(글, 풀어쓰기(src.slice(i + 1, Math.min(j, n))));
      if (!닫힘) 문제 = 문제 || '닫히지 않은 따옴표 글';
      i = 닫힘 ? j + 1 : j;
      continue;
    }
    if (c === 96) { // `
      i++;
      if (틀읽기() === '안') { 쌓임.push({ v: '`${' }); 넣기(부호, '`${'); } else 넣기(틀, '``');
      continue;
    }
    if (숫자인가(c) || (c === 46 && 숫자인가(src.charCodeAt(i + 1)))) {
      let j = i + 1;
      while (j < n) { const e = src.charCodeAt(j); if (숫자인가(e) || e === 46 || e === 95 || (e >= 65 && e <= 90) || (e >= 97 && e <= 122)) j++; else break; }
      넣기(수, null);
      i = j;
      continue;
    }
    if (낱말글자(c)) {
      let j = i;
      while (j < n) {
        const e = src.charCodeAt(j);
        if (e === 92 && src.charCodeAt(j + 1) === 117 && src.charCodeAt(j + 2) === 123) { const 닫 = src.indexOf('}', j + 3); j = 닫 < 0 ? n : 닫 + 1; continue; } // \u{…}
        if (!낱말글자(e)) break;
        j++;
      }
      const 낱 = src.slice(i, j);
      넣기(낱말, 낱.includes('\\') ? 풀어쓰기(낱) : 낱); // esbuild charset=ascii가 쓴 \uXXXX 이름
      i = j;
      continue;
    }
    if (c === 123) { 쌓임.push({ v: '{', 식: 객체자리() }); 넣기(부호, '{'); i++; continue; }
    if (c === 125) { // }
      const 위 = 쌓임[쌓임.length - 1];
      i++;
      if (위 && 위.v === '`${') {
        if (틀읽기() === '안') 넣기(부호, '}${'); else { 쌓임.pop(); 넣기(틀, '}`'); }
        continue;
      }
      if (위 && 위.v === '{') 쌓임.pop(); else 문제 = 문제 || '짝 없는 }';
      넣기(부호, '}', { 식: Boolean(위 && 위.식) });
      continue;
    }
    if (c === 40) { // (
      const t = 목록[목록.length - 1];
      쌓임.push({ v: '(', 조건: Boolean(t && t.k === 낱말 && 조건낱말.has(t.v) && !점뒤()) });
      넣기(부호, '(');
      i++;
      continue;
    }
    if (c === 41 || c === 93) { // ) ]
      const 여는 = c === 41 ? '(' : '[';
      const 위 = 쌓임[쌓임.length - 1];
      let 조건 = false;
      if (위 && 위.v === 여는) { 쌓임.pop(); 조건 = Boolean(위.조건); } else 문제 = 문제 || `짝 없는 ${src[i]}`;
      넣기(부호, src[i], c === 41 ? { 조건 } : null);
      i++;
      continue;
    }
    if (c === 91) { 쌓임.push({ v: '[' }); 넣기(부호, '['); i++; continue; }
    const 둘 = src.substr(i, 2);
    if (src.startsWith('...', i)) { 넣기(부호, '...'); i += 3; continue; }
    if (둘 === '=>' || 둘 === '++' || 둘 === '--') { 넣기(부호, 둘); i += 2; continue; }
    if (둘 === '?.' && !숫자인가(src.charCodeAt(i + 2))) { 넣기(부호, '?.'); i += 2; continue; }
    넣기(부호, src[i]);
    i++;
  }
  if (!문제 && 쌓임.length) 문제 = `닫히지 않은 ${쌓임[쌓임.length - 1].v}`;
  return { 목록, 문제 };
}

// ── import·export ────────────────────────────────────────────────────────────

const 이것 = (t, k, v) => Boolean(t) && t.k === k && (v === undefined || t.v === v);
const 이름토큰 = (t) => Boolean(t) && (t.k === 낱말 || t.k === 글);

/** `{ a, b as c, 'd' as e }` → {짝: [[안, 밖]…], 끝} */
function 이름목록읽기(목록, j) {
  const 짝 = [];
  for (j++; j < 목록.length;) {
    const t = 목록[j];
    if (이것(t, 부호, '}')) return { 짝, 끝: j + 1 };
    if (!이름토큰(t)) return null;
    let 밖 = t.v;
    j++;
    if (이것(목록[j], 낱말, 'as')) {
      if (!이름토큰(목록[j + 1])) return null;
      밖 = 목록[j + 1].v;
      j += 2;
    }
    짝.push([t.v, 밖]);
    if (이것(목록[j], 부호, ',')) j++;
    else if (!이것(목록[j], 부호, '}')) return null;
  }
  return null;
}

function 출처읽기(목록, j, 이름) {
  if (!이것(목록[j], 낱말, 'from') || !이것(목록[j + 1], 글)) return null;
  return { 가져옴: { 지정자: 목록[j + 1].v, 이름 }, 끝: j + 2 };
}

/** import 뒤: 'x' · X from · * as N from · {…} from · X, {…} from · X, * as N from. 동적 import()·import.meta는 null */
function 가져옴읽기(목록, j) {
  let t = 목록[j];
  if (!t) return null;
  if (t.k === 글) return { 가져옴: { 지정자: t.v, 이름: [] }, 끝: j + 1 };
  const 이름 = [];
  if (t.k === 낱말) {
    이름.push('default');
    j++;
    if (!이것(목록[j], 부호, ',')) return 출처읽기(목록, j, 이름);
    j++;
    t = 목록[j];
  }
  if (이것(t, 부호, '*')) return 이것(목록[j + 1], 낱말, 'as') && 이것(목록[j + 2], 낱말) ? 출처읽기(목록, j + 3, 이름) : null;
  if (이것(t, 부호, '{')) {
    const r = 이름목록읽기(목록, j);
    if (!r) return null;
    for (const [안] of r.짝) 이름.push(안);
    return 출처읽기(목록, r.끝, 이름);
  }
  return null;
}

/** 값을 건너뛴다: 깊이 0의 , ; 또는 감싼 괄호의 닫힘, 줄이 바뀐 뒤의 문장 머리에서 멈춘다 */
function 식건너뛰기(목록, j) {
  let 깊이 = 0;
  for (; j < 목록.length; j++) {
    const t = 목록[j];
    if (t.k === 부호) {
      if (t.v === '(' || t.v === '[' || t.v === '{' || t.v === '`${') 깊이++;
      else if (t.v === ')' || t.v === ']' || t.v === '}') { if (!깊이) return j; 깊이--; }
      else if (!깊이 && (t.v === ',' || t.v === ';')) return j;
    } else if (t.k === 틀 && t.v === '}`') 깊이 = Math.max(0, 깊이 - 1);
    else if (!깊이 && t.줄 && t.k === 낱말 && 문장머리.has(t.v)) return j;
  }
  return j;
}

/** 구조 분해 `{ a, b: c, d = 1, ...e }` · `[x, , y = 2, ...z]` → {이름: 묶이는 이름들, 끝} */
function 묶음이름(목록, j) {
  const 닫는 = 목록[j].v === '{' ? '}' : ']';
  const 객체 = 닫는 === '}';
  const 이름 = [];
  const 대상 = (k) => { // 묶이는 자리: 이름 또는 안쪽 묶음
    if (이것(목록[k], 낱말)) { 이름.push(목록[k].v); return k + 1; }
    if (이것(목록[k], 부호, '{') || 이것(목록[k], 부호, '[')) { const r = 묶음이름(목록, k); if (!r) return -1; 이름.push(...r.이름); return r.끝; }
    return -1;
  };
  for (j++; j < 목록.length;) {
    if (이것(목록[j], 부호, 닫는)) return { 이름, 끝: j + 1 };
    if (!객체 && 이것(목록[j], 부호, ',')) { j++; continue; } // 빈 자리
    if (이것(목록[j], 부호, '...')) j = 대상(j + 1);
    else if (!객체) j = 대상(j);
    else {
      const 키 = 목록[j];
      if (이것(키, 부호, '[')) { const 닫힘 = 식건너뛰기(목록, j + 1); j = 이것(목록[닫힘], 부호, ']') ? 닫힘 + 1 : -1; } // [계산된 키]
      else if (키 && (키.k === 낱말 || 키.k === 글 || 키.k === 수)) j++;
      else return null;
      if (j >= 0 && 이것(목록[j], 부호, ':')) j = 대상(j + 1);
      else if (j >= 0 && 이것(키, 낱말)) 이름.push(키.v); // 줄임 꼴 { a }
      else return null;
    }
    if (j < 0) return null;
    if (이것(목록[j], 부호, '=')) j = 식건너뛰기(목록, j + 1);
    if (이것(목록[j], 부호, ',')) j++;
    else if (!이것(목록[j], 부호, 닫는)) return null;
  }
  return null;
}

/** export const|let|var 뒤 선언들 → {내보냄, 끝} */
function 선언읽기(목록, j) {
  const 이름 = [];
  while (j < 목록.length) {
    const t = 목록[j];
    if (이것(t, 낱말)) { 이름.push(t.v); j++; }
    else if (이것(t, 부호, '{') || 이것(t, 부호, '[')) { const r = 묶음이름(목록, j); if (!r) break; 이름.push(...r.이름); j = r.끝; }
    else break;
    if (이것(목록[j], 부호, '=')) j = 식건너뛰기(목록, j + 1);
    if (!이것(목록[j], 부호, ',')) break;
    j++;
  }
  return 이름.length ? { 내보냄: 이름, 끝: j } : null;
}

/** export 뒤: default · * from · * as N from · {…} [from] · [async] function[*] N · class N · const|let|var … */
function 내보냄읽기(목록, j) {
  const t = 목록[j];
  if (!t) return null;
  if (이것(t, 낱말, 'default')) return { 내보냄: ['default'], 끝: j + 1 };
  if (이것(t, 부호, '*')) {
    if (이것(목록[j + 1], 낱말, 'as')) {
      if (!이름토큰(목록[j + 2])) return null;
      const r = 출처읽기(목록, j + 3, []);
      return r && { 내보냄: [목록[j + 2].v], 가져옴: r.가져옴, 끝: r.끝 };
    }
    const r = 출처읽기(목록, j + 1, []);
    return r && { 모두다시: r.가져옴.지정자, 가져옴: r.가져옴, 끝: r.끝 };
  }
  if (이것(t, 부호, '{')) {
    const r = 이름목록읽기(목록, j);
    if (!r) return null;
    const 밖 = r.짝.map(([, b]) => b);
    const 출처 = 출처읽기(목록, r.끝, r.짝.map(([a]) => a));
    return 출처 ? { 내보냄: 밖, 가져옴: 출처.가져옴, 끝: 출처.끝 } : { 내보냄: 밖, 끝: r.끝 };
  }
  if (t.k !== 낱말) return null;
  let k = j;
  if (t.v === 'async' && 이것(목록[k + 1], 낱말, 'function')) k++;
  if (이것(목록[k], 낱말, 'function')) {
    k++;
    if (이것(목록[k], 부호, '*')) k++;
    return 이것(목록[k], 낱말) ? { 내보냄: [목록[k].v], 끝: k + 1 } : null;
  }
  if (t.v === 'class') return 이것(목록[j + 1], 낱말) ? { 내보냄: [목록[j + 1].v], 끝: j + 2 } : null;
  if (t.v === 'const' || t.v === 'let' || t.v === 'var') return 선언읽기(목록, j + 1);
  return null;
}

/**
 * 모듈 글 → {가져옴: [{지정자, 이름: [가져오는 이름…]}], 내보냄: Set, 모두다시: [export * from 지정자…], 문제: null|글}.
 * 다시 내보내기(export {a} from · export * from)는 가져옴에도 들어간다. 이름 없는 가져옴(import 'x' · * as N)은 모듈만 있으면 된다.
 */
function 모듈읽기(src) {
  const { 목록, 문제 } = 토큰나누기(String(src));
  const 가져옴 = [], 내보냄 = new Set(), 모두다시 = [];
  for (let i = 0; i < 목록.length; i++) {
    const t = 목록[i];
    if (t.k !== 낱말 || (t.v !== 'import' && t.v !== 'export')) continue;
    const 앞 = 목록[i - 1];
    if (앞 && 앞.k === 부호 && (앞.v === '.' || 앞.v === '?.')) continue; // obj.import
    const r = t.v === 'import' ? 가져옴읽기(목록, i + 1) : 내보냄읽기(목록, i + 1);
    if (!r) continue;
    if (r.가져옴) 가져옴.push(r.가져옴);
    for (const x of r.내보냄 || []) 내보냄.add(x);
    if (r.모두다시) 모두다시.push(r.모두다시);
    i = r.끝 - 1;
  }
  return { 가져옴, 내보냄, 모두다시, 문제 };
}

/** 그 이름을 내보내나: true · false · '모름'(export * from이 있어 알 수 없다 — default는 export *로 넘어오지 않는다) */
function 내보내나(정보, 이름) {
  if (!정보) return false;
  if (정보.내보냄.has(이름)) return true;
  return 이름 !== 'default' && 정보.모두다시.length ? '모름' : false;
}

// ── 지정자 ───────────────────────────────────────────────────────────────────

/** 부르는 모듈 경로 + 지정자 → {경로(공개 경로), 쿼리}. 바깥 사이트·data:·맨 이름(bare)·뿌리 밖은 null */
function 지정자풀기(부르는, 지정자, 호스트들 = new Set()) {
  let u = String(지정자);
  let 쿼리 = '';
  const k = u.search(/[?#]/);
  if (k >= 0) { 쿼리 = u.slice(k); u = u.slice(0, k); }
  const m = /^(?:https?:)?\/\/([^/]+)(\/.*)?$/i.exec(u);
  if (m) {
    if (!호스트들.has(m[1].toLowerCase())) return null;
    u = m[2] || '/';
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(u) || !/^\.{0,2}\//.test(u)) return null;
  try { u = decodeURI(u); } catch (_) { /* 그대로 */ }
  const p = u.startsWith('/') ? path.posix.normalize(u.slice(1) || '.') : path.posix.normalize(path.posix.join(path.posix.dirname(부르는), u));
  if (p === '.' || p === '..' || p.startsWith('../')) return null;
  return { 경로: p, 쿼리 };
}

// ── 세기 ─────────────────────────────────────────────────────────────────────

const 모듈경로 = /\.m?js$/i;
const 짝차례 = (a, b) => (a.종류 + a.부르는 + a.대상 < b.종류 + b.부르는 + b.대상 ? -1 : 1);

/**
 * 세 짝을 센다.
 *   바뀐: Map|[[경로, 종류]] — 이번에 바뀌는 .js·.mjs(종류: 새·바꿈·토큰·지움)
 *   옛판(경로) → Buffer|string|null — 지금 공개본 판 · 새판(경로) → 후보 판(지우면 null)
 *   모든경로: 공개본·후보의 .js·.mjs — 안 바뀌는 모듈 가운데 바뀐 모듈을 부르는 것을 찾는다
 *   호스트들: 같은 사이트로 볼 주소 호스트(https://synk.im/… 지정자)
 *   옛토큰들(경로) → Set — 공개본이 그 모듈을 부를 때 쓴 ?v= 값. 없으면 ?v= 주소도 캐시를 탈 수 있다고 본다.
 *   넘김: Set(경로) — 사람이 보고 넘긴(--허용) 부르는 쪽 경로. 그 모듈이 부르는 ③은 세되 나눔을 막지 않는다.
 *   쓰이나(경로) → bool — 그 모듈을 부르는 파일이 있나. 없으면(안 쓰는 옛 모듈) 그 모듈이 부르는 ③에 안쓰임을 달고 나눔을 막지 않는다.
 * 반환: {셈: {①, ②, ③}, 짝: [{종류, 부르는, 대상, 판, 이름, 모듈없음, 안쓰임}], 알수없음, 못읽음, 새주소, 모듈: {바뀐, 읽음}, 나눔}
 *   나눔(①·②가 있고 막는 ③이 없을 때): {'1단계': [경로…], 남는: [짝…]} — 1단계는 엇갈림을 풀려고 먼저 올릴 모듈, 남는은 1단계로도 안 풀리는 짝
 */
function 세기({ 바뀐, 옛판, 새판, 모든경로 = [], 호스트들 = new Set(), 옛토큰들 = null, 넘김 = new Set(), 쓰이나 = null }) {
  const 바뀜 = new Map(바뀐);
  const 결과 = { 셈: { '①': 0, '②': 0, '③': 0 }, 짝: [], 알수없음: [], 못읽음: [], 새주소: 0, 모듈: { 바뀐: 바뀜.size, 읽음: 0 }, 나눔: null };
  if (!바뀜.size) return 결과;
  const 글로 = (b) => (b == null ? null : Buffer.isBuffer(b) ? b.toString('utf8') : String(b));
  const 읽은 = new Map();
  /** 판('옛'|'새')의 모듈 정보. 안 바뀐 모듈은 두 판이 같아 한 번만 읽는다. 없으면 null */
  const 정보 = (판, p) => {
    const 키 = 바뀜.has(p) ? `${판}\0${p}` : `같음\0${p}`;
    if (읽은.has(키)) return 읽은.get(키);
    const 원문 = 글로(판 === '옛' || !바뀜.has(p) ? 옛판(p) : 새판(p));
    let r = null;
    if (원문 != null) {
      r = 모듈읽기(원문);
      결과.모듈.읽음++;
      if (r.문제) 결과.못읽음.push({ 경로: p, 판: 바뀜.has(p) ? 판 : '같음', 이유: r.문제 });
    }
    읽은.set(키, r);
    return r;
  };
  /** 판의 정적 import → [{대상, 이름, 쿼리}] (.js·.mjs 대상만). 모듈이 없으면 null */
  const 잇기 = (판, p) => {
    const r = 정보(판, p);
    if (!r) return null;
    const 결과들 = [];
    for (const e of r.가져옴) {
      const f = 지정자풀기(p, e.지정자, 호스트들);
      if (f && 모듈경로.test(f.경로)) 결과들.push({ 대상: f.경로, 이름: e.이름, 쿼리: f.쿼리 });
    }
    return 결과들;
  };
  /** [{대상, 이름}] → Map(대상 → Set(이름)) */
  const 묶기 = (잇) => {
    const m = new Map();
    for (const e of 잇 || []) { if (!m.has(e.대상)) m.set(e.대상, new Set()); for (const x of e.이름) m.get(e.대상).add(x); }
    return m;
  };
  const 모음 = new Map();
  const 더하기 = (종류, 부르는, 대상, 이름, 판) => {
    const 키 = `${종류}\0${부르는}\0${대상}`;
    if (!모음.has(키)) 모음.set(키, { 종류, 부르는, 대상, 판, 이름: new Set(), 모듈없음: false });
    if (이름 === '') 모음.get(키).모듈없음 = true; else 모음.get(키).이름.add(이름);
  };
  const 모름 = (부르는, 대상, 이름) => { if (결과.알수없음.length < 200) 결과.알수없음.push({ 부르는, 대상, 이름 }); };
  const 처음주소 = (쿼리, T) => {
    const m = /[?&]v=([^&#]*)/.exec(쿼리 || '');
    return Boolean(m && 옛토큰들 && !옛토큰들(T).has(m[1]));
  };
  const 필요 = new Map(); // 바뀐 모듈 → [{대상, 새파일, 처음}] — 그 대상의 새 판이 있어야 도는 것

  // 부르는 모듈: 바뀐 모듈 + 바뀐 모듈의 파일 이름이 글에 나오는 안 바뀐 모듈
  const 이름들 = new Set();
  for (const p of 바뀜.keys()) {
    const b = path.posix.basename(p);
    이름들.add(b);
    try { 이름들.add(encodeURI(b)); } catch (_) { /* 그대로 */ }
  }
  const 이름식 = new RegExp([...이름들].map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));
  const 부르는들 = new Set(바뀜.keys());
  for (const p of 모든경로) {
    if (바뀜.has(p) || 부르는들.has(p)) continue;
    const 원문 = 글로(옛판(p));
    if (원문 && 이름식.test(원문)) 부르는들.add(p);
  }

  for (const M of [...부르는들].sort()) {
    const M바뀜 = 바뀜.has(M);
    const 새잇 = 잇기('새', M);
    const 옛잇 = M바뀜 ? 잇기('옛', M) : 새잇;
    const 새이름 = 묶기(새잇), 옛이름 = 묶기(옛잇);
    // 새 판의 짝: ③(새 판끼리 안 맞음) · ①(새 판 → 대상의 옛 판)
    for (const e of 새잇 || []) {
      const T = e.대상, T바뀜 = 바뀜.has(T);
      if (!M바뀜 && !T바뀜) continue;
      const T새 = 정보('새', T), T옛 = 정보('옛', T);
      const 옛도 = 옛이름.get(T); // 공개본의 M도 T를 불렀나(이미 깨져 있던 짝 가리기)
      if (!T새) { if (!(옛도 && !T옛)) 더하기('③', M, T, '', '새'); continue; }
      if (M바뀜 && T바뀜 && !T옛) { if (!필요.has(M)) 필요.set(M, []); 필요.get(M).push({ 대상: T, 새파일: true }); }
      for (const X of e.이름) {
        if (!T바뀜 && 옛도 && 옛도.has(X)) continue; // 안 바뀐 대상에서 전과 같은 이름 — 공개본 그대로다
        const 새에 = 내보내나(T새, X);
        if (새에 === false) {
          if (!(옛도 && 옛도.has(X) && 내보내나(T옛, X) === false)) 더하기('③', M, T, X, '새');
          continue;
        }
        if (새에 === '모름') { 모름(M, T, X); continue; }
        if (!M바뀜 || !T바뀜 || !T옛) continue; // 안 바뀐 대상 · 새 파일로 가는 import
        const 옛에 = 내보내나(T옛, X);
        if (옛에 === '모름') { 모름(M, T, X); continue; }
        if (옛에 || (옛도 && 옛도.has(X))) continue; // 옛 판에도 있다 · 공개본에서도 이미 깨져 있었다
        const 처음 = 처음주소(e.쿼리, T);
        if (!필요.has(M)) 필요.set(M, []);
        필요.get(M).push({ 대상: T, 새파일: false, 처음 });
        if (처음) { 결과.새주소++; continue; }
        더하기('①', M, T, X, '새');
      }
    }
    // 옛 판의 짝: ②(캐시에 남은 옛 판 → 대상의 새 판). 새 판도 같은 이름을 부르면 ③으로 셌다.
    if (!M바뀜) continue;
    for (const e of 옛잇 || []) {
      const T = e.대상;
      if (!바뀜.has(T)) continue;
      const T옛 = 정보('옛', T), T새 = 정보('새', T);
      if (!T옛) continue; // 공개본에서도 없던 모듈
      const 새도 = 새이름.get(T);
      if (!T새) { if (!새도) 더하기('②', M, T, '', '옛'); continue; }
      for (const X of e.이름) {
        if (내보내나(T옛, X) === false || 내보내나(T새, X) !== false) continue;
        if (!(새도 && 새도.has(X))) 더하기('②', M, T, X, '옛');
      }
    }
  }

  결과.짝 = [...모음.values()].map((x) => ({ ...x, 이름: [...x.이름].sort() })).sort(짝차례);
  for (const x of 결과.짝) {
    결과.셈[x.종류]++;
    if (x.종류 === '③' && 쓰이나 && !쓰이나(x.부르는)) x.안쓰임 = true;
  }

  // 나눔 — 먼저 올려도 되는 모듈: 남이 부르는 이름을 빼지 않고(② 대상이 아님)·지우지 않고, 새 판이 있어야 도는 대상이 모두 그 안에
  // 있으며 그 대상을 처음 쓰는 주소로 부르는(또는 새 파일인) 모듈
  const 막는셋 = 결과.짝.some((x) => x.종류 === '③' && !x.안쓰임 && !넘김.has(x.부르는));
  if (!막는셋 && (결과.셈['①'] || 결과.셈['②'])) {
    const 뒤로 = new Set(결과.짝.filter((x) => x.종류 === '②').map((x) => x.대상));
    const 먼저 = new Set([...바뀜].filter(([p, 종류]) => 종류 !== '지움' && !뒤로.has(p)).map(([p]) => p));
    for (let 줄어듦 = true; 줄어듦;) {
      줄어듦 = false;
      for (const P of [...먼저]) {
        if ((필요.get(P) || []).every((x) => 먼저.has(x.대상) && (x.새파일 || x.처음))) continue;
        먼저.delete(P);
        줄어듦 = true;
      }
    }
    // 1단계는 엇갈림을 푸는 데 드는 것만: ① 대상(새 이름을 먼저 내보낸다) · ② 부르는 쪽(옛 이름을 먼저 그만 부른다)과 그들이 부르는
    // 새 판. 다른 모듈은 import로는 맞아도 화면과 런타임 약속(postMessage·CSS)이 같이 바뀌었을 수 있어 2단계에 둔다(10-19 사람의 나눔).
    const 단계 = new Set();
    const 쌓기 = 결과.짝.filter((x) => x.종류 !== '③').map((x) => (x.종류 === '①' ? x.대상 : x.부르는)).filter((p) => 먼저.has(p));
    while (쌓기.length) {
      const P = 쌓기.pop();
      if (단계.has(P)) continue;
      단계.add(P);
      for (const x of 필요.get(P) || []) if (먼저.has(x.대상)) 쌓기.push(x.대상);
    }
    결과.나눔 = {
      '1단계': [...단계].sort(),
      남는: 결과.짝.filter((x) => (x.종류 === '①' && !단계.has(x.대상)) || (x.종류 === '②' && !단계.has(x.부르는))),
    };
  }
  return 결과;
}

module.exports = { 세기, 모듈읽기, 지정자풀기, 내보내나, _시험: { 토큰나누기 } };
