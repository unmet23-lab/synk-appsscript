#!/usr/bin/env node
/**
 * 싱크타운 카페 0단계 시험의 「글 판」 그리기 (2026-10-31).
 * 화면 하나 = 블록 배열(아래 `블록` 꼴). 390×844 휴대폰 한 장으로 그려 JPEG로 찍는다(Playwright, 공용 작업본 node_modules).
 * 그림 자리는 회색 칸에 「[사진] …」 글로 둔다 — 글 판 시험은 화면 글과 짜임만 본다.
 *
 *   import { 화면찍기 } from './글판.mjs';
 *   await 화면찍기([{ 파일: '<밖>/정지컷_01.jpg', 블록: [...] }, ...]);
 *
 * 블록: { 꼴: '머리', 왼: '…', 오른: '…' } · { 꼴: '제목', 글 } · { 꼴: '작은글', 글 } · { 꼴: '카드', 이름, 글, 단추?: [] }
 *       { 꼴: '사진', 글 } · { 꼴: '그림', 파일, 높이? } · { 꼴: '대사', 누구, 글, 나?: true } · { 꼴: '고르기', 묻기, 칸: [{글, 고름}] }
 *       { 꼴: '하나고르기', 묻기, 칸: [{글, 고름}] } · { 꼴: '쪽지', 이름, 글, 단추?: [] } · { 꼴: '단추', 글: [] } · { 꼴: '칩줄', 글: [] }
 *       { 꼴: '쓰기', 묻기, 원문, 칸 } · { 꼴: '줄', 글 } (얇은 회색 줄 글) · { 꼴: '마스코트카드', 그림, 이름, 글 }
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const { 블록: 폰트블록 } = require(path.join(뿌리, 'tools', 'lib', '브랜드폰트.js'));
export const 공용 = 공용작업본(뿌리);
export const 밖뿌리 = process.env.TOWN_CAFE_OUT || path.join(공용, '.tmp', 'town-cafe-0-20261031');

const 이스 = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// 「…」 속 강조는 그대로 두고, ___ 는 빈칸으로 그린다.
const 글로 = (s) => 이스(s).replace(/___/g, '<span class="빈칸">　　　</span>').replace(/\n/g, '<br>');

function 그림주소(파일) {
  const b = fs.readFileSync(파일);
  const 꼴 = /\.png$/i.test(파일) ? 'image/png' : 'image/jpeg';
  return `data:${꼴};base64,${b.toString('base64')}`;
}

function 블록그리기(b) {
  switch (b.꼴) {
    case '머리': return `<div class="머리"><span>${글로(b.왼)}</span>${b.오른 ? `<span class="칩">${글로(b.오른)}</span>` : ''}</div>`;
    case '제목': return `<h1>${글로(b.글)}</h1>`;
    case '작은글': return `<p class="작은">${글로(b.글)}</p>`;
    case '줄': return `<p class="줄">${글로(b.글)}</p>`;
    case '카드': return `<div class="카드"><div class="카드이름">${글로(b.이름)}</div><div>${글로(b.글)}</div>${b.단추 ? `<div class="작은단추들">${b.단추.map((x) => `<span>${글로(x)}</span>`).join('')}</div>` : ''}</div>`;
    case '사진': return `<div class="사진" style="height:${b.높이 || 210}px"><span>[사진] ${글로(b.글)}</span></div>`;
    case '그림': return `<div class="그림" style="height:${b.높이 || 300}px;background-image:url('${그림주소(b.파일)}');background-position:${b.자리 || 'center 30%'}">${b.덮개 ? `<div class="덮개">${b.덮개}</div>` : ''}</div>`;
    case '대사': return `<div class="대사${b.나 ? ' 나' : ''}"><div class="누구">${글로(b.누구)}</div><div class="말">${글로(b.글)}</div>${b.단추 ? `<div class="작은단추들">${b.단추.map((x) => `<span>${글로(x)}</span>`).join('')}</div>` : ''}</div>`;
    case '고르기': return `<div class="묻기">${글로(b.묻기)}</div><div class="칩들">${b.칸.map((c) => `<span class="고칩${c.고름 ? ' 골랐음' : ''}">${c.고름 ? '✓ ' : ''}${글로(c.글)}</span>`).join('')}</div>`;
    case '하나고르기': return `<div class="묻기">${글로(b.묻기)}</div><div class="한줄들">${b.칸.map((c) => `<div class="한줄${c.고름 ? ' 골랐음' : ''}"><span class="동그라미">${c.고름 ? '●' : '○'}</span>${글로(c.글)}</div>`).join('')}</div>`;
    case '쪽지': return `<div class="쪽지"><div class="쪽지이름">${b.소리 ? '▷ ' : ''}${글로(b.이름)}</div><div>${글로(b.글)}</div>${b.단추 ? `<div class="단추들">${b.단추.map((x, i) => `<span class="${i === 0 ? '진한' : '연한'}">${글로(x)}</span>`).join('')}</div>` : ''}</div>`;
    case '단추': return `<div class="단추들 큰">${b.글.map((x, i) => `<span class="${i === 0 ? '진한' : '연한'}">${글로(x)}</span>`).join('')}</div>`;
    case '작은단추': return `<div class="작은단추들">${b.글.map((x) => `<span>${글로(x)}</span>`).join('')}</div>`;
    case '칩줄': return `<div class="칩줄">${b.글.map((x) => `<span>${글로(x)}</span>`).join('')}</div>`;
    case '쓰기': return `<div class="묻기">${글로(b.묻기)}</div><div class="원문">${글로(b.원문)}</div><div class="쓰기칸">${글로(b.칸)}</div>`;
    case '마스코트카드': return `<div class="마카"><img src="${그림주소(b.그림)}" alt=""><div><div class="카드이름">${글로(b.이름)}</div><div>${글로(b.글)}</div></div></div>`;
    case '메모카드': return `<div class="메모"><div class="메모이름">${글로(b.이름)}</div><div>${글로(b.글)}</div></div>`;
    default: throw new Error('모르는 블록: ' + b.꼴);
  }
}

export function 화면HTML(블록들, { 어둠 = false } = {}) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=390">${폰트블록()}
<style>
:root{--바탕:${어둠 ? '#14161a' : '#f6f5f2'};--글:${어둠 ? '#f1efe9' : '#1d1d1f'};--흐림:${어둠 ? '#a4a39d' : '#6b6a66'};--칸:${어둠 ? '#22252b' : '#ffffff'};--줄:${어둠 ? '#33363d' : '#e3e1db'};--진:${어둠 ? '#f1efe9' : '#1d1d1f'};--진글:${어둠 ? '#14161a' : '#ffffff'};}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:390px;height:844px;overflow:hidden;background:var(--바탕);color:var(--글);font-family:'SUIT Variable','SUIT','Segoe UI Symbol','Segoe UI','Malgun Gothic',sans-serif;font-size:15px;line-height:1.5;letter-spacing:-0.01em}
.판{padding:14px 16px 16px;display:flex;flex-direction:column;gap:10px;height:844px}
.머리{display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700;color:var(--흐림);padding-bottom:4px;border-bottom:1px solid var(--줄)}
.칩{font-size:12px;font-weight:700;color:var(--글);background:var(--칸);border:1px solid var(--줄);border-radius:999px;padding:3px 10px}
h1{font-size:21px;line-height:1.3;font-weight:800;margin-top:2px}
.작은{font-size:12.5px;color:var(--흐림)}
.줄{font-size:12.5px;color:var(--흐림);padding:6px 10px;border:1px dashed var(--줄);border-radius:10px}
.카드{background:var(--칸);border:1px solid var(--줄);border-radius:14px;padding:10px 12px;font-size:14px}
.카드이름,.쪽지이름,.메모이름{font-size:12px;font-weight:800;color:var(--흐림);margin-bottom:2px}
.작은단추들{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}.작은단추들 span{font-size:12px;border:1px solid var(--줄);border-radius:999px;padding:2px 9px;color:var(--흐림)}
.사진{border-radius:14px;background:repeating-linear-gradient(135deg,${어둠 ? '#2a2d33' : '#dedcd5'} 0 10px,${어둠 ? '#262930' : '#e6e4de'} 10px 20px);display:flex;align-items:center;justify-content:center;padding:16px;text-align:center;font-size:14px;color:var(--흐림);font-weight:600}
.그림{border-radius:14px;background-size:cover;position:relative;overflow:hidden;flex:none}
.덮개{position:absolute;left:0;right:0;bottom:0;padding:28px 12px 10px;background:linear-gradient(transparent,rgba(0,0,0,.72));color:#fff;font-size:15px;font-weight:700;line-height:1.4}
.덮개 small{display:block;font-size:11.5px;font-weight:600;opacity:.75;margin-bottom:2px}
.대사{background:var(--칸);border:1px solid var(--줄);border-radius:14px;padding:9px 12px}
.대사.나{border:2px solid var(--진)}
.누구{font-size:12px;font-weight:800;color:var(--흐림)}
.말{font-size:15px;font-weight:600}
.빈칸{display:inline-block;min-width:64px;border-bottom:2px solid var(--진);margin:0 2px}
.묻기{font-size:13.5px;font-weight:800;margin-top:2px}
.칩들{display:flex;flex-wrap:wrap;gap:6px}
.고칩{font-size:13px;border:1px solid var(--줄);background:var(--칸);border-radius:999px;padding:5px 11px}
.고칩.골랐음{border:2px solid var(--진);font-weight:800}
.한줄들{display:flex;flex-direction:column;gap:5px}
.한줄{font-size:13.5px;background:var(--칸);border:1px solid var(--줄);border-radius:10px;padding:6px 10px;display:flex;gap:8px}
.한줄.골랐음{border:2px solid var(--진);font-weight:700}
.쪽지{background:${어둠 ? '#2b2a24' : '#fff8e6'};border:1px solid ${어둠 ? '#4a4636' : '#eedfb4'};border-radius:14px;padding:10px 12px;font-size:14px}
.단추들{display:flex;gap:8px;margin-top:8px}
.단추들 span{flex:1;text-align:center;border-radius:12px;padding:9px 0;font-weight:800;font-size:14px}
.단추들.큰{margin-top:auto}
.단추들 .진한{background:var(--진);color:var(--진글)}
.단추들 .연한{background:var(--칸);border:1px solid var(--줄)}
.칩줄{display:flex;gap:6px;flex-wrap:wrap}.칩줄 span{font-size:12.5px;background:var(--칸);border:1px solid var(--줄);border-radius:8px;padding:3px 8px}
.원문{font-size:14px;color:var(--흐림);text-decoration:line-through}
.쓰기칸{font-size:15px;background:var(--칸);border:2px solid var(--진);border-radius:10px;padding:8px 10px}
.마카{display:flex;gap:10px;align-items:center;background:var(--칸);border:1px solid var(--줄);border-radius:14px;padding:8px 12px 8px 8px;font-size:14px}
.마카 img{width:72px;height:72px;object-fit:cover;border-radius:12px;flex:none}
.메모{background:#fffdf3;color:#2a2722;border:1px solid #e7dfc4;border-radius:4px;padding:10px 12px;font-size:14px;box-shadow:0 1px 0 #e7dfc4,2px 3px 0 rgba(0,0,0,.05);transform:rotate(-0.6deg)}
.메모이름{color:#7a705c}
</style></head><body><div class="판">${블록들.map(블록그리기).join('\n')}</div></body></html>`;
}

export async function 화면찍기(목록, { 어둠 = false } = {}) {
  const { chromium } = require(path.join(공용, 'node_modules', 'playwright'));
  let 브라우저;
  try { 브라우저 = await chromium.launch({ channel: 'chrome', headless: true }); } catch { 브라우저 = await chromium.launch({ headless: true }); }
  try {
    const 맥락 = await 브라우저.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR' });
    const 쪽 = await 맥락.newPage();
    for (const { 파일, 블록, html } of 목록) {
      await 쪽.setContent(html || 화면HTML(블록, { 어둠 }), { waitUntil: 'load' });
      await 쪽.evaluate(() => document.fonts.ready);
      // 넘침 확인: 판 안의 마지막 블록이 화면 밖으로 나가면 알린다
      const 넘침 = await 쪽.evaluate(() => { const p = document.querySelector('.판'); return p ? p.scrollHeight - 844 : 0; });
      if (넘침 > 0) console.warn(`[글판] ${path.basename(파일)} 아래로 ${넘침}px 넘침`);
      fs.mkdirSync(path.dirname(파일), { recursive: true });
      await 쪽.screenshot({ path: 파일, type: 'jpeg', quality: 88 });
    }
  } finally {
    await 브라우저.close();
  }
}
