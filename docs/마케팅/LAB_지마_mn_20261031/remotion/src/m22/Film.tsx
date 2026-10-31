// LAB 몽골 M22 「-지 마」 — 바리스타의 잔소리 셋(먹지 마 · 자지 마 · 보지 마)이 여행 가방을 감추던 마지막 날로 이어지고,
// 이번엔 몽글이 「가지 마…」. 「울지 마.」 하고 떠난 사람이 남긴 케이크 한 조각과 「먹어.」 — 첫 잔소리가 끝에서 뒤집힌다.
// 말은 한국어(바리스타 범수 · 몽글 자리 소진), 뜻은 말풍선 세 줄(한글 · 키릴 읽기 · 몽골어). 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { LINES, Line, TEXT } from './data';
import { fr, T } from './timeline';

const C = { coral: '#F96859', coralShade: '#AE322A', brown: '#2B1A14', cream: '#FFFDF8' };
const KO = "'SUIT', 'Inter Tight', sans-serif";
const MN = "'Inter Tight', 'SUIT', sans-serif";
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
const K = 1080 / 940;
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };

// 장면 — 시작 초 · 그림 · 다가갈 자리(그림 좌표) · 시작/끝 크기
const SHOTS = [
  { at: 0, img: 'img/cake.jpg', cam: [380, 1040], z0: 1.02, z1: 1.1 },
  { at: T.scold[1], img: 'img/sleep.jpg', cam: [420, 1040], z0: 1.04, z1: 1.1 },
  { at: T.scold[2], img: 'img/bag.jpg', cam: [640, 900], z0: 1.03, z1: 1.09 },
  { at: T.dusk, img: 'img/dusk.jpg', cam: [300, 760], z0: 1.0, z1: 1.14 },
  { at: T.pat, img: 'img/pat.jpg', cam: [420, 780], z0: 1.02, z1: 1.12 },
  { at: T.end, img: 'img/end.jpg', cam: [480, 1120], z0: 1.0, z1: 1.14 },
];
const shotAt = (t: number) => {
  let k = 0;
  for (let i = 1; i < SHOTS.length; i++) if (t >= SHOTS[i].at) k = i;
  return k;
};

// 창밖 눈(밤 장면 — 그림 좌표의 창 자리에만)
const Snow: React.FC<{ t: number }> = ({ t }) => {
  const [x0, y0, x1, y1] = [460, 330, 900, 1190];
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <clipPath id="win">
          <rect x={x0 * K} y={y0 * K} width={(x1 - x0) * K} height={(y1 - y0) * K} />
        </clipPath>
      </defs>
      <g clipPath="url(#win)">
        {Array.from({ length: 26 }, (_, j) => {
          const ph = (t * 0.1 + random(`p${j}`)) % 1;
          const x = (x0 + random(`x${j}`) * (x1 - x0)) * K + Math.sin((t + j) * 1.1) * 12;
          const y = (y0 - 40 + ph * (y1 - y0 + 80)) * K;
          return <circle key={j} cx={x} cy={y} r={3 + random(`r${j}`) * 4} fill="#FFFFFF" opacity={0.75} />;
        })}
      </g>
    </svg>
  );
};

const Plate: React.FC<{ t: number }> = ({ t }) => {
  const k = shotAt(t);
  const s = SHOTS[k];
  const next = k + 1 < SHOTS.length ? SHOTS[k + 1].at : T.total;
  const z = interpolate(t, [s.at, next], [s.z0, s.z1], clamp);
  let punch = 0;
  for (const b of [...T.scold, T.go, T.eat]) punch = Math.max(punch, interpolate(t, [b - 0.02, b + 0.08, b + 0.5], [0, 1, 0], { ...clamp, easing: EASE_IO }));
  const sx = 4 * Math.sin((2 * Math.PI * t) / 3.3);
  const sy = 4 * Math.sin((2 * Math.PI * t) / 4.1 + 1);
  const big = z * (1 + (k < 3 ? 0.05 : 0.02) * punch);
  return (
    <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) scale(${big})`, transformOrigin: `${s.cam[0] * K}px ${s.cam[1] * K}px` }}>
      <Img src={staticFile(s.img)} style={FULL} />
      {k === SHOTS.length - 1 ? (
        <>
          <Img src={staticFile('img/end2.jpg')} style={{ ...FULL, opacity: interpolate(t, [T.bite, T.bite + 0.3], [0, 1], clamp) }} />
          <Snow t={t} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

// 말풍선(한글 · 키릴 읽기 · 몽골어)
const TOP = 290;
const H = 286;
const Bubble: React.FC<{ line: Line; t: number; from: number; until: number }> = ({ line, t, from, until }) => {
  if (t < from || t >= until) return null;
  const a = interpolate(t, [from, from + 0.18], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
  const mid = line.left + line.width / 2;
  const [tx, ty] = line.tip;
  const bx = Math.min(line.left + line.width - 130, Math.max(line.left + 60, tx - 40));
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${a})`, transformOrigin: `${mid}px ${TOP + H}px` }}>
      {tx > 0 ? (
        <svg width={1080} height={1000} style={{ position: 'absolute', left: 0, top: 0 }}>
          <path d={`M ${bx} ${TOP + H - 8} L ${tx} ${ty} L ${bx + 90} ${TOP + H - 8} Z`} fill={C.cream} />
        </svg>
      ) : null}
      <div style={{ position: 'absolute', left: line.left, top: TOP, width: line.width, height: H, borderRadius: 54, background: C.cream, boxShadow: '0 10px 28px rgba(60,20,10,0.28)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 112, lineHeight: 1.05, color: C.brown, whiteSpace: 'nowrap' }}>
          {line.ko.includes('지 마') ? (
            <>
              {line.ko.split('지 마')[0]}
              <span style={{ color: C.coralShade }}>지 마</span>
              {line.ko.split('지 마')[1]}
            </>
          ) : (
            line.ko
          )}
        </div>
        <div style={{ fontFamily: MN, fontWeight: 700, fontSize: 46, lineHeight: 1.2, color: C.coralShade, whiteSpace: 'nowrap' }}>🔊 {line.read}</div>
        <div style={{ fontFamily: MN, fontWeight: 800, fontSize: 54, lineHeight: 1.2, color: C.brown, whiteSpace: 'nowrap' }}>{line.mn}</div>
      </div>
    </div>
  );
};

const Hook: React.FC<{ t: number }> = ({ t }) => {
  if (t >= T.scold[0]) return null;
  const a = interpolate(t, [0, 0.14], [0.7, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ position: 'absolute', left: 60, top: TOP, width: 860, padding: '34px 36px 38px', borderRadius: 44, background: 'rgba(43,26,20,0.92)', boxShadow: '0 10px 28px rgba(60,20,10,0.28)', transform: `scale(${a})`, fontFamily: MN, fontWeight: 800, fontSize: 66, lineHeight: 1.18, color: C.cream, textAlign: 'center' }}>{TEXT.hook}</div>
  );
};

const Band: React.FC<{ t: number; from: number; until: number; dark?: boolean; top?: number; children: React.ReactNode }> = ({ t, from, until, dark, top = 1160, children }) => {
  if (t < from || t >= until) return null;
  const a = interpolate(t, [from, from + 0.2], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ position: 'absolute', left: 60, width: 860, top, minHeight: 200, borderRadius: 44, background: dark ? 'rgba(24,16,30,0.9)' : C.cream, boxShadow: '0 10px 28px rgba(40,10,0,0.3)', opacity: a, transform: `translateY(${(1 - a) * 20}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 24px' }}>
      {children}
    </div>
  );
};

const Sign: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.rule || t >= T.dusk) return null;
  const s = t - T.rule;
  const drop = interpolate(s, [0, 0.28], [-520, 0], { ...clamp, easing: Easing.out(Easing.back(1.4)) });
  const swing = 6 * Math.exp(-2.6 * s) * Math.cos(9 * s);
  return (
    <div style={{ position: 'absolute', left: 90, top: 300, width: 800, height: 230, transform: `translateY(${drop}px) rotate(${swing}deg)`, transformOrigin: '50% -300px' }}>
      <div style={{ position: 'absolute', left: 150, top: -320, width: 6, height: 330, background: '#3B2A1E' }} />
      <div style={{ position: 'absolute', right: 150, top: -320, width: 6, height: 330, background: '#3B2A1E' }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: 26, background: '#5B3B28', border: '8px solid #3B2A1E', boxShadow: '0 14px 26px rgba(50,25,10,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: KO, fontWeight: 800, fontSize: 100, color: C.cream, whiteSpace: 'nowrap' }}>
        -지 마 = <span style={{ fontFamily: MN, marginLeft: 22 }}>{TEXT.rule}</span>
      </div>
    </div>
  );
};

const Vo: React.FC<{ id: string; at: number; vol?: number }> = ({ id, at: t, vol = 1 }) => (
  <Sequence from={fr(t)} layout="none">
    <Audio src={staticFile(`vo/${id}.wav`)} volume={vol * MASTER} />
  </Sequence>
);
const Sfx: React.FC<{ file: string; at: number; vol: number; dur?: number }> = ({ file, at: t, vol, dur }) => (
  <Sequence from={Math.max(0, fr(t))} durationInFrames={dur ? Math.max(2, fr(dur)) : undefined} layout="none">
    <Audio src={staticFile(`sfx/${file}`)} volume={(i) => vol * MASTER * (dur ? interpolate(i, [0, 2, Math.max(3, fr(dur) - 14), Math.max(4, fr(dur))], [0, 1, 1, 0], clamp) : 1)} />
  </Sequence>
);
const AT = [T.scold[0], T.scold[1], T.scold[2], T.go, T.pat + 0.3, T.eat];
const Sound: React.FC = () => (
  <>
    <Sfx file="bgm_day.wav" at={0} vol={0.2} dur={T.dusk} />
    <Sfx file="bgm_dusk.wav" at={T.dusk} vol={0.3} dur={T.total - T.dusk} />
    {LINES.map((l, i) => (
      <React.Fragment key={i}>
        <Sfx file="pop.wav" at={AT[i]} vol={0.16} />
        <Vo id={l.vo} at={AT[i] + 0.06} vol={i === 3 ? 1.15 : 1} />
      </React.Fragment>
    ))}
    <Sfx file="tok.wav" at={T.rule} vol={0.26} />
    <Sfx file="sniff.wav" at={T.go + 1.5} vol={0.2} />
    <Sfx file="bell.wav" at={T.end - 0.5} vol={0.22} />
    <Sfx file="tok.wav" at={T.bite + 0.05} vol={0.16} />
    <Sfx file="tok.wav" at={T.bite + 0.38} vol={0.12} />
    <Sfx file="sniff.wav" at={T.bite + 1.2} vol={0.2} />
  </>
);

export const Film: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1014' }}>
      <Plate t={t} />
      <Hook t={t} />
      <Bubble line={LINES[0]} t={t} from={T.scold[0]} until={T.scold[1]} />
      <Bubble line={LINES[1]} t={t} from={T.scold[1]} until={T.scold[2]} />
      <Bubble line={LINES[2]} t={t} from={T.scold[2]} until={T.rule} />
      <Bubble line={LINES[3]} t={t} from={T.go} until={T.pat} />
      <Bubble line={LINES[4]} t={t} from={T.pat + 0.3} until={T.end} />
      <Bubble line={LINES[5]} t={t} from={T.eat} until={T.bite} />
      <Sign t={t} />
      <Band t={t} from={T.dusk + 0.15} until={T.go} dark>
        <div style={{ fontFamily: MN, fontWeight: 800, fontSize: 64, lineHeight: 1.2, color: C.cream, textAlign: 'center' }}>{TEXT.last}</div>
      </Band>
      <Sound />
    </AbsoluteFill>
  );
};
