import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './m39/Film';
import { FPS, TOTAL_FRAMES } from './m39/timeline';

// LAB 몽골 M39 「내립시다」 — 같은 이야기의 영어판 E36(LAB_내립시다_20261113)의 장면 · 그림 · 목소리 · 박자를 그대로 쓰고 화면 글만 몽골어 판으로 바꿨다.
// 장면 심사(m39-scene)는 화면 글 없이 장면의 말 · 소리만 — E36과 같은 장면이다.
const Scene: React.FC = () => <Film scene />;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="m39-mn" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{}} />
    <Composition id="m39-scene" component={Scene} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
