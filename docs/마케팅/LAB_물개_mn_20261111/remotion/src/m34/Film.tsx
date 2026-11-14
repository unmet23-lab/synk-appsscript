// LAB 몽골 M34 「물개」 — 친구 「물개 보러 가자!」 → 몽글은 물 + 개를 글자 그대로 받아 스노클 쓴 강아지가 헤엄치는 것을 상상한다 → 수족관 유리 너머 진짜 물개(далайн хав).
// 둘째 세트: 「불꽃 보러 가자!」 → 불 + 꽃 = 불붙은 꽃(상상) → 밤하늘 불꽃놀이. 끝은 물개가 박수 치고, 몽글은 스노클을 쓰고 있다(핵심 장면이 끝 3초에 다시).
// 장면은 GPT 이미지(구독 경로)로 구운 판(판/*.png, 지시문 판/*.txt). 화면 글은 상자 · 띠 없이 위쪽 빈 자리의 큰 글자, 말은 말한 이 곁의 글자. 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { FONT, KO, READ, TEXT } from './data';
import { fr, T } from './timeline';

const C = { cream: '#FFF6E6', dim: 'rgba(255,246,230,0.86)', water: '#8FDCF5', dog: '#F2C08A', fire: '#FF9A5C', flower: '#FF9DBB', ink: '#1F2D4D', inkDim: 'rgba(31,45,77,0.82)' };
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
const pop = (t: number, at: number, d = 0.22) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
const SHADOW = '0 3px 0 rgba(6,14,30,0.8), 0 0 14px rgba(4,10,24,0.85), 0 6px 22px rgba(4,10,24,0.8)';
const GLOW = '0 2px 0 rgba(255,255,255,0.7), 0 0 18px rgba(255,255,255,0.75)';

// 장면 — 시작 초 · 그림 · 다가갈 자리 · 시작/끝 크기
// xf: 앞 장면에서 겹쳐 넘어간다(같은 자리 · 같은 배율에서 시작해 생각 구름만 떠오르게). v9: 같은 그림을 배율만 바꿔 잇던 두 자리(상상 강아지 7.4초 · 구름 10.8초)를
// 최종본 검사가 「같은판」으로 잡아 — 강아지는 끊지 않고 한 번에 밀고, 구름은 같은 틀에서 겹쳐 넘긴다.
type Shot = { at: number; img: string; cam: [number, number]; z0: number; z1: number; xf?: boolean };
export const SHOTS: Shot[] = [
  // v12: 같은 그림을 배율만 바꿔 다시 시작하던 자리(문 2.0초 · 끝 14.6 · 15.8초)를 없애고 장면마다 한 번에 천천히 민다(독립 검수 「꼭 고칠 것」).
  { at: 0, img: 'gate', cam: [560, 1350], z0: 1.0, z1: 1.12 },
  { at: T.dream, img: 'dream', cam: [670, 1000], z0: 1.0, z1: 1.2 },
  { at: T.real, img: 'tank', cam: [760, 900], z0: 1.14, z1: 1.0 },
  { at: T.cloud, img: 'tank_dream', cam: [760, 900], z0: 1.0, z1: 1.1, xf: true },
  { at: T.clap, img: 'tank_clap', cam: [600, 1060], z0: 1.0, z1: 1.22 },
];
const shotAt = (t: number) => {
  let k = 0;
  for (let i = 1; i < SHOTS.length; i++) if (t >= SHOTS[i].at) k = i;
  return k;
};
const PUNCH = [T.perk, T.dream, T.yay, T.real, T.cloud, T.clap];

// 같은 그림의 한 자리만 따로 움직인다 — 숨 · 번쩍 · 헤엄 · 손 흔들기 · 박수
const Patch: React.FC<{ img: string; cx: number; cy: number; rx: number; ry: number; sx?: number; sy?: number; dx?: number; dy?: number; rot?: number; oy?: number }> = ({ img, cx, cy, rx, ry, sx = 1, sy = 1, dx = 0, dy = 0, rot = 0, oy }) => {
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, black 72%, transparent 100%)`;
  return <Img src={staticFile(`img/${img}.jpg`)} style={{ ...FULL, WebkitMaskImage: mask, maskImage: mask, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${sx}, ${sy})`, transformOrigin: `${cx}px ${oy ?? cy + ry * 0.85}px` }} />;
};

// 그림마다 몽글(m) · 곁의 인물이나 동물(o) 자리 — [가운데 x, y, 반지름 x, y] (굽고 나서 맞춘다)
export const SPOT: Record<string, { m: [number, number, number, number]; o?: [number, number, number, number] }> = {
  gate: { m: [590, 1490, 200, 200], o: [370, 980, 330, 400] },
  dream: { m: [224, 1412, 230, 230], o: [677, 953, 400, 290] },
  tank: { m: [240, 1355, 250, 250], o: [380, 800, 150, 200] },
  tank_dream: { m: [250, 1280, 270, 430], o: [380, 800, 150, 200] },
  night: { m: [264, 1068, 185, 195], o: [735, 1030, 300, 560] },
  fireflower: { m: [298, 1412, 230, 250], o: [677, 735, 250, 220] },
  fireworks: { m: [264, 1068, 185, 215], o: [735, 1030, 300, 560] },
  tank_clap: { m: [240, 1330, 260, 300], o: [640, 830, 140, 150] },
};

const Plate: React.FC<{ t: number; kk?: number }> = ({ t, kk }) => {
  const k = kk ?? shotAt(t);
  const s = SHOTS[k];
  const next = k + 1 < SHOTS.length ? SHOTS[k + 1].at : T.total;
  const z = interpolate(t, [s.at, next], [s.z0, s.z1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  let punch = 0;
  for (const b of PUNCH) punch = Math.max(punch, interpolate(t, [b - 0.02, b + 0.07, b + 0.4], [0, 1, 0], clamp));
  const sx = 2.5 * Math.sin((2 * Math.PI * t) / 3.7);
  const sy = 2 * Math.sin((2 * Math.PI * t) / 4.6 + 1);
  const breath = 1; // 몸을 늘였다 줄이지 않는다(11-11 맹검)
  const sp = SPOT[s.img];
  const [mx, my, mrx, mry] = sp.m;
  // 몽글 — 번쩍 · 갸웃 · 통통 · 놀라 뒤로
  let mdy = 0;
  let msy = breath;
  let mrot = 0;
  const hop = (at: number, h = 46) => {
    const u = t - at;
    if (u < 0 || u > 0.9) return 0;
    return -h * Math.abs(Math.sin(Math.PI * Math.min(1, u / 0.34))) * Math.max(0, 1 - u / 0.9);
  };
  if (s.img === 'gate') {
    mdy = hop(T.perk);
    mrot = t >= T.w1 ? 6 * Math.sin((t - T.w1) * 3.4) : 0;
  }
  if (s.img === 'dream') mdy = -14 * Math.abs(Math.sin((t - T.dream) * Math.PI * 2.4));
  if (s.img === 'tank') {
    const u = t - T.real;
    mdy = hop(T.real, 60);
    mrot = -5 * Math.exp(-u * 2.2) * Math.cos(u * 14);
  }
  if (s.img === 'tank_dream') mrot = 5 * Math.sin((t - T.cloud) * 3.6);
  if (s.img === 'tank_clap') mdy = -18 * Math.abs(Math.sin((t - T.clap) * Math.PI * 2.3));
  // 곁의 인물 · 동물 — 친구는 가리키며 들썩, 강아지는 헤엄, 물개는 손을 흔들고 박수
  let ody = 0;
  let orot = 0;
  let osx = 1;
  if (s.img === 'gate') ody = -10 * Math.abs(Math.sin(t * 5.2));
  if (s.img === 'dream') {
    ody = 12 * Math.sin((t - T.dream) * 6.4);
    orot = 3.5 * Math.sin((t - T.dream) * 6.4 + 1);
  }
  if (s.img === 'tank' || s.img === 'tank_dream') orot = 9 * Math.sin((t - T.real) * 9.5);
  if (s.img === 'tank_clap') {
    const beat = Math.abs(Math.sin((t - T.clap) * Math.PI * 4.5));
    osx = 1;
    ody = -8 * beat;
  }
  // 진짜 물개가 유리 쪽으로 미끄러져 들어온다
  const slide = s.img === 'tank' ? interpolate(t, [T.real, T.real + 0.45], [1, 0], { ...clamp, easing: EASE_OUT }) : 0;
  const flash = 0;
  const glow = s.img === 'tank_clap' ? 0.1 + 0.08 * Math.abs(Math.sin(t * 2.7)) : 0;
  // 상상 장면은 구름 테가 살짝 숨 쉰다
  const dreamy = s.img === 'dream' ? 1 + 0.008 * Math.sin(t * 2.4) : 1;
  const enter = s.img === 'dream' ? interpolate(t, [s.at, s.at + 0.22], [1.14, 1], { ...clamp, easing: EASE_OUT }) : 1;
  return (
    <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) scale(${z * (1 + 0.035 * punch) * dreamy * enter})`, transformOrigin: `${s.cam[0]}px ${s.cam[1]}px` }}>
      <Img src={staticFile(`img/${s.img}.jpg`)} style={FULL} />
      {sp.o ? <Patch img={s.img} cx={sp.o[0]} cy={sp.o[1]} rx={sp.o[2]} ry={sp.o[3]} dy={ody} dx={slide * 60} rot={orot} sx={osx} /> : null}
      <Patch img={s.img} cx={mx} cy={my} rx={mrx} ry={mry} dy={mdy} sy={msy} sx={2 - msy} rot={mrot} />
      {flash > 0 ? <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 900px 900px at 540px 500px, #FFE9B8 0%, transparent 75%)', opacity: flash, mixBlendMode: 'screen' }} /> : null}
      {glow > 0 ? <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 800px 700px at 200px 500px, #FFB36B 0%, transparent 70%)', opacity: glow, mixBlendMode: 'screen' }} /> : null}
    </AbsoluteFill>
  );
};

const hue = (p: string) => (p === '물' ? C.water : p === '개' ? C.dog : p === '불' ? C.fire : p === '꽃' ? C.flower : undefined);
// 한글 한 글자씩 색 — 물(물빛) · 개(털빛) · 불(불빛) · 꽃(꽃빛)
const tint = (s: string, on = true) =>
  s.split(/(물|개|불|꽃)/).map((p, i) => (
    <span key={i} style={{ fontFamily: /[가-힣]/.test(p) ? KO : undefined, fontWeight: /[가-힣]/.test(p) ? 900 : undefined, color: on ? hue(p) : undefined }}>
      {p}
    </span>
  ));

// 화면 글 — 판 없이 위쪽 빈 자리에: 작은 줄(옅게) + 큰 줄(굵게). 밝은 상상 장면에서는 짙은 남색 글자
const Title: React.FC<{ t: number; at: number; until: number; small?: string; big: string; size?: number; top?: number; ink?: boolean; smallSize?: number; read?: string; foot?: string }> = ({ t, at, until, small, big, size = 104, top = 290, ink, smallSize = 56, read, foot }) => {
  if (t < at || t >= until) return null;
  const a = interpolate(t, [at, at + 0.2], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ position: 'absolute', left: 40, width: 1000, top, textAlign: 'center', opacity: a, transform: `translateY(${(1 - a) * 18}px)`, textShadow: ink ? GLOW : SHADOW }}>
      {small ? <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: smallSize, lineHeight: 1.2, color: ink ? C.inkDim : C.dim, letterSpacing: 0.5 }}>{tint(small, !ink)}</div> : null}
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: size, lineHeight: 1.12, color: ink ? C.ink : C.cream, marginTop: small ? 6 : 0, whiteSpace: 'pre-line' }}>{tint(big, !ink)}</div>
      {read ? <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 52, lineHeight: 1.25, color: C.dim, fontStyle: 'italic' }}>{read}</div> : null}
      {foot ? <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 58, lineHeight: 1.25, color: C.cream, marginTop: 18 }}>{foot}</div> : null}
    </div>
  );
};

// 낱말 한 칸 — 한글(크게) · 키릴 읽기 · 몽골 뜻 세 줄
const Word: React.FC<{ t: number; at: number; until: number; x: number; top?: number; ko: string; read: string; mean: string; size?: number; ink?: boolean }> = ({ t, at, until, x, top = 285, ko, read, mean, size = 170, ink }) => {
  if (t < at || t >= until) return null;
  const a = pop(t, at);
  return (
    <div style={{ position: 'absolute', left: x, top, transform: `translateX(-50%) scale(${a})`, transformOrigin: '50% 60%', textAlign: 'center', whiteSpace: 'nowrap', textShadow: ink ? GLOW : SHADOW }}>
      <div style={{ fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1.0, color: ink ? C.ink : (hue(ko) ?? C.cream) }}>{ko.length > 1 ? tint(ko, !ink) : ko}</div>
      <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: size * 0.36, lineHeight: 1.25, color: ink ? C.inkDim : C.dim, fontStyle: 'italic' }}>{read}</div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: size * 0.42, lineHeight: 1.15, color: ink ? C.ink : C.cream }}>{mean}</div>
    </div>
  );
};

// 말 — 말한 이 곁에 글자만(상자 · 테두리 없음)
const Say: React.FC<{ t: number; from: number; until: number; x: number; y: number; text: string; size?: number; rot?: number; shake?: boolean; ko?: boolean; ink?: boolean; sub?: string; subSize?: number }> = ({ t, from, until, x, y, text, size = 84, rot = -4, shake, ko, ink, sub, subSize = 46 }) => {
  if (t < from || t >= until) return null;
  const a = pop(t, from);
  const j = shake ? 3 * Math.sin(t * 40) * Math.exp(-(t - from) * 3) : 0;
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) rotate(${rot + j}deg) scale(${a})`, textAlign: 'center', whiteSpace: ko ? 'nowrap' : 'pre', textShadow: ink ? GLOW : SHADOW, fontFamily: ko ? KO : FONT, fontWeight: ko ? 900 : 800, fontSize: size, lineHeight: 1.1, color: ink ? C.ink : C.cream }}>
      {ko ? tint(text) : text}
      {sub ? <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: subSize, lineHeight: 1.25, color: C.dim, fontStyle: 'italic' }}>{sub}</div> : null}
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
const fade = (t: number, a: number, b: number, d = 0.25) => interpolate(t, [a - d, a, b, b + d], [0, 1, 1, 0], clamp);
const Sound: React.FC = () => (
  <>
    {/* v13: 목소리가 끝난 14.5초 뒤 평균이 5~7dB 낮았다(재검수) — 정리 · 퀴즈 구간은 음악을 올려 메운다 */}
    <Audio src={staticFile('sfx/bgm.wav')} volume={(f) => 0.2 * MASTER * interpolate(f / 30, [0, 14.0, 15.0, T.total - 0.5, T.total], [1, 1, 1.9, 1.9, 0], clamp)} />
    {/* 바탕 소리 — 수족관(처음 · 유리 앞 · 끝) / 밤 바닷가(둘째 세트) */}
    <Audio src={staticFile('sfx/aqua.wav')} volume={(f) => 0.2 * MASTER * fade(f / 30, 0, T.total - 0.4, 0.3)} />
    <Vo id="go1" at={T.go1} />
    <Sfx file="boing.wav" at={T.perk} vol={0.38} />
    <Sfx file="pop.wav" at={T.w1} vol={0.22} />
    <Vo id="w" at={T.w1 + 0.03} />
    <Sfx file="pop.wav" at={T.w2} vol={0.22} />
    <Vo id="d" at={T.w2 + 0.03} />
    <Sfx file="tok.wav" at={T.plus} vol={0.3} />
    <Sfx file="whoosh.wav" at={T.dream - 0.2} vol={0.32} />
    <Sfx file="dream.wav" at={T.dream} vol={0.4} />
    <Vo id="sq" at={T.dream + 0.3} />
    <Sfx file="splash_big.wav" at={T.dream + 0.9} vol={0.22} />
    <Sfx file="yip.wav" at={T.yay} vol={0.4} />
    <Sfx file="pop.wav" at={T.yay + 0.1} vol={0.2} />
    <Sfx file="whoosh.wav" at={T.real - 0.2} vol={0.34} />
    <Sfx file="sting.wav" at={T.real} vol={0.34} />
    <Sfx file="seal.wav" at={T.real + 0.2} vol={0.5} />
    <Sfx file="pop.wav" at={T.sealT} vol={0.22} />
    <Vo id="s" at={T.sealT + 0.1} />
    <Sfx file="pop.wav" at={T.cloud} vol={0.26} />
    <Sfx file="yip.wav" at={T.cloud + 0.15} vol={0.22} />
    <Sfx file="whoosh.wav" at={T.clap - 0.2} vol={0.3} />
    <Sfx file="clap.wav" at={T.clap + 0.05} vol={0.5} />
    <Sfx file="seal.wav" at={T.clap + 0.5} vol={0.45} />
    <Sfx file="pop.wav" at={T.recap} vol={0.2} />
    <Vo id="s" at={T.recap + 0.1} />
    <Sfx file="clap.wav" at={T.close} vol={0.45} />
    <Sfx file="pop.wav" at={T.ask} vol={0.3} />
    <Sfx file="tok.wav" at={T.ask + 0.15} vol={0.3} />
    <Sfx file="clap.wav" at={T.ask + 0.5} vol={0.36} />
  </>
);

// 말 글자 자리(굽고 나서 맞춘다)
export const SAY = {
  go1: [430, 640] as [number, number],
  yay: [540, 720] as [number, number],
  go2: [540, 640] as [number, number],
};

// 장면 심사용(scene)에는 화면 글을 빼고 장면의 말 · 소리만 남긴다
export const Film: React.FC<{ scene?: boolean }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const k = SHOTS[shotAt(t)].img;
  const bright = k === 'dream';
  const ki = shotAt(t);
  const XF = 0.25; // 0.4초는 두 판의 몽글이 겹쳐 두 겹으로 보였다(v10)
  const xfa = SHOTS[ki].xf ? interpolate(t, [SHOTS[ki].at, SHOTS[ki].at + XF], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) }) : 1;
  return (
    <AbsoluteFill style={{ background: '#0B1626' }}>
      {xfa < 1 ? <Plate t={t} kk={ki - 1} /> : null}
      <AbsoluteFill style={{ opacity: xfa }}>
        <Plate t={t} />
      </AbsoluteFill>
      {/* 위쪽을 살짝 어둡게 — 글자가 놓일 자리(상자가 아니라 빛). 밝은 상상 장면에는 두지 않는다 */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: bright ? 900 : 780, background: bright ? 'linear-gradient(to bottom, rgba(8,16,40,0.86) 0%, rgba(8,16,40,0.74) 62%, rgba(8,16,40,0) 100%)' : 'linear-gradient(to bottom, rgba(5,10,28,0.84) 0%, rgba(5,10,28,0.68) 68%, rgba(5,10,28,0) 100%)' }} />
      <Say t={t} from={T.go1} until={T.w1} x={SAY.go1[0]} y={SAY.go1[1]} text="물개 보러 가자!" ko size={92} rot={-2} sub={TEXT.go} subSize={80} />
      <Say t={t} from={T.cloud + 0.25} until={T.clap} x={420} y={830} text={TEXT.notDog} size={68} rot={-3} />
      {!scene ? (
        <>
          <Word t={t} at={T.w1} until={T.dream} x={330} ko="물" read={READ.mul} mean={TEXT.water} />
          <Word t={t} at={T.w2} until={T.dream} x={750} ko="개" read={READ.gae} mean={TEXT.dog} />
          <Say t={t} from={T.plus} until={T.dream} x={540} y={385} text="+" size={130} rot={0} />
          <Word t={t} at={T.dream} until={T.real} x={540} top={275} ko="물개" read={READ.mulgae} mean="" size={130} />
          <Title t={t} at={T.dream + 0.3} until={T.yay} small={TEXT.lit} big={TEXT.litSeal} size={92} top={455} />
          <Title t={t} at={T.yay} until={T.real} small={TEXT.litSeal} big={TEXT.yay} size={84} top={455} />
          <Word t={t} at={T.sealT} until={T.clap} x={540} top={275} ko="물개" read={READ.mulgae} mean="" size={130} />
          <Title t={t} at={T.sealT + 0.15} until={T.clap} small={TEXT.real} big={TEXT.seal} size={92} top={455} />
          <Title t={t} at={T.recap} until={T.ask} small="물 + 개 = 물개" big={TEXT.seal} size={92} top={270} smallSize={84} />
          <Title t={t} at={T.ask} until={T.total + 1} small={TEXT.askSmall} big={TEXT.ask} size={120} top={250} read={READ.mulgogi} foot={TEXT.cta} />
        </>
      ) : null}
      <Sound />
    </AbsoluteFill>
  );
};
