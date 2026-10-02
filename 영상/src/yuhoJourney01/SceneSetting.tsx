import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {theme} from './theme';
import {Page, Person, Sub, Title, appear, clamp, ease} from './shared';
import {SceneProps} from './types';

export const SceneSetting: React.FC<SceneProps> = ({scene}) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [18, Math.min(scene.duration - 15, 100)], [0, 1], {...clamp, easing: ease});
  return <Page chapter="그때의 제 일상" tag="회고를 바탕으로 재구성">
    <Title>{'몽골, 울란바토르.\n학원 부원장.'}</Title>
    <Sub top={548} size={43}>스카이라인에듀에서 일하던 때</Sub>
    <svg width="868" height="400" viewBox="0 0 868 400" style={{position: 'absolute', left: 88, top: 735}}><path d="M0 365H868" stroke={theme.shadow(.35)} strokeWidth="2"/>{[{x: 26, w: 136, h: 146}, {x: 184, w: 210, h: 275}, {x: 420, w: 190, h: 218}, {x: 632, w: 198, h: 173}].map((b, i) => <g key={i} opacity={appear(f, 10 + i * 10)}><rect x={b.x} y={365 - b.h} width={b.w} height={b.h} rx={5} fill="none" stroke={theme.shadow(.2)} strokeWidth="3"/>{[0, 1, 2].map(j => <path key={j} d={`M${b.x + 25} ${405 - b.h + j * 43}h${b.w - 50}`} stroke={theme.shadow(.1)} strokeWidth="3"/>)}</g>)}</svg>
    <Person x={350} y={802} label="일하던 나" scale={.92 + .08 * p}/>
  </Page>;
};
