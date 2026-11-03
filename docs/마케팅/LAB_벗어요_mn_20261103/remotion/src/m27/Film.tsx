// LAB 몽골 M27 「입을 땐 넷, 벗을 땐 하나 — 벗어요」 — 첫눈 아침 기숙사 현관에서 몽글이 코트 → 신발 → 모자 → 장갑을 껴입을 때마다 낱말 상자가 쌓이고,
// 저녁에 눈투성이로 돌아와 따뜻한 방에 들어서자 넷이 와르르 무너지며 옷이 한꺼번에 날아간다 — 「벗어요」 하나. 장면은 GPT 이미지 2.5로 구운 판(몽글 정본은 생김새 참고로만). 전부 useCurrentFrame()으로.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { OFF, TAGS, TEXT } from './data';
import { fr, FPS, T } from './timeline';

const C = { coral: '#C63A2B', brown: '#2B1A14', cream: '#FFF8EA', stitch: '#E0806F' };
const KO = "'SUIT', 'Inter Tight', sans-serif";
const MN = "'Inter Tight', 'SUIT', sans-serif";
const MASTER = 0.8;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
const prog = (t: number, a: number, b: number, easing?: (n: number) => number) => interpolate(t, [a, b], [0, 1], easing ? { ...clamp, easing } : clamp);

// 장면 — 시작 초 · 그림 · 다가갈 자리(화면 좌표) · 시작/끝 크기
const SHOTS = [
  { at: 0, img: 'stuck0', cam: [420, 1200], z0: 1.0, z1: 1.06 },
  { at: T.ask, img: 'hall', cam: [720, 1180], z0: 1.03, z1: 1.1 },
  { at: T.coat, img: 'coat', cam: [300, 1300], z0: 1.02, z1: 1.05 },
  { at: T.wrong, img: 'stuck1', cam: [360, 1200], z0: 1.03, z1: 1.08 },
  { at: T.shoes, img: 'shoes', cam: [440, 1340], z0: 1.03, z1: 1.07 },
  { at: T.hat, img: 'hatslip', cam: [430, 1200], z0: 1.03, z1: 1.06 },
  { at: T.hatUp, img: 'hat', cam: [430, 1200], z0: 1.04, z1: 1.07 },
  { at: T.mitt, img: 'mitt', cam: [400, 1300], z0: 1.03, z1: 1.06 },
  { at: T.tip, img: 'tipped', cam: [520, 1400], z0: 1.03, z1: 1.08 },
  { at: T.street, img: 'street', cam: [500, 1250], z0: 1.03, z1: 1.09 },
  { at: T.dusk, img: 'dusk', cam: [440, 1300], z0: 1.0, z1: 1.05 },
  { at: T.off, img: 'off', cam: [540, 1200], z0: 1.06, z1: 1.0 },
  { at: T.blanket, img: 'blanket', cam: [560, 1340], z0: 1.0, z1: 1.08 },
];
const shotAt = (t: number) => {
  let k = 0;
  for (let i = 1; i < SHOTS.length; i++) if (t >= SHOTS[i].at) k = i;
  return k;
};
const PUNCH = [T.coat, T.shoes, T.hat, T.mitt, T.off];
const Plate: React.FC<{ t: number }> = ({ t }) => {
  const k = shotAt(t);
  const s = SHOTS[k];
  const next = k + 1 < SHOTS.length ? SHOTS[k + 1].at : T.total;
  const z = interpolate(t, [s.at, next], [s.z0, s.z1], clamp);
  let punch = 0;
  for (const b of PUNCH) punch = Math.max(punch, interpolate(t, [b - 0.02, b + 0.06, b + 0.42], [0, 1, 0], { ...clamp, easing: EASE_IO }));
  const sx = 3 * Math.sin((2 * Math.PI * t) / 3.3);
  const sy = 3 * Math.sin((2 * Math.PI * t) / 4.1 + 1);
  // 저녁 — 덜덜 떤다
  const shiver = t >= T.dusk && t < T.off ? 5 * Math.sin(t * 62) : 0;
  return (
    <AbsoluteFill style={{ transform: `translate(${sx + shiver}px, ${sy}px) scale(${z * (1 + 0.035 * punch)})`, transformOrigin: `${s.cam[0]}px ${s.cam[1]}px` }}>
      <Img src={staticFile(`img/${s.img}.jpg`)} style={FULL} />
    </AbsoluteFill>
  );
};

// 낱말 상자 — 위에 쌓인다. 가장 새 상자만 세 줄(한글 · 키릴 읽기 · 몽골 뜻), 앞 상자는 한글 한 줄로 줄어든다
const BOTTOM = 745;
const LEFT = 270;
const W = 780;
const BIG = 162;
const SMALL = 84;
const GAP = 8;
const Box: React.FC<{ top: number; h: number; a: number; rot?: number; op?: number; obj: string; verb: string; sub?: string; bad?: boolean; shift?: number }> = ({ top, h, a, rot = 0, op = 1, obj, verb, sub, bad, shift = 0 }) => (
  <div style={{ position: 'absolute', left: LEFT, top, width: W, height: h, opacity: op, transform: `scale(${a}) rotate(${rot}deg)`, transformOrigin: '50% 100%', borderRadius: 26, background: C.cream, boxShadow: '0 12px 22px rgba(60,30,10,0.28)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', inset: 8, borderRadius: 20, border: `3px dashed ${C.stitch}` }} />
    <div style={{ fontFamily: KO, fontWeight: 800, fontSize: h > 100 ? 74 : 60, lineHeight: 1.1, color: C.brown, whiteSpace: 'nowrap', transform: `translateX(${shift}px)` }}>
      {obj} <span style={{ color: C.coral, textDecoration: bad ? 'line-through' : 'none' }}>{verb}</span>
    </div>
    {sub ? (
      <div style={{ fontFamily: MN, fontWeight: 700, fontSize: 46, lineHeight: 1.2, color: C.brown, whiteSpace: 'nowrap' }}>
        {/* 몽골어 줄의 өмсөнө는 넷 다 같은 낱말 — 같은 색으로 묶어 보인다(v2 haiku 「풀이가 다 같아 헷갈림」) */}
        {sub.split('өмсөнө')[0]}
        <span style={{ color: C.coral }}>өмсөнө</span>
      </div>
    ) : null}
  </div>
);
const Stack: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.coat || t >= T.off) return null;
  const out: React.ReactNode[] = [];
  const fall = (i: number) => prog(t, T.fall + i * 0.05, T.fall + 0.3 + i * 0.05, Easing.in(Easing.quad));
  let y = BOTTOM;
  TAGS.forEach((tag, i) => {
    const nextAt = i === 0 ? T.wrong : i + 1 < TAGS.length ? TAGS[i + 1].at : T.question - 0.2; // 물음이 나오기 전에 넷이 다 한 줄로 — 위 글과 겹치지 않게
    // 둘째 상자는 먼저 「입어요?」(틀림)로 떨어졌다가 신어요로 고쳐진다
    const appearAt = i === 1 ? T.wrong : tag.at;
    if (t < appearAt) return;
    const wrongNow = i === 1 && t < T.shoes;
    const isNew = t < nextAt;
    const h = isNew ? BIG : interpolate(t, [nextAt, nextAt + 0.16], [BIG, SMALL], clamp);
    const inA = prog(t, appearAt, appearAt + 0.2, Easing.out(Easing.back(2.2)));
    const dropY = (1 - prog(t, appearAt, appearAt + 0.14, Easing.in(Easing.quad))) * -260;
    const top = y - h;
    y = top - GAP;
    const f = fall(i);
    const fx = (i % 2 === 0 ? -1 : 1) * f * (120 + 60 * i);
    const sub = isNew ? `${tag.read} · ${tag.mn}` : undefined;
    out.push(
      <div key={i} style={{ position: 'absolute', inset: 0, transform: `translate(${fx}px, ${dropY + f * 1500}px)` }}>
        <Box top={top} h={h} a={inA} rot={f * (i % 2 === 0 ? -34 : 30)} obj={wrongNow ? '신발도' : tag.obj} verb={wrongNow ? '입어요?' : tag.verb} sub={wrongNow ? undefined : sub} shift={wrongNow ? -60 : 0} />
      </div>,
    );
    if (wrongNow && t >= T.wrongX) {
      const x = interpolate(t, [T.wrongX, T.wrongX + 0.16], [1.6, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
      out.push(
        <div key="x" style={{ position: 'absolute', left: LEFT + W - 150, top: top + 10, width: 130, height: h - 20, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${x})`, fontFamily: MN, fontWeight: 900, fontSize: 124, lineHeight: 1, color: '#D2281E' }}>✕</div>,
      );
    }
  });
  return <>{out}</>;
};

// 위 글
const Head: React.FC<{ t: number; from: number; until: number; size?: number; top?: number; children: React.ReactNode }> = ({ t, from, until, size = 74, top = 276, children }) => {
  if (t < from || t >= until) return null;
  const a = interpolate(t, [from, from + 0.14], [0, 1], { ...clamp, easing: EASE_OUT });
  const s = interpolate(t, [from, from + 0.2], [0.9, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  return <div style={{ position: 'absolute', left: 50, right: 50, top, textAlign: 'center', fontFamily: MN, fontWeight: 800, fontSize: size, lineHeight: 1.14, letterSpacing: -0.5, color: C.brown, opacity: a, transform: `scale(${s})` }}>{children}</div>;
};

// 장소 자막 — 아래 작은 알약(어디로 갔는지)
const Cap: React.FC<{ t: number; from: number; until: number; children: React.ReactNode }> = ({ t, from, until, children }) => {
  if (t < from || t >= until) return null;
  const a = interpolate(t, [from, from + 0.15], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ position: 'absolute', left: 0, width: 1080, top: 1500, display: 'flex', justifyContent: 'center', opacity: a }}>
      <div style={{ padding: '12px 36px 16px', borderRadius: 999, background: 'rgba(24,16,30,0.82)', fontFamily: MN, fontWeight: 800, fontSize: 56, lineHeight: 1.1, color: '#FFFDF8', whiteSpace: 'nowrap' }}>{children}</div>
    </div>
  );
};

// 벗어요 — 넷이 무너진 자리에 하나만
const Off: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.off || t >= T.blanket) return null;
  const a = interpolate(t, [T.off, T.off + 0.24], [0.5, 1], { ...clamp, easing: Easing.out(Easing.back(2.4)) });
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 250, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${a})`, transformOrigin: '50% 40%' }}>
      <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 178, lineHeight: 1.02, color: C.coral }}>{OFF.ko}</div>
      <div style={{ fontFamily: MN, fontWeight: 800, fontSize: 62, lineHeight: 1.1, color: C.brown }}>{OFF.read} · {OFF.mn}</div>
    </div>
  );
};

// 눈보라 — 아침에서 저녁으로 넘어가는 자리
const Blizzard: React.FC<{ t: number }> = ({ t }) => {
  const a = interpolate(t, [T.snow, T.dusk - 0.05, T.dusk + 0.1, T.dusk + 0.5], [0, 1, 1, 0], clamp);
  if (a <= 0) return null;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <rect width={1080} height={1920} fill="#F4F7FB" opacity={a * 0.92} />
      {Array.from({ length: 60 }, (_, j) => {
        const ph = (t * 1.6 + random(`p${j}`)) % 1;
        const x = random(`x${j}`) * 1180 - 50 - ph * 160;
        const y = ph * 2000 - 40;
        return <circle key={j} cx={x} cy={y} r={7 + random(`r${j}`) * 12} fill="#FFFFFF" opacity={a} />;
      })}
    </svg>
  );
};

// 날아간 옷에서 떨어지는 눈(벗어요)
const Flakes: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.off || t >= T.blanket) return null;
  const d = t - T.off;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      {Array.from({ length: 34 }, (_, j) => {
        const ang = random(`a${j}`) * Math.PI * 2;
        const v = 240 + random(`v${j}`) * 520;
        const x = 540 + Math.cos(ang) * v * d;
        const y = 1120 + Math.sin(ang) * v * d + 340 * d * d;
        return <circle key={j} cx={x} cy={y} r={4 + random(`r${j}`) * 7} fill="#FFFFFF" opacity={Math.max(0, 0.9 - d * 0.45)} />;
      })}
    </svg>
  );
};

const Vo: React.FC<{ id: string; at: number; vol?: number }> = ({ id, at, vol = 1 }) => (
  <Sequence from={fr(at)} layout="none">
    <Audio src={staticFile(`vo/${id}.wav`)} volume={vol * MASTER} />
  </Sequence>
);
const Sfx: React.FC<{ file: string; at: number; vol: number }> = ({ file, at, vol }) => (
  <Sequence from={Math.max(0, fr(at))} layout="none">
    <Audio src={staticFile(`sfx/${file}`)} volume={vol * MASTER} />
  </Sequence>
);
const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('sfx/bgm.wav')} volume={(i) => 0.18 * MASTER * interpolate(i, [fr(T.total) - 14, fr(T.total)], [1, 0], clamp)} />
    <Vo id="a1" at={T.coat + 0.12} />
    <Vo id="a2" at={T.wrong + 0.08} />
    <Vo id="a3" at={T.shoes + 0.1} />
    <Vo id="a4" at={T.hat + 0.1} />
    <Vo id="a5" at={T.mitt + 0.1} />
    <Vo id="b1" at={T.off + 0.06} />
    <Vo id="b2" at={T.blanket + 0.2} />
    <Sfx file="zip.wav" at={T.coat} vol={0.34} />
    <Sfx file="tok.wav" at={T.coat + 0.1} vol={0.3} />
    <Sfx file="tok.wav" at={T.wrong + 0.1} vol={0.3} />
    <Sfx file="wrong.wav" at={T.wrongX} vol={0.5} />
    <Sfx file="pop.wav" at={T.shoes} vol={0.3} />
    <Sfx file="pop.wav" at={T.hat} vol={0.3} />
    <Sfx file="pop.wav" at={T.mitt} vol={0.3} />
    <Sfx file="tok.wav" at={T.hatUp} vol={0.26} />
    <Sfx file="tumble.wav" at={T.tip} vol={0.34} />
    <Sfx file="wind.wav" at={T.street} vol={0.42} />
    <Sfx file="tumble.wav" at={T.fall} vol={0.55} />
    <Sfx file="whoosh.wav" at={T.off - 0.08} vol={0.32} />
    <Sfx file="sigh.wav" at={T.blanket} vol={0.3} />
  </>
);

export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  return (
    <AbsoluteFill style={{ background: '#E9DDD2' }}>
      <Plate t={t} />
      <Flakes t={t} />
      <Stack t={t} />
      <Blizzard t={t} />
      <Cap t={t} from={T.street + 0.05} until={T.snow}>{TEXT.out}</Cap>
      <Cap t={t} from={T.dusk + 0.15} until={T.off}>{TEXT.home}</Cap>
      <Head t={t} from={0} until={T.ask}>{TEXT.hook1}</Head>
      <Head t={t} from={T.ask} until={T.coat}>{TEXT.hook2}</Head>
      <Head t={t} from={T.wrong + 0.3} until={T.shoes} size={70}>{TEXT.wrong} <span style={{ color: '#D2281E', opacity: t >= T.wrongX ? 1 : 0 }}>{TEXT.wrongMark}</span></Head>
      <Head t={t} from={T.question} until={T.off} size={72} top={268}>{TEXT.question}</Head>
      <Off t={t} />
      <Head t={t} from={T.blanket} until={99} size={72} top={290}>{TEXT.end}</Head>
      <Sound />
    </AbsoluteFill>
  );
};
