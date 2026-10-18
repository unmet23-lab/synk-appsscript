// 연출 부품 — 같은 채널 「AI 구독 계정판」 v5(docs/마케팅/synkbrief_AI구독계정판_20261017/remotion/src/v5/cine.tsx)에서 가져왔다.
// 유호님 10-17 v5b 「확실히 좋아졌네」, Fable 규칙: 청금석 무대 하나, 장면당 변화 하나, 사건은 박자에, 전환은 위로 밀기 하나,
// 펀치는 장면당 하나·1.25 이하·원점은 동작 지점, 튕김·펄스·글로·파티클·크로스페이드 없음, 소리는 사건당 하나.
import React from 'react';
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { C, F, L } from '../theme';
import { clamp, EASE_OUT } from './anim';
import { CRAYON_UNDER } from './crayon';

/** 임계 감쇠 스프링 1-(1+wt)e^(-wt): 목표를 넘지 않고 내려앉는다(튕김 없음). */
export const settle = (f: number, at: number, w = 14) => {
  const t = (f - at) / 30;
  if (t <= 0) return 0;
  return 1 - (1 + w * t) * Math.exp(-w * t);
};
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** 무대: 청금석 면 + 펠트 결 + 아주 느린 빛 + 비네트 + 실땀 네 모서리 */
export const Stage: React.FC<{ total: number }> = ({ total }) => {
  const f = useCurrentFrame();
  const drift = interpolate(f, [0, total], [0, 1], clamp);
  const corner = 150;
  const mask = ['0 0', '100% 0', '0 100%', '100% 100%'].map((p) => `linear-gradient(#000 0 0) ${p}/${corner}px ${corner}px no-repeat`).join(',');
  return (
    <AbsoluteFill style={{ background: C.field, overflow: 'hidden' }}>
      <AbsoluteFill style={{ opacity: 0.9, background: `url(${staticFile('kit/field-grain.webp')}) 0 0/192px 192px repeat`, scale: String(1 + 0.04 * drift) }} />
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 700px at ${lerp(18, 30, drift)}% ${lerp(-6, 4, drift)}%,rgba(255,255,255,.18),rgba(255,255,255,0) 70%),radial-gradient(1200px 1000px at 100% 115%,rgba(4,14,40,.38),rgba(4,14,40,0) 62%)`,
        }}
      />
      <AbsoluteFill style={{ boxShadow: 'inset 0 0 260px rgba(6,16,44,.35)' }} />
      <div
        style={{
          position: 'absolute',
          inset: 34,
          border: '1px solid transparent',
          borderImage: `url(${staticFile('kit/thread-lapis-soft.webp')}) 250 / 40px / 0 round`,
          mask,
          WebkitMask: mask,
          opacity: 0.85,
        }}
      />
    </AbsoluteFill>
  );
};

/** 줄마다 아래에서 잘려 올라오는 글자(마스크). visibleAtZero면 0프레임부터 다 보인다. */
export const Lines: React.FC<{ lines: React.ReactNode[]; at: number; size: number; weight?: number; top: number; color?: string; stagger?: number; visibleAtZero?: boolean; lh?: number }> = ({
  lines,
  at,
  size,
  weight = 800,
  top,
  color = C.onField,
  stagger = 4,
  visibleAtZero,
  lh = 1.12,
}) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: L.X, right: L.R, top, color, font: `${weight} ${size}px/${lh} ${F.ko}`, letterSpacing: '-.045em' }}>
      {lines.map((ln, i) => {
        const p = visibleAtZero ? 1 : settle(f, at + Math.round(Math.pow(i, 0.8) * stagger), 16);
        return (
          <div key={i} style={{ overflow: 'hidden', paddingBottom: '.12em', marginBottom: '-.12em' }}>
            <div style={{ translate: `0 ${(1 - p) * 105}%` }}>{ln}</div>
          </div>
        );
      })}
    </div>
  );
};

/** 색 면 위 강조: 글자색 + 크레용 밑줄이 왼쪽부터 */
export const MarkF: React.FC<{ children: React.ReactNode; p: number }> = ({ children, p }) => (
  <span style={{ position: 'relative', color: C.markField, whiteSpace: 'nowrap', zIndex: 0 }}>
    {children}
    <span
      style={{
        position: 'absolute',
        left: '-.04em',
        right: '-.04em',
        bottom: '-.1em',
        height: '.2em',
        zIndex: -1,
        background: C.markField,
        WebkitMask: `${CRAYON_UNDER} no-repeat center/100% 100%`,
        mask: `${CRAYON_UNDER} no-repeat center/100% 100%`,
        clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`,
      }}
    />
  </span>
);

/** 머리줄(색 면) */
export const HeadF: React.FC<{ left?: string; right: string }> = ({ left = 'synkbrief 뉴스', right }) => (
  <div style={{ position: 'absolute', left: L.X, right: L.R + 4, top: L.HEAD_Y, display: 'flex', justifyContent: 'space-between', font: `500 26px/1 ${F.mono}`, color: C.onField2 }}>
    <b style={{ fontWeight: 500, color: C.onField }}>{left}</b>
    <span>{right}</span>
  </div>
);

/** 떠 있는 화면 판: 어두운 판 + 큰 부드러운 그림자 + 1px 빛 테두리 */
export const FloatCard: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      position: 'absolute',
      borderRadius: 30,
      background: C.screen,
      boxShadow: '0 1px 0 rgba(255,255,255,.08) inset,0 0 0 1px rgba(255,255,255,.06),0 50px 90px -40px rgba(4,12,36,.75),0 18px 40px -24px rgba(4,12,36,.6)',
      overflow: 'hidden',
      ...style,
    }}
  >
    {children}
  </div>
);

/** 커서: 위로 볼록한 곡선을 따라 가속·감속해 도착 → 가까워지면 살짝 커짐 → 누를 때 15% 줄어듦 → 물결은 화면 변화보다 3프레임 먼저.
 * clicks가 여럿이면(헛클릭) 같은 자리에서 다시 누른다. */
export const CursorArc: React.FC<{ from: [number, number]; to: [number, number]; start: number; arrive: number; clicks: number[]; leave?: number; dark?: boolean }> = ({ from, to, start, arrive, clicks, leave }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [start, arrive], [0, 1], { ...clamp, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) });
  const lift = Math.sin(Math.PI * p) * -140; // 위로 볼록
  const x = lerp(from[0], to[0], p);
  const y = lerp(from[1], to[1], p) + lift;
  const hover = interpolate(f, [arrive - 4, arrive + 2], [1, 1.22], clamp);
  const press = Math.min(...clicks.map((c) => interpolate(f, [c - 2, c, c + 6], [1, 0.85, 1], clamp)));
  const fade = interpolate(f, [start, start + 4, ...(leave ? [leave, leave + 6] : [])], [0, 1, ...(leave ? [1, 0] : [])], clamp);
  if (f < start) return null;
  return (
    <>
      {clicks.map((c, i) => {
        const ring = interpolate(f, [c - 3, c + 14], [0, 1], { ...clamp, easing: EASE_OUT });
        return f >= c - 3 && f < c + 16 ? (
          <div key={i} style={{ position: 'absolute', left: to[0] - 80, top: to[1] - 80, width: 160, height: 160, borderRadius: '50%', border: `5px solid rgba(255,255,255,${0.85 * (1 - ring)})`, scale: String(0.25 + ring) }} />
        ) : null;
      })}
      <svg width="66" height="66" viewBox="0 0 24 24" style={{ position: 'absolute', left: x - 6, top: y - 4, opacity: fade, scale: String(hover * press), transformOrigin: '6px 4px', filter: 'drop-shadow(0 8px 12px rgba(0,0,0,.4))' }}>
        <path d="M5 3l14 8.5-6.2 1.3L9.6 19z" fill="#fff" stroke="#0a0a0a" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </>
  );
};

/** 위로 밀어 넘기는 전환: 나가는 장면은 불투명한 채 끝 13→7프레임에 위로 가속하며 흐려져 빠지고,
 * 들어오는 장면은 5→12프레임에 520px 아래·흐림에서 감속하며 올라와 박(시퀀스 시작 + 12)에 내려앉는다. 두 장면이 반투명으로 겹치지 않는다. */
export const Whip: React.FC<{ children: React.ReactNode; len: number; noIn?: boolean; noOut?: boolean }> = ({ children, len, noIn, noOut }) => {
  const f = useCurrentFrame();
  const pin = noIn ? 1 : interpolate(f, [5, 12], [0, 1], { ...clamp, easing: EASE_OUT });
  const pout = noOut ? 0 : interpolate(f, [len - 13, len - 7], [0, 1], { ...clamp, easing: (t) => t * t * t });
  const y = (1 - pin) * 520 - pout * 1600;
  const blur = (1 - pin) * 24 + pout * 24;
  const hidden = (!noIn && f < 5) || (!noOut && f >= len - 7);
  return <AbsoluteFill style={{ translate: `0 ${y}px`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined, opacity: hidden ? 0 : 1 }}>{children}</AbsoluteFill>;
};
