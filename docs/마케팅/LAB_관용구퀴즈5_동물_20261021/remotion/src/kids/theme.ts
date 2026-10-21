// 키즈판(초중고 학생용) 색과 만화 글자. 프리미엄판(film/)과 박자표·내용은 같고 겉모습만 다르다.
import type React from 'react';
import { KO, EN } from '../lib/fonts';

export const K = {
  bg: '#3D6BC9', // 청금석
  bg2: '#5A86E0',
  navy: '#1B2A5A', // 외곽선·그림자
  white: '#FFFFFF',
  coral: '#F96859',
  butter: '#F5C445',
  meadow: '#7DB45A',
  pop: '#E05C97',
  sky: '#C5D6F5',
  peach: '#FFD2B8',
  grey: '#B9C3DA',
};

/** 만화 글자: 흰 글자 + 두꺼운 남색 외곽선 + 아래로 떨어지는 단단한 그림자. */
export const toon = (size: number, opts: { color?: string; stroke?: number; drop?: number; font?: 'ko' | 'en'; weight?: number } = {}): React.CSSProperties => {
  const stroke = opts.stroke ?? Math.max(6, Math.round(size * 0.075));
  const drop = opts.drop ?? Math.max(5, Math.round(size * 0.06));
  return {
    font: `${opts.weight ?? 900} ${size}px/1.05 ${opts.font === 'en' ? EN : KO}`,
    color: opts.color ?? K.white,
    WebkitTextStroke: `${stroke}px ${K.navy}`,
    paintOrder: 'stroke fill',
    textShadow: `0 ${drop}px 0 ${K.navy}`,
    letterSpacing: opts.font === 'en' ? '-0.01em' : '-0.02em',
  };
};

/** 만화 판(흰 판 + 남색 외곽선 + 단단한 그림자). */
export const panel = (radius = 40, depth = 12, bg: string = K.white): React.CSSProperties => ({
  background: bg,
  borderRadius: radius,
  border: `7px solid ${K.navy}`,
  boxShadow: `0 ${depth}px 0 ${K.navy}`,
});

/** 글자 수로 줄 폭을 어림한다(라틴 글자 = 1). 가나·한자처럼 폭이 넓은 글자는 약 1.7(10-18 나라별 채널판). */
export const textSpan = (s: string) => [...s].reduce((w, c) => w + ((c.codePointAt(0) ?? 0) >= 0x2e80 ? 1.7 : 1), 0);
