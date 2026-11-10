import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, TOTAL_FRAMES } from './film/Film';
import { 판본들 } from './film/판본';

// 10-31 LAB 몽골 M1 「화날 때 네 마디」 — 오마주 Yerok sxujuQNn7rY(기획.md 「원본 1:1」).
// 11-10 판본 틀: film/판본/<KEY>.json마다 angry-<KEY> 하나(글이 다 찬 판본만). 옛 angry-mn · -zhs · -my · -en은 MN · CN · MM · EN이다.
// 렌더는 편 폴더의 판본렌더.mjs <KEY…|전부> → 게시/판본/<KEY>/video.mp4 · cover.png
export const RemotionRoot: React.FC = () => (
  <>
    {판본들.map(({ key, pack }) => (
      <Composition key={key} id={`angry-${key}`} component={Film} defaultProps={{ L: pack }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    ))}
  </>
);
