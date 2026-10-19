// 이 편의 연출 부품. 같은 날 synkbrief 판 v5(cine.tsx)의 문법을 builds 테마(검정 펠트 + 버터)로 옮겼다.
// 근거(그 판 콘티 「모션 v5」, 유호님 「확실히 좋아졌네」·Fable 「이 판으로 나머지 장면 제작에 들어가도 된다」):
// 무대 하나를 끝까지, 실제 화면은 떠 있는 판으로, 전환은 위로 밀어 넘기기 하나(겹침 0), 첫 요소는 착지와 함께·제목·자막은 착지 뒤,
// 장면당 펀치 하나(1.25 이하, 원점은 동작 지점), 강조는 밑줄·동그라미·큰 숫자 각 하나, 튕김·펄스·글로·파티클·크로스페이드 없음.
import React from 'react';
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, EASE_OUT, lerp, settle } from './anim';
import { CRAYON_CIRCLE, CRAYON_UNDER } from './crayon';
import { C, F, L } from '../theme';

/** 무대: 검정 펠트 + 결 + 아주 느린 빛 + 비네트 + 버터 실땀 네 모서리. 영상 처음부터 끝까지 하나. */
export const Stage: React.FC<{ total: number }> = ({ total }) => {
  const f = useCurrentFrame();
  const drift = interpolate(f, [0, total], [0, 1], clamp);
  const corner = 150;
  const mask = ['0 0', '100% 0', '0 100%', '100% 100%'].map((p) => `linear-gradient(#000 0 0) ${p}/${corner}px ${corner}px no-repeat`).join(',');
  return (
    <AbsoluteFill style={{ background: C.field, overflow: 'hidden' }}>
      <AbsoluteFill style={{ opacity: 0.55, background: `url(${staticFile('kit/field-grain.webp')}) 0 0/192px 192px repeat`, scale: String(1 + 0.04 * drift) }} />
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 760px at ${lerp(20, 32, drift)}% ${lerp(-8, 4, drift)}%,rgba(255,236,190,.10),rgba(255,236,190,0) 70%),radial-gradient(1200px 1000px at 100% 115%,rgba(0,0,0,.55),rgba(0,0,0,0) 62%)`,
        }}
      />
      <AbsoluteFill style={{ boxShadow: 'inset 0 0 280px rgba(0,0,0,.6)' }} />
      <div
        style={{
          position: 'absolute',
          inset: 34,
          border: '1px solid transparent',
          borderImage: `url(${staticFile('kit/thread-butter-soft.webp')}) 250 / 40px / 0 round`,
          mask,
          WebkitMask: mask,
          opacity: 0.8,
        }}
      />
    </AbsoluteFill>
  );
};

/** 위로 밀어 넘기기(synkbrief v5와 같은 값): 나가는 장면은 끝 13→7프레임에 위로 가속하며 흐려져 빠지고,
 * 들어오는 장면은 5→12프레임에 520px 아래·흐림에서 감속하며 올라와 시퀀스 시작 + 12에 내려앉는다. 반투명 겹침 없음. */
export const Whip: React.FC<{ children: React.ReactNode; len: number; noIn?: boolean; noOut?: boolean }> = ({ children, len, noIn, noOut }) => {
  const f = useCurrentFrame();
  const pin = noIn ? 1 : interpolate(f, [5, 12], [0, 1], { ...clamp, easing: EASE_OUT });
  const pout = noOut ? 0 : interpolate(f, [len - 13, len - 7], [0, 1], { ...clamp, easing: (t) => t * t * t });
  const y = (1 - pin) * 520 - pout * 1600;
  const blur = (1 - pin) * 24 + pout * 24;
  const hidden = (!noIn && f < 5) || (!noOut && f >= len - 7);
  return <AbsoluteFill style={{ translate: `0 ${y}px`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined, opacity: hidden ? 0 : 1 }}>{children}</AbsoluteFill>;
};

/** 줄마다 아래에서 잘려 올라오는 글자(마스크). visibleAtZero면 0프레임부터 다 보인다. */
export const Lines: React.FC<{ lines: React.ReactNode[]; at: number; size: number; weight?: number; top: number; color?: string; stagger?: number; visibleAtZero?: boolean; lh?: number; font?: string; ls?: string }> = ({
  lines,
  at,
  size,
  weight = 800,
  top,
  color = C.onField,
  stagger = 4,
  visibleAtZero,
  lh = 1.14,
  font = F.ko,
  ls = '-.045em',
}) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: L.X, right: L.R, top, color, font: `${weight} ${size}px/${lh} ${font}`, letterSpacing: ls }}>
      {lines.map((ln, i) => {
        const p = visibleAtZero ? 1 : settle(f, at + Math.round(Math.pow(i, 0.8) * stagger), 16);
        return (
          <div key={i} style={{ overflow: 'hidden', paddingBottom: '.14em', marginBottom: '-.14em' }}>
            <div style={{ translate: `0 ${(1 - p) * 105}%` }}>{ln}</div>
          </div>
        );
      })}
    </div>
  );
};

/** 강조(버터 글자 + 크레용 밑줄이 왼쪽부터). p = 밑줄 진행 0→1 */
export const Mark: React.FC<{ children: React.ReactNode; p: number; color?: string }> = ({ children, p, color = C.butter }) => (
  <span style={{ position: 'relative', color, whiteSpace: 'nowrap', zIndex: 0 }}>
    {children}
    <span
      style={{
        position: 'absolute',
        left: '-.04em',
        right: '-.04em',
        bottom: '-.1em',
        height: '.2em',
        zIndex: -1,
        background: color,
        WebkitMask: `${CRAYON_UNDER} no-repeat center/100% 100%`,
        mask: `${CRAYON_UNDER} no-repeat center/100% 100%`,
        clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`,
      }}
    />
  </span>
);

/** 크레용 동그라미(손그림이 단계로 그어진다) */
export const Circle: React.FC<{ at: number; x: number; y: number; w: number; h: number; color?: string; dur?: number }> = ({ at, x, y, w, h, color = C.butter, dur = 12 }) => {
  const f = useCurrentFrame();
  const p = Math.floor(interpolate(f, [at, at + dur], [0, 1], clamp) * 9) / 9;
  if (p <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        background: color,
        WebkitMask: `${CRAYON_CIRCLE} no-repeat center/100% 100%`,
        mask: `${CRAYON_CIRCLE} no-repeat center/100% 100%`,
        clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`,
      }}
    />
  );
};

/** 머리줄(모노) */
export const Head: React.FC<{ left: string; right?: string; at?: number }> = ({ left, right, at = 0 }) => {
  const f = useCurrentFrame();
  const o = at ? interpolate(f, [at, at + 6], [0, 1], clamp) : 1;
  return (
    <div style={{ position: 'absolute', left: L.X, right: L.R + 4, top: L.HEAD_Y, display: 'flex', justifyContent: 'space-between', font: `500 26px/1 ${F.mono}`, color: C.onField2, opacity: o }}>
      <b style={{ fontWeight: 500, color: C.butter }}>{left}</b>
      {right ? <span>{right}</span> : null}
    </div>
  );
};

/** 작은 라벨(모노, 버터) */
export const Label: React.FC<{ text: string; at: number; top: number; left?: number }> = ({ text, at, top, left = L.X }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 7], [0, 1], { ...clamp, easing: EASE_OUT });
  return <p style={{ position: 'absolute', left, top, margin: 0, font: `500 28px/1.3 ${F.mono}`, color: C.butter, opacity: p, translate: `0 ${(1 - p) * 10}px` }}>{text}</p>;
};

/** 말자막: 낱말마다 실제 말 시각에 떠오른다. *…*는 버터 강조. 자막 묶음은 다음 묶음 직전에 사라진다. */
/** from: 이 프레임 전에는 띄우지 않는다(장면 착지 전 자막 금지, 10-17 Fable). 묶음은 다음 대사가 뜨는 프레임에 맞춰 사라진다. */
export const Captions: React.FC<{ segs: { cap: string[]; tokens: number[]; end: number }[]; nextStart: number[]; leave: number; from?: number }> = ({ segs, nextStart, leave, from = 0 }) => {
  const f = useCurrentFrame();
  const out: React.ReactNode[] = [];
  segs.forEach((g, si) => {
    let k = 0;
    g.cap.forEach((chunk, ci) => {
      const words = chunk.split(/\s+/).filter(Boolean);
      const times = g.tokens.slice(k, k + words.length).map((t) => Math.max(t, from));
      k += words.length;
      const last = ci === g.cap.length - 1;
      const gone = last ? Math.min(g.end + 13, nextStart[si], leave - 2) : Math.max(g.tokens[k], from + 1);
      if (f < times[0] || f >= gone) return;
      const fadeOut = interpolate(f, [gone - 3, gone], [1, 0], clamp);
      let em = false;
      out.push(
        <p key={`${si}-${ci}`} style={{ position: 'absolute', left: L.X, right: L.R, bottom: L.H - L.CAP_BOTTOM, margin: 0, font: `760 58px/1.24 ${F.ko}`, letterSpacing: '-.03em', color: '#fff', opacity: fadeOut }}>
          {words.map((w, i) => {
            const startEm = w.startsWith('*');
            if (startEm) em = true;
            const isEm = em;
            if (w.endsWith('*')) em = false;
            const p = interpolate(f, [times[i], times[i] + 7], [0, 1], { ...clamp, easing: EASE_OUT });
            return (
              <span key={i} style={{ display: 'inline-block', marginRight: '.26em', opacity: p, translate: `0 ${(1 - p) * 14}px`, filter: p < 1 ? `blur(${(1 - p) * 8}px)` : undefined, color: isEm ? C.butter : undefined }}>
                {w.replace(/\*/g, '')}
              </span>
            );
          })}
        </p>,
      );
    });
  });
  return <>{out}</>;
};

/** 떠 있는 어두운 화면 판(실제 기록·도구 화면) */
export const Screen: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; bar?: [string, string] }> = ({ children, style, bar }) => (
  <div
    style={{
      position: 'absolute',
      borderRadius: 30,
      background: C.screen,
      boxShadow: '0 1px 0 rgba(255,255,255,.08) inset,0 0 0 1px rgba(255,255,255,.08),0 50px 90px -40px rgba(0,0,0,.9),0 18px 40px -24px rgba(0,0,0,.8)',
      overflow: 'hidden',
      ...style,
    }}
  >
    {bar ? (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 26px', background: C.screenBar, font: `500 24px/1.2 ${F.mono}`, color: C.screenDim }}>
        <span>{bar[0]}</span>
        <span>{bar[1]}</span>
      </div>
    ) : null}
    {children}
  </div>
);

/** 떠 있는 흰 종이 판 */
export const Paper: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ position: 'absolute', borderRadius: 28, background: C.paper, color: C.ink, boxShadow: '0 50px 90px -40px rgba(0,0,0,.95),0 18px 40px -24px rgba(0,0,0,.8)', overflow: 'hidden', ...style }}>{children}</div>
);

/** 칩: 착지하듯 눌려 나타난다(튕김 없음) */
export const Chip: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; fill?: boolean }> = ({ at, children, style, fill }) => {
  const f = useCurrentFrame();
  const p = settle(f, at, 18);
  if (f < at) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '14px 26px',
        borderRadius: 999,
        font: `700 34px/1 ${F.ko}`,
        letterSpacing: '-.02em',
        whiteSpace: 'nowrap',
        background: fill ? C.butter : 'transparent',
        color: fill ? C.ink : C.onField,
        boxShadow: fill ? 'none' : 'inset 0 0 0 2.5px rgba(255,255,255,.7)',
        opacity: p,
        scale: String(0.86 + 0.14 * p),
        ...style,
      }}
    >
      {children}
    </span>
  );
};

/** 도장: 크게 찍혔다 제자리(튕김 없는 감속) */
export const Stamp: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; rot?: number }> = ({ at, children, style, rot = -6 }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const p = interpolate(f, [at, at + 7], [0, 1], { ...clamp, easing: EASE_OUT });
  return <div style={{ position: 'absolute', rotate: `${lerp(rot - 8, rot, p)}deg`, scale: String(lerp(1.7, 1, p)), opacity: Math.min(1, p * 2), ...style }}>{children}</div>;
};

/** 숫자 세기(결과 숫자 하나에만) */
export const useCount = (from: number, to: number, at: number, len: number) => {
  const f = useCurrentFrame();
  return interpolate(f, [at, at + len], [from, to], { ...clamp, easing: EASE_OUT });
};
