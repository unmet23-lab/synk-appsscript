'use strict';
/**
 * 업종 반응 브리핑 · 그리기 — 지표 · 그림 자료 · 글로 한 장짜리 HTML을 만든다. 순수 함수(파일·네트워크 없음).
 * 그림은 인라인 SVG(스크립트 없음), 글자는 SUIT를 지면 안에 심는다(tools/lib/브랜드폰트.js). 밝음·어둠은 색 토큰으로.
 * 글의 {{지표}}는 값으로 채우고, 숫자에는 출처를 title로 붙인다. 자료를 못 읽은 칸은 「이번엔 못 읽음」으로 남긴다.
 * 돌려주는 것: {문서: 혼자 여는 HTML, 조각: 아티팩트에 올릴 본문(<html>·<head> 없이)}
 */
const 폰트 = require('../lib/브랜드폰트.js');
const { 채우기 } = require('./글.js');

const 이스 = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 이스케이프한 글에서 「~」 뒤에만 줄바꿈 자리 — 「11월 13일~12월 29일」이 낱말 가운데서 꺾이지 않게(10-31 Fable) */
const 범위꺾임 = (s) => 이스(s).replace(/~/g, '~<wbr>');

/** 지표 값 + 단위 → 보이는 글. 배수는 둘째 자리까지(0.98배를 「1배」로 보이면 평소보다 낮다는 글과 어긋난다 — 반응 리포트) */
function 값글(x) {
  if (!x) return '—';
  if (typeof x.값 !== 'number') return String(x.값);
  const 자리 = x.단위 === '배' ? 100 : 10;
  const n = Number.isInteger(x.값) ? x.값.toLocaleString('ko-KR') : (Math.round(x.값 * 자리) / 자리).toLocaleString('ko-KR');
  return `${n}${x.단위 || ''}`;
}

/**
 * 글(자리표시자 포함) → 이스케이프한 HTML, 숫자는 굵게 + 출처.
 * 자리표시자를 먼저 표식으로 바꾸고 이스케이프한 뒤 끼운다 — 지표 이름에 &·'가 있으면 이스케이프가 이름을 바꿔 「—」가 되던 것(10-30 Fable 설계 검토 12)
 */
function 글HTML(s, 지표) {
  const 끼울것 = [], 값들 = [];
  const 표식 = 채우기(String(s ?? '').replace(/\u0000/g, ''), 지표, (x) => { 값들.push(값글(x)); 끼울것.push(`<b class="수" title="${이스(`${x.출처} — ${x.설명}`)}">${이스(값글(x))}</b>`); return `\u0000${끼울것.length - 1}\u0000`; });
  // 글 쓰는 쪽은 값을 모르고 조사를 붙인다 — 값의 끝소리로 맞춘다(「94%이에요」 → 「94%예요」, 「239편를」 → 「239편을」, 10-31 아르곤)
  const 맞춘 = 표식.replace(/\u0000(\d+)\u0000(이에요|예요|이었|였|으로|로(?=[\s.,!?)·」』\u0000]|$)|[을를이가은는과와](?=[\s.,!?)·」』\u0000]|$))/g,
    (온, i, 조) => `\u0000${i}\u0000${조사맞춤(값들[Number(i)], 조)}`);
  return 이스(맞춘).replace(/\u0000(\d+)\u0000/g, (_, i) => 끼울것[Number(i)]);
}

/** 보이는 값의 끝소리 — 'ㄹ' · '있음' · '없음', 모르면 null. 숫자는 읽는 소리(끝이 0이면 십 · 백 · 천 · 만), %는 「퍼센트」 */
function 끝소리(글) {
  const t = String(글 ?? '').trim();
  const c = t[t.length - 1];
  if (!c) return null;
  const n = c.charCodeAt(0);
  if (n >= 0xAC00 && n <= 0xD7A3) { const j = (n - 0xAC00) % 28; return j === 0 ? '없음' : j === 8 ? 'ㄹ' : '있음'; }
  if (/[0-9]/.test(c)) return { 0: '있음', 1: 'ㄹ', 2: '없음', 3: '있음', 4: '없음', 5: '없음', 6: '있음', 7: 'ㄹ', 8: 'ㄹ', 9: '없음' }[c];
  if (c === '%') return '없음';
  return null;
}

/** 조사 하나를 값 끝소리에 맞춘 꼴로. 모르는 끝소리면 그대로 둔다 */
function 조사맞춤(값, 조) {
  const 끝 = 끝소리(값);
  if (!끝) return 조;
  const 받침 = 끝 !== '없음';
  const 짝 = { 을: ['을', '를'], 를: ['을', '를'], 이: ['이', '가'], 가: ['이', '가'], 은: ['은', '는'], 는: ['은', '는'], 과: ['과', '와'], 와: ['과', '와'], 이에요: ['이에요', '예요'], 예요: ['이에요', '예요'], 이었: ['이었', '였'], 였: ['이었', '였'] };
  if (조 === '으로' || 조 === '로') return 끝 === '있음' ? '으로' : '로';
  return 짝[조] ? 짝[조][받침 ? 0 : 1] : 조;
}

function 글너비(s, 크기) {
  let w = 0;
  for (const ch of String(s)) {
    if (/[ᄀ-ᇿ㄰-㆏가-힯一-鿿]/.test(ch)) w += 크기;
    else if (ch === ' ') w += 크기 * 0.3;
    else if (/[A-Z0-9%]/.test(ch)) w += 크기 * 0.62;
    else w += 크기 * 0.55;
  }
  return w;
}

/** 가로 막대: [{이름, 값, 메모, 강조}] — 값은 0~최대 */
function 가로막대(줄, { 최대, 기준선 = null, 너비 = 560, 이름표 = '' } = {}) {
  if (!줄.length) return '';
  const 크기 = 13, 칸높이 = 30;
  const 왼 = Math.ceil(Math.max(...줄.map((d) => 글너비(d.이름, 크기)))) + 12;
  const 오른 = Math.ceil(Math.max(...줄.map((d) => 글너비(d.메모, 크기)))) + 10;
  const 높이 = 줄.length * 칸높이 + 8;
  const 끝 = Math.max(왼 + 60, 너비 - 오른);
  const x = (v) => 왼 + (Math.max(0, v) / (최대 || 1)) * (끝 - 왼);
  const 막대 = 줄.map((d, i) => {
    const y = 4 + i * 칸높이;
    return `<text x="${왼 - 8}" y="${y + 19}" text-anchor="end" class="막대이름">${이스(d.이름)}</text>`
      + `<rect x="${왼}" y="${y + 7}" width="${Math.max(1, x(d.값) - 왼).toFixed(1)}" height="${칸높이 - 14}" rx="3" class="${d.강조 ? '막대 강조' : '막대'}"/>`
      + `<text x="${(x(d.값) + 6).toFixed(1)}" y="${y + 19}" class="${d.강조 ? '막대메모 강조글' : '막대메모'}">${이스(d.메모)}</text>`;
  }).join('');
  const 선 = 기준선 === null ? '' : `<line x1="${x(기준선).toFixed(1)}" x2="${x(기준선).toFixed(1)}" y1="2" y2="${높이 - 2}" class="기준선"/>`;
  return `<svg viewBox="0 0 ${너비} ${높이}" width="100%" role="img" aria-label="${이스(이름표)}">${막대}${선}</svg>`;
}

/**
 * 빗금 막대: [{이름, 값, 메모, 강조}] — 0부터 세는 양(비율 · 개수). 값은 0~최대, 넣은 순서대로.
 * 기준선(값)을 주면 줄마다 그 자리에 점선(평균 같은 기준). 표시 글은 이름 · 메모 그대로라 화면 읽기에도 읽힌다.
 */
function 빗금막대(줄, { 최대, 이름표 = '', 기준선 = null } = {}) {
  if (!줄.length) return '';
  const 위 = 최대 > 0 ? 최대 : 1;
  const 비 = (v) => Math.min(1, Math.max(0, Number(v) || 0) / 위).toFixed(4);
  const 선 = 기준선 === null || !Number.isFinite(Number(기준선)) ? '' : `<i class="빗기준" style="--기준:${비(기준선)}"></i>`;
  return `<div class="빗금표" role="list" aria-label="${이스(이름표)}">${줄.map((d) => `<div class="빗줄" role="listitem"><span class="빗이름">${이스(d.이름)}</span><span class="빗칸">${선}<span class="빗띠${d.강조 ? ' 강조' : ''}" style="--w:${비(d.값)}"></span><span class="빗값">${이스(d.메모)}</span></span></div>`).join('')}</div>`;
}

/** 주별 선 그래프: [{이름, 주들[{주, 값}], 정점[{다가올, 지난}]}] — 앞 묶음이 강조, 다가올 정점에 점과 날짜 */
function 선그래프(묶음들, { 너비 = 720, 높이 = 280, 시작 = null } = {}) {
  const 줄 = 묶음들.slice(0, 3).map((g) => ({ ...g, 주들: g.주들.filter((w) => !시작 || w.주 >= 시작) })).filter((g) => g.주들.length > 1);
  if (!줄.length) return '';
  const 여 = { 위: 34, 오른: 12, 아래: 26, 왼: 32 };
  const 모든날 = 줄[0].주들.map((w) => Date.parse(`${w.주}T00:00:00Z`));
  const [t0, t1] = [Math.min(...모든날), Math.max(...모든날)];
  const 최고 = Math.max(...줄.flatMap((g) => g.주들.map((w) => w.값)));
  const 위값 = Math.max(10, Math.ceil(최고 / 10) * 10);
  const x = (s) => 여.왼 + ((Date.parse(`${s}T00:00:00Z`) - t0) / Math.max(1, t1 - t0)) * (너비 - 여.왼 - 여.오른);
  const y = (v) => 높이 - 여.아래 - (v / 위값) * (높이 - 여.위 - 여.아래);
  const 눈금 = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(위값 * f));
  let 그림 = 눈금.map((v) => `<line x1="${여.왼}" x2="${너비 - 여.오른}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="격자"/><text x="${여.왼 - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="눈금">${v}</text>`).join('');
  // 가로 눈금: 석 달마다(좁으면 여섯 달) 1일
  const 간격 = 너비 < 560 ? 6 : 3;
  const d = new Date(t0); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1);
  while (d.getTime() <= t1) {
    if (d.getUTCMonth() % 간격 === 0) {
      const s = d.toISOString().slice(0, 10);
      그림 += `<text x="${x(s).toFixed(1)}" y="${높이 - 6}" text-anchor="middle" class="눈금">${String(d.getUTCFullYear()).slice(2)}.${d.getUTCMonth() + 1}</text>`;
    }
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  const 꼴 = ['선 첫째', '선 둘째', '선 나머지'];
  줄.slice().reverse().forEach((g) => {
    const i = 줄.indexOf(g);
    const 경로 = g.주들.map((w, k) => `${k ? 'L' : 'M'}${x(w.주).toFixed(1)},${y(w.값).toFixed(1)}`).join('');
    그림 += `<path d="${경로}" class="${꼴[i]}"/>`;
  });
  for (const p of 줄[0].정점 || []) {
    const w = p.다가올;
    if (!w || (시작 && w.주 < 시작)) continue;
    // 점 글이 왼쪽 눈금 글(여.왼 바깥)이나 오른쪽 끝에 닿으면 안쪽으로 붙인다 — 「70」과 「11/13」이 붙어 보이던 것(10-31)
    const 글 = `${Number(w.주.slice(5, 7))}/${Number(w.주.slice(8, 10))}`, 반 = 글너비(글, 12) / 2, cx = x(w.주);
    const [tx, 붙임] = cx - 반 < 여.왼 + 4 ? [여.왼 + 4, 'start'] : cx + 반 > 너비 - 2 ? [너비 - 2, 'end'] : [cx, 'middle'];
    그림 += `<circle cx="${cx.toFixed(1)}" cy="${y(w.값).toFixed(1)}" r="3.5" class="점"/><text x="${tx.toFixed(1)}" y="${(y(w.값) - 9).toFixed(1)}" text-anchor="${붙임}" class="점글">${글}</text>`;
  }
  let 범례 = '', lx = 여.왼;
  줄.forEach((g, i) => {
    범례 += `<rect x="${lx}" y="8" width="12" height="4" rx="2" class="범례 ${['첫째', '둘째', '나머지'][i]}"/><text x="${lx + 16}" y="14" class="범례글">${이스(g.이름)}</text>`;
    lx += 16 + 글너비(g.이름, 13) + 16;
  });
  return `<svg viewBox="0 0 ${너비} ${높이}" width="100%" role="img" aria-label="주별 검색 흐름">${그림}${범례}</svg>`;
}

const 스타일 = `
/* 결 — 상자 · 굵은 글씨 대신 크기 · 회색 · 얇은 선으로 위계를 만든다(10-31 유호님이 고른 리더보드 문법). 업종 브리핑 · 반응 리포트가 같이 쓴다.
   강조색은 PULSE 베리(--accent) 하나. 그래프는 docs/디자인/그래프_문법.md — 기준 대비는 편차 점, 0부터 세는 양은 빗금 막대. */
:root{--bg:#FFFFFF;--panel:#FFFFFF;--fg:#222326;--muted:#6B6F76;--line:#E8E8E6;--soft:#F5F5F3;--bar:#A3A6AC;--ink2:#55585E;--accent:#99295D;--accent-text:#99295D;--accent2:#3F5D8C;--quiet:#B9BCC2;--ref:#8A8F98;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#111215;--panel:#18191D;--fg:#EDEDEF;--muted:#A3A7AE;--line:#2A2B31;--soft:#18191D;--bar:#5E626A;--ink2:#A3A7AE;--accent:#C2457F;--accent-text:#F8C7DE;--accent2:#8FB0E6;--quiet:#4A4D55;--ref:#7C818A;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#111215;--panel:#18191D;--fg:#EDEDEF;--muted:#A3A7AE;--line:#2A2B31;--soft:#18191D;--bar:#5E626A;--ink2:#A3A7AE;--accent:#C2457F;--accent-text:#F8C7DE;--accent2:#8FB0E6;--quiet:#4A4D55;--ref:#7C818A;color-scheme:dark}
body{margin:0;background:var(--bg);color:var(--fg);font-family:'SUIT Variable','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;font-size:15px;line-height:1.65;-webkit-font-smoothing:antialiased}
.br{max-width:68rem;margin:0 auto;padding-block:40px 64px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:flex;flex-direction:column;gap:56px}
.br h1{font-size:clamp(28px,4.4vw,42px);line-height:1.15;font-weight:560;letter-spacing:-.03em;margin:0;text-wrap:balance}
.br h2{font-size:22px;font-weight:600;letter-spacing:-.015em;margin:0;padding-top:22px;border-top:1px solid var(--line);text-wrap:balance}
.br h3{font-size:16px;font-weight:600;margin:0;text-wrap:balance}
.br p{margin:0;max-width:66ch}
.머리{display:flex;flex-direction:column;gap:14px}
.꼬리표{font-size:13px;color:var(--accent-text);font-weight:600;letter-spacing:.02em}
.한줄{font-size:19px;line-height:1.6;max-width:58ch}
.작은글{font-size:13px;color:var(--muted);line-height:1.6}
.칸{display:flex;flex-direction:column;gap:18px}
.칸 > .작은글{max-width:72ch}
.격자판{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,19rem),1fr));gap:28px 40px}
.셋{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr));gap:28px}
.넷{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,9.5rem),1fr));gap:28px 20px}
@media (max-width:719px){.넷{grid-template-columns:repeat(2,minmax(0,1fr))}}
.판{display:flex;flex-direction:column;gap:10px;min-width:0}
.넷 > .타일,.셋 > .판{border-top:1px solid var(--line);padding-top:16px}
.타일 .큰수{font-size:34px;font-weight:500;letter-spacing:-.025em;line-height:1.15;font-variant-numeric:tabular-nums;color:var(--fg);word-break:keep-all}
.타일 .큰수.긴{font-size:26px;line-height:1.25}
.타일 .라벨{font-size:12.5px;font-weight:500;color:var(--muted)}
.가려움 h3{font-size:17px}
.예시{list-style:none;margin:4px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
.예시 li{font-size:14px;line-height:1.55;padding-left:12px;border-left:2px solid var(--line)}
.예시 a{color:var(--muted);font-size:12px;white-space:nowrap}
.제안 .때{align-self:flex-start;font-size:12px;font-weight:600;color:var(--accent-text)}
.수{font-weight:650;font-variant-numeric:tabular-nums;text-decoration:underline dotted var(--quiet);text-underline-offset:3px}
.표감싸기{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}
th,td{text-align:left;padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-size:12.5px;font-weight:500}
td.오,th.오{text-align:right;white-space:nowrap}
td a{color:inherit}
.정점표{word-break:keep-all} .정점표 th,.정점표 td:first-child{white-space:nowrap}
.낱말들{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,9.5rem),1fr));gap:14px}
.낱말들 ol{margin:6px 0 0;padding-left:22px;font-size:14px;display:grid;gap:2px}
.못읽음{font-size:14px;color:var(--muted);border-left:2px solid var(--line);padding:2px 0 2px 14px}
svg text{font-family:inherit}
.막대이름{font-size:13px;fill:var(--fg)}
.막대메모{font-size:13px;fill:var(--muted)}
.막대메모.강조글{fill:var(--fg);font-weight:700}
.막대{fill:var(--quiet)} .막대.강조{fill:var(--accent)}
.기준선{stroke:var(--ref);stroke-width:1;stroke-dasharray:4 3}
.격자{stroke:var(--line);stroke-width:1}
.눈금{font-size:12px;fill:var(--muted)}
/* 선 그래프 — 첫 묶음만 사업 색 2.25px, 둘째는 짙은 회색 · 나머지는 옅은 회색 1.5px(그래프 문법 「다른 꼴」) */
.선{fill:none;stroke-width:1.5;stroke-linejoin:round;stroke-linecap:round}
.선.첫째{stroke:var(--accent);stroke-width:2.25} .선.둘째{stroke:var(--ink2)} .선.나머지{stroke:var(--quiet)}
.범례.첫째{fill:var(--accent)} .범례.둘째{fill:var(--ink2)} .범례.나머지{fill:var(--quiet)}
.범례글{font-size:13px;fill:var(--fg)}
.점{fill:var(--accent)} .점글{font-size:12px;fill:var(--fg);font-weight:600}
.방법 p{font-size:13px;color:var(--muted);max-width:88ch}
a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
/* 휴대폰 — 선 그래프는 좁은 판용 판을 따로(글자가 화면 px 그대로), 큰 영상 표는 줄마다 두 줄 카드. 둘 다 판 폭으로 바꾼다 */
.선그림{container-type:inline-size} .선그림 svg{display:block} .선그림 .좁은{display:none}
@container (max-width:34rem){.선그림 .넓은{display:none} .선그림 .좁은{display:block}}
.튄감싸기{container-type:inline-size} .튄표 .붙임{display:none}
@container (max-width:36rem){
  .튄표,.튄표 tbody{display:block}
  .튄표 thead{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
  .튄표 tr{display:flex;flex-wrap:wrap;column-gap:12px;row-gap:3px;padding:10px 0;border-bottom:1px solid var(--line)}
  .튄표 td{display:block;padding:0;border:0;text-align:left;font-size:12.5px;color:var(--muted)}
  .튄표 td.제목칸{flex-basis:100%;font-size:14px;line-height:1.45;color:var(--fg);word-break:keep-all;overflow-wrap:anywhere}
  .튄표 td.오{text-align:left;white-space:nowrap}
  .튄표 .붙임{display:inline}
}
/* 0부터 세는 양 — 빗금 막대: 꽉 찬 면 대신 가는 사선 + 끝에만 단단한 선, 강조할 줄만 사업 색. 쌓기는 화면이 아니라 판 폭으로 */
.빗금표{display:flex;flex-direction:column;container-type:inline-size}
.빗줄{display:grid;grid-template-columns:minmax(6rem,11rem) minmax(0,1fr);align-items:center;column-gap:16px;min-height:38px;border-bottom:1px solid var(--line)}
.빗줄:first-child{border-top:1px solid var(--line)}
.빗이름{font-size:14px;line-height:1.4;overflow-wrap:anywhere}
.빗칸{position:relative;display:flex;align-items:center;gap:8px;min-width:0}
.빗띠{position:relative;flex:none;height:14px;width:max(2px,calc((100% - 6.5rem) * var(--w)));--색:var(--bar);background:repeating-linear-gradient(-45deg,var(--색) 0 1.2px,transparent 1.2px 4px);box-shadow:inset -2px 0 0 var(--색)}
.빗띠.강조{--색:var(--accent)}
.빗값{position:relative;padding:0 3px;margin-left:-3px;background:var(--bg);font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.빗기준{position:absolute;top:-9px;bottom:-9px;left:calc((100% - 6.5rem) * var(--기준));border-left:1px dashed var(--ref)}
@container (max-width:26rem){.빗줄{grid-template-columns:minmax(0,1fr);row-gap:4px;padding:8px 0} .빗기준{top:-3px;bottom:-3px}}
`;

function 못읽음(상태글) {
  return `<p class="못읽음">이번엔 이 자료를 읽지 못했어요. ${이스(상태글 || '')}</p>`;
}

/** 본문 HTML(조각) — 지표·그림·글·상태·설정·기준일 */
function 본문({ 지표, 그림, 글, 글까닭 = null, 상태, 설정, 기준일, 표본 }) {
  const g = 글 || null;
  const 텍 = (s) => 글HTML(s, 지표);
  const 칸 = [];
  칸.push(`<header class="머리" id="top"><span class="꼬리표">PULSE 업종 반응 브리핑 · ${이스(기준일)} 기준</span><h1>${이스(설정.업종)} 반응 브리핑</h1>`
    + (g ? `<p class="한줄">${텍(g.한줄)}</p>` : `<p class="한줄">숫자 요약만 담았어요. 해석 글은 이번엔 만들지 못했어요.</p><p class="작은글">까닭: ${이스(글까닭 || '모름')}</p>`)
    + `<p class="작은글">받는 사람: ${이스(설정.받는사람)}. 공개된 검색 · 쇼핑 · 영상 · 광고 자료만으로 만들었어요.</p></header>`);
  if (g) {
    칸.push(`<section class="넷" id="tiles" aria-label="핵심 숫자">${g.타일.map((t) => `<div class="판 타일"><span class="라벨">${이스(t.라벨)}</span><span class="큰수${[...값글(지표[t.지표])].length > 8 ? ' 긴' : ''}" title="${이스(`${지표[t.지표]?.출처 || ''} — ${지표[t.지표]?.설명 || ''}`)}">${범위꺾임(값글(지표[t.지표]))}</span><span class="작은글">${텍(t.설명)}</span></div>`).join('')}</section>`);
    // 예시는 자료에 있는 댓글만 — 좋아요 · 영상 주소는 자료에서 끌어온다(모르는 키는 버린다)
    const 예시글 = (e) => {
      const 원 = Object.values(표본?.댓글 || {}).flat().find((c) => c.키 === e.댓글);
      if (!원) return '';
      return `<li>${이스(e.뜻)} <a href="https://www.youtube.com/shorts/${이스(원.영상)}" target="_blank" rel="noopener">좋아요 ${원.좋아요.toLocaleString('ko-KR')}</a></li>`;
    };
    // 근거 지표를 값과 함께 늘 보인다 — 근거가 주장과 맞는지 사람이 볼 수 있게
    const 근거글 = (이름들) => {
      const 칩 = (이름들 || []).filter((n) => 지표[n]).map((n) => `<b class="수" title="${이스(`${지표[n].출처} — ${지표[n].설명}`)}">${이스(값글(지표[n]))}</b> ${이스(지표[n].설명)}`);
      return 칩.length ? `<p class="작은글">근거: ${칩.join(' · ')}</p>` : '';
    };
    칸.push(`<section class="칸" id="itches"><h2>고객이 가려워하는 곳 셋</h2><div class="셋">${g.가려운곳.map((it) => { const 예 = (it.예시 || []).map(예시글).filter(Boolean); return `<article class="판 가려움"><h3>${이스(it.질문)}</h3><p>${텍(it.설명)}</p>${예.length ? `<ul class="예시">${예.join('')}</ul>` : ''}${근거글(it.근거)}</article>`; }).join('')}</div></section>`);
  }
  // 누가 · 무엇을 찾나
  {
    const 쇼 = 그림.쇼핑;
    let 안 = '';
    if (쇼) {
      const 나이 = 쇼.나이.filter((a) => Number.isFinite(a.비중) && a.비중 > 0);
      const 강 = new Set([...나이].sort((a, b) => b.비중 - a.비중).slice(0, 2).map((a) => a.이름));
      const 막대 = 빗금막대(나이.map((a) => ({ 이름: a.이름, 값: a.비중, 메모: `${a.비중}%`, 강조: 강.has(a.이름) })), { 최대: Math.max(...나이.map((a) => a.비중)), 이름표: '연령별 클릭 비중' });
      const 보일 = 쇼.순위.filter((r) => (r.이름 === '이번 4주' || r.이름 === '최근 7일' || r.이름.startsWith('작년')) && r.낱말.length);
      안 += `<div class="격자판"><div class="판"><h3>${이스(설정.네이버?.분류?.이름 || '분야')}${조사맞춤(설정.네이버?.분류?.이름 || '분야', '를')} 누르는 나이</h3><p class="작은글">네이버 쇼핑인사이트, 최근 4주 클릭의 연령별 비중이에요. 네이버 쇼핑을 덜 쓰는 나이는 적게 잡힐 수 있어요.</p>${막대}</div>`
        + `<div class="판"><h3>지금 찾는 말, 다음에 찾을 말</h3><p class="작은글">네이버 쇼핑 인기 검색어예요.</p><div class="낱말들">${보일.map((r) => `<div><span class="작은글">${이스(r.이름)}</span><ol>${r.낱말.slice(0, 10).map((w) => `<li>${이스(w)}</li>`).join('')}</ol></div>`).join('')}</div></div></div>`;
      if (g?.누가) 안 += `<p>${텍(g.누가)}</p>`;
    } else 안 = 못읽음(상태.쇼핑);
    칸.push(`<section class="칸" id="who"><h2>누가 사고, 무엇을 찾나</h2>${안}</section>`);
  }
  // 언제
  {
    const 검 = 그림.검색;
    let 안 = '';
    if (검?.length) {
      const 시작 = (() => { const d = new Date(`${기준일}T00:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() - 3); return d.toISOString().slice(0, 10); })();
      안 += `<div class="판"><h3>${이스(검.slice(0, 3).map((x) => x.이름).join(' · '))} 검색, 주마다</h3><p class="작은글">네이버 검색어 트렌드${설정.네이버?.성별 === 'f' ? ', 여성' : 설정.네이버?.성별 === 'm' ? ', 남성' : ''}. 하루 값을 주 평균으로 묶었고, 기간 안 가장 높은 날을 100으로 둔 상대값이에요. 점은 해마다 지금부터 반년 안에서 「${이스(검[0].이름)}」 검색이 가장 높았던 주예요.</p><div class="선그림"><div class="넓은">${선그래프(검, { 시작 })}</div><div class="좁은">${선그래프(검, { 시작, 너비: 360, 높이: 240 })}</div></div></div>`;
      const 줄 = 검.map((x) => [x.이름, 지표[`검색.${x.이름}.지난정점`], 지표[`검색.${x.이름}.다가올정점`], 지표[`검색.${x.이름}.작년대비`]]);
      안 += `<div class="격자판"><div class="판"><h3>해마다 가장 높았던 주</h3><p class="작은글">지난 세 해, 지금 날짜를 가운데 두고 앞뒤 반년 안에서 가장 높았던 주의 범위예요.</p><div class="표감싸기"><table class="정점표"><thead><tr><th>검색어</th><th>지금 앞 반년</th><th>지금부터 반년</th><th class="오">작년 같은 주 대비</th></tr></thead><tbody>${줄.map(([이름, a, b, c]) => `<tr><td>${이스(이름)}</td><td>${범위꺾임(값글(a))}</td><td>${범위꺾임(값글(b))}</td><td class="오">${이스(값글(c))}</td></tr>`).join('')}</tbody></table></div></div>`
        + (g?.언제 ? `<div class="판"><h3>그래서</h3><p>${텍(g.언제)}</p></div>` : '') + '</div>';
    } else 안 = 못읽음(상태.검색);
    칸.push(`<section class="칸" id="when"><h2>언제 올릴까</h2>${안}</section>`);
  }
  // 무엇에 반응했나
  {
    const 영 = 그림.영상;
    let 안 = '';
    if (영) {
      const 전체 = 영.전체.튄비율;
      const 강조각도 = new Set(영.각도줄.filter((a) => a.튄비율 >= 전체 + 10).map((a) => a.이름));
      안 += `<p class="작은글">기간 안에 올라온 쇼츠 가운데 조회가 많은 ${이스(값글(지표['영상.편수']))}을 봤어요. 튄 영상은 그 채널이 평소 받는 조회의 세 배를 넘긴 영상이에요. 조회 많은 순으로 모은 표본이라 튄 비율은 실제보다 높게 나와요 — 각도끼리 견줄 때만 쓰세요.</p>`;
      안 += `<div class="격자판"><div class="판"><h3>영상 각도별로 튄 비율</h3><p class="작은글">제목으로 각도를 나눴어요(한 영상이 여러 각도에 들 수 있어요). 점선은 전체 평균 ${이스(값글(지표['영상.튄비율']))}.</p>${빗금막대(영.각도줄.map((a) => ({ 이름: a.이름, 값: a.튄비율, 메모: `${a.튄비율}% · ${a.편수}편`, 강조: 강조각도.has(a.이름) })), { 최대: 100, 기준선: 전체, 이름표: '영상 각도별 튄 비율' })}</div>`
        + `<div class="판"><h3>길이별로 튄 비율</h3><p class="작은글">점선은 전체 평균이에요.</p>${빗금막대(영.길이줄.map((a) => ({ 이름: a.이름, 값: a.튄비율, 메모: `${a.튄비율}% · ${a.편수}편`, 강조: a.튄비율 > 전체 })), { 최대: 100, 기준선: 전체, 이름표: '길이별 튄 비율' })}</div></div>`;
      if (g?.반응) 안 += `<p>${텍(g.반응)}</p>`;
      if (영.튄순.length) 안 += `<div class="판"><h3>가장 크게 튄 영상</h3><div class="표감싸기 튄감싸기"><table class="튄표" role="table"><thead role="rowgroup"><tr role="row"><th role="columnheader">영상</th><th role="columnheader">채널</th><th role="columnheader" class="오">구독</th><th role="columnheader" class="오">조회</th><th role="columnheader" class="오">평소의 몇 배</th><th role="columnheader" class="오">길이</th></tr></thead><tbody role="rowgroup">${영.튄순.map((v) => `<tr role="row"><td role="cell" class="제목칸"><a href="${이스(v.주소)}" target="_blank" rel="noopener">${이스(v.제목)}</a></td><td role="cell">${이스(v.채널)}</td><td role="cell" class="오"><span class="붙임">구독 </span>${v.구독 == null ? '—' : v.구독.toLocaleString('ko-KR')}</td><td role="cell" class="오"><span class="붙임">조회 </span>${v.조회.toLocaleString('ko-KR')}</td><td role="cell" class="오"><span class="붙임">평소의 </span>${v.배수}배</td><td role="cell" class="오">${v.길이}초</td></tr>`).join('')}</tbody></table></div></div>`;
    } else 안 = 못읽음(상태.영상);
    칸.push(`<section class="칸" id="react"><h2>무엇에 반응했나</h2>${안}</section>`);
  }
  // 경쟁 광고
  {
    const 광 = 그림.광고;
    let 안 = '';
    if (광) {
      const 위 = 광.slice(0, 8);
      안 += `<div class="격자판"><div class="판"><h3>광고 문구에 나온 말</h3><p class="작은글">메타 광고 라이브러리, 대한민국, 지금 게재 중, 노출 많은 순으로 읽은 광고 ${이스(값글(지표['광고.수']))}를 문구로 나눴어요.</p>${빗금막대(위.map((a) => ({ 이름: a.이름, 값: a.비율, 메모: `${a.비율}% · ${a.수}개`, 강조: false })), { 최대: Math.max(...위.map((a) => a.비율)), 이름표: '광고 문구 주제 비율' })}</div>`
        + (g?.광고 ? `<div class="판"><h3>읽은 것</h3><p>${텍(g.광고)}</p></div>` : '') + '</div>';
    } else 안 = 못읽음(상태.광고);
    칸.push(`<section class="칸" id="ads"><h2>경쟁 광고는 무엇을 말하나</h2>${안}</section>`);
  }
  if (g) {
    칸.push(`<section class="칸" id="pulse"><h2>PULSE가 만들 광고 셋</h2><div class="셋">${g.제안.map((p) => `<article class="판 제안"><span class="때">${이스(p.때)}</span><h3>${이스(p.이름)}</h3><p>${텍(p.무엇)}</p><p class="작은글">근거: ${텍(p.근거)}</p></article>`).join('')}</div></section>`);
  }
  const 상태줄 = Object.entries(상태).map(([k, v]) => `${k} ${v === '됨' ? '읽음' : String(v).startsWith('됨') ? `읽음${String(v).slice(1)}` : `못 읽음(${v})`}`).join(' · ');
  const 검색범위 = 지표['영상.읽은검색어수'] && 지표['영상.검색어수'] && 지표['영상.읽은검색어수'].값 < 지표['영상.검색어수'].값
    ? ` 유튜브 검색은 한도로 검색어 ${값글(지표['영상.검색어수'])} 가운데 ${값글(지표['영상.읽은검색어수'])}만 마쳐, 그만큼 표본이 치우쳤을 수 있어요.` : '';
  const 낱말 = ['댓글', '영상', '광고'].filter((k) => 지표[`나누기.낱말로.${k}`]).map((k) => `${k} ${값글(지표[`나누기.낱말로.${k}`])}`);
  const 낱말글 = 낱말.length ? ` 자동 나누기가 안 된 ${낱말.join(' · ')}는 낱말 규칙으로 나눴어요.` : '';
  칸.push(`<section class="칸 방법" id="method"><h2>만든 방법과 한계</h2>`
    + `<p>검색: 네이버 데이터랩 검색어 트렌드(하루 값을 주 평균으로, 기간 안 최댓값 100의 상대값). 쇼핑: 네이버 쇼핑인사이트 ${이스(설정.네이버?.분류?.이름 || '')} 분야(인기 검색어 · 연령 · 기기). 영상: 유튜브 검색어 ${(설정.유튜브?.검색어 || []).length}개로 찾은 쇼츠(3분 이하, 조회 ${Number(설정.유튜브?.최소조회 || 0).toLocaleString('ko-KR')} 이상), 평소 조회는 그 채널 최근 쇼츠 30편의 중앙값. 댓글: 그 쇼츠의 상위 댓글(채널 주인 댓글 뺌). 광고: 메타 광고 라이브러리 노출 순 위쪽.</p>`
    + `<p>댓글 · 제목 · 광고 문구를 주제로 나누는 일과 이 페이지의 해석 글은 자동으로 만들어 틀릴 수 있어요. 한 댓글이 여러 주제에 들 수 있어요.${이스(낱말글)}${이스(검색범위)}` + ' 숫자는 모두 모은 자료에서 셌고, 굵은 숫자에 손을 대면 어디서 잰 숫자인지 보여요. 댓글 예시는 원문 대신 뜻만 옮겼어요. 브랜드 자체 판매 자료가 아니어서, 계약 뒤에는 브랜드의 랜딩 페이지 반응과 광고 성과를 더해 다시 써요.</p>'
    + `<p>자료 상태: ${이스(상태줄)}.</p></section>`);
  return `<div class="br">${칸.join('\n')}</div>`;
}

function 그리기(입력) {
  const 제목 = `${입력.설정.업종} 반응 브리핑`;
  const 몸 = 본문(입력);
  const 조각 = `<title>${이스(제목)}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n${폰트.블록()}\n<style>${스타일}</style>\n${몸}\n`;
  const 문서 = `<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>${이스(제목)}</title>\n${폰트.블록()}\n<style>${스타일}</style>\n</head>\n<body>\n${몸}\n</body>\n</html>\n`;
  return { 문서, 조각 };
}

module.exports = { 그리기, 본문, 가로막대, 빗금막대, 선그래프, 값글, 글HTML, 글너비, 이스, 스타일, 끝소리, 조사맞춤 };
