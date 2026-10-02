import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Glass, Page, Sub, Title, appear, rise} from './shared';
import {theme} from './theme';
import {SceneProps} from './types';

export const SceneInquiries: React.FC<SceneProps> = ({scene}) => {
  const f = useCurrentFrame();
  const spacing = Math.min(43, Math.max(20, (scene.duration - 70) / 4));
  return <Page chapter="새로 생긴 걱정" tag="학생 문의가 늘던 때 · 회고 재구성">
    <Title>{'학생 문의가\n많아졌어요.'}</Title>
    {[0, 1, 2, 3].map(i => <Glass key={i} style={{left: 106 + i * 17, top: 720 + i * 98, width: 764, height: 144, opacity: appear(f, 20 + i * spacing), translate: `0 ${rise(f, 20 + i * spacing, 54)}px`, rotate: `${i % 2 ? 1.2 : -1.2}deg`}}><div style={{display: 'flex', alignItems: 'center', gap: 28, padding: '38px 34px'}}><div style={{width: 20, height: 20, borderRadius: '50%', background: theme.blue}}/><span style={{fontSize: 43, fontWeight: 600}}>학생 문의가 도착했습니다</span></div></Glass>)}
    <Sub top={575} size={43}>앞으로, 관리를 어떻게 하지?</Sub>
  </Page>;
};
