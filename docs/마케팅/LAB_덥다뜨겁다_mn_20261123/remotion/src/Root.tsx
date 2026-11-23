import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Scene, SCENE_FPS, SCENE_FRAMES } from './film/Scene';
import { Film, FPS, LocPack, TOTAL_FRAMES } from './film/Film';
import MN from './film/판본/MN.json';

// 11-23 LAB 몽골 M48 「더워 · 뜨거워」 — 우리편 원본 M29 「춥다 · 차갑다」(19.6초) 뼈대, 펠트 찜질방 휴게 바닥(기획.md 「원본 1:1」).
// deo-scene: 핵심 장면만(제작 절차 「한 장면 먼저」 — 글 없이 그 장면 소리째, 장면 v1 · v2).
// m48-mn: 편 전체(몽골판). 몽골어 글은 film/판본/MN.json — 판본을 더할 때 같은 꼴의 <KEY>.json을 두고 여기서 등록한다.
// 렌더: remotion 폴더에서 npx remotion render m48-mn out/m48_v<n>.mp4
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="deo-scene" component={Scene} durationInFrames={SCENE_FRAMES} fps={SCENE_FPS} width={1080} height={1920} />
    <Composition id="m48-mn" component={Film} defaultProps={{ L: MN as unknown as LocPack }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
