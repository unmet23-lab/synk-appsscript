// Original reading checks. Building, moving and following pictures never call these.
export const READING_CHECKS = Object.freeze([
  { id: 'town-reading-place', skill: 'detail', passage: '오늘 쉼터는 찻집 안에 있습니다. 밖의 자리는 내일부터 이용할 수 있습니다.',
    question: '오늘은 어디에서 쉴 수 있나요?', choices: ['찻집 밖', '찻집 안', '내일부터만 쉴 수 있어요'], correct: 1,
    hint: '오늘 이용할 수 있는 곳을 찾아요.', explanation: '오늘 쉼터는 찻집 안에 있습니다.' },
  { id: 'town-reading-negation', skill: 'negation', passage: '차는 쉼터의 의자에 앉아서 마셔 주세요. 안내판 앞에서는 차를 마시지 마세요.',
    question: '차를 마시면 안 되는 곳은 어디인가요?', choices: ['쉼터의 의자', '찻집 안의 자리', '안내판 앞'], correct: 2,
    hint: '“마시지 마세요” 앞에 있는 장소를 찾아요.', explanation: '안내판 앞에서는 차를 마시지 말라고 했어요.' },
  { id: 'town-reading-sequence', skill: 'sequence', passage: '먼저 안내판의 그림을 확인하세요. 그다음 화살표를 따라 쉼터로 오세요. 자리에 앉은 뒤 차를 주문하세요.',
    question: '가장 먼저 해야 하는 일은 무엇인가요?', choices: ['안내판의 그림 확인하기', '차 주문하기', '쉼터의 의자에 앉기'], correct: 0,
    hint: '“먼저” 뒤의 일을 찾아요.', explanation: '안내판의 그림을 먼저 확인한 뒤 쉼터로 와요.' },
]);
export function readingMetadata(item) {
  return { id: item.id, itemKey: `synk-town.reading-check.${item.id}.v1`, familyKey: `synk-town.reading-check.${item.id}.v1`,
    skillId: `ko.reading.${item.skill}`, difficulty: 1, modality: 'reading', responseFormat: 'single-choice', audioRequired: false, confounded: false };
}
export function readingAnswer(item, selected) {
  if (!Number.isInteger(selected) || selected < 0 || selected >= item.choices.length) throw Error('답을 골라 주세요.');
  return { correct: selected === item.correct, assessable: true };
}
