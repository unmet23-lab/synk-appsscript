import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {Arrow, clamp, Felt, Page, Title, appear, ease} from './shared';
import {theme} from './theme';
import {SceneProps} from './types';

export const SceneHook: React.FC<SceneProps> = ({scene}) => {
  const f = useCurrentFrame();
  const turn = interpolate(f, [30, Math.min(scene.duration - 20, 112)], [0, 1], {...clamp, easing: ease});
  return <Page dark chapter="번역에서 첫 앱으로">
    <Title>{'번역하려고\n결제했는데.'}</Title>
    <div style={{position: 'absolute', left: 108, top: 700, width: 342, height: 412, borderRadius: 36, overflow: 'hidden', color: theme.black, rotate: `${-5 + turn * 5}deg`}}>
      <Felt/><div style={{position: 'absolute', inset: 40, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}><span style={{fontSize: 108, fontWeight: 800}}>가</span><span style={{fontSize: 48, fontWeight: 700}}>번역</span><span style={{fontSize: 28, opacity: .5, marginTop: 15}}>처음 필요했던 것</span></div>
    </div>
    <Arrow x={475} y={880} length={95} dark value={appear(f, 48)}/>
    <div style={{position: 'absolute', left: 616, top: 710, width: 274, height: 406, borderRadius: 38, border: `3px solid ${theme.light(.8)}`, padding: '35px 25px', boxSizing: 'border-box', opacity: turn, translate: `${(1 - turn) * 50}px 0`}}><div style={{fontSize: 38, fontWeight: 700, marginBottom: 32}}>출석 앱</div>{['학생', '출석', '알림'].map((t, i) => <div key={t} style={{padding: '18px 0', fontSize: 32, borderTop: `1px solid ${theme.light(.3)}`, opacity: appear(f, 76 + i * 14)}}>{t}</div>)}</div>
    <div style={{position: 'absolute', left: 88, right: 114, top: 1270, fontSize: 28, opacity: .63}}>실제 경험을 바탕으로 일부 대사와 장면을 재구성했습니다.</div>
  </Page>;
};
