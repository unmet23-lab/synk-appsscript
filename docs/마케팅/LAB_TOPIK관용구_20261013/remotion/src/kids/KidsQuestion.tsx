// 키즈판 문제 한 편(16박). 박자표(T)는 프리미엄판과 같다.
// 1마디: 통통 튀는 관용구 + 글자 그대로의 펠트 그림(커다란 손…) + NOPE! 도장
// 2마디: 퀴즈 판이 제자리에서 커지고 단추 셋 + 시간 막대 + 큰 숫자 3·2·1
// 3마디: 정답 단추가 눌리고 O 도장·색종이(문제마다 많아짐) · 4마디: 진짜 뜻 펠트 그림 + 말풍선 예문 + SAY IT
// 움직임은 제자리에서 커지기만 한다(화면을 가로지르지 않음). 몽글은 자리 고정, 표정만 컷.
import React from 'react';
import { AbsoluteFill, Img, interpolate, interpolateColors, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Burst, clamp, ramp } from '../lib/anim';
import { EN, KO, MONO } from '../lib/fonts';
import type { Question as Q } from '../film/data';
import { T } from '../film/timeline';
import { K, panel, toon } from './theme';
import { KIDS_ART, hostFor } from './art';
import { kidsUi, type KidsLang } from './i18n';

const BOARD = { x: 70, y: 610, w: 940, h: 680 };
const BTN = { x: 40, w: 840, h: 138, gap: 26, top: 64 };
const BADGE = [K.butter, K.pop, K.sky];
const CONFETTI = [24, 36, 52]; // 문제마다 보상이 커진다

const pop = (f: number, at: number, fps: number) => spring({ frame: f - at, fps, config: { damping: 9, stiffness: 200, mass: 0.7 } });
/** 0프레임에도 보이게: 크게 시작해 살짝 작아졌다가 제자리(통통). */
const slamIn = (f: number, at: number, fps: number, from = 1.3) => {
  const s = spring({ frame: f - at, fps, config: { damping: 9, stiffness: 200, mass: 0.6 } });
  return from - (from - 1) * s;
};

export const KidsQuestion: React.FC<{ q: Q; index: number; lang?: KidsLang }> = ({ q, index, lang = 'en' }) => {
  const ui = kidsUi(lang);
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const art = KIDS_ART[index];

  // 1마디
  const partsIn = pop(f, T.parts, fps);
  const litIn = pop(f, T.guess, fps);
  const nope = f >= T.strike ? slamIn(f, T.strike, fps, 2.0) : 0;
  // 2마디: 판이 제자리에서 커지고 제목은 위로 작아진다
  const board = spring({ frame: f - (T.card - 2), fps, config: { damping: 12, stiffness: 170, mass: 0.7 } });
  const morph = interpolate(f, [T.card - 2, T.card + 10], [0, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) });
  const optIn = T.options.map((t) => pop(f, t, fps));
  const timeLeft = interpolate(f, [T.count[0], T.reveal], [1, 0], clamp);
  // 3마디
  const reveal = ramp(f, T.reveal, 5);
  const collapse = ramp(f, T.art, 10);
  const correct = q.options.findIndex((o) => o.correct);
  const press = f >= T.reveal ? interpolate(f, [T.reveal, T.reveal + 3, T.reveal + 9], [0, 1, 0.6], clamp) : 0;
  const stamp = f >= T.reveal + 2 ? slamIn(f, T.reveal + 2, fps, 1.8) : 0;
  const digit = f < T.count[1] ? 3 : f < T.count[2] ? 2 : 1;
  const tickAt = [...T.count].reverse().find((t) => f >= t) ?? T.count[0];
  const digitPop = 1 + 0.35 * Math.exp(-(f - tickAt) / 3.5);
  const timerIn = interpolate(f, [T.count[0] - 6, T.count[0], T.reveal, T.reveal + 6], [0, 1, 1, 0], clamp);

  const titleScale = interpolate(morph, [0, 1], [1, 0.62]) * slamIn(f, T.title, fps);
  const titleTop = interpolate(morph, [0, 1], [440, 404]);
  const words = q.idiom.split(' ');
  const btnY = BOARD.y + BTN.top + correct * (BTN.h + BTN.gap) + BTN.h / 2;

  return (
    <AbsoluteFill>
      {/* 0초: 도전 문구 */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 346, display: 'flex', justifyContent: 'center', opacity: 1 - morph }}>
        <div style={{ ...panel(999, 6, K.coral), padding: '6px 26px' }}>
          <span style={{ font: `900 34px ${EN}`, color: K.white, letterSpacing: '0.02em' }}>{ui.guess3}</span>
        </div>
      </div>

      {/* 1마디: 조각 알약(한 번에) */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 670, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, opacity: 1 - morph, scale: `${partsIn}` }}>
        {q.parts.map(([ko, en], i) => (
          <React.Fragment key={ko}>
            {i > 0 ? <span style={toon(56, { font: 'en' })}>+</span> : null}
            <div style={{ ...panel(999, 7), display: 'flex', alignItems: 'baseline', gap: 12, padding: '10px 28px' }}>
              <span style={{ font: `900 50px ${KO}`, color: K.navy }}>{ko}</span>
              <span style={{ font: `800 40px ${EN}`, color: K.coral }}>{en}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* 1마디: 글자 그대로의 펠트 그림 + 「??」 + NOPE! */}
      <div style={{ position: 'absolute', left: 190, top: 770, width: 700, height: 500, scale: `${litIn}`, opacity: 1 - morph }}>
        <Img src={staticFile(art.literal)} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 14px 0 rgba(27,42,90,0.30))' }} />
        <div style={{ position: 'absolute', right: -24, bottom: -4, ...panel(28, 8, K.butter), padding: '8px 22px', rotate: '6deg' }}>
          <span style={{ font: `900 46px ${EN}`, color: K.navy }}>{q.guess.replace('?', '??')}</span>
        </div>
      </div>
      {nope ? (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 930, display: 'flex', justifyContent: 'center', opacity: 1 - morph }}>
          <div style={{ ...panel(30, 14, K.coral), padding: '14px 50px', rotate: '-10deg', scale: `${nope}` }}>
            <span style={toon(140, { font: 'en' })}>{ui.nope}</span>
          </div>
        </div>
      ) : null}

      {/* 2·3·4마디: 퀴즈 판(제자리에서 커짐) */}
      <div
        style={{
          position: 'absolute',
          left: BOARD.x,
          top: BOARD.y,
          width: BOARD.w,
          height: BOARD.h,
          ...panel(52, 16),
          opacity: Math.min(1, board * 3),
          scale: `${0.82 + 0.18 * board}`,
        }}
      >
        {/* 시간 막대 */}
        <div style={{ position: 'absolute', left: 40, right: 40, top: 22, height: 22, borderRadius: 11, background: '#E6EBF7', border: `4px solid ${K.navy}`, overflow: 'hidden', opacity: timerIn }}>
          <div style={{ width: `${timeLeft * 100}%`, height: '100%', background: K.butter }} />
        </div>
        {/* 색종이: 단추 뒤에서 터져 정답 글자를 가리지 않는다(판 좌표) */}
        <Burst at={T.reveal + 1} x={BOARD.w / 2} y={btnY - BOARD.y} colors={[K.coral, K.butter, K.meadow, K.pop, K.white]} seed={`kids${index}`} count={CONFETTI[index] ?? 36} spread={560 + index * 60} dur={40} />
        {q.options.map((o, i) => {
          const isC = i === correct;
          const gone = isC ? 0 : collapse;
          const lift = isC ? -correct * (BTN.h + BTN.gap) * collapse : 0;
          const bg = isC ? interpolateColors(reveal, [0, 1], [K.white, K.meadow]) : interpolateColors(reveal, [0, 1], [K.white, '#E3E7F1']);
          const depth = isC ? 12 - 9 * press : 12;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: BTN.x,
                top: BTN.top + i * (BTN.h + BTN.gap),
                width: BTN.w,
                height: BTN.h,
                borderRadius: 34,
                background: bg,
                border: `7px solid ${K.navy}`,
                boxShadow: `0 ${depth}px 0 ${K.navy}`,
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                padding: '0 30px 0 22px',
                opacity: Math.min(1, optIn[i] * 2) * (1 - gone),
                translate: `0 ${lift + (isC ? press * 9 : 0)}px`,
                scale: `${optIn[i] * (isC ? 1 : 1 - 0.05 * reveal)}`,
              }}
            >
              <div style={{ width: 82, height: 82, flex: '0 0 82px', borderRadius: 41, background: BADGE[i], border: `6px solid ${K.navy}`, display: 'grid', placeItems: 'center', font: `900 46px ${EN}`, color: K.navy }}>
                {'ABC'[i]}
              </div>
              <div style={{ flex: 1, font: `800 46px ${EN}`, letterSpacing: '-0.01em', color: isC ? interpolateColors(reveal, [0, 1], [K.navy, K.white]) : interpolateColors(reveal, [0, 1], [K.navy, '#8A93AE']) }}>{o.text}</div>
              {isC && stamp ? (
                <div style={{ width: 96, height: 96, borderRadius: 48, border: `14px solid ${K.white}`, boxShadow: `0 0 0 6px ${K.navy}, inset 0 0 0 6px ${K.navy}`, scale: `${stamp}`, rotate: '-8deg' }} />
              ) : null}
            </div>
          );
        })}

        {/* 4마디: 진짜 뜻 펠트 그림(왼쪽, 세로로 긴 펠트 조각이 크게 보이게) + 말풍선 예문(오른쪽) */}
        <div style={{ position: 'absolute', left: 26, top: 224, width: 340, height: 432, scale: `${collapse > 0 ? pop(f, T.art + 2, fps) : 0}`, transformOrigin: '50% 70%' }}>
          <Img src={staticFile(art.meaning)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ position: 'absolute', left: 384, right: 34, top: 244, ...panel(34, 10, '#FFF7DA'), padding: '20px 26px', scale: `${pop(f, T.example, fps)}`, transformOrigin: '0% 30%' }}>
          <div style={{ position: 'absolute', left: -22, top: 54, width: 34, height: 34, background: '#FFF7DA', borderLeft: `7px solid ${K.navy}`, borderBottom: `7px solid ${K.navy}`, rotate: '45deg' }} />
          <div style={{ font: `900 42px/1.3 ${KO}`, color: K.navy, wordBreak: 'keep-all', textWrap: 'balance' }}>
            <Highlighted text={q.example} f={f} />
          </div>
          <div style={{ marginTop: 10, font: `700 30px/1.25 ${EN}`, color: '#4A5680', textWrap: 'balance', opacity: ramp(f, T.gloss, 6) }}>{q.gloss}</div>
        </div>
      </div>

      {/* 카운트다운 숫자(제자리에서 통통) */}
      <div style={{ position: 'absolute', left: 860, top: 386, width: 150, height: 150, opacity: timerIn }}>
        <div style={{ position: 'absolute', inset: 0, ...panel(75, 10) }} />
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', scale: `${digitPop}` }}>
          <span style={{ font: `900 96px ${EN}`, color: K.navy }}>{digit}</span>
        </div>
      </div>

      {/* 제목 */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: titleTop, display: 'flex', justifyContent: 'center', scale: `${titleScale}`, transformOrigin: '50% 0%', rotate: `${interpolate(slamIn(f, T.title, fps), [1, 1.3], [0, -4])}deg` }}>
        <div style={{ whiteSpace: 'nowrap', ...toon(190) }}>
          {words.map((w, i) => (
            <span key={w} style={{ display: 'inline-block', marginRight: i < words.length - 1 ? '0.25em' : 0, color: i === 0 ? K.butter : K.white }}>
              {w}
            </span>
          ))}
        </div>
      </div>

      {/* 2마디: 질문 한 줄(보기가 떠 있는 동안) */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 550, display: 'flex', justifyContent: 'center', opacity: interpolate(f, [T.card, T.card + 6, T.reveal, T.reveal + 6], [0, 1, 1, 0], clamp) }}>
        <span style={toon(44, { font: 'en', stroke: 8, drop: 4 })}>{ui.question}</span>
      </div>

      {/* SAY IT */}
      <div style={{ position: 'absolute', left: 350, top: 1352, ...panel(999, 10, K.navy), border: `7px solid ${K.white}`, boxShadow: `0 10px 0 ${K.navy}`, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 28px 12px 14px', whiteSpace: 'nowrap', scale: `${pop(f, T.say, fps)}`, transformOrigin: 'left center' }}>
        <span style={{ padding: '6px 14px', borderRadius: 999, background: K.coral, font: `${ui.monoFallback ? 700 : 500} 24px ${ui.monoFallback ? EN : MONO}`, color: K.white, letterSpacing: '0.06em' }}>{ui.sayIt}</span>
        <span style={{ font: `900 44px ${KO}`, color: K.white }}>{q.say[0]}</span>
        <span style={{ font: `500 22px ${ui.monoFallback ? EN : MONO}`, color: K.sky }}>{q.say[1]}</span>
      </div>

      {/* 몽글 진행자 — 자리 고정, 표정만 컷 */}
      <Img src={staticFile(hostFor(f, index))} style={{ position: 'absolute', left: 4, top: 1294, width: 316, height: 'auto', filter: 'drop-shadow(0 14px 0 rgba(27,42,90,0.35))' }} />
    </AbsoluteFill>
  );
};

/** 예문의 [ ] 부분을 버터 형광펜으로, 낱말은 통통 튀며 들어온다(제자리). */
const Highlighted: React.FC<{ text: string; f: number }> = ({ text, f }) => {
  const { fps } = useVideoConfig();
  const [a, b = '', c = ''] = text.split(/\[|\]/);
  const words: { w: string; hl: boolean }[] = [
    ...a.split(/(\s+)/).filter((x) => x !== '').map((w) => ({ w, hl: false })),
    ...b.split(/(\s+)/).filter((x) => x !== '').map((w) => ({ w, hl: true })),
    ...c.split(/(\s+)/).filter((x) => x !== '').map((w) => ({ w, hl: false })),
  ];
  let k = -1;
  return (
    <>
      {words.map((x, i) => {
        if (/^\s+$/.test(x.w)) return <span key={i}>{x.w}</span>;
        k += 1;
        const s = spring({ frame: f - T.example - k * 3, fps, config: { damping: 11, stiffness: 200, mass: 0.5 } });
        return (
          <span key={i} style={{ display: 'inline-block', scale: `${s}`, background: x.hl ? K.butter : undefined, borderRadius: 10, padding: x.hl ? '0 6px' : undefined }}>
            {x.w}
          </span>
        );
      })}
    </>
  );
};
