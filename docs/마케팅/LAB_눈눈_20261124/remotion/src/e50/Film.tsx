// LAB 영어 E50 「눈 = eye · snow」 — 편 하나(판본 틀 없음, 영어 판). 장면 정본은 data.ts.
// 글 꼴: 상자 없는 크림 글자 + 그늘(M65 「추울 때」와 같은 LAB 겨울 묶음 꼴) — 큰 한글 · 기울인 읽는 법 · 분홍 영어 뜻. 이름표는 가는 선 하나로 그림 속 눈 · 눈송이를 가리킨다.
// 눈송이는 오려 낸 펠트 눈송이 한 장(img/flake.png)을 위에서 떨어뜨려 몽글 눈에 닿게 한다(장부 먼저 셋 ⑵ 「떨어져서 붙고 찡긋하는 순간을 움직임으로」).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { CELLS, FALL1, FALL2, FPS, HIT1, HIT2, MONGLE, SFX, TAG_EYE, TAG_SNOW, TOTAL, TXT, VO } from './data';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8;
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const CREAM = '#FFFDF7';
const PINK = '#FFC2D0';
const DIM = 'rgba(255,248,236,0.94)';
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
const SH = '0 3px 0 rgba(10,14,24,0.5), 0 5px 18px rgba(6,8,16,0.62)';
const Glow: React.FC<{ x: number; y: number; w: number; h: number; a?: number }> = ({ x, y, w, h, a = 0.5 }) => <div style={{ position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, background: `radial-gradient(ellipse at 50% 50%, rgba(8,10,20,${a}) 0%, rgba(8,10,20,${a * 0.55}) 45%, rgba(8,10,20,0) 72%)` }} />;
const bump = (t: number, at: number, up = 0.05, down = 0.35) => interpolate(t, [at - 0.02, at + up, at + down], [0, 1, 0], clamp);

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

// 그림 좌표 → 화면 좌표(판의 당김 z · 축 o)
const onScreen = (x: number, y: number, z: number, ox: number, oy: number) => ({ x: ox + (x - ox) * z, y: oy + (y - oy) * z });

const camera = (i: number, t: number) => {
  const c = CELLS[i];
  const end = i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL;
  const [a, b] = c.push ?? [1, 1.04];
  const fast = c.at === 10.0; // 쏟아짐 — 빠르게 확 다가감
  const z = interpolate(t, [c.at, end], [a, b], { ...clamp, easing: fast ? Easing.in(Easing.cubic) : Easing.inOut(Easing.quad) });
  const [ox, oy] = c.origin ?? [540, 1000];
  return { z, ox, oy };
};

const Plate: React.FC<{ i: number; t: number }> = ({ i, t }) => {
  const c = CELLS[i];
  const { z, ox, oy } = camera(i, t);
  const m = MONGLE[c.img];
  // 쏙 — 붙는 순간 판이 한 번 흔들린다
  const hit = bump(t, 10.4, 0.04, 0.35) + bump(t, 16.9, 0.04, 0.35);
  const dx = 10 * hit * Math.sin(t * 70);
  let msx = 1 + 0.012 * Math.sin(t * 5.5);
  let msy = 2 - msx + 0.014 * Math.sin(t * 2.6);
  let mrot = 2.5 * Math.sin(t * 2.2);
  for (const [at, f] of VO) {
    if (!f.startsWith('vo/m')) continue;
    const b = bump(t, at, 0.05, 0.3);
    msx += 0.03 * b;
    msy += 0.03 * b;
  }
  if (c.img === 'e_both.jpg') mrot = 6 * Math.sin((t - c.at) * 4.2); // 앞이 안 보여 비틀비틀
  const mask = m ? `radial-gradient(ellipse ${m.rx}px ${m.ry}px at ${m.cx}px ${m.cy}px, black 78%, transparent 100%)` : '';
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#0e1220' }}>
      <AbsoluteFill style={{ transform: `translateX(${dx}px) scale(${z})`, transformOrigin: `${ox}px ${oy}px` }}>
        <Img src={staticFile(`img/${c.img}`)} style={FULL} />
        {m ? <Img src={staticFile(`img/${c.img}`)} style={{ ...FULL, WebkitMaskImage: mask, maskImage: mask, transform: `rotate(${mrot}deg) scale(${msx}, ${msy})`, transformOrigin: `${m.cx}px ${m.cy + m.ry * 0.75}px` }} /> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 떨어지는 눈송이 — 위에서 흔들리며 내려와 닿는 자리에서 사라진다(닿는 칸은 다음 그림이 받는다)
const Flake: React.FC<{ t: number; from: number; to: number; hit: { x: number; y: number; size: number }; i: number }> = ({ t, from, to, hit, i }) => {
  if (t < from || t >= to) return null;
  const u = interpolate(t, [from, to], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const { z, ox, oy } = camera(i, t);
  const p = onScreen(hit.x, hit.y, z, ox, oy);
  const x = p.x + (1 - u) * 160 * Math.sin(u * 5) - (1 - u) * 60;
  const y = p.y - (1 - u) * 1100;
  const s = hit.size * z * (0.7 + 0.3 * u);
  return <Img src={staticFile('img/flake.png')} style={{ position: 'absolute', left: x - s / 2, top: y - s / 2, width: s, height: s, transform: `rotate(${200 * u}deg)`, filter: 'drop-shadow(0 6px 10px rgba(6,8,16,0.4))' }} />;
};

const Line: React.FC<{ t: number; from: number; until: number; x: number; y: number; w: number; ko: string; read?: string; mean?: string; koSize?: number; align?: 'center' | 'left' }> = ({ t, from, until, x, y, w, ko, read, mean, koSize = 120, align = 'center' }) => {
  if (t < from || t >= until) return null;
  const p = interpolate(t, [from, from + 0.13], [0.84, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const fade = interpolate(t, [until - 0.12, until], [1, 0], clamp);
  return (
    <>
      <Glow x={x + w / 2} y={y + koSize * 0.9} w={w + 300} h={koSize * 2 + 300} a={0.75 * fade} />
      <div style={{ position: 'absolute', left: x, top: y, width: w, textAlign: align, opacity: fade, transform: `scale(${p}) rotate(-2deg)`, transformOrigin: '50% 100%', textShadow: SH }}>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: koSize, color: CREAM, lineHeight: 1.08, whiteSpace: 'nowrap' }}>{ko}</div>
        {read ? <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 56, color: DIM, lineHeight: 1.15, fontStyle: 'italic', whiteSpace: 'nowrap' }}>{read}</div> : null}
        {mean ? <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 56, color: PINK, lineHeight: 1.15, marginTop: 6, whiteSpace: 'nowrap' }}>{mean}</div> : null}
      </div>
    </>
  );
};

// 이름표 — 가는 선 하나로 그림 속 자리를 가리킨다(점 · 고리 없음)
const Tag: React.FC<{ t: number; from: number; x: number; y: number; lx: number; ly: number; text: string; i: number }> = ({ t, from, x, y, lx, ly, text, i }) => {
  if (t < from || t >= 16.9) return null;
  const a = interpolate(t, [from, from + 0.2], [0, 1], clamp);
  const { z, ox, oy } = camera(i, t);
  const p = onScreen(x, y, z, ox, oy);
  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, opacity: a }}>
        <line x1={lx} y1={ly + 40} x2={p.x} y2={p.y} stroke={CREAM} strokeWidth={5} strokeLinecap="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(6,8,16,0.6))' }} />
      </svg>
      <div style={{ position: 'absolute', left: lx - 220, top: ly - 40, width: 440, textAlign: 'center', opacity: a, fontFamily: KO, fontWeight: 900, fontSize: 76, color: CREAM, textShadow: SH, whiteSpace: 'nowrap' }}>{text}</div>
    </>
  );
};

export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const i = cellAt(t);
  return (
    <AbsoluteFill style={{ background: '#0e1220' }}>
      <Plate i={i} t={t} />
      <Flake t={t} i={i} from={FALL1.from} to={FALL1.to} hit={HIT1} />
      <Flake t={t} i={i} from={FALL2.from} to={FALL2.to} hit={HIT2} />
      {/* 쏙 — 눈송이가 붙는 순간 하얗게 번쩍 */}
      {[10.4, 16.9].map((at) => (t >= at - 0.02 && t < at + 0.3 ? <AbsoluteFill key={at} style={{ background: '#F2FAFF', opacity: interpolate(t, [at - 0.02, at + 0.03, at + 0.3], [0, 0.35, 0], clamp) }} /> : null))}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 700, background: 'linear-gradient(to bottom, rgba(6,8,16,0.55) 0%, rgba(6,8,16,0.3) 58%, rgba(6,8,16,0) 100%)' }} />
      {/* 머리(0~3초) — 큰 「눈」 · 읽는 법 · 물음 */}
      {t < 3.0 ? (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 250, textAlign: 'center', textShadow: SH }}>
          <Glow x={540} y={200} w={900} h={520} a={0.55} />
          <div style={{ position: 'relative', fontFamily: KO, fontWeight: 900, fontSize: 230, color: CREAM, lineHeight: 1 }}>{TXT.hookKo}</div>
          <div style={{ position: 'relative', fontFamily: EN, fontWeight: 700, fontSize: 60, color: DIM, fontStyle: 'italic', lineHeight: 1.2 }}>{TXT.hookRead}</div>
          <div style={{ position: 'relative', fontFamily: EN, fontWeight: 800, fontSize: 64, color: PINK, lineHeight: 1.2, opacity: interpolate(t, [0.9, 1.1], [0, 1], clamp) }}>{TXT.hookQ}</div>
        </div>
      ) : null}
      <Line t={t} from={0.3} until={3.0} x={600} y={760} w={400} ko={TXT.m1} koSize={110} />
      <Line t={t} from={1.25} until={3.0} x={80} y={760} w={400} ko={TXT.f1} koSize={110} />
      <Line t={t} from={3.08} until={6.5} x={420} y={320} w={620} ko={TXT.f2} read={TXT.f2r} mean={TXT.f2m} koSize={112} />
      <Line t={t} from={6.58} until={10.0} x={100} y={320} w={880} ko={TXT.m2} read={TXT.m2r} mean={TXT.m2m} koSize={112} />
      <Line t={t} from={10.45} until={11.9} x={100} y={300} w={880} ko={TXT.m3} read={TXT.m3r} mean={TXT.m3m} koSize={140} />
      <Line t={t} from={11.95} until={14.0} x={100} y={300} w={880} ko={TXT.f3} read={TXT.f3r} mean={TXT.f3m} koSize={112} />
      {/* 14.0~16.9 — 그림 속 눈송이와 열린 눈을 가리키는 이름표 둘 · 위에 한 줄 */}
      {t >= 14.0 && t < 16.9 ? (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 300, textAlign: 'center', fontFamily: EN, fontWeight: 800, fontSize: 64, color: PINK, textShadow: SH, opacity: interpolate(t, [14.05, 14.25], [0, 1], clamp) }}>{TXT.sumNote}</div>
      ) : null}
      <Tag t={t} i={i} from={14.5} x={TAG_SNOW.x} y={TAG_SNOW.y} lx={300} ly={560} text={TXT.tagSnow} />
      <Tag t={t} i={i} from={15.3} x={TAG_EYE.x} y={TAG_EYE.y} lx={790} ly={560} text={TXT.tagEye} />
      <Line t={t} from={17.05} until={18.3} x={100} y={300} w={880} ko={TXT.m4} read={TXT.m4r} mean={TXT.m4m} koSize={120} />
      {t >= 18.3 ? (
        <div style={{ position: 'absolute', left: 60, right: 60, top: 330, textAlign: 'center', textShadow: SH, opacity: interpolate(t, [18.3, 18.45], [0, 1], clamp) }}>
          <Glow x={480} y={120} w={1100} h={420} a={0.6} />
          <div style={{ position: 'relative', fontFamily: KO, fontWeight: 900, fontSize: 130, color: CREAM, lineHeight: 1.1 }}>눈에 눈</div>
          <div style={{ position: 'relative', fontFamily: EN, fontWeight: 800, fontSize: 60, color: PINK, lineHeight: 1.2 }}>snow in your eye</div>
        </div>
      ) : null}
      <Audio src={staticFile('sfx/bgm.wav')} volume={(f) => MASTER * interpolate(f / FPS, [0, TOTAL - 0.6, TOTAL], [0.16, 0.16, 0], clamp)} />
      <Audio src={staticFile('sfx/air.wav')} volume={(f) => 0.22 * MASTER * interpolate(f / FPS, [0, TOTAL - 0.4, TOTAL], [1, 1, 0], clamp)} />
      {SFX.filter(([, , v]) => v > 0).map(([at, file, v], k) => (
        <Sequence key={k} from={fr(at)} layout="none">
          <Audio src={staticFile(`sfx/${file}`)} volume={v * MASTER} />
        </Sequence>
      ))}
      {VO.map(([at, f], k) => (
        <Sequence key={`v${k}`} from={fr(at)} layout="none">
          <Audio src={staticFile(`${f}.wav`)} volume={1.1 * MASTER} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
