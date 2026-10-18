// v5 연출 부품(10-17 「트렌디한 걸 크롤링해서 … 신뢰감 위주로, 보게 하는 힘」).
// 근거: Linear·Anthropic 런치 영상 문법(카메라가 실제 화면 속을 지나감, 마스크로 올라오는 글자, 튕김 없는 감쇠,
// 처리 중엔 빠르고 결과에선 멈춤, 위로 휙 넘기는 전환 + 모션 블러, 과정을 보여 주는 신뢰 구조).
import React from 'react';
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, EASE_OUT } from '../lib/anim';
import { CRAYON_UNDER } from '../lib/crayon';
import { BOARD_TOKENS, C, F, L } from '../theme';

/** 임계 감쇠 스프링 1-(1+wt)e^(-wt): 목표를 넘지 않고 내려앉는다(튕김 없음). */
export const settle = (f: number, at: number, w = 14) => {
  const t = (f - at) / 30;
  if (t <= 0) return 0;
  return 1 - (1 + w * t) * Math.exp(-w * t);
};
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** 무대: 청금석 면 + 펠트 결 + 아주 느린 깊이(바탕 결은 멈춰 있고 빛만 천천히 움직인다) + 비네트 */
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

/** 줄마다 아래에서 잘려 올라오는 글자(마스크). from이 0이면 0프레임부터 다 보인다. */
export const Lines: React.FC<{ lines: React.ReactNode[]; at: number; size: number; weight?: number; top: number; color?: string; stagger?: number; visibleAtZero?: boolean }> = ({
  lines,
  at,
  size,
  weight = 800,
  top,
  color = C.onField,
  stagger = 4,
  visibleAtZero,
}) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: L.X, right: L.R, top, color, font: `${weight} ${size}px/1.12 ${F.ko}`, letterSpacing: '-.045em' }}>
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
export const HeadF: React.FC<{ left: string; right: string; at?: number }> = ({ left, right, at = 0 }) => {
  const f = useCurrentFrame();
  const o = at ? interpolate(f, [at, at + 6], [0, 1], clamp) : 1;
  return (
    <div style={{ position: 'absolute', left: L.X, right: L.R + 4, top: L.HEAD_Y, display: 'flex', justifyContent: 'space-between', font: `500 26px/1 ${F.mono}`, color: C.onField2, opacity: o }}>
      <b style={{ fontWeight: 500, color: C.onField }}>{left}</b>
      <span>{right}</span>
    </div>
  );
};

/** 말자막(색 면): 낱말이 짧게 떠오르기만 한다(화면이 주인공일 때 자막은 조용히). 강조 낱말은 노란 글자. */
export const CaptionF: React.FC<{ text: string; em: string; at: number }> = ({ text, em, at }) => {
  const f = useCurrentFrame();
  const words = text.split(/\s+/).filter(Boolean);
  const emWords = em.split(/\s+/).filter(Boolean);
  const emStart = words.findIndex((w, i) => emWords.every((e, k) => words[i + k] === e));
  return (
    <p style={{ position: 'absolute', left: L.X, right: L.R, bottom: L.H - L.CAP_BOTTOM, margin: 0, font: `760 58px/1.24 ${F.ko}`, letterSpacing: '-.03em', color: '#fff' }}>
      {words.map((w, i) => {
        const p = interpolate(f, [at + i * 3, at + i * 3 + 7], [0, 1], { ...clamp, easing: EASE_OUT });
        const isEm = emStart >= 0 && i >= emStart && i < emStart + emWords.length;
        return (
          <span key={i} style={{ display: 'inline-block', marginRight: '.26em', opacity: p, translate: `0 ${(1 - p) * 14}px`, color: isEm ? C.markField : undefined }}>
            {w}
          </span>
        );
      })}
    </p>
  );
};

/** 떠 있는 화면 판: 어두운 판 + 큰 부드러운 그림자 + 1px 빛 테두리 */
export const FloatCard: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; stamp?: string }> = ({ children, style, stamp }) => (
  <div
    style={{
      position: 'absolute',
      borderRadius: 34,
      background: '#0c0e13',
      boxShadow: '0 1px 0 rgba(255,255,255,.08) inset,0 0 0 1px rgba(255,255,255,.06),0 50px 90px -40px rgba(4,12,36,.75),0 18px 40px -24px rgba(4,12,36,.6)',
      overflow: 'hidden',
      ...style,
    }}
  >
    {stamp ? (
      <span style={{ position: 'absolute', top: 22, right: 26, zIndex: 2, padding: '6px 12px', borderRadius: 8, font: `500 22px/1.2 ${F.mono}`, color: 'rgba(255,255,255,.72)', boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.22)' }}>{stamp}</span>
    ) : null}
    {children}
  </div>
);

/** 커서: 위로 볼록한 곡선을 따라 가속·감속해 도착 → 가까워지면 살짝 커짐 → 누를 때 15% 줄어듦 → 물결은 화면 변화보다 3프레임 먼저 */
export const CursorArc: React.FC<{ from: [number, number]; to: [number, number]; start: number; arrive: number; click: number; leave?: number }> = ({ from, to, start, arrive, click, leave }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [start, arrive], [0, 1], { ...clamp, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) });
  const lift = Math.sin(Math.PI * p) * -140; // 위로 볼록
  const x = lerp(from[0], to[0], p);
  const y = lerp(from[1], to[1], p) + lift;
  const hover = interpolate(f, [arrive - 4, arrive + 2], [1, 1.22], clamp);
  const press = interpolate(f, [click - 2, click, click + 6], [1, 0.85, 1], clamp);
  const fade = interpolate(f, [start, start + 4, ...(leave ? [leave, leave + 6] : [])], [0, 1, ...(leave ? [1, 0] : [])], clamp);
  const ring = interpolate(f, [click - 3, click + 14], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <>
      {f >= click - 3 && f < click + 16 ? (
        <div style={{ position: 'absolute', left: to[0] - 80, top: to[1] - 80, width: 160, height: 160, borderRadius: '50%', border: `5px solid rgba(255,255,255,${0.85 * (1 - ring)})`, scale: String(0.25 + ring) }} />
      ) : null}
      <svg width="66" height="66" viewBox="0 0 24 24" style={{ position: 'absolute', left: x - 6, top: y - 4, opacity: fade, scale: String(hover * press), transformOrigin: '6px 4px', filter: 'drop-shadow(0 8px 12px rgba(0,0,0,.4))' }}>
        <path d="M5 3l14 8.5-6.2 1.3L9.6 19z" fill="#fff" stroke="#0a0a0a" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </>
  );
};

/** 계정판 틀(zoom): transform과 달리 키운 만큼 자리도 커져 떠 있는 판이 내용을 자르지 않는다. */
export const BoardZ: React.FC<{ width: number; scale: number; children: React.ReactNode }> = ({ width, scale, children }) => (
  <div className="member-subs" style={{ ...(BOARD_TOKENS as React.CSSProperties), width, maxWidth: 'none', margin: 0, zoom: scale }}>
    {children}
  </div>
);

/** 읽는 중 표시(돌아가는 호). 프레임으로만 돈다. */
export const Spinner: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = 'rgba(250,250,249,.72)' }) => {
  const f = useCurrentFrame();
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ rotate: `${(f * 18) % 360}deg`, flex: 'none' }}>
      <circle cx="10" cy="10" r="7.5" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="2.5" />
      <path d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
};

/** 위로 밀어 넘기는 전환(Fable 10-17): 나가는 장면은 불투명한 채 끝 13→7프레임에 위로 가속하며 흐려져 빠지고,
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
