import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './m39/Film';
import { FilmGreet, greetFrames } from './m39/Greeting';
import { FPS, TOTAL_FRAMES } from './m39/timeline';
import { 판본들 } from './m39/판본';

// LAB 몽골 M39 「내립시다」 — 같은 이야기의 영어판 E36(LAB_내립시다_20261113)의 장면 · 그림 · 목소리 · 박자를 그대로 쓰고 화면 글만 몽골어 판으로 바꿨다.
// 11-24 판본 틀: m39/판본/<KEY>.json마다 m39-<KEY> 하나(글이 다 찬 판본만). 옛 m39-mn은 MN이다.
// 나라 인사 카드(11-12): 판본 글의 인사 칸(hello)이 찬 판본은 머리 글 앞에 인사 장면(m39/Greeting.tsx)이 붙고 그만큼 길다. 빈 판본은 원본 그대로.
// 렌더는 편 폴더의 판본렌더.mjs <KEY…|전부> → 게시/판본/<KEY>/video.mp4 · cover.png
// 장면 심사(m39-scene)는 화면 글 없이 장면의 말 · 소리만(몽골판 글로 등록) — E36과 같은 장면이다.
export const RemotionRoot: React.FC = () => (
  <>
    {판본들.map(({ key, pack }) =>
      pack.hello ? (
        <Composition key={key} id={`m39-${key}`} component={FilmGreet} defaultProps={{ p: pack, k: key }} durationInFrames={TOTAL_FRAMES + greetFrames(pack)} fps={FPS} width={1080} height={1920} />
      ) : (
        <Composition key={key} id={`m39-${key}`} component={Film} defaultProps={{ p: pack }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
      ),
    )}
    {판본들.filter(({ key }) => key === 'MN').map(({ pack }) => (
      <Composition key="scene" id="m39-scene" component={Film} defaultProps={{ p: pack, scene: true }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    ))}
  </>
);
