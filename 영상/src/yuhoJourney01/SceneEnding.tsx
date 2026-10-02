import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Felt, Page, Title, appear, rise} from './shared';
import {theme} from './theme';
import {SceneProps} from './types';

export const SceneEnding: React.FC<SceneProps> = ({scene}) => {
  const f = useCurrentFrame();
  const reveal = Math.min(80, scene.duration * .28);
  return <Page dark chapter="다음 이야기로">
    <Title size={100}>{'번역에서,\n첫 앱 만들기로.'}</Title>
    <div style={{position: 'absolute', left: 88, top: 705, width: 848, height: 560, overflow: 'hidden', borderRadius: 36, opacity: appear(f, reveal), translate: `0 ${rise(f, reveal, 18)}px`}}><Felt dark/><div style={{position: 'absolute', left: 43, top: 43, fontSize: 29, letterSpacing: '.06em', opacity: .65}}>다음 이야기 · 02</div><div style={{position: 'absolute', left: 43, right: 35, top: 139, fontSize: 70, lineHeight: 1.23, letterSpacing: '-.035em', fontWeight: 700}}>도구를 켜고<br/>설정하는 데서부터<br/>헤맸습니다.</div><div style={{position: 'absolute', left: 43, bottom: 43, fontSize: 37, color: theme.light(.7)}}>막혔던 곳부터, 하나씩 같이.</div></div>
  </Page>;
};
