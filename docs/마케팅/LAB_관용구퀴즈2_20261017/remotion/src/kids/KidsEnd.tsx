// 키즈판 끝: STAGE CLEAR! → 별 셋 + 복습(관용구·뜻) → 점수 댓글 → 연재 이름 + 화이팅 + 진행자 몽글 + 로고.
// 댓글 화면은 나레이션 「Drop your score below!」(끝 54프레임)부터 「See you next round!」(97프레임) 앞까지 보인다.
import React from 'react';
import { AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Burst, ramp } from '../lib/anim';
import { EN, MONO } from '../lib/fonts';
import { QUESTIONS } from '../film/data';
import { B, E } from '../film/timeline';
import { HOST_END } from './art';
import { hostBreath } from './motion';
import { END_START } from '../film/timeline';
import { kidsRecap, kidsUi, type KidsLang } from './i18n';
import { Star } from './Cartoon';
import { K, panel, textSpan, toon } from './theme';

/** 키즈판 끝 구간의 자리(끝 시작에서 프레임). 별 셋(E.recap)과 로고(E.logo)는 프리미엄판과 같다. */
export const KE = { comment: Math.round((10 / 3) * B), cheer: Math.round(6.4 * B) } as const; // 120 BPM에서 50·96프레임 — 템포가 바뀌면 박 단위로 같이 늘어난다

const pop = (f: number, at: number, fps: number) => spring({ frame: f - at, fps, config: { damping: 10, stiffness: 190, mass: 0.6 } });
const settle = (f: number, at: number, fps: number, len = 10) => spring({ frame: f - at, fps, config: { damping: 200 }, durationInFrames: len });

export const KidsEnd: React.FC<{ lang?: KidsLang; motion?: boolean; order?: number[]; handle?: string }> = ({ lang = 'en', motion = false, order = [0, 1, 2], handle }) => {
  const ui = kidsUi(lang);
  const recap = kidsRecap(lang);
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const swap = ramp(f, KE.cheer - 4, 8);

  return (
    <AbsoluteFill>
      {/* 1부: 클리어 + 별 셋(복습) + 댓글 */}
      <AbsoluteFill style={{ opacity: 1 - swap, scale: `${1 - 0.08 * swap}` }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 410, display: 'flex', justifyContent: 'center', scale: `${pop(f, 0, fps)}`, rotate: '-3deg' }}>
          <span style={toon(Math.min(132, Math.floor(1000 / (textSpan(ui.stageClear) * 0.62))), { font: 'en', color: K.butter })}>{ui.stageClear}</span>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 590, display: 'flex', justifyContent: 'center', gap: 10 }}>
          {E.recap.map((t, i) => (
            <div key={i} style={{ width: 250, display: 'flex', flexDirection: 'column', alignItems: 'center', scale: `${pop(f, t, fps)}` }}>
              <div style={{ rotate: `${(i - 1) * 10}deg`, translate: `0 ${i === 1 ? -24 : 0}px` }}>
                <Star size={180} />
              </div>
              <span style={{ marginTop: 6, ...toon(40) }}>{QUESTIONS[order[i]].idiom}</span>
              <span style={{ marginTop: 4, maxWidth: 240, textAlign: 'center', textWrap: 'balance', ...toon(30, { font: 'en', color: K.butter, stroke: 6, drop: 3 }) }}>{recap[order[i]]}</span>
            </div>
          ))}
        </div>
        <Burst at={E.recap[2] + 1} x={540} y={690} colors={[K.coral, K.butter, K.meadow, K.pop, K.white]} seed="kidsend" count={50} spread={640} dur={42} />
        <div style={{ position: 'absolute', left: 90, right: 90, top: 940, ...panel(40, 14), padding: '26px 36px 30px', scale: `${pop(f, KE.comment - 2, fps)}` }}>
          <div style={{ font: `900 46px/1.15 ${EN}`, color: K.navy }}>{ui.howMany}</div>
          <div style={{ display: 'flex', gap: 18, marginTop: 20 }}>
            {[0, 1, 2, 3].map((n) => (
              <div key={n} style={{ ...panel(26, 8, n === 3 ? K.butter : K.sky), width: 150, height: 92, display: 'grid', placeItems: 'center', scale: `${pop(f, KE.comment + 2 + n * 3, fps)}` }}>
                <span style={{ font: `900 44px ${EN}`, color: K.navy }}>{n}/3</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 22, font: `900 ${ui.commentSize}px/1.1 ${EN}`, color: K.coral, opacity: ramp(f, KE.comment + 6, 5) }}>{ui.comment}</div>
        </div>
      </AbsoluteFill>

      {/* 2부: 연재 이름 + 화이팅 + 진행자 몽글 + 로고 */}
      <AbsoluteFill style={{ opacity: swap }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ ...panel(999, 8, K.coral), padding: '8px 30px', scale: `${pop(f, KE.cheer, fps)}` }}>
            <span style={{ font: `${ui.monoFallback ? 700 : 500} 34px ${ui.monoFallback ? EN : MONO}`, color: K.white, letterSpacing: '0.06em' }}>{ui.exam}</span>
          </div>
          <div style={{ marginTop: 18, scale: `${pop(f, KE.cheer + 4, fps)}`, rotate: '-4deg' }}>
            <span style={toon(190, { color: K.butter })}>화이팅!</span>
          </div>
          <div style={{ marginTop: 6, scale: `${pop(f, KE.cheer + 10, fps)}` }}>
            <span style={toon(70, { font: 'en' })}>{ui.gotThis}</span>
          </div>
        </div>
        {/* 진행자 몽글(이 편을 위해 구운 응원 표정 — 색종이 펠트까지 한 장) — 한 번 자리 잡고 멈춤 */}
        <Img
          src={staticFile(HOST_END)}
          style={{
            position: 'absolute',
            left: 320,
            top: 880,
            width: 440,
            height: 'auto',
            opacity: settle(f, KE.cheer + 14, fps) > 0.01 ? 1 : 0,
            scale: `${0.7 + 0.3 * settle(f, KE.cheer + 14, fps)}`,
            transformOrigin: '50% 100%',
            filter: 'drop-shadow(0 14px 0 rgba(27,42,90,0.35))',
            // v2: 자리 잡은 뒤(10프레임)부터 숨쉬기
            ...(motion && f >= KE.cheer + 24 ? { transform: hostBreath(f, END_START).transform } : {}),
          }}
        />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1360, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22, opacity: ramp(f, E.logo, 8), translate: `0 ${(1 - ramp(f, E.logo, 10)) * 30}px` }}>
          <div style={{ ...panel(22, 8), padding: '12px 22px' }}>
            <Img src={staticFile('img/logo-lab.webp')} style={{ height: 64, width: 'auto', display: 'block' }} />
          </div>
          <span style={{ ...toon(40, { font: 'en', stroke: 7, drop: 4 }) }}>{handle ?? ui.handle}</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
