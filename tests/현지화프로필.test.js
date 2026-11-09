'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../tools/lib/현지화프로필.js');

const 원장 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', '마케팅', 'sns-계정.json'), 'utf8'));

test('세 파일의 꼴이 맞고, 원장 LAB 계정의 언어 · 나라가 프로필에 다 있다', () => {
  assert.deepEqual(P.검증({ 원장 }), []);
  assert.equal(P.언어목록().length, 21);
  assert.equal(P.나라목록().length, 25);
  const lab = Object.values(원장.accounts).filter((a) => a.brand === 'LAB');
  for (const a of lab) {
    assert.ok(P.언어(a.language), `언어 ${a.language}`);
    assert.ok(P.나라(a.countryCode), `나라 ${a.countryCode}`);
  }
});

test('언어는 코드 · 한국어 이름 · 다른 이름으로 찾는다(현지어대조 --언어 "버마어" 예전 쓰임)', () => {
  assert.equal(P.언어('th').코드, 'th');
  assert.equal(P.언어('태국어').코드, 'th');
  assert.equal(P.언어('버마어').코드, 'my');
  assert.equal(P.언어('미얀마어').코드, 'my');
  assert.equal(P.언어('간체 중국어').코드, 'zh-Hans');
  assert.equal(P.언어('zhs').코드, 'zh-Hans');
  assert.equal(P.언어('번체 중국어(대만)').코드, 'zh-Hant');
  assert.equal(P.언어('없는말'), null);
});

test('언어마다 렌더 전 검사가 읽는 칸이 차 있다 — 띄어 쓰지 않는 언어 · 결합 문자 · 금칙', () => {
  for (const code of ['th', 'my', 'km', 'zh-Hans', 'zh-Hant', 'ja']) assert.equal(P.언어(code).낱말경계, 'Intl.Segmenter', code);
  for (const code of ['th', 'my', 'km', 'si', 'hi', 'ne']) assert.equal(P.언어(code).결합문자.있음, true, code);
  assert.ok(P.언어('ja').줄머리금지.includes('。'));
  assert.ok(P.언어('zh-Hans').줄머리금지.includes('，'));
  assert.ok(P.언어('th').줄머리금지.includes('ๆ'));
  assert.equal(P.언어('es').문장부호.여는부호['?'], '¿');
  assert.equal(P.언어('my').자동줄바꿈, '확인');
  // 읽기 속도는 모두 어림으로 표시한다(원문 숫자 대조 전)
  for (const code of P.언어목록()) assert.equal(P.언어(code).읽기속도.어림, true, code);
});

test('글꼴 — 굵기는 가장 가까운 파일, 윈도우 경로는 %WINDIR%를 푼다, 일반 이름(sans-serif)은 뺀다', () => {
  const f = P.글꼴파일('Inter Tight', 800);
  assert.equal(f.굵기, 700);
  assert.match(f.파일.replace(/\\/g, '/'), /docs\/브랜드_폰트\/InterTight\/InterTight-Bold\.ttf$/);
  const n = P.글꼴파일('Nirmala UI', 700);
  assert.equal(n.번호, 1);
  assert.match(n.파일, /Fonts\/Nirmala\.ttc$/);
  assert.deepEqual(P.글꼴줄이름("'Inter Tight', 'SUIT', 'Leelawadee UI', sans-serif"), ['Inter Tight', 'SUIT', 'Leelawadee UI']);
  assert.deepEqual(P.글꼴줄이름("var(--kids-font, 'Inter Tight', 'SUIT', sans-serif)"), ['Inter Tight', 'SUIT']);
  const { 파일, 모름 } = P.글꼴줄파일("'Inter Tight', 'Comic Sans MS', sans-serif");
  assert.equal(파일.length, 1);
  assert.deepEqual(모름, ['Comic Sans MS']);
});

test('계정 → 언어 · 나라 · 판본 키. @synkkorean은 판본 키 EN이라 영어 나라 전부를 시청자로 본다', () => {
  const yt = P.계정('lab-youtube', { 원장 });
  assert.equal(yt.판본키, 'EN');
  assert.deepEqual(yt.나라코드, ['US', 'CA', 'AU', 'NZ']);
  assert.match(yt.나라설명, /EN/);
  const my = P.계정('lab-my-youtube', { 원장 });
  assert.equal(my.언어.코드, 'ms');
  assert.deepEqual(my.나라코드, ['MY']);
  assert.equal(my.판본키, 'MY');
  assert.equal(P.계정('없는계정', { 원장 }), null);
});

test('그림 지시문 금기 — 나라마다 다르고, 원본은 모든 LAB 나라를 합친다', () => {
  const my = P.금기문장(['MY']);
  assert.match(my, /pig or pork/);
  assert.match(my, /national flag/); // 공통
  const us = P.금기문장(['US']);
  assert.doesNotMatch(us, /pig or pork/);
  const 원본 = P.원본금기문장({ 원장 });
  for (const s of ['pig or pork', 'beef', 'green hat', 'chopsticks standing upright in rice', 'Buddha statue']) assert.match(원본, new RegExp(s), s);
  assert.match(P.금기문장(['TH'], { 말: 'ko' }), /^이 그림은 태국 계정에 나간다/);
  // 중국권 계정은 지도 · 국기를 서로 반대로 피한다(설계 10)
  assert.match(P.금기문장(['CN']), /Taiwan flag/);
  assert.match(P.금기문장(['TW']), /People's Republic of China/);
  const 요약 = P.금기요약(['IN']);
  assert.match(요약, /\[음식 · IN\] 소고기/);
});

test('관용구 대응 — 있음 · 없음 · 모름을 가르고, 같은 그림 · 같은 뜻이면 오답 딱지 경고', () => {
  assert.equal(P.관용구대응('우물 안 개구리', 'vi').확인, '있음');
  assert.equal(P.관용구대응('우물 안 개구리', 'en').확인, '없음');
  assert.equal(P.관용구대응('우물 안 개구리', 'kk').확인, '모름');
  assert.equal(P.관용구대응('없는 관용구', 'th').확인, '모름');
  // 퀴즈 #6 간체판 기록 — 「太阳从西边升起？」가 오답으로 안 읽혔다
  const 해 = P.오답딱지경고('해가 서쪽에서 뜨다', 'zh-Hans');
  assert.equal(해.수준, '고칠 것');
  assert.match(해.말, /太阳从西边出来了/);
  // 퀴즈 #6 몽골판 — 같은 그림 · 다른 뜻은 함정(확인할 것)
  assert.equal(P.오답딱지경고('바람맞다', 'mn').수준, '확인할 것');
  // 비슷한 그림 · 같은 뜻도 확인할 것
  assert.equal(P.오답딱지경고('배꼽이 빠지다', 'th').수준, '확인할 것');
  // 그림이 다르면 경고 없음
  assert.equal(P.오답딱지경고('배꼽이 빠지다', 'es'), null);
});
