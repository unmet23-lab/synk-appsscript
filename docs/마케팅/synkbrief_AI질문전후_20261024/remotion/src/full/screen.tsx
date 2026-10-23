// 실제 ChatGPT 녹화 화면을 보여 주는 카드와 그 위 표시(빨간 테 · 노란 테 · ✕). 화면은 전부 ../화면/의 실제 프레임이고, 그림으로 다시 그린 것은 없다.
// 좌표는 모두 녹화 이미지 픽셀(가로 1080)이다. 카메라(cx, cy, z)는 카드 가운데에 올 이미지 점과 배율(1 = 가로 꽉 참).
import { evolvePath } from '@remotion/paths';
import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, EASE_IN_OUT, EASE_OUT } from '../lib/anim';
import { C, F } from '../theme';
import FRAMES from './frames.json';

// 카드 아래 끝 1380 — 키트 cover916 아래 안전선 1428 안(올리기 전 검사 ⑤ 「아래 앱 글자 자리」)
export const CARD = { x: 70, y: 452, w: 880, h: 928 };
export const S0 = CARD.w / 1080;
export type Cam = { cx: number; cy: number; z: number };
export type Key = { f: number; cam: Cam };

type Gen = { f: string; ms: number; y: number };
type Typ = { f: string; ms: number; tag: string };
export const FR = FRAMES as unknown as Record<'A' | 'B', { tall: [number, number]; typing: Typ[]; gen: Gen[] }>;
export const WIN_H = 1320;

/** 카메라 열쇠 프레임 사이를 부드럽게(가속·감속) 잇는다. drift는 머무는 동안에도 화면이 아주 조금씩 내려가게(프레임당 px) — 멈춘 화면 점검(tools/정지구간.js) 대비. */
export const camAt = (f: number, keys: Key[], drift = 0.25): Cam => {
  if (f <= keys[0].f) return keys[0].cam;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (f <= b.f) {
      const p = interpolate(f, [a.f, b.f], [0, 1], { ...clamp, easing: EASE_IN_OUT });
      return { cx: a.cam.cx + (b.cam.cx - a.cam.cx) * p, cy: a.cam.cy + (b.cam.cy - a.cam.cy) * p, z: a.cam.z + (b.cam.z - a.cam.z) * p };
    }
  }
  const last = keys[keys.length - 1];
  return { ...last.cam, cy: last.cam.cy + drift * (f - last.f) };
};

/** 화면 창: 이미지 한 장을 카메라대로 잘라 보여 주고, children(이미지 좌표의 표시)을 같이 움직인다. */
export const Screen: React.FC<{ src: string; imgH: number; cam: Cam; children?: React.ReactNode; box?: { x: number; y: number; w: number; h: number }; radius?: number }> = ({
  src,
  imgH,
  cam,
  children,
  box = CARD,
  radius = 40,
}) => {
  const s0 = box.w / 1080;
  const S = s0 * cam.z;
  const ox = Math.max(0, Math.min(1080 - box.w / S, cam.cx - box.w / 2 / S));
  const oy = Math.max(0, Math.min(imgH - box.h / S, cam.cy - box.h / 2 / S));
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        borderRadius: radius,
        overflow: 'hidden',
        background: '#0d0d0d',
        boxShadow: '0 0 0 2px rgba(255,255,255,.16),0 50px 90px -40px rgba(4,12,36,.75),0 18px 40px -24px rgba(4,12,36,.6)',
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: imgH, transformOrigin: '0 0', transform: `scale(${S}) translate(${-ox}px, ${-oy}px)` }}>
        <Img src={staticFile(src)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: imgH }} />
        {children}
      </div>
    </div>
  );
};

/** 녹화 프레임 고르기: start(영상 프레임)부터 speed배로 녹화 시각(ms)을 따라가며 그 시각까지 찍힌 마지막 프레임. fromMs부터 시작. */
export const pickGen = (k: 'A' | 'B', f: number, start: number, speed: number, fromMs: number) => {
  const ms = fromMs + ((f - start) / 30) * 1000 * speed;
  const list = FR[k].gen;
  let g = list[0];
  for (const x of list) if (x.ms <= ms) g = x;
  return g;
};

/** 지어낸 것: 빨간 크레용 동그라미(이미지 좌표). */
const RING = 'M 30 60 C 30 15, 330 5, 380 50 C 420 95, 120 125, 40 95 C 10 85, 20 40, 60 30';
export const Ring: React.FC<{ x: number; y: number; w: number; h: number; at: number; id: string; len?: number; padX?: number; padY?: number }> = ({ x, y, w, h, at, id, len = 12, padX = 46, padY = 34 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + len], [0, 1], { ...clamp, easing: EASE_OUT });
  if (p <= 0) return null;
  const ev = evolvePath(p, RING);
  return (
    <svg width={w + 2 * padX} height={h + 2 * padY} viewBox="0 0 420 130" preserveAspectRatio="none" style={{ position: 'absolute', left: x - padX, top: y - padY, overflow: 'visible' }}>
      <defs>
        <filter id={`rough-${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={3} />
          <feDisplacementMap in="SourceGraphic" scale={4} />
        </filter>
      </defs>
      <path d={RING} fill="none" stroke={C.crayon} strokeWidth={9} strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} style={{ filter: `url(#rough-${id})` }} />
    </svg>
  );
};

/** 메모 그대로인 것: 노란 테(이미지 좌표) — 안을 아주 옅게 칠해 줄이 떠 보이게. */
export const Mark: React.FC<{ x: number; y: number; w: number; h: number; at: number }> = ({ x, y, w, h, at }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 8], [0, 1], { ...clamp, easing: EASE_OUT });
  if (p <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 18,
        top: y - 10,
        width: (w + 36) * p,
        height: h + 20,
        borderRadius: 16,
        boxShadow: `inset 0 0 0 6px ${C.mark}`,
        background: 'rgba(255,224,122,.12)',
      }}
    />
  );
};

/** 내 말풍선 위의 큰 ✕(이미지 좌표 가운데 cx, cy). 두 획이 차례로 그어진다. */
export const Cross: React.FC<{ cx: number; cy: number; size: number; at: number }> = ({ cx, cy, size, at }) => {
  const f = useCurrentFrame();
  const a = interpolate(f, [at, at + 5], [0, 1], { ...clamp, easing: EASE_OUT });
  const b = interpolate(f, [at + 4, at + 9], [0, 1], { ...clamp, easing: EASE_OUT });
  const pop = interpolate(f, [at, at + 4, at + 10], [1.3, 1.08, 1], clamp);
  const L = 150;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute', left: cx - size / 2, top: cy - size / 2, overflow: 'visible', scale: String(pop) }}>
      <defs>
        <filter id="rough-x">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={5} />
          <feDisplacementMap in="SourceGraphic" scale={3} />
        </filter>
      </defs>
      <g style={{ filter: 'url(#rough-x)' }} stroke={C.crayon} strokeWidth={13} strokeLinecap="round" fill="none">
        <path d="M 14 14 L 86 86" strokeDasharray={L} strokeDashoffset={L * (1 - a)} />
        <path d="M 86 14 L 14 86" strokeDasharray={L} strokeDashoffset={L * (1 - b)} />
      </g>
    </svg>
  );
};

/** 카드 오른쪽 위 작은 알림(빨리 감기 등). */
export const Chip: React.FC<{ text: string; on: number; off: number }> = ({ text, on, off }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [on, on + 5, off - 5, off], [0, 1, 1, 0], clamp);
  if (o <= 0) return null;
  return (
    <span
      style={{
        position: 'absolute',
        top: CARD.y + 22,
        right: 1080 - CARD.x - CARD.w + 22,
        padding: '8px 14px',
        borderRadius: 10,
        background: 'rgba(0,0,0,.62)',
        boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.28)',
        font: `600 24px/1.1 ${F.ko}`,
        color: '#fff',
        opacity: o,
      }}
    >
      {text}
    </span>
  );
};

/** 밝게 남길 줄만 두고 나머지를 어둡게 누른다(이미지 좌표 띠 [위, 아래]). 이해 시험 v4 「어디가 지어낸 내용인지 눈으로 따라가기 어려웠다」. */
export const Spot: React.FC<{ bands: [number, number][]; imgH: number; at: number; dim?: number }> = ({ bands, imgH, at, dim = 0.58 }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [at, at + 8], [0, dim], clamp);
  if (o <= 0) return null;
  const sorted = [...bands].sort((a, b) => a[0] - b[0]);
  const gaps: [number, number][] = [];
  let y = 0;
  for (const [a, b] of sorted) {
    if (a > y) gaps.push([y, a]);
    y = Math.max(y, b);
  }
  if (y < imgH) gaps.push([y, imgH]);
  return (
    <>
      {gaps.map(([a, b], i) => (
        <div key={i} style={{ position: 'absolute', left: 0, width: 1080, top: a, height: b - a, background: `rgba(0,0,0,${o})` }} />
      ))}
    </>
  );
};

