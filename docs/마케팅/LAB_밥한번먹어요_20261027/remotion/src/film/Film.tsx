// LAB E8 「다음에 밥 한번 먹어요」 — 펠트 카페 콩트 24초(B 갈래 둘째 편, E3 「앱으로 배운 한국어」 Film.tsx를 옮김).
// 장면 그림 넉 장(GPT 이미지 2.5, 몽글은 장면째 구움)을 컷으로 잇고, 말풍선 · 자막 · Real Korean 칸은 코드로 그린다.
// 몽글은 말하지 않는다(말풍선 + 사운드킷 몽글 소리). 한국어 소리는 바리스타(범수)와 해설(하나).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { fr, N1_WORDS, N2_WORDS, T } from './timeline';
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
        {/* v1 시험 「뭘 배우는 영상인지 아직 안 보인다」 — 할 일(커피 주문)을 첫 화면에 */}
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
  left?: number;
  width?: number;
}> = ({ from, to, ko, en, top, tailX, tag, koSize = 66, wobble, left = 70, width = 940 }) => {
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

// 바리스타 장면 도장 — 진짜 약속이 아니라는 것만(E3 v2 시험 「왜 어색한지 설명이 없다」의 교훈)
const Stamp: React.FC<{ from: number; to: number; text: string }> = ({ from, to, text }) => {
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
        {text}
      </div>
    </div>
  );
};

// ── Real Korean 칸 ─────────────────────────────────────────────────────────
// 두 줄(들은 말 → 뜻, 대답할 말)은 칸이 열릴 때 한꺼번에 보이고(뜻도 함께), 그 말이 들릴 때 노랗게 켜지며 한 번 튄다.
// E3 v1은 들릴 때 하나씩 나타나 「뜻을 나중에야 알았다 · 읽기 바빴다」였다.
const Line: React.FC<{ show: number; at: number; lit: boolean; size: number; children: React.ReactNode }> = ({ show, at, lit, size, children }) => {
  const frame = useCurrentFrame();
  const p = usePop(show, 12);
  const bump = interpolate(frame, [fr(at), fr(at) + 4, fr(at) + 10], [1, 1.08, 1], clamp);
  return (
    <div
      style={{
        display: 'inline-block',
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

const Lesson: React.FC<{ L: LocText }> = ({ L }) => {
  const frame = useCurrentFrame();
  const inP = usePop(T.lesson, 14);
  const sec = frame / 30;
  const tNot = T.n1 + N1_WORDS.not;
  const tSee = T.n1 + N1_WORDS.see;
  const tNe = T.n2 + N2_WORDS.ne;
  const tNeEnd = T.n2 + N2_WORDS.end;
  const inGap = sec >= T.turnGap[0] && sec < T.turnGap[1];
  const glossP = usePop(T.lesson + 0.2, 14);
  const turnP = usePop(T.n3, 12);
  const gap = interpolate(frame, [fr(T.turnGap[0]), fr(T.turnGap[1])], [1, 0], clamp);
  const notLit = sec >= tNot && sec < tSee;
  const seeLit = sec >= tSee && sec < T.n2;
  const seeBump = interpolate(frame, [fr(tSee), fr(tSee) + 4, fr(tSee) + 10], [1, 1.1, 1], clamp);
  const k = L.lessonScale ?? 1;
  return (
    <AbsoluteFill>
      {/* 카페가 멈춘 장면(⏸) 위에서 배운다 — 바리스타는 손을 든 채, 몽글은 반짝이는 채 */}
      {/* 올리기 전 검사 「정지 27% · 15~18.5초 정지」(v3) — 11초 칸이라 E3보다 배경을 더 크게 밀어 들어간다 */}
      <Scene src="s1.jpg" from={T.lesson} to={T.s5} ox={-20} focus={[620, 900]} zoom={[1.03, 1.3]} css={L.freezeCss ?? 'grayscale(0.85) brightness(0.6)'} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(14,10,8,0.6) 0%, rgba(14,10,8,0.4) 60%, rgba(14,10,8,0.18) 100%)' }} />
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
      {/* 들은 말 → 진짜 뜻 */}
      <div style={{ position: 'absolute', top: 420, left: 0, width: 1080, textAlign: 'center' }}>
        <Line show={T.lesson + 0.08} at={tNot} lit={notLit || seeLit} size={66}>
          다음에 밥 한번 먹어요
        </Line>
      </div>
      <div style={{ position: 'absolute', top: 545, left: 0, width: 1080, textAlign: 'center', fontFamily: EN, fontWeight: 800, opacity: glossP }}>
        <div style={{ fontSize: 46 * k, color: notLit ? BUTTER : 'rgba(255,255,255,0.85)', textShadow: '0 3px 12px rgba(0,0,0,0.6)' }}>{L.lesson.notPlan}</div>
        <div
          style={{
            fontSize: 60 * k,
            marginTop: 6,
            color: seeLit ? BUTTER : '#fff',
            textShadow: '0 3px 14px rgba(0,0,0,0.65)',
            transform: `scale(${seeBump})`,
          }}
        >
          {L.lesson.means}
        </div>
      </div>
      {/* 대답할 말 */}
      <div
        style={{
          position: 'absolute',
          top: 745,
          left: 0,
          width: 1080,
          textAlign: 'center',
          fontFamily: EN,
          fontWeight: 800,
          fontSize: 44 * k,
          color: '#fff',
          opacity: glossP,
          textShadow: '0 3px 12px rgba(0,0,0,0.6)',
        }}
      >
        {L.lesson.justSay}
      </div>
      <div style={{ position: 'absolute', top: 810, left: 0, width: 1080, textAlign: 'center' }}>
        {/* 따라 말할 틈에는 대답 줄이 숨 쉬듯 커졌다 작아진다 */}
        <div style={{ display: 'inline-block', transform: `scale(${inGap ? 1 + 0.06 * Math.sin((sec - T.turnGap[0]) * Math.PI * 2) ** 2 : 1})` }}>
          <Line show={T.lesson + 0.16} at={tNe} lit={(sec >= tNe && sec < tNeEnd + 0.3) || inGap} size={92}>
            네, 좋아요!
          </Line>
        </div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 42 * k, color: '#fff', marginTop: 12, opacity: glossP }}>{L.lesson.joayo}</div>
      </div>
      {frame >= fr(T.n3) ? (
        <div style={{ position: 'absolute', top: 1095, left: 0, width: 1080, textAlign: 'center', opacity: turnP, transform: `scale(${0.7 + 0.3 * turnP})` }}>
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
            {L.lesson.again && sec < T.turnGap[0] ? L.lesson.again : L.lesson.turn}
          </div>
          <div style={{ width: 520, height: 14, margin: '22px auto 0', borderRadius: 7, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
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
      <TopShade h={760} a={0.7} />
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
  // 말하는 동안 배경음을 낮추고(목소리 아래로), 바리스타가 굳는 장면에서는 멈춘다
  const talk: [number, number][] = [
    [T.b1, T.b1 + 1.65],
    [T.b2, T.b2 + 2.4],
    voice ? [T.n1, T.n1 + 4.2] : [T.n1 + 0.2, T.n1 + 1.9],
    [T.n2, T.n2 + 1.8],
    [T.n3, T.turnGap[1]],
    [T.b3, T.b3 + 1.15],
    ...(voice ? [[T.n4, T.n4 + 2.9] as [number, number]] : []),
  ];
  const bgmVol = (i: number) => {
    const sec = i / 30;
    if (sec >= T.s3 && sec < T.lesson) return 0;
    const under = talk.some(([a, b]) => sec >= a - 0.1 && sec < b + 0.1);
    const base = under ? 0.045 : 0.11;
    const fadeOut = interpolate(i, [total - 24, total], [1, 0], clamp);
    return base * MASTER * fadeOut;
  };
  const cafeVol = (i: number) => {
    const sec = i / 30;
    const v = sec < T.s3 ? 0.55 : sec < T.lesson ? 0.3 : sec < T.s5 ? 0.12 : 0.45;
    return v * MASTER * interpolate(i, [total - 20, total], [1, 0], clamp);
  };
  return (
    <>
      <Audio src={staticFile('bgm.wav')} volume={bgmVol} />
      <Audio src={staticFile('sfx/cafe.wav')} volume={cafeVol} />
      <Vo id="b1" t={T.b1} />
      <Sfx file="ding1.wav" t={T.bubble1 - 0.05} vol={0.5} />
      <Sfx file="mongle_ppong.wav" t={T.bubble1 + 0.05} vol={0.7} />
      <Sfx file="sparkle.wav" t={T.bubble1 + 0.1} vol={0.25} />
      <Sfx file="bassdown.wav" t={T.s3 + 0.15} vol={0.3} />
      <Vo id="b2" t={T.b2} />
      <Sfx file="whoosh.wav" t={T.lesson - 0.1} vol={0.3} />
      {/* 목소리 없는 판(간체)은 해설 자리에 바리스타의 그 말을 한 번 더 — 들은 말과 뜻 줄이 이어지게, 8~12초가 조용히 멈추지 않게 */}
      {voice ? <Vo id="n1" t={T.n1} /> : <Vo id="b1" t={T.n1 + 0.2} />}
      <Sfx file="pop.wav" t={T.n1 + N1_WORDS.see} vol={0.25} />
      <Vo id="n2" t={T.n2} />
      <Sfx file="pop.wav" t={T.n2 + N2_WORDS.ne} vol={0.25} />
      {voice ? <Vo id="n3" t={T.n3} /> : <Vo id="n2" t={T.n3} />}
      <Sfx file="tick.wav" t={T.turnGap[0]} vol={0.35} />
      <Sfx file="tick.wav" t={T.turnGap[0] + 0.5} vol={0.35} />
      <Sfx file="tick.wav" t={T.turnGap[0] + 1.0} vol={0.35} />
      <Sfx file="mongle_myang.wav" t={T.bubble2} vol={0.75} />
      <Sfx file="sparkle.wav" t={T.bubble2 + 0.05} vol={0.3} />
      <Vo id="b3" t={T.b3} />
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
      {sec < T.s2 ? <Scene src="s1.jpg" from={0} to={T.s2} ox={-20} focus={[420, 1250]} zoom={[1.0, 1.05]} /> : null}
      {sec >= T.s2 && sec < T.s3 ? <Scene src="s2.jpg" from={T.s2} to={T.s3} ox={30} focus={[420, 1250]} zoom={[1.02, 1.08]} /> : null}
      {sec >= T.s3 && sec < T.lesson ? <Scene src="s3.jpg" from={T.s3} to={T.lesson} focus={[540, 700]} zoom={[1.0, 1.07]} punch /> : null}
      {sec >= T.lesson && sec < T.s5 ? <Lesson L={L} /> : null}
      {sec >= T.s5 ? <Scene src="s5.jpg" from={T.s5} to={T.total} ox={-20} focus={[420, 1250]} zoom={[1.0, 1.1]} /> : null}

      {sec < T.s2 ? <PovTitle L={L} /> : null}
      {/* 몽글 눈 아래 — 위는 제목, 가운데는 손 흔드는 바리스타 */}
      <Sub from={T.b1 - 0.05} to={T.s2} ko="다음에 밥 한번 먹어요!" en={L.sub1} y={1245} />
      <Bubble
        from={T.bubble1}
        to={T.s3}
        top={250}
        tailX={330}
        tag={L.bubble1.tag}
        ko={<>와! 언제요? 📅<br />화요일 7시?</>}
        en={L.bubble1.line}
        koSize={76}
      />
      <Stamp from={T.s3 + 0.2} to={T.lesson} text={L.stamp} />
      <Sub from={T.b2} to={T.lesson} ko="아, 네. 그냥, 다음에요." en={L.sub2} />
      {/* 몽글 머리 위 왼쪽 빈 자리 — 바리스타 얼굴을 가리지 않게 좁은 말풍선 */}
      <Bubble from={T.bubble2} to={T.end} top={690} left={50} width={540} tailX={290} ko={<>네, 좋아요! 👋</>} en={L.bubble2} koSize={64} />
      <Sub from={T.b3} to={T.end} ko="네! 또 오세요!" en={L.sub3} y={1245} />
      {sec >= T.end ? <EndCard L={L} /> : null}
      <Sound voice={L.voice} />
    </AbsoluteFill>
  );
};
