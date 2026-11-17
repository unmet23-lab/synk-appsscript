import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './m33/Film';
import { FilmGreet, greetFrames } from './m33/Greeting';
import { FPS, TOTAL_FRAMES } from './m33/timeline';
import { 판본들 } from './m33/판본';

// LAB 몽골 M33 「이 잔 주세요」. 11-18 판본 틀: m33/판본/<KEY>.json마다 m33-<KEY> 하나(글이 다 찬 판본만). 옛 m33은 MN이다.
// 옛 m33-scene(0~6.6초 장면 심사판 — 11-08 기획 때만 씀)은 등록하지 않는다. Film의 scene 갈림은 그대로 남겨 두었다.
// 나라 인사 카드(11-12): 판본 글의 인사 칸(hello)이 찬 판본은 훅 앞에 인사 장면(m33/Greeting.tsx)이 붙고 그만큼 길다. 빈 판본은 원본 그대로.
// 렌더는 편 폴더의 판본렌더.mjs <KEY…|전부> → 게시/판본/<KEY>/video.mp4 · cover.png
export const RemotionRoot: React.FC = () => (
  <>
    {판본들.map(({ key, pack }) =>
      pack.hello ? (
        <Composition key={key} id={`m33-${key}`} component={FilmGreet} defaultProps={{ p: pack, k: key }} durationInFrames={TOTAL_FRAMES + greetFrames(pack)} fps={FPS} width={1080} height={1920} />
      ) : (
        <Composition key={key} id={`m33-${key}`} component={Film} defaultProps={{ p: pack }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
      ),
    )}
  </>
);
