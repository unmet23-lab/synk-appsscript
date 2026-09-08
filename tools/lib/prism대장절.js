'use strict';
/* Prism 접점 대장 절 — 산출 행·완비/전체·거절/전체는 외부 JSONL을 prism계약.검증으로 잰다.
 * 학생·학부모 접점 참조와 등록 소비자는 prism래칫.검사의 셈에서 온다(범위·참조 수도 함께 낸다).
 * 「못 쟀다」를 0으로 채우면 안 읽은 자료가 안전한 것처럼 보이므로 미측정과 실제 0을 가른다.
 * 산출 정본은 이 저장소가 아니라 비공개 버킷이다(설계 §8-5). 환경변수로 받은 파일만 읽는다.
 * 원문·행의 값은 HTML에 싣지 않고, 검증 결과의 수와 사유만 돌려준다.
 * 색은 이해대장의 킷에서 만든 CSS 변수만 쓴다.
 */

const fs = require('node:fs');
const path = require('node:path');
const 래칫 = require('../prism래칫.js');
const 계약 = require('./prism계약.js');

const esc = (값) => String(값).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const 경고 = (글) => `<b style="color:var(--coral3)">${글}</b>`;

function 래칫줄(루트) {
  const 결과 = 래칫.검사({ 루트 });
  const 셈 = 결과.셈;
  if (셈 === null) {
    return `<div class="prism줄 경고">${경고('⚠ 못 쟀다')} — 접점 참조를 확인하지 못했다. `
      + '「참조가 없다」는 뜻이 아니라 「안 재봤다」이다.'
      + `<p class="잔글">${결과.출력.map(esc).join('<br>')}</p></div>`;
  }
  const 수 = `범위 파일 ${셈.범위파일수} · 참조 ${셈.참조수} · 등록 소비자 ${셈.등록소비자수} · 학생·학부모 참조 ${셈.학생학부모참조수}`;
  if (결과.종료코드 === 1) {
    // 출력의 마지막 요약은 셈으로 그린다. 앞의 잡힌 자리들은 파싱 없이 그대로 이스케이프한다.
    const 자리들 = 결과.출력.slice(0, -1).map((줄) => `<li><code>${esc(줄)}</code></li>`).join('');
    return `<div class="prism줄 경고">${경고('⚠ 금지·미등록 참조가 있다')}<p>${수}</p>`
      + `<ul>${자리들}</ul></div>`;
  }
  return `<div class="prism줄 통과"><b>접점 참조 검사</b><p>${수}</p></div>`;
}

function 산출줄() {
  const 파일 = process.env.SYNK_PRISM_산출;
  if (!파일) {
    return `<div class="prism줄">${경고('⚠ 안 재봤다')} — 산출 장부가 이 저장소에 없다. `
      + '정본은 비공개 버킷이다(설계 §8-5).</div>';
  }
  let 내용;
  try { 내용 = fs.readFileSync(파일, 'utf8'); }
  catch (_) {
    return `<div class="prism줄 경고">${경고('⚠ 못 쟀다')} — 산출 장부를 읽을 수 없다: <code>${esc(파일)}</code></div>`;
  }
  const 줄들 = 내용.split(/\r\n|[\n\r]/).filter((줄) => 줄.trim() !== '');
  const 입력 = 줄들.length;
  if (입력 === 0) {
    return '<div class="prism줄"><b>산출 0행</b> — 아직 아무것도 안 들어왔다(초록이 아니다).</div>';
  }
  let 완비 = 0;
  const 사유셈 = new Map();
  for (const 줄 of 줄들) {
    let 행;
    try { 행 = JSON.parse(줄); }
    catch (_) {
      사유셈.set('줄깨짐', (사유셈.get('줄깨짐') || 0) + 1);
      continue;
    }
    const 결과 = 계약.검증(행);
    if (결과.통과) 완비++;
    else for (const 사유 of 결과.사유) 사유셈.set(사유, (사유셈.get(사유) || 0) + 1);
  }
  const 거절 = 입력 - 완비;
  const 사유들 = [...사유셈].sort((a, b) => b[1] - a[1])
    .map(([사유, 수]) => `<li>${esc(사유)} ${수}/${거절}</li>`).join('');
  return `<div class="prism줄${거절 ? ' 경고' : ' 통과'}"><b>산출 ${입력}행 · 입력 ${입력}</b>`
    + `<p>완비 ${완비}/${입력} · 거절 ${거절}/${입력}</p>`
    + (거절 ? '<p class="잔글">거절 사유 — 거절 행 기준, 한 행에 여러 사유가 붙을 수 있다.</p>'
      + `<ul>${사유들}</ul>` : '') + '</div>';
}

function 절({ 루트 = path.resolve(__dirname, '../..') } = {}) {
  return `<div class="prism접점">${래칫줄(루트)}\n${산출줄()}</div>`;
}

module.exports = { 절 };
