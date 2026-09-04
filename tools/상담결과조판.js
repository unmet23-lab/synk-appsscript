#!/usr/bin/env node
/* 상담결과조판 — 상담이 끝난 자리에서 학생 손에 쥐여 주는 A4 한 장을 «채워서» 굽는다.
 *
 * 왜 이 파일이 생겼나: 지면(`docs/발표물/_src_10_상담결과_요약_A4.html`)은 이미 완성돼 있는데
 *   **밑줄 열 칸을 원장이 손으로 적고 있었다.** 상담시트에는 그 열 칸을 채울 답이 104칸이나
 *   들어오는데 아무도 안 읽는다 — 그 사이를 잇는 자가 없던 것이 09-04 조사의 결론이다
 *   (판정 재료 = `docs/시트제미나이_활용_판정_2026-09-04.md`).
 *   유호 확정 09-05 「상담 결과 종이 채우기도 해」.
 *
 * 🔴 이 도구는 «채우는 자»이지 «판단하는 자»가 아니다.
 *   무엇을 쓸지(말한 목표·특히 맞을 것·다음 단계)는 상담 답을 겹쳐 읽는 쪽이 정하고,
 *   여기는 그 값을 받아 **지면의 제자리에 꽂고, 넘치는지·금칙에 걸리는지 잰다.**
 *   판단을 여기서 하면 종이마다 다른 규칙이 생기고 근거를 되짚을 수 없게 된다.
 *
 * 🔑 새로 생기는 것은 이 파일 하나다. 크롬 찾기·넘침 측정·폰트 임베드·금칙 목록은
 *   **0벌 신설**이고 전부 이미 있는 한 곳에서 떼어 쓴다(증서조판이 세운 규약 §12-a).
 *   값을 여기 베끼면 그 순간 두 벌이 되고, 한쪽만 고쳐진 날 종이가 조용히 갈린다.
 *
 * 🔴 자리를 «순서»로 찾지 않는다 — 라벨 이름으로 찾는다.
 *   지면에 칸이 하나 끼어들면 순서 매칭은 전부 한 칸씩 밀리는데, 그 사고는 종이에서
 *   「이름 칸에 상담일이 찍힌」 모양으로 나타난다. 라벨이 없으면 **실패로 멈춘다** —
 *   조용히 건너뛰면 빈 종이가 「채워진 종이」 얼굴로 나온다.
 *
 * 쓰는 법:
 *   node tools/상담결과조판.js                     → 픽스처 한 장(시험값)
 *   node tools/상담결과조판.js --데이터 <파일.json> → 실값으로
 *   node tools/상담결과조판.js --최악              → 가장 긴 값(칸 넘침 시험)
 *   node tools/상담결과조판.js --빈종이            → 값 0 (지금처럼 손으로 적는 판)
 *   node tools/상담결과조판.js --실측              → 헤드리스 크롬으로 넘침을 «잰다»
 *   node tools/상담결과조판.js --넘침시험          → 그 자가 «눈이 멀지 않았나» 되묻는다
 *   node tools/상담결과조판.js --pdf               → 폰트 임베드 + PDF 까지
 *   node tools/상담결과조판.js --out <경로>        → 저장 위치
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
/* 크롬 찾기·측정 통로·폰트 임베드는 증서조판이 이미 한 벌 갖고 있다 — 떼어 쓴다. */
const { 실측, 굽기 } = require('./증서조판.js');
/* 인쇄 금지 계약의 정본은 발표물린트 한 곳이다. */
const { STUDENT_BANNED } = require('./발표물린트.js');

const 원고경로 = path.join(ROOT, 'docs', '발표물', '_src_10_상담결과_요약_A4.html');

/* ── 채우는 칸 열 개 ──────────────────────────────────────────────────────────
 * `라벨` = 지면에 실제로 박혀 있는 글자다. 여기 적은 것과 지면이 어긋나면 **굽기가 멈춘다** —
 *   그것이 이 표의 값어치다(지면을 고친 사람이 이 파일도 고치게 만든다).
 * `누가` = 그 칸을 누가 정하나. 종이를 만든 뒤 「무엇이 사람 몫인가」를 되짚을 때 쓴다.
 *   시트  = 상담시트 칸끼리 이으면 나온다
 *   읽기  = 상담 답 여러 칸을 겹쳐 읽어야 나온다(AI 든 사람이든)
 *   사람  = 원장이 그 자리에서 정한다 */
const 칸들 = [
  { 키: '이름',       라벨: '이름',                              누가: '시트' },
  { 키: '상담일',     라벨: '상담일',                            누가: '시트' },
  { 키: '상담자',     라벨: '상담한 사람',                       누가: '시트' },
  { 키: '지금자리',   라벨: '지금 자리',                         누가: '시트' },
  { 키: '말한목표',   라벨: '이 학생이 말한 목표 — 본인의 말 그대로', 누가: '읽기' },
  { 키: '추천반',     라벨: '추천 반',                           누가: '읽기' },
  { 키: '요일시간',   라벨: '요일 · 시간',                       누가: '시트' },
  { 키: '맞을것',     라벨: '이 학생에게 특히 맞을 것',          누가: '읽기' },
  { 키: '수강조건',   라벨: '안내한 수강 조건',                  누가: '사람' },
  { 키: '다음단계',   라벨: '다음 단계 — 하나만, 날짜와 함께',   누가: '읽기' },
];

/* 「목표까지의 길」 띠 아래 한 줄 — 밑줄 셋이 한 문장 안에 있어 칸 단위로 못 가른다.
 * 그래서 이 셋만 따로 받는다(지면 원문 = 「시작 Lv ____ → 목표 ____급 · 정규 과정 ____시즌」). */
const 길칸들 = ['시작Lv', '목표급수', '시즌수'];

/* ── 글자 수 자는 «지면에서 읽는다» ──────────────────────────────────────────
 * 지면이 스스로 「28자 이내」·「20자 이내」·「18자」를 적고 있다. 그 수를 이 파일에 베끼면
 * 두 곳이 알게 되고, 지면만 고쳐진 날 자가 옛 수를 들고 초록을 낸다.
 *
 * 🔴 첫 판이 여기서 틀렸다 — 「라벨 뒤 구간에서 아무 「N자」나 줍기」로 짰더니,
 *   「지금 자리」 칸이 **자기 것이 아닌 10자를 자기 한도로 물어 왔다.** 그 10자는 빈칸이 아니라
 *   바로 아래 고정 문구(「첫 수업 날 레벨테스트로 확인」)의 조판 한도다.
 *   ⇒ **빈칸 «바로 뒤»에 붙어 있는 「N자」만** 그 칸의 한도로 읽는다. 사이에 무엇이 끼면 남의 것이다. */
function 글자수자(html) {
  const 자 = {};
  칸들.forEach((칸) => {
    const 패턴 = new RegExp(
      '<div class="lbl"[^>]*>________\\s*<span class="ko">' + 이스케이프(칸.라벨) + '</span></div>' +
      '\\s*<div class="fill[^"]*"></div>\\s*<div class="mn">(\\d+)자');
    const m = html.match(패턴);
    if (m) 자[칸.키] = Number(m[1]);
  });
  const 길 = html.match(/시작 Lv ____[^<]*<span class="mn">(\d+)자/);
  if (길) 자.길한줄 = Number(길[1]);
  return 자;
}

/* ── 값 꽂기 ────────────────────────────────────────────────────────────────
 * 라벨 바로 뒤의 첫 `<div class="fill…"></div>` 하나만 채운다. 지면은
 * `<div class="lbl">________ <span class="ko">이름</span></div><div class="fill"></div>` 꼴이다. */
function 꽂기(html, 값) {
  const 못찾은 = [];
  칸들.forEach((칸) => {
    const 라벨패턴 = new RegExp(
      '(<div class="lbl"[^>]*>________\\s*<span class="ko">' + 이스케이프(칸.라벨) + '</span></div>' +
      '[\\s\\S]{0,400}?<div class="(?:fill[^"]*)">)(</div>)');
    if (!라벨패턴.test(html)) { 못찾은.push(칸.라벨); return; }
    const v = 값[칸.키];
    if (v === undefined || v === null || String(v) === '') return; // 빈 값은 밑줄 그대로 둔다
    html = html.replace(라벨패턴, (_, 앞, 뒤) => 앞 + 글자막기(String(v)) + 뒤);
  });
  if (못찾은.length) {
    throw new Error('지면에서 이 칸을 못 찾았다 — 지면이 바뀌었거나 라벨이 갈렸다: ' + 못찾은.join(' · ') +
      '\n  (조용히 건너뛰면 빈 종이가 「채워진 종이」 얼굴로 나온다 · 고칠 곳 = tools/상담결과조판.js 의 칸들)');
  }
  return html;
}

/** 「시작 Lv ____ → 목표 ____급 · 정규 과정 ____시즌」의 밑줄 셋을 값으로. */
function 길꽂기(html, 값) {
  const 있는것 = 길칸들.filter((k) => 값[k] !== undefined && 값[k] !== null && String(값[k]) !== '');
  if (!있는것.length) return html;
  const 원문 = /시작 Lv ____ → 목표 ____급 · 정규 과정 ____시즌/;
  if (!원문.test(html)) {
    throw new Error('「목표까지의 길」 한 줄을 못 찾았다 — 지면 문장이 바뀌었다(tools/상담결과조판.js 의 길꽂기)');
  }
  const 채움 = (k, 기본) => (값[k] ? 글자막기(String(값[k])) : 기본);
  return html.replace(원문,
    '시작 ' + 채움('시작Lv', 'Lv ____') + ' → 목표 ' + 채움('목표급수', '____') + '급 · 정규 과정 ' +
    채움('시즌수', '____') + '시즌');
}

function 이스케이프(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
/** 값은 남이 쓴 글이다(AI 가 쓴 것도 포함) — 지면 태그로 새지 않게 막는다. */
function 글자막기(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── 재는 자 셋 ──────────────────────────────────────────────────────────── */

/** ① 길이 — 지면이 스스로 적은 「N자」를 넘는 값을 잡는다. */
function 길이검사(값, 자) {
  const 넘은것 = [];
  칸들.forEach((칸) => {
    const 한도 = 자[칸.키];
    const v = 값[칸.키];
    if (!한도 || !v) return;
    const 길이 = String(v).length;
    if (길이 > 한도) 넘은것.push({ 칸: 칸.라벨, 한도, 길이, 값: String(v) });
  });
  if (자.길한줄) {
    const 한줄 = 길칸들.map((k) => 값[k] || '').join('');
    if (한줄.length > 자.길한줄) 넘은것.push({ 칸: '목표까지의 길', 한도: 자.길한줄, 길이: 한줄.length, 값: 한줄 });
  }
  return 넘은것;
}

/** ② 금칙 — 🔴 «내가 꽂은 값»만 본다.
 *  지면 틀에 있는 낱말(각주의 「승급」 등)은 유호님이 이미 승인한 문장이고, 그것까지 세면
 *  매번 빨개져 사람이 자를 꺼 버린다. 진짜 위험은 **AI 가 쓴 문장이 금칙을 데려오는 것**이다. */
function 금칙검사(값) {
  const 글자 = 칸들.map((칸) => String(값[칸.키] || '')).join(' ') + ' ' +
    길칸들.map((k) => String(값[k] || '')).join(' ');
  return STUDENT_BANNED.filter(([낱말]) => 글자.includes(낱말)).map(([낱말, 왜]) => ({ 낱말, 왜 }));
}

/** ③ 빈칸 — 무엇이 아직 안 채워졌나. 「사람 몫」과 「빠뜨린 것」을 갈라서 센다. */
function 빈칸세기(값) {
  const 빈것 = 칸들.filter((칸) => {
    const v = 값[칸.키];
    return v === undefined || v === null || String(v) === '';
  });
  return {
    사람몫: 빈것.filter((c) => c.누가 === '사람').map((c) => c.라벨),
    빠짐: 빈것.filter((c) => c.누가 !== '사람').map((c) => c.라벨),
  };
}

/* ── 넘침 측정기 ────────────────────────────────────────────────────────────
 * 🔴 이 지면은 증서와 «구조가 다르다» — `.판`·`.액자`가 없고 A4 한 장에 좌우 두 단이다.
 *   그래서 증서의 측정기를 그대로 쓸 수 없고, 재는 대상도 다르다:
 *   ① 종이 밖으로 넘쳤나(A4 297mm) ② 값이 들어간 칸이 제 높이를 넘겼나.
 * ⚠ 위아래를 «둘 다» 잰다 — 아래만 재면 위로 넘친 줄을 못 잡는다(기록장조판 09-03 의 그 구멍). */
const 측정기 = `(() => {
  try {
    const mm = 25.4 / 96;
    const 쪽 = document.querySelector('.sheet') || document.body;
    const pr = 쪽.getBoundingClientRect();
    let 바닥 = pr.top, 꼭대기 = pr.bottom;
    Array.prototype.slice.call(쪽.querySelectorAll('*')).forEach(function (c) {
      if (getComputedStyle(c).position === 'absolute') return;
      const r = c.getBoundingClientRect();
      if (!r.height) return;
      if (r.bottom > 바닥) 바닥 = r.bottom;
      if (r.top < 꼭대기) 꼭대기 = r.top;
    });
    const 칸 = Array.prototype.slice.call(document.querySelectorAll('.fill')).map(function (f, i) {
      const r = f.getBoundingClientRect();
      const 글 = (f.textContent || '').trim();
      return { i: i, 글자수: 글.length, 높이mm: +(r.height * mm).toFixed(1),
               넘침: f.scrollHeight > f.clientHeight + 1, 글: 글.slice(0, 40) };
    });
    document.body.insertAdjacentHTML('beforeend',
      '<pre id="SYNK_' + 'CERT_OUT">' + JSON.stringify({ 잰것: [{
        장: 1,
        쪽높이mm: +(pr.height * mm).toFixed(1),
        쪽폭mm: +(pr.width * mm).toFixed(1),
        남는여백mm: +(Math.min(pr.bottom - 바닥, 꼭대기 - pr.top) * mm).toFixed(1),
        넘침: 바닥 > pr.bottom + 0.5 || 꼭대기 < pr.top - 0.5,
        칸넘침: 칸.filter(function (c) { return c.넘침; }).length,
        칸: 칸
      }] }) + '</pre>');
  } catch (e) {
    document.body.insertAdjacentHTML('beforeend',
      '<pre id="SYNK_' + 'CERT_OUT">' + JSON.stringify({ 오류: String(e) }) + '</pre>');
  }
})();`;

/* 부풀리기 — 측정기가 «눈이 멀지 않았나» 되묻는 자리.
 * 🔴 「넘침 0건」은 «안 넘쳤다»와 «못 봤다»가 똑같은 얼굴로 온다. */
const 부풀리기 = `(() => {
  const f = document.querySelector('.fill');
  if (f) f.textContent = new Array(80).join('아주 긴 문장이 이어집니다 ');
  const 쪽 = document.querySelector('.sheet');
  if (쪽) {
    const p = document.createElement('p');
    p.style.cssText = 'font-size:14pt;line-height:2;margin:0';
    p.textContent = new Array(120).join('넘치게 만드는 줄 ');
    쪽.appendChild(p);
  }
})();`;

/* ── 픽스처 ──────────────────────────────────────────────────────────────────
 * 09-05 에 사본 시트에서 제미나이가 만든 가상 학생 「바트엘데네」의 답을 바탕으로 한다.
 * ⚠ 실존 인물이 아니다. 실값은 `--데이터` 로 넣는다. */
function 픽스처(모양) {
  if (모양 === '빈종이') return {};
  if (모양 === '최악') {
    return {
      이름: '바트엘데네 어치르바트마', 상담일: '2026-09-05', 상담자: '유호',
      지금자리: '기초 · TOPIK 2급 143점',
      말한목표: '서울에 있는 대학에서 디자인을 제대로 배우고 싶어요 그리고 취업까지',
      추천반: '평일11A', 요일시간: '평일 · 11:00 시작',
      맞을것: '아침에 집중이 잘된다고 했으니 오전반과 말하기 중심 조가 맞습니다',
      수강조건: '3개월 선납 시 등록비 면제 · 형제 할인 10%',
      다음단계: '9월 12일 금요일 오전 11시 레벨테스트 보러 오기',
      시작Lv: 'Lv2', 목표급수: '3~4', 시즌수: '3',
    };
  }
  return {
    이름: '바트엘데네', 상담일: '2026-09-05', 상담자: '유호',
    지금자리: '기초 · TOPIK 2급',
    말한목표: '서울에서 디자인을 공부하고 싶어요',
    추천반: '평일11A', 요일시간: '평일 11:00',
    맞을것: '아침에 집중이 잘된다 하니 오전반',
    수강조건: '',                       // 사람 몫 — 일부러 비운다
    다음단계: '9월 12일 레벨테스트',
    시작Lv: 'Lv2', 목표급수: '3', 시즌수: '2',
  };
}

/* ── 한 장 만들기 ──────────────────────────────────────────────────────────── */
function 지면(값) {
  if (!fs.existsSync(원고경로)) {
    throw new Error('지면 원고가 없다: ' + 원고경로 + '\n  (이 도구는 지면을 새로 그리지 않는다 — 원고를 채울 뿐이다)');
  }
  const 원고 = fs.readFileSync(원고경로, 'utf8');
  const 자 = 글자수자(원고);
  let html = 꽂기(원고, 값);
  html = 길꽂기(html, 값);
  return { html, 자 };
}

function main() {
  const argv = process.argv.slice(2);
  const 값읽 = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
  const 모양 = argv.includes('--빈종이') ? '빈종이' : argv.includes('--최악') ? '최악' : '평시';
  const 데이터 = 값읽('--데이터', '');
  const 값 = 데이터 ? JSON.parse(fs.readFileSync(path.resolve(데이터), 'utf8')) : 픽스처(모양);

  const { html, 자 } = 지면(값);

  const out = path.resolve(값읽('--out', path.join(ROOT, 'docs', '_ops', '산출', '상담결과_' + (값.이름 || '픽스처') + '.html')));
  const pdf = argv.includes('--pdf') ? out.replace(/\.html$/, '.pdf') : null;

  console.log('상담 결과 종이 — ' + (데이터 ? path.basename(데이터) : '픽스처(' + 모양 + ')'));
  console.log('  지면 = docs/발표물/_src_10_상담결과_요약_A4.html · 채우는 칸 ' + 칸들.length + ' + 길 3');

  /* ① 지면이 스스로 적은 글자 수 자 */
  const 잰자 = Object.keys(자).length;
  console.log('  글자 수 자 ' + 잰자 + '개를 지면에서 읽었다: ' +
    Object.entries(자).map(([k, v]) => k + ' ' + v).join(' · '));

  /* ② 길이·금칙·빈칸 */
  const 넘은것 = 길이검사(값, 자);
  const 걸린것 = 금칙검사(값);
  const 빈것 = 빈칸세기(값);

  if (넘은것.length) {
    console.log('  🔴 글자 수 넘김 ' + 넘은것.length + '건');
    넘은것.forEach((n) => console.log('     · ' + n.칸 + ' — ' + n.길이 + '자 (한도 ' + n.한도 + ') 「' + n.값 + '」'));
  } else console.log('  ✅ 글자 수 넘김 0건');

  if (걸린것.length) {
    console.log('  🔴 인쇄 금지 계약에 걸린 값 ' + 걸린것.length + '건 — 꽂은 값만 셌다');
    걸린것.forEach((g) => console.log('     · 「' + g.낱말 + '」 — ' + g.왜));
  } else console.log('  ✅ 금칙 0건 (꽂은 값 기준 · 지면 틀은 승인된 문장이라 안 센다)');

  console.log('  빈칸: 사람 몫 ' + 빈것.사람몫.length + (빈것.사람몫.length ? ' (' + 빈것.사람몫.join(' · ') + ')' : '') +
    ' · 빠짐 ' + 빈것.빠짐.length + (빈것.빠짐.length ? ' 🔴 (' + 빈것.빠짐.join(' · ') + ')' : ''));

  /* ③ 넘침 실측 */
  if (argv.includes('--실측') || argv.includes('--넘침시험')) {
    const r = 실측(html, null, 측정기);
    const s = r.잰것[0];
    console.log('  실측: ' + s.쪽폭mm + '×' + s.쪽높이mm + 'mm · 남는 여백 ' + s.남는여백mm + 'mm · ' +
      '쪽 넘침 ' + (s.넘침 ? '🔴 있다' : '없다') + ' · 칸 넘침 ' + s.칸넘침 + '개');
    if (argv.includes('--넘침시험')) {
      const r2 = 실측(html, 부풀리기, 측정기);
      const 잡았나 = r2.잰것[0].넘침 || r2.잰것[0].칸넘침 > 0;
      console.log('  넘침시험(일부러 넘치게): ' + (잡았나 ? '✅ 자가 잡았다' : '🔴 자가 눈멀었다 — 이 도구의 초록은 아무것도 보장하지 않는다'));
      if (!잡았나) process.exitCode = 1;
    }
  }

  /* ④ 굽기 */
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const g = 굽기(html, out, pdf);
  console.log('  → ' + path.relative(ROOT, out) + (g.임베드 ? ' (폰트 임베드본)' : ' ⚠ 임베드 실패: ' + g.까닭));
  if (pdf) console.log('  → ' + path.relative(ROOT, pdf));

  if (넘은것.length || 걸린것.length || 빈것.빠짐.length) process.exitCode = 1;
}

if (require.main === module) main();
module.exports = { 칸들, 길칸들, 글자수자, 꽂기, 길꽂기, 길이검사, 금칙검사, 빈칸세기, 픽스처, 지면, 측정기, 부풀리기 };
