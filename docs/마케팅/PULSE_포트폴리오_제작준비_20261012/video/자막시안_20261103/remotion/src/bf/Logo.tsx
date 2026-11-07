// 블프 두 편 끝 로고 — 글꼴로 치지 않고 도형으로 그린 워드마크(../../../../블프_워드마크.py가 로고.json을 쓴다, 점검표 22번).
import React from 'react';
import logos from './로고.json';

type Name = keyof typeof logos;

// width 픽셀 폭으로 그린다. glow는 빛나는 간판 · 화면 글자처럼 번지는 빛(0이면 없음)
export const Logo: React.FC<{ name: Name; width: number; color: string; glow?: number; glowColor?: string; style?: React.CSSProperties }> = ({ name, width, color, glow = 0, glowColor, style }) => {
  const L = logos[name];
  const h = (width * L.h) / L.w;
  const shadow = glow > 0 ? `drop-shadow(0 0 ${glow}px ${glowColor ?? color}) drop-shadow(0 0 ${glow * 2.6}px ${glowColor ?? color})` : undefined;
  return (
    <svg width={width} height={h} viewBox={`0 0 ${L.w} ${L.h}`} style={{ display: 'block', overflow: 'visible', filter: shadow, ...style }}>
      <path d={L.d} fill={color} fillRule="evenodd" />
    </svg>
  );
};
export const logoHeight = (name: Name, width: number) => (width * logos[name].h) / logos[name].w;
