import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {BrowserFrame, Page, Sub, Title, appear, clamp, progress} from './shared';
import {theme} from './theme';
import {SceneProps} from './types';

export const SceneLoop: React.FC<SceneProps> = ({scene}) => {
  const f = useCurrentFrame();
  const span = Math.max(80, scene.duration / 3);
  const cycle = Math.min(2, Math.floor(f / span));
  const local = f - cycle * span;
  const p = progress(local, 22, 65);
  return <Page dark chapter="그다음에도, 다음 화면" tag="회고를 바탕으로 재구성">
    <Title>{'다음 화면이 나오면…\n또 찍어요.'}</Title>
    {[0, 1, 2].map(i => <div key={i} style={{position: 'absolute', left: 138 + i * 23, top: 747 - i * 21, width: 748, height: 405, border: `1px solid ${theme.light(.16)}`, background: theme.black, borderRadius: 24, opacity: i <= cycle ? 1 : 0}}/>)}
    <BrowserFrame dark label="다음 작업 화면" style={{left: 108, top: 761, width: 752, height: 406, translate: `0 ${interpolate(local, [0, 22], [24, 0], clamp)}px`, opacity: appear(local)}}><div style={{padding: '65px 44px', fontSize: 58, lineHeight: 1.4, fontWeight: 700}}>{['이것만 하면…', '이제 다음으로.', '그다음은?'][cycle]}</div><div style={{position: 'absolute', right: 38, bottom: 30, fontSize: 30, opacity: .6}}>스크린샷 → 질문</div></BrowserFrame>
    <div style={{position: 'absolute', left: 108, top: 761, width: 752, height: 406, borderRadius: 24, background: theme.paper, opacity: (p > .2 && p < .4) ? .1 : 0}}/>
    <Sub top={1240} size={44}>한 장, 또 한 장. 한 단계씩.</Sub>
  </Page>;
};
