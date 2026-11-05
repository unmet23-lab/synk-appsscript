import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, SCENE_FROM, SceneFilm, TOTAL_FRAMES } from './film/Film';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 11-06 LAB 몽골 M31 「설렐 때 네 마디」 — 우리편 M1 「화날 때 네 마디」 1:1(기획.md 「원본 1:1」) */}
    <Composition id="m31-mn" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 한 장면 먼저 — 끝 장면(그 사람 앞 굳은 인사 → 문자 → 불꽃놀이)만 */}
    <Composition id="m31-scene" component={SceneFilm} durationInFrames={TOTAL_FRAMES - Math.round(SCENE_FROM * FPS)} fps={FPS} width={1080} height={1920} />
  </>
);
