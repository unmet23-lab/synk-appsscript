#!/usr/bin/env node
/* 증서조판 — 시즌 증서(A5)와 수료증(A4)을 굽는다. (정본 = docs/가져가는것_설계_v1.md §9·§11·§12)
 *
 * 왜 새 도구인가: 설계 §12-b 가 증서를 **발표물 계열**(고정 판형 · 외주 발주물)로 가른다.
 *   발표물빌드는 `docs/발표물/_src_*.html` 을 굽는 통로라 «학생 데이터로 한 장씩 나오는» 종이를 못 낸다.
 *   ⚠ 새로 생기는 것은 이 파일 하나다 — CSS 생성기·폰트 통로·로고 통로·크롬 찾기는 **0벌 신설**이고
 *   전부 이미 있는 한 곳에서 받아 쓴다(§12-a). 값을 여기 베끼면 그 순간 두 벌이 된다.
 *
 * 🔴 굽는 순서가 이 파일의 급소다 — **지면 완성 → 폰트 임베드 → PDF**.
 *   반대로 하면 종이만 옛 판이 된다. 그 병이 실재한다: `발표물빌드.js` 는 HTML 을 굽는 자리에서
 *   PDF 를 뽑고 지면 부품은 «그 뒤»에 얹어서, 인쇄물 PDF 에 부품이 한 조각도 안 실렸다
 *   (09-03 실측 · 트랙 §6). 여기서는 파이썬에 넘기기 «전»에 지면을 끝낸다.
 *
 * 쓰는 법:
 *   node tools/증서조판.js                       → 시즌 증서 A5 한 장(3회차 픽스처)
 *   node tools/증서조판.js --회차 5              → 회차를 바꿔서
 *   node tools/증서조판.js --수료                → 수료증 A4 한 장
 *   node tools/증서조판.js --한판                → 여섯 장 + 수료증(발주 견본 · 한 파일)
 *   node tools/증서조판.js --최소                → 재료가 «가장 없는» 학생(채움 사다리 시험 · §5-b-2)
 *   node tools/증서조판.js --최악                → 가장 긴 이름·가장 긴 문장(칸 넘침 시험)
 *   node tools/증서조판.js --데이터 <파일.json>  → 실데이터로
 *   node tools/증서조판.js --시즌색              → 시즌마다 실을 갈아 끼운다(유호 판정 ⑤ 전엔 꺼짐)
 *   node tools/증서조판.js --pdf                 → 폰트 임베드 + PDF 까지
 *   node tools/증서조판.js --실측                → 헤드리스 크롬으로 넘침·빈칸을 «잰다»
 *   node tools/증서조판.js --넘침시험            → 그 자가 «눈이 멀지 않았나» 되묻는다
 *   node tools/증서조판.js --금칙                → 인쇄 금지 계약(§9-b)을 검사한다
 *   node tools/증서조판.js --out <경로>          → 저장 위치
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const 로고 = require('./lib/로고정본.js');
const { findChrome } = require('./브랜드렌더린트.js');   // 크롬 찾기는 한 벌만 산다

const ROOT = path.resolve(__dirname, '..');
const 토큰 = require(path.join(ROOT, 'docs', '디자인_토큰.json'));

/** 색은 «이름»으로 부른다 — hex 를 이 파일에 적으면 토큰이 바뀌어도 종이가 안 따라온다. */
const 색 = Object.fromEntries(토큰['색']['킷'].map((c) => [c['이름'], c['hex']]));
const 서체 = 토큰['서체'];

/* ── 문안 뱅크를 «평가해서» 읽는다 ─────────────────────────────────────────────
 * contents_증서.js 는 Apps Script 파일이라 module.exports 가 없다(있으면 라이브가 죽는다).
 * 그래서 서클조판과 같은 문법으로 평가한다 — 베끼면 그 순간 종이와 뱅크가 갈라진다. */
function 문안() {
  const src = fs.readFileSync(path.join(ROOT, 'contents_증서.js'), 'utf8');
  return new Function(`${src}\nreturn { CERT_SEASON, CERT_COMPLETION, CERT_DEED_SAY, ` +
    'CERT_ORDINAL, CERT_SEASON_MARK, CERT_FOOT_SAY, CERT_BLANK };')();
}

/* ── 조사 고르기 ──────────────────────────────────────────────────────────────
 * 🔑 판정 자체는 엔진의 `josa()` 를 **떼어 쓴다** — 베끼면 그 순간 두 벌이 되고,
 *   한쪽만 고쳐진 날 종이와 화면의 한국어가 갈린다(서클조판이 세운 규약과 같다).
 * 여기서 «감싸는» 것은 엔진 함수가 모르는 두 가지뿐이다:
 *   ① 닫는 부호 — 「…」·"…"·(…) 로 끝나면 그 «안»의 마지막 글자가 조사를 정한다.
 *      안 벗기면 josa 가 비한글로 보고 「을(를)」 병기를 내는데, 그건 서식이지 문장이 아니다.
 *   ② 「으로/로」 — ㄹ 받침은 「로」다(「길로」). 받침 유무만 보는 josa 로는 못 가른다. */
function 엔진josa() {
  const src = fs.readFileSync(path.join(ROOT, '엔진_운영배치.js'), 'utf8');
  const s = src.indexOf('function josa(w, a, b) {');
  if (s < 0) throw new Error('표식을 못 찾았다: 엔진_운영배치.js 의 josa — 이름이 밀렸다');
  const e = src.indexOf('\n}', s);
  return new Function(`${src.slice(s, e + 2)}\nreturn josa;`)();
}
const 조사짝 = { 을: ['을', '를'], 은: ['은', '는'], 이: ['이', '가'], 과: ['과', '와'], 으로: ['으로', '로'] };

function 조사채우기(글, josa) {
  return String(글).replace(/#(으로|을|은|이|과)/g, (m, 표, 자리, 전체) => {
    const 짝 = 조사짝[표];
    const 앞 = 전체.slice(0, 자리).replace(/[」』"'’”\)\]]+$/, '');   // 닫는 부호를 벗기고 그 앞 글자를 본다
    const 끝 = 앞.charCodeAt(앞.length - 1);
    if (표 === '으로' && 끝 >= 0xAC00 && 끝 <= 0xD7A3 && (끝 - 0xAC00) % 28 === 8) return '로';  // ㄹ 받침
    return josa(앞, 짝[0], 짝[1]);
  });
}

/* ── 인쇄 금지 계약 (설계 §9-b) ────────────────────────────────────────────────
 * 🔴 이 계약을 지키던 회귀는 08-19 대청소에 삭제됐다 — 자동으로 안 지켜진다(§12-c).
 *   그래서 이 도구가 **자기 산출물을 스스로 검사한다**(새 테스트 파일을 세우지 않는다).
 * ⚠ 낱말 하나로 못 잡는 것 둘은 여기 안 넣는다 — 「항목을 개수순·난도순으로 정렬」과
 *   「다른 학생보다」의 뜻만 남은 문장. 그 둘은 사람 눈이 본다(자가 못 재는 것을 잰다고 하지 않는다). */
const 금칙 = [
  { 낱말: '점수', 왜: '증서에 점수 0 — 종이는 등수가 되는 순간 비교표가 된다' },
  { 낱말: '정답률', 왜: '같은 목록' },
  { 낱말: '정답 개수', 왜: '같은 목록' },
  { 낱말: '등수', 왜: '같은 목록' },
  { 낱말: '석차', 왜: '같은 목록' },
  { 낱말: '평균', 왜: '같은 목록' },
  { 낱말: '상위', 왜: '「상위 N%」 — 비교의 다른 이름' },
  { 낱말: '다른 학생', 왜: 'S1 — 비교 대상은 어제의 나뿐' },
  { 낱말: '승급', 왜: '승급은 도달제라 미달이면 재회전한다 — 박으면 미달한 학생의 증서가 실패 통지서가 된다' },
  { 낱말: '미달', 왜: '결핍을 종이에 적지 않는다' },
  { 낱말: '실패', 왜: '금칙어(브랜드 규칙)' },
  { 낱말: '부족', 왜: '금칙어' }
];

/** 산출물 HTML 에서 금칙을 센다 — 주석·스크립트가 아니라 «학생이 읽는 글자»만 본다. */
function 금칙검사(html) {
  const 글자 = html
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return 금칙.filter((g) => 글자.includes(g.낱말));
}

/* ── 채움 사다리 (설계 §5-b-2) ────────────────────────────────────────────────
 * 위에서부터 재료가 있는 갈래로 세 줄을 채우고, 차면 멈춘다.
 * 🔴 사다리가 없으면 결석이 잦은 아이의 증서가 눈에 보이게 빈다 — 화면에서 안 띄우기로 한
 *   비교가 종이에서 되살아나는 자리다. 아래 갈래는 전부 «결석과 무관하게 그 아이만의 것»이다. */
function 한일세줄(뱅크, 재료) {
  const josa = 엔진josa();
  const 줄 = [];
  for (const 틀 of 뱅크.CERT_DEED_SAY) {
    if (줄.length >= 3) break;
    const 값 = (재료 || {})[틀.갈래];
    if (!값) continue;
    // ⚠ 자리표 이름은 한글이다 — `\w` 는 ASCII 만 잡아서 한 글자도 안 채운다(첫 판이 그랬다).
    const 채운 = 틀.틀.replace(/\{([^}]+)\}/g, (m, k) => (값[k] == null ? '' : String(값[k])));
    if (/\{|^\s*$/.test(채운)) continue;          // 자리표가 남았으면 안 쓴다(반쪽 문장을 종이에 안 낸다)
    줄.push({ 갈래: 틀.갈래, 글: 조사채우기(채운, josa) });
  }
  return 줄;
}

/* ── 픽스처 ────────────────────────────────────────────────────────────────────
 * 실데이터가 오기 전에 «조판이 서는가»를 재는 재료다. 세 벌을 둔다:
 *   평시 / 최소(재료가 가장 없는 학생 — 사다리 시험) / 최악(가장 긴 이름·문장 — 넘침 시험).
 * 이름은 실제 몽골 이름의 «길이 분포»를 따른다 — 짧은 이름으로만 재면 칸이 넉넉해 보인다. */
function 픽스처(모양, 회차) {
  const 공통 = { 회차: 회차, 날짜: '2027년 6월 12일', 원장: '' };
  if (모양 === '최소') {
    return Object.assign({}, 공통, {
      이름: '체첵마',
      재료: { 함께한날: { 첫날: '2027년 4월 20일', 끝날: '2027년 6월 12일' } }
    });
  }
  if (모양 === '최악') {
    return Object.assign({}, 공통, {
      이름: '어트건바야르 엥흐자르갈',            // 몽골 이름 두 마디 — 한 줄에 안 들어가는 쪽
      재료: {
        해낸일: { 무엇: '반 친구들 앞에서 몽골의 명절을 한국어로 소개하는 일' },
        순간: { 날짜: '5월 22일', 한줄: '무대에서 우리 반이 준비한 이야기를 끝까지 말한 날' },
        나침반: { 목표: '한국 친구에게 우리 집 이야기를 막힘 없이 들려주기' },
        고쳐쓴문장: { 처음: '나는 학교에 갔다 그리고 밥 먹었다', 지금: '학교에 갔다가 친구들과 같이 밥을 먹었어요' },
        함께한날: { 첫날: '2027년 4월 20일', 끝날: '2027년 6월 12일' },
        카드: { 카드: '오늘의 한 문장' }
      }
    });
  }
  return Object.assign({}, 공통, {
    이름: '뭉흐토야',
    재료: {
      해낸일: { 무엇: '한국어로 자기소개 영상 만들기' },
      순간: { 날짜: '5월 22일', 한줄: '무대에서 끝까지 말한 날' },
      나침반: { 목표: '한국 친구에게 우리 집 이야기 들려주기' },
      고쳐쓴문장: { 처음: '나는 밥 먹었다', 지금: '친구들과 같이 밥을 먹었어요' },
      함께한날: { 첫날: '2027년 4월 20일', 끝날: '2027년 6월 12일' },
      카드: { 카드: '오늘의 한 문장' }
    }
  });
}

function 수료픽스처(모양) {
  return {
    이름: 모양 === '최악' ? '어트건바야르 엥흐자르갈' : '뭉흐토야',
    시즌수: '여섯', 개월수: '열두 달',
    처음문장: '나는 학교 간다',
    지금문장: '오늘은 친구랑 같이 도서관에 가서 한국어 책을 두 권 빌렸어요',
    날짜: '2028년 2월 25일',
    원장: ''
  };
}

/* ── 시즌 표식 — 색 + 무늬 «이중» ─────────────────────────────────────────────
 * 🔴 색만으로 가르지 않는다(§11-c). 몽골 현지에서 흑백으로 다시 복사되는 것을 전제한 규약이라,
 *   색이 빠져도 여섯 장이 서로 구분돼야 한다.
 * ⏳ 실을 갈아 끼우는 것 자체가 유호님 판정 전이다(§14-a ⑤) — 기본은 «끈다»(여섯 장 다 코랄).
 *   무늬는 판정과 무관하게 늘 켠다(그게 흑백 대비의 몫이다). */
const 실색 = { 코랄: 'Coral', 청금석: 'Lapis', 메도우: 'Meadow', 버터: 'Butter', 팝: 'Pop' };
function 표식(뱅크, 회차, 시즌색켬) {
  const 기본 = { 회차: 회차, 실: '코랄', 무늬: '점선' };
  const m = (뱅크.CERT_SEASON_MARK || []).find((x) => x.회차 === 회차) || 기본;
  return { 무늬: m.무늬, 실: 시즌색켬 ? m.실 : '코랄' };
}

/** 무늬를 CSS 배경으로 — 색이 빠져도 남는 층이라 «획»으로만 짓는다(면으로 짓지 않는다). */
function 무늬CSS(무늬, 획) {
  const 결 = {
    점선: `repeating-linear-gradient(90deg, ${획} 0 3px, transparent 3px 7px)`,
    빗금: `repeating-linear-gradient(45deg, ${획} 0 2px, transparent 2px 6px)`,
    물결: `radial-gradient(circle at 3px 6px, ${획} 0 1.6px, transparent 1.7px), ` +
      `radial-gradient(circle at 9px 2px, ${획} 0 1.6px, transparent 1.7px)`,
    이중선: `linear-gradient(${획} 0 0), linear-gradient(${획} 0 0)`,
    마름모: `repeating-linear-gradient(45deg, ${획} 0 2px, transparent 2px 8px), ` +
      `repeating-linear-gradient(-45deg, ${획} 0 2px, transparent 2px 8px)`,
    겹실땀: `repeating-linear-gradient(90deg, ${획} 0 5px, transparent 5px 9px), ` +
      `repeating-linear-gradient(90deg, ${획} 0 2px, transparent 2px 11px)`
  };
  const 크기 = {
    점선: '7px 100%', 빗금: '6px 6px', 물결: '12px 8px',
    이중선: '100% 1px, 100% 1px', 마름모: '8px 8px', 겹실땀: '9px 3px, 11px 6px'
  };
  const 자리 = { 이중선: 'left top, left 4px' };
  return { 그림: 결[무늬] || 결.점선, 크기: 크기[무늬] || 크기.점선, 자리: 자리[무늬] || 'left top' };
}

/* ── 지면 CSS ──────────────────────────────────────────────────────────────────
 * 값은 전부 토큰에서 온다 — 이 함수에 hex 원본이 0개인 것이 규약이다(DESIGN.md §2).
 * 공통 규격은 §11-c 그대로: @page margin 0 · print-color-adjust: exact · 외부 자원 0 · 흑백 대비. */
function CSS(판형) {
  const 폭 = 판형 === 'A4' ? 210 : 148;
  const 높 = 판형 === 'A4' ? 297 : 210;
  return `
  @page { size: ${폭}mm ${높}mm; margin: 0; }
  /*@FONTS@*/
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: ${색['Oat']}; }
  body {
    font-family: ${서체['본문스택'].replace('SUIT Variable', 'SUIT')};
    color: ${색['Ink']};
    letter-spacing: ${서체['트래킹']['본문']};
    -webkit-font-smoothing: antialiased;
  }
  /* 판 — 한 장이 곧 한 쪽이다. 화면에서는 여백을 두어 여러 장을 나란히 보고, 인쇄에서는 딱 맞춘다. */
  .판 {
    width: ${폭}mm; height: ${높}mm; position: relative; overflow: hidden;
    background: ${색['Paper']}; margin: 6mm auto; page-break-after: always; break-after: page;
  }
  @media print { .판 { margin: 0; } body { background: ${색['Paper']}; } .장부 { display: none !important; } }
  .판:last-child { page-break-after: auto; break-after: auto; }

  /* 액자 — 실땀 선. 모든 펠트 오브젝트의 테두리는 Stitch 가 진다(킷 운용 규칙 ②). */
  .액자 {
    position: absolute; inset: ${판형 === 'A4' ? '13mm' : '9mm'};
    border: 1.2pt dashed ${색['Stitch']}; border-radius: 3mm;
    display: flex; flex-direction: column; align-items: center;
    /* 위보다 아래를 넉넉히 — 광학 중심은 기하 중심보다 «위»다(토큰 광학 규칙과 같은 결).
       위아래를 똑같이 주면 글 덩어리가 가라앉아 보인다. */
    padding: ${판형 === 'A4' ? '10mm 14mm 17mm' : '7mm 10mm 12mm'};
    text-align: center;
  }
  /* 시즌 표식 — 액자 위쪽에 걸리는 «획» 한 줄. 색이 빠져도 무늬로 여섯 장이 갈린다. */
  .표식 { position: absolute; top: -1.2pt; left: 12mm; right: 12mm; height: 5px; }

  .로고 { height: ${판형 === 'A4' ? '11mm' : '9mm'}; margin-bottom: ${판형 === 'A4' ? '9mm' : '6mm'}; }
  .로고 svg { height: 100%; width: auto; display: block; }

  .제목 {
    font-weight: ${서체['웨이트']['헤드']}; letter-spacing: ${서체['트래킹']['헤드_태그라인']};
    font-size: ${판형 === 'A4' ? '20pt' : '15pt'}; line-height: ${서체['줄제목'] || 1.24};
    display: flex; align-items: center; gap: 4mm; margin-bottom: ${판형 === 'A4' ? '10mm' : '7mm'};
  }
  /* ⚠ 제목 좌우 장식은 «획»으로 그린다 — 홑화살괄호 같은 기호는 임베드한 세 벌에 글리프가 있는지
     안 재봤다. 안 재본 글자를 종이에 박으면 두부(□)로 인쇄되고, 그건 발주 뒤에야 보인다. */
  .제목::before, .제목::after {
    content: ''; width: ${판형 === 'A4' ? '14mm' : '10mm'}; height: 1.2pt;
    background: ${색['Stitch']};
  }
  .받는이 {
    font-size: ${판형 === 'A4' ? '15pt' : '12pt'}; font-weight: ${서체['웨이트']['강조_라벨']};
    margin-bottom: ${판형 === 'A4' ? '7mm' : '5mm'}; line-height: 1.5;
  }
  .본문 {
    font-size: ${판형 === 'A4' ? '12.5pt' : '10.5pt'}; line-height: 1.85;
    color: ${색['Deep Wool']}; margin-bottom: ${판형 === 'A4' ? '10mm' : '7mm'};
  }
  .본문 b { color: ${색['Ink']}; font-weight: ${서체['웨이트']['강조_라벨']}; }

  /* 🔑 위 덩어리(로고~한 일)를 «하나»로 묶어 위아래 auto 를 준다.
     묶지 않고 한 일에만 auto 를 걸면 본문과 한 일 사이가 벌어져 두 덩어리로 끊겨 읽힌다 —
     증서는 「누가·무엇을 했나」가 한 호흡이라야 하고, 끊기면 상장 양식처럼 보인다(첫 두 판이 그랬다). */
  .위 {
    width: 100%; display: flex; flex-direction: column; align-items: center;
    margin-top: auto; margin-bottom: auto;
  }
  /* 한 일 세 줄 — 신호 한 점(코랄)이 여기 한 자리에만 선다. 면으로 쓰고 글자는 얹지 않는다. */
  .한일 { width: 100%; text-align: left; }
  .한일머리 {
    font-size: ${판형 === 'A4' ? '10.5pt' : '9pt'}; color: ${색['Ash Wool']};
    margin-bottom: ${판형 === 'A4' ? '4mm' : '3mm'}; letter-spacing: .02em;
  }
  .한일 ul { list-style: none; margin: 0; padding: 0; }
  .한일 li {
    font-size: ${판형 === 'A4' ? '11pt' : '9.5pt'}; line-height: 1.7;
    padding-left: 6mm; position: relative; margin-bottom: ${판형 === 'A4' ? '3.5mm' : '2.6mm'};
  }
  .한일 li::before {
    content: ''; position: absolute; left: 1.6mm; top: .62em;
    width: 2.2mm; height: 2.2mm; border-radius: 50%; background: ${색['Coral']};
  }

  /* 수료증 본문 — 처음 쓴 문장 ↔ 지금 쓰는 문장. 이 두 줄이 급수 한 줄보다 오래 남는다. */
  .문장짝 { width: 100%; text-align: left; }
  .문장짝 .칸 { margin-bottom: 8mm; }
  .문장짝 .머리 { font-size: 10pt; color: ${색['Ash Wool']}; margin-bottom: 2.5mm; }
  .문장짝 .글 {
    font-size: 12.5pt; line-height: 1.7; padding-bottom: 2.5mm;
    border-bottom: 1.2pt dashed ${색['Stitch']};
  }

  .꼬리 { width: 100%; display: flex; justify-content: flex-end; }
  .꼬리 .속 { text-align: right; }
  /* 🔴 날짜에 모노(DM Mono)를 걸지 않는다 — 「2027년 6월 12일」은 숫자와 한글이 «한 줄에 섞인» 글이고
     DM Mono 엔 한글 글리프가 0이다. 걸면 「년·월·일」 세 글자만 기계 글꼴로 떨어진다.
     첫 판이 그랬고 python docs/tools/인쇄물_키트검사.py 가 종이에서 굴림체로 잡아냈다
     (화면에서는 안 보인다 — 폴백은 «실패»가 아니라 «통과»로 보인다).
     설계 §9-c 의 「숫자·판번호 DM Mono」는 숫자«만» 서는 자리를 말하고, 증서엔 그런 자리가 없다. */
  .날짜 {
    font-size: ${판형 === 'A4' ? '10pt' : '8.5pt'}; color: ${색['Deep Wool']};
    letter-spacing: .02em; margin-bottom: 2mm;
  }
  .서명 { font-size: ${판형 === 'A4' ? '11.5pt' : '10pt'}; font-weight: ${서체['웨이트']['강조_라벨']}; }
  .원장줄 { font-size: ${판형 === 'A4' ? '10.5pt' : '9pt'}; color: ${색['Deep Wool']}; margin-top: 2mm; }

  /* ⚠ 흐름 «안»에 둔다 — absolute 로 바닥에 붙이면 액자 안쪽 여백을 넘어서고,
     그 넘침은 실측에서 −5.2mm 로 잡히면서도 화면에선 멀쩡해 보인다(첫 판이 그랬다). */
  .발 {
    width: 100%; margin-top: ${판형 === 'A4' ? '6mm' : '4mm'};
    text-align: center; font-size: ${판형 === 'A4' ? '8pt' : '7pt'}; color: ${색['Ash Wool']};
  }
  /* 못 채운 칸 — 지어내지 않고 비운다(§11-c). 손으로 적어 넣는 자리라 밑줄이 보여야 한다. */
  .빈칸 { color: ${색['Stone']}; letter-spacing: .06em; }

  /* 채워야 할 칸 장부 — 화면에서만 본다. 인쇄면엔 «가이드·설명»을 안 남긴다(§11-c). */
  .장부 {
    max-width: 148mm; margin: 10mm auto 20mm; padding: 6mm 7mm; background: ${색['Coral Wash']};
    border: 1.2pt dashed ${색['Coral']}; border-radius: 3mm; font-size: 10pt; line-height: 1.7;
    color: ${색['Coral 3']};
  }
  .장부 h2 { margin: 0 0 3mm; font-size: 11pt; }
  .장부 ul { margin: 0; padding-left: 5mm; }
  .장부 .없음 { color: ${색['Deep Wool']}; }
`;
}

const 이스케이프 = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 자리표를 채운다 — 값이 없으면 CERT_BLANK 로 비우고 «무엇이 비었는지»를 장부에 적는다. */
function 채우기(틀, 값, 장부, 어디, 뱅크) {
  return String(틀).replace(/\{([^}]+)\}/g, (m, k) => {
    const v = 값[k];
    if (v == null || v === '') {
      장부.push(`${어디} — ${k}`);
      return `<span class="빈칸">${뱅크.CERT_BLANK}</span>`;
    }
    return 이스케이프(v);
  });
}

/** 시즌 증서 한 장. */
function 시즌판(뱅크, 자료, 옵션) {
  const 장부 = [];
  const S = 뱅크.CERT_SEASON;
  const 회차말 = 뱅크.CERT_ORDINAL[자료.회차 - 1] || String(자료.회차);
  const 값 = Object.assign({}, 자료, { 회차: 회차말 });
  const 표 = 표식(뱅크, 자료.회차, !!옵션.시즌색);
  const 무 = 무늬CSS(표.무늬, 색[실색[표.실]] || 색['Coral']);
  const 줄 = 한일세줄(뱅크, 자료.재료);
  if (!줄.length) 장부.push('한 일 세 줄 — 재료가 하나도 없다(채움 사다리 여섯 갈래 전부 빔)');

  const 한일 = 줄.length
    ? `<div class="한일">
        <div class="한일머리">${이스케이프(S.한일머리)}</div>
        <ul>${줄.map((l) => `<li>${이스케이프(l.글)}</li>`).join('')}</ul>
      </div>`
    : `<div class="한일"><div class="한일머리">${이스케이프(S.한일머리)}</div>
        <ul>${[0, 1, 2].map(() => `<li><span class="빈칸">${뱅크.CERT_BLANK}${뱅크.CERT_BLANK}</span></li>`).join('')}</ul>
      </div>`;

  return {
    html: `<div class="판">
    <div class="액자">
      <div class="표식" style="background-image:${무.그림};background-size:${무.크기};background-position:${무.자리};background-repeat:repeat-x"></div>
      <div class="위">
        <div class="로고">${로고.워드마크({ 판: '라이트', 표현: '민' })}</div>
        <div class="제목">${이스케이프(S.제목)}</div>
        <div class="받는이">${채우기(S.받는이, 값, 장부, `${회차말} 시즌 증서`, 뱅크)}</div>
        <div class="본문">${S.본문.map((b) => 채우기(b, 값, 장부, `${회차말} 시즌 증서`, 뱅크)).join('<br>')}</div>
        ${한일}
      </div>
      <div class="꼬리"><div class="속">
        <div class="날짜">${채우기(S.날짜, 값, 장부, `${회차말} 시즌 증서`, 뱅크)}</div>
        <div class="서명">${이스케이프(S.서명)}</div>
      </div></div>
      <div class="발">${채우기(뱅크.CERT_FOOT_SAY.시즌, 값, 장부, `${회차말} 시즌 증서`, 뱅크)}</div>
    </div>
  </div>`,
    장부: 장부
  };
}

/** 수료증 한 장. */
function 수료판(뱅크, 자료) {
  const 장부 = [];
  const C = 뱅크.CERT_COMPLETION;
  return {
    html: `<div class="판">
    <div class="액자">
      <div class="위">
        <div class="로고">${로고.워드마크({ 판: '라이트', 표현: '민' })}</div>
        <div class="제목">${이스케이프(C.제목)}</div>
        <div class="받는이">${채우기(C.받는이, 자료, 장부, '수료증', 뱅크)}</div>
        <div class="본문">${C.본문.map((b) => 채우기(b, 자료, 장부, '수료증', 뱅크)).join('<br>')}</div>
        <div class="문장짝">
        <div class="칸"><div class="머리">${이스케이프(C.문장머리.처음)}</div>
          <div class="글">${채우기('{처음문장}', 자료, 장부, '수료증', 뱅크)}</div></div>
        <div class="칸"><div class="머리">${이스케이프(C.문장머리.지금)}</div>
          <div class="글">${채우기('{지금문장}', 자료, 장부, '수료증', 뱅크)}</div></div>
        </div>
      </div>
      <div class="꼬리"><div class="속">
        <div class="날짜">${채우기(C.날짜, 자료, 장부, '수료증', 뱅크)}</div>
        <div class="서명">${이스케이프(C.서명)}</div>
        <div class="원장줄">${채우기(C.원장줄, 자료, 장부, '수료증', 뱅크)}</div>
      </div></div>
    </div>
  </div>`,
    장부: 장부
  };
}

function 지면(제목, 판형, 판들, 장부) {
  const 장부칸 = 장부.length
    ? `<div class="장부"><h2>채워야 할 칸 ${장부.length}개</h2><ul>` +
      장부.map((b) => `<li>${이스케이프(b)}</li>`).join('') +
      '</ul></div>'
    : '<div class="장부"><h2>채워야 할 칸 0개</h2><p class="없음">비어 있는 칸이 없다 — 그대로 인쇄해도 된다.</p></div>';
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${이스케이프(제목)}</title>
<style>${CSS(판형)}</style>
</head>
<body>
${판들.join('\n')}
${장부칸}
</body>
</html>`;
}

/* ── 실측 — 넘쳤나 · 빈칸이 남았나 · 두부가 났나 ─────────────────────────────
 * 🔴 「눈으로 보니 들어간다」는 실측이 아니다. A5 는 좁고, 몽골 이름은 길다.
 *   그리고 두부(□)는 **화면에서 안 보이는 기계에서만 안 보인다** — 발주 뒤에 알면 늦는다. */
const 측정기 = `(() => {
  try {
    const mm = 25.4 / 96;
    const 판들 = Array.prototype.slice.call(document.querySelectorAll('.판'));
    const 잰것 = 판들.map(function (p, i) {
      const 액 = p.querySelector('.액자');
      const pr = p.getBoundingClientRect(), ar = 액.getBoundingClientRect();
      let 바닥 = ar.top;
      Array.prototype.slice.call(액.children).forEach(function (c) {
        const r = c.getBoundingClientRect();
        if (r.bottom > 바닥) 바닥 = r.bottom;
      });
      const cs = getComputedStyle(액);
      const 안쪽바닥 = ar.bottom - (parseFloat(cs.paddingBottom) || 0);
      return {
        장: i + 1,
        쪽높이mm: +(pr.height * mm).toFixed(1),
        쪽폭mm: +(pr.width * mm).toFixed(1),
        남는여백mm: +((안쪽바닥 - 바닥) * mm).toFixed(1),
        넘침: 바닥 > 안쪽바닥 + 0.5,
        빈칸: 액.querySelectorAll('.빈칸').length,
        한일줄: 액.querySelectorAll('.한일 li').length
      };
    });
    /* ⚠ 글리프 누락(두부 □)은 여기서 «안» 잰다 — docs/tools/브랜드폰트_임베드.py 가
       폰트 파일의 cmap 으로 이미 재고, 없는 글자가 있으면 **빌드를 깨뜨린다**(--폴백허용 없이는).
       브라우저 폭 비교로 겹쳐 재면 자가 둘이 되고, 실제로 오탐이 났다(라틴 A 를 두부로 신고).
       한 판정에 자는 하나다 — 두부는 굽기가 알고, 이 측정기는 «칸에 들어가는가»만 안다. */
    document.body.insertAdjacentHTML('beforeend',
      '<pre id="SYNK_' + 'CERT_OUT">' + JSON.stringify({ 잰것: 잰것 }) + '</pre>');
  } catch (e) {
    document.body.insertAdjacentHTML('beforeend',
      '<pre id="SYNK_' + 'CERT_OUT">' + JSON.stringify({ 오류: String(e) }) + '</pre>');
  }
})();`;

/* 부풀리기 — 측정기가 «눈이 멀지 않았나» 되묻는 자리(서클조판이 세운 선례).
 * 🔴 넘침 0건은 «안 넘쳤다»와 «못 봤다»가 똑같은 얼굴로 온다. 일부러 넘치게 만들어
 *   잡히는지 보지 않으면, 이 도구의 초록은 아무것도 보장하지 않는다.
 * 부풀리기는 «브라우저 안»에서 한다 — 픽스처를 길게 만들면 조판 쪽이 먼저 접거나 줄여서
 *   DOM 엔 넘치는 줄이 안 남고, 그게 「자가 눈멀었다」와 구분이 안 된다. */
const 부풀리기 = `(() => {
  Array.prototype.slice.call(document.querySelectorAll('.판 .위')).forEach(function (위) {
    const p = document.createElement('p');
    p.style.cssText = 'font-size:12pt;line-height:1.7;margin:0';
    p.textContent = new Array(60).join('아주 긴 문장이 이어집니다 ');
    위.appendChild(p);
  });
})();`;

function 실측(html, 주입) {
  const chrome = findChrome();
  if (!chrome) throw new Error('크롬을 못 찾았다 — CHROME_PATH 로 지정하라(실측 없이 「통과」라고 쓰지 않는다)');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-증서-'));
  const tmp = path.join(dir, 'page.html');
  try {
    fs.writeFileSync(tmp, html.replace('</body>', '<script>' + (주입 || '') + 측정기 + '</script></body>'), 'utf8');
    // ⚠ 한글 경로 → encodeURI. 안 하면 빈 문서가 뜨고 「넘침 0건」으로 통과한다.
    const url = 'file:///' + encodeURI(tmp.replace(/\\/g, '/'));
    const out = execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--allow-file-access-from-files', '--virtual-time-budget=8000', '--dump-dom', url],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    const m = out.match(/<pre id="SYNK_CERT_OUT">([\s\S]*?)<\/pre>/);
    if (!m) throw new Error('측정기가 결과를 못 냈다 — 로드 실패이거나 페이지 스크립트 오류');
    const r = JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
    if (r.오류) throw new Error('측정기 예외: ' + r.오류);
    // 빈 결과를 통과로 읽지 않는다 — 로드 실패도 「넘침 0건」과 같은 모양으로 온다.
    if (!r.잰것 || !r.잰것.length) throw new Error('장을 하나도 못 쟀다 — 로드 실패를 통과로 읽을 뻔했다');
    return r;
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 정리 실패는 결과를 안 바꾼다 */ }
  }
}

/* ── 굽기 — 지면 완성 → 폰트 임베드 → PDF ────────────────────────────────────
 * 🔴 순서를 뒤집지 않는다(머리말). 파이썬에 넘어가는 것은 «이미 끝난 지면»이다. */
function 굽기(html, out, pdf) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const 임베드 = path.join(ROOT, 'docs', 'tools', '브랜드폰트_임베드.py');
  const 원고 = out.replace(/\.html$/, '.원고.html');
  fs.writeFileSync(원고, html, 'utf8');
  const 인자 = [임베드, 원고, out];
  if (pdf) 인자.push('--pdf', pdf);
  const r = require('child_process').spawnSync('python', 인자, { encoding: 'utf8' });
  if (r.status !== 0) {
    // 파이썬이 없거나 fontTools 가 없으면 «원고 그대로»를 낸다 — 다만 그것이 임베드본이 아님을 말한다.
    fs.writeFileSync(out, html, 'utf8');
    try { fs.unlinkSync(원고); } catch { /* 지우기 실패는 결과를 안 바꾼다 */ }
    return { 임베드: false, 까닭: (r.stderr || r.error && r.error.message || '알 수 없음').trim().split('\n').pop() };
  }
  try { fs.unlinkSync(원고); } catch { /* 같은 이유 */ }
  return { 임베드: true };
}

function main() {
  const argv = process.argv.slice(2);
  const 값 = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
  const 뱅크 = 문안();
  const 옵션 = { 시즌색: argv.includes('--시즌색') };
  const 모양 = argv.includes('--최소') ? '최소' : argv.includes('--최악') ? '최악' : '평시';
  const 회차 = Number(값('--회차', '3')) || 3;
  const 데이터 = 값('--데이터', '');
  const 자료 = 데이터 ? JSON.parse(fs.readFileSync(path.resolve(데이터), 'utf8')) : null;

  let 제목, 판형, 판들 = [], 장부 = [], 이름;
  if (argv.includes('--한판')) {
    // 발주 견본 — 여섯 장이 한 판이 되는 것을 «한 파일»에서 본다. 판형은 A5 로 맞추고 수료증은 따로 낸다.
    제목 = 'SYNK 시즌 증서 여섯 장 — 발주 견본'; 판형 = 'A5'; 이름 = '증서_한판';
    for (let i = 1; i <= 6; i += 1) {
      const r = 시즌판(뱅크, 픽스처(모양, i), 옵션);
      판들.push(r.html); 장부 = 장부.concat(r.장부);
    }
  } else if (argv.includes('--수료')) {
    제목 = 'SYNK 수료증'; 판형 = 'A4'; 이름 = '수료증';
    const r = 수료판(뱅크, 자료 || 수료픽스처(모양));
    판들.push(r.html); 장부 = r.장부;
  } else {
    제목 = `SYNK 시즌 증서 — ${회차}회차`; 판형 = 'A5'; 이름 = `시즌증서_${회차}회차`;
    const r = 시즌판(뱅크, 자료 || 픽스처(모양, 회차), 옵션);
    판들.push(r.html); 장부 = r.장부;
  }
  const html = 지면(제목, 판형, 판들, 장부);

  if (argv.includes('--금칙')) {
    const 걸린 = 금칙검사(html);
    console.log(`[금칙 검사] 설계 §9-b 인쇄 금지 계약 — 검사 낱말 ${금칙.length}개`);
    걸린.forEach((g) => console.log(`  🔴 「${g.낱말}」 — ${g.왜}`));
    console.log(걸린.length
      ? `\n  🔴 판정: ${걸린.length}개가 종이에 있다. 이 증서는 발주하면 안 된다.`
      : '\n  ✅ 판정: 검사 낱말 0개. ⚠ 낱말로 못 재는 둘(개수순 정렬 · 「다른 학생보다」의 뜻만 남은 문장)은 사람 눈이 본다.');
    process.exitCode = 걸린.length ? 1 : 0;
    return;
  }

  if (argv.includes('--넘침시험')) {   // 측정기가 «눈이 멀지 않았나» — 일부러 넘치게 만들어 잡히는지 본다
    const r = 실측(html, 부풀리기);
    const 잡힘 = r.잰것.filter((z) => z.넘침).length;
    console.log(`[넘침시험] 일부러 넘치게 만든 ${r.잰것.length}장 중 ${잡힘}장을 잡았다`);
    console.log(잡힘 === r.잰것.length
      ? '  ✅ 측정기가 넘침을 본다 — 위 「들어감」 판정을 믿어도 된다.'
      : '  🔴 측정기가 눈이 멀었다 — 글이 액자를 넘어도 안 잡힌다. 이 도구의 초록을 쓰지 마라.');
    process.exitCode = (잡힘 === r.잰것.length) ? 0 : 1;
    return;
  }

  if (argv.includes('--실측')) {
    const r = 실측(html);
    const 기대 = 판형 === 'A4' ? [210, 297] : [148, 210];
    console.log(`[증서조판 실측] ${제목} · ${판형}(${기대[0]}×${기대[1]}mm) · ${r.잰것.length}장`);
    r.잰것.forEach((z) => {
      const 표 = z.넘침 ? '🔴 넘침' : '✅ 들어감';
      console.log(`  ${표.padEnd(8)} ${z.장}장 ${z.쪽폭mm}×${z.쪽높이mm}mm · 남는 여백 ${z.남는여백mm}mm ` +
        `· 한 일 ${z.한일줄}줄 · 빈칸 ${z.빈칸}개`);
    });
    const 넘침 = r.잰것.filter((z) => z.넘침);
    const 최소여백 = Math.min.apply(null, r.잰것.map((z) => z.남는여백mm));
    console.log(넘침.length
      ? `\n  🔴 판정: ${넘침.length}장이 액자를 넘는다 — overflow:hidden 이라 종이에서는 잘린 줄이 «없는 줄»로 보인다.`
      : `\n  ✅ 판정: 전 장이 들어간다(가장 빠듯한 장의 남는 여백 ${최소여백}mm).`);
    console.log('  ▶ 글리프 누락(두부 □)은 이 자가 안 잰다 — `--pdf` 로 구울 때 폰트 임베드가 재고 깨뜨린다.');
    process.exitCode = 넘침.length ? 1 : 0;
    return;
  }

  const 기본 = path.join(os.tmpdir(), 'synk-증서조판');
  const out = path.resolve(값('--out', path.join(기본, `${이름}.html`)));
  const pdf = argv.includes('--pdf') ? out.replace(/\.html$/, '.pdf') : null;
  const r = 굽기(html, out, pdf);

  console.log(`[증서조판] ${out}`);
  console.log(`  ${제목} · ${판형} · ${판들.length}장 · ${모양} 재료`);
  console.log(`  시즌 실 갈아 끼우기: ${옵션.시즌색 ? '켬' : '끔(유호님 판정 ⑤ 전 · 무늬는 늘 켠다)'}`);
  console.log(`  채워야 할 칸 ${장부.length}개${장부.length ? ' — ' + 장부.slice(0, 4).join(' · ') + (장부.length > 4 ? ' …' : '') : ''}`);
  if (!r.임베드) console.log(`  ⚠ 폰트 임베드 실패 — 원고 그대로 냈다(기계 폰트로 그려진다): ${r.까닭}`);
  else if (pdf) console.log(`  PDF ${pdf}`);
  console.log('  ▶ 넘침·두부는 눈이 아니라 `node tools/증서조판.js --실측` 이 잰다.');
  console.log('  ▶ 인쇄 금지 계약은 `node tools/증서조판.js --금칙` 이 잰다(회귀가 08-19 에 삭제됐다).');
}

if (require.main === module) main();

module.exports = { 문안, 시즌판, 수료판, 지면, CSS, 한일세줄, 금칙검사, 금칙, 픽스처, 수료픽스처, 실측, 표식 };
