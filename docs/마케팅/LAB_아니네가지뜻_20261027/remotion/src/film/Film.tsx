// LAB E4 「아니」 — 펠트 카페 콩트 24초(B 갈래 셋째 편, E8 「다음에 밥 한번 먹어요」 Film.tsx를 옮김).
// 장면 그림 넉 장(GPT 이미지 2.5, 몽글은 장면째 구움)을 컷으로 잇고, 말풍선 · 자막 · Real Korean 칸은 코드로 그린다.
// 몽글은 말하지 않는다(말풍선 + 사운드킷 몽글 소리). 한국어 소리는 바리스타(범수) 둘 — 「아니?!」 · 「아니~ 뭘 이런 걸!」.
// 「먼저:」 억양 시험(음성/억양시험.json)에서 맨 「아니.」(no)는 끝이 올라 「아니?」로 들려 소리로 내지 않고 교과서 꼬리표 글로만 둔다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { B1_DUR, B2_DUR, fr, N1_WORDS, T } from './timeline';
import { LOCALES, type Loc, type LocText } from './locale';

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

const PovTitle: React.FC<{ L: LocText }> = ({ L }) => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [fr(T.s2) - 4, fr(T.s2)], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <TopShade h={820} a={0.66} />
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
          {L.pov.kicker}
        </div>
        <div
          style={{
            marginTop: 22,
            color: '#fff',
            fontFamily: EN,
            fontWeight: 800,
            fontSize: L.pov.titleSize,
            lineHeight: 1.08,
            textShadow: '0 4px 18px rgba(0,0,0,0.55)',
          }}
        >
          {L.pov.title.map((t, i) => (
            <React.Fragment key={t}>
              {i > 0 ? <br /> : null}
              {t}
            </React.Fragment>
          ))}
        </div>
        <div
          style={{
            marginTop: 16,
            color: BUTTER,
            fontFamily: EN,
            fontWeight: 800,
            fontSize: L.pov.subSize,
            textShadow: '0 4px 14px rgba(0,0,0,0.55)',
          }}
        >
          {L.pov.sub}
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

// 몽글 말풍선 — 한국어 크게 + 영어 · 꼬리는 몽글 쪽
const Bubble: React.FC<{
  from: number;
  to: number;
  ko: React.ReactNode;
  en: string;
  top: number;
  tailX: number;
  tag?: string;
  koSize?: number;
  enSize?: number;
  wobble?: boolean;
  left?: number;
  width?: number;
}> = ({ from, to, ko, en, top, tailX, tag, koSize = 66, enSize = 46, wobble, left = 70, width = 940 }) => {
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
        left,
        width,
        opacity: out,
        transform: `scale(${0.6 + 0.4 * p}) rotate(${rot}deg)`,
        transformOrigin: `${tailX - left}px 100%`,
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
              fontSize: 40,
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
          padding: '30px 40px 32px',
          textAlign: 'center',
          boxShadow: '0 14px 40px rgba(0,0,0,0.28)',
          border: `5px solid ${INK}`,
        }}
      >
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: koSize, color: INK, lineHeight: 1.22, wordBreak: 'keep-all' }}>{ko}</div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: enSize, color: '#C2412F', lineHeight: 1.2, marginTop: 12 }}>{en}</div>
        {/* 꼬리 */}
        <div
          style={{
            position: 'absolute',
            left: tailX - left - 30,
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
            left: tailX - left - 21,
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

// ── Real Korean 칸 ─────────────────────────────────────────────────────────
// 두 줄(「아니?!」 · 「아니~ 뭘 이런 걸!」)과 뜻은 칸이 열릴 때 한꺼번에 보이고, 바리스타 소리가 다시 들릴 때 그 줄이 노랗게 켜진다.
// 줄 옆 선은 억양 시험에서 잰 음높이 모양(아니?! 끝이 솟음 · 아니~ 오르내림)을 그린 것이다.
const Line: React.FC<{ show: number; at: number; lit: boolean; size: number; children: React.ReactNode }> = ({ show, at, lit, size, children }) => {
  const frame = useCurrentFrame();
  const p = usePop(show, 12);
  const bump = interpolate(frame, [fr(at), fr(at) + 4, fr(at) + 10], [1, 1.08, 1], clamp);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 18,
        background: lit ? BUTTER : CREAM,
        color: INK,
        fontFamily: KO,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.1,
        padding: '14px 32px 18px',
        borderRadius: 28,
        boxShadow: '0 10px 28px rgba(0,0,0,0.3)',
        opacity: frame >= fr(show) ? 1 : 0,
        transform: `scale(${(0.7 + 0.3 * p) * bump})`,
      }}
    >
      {children}
    </div>
  );
};

const Pitch: React.FC<{ kind: 'up' | 'wave' }> = ({ kind }) => (
  <svg width={86} height={60} viewBox="0 0 86 60" style={{ flex: 'none' }}>
    {kind === 'up' ? (
      <>
        <path d="M6 50 C 34 50, 52 40, 70 12" fill="none" stroke={CORAL} strokeWidth={9} strokeLinecap="round" />
        <path d="M56 12 L 72 8 L 74 26" fill="none" stroke={CORAL} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
      </>
    ) : (
      <path d="M6 30 C 18 6, 28 6, 38 30 S 58 54, 68 30 S 78 14, 82 18" fill="none" stroke={CORAL} strokeWidth={9} strokeLinecap="round" />
    )}
  </svg>
);

const Lesson: React.FC<{ L: LocText }> = ({ L }) => {
  const frame = useCurrentFrame();
  const inP = usePop(T.lesson, 14);
  const sec = frame / 30;
  const tNot = T.n1 + N1_WORDS.not;
  const tNoEnd = T.n1 + N1_WORDS.end + 0.2;
  const inGap = sec >= T.turnGap[0] && sec < T.turnGap[1];
  const toneP = usePop(T.lesson + 0.25, 14);
  const row1P = usePop(T.lesson + 0.35, 12);
  const row2P = usePop(T.l3, 12);
  const turnP = usePop(T.n3, 12);
  const gap = interpolate(frame, [fr(T.turnGap[0]), fr(T.turnGap[1])], [1, 0], clamp);
  const aniLit = sec >= tNot && sec < tNoEnd;
  const whatLit = sec >= T.rb1 && sec < T.rb1 + B1_DUR + 0.25;
  const awwLit = (sec >= T.rb2 && sec < T.rb2 + B2_DUR + 0.2) || inGap;
  const second = sec >= T.l3;
  const p = second ? row2P : row1P;
  const panel: React.CSSProperties = {
    display: 'inline-block',
    background: 'rgba(22,15,10,0.74)',
    borderRadius: 36,
    padding: '22px 44px 26px',
    boxShadow: '0 14px 40px rgba(0,0,0,0.3)',
    opacity: p,
    transform: `translateY(${(1 - p) * 40}px) scale(${0.9 + 0.1 * p})`,
  };
  return (
    <AbsoluteFill>
      {/* 카페가 멈춘 장면(⏸) — 색은 그대로 두고 조금만 누른다. 첫 줄은 놀란 바리스타(S1), 둘째 줄은 빨개진 바리스타(S3) 위에 */}
      {second ? (
        <Scene src="s3.jpg" from={T.l3} to={T.s5} focus={[850, 740]} zoom={[1.05, 1.22]} css="saturate(0.75) brightness(0.82)" />
      ) : (
        <Scene src="s1.jpg" from={T.lesson} to={T.l3} focus={[850, 700]} zoom={[1.05, 1.18]} css="saturate(0.75) brightness(0.82)" />
      )}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(14,10,8,0.62) 0%, rgba(14,10,8,0.25) 32%, rgba(14,10,8,0) 45%, rgba(14,10,8,0.1) 100%)' }} />
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
          {L.lesson.head}
        </span>
      </div>
      {/* 아니 ≠ 늘 「no」 — 말투에 달렸다 */}
      <div style={{ position: 'absolute', top: 385, left: 0, width: 1080, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20 }}>
        <Line show={T.lesson + 0.08} at={tNot} lit={aniLit} size={84}>
          아니
        </Line>
        <span style={{ fontFamily: EN, fontWeight: 800, fontSize: 58, color: aniLit ? BUTTER : '#fff', opacity: inP, textShadow: '0 3px 14px rgba(0,0,0,0.7)' }}>{L.lesson.title}</span>
      </div>
      <div style={{ position: 'absolute', top: 525, left: 0, width: 1080, textAlign: 'center', fontFamily: EN, fontWeight: 800, fontSize: 48, color: BUTTER, opacity: toneP, textShadow: '0 3px 14px rgba(0,0,0,0.75)' }}>
        {L.lesson.tone}
      </div>
      {/* 지금 줄 — 쓰는 때 · 한국어(음높이 선) · 뜻. 바리스타 소리가 다시 들릴 때 켜진다 */}
      <div style={{ position: 'absolute', top: 905, left: 0, width: 1080, textAlign: 'center' }}>
        <div style={panel}>
          <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 44, color: '#FFE9B8', marginBottom: 12 }}>{second ? L.lesson.whenAww : L.lesson.whenWhat}</div>
          <div style={{ display: 'inline-block', transform: `scale(${inGap ? 1 + 0.06 * Math.sin((sec - T.turnGap[0]) * Math.PI * 2) ** 2 : 1})` }}>
            {second ? (
              <Line show={T.l3} at={T.rb2} lit={awwLit} size={78}>
                아니~ 뭘 이런 걸! <Pitch kind="wave" />
              </Line>
            ) : (
              <Line show={T.lesson + 0.35} at={T.rb1} lit={whatLit} size={96}>
                아니?! <Pitch kind="up" />
              </Line>
            )}
          </div>
          <div style={{ fontFamily: EN, fontWeight: 800, fontSize: second ? 48 : 58, color: (second ? awwLit : whatLit) ? BUTTER : '#fff', marginTop: 12 }}>{second ? L.lesson.aww : L.lesson.what}</div>
        </div>
      </div>
      {frame >= fr(T.n3) ? (
        <div style={{ position: 'absolute', top: 1232, left: 0, width: 1080, textAlign: 'center', opacity: turnP, transform: `scale(${0.7 + 0.3 * turnP})` }}>
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
              boxShadow: '0 10px 28px rgba(0,0,0,0.3)',
            }}
          >
            {L.lesson.turn}
          </div>
          <div style={{ width: 520, height: 14, margin: '20px auto 0', borderRadius: 7, background: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
            <div style={{ width: `${gap * 100}%`, height: '100%', background: BUTTER, borderRadius: 7 }} />
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{ L: LocText }> = ({ L }) => {
  const p = usePop(T.end + 0.05, 13);
  return (
    <AbsoluteFill>
      <TopShade h={780} a={0.7} />
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
          fontSize: L.endSize,
          lineHeight: 1.12,
          textShadow: '0 4px 18px rgba(0,0,0,0.55)',
          opacity: p,
          transform: `scale(${0.8 + 0.2 * p})`,
        }}
      >
        {L.end.map((t, i) => (
          <React.Fragment key={t}>
            {i > 0 ? <br /> : null}
            {t}
          </React.Fragment>
        ))}
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

const Sound: React.FC<{ voice: boolean }> = ({ voice }) => {
  const total = fr(T.total);
  // 말하는 동안 배경음을 낮춘다(목소리 아래로)
  const talk: [number, number][] = [
    [T.b1, T.b1 + B1_DUR + 0.1],
    [T.b2, T.b2 + B2_DUR + 0.1],
    [T.n1, T.rb2 + B2_DUR + 0.1],
    [T.n3, T.turnGap[1]],
    [T.b3, T.b3 + 1.15],
    [T.n4, T.n4 + 2.8],
  ];
  const bgmVol = (i: number) => {
    const sec = i / 30;
    const under = talk.some(([a, b]) => sec >= a - 0.1 && sec < b + 0.1);
    const base = under ? 0.045 : 0.11;
    const fadeOut = interpolate(i, [total - 24, total], [1, 0], clamp);
    return base * MASTER * fadeOut;
  };
  const cafeVol = (i: number) => {
    const sec = i / 30;
    const v = sec < T.lesson ? 0.45 : sec < T.s5 ? 0.12 : 0.45;
    return v * MASTER * interpolate(i, [total - 20, total], [1, 0], clamp);
  };
  return (
    <>
      <Audio src={staticFile('bgm.wav')} volume={bgmVol} />
      <Audio src={staticFile('sfx/cafe.wav')} volume={cafeVol} />
      {/* 동전 쏟아지는 소리 — 얼음 잔 소리를 짧게 */}
      <Sfx file="ice.wav" t={0} vol={0.55} />
      <Vo id="b1" t={T.b1} />
      <Sfx file="ding1.wav" t={T.bubble1 - 0.05} vol={0.45} />
      <Sfx file="mongle_ppuu.wav" t={T.bubble1 + 0.05} vol={0.75} />
      <Vo id="b2" t={T.b2} />
      <Sfx file="sparkle.wav" t={T.b2 + 0.1} vol={0.25} />
      <Sfx file="dizzy.wav" t={T.bubbleAgain} vol={0.35} />
      <Sfx file="whoosh.wav" t={T.lesson - 0.1} vol={0.3} />
      {voice ? <Vo id="n1" t={T.n1} /> : null}
      <Vo id="b1" t={T.rb1} />
      <Sfx file="pop.wav" t={T.rb1} vol={0.2} />
      <Vo id="b2" t={T.rb2} />
      <Sfx file="pop.wav" t={T.rb2} vol={0.2} />
      {voice ? <Vo id="n3" t={T.n3} /> : null}
      <Sfx file="tick.wav" t={T.turnGap[0]} vol={0.35} />
      <Sfx file="tick.wav" t={T.turnGap[0] + 0.5} vol={0.35} />
      <Sfx file="tick.wav" t={T.turnGap[0] + 1.0} vol={0.35} />
      <Vo id="b3" t={T.b3} />
      <Sfx file="mongle_myang.wav" t={T.bubble2} vol={0.75} />
      <Sfx file="sparkle.wav" t={T.bubble2 + 0.05} vol={0.3} />
      <Sfx file="tok.wav" t={T.end + 0.05} vol={0.3} />
      {voice ? <Vo id="n4" t={T.n4} /> : null}
    </>
  );
};

// ── 전체 ───────────────────────────────────────────────────────────────────
export const Film: React.FC<{ loc?: Loc }> = ({ loc = 'en' }) => {
  const frame = useCurrentFrame();
  const sec = frame / 30;
  const L = LOCALES[loc];
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a1d16', ...(L.font ? ({ '--kids-font': L.font } as React.CSSProperties) : {}) }}>
      {sec < T.s2 ? <Scene src="s1.jpg" from={0} to={T.s2} focus={[620, 1250]} zoom={[1.0, 1.06]} shake={[T.b1, T.b1 + 0.4]} /> : null}
      {sec >= T.s2 && sec < T.s3 ? <Scene src="s2.jpg" from={T.s2} to={T.s3} ox={30} focus={[420, 1250]} zoom={[1.02, 1.09]} punch /> : null}
      {sec >= T.s3 && sec < T.lesson ? <Scene src="s3.jpg" from={T.s3} to={T.lesson} focus={[700, 900]} zoom={[1.0, 1.07]} /> : null}
      {sec >= T.lesson && sec < T.s5 ? <Lesson L={L} /> : null}
      {sec >= T.s5 ? <Scene src="s5.jpg" from={T.s5} to={T.total} focus={[420, 1250]} zoom={[1.0, 1.1]} /> : null}

      {sec < T.s2 ? <PovTitle L={L} /> : null}
      <Sub from={T.b1 - 0.05} to={T.s2} ko="아니?!" en={L.sub1} y={1290} />
      <Bubble
        from={T.bubble1}
        to={T.s3}
        top={250}
        tailX={330}
        tag={L.bubble1.tag}
        ko={<>“아니” = NO?! 😰</>}
        en={L.bubble1.line}
        koSize={80}
        enSize={50}
        wobble
      />
      <Sub from={T.b2} to={T.lesson} ko="아니~ 뭘 이런 걸!" en={L.sub2} y={1290} />
      {/* 몽글 머리 위 왼쪽 빈 자리 — 바리스타 얼굴을 가리지 않게 좁은 말풍선 */}
      <Bubble from={T.bubbleAgain} to={T.lesson} top={700} left={50} width={470} tailX={260} ko={<>또 “아니”?! 😵</>} en={L.again} koSize={58} />
      {/* 아래에 두면 쿠키 접시를 가린다(v1) — 메뉴판 자리로 */}
      <Sub from={T.b3} to={T.end} ko="서비스예요!" en={L.sub3} y={300} />
      <Bubble from={T.bubble2} to={T.end} top={640} left={40} width={600} tailX={270} ko={<>아니~ 뭘 이런 걸! 🥹</>} en={L.bubble2} koSize={58} enSize={40} />
      {sec >= T.end ? <EndCard L={L} /> : null}
      <Sound voice={L.voice} />
    </AbsoluteFill>
  );
};
