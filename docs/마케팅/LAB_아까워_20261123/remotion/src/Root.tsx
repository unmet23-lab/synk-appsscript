import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { FPS } from './e62/data';
import { Scene, SCENE_FRAMES } from './e62/Scene';
import { Film, FILM_FRAMES } from './e62/Film';

// 11-23 LAB 영어 E62 「아까워」 — 원본 형식만 「외국 번역가들이 끝내 옮기지 못한 한국말」 꼴(기획.md 「원본 1:1」).
// 1단계: 핵심 장면(e62-scene — 제목 · 이름표 · 설명 없이 그림 · 말풍선 · 소리만, 장면 심사용). 2단계(15시 회차): 편 e62-en(21.8초).
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="e62-scene" component={Scene} durationInFrames={SCENE_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="e62-en" component={Film} durationInFrames={FILM_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
