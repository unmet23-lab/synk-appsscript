// LAB 몽골 M33 「이 잔 주세요」 — 종이컵 둘을 띄운 몽글이 「아메리카노 이 잔 주세요!」 → 바리스타가 「이 잔…?」 하며 선반의 커다란 머그를 번쩍 「이 잔이요?」 →
// 종이컵이 툭 떨어지고 몽글이 얼어붙는다 → 메뉴판: 한 잔 · 두 잔 · 세 잔 → 다시 「두 잔 주세요!」 → 이번엔 일부러 「이 잔도 주세요!」 → 머그 번쩍 한 번 더.
// 장면은 GPT 이미지 2.5로 구운 같은 구도의 판(판/*.png, 지시문 판/*.txt)을 갈아 끼우는 인형극이다. 종이컵은 오린 조각이 실제로 떨어진다.
// v3(11-08): 첫 렌더 시험에서 둘 넘게 짚은 자리 — 메뉴판이 수업처럼 길다 · 「?」와 「2」의 뜻 · 「= 뜻」 꼬리표와 ✓✕ 대비가 지난 편과 같은 짜임 — 를 고쳤다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { END, MENU, SAY, TAG, TEXT } from './data';
import { fr, T } from './timeline';

const C = { coral: '#C63A2B', shade: '#AE322A', brown: '#2B1A14', cream: '#FFFDF8', stitch: '#E58A73', green: '#2F7D4F', butter: '#FFE7A1' };
const MN = "'Inter Tight', 'SUIT', sans-serif";
const KO = "'SUIT', 'Inter Tight', sans-serif";
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IO = Easing.bezier(0.45, 0, 0.25, 1);
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
const fadeIn = (t: number, at: number, d = 0.18) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: EASE_OUT });
const pop = (t: number, at: number, d = 0.2) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });

// 장면 — 시작 초 · 그림 · 다가갈 자리 · 시작/끝 크기
type Shot = { at: number; img: string; o: [number, number]; z0: number; z1: number; ease?: boolean };
const SHOTS: Shot[] = [
  { at: 0, img: 'order', o: [330, 1330], z0: 1.0, z1: 1.06 },
  { at: T.look, img: 'order', o: [745, 792], z0: 1.06, z1: 1.22, ease: true },
  { at: T.lift, img: 'lift', o: [700, 1000], z0: 1.0, z1: 1.05 },
  { at: T.freeze, img: 'freeze', o: [230, 1370], z0: 1.05, z1: 1.15 },
  { at: T.menu, img: 'menu', o: [540, 1150], z0: 1.0, z1: 1.03 },
  { at: T.two, img: 'menu', o: [560, 1131], z0: 1.14, z1: 1.17 }, // 「두 잔」 줄로 다가감(한 구성 4초 안)
  { at: T.retry, img: 'success', o: [420, 1300], z0: 1.0, z1: 1.05 },
  { at: T.close, img: 'success', o: [420, 1000], z0: 1.2, z1: 1.26 },
  { at: T.endShot, img: 'end', o: [760, 800], z0: 1.22, z1: 1.26 }, // 바리스타 · 머그 가까이 「네, 이 잔도요!」
  // 11-09 아르곤 맹검 「문제가 풀렸는데 머그를 든 채 굳어 있다」 → 끝은 머그를 몽글 옆에 내려놓은 판(end2)
  { at: T.endLine, img: 'end2', o: [540, 1350], z0: 1.0, z1: 1.03 },
  { at: T.end, img: 'end2', o: [420, 1460], z0: 1.1, z1: 1.13 },
];
const shotAt = (t: number) => {
  let k = 0;
  for (let i = 1; i < SHOTS.length; i++) if (t >= SHOTS[i].at) k = i;
  return k;
};
const PUNCH = [T.lift, T.freeze, T.menu, T.two, T.retry, T.close, T.endShot, T.endLine, T.end];

// 인물만 살짝 움직이는 조각 — 같은 판을 부드러운 타원 가면으로 겹쳐 그 자리만 눌렀다 폈다 한다(장면이 떨리지 않게, M28과 같음)
const Patch: React.FC<{ img: string; cx: number; cy: number; rx: number; ry: number; sx?: number; sy?: number; dx?: number; dy?: number; rot?: number }> = ({ img, cx, cy, rx, ry, sx = 1, sy = 1, dx = 0, dy = 0, rot = 0 }) => {
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, black 78%, transparent 100%)`;
  return (
    <Img
      src={staticFile(`img/${img}.jpg`)}
      style={{ ...FULL, WebkitMaskImage: mask, maskImage: mask, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${sx}, ${sy})`, transformOrigin: `${cx}px ${cy + ry * 0.75}px` }}
    />
  );
};

// 떨어지는 종이컵 — 오린 조각(img/cup.png)
const Cup: React.FC<{ t: number; from: [number, number]; to: [number, number]; rot: number; start: number; land: number }> = ({ t, from, to, rot, start, land }) => {
  if (t < T.lift || t >= T.freeze) return null;
  const k = interpolate(t, [start, land], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const after = t > land ? t - land : 0;
  const bounce = after > 0 ? -26 * Math.exp(-after * 9) * Math.abs(Math.sin(after * 16)) : 0;
  const shiver = t < start ? 4 * Math.sin(t * 55) : 0;
  const x = from[0] + (to[0] - from[0]) * k + shiver;
  const y = from[1] + (to[1] - from[1]) * k + bounce;
  const r = rot * interpolate(t, [start, land + 0.05], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  return (
    <Img src={staticFile('img/cup.png')} style={{ position: 'absolute', left: x - 56, top: y - 79, width: 112, height: 158, transform: `rotate(${r}deg)`, filter: 'drop-shadow(0 10px 10px rgba(50,20,10,0.35))' }} />
  );
};

// 이름표 — 한국어 크게, 그 아래 몽골 뜻 작게. 바늘땀 실이 그 물건을 가리킨다(판 안이라 카메라와 함께 움직인다)
const Tag: React.FC<{ t: number; at: number; until: number; x: number; y: number; to?: [number, number]; ko: string; mn: string; size?: number; color?: string; rot?: number }> = ({ t, at, until, x, y, to, ko, mn, size = 92, color = C.shade, rot = -1.5 }) => {
  if (t < at || t >= until) return null;
  const a = pop(t, at, 0.24);
  const draw = interpolate(t, [at, at + 0.2], [0, 1], clamp);
  return (
    <>
      {to ? (
        <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <line x1={x} y1={y} x2={x + (to[0] - x) * draw} y2={y + (to[1] - y) * draw} stroke={C.cream} strokeWidth={9} strokeDasharray="20 13" strokeLinecap="round" />
          {draw >= 1 ? <circle cx={to[0]} cy={to[1]} r={15} fill={C.cream} stroke={C.shade} strokeWidth={5} /> : null}
        </svg>
      ) : null}
      <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${a}) rotate(${rot}deg)`, background: C.cream, borderRadius: 28, padding: '10px 30px 14px', outline: `5px dashed ${C.stitch}`, outlineOffset: -11, display: 'flex', flexDirection: 'column', alignItems: 'center', whiteSpace: 'nowrap', boxShadow: '0 10px 24px rgba(50,20,10,0.32)' }}>
        <span style={{ fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1.05, color }}>{ko}</span>
        <span style={{ fontFamily: MN, fontWeight: 800, fontSize: size * 0.5, lineHeight: 1.1, color: C.brown }}>{mn}</span>
      </div>
    </>
  );
};


// 생각 풍선 — 바리스타가 「이 잔…?」 하고 선반의 머그를 떠올린다(화면에 붙어 있다)
const Think: React.FC<{ t: number }> = ({ t }) => {
  const from = T.look + 0.1;
  if (t < from || t >= T.lift) return null;
  const a = pop(t, from, 0.25);
  const dots = [[905, 690, 16], [925, 790, 22], [940, 900, 28]];
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${a})`, transformOrigin: '930px 900px' }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        {dots.map(([x, y, r]) => <circle key={y} cx={x} cy={y} r={r} fill={C.cream} stroke={C.shade} strokeWidth={5} />)}
      </svg>
      <div style={{ position: 'absolute', left: 820, top: 540, transform: 'translate(-50%, -50%)', background: C.cream, borderRadius: 80, padding: '18px 44px 22px', border: `6px dashed ${C.shade}`, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 10px 24px rgba(50,20,10,0.3)' }}>
        <span style={{ fontFamily: KO, fontWeight: 900, fontSize: 84, lineHeight: 1.05, color: C.shade, whiteSpace: 'nowrap' }}>{SAY.think.ko}</span>
        <span style={{ fontFamily: MN, fontWeight: 700, fontSize: 58, lineHeight: 1.15, color: C.brown, whiteSpace: 'nowrap' }}>{SAY.think.read}</span>
      </div>
    </div>
  );
};

const Plate: React.FC<{ t: number; children?: React.ReactNode }> = ({ t, children }) => {
  const k = shotAt(t);
  const s = SHOTS[k];
  const next = k + 1 < SHOTS.length ? SHOTS[k + 1].at : T.total;
  const z = interpolate(t, [s.at, next], [s.z0, s.z1], { ...clamp, easing: s.ease ? EASE_IO : undefined });
  let punch = 0;
  for (const b of PUNCH) punch = Math.max(punch, interpolate(t, [b - 0.02, b + 0.07, b + 0.4], [0, 1, 0], clamp));
  // 머그 번쩍 — 카메라가 아래에서 위로 휙 올라가며 들어온다
  const riseAt = (b: number) => (t >= b && t < b + 0.5 ? interpolate(t, [b, b + 0.22, b + 0.45], [70, -10, 0], { ...clamp, easing: EASE_OUT }) : 0);
  const sx = 3 * Math.sin((2 * Math.PI * t) / 3.3);
  const sy = 2.5 * Math.sin((2 * Math.PI * t) / 4.3 + 1);
  const bob = (p: number, a: number) => a * Math.sin(t * p);
  const hop = (from: number) => (t >= from ? -Math.abs(Math.sin((t - from) * 6.2)) * 14 * Math.exp(-(t - from) * 0.25) : 0);
  const shiver = t >= T.freeze && t < T.freeze + 0.7 ? 5 * Math.sin((t - T.freeze) * 62) * (1 - (t - T.freeze) / 0.7) : 0;
  return (
    <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy + riseAt(T.lift) + riseAt(T.endShot)}px) scale(${z * (1 + 0.035 * punch)})`, transformOrigin: `${s.o[0]}px ${s.o[1]}px` }}>
      <Img src={staticFile(`img/${s.img}.jpg`)} style={FULL} />
      {s.img === 'order' && t >= T.look ? <Patch img="order" cx={832} cy={1110} rx={215} ry={205} rot={-7 * pop(t, T.look + 0.05, 0.35)} dy={-10 * pop(t, T.look + 0.05, 0.35)} /> : null}
      {s.img === 'order' ? <Patch img="order" cx={212} cy={1350} rx={245} ry={285} dy={t < 2.0 ? -Math.abs(Math.sin(t * 5.4)) * 11 : bob(3.1, 5)} sy={1 + 0.02 * Math.sin(t * 10.8)} /> : null}
      {s.img === 'lift' ? <Patch img="lift" cx={765} cy={705} rx={330} ry={250} dy={bob(4.4, 6)} /> : null}
      {s.img === 'lift' ? <Patch img="lift" cx={232} cy={1370} rx={230} ry={250} sx={1 - 0.03 * pop(t, T.lift + 0.1, 0.3)} sy={1 + 0.04 * pop(t, T.lift + 0.1, 0.3)} /> : null}
      {s.img === 'freeze' ? <Patch img="freeze" cx={232} cy={1370} rx={230} ry={250} dx={shiver} /> : null}
      {s.img === 'success' && t < T.close ? <Patch img="success" cx={210} cy={1350} rx={235} ry={265} dy={hop(T.r2 + 0.2)} /> : null}
      {s.img === 'end' ? <Patch img="end" cx={765} cy={705} rx={330} ry={250} dy={bob(4.4, 7)} /> : null}
      {s.img === 'end' ? <Patch img="end" cx={242} cy={1330} rx={235} ry={250} dy={hop(T.endShot + 0.3)} /> : null}
      {s.img === 'end2' ? <Patch img="end2" cx={248} cy={1460} rx={200} ry={210} sy={1 + 0.025 * Math.sin(t * 6.5)} sx={1 - 0.012 * Math.sin(t * 6.5)} /> : null}
      {children}
    </AbsoluteFill>
  );
};

// 말풍선 — 한국어 크게 · 키릴 읽기 작게, 꼬리는 말하는 인물을 가리킨다
const Bubble: React.FC<{ t: number; from: number; until: number; x: number; y: number; w: number; h: number; tail: [number, number]; say: { ko: string; read: string }; size?: number }> = ({ t, from, until, x, y, w, h, tail, say, size = 78 }) => {
  if (t < from || t >= until) return null;
  const a = pop(t, from);
  const left = x - w / 2;
  const top = y - h / 2;
  const bx = Math.min(Math.max(tail[0], left + 70), left + w - 70);
  // 꼬리 끝이 풍선 위에 있으면 위 가장자리에서 짧게 올린다(11-09 아르곤 「꼬리가 팔을 가로지른다」)
  const by = tail[1] < top ? top + 6 : top + h - 6;
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${a})`, transformOrigin: `${bx}px ${by}px` }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <path d={`M ${bx - 30} ${by} L ${tail[0]} ${tail[1]} L ${bx + 30} ${by} Z`} fill={C.cream} stroke={C.shade} strokeWidth={6} strokeLinejoin="round" />
        <rect x={left} y={top} width={w} height={h} rx={Math.min(64, h / 2)} fill={C.cream} stroke={C.shade} strokeWidth={6} />
        <rect x={bx - 26} y={tail[1] < top ? by - 4 : by - 8} width={52} height={12} fill={C.cream} />
        {/* 안쪽 바늘땀 — 위 띠 · 이름표와 같은 천 조각 결(미학 대체 심사 「틀 세 가지가 섞임」) */}
        <rect x={left + 13} y={top + 13} width={w - 26} height={h - 26} rx={Math.min(52, h / 2 - 13)} fill="none" stroke={C.stitch} strokeWidth={4} strokeDasharray="14 10" strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', left, top, width: w, height: h, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {/* 한국어 줄마다 바로 아래 키릴 읽기(시험관 둘이 「읽기 글씨가 작아 끝을 못 읽음」 — 크게, 줄마다 짝지어) */}
        {say.ko.split('\n').map((ko, i, all) => {
          const reads = say.read.split('\n');
          const read = reads.length === all.length ? reads[i] : i === all.length - 1 ? say.read : null;
          return (
            <React.Fragment key={ko}>
              <div style={{ fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1.04, color: C.shade, whiteSpace: 'pre' }}>{ko}</div>
              {read ? <div style={{ fontFamily: MN, fontWeight: 700, fontSize: size * 0.72, lineHeight: 1.12, color: C.brown, marginBottom: i < all.length - 1 ? 6 : 0, whiteSpace: 'nowrap' }}>{read}</div> : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// 위 띠 — 바늘땀 테 두른 천 이름표(뜻 줄)
const Band: React.FC<{ t: number; at: number; size?: number; children: React.ReactNode }> = ({ t, at, size = 62, children }) => {
  const a = fadeIn(t, at, 0.15);
  return (
    <div style={{ position: 'absolute', left: 70, width: 940, top: 246, background: 'rgba(255,253,248,0.98)', borderRadius: 34, outline: `5px dashed ${C.stitch}`, outlineOffset: -13, padding: '30px 36px 34px', boxSizing: 'border-box', boxShadow: '0 10px 28px rgba(60,20,10,0.28)', fontFamily: MN, fontWeight: 800, fontSize: size, lineHeight: 1.16, color: C.brown, textAlign: 'center', whiteSpace: 'pre-line', transform: `translateY(${(1 - a) * 14}px)`, opacity: a }}>
      {children}
    </div>
  );
};
const Top: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.lift) return <Band t={t} at={-1}>{TEXT.hook}</Band>;
  // 점원의 「이 잔이요?」는 말풍선 대신 위 띠에 한국어 · 읽기 · 몽골 뜻을 함께(11-09 아르곤 세 판 내내 말풍선 자리 — 꼬리가 팔 · 얼굴을 찌르고 릴스 단추 자리에 걸림)
  if (t < T.freeze) return (
    <Band t={t} at={T.lift + 0.1}>
      <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 84, lineHeight: 1.05, color: C.shade }}>{SAY.r1.ko}</div>
      <div style={{ fontFamily: MN, fontWeight: 700, fontSize: 52, lineHeight: 1.15, color: C.brown }}>{SAY.r1.read} · {TEXT.r1}</div>
    </Band>
  );
  if (t < T.menu) return <Band t={t} at={T.freeze + 0.15} size={56}>{TEXT.heard}</Band>;
  if (t < T.two) return <Band t={t} at={T.menu} size={54}>{TEXT.menu}</Band>;
  if (t < T.retry) return <Band t={t} at={T.two}>{TEXT.two}</Band>;
  if (t < T.r2) return <Band t={t} at={T.retry + 0.1}>{TEXT.m2}</Band>;
  if (t < T.close) return <Band t={t} at={T.r2}>{TEXT.r2}</Band>;
  if (t < T.endShot) return <Band t={t} at={T.close + 0.1}>{TEXT.m3}</Band>;
  if (t < T.endLine) return <Band t={t} at={T.endShot + 0.1}>{TEXT.r3}</Band>;
  return <EndBand t={t} />;
};
// 끝 띠 — 문장부호 없이 두 줄, 한국어 크게 · 몽골 뜻 작게(11-09 아르곤 「줄표 · 겹화살괄호 · 쉼표가 섞여 산만」)
const EndBand: React.FC<{ t: number }> = ({ t }) => {
  const a = fadeIn(t, T.endLine, 0.15);
  return (
    <div style={{ position: 'absolute', left: 150, width: 780, top: 246, background: 'rgba(255,253,248,0.98)', borderRadius: 34, outline: `5px dashed ${C.stitch}`, outlineOffset: -13, padding: '26px 40px 30px', boxSizing: 'border-box', boxShadow: '0 10px 28px rgba(60,20,10,0.28)', transform: `translateY(${(1 - a) * 14}px)`, opacity: a, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {END.map((r) => (
        <div key={r.ko} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 26 }}>
          <span style={{ fontFamily: KO, fontWeight: 900, fontSize: 84, lineHeight: 1.1, color: C.shade }}>{r.ko}</span>
          <span style={{ fontFamily: MN, fontWeight: 800, fontSize: 58, lineHeight: 1.1, color: C.brown }}>{r.mn}</span>
        </div>
      ))}
    </div>
  );
};

// 메뉴판 글 — 줄마다 그 칸의 컵 수 옆에 한국어 · 키릴 읽기, 「두 잔」 줄이 빛난다
const ROWS = [
  // 11-09 아르곤 「컵 수에 밀려 글이 계단식」 → 세 줄 글 시작을 한 자리로
  { x: 600, y: 798, at: T.n1 },
  { x: 600, y: 1131, at: T.n1 + 0.46 },
  { x: 600, y: 1481, at: T.n1 + 0.87 },
];
const Menu: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.menu || t >= T.retry) return null;
  const glow = t >= T.two ? interpolate(t, [T.two, T.two + 0.12, T.two + 0.6], [0, 1, 0.45], clamp) : 0;
  return (
    <>
      {MENU.map((m, i) => {
        const r = ROWS[i];
        if (t < r.at) return null;
        const a = pop(t, r.at, 0.22);
        const hot = i === 1 && t >= T.two;
        return (
          <div key={m.ko} style={{ position: 'absolute', left: r.x, top: r.y, transform: `translateY(-50%) scale(${a * (hot ? 1 + 0.16 * glow : 1)})`, transformOrigin: 'left center' }}>
            <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 122, lineHeight: 1.0, color: hot ? C.butter : C.cream, whiteSpace: 'nowrap', textShadow: hot ? `0 0 ${28 * glow}px rgba(255,231,161,${0.9 * glow}), 0 4px 0 rgba(20,10,5,0.55)` : '0 4px 0 rgba(20,10,5,0.55)' }}>{m.ko}</div>
            <div style={{ fontFamily: MN, fontWeight: 700, fontSize: 64, lineHeight: 1.2, color: '#E9D9C4', marginTop: 8, whiteSpace: 'nowrap' }}>{m.read}</div>
          </div>
        );
      })}
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
// 음악은 말할 때 내려가고, 얼어붙는 순간 한 번 멎었다가 메뉴판에서 돌아온다
const SPEAK: [number, number][] = [[T.m1, T.m1 + 1.7], [T.lift + 0.12, T.lift + 0.85], [T.n1, T.n1 + 1.4], [T.retry + 0.12, T.retry + 1.85], [T.r2 + 0.06, T.r2 + 1.4], [T.close + 0.12, T.close + 1.6], [T.endShot + 0.12, T.endShot + 1.4]];
const bgmVol = (f: number) => {
  const t = f / 30;
  let duck = 1;
  for (const [a, b] of SPEAK) duck = Math.min(duck, interpolate(t, [a - 0.15, a, b, b + 0.25], [1, 0.55, 0.55, 1], clamp));
  // 11-09 ⑲: 얼어붙는 순간 음악을 0.2까지 내렸더니 「음악 꺼짐」(유호님 11-08 「중간중간 빠져있다」) — 0.6(−4.4dB)까지만, 음악 바닥도 조금 올림
  const freeze = interpolate(t, [T.freeze - 0.05, T.freeze + 0.05, T.menu - 0.4, T.menu], [1, 0.6, 0.6, 1], clamp);
  const lvl = interpolate(t, [0, 0.25, T.total - 0.6, T.total], [0.6, 1, 1, 0], clamp);
  return 0.16 * MASTER * lvl * duck * freeze;
};
const Sound: React.FC<{ scene: boolean }> = ({ scene }) => (
  <>
    <Audio src={staticFile('sfx/bgm.wav')} volume={bgmVol} />
    <Audio src={staticFile('sfx/cafe.wav')} volume={0.16 * MASTER} />
    <Sfx file="pop.wav" at={T.m1 - 0.1} vol={0.35} />
    <Vo id="m1" at={T.m1} />
    <Sfx file="huh.wav" at={T.look + 0.1} vol={0.45} />
    <Sfx file="tada.wav" at={T.lift - 0.12} vol={0.75} />
    <Vo id="r1" at={T.lift + 0.12} />
    <Sfx file="cup.wav" at={T.land1} vol={0.7} />
    <Sfx file="cup.wav" at={T.land2} vol={0.6} />
    <Sfx file="lid.wav" at={T.land2 + 0.09} vol={0.45} />
    <Sfx file="freeze.wav" at={T.freeze - 0.05} vol={0.7} />
    {scene ? null : (
      <>
        <Sfx file="pom.wav" at={T.lift + 0.6} vol={0.4} />
        <Sfx file="pom.wav" at={T.menu} vol={0.55} />
        <Sfx file="chalk.wav" at={ROWS[0].at} vol={0.5} />
        <Sfx file="chalk.wav" at={ROWS[1].at} vol={0.5} />
        <Sfx file="chalk.wav" at={ROWS[2].at} vol={0.5} />
        <Vo id="n1" at={T.n1} />
        <Sfx file="ding.wav" at={T.two} vol={0.6} />
        <Sfx file="pop.wav" at={T.retry + 0.05} vol={0.35} />
        <Vo id="m2" at={T.retry + 0.12} />
        <Sfx file="cup.wav" at={T.r2 - 0.12} vol={0.35} />
        <Sfx file="cup.wav" at={T.r2 - 0.02} vol={0.3} />
        <Vo id="r2" at={T.r2 + 0.06} />
        <Sfx file="pom.wav" at={T.r2 + 0.55} vol={0.4} />
        <Sfx file="sparkle.wav" at={T.close} vol={0.5} />
        <Vo id="m3" at={T.close + 0.12} />
        <Sfx file="tada.wav" at={T.endShot - 0.12} vol={0.65} />
        <Vo id="r3" at={T.endShot + 0.12} />
        <Sfx file="pom.wav" at={T.endLine} vol={0.45} />
        <Sfx file="sparkle.wav" at={T.end} vol={0.55} />
        <Sfx file="ding.wav" at={T.end + 0.05} vol={0.35} />
      </>
    )}
  </>
);

export const Film: React.FC<{ scene?: boolean }> = ({ scene = false }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  return (
    <AbsoluteFill style={{ background: '#2B1A14' }}>
      <Plate t={t}>
        <Cup t={t} from={[440, 1320]} to={[300, 1612]} rot={-96} start={T.fall} land={T.land1} />
        <Cup t={t} from={[571, 1320]} to={[520, 1618]} rot={88} start={T.fall + 0.1} land={T.land2} />
        {/* 「2 аяга」 알약은 뺐다 — 위 띠가 「두 잔」을 말하고, 아르곤 「글 상자 셋이 겹친다」(11-09) */}
        {scene ? null : (
          <>
            <Tag t={t} at={T.freeze + 0.35} until={T.menu} x={300} y={1010} to={[700, 690]} ko={TAG.thisCup.ko} mn={TAG.thisCup.mn} size={88} />
            <Tag t={t} at={T.r2 + 0.55} until={T.close} x={560} y={1790} to={[520, 1575]} ko={TAG.twoCups.ko} mn={TAG.twoCups.mn} size={88} color={C.green} />
            <Menu t={t} />
          </>
        )}
      </Plate>
      <Think t={t} />
      {/* 11-09 아르곤 v13: 꼬리가 몽글 정수리 · 점원 코와 입을 찌름 → 꼬리 끝은 닿기 전에서 멈추고, 점원 말풍선은 얼굴 아래로 */}
      <Bubble t={t} from={T.m1 - 0.1} until={T.look + 0.5} x={310} y={720} w={590} h={360} tail={[250, 1100]} say={SAY.m1} size={80} />
      {scene ? <Bubble t={t} from={T.lift + 0.08} until={T.freeze} x={815} y={1440} w={440} h={210} tail={[870, 1285]} say={SAY.r1} size={84} /> : null}
      {scene ? null : (
        <>
          <Bubble t={t} from={T.retry + 0.05} until={T.r2} x={330} y={720} w={620} h={360} tail={[230, 1150]} say={SAY.m2} size={80} />
          <Bubble t={t} from={T.r2} until={T.close} x={790} y={1385} w={560} h={220} tail={[765, 1238]} say={SAY.r2} size={80} />
          <Bubble t={t} from={T.close + 0.05} until={T.endShot} x={340} y={990} w={620} h={220} tail={[220, 1230]} say={SAY.m3} size={80} />
          <Tag t={t} at={T.close + 0.7} until={T.endShot} x={790} y={866} ko={TAG.also.ko} mn={TAG.also.mn} size={88} rot={4} />
          <Bubble t={t} from={T.endShot + 0.08} until={T.endLine} x={300} y={1060} w={560} h={220} tail={[660, 1080]} say={SAY.r3} size={80} />
          <Top t={t} />
        </>
      )}
      <Sound scene={scene} />
    </AbsoluteFill>
  );
};
