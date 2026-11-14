// LAB 영어 E38 「한 시간만요」 — 지쳐 축 처진 몽글이 만화카페에 들어가 계산대에서 「한 시간만요!」. 담요 · 만화가 있는 작은 방에서 스르르 녹아 잠든다.
// 벽시계 바늘이 세 바퀴(핵심 장면) → 커튼 사이로 직원 「손님, 연장하시겠어요?」 → 몽글 「아니요… 괜찮아요…」 하고도 꼼짝 않는다 — 끝은 잠든 몽글 위로 시계가 다시 돈다.
// 장면은 GPT 이미지(구독 경로)로 구운 판(판/*.png, 지시문 판/*.txt). 시계 바늘은 따로 구운 펠트 바늘(hand_*.png)을 바늘 없는 벽시계 가운데에 꽂아 돌린다.
// 화면 글은 판 · 상자 없이 위쪽 어두운 자리의 큰 글자 한 갈래, 말은 말한 이 곁의 글자. 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { FONT, KO, LOCS, TEXT, type Loc } from './data';
import { CLOCK, fr, T } from './timeline';
import clockData from '../../public/img/clock.json';

const C = { cream: '#FFF6E6', coral: '#FF8A75', mint: '#9FD8B4', dim: 'rgba(255,246,230,0.86)' };
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const FULL: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, objectFit: 'cover' };
const pop = (t: number, at: number, d = 0.22) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
const SHADOW = '0 3px 0 rgba(30,14,4,0.95), 0 0 12px rgba(24,10,2,0.95), 0 0 26px rgba(24,10,2,0.9), 0 6px 30px rgba(24,10,2,0.9)';
// 소리 나는 대로 적은 줄은 가늘어서 바탕이 붐비면 묻힌다 — 글자 바로 둘레에 짙은 그림자를 한 겹 더(올리기 전 검사 ⑤-2)
const SUBSHADOW = `0 0 4px rgba(20,8,2,1), 0 2px 3px rgba(20,8,2,1), ${SHADOW}`;

// 장면 — 시작 초 · 그림 · 다가갈 자리 · 시작/끝 크기 · 위 그늘 높이(방 그림은 시계를 가리지 않게 짧게)
type Shot = { at: number; img: string; cam: [number, number]; z0: number; z1: number; shade: number };
export const SHOTS: Shot[] = [
  { at: 0, img: 'door', cam: [420, 1300], z0: 1.0, z1: 1.05, shade: 900 },
  { at: T.cafe, img: 'door', cam: [600, 1150], z0: 1.14, z1: 1.24, shade: 900 },
  { at: T.bell, img: 'door', cam: [660, 1050], z0: 1.4, z1: 1.52, shade: 900 },
  { at: T.ask, img: 'counter', cam: [640, 1150], z0: 1.0, z1: 1.05, shade: 900 },
  { at: T.one, img: 'counter', cam: [300, 1460], z0: 1.3, z1: 1.4, shade: 900 },
  { at: T.room, img: 'enter', cam: [540, 1300], z0: 1.0, z1: 1.08, shade: 520 },
  { at: T.comic, img: 'comic', cam: [540, 1150], z0: 1.06, z1: 1.12, shade: 520 },
  { at: T.melt, img: 'sleep', cam: [540, 1000], z0: 1.12, z1: 1.03, shade: 520 },
  { at: T.spin, img: 'clock', cam: [540, 935], z0: 1.0, z1: 1.08, shade: 430 },
  { at: T.peek, img: 'peek', cam: [860, 760], z0: 1.3, z1: 1.36, shade: 520 }, // 말하는 직원 가까이
  { at: T.wake, img: 'peekwake', cam: [600, 300], z0: 1.1, z1: 1.14, shade: 520 }, // 위를 붙박고 당겨 벽시계를 위 글 아래로
  { at: T.back, img: 'peek', cam: [600, 300], z0: 1.14, z1: 1.16, shade: 520 },
  { at: T.shut, img: 'shut', cam: [600, 300], z0: 1.16, z1: 1.06, shade: 520 },
  { at: T.end, img: 'sleep', cam: [540, 600], z0: 1.34, z1: 1.4, shade: 520 }, // 끝은 시계와 잠든 몽글 가까이(시계를 크게 — 두 채널 이해 시험 1)
];
const shotAt = (t: number) => {
  let k = 0;
  for (let i = 1; i < SHOTS.length; i++) if (t >= SHOTS[i].at) k = i;
  return k;
};
const PUNCH = [T.sigh, T.ask, T.one, T.room, T.melt, T.spin, T.peek, T.back, T.end];

// 같은 그림의 한 자리만 따로 움직인다 — 몸을 늘이지 않고 자리 · 기울기만(펠트가 고무처럼 읽히지 않게)
const Patch: React.FC<{ img: string; cx: number; cy: number; rx: number; ry: number; dx?: number; dy?: number; rot?: number; op?: number }> = ({ img, cx, cy, rx, ry, dx = 0, dy = 0, rot = 0, op = 1 }) => {
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, black 72%, transparent 100%)`;
  return <Img src={staticFile(`img/${img}.jpg`)} style={{ ...FULL, opacity: op, WebkitMaskImage: mask, maskImage: mask, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, transformOrigin: `${cx}px ${cy + ry * 0.85}px` }} />;
};
const hop = (t: number, at: number, h: number, n = 1, d = 0.32) => {
  const u = (t - at) / d;
  return u < 0 || u > n ? 0 : -h * Math.abs(Math.sin(Math.PI * u));
};

// 시계 — 바늘 없는 벽시계 가운데에 펠트 바늘 둘을 꽂는다. 시각(시)은 t에 따라: 2시 → 세 바퀴 돌아 5시 → 끝에서 다시 돈다
const hourAt = (t: number) => {
  let h = CLOCK.startH - 0.04 + interpolate(t, [T.room, T.spin], [0, 0.04], clamp);
  h += CLOCK.turns * interpolate(t, [T.spin + 0.12, T.later], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  h += interpolate(t, [T.end + 0.35, T.total + 0.6], [0, 1.25], { ...clamp, easing: Easing.in(Easing.quad) });
  return h;
};
type ClockSpot = { x: number; y: number; r: number };
const SPOTS = (clockData as { 시계: Record<string, ClockSpot> }).시계;
const HANDS = (clockData as { 바늘: Record<string, { w: number; h: number; len: number }> }).바늘;
const Hand: React.FC<{ which: 'minute' | 'hour'; c: ClockSpot; deg: number; len: number; ghost?: number }> = ({ which, c, deg, len, ghost = 0 }) => {
  const H = HANDS[which];
  const s = len / H.len;
  const w = H.w * s;
  const h = H.h * s;
  const one = (d: number, op: number, k: number) => (
    <Img key={k} src={staticFile(`img/hand_${which}.png`)} style={{ position: 'absolute', left: c.x - w / 2, top: c.y - h / 2, width: w, height: h, opacity: op, transform: `rotate(${d}deg)`, transformOrigin: '50% 50%', filter: 'drop-shadow(0 3px 3px rgba(40,20,5,0.45))' }} />
  );
  // 빨리 돌 때는 지난 자리에 옅은 자국 셋(흐름 자국)
  return <>{[3, 2, 1].map((i) => (ghost > 0.5 ? one(deg - i * ghost, 0.16 * (4 - i) / 3, i) : null))}{one(deg, 1, 0)}</>;
};
const ClockHands: React.FC<{ img: string; t: number }> = ({ img, t }) => {
  const c = SPOTS[img];
  if (!c) return null;
  const h = hourAt(t);
  const dh = (hourAt(t + 1 / 30) - h) * 30; // 초당 시
  const mDeg = (h % 1) * 360;
  const hDeg = (h % 12) * 30;
  const ghost = 0 * dh; // 흐름 자국은 맹검이 「AI 보간 유령 바늘」로 읽어 뺐다
  return (
    <>
      <Hand which="hour" c={c} deg={hDeg} len={c.r * 0.5} ghost={ghost / 12} />
      <Hand which="minute" c={c} deg={mDeg} len={c.r * 0.78} ghost={ghost} />
      <div style={{ position: 'absolute', left: c.x - c.r * 0.07, top: c.y - c.r * 0.07, width: c.r * 0.14, height: c.r * 0.14, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #6b4426, #3a2010)' }} />
    </>
  );
};

// 졸음 Z — 몽글 머리 위에서 하나씩 피어올라 사라진다(잠든 장면에서만)
const Zzz: React.FC<{ t: number; x: number; y: number; from: number; until: number; size?: number }> = ({ t, x, y, from, until, size = 64 }) => {
  if (t < from || t >= until) return null;
  return (
    <>
      {[0, 1, 2].map((i) => {
        const u = ((t - from) / 1.8 + i / 3) % 1;
        const a = interpolate(u, [0, 0.15, 0.75, 1], [0, 1, 1, 0], clamp) * interpolate(t, [until - 0.3, until], [1, 0], clamp);
        return (
          <div key={i} style={{ position: 'absolute', left: x + u * 120, top: y - u * 210, fontFamily: FONT, fontWeight: 800, fontStyle: 'italic', fontSize: size * (0.7 + 0.5 * u), color: C.cream, opacity: a, textShadow: SHADOW }}>
            z
          </div>
        );
      })}
    </>
  );
};

const PlateImg: React.FC<{ img: string; t: number }> = ({ img, t }) => {
  let extra: React.ReactNode = null;
  if (img === 'door') {
    // 지친 몽글 — 훅에서 한 번 더 처지고, 종이 울리면 문 쪽으로 터덜터덜
    const sag = interpolate(t, [T.sigh, T.sigh + 0.5], [0, 14], { ...clamp, easing: EASE_OUT });
    const go = interpolate(t, [T.bell, T.ask], [0, 70], clamp);
    const step = t >= T.bell ? hop(t, T.bell + 0.1, 14, 3, 0.3) : 0;
    const rot = -2.5 * interpolate(t, [T.sigh, T.sigh + 0.5], [0, 1], clamp) + 1.4 * Math.sin(t * 1.7);
    extra = <Patch img="door" cx={385} cy={1460} rx={370} ry={300} dx={go} dy={sag + step} rot={rot} />;
  }
  if (img === 'counter') {
    const nod = t >= T.ask && t < T.ask + 1.2 ? 7 * Math.sin((t - T.ask) * 9) * Math.exp(-(t - T.ask) * 2) : 0;
    const say = hop(t, T.one + 0.05, 40, 2, 0.26);
    const sway = t < T.one ? 2 * Math.sin(t * 1.6) : 0;
    extra = (
      <>
        <Patch img="counter" cx={820} cy={900} rx={230} ry={330} dy={nod} />
        <Patch img="counter" cx={261} cy={1515} rx={235} ry={265} dy={say} rot={sway} />
      </>
    );
  }
  if (img === 'enter') {
    const go = interpolate(t, [T.room + 0.2, T.comic], [0, 1], clamp);
    extra = <Patch img="enter" cx={244} cy={1640} rx={260} ry={300} dx={60 * go} dy={-40 * go + hop(t, T.room + 0.25, 18, 3, 0.36)} rot={3 * go} />;
  }
  if (img === 'comic') {
    // 얼굴 위 만화책이 스르르 미끄러진다
    const slip = interpolate(t, [T.comic + 0.3, T.melt], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
    extra = <Patch img="comic" cx={600} cy={1240} rx={300} ry={170} dy={26 * slip} rot={4 * slip} />;
  }
  if (img === 'sleep' || img === 'wake') {
    // 숨 — 몸 전체가 아주 조금 오르내린다
    const br = 9 * Math.sin(t * 2.3);
    extra = <Patch img={img} cx={470} cy={1060} rx={440} ry={250} dy={br} />;
  }
  if (img === 'peek' || img === 'peekwake' || img === 'shut') {
    // 직원 — 커튼 사이로 몸을 쑥 들이밀고(peek), 말하는 동안 고개를 끄덕이고, 대답을 들은 뒤엔 그대로 기다리다가(peekwake),
    // 몽글이 다시 잠들면 잠깐 굳었다가 커튼을 끌며 물러난다(shut)
    const lean = interpolate(t, [T.peek - 0.05, T.peek + 0.4], [210, 0], { ...clamp, easing: EASE_OUT });
    const tilt = interpolate(t, [T.peek - 0.05, T.peek + 0.4, T.peek + 0.7], [-7, 2, 0], clamp);
    const talk = t >= T.peek + 0.25 && t < T.wake ? 8 * Math.sin((t - T.peek) * 7) : 0;
    // 말을 듣는 동안 몽글이 꿈틀(두 번) — 장면 심사 v2 「1.5~3.5초가 거의 멈춤」
    const stir = t >= T.peek + 0.9 && t < T.wake ? 3.5 * Math.sin((t - T.peek - 0.9) * 13) * Math.exp(-((t - T.peek - 0.9) % 0.8) * 4) : 0;
    const shake = t >= T.no && t < T.no + 1.0 ? 3.2 * Math.sin((t - T.no) * 16) * Math.exp(-(t - T.no) * 2.2) : 0; // 「아니요…」 고개 젓기
    const wait = t >= T.wake && t < T.back ? 7 * Math.sin((t - T.wake) * 4.5) : 0;
    const blink = t >= T.back && t < T.shut ? interpolate(t, [T.back, T.back + 0.12, T.back + 0.5], [0, -10, -6], clamp) : 0; // 다시 잠든 걸 보고 움찔
    const away = img === 'shut' ? interpolate(t, [T.shut, T.shut + 1.6], [0, 46], { ...clamp, easing: Easing.inOut(Easing.quad) }) : 0;
    extra = (
      <>
        <Patch img={img} cx={470} cy={1060} rx={440} ry={250} dy={9 * Math.sin(t * 2.3)} rot={stir + shake} />
        <Patch img={img} cx={860} cy={760} rx={210} ry={300} dx={lean + away} dy={talk + wait + blink} rot={tilt} />
      </>
    );
  }
  return (
    <>
      <Img src={staticFile(`img/${img}.jpg`)} style={FULL} />
      {extra}
      <ClockHands img={img} t={t} />
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
  const sx = 2.0 * Math.sin((2 * Math.PI * t) / 3.7);
  const sy = 1.6 * Math.sin((2 * Math.PI * t) / 4.6 + 1);
  const wrap: React.CSSProperties = { transform: `translate(${sx}px, ${sy}px) scale(${z * (1 + 0.03 * punch)})`, transformOrigin: `${s.cam[0]}px ${s.cam[1]}px` };
  // 녹아 잠듦(만화 → 잠) · 눈 뜸(잠 → 깸) · 다시 감김(깸 → 잠)은 같은 자리에서 겹쳐 바뀐다
  // 다시 잠듦(깸 → 잠)은 한 프레임에 탁 — 웃음 박자
  let over: React.ReactNode = null;
  // 커튼은 오른쪽에서 왼쪽으로 쓸려 들어온다 — 겹쳐 비치지 않게 닫힌 판을 오른쪽부터 드러낸다(장면 심사 v2 「반투명 이중 노출」)
  if (s.img === 'shut' && t < T.shut + 0.55) {
    const edge = interpolate(t, [T.shut, T.shut + 0.55], [1080, 560], { ...clamp, easing: Easing.out(Easing.cubic) });
    const m = `linear-gradient(to right, black 0px, black ${edge - 30}px, transparent ${edge + 30}px)`;
    over = <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: m, maskImage: m }}><PlateImg img="peek" t={t} /></div>;
  }
  const wakeIn = s.img === 'peekwake' && t < T.wake + 0.3 ? <div style={{ opacity: interpolate(t, [T.wake + 0.05, T.wake + 0.3], [1, 0], clamp) }}><PlateImg img="peek" t={t} /></div> : null;
  return (
    <AbsoluteFill style={wrap}>
      <PlateImg img={s.img} t={t} />
      {wakeIn}
      {over}
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
const Title: React.FC<{ t: number; at: number; until: number; small?: string; big: string; size?: number; top?: number; note?: string; noteAt?: number; hl?: string; font?: string; k?: number; nk?: number; sk?: number }> = ({ t, at, until, small, big, size = 96, top = 200, note, noteAt, hl, font = FONT, k = 1, nk = 1, sk = 1 }) => {
  if (t < at || t >= until) return null;
  const a = interpolate(t, [at, at + 0.2], [0, 1], { ...clamp, easing: EASE_OUT });
  const na = note ? interpolate(t, [noteAt ?? at, (noteAt ?? at) + 0.2], [0, 1], { ...clamp, easing: EASE_OUT }) : 0;
  return (
    <div style={{ position: 'absolute', left: 90, width: 820, top, textAlign: 'center', opacity: a, transform: `translateY(${(1 - a) * 18}px)`, textShadow: SHADOW }}>
      {small ? <div style={{ fontFamily: font, fontWeight: 600, fontSize: 50 * k * sk, lineHeight: 1.2, color: C.dim, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{mix(small)}</div> : null}
      {big ? <div style={{ fontFamily: font, fontWeight: 800, fontSize: size * k, lineHeight: 1.12, color: C.cream, marginTop: small ? 22 : 0, whiteSpace: 'pre-line' }}>{mix(big, hl)}</div> : null}
      {note ? <div style={{ fontFamily: font, fontWeight: 600, fontSize: 58 * k * nk, lineHeight: 1.2, color: C.dim, marginTop: 14, opacity: na, whiteSpace: 'pre-line', textShadow: SUBSHADOW }}>{mix(note)}</div> : null}
    </div>
  );
};

// 말 — 말한 이 곁에 글자만(상자 · 테두리 없음)
const Say: React.FC<{ t: number; from: number; until: number; x: number; y: number; ko: string; sub?: string; mean?: string; meanAt?: number; size?: number; rot?: number; shake?: boolean; color?: string; font?: string; k?: number; nk?: number; subLatin?: boolean }> = ({ t, from, until, x, y, ko, sub, mean, meanAt = 0, size = 118, rot = -5, shake, color = C.cream, font = FONT, k = 1, nk = 1, subLatin = true }) => {
  if (t < from || t >= until) return null;
  const a = pop(t, from);
  const j = shake ? 3 * Math.sin(t * 40) * Math.exp(-(t - from) * 3) : 0;
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, 0) rotate(${rot + j}deg) scale(${a})`, transformOrigin: '50% 30%', textAlign: 'center', whiteSpace: 'nowrap', textShadow: SHADOW }}>
      <div style={{ fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1.05, color }}>{ko}</div>
      {sub ? <div style={{ fontFamily: subLatin ? FONT : font, fontWeight: 700, fontSize: Math.max(54, size * 0.5) * (subLatin ? 1 : k * nk), lineHeight: 1.25, color: C.dim, fontStyle: subLatin ? 'italic' : 'normal', marginTop: 6, textShadow: SUBSHADOW, whiteSpace: 'pre' }}>{sub}</div> : null}
      {mean && t >= meanAt ? <div style={{ fontFamily: font, fontWeight: 800, fontSize: 62 * k * nk, lineHeight: 1.2, color: C.cream, marginTop: 10, opacity: interpolate(t, [meanAt, meanAt + 0.2], [0, 1], clamp) }}>{mean}</div> : null}
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
// 음악은 잠든 동안 조금만 낮춘다(−4dB 안팎 — 그 밑에 방 공기 · 째깍 소리가 깔려 있다, 음악층 ⑲)
const bgmVol = (f: number) => {
  const t = f / 30;
  const k = interpolate(t, [0, T.melt, T.melt + 0.5, T.later, T.later + 0.4, T.total - 0.6, T.total], [1, 1, 0.66, 0.66, 0.85, 0.85, 0], clamp);
  return 0.14 * MASTER * k;
};
// 방 안 째깍 — 1초마다(빨리 도는 동안 · 끝에서 다시 도는 동안은 spin 소리가 맡는다)
const TICKS: number[] = [];
for (let s = T.room + 0.3; s < T.total - 0.2; s += 1.0) {
  if ((s > T.spin - 0.1 && s < T.later + 0.3) || s > T.end + 0.3) continue;
  TICKS.push(Math.round(s * 100) / 100);
}
const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('sfx/bgm.wav')} volume={bgmVol} />
    <Audio src={staticFile('sfx/street.wav')} volume={(f) => 0.32 * MASTER * interpolate(f / 30, [0, T.bell + 0.4, T.ask], [1, 1, 0], clamp)} />
    <Sequence from={fr(T.bell)} layout="none">
      <Audio src={staticFile('sfx/room.wav')} volume={(f) => 0.3 * MASTER * interpolate(f / 30 + T.bell, [T.bell, T.ask, T.total - 0.5, T.total], [0, 1, 1, 0], clamp)} />
    </Sequence>
    <Sfx file="sigh.wav" at={T.sigh} vol={0.4} />
    <Sfx file="whoosh.wav" at={T.cafe - 0.12} vol={0.22} />
    <Sfx file="pop.wav" at={T.cafe + 0.05} vol={0.22} />
    <Sfx file="steps.wav" at={T.bell + 0.05} vol={0.35} />
    <Sfx file="bell.wav" at={T.bell + 0.4} vol={0.5} />
    <Vo id="s1" at={T.ask + 0.15} />
    <Vo id="m1" at={T.one + 0.05} vol={1.05} />
    <Sfx file="boing.wav" at={T.one + 0.08} vol={0.3} />
    <Sfx file="ding.wav" at={T.learn} vol={0.35} />
    <Sfx file="whoosh.wav" at={T.room - 0.15} vol={0.25} />
    <Sfx file="steps.wav" at={T.room + 0.25} vol={0.3} />
    <Sfx file="page.wav" at={T.comic + 0.2} vol={0.4} />
    <Sfx file="squish.wav" at={T.melt} vol={0.45} />
    <Sfx file="snore.wav" at={T.melt + 0.3} vol={0.32} />
    <Sfx file="spin.wav" at={T.spin + 0.1} vol={0.45} />
    <Sfx file="pop.wav" at={T.later} vol={0.2} />
    <Sfx file="curtain.wav" at={T.peek - 0.08} vol={0.5} />
    <Vo id="s2" at={T.peek + 0.25} />
    <Sfx file="blink.wav" at={T.wake + 0.05} vol={0.35} />
    <Vo id="m2" at={T.no + 0.05} vol={1.05} />
    <Sfx file="squish.wav" at={T.back} vol={0.45} />
    <Sfx file="snore.wav" at={T.back + 0.12} vol={0.36} />
    <Sfx file="ding.wav" at={T.no + 0.3} vol={0.24} />
    <Sfx file="curtain.wav" at={T.shut + 0.1} vol={0.45} />
    <Sfx file="spin2.wav" at={T.end + 0.35} vol={0.38} />
    {TICKS.map((s) => (
      <Sfx key={s} file="tick.wav" at={s} vol={0.15} />
    ))}
  </>
);

// 장면 심사용(scene)에는 화면 글을 빼고 장면의 말 · 소리만 남긴다
export const Film: React.FC<{ scene?: boolean; loc?: Loc }> = ({ scene, loc = 'en' }) => {
  const L = LOCS[loc];
  const lat = loc === 'en';
  const frame = useCurrentFrame();
  const t = frame / 30;
  const s = SHOTS[shotAt(t)];
  return (
    <AbsoluteFill style={{ background: '#1E1208' }}>
      <Plate t={t} />
      {/* 위쪽을 살짝 어둡게 — 글자가 놓일 자리(상자가 아니라 빛). 방 그림은 벽시계를 가리지 않게 짧게 */}
      {!scene ? <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: s.shade, background: 'linear-gradient(to bottom, rgba(28,14,4,0.92) 0%, rgba(28,14,4,0.85) 45%, rgba(28,14,4,0.5) 75%, rgba(28,14,4,0) 100%)' }} /> : null}
      <Zzz t={t} x={480} y={790} from={T.melt + 0.4} until={T.spin} />
      <Zzz t={t} x={650} y={960} from={T.back + 0.05} until={T.end} />
      <Zzz t={t} x={780} y={1010} from={T.end + 0.1} until={T.total + 1} />
      <Say t={t} from={T.ask + 0.15} until={T.one} x={600} y={485} ko="몇 시간 하실 거예요?" sub={L.askRead} subLatin={lat} font={L.font} k={L.k} nk={L.nk} size={78} rot={-3} />
      <Say t={t} from={T.one + 0.05} until={T.room} x={440} y={835} ko="한 시간만요!" sub={TEXT.oneRead} mean={L.learnNote} meanAt={T.learn} font={L.font} k={L.k} nk={L.nk} size={124} rot={-4} shake color={C.mint} />
      <Say t={t} from={T.peek + 0.25} until={T.wake} x={460} y={278} ko="손님, 연장하시겠어요?" sub={L.peekRead} subLatin={lat} font={L.font} k={L.k} nk={L.nk} size={74} rot={-2} />
      <Say t={t} from={T.no + 0.05} until={T.shut} x={500} y={278} ko="아니요… 괜찮아요…" sub={TEXT.noRead} mean={L.learn2Note} meanAt={T.no + 0.3} font={L.font} k={L.k} nk={L.nk} size={92} rot={-3} color={C.mint} />
      {!scene ? (
        <>
          <Title t={t} at={-1} until={T.cafe} big={L.hook} size={84} top={300} font={L.font} k={L.k} />
          <Title t={t} at={T.cafe} until={T.ask} small={L.cafeSmall} big={L.cafe} size={104} top={290} note={L.cafeNote} font={L.font} k={L.k} nk={L.nk} sk={L.sk} noteAt={T.cafe + 0.3} />
          <Title t={t} at={T.room} until={T.melt} big={L.room} size={78} top={290} font={L.font} k={L.k} />
          <Title t={t} at={T.melt + 0.3} until={T.spin} big={L.melt} size={80} top={290} font={L.font} k={L.k} />
          <Title t={t} at={T.spin + 0.42} until={T.peek} big={L.later} size={86} top={290} font={L.font} k={L.k} />
          {/* 거절하고 왜 계속 자는지(두 채널 이해 시험 1 — 간체 s · h · G, 버마어 s · h · G) — 커튼이 닫힐 때 한 줄 */}
          <Title t={t} at={T.shut + 0.05} until={T.end} big={L.back} size={80} top={290} font={L.font} k={L.k} />
          <Title t={t} at={T.end + 0.5} until={T.total + 1} small={L.endSmall} big={L.endBig} size={80} top={285} font={L.font} k={L.k} sk={L.sk} />
        </>
      ) : null}
      <Sound />
    </AbsoluteFill>
  );
};
