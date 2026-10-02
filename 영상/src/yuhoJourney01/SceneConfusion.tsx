import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {BrowserFrame, Cursor, Page, Sub, Title, appear, clamp, rise} from './shared';
import {theme} from './theme';
import {SceneProps} from './types';

export const SceneConfusion: React.FC<SceneProps> = ({scene}) => {
  const f = useCurrentFrame();
  const novice = scene.id === '09' || /완전 초보|코딩도 전혀/.test(scene.text);
  const d = Math.max(90, scene.duration - 20);
  const x = interpolate(f, [0, d * .25, d * .45, d * .7, d], [680, 650, 337, 337, 696], clamp);
  const y = interpolate(f, [0, d * .25, d * .45, d * .7, d], [1190, 1040, 866, 866, 949], clamp);
  if (novice) return <Page dark chapter="말 그대로, 완전 초보">
    <Title>{'개발도, 코딩도\n처음이었어요.'}</Title>
    {['코딩?', 'Claude Code?', 'Codex?'].map((word, i) => <div key={word} style={{position: 'absolute', left: 100 + i * 77, top: 707 + i * 150, padding: '23px 31px', border: `1px solid ${theme.light(.28)}`, borderRadius: 20, fontSize: 58, fontWeight: 600, opacity: appear(f, 20 + i * 28), translate: `0 ${rise(f, 20 + i * 28, 24)}px`}}>{word}</div>)}
    <Sub top={1243} size={43}>무엇을 하는 도구인지부터 몰랐습니다.</Sub>
  </Page>;
  return <Page dark chapter="완전 초보의 시작" tag="설정에서 헤맨 경험 · 재구성">
    <Title>{'앱을 만들겠다며,\n설정에서 멈춤.'}</Title>
    <BrowserFrame dark label="처음 만난 설정 화면" style={{left: 88, top: 717, width: 848, height: 480}}><div style={{position: 'absolute', left: 37, top: 103, width: 168, fontSize: 33, lineHeight: 2.35, color: theme.light(.55)}}>연결<br/>설정<br/>저장</div><div style={{position: 'absolute', left: 245, right: 37, top: 117}}>{[.85, .55, .71].map((w, i) => <div key={i} style={{height: 42, marginBottom: 37, width: `${w * 100}%`, borderRadius: 10, background: theme.light(.12)}}/>)}</div><div style={{position: 'absolute', right: 40, bottom: 32, padding: '15px 25px', fontSize: 35, border: `1px solid ${theme.light(.4)}`, borderRadius: 12}}>다음</div></BrowserFrame>
    <Cursor x={x} y={y} dark/>
    <Sub top={1240} size={43}>어디를 눌러야 하지?</Sub>
  </Page>;
};
