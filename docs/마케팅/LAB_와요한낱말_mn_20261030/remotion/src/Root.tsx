import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './wayo/Film';
import { FilmGreet, greetFrames } from './wayo/Greeting';
import { FPS, TOTAL_FRAMES } from './wayo/timeline';
import { 판본들 } from './wayo/판본';

// LAB 몽골 M18 「와요 한 낱말」. 11-18 판본 틀: wayo/판본/<KEY>.json마다 wayo-<KEY> 하나(글이 다 찬 판본만). 옛 wayo-mn은 wayo-MN이다.
// 나라 인사 카드(11-12): 판본 글의 인사 칸(hello)이 찬 판본은 첫 장면 앞에 인사 장면(wayo/Greeting.tsx)이 붙고 그만큼 길다. 빈 판본은 원본 그대로.
// 렌더는 편 폴더의 판본렌더.mjs <KEY…|전부> → 게시/판본/<KEY>/video.mp4 · cover.png
export const RemotionRoot: React.FC = () => (
  <>
    {판본들.map(({ key, pack }) =>
      pack.hello ? (
        <Composition key={key} id={`wayo-${key}`} component={FilmGreet} defaultProps={{ p: pack, k: key }} durationInFrames={TOTAL_FRAMES + greetFrames(pack)} fps={FPS} width={1080} height={1920} />
      ) : (
        <Composition key={key} id={`wayo-${key}`} component={Film} defaultProps={{ p: pack }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
      ),
    )}
  </>
);
