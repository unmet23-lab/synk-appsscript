// B16 부품: 종이 무대 · 머리줄 · 마스크로 올라오는 제목 · 실제 화면 판(카메라) · 크레용 동그라미 · 질문 칩 · 결론 알약 · 도장 · 형광펜 띠.
// 밀기 전환(Whip) · 감쇠 스프링(settle) · 크레용 동그라미는 원본 편(synkbrief_AI구독하나고르기_20261021 src/v5/cine.tsx)과 같은 셈이다.
import { evolvePath } from '@remotion/paths';
import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, EASE_IN_OUT, EASE_OUT } from './lib/anim';
import { C, F, L } from './theme';

/** 임계 감쇠 스프링: 목표를 넘지 않고 내려앉는다. */
export const settle = (f: number, at: number, w = 14) => {
  const t = (f - at) / 30;
  if (t <= 0) return 0;
  return 1 - (1 + w * t) * Math.exp(-w * t);
};
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const fadeUp = (f: number, a: number, dist = 26) => {
  const p = interpolate(f, [a, a + 9], [0, 1], { ...clamp, easing: EASE_OUT });
  return { opacity: p, translate: `0 ${(1 - p) * dist}px` };
};

/** 무대: 따뜻한 흰 종이 + 아주 옅은 결 + 위에서 오는 빛(천천히 움직임) */
export const Paper: React.FC<{ total: number }> = ({ total }) => {
  const f = useCurrentFrame();
  const d = interpolate(f, [0, total], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: C.paper, overflow: 'hidden' }}>
      <AbsoluteFill style={{ opacity: 0.16, background: `url(${staticFile('kit/field-grain.webp')}) 0 0/192px 192px repeat`, mixBlendMode: 'multiply' }} />
      <AbsoluteFill style={{ background: `radial-gradient(1100px 800px at ${lerp(30, 42, d)}% ${lerp(-8, 2, d)}%,rgba(255,255,255,.75),rgba(255,255,255,0) 70%),radial-gradient(1300px 900px at 90% 118%,rgba(120,104,80,.16),rgba(120,104,80,0) 65%)` }} />
    </AbsoluteFill>
  );
};

/** 이름표: 위 가운데 「● SYNK 브리핑」 알약 하나(청금석 점 하나). v3까지의 좌우 머리줄(오른쪽 「실제 화면 · 날짜」)은 지난 편과 같아 보여 뺐다. */
export const Head: React.FC = () => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 380, display: 'flex', justifyContent: 'center' }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 999, background: '#fff', boxShadow: `inset 0 0 0 2px ${C.hair}`, color: C.ink, font: `800 26px/1 ${F.ko}`, letterSpacing: '-.02em' }}>
      <span style={{ width: 14, height: 14, borderRadius: '50%', background: C.lapis }} />
      SYNK 브리핑
    </span>
  </div>
);

/** 줄마다 아래에서 잘려 올라오는 제목(마스크). visibleAtZero면 0프레임부터 다 보인다. */
export const Title: React.FC<{ lines: React.ReactNode[]; at: number; top: number; size?: number; visibleAtZero?: boolean; color?: string }> = ({ lines, at, top, size = 92, visibleAtZero, color = C.ink }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: L.X, right: L.X, top, color, font: `850 ${size}px/1.14 ${F.ko}`, letterSpacing: '-.05em' }}>
      {lines.map((ln, i) => {
        const p = visibleAtZero ? 1 : settle(f, at + i * 3, 16);
        return (
          <div key={i} style={{ overflow: 'hidden', paddingBottom: '.12em', marginBottom: '-.12em' }}>
            <div style={{ translate: `0 ${(1 - p) * 105}%` }}>{ln}</div>
          </div>
        );
      })}
    </div>
  );
};

/** 강조: 검은 띠가 왼쪽부터 깔리고 그 위 글자가 흰색으로(띠가 판이라 흰 글자가 그림 위에 바로 얹히지 않는다) */
export const Mark: React.FC<{ children: React.ReactNode; p: number }> = ({ children, p }) => (
  <span style={{ position: 'relative', whiteSpace: 'nowrap', zIndex: 0, color: p > 0.97 ? '#fff' : undefined, padding: '0 .14em', margin: '0 -.04em' }}>
    <span style={{ position: 'absolute', left: 0, right: 0, top: '.04em', bottom: '-.02em', zIndex: -1, background: C.ink, borderRadius: '.12em', clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }} />
    {children}
  </span>
);

/** 스포트라이트: 그림 좌표의 상자만 밝게 두고 나머지를 어둡게 + 노란 테(빨간 크레용 동그라미 대신 — v3 이해 시험 「지난 편과 같아 보임」) */
export const Spot: React.FC<{ x: number; y: number; w: number; h: number; at: number; dim?: number; r?: number }> = ({ x, y, w, h, at, dim = 0.62, r = 18 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 5], [0, 1], { ...clamp, easing: EASE_OUT });
  if (p <= 0) return null;
  const grow = interpolate(f, [at, at + 7], [1.25, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div
      style={{
        position: 'absolute',
        left: x - (w * (grow - 1)) / 2,
        top: y - (h * (grow - 1)) / 2,
        width: w * grow,
        height: h * grow,
        borderRadius: r,
        boxShadow: `0 0 0 4000px rgba(0,0,0,${dim * p}),0 0 0 7px rgba(255,224,122,${p}),0 0 40px 10px rgba(255,224,122,${0.35 * p})`,
      }}
    />
  );
};

export type Cam = { cx: number; cy: number; z: number };
/** 카메라 키를 따라 부드럽게(구간마다 EASE_IN_OUT) */
export const camAt = (f: number, keys: [number, Cam][]): Cam => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i += 1) {
    const [f1, c1] = keys[i];
    const [f0, c0] = keys[i - 1];
    if (f <= f1) {
      const p = interpolate(f, [f0, f1], [0, 1], { ...clamp, easing: EASE_IN_OUT });
      return { cx: lerp(c0.cx, c1.cx, p), cy: lerp(c0.cy, c1.cy, p), z: lerp(c0.z, c1.z, p) };
    }
  }
  return keys[keys.length - 1][1];
};

/** 실제 화면 판: 원본 그림(src 픽셀) 위의 한 점(cx,cy)을 판 가운데에 두고 z배로 보인다. children은 그림 좌표(픽셀)로 얹는다. */
export const Shot: React.FC<{
  src: string;
  w: number;
  h: number;
  box: { x: number; y: number; w: number; h: number };
  cam: Cam;
  radius?: number;
  bg?: string;
  stamp?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ src, w, h, box, cam, radius = 34, bg = C.screen, stamp, style, children }) => (
  <div
    style={{
      position: 'absolute',
      left: box.x,
      top: box.y,
      width: box.w,
      height: box.h,
      borderRadius: radius,
      background: bg,
      overflow: 'hidden',
      boxShadow: '0 0 0 1px rgba(10,10,10,.08),0 40px 80px -36px rgba(40,30,10,.55),0 14px 30px -18px rgba(40,30,10,.35)',
      ...style,
    }}
  >
    <div style={{ position: 'absolute', left: box.w / 2 - cam.cx * cam.z, top: box.h / 2 - cam.cy * cam.z, width: w, height: h, scale: String(cam.z), transformOrigin: '0 0' }}>
      <Img src={staticFile(src)} style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }} />
      {children}
    </div>
    {stamp ? (
      <span style={{ position: 'absolute', top: 18, right: 20, padding: '7px 13px', borderRadius: 9, font: `600 22px/1.2 ${F.ko}`, letterSpacing: '-.02em', color: 'rgba(255,255,255,.9)', background: 'rgba(0,0,0,.55)', boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.28)' }}>{stamp}</span>
    ) : null}
  </div>
);

const RING = 'M 30 60 C 30 15, 330 5, 380 50 C 420 95, 120 125, 40 95 C 10 85, 20 40, 60 30';
/** 크레용 동그라미: 상자(x,y,w,h — 얹는 좌표계)를 at부터 한 붓에 두른다. */
export const CrayonRing: React.FC<{ x: number; y: number; w: number; h: number; at: number; len?: number; id: string; color?: string; stroke?: number }> = ({ x, y, w, h, at, len = 12, id, color = C.crayon, stroke = 8 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + len], [0, 1], { ...clamp, easing: EASE_OUT });
  if (p <= 0) return null;
  const ev = evolvePath(p, RING);
  const padX = w * 0.16;
  const padY = h * 0.3;
  return (
    <svg width={w + 2 * padX} height={h + 2 * padY} viewBox="0 0 420 130" preserveAspectRatio="none" style={{ position: 'absolute', left: x - padX, top: y - padY, overflow: 'visible' }}>
      <defs>
        <filter id={`rough-${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={3} />
          <feDisplacementMap in="SourceGraphic" scale={4} />
        </filter>
      </defs>
      <path d={RING} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" vectorEffect="non-scaling-stroke" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} style={{ filter: `url(#rough-${id})` }} />
    </svg>
  );
};

/** 형광펜 띠(그림 좌표계 위, 곱하기로 글자 아래에 깔린 듯) */
export const Band: React.FC<{ x: number; y: number; w: number; h: number; at: number; len?: number; color?: string; opacity?: number }> = ({ x, y, w, h, at, len = 9, color = C.mark, opacity = 0.85 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + len], [0, 1], { ...clamp, easing: EASE_OUT });
  return <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, background: color, opacity, mixBlendMode: 'multiply', clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`, borderRadius: 6 }} />;
};

/** 질문 칩(종이 위): 번호 동그라미 + 짧은 말. on이면 노란 바탕. */
export const QChip: React.FC<{ n: string; label: string; at: number; on?: boolean; dim?: boolean; size?: number; style?: React.CSSProperties }> = ({ n, label, at, on, dim, size = 36, style }) => {
  const f = useCurrentFrame();
  const s = at <= 0 ? 1 : settle(f, at, 18);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: '13px 24px 13px 13px',
        borderRadius: 999,
        background: on ? C.mark : '#fff',
        color: C.ink,
        boxShadow: on ? '0 14px 30px -16px rgba(60,40,0,.45)' : `inset 0 0 0 2px ${C.hair},0 10px 24px -18px rgba(40,30,10,.4)`,
        font: `780 ${size}px/1 ${F.ko}`,
        letterSpacing: '-.035em',
        opacity: dim ? 0.42 : interpolate(s, [0, 0.35], [0, 1], clamp),
        scale: String(interpolate(s, [0, 1], [0.6, 1], clamp)),
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span style={{ width: size * 1.45, height: size * 1.45, borderRadius: '50%', display: 'grid', placeItems: 'center', background: C.ink, color: '#fff', font: `900 ${Math.round(size * 0.86)}px/1 ${F.ko}` }}>{n}</span>
      {label}
    </div>
  );
};

/** 체크 표시(초록 동그라미 + 체크가 그려짐) */
export const Check: React.FC<{ at: number; size?: number }> = ({ at, size = 58 }) => {
  const f = useCurrentFrame();
  const s = settle(f, at, 18);
  const d = interpolate(f, [at + 2, at + 10], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ flex: 'none', scale: String(interpolate(s, [0, 1], [0.4, 1], clamp)), opacity: interpolate(s, [0, 0.3], [0, 1], clamp) }}>
      <circle cx="20" cy="20" r="19" fill={C.ok} />
      <path d="M11 20.5l6 6 12-13" fill="none" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - d} />
    </svg>
  );
};

/** 결론 알약(흰 판): 앞말 → 결론 ✓ */
export const Pill: React.FC<{ x: number; y: number; w?: number; lead: string; result: React.ReactNode; at: number; check?: boolean }> = ({ x, y, w, lead, result, at, check = true }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, display: 'flex', alignItems: 'center', gap: 18, padding: '26px 30px', borderRadius: 28, background: C.ink, color: '#fff', boxShadow: '0 26px 50px -26px rgba(40,30,10,.6)', ...fadeUp(f, at, 34) }}>
      <span style={{ font: `700 40px/1.2 ${F.ko}`, color: 'rgba(255,255,255,.72)', letterSpacing: '-.035em', whiteSpace: 'nowrap' }}>{lead}</span>
      <span style={{ font: `800 42px/1 ${F.ko}`, color: C.mark }}>→</span>
      <span style={{ font: `850 50px/1.15 ${F.ko}`, letterSpacing: '-.04em', flex: 1, color: C.mark }}>{result}</span>
      {check ? <Check at={at + 6} /> : null}
    </div>
  );
};

/** 도장: 빨간 테 글자가 살짝 기울어 쿵 */
export const Stamp: React.FC<{ x: number; y: number; at: number; children: React.ReactNode; rotate?: number; size?: number }> = ({ x, y, at, children, rotate = -6, size = 44 }) => {
  const f = useCurrentFrame();
  const s = settle(f, at, 20);
  if (f < at) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        padding: '12px 22px',
        border: `6px solid ${C.crayon}`,
        borderRadius: 14,
        color: C.crayon,
        background: 'rgba(255,255,255,.92)',
        font: `900 ${size}px/1.1 ${F.ko}`,
        letterSpacing: '-.04em',
        rotate: `${rotate}deg`,
        scale: String(interpolate(s, [0, 1], [1.6, 1], clamp)),
        opacity: interpolate(s, [0, 0.25], [0, 1], clamp),
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  );
};

/** 큰 ✕(크레용 두 획) */
export const Cross: React.FC<{ x: number; y: number; size: number; at: number }> = ({ x, y, size, at }) => {
  const f = useCurrentFrame();
  const a = interpolate(f, [at, at + 5], [0, 1], { ...clamp, easing: EASE_OUT });
  const b = interpolate(f, [at + 4, at + 9], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute', left: x, top: y, overflow: 'visible' }}>
      <path d="M12 14 L88 86" stroke={C.crayon} strokeWidth={13} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - a} fill="none" />
      <path d="M86 12 L14 88" stroke={C.crayon} strokeWidth={13} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - b} fill="none" />
    </svg>
  );
};

/** 작은 출처 줄 */
export const Source: React.FC<{ y: number; children: React.ReactNode; at?: number }> = ({ y, children, at = 0 }) => {
  const f = useCurrentFrame();
  return <div style={{ position: 'absolute', left: L.X, right: L.X, top: y, font: `600 28px/1.35 ${F.ko}`, letterSpacing: '-.02em', color: C.muted, ...(at ? fadeUp(f, at, 14) : {}) }}>{children}</div>;
};

/** 위로 밀어 넘기는 전환(원본과 같은 셈): 나가는 장면은 끝 13→7프레임에 위로 가속하며 빠지고, 들어오는 장면은 5→12프레임에 아래에서 올라와 착지. */
export const Whip: React.FC<{ children: React.ReactNode; len: number; noIn?: boolean; noOut?: boolean }> = ({ children, len, noIn, noOut }) => {
  const f = useCurrentFrame();
  const pin = noIn ? 1 : interpolate(f, [5, 12], [0, 1], { ...clamp, easing: EASE_OUT });
  const pout = noOut ? 0 : interpolate(f, [len - 13, len - 7], [0, 1], { ...clamp, easing: (t) => t * t * t });
  const y = (1 - pin) * 520 - pout * 1600;
  const blur = (1 - pin) * 10 + pout * 10;
  const hidden = (!noIn && f < 5) || (!noOut && f >= len - 7);
  return <AbsoluteFill style={{ translate: `0 ${y}px`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined, opacity: hidden ? 0 : 1 }}>{children}</AbsoluteFill>;
};

/** 장면 전체 밀어 당기기(원본과 같은 값 — 프레임마다 0.08%, 1.12에서 멈춤). still부터는 멈춘다. */
export const Push: React.FC<{ children: React.ReactNode; still?: number }> = ({ children, still }) => {
  const f = useCurrentFrame();
  const ff = still === undefined ? f : Math.min(f, still);
  const z = 1 + Math.min(0.12, 0.0008 * ff);
  return <AbsoluteFill style={{ scale: String(z), transformOrigin: '50% 46%' }}>{children}</AbsoluteFill>;
};

/** 장 번호: 오른쪽 뒤에 크게 깔리는 숫자(질문 ① ② ③ 장 — v6, 지난 편들의 「위 제목 + 아래 카드」 짜임과 갈리게) */
export const BigNum: React.FC<{ n: string; at: number }> = ({ n, at }) => {
  const f = useCurrentFrame();
  const s = settle(f, at, 12);
  return (
    <div style={{ position: 'absolute', right: 40, top: 300, font: `900 760px/1 ${F.ko}`, letterSpacing: '-.06em', color: C.paperShade, opacity: interpolate(s, [0, 0.4], [0, 1], clamp), translate: `${(1 - s) * 80}px 0`, zIndex: 0 }}>{n}</div>
  );
};

/** 예 / 아니요: tap에 「예」가 눌린다(노랗게 차고 물결) — 스스로 고르는 진단 꼴 */
export const YesNo: React.FC<{ x: number; y: number; tap: number; at: number }> = ({ x, y, tap, at }) => {
  const f = useCurrentFrame();
  const show = settle(f, at, 18);
  const on = f >= tap;
  const press = interpolate(f, [tap - 2, tap, tap + 6], [1, 0.9, 1], clamp);
  const ring = interpolate(f, [tap, tap + 14], [0, 1], { ...clamp, easing: EASE_OUT });
  const btn = (label: string, active: boolean, dim: boolean): React.ReactNode => (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 170, height: 84, borderRadius: 999, font: `850 40px/1 ${F.ko}`, letterSpacing: '-.03em', background: active ? C.mark : '#fff', color: C.ink, boxShadow: active ? '0 16px 30px -18px rgba(60,40,0,.6)' : `inset 0 0 0 3px ${C.hair}`, opacity: dim ? 0.4 : 1, scale: active ? String(press) : '1' }}>
      {label}
      {active && ring < 1 ? <span style={{ position: 'absolute', inset: -10, borderRadius: 999, border: `5px solid rgba(255,190,40,${1 - ring})`, scale: String(1 + ring * 0.3) }} /> : null}
    </span>
  );
  return (
    <div style={{ position: 'absolute', left: x, top: y, display: 'flex', gap: 16, opacity: interpolate(show, [0, 0.3], [0, 1], clamp) }}>
      {btn('예', on, false)}
      {btn('아니요', false, on)}
    </div>
  );
};
