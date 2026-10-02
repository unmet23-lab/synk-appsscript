// 지금 앱의 맞춤 학습 화면(SYNK-talk src/맞춤학습화면.js)을 그대로 웹에서 그린다.
// 화면 컴포넌트 `맞춤학습내용`만 쓰고, 기록 저장·추천 엔진은 고정 데이터로 바꾼다(build.mjs의 대체 모듈).
// 상태는 주소의 #start / #question / #answered 로 고른다.
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { 맞춤학습내용 } from 'APP/src/맞춤학습화면.js';
import item from '../문항_c09q4.json';

const plan = { selected: { label: item.label } };
const states = {
  start: { snapshot: { current: null, storage: { persistent: true } }, plan },
  question: { snapshot: { current: { item, plan, helped: false, result: null }, storage: { persistent: true } }, plan },
  answered: { snapshot: { current: { item, plan, helped: false, result: { optionId: item.answerId, correct: true } }, storage: { persistent: true } }, plan },
};
const name = (location.hash || '#start').slice(1);
const view = states[name] || states.start;
const noop = () => {};
createRoot(document.getElementById('root')).render(
  <View style={{ flex: 1, minHeight: '100%' }}>
    <맞춤학습내용 {...view} error={null} onStart={noop} onExplain={noop} onAnswer={noop} 돌아가기={noop} />
  </View>,
);
