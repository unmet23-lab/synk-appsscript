// 답 은행 시험(2026-11-01) — 결과 · 두 판 듣기 페이지를 만든다. 숫자와 대사는 결과 파일에서 읽고 손으로 옮기지 않는다.
// 읽는 것: .tmp/답은행시험-20261101/{채점요약.json, 은행길.json, 실시간판.json, 은행판.json, 엮음/*.mp3}
// 내는 것: .tmp/답은행시험-20261101/페이지/{index.html(SUIT 심음), *.mp3} → 아티팩트로 올린다.
// 쓰는 법: node 듣기페이지.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { 녹음줄수 } from './은행.mjs';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 저장소 = path.resolve(여기, '../../../..');
const 작업 = path.join(저장소, '.tmp', '답은행시험-20261101');
const 읽기 = (f) => JSON.parse(fs.readFileSync(path.join(작업, f), 'utf8'));
const 요약 = 읽기('채점요약.json');
const 은행길 = 읽기('은행길.json');
const 실시간 = 읽기('실시간판.json');
const 은행판 = 읽기('은행판.json');
const 판 = 요약.판['gpt-6.1-terra_none'];
if (!판) throw new Error('채점요약에 gpt-6.1-terra_none 판이 없다');

const 퍼 = (n, d) => (d ? (100 * n) / d : 0);
const 퍼글 = (n, d, 자리 = 1) => `${퍼(n, d).toFixed(자리)}%`;
const 글 = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const 주 = 판.정답별.페이블;
const 원 = (usd) => Math.round(usd * 1400);

// ── 값 셈(한 판 = 4분 장면 · 학습자 8차례) — 출처는 페이지 아래 표에 함께 적는다 ──
const 값 = {
  실시간: 4 * 0.05 + 0.003, // GPT-Live 분당 $0.05(README 실측) + 돌아보기 $0.003
  받아적기: 0.0003, // 한 테이크(리허설 실측 20줄 평균)
  terra: 판.차례당USD, // 이번 200줄 실측
  luna: 0.00026, // 이번 확인 3줄 실측(본 실행은 조직 토큰 상한으로 못 돌림)
  돌아보기: 0.003,
};
const 은행판값 = (고르기) => 8 * (값.받아적기 + 고르기) + 값.돌아보기;
const 생성비율 = 퍼(주.생성, 주.n);
const 배수 = (큰, 작은) => Math.round(큰 / 작은);
const 받음통과 = (t) => 퍼(t.맞게받음, t.n) >= 80;
const 엉뚱통과 = (t) => 퍼(t.엉뚱, t.n) <= 5;
const 모든판 = (f) => ['페이블', 'GPT', '엄격', '너그러움'].every((k) => f(판.정답별[k]));
const 범위글 = (칸, 표들 = 판.정답별) => { const v = ['페이블', 'GPT', '엄격', '너그러움'].map((k) => 퍼(표들[k][칸], 표들[k].n)); return `${Math.min(...v).toFixed(1)}~${Math.max(...v).toFixed(1)}%`; };
const 판정글 = 모든판(받음통과) && 모든판(엉뚱통과)
  ? '맞게 받기와 엉뚱한 답 두 기준을 모든 정답 판에서 넘었어요.'
  : `맞게 받기는 ${모든판(받음통과) ? '모든 정답 판에서 기준(80%)을 넘었지만' : '정답 판에 따라 기준(80%)에 못 미쳤고'}(${범위글('맞게받음')}), 엉뚱한 답은 정답 판에 따라 ${범위글('엉뚱')}로 기준(5% 이하)에 걸쳤어요 — 1판은 아직 통과라고 하기 이릅니다.`;
const 문턱 = 판.문턱09;
const 갈린엉뚱 = 판.엉뚱.filter((e) => e.GPT정답.includes(e.묶음)).length;

// ── 기준 대비 여유(편차 점, 고른 눈금 ±) ──
const 판들 = [['페이블', 'Fable 정답'], ['GPT', 'GPT 정답'], ['엄격', '둘 다 맞다고 한 답만'], ['너그러움', '하나라도 맞다고 한 답']];
const 여유행 = [
  { 이름: '맞게 받음', 기준: '80% 이상', 값: (t) => 퍼(t.맞게받음, t.n) - 80, 보임: (t) => 퍼글(t.맞게받음, t.n) },
  { 이름: '엉뚱한 답', 기준: '5% 이하', 값: (t) => 5 - 퍼(t.엉뚱, t.n), 보임: (t) => 퍼글(t.엉뚱, t.n) },
];
// 그래프 문법: SVG를 통째로 줄이면 휴대폰에서 글자가 6px 안팎이 되므로 좁은 판(34rem 아래)에는 너비 360짜리를 따로 그려 하나만 보인다
const 짧은이름 = { 페이블: 'Fable', GPT: 'GPT', 엄격: '엄격', 너그러움: '너그러움' };
function 편차점({ 폭 = 640, 왼 = 210, 좁음 = false } = {}) {
  const 오 = 좁음 ? 40 : 24; const 줄높이 = 34; const 위 = 34;
  const 범위 = 12; // ±12%p
  const x = (v) => 왼 + ((Math.max(-범위, Math.min(범위, v)) + 범위) / (2 * 범위)) * (폭 - 왼 - 오);
  const 줄수 = 여유행.length * (판들.length + 1);
  const 높이 = 위 + 줄수 * 줄높이 + 10;
  let s = `<svg viewBox="0 0 ${폭} ${높이}" role="img" aria-label="기준 대비 여유 — 오른쪽이 기준을 넘긴 쪽" class="편차 ${좁음 ? '좁은판' : '넓은판'}">`;
  for (const v of (좁음 ? [-10, 0, 10] : [-10, -5, 0, 5, 10])) {
    s += `<line x1="${x(v)}" x2="${x(v)}" y1="${위 - 8}" y2="${높이 - 6}" class="${v === 0 ? '기준선' : '눈금선'}"/>`;
    s += `<text x="${x(v)}" y="${위 - 14}" class="눈금글" text-anchor="middle">${v === 0 ? '기준' : `${v > 0 ? '+' : ''}${v}%p`}</text>`;
  }
  let y = 위;
  for (const 행 of 여유행) {
    s += `<text x="0" y="${y + 18}" class="행머리">${행.이름} <tspan class="행기준">기준 ${행.기준}</tspan></text>`;
    y += 줄높이;
    for (const [키, 이름] of 판들) {
      const t = 판.정답별[키]; const v = 행.값(t); const 넘김 = v >= 0;
      const cy = y + 12;
      s += `<text x="${좁음 ? 4 : 14}" y="${cy + 5}" class="판이름">${좁음 ? 짧은이름[키] : 이름}</text>`;
      s += `<line x1="${x(0)}" x2="${x(v)}" y1="${cy}" y2="${cy}" class="${넘김 ? '편차선 넘김' : '편차선 모자람'}"/>`;
      s += `<circle cx="${x(v)}" cy="${cy}" r="5" class="${넘김 ? '점 넘김' : '점 모자람'}"/>`;
      s += `<text x="${x(v) + (넘김 ? 10 : -10)}" y="${cy + 4}" class="점글" text-anchor="${넘김 ? 'start' : 'end'}">${행.보임(t)}</text>`;
      y += 줄높이;
    }
  }
  return `${s}</svg>`;
}

// ── 빗금 막대(0부터 세는 비율) ──
function 막대줄(이름, t, 강조 = false) {
  const 받 = 퍼(t.맞게받음, t.n); const 엉 = 퍼(t.엉뚱, t.n);
  return `<div class="막대줄"><div class="막대이름">${글(이름)} <span class="작게">${t.n}줄</span></div>
    <div class="막대칸"><div class="막대 ${강조 ? '강조' : ''}" style="width:${받.toFixed(1)}%"></div></div>
    <div class="막대값">${받.toFixed(1)}%</div><div class="막대값 엉뚱값">${엉.toFixed(1)}%</div></div>`;
}

// ── 두 판 대사 ──
const 이름표 = (id) => (id ? `<span class="묶음표">${글(id)}</span>` : '');
function 대화표(대) {
  const 차례 = 은행길[대].차례;
  const 실 = 실시간[대].줄; // 0 = 첫인사, i+1 = 학습자 i 뒤
  const 은 = 은행판[대].줄;
  const 줄 = [`<tr><td class="학습자">—</td><td>${글(은행길[대].첫인사)}</td><td>${글(실[0]?.하온)}</td></tr>`];
  차례.forEach((t, i) => {
    const 은말 = t.건너뜀 ? '(대화가 이미 끝남)' : 은[i + 1]?.하온 || t.하온;
    const 표시 = t.판단 === '고름' ? `${이름표(t.묶음)} <span class="작게">확신 ${t.확신}</span>` : `<span class="묶음표 넘김표">${글(t.판단)}</span>`;
    줄.push(`<tr><td class="학습자">${글(t.말)}<div class="작게">받아 적기: ${글(t.받아적기)}</div></td><td>${글(은말)}<div>${표시}</div></td><td>${글(실[i + 1]?.하온)}</td></tr>`);
  });
  return `<div class="표틀"><table class="대사"><thead><tr><th>학습자</th><th>답 은행판 하온</th><th>실시간판 하온</th></tr></thead><tbody>${줄.join('')}</tbody></table></div>`;
}
const 지연 = (줄) => { const a = 줄.map((l) => l.지연ms).filter(Boolean).sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
const 실시간지연 = 지연([...실시간.A.줄, ...실시간.B.줄]);
const 은행지연 = (() => { const a = Object.values(은행길).flatMap((d) => d.차례.filter((t) => t.받아적기ms).map((t) => t.받아적기ms + t.고르기ms)).sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; })();

const 엉뚱목록 = 판.엉뚱.map((e) => `<li><div class="엉뚱말">「${글(e.학습자말)}」</div>
  <div class="작게">받아 적기(${글(e.오류정도)}): ${글(e.받아적기)}</div>
  <div>고른 답 ${이름표(e.묶음)} → 「${글(e.답)}」</div>
  <div class="작게">Fable이 맞다고 본 묶음: ${글(e.정답.join(', ') || '없음 — 새로 만들어야 함')} · GPT: ${글(e.GPT정답.join(', ') || '없음 — 새로 만들어야 함')}</div></li>`).join('');

const 순간이름 = { 처음: '이름 묻기', 나라: '나라 묻기', 좋아함: '좋아하는 노래', 사인: '뭐 해 줄까요', 끝: '사인 끝', 작별뒤: '작별 뒤' };
const 녹음줄 = 녹음줄수(); // 순간 답 · 되묻기 · 한국어로 · 공통 머리 · 꼬리(문장 경계에서 이어 붙임)

const html = `<title>하온 답 은행 시험</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* 실험 노트: 판정 한 줄 → 기준 대비 → 귀로 듣기 → 약한 곳 → 고칠 것 → 잰 방법. 바탕은 종이 흰색 · 검정, 사업 색은 코랄 하나. */
:root{
  --bg:#FFFFFF;--fg:#171412;--muted:#6E6661;--line:#E7E1DC;--soft:#F6F2EF;
  --accent:#F96859;--accent-text:#AE322A;--grey-mark:#A39B95;
  --font:'SUIT Variable','Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;
  --mono:ui-monospace,'Cascadia Mono',Consolas,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#0B0A0A;--fg:#F3EFEC;--muted:#A79F99;--line:#2B2624;--soft:#171413;--accent:#F96859;--accent-text:#FF9C90;--grey-mark:#7C746F;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0B0A0A;--fg:#F3EFEC;--muted:#A79F99;--line:#2B2624;--soft:#171413;--accent:#F96859;--accent-text:#FF9C90;--grey-mark:#7C746F;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font-family:var(--font);font-size:16px;line-height:1.65;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:40px 64px}
main{max-width:58rem;margin:0 auto;display:grid;gap:56px}
h1,h2,h3{text-wrap:balance;line-height:1.3;margin:0}
h1{font-size:clamp(28px,4.4vw,40px);font-weight:800;letter-spacing:-.02em}
h2{font-size:22px;font-weight:750;letter-spacing:-.01em}
h3{font-size:17px;font-weight:700}
p{margin:0;max-width:65ch}
.머리{display:grid;gap:14px}
.작은머리{font-size:13px;letter-spacing:.06em;color:var(--muted);font-weight:600}
.판정{font-size:18px;max-width:62ch}
.판정 b{color:var(--accent-text)}
.숫자들{display:grid;grid-template-columns:repeat(auto-fit,minmax(12.5rem,1fr));gap:0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.숫자{padding:16px 16px 16px 0;display:grid;gap:4px;min-width:0}
.숫자+.숫자{padding-left:16px;border-left:1px solid var(--line)}
.숫자 .큰{font-size:28px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.숫자 .큰 small{font-size:15px;font-weight:600;color:var(--muted)}
.숫자 .설명{font-size:13px;color:var(--muted)}
.통과{color:var(--accent-text);font-weight:700}
.모자람{color:var(--muted);font-weight:700}
section{display:grid;gap:16px}
.작게{font-size:13px;color:var(--muted)}
svg.편차{width:100%;height:auto;max-width:44rem}
svg.좁은판,.좁은판만{display:none}
@media (max-width:34rem){svg.넓은판{display:none}svg.좁은판{display:block;max-width:360px}.좁은판만{display:block}}
svg.편차 text{font-family:var(--font);fill:var(--fg)}
.눈금글{font-size:11px;fill:var(--muted)!important}
.눈금선{stroke:var(--line);stroke-width:1}
.기준선{stroke:var(--muted);stroke-width:1.2;stroke-dasharray:4 4}
.행머리{font-size:14px;font-weight:700}
.행기준{font-weight:500;fill:var(--muted)!important}
.판이름{font-size:12.5px;fill:var(--muted)!important}
.편차선{stroke-width:2}
.편차선.넘김{stroke:var(--accent)}
.편차선.모자람{stroke:var(--grey-mark)}
.점.넘김{fill:var(--accent)}
.점.모자람{fill:var(--bg);stroke:var(--grey-mark);stroke-width:2}
.점글{font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums}
.들기{display:grid;grid-template-columns:repeat(auto-fit,minmax(17rem,1fr));gap:20px}
.들기 figure{margin:0;display:grid;gap:8px;min-width:0}
.들기 figcaption{font-weight:700}
.들기 figcaption span{font-weight:500;color:var(--muted);font-size:13px}
audio{width:100%}
.표틀{overflow-x:auto;border:1px solid var(--line);border-radius:6px}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid var(--line)}
th{font-size:12.5px;color:var(--muted);font-weight:650;background:var(--soft)}
tr:last-child td{border-bottom:0}
table.대사{min-width:44rem}
td.학습자{width:30%}
.묶음표{display:inline-block;font-family:var(--mono);font-size:11.5px;color:var(--accent-text);border:1px solid var(--line);border-radius:4px;padding:0 5px;margin-top:4px}
.넘김표{color:var(--muted)}
.관찰{display:grid;gap:6px;padding-left:18px;margin:0}
.관찰 li::marker{color:var(--accent)}
.막대표{display:grid;gap:10px}
.막대줄{display:grid;grid-template-columns:minmax(7rem,12rem) 1fr 4rem 4rem;gap:10px;align-items:center}
.막대머리{font-size:12.5px;color:var(--muted)}
.막대칸{height:14px;position:relative}
.막대{height:100%;background:repeating-linear-gradient(135deg,var(--grey-mark) 0 1.2px,transparent 1.2px 5px);border-right:2px solid var(--fg)}
.막대.강조{background:repeating-linear-gradient(135deg,var(--accent) 0 1.2px,transparent 1.2px 5px);border-right-color:var(--accent-text)}
.막대값{font-variant-numeric:tabular-nums;font-size:14px;text-align:right}
.엉뚱값{color:var(--muted)}
.엉뚱들{display:grid;gap:14px;padding-left:18px;margin:0}
.엉뚱말{font-weight:650}
.고칠것{display:grid;gap:10px;padding-left:20px;margin:0}
.값표 td:nth-child(2),.값표 th:nth-child(2){text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
@media (max-width:30rem){.막대줄{grid-template-columns:1fr 3.4rem 3.4rem}.막대칸{grid-column:1/-1;order:2}.숫자+.숫자{padding-left:0;border-left:0;border-top:1px solid var(--line)}}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style>
<main>
<header class="머리">
  <div class="작은머리">실시간 음성 상황극 · 하온 팬사인회 · 2026년 11월 1일</div>
  <h1>미리 써 둔 답으로 하온이 받아칠 수 있을까</h1>
  <p class="판정">미리 써 둔 하온 답 ${녹음줄}줄로 가짜 학습자 말 200줄을 받아 봤어요. ${판정글} <b>평범한 답은 ${퍼글(판.평범.맞게받음, 판.평범.n, 0)}를 맞게 받았고(엉뚱 ${퍼글(판.평범.엉뚱, 판.평범.n)}), 약한 곳은 예외인 말(${퍼글(판.그밖.맞게받음, 판.그밖.n, 0)} · 엉뚱 ${퍼글(판.그밖.엉뚱, 판.그밖.n)})</b>이에요. 한 판 값은 실시간 엔진의 약 ${배수(값.실시간, 은행판값(값.terra))}분의 1(고르기를 가장 싼 모델로 하면 ${배수(값.실시간, 은행판값(값.luna))}분의 1)이에요. 대신 지금 만든 길은 답이 나오기까지 ${(은행지연 / 1000).toFixed(1)}초가 걸려 실시간 엔진(${(실시간지연 / 1000).toFixed(1)}초)보다 느려요. 이건 고쳐야 해요.</p>
  <div class="숫자들">
    <div class="숫자"><div class="작게">맞게 받음 · 기준 80% 이상</div><div class="큰">${퍼글(주.맞게받음, 주.n)}</div><div class="설명"><span class="${모든판(받음통과) ? '통과' : '모자람'}">${모든판(받음통과) ? '모든 정답 판 통과' : '어느 판은 모자람'}</span> · 판마다 ${범위글('맞게받음')}</div></div>
    <div class="숫자"><div class="작게">엉뚱한 답 · 기준 5% 이하</div><div class="큰">${퍼글(주.엉뚱, 주.n)}</div><div class="설명"><span class="${모든판(엉뚱통과) ? '통과' : '모자람'}">${모든판(엉뚱통과) ? '모든 정답 판 통과' : `${판들.filter(([k]) => !엉뚱통과(판.정답별[k])).map(([, 이름]) => `「${이름}」`).join(' · ')} 판에서 넘음`}</span> · 판마다 ${범위글('엉뚱')}</div></div>
    <div class="숫자"><div class="작게">4분 한 판 값</div><div class="큰">${원(은행판값(값.terra))}<small>원</small></div><div class="설명">실시간 ${원(값.실시간)}원 · 싼 고르기 모델이면 ${원(은행판값(값.luna))}원</div></div>
    <div class="숫자"><div class="작게">답까지 걸린 시간(중앙)</div><div class="큰">${(은행지연 / 1000).toFixed(1)}<small>초</small></div><div class="설명">실시간 ${(실시간지연 / 1000).toFixed(1)}초 · 고칠 것</div></div>
  </div>
</header>

<section>
  <h2>기준을 얼마나 넘겼나</h2>
  <p>정답은 두 검수자(Fable · GPT)가 따로 매겼어요. 「은행에 맞는 답이 있다/없다」는 둘이 열에 아홉 같았지만, 어느 답이 자연스러운지는 줄마다 갈리기도 해서 네 가지 판으로 셌어요. 오른쪽이 기준을 넘긴 쪽이에요.</p>
  ${편차점()}
  ${편차점({ 폭: 360, 왼: 96, 좁음: true })}
  <p class="작게 좁은판만">Fable · GPT = 각 검수자 정답 · 엄격 = 둘 다 맞다고 한 답만 · 너그러움 = 하나라도 맞다고 한 답</p>
  <p>확신이 0.9보다 낮은 고름을 되묻기로 돌리면 엉뚱한 답이 ${범위글('엉뚱', 문턱)}로 줄고(Fable 판 ${퍼글(문턱.페이블.엉뚱, 문턱.페이블.n)}), 맞게 받기는 ${범위글('맞게받음', 문턱)}가 돼요. 네 판 가운데 ${['페이블', 'GPT', '엄격', '너그러움'].filter((k) => 받음통과(문턱[k]) && 엉뚱통과(문턱[k])).length}판에서 두 기준을 함께 넘어요.</p>
  <p class="작게">은행에 자연스러운 답이 있는 말은 ${퍼글(주.은행품, 주.n, 0)}(GPT ${퍼글(판.정답별.GPT.은행품, 판.정답별.GPT.n, 0)})였고, 나머지 ${생성비율.toFixed(0)}% 안팎은 새로 만들어야 하는 말이라 실시간 생성으로 넘겼어요. 시험 말의 ${퍼글(판.그밖.n, 판.그밖.n + 판.평범.n, 0)}가 예외(여러 가지를 한꺼번에, 엉뚱한 질문, 다른 언어 등)인 어려운 시험이에요.</p>
</section>

<section>
  <h2>두 판을 들어 보세요</h2>
  <p>같은 학습자 소리를 넣고, 두 판 모두 같은 목소리(Kore)로 녹음해 내용만 비교되게 했어요. 차례 사이는 똑같이 0.45초로 맞췄어요(답 은행판의 실제 기다림은 위의 ${(은행지연 / 1000).toFixed(1)}초).</p>
  <h3>평범한 판</h3>
  <div class="들기">
    <figure><figcaption>답 은행판 <span>받아 적기 → 고르기 → 미리 써 둔 답</span></figcaption><audio controls preload="none" src="은행_A.mp3"></audio></figure>
    <figure><figcaption>실시간판 <span>Gemini 3.8 Live가 매번 새로 말함</span></figcaption><audio controls preload="none" src="실시간_A.mp3"></audio></figure>
  </div>
  ${대화표('A')}
  <h3>까다로운 판</h3>
  <div class="들기">
    <figure><figcaption>답 은행판</figcaption><audio controls preload="none" src="은행_B.mp3"></audio></figure>
    <figure><figcaption>실시간판</figcaption><audio controls preload="none" src="실시간_B.mp3"></audio></figure>
  </div>
  ${대화표('B')}
  <ul class="관찰">
    <li>실시간판은 학습자 이름을 불러 줘요(「볼로르 씨」). 답 은행판은 미리 녹음이라 이름을 못 불러요.</li>
    <li>실시간판은 두 판 모두 같은 작별 인사를 두 번 되풀이했고, 까다로운 판에서는 「투야 씨, 이름이 뭐였죠?」처럼 이미 들은 이름을 다시 물었어요.</li>
    <li>답 은행판은 받아 적기가 「볼로르 → 폴로르」, 「하온 → 하원」으로 틀렸는데도 맞는 답을 골랐어요. 「사랑해요! 콘서트 꼭 갈게요」에는 응원 쪽 답(「힘낼게요」)만 나가서 「저도요」를 놓쳤어요.</li>
  </ul>
</section>

<section>
  <h2>어디서 잘 되고 어디서 약한가</h2>
  <p class="작게">막대는 맞게 받은 비율, 오른쪽 끝 회색 숫자는 엉뚱한 답 비율이에요(Fable 정답 기준).</p>
  <div class="막대표">
    <div class="막대줄 막대머리"><div></div><div></div><div class="막대값">맞게</div><div class="막대값">엉뚱</div></div>
    ${막대줄('평범한 답', 판.평범, true)}
    ${막대줄('예외인 말', 판.그밖)}
    ${막대줄('받아 적기 오류 없음', 판.오류별.없음)}
    ${막대줄('받아 적기 가벼운 오류', 판.오류별.가벼움)}
    ${막대줄('받아 적기 심한 오류', 판.오류별.심함)}
    ${Object.entries(판.순간별).filter(([, t]) => t.n).map(([s, t]) => 막대줄(`순간: ${순간이름[s]}`, t)).join('\n    ')}
  </div>
  <h3>엉뚱하게 고른 줄 ${판.엉뚱.length}개</h3>
  <ol class="엉뚱들">${엉뚱목록}</ol>
  <p class="작게">${판.엉뚱.length}개 가운데 ${갈린엉뚱}개는 GPT가 자연스럽다고 본 줄이에요(두 검수자 판단이 갈림). 둘 다 틀렸다고 본 줄은 공통 묶음이 이미 들은 질문을 다시 묻는 짜임, 「네」 · 「우와」 같은 짧은 대답에 맞지 않는 맞장구, 받아 적기가 크게 틀린 말에서 나왔어요.</p>
</section>

<section>
  <h2>은행 2판에서 고칠 것</h2>
  <ol class="고칠것">
    <li><b>공통 묶음의 꼬리.</b> 칭찬 · 긴장 같은 공통 답은 끝에 「그 순간의 질문」을 붙이는데, 학습자가 이미 답하면서 덧붙인 말이면 같은 질문을 또 묻게 돼요. 이미 답한 순간이면 다음 질문을 붙여요.</li>
    <li><b>섞인 부탁.</b> 이름이나 노래를 말하면서 사인 · 셀카 · 손 잡기를 함께 부탁하는 말에 맞는 묶음이 없어요. 부탁 묶음을 모든 순간에 둬요.</li>
    <li><b>끝 · 작별 순간.</b> 가장 약했어요. 「네」 · 「우와」 같은 짧은 대답에 맞는 짧은 받음, 「몽골에 언제 와요?」 같은 일정 질문, 「이름 안 썼어요」 같은 사인 고치기, 마지막 손하트 부탁을 받는 묶음을 더해요.</li>
    <li><b>나라 순간.</b> 한국에 사는 학습자, 「몽골 가 봤어요?」 같은 되물음을 받는 묶음을 더해요.</li>
    <li><b>확신 문턱.</b> 확신 0.9 아래는 되묻기로 돌려요. 받아 적기가 크게 틀린 말에서 엉뚱한 답이 가장 많이 나왔어요(${퍼글(판.오류별.심함.엉뚱, 판.오류별.심함.n)}).</li>
    <li><b>속도.</b> 받아 적기를 말하는 동안 흘려 받고, 고르기는 빠른 짝 맞추기로 먼저 해서 확신이 낮을 때만 AI를 불러요. 그사이 「음~ 아, 진짜요?」 같은 맞장구 소리를 바로 틀어요. 고친 뒤 다시 재요.</li>
    <li><b>이름 부르기.</b> 「○○ 씨」 한 마디만 같은 목소리로 그 자리에서 만들어 붙일지, 이름 없이 갈지 들어 보고 정해요.</li>
  </ol>
</section>

<section>
  <h2>값과 속도</h2>
  <div class="표틀"><table class="값표"><thead><tr><th>4분 한 판(학습자 8차례)</th><th>값</th><th>셈</th></tr></thead><tbody>
    <tr><td>실시간 GPT-Live</td><td>${원(값.실시간)}원</td><td class="작게">분당 $0.05(시제품 실측) + 돌아보기 $0.003</td></tr>
    <tr><td>답 은행 · 고르기 GPT-6.1 Terra</td><td>${원(은행판값(값.terra))}원</td><td class="작게">차례마다 받아 적기 $0.0003(리허설 실측) + 고르기 $${값.terra.toFixed(4)}(이번 200줄 실측) + 돌아보기</td></tr>
    <tr><td>답 은행 · 고르기 GPT-6 Luna</td><td>${원(은행판값(값.luna))}원</td><td class="작게">고르기 $0.00026(이번 확인 3줄). 본 실행은 그 조직의 Luna 토큰 상한에 닿아 못 돌렸어요</td></tr>
  </tbody></table></div>
  <p class="작게">값은 1달러 1,400원(BM 문서의 계산용 환율). 답 은행판의 약 ${생성비율.toFixed(0)}%는 실시간 생성으로 넘어가 그만큼 값이 더 들어요(생성 줄의 목소리 값은 아직 안 쟀어요). 속도는 실시간판 첫 소리 중앙 ${(실시간지연 / 1000).toFixed(2)}초, 답 은행판은 받아 적기 + 고르기 중앙 ${(은행지연 / 1000).toFixed(2)}초(Terra 고르기만 중앙 ${(판.ms.중앙 / 1000).toFixed(1)}초)예요.</p>
</section>

<section>
  <h2>어떻게 쟀나</h2>
  <ul class="관찰">
    <li>답 은행(순간 묶음 37 · 공통 묶음 10)은 Claude가 학습자 말을 보기 전에 확정했어요(파일 지문을 남김).</li>
    <li>가짜 학습자 말 200줄과 받아 적기 오류(없음 · 가벼움 · 심함 = 대략 55 · 30 · 15)는 Gemini 3.8 Flash가 은행을 보지 않고 만들었어요.</li>
    <li>정답은 학습자가 「하려던 말」에 자연스럽게 이어지는 묶음을 모두 고른 것이고, Fable과 GPT가 같은 기준으로 따로 매겼어요. 고르기는 받아 적은 글만 봤어요.</li>
    <li>한계: 학습자 말과 받아 적기 오류는 지어낸 것이라 실제 몽골 학습자에게서는 더 나쁘게 나올 수 있어요. 한 차례씩 쟀고, 대화가 길게 이어질 때의 흐름은 들어 보기 두 판으로만 봤어요.</li>
  </ul>
  <p class="작게">자료와 스크립트: 저장소 experiences/realtime-roleplay/qa/답은행시험-20261101/</p>
</section>
</main>
`;

const 폴더 = path.join(작업, '페이지');
fs.mkdirSync(폴더, { recursive: true });
const { 심기 } = require(path.join(저장소, 'tools/lib/브랜드폰트.js'));
const 심음 = 심기(html);
fs.writeFileSync(path.join(폴더, 'index.html'), 심음.html);
for (const f of ['은행_A.mp3', '은행_B.mp3', '실시간_A.mp3', '실시간_B.mp3']) fs.copyFileSync(path.join(작업, '엮음', f), path.join(폴더, f));
console.log(`페이지 → ${path.join(폴더, 'index.html')} (${Math.round(심음.html.length / 1024)}KB, 글꼴 ${심음.자리})`);
