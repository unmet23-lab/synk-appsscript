import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Arrow, Glass, Page, Sub, Title, appear, progress} from './shared';
import {theme} from './theme';
import {SceneProps} from './types';

export const SceneTools: React.FC<SceneProps> = () => {
  const f = useCurrentFrame();
  const p = progress(f, 55, 125);
  return <Page chapter="첫 도구들" tag="도구의 관계를 설명한 재구성">
    <Title>{'Glide +\nGoogle Sheets'}</Title>
    <Sub top={550} size={45}>화면과 기록을 연결하는 첫 시도</Sub>
    <Glass style={{left: 88, top: 761, width: 362, height: 346, opacity: appear(f, 15)}}><div style={{padding: '37px 27px', fontSize: 41, fontWeight: 700}}>앱 화면</div>{['출석하기', '오늘의 기록'].map((s, i) => <div key={s} style={{margin: '12px 27px', padding: '20px 15px', fontSize: 33, background: i ? theme.shadow(.035) : theme.blue, color: i ? theme.black : theme.paper, borderRadius: 15}}>{s}</div>)}</Glass>
    <Arrow x={474} y={914} length={94} value={appear(f, 35)}/>
    <div style={{position: 'absolute', left: 482 + p * 92, top: 924, width: 13, height: 13, borderRadius: '50%', background: theme.blue, opacity: f > 55 && f < 125 ? 1 : 0}}/>
    <Glass style={{left: 621, top: 761, width: 315, height: 346, opacity: appear(f, 45)}}><div style={{padding: '37px 27px', fontSize: 41, fontWeight: 700}}>기록 저장</div>{[0, 1, 2].map(i => <div key={i} style={{height: 46, margin: '0 27px', borderTop: `1px solid ${theme.shadow(.16)}`, display: 'grid', gridTemplateColumns: '1fr 1fr'}}><div style={{borderRight: `1px solid ${theme.shadow(.16)}`}}/></div>)}</Glass>
    <Sub top={1170} size={43}>클로드에게 물어보면서.</Sub>
  </Page>;
};
