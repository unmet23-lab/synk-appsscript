// 키즈판 진행 별(두꺼운 남색 외곽선의 만화 별). 그림 개그·뜻 그림은 이 편을 위해 구운 펠트 그림을 쓴다(art.ts).
import React from 'react';
import { interpolate } from 'remotion';
import { K } from './theme';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 별(채움 정도 0~1). */
export const Star: React.FC<{ size: number; fill?: number; color?: string }> = ({ size, fill = 1, color = K.butter }) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 48 : 21;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${50 + r * Math.cos(a)},${52 + r * Math.sin(a)}`;
  }).join(' ');
  const f = interpolate(fill, [0, 1], [0, 1], clamp);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: 'visible' }}>
      <polygon points={pts} fill={f > 0.5 ? color : K.white} stroke={K.navy} strokeWidth={7} strokeLinejoin="round" />
    </svg>
  );
};
