// LAB 영어 E31 「괜찮아요」 — 은행잎 공원 벤치. 친구가 마지막 붕어빵을 내밀며 「한 입 먹을래?」, 몽글은 okay = yes인 줄 알고 신나서 「괜찮아요!」.
// 친구는 「아, 괜찮아? 알았어!」 하고 제 입에 — 친구 쪽으로 늘어난 몽글이 그대로 굳는다(핵심 장면). 바람 빠진 몽글 위에 풀이:
// 누가 권하면 괜찮아요 = No, thanks · 받고 싶으면 네, 좋아요! → 새 붕어빵에 묻자마자 「네, 좋아요!」 → 몽글이 품에 안고,
// 「나도 한 입만…」 하는 친구 손이 허공에서 굳는다(핵심 장면을 뒤집어 끝에 한 번 더).
// 장면은 GPT 이미지(구독 경로)로 구운 판(판/*.png, 지시문 판/*.txt), 글자 「괜찮아요!」 · 「네, 좋아요!」는 구운 펠트를 오린 것. 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { FONT, Lang, ROMAN, TEXT } from './data';
import { fr, T } from './timeline';

const C = { coral: '#C2452F', brown: '#3A2416', cream: '#FFF8EA', kraft: '#D3A874', kraftDark: '#B98B57', mustard: '#D99A1E' };
const KO = "'SUIT', 'Inter Tight', sans-serif";
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
const fadeIn = (t: number, at: number, d = 0.16) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: EASE_OUT });
const pop = (t: number, at: number, d = 0.22) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });

// 장면 — 시작 초 · 그림 · 다가갈 자리 · 시작/끝 크기. 15.31 · 18.66은 같은 그림을 확 당겨 구성을 바꾼다(풀이가 한 구성 4초를 넘지 않게)
type Shot = { at: number; img: string; cam: [number, number]; z0: number; z1: number };
const SHOTS: Shot[] = [
  { at: 0, img: 'offer', cam: [470, 1150], z0: 1.0, z1: 1.13 },
  { at: T.close, img: 'sparkle', cam: [430, 900], z0: 1.0, z1: 1.07 },
  { at: T.yes, img: 'bounce', cam: [400, 1150], z0: 1.14, z1: 1.04 },
  { at: T.back, img: 'back', cam: [560, 1100], z0: 1.0, z1: 1.12 },
  { at: T.bite, img: 'bite', cam: [420, 1100], z0: 1.04, z1: 1.12 },
  { at: T.frozen, img: 'bite', cam: [540, 960], z0: 1.42, z1: 1.52 },
  { at: T.empty, img: 'empty', cam: [380, 1160], z0: 1.0, z1: 1.05 },
  { at: T.rule, img: 'empty', cam: [380, 1240], z0: 1.24, z1: 1.3 },
  { at: T.want, img: 'practice', cam: [520, 1100], z0: 1.0, z1: 1.04 },
  { at: T.ne, img: 'practice', cam: [345, 1250], z0: 1.32, z1: 1.38 },
  { at: T.again, img: 'again', cam: [480, 1120], z0: 1.04, z1: 1.08 },
  { at: T.eager, img: 'eager', cam: [380, 1150], z0: 1.16, z1: 1.06 },
  { at: T.got, img: 'got', cam: [400, 1160], z0: 1.0, z1: 1.08 },
  { at: T.mirror, img: 'mirror', cam: [470, 1140], z0: 1.12, z1: 1.18 },
];
const shotAt = (t: number) => {
  let k = 0;
  for (let i = 1; i < SHOTS.length; i++) if (t >= SHOTS[i].at) k = i;
  return k;
};
const PUNCH = [T.yes, T.bite, T.frozen, T.rule, T.ne, T.eager, T.mirror];

// 같은 그림의 한 자리(몽글 · 친구)만 따로 움직인다 — 숨 · 튐 · 떨림 · 납작 · 핏기 빠짐
const Patch: React.FC<{ img: string; cx: number; cy: number; rx: number; ry: number; sx?: number; sy?: number; dx?: number; dy?: number; oy?: number; filter?: string }> = ({ img, cx, cy, rx, ry, sx = 1, sy = 1, dx = 0, dy = 0, oy, filter }) => {
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, black 76%, transparent 100%)`;
  return <Img src={staticFile(`img/${img}.jpg`)} style={{ ...FULL, WebkitMaskImage: mask, maskImage: mask, transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, transformOrigin: `${cx}px ${oy ?? cy + ry * 0.85}px`, filter }} />;
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
  // 신남 — 튀어 올랐다 내려앉기를 두 번
  const hop = s.img === 'bounce' ? -70 * Math.abs(Math.sin(Math.PI * Math.min(2, (t - T.yes) / 0.42))) * Math.max(0, 1 - (t - T.yes) / 1.4) : 0;
  // 굳음 — 소리와 함께 잘게 떨고 핏기가 빠진다
  const fr0 = interpolate(t, [T.freeze, T.freeze + 0.25], [0, 1], clamp);
  const shiver = s.img === 'bite' && t >= T.freeze ? 6 * Math.max(0, 1 - (t - T.freeze) / 0.7) * Math.sin(t * 90) : 0;
  // 거둘 때 — 몽글이 붕어빵을 따라 친구 쪽으로 슬금슬금 기운다
  const lean = s.img === 'back' ? interpolate(t, [T.back + 0.1, T.bite], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) }) : 0;
  // 첫 2초 — 몽글이 붕어빵 쪽으로 슬쩍 다가간다
  const reach = s.img === 'offer' ? interpolate(t, [0.3, 2.2], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) }) : 0;
  // 바람 빠짐 — 빈 봉지 앞에서 더 납작해진다
  const flat = s.img === 'empty' ? interpolate(t, [T.empty + 0.05, T.empty + 0.7], [1, 0.86], { ...clamp, easing: EASE_OUT }) : 1;
  // 부풂 — 묻자마자 몸이 부푼다
  const puff = s.img === 'eager' ? interpolate(t, [T.eager, T.eager + 0.35], [0.9, 1.04], { ...clamp, easing: Easing.out(Easing.back(2)) }) : 1;
  const eagerShake = s.img === 'eager' ? 4 * Math.sin(t * 70) * Math.max(0, 1 - (t - T.eager) / 1.2) : 0;
  // 끝 — 친구가 굳는다
  const fr1 = interpolate(t, [T.mirror + 0.1, T.mirror + 0.35], [0, 1], clamp);
  const shiver2 = s.img === 'mirror' && t >= T.mirror + 0.1 ? 5 * Math.max(0, 1 - (t - T.mirror - 0.1) / 0.7) * Math.sin(t * 90) : 0;
  return (
    <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) scale(${z * (1 + 0.035 * punch)})`, transformOrigin: `${s.cam[0]}px ${s.cam[1]}px` }}>
      <Img src={staticFile(`img/${s.img}.jpg`)} style={FULL} />
      {s.img === 'offer' ? <Patch img="offer" cx={270} cy={1170} rx={270} ry={260} sy={breath} sx={(2 - breath) * (1 + 0.05 * reach)} dx={22 * reach} oy={1400} /> : null}
      {s.img === 'offer' ? <Patch img="offer" cx={480} cy={1070} rx={110} ry={80} dy={6 * Math.sin(t * 4.2)} /> : null}
      {s.img === 'sparkle' ? <Patch img="sparkle" cx={440} cy={930} rx={430} ry={470} sy={breath * 1.01} sx={2 - breath} /> : null}
      {s.img === 'bounce' ? <Patch img="bounce" cx={270} cy={1150} rx={270} ry={280} dy={hop} sy={1 + (hop < -5 ? 0.05 : 0)} /> : null}
      {s.img === 'back' ? <Patch img="back" cx={262} cy={1150} rx={265} ry={270} sy={breath} sx={(2 - breath) * (1 + 0.1 * lean)} dx={38 * lean} oy={1400} /> : null}
      {s.img === 'bite' ? <Patch img="bite" cx={300} cy={1150} rx={310} ry={285} dx={shiver} filter={`saturate(${1 - 0.25 * fr0}) brightness(${1 + 0.06 * fr0})`} /> : null}
      {s.img === 'bite' ? <Patch img="bite" cx={700} cy={890} rx={130} ry={120} sy={1 + 0.02 * Math.sin(t * 16)} /> : null}
      {s.img === 'bite' && fr0 > 0 ? <div style={{ position: 'absolute', inset: 0, opacity: 0.55 * fr0, background: 'radial-gradient(ellipse 300px 280px at 300px 1130px, rgba(205,232,255,0.85) 0%, rgba(205,232,255,0.35) 60%, transparent 100%)', mixBlendMode: 'screen' }} /> : null}
      {s.img === 'empty' ? <Patch img="empty" cx={375} cy={1080} rx={410} ry={270} sy={flat} sx={2 - flat} oy={1320} filter="saturate(0.75)" /> : null}
      {s.img === 'practice' ? <Patch img="practice" cx={345} cy={1100} rx={290} ry={310} sy={1 + 0.025 * Math.sin(t * 5.2)} sx={1 - 0.012 * Math.sin(t * 5.2)} /> : null}
      {s.img === 'eager' ? <Patch img="eager" cx={265} cy={1140} rx={275} ry={290} sx={puff} sy={puff} dx={eagerShake} /> : null}
      {s.img === 'got' ? <Patch img="got" cx={270} cy={1170} rx={270} ry={275} dy={-6 * Math.abs(Math.sin(t * 5))} /> : null}
      {s.img === 'mirror' && fr1 > 0 ? <div style={{ position: 'absolute', inset: 0, opacity: 0.5 * fr1, background: 'radial-gradient(ellipse 270px 340px at 760px 1050px, rgba(205,232,255,0.8) 0%, rgba(205,232,255,0.3) 60%, transparent 100%)', mixBlendMode: 'screen' }} /> : null}
      {s.img === 'mirror' ? <Patch img="mirror" cx={760} cy={1050} rx={270} ry={340} dx={shiver2} filter={`saturate(${1 - 0.25 * fr1}) brightness(${1 + 0.05 * fr1})`} /> : null}
    </AbsoluteFill>
  );
};

// 반짝 — 눈에 맺히는 빛 두 점(4.52~6.63)
const Glints: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.close + 0.1 || t >= T.yes) return null;
  const pts = [[288, 790], [572, 790]];
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      {pts.map(([x, y], i) => {
        const a = 0.55 + 0.45 * Math.sin(t * 9 + i * 1.7);
        return <circle key={i} cx={x} cy={y} r={10 + 4 * a} fill="#FFFFFF" opacity={0.85 * a} />;
      })}
    </svg>
  );
};

// 머리 글 — 종이봉지 크래프트 띠(위 글자 자리)
const Kraft: React.FC<{ t: number; at: number; until: number; lang: Lang; top?: number; size?: number; children: React.ReactNode }> = ({ t, at, until, lang, top = 275, size, children }) => {
  if (t < at || t >= until) return null;
  const a = fadeIn(t, at, 0.18);
  const edge = Array.from({ length: 33 }, (_, i) => `${(i * 100) / 32}% calc(100% - ${Math.round(6 + 8 * random(`k${i}`))}px)`).reverse().join(', ');
  return (
    <div style={{ position: 'absolute', left: 90, width: 900, top, transform: `translateY(${(1 - a) * 16}px) rotate(-1deg)`, opacity: a, filter: 'drop-shadow(0 12px 18px rgba(50,22,6,0.42))' }}>
      <div style={{ background: `linear-gradient(180deg, ${C.kraft}, ${C.kraftDark})`, clipPath: `polygon(0 0, 100% 0, ${edge})`, padding: '26px 34px 40px', boxSizing: 'border-box', fontFamily: FONT[lang], fontWeight: 800, fontSize: size ?? TEXT[lang].size, lineHeight: 1.18, color: C.brown, textAlign: 'center', whiteSpace: 'pre-line' }}>{children}</div>
    </div>
  );
};

// 말풍선(한글 + 그 나라 말 한 줄)
const Bubble: React.FC<{ t: number; from: number; until: number; x: number; y: number; tail: number; size?: number; sub?: string; subFont?: string; children: React.ReactNode; w?: number }> = ({ t, from, until, x, y, tail, size = 72, sub, subFont, children, w: forceW }) => {
  if (t < from || t >= until) return null;
  const a = pop(t, from);
  const w = forceW ?? 560;
  const h = sub ? size * 2.2 : size * 1.7;
  const left = Math.min(Math.max(50, x - w / 2), 1030 - w);
  const tip = x + tail * 140 - left;
  return (
    <div style={{ position: 'absolute', left, top: y - h / 2, width: w, height: h, transform: `scale(${a})`, transformOrigin: `${(tip / w) * 100}% 100%` }}>
      <svg width={w} height={h + 52} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <path d={`M ${tip - 60} ${h - 4} L ${tip} ${h + 50} L ${tip - 8} ${h - 4} Z`} fill={C.cream} stroke={C.coral} strokeWidth={6} strokeLinejoin="round" />
        <rect x={3} y={3} width={w - 6} height={h - 6} rx={Math.min(60, h / 2)} fill={C.cream} stroke={C.coral} strokeWidth={6} />
        <rect x={tip - 58} y={h - 12} width={48} height={12} fill={C.cream} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1.08, color: C.coral, whiteSpace: 'pre' }}>{children}</div>
        {sub ? <div style={{ fontFamily: subFont, fontWeight: 700, fontSize: size * 0.6, lineHeight: 1.14, color: C.brown }}>{sub}</div> : null}
      </div>
    </div>
  );
};

// 생각 풍선 — 몽글 머리 위 구름(작은 동그라미 셋이 이어진다)
const Thought: React.FC<{ t: number; lang: Lang }> = ({ t, lang }) => {
  if (t < T.think || t >= T.yes) return null;
  const a = pop(t, T.think, 0.26);
  const dots = [[470, 640, 18], [440, 585, 26]];
  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        {dots.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r * a} fill={C.cream} stroke={C.coral} strokeWidth={5} />)}
      </svg>
      <div style={{ position: 'absolute', left: 90, top: 275, width: 900, transform: `scale(${a})`, transformOrigin: '50% 100%', background: C.cream, border: `6px solid ${C.coral}`, borderRadius: 120, padding: '26px 30px 30px', boxSizing: 'border-box', textAlign: 'center', boxShadow: '0 12px 22px rgba(60,20,6,0.3)' }}>
        <div style={{ fontFamily: FONT[lang], fontWeight: 800, fontSize: TEXT[lang].size * 1.15, lineHeight: 1.14, color: C.brown, whiteSpace: 'pre-line' }}>{TEXT[lang].think}</div>
      </div>
    </>
  );
};

// 펠트 글자 — 몽글 몸에서 튀어나와 자리를 잡는다(gw = 괜찮아요! · ne = 네, 좋아요!)
const AS = { gw: 1607 / 304, ne: 1658 / 299 };
const Felt: React.FC<{ t: number; id: 'gw' | 'ne'; at: number; until: number; from: [number, number]; to: [number, number]; h: number; r?: number; sub?: string; subFont?: string }> = ({ t, id, at, until, from, to, h, r = -3, sub, subFont }) => {
  if (t < at || t >= until) return null;
  const p = interpolate(t, [at, at + 0.34], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.7)) });
  const hh = h * (0.25 + 0.75 * p);
  const w = hh * AS[id];
  const x = from[0] + (to[0] - from[0]) * p;
  const y = from[1] + (to[1] - from[1]) * p;
  const bob = 5 * Math.sin(t * 2.4 + (id === 'gw' ? 0 : 1.3));
  const out = interpolate(t, [until - 0.12, until], [1, 0], clamp);
  const pw = w + 80;
  const ph = hh + 56 + (sub ? hh * 0.6 : 0);
  return (
    <div style={{ position: 'absolute', left: x - pw / 2, top: y - (hh + 56) / 2 + bob, width: pw, height: ph, opacity: out, transform: `rotate(${r + 1.2 * Math.sin(t * 1.9)}deg)`, background: '#4A2D1E', borderRadius: 44, boxShadow: '0 14px 26px rgba(30,10,2,0.5)' }}>
      <div style={{ position: 'absolute', inset: 10, borderRadius: 36, border: '4px dashed rgba(255,236,210,0.5)' }} />
      <Img src={staticFile(`img/${id}.png`)} style={{ position: 'absolute', left: 40, top: 28, width: w, height: hh, filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.45))' }} />
      {sub ? <div style={{ position: 'absolute', left: 0, right: 0, top: hh + 30, textAlign: 'center', fontFamily: subFont, fontWeight: 800, fontSize: hh * 0.44, lineHeight: 1.1, color: '#FFD66B' }}>{sub}</div> : null}
    </div>
  );
};

// 뜻 표 — 펠트 글자 아래 「= No, thanks.」 · 「= Yes, please!」 + 로마자
const Tag: React.FC<{ t: number; at: number; until: number; y: number; lang: Lang; big: string; small: string; color: string }> = ({ t, at, until, y, lang, big, small, color }) => {
  if (t < at || t >= until) return null;
  const a = pop(t, at);
  return (
    <div style={{ position: 'absolute', left: 90, width: 900, top: y, textAlign: 'center' }}>
      <span style={{ display: 'inline-block', transform: `scale(${a}) rotate(-1deg)`, background: C.cream, borderRadius: 28, padding: '10px 36px 16px', boxShadow: '0 10px 22px rgba(50,18,6,0.42)' }}>
        <div style={{ fontFamily: FONT[lang], fontWeight: 800, fontSize: TEXT[lang].size * 1.06, lineHeight: 1.12, color }}>{big}</div>
        <div style={{ fontFamily: FONT.en, fontWeight: 700, fontSize: 44, lineHeight: 1.1, color: C.brown }}>{small}</div>
      </span>
    </div>
  );
};

// 끝 — 붕어빵 종이봉지 크래프트 띠 한 장에 두 줄(장면 위, 친구 손을 가리지 않는 자리). 낱말 카드 · 쪽지 꼴로 끝내지 않는다
const EndCard: React.FC<{ t: number; lang: Lang }> = ({ t, lang }) => {
  if (t < T.mirror + 0.3) return null;
  const L = TEXT[lang];
  const line = (at: number, ko: string, en: string, color: string) => (
    <div style={{ opacity: fadeIn(t, at, 0.2), transform: `translateY(${(1 - fadeIn(t, at, 0.2)) * 10}px)`, whiteSpace: 'nowrap', marginTop: 6 }}>
      <span style={{ fontFamily: KO, fontWeight: 900, fontSize: 78, lineHeight: 1.1, color }}>{ko}</span>
      <span style={{ fontFamily: FONT[lang], fontWeight: 700, fontSize: lang === 'mm' ? 40 : 50, lineHeight: 1.1, color: C.brown, marginLeft: 18, opacity: 0.88 }}>· {en}</span>
    </div>
  );
  return (
    <Kraft t={t} at={T.mirror + 0.3} until={T.total + 1} lang={lang} top={275} size={L.size * 0.78}>
      {L.endHead}
      {line(T.mirror + 0.5, '괜찮아요', L.endNo, C.brown)}
      {line(T.mirror + 0.85, '네, 좋아요!', L.endYes, C.brown)}
    </Kraft>
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
// 음악은 굳는 순간 확 줄었다가(0.5초 정적에 가깝게) 풀이에서 돌아온다
const bgmVol = (f: number) => {
  const t = f / 30;
  // 11-08 음악층 ⑲: 주석은 0.5초인데 0.12를 2.45초(빈 봉지 뒤 0.6초까지) 쥐어 음악이 비었다 — 0.5초만 쥐고 빈 봉지에서 절반, 풀이에서 다 돌아온다(바탕 공원 소리는 그대로)
  const k = interpolate(t, [0, T.freeze - 0.05, T.freeze + 0.05, T.freeze + 0.55, T.freeze + 0.95, T.rule, T.mirror, T.mirror + 0.1, T.mirror + 0.9, T.total - 0.5, T.total], [1, 1, 0.12, 0.12, 0.5, 0.85, 0.85, 0.2, 0.9, 0.9, 0], clamp);
  return 0.14 * MASTER * k;
};
const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('sfx/bgm.wav')} volume={bgmVol} />
    <Audio src={staticFile('sfx/park.wav')} volume={(f) => 0.16 * MASTER * interpolate(f / 30, [0, T.total - 0.4, T.total], [1, 1, 0], clamp)} />
    <Sfx file="bag.wav" at={0.25} vol={0.3} />
    <Vo id="f1" at={T.offer + 0.05} />
    <Sfx file="pop.wav" at={T.offer} vol={0.18} />
    <Sfx file="sparkle.wav" at={T.close + 0.05} vol={0.35} />
    <Sfx file="pop.wav" at={T.think} vol={0.22} />
    <Sfx file="boing.wav" at={T.yes} vol={0.45} />
    <Vo id="m1" at={T.yes + 0.05} vol={1.1} />
    <Vo id="f2" at={T.reply + 0.04} />
    <Sfx file="munch.wav" at={T.bite + 0.02} vol={0.75} />
    <Vo id="m2" at={T.huh} vol={1.05} />
    <Sfx file="freeze.wav" at={T.freeze} vol={0.55} />
    <Sfx file="deflate.wav" at={T.empty + 0.04} vol={0.5} />
    <Sfx file="pop.wav" at={T.rule} vol={0.22} />
    <Vo id="s1" at={T.rule + 0.1} />
    <Sfx file="pop.wav" at={T.ruleTag} vol={0.18} />
    <Sfx file="whoosh.wav" at={T.want - 0.12} vol={0.25} />
    <Sfx file="pop.wav" at={T.ne} vol={0.22} />
    <Vo id="s2" at={T.ne + 0.1} />
    <Sfx file="pop.wav" at={T.neTag} vol={0.18} />
    <Sfx file="bag.wav" at={T.ask2 - 0.3} vol={0.3} />
    <Vo id="m4" at={T.practice} vol={1.15} />
    <Vo id="f1" at={T.ask2} />
    <Sfx file="boing.wav" at={T.eager} vol={0.4} />
    <Vo id="m3" at={T.eager + 0.2} vol={1.1} />
    <Sfx file="bag.wav" at={T.got - 0.1} vol={0.3} />
    <Sfx file="sparkle.wav" at={T.got + 0.05} vol={0.32} />
    <Vo id="f4" at={T.ask + 0.05} />
    <Sfx file="freeze.wav" at={T.mirror + 0.1} vol={0.5} />
    <Sfx file="tock.wav" at={T.mirror + 0.1} vol={0.35} />
    <Sfx file="pop.wav" at={T.mirror + 0.4} vol={0.18} />
    <Sfx file="pop.wav" at={T.mirror + 0.75} vol={0.18} />
  </>
);

// 장면 심사용(scene)에는 머리 글 · 풀이를 빼고 장면의 말 · 소리만 남긴다
export const Film: React.FC<{ lang: Lang; scene?: boolean }> = ({ lang, scene }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const L = TEXT[lang];
  return (
    <AbsoluteFill style={{ background: '#2B1A14' }}>
      <Plate t={t} />
      <Glints t={t} />
      {t >= T.mirror && t < T.mirror + 0.4 ? <AbsoluteFill style={{ background: 'rgba(225,242,255,1)', opacity: interpolate(t, [T.mirror, T.mirror + 0.05, T.mirror + 0.4], [0, 0.85, 0], clamp) }} /> : null}
      {/* 말풍선 — 친구는 오른쪽 위에서 */}
      <Bubble t={t} from={T.offer} until={T.close} x={640} y={600} tail={0.7} size={74} sub={L.bite} subFont={FONT[lang]} w={560}>한 입 먹을래?</Bubble>
      <Bubble t={t} from={T.reply} until={T.bite + 0.1} x={600} y={600} tail={0.85} size={70} sub={L.back} subFont={FONT[lang]} w={lang === 'mm' ? 760 : 640}>아, 괜찮아? 알았어!</Bubble>
      <Bubble t={t} from={T.huh} until={T.frozen} x={330} y={640} tail={-0.6} size={70} sub={L.huh} subFont={FONT[lang]} w={480}>어? 어어?</Bubble>
      <Bubble t={t} from={T.ask2} until={T.eager} x={660} y={640} tail={0.6} size={74} sub={L.bite} subFont={FONT[lang]} w={560}>한 입 먹을래?</Bubble>
      <Bubble t={t} from={T.ask} until={T.mirror + 0.3} x={640} y={620} tail={0.75} size={66} sub={L.ask} subFont={FONT[lang]} w={lang === 'mm' ? 700 : 600}>나도 한 입만…</Bubble>
      <Thought t={t} lang={lang} />
      {/* 몽글의 말 — 구운 펠트 글자 */}
      <Felt t={t} id="gw" at={T.yes + 0.04} until={T.reply} from={[300, 1050]} to={[540, 560]} h={130} r={-3} />
      <Felt t={t} id="ne" at={T.eager + 0.03} until={T.got} from={[300, 1050]} to={[540, 560]} h={118} r={-2} />
      {!scene ? (
        <>
          <Kraft t={t} at={-1} until={T.close} lang={lang}>{L.hook}</Kraft>
          <Kraft t={t} at={T.freeze + 0.3} until={T.empty} lang={lang}>{L.heard}</Kraft>
          <Kraft t={t} at={T.empty + 0.1} until={T.rule} lang={lang}>{L.ate}</Kraft>
          {/* 풀이 1 — 누가 권하면 괜찮아요 = No, thanks */}
          <Kraft t={t} at={T.rule} until={T.want} lang={lang} size={L.size * 0.85}>{L.offers}</Kraft>
          <Felt t={t} id="gw" at={T.rule + 0.02} until={T.want} from={[540, 1000]} to={[540, 565]} h={112} r={-2} />
          <Tag t={t} at={T.ruleTag} until={T.want} y={690} lang={lang} big={`= ${L.no}`} small={ROMAN.gw} color={C.coral} />
          {/* 풀이 2 — 받고 싶으면 네, 좋아요! */}
          <Kraft t={t} at={T.want} until={T.ask2} lang={lang}>{L.want}</Kraft>
          <Felt t={t} id="ne" at={T.ne + 0.02} until={T.ask2} from={[540, 1000]} to={[540, 515]} h={112} r={-2} />
          <Tag t={t} at={T.neTag} until={T.ask2} y={640} lang={lang} big={`= ${L.yes}`} small={ROMAN.ne} color={C.mustard} />
          <EndCard t={t} lang={lang} />
        </>
      ) : null}
      <Sound />
    </AbsoluteFill>
  );
};
