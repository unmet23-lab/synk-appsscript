// 전체 조립: 배경 → 장면(문제 셋 + 끝) → 순간 효과(색수차·모션블러·빛 번짐) → 그레인 → 소리.
import { chromaticAberration } from '@remotion/effects/chromatic-aberration';
import { lightLeak } from '@remotion/effects/light-leak';
import { Audio } from '@remotion/media';
import { CameraMotionBlur } from '@remotion/motion-blur';
import React from 'react';
import { AbsoluteFill, HtmlInCanvas, interpolate, Sequence, Solid, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp, Grain } from '../lib/anim';
import { EN } from '../lib/fonts';
import { QUESTIONS } from './data';
import { End } from './End';
import { Question } from './Question';
import { C } from './theme';
import { VO } from './vo.generated';
import { CUTS, E, END_LEN, END_START, hitAmount, isFast, Q_LEN, qStart, T, TOTAL } from './timeline';

/** 배경: 따뜻한 오프화이트 + 위 왼쪽 빛 + 문제 번호를 아주 옅고 크게(깊이감). */
const Background: React.FC = () => {
  const f = useCurrentFrame();
  const sec = f < END_START ? Math.floor(f / Q_LEN) : -1;
  const local = sec >= 0 ? f - qStart(sec) : f - END_START;
  const len = sec >= 0 ? Q_LEN : END_LEN;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill style={{ background: 'radial-gradient(1200px 900px at 18% 8%, rgba(255,255,255,0.95), rgba(255,255,255,0) 70%)' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(1400px 1100px at 90% 110%, rgba(17,17,18,0.07), rgba(17,17,18,0) 65%)' }} />
      <div
        style={{
          position: 'absolute',
          right: -40,
          top: 150,
          font: `900 760px/0.8 ${EN}`,
          letterSpacing: '-0.06em',
          color: C.ghost,
          translate: `${interpolate(local, [0, len], [30, -50])}px 0`,
        }}
      >
        {sec >= 0 ? String(sec + 1).padStart(2, '0') : '3/3'}
      </div>
    </AbsoluteFill>
  );
};

/** 장면들. 장면마다 아주 느린 카메라 푸시(1.00→1.035). */
const Scenes: React.FC = () => {
  const f = useCurrentFrame();
  const sec = f < END_START ? Math.floor(f / Q_LEN) : -1;
  const local = sec >= 0 ? f - qStart(sec) : f - END_START;
  const push = 1 + 0.035 * interpolate(local, [0, sec >= 0 ? Q_LEN : END_LEN], [0, 1], clamp);
  const amount = hitAmount(f);
  const body = (
    <AbsoluteFill style={{ scale: `${push}` }}>
      {QUESTIONS.map((q, i) => (
        <Sequence key={q.idiom} from={qStart(i)} durationInFrames={Q_LEN}>
          <Question q={q} index={i} total={QUESTIONS.length} />
        </Sequence>
      ))}
      <Sequence from={END_START} durationInFrames={END_LEN}>
        <End />
      </Sequence>
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill>
      <Background />
      {amount > 0 ? <ChromaHit amount={amount}>{body}</ChromaHit> : body}
    </AbsoluteFill>
  );
};

const ChromaHit: React.FC<{ amount: number; children: React.ReactNode }> = ({ amount, children }) => {
  const { width, height } = useVideoConfig();
  return (
    <HtmlInCanvas width={width} height={height} effects={[chromaticAberration({ amount, angle: 0 })]}>
      {children}
    </HtmlInCanvas>
  );
};

/** 장면이 바뀌는 순간에만 지나가는 빛 번짐(코랄 쪽으로 색을 돌림). */
const Leaks: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const c = CUTS.find((x) => f >= x - 10 && f < x + 10);
  if (c === undefined) return null;
  return (
    <Solid
      width={width}
      height={height}
      style={{ position: 'absolute', inset: 0, opacity: 0.72 }}
      effects={[lightLeak({ seed: CUTS.indexOf(c) + 2, hueShift: 38, progress: interpolate(f, [c - 10, c + 10], [0, 1], clamp) })]}
    />
  );
};

/** 효과음 한 번: 요소마다 하나, 나머지는 음악만. */
type Hit = { at: number; src: string; v: number };
const sfx = (n: string) => staticFile(`sfx/${n}.wav`);
const HITS_SFX: Hit[] = [
  ...QUESTIONS.flatMap((_, i) => {
    const s = qStart(i);
    return [
      ...(i === 0 ? [{ at: 0, src: sfx('boom'), v: 0.5 }] : []),
      { at: s + T.title, src: sfx('snap'), v: 0.45 },
      { at: s + T.parts, src: sfx('tok'), v: 0.8 },
      { at: s + T.parts + 4, src: sfx('tok'), v: 0.65 },
      { at: s + T.guess, src: sfx('swish'), v: 0.5 },
      { at: s + T.strike, src: sfx('thud'), v: 0.75 },
      { at: s + T.card - 2, src: sfx('whoosh_up'), v: 0.6 },
      ...T.options.map((t) => ({ at: s + t, src: sfx('tok'), v: 0.55 })),
      { at: s + T.count[0], src: sfx('tick'), v: 0.6 },
      { at: s + T.count[1], src: sfx('tick'), v: 0.6 },
      { at: s + T.count[2], src: sfx('tick2'), v: 0.7 },
      { at: s + T.reveal, src: sfx('earn'), v: 0.9 },
      { at: s + T.reveal, src: sfx('ring'), v: 0.35 },
      { at: s + T.art, src: sfx('swish'), v: 0.3 },
      { at: s + T.say, src: sfx('tok'), v: 0.7 },
      { at: s + T.out - 2, src: sfx('whoosh_side'), v: 0.6 },
    ];
  }),
  ...E.recap.map((t) => ({ at: END_START + t, src: sfx('tok'), v: 0.7 })),
  { at: END_START + E.comment, src: sfx('snap'), v: 0.4 },
  { at: END_START + E.cheer - 4, src: sfx('whoosh_up'), v: 0.55 },
  { at: END_START + E.logo, src: sfx('achieve'), v: 0.9 },
  { at: END_START + E.logo, src: sfx('boom'), v: 0.3 },
];

export type Narration = 'none' | 'natural' | 'fun';

const Sound: React.FC<{ vo: Narration }> = ({ vo }) => {
  const { fps } = useVideoConfig();
  const lines = vo === 'none' ? [] : VO[vo];
  // 나레이션이 나오는 동안 BGM을 약 8dB 낮춘다(5dB로는 영어 첫소리가 묻혔다 — 받아쓰기 실측)(말 앞 0.08초에 내려가고 끝 0.15초 뒤 돌아옴)
  const duck = (f: number) => {
    const t = f / fps;
    let d = 0;
    for (const l of lines) d = Math.max(d, interpolate(t, [l.at - 0.08, l.at, l.at + l.dur, l.at + l.dur + 0.15], [0, 1, 1, 0], clamp));
    return 1 - 0.6 * d;
  };
  // 재밌는 판은 목소리가 3·2·1을 같이 외치므로 똑딱을 줄인다
  const tickScale = vo === 'fun' ? 0.5 : 1;
  // 말머리에 효과음이 겹치면 첫소리가 묻힌다(받아쓰기 실측: 「발이」→「다리」). 말하는 동안의 효과음은 30%로
  const underVoice = (frame: number) => lines.some((l) => frame / fps >= l.at - 0.12 && frame / fps <= l.at + l.dur);
  // 나레이션이 있으면 전체 믹스를 2dB 낮춰 겹치는 순간에도 0dB에 닿지 않게(마감.mjs가 −14 LUFS로 올린다)
  const mix = vo === 'none' ? 1 : 0.8;
  return (
    <>
      {/* 음악.mjs가 영상 박자 구조대로 다시 붙인 30초(끝 0.8초 페이드 포함) */}
      <Audio src={staticFile('bgm.wav')} volume={(f) => 0.6 * mix * duck(f)} />
      {HITS_SFX.map((h, i) => (
        <Sequence key={i} from={h.at} durationInFrames={Math.max(1, Math.min(2 * fps, TOTAL - h.at))} layout="none">
          <Audio src={h.src} volume={mix * (h.src.includes('tick') ? h.v * tickScale : h.v) * (underVoice(h.at) ? 0.3 : 1)} />
        </Sequence>
      ))}
      {lines.map((l) => (
        <Sequence key={l.id} from={Math.round(l.at * fps)} durationInFrames={Math.ceil((l.dur + 0.2) * fps)} layout="none">
          <Audio src={staticFile(l.src)} volume={mix} />
        </Sequence>
      ))}
    </>
  );
};

export const Film: React.FC<{ vo?: Narration }> = ({ vo = 'none' }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {isFast(f) ? (
        <CameraMotionBlur samples={6} shutterAngle={200}>
          <Scenes />
        </CameraMotionBlur>
      ) : (
        <Scenes />
      )}
      <Leaks />
      <Grain opacity={0.05} />
      <Sound vo={vo} />
    </AbsoluteFill>
  );
};

/** 표지(썸네일)는 본편 55프레임(첫 문제 1마디가 다 모인 순간)을 그대로 뽑는다: npx remotion still src/index.ts topik-quiz out/cover.png --frame=55 */
