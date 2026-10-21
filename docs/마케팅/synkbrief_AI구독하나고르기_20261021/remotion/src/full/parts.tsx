// 이 편의 부품(10-21 「AI 유료 구독」): 판(도장·카메라), 요금 카드·숫자 세기, 질문 칩, 체크 표시.
// 판·도장·인용·체크는 지난 편(메뉴판 AI 음식 사진) 것을 그대로 두고, 요금 카드·숫자 세기·질문 칩을 더했다.
// 무대·글자·밑줄·밀기는 v5/cine.tsx 그대로 쓴다.
import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, EASE_OUT } from '../lib/anim';
import { C, F } from '../theme';
import { settle } from '../v5/cine';

export const IMG = {
  googleCard: staticFile('img/google-aipro-card.png'), // 구글 원 요금 페이지 실제 화면(1080×1611, 2026-10-21 07:23 KST)
};

/** 요금 출처·확인일(화면 아래 작은 글) */
export const CREDIT = '각 회사 공식 요금 페이지 · 2026.10.21 확인';

/** 판 위 도장: 어두운 알약(기본) · 코랄(AI 생성 경고) · 흰(AI로 다듬음) */
export const Stamp: React.FC<{ children: React.ReactNode; tone?: 'dark' | 'ai' | 'light'; style?: React.CSSProperties; size?: number }> = ({ children, tone = 'dark', style, size = 24 }) => {
  const tones = {
    dark: { background: 'rgba(8,10,16,.72)', color: '#fff', boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.22)' },
    ai: { background: C.crayon, color: '#fff', boxShadow: '0 6px 16px -8px rgba(0,0,0,.5)' },
    light: { background: 'rgba(255,255,255,.92)', color: C.ink, boxShadow: '0 6px 16px -8px rgba(0,0,0,.4)' },
  } as const;
  return (
    <span style={{ position: 'absolute', zIndex: 3, padding: '8px 14px', borderRadius: 10, font: `700 ${size}px/1.15 ${F.ko}`, letterSpacing: '-.02em', whiteSpace: 'nowrap', ...tones[tone], ...style }}>
      {children}
    </span>
  );
};

/** 카메라: 판 안에서 사진을 z배로 당기고 초점(fx, fy · 사진 안 0~1)을 판 가운데로 옮긴다. 판을 늘 덮도록 끝을 묶는다. */
export type Cam = { z: number; fx: number; fy: number };
export const CAM0: Cam = { z: 1, fx: 0.5, fy: 0.5 };
const lerpN = (a: number, b: number, t: number) => a + (b - a) * t;
const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** 프레임 f에서의 카메라: keys는 [프레임, 카메라] 오름차순. 사이는 부드럽게 잇는다(늘 조금씩 움직이게 마지막 구간도 천천히 당긴다). */
export const camAt = (f: number, keys: [number, Cam][]): Cam => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [a, ca] = keys[i - 1];
    const [b, cb] = keys[i];
    if (f <= b) {
      const t = easeIO((f - a) / Math.max(1, b - a));
      return { z: lerpN(ca.z, cb.z, t), fx: lerpN(ca.fx, cb.fx, t), fy: lerpN(ca.fy, cb.fy, t) };
    }
  }
  return keys[keys.length - 1][1];
};
/** 켄 번스: 장면 길이 동안 z0 → z1로 쉬지 않고 당긴다(정지 구간을 없앤다 — tools/정지구간.js). */
export const kb = (f: number, len: number, z0: number, z1: number, fx = 0.5, fy = 0.5, fx1 = fx, fy1 = fy): Cam => {
  const t = interpolate(f, [0, len], [0, 1], clamp);
  return { z: lerpN(z0, z1, t), fx: lerpN(fx, fx1, t), fy: lerpN(fy, fy1, t) };
};

/** 사진 판: 3:2 사진을 둥근 판에(h를 주면 판 비율이 달라도 사진이 판을 덮는다).
 *  under를 주면 아래에 깔고, wipe(0~1)면 src가 왼쪽부터 덮이고, split(0~1)이면 왼쪽 under · 오른쪽 src(가운데 손잡이).
 *  cam은 두 사진과 inner(동그라미 등)에 똑같이 걸린다 — 겹친 판이 어긋나지 않는다. 자르는 선·도장(children)은 판에 고정. */
export const Photo: React.FC<{
  src: string;
  w: number;
  x: number;
  y: number;
  h?: number;
  under?: string;
  wipe?: number;
  split?: number;
  radius?: number;
  cam?: Cam;
  inner?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ src, w, x, y, h: hIn, under, wipe, split, radius = 30, cam = CAM0, inner, children, style }) => {
  const h = hIn ?? Math.round((w * 2) / 3);
  const iw = Math.max(w, h * 1.5);
  const ih = iw / 1.5;
  const offX = (w - iw) / 2;
  const offY = (h - ih) / 2;
  const z = Math.max(1, cam.z);
  let tx = w / 2 - offX - z * cam.fx * iw;
  let ty = h / 2 - offY - z * cam.fy * ih;
  tx = Math.min(-offX, Math.max(w - offX - z * iw, tx));
  ty = Math.min(-offY, Math.max(h - offY - z * ih, ty));
  const layer: React.CSSProperties = { position: 'absolute', left: offX, top: offY, width: iw, height: ih, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${z})` };
  const edge = under !== undefined && wipe !== undefined ? wipe : under !== undefined && split !== undefined ? split : undefined;
  const clip = edge === undefined ? undefined : split !== undefined ? `inset(0 0 0 ${edge * 100}%)` : `inset(0 ${(1 - edge) * 100}% 0 0)`;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: radius,
        overflow: 'hidden',
        background: '#0c0e13',
        boxShadow: '0 1px 0 rgba(255,255,255,.08) inset,0 0 0 1px rgba(255,255,255,.08),0 50px 90px -40px rgba(4,12,36,.75),0 18px 40px -24px rgba(4,12,36,.6)',
        ...style,
      }}
    >
      {under !== undefined ? (
        <div style={layer}>
          <Img src={under} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', inset: 0, clipPath: clip }}>
        <div style={layer}>
          <Img src={src} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
      </div>
      {inner ? <div style={layer}>{inner}</div> : null}
      {edge !== undefined && edge > 0.001 && edge < 0.999 ? (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${edge * 100}% - 2px)`, width: 4, background: '#fff', boxShadow: '0 0 18px rgba(0,0,0,.45)' }}>
          {split !== undefined ? (
            <span style={{ position: 'absolute', top: '50%', left: 2, translate: '-50% -50%', width: 46, height: 46, borderRadius: '50%', background: '#fff', boxShadow: '0 6px 16px rgba(0,0,0,.35)', display: 'grid', placeItems: 'center', font: `800 22px/1 ${F.ko}`, color: C.ink }}>
              ↔
            </span>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
};

/** 흰 인용 카드: 큰따옴표 글 + 출처 줄. 강조 부분은 노란 형광 밑칠이 왼쪽부터. */
export const Quote: React.FC<{ x: number; y: number; w: number; size?: number; parts: { t: string; em?: boolean }[]; who: string; p: number; markP: number }> = ({ x, y, w, size = 40, parts, who, p, markP }) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      padding: '34px 38px 30px',
      borderRadius: 28,
      background: '#fff',
      color: C.ink,
      boxShadow: '0 30px 60px -30px rgba(4,12,36,.7)',
      opacity: interpolate(p, [0, 0.4], [0, 1], clamp),
      translate: `0 ${(1 - p) * 40}px`,
    }}
  >
    <div style={{ font: `700 ${size}px/1.42 ${F.ko}`, letterSpacing: '-.035em' }}>
      “
      {parts.map((s, i) =>
        s.em ? (
          <span key={i} style={{ backgroundImage: `linear-gradient(${C.mark},${C.mark})`, backgroundRepeat: 'no-repeat', backgroundSize: `${markP * 100}% 42%`, backgroundPosition: '0 88%' }}>
            {s.t}
          </span>
        ) : (
          <span key={i}>{s.t}</span>
        ),
      )}
      ”
    </div>
    <div style={{ marginTop: 18, font: `500 26px/1.3 ${F.ko}`, color: C.muted, letterSpacing: '-.01em' }}>{who}</div>
  </div>
);

/** 체크(✓) 또는 엑스(✗) 동그라미: at에 튀어나온다. */
export const Mark: React.FC<{ ok: boolean; at: number; size?: number; style?: React.CSSProperties }> = ({ ok, at, size = 64, style }) => {
  const f = useCurrentFrame();
  const s = settle(f, at, 18);
  if (f < at) return null;
  return (
    <span
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: '50%',
        background: ok ? '#2fae6b' : C.crayon,
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        font: `900 ${size * 0.56}px/1 ${F.ko}`,
        scale: String(interpolate(s, [0, 1], [0.4, 1], clamp) * (1 + 0.18 * Math.sin(Math.min(1, (f - at) / 8) * Math.PI))),
        opacity: interpolate(s, [0, 0.3], [0, 1], clamp),
        boxShadow: '0 10px 24px -10px rgba(0,0,0,.5)',
        ...style,
      }}
    >
      {ok ? '✓' : '✗'}
    </span>
  );
};

/** 색 칩: 둥근 네모에 색 + 아래 이름 */
export const Chip: React.FC<{ color: string; label: string; size?: number; dim?: boolean }> = ({ color, label, size = 92, dim }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: dim ? 0.55 : 1 }}>
    <span style={{ width: size, height: size, borderRadius: 22, background: color, boxShadow: 'inset 0 0 0 3px rgba(255,255,255,.55),0 10px 22px -12px rgba(0,0,0,.5)' }} />
    <span style={{ font: `600 24px/1.1 ${F.ko}`, color: C.ink, letterSpacing: '-.02em' }}>{label}</span>
  </div>
);

/** 요청문 줄이 하나씩 타자되듯 나타난다(글자 수에 비례). 줄마다 [시작 프레임]. */
export const typed = (f: number, start: number, text: string, cps = 30) => {
  const n = Math.max(0, Math.floor(((f - start) / 30) * cps));
  return Array.from(text).slice(0, n).join('');
};

export const fadeUp = (f: number, a: number, dist = 26) => {
  const s = settle(f, a, 15);
  return { opacity: interpolate(s, [0, 0.45], [0, 1], clamp), translate: `0 ${(1 - s) * dist}px` } as const;
};

export const ease = (f: number, a: number, len: number) => interpolate(f, [a, a + len], [0, 1], { ...clamp, easing: EASE_OUT });

/** 숫자 세기: at부터 len프레임 동안 0 → value(감속). 자리 표시는 ko-KR(₩29,000). 다 센 뒤 2프레임 살짝 커진다. */
export const countText = (f: number, at: number, value: number, len = 14, prefix = '', suffix = '') => {
  const p = len <= 0 ? 1 : interpolate(f, [at, at + len], [0, 1], { ...clamp, easing: EASE_OUT });
  const n = Math.round(value * p);
  return `${prefix}${n.toLocaleString('ko-KR')}${suffix}`;
};
export const landPop = (f: number, at: number) => 1 + 0.06 * Math.max(0, 1 - Math.abs(f - at) / 5);

/** 요금 카드(흰 판): 회사 · 요금제 이름, 큰 값(숫자 세기), 단위, 아래 작은 줄. 실제 페이지 문구 그대로 옮긴다. */
export const PriceCard: React.FC<{
  x: number;
  y: number;
  w: number;
  h?: number;
  maker: string;
  plan: string;
  value: number;
  prefix: string;
  unit?: string;
  note?: string;
  at: number;
  countLen?: number;
  size?: number;
  stamp?: React.ReactNode;
  dim?: number;
  ring?: boolean;
  style?: React.CSSProperties;
}> = ({ x, y, w, h, maker, plan, value, prefix, unit = '/월', note, at, countLen = 14, size = 64, stamp, dim = 0, ring, style }) => {
  const f = useCurrentFrame();
  const s = settle(f, at - 4, 16);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        boxSizing: 'border-box',
        padding: '26px 28px 24px',
        borderRadius: 28,
        background: '#fff',
        color: C.ink,
        boxShadow: ring ? `0 0 0 6px ${C.mark},0 30px 60px -30px rgba(4,12,36,.7)` : '0 30px 60px -30px rgba(4,12,36,.7)',
        opacity: interpolate(s, [0, 0.4], [0, 1], clamp) * (1 - dim * 0.45),
        translate: `0 ${(1 - s) * 46}px`,
        ...style,
      }}
    >
      <div style={{ font: `600 25px/1.2 ${F.ko}`, color: C.muted, letterSpacing: '-.01em' }}>{maker}</div>
      <div style={{ marginTop: 6, font: `800 34px/1.15 ${F.ko}`, letterSpacing: '-.035em' }}>{plan}</div>
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
        <span style={{ font: `800 ${size}px/1 ${F.ko}`, letterSpacing: '-.04em', display: 'inline-block', scale: String(landPop(f, at - 4 + countLen)), transformOrigin: '0 80%', color: C.acc }}>
          {countText(f, at - 4, value, countLen, prefix)}
        </span>
        {unit ? <span style={{ font: `700 ${Math.round(size * 0.42)}px/1 ${F.ko}`, color: C.muted }}>{unit}</span> : null}
      </div>
      {note ? <div style={{ marginTop: 12, font: `600 23px/1.3 ${F.ko}`, color: C.muted, letterSpacing: '-.015em', wordBreak: 'keep-all' }}>{note}</div> : null}
      {stamp}
    </div>
  );
};

/** 질문 칩: 동그라미 번호 + 짧은 말. at에 튀어나온다. on이면 노란 바탕. */
export const QChip: React.FC<{ n: string; label: string; at: number; on?: boolean; style?: React.CSSProperties; size?: number }> = ({ n, label, at, on, style, size = 34 }) => {
  const f = useCurrentFrame();
  const s = settle(f, at, 18);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 22px 14px 14px',
        borderRadius: 999,
        background: on ? C.markField : 'rgba(255,255,255,.14)',
        color: on ? C.ink : '#fff',
        boxShadow: on ? '0 14px 30px -16px rgba(0,0,0,.5)' : 'inset 0 0 0 2px rgba(255,255,255,.35)',
        font: `750 ${size}px/1 ${F.ko}`,
        letterSpacing: '-.03em',
        opacity: interpolate(s, [0, 0.35], [0, 1], clamp),
        scale: String(interpolate(s, [0, 1], [0.6, 1], clamp)),
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span style={{ width: size * 1.45, height: size * 1.45, borderRadius: '50%', display: 'grid', placeItems: 'center', background: on ? C.ink : '#fff', color: on ? '#fff' : C.field, font: `900 ${Math.round(size * 0.9)}px/1 ${F.ko}` }}>{n}</span>
      {label}
    </div>
  );
};

/** 결론 알약(흰 판): 화살표 → 결론. at에 올라온다. */
export const Verdict: React.FC<{ x: number; y: number; w?: number; lead: string; result: React.ReactNode; at: number; ok?: boolean }> = ({ x, y, w, lead, result, at, ok = true }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, display: 'flex', alignItems: 'center', gap: 16, padding: '20px 26px', borderRadius: 24, background: '#fff', color: C.ink, boxShadow: '0 22px 44px -24px rgba(4,12,36,.65)', ...fadeUp(f, at, 30) }}>
      <span style={{ font: `650 32px/1.25 ${F.ko}`, color: C.muted, letterSpacing: '-.03em', whiteSpace: 'nowrap' }}>{lead}</span>
      <span style={{ font: `800 34px/1 ${F.ko}`, color: C.acc }}>→</span>
      <span style={{ font: `800 36px/1.2 ${F.ko}`, letterSpacing: '-.035em', flex: 1 }}>{result}</span>
      {ok ? <Mark ok at={at + 8} size={52} style={{ position: 'relative', flex: 'none' }} /> : null}
    </div>
  );
};
