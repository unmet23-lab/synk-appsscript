// LAB 영어 E36 「내립시다」 — 만원 지하철. 아주머니가 「내립시다!」 하며 문 쪽으로 비집고 가자, 그 말을 글자 그대로 「Let's get off」로 알아들은 몽글이 따라 내린다.
// 승강장에서 아주머니는 돌아보지 않고 가 버리고, 알림음 끝에 문이 닫히고 열차가 떠나 몽글만 남는다(핵심 장면) — It was not my stop.
// 그 말은 「저 내려요」였다. 다음엔 「잠시만요, 내릴게요」 — 끝은 빈 승강장 벤치에서 혼자 연습하는 몽글.
// 장면은 GPT 이미지(구독 경로)로 구운 판(판/*.png, 지시문 판/*.txt). 화면 글은 판 · 상자 없이 위쪽 어두운 자리의 큰 글자 한 갈래, 말은 말한 이 곁의 글자. 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { FONT, KO, TEXT } from './data';
import { fr, T } from './timeline';

const C = { cream: '#FFF6E6', coral: '#FF8A75', mint: '#9FD8B4', dim: 'rgba(255,246,230,0.84)' };
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const FULL: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, objectFit: 'cover' };
const pop = (t: number, at: number, d = 0.22) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
const SHADOW = '0 3px 0 rgba(8,12,10,0.95), 0 0 12px rgba(4,8,6,0.95), 0 0 26px rgba(4,8,6,0.9), 0 6px 30px rgba(4,8,6,0.9)';

// 장면 — 시작 초 · 그림 · 다가갈 자리 · 시작/끝 크기(「go」는 열차가 미끄러져 나가는 합성)
type Shot = { at: number; img: string; cam: [number, number]; z0: number; z1: number };
export const SHOTS: Shot[] = [
  { at: 0, img: 'call', cam: [600, 1200], z0: 1.0, z1: 1.06 },
  { at: T.call, img: 'call', cam: [760, 1050], z0: 1.2, z1: 1.26 },
  { at: T.think, img: 'think', cam: [520, 1250], z0: 1.0, z1: 1.06 },
  { at: T.w1, img: 'think', cam: [520, 1150], z0: 1.1, z1: 1.14 },
  { at: T.w2, img: 'think', cam: [600, 1200], z0: 1.18, z1: 1.22 },
  { at: T.w3, img: 'think', cam: [500, 1250], z0: 1.05, z1: 1.0 },
  { at: T.out, img: 'out', cam: [640, 1200], z0: 1.0, z1: 1.06 },
  { at: T.outZoom, img: 'out', cam: [380, 1480], z0: 1.35, z1: 1.45 },
  { at: T.walk, img: 'walk', cam: [540, 1250], z0: 1.0, z1: 1.04 },
  { at: T.far, img: 'walk', cam: [210, 1200], z0: 1.3, z1: 1.38 },
  { at: T.huh, img: 'walk', cam: [800, 1350], z0: 1.3, z1: 1.36 },
  { at: T.chime, img: 'walk', cam: [540, 1250], z0: 1.06, z1: 1.0 },
  { at: T.rush, img: 'gap', cam: [560, 1100], z0: 1.25, z1: 1.4 },
  { at: T.shut, img: 'go', cam: [560, 1150], z0: 1.12, z1: 1.16 },
  { at: T.stare, img: 'go', cam: [550, 880], z0: 2.3, z1: 2.42 },
  { at: T.hiss, img: 'go', cam: [540, 1250], z0: 1.03, z1: 1.03 },
  { at: T.go, img: 'go', cam: [540, 1250], z0: 1.03, z1: 1.0 },
  { at: T.line, img: 'alone', cam: [700, 1300], z0: 1.0, z1: 1.05 },
  { at: T.sad, img: 'sad', cam: [850, 1420], z0: 1.2, z1: 1.32 },
  { at: T.meant, img: 'meant', cam: [560, 1000], z0: 1.0, z1: 1.06 },
  { at: T.fair, img: 'meant', cam: [560, 960], z0: 1.1, z1: 1.14 },
  { at: T.you, img: 'meant', cam: [640, 1000], z0: 1.2, z1: 1.22 },
  { at: T.polite, img: 'polite', cam: [500, 1380], z0: 1.22, z1: 1.14 },
  { at: T.part, img: 'polite', cam: [640, 1300], z0: 1.0, z1: 1.05 },
  { at: T.eq, img: 'polite', cam: [500, 1400], z0: 1.1, z1: 1.16 },
  { at: T.bench, img: 'bench', cam: [540, 1200], z0: 1.0, z1: 1.05 },
  { at: T.prac, img: 'bench', cam: [540, 1230], z0: 1.25, z1: 1.4 },
  { at: T.end, img: 'bench', cam: [540, 1215], z0: 1.95, z1: 2.02 },
];
const shotAt = (t: number) => {
  let k = 0;
  for (let i = 1; i < SHOTS.length; i++) if (t >= SHOTS[i].at) k = i;
  return k;
};
const PUNCH = [T.call, T.w3, T.out, T.rush, T.shut, T.go, T.sad, T.polite];

// 같은 그림의 한 자리만 따로 움직인다 — 몸을 늘이지 않고 자리 · 기울기만(펠트가 고무처럼 읽히지 않게)
const Patch: React.FC<{ img: string; cx: number; cy: number; rx: number; ry: number; dx?: number; dy?: number; rot?: number }> = ({ img, cx, cy, rx, ry, dx = 0, dy = 0, rot = 0 }) => {
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, black 72%, transparent 100%)`;
  return <Img src={staticFile(`img/${img}.jpg`)} style={{ ...FULL, WebkitMaskImage: mask, maskImage: mask, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, transformOrigin: `${cx}px ${cy + ry * 0.85}px` }} />;
};

// 그림마다 몽글 자리(가운데 x · y · 반지름 x · y) — 구운 그림에서 잰 값
export const SPOT: Record<string, [number, number, number, number]> = {
  call: [235, 1530, 185, 215],
  think: [500, 1230, 380, 410],
  out: [360, 1460, 235, 245],
  walk: [800, 1365, 225, 250],
  alone: [795, 1360, 225, 250],
  polite: [492, 1400, 255, 270],
  bench: [540, 1200, 105, 115],
};
const hop = (t: number, at: number, h: number, n = 1, d = 0.32) => {
  const u = (t - at) / d;
  return u < 0 || u > n ? 0 : -h * Math.abs(Math.sin(Math.PI * u));
};

// 열차가 떠난다 — 빈 승강장(alone) 위에서 열차만 있는 판(train)이 왼쪽으로 점점 빨리 빠져나가고, 몽글 조각(문 닫힌 판에서 딴 것)은 제자리에 선다.
const GO_SEC = 1.86;
const Depart: React.FC<{ t: number }> = ({ t }) => {
  const u = interpolate(t, [T.go, T.go + GO_SEC], [0, 1], clamp);
  const x = -3400 * Math.pow(u, 2.1);
  const blur = 13 * Math.min(1, u * 2.2);
  const band: React.CSSProperties = { position: 'absolute', left: 0, top: 480, width: 1080, height: 858, overflow: 'hidden' };
  const tile = (i: number): React.CSSProperties => ({ position: 'absolute', left: i * 1080 + x, top: -480, width: 1080, height: 1920, transform: i % 2 ? 'scaleX(-1)' : undefined, filter: blur > 0.3 ? `blur(${blur}px)` : undefined });
  // 몽글 조각은 문 닫힌 판의 자리(가운데 794 · 밑 1588)에서 딴 것 — 문틈으로 달려간 자리(가운데 600 · 밑 1412, 0.66배)로 옮겨 세운다
  const knock = hop(t, T.shut + 0.12, 26) + hop(t, T.stare + 0.25, 34, 3, 0.3) + hop(t, T.hiss - 0.55, 22, 1, 0.3);
  const lean = u > 0 ? interpolate(u, [0, 0.25, 1], [0, -7, -3], clamp) : 0; // 떠나는 열차를 따라 몸이 기운다
  const follow = u > 0 ? interpolate(u, [0, 0.5, 1], [0, -26, -34], clamp) : 0;
  return (
    <>
      <Img src={staticFile('img/empty.jpg')} style={FULL} />
      <div style={band}>
        {[0, 1, 2].map((i) => (
          <Img key={i} src={staticFile('img/train.jpg')} style={tile(i)} />
        ))}
      </div>
      <Img src={staticFile('img/m_back.png')} style={{ ...FULL, transformOrigin: '794px 1588px', transform: `translate(${-194 + follow}px, ${-176 + knock}px) scale(0.66) rotate(${lean}deg)` }} />
    </>
  );
};

const Plate: React.FC<{ t: number }> = ({ t }) => {
  const k = shotAt(t);
  const s = SHOTS[k];
  const next = k + 1 < SHOTS.length ? SHOTS[k + 1].at : T.total;
  const z = interpolate(t, [s.at, next], [s.z0, s.z1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  let punch = 0;
  for (const b of PUNCH) punch = Math.max(punch, interpolate(t, [b - 0.02, b + 0.07, b + 0.4], [0, 1, 0], clamp));
  const rumble = t < T.out || (t >= T.meant && t < T.bench) ? 1 : 0; // 달리는 객차 안에서만 덜컹
  const sx = 2.2 * Math.sin((2 * Math.PI * t) / 3.7) + rumble * 1.6 * Math.sin(t * 31);
  const sy = 1.8 * Math.sin((2 * Math.PI * t) / 4.6 + 1) + rumble * 2.2 * Math.sin(t * 23 + 1);
  const wrap: React.CSSProperties = { transform: `translate(${sx}px, ${sy}px) scale(${z * (1 + 0.03 * punch)})`, transformOrigin: `${s.cam[0]}px ${s.cam[1]}px` };
  if (s.img === 'go') {
    return (
      <AbsoluteFill style={wrap}>
        <Depart t={t} />
      </AbsoluteFill>
    );
  }
  const sp = SPOT[s.img];
  let mdx = 0;
  let mdy = 0;
  let mrot = 0;
  let extra: React.ReactNode = null;
  if (s.img === 'call') {
    mdy = hop(t, T.call + 0.12, 34);
    // 아주머니가 문 쪽으로 밀고 나간다
    const push = interpolate(t, [T.call, T.call + 0.25, T.think], [0, 16, 26], clamp);
    extra = <Patch img="call" cx={690} cy={1210} rx={390} ry={500} dx={push + 3 * Math.sin(t * 17)} dy={2 * Math.sin(t * 13)} />;
  }
  if (s.img === 'think') {
    mrot = 3.2 * Math.sin((t - T.think) * 2.6);
    mdy = hop(t, T.w3 + 0.1, 46, 2, 0.28);
  }
  if (s.img === 'out') mdy = hop(t, T.out + 0.2, 26, 3, 0.26);
  if (s.img === 'walk') {
    // 아주머니는 걸어서 멀어진다(조금씩 왼쪽으로 · 걸음마다 들썩)
    const away = interpolate(t, [T.walk, T.shut], [0, -46], clamp);
    extra = <Patch img="walk" cx={215} cy={1210} rx={235} ry={430} dx={away} dy={-7 * Math.abs(Math.sin((t - T.walk) * Math.PI * 3.6))} />;
    mrot = t >= T.huh && t < T.chime ? 5 * Math.sin((t - T.huh) * 4) * Math.exp(-(t - T.huh) * 0.8) : 0;
    mdy = hop(t, T.chime + 0.05, 26);
    mdx = t >= T.chime + 0.4 ? interpolate(t, [T.chime + 0.4, T.rush], [0, -40], clamp) : 0;
  }
  if (s.img === 'alone') mrot = 2.4 * Math.sin((t - T.line) * 2.2);
  if (s.img === 'polite') mdy = hop(t, T.polite + 0.1, 30, 2, 0.3);
  if (s.img === 'bench') mrot = t >= T.prac ? 3 * Math.sin((t - T.prac) * 5) : 0;
  return (
    <AbsoluteFill style={wrap}>
      <Img src={staticFile(`img/${s.img}.jpg`)} style={FULL} />
      {extra}
      {sp ? <Patch img={s.img} cx={sp[0]} cy={sp[1]} rx={sp[2]} ry={sp[3]} dx={mdx} dy={mdy} rot={mrot} /> : null}
    </AbsoluteFill>
  );
};

// 한글만 굵게(영어 글꼴과 섞일 때)
const mix = (s: string, hl?: string) =>
  s.split(/([가-힣ㄱ-ㅎ]+(?:[,…!~ ]*[가-힣ㄱ-ㅎ]+)*)/).map((p, i) => (
    <span key={i} style={/[가-힣ㄱ-ㅎ]/.test(p) ? { fontFamily: KO, fontWeight: 900, color: hl } : undefined}>
      {p}
    </span>
  ));

// 화면 글 — 판 없이 위쪽 어두운 자리에: 작은 줄(옅게) + 큰 줄(굵게) + 덧붙임 한 줄
const Title: React.FC<{ t: number; at: number; until: number; small?: string; big: string; size?: number; top?: number; note?: string; noteAt?: number; hl?: string }> = ({ t, at, until, small, big, size = 96, top = 280, note, noteAt, hl }) => {
  if (t < at || t >= until) return null;
  const a = interpolate(t, [at, at + 0.2], [0, 1], { ...clamp, easing: EASE_OUT });
  const na = note ? interpolate(t, [noteAt ?? at, (noteAt ?? at) + 0.2], [0, 1], { ...clamp, easing: EASE_OUT }) : 0;
  return (
    <div style={{ position: 'absolute', left: 80, width: 830, top, textAlign: 'center', opacity: a, transform: `translateY(${(1 - a) * 18}px)`, textShadow: SHADOW }}>
      {small ? <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 46, lineHeight: 1.2, color: C.dim, letterSpacing: 0.5 }}>{mix(small)}</div> : null}
      {big ? <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: size, lineHeight: 1.12, color: C.cream, marginTop: small ? 34 : 0, whiteSpace: 'pre-line' }}>{mix(big, hl)}</div> : null}
      {note ? <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 54, lineHeight: 1.2, color: C.dim, marginTop: 16, opacity: na }}>{mix(note)}</div> : null}
    </div>
  );
};

// 말 — 말한 이 곁에 글자만(상자 · 테두리 없음)
const Say: React.FC<{ t: number; from: number; until: number; x: number; y: number; ko: string; sub?: string; size?: number; rot?: number; shake?: boolean; color?: string }> = ({ t, from, until, x, y, ko, sub, size = 118, rot = -5, shake, color = C.cream }) => {
  if (t < from || t >= until) return null;
  const a = pop(t, from);
  const j = shake ? 3 * Math.sin(t * 40) * Math.exp(-(t - from) * 3) : 0;
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) rotate(${rot + j}deg) scale(${a})`, textAlign: 'center', whiteSpace: 'nowrap', textShadow: SHADOW }}>
      <div style={{ fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1.05, color }}>{ko}</div>
      {sub ? <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: Math.max(44, size * 0.4), lineHeight: 1.2, color: C.dim, fontStyle: 'italic' }}>{sub}</div> : null}
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
// 음악은 열차가 떠나 혼자 남는 동안만 반쯤 낮췄다가 돌아온다(그 밑에 빈 승강장 소리가 깔려 있다 — 음악층 ⑲)
const bgmVol = (f: number) => {
  const t = f / 30;
  const k = interpolate(t, [0, T.go, T.go + 0.4, T.sad + 0.3, T.meant, T.total - 0.6, T.total], [1, 1, 0.56, 0.56, 1, 1, 0], clamp);
  return 0.13 * MASTER * k;
};
const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('sfx/bgm.wav')} volume={bgmVol} />
    <Audio src={staticFile('sfx/car.wav')} volume={(f) => 0.3 * MASTER * interpolate(f / 30, [0, T.out, T.walk], [1, 1, 0], clamp)} />
    <Audio src={staticFile('sfx/crowd.wav')} volume={(f) => 0.2 * MASTER * interpolate(f / 30, [0, T.out, T.out + 0.8], [1, 1, 0], clamp)} />
    <Sequence from={fr(T.out)} layout="none">
      <Audio src={staticFile('sfx/station.wav')} volume={(f) => 0.24 * MASTER * interpolate(f / 30 + T.out, [T.out, T.walk, T.meant - 0.2, T.meant, T.bench - 0.2, T.bench, T.total - 0.4, T.total], [0, 1, 1, 0, 0, 1, 1, 0], clamp)} />
    </Sequence>
    <Sequence from={fr(T.meant)} layout="none">
      <Audio src={staticFile('sfx/car.wav')} volume={(f) => 0.24 * MASTER * interpolate(f / 30 + T.meant, [T.meant, T.meant + 0.2, T.bench - 0.2, T.bench], [0, 1, 1, 0], clamp)} />
    </Sequence>
    <Vo id="a1" at={T.call} vol={1.05} />
    <Sfx file="whoosh.wav" at={T.call - 0.1} vol={0.25} />
    <Sfx file="boing.wav" at={T.call + 0.14} vol={0.25} />
    <Sfx file="pop.wav" at={T.think} vol={0.22} />
    <Sfx file="pop.wav" at={T.w1} vol={0.22} />
    <Sfx file="pop.wav" at={T.w2} vol={0.22} />
    <Sfx file="pop.wav" at={T.walk + 0.1} vol={0.2} />
    <Sfx file="pop.wav" at={T.rush + 0.05} vol={0.22} />
    <Sfx file="pop.wav" at={T.w3} vol={0.22} />
    <Sfx file="boing.wav" at={T.w3 + 0.1} vol={0.4} />
    <Sfx file="open.wav" at={T.out - 0.3} vol={0.45} />
    <Sfx file="hops.wav" at={T.out + 0.2} vol={0.45} />
    <Sfx file="hops.wav" at={T.outZoom} vol={0.4} />
    <Sfx file="whoosh.wav" at={T.walk - 0.15} vol={0.25} />
    <Sfx file="steps.wav" at={T.walk + 0.05} vol={0.42} />
    <Sfx file="steps.wav" at={T.far + 0.1} vol={0.3} />
    <Sfx file="pop.wav" at={T.huh} vol={0.22} />
    <Sfx file="chime.wav" at={T.chime} vol={0.5} />
    <Sfx file="shut.wav" at={T.shut - 0.33} vol={0.7} />
    <Sfx file="hops.wav" at={T.rush - 0.05} vol={0.5} />
    <Sfx file="boing.wav" at={T.shut + 0.12} vol={0.25} />
    <Sfx file="hops.wav" at={T.stare + 0.25} vol={0.5} />
    <Sfx file="boing.wav" at={T.hiss - 0.55} vol={0.22} />
    <Sfx file="open.wav" at={T.hiss - 0.1} vol={0.3} />
    <Sfx file="depart.wav" at={T.go} vol={0.75} />
    <Sfx file="pop.wav" at={T.go + 0.55} vol={0.22} />
    <Sfx file="sad.wav" at={T.sad - 0.05} vol={0.45} />
    <Sfx file="whoosh.wav" at={T.meant - 0.15} vol={0.25} />
    <Sfx file="pop.wav" at={T.meant} vol={0.22} />
    <Sfx file="pop.wav" at={T.fair} vol={0.2} />
    <Sfx file="ding.wav" at={T.you} vol={0.35} />
    <Sfx file="whoosh.wav" at={T.polite - 0.15} vol={0.25} />
    <Vo id="m1" at={T.polite + 0.08} />
    <Sfx file="open.wav" at={T.part} vol={0.35} />
    <Sfx file="ding.wav" at={T.eq} vol={0.3} />
    <Sfx file="whoosh.wav" at={T.bench - 0.15} vol={0.25} />
    <Vo id="m2" at={T.prac + 0.05} vol={0.9} />
    <Sfx file="pop.wav" at={T.end} vol={0.18} />
  </>
);

// 장면 심사용(scene)에는 화면 글을 빼고 장면의 말 · 소리만 남긴다
export const Film: React.FC<{ scene?: boolean }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  return (
    <AbsoluteFill style={{ background: '#0F1C1A' }}>
      <Plate t={t} />
      {/* 위쪽을 살짝 어둡게 — 글자가 놓일 자리(상자가 아니라 빛) */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 980, opacity: interpolate(t, [T.stare - 0.01, T.stare, T.go + 0.3, T.go + 0.55], [1, 0, 0, 1], clamp), background: 'linear-gradient(to bottom, rgba(8,16,14,1) 0%, rgba(8,16,14,1) 38%, rgba(8,16,14,0.95) 62%, rgba(8,16,14,0.66) 82%, rgba(8,16,14,0) 100%)' }} />
      <Say t={t} from={T.call} until={T.think} x={520} y={640} ko="내립시다!" sub={TEXT.callRead} size={132} rot={-4} shake />
      <Say t={t} from={T.w1} until={T.w3} x={540} y={800} ko={TEXT.together} size={104} rot={4} color={C.coral} />
      <Say t={t} from={T.w3 + 0.1} until={T.out} x={540} y={800} ko={TEXT.ok} size={130} rot={5} shake color={C.coral} />
      <Say t={t} from={T.huh} until={T.chime} x={720} y={985} ko={TEXT.hello} size={92} rot={-4} />
      <Say t={t} from={T.rush + 0.05} until={T.stare} x={735} y={1010} ko={TEXT.wait} size={100} rot={-5} shake color={C.coral} />
      <Say t={t} from={T.prac + 0.05} until={T.total + 1} x={540} y={900} ko="잠시만요… 내릴게요…" sub={TEXT.pracRead} size={66} rot={-2} />
      {!scene ? (
        <>
          <Title t={t} at={-1} until={T.think} big={TEXT.hook} size={72} />
          <Title t={t} at={T.think} until={T.out} small={TEXT.heardSmall} big={TEXT.heard} size={100} note={TEXT.usually} noteAt={T.w2} />
          <Title t={t} at={T.walk} until={T.huh} big={TEXT.gotOff} size={74} />
          <Title t={t} at={T.huh} until={T.rush} big={TEXT.noLook} size={74} />
          <Title t={t} at={T.go + 0.55} until={T.meant} big={TEXT.line} size={80} />
          <Title t={t} at={T.meant} until={T.polite} small={TEXT.meantSmall} big={TEXT.meant} size={88} note={TEXT.fair} noteAt={T.fair} />
          <Title t={t} at={T.polite} until={T.eq} small={TEXT.youSmall} big={TEXT.youBig} size={112} note={TEXT.youRead} hl={C.mint} />
          <Title t={t} at={T.eq} until={T.bench} small={TEXT.eqSmall} big={TEXT.eq} size={78} />
          <Title t={t} at={T.end} until={T.total + 1} small={TEXT.endSmall} big="" />
        </>
      ) : null}
      <Sound />
    </AbsoluteFill>
  );
};
