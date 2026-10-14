// 「나」 카드. 띠(입춘 기준 연지) · 일간 · 태양 별자리 · 확인된 겉글자 오행 분포를 한 장에 모은다.
// 계산은 saju-core(getSaju)와 insights(suggestZodiac)를 그대로 쓴다. 성격을 판정하지 않는 소개 글이다.
import { seoulDateKey, ZODIAC } from './core.mjs';
import { getSaju } from './saju-core.mjs';
import { suggestZodiac } from './insights.mjs';
import { josa } from './kit/josa.mjs';
import { deepFreeze, sajuShape, signElement, STEMS } from './fortune-base.mjs';

const TRAITS = {
  갑: '곧게 자라는 큰 나무처럼 한번 정한 방향을 꾸준히 밀고 가는 편이에요.',
  을: '바람에 유연하게 휘는 풀꽃처럼 어디서든 자기 자리를 찾아 어울리는 편이에요.',
  병: '모두를 비추는 햇살처럼 밝고 시원시원하게 분위기를 이끄는 편이에요.',
  정: '은은한 촛불처럼 가까운 사람을 세심하게 밝혀 주는 편이에요.',
  무: '든든한 산처럼 쉽게 흔들리지 않고 주변을 품어 주는 편이에요.',
  기: '씨앗을 키우는 들판처럼 차분하게 사람과 일을 가꾸는 편이에요.',
  경: '단단한 바위처럼 의리 있고 마음먹은 일을 시원하게 정하는 편이에요.',
  신: '반짝이는 보석처럼 섬세하고 자기만의 기준이 분명한 편이에요.',
  임: '넓은 바다처럼 생각의 폭이 크고 흐름을 읽는 데 밝은 편이에요.',
  계: '조용히 스며드는 단비처럼 다정하고 감수성이 풍부한 편이에요.',
};
export const DAY_MASTER_TRAITS = deepFreeze(STEMS.map(stem => ({ hanja: stem.hanja, name: stem.name, image: stem.image, trait: TRAITS[stem.hangul] })));

function elementSummary(elements) {
  const total = elements.reduce((sum, item) => sum + item.count, 0);
  const max = Math.max(...elements.map(item => item.count));
  const top = elements.filter(item => item.count === max).map(item => item.label);
  const missing = elements.filter(item => item.count === 0).map(item => item.label);
  const topText = top.join('·');
  const first = `확인된 글자 ${total}개 중 ${topText}${josa(top.at(-1), '이', '가')} ${max}개로 가장 많아요.`;
  const second = missing.length
    ? `${missing.join('·')}${josa(missing.at(-1), '은', '는')} 겉글자에 보이지 않지만, 그 기운이 없다는 뜻은 아니에요.`
    : '다섯 오행이 모두 한 번 이상 보여요.';
  return { total, dominant: top, missing, text: `${first} ${second}` };
}

/**
 * @param {{ birthDate: string, birthTime?: string|null, today?: string }} input 양력 생년월일 · 한국 시각(모르면 null)
 */
export function getMeCard({ birthDate, birthTime = null, today = seoulDateKey() } = {}) {
  const saju = getSaju({ birthDate, birthTime }, today);
  const shape = sajuShape(saju);
  const animal = shape.yearBranch
    ? { id: ZODIAC[shape.yearBranch.index].id, label: ZODIAC[shape.yearBranch.index].label,
      name: ZODIAC[shape.yearBranch.index].label.replace(/띠$/, ''), branch: shape.yearBranch.hangul, hanja: shape.yearBranch.hanja }
    : null;
  const sign = suggestZodiac(birthDate);
  const summary = elementSummary(saju.elements);
  const notes = ['띠는 입춘 절입 시각을 새해 경계로 정해요. 1월·2월 초 생일은 앞해의 띠일 수 있어요.',
    '오행 개수는 확인된 천간·지지의 대표 오행만 센 단순 집계예요. 개수만으로 성격이나 강약을 정하지 않아요.'];
  if (!saju.timeKnown) notes.push('태어난 시간을 모르면 시주를 비워 두고 나머지 글자만 세요.');
  return deepFreeze({
    birthDate, birthTime: saju.birthTime, timeKnown: saju.timeKnown,
    animal, animalNote: animal ? '입춘을 새해 경계로 정한 띠예요.'
      : '입춘 당일에 태어나 띠를 정하지 못했어요. 태어난 시간을 알면 띠를 정할 수 있어요.',
    dayMaster: { hanja: shape.stem.hanja, hangul: shape.stem.hangul, element: shape.stem.element, name: shape.stem.name,
      image: shape.stem.image, label: `${shape.stem.name} · ${shape.stem.image}`, trait: TRAITS[shape.stem.hangul] },
    zodiac: { signId: sign.signId, label: sign.label, english: sign.english, range: sign.range, element: { ...signElement(sign.signId) },
      isBoundaryDay: sign.isBoundaryDay, nearBoundary: sign.nearBoundary, note: sign.note },
    elements: saju.elements.map(item => ({ id: item.id, label: item.label, hanja: item.hanja, count: item.count })),
    elementSummary: summary.text, dominantElements: summary.dominant, missingElements: summary.missing, countedCharacters: summary.total,
    notes,
  });
}
