// LAB 영어 E21 「-지 마 = don't」 — 바리스타의 잔소리 셋(먹지 마 · 입지 마 · 열지 마 — 몽글이 입은 것은 그의 앞치마, 열려던 것은 그의 여행 가방)이
// 마지막 날로 이어지고, 이번엔 몽글이 「가지 마…」. 「울지 마.」 하고 떠난 사람이 남긴 케이크 한 조각 — 첫 잔소리 「먹지 마!」에서 「지 마」가 떨어져 「먹어.」.
// 몽골판 M22와 같은 이야기 · 그림 · 목소리(바리스타 범수 · 몽글 자리 소진)에, 뜻은 말풍선 세 줄(한글 · 로마자 읽기 · 영어). 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Line, LINES, Loc, LOCS } from './data';
import { fr, T } from './timeline';

const C = { coral: '#F96859', coralShade: '#AE322A', brown: '#2B1A14', cream: '#FFFDF8' };
const KO = "'SUIT', 'Inter Tight', sans-serif";
const EN = "'Inter Tight', 'SUIT', sans-serif";
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
const K = 1080 / 940;
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };

// 장면 — 시작 초 · 그림 · 다가갈 자리(그림 좌표) · 시작/끝 크기
const SHOTS = [
  { at: 0, img: 'img/sneak.jpg', cam: [380, 1040], z0: 1.0, z1: 1.06 },
  { at: T.scold[0], img: 'img/block.jpg', cam: [480, 1000], z0: 1.04, z1: 1.1 },
  { at: T.scold[1], img: 'img/apron.jpg', cam: [340, 1200], z0: 1.04, z1: 1.1 },
  { at: T.scold[2], img: 'img/open.jpg', cam: [500, 1200], z0: 1.03, z1: 1.09 },
  { at: T.dusk, img: 'img/hang.jpg', cam: [430, 820], z0: 1.0, z1: 1.08 },
  { at: T.go, img: 'img/dusk.jpg', cam: [300, 760], z0: 1.04, z1: 1.14 },
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
  const [x0, y0, x1, y1] = [480, 330, 900, 960]; // 창 자리만 — 계산대 위 케이크 · 몽글에는 내리지 않는다
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
  for (const b of [...T.scold, T.go, T.flip]) punch = Math.max(punch, interpolate(t, [b - 0.02, b + 0.08, b + 0.5], [0, 1, 0], { ...clamp, easing: EASE_IO }));
  const sx = 4 * Math.sin((2 * Math.PI * t) / 3.3);
  const sy = 4 * Math.sin((2 * Math.PI * t) / 4.1 + 1);
  const big = z * (1 + (k < 4 ? 0.05 : 0.02) * punch);
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

// 말풍선(한글 · 로마자 읽기 · 영어)
const TOP0 = 290;
const H = 286;
const LocCtx = React.createContext<Loc>('en');
const Bubble: React.FC<{ line: Line; t: number; from: number; until: number }> = ({ line, t, from, until }) => {
  const pack = LOCS[React.useContext(LocCtx)];
  if (t < from || t >= until) return null;
  const a = interpolate(t, [from, from + 0.18], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
  const TOP = line.top ?? TOP0;
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
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 52, lineHeight: 1.2, color: C.coralShade, whiteSpace: 'nowrap' }}>🔊 {line.read}</div>
        <div style={{ fontFamily: pack.font, fontWeight: 800, fontSize: pack.size, lineHeight: pack.lineH, color: C.brown, whiteSpace: 'nowrap' }}>
          {/* 「지 마」와 뜻 줄의 금지 자리를 같은 색으로 — 따로 「= don't」 카드를 세우지 않는다(v4 haiku 9번 「X = 뜻 카드가 지난 편과 같다」) */}
          {pack.means[LINES.indexOf(line)].map((g, i) => (
            <span key={i} style={g.c ? { color: C.coralShade } : undefined}>{g.t}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

// 이야기 자막 — 작은 알약 한 줄(장면을 덮지 않는 자리)
const Cap: React.FC<{ t: number; from: number; until: number; top: number; children: React.ReactNode }> = ({ t, from, until, top, children }) => {
  const pack = LOCS[React.useContext(LocCtx)];
  if (t < from || t >= until) return null;
  const a = interpolate(t, [from, from + 0.2], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ position: 'absolute', left: 0, width: 1080, top, display: 'flex', justifyContent: 'center', opacity: a, transform: `translateY(${(1 - a) * 16}px)` }}>
      <div style={{ padding: '16px 40px 20px', borderRadius: 999, background: 'rgba(24,16,30,0.86)', boxShadow: '0 10px 24px rgba(20,8,0,0.35)', fontFamily: pack.font, fontWeight: 800, fontSize: pack.capSize, color: C.cream, whiteSpace: 'nowrap' }}>{children}</div>
    </div>
  );
};

// 끝 — 쪽지의 말. 첫 잔소리 「먹지 마!」가 떠오르고, 「지 마」(와 영어 Don't)가 떨어져 「먹어.」(Eat it.)가 된다.
const Flip: React.FC<{ t: number }> = ({ t }) => {
  const pack = LOCS[React.useContext(LocCtx)];
  if (t < T.eat || t >= T.bite) return null;
  const line = LINES[5];
  // 접시 앞 쪽지(화면 약 665, 1420)에서 커져 나온다 — 이 말이 그가 남긴 쪽지의 말임을 보인다(v4 두 시험관 「먹어는 누구 말인가」)
  const a = interpolate(t, [T.eat, T.eat + 0.42], [0.1, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) });
  const fade = interpolate(t, [T.eat, T.eat + 0.12], [0, 1], clamp);
  const fall = interpolate(t, [T.flip, T.flip + 0.45], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const oldA = interpolate(t, [T.flip + 0.3, T.flip + 0.42], [1, 0], clamp);
  const newA = interpolate(t, [T.flip + 0.32, T.flip + 0.52], [0, 1], { ...clamp, easing: EASE_OUT });
  const newS = interpolate(t, [T.flip + 0.32, T.flip + 0.52], [0.8, 1], { ...clamp, easing: Easing.out(Easing.back(2.4)) });
  // 「지 마!」만 카드 밖으로 떨어지고, 아래 두 줄(읽기 · 영어)은 그 순간 먼저 사라져 겹치지 않게 한다
  const drop: React.CSSProperties = { display: 'inline-block', transform: `translateY(${fall * 260}px) rotate(${fall * 28}deg)`, opacity: interpolate(fall, [0, 0.6, 1], [1, 0.9, 0]) };
  const dropEn: React.CSSProperties = { display: 'inline-block', transform: `translateY(${fall * 200}px) rotate(${fall * -24}deg)`, opacity: interpolate(fall, [0, 0.6, 1], [1, 0.9, 0]) };
  const NOTE = { x: 665 - line.left, y: 1420 - TOP0 };
  const sub = interpolate(t, [T.flip, T.flip + 0.1], [1, 0], clamp);
  const row = (ko: React.ReactNode, read: React.ReactNode, en: React.ReactNode, style: React.CSSProperties) => (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', ...style }}>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 112, lineHeight: 1.05, color: C.brown, whiteSpace: 'nowrap' }}>{ko}</div>
      <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 52, lineHeight: 1.2, color: C.coralShade, whiteSpace: 'nowrap' }}>{read}</div>
      <div style={{ fontFamily: pack.font, fontWeight: 800, fontSize: pack.size, lineHeight: pack.lineH, color: C.brown, whiteSpace: 'nowrap' }}>{en}</div>
    </div>
  );
  return (
    <div style={{ position: 'absolute', left: line.left, top: TOP0, width: line.width, height: H, borderRadius: 18, background: '#FBF3E1', boxShadow: '0 14px 30px rgba(30,10,0,0.45)', opacity: fade, transform: `scale(${a}) rotate(${-2 * a}deg)`, transformOrigin: `${NOTE.x}px ${NOTE.y}px` }}>
      {/* 쪽지 종이 — 위 가운데 테이프 한 조각 */}
      <div style={{ position: 'absolute', left: line.width / 2 - 70, top: -22, width: 140, height: 44, background: 'rgba(236,222,190,0.85)', transform: 'rotate(3deg)', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }} />
      {row(
        <>먹<span style={{ ...drop, color: C.coralShade }}>지 마!</span></>,
        <span style={{ opacity: sub }}>🔊 meok-ji ma</span>,
        <>{pack.means[0].map((g, i) => (g.c ? <span key={i} style={{ ...dropEn, color: C.coralShade }}>{g.t}</span> : <span key={i} style={{ opacity: sub }}>{g.t}</span>))}</>,
        { opacity: oldA },
      )}
      {row(line.ko, `🔊 ${line.read}`, pack.means[5].map((g) => g.t).join(''), { opacity: newA, transform: `scale(${newS})` })}
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
const AT = [T.scold[0], T.scold[1], T.scold[2], T.go, T.pat + 0.3, T.flip + 0.32];
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
    <Sfx file="tok.wav" at={T.dusk + 0.7} vol={0.2} />
    <Sfx file="sniff.wav" at={T.go + 1.5} vol={0.2} />
    <Sfx file="bell.wav" at={T.end - 0.5} vol={0.22} />
    {/* 첫 잔소리가 떠오르는 자리 — 그의 「먹지 마!」를 작게 한 번 더 */}
    <Vo id="m1" at={T.eat + 0.08} vol={0.42} />
    <Sfx file="tok.wav" at={T.bite + 0.05} vol={0.16} />
    <Sfx file="tok.wav" at={T.bite + 0.38} vol={0.12} />
    <Sfx file="sniff.wav" at={T.bite + 1.2} vol={0.2} />
  </>
);

export const Film: React.FC<{ loc?: Loc }> = ({ loc = 'en' }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  const pack = LOCS[loc];
  return (
    <LocCtx.Provider value={loc}>
    <AbsoluteFill style={{ backgroundColor: '#1a1014' }}>
      <Plate t={t} />
      <Bubble line={LINES[0]} t={t} from={T.scold[0]} until={T.scold[1]} />
      <Bubble line={LINES[1]} t={t} from={T.scold[1]} until={T.scold[2]} />
      <Bubble line={LINES[2]} t={t} from={T.scold[2]} until={T.dusk} />
      <Bubble line={LINES[3]} t={t} from={T.go} until={T.pat} />
      <Bubble line={LINES[4]} t={t} from={T.pat + 0.3} until={T.end} />
      <Flip t={t} />
      <Cap t={t} from={T.dusk + 0.2} until={T.go} top={1360}>{pack.caption.last}</Cap>
      <Cap t={t} from={T.end + 0.15} until={T.bite} top={140}>{pack.caption.note}</Cap>
      <Sound />
    </AbsoluteFill>
    </LocCtx.Provider>
  );
};
