import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, SceneBare, TOTAL_FRAMES } from './film/Film';
import { FilmGreet, greetFrames } from './film/Greeting';
import { fr, SCENE } from './film/data';
import { 판본들 } from './film/판본';

// 11-25 LAB 몽골 M76 「놀랐을 때 네 마디」 — 편 전체를 영상으로 · 몽골 21:00 칸.
// 판본 틀(처음부터): film/판본/<KEY>.json마다 m76-<KEY> 하나(글이 다 찬 판본만). 몽골 기준 판은 MN이다.
// m76-scene은 장면 심사용(글 없이 핵심 장면 h5와 소리만 — 제작 절차 「한 장면 먼저」).
// 나라 인사 카드(11-12): 판본 글의 인사 칸(hello)이 찬 판본은 머리 글 앞에 인사 장면(film/Greeting.tsx)이 붙고 그만큼 길다. 빈 판본은 원본 그대로.
export const RemotionRoot: React.FC = () => (
  <>
    {판본들.map(({ key, pack }) =>
      pack.hello ? (
        <Composition key={key} id={`m76-${key}`} component={FilmGreet} defaultProps={{ p: pack, k: key }} durationInFrames={TOTAL_FRAMES + greetFrames(pack)} fps={FPS} width={1080} height={1920} />
      ) : (
        <Composition key={key} id={`m76-${key}`} component={Film} defaultProps={{ p: pack }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
      ),
    )}
    <Composition id="m76-scene" component={SceneBare} durationInFrames={fr(SCENE.to - SCENE.from)} fps={FPS} width={1080} height={1920} />
  </>
);
