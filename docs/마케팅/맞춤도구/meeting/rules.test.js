// 실행: node --test "docs/마케팅/맞춤도구/meeting/rules.test.js"
// 추천기준.md §10의 약속과 제작절차.md의 검사를 지킨다.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const R = require('./rules.js');
const C = require('./content.js');
const { checkContent, checkTipIds } = require('../core/content-check.js');

const base = { meet: 'team', record: ['memo'], length: 'short', ai: { app: 'chatgpt', plan: 'free' }, freq: 'once', share: ['me'], sensitive: 'none' };
const run = extra => R.compute({ ...base, ...extra });

test('제작 절차: 탐색노트·추천기준이 있고 질문·팁 은행이 검사를 통과한다', () => {
  for (const doc of ['탐색노트.md', '추천기준.md']) assert.ok(fs.existsSync(path.join(__dirname, doc)), `${doc} 없음`);
  assert.deepEqual(checkContent(C), []);
});

test('영상에서 약속한 자료(11쪽 PDF·ZIP)를 그대로 싣고 첫 화면에서 바로 받게 한다', () => {
  for (const f of [C.guidePdf, C.kitZip]) assert.ok(fs.existsSync(path.join(__dirname, 'keep', f)), `${f} 없음`);
  assert.deepEqual(C.intro.links.map(l => l.href), [C.guidePdf, C.kitZip]);
  assert.match(C.practiceMemo, /민호/);
});

test('모든 요청문에 지어내지 않는 규칙과 회의별 칸이 들어간다', () => {
  for (const meet of Object.keys(R.SECTIONS)) {
    const rec = run({ meet });
    assert.match(rec.prompts.first, /추측하지 말고, 모르면 ‘확인 필요’/);
    assert.match(rec.prompts.first, /쓰지 마\./);
    for (const s of R.SECTIONS[meet]) assert.ok(rec.prompts.first.includes(s), `${meet}: ${s}`);
  }
});

test('수업은 결정 칸 대신 물어볼 것, 다음 수업 날짜를 과제 마감으로 쓰지 않는다', () => {
  const rec = run({ meet: 'class', freq: 'weekly' });
  assert.match(rec.prompts.first, /다음 수업 날짜를 과제 마감으로 쓰지 마/);
  assert.match(rec.prompts.first, /‘물어볼 것’으로 분리/);
  assert.doesNotMatch(rec.prompts.first, /결정된 내용에 넣지/);
  assert.doesNotMatch(rec.prompts.rules, /결정된 내용은 확정된/);
});

test('한 번만이면 저장할 규칙을 보여 주지 않고, 자주면 AI에 맞는 저장 위치를 보여 준다', () => {
  assert.equal(run({}).save.recommend, false);
  const gpt = run({ freq: 'weekly' });
  assert.equal(gpt.save.recommend, true);
  assert.match(gpt.save.steps.map(x => x.t).join(' '), /프로젝트 설정.*지침/);
  assert.match(gpt.headline.title, /ChatGPT 프로젝트에 규칙을 저장/);
  const claude = run({ freq: 'weekly', ai: { app: 'claude', plan: 'free' } });
  assert.match(claude.save.steps.map(x => x.t).join(' '), /Set project instructions/);
  const gem = run({ freq: 'weekly', ai: { app: 'gemini', plan: 'free' } });
  assert.equal(gem.save.name, 'Gem');
  assert.match(gem.save.steps.map(x => x.t).join(' '), /스킬/);
  assert.match(gem.prompts.rules, /^이 Gem은/);
});

test('AI가 없으면: 10분 이하 녹음만 → Gemini, 긴 기록 → Claude, 그 밖 → ChatGPT', () => {
  const audio = run({ record: ['audio'], audio: { device: 'galaxy', mins: 'u10' }, ai: { app: 'none', plan: 'free' } });
  assert.equal(audio.ai.app, 'gemini');
  assert.match(audio.prompts.first, /첨부한 녹음을 먼저 받아 적은 뒤/);
  assert.equal(audio.flow[0].t, 'Gemini 새 채팅에 요청문을 붙이고 녹음 파일을 첨부해 보내기');
  assert.equal(run({ length: 'long', ai: { app: 'none', plan: 'free' } }).ai.app, 'claude');
  const plain = run({ ai: { app: 'none', plan: 'free' } });
  assert.equal(plain.ai.app, 'chatgpt');
  assert.match(plain.headline.sub, /쓰는 AI가 없어서 ChatGPT를 골랐어요/);
});

test('긴 기록: ChatGPT 무료는 나눠 보내기와 끝 규칙, Claude는 한 번에 붙여 넣기', () => {
  const gpt = run({ length: 'long', freq: 'weekly' });
  assert.equal(gpt.input.method, 'split');
  assert.match(gpt.prompts.first, /‘끝’이라고 할 때까지/);
  assert.match(gpt.prompts.next, /‘끝’이라고 하면/);
  assert.ok(gpt.tips.includes('long-record'));
  assert.equal(run({ length: 'long', ai: { app: 'claude', plan: 'free' } }).input.method, 'paste');
});

test('민감한 회의를 Claude·Gemini로 자주 정리하면 저장하지 않고 메모 앱 방식과 알림을 준다', () => {
  for (const app of ['claude', 'gemini']) {
    const rec = run({ ai: { app, plan: 'free' }, freq: 'weekly', sensitive: 'personal' });
    assert.equal(rec.save.recommend, false);
    assert.equal(rec.save.privateMode, true);
    assert.equal(rec.warns.length, 1);
    assert.ok(rec.flow.some(s => /메모 앱에 저장/.test(s.t)));
    assert.match(rec.headline.title, app === 'claude' ? /시크릿 채팅/ : /임시 채팅/);
  }
  // ChatGPT와 회사 계정은 그대로 저장한다.
  assert.equal(run({ freq: 'weekly', sensitive: 'personal' }).save.recommend, true);
  assert.equal(run({ ai: { app: 'claude', plan: 'work' }, freq: 'weekly', sensitive: 'personal' }).save.recommend, true);
});

test('민감하면 지우기 단계와 임시·시크릿 채팅으로 보내고, 업무 계정은 회사 규칙을 따른다', () => {
  const rec = run({ sensitive: 'personal' });
  assert.equal(rec.flow[0].t, '넣기 전에 지울 것 지우기');
  assert.ok(rec.flow.some(s => /ChatGPT 임시 채팅에/.test(s.t)));
  assert.match(rec.prompts.first, /‘\(개인정보 생략\)’/);
  assert.ok(rec.checklist.some(c => c.id === 'personal'));
  const work = run({ sensitive: 'internal', ai: { app: 'chatgpt', plan: 'work' } });
  assert.ok(!work.flow.some(s => /지울 것/.test(s.t)));
  assert.equal(work.privacy.v, '회사 계정과 회사 규칙대로');
});

test('녹음 파일·녹음 글이면 녹음 사실 알리기 확인표와 녹음 팁을 준다', () => {
  for (const record of [['audio'], ['transcript']]) {
    const rec = run({ record, audio: { device: 'other', mins: 'u60' } });
    assert.ok(rec.checklist.some(c => c.id === 'consent'));
    assert.ok(rec.tips.includes('recording-consent'));
    assert.ok(rec.tips.includes('transcript-errors'));
  }
  const other = run({ record: ['audio'], audio: { device: 'other', mins: 'u60' } });
  assert.equal(other.transcribe.v, '클로바노트에 파일 올리기');
  const meet = run({ record: ['audio'], audio: { device: 'meetingapp', mins: 'u60' } });
  assert.ok(meet.transcribe.reasons.some(x => x.src === 'gg-meet') && meet.transcribe.reasons.some(x => x.src === 'ms-recap'));
});

test('고객에게 보내면 내부 메모를 빼고 질문으로 바꾸며, 보낼 글 요청문은 반말·저장할 규칙은 존댓말', () => {
  const rec = run({ meet: 'client', freq: 'weekly', share: ['client', 'boss'], channel: 'email' });
  assert.match(rec.prompts.share, /내부 메모·추측·‘확인 필요’ 표시는 빼고/);
  assert.match(rec.prompts.share, /받는 사람마다 따로/);
  assert.match(rec.prompts.share, /세 줄로 둬\./);
  assert.match(rec.prompts.rules, /세 줄로 두세요\./);
  assert.ok(rec.checklist.some(c => c.id === 'external'));
  assert.match(rec.prompts.share, /메일로 보낼 글로 바꿔줘/);
  assert.equal(run({}).prompts.share, '');
});

test('사진만 있으면 첨부 안내, 사진과 메모가 함께면 복사 단계도 둔다', () => {
  const photo = run({ record: ['photo'] });
  assert.match(photo.prompts.first, /\(사진을 첨부했어요\)/);
  assert.ok(!photo.flow.some(s => /그대로 복사/.test(s.t)));
  const both = run({ record: ['photo', 'memo'] });
  assert.ok(both.flow.some(s => /그대로 복사/.test(s.t)));
  assert.match(both.prompts.first, /\(여기에 기록을 그대로 붙여 넣으세요\)/);
});

test('정리 외에는 하지 않는다: 초안만, 보내기·일정 등록 금지', () => {
  const rec = run({ freq: 'weekly', share: ['team'], channel: 'messenger' });
  assert.match(rec.prompts.rules, /외부 메시지 전송, 업무 배정, 일정 등록은 하지 마세요/);
  assert.match(rec.prompts.share, /보내거나 일정을 등록하지는 마/);
  assert.ok(rec.checklist.some(c => c.id === 'send'));
});

test('결과가 고른 팁과 쓴 출처는 모두 은행과 SOURCES에 있다', () => {
  const combos = [
    {}, { meet: 'client', record: ['transcript', 'memo'], length: 'long', freq: 'weekly', share: ['boss', 'client'], channel: 'email', sensitive: 'personal' },
    { meet: 'class', record: ['photo'], ai: { app: 'gemini', plan: 'free' }, freq: 'many', share: ['team'], channel: 'messenger' },
    { meet: 'one', record: ['auto'], ai: { app: 'none', plan: 'work' }, share: ['boss'], channel: 'email', sensitive: 'unsure' },
    { meet: 'group', record: ['audio', 'chat'], audio: { device: 'iphone', mins: 'o60' }, length: 'long', ai: { app: 'claude', plan: 'paid' }, freq: 'many', share: ['absent'], channel: 'doc', sensitive: 'internal' },
  ];
  for (const a of combos) {
    const rec = run(a);
    assert.deepEqual(checkTipIds(rec.tips, C), []);
    assert.deepEqual(rec.sourcesUsed.filter(s => !C.SOURCES[s]), []);
    assert.ok(rec.flow.length >= 2 && rec.cards.length >= 5);
  }
});

test('이상한 값은 버리고 빈 답은 보통값으로 채운다', () => {
  const clean = R.sanitize({ meet: 'x', record: ['memo', 'hack'], ai: { app: 'evil', plan: 'free' }, share: ['me', 'boss', '??'] });
  assert.equal(clean.meet, undefined);
  assert.deepEqual(clean.record, ['memo']);
  assert.equal(clean.ai.app, undefined);
  assert.deepEqual(clean.share, ['me', 'boss']);
  const rec = R.compute({});
  assert.equal(rec.ai.app, 'chatgpt');
  assert.match(rec.prompts.first, /팀 회의/);
});

test('질문의 선택지 id는 rules가 받는 값과 같다', () => {
  const step = id => C.steps.find(s => s.id === id);
  assert.deepEqual(step('meet').options.map(o => o.id), Object.keys(R.SECTIONS));
  const clean = R.sanitize({ record: step('record').options.map(o => o.id) });
  assert.equal(clean.record.length, step('record').options.length);
  const ai = step('ai').fields.find(f => f.id === 'app').options.map(o => o.id);
  for (const app of ai) assert.equal(R.sanitize({ ai: { app } }).ai.app, app);
  for (const id of step('share').options.map(o => o.id)) assert.deepEqual(R.sanitize({ share: [id] }).share, [id]);
});
