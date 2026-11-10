// 블프 두 편 끝 로고 — 글꼴로 치지 않고 도형으로 그린 워드마크(점검표 22번).
//   로고.json  — 11-07 판(../../../../블프_워드마크.py): 둥근 고른 획 느지막 · 굵은 기운 사각 획 힘껏. 11-10 55번 훑기에서 「글꼴로 친 글자 + 빛」으로 걸림.
//   로고2.json — 11-10 판(../../../../블프_작품글자_20261110/로고.py): 늘어진 단선 느지막 · 감은 눈 심벌 · 끝 작은 줄, 플라이휠 원판 힘껏 · 70%.
import React from 'react';
import logos from './로고.json';
import logos2 from './로고2.json';

const ALL = { ...logos, ...logos2 };
type Name = keyof typeof ALL;

// width 픽셀 폭으로 그린다. glow는 빛나는 간판 · 화면 글자처럼 번지는 빛(0이면 없음 — 11-10 판은 쓰지 않는다)
export const Logo: React.FC<{ name: Name; width: number; color: string; glow?: number; glowColor?: string; style?: React.CSSProperties }> = ({ name, width, color, glow = 0, glowColor, style }) => {
  const L = ALL[name];
  const h = (width * L.h) / L.w;
  const shadow = glow > 0 ? `drop-shadow(0 0 ${glow}px ${glowColor ?? color}) drop-shadow(0 0 ${glow * 2.6}px ${glowColor ?? color})` : undefined;
  return (
    <svg width={width} height={h} viewBox={`0 0 ${L.w} ${L.h}`} style={{ display: 'block', overflow: 'visible', filter: shadow, ...style }}>
      <path d={L.d} fill={color} fillRule="evenodd" />
    </svg>
  );
};
export const logoHeight = (name: Name, width: number) => (width * ALL[name].h) / ALL[name].w;
export const logoWidthForHeight = (name: Name, height: number) => (height * ALL[name].w) / ALL[name].h;
