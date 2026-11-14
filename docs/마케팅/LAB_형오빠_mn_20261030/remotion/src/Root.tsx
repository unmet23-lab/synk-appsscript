import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './m19/Film';
import { FilmGreet, greetFrames } from './m19/Greeting';
import { FPS, TOTAL_FRAMES } from './m19/timeline';
import { 판본들 } from './m19/판본';

// LAB 몽골 M19 「ах = 형 · 오빠」. 11-13 판본 틀: m19/판본/<KEY>.json마다 m19-<KEY> 하나(글이 다 찬 판본만). 옛 m19는 MN, m19-zhs는 CN, m19-my는 MM이다.
// 나라 인사 카드(11-12): 판본 글의 인사 칸(hello)이 찬 판본은 훅 앞에 인사 장면(m19/Greeting.tsx)이 붙고 그만큼 길다. 빈 판본은 원본 그대로.
// 렌더는 편 폴더의 판본렌더.mjs <KEY…|전부> → 게시/판본/<KEY>/video.mp4 · cover.png
export const RemotionRoot: React.FC = () => (
  <>
    {판본들.map(({ key, pack }) =>
      pack.hello ? (
        <Composition key={key} id={`m19-${key}`} component={FilmGreet} defaultProps={{ p: pack, k: key }} durationInFrames={TOTAL_FRAMES + greetFrames(pack)} fps={FPS} width={1080} height={1920} />
      ) : (
        <Composition key={key} id={`m19-${key}`} component={Film} defaultProps={{ p: pack }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
      ),
    )}
  </>
);
