import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, TOTAL_FRAMES } from './film/Film';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 10-29 LAB 몽골 M11 — E9와 같은 오마주 뼈대(doci Ia6gYNDm-7o 9칸), 사장님 앞 판(기획.md 「원본 1:1」) */}
    <Composition id="sorry-mn" component={Film} defaultProps={{ loc: 'mn' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 두 채널 판 — 그림 · 한국어 목소리 · 한국어 줄은 그대로, 읽는 법 로마자 · 뜻 줄만 그 나라 말(LAB 장부 머리말 「두 채널 판」 2번) */}
    <Composition id="sorry-mn-zh" component={Film} defaultProps={{ loc: 'zh' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="sorry-mn-my" component={Film} defaultProps={{ loc: 'my' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
