import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, SCENE_FROM, SceneFilm, TOTAL_FRAMES } from './film/Film';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 11-09 LAB 몽골 M37 「피곤할 때 네 마디」 — 우리편 M1 「화날 때 네 마디」 1:1(기획.md 「원본 1:1」) · 몽골 13:00 칸 */}
    <Composition id="m37-mn" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 한 장면 먼저 — 끝 장면(1% → 문자 → 100% → 노래방)만 */}
    <Composition id="m37-scene" component={SceneFilm} durationInFrames={TOTAL_FRAMES - Math.round(SCENE_FROM * FPS)} fps={FPS} width={1080} height={1920} />
  </>
);
