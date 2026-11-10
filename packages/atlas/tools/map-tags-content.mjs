// 태그 묶음의 문항 글 · 후보 · 초안(tools/map-tags.mjs 준비). 은행마다 문항의 원문(지시 · 들려줄 글 · 보기 · 정답 · 해설)을 문항
// 열쇠로 찾아 검수자가 읽을 글로 펼치고, 글에서 지도 낱말 · 문형 후보를 기계로 찾는다(후보는 실마리일 뿐 — 검수자가 고른다).
// 초안: 찰칵 낱말은 규칙(낱말 글이 2,000 목록과 같으면 그 낱말), 제품 태그가 둘 이상인 문항은 제품 태그(주 단위 순서 확인 —
// Fable 설계 검토 물음 6), 나머지는 Opus가 쓴다(map-tags 초안).
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { unitName } from '../src/map/compose.mjs';

const load = (root, relative) => import(pathToFileURL(path.join(root, relative)).href);
const HIDE = new Set(['audio', 'voice', 'asset', 'assets', 'review', 'origin', 'batch', 'rev']);
const textOf = value =>
  JSON.stringify(value, (key, field) => (HIDE.has(key) ? undefined : field)).slice(0, 2400);

// 은행 전체를 다 싣는 은행과, 제품 태그가 둘 이상인 문항만 싣는 은행(주 단위 순서 확인). TOPIK은 3~4급(ko2) 전부 + 둘 이상.
export const ALL_ITEMS = new Set(['snap-words', 'world-life', 'talk-rally', 'subway-rush']);
export const MULTI_ONLY = new Set([
  'topik-items',
  'order-rush',
  'korean-rhythm',
  'entry-check',
  'story-classroom',
  'korean-runner',
]);
export function selected(item) {
  if (ALL_ITEMS.has(item.bank)) return true;
  if (!MULTI_ONLY.has(item.bank)) return false;
  return (
    item.conceptIds.length >= 2 || (item.bank === 'topik-items' && item.skillId.startsWith('ko2.'))
  );
}

// ── 은행마다 열쇠 → 원문 ──────────────────────────────────────────────────────────────────

async function lifeRaw(root) {
  const { worldLearning } = await load(root, 'experiences/synk-world-app/world-learning-map.mjs');
  const { LESSONS } = await load(root, 'experiences/synk-world-app/life-content.mjs');
  const out = new Map();
  for (const item of worldLearning.life.lifeItems()) {
    const lesson = LESSONS.find(l => l.id === item.lessonId);
    const question = lesson.questions.find(q => q.id === item.questionId);
    const body = item.review ? question.review : question;
    out.set(item.itemKey, {
      lesson: lesson.title,
      expressions: (lesson.expressions ?? []).map(e => `ko.life.${e.id} ${e.korean}`),
      context: body.context,
      prompt: body.prompt,
      story: body.story ?? lesson.story ?? undefined,
      choices: body.choices?.map(choice => choice.text),
      answer: body.choices?.find(choice => choice.id === body.answerId)?.text,
      explanation: body.explanation,
    });
  }
  return out;
}

async function snapRaw(root, items) {
  const { wordOf } = await load(root, 'experiences/snap-words/words.mjs');
  const out = new Map();
  for (const item of items) {
    const [, form, word] = item.itemKey.split('.');
    const entry = wordOf(word);
    // 화면에 실제로 나오는 글만 싣는다(app.mjs) — 뜻 · 안내판 부탁만 부탁 글(ask)이 있고, 소리 부탁은 낱말 소리, 회상은
    // 낱말과 뜻 보기뿐이다. 모든 꼴에 ask를 붙이면 검수자가 그 글의 단서 낱말을 단위로 더한다(11-10 태그 판정에서 찾음).
    const asked = form === 'meaning' || form === 'notice';
    out.set(item.itemKey, {
      form,
      word: entry.ko,
      meaning: entry.mean,
      ...(asked ? { ask: entry.ask?.ko } : {}),
    });
  }
  return out;
}

const byMeta = (list, metaOf) => new Map(list.map(raw => [metaOf(raw).itemKey, raw]));

async function rhythmRaw(root) {
  const core = await load(root, 'experiences/korean-rhythm/core.mjs');
  const personal = await load(root, 'experiences/korean-rhythm/personalization.mjs');
  const supplemental = await load(root, 'experiences/korean-rhythm/supplemental.mjs');
  const out = new Map();
  for (const track of core.TRACKS)
    track.questions.forEach((q, i) => {
      for (const variant of [0, 1])
        out.set(personal.rhythmItem(track.id, { sourceIndex: i, variant }).itemKey, {
          prompt: q.prompt,
          claim: q.claims[variant],
        });
      out.set(
        personal.rhythmItem(track.id, { sourceIndex: i }, { recall: true }).itemKey,
        q.recall,
      );
    });
  for (const item of [
    ...supplemental.supplementalItems(),
    ...supplemental.supplementalItems({ purpose: 'delayed', seen: () => false }),
  ])
    out.set(item.itemKey, {
      script: item.script,
      question: item.question ?? item.prompt,
      choices: item.choices,
      correctId: item.correctId,
      explanation: item.explanation,
    });
  return out;
}

const RAW = {
  'snap-words': snapRaw,
  'world-life': lifeRaw,
  'korean-rhythm': rhythmRaw,
  'talk-rally': async root => {
    const content = await load(root, 'experiences/talk-rally/content.mjs');
    const learning = await load(root, 'experiences/talk-rally/learning.mjs');
    const all = [...content.ITEMS, ...(Array.isArray(content.PRACTICE) ? content.PRACTICE : [])];
    return byMeta(all, learning.itemMetadata);
  },
  'subway-rush': async root => {
    const review = await load(root, 'experiences/subway-rush/review-items.mjs');
    return new Map(review.reviewItems().map(row => [row.itemKey, row]));
  },
  'topik-items': async root => {
    const bank = await load(root, 'experiences/topik-items/bank.mjs');
    return byMeta(bank.REVIEWED_ITEMS, bank.itemMeta);
  },
  'order-rush': async root => {
    const core = await load(root, 'experiences/order-rush/core.mjs');
    const learning = await load(root, 'experiences/order-rush/learning.mjs');
    const all = [...core.ORDERS, ...core.REVIEW, ...core.DELAYED_ORDERS, ...core.ADDITIONAL_ORDERS];
    return byMeta(all, learning.orderMetadata);
  },
  'entry-check': async root => {
    const content = await load(root, 'experiences/entry-check/content.mjs');
    const learning = await load(root, 'experiences/entry-check/learning.mjs');
    return byMeta(
      content.VENUES.flatMap(venue => venue.cases),
      learning.caseMetadata,
    );
  },
  'story-classroom': async root => {
    const story = await load(root, 'experiences/story-classroom/story.mjs');
    const learning = await load(root, 'experiences/story-classroom/learning.mjs');
    const all = [...story.EPISODE.acts.flatMap(act => act.missions), ...story.EPISODE.review];
    return byMeta(all, learning.missionMetadata);
  },
  'korean-runner': async root => {
    const check = await load(root, 'experiences/korean-runner/listening-check.mjs');
    return byMeta(check.LISTENING_CHECKS, check.checkMetadata);
  },
};

// ── 후보 ────────────────────────────────────────────────────────────────────────────────

function wordFinder(words) {
  const byFirst = new Map();
  for (const [id, label] of words) {
    const stem = label.endsWith('다') && label.length > 2 ? label.slice(0, -1) : label;
    const first = stem[0];
    if (!byFirst.has(first)) byFirst.set(first, []);
    byFirst.get(first).push({ id, label, stem });
  }
  return text => {
    const found = new Map();
    for (const token of text.match(/[가-힣]+/g) ?? [])
      for (const word of byFirst.get(token[0]) ?? [])
        if (token.startsWith(word.stem) && (word.stem.length > 1 || token.length <= 2))
          found.set(word.id, `ko.word.${word.id} ${word.label}`);
    return [...found.values()];
  };
}

// 후보는 문항 글(지시 · 지문 · 들려줄 글 · 보기 · 정답)에서만 찾는다 — 해설의 낱말 · 문형은 후보가 아니다.
const NOT_ITEM = new Set([...HIDE, 'explanation', 'why', 'choiceNotes', 'expressions', 'lesson']);
const itemOnly = value =>
  JSON.stringify(value, (key, field) => (NOT_ITEM.has(key) ? undefined : field));

function hintsFor(raw, find, grammarIn, grammarLabel) {
  const text = itemOnly(raw);
  const korean = (text.match(/[가-힣][가-힣\s,.?!]*/g) ?? []).join(' ');
  const grammar = [...new Set(grammarIn(korean).map(unitName))].map(id =>
    `${id} ${grammarLabel.get(id) ?? ''}`.trim(),
  );
  return [...grammar, ...find(korean)].slice(0, 16);
}

// 초안: 찰칵은 낱말 글 = 목록 낱말이면 그 낱말(규칙), 제품 태그가 둘 이상이면 제품 태그, 그 밖은 없음(Opus 초안을 받는다).
function draftOf(item, raw, wordByText) {
  if (item.bank === 'snap-words') {
    const id = wordByText.get(raw.word);
    return { units: id ? [`ko.word.${id}`] : [], by: 'rule:snap-word' };
  }
  if (item.conceptIds.length >= 2) return { units: item.conceptIds.map(unitName), by: 'product' };
  return null;
}

// items: readBanks의 메타에 bank를 붙인 것. 고른 문항(selected)만 묶음 줄로 낸다.
export async function tagContent(root, items, { units, words }) {
  const require = createRequire(path.join(root, 'x.js'));
  const { grammarIn } = require('./strata/topik-i-forms.js');
  const grammarLabel = new Map(units.map(([id, , label]) => [id, label]));
  const find = wordFinder(words);
  const wordByText = new Map(words.map(([id, label]) => [label, id]));
  const chosen = items.filter(selected);
  const raws = new Map();
  for (const bank of new Set(chosen.map(item => item.bank)))
    raws.set(
      bank,
      await RAW[bank](
        root,
        chosen.filter(item => item.bank === bank),
      ),
    );
  const seen = new Set();
  return chosen
    .filter(item => !seen.has(item.itemKey) && seen.add(item.itemKey))
    .map(item => {
      const raw = raws.get(item.bank).get(item.itemKey);
      if (!raw) throw new Error(`원문을 못 찾았다: ${item.bank} ${item.itemKey}`);
      return {
        key: item.itemKey,
        bank: item.bank,
        familyKey: item.familyKey,
        skillId: item.skillId,
        responseFormat: item.responseFormat,
        show: textOf(raw),
        hints: hintsFor(raw, find, grammarIn, grammarLabel),
        draft: draftOf(item, raw, wordByText),
      };
    });
}
