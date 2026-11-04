// LAB 몽골 M29 「날씨는 추워요, 만지고 마시는 건 차가워요」 — 영하의 서울 거리, 패딩 친구 둘이 덜덜 떠는데 울란바토르에서 온 몽글은 반팔로 「이건 추운 것도 아니에요」.
// 아이스 커피 한 모금에 입에서 성에가 번져 꽁꽁 → 「커피가 추워요!」 ✗ → 친구 「커피가 차가워요!」 → 찬 바람에 처음으로 「…추워요」 ✓ → 카페에서 따뜻한 차 → 친구가 아이스 커피를 내밀자 「커피가… 차가워요!」 ✓
// 장면은 GPT 이미지 2.5로 구운 판(판/*.png, 지시문 판/*.txt). 같은 구도의 판을 갈아 끼워 인형극처럼 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { COLD, HOT, TEXT } from './data';
import { fr, T } from './timeline';

const C = { coralShade: '#AE322A', brown: '#2B1A14', cream: '#FFFDF8', green: '#2E7D4F' };
const MN = "'Inter Tight', 'SUIT', sans-serif";
const KO = "'SUIT', 'Inter Tight', sans-serif";
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const K = 1080 / 941; // 그림(941×1672) → 화면(1080×1920)
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
const fadeIn = (t: number, at: number, d = 0.2) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: EASE_OUT });

// 장면 — 시작 초 · 그림 · 다가갈 자리(그림 좌표) · 시작/끝 크기
const SHOTS = [
  { at: 0, img: 'relax', cam: [470, 1050], z0: 1.0, z1: 1.05 },
  { at: T.sip, img: 'sip', cam: [520, 1050], z0: 1.05, z1: 1.09 },
  { at: T.wrong, img: 'mug', cam: [470, 1050], z0: 1.04, z1: 1.09 },
  { at: T.laugh, img: 'laugh', cam: [470, 1000], z0: 1.03, z1: 1.06 },
  { at: T.one, img: 'cheek', cam: [520, 1030], z0: 1.05, z1: 1.09 },
  { at: T.gust, img: 'gust', cam: [470, 1100], z0: 1.04, z1: 1.1 },
  { at: T.run, img: 'run', cam: [470, 1100], z0: 1.0, z1: 1.07 },
  { at: T.tea, img: 'tea', cam: [470, 170], z0: 1.0, z1: 1.015 },
  { at: T.offer, img: 'offer', cam: [470, 170], z0: 1.015, z1: 1.03 },
];
const shotAt = (t: number) => {
  let k = 0;
  for (let i = 1; i < SHOTS.length; i++) if (t >= SHOTS[i].at) k = i;
  return k;
};
const PUNCH = [T.cold, T.freeze, T.say, T.fix, T.one, T.say2, T.warm, T.no];

const Plate: React.FC<{ t: number }> = ({ t }) => {
  const k = shotAt(t);
  const s = SHOTS[k];
  const next = k + 1 < SHOTS.length ? SHOTS[k + 1].at : T.total;
  const z = interpolate(t, [s.at, next], [s.z0, s.z1], clamp);
  let punch = 0;
  for (const b of PUNCH) punch = Math.max(punch, interpolate(t, [b - 0.02, b + 0.08, b + 0.5], [0, 1, 0], { ...clamp, easing: EASE_IO }));
  // 얼어붙는 자리에서는 손카메라 흔들림이 멎는다 — 화면까지 언 것처럼
  const still = t >= T.freeze && t < T.wrong ? 0 : 1;
  const sx = still * 4 * Math.sin((2 * Math.PI * t) / 3.1);
  const sy = still * 3 * Math.sin((2 * Math.PI * t) / 4.3 + 1);
  // 덜덜(추워요) · 바람(반전)
  const shiver = (t >= T.cold && t < T.sip) || (t >= T.wrong && t < T.laugh) ? 5 * Math.sin(t * 58) : 0;
  const gust = t >= T.gust && t < T.run ? 16 * interpolate(t, [T.gust, T.gust + 0.3, T.run], [1, 0.55, 0.3], clamp) : 0;
  const gx = gust * Math.sin(t * 47);
  const gy = gust * 0.5 * Math.sin(t * 31 + 2);
  // 성에 — 한모금 판 위로 꽁꽁 판이 입에서부터 번진다(같은 구도)
  const frost = t >= T.freeze && t < T.wrong ? interpolate(t, [T.freeze, T.freeze + 0.42], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) }) : 0;
  const flip = t >= T.end ? interpolate(t, [T.end, T.end + 0.42], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) }) : 0;
  const mask2 = `radial-gradient(circle at 800px 1000px, black ${flip * 1700}px, transparent ${flip * 1700 + 120}px)`;
  const mask = `radial-gradient(circle at 598px 1280px, black ${frost * 1500}px, transparent ${frost * 1500 + 120}px)`;
  return (
    <AbsoluteFill style={{ transform: `translate(${sx + shiver + gx}px, ${sy + gy}px) scale(${z * (1 + 0.04 * punch)})`, transformOrigin: `${s.cam[0] * K}px ${s.cam[1] * K}px` }}>
      <Img src={staticFile(`img/${s.img}.jpg`)} style={FULL} />
      {frost > 0 ? <Img src={staticFile('img/freeze.jpg')} style={{ ...FULL, WebkitMaskImage: mask, maskImage: mask }} /> : null}
      {flip > 0 ? <Img src={staticFile('img/flip.jpg')} style={{ ...FULL, WebkitMaskImage: mask2, maskImage: mask2 }} /> : null}
    </AbsoluteFill>
  );
};

// 눈 — 바깥 장면 내내 내린다. 바람 때는 옆으로 줄을 그으며 날아간다
const Snow: React.FC<{ t: number }> = ({ t }) => {
  if (t >= T.tea) return null;
  const windy = t >= T.gust && t < T.run;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, filter: windy ? 'blur(2.2px)' : undefined }}>
      {Array.from({ length: windy ? 70 : 34 }, (_, j) => {
        const speed = windy ? 1.9 : 0.16 + random(`s${j}`) * 0.1;
        const ph = (t * speed + random(`p${j}`)) % 1;
        const r = 3 + random(`r${j}`) * 7;
        if (windy) {
          const y = random(`y${j}`) * 1920;
          const x = 1180 - ph * 1400;
          return <rect key={j} x={x} y={y} width={60 + r * 12} height={Math.max(2, r * 0.5)} rx={3} fill="#FFFFFF" opacity={0.42} />;
        }
        const x = random(`x${j}`) * 1080 + 14 * Math.sin(t * 1.3 + j);
        const y = ph * 2000 - 40;
        return <circle key={j} cx={x} cy={y} r={r} fill="#FFFFFF" opacity={0.75} />;
      })}
    </svg>
  );
};

// 말풍선 — at은 그림 좌표, tail은 꼬리 방향(-1 왼쪽 아래 · 1 오른쪽 아래 · 0 가운데 아래)
const Bubble: React.FC<{ at: [number, number]; text: string; t: number; from: number; until: number; tail: -1 | 0 | 1; size?: number; font?: string; mark?: 'x' | 'v'; markAt?: number; pre?: string; markTop?: boolean }> = ({ at, text, t, from, until, tail, size = 80, font = KO, mark, markAt = from, pre, markTop = false }) => {
  if (t < from || t >= until) return null;
  const a = interpolate(t, [from, from + 0.18], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
  const lines = text.split(String.fromCharCode(10));
  const longest = Math.max(...lines.map((l) => l.length));
  const w = Math.max(240, Math.min(900, 90 + (longest + (pre ? 1.4 : 0)) * size * (font === KO ? 0.82 : 0.56)));
  const h = size * 1.9 + (lines.length - 1) * size * 1.14;
  const x = at[0] * K;
  const y = at[1] * K;
  const mo = t >= markAt ? interpolate(t, [markAt, markAt + 0.14], [0, 1], clamp) : 0;
  const ms = t >= markAt ? interpolate(t, [markAt, markAt + 0.14], [1.6, 1], { ...clamp, easing: EASE_OUT }) : 1;
  return (
    <div style={{ position: 'absolute', left: Math.max(30, x - w / 2), top: y - h / 2, width: w, height: h, transform: `scale(${a})`, transformOrigin: `${50 + tail * 30}% 100%` }}>
      <svg width={w} height={h + 46} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <path d={`M ${w / 2 + tail * 10 - 26} ${h - 4} L ${w / 2 + tail * 90} ${h + 44} L ${w / 2 + tail * 10 + 26} ${h - 4} Z`} fill={C.cream} stroke={C.coralShade} strokeWidth={6} strokeLinejoin="round" />
        <rect x={3} y={3} width={w - 6} height={h - 6} rx={Math.min(60, h / 2)} fill={C.cream} stroke={C.coralShade} strokeWidth={6} />
        <rect x={w / 2 + tail * 10 - 22} y={h - 12} width={44} height={12} fill={C.cream} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font, fontWeight: 800, fontSize: size, lineHeight: 1.14, textAlign: 'center', color: C.coralShade, whiteSpace: 'pre', opacity: mark === 'x' ? 1 - 0.4 * mo : 1 }}>
        {pre ? <span style={{ marginRight: 10 }}>{pre}</span> : null}
        <span style={{ position: 'relative' }}>
          {text}
          {mark === 'x' && mo > 0 ? <span style={{ position: 'absolute', left: '42%', right: -4, top: '50%', height: 11, borderRadius: 6, background: '#D93A2B', opacity: mo, transform: 'rotate(-2deg)' }} /> : null}
        </span>
      </div>
      {mark ? (
        <svg width={170} height={170} style={{ position: 'absolute', right: markTop ? w / 2 - 85 : -130, top: markTop ? -150 : -6, opacity: mo, transform: `scale(${ms})` }}>
          {mark === 'x' ? <path d="M 34 34 L 136 136 M 136 34 L 34 136" stroke="#D93A2B" strokeWidth={22} strokeLinecap="round" /> : <path d="M 30 92 L 72 134 L 144 44" fill="none" stroke={C.green} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
      ) : null}
    </div>
  );
};

// 위 띠 — 한국어 · 🔊 키릴 읽기 · 몽골어 풀이(M19 꼴)
const band: React.CSSProperties = { position: 'absolute', left: 60, width: 860, top: 290, background: 'rgba(255,253,248,0.97)', borderRadius: 40, boxShadow: '0 10px 28px rgba(60,20,10,0.28)', display: 'flex', flexDirection: 'column', alignItems: 'center' };
const Line: React.FC<{ t: number; at: number; size?: number; children: React.ReactNode }> = ({ t, at, size = 56, children }) => {
  const a = fadeIn(t, at, 0.15);
  return <div style={{ ...band, padding: '34px 40px 38px', transform: `translateY(${(1 - a) * 16}px)`, opacity: a, fontFamily: MN, fontWeight: 800, fontSize: size, lineHeight: 1.16, color: C.brown, textAlign: 'center' }}>{children}</div>;
};
const Word: React.FC<{ t: number; at: number; w: { ko: string; read: string }; sub: string }> = ({ t, at, w, sub }) => {
  const a = fadeIn(t, at, 0.15);
  return (
    <div style={{ ...band, padding: '18px 30px 26px', transform: `translateY(${(1 - a) * 16}px)`, opacity: a }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 118, lineHeight: 1.0, color: C.coralShade }}>{w.ko}</div>
        <div style={{ fontFamily: MN, fontWeight: 700, fontSize: 64, color: C.coralShade }}>🔊 {w.read}</div>
      </div>
      <div style={{ fontFamily: MN, fontWeight: 800, fontSize: 50, lineHeight: 1.16, color: C.brown, marginTop: 8, textAlign: 'center', whiteSpace: 'pre-line', wordBreak: 'keep-all' }}>{sub}</div>
    </div>
  );
};
const Top: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.cold) return <Line t={t} at={0}>{TEXT.ub}</Line>;
  if (t < T.sip) return <Word t={t} at={T.cold} w={COLD} sub={TEXT.coldSub} />;
  if (t >= T.wrong && t < T.fix) return <Line t={t} at={T.wrong} size={58}>{TEXT.wrong}</Line>;
  if (t >= T.fix && t < T.one) return <Word t={t} at={T.fix} w={HOT} sub={TEXT.fixSub} />;
  if (t >= T.one && t < T.gust) return <Line t={t} at={T.one} size={64}>{TEXT.one}</Line>;
  if (t >= T.say2 && t < T.run) return <Word t={t} at={T.say2} w={COLD} sub={TEXT.nowCold} />;
  if (t >= T.run && t < T.tea) return <Line t={t} at={T.run} size={64}>{TEXT.run}</Line>;
  return null;
};

// 찻집 벽 위 글 — 따뜻해요 풀이, 그다음 끝 한 줄(표 없이)
const EndLines: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.warm || (t >= T.offer && t < T.end)) return null;
  if (t < T.offer) return <div style={{ position: 'absolute', left: 50, width: 870, top: 300, textAlign: 'center', fontFamily: MN, fontWeight: 800, fontSize: 72, color: C.brown, opacity: fadeIn(t, T.warm, 0.22) }}>{TEXT.warm}</div>;
  const cell = (at: number, mn: string, ko: string) => {
    const a = fadeIn(t, at, 0.22);
    return (
      <div style={{ opacity: a, transform: `translateY(${(1 - a) * 14}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ fontFamily: MN, fontWeight: 800, fontSize: 58, lineHeight: 1.1, color: C.brown }}>{mn}</span>
        <span style={{ fontFamily: KO, fontWeight: 900, fontSize: 96, lineHeight: 1.08, color: C.coralShade }}>{ko}</span>
      </div>
    );
  };
  return (
    <div style={{ position: 'absolute', left: 50, width: 870, top: 270, display: 'flex', justifyContent: 'center', gap: 56 }}>
      {cell(T.end + 0.5, TEXT.endA, COLD.ko)}
      {cell(T.end + 0.85, TEXT.endB, HOT.ko)}
    </div>
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
// 음악은 얼어붙는 자리에서 뚝 떨어졌다가 ✗에 돌아오고, 바람 때 한 번 더 내려간다
const bgmVol = (f: number) => {
  const t = f / 30; // 음악은 얼어붙는 자리마다 뚝 떨어진다
  const lvl = interpolate(t, [0, 0.3, T.freeze - 0.05, T.freeze, T.wrong, T.wrong + 0.3, T.gust - 0.05, T.gust, T.run, T.run + 0.4, T.end - 0.05, T.end, T.end + 0.8, T.end + 1.1, T.total - 0.5, T.total], [0, 1, 1, 0.15, 0.15, 1, 1, 0.25, 0.25, 1, 1, 0.15, 0.15, 1, 1, 0], clamp);
  return 0.16 * MASTER * lvl;
};
const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('sfx/bgm.wav')} volume={bgmVol} />
    <Sfx file="wind.wav" at={0} vol={0.1} />
    <Sfx file="pop.wav" at={0.05} vol={0.2} />
    <Sfx file="pop.wav" at={T.cold} vol={0.2} />
    <Vo id="c1" at={T.cold + 0.05} />
    <Sfx file="ice.wav" at={T.sip} vol={0.4} />
    <Sfx file="sip.wav" at={T.sip + 0.15} vol={0.34} />
    <Sfx file="freeze.wav" at={T.freeze} vol={0.42} />
    <Sfx file="crack.wav" at={T.freeze + 0.32} vol={0.3} />
    <Sfx file="pop.wav" at={T.say} vol={0.2} />
    <Sfx file="crack.wav" at={T.say - 0.3} vol={0.2} />
    <Vo id="w1" at={T.say + 0.03} />
    <Sfx file="boing.wav" at={T.wrong + 0.05} vol={0.32} />
    <Sfx file="ice.wav" at={T.wrong + 0.25} vol={0.36} />
    <Sfx file="pop.wav" at={T.laugh} vol={0.2} />
    <Sfx file="pop.wav" at={T.fix} vol={0.2} />
    <Vo id="h1" at={T.fix + 0.05} />
    <Sfx file="sparkle.wav" at={T.fix + 0.4} vol={0.2} />
    <Sfx file="ice.wav" at={T.one} vol={0.32} />
    <Sfx file="tok.wav" at={T.one} vol={0.22} />
    <Sfx file="wind.wav" at={T.gust} vol={0.5} />
    <Sfx file="whoosh.wav" at={T.gust} vol={0.3} />
    <Vo id="c2" at={T.say2 + 0.05} />
    <Sfx file="whoosh.wav" at={T.run} vol={0.18} />
    <Sfx file="bell.wav" at={T.tea - 0.12} vol={0.3} />
    <Vo id="d1" at={T.warm + 0.05} />
    <Sfx file="ice.wav" at={T.offer + 0.05} vol={0.36} />
    <Sfx file="pop.wav" at={T.no} vol={0.2} />
    <Vo id="w2" at={T.no + 0.03} />
    <Sfx file="sip.wav" at={T.end - 0.2} vol={0.3} />
    <Sfx file="freeze.wav" at={T.end} vol={0.4} />
    <Sfx file="crack.wav" at={T.end + 0.32} vol={0.3} />
    <Sfx file="tok.wav" at={T.end + 0.5} vol={0.2} />
    <Sfx file="boing.wav" at={T.end + 0.85} vol={0.2} />
  </>
);

const Bubbles: React.FC<{ t: number }> = ({ t }) => (
  <>
    <Bubble at={[470, 850]} text={TEXT.boast} font={MN} size={56} t={t} from={0} until={T.cold} tail={0} />
    <Bubble at={[300, 640]} text="추워요!" t={t} from={T.cold} until={T.sip} tail={-1} />
    <Bubble at={[470, 800]} text="커피가 추워요!" size={72} pre="🥤" t={t} from={T.say} until={T.wrong} tail={0} />
    {/* 상상 칸 — 컵 머리띠를 가리지 않게 위로 */}
    <Bubble at={[430, 485]} text="커피가 추워요!" size={72} pre="🥤" t={t} from={T.wrong} until={T.laugh} tail={0} mark="x" markAt={T.wrong} />
    <Bubble at={[400, 640]} text="커피가 차가워요!" size={70} t={t} from={T.fix} until={T.one} tail={-1} />
    {/* 하나 → 둘 — 떠는 친구에 추워요, 컵에 차가워요 */}
    <Bubble at={[210, 620]} text="추워요" size={66} t={t} from={T.one} until={T.gust} tail={-1} />
    <Bubble at={[640, 800]} text="차가워요" size={66} t={t} from={T.one + 0.25} until={T.gust} tail={1} />
    <Bubble at={[470, 800]} text="…추워요" t={t} from={T.say2} until={T.run} tail={0} mark="v" markAt={T.say2 + 0.5} />
    <Bubble at={[470, 700]} text="따뜻해요…" size={70} t={t} from={T.warm} until={T.offer} tail={0} />
    <Bubble at={[400, 760]} text="커피가… 차가워요!" size={68} t={t} from={T.no} until={T.end} tail={0} mark="v" markAt={T.no + 0.7} markTop />
  </>
);

export const Film: React.FC = () => {
  const t = useCurrentFrame() / 30;
  return (
    <AbsoluteFill style={{ backgroundColor: '#8FA0C8' }}>
      <Plate t={t} />
      <Snow t={t} />
      <Bubbles t={t} />
      <Top t={t} />
      <EndLines t={t} />
      <Sound />
    </AbsoluteFill>
  );
};
