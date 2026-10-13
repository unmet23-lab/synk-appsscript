// 끝 장면(12박): 정답 다시 보기 → 댓글에 점수 → TOPIK 응원과 로고.
import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { BlurIn, clamp, EASE_IN_OUT, ramp } from '../lib/anim';
import { EN, KO, MONO } from '../lib/fonts';
import { Check } from './Art';
import { EXAM, HANDLE, QUESTIONS, RECAP } from './data';
import { C } from './theme';
import { E } from './timeline';

const CARD = { x: 72, y: 420, w: 920, h: 1060, pad: 64 };
const settle = (f: number, at: number, fps: number, len = 12) => spring({ frame: f - at, fps, config: { damping: 200 }, durationInFrames: len });

export const End: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = settle(f, 0, fps, 10);
  const swap = ramp(f, E.cheer - 4, 10, EASE_IN_OUT); // 다시 보기 → 응원으로 카드 내용이 바뀜
  const logoIn = settle(f, E.logo, fps, 12);
  const mascot = settle(f, E.logo + 6, fps, 10); // 튕김 없이 한 번 붙는다(마스코트 움직임은 최소)

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: CARD.x,
          top: CARD.y,
          width: CARD.w,
          height: CARD.h,
          borderRadius: 56,
          background: C.card,
          overflow: 'hidden',
          boxShadow: '0 60px 140px -40px rgba(30,20,10,0.35), 0 0 0 1px rgba(17,17,18,0.05)',
          scale: `${1.18 - 0.18 * enter}`,
          opacity: enter,
        }}
      >
        {/* 다시 보기 */}
        <div style={{ position: 'absolute', inset: 0, opacity: 1 - swap, translate: `0 ${-60 * swap}px`, filter: `blur(${12 * swap}px)` }}>
          <div style={{ position: 'absolute', left: CARD.pad, top: 56, font: `500 30px ${MONO}`, color: C.muted, letterSpacing: '0.04em' }}>RECAP</div>
          <div style={{ position: 'absolute', left: CARD.pad, right: CARD.pad, top: 112, font: `700 76px/1.06 ${EN}`, letterSpacing: '-0.035em', color: C.ink }}>
            <BlurIn text="How many did you get?" at={2} stagger={3} />
          </div>
          {QUESTIONS.map((q, i) => {
            const p = settle(f, E.recap[i], fps, 10);
            return (
              <div
                key={q.idiom}
                style={{
                  position: 'absolute',
                  left: CARD.pad,
                  right: CARD.pad,
                  top: 330 + i * 124,
                  height: 104,
                  borderRadius: 28,
                  background: '#F7F5F1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 22,
                  padding: '0 26px',
                  opacity: p,
                  translate: `0 ${(1 - p) * 30}px`,
                }}
              >
                <div style={{ width: 52, height: 52, borderRadius: 26, background: C.accent, display: 'grid', placeItems: 'center' }}>
                  <Check p={interpolate(f, [E.recap[i] + 2, E.recap[i] + 10], [0, 1], clamp)} color="#FFFFFF" size={30} />
                </div>
                <div style={{ font: `800 46px ${KO}`, letterSpacing: '-0.02em', color: C.ink }}>{q.idiom}</div>
                <div style={{ font: `500 34px ${EN}`, color: C.muted }}>=</div>
                <div style={{ font: `600 38px ${EN}`, color: C.accentInk, letterSpacing: '-0.02em' }}>{RECAP[i]}</div>
              </div>
            );
          })}
          <div style={{ position: 'absolute', left: CARD.pad, right: CARD.pad, top: 740 }}>
            <div style={{ font: `700 56px ${EN}`, letterSpacing: '-0.03em', color: C.ink, opacity: ramp(f, E.comment, 8) }}>
              <BlurIn text="Comment your score ↓" at={E.comment} stagger={3} />
            </div>
            <div style={{ display: 'flex', gap: 18, marginTop: 30 }}>
              {[0, 1, 2, 3].map((n) => {
                const p = settle(f, E.comment + 6 + n * 4, fps, 10);
                return (
                  <div
                    key={n}
                    style={{
                      width: 132,
                      height: 104,
                      borderRadius: 28,
                      display: 'grid',
                      placeItems: 'center',
                      font: `500 46px ${MONO}`,
                      color: n === 3 ? '#FFFFFF' : C.ink,
                      background: n === 3 ? C.accent : C.card,
                      boxShadow: n === 3 ? '0 20px 40px -16px rgba(249,104,89,0.6)' : `inset 0 0 0 2px ${C.hair}`,
                      opacity: p,
                      scale: `${0.9 + 0.1 * p}`,
                    }}
                  >
                    {n}/3
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 응원 + 로고 */}
        <div style={{ position: 'absolute', inset: 0, opacity: swap, translate: `0 ${60 * (1 - swap)}px` }}>
          <div style={{ position: 'absolute', left: CARD.pad, top: 120, font: `500 34px ${MONO}`, color: C.accentInk, letterSpacing: '0.04em' }}>
            {EXAM.date.toUpperCase()}
          </div>
          <div style={{ position: 'absolute', left: CARD.pad - 6, top: 176, font: `900 176px/0.98 ${EN}`, letterSpacing: '-0.05em', color: C.ink }}>
            <BlurIn text={EXAM.name.split(' ')[0]} at={E.cheer} stagger={0} rise={40} blur={20} />
            <br />
            <BlurIn text={EXAM.name.split(' ')[1]} at={E.cheer + 5} stagger={0} rise={40} blur={20} unit={() => ({ color: C.accent })} />
          </div>
          <div style={{ position: 'absolute', left: CARD.pad, top: 560, font: `700 62px ${EN}`, letterSpacing: '-0.03em', color: C.ink }}>
            <BlurIn text="You've got this." at={E.cheer + 12} stagger={3} />
          </div>
          <div style={{ position: 'absolute', left: CARD.pad, top: 646, font: `800 54px ${KO}`, color: C.muted, letterSpacing: '-0.02em' }}>
            <BlurIn text="화이팅!" at={E.cheer + 18} by="char" stagger={3} />
          </div>
          <div style={{ position: 'absolute', left: CARD.pad, bottom: 78, opacity: logoIn, translate: `0 ${(1 - logoIn) * 24}px` }}>
            <Img src={staticFile('img/logo-lab.webp')} style={{ height: 76, width: 'auto', display: 'block' }} />
            <div style={{ marginTop: 16, font: `500 30px ${MONO}`, color: C.muted }}>{HANDLE}</div>
          </div>
          <Img
            src={staticFile('img/mongle-cheer.webp')}
            style={{
              position: 'absolute',
              right: 40,
              bottom: 36,
              width: 300,
              height: 'auto',
              opacity: mascot > 0.01 ? 1 : 0,
              scale: `${0.6 + 0.4 * mascot}`,
              transformOrigin: '50% 100%',
              filter: 'drop-shadow(0 26px 30px rgba(0,0,0,0.22))',
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

