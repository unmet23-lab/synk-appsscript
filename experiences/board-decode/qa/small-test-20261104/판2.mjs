#!/usr/bin/env node
/**
 * 게시판 해독 · 작은 시험 2회차(2026-11-04) — proto2.html을 찍고 시험관 묶음을 만든다.
 *   node experiences/board-decode/qa/small-test-20261104/판2.mjs [--찍기만]
 *
 * <밖> = 작업본 .tmp/board-decode-20261104/v2 (BD_OUT로 바꿈). 하위 에이전트가 쓸 수 있게 워크트리 안 .tmp를 기본으로 한다(1회차는 공용 작업본 .tmp에 답을 못 썼다).
 *   판/                  화면 그림(변형마다)
 *   시험관/<이름>/        재미 · 길이 — 1회차와 같은 물음, 1회차 답은 보이지 않는다
 *   안읽고/<이름>/        게시판 한글을 모두 가린 판 + 보기 글 — 변형을 시험관마다 다르게 준다
 *   해독/<이름>/질문.md   갈림 말을 ①②로 가린 글 — 먼저 단서 없이, 그다음 단서 카드를 보고 다시
 *   변형표.json           시험관마다 준 변형(정답 대조용, 시험관에게 안 보임)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..');
export const 밖 = process.env.BD_OUT || path.join(뿌리, '.tmp', 'board-decode-20261104', 'v2');
const 시제품 = pathToFileURL(path.join(여기, '..', 'small-test-proto2.html')).href;
const 원고 = JSON.parse(/<script id="content" type="application\/json">([\s\S]*?)<\/script>/.exec(fs.readFileSync(path.join(여기, '..', 'small-test-proto2.html'), 'utf8'))[1]);
export const 판들 = 원고.rounds;
export const 낱말 = 원고.words;

export const 시험관들 = {
  몽골여_3급: { 소개: '울란바토르에서 온 20살 여자 대학생. 한국 대학 1학년(어학당 1년 뒤 입학). TOPIK 3급. 폰 게임은 퍼즐 · 꾸미기를 하루 20분쯤.', 순서: ['1', '2'] },
  베트남남_3급: { 소개: '하노이에서 온 22살 남자 유학생. 한국 대학 2학년. TOPIK 3급(읽기가 약함). 폰 게임은 액션 · 축구 게임을 즐김. 학습 앱은 오래 못 함.', 순서: ['2', '1'] },
  우즈베크여_4급: { 소개: '타슈켄트에서 온 21살 여자 유학생. TOPIK 4급 막 땀. 드라마 덕후. 학습 앱 듀오링고 연속 200일.', 순서: ['1', '2'] },
  한국인_게임기획자: { 소개: '모바일 퍼즐 게임 기획 7년 차 한국인. Chants of Sennaar를 끝까지 해 봤다. 학습 게임은 대개 재미없다고 생각한다.', 순서: ['2', '1'] },
};

// 안 읽고 · 해독 시험관에게 줄 변형: 상식과 반대로 가는 판(포함 · 폐기 · 추첨 · 연기 · 시작)을 절반 섞는다.
export const 변형표 = {
  안읽고_1: { 1: ['제외', '보관'], 2: ['선착순', '취소', '마감'] },
  안읽고_2: { 1: ['포함', '폐기'], 2: ['추첨', '연기', '시작'] },
  안읽고_3: { 1: ['제외', '폐기'], 2: ['추첨', '취소', '시작'] },
  안읽고_4: { 1: ['포함', '보관'], 2: ['선착순', '연기', '마감'] },
  해독_1: { 1: ['제외', '폐기'], 2: ['추첨', '연기', '마감'] },
  해독_2: { 1: ['포함', '보관'], 2: ['선착순', '취소', '시작'] },
  해독_3: { 1: ['포함', '폐기'], 2: ['선착순', '연기', '마감'] },
};
const 대표 = { 1: ['제외', '보관'], 2: ['선착순', '취소', '마감'] };
const 다른 = { 1: ['포함', '폐기'], 2: ['추첨', '연기', '시작'] };

const 찍을쪽 = (r, 고름, 추가 = '') => `round=${r}&pick=${encodeURIComponent(고름.join(','))}&seed=${r === '1' ? 11 : 23}${추가}`;

async function 찍기() {
  const { chromium } = require('playwright');
  const 판폴더 = path.join(밖, '판');
  fs.mkdirSync(판폴더, { recursive: true });
  const 브 = await chromium.launch({ channel: 'chrome', headless: true });
  const 점검 = { 콘솔오류: [], 넘침: [], 실행: {} };
  const 쪽 = async (이름, q, 일 = null, { 길게 = false } = {}) => {
    const ctx = await 브.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    p.on('console', (m) => { if (m.type() === 'error') 점검.콘솔오류.push(`${이름}: ${m.text()}`); });
    p.on('pageerror', (e) => 점검.콘솔오류.push(`${이름}: ${e.message}`));
    await p.goto(`${시제품}?${q}`);
    await p.evaluate(() => document.fonts.ready);
    if (일) await 일(p);
    const 넘 = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (넘 > 0) 점검.넘침.push(`${이름}: ${넘}px`);
    await p.screenshot({ path: path.join(판폴더, 이름 + '.png'), fullPage: 길게 });
    await ctx.close();
  };
  const 맞는보기 = (R, i, 고름) => {
    const k = R.slots[i].keys.at(-1);
    const 필요 = R.forks[k].find((w) => 고름.includes(w));
    return R.slots[i].options.findIndex((o) => o.ok === 필요);
  };
  // 보기 순서는 seed로 섞이므로 글로 찾아 누른다
  const 누르기글 = (p, 글) => p.click(`.reply:has-text("${글.slice(0, 12)}")`);
  for (const R of 판들) {
    const r = R.id;
    const 책 = r === '2' ? '&book=' + encodeURIComponent('제외') : '';
    const 고름 = 대표[r];
    await 쪽(`${r}_1첫화면`, 찍을쪽(r, 고름, 책));
    await 쪽(`${r}_2전체`, 찍을쪽(r, 고름, 책 + '&tall=1'), null, { 길게: true });
    await 쪽(`${r}_3단서`, 찍을쪽(r, 고름, 책), async (p) => { await p.click('.w >> nth=0'); });
    await 쪽(`${r}_4단서뜻`, 찍을쪽(r, 고름, 책), async (p) => { await p.click('.w >> nth=0'); await p.click('[data-easy]'); });
    await 쪽(`${r}_5틀림`, 찍을쪽(r, 고름, 책), async (p) => {
      const 틀린 = R.slots[0].options.find((o) => o.ok && o.ok !== R.forks[R.slots[0].keys.at(-1)].find((w) => 고름.includes(w)));
      await 누르기글(p, 틀린.t);
    });
    await 쪽(`${r}_6다음칸`, 찍을쪽(r, 고름, 책), async (p) => { await 누르기글(p, R.slots[0].options[맞는보기(R, 0, 고름)].t); });
    await 쪽(`${r}_7끝`, 찍을쪽(r, 고름, 책), async (p) => {
      for (let i = 0; i < R.slots.length; i++) await 누르기글(p, R.slots[i].options[맞는보기(R, i, 고름)].t);
      const 뜻 = 낱말[R.forks[R.teach.key].find((w) => 고름.includes(w))].teach;
      await p.click(`[data-teach]:has-text("${뜻.slice(0, 8)}")`);
    });
    await 쪽(`${r}_8낱말바뀜`, 찍을쪽(r, 다른[r], 책 + '&tall=1'), null, { 길게: true });
    for (const 이름 of Object.keys(변형표).filter((n) => n.startsWith('안읽고'))) {
      await 쪽(`${r}_가림_${이름}`, 찍을쪽(r, 변형표[이름][r], '&tall=1&mask=all'), null, { 길게: true });
    }
    // 정답 한 판 자동 실행 + 변형 뒤집힘 확인
    for (const 벌 of [대표[r], 다른[r]]) {
      const ctx = await 브.newContext({ viewport: { width: 390, height: 844 } });
      const p = await ctx.newPage();
      p.on('pageerror', (e) => 점검.콘솔오류.push(`실행 ${r}: ${e.message}`));
      await p.goto(`${시제품}?${찍을쪽(r, 벌)}`);
      let 누름 = 0;
      for (let i = 0; i < R.slots.length; i++) { await 누르기글(p, R.slots[i].options[맞는보기(R, i, 벌)].t); 누름++; }
      const 뜻 = 낱말[R.forks[R.teach.key].find((w) => 벌.includes(w))].teach;
      await p.click(`[data-teach]:has-text("${뜻.slice(0, 8)}")`); 누름++;
      점검.실행[`${r}:${벌.join('·')}`] = { 끝: await p.evaluate(() => !!document.querySelector('.done')), 누름 };
      await ctx.close();
    }
  }
  await 브.close();
  fs.writeFileSync(path.join(밖, '점검.json'), JSON.stringify(점검, null, 2));
  return 점검;
}

const 머리 = (이름) => `너는 아래 사람이다. 이 사람으로서 솔직하게 답한다. 칭찬하려 애쓰지 말고, 지루하면 지루하다, 끄고 싶으면 끄고 싶다고 쓴다.\n\n사람: ${시험관들[이름].소개}\n`;

function 재미질문(이름) {
  const 묶음 = 시험관들[이름].순서.map((id, i) => `### 판 ${i + 1}\n${i + 1}_1 첫 화면 · ${i + 1}_2 게시판 전체 · ${i + 1}_3 밑줄 말을 누름(이 말이 또 나온 곳) · ${i + 1}_4 「그래도 모르겠어요」를 누름 · ${i + 1}_5 틀렸을 때 · ${i + 1}_6 맞힌 뒤 다음 질문 · ${i + 1}_7 끝 · ${i + 1}_8 다시 할 때(공지의 낱말이 바뀐 판)`).join('\n\n');
  return `${머리(이름)}
상황: 한국 대학에 다니는 외국인 학생이 쓰는 한국어 앱 안의 미니게임 「게시판 해독」 시제품이다(그림은 아직 없는 종이 시안). 친구가 메시지로 묻고, 나는 게시물을 읽어 답장을 고른다. 밑줄 친 말은 이 사람이 모르는 말이라고 생각하고 본다(TOPIK 3급이면 「제외 · 폐기 · 선착순 · 추첨 · 연기」 같은 공지 말은 대개 모른다).

하는 법: 친구 말을 보고 게시물을 읽어 답장 하나를 누른다. 밑줄 친 말을 누르면 아래 칸에 그 말이 다른 곳에 쓰인 예가 그림과 함께 나온다(뜻을 바로 알려 주지는 않고, 「그래도 모르겠어요」를 누르면 쉬운 뜻이 나온다). 틀리면 그 답장대로 벌어진 일이 화면 가득 나오고 다시 고른다. 맞히면 그 말이 수첩에 들어가고 다음 판 게시물에서 초록 밑줄로 읽힌다. 다시 하면 공지의 낱말 하나가 바뀌어 답이 뒤집힌다(${시험관들[이름].순서[0] === '1' ? '1_8' : '2_8'} 같은 그림).

판 꼴이 두 가지다(그림 이름 앞 번호가 판 순서).
${묶음}

각 판마다 답한다:
1. 이 판을 끝까지 하겠나? 1~5점과 까닭 한 줄.
2. 「아, 이 말이 이런 뜻이구나!」 하는 순간이 있었나? 어디서.
3. 답답하거나 끄고 싶은 자리는? (그림 번호와 함께)
4. 한 판이 몇 분쯤 걸릴 것 같나? 길게 느껴지나, 짧게 느껴지나?
5. 숙제 같나, 게임 같나? 1(숙제) ~ 5(게임).
6. 밑줄 친 말을 모르고도 찍어서 맞힐 수 있을 것 같나? 어떻게?
7. 싸 보이거나 어색한 곳(글 · 배치 · 말투).

끝에 둘을 견주어:
8. 내일 또 하고 싶은 판 꼴과 까닭.
9. 다시 할 때 낱말이 바뀌어 답이 뒤집히는 것(_8)은 재밌나, 치사한가, 상관없나? 다시 하겠나?
10. 틀렸을 때 나오는 장면(_5)은 또 보고 싶나, 짜증 나나?
11. 이 게임을 다시 하게 만들 한 가지를 고친다면?

마지막 줄에 JSON 한 줄(점수는 숫자): {"끝까지":{"판1":n,"판2":n},"게임같음":{"판1":n,"판2":n},"또할판":"판N","낱말바뀜":"재밌다|치사하다|상관없다","틀림장면":"또보고싶다|짜증|상관없다","다시하겠나":n}
`;
}

// 글판: 갈림 말 · 우천 시 등 열쇠 말을 ①②로 가린다
function 글판(R, 고름, 가림) {
  const fork = {};
  for (const [k, pair] of Object.entries(R.forks)) fork[k] = pair.find((w) => 고름.includes(w));
  const 열쇠 = [...new Set(R.slots.flatMap((sl) => sl.keys).map((k) => fork[k] || k))];
  const 표 = Object.fromEntries(열쇠.map((w, i) => [w, '①②③④⑤⑥'[i]]));
  const 줄 = (s) => s.replace(/\[\[([^\]]+)\]\]/g, (_, k) => {
    if (k === 'carry') return '졸업생 제외';
    const w = fork[k] || k;
    return 가림 ? `〔${표[w]}〕` : w;
  });
  const 공지 = R.notices.map((N) => `[${N.head}] ${N.title}\n${N.lines.map((L) => (typeof L === 'string' ? 줄(L) : L.li ? '· ' + 줄(L.li) : L.note ? 줄(L.note) : L.big ? 줄(L.big) : '')).filter(Boolean).join('\n')}${N.foot ? '\n' + N.foot : ''}`).join('\n\n');
  const 쪽지 = R.scraps.join(' / ');
  const 단계 = R.slots.map((sl, i) => `${R.who}: 「${sl.say}」\n${sl.options.map((o, j) => `  ${'abc'[j]}) ${o.t}`).join('\n')}`).join('\n\n');
  const 단서 = 열쇠.map((w) => `〔${표[w]}〕이 또 나온 곳: ${낱말[w].clue.replace(/\[\[[^\]]+\]\]/g, `〔${표[w]}〕`)}`).join('\n');
  return { 공지, 쪽지, 단계, 단서, 표 };
}

function 해독질문(이름) {
  const 고름 = 변형표[이름];
  const 묶음 = 판들.map((R) => {
    const { 공지, 쪽지, 단계, 단서 } = 글판(R, 고름[R.id], true);
    return `## 판 ${R.id}\n\n${R.who}의 메시지: ${R.open}\n\n게시물:\n\`\`\`\n${공지}\n\n(작은 쪽지: ${쪽지})\n\`\`\`\n\n${단계}\n\n### 단서 카드(2단계에서만 본다)\n${단서}`;
  }).join('\n\n---\n\n');
  return `${머리('몽골여_3급')}
이 사람은 아래 게시물에서 〔①〕 〔②〕처럼 가린 말을 모른다. 두 단계로 답한다.

1단계: 단서 카드를 보지 말고 게시물만으로 답을 고른다(모르겠으면 그래도 가장 그럴듯한 것). 칸마다 확신 1~5.
2단계: 단서 카드를 보고 〔①〕〔②〕… 각각의 뜻을 쉬운 한국어 한 줄로 짐작한 뒤, 답을 다시 고른다. 칸마다 확신 1~5.

가린 말의 원래 낱말을 맞히려 하지 말고 이 사람의 눈으로 짐작한다.

${묶음}

마지막 줄에 JSON 한 줄(칸은 메시지 순서대로 1, 2, 3): {"1":{"처음":{"1":"a","2":"b"},"단서뒤":{"1":"a","2":"b"},"뜻":{"①":"…","②":"…"}},"2":{"처음":{"1":"a","2":"b","3":"c"},"단서뒤":{"1":"a","2":"b","3":"c"},"뜻":{"①":"…","②":"…","③":"…","④":"…"}}}
`;
}

function 안읽고질문(이름) {
  const 묶음 = 판들.map((R) => {
    const { 단계 } = 글판(R, 변형표[이름][R.id], false);
    return `## 판 ${R.id} — 그림 ${R.id}_가림.png\n\n${R.who}의 메시지: ${R.open}\n\n${단계}`;
  }).join('\n\n---\n\n');
  return `너는 게임의 허점을 찾는 시험관이다. 그림은 게시물의 한글을 모두 ▢로 가린 판이다(숫자 · 기호 · 배치 · 색은 그대로, 열쇠 말 자리는 ①②로 표시). 게시물을 읽지 않고, 숫자 · 배치 · 메시지 글 · 보기의 말투 · 상식만으로 답장을 찍어 맞혀 본다. 모르면 가장 그럴듯한 것을 고른다(빈칸 없이). 숫자는 일부러 지우지 않았다.

${묶음}

판마다: 칸마다 고른 기호와 무엇을 보고 골랐나 한 줄, 끝에 「읽지 않고 풀리는 허점」을 셋까지.
마지막 줄에 JSON 한 줄: {"1":{"1":"a","2":"b"},"2":{"1":"a","2":"b","3":"c"}}
`;
}

function 폴더(종류, 이름, 그림들, 질문) {
  const 곳 = path.join(밖, 종류, 이름);
  if (fs.existsSync(path.join(곳, '답.md'))) throw new Error(`답이 든 폴더는 덮지 않는다: ${곳}`);
  fs.mkdirSync(곳, { recursive: true });
  for (const [원, 새] of 그림들) fs.copyFileSync(path.join(밖, '판', 원 + '.png'), path.join(곳, 새 + '.png'));
  fs.writeFileSync(path.join(곳, '질문.md'), 질문);
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await 찍기(), null, 1));
  if (!process.argv.includes('--찍기만')) {
    for (const 이름 of Object.keys(시험관들)) {
      const 그림 = [];
      시험관들[이름].순서.forEach((id, i) => ['1첫화면', '2전체', '3단서', '4단서뜻', '5틀림', '6다음칸', '7끝', '8낱말바뀜'].forEach((화면, j) => 그림.push([`${id}_${화면}`, `${i + 1}_${j + 1}`])));
      폴더('시험관', 이름, 그림, 재미질문(이름));
    }
    for (const 이름 of Object.keys(변형표)) {
      if (이름.startsWith('해독')) 폴더('해독', 이름, [], 해독질문(이름));
      else 폴더('안읽고', 이름, 판들.map((R) => [`${R.id}_가림_${이름}`, `${R.id}_가림`]), 안읽고질문(이름));
    }
    fs.writeFileSync(path.join(밖, '변형표.json'), JSON.stringify(변형표, null, 1));
    console.log('시험관 묶음 →', 밖);
  }
}
