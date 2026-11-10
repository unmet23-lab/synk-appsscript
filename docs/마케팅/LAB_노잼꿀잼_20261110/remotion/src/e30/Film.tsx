// LAB 영어 E30 「노잼 · 꿀잼」 — 밤 거실. 지루한 영화에 친구가 「노잼…」 → 「잼(jam)」으로 알아들은 몽글이 딸기잼 병을 이고 코앞에 → 친구 「…?」.
// 잼 ≠ jam, 잼 = 재미(fun), 노잼 = no fun. TV에서 폭발이 터지자 친구 「우와! 꿀잼!」 → 몽글 「꿀… 잼?!」 → 쟁반에 꿀단지 + 잼 병을 이고 와 소파에 꿀을 쏟는다(핵심 장면).
// 꿀 = honey, 꿀잼 = super fun. 친구가 굳어 「어…? 내 소파…」 — 끝은 꿀이 흐르는 그 장면 위에서 「Your last 노잼 movie?」.
// 장면은 GPT 이미지(구독 경로)로 구운 판(판/*.png, 지시문 판/*.txt). 화면 글은 판 · 상자 없이 어두운 벽 위 큰 글자 한 갈래, 말은 말한 이 곁의 글자. 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { FONT, KO, TEXT } from './data';
import { fr, T } from './timeline';

const C = { cream: '#FFF6E6', jam: '#FF7B6E', honey: '#FFC247', no: '#A9C1E8', dim: 'rgba(255,246,230,0.82)' };
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
const pop = (t: number, at: number, d = 0.22) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
const SHADOW = '0 3px 0 rgba(30,14,6,0.55), 0 6px 18px rgba(20,8,2,0.6)';

// 장면 — 시작 초 · 그림 · 다가갈 자리 · 시작/끝 크기
type Shot = { at: number; img: string; cam: [number, number]; z0: number; z1: number };
export const SHOTS: Shot[] = [
  { at: 0, img: 'bored', cam: [560, 1150], z0: 1.0, z1: 1.07 },
  { at: T.jar, img: 'jar', cam: [600, 1100], z0: 1.04, z1: 1.1 },
  { at: T.notJam, img: 'jar', cam: [620, 1050], z0: 1.3, z1: 1.36 },
  { at: T.short, img: 'jar', cam: [560, 1100], z0: 1.12, z1: 1.06 },
  { at: T.sag, img: 'jar', cam: [640, 1150], z0: 1.42, z1: 1.5 },
  { at: T.boom, img: 'boom', cam: [300, 1000], z0: 1.18, z1: 1.0 },
  { at: T.cheer, img: 'cheer', cam: [640, 1050], z0: 1.06, z1: 1.12 },
  { at: T.think, img: 'cheer', cam: [640, 1250], z0: 1.4, z1: 1.46 },
  { at: T.bring, img: 'bring', cam: [420, 1350], z0: 1.14, z1: 1.06 },
  { at: T.drip, img: 'drip', cam: [600, 1200], z0: 1.0, z1: 1.08 },
  { at: T.notice, img: 'notice', cam: [600, 1150], z0: 1.04, z1: 1.1 },
  { at: T.ask, img: 'notice', cam: [560, 1350], z0: 1.34, z1: 1.42 },
];
const shotAt = (t: number) => {
  let k = 0;
  for (let i = 1; i < SHOTS.length; i++) if (t >= SHOTS[i].at) k = i;
  return k;
};
const PUNCH = [T.perk, T.jar, T.stare, T.boom, T.cheer, T.bring, T.drip, T.notice];

// 같은 그림의 한 자리만 따로 움직인다 — 숨 · 번쩍 · 축 처짐 · 만세
const Patch: React.FC<{ img: string; cx: number; cy: number; rx: number; ry: number; sx?: number; sy?: number; dx?: number; dy?: number; rot?: number; oy?: number; filter?: string }> = ({ img, cx, cy, rx, ry, sx = 1, sy = 1, dx = 0, dy = 0, rot = 0, oy, filter }) => {
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, black 74%, transparent 100%)`;
  return <Img src={staticFile(`img/${img}.jpg`)} style={{ ...FULL, WebkitMaskImage: mask, maskImage: mask, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${sx}, ${sy})`, transformOrigin: `${cx}px ${oy ?? cy + ry * 0.85}px`, filter }} />;
};

// 그림마다 몽글 · 친구 자리(굽고 나서 맞춘다)
export const SPOT: Record<string, { m: [number, number, number, number]; f: [number, number, number, number] }> = {
  bored: { m: [760, 1250, 150, 170], f: [480, 1100, 260, 380] },
  jar: { m: [640, 1050, 170, 300], f: [380, 1100, 260, 380] },
  boom: { m: [760, 1250, 150, 170], f: [520, 1050, 260, 400] },
  cheer: { m: [780, 1250, 150, 170], f: [540, 950, 300, 480] },
  bring: { m: [300, 1500, 190, 330], f: [640, 950, 300, 480] },
  drip: { m: [420, 1150, 200, 330], f: [700, 950, 300, 480] },
  notice: { m: [420, 1150, 200, 330], f: [700, 950, 300, 480] },
};

const Plate: React.FC<{ t: number }> = ({ t }) => {
  const k = shotAt(t);
  const s = SHOTS[k];
  const next = k + 1 < SHOTS.length ? SHOTS[k + 1].at : T.total;
  const z = interpolate(t, [s.at, next], [s.z0, s.z1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  let punch = 0;
  for (const b of PUNCH) punch = Math.max(punch, interpolate(t, [b - 0.02, b + 0.07, b + 0.4], [0, 1, 0], clamp));
  const sx = 2.5 * Math.sin((2 * Math.PI * t) / 3.7);
  const sy = 2 * Math.sin((2 * Math.PI * t) / 4.6 + 1);
  const breath = 1 + 0.014 * Math.sin(t * 3.6);
  const sp = SPOT[s.img];
  const [mx, my, mrx, mry] = sp.m;
  const [fx, fy, frx, fry] = sp.f;
  // 몽글 — 번쩍(0.8초) · 병을 인 채 까딱 · 축 처짐 · 갸웃 · 쟁반을 이고 통통 · 뿌듯
  let mdy = 0;
  let msy = breath;
  let mrot = 0;
  if (s.img === 'bored' && t >= T.perk) {
    const u = t - T.perk;
    mdy = -46 * Math.abs(Math.sin(Math.PI * Math.min(1, u / 0.34))) * Math.max(0, 1 - u / 0.9);
    mrot = 5 * Math.sin(u * 9) * Math.exp(-u * 1.6);
  }
  if (s.img === 'jar') {
    const sag = interpolate(t, [T.sag, T.sag + 0.5], [0, 1], clamp);
    mrot = t < T.sag ? 2.5 * Math.sin(t * 5.2) : 0;
    msy = breath - 0.07 * sag;
    mdy = 6 * sag;
  }
  if (s.img === 'cheer' && t >= T.think) mrot = 7 * Math.sin((t - T.think) * 3.2);
  if (s.img === 'bring') mdy = -30 * Math.abs(Math.sin((t - T.bring) * Math.PI * 5));
  if (s.img === 'drip' || s.img === 'notice') mrot = 1.6 * Math.sin(t * 4.4);
  // 친구 — 하품에 들썩 · 폭발에 움찔 · 만세 들썩 · 굳음
  let fdy = 0;
  let fsy = breath;
  if (s.img === 'bored') fsy = 1 + 0.03 * Math.sin(Math.min(1, Math.max(0, (t - T.no) / 1.3)) * Math.PI);
  if (s.img === 'boom') fdy = -26 * Math.max(0, 1 - (t - T.boom) / 0.3);
  if (s.img === 'cheer' || s.img === 'bring' || s.img === 'drip') fdy = -16 * Math.abs(Math.sin(t * 6.5));
  if (s.img === 'notice') {
    fdy = 0;
    fsy = 1;
  }
  // 몽글이 휙 사라진다(dash) — cheer 장면에서 왼쪽 아래로 빠져나간다
  const gone = s.img === 'cheer' ? interpolate(t, [T.dash, T.dash + 0.28], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) }) : 0;
  // TV 빛 — 지루할 땐 파랗게 깜박, 폭발 뒤엔 주황으로 일렁
  const tvCold = s.img === 'bored' || s.img === 'jar';
  const flick = tvCold ? 0.05 + 0.04 * Math.sin(t * 2.1) : 0.1 + 0.08 * Math.abs(Math.sin(t * 9.3)) + 0.05 * Math.sin(t * 23);
  const flash = interpolate(t, [T.boom - 0.02, T.boom + 0.05, T.boom + 0.5], [0, 0.75, 0], clamp);
  // 꿀 — 쏟아지는 자리가 살짝 늘어났다 줄었다
  const pour = s.img === 'drip' || s.img === 'notice' ? 1 + 0.025 * Math.sin(t * 7) : 1;
  return (
    <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) scale(${z * (1 + 0.035 * punch)})`, transformOrigin: `${s.cam[0]}px ${s.cam[1]}px` }}>
      <Img src={staticFile(`img/${s.img}.jpg`)} style={FULL} />
      <Patch img={s.img} cx={fx} cy={fy} rx={frx} ry={fry} dy={fdy} sy={fsy} />
      {gone < 1 ? <Patch img={s.img} cx={mx} cy={my} rx={mrx} ry={mry} dy={mdy + 500 * gone} dx={-700 * gone} sy={msy * pour} sx={2 - msy} rot={mrot - 25 * gone} /> : null}
      <div style={{ position: 'absolute', inset: 0, background: tvCold ? 'radial-gradient(ellipse 700px 900px at 120px 900px, rgba(150,190,255,1) 0%, transparent 70%)' : 'radial-gradient(ellipse 800px 1000px at 120px 900px, rgba(255,170,70,1) 0%, transparent 70%)', opacity: flick, mixBlendMode: 'screen' }} />
      {flash > 0 ? <div style={{ position: 'absolute', inset: 0, background: '#FFE2B0', opacity: flash, mixBlendMode: 'screen' }} /> : null}
    </AbsoluteFill>
  );
};

// 한글 한 글자씩 색 — 잼(딸기) · 꿀(꿀) · 노(파랑)
const tint = (s: string) =>
  s.split(/(잼|꿀|노)/).map((p, i) => (
    <span key={i} style={{ fontFamily: /[가-힣]/.test(p) ? KO : undefined, fontWeight: /[가-힣]/.test(p) ? 900 : undefined, color: p === '잼' ? C.jam : p === '꿀' ? C.honey : p === '노' ? C.no : undefined }}>
      {p}
    </span>
  ));

// 화면 글 — 판 없이 어두운 벽 위에: 작은 줄(옅게) + 큰 줄(굵게)
const Title: React.FC<{ t: number; at: number; until: number; small?: string; big: string; size?: number; top?: number }> = ({ t, at, until, small, big, size = 104, top = 170 }) => {
  if (t < at || t >= until) return null;
  const a = interpolate(t, [at, at + 0.2], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ position: 'absolute', left: 50, width: 980, top, textAlign: 'center', opacity: a, transform: `translateY(${(1 - a) * 18}px)`, textShadow: SHADOW }}>
      {small ? <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 48, lineHeight: 1.2, color: C.dim, letterSpacing: 0.5 }}>{tint(small)}</div> : null}
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: size, lineHeight: 1.12, color: C.cream, marginTop: small ? 6 : 0, whiteSpace: 'pre-line' }}>{tint(big)}</div>
    </div>
  );
};

// 말 — 말한 이 곁에 글자만(상자 · 테두리 없음), 한글 크게 + 영어 한 줄
const Say: React.FC<{ t: number; from: number; until: number; x: number; y: number; ko: string; sub?: string; size?: number; rot?: number; shake?: boolean }> = ({ t, from, until, x, y, ko, sub, size = 118, rot = -5, shake }) => {
  if (t < from || t >= until) return null;
  const a = pop(t, from);
  const j = shake ? 3 * Math.sin(t * 40) * Math.exp(-(t - from) * 3) : 0;
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) rotate(${rot + j}deg) scale(${a})`, textAlign: 'center', whiteSpace: 'nowrap', textShadow: SHADOW }}>
      <div style={{ fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1.05, color: C.cream }}>{tint(ko)}</div>
      {sub ? <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: size * 0.4, lineHeight: 1.2, color: C.dim, fontStyle: 'italic' }}>{sub}</div> : null}
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
// 음악은 친구가 굳는 순간만 반쯤 낮췄다가 돌아온다(바탕 방 소리 · TV 소리는 그대로 — 음악층 ⑲)
const bgmVol = (f: number) => {
  const t = f / 30;
  const k = interpolate(t, [0, T.notice - 0.05, T.notice + 0.05, T.notice + 0.5, T.notice + 0.9, T.total - 0.5, T.total], [1, 1, 0.55, 0.55, 1, 1, 0], clamp);
  return 0.13 * MASTER * k;
};
const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('sfx/bgm.wav')} volume={bgmVol} />
    <Audio src={staticFile('sfx/room.wav')} volume={(f) => 0.18 * MASTER * interpolate(f / 30, [0, T.total - 0.4, T.total], [1, 1, 0], clamp)} />
    <Audio src={staticFile('sfx/tv_dull.wav')} volume={(f) => 0.2 * MASTER * interpolate(f / 30, [0, T.boom - 0.1, T.boom], [1, 1, 0], clamp)} />
    <Sequence from={fr(T.boom)} layout="none">
      <Audio src={staticFile('sfx/tv_action.wav')} volume={(f) => 0.14 * MASTER * interpolate(f / 30 + T.boom, [T.boom, T.boom + 0.3, T.total - 0.5, T.total], [0, 1, 1, 0], clamp)} />
    </Sequence>
    <Vo id="h1" at={T.no} />
    <Sfx file="boing.wav" at={T.perk} vol={0.4} />
    <Sfx file="pop.wav" at={T.perk + 0.25} vol={0.2} />
    <Sfx file="whoosh.wav" at={T.jar - 0.2} vol={0.32} />
    <Sfx file="clink.wav" at={T.jar + 0.05} vol={0.4} />
    <Sfx file="pop.wav" at={T.stare} vol={0.2} />
    <Sfx file="pop.wav" at={T.notJam} vol={0.22} />
    <Sfx file="pop.wav" at={T.short} vol={0.22} />
    <Vo id="n1" at={T.short + 0.15} />
    <Sfx file="pop.wav" at={T.noFun} vol={0.2} />
    <Sfx file="pop.wav" at={T.boring} vol={0.22} />
    <Sfx file="deflate.wav" at={T.sag + 0.05} vol={0.4} />
    <Sfx file="boom.wav" at={T.boom} vol={0.75} />
    <Sfx file="whoosh.wav" at={T.cheer - 0.15} vol={0.25} />
    <Vo id="h2" at={T.cheer + 0.05} vol={1.05} />
    <Sfx file="boing.wav" at={T.think} vol={0.32} />
    <Sfx file="whoosh.wav" at={T.dash} vol={0.4} />
    <Sfx file="hops.wav" at={T.bring} vol={0.5} />
    <Sfx file="whoosh.wav" at={T.drip - 0.15} vol={0.25} />
    <Sfx file="glug.wav" at={T.drip + 0.05} vol={0.6} />
    <Sfx file="drop.wav" at={T.honey + 0.1} vol={0.3} />
    <Sfx file="pop.wav" at={T.honey} vol={0.2} />
    <Sfx file="pop.wav" at={T.eq} vol={0.2} />
    <Sfx file="drop.wav" at={T.eq + 0.2} vol={0.3} />
    <Sfx file="freeze.wav" at={T.notice} vol={0.5} />
    <Vo id="h3" at={T.notice + 0.45} />
    <Sfx file="drop.wav" at={T.ask - 0.3} vol={0.3} />
    <Sfx file="pop.wav" at={T.ask} vol={0.22} />
    <Sfx file="drop.wav" at={T.ask + 1.2} vol={0.3} />
    <Sfx file="pop.wav" at={T.ask2} vol={0.2} />
    <Sfx file="drop.wav" at={T.ask2 + 0.9} vol={0.3} />
  </>
);

// 말 글자 자리(굽고 나서 맞춘다)
export const SAY = {
  no: [330, 640] as [number, number],
  jam: [800, 930] as [number, number],
  stare: [300, 700] as [number, number],
  cheer: [620, 520] as [number, number],
  honeyJam: [760, 1010] as [number, number],
  sofa: [700, 560] as [number, number],
};

// 장면 심사용(scene)에는 화면 글을 빼고 장면의 말 · 소리만 남긴다
export const Film: React.FC<{ scene?: boolean }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  return (
    <AbsoluteFill style={{ background: '#1B120E' }}>
      <Plate t={t} />
      {/* 위쪽 벽을 살짝 어둡게 — 글자가 놓일 자리(상자가 아니라 빛) */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 700, background: 'linear-gradient(to bottom, rgba(18,9,5,0.62) 0%, rgba(18,9,5,0.38) 55%, rgba(18,9,5,0) 100%)' }} />
      <Say t={t} from={T.no} until={T.jar} x={SAY.no[0]} y={SAY.no[1]} ko="노잼…" sub="“no-jaem…”" rot={-6} />
      <Say t={t} from={T.perk + 0.25} until={T.jar} x={SAY.jam[0]} y={SAY.jam[1]} ko="잼?!" sub={TEXT.mongleJam} size={96} rot={6} shake />
      <Say t={t} from={T.stare} until={T.short} x={SAY.stare[0]} y={SAY.stare[1]} ko="…?" size={130} rot={-4} />
      <Say t={t} from={T.cheer + 0.05} until={T.dash} x={SAY.cheer[0]} y={SAY.cheer[1]} ko="꿀잼!" sub="“kkul-jaem!”" size={150} rot={-5} shake />
      <Say t={t} from={T.think} until={T.dash} x={SAY.honeyJam[0]} y={SAY.honeyJam[1]} ko="꿀… 잼?!" sub={TEXT.mongleHoney} size={84} rot={5} />
      <Say t={t} from={T.notice + 0.45} until={T.ask} x={SAY.sofa[0]} y={SAY.sofa[1]} ko="내 소파…" sub="my sofa…" size={104} rot={-3} />
      {!scene ? (
        <>
          <Title t={t} at={-1} until={T.jar} big={TEXT.hook} size={84} />
          <Title t={t} at={T.notJam} until={T.short} small={TEXT.notJamSmall} big="잼 ≠ jam" size={132} />
          <Title t={t} at={T.short} until={T.noFun} small={TEXT.shortSmall} big={`잼 = ${TEXT.fun}`} size={132} />
          <Title t={t} at={T.noFun} until={T.boring} small={TEXT.noFunSmall} big="노 + 잼" size={132} />
          <Title t={t} at={T.boring} until={T.boom} small={TEXT.noFunSmall} big={`노잼 = ${TEXT.boring}`} size={118} />
          <Title t={t} at={T.honey} until={T.eq} big={`꿀 = ${TEXT.honey}`} size={132} />
          <Title t={t} at={T.eq} until={T.ask} small="honey + fun" big={`꿀잼 = ${TEXT.superFun}`} size={104} />
          <Title t={t} at={T.ask} until={T.ask2} big={TEXT.ask} size={88} />
          <Title t={t} at={T.ask2} until={T.total + 1} small={TEXT.ask2} big={TEXT.ask} size={88} />
        </>
      ) : null}
      <Sound />
    </AbsoluteFill>
  );
};
