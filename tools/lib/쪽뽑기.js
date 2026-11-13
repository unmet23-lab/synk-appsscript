'use strict';
/* 쪽 뽑기 — 내려받은 HTML 글에서 사람이 읽을 것만 뽑는다(2026-11-13). 남의 쪽이라 무엇이 와도 멈추지 않게, 의존 묶음 없이 한 번 훑는다.
 *
 *   const { 뽑기 } = require('./lib/쪽뽑기.js');
 *   const r = 뽑기(html글);   // { 제목, 설명, 사이트, 정본, 언어, 색, 대표그림, 메타, 머리글[], 제품[], 영상[], 본문, 본문잘림, 그림수 }
 *
 * 뽑는 것:
 *   · <title> · meta(description · og:* · twitter:* · theme-color · product:price:*) · <link rel=canonical> · <html lang>
 *   · JSON-LD(schema.org)의 Product(이름 · 브랜드 · 설명 · 값 · 별점 · 후기 수 · 후기 글 몇 줄 — 쓴 사람 이름은 버린다) · VideoObject(이름 · 설명 · 길이)
 *   · h1~h3 머리글, 본문 글(script · style · svg · template · noscript 안은 버림)
 * 뽑지 않는 것: 그림 속 글자(한국 쇼핑몰 상세는 대부분 긴 그림이다 — 그림 수만 센다), 스크립트가 나중에 그리는 내용(후기 · 값이 여기 있을 때가 많다).
 * 크기: 입력은 호출하는 쪽이 3MB로 자른다. 꼬리표 하나는 16KB, JSON-LD 한 덩이는 300KB · 서른 덩이, 본문은 2만 자까지.
 *   모든 걸음이 앞으로만 가서 입력 길이에 비례하는 시간에 끝난다(닫히지 않는 따옴표 · 주석 · script가 와도).
 * 시험: node --test tests/쪽뽑기.test.js
 */

const 한계 = { 꼬리표: 16384, 속성값: 4000, 속성수: 40, 메타수: 200, 구조덩이: 300000, 구조수: 30, 머리글수: 40, 본문: 20000, 후기수: 12, 후기글: 300, 제품수: 5, 영상수: 5, 구조마디: 5000 };
// 안의 글을 통째로 버리는 요소
const 버림 = new Set(['script', 'style', 'template', 'svg', 'noscript', 'iframe', 'canvas', 'select', 'textarea', 'math', 'object']);
// 앞뒤로 줄을 바꾸는 요소
const 줄바꿈 = new Set(['p', 'div', 'br', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr', 'table', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside', 'dl', 'dt', 'dd', 'blockquote', 'pre', 'hr', 'figure', 'figcaption', 'form', 'title', 'option', 'address']);
const 칸 = new Set(['td', 'th']);

const 공백인가 = (c) => c === 32 || c === 9 || c === 10 || c === 13 || c === 12;
const 이름글자 = (c) => (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 45 || c === 58 || c === 95;

/** s[i] === '<' 에서 꼬리표 하나를 읽는다 → { 끝, 이름, 닫는, 속성 } 또는 null(꼬리표가 아님 — '<'를 글로 본다) */
function 꼬리표읽기(s, i) {
  const n = s.length;
  let j = i + 1, 닫는 = false;
  if (s.charCodeAt(j) === 47) { 닫는 = true; j++; }
  const 시작 = j;
  while (j < n && j - 시작 < 40 && 이름글자(s.charCodeAt(j))) j++;
  if (j === 시작) return null;
  const 처음 = s.charCodeAt(시작);
  if (!((처음 >= 97 && 처음 <= 122) || (처음 >= 65 && 처음 <= 90))) return null;
  const 이름 = s.slice(시작, j).toLowerCase();
  const 끝한계 = Math.min(n, i + 한계.꼬리표);
  const 속성 = {};
  let 수 = 0;
  while (j < 끝한계) {
    const c = s.charCodeAt(j);
    if (c === 62) return { 끝: j + 1, 이름, 닫는, 속성 };
    if (공백인가(c) || c === 47) { j++; continue; }
    const a0 = j;
    while (j < 끝한계) { const d = s.charCodeAt(j); if (공백인가(d) || d === 61 || d === 62 || d === 47) break; j++; }
    const 키 = s.slice(a0, j).toLowerCase();
    if (j === a0) { j++; continue; } // '=' 하나만 떠 있는 깨진 자리 — 한 글자 넘긴다
    while (j < 끝한계 && 공백인가(s.charCodeAt(j))) j++;
    let 값 = '';
    if (s.charCodeAt(j) === 61) {
      j++;
      while (j < 끝한계 && 공백인가(s.charCodeAt(j))) j++;
      const q = s.charCodeAt(j);
      if (q === 34 || q === 39) {
        // 닫는 따옴표는 이 꼬리표의 한계 안에서만 찾는다(끝까지 훑지 않는다).
        const 안 = s.slice(j + 1, 끝한계), e = 안.indexOf(q === 34 ? '"' : "'");
        if (e < 0) return { 끝: 끝한계, 이름, 닫는, 속성 };
        값 = 안.slice(0, e); j = j + 1 + e + 1;
      } else {
        const v0 = j;
        while (j < 끝한계) { const d = s.charCodeAt(j); if (공백인가(d) || d === 62) break; j++; }
        값 = s.slice(v0, j);
      }
    }
    if (키 && 수 < 한계.속성수 && !Object.prototype.hasOwnProperty.call(속성, 키)) { 속성[키] = 값.length > 한계.속성값 ? 값.slice(0, 한계.속성값) : 값; 수++; }
  }
  return { 끝: 끝한계, 이름, 닫는, 속성 };
}

const 이름난문자 = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', copy: '©', reg: '®', trade: '™', times: '×', deg: '°', bull: '•' };
function 문자풀기(글) {
  if (글.indexOf('&') < 0) return 글;
  return 글.replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z]{2,8});/gi, (전체, 안) => {
    if (안[0] === '#') {
      const 값 = 안[1] === 'x' || 안[1] === 'X' ? parseInt(안.slice(2), 16) : parseInt(안.slice(1), 10);
      if (!Number.isFinite(값) || 값 <= 0 || 값 > 0x10ffff || (값 >= 0xd800 && 값 <= 0xdfff)) return ' ';
      return 값 < 32 && 값 !== 10 && 값 !== 9 ? ' ' : String.fromCodePoint(값);
    }
    const 찾음 = 이름난문자[안.toLowerCase()];
    return 찾음 === undefined ? 전체 : 찾음;
  });
}
// 지울 글자: 제어 문자(줄바꿈 · 탭은 남긴다) · 보이지 않는 서식 문자 · 줄/문단 나눔 문자. 그 글자를 소스에 직접 적지 않으려고 유니코드 속성으로 쓴다.
const 지울글자 = /[^\P{Cc}\n\t\r]|[\p{Cf}\p{Zl}\p{Zp}]/gu;
// 제어 문자를 지우고 빈칸을 줄이고 빈 줄을 없앤다(덩이마다 한 줄 — 본문 한도를 빈 줄로 쓰지 않는다).
function 다듬기(글, 줄유지 = true) {
  const 깨끗 = 문자풀기(글).replace(지울글자, '');
  if (!줄유지) return 깨끗.replace(/\s+/g, ' ').trim();
  return 깨끗.split('\n').map((줄) => 줄.replace(/[ \t\r\f\v\xa0]+/g, ' ').trim()).filter(Boolean).join('\n');
}
const 한줄 = (값, 길이) => (typeof 값 === 'string' || typeof 값 === 'number' ? 다듬기(String(값), false).slice(0, 길이) : '');

// ── JSON-LD ──
const 종류들 = (마디) => (Array.isArray(마디['@type']) ? 마디['@type'] : [마디['@type']]).filter((x) => typeof x === 'string').map((x) => x.replace(/^https?:\/\/schema\.org\//i, ''));
const 첫 = (값) => (Array.isArray(값) ? 값[0] : 값);
const 이름값 = (값) => { const v = 첫(값); return v && typeof v === 'object' ? 한줄(v.name, 120) : 한줄(v, 120); };

function 제품마디(마디) {
  const 제품 = { 이름: 한줄(마디.name, 200), 브랜드: 이름값(마디.brand), 설명: 한줄(마디.description, 600), 값: '', 통화: '', 재고: '', 별점: '', 후기수: '', 후기: [] };
  const 값칸 = 첫(마디.offers);
  if (값칸 && typeof 값칸 === 'object') {
    제품.값 = 한줄(값칸.price ?? 값칸.lowPrice ?? '', 40);
    if (!값칸.price && 값칸.lowPrice && 값칸.highPrice && String(값칸.lowPrice) !== String(값칸.highPrice)) 제품.값 = `${한줄(값칸.lowPrice, 20)}~${한줄(값칸.highPrice, 20)}`;
    제품.통화 = 한줄(값칸.priceCurrency, 10);
    제품.재고 = 한줄(값칸.availability, 80).replace(/^https?:\/\/schema\.org\//i, '');
  }
  const 별 = 마디.aggregateRating;
  if (별 && typeof 별 === 'object' && !Array.isArray(별)) { 제품.별점 = 한줄(별.ratingValue, 10); 제품.후기수 = 한줄(별.reviewCount ?? 별.ratingCount ?? '', 12); }
  for (const 후기 of (Array.isArray(마디.review) ? 마디.review : 마디.review ? [마디.review] : []).slice(0, 한계.후기수 * 3)) {
    if (!후기 || typeof 후기 !== 'object') continue;
    // 쓴 사람 이름 · 날짜는 옮기지 않는다 — 글과 별점만.
    const 글 = 한줄(후기.reviewBody ?? 후기.description ?? '', 한계.후기글);
    if (!글) continue;
    const 점 = 후기.reviewRating && typeof 후기.reviewRating === 'object' ? 한줄(후기.reviewRating.ratingValue, 6) : '';
    제품.후기.push(점 ? { 글, 별점: 점 } : { 글 });
    if (제품.후기.length >= 한계.후기수) break;
  }
  return 제품;
}
function 영상마디(마디) {
  return { 이름: 한줄(마디.name, 200), 설명: 한줄(마디.description, 600), 길이: 한줄(마디.duration, 20), 올린날: 한줄(마디.uploadDate, 30), 올린이: 이름값(마디.author ?? 마디.publisher ?? '') };
}
function 구조읽기(덩이들) {
  const 제품 = [], 영상 = [];
  let 본 = 0;
  const 걷기 = (값, 깊이) => {
    if (!값 || typeof 값 !== 'object' || 깊이 > 12 || 본 >= 한계.구조마디) return;
    본++;
    if (Array.isArray(값)) { for (const 하나 of 값) 걷기(하나, 깊이 + 1); return; }
    const 종류 = 종류들(값);
    if (종류.some((t) => t === 'Product' || t === 'ProductGroup' || t === 'IndividualProduct') && 제품.length < 한계.제품수) { const p = 제품마디(값); if (p.이름) 제품.push(p); }
    if (종류.includes('VideoObject') && 영상.length < 한계.영상수) { const v = 영상마디(값); if (v.이름) 영상.push(v); }
    for (const 키 of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item', 'hasVariant', 'subjectOf', 'video']) if (값[키] && typeof 값[키] === 'object') 걷기(값[키], 깊이 + 1);
  };
  for (const 덩이 of 덩이들) {
    let 읽은;
    try { 읽은 = JSON.parse(덩이); } catch { continue; }
    걷기(읽은, 0);
  }
  return { 제품, 영상 };
}

/** HTML 글 → 뽑은 것. 던지지 않는다(읽을 수 없으면 빈 칸). */
function 뽑기(html, { 본문한도 = 한계.본문 } = {}) {
  const s = typeof html === 'string' ? html : '';
  const n = s.length;
  const 메타 = {}, 머리글 = [], 구조덩이 = [], 본문조각 = [], 제목조각 = [];
  let 메타수 = 0, 본문길이 = 0, 본문잘림 = false, 그림수 = 0, 정본 = '', 언어 = '';
  let 머리 = null;     // h1~h3 안이면 { 단계, 조각 }
  let 제목안 = false;
  let 곁 = 0;          // nav · footer 안의 깊이 — 메뉴 · 바닥 글은 본문에 넣지 않는다(닫히지 않아도 main · article · h1에서 풀린다)
  const 글넣기 = (조각) => {
    if (!조각) return;
    if (제목안) { if (제목조각.length < 20) 제목조각.push(조각.slice(0, 500)); return; }
    if (곁 > 0) return;
    if (머리 && 머리.조각.length < 20) 머리.조각.push(조각.slice(0, 300));
    if (본문길이 >= 본문한도 * 3) { 본문잘림 = true; return; }   // 날글로 세 배까지만 모은다(다듬은 뒤 다시 자른다)
    본문조각.push(조각); 본문길이 += 조각.length;
  };
  let i = 0;
  while (i < n) {
    const lt = s.indexOf('<', i);
    if (lt < 0) { 글넣기(s.slice(i)); break; }
    if (lt > i) 글넣기(s.slice(i, lt));
    // 주석 · 선언
    if (s.startsWith('<!--', lt)) { const e = s.indexOf('-->', lt + 4); i = e < 0 ? n : e + 3; continue; }
    if (s.charCodeAt(lt + 1) === 33 || s.charCodeAt(lt + 1) === 63) { const e = s.indexOf('>', lt + 2); i = e < 0 ? n : e + 1; continue; }
    const t = 꼬리표읽기(s, lt);
    if (!t) { 글넣기('<'); i = lt + 1; continue; }
    i = t.끝;
    if (t.닫는) {
      if (t.이름 === 'title') 제목안 = false;
      if ((t.이름 === 'nav' || t.이름 === 'footer') && 곁 > 0) 곁--;
      if (머리 && t.이름 === 머리.단계) { const 글 = 다듬기(머리.조각.join(' '), false).slice(0, 200); if (글 && 머리글.length < 한계.머리글수) 머리글.push({ 단계: 머리.단계, 글 }); 머리 = null; }
      if (줄바꿈.has(t.이름)) 글넣기('\n'); else if (칸.has(t.이름)) 글넣기(' ');
      continue;
    }
    // <title>은 꼬리표를 품지 않는다 — 닫히지 않은 채 다른 꼬리표가 오면 제목이 끝난 것으로 본다(본문을 통째로 삼키지 않게).
    if (제목안 && t.이름 !== 'title') 제목안 = false;
    if (t.이름 === 'nav' || t.이름 === 'footer') { 곁 = Math.min(곁 + 1, 8); continue; }
    if (t.이름 === 'main' || t.이름 === 'article' || t.이름 === 'h1') 곁 = 0;
    if (버림.has(t.이름)) {
      // 스스로 닫힌 꼴(<svg … />)은 안이 없다 — script · style은 그런 꼴이 없으므로 그대로 닫는 꼬리표를 찾는다.
      if (t.이름 !== 'script' && t.이름 !== 'style' && s.charCodeAt(t.끝 - 2) === 47) continue;
      // 닫는 꼬리표까지 건너뛴다. 없으면 끝까지(그 뒤는 그 요소의 안이다).
      const 닫기 = new RegExp(`</${t.이름}[\\s>/]`, 'gi'); 닫기.lastIndex = i;
      const 찾음 = 닫기.exec(s);
      const 안끝 = 찾음 ? 찾음.index : n;
      if (t.이름 === 'script' && /^application\/ld\+json\b/i.test(String(t.속성.type || '').trim()) && 구조덩이.length < 한계.구조수 && 안끝 - i <= 한계.구조덩이) 구조덩이.push(s.slice(i, 안끝));
      if (!찾음) { i = n; break; }
      const 닫는끝 = s.indexOf('>', 찾음.index);
      i = 닫는끝 < 0 ? n : 닫는끝 + 1;
      continue;
    }
    if (t.이름 === 'title') { 제목안 = true; continue; }
    if (t.이름 === 'meta') {
      const 키 = String(t.속성.property || t.속성.name || t.속성.itemprop || '').toLowerCase().trim().slice(0, 80);
      if (키 && 메타수 < 한계.메타수 && typeof t.속성.content === 'string' && !Object.prototype.hasOwnProperty.call(메타, 키)) { 메타[키] = 다듬기(t.속성.content, false).slice(0, 2000); 메타수++; }
      continue;
    }
    if (t.이름 === 'link') { if (!정본 && /(^|\s)canonical(\s|$)/i.test(String(t.속성.rel || ''))) 정본 = 한줄(t.속성.href, 1000); continue; }
    if (t.이름 === 'html') { if (!언어) 언어 = 한줄(t.속성.lang, 20); continue; }
    if (t.이름 === 'img') { 그림수++; const 대신글 = 한줄(t.속성.alt, 200); if (대신글.length >= 8) 글넣기(` [그림: ${대신글}] `); continue; }
    if (t.이름 === 'h1' || t.이름 === 'h2' || t.이름 === 'h3') { 머리 = { 단계: t.이름, 조각: [] }; 글넣기('\n'); continue; }
    if (줄바꿈.has(t.이름)) 글넣기('\n'); else if (칸.has(t.이름)) 글넣기(' ');
  }
  const 본문전체 = 다듬기(본문조각.join(''));
  const { 제품, 영상 } = 구조읽기(구조덩이);
  const 고르기 = (...키들) => { for (const 키 of 키들) if (메타[키]) return 메타[키]; return ''; };
  return {
    제목: 다듬기(제목조각.join(' '), false).slice(0, 300) || 고르기('og:title', 'twitter:title'),
    설명: 고르기('description', 'og:description', 'twitter:description').slice(0, 1000),
    사이트: 고르기('og:site_name', 'application-name').slice(0, 120),
    정본,
    언어,
    색: 고르기('theme-color', 'msapplication-tilecolor').slice(0, 40),
    대표그림: 고르기('og:image', 'og:image:secure_url', 'twitter:image').slice(0, 1000),
    메타,
    머리글,
    제품,
    영상,
    본문: 본문전체.slice(0, 본문한도),
    본문잘림: 본문잘림 || 본문전체.length > 본문한도,
    그림수,
  };
}

module.exports = { 뽑기, 꼬리표읽기, 문자풀기, 다듬기, 구조읽기, 한계 };
