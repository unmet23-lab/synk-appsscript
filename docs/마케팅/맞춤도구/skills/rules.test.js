// 실행: node --test "docs/마케팅/맞춤도구/skills/rules.test.js"
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
// 페이지에서는 <script> 순서대로 전역에 올라간다. 시험에서도 view가 같은 전역을 보게 한다.
globalThis.SynkSkillsContent = C;
globalThis.SynkSkillsRules = R;

const DAY = new Date(2026, 9, 17); // 2026-10-17, 기기의 오늘
const run = (a, now = DAY) => R.compute(a, now);
const steps = (rec, id) => (rec.groups.find(g => g.id === id) || { steps: [] }).steps.map(s => s.t);
const all = rec => JSON.stringify(rec);

const ALL = [];
const subsets = ids => ids.reduce((acc, id) => acc.concat(acc.map(s => [...s, id])), [[]]).filter(s => s.length);
for (const where of ['gpt', 'gem', 'both'])
  for (const who of ['mine', 'others', 'both'])
    for (const account of ['unsure', 'personal', 'work', 'school'])
      for (const gptHas of subsets(['unsure', 'files', 'actions', 'shared', 'drafts', 'plain']).filter((_, i) => i % 3 === 0))
        for (const gemHas of [['plain'], ['unsure'], ['tools'], ['files', 'shared']])
          ALL.push({ where, who, account, gptHas, gemHas });

test('제작 절차: 탐색노트·추천기준이 있고 질문·팁 은행이 검사를 통과한다', () => {
  for (const doc of ['탐색노트.md', '추천기준.md']) assert.ok(fs.existsSync(path.join(__dirname, doc)), `${doc} 없음`);
  assert.deepEqual(checkContent(C), []);
});

test('모든 답 조합: undefined·NaN 없음, 고른 팁은 은행에 있음, 결과 화면이 그려짐', () => {
  for (const a of ALL) {
    const rec = run(a);
    assert.ok(!/undefined|NaN/.test(all(rec)), JSON.stringify(a));
    assert.deepEqual(checkTipIds(rec.tips, C), []);
    assert.ok(rec.cards.length >= 1 && rec.groups.length >= 1, JSON.stringify(a));
    for (const layout of ['quick', 'guided', 'deep']) {
      const out = V.result({ rec, answers: a, layout, plan: null, checks: {}, feedbackGiven: null, content: C });
      assert.ok(out.html.replace(/<[^>]+>/g, '').includes(rec.headline.title.replace(/&/g, '&amp;')), JSON.stringify(a));
      assert.ok(!/undefined|NaN/.test(out.html), JSON.stringify(a));
    }
  }
});

test('GPT를 만든 사람: 「플러그인으로 마이그레이션」 단계(실제 화면·바로 가기), 12월 11일, 모델은 신경 쓰지 않아도 됨', () => {
  for (const account of ['personal', 'work', 'school']) {
    const rec = run({ where: 'gpt', who: 'mine', account, gptHas: ['plain'] });
    assert.ok(steps(rec, 'gpt-mine').some(t => /플러그인으로 마이그레이션/.test(t)), account);
    assert.equal(rec.cards.find(c => c.k === 'ChatGPT GPTs').v, '12월 11일');
    assert.ok(rec.relax.some(x => /골라 둔 모델/.test(x.t)));
    assert.match(rec.headline.title, /12월 11일 전에 직접 옮겨요/);
    const mig = rec.groups.find(g => g.id === 'gpt-mine').steps.find(x => /플러그인으로 마이그레이션/.test(x.t));
    assert.match(mig.img.src, /skills-shot-migrate\.webp/);
    assert.equal(mig.link.href, 'https://chatgpt.com/gpts/mine');
    assert.equal(rec.primary.href, 'https://chatgpt.com/gpts/mine');
    // 누른 뒤 확인 창 → @로 불러 확인(10-18 실제 화면), 순서대로
    const s = rec.groups.find(g => g.id === 'gpt-mine').steps;
    const i = s.indexOf(mig);
    assert.match(s[i + 1].img.src, /skills-shot-confirm\.webp/);
    assert.match(s[i + 2].t, /자주 쓰던 질문/);
    assert.match(s[i + 2].img.src, /skills-shot-at\.webp/);
  }
});

test('젬만 만든 개인 계정: 할 일은 기다리기, 마이그레이션 단계 없음', () => {
  const rec = run({ where: 'gem', who: 'mine', account: 'personal', gemHas: ['plain'] });
  assert.equal(steps(rec, 'gem-mine')[0], '기다리기');
  assert.doesNotMatch(all(rec.groups), /플러그인으로 마이그레이션/);
  assert.equal(rec.headline.title, '젬은 기다리면 돼요');
  assert.ok(rec.relax.some(x => /기다리면 자동/.test(x.t)));
  assert.equal(rec.primary.href, 'https://gemini.google.com/gems/view');
  assert.ok(rec.groups[0].steps.some(x => x.img && /gemini-guide-5-slash/.test(x.img.src)));
});

test('남이 만든 GPT만 쓰면: 마이그레이션 단계 없음, 「옮길 수 없고」, 비교 메모 없음', () => {
  const rec = run({ where: 'gpt', who: 'others', account: 'personal' });
  assert.doesNotMatch(all(rec.groups), /플러그인으로 마이그레이션/);
  assert.ok(rec.relax.some(x => /옮길 수 없고/.test(x.t)));
  assert.ok(rec.tips.includes('use-others'));
  assert.equal(rec.headline.title, '남이 만든 것만 쓴다면, 옮길 건 없어요');
  const out = V.result({ rec, answers: rec.answers, layout: 'guided', plan: null, checks: {}, feedbackGiven: null, content: C });
  assert.doesNotMatch(out.html, /비교 메모 복사/);
  // 할 일은 만든 사람에게 물어보기 — 보낼 한 줄이 상자와 떠 있는 주 단추에 있다
  assert.equal(steps(rec, 'gpt-others')[0], '만든 사람에게 물어보기');
  assert.match(rec.ask, /12월 11일/);
  assert.equal(rec.primary.kind, 'copy');
  assert.match(out.html, /data-proxy="copy:ask"/);
  assert.equal(out.texts.ask, rec.ask);
});

test('게시 안 한 수정 → 첫 단계가 게시(「나만 보기」 화면), 액션 → 안 따라오는 것과 다시 연결 단계 · 경고와 겹치지 않음', () => {
  const d = run({ where: 'gpt', who: 'mine', account: 'personal', gptHas: ['drafts'] });
  assert.equal(steps(d, 'gpt-mine')[0], '고친 것 먼저 게시하기');
  assert.match(d.groups[0].steps[0].img.src, /skills-shot-private/);
  assert.match(d.carry.map(w => w.t).join(' '), /게시 안 한 수정/);
  assert.equal(d.warns.length, 0);
  const a = run({ where: 'gpt', who: 'mine', account: 'personal', gptHas: ['actions'] });
  // 액션이 있으면 확인 창 그림이 「지원되지 않는 액션」 판으로 바뀌고, 그대로 눌러도 된다고 말한다(10-18 실제 화면)
  const conf = a.groups[0].steps.find(x => /확인 창/.test(x.t));
  assert.match(conf.img.src, /skills-shot-confirm-action\.webp/);
  assert.match(conf.d, /지원되지 않는 액션/);
  assert.match(d.groups[0].steps.find(x => /확인 창/.test(x.t)).img.src, /skills-shot-confirm\.webp/);
  assert.match(a.carry.map(w => w.t).join(' '), /맞춤 액션: 다시 연결/);
  assert.ok(steps(a, 'gpt-mine').includes('액션 다시 연결하기'));
  assert.ok(a.tips.includes('carry-action'));
});

test('「지침만 있어요」를 다른 것과 같이 고르면 다른 것을 따른다', () => {
  const rec = run({ where: 'gpt', who: 'mine', account: 'personal', gptHas: ['plain', 'actions'] });
  assert.deepEqual(rec.f.gptHas, ['actions']);
});

test('회사·학교 날짜: GPT 연기 2027-02-11과 회사 알림, 회사 젬 2027년 3월, 학교 젬 2027년 6월', () => {
  const w = run({ where: 'both', who: 'mine', account: 'work', gptHas: ['plain'], gemHas: ['plain'] });
  assert.match(w.cards.find(c => c.k === 'ChatGPT GPTs').note, /2027년 2월 11일/);
  assert.match(w.warns.map(x => x.t).join(' '), /회사 알림/);
  assert.equal(w.cards.find(c => c.k.startsWith('제미나이')).v, '2027년 3월 중');
  assert.ok(w.cards.some(c => c.k === '회사 Enterprise' && c.v === '10월 26일'));
  const s = run({ where: 'gem', who: 'mine', account: 'school', gemHas: ['plain'] });
  assert.equal(s.cards[0].v, '2027년 6월 중');
  assert.ok(s.tips.includes('date-work'));
});

test('10-17 기준 D-몇: 젬 31일, GPT 55일 · 12-12에는 GPT가 지났어요', () => {
  const rec = run({ where: 'both', who: 'mine', account: 'personal', gptHas: ['plain'], gemHas: ['plain'] });
  assert.equal(rec.cards.find(c => c.k.startsWith('제미나이')).d, 'D-31');
  assert.equal(rec.cards.find(c => c.k === 'ChatGPT GPTs').d, 'D-55');
  const late = run({ where: 'gpt', who: 'mine', account: 'personal', gptHas: ['plain'] }, new Date(2026, 11, 12));
  assert.equal(late.cards[0].d, '지났어요');
  assert.match(late.warns.map(w => w.t).join(' '), /종료일이 지났어요/);
  assert.equal(R.dLabel(0, true), '오늘');
});

test('조건부 질문: GPT가 없으면 gptHas 안 보임, 남이 만든 것만이면 둘 다 안 보임', () => {
  const visible = a => C.steps.filter(s => !s.when || s.when(a)).map(s => s.id);
  assert.deepEqual(visible({ where: 'gem', who: 'mine' }), ['where', 'who', 'account', 'gemHas']);
  assert.deepEqual(visible({ where: 'both', who: 'others' }), ['where', 'who', 'account']);
  assert.deepEqual(visible({ where: 'both', who: 'both' }), ['where', 'who', 'account', 'gptHas', 'gemHas']);
});

test('젬 도구를 고르면 안 따라오는 것과 「따로」 단계, 공유받은 젬은 「아직 적혀 있지 않아요」', () => {
  const t = run({ where: 'gem', who: 'mine', account: 'personal', gemHas: ['tools'] });
  assert.match(t.carry.map(w => w.t).join(' '), /스킬에서 아직 안 돼요/);
  assert.ok(steps(t, 'gem-mine').some(x => /따로/.test(x)));
  const o = run({ where: 'gem', who: 'others', account: 'personal' });
  assert.match(all(o.groups), /아직 적혀 있지 않아요/);
});

test('「잘 모르겠어요」: 계정은 개인 날짜 + 알림, GPT 안은 「무엇이 들었는지 보기」가 맨 앞, 다른 것과 같이 고르면 다른 것을 따른다', () => {
  const u = run({ where: 'gpt', who: 'mine', account: 'unsure', gptHas: ['unsure'] });
  assert.equal(u.f.account, 'personal');
  assert.equal(u.cards.find(c => c.k === 'ChatGPT GPTs').v, '12월 11일');
  assert.match(u.warns.map(w => w.t).join(' '), /계정을 몰라서/);
  assert.equal(steps(u, 'gpt-mine')[0], '내 GPT에 무엇이 들었는지 보기');
  assert.deepEqual(run({ where: 'gpt', who: 'mine', account: 'personal', gptHas: ['unsure', 'files'] }).f.gptHas, ['files']);
  // 남이 만든 것만 쓰면 계정을 몰라도 경고를 붙이지 않는다
  assert.equal(run({ where: 'gpt', who: 'others', account: 'unsure' }).warns.length, 0);
});

test('view: 처음 값은 간단히(index.html), 간단히에도 할 일 설명·실제 화면이 있고 「여기까지 하면 돼요」, 팁·비교 메모는 없다', () => {
  assert.match(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'), /defaultLayout: 'quick'/);
  const a = { where: 'both', who: 'mine', account: 'personal', gptHas: ['drafts'], gemHas: ['plain'] };
  const rec = run(a);
  const q = V.result({ rec, answers: a, layout: 'quick', plan: null, checks: {}, feedbackGiven: null, content: C }).html;
  assert.match(q, /여기까지 하면 돼요/);
  assert.match(q, /게시한 판만 옮겨져요/);
  assert.match(q, /skills-shot-migrate\.webp/);
  assert.doesNotMatch(q, /비교 메모 복사|나에게 필요한 팁/);
  const g = V.result({ rec, answers: a, layout: 'guided', plan: null, checks: {}, feedbackGiven: null, content: C }).html;
  assert.match(g, /비교 메모 복사/);
  // 공식 배지는 할 일 줄에 붙지 않는다
  const steps = g.slice(g.indexOf('class="steps"'), g.indexOf('class="doneline'));
  assert.doesNotMatch(steps, /class="src official"/);
  for (const f of ['skills-shot-migrate', 'skills-shot-confirm', 'skills-shot-confirm-action', 'skills-shot-at', 'skills-shot-private', 'skills-shot-gems', 'gemini-guide-5-slash']) assert.ok(fs.existsSync(path.join(__dirname, '../assets', `${f}.webp`)), f);
});

test('sanitize: 모르는 값은 버리고, 공유 링크(#r=)로 와도 안전하다', () => {
  assert.deepEqual(R.sanitize({ where: 'x', who: 'mine', gptHas: ['files', 'zzz'], evil: '<script>' }), { who: 'mine', gptHas: ['files'] });
  const rec = run({ where: '<img onerror=1>', who: 'mine' });
  assert.equal(rec.f.where, 'both');
});

test('view: 첫 화면 포스터와 질문 포스터에 그 화면의 그림이 있고, 그림 파일이 assets에 있다', () => {
  assert.match(V.hero(), /skills-art-intro\.webp/);
  for (const s of C.steps) {
    const html = V.aside({ where: 'both', who: 'both' }, R, s);
    assert.match(html, new RegExp(`skills-art-${s.id.toLowerCase()}\\.webp`), s.id);
  }
  for (const f of ['intro', 'where', 'who', 'account', 'gpthas', 'gemhas', 'result']) assert.ok(fs.existsSync(path.join(__dirname, '../assets', `skills-art-${f}.webp`)), f);
  assert.match(V.visual('timeline'), /11\.17/);
});
