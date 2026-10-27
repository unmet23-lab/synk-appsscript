// 끝: 10-20 첫날 편 v8 끝 카드 그대로(프로필 · 팔로우 단추). 머리글은 줄 단위 등장, 판 내용은 흐림 없이 들어온다.
// Y5(10-25) → Y9(10-26) → v2 → v3 → Y19(10-28)에서 복사 — 시각은 Timing으로 받는다(./time).
import React from 'react';
import { Img, staticFile, useCurrentFrame } from 'remotion';
import { DIM, INK } from '../film/parts';
import { EN, KO } from '../lib/fonts';
import { IN_OUT, OUT, prog } from '../lib/motion';
import { Shell, type Box } from '../full/kit';
import { PROFILE } from '../day1/data';
import { type Timing, wd } from './time';
import { Line } from '../y9/Type';

const PANEL_END: Box = { x: 64, y: 640, w: 952, h: 540, r: 32 };
/** 팔로우 단추가 눌리는 프레임: 「팔로우하면」. */
export const endFollow = (t: Timing) => wd('fo', 0, t) + 4;

export const EndCard: React.FC<{ t: Timing }> = ({ t }) => {
  const f = useCurrentFrame();
  const S = { end: t.end };
  const TOTAL = t.total;
  const END_FOLLOW = endFollow(t);
  const drift = Math.min(1, Math.max(0, (f - S.end) / (TOTAL - S.end))); // v2: 끝까지 같은 빠르기(올리기 전 검사 ② 정지 구간)
  const hit = prog(f, END_FOLLOW - 1, 6, OUT) * (1 - prog(f, END_FOLLOW + 6, 12, IN_OUT));
  const s = (1 + 0.16 * drift) * (1 + 0.02 * hit); // v3: 0.07은 끝 카드 3초가 통째로 정지로 잡혀 올리기 전 검사 ②(15%)를 혼자 12% 먹었다
  const a = prog(f, S.end, 8, OUT);
  const lineA = (at: number) => prog(f, at, 8, OUT);
  const show = (at: number): React.CSSProperties => ({ opacity: lineA(at), transform: `translateY(${(1 - lineA(at)) * 8}px)` });
  const photo = prog(f, S.end, 14, OUT);
  const base = S.end + 2;
  return (
    <>
      <Line lines={['팔로우하면', '다음 편도 보여 드릴게요']} accent="팔로우하면" at={wd('fo', 0, t) - 3} />
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${s})`, transformOrigin: '540px 960px' }}>
        <Shell box={PANEL_END} dark={1}>
          <div style={{ position: 'absolute', inset: 0, opacity: a }}>
            <div style={{ position: 'absolute', left: 40, top: 40, width: 370, height: 460, borderRadius: '185px 185px 28px 28px', overflow: 'hidden', background: '#0B0B0A', boxShadow: 'inset 0 0 0 1px #2A2926' }}>
              <Img src={staticFile('img/yuho-profile.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '44% 30%', transform: `scale(${1.08 - 0.08 * photo})`, transformOrigin: '50% 40%' }} />
            </div>
            <div style={{ position: 'absolute', left: 446, top: 70, fontFamily: EN, fontWeight: 650, fontSize: 54, color: INK, letterSpacing: '-0.01em', ...show(base) }}>{PROFILE.handle}</div>
            <div style={{ position: 'absolute', left: 448, top: 148, fontFamily: KO, fontWeight: 600, fontSize: 28, color: DIM, ...show(base + 2) }}>{PROFILE.name}</div>
            <div style={{ position: 'absolute', left: 448, top: 206, fontFamily: KO, fontWeight: 650, fontSize: 32, color: '#D9D6CE', letterSpacing: '-0.02em', ...show(base + 4) }}>{PROFILE.bio}</div>
            <div style={{ position: 'absolute', left: 448, top: 254, fontFamily: KO, fontWeight: 520, fontSize: 27, color: '#8E8B84', ...show(base + 6) }}>{PROFILE.sub}</div>
            <FollowButton f={f} at={END_FOLLOW} style={show(base + 8)} />
            <Img src={staticFile('img/logo-synk-paper.webp')} style={{ position: 'absolute', left: 446, top: 430, height: 56, ...show(base + 10) }} />
          </div>
        </Shell>
      </div>
    </>
  );
};

const FollowButton: React.FC<{ f: number; at: number; style: React.CSSProperties }> = ({ f, at: END_FOLLOW, style }) => {
  const press = prog(f, END_FOLLOW, 3, OUT) * (1 - prog(f, END_FOLLOW + 3, 6, OUT));
  const on = f >= END_FOLLOW + 3;
  return (
    <div style={{ position: 'absolute', left: 446, top: 318, width: 252, height: 72, ...style }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 18,
          background: on ? '#2A2926' : '#F4F2EC',
          transform: `scale(${1 - 0.06 * press})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          fontFamily: KO,
          fontWeight: 680,
          fontSize: 31,
          letterSpacing: '-0.02em',
          color: on ? INK : '#121211',
        }}
      >
        {on ? (
          <>
            팔로잉
            <svg width={26} height={20} viewBox="0 0 26 20">
              <path d="M3 10 L10 17 L23 3" fill="none" stroke={INK} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        ) : (
          '팔로우'
        )}
      </div>
    </div>
  );
};
