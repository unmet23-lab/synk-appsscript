// v8 머리글 — 모션조사_20261020.md 규칙 1·2. 줄 단위 짧은 올림 하나만 쓴다.
// 줄마다 마스크 안에서 y +28px → 0, 불투명도 0 → 1, 10프레임, cubic-bezier(0.23,1,0.32,1). 둘째 줄부터 3프레임씩 늦게. 흐림·크기 변화 없음.
// 강조 낱말 하나는 처음부터 버터로 칠한 채 줄과 같이 들어온다. 다음 머리글로는 컷(until에서 사라짐), fade면 until 전 7프레임 동안 불투명도만 내린다.
import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { BUTTER, INK } from '../film/parts';
import { KO } from '../lib/fonts';
import { clamp } from '../lib/motion';
import { LEFT, TOP } from '../full/kit';

/** 들어오고 나가는 것(Emil Kowalski 권장값). */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** 화면 위에서 옮겨 가는 것(카메라). */
export const EASE_MOVE = Easing.bezier(0.77, 0, 0.175, 1);
export const ease = (f: number, a: number, len: number, e = EASE_OUT) => interpolate(f, [a, a + len], [0, 1], { ...clamp, easing: e });

const paint = (ln: string, accent?: string) => {
  const k = accent ? ln.indexOf(accent) : -1;
  if (!accent || k < 0) return ln;
  return (
    <>
      {ln.slice(0, k)}
      <span style={{ color: BUTTER }}>{accent}</span>
      {ln.slice(k + accent.length)}
    </>
  );
};

/** 머리글 한 벌. at이 0 이하면 0프레임부터 다 보인다(표지 노릇). */
export const Line: React.FC<{ lines: string[]; accent?: string; at: number; until?: number; fade?: boolean; size?: number; top?: number }> = ({ lines, accent, at, until, fade, size = 78, top = TOP }) => {
  const f = useCurrentFrame();
  if (at > 0 && f < at) return null;
  if (until !== undefined && f >= until) return null;
  const o = fade && until !== undefined ? 1 - interpolate(f, [until - 7, until], [0, 1], clamp) : 1;
  return (
    <div style={{ position: 'absolute', left: LEFT, top, fontFamily: KO, fontWeight: 740, fontSize: size, lineHeight: 1.16, letterSpacing: '-0.035em', color: INK, opacity: o }}>
      {lines.map((ln, i) => {
        const p = at <= 0 ? 1 : ease(f, at + 3 * i, 10);
        return (
          <div key={i} style={{ overflow: 'hidden', whiteSpace: 'nowrap', padding: '0.06em 0 0.16em', margin: '-0.06em 0 -0.16em' }}>
            <div style={{ transform: p < 1 ? `translateY(${(1 - p) * 28}px)` : undefined, opacity: p }}>{paint(ln, accent)}</div>
          </div>
        );
      })}
    </div>
  );
};
