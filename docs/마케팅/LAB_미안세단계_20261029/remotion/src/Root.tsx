import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, TOTAL_FRAMES } from './film/Film';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 10-29 LAB E9 「미안 세 단계」 — 오마주 doci Ia6gYNDm-7o 9칸(기획.md 「원본 1:1」) */}
    <Composition id="sorry-en" component={Film} defaultProps={{ loc: 'en' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 두 채널 판 — 그림 · 한국어 목소리 · 한국어 줄은 그대로, 뜻 줄만 그 나라 말(LAB 장부 머리말 「두 채널 판」) */}
    <Composition id="sorry-zh" component={Film} defaultProps={{ loc: 'zh' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="sorry-my" component={Film} defaultProps={{ loc: 'my' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
