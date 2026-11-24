import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, TOTAL_FRAMES } from './e50/Film';

// 11-24 LAB 영어 E50 「눈 = eye · snow」 — 원본 xa5CKrQkOk4 1:1(기획.md 「원본 1:1」) · @synklabusa 11-29 21:00(뉴욕).
// 「한 장면 먼저」 판은 e50을 --frames로 9.3~12.0초만 렌더해 만든다(장면/장면_v<n>.mp4, git 밖).
export const RemotionRoot: React.FC = () => (
  <Composition id="e50" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
);
