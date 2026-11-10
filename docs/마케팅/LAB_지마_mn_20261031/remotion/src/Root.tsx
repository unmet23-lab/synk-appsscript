import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './m22/Film';
import { FPS, TOTAL_FRAMES } from './m22/timeline';
import { 판본들 } from './m22/판본';

// LAB 몽골 M22 「-지 마」. 11-10 판본 틀: m22/판본/<KEY>.json마다 m22-<KEY> 하나(글이 다 찬 판본만). 옛 m22는 MN이다.
// 렌더는 편 폴더의 판본렌더.mjs <KEY…|전부> → 게시/판본/<KEY>/video.mp4 · cover.png
export const RemotionRoot: React.FC = () => (
  <>
    {판본들.map(({ key, pack }) => (
      <Composition key={key} id={`m22-${key}`} component={Film} defaultProps={{ L: pack }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    ))}
  </>
);
