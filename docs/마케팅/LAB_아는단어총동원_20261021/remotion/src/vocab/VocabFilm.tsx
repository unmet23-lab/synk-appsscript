// LAB 「아는 단어 총동원」(10-21) 한 편. 짜임: 위 흰 띠(밈 머리글, 영상 내내) · 묻는 사람(펠트 인형 + 말풍선) · 갈래 알약 + 쓴 단어 수 ·
// 가운데 같은 자리에서 낱말마다 펠트 그림 + 큰 한글 + 읽는 법·뜻이 바뀐다(구도는 그대로, 내용만 — 플래시 컷).
// 끝은 「천천히 말해 주세요」(이 편이 약속한 한마디) → 묻는 사람 「네, 천천히 말할게요」 → 따라 말할 차례 → 댓글 질문.
// 퀴즈 연재(키즈판)의 색·만화 글자·판을 그대로 쓴다. 멀미 기준도 같다: 화면을 가로지르는 움직임 없이 제자리에서 커지고 작아지기만.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Burst, clamp, Ring } from '../lib/anim';
import { EN, KO } from '../lib/fonts';
import { K, panel, textSpan, toon } from '../kids/theme';
import { PHRASE, UI, WORDS, type Lang, type Ui } from './data';
import { f, S, TOTAL, VO_AT } from './schedule';
import { VO } from './vo.generated';

const img = (n: string) => staticFile(`img/vocab/${n}.webp`);
const pop = (fr: number, at: number, fps: number, cfg = { damping: 10, stiffness: 210, mass: 0.6 }) => spring({ frame: fr - at, fps, config: cfg });
/** 0프레임에도 보이게: 크게 시작해 제자리로(통통). */
const slam = (fr: number, at: number, fps: number, from = 1.25) => from - (from - 1) * pop(fr, at, fps);
/** 줄 폭에 맞춘 글자 크기(라틴 글자 하나 ≈ 0.55em, 한글 ≈ 1em). */
const fit = (s: string, max: number, width: number, em = 0.55) => Math.min(max, Math.floor(width / (textSpan(s) * em)));
const fitKo = (s: string, max: number, width: number) => Math.min(max, Math.floor(width / ([...s].reduce((w, c) => w + (/[가-힣]/.test(c) ? 1 : 0.4), 0))));

const Background: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(1200px 900px at 50% 30%, ${K.bg2}, ${K.bg} 70%)` }}>
    <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.12) 13px, transparent 14px)', backgroundSize: '90px 90px' }} />
  </AbsoluteFill>
);

/** 위 흰 띠: 밈의 머리글 자리. 끝에는 댓글 질문으로 바뀐다. 0~3.6초에는 이 편이 주는 것(약속) 딱지를 띠 아래에 붙인다. */
const Band: React.FC<{ ui: Ui }> = ({ ui }) => {
  const fr = useCurrentFrame();
  const { fps } = useVideoConfig();
  const endOn = fr >= f(S.end);
  const lines = endOn ? ui.end : ui.band;
  const swap = endOn ? slam(fr, f(S.end), fps, 1.12) : 1;
  const promiseOut = interpolate(fr, [f(3.6), f(3.6) + 8], [1, 0], clamp);
  const promiseIn = fr < 2 ? 1 : 1 + 0.06 * Math.sin(fr / 5); // 0프레임부터 보이고 살짝 숨 쉰다
  return (
    <>
      <div style={{ position: 'absolute', left: 40, top: 150, width: 1000, height: 232, ...panel(34, 10), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, scale: `${swap}` }}>
        <span style={{ font: `800 ${fit(lines[0], 46, 920, 0.56)}px/1.15 ${EN}`, color: K.navy, textAlign: 'center' }}>{lines[0]}</span>
        <span style={{ font: `900 ${fit(lines[1], 58, 920, 0.6)}px/1.1 ${EN}`, color: K.navy, textAlign: 'center' }}>{lines[1]}</span>
        {endOn && <span style={{ position: 'absolute', right: 30, bottom: 10, font: `700 26px ${EN}`, color: K.bg }}>{ui.handle}</span>}
      </div>
      {promiseOut > 0 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 360, display: 'flex', justifyContent: 'center', scale: `${promiseOut * promiseIn}`, rotate: '-2deg' }}>
          <span style={{ ...panel(999, 7, K.butter), padding: '8px 30px', font: `900 ${fit(ui.promise, 38, 940, 0.62)}px ${EN}`, color: K.navy, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>{ui.promise}</span>
        </div>
      )}
    </>
  );
};

/** 묻는 사람: 표정 컷(자리 고정) + 말풍선. */
const Asker: React.FC<{ ui: Ui }> = ({ ui }) => {
  const fr = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = fr / fps;
  const at = (id: string) => S.words.find((w) => w.id === id)!.at;
  const face = t < at('w03') ? 'curious' : t < at('w13') ? 'wow' : t < S.slow ? 'holdlaugh' : t < S.ok ? 'curious' : 'smile';
  const faceAt = t < at('w03') ? 0 : t < at('w13') ? at('w03') : t < S.slow ? at('w13') : t < S.ok ? S.slow : S.ok;
  const bump = fr < 2 ? 1 : 1 + 0.08 * Math.exp(-(fr - f(faceAt)) / 4);
  // 말풍선: 묻기 → (낱말 동안 그대로) → ㅋㅋㅋ → (학습자가 말할 때 접힘) → 네, 천천히 말할게요
  const bubble = t < S.laugh ? { ko: '한국어 할 줄 알아요?', sub: ui.askSub, at: 0 } : t < S.slow ? { ko: 'ㅋㅋㅋ', sub: ui.laughSub, at: S.laugh } : t < S.ok ? null : { ko: '네, 천천히 말할게요', sub: ui.okSub, at: S.ok };
  const bIn = bubble ? (bubble.at === 0 ? 1 : slam(fr, f(bubble.at), fps, 1.15)) : 0;
  const shrink = t >= S.slow && t < S.ok ? interpolate(fr, [f(S.slow), f(S.slow) + 6], [1, 0], clamp) : 1;
  const show = bubble ?? { ko: 'ㅋㅋㅋ', sub: ui.laughSub, at: S.laugh };
  return (
    <>
      <div style={{ position: 'absolute', left: 30, top: 432, width: 250, height: 290, scale: `${bump}`, transformOrigin: 'center bottom' }}>
        <Img src={img(`asker_${face}`)} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: `drop-shadow(0 10px 0 ${K.navy}55)` }} />
      </div>
      {(bubble || shrink > 0) && (
        <div style={{ position: 'absolute', left: 296, top: 468, width: 740, height: 196, scale: `${(bubble ? bIn : 1) * shrink}`, transformOrigin: 'left center' }}>
          <div style={{ position: 'absolute', inset: 0, ...panel(40, 10), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <span style={{ font: `900 ${fitKo(show.ko, 72, 640)}px/1.1 ${KO}`, color: K.navy, display: 'flex', gap: '0.25em' }}>
              {/* 「네, 천천히 말할게요」는 말하는 낱말에 맞춰 차오른다(ok.json 낱말 시각 0.02 · 0.52 · 0.92) */}
              {show.ko.split(' ').map((part, i) => {
                const wAt = show.at === S.ok ? f(S.ok + [0, 0.5, 0.9][i]) : 0;
                return <span key={i} style={{ opacity: fr >= wAt ? 1 : 0.2, display: 'inline-block', margin: '0 0.05em', scale: `${wAt && fr >= wAt ? slam(fr, wAt, fps, 1.25) : 1}` }}>{part}</span>;
              })}
            </span>
            <span style={{ font: `600 ${fit(show.sub, 34, 640)}px ${EN}`, color: '#4C5D8F' }}>{show.sub}</span>
          </div>
          {/* 말꼬리: 얼굴 쪽 */}
          <svg width="56" height="60" style={{ position: 'absolute', left: -44, top: 92 }} viewBox="0 0 56 60">
            <path d="M56 6 L4 34 L56 52 Z" fill={K.white} stroke={K.navy} strokeWidth="7" strokeLinejoin="round" />
            <rect x="48" y="9" width="14" height="40" fill={K.white} />
          </svg>
        </div>
      )}
    </>
  );
};

/** 갈래 알약(왼쪽)과 쓴 단어 수(오른쪽). 끝에는 따라 말할 차례 알약. */
const Chips: React.FC<{ ui: Ui }> = ({ ui }) => {
  const fr = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = fr / fps;
  const started = S.words.filter((w) => t >= w.at);
  const cur = started.length ? WORDS[started.length - 1] : null;
  const catAt = cur ? S.words[WORDS.findIndex((w) => w.cat === cur.cat)].at : 0;
  const lastAt = started.length ? started[started.length - 1].at : 0;
  const hide = interpolate(fr, [f(S.slowCard), f(S.slowCard) + 6], [1, 0], clamp);
  const turnIn = t >= S.turn ? slam(fr, f(S.turn), fps, 1.4) : 0;
  return (
    <>
      {hide > 0 && (
        <>
          {cur && (
            <div style={{ position: 'absolute', left: 60, top: 742, scale: `${hide * slam(fr, f(catAt), fps, 1.3)}`, transformOrigin: 'left center' }}>
              <span style={{ ...panel(999, 7, cur.cat === 4 ? K.pop : K.coral), padding: '8px 26px', font: `900 34px ${EN}`, color: K.white, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{ui.cats[cur.cat]}</span>
            </div>
          )}
          <div style={{ position: 'absolute', right: 60, top: 742, scale: `${hide * (started.length ? 1 + 0.18 * Math.exp(-(fr - f(lastAt)) / 3.5) : 1)}`, transformOrigin: 'right center' }}>
            <span style={{ ...panel(999, 7, K.navy), border: `6px solid ${K.white}`, padding: '8px 24px', font: `800 32px ${EN}`, color: K.white, whiteSpace: 'nowrap' }}>
              {ui.used} <span style={{ color: K.butter, font: `900 40px ${EN}` }}>{started.length}</span>
            </span>
          </div>
        </>
      )}
      {turnIn > 0 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 736, display: 'flex', justifyContent: 'center', scale: `${turnIn * (1 + 0.04 * Math.sin((fr - f(S.turn)) / 4))}` }}>
          <span style={{ ...panel(999, 8, K.coral), padding: '10px 40px', font: `900 46px ${EN}`, color: K.white, letterSpacing: '0.06em' }}>{ui.yourTurn}</span>
        </div>
      )}
    </>
  );
};

/** 가운데 무대: 낱말마다 같은 자리에서 그림·글이 바뀐다. 처음(묻는 동안)은 큰 물음표, 끝은 약속한 한마디. */
const Stage: React.FC<{ lang: Lang; ui: Ui }> = ({ lang, ui }) => {
  const fr = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = fr / fps;
  const idx = S.words.filter((w) => t >= w.at).length - 1;
  const phrase = t >= S.slowCard;

  if (phrase) {
    const at = f(S.slowCard);
    const turnT = Math.max(0, t - S.turn);
    const ringP = t >= S.turn ? 1 - turnT / 2.0 : 1;
    const breath = 1 + 0.04 * Math.sin((fr - at) / 4); // 따라 말할 동안에도 화면이 숨 쉰다(정지 구간 점검)
    // 도장은 묻는 사람이 「네, 천천히 말할게요」라고 받아 준 뒤에 달팽이 왼쪽에 찍는다(통했다). 차례 알약(위 가운데)과 겹치지 않는 자리라 끝까지 둔다.
    const stampAt = f(S.ok + 1.55);
    const stamp = slam(fr, stampAt, fps, 1.8);
    const koSize = fitKo(PHRASE.ko, 112, 900);
    return (
      <>
        <div style={{ position: 'absolute', left: 540 - 210, top: 790, width: 420, height: 420, scale: `${slam(fr, at, fps, 1.3) * breath}` }}>
          {t >= S.turn && <Ring size={420} stroke={16} progress={ringP} color={K.butter} track="rgba(255,255,255,0.18)" style={{ position: 'absolute', inset: 0 }} />}
          <Img src={img(PHRASE.art)} style={{ position: 'absolute', inset: 50, width: 320, height: 320, objectFit: 'contain', filter: `drop-shadow(0 12px 0 ${K.navy}66)` }} />
        </div>
        {fr >= stampAt && stamp > 0 && (
          <div style={{ position: 'absolute', left: 56, top: 860, rotate: '-8deg', scale: `${stamp}` }}>
            <span style={{ ...panel(18, 8, K.butter), padding: '8px 18px', font: `900 ${fit(ui.works, 36, 330, 0.62)}px ${EN}`, color: K.navy, whiteSpace: 'nowrap' }}>{ui.works}</span>
          </div>
        )}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1222, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          {/* 말하는 낱말에 맞춰 한 낱말씩(천천히 · 말해 · 주세요) — 이 한마디 동안에도 화면이 바뀐다(정지 구간 점검) */}
          <span style={{ ...toon(koSize), whiteSpace: 'nowrap', display: 'flex', gap: '0.25em' }}>
            {PHRASE.ko.split(' ').map((part, i) => {
              const wAt = f(S.slow + PHRASE.wordAt[i]) - 2;
              return <span key={i} style={{ opacity: fr >= wAt ? 1 : 0.18, scale: `${fr >= wAt ? slam(fr, wAt, fps, 1.35) : 1}`, display: 'inline-block' }}>{part}</span>;
            })}
          </span>
          <span style={{ font: `900 ${fit(PHRASE.mean[lang], 50, 860, 0.58)}px ${EN}`, color: K.butter, WebkitTextStroke: `6px ${K.navy}`, paintOrder: 'stroke fill', opacity: fr >= f(S.slow + 1.1) ? 1 : 0, scale: `${slam(fr, f(S.slow + 1.1), fps, 1.25)}` }}>{PHRASE.mean[lang]}</span>
          <span style={{ font: `600 ${fit(PHRASE.read[lang], 36, 860)}px ${EN}`, color: K.sky, opacity: interpolate(fr, [f(S.slow + 1.4), f(S.slow + 1.4) + 4], [0, 1], clamp) }}>{PHRASE.read[lang]}</span>
        </div>
        <Burst at={f(S.ok + 1.55)} x={540} y={1000} colors={[K.butter, K.white, K.coral, K.meadow]} seed="works" count={30} spread={420} dur={26} />
      </>
    );
  }

  if (idx < 0) {
    // 묻는 동안: 큰 물음표(뭐라고 하지?)
    const wob = 1 + 0.05 * Math.sin(fr / 4);
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, top: 860, display: 'flex', justifyContent: 'center', scale: `${wob}` }}>
        <span style={toon(420, { font: 'en', color: K.butter, stroke: 18, drop: 16 })}>?</span>
      </div>
    );
  }

  const w = WORDS[idx];
  const at = f(S.words[idx].at);
  const tilt = (idx % 2 === 0 ? -1 : 1) * 3 * (1 - pop(fr, at, fps));
  const drift = 1 + 0.07 * Math.min(1, (fr - at) / 30); // 낱말이 길게 남아도 그림이 천천히 다가온다(정지 구간 점검)
  const koSize = fitKo(w.ko, 170, 860);
  return (
    <>
      <div style={{ position: 'absolute', left: 540 - 230, top: 790, width: 460, height: 430, scale: `${slam(fr, at, fps, 1.22) * drift}`, rotate: `${tilt}deg` }}>
        <Img src={img(w.art)} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: `drop-shadow(0 12px 0 ${K.navy}66)` }} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1232, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <span style={{ ...toon(koSize), scale: `${slam(fr, at, fps, 1.3)}`, whiteSpace: 'nowrap' }}>{w.ko}</span>
        <span style={{ font: `700 ${fit(w.read[lang], 40, 860)}px ${EN}`, color: K.white, opacity: interpolate(fr, [at, at + 3], [0, 1], clamp), whiteSpace: 'nowrap' }}>{w.read[lang]}</span>
      </div>
    </>
  );
};

/** 소리: 배경음(목소리 아래로 −16dB) · 나레이션 · 효과음(낱말 머리를 덮지 않게 목소리보다 조금 앞에, 작게). */
const sfx = (n: string) => staticFile(`sfx/${n}.wav`);
const hits = (): { at: number; src: string; v: number }[] => [
  ...S.words.map((w, i) => ({ at: w.at - 0.06, src: sfx(i > 0 && WORDS[i].cat !== WORDS[i - 1].cat ? 'swish' : 'tok'), v: 0.28 })),
  { at: S.words[12].at + 0.3, src: sfx('sparkle'), v: 0.35 },
  { at: S.laugh + 0.02, src: sfx('boing'), v: 0.5 },
  { at: S.slowCard, src: sfx('ding1'), v: 0.6 },
  { at: S.ok + 1.55, src: sfx('sparkle'), v: 0.5 }, // 도장·반짝임(묻는 사람 줄 끝 무렵)
  { at: S.turn, src: sfx('pop'), v: 0.6 },
  { at: S.end, src: sfx('achieve'), v: 0.55 },
];

const Sound: React.FC = () => {
  const { fps } = useVideoConfig();
  const lines = VO.map((l) => ({ ...l, at: VO_AT[l.id] }));
  const duck = (fr: number) => {
    const t = fr / fps;
    let d = 0;
    for (const l of lines) d = Math.max(d, 0.85 * interpolate(t, [l.at - 0.1, l.at - 0.02, l.at + l.dur, l.at + l.dur + 0.2], [0, 1, 1, 0], clamp));
    return 1 - d;
  };
  return (
    <>
      <Audio src={staticFile('bgm_kids_100.wav')} volume={(fr) => 0.5 * duck(fr) * interpolate(fr, [TOTAL - 18, TOTAL - 1], [1, 0], clamp)} />
      {hits().map((h, i) => (
        <Sequence key={i} from={Math.max(0, f(h.at))} durationInFrames={Math.max(1, Math.min(2 * fps, TOTAL - f(h.at)))} layout="none">
          <Audio src={h.src} volume={h.v} />
        </Sequence>
      ))}
      {lines.map((l) => (
        <Sequence key={l.id} from={f(l.at)} durationInFrames={Math.ceil((l.dur + 0.2) * fps)} layout="none">
          <Audio src={staticFile(l.src)} volume={0.9} />
        </Sequence>
      ))}
    </>
  );
};

export const VocabFilm: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => {
  const ui = UI[lang];
  return (
    <AbsoluteFill style={{ background: K.bg }}>
      <Background />
      <Stage lang={lang} ui={ui} />
      <Chips ui={ui} />
      <Asker ui={ui} />
      <Band ui={ui} />
      <Sound />
    </AbsoluteFill>
  );
};

export { TOTAL };
