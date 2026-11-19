// 해 질 녘 네 벌 — 밤새 고쳐 구운 거의 같은 사진 넷이 구운 시각과 함께 놓이고,
// 노란 테가 마지막 벌에서 거꾸로 훑어 와 맨 처음 벌에 멈춘다(마지막 심사가 고른 판).
import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, mix, OUT } from '../lib/motion';
import { BUTTER, INK, SUNSET } from './data';

export type SunsetTimes = {
  /** 벌마다 놓이는 초(4개) */
  put: number[];
  /** 노란 테가 마지막 벌에 처음 서는 초 */
  scan: number;
  /** 한 칸 건너가는 데 드는 초 */
  hop: number;
  /** 맨 처음 벌에 앉는 초(나머지가 흐려짐) */
  land: number;
};

const TILE = 418;
const GAP = 26;
const LEFT = (1080 - (TILE * 2 + GAP)) / 2;
export const GRID_TOP = 572; // 아래 이름표가 앱 글자 자리(1428px) 위에 오게(올리기 전 검사 r6)
export const tilePos = (i: number) => ({ x: LEFT + (i % 2) * (TILE + GAP), y: GRID_TOP + Math.floor(i / 2) * (TILE + GAP) });

const ease = (t: number, a: number, len: number) => interpolate(t, [a, a + len], [0, 1], { ...clamp, easing: OUT });

/** 테가 서 있는 벌 번호(0 = 처음 벌). 테가 없으면 -1. */
const frameAt = (t: number, h: SunsetTimes) => {
  if (t < h.scan) return -1;
  if (t >= h.land) return 0;
  const k = Math.floor((t - h.scan) / h.hop);
  return Math.max(1, 3 - k);
};

export const Sunset: React.FC<{ t: number; h: SunsetTimes; big?: boolean; dimTo?: number; liftTo?: number }> = ({ t, h, big, dimTo = 0.32, liftTo = 0.06 }) => {
  const at = frameAt(t, h);
  const landed = t >= h.land ? ease(t, h.land, 0.3) : 0;
  const hit = t >= h.land ? Math.max(0, 1 - (t - h.land) / 0.28) : 0;
  return (
    <AbsoluteFill>
      {SUNSET.map((s, i) => {
        const p = ease(t, h.put[i], 0.3);
        const { x, y } = tilePos(i);
        const dim = i === 0 ? 0 : landed;
        const lift = i === 0 ? landed : 0;
        const sc = mix(0.92, 1, p) * (1 + liftTo * lift + 0.02 * hit * (i === 0 ? 1 : 0));
        // 벌마다 제각각 천천히 움직임(최종본 검사 r1 「구간굳음 · 굳음」 — 사진 속 사람이 멎어 보이지 않게, 벌마다 다른 박자라 카메라 움직임으로 걷히지 않는다)
        const kb = { s: 1.16 + 0.03 * Math.sin(t * 0.9 + i * 1.7), // 확대 여유가 움직임 폭보다 커야 가장자리 빈틈이 안 난다(r13)
           x: 26 * Math.sin(t * 1.8 + i * 2.1), y: 18 * Math.cos(t * 1.5 + i * 0.9) };
        return (
          <div
            key={s.img}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: TILE,
              height: TILE,
              opacity: p * mix(1, dimTo, dim),
              transform: `scale(${sc}) translateY(${(1 - p) * 30}px)`,
              transformOrigin: i === 0 ? '100% 100%' : '50% 50%',
              zIndex: i === 0 ? 2 : 1,
              filter: `saturate(${mix(1, 0.25, dim)})`,
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
            }}
          >
            <Img src={staticFile(`img/${s.img}.jpg`)} style={{ width: TILE, height: TILE, objectFit: 'cover', transform: `translate(${kb.x}px, ${kb.y}px) scale(${kb.s})` }} />
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 200, background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.72) 45%, rgba(0,0,0,0.92) 100%)' }} />
            {/* 장면 심사(11-19) 「밤 10:38 사진에 햇빛 — 시각과 안 맞음」: 사진 속 때가 아니라 구운 시각임을 글로 */}
            <div style={{ position: 'absolute', left: 22, bottom: 64, fontFamily: KO, fontWeight: 800, fontSize: 40, letterSpacing: -1, color: i === 0 ? BUTTER : INK }}>{i === 0 ? '처음 그림' : '고친 그림'}</div>
            <div style={{ position: 'absolute', left: 22, bottom: 16, fontFamily: KO, fontWeight: 700, fontSize: big ? 42 : 40, letterSpacing: -1, color: INK }}>{s.when}에 만듦</div>
          </div>
        );
      })}
      {at >= 0 &&
        (() => {
          const { x, y } = tilePos(at);
          const grow = at === 0 ? 1 + liftTo * landed + 0.02 * hit : 1;
          return (
            <div
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: TILE,
                height: TILE,
                zIndex: 3,
                border: `${at === 0 ? 12 : 8}px solid ${BUTTER}`,
                borderRadius: 12,
                transform: `scale(${grow})`,
                transformOrigin: '100% 100%',
                boxSizing: 'border-box',
              }}
            />
          );
        })()}
    </AbsoluteFill>
  );
};
