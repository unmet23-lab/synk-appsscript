#!/usr/bin/env node
/* 다크팔레트굽기 — 2027 킷의 «밤» 후보 3안을 한 판에 굽는다 (유호 요청 2026-08-20).
 *
 * 왜 있나: 2027 킷(조항 ⓙ)이 라이트 세계만 갈아입혔다. 다크 시맨틱 8칸은 아직 구 무채
 *   (Graphite·Chalk·Ash·Lime)에 물려 있고, 2027 역할 어휘(안내·정답·보상·기념)가 **아예 없다**.
 *   앱은 다크 단일(유호 확정 08-14)이라 이 빈칸은 곧 「앱에 2027 킷이 안 닿았다」는 뜻이다.
 *
 * 🔑 급소 하나 — **다크에 새 실은 필요 없다.** 조항 ⓙ 원리 ①「색이 아니라 램프다」를 반대편에서
 *   읽으면 된다: 라이트는 면=몸통·글자=Deep, **다크는 면=Deep·글자=Soft**. 같은 램프가 두 세계를
 *   모두 산다. ⇒ 정할 것은 실이 아니라 **바탕·잉크 몇 칸**뿐이고, 후보가 갈리는 자리도 거기뿐이다.
 *
 * 왜 스킨을 안 입히나: 색을 나란히 재는 판이라 Loom 을 씌우면 재는 값이 오염된다
 *   (`지면방.js` 제외 갈래 — 자형확인 하네스·로고 대조 시트와 같은 사유).
 *
 * 대비 공식은 여기 사본을 둔다 — WCAG 고정 공식이라 «판정»이 아니다(같은 이유로 `모드대비계측.js`
 *   도 자기 사본을 쓴다). 갈릴 수 있는 것은 문턱·역할표이고 그건 아래 한 곳에만 적는다.
 *
 * 사용법: node tools/다크팔레트굽기.js   → docs/다크팔레트_판정_0820.html
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const 토큰 = require(path.join(ROOT, 'docs', '디자인_토큰.json'));
const 킷 = Object.fromEntries(토큰.색.킷.map((c) => [c.이름, c.hex.toUpperCase()]));
const OUT = process.env.SYNK_다크_OUT || path.join(ROOT, 'docs', '다크팔레트_판정_0820.html');

/* ── 대비 (WCAG 2.x) ─────────────────────────────────────────────────────── */
const srgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const 선형 = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const 광도 = (h) => { const v = srgb(h).map(선형); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const 대비 = (a, b) => {
  const x = 광도(a), y = 광도(b);
  return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100;
};
/* 밝기(CIE L*) — «면이 면 위에 떠 보이나»는 대비비가 아니라 이 눈금으로 잰다.
 * 근거가 실측이다: 옛 카드(Graphite 2)가 바탕에서 ΔL* 8.3 이었고 유호님이 「안 떠 있다」고
 * 지적했다 · 확정된 새 카드(Graphite 3)는 12.7 이다(08-14). 문턱은 그 통과값에서 온다. */
const Lstar = (h) => { const y = 광도(h); return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y; };
const 밝기차 = (a, b) => Math.round(Math.abs(Lstar(a) - Lstar(b)) * 10) / 10;

/* ── 2027 실 = 세 후보가 «공유»한다 (원리 ①의 반대편 읽기) ─────────────────
 * 면은 Deep(그늘), 글자는 Soft(보풀 빛). 여기가 후보 사이에서 안 갈리는 것이 이 트랙의 결론이다. */
const 실 = [
  { 역할: '안내', 면: 킷['Lapis Deep'], 글자: 킷['Lapis Soft'], 몸통: 킷.Lapis, 말: '힌트·길잡이' },
  { 역할: '정답', 면: 킷['Meadow Deep'], 글자: 킷['Meadow Soft'], 몸통: 킷.Meadow, 말: '맞았다·자람' },
  { 역할: '보상', 면: 킷['Butter Deep'], 글자: 킷['Butter Soft'], 몸통: 킷.Butter, 말: '별·포인트' },
  { 역할: '기념', 면: 킷['Pop Deep'], 글자: 킷['Pop Soft'], 몸통: 킷.Pop, 말: '희귀·기념일' },
];

/* ── 후보 셋 — 갈리는 것은 «바탕·잉크»뿐이다 ───────────────────────────── */
const 후보들 = [
  {
    코드: '㉠', 이름: '양모 밤', 한줄: '펠트 세계에 불을 끈 판 — 낮의 글자가 밤의 면이 된다',
    바탕: '#080605', 카드: 킷.Ink, 잉크: 킷.Paper, 보조: 킷.Oat, 보조2: 킷.Stone, 테두리: '#3A2F2A',
    새색: [['바탕 · Ink Deep', '#080605']],
    셈: '킷 이미 있는 색 4 + 새 색 1',
    좋은점: [
      '**펠트 정체성이 밤에도 안 끊긴다** — 카드가 곧 Ink(따뜻한 먹)라 라이트의 글자색이 다크의 면이 된다. 한 벌의 양모를 낮과 밤에서 뒤집어 쓰는 구조.',
      '새로 만드는 색이 **하나**뿐 — 「실은 부품, 램프가 정본」(원리 ②)을 가장 적게 어긴다.',
      '2027 실 넷이 따뜻한 바탕 위에서 전부 채도를 유지한다(차가운 바탕은 노랑·분홍을 탁하게 만든다).',
    ],
    대가: [
      '**「차분하면 싫다」와 가장 가까이 스친다** — 갈색 계열 밤은 아늑한 쪽이라, 유호님이 원하신 트렌디한 쨍함은 실 넷(청금석·메도우·버터·팝)이 전부 져야 한다.',
      '옛 무채 12색은 **전량 퇴역**한다 — 앱(SYNK-talk)의 다크 값을 다시 배선해야 한다(형제 저장소 작업 1건).',
    ],
  },
  {
    코드: '㉡', 이름: '청금석 밤', 한줄: '2027 올해의 색이 밤이 된다 — 검정이 아니라 하늘',
    바탕: '#050812', 카드: '#1A2540', 잉크: 킷.Paper, 보조: 킷['Lapis Soft'], 보조2: '#8A98B6', 테두리: '#2A3A5C',
    새색: [['바탕 · Lapis Night', '#050812'], ['카드 · Lapis Deep 면', '#1A2540'], ['보조잉크2 · 흐린 청금석', '#8A98B6']],
    셈: '킷 이미 있는 색 2 + 새 색 3',
    좋은점: [
      '**2027 올해의 색(청금석)을 세계의 바닥으로 쓴다** — 트렌드 반영이 가장 직접적이고, 구 Navy 시절의 「검정이 아니라 밤」 서사가 그대로 이어진다.',
      '차가운 밤 위에서 코랄이 가장 세게 튄다 — 신호 1점 문법이 제일 잘 산다.',
    ],
    대가: [
      '🔴 **안내(청금석)가 바탕과 같은 계열이라 색상 분리에 실패할 위험** — 이건 추측이 아니라 이 저장소의 선례다: 쿨블루를 성장색 후보로 올렸다가 「Navy 바닥과 같은 파랑이라 색상 분리 실패」로 기각한 기록이 있다(컨셉 정본 §12). 채택하면 안내 역할을 다른 실로 옮겨야 할 수 있다.',
      '새 색 **셋** — 후보 중 킷을 가장 많이 늘린다.',
      '펠트(양모) 재질감과 가장 먼 바탕이다 — 파란 양모는 염색한 티가 난다.',
    ],
  },
  {
    코드: '㉢', 이름: '무채 유지', 한줄: '바닥은 무채로 두고, 색은 실 넷에게만 시킨다',
    바탕: 킷.Graphite, 카드: 킷['Graphite 3'], 잉크: 킷.Chalk, 보조: 킷['Chalk 3'], 보조2: 킷.Ash, 테두리: '#3A3A3A',
    새색: [],
    셈: '새 색 0 — 킷에 이미 있는 무채 그대로',
    좋은점: [
      '**새 색 0개** · 앱 재배선도 0곳 — 오늘 당장 끝난다.',
      '2일 전 유호님이 확정한 중성축(조항 ⓗ)의 취지 그대로다: 바닥을 무채로 비워 **색이 노래하게** 한다. 실 넷이 가장 정확한 색으로 읽힌다.',
      '어느 실을 나중에 갈아끼워도 바닥이 안 흔들린다(원리 ② 「실은 부품」의 가장 순한 판).',
    ],
    대가: [
      '**앱만 2027 킷의 «재질»에서 빠진다** — 문서·인쇄물은 양모 종이 위에 살고 앱은 무채 위에 산다. 한 브랜드가 두 바닥을 갖는다.',
      '「차분하면 싫다」에 가장 정면으로 걸린다 — 무채 바닥은 정의상 차분하다(색은 실이 지지만 면적의 대부분은 바닥이다).',
      '퇴역 대기 12색 중 **무채 9색이 「확정」으로 되살아난다**(초록 3색만 퇴역). 킷은 41색에서 32색으로만 줄어든다.',
    ],
  },
];

/* ── 문턱 — 갈릴 수 있는 판정은 여기 한 곳에만 ───────────────────────────── */
const 본문문턱 = 4.5;   // WCAG AA 본문
const 대형문턱 = 3.0;   // 24px↑ / 18.7px↑bold · 비텍스트 표식
const 들림문턱 = 12.7;  // ΔL* — 유호님이 확정한 카드(Graphite 3)의 실측값. 8.3 은 「안 떠 있다」로 기각된 값이다.

function 재기(c) {
  const 줄 = [];
  const 넣 = (무엇, fg, bg, 문턱, 주) => 줄.push({ 무엇, fg, bg, 값: 대비(fg, bg), 문턱, 주 });
  const 넣밝기 = (무엇, a, b, 주) => 줄.push({ 무엇, fg: a, bg: b, 값: 밝기차(a, b), 문턱: 들림문턱, 주, 눈금: 'ΔL*' });

  넣밝기('카드가 바탕에서 뜨나', c.카드, c.바탕, '면 2단(유호 확정 08-14) · 기각선 8.3');
  넣('본문 잉크 (카드 위)', c.잉크, c.카드, 본문문턱, '읽는 글자 대부분');
  넣('본문 잉크 (바탕 위)', c.잉크, c.바탕, 본문문턱, '');
  넣('보조 잉크', c.보조, c.카드, 본문문턱, '설명·캡션');
  넣('보조 잉크 2', c.보조2, c.카드, 본문문턱, '3층 글자 — 크기 불문 통과가 하한(조항 ⓔ)');
  넣('신호 코랄 13px 글자', 킷.Coral, c.카드, 본문문턱, '답장 화면 오류 태그 — 코랄이 «글자»로 서는 유일한 자리');
  넣('신호 코랄 면', 킷.Coral, c.바탕, 대형문턱, '버튼·막대');
  for (const s of 실) {
    넣(`${s.역할} 글자 (${s.역할}면 위)`, s.글자, s.면, 본문문턱, `칩 안 글자 · ${s.말}`);
    넣밝기(`${s.역할} 면이 바탕에서 뜨나`, s.면, c.바탕, '');
    넣(`${s.역할} 글자 (바탕 위)`, s.글자, c.바탕, 본문문턱, '칩 없이 쓰는 자리');
  }
  return 줄;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const 굵게 = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

function 화면(c) {
  const 칩 = 실.map((s) => `<span class="칩" style="background:${s.면};color:${s.글자};border-color:${s.글자}33">${s.역할}</span>`).join('');
  return `
  <div class="폰" style="background:${c.바탕};border-color:${c.테두리}">
    <div class="폰바" style="color:${c.보조2}">SYNK</div>
    <div class="카드" style="background:${c.카드};border-color:${c.테두리}">
      <div class="제목" style="color:${c.잉크}">오늘의 숙제</div>
      <div class="본문" style="color:${c.잉크}">문장을 소리 내어 읽고 녹음해 보세요.</div>
      <div class="보조" style="color:${c.보조}">3분이면 끝나요 · 어제보다 2문장 늘었어요</div>
      <div class="칩줄">${칩}</div>
      <div class="태그" style="color:${킷.Coral}">✕ 조사가 빠졌어요 — 「학교<u>에</u> 갑니다」</div>
      <div class="메타" style="color:${c.보조2}">v9.253 · 2026-08-20</div>
    </div>
    <div class="버튼" style="background:${킷.Coral};color:${킷.Ink}">녹음 시작</div>
  </div>`;
}

function 표(c) {
  const 줄들 = 재기(c).map((r) => {
    const 통과 = r.값 >= r.문턱;
    const 아슬 = 통과 && r.값 < r.문턱 * 1.15;
    const 표식 = 통과 ? (아슬 ? '🟡' : '✅') : '🔴';
    return `<tr class="${통과 ? '' : '깨짐'}">
      <td>${esc(r.무엇)}${r.주 ? `<span class="주">${esc(r.주)}</span>` : ''}</td>
      <td class="스와치"><i style="background:${r.fg}"></i><i style="background:${r.bg}"></i></td>
      <td class="수"><b>${r.눈금 ? r.값.toFixed(1) : r.값.toFixed(2)}</b> <span class="주">${r.눈금 ? 'ΔL* ' : ''}/ ${r.문턱}</span></td>
      <td>${표식}</td></tr>`;
  }).join('');
  return `<table><thead><tr><th>재는 자리</th><th>색</th><th>대비</th><th></th></tr></thead><tbody>${줄들}</tbody></table>`;
}

function 판정(c) {
  const 줄 = 재기(c);
  const 깨짐 = 줄.filter((r) => r.값 < r.문턱);
  const 아슬 = 줄.filter((r) => r.값 >= r.문턱 && r.값 < r.문턱 * 1.15);
  return { 전체: 줄.length, 깨짐, 아슬 };
}

function build() {
  const 칸 = 후보들.map((c) => {
    const p = 판정(c);
    const 새색 = c.새색.length
      ? c.새색.map(([이름, hex]) => `<span class="새색"><i style="background:${hex}"></i>${esc(이름)} <code>${hex}</code></span>`).join('')
      : '<span class="새색없음">새로 만드는 색 없음</span>';
    return `
    <section class="후보">
      <h2><span class="코드">${c.코드}</span> ${esc(c.이름)}</h2>
      <p class="한줄">${esc(c.한줄)}</p>
      <div class="본체">
        <div class="왼">${화면(c)}</div>
        <div class="오">
          <div class="셈">${esc(c.셈)}</div>
          <div class="새색줄">${새색}</div>
          <div class="판정줄">전체 ${p.전체}칸 — 통과 ${p.전체 - p.깨짐.length} · <b class="${p.깨짐.length ? 'bad' : 'ok'}">깨짐 ${p.깨짐.length}</b> · 아슬 ${p.아슬.length}</div>
          <h3>좋은 점</h3><ul>${c.좋은점.map((t) => `<li>${굵게(t)}</li>`).join('')}</ul>
          <h3>대가</h3><ul>${c.대가.map((t) => `<li>${굵게(t)}</li>`).join('')}</ul>
        </div>
      </div>
      <details><summary>대비 실측 ${p.전체}칸 — 전량 펼쳐 보기</summary>${표(c)}</details>
    </section>`;
  }).join('');

  const 실표 = 실.map((s) => `<tr>
    <td><b>${s.역할}</b><span class="주">${esc(s.말)}</span></td>
    <td class="스와치"><i style="background:${s.면}"></i><code>${s.면}</code> <span class="주">면(Deep)</span></td>
    <td class="스와치"><i style="background:${s.글자}"></i><code>${s.글자}</code> <span class="주">글자(Soft)</span></td>
    <td class="스와치"><i style="background:${s.몸통}"></i><code>${s.몸통}</code> <span class="주">라이트 면(몸통)</span></td></tr>`).join('');

  return `<meta charset="utf-8">
<title>다크 팔레트 판정 — 2027 킷의 밤 (2026-08-20)</title>
<style>
 :root{ --지:#FBF7F0; --먹:#2B2320; --흐림:#8D857A; --선:#E3DCD0; --코랄:#F96859 }
 *{ box-sizing:border-box }
 body{ margin:0; padding:32px 20px 80px; background:var(--지); color:var(--먹);
   font:16px/1.7 "SUIT","Pretendard",system-ui,-apple-system,sans-serif }
 .판{ max-width:1180px; margin:0 auto }
 h1{ font-size:30px; margin:0 0 6px; letter-spacing:-.02em }
 .머리{ color:var(--흐림); margin:0 0 26px; font-size:15px }
 .왜{ border:1px solid var(--선); border-left:4px solid var(--코랄); border-radius:10px;
   padding:16px 20px; margin:0 0 30px; background:#fff8 }
 .왜 b{ color:var(--먹) }
 .왜 ul{ margin:10px 0 0; padding-left:20px } .왜 li{ margin:5px 0 }
 h2{ font-size:23px; margin:0 0 2px; letter-spacing:-.01em }
 .코드{ color:var(--코랄) }
 .한줄{ color:var(--흐림); margin:0 0 16px; font-size:15px }
 .후보{ border:1px solid var(--선); border-radius:14px; padding:22px 24px; margin:0 0 26px; background:#FFFDFA }
 .본체{ display:flex; gap:26px; align-items:flex-start; flex-wrap:wrap }
 .왼{ flex:0 0 300px } .오{ flex:1 1 380px; min-width:320px }
 .오 h3{ font-size:14px; margin:16px 0 6px; color:var(--흐림); font-weight:700;
   text-transform:none; letter-spacing:.02em }
 .오 ul{ margin:0; padding-left:19px } .오 li{ margin:6px 0; font-size:14.5px }
 .셈{ font-size:14px; color:var(--흐림) }
 .새색줄{ display:flex; gap:12px; flex-wrap:wrap; margin:8px 0 10px }
 .새색{ display:inline-flex; align-items:center; gap:6px; font-size:13px; background:#F3EDE3;
   border-radius:20px; padding:4px 12px 4px 5px }
 .새색 i{ width:16px; height:16px; border-radius:50%; display:inline-block; border:1px solid #0002 }
 .새색없음{ font-size:13px; background:#E7F0DE; color:#3F6B2E; border-radius:20px; padding:4px 12px }
 .판정줄{ font-size:14px; padding:8px 0; border-top:1px dashed var(--선) }
 .ok{ color:#3F6B2E } .bad{ color:#AE322A }
 /* ── 폰 목업 ── */
 .폰{ border:1px solid; border-radius:26px; padding:14px 13px 18px; box-shadow:0 8px 26px #2b232014 }
 .폰바{ font-size:11px; letter-spacing:.16em; padding:2px 4px 12px; font-weight:700 }
 .카드{ border:1px solid; border-radius:16px; padding:15px 15px 13px }
 .제목{ font-size:17px; font-weight:800; letter-spacing:-.01em }
 .본문{ font-size:14px; margin:7px 0 0 }
 .보조{ font-size:12.5px; margin:8px 0 0 }
 .칩줄{ display:flex; gap:6px; flex-wrap:wrap; margin:13px 0 0 }
 .칩{ font-size:11px; font-weight:700; border-radius:20px; padding:3px 10px; border:1px solid }
 .태그{ font-size:13px; margin:13px 0 0; font-weight:600 }
 .메타{ font-size:11px; margin:10px 0 0 }
 .버튼{ margin:14px 4px 0; border-radius:14px; text-align:center; padding:11px;
   font-weight:800; font-size:15px }
 /* ── 표 ── */
 details{ margin:16px 0 0; border-top:1px dashed var(--선); padding:12px 0 0 }
 summary{ cursor:pointer; font-size:13.5px; color:var(--흐림) }
 table{ border-collapse:collapse; width:100%; margin:12px 0 0; font-size:13.5px }
 th,td{ text-align:left; padding:7px 9px; border-bottom:1px solid var(--선); vertical-align:middle }
 th{ font-size:12px; color:var(--흐림); font-weight:700 }
 .주{ display:block; font-size:11.5px; color:var(--흐림); font-weight:400 }
 .스와치 i{ width:19px; height:19px; border-radius:5px; display:inline-block;
   border:1px solid #0002; vertical-align:middle; margin-right:3px }
 .수 b{ font-variant-numeric:tabular-nums }
 tr.깨짐{ background:#FEF0E9 }
 code{ font:12px/1 "DM Mono",ui-monospace,monospace; color:var(--흐림) }
 .실판{ border:1px solid var(--선); border-radius:14px; padding:20px 24px; margin:0 0 26px; background:#FFFDFA }
 .끝{ border:1px solid var(--선); border-radius:14px; padding:20px 24px; background:#F7F2E9 }
 .끝 h2{ margin-bottom:10px }
 .끝 ol{ padding-left:20px; margin:10px 0 0 } .끝 li{ margin:8px 0 }
 @media (max-width:820px){ .왼{ flex:1 1 100% } }
</style>
<div class="판">
<h1>다크 팔레트 판정 — 2027 킷의 «밤»</h1>
<p class="머리">2026-08-20 · 유호님 눈 검수용 판정 재료 · 굽기 <code>node tools/다크팔레트굽기.js</code></p>

<div class="왜">
<b>무엇이 비어 있나</b> — 2027 킷(조항 ⓙ)이 <b>라이트 세계만</b> 갈아입혔습니다. 앱은 다크 단일인데(유호님 확정 08-14),
다크 시맨틱 8칸은 아직 구 무채(Graphite·Chalk·Ash·Lime)에 물려 있고 2027 역할 어휘(안내·정답·보상·기념)가 <b>아예 없습니다.</b>
<ul>
<li><b>급소 하나 — 다크에 새 «실»은 필요 없습니다.</b> 원리 ①「색이 아니라 램프다」를 반대편에서 읽으면 됩니다:
라이트는 면=몸통·글자=Deep, <b>다크는 면=Deep·글자=Soft.</b> 같은 램프가 낮과 밤을 모두 삽니다.</li>
<li>그래서 <b>고르실 것은 실이 아니라 «바탕과 잉크» 몇 칸</b>이고, 아래 세 후보가 갈리는 자리도 정확히 거기뿐입니다.</li>
</ul>
</div>

<div class="실판">
<h2>세 후보가 공유하는 것 — 2027 실 넷의 밤 얼굴</h2>
<p class="한줄">어느 후보를 고르셔도 이 표는 그대로입니다. 라이트에서 쓰던 램프를 반대편에서 읽은 것뿐입니다.</p>
<table><tbody>${실표}</tbody></table>
</div>

${칸}

<div class="끝">
<h2>제 권고 — ㉠ 양모 밤</h2>
<ol>
<li><b>펠트가 브랜드의 «재질»이기 때문입니다.</b> 유호님 지시는 「모든 UI·UX를 펠트 재질로」였는데, ㉢을 고르면 문서는 양모 종이 위에·앱은 무채 위에 살아 <b>한 브랜드가 바닥을 둘 갖게 됩니다.</b> ㉠은 카드가 곧 Ink(따뜻한 먹)라 <b>라이트의 글자색이 다크의 면</b>이 됩니다 — 한 벌의 양모를 뒤집어 입는 구조입니다.</li>
<li><b>새로 만드는 색이 하나뿐</b>이라 「실은 부품, 램프가 정본」을 가장 적게 어깁니다.</li>
<li>「차분하면 싫다」는 <b>실 넷이 집니다</b> — 따뜻한 바탕은 노랑·분홍의 채도를 지켜 주고, 차가운 바탕은 그 둘을 탁하게 만듭니다.</li>
</ol>
<p style="margin:14px 0 0"><b>㉡을 고르실 경우</b> 안내(청금석)를 다른 실로 옮기는 후속 판정이 함께 필요합니다 —
바닥과 같은 파랑이라 색상 분리에 실패한 선례가 이 저장소에 있습니다(쿨블루 기각, 컨셉 정본 §12).</p>
<p style="margin:10px 0 0"><b>고르시면</b> 토큰 다크 시맨틱 재배선 + 퇴역 색 삭제 + 앱(SYNK-talk) 테마 반영까지 한 트랙으로 집행합니다.</p>
</div>
</div>
`;
}

if (require.main === module) {
  fs.writeFileSync(OUT, build());
  const 총 = 후보들.map((c) => { const p = 판정(c); return `${c.코드} ${c.이름}: 깨짐 ${p.깨짐.length}/${p.전체} · 아슬 ${p.아슬.length}`; });
  console.log(`[다크팔레트] ${path.relative(ROOT, OUT)} 구움`);
  for (const t of 총) console.log('   ' + t);
}

module.exports = { build, 후보들, 실, 대비, 재기 };
