// LAB E3 「POV: 앱으로 배운 한국어」 — 펠트 카페 콩트 20초 남짓.
// 장면 그림 다섯 장(GPT 이미지 2.5, 몽글은 장면째 구움)을 컷으로 잇고, 말풍선 · 자막 · Real Korean 칸은 코드로 그린다.
// 몽글은 말하지 않는다(말풍선 + 사운드킷 몽글 소리). 한국어 소리는 바리스타(범수)와 해설(하나).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { fr, N2_WORDS, T } from './timeline';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)

const INK = '#2B2522';
const CORAL = '#F25C4A';
const BUTTER = '#FFD95A';
const CREAM = '#FFF8EC';
const MINT_BG = '#D5EFE2';
const MINT_INK = '#1F5C45';

const usePop = (start: number, damping = 13) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - fr(start), fps, config: { damping, stiffness: 170, mass: 0.7 } });
};

// ── 장면 그림 ───────────────────────────────────────────────────────────────
// 1024×1536 그림을 1280×1920으로 깔고 가운데 1080을 보인다(ox로 좌우를 옮김). 장면마다 천천히 밀어 들어간다.
const Scene: React.FC<{
  src: string;
  from: number;
  to: number;
  ox?: number;
  focus: [number, number];
  zoom?: [number, number];
  punch?: boolean;
  shake?: [number, number];
  blur?: number;
  css?: string;
}> = ({ src, from, to, ox = 0, focus, zoom = [1, 1.06], punch, shake, blur = 0, css }) => {
  const frame = useCurrentFrame();
  const t0 = fr(from);
  const t1 = fr(to);
  let s = interpolate(frame, [t0, t1], zoom, clamp);
  if (punch) s *= interpolate(frame, [t0, t0 + 5], [1.1, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  let dx = 0;
  if (shake && frame >= fr(shake[0]) && frame < fr(shake[1])) {
    const k = interpolate(frame, [fr(shake[0]), fr(shake[1])], [1, 0], clamp);
    dx = Math.sin(frame * 2.6) * 9 * k;
  }
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#3a2a20' }}>
      <Img
        src={staticFile(`img/${src}`)}
        style={{
          position: 'absolute',
          left: -100 + ox + dx,
          top: 0,
          width: 1280,
          height: 1920,
          transform: `scale(${s})`,
          transformOrigin: `${focus[0] + 100 - ox}px ${focus[1]}px`,
          filter: css ?? (blur ? `blur(${blur}px)` : undefined),
        }}
      />
    </AbsoluteFill>
  );
};

// ── 글 ─────────────────────────────────────────────────────────────────────
const TopShade: React.FC<{ h?: number; a?: number }> = ({ h = 640, a = 0.62 }) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      top: 0,
      width: 1080,
      height: h,
      background: `linear-gradient(180deg, rgba(22,15,10,${a}) 0%, rgba(22,15,10,${a * 0.7}) 55%, rgba(22,15,10,0) 100%)`,
    }}
  />
);

const PovTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [fr(T.s2) - 4, fr(T.s2)], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <TopShade h={860} a={0.66} />
      <div style={{ position: 'absolute', top: 285, left: 0, width: 1080, textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-block',
            background: CORAL,
            color: '#fff',
            fontFamily: EN,
            fontWeight: 800,
            fontSize: 48,
            letterSpacing: 2,
            padding: '8px 30px 10px',
            borderRadius: 18,
          }}
        >
          POV:
        </div>
        <div
          style={{
            marginTop: 22,
            color: '#fff',
            fontFamily: EN,
            fontWeight: 800,
            fontSize: 84,
            lineHeight: 1.08,
            textShadow: '0 4px 18px rgba(0,0,0,0.55)',
          }}
        >
          you learned Korean
          <br />
          from an app
        </div>
        {/* v1 시험 「뭘 배우는 영상인지 아직 안 보인다」 — 할 일(커피 주문)을 첫 화면에 */}
        <div
          style={{
            marginTop: 16,
            color: BUTTER,
            fontFamily: EN,
            fontWeight: 800,
            fontSize: 52,
            textShadow: '0 4px 14px rgba(0,0,0,0.55)',
          }}
        >
          …and now you order coffee
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 바리스타 자막 — 한국어(작게) + 영어(크게)
const Sub: React.FC<{ from: number; to: number; ko: string; en: string; y?: number }> = ({ from, to, ko, en, y = 1230 }) => {
  const frame = useCurrentFrame();
  const p = usePop(from, 16);
  if (frame < fr(from) || frame >= fr(to)) return null;
  const out = interpolate(frame, [fr(to) - 3, fr(to)], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', top: y, left: 0, width: 1080, textAlign: 'center', opacity: out }}>
      <div
        style={{
          display: 'inline-block',
          maxWidth: 880,
          background: 'rgba(24,18,14,0.82)',
          borderRadius: 30,
          padding: '20px 40px 24px',
          transform: `scale(${0.85 + 0.15 * p})`,
        }}
      >
        <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 46, color: '#FFE9B8', lineHeight: 1.25 }}>{ko}</div>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 60, color: '#fff', lineHeight: 1.15, marginTop: 6 }}>{en}</div>
      </div>
    </div>
  );
};

// 몽글 말풍선 — 앱에서 외운 문장(한국어 크게 + 영어) · 꼬리는 몽글 쪽
const Bubble: React.FC<{
  from: number;
  to: number;
  ko: React.ReactNode;
  en: string;
  top: number;
  tailX: number;
  tag?: string;
  koSize?: number;
  wobble?: boolean;
}> = ({ from, to, ko, en, top, tailX, tag, koSize = 66, wobble }) => {
  const frame = useCurrentFrame();
  const p = usePop(from, 11);
  if (frame < fr(from) || frame >= fr(to)) return null;
  const out = interpolate(frame, [fr(to) - 3, fr(to)], [1, 0], clamp);
  const rot = wobble ? Math.sin(frame * 1.9) * 1.6 : 0;
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 70,
        width: 940,
        opacity: out,
        transform: `scale(${0.6 + 0.4 * p}) rotate(${rot}deg)`,
        transformOrigin: `${tailX - 70}px 100%`,
      }}
    >
      {tag ? (
        <div style={{ textAlign: 'left', marginBottom: 14, marginLeft: 26 }}>
          <span
            style={{
              display: 'inline-block',
              background: MINT_BG,
              color: MINT_INK,
              fontFamily: EN,
              fontWeight: 800,
              fontSize: 36,
              padding: '8px 22px 10px',
              borderRadius: 16,
              boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
            }}
          >
            {tag}
          </span>
        </div>
      ) : null}
      <div
        style={{
          position: 'relative',
          background: CREAM,
          borderRadius: 46,
          padding: '34px 44px 36px',
          textAlign: 'center',
          boxShadow: '0 14px 40px rgba(0,0,0,0.28)',
          border: `5px solid ${INK}`,
        }}
      >
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: koSize, color: INK, lineHeight: 1.22, wordBreak: 'keep-all' }}>{ko}</div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 46, color: '#C2412F', lineHeight: 1.2, marginTop: 14 }}>{en}</div>
        {/* 꼬리 */}
        <div
          style={{
            position: 'absolute',
            left: tailX - 70 - 30,
            bottom: -44,
            width: 0,
            height: 0,
            borderLeft: '30px solid transparent',
            borderRight: '30px solid transparent',
            borderTop: `46px solid ${INK}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: tailX - 70 - 21,
            bottom: -33,
            width: 0,
            height: 0,
            borderLeft: '21px solid transparent',
            borderRight: '21px solid transparent',
            borderTop: `34px solid ${CREAM}`,
          }}
        />
      </div>
    </div>
  );
};

// 바리스타 장면 도장 — v2 시험 「왜 어색한지 설명이 없다」: 틀린 말이 아니라 너무 딱딱한 말이라는 것만
const Stamp: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const frame = useCurrentFrame();
  const p = usePop(from, 9);
  if (frame < fr(from) || frame >= fr(to)) return null;
  return (
    <div style={{ position: 'absolute', top: 300, left: 90, transform: `rotate(-7deg) scale(${1.5 - 0.5 * p})`, opacity: Math.min(1, p * 1.4) }}>
      <div
        style={{
          border: `8px solid ${CORAL}`,
          color: CORAL,
          background: 'rgba(255,248,236,0.92)',
          fontFamily: EN,
          fontWeight: 900,
          fontSize: 64,
          letterSpacing: 2,
          padding: '6px 26px 10px',
          borderRadius: 18,
        }}
      >
        WAY TOO FORMAL
      </div>
    </div>
  );
};

// ── Real Korean 칸 ─────────────────────────────────────────────────────────
// 세 조각은 칸이 열릴 때 한꺼번에 보이고(뜻도 함께), 그 낱말이 들릴 때 노랗게 켜지며 한 번 튄다.
// v1은 들릴 때 하나씩 나타나 「하나 · 주세요 뜻을 나중에야 알았다 · 읽기 바빴다」였다.
const Chip: React.FC<{ show: number; at: number; ko: string; gloss: string; lit: boolean }> = ({ show, at, ko, gloss, lit }) => {
  const frame = useCurrentFrame();
  const p = usePop(show, 12);
  const shown = frame >= fr(show);
  const bump = interpolate(frame, [fr(at), fr(at) + 4, fr(at) + 10], [1, 1.1, 1], clamp);
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', margin: '0 12px', opacity: shown ? 1 : 0 }}>
      <div
        style={{
          background: lit ? BUTTER : CREAM,
          color: INK,
          fontFamily: KO,
          fontWeight: 800,
          fontSize: 86,
          lineHeight: 1.1,
          padding: '14px 30px 18px',
          borderRadius: 28,
          boxShadow: '0 10px 28px rgba(0,0,0,0.3)',
          transform: `scale(${(0.7 + 0.3 * p) * bump})`,
        }}
      >
        {ko}
      </div>
      <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 42, color: '#fff', marginTop: 14, opacity: p }}>{gloss}</div>
    </div>
  );
};

const Lesson: React.FC = () => {
  const frame = useCurrentFrame();
  const inP = usePop(T.lesson, 14);
  const n2 = T.n2;
  const tIce = n2 + N2_WORDS.ice;
  const tHana = n2 + N2_WORDS.hana;
  const tJu = n2 + N2_WORDS.juseyo;
  const tEnd = n2 + N2_WORDS.end;
  const sec = frame / 30;
  const lit = (a: number, b: number) => (sec >= a && sec < b) || (sec >= T.turnGap[0] && sec < T.turnGap[1]);
  const anyP = usePop(T.anyItem, 14);
  const turnP = usePop(T.n3, 12);
  const gap = interpolate(frame, [fr(T.turnGap[0]), fr(T.turnGap[1])], [1, 0], clamp);
  return (
    <AbsoluteFill>
      {/* v2 시험 「흐린 배경에 글자 4~5초 고정이라 밋밋하다」 — 카페가 멈춘 장면(⏸) 위에서 배운다: 바리스타는 기다리고 몽글은 땀 흘리는 채 */}
      <Scene src="s1.jpg" from={T.lesson} to={T.s5} ox={45} focus={[330, 1250]} zoom={[1.05, 1.12]} css="grayscale(0.85) brightness(0.6)" />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(14,10,8,0.55) 0%, rgba(14,10,8,0.35) 60%, rgba(14,10,8,0.15) 100%)' }} />
      <div style={{ position: 'absolute', top: 285, left: 0, width: 1080, textAlign: 'center', transform: `translateY(${(1 - inP) * 40}px)`, opacity: inP }}>
        <span
          style={{
            display: 'inline-block',
            background: CORAL,
            color: '#fff',
            fontFamily: EN,
            fontWeight: 800,
            fontSize: 50,
            letterSpacing: 1.5,
            padding: '12px 34px 14px',
            borderRadius: 20,
          }}
        >
          <span style={{ display: 'inline-block', width: 12, height: 40, background: '#fff', borderRadius: 3, marginRight: 8, verticalAlign: '-4px' }} />
          <span style={{ display: 'inline-block', width: 12, height: 40, background: '#fff', borderRadius: 3, marginRight: 24, verticalAlign: '-4px' }} />
          REAL KOREAN THAT WORKS
        </span>
      </div>
      <div style={{ position: 'absolute', top: 430, left: 0, width: 1080, textAlign: 'center' }}>
        <Chip show={T.lesson + 0.08} at={tIce} ko="아이스 아메리카노" gloss="iced americano" lit={lit(tIce, tHana)} />
      </div>
      <div style={{ position: 'absolute', top: 690, left: 0, width: 1080, textAlign: 'center' }}>
        <Chip show={T.lesson + 0.16} at={tHana} ko="하나" gloss="one" lit={lit(tHana, tJu)} />
        <Chip show={T.lesson + 0.24} at={tJu} ko="주세요" gloss="please" lit={lit(tJu, tEnd + 0.3)} />
      </div>
      <div
        style={{
          position: 'absolute',
          top: 965,
          left: 0,
          width: 1080,
          textAlign: 'center',
          opacity: anyP,
          transform: `translateY(${(1 - anyP) * 24}px)`,
          fontFamily: EN,
          fontWeight: 800,
          fontSize: 48,
          color: '#fff',
          textShadow: '0 3px 12px rgba(0,0,0,0.6)',
        }}
      >
        any menu item + <span style={{ fontFamily: KO, fontWeight: 800, color: BUTTER }}>하나 주세요</span> ✓
      </div>
      {frame >= fr(T.n3) ? (
        <div style={{ position: 'absolute', top: 1065, left: 0, width: 1080, textAlign: 'center', opacity: turnP, transform: `scale(${0.7 + 0.3 * turnP})` }}>
          <div
            style={{
              display: 'inline-block',
              background: '#fff',
              color: INK,
              fontFamily: EN,
              fontWeight: 800,
              fontSize: 50,
              padding: '14px 36px 18px',
              borderRadius: 999,
            }}
          >
            YOUR TURN: say it out loud!
          </div>
          <div style={{ width: 520, height: 14, margin: '22px auto 0', borderRadius: 7, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
            <div style={{ width: `${gap * 100}%`, height: '100%', background: BUTTER, borderRadius: 7 }} />
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const p = usePop(T.end + 0.05, 13);
  return (
    <AbsoluteFill>
      <TopShade h={720} a={0.7} />
      <div
        style={{
          position: 'absolute',
          top: 280,
          left: 60,
          width: 960,
          textAlign: 'center',
          color: '#fff',
          fontFamily: EN,
          fontWeight: 800,
          fontSize: 76,
          lineHeight: 1.12,
          textShadow: '0 4px 18px rgba(0,0,0,0.55)',
          opacity: p,
          transform: `scale(${0.8 + 0.2 * p})`,
        }}
      >
        What&apos;s the weirdest<br />sentence your app<br />taught you? 👇
      </div>
    </AbsoluteFill>
  );
};

// ── 소리 ───────────────────────────────────────────────────────────────────
const Vo: React.FC<{ id: string; t: number; vol?: number }> = ({ id, t, vol = 1 }) => (
  <Sequence from={fr(t)} layout="none">
    <Audio src={staticFile(`vo/${id}.wav`)} volume={vol * MASTER} />
  </Sequence>
);
const Sfx: React.FC<{ file: string; t: number; vol?: number }> = ({ file, t, vol = 1 }) => (
  <Sequence from={Math.max(0, fr(t))} layout="none">
    <Audio src={staticFile(`sfx/${file}`)} volume={vol * MASTER} />
  </Sequence>
);

const Sound: React.FC = () => {
  const total = fr(T.total);
  // 말하는 동안 배경음을 낮추고(목소리 아래로), 멘붕 장면에서는 멈춘다
  const talk: [number, number][] = [
    [T.b1, T.b1 + 1.1],
    [T.b2, T.b2 + 2.7],
    [T.n2, T.n2 + 2.5],
    [T.n3, T.turnGap[1]],
    [T.b3, T.b3 + 2.1],
    [T.n4, T.n4 + 2.6],
  ];
  const bgmVol = (i: number) => {
    const sec = i / 30;
    if (sec >= T.s4 && sec < T.lesson) return 0;
    const under = talk.some(([a, b]) => sec >= a - 0.1 && sec < b + 0.1);
    const base = under ? 0.045 : 0.11;
    const fadeOut = interpolate(i, [total - 24, total], [1, 0], clamp);
    return base * MASTER * fadeOut;
  };
  const cafeVol = (i: number) => {
    const sec = i / 30;
    const v = sec < T.s4 ? 0.55 : sec < T.lesson ? 0.25 : sec < T.s5 ? 0.12 : 0.45;
    return v * MASTER * interpolate(i, [total - 20, total], [1, 0], clamp);
  };
  return (
    <>
      <Audio src={staticFile('bgm.wav')} volume={bgmVol} />
      <Audio src={staticFile('sfx/cafe.wav')} volume={cafeVol} />
      <Vo id="b1" t={T.b1} />
      <Sfx file="ding1.wav" t={T.bubble1 - 0.05} vol={0.5} />
      <Sfx file="mongle_mii.wav" t={T.bubble1 + 0.05} vol={0.7} />
      <Vo id="b2" t={T.b2} />
      <Sfx file="dizzy.wav" t={T.s4} vol={0.42} />
      <Sfx file="mongle_ppuu.wav" t={T.bubble2 + 0.15} vol={0.75} />
      <Sfx file="bassdown.wav" t={T.lesson - 0.05} vol={0.32} />
      <Vo id="n2" t={T.n2} />
      <Sfx file="pop.wav" t={T.n2 + N2_WORDS.ice} vol={0.25} />
      <Sfx file="pop.wav" t={T.n2 + N2_WORDS.hana} vol={0.25} />
      <Sfx file="pop.wav" t={T.n2 + N2_WORDS.juseyo} vol={0.25} />
      <Sfx file="tok.wav" t={T.anyItem} vol={0.3} />
      <Vo id="n3" t={T.n3} />
      <Sfx file="tick.wav" t={T.turnGap[0]} vol={0.35} />
      <Sfx file="tick.wav" t={T.turnGap[0] + 0.5} vol={0.35} />
      <Sfx file="tick.wav" t={T.turnGap[0] + 1.0} vol={0.35} />
      <Sfx file="mongle_myang.wav" t={T.bubble3} vol={0.75} />
      <Sfx file="sparkle.wav" t={T.bubble3 + 0.05} vol={0.3} />
      <Sfx file="ice.wav" t={T.b3 - 0.2} vol={0.9} />
      <Vo id="b3" t={T.b3} />
      <Sfx file="tok.wav" t={T.end + 0.05} vol={0.3} />
      <Vo id="n4" t={T.n4} />
    </>
  );
};

// ── 전체 ───────────────────────────────────────────────────────────────────
export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const sec = frame / 30;
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a1d16' }}>
      {sec < T.s2 ? <Scene src="s1.jpg" from={0} to={T.s2} ox={45} focus={[330, 1250]} zoom={[1.0, 1.05]} /> : null}
      {sec >= T.s2 && sec < T.s3 ? <Scene src="s2.jpg" from={T.s2} to={T.s3} focus={[420, 1150]} zoom={[1.02, 1.08]} /> : null}
      {sec >= T.s3 && sec < T.s4 ? <Scene src="s3.jpg" from={T.s3} to={T.s4} focus={[540, 700]} zoom={[1.0, 1.07]} /> : null}
      {sec >= T.s4 && sec < T.lesson ? <Scene src="s4.jpg" from={T.s4} to={T.lesson} focus={[520, 1150]} zoom={[1.02, 1.07]} punch shake={[T.s4, T.s4 + 0.6]} /> : null}
      {sec >= T.lesson && sec < T.s5 ? <Lesson /> : null}
      {sec >= T.s5 ? <Scene src="s5.jpg" from={T.s5} to={T.total} focus={[460, 1920]} zoom={[1.15, 1.2]} /> : null}

      {sec < T.s2 ? <PovTitle /> : null}
      <Sub from={T.b1 - 0.05} to={T.s2} ko="주문하시겠어요?" en="Ready to order?" y={830} />
      <Bubble
        from={T.bubble1}
        to={T.s3}
        top={250}
        tailX={430}
        tag="📱 textbook Korean"
        ko={<>안녕하십니까.<br />저는 커피를 원합니다.</>}
        en="“Greetings. I desire coffee.”"
      />
      <Stamp from={T.s3 + 0.2} to={T.s4} />
      <Sub from={T.b2} to={T.s4} ko="아, 네. 따뜻한 거요, 아이스요?" en="Uh, okay. Hot or iced?" />
      <Bubble
        from={T.bubble2}
        to={T.lesson}
        top={250}
        tailX={460}
        tag="😵 panic → random app sentence"
        ko={<>사과는…<br />빨갛습니다.</>}
        en="“The apple… is red.”"
        koSize={74}
        wobble
      />
      <Bubble
        from={T.bubble3}
        to={T.end}
        top={545}
        tailX={330}
        ko={<>아이스 아메리카노<br />하나 주세요!</>}
        en="“One iced americano, please!”"
        koSize={60}
      />
      <Sub from={T.b3} to={T.end} ko="네, 아이스 아메리카노 하나요!" en="Sure! One iced americano." y={1240} />
      {sec >= T.end ? <EndCard /> : null}
      <Sound />
    </AbsoluteFill>
  );
};
