// 한 판본 조립(v6): 깊은 펠트 색 바탕(문제마다 색이 바뀐다) → 위 알약(이 편의 주제 · n/3 · 별 셋) → 문제 셋(꼴 · 길이가 다르다) → 끝 → 소리.
// 멀미 기준(S17): 화면을 가로지르는 움직임 없이 제자리에서 오르고 뒤집히기만 한다. 문제 사이는 박에 맞춘 바로 넘기기(동그라미 · 밀어내기 전환 없음).
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Img, interpolate, interpolateColors, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp } from './anim';
import { checkEpisode, shotsOf, type Episode } from './episode';
import { fitBox, profileFor } from './lang';
import { End } from './End';
import { Question, SAFE, W } from './Question';
import { Scene, shotStarts } from './Scene';
import { B, CUTS, E, END_LEN, END_START, Q_FRAMES, Q_START, qT, QS, SCENE_LEN, TOTAL } from './timeline';
import { K, plate, stageBg, type } from './theme';
import { uiFor, type Ui } from './ui';
import { VO } from './vo.generated';

const sectionAt = (f: number) => (f >= END_START ? 3 : f >= Q_START[2] ? 2 : f >= Q_START[1] ? 1 : 0);

// 펠트 결 — 고운 잡음 한 겹(바탕이 매끈한 색 면으로만 보이지 않게). 씨앗이 고정이라 프레임마다 같다.
const FELT = `url("data:image/svg+xml;utf8,${"<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.1 -0.25'/></filter><rect width='320' height='320' filter='url(%23n)'/></svg>".replace(/#/g, '%23')}")`;

/** 지금 화면 가운데 있는 장면 그림(바탕에 흐리게 깔 것). */
const artAt = (ep: Episode, f: number): string => {
  const k = sectionAt(f);
  if (k === 3) return ep.end.tags?.length || f - END_START >= E.scene - 3 ? ep.end.art : shotsOf(ep.questions[2].art.meaning).slice(-1)[0].src;
  const q = ep.questions[k];
  const lf = f - Q_START[k];
  const T = qT(k);
  const back = lf >= T.flip + 5;
  const shots = shotsOf(back ? q.art.meaning : q.art.literal);
  const starts = shotStarts(shots, back ? (T.say - (T.flip + 5)) / B : QS[k].beat2);
  const t = back ? lf - (T.flip + 5) : lf - (k === 0 ? 0 : 2);
  let idx = 0;
  starts.forEach((s, i) => { if (t >= s) idx = i; });
  return shots[idx].src;
};

const Background: React.FC<{ stages: string[]; ep: Episode }> = ({ stages, ep }) => {
  const f = useCurrentFrame();
  const k = sectionAt(f);
  const cut = CUTS[k - 1];
  const t = k > 0 ? interpolate(f, [cut, cut + 6], [0, 1], clamp) : 1;
  const from = stageBg(stages[Math.max(0, k - 1)]);
  const to = stageBg(stages[k]);
  const c1 = interpolateColors(t, [0, 1], [from[0], to[0]]);
  const c2 = interpolateColors(t, [0, 1], [from[1], to[1]]);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1300px 1100px at 46% 42%, ${c1}, ${c2} 78%)`, overflow: 'hidden' }}>
      {/* 가운데 장면의 빛과 색을 화면 가득 흐리게 깐다 — 장면 카드가 빈 색 면 위에 뜬 것처럼 보이지 않게(한 장면 심사 「화면의 3분의 2가 빈 바탕」).
          작은 그림(135×240)을 흐린 뒤 8배로 키워 렌더가 느려지지 않게 한다. 그 위에 무대 색을 겹쳐 글자가 읽히게 한다. */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 135, height: 240, transform: 'scale(8)', transformOrigin: '0 0', overflow: 'hidden' }}>
        <Img src={staticFile(artAt(ep, f))} style={{ position: 'absolute', left: -14, top: -10, width: 163, height: 260, objectFit: 'cover', filter: 'blur(7px) saturate(1.15)' }} />
      </div>
      <AbsoluteFill style={{ background: `radial-gradient(1300px 1100px at 46% 42%, ${c1}, ${c2} 78%)`, opacity: 0.62 }} />
      <AbsoluteFill style={{ background: 'rgba(12, 18, 44, 0.22)' }} />
      <AbsoluteFill style={{ backgroundImage: FELT, opacity: 0.16, mixBlendMode: 'soft-light' }} />
      {/* 아래 1/4은 앱 글(캡션 · 단추)이 덮는 자리 — 조금 가라앉힌다 */}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(10, 16, 40, 0) 74%, rgba(10, 16, 40, 0.34) 100%)' }} />
    </AbsoluteFill>
  );
};

const StarMark: React.FC<{ size: number; on: boolean }> = ({ size, on }) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 46 : 21;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${50 + r * Math.cos(a)},${52 + r * Math.sin(a)}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: 'visible' }}>
      <polygon points={pts} fill={on ? K.butter : 'rgba(255, 246, 220, 0.2)'} stroke={on ? K.butter : 'rgba(255, 246, 220, 0.55)'} strokeWidth={5} strokeLinejoin="round" />
    </svg>
  );
};

/** 위 알약: 이 편의 주제 · n/3(끝에서는 「끝!」) + 별 셋(정답마다 하나씩 찬다). */
const Hud: React.FC<{ hook: string; ui: Ui; lang: string }> = ({ hook, ui, lang }) => {
  const f = useCurrentFrame();
  const sec = sectionAt(f);
  const fills = QS.map((_, i) => Q_START[i] + qT(i).reveal + 3);
  // 첫 문제 동안은 이 편의 주제(「음식 관용구 3개」), 둘째부터는 「관용구 · n/3」, 끝에서는 「끝!」
  const text = sec === 0 ? hook : sec < 3 ? `${ui.series} · ${sec + 1}/3` : ui.finish;
  // v6f: 첫 정답 전까지는 별을 접고 이 편의 주제(「학교에서 쓰는 관용구 3개」)를 화면 폭 가득 크게 — haiku 답 1이 v3부터 내내 첫 관용구 하나만 옮기고,
  //   v6f0 haiku 「위 작은 몽골어 글은 거의 못 읽었다」. 첫 정답 박에 별 셋이 튀어나오며 알약이 제 크기로 줄어든다.
  const wide = sec === 0 && f < fills[0] - 6;
  const fit = wide ? fitBox(text, profileFor(lang), 760, 54, 30, 1) : fitBox(text, profileFor(lang), 600, 40, 24, 1); // v6f: 38 → 40(v6d 학교 haiku 「위 알약 작은 글」) · 폭 610 → 600(대문자 키릴은 어림보다 7% 넓어 630이면 별을 덮었다)
  const starsIn = spring({ frame: f - (fills[0] - 6), fps: 30, config: { damping: 10, stiffness: 190, mass: 0.6 } });
  const since = f - (sec === 0 ? -99 : CUTS[sec - 1]);
  const pop = 1 + 0.1 * Math.exp(-Math.max(0, since) / 4);
  return (
    <>
      <div style={{ position: 'absolute', left: SAFE.l, top: wide ? 270 : 280, height: wide ? 74 : 56, ...plate(K.cream, 999, 5), padding: '0 22px', display: 'flex', alignItems: 'center', scale: `${pop * (wide ? 1 : 0.92 + 0.08 * Math.min(1, starsIn))}`, transformOrigin: 'left center' }}>
        <span style={{ ...type(fit.size, { font: 'loc', weight: 800, color: K.navy }), whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>{text}</span>
      </div>
      <div style={{ position: 'absolute', left: SAFE.l + W - 3 * 52 - 2 * 6, top: 282, display: 'flex', gap: 6, opacity: wide ? 0 : 1, scale: `${wide ? 0 : Math.min(1.15, starsIn)}` }}>
        {fills.map((at, i) => {
          const on = f >= at;
          return (
            <div key={i} style={{ scale: `${on ? 1 + 0.5 * Math.exp(-(f - at) / 4) : 1}` }}>
              <StarMark size={52} on={on} />
            </div>
          );
        })}
      </div>
    </>
  );
};

type Hit = { at: number; src: string; v: number };
const sfx = (n: string) => staticFile(`sfx/${n}.wav`);
// 요소마다 효과음 하나. 땡 · 딩동댕 한국어 목소리 대신 소리로(현지 시청자가 못 알아들은 자리 — #6 · #7).
const hits = (ep: Episode): Hit[] => [
  ...QS.flatMap((s, i) => {
    const q0 = Q_START[i];
    const T = qT(i);
    const q = ep.questions[i];
    const lit = shotStarts(shotsOf(q.art.literal), s.beat2).slice(1);
    const moveAt = (q.art.moves?.literal ?? []).filter((m) => ['squash', 'shake', 'grow', 'tilt'].includes(m.kind) || (m.kind === 'hop' && !m.every)).map((m) => Math.round((m.at ?? 0) * B));
    const events = [...new Set([...lit, ...moveAt])].slice(0, 2);
    return [
      ...events.map((t, k) => ({ at: q0 + t, src: sfx(k === 0 ? 'boing' : 'tok'), v: 0.5 })),
      ...(events.length ? [{ at: q0 + events[0] + 3, src: sfx('mongle_ppuu'), v: 0.5 }] : []),
      { at: q0 + T.band, src: sfx('swish'), v: 0.45 },
      ...T.opts.map((t) => ({ at: q0 + t, src: sfx('pop'), v: 0.45 })),
      ...T.count.map((t, k) => ({ at: q0 + t, src: sfx(k === T.count.length - 1 ? 'tick2' : 'tick'), v: 0.32 })),
      { at: q0 + T.count[0] + 3, src: sfx('riser'), v: 0.28 },
      { at: q0 + T.reveal, src: sfx(`ding${i + 1}`), v: 0.9 },
      { at: q0 + T.reveal + 4, src: sfx('sparkle'), v: 0.5 },
      { at: q0 + T.flip, src: sfx('whoosh_up'), v: 0.4 },
      { at: q0 + T.flip + 6, src: sfx('mongle_mii'), v: 0.45 },
      { at: q0 + T.say - 4, src: sfx('pop'), v: 0.45 },
    ];
  }),
  ...E.recap.map((t) => ({ at: END_START + t, src: sfx('sparkle'), v: 0.6 })),
  { at: END_START + E.ask, src: sfx('pop'), v: 0.55 },
  // v6f 끝(이름표 셋)은 장면이 처음부터 서 있다 — 복습 줄이 물러나는 소리(whoosh)는 목록 끝에만
  ...(ep.end.tags?.length ? [] : [{ at: END_START + E.scene - 2, src: sfx('whoosh_up'), v: 0.4 }]),
  { at: END_START + E.scene + 6, src: sfx('mongle_muum'), v: 0.5 },
  { at: END_START + E.cheer, src: sfx('achieve'), v: 0.6 },
  { at: END_START + E.logo, src: sfx('pop'), v: 0.5 },
];

const Sound: React.FC<{ ep: Episode }> = ({ ep }) => {
  const { fps } = useVideoConfig();
  const lines = VO as readonly { id: string; at: number; dur: number; src: string; text: string }[];
  // 목소리 동안 음악을 낮춘다: 제목 −24dB(새 구간 첫 킥에 첫소리가 묻힌다 — S17), 해요체 −16dB, 그 밖의 한국어 −12dB.
  const depth = (id: string) => (id.endsWith('_title') ? 0.937 : id.endsWith('_say') ? 0.85 : 0.75);
  const duck = (fr: number) => {
    const t = fr / fps;
    let d = 0;
    for (const l of lines) {
      const pre = l.id.endsWith('_title') ? [l.at - 0.3, l.at - 0.06] : [l.at - 0.08, l.at];
      d = Math.max(d, depth(l.id) * interpolate(t, [pre[0], pre[1], l.at + l.dur, l.at + l.dur + 0.15], [0, 1, 1, 0], clamp));
    }
    return 1 - d;
  };
  const underVoice = (fr: number) => lines.some((l) => fr / fps >= l.at - 0.12 && fr / fps <= l.at + l.dur);
  const mix = 0.8; // Remotion은 합친 소리가 0 dBFS를 넘으면 자른다 — 모든 소리에 같은 마스터 값(현장 노트 영상)
  return (
    <>
      <Audio src={staticFile('bgm.wav')} volume={(fr) => 0.6 * mix * duck(fr) * interpolate(fr, [TOTAL - 10, TOTAL - 1], [1, 0.5], clamp)} />
      {hits(ep).map((h, i) => (
        <Sequence key={i} from={h.at} durationInFrames={Math.max(1, Math.min(2 * fps, TOTAL - h.at))} layout="none">
          <Audio src={h.src} volume={mix * h.v * (underVoice(h.at) ? 0.35 : 1)} />
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

export const Film: React.FC<{ ep: Episode; lang: string }> = ({ ep, lang }) => {
  checkEpisode(ep, lang);
  const ui = uiFor(lang);
  const prof = profileFor(lang);
  return (
    <AbsoluteFill style={{ background: K.ink, ['--loc-font' as string]: prof.font } as React.CSSProperties}>
      <Background stages={[...ep.questions.map((q) => q.stage), ep.end.stage]} ep={ep} />
      {ep.questions.map((q, i) => (
        <Sequence key={i} from={Q_START[i]} durationInFrames={Q_FRAMES[i]}>
          <Question q={q} index={i} ui={ui} prof={prof} loc={q.loc[lang]} />
        </Sequence>
      ))}
      <Sequence from={END_START} durationInFrames={END_LEN}>
        <End ep={ep} lang={lang} ui={ui} prof={prof} />
      </Sequence>
      <Hud hook={ep.loc[lang].hook} ui={ui} lang={lang} />
      <Sound ep={ep} />
    </AbsoluteFill>
  );
};

/** 한 장면 심사용(제작 절차 「한 장면 먼저」): 제목 · 이름표 · 설명 글 없이 첫 문제의 글자 그대로 장면 → 뒤집혀 뜻 장면. 소리는 효과음만. */
export const SceneOnly: React.FC<{ ep: Episode }> = ({ ep }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const q = ep.questions[0];
  const flipAt = Math.round(5.5 * B);
  const flipP = interpolate(f, [flipAt, flipAt + 10], [0, 1], clamp);
  const back = flipP >= 0.5;
  const angle = back ? (flipP - 1) * 180 : flipP * 180;
  // 장면을 화면 폭 가득(한 장면 심사 v1: 「화면의 3분의 2가 빈 바탕이고 가운데 작은 카드만 넘어간다」)
  const w = 1080;
  const h = 810;
  const x = 0;
  const y = 520;
  const lit = shotStarts(shotsOf(q.art.literal), QS[0].beat2).slice(1);
  return (
    <AbsoluteFill style={{ background: K.ink }}>
      <Background stages={[q.stage, q.stage, q.stage, q.stage]} ep={{ ...ep, questions: [{ ...q, art: { ...q.art, literal: shotsOf(back ? q.art.meaning : q.art.literal).slice(-1)[0].src, meaning: shotsOf(q.art.meaning).slice(-1)[0].src } }, ep.questions[1], ep.questions[2]] as Episode['questions'] }} />
      <div style={{ position: 'absolute', inset: 0, transform: `perspective(1800px) rotateY(${angle}deg) scale(${1 - 0.06 * Math.sin(Math.PI * flipP)})`, transformOrigin: `540px ${y + h / 2}px` }}>
        {back ? (
          <Scene shots={shotsOf(q.art.meaning)} moves={q.art.moves?.meaning} t={f - flipAt - 5} fps={fps} x={x} y={y} w={w} h={h} beat2={2} pull={false} radius={0} />
        ) : (
          <Scene shots={shotsOf(q.art.literal, q.art.focus)} moves={q.art.moves?.literal} t={f} fps={fps} x={x} y={y} w={w} h={h} beat2={QS[0].beat2} radius={0} />
        )}
      </div>
      {[...lit.map((t) => ({ at: t, n: 'boing' })), { at: flipAt, n: 'whoosh_up' }, { at: flipAt + 6, n: 'mongle_mii' }].map((s, i) => (
        <Sequence key={i} from={s.at} durationInFrames={Math.max(1, SCENE_LEN - s.at)} layout="none">
          <Audio src={sfx(s.n)} volume={0.5} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
