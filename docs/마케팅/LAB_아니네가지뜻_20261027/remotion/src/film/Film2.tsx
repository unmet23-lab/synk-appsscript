// LAB E4 다시 살림(v6, 10-27) — 「한 낱말 · 두 억양」 16초 A 장치형.
// 버린 v5(24초 B 콩트)는 「몽글이 아니 = no로 오해한다」 고리가 글 세 줄로만 전해져 세 번 다 3점이었다(기획.md 「판정 · 버림」).
// 그래서 오해 고리 · POV · 교과서 꼬리표 · 몽글 말풍선 · 서비스 장면을 빼고, 같은 그림 S1(동전) · S3(꽃)과 바리스타 소리 b1 · b2만으로
// 0초 「아니?!」 → 2.7초 「아니~ 뭘 이런 걸!」 → 5.1초 위아래 나란히 「Same word. Different tone.」 → 한 줄씩 다시 들려주며 따라 말할 틈 → 끝 질문.
// 화면 글은 그 초의 한 줄만 크게 둔다. 해설(하나)은 n5 · n6 두 줄.
// v9(올릴 파일 시험 3점 뒤 고침 1): 다시 들려주는 두 줄을 위아래 칸이 아니라 한 장면씩 꽉 찬 화면으로(「어느 칸을 따라 할지 헷갈린다」),
// 첫 뜻 줄에 「not “no”!」(「동전 장면과 no? 질문이 어떻게 이어지는지」), 끝 질문을 드라마 경험 대신 「어느 쪽부터 써 볼래?」(「답할 근거가 없다」).
// v11(고침 2): 한국어 줄마다 로마자(「한글을 못 읽어 따라 말할 수 없다」), 위아래 두 칸 대신 비교 카드 한 장(「두 칸이 정신없고 글이 작다」),
// 꽃 장면은 자막 상자를 왼쪽 위로 올리고 꽃에 「a gift」 꼬리표(상자가 꽃을 가려 「선물인지 모르겠다」), YOUR TURN 알약은 처음부터 또렷이.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EN, KO } from '../lib/fonts';

const FPS = 30;
const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)

// 시간표(초). 목소리 길이는 public/vo/*.json
const B1 = 0.495; // 아니?!
const B2 = 1.935; // 아니~ 뭘 이런 걸!
export const T2 = {
  b1: 0.35,
  s3: 2.7,
  b2: 2.85,
  split: 5.1,
  n5: 5.2, // Same word. Different tone. Your turn! (2.66초 — tone. 끝 1.49 · Your 1.73)
  turn: 5.2 + 1.68, // 「YOUR TURN」 칩으로 바뀌는 때
  rep1: 7.95, // 꽉 찬 S1 — 「아니?!」 다시 → 따라 말할 틈
  rb1: 8.05,
  gap1: [8.6, 9.55] as [number, number],
  rep2: 9.55, // 꽉 찬 S3 — 「아니~ 뭘 이런 걸!」 다시 → 따라 말할 틈
  rb2: 9.65,
  gap2: [11.65, 12.95] as [number, number],
  end: 12.95,
  n6: 13.05, // Which one will you try first? (2.09초)
  total: 15.7,
};
export const TOTAL_FRAMES2 = fr(T2.total);

const INK = '#2B2522';
const CORAL = '#F25C4A';
const BUTTER = '#FFD95A';
const CREAM = '#FFF8EC';

const usePop = (start: number, damping = 13) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - fr(start), fps, config: { damping, stiffness: 170, mass: 0.7 } });
};

// 1024×1536 그림을 1280×1920으로 깔고 가운데 1080을 보인다 — 첫 두 장면(꽉 찬 화면)
const Full: React.FC<{ src: string; from: number; to: number; focus: [number, number]; zoom: [number, number]; shake?: [number, number]; punch?: boolean }> = ({
  src,
  from,
  to,
  focus,
  zoom,
  shake,
  punch,
}) => {
  const frame = useCurrentFrame();
  let s = interpolate(frame, [fr(from), fr(to)], zoom, clamp);
  if (punch) s *= interpolate(frame, [fr(from), fr(from) + 5], [1.08, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  let dx = 0;
  if (shake && frame >= fr(shake[0]) && frame < fr(shake[1])) {
    dx = Math.sin(frame * 2.6) * 9 * interpolate(frame, [fr(shake[0]), fr(shake[1])], [1, 0], clamp);
  }
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#3a2a20' }}>
      <Img
        src={staticFile(`img/${src}`)}
        style={{ position: 'absolute', left: -100 + dx, top: 0, width: 1280, height: 1920, transform: `scale(${s})`, transformOrigin: `${focus[0] + 100}px ${focus[1]}px` }}
      />
    </AbsoluteFill>
  );
};

const Pitch: React.FC<{ kind: 'up' | 'wave'; w?: number }> = ({ kind, w = 96 }) => (
  <svg width={w} height={w * 0.7} viewBox="0 0 86 60" style={{ flex: 'none' }}>
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

// 첫 두 장면의 큰 자막 — 한국어(음높이 선) + 영어 뜻
const BigSub: React.FC<{ from: number; to: number; ko: string; kind: 'up' | 'wave'; roman: string; en: string; koSize: number; enSize: number; topLeft?: boolean }> = ({ from, to, ko, kind, roman, en, koSize, enSize, topLeft }) => {
  const frame = useCurrentFrame();
  const p = usePop(from, 14);
  if (frame < fr(from) || frame >= fr(to)) return null;
  return (
    // 1250이면 아래 끝이 1482px로 쇼츠 아래 글자 안전선(1428)을 넘었다(올리기 전 검사 v9)
    // 꽃 장면(topLeft)은 아래에 두면 상자가 꽃을 가린다(v10 시험 「선물인지 모르겠다」) — 왼쪽 위 빈 벽으로
    <div style={topLeft ? { position: 'absolute', top: 300, left: 40, width: 780, textAlign: 'left' } : { position: 'absolute', top: 1130, left: 0, width: 1080, textAlign: 'center' }}>
      <div
        style={{
          display: 'inline-block',
          maxWidth: topLeft ? 780 : 940,
          background: 'rgba(24,18,14,0.84)',
          borderRadius: 34,
          padding: '22px 40px 26px',
          transform: `scale(${0.8 + 0.2 * p})`,
          transformOrigin: topLeft ? '0 0' : '50% 50%',
          opacity: p,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: topLeft ? 'flex-start' : 'center', gap: 18, fontFamily: KO, fontWeight: 800, fontSize: koSize, color: '#fff', lineHeight: 1.15 }}>
          {ko} <Pitch kind={kind} w={koSize * 0.95} />
        </div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: Math.round(enSize * 0.78), color: '#E9DCCB', lineHeight: 1.15, marginTop: 4 }}>[{roman}]</div>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: enSize, color: BUTTER, lineHeight: 1.15, marginTop: 8 }}>{en}</div>
      </div>
    </div>
  );
};

const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [fr(T2.s3) - 4, fr(T2.s3)], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 640, background: 'linear-gradient(180deg, rgba(22,15,10,0.66) 0%, rgba(22,15,10,0.45) 55%, rgba(22,15,10,0) 100%)' }} />
      <div style={{ position: 'absolute', top: 290, left: 0, width: 1080, textAlign: 'center', color: '#fff', fontWeight: 800, fontSize: 68, textShadow: '0 4px 18px rgba(0,0,0,0.55)' }}>
        <span style={{ fontFamily: KO }}>아니</span>
        <span style={{ fontFamily: EN }}> = “no”… right? 🤔</span>
      </div>
    </AbsoluteFill>
  );
};

// 다시 들려주기 — 한 장면을 꽉 차게, 그 줄 하나만 크게(노란 칸) + 따라 말할 틈 막대
const Replay: React.FC<{ src: string; from: number; to: number; focus: [number, number]; ko: string; kind: 'up' | 'wave'; roman: string; koSize: number; en: string; enSize: number; at: number; gap: [number, number]; topLeft?: boolean }> = ({
  src,
  from,
  to,
  focus,
  ko,
  kind,
  roman,
  koSize,
  en,
  enSize,
  at,
  gap,
  topLeft,
}) => {
  const frame = useCurrentFrame();
  const p = usePop(from, 13);
  const bump = interpolate(frame, [fr(at), fr(at) + 4, fr(at) + 10], [1, 1.06, 1], clamp);
  const inGap = frame >= fr(gap[0]) && frame < fr(gap[1]);
  const bar = interpolate(frame, [fr(gap[0]), fr(gap[1])], [1, 0], clamp);
  return (
    <AbsoluteFill>
      <Full src={src} from={from} to={to} focus={focus} zoom={[1.04, 1.12]} punch />
      <div style={{ position: 'absolute', top: 250, left: 0, width: 1080, textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: '#fff', color: INK, fontFamily: EN, fontWeight: 800, fontSize: 48, padding: '12px 34px 16px', borderRadius: 999, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          YOUR TURN: say it out loud! 🎤
        </div>
      </div>
      <div style={topLeft ? { position: 'absolute', top: 380, left: 40, width: 780, textAlign: 'left' } : { position: 'absolute', top: 1100, left: 0, width: 1080, textAlign: 'center' }}>
        <div style={{ display: 'inline-block', maxWidth: topLeft ? 780 : 960, background: BUTTER, borderRadius: 34, padding: '22px 40px 26px', boxShadow: '0 14px 40px rgba(0,0,0,0.35)', transform: `scale(${(0.8 + 0.2 * p) * bump})`, transformOrigin: topLeft ? '0 0' : '50% 50%', opacity: p }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: topLeft ? 'flex-start' : 'center', gap: 18, fontFamily: KO, fontWeight: 800, fontSize: koSize, color: INK, lineHeight: 1.15 }}>
            {ko} <Pitch kind={kind} w={koSize * 0.95} />
          </div>
          <div style={{ fontFamily: EN, fontWeight: 700, fontSize: Math.round(enSize * 0.78), color: '#6B4A33', lineHeight: 1.15, marginTop: 4 }}>[{roman}]</div>
          <div style={{ fontFamily: EN, fontWeight: 800, fontSize: enSize, color: '#7A2E1F', lineHeight: 1.15, marginTop: 8 }}>{en}</div>
        </div>
        <div style={{ width: 520, height: 16, margin: topLeft ? '22px 0 0 10px' : '26px auto 0', borderRadius: 8, background: 'rgba(255,255,255,0.45)', overflow: 'hidden', opacity: inGap ? 1 : 0 }}>
          <div style={{ width: `${bar * 100}%`, height: '100%', background: BUTTER }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 꽃 꼬리표 — 몽글이 민 화분이 선물이라는 것만(꽃 바로 위)
const GiftTag: React.FC<{ from: number }> = ({ from }) => {
  const p = usePop(from, 12);
  return (
    <div style={{ position: 'absolute', left: 400, top: 1010, opacity: p, transform: `scale(${0.6 + 0.4 * p})`, transformOrigin: '50% 100%' }}>
      <div style={{ background: CREAM, color: INK, fontFamily: EN, fontWeight: 800, fontSize: 44, padding: '8px 24px 12px', borderRadius: 20, boxShadow: '0 8px 22px rgba(0,0,0,0.3)' }}>🎁 a gift</div>
      <div style={{ width: 0, height: 0, margin: '0 auto', borderLeft: '16px solid transparent', borderRight: '16px solid transparent', borderTop: `20px solid ${CREAM}` }} />
    </div>
  );
};

// 비교 카드 한 장 — 같은 말, 다른 말투(두 줄을 크게 · 로마자와 뜻)
const Compare: React.FC = () => {
  const frame = useCurrentFrame();
  const p0 = usePop(T2.split, 14);
  const p1 = usePop(T2.split + 0.25, 12);
  const p2 = usePop(T2.split + 0.5, 12);
  const pt = usePop(T2.turn, 12);
  const row = (p: number): React.CSSProperties => ({
    display: 'inline-block',
    width: 940,
    background: CREAM,
    borderRadius: 30,
    padding: '20px 36px 24px',
    textAlign: 'left',
    boxShadow: '0 12px 34px rgba(0,0,0,0.35)',
    opacity: p,
    transform: `translateY(${(1 - p) * 30}px)`,
    marginTop: 26,
  });
  return (
    <AbsoluteFill>
      <Full src="s1.jpg" from={T2.split} to={T2.rep1} focus={[760, 820]} zoom={[1.1, 1.16]} />
      <AbsoluteFill style={{ background: 'rgba(20,14,10,0.72)', opacity: interpolate(frame, [fr(T2.split), fr(T2.split) + 5], [0, 1], clamp) }} />
      <div style={{ position: 'absolute', top: 300, left: 0, width: 1080, textAlign: 'center' }}>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 76, lineHeight: 1.1, color: '#fff', opacity: p0 }}>
          Same word.
          <br />
          <span style={{ color: BUTTER }}>Different tone. 🎵</span>
        </div>
        <div style={row(p1)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: KO, fontWeight: 800, fontSize: 84, color: INK, lineHeight: 1.1 }}>
            아니?! <Pitch kind="up" w={80} />
          </div>
          <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 40, color: '#6B4A33', marginTop: 4 }}>[a-ni?!]</div>
          <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 50, color: CORAL, marginTop: 6 }}>😲 = “What?!”</div>
        </div>
        <div style={row(p2)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: KO, fontWeight: 800, fontSize: 70, color: INK, lineHeight: 1.1 }}>
            아니~ 뭘 이런 걸! <Pitch kind="wave" w={74} />
          </div>
          <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 40, color: '#6B4A33', marginTop: 4 }}>[a-ni~ mwol i-reon geol!]</div>
          <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 46, color: CORAL, marginTop: 6 }}>🎁 = “Aww, you shouldn’t have!”</div>
        </div>
        {frame >= fr(T2.turn) ? (
          <div style={{ marginTop: 34, opacity: pt, transform: `scale(${0.7 + 0.3 * pt})` }}>
            <span style={{ display: 'inline-block', background: '#fff', color: INK, fontFamily: EN, fontWeight: 800, fontSize: 48, padding: '12px 34px 16px', borderRadius: 999 }}>YOUR TURN: say it out loud! 🎤</span>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const p = usePop(T2.end + 0.05, 13);
  return (
    <AbsoluteFill>
      <Full src="s3.jpg" from={T2.end} to={T2.total} focus={[760, 860]} zoom={[1.0, 1.05]} />
      <AbsoluteFill style={{ background: 'rgba(14,10,8,0.55)' }} />
      <div
        style={{
          position: 'absolute',
          top: 560,
          left: 60,
          width: 960,
          textAlign: 'center',
          color: '#fff',
          fontFamily: EN,
          fontWeight: 800,
          fontSize: 84,
          lineHeight: 1.12,
          textShadow: '0 4px 18px rgba(0,0,0,0.6)',
          opacity: p,
          transform: `scale(${0.8 + 0.2 * p})`,
        }}
      >
        Which <span style={{ fontFamily: KO }}>아니</span>
        <br />
        will you try first?
        <div style={{ display: 'flex', justifyContent: 'center', gap: 22, margin: '34px 0 30px', fontFamily: KO, fontSize: 60 }}>
          <span style={{ background: CREAM, color: INK, borderRadius: 24, padding: '10px 28px 14px' }}>아니?!</span>
          <span style={{ background: CREAM, color: INK, borderRadius: 24, padding: '10px 28px 14px' }}>아니~ 뭘 이런 걸!</span>
        </div>
        <span style={{ color: BUTTER }}>Comment below 👇</span>
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
  const total = fr(T2.total);
  const talk: [number, number][] = [
    [T2.b1, T2.b1 + B1 + 0.1],
    [T2.b2, T2.b2 + B2 + 0.1],
    [T2.n5, T2.n5 + 2.75],
    [T2.rb1, T2.gap1[1]],
    [T2.rb2, T2.gap2[1]],
    [T2.n6, T2.n6 + 2.2],
  ];
  const bgmVol = (i: number) => {
    const sec = i / FPS;
    const under = talk.some(([a, b]) => sec >= a - 0.1 && sec < b + 0.1);
    return (under ? 0.045 : 0.11) * MASTER * interpolate(i, [total - 24, total], [1, 0], clamp);
  };
  const cafeVol = (i: number) => {
    const sec = i / FPS;
    return (sec < T2.split ? 0.45 : sec < T2.rep1 ? 0.14 : sec < T2.end ? 0.3 : 0.2) * MASTER * interpolate(i, [total - 20, total], [1, 0], clamp);
  };
  return (
    <>
      <Audio src={staticFile('bgm.wav')} volume={bgmVol} />
      <Audio src={staticFile('sfx/cafe.wav')} volume={cafeVol} />
      <Sfx file="ice.wav" t={0} vol={0.55} />
      <Vo id="b1" t={T2.b1} />
      <Sfx file="whoosh.wav" t={T2.s3 - 0.08} vol={0.25} />
      <Vo id="b2" t={T2.b2} />
      <Sfx file="sparkle.wav" t={T2.b2 + 0.1} vol={0.25} />
      <Sfx file="whoosh.wav" t={T2.split - 0.08} vol={0.3} />
      <Sfx file="whoosh.wav" t={T2.rep1 - 0.08} vol={0.22} />
      <Sfx file="whoosh.wav" t={T2.rep2 - 0.08} vol={0.22} />
      <Vo id="n5" t={T2.n5} />
      <Vo id="b1" t={T2.rb1} />
      <Sfx file="pop.wav" t={T2.rb1} vol={0.2} />
      <Sfx file="tick.wav" t={T2.gap1[0] + 0.05} vol={0.35} />
      <Sfx file="tick.wav" t={T2.gap1[0] + 0.55} vol={0.35} />
      <Vo id="b2" t={T2.rb2} />
      <Sfx file="pop.wav" t={T2.rb2} vol={0.2} />
      <Sfx file="tick.wav" t={T2.gap2[0] + 0.05} vol={0.35} />
      <Sfx file="tick.wav" t={T2.gap2[0] + 0.55} vol={0.35} />
      <Sfx file="tick.wav" t={T2.gap2[0] + 1.05} vol={0.35} />
      <Sfx file="tok.wav" t={T2.end + 0.05} vol={0.3} />
      <Vo id="n6" t={T2.n6} />
    </>
  );
};

export const Film2: React.FC = () => {
  const frame = useCurrentFrame();
  const sec = frame / FPS;
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a1d16' }}>
      {sec < T2.s3 ? <Full src="s1.jpg" from={0} to={T2.s3} focus={[760, 820]} zoom={[1.0, 1.07]} shake={[T2.b1, T2.b1 + 0.4]} /> : null}
      {sec >= T2.s3 && sec < T2.split ? <Full src="s3.jpg" from={T2.s3} to={T2.split} focus={[760, 860]} zoom={[1.02, 1.09]} punch /> : null}
      {sec < T2.s3 ? <Hook /> : null}
      <BigSub from={T2.b1 - 0.05} to={T2.s3} ko="아니?!" kind="up" roman="a-ni?!" en="= “What?!” — not “no”!" koSize={120} enSize={60} />
      <BigSub from={T2.b2} to={T2.split} ko="아니~ 뭘 이런 걸!" kind="wave" roman="a-ni~ mwol i-reon geol!" en="= “Aww, you shouldn’t have!”" koSize={64} enSize={42} topLeft />
      {sec >= T2.s3 && sec < T2.split ? <GiftTag from={T2.s3 + 0.15} /> : null}
      {sec >= T2.split && sec < T2.rep1 ? <Compare /> : null}
      {sec >= T2.rep1 && sec < T2.rep2 ? <Replay src="s1.jpg" from={T2.rep1} to={T2.rep2} focus={[760, 820]} ko="아니?!" kind="up" roman="a-ni?!" koSize={124} en="= “What?!”" enSize={60} at={T2.rb1} gap={T2.gap1} /> : null}
      {sec >= T2.rep2 && sec < T2.end ? (
        <Replay src="s3.jpg" from={T2.rep2} to={T2.end} focus={[760, 860]} ko="아니~ 뭘 이런 걸!" kind="wave" roman="a-ni~ mwol i-reon geol!" koSize={66} en="= “Aww, you shouldn’t have!”" enSize={42} at={T2.rb2} gap={T2.gap2} topLeft />
      ) : null}
      {sec >= T2.end ? <EndCard /> : null}
      <Sound />
    </AbsoluteFill>
  );
};
