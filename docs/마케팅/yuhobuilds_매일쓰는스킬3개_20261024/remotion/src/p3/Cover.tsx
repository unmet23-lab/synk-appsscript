// 표지: 영상 정지컷 대신 따로 짠 한 장(S22 표지 규칙). 작은 줄은 문제(첫 말 그대로), 큰 제목은 약속(버터 한 곳), 아래는 폴더에서 나온 파일 셋.
// 프로필 3:4 격자에서 잘리지 않게 제목과 카드를 가운데 세로 1440px 안에 둔다.
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { INK, STAGE } from '../film/parts';
import { KO } from '../lib/fonts';
import { FolderStill } from './Film';

export const Cover: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE }}>
    <FolderStill />
    <div style={{ position: 'absolute', left: 72, top: 236, fontFamily: KO, fontWeight: 650, fontSize: 36, color: '#A9A69E', letterSpacing: '-0.02em' }}>
      클로드가 다 했다는데 <span style={{ color: INK }}>틀려 있던 적 있죠?</span>
    </div>
    <div style={{ position: 'absolute', left: 72, top: 1400, fontFamily: KO, fontWeight: 700, fontSize: 40, color: INK, letterSpacing: '-0.02em' }}>
      다른눈 · 실수노트 · 인계
    </div>
  </AbsoluteFill>
);
