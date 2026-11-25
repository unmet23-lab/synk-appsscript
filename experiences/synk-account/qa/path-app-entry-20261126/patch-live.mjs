#!/usr/bin/env node
// 웹 플랫폼의 PATH 칸과 PATH 소개 쪽을 PATH 앱으로 잇는 공개 후보를 짓는다(2026-11-26).
// 공개본 account/dist/platform.js는 master 빌드와 구성이 달라 통째로 덮지 않고, 바뀐 조각만 얹는다.
//   node patch-live.mjs <공개본 폴더> <master 새 빌드 platform.js> <후보 폴더>
// 단언: 조각마다 공개본에서 한 번만 맞고, 되돌리면 공개본과 바이트까지 같고, 묶음이 문법상 읽힌다.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const [live, build, out] = process.argv.slice(2);
if (!out) { console.error('쓰기: node patch-live.mjs <공개본 폴더> <새 빌드> <후보 폴더>'); process.exit(2); }
const read = file => fs.readFileSync(file, 'utf8');
const B = read(build).replace(/\r\n/g, '\n');
const cut = (s, from, to) => { const i = s.indexOf(from), j = s.indexOf(to, i); assert.ok(i >= 0 && j > i, from); return s.slice(i, j); };
function apply(file, pairs) {
  const before = read(path.join(live, file)); let text = before;
  for (const [a, b] of pairs) { assert.equal(text.split(a).length, 2, `${file}: ${a.slice(0, 70)}`); text = text.replace(a, () => b); }
  let back = text;
  for (const [a, b] of [...pairs].reverse()) { assert.equal(back.split(b).length, 2, `${file} 되돌리기: ${b.slice(0, 70)}`); back = back.replace(b, () => a); }
  assert.equal(back, before, file);
  fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
  fs.writeFileSync(path.join(out, file), text);
  console.log(file, before.length, '→', text.length, `조각 ${pairs.length}`);
  return text;
}

// 1. 웹 플랫폼
const L = read(path.join(live, 'account/dist/platform.js'));
const platform = apply('account/dist/platform.js', [
  ['var PATH_INTERVIEW_URL="', 'var PATH_APP_URL="https://synk.im/path/app/";var PATH_INTERVIEW_URL="'],
  ['"keywords":["패스","면접","진로","취업","유학","VR","Quest","음성","가상 캠퍼스"],"subtitle":"세 면접관 앞에서 미리 해 보는 60~90초 면접 연습"', '"keywords":["패스","유학","대학","입학","서류","장학금","면접","진로","취업","VR","Quest"],"subtitle":"대학 비교부터 서류, 입학 면접까지 챙기는 한국 유학 준비 앱"'],
  ['"tags":["면접 연습","60~90초","한국어 음성","Quest VR"],"description":"질문에 말로 답하면, 듣고 받아 적던 면접관이 내 답에 맞춰 다음 질문을 해요.","available":"PC에서는 글이나 목소리로 답하고, Quest 브라우저에서는 VR로 들어가 목소리로 답해요."', '"tags":["한국 유학","대학 비교","서류 준비","면접 연습"],"description":"내 한국어와 성적, 준비한 돈을 넣으면 대학 모집 요강의 조건과 나란히 보여 줘요.","available":"휴대폰과 PC의 브라우저에서 바로 열려요. 로그인하지 않아도 둘러볼 수 있어요."'],
  ['href:"https://synk.im/path/interview/film/rehearsal.html",label:"면접 연습 열기 ↗"', 'href:PATH_APP_URL,label:"PATH 열기 ↗"'],
  ['href:PATH_INTERVIEW_URL,trackAppId:"path"', 'href:PATH_APP_URL,trackAppId:"path"'],
  ['id2==="path"?PATH_INTERVIEW_URL:', 'id2==="path"?PATH_APP_URL:'],
  ['web=app.id==="path"?PATH_INTERVIEW_URL:', 'web=app.id==="path"?PATH_APP_URL:'],
  ['app.id==="path"?"면접 연습 열기":', 'app.id==="path"?"PATH 열기":'],
  ['app.id==="path"?"면접 연습":', 'app.id==="path"?"한국 유학 준비":'],
  ['name:"PATH",description:"실전 면접 연습"', 'name:"PATH",description:"한국 유학 준비"'],
  ['솔리오 소개와 웹에서 여는 면접 연습을 먼저', '솔리오 소개와 웹에서 여는 PATH를 먼저'],
  ['PATH 면접 연습, 플레저는 웹에서', 'PATH, 플레저는 웹에서'],
  ['if(app.webOnly)return"웹에서 연습"', 'if(app.webOnly)return"웹에서 열림"'],
  [cut(L, 'function pathAppPage(app){', 'function launchControls('), cut(B, 'function pathAppPage(app){', 'function launchControls(')],
]);
new Function(platform);
assert.equal(platform.split('PATH_APP_URL').length - 1, 5);
assert.equal(platform.split('PATH_INTERVIEW_URL').length - 1, 2);

// 2. PATH 소개 쪽(한 · 영). 이 쪽의 정본은 공개본이다.
const link = text => `<a class="pa-st-go" href="/path/app/">${text} <span class="arr" aria-hidden="true">→</span></a>`;
const inline = text => `<a href="/path/app/" style="color:inherit;text-decoration:underline;text-underline-offset:4px">${text}</a>`;
const swap = (s, pairs) => pairs.reduce((t, [a, b]) => { assert.equal(t.split(a).length, 2, a); return t.replace(a, () => b); }, s);
const rows = (s, keys) => keys.map(([key, pairs]) => { const line = s.split('\n').find(one => one.includes(key)); assert.ok(line, key); return [line, swap(line, pairs)]; });

const koDesc = [['유학과 일자리 준비는 차례로 엽니다', '유학 준비는 PATH 앱에서 하고, 일자리 준비는 차례로 엽니다']];
apply('path/index.html', rows(read(path.join(live, 'path/index.html')), [
  ['<meta name="description"', koDesc],
  ['property="og:description"', koDesc],
  ['data-intro', [['유학과 일자리 준비는 차례로 엽니다.', `유학 준비는 ${inline('PATH 앱')}에서 하고, 일자리 준비는 차례로 엽니다.`]]],
  ['id="road-title"', [['지금 열린 것은 둘, 면접 연습과 서울 하루입니다. 나머지 넷은', '지금 열린 것은 셋, 서울 하루와 유학 준비, 면접 연습입니다. 나머지 셋은']]],
  ['<ol class="pa-stations">', [
    ['<li class="pa-st" id="study">', '<li class="pa-st is-live" id="study">'],
    ['<p class="pa-st-one">전공과 진로에 맞춰 유학을 준비합니다.</p>', `<p class="pa-st-one">PATH 앱에서 대학 조건을 비교하고 서류를 챙깁니다.</p>${link('PATH 앱 열기')}`],
    ['희망 전공과 진로에 맞춰 학교별 조건을 비교하고, 한국어 수준과 남은 시간에 맞는 일정을 세우는 일을 준비하고 있습니다.', 'PATH 앱에서 대학 모집 요강의 조건과 내 조건을 견주고, 고른 과정의 서류와 마감일을 챙깁니다. 아래의 상담과 함께하는 지원은 준비하고 있습니다.'],
  ]],
]));

const enDesc = [['study and job preparation open one at a time', 'prepare to study in the PATH app, and job preparation opens next']];
apply('en/path/index.html', rows(read(path.join(live, 'en/path/index.html')), [
  ['<meta name="description"', enDesc],
  ['property="og:description"', enDesc],
  ['data-intro', [['Study-abroad and job preparation open next, one at a time.', `Prepare to study in the ${inline('PATH app')}; job preparation opens next.`]]],
  ['id="road-title"', [['Two things are open now: interview practice and a day in Seoul. The other four open', 'Three things are open now: a day in Seoul, preparing to study and interview practice. The other three open']]],
  ['<ol class="pa-stations">', [
    ['<li class="pa-st" id="study">', '<li class="pa-st is-live" id="study">'],
    ['<p class="pa-st-one">Preparing to study in Korea around your major and career.</p>', `<p class="pa-st-one">Compare university requirements and keep track of documents in the PATH app.</p>${link('Open the PATH app')}`],
    ['We are getting ready to compare schools with you by the conditions that matter for your major and career, and to set a timeline that fits your Korean level and the time you have.', 'In the PATH app you compare your own conditions with each university’s admission guide and keep track of the documents and deadlines for the program you choose. The support below, with a consultation, is being prepared.'],
  ]],
]));
