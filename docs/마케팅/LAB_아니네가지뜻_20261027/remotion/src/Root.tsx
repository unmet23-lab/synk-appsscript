import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './film/Film';
import { FPS, TOTAL_FRAMES } from './film/timeline';
import { Film2, TOTAL_FRAMES2 } from './film/Film2';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="ani-en" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 10-27 다시 살림(v6) — 「한 낱말 · 두 억양」 16초 A 장치형(기획.md 「다시 살림」) */}
    <Composition id="ani2-en" component={Film2} durationInFrames={TOTAL_FRAMES2} fps={FPS} width={1080} height={1920} />
  </>
);
