import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, TOTAL_FRAMES } from './m60/Film';
import { FilmGreet, greetFrames } from './m60/Greeting';
import { 판본들 } from './m60/판본';

// 11-17 LAB 몽골 M60 「-어라 · 또 와라」 — 우리편 원본 M22 「-지 마」 뼈대(기획.md 「원본 1:1」).
// 11-26 판본 틀: m60/판본/<KEY>.json마다 m60-<KEY> 하나(글이 다 찬 판본만). 옛 m60-mn은 MN이다.
// 나라 인사 카드(11-12): 판본 글의 인사 칸(hello)이 찬 판본은 첫 말풍선 앞에 인사 장면(m60/Greeting.tsx)이 붙고 그만큼 길다. 빈 판본은 원본 그대로.
// 렌더는 편 폴더의 판본렌더.mjs <KEY…|전부> → 게시/판본/<KEY>/video.mp4 · cover.png
// 장면 심사용(m60-scene — 위 글 · 카드 없이 그림 · 말풍선 · 소리만, 몽골판 글로 등록).
export const RemotionRoot: React.FC = () => (
  <>
    {판본들.map(({ key, pack }) =>
      pack.hello ? (
        <Composition key={key} id={`m60-${key}`} component={FilmGreet} defaultProps={{ p: pack, k: key }} durationInFrames={TOTAL_FRAMES + greetFrames(pack)} fps={FPS} width={1080} height={1920} />
      ) : (
        <Composition key={key} id={`m60-${key}`} component={Film} defaultProps={{ p: pack }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
      ),
    )}
    {판본들.filter(({ key }) => key === 'MN').map(({ pack }) => (
      <Composition key="scene" id="m60-scene" component={Film} defaultProps={{ p: pack, bare: true }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    ))}
  </>
);
