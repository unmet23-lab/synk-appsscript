// 두 사람 궁합. 사주 일간 오행의 상생상극 + 띠(입춘 기준 연지)의 삼합·육합·충·원진 + 태양 별자리 원소를 합친다.
// 같은 두 사람은 언제나 같은 결과이고, 입력 순서를 바꿔도 같은 결과다(두 사람을 정해진 순서로 정렬한 뒤 계산).
// 관계의 좋고 나쁨을 정하는 판정이 아니라 대화를 돕는 읽을거리다.
import { seoulDateKey, ZODIAC } from './core.mjs';
import { getSaju } from './saju-core.mjs';
import { suggestZodiac } from './insights.mjs';
import { josa } from './kit/josa.mjs';
import {
  deepFreeze, clamp, hash, elementRelation, branchRelation, sajuShape, signElement, westernRelation, threeHarmonyName,
} from './fortune-base.mjs';

const ASPECT_TEXT = {
  talk: {
    title: '대화',
    high: [
      '말하지 않아도 통하는 순간이 많아요. 떠오르는 생각을 편하게 나누면 대화가 금방 깊어져요.',
      '서로의 이야기에 쉽게 맞장구를 칠 수 있는 사이예요. 수다가 길어져도 즐거워요.',
      '아이디어를 주고받을수록 재미가 커지는 사이예요. 함께 계획을 세워 보면 좋아요.',
    ],
    mid: [
      '대화의 속도는 조금 달라도 결국 같은 곳에 닿는 사이예요. 상대의 말을 끝까지 들어 주면 더 잘 통해요.',
      '편안하게 이야기 나눌 수 있는 사이예요. 가끔은 마음속 이야기도 한 걸음 꺼내 보세요.',
      '가벼운 대화가 잘 어울리는 사이예요. 중요한 이야기는 차분한 자리에서 나누면 좋아요.',
    ],
    low: [
      '표현하는 방식이 서로 달라서 처음엔 뜻이 엇갈릴 수 있어요. "이런 뜻이었어?" 하고 한 번 물어보면 금방 풀려요.',
      '한 사람은 바로 말하고 한 사람은 생각한 뒤 말하는 편일 수 있어요. 대답을 조금 기다려 주면 대화가 편해져요.',
      '말보다 행동으로 마음을 전하는 쪽이 더 잘 맞을 수 있어요. 짧은 메모나 문자로 마음을 보태 보세요.',
    ],
  },
  pace: {
    title: '생활 속도',
    high: [
      '하루를 보내는 리듬이 잘 맞아요. 함께 움직이면 계획이 술술 풀려요.',
      '같이 있을 때 시간이 자연스럽게 흘러가는 사이예요. 함께하는 일상을 하나 만들어 보세요.',
      '서로의 일정과 속도를 맞추기 쉬운 사이예요. 여행이나 함께하는 취미가 잘 어울려요.',
    ],
    mid: [
      '각자의 속도가 있지만 맞춰 가기 어렵지 않은 사이예요. 일정을 미리 나누면 더 편해요.',
      '함께할 때와 따로 쉴 때의 균형이 잘 잡히는 사이예요.',
      '서로의 생활 방식을 존중하면 편안하게 오래 가는 사이예요.',
    ],
    low: [
      '한 사람은 빠르고 한 사람은 느긋한 편일 수 있어요. 중간 지점을 정해 두면 서로 편해져요.',
      '하루의 리듬이 다를 수 있어요. 함께하는 시간을 미리 정해 두면 엇갈림이 줄어요.',
      '움직이는 속도가 달라서 기다림이 생길 수 있어요. 각자의 시간을 존중해 주면 오히려 든든해져요.',
    ],
  },
  care: {
    title: '마음 챙김',
    high: [
      '서로를 자연스럽게 챙겨 주는 사이예요. 고마운 마음을 자주 말로 전하면 더 따뜻해져요.',
      '한 사람이 지칠 때 다른 사람이 기댈 곳이 되어 주는 사이예요.',
      '작은 배려가 오가며 마음이 쌓이는 사이예요. 기념일을 함께 챙겨 보세요.',
    ],
    mid: [
      '필요할 때 손을 내밀 줄 아는 사이예요. 서운한 점은 쌓아 두지 말고 가볍게 이야기해 보세요.',
      '각자의 방식으로 마음을 쓰는 사이예요. 상대가 좋아하는 챙김을 한 번 물어보세요.',
      '편안하게 기댈 수 있는 사이예요. 가끔은 먼저 안부를 물어 주세요.',
    ],
    low: [
      '마음을 표현하는 방식이 서로 다를 수 있어요. 어떤 말이 힘이 되는지 서로 알려 주면 좋아요.',
      '서운함이 작게 쌓이기 쉬운 사이라, 그때그때 짧게 말로 확인하면 마음이 편해져요.',
      '서로 다른 점이 오히려 배울 점이 되는 사이예요. 상대의 방식을 한 번 따라 해 보세요.',
    ],
  },
};
const HEADLINES = {
  5: ['서로를 키워 주는 든든한 짝', '함께라서 더 즐거운 사이', '손발이 척척 맞는 사이'],
  4: ['편안하게 오래 가는 사이', '서로에게 좋은 자극이 되는 사이', '함께할수록 잘 맞아 가는 사이'],
  3: ['다른 점을 알아 가는 재미가 있는 사이', '천천히 맞춰 가면 좋은 사이', '서로에게 새로운 시선을 주는 사이'],
  2: ['조금씩 맞춰 가며 가까워지는 사이', '배려가 힘이 되는 사이', '서로의 다름을 배워 가는 사이'],
};
const TIPS = {
  talk: ['이번 주에는 "요즘 어때?" 한마디로 대화를 먼저 열어 보세요.', '중요한 이야기는 서로 여유 있는 시간에 천천히 나눠 보세요.'],
  pace: ['함께하는 시간을 미리 정해 두고, 각자 쉬는 시간도 존중해 보세요.', '약속 시간과 일정을 미리 나눠 두면 서로 편해져요.'],
  care: ['상대가 힘이 나는 말이 무엇인지 한 번 물어보세요.', '서운한 일은 쌓아 두지 말고 그날 짧게 이야기해 보세요.'],
  all: ['좋은 흐름을 이어 가도록 함께하는 작은 습관을 하나 만들어 보세요.', '서로에게 고마운 점을 하나씩 말해 보는 시간을 가져 보세요.'],
};

export const COMPAT_TEXT = deepFreeze({ aspects: ASPECT_TEXT, headlines: HEADLINES, tips: TIPS });

const SAJU_BASE = { generate: 5, same: 4, control: 3 };
const ANIMAL_SHIFT = { threeHarmony: 1, sixHarmony: 1, same: 0, none: 0, unknown: 0, clash: -1, wonjin: -0.5 };
const ZODIAC_SHIFT = { same: 0.5, complement: 0.5, neutral: 0, challenging: -0.5 };
const TALK_BASE = { same: 4, complement: 5, neutral: 4, challenging: 3 };
const PACE_BASE = { threeHarmony: 5, sixHarmony: 5, same: 4, none: 4, unknown: 4, clash: 3, wonjin: 3 };

const level = value => clamp(Math.round(value), 2, 5);
const band = value => value >= 5 ? 'high' : value === 4 ? 'mid' : 'low';

function readName(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/u.test(value)) throw new TypeError('이름은 1~20자로 적어 주세요.');
  const name = value.trim();
  if (!name || [...name].length > 20) throw new TypeError('이름은 1~20자로 적어 주세요.');
  return name;
}

function readPerson(input, today) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('두 사람의 생년월일을 입력해 주세요.');
  const name = readName(input.name);
  const birthTime = input.birthTime ?? null;
  const saju = getSaju({ birthDate: input.birthDate, birthTime }, today);
  const shape = sajuShape(saju);
  const sign = suggestZodiac(input.birthDate);
  return { name, birthDate: input.birthDate, birthTime, key: `${input.birthDate}|${birthTime ?? ''}|${name ?? ''}`,
    stem: shape.stem, yearBranch: shape.yearBranch, sign, signEl: signElement(sign.signId) };
}

const who = person => person.name ? `${person.name} ` : '';
const animalLabel = branch => ZODIAC[branch.index].label;

function sajuLine(a, b, relation) {
  const head = `일간 · ${who(a)}${a.stem.name}(${a.stem.image}) · ${who(b)}${b.stem.name}(${b.stem.image}) — `;
  if (relation === 'same') return `${head}같은 ${a.stem.element} 기운이라 비슷한 결을 가졌어요.`;
  if (relation === 'expressing' || relation === 'supported') {
    const [giver, receiver] = relation === 'expressing' ? [a, b] : [b, a];
    return `${head}${giver.stem.element}${josa(giver.stem.element, '이', '가')} ${receiver.stem.element}${josa(receiver.stem.element, '을', '를')} 키워 주는 상생이에요.`;
  }
  const [controller, shaped] = relation === 'organizing' ? [a, b] : [b, a];
  return `${head}${controller.stem.element}${josa(controller.stem.element, '이', '가')} ${shaped.stem.element}${josa(shaped.stem.element, '을', '를')} 다듬어 주는 사이라 서로 좋은 자극이 돼요.`;
}

function animalLine(a, b, relation) {
  if (relation === 'unknown') return '띠 · 입춘 무렵에 태어나 띠를 정하지 못한 사람이 있어 띠 궁합은 빼고 봤어요. 태어난 시간을 알면 띠를 정할 수 있어요.';
  const head = `띠 · ${who(a)}${animalLabel(a.yearBranch)} · ${who(b)}${animalLabel(b.yearBranch)} — `;
  const [low, high] = [a.yearBranch, b.yearBranch].sort((x, y) => x.index - y.index);
  const text = {
    same: '같은 띠라 생활 리듬이 비슷해요.',
    threeHarmony: `${threeHarmonyName(a.yearBranch.index)} 삼합이라 함께 움직이기 좋아요.`,
    sixHarmony: `${low.hangul}${high.hangul} 육합이라 서로 잘 어울려요.`,
    clash: '서로 마주 보는 띠라 속도가 다를 수 있어요. 서로의 속도를 존중하면 오히려 균형이 잘 맞아요.',
    wonjin: '마음 쓰는 방식이 서로 달라서, 서운한 일은 그때그때 말로 확인하면 좋아요.',
    none: '특별한 합이나 충이 없는 무난한 사이예요.',
  }[relation];
  return head + text;
}

function signLine(a, b, relation) {
  const head = `별자리 · ${who(a)}${a.sign.label}(${a.signEl.label}) · ${who(b)}${b.sign.label}(${b.signEl.label}) — `;
  const [x, y] = [a.signEl.label, b.signEl.label].sort();
  let text;
  if (relation === 'same') text = `같은 ${x} 원소라 감각이 비슷해요.`;
  else if (relation === 'complement') text = `${x}${josa(x, '과', '와')} ${y}${josa(y, '은', '는')} 서로 북돋는 짝이에요.`;
  else if (relation === 'neutral') text = `${x}${josa(x, '과', '와')} ${y}${josa(y, '은', '는')} 무난하게 어울리는 사이예요.`;
  else text = `${x}${josa(x, '과', '와')} ${y}${josa(y, '은', '는')} 표현 방식이 달라 서로 배울 점이 많아요.`;
  const boundary = a.sign.isBoundaryDay || b.sign.isBoundaryDay ? ' 별자리 경계일 생일은 이웃 별자리일 수도 있어요.' : '';
  return head + text + boundary;
}

/**
 * @param {{ birthDate: string, birthTime?: string|null, name?: string }} first
 * @param {{ birthDate: string, birthTime?: string|null, name?: string }} second
 * @param {{ today?: string }} [options] 출생일 검사 기준(결과에는 영향 없음)
 */
export function getCompatibility(first, second, { today = seoulDateKey() } = {}) {
  const [a, b] = [readPerson(first, today), readPerson(second, today)].sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
  const sajuRelation = elementRelation(a.stem.element, b.stem.element);
  const sajuKind = sajuRelation === 'same' ? 'same' : sajuRelation === 'supported' || sajuRelation === 'expressing' ? 'generate' : 'control';
  const animal = a.yearBranch && b.yearBranch ? branchRelation(a.yearBranch, b.yearBranch) : 'unknown';
  const zodiac = westernRelation(a.signEl.id, b.signEl.id);
  const seed = `compat/${a.key}#${b.key}`;
  const choose = (pool, field) => pool[hash(`${seed}/${field}`) % pool.length];

  const overall = level(SAJU_BASE[sajuKind] + ANIMAL_SHIFT[animal] + ZODIAC_SHIFT[zodiac]);
  const levels = {
    talk: level(TALK_BASE[zodiac] + (sajuKind === 'generate' ? 0.5 : 0)),
    pace: level(PACE_BASE[animal] + (sajuKind === 'same' ? 0.5 : 0)),
    care: level(SAJU_BASE[sajuKind] + (animal === 'sixHarmony' ? 0.5 : animal === 'wonjin' ? -0.5 : 0)),
  };
  const aspects = ['talk', 'pace', 'care'].map(id => ({
    id, title: ASPECT_TEXT[id].title, level: levels[id], text: choose(ASPECT_TEXT[id][band(levels[id])], id),
  }));
  const lowest = aspects.reduce((min, item) => (item.level < min.level ? item : min));
  const tip = lowest.level >= 4 ? choose(TIPS.all, 'tip') : choose(TIPS[lowest.id], 'tip');
  return deepFreeze({
    overall, headline: choose(HEADLINES[overall], 'headline'), aspects, tip,
    relations: { dayMaster: sajuKind, animal, zodiac },
    basis: [sajuLine(a, b, sajuRelation), animalLine(a, b, animal), signLine(a, b, zodiac)],
    people: [a, b].map(person => ({ name: person.name, dayMaster: person.stem.name,
      animal: person.yearBranch ? animalLabel(person.yearBranch) : null, sign: person.sign.label })),
    note: '일간 오행·띠·별자리 원소의 전통 상징으로 보는 재미용 궁합이에요. 두 사람 관계의 좋고 나쁨을 정하지 않아요.',
  });
}
