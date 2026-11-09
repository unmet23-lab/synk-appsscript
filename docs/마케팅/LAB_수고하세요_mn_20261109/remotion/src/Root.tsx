import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, SCENE, SceneFilm, TOTAL_FRAMES } from './film/Film';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 11-09 LAB 몽골 M32 「수고하세요 ↔ 안녕히 계세요」 — 오마주 Rosetta Stone before & after(기획.md 「원본 1:1」) · 몽골 11-13 21:00 칸 */}
    <Composition id="m32-mn" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 한 장면 먼저 — 인사 → 번지는 서리 → 얼어붙은 교수님 */}
    <Composition id="m32-scene" component={SceneFilm} durationInFrames={Math.round(SCENE.to * FPS)} fps={FPS} width={1080} height={1920} />
  </>
);
