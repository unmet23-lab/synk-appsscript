// 태그 묶음의 문항 글 · 후보 · 초안(tools/map-tags.mjs 준비). 은행마다 문항의 원문(지시 · 들려줄 글 · 보기 · 정답 · 해설)을 문항
// 열쇠로 찾아 검수자가 읽을 글로 펼치고, 글에서 지도 낱말 · 문형 후보를 기계로 찾는다(후보는 실마리일 뿐 — 검수자가 고른다).
// 초안: 찰칵 낱말은 규칙(낱말 글이 2,000 목록과 같으면 그 낱말), 제품 태그가 둘 이상인 문항은 제품 태그(주 단위 순서 확인 —
// Fable 설계 검토 물음 6), 나머지는 Opus가 쓴다(map-tags 초안).
import fs from 'node:fs';
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

// 레이싱 캠페인 · 결승(11-11 둘째 묶음): 듣기 문항은 지문 + 질문을 소리로 듣고(질문 mp3 = spoken) 화면에는 질문 한 줄
// (#prompt)과 보기 셋의 글자 꼬리표만 보인다 — 지문은 「글로 보기」 · 자막을 켜야 보인다(race-controller.js renderQuestion).
// 보기도 길마다 소리로 읽어 준다(narration.js questionNarration). 읽기 문항은 지문 · 질문 · 보기가 화면에 펼쳐진다.
// 낱말 판(400판)은 이 묶음이 아니다 — 낱말 하나를 듣고 고르는 문항이라 제품 태그(그 낱말)가 이미 있다.
async function racingRaw(root) {
  const { CAMPAIGN } = await load(root, 'experiences/korean-racing/campaign.js');
  const { FINALES } = await load(root, 'experiences/korean-racing/finales.js');
  const out = new Map();
  for (const q of [...CAMPAIGN, ...FINALES].flatMap(stage => stage.items)) {
    const reading = q.mode === 'reading';
    out.set(`korean-racing:${q.id}:v1`, {
      form: reading
        ? '읽기 — 지문 · 질문 · 보기 셋(글자)이 화면에 보인다'
        : '듣기 — 지문과 질문을 소리로 듣는다(화면에는 질문 한 줄만). 보기 셋은 글자 꼬리표로 보이고 소리로도 읽어 준다',
      ...(reading ? { passage: q.passage } : { heard: q.spoken }),
      prompt: q.prompt,
      choices: q.choices.map(choice => choice.word),
      answer: q.word,
      explanation: q.explanation,
    });
  }
  return out;
}

// WORLD 말하기(11-11 둘째 묶음): 열린 말하기 과제 — 녹음을 받아쓰기로 옮겨 AI가 참고 의견을 낸다(점수 · 합불 없음, covers를
// 다뤘나만 표시 — world-speaking-practice.mjs). 화면에는 상황 · 그림 설명 · 4컷 · 대화문 · 기사 · 자료 · 지시가 글로 보이고,
// 직원 말은 소리로도 듣는다. 모범답은 「모범답 보기」를 눌러야 보인다. 역할극은 직원 말을 듣고 차례마다 말하면 규칙이 주문
// 칸(음료 · 온도 · 수 · 자리)을 채운다.
const SPEAKING_FORM =
  '말하기 — 열린 과제. 녹음한 말을 받아쓰기로 옮겨 AI가 참고 의견만 낸다(점수 · 정답 없음, 다룬 내용(covers)을 표시)';
function speakingShown(item) {
  return {
    form: SPEAKING_FORM,
    situation: item.situation,
    picture: item.picture?.alt,
    partnerSays: item.partner?.line,
    panels: item.panels?.map(panel => panel.alt),
    dialogue: item.dialogue?.map(line => `${line.speaker}: ${line.line}`),
    news: item.news,
    data: item.data,
    prompt: item.prompt,
    covers: item.covers,
    modelOnTap: item.model,
  };
}
async function speakingRaw(root) {
  const bank = JSON.parse(
    fs.readFileSync(
      path.join(root, 'experiences/synk-world-app/world-speaking-items.json'),
      'utf8',
    ),
  );
  const out = new Map(bank.items.map(item => [`speaking.${item.id}`, speakingShown(item)]));
  for (const play of bank.roleplays ?? [])
    out.set(`speaking.${play.id}`, {
      form: '말하기 역할극 — 직원 말을 듣고 차례마다 말하면 규칙이 주문 칸(음료 · 온도 · 수 · 자리)을 채운다',
      mission: play.mission,
      goal: play.goal,
      turns: play.steps.map(step => ({
        staffSays: step.line,
        fills: step.asks,
        model: step.model,
      })),
    });
  return out;
}

// WORLD 쓰기: 51 · 52형은 ㉠ ㉡ 빈칸에 한 문장씩, 53 · 54형은 글쓰기. 점수 없이 규칙 점검(끝 꼴 · 문체 · 글자 수 —
// world-writing-check.mjs)과 AI 참고 의견만 있다. 모범답 · 허용 범위는 「모범답」을 눌러야 보인다.
async function writingRaw(root) {
  const bank = JSON.parse(
    fs.readFileSync(path.join(root, 'experiences/synk-world-app/world-writing-items.json'), 'utf8'),
  );
  const passageOf = item =>
    (item.passage ?? [])
      .map(paragraph =>
        (Array.isArray(paragraph) ? paragraph : [paragraph])
          .map(part =>
            typeof part === 'string'
              ? part
              : `( ${item.blanks?.find(b => b.id === part.blank)?.mark ?? '?'} )`,
          )
          .join(''),
      )
      .join('\n');
  return new Map(
    bank.items.map(item => [
      `writing.${item.id}`,
      {
        form: '쓰기 — 산출 과제(정답 비교 없음). 규칙 점검(끝 꼴 · 문체 · 글자 수)과 AI 참고 의견',
        instruction: item.instruction,
        heading: item.heading,
        passage: passageOf(item) || undefined,
        prompt: item.prompt,
        data: item.data,
        questions: item.questions,
        blanksModelOnTap: item.blanks?.map(blank => `${blank.mark} ${blank.model}`),
        watch: item.watch,
      },
    ]),
  );
}

const RAW = {
  'world-speaking': speakingRaw,
  'world-writing': writingRaw,
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
  // 바람길: 듣기 확인(LISTENING_CHECKS) + 달리기 지시(INSTRUCTIONS — 11-11 둘째 묶음). 지시는 소리로만 듣고(말풍선은 「잘 들어
  // 보세요」, 글은 「글로 보기」를 눌러야 — app.mjs sayShow · sayText) 세 길에서 몸으로 움직인다. 표시선은 길 가운데 하나라 방향을
  // 드러내지 않고, 지시에 딸린 울타리 · 표지판은 세 길을 다 막아 뛰기 · 숙이기를 드러낸다(world.mjs · core.mjs — 11-11 판정자가
  // 코드로 바로잡음, confounded). 해설은 놓쳤을 때만 보인다.
  'korean-runner': async root => {
    const check = await load(root, 'experiences/korean-runner/listening-check.mjs');
    const learning = await load(root, 'experiences/korean-runner/learning.mjs');
    const { INSTRUCTIONS, actionLabel } = await load(
      root,
      'experiences/korean-runner/instructions.mjs',
    );
    const out = byMeta(check.LISTENING_CHECKS, check.checkMetadata);
    for (const item of INSTRUCTIONS)
      out.set(learning.instructionMetadata(item).itemKey, {
        form: '듣기 — 지시를 소리로만 듣고(글자 없음), 세 길 달리기에서 몸으로 움직인다. 방향(왼쪽 · 가운데 · 오른쪽)은 소리로만 알 수 있고, 울타리 · 표지판은 세 길을 다 막아 뛰기 · 숙이기를 드러낸다',
        heard: item.text,
        actions: item.steps.map(actionLabel),
        explanation: item.explanation,
      });
    return out;
  },
  // 한국어 처음(주문 폭주 입문): 손님 말을 소리로만 듣고(문장 글자는 「그림 도움」을 눌러야), 진열대의 그림 물건(글자 꼬리표
  // 없음)을 그 개수만큼 담아 건넨다(beginner.mjs). 진열대는 그 문항이 처음 나오는 판의 물건이다.
  'order-rush-beginner': async root => {
    const core = await load(root, 'experiences/order-rush/beginner-core.mjs');
    const out = new Map();
    core.STAGES.forEach((stage, at) => {
      for (const order of core.stageOrders(at, 1)) {
        const key = core.metadata(order).itemKey;
        if (out.has(key)) continue;
        out.set(key, {
          form: '듣기 — 손님 말을 소리로만 듣고(글자 없음), 진열대의 그림(글자 없음)에서 그 물건을 그 개수만큼 담아 건넨다',
          prompt: '손님은 무엇을 원할까요? — 들었던 물건을 담고 손님에게 건네 주세요.',
          heard: order.text,
          shelf: stage.items.map(id => `그림: ${core.ITEMS[id].english}`),
          answer: `그림 ${core.ITEMS[order.item].english} ${order.count}개`,
        });
      }
    });
    return out;
  },
  // 빈칸 썰기: 빈칸 문장이 화면에 보이고 보기 넷은 날아오는 조각 글자다(소리 없음). 해설은 답한 뒤에만(app.mjs showExplain).
  'blank-slice': async root => {
    const content = await load(root, 'experiences/blank-slice/content.mjs');
    const learning = await load(root, 'experiences/blank-slice/learning.mjs');
    const all = [...content.ITEMS, content.PRACTICE];
    return new Map(
      all.map(item => [
        learning.itemMetadata(item).itemKey,
        {
          form: '읽기 — 빈칸 문장을 읽고, 날아오는 보기 조각 넷 가운데 빈칸에 맞는 말을 벤다(소리 없음)',
          sentence: item.text.replace('{}', '（　）'),
          choices: item.options,
          answer: item.answer,
          explanation: item.why,
        },
      ]),
    );
  },
  'korean-racing': racingRaw,
  // 싱크타운 읽기: 지문 · 질문 · 보기 셋(순서 고정)이 화면에 있고 그림 · 소리 · 따로 지시문은 없다. 힌트는 「힌트 보기」를
  // 눌러야 보이는 도움이고, 해설은 답한 뒤에만 보인다(understanding-ui.mjs · day-app.mjs).
  'synk-town-reading': async root => {
    const town = await load(root, 'experiences/synk-town/understanding.mjs');
    const shown = item => ({
      passage: item.passage,
      question: item.question,
      choices: item.choices,
      answer: item.choices[item.correct],
      hintOnTap: item.hint,
      explanation: item.explanation,
    });
    return new Map(
      town.READING_CHECKS.map(item => [town.readingMetadata(item).itemKey, shown(item)]),
    );
  },
  // 낱말 마법 확인: 한국어 낱말 하나를 소리로만 듣고(화면에 한국어 글자 · 그림 없음) 학습자 언어(영어)의 변화 보기 둘 가운데
  // 들은 것을 고른다 — 지시문 「어떤 변화를 들었나요?」(app.mjs · core.mjs checkpointView).
  'word-magic': async root => {
    const { SPELLS, CHAPTERS } = await load(root, 'experiences/word-magic/content.mjs');
    const out = new Map();
    for (const chapter of CHAPTERS)
      for (const spell of chapter.pair)
        out.set(`word-magic.${chapter.id}.${spell}.v2`, {
          form: '듣기 — 한국어 낱말 하나를 소리로만 듣고(화면에 한국어 글자 · 그림 없음), 학습자 언어(영어) 보기 둘 가운데 들은 변화를 고른다',
          prompt: '어떤 변화를 들었나요?',
          heard: SPELLS[spell].ko,
          choices: chapter.pair.map(id => SPELLS[id].en),
          answer: SPELLS[spell].en,
        });
    return out;
  },
};

// ── 후보 ────────────────────────────────────────────────────────────────────────────────

// 후보 이름은 카탈로그와 같은 「글(품사 · 뜻)」 — 같은 글 단위가 둘(뜻 고르기의 개 · 새 · 말 · 눈 · 차)이면 둘 다 후보로 뜨고
// 검수자가 뜻으로 고른다.
function wordFinder(words) {
  const byFirst = new Map();
  for (const [id, label, pos, , sense] of words) {
    const stem = label.endsWith('다') && label.length > 2 ? label.slice(0, -1) : label;
    const first = stem[0];
    if (!byFirst.has(first)) byFirst.set(first, []);
    byFirst.get(first).push({ id, label: `${label}(${pos}${sense ? ` · ${sense}` : ''})`, stem });
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
// 11-11: 묶음 글의 꼴 설명(form) · 동작 이름(actions) · 진열 그림(shelf)과 눌러야 보이는 도움(hintOnTap · modelOnTap ·
// blanksModelOnTap · watch)도 후보가 아니다 — 설명 글의 낱말이 후보 16자리를 채웠다.
const NOT_ITEM = new Set([
  ...HIDE,
  'explanation',
  'why',
  'choiceNotes',
  'expressions',
  'lesson',
  'form',
  'actions',
  'shelf',
  'hintOnTap',
  'modelOnTap',
  'blanksModelOnTap',
  'watch',
]);
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
// pick: 고를 문항(없으면 첫 묶음의 selected), drafts: 열쇠 → 초안(--다시 — 지금 단위를 초안으로 다시 본다).
export async function tagContent(root, items, { units, words, pick = null, drafts = new Map() }) {
  const require = createRequire(path.join(root, 'x.js'));
  const { grammarIn } = require('./strata/topik-i-forms.js');
  const grammarLabel = new Map(units.map(([id, , label]) => [id, label]));
  const find = wordFinder(words);
  // 찰칵 규칙 초안: 같은 글 단위가 둘이면 어느 뜻인지 모르므로 규칙으로 붙이지 않는다(검수가 고른다).
  const wordByText = new Map();
  for (const [id, label] of words) wordByText.set(label, wordByText.has(label) ? null : id);
  const chosen = items.filter(pick ?? selected);
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
        draft: drafts.get(item.itemKey) ?? draftOf(item, raw, wordByText),
      };
    });
}
