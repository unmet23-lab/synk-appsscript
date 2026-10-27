// 실제 ChatGPT 녹화 화면을 보여 주는 카드와 그 위 표시(노란 테 · 누르기 · 밀어 넘기기). 화면은 전부 ../화면/의 실제 프레임이고, 그림으로 다시 그린 것은 없다.
// 좌표는 모두 녹화 이미지 픽셀(가로 1080)이다. 카메라(cx, cy, z)는 카드 가운데에 올 이미지 점과 배율(1 = 가로 꽉 참).
import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, EASE_IN_OUT, EASE_OUT } from '../lib/anim';
import { C, F } from '../theme';

// 카드 아래 끝 1380 — 키트 cover916 아래 안전선 1428 안(올리기 전 검사 ⑤ 「아래 앱 글자 자리」)
export const CARD = { x: 70, y: 452, w: 880, h: 928 };
export type Cam = { cx: number; cy: number; z: number };
export type Key = { f: number; cam: Cam };
export type Box = { x: number; y: number; w: number; h: number };

/** 녹화 프레임 높이(가로 1080 기준) */
export const H = { phone: 2341, room: 1618, empty: 1620 };

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

/** 화면 창: 이미지 한 장을 카메라대로 잘라 보여 주고, children(이미지 좌표의 표시)을 같이 움직인다. clip은 왼쪽부터 보이는 몫(0~1, 밀어 넘기기). */
export const Screen: React.FC<{ src: string; imgH: number; cam: Cam; children?: React.ReactNode; box?: Box; radius?: number; clip?: number }> = ({
  src,
  imgH,
  cam,
  children,
  box = CARD,
  radius = 40,
  clip = 1,
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
        clipPath: clip < 1 ? `inset(0 ${(1 - clip) * 100}% 0 0 round ${radius}px)` : undefined,
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: imgH, transformOrigin: '0 0', transform: `scale(${S}) translate(${-ox}px, ${-oy}px)` }}>
        <Img src={staticFile(src)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: imgH }} />
        {children}
      </div>
    </div>
  );
};

/** 밀어 넘기기의 경계선(카드 좌표). p = 왼쪽부터 넘어간 몫. */
export const WipeEdge: React.FC<{ p: number; box?: Box }> = ({ p, box = CARD }) => {
  if (p <= 0 || p >= 1) return null;
  return <div style={{ position: 'absolute', left: box.x + box.w * p - 3, top: box.y, width: 6, height: box.h, background: '#fff', boxShadow: '0 0 24px rgba(255,255,255,.7)', borderRadius: 3 }} />;
};

/** 짚는 것: 노란 테(이미지 좌표) — 안을 아주 옅게 칠해 떠 보이게. */
export const Mark: React.FC<Box & { at: number; r?: number }> = ({ x, y, w, h, at, r = 16 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 8], [0, 1], { ...clamp, easing: EASE_OUT });
  if (p <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 14,
        top: y - 10,
        width: (w + 28) * p,
        height: h + 20,
        borderRadius: r,
        boxShadow: `inset 0 0 0 6px ${C.mark}`,
        background: 'rgba(255,224,122,.12)',
      }}
    />
  );
};

/** 단추 누르기: 하얀 고리가 퍼진다(이미지 좌표 가운데 cx, cy). */
export const Tap: React.FC<{ cx: number; cy: number; at: number; r?: number }> = ({ cx, cy, at, r = 52 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 12], [0, 1], { ...clamp, easing: EASE_OUT });
  if (f < at || p >= 1) return null;
  const s = 0.7 + 0.9 * p;
  return (
    <div
      style={{
        position: 'absolute',
        left: cx - r,
        top: cy - r,
        width: 2 * r,
        height: 2 * r,
        borderRadius: '50%',
        boxShadow: `0 0 0 8px ${C.mark}`,
        opacity: 1 - p,
        scale: String(s),
      }}
    />
  );
};

/** 밝게 남길 줄만 두고 나머지를 어둡게 누른다(이미지 좌표 띠 [위, 아래]). */
export const Spot: React.FC<{ bands: [number, number][]; imgH: number; at: number; dim?: number }> = ({ bands, imgH, at, dim = 0.55 }) => {
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

/** 카드 오른쪽 위 작은 알림. */
export const Chip: React.FC<{ text: string; on: number; off: number; box?: Box }> = ({ text, on, off, box = CARD }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [on, on + 5, off - 5, off], [0, 1, 1, 0], clamp);
  if (o <= 0) return null;
  return (
    <span
      style={{
        position: 'absolute',
        top: box.y + 22,
        right: 1080 - box.x - box.w + 22,
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
