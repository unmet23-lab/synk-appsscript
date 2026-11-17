// 10번 도담중공업 영어 판 전용 진입(2026-11-17, Claude) — p10/entry.tsx와 같은 까닭으로 p10en만 등록해 따로 묶는다.
//   PULSE_영어시험_20261117/01_도담중공업_영어/영어판.py가 이 파일로 굽는다. 공용 Root.tsx에는 넣지 않았다.
import '../lib/fonts';
import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { P10en, P10EN_FRAMES } from './P10en';

const P10enRoot: React.FC = () => (
  <Composition id="p10en" component={P10en} durationInFrames={P10EN_FRAMES} fps={24} width={1920} height={1080} />
);

registerRoot(P10enRoot);
