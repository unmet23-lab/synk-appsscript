import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, TOTAL_FRAMES } from './film/Film';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 10-31 LAB 몽골 M1 「화날 때 네 마디」 — 오마주 Yerok sxujuQNn7rY(기획.md 「원본 1:1」) */}
    <Composition id="angry-mn" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
