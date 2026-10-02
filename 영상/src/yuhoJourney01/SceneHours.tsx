import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Page, Sub, Title, progress} from './shared';
import {theme} from './theme';
import {SceneProps} from './types';

export const SceneHours: React.FC<SceneProps> = ({scene}) => {
  const f = useCurrentFrame();
  const p = progress(f, 25, Math.min(scene.duration - 30, 150));
  return <Page dark chapter="어느새 하루의 대부분" tag="하루 17~18시간 붙잡았던 것 같다는 회고">
    <Title size={90}>{'돌이켜 보면,\n하루에…'}</Title>
    <svg width="730" height="610" viewBox="0 0 730 610" style={{position: 'absolute', left: 151, top: 650}}><circle cx="365" cy="305" r="251" fill="none" stroke={theme.light(.13)} strokeWidth="3"/>{Array.from({length: 24}, (_, i) => {const a = i / 24 * Math.PI * 2 - Math.PI / 2; return <line key={i} x1={365 + Math.cos(a) * 238} y1={305 + Math.sin(a) * 238} x2={365 + Math.cos(a) * 252} y2={305 + Math.sin(a) * 252} stroke={theme.light(.27)} strokeWidth="3"/>;})}<circle cx="365" cy="305" r="251" fill="none" stroke={theme.paper} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${p * 1182} 1578`} transform="rotate(-90 365 305)"/></svg>
    <div style={{position: 'absolute', top: 827, left: 174, width: 682, textAlign: 'center', fontSize: 132, fontWeight: 700, letterSpacing: '-.06em'}}>17~18<span style={{fontSize: 51, marginLeft: 10}}>시간</span></div>
    <div style={{position: 'absolute', top: 1000, left: 234, width: 562, textAlign: 'center', fontSize: 40, color: theme.light(.7)}}>붙잡고 있었던 것 같아요.</div>
    <Sub top={1214} size={42}>수업 시간을 빼고도.</Sub>
  </Page>;
};
