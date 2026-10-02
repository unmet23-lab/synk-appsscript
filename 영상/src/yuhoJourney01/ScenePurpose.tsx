import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Arrow, Glass, Page, Person, Title, appear} from './shared';
import {SceneProps} from './types';

export const ScenePurpose: React.FC<SceneProps> = ({scene}) => {
  const f = useCurrentFrame();
  const colleague = /선생|동료/.test(scene.text);
  return <Page chapter="만들고 싶었던 것" tag="그때 만들고 싶었던 모습">
    <Title>{colleague ? '함께 일하는\n선생님도 편하게.' : '출석 하나로\n연결되면 좋겠다.'}</Title>
    <Person x={88} y={700} label={colleague ? '선생님' : '학생'}/>
    <Arrow x={300} y={793} length={110} value={appear(f, 22)}/>
    <Glass style={{left: 449, top: 710, width: 445, height: 176, opacity: appear(f, 34)}}><div style={{padding: colleague ? '29px 28px' : '53px 28px', fontSize: 44, lineHeight: 1.32, fontWeight: 700, textAlign: 'center', whiteSpace: 'pre-line'}}>{colleague ? '관리하는 일은\n조금 더 편하게' : '도착 · 귀가를 기록'}</div></Glass>
    <Arrow x={641} y={944} vertical length={107} value={appear(f, 66)}/>
    <Glass style={{left: 147, top: 1100, width: 746, height: 151, opacity: appear(f, 83)}}><div style={{padding: '43px 32px', fontSize: 45, fontWeight: 600, textAlign: 'center'}}>{colleague ? '학생을 챙길 수 있도록' : '부모님께 알림이 가면 좋겠다'}</div></Glass>
  </Page>;
};
