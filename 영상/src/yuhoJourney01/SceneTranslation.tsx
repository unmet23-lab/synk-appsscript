import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Arrow, Glass, Page, Sub, Title, appear, rise} from './shared';
import {theme} from './theme';
import {SceneProps} from './types';

export const SceneTranslation: React.FC<SceneProps> = () => {
  const f = useCurrentFrame();
  return <Page chapter="필요할 때, 가끔" tag="가끔 번역에 쓰던 Claude">
    <Title>{'처음엔\n번역만 가끔.'}</Title>
    <Glass style={{left: 88, top: 720, width: 530, height: 232, opacity: appear(f, 16), translate: `0 ${rise(f, 16)}px`}}><div style={{padding: 36, fontSize: 47, lineHeight: 1.4, fontWeight: 600}}>번역이 필요한<br/>문장을 적고</div></Glass>
    <Arrow x={442} y={1004} vertical length={92} value={appear(f, 42)}/>
    <div style={{position: 'absolute', left: 316, top: 1112, fontSize: 51, fontWeight: 700, color: theme.deepBlue, opacity: appear(f, 70)}}>클로드에게 부탁하고.</div>
    <Sub top={570} size={42}>일상에서 필요할 때 꺼내 쓰던 도구</Sub>
  </Page>;
};
