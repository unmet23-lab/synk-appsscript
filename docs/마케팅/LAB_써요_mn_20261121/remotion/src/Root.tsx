import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, TOTAL_FRAMES } from './film/Film';
import { FilmGreet, greetFrames } from './film/Greeting';
import { 판본들 } from './film/판본';

// 11-21 LAB 몽골 M69 「써요」 — 우리편 원본 M53 「먹어요」(21.3초) 뼈대, 작은 펠트 모자 가게 계산대 한 장면(기획.md 「원본 1:1」).
// 판본 틀: film/판본/<KEY>.json마다 sseo-<KEY> 하나(글이 다 찬 판본만). 몽골 원본은 MN.
// 렌더는 편 폴더의 판본렌더.mjs <KEY…|전부> → 게시/판본/<KEY>/video.mp4 · cover.png
export const RemotionRoot: React.FC = () => (
  <>
    {판본들.map(({ key, pack }) =>
      pack.hello ? (
        <Composition key={key} id={`sseo-${key}`} component={FilmGreet} defaultProps={{ L: pack, k: key }} durationInFrames={TOTAL_FRAMES + greetFrames(pack)} fps={FPS} width={1080} height={1920} />
      ) : (
        <Composition key={key} id={`sseo-${key}`} component={Film} defaultProps={{ L: pack }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
      ),
    )}
    {/* 장면 심사용 — 핵심 장면을 글 없이(제작 절차 「한 장면 먼저」) — 렌더할 때 --frames로 자른다 */}
    {판본들.filter(({ key }) => key === 'MN').map(({ pack }) => (
      <Composition key="scene" id="sseo-scene" component={Film} defaultProps={{ L: pack, bare: true }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    ))}
  </>
);
