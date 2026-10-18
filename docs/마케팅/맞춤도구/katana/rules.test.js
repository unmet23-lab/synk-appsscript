// 실행: node --test "docs/마케팅/맞춤도구/katana/rules.test.js"
// 추천기준.md §7의 약속과 제작절차.md의 검사를 지킨다.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const R = require('./rules.js');
const C = require('./content.js');
const V = require('./view.js');
const { checkContent, checkTipIds } = require('../core/content-check.js');

const base = { hero: 'character', style: 'aura', input: 'many', where: 'shorts', quality: 'p480', keep: ['shape', 'nomusic', 'calm'] };
const run = extra => R.compute({ ...base, ...extra });
const ALL = [];
for (const hero of ['product', 'food', 'character', 'place', 'person'])
  for (const style of ['ad', 'aura', 'clip', 'ref'])
    for (const input of ['one', 'many', 'video'])
      for (const where of ['shorts', 'store', 'wide'])
        for (const quality of ['p480', 'p720', 'p1080'])
          ALL.push({ hero, style, input, where, quality, keep: ['nomusic'] });

test('제작 절차: 탐색노트·추천기준이 있고 질문·팁 은행이 검사를 통과한다', () => {
  for (const doc of ['탐색노트.md', '추천기준.md']) assert.ok(fs.existsSync(path.join(__dirname, doc)), `${doc} 없음`);
  assert.deepEqual(checkContent(C), []);
});

test('모든 요청문에 상한·화질·보고 줄이 있고, 결과가 고른 팁은 모두 은행에 있다', () => {
  for (const a of ALL) {
    const rec = R.compute(a);
    assert.match(rec.prompt, new RegExp(`크레딧은 전부 합쳐 ${rec.est.cap} 안에서만`), JSON.stringify(a));
    assert.match(rec.prompt, new RegExp(`${{ p480: '480p', p720: '720p', p1080: '1080p' }[a.quality]}로`), JSON.stringify(a));
    assert.match(rec.prompt, /끝나면 알려 줘: 쓴 크레딧, 걸린 시간/);
    assert.ok(rec.est.low < rec.est.high && rec.est.cap >= rec.est.high, JSON.stringify(rec.est));
    assert.deepEqual(checkTipIds(rec.tips, C), []);
    assert.ok(!/undefined|NaN/.test(rec.prompt + rec.headline.title + rec.headline.sub), JSON.stringify(a));
  }
});

test('쇼츠 480p 어림이 10-13 실제 두 결과(42.12·84.24크레딧)를 포함한다', () => {
  for (const style of ['ad', 'aura']) {
    const { est } = run({ style });
    assert.ok(est.low <= 42.12 && est.high >= 84.24, JSON.stringify(est));
    assert.ok(est.cap <= 150, '10-13 두 요청의 상한(150)보다 크지 않다');
  }
});

test('1080p는 4배 경고, 480p는 업스케일 팁', () => {
  const hi = run({ quality: 'p1080' });
  assert.match(hi.warns.map(w => w.t).join(' '), /4배/);
  assert.ok(run({}).tips.includes('cost-upscale'));
  assert.ok(R.estimate({ where: 'shorts', quality: 'p1080' }).high > R.estimate({ where: 'shorts', quality: 'p480' }).high * 3.5);
});

test('남의 노래 없이를 고르면 잠금과 팁, 안 고르면 저작권 경고와 다른 팁', () => {
  assert.match(run({}).prompt, /남의 노래\(틱톡 음원 포함\)는 쓰지 말고 효과음만\. 소리 없는 판도 같이 줘/);
  assert.ok(run({}).tips.includes('sound-music'));
  const open = run({ keep: ['shape'] });
  assert.match(open.warns.map(w => w.t).join(' '), /저작권 주장/);
  assert.match(open.prompt, /음악 출처/);
  assert.ok(open.tips.includes('sound-open') && !open.tips.includes('sound-music'));
  assert.doesNotMatch(JSON.stringify(C), /무음판/);
  assert.match(R.compute({ hero: 'product', style: 'ad', input: 'many', where: 'shorts', quality: 'p480' }).prompt, /효과음만/);
});

test('주인공별 잠금: 캐릭터는 팔다리·입, 제품은 로고·글자, 사람은 얼굴·옷과 동의·AI 표시', () => {
  assert.match(run({}).prompt, /팔다리나 입처럼 사진에 없는 부분을 새로 붙이지 마/);
  const prod = run({ hero: 'product', style: 'ad', keep: ['logo', 'shape', 'nomusic'] });
  assert.match(prod.prompt, /로고와 글자는 사진에 있는 것만 쓰고 새로 지어내지 마/);
  assert.doesNotMatch(prod.prompt, /팔다리/);
  const person = run({ hero: 'person', style: 'ad' });
  assert.match(person.prompt, /얼굴과 옷은 사진의 것만/);
  assert.match(person.warns.map(w => w.t).join(' '), /동의한 사진만.*AI 사용/);
  assert.ok(person.tips.includes('identity-person'));
  assert.ok(person.checklist.some(c => c.id === 'ai-label'));
});

test('가진 영상 편집인데 사진뿐이면 경고하고 새 장면 요청문으로 바꾼다(캐릭터·사람은 아우라, 그 밖은 제품 광고)', () => {
  const photo = run({ style: 'clip', input: 'one' });
  assert.match(photo.warns.map(w => w.t).join(' '), /영상이 있어야.*아우라 에딧 요청문으로/);
  assert.match(photo.prompt, /아우라 파밍 에딧을 만들어 줘/);
  assert.match(run({ hero: 'place', style: 'clip', input: 'one' }).prompt, /제품 광고 영상을 만들어 줘/);
  assert.match(photo.prompt, /붙인 사진 속/);
  assert.doesNotMatch(run({ input: 'many' }).prompt, /사진들/);
  const video = run({ style: 'clip', input: 'video' });
  assert.equal(video.warns.length, 0);
  assert.match(video.prompt, /붙인 영상 속 캐릭터가 주인공인 편집 영상/);
  assert.match(video.prompt, /캐릭터의 모양·색·무늬는 영상 그대로/);
  assert.match(video.prompt, /붙인 영상을 그대로 쓴 장면/);
  assert.match(video.checklist.map(c => c.t).join(' '), /영상과 같은지/);
  assert.ok(video.est.high < run({}).est.high, '편집은 새 생성보다 어림이 작다');
});

test('레퍼런스 리믹스는 링크 자리를 두고, 레퍼런스 주소를 따로 묻지 않는다', () => {
  const ref = run({ style: 'ref' });
  assert.match(ref.prompt, /\[여기에 영상 링크를 붙여 넣으세요\]/);
  assert.doesNotMatch(ref.prompt, /고른 레퍼런스 주소/);
  assert.match(run({}).prompt, /고른 레퍼런스 주소/);
});

test('회전·흔들림 잠금과 아우라의 첫 컷 줄', () => {
  assert.match(run({}).prompt, /화면 회전·스핀·잦은 흔들림은 넣지 말고, 번쩍임은 약하게/);
  assert.doesNotMatch(run({ keep: ['nomusic'] }).prompt, /회전·스핀/);
  assert.match(run({}).prompt, /첫 컷에서도 주인공이 작게 묻히지 않게/);
  assert.ok(run({}).tips.includes('motion-flash'));
});

test('영상 속 실제 요청 두 개는 10-13 결과 숫자와 맞고 결과 화면에 그대로 실린다', () => {
  assert.deepEqual(C.examples.map(e => e.id), ['ad', 'aura']);
  assert.match(C.examples[0].result, /42\.12크레딧/);
  assert.match(C.examples[1].result, /84\.24크레딧/);
  for (const e of C.examples) {
    assert.match(e.text, /480p, 크레딧 150 안에서/);
    assert.match(e.text, /남의 노래 없이 효과음만/);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', `katana-ex-${e.id}.webp`)));
  }
  const rec = run({});
  const out = V.result({ rec, answers: base, layout: 'guided', plan: null, tipsOn: true, checks: {}, feedbackGiven: null, content: C, rules: R });
  assert.ok(out.html.includes('영상 속 실제 요청 두 개'));
  assert.equal(out.texts.prompt, rec.prompt);
  assert.equal(out.texts['ex-aura'], C.examples[1].text);
  assert.match(out.texts.all, /\/katana 뒤에 붙여 넣을 요청문/);
});

test('연결 주소는 전체 URL, 상한은 강제 장치가 아니라고 밝힌다', () => {
  const rec = run({});
  assert.match(rec.flow[0].d, /https:\/\/mcp\.higgsfield\.ai\/mcp/);
  assert.match(C.TIPS['connect-steps'].body.join(' '), /https:\/\/mcp\.higgsfield\.ai\/mcp/);
  assert.match(C.TIPS['cost-cap'].body.join(' '), /강제로 막아 주는 장치는 아니라서/);
  assert.doesNotMatch(rec.headline.sub, /끝까지 만들어요/);
  assert.equal(C.SOURCES['trial-blog'], undefined);
});

test('레퍼런스 + 화면 글자 없이는 글자 쓰는 법을 빌리지 않는다', () => {
  const ref = run({ style: 'ref', keep: ['nomusic', 'notext'] });
  assert.doesNotMatch(ref.prompt, /글자 쓰는 법/);
  assert.match(ref.headline.title, /내가 고른 영상처럼/);
  assert.doesNotMatch(run({ hero: 'product', style: 'ad', keep: ['shape'] }).prompt, /모양을 바꾸지 마/);
});

test('sanitize는 모르는 값을 버린다', () => {
  assert.deepEqual(R.sanitize({ hero: 'x', style: 'aura', keep: ['nomusic', 'evil'] }), { style: 'aura', keep: ['nomusic'] });
  assert.equal(R.ga('캐릭터'), '캐릭터가');
  assert.equal(R.ga('제품'), '제품이');
});
