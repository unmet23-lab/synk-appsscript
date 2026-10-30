'use strict';
// 싱크타운 원고 검사기(세로 조각 설계 §16-3) — 실제 원고는 문제 0건이어야 하고, 검사기는 금지 말을 놓치지 않아야 한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { toolModule } = require('./lib/town.js');

const line = (id, levels, extra = {}) => ({ id, npc: id.split('.')[0], kind: id.split('.')[1], meaning: '시험', slots: [], levels, ...extra });
// 마음 한 줄(§7-3 json 꼴): 네 판·그림·근거·하루 한 번.
const FULL = { L1: '좀 쉴게요.', L2: '피곤해서 앉아서 정리할게요.', L3: '오늘 많이 걸었어요. 앉아서 정리할게요.', L4: '돌아다니는 것도 좋아요. 그래도 지금은 앉아서 정리할게요.' };
const mood = (id, levels = FULL, extra = {}) => line(id, levels, { when: { reason: id.split('.')[2] }, icon: 'tired', from: ['시험'], oncePerLifeDay: true, ...extra });
const check = async (docs, allow = []) => (await toolModule('town-lines-check')).checkDocuments(docs.map((doc, i) => ({ file: `시험${i}.json`, doc })), { allow });

test('실제 원고와 허용 목록은 문제 0건이다', async () => {
  const { checkDocuments, loadDocuments, loadAllow } = await toolModule('town-lines-check');
  const result = checkDocuments(loadDocuments(), { allow: loadAllow() });
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.unusedAllow, [], '쓰이지 않는 허용은 지운다');
});

test('금지 말 네 갈래를 모두 잡는다', async () => {
  const { scanText } = await toolModule('town-lines-check');
  const rules = text => scanText(text).map(hit => hit.rule);
  for (const text of ['오랜만이에요.', '며칠 만에 왔네요.', '그동안 뭐 했어요?', '계속 기다렸어요.', '보고 싶었어요.', '왜 안 왔어요?', '이제야 왔네요.', '덕분에 다 했어요.', '그 사이에 비가 왔어요.'])
    assert.ok(rules(text).includes('period'), text);
  for (const text of ['네가 없어서 때문에 못 했어요.', '조금 서운해요.', '섭섭했어요.', '실망했어요.']) assert.ok(rules(text).includes('blame'), text);
  for (const text of ['빨리 와요.', '어서 와요.']) assert.ok(rules(text).includes('nag'), text);
  for (const text of ['결혼했어요?', '애인 있어요?', '몸무게가 늘었네요.', '살이 빠졌네요.', '돈벌이는 어때요?']) assert.ok(rules(text).includes('topic'), text);
  for (const text of ['어서 오세요. 앉으세요.', '받침이 단단해져서 잔을 더 놓아요.', '손목이 시큰해서 안쪽만 열었어요.', '공방 주인이 받침을 새로 맞췄대요.'])
    assert.deepEqual(rules(text), [], text);
  assert.deepEqual(scanText('덕분에 잘 마셨어요', { speaker: 'player' }), [], '플레이어 보기는 기간·탓 말 대상이 아니다');
  assert.equal(scanText('결혼했어요?', { speaker: 'player' })[0].rule, 'topic');
});

test('「그동안 달라진 것」 줄은 허용 목록으로도 지나가지 않는다', async () => {
  // W6 꼴(village.changes.<틀>.1 — 네 판·뜻·근거): 꼴이 맞아도 기간 말 하나는 허용 목록으로 지나가지 않는다.
  const doc = [line('village.changes.habit.1', { L1: '공방 주인이 내 자리에서 쉬었어요.', L2: '내가 없는 동안 공방 주인이 쉬었어요.',
    L3: '내가 만든 자리에서 공방 주인이 쉬었어요. 편했나 봐요.', L4: '내가 만든 자리에서 공방 주인이 잠깐 쉬어 갔어요. 그 자리가 편했나 봐요.' },
  { when: { frame: 'habit' }, from: ['시험'] })];
  const allow = [{ id: 'village.changes.habit.1', level: '*', rule: 'period', phrase: '없는 동안', reason: '시험' }];
  const result = await check([doc], allow);
  assert.equal(result.problems.length, 1);
  assert.equal(result.problems[0].rule, 'period');
  assert.match(result.problems[0].message, /그동안 달라진 것/);
});

test('주민 줄은 사람이 확인한 쓰임만 지나가고, 허용 목록에는 까닭이 있어야 한다', async () => {
  const doc = [mood('researcher.mood.low-energy.1', { ...FULL, L2: '제가 쉬는 동안 판을 봐 주세요.' })];
  assert.equal((await check([doc])).problems[0].rule, 'period');
  const allow = [{ id: 'researcher.mood.low-energy.1', level: 'L2', rule: 'period', phrase: '쉬는 동안', reason: '주민 자기 쉼 — 플레이어와 상관없음' }];
  const ok = await check([doc], allow);
  assert.deepEqual(ok.problems, []);
  assert.deepEqual(ok.unusedAllow, []);
  const noReason = await check([doc], [{ ...allow[0], reason: '' }]);
  assert.ok(noReason.problems.some(p => p.rule === 'allow'));
  const otherLevel = await check([doc], [{ ...allow[0], level: 'L3' }]);
  assert.equal(otherLevel.problems[0].rule, 'period', '다른 판의 허용은 이 판을 덮지 않는다');
  assert.equal(otherLevel.unusedAllow.length, 1);
});

test('ID 꼴·중복·L1 판을 본다', async () => {
  const result = await check([
    [line('cafe-owner.mood.rain-wrist.1', { L1: '손목이 아파요.' }), line('cafe-owner.mood.rain-wrist.1', { L1: '손목이 아파요.' })],
    [{ id: 'cafe owner mood', levels: { L1: '안녕하세요.' } }, line('cafe-owner.mood.busy.1', { L2: '바빠요.' }), line('cafe-owner.mood.tired.1', { L1: '쉬어요.', L5: '…' })],
  ]);
  const messages = result.problems.map(p => `${p.rule}:${p.id}`);
  assert.ok(messages.includes('duplicate:cafe-owner.mood.rain-wrist.1'));
  assert.ok(messages.includes('shape:cafe owner mood'));
  assert.ok(result.problems.some(p => p.id === 'cafe-owner.mood.busy.1' && /L1/.test(p.message)));
  assert.ok(result.problems.some(p => p.id === 'cafe-owner.mood.tired.1' && /L5/.test(p.message)));
});

test('마음 한 줄은 꼴·네 판·판 길이 상한을 본다(§7-3·§13-1·§16-3)', async () => {
  assert.deepEqual((await check([[mood('researcher.mood.low-energy.1')]])).problems, [], '꼴이 맞으면 문제 0');
  const found = async entry => (await check([[entry]])).problems.map(p => `${p.rule}:${p.level ?? ''}`);
  assert.ok((await found(mood('researcher.mood.low-energy.1', { L1: FULL.L1, L2: FULL.L2 }))).includes('mood:L3'), 'L3·L4가 빠짐');
  assert.ok((await found(mood('researcher.mood.low-energy.1', FULL, { icon: 'smile' }))).includes('mood:'), '모르는 그림');
  assert.ok((await found(mood('researcher.mood.low-energy.1', FULL, { when: { reason: 'tired' } }))).includes('mood:'), 'when이 ID의 이유와 다름');
  assert.ok((await found(mood('researcher.mood.low-energy.1', FULL, { npc: 'cafe-owner' }))).includes('mood:'), 'npc가 ID 앞과 다름');
  assert.ok((await found(mood('researcher.mood.low-energy.1', FULL, { oncePerLifeDay: false }))).includes('mood:'), '하루 한 번');
  assert.ok((await found(mood('researcher.mood.low-energy.1', { ...FULL, L2: '오늘은 정말 너무 많이 걸어서 조금 앉아서 천천히 정리할게요.' }))).includes('length:L2'), 'L2 8어절 넘음');
  assert.ok((await found(mood('researcher.mood.low-energy.1', { ...FULL, L1: '피곤해요. 쉴게요.' }))).includes('length:L1'), 'L1은 한 문장');
  assert.ok((await found(mood('researcher.mood.low-energy.1', { ...FULL, L3: '앉아서 정리할게요.' }))).includes('length:L3'), 'L3은 두세 문장');
  assert.ok((await found(mood('researcher.mood.low-energy.1', { ...FULL, L4: '돌아다니며 보는 것도 좋기는 하지만 지금은 몸이 좀 무거워서 앉아서 오늘 본 것을 천천히 정리하려고 해요. 그러니까요.' }))).includes('length:L4'), 'L4 문장마다 14어절');
  const { sentencesOf } = await toolModule('town-lines-check');
  assert.equal(sentencesOf('재미있는 걸 봤는데… 하나만 말할게요.').length, 1, '말줄임은 문장 안이다');
});

test('실제 마음 원고는 주민마다 이유 아홉(자기 여덟 + 공통 with-player-glad)이다(§7-3·§16-1)', async () => {
  const { loadDocuments } = await toolModule('town-lines-check');
  const moods = loadDocuments().flatMap(({ doc }) => (Array.isArray(doc) ? doc : [])).filter(entry => entry.kind === 'mood');
  for (const npc of ['cafe-owner', 'workshop-owner', 'researcher']) {
    const mine = moods.filter(entry => entry.npc === npc).map(entry => entry.when.reason);
    assert.equal(new Set(mine).size, 9, `${npc}의 이유`);
    assert.ok(mine.includes('with-player-glad'), `${npc}의 공통 이유`);
  }
  // 이유 스물다섯 = 주민마다 자기 여덟(low-energy는 공방 주인·연구원 둘 다의 이유) + 공통 하나.
  const own = new Set(moods.filter(entry => entry.when.reason !== 'with-player-glad').map(entry => `${entry.npc}:${entry.when.reason}`));
  assert.equal(own.size + 1, 25, '이유는 모두 스물다섯');
});

test('대화 장면은 주민 줄과 플레이어 보기를 나눠 본다', async () => {
  const scene = { sceneId: 'cafe-alley.day.new-tea', versions: { L1: { turns: [
    { npc: 'cafe-owner', line: '새 차 마셔 볼래요?', choices: [{ text: '네, 좋아요', outcome: 'taste.sip' }] },
    { npc: 'cafe-owner', byOutcome: { 'tea.aroma': { line: '오랜만에 향이 좋죠?', choices: [{ text: '덕분에 잘 마셨어요', outcome: 'x' }] } } },
  ], stop: '네, 또 와요.' } } };
  const result = await check([scene]);
  assert.equal(result.problems.length, 1);
  assert.equal(result.problems[0].phrase, '오랜만');
  assert.equal(result.texts, 5);
  assert.ok((await check([{ sceneId: 'cafe-alley.x', versions: { L2: { turns: [] } } }])).problems.some(p => /L1/.test(p.message)));
});

// W5(§2-9·§16-1): 카드·쌍·소식 줄과 전해 듣기 틀.
const W5 = { L1: '받침을 넣어요.', L2: '얇은 받침을 넣으면 안 흔들려요.', L3: '쟁반이 자꾸 기울어요. 얇은 받침을 하나 끼울게요.', L4: '쟁반이 기우는 건 바닥이 조금 패서 그래요. 받침을 끼워 두면 잔을 올려도 괜찮아요.' };
const w5 = (id, when, levels = W5, extra = {}) => line(id, levels, { when, from: ['시험'], ...extra });

test('W5 줄의 꼴 — 카드·쌍 줄은 네 판과 판 길이, 소식 줄은 더 짧고 금지 말 예외가 없으며, 전해 듣기 틀은 {news}로 채워 잰다', async () => {
  const ok = await check([[w5('workshop-owner.card.C1-pair.1', { card: 'C1', part: 'pair' }), w5('cafe-owner.pair.PAIR01-0.1', { pair: 'PAIR01', step: 0 })]]);
  assert.deepEqual(ok.problems, []);
  const short = { L1: '쟁반이 안 흔들려요.', L2: '찻집 쟁반이 안 흔들려요.', L3: '찻집 쟁반이 이제 안 흔들려요.', L4: '찻집 쟁반 밑에 받침을 끼웠어요. 이제 잔을 올려도 안 흔들려요.' };
  const news = w5('village.news.C1.1', { card: 'C1' }, short);
  assert.deepEqual((await check([[news]])).problems, []);
  const long = await check([[{ ...news, levels: { ...short, L2: '찻집 쟁반 밑에 받침을 끼워서 이제 안 흔들려요.' } }]]);
  assert.ok(long.problems.some(p => p.rule === 'length' && p.level === 'L2'), '소식 L2는 다섯 어절 안');
  const nag = await check([[{ ...news, levels: { ...short, L1: '빨리 와서 봐요.' } }]], [{ id: 'village.news.C1.1', level: 'L1', rule: 'nag', phrase: '빨리', reason: '시험' }]);
  assert.ok(nag.problems.some(p => p.rule === 'nag'), '소식 줄은 허용 목록으로도 지나가지 않는다');
  const frame = { L1: '{news}', L2: '{from}한테 들었는데, {news}', L3: '{news} {from}한테 들었어요.', L4: '{news} {from}한테 들은 이야기예요.' };
  assert.deepEqual((await check([[news, w5('researcher.hearsay.heard.1', { how: 'heard' }, frame)]])).problems, []);
  const noSlot = await check([[news, w5('researcher.hearsay.seen.1', { how: 'seen' }, { ...frame, L2: '제가 봤어요.' })]]);
  assert.ok(noSlot.problems.some(p => p.rule === 'hearsay'), '틀에는 {news}가 있다 · {from}은 들은 것에만');
  const tooLong = await check([[news, w5('researcher.hearsay.news.1', { how: 'news' }, { ...frame, L2: '마을 소식을 아까 쪽지에서 봤는데, {news}', L3: '{news} 마을 소식에 나왔어요.', L4: '{news} 마을 소식에서 봤어요.' })]]);
  assert.ok(tooLong.problems.some(p => p.rule === 'length' && p.id === 'researcher.hearsay.news.1'), '채운 뒤 L2 여덟 어절을 넘는다');
  assert.ok((await check([[w5('cafe-owner.card.C1-trigger.1', { card: 'C1', part: 'trigger' }, { ...W5, L2: '{x} 받침을 넣어요.' })]])).problems.some(p => p.rule === 'card'), '카드 줄에는 빈칸이 없다');
});

test('W10 줄 꼴 — 인사(구간-날씨 · 상태), 일과(원형 · 쌍 · 휴무 아침), 함께 마친 일의 카드, 카드 · 소식의 계절 변형', async () => {
  const ok = async entries => (await check([entries])).problems;
  assert.deepEqual(await ok([w5('cafe-owner.greet.morning-clear.1', { band: 'morning', weather: 'clear' }), w5('cafe-owner.greet.busy.1', { state: 'busy' })]), []);
  assert.ok((await ok([w5('cafe-owner.greet.morning-snow.1', { band: 'morning', weather: 'snow' })])).some(p => p.rule === 'greet'), '날씨는 맑음 · 비뿐');
  assert.ok((await ok([w5('cafe-owner.greet.busy.1', { band: 'day', weather: 'clear' })])).some(p => p.rule === 'greet'), '상태 열쇠는 when.state');
  assert.deepEqual(await ok([w5('cafe-owner.routine.brew.1', { archetype: 'brew' }), w5('cafe-owner.routine.pair-PAIR01.1', { pair: 'PAIR01' }),
    w5('workshop-owner.routine.holiday-wake.1', { dayKind: 'off', band: 'morning' })]), []);
  assert.ok((await ok([w5('cafe-owner.routine.brew.1', { archetype: 'serve' })])).some(p => p.rule === 'routine'), '열쇠와 원형이 같다');
  assert.deepEqual(await ok([mood('cafe-owner.mood.with-player-glad.2', FULL, { when: { reason: 'with-player-glad', card: 'C2' } })]), []);
  assert.ok((await ok([mood('cafe-owner.mood.with-player-glad.2', FULL, { when: { reason: 'with-player-glad', card: 'W2' } })])).some(p => p.rule === 'mood'), '자기 카드만');
  assert.ok((await ok([mood('cafe-owner.mood.busy.2', FULL, { when: { reason: 'busy', card: 'C5' } })])).some(p => p.rule === 'mood'), '카드는 함께 마친 일에만');
  assert.deepEqual(await ok([w5('researcher.card.R5-trigger.2', { card: 'R5', part: 'trigger', season: 'spring' })]), []);
  assert.ok((await ok([w5('researcher.card.R5-trigger.1', { card: 'R5', part: 'trigger', season: 'spring' })])).some(p => p.rule === 'card'), '.1은 가을');
  assert.ok((await ok([w5('researcher.card.R5-trigger.2', { card: 'R5', part: 'trigger', season: 'autumn' })])).some(p => p.rule === 'card'), '다른 계절은 봄 · 여름 · 겨울');
});

test('실제 W5 원고 — 카드마다 여섯 줄(둘이는 주인·짝), 쌍 단계마다 두 사람, 소식 카드마다 한 줄, 전해 듣기 아홉이 다 있다', async () => {
  const fs = require('node:fs'), path = require('node:path'), { ROOT } = require('./lib/town.js');
  const dir = path.join(ROOT, 'experiences', 'synk-town', 'town', 'data', 'lines');
  for (const name of ['cards.json', 'pairs.json', 'news.json', 'hearsay.json']) assert.ok(fs.existsSync(path.join(dir, name)), name);
  const { build } = await toolModule('town-data-build');
  assert.doesNotThrow(() => build(), '생성기가 빠진 줄을 막는다');
  const { TOWN_LINES } = await import(require('node:url').pathToFileURL(path.join(ROOT, 'experiences', 'synk-town', 'town', 'data.gen.mjs')).href);
  // A card's optional line (10-30, data build CARD_PARTS_MORE — C4's 「찻집에서」 where its owner is elsewhere) is counted apart.
  const count = kind => TOWN_LINES.filter(l => l.kind === kind && !l.when?.season && !(kind === 'card' && l.when?.part === 'away')).length;
  assert.deepEqual([count('card'), count('pair'), count('news'), count('hearsay')], [108, 18, 9, 9]);
  assert.deepEqual(TOWN_LINES.filter(l => l.when?.part === 'away').map(l => l.id), ['cafe-owner.card.C4-away.1']);
  // W10: R5의 계절 변형(계기 · 혼자 · 소식 × 봄 · 여름 · 겨울)과 인사 33(주민 셋 × 구간 넷 × 날씨 둘 + 상태 셋).
  assert.deepEqual(TOWN_LINES.filter(l => l.when?.season).map(l => `${l.id.replace(/\.\d+$/, '')}:${l.when.season}`).sort(),
    ['researcher.card.R5-self', 'researcher.card.R5-trigger', 'village.news.R5'].flatMap(id => ['spring', 'summer', 'winter'].map(s => `${id}:${s}`)).sort());
  assert.equal(count('greet'), 33);
  assert.deepEqual(TOWN_LINES.filter(row => row.when?.card === 'C4').map(row => row.id).sort(), [
    ...['trigger', 'self', 'pair', 'offer', 'result'].map(part => `cafe-owner.card.C4-${part}.1`),
    'workshop-owner.card.C4-pair.1', 'village.news.C4.1', 'cafe-owner.card.C4-away.1',
  ].sort(), 'C4 카드 여섯 줄과 소식 한 줄(+ 10-30 찻집 밖의 한 줄)이 실제로 있다');
});
