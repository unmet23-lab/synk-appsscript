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

const { 이스, 값글, 글HTML, 가로막대 } = 브;

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
.좁은그림{max-width:36rem}
.칸지도 text.칸위{font-size:11px}
`;

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
  return 짧게(지표?.설명 || 이름, 24);
}

const 유지칸 = [['앞3초유지', '앞 3초 유지'], ['본비율', '본 비율'], ['평균시청', '평균 시청'], ['평균조회율', '평균 조회율'], ['완주율', '완주율']];

function 플랫폼칸(그림, 지표, 글, 상태, 설정) {
  const p = 그림.플랫폼;
  if (!p) return 못읽음(상태.플랫폼);
  const 광고이름 = (키) => (설정.광고 || []).find((a) => a.키 === 키)?.이름 || 키;
  let 안 = '';
  if (p.막대.length) {
    const 최대 = Math.max(2, ...p.막대.map((b) => b.배수));
    안 += `<div class="판"><h3>평소와 견주면</h3><p class="작은글">같은 계정에서 앞서 올린 게시물들이 같은 나이에 낸 조회의 중앙값을 1로 두고 견준 배수예요. 점선이 평소(1배)예요. 견줄 게시물이 넉넉하지 않은 곳은 뺐어요.</p><div class="좁은그림">${가로막대(p.막대.map((b) => ({ 이름: `${광고이름(b.광고)} · ${플랫폼.플랫폼이름[b.플랫폼] || b.플랫폼}`, 값: b.배수, 메모: `${b.배수}배`, 강조: b.배수 > 1 })), { 최대, 기준선: 1, 너비: 420, 이름표: '게시물별 평소 대비 배수' })}</div></div>`;
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
    + (신호.length ? `<div class="판"><h3>막힌 신호</h3><p class="작은글">그 신호가 한 번이라도 나온 세션의 비율이에요.</p>${가로막대(신호.map(([k, 이름]) => ({ 이름, 값: 지표[k].값, 메모: `${지표[k].값}%`, 강조: false })), { 최대: Math.max(10, ...신호.map(([k]) => 지표[k].값)), 이름표: '막힌 신호 비율' })}</div>` : '') + '</div>';
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
    안 += `<div class="판"><h3>댓글이 말한 것</h3><p class="작은글">유튜브 댓글 ${이스(값글(지표['댓글.수']))}을 주제로 나눴어요(한 댓글이 두 주제에 들 수 있어요).${비율 ? '' : ' 댓글이 적어 비율 대신 개수로 보여요.'}${이스(다른글)}</p>${가로막대(d.줄.slice(0, 8).map((r) => ({ 이름: r.이름, 값: 비율 ? r.비율 : r.수, 메모: 비율 ? `${r.비율}% · ${r.수}개` : `${r.수}개`, 강조: false })), { 최대: Math.max(...d.줄.slice(0, 8).map((r) => (비율 ? r.비율 : r.수))), 이름표: '댓글 주제' })}</div>`;
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
  const 상태줄 = Object.entries(상태).map(([k, v]) => `${k} ${v === '됨' ? '읽음' : String(v).startsWith('됨') ? `읽음${String(v).slice(1)}` : `— ${v}`}`).join(' · ');
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

module.exports = { 그리기, 본문, 칸지도그림 };
