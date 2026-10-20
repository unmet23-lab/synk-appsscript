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
import { B, T } from '../film/timeline';
import { K, panel, textSpan, toon } from './theme';
import { KIDS_ART, hostFor } from './art';
import { blinkSrc, hostBreath, literalMotion, meaningMotion } from './motion';
import { qStart } from '../film/timeline';
import { kidsUi, type KidsLang, type KidsUi } from './i18n';
import { Star } from './Cartoon';

const BOARD = { x: 70, y: 610, w: 940, h: 680 };
const BTN = { x: 40, w: 840, h: 138, gap: 26, top: 64 };
const BADGE = [K.butter, K.pop, K.sky];
const CONFETTI = [24, 36, 52]; // 문제마다 보상이 커진다

const pop = (f: number, at: number, fps: number) => spring({ frame: f - at, fps, config: { damping: 9, stiffness: 200, mass: 0.7 } });
/** v4 다음 문제 미리보기가 뜨는 박(13박 = 6.5초). 첫 편 시청 지속에서 첫 답 뒤 5.7~8.2초에 가장 많이 넘겼다 — 남을 이유를 하나 걸어 둔다. */
const TEASE = 13 * B;
/** 0프레임에도 보이게: 크게 시작해 살짝 작아졌다가 제자리(통통). */
const slamIn = (f: number, at: number, fps: number, from = 1.3) => {
  const s = spring({ frame: f - at, fps, config: { damping: 9, stiffness: 200, mass: 0.6 } });
  return from - (from - 1) * s;
};

/** stamp: 'center' = 첫 편처럼 NOPE를 그림 한가운데에 크게(2배에서 쾅). 'label' = v3(10-17) 오답 딱지 위에 작게 찍고 딱지에 취소선 — 그림 개그가 통째로 보인다.
 *  v4(10-17): artIndex = 이 문제의 그림 번호(순서를 바꾼 판), nextArt = 다음 문제 그림(마지막은 null → 점수 카드, undefined면 미리보기 없음),
 *  hook = 그림 개그를 0초부터, sayAt = SAY IT 프레임(나레이션 한국어 줄과 같은 박), yourTurn = SAY IT 뒤 따라 말할 차례 표시, shortOptions = 두 낱말 보기. */
export const KidsQuestion: React.FC<{
  q: Q; index: number; lang?: KidsLang; motion?: boolean; stamp?: 'center' | 'label';
  artIndex?: number; nextArt?: string | null; hook?: boolean; sayAt?: number; yourTurn?: boolean; shortOptions?: boolean;
  hookLine?: string; // 퀴즈 #4(10-20): 첫 문제 0초 도전 문구를 바꾼 판(영어판 「CREEPY KOREAN FACT」 — 트렌드 스캔 10-19 §4 추천 2의 0초 화면 시험). 어두운 알약에 버터색 큰 글자
}> = ({ q, index, lang = 'en', motion = false, stamp: stampAt = 'center', artIndex, nextArt, hook = false, sayAt, yourTurn = false, shortOptions = false, hookLine }) => {
  const ui = kidsUi(lang);
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ai = artIndex ?? index;
  const art = KIDS_ART[ai];
  const say0 = sayAt ?? T.say;
  const turn = yourTurn && f >= say0 + 2 * B;

  // 1마디
  const partsIn = pop(f, T.parts, fps);
  const litIn = hook ? 1 : pop(f, T.guess, fps);
  const nope = f >= T.strike ? slamIn(f, T.strike, fps, stampAt === 'label' ? 1.5 : 2.0) : 0;
  const strikeLine = stampAt === 'label' ? interpolate(f, [T.strike, T.strike + 4], [0, 1], clamp) : 0;
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

  const words = q.idiom.split(' ');
  // 제목은 190px가 기본, 「배꼽이 빠지다」처럼 긴 관용구는 화면 폭(약 980px)에 맞춰 줄인다(한글 한 자 ≈ 1em, 낱말 사이 0.25em).
  const titleEm = words.join('').length + 0.25 * (words.length - 1);
  const titleSize = Math.min(190, Math.floor(980 / titleEm));
  // 첫 프레임(훅)에 제목이 화면 밖으로 잘리지 않게, 긴 제목은 통통 튀는 시작 크기를 줄인다(짧은 제목은 1.3배 그대로).
  const titleFrom = Math.max(1.05, Math.min(1.3, 1040 / (titleSize * titleEm)));
  const titleScale = interpolate(morph, [0, 1], [1, 0.62]) * slamIn(f, T.title, fps, titleFrom);
  const titleTop = interpolate(morph, [0, 1], [440, 404]);
  // SAY IT 알약은 몽글 오른쪽(350px)에서 화면 끝까지 약 700px 안에 들게 줄인다(긴 해요체·로마자).
  const span = textSpan; // 10-18 일본어판 알약이 가나 폭을 못 세어 오른쪽으로 넘쳤다
  const labelW = Math.max(span(ui.sayIt), yourTurn ? span(ui.yourTurn) : 0) * 15;
  const koW = q.say[0].replace(/ /g, '').length * 44 + (q.say[0].split(' ').length - 1) * 13;
  const sayW1 = 28 + labelW + 14 + koW + 14 + span(q.say[1]) * 13.2 + 70;
  // 퀴즈 #4(10-20): 한 줄로 두면 0.8배 밑으로 줄어드는 긴 해요체(「간이 콩알만 해졌어요」 0.62배, 몽골어판 「간 떨어질 뻔했어요」 0.74배)는 읽는 법을 아랫줄로 내리고 26px로 키운다.
  const sayStack = 700 / sayW1 < 0.8;
  const sayW = sayStack ? 28 + labelW + 14 + Math.max(koW, span(q.say[1]) * 15.6) + 70 : sayW1;
  const sayFit = Math.min(1, 700 / sayW);
  const btnY = BOARD.y + BTN.top + correct * (BTN.h + BTN.gap) + BTN.h / 2;

  return (
    <AbsoluteFill>
      {/* 0초: 도전 문구(첫 문제에 hookLine이 있으면 그 글을 어두운 알약에 크게) */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 346, display: 'flex', justifyContent: 'center', opacity: 1 - morph }}>
        {index === 0 && hookLine ? (
          <div style={{ ...panel(999, 8, K.navy), border: `7px solid ${K.butter}`, padding: '5px 30px', marginTop: -6 }}>
            <span style={{ font: `900 50px ${EN}`, color: K.butter, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{hookLine}</span>
          </div>
        ) : (
          <div style={{ ...panel(999, 6, K.coral), padding: '6px 26px' }}>
            <span style={{ font: `900 34px ${EN}`, color: K.white, letterSpacing: '0.02em' }}>{ui.guess3}</span>
          </div>
        )}
      </div>

      {/* 1마디: 조각 알약(한 번에) */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 670, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, opacity: 1 - morph, scale: `${partsIn}` }}>
        {q.parts.map(([ko, en], i) => (
          <React.Fragment key={ko}>
            {i > 0 ? <span style={toon(56, { font: 'en' })}>+</span> : null}
            <div style={{ ...panel(999, 7), display: 'flex', alignItems: 'baseline', gap: 12, padding: '10px 28px' }}>
              <span style={{ font: `900 50px ${KO}`, color: K.navy, whiteSpace: 'nowrap' }}>{ko}</span>
              <span style={{ font: `800 40px ${EN}`, color: K.coral, whiteSpace: 'nowrap' }}>{en}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* 1마디: 글자 그대로의 펠트 그림 + 「??」 + NOPE! */}
      <div style={{ position: 'absolute', left: 190, top: 770, width: 700, height: 500, scale: `${litIn}`, opacity: 1 - morph }}>
        <Img src={staticFile(art.literal)} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 14px 0 rgba(27,42,90,0.30))', ...(motion ? literalMotion(ai, f, hook ? 4 : undefined) : {}) }} />
        <div style={{ position: 'absolute', right: -24, bottom: -4, ...panel(28, 8, K.butter), padding: '8px 22px', rotate: '6deg' }}>
          <span style={{ font: `900 46px ${EN}`, color: K.navy }}>{q.guess.replace('?', '??')}</span>
          {strikeLine ? <div style={{ position: 'absolute', left: 14, top: '50%', height: 9, marginTop: -4, width: `calc(${strikeLine * 100}% - 28px)`, borderRadius: 5, background: K.coral, border: `3px solid ${K.navy}` }} /> : null}
        </div>
        {nope && stampAt === 'label' ? (
          <div style={{ position: 'absolute', right: -84, bottom: -86, ...panel(26, 11, K.coral), padding: '6px 34px', rotate: '-8deg', scale: `${nope}` }}>
            <span style={toon(96, { font: 'en' })}>{ui.nope}</span>
          </div>
        ) : null}
      </div>
      {nope && stampAt === 'center' ? (
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
              <div style={{ flex: 1, font: `800 46px ${EN}`, letterSpacing: '-0.01em', color: isC ? interpolateColors(reveal, [0, 1], [K.navy, K.white]) : interpolateColors(reveal, [0, 1], [K.navy, '#8A93AE']) }}>{shortOptions && o.short ? o.short : o.text}</div>
              {isC && stamp ? (
                <div style={{ width: 96, height: 96, borderRadius: 48, border: `14px solid ${K.white}`, boxShadow: `0 0 0 6px ${K.navy}, inset 0 0 0 6px ${K.navy}`, scale: `${stamp}`, rotate: '-8deg' }} />
              ) : null}
            </div>
          );
        })}

        {/* 4마디: 진짜 뜻 펠트 그림(왼쪽, 세로로 긴 펠트 조각이 크게 보이게) + 말풍선 예문(오른쪽) */}
        <div style={{ position: 'absolute', left: 26, top: 224, width: 340, height: 432, scale: `${collapse > 0 ? pop(f, T.art + 2, fps) : 0}`, transformOrigin: '50% 70%' }}>
          <Img src={staticFile(art.meaning)} style={{ width: '100%', height: '100%', objectFit: 'contain', ...(motion ? meaningMotion(ai, f) : {}) }} />
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
      <div style={{ position: 'absolute', left: 0, right: 0, top: titleTop, display: 'flex', justifyContent: 'center', scale: `${titleScale}`, transformOrigin: '50% 0%', rotate: `${interpolate(slamIn(f, T.title, fps, titleFrom), [1, titleFrom], [0, -4])}deg` }}>
        <div style={{ whiteSpace: 'nowrap', ...toon(titleSize) }}>
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
      <div style={{ position: 'absolute', left: 350, top: 1352, ...panel(999, 10, K.navy), border: `7px solid ${K.white}`, boxShadow: `0 10px 0 ${K.navy}`, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 28px 12px 14px', whiteSpace: 'nowrap', scale: `${pop(f, say0, fps) * sayFit}`, transformOrigin: 'left center' }}>
        <span style={{ padding: '6px 14px', borderRadius: 999, background: K.coral, font: `${ui.monoFallback ? 700 : 500} 24px ${ui.monoFallback ? EN : MONO}`, color: K.white, letterSpacing: '0.06em', scale: `${turn ? 0.85 + 0.15 * pop(f, say0 + 30, fps) : 1}` }}>{turn ? ui.yourTurn : ui.sayIt}</span>
        {sayStack ? (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ font: `900 44px/1.1 ${KO}`, color: K.white }}>{q.say[0]}</span>
            <span style={{ font: `500 26px/1.1 ${ui.monoFallback ? EN : MONO}`, color: K.sky }}>{q.say[1]}</span>
          </span>
        ) : (
          <>
            <span style={{ font: `900 44px ${KO}`, color: K.white }}>{q.say[0]}</span>
            <span style={{ font: `500 22px ${ui.monoFallback ? EN : MONO}`, color: K.sky }}>{q.say[1]}</span>
          </>
        )}
      </div>

      {nextArt !== undefined && f >= TEASE ? <NextTease f={f} fps={fps} art={nextArt} ui={ui} motion={motion} /> : null}

      {/* 몽글 진행자 — 자리 고정, 표정만 컷 */}
      <Img src={staticFile(motion ? blinkSrc(hostFor(f, index), f, index) : hostFor(f, index))} style={{ position: 'absolute', left: 4, top: 1294, width: 316, height: 'auto', filter: 'drop-shadow(0 14px 0 rgba(27,42,90,0.35))', ...(motion ? hostBreath(f, qStart(index)) : {}) }} />
    </AbsoluteFill>
  );
};

/** 예문의 [ ] 부분을 버터 형광펜으로, 낱말은 통통 튀며 들어온다(제자리).
 *  퀴즈 #4(10-20): 형광펜 부분은 한 줄로 묶는다(nowrap) — 「천둥소리에 [간 떨어질 뻔했어요]!」가 「간 / 떨어질 뻔했어요」로 갈렸다. */
const Highlighted: React.FC<{ text: string; f: number }> = ({ text, f }) => {
  const { fps } = useVideoConfig();
  const [a, b = '', c = ''] = text.split(/\[|\]/);
  let k = -1;
  let key = 0;
  const words = (s: string, hl: boolean) =>
    s.split(/(\s+)/).filter((x) => x !== '').map((w) => {
      key += 1;
      if (/^\s+$/.test(w)) return <span key={key}>{w}</span>;
      k += 1;
      const sp = spring({ frame: f - T.example - k * 3, fps, config: { damping: 11, stiffness: 200, mass: 0.5 } });
      return (
        <span key={key} style={{ display: 'inline-block', scale: `${sp}`, background: hl ? K.butter : undefined, borderRadius: 10, padding: hl ? '0 6px' : undefined }}>
          {w}
        </span>
      );
    });
  return (
    <>
      {words(a, false)}
      <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>{words(b, true)}</span>
      {words(c, false)}
    </>
  );
};

/** v4 다음 문제 미리보기: 오른쪽 위(제목 옆 빈자리)에 작은 카드 — 다음 그림 개그 + 「??」, 마지막 문제는 점수 카드. 제자리에서 뜨고 박마다 살짝 튄다. */
const NextTease: React.FC<{ f: number; fps: number; art: string | null; ui: KidsUi; motion: boolean }> = ({ f, fps, art, ui, motion }) => {
  const s = spring({ frame: f - TEASE, fps, config: { damping: 10, stiffness: 190, mass: 0.6 } });
  const bob = motion ? Math.sin((Math.PI * ((f - TEASE) % B)) / B) : 0;
  return (
    <div style={{ position: 'absolute', left: 852, top: 372, width: 204, height: 222, ...panel(30, 9), rotate: '5deg', scale: `${s}`, translate: `0 ${-6 * bob}px` }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: -24, display: 'flex', justifyContent: 'center' }}>
        <div style={{ ...panel(999, 5, K.coral), padding: '4px 16px' }}>
          <span style={{ font: `800 24px ${EN}`, color: K.white, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{art ? ui.next : ui.scoreNext}</span>
        </div>
      </div>
      {art ? (
        <Img src={staticFile(art)} style={{ position: 'absolute', left: 14, top: 30, width: 176, height: 150, objectFit: 'contain' }} />
      ) : (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 52, display: 'flex', justifyContent: 'center', gap: 4 }}>
          {[0, 1, 2].map((i) => (
            <Star key={i} size={56} fill={1} />
          ))}
        </div>
      )}
      <div style={{ position: 'absolute', right: -14, bottom: -14, ...panel(20, 6, K.butter), padding: '2px 14px', rotate: '-6deg' }}>
        <span style={{ font: `900 38px ${EN}`, color: K.navy }}>{art ? '??' : '?/3'}</span>
      </div>
    </div>
  );
};
