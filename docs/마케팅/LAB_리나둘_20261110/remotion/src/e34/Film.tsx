// LAB 영어 E34 「리나 둘」 — 아침 동네 펠트 카페 픽업대. 바리스타가 컵 하나를 들고 「리나 씨!」 → Rina와 Lina가 함께 벌떡 「저요!」 →
// 같은 컵을 양쪽에서 잡고 줄다리기, 가운데 앉아 있던 몽글이 눌려 굳는다(핵심 장면). Rina → 리나 · Lina → 리나, 한글에서 R · L은 한 글자 ㄹ.
// 바리스타가 「리나」 컵을 하나 더 — 둘 다 웃고, 몽글만 「내 커피는…?」. 「라이언!」 Ryan → 라이언 — 그런데 옆자리 사자도 「어흥! 저요!」(Lion → 라이언) →
// 끝은 Ryan과 사자가 같은 컵을 잡고 몽글이 또 눌린다(핵심 장면을 한 번 더) → 사자가 컵째 「꿀꺽!」, Ryan 손엔 빈 「라이언」 띠 + 「R · L 든 이름을 댓글로」.
// 장면은 GPT 이미지(구독 경로)로 구운 판(판/*.png, 지시문 판/*.txt) — 컵 · 이름표 글자는 장면과 한 장으로 구웠다. 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { FONT, KO, MONO, TEXT } from './data';
import { fr, T } from './timeline';

const C = { coral: '#C2452F', brown: '#3A2416', ink: '#2E211A', paper: '#FFFCF4', paperEdge: '#EDE4D3', mustard: '#C98A12', sage: '#5E7A55' };
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
const fadeIn = (t: number, at: number, d = 0.16) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: EASE_OUT });
const pop = (t: number, at: number, d = 0.22) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });

// 장면 — 시작 초 · 그림 · 다가갈 자리 · 시작/끝 크기. 박자 자리(원본 9.7 · 10.7 · 13.5 · 15.8)는 같은 그림을 확 당겨 구성을 바꾼다
type Shot = { at: number; img: string; cam: [number, number]; z0: number; z1: number };
const SHOTS: Shot[] = [
  { at: 0, img: 'call', cam: [540, 1100], z0: 1.0, z1: 1.06 },
  { at: T.stand, img: 'stand', cam: [540, 1150], z0: 1.04, z1: 1.09 },
  { at: T.grab, img: 'grab', cam: [520, 1300], z0: 1.0, z1: 1.06 },
  { at: T.close, img: 'grab', cam: [530, 1250], z0: 1.24, z1: 1.3 },
  { at: T.rush, img: 'grab', cam: [520, 1300], z0: 1.02, z1: 1.1 },
  // 컵 둘 — 바리스타가 「리나」 컵을 하나 더, 둘 다 웃는다 · 몽글만 컵이 없다
  { at: T.two, img: 'two_cups', cam: [540, 1100], z0: 1.0, z1: 1.04 },
  { at: T.twoIn, img: 'two_cups', cam: [540, 1100], z0: 1.45, z1: 1.5 },
  { at: T.mine, img: 'two_cups', cam: [524, 1430], z0: 1.6, z1: 1.68 },
  { at: T.ryan, img: 'ryan', cam: [470, 1100], z0: 1.0, z1: 1.04 },
  { at: T.ryanIn, img: 'ryan', cam: [300, 1250], z0: 1.34, z1: 1.38 },
  { at: T.lion, img: 'lion', cam: [620, 1100], z0: 1.04, z1: 1.08 },
  { at: T.lionIn, img: 'lion', cam: [800, 1150], z0: 1.36, z1: 1.42 },
  { at: T.tug2, img: 'grab_lion', cam: [520, 1300], z0: 1.06, z1: 1.0 },
  { at: T.gulp, img: 'gulp', cam: [600, 1000], z0: 1.04, z1: 1.09 },
];
const shotAt = (t: number) => {
  let k = 0;
  for (let i = 1; i < SHOTS.length; i++) if (t >= SHOTS[i].at) k = i;
  return k;
};
const PUNCH = [T.stand, T.grab, T.freeze, T.close, T.rush, T.two, T.ryan, T.lion, T.tug2, T.freeze2, T.gulp];

// 같은 그림의 한 자리만 따로 움직인다 — 숨 · 일어남 · 줄다리기 · 눌림 · 핏기 빠짐
const Patch: React.FC<{ img: string; cx: number; cy: number; rx: number; ry: number; sx?: number; sy?: number; dx?: number; dy?: number; rot?: number; ox?: number; oy?: number; filter?: string }> = ({ img, cx, cy, rx, ry, sx = 1, sy = 1, dx = 0, dy = 0, rot = 0, ox, oy, filter }) => {
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, black 74%, transparent 100%)`;
  return <Img src={staticFile(`img/${img}.jpg`)} style={{ ...FULL, WebkitMaskImage: mask, maskImage: mask, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${sx}, ${sy})`, transformOrigin: `${ox ?? cx}px ${oy ?? cy + ry * 0.85}px`, filter }} />;
};

// 줄다리기 — 0.26초마다 왼쪽(바탕 판) · 오른쪽(반대로 기운 판 _r, 구도를 맞춤)을 번갈아 홱 바꾼다(펠트 인형극처럼 끊어지는 박, 두 프레임 녹임)
const tugMix = (t: number, from: number) => {
  if (t < from) return 0;
  const step = t >= T.rush && t < T.two ? 0.16 : 0.26;
  const k = Math.floor((t - from) / step);
  // v4 모아 보기: 한 프레임 녹임도 정지 장면에서 두 겹으로 잡힌다 → 녹이지 않고 딱 끊어 바꾼다(스톱모션 인형극)
  return k % 2 === 0 ? 1 : 0;
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
  // 첫 2초 — 「리나 씨!」에 둘이 슬금슬금 일어난다
  const rise = s.img === 'call' ? interpolate(t, [T.rise, T.stand], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) }) : 0;
  // 벌떡 — 둘 다 튀어 오른다
  const hop = s.img === 'stand' ? -34 * Math.abs(Math.sin(Math.PI * Math.min(1, (t - T.stand) / 0.3))) * Math.max(0, 1 - (t - T.stand) / 0.6) : 0;
  // 줄다리기(가운데 컵 · 두 손 · 몽글 자리)
  const mix = s.img === 'grab' ? tugMix(t, T.grab + 0.14) : s.img === 'grab_lion' ? tugMix(t, T.tug2 + 0.14) : 0;
  const fz = (at: number) => interpolate(t, [at, at + 0.25], [0, 1], clamp);
  const f1 = s.img === 'grab' ? fz(T.freeze) : s.img === 'grab_lion' ? fz(T.freeze2) : 0;
  // 사자가 벌떡 — 위에서 떨어지듯 앉았다 선다
  const lionHop = s.img === 'lion' ? -70 * Math.max(0, 1 - (t - T.lion) / 0.28) : 0;
  const lionSquash = s.img === 'lion' ? interpolate(t, [T.lion + 0.2, T.lion + 0.32, T.lion + 0.55], [1, 0.92, 1], clamp) : 1;
  const cupW = (cx: number, cy: number) => (s.img === 'call' || s.img === 'stand' || s.img === 'ryan' || s.img === 'lion' ? <Patch img={s.img} cx={cx} cy={cy} rx={95} ry={120} rot={(s.img === 'call' ? 5 : 2.5) * Math.sin(t * (s.img === 'call' ? 7 : 5.2))} oy={cy + 140} /> : null);
  return (
    <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) scale(${z * (1 + 0.035 * punch)})`, transformOrigin: `${s.cam[0]}px ${s.cam[1]}px` }}>
      <Img src={staticFile(`img/${s.img}.jpg`)} style={FULL} />
      {s.img === 'call' ? <Patch img="call" cx={205} cy={1420} rx={210} ry={360} dy={-58 * rise} dx={14 * rise} sy={breath + 0.03 * rise} oy={1780} /> : null}
      {s.img === 'call' ? <Patch img="call" cx={865} cy={1420} rx={210} ry={360} dy={-58 * rise} dx={-14 * rise} sy={breath + 0.03 * rise} oy={1780} /> : null}
      {s.img === 'call' ? <Patch img="call" cx={530} cy={1450} rx={150} ry={130} sy={breath} sx={2 - breath} /> : null}
      {cupW(726, 740)}
      {s.img === 'stand' ? <Patch img="stand" cx={212} cy={1380} rx={210} ry={420} dy={hop} sy={breath} oy={1800} /> : null}
      {s.img === 'stand' ? <Patch img="stand" cx={862} cy={1380} rx={210} ry={420} dy={hop} sy={breath} oy={1800} /> : null}
      {s.img === 'grab' || s.img === 'grab_lion' ? <Img src={staticFile(`img/${s.img}_r.jpg`)} style={{ ...FULL, opacity: mix }} /> : null}
      {s.img.startsWith('grab') && f1 > 0 ? <div style={{ position: 'absolute', inset: 0, opacity: 0.45 * f1, background: 'radial-gradient(ellipse 210px 170px at 535px 1160px, rgba(205,232,255,0.85) 0%, rgba(205,232,255,0.3) 60%, transparent 100%)', mixBlendMode: 'screen' }} /> : null}
      {s.img === 'two_cups' ? <Patch img="two_cups" cx={537} cy={1450} rx={150} ry={130} sy={1 - 0.03 * Math.min(1, Math.max(0, t - T.mine) * 3)} sx={1 + 0.02 * Math.min(1, Math.max(0, t - T.mine) * 3)} oy={1560} filter={t >= T.mine ? 'saturate(0.8)' : undefined} /> : null}
      {s.img === 'ryan' ? <Patch img="ryan" cx={210} cy={1440} rx={200} ry={400} sy={breath} dy={t > T.ryanMe ? -10 * Math.abs(Math.sin((t - T.ryanMe) * 4.5)) : 0} oy={1800} /> : null}
      {s.img === 'ryan' ? <Patch img="ryan" cx={860} cy={1400} rx={220} ry={330} sy={breath} sx={2 - breath} /> : null}
      {s.img === 'lion' ? <Patch img="lion" cx={860} cy={1200} rx={260} ry={520} dy={lionHop} sy={lionSquash} sx={2 - lionSquash} oy={1640} /> : null}
      {s.img === 'gulp' ? <Patch img="gulp" cx={830} cy={1250} rx={260} ry={300} sx={1 + 0.05 * Math.max(0, Math.sin(Math.min(1, (t - T.gulp) / 0.5) * Math.PI))} sy={1 + 0.05 * Math.max(0, Math.sin(Math.min(1, (t - T.gulp) / 0.5) * Math.PI))} oy={1450} /> : null}
      {s.img === 'gulp' ? <div style={{ position: 'absolute', inset: 0, opacity: 0.45, background: 'radial-gradient(ellipse 210px 170px at 520px 1330px, rgba(205,232,255,0.85) 0%, rgba(205,232,255,0.3) 60%, transparent 100%)', mixBlendMode: 'screen' }} /> : null}
      {s.img === 'lion' ? <Patch img="lion" cx={530} cy={1450} rx={150} ry={130} sy={breath} sx={2 - breath} /> : null}
    </AbsoluteFill>
  );
};

// 머리 글 — 카페 주문 쪽지: 벽에 종이테이프 한 조각으로 붙은 손 뜯은 쪽지가 흔들린다(지난 두 편의 맨 위 띠 · 펠트 천과 다른 꼴, v2 haiku 9번)
// v8 GPT 미학 맹검 기각 「쇠막대 · 금색 집게 · 고른 톱니 · 짙은 그림자가 발표용 입체 도형 같다 · 두 줄이 같은 굵기라 기본 제목판」 →
// 막대 · 집게를 빼고 납작한 종이테이프, 가장자리는 고르지 않게 뜯긴 종이, 그림자는 옅게, 두 줄은 무게를 나눈다(emph: 힘줄 줄)
const Rail: React.FC<{ t: number; on: boolean }> = () => null;
const tornEdge = (seed: string) =>
  Array.from({ length: 29 }, (_, i) => `${(i * 100) / 28}% calc(100% - ${Math.round(2 + 9 * random(`${seed}-${i}`))}px)`)
    .reverse()
    .join(', ');
const Receipt: React.FC<{ t: number; at: number; until: number; top?: number; size?: number; children: React.ReactNode; w?: number; emph?: 'first' | 'last' }> = ({ t, at, until, top = 205, size = 66, children, w = 820, emph = 'last' }) => {
  if (t < at || t >= until) return null;
  const a = interpolate(t, [at, at + 0.28], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
  const swing = 2.2 * Math.exp(-(t - at) * 2.2) * Math.sin((t - at) * 9) + 0.5 * Math.sin(t * 1.7);
  const lines = typeof children === 'string' ? children.split('\n') : null;
  const body =
    lines && lines.length > 1 ? (
      lines.map((ln, i) => {
        const strong = emph === 'first' ? i === 0 : i === lines.length - 1;
        return (
          <div key={i} style={{ fontWeight: strong ? 800 : 600, fontSize: strong ? size * 1.08 : size * 0.74, color: strong ? C.ink : '#7A6656', marginTop: i === 0 ? 0 : 6 }}>
            {ln}
          </div>
        );
      })
    ) : (
      children
    );
  return (
    <div style={{ position: 'absolute', left: 540 - w / 2, width: w, top, transformOrigin: '50% 0%', transform: `translateY(${(1 - a) * -60}px) rotate(${swing - 0.8}deg)`, opacity: Math.min(1, a * 2), filter: 'drop-shadow(0 5px 7px rgba(60,34,16,0.2))' }}>
      <div style={{ position: 'absolute', left: w / 2 - 70, top: -22, width: 140, height: 44, background: 'rgba(214,190,150,0.82)', transform: 'rotate(-3deg)', zIndex: 2 }} />
      <div style={{ background: C.paper, clipPath: `polygon(0 0, 100% 0, ${tornEdge(`e${at}`)})`, padding: '42px 40px 46px', boxSizing: 'border-box', textAlign: 'center' }}>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: size, lineHeight: 1.16, color: C.ink, whiteSpace: 'pre-line' }}>{body}</div>
      </div>
    </div>
  );
};

// 말풍선(한글 + 영어 한 줄)
const Bubble: React.FC<{ t: number; from: number; until: number; x: number; y: number; tail: number; size?: number; sub?: string; children: React.ReactNode; w?: number }> = ({ t, from, until, x, y, tail, size = 76, sub, children, w = 520 }) => {
  if (t < from || t >= until) return null;
  const a = pop(t, from);
  const h = sub ? size * 2.2 : size * 1.7;
  const left = Math.min(Math.max(40, x - w / 2), 1040 - w);
  const tip = x + tail * 140 - left;
  return (
    <div style={{ position: 'absolute', left, top: y - h / 2, width: w, height: h, transform: `scale(${a})`, transformOrigin: `${(tip / w) * 100}% 100%` }}>
      <svg width={w} height={h + 52} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        {/* v8 GPT 미학 맹검 「굵은 빨간 테두리 · 길고 각진 꼬리가 표정보다 먼저 보인다」 → 테두리를 가늘게, 꼬리는 짧고 둥글게 */}
        <path d={`M ${tip - 44} ${h - 3} Q ${tip - 18} ${h + 12} ${tip} ${h + 30} Q ${tip - 10} ${h + 10} ${tip - 10} ${h - 3} Z`} fill={C.paper} stroke={C.coral} strokeWidth={3.5} strokeLinejoin="round" />
        <rect x={2} y={2} width={w - 4} height={h - 4} rx={Math.min(60, h / 2)} fill={C.paper} stroke={C.coral} strokeWidth={3.5} />
        <rect x={tip - 42} y={h - 8} width={30} height={8} fill={C.paper} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1.08, color: C.coral, whiteSpace: 'pre' }}>{children}</div>
        {sub ? <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: size * 0.56, lineHeight: 1.14, color: C.brown }}>{sub}</div> : null}
      </div>
    </div>
  );
};

// 이름 쪽지 — 컵에 붙이는 이름 스티커처럼 위에 영어 이름, 아래에 한글(비스듬히 붙는다)
// v8 GPT 미학 맹검 「기본 화살표 · 밑줄 · 둥근 상자 · 외곽 그림자가 교육용 카드 틀」 → 화살표 · 밑줄을 빼고 두 줄 스티커, 그림자는 옅게
const Chip: React.FC<{ t: number; at: number; until: number; x: number; y: number; en: string; ko: string; r?: number; size?: number; hi?: number[] }> = ({ t, at, until, x, y, en, ko, r = -3, size = 74, hi = [] }) => {
  if (t < at || t >= until) return null;
  const a = pop(t, at, 0.24);
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${a}) rotate(${r}deg)`, background: C.paper, borderRadius: 10, padding: '12px 34px 16px', boxShadow: '0 4px 8px rgba(60,34,16,0.2)', whiteSpace: 'nowrap', textAlign: 'center' }}>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: size * 0.58, lineHeight: 1.1, color: '#6A5646' }}>
        {en.split('').map((ch, i) => (
          <span key={i} style={{ color: hi.includes(i) ? C.coral : undefined, fontWeight: hi.includes(i) ? 900 : undefined }}>{ch}</span>
        ))}
      </div>
      <div style={{ fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1.08, color: C.coral }}>{ko}</div>
    </div>
  );
};

// 규칙 — R · L이 한 글자 ㄹ로 모인다(영수증 띠 안)
const Rule: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.rule || t >= T.rush) return null;
  const p = interpolate(t, [T.rule + 0.45, T.rule + 0.95], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const big = pop(t, T.rule + 0.95, 0.3);
  return (
    <Receipt t={t} at={T.rule} until={T.rush} size={58}>
      {TEXT.rule}
      <div style={{ position: 'relative', height: 190, marginTop: 6 }}>
        <span style={{ position: 'absolute', left: `${18 + 30 * p}%`, top: 20, transform: 'translateX(-50%)', fontFamily: FONT, fontWeight: 900, fontSize: 130, color: C.ink, opacity: 1 - big }}>R</span>
        <span style={{ position: 'absolute', left: `${82 - 30 * p}%`, top: 20, transform: 'translateX(-50%)', fontFamily: FONT, fontWeight: 900, fontSize: 130, color: C.ink, opacity: 1 - big }}>L</span>
        <span style={{ position: 'absolute', left: '50%', top: 0, transform: `translateX(-50%) scale(${big})`, fontFamily: KO, fontWeight: 900, fontSize: 170, color: C.coral }}>ㄹ</span>
      </div>
      <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 64, color: C.coral, opacity: big, marginTop: 4 }}>{TEXT.ruleSound}</div>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 40, color: '#6A5A4A', opacity: big }}>{TEXT.ruleSame}</div>
    </Receipt>
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
// 줄다리기 끼익 — 당길 때마다
const tugs = (from: number, until: number) => {
  const out: number[] = [];
  for (let x = from + 0.12; x < until - 0.1; x += 0.48) out.push(x);
  return out;
};
// 음악은 몽글이 굳는 순간만 반쯤 낮췄다가 바로 돌아온다(바탕 카페 소리는 그대로 — 음악층 ⑲)
const bgmVol = (f: number) => {
  const t = f / 30;
  const k = interpolate(t, [0, T.freeze - 0.05, T.freeze + 0.05, T.freeze + 0.45, T.freeze + 0.8, T.freeze2 - 0.05, T.freeze2 + 0.05, T.freeze2 + 0.45, T.freeze2 + 0.8, T.gulp - 0.05, T.gulp + 0.05, T.gulp + 0.6, T.gulp + 1.0, T.total - 0.5, T.total], [1, 1, 0.55, 0.55, 1, 1, 0.55, 0.55, 1, 1, 0.5, 0.5, 1, 1, 0], clamp);
  return 0.13 * MASTER * k;
};
const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('sfx/bgm.wav')} volume={bgmVol} />
    <Audio src={staticFile('sfx/cafe.wav')} volume={(f) => 0.2 * MASTER * interpolate(f / 30, [0, T.total - 0.4, T.total], [1, 1, 0], clamp)} />
    <Sfx file="bell.wav" at={0.05} vol={0.35} />
    <Vo id="b1" at={T.call} />
    <Sfx file="pop.wav" at={T.call} vol={0.18} />
    <Sfx file="chair.wav" at={T.rise + 0.2} vol={0.35} />
    <Sfx file="chair.wav" at={T.stand - 0.05} vol={0.4} />
    <Vo id="r1" at={T.me} vol={1.0} />
    <Vo id="l1" at={T.me + 0.05} vol={1.0} />
    <Sfx file="whoosh.wav" at={T.grab - 0.15} vol={0.3} />
    {tugs(T.grab, T.two).map((x, i) => <Sfx key={`a${i}`} file="tug.wav" at={x} vol={0.32} />)}
    <Sfx file="squish.wav" at={T.squish} vol={0.42} />
    <Sfx file="pop.wav" at={T.squish + 0.15} vol={0.16} />
    <Sfx file="freeze.wav" at={T.freeze} vol={0.5} />
    <Sfx file="pop.wav" at={T.chipR} vol={0.2} />
    <Sfx file="pop.wav" at={T.chipL} vol={0.2} />
    <Sfx file="paper.wav" at={T.rule} vol={0.4} />
    <Sfx file="pop.wav" at={T.rule + 0.95} vol={0.25} />
    <Sfx file="whoosh.wav" at={T.two - 0.15} vol={0.28} />
    <Sfx file="bell.wav" at={T.two + 0.05} vol={0.3} />
    <Sfx file="paper.wav" at={T.two + 0.2} vol={0.35} />
    <Sfx file="pop.wav" at={T.twoIn + 0.1} vol={0.2} />
    <Sfx file="deflate.wav" at={T.mine + 0.1} vol={0.4} />
    <Sfx file="pop.wav" at={T.mine + 0.15} vol={0.18} />
    <Sfx file="whoosh.wav" at={T.ryan - 0.15} vol={0.28} />
    <Sfx file="bell.wav" at={T.ryan} vol={0.3} />
    <Vo id="b3" at={T.ryan + 0.08} />
    <Sfx file="chair.wav" at={T.ryanMe - 0.1} vol={0.3} />
    <Vo id="y1" at={T.ryanMe} />
    <Sfx file="pop.wav" at={T.ryanIn + 0.1} vol={0.2} />
    <Sfx file="thump.wav" at={T.lion + 0.2} vol={0.55} />
    <Vo id="k1" at={T.lion + 0.05} vol={1.05} />
    <Sfx file="paper.wav" at={T.lionIn} vol={0.35} />
    <Sfx file="whoosh.wav" at={T.tug2 - 0.15} vol={0.3} />
    {tugs(T.tug2, T.gulp).map((x, i) => <Sfx key={`b${i}`} file="tug.wav" at={x} vol={0.3} />)}
    <Sfx file="gulp.wav" at={T.gulp + 0.02} vol={0.7} />
    <Sfx file="freeze.wav" at={T.gulp + 0.75} vol={0.45} />
    <Sfx file="squish.wav" at={T.squish2} vol={0.42} />
    <Sfx file="freeze.wav" at={T.freeze2} vol={0.5} />
    <Sfx file="paper.wav" at={T.ask} vol={0.35} />
  </>
);

// 장면 심사용(scene)에는 머리 글 · 풀이를 빼고 장면의 말 · 소리만 남긴다
export const Film: React.FC<{ scene?: boolean }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  return (
    <AbsoluteFill style={{ background: '#2B1A14' }}>
      <Plate t={t} />
      {/* 말풍선 — 바리스타는 위 가운데, 두 사람은 양쪽에서 */}
      <Bubble t={t} from={T.call} until={T.stand} x={300} y={660} tail={0.55} sub={TEXT.call1} w={440}>리나!</Bubble>
      <Bubble t={t} from={T.me} until={T.grab} x={250} y={880} tail={-0.2} size={70} sub={TEXT.meRina} w={360}>저요!</Bubble>
      <Bubble t={t} from={T.me + 0.05} until={T.grab} x={830} y={880} tail={0.2} size={70} sub={TEXT.meLina} w={360}>저요!</Bubble>
      <Bubble t={t} from={T.squish + 0.15} until={T.rule} x={540} y={850} tail={0} size={60} sub={TEXT.myCoffee} w={460}>내 커피…</Bubble>
      <Bubble t={t} from={T.mine + 0.15} until={T.ryan} x={537} y={1080} tail={0} size={62} sub={TEXT.mine} w={520}>내 커피는…?</Bubble>
      <Bubble t={t} from={T.gulp + 0.05} until={T.ask} x={720} y={690} tail={0.55} size={78} sub={TEXT.gulp} w={380}>꿀꺽!</Bubble>
      <Bubble t={t} from={T.ryan + 0.08} until={T.ryanMe} x={420} y={640} tail={0.6} sub={TEXT.call3} w={440}>라이언!</Bubble>
      <Bubble t={t} from={T.ryanMe} until={T.ryanIn} x={300} y={980} tail={-0.3} size={70} sub={TEXT.meRyan} w={370}>저요!</Bubble>
      <Bubble t={t} from={T.lion + 0.05} until={T.lionIn} x={760} y={640} tail={0.3} size={72} sub={TEXT.roar} w={480}>어흥! 저요!</Bubble>
      {!scene ? (
        <>
          <Rail t={t} on={t < T.grab || (t >= T.rule && t < T.rush) || (t >= T.two && t < T.mine) || (t >= T.ryan && t < T.tug2) || t >= T.ask} />
          <Receipt t={t} at={-1} until={T.stand} size={60} w={560}><span>{TEXT.ticket1} · </span><span style={{ fontFamily: KO, fontWeight: 900, color: C.coral, fontSize: 84 }}>리나</span></Receipt>
          <Receipt t={t} at={T.stand} until={T.grab} size={60} w={560}><span>{TEXT.ticket1} · </span><span style={{ fontFamily: KO, fontWeight: 900, color: C.coral, fontSize: 84 }}>리나</span><div style={{ fontSize: 62, marginTop: 4 }}>{TEXT.ticket2}</div></Receipt>
          {/* Rina → 리나 · Lina → 리나 */}
          <Chip t={t} at={T.chipR} until={T.rule} x={300} y={420} en="Rina" ko="리나" r={-4} hi={[0]} size={84} />
          <Chip t={t} at={T.chipL} until={T.rule} x={700} y={580} en="Lina" ko="리나" r={3} hi={[0]} size={84} />
          <Rule t={t} />
          <Receipt t={t} at={T.two + 0.15} until={T.mine} size={64}>{TEXT.twoCups}</Receipt>
          <Receipt t={t} at={T.ryan + 0.25} until={T.ryanIn} size={64}>{TEXT.qRyan}</Receipt>
          <Chip t={t} at={T.ryanIn + 0.1} until={T.lion} x={540} y={420} en="Ryan" ko="라이언" r={-3} hi={[0]} />
          <Receipt t={t} at={T.lionIn} until={T.tug2} size={64}>{TEXT.lionToo}</Receipt>
          <Chip t={t} at={T.lionIn + 0.3} until={T.tug2} x={540} y={600} en="Lion" ko="라이언" r={3} size={70} hi={[0]} />
          <Chip t={t} at={T.tug2 + 0.1} until={T.gulp} x={300} y={420} en="Ryan" ko="라이언" r={-4} hi={[0]} size={80} />
          <Chip t={t} at={T.tug2 + 0.45} until={T.gulp} x={700} y={580} en="Lion" ko="라이언" r={3} hi={[0]} size={80} />
          <Receipt t={t} at={T.ask} until={T.total + 1} size={60} emph="first">{TEXT.ask}</Receipt>
        </>
      ) : null}
      <Sound />
    </AbsoluteFill>
  );
};
