import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, TOTAL_FRAMES } from './e44/Film';

// 11-15 LAB 영어 E44 「보고 싶어」 — 원본 같은분야 「Stop saying 'saRanghae'」(바로잡기) 뼈대(기획.md 「원본 1:1」).
// 영어 판(e44-en)과 두 채널 판(e44-zhs · e44-my — 글이 다 찬 판만 쓴다), 장면 심사용(e44-scene — 글 없이 그림과 소리만).
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="e44-en" component={Film} defaultProps={{ loc: 'en' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="e44-zhs" component={Film} defaultProps={{ loc: 'zhs' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="e44-my" component={Film} defaultProps={{ loc: 'my' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="e44-scene" component={Film} defaultProps={{ loc: 'en' as const, bare: true }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
