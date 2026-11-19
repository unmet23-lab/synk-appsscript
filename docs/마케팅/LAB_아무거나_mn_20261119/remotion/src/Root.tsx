import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, TOTAL_FRAMES } from './film/Film';
import { FilmGreet, greetFrames } from './film/Greeting';
import { 판본들 } from './film/판본';

// 11-19 LAB 몽골 M64 「아무거나~」 — 우리편 M37 「피곤할 때 네 마디」(검증된 틀 ③) 1:1(기획.md 「원본 1:1」) · 몽골 13:00 칸.
// 판본 틀(처음부터): film/판본/<KEY>.json마다 m64-<KEY> 하나(글이 다 찬 판본만). 몽골 기준 판은 MN이다.
// 「한 장면 먼저」 판은 m64-MN을 --frames로 끝 장면(22.4~28.6초)만 렌더해 만든다(장면/장면_v<n>.mp4, git 밖).
// 나라 인사 카드(11-12): 판본 글의 인사 칸(hello)이 찬 판본은 머리 글 앞에 인사 장면(film/Greeting.tsx)이 붙고 그만큼 길다. 빈 판본은 원본 그대로.
// 렌더는 편 폴더의 판본렌더.mjs <KEY…|전부> → 게시/판본/<KEY>/video.mp4 · cover.png
export const RemotionRoot: React.FC = () => (
  <>
    {판본들.map(({ key, pack }) =>
      pack.hello ? (
        <Composition key={key} id={`m64-${key}`} component={FilmGreet} defaultProps={{ p: pack, k: key }} durationInFrames={TOTAL_FRAMES + greetFrames(pack)} fps={FPS} width={1080} height={1920} />
      ) : (
        <Composition key={key} id={`m64-${key}`} component={Film} defaultProps={{ p: pack }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
      ),
    )}
  </>
);
