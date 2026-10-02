import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Glass, Page, Sub, Title, appear, rise} from './shared';
import {theme} from './theme';
import {SceneProps} from './types';

export const SceneAction: React.FC<SceneProps> = ({scene}) => {
  const f = useCurrentFrame();
  const rows = ['누가', '무엇을 할 수 있으면 좋을지', '가장 작은 첫 단계'];
  return <Page chapter="내 일에서 하나 골라보기">
    <Title>{'반복되는 불편,\n하나만 떠올려요.'}</Title>
    {rows.map((s, i) => <Glass key={s} style={{left: 88, top: 718 + i * 176, width: 848, height: 137, opacity: appear(f, 20 + i * Math.min(50, scene.duration / 5)), translate: `0 ${rise(f, 20 + i * Math.min(50, scene.duration / 5), 22)}px`}}><div style={{padding: '38px 31px', fontSize: i === 1 ? 47 : 49, fontWeight: 600, color: i === 2 ? theme.deepBlue : theme.black}}>{s}</div></Glass>)}
    <Sub top={1265} size={41}>모르겠는 부분부터 다시 물어봐도 돼요.</Sub>
  </Page>;
};
