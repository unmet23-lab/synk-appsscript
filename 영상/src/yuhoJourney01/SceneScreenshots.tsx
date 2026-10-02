import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Arrow, BrowserFrame, Glass, Page, Title, appear, progress} from './shared';
import {theme} from './theme';
import {SceneProps} from './types';

export const SceneScreenshots: React.FC<SceneProps> = ({scene}) => {
  const f = useCurrentFrame();
  const capture = progress(f, 30, 67);
  const ask = progress(f, Math.min(scene.duration * .35, 80), Math.min(scene.duration * .7, 155));
  return <Page chapter="제가 할 수 있던 방법" tag="회고를 바탕으로 재구성">
    <Title>{'찍고, 물어보고,\n따라 해보고.'}</Title>
    <BrowserFrame label="지금 막힌 화면" style={{left: 88, top: 720, width: 615, height: 324}}>{[0, 1, 2].map(i => <div key={i} style={{height: 24, width: 370 - i * 55, margin: '25px 35px', borderRadius: 6, background: theme.shadow(.12)}}/>)}</BrowserFrame>
    <div style={{position: 'absolute', left: 123, top: 810, width: 498, height: 175, border: `4px solid ${theme.blue}`, borderRadius: 12, opacity: capture * (1 - ask), boxSizing: 'border-box'}}/>
    <Glass style={{left: 374, top: 930, width: 560, height: 301, opacity: ask, translate: `${(1 - ask) * -94}px ${(1 - ask) * -80}px`}}><div style={{padding: '31px 32px', fontSize: 29, opacity: .55}}>지금 화면을 첨부하고</div><div style={{padding: '8px 32px', fontSize: 49, fontWeight: 700, lineHeight: 1.4}}>다음에는<br/>어떻게 해?</div></Glass>
    <Arrow x={740} y={817} length={113} vertical value={appear(f, 67)}/>
  </Page>;
};
