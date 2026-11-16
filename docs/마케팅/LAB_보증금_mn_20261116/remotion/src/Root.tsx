import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, TOTAL_FRAMES } from './film/Film';
import { FilmGreet, greetFrames } from './film/Greeting';
import { 판본들 } from './film/판본';

// 11-16 LAB 몽골 M59 「1000/50이 뭐예요?」 — 원본 같은분야 「한국의 집 종류와 월세」(EPVYSt1WqBs · 80.5초)의 뼈대, 가게 앞 · 사무실 · 고시원 복도 세 장면(기획.md).
// 판본 틀: film/판본/<KEY>.json마다 bojeung-<KEY> 하나(글이 다 찬 판본만). 몽골 원본은 MN.
// 11-12 나라 인사 카드: 판본 글의 인사 칸(hello)이 찬 판본은 훅 앞에 인사 장면(film/Greeting.tsx)이 붙고 그만큼 길다. 빈 판본은 원본 그대로.
// 렌더는 편 폴더의 판본렌더.mjs <KEY…|전부> → 게시/판본/<KEY>/video.mp4 · cover.png
export const RemotionRoot: React.FC = () => (
  <>
    {판본들.map(({ key, pack }) =>
      pack.hello ? (
        <Composition key={key} id={`bojeung-${key}`} component={FilmGreet} defaultProps={{ L: pack, k: key }} durationInFrames={TOTAL_FRAMES + greetFrames(pack)} fps={FPS} width={1080} height={1920} />
      ) : (
        <Composition key={key} id={`bojeung-${key}`} component={Film} defaultProps={{ L: pack }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
      ),
    )}
    {/* 장면 심사용 — 핵심 장면을 글 없이(제작 절차 「한 장면 먼저」) — 렌더할 때 --frames로 자른다 */}
    {판본들.filter(({ key }) => key === 'MN').map(({ pack }) => (
      <Composition key="scene" id="bojeung-scene" component={Film} defaultProps={{ L: pack, bare: true }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    ))}
  </>
);
