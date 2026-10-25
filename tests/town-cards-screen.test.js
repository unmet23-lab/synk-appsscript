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
