// 시즌 1 「옆집의 크리스마스」 전용 진입(2026-11-08, Claude) — 공용 Root.tsx에는 여러 세션의 판이 함께 등록돼 있어, 남의 판이 만드는 중에
// 묶기 오류를 내면 s1 렌더까지 멈췄다(11-08 01:5x rs60 「undefined is not iterable」). s1만 등록해 따로 묶는다 — 최종편집.py render()가 이 파일로 굽는다.
// Root.tsx의 s1 등록 줄은 그대로 둔다(스튜디오에서 다른 판과 함께 보는 몫).
import '../lib/fonts';
import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { S1, S1_FRAMES } from './S1';

const S1Root: React.FC = () => (
  <Composition id="s1" component={S1} durationInFrames={S1_FRAMES} fps={24} width={1920} height={1080} />
);

registerRoot(S1Root);
