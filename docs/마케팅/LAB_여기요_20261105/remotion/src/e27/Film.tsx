// LAB 영어 E27 「여기요!」 — 붐비는 펠트 고깃집, 몽글만 빈 컵. 직원은 그냥 지나가고, 「저… 저기…」는 안 들리고, 「안녕하세요?」엔 인사만 받고 간다.
// 옆자리 손님의 「여기요!」 한마디에 직원 셋이 달려간다 → 몽글이 숨을 들이켜 몸이 부풀고 → 0.5초 정적 → 「여기요!」 → 셋이 동시에 돌아보고 달려온다 →
// 여기 = here · 요 = polite → 신이 나 또 「여기요!」 → 또 → 음식 산에 묻혀 눈만 남고, 「…여기요」에 직원 셋이 또 달려온다.
// 장면은 GPT 이미지 2.5로 구운 판(판/*.png, 지시문 판/*.txt), 직원과 글자는 구운 펠트를 오린 것. 직원은 두 자세를 번갈아 인형극처럼 달린다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { FONT, Lang, ROMAN, TEXT } from './data';
import { fr, T } from './timeline';

const C = { shade: '#AE322A', brown: '#2B1A14', cream: '#FFF9EC', line: '#E2A98F' };
const KO = "'SUIT', 'Inter Tight', sans-serif";
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
const fadeIn = (t: number, at: number, d = 0.16) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: EASE_OUT });
const pop = (t: number, at: number, d = 0.2) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.4)) });

// 장면 — 시작 초 · 그림 · 다가갈 자리 · 시작/끝 크기
const SHOTS = [
  { at: 0, img: 'wait', cam: [260, 1300], z0: 1.0, z1: 1.05 },
  { at: T.pass1, img: 'side', cam: [260, 1300], z0: 1.05, z1: 1.09 },
  { at: T.um, img: 'table', cam: [440, 1150], z0: 1.0, z1: 1.04 },
  { at: T.bow, img: 'bow', cam: [640, 1100], z0: 1.03, z1: 1.05 },
  { at: T.leave, img: 'table', cam: [440, 1150], z0: 1.04, z1: 1.05 },
  { at: T.auntie, img: 'auntie', cam: [510, 830], z0: 1.1, z1: 1.03 },
  { at: T.auntie2, img: 'auntie2', cam: [640, 1000], z0: 1.03, z1: 1.0 },
  { at: T.word, img: 'table', cam: [440, 1150], z0: 1.03, z1: 1.09 },
  { at: T.puff, img: 'puff', cam: [440, 1000], z0: 1.0, z1: 1.09 },
  { at: T.shout, img: 'shout', cam: [440, 1000], z0: 1.12, z1: 1.0 },
  { at: T.turn, img: 'turn', cam: [540, 1000], z0: 1.13, z1: 1.16 },
  { at: T.rush1, img: 'wait', cam: [540, 1100], z0: 1.0, z1: 1.03 },
  { at: T.arrive, img: 'arrive', cam: [600, 1300], z0: 1.0, z1: 1.03 },
  { at: T.more1, img: 'stack1', cam: [600, 1300], z0: 1.04, z1: 1.0 },
  { at: T.more2, img: 'stack2', cam: [600, 1300], z0: 1.04, z1: 1.0 },
  { at: T.pile, img: 'pile', cam: [480, 1650], z0: 1.0, z1: 1.0 },
  { at: T.end, img: 'pile2', cam: [480, 1650], z0: 1.04, z1: 1.0 },
];
const shotAt = (t: number) => {
  let k = 0;
  for (let i = 1; i < SHOTS.length; i++) if (t >= SHOTS[i].at) k = i;
  return k;
};
const PUNCH = [T.auntie, T.auntie2, T.shout, T.turn, T.arrive, T.more1, T.more2, T.pile, T.end];

const Patch: React.FC<{ img: string; cx: number; cy: number; rx: number; ry: number; sx?: number; sy?: number; dx?: number; dy?: number; oy?: number }> = ({ img, cx, cy, rx, ry, sx = 1, sy = 1, dx = 0, dy = 0, oy }) => {
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, black 78%, transparent 100%)`;
  return <Img src={staticFile(`img/${img}.jpg`)} style={{ ...FULL, WebkitMaskImage: mask, maskImage: mask, transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, transformOrigin: `${cx}px ${oy ?? cy + ry * 0.8}px` }} />;
};

const Plate: React.FC<{ t: number; children?: React.ReactNode }> = ({ t, children }) => {
  const k = shotAt(t);
  const s = SHOTS[k];
  const next = k + 1 < SHOTS.length ? SHOTS[k + 1].at : T.total;
  let z = interpolate(t, [s.at, next], [s.z0, s.z1], clamp);
  if (t >= T.pile && t < T.end) z = interpolate(t, [T.pile, T.whisper - 0.15, T.whisper + 0.3, T.rush2 - 0.05, T.rush2 + 0.3], [1.0, 1.0, 2.1, 2.14, 1.0], { ...clamp, easing: Easing.inOut(Easing.quad) });
  let punch = 0;
  for (const b of PUNCH) punch = Math.max(punch, interpolate(t, [b - 0.02, b + 0.07, b + 0.4], [0, 1, 0], clamp));
  const quiet = t >= T.hush && t < T.rush1;
  const sx = quiet ? 0 : 3 * Math.sin((2 * Math.PI * t) / 3.3);
  const sy = quiet ? 0 : 2.5 * Math.sin((2 * Math.PI * t) / 4.3 + 1);
  // 외침의 흔들림
  const q = t >= T.shout && t < T.turn ? 34 * Math.pow(1 - (t - T.shout) / (T.turn - T.shout), 1.6) : 0;
  const qx = q * Math.sin(t * 71);
  const qy = q * 0.7 * Math.sin(t * 53 + 1);
  // 부풂 — 떨림이 커진다
  const tr = t >= T.puff && t < T.shout ? interpolate(t, [T.puff, T.shout], [0.5, 9], clamp) * Math.sin(t * 66) : 0;
  const swell = t >= T.puff && t < T.shout ? interpolate(t, [T.puff, T.hush], [0.82, 1.0], { ...clamp, easing: EASE_OUT }) : 1;
  const breath = 1 + 0.012 * Math.sin(t * 3.8);
  const pan = t >= T.pile ? interpolate(t, [T.pile, T.whisper - 0.15, T.whisper + 0.3, T.rush2 - 0.05, T.rush2 + 0.3], [0, 0, -290, -290, 0], { ...clamp, easing: Easing.inOut(Easing.quad) }) : 0;
  return (
    <AbsoluteFill style={{ transform: `translate(${sx + qx}px, ${sy + qy + pan}px) scale(${z * (1 + 0.035 * punch)})`, transformOrigin: `${s.cam[0]}px ${s.cam[1]}px` }}>
      <Img src={staticFile(`img/${s.img}.jpg`)} style={FULL} />
      {s.img === 'wait' || s.img === 'side' ? <Patch img={s.img} cx={240} cy={1220} rx={270} ry={260} sy={breath} sx={2 - breath} /> : null}
      {s.img === 'table' ? <Patch img="table" cx={440} cy={1130} rx={470} ry={460} sy={breath} sx={2 - breath} /> : null}
      {s.img === 'puff' ? <Patch img="puff" cx={440} cy={1000} rx={520} ry={500} sx={swell} sy={swell} dx={tr} oy={1400} /> : null}
      {children}
    </AbsoluteFill>
  );
};

// 달리는 직원 — 두 자세를 번갈아(3프레임마다), 발 자리(x,y)와 키(h)를 때에 맞춰 옮긴다. flip이면 오른쪽 아래로 달린다
type WaiterKey = { at: number; x: number; y: number; h: number };
const ASPECT: Record<string, [number, number]> = { w1a: [553, 1009], w1b: [555, 1200], w2a: [597, 902], w2b: [662, 1180], w3a: [629, 944], w3b: [769, 1210] };
const Waiter: React.FC<{ t: number; id: 1 | 2 | 3; keys: WaiterKey[]; flip?: boolean; blur?: number; stopAt?: number }> = ({ t, id, keys, flip, blur = 0, stopAt }) => {
  if (t < keys[0].at || t > keys[keys.length - 1].at + 40) return null;
  if (!stopAt && t > keys[keys.length - 1].at) return null;
  let i = 0;
  while (i + 1 < keys.length && t >= keys[i + 1].at) i++;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const p = a === b ? 1 : interpolate(t, [a.at, b.at], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const x = a.x + (b.x - a.x) * p;
  const y = a.y + (b.y - a.y) * p;
  const h = a.h + (b.h - a.h) * p;
  const moving = !stopAt || t < stopAt;
  const step = moving ? Math.floor(t * 30 / 3) % 2 : 0;
  const name = `w${id}${step ? 'b' : 'a'}`;
  const [iw, ih] = ASPECT[name];
  const dh = step ? h * 1.1 : h; // 넘는 자세는 몸이 곧아 조금 높다
  const dw = (dh * iw) / ih;
  const lean = moving ? (step ? -2 : 2.5) * (flip ? -1 : 1) : 0;
  return (
    <Img
      src={staticFile(`img/${name}.png`)}
      style={{ position: 'absolute', left: x - dw / 2, top: y - dh, width: dw, height: dh, transform: `scaleX(${flip ? -1 : 1}) rotate(${lean}deg)`, transformOrigin: '50% 100%', filter: `drop-shadow(0 ${Math.round(h * 0.02)}px ${Math.round(h * 0.03)}px rgba(40,15,8,0.45))${blur ? ` blur(${blur}px)` : ''}` }}
    />
  );
};
const Waiters: React.FC<{ t: number }> = ({ t }) => (
  <>
    {/* 1 — 복도 끝에서 달려 나와 오른쪽 아래로 그냥 지나간다 */}
    <Waiter t={t} id={1} flip keys={[{ at: T.pass1 + 0.12, x: 820, y: 860, h: 200 }, { at: T.pass1 + 1.25, x: 1240, y: 2120, h: 1400 }]} />
    {/* 2 — 화면 앞을 휙 */}
    {t >= T.pass2 && t < T.hi ? <Waiter t={t} id={3} blur={5} keys={[{ at: T.pass2, x: 1560, y: 2050, h: 1500 }, { at: T.pass2 + 0.55, x: -520, y: 2050, h: 1500 }]} /> : null}
    {/* 3 — 인사만 받고 간다 */}
    {t >= T.leave && t < T.auntie ? <Waiter t={t} id={2} flip keys={[{ at: T.leave, x: 800, y: 1560, h: 900 }, { at: T.leave + 0.5, x: 1420, y: 1760, h: 1050 }]} /> : null}
    {/* 옆자리로 셋 — 달려오는 동안만 오린 직원, 도착하면 구운 판(옆도착) */}
    {t >= T.rush0 && t < T.auntie2 ? (
      <>
        <Waiter t={t} id={1} keys={[{ at: T.rush0 + 0.12, x: 1320, y: 1500, h: 700 }, { at: T.auntie2, x: 800, y: 1500, h: 720 }]} />
        <Waiter t={t} id={2} keys={[{ at: T.rush0, x: 1400, y: 1560, h: 760 }, { at: T.auntie2, x: 930, y: 1570, h: 800 }]} />
        <Waiter t={t} id={3} keys={[{ at: T.rush0 + 0.2, x: 1500, y: 1680, h: 860 }, { at: T.auntie2, x: 1080, y: 1680, h: 900 }]} />
      </>
    ) : null}
    {/* 돌아본 셋이 몽글에게 달려온다 — 돌아본 자리(복도 중간)에서 출발해 상 오른쪽으로 */}
    {t >= T.rush1 && t < T.arrive ? (
      <>
        <Waiter t={t} id={3} keys={[{ at: T.rush1, x: 900, y: 1090, h: 400 }, { at: T.arrive, x: 1080, y: 1770, h: 1000 }]} />
        <Waiter t={t} id={2} keys={[{ at: T.rush1, x: 770, y: 1110, h: 420 }, { at: T.arrive, x: 930, y: 1850, h: 1100 }]} />
        <Waiter t={t} id={1} keys={[{ at: T.rush1, x: 640, y: 1130, h: 440 }, { at: T.arrive, x: 760, y: 1930, h: 1200 }]} />
      </>
    ) : null}
    {/* 또 외칠 때마다 쟁반 든 직원이 앞을 휙 — 그래서 음식이 쌓인다 */}
    {t >= T.more1 + 0.12 && t < T.more1 + 0.75 ? <Waiter t={t} id={3} blur={5} keys={[{ at: T.more1 + 0.12, x: 1500, y: 1900, h: 1150 }, { at: T.more1 + 0.72, x: -420, y: 1900, h: 1150 }]} /> : null}
    {t >= T.more2 + 0.12 && t < T.more2 + 0.75 ? <Waiter t={t} id={1} flip blur={5} keys={[{ at: T.more2 + 0.12, x: -420, y: 1900, h: 1150 }, { at: T.more2 + 0.72, x: 1500, y: 1900, h: 1150 }]} /> : null}
    {/* 끝 — 셋이 또 달려온다, 도착하면 구운 판(끝) */}
    {t >= T.rush2 && t < T.end ? (
      <>
        <Waiter t={t} id={3} keys={[{ at: T.rush2 + 0.16, x: 1500, y: 1560, h: 760 }, { at: T.end, x: 900, y: 1560, h: 800 }]} />
        <Waiter t={t} id={1} keys={[{ at: T.rush2 + 0.08, x: 1480, y: 1730, h: 860 }, { at: T.end, x: 700, y: 1720, h: 900 }]} />
        <Waiter t={t} id={2} keys={[{ at: T.rush2, x: 1480, y: 1900, h: 960 }, { at: T.end, x: 980, y: 1900, h: 1020 }]} />
      </>
    ) : null}
  </>
);

// 주문서 — 톱니 아랫단 종이에 쓴 글(위 글자 자리)
const Slip: React.FC<{ t: number; at: number; lang: Lang; size?: number; children: React.ReactNode }> = ({ t, at, lang, size, children }) => {
  const a = fadeIn(t, at);
  const saw = Array.from({ length: 41 }, (_, i) => `${(i * 100) / 40}% ${i % 2 ? '100%' : 'calc(100% - 14px)'}`).reverse().join(', ');
  return (
    <div style={{ position: 'absolute', left: 80, width: 820, top: 228, transform: `translateY(${(1 - a) * 18}px) rotate(-0.8deg)`, opacity: a, filter: 'drop-shadow(0 12px 18px rgba(50,18,6,0.4))' }}>
      <div style={{ background: C.cream, clipPath: `polygon(0 0, 100% 0, ${saw})`, padding: '30px 30px 46px', boxSizing: 'border-box', fontFamily: FONT[lang], fontWeight: 800, fontSize: size ?? TEXT[lang].size, lineHeight: 1.2, color: C.brown, textAlign: 'center', whiteSpace: 'pre-line' }}>{children}</div>
    </div>
  );
};

// 말풍선
const Bubble: React.FC<{ t: number; from: number; until: number; x: number; y: number; tail: number; size?: number; font?: string; sub?: string; subFont?: string; children: React.ReactNode; w?: number }> = ({ t, from, until, x, y, tail, size = 72, font = KO, sub, subFont, children, w: forceW }) => {
  if (t < from || t >= until) return null;
  const a = pop(t, from);
  const w = forceW ?? 520;
  const h = sub ? size * 2.15 : size * 1.7;
  const left = Math.min(Math.max(60, x - w / 2), 920 - w);
  return (
    <div style={{ position: 'absolute', left, top: y - h / 2, width: w, height: h, transform: `scale(${a})`, transformOrigin: `${50 + tail * 30}% 100%` }}>
      <svg width={w} height={h + 52} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <path d={`M ${w / 2 + tail * 70 - 26} ${h - 4} L ${w / 2 + tail * 140} ${h + 50} L ${w / 2 + tail * 70 + 26} ${h - 4} Z`} fill={C.cream} stroke={C.shade} strokeWidth={6} strokeLinejoin="round" />
        <rect x={3} y={3} width={w - 6} height={h - 6} rx={Math.min(60, h / 2)} fill={C.cream} stroke={C.shade} strokeWidth={6} />
        <rect x={w / 2 + tail * 70 - 22} y={h - 12} width={44} height={12} fill={C.cream} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: font, fontWeight: 900, fontSize: size, lineHeight: 1.08, color: C.shade, whiteSpace: 'pre' }}>{children}</div>
        {sub ? <div style={{ fontFamily: subFont, fontWeight: 700, fontSize: size * 0.6, lineHeight: 1.14, color: C.brown }}>{sub}</div> : null}
      </div>
    </div>
  );
};

// 펠트 글자 — 몽글 몸에서 터져 나와 줄을 맞추고, 여기 + 요로 갈라진다
type LK = { at: number; x: number; y: number; s: number; r?: number };
const Glyph: React.FC<{ t: number; id: string; keys: LK[]; seed: number; aspect: number }> = ({ t, id, keys, seed, aspect }) => {
  if (t < keys[0].at || t > keys[keys.length - 1].at) return null;
  let i = 0;
  while (i + 1 < keys.length && t >= keys[i + 1].at) i++;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const dur = b.at - a.at;
  const p = a === b ? 1 : interpolate(t, [a.at, a.at + Math.min(dur, 0.32)], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
  const mix = (u: number, v: number) => u + (v - u) * p;
  const h = mix(a.s, b.s);
  const w = h * aspect;
  const bob = 5 * Math.sin(t * 2.3 + seed * 1.7);
  const tilt = mix(a.r ?? 0, b.r ?? 0) + 1.8 * Math.sin(t * 1.7 + seed);
  return <Img src={staticFile(`img/${id}.png`)} style={{ position: 'absolute', left: mix(a.x, b.x) - w / 2, top: mix(a.y, b.y) - h / 2 + bob, width: w, height: h, transform: `rotate(${tilt}deg)`, filter: 'drop-shadow(0 12px 16px rgba(50,18,6,0.55))' }} />;
};
const BX = 640; // 끝 말풍선 자리 — 맨 위 그릇을 올리는 직원 쪽
const BY = 345;
const BT = 1;
const AS = { yeo: 514 / 542, gi: 474 / 545, yo: 561 / 520, bang: 190 / 552 };
const Burst: React.FC<{ t: number }> = ({ t }) => {
  const s0 = T.shout;
  const o = { x: 460, y: 1000, s: 60 };
  return (
    <>
      <Glyph t={t} id="yeo" aspect={AS.yeo} seed={1} keys={[{ at: s0 - 0.01, ...o }, { at: s0 + 0.04, x: 190, y: 500, s: 270, r: -7 }, { at: T.arrive, x: 190, y: 500, s: 270, r: -7 }, { at: T.more1 - 0.2, x: 165, y: 340, s: 200, r: -2 }, { at: T.more1 - 0.1, x: 165, y: 340, s: 200, r: -2 }]} />
      <Glyph t={t} id="gi" aspect={AS.gi} seed={2} keys={[{ at: s0 + 0.05, ...o }, { at: s0 + 0.1, x: 420, y: 480, s: 270, r: 4 }, { at: T.arrive, x: 420, y: 480, s: 270, r: 4 }, { at: T.more1 - 0.2, x: 350, y: 340, s: 200, r: 2 }, { at: T.more1 - 0.1, x: 350, y: 340, s: 200, r: 2 }]} />
      <Glyph t={t} id="yo" aspect={AS.yo} seed={3} keys={[{ at: s0 + 0.1, ...o }, { at: s0 + 0.16, x: 655, y: 510, s: 270, r: -3 }, { at: T.arrive, x: 655, y: 510, s: 270, r: -3 }, { at: T.more1 - 0.2, x: 790, y: 340, s: 200, r: -2 }, { at: T.more1 - 0.1, x: 790, y: 340, s: 200, r: -2 }]} />
      <Glyph t={t} id="bang" aspect={AS.bang} seed={4} keys={[{ at: s0 + 0.15, ...o }, { at: s0 + 0.21, x: 845, y: 500, s: 270, r: 8 }, { at: T.arrive - 0.02, x: 845, y: 500, s: 270, r: 8 }]} />
      {[T.more1, T.more2].map((m, j) => {
        const end = (j === 0 ? T.more2 : T.pile) - 0.04;
        const s = 190 + j * 40;
        const y = j === 0 ? 400 : 530;
        const dx = j === 0 ? 0 : -6;
        const row = [
          { id: 'yeo', x: 260 + dx, a: AS.yeo, d: 0 },
          { id: 'gi', x: 455 + dx, a: AS.gi, d: 0.04 },
          { id: 'yo', x: 655 + dx, a: AS.yo, d: 0.08 },
          { id: 'bang', x: 815 + dx, a: AS.bang, d: 0.12 },
        ];
        return row.map((g, i) => (
          <Glyph key={`${j}${i}`} t={t} id={g.id} aspect={g.a} seed={i + 5} keys={[{ at: m + g.d, x: 500, y: 1000, s: 40 }, { at: m + g.d + 0.03, x: g.x, y: y + (i % 2) * 18, s, r: (i % 2 ? 4 : -4) }, { at: end, x: g.x, y: y + (i % 2) * 18, s, r: (i % 2 ? 4 : -4) }]} />
        ));
      })}
    </>
  );
};

// 풀이 칸 — 여기 = here, 요 = polite. 뜻 표가 차례로 붙는다
const Meaning: React.FC<{ t: number; lang: Lang }> = ({ t, lang }) => {
  if (t < T.arrive + 0.15 || t >= T.more1) return null;
  const tag = (at: number, x: number, w: number, big: string, small: string) => {
    const a = pop(t, at);
    return (
      <div style={{ position: 'absolute', left: x - w / 2, top: 448, width: w, transform: `scale(${a}) rotate(-1deg)`, background: C.cream, borderRadius: 22, padding: '12px 10px 16px', boxSizing: 'border-box', boxShadow: '0 10px 20px rgba(50,18,6,0.4)', textAlign: 'center' }}>
        <div style={{ fontFamily: FONT[lang], fontWeight: 800, fontSize: TEXT[lang].tagSize, lineHeight: 1.12, color: C.shade }}>{big}</div>
        <div style={{ fontFamily: FONT.en, fontWeight: 600, fontSize: 40, lineHeight: 1.1, color: C.brown }}>{small}</div>
      </div>
    );
  };
  return (
    <>
      {tag(T.arrive + 0.18, 258, 330, `= ${TEXT[lang].here}`, ROMAN.here)}
      {t >= T.yo ? tag(T.yo, 748, 340, `= ${TEXT[lang].polite}`, ROMAN.yo) : null}
    </>
  );
};
const Top: React.FC<{ t: number; lang: Lang }> = ({ t, lang }) => {
  const L = TEXT[lang];
  if (t < T.pass1) return <Slip t={t} at={-1} lang={lang}>{L.hook}</Slip>;
  if (t < T.um) return <Slip t={t} at={T.pass1} lang={lang}>{L.wait}</Slip>;
  if (t >= T.left && t < T.auntie) return <Slip t={t} at={T.left} lang={lang}>{L.left}</Slip>;
  if (t >= T.auntie + 0.5 && t < T.word) return <Slip t={t} at={T.auntie + 0.5} lang={lang}>{L.then}</Slip>;
  if (t >= T.word && t < T.hush) {
    return (
      <Slip t={t} at={T.word} lang={lang} size={lang === 'mm' ? 52 : 58}>
        <span style={{ fontFamily: KO, fontWeight: 900, fontSize: 112, color: C.shade, lineHeight: 1.04 }}>여기요</span>
        {String.fromCharCode(10)}
        <span>{ROMAN.word}</span>
        {String.fromCharCode(10)}
        <span>{L.over}</span>
      </Slip>
    );
  }
  if (t >= T.more2 && t < T.pile) return <Slip t={t} at={T.more2} lang={lang}>{L.tooWell}</Slip>;
  return null;
};

// 끝 — 음식 산 위에 뜻 한 줄(카드 없이 장면 위에, 몽글 눈은 가리지 않는다)
const EndWord: React.FC<{ t: number; lang: Lang }> = ({ t, lang }) => {
  if (t < T.end + 0.35) return null;
  const a = pop(t, T.end + 0.35);
  return (
    <div style={{ position: 'absolute', left: 70, width: 840, top: 1240, textAlign: 'center' }}>
      <span style={{ display: 'inline-block', transform: `scale(${a}) rotate(-1deg)`, background: C.cream, borderRadius: 26, padding: '8px 32px 14px', boxShadow: '0 10px 22px rgba(50,18,6,0.45)', whiteSpace: 'nowrap' }}>
        <span style={{ fontFamily: KO, fontWeight: 900, fontSize: 74, lineHeight: 1.1, color: C.shade }}>여기요</span>
        <span style={{ fontFamily: FONT[lang], fontWeight: 800, fontSize: lang === 'mm' ? 38 : 46, lineHeight: 1.1, color: C.brown, marginLeft: 16 }}>= {TEXT[lang].endTag}</span>
      </span>
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
// 식당 소리와 음악은 숨을 들이켤 때 사그라져 정적 0.5초 — 외침 뒤에도 모두 얼어붙어 비어 있다가 달려올 때 돌아온다
const bedVol = (f: number) => {
  const t = f / 30;
  // 11-08 음악층 ⑲: 「소리가 다 멎는다(0.5초)」인데 바닥이 0인 채 달려올 때까지 1.8초 비었다(유호님 「중간중간 좀 빠져있는데」) — 정적은 외침 전 0.5초만, 외침 뒤엔 가게 소리 40%로 돌아오고 달려올 때 다 돌아온다
  return interpolate(t, [0, T.puff, T.hush - 0.05, T.shout + 0.05, T.shout + 0.35, T.rush1 - 0.05, T.rush1 + 0.2, T.pile, T.pile + 0.3, T.rush2, T.rush2 + 0.2, T.total - 0.4, T.total], [1, 1, 0, 0, 0.4, 0.4, 1, 1, 0.3, 0.3, 1, 1, 0], clamp);
};
const bgmVol = (f: number) => {
  const t = f / 30;
  const duck = interpolate(t, [T.hi, T.hi + 0.1, T.auntie - 0.1, T.auntie], [1, 0.75, 0.75, 1], clamp);
  return 0.13 * MASTER * bedVol(f) * duck;
};
const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('sfx/bgm.wav')} volume={bgmVol} />
    <Audio src={staticFile('sfx/room.wav')} volume={(f) => 0.17 * MASTER * bedVol(f)} />
    <Audio src={staticFile('sfx/sizzle.wav')} volume={(f) => 0.09 * MASTER * bedVol(f)} />
    <Sfx file="clink.wav" at={0.1} vol={0.2} />
    <Sfx file="clink2.wav" at={0.9} vol={0.14} />
    <Sfx file="step.wav" at={T.pass1 + 0.3} vol={0.4} />
    <Sfx file="whoosh.wav" at={T.pass1 + 0.8} vol={0.25} />
    <Sfx file="clink.wav" at={3.3} vol={0.14} />
    <Vo id="m1" at={T.um + 0.14} vol={0.95} />
    <Sfx file="whoosh.wav" at={T.pass2 + 0.04} vol={0.4} />
    <Sfx file="step.wav" at={T.pass2} vol={0.28} />
    <Vo id="m2" at={T.hi + 0.04} />
    <Sfx file="pop.wav" at={T.bow} vol={0.16} />
    <Vo id="w1" at={T.bow + 0.03} />
    <Sfx file="step.wav" at={T.leave + 0.1} vol={0.4} />
    <Vo id="a1" at={T.auntie + 0.04} />
    <Sfx file="pop.wav" at={T.auntie} vol={0.25} />
    <Sfx file="run.wav" at={T.rush0} vol={0.42} />
    <Vo id="s1" at={T.rush0 + 0.12} vol={0.8} />
    <Vo id="s2" at={T.rush0 + 0.34} vol={0.8} />
    <Sfx file="pop.wav" at={T.word} vol={0.2} />
    <Vo id="a2" at={T.word + 0.06} />
    <Sfx file="inhale.wav" at={T.hush - 1.42} vol={0.85} />
    <Vo id="y1b" at={T.shout} vol={1.25} />
    <Sfx file="boom.wav" at={T.shout - 0.01} vol={0.75} />
    <Sfx file="clink.wav" at={T.shout + 0.55} vol={0.3} />
    <Sfx file="clink2.wav" at={T.shout + 0.68} vol={0.26} />
    <Sfx file="snap.wav" at={T.turn} vol={0.75} />
    <Sfx file="run.wav" at={T.rush1 - 0.02} vol={0.55} />
    <Vo id="s1" at={T.rush1 + 0.06} />
    <Vo id="s2" at={T.rush1 + 0.12} />
    <Sfx file="stack.wav" at={T.arrive - 0.06} vol={0.42} />
    <Vo id="b1" at={T.arrive + 0.22} />
    <Vo id="b2" at={T.yo + 0.02} />
        <Vo id="y1c" at={T.more1 + 0.02} vol={1.1} />
    <Sfx file="stack.wav" at={T.more1 + 0.06} vol={0.5} />
    <Sfx file="whoosh.wav" at={T.more1 + 0.18} vol={0.3} />
    <Sfx file="run.wav" at={T.more1 + 0.1} vol={0.28} />
    <Vo id="y1c" at={T.more2 + 0.02} vol={1.15} />
    <Sfx file="stack.wav" at={T.more2 + 0.06} vol={0.6} />
    <Sfx file="whoosh.wav" at={T.more2 + 0.18} vol={0.3} />
    <Sfx file="pile.wav" at={T.pile - 0.04} vol={0.72} />
    <Vo id="y3" at={T.whisper + 0.04} vol={1.1} />
    <Sfx file="run.wav" at={T.rush2 - 0.05} vol={0.6} />
    <Vo id="s1" at={T.rush2 + 0.02} />
    <Vo id="s2" at={T.rush2 + 0.08} />
    <Sfx file="stack.wav" at={T.end - 0.05} vol={0.34} />
    <Vo id="w2" at={T.end + 0.08} />
    <Sfx file="clink2.wav" at={T.total - 0.42} vol={0.4} />
  </>
);

// 먼지 — 달려올 때 뒤로 날리는 펠트 부스러기
const Crumbs: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.shout || t >= T.turn) return null;
  const u = t - T.shout;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      {Array.from({ length: 34 }, (_, i) => {
        const a = random(`a${i}`) * Math.PI * 2;
        const v = 500 + random(`v${i}`) * 1100;
        const x = 460 + Math.cos(a) * v * u;
        const y = 1000 + Math.sin(a) * v * u + 700 * u * u;
        const r = 5 + random(`r${i}`) * 11;
        return <circle key={i} cx={x} cy={y} r={r} fill={i % 3 ? '#E8735F' : '#FFF3DD'} opacity={Math.max(0, 1 - u * 1.2)} />;
      })}
    </svg>
  );
};

export const Film: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const L = TEXT[lang];
  return (
    <AbsoluteFill style={{ background: '#2B1A14' }}>
      <Plate t={t}>
        <Waiters t={t} />
      </Plate>
      <Crumbs t={t} />
      <Bubble t={t} from={T.um + 0.1} until={T.hi} x={380} y={590} tail={0} size={72} sub={L.um} subFont={FONT[lang]} w={lang === 'mm' ? 620 : 560}>저… 저기…</Bubble>
      <Bubble t={t} from={T.hi} until={T.bow} x={380} y={600} tail={0} size={76} sub={L.hi} subFont={FONT[lang]} w={580}>안녕하세요?</Bubble>
      <Bubble t={t} from={T.bow + 0.02} until={T.leave + 0.25} x={470} y={530} tail={1} size={72} sub={L.hello} subFont={FONT[lang]} w={660}>네, 안녕하세요!</Bubble>
      <Bubble t={t} from={T.auntie + 0.02} until={T.auntie2} x={350} y={560} tail={1} size={120} w={500}>여기요!</Bubble>
      <Bubble t={t} from={T.rush1 + 0.06} until={T.arrive} x={760} y={800} tail={0} size={72} sub={L.yes} subFont={FONT[lang]} w={290}>네!</Bubble>
      <Bubble t={t} from={T.whisper + 0.1} until={T.rush2} x={480} y={1110} tail={0} size={84} w={420}>여기요…</Bubble>
      <Bubble t={t} from={T.end + 0.05} until={T.total + 1} x={BX} y={BY} tail={BT} size={70} sub={L.anything} subFont={FONT[lang]} w={700}>네! 또 뭐 드릴까요?</Bubble>
      <EndWord t={t} lang={lang} />
      <Top t={t} lang={lang} />
      <Burst t={t} />
      <Meaning t={t} lang={lang} />
      <Sound />
    </AbsoluteFill>
  );
};
