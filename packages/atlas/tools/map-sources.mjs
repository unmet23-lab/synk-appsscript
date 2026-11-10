// 지도 원천 읽기(단계 1 계획 §1 · §4): 저장소의 strata 원천(단위 · 능력)과 제품 문항 은행(문항 메타). 패키지 밖을 읽는 곳은
// 이 파일 하나다. 제품의 문항 메타 함수(지금 엔진에 넘기는 그 값)를 그대로 부른다 — 제품 코드를 복사하지 않는다.
// 엔진 묶음 · unit 시험은 이 파일을 부르지 않는다(제품 모듈을 읽으므로). tools/map-build.mjs와 build 시험만 쓴다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');

const readJson = (root, relative) =>
  JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8').replace(/^﻿/, ''));
const load = (root, relative) => import(pathToFileURL(path.join(root, relative)).href);

// ── 단위 ──────────────────────────────────────────────────────────────────────────────

// 문형의 급: TOPIK I은 지도(maps/topik-i.json)의 도입 급(level.intro — 원천 4번째 칸은 단계 step이라 쓰지 않는다),
// 3~4급 층은 표준 교육과정 등급(3 · 4).
function grammarUnits(root) {
  const intro = new Map(
    readJson(root, 'strata/maps/topik-i.json')
      .nodes.filter(node => node.kind === 'grammar_point')
      .map(node => [node.id, node.level?.intro ?? null]),
  );
  const first = readJson(root, 'strata/topik-i.grammar.json').points;
  const second = readJson(root, 'strata/topik-ii.grammar.json').points;
  return [
    ...first.map(([id, label]) => [`ko.grammar.${id}`, 'grammar', label, intro.get(id) ?? null]),
    ...second.map(([id, label, , level]) => [`ko.grammar.${id}`, 'grammar', label, level ?? null]),
  ];
}

function hangulUnits(root) {
  return readJson(root, 'strata/hangul.json').letters.map(([id, glyph]) => [
    `ko.hangul.${id}`,
    'hangul',
    glyph,
    null,
  ]);
}

// 생활 표현 단위 = 생활 레슨이 가르치는 표현(LESSONS의 expressions — 원고가 붙인 id, 11-10 Fable 설계 검토 P1-2로 설계 §3-1의
// 「지금의 71계열」을 좁혔다). 계열은 「한 문항의 답이 다른 문항의 답을 알려 주는가」의 측정 묶음이라 기억 단위가 아니다 — 사실 답
// (「1,000원」 · 「카페 창가」)과 다른 표현이 한 계열에 섞인다. 문항 → 표현은 태그 자료가 정한다(규칙이 아니라 2중 검수).
async function lifeUnits(root) {
  const { LESSONS } = await load(root, 'experiences/synk-world-app/life-content.mjs');
  const units = new Map();
  for (const lesson of LESSONS)
    for (const expression of lesson.expressions ?? [])
      if (!units.has(expression.id))
        units.set(expression.id, [`ko.life.${expression.id}`, 'life', expression.korean, null]);
  return [...units.values()];
}

function wordUnits(root) {
  return readJson(root, 'strata/topik-i.words.json').words.map(([id, word, pos, band]) => [
    id,
    word,
    pos,
    band,
  ]);
}

// 능력 = strata 지도들의 skill 마디 전부(TOPIK I · II · 한글 · 말하기 층).
function skillIds(root) {
  const dir = path.join(root, 'strata', 'maps');
  const skills = new Set();
  for (const file of fs
    .readdirSync(dir)
    .filter(name => name.endsWith('.json'))
    .sort()) {
    for (const node of readJson(root, path.join('strata', 'maps', file)).nodes ?? [])
      if (node.kind === 'skill') skills.add(node.id);
  }
  return skills;
}

export async function readUnits(root = REPO_ROOT) {
  return {
    units: [...grammarUnits(root), ...(await lifeUnits(root)), ...hangulUnits(root)],
    words: wordUnits(root),
    skills: skillIds(root),
  };
}

// ── 문항 은행 ────────────────────────────────────────────────────────────────────────────
// 은행마다 { bank, items: [메타] } — 메타는 제품 함수가 낸 그대로(능력이 skillIds 배열이면 첫째).

const meta = item => ({
  itemKey: item.itemKey,
  familyKey: item.familyKey || item.itemKey,
  skillId: item.skillId ?? item.skillIds?.[0],
  difficulty: item.difficulty,
  responseFormat: item.responseFormat,
  conceptIds: item.conceptIds ?? [],
  audioRequired: !!item.audioRequired,
  unknownOption: !!item.unknownOption,
});

const withPractice = content => [
  ...content.ITEMS,
  ...(Array.isArray(content.PRACTICE) ? content.PRACTICE : []),
];

// 찰칵 낱말: 문항 열쇠는 꼴 × 낱말이라 셀 수 있다. 부탁은 pickMissions(core.mjs)의 풀 규칙 — 안내문 무리는 안내문 부탁(ask가
// 있을 때), 그 밖은 뜻 부탁(ask) · 소리 부탁(voice), 물건은 낱말 부탁. 회상은 makeRecall — 물건은 낱말 고르기, 판 · 고정 판은 뜻 고르기.
function snapFormsOf(group, entry) {
  if (group.notice) return entry.ask ? ['notice'] : [];
  return [...(entry.ask ? ['meaning'] : []), ...(entry.voice ? ['sound'] : [])];
}
function snapMissions(place, wordOf) {
  return Object.values(place.groups)
    .filter(group => !group.noMission)
    .flatMap(group =>
      group.pool.flatMap(word => snapFormsOf(group, wordOf(word)).map(form => [form, word])),
    );
}
function snapRecalls(place) {
  return [
    ...Object.values(place.groups).flatMap(group =>
      group.pool.map(word => ['recall-meaning', word]),
    ),
    ...place.fixed.filter(fixed => fixed.word).map(fixed => ['recall-meaning', fixed.word]),
    ...place.things.map(thing => ['recall-word', thing.word]),
  ];
}
async function snapWords(root) {
  const { PLACES, PLACE_ORDER } = await load(root, 'experiences/snap-words/places.mjs');
  const { wordOf } = await load(root, 'experiences/snap-words/words.mjs');
  const { itemMetadata } = await load(root, 'experiences/snap-words/learning.mjs');
  return PLACE_ORDER.map(id => PLACES[id])
    .flatMap(place => [
      ...snapMissions(place, wordOf),
      ...place.things.map(thing => ['word', thing.word]),
      ...snapRecalls(place),
    ])
    .map(([form, word]) => itemMetadata(form, word));
}

// 한글 단계는 판마다 보기를 섞어 문항 열쇠가 그때 생긴다 — 계열 줄(꼴 × 글자)로 펼친다. 꼴 목록과 능력은 core.mjs의
// TYPES · skillOf 그대로다(내보내지 않아 여기 적고, build 시험이 원문과 맞댄다). 받침은 짝 맞추기 카드가 없다(makeMatch).
// 단위는 계열이 겨누는 글자 하나 — 규칙으로 정해지는 값이라 basis 'rule'이다(1판, 계획 §2).
export const HANGUL_TYPES = Object.freeze([
  'listen_pick',
  'see_pick',
  'build',
  'match',
  'pair',
  'teach',
]);
async function hangulTemplates(root) {
  const letters = readJson(root, 'strata/hangul.json').letters;
  const rows = [];
  for (const [id, , role] of letters) {
    for (const type of HANGUL_TYPES) {
      if (type === 'match' && role === 'final') continue;
      rows.push({
        familyKey: `hangul-stage.${type}.${id}`,
        skillId: type === 'see_pick' ? 'ko.hangul.read' : 'ko.hangul.sound',
        ruleUnits: [`ko.hangul.${id}`],
        audioRequired: type !== 'see_pick',
      });
    }
  }
  return rows;
}
// 드라마 시범: 문항 열쇠 = 대사 줄 id인데 장면(1) · 새 상황(2)에 따라 난도가 달라 계열 줄로 둔다(learning-entry.cjs open).
async function dramaTemplates(root) {
  const { PILOT } = await load(root, 'experiences/drama/pilot/content.mjs');
  const lines = new Map();
  const walk = value => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      if (typeof value.id === 'string' && /^ko\.speaking\./.test(value.skill ?? ''))
        if (!lines.has(value.id)) lines.set(value.id, value.skill);
      Object.values(value).forEach(walk);
    }
  };
  walk(PILOT);
  return [...lines].map(([id, skillId]) => ({ familyKey: id, skillId, audioRequired: false }));
}
export const TEMPLATE_BANKS = Object.freeze({
  'hangul-stage': hangulTemplates,
  'drama-pilot': dramaTemplates,
});

export const BANKS = Object.freeze({
  // 검수 통과 문항 전부(일반 은행 PUBLISHED + 재확인 예약 — WORLD followup · 리듬 보충이 예약 문항을 낸다).
  'topik-items': async root => {
    const bank = await load(root, 'experiences/topik-items/bank.mjs');
    return bank.REVIEWED_ITEMS.map(bank.itemMeta);
  },
  'blank-slice': async root => {
    const content = await load(root, 'experiences/blank-slice/content.mjs');
    const learning = await load(root, 'experiences/blank-slice/learning.mjs');
    return withPractice(content).map(learning.itemMetadata);
  },
  'talk-rally': async root => {
    const content = await load(root, 'experiences/talk-rally/content.mjs');
    const learning = await load(root, 'experiences/talk-rally/learning.mjs');
    return withPractice(content).map(learning.itemMetadata);
  },
  'order-rush': async root => {
    const core = await load(root, 'experiences/order-rush/core.mjs');
    const learning = await load(root, 'experiences/order-rush/learning.mjs');
    const orders = new Map();
    for (const order of [
      ...core.ORDERS,
      ...core.REVIEW,
      ...core.DELAYED_ORDERS,
      ...core.ADDITIONAL_ORDERS,
    ])
      if (!orders.has(order.id)) orders.set(order.id, order);
    return [...orders.values()].map(learning.orderMetadata);
  },
  'order-rush-beginner': async root => {
    const core = await load(root, 'experiences/order-rush/beginner-core.mjs');
    const voices = new Map();
    for (let stage = 0; stage < core.STAGES.length; stage += 1)
      for (const order of core.stageOrders(stage, 1))
        if (!voices.has(order.voice)) voices.set(order.voice, order);
    return [...voices.values()].map(core.metadata);
  },
  'korean-rhythm': async root => {
    const core = await load(root, 'experiences/korean-rhythm/core.mjs');
    const personal = await load(root, 'experiences/korean-rhythm/personalization.mjs');
    const supplemental = await load(root, 'experiences/korean-rhythm/supplemental.mjs');
    // 노래 문항 하나 = 주장 둘(variant 0 · 1) + 다시 묻기 하나(recall — 같은 계열).
    const songs = core.TRACKS.flatMap(track =>
      track.questions.flatMap((_, i) => [
        personal.rhythmItem(track.id, { sourceIndex: i, variant: 0 }),
        personal.rhythmItem(track.id, { sourceIndex: i, variant: 1 }),
        personal.rhythmItem(track.id, { sourceIndex: i }, { recall: true }),
      ]),
    );
    return [
      ...songs,
      ...supplemental.supplementalItems(),
      ...supplemental.supplementalItems({ purpose: 'delayed', seen: () => false }),
    ];
  },
  'entry-check': async root => {
    const content = await load(root, 'experiences/entry-check/content.mjs');
    const learning = await load(root, 'experiences/entry-check/learning.mjs');
    return content.VENUES.flatMap(venue => venue.cases).map(learning.caseMetadata);
  },
  'story-classroom': async root => {
    const story = await load(root, 'experiences/story-classroom/story.mjs');
    const learning = await load(root, 'experiences/story-classroom/learning.mjs');
    return [...story.EPISODE.acts.flatMap(act => act.missions), ...story.EPISODE.review].map(
      learning.missionMetadata,
    );
  },
  'korean-runner': async root => {
    const check = await load(root, 'experiences/korean-runner/listening-check.mjs');
    const learning = await load(root, 'experiences/korean-runner/learning.mjs');
    const { INSTRUCTIONS } = await load(root, 'experiences/korean-runner/instructions.mjs');
    return [
      ...check.LISTENING_CHECKS.map(check.checkMetadata),
      ...INSTRUCTIONS.map(learning.instructionMetadata),
    ];
  },
  // 캠페인 · 결승 문항 + 낱말 판(400판 × 낱말 다섯 = 2,000, 모두 듣거나 그림 — 소리가 든다). racingItem을 바로 부른다
  // (RACING_CANDIDATES에는 audioRequired가 없다).
  'korean-racing': async root => {
    const personal = await load(root, 'experiences/korean-racing/personalization.js');
    const { CAMPAIGN } = await load(root, 'experiences/korean-racing/campaign.js');
    const { FINALES } = await load(root, 'experiences/korean-racing/finales.js');
    const { STAGES } = await load(root, 'experiences/korean-racing/curriculum.js');
    return [
      ...CAMPAIGN.flatMap(stage => stage.items),
      ...FINALES.flatMap(finale => finale.items),
      ...STAGES.flatMap(stage => stage.words.map(answer => ({ answer, mode: stage.mode }))),
    ].map(personal.racingItem);
  },
  // 갈림 결정 · 만남의 변형 전체(문항 검수 원본 reviewItems — 게임과 같은 decisionMeta · meetingMeta).
  'subway-rush': async root => {
    const review = await load(root, 'experiences/subway-rush/review-items.mjs');
    return review.reviewItems();
  },
  'word-magic': async root => {
    const core = await load(root, 'experiences/word-magic/core.mjs');
    const learning = await load(root, 'experiences/word-magic/learning.mjs');
    const out = [];
    for (let chapter = 0; core.chapterProgress(core.initialProgress(), chapter); chapter += 1)
      for (const index of [0, 1])
        out.push(learning.checkpointMetadata(core.checkpoint(chapter, index)));
    return out;
  },
  'synk-town-reading': async root => {
    const town = await load(root, 'experiences/synk-town/understanding.mjs');
    return town.READING_CHECKS.map(town.readingMetadata);
  },
  'world-speaking': async root => {
    const { speakingMeasure } = await load(root, 'strata/topik-speaking.js');
    const bank = readJson(root, 'experiences/synk-world-app/world-speaking-items.json');
    const rows = [
      ...bank.items.map(item => [item.id, speakingMeasure({ type: item.type })]),
      ...(bank.roleplays ?? []).map(play => [play.id, speakingMeasure({ roleplay: play.id })]),
    ];
    return rows.map(([id, measure]) => ({
      ...measure,
      itemKey: `speaking.${id}`,
      familyKey: `speaking.${id}`,
    }));
  },
  'world-writing': async root => {
    const { WRITING_SKILLS } = await load(
      root,
      'experiences/synk-world-app/world-writing-practice.mjs',
    );
    const bank = readJson(root, 'experiences/synk-world-app/world-writing-items.json');
    return bank.items.map(item => ({
      itemKey: `writing.${item.id}`,
      familyKey: `writing.${item.id}`,
      skillId: WRITING_SKILLS[item.type],
      difficulty: 2,
      responseFormat: 'unknown',
      audioRequired: false,
    }));
  },
  'world-life': async root => {
    const { worldLearning } = await load(root, 'experiences/synk-world-app/world-learning-map.mjs');
    return worldLearning.life.lifeItems();
  },
  'snap-words': snapWords,
});

// 은행을 정해진 차례로 읽는다. 같은 문항이 한 은행 안에 두 번 나오면(찰칵의 두 장소처럼) 조립(compose)이 칸이 같을 때만
// 첫 자리 하나로 합치고, 다르면 멈춘다.
export async function readBanks(root = REPO_ROOT, names = Object.keys(BANKS)) {
  const banks = [];
  for (const bank of names) banks.push({ bank, items: (await BANKS[bank](root)).map(meta) });
  for (const [bank, read] of Object.entries(TEMPLATE_BANKS))
    banks.push({ bank, template: true, items: await read(root) });
  return banks;
}
