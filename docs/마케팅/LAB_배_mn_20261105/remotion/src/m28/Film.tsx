// LAB 몽골 M28 「배」 — 기숙사 침대에서 배가 아픈 몽글 → 룸메이트가 커다란 배(과일)를 내민다 → 고개를 젓자 「그럼 배 타러 가자!」 →
// 진짜 보트 위에서 뱃멀미까지 → 룸메이트가 또 배를 내민다. 끝은 배(몸) · 배(과일) · 배(탈것)가 한 장면에 모이고, 꼬리표 셋이 차례로 붙는다.
// 장면은 GPT 이미지 2.5로 구운 판(판/*.png, 지시문 판/*.txt). 같은 구도의 판을 갈아 끼워 인형극처럼 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { SAY, TEXT, WORD } from './data';
import { fr, T } from './timeline';

const C = { coral: '#C63A2B', shade: '#AE322A', brown: '#2B1A14', cream: '#FFFDF8', stitch: '#E58A73' };
const MN = "'Inter Tight', 'SUIT', sans-serif";
const KO = "'SUIT', 'Inter Tight', sans-serif";
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
const fadeIn = (t: number, at: number, d = 0.18) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: EASE_OUT });
const pop = (t: number, at: number, d = 0.2) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
const onBoat = (t: number) => t >= T.boat;

// 장면 — 시작 초 · 그림 · 다가갈 자리 · 시작/끝 크기
const SHOTS = [
  { at: 0, img: 'bed', cam: [300, 1150], z0: 1.0, z1: 1.05 },
  { at: T.tummy, img: 'bed', cam: [340, 1270], z0: 1.12, z1: 1.18 },
  { at: T.give, img: 'pear', cam: [640, 1120], z0: 1.14, z1: 1.04 },
  { at: T.no, img: 'recoil', cam: [440, 1100], z0: 1.06, z1: 1.08 },
  { at: T.ticket, img: 'ticket', cam: [620, 900], z0: 1.0, z1: 1.05 },
  { at: T.boat, img: 'boat', cam: [540, 1200], z0: 1.12, z1: 1.14 },
  { at: T.again, img: 'boatpear', cam: [540, 1100], z0: 1.14, z1: 1.14 },
  { at: T.toss, img: 'toss', cam: [540, 1100], z0: 1.14, z1: 1.07 },
];
const shotAt = (t: number) => {
  let k = 0;
  for (let i = 1; i < SHOTS.length; i++) if (t >= SHOTS[i].at) k = i;
  return k;
};
const PUNCH = [T.give, T.ticket, T.again, T.toss];

// 몽글 · 룸메이트만 살짝 움직이는 조각 — 같은 판을 부드러운 타원 가면으로 겹쳐 그 자리만 눌렀다 폈다 한다(장면이 떨리지 않게)
const Patch: React.FC<{ img: string; cx: number; cy: number; rx: number; ry: number; sx?: number; sy?: number; dx?: number; dy?: number; rot?: number; ox?: number; oy?: number }> = ({ img, cx, cy, rx, ry, sx = 1, sy = 1, dx = 0, dy = 0, rot = 0, ox, oy }) => {
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, black 78%, transparent 100%)`;
  return (
    <Img
      src={staticFile(`img/${img}.jpg`)}
      style={{ ...FULL, WebkitMaskImage: mask, maskImage: mask, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${sx}, ${sy})`, transformOrigin: `${ox ?? cx}px ${oy ?? cy + ry * 0.75}px` }}
    />
  );
};

const Plate: React.FC<{ t: number; children?: React.ReactNode }> = ({ t, children }) => {
  const k = shotAt(t);
  const s = SHOTS[k];
  const next = k + 1 < SHOTS.length ? SHOTS[k + 1].at : T.total;
  const z = interpolate(t, [s.at, next], [s.z0, s.z1], clamp);
  let punch = 0;
  for (const b of PUNCH) punch = Math.max(punch, interpolate(t, [b - 0.02, b + 0.07, b + 0.4], [0, 1, 0], clamp));
  const sx = 3 * Math.sin((2 * Math.PI * t) / 3.3);
  const sy = 2.5 * Math.sin((2 * Math.PI * t) / 4.3 + 1);
  // 보트 — 물결에 함께 흔들린다(끝은 더 크게)
  const amp = t >= T.toss ? 2.8 : t >= T.again ? 2.2 : 1.7;
  const rot = onBoat(t) ? amp * Math.sin((2 * Math.PI * (t - T.boat)) / 1.75) : 0;
  const bob = onBoat(t) ? 15 * Math.sin((2 * Math.PI * (t - T.boat)) / 1.75 + 0.7) : 0;
  // 몽글의 숨 · 떨림
  const breath = 1 + 0.012 * Math.sin(t * 9.2);
  const growl = t >= 0.25 && t < 1.4 ? 5 * Math.sin(t * 47) : 0;
  const shake = t >= T.no && t < T.no + 0.62 ? 15 * Math.sin((t - T.no) * 32) * (1 - (t - T.no) / 0.7) : 0;
  const hop = t >= T.ticket && t < T.boat ? Math.abs(Math.sin((t - T.ticket) * 6.4)) * 16 : 0;
  const pearNear = 1 + interpolate(t, [T.again, T.end + 1.4, T.total], [0.0, 0.12, 0.15], clamp) + 0.012 * Math.sin(t * 5);
  const pearPulse = t >= T.give && t < T.no ? 1 + 0.05 * interpolate(t, [T.give, T.give + 0.1, T.give + 0.45], [0, 1, 0.15], clamp) : 1;
  return (
    <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy + bob}px) scale(${z * (1 + 0.03 * punch)}) rotate(${rot}deg)`, transformOrigin: `${s.cam[0]}px ${s.cam[1]}px` }}>
      <Img src={staticFile(`img/${s.img}.jpg`)} style={FULL} />
      {s.img === 'bed' ? <Patch img="bed" cx={280} cy={1150} rx={340} ry={360} sy={breath} sx={2 - breath} dx={growl} /> : null}
      {s.img === 'pear' && t >= T.give ? <Patch img="pear" cx={630} cy={1125} rx={220} ry={220} sx={pearPulse} sy={pearPulse} ox={630} oy={1125} /> : null}
      {s.img === 'recoil' ? <Patch img="recoil" cx={270} cy={1140} rx={370} ry={380} rot={shake * 0.28} dx={shake} /> : null}
      {s.img === 'ticket' ? <Patch img="ticket" cx={700} cy={960} rx={400} ry={560} dy={-hop} oy={1600} /> : null}
      {s.img === 'boatpear' ? <Patch img="boatpear" cx={490} cy={850} rx={250} ry={250} sx={pearNear} sy={pearNear} ox={490} oy={900} /> : null}
      {children}
    </AbsoluteFill>
  );
};

// 말풍선 — 한국어 크게 · 키릴 읽기 작게
const Bubble: React.FC<{ t: number; from: number; until: number; x: number; y: number; say: { ko: string; read: string }; tail: number; size?: number }> = ({ t, from, until, x, y, say, tail, size = 78 }) => {
  if (t < from || t >= until) return null;
  const a = pop(t, from);
  const w = Math.min(860, 100 + say.ko.length * size * 0.8);
  const h = size * 2.2;
  const left = Math.min(Math.max(60, x - w / 2), 920 - w);
  return (
    <div style={{ position: 'absolute', left, top: y - h / 2, width: w, height: h, transform: `scale(${a})`, transformOrigin: `${50 + tail * 34}% 100%` }}>
      <svg width={w} height={h + 52} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <path d={`M ${w / 2 + tail * 90 - 28} ${h - 4} L ${w / 2 + tail * 170} ${h + 50} L ${w / 2 + tail * 90 + 28} ${h - 4} Z`} fill={C.cream} stroke={C.shade} strokeWidth={6} strokeLinejoin="round" />
        <rect x={3} y={3} width={w - 6} height={h - 6} rx={Math.min(64, h / 2)} fill={C.cream} stroke={C.shade} strokeWidth={6} />
        <rect x={w / 2 + tail * 90 - 24} y={h - 12} width={48} height={12} fill={C.cream} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1.08, color: C.shade, whiteSpace: 'pre' }}>{say.ko}</div>
        <div style={{ fontFamily: MN, fontWeight: 700, fontSize: size * 0.62, lineHeight: 1.12, color: C.brown }}>🔊 {say.read}</div>
      </div>
    </div>
  );
};

// 꼬리표 — 「배 = 몽골어 한 낱말」, 바늘땀 실이 그 물건을 가리킨다
const Tag: React.FC<{ t: number; at: number; x: number; y: number; to: [number, number]; mn: string; until?: number }> = ({ t, at, x, y, to, mn, until = 99 }) => {
  if (t < at || t >= until) return null;
  const a = pop(t, at, 0.24);
  const draw = interpolate(t, [at, at + 0.2], [0, 1], clamp);
  const dx = to[0] - x;
  const dy = to[1] - y;
  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <line x1={x} y1={y} x2={x + dx * draw} y2={y + dy * draw} stroke={C.cream} strokeWidth={9} strokeDasharray="20 13" strokeLinecap="round" />
        {draw >= 1 ? <circle cx={to[0]} cy={to[1]} r={15} fill={C.cream} stroke={C.shade} strokeWidth={5} /> : null}
      </svg>
      <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${a}) rotate(-1.5deg)`, background: C.cream, borderRadius: 28, padding: '12px 28px', outline: `5px dashed ${C.stitch}`, outlineOffset: -11, display: 'flex', alignItems: 'baseline', gap: 14, whiteSpace: 'nowrap', boxShadow: '0 10px 24px rgba(50,20,10,0.32)' }}>
        <span style={{ fontFamily: KO, fontWeight: 900, fontSize: 96, lineHeight: 1.05, color: C.shade }}>배</span>
        <span style={{ fontFamily: MN, fontWeight: 800, fontSize: 66, color: C.brown }}>= {mn}</span>
      </div>
    </>
  );
};

// 위 띠 — 바늘땀 테 두른 천 이름표(뜻 줄)
const Band: React.FC<{ t: number; at: number; size?: number; children: React.ReactNode }> = ({ t, at, size = 60, children }) => {
  const a = fadeIn(t, at, 0.15);
  return (
    <div style={{ position: 'absolute', left: 70, width: 840, top: 236, background: 'rgba(255,253,248,0.98)', borderRadius: 34, outline: `5px dashed ${C.stitch}`, outlineOffset: -13, padding: '32px 36px 36px', boxSizing: 'border-box', boxShadow: '0 10px 28px rgba(60,20,10,0.28)', fontFamily: MN, fontWeight: 800, fontSize: size, lineHeight: 1.16, color: C.brown, textAlign: 'center', whiteSpace: 'pre-line', transform: `translateY(${(1 - a) * 14}px)`, opacity: a }}>
      {children}
    </div>
  );
};
const Top: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.card) return <Band t={t} at={-1}>{TEXT.hook}</Band>;
  if (t < T.tummy) return null; // 카드 칸은 카드 위 글이 대신한다
  if (t < T.give) return <Band t={t} at={T.tummy}>{TEXT.belly}</Band>;
  if (t < T.no) return <Band t={t} at={T.give}>{TEXT.pear}</Band>;
  if (t < T.ticket) return <Band t={t} at={T.no}>{TEXT.no}</Band>;
  if (t < T.boat) return <Band t={t} at={T.ticket}>{TEXT.boat}</Band>;
  if (t < T.again) return <Band t={t} at={T.boat}>{TEXT.bellyAgain}</Band>;
  if (t < T.toss) return <Band t={t} at={T.again}>{TEXT.again}</Band>;
  if (t < T.end) return <Band t={t} at={T.toss}>{TEXT.myPear}</Band>;
  return <Band t={t} at={T.end} size={60}>{TEXT.end}</Band>;
};

// 카드 — 2.0초에 튀어나와 1초 안에 몽글 배로 떨어진다(볼 이유 심사 「글자 판이 3초 멈춘다」)
const Card: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.card || t >= T.tummy) return null;
  const a = pop(t, T.card, 0.24);
  const fall = interpolate(t, [T.land, T.tummy - 0.03], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const x = 540 + (345 - 540) * fall;
  const y = 1020 + (1290 - 1020) * fall;
  const size = 600 * a * (1 - 0.84 * fall);
  const wig = fall > 0 ? 18 * fall : 3.2 * Math.sin((t - T.card) * 8);
  const op = fadeIn(t, T.card + 0.04, 0.12) * (1 - fall);
  return (
    <>
      <div style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, transform: `rotate(${wig}deg)` }}>
        <Img src={staticFile('img/card.png')} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 22px 28px rgba(50,20,10,0.5))' }} />
      </div>
      <div style={{ position: 'absolute', left: 0, width: 1080, top: 560, textAlign: 'center', opacity: op }}>
        <span style={{ display: 'inline-block', background: C.cream, borderRadius: 26, padding: '10px 30px 14px', fontFamily: MN, fontWeight: 800, fontSize: 60, color: C.brown, boxShadow: '0 10px 24px rgba(50,20,10,0.35)' }}>{TEXT.magic}</span>
      </div>
      <div style={{ position: 'absolute', left: 0, width: 1080, top: 1345, textAlign: 'center', fontFamily: MN, fontWeight: 800, fontSize: 76, color: C.cream, opacity: op, textShadow: '0 4px 18px rgba(40,15,8,0.75)' }}>🔊 {WORD.read}</div>
    </>
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
// 음악은 말할 때 내려가고 보트에 오르면 한 번 멎었다가 돌아온다
const bgmVol = (f: number) => {
  const t = f / 30;
  const lvl = interpolate(t, [0, 0.3, T.boat - 0.3, T.boat, T.boat + 0.9, T.boat + 1.3, T.total - 0.5, T.total], [0.7, 1, 1, 0.25, 0.25, 0.8, 0.85, 0], clamp);
  return 0.13 * MASTER * lvl;
};
const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('sfx/bgm.wav')} volume={bgmVol} />
    <Audio src={staticFile('sfx/room.wav')} volume={0.1 * MASTER} />
    <Sfx file="growl.wav" at={0.25} vol={0.55} />
    <Sfx file="pop.wav" at={0.02} vol={0.2} />
    <Sfx file="sparkle.wav" at={T.card} vol={0.5} />
    <Sfx file="pom.wav" at={T.card + 0.02} vol={0.4} />
    <Sfx file="pom.wav" at={T.tummy - 0.05} vol={0.5} />
    <Sfx file="growl.wav" at={T.tummy + 0.02} vol={0.4} />
    <Vo id="m1" at={T.tummy + 0.15} />
    <Sfx file="pom.wav" at={T.tummy + 0.9} vol={0.3} />
    <Sfx file="door.wav" at={T.give - 0.08} vol={0.6} />
    <Vo id="r1" at={T.give + 0.12} />
    <Sfx file="pom.wav" at={T.give + 0.75} vol={0.3} />
    <Vo id="m2" at={T.no + 0.06} />
    <Sfx file="door.wav" at={T.ticket - 0.04} vol={0.2} />
    <Vo id="r2" at={T.ticket + 0.1} />
    <Sfx file="pom.wav" at={T.ticket + 1.15} vol={0.3} />
    <Sfx file="horn.wav" at={T.boat - 0.35} vol={0.65} />
    <Sequence from={fr(T.boat)} layout="none">
      <Audio src={staticFile('sfx/water.wav')} volume={0.26 * MASTER} />
    </Sequence>
    <Sfx file="oar.wav" at={T.boat + 0.25} vol={0.32} />
    <Sfx file="growl.wav" at={T.boat + 1.05} vol={0.4} />
    <Vo id="m3" at={T.boat + 0.16} />
    <Sfx file="pop.wav" at={T.again - 0.02} vol={0.25} />
    <Vo id="r3" at={T.again + 0.08} />
    <Sfx file="dizzy.wav" at={T.again + 0.62} vol={0.35} />
    <Sfx file="whoosh.wav" at={T.toss - 0.06} vol={0.55} />
    <Sfx file="pom.wav" at={T.toss} vol={0.6} />
    <Sfx file="splash.wav" at={T.toss + 0.5} vol={0.7} />
    <Vo id="r4" at={T.toss + 0.12} />
    <Sfx file="pom.wav" at={T.tag1} vol={0.5} />
    <Sfx file="pom.wav" at={T.tag2} vol={0.5} />
    <Sfx file="pom.wav" at={T.tag3} vol={0.5} />
    <Sfx file="horn.wav" at={T.horn} vol={0.7} />
    <Vo id="m4" at={T.last} />
    <Sfx file="growl.wav" at={T.last + 0.5} vol={0.55} />
  </>
);

export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const dim = t >= T.card && t < T.tummy ? interpolate(t, [T.card, T.card + 0.15, T.land, T.tummy - 0.05], [0, 1, 1, 0], clamp) : 0;
  return (
    <AbsoluteFill style={{ background: '#2B1A14' }}>
      <Plate t={t}>
        <Tag t={t} at={T.tummy + 0.75} x={720} y={1150} to={[420, 1265]} mn={WORD.belly} until={T.give} />
        <Tag t={t} at={T.give + 0.62} x={640} y={1390} to={[630, 1255]} mn={WORD.pear} until={T.no} />
        <Tag t={t} at={T.ticket + 1.0} x={235} y={700} to={[430, 770]} mn={WORD.boat} until={T.boat} />
        <Tag t={t} at={T.tag1} x={690} y={1130} to={[440, 1250]} mn={WORD.belly} />
        <Tag t={t} at={T.tag2} x={310} y={570} to={[235, 700]} mn={WORD.pear} />
        <Tag t={t} at={T.tag3} x={700} y={1350} to={[540, 1440]} mn={WORD.boat} />
      </Plate>
      {dim > 0 ? <AbsoluteFill style={{ background: `rgba(40,15,8,${0.5 * dim})` }} /> : null}
      <Bubble t={t} from={T.tummy + 0.08} until={T.give} x={420} y={790} say={SAY.m1} tail={-1} />
      <Bubble t={t} from={T.give + 0.05} until={T.no} x={640} y={590} say={SAY.r1} tail={1} />
      <Bubble t={t} from={T.no + 0.02} until={T.ticket} x={340} y={730} say={SAY.m2} tail={-1} />
      <Bubble t={t} from={T.ticket + 0.03} until={T.boat} x={600} y={510} say={SAY.r2} tail={1} size={70} />
      <Bubble t={t} from={T.boat + 0.12} until={T.again} x={360} y={860} say={SAY.m3} tail={1} size={70} />
      <Bubble t={t} from={T.again + 0.02} until={T.toss} x={520} y={540} say={SAY.r3} tail={1} />
      <Bubble t={t} from={T.last} until={T.total} x={500} y={880} say={SAY.m4} tail={0} size={70} />
      <Bubble t={t} from={T.toss + 0.08} until={T.end} x={700} y={520} say={SAY.r4} tail={0} />
      <Top t={t} />
      <Card t={t} />
      <Sound />
    </AbsoluteFill>
  );
};
