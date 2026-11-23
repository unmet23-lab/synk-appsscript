import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Scene, SCENE_FPS, SCENE_FRAMES } from './film/Scene';

// 11-23 LAB 몽골 M48 「더워 · 뜨거워」 — 우리편 원본 M29 「춥다 · 차갑다」(19.6초) 뼈대, 펠트 찜질방 휴게 바닥(기획.md 「원본 1:1」).
// 1단계: 핵심 장면만(제작 절차 「한 장면 먼저」 — 제목 · 이름표 · 설명 글 없이 그 장면 소리째). 편 전체(판본 틀)는 장면 심사를 넘은 뒤 2단계에 더한다.
// 렌더: remotion 폴더에서 npx remotion render src/index.ts deo-scene ../장면/장면_v<n>.mp4
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="deo-scene" component={Scene} durationInFrames={SCENE_FRAMES} fps={SCENE_FPS} width={1080} height={1920} />
  </>
);
