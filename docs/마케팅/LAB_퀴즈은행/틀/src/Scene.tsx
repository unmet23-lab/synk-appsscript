// 장면 카드(v6) — 구운 장면 그림(4:3)을 큰 펠트 조각처럼 보여 준다. 멈춘 그림 한 장이 아니라 「그 장면 안의 사건」이 되게:
//   · 컷 여럿(shots): 같은 장면의 다음 순간을 구운 그림으로 넘긴다(넘어가는 순간 살짝 튄다 — 스톱모션의 한 걸음)
//   · 움직임(moves): 그림 한 장 안의 한 자리(몽글 · 친구 · 소품)를 부드러운 가장자리로 오려 제자리에서 움직인다 —
//     바탕은 같은 그림이라 떠 보이지 않는다(가장자리가 흐려 이음매가 없다). 늘 1배 이상으로만 키워 밑그림이 비치지 않게 한다.
//   · 첫 컷은 웃음이 있는 곳(focus)에서 한 장 전체로 빠진다.
//   · 손에 든 카메라처럼 아주 조금 떠다니고(±9px · ±0.3도) 천천히 다가간다 — 올리기 전 검사 ② 정지 구간: v6b는 38초 가운데 43%가 「거의 멈춤」이었다
//     (v5 25% · 만족 사례 S29 퀴즈 10%). 그림이 멈춘 채 글만 바뀌면 「정지 그림 카드 영상」으로 읽힌다.
// v5까지: 그림 한 장 + 천천히 밀기 — 볼 이유 심사 「정지 그림이라 임팩트라 하기 어렵다」, 미학 맹검 「멈춘 화면」.
import { noise2D } from '@remotion/noise';
import React from 'react';
import { Img, interpolate, spring, staticFile } from 'remotion';
import { clamp } from './anim';
import type { Move, Shot } from './episode';
import { B } from './timeline';
import { K, stitch } from './theme';

const RATIO = 4 / 3; // 구운 장면 칸(1024×768 안팎)
const AMP: Record<Move['kind'], number> = { squash: 0.14, hop: 3, bob: 0.8, rock: 2, shake: 1.2, grow: 0.12, tilt: 5 };

const moveStyle = (m: Move, t: number, fps: number, imgH: number): React.CSSProperties => {
  const [x, y, w, h] = m.box;
  const d = t - Math.round((m.at ?? 0) * B);
  const amp = m.amp ?? AMP[m.kind];
  const cx = x + w / 2;
  const cy = y + h / 2;
  const base = y + h;
  const px = (amp / 100) * imgH;
  const period = Math.max(1, Math.round((m.every ?? 2) * B));
  let transform = 'none';
  let origin = `${cx}% ${base}%`;
  if (m.kind === 'squash') {
    // 꼿꼿이 서 있다가 풀썩 꺼진다(구운 그림이 꺼진 모습 — 그 앞을 키워서 만든다)
    const s = d < 0 ? 0 : spring({ frame: d, fps, config: { damping: 9, stiffness: 170, mass: 0.7 } });
    transform = `scale(${1 + 0.2 * amp * Math.min(1, Math.max(0, s))}, ${Math.max(1, 1 + amp * (1 - s))})`;
  } else if (m.kind === 'hop') {
    const dd = m.every ? ((d % period) + period) % period : d;
    const k = d >= 0 && dd <= 10 ? Math.sin((Math.PI * dd) / 10) : 0;
    transform = `translateY(${-px * k}px) scale(${1 + 0.03 * k})`;
  } else if (m.kind === 'bob') {
    transform = `translateY(${px * Math.sin((2 * Math.PI * d) / period)}px) scale(1.025)`;
  } else if (m.kind === 'rock') {
    transform = `rotate(${amp * Math.sin((2 * Math.PI * d) / period)}deg) scale(1.035)`;
  } else if (m.kind === 'shake') {
    const k = d >= 0 ? Math.sin((2 * Math.PI * d) / 5) * Math.exp(-d / 9) : 0;
    transform = `translateX(${px * k}px) scale(${1 + 0.02 * Math.abs(k)})`;
  } else if (m.kind === 'grow') {
    const s = d < 0 ? 0 : spring({ frame: d, fps, config: { damping: 10, stiffness: 140, mass: 0.8 } });
    origin = `${cx}% ${cy}%`;
    transform = `scale(${1 + amp * s})`;
  } else if (m.kind === 'tilt') {
    const s = d < 0 ? 0 : spring({ frame: d, fps, config: { damping: 9, stiffness: 150, mass: 0.7 } });
    transform = `rotate(${amp * s}deg) scale(${1 + 0.03 * Math.min(1, Math.max(0, s))})`;
  }
  const mask = `radial-gradient(ellipse ${w / 2}% ${h / 2}% at ${cx}% ${cy}%, #000 60%, transparent 100%)`;
  return { position: 'absolute', inset: 0, WebkitMaskImage: mask, maskImage: mask, transform, transformOrigin: origin };
};

/** 컷이 시작하는 프레임(그 단계 시작 기준). */
export const shotStarts = (shots: Shot[], beat2: number) => shots.map((s, i) => Math.round((s.at ?? (i === 0 ? 0 : beat2 + (i - 1) * 2)) * B));

export const Scene: React.FC<{
  shots: Shot[]; moves?: Move[]; t: number; fps: number; x: number; y: number; w: number; h: number; beat2: number;
  pull?: boolean; radius?: number; style?: React.CSSProperties;
}> = ({ shots, moves = [], t, fps, x, y, w, h, beat2, pull = true, radius = 36, style }) => {
  const starts = shotStarts(shots, beat2);
  let idx = 0;
  starts.forEach((s, i) => { if (t >= s) idx = i; });
  const shot = shots[idx];
  const local = Math.max(0, t - starts[idx]);
  const focus = shot.focus ?? [50, 50];
  // 첫 컷: 웃음이 있는 곳에서 한 장 전체로 빠진다. 다음 컷: 넘어가는 순간 살짝 튄다. 그 뒤는 아주 천천히 다가간다.
  const enter = idx === 0 ? (pull ? interpolate(local, [0, 22], [1.42, 1], { ...clamp, easing: (p) => 1 - Math.pow(1 - p, 3) }) : 1) : 1 + 0.07 * Math.exp(-local / 3.5);
  const zoom = enter * (1.035 + 0.15 * Math.min(1, local / 150)); // v6f: 0.07 → 0.15(맹검 「8칸 내내 1픽셀도 안 움직이는 정지 그림」 — 다가감을 눈에 보이게)
  // 손에 든 카메라의 떠다님 — 씨앗이 그림 이름이라 프레임마다 같다
  const fx = 14 * noise2D(`x${shot.src}`, t / 36, 0); // v6f: 9 · 7 · 0.3 → 14 · 11 · 0.45
  const fy = 11 * noise2D(`y${shot.src}`, 0, t / 36);
  const fr = 0.45 * noise2D(`r${shot.src}`, t / 50, 7);
  const imgW = Math.max(w, h * RATIO);
  const imgH = imgW / RATIO;
  const left = (w - imgW) / 2;
  const top = Math.min(0, Math.max(h - imgH, h / 2 - (imgH * focus[1]) / 100));
  const src = staticFile(shot.src);
  const fit = `${focus[0]}% ${focus[1]}%`; // 4:3이 아닌 그림(끝 장면 2:1 칸 등)은 웃음이 있는 곳을 남기고 잘라 채운다
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: radius, overflow: 'hidden', background: K.cream, boxShadow: '0 14px 0 rgba(13, 20, 48, 0.26)', ...style }}>
      <div style={{ position: 'absolute', left, top, width: imgW, height: imgH, transform: `translate(${fx}px, ${fy}px) rotate(${fr}deg) scale(${zoom})`, transformOrigin: `${focus[0]}% ${focus[1]}%` }}>
        <Img src={src} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: fit }} />
        {moves.filter((m) => (m.shot ?? 0) === idx).map((m, i) => (
          <div key={i} style={moveStyle(m, t - starts[idx], fps, imgH)}>
            <Img src={src} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: fit }} />
          </div>
        ))}
      </div>
      <div style={stitch(12, 'rgba(255, 246, 220, 0.8)', Math.max(8, radius - 12))} />
    </div>
  );
};
