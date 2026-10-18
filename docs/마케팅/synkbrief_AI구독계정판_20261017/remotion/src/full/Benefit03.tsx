// 03 회원 혜택: 16박 드롭에 「AI 구독 계정판」 혜택 머리(PC 창 배치, 펠트 계기판 포스터)가 내려앉고,
// 「PC 앱 · 회원 무료」 배지에 크레용 동그라미 하나. 판은 아주 천천히 다가온다(정지 없음).
import React from 'react';
import { interpolate, staticFile, useCurrentFrame } from 'remotion';
import { POSTER } from '../data';
import { clamp, ramp } from '../lib/anim';
import { L } from '../theme';
import { BoardZ, CaptionF, CrayonRing, FloatCard, HeadF, Lines, MarkF } from '../v5/cine';
import { at, T } from './time';

const W = 700; // PC 창의 혜택 머리 폭(css) — 640이면 카드 아래끝이 두 줄 자막(1281)에 닿아 앱의 더 넓은 창 배치로(Fable 10-18 2차)
const Z = (L.W - L.X - L.R) / W;
const TOP = 640;
// 배지 상자(화면 좌표) — 정지컷 실측
export const BADGE = { x: 362, y: 746, w: 158, h: 42 }; // 10-18 W 700에서 실측(흰 알약 363~518 × 748~787)

const arrowBack = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5m6-6-6 6 6 6" />
  </svg>
);

export const Benefit03: React.FC = () => {
  const f = useCurrentFrame();
  const drift = interpolate(f, [T, at('benefit', 22)], [1, 1.025], clamp);
  return (
    <>
      <HeadF left="synkbrief 활용" right="03" />
      <Lines at={T} size={72} top={L.TOP - 8} lines={[<>회원 무료 <MarkF key="m" p={ramp(f, at('benefit', 16.5), 12)}>AI 구독 계정판</MarkF></>]} />
      <div style={{ position: 'absolute', inset: 0, scale: String(drift), transformOrigin: `540px ${TOP + 300}px` }}>
        <FloatCard style={{ left: L.X, top: TOP, width: W * Z }}>
          <BoardZ width={W} scale={Z} desktop>
            <div style={{ padding: '10px 16px 18px' }}>
              <button type="button" className="ms-back">
                {arrowBack}회원 혜택 모두 보기
              </button>
              <header className="ms-hero has-art">
                <img className="ms-object" src={staticFile('app/benefit-subscriptions.webp')} alt="" />
                <div className="ms-hero-top">
                  <span className="ms-eyebrow">{POSTER.label}</span>
                  <span className="ms-badge is-integrated">
                    <span className="ms-led" aria-hidden="true" />
                    {POSTER.badge}
                  </span>
                </div>
                <div className="ms-hero-title">
                  <h1>{POSTER.word}</h1>
                  <p>
                    {POSTER.lines[0]}
                    <br />
                    {POSTER.lines[1]}
                  </p>
                </div>
                <div className="ms-hero-note">
                  <span>「지금 확인」을 누르면 연결한 계정을 한꺼번에 읽어요.</span>
                  <div className="ms-hero-actions">
                    <button type="button" className="ms-button ms-button-primary">
                      지금 확인
                    </button>
                    <button type="button" className="ms-button">
                      계정 연결
                    </button>
                  </div>
                </div>
              </header>
            </div>
          </BoardZ>
        </FloatCard>
        <CrayonRing id="badge" x={BADGE.x} y={BADGE.y} w={BADGE.w} h={BADGE.h} at={at('benefit', 18)} padX={14} padY={16} />
      </div>
      <CaptionF text="SYNK 회원 혜택, AI 구독 계정판이에요." em="AI 구독 계정판이에요." at={T + 2} />
    </>
  );
};
