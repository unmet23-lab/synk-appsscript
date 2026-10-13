// 키즈판 조립: 청금석 물방울 배경(멈춤) → 위쪽 게임 화면(TOPIK 108 · n/3 · 진행 별 셋) → 문제 셋·끝 → 가운데서 커지는 동그라미 전환 → 소리.
// 박자표(film/timeline.ts)와 내용(film/data.ts)은 프리미엄판과 같다. 나레이션은 재밌는 판(VO.fun)을 그대로 얹을 수 있다.
// 멀미 기준: 화면을 가로지르는 움직임 없이 제자리에서 커지고 작아지기만 한다.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp } from '../lib/anim';
import { EN } from '../lib/fonts';
import { EXAM, QUESTIONS } from '../film/data';
import { CUTS, E, END_LEN, END_START, Q_LEN, qStart, T, TOTAL } from '../film/timeline';
import { VO } from '../film/vo.generated';
import { Star } from './Cartoon';
import { KE, KidsEnd } from './KidsEnd';
import { KidsQuestion } from './KidsQuestion';
import { kidsQuestions, kidsUi, type KidsLang, type KidsUi } from './i18n';
import { K, panel, toon } from './theme';

const Background: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(1200px 900px at 50% 20%, ${K.bg2}, ${K.bg} 70%)` }}>
    <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.12) 13px, transparent 14px)', backgroundSize: '90px 90px' }} />
  </AbsoluteFill>
);

/** 위쪽 게임 화면: 레벨 + 진행 별 셋(정답마다 하나씩 채워짐). */
const Hud: React.FC<{ ui: KidsUi }> = ({ ui }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = f < END_START ? Math.floor(f / Q_LEN) : 3;
  const fills = QUESTIONS.map((_, i) => qStart(i) + T.reveal + 4);
  const levelPop = spring({ frame: f - (sec < 3 ? qStart(sec) : END_START), fps, config: { damping: 10, stiffness: 190, mass: 0.6 } });
  return (
    <>
      <div style={{ position: 'absolute', left: 70, top: 256, ...panel(26, 8, K.butter), padding: '6px 24px', scale: `${0.85 + 0.15 * levelPop}`, transformOrigin: 'left center' }}>
        <span style={{ font: `900 40px ${EN}`, color: K.navy }}>{sec < 3 ? `${EXAM.name} · ${sec + 1}/3` : ui.clearHud}</span>
      </div>
      <div style={{ position: 'absolute', left: 640, top: 252, display: 'flex', gap: 14 }}>
        {fills.map((at, i) => {
          const on = f >= at;
          const bump = on ? 1 + 0.45 * Math.exp(-(f - at) / 4) : 1;
          return (
            <div key={i} style={{ scale: `${bump}` }}>
              <Star size={84} fill={on ? 1 : 0} />
            </div>
          );
        })}
      </div>
    </>
  );
};

/** 장면 경계: 가운데서 버터색 동그라미가 커져 덮고 「LEVEL 2!」, 다시 작아지며 새 장면. */
const Iris: React.FC<{ ui: KidsUi }> = ({ ui }) => {
  const f = useCurrentFrame();
  const c = CUTS.find((x) => f >= x - 9 && f < x + 9);
  if (c === undefined) return null;
  const p = (f - (c - 9)) / 18; // 0→1
  const r = interpolate(p, [0, 0.45, 0.55, 1], [0, 1250, 1250, 0], { ...clamp, easing: (x) => x * x * (3 - 2 * x) });
  const label = c === END_START ? ui.finish : ui.level(CUTS.indexOf(c) + 2);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 540 - r, top: 900 - r, width: 2 * r, height: 2 * r, borderRadius: '50%', background: K.butter, border: `12px solid ${K.navy}` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 820, display: 'flex', justifyContent: 'center', opacity: interpolate(p, [0.3, 0.42, 0.6, 0.72], [0, 1, 1, 0], clamp), scale: `${interpolate(p, [0.3, 0.5], [0.6, 1], clamp)}` }}>
        <span style={toon(150, { font: 'en', color: K.white })}>{label}</span>
      </div>
    </AbsoluteFill>
  );
};

/** 소리: 요소마다 하나(박마다 넣지 않음). 정답 딩은 문제마다 한 음씩 올라간다. */
type Hit = { at: number; src: string; v: number; voSkip?: boolean }; // voSkip: 나레이션판에서는 뺀다(제목을 외치는 소리와 겹침)
const sfx = (n: string) => staticFile(`sfx/${n}.wav`);
const HITS: Hit[] = [
  ...QUESTIONS.flatMap((_, i) => {
    const s = qStart(i);
    return [
      { at: s + T.title, src: sfx('pop'), v: 0.8, voSkip: i > 0 },
      { at: s + T.parts, src: sfx('pop'), v: 0.6 },
      { at: s + T.guess, src: sfx('boing'), v: 0.7 },
      { at: s + T.strike, src: sfx('thud'), v: 0.8 },
      ...(i === 0 ? [] : [{ at: s + T.strike + 4, src: sfx('mongle_ppuu'), v: 0.55 }]),
      { at: s + T.card - 2, src: sfx('pop'), v: 0.6 },
      { at: s + T.count[0], src: sfx('tick'), v: 0.6 },
      { at: s + T.count[1], src: sfx('tick'), v: 0.6 },
      { at: s + T.count[2], src: sfx('tick2'), v: 0.7 },
      { at: s + T.count[0] + 3, src: sfx('riser'), v: 0.3 },
      { at: s + T.reveal, src: sfx(`ding${i + 1}`), v: 0.9 },
      { at: s + T.reveal + 4, src: sfx('sparkle'), v: 0.55 },
      { at: s + T.reveal + 5, src: sfx('mongle_mii'), v: 0.55 },
      { at: s + T.say, src: sfx('pop'), v: 0.6 },
      { at: s + Q_LEN - 14, src: sfx('whoosh_up'), v: 0.5, voSkip: i < 2 }, // 0.45초 — 동그라미가 다 덮는 순간 끝난다. 나레이션판에선 다음 제목 첫소리를 덮어 뺀다
    ];
  }),
  ...E.recap.map((t) => ({ at: END_START + t, src: sfx('sparkle'), v: 0.75 })),
  { at: END_START + E.recap[2] + 1, src: sfx('achieve'), v: 0.7 },
  { at: END_START + KE.comment, src: sfx('pop'), v: 0.6 },
  { at: END_START + KE.cheer + 14, src: sfx('mongle_muum'), v: 0.6 },
  { at: END_START + E.logo, src: sfx('boom'), v: 0.3 },
];

export type KidsNarration = 'none' | 'fun' | 'mn'; // mn: 몽골어 화면판 — 한국어로만 말한다(Typecast가 몽골어를 지원하지 않음)

const Sound: React.FC<{ vo: KidsNarration; bgm: string }> = ({ vo, bgm }) => {
  const { fps } = useVideoConfig();
  const lines = vo === 'none' ? [] : VO[vo];
  // 나레이션 동안 BGM을 낮춘다: 영어 줄 −8dB, 한국어 줄(해요체) −12dB, 관용구 제목 줄 −24dB.
  // 2번 제목 「발이 넓다!」가 새 음악 구간 첫 킥·베이스에 ㅂ 첫소리가 묻혀 「다리」로 들렸다 — 받아쓰기(자르는 자리 넷)에서 −12dB 2/4, −24dB 4/4(10-13)
  const depth = (l: { id: string; text: string }) => (l.id.endsWith('_title') ? 0.937 : /[가-힣]/.test(l.text) ? 0.75 : 0.6);
  const duck = (fr: number) => {
    const t = fr / fps;
    let d = 0;
    // 제목 줄은 0.3초 전부터 내려 새 구간 첫 킥(줄보다 0.01초 앞) 전에 다 낮아지게 한다(그 순간은 동그라미 전환이 화면을 덮는다)
    for (const l of lines) {
      const pre = l.id.endsWith('_title') ? [l.at - 0.3, l.at - 0.06] : [l.at - 0.08, l.at];
      d = Math.max(d, depth(l) * interpolate(t, [pre[0], pre[1], l.at + l.dur, l.at + l.dur + 0.15], [0, 1, 1, 0], clamp));
    }
    return 1 - d;
  };
  const underVoice = (fr: number) => lines.some((l) => fr / fps >= l.at - 0.12 && fr / fps <= l.at + l.dur);
  const mix = vo === 'none' ? 1 : 0.8;
  const tickScale = vo === 'none' ? 1 : 0.5; // 나레이션이 셋·둘·하나를 같이 외친다
  return (
    <>
      <Audio src={staticFile(bgm)} volume={(fr) => 0.6 * mix * duck(fr)} />
      {HITS.filter((h) => vo === 'none' || !h.voSkip).map((h, i) => (
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

export const KidsFilm: React.FC<{ vo?: KidsNarration; bgm?: string; lang?: KidsLang }> = ({ vo = 'none', bgm = 'bgm_kids.wav', lang = 'en' }) => (
  <AbsoluteFill style={{ background: K.bg }}>
    <Background />
    {kidsQuestions(lang).map((q, i) => (
      <Sequence key={q.idiom} from={qStart(i)} durationInFrames={Q_LEN}>
        <KidsQuestion q={q} index={i} lang={lang} />
      </Sequence>
    ))}
    <Sequence from={END_START} durationInFrames={END_LEN}>
      <KidsEnd lang={lang} />
    </Sequence>
    <Hud ui={kidsUi(lang)} />
    <Iris ui={kidsUi(lang)} />
    <Sound vo={vo} bgm={bgm} />
  </AbsoluteFill>
);
