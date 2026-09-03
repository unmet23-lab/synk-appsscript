#!/usr/bin/env node
/* 기록장조판 — 학생 1인의 「싱크 기록장」 A5 제본 원고를 굽는다.
 * (정본 = docs/가져가는것_설계_v1.md §5-a ① · §5-b · §5-b-2 · §11-a #15 · §12-b)
 *
 * 무엇인가: 졸업하는 날 손에 쥐는 책이다. 철학 Ⅱ-7 —
 *   「졸업하는 날 학생 손에는 급수와 함께, 어떤 스펙보다 오래 남는 **자기만의 이야기**가 들려 있게 한다.」
 *
 * 🔴 이 파일의 급소는 «채움 사다리»다(§5-b-2). 순간은 반·차시 단위로 담기므로 그냥 두면 둘이 생긴다:
 *   ①결석이 잦은 아이의 책이 **눈에 보이게 얇아진다** — 화면에서 등수를 안 띄우기로 한 규약이
 *     종이에서 되살아난다. ②반 열여섯 명이 **같은 사진**을 받는다 — 「자기만의 이야기」가 반 앨범이 된다.
 *   둘 다 졸업 날 물건을 손에 쥔 순간에야 드러나고, 그때는 못 고친다. 그래서 세 규칙을 코드가 진다:
 *     · 시즌당 쪽수 **고정**(사진 수가 두께를 정하지 않는다)
 *     · 반 공유 사진은 스프레드당 **최대 1장**
 *     · 그 시즌 순간이 0~1장이면 **그 아이 «고유» 재료**로 채운다
 *
 * 🔑 서클조판 문법 승계 — 엔진 소스에서 절을 떼어 평가한다(베끼지 않는다).
 *   ⚠ 다만 출석 그리드(CF 출석달력)는 `calcAll` 안에 박혀 있어 **뗄 수 있는 함수가 0개**다(09-03 실측).
 *   그래서 이 도구는 출석을 «날짜 배열»로 받아 스스로 그린다 — 엔진 함수를 흉내내지 않고,
 *   그 사실을 여기 적어 둔다(안 잰 것을 잰 것처럼 쓰지 않는다).
 *
 * 쓰는 법:
 *   node tools/기록장조판.js                      → 픽스처 한 권(6시즌)
 *   node tools/기록장조판.js --시즌 8             → 재회전한 학생(쪽수가 늘어난다)
 *   node tools/기록장조판.js --최소               → 재료가 «가장 없는» 학생(사다리 시험)
 *   node tools/기록장조판.js --데이터 <파일.json> → 실데이터로
 *   node tools/기록장조판.js --pdf                → 폰트 임베드 + PDF 까지
 *   node tools/기록장조판.js --실측               → 넘침·쪽수를 헤드리스 크롬으로 «잰다»
 *   node tools/기록장조판.js --넘침시험           → 그 자가 «눈이 멀지 않았나» 되묻는다
 *   node tools/기록장조판.js --금칙               → 인쇄 금지 계약(§9-b)을 검사한다
 *   node tools/기록장조판.js --out <경로>         → 저장 위치
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const 로고 = require('./lib/로고정본.js');
const { STUDENT_PRINT_MARK } = require('./발표물린트.js');
const 증서 = require('./증서조판.js');           // 색·문안 평가·금칙·실측 통로를 나눠 쓴다(두 벌 금지)

const ROOT = path.resolve(__dirname, '..');
const 토큰 = require(path.join(ROOT, 'docs', '디자인_토큰.json'));
const 색 = Object.fromEntries(토큰['색']['킷'].map((c) => [c['이름'], c['hex']]));
const 서체 = 토큰['서체'];

/** 말 뱅크 — 증서조판이 쓰는 그 평가 통로를 그대로 탄다(로직 0줄 · 사본 0벌). */
function 문안() {
  const src = fs.readFileSync(path.join(ROOT, 'contents_증서.js'), 'utf8');
  return new Function(`${src}\nreturn { RECORD_BOOK_SAY, CERT_ORDINAL, CERT_BLANK };`)();
}

const 이스케이프 = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ── 채움 사다리 (§5-b-2) ────────────────────────────────────────────────────
 * 한 시즌 스프레드가 담는 «칸 넷»을 정한다. 순간이 모자라면 그 아이 고유 재료가 그 자리를 메운다.
 * 🔑 아래 다섯은 전부 **결석과 무관하게 그 아이만의 것**이다 — 그래서 사다리가 성립한다.
 * 🔴 반 공유 사진(반 전체가 같이 받는 것)은 스프레드당 최대 하나다. */
const 고유재료순 = ['목표', '회고', '한일', '고쳐쓴문장', '카드'];

function 시즌칸들(시즌, 최대 = 4) {
  const 칸 = [];
  const 순간 = (시즌.순간 || []);
  const 고유순간 = 순간.filter((m) => !m.반공유);
  const 공유순간 = 순간.filter((m) => m.반공유);

  // ① 그 아이만 나온 순간은 다 넣는다(그게 「자기만의 이야기」다)
  고유순간.slice(0, 최대).forEach((m) => 칸.push({ 갈래: '순간', 값: m }));
  // ② 반 공유 사진은 «한 장만» — 열여섯 명이 같은 책을 받는 것을 여기서 막는다
  if (칸.length < 최대 && 공유순간.length) 칸.push({ 갈래: '순간', 값: 공유순간[0] });
  // ③ 남은 자리는 고유 재료가 메운다 — 결석이 잦아도 스프레드가 안 빈다
  for (const k of 고유재료순) {
    if (칸.length >= 최대) break;
    const v = 시즌[k];
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    칸.push({ 갈래: k, 값: v });
  }
  return 칸;
}

/* ── 지면 CSS ────────────────────────────────────────────────────────────────
 * A5 제본 원고 — 낱쪽이 아니라 «책»이다. 안쪽(제본) 여백을 바깥보다 넓게 준다(§11-a #15).
 * 값은 전부 토큰에서 온다(손 hex 0). */
function CSS() {
  return `
  @page { size: 148mm 210mm; margin: 0; }
  /*@FONTS@*/
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: ${색['Oat']}; }
  body {
    font-family: ${서체['본문스택'].replace('SUIT Variable', 'SUIT')};
    color: ${색['Ink']}; letter-spacing: ${서체['트래킹']['본문']};
  }
  .쪽 {
    width: 148mm; height: 210mm; position: relative; overflow: hidden;
    background: ${색['Paper']}; margin: 5mm auto; page-break-after: always; break-after: page;
  }
  @media print { .쪽 { margin: 0; } body { background: ${색['Paper']}; } .장부 { display: none !important; } }
  .쪽:last-child { page-break-after: auto; break-after: auto; }
  /* 제본 쪽 — 홀수 쪽은 왼쪽이 접히는 자리라 그쪽을 넓게 둔다(글이 접힘에 먹히지 않게) */
  .속 { position: absolute; inset: 0; padding: 16mm 13mm 14mm 18mm; display: flex; flex-direction: column; }
  .쪽:nth-child(even) .속 { padding: 16mm 18mm 14mm 13mm; }

  .쪽번호 {
    position: absolute; bottom: 8mm; left: 0; right: 0; text-align: center;
    font-size: 8pt; color: ${색['Ash Wool']};
  }
  .머리 {
    font-size: 9.5pt; color: ${색['Ash Wool']}; letter-spacing: .04em;
    padding-bottom: 2mm; border-bottom: 1.2pt dashed ${색['Stitch']}; margin-bottom: 6mm;
  }
  .안내 { font-size: 9pt; color: ${색['Ash Wool']}; margin-top: 2mm; }

  /* 표지 — 이름 하나가 주인공이다. 다른 것을 얹지 않는다. */
  .표지 .속 { align-items: center; justify-content: center; text-align: center; }
  .표지 .로고 { height: 10mm; margin-bottom: 14mm; }
  .표지 .로고 svg { height: 100%; width: auto; display: block; }
  .표지 .이름 { font-size: 24pt; font-weight: ${서체['웨이트']['헤드']}; letter-spacing: -.03em; }
  .표지 .기간 { font-size: 10pt; color: ${색['Deep Wool']}; margin-top: 6mm; }
  .표지 .실 {
    width: 26mm; height: 1.2pt; background: ${색['Coral']}; margin: 10mm 0 0;
  }

  .칸 { margin-bottom: 7mm; }
  .칸 .이름 { font-size: 9pt; color: ${색['Ash Wool']}; margin-bottom: 1.5mm; }
  .칸 .글 { font-size: 11pt; line-height: 1.75; }
  .칸 .글 li { margin-bottom: 1.5mm; }
  .칸 ul { margin: 0; padding-left: 5mm; }

  /* 순간 — 사진은 책에 «인쇄면»으로 들어간다. 파일이 없으면 자리만 잡고 사진칸을 안 그린다. */
  .순간 { border: 1.2pt dashed ${색['Stitch']}; border-radius: 3mm; padding: 4mm; margin-bottom: 5mm; }
  .순간 .날 { font-size: 8.5pt; color: ${색['Ash Wool']}; }
  .순간 .줄 { font-size: 10.5pt; line-height: 1.7; margin-top: 1.5mm; }
  .순간 .자리 {
    margin-top: 3mm; height: 32mm; border-radius: 2mm; background: ${색['Oat']};
    display: flex; align-items: center; justify-content: center;
    font-size: 8.5pt; color: ${색['Ash Wool']};
  }
  .순간 img { margin-top: 3mm; width: 100%; border-radius: 2mm; display: block; }

  /* 문장짝 — 이 책의 대표 스프레드. 같은 사람이 쓴 두 문장이 마주 본다. */
  .문장짝 .글 { font-size: 12.5pt; line-height: 1.8; padding-bottom: 3mm; border-bottom: 1.2pt dashed ${색['Stitch']}; }
  .문장짝 .칸 { margin-bottom: 10mm; }

  /* 도장 쪽 — 온 날마다 하나. 숫자를 안 쓴다(세면 그게 비교가 된다). */
  .도장판 { display: flex; flex-wrap: wrap; gap: 2.4mm; }
  .도장 { width: 7mm; height: 7mm; border-radius: 50%; border: 1.2pt solid ${색['Stitch']}; }
  .도장.찍힘 { background: ${색['Coral Wash']}; border-color: ${색['Coral']}; }
  .달이름 { width: 100%; font-size: 8.5pt; color: ${색['Ash Wool']}; margin: 4mm 0 1.5mm; }

  /* 도감 쪽 — 받은 카드 축소 그리드 */
  .도감 { display: flex; flex-wrap: wrap; gap: 3mm; }
  .도감 .장 {
    width: 33mm; min-height: 22mm; border: 1.2pt dashed ${색['Stitch']}; border-radius: 2mm;
    padding: 2.5mm; font-size: 8pt; line-height: 1.5; color: ${색['Deep Wool']};
  }
  .도감 .빈장 { color: ${색['Stone']}; display: flex; align-items: center; justify-content: center; }

  /* 닫는 쪽 — 마지막 한 줄은 학생이 쓴다. 조판기가 채우면 그 자리가 사라진다. */
  .빈줄자리 { margin-top: auto; }
  .빈줄자리 .말 { font-size: 9.5pt; color: ${색['Ash Wool']}; margin-bottom: 4mm; }
  .빈줄자리 .선 { height: 1.2pt; background: ${색['Stitch']}; margin-bottom: 8mm; }
  .빈칸 { color: ${색['Stone']}; letter-spacing: .06em; }

  .뒤표지 .속 { justify-content: flex-end; text-align: center; }
  .뒤표지 .한줄 { font-size: 9.5pt; line-height: 1.8; color: ${색['Deep Wool']}; }

  .장부 {
    max-width: 148mm; margin: 10mm auto 20mm; padding: 6mm 7mm; background: ${색['Coral Wash']};
    border: 1.2pt dashed ${색['Coral']}; border-radius: 3mm; font-size: 10pt; line-height: 1.7;
    color: ${색['Coral 3']};
  }
  .장부 h2 { margin: 0 0 3mm; font-size: 11pt; }
  .장부 ul { margin: 0; padding-left: 5mm; }
`;
}

/* ── 쪽 만들기 ───────────────────────────────────────────────────────────── */

let 쪽번호 = 0;
function 쪽(속, 클래스, 번호보임 = true) {
  쪽번호 += 1;
  return `<div class="쪽 ${클래스 || ''}"><div class="속">${속}</div>` +
    (번호보임 ? `<div class="쪽번호">${쪽번호}</div>` : '') + '</div>';
}

function 표지쪽(뱅크, 자료, 장부) {
  const S = 뱅크.RECORD_BOOK_SAY.표지;
  const 기간 = (자료.시작 && 자료.끝)
    ? S.아래.replace('{시작}', 자료.시작).replace('{끝}', 자료.끝)
    : (장부.push('표지 — 재원 기간'), `<span class="빈칸">${뱅크.CERT_BLANK}</span>`);
  return 쪽(
    `<div class="로고">${로고.워드마크({ 판: '라이트', 표현: '민' })}</div>` +
    `<div class="이름">${자료.이름 ? 이스케이프(자료.이름) : (장부.push('표지 — 이름'), `<span class="빈칸">${뱅크.CERT_BLANK}</span>`)}</div>` +
    `<div class="기간">${기간}</div><div class="실"></div>`,
    '표지', false);
}

function 칸HTML(이름, 글) {
  const 몸 = Array.isArray(글)
    ? '<ul>' + 글.map((g) => `<li>${이스케이프(g)}</li>`).join('') + '</ul>'
    : 이스케이프(글);
  return `<div class="칸"><div class="이름">${이스케이프(이름)}</div><div class="글">${몸}</div></div>`;
}

function 순간HTML(m) {
  return '<div class="순간">' +
    `<div class="날">${이스케이프(m.날짜 || '')}</div>` +
    `<div class="줄">${이스케이프(m.한줄 || '')}</div>` +
    (m.사진
      ? `<img src="${이스케이프(m.사진)}" alt="">`
      : '<div class="자리">사진이 들어갈 자리</div>') +
    '</div>';
}

function 여는쪽(뱅크, 자료, 장부) {
  const S = 뱅크.RECORD_BOOK_SAY.여는쪽;
  const 답 = (자료.첫나침반 || []);
  if (!답.length) 장부.push('여는 쪽 — 첫 나침반 답 4문항');
  return 쪽(`<div class="머리">${이스케이프(S.머리)}</div>` +
    (답.length
      ? 답.map((q) => 칸HTML(q.물음, q.답)).join('')
      : [0, 1, 2, 3].map(() => `<div class="칸"><div class="이름"><span class="빈칸">${뱅크.CERT_BLANK}</span></div>` +
        `<div class="글"><span class="빈칸">${뱅크.CERT_BLANK}${뱅크.CERT_BLANK}</span></div></div>`).join('')) +
    `<div class="안내">${이스케이프(S.안내)}</div>`);
}

/** 한 시즌 = 스프레드 2쪽. 🔴 사진이 몇 장이든 이 쪽수는 «고정»이다(§5-b-2 첫 규칙). */
function 시즌스프레드(뱅크, 시즌, 회차, 장부) {
  const S = 뱅크.RECORD_BOOK_SAY.시즌;
  const 회차말 = 뱅크.CERT_ORDINAL[회차 - 1] || String(회차);
  const 머리 = S.머리.replace('{회차}', 회차말);
  const 칸들 = 시즌칸들(시즌);
  if (!칸들.length) 장부.push(`${회차말} 번째 시즌 — 재료가 하나도 없다(사다리 다섯 갈래 전부 빔)`);
  const 이름표 = { 목표: S.목표, 회고: S.회고, 한일: S.한일, 고쳐쓴문장: '이 시즌에 고쳐 쓴 문장', 카드: '이 시즌에 받은 카드' };

  const 왼 = 칸들.slice(0, 2), 오 = 칸들.slice(2, 4);
  const 그리기 = (묶음) => 묶음.map((c) => c.갈래 === '순간'
    ? 순간HTML(c.값)
    : 칸HTML(이름표[c.갈래] || c.갈래, c.값)).join('');

  return 쪽(`<div class="머리">${이스케이프(머리)}</div>` + (그리기(왼) ||
      `<div class="칸"><div class="글"><span class="빈칸">${뱅크.CERT_BLANK}${뱅크.CERT_BLANK}</span></div></div>`)) +
    쪽(`<div class="머리">${이스케이프(머리)}</div>` + (그리기(오) ||
      `<div class="칸"><div class="글"><span class="빈칸">${뱅크.CERT_BLANK}${뱅크.CERT_BLANK}</span></div></div>`));
}

function 문장짝쪽(뱅크, 자료, 장부) {
  const S = 뱅크.RECORD_BOOK_SAY.문장짝;
  const 빈 = (k, 이름) => { 장부.push(`대표 스프레드 — ${이름}`); return `<span class="빈칸">${뱅크.CERT_BLANK}${뱅크.CERT_BLANK}</span>`; };
  return 쪽(`<div class="머리">${이스케이프(S.머리)}</div><div class="문장짝">` +
    `<div class="칸"><div class="이름">${이스케이프(S.처음)}</div><div class="글">` +
    (자료.처음문장 ? 이스케이프(자료.처음문장) : 빈('처음문장', '처음 쓴 문장')) + '</div></div>' +
    `<div class="칸"><div class="이름">${이스케이프(S.지금)}</div><div class="글">` +
    (자료.지금문장 ? 이스케이프(자료.지금문장) : 빈('지금문장', '지금 쓰는 문장')) + '</div></div>' +
    `</div><div class="안내">${이스케이프(S.안내)}</div>`);
}

/** 도장 쪽 — 온 날마다 동그라미 하나. 🔴 개수를 «세어 적지 않는다»(세면 그게 비교가 된다). */
function 도장쪽(뱅크, 자료, 장부) {
  const S = 뱅크.RECORD_BOOK_SAY.도장쪽;
  const 온날 = (자료.온날 || []);
  if (!온날.length) 장부.push('도장 쪽 — 함께한 날들');
  const 달별 = {};
  온날.forEach((d) => {
    const ym = String(d).slice(0, 7);
    (달별[ym] = 달별[ym] || []).push(d);
  });
  const 판 = Object.keys(달별).sort().map((ym) => {
    const [y, m] = ym.split('-');
    return `<div class="달이름">${y}년 ${Number(m)}월</div>` +
      달별[ym].map(() => '<div class="도장 찍힘"></div>').join('');
  }).join('');
  return 쪽(`<div class="머리">${이스케이프(S.머리)}</div><div class="도장판">${판}</div>` +
    `<div class="안내">${이스케이프(S.안내)}</div>`);
}

function 도감쪽(뱅크, 자료) {
  const S = 뱅크.RECORD_BOOK_SAY.도감쪽;
  const 카드 = (자료.카드 || []);
  // 미발간 자리는 도감 문법 그대로 비워 둔다 — 화면의 12칸 그리드가 이미 쓰는 문법(종이판)
  const 칸 = 카드.map((c) => `<div class="장">${이스케이프(c)}</div>`).join('') +
    (카드.length < 6 ? new Array(6 - 카드.length).fill('<div class="장 빈장">아직</div>').join('') : '');
  return 쪽(`<div class="머리">${이스케이프(S.머리)}</div><div class="도감">${칸}</div>`);
}

function 닫는쪽(뱅크, 자료, 장부) {
  const S = 뱅크.RECORD_BOOK_SAY.닫는쪽;
  const 답 = 자료.오년뒤;
  if (!답) 장부.push('닫는 쪽 — 5년 뒤의 나');
  /* 🔴 빈 줄은 «의도»다 — 여기를 채우면 이 책이 학생에게 남긴 유일한 자리가 사라진다(§5-b). */
  return 쪽(`<div class="머리">${이스케이프(S.머리)}</div>` +
    `<div class="칸"><div class="글">${답 ? 이스케이프(답) : `<span class="빈칸">${뱅크.CERT_BLANK}${뱅크.CERT_BLANK}</span>`}</div></div>` +
    `<div class="안내">${이스케이프(S.안내)}</div>` +
    `<div class="빈줄자리"><div class="말">${이스케이프(S.빈줄)}</div>` +
    '<div class="선"></div><div class="선"></div></div>');
}

function 뒤표지쪽(뱅크) {
  const S = 뱅크.RECORD_BOOK_SAY.뒤표지;
  return 쪽(`<div class="한줄">${이스케이프(S.한줄)}</div>`, '뒤표지', false);
}

/* ── 픽스처 ──────────────────────────────────────────────────────────────────
 * 실학생 0명인 지금 «조판이 서는가»를 재는 재료다. 두 벌:
 *   평시(6시즌 · 순간이 고르게 있음) / 최소(결석이 잦아 순간이 거의 없는 아이 — 사다리 시험). */
function 픽스처(모양, 시즌수) {
  const 시즌 = [];
  for (let i = 1; i <= 시즌수; i += 1) {
    시즌.push(모양 === '최소'
      ? {
        목표: '한국 친구에게 우리 집 이야기 들려주기',
        회고: '',
        한일: [],
        고쳐쓴문장: i === 1 ? '「나는 밥 먹었다」 → 「친구들과 같이 밥을 먹었어요」' : '',
        카드: i === 1 ? '오늘의 한 문장' : '',
        순간: i === 2 ? [{ 날짜: '2027년 6월 3일', 한줄: '우리 반이 다 같이 찍은 날', 반공유: true }] : []
      }
      : {
        목표: '한국 친구에게 우리 집 이야기 들려주기',
        회고: '처음엔 말이 안 나왔는데, 지금은 먼저 물어볼 수 있게 됐어요.',
        한일: ['한국어로 자기소개 영상 만들기', '무대에서 우리 반 이야기 발표하기'],
        고쳐쓴문장: '「나는 밥 먹었다」 → 「친구들과 같이 밥을 먹었어요」',
        카드: '오늘의 한 문장',
        순간: [
          { 날짜: `2027년 ${i + 2}월 22일`, 한줄: '무대에서 끝까지 말한 날' },
          { 날짜: `2027년 ${i + 2}월 3일`, 한줄: '우리 반이 다 같이 찍은 날', 반공유: true }
        ]
      });
  }
  return {
    이름: 모양 === '최소' ? '체첵마' : '뭉흐토야',
    시작: '2027년 2월 25일', 끝: '2028년 2월 25일',
    첫나침반: 모양 === '최소' ? [] : [
      { 물음: '한국어를 왜 배우고 싶어요?', 답: '한국에서 공부하고 싶어요.' },
      { 물음: '어떤 사람이 되고 싶어요?', 답: '통역하는 사람이요.' },
      { 물음: '이번 시즌에 하고 싶은 것 하나', 답: '자기소개를 막힘 없이 하기' },
      { 물음: '5년 뒤의 나는 어디에 있을까요?', 답: '서울에서 대학교에 다니고 있을 것 같아요.' }
    ],
    시즌: 시즌,
    처음문장: '나는 학교 간다',
    지금문장: '오늘은 친구랑 같이 도서관에 가서 한국어 책을 두 권 빌렸어요',
    온날: (() => {
      const out = [];
      for (let m = 3; m <= (모양 === '최소' ? 5 : 8); m += 1) {
        for (let d = 2; d <= (모양 === '최소' ? 8 : 26); d += 4) {
          out.push(`2027-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        }
      }
      return out;
    })(),
    카드: 모양 === '최소' ? ['오늘의 한 문장'] : ['오늘의 한 문장', '먼저 물어본 날', '끝까지 말한 날', '고쳐 쓴 날'],
    오년뒤: 모양 === '최소' ? '' : '서울에서 대학교에 다니고 있을 것 같아요.'
  };
}

/* ── 한 권 ───────────────────────────────────────────────────────────────── */

function 기록장(뱅크, 자료) {
  쪽번호 = 0;
  const 장부 = [];
  const 쪽들 = [표지쪽(뱅크, 자료, 장부), 여는쪽(뱅크, 자료, 장부)];
  (자료.시즌 || []).forEach((s, i) => 쪽들.push(시즌스프레드(뱅크, s, i + 1, 장부)));
  쪽들.push(문장짝쪽(뱅크, 자료, 장부));
  쪽들.push(도장쪽(뱅크, 자료, 장부));
  쪽들.push(도감쪽(뱅크, 자료));
  쪽들.push(닫는쪽(뱅크, 자료, 장부));
  쪽들.push(뒤표지쪽(뱅크));
  return { 쪽들, 장부 };
}

function 지면(제목, 쪽들, 장부) {
  const 장부칸 = 장부.length
    ? `<div class="장부"><h2>채워야 할 칸 ${장부.length}개</h2><ul>` +
      장부.map((b) => `<li>${이스케이프(b)}</li>`).join('') + '</ul></div>'
    : '<div class="장부"><h2>채워야 할 칸 0개</h2></div>';
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${이스케이프(제목)}</title>
<style>${CSS()}</style>
</head>
<body ${STUDENT_PRINT_MARK}>
${쪽들.join('\n')}
${장부칸}
</body>
</html>`;
}

/* ── 실측 ────────────────────────────────────────────────────────────────────
 * 재는 것 = 쪽이 넘쳤나 · 몇 쪽인가 · 시즌당 쪽수가 «고정»인가.
 * 🔴 마지막이 이 도구의 급소다 — 쪽수가 사진 수를 따라가면 결석이 두께로 보인다. */
const 측정기 = `(() => {
  try {
    const mm = 25.4 / 96;
    const 쪽들 = Array.prototype.slice.call(document.querySelectorAll('.쪽'));
    const 잰것 = 쪽들.map(function (p, i) {
      const 속 = p.querySelector('.속');
      const pr = p.getBoundingClientRect(), sr = 속.getBoundingClientRect();
      const cs = getComputedStyle(속);
      /* 🔴 위아래를 «둘 다» 잰다. 아래만 재면 justify-content:flex-end 인 쪽(뒤표지)이
         위로 넘칠 때 안 잡힌다 — 넘침시험에서 19쪽 중 18쪽만 잡히던 구멍이 정확히 그것이었다.
         종이에서는 위로 잘린 줄도 아래로 잘린 줄과 똑같이 «없는 줄»로 보인다. */
      let 바닥 = sr.top, 꼭대기 = sr.bottom;
      Array.prototype.slice.call(속.children).forEach(function (c) {
        const r = c.getBoundingClientRect();
        if (r.bottom > 바닥) 바닥 = r.bottom;
        if (r.top < 꼭대기) 꼭대기 = r.top;
      });
      const 안쪽위 = sr.top + (parseFloat(cs.paddingTop) || 0);
      const 안쪽바닥 = sr.bottom - (parseFloat(cs.paddingBottom) || 0);
      const 아래넘침 = 바닥 > 안쪽바닥 + 0.5;
      const 위넘침 = 꼭대기 < 안쪽위 - 0.5;
      return {
        쪽: i + 1,
        높이mm: +(pr.height * mm).toFixed(1),
        폭mm: +(pr.width * mm).toFixed(1),
        남는여백mm: +(Math.min(안쪽바닥 - 바닥, 꼭대기 - 안쪽위) * mm).toFixed(1),
        넘침: 아래넘침 || 위넘침,
        위로: 위넘침,
        빈칸: 속.querySelectorAll('.빈칸').length
      };
    });
    document.body.insertAdjacentHTML('beforeend',
      '<pre id="SYNK_' + 'CERT_OUT">' + JSON.stringify({ 잰것: 잰것 }) + '</pre>');
  } catch (e) {
    document.body.insertAdjacentHTML('beforeend',
      '<pre id="SYNK_' + 'CERT_OUT">' + JSON.stringify({ 오류: String(e) }) + '</pre>');
  }
})();`;

const 부풀리기 = `(() => {
  Array.prototype.slice.call(document.querySelectorAll('.쪽 .속')).forEach(function (속) {
    const p = document.createElement('p');
    p.style.cssText = 'font-size:12pt;line-height:1.8;margin:0';
    p.textContent = new Array(80).join('아주 긴 문장이 이어집니다 ');
    속.appendChild(p);
  });
})();`;

function main() {
  const argv = process.argv.slice(2);
  const 값 = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
  const 뱅크 = 문안();
  const 모양 = argv.includes('--최소') ? '최소' : '평시';
  const 시즌수 = Number(값('--시즌', '6')) || 6;
  const 데이터 = 값('--데이터', '');
  const 자료 = 데이터 ? JSON.parse(fs.readFileSync(path.resolve(데이터), 'utf8')) : 픽스처(모양, 시즌수);
  const { 쪽들, 장부 } = 기록장(뱅크, 자료);
  const 제목 = `SYNK 기록장 — ${자료.이름 || ''}`;
  const html = 지면(제목, 쪽들, 장부);

  if (argv.includes('--금칙')) {
    const 걸린 = 증서.금칙검사(html);
    console.log(`[금칙 검사] 설계 §9-b 인쇄 금지 계약 — 검사 낱말 ${증서.금칙.length}개`);
    걸린.forEach((g) => console.log(`  🔴 「${g.낱말}」 — ${g.왜}`));
    console.log(걸린.length ? `\n  🔴 판정: ${걸린.length}개가 종이에 있다.` : '\n  ✅ 판정: 검사 낱말 0개.');
    process.exitCode = 걸린.length ? 1 : 0;
    return;
  }
  if (argv.includes('--넘침시험')) {
    const r = 증서.실측(html, 부풀리기, 측정기);
    const 잡힘 = r.잰것.filter((z) => z.넘침).length;
    console.log(`[넘침시험] 일부러 넘치게 만든 ${r.잰것.length}쪽 중 ${잡힘}쪽을 잡았다`);
    console.log(잡힘 === r.잰것.length
      ? '  ✅ 측정기가 넘침을 본다 — 위 「들어감」 판정을 믿어도 된다.'
      : '  🔴 측정기가 눈이 멀었다 — 글이 쪽을 넘어도 안 잡힌다.');
    process.exitCode = (잡힘 === r.잰것.length) ? 0 : 1;
    return;
  }
  if (argv.includes('--실측')) {
    const r = 증서.실측(html, null, 측정기);
    console.log(`[기록장조판 실측] ${제목} · A5(148×210mm) · ${r.잰것.length}쪽 · 시즌 ${시즌수}`);
    const 넘침 = r.잰것.filter((z) => z.넘침);
    넘침.forEach((z) => console.log(`  🔴 넘침 ${z.쪽}쪽 · 모자란 만큼 ${-z.남는여백mm}mm`));
    const 기대쪽수 = 2 + 시즌수 * 2 + 5;   // 표지·여는쪽 + 시즌×2 + 문장짝·도장·도감·닫는쪽·뒤표지
    console.log(`  쪽수 ${r.잰것.length} · 기대 ${기대쪽수}(표지 1 + 여는 쪽 1 + 시즌 ${시즌수}×2 + 대표·도장·도감·닫는·뒤표지 5)`);
    console.log(r.잰것.length === 기대쪽수
      ? '  ✅ 시즌당 쪽수가 고정이다 — 사진 수가 두께를 정하지 않는다(§5-b-2 첫 규칙).'
      : '  🔴 쪽수가 기대와 다르다 — 결석이 책 두께로 보이게 될 자리다.');
    console.log(넘침.length
      ? `  🔴 판정: ${넘침.length}쪽이 넘친다 — overflow:hidden 이라 종이에서는 잘린 줄이 «없는 줄»로 보인다.`
      : `  ✅ 판정: 전 쪽이 들어간다(가장 빠듯한 쪽의 남는 여백 ${Math.min.apply(null, r.잰것.map((z) => z.남는여백mm))}mm).`);
    process.exitCode = (넘침.length || r.잰것.length !== 기대쪽수) ? 1 : 0;
    return;
  }

  const 기본 = path.join(os.tmpdir(), 'synk-기록장조판');
  const out = path.resolve(값('--out', path.join(기본, `기록장_${자료.이름 || '견본'}.html`)));
  const pdf = argv.includes('--pdf') ? out.replace(/\.html$/, '.pdf') : null;
  const r = 증서.굽기(html, out, pdf);
  console.log(`[기록장조판] ${out}`);
  // ⚠ 쪽들 배열의 길이는 «쪽 수»가 아니다 — 시즌 스프레드가 두 쪽을 한 덩어리로 낸다.
  const 쪽수 = (html.match(/<div class="쪽[ "]/g) || []).length;   // ⚠ 「쪽번호」까지 세지 않게 경계를 둔다
  console.log(`  ${제목} · A5 제본 원고 · ${쪽수}쪽 · 시즌 ${시즌수} · ${모양} 재료`);
  console.log(`  채워야 할 칸 ${장부.length}개${장부.length ? ' — ' + 장부.slice(0, 4).join(' · ') + (장부.length > 4 ? ' …' : '') : ''}`);
  if (!r.임베드) console.log(`  ⚠ 폰트 임베드 실패 — 원고 그대로 냈다(기계 폰트로 그려진다): ${r.까닭}`);
  else if (pdf) console.log(`  PDF ${pdf}`);
  console.log('  ▶ 넘침·쪽수 고정은 `node tools/기록장조판.js --실측` 이 잰다.');
}

if (require.main === module) main();

module.exports = { 문안, 기록장, 지면, CSS, 시즌칸들, 픽스처, 측정기, 부풀리기 };
