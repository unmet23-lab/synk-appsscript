#!/usr/bin/env node
// synk.im 전체 판단(2026-11-10) — 리라이팅.json을 리라이팅.md(저장소용)와 보고 쪽 HTML(claude.ai 페이지용)로 낸다.
//   node 만들기.mjs                         리라이팅.md만 다시 쓴다
//   node 만들기.mjs <그림 폴더> <낼 HTML> [맹검 조각.html]
//       쪽_원고.html의 {{img:파일}} · {{서체}} · {{원칙}} · {{리라이팅}} · {{맹검}}을 채운다(서체 이름을 원고에 적지 않는 것은 지면폰트 시험이 원고를 「이름만 부르는 지면」으로 잡지 않게 하려는 것). 그림은 재기/찍기.cjs가 낸 out 폴더.
//       낸 HTML에는 `node tools/lib/브랜드폰트.js --심기 <낸 HTML>`로 서체를 심는다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 자료 = JSON.parse(fs.readFileSync(path.join(여기, '리라이팅.json'), 'utf8'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const 줄 = s => String(s).replace(/\n/g, '<br>');

// 저장소용 마크다운
const md = [`# synk.im 글 리라이팅 — 지금 → 제안 (${자료.기준일})`, '', `> ${자료.설명} 이 파일은 \`리라이팅.json\`에서 \`node 만들기.mjs\`로 만든다 — 고칠 때는 json을 고친다.`, '', '## 고쳐 쓴 원칙', '', ...자료.원칙.map((w, i) => `${i + 1}. ${w}`), ''];
for (const 쪽 of 자료.쪽) {
  md.push(`## ${쪽.이름}`, '', '| 자리 | 지금 | 제안 | 까닭 | 상태 |', '|---|---|---|---|---|');
  for (const r of 쪽.행) md.push(`| ${[r.자리, r.지금, r.제안, r.까닭, r.상태].map(c => String(c || '').replace(/\|/g, '\\|').replace(/\n/g, '<br>')).join(' | ')} |`);
  md.push('');
}
fs.writeFileSync(path.join(여기, '리라이팅.md'), md.join('\n'));
const 셈 = {}; for (const 쪽 of 자료.쪽) for (const r of 쪽.행) 셈[r.상태] = (셈[r.상태] || 0) + 1;
console.log('리라이팅.md', JSON.stringify(셈));

const [그림폴더, 낼곳, 맹검조각] = process.argv.slice(2);
if (그림폴더 && 낼곳) {
  let html = fs.readFileSync(path.join(여기, '쪽_원고.html'), 'utf8');
  html = html.replace(/\{\{img:([^}]+)\}\}/g, (_, f) => `data:image/jpeg;base64,${fs.readFileSync(path.join(그림폴더, f)).toString('base64')}`);
  html = html.replace('{{서체}}', "'SUIT Variable','Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif");
  html = html.replace('{{원칙}}', 자료.원칙.map(w => `<li>${esc(w)}</li>`).join(''));
  const 표 = 자료.쪽.map((쪽, i) => {
    const 바뀜 = 쪽.행.filter(r => r.상태 !== '그대로').length;
    const 행 = 쪽.행.map(r => `<div class="rw${r.상태 === '그대로' ? ' keep' : ''}"><div class="where"><span>${esc(r.자리)}</span><span class="tag ${r.상태}">${r.상태}</span></div><div class="now">${줄(esc(r.지금))}</div><div class="new">${esc(r.제안)}</div>${r.까닭 ? `<div class="why">${esc(r.까닭)}</div>` : ''}</div>`).join('\n');
    return `<details class="pg"${i < 2 ? ' open' : ''}><summary>${esc(쪽.이름)} <span class="cnt">${쪽.행.length}줄 가운데 ${바뀜}줄 고침</span></summary><div class="rw head"><div>자리</div><div>지금</div><div>제안</div></div>\n${행}</details>`;
  }).join('\n');
  html = html.replace('{{리라이팅}}', 표);
  const 맹검 = 맹검조각 && fs.existsSync(맹검조각) ? fs.readFileSync(맹검조각, 'utf8') : '<p>다른 눈으로도 보려고 홈과 네 사업의 첫 화면을 출처를 가린 채 아르곤(Gemini)에게 보냈습니다. 이 쪽을 낼 때까지 차례가 오지 않아 답을 받지 못했습니다. 위 판단은 제 눈 하나로 본 것입니다.</p>';
  html = html.replace('{{맹검}}', 맹검);
  if (/\{\{/.test(html)) throw Error('안 채운 자리가 남았다');
  fs.mkdirSync(path.dirname(낼곳), { recursive: true });
  fs.writeFileSync(낼곳, html);
  console.log(낼곳, Math.round(html.length / 1024) + 'KB');
}
