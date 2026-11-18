import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, TOTAL_FRAMES } from './film/Film';
import { FilmGreet, greetFrames } from './film/Greeting';
import { 판본들 } from './film/판본';

// 11-09 LAB 몽골 M32 「수고하세요 ↔ 안녕히 계세요」 — 오마주 Rosetta Stone before & after(기획.md 「원본 1:1」) · 몽골 11-13 21:00 칸.
// 11-18 판본 틀: film/판본/<KEY>.json마다 m32-<KEY> 하나(글이 다 찬 판본만). 옛 m32-mn은 MN, 두 채널 판(11-10) m32-cn은 CN, m32-mm은 MM이다.
// 나라 인사 카드(11-12): 판본 글의 인사 칸(hello)이 찬 판본은 훅 앞에 인사 장면(film/Greeting.tsx)이 붙고 그만큼 길다. 빈 판본은 원본 그대로.
// 렌더는 편 폴더의 판본렌더.mjs <KEY…|전부> → 게시/판본/<KEY>/video.mp4 · cover.png
export const RemotionRoot: React.FC = () => (
  <>
    {판본들.map(({ key, pack }) =>
      pack.hello ? (
        <Composition key={key} id={`m32-${key}`} component={FilmGreet} defaultProps={{ p: pack, k: key }} durationInFrames={TOTAL_FRAMES + greetFrames(pack)} fps={FPS} width={1080} height={1920} />
      ) : (
        <Composition key={key} id={`m32-${key}`} component={Film} defaultProps={{ p: pack }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
      ),
    )}
  </>
);
