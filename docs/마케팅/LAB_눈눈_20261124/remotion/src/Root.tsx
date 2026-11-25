import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, SCENE_FRAMES, SceneBare, TOTAL_FRAMES } from './e50/Film';

// 11-24 LAB 영어 E50 「눈 = eye · snow」 — 원본 xa5CKrQkOk4 1:1(기획.md 「원본 1:1」) · @synklabusa 11-29 21:00(뉴욕). 11-25부터 편 전체를 영상으로.
// e50-scene은 장면 심사용(글 없이 눈송이가 눈에 쏙 — 제작 절차 「한 장면 먼저」).
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="e50" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="e50-scene" component={SceneBare} durationInFrames={SCENE_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
