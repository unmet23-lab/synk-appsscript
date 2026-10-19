// 09 끝: 세션 공유 편 끝과 같은 프로필 카드(머리 긴 프로필 사진 · 핸들 · 채널 문구 · 팔로우 단추 · 흰 펠트 synk 로고 · 댓글칸).
// 「댓글로 알려 주세요」: 댓글칸에 불이 들어오고 커서가 깜빡인다(무엇을 쓸지는 보는 사람 몫이라 글은 치지 않는다).
// 말이 끝난 뒤 음악 끝맺음 박에 팔로우 단추가 「팔로잉 ✓」이 된다.
import React from 'react';
import { Img, staticFile, useCurrentFrame } from 'remotion';
import { DIM, INK } from '../film/parts';
import { EN, KO } from '../lib/fonts';
import { IN_OUT, OUT, prog } from '../lib/motion';
import { Headline, Shell, Swap, type Box } from '../full/kit';
import { PROFILE } from './data';
import { S, TOTAL, VO, wd } from './time';

const PANEL_END: Box = { x: 64, y: 600, w: 952, h: 720, r: 32 };
/** 팔로우 단추가 눌리는 프레임: 「팔로우하면」(세션 공유 편 줄). */
export const END_FOLLOW = wd('fo', 0) + 4;

export const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const drift = prog(f, S.s09 + 10, TOTAL - S.s09 - 10, IN_OUT);
  const hit = prog(f, END_FOLLOW - 1, 6, OUT) * (1 - prog(f, END_FOLLOW + 6, 12, IN_OUT));
  const s = (1 + 0.025 * drift) * (1 + 0.02 * hit);
  const a = prog(f, S.s09 + 4, 8, OUT);
  const lineA = (at: number) => prog(f, at, 8, OUT);
  const show = (at: number): React.CSSProperties => ({ opacity: lineA(at), transform: `translateY(${(1 - lineA(at)) * 8}px)` });
  const photo = prog(f, S.s09 + 4, 14, OUT);
  const base = S.s09 + 6;
  return (
    <>
      {f < VO.fo + 6 ? (
        <Headline
          lines={[
            [{ t: '제일', at: wd('cta', 5) }, { t: '기계', at: wd('cta', 6) }, { t: '같았던', at: wd('cta', 7) }, { t: '말,', at: wd('cta', 8) }],
            [{ t: '댓글로', at: wd('cta', 9), accent: wd('cta', 9) }, { t: '알려', at: wd('cta', 10) }, { t: '주세요', at: wd('cta', 11) }],
          ]}
          out={VO.fo - 6}
          top={300}
        />
      ) : null}
      {f >= VO.fo - 2 ? (
        <Headline
          lines={[
            [{ t: '팔로우하면', at: wd('fo', 0) }, { t: '다음', at: wd('fo', 1) }, { t: '도구도', at: wd('fo', 2) }],
            [{ t: '보여', at: wd('fo', 3) }, { t: '드릴게요', at: wd('fo', 4) }],
          ]}
          top={300}
        />
      ) : null}
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
            <CommentBox f={f} style={show(base + 6)} />
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

const CommentBox: React.FC<{ f: number; style: React.CSSProperties }> = ({ f, style }) => {
  const at = wd('cta', 9);
  const focus = prog(f, at, 6, OUT);
  const caretOn = f >= at && Math.floor((f - at) / 15) % 2 === 0;
  return (
    <div style={{ position: 'absolute', left: 40, top: 560, width: 872, height: 108, borderRadius: 54, background: '#121211', boxShadow: `inset 0 0 0 2px ${focus > 0 ? `rgba(244,242,236,${0.25 + 0.6 * focus})` : '#3A3935'}`, ...style }}>
      <svg width={42} height={42} viewBox="0 0 42 42" style={{ position: 'absolute', left: 32, top: 33 }}>
        <path d="M21 6 C30.5 6 37 12 37 19.5 C37 27 30.5 33 21 33 C18.6 33 16.4 32.6 14.4 31.9 L7 35 L8.8 28.6 C6.4 26.2 5 23 5 19.5 C5 12 11.5 6 21 6 Z" fill="none" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
      </svg>
      <div style={{ position: 'absolute', left: 96, top: 0, width: 700, height: 108, display: 'flex', alignItems: 'center' }}>
        {caretOn ? <span style={{ display: 'inline-block', width: 3, height: 40, marginLeft: 10, marginRight: 8, background: INK }} /> : <span style={{ display: 'inline-block', width: 21 }} />}
        <span style={{ fontFamily: KO, fontWeight: 520, fontSize: 32, color: '#6E6C66' }}>댓글 달기…</span>
      </div>
    </div>
  );
};
