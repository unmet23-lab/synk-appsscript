// 문제 한 편(12박). 1마디: 화면을 꽉 채운 관용구와 글자 그대로의 함정. 2마디: 카드가 올라와 제목을 품고 보기·카운트다운.
// 3마디: 다운비트에 정답 → 그림·예문. 마지막 8프레임은 카메라 쪽으로 빨려 들어가며 다음 장면으로.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, interpolateColors, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BlurIn, clamp, EASE_IN_OUT, EASE_OUT, ramp, Ring } from '../lib/anim';
import { EN, KO, MONO } from '../lib/fonts';
import { Art, Check } from './Art';
import type { Question as Q } from './data';
import { C } from './theme';
import { T } from './timeline';

const CARD = { x: 72, y: 420, w: 920, h: 1060, pad: 64 };
const DY = 90; // 1마디 요소를 화면 가운데 쪽으로 내리는 거리
const BIG = 210; // 1마디 제목 크기
const SMALL = 128; // 카드 안 제목 크기

/** 튕김 없는 스프링(UI): 12프레임 안에 자리 잡는다. */
const settle = (f: number, at: number, fps: number, len = 12) =>
  spring({ frame: f - at, fps, config: { damping: 200 }, durationInFrames: len });

/** 제목 쾅: 0프레임에 이미 다 보이는 크기에서 제자리로(블러·페이드 없이). */
const slam = (f: number, at: number, fps: number, from = 1.1) => {
  const s = spring({ frame: f - at, fps, config: { damping: 20, stiffness: 220, mass: 0.6 } });
  return from - (from - 1) * s;
};

export const Question: React.FC<{ q: Q; index: number; total: number }> = ({ q, index, total }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── 카드 등장(2마디 첫 박) ──
  const rise = settle(f, T.card - 2, fps, 14);
  const morph = interpolate(f, [T.card - 2, T.card + 12], [0, 1], { ...clamp, easing: EASE_IN_OUT });

  // ── 빨려 들어가는 끝(다음 장면으로) ──
  const out = interpolate(f, [T.out, T.out + 8], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });

  // 제목: 1마디 큰 자리 → 카드 안 자리로 옮겨 가며 작아진다(같은 글자가 변형됨).
  const tScale = interpolate(morph, [0, 1], [1, SMALL / BIG]);
  const tx = interpolate(morph, [0, 1], [96, CARD.x + CARD.pad]);
  const ty = interpolate(morph, [0, 1], [560 + DY, CARD.y + 118]);
  const words = q.idiom.split(' ');

  // ── 1마디 요소(조각·오답·줄 긋기) ──
  const partsIn = [0, 1].map((i) => settle(f, T.parts + i * 4, fps, 10));
  const strike = ramp(f, T.strike, 7, EASE_OUT);
  const nope = slam(f, T.strike + 2, fps, 1.3);

  // ── 보기·카운트다운·정답 ──
  const optIn = T.options.map((t) => settle(f, t, fps, 12));
  const reveal = ramp(f, T.reveal, 6, EASE_OUT);
  const collapse = ramp(f, T.art, 10, EASE_IN_OUT);
  const correctIdx = q.options.findIndex((o) => o.correct);
  const ringP = interpolate(f, [T.count[0], T.reveal], [0, 1], clamp);
  const digit = f < T.count[1] ? 3 : f < T.count[2] ? 2 : 1;
  const tickAt = [...T.count].reverse().find((t) => f >= t) ?? T.count[0];
  const digitPop = 1 + 0.22 * Math.exp(-(f - tickAt) / 3);
  const ringShow = interpolate(f, [T.count[0] - 4, T.count[0], T.reveal, T.reveal + 8], [0, 1, 1, 0], clamp);

  // 정답 줄이 첫 칸으로 올라가는 거리(정답이 둘째·셋째 줄일 때)
  const ROW = 112;
  const GAP = 20;
  const lift = -correctIdx * (ROW + GAP) * collapse;

  return (
    <AbsoluteFill style={{ scale: `${1 + 0.6 * out}`, opacity: 1 - out, transformOrigin: '50% 45%' }}>
      {/* 0초 첫 줄: 무엇에 대한 영상인지(카드가 올라오면 사라짐) */}
      <div
        style={{
          position: 'absolute',
          left: 98,
          top: 500 + DY,
          font: `500 30px ${MONO}`,
          letterSpacing: '0.06em',
          color: C.accentInk,
          opacity: 1 - morph,
        }}
      >
        KOREAN IDIOM {String(index + 1).padStart(2, '0')}/{String(total).padStart(2, '0')} · TOPIK PREP
      </div>
      {/* 1마디: 조각 알약 + 글자 그대로의 오답 + 줄 긋기 */}
      <div style={{ position: 'absolute', left: 96, top: 830 + DY, display: 'flex', alignItems: 'center', gap: 22 }}>
        {q.parts.map(([ko, en], i) => (
          <React.Fragment key={ko}>
            {i > 0 ? (
              <span style={{ font: `400 48px ${EN}`, color: C.muted, opacity: partsIn[1] }}>+</span>
            ) : null}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 14,
                padding: '16px 30px',
                borderRadius: 999,
                background: C.card,
                boxShadow: `0 0 0 2px ${C.hair}, 0 18px 40px -22px rgba(0,0,0,0.35)`,
                opacity: partsIn[i],
                translate: `0 ${(1 - partsIn[i]) * 26}px`,
                scale: `${0.96 + 0.04 * partsIn[i]}`,
              }}
            >
              <span style={{ font: `800 46px ${KO}`, color: C.ink, letterSpacing: '-0.02em' }}>{ko}</span>
              <span style={{ font: `500 38px ${EN}`, color: C.muted }}>{en}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 96, top: 960 + DY, display: 'flex', alignItems: 'baseline', gap: 28 }}>
        <span style={{ position: 'relative', font: `700 78px ${EN}`, letterSpacing: '-0.035em', color: C.ink }}>
          <BlurIn text={`= ${q.guess}`} at={T.guess} stagger={3} rise={30} blur={16} />
          <span
            style={{
              position: 'absolute',
              left: -8,
              top: '52%',
              height: 12,
              borderRadius: 6,
              background: C.accent,
              width: strike > 0 ? `calc(${strike * 100}% + 16px)` : 0,
              rotate: '-2deg',
              transformOrigin: 'left center',
            }}
          />
        </span>
        <span style={{ font: `800 78px ${EN}`, color: C.accent, letterSpacing: '-0.035em', opacity: f >= T.strike + 2 ? 1 : 0, scale: `${nope}`, transformOrigin: 'left bottom' }}>
          Nope.
        </span>
      </div>

      {/* 2·3마디: 카드 */}
      <div style={{ position: 'absolute', inset: 0, perspective: 1800 }}>
        <div
          style={{
            position: 'absolute',
            left: CARD.x,
            top: CARD.y,
            width: CARD.w,
            height: CARD.h,
            borderRadius: 56,
            background: C.card,
            boxShadow: '0 60px 140px -40px rgba(30,20,10,0.35), 0 0 0 1px rgba(17,17,18,0.05)',
            opacity: rise > 0.001 ? 1 : 0,
            translate: `0 ${(1 - rise) * 820}px`,
            rotate: `x ${(1 - rise) * 22}deg`,
            scale: `${0.92 + 0.08 * rise}`,
            transformOrigin: '50% 0%',
          }}
        >
          {/* 위 줄: 번호 + 카운트다운 링 */}
          <div style={{ position: 'absolute', left: CARD.pad, top: 52, font: `500 30px ${MONO}`, color: C.muted, letterSpacing: '0.04em' }}>
            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </div>
          <div style={{ position: 'absolute', right: CARD.pad - 8, top: 30, width: 112, height: 112, opacity: ringShow }}>
            <Ring size={112} stroke={9} progress={ringP} color={C.accent} track="rgba(17,17,18,0.08)" />
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', font: `700 52px ${EN}`, color: C.ink, scale: `${digitPop}` }}>
              {digit}
            </div>
          </div>

          {/* 질문 */}
          <div style={{ position: 'absolute', left: CARD.pad, top: 290, font: `600 38px ${EN}`, color: C.muted, opacity: interpolate(f, [T.card + 6, T.card + 14, T.art, T.art + 8], [0, 1, 1, 0], clamp) }}>
            What does it really mean?
          </div>

          {/* 보기 셋 → 정답만 남아 위로 */}
          <div style={{ position: 'absolute', left: CARD.pad, right: CARD.pad, top: 360 }}>
            {q.options.map((o, i) => {
              const isC = o.correct;
              const wrongFade = isC ? 1 : 1 - 0.7 * reveal;
              const gone = isC ? 0 : collapse;
              const fill = isC ? reveal : 0;
              const punch = isC ? 1 + 0.035 * Math.max(0, 1 - Math.abs(f - T.reveal - 3) / 6) : 1;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: i * (ROW + GAP),
                    height: ROW,
                    borderRadius: 30,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 26,
                    padding: '0 28px 0 24px',
                    background: interpolateColors(fill, [0, 1], ['#F7F5F1', C.accent]),
                    boxShadow: isC && reveal > 0 ? `0 26px 60px -18px rgba(249,104,89,${0.55 * reveal}), 0 0 0 ${6 * reveal}px rgba(249,104,89,0.18)` : `inset 0 0 0 2px ${C.hair}`,
                    opacity: optIn[i] * wrongFade * (1 - gone),
                    translate: `${isC ? 0 : -14 * reveal}px ${(1 - optIn[i]) * 40 + (isC ? lift : 30 * gone)}px`,
                    scale: `${(0.96 + 0.04 * optIn[i]) * punch}`,
                  }}
                >
                  <div
                    style={{
                      width: 62,
                      height: 62,
                      flex: '0 0 62px',
                      borderRadius: 31,
                      display: 'grid',
                      placeItems: 'center',
                      font: `500 30px ${MONO}`,
                      background: isC ? interpolateColors(fill, [0, 1], ['transparent', '#FFFFFF']) : 'transparent',
                      color: isC ? interpolateColors(fill, [0, 1], [C.ink, C.accent]) : C.ink,
                      boxShadow: `inset 0 0 0 2px ${isC ? `rgba(17,17,18,${0.14 * (1 - fill)})` : 'rgba(17,17,18,0.14)'}`,
                    }}
                  >
                    {'ABC'[i]}
                  </div>
                  <div style={{ flex: 1, font: `600 40px ${EN}`, letterSpacing: '-0.02em', color: isC ? interpolateColors(fill, [0, 1], [C.ink, '#FFFFFF']) : C.ink }}>
                    {o.text}
                  </div>
                  {isC ? <Check p={interpolate(f, [T.reveal + 2, T.reveal + 11], [0, 1], clamp)} color="#FFFFFF" size={54} /> : null}
                </div>
              );
            })}
          </div>

          {/* 그림 + 예문 */}
          <Art kind={q.art} t={interpolate(f, [T.art, T.art + 30], [0, 1], clamp)} style={{ position: 'absolute', left: (CARD.w - 340) / 2, top: 492, width: 340, height: 234 }} />
          <div style={{ position: 'absolute', left: CARD.pad, right: CARD.pad, top: 752 }}>
            <div style={{ font: `800 46px/1.36 ${KO}`, letterSpacing: '-0.02em', color: C.ink, wordBreak: 'keep-all' }}>
              <Example text={q.example} at={T.example} f={f} />
            </div>
            <div style={{ marginTop: 14, font: `500 34px ${EN}`, color: C.muted }}>
              <BlurIn text={q.gloss} at={T.gloss} stagger={2} rise={16} blur={10} />
            </div>
            <SayIt q={q} f={f} fps={fps} />
          </div>
        </div>
      </div>

      {/* 제목(1마디 큰 자리 ↔ 카드 안) — 카드 위에 그린다 */}
      <div
        style={{
          position: 'absolute',
          left: tx,
          top: ty,
          transformOrigin: '0 0',
          scale: `${tScale * slam(f, T.title, fps, 1.08)}`,
          whiteSpace: 'nowrap',
          font: `900 ${BIG}px/1 ${KO}`,
          letterSpacing: '-0.045em',
          color: C.ink,
        }}
      >
        {words.map((w, i) => (
          <span key={w} style={{ display: 'inline-block', marginRight: i < words.length - 1 ? '0.26em' : 0 }}>
            {w}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 4마디 첫 박: 실제로 말할 때의 꼴(해요체)과 로마자 — 시청자가 바로 따라 해 볼 한 단계. */
const SayIt: React.FC<{ q: Q; f: number; fps: number }> = ({ q, f, fps }) => {
  const p = settle(f, T.say, fps, 10);
  const roman = ramp(f, T.say + 5, 8, EASE_OUT);
  return (
    <div
      style={{
        marginTop: 26,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 18,
        padding: '12px 26px 12px 14px',
        borderRadius: 999,
        background: C.ink,
        color: '#FFFFFF',
        opacity: p,
        translate: `0 ${(1 - p) * 24}px`,
        scale: `${0.94 + 0.06 * p}`,
        transformOrigin: 'left center',
      }}
    >
      <span style={{ padding: '6px 14px', borderRadius: 999, background: C.accent, font: `500 24px ${MONO}`, letterSpacing: '0.06em' }}>SAY IT</span>
      <span style={{ font: `800 40px ${KO}`, letterSpacing: '-0.02em' }}>{q.say[0]}</span>
      <span style={{ font: `500 28px ${MONO}`, color: 'rgba(255,255,255,0.7)', opacity: roman }}>{q.say[1]}</span>
    </div>
  );
};

/** 예문: 낱말마다 블러 인, [ ] 부분에는 코랄 형광펜이 왼쪽부터 그어진다. */
const Example: React.FC<{ text: string; at: number; f: number }> = ({ text, at, f }) => {
  const [a, b = '', c = ''] = text.split(/\[|\]/);
  const pen = ramp(f, at + 10, 10, EASE_OUT);
  const nA = a.trim() ? a.trim().split(/\s+/).length : 0;
  return (
    <>
      <BlurIn text={a} at={at} stagger={3} rise={20} blur={12} />
      <span
        style={{
          background: `linear-gradient(${C.accentSoft}, ${C.accentSoft}) no-repeat 0 82% / ${pen * 100}% 0.48em`,
          padding: '0 0.06em',
        }}
      >
        <BlurIn text={b} at={at + nA * 3} stagger={3} rise={20} blur={12} />
      </span>
      <BlurIn text={c} at={at + (nA + b.split(/\s+/).length) * 3} stagger={3} rise={20} blur={12} />
    </>
  );
};
