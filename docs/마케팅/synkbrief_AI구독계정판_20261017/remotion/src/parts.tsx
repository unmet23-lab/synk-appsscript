// 장면 공용 부품: 색 면·흰 종이·머리줄·형광펜·커서·말자막·계정판 틀. 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import './board.css';
import { BlurIn, clamp, EASE_OUT, ramp, useSpring } from './lib/anim';
import { CRAYON_UNDER } from './lib/crayon';
import { BOARD_TOKENS, C, F, L } from './theme';

/** 청금석 색 면 + 펠트 결 + 실땀 네 모서리(kit .k-field.k-corners) */
export const Field: React.FC<{ children?: React.ReactNode; stitch?: number }> = ({ children, stitch = 1 }) => {
  const corner = 150;
  const mask = ['0 0', '100% 0', '0 100%', '100% 100%'].map((p) => `linear-gradient(#000 0 0) ${p}/${corner}px ${corner}px no-repeat`).join(',');
  return (
    <AbsoluteFill style={{ background: C.field, color: C.onField, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          opacity: 0.9,
          background: `radial-gradient(1100px 700px at 12% -160px,rgba(255,255,255,.16),rgba(255,255,255,0) 70%),radial-gradient(1200px 900px at 100% 115%,rgba(0,0,0,.2),rgba(0,0,0,0) 62%),url(${staticFile('kit/field-grain.webp')}) 0 0/192px 192px repeat`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 34,
          border: '1px solid transparent',
          borderImage: `url(${staticFile('kit/thread-lapis-soft.webp')}) 250 / 40px / 0 round`,
          WebkitMaskImage: undefined,
          mask,
          WebkitMask: mask,
          clipPath: `inset(0 ${(1 - stitch) * 100}% ${(1 - stitch) * 100}% 0)`,
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

export const Paper: React.FC<{ children?: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <AbsoluteFill style={{ background: '#fff', color: C.ink, overflow: 'hidden', ...style }}>{children}</AbsoluteFill>
);

export const Head: React.FC<{ left: string; right: string; onField?: boolean }> = ({ left, right, onField }) => (
  <div
    style={{
      position: 'absolute',
      left: L.X,
      right: L.R + 4,
      top: L.HEAD_Y,
      display: 'flex',
      justifyContent: 'space-between',
      font: `500 26px/1 ${F.mono}`,
      color: onField ? C.onField2 : C.muted,
    }}
  >
    <b style={{ fontWeight: 500, color: onField ? C.onField : C.ink }}>{left}</b>
    <span>{right}</span>
  </div>
);

/** 형광펜: 흰 종이는 노란 띠가 왼쪽부터, 색 면은 글자색 + 크레용 밑줄이 왼쪽부터 */
export const Mark: React.FC<{ children: React.ReactNode; p: number; onField?: boolean }> = ({ children, p, onField }) =>
  onField ? (
    <span style={{ position: 'relative', color: C.markField, whiteSpace: 'nowrap', zIndex: 0 }}>
      {children}
      <span
        style={{
          position: 'absolute',
          left: '-.04em',
          right: '-.04em',
          bottom: '-.12em',
          height: '.22em',
          zIndex: -1,
          background: C.markField,
          WebkitMask: `${CRAYON_UNDER} no-repeat center/100% 100%`,
          mask: `${CRAYON_UNDER} no-repeat center/100% 100%`,
          clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`,
        }}
      />
    </span>
  ) : (
    <span
      style={{
        whiteSpace: 'nowrap',
        background: `linear-gradient(${C.mark},${C.mark}) no-repeat 0 78%/${p * 100}% .42em`,
        padding: '0 .06em',
        margin: '0 -.03em',
      }}
    >
      {children}
    </span>
  );

/** 제목: 0프레임부터 읽히고, 살짝 크게 들어왔다 제자리(kinetic slam) */
export const Title: React.FC<{ children: React.ReactNode; size: number; at?: number; top?: number; onField?: boolean }> = ({ children, size, at = 0, top = L.TOP, onField }) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [at, at + 9], [1.07, 1], { ...clamp, easing: EASE_OUT });
  return (
    <h1
      style={{
        position: 'absolute',
        left: L.X,
        right: L.R,
        top,
        margin: 0,
        font: `900 ${size}px/${size >= 100 ? 1.1 : 1.14} ${F.ko}`,
        letterSpacing: '-.05em',
        color: onField ? C.onField : C.ink,
        transformOrigin: '0 0',
        scale: String(s),
      }}
    >
      {children}
    </h1>
  );
};

/** 말자막(kit kv-cap 흰 종이판): 아래끝 y 1416, 낱말마다 블러 인, 강조 낱말은 계정색 + 형광펜 */
export const Caption: React.FC<{ text: string; em: string; at: number }> = ({ text, em, at }) => {
  const f = useCurrentFrame();
  const [before, after] = text.split(em);
  const words = (s: string, k0: number) => <BlurIn text={s} at={at + k0 * 3} stagger={3} rise={26} blur={12} />;
  const emAt = at + before.split(/\s+/).filter(Boolean).length * 3;
  const band = ramp(f, emAt + 4, 10);
  return (
    <p style={{ position: 'absolute', left: L.X, right: L.R, bottom: L.H - L.CAP_BOTTOM, margin: 0, font: `800 60px/1.22 ${F.ko}`, letterSpacing: '-.03em', color: C.ink }}>
      {words(before, 0)}
      <span style={{ color: C.acc, background: `linear-gradient(${C.mark},${C.mark}) no-repeat 0 82%/${band * 100}% .36em` }}>
        <BlurIn text={em} at={emAt} stagger={3} rise={26} blur={12} />
      </span>
      {after ? words(after, before.split(/\s+/).filter(Boolean).length + em.split(/\s+/).length) : null}
    </p>
  );
};

/** 커서: path는 [프레임, x, y] 목록, click 프레임에 눌림 */
export const Cursor: React.FC<{ path: [number, number, number][]; click?: number; hideAfter?: number }> = ({ path, click, hideAfter }) => {
  const f = useCurrentFrame();
  const fr = path.map((p) => p[0]);
  const x = interpolate(f, fr, path.map((p) => p[1]), { ...clamp, easing: EASE_OUT });
  const y = interpolate(f, fr, path.map((p) => p[2]), { ...clamp, easing: EASE_OUT });
  const press = click === undefined ? 1 : interpolate(f, [click - 2, click, click + 5], [1, 0.82, 1], clamp);
  const opacity = interpolate(f, [fr[0], fr[0] + 4, ...(hideAfter ? [hideAfter, hideAfter + 6] : [])], [0, 1, ...(hideAfter ? [1, 0] : [])], clamp);
  const ring = click === undefined ? 0 : ramp(f, click, 16);
  return (
    <>
      {click !== undefined && f >= click && f < click + 18 ? (
        <div
          style={{
            position: 'absolute',
            left: x - 70,
            top: y - 70,
            width: 140,
            height: 140,
            borderRadius: '50%',
            border: `6px solid rgba(255,255,255,${0.9 * (1 - ring)})`,
            scale: String(0.3 + ring * 0.9),
            boxShadow: `0 0 0 3px rgba(10,10,10,${0.25 * (1 - ring)})`,
          }}
        />
      ) : null}
      <svg width="64" height="64" viewBox="0 0 24 24" style={{ position: 'absolute', left: x - 6, top: y - 4, opacity, scale: String(press), transformOrigin: '6px 4px', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.35))' }}>
        <path d="M5 3l14 8.5-6.2 1.3L9.6 19z" fill="#fff" stroke="#0a0a0a" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </>
  );
};

/** 계정판 틀: 실제 계정판 CSS(member-subs)를 휴대폰 폭 css로 그리고 scale배 키운다 */
export const Board: React.FC<{ width: number; scale: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ width, scale, children, style }) => (
  <div style={{ width: width * scale, height: 'auto', ...style }}>
    <div className="member-subs ms-phone" style={{ ...(BOARD_TOKENS as React.CSSProperties), width, maxWidth: 'none', margin: 0, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
      {children}
    </div>
  </div>
);

/** 실제 화면이라는 표시: 어두운 화면 판 + 날짜 도장(kit k-viewfinder 줄인 판) */
export const Screen: React.FC<{ top: number; height: number; children: React.ReactNode; stamp?: string; pad?: number }> = ({ top, height, children, stamp, pad = 26 }) => {
  const s = useSpring(0, { damping: 18, stiffness: 120 });
  return (
    <div
      style={{
        position: 'absolute',
        left: L.X,
        right: L.R,
        top,
        height,
        borderRadius: 32,
        background: C.screen,
        padding: pad,
        overflow: 'hidden',
        translate: `0 ${(1 - s) * 60}px`,
        boxShadow: '0 30px 60px -30px rgba(10,20,50,.45)',
      }}
    >
      {stamp ? (
        <span style={{ display: 'inline-block', marginBottom: 18, padding: '8px 16px', borderRadius: 10, font: `500 24px/1.2 ${F.mono}`, color: '#fff', boxShadow: 'inset 0 0 0 2px #6b7385' }}>{stamp}</span>
      ) : null}
      {children}
    </div>
  );
};

export const Logo: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '12px 20px', borderRadius: 16, background: '#fff', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.08),0 10px 20px -12px rgba(0,0,0,.55)', ...style }}>
    <Img src={staticFile('kit/logo-shift.webp')} style={{ height: 40, width: 'auto', display: 'block' }} />
  </span>
);
