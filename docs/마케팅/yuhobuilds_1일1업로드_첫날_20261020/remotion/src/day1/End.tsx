// 10 끝: 세션 공유·자동 DM 편 끝과 같은 프로필 카드(머리 긴 프로필 사진 · 핸들 · 채널 문구 · 팔로우 단추 · 흰 펠트 synk 로고).
// 이 편은 댓글 질문이 없어 댓글칸을 빼고, 「팔로우하면」에 팔로우 단추가 「팔로잉 ✓」이 된다.
import React from 'react';
import { Img, staticFile, useCurrentFrame } from 'remotion';
import { DIM, INK } from '../film/parts';
import { EN, KO } from '../lib/fonts';
import { IN_OUT, OUT, prog } from '../lib/motion';
import { Headline, Shell, Swap, type Box } from '../full/kit';
import { PROFILE } from './data';
import { S, TOTAL, wd } from './time';

const PANEL_END: Box = { x: 64, y: 640, w: 952, h: 540, r: 32 };
/** 팔로우 단추가 눌리는 프레임: 「팔로우하면」. */
export const END_FOLLOW = wd('fo', 0) + 4;

export const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const drift = prog(f, S.s10 + 10, TOTAL - S.s10 - 10, IN_OUT);
  const hit = prog(f, END_FOLLOW - 1, 6, OUT) * (1 - prog(f, END_FOLLOW + 6, 12, IN_OUT));
  const s = (1 + 0.025 * drift) * (1 + 0.02 * hit);
  const a = prog(f, S.s10 + 4, 8, OUT);
  const lineA = (at: number) => prog(f, at, 8, OUT);
  const show = (at: number): React.CSSProperties => ({ opacity: lineA(at), transform: `translateY(${(1 - lineA(at)) * 8}px)` });
  const photo = prog(f, S.s10 + 4, 14, OUT);
  const base = S.s10 + 6;
  return (
    <>
      <Headline
        lines={[
          [{ t: '팔로우하면', at: wd('fo', 0) }],
          [{ t: '다음', at: wd('fo', 1) }, { t: '편도', at: wd('fo', 2), accent: wd('fo', 2) }, { t: '보여', at: wd('fo', 3) }, { t: '드릴게요', at: wd('fo', 4) }],
        ]}
        top={300}
      />
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${s})`, transformOrigin: '540px 960px' }}>
        <Shell box={PANEL_END} dark={1}>
          <Swap inP={a}>
            <div style={{ position: 'absolute', left: 40, top: 40, width: 370, height: 460, borderRadius: '185px 185px 28px 28px', overflow: 'hidden', background: '#0B0B0A', boxShadow: 'inset 0 0 0 1px #2A2926' }}>
              <Img src={staticFile('img/yuho-profile.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '44% 30%', transform: `scale(${1.08 - 0.08 * photo})`, transformOrigin: '50% 40%' }} />
            </div>
            <div style={{ position: 'absolute', left: 446, top: 70, fontFamily: EN, fontWeight: 650, fontSize: 54, color: INK, letterSpacing: '-0.01em', ...show(base) }}>{PROFILE.handle}</div>
            <div style={{ position: 'absolute', left: 448, top: 148, fontFamily: KO, fontWeight: 600, fontSize: 28, color: DIM, ...show(base + 2) }}>{PROFILE.name}</div>
            <div style={{ position: 'absolute', left: 448, top: 206, fontFamily: KO, fontWeight: 650, fontSize: 32, color: '#D9D6CE', letterSpacing: '-0.02em', ...show(base + 4) }}>{PROFILE.bio}</div>
            <div style={{ position: 'absolute', left: 448, top: 254, fontFamily: KO, fontWeight: 520, fontSize: 27, color: '#8E8B84', ...show(base + 6) }}>{PROFILE.sub}</div>
            <FollowButton f={f} style={show(base + 8)} />
            <Img src={staticFile('img/logo-synk-paper.webp')} style={{ position: 'absolute', left: 446, top: 430, height: 56, ...show(base + 10) }} />
          </Swap>
        </Shell>
      </div>
    </>
  );
};

const FollowButton: React.FC<{ f: number; style: React.CSSProperties }> = ({ f, style }) => {
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
