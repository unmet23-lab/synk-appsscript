#!/usr/bin/env node
// 뼈대 시안 비교 쪽(claude.ai 페이지용 한 장)을 낸다(2026-11-10).
//   node 비교쪽_만들기.mjs <화면 그림 폴더> <공개본 잰 폴더> <시안 잰 폴더> <낼 HTML>
//     화면 그림 폴더: 시안/찍기.cjs로 찍은 jpg(비교쪽_원고.html의 {{img:파일}})
//     잰 폴더: ../synk.im_전체판단_20261110/재기/찍기.cjs가 낸 <이름>-<d|m>.json · .txt (공개본 home · shift / 시안 ga · na · shift)
//   맹검 점수는 비교쪽_맹검.json(아르곤 답에서 옮겨 적은 것)에서 읽는다. 낸 HTML에는 `node tools/lib/브랜드폰트.js --심기 <낸 HTML>`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const [그림폴더, 공개잰, 시안잰, 낼곳] = process.argv.slice(2);
if (!낼곳) { console.error('쓰기: node 비교쪽_만들기.mjs <화면 그림 폴더> <공개본 잰 폴더> <시안 잰 폴더> <낼 HTML>'); process.exit(1); }
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const 그림 = f => `data:image/jpeg;base64,${fs.readFileSync(path.join(그림폴더, f)).toString('base64')}`;
let html = fs.readFileSync(path.join(여기, '비교쪽_원고.html'), 'utf8');

// 바꿔 보기: 단추마다 그림 한 장씩만 싣는다(같은 그림을 두 번 싣지 않는다)
html = html.replace(/<div class="flip" data-flip>\n<div class="flip-tabs"([^>]*)>([\s\S]*?)<\/div>\n<div class="flip-stage( phone)?"><img src="[^"]*" alt="([^"]*)" data-flip-img><\/div>\n<p data-flip-note>[\s\S]*?<\/p>\n<\/div>/g, (_, 속성, 단추들, 폰, alt) => {
  const 단추 = [...단추들.matchAll(/<button type="button" aria-pressed="(true|false)" data-src="\{\{img:([^}]+)\}\}" data-note="([^"]*)">([^<]*)<\/button>/g)].map(m => ({ 켬: m[1] === 'true', 파일: m[2], 글: m[3], 이름: m[4] }));
  if (!단추.length) throw new Error('바꿔 보기 단추를 못 읽음');
  return `<div class="flip" data-flip>\n<div class="flip-tabs"${속성}>${단추.map((b, i) => `<button type="button" aria-pressed="${b.켬}" data-i="${i}">${b.이름}</button>`).join('')}</div>\n<div class="flip-stage${폰 || ''}">${단추.map((b, i) => `<img src="${그림(b.파일)}" alt="${alt} — ${b.이름}" data-i="${i}"${b.켬 ? '' : ' hidden'}>`).join('')}</div>\n${단추.map((b, i) => `<p data-i="${i}"${b.켬 ? '' : ' hidden'}>${b.글}</p>`).join('')}\n</div>`;
});
html = html.replace(/\{\{img:([^}]+)\}\}/g, (_, f) => 그림(f));
html = html.replace("for (const b of btns) b.addEventListener('click', () => {\n    for (const x of btns) x.setAttribute('aria-pressed', String(x === b));\n    img.src = b.dataset.src; if (note) note.innerHTML = b.dataset.note || '';\n  });", "for (const b of btns) b.addEventListener('click', () => {\n    for (const x of btns) x.setAttribute('aria-pressed', String(x === b));\n    for (const e of box.querySelectorAll('.flip-stage img, p[data-i]')) e.hidden = e.dataset.i !== b.dataset.i;\n  });");
html = html.replace('{{서체}}', "'SUIT Variable','Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif");

// 잰 값
const 읽기 = (폴더, 이름, m) => { const j = JSON.parse(fs.readFileSync(path.join(폴더, `${이름}-${m}.json`), 'utf8')); const t = fs.readFileSync(path.join(폴더, `${이름}-${m}.txt`), 'utf8'); return { ...j.잰값, 화면: j.전체화면수, 준비중: (t.match(/준비 중|준비하고 있/g) || []).length }; };
const 쪽 = [['공개본 홈', 공개잰, 'home'], ['판 가', 시안잰, 'ga'], ['판 나', 시안잰, 'na'], ['공개본 SHIFT', 공개잰, 'shift'], ['시안 SHIFT', 시안잰, 'shift']].map(([이름, 폴더, 키]) => ({ 이름, d: 읽기(폴더, 키, 'd'), m: 읽기(폴더, 키, 'm'), 공개: 폴더 === 공개잰 }));
const 줄 = (이름, 관문, 값, 넘음) => `<tr><th>${이름}</th><td class="ref">${관문}</td>${쪽.map(p => { const v = 값(p); const 판정 = 넘음 ? (넘음(v) ? 'ok' : 'no') : ''; return `<td class="n ${p.공개 ? 'ref' : 판정}">${v}</td>`; }).join('')}</tr>`;
const 표 = `<div class="tablebox"><table><thead><tr><th></th><th class="ref">관문</th>${쪽.map(p => `<th class="n${p.공개 ? ' ref' : ''}">${p.이름}</th>`).join('')}</tr></thead><tbody>
${줄('글자 크기 단계', '8 안', p => p.d.크기단계, v => v <= 8)}
${줄('글자 굵기 가짓수', '4 안', p => Object.keys(p.d.굵기).length, v => v <= 4)}
${줄('쪽 길이 · 컴퓨터(화면)', '7 안', p => p.d.화면, v => v <= 7)}
${줄('쪽 길이 · 휴대폰(화면)', '10 안', p => p.m.화면, v => v <= 10)}
${줄('「준비 중 · 준비하고 있」', '맨 아래 한 묶음', p => p.d.준비중, v => v <= 1)}
${줄('영문 대문자 글 덩어리', '꼬리표 0', p => p.d.영문대문자)}
${줄('모노 글꼴 글 덩어리', '시각 · 숫자만', p => p.d.모노)}
${줄('글자 수', '—', p => p.d.글자.toLocaleString('en-US'))}
${줄('첫 화면에서 누를 수 있는 것', '—', p => p.d.첫화면.누를것.length)}
</tbody></table></div>`;
html = html.replace('{{잰값}}', 표);

const 맹 = JSON.parse(fs.readFileSync(path.join(여기, '비교쪽_맹검.json'), 'utf8'));
html = html.replace('{{잰값주}}', esc(맹.잰값주 || ''));
html = html.replace('{{추천입구}}', 맹.추천입구 || '');
const 칸 = v => Array.isArray(v) ? `<td class="${v[1] || ''}">${v[0]}</td>` : `<td>${v}</td>`;
const 맹표 = (머리, 행) => `<div class="tablebox"><table><thead><tr>${머리.map((h, i) => `<th${i === 1 ? ' class="ref"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${행.map(r => `<tr><th>${r[0]}</th><td class="ref">${r[1]}</td>${r.slice(2).map(칸).join('')}</tr>`).join('')}</tbody></table></div>`;
html = html.replace('{{요약표}}', 맹.요약 ? 맹표(맹.요약.머리, 맹.요약.행) : '');
// 2단계(11-10 밤): 일곱 쪽의 길이 표 · 「다음」 목록도 맹검 파일에서 읽는다
html = html.replace('{{쪽길이}}', 맹.쪽길이 ? 맹표(맹.쪽길이.머리, 맹.쪽길이.행) : '');
html = html.replace('{{다음}}', (맹.다음 || []).map(x => `<li>${x}</li>`).join('\n'));
// 표들: [{ 제목?, 글?, 머리, 행 }] — 회차마다 한 묶음. (옛 꼴 홈 · 사업 두 표도 읽는다)
const 표들 = 맹.표들 || [맹.홈, 맹.사업].filter(Boolean);
html = html.replace('{{맹검}}', [...표들.map(t => (t.제목 ? `<div class="col"><h3>${t.제목}</h3>${t.글 ? `<p class="mid">${t.글}</p>` : ''}</div>\n` : '') + 맹표(t.머리, t.행)), `<div class="col">${(맹.읽은것 || []).map(p => `<p>${p}</p>`).join('')}${(맹.인용 || []).map(q => `<blockquote>${q}</blockquote>`).join('')}<p class="small">${맹.주 || ''}</p></div>`].join('\n'));

const 남음 = html.match(/\{\{[^}]{1,40}\}\}/g);
if (남음) throw new Error('안 채운 자리: ' + [...new Set(남음)].join(' '));
fs.writeFileSync(낼곳, html);
console.log(path.basename(낼곳), (Buffer.byteLength(html) / 1048576).toFixed(2) + 'MB');
