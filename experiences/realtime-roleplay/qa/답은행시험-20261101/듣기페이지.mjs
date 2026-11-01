// 답 은행 시험(2026-11-01) — 결과 · 들어 보기 페이지. 2판 시험 뒤 판: 1판 · 2판을 같은 잣대(블라인드)로 견주고, 세 판을 나란히 듣는다.
// 숫자와 대사는 결과 파일에서 읽고 손으로 옮기지 않는다.
// 읽는 것: .tmp/답은행시험-20261101/{판정2요약.json, 채점요약.json, 은행길.json, 은행2길.json, 실시간판.json, 엮음/*.mp3}
//          · 이 폴더의 고르기2_B_AI.jsonl · 고르기B_gpt-6.1-terra_none.jsonl(차례당 값 · 시간) · 빠른길.mjs
// 내는 것: .tmp/답은행시험-20261101/페이지/{index.html(SUIT 심음), *.mp3} → 아티팩트로 올린다(같은 주소).
// 쓰는 법: node 듣기페이지.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { 녹음줄수 as 녹음줄수1 } from './은행.mjs';
import { 녹음줄수 as 녹음줄수2, 반응들 } from './은행2.mjs';
import { X는2판 } from './판정2.mjs';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 저장소 = path.resolve(여기, '../../../..');
const 작업 = path.join(저장소, '.tmp', '답은행시험-20261101');
const 읽기 = (f) => JSON.parse(fs.readFileSync(path.join(작업, f), 'utf8'));
const jsonl = (f) => fs.readFileSync(path.join(여기, f), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const 판정 = 읽기('판정2요약.json');
const 처음요약 = 읽기('채점요약.json').판['gpt-6.1-terra_none'];
const 은행길 = 읽기('은행길.json');
const 은행2길 = 읽기('은행2길.json');
const 실시간 = 읽기('실시간판.json');
const 고2B = jsonl('고르기2_B_AI.jsonl');
const 고1B = jsonl('고르기B_gpt-6.1-terra_none.jsonl');
const 빠른길 = (await import(pathToFileURL(path.join(여기, '빠른길.mjs')).href)).default;

const 퍼 = (n, d) => (d ? (100 * n) / d : 0);
const 퍼글 = (n, d, 자리 = 1) => `${퍼(n, d).toFixed(자리)}%`;
const 글 = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const 원 = (usd) => Math.round(usd * 1400);
const 중앙 = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const 위10 = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b[Math.floor(b.length * 0.9)]; };
const 검판들 = ['페이블', 'GPT', '엄격', '너그러움'];
const 검이름 = { 페이블: 'Fable', GPT: 'GPT', 엄격: '둘 다 자연일 때만', 너그러움: '하나라도 자연이면' };
const t = (판, 판본, 검판 = '페이블') => 판정.판[판].판본[판본].전체[검판];
const 받률 = (c) => 퍼(c.맞게받음, c.n);
const 엉률 = (c) => 퍼(c.엉뚱, c.n);
const 범위 = (판, 판본, f) => { const v = 검판들.map((k) => f(t(판, 판본, k))); return [Math.min(...v), Math.max(...v)]; };
const 통과 = (판, 판본) => 검판들.filter((k) => 받률(t(판, 판본, k)) >= 80 && 엉률(t(판, 판본, k)) <= 5);

// ── 값과 속도 ──
const 평균 = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const 값 = {
  실시간: 4 * 0.05 + 0.003, // GPT-Live 분당 $0.05(시제품 README 실측) + 돌아보기
  받아적기: 0.0003, // 드라마 리허설 실측 한 테이크
  고르기1: 평균(고1B.filter((r) => !r.오류).map((r) => r.USD || 0)),
  고르기2: 평균(고2B.filter((r) => !r.오류).map((r) => r.USD || 0)),
  돌아보기: 0.003,
};
const 한판 = (고르기) => 8 * (값.받아적기 + 고르기) + 값.돌아보기;
const 생성률 = (줄) => 퍼(줄.filter((r) => r.판단 === '생성').length, 줄.length);
const 실시간지연 = 중앙([...실시간.A.줄, ...실시간.B.줄].map((l) => l.지연ms));
const 차례2 = Object.values(은행2길).flatMap((d) => d.차례.filter((x) => x.받아적기ms));
const 받아적기ms = 중앙(차례2.map((x) => x.받아적기ms));
const 고르기ms2 = 중앙(고2B.map((r) => r.ms));
const 고르기ms2위 = 위10(고2B.map((r) => r.ms));
const 은행2지연 = 중앙(차례2.map((x) => x.받아적기ms + x.고르기ms));

// ── 편차 점: 기준 대비 여유(고른 눈금 ±), 점 = Fable · 옅은 줄 = 네 정답 판의 범위 ──
const 행들 = [['B', 2, '2판 · 나판'], ['B', 1, '1판 · 나판'], ['A', 2, '2판 · 가판'], ['A', 1, '1판 · 가판']];
const 지표 = [
  { 이름: '맞게 받음', 기준: '80% 이상', 여유: (c) => 받률(c) - 80, 보임: (c) => `${받률(c).toFixed(1)}%` },
  { 이름: '엉뚱한 답', 기준: '5% 이하', 여유: (c) => 5 - 엉률(c), 보임: (c) => `${엉률(c).toFixed(1)}%` },
];
function 편차점({ 폭 = 640, 왼 = 150, 좁음 = false } = {}) {
  const 오 = 좁음 ? 46 : 70; const 줄높이 = 32; const 위 = 34; const 범 = 15;
  const x = (v) => 왼 + ((Math.max(-범, Math.min(범, v)) + 범) / (2 * 범)) * (폭 - 왼 - 오);
  const 높이 = 위 + 지표.length * (행들.length + 1) * 줄높이 + 8;
  let s = `<svg viewBox="0 0 ${폭} ${높이}" role="img" aria-label="기준 대비 여유 — 오른쪽이 기준을 넘긴 쪽. 점은 Fable 판정, 옅은 줄은 네 정답 판의 범위" class="편차 ${좁음 ? '좁은판' : '넓은판'}">`;
  for (const v of 좁음 ? [-10, 0, 10] : [-15, -10, -5, 0, 5, 10, 15]) {
    s += `<line x1="${x(v)}" x2="${x(v)}" y1="${위 - 8}" y2="${높이 - 4}" class="${v === 0 ? '기준선' : '눈금선'}"/>`;
    s += `<text x="${x(v)}" y="${위 - 14}" class="눈금글" text-anchor="middle">${v === 0 ? '기준' : `${v > 0 ? '+' : ''}${v}%p`}</text>`;
  }
  let y = 위;
  for (const g of 지표) {
    s += `<text x="0" y="${y + 18}" class="행머리">${g.이름} <tspan class="행기준">기준 ${g.기준}</tspan></text>`;
    y += 줄높이;
    for (const [판, 판본, 이름] of 행들) {
      const c = t(판, 판본); const v = g.여유(c); const 넘 = v >= 0; const cy = y + 12;
      const vs = 검판들.map((k) => g.여유(t(판, 판본, k)));
      s += `<text x="${좁음 ? 2 : 10}" y="${cy + 5}" class="판이름${판본 === 2 ? ' 굵게' : ''}">${이름}</text>`;
      s += `<line x1="${x(Math.min(...vs))}" x2="${x(Math.max(...vs))}" y1="${cy}" y2="${cy}" class="범위선"/>`;
      s += `<line x1="${x(0)}" x2="${x(v)}" y1="${cy}" y2="${cy}" class="편차선 ${넘 ? '넘김' : '모자람'}"/>`;
      s += `<circle cx="${x(v)}" cy="${cy}" r="5" class="점 ${넘 ? '넘김' : '모자람'}"/>`;
      s += `<text x="${x(Math.max(...vs)) + 8}" y="${cy + 4}" class="점글">${g.보임(c)}</text>`;
      y += 줄높이;
    }
  }
  return `${s}</svg>`;
}

// ── 빗금 막대: 2판 나판의 약한 곳 ──
function 막대줄(이름, c, 강조 = false) {
  return `<div class="막대줄"><div class="막대이름">${글(이름)} <span class="작게">${c.n}줄</span></div>
    <div class="막대칸"><div class="막대 ${강조 ? '강조' : ''}" style="width:${받률(c).toFixed(1)}%"></div></div>
    <div class="막대값">${받률(c).toFixed(1)}%</div><div class="막대값 엉뚱값">${엉률(c).toFixed(1)}%</div></div>`;
}
const B2 = 판정.판.B.판본[2]; const B1 = 판정.판.B.판본[1];
const 순간이름 = { 처음: '이름 묻기', 나라: '나라 묻기', 좋아함: '좋아하는 노래', 사인: '뭐 해 줄까요', 끝: '사인 끝', 작별뒤: '작별 뒤' };

// ── 세 판 대사 ──
function 대화표(대) {
  const 일 = 은행길[대].차례; const 이 = 은행2길[대].차례; const 실 = 실시간[대].줄;
  const 줄 = [`<tr><td class="학습자">—</td><td colspan="2">${글(은행길[대].첫인사)}</td><td>${글(실[0]?.하온)}</td></tr>`];
  일.forEach((a, i) => {
    const b = 이[i];
    const 표1 = a.판단 === '고름' ? `<span class="묶음표">${글(a.묶음)}</span>` : `<span class="묶음표 넘김표">${글(a.판단)}</span>`;
    const 표2 = b?.판단 === '고름' ? (b.반응 || []).map((r) => `<span class="묶음표">${글(r)}</span>`).join(' ') : `<span class="묶음표 넘김표">${글(b?.판단)}</span>`;
    줄.push(`<tr><td class="학습자">${글(a.말)}<div class="작게">받아 적기: ${글(a.받아적기)}</div></td><td>${글(a.하온)}<div>${표1}</div></td><td>${글(b?.하온)}<div>${표2}</div></td><td>${글(실[i + 1]?.하온)}</td></tr>`);
  });
  return `<div class="표틀"><table class="대사"><thead><tr><th>학습자</th><th>1판 하온</th><th>2판 하온</th><th>실시간 하온</th></tr></thead><tbody>${줄.join('')}</tbody></table></div>`;
}

const 엉뚱2 = 판정.판.B.엉뚱2.filter((e) => e.F === '어색' || e.G === '어색');
const 둘다 = 엉뚱2.filter((e) => e.F === '어색' && e.G === '어색');
// 검수자 메모의 X · Y를 읽는 사람이 알 수 있게 1판 · 2판으로 바꿔 보인다(블라인드는 판정 때만)
const 판이름바꿈 = (id, s) => { const 둘X = X는2판(id); return String(s || '').replace(/\bX\b/g, 둘X ? '2판' : '1판').replace(/\bY\b/g, 둘X ? '1판' : '2판'); };
const 엉목록 = 엉뚱2.slice(0, 12).map((e) => `<li><div class="엉뚱말">「${글(e.학습자말)}」</div>
  <div class="작게">받아 적기(${글(e.오류정도)}): ${글(e.받아적기)}</div>
  <div>2판 답 → 「${글(e.답)}」</div>
  <div class="작게">Fable ${글(e.F)} · GPT ${글(e.G)}${e.메모F ? ` — Fable 메모: ${글(판이름바꿈(e.id, e.메모F))}` : ''}</div></li>`).join('');

// 2판 엉뚱이 어디서 났나 — 사인 순간의 「부탁한 것도 같이 써 줄게요」(그냥 사인 부탁에도 나감)와 말 겹침
const 겹침 = (s) => (s.match(/고마워요/g) || []).length >= 2 || /안녕~ 안녕~|헤헤.*헤헤|그럼요!.*그럼요!|짠! 짠!/.test(s);
const 원인 = Object.fromEntries(['A', 'B'].map((판) => {
  const 검 = (k) => new Map(jsonl(`판정2_${판}_${k}.jsonl`).map((r) => [r.id, r]));
  const f = 검('페이블'); const g = 검('GPT');
  const 줄 = jsonl(`고르기2_${판}_AI.jsonl`);
  const 셈 = (m) => { const o = { 엉뚱: 0, 한줄: 0, 겹침: 0 }; for (const r of 줄) { const v = X는2판(r.id) ? m.get(r.id).X : m.get(r.id).Y; if (v !== '어색') continue; o.엉뚱++; if ((r.글 || '').includes('부탁한 것도')) o.한줄++; else if (겹침(r.글 || '')) o.겹침++; } return o; };
  return [판, { F: 셈(f), G: 셈(g) }];
}));
const 놓침범위 = (판본) => { const v = 검판들.map((k) => 퍼(t('B', 판본, k).놓침, t('B', 판본, k).n)); return `${Math.min(...v).toFixed(1)}~${Math.max(...v).toFixed(1)}%`; };

const 판정글 = (() => {
  const 통 = 통과('B', 2); const [받0, 받1] = 범위('B', 2, 받률); const [엉0, 엉1] = 범위('B', 2, 엉률);
  const 앞 = 통.length === 4 ? '2판은 처음 보는 200줄(나판)에서 네 정답 판 모두 두 기준을 넘었어요.'
    : 통.length ? `2판은 처음 보는 200줄(나판)에서 네 정답 판 가운데 ${통.length}판이 두 기준을 넘었어요(${통.map((k) => 검이름[k]).join(' · ')}).`
      : '2판도 처음 보는 200줄(나판)에서는 두 기준을 함께 넘지 못했어요.';
  return `${앞} 맞게 받음 ${받0.toFixed(1)}~${받1.toFixed(1)}% · 엉뚱 ${엉0.toFixed(1)}~${엉1.toFixed(1)}%예요.`;
})();

const html = `<title>하온 답 은행 시험</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* 실험 노트: 판정 → 1판과 2판을 같은 잣대로 → 귀로 듣기 → 남은 흠 → 속도 → 잰 방법. 바탕은 종이 흰색 · 검정, 사업 색은 코랄 하나. */
:root{
  --bg:#FFFFFF;--fg:#171412;--muted:#6E6661;--line:#E7E1DC;--soft:#F6F2EF;
  --accent:#F96859;--accent-text:#AE322A;--grey-mark:#A39B95;--range:#D9D2CC;
  --font:'SUIT Variable','Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;
  --mono:ui-monospace,'Cascadia Mono',Consolas,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#0B0A0A;--fg:#F3EFEC;--muted:#A79F99;--line:#2B2624;--soft:#171413;--accent:#F96859;--accent-text:#FF9C90;--grey-mark:#7C746F;--range:#3A3431;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0B0A0A;--fg:#F3EFEC;--muted:#A79F99;--line:#2B2624;--soft:#171413;--accent:#F96859;--accent-text:#FF9C90;--grey-mark:#7C746F;--range:#3A3431;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font-family:var(--font);font-size:16px;line-height:1.65;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:40px 64px}
main{max-width:60rem;margin:0 auto;display:grid;gap:56px}
h1,h2,h3{text-wrap:balance;line-height:1.3;margin:0}
h1{font-size:clamp(28px,4.4vw,40px);font-weight:800;letter-spacing:-.02em}
h2{font-size:22px;font-weight:750;letter-spacing:-.01em}
h3{font-size:17px;font-weight:700}
p{margin:0;max-width:65ch}
.머리{display:grid;gap:14px}
.작은머리{font-size:13px;letter-spacing:.06em;color:var(--muted);font-weight:600}
.판정{font-size:18px;max-width:64ch}
.판정 b{color:var(--accent-text)}
.숫자들{display:grid;grid-template-columns:repeat(auto-fit,minmax(12.5rem,1fr));border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.숫자{padding:16px 16px 16px 0;display:grid;gap:4px;min-width:0}
.숫자+.숫자{padding-left:16px;border-left:1px solid var(--line)}
.숫자 .큰{font-size:28px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.숫자 .큰 small{font-size:15px;font-weight:600;color:var(--muted)}
.숫자 .설명{font-size:13px;color:var(--muted)}
.통과{color:var(--accent-text);font-weight:700}
.모자람{color:var(--muted);font-weight:700}
section{display:grid;gap:16px}
.작게{font-size:13px;color:var(--muted)}
svg.편차{width:100%;height:auto;max-width:46rem}
svg.편차 text{font-family:var(--font);fill:var(--fg)}
.눈금글{font-size:11px;fill:var(--muted)!important}
.눈금선{stroke:var(--line);stroke-width:1}
.기준선{stroke:var(--muted);stroke-width:1.2;stroke-dasharray:4 4}
.행머리{font-size:14px;font-weight:700}
.행기준{font-weight:500;fill:var(--muted)!important}
.판이름{font-size:12.5px;fill:var(--muted)!important}
.판이름.굵게{font-weight:700;fill:var(--fg)!important}
.범위선{stroke:var(--range);stroke-width:7;stroke-linecap:round}
.편차선{stroke-width:2}
.편차선.넘김{stroke:var(--accent)}
.편차선.모자람{stroke:var(--grey-mark)}
.점.넘김{fill:var(--accent)}
.점.모자람{fill:var(--bg);stroke:var(--grey-mark);stroke-width:2}
.점글{font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums}
svg.좁은판,.좁은판만{display:none}
@media (max-width:34rem){svg.넓은판{display:none}svg.좁은판{display:block;max-width:360px}.좁은판만{display:block}}
.들기{display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:18px}
.들기 figure{margin:0;display:grid;gap:8px;min-width:0}
.들기 figcaption{font-weight:700}
.들기 figcaption span{font-weight:500;color:var(--muted);font-size:13px}
audio{width:100%}
.표틀{overflow-x:auto;border:1px solid var(--line);border-radius:6px}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid var(--line)}
th{font-size:12.5px;color:var(--muted);font-weight:650;background:var(--soft)}
tr:last-child td{border-bottom:0}
table.대사{min-width:54rem}
td.학습자{width:24%}
.묶음표{display:inline-block;font-family:var(--mono);font-size:11.5px;color:var(--accent-text);border:1px solid var(--line);border-radius:4px;padding:0 5px;margin-top:4px}
.넘김표{color:var(--muted)}
.관찰{display:grid;gap:6px;padding-left:18px;margin:0}
.관찰 li::marker{color:var(--accent)}
.막대표{display:grid;gap:10px}
.막대줄{display:grid;grid-template-columns:minmax(7rem,12rem) 1fr 4rem 4rem;gap:10px;align-items:center}
.막대머리{font-size:12.5px;color:var(--muted)}
.막대칸{height:14px}
.막대{height:100%;background:repeating-linear-gradient(135deg,var(--grey-mark) 0 1.2px,transparent 1.2px 5px);border-right:2px solid var(--fg)}
.막대.강조{background:repeating-linear-gradient(135deg,var(--accent) 0 1.2px,transparent 1.2px 5px);border-right-color:var(--accent-text)}
.막대값{font-variant-numeric:tabular-nums;font-size:14px;text-align:right}
.엉뚱값{color:var(--muted)}
.엉뚱들{display:grid;gap:14px;padding-left:18px;margin:0}
.엉뚱말{font-weight:650}
.고칠것{display:grid;gap:10px;padding-left:20px;margin:0}
.값표 td:nth-child(2),.값표 th:nth-child(2){text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
@media (max-width:30rem){.막대줄{grid-template-columns:1fr 3.4rem 3.4rem}.막대칸{grid-column:1/-1;order:2}.숫자+.숫자{padding-left:0;border-left:0;border-top:1px solid var(--line)}}
</style>
<main>
<header class="머리">
  <div class="작은머리">실시간 음성 상황극 · 하온 팬사인회 · 2026년 11월 1일 · 2판</div>
  <h1>미리 써 둔 답으로 하온이 받아칠 수 있을까</h1>
  <p class="판정">${판정글} 답 짜임을 「반응 + 아직 안 들은 질문」으로 바꾸니 <b>괜히 생성으로 넘기던 일(놓침)이 ${놓침범위(1)} → ${놓침범위(2)}로 줄고 맞게 받음은 올랐지만, 엉뚱한 답은 줄지 않았어요.</b> 2판 엉뚱의 3분의 1은 사인 순간의 한 줄(「부탁한 것도 같이 써 줄게요」가 그냥 사인 부탁에도 나감)에서 나왔어요. 값은 4분 한 판에 약 ${원(한판(값.고르기2))}원(실시간 ${원(값.실시간)}원)이고, 답까지 걸리는 시간은 ${(은행2지연 / 1000).toFixed(1)}초로 실시간(${(실시간지연 / 1000).toFixed(1)}초)보다 아직 느려요.</p>
  <div class="숫자들">
    <div class="숫자"><div class="작게">2판 · 맞게 받음 · 기준 80% 이상</div><div class="큰">${받률(t('B', 2)).toFixed(1)}%</div><div class="설명">나판 · Fable · 판마다 ${범위('B', 2, 받률).map((v) => v.toFixed(1)).join('~')}%</div></div>
    <div class="숫자"><div class="작게">2판 · 엉뚱한 답 · 기준 5% 이하</div><div class="큰">${엉률(t('B', 2)).toFixed(1)}%</div><div class="설명">나판 · Fable · 판마다 ${범위('B', 2, 엉률).map((v) => v.toFixed(1)).join('~')}%</div></div>
    <div class="숫자"><div class="작게">4분 한 판 값</div><div class="큰">${원(한판(값.고르기2))}<small>원</small></div><div class="설명">실시간 ${원(값.실시간)}원 · 생성으로 넘김 ${생성률(고2B).toFixed(1)}%(1판 ${생성률(고1B).toFixed(1)}%)</div></div>
    <div class="숫자"><div class="작게">답까지(받아 적기 + 고르기, 중앙)</div><div class="큰">${(은행2지연 / 1000).toFixed(1)}<small>초</small></div><div class="설명">실시간 ${(실시간지연 / 1000).toFixed(1)}초 · 빠른 길은 안전선에 못 미쳐 안 씀</div></div>
  </div>
</header>

<section>
  <h2>1판과 2판, 같은 잣대로</h2>
  <p>두 검수자(Fable · GPT)가 학습자 말마다 1판 답과 2판 답을 X · Y로 섞어 받아, 어느 쪽인지 모른 채 「자연 · 어색」을 따로 매겼어요. <b>나판</b>은 2판이 한 번도 본 적 없는 새 200줄이라 기준 통과는 이 판으로 봐요. 가판은 1판 시험과 같은 200줄이고, 2판이 그 실패를 보고 고친 판이라 점수가 좋게 나올 수밖에 없어요.</p>
  ${편차점()}
  ${편차점({ 폭: 360, 왼: 78, 좁음: true })}
  <p class="작게">점은 Fable 판정, 옅은 막대는 네 정답 판(Fable · GPT · 둘 다 자연일 때만 · 하나라도 자연이면)의 범위예요. 오른쪽이 기준을 넘긴 쪽이에요. 두 검수자의 판정이 같았던 비율은 나판 ${퍼글(판정.판.B.일치.같음, 판정.판.B.일치.둘, 0)}, 가판 ${퍼글(판정.판.A.일치.같음, 판정.판.A.일치.둘, 0)}예요.</p>
  <p class="작게">1판 처음 시험(미리 매긴 정답 방식, 가판)은 맞게 받음 ${(100 * 처음요약.정답별.페이블.맞게받음 / 처음요약.정답별.페이블.n).toFixed(1)}% · 엉뚱 ${(100 * 처음요약.정답별.페이블.엉뚱 / 처음요약.정답별.페이블.n).toFixed(1)}%(Fable)였고, 같은 1판을 이번 블라인드 방식으로 다시 매긴 값이 위의 「1판 · 가판」이에요.</p>
</section>

<section>
  <h2>세 판을 들어 보세요</h2>
  <p>같은 학습자 소리에 1판 · 2판 · 실시간 답을 붙였고, 셋 다 같은 목소리(Kore)로 녹음해 내용만 비교되게 했어요. 차례 사이는 똑같이 0.45초로 맞췄어요.</p>
  <h3>평범한 판</h3>
  <div class="들기">
    <figure><figcaption>1판 <span>묶음 하나 고르기</span></figcaption><audio controls preload="none" src="은행_A.mp3"></audio></figure>
    <figure><figcaption>2판 <span>반응 + 아직 안 들은 질문</span></figcaption><audio controls preload="none" src="은행2_A.mp3"></audio></figure>
    <figure><figcaption>실시간 <span>Gemini 3.8 Live가 새로 말함</span></figcaption><audio controls preload="none" src="실시간_A.mp3"></audio></figure>
  </div>
  ${대화표('A')}
  <h3>까다로운 판</h3>
  <div class="들기">
    <figure><figcaption>1판</figcaption><audio controls preload="none" src="은행_B.mp3"></audio></figure>
    <figure><figcaption>2판</figcaption><audio controls preload="none" src="은행2_B.mp3"></audio></figure>
    <figure><figcaption>실시간</figcaption><audio controls preload="none" src="실시간_B.mp3"></audio></figure>
  </div>
  ${대화표('B')}
  <ul class="관찰">
    <li>2판은 「사랑해요! 콘서트 꼭 갈게요」에 둘 다 받았어요(1판은 응원만). 「안녕하세요… 이름이 투야예요」처럼 영어가 섞인 말에는 이름을 받고 「한국어로도 잘했어요!」를 붙였어요.</li>
    <li>실시간판은 이름을 불러 주지만, 두 대화 모두 작별 인사를 두 번 되풀이했고 이미 들은 이름을 다시 물었어요.</li>
    <li>2판에도 흠이 하나 들렸어요 — 작별 뒤 「안녕히 계세요」에 「안녕~ 안녕~ 조심히 가요!」처럼 「안녕」이 겹쳤어요(작별 반응과 작별 질문의 이음). 3판에서 고쳐요.</li>
  </ul>
</section>

<section>
  <h2>2판이 아직 약한 곳</h2>
  <p class="작게">나판 · Fable 정답 기준. 막대는 맞게 받은 비율, 오른쪽 회색 숫자는 엉뚱한 답 비율이에요.</p>
  <div class="막대표">
    <div class="막대줄 막대머리"><div></div><div></div><div class="막대값">맞게</div><div class="막대값">엉뚱</div></div>
    ${막대줄('평범한 답', B2.평범.페이블, true)}
    ${막대줄('예외인 말', B2.예외.페이블)}
    ${막대줄('받아 적기 오류 없음', B2.오류별.없음.페이블)}
    ${막대줄('받아 적기 가벼운 오류', B2.오류별.가벼움.페이블)}
    ${막대줄('받아 적기 심한 오류', B2.오류별.심함.페이블)}
    ${Object.entries(B2.순간별).filter(([, c]) => c.페이블.n).map(([s, c]) => 막대줄(`순간: ${순간이름[s]}`, c.페이블)).join('\n    ')}
  </div>
  <p class="작게">같은 나판에서 1판은 평범한 답 ${받률(B1.평범.페이블).toFixed(1)}% · 예외 ${받률(B1.예외.페이블).toFixed(1)}%였어요.</p>
  <h3>엉뚱은 왜 줄지 않았나</h3>
  <ul class="관찰">
    <li><b>한 줄이 3분의 1.</b> 사인 순간 반응의 변형 「그럼요! 부탁한 것도 같이 써 줄게요.」가 그냥 「사인해 주세요」에도 나가, 다른 부탁이 있었던 것처럼 들렸어요. 2판 엉뚱 가운데 나판 Fable ${원인.B.F.엉뚱}줄 중 ${원인.B.F.한줄} · GPT ${원인.B.G.엉뚱}줄 중 ${원인.B.G.한줄}, 가판 Fable ${원인.A.F.엉뚱}줄 중 ${원인.A.F.한줄} · GPT ${원인.A.G.엉뚱}줄 중 ${원인.A.G.한줄}이 이 줄이에요. 평범한 답에서 2판이 1판보다 엉뚱이 많았던 것(나판 Fable ${엉률(B1.평범.페이블).toFixed(1)}% → ${엉률(B2.평범.페이블).toFixed(1)}%)도 대부분 이 줄 때문이에요.</li>
    <li><b>말 겹침은 덜 걸렸어요.</b> 「고마워요 … 고마워요」처럼 반응 둘이 겹친 답은 나판에서 여러 번 나왔지만 어색 판정은 Fable ${원인.B.F.겹침} · GPT ${원인.B.G.겹침}줄이었어요.</li>
    <li><b>나머지는 은행이 못 받는 말.</b> 하트 · 응원 문구 · 고양이 그림 같은 덧붙인 부탁, 「볼로르 맞아요?」 · 「코 수술 안 했어요?」 같은 구체적인 질문, 받아 적기가 크게 틀린 말이에요. GPT는 이런 말을 두루뭉술하게 받는 것도 어색으로 봐서 Fable보다 엉뚱을 두 배쯤 많이 셌어요.</li>
    <li><b>고치면(추정).</b> 그 한 줄을 「좋아요! 예쁘게 써 줄게요.」로 바꾸고 겹침을 막으면 나판 엉뚱이 Fable ${(100 * (원인.B.F.엉뚱 - 원인.B.F.한줄 - 원인.B.F.겹침) / 200).toFixed(1)}% · GPT ${(100 * (원인.B.G.엉뚱 - 원인.B.G.한줄 - 원인.B.G.겹침) / 200).toFixed(1)}% 안팎이 돼요 — 고친 줄이 모두 자연이 된다고 본 어림이고, 나판은 이미 본 말이라 새 판으로 다시 재야 해요. GPT 잣대까지 맞추려면 구체적인 질문 · 덧붙인 부탁은 생성으로 넘겨야 해요.</li>
  </ul>
  <h3>2판 답을 어색하다고 본 줄 ${엉뚱2.length}개(둘 다 어색 ${둘다.length})</h3>
  <ol class="엉뚱들">${엉목록}</ol>
</section>

<section>
  <h2>빠른 고르기</h2>
  <ul class="관찰">
    <li><b>지금 걸리는 시간.</b> 받아 적기 중앙 ${(받아적기ms / 1000).toFixed(1)}초 + AI 고르기 중앙 ${(고르기ms2 / 1000).toFixed(1)}초(위 10% ${(고르기ms2위 / 1000).toFixed(1)}초). 1판 때 잰 3.0초에는 키 차례가 바닥난 앞 조직을 두드리고 넘어가는 헛걸음이 섞여 있었어요 — 이번에는 성공한 요청 하나만 쟀어요.</li>
    <li><b>임베딩 빠른 길은 안 썼어요.</b> 학습자 말과 가장 가까운 예시를 찾아 AI를 건너뛰는 길을 만들고 반응마다 예시를 15개씩 늘려 봤지만, 가판에서 AI 고르기와 같은 판단을 하는 비율이 안전선(97%)에 못 미쳤어요 — 그 선을 지키면 200줄 중 ${빠른길.가판.받음}줄만 받을 수 있었어요.</li>
    <li><b>다음에 줄일 곳.</b> 받아 적기를 말하는 동안 흘려 받기(끝난 뒤 0.3초 안팎), 말이 끝나기 전에 고르기를 미리 시작하기, 그사이 미리 구운 맞장구 소리를 바로 틀기. 이 셋을 붙여 다시 재요.</li>
  </ul>
</section>

<section>
  <h2>값</h2>
  <div class="표틀"><table class="값표"><thead><tr><th>4분 한 판(학습자 8차례)</th><th>값</th><th>셈</th></tr></thead><tbody>
    <tr><td>실시간 GPT-Live</td><td>${원(값.실시간)}원</td><td class="작게">분당 $0.05(시제품 실측) + 돌아보기 $0.003</td></tr>
    <tr><td>답 은행 2판</td><td>${원(한판(값.고르기2))}원</td><td class="작게">차례마다 받아 적기 $0.0003 + 2판 고르기 $${값.고르기2.toFixed(4)}(나판 200줄 실측) + 돌아보기 · 생성으로 넘김 ${생성률(고2B).toFixed(1)}%는 따로</td></tr>
    <tr><td>답 은행 1판</td><td>${원(한판(값.고르기1))}원</td><td class="작게">1판 고르기 $${값.고르기1.toFixed(4)}(나판 200줄 실측) · 생성으로 넘김 ${생성률(고1B).toFixed(1)}%는 따로</td></tr>
  </tbody></table></div>
  <p class="작게">1달러 1,400원(BM 문서의 계산용 환율). 2판은 반응 목록이 길어 고르기 한 번의 값이 1판보다 조금 크지만, 실시간 생성으로 넘기는 차례가 크게 줄었어요.</p>
</section>

<section>
  <h2>어떻게 쟀나</h2>
  <ul class="관찰">
    <li>은행 1판(묶음 47 · 녹음 줄 ${녹음줄수1()})과 2판(반응 ${반응들.length} · 녹음 줄 ${녹음줄수2()})은 각각 시험 말을 보기 전에 확정했어요(파일 지문을 README에 남김). 2판은 반응 + 이끔을 잇는 규칙에 「들은 것」을 더해 한 번 다시 굳혔어요 — 그때 나판은 개수 · 분포와 가판과 겹치는 8줄만 본 상태였어요.</li>
    <li>학습자 말 두 판(가판 · 나판, 각 200줄)은 은행을 보지 않은 Gemini 3.8 Flash가 같은 지시로 만들었어요. 받아 적기 오류(없음 · 가벼움 · 심함 = 대략 55 · 30 · 15)도 함께 흉내 냈어요.</li>
    <li>고르기는 받아 적은 글만 봤어요(1판 · 2판 모두 GPT-6.1 Terra, 생각 끔). 판정은 Fable(세 조씩)과 GPT가 같은 기준으로 블라인드로 매겼어요.</li>
    <li>한계: 학습자 말과 받아 적기 오류는 지어낸 것이라 실제 몽골 학습자에게서는 더 나쁘게 나올 수 있어요. 한 차례씩 매겼고, 대화 흐름은 들어 보기 두 판으로만 봤어요.</li>
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
for (const f of ['은행_A.mp3', '은행_B.mp3', '은행2_A.mp3', '은행2_B.mp3', '실시간_A.mp3', '실시간_B.mp3']) fs.copyFileSync(path.join(작업, '엮음', f), path.join(폴더, f));
console.log(`페이지 → ${path.join(폴더, 'index.html')} (${Math.round(심음.html.length / 1024)}KB)`);
