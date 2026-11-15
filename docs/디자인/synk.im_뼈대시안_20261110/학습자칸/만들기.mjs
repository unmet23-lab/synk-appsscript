#!/usr/bin/env node
// 아틀라스 「학습자가 보는 화면」 짜임 시안 셋(2026-11-16, 판단 세션 · 유호님 「응, 시안 만들어」).
// 6단계 맹검 둘이 함께 짚은 셋을 푼다: 컴퓨터에서 눈이 ① 가운데 위 → ② 오른쪽 → ③ 가운데 아래로 오간다, 첫날 카드가 화면에 없다, 글이 많다.
// 알맹이(유호님 11-15 「시안 2로」: 실제 게임에서 틀린 순간 · 고른 답 이름표 · 고른 목표 · 6단계 D의 까닭 줄)는 그대로 두고 뼈대만 바꾼다.
//   가 「한 줄기」: 틀린 순간 → 판단 기록 → 바뀐 추천을 왼쪽에서 오른쪽으로 한 줄에.
//   나 「전후 맞대기」: 첫날 카드와 놓친 뒤 카드를 좌우에 같은 크기로, 가운데에 그 사이에 한 것과 바뀐 세 줄.
//   다 「시간 순서」: 첫날 → 게임 → 다음에 앱을 열면 → 1 · 7 · 30일 뒤를 세로 시간줄에.
// 쉬는 화면(예시 학습자)만 새 짜임이다. 단추를 누르면 시안 칸을 걷고 지금 판의 문제 카드 · 판단 기록 흐름이 그대로 이어진다.
//   node 만들기.mjs <바탕 atlas/index.html> <낼 폴더(out)>
//   → <out>/atlas-ga/ · atlas-na/ · atlas-da/index.html, <out>/assets/v10/learner-drafts.css
//   첫날 카드 그림(<out>/assets/v10/learner/ko/piece-tutor-first.webp)은 첫날카드.py가 만든다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const [바탕, 낼] = process.argv.slice(2);
if (!낼) { console.error('쓰기: node 만들기.mjs <바탕 atlas/index.html> <낼 폴더>'); process.exit(1); }
const base = fs.readFileSync(바탕, 'utf8');

const L = '/assets/v10/learner/ko/';
const game = `<div class="dz-game"><img src="${L}piece-game-wrong.webp" width="780" height="492" alt="환승 러시 게임에서 틀린 순간. 학습자는 「서울역」 칸을 골랐고, 아래 안내문은 방송이 말한 「청량리 방면」에 표시를 했다" decoding="async"><span class="k-judge-pick" aria-hidden="true"><b>고른 답 · 오답</b></span></div>`;
const cardNow = `<div class="dz-card"><img src="${L}piece-tutor.webp" width="732" height="277" alt="SYNK WORLD 튜터 카드. 오늘은 「바람길 · 짧은 지시 듣기」부터 하자고 권하며, 최근 놓친 「듣고 세부 정보 찾기」를 더 연습하자는 이유를 적었다" decoding="async"></div>`;
const cardFirst = `<div class="dz-card dz-card--first"><img src="${L}piece-tutor-first.webp" width="732" height="239" alt="첫날의 튜터 카드. 오늘은 「첫 인사 세 마디」부터 만나 보자며, 아직 연습 기록이 적어 짧게 해 보며 맞춰 가겠다고 말한다" decoding="async"></div>`;
const go = `<button type="button" class="btn btn-light dz-go" data-dz-go>첫날부터 직접 풀어 보기 <span class="arr" aria-hidden="true">→</span></button>`;
const eyebrow = `<p class="label dz-eyebrow"><span>SYNK WORLD · 예시 학습자</span></p>`;
const title = `<h2 class="lw-title dz-title"><span>답 하나에</span> <span>판단이 바뀝니다</span></h2>`;
const lead = `<p class="dz-say">게임에서 놓친 답들이 다음 추천을 바꿨습니다</p>`;
const tag = t => `<em class="dz-tag">${t}</em>`;
const foot = `<p class="dz-foot"><span>놓친 항목을 혼자 해낼 수 있게 됐는지는 1 · 7 · 30일 뒤, 처음 보는 문제로 다시 확인합니다</span>${tag('Temper · 확인')}</p>`;

// 가′(11-16, 컴퓨터 · 휴대폰 맹검 모두 1위인 가를 고친 판): 머리 요약 줄은 뺀다(제목과 같은 말을 되풀이하고, 「답 하나에」와 「놓친 답들이」가 수가 엇갈린다),
// 무엇의 화면인지를 머리 꼬리표에(「SYNK WORLD · TOPIK 연습과 한국어 게임」), 「예시 학습자」는 ① 이름으로, ③ 이름을 「바뀐 추천」으로(「다음에 앱을 열면」 아래에 첫날 카드가 와 때가 엇갈렸다),
// 두 카드에서 바뀐 과제 이름 아래에 밑줄(자리는 그림에서 잰 글자 덩어리 — 첫날 「첫 인사 세 마디」 x 377~584, 놓친 뒤 「바람길 · 짧은 지시 듣기」 x 377~682, 첫 줄 y 88~115, 그림 폭 732),
// ① 꼬리는 듣기 문제임을(다시 맹검: 안내문 종이만 보여 읽기 문제로 읽힌다), 첫날 카드는 놓친 뒤 카드와 같은 폭(다시 맹검: 작은 첫날 카드를 건너 아래부터 읽는다),
// 엔진 꼬리표는 흐리게(맹검: 설명 없는 영문 이름이 군더더기로 읽힌다 — 이름은 이 쪽의 엔진 소개라 남긴다).
const uline = (l, t, w) => `<span class="dz-uline" aria-hidden="true" style="left:${l}%;top:${t}%;width:${w}%"></span>`;
const cardNowM = cardNow.replace('</div>', `${uline(51.5, 43, 41.7)}</div>`);
const cardFirstM = cardFirst.replace('</div>', `${uline(51.5, 49.8, 28.3)}</div>`);
const eyebrow2 = `<p class="label dz-eyebrow"><span>SYNK WORLD · TOPIK 연습과 한국어 게임</span></p>`;  // 사이트에 이미 쓰는 소개 말(ko-skeleton)

const 시안 = {
  // 가 — 한 줄기: ① → ② → ③을 한 줄에. ③ 안에 첫날 카드(작게 · 흐리게)와 놓친 뒤 카드를 위아래로 둔다.
  ga: `<div class="dz dz--ga">
<div class="dz-head"><div>${eyebrow}${title}</div><div class="dz-lead">${lead}${go}</div></div>
<ol class="dz-flow">
<li class="dz-step"><p class="dz-cap"><i class="dz-n">1</i><span>학습자가 한 것</span><em>게임에서 놓친 답</em></p>${game}</li>
<li class="dz-step"><p class="dz-cap"><i class="dz-n">2</i><span>판단 기록</span></p><dl class="dz-rows">
<div><dt><span>읽은 것</span>${tag('Trail · 기록')}</dt><dd>게임에서 안내 방송 문제를 여러 번 놓쳤습니다</dd></div>
<div><dt><span>고른 것</span>${tag('Core · 판단')}</dt><dd>「바람길 · 짧은 지시 듣기」부터<small>고른 목표: TOPIK I 시험 준비</small></dd></div>
<div><dt><span>까닭</span>${tag('Vellum · 설명')}</dt><dd>최근 놓친 항목이고, 고른 목표와 이어집니다</dd></div>
</dl></li>
<li class="dz-step"><p class="dz-cap"><i class="dz-n">3</i><span>다음에 앱을 열면</span><em>튜터 카드</em></p><p class="dz-mini">첫날</p>${cardFirst}<p class="dz-mini is-now">게임에서 놓친 뒤</p>${cardNow}</li>
</ol>
${foot}
</div>`,
  ga2: `<div class="dz dz--ga dz--ga2">
<div class="dz-head"><div>${eyebrow2}${title}</div><div class="dz-lead">${go}</div></div>
<ol class="dz-flow">
<li class="dz-step"><p class="dz-cap"><i class="dz-n">1</i><span>예시 학습자가 한 것</span><em>안내 방송을 듣고 고른 답</em></p>${game}</li>
<li class="dz-step"><p class="dz-cap"><i class="dz-n">2</i><span>판단 기록</span></p><dl class="dz-rows">
<div><dt><span>읽은 것</span>${tag('Trail · 기록')}</dt><dd>게임에서 안내 방송 문제를 여러 번 놓쳤습니다</dd></div>
<div><dt><span>고른 것</span>${tag('Core · 판단')}</dt><dd>「바람길 · 짧은 지시 듣기」부터<small>고른 목표: TOPIK I 시험 준비</small></dd></div>
<div><dt><span>까닭</span>${tag('Vellum · 설명')}</dt><dd>최근 놓친 항목이고, 고른 목표와 이어집니다</dd></div>
</dl></li>
<li class="dz-step"><p class="dz-cap"><i class="dz-n">3</i><span>바뀐 추천</span><em>튜터 카드</em></p><p class="dz-mini">첫날</p>${cardFirstM}<p class="dz-mini is-now">게임에서 놓친 뒤</p>${cardNowM}</li>
</ol>
${foot}
</div>`,
  // 나 — 전후 맞대기: 첫날 | 그 사이에 한 것 | 놓친 뒤. 아래 세 줄도 같은 세 칸(첫날 값 · 이름 · 지금 값)으로 맞댄다.
  na: `<div class="dz dz--na">
<div class="dz-head"><div>${eyebrow}${title}</div><div class="dz-lead">${lead}${go}</div></div>
<div class="dz-vs">
<div class="dz-col dz-col--was"><p class="dz-colhead">첫날</p>${cardFirst}</div>
<div class="dz-col dz-col--mid"><p class="dz-colhead">그 사이에 학습자가 한 것</p>${game}</div>
<div class="dz-col dz-col--now"><p class="dz-colhead">게임에서 놓친 뒤</p>${cardNow}</div>
</div>
<dl class="dz-diff">
<div><dt><span>읽은 것</span>${tag('Trail · 기록')}</dt><dd class="dz-was">쌓인 기록이 아직 없습니다</dd><dd class="dz-now">게임에서 안내 방송 문제를 여러 번 놓쳤습니다</dd></div>
<div><dt><span>고른 것</span>${tag('Core · 판단')}</dt><dd class="dz-was">짧게 해 볼 연습 하나</dd><dd class="dz-now">「바람길 · 짧은 지시 듣기」부터<small>고른 목표: TOPIK I 시험 준비</small></dd></div>
<div><dt><span>까닭</span>${tag('Vellum · 설명')}</dt><dd class="dz-was">연습 기록이 아직 적습니다</dd><dd class="dz-now">최근 놓친 항목이고, 고른 목표와 이어집니다</dd></div>
</dl>
${foot}
</div>`,
  // 다 — 시간 순서: 왼쪽 글 칸은 지금 판 그대로, 오른쪽은 세로 시간줄(때 · 화면 · 그때의 판단).
  da: `<div class="dz dz--da">
<div class="dz-side">${eyebrow}${title}${lead}${go}</div>
<ol class="dz-time">
<li><p class="dz-when">첫날</p><div class="dz-pic">${cardFirst}</div><div class="dz-say2"><p class="dz-k">고른 것 ${tag('Core · 판단')}</p><p class="dz-t">짧게 해 볼 연습 하나</p><p class="dz-s">연습 기록이 아직 적습니다</p></div></li>
<li class="is-hot"><p class="dz-when">게임에서</p><div class="dz-pic">${game}</div><div class="dz-say2"><p class="dz-k">읽은 것 ${tag('Trail · 기록')}</p><p class="dz-t">안내 방송 문제를 여러 번 놓쳤습니다</p><p class="dz-s">이 답들은 「듣고 세부 정보 찾기」 기록이 됩니다</p></div></li>
<li><p class="dz-when">다음에 앱을 열면</p><div class="dz-pic">${cardNow}</div><div class="dz-say2"><p class="dz-k">고른 것 ${tag('Core · 판단')}</p><p class="dz-t">「바람길 · 짧은 지시 듣기」부터</p><p class="dz-s">최근 놓친 항목이고, 고른 목표(TOPIK I 시험 준비)와 이어집니다 ${tag('Vellum · 설명')}</p></div></li>
<li class="is-later"><p class="dz-when">1 · 7 · 30일 뒤</p><div class="dz-say2"><p class="dz-s">놓친 항목을 혼자 해낼 수 있게 됐는지, 처음 보는 문제로 다시 확인합니다 ${tag('Temper · 확인')}</p></div></li>
</ol>
</div>`,
};

// 가′ 맺음 줄 시험(11-16 판단 세션 물음 1): 쉬는 화면에서 걷었던 「왜 이렇게 만들었나 →」 링크와 출처 줄을 맺음 줄 아래 한 줄로 되살린 판.
// 단계 줄(지금 · 1분 뒤 · … · 내 위치)은 쉬는 화면에서 걷은 채 둔다 — 고른 칸이 없는 쉬는 화면에서는 맹검이 「현재 상태 표시도 없이 덧붙은 군더더기」로 읽었다.
const more = `<p class="dz-more"><a class="lw-link" href="/atlas/#learner-why">왜 이렇게 만들었나 <span class="arr" aria-hidden="true">→</span></a><span>실제 첫 레슨의 문제와 SYNK WORLD 화면 · 예시 학습자의 30일</span></p>`;
시안.ga2b = 시안.ga2.replace('dz--ga2">', 'dz--ga2 dz--ga2b">').replace(`${foot}\n</div>`, `${foot}\n${more}\n</div>`);
if (!시안.ga2b.includes('dz-more')) throw new Error('ga2b: 맺음 줄을 못 끼움');

const script = `<script>(()=>{const s=document.getElementById('learner');if(!s)return;s.classList.add('is-rest');const b=s.querySelector('[data-dz-go]');if(b)b.addEventListener('click',()=>{s.classList.remove('is-rest');const n=s.querySelector('[data-next] .btn');if(n)n.click();});})();</script>`;

fs.mkdirSync(path.join(낼, 'assets', 'v10'), { recursive: true });
fs.copyFileSync(path.join(여기, '시안.css'), path.join(낼, 'assets', 'v10', 'learner-drafts.css'));
const 열림 = base.match(/<section class="lw lw--try lw--judge" id="learner"[^>]*>/);
if (!열림) throw new Error('학습자 칸 여는 태그를 못 찾음');
for (const [키, 칸] of Object.entries(시안)) {
  let h = base.replace(열림[0], `${열림[0]}\n${칸}`);
  h = h.replace(/(<link rel="stylesheet" href="\/assets\/v10\/skeleton\.css[^"]*">)/, `$1\n<link rel="stylesheet" href="/assets/v10/learner-drafts.css">`);
  h = h.replace('</body>', `${script}\n</body>`);
  if (!h.includes('learner-drafts.css') || !h.includes('data-dz-go')) throw new Error(키 + ': 끼우지 못함');
  const 곳 = path.join(낼, `atlas-${키}`);
  fs.mkdirSync(곳, { recursive: true });
  fs.writeFileSync(path.join(곳, 'index.html'), h);
  console.log(키, (h.length / 1024).toFixed(0) + 'KB');
}
// 새로 쓰는 글자가 글꼴 조각(suit-v10)에 있는지 보려고 글을 모은다
const 글 = Object.values(시안).join('').replace(/<[^>]+>/g, '');
fs.writeFileSync(path.join(낼, 'draft-text.txt'), 글);
