import React from 'react';
import {
  AbsoluteFill, Audio, Composition, Img, OffthreadVideo, Sequence,
  interpolate, registerRoot, staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';
import {theme as t} from '../firstposts20260910/theme';

export const TIMING = {fps: 30, duration: 29.4, introEnd: 5.166666667,
  processEnd: 9.666666667, beliefEnd: 13.9, methodEnd: 22, endingStart: 25.8};
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const source = (file: string) => staticFile('firstpost20260911/' + file);
const ease = (time: number, from: number, to: number, a = 0, b = 1) =>
  interpolate(time, [from, to], [a, b], {...clamp, easing: t.ease});
const drift = (time: number, duration: number, a: number, b: number) =>
  interpolate(time, [0, duration], [a, b], {...clamp, easing: t.drift});

const Reveal: React.FC<{delay?: number; duration: number; style?: React.CSSProperties;
  children: React.ReactNode}> = ({delay = 0, duration, style, children}) => {
  const f = useCurrentFrame(), {fps} = useVideoConfig(), time = f / fps;
  const enter = ease(time, delay, delay + .3);
  const exit = interpolate(time, [duration - .18, duration], [0, 1], {...clamp, easing: t.exit});
  return <div style={{...style, opacity: enter * (1 - exit),
    transform: `translateY(${22 * (1 - enter) - 8 * exit}px) scale(${.987 + .013 * enter})`}}>{children}</div>;
};

const Surface: React.FC<{children: React.ReactNode; dark?: boolean}> = ({children, dark = false}) => {
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  return <AbsoluteFill style={{background: dark ? t.ink : t.paper, color: dark ? t.paper : t.ink,
    fontFamily: t.font, overflow: 'hidden', isolation: 'isolate'}}>
    {dark ? <Img src={source('felt-dark.webp')} style={{position: 'absolute', width: '100%', height: '100%',
      objectFit: 'cover', transform: `scale(${1.035 - Math.sin(f / fps * .24) * .006})`}}/>
      : <AbsoluteFill style={{background: `radial-gradient(ellipse at 83% 69%,${t.oat}aa,transparent 62%)`}}/>}
    <AbsoluteFill style={{background: dark ? t.ink : t.oat, opacity: dark ? .2 : .035}}/>
    {children}
    <AbsoluteFill style={{pointerEvents: 'none', background: t.oat, mixBlendMode: 'multiply', opacity: .022}}/>
    <AbsoluteFill style={{pointerEvents: 'none', opacity: dark ? .025 : .035,
      backgroundImage: `radial-gradient(${t.ink}88 .65px,transparent .9px)`, backgroundSize: '7px 7px'}}/>
    <AbsoluteFill style={{pointerEvents: 'none',
      background: `radial-gradient(ellipse at center,transparent 55%,${t.shadow(dark ? .22 : .045)} 100%)`}}/>
  </AbsoluteFill>;
};

const Header: React.FC<{chapter: string; duration: number}> = ({chapter, duration}) =>
  <>
    <Reveal duration={duration} style={{position: 'absolute', left: 96, top: 258}}>
      <Img src={source('logo-shift.png')} style={{width: 354, height: 105, objectFit: 'contain', objectPosition: 'left center'}}/>
    </Reveal>
    <Reveal duration={duration} delay={.07} style={{position: 'absolute', right: 136, top: 300,
      color: t.muted, fontSize: 25, fontWeight: 500, letterSpacing: '-.01em'}}>{chapter}</Reveal>
  </>;

const Footer: React.FC<{duration: number; label?: string}> = ({duration, label = 'AI로 혼자 회사를 만드는 중'}) =>
  <Reveal duration={duration} delay={.6} style={{position: 'absolute', left: 96, right: 136, bottom: 268,
    display: 'flex', justifyContent: 'space-between', color: t.muted, fontSize: 25, fontWeight: 400}}>
    <span>@yuhobuilds</span><span>{label}</span>
  </Reveal>;

const Headline: React.FC<{lead: string; main: string; duration: number; mainSize?: number}> =
  ({lead, main, duration, mainSize = 98}) => <div style={{position: 'absolute', left: 96, right: 136, top: 472}}>
    <Reveal duration={duration} delay={.03} style={{fontSize: 66, fontWeight: 500, lineHeight: 1.23,
      color: t.muted, letterSpacing: '-.025em'}}>{lead}</Reveal>
    <Reveal duration={duration} delay={.14} style={{fontSize: mainSize, fontWeight: 800, lineHeight: 1.2,
      marginTop: 20, letterSpacing: '-.045em', whiteSpace: 'pre-line', wordBreak: 'keep-all'}}>{main}</Reveal>
  </div>;

const SpeechPanel: React.FC<{text: string}> = ({text}) =>
  <div style={{position: 'absolute', left: 96, right: 136, bottom: 380, height: 176,
    boxSizing: 'border-box', padding: '24px 38px', borderRadius: 16,
    background: `linear-gradient(180deg,${t.paper},${t.paper}f2)`,
    boxShadow: `inset 0 0 0 1px ${t.shadow(.035)},0 12px 34px ${t.shadow(.055)}`,
    fontSize: 41, fontWeight: 400, lineHeight: 1.42, letterSpacing: '-.022em',
    display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', whiteSpace: 'pre-line'}}>{text}</div>;

const Introduction: React.FC<{cover?: boolean}> = ({cover = false}) => {
  const f = useCurrentFrame(), {fps} = useVideoConfig(), time = f / fps, duration = TIMING.introEnd;
  return <Surface>
    <Header chapter="처음 뵙겠습니다" duration={duration}/>
    <Headline lead="AI와 함께," main="회사를 만듭니다." mainSize={96} duration={duration}/>
    <Reveal duration={duration} delay={.25} style={{position: 'absolute', left: 100, top: 750,
      color: t.muted, fontSize: 34, lineHeight: 1.5, letterSpacing: '-.02em'}}>혼자 사업을 준비하는 유호입니다.</Reveal>
    <Reveal duration={duration} delay={.1} style={{position: 'absolute', left: 104, right: 146, top: 875}}>
      <div style={{transform: `perspective(1500px) rotateX(${drift(time, duration, 6, 0)}deg) rotateZ(${drift(time, duration, -1.4, .2)}deg) translateY(${Math.sin(time * .6) * 2}px) scale(${drift(time, duration, 1, 1.026)})`}}>
        <Img src={source('synk-intro.png')} style={{width: '100%', height: 420, objectFit: 'contain',
          filter: `drop-shadow(0 19px 20px ${t.shadow(.11)})`}}/>
      </div>
    </Reveal>
    <Reveal duration={duration} delay={.45} style={{position: 'absolute', left: 104, top: 1315,
      color: t.muted, fontSize: 26, lineHeight: 1.4}}>직접 만든 SYNK LAB 소개서 · 개원 준비 중</Reveal>
    {cover ? <div style={{position: 'absolute', left: 104, top: 1455, fontSize: 40, fontWeight: 500,
      letterSpacing: '-.02em'}}>소개서·홍보글·영상 만드는 법부터.</div>
      : <SpeechPanel text={time < 2 ? '안녕하세요. 유호입니다.' : '저는 AI와 함께\n회사를 만들고 있어요.'}/>}
    <Footer duration={duration}/>
  </Surface>;
};

const Process: React.FC = () => {
  const f = useCurrentFrame(), {fps} = useVideoConfig(), time = f / fps,
    duration = TIMING.processEnd - TIMING.introEnd;
  return <Surface>
    <Header chapter="만든 과정을 보여드려요" duration={duration}/>
    <Headline lead="AI에 무엇을 부탁했고," main="어디를 고쳤는지." mainSize={95} duration={duration}/>
    <Reveal duration={duration} delay={.16} style={{position: 'absolute', left: 106, top: 940, width: 556}}>
      <Img src={source('synk-intro.png')} style={{width: '100%', height: 350, objectFit: 'contain',
        transform: `rotate(-4deg) scale(${drift(time, duration, 1, 1.03)})`,
        filter: `drop-shadow(0 20px 20px ${t.shadow(.12)})`}}/>
    </Reveal>
    <Reveal duration={duration} delay={.29} style={{position: 'absolute', left: 625, top: 819, width: 270,
      height: 480, overflow: 'hidden', borderRadius: 16, background: t.paper,
      boxShadow: `0 25px 38px ${t.shadow(.16)},0 0 0 1px ${t.shadow(.06)}`}}>
      <OffthreadVideo muted src={source('approved-trial.mp4')} trimBefore={Math.round(2.5 * fps)}
        style={{width: '100%', height: '100%', objectFit: 'cover'}}/>
    </Reveal>
    <Reveal duration={duration} delay={.6} style={{position: 'absolute', left: 110, right: 146, top: 1318,
      display: 'flex', justifyContent: 'space-between', fontSize: 26, color: t.muted}}>
      <span>직접 만든 LAB 소개서</span><span>브랜드 영상 제작 실물</span>
    </Reveal>
    <SpeechPanel text={'입력한 문장과\n고치기 전과 후를 보여드릴게요.'}/>
    <Footer duration={duration}/>
  </Surface>;
};

const Belief: React.FC = () => {
  const f = useCurrentFrame(), {fps} = useVideoConfig(), time = f / fps,
    duration = TIMING.beliefEnd - TIMING.processEnd;
  return <Surface>
    <Header chapter="이 채널에서 배울 수 있어요" duration={duration}/>
    <Headline lead="소개서·홍보글·영상," main="AI로 만들어보세요." mainSize={92} duration={duration}/>
    <Reveal duration={duration} delay={.28} style={{position: 'absolute', left: 100, right: 136, top: 800,
      fontSize: 35, fontWeight: 500, lineHeight: 1.55, color: t.muted, letterSpacing: '-.025em'}}>
      제가 만드는 순서와<br/>막힌 부분을 고치는 법을 알려드릴게요.
    </Reveal>
    <Reveal duration={duration} delay={.15} style={{position: 'absolute', left: 185, top: 1010, width: 640, height: 440}}>
      <Img src={source('letter.webp')} style={{width: '100%', height: '100%', objectFit: 'contain',
        transform: `translateY(${Math.sin(time * .55) * 3}px) rotate(${drift(time, duration, -2, 1)}deg) scale(${drift(time, duration, .98, 1.035)})`}}/>
    </Reveal>
    <Reveal duration={duration} delay={2.1} style={{position: 'absolute', left: 100, right: 136, top: 1505,
      fontSize: 33, color: t.muted, lineHeight: 1.5, letterSpacing: '-.02em'}}>
      혼자 사업을 준비하는 분들을 위해.
    </Reveal>
    <Footer duration={duration} label="처음 쓰는 분도 쉽게"/>
  </Surface>;
};

const Method: React.FC = () => {
  const duration = TIMING.methodEnd - TIMING.beliefEnd;
  const rows = [
    {question: '소개서 만들기', answer: '내 회사를 한눈에 알 수 있게', delay: .45},
    {question: '홍보글 쓰기', answer: '상품의 장점을 쉽게 설명하게', delay: 2.65},
    {question: '영상 만들기', answer: '목소리·자막·음악을 자연스럽게', delay: 4.85},
  ];
  return <Surface>
    <Header chapter="앞으로 보여드릴 내용" duration={duration}/>
    <Headline lead="이런 작업을," main="함께 해볼 거예요." mainSize={92} duration={duration}/>
    <Reveal duration={duration} delay={.24} style={{position: 'absolute', left: 100, top: 758,
      fontSize: 31, fontWeight: 500, color: t.muted}}>제가 회사를 준비하며 직접 하는 일입니다.</Reveal>
    {rows.map((row, i) => <Reveal key={row.question} duration={duration} delay={row.delay}
      style={{position: 'absolute', left: 100, right: 140, top: 858 + i * 202, paddingTop: 24,
        borderTop: `1.5px solid ${t.shadow(.15)}`}}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 28}}>
        <span style={{fontSize: 27, fontWeight: 500, color: t.muted, fontVariantNumeric: 'tabular-nums'}}>{String(i + 1).padStart(2, '0')}</span>
        <span style={{fontSize: 50, fontWeight: 600, letterSpacing: '-.025em'}}>{row.question}</span>
      </div>
      <div style={{marginTop: 14, marginLeft: 63, fontSize: 34, fontWeight: 400, color: t.muted,
        lineHeight: 1.45, letterSpacing: '-.025em'}}>{row.answer}</div>
    </Reveal>)}
    <Reveal duration={duration} delay={5.8} style={{position: 'absolute', left: 100, right: 136, top: 1505,
      fontSize: 32, fontWeight: 500, lineHeight: 1.4, color: t.muted}}>AI에 넣을 문장과 고치는 순서를 보여드려요.</Reveal>
    <Footer duration={duration} label="내 사업에도 직접 써보세요"/>
  </Surface>;
};

const PromiseScene: React.FC = () => {
  const f = useCurrentFrame(), {fps} = useVideoConfig(), time = f / fps,
    duration = TIMING.endingStart - TIMING.methodEnd;
  return <Surface>
    <Header chapter="새 AI 기능도 직접 써봅니다" duration={duration}/>
    <div style={{position: 'absolute', left: 100, right: 136, top: 560}}>
      {['AI에 맡긴 일.', '내가 고친 이유.', '새 AI 기능을 써본 결과.'].map((line, i) =>
        <Reveal key={line} duration={duration} delay={.06 + i * .16}
          style={{fontSize: 78, fontWeight: i === 2 ? 800 : 500,
            lineHeight: 1.2, marginTop: i ? 48 : 0, color: i === 2 ? t.shift : t.ink,
            letterSpacing: '-.04em'}}>{line}</Reveal>)}
    </div>
    <Reveal duration={duration} delay={.34} style={{position: 'absolute', left: 425, top: 1100, width: 460, height: 310}}>
      <Img src={source('letter.webp')} style={{width: '100%', height: '100%', objectFit: 'contain',
        transform: `rotate(-3deg) translateY(${Math.sin(time * .55) * 2}px) scale(${drift(time, duration, 1, 1.035)})`}}/>
    </Reveal>
    <Reveal duration={duration} delay={1.2} style={{position: 'absolute', left: 100, right: 136, top: 1450,
      fontSize: 34, fontWeight: 400, lineHeight: 1.5, letterSpacing: '-.025em', color: t.muted}}>
      좋아진 점과 안 된 점을 함께 알려드릴게요.
    </Reveal>
    <Footer duration={duration} label="실제 써본 최신 AI 정보"/>
  </Surface>;
};

const Ending: React.FC = () => {
  const f = useCurrentFrame(), {fps} = useVideoConfig(), time = f / fps;
  const entrance = ease(time, 0, .55), text = ease(time, .26, .62), handle = ease(time, .45, .73);
  const exit = interpolate(time, [2.6, 3.6], [1, 0], {...clamp, easing: t.drift});
  return <Surface dark>
    <div style={{position: 'absolute', left: 108, right: 136, top: 662, textAlign: 'center', opacity: exit}}>
      <Img src={source('logo-shift-paper.png')} style={{width: 610, height: 216, objectFit: 'contain',
        opacity: entrance, transform: `translateY(${18 * (1 - entrance)}px) scale(${.98 + .02 * entrance})`}}/>
      <div style={{fontSize: 43, fontWeight: 500, lineHeight: 1.58, marginTop: 65, letterSpacing: '-.024em',
        opacity: text, transform: `translateY(${12 * (1 - text)}px) scale(${.992 + .008 * text})`}}>
        AI로 사업을 준비하는 과정,<br/>쉽게 보여드릴게요.
      </div>
      <div style={{fontSize: 30, fontWeight: 400, marginTop: 66, opacity: .74 * handle,
        transform: `translateY(${8 * (1 - handle)}px)`, letterSpacing: '.02em'}}>@yuhobuilds</div>
    </div>
  </Surface>;
};

const Film: React.FC = () => {
  const {fps} = useVideoConfig();
  const parts: [number, number, React.ReactNode, string][] = [
    [0, TIMING.introEnd, <Introduction/>, '유호와 실제 소개서'],
    [TIMING.introEnd, TIMING.processEnd, <Process/>, '직접 만든 결과'],
    [TIMING.processEnd, TIMING.beliefEnd, <Belief/>, '시청자가 배울 수 있는 실무'],
    [TIMING.beliefEnd, TIMING.methodEnd, <Method/>, '소개서 홍보글 영상의 구체적 예'],
    [TIMING.methodEnd, TIMING.endingStart, <PromiseScene/>, '새 AI 기능을 실제로 써본 결과'],
    [TIMING.endingStart, TIMING.duration, <Ending/>, 'SHIFT 엔딩'],
  ];
  return <AbsoluteFill style={{background: t.paper}}>
    <Audio src={staticFile('audio/master.wav')}/>
    {parts.map(([start, end, scene, name]) => <Sequence key={name} from={Math.round(start * fps)}
      durationInFrames={Math.round(end * fps) - Math.round(start * fps)} premountFor={Math.round(.4 * fps)} name={name}>{scene}</Sequence>)}
  </AbsoluteFill>;
};

registerRoot(() => <>
  <Composition id="ShiftFirstPost" component={Film} width={1080} height={1920}
    fps={TIMING.fps} durationInFrames={Math.round(TIMING.duration * TIMING.fps)}/>
  <Composition id="ShiftFirstPostCover" component={() => <Introduction cover/>} width={1080} height={1920}
    fps={TIMING.fps} durationInFrames={Math.round(TIMING.introEnd * TIMING.fps)}/>
</>);
