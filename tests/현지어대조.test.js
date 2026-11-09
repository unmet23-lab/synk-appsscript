'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const C = require('../tools/현지어대조.js');

const 예전꼴 = [
  '[화면 글]', '1. 화가 났을 때 하는 한국어 네 마디', '2. 정말 짜증 나!', '3. 버스가 바로 내 눈앞에서 떠나 버렸다…', '[게시글]', '4. 댓글에 적어 주세요 👇',
  '---',
  '[화면 글]', '1. စိတ်ဆိုးတဲ့အခါ ပြောတဲ့ ကိုရီးယားစကား ၄ ခွန်း', '2. စိတ်ညစ်လိုက်တာ!', '3. ဘတ်စ်ကားက မျက်စိရှေ့မှာတင် ထွက်သွားတယ်…', '[게시글]', '4. ကွန်မန့်မှာ ရေးပေးပါဦး 👇',
].join('\n');

// 가짜 호출기 — 프롬프트의 [id] 줄마다 답한다. id가 3으로 끝나면 어색, 4로 끝나면 불편, 웃음 줄은 웃음까닭. 받은 id를 기록한다.
function 가짜(옵션 = {}) {
  const 받은 = [];
  const 부름 = async (model, prompt) => {
    const 줄 = [...String(prompt).matchAll(/^\[([^\]]+)\] \(([^)]*)\) (.*)$/gm)].map((m) => ({ id: m[1], 대조: m[2], 글: m[3] }));
    받은.push({ model, ids: 줄.map((x) => x.id), prompt });
    if (/문법·맞춤법/.test(prompt)) {
      return JSON.stringify({ 줄: 줄.filter((x) => !(옵션.빠짐 || []).includes(x.id)).map((x) => ({ id: x.id, 판정: x.id.endsWith('3') ? '어색' : '정상', ...(x.id.endsWith('3') ? { 문제: '어순', 고침: `${x.글}!` } : {}), ...(x.id.endsWith('4') ? { 불편: '이 나라에서 거슬린다' } : {}) })) });
    }
    return JSON.stringify({ 줄: 줄.map((x) => ({ id: x.id, 직역: `직역:${x.글}`, ...(x.대조.startsWith('웃음') ? { 웃음까닭: '글자 그대로' } : {}) })) });
  };
  return { 부름, 받은 };
}

test('예전 꼴 — 번호로 원문과 짝짓고, [구역] 줄은 장면 맥락이 된다. 수가 다르면 경고', () => {
  const r = C.예전꼴줄(예전꼴, { 이름: 'my.txt', 웃음: ['2'] });
  assert.equal(r.줄.length, 4);
  assert.deepEqual(r.줄.map((z) => z.id), ['1', '2', '3', '4']);
  assert.equal(r.줄[2].원문, '버스가 바로 내 눈앞에서 떠나 버렸다…');
  assert.equal(r.줄[3].장면, '게시글');
  assert.equal(r.줄[1].대조, '웃음');
  assert.deepEqual(r.경고, []);
  const 번호없음 = C.예전꼴줄('가\n나\n---\nA\n', {});
  assert.equal(번호없음.줄.length, 1);
  assert.match(번호없음.경고[0], /수가 달라/);
  assert.equal(C.예전꼴줄('---\n없음'), null);
});

test('판본 글 — 한국어 · 읽기 줄은 빼고, 대조 방식은 칸이 정한다(딱지 · 개그 · 해설 = 웃음)', () => {
  const 줄 = C.판본글줄({ 편: '편', 판본: 'TH', 줄: [
    { id: 'ko', 칸: '한국어', 글: '배꼽' }, { id: 'say', 칸: '읽기', 글: 'bae' },
    { id: 'tag', 칸: '딱지', 글: 'สะดือหลุด?', 원문: '배꼽이 빠진다?', 장면: '곰' }, { id: 'o1', 칸: '보기', 글: 'ขำ' }, { id: 'x', 칸: '보기', 글: 'ข', 대조: '웃음' },
  ] }, 'th.json');
  assert.deepEqual(줄.map((z) => [z.id, z.대조]), [['tag', '웃음'], ['o1', '직역'], ['x', '웃음']]);
  assert.equal(줄[0].편, '편');
  assert.equal(줄[0].판본, 'TH');
});

test('섞기 — 같은 입력이면 늘 같은 순서, 원소는 그대로. 12줄 묶음', () => {
  const a = Array.from({ length: 30 }, (_, i) => i);
  assert.deepEqual(C.섞기(a, '씨앗'), C.섞기(a, '씨앗'));
  assert.notDeepEqual(C.섞기(a, '씨앗'), a);
  assert.deepEqual([...C.섞기(a, '씨앗')].sort((x, y) => x - y), a);
  assert.deepEqual(C.묶기(a).map((b) => b.length), [12, 12, 6]);
});

test('대조 — 줄마다 판정(문법 · 불편 · 역번역), 원문은 프롬프트에 없고, 웃음 줄은 웃음까닭을 받는다', async () => {
  const { 줄 } = C.예전꼴줄(예전꼴, { 웃음: ['2'] });
  const g = 가짜();
  const r = await C.대조하기({ 줄들: 줄, 언어이름: '버마어', 부름: g.부름, 문법모델: 'argon', 역모델: 'flash', 나라말: '미얀마', 금기: '- [손짓] 머리' });
  assert.deepEqual(r.줄.map((x) => x.판정), ['거름망 통과', '거름망 통과', '검수 필요', '검수 필요']);
  assert.deepEqual(r.줄[2].까닭, ['문법 어색']);
  assert.deepEqual(r.줄[3].까닭, ['불편한 표현 · 그림']);
  assert.equal(r.줄[1].웃음까닭, '글자 그대로');
  assert.match(r.줄[0].직역, /^직역:/);
  for (const 받 of g.받은) {
    assert.ok(!받.prompt.includes('버스가 바로'), '원문이 프롬프트에 실렸다');
    assert.ok(!받.prompt.includes('[화면 글]'));
  }
  assert.match(g.받은[0].prompt, /미얀마 시청자에게 불편/);
  assert.match(g.받은[0].prompt, /- \[손짓\] 머리/);
  assert.match(g.받은[0].prompt, /\(직역 · 장면: 화면 글\)/);
});

test('대조 — 답에 빠진 줄은 판정불능, 문법만이면 역번역을 안 부른다', async () => {
  const { 줄 } = C.예전꼴줄(예전꼴);
  const g = 가짜({ 빠짐: ['1'] });
  const r = await C.대조하기({ 줄들: 줄, 언어이름: '버마어', 부름: g.부름, 문법모델: 'argon', 역모델: 'flash', 문법만: true });
  assert.deepEqual(r.줄[0].까닭, ['문법 판정불능']);
  assert.equal(r.줄[1].직역, null);
  assert.equal(r.줄[1].판정, '거름망 통과');
  assert.ok(g.받은.every((x) => x.model === 'argon'));
});

test('대조 — 이전 결과가 있으면 글이 같은 줄은 잇고 바뀐 줄만 다시 묻는다(Fable이 고친 최종 판)', async () => {
  const { 줄 } = C.예전꼴줄(예전꼴);
  const 첫 = await C.대조하기({ 줄들: 줄, 언어이름: '버마어', 부름: 가짜().부름, 문법모델: 'a', 역모델: 'f' });
  const 이전 = new Map(첫.줄.map((x) => [x.id, x]));
  const 고친 = 줄.map((z) => (z.id === '3' ? { ...z, 글: 'ဘတ်စ်ကား ထွက်သွားပြီ…' } : z));
  const g = 가짜();
  const r = await C.대조하기({ 줄들: 고친, 언어이름: '버마어', 부름: g.부름, 문법모델: 'a', 역모델: 'f', 이전결과: 이전 });
  assert.equal(r.다시본줄, 1);
  assert.equal(r.이은줄, 3);
  assert.ok(g.받은.every((x) => x.ids.length === 1 && x.ids[0] === '3'));
  assert.equal(r.줄[0].이음, true);
});

test('명령줄 — 예전 쓰임(--언어 · --파일)이 그대로 돌고 종료 코드 2(검수 필요), 결과 JSON · Opus 질문을 남기고 --대조표로 Opus 직역을 붙인다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), '현지어대조-'));
  const 파일 = path.join(방, 'my.txt');
  fs.writeFileSync(파일, 예전꼴);
  const 가짜파일 = path.join(방, '가짜호출.js');
  fs.writeFileSync(가짜파일, `'use strict';
module.exports.부르기 = async ({ prompt }) => {
  const 줄 = [...String(prompt).matchAll(/^\\[([^\\]]+)\\] \\(([^)]*)\\) (.*)$/gm)].map((m) => ({ id: m[1], 글: m[3] }));
  if (/문법·맞춤법/.test(prompt)) return { text: JSON.stringify({ 줄: 줄.map((x) => ({ id: x.id, 판정: x.id === '3' ? '파손' : '정상' })) }) };
  return { text: JSON.stringify({ 줄: 줄.map((x) => ({ id: x.id, 직역: '직역 ' + x.id })) }) };
};
`);
  const env = { ...process.env, SYNK_LOCALCHECK_CALLER: 가짜파일 };
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', '현지어대조.js'), '--언어', '버마어', '--파일', 파일], { env, encoding: 'utf8' });
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stdout, /■ 줄마다/);
  assert.match(r.stdout, /\[3\] · 직역 — 검수 필요 · 문법 파손/);
  assert.match(r.stdout, /거름망 통과 3줄 · 검수 필요 1줄 \(3\)/);
  const 결과 = JSON.parse(fs.readFileSync(`${파일}.대조.json`, 'utf8'));
  assert.equal(결과.줄.length, 4);
  assert.deepEqual(결과.나라, ['MM']);
  const opus = fs.readFileSync(`${파일}.대조.역번역_질문.md`, 'utf8');
  assert.ok(!opus.includes('버스가 바로'));
  assert.match(opus, /\[3\] \(직역/);
  // Opus 답을 붙인다(호출 없음)
  const 답 = path.join(방, 'opus.md');
  fs.writeFileSync(답, '```json\n{"줄": [{"id": "3", "직역": "버스가 눈앞에서 가 버렸다"}]}\n```');
  const t = spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', '현지어대조.js'), '--대조표', `${파일}.대조.json`, '--역번역답', 답], { encoding: 'utf8' });
  assert.equal(t.status, 2, t.stderr);
  assert.match(t.stdout, /직역\(Opus\): 버스가 눈앞에서 가 버렸다/);
  assert.equal(JSON.parse(fs.readFileSync(`${파일}.대조.json`, 'utf8')).줄[2].직역Opus, '버스가 눈앞에서 가 버렸다');
  // 모든 줄이 정상이면 0
  fs.writeFileSync(가짜파일, `'use strict';
module.exports.부르기 = async ({ prompt }) => {
  const 줄 = [...String(prompt).matchAll(/^\\[([^\\]]+)\\] /gm)].map((m) => m[1]);
  return { text: JSON.stringify({ 줄: 줄.map((id) => (/문법·맞춤법/.test(prompt) ? { id, 판정: '정상' } : { id, 직역: '직역' })) }) };
};
`);
  const ok = spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', '현지어대조.js'), '--언어', '버마어', '--파일', 파일, '--밖', path.join(방, 'ok.json')], { env, encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  // 파일 형식이 아니면 1
  fs.writeFileSync(path.join(방, 'bad.txt'), '구분 없음');
  const bad = spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', '현지어대조.js'), '--언어', '버마어', '--파일', path.join(방, 'bad.txt')], { env, encoding: 'utf8' });
  assert.equal(bad.status, 1);
  fs.rmSync(방, { recursive: true, force: true });
});
