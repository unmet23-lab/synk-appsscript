'use strict';
// 싱크타운 W5b 화면 모듈(세로 조각 설계 §8·§9·§20, 시험 §20-10 town-notebook·town-prefs의 화면 쪽) — 주민이 지금 하는 일에서 고른
// 한 줄(카드 해결·쌍 이야기·기다리는 필요), 인사의 전해 듣기 말, 장소 판·제안·고르기 판·수첩의 꼴, 본 것 키, 두 카드 겹침 피하기.
// 화면에는 숫자·날짜·연속 표시가 없다(G2·G3). 모듈은 생성물을 이름 공간으로 읽는다(공개 직후 캐시).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT } = require('./lib/town.js');

const load = file => import(pathToFileURL(path.join(ROOT, 'experiences', 'synk-town', file)).href);
const T = 1000000;
const seg = (npc, extra) => ({ npc, startMs: T, arriveMs: T, endMs: T + 600000, archetype: 'chat', spot: 'cafe.front', ...extra });

test('고르기 이름·그림 — 「나와 함께」가 열린 카드의 고르기마다 단추 이름이 있고, 카드마다 그림이 있다', async () => {
  const { CARD_BY_ID, CHOICE_LABELS, CARD_ICONS, choiceLabel } = await load('day-cards.mjs'), { ICONS } = await load('day-mood.mjs');
  for (const card of CARD_BY_ID.values()) {
    assert.ok(ICONS[CARD_ICONS[card.id]], `${card.id} 그림`);
    if (card.locked || !card.paths.player.ready) continue;
    for (const choice of card.paths.player.choices) assert.ok(CHOICE_LABELS[card.id]?.[choice], `${card.id}.${choice}`);
  }
  assert.equal(choiceLabel('C1', 'inside'), '찻집 안에서');
  assert.equal(CARD_BY_ID.size, 18);
});

test('주민의 한 줄 — 혼자 풀기·둘이(짝은 온 뒤에만)·쌍 이야기(둘 다 있을 때, 단계별)·기다리는 필요, 그리고 본 것 키', async () => {
  const { sceneLine, pairSteps } = await load('day-cards.mjs');
  const self = [seg('cafe-owner', { card: 'C1', key: 'k', cardRole: 'owner', archetype: 'prep-cups', spot: 'cafe.prep' })];
  assert.deepEqual(sceneLine(self, 'cafe-owner', T + 1000), { id: 'cafe-owner.card.C1-self.1', icon: 'wobble', seen: ['line:cafe-owner.card.C1-self.1', 'card:C1:self'], occurrence: 'C1:k:self' });
  const partner = seg('workshop-owner', { card: 'C1', key: 'k', cardRole: 'partner', with: 'cafe-owner', arriveMs: T + 60000, archetype: 'fix-round', spot: 'cafe.counter' });
  const pair = [self[0], partner], steps = pairSteps({ 'cafe-owner|workshop-owner': { friction: { step: 1 } } });
  assert.deepEqual(steps, { PAIR01: 1, PAIR02: 0, PAIR03: 0 });
  assert.equal(sceneLine(pair, 'cafe-owner', T + 1000, { steps }).id, 'cafe-owner.card.C1-pair.1', '짝이 오는 동안 주인은 부탁한다');
  assert.equal(sceneLine(pair, 'workshop-owner', T + 1000, { steps }), null, '오기 전의 짝은 말하지 않는다');
  assert.deepEqual(sceneLine(pair, 'workshop-owner', T + 90000, { steps }).seen, ['line:workshop-owner.card.C1-pair.1', 'card:C1:pair', 'pair:PAIR01:1']);
  const talk = [seg('cafe-owner', { with: 'researcher' }), seg('researcher', { with: 'cafe-owner', joined: true })];
  assert.equal(sceneLine(talk, 'researcher', T + 1000, { steps: { PAIR03: 2 } }).id, 'researcher.pair.PAIR03-2.1');
  assert.equal(sceneLine([talk[0]], 'cafe-owner', T + 1000), null, '혼자서는 허공에 말하지 않는다(F14)');
  const waiting = [{ card: 'W1', owner: 'workshop-owner', status: 'triggered', key: 'w' }];
  assert.equal(sceneLine([], 'workshop-owner', T, { waiting }).id, 'workshop-owner.card.W1-trigger.1');
  assert.equal(sceneLine([], 'workshop-owner', T, { waiting: [{ ...waiting[0], status: 'resolving' }] }), null);
  // 한 곳에서만 이야기하는 카드(TALK_AT — 첫 C4는 찻집 차림표 앞, §12-1)는 주인이 그곳에 와 있을 때만 필요를 말한다 — 첫 C4가 며칠씩
  // 기다리는 동안 다른 곳의 주인은 제 마음 줄을 말한다(화면 검수 town-c4-world F2).
  const c4 = [{ card: 'C4', owner: 'cafe-owner', status: 'triggered', key: 'c' }];
  assert.equal(sceneLine([seg('cafe-owner', { spot: 'cafe.counter' })], 'cafe-owner', T + 1000, { waiting: c4 }).id, 'cafe-owner.card.C4-trigger.1');
  assert.equal(sceneLine([seg('cafe-owner', { spot: 'greenhouse.bed' })], 'cafe-owner', T + 1000, { waiting: c4 }), null, '찻집 밖에서는 첫 C4를 말하지 않는다');
  assert.equal(sceneLine([seg('cafe-owner', { spot: 'cafe.counter', arriveMs: T + 60000 })], 'cafe-owner', T + 1000, { waiting: c4 }), null, '찻집으로 걷는 동안은 아직');
  assert.equal(sceneLine([], 'cafe-owner', T, { waiting: c4 }), null, '일과 조각이 없으면(잠) 말하지 않는다');
  // 첫 C4가 기다리는 동안 하루 한 번 차림표 앞에서 서성이는 조각(§8-4 ③)에서는 그 마음 줄(new-menu)이 말하고 필요 줄은 기다린다 —
  // 마음 줄이 없는 서성임(그날 줄 상한)이면 필요 줄 그대로.
  const lingering = seg('cafe-owner', { spot: 'cafe.counter', archetype: 'menu-note', mood: 'cafe-owner.mood.new-menu.1' }); // the view's form (core segmentView)
  assert.equal(sceneLine([lingering], 'cafe-owner', T + 1000, { waiting: c4 }), null, '서성임 — 마음 줄 차례');
  assert.equal(sceneLine([{ ...lingering, mood: undefined }], 'cafe-owner', T + 1000, { waiting: c4 }).id, 'cafe-owner.card.C4-trigger.1', '마음 줄이 없으면 필요 줄');
  assert.equal(sceneLine([seg('cafe-owner', { spot: 'greenhouse.bed' })], 'cafe-owner', T + 1000, { waiting: [...c4, { card: 'C1', owner: 'cafe-owner', status: 'triggered', key: 'd' }] }).id,
    'cafe-owner.card.C1-trigger.1', '찻집 밖에서도 다른 카드의 필요는 그대로');
  const { talkWhere } = await load('day-cards.mjs');
  assert.equal(talkWhere('C4'), '찻집에서 '); assert.equal(talkWhere('C1'), '');
});

test('인사 — 앎의 길(본 것·들은 것·소식)마다 그 주민의 틀에 소식 줄을 채우고, 말로 못 전하는 것은 말하지 않는다', async () => {
  const { hearsayText, lineText } = await load('day-cards.mjs');
  const news = lineText('village.news.C1.1');
  const seen = hearsayText('researcher', { ref: 'r', card: 'C1', path: 'self', actors: ['cafe-owner'], place: 'cafe', how: 'direct' });
  assert.ok(seen.text.includes(news) && !seen.text.includes('{'), seen.text);
  assert.deepEqual([seen.icon, seen.seen], ['direct', ['line:researcher.hearsay.seen.1', 'line:village.news.C1.1']]);
  const heard = hearsayText('cafe-owner', { ref: 'r', card: 'R5', path: 'self', actors: ['researcher'], place: 'greenhouse', how: 'heard', from: 'workshop-owner' });
  assert.match(heard.text, /공방 주인한테/);
  assert.equal(hearsayText('cafe-owner', { ref: 'r', card: 'C2', path: 'self', actors: [], place: 'cafe', how: 'news' }), null, '소식 줄이 없는 카드');
  assert.equal(hearsayText('cafe-owner', { ref: 'r', card: 'C1', path: 'self', actors: [], place: 'cafe', how: 'heard' }), null, '누구한테 들었는지 모르면');
});

test('장소 판 — 인사는 여기 있는 주민 하나, 기다리는 생활은 주인이 여기 있을 때만, 손에 든 생활이 있으면 없음, 문 앞 쪽지는 집에서 셋', async () => {
  const { placeModel } = await load('day-cards.mjs');
  const hearsay = { researcher: { ref: 'r1', card: 'R5', path: 'self', actors: ['researcher'], place: 'greenhouse', how: 'direct' }, 'cafe-owner': { ref: 'r2', card: 'W1', path: 'self', actors: ['workshop-owner'], place: 'workshop', how: 'news' } };
  const cards = [{ card: 'C1', owner: 'cafe-owner', status: 'triggered', key: 'k1', ready: true }, { card: 'W1', owner: 'workshop-owner', status: 'paused', key: 'k2', ready: true },
    { card: 'C5', owner: 'cafe-owner', status: 'triggered', key: 'k3', ready: false }];
  const at = placeModel({ location: 'cafe', residentsHere: ['cafe-owner'], hearsay, cards, news: [] });
  assert.equal(at.greet.npc, 'cafe-owner');
  assert.deepEqual(at.needs.map(n => [n.card, n.paused]), [['C1', false]], 'C5(찻집 주문 W8)는 아직 함께할 수 없다');
  assert.ok(at.needs[0].line && at.needs[0].title);
  assert.deepEqual(placeModel({ location: 'cafe', residentsHere: ['cafe-owner'], hearsay, cards, news: [], take: { card: 'C1', status: 'with' } }).needs, []);
  const news = ['C1', 'W3', 'R5', 'R4'].map((card, i) => ({ ref: `n${i}`, card }));
  assert.equal(placeModel({ location: 'home', residentsHere: [], hearsay, cards, news }).note.length, 3);
  assert.deepEqual(placeModel({ location: 'cafe', residentsHere: [], hearsay, cards, news }).note, []);
  // 한 곳에서만 여는 카드(첫 C4 — 찻집 차림표 앞)는 주인이 다른 곳에 있으면 단추 없이 「찻집에서」 한 줄(away, 화면 검수 F3).
  const c4 = [{ card: 'C4', owner: 'cafe-owner', status: 'triggered', key: 'k4', ready: true }];
  const there = placeModel({ location: 'greenhouse', residentsHere: ['cafe-owner'], hearsay: {}, cards: c4, news: [] });
  assert.deepEqual(there.needs, []); assert.equal(there.away.length, 1);
  assert.ok(/찻집/.test(there.away[0].line) && there.away[0].owner === 'cafe-owner', JSON.stringify(there.away));
  const atCafe = placeModel({ location: 'cafe', residentsHere: ['cafe-owner'], hearsay: {}, cards: c4, news: [] });
  assert.deepEqual(atCafe.needs.map(n => n.card), ['C4']); assert.deepEqual(atCafe.away, []);
  assert.deepEqual(placeModel({ location: 'greenhouse', residentsHere: [], hearsay: {}, cards: c4, news: [] }).away, [], '주인이 여기 없으면 없음');
  assert.deepEqual(placeModel({ location: 'greenhouse', residentsHere: ['cafe-owner'], hearsay: {}, cards: [{ ...c4[0], status: 'paused' }], news: [], take: { card: 'C4', status: 'with' } }).away, [], '손에 든 생활이 있으면 없음');
});

test('제안·고르기 판 — 이 창의 이 판에 발급된 제안만, 고르기는 서버가 허락한 것만, 마치면 결과 줄과 응답 넷', async () => {
  const { offerModel, takeModel, FEEDBACK } = await load('day-cards.mjs');
  const contact = { id: 'card:contact:3', card: 'R1', key: 'k', state: 'issued', issuedSurfaceId: 's', issuedFence: 2, bodyWaiting: true };
  assert.equal(offerModel(contact, { surfaceId: 's', fence: 2 }).owner, 'researcher');
  assert.equal(offerModel(contact, { surfaceId: 'other', fence: 2 }), null);
  assert.equal(offerModel({ ...contact, state: 'passed' }, { surfaceId: 's', fence: 2 }), null);
  const open = takeModel({ card: 'C1', key: 'k', status: 'with', choice: null, choices: ['inside', 'outside', 'watch'] });
  assert.deepEqual(open.choices.map(c => c.label), ['찻집 안에서', '바깥 자리에서', '구경할게요']);
  assert.equal(open.lineId, 'cafe-owner.card.C1-offer.1');
  const done = takeModel({ card: 'C1', key: 'k', status: 'resolved', choice: 'inside', choices: ['inside'], eventId: 'E-7', ref: '20748.day.C1' });
  assert.deepEqual([done.done, done.lineId, done.eventId, done.activity], [true, 'cafe-owner.card.C1-result.1', 'E-7', 'card.C1']);
  assert.deepEqual(FEEDBACK.map(([value]) => value), ['helpful', 'not_fit', 'too_much', 'want_more'], 'Atlas의 넷 그대로');
});

test('수첩 — 소식은 최근부터 날짜 없이, 할 수 있는 생활, 익숙한 생활은 본 것이 셋을 넘을 때, 오늘 한 일·주민이 아는 나·맞춰 둔 것', async () => {
  const { notebookModel, PAGES } = await load('day-notebook.mjs');
  assert.deepEqual(PAGES.map(([id]) => id), ['news', 'can', 'familiar', 'memory', 'book']);
  const snapshot = {
    seen: { 'card:C1:self': 2, 'card:C1:player': 2, 'card:W1:self': 3, 'pair:PAIR02:0': 4, 'line:x': 9 },
    state: { prefs: { preferredFamily: null, observed: 'cafe-life', lessOften: ['card.C2'], approachOptOut: [], feedback: [{ completionId: 'E-7', value: 'helpful', canonicalActivityId: 'card.C1', lifeDay: 20748 }], denied: [], todayOther: { visitId: null, items: [] } },
      village: { band: { lifeDay: 20748 }, news: [{ ref: 'a', card: 'C1' }, { ref: 'b', card: 'R5' }],
        takes: [{ card: 'C1', key: 'k', status: 'resolved', ref: '20748.day.C1', eventId: 'E-7' }, { card: 'W1', key: 'k0', status: 'resolved', ref: '20747.day.W1', eventId: 'E-3' }] } },
    view: { notebook: ['자리로 가는 그림을 골랐어요.'], day: { scene: { village: { cards: [{ card: 'R1', owner: 'researcher', status: 'triggered', key: 'r', ready: true }], knownMe: { 'cafe-owner': [{ ref: '20748.day.C1', card: 'C1', path: 'player' }] } } } } },
  };
  const m = notebookModel(snapshot);
  assert.deepEqual(m.news.map(n => n.card), ['R5', 'C1'], '최근 소식부터');
  assert.deepEqual(m.can.map(c => c.card), ['R1']);
  assert.deepEqual(m.familiar.map(f => f.key), ['card:C1', 'pair:PAIR02'], '합이 셋을 넘은 것만(W1은 셋)');
  assert.deepEqual(m.today.map(t => [t.card, t.given]), [['C1', 'helpful']], '오늘 것만, 남긴 응답과 함께');
  assert.deepEqual(m.known.map(k => [k.npc, k.ref]), [['cafe-owner', '20748.day.C1']]);
  assert.deepEqual(m.settings.map(s => s.action[0]), ['OBSERVED_CORRECT', 'PREF_LESS_OFTEN', 'FEEDBACK_REMOVE']);
  assert.deepEqual(m.settings.find(s => s.kind === 'less').action[1], { activity: 'card.C2', on: false });
  // G2·G3: 보이는 글에 숫자·날짜·연속 표시가 없다.
  const words = JSON.stringify([m.news.map(n => n.text), m.can.map(c => c.title), m.familiar.map(f => f.title), m.today.map(t => t.title), m.journal, m.settings.map(s => s.label)]);
  assert.doesNotMatch(words, /[0-9０-９]|번째|일째|연속/, words);
});

test('두 카드 겹침 — 나란히 선 쌍의 두 카드와 걷기 HUD는 서로 가리지 않는다', async () => {
  const { separate } = await load('day-mood.mjs');
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const out = separate([{ x: 300, y: 200, w: 200, h: 60 }, { x: 360, y: 210, w: 200, h: 60 }], { height: 600 });
  assert.ok(!hit(out[0], out[1]), JSON.stringify(out));
  const hud = [{ x: 24, y: 70, w: 200, h: 170 }], away = separate([{ x: 40, y: 100, w: 180, h: 60 }], { height: 600, avoid: hud });
  assert.ok(!hit(away[0], hud[0]), JSON.stringify(away));
  assert.deepEqual(separate([{ x: 10, y: 300, w: 50, h: 40 }], { height: 600 }), [{ x: 10, y: 300, w: 50, h: 40 }], '겹치지 않으면 그대로');
});

test('공개 직후 캐시 — 새 화면 모듈은 생성물을 이름 공간으로 읽고, 옛 모듈의 새 이름을 가져오지 않는다', () => {
  for (const file of ['day-cards.mjs', 'day-notebook.mjs']) {
    const code = fs.readFileSync(path.join(ROOT, 'experiences', 'synk-town', file), 'utf8');
    assert.match(code, /import \* as generated from '\.\/town\/data\.gen\.mjs'/, file);
    assert.doesNotMatch(code, /import \{[^}]*\} from '\.\/town\/data\.gen\.mjs'/, file);
  }
  // day-cards는 day-mood에서 이미 공개된 이름(ICONS)만 이름 공간으로 쓴다 — 캐시에 옛 day-mood가 있어도 이어진다.
  assert.match(fs.readFileSync(path.join(ROOT, 'experiences', 'synk-town', 'day-cards.mjs'), 'utf8'), /import \* as mood from '\.\/day-mood\.mjs'/);
});

// W10: 생활일 번호(1970-01-01부터 날 수)와 그날의 계절·요일. 공방 주인의 쉬는 날은 수요일(offWeekday 2).
const dayOf = (y, m, d) => Date.UTC(y, m - 1, d) / 86400000;

test('W10 계절 — R5의 필요 줄과 그 소식은 그 생활일의 계절 판(.1은 가을), 소식은 ref 머리의 생활일로 · ref가 없으면 .1', async () => {
  const { sceneLine, newsLine, seasonOf, hearsayText, lineText } = await load('day-cards.mjs');
  const spring = dayOf(2026, 4, 15), summer = dayOf(2026, 7, 1), autumn = dayOf(2026, 10, 30), winter = dayOf(2027, 1, 5);
  assert.deepEqual([spring, summer, autumn, winter, null].map(seasonOf), ['spring', 'summer', 'autumn', 'winter', null]);
  const waiting = [{ card: 'R5', owner: 'researcher', status: 'triggered', key: 'k' }];
  assert.equal(sceneLine([], 'researcher', T, { waiting, season: 'spring' }).id, 'researcher.card.R5-trigger.2');
  assert.equal(sceneLine([], 'researcher', T, { waiting, season: 'autumn' }).id, 'researcher.card.R5-trigger.1');
  assert.equal(sceneLine([], 'researcher', T, { waiting }).id, 'researcher.card.R5-trigger.1', '계절을 모르면 .1');
  const solving = sceneLine([seg('researcher', { archetype: 'observe', spot: 'greenhouse.bed', card: 'R5', cardRole: 'owner' })], 'researcher', T + 1, { season: 'winter' });
  assert.equal(solving.id, 'researcher.card.R5-self.4');
  assert.deepEqual(solving.seen.slice(0, 1), ['line:researcher.card.R5-self.4'], '본 것 키는 보인 판');
  assert.equal(newsLine('R5', `${summer}.day.R5`), 'village.news.R5.3');
  assert.equal(newsLine('R5', `${autumn}.day.R5`), 'village.news.R5.1');
  assert.equal(newsLine('R5'), 'village.news.R5.1');
  assert.equal(newsLine('C1', `${spring}.day.C1`), 'village.news.C1.1', '계절 판이 없는 소식은 그대로');
  const told = hearsayText('cafe-owner', { ref: `${winter}.morning.R5`, card: 'R5', path: 'self', actors: ['researcher'], place: 'greenhouse', how: 'news' });
  assert.ok(told.text.includes(lineText('village.news.R5.4')));
  assert.deepEqual(told.seen, ['line:cafe-owner.hearsay.news.1', 'line:village.news.R5.4']);
});

test('W10 인사 — 늦은 밤(23:30~05:30, 공방 주인은 새벽 03:00부터) · 바쁜 일 · 쉬는 일 · 그 밖은 구간×날씨, 조는 중엔 인사가 없다', async () => {
  const { greetLine } = await load('day-cards.mjs');
  const at = (h, m = 0) => h * 60 + m;
  assert.equal(greetLine('cafe-owner', { band: 'night', weather: 'clear', minute: at(23, 45), archetype: 'night-tea' }), 'cafe-owner.greet.late.1', '늦은 밤');
  assert.equal(greetLine('researcher', { band: 'night', weather: 'rain', minute: at(0, 30) }), 'researcher.greet.night-rain.1', '연구원의 늦은 밤은 밤꽃 세기 — 비 오는 밤엔 밤비 인사');
  assert.equal(greetLine('cafe-owner', { band: 'day', weather: 'clear', minute: at(13), archetype: 'deliver-tea' }), 'cafe-owner.greet.day-clear.1', '차 배달은 바쁨 인사(차를 우리는 중)가 아니다');
  assert.equal(greetLine('workshop-owner', { band: 'night', weather: 'clear', minute: at(22), archetype: 'night-carve' }), 'workshop-owner.greet.night-clear.1', '밤 조각은 밤 인사');
  assert.equal(greetLine('researcher', { band: 'night', weather: 'clear', minute: at(5, 10) }), 'researcher.greet.late.1');
  assert.equal(greetLine('researcher', { band: 'night', weather: 'clear', minute: at(23, 0) }), 'researcher.greet.night-clear.1');
  assert.equal(greetLine('workshop-owner', { band: 'night', weather: 'rain', minute: at(1, 0) }), 'workshop-owner.greet.night-rain.1', '공방의 늦은 밤 인사는 새벽 일찍 깸이라 03시 전엔 밤 인사');
  assert.equal(greetLine('workshop-owner', { band: 'night', weather: 'rain', minute: at(3, 30) }), 'workshop-owner.greet.late.1');
  assert.equal(greetLine('cafe-owner', { band: 'day', weather: 'clear', minute: at(13), archetype: 'serve' }), 'cafe-owner.greet.busy.1');
  assert.equal(greetLine('workshop-owner', { band: 'day', weather: 'clear', minute: at(13), archetype: 'craft' }), 'workshop-owner.greet.busy.1');
  assert.equal(greetLine('researcher', { band: 'day', weather: 'clear', minute: at(13), archetype: 'notes' }), 'researcher.greet.busy.1');
  assert.equal(greetLine('workshop-owner', { band: 'day', weather: 'clear', minute: at(13), archetype: 'breeze-lunch' }), 'workshop-owner.greet.resting.1');
  assert.equal(greetLine('researcher', { band: 'evening', weather: 'rain', minute: at(18), archetype: 'water' }), 'researcher.greet.evening-rain.1');
  assert.equal(greetLine('cafe-owner', { band: 'night', weather: 'clear', minute: null }), 'cafe-owner.greet.night-clear.1', '시계가 없으면 늦은 밤을 모른다');
  assert.equal(greetLine('cafe-owner', { band: 'day', weather: 'clear', minute: at(13), archetype: 'doze' }), null);
});

test('W10 일과 — 지금 원형의 한 줄, 쌍 장면은 둘 다 있을 때 그 쌍의 줄, 공방 주인 쉬는 날 아침은 휴무 기상, 원고가 없는 원형은 없음', async () => {
  const { routineLine } = await load('day-cards.mjs');
  const wednesday = dayOf(2026, 10, 28), thursday = dayOf(2026, 10, 29);
  assert.equal(routineLine('cafe-owner', { segments: [seg('cafe-owner', { archetype: 'brew' })], t: T + 1 }), 'cafe-owner.routine.brew.1');
  const pair = [seg('cafe-owner', { with: 'workshop-owner' }), seg('workshop-owner', { with: 'cafe-owner' })];
  assert.equal(routineLine('cafe-owner', { segments: pair, t: T + 1 }), 'cafe-owner.routine.pair-PAIR01.1');
  assert.equal(routineLine('cafe-owner', { segments: pair.slice(0, 1), t: T + 1 }), 'cafe-owner.routine.chat.1', '짝이 아직 없으면 그냥 이야기');
  const walk = [seg('workshop-owner', { archetype: 'stroll', spot: 'lane.mid' })];
  assert.equal(routineLine('workshop-owner', { segments: walk, t: T + 1, band: 'morning', lifeDay: wednesday }), 'workshop-owner.routine.holiday-wake.1');
  assert.equal(routineLine('workshop-owner', { segments: walk, t: T + 1, band: 'day', lifeDay: wednesday }), 'workshop-owner.routine.stroll.1');
  assert.equal(routineLine('workshop-owner', { segments: walk, t: T + 1, band: 'morning', lifeDay: thursday }), 'workshop-owner.routine.stroll.1');
  assert.equal(routineLine('workshop-owner', { segments: [seg('workshop-owner', { archetype: 'night-carve' })], t: T + 1 }), null);
  assert.equal(routineLine('researcher', { segments: [], t: T + 1 }), null, '자는 중');
});

test('W10 장소 판 — 들은 것이 없으면 여기 있는 주민 자기 말(인사 또는 지금 하는 일), 들은 것이 있으면 그 인사만', async () => {
  const { placeModel, lineText } = await load('day-cards.mjs');
  const own = npc => npc === 'cafe-owner' ? 'cafe-owner.greet.day-clear.1' : null;
  const quiet = placeModel({ location: 'cafe', residentsHere: ['workshop-owner', 'cafe-owner'], hearsay: {}, own });
  assert.deepEqual(quiet.own, { npc: 'cafe-owner', id: 'cafe-owner.greet.day-clear.1', kind: 'greet', text: lineText('cafe-owner.greet.day-clear.1'), icon: 'quiet', seen: ['line:cafe-owner.greet.day-clear.1'] });
  assert.equal(quiet.greet, null);
  assert.equal(placeModel({ location: 'cafe', residentsHere: ['cafe-owner'], hearsay: {}, own, level: 'L4' }).own.text, lineText('cafe-owner.greet.day-clear.1', 'L4'));
  const hearsay = { 'cafe-owner': { ref: 'r2', card: 'W1', path: 'self', actors: ['workshop-owner'], place: 'workshop', how: 'news' } };
  const told = placeModel({ location: 'cafe', residentsHere: ['cafe-owner'], hearsay, own });
  assert.equal(told.greet.npc, 'cafe-owner');
  assert.equal(told.own, null);
  assert.equal(placeModel({ location: 'cafe', residentsHere: ['cafe-owner'], hearsay: {} }).own, null, '옛 부르기(own 없음)');
  const home = placeModel({ location: 'home', residentsHere: [], hearsay: {}, news: [{ ref: `${dayOf(2026, 4, 2)}.day.R5`, card: 'R5' }] });
  assert.deepEqual(home.note.map(n => n.lineId), ['village.news.R5.2'], '쪽지는 보인 판의 줄 ID를 가진다');
});

test('W10 공개 직후 캐시 — day-app은 W10에 새로 생긴 이름(인사·일과·계절·작별 줄)을 이름 공간으로만 읽는다', () => {
  const code = fs.readFileSync(path.join(ROOT, 'experiences', 'synk-town', 'day-app.mjs'), 'utf8');
  for (const name of ['greetLine', 'routineLine', 'seasonOf', 'GOODBYE_LINE']) assert.doesNotMatch(code, new RegExp(`import \\{[^}]*\\b${name}\\b[^}]*\\} from`), name);
  assert.match(code, /import \* as dayCards from '\.\/day-cards\.mjs'/);
  assert.match(code, /import \* as newTeaModule from '\.\/new-tea\.mjs'/);
});

test('카드 거절 글 — WORLD 계정 경로는 코드만 남아도(마을 답이 글을 error 안에 둔다) 엔진과 같은 마을 말, 이름은 서버가 대는 주민', async () => {
  const { refusalWords } = await load('day-cards.mjs');
  const read = file => fs.readFileSync(path.join(ROOT, 'experiences', 'synk-town', file), 'utf8');
  const core = read('core.mjs'), app = read('day-app.mjs');
  const source = [core.slice(core.indexOf('function commandCard('), core.indexOf('export function reduceCommand(')),
    read('life.mjs').match(/export function cardContactFor[\s\S]*?\n}/)[0], core.match(/'conflicting-command', '[^']*', 409\)/)[0]].join('\n');
  // Every 409 of the cards' commands as the engine writes it; `${label(…)}` is the resident it names.
  const said = {};
  for (const m of source.matchAll(/'([a-z-]+)', (?:'([^']*)'|`([^`]*)`), 409\)/g)) (said[m[1]] ||= new Set()).add(m[2] ?? m[3]);
  const named = (code, name) => [...said[code]].map(words => words.replace(/\$\{label\([^)]*\)\}/, name));
  assert.deepEqual(Object.keys(said).sort(), ['card-busy', 'card-choice-first', 'card-not-open', 'card-not-waiting', 'card-owner-busy',
    'card-too-far', 'conflicting-command', 'resident-asleep', 'stale-greet', 'stale-life-contact'], '엔진의 카드 거절을 다 읽었다');
  const cafe = { 'cafe-owner': { to: 'cafe' }, 'workshop-owner': { to: 'workshop' } };
  for (const code of Object.keys(said).filter(c => c !== 'stale-greet')) {
    const words = refusalWords(code, code, { card: 'C4', places: cafe, location: 'cafe' });
    assert.ok(named(code, '찻집 주인').includes(words), `${code}: ${words}`);
  }
  // Whom it names: C1's neighbour asleep or held, as the server checks them after the owner.
  assert.ok(named('resident-asleep', '공방 주인').includes(refusalWords('resident-asleep', 'resident-asleep', { card: 'C1', places: { 'cafe-owner': { to: 'cafe' } } })));
  assert.ok(named('card-owner-busy', '공방 주인').includes(refusalWords('card-owner-busy', 'card-owner-busy', { card: 'C1', places: cafe, holds: { 'workshop-owner': { by: 'pair' } } })));
  // C4 beside her away from the cafe is turned down for the cafe; gone from the player, for being far.
  const away = { 'cafe-owner': { to: 'workshop' } };
  assert.equal(refusalWords('card-too-far', 'card-too-far', { card: 'C4', places: away, location: 'workshop' }), '찻집 주인에게는 찻집에서 말을 걸어 주세요.');
  assert.equal(refusalWords('card-too-far', 'card-too-far', { card: 'C4', places: away, location: 'cafe' }), '찻집 주인 가까이 가서 말을 걸어 주세요.');
  assert.equal(refusalWords('card-too-far', 'card-too-far', { card: 'C5', places: away, location: 'workshop' }), '찻집 주인 가까이 가서 말을 걸어 주세요.');
  assert.equal(refusalWords('card-too-far', '이미 온 마을 말'), '이미 온 마을 말', '글이 왔으면 그 글');
  assert.equal(refusalWords('card-new-code', 'card-new-code'), null, '모르는 코드는 글 없이(다시 읽기만)');
  // The app reads it by the namespace (an older cached day-cards has none), and says its words, not the bare code.
  assert.match(app, /dayCards\.refusalWords\?\.\(/);
  assert.doesNotMatch(app, /import \{[^}]*\brefusalWords\b[^}]*\} from '\.\/day-cards\.mjs'/);
  assert.doesNotMatch(app.slice(app.indexOf('function refused('), app.indexOf('function calmRefusal(')), /error\.message\)/);
});
