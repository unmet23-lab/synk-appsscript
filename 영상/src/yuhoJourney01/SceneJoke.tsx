import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Felt, Page, Title, appear, progress, rise} from './shared';
import {theme} from './theme';
import {SceneProps} from './types';

export const SceneJoke: React.FC<SceneProps> = ({scene}) => {
  const f = useCurrentFrame();
  const reveal = Math.max(38, Math.round(scene.duration * .4));
  const p = progress(f, reveal, reveal + 28);
  return <Page dark chapter="예상 못 한 변화">
    <Title top={348} size={108}>{'심심함은\n해결됐어요.'}</Title>
    <div style={{position: 'absolute', left: 89, top: 727, width: 190, height: 7, background: theme.paper, scale: `${progress(f, 16, 47)} 1`, transformOrigin: 'left center'}}/>
    <div style={{position: 'absolute', left: 88, top: 845, width: 846, height: 347, borderRadius: 33, overflow: 'hidden', opacity: appear(f, reveal), translate: `0 ${rise(f, reveal, 20)}px`}}><Felt dark/><div style={{position: 'absolute', left: 40, top: 43, fontSize: 63, lineHeight: 1.3, fontWeight: 700}}>출석 앱은<br/>계속 만드는 중.</div><div style={{position: 'absolute', left: 43, bottom: 40, display: 'flex', gap: 12, opacity: p}}>{[0, 1, 2].map(i => <div key={i} style={{width: 10, height: 10, borderRadius: '50%', background: theme.paper, opacity: Math.floor(f / 22) % 3 === i ? .95 : .3}}/>)}</div></div>
  </Page>;
};
