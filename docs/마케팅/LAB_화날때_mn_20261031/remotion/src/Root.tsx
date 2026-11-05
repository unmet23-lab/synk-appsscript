import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, TOTAL_FRAMES } from './film/Film';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 10-31 LAB 몽골 M1 「화날 때 네 마디」 — 오마주 Yerok sxujuQNn7rY(기획.md 「원본 1:1」) */}
    <Composition id="angry-mn" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 11-02 두 채널 판 — 샤오훙수 간체 · 틱톡 버마어(같은 정본 · 같은 소리) */}
    <Composition id="angry-zhs" component={Film} defaultProps={{ loc: 'zhs' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="angry-my" component={Film} defaultProps={{ loc: 'my' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 11-05 영어판 — 유튜브 @synkkorean 동영상 언어 시험(같은 정본 · 같은 소리) */}
    <Composition id="angry-en" component={Film} defaultProps={{ loc: 'en' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
