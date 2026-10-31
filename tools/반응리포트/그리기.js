'use strict';
/**
 * 광고 반응 리포트 · 그리기 — 지표 · 그림 자료 · 글로 한 장짜리 HTML을 만든다. 순수 함수(파일 · 네트워크 없음).
 * 색 토큰 · 막대 · 글자 · 출처 붙은 숫자는 업종 브리핑 그리기.js를 그대로 쓰고(한 곳에서 고친다), 칸 지도 그림 하나를 더한다.
 * 자료를 못 읽은 칸은 「이번엔 못 읽음 · 까닭」으로 남긴다. 돌려주는 것: {문서: 혼자 여는 HTML, 조각: 아티팩트에 올릴 본문}
 */
const 폰트 = require('../lib/브랜드폰트.js');
const 브 = require('../업종브리핑/그리기.js');
const 플랫폼 = require('./플랫폼.js');
const 글모듈 = require('./글.js');

const { 이스, 값글, 글HTML } = 브;

const 더스타일 = `
.시험판{align-self:flex-start;font-size:12px;font-weight:700;color:var(--muted);border:1px dashed var(--quiet);border-radius:999px;padding:1px 10px}
.어디{align-self:flex-start;font-size:12px;font-weight:700;color:var(--accent-text);border:1px solid var(--accent);border-radius:999px;padding:1px 10px}
.바꿀 .어떻게{font-weight:650}
.지도들{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr));gap:14px}
.칸지도 rect.칸{fill:var(--panel);stroke:var(--line)} .칸지도 rect.칸.짝{fill:var(--bg)}
.칸지도 text.칸글{font-size:12px;fill:var(--fg)} .칸지도 text.칸위{font-size:11px;fill:var(--muted)}
.칸지도 line.평균{stroke:var(--accent);stroke-width:2} .칸지도 text.평균글{font-size:12px;font-weight:700;fill:var(--accent-text)}
td.작,th.작{font-size:12px;color:var(--muted)}
.넓은표{min-width:54rem} .넓은표 td:nth-child(-n+2),.넓은표 th{white-space:nowrap}
.칸지도 text.칸위{font-size:11px}
/* 결 — 상자 · 굵은 글씨 대신 크기 · 회색 · 얇은 선으로 위계를 만든다(10-31 유호님이 고른 리더보드 문법 · 시험판 A′).
   업종 브리핑 스타일 위에 이 리포트만 덮는다(브리핑 바이트는 그대로). 강조색은 PULSE 베리(--accent) 하나. */
:root{--bg:#FFFFFF;--fg:#222326;--muted:#6B6F76;--line:#E8E8E6;--soft:#F5F5F3;--bar:#A3A6AC}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#111215;--fg:#EDEDEF;--muted:#A3A7AE;--line:#2A2B31;--soft:#18191D;--bar:#5E626A}}
:root[data-theme="dark"]{--bg:#111215;--fg:#EDEDEF;--muted:#A3A7AE;--line:#2A2B31;--soft:#18191D;--bar:#5E626A}
.br{gap:56px}
.br h1{font-weight:560;letter-spacing:-.03em}
.br h2{font-size:22px;font-weight:600;letter-spacing:-.015em;padding-top:22px;border-top:1px solid var(--line)}
.br h3{font-size:16px;font-weight:600}
.꼬리표{font-weight:600;letter-spacing:.02em}
.칸{gap:18px}
.판{background:none;border:0;border-radius:0;padding:0}
.넷,.셋{gap:28px} .격자판{gap:28px 40px}
.넷{grid-template-columns:repeat(auto-fit,minmax(min(100%,9.5rem),1fr));gap:28px 20px}
@media (max-width:719px){.넷{grid-template-columns:repeat(2,minmax(0,1fr))}}
.넷 > .타일,.셋 > .판{border-top:1px solid var(--line);padding-top:16px}
.타일 .큰수{font-size:34px;font-weight:500;letter-spacing:-.025em;color:var(--fg)}
.타일 .라벨{font-size:12.5px;font-weight:500}
.수{font-weight:650}
th{font-size:12.5px;font-weight:500}
th,td{padding:9px 8px}
.시험판{border:0;padding:0;font-weight:500}
.어디{border:0;padding:0;font-weight:600}
.못읽음{border:0;border-left:2px solid var(--line);border-radius:0;padding:2px 0 2px 14px}
.칸지도 rect.칸{fill:var(--bg)} .칸지도 rect.칸.짝{fill:var(--soft)}
/* 평소 대비 순위표 — 편차 점(10-31 유호님 「③ 편차 점으로」): 평소(1배) 점선에서 뻗는 가는 선과 점, 곱절 눈금(0.5 · 1 · 2 · 4 · 8배가
   같은 간격). 눈금 · 선 · 점 자리는 칸 폭에 대한 비율(--x)이라 휴대폰에서도 같이 줄어든다. 색은 평소보다 많은 줄만 베리. */
.순위표{font-size:15px;table-layout:fixed;--왼:3.75rem;--오른:5rem}
.순위표 th{padding:0 0 12px;border-bottom:1px solid var(--line);color:var(--muted)}
.순위표 td{padding:0;height:52px;vertical-align:middle;border-bottom:1px solid var(--line)}
.순위표 .순{width:2.5rem;color:var(--muted);font-variant-numeric:tabular-nums}
.순위표 .이름{width:17rem} .순위표 td.이름{padding-right:16px;overflow-wrap:anywhere}
@media (max-width:1100px){.순위표 .이름{width:13rem}}
.순위표 .광고{font-weight:500}
.순위표 .곳{font-size:12px;color:var(--muted);margin-left:6px;white-space:nowrap}
.순위표 .조회{width:5.5rem;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.순위표 th.축칸{position:relative}
.축{position:absolute;left:var(--왼);right:var(--오른);bottom:12px;height:1.65em}
.축 span{position:absolute;top:0;left:calc(100% * var(--x));transform:translateX(-50%);line-height:1.65;color:var(--muted);white-space:nowrap}
.축 span.일{color:var(--fg)}
.숨김{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.막대줄{position:relative;height:52px}
.막대줄 > *{position:absolute;--폭:calc(100% - var(--왼) - var(--오른));--자리:calc(var(--왼) + var(--폭) * var(--x, 0))}
.눈금{top:0;bottom:0;left:var(--자리);border-left:1px solid var(--line)}
.눈금.일{border-left:1px dashed var(--ref)}
.줄기{top:50%;height:2px;margin-top:-1px;left:calc(var(--왼) + var(--폭) * var(--a));width:calc(var(--폭) * var(--l));background:var(--bar)}
.줄기.강조{background:var(--accent)}
.점{top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;left:var(--자리);background:var(--bg);box-shadow:inset 0 0 0 2px var(--bar)}
.점.강조{background:var(--accent);box-shadow:none}
.배{top:50%;transform:translateY(-50%);left:calc(var(--자리) + 8px);padding:0 3px;line-height:1.4;background:var(--bg);font-variant-numeric:tabular-nums;white-space:nowrap}
.배.왼{left:auto;right:calc(100% - var(--자리) + 8px)}
.좁을때{display:none}
@media (max-width:860px){
  .순위표{--왼:3rem;--오른:4.25rem}
  .순위표,.순위표 thead,.순위표 tbody{display:block}
  .순위표 tr{display:grid;grid-template-columns:1.75rem 1fr auto;grid-template-areas:"순 이름 조회" "순 막대 막대";column-gap:8px;row-gap:2px;padding:12px 0;border-bottom:1px solid var(--line)}
  .순위표 thead tr{grid-template-areas:"순 막대 막대";padding:0 0 6px}
  .순위표 thead th.순,.순위표 thead th.이름,.순위표 thead th.조회{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;padding:0;border:0}
  .순위표 th.축칸{grid-area:막대;height:1.65em;padding:0;border:0}
  .축{top:0;bottom:auto}
  .순위표 td{display:block;height:auto;border:0;width:auto}
  .순위표 td.순{grid-area:순;width:auto} .순위표 td.이름{grid-area:이름;width:auto;padding:0} .순위표 td.조회{grid-area:조회;width:auto} .순위표 td.막대칸{grid-area:막대}
  .막대줄{height:28px}
  .좁을때{display:inline;font-size:12px;color:var(--muted)}
}
/* 0부터 세는 양 — 빗금 막대(그래프 문법 docs/디자인/그래프_문법.md): 꽉 찬 면 대신 가는 사선 + 끝에만 단단한 선, 강조할 줄만 사업 색 */
.빗금표{display:flex;flex-direction:column;container-type:inline-size}
.빗줄{display:grid;grid-template-columns:minmax(6rem,11rem) minmax(0,1fr);align-items:center;column-gap:16px;min-height:38px;border-bottom:1px solid var(--line)}
.빗줄:first-child{border-top:1px solid var(--line)}
.빗이름{font-size:14px;line-height:1.4;overflow-wrap:anywhere}
.빗칸{display:flex;align-items:center;gap:8px;min-width:0}
.빗띠{flex:none;height:14px;width:max(2px,calc((100% - 6.5rem) * var(--w)));--색:var(--bar);background:repeating-linear-gradient(-45deg,var(--색) 0 1.2px,transparent 1.2px 4px);box-shadow:inset -2px 0 0 var(--색)}
.빗띠.강조{--색:var(--accent)}
.빗값{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
/* 화면 폭이 아니라 판 폭으로 쌓는다 — 랜딩 두 열 판(680~860px 화면)에서 막대가 몇 px로 줄던 것(10-31 Fable P2) */
@container (max-width:26rem){.빗줄{grid-template-columns:minmax(0,1fr);row-gap:4px;padding:8px 0}}
`;

/**
 * 빗금 막대: [{이름, 값, 메모, 강조}] — 0부터 세는 양(비율 · 개수). 값은 0~최대, 넣은 순서대로.
 * 표시 글은 이름 · 메모 그대로라 화면 읽기에도 읽힌다(막대는 빈 칸).
 */
function 빗금막대(줄, { 최대, 이름표 = '' }) {
  if (!줄.length) return '';
  const 위 = 최대 > 0 ? 최대 : 1;
  return `<div class="빗금표" role="list" aria-label="${이스(이름표)}">${줄.map((d) => `<div class="빗줄" role="listitem"><span class="빗이름">${이스(d.이름)}</span><span class="빗칸"><span class="빗띠${d.강조 ? ' 강조' : ''}" style="--w:${Math.min(1, Math.max(0, Number(d.값) || 0) / 위).toFixed(4)}"></span><span class="빗값">${이스(d.메모)}</span></span></div>`).join('')}</div>`;
}

/**
 * 곱절 눈금 범위 — 2의 거듭제곱 칸(0.5 · 1 · 2 · 4 · 8배…). 평소(1배)를 늘 넣고, 가장 작은 · 큰 값이 끝에 붙지 않게 한 칸씩 띄운다.
 * x(v)는 칸 폭에 대한 비율(0~1). 0 이하 값은 왼쪽 끝에 둔다.
 */
function 곱절범위(값들) {
  const 양 = 값들.filter((v) => Number.isFinite(v) && v > 0);
  const 작 = Math.min(1, ...양), 큰 = Math.max(1, ...양);
  const 아래 = Math.min(-1, Math.ceil(Math.log2(작)) - 1), 위 = Math.max(1, Math.floor(Math.log2(큰)) + 1);
  const x = (v) => (Math.log2(Math.max(Number(v) || 0, 2 ** 아래)) - 아래) / (위 - 아래);
  const 눈금 = [];
  for (let k = 아래; k <= 위; k++) 눈금.push({ k, x: (k - 아래) / (위 - 아래), 글: k === 0 ? '평소' : `${Number((2 ** k).toFixed(2)).toLocaleString('ko-KR')}배` });
  return { 아래, 위, x, 눈금 };
}

/**
 * 평소 대비 순위표: [{이름, 곳, 값, 메모, 강조, 조회, 출처}] — 넣은 순서대로(부르는 쪽이 배수 큰 순으로 정렬).
 * 막대 대신 평소(1배) 점선에서 뻗는 선 · 점(편차 점, 곱절 눈금). 눈금 글이 일곱 넘게 서면 평소에서 두 칸 간격(0.25 · 평소 · 4 · 16배…)으로만 단다.
 * 넓은 화면은 표, 좁은 화면은 한 줄 두 단 격자 — 표시를 바꿔도 표 뜻이 남게 role을 붙인다.
 */
function 순위표(줄) {
  if (!줄.length) return '';
  const 범 = 곱절범위(줄.map((d) => d.값));
  const 촘촘 = 범.눈금.length > 7;
  const 축 = 범.눈금.filter((t) => !촘촘 || t.k % 2 === 0)
    .map((t) => `<span${t.k === 0 ? ' class="일"' : ''} style="--x:${t.x.toFixed(4)}">${이스(t.글)}</span>`).join('');
  const 눈금선 = 범.눈금.map((t) => `<i class="눈금${t.k === 0 ? ' 일' : ''}" style="--x:${t.x.toFixed(4)}"></i>`).join('');
  const 일 = 범.x(1);
  const 행 = 줄.map((d, i) => {
    const x = 범.x(d.값);
    return `<tr role="row"><td role="cell" class="순">${i + 1}</td>`
      + `<td role="cell" class="이름"><span class="광고">${이스(d.이름)}</span> <span class="곳">${이스(d.곳)}</span></td>`
      + `<td role="cell" class="막대칸"><div class="막대줄">${눈금선}<i class="줄기${d.강조 ? ' 강조' : ''}" style="--a:${Math.min(일, x).toFixed(4)};--l:${Math.abs(x - 일).toFixed(4)}"></i>`
      + `<i class="점${d.강조 ? ' 강조' : ''}" style="--x:${x.toFixed(4)}"></i><span class="배${d.값 < 1 ? ' 왼' : ''}" style="--x:${x.toFixed(4)}"${d.출처 ? ` title="${이스(d.출처)}"` : ''}>${이스(d.메모)}</span></div></td>`
      + `<td role="cell" class="조회"><span class="좁을때">조회 </span>${Number.isFinite(d.조회) ? d.조회.toLocaleString('ko-KR') : '—'}</td></tr>`;
  }).join('');
  return `<table class="순위표" role="table"><thead role="rowgroup"><tr role="row"><th role="columnheader" class="순">#</th><th role="columnheader" class="이름">게시물</th><th role="columnheader" class="축칸"><span class="숨김">평소 대비</span><div class="축" aria-hidden="true">${축}</div></th><th role="columnheader" class="조회">조회</th></tr></thead><tbody role="rowgroup">${행}</tbody></table>`;
}

function 못읽음(글, 덧 = '') {
  return `<p class="못읽음">이번엔 이 자료를 읽지 못했어요. ${이스(글 || '')}${덧}</p>`;
}

const 짧게 = (s, n = 9) => { const a = [...String(s || '')]; return a.length > n ? `${a.slice(0, n).join('')}…` : a.join(''); };

/**
 * 칸 지도: 휴대폰 · PC 쪽을 나란히 세로 띠로 그리고, 칸마다 위끝 자리에 이름과 %를, 평균 스크롤 자리에 선을 긋는다(평균이 없으면 지도만).
 * 한 SVG에 둘을 나란히 둬 390 폭에서도 한 화면에 든다. 칸 이름은 설정 랜딩.칸이름 → 쪽 제목 앞 아홉 자.
 */
function 칸지도그림(지도들, 평균들 = {}, { 높이 = 430 } = {}) {
  const 판들 = (지도들 || []).filter((m) => m?.칸?.length).slice(0, 2);
  if (!판들.length) return '';
  const 칸너비 = 172, 띠 = 22, 위 = 34, y = (p) => 위 + (p / 100) * (높이 - 위 - 12);
  let 그림 = '';
  판들.forEach((m, k) => {
    const x0 = 4 + k * 칸너비;
    const 폰 = m.폭 < 768;
    그림 += `<text x="${x0}" y="14" class="칸글">${폰 ? '휴대폰' : 'PC'} ${m.폭}px</text><text x="${x0}" y="28" class="칸위">쪽 ${m.쪽높이.toLocaleString('ko-KR')}px</text>`;
    let 앞글 = -Infinity;
    m.칸.forEach((c, i) => {
      const y0 = y(c.위), y1 = y(c.아래);
      그림 += `<rect x="${x0}" y="${y0.toFixed(1)}" width="${띠}" height="${Math.max(1, y1 - y0).toFixed(1)}" class="칸${i % 2 ? ' 짝' : ''}"/>`;
      // 이름이 앞 이름과 겹치면 아래로 민다(얇은 칸이 잇달아 와도 읽히게)
      const ty = Math.max(y0 + 11, 앞글 + 13);
      앞글 = ty;
      그림 += `<text x="${x0 + 띠 + 6}" y="${ty.toFixed(1)}" class="칸글">${이스(짧게(c.이름))}<tspan class="칸위" dx="5">${c.위}%</tspan></text>`;
    });
    const 평균 = 평균들[폰 ? '폰' : 'PC'];
    if (Number.isFinite(평균)) {
      const yy = y(Math.max(0, Math.min(100, 평균)));
      그림 += `<line x1="${x0 - 3}" x2="${x0 + 띠 + 3}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" class="평균"/><text x="${x0 + 띠 + 6}" y="${(yy + 4).toFixed(1)}" class="평균글">평균 ${평균}%</text>`;
    }
  });
  const 너비 = 판들.length * 칸너비;
  return `<svg class="칸지도" viewBox="0 0 ${너비} ${높이}" width="100%" style="max-width:${너비 * 1.3}px" role="img" aria-label="휴대폰 · PC 폭에서 본 칸 위치">${그림}</svg>`;
}

const 칸말 = Object.freeze({ 조회: '조회', 평소대비: '평소 대비', 평소중앙: '평소 조회', 위치: '계정 안 위치', 앞3초유지: '앞 3초 유지', 본비율: '본 비율', 평균시청: '평균 시청', 평균조회율: '평균 조회율', 완주율: '완주율', 좋아요: '좋아요', 댓글: '댓글', 공유: '공유', 저장: '저장', 도달: '도달', 나이: '잰 때', 꼬리: '7일째 뒤 늘어남', 길이: '길이', 조회합: '조회 합', 팔로우: '팔로우', 구독증가: '구독 증가' });

/** 근거 줄에 쓰는 짧은 이름 — 「간」 유튜브 본 비율. 긴 설명은 마우스를 올리면(title) 보인다 */
function 짧은이름(이름, 지표) {
  const m = 이름.split('.');
  if (m[0] === '광고' && m.length === 3) return `「${m[1]}」 ${칸말[m[2]] || m[2]}`;
  if (m[0] === '광고' && m.length === 4) return `「${m[1]}」 ${m[2]} ${칸말[m[3]] || m[3]}`;
  if (m[0] === '플랫폼' && m[2] === '평소대비중앙') return `${m[1]} 평소 대비 중앙값`;
  if (m[0] === '댓글' && m[1] === '주제') return `「${m[2]}」 댓글 ${m[3] === '좋아요' ? '좋아요' : m[3] === '비율' ? '비율' : '수'}`;
  // 설명의 괄호 풀이는 떼고 줄인다 — 괄호 안에서 잘려 짝이 깨지던 것(10-31 아르곤 B2)
  return 짧게(String(지표?.설명 || 이름).replace(/\s*\(.*$/, ''), 24);
}

const 유지칸 = [['앞3초유지', '앞 3초 유지'], ['본비율', '본 비율'], ['평균시청', '평균 시청'], ['평균조회율', '평균 조회율'], ['완주율', '완주율']];

function 플랫폼칸(그림, 지표, 글, 상태, 설정) {
  const p = 그림.플랫폼;
  if (!p) return 못읽음(상태.플랫폼);
  const 광고이름 = (키) => (설정.광고 || []).find((a) => a.키 === 키)?.이름 || 키;
  let 안 = '';
  if (p.막대.length) {
    // 배수 큰 순(같으면 광고 순서 그대로). 조회 · 평소 출처는 그 막대를 만든 표 행에서 — 막대는 「평소가 있는 표 행」을
    // 같은 차례로 옮긴 것이라(집계.js) 차례로 짝짓는다. 한 광고에 같은 플랫폼 주소가 둘이어도 제 행을 찾게(10-31 Fable P3).
    const 짝행 = p.표.filter((r) => r.숫자?.평소);
    const 행찾기 = (b, i) => (짝행.length === p.막대.length && 짝행[i].광고 === b.광고 && 짝행[i].플랫폼 === b.플랫폼 ? 짝행[i] : p.표.find((r) => r.광고 === b.광고 && r.플랫폼 === b.플랫폼))?.숫자;
    const 줄 = p.막대.map((b, i) => ({ b, i })).sort((x, y) => y.b.배수 - x.b.배수 || x.i - y.i).map(({ b, i }) => {
      const 숫자 = 행찾기(b, i);
      const 평소 = 숫자?.평소;
      return {
        이름: 광고이름(b.광고), 곳: 플랫폼.플랫폼이름[b.플랫폼] || b.플랫폼, 값: b.배수, 메모: 값글({ 값: b.배수, 단위: '배' }), 강조: b.배수 > 1,
        조회: 숫자?.숫자?.조회, 출처: 평소 ? `${평소.출처} — 앞선 ${평소.편수}편이 같은 나이에 낸 조회의 중앙값 ${Number(평소.중앙).toLocaleString('ko-KR')}회` : '',
      };
    });
    안 += `<div class="판"><h3>평소와 견주면</h3><p class="작은글">같은 계정에서 앞서 올린 게시물들이 같은 나이에 낸 조회의 중앙값을 평소(1배)로 두고 견준 배수예요. 점이 점선보다 오른쪽이면 평소보다 많이, 왼쪽이면 적게 본 것이고 평소보다 많았던 곳만 색으로 칠했어요. 눈금은 곱절 간격이라 1배에서 2배까지와 2배에서 4배까지가 같은 거리예요. 견줄 게시물이 넉넉하지 않은 곳은 뺐어요.</p>${순위표(줄)}</div>`;
  }
  const 수칸 = (r, k) => (Number.isFinite(r.숫자?.숫자?.[k]) ? `${r.숫자.숫자[k].toLocaleString('ko-KR')}${['조회', '좋아요', '댓글', '공유', '저장'].includes(k) ? '' : 플랫폼.단위[k] || ''}` : '—');
  const 유지글 = (r) => {
    const 있음 = 유지칸.filter(([k]) => Number.isFinite(r.숫자?.숫자?.[k])).map(([k, 이름]) => {
      const c = r.숫자.칸출처?.[k] || {};
      const 덧 = [c.시점이름 && c.시점이름 !== r.숫자.시점이름 ? c.시점이름 : '', c.추정 ? '어림' : '', c.창 ? '3일 창' : '', c.화면일 ? `${c.화면일}일째 화면` : ''].filter(Boolean);
      return `${이름} ${r.숫자.숫자[k]}${플랫폼.단위[k]}${덧.length ? `(${덧.join(' · ')})` : ''}`;
    });
    return 있음.length ? 있음.join(' · ') : '—';
  };
  const 꼬리있음 = p.표.some((r) => r.숫자?.꼬리);
  const 출처들 = [...new Set(p.표.filter((r) => r.숫자).map((r) => r.숫자.출처))];
  const 출처칸 = 출처들.length > 1;
  const 줄 = p.표.map((r) => `<tr><td>${이스(광고이름(r.광고))}</td><td><a href="${이스(r.주소)}" target="_blank" rel="noopener">${이스(r.플랫폼이름)}</a></td>`
    + (r.숫자
      ? `<td class="오">${Number.isFinite(r.숫자.나이일) ? `${r.숫자.나이일}일째` : '—'}${r.숫자.모자람 ? '*' : ''}</td><td class="오">${수칸(r, '조회')}</td>${꼬리있음 ? `<td class="오">${r.숫자.꼬리 ? `+${r.숫자.꼬리.늘어남.toLocaleString('ko-KR')}` : '—'}</td>` : ''}<td class="오">${r.숫자.평소 ? 이스(값글({ 값: r.숫자.평소.배수, 단위: '배' })) : '—'}</td><td>${이스(r.숫자.위치?.글 || '—')}</td><td class="오">${수칸(r, '좋아요')}</td><td class="오">${수칸(r, '댓글')}</td><td class="오">${수칸(r, '공유')}</td><td>${이스(유지글(r))}</td>${출처칸 ? `<td class="작">${이스(r.숫자.출처)}</td>` : ''}`
      : `<td colspan="${8 + (꼬리있음 ? 1 : 0) + (출처칸 ? 1 : 0)}" class="작">${이스(r.까닭 || '숫자를 찾지 못했어요')}</td>`) + '</tr>').join('');
  const 별표 = p.표.some((r) => r.숫자?.모자람) ? `<p class="작은글">* ${이스([...new Set(p.표.filter((r) => r.숫자?.모자람).map((r) => r.숫자.모자람))].join(' · '))}</p>` : '';
  안 += `<div class="판"><h3>게시물마다</h3><div class="표감싸기"><table class="넓은표"><thead><tr><th>광고</th><th>플랫폼</th><th class="오">잰 때</th><th class="오">조회</th>${꼬리있음 ? '<th class="오">7일째 뒤 늘어남</th>' : ''}<th class="오">평소 대비</th><th>계정 안 위치</th><th class="오">좋아요</th><th class="오">댓글</th><th class="오">공유</th><th>시청 유지</th>${출처칸 ? '<th class="작">출처</th>' : ''}</tr></thead><tbody>${줄}</tbody></table></div>${별표}<p class="작은글">평소 대비는 같은 계정에서 앞서 올린 게시물들이 같은 나이에 낸 조회의 중앙값과 견준 배수예요(견줄 게시물이 넉넉하지 않으면 —). 계정 안 위치는 같은 나이 조회끼리 견준 자리예요. 시청 유지의 괄호는 다른 판정 시점 · 플랫폼 어림값 · 게시 뒤 3일 창 · 화면에서 읽은 날이에요. 플랫폼마다 조회를 세는 법이 달라 플랫폼끼리는 조회 대신 평소 대비로 견주세요.${출처칸 ? '' : ` 출처: ${이스(출처들[0] || '')}.`}</p></div>`;
  if (글?.플랫폼) 안 += `<p>${글HTML(글.플랫폼, 지표)}</p>`;
  return 안;
}

function 랜딩칸(그림, 지표, 글, 상태, 설정, 지도들) {
  const L = 그림.랜딩;
  const 주소 = 설정.랜딩?.주소 || '';
  const 지도판 = (평균들) => 칸지도그림(지도들, 평균들 || {});
  if (!L) {
    const 측정전 = String(상태.랜딩 || '').startsWith('측정 전');
    return (측정전 ? '<p class="못읽음">아직 랜딩에 측정 코드를 넣기 전이라 이번 리포트에는 랜딩 숫자가 없어요. 측정 코드를 넣은 날부터 하루 숫자가 쌓이고, 다음 리포트부터 이 칸이 채워져요.</p>' : 못읽음(상태.랜딩))
      + ((지도들 || []).length ? `<div class="판"><h3>${이스(주소)}의 칸 지도</h3><p class="작은글">쪽을 휴대폰 · PC 폭으로 열어 칸마다 위치를 쟀어요. 측정이 시작되면 평균적으로 어디까지 내려 봤는지를 이 지도 위에 선으로 그어요.</p>${지도판(null)}</div>` : '');
  }
  const 평균들 = {};
  for (const [기기, r] of Object.entries(L.기기 || {})) {
    if (/mobile|phone/i.test(기기)) 평균들.폰 = r.평균스크롤;
    else if (/pc|desktop/i.test(기기)) 평균들.PC = r.평균스크롤;
  }
  const 타일 = [['랜딩.세션', '들어온 세션'], ['랜딩.평균스크롤', '평균 스크롤'], ['랜딩.참여시간', '머문 시간(움직인 시간)'], ['랜딩.세션당쪽수', '세션당 본 쪽']]
    .filter(([k]) => 지표[k]).map(([k, 라벨]) => `<div class="판 타일"><span class="라벨">${이스(라벨)}</span><span class="큰수" title="${이스(`${지표[k].출처} — ${지표[k].설명}`)}">${이스(값글(지표[k]))}</span></div>`).join('');
  const 신호 = [['랜딩.헛클릭비율', '헛클릭'], ['랜딩.분노클릭비율', '분노 클릭'], ['랜딩.되돌아감비율', '바로 되돌아감']].filter(([k]) => 지표[k]);
  let 안 = `<section class="넷" aria-label="랜딩 숫자">${타일}</section>`;
  안 += `<div class="격자판"><div class="판"><h3>평균적으로 어디까지 내려 봤나</h3><p class="작은글">선은 평균이에요 — 끝까지 본 사람과 첫 화면만 본 사람이 섞여 있어요. 칸 위치는 우리가 쪽을 열어 잰 지도예요.</p>${지도판(평균들)}</div>`
    + (신호.length ? `<div class="판"><h3>막힌 신호</h3><p class="작은글">그 신호가 한 번이라도 나온 세션의 비율이에요.</p>${빗금막대(신호.map(([k, 이름]) => ({ 이름, 값: 지표[k].값, 메모: `${지표[k].값}%`, 강조: false })), { 최대: Math.max(10, ...신호.map(([k]) => 지표[k].값)), 이름표: '막힌 신호 비율' })}</div>` : '') + '</div>';
  const 캠 = Object.entries(L.캠페인 || {});
  if (캠.length) 안 += `<div class="판"><h3>광고 링크마다</h3><div class="표감싸기"><table><thead><tr><th>링크(utm_campaign)</th><th class="오">세션</th><th class="오">평균 스크롤</th></tr></thead><tbody>${캠.map(([이름, r]) => `<tr><td>${이스(이름)}</td><td class="오">${r.세션.toLocaleString('ko-KR')}</td><td class="오">${r.평균스크롤 ?? '—'}%</td></tr>`).join('')}</tbody></table></div></div>`;
  if (글?.랜딩) 안 += `<p>${글HTML(글.랜딩, 지표)}</p>`;
  return 안;
}

function 댓글칸(그림, 지표, 글, 상태, 표본) {
  const d = 그림.댓글;
  if (!d) return 못읽음(상태.댓글);
  let 안 = '';
  const 다른 = (d.장부 || []).filter((x) => x.플랫폼 !== 'youtube' && Number.isFinite(x.수));
  const 다른글 = 다른.length ? ` 인스타 · 페이스북 · 틱톡 댓글은 ${다른.reduce((n, x) => n + x.수, 0).toLocaleString('ko-KR')}개였는데, 글은 이번 판에서 읽지 않았어요.` : '';
  if (!d.줄.length) 안 += `<p class="못읽음">유튜브 댓글이 ${(지표['댓글.수']?.값 ?? 0).toLocaleString('ko-KR')}개라 주제를 나누지 않았어요.${이스(다른글)}</p>`;
  else {
    const 비율 = d.줄.some((r) => r.비율 !== null);
    안 += `<div class="판"><h3>댓글이 말한 것</h3><p class="작은글">유튜브 댓글 ${이스(값글(지표['댓글.수']))}를 주제로 나눴어요(한 댓글이 두 주제에 들 수 있어요).${비율 ? '' : ' 댓글이 적어 비율 대신 개수로 보여요.'}${이스(다른글)}</p>${빗금막대(d.줄.slice(0, 8).map((r) => ({ 이름: r.이름, 값: 비율 ? r.비율 : r.수, 메모: 비율 ? `${r.비율}% · ${r.수}개` : `${r.수}개`, 강조: false })), { 최대: Math.max(...d.줄.slice(0, 8).map((r) => (비율 ? r.비율 : r.수))), 이름표: '댓글 주제' })}</div>`;
  }
  const 원 = (키) => Object.values(표본?.댓글 || {}).flat().find((c) => c.키 === 키);
  const 예 = (글?.예시 || []).map((e) => { const c = 원(e.댓글); return c ? `<li>${이스(e.뜻)} <a href="https://www.youtube.com/shorts/${이스(c.영상)}" target="_blank" rel="noopener">좋아요 ${c.좋아요.toLocaleString('ko-KR')}</a></li>` : ''; }).filter(Boolean);
  if (예.length) 안 += `<div class="판"><h3>이런 말이 있었어요</h3><p class="작은글">원문 대신 뜻만 옮겼어요.</p><ul class="예시">${예.join('')}</ul></div>`;
  if (글?.댓글) 안 += `<p>${글HTML(글.댓글, 지표)}</p>`;
  return 안;
}

/** 본문 HTML(조각) */
function 본문({ 지표, 그림, 글, 글까닭 = null, 상태, 설정, 시점, 기준일, 표본, 지도들 = [] }) {
  const g = 글 || null;
  const 텍 = (s) => 글HTML(s, 지표);
  const 칸 = [];
  const 제목 = 설정.제목 || 설정.이름;
  칸.push(`<header class="머리" id="top"><span class="꼬리표">PULSE 광고 반응 리포트 · ${이스(시점)} · ${이스(기준일)} 기준</span>${설정.시험판 ? '<span class="시험판">시험판 — SYNK 자기 게시물로 도구를 시험한 판</span>' : ''}<h1>${이스(제목)} ${이스(시점)} 반응</h1>`
    + (g ? `<p class="한줄">${텍(g.한줄)}</p>` : `<p class="한줄">숫자만 담았어요. 해석 글은 이번엔 만들지 못했어요.</p><p class="작은글">까닭: ${이스(글까닭 || '모름')}</p>`)
    + `<p class="작은글">받는 사람: ${이스(설정.받는사람)}. 납품한 광고 ${(설정.광고 || []).length}편을 플랫폼 숫자 · 랜딩 · 댓글로 봤어요.</p></header>`);
  if (g) 칸.push(`<section class="넷" id="tiles" aria-label="핵심 숫자">${g.타일.map((t) => `<div class="판 타일"><span class="라벨">${이스(t.라벨)}</span><span class="큰수" title="${이스(`${지표[t.지표]?.출처 || ''} — ${지표[t.지표]?.설명 || ''}`)}">${이스(값글(지표[t.지표]))}</span><span class="작은글">${텍(t.설명)}</span></div>`).join('')}</section>`);
  칸.push(`<section class="칸" id="platform"><h2>얼마나 보였나</h2>${플랫폼칸(그림, 지표, g, 상태, 설정)}</section>`);
  칸.push(`<section class="칸" id="landing"><h2>랜딩에서 무엇을 했나</h2>${랜딩칸(그림, 지표, g, 상태, 설정, 지도들)}</section>`);
  칸.push(`<section class="칸" id="comments"><h2>무엇을 물었나</h2>${댓글칸(그림, 지표, g, 상태, 표본)}</section>`);
  if (g) {
    const 근거글 = (이름들) => {
      const 칩 = (이름들 || []).filter((n) => 지표[n]).map((n) => `<span title="${이스(`${지표[n].출처} — ${지표[n].설명}`)}">${이스(짧은이름(n, 지표[n]))} <b class="수">${이스(값글(지표[n]))}</b></span>`);
      return 칩.length ? `<p class="작은글">근거: ${칩.join(' · ')}</p>` : '';
    };
    const 셋 = g.바꿀셋 || [];
    const 제목 = 셋.length === 3 ? '다음 편에서 바꿀 셋' : '다음 편에서 바꿀 것';
    칸.push(`<section class="칸" id="next"><h2>${제목}</h2>${셋.length ? `<div class="셋">${셋.map((p) => `<article class="판 바꿀"><span class="어디">${이스(p.어디)}</span><h3>${텍(p.무엇)}</h3><p>${텍(p.왜)}</p><p class="어떻게">${텍(p.어떻게)}</p>${근거글(p.근거)}</article>`).join('')}</div>` : ''}`
      + (셋.length < 3 && g.덜낸까닭 ? `<p class="못읽음">${텍(g.덜낸까닭)}</p>` : '')
      + (g.지킬것?.무엇 ? `<div class="판"><h3>그대로 둘 것</h3><p>${텍(g.지킬것.무엇)}</p>${근거글(g.지킬것.근거)}</div>` : '') + '</section>');
  }
  // 안쪽 까닭 글(「…가 없다」)은 JSON에만 두고 페이지에는 짧은 상태만 — 읽는 사람 말로
  const 짧은상태 = (v) => (v === '됨' ? '읽음' : String(v).startsWith('됨') ? `읽음${String(v).slice(1)}` : String(v).split(':')[0].replace(/\(.*$/, '').trim());
  const 갈래말 = { 시청유지: '시청 유지' };
  const 상태줄 = Object.entries(상태).map(([k, v]) => { const 말 = 갈래말[k] || k, s = 짧은상태(v); return s.startsWith(말) ? s : `${말} ${s}`; }).join(' · ');
  const 낱말 = 지표['나누기.낱말로.댓글'] ? ` 자동 나누기가 안 된 댓글 ${값글(지표['나누기.낱말로.댓글'])}는 낱말 규칙으로 나눴어요.` : '';
  칸.push(`<section class="칸 방법" id="method"><h2>만든 방법과 한계</h2>`
    + '<p>플랫폼 숫자: SYNK 게시물은 회사 서버가 모은 숫자(게시 뒤 24시간 · 72시간 · 7일 판정, 4주는 서버 하루 숫자 가운데 게시 28일째에 가장 가까운 값). 평소 대비는 같은 계정 · 같은 형식에서 이 게시물 앞에 올린 최근 열두 편까지가 같은 나이에 낸 조회의 중앙값과 견준 배수이고(이 게시물은 뺌), 견줄 게시물이 네 편이 안 되면 뺐어요. 시청 유지는 플랫폼이 주는 칸만, 칸마다 그 칸이 있는 가장 늦은 판정에서 읽었고 일부는 플랫폼 어림값 · 게시 뒤 3일 창 · 화면에서 읽은 값이라 잰 날이 조회와 다를 수 있어요(표 괄호).</p>'
    + `<p>다음 편에서 바꿀 것은 「약한 신호」(평소보다 낮음 · 계정 안 하위 25% · 본 비율이나 앞 3초 유지가 ${글모듈.문턱.유지}% 아래 · 완주율 ${글모듈.문턱.완주율}% 아래 · 평균 스크롤 ${글모듈.문턱.스크롤}% 아래 · 막힌 신호 ${글모듈.문턱.막힘}% 넘음 · 헷갈림이나 불신 댓글)가 받칠 때만 냈어요. 문턱은 PULSE가 정한 어림이에요.</p>`
    + '<p>랜딩: Microsoft Clarity가 하루마다 주는 숫자(지난 24시간)를 받아 리포트 기간만큼 겹치지 않게 더했어요. 평균 스크롤 · 머문 시간은 세션 수로 가중한 평균이라, 끝까지 본 사람과 첫 화면만 본 사람이 섞여 있어요. 칸 위치는 우리가 쪽을 휴대폰 · PC 폭으로 열어 잰 지도예요.</p>'
    + `<p>댓글: 유튜브 댓글(채널 주인 댓글 뺌)을 주제로 나눴고, 예시는 원문 대신 뜻만 옮겼어요. 댓글 나누기와 이 페이지의 해석 글은 자동으로 만들어 틀릴 수 있어요.${이스(낱말)} 숫자는 모두 모은 자료에서 셌고, 굵은 숫자에 손을 대면 어디서 잰 숫자인지 보여요. 함께 움직인 숫자는 원인이 아니라 다음 편에서 시험해 볼 실마리예요.</p>`
    + `<p>자료 상태: ${이스(상태줄)}.</p></section>`);
  return `<div class="br">${칸.join('\n')}</div>`;
}

function 그리기(입력) {
  const 제목 = `${입력.설정.제목 || 입력.설정.이름} ${입력.시점} 반응 리포트`;
  const 몸 = 본문(입력);
  const 스타일 = `${브.스타일}${더스타일}`;
  const 조각 = `<title>${이스(제목)}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n${폰트.블록()}\n<style>${스타일}</style>\n${몸}\n`;
  const 문서 = `<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>${이스(제목)}</title>\n${폰트.블록()}\n<style>${스타일}</style>\n</head>\n<body>\n${몸}\n</body>\n</html>\n`;
  return { 문서, 조각 };
}

module.exports = { 그리기, 본문, 칸지도그림, 순위표, 곱절범위, 빗금막대 };
