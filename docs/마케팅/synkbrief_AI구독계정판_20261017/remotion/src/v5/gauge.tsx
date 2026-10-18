// 계정판 한도 고리(앱 subscriptions.mjs 10-17 16:36 「두 겹 고리」)를 영상에서 프레임으로 그린다.
// 마크업·클래스는 앱 그대로(board.css가 색·크기를 준다). 앱은 고리 그리기·숫자 굴림을 CSS 애니메이션으로 하지만
// 영상은 프레임마다 같은 그림이 나와야 해서, 같은 곡선·길이를 useCurrentFrame()으로 옮겼다(is-drawing·ms-roll 클래스는 쓰지 않는다).
import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { clamp } from '../lib/anim';

/** 앱 leftPercent: 남은 %는 내림(99.6% 썼으면 0%). */
export const leftPercent = (used: number) => Math.max(0, Math.floor(100 - used + 1e-6));
export type Level = 'out' | 'low' | 'ok';
export const levelOf = (left: number): Level => (left <= 0 ? 'out' : left <= 10 ? 'low' : 'ok');
export type Ring = 'weekly' | 'session';
export const WINDOW_NAME: Record<Ring, string> = { session: '5시간', weekly: '주간' };

const APP_EASE = Easing.bezier(0.2, 0.8, 0.2, 1); // 앱 cubic-bezier(.2,.8,.2,1)
const DRAW = 27; // 앱 .9s
const SESSION_DELAY = 4; // 앱 .12s
const RINGS = { full: { weekly: 54, session: 43, width: 8 }, mini: { weekly: 46, session: 46, width: 20 } } as const;

/** 고리 그림(viewBox 120). left: 남은 %. drawAt이 있으면 그 프레임부터 앱과 같은 곡선으로 그려지고, 없으면 다 그려진 채. */
export const Rings: React.FC<{ weekly?: number; session?: number; size: 'full' | 'mini'; drawAt?: number | null }> = ({ weekly, session, size, drawAt }) => {
  const f = useCurrentFrame();
  const spec = RINGS[size];
  const ring = (key: Ring, left: number | undefined) => {
    if (left === undefined) return null;
    const level = levelOf(left);
    const start = drawAt === null || drawAt === undefined ? null : drawAt + (key === 'session' ? SESSION_DELAY : 0);
    const p = start === null ? 1 : interpolate(f, [start, start + DRAW], [0, 1], { ...clamp, easing: APP_EASE });
    const attrs = { cx: 60, cy: 60, r: spec[key], strokeWidth: spec.width };
    return (
      <React.Fragment key={key}>
        <circle className="ms-track" data-level={level} {...attrs} />
        {left > 0 ? (
          left >= 100 ? (
            <circle className="ms-arc" data-ring={key} data-level={level} data-full="" {...attrs} style={{ opacity: p }} />
          ) : (
            <circle
              className="ms-arc"
              data-ring={key}
              data-level={level}
              {...attrs}
              strokeLinecap={left >= 97 ? 'butt' : 'round'}
              pathLength={100}
              strokeDasharray="100 100"
              strokeDashoffset={100 - left * p}
              transform="rotate(-90 60 60)"
              style={{ opacity: p > 0 ? 1 : 0 }}
            />
          )
        ) : null}
      </React.Fragment>
    );
  };
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      {ring('weekly', weekly)}
      {ring('session', session)}
    </svg>
  );
};

/** 숫자 굴림(앱 roll, WORLD .w-roll 문법): 글자마다 0~9 띠가 (10+d)칸 굴러 멈춘다. k번째 글자는 120ms 늦게, 160ms 길게. */
export const RollNum: React.FC<{ text: string; at: number | null }> = ({ text, at }) => {
  const f = useCurrentFrame();
  if (at === null) return <>{text}</>;
  let k = -1;
  return (
    <>
      {Array.from(text).map((ch, i) => {
        if (!/\d/.test(ch)) return <React.Fragment key={i}>{ch}</React.Fragment>;
        k += 1;
        const d = Number(ch);
        const delay = at + (k * 120 * 30) / 1000;
        const dur = ((1000 + k * 160) * 30) / 1000;
        const p = interpolate(f, [delay, delay + dur], [0, 1], { ...clamp, easing: APP_EASE });
        return (
          <span key={i} style={{ position: 'relative', display: 'inline-block', lineHeight: 1.15 }}>
            <span style={{ color: 'transparent' }}>{ch}</span>
            <span style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '1.15em', overflow: 'hidden', textAlign: 'center', lineHeight: 1.15 }}>
              <span style={{ display: 'block', translate: `0 ${-(10 + d) * 1.15 * p}em` }}>
                {Array.from({ length: 20 }, (_, n) => (
                  <span key={n} style={{ display: 'block', height: '1.15em' }}>
                    {n % 10}
                  </span>
                ))}
              </span>
            </span>
          </span>
        );
      })}
    </>
  );
};

type G = { weekly?: number; session?: number }; // 남은 %
/** 두 고리 중 덜 남은 쪽(가운데 숫자·초기화까지의 기준) — 앱 limitGauge의 focus */
export const focusOf = (g: G): Ring => (g.session !== undefined && (g.weekly === undefined || g.session < g.weekly) ? 'session' : 'weekly');

/** 큰 고리(앱 gauge): 고리 둘 + 가운데 남은 % + 「주간」/「주간 남음」. */
export const Gauge: React.FC<{ g: G; label: boolean; drawAt?: number | null; rollAt?: number | null; style?: React.CSSProperties }> = ({ g, label, drawAt = null, rollAt = null, style }) => {
  const focus = focusOf(g);
  const left = g[focus]!;
  return (
    <span className="ms-gauge" data-level={levelOf(left)} style={style}>
      <Rings weekly={g.weekly} session={g.session} size="full" drawAt={drawAt} />
      <span className="ms-gauge-center">
        <b className="ms-gauge-num">
          <RollNum text={String(left)} at={rollAt} />
          <small>%</small>
        </b>
        <span>
          {WINDOW_NAME[focus]}
          {label ? (left <= 0 ? ' 소진' : ' 남음') : ''}
        </span>
      </span>
    </span>
  );
};

/** 서비스 줄의 작은 고리(앱 miniGauge): 한 겹만 굵게. */
export const MiniGauge: React.FC<{ left: number; ring?: Ring; drawAt?: number | null }> = ({ left, ring = 'weekly', drawAt = null }) => (
  <span className="ms-gauge ms-gauge-mini" data-level={levelOf(left)}>
    <Rings {...{ [ring]: left }} size="mini" drawAt={drawAt} />
  </span>
);

/** 앱 leftHtml: 「<b>62%</b> 남음」, 10% 이하는 버터, 0이면 코랄 「소진」. */
export const LeftText: React.FC<{ left: number }> = ({ left }) =>
  left <= 0 ? (
    <b className="ms-alert-text">소진</b>
  ) : (
    <>
      <b className={`ms-num${left <= 10 ? ' ms-warn-text' : ''}`}>{left}%</b> 남음
    </>
  );
