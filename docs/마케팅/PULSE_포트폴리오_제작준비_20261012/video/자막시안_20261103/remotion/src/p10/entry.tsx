// 10번 도담중공업 전용 진입(2026-11-08, Claude) — s1/entry.tsx와 같은 까닭으로(공용 Root.tsx에 함께 등록된 남의 판이 만드는 중 오류를 내도
// 묶기가 멈추지 않게) p10만 등록해 따로 묶는다. b2b-factory-20261026/최종편집.py render()가 이 파일로 굽는다. 공용 Root.tsx에는 넣지 않았다.
import '../lib/fonts';
import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { P10, P10_FRAMES } from './P10';

const P10Root: React.FC = () => (
  <Composition id="p10" component={P10} durationInFrames={P10_FRAMES} fps={24} width={1920} height={1080} />
);

registerRoot(P10Root);
