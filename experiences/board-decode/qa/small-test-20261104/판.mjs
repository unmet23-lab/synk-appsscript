#!/usr/bin/env node
/**
 * 게시판 해독 · 작은 시험(2026-11-04) — proto.html을 390×844 휴대폰 판으로 찍고, 시험관 묶음 셋을 만든다.
 *
 *   node experiences/board-decode/qa/small-test-20261104/판.mjs [--찍기만]
 *
 * <밖> = 공용 작업본 .tmp/board-decode-20261104 (BD_OUT로 바꿈)
 *   판/<판꼴>_<화면>.png           390×844 @2x(긴 판은 게시판 전체)
 *   시험관/<이름>/                  재미 · 길이 · 고르기 — 판 꼴 셋을 시험관마다 다른 순서로, 질문.md
 *   해독/<이름>/질문.md             모르는 말을 ①②③④로 가린 글 — 맥락만으로 뜻을 짐작하고 해내기를 푼다
 *   안읽고/<이름>/                  공지의 한글을 모두 ▢로 가린 판 — 읽지 않고 숫자 · 배치만으로 풀리나
 *   점검.json                       콘솔 오류 · 가로 넘침 · 정답 한 판 자동 실행(누른 횟수)
 * 답(답.md)이 든 폴더는 덮지 않고 멈춘다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
export const 밖 = process.env.BD_OUT || path.join(공용작업본(뿌리), '.tmp', 'board-decode-20261104');
const 시제품 = pathToFileURL(path.join(여기, '..', 'small-test-proto1.html')).href;
const 원고 = JSON.parse(/<script id="content" type="application\/json">([\s\S]*?)<\/script>/.exec(fs.readFileSync(path.join(여기, '..', 'small-test-proto1.html'), 'utf8'))[1]);
export const 판들 = 원고.rounds;

// 시험관 — 맥락 없는 사람 역(모델은 실행할 때 고른다). 순서는 시험관마다 다르게(순서 효과를 가린다).
export const 시험관들 = {
  몽골여_3급: { 소개: '울란바토르에서 온 20살 여자 대학생. 한국 대학 1학년(어학당 1년 뒤 입학). TOPIK 3급. 폰 게임은 퍼즐 · 꾸미기를 하루 20분쯤.', 순서: ['A', 'B', 'C'] },
  베트남남_3급: { 소개: '하노이에서 온 22살 남자 유학생. 한국 대학 2학년. TOPIK 3급(읽기가 약함). 폰 게임은 액션 · 축구 게임을 즐김. 학습 앱은 오래 못 함.', 순서: ['B', 'C', 'A'] },
  우즈베크여_4급: { 소개: '타슈켄트에서 온 21살 여자 유학생. TOPIK 4급 막 땀. 드라마 덕후. 학습 앱 듀오링고 연속 200일.', 순서: ['C', 'A', 'B'] },
  한국인_게임기획자: { 소개: '모바일 퍼즐 게임 기획 7년 차 한국인. Chants of Sennaar를 끝까지 해 봤다. 학습 게임은 대개 재미없다고 생각한다.', 순서: ['B', 'A', 'C'] },
};

const 인자 = new Set(process.argv.slice(2));

function 글로(N, 가림) {
  // 공지 한 장을 글로: 가림 = 'unknown'이면 모르는 말을 ①②로
  const 표 = {};
  return (R) => {
    let n = 0;
    for (const w of Object.keys(R.words)) 표[w] = '①②③④⑤⑥'[n++];
    const 줄 = (s) => s.replace(/\{h:[\w-]+\|((?:[^{}]|\[\[[^\]]+\]\])*)\}/g, '$1').replace(/\[\[([^\]]+)\]\]/g, (_, w) => (가림 === 'unknown' && R.words[w] && !(R.known || []).includes(w) ? `〔${표[w]}〕` : w));
    const 몸 = N.lines.map((L) => (typeof L === 'string' ? 줄(L) : L.li ? '· ' + 줄(L.li) : L.note ? 줄(L.note) : L.big ? 줄(L.big) : L.gap ? '' : '')).join('\n');
    return `[${N.head}] ${줄(N.title)}\n${몸}${N.foot ? '\n' + N.foot : ''}`;
  };
}

function 판글(R, 가림) {
  const 공지 = R.notices.map((N) => 글로(N, 가림)(R)).join('\n\n');
  const 상황 = `${R.situation.who === 'me' ? '(나의 생각)' : R.situation.who + '의 메시지:'} ${R.situation.text}`;
  const 단계 = R.steps.map((st, i) => {
    const 칸 = [];
    if (st.options) 칸.push(`  ${st.q}\n` + st.options.map((o, j) => `    ${'abcdef'[j]}) ${o.t || o.fl + ' ' + o.rm}`).join('\n'));
    for (const sl of st.slots || []) 칸.push(`  ${sl.q}\n` + sl.options.map((o, j) => `    ${'abcdef'[j]}) ${o.t}`).join('\n'));
    return `해내기 ${i + 1}: ${st.bubble ? '(태오: ' + st.bubble + ')' : st.options ? '' : st.q}\n${칸.join('\n')}`;
  }).join('\n\n');
  return { 공지, 상황, 단계 };
}

async function 찍기() {
  const { chromium } = require('playwright');
  const 판폴더 = path.join(밖, '판');
  fs.mkdirSync(판폴더, { recursive: true });
  const 브 = await chromium.launch({ channel: 'chrome', headless: true }); // 저장소 Playwright 판에 맞는 내려받은 브라우저가 없어 설치된 크롬을 쓴다(현장노트 시험_화면확인)
  const 점검 = { 콘솔오류: [], 넘침: [], 실행: {} };
  const 쪽 = async (이름, q, 일 = null, { 길게 = false } = {}) => {
    const ctx = await 브.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    p.on('console', (m) => { if (m.type() === 'error') 점검.콘솔오류.push(`${이름}: ${m.text()}`); });
    p.on('pageerror', (e) => 점검.콘솔오류.push(`${이름}: ${e.message}`));
    await p.goto(`${시제품}?fresh=1&${q}`);
    await p.evaluate(() => document.fonts.ready);
    if (일) await 일(p);
    const 넘 = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (넘 > 0) 점검.넘침.push(`${이름}: ${넘}px`);
    await p.screenshot({ path: path.join(판폴더, 이름 + '.png'), fullPage: 길게 });
    await ctx.close();
  };
  for (const R of 판들) {
    const r = R.id;
    await 쪽(`${r}_1게시판`, `round=${r}`);
    await 쪽(`${r}_1게시판전체`, `round=${r}&tall=1`, null, { 길게: true });
    // 수첩: 모르는 말 둘을 짝지은 상태
    await 쪽(`${r}_2수첩`, `round=${r}&found=all&view=book`, async (p) => {
      const 짝 = Object.entries(R.words).slice(0, 2);
      for (const [w, v] of 짝) { await p.click(`.pair[data-pick="${w}"]`); await p.click(`.card[data-card="${v.card}"]`); }
    });
    await 쪽(`${r}_3해내기1`, `round=${r}&view=act1`);
    // 틀린 답 한 번: 첫 칸의 첫 오답을 고르고 나머지는 정답
    await 쪽(`${r}_4헤맴`, `round=${r}&view=act1`, async (p) => {
      const st = R.steps[0];
      if (st.options) { const o = st.options.find((x) => !x.ok); await p.click(`[data-opt="main:${o.k}"]`); }
      for (const sl of st.slots || []) { const o = st.options ? sl.options.find((x) => x.ok) : sl.options.find((x) => !x.ok); await p.click(`[data-opt="${sl.id}:${o.k}"]`); }
      await p.click('[data-go]');
    });
    await 쪽(`${r}_5해내기2`, `round=${r}&view=act2`);
    await 쪽(`${r}_6끝`, `round=${r}&view=done`);
    await 쪽(`${r}_가림_모르는말`, `round=${r}&tall=1&mask=unknown`, null, { 길게: true });
    await 쪽(`${r}_가림_한글전부`, `round=${r}&tall=1&mask=all`, null, { 길게: true });

    // 정답 한 판을 처음부터 끝까지 자동으로: 모르는 말 찾기 → 짝 → 맞춰 보기 → 해내기 → 끝. 누른 횟수를 센다.
    const ctx = await 브.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => 점검.콘솔오류.push(`실행 ${r}: ${e.message}`));
    await p.goto(`${시제품}?fresh=1&round=${r}`);
    let 누름 = 0;
    const 누르기 = async (sel) => { await p.click(sel); 누름++; };
    for (const w of Object.keys(R.words)) await 누르기(`.w[data-w="${w}"] >> nth=0`);
    await 누르기('.dock [data-open-book]');
    for (const [w, v] of Object.entries(R.words)) { await 누르기(`.pair[data-pick="${w}"]`); await 누르기(`.card[data-card="${v.card}"]`); }
    await 누르기('[data-check]');
    const 풀림 = await p.evaluate(() => window.__bd.state().solved);
    await 누르기('.book .act [data-close]');
    await 누르기('[data-open-task]');
    for (const st of R.steps) {
      if (st.options) await 누르기(`[data-opt="main:${st.options.find((o) => o.ok).k}"]`);
      for (const sl of st.slots || []) await 누르기(`[data-opt="${sl.id}:${sl.options.find((o) => o.ok).k}"]`);
      await 누르기('[data-go]');
    }
    const 끝 = await p.evaluate(() => !!document.querySelector('.done'));
    점검.실행[r] = { 풀림, 끝, 누름 };
    await ctx.close();
  }
  await 브.close();
  fs.writeFileSync(path.join(밖, '점검.json'), JSON.stringify(점검, null, 2));
  return 점검;
}

const 공통질문머리 = (이름) => `너는 아래 사람이다. 이 사람으로서 솔직하게 답한다. 칭찬하려 애쓰지 말고, 지루하면 지루하다, 끄고 싶으면 끄고 싶다고 쓴다.

사람: ${시험관들[이름].소개}
`;

function 재미질문(이름) {
  const 순서 = 시험관들[이름].순서;
  const 꼴 = Object.fromEntries(판들.map((R) => [R.id, R]));
  const 묶음 = 순서.map((id, i) => {
    const R = 꼴[id];
    return `### 판 ${i + 1} — 그림 ${i + 1}_1 ~ ${i + 1}_6
${i + 1}_1 게시판(첫 화면) · ${i + 1}_2 게시판 전체 · ${i + 1}_3 수첩(모르는 말과 뜻 카드 짝짓기) · ${i + 1}_4 해내기 · ${i + 1}_5 틀렸을 때 · ${i + 1}_6 끝 화면`;
  }).join('\n\n');
  return `${공통질문머리(이름)}
상황: 한국 대학에 다니는 외국인 학생이 쓰는 한국어 앱 안의 미니게임 「게시판 해독」 시제품이다(그림은 아직 없는 종이 시안 단계). 기숙사 · 학과 · 축제 게시물처럼 처음엔 다 못 읽는 글을 맥락과 단서로 풀어 그 글이 시키는 일을 해낸다. 밑줄 친 말은 이 사람이 모르는 말이라고 생각하고 본다(TOPIK 3급이면 「점검 · 선착순 · 지참」 같은 공지 말은 대개 모른다).

하는 법: ① 게시물에서 밑줄 친 말을 누르면 아래 「수첩」에 들어간다. ② 수첩에서 말마다 뜻 카드를 짝짓고 「한꺼번에 맞춰 보기」 — 틀리면 어느 게 틀렸는지는 안 알려 주고, 두 번 틀리면 게시물의 단서 자리가 노랗게 빛난다. 뜻 맞추기는 안 해도 된다. ③ 「해내기」에서 그 글이 시키는 대로 고른다(어디로 · 언제 · 뭘 가져가 · 어떻게 답장). 틀리면 인물 반응과 함께 다시 고른다. ④ 끝 화면에 푼 말이 수첩에 남고, 다음 판 게시물에서는 그 말이 읽힌다.

판 꼴이 세 가지다(그림 이름의 앞 번호가 판 순서).
${묶음}

각 판마다 답한다(판 1 · 2 · 3 따로):
1. 이 판을 끝까지 하겠나? 1~5점과 까닭 한 줄.
2. 「아, 이 말이 이런 뜻이구나!」 하는 순간이 있었나? 있었다면 어디서.
3. 답답하거나 끄고 싶은 자리는? (그림 번호와 함께)
4. 한 판이 몇 분쯤 걸릴 것 같나? 길게 느껴지나, 짧게 느껴지나?
5. 숙제 같나, 게임 같나? 1(숙제) ~ 5(게임).
6. 밑줄 친 말을 모르고도 「해내기」를 찍어서 맞힐 수 있을 것 같나? 어떻게?
7. 싸 보이거나 어색한 곳(글 · 배치 · 말투).

끝에 셋을 견주어 답한다:
8. 셋 가운데 내일 또 하고 싶은 판 꼴 하나와 까닭. 가장 재미없는 판 꼴 하나와 까닭.
9. 수첩 뜻 맞추기는 재밌나, 귀찮나? 없으면 더 낫나?
10. 이 게임을 다시 하게 만들 한 가지를 고친다면?

마지막 줄에 JSON 한 줄: {"끝까지":{"판1":n,"판2":n,"판3":n},"게임같음":{"판1":n,"판2":n,"판3":n},"또할판":"판N","재미없는판":"판N","수첩":"재밌다|귀찮다|없어도됨"}
`;
}

function 해독질문(이름) {
  const 묶음 = 판들.map((R) => {
    const { 공지, 상황, 단계 } = 판글(R, 'unknown');
    return `## 판 ${R.id} — ${R.kind}\n\n${상황}\n\n게시물:\n\`\`\`\n${공지}\n\`\`\`\n\n${단계}`;
  }).join('\n\n---\n\n');
  return `${공통질문머리(이름)}
이 사람은 아래 게시물에서 〔①〕 〔②〕처럼 가린 말을 모른다. 가린 말의 원래 낱말을 맞히려 하지 말고, 이 사람이 게시물의 앞뒤 · 숫자 · 다른 게시물만 보고 그 말의 뜻을 어떻게 짐작할지 한국어 쉬운 말로 쓴다. 그다음 「해내기」에서 고른다. 한 판에 실제로 몇 분 걸릴지도 쓴다.

${묶음}

판마다 이렇게 답한다:
- 〔①〕~〔④〕 각각: 짐작한 뜻(쉬운 한국어 한 줄) · 어디를 보고 짐작했나 · 확신 1~5
- 해내기 답: 칸마다 고른 기호(a, b, c …)와 까닭 한 줄
- 이 판에서 가장 막힌 곳

마지막 줄에 JSON 한 줄(판마다 칸 이름은 해내기 순서대로 1a, 1b, 2a …): {"A":{"뜻":{"①":"…","②":"…","③":"…","④":"…"},"답":{"1a":"b","1b":"c","2a":"…","2b":"…"}},"B":{…},"C":{…}}
`;
}

function 안읽고질문(이름) {
  const 묶음 = 판들.map((R, i) => {
    const { 상황, 단계 } = 판글(R, 'all');
    return `## 판 ${R.id} — 그림 ${R.id}_가림.png\n\n${상황}\n\n${단계}`;
  }).join('\n\n---\n\n');
  return `너는 게임의 허점을 찾는 시험관이다. 아래 그림은 게시물의 한글을 모두 ▢로 가린 판이다(숫자 · 기호 · 배치 · 색은 그대로, 모르는 말 자리는 ①②로 표시). 게시물을 읽지 않고, 숫자 · 배치 · 상황 글 · 고르기 보기의 말투 · 상식만으로 「해내기」의 정답을 찍어 맞혀 본다. 모르면 가장 그럴듯한 것을 고른다(빈칸 없이).

${묶음}

판마다: 칸마다 고른 기호와 무엇을 보고 골랐나 한 줄. 끝에 「이 게임에서 읽지 않고 풀리는 허점」을 셋까지.
마지막 줄에 JSON 한 줄: {"A":{"1a":"b","1b":"c","2a":"…","2b":"…"},"B":{…},"C":{…}}
`;
}

function 폴더(종류, 이름, 그림들, 질문) {
  const 곳 = path.join(밖, 종류, 이름);
  if (fs.existsSync(path.join(곳, '답.md'))) throw new Error(`답이 든 폴더는 덮지 않는다: ${곳}`);
  fs.mkdirSync(곳, { recursive: true });
  for (const [원, 새] of 그림들) fs.copyFileSync(path.join(밖, '판', 원 + '.png'), path.join(곳, 새 + '.png'));
  fs.writeFileSync(path.join(곳, '질문.md'), 질문);
  return 곳;
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const 점검 = await 찍기();
  console.log(JSON.stringify(점검, null, 1));
  if (!인자.has('--찍기만')) {
    for (const 이름 of Object.keys(시험관들)) {
      const 그림 = [];
      시험관들[이름].순서.forEach((id, i) => {
        ['1게시판', '1게시판전체', '2수첩', '3해내기1', '4헤맴', '6끝'].forEach((화면, j) => 그림.push([`${id}_${화면}`, `${i + 1}_${j + 1}`]));
      });
      폴더('시험관', 이름, 그림, 재미질문(이름));
    }
    for (const 이름 of ['해독_1', '해독_2', '해독_3']) 폴더('해독', 이름, [], 해독질문('몽골여_3급'));
    for (const 이름 of ['안읽고_1', '안읽고_2']) 폴더('안읽고', 이름, 판들.map((R) => [`${R.id}_가림_한글전부`, `${R.id}_가림`]), 안읽고질문(이름));
    console.log('시험관 묶음 →', 밖);
  }
}
