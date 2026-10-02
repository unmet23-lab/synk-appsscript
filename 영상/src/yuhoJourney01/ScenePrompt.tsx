import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Felt, Glass, Page, Title, appear} from './shared';
import {theme} from './theme';
import {SceneProps} from './types';

export const ScenePrompt: React.FC<SceneProps> = ({scene}) => {
  const f = useCurrentFrame();
  const delays = [18, Math.min(scene.duration * .22, 65), Math.min(scene.duration * .45, 125)];
  const blocks = ['선생님이 학생의 출석을\n기록하는 걸 만들고 싶어.', '나는 개발을 처음 해.', '가장 작은 첫 단계부터\n설명해줘.'];
  return <Page chapter="오늘 해볼 첫 요청" tag="지금 해볼 요청 예시">
    <Title>{'첫 부탁은\n이렇게.'}</Title>
    <div style={{position: 'absolute', left: 70, top: 674, width: 884, height: 635, borderRadius: 40, overflow: 'hidden'}}><Felt/><Glass style={{left: 22, top: 22, width: 837, height: 584}}><div style={{padding: '44px 38px'}}>{blocks.map((text, i) => <div key={text} style={{fontSize: 49, lineHeight: 1.45, letterSpacing: '-.025em', fontWeight: i === 2 ? 700 : 500, color: i === 2 ? theme.deepBlue : theme.black, whiteSpace: 'pre-line', marginBottom: 33, opacity: appear(f, delays[i])}}>{text}</div>)}</div></Glass></div>
  </Page>;
};
