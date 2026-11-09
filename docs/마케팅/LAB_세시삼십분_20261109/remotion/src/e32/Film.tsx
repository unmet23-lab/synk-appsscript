// LAB 영어 E32 「세 시 삼십 분」 — 몽글이 벽시계를 「삼 시 삼십 분…?」으로 읽자 짧은 바늘이 튀어나와 「세 시!」, 고쳐 읽은 「서른 분?」에 긴 바늘이 「삼십 분!」.
// 둘이 곡의 박에 맞춰 점점 크게 「세!」 「삼십!」 우기다 머리가 부딪치고 몽글이 밀려난다(핵심 장면). 둘 다 맞다 — 한국어엔 숫자가 두 벌.
// 풀이는 바늘이 직접 돈다 — 한 시 · 두 시 · 세 시 / 십 분 · 이십 분 · 삼십 분. 끝은 10:15: 떨면서 맞힌 몽글이 이번엔 바늘보다 크게 외치고 바늘이 움찔한다(핵심 장면을 뒤집어 끝 3초에 다시).
// 방 · 몽글은 GPT 이미지(구독 경로)로 장면과 한 장으로 구운 판(판/*.png), 바늘 몸통 · 머리는 따로 구워 오린 조각이라 축을 중심으로 실제로 돈다. 머리는 늘 똑바로 선다. 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { FONT, Lang, ROMAN, TEXT } from './data';
import { FIGHT_BEATS, fr, T } from './timeline';

const C = { hour: '#D2590A', minute: '#1673B0', brown: '#3A2416', cream: '#FFF8EA', coral: '#B83C28', wood: '#5B3A22', woodDark: '#432915' };
const FELT = '#F6E0BC'; // 크림 천 그림의 평균 색 — 꼬리 · 그림이 뜨기 전 바탕
const KO = "'SUIT', 'Inter Tight', sans-serif";
// 말줄임표는 로마자 줄과 같은 꼴로(아르곤 맹검 v14 — 한글 줄 ⋯ · 로마자 줄 ... 이 섞여 보임)
const El: React.FC = () => <span style={{ fontFamily: FONT.en }}>…</span>;
const MASTER = 0.8;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
const fadeIn = (t: number, at: number, d = 0.16) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: EASE_OUT });
const pop = (t: number, at: number, d = 0.2) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });

// 시계 자리(1080×1920 판 기준) · 축 값은 소리/그림옮기기.py가 잰 hands.json
const CLOCK = { x: 545, y: 817 };
const BODY = {
  hour: { file: 'hourBody', w: 547, h: 1534, px: 272.4, py: 1357.6, scale: 0.2 },
  minute: { file: 'minuteBody', w: 164, h: 1641, px: 81.5, py: 1557.3, scale: 0.222 },
};
// 머리 — 늘 똑바로 선다(바늘이 돌아도 얼굴이 눕지 않게). d = 축에서 머리까지 · w = 화면 너비(1배 기준)
const HEAD = {
  hour: { d: 140, w: 152, dir: [-30, 24] as const },
  minute: { d: 184, w: 130, dir: [26, -28] as const },
};
const HEADSIZE = { hour: { w: 1, h: 1 }, minute: { w: 1, h: 1 } };
type Face = 'Calm' | 'Shout' | 'Cheer' | 'Gasp';

// 카메라 — 넓게 / 다툼 때 가까이(시계가 화면을 채우고 몽글은 왼쪽 아래) / 끝에 몽글 가까이
// 넓은 구도는 판 위쪽을 기준으로 키운다 — 시계 위 테두리가 머리 팻말 아래로 내려와 팻말이 시계를 덮지 않는다(아르곤 맹검 v14 [K1])
const WIDE = { x: 540, y: 0, z: 1.11 };
const MID = { x: 540, y: 0, z: 1.15 };
const NEAR = { x: 440, y: 1180, z: 1.32 }; // 몽글이 왼쪽 아래에 보이게
const RULE = { x: 542, y: 0, z: 1.2 }; // 풀이 — 시계 가운데 (546, 980), 위 테두리 476이 두 줄 팻말 아래에 온다
const RULE2 = { x: 542, y: 76, z: 1.22 }; // 긴 바늘 차례 — 시계를 조금 더 크게(가운데는 그대로 980)
const MONGLE = { x: 300, y: 1450, z: 1.6 }; // 떨면서 맞히는 몽글 — 바늘은 위에서 내려다본다
const ENDCAM = { x: 500, y: 470, z: 1.15 }; // 시계 위 386 · 아래 1352, 몽글 왼쪽 아래 — 한 줄 팻말이 시계를 안 덮는다
const ENDSUM = { x: 500, y: 0, z: 1.184 }; // 끝 줄(두 줄 팻말) — 시계가 팻말 밑으로 내려온다
type Cam = { x: number; y: number; z: number };
const lerpCam = (a: Cam, b: Cam, p: number): Cam => ({ x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, z: a.z + (b.z - a.z) * p });
const camAt = (t: number): Cam => {
  const ease = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  if (t < T.seoreun) return lerpCam(WIDE, MID, interpolate(t, [0, T.seoreun], [0, 1], clamp));
  if (t < T.fight) return lerpCam(MID, NEAR, interpolate(t, [T.seoreun, T.seoreun + 0.45], [0, 1], ease));
  if (t < T.ruleH) return { ...NEAR, z: interpolate(t, [T.fight, T.clash, T.clash + 0.3, T.ruleH], [1.32, 1.46, 1.38, 1.34], clamp) };
  if (t < T.ruleM) return lerpCam({ ...NEAR, z: 1.34 }, RULE, interpolate(t, [T.ruleH, T.ruleH + 0.35], [0, 1], ease));
  if (t < T.both) return RULE2;
  if (t < T.spinEnd) return lerpCam(RULE2, WIDE, interpolate(t, [T.both, T.both + 0.4], [0, 1], ease));
  if (t < T.cut) return lerpCam(WIDE, MONGLE, interpolate(t, [T.spinEnd, T.spinEnd + 0.48], [0, 1], ease));
  const yellCam = { ...ENDCAM, z: interpolate(t, [T.yell, T.yell + 0.08, T.yell + 0.5], [1.15, 1.25, 1.18], clamp) };
  if (t < T.sum) return yellCam;
  return lerpCam(yellCam, ENDSUM, interpolate(t, [T.sum, T.sum + 0.35], [0, 1], ease));
};

// 박마다 살짝 찌르는 크기(화면 전체)
const PUNCH = [T.hour1, T.min1, ...FIGHT_BEATS.map((b) => b.at), T.h3, T.m3, T.say, T.ding, T.small, T.ding2, T.yell, T.end];

// 튀는 값 — at에 1로 튀었다가 흔들리며 잦아든다
const kick = (t: number, at: number, decay = 5, freq = 24) => (t < at ? 0 : Math.exp(-(t - at) * decay) * Math.cos((t - at) * freq));
const hitIn = (d: number) => (d < 0.05 ? d / 0.05 : 1);

// 몽글이 외치면 바늘이 위로 밀려 움찔한 채 떨다가, 끝 박에 얌전히 10:15로 돌아온다
const blow = (t: number) => interpolate(t, [T.yell, T.yell + 0.1, T.end - 0.05, T.end + 0.14], [0, 1, 1, 0], { ...clamp, easing: EASE_OUT });

// 짧은 바늘 각도(12시 = 0, 시계 방향)
const hourAngle = (t: number) => {
  const A = 105; // 3:30
  if (t < T.swingH) {
    let a = A;
    if (t >= T.twitch && t < T.hour1) a += interpolate(t, [T.twitch, T.hour1], [1.5, 7], clamp) * Math.sin((t - T.twitch) * 52); // 「삼 시」에 움찔 → 점점 부르르
    a += 13 * kick(t, T.hour1, 4.5, 22);
    for (const b of FIGHT_BEATS) {
      if (t < b.at) continue;
      const d = t - b.at;
      // 내 차례엔 긴 바늘 쪽(시계 방향)으로 찌르고, 상대 차례엔 움찔 물러난다. 둘이 한꺼번에면 맞붙는다
      if (b.who === 'h') a += 15 * b.power * Math.exp(-d * 7.5) * hitIn(d);
      else if (b.who === 'm') a -= 5 * b.power * Math.exp(-d * 8) * hitIn(d);
      else a += 30 * Math.exp(-d * 4) * hitIn(d);
    }
    if (t >= T.who) a += 3 * Math.sin((t - T.who) * 5); // 씩씩
    return a;
  }
  if (t < T.h1) return interpolate(t, [T.swingH, T.swingH + 0.3], [A, 0], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const step = (at: number, from: number, to: number) => interpolate(t, [at, at + 0.14], [from, to], { ...clamp, easing: Easing.out(Easing.back(2.6)) });
  if (t < T.h2) return step(T.h1, 0, 30);
  if (t < T.h3) return step(T.h2, 30, 60);
  if (t < T.ruleM) return step(T.h3, 60, 90);
  if (t < T.spin) return interpolate(t, [T.ruleM, T.ruleM + 0.5], [90, A], { ...clamp, easing: Easing.inOut(Easing.cubic) }) + 3 * kick(t, T.ding, 4, 16) + 16 * Math.max(kick(t, T.bump, 5, 16), 0);
  if (t < T.spinEnd) return interpolate(t, [T.spin, T.spinEnd], [A, 307.5], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const bl = blow(t);
  return 307.5 + 6 * kick(t, T.ding2, 4, 16) + 11 * bl + 2.2 * bl * Math.sin(t * 58);
};

// 긴 바늘 각도
const minuteAngle = (t: number) => {
  const A = 180; // 30분
  if (t < T.ruleM) {
    let a = A;
    if (t >= T.seoreun && t < T.min1) a += 1.6 * Math.sin((t - T.seoreun) * 60) * interpolate(t, [T.seoreun, T.min1], [0, 1], clamp);
    a -= 10 * kick(t, T.min1, 4.5, 22);
    for (const b of FIGHT_BEATS) {
      if (t < b.at) continue;
      const d = t - b.at;
      if (b.who === 'm') a -= 15 * b.power * Math.exp(-d * 7.5) * hitIn(d);
      else if (b.who === 'h') a += 5 * b.power * Math.exp(-d * 8) * hitIn(d);
      else a -= 30 * Math.exp(-d * 4) * hitIn(d);
    }
    if (t >= T.who) a -= 3 * Math.sin((t - T.who) * 5);
    return a;
  }
  if (t < T.m1) return interpolate(t, [T.ruleM, T.ruleM + 0.22], [A, 360], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const step = (at: number, from: number, to: number) => interpolate(t, [at, at + 0.14], [from, to], { ...clamp, easing: Easing.out(Easing.back(2.6)) });
  if (t < T.m2) return step(T.m1, 360, 420);
  if (t < T.m3) return step(T.m2, 420, 480);
  if (t < T.spin) return step(T.m3, 480, 540) + 3 * kick(t, T.ding, 4, 16);
  if (t < T.spinEnd) return interpolate(t, [T.spin, T.spinEnd], [540, 540 + 360 * 6.75], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const bl = blow(t);
  return 450 + 6 * kick(t, T.ding2 + 0.05, 4, 16) - 11 * bl + 2.2 * bl * Math.sin(t * 61);
};

// 지금 머리 얼굴 — 우길 땐 외침, 풀이 · 맞을 땐 환호, 몽글이 외치면 움찔
const hourFace = (t: number): Face => {
  if (t >= T.hour1 && t < T.try2) return 'Shout';
  if (t >= T.fight && t < T.swingH) return 'Shout';
  if (t >= T.h1 && t < T.ruleM) return 'Cheer';
  if (t >= T.bump && t < T.bump + 0.5) return 'Shout'; // 치고 지나가자 버럭
  if (t >= T.ding && t < T.spin) return 'Cheer';
  if (t >= T.yell) return 'Gasp';
  if (t >= T.ding2) return 'Cheer';
  return 'Calm'; // 10:15로 돈 뒤엔 소리치지 않고 내려다본다(GPT 「맞게 말했는데 왜 또 화내나」)
};
const minuteFace = (t: number): Face => {
  if (t >= T.min1 && t < T.ruleM) return 'Shout';
  if (t >= T.m1 && t < T.both) return 'Cheer';
  if (t >= T.ding && t < T.spin) return 'Cheer';
  if (t >= T.yell) return 'Gasp';
  if (t >= T.ding2) return 'Cheer';
  return 'Calm';
};

// 말할 때 몸이 부푼다
const swell = (t: number, who: 'h' | 'm') => {
  let k = 0;
  const hit = (at: number, big = 1) => {
    if (t >= at) k = Math.max(k, big * Math.exp(-(t - at) * 5.5));
  };
  if (who === 'h') {
    if (t >= T.twitch && t < T.hour1) k = Math.max(k, interpolate(t, [T.twitch, T.hour1], [0.08, 0.42], clamp) * (0.75 + 0.25 * Math.sin(t * 19)));
    hit(T.hour1, 1.25);
    [T.h1, T.h2, T.h3].forEach((b) => hit(b, 0.6));
  } else {
    hit(T.min1, 1.25);
    [T.m1, T.m2, T.m3].forEach((b) => hit(b, 0.6));
  }
  for (const b of FIGHT_BEATS) if (b.who === who || b.who === 'b') hit(b.at, b.power);
  hit(T.ding2, 0.7);
  return k;
};

const Hand: React.FC<{ who: 'hour' | 'minute'; angle: number; sw: number }> = ({ who, angle, sw }) => {
  const b = BODY[who];
  const W = b.w * b.scale;
  const H = b.h * b.scale;
  const ox = b.px * b.scale;
  const oy = b.py * b.scale;
  return (
    <Img
      src={staticFile(`img/${b.file}.webp`)}
      style={{
        position: 'absolute',
        left: CLOCK.x - ox,
        top: CLOCK.y - oy,
        width: W,
        height: H,
        transformOrigin: `${ox}px ${oy}px`,
        // 긴 바늘은 몸통을 조금 굵게 — 화살촉이 납작한 선처럼 보인다(아르곤 맹검 v15)
        transform: `rotate(${angle}deg) scale(${(who === 'minute' ? 1.38 : 1) * (1 + 0.12 * sw)}, ${1 + 0.06 * sw})`,
        filter: 'drop-shadow(5px 9px 6px rgba(60,30,8,0.42))',
      }}
    />
  );
};

const Head: React.FC<{ t: number; who: 'hour' | 'minute'; face: Face; angle: number; sw: number }> = ({ t, who, face, angle, sw }) => {
  const h = HEAD[who];
  const a = (angle * Math.PI) / 180;
  const bl = blow(t);
  const x = CLOCK.x + h.d * Math.sin(a) + h.dir[0] * sw + 12 * bl;
  const y = CLOCK.y - h.d * Math.cos(a) + h.dir[1] * sw - 12 * bl;
  const size = HEADSIZE[who];
  const w = h.w * (1 + 0.22 * sw) * (1 - 0.16 * bl); // 움찔하면 작아진다
  const hh = (w * size.h) / size.w;
  // 머리는 스스로 까딱인다 — 숨 + 외칠 때 흔들림
  const rot = 3 * Math.sin(t * 2.6 + (who === 'hour' ? 0 : 1.7)) + 9 * Math.min(sw, 1.4) * Math.sin(t * 34);
  return <Img src={staticFile(`img/${who}Head${face}.webp`)} style={{ position: 'absolute', left: x - w / 2, top: y - hh / 2, width: w, height: hh, transform: `rotate(${rot}deg)`, filter: 'drop-shadow(5px 9px 7px rgba(60,30,8,0.45))' }} />;
};

// 같은 그림의 한 자리(몽글)만 따로 움직인다
const Patch: React.FC<{ img: string; cx: number; cy: number; rx: number; ry: number; sx?: number; sy?: number; dx?: number; dy?: number; rot?: number; oy?: number }> = ({ img, cx, cy, rx, ry, sx = 1, sy = 1, dx = 0, dy = 0, rot = 0, oy }) => {
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, black 78%, transparent 100%)`;
  return <Img src={staticFile(`img/${img}.jpg`)} style={{ ...FULL, WebkitMaskImage: mask, maskImage: mask, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${sx}, ${sy})`, transformOrigin: `${cx}px ${oy ?? cy + ry * 0.85}px` }} />;
};

const mongleImg = (t: number) => {
  if (t >= T.hour1 && t < T.try2) return 'startled';
  if (t >= T.min1 && t < T.bothTrue) return 'startled';
  if (t >= T.say && t < T.spin) return 'proud';
  if (t >= T.ding2) return 'proud';
  return 'room';
};

const Plate: React.FC<{ t: number }> = ({ t }) => {
  const cam = camAt(t);
  let punch = 0;
  for (const b of PUNCH) punch = Math.max(punch, interpolate(t, [b - 0.02, b + 0.06, b + 0.34], [0, 1, 0], clamp));
  // 흔들림 — 부딪칠수록 크게
  let shake = 0;
  for (const b of FIGHT_BEATS) if (t >= b.at) shake += b.power * b.power * 5 * Math.exp(-(t - b.at) * 6);
  if (t >= T.clash) shake += 16 * Math.exp(-(t - T.clash) * 5);
  if (t >= T.yell) shake += 24 * Math.exp(-(t - T.yell) * 4);
  const sx = 2.2 * Math.sin((2 * Math.PI * t) / 3.7) + shake * Math.sin(t * 71);
  const sy = 1.8 * Math.sin((2 * Math.PI * t) / 4.6 + 1) + shake * 0.7 * Math.cos(t * 83);
  const img = mongleImg(t);
  // 몽글 — 숨 · 놀라 튐 · 다툼 때 바늘 쪽을 번갈아 본다 · 부딪치면 밀려난다 · 바늘이 셀 때 까딱인다
  const breath = 1 + 0.018 * Math.sin(t * 3.4);
  let dx = 0;
  let dy = 0;
  let rot = 0;
  dy += -6 * Math.abs(Math.sin(t * 2.6)) * (t < T.hour1 ? 1 : 0.4);
  rot += t < T.hour1 ? 2.5 * Math.sin(t * 2.6) : 0;
  dy += -46 * Math.max(kick(t, T.hour1, 7, 14), 0);
  dy += -46 * Math.max(kick(t, T.min1, 7, 14), 0);
  if (t >= T.fight && t < T.clash) {
    const last = FIGHT_BEATS.filter((b) => t >= b.at).slice(-1)[0];
    const target = last.who === 'h' ? 1 : -1;
    const p = interpolate(t, [last.at, last.at + 0.12], [-target, target], { ...clamp, easing: EASE_OUT });
    dx += 24 * p;
    rot += 7 * p;
  }
  // 부딪치면 왼쪽으로 밀려났다가 어질어질 돌아온다
  const knock = t >= T.clash ? Math.exp(-(t - T.clash) * 1.7) : 0;
  dx += -62 * knock * (t >= T.clash ? hitIn(t - T.clash) : 1);
  rot += -18 * knock;
  if (t >= T.who && t < T.ruleH + 0.6) {
    const q = interpolate(t, [T.who, T.who + 0.2, T.ruleH + 0.2, T.ruleH + 0.6], [0, 1, 1, 0], clamp);
    rot += 9 * q * Math.sin((t - T.who) * 6.5);
    dx += 14 * q * Math.sin((t - T.who) * 6.5 + 0.8);
  }
  for (const b of [T.h1, T.h2, T.h3, T.m1, T.m2, T.m3]) dy += -16 * Math.max(kick(t, b, 8, 12), 0);
  dy += -34 * Math.max(kick(t, T.say, 6, 12), 0);
  // 노려보는 바늘 아래서 떤다
  if (t >= T.spinEnd && t < T.ding2) {
    dx += 3.5 * Math.sin(t * 46);
    dy += 2 * Math.sin(t * 39);
  }
  dy += -22 * Math.max(kick(t, T.ding2, 5, 12), 0);
  // 끝 — 숨을 들이켜 부풀고, 외치며 더 커진다
  const puff = interpolate(t, [T.puff, T.yell - 0.04, T.yell + 0.06, T.yell + 0.5, T.total], [1, 1.14, 1.28, 1.17, 1.15], clamp);
  const ha = hourAngle(t);
  const ma = minuteAngle(t);
  const hs = swell(t, 'h');
  const ms = swell(t, 'm');
  return (
    <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) scale(${cam.z * (1 + 0.03 * punch)})`, transformOrigin: `${cam.x}px ${cam.y}px` }}>
      <Img src={staticFile(`img/${img}.jpg`)} style={FULL} />
      <Patch img={img} cx={293} cy={1552} rx={300} ry={222} sy={breath * puff} sx={(2 - breath) * puff} dx={dx} dy={dy} rot={rot} oy={1712} />
      <Hand who="minute" angle={ma} sw={ms} />
      <Hand who="hour" angle={ha} sw={hs} />
      {/* 가운데 단추는 바늘 위에 — 판의 그 자리를 다시 얹는다 */}
      <Img src={staticFile('img/room.jpg')} style={{ ...FULL, WebkitMaskImage: `radial-gradient(circle 46px at ${CLOCK.x}px ${CLOCK.y}px, black 92%, transparent 100%)`, maskImage: `radial-gradient(circle 46px at ${CLOCK.x}px ${CLOCK.y}px, black 92%, transparent 100%)`, filter: 'drop-shadow(0 4px 5px rgba(50,25,6,0.5))' }} />
      <Head t={t} who="minute" face={minuteFace(t)} angle={ma} sw={ms} />
      <Head t={t} who="hour" face={hourFace(t)} angle={ha} sw={hs} />
    </AbsoluteFill>
  );
};

// 머리 글 — 나무 팻말(지난 두 편의 크래프트 띠 · 공책과 다르게) / 크림 판(규칙 줄)
const Sign: React.FC<{ t: number; at: number; until: number; lang: Lang; top?: number; size?: number; cream?: boolean; children: React.ReactNode }> = ({ t, at, until, lang, top = 262, size, cream, children }) => {
  if (t < at || t >= until) return null;
  const a = fadeIn(t, at, 0.16);
  // 납작한 색 판 대신 실제 펠트 천 + 바늘땀(아르곤 맹검 v14 [K1] [K8] 「파워포인트 도형」)
  return (
    <div style={{ position: 'absolute', left: 70, width: 940, top, transform: `translateY(${(1 - a) * 14}px)`, opacity: a, filter: 'drop-shadow(0 10px 14px rgba(40,18,4,0.42))' }}>
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 30, padding: '24px 34px 28px', boxSizing: 'border-box', fontFamily: FONT[lang], fontWeight: 800, fontSize: size ?? TEXT[lang].size, lineHeight: 1.16, color: cream ? C.brown : C.cream, textAlign: 'center', whiteSpace: 'pre-line', textShadow: cream ? '0 1px 0 rgba(255,250,235,0.55)' : '0 2px 2px rgba(20,8,0,0.55)' }}>
        <Img src={staticFile(cream ? 'img/clothCream.jpg' : 'img/clothGreen.jpg')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 10, borderRadius: 22, border: `3px dashed ${cream ? 'rgba(90,58,34,0.42)' : 'rgba(255,238,210,0.5)'}` }} />
        <div style={{ position: 'relative' }}>{children}</div>
      </div>
    </div>
  );
};

// 말풍선(한글 + 로마자 · 뜻 한 줄). 펠트 판 꼴 — 안쪽 바늘땀(아르곤 맹검 「기본 도형 꼴」). tipX · tipY = 꼬리 끝(화면 좌표), 왼쪽 밖이면 옆 꼬리. shout = 외침 — 기울고 크게 튀어나왔다 돌아온다(아르곤 맹검 v15 [K15] 「외치는데 얌전하다」)
const Bubble: React.FC<{ t: number; from: number; until: number; x: number; y: number; tipX: number; tipY: number; color: string; size?: number; sub?: string; subFont?: string; w?: number; h?: number; shout?: number; children: React.ReactNode }> = ({ t, from, until, x, y, tipX, tipY, color, size = 76, sub, subFont, w = 520, h: forceH, shout = 0, children }) => {
  if (t < from || t >= until) return null;
  const a = shout ? interpolate(t, [from, from + 0.07, from + 0.2, from + 0.4], [0.3, 1.2, 0.97, 1], clamp) : pop(t, from);
  // 글자가 바늘땀에 닿지 않게 위아래 14px씩 더 둔다(아르곤 맹검 v14 — 첫 화면 글자 윗머리가 바늘땀을 밟았다)
  const h = forceH ?? (sub ? size * 2.2 + 28 : size * 1.6 + 16);
  const left = Math.min(Math.max(40, x - w / 2), 1040 - w);
  const top = y - h / 2;
  const side = tipX < left;
  const rx = Math.min(52, h / 2);
  // 꼬리 — 몸통 가장자리에서 꼬리 끝까지. 몸통 위에 얹고 밑변 선을 긋지 않아 몸통 테두리가 꼬리 입구에서 끊긴다(v14 끝 말풍선 꼬리가 잘려 보인 자리)
  const bx = side ? left + 7 : Math.min(left + w - 90, Math.max(left + 90, tipX));
  const by = side ? Math.min(top + h - rx - 30, Math.max(top + rx + 30, tipY)) : tipY > y ? top + h - 7 : top + 7;
  const tail = side ? `M ${bx} ${by - 30} L ${tipX} ${tipY} L ${bx} ${by + 30}` : `M ${bx - 30} ${by} L ${tipX} ${tipY} L ${bx + 30} ${by}`;
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `rotate(${shout}deg) scale(${a})`, transformOrigin: `${bx}px ${by}px`, filter: 'drop-shadow(0 8px 12px rgba(50,22,6,0.35))' }}>
      <div style={{ position: 'absolute', left, top, width: w, height: h, borderRadius: rx, overflow: 'hidden', boxSizing: 'border-box', border: `5px solid ${color}`, background: FELT }}>
        <Img src={staticFile('img/clothCream.jpg')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <rect x={left + 13} y={top + 13} width={w - 26} height={h - 26} rx={Math.min(42, h / 2 - 13)} fill="none" stroke={color} strokeOpacity={0.4} strokeWidth={3} strokeDasharray="12 9" strokeLinecap="round" />
        <path d={tail} fill={FELT} stroke={color} strokeWidth={5} strokeLinejoin="round" />
      </svg>
      <div style={{ position: 'absolute', left, top, width: w, height: h, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: sub ? 4 : 0, paddingBottom: 4, boxSizing: 'border-box' }}>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1.06, color, whiteSpace: 'pre', textAlign: 'center' }}>{children}</div>
        {sub ? <div style={{ fontFamily: subFont ?? FONT.en, fontWeight: 700, fontSize: Math.min(46, size * 0.7), lineHeight: 1.16, color: C.brown, whiteSpace: 'pre' }}>{sub}</div> : null}
      </div>
    </div>
  );
};

// 바늘이 가리킨 눈금 옆 이름표(시계 위) — 화면 좌표로 놓는다
const Mark: React.FC<{ t: number; at: number; until: number; x: number; y: number; color: string; n: string; size?: number; children: React.ReactNode }> = ({ t, at, until, x, y, color, n, size = 64, children }) => {
  if (t < at || t >= until) return null;
  const a = pop(t, at, 0.16);
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${a})`, background: color, borderRadius: 26, padding: '6px 20px 10px', boxShadow: '0 8px 14px rgba(50,22,6,0.4)', whiteSpace: 'nowrap', fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1.12, color: C.cream }}>
      {children}
      <span style={{ fontFamily: FONT.en, fontWeight: 700, fontSize: size * 0.72, marginLeft: 12, opacity: 0.92 }}>{n}</span>
    </div>
  );
};

// 머리 판 안 숫자 줄 — 그 바늘 색
const Count: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 92, lineHeight: 1.12, color }}>{children}</div>
);

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

// 째깍 — 곡의 박과 같은 0.4995초. 말이 많은 다툼 · 도는 동안 · 끝 외침은 뺀다
const TICKS: number[] = [];
for (let k = 0; 0.294 + 0.4995 * k < T.total; k++) {
  const at = 0.294 + 0.4995 * k;
  if (at > T.min1 - 0.2 && at < T.who + 0.5) continue;
  if (at > T.spin - 0.1 && at < T.spinEnd + 0.1) continue;
  if (at > T.yell - 0.1) continue;
  TICKS.push(at);
}

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('sfx/bgm.wav')} volume={(f) => 0.2 * MASTER * interpolate(f / 30, [0, T.total - 0.5, T.total], [1, 1, 0], clamp)} />
    <Audio src={staticFile('sfx/room.wav')} volume={(f) => 0.18 * MASTER * interpolate(f / 30, [0, T.total - 0.4, T.total], [1, 1, 0], clamp)} />
    {TICKS.map((at, i) => <Sfx key={i} file={i % 2 ? 'tock.wav' : 'tick.wav'} at={at} vol={0.3} />)}
    <Vo id="m1" at={T.read} vol={1.1} />
    <Sfx file="boing.wav" at={T.hour1} vol={0.6} />
    <Vo id="h1" at={T.hour1 + 0.02} vol={1.1} />
    <Vo id="m2" at={T.try2} vol={1.1} />
    <Sfx file="boing.wav" at={T.min1} vol={0.6} />
    <Vo id="n1" at={T.min1 + 0.02} vol={1.05} />
    {FIGHT_BEATS.map((b, i) => (
      <React.Fragment key={i}>
        <Sfx file="clack.wav" at={b.at} vol={0.26 + 0.2 * b.power} />
        {b.who !== 'm' ? <Vo id="h2" at={b.at + 0.02} vol={0.92 + 0.12 * b.power} /> : null}
        {b.who !== 'h' ? <Vo id="n2" at={b.at + 0.02} vol={0.92 + 0.12 * b.power} /> : null}
      </React.Fragment>
    ))}
    <Sfx file="boing.wav" at={T.clash} vol={0.75} />
    <Sfx file="pop.wav" at={T.bothTrue} vol={0.25} />
    <Sfx file="whoosh.wav" at={T.swingH - 0.05} vol={0.3} />
    <Vo id="h4" at={T.h1} vol={1.05} />
    {[T.h1, T.h2, T.h3].map((a, i) => <Sfx key={i} file="tick.wav" at={a} vol={0.5} />)}
    <Sfx file="whoosh.wav" at={T.ruleM - 0.05} vol={0.3} />
    <Vo id="n4" at={T.m1} vol={1.05} />
    {[T.m1, T.m2, T.m3].map((a, i) => <Sfx key={i} file="tock.wav" at={a} vol={0.5} />)}
    <Sfx file="clack.wav" at={T.bump} vol={0.42} />
    <Sfx file="pop.wav" at={T.both} vol={0.25} />
    <Vo id="m4" at={T.say} vol={1.1} />
    <Sfx file="chime.wav" at={T.ding} vol={0.42} />
    <Sfx file="whoosh.wav" at={T.spin - 0.08} vol={0.3} />
    <Sfx file="spin.wav" at={T.spin} vol={0.5} />
    <Sfx file="pop.wav" at={T.spinEnd} vol={0.22} />
    <Vo id="m5" at={T.small} vol={1.25} />
    <Sfx file="chime.wav" at={T.ding2} vol={0.42} />
    <Sfx file="whoosh.wav" at={T.puff} vol={0.22} />
    <Sfx file="boing.wav" at={T.yell} vol={0.8} />
    <Sfx file="clack.wav" at={T.yell} vol={0.6} />
    <Vo id="m6" at={T.yell + 0.02} vol={1.2} />
    <Sfx file="tick.wav" at={T.end} vol={0.6} />
    <Sfx file="pop.wav" at={T.end + 0.02} vol={0.25} />
  </>
);

// 장면 심사용(scene)에는 머리 글을 빼고 장면의 말 · 소리만 남긴다
export const Film: React.FC<{ lang: Lang; scene?: boolean }> = ({ lang, scene }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const L = TEXT[lang];
  const beat = FIGHT_BEATS.filter((b) => t >= b.at).slice(-1)[0];
  const beatSize = beat ? 92 * Math.pow(beat.power, 0.62) : 100;
  return (
    <AbsoluteFill style={{ background: '#2B1A14' }}>
      <Plate t={t} />
      {/* 부딪치는 순간 번쩍 */}
      {[T.clash, T.yell].map((at) => (t >= at && t < at + 0.32 ? <AbsoluteFill key={at} style={{ background: '#FFF4D6', opacity: interpolate(t, [at, at + 0.04, at + 0.3], [0, 0.6, 0], clamp) }} /> : null))}
      {/* 몽글의 말 — 오른쪽 아래 빈 벽 */}
      <Bubble t={t} from={T.read} until={T.hour1} x={650} y={1482} tipX={400} tipY={1625} color={C.coral} sub={ROMAN.read} w={560} size={62}>삼 시 삼십 분<El />?</Bubble>
      <Bubble t={t} from={T.try2 + 0.05} until={T.min1} x={660} y={1500} tipX={420} tipY={1655} color={C.coral} sub={ROMAN.try2} w={480} size={68}>세<El />? 삼<El />?</Bubble>
      {/* 짧은 바늘 「세 시!」 · 긴 바늘 「삼십 분!」 */}
      <Bubble t={t} from={T.hour1} until={T.try2} x={700} y={578} tipX={700} tipY={850} color={C.hour} sub={L.seGloss} subFont={FONT[lang]} w={560} size={84}>세 시!</Bubble>
      <Bubble t={t} from={T.min1} until={T.fight} x={350} y={1180} tipX={530} tipY={1025} color={C.minute} sub={L.samsipGloss} subFont={FONT[lang]} w={640} size={76}>삼십 분!</Bubble>
      {/* 다툼 — 박마다 커진다, 마지막은 둘이 한꺼번에. 꼬리는 머리 위에서 멈춘다(v14 정수리를 찌름) */}
      {beat && t < T.who && beat.who !== 'm' ? <Bubble t={t} from={beat.at} until={beat.at + 0.5} x={800} y={380} tipX={790} tipY={612} color={C.hour} sub="3!" w={beatSize * 2.5} size={beatSize} shout={5}>세!</Bubble> : null}
      {beat && t < T.who && beat.who !== 'h' ? <Bubble t={t} from={beat.at} until={beat.at + 0.5} x={290} y={1180} tipX={530} tipY={1025} color={C.minute} sub="30!" w={beatSize * 3.3} size={beatSize} shout={-5}>삼십!</Bubble> : null}
      {!scene ? (
        <>
          <Sign t={t} at={-1} until={T.seoreun} lang={lang} size={L.size * 0.875}>{L.hook}</Sign>
          {/* 다툼이 끝나자마자 답 — 「who's right?」 한 칸을 빼고 2초 읽게(시험관 넷이 8초를 같이 짚음) */}
          <Sign t={t} at={T.who} until={T.ruleH} lang={lang} size={L.size * 0.875}>{L.bothTrue}</Sign>
          <Sign t={t} at={T.ruleH} until={T.ruleM} lang={lang} cream size={L.size * 0.92}>
            {L.hours}
            <Count color={C.hour}>
              한 · 두 · 세
            </Count>
          </Sign>
          <Sign t={t} at={T.ruleM} until={T.both} lang={lang} cream size={L.size * 0.92}>
            {L.minutes}
            <Count color={C.minute}>
              일 · 이 · 삼
            </Count>
          </Sign>
          {/* 바늘이 짚은 눈금 옆 이름표 — 시계 가운데 (546, 980), 1.2 · 1.22배 */}
          <Mark t={t} at={T.h1} until={T.ruleM} x={748} y={630} color={C.hour} n="1">한 시</Mark>
          <Mark t={t} at={T.h2} until={T.ruleM} x={885} y={778} color={C.hour} n="2">두 시</Mark>
          <Mark t={t} at={T.h3} until={T.both} x={920} y={980} color={C.hour} n="3">세 시</Mark>
          <Mark t={t} at={T.m1} until={T.both} x={887} y={775} color={C.minute} n="10">십 분</Mark>
          {/* 일 · 이 · 삼이 어디 있는지 — 이십 · 삼십의 앞 글자를 밝힌다(그록 「일 · 이 · 삼과 십 분 · 이십 분이 연결이 안 된다」) */}
          <Mark t={t} at={T.m2} until={T.both} x={873} y={1185} color={C.minute} n="20"><span style={{ color: '#FFE27A' }}>이</span>십 분</Mark>
          <Mark t={t} at={T.m3} until={T.both} x={546} y={1390} color={C.minute} n="30"><span style={{ color: '#FFE27A' }}>삼</span>십 분</Mark>
          {/* 넓게 — 몽글이 맞게 읽는다 */}
          <Bubble t={t} from={T.say} until={T.spin} x={650} y={1482} tipX={400} tipY={1625} color={C.brown} sub={ROMAN.right} w={560} size={66}>
            <span style={{ color: C.hour }}>세 시 </span>
            <span style={{ color: C.minute }}>삼십 분!</span>
          </Bubble>
          <Sign t={t} at={T.ding} until={T.spin} lang={lang} size={72}>3:30</Sign>
          {/* 바늘이 다 돌아 갈 즈음에 — 도는 동안 다른 시각을 가리키는데 「10:15」가 뜨면 어긋나 보인다(GPT 18초) */}
          <Sign t={t} at={T.spin + 0.55} until={T.small} lang={lang}>{L.now}</Sign>
          {/* 떨면서 — 몽글 가까이 */}
          <Bubble t={t} from={T.small} until={T.cut} x={540} y={1090} tipX={330} tipY={1345} color={C.brown} sub={ROMAN.small} w={750} size={68}>
            <span style={{ color: C.hour }}>열 시<El /> </span>
            <span style={{ color: C.minute }}>십오 분<El />?</span>
          </Bubble>
          {/* 끝 — 이번엔 몽글이 바늘보다 크게 외친다. 옆 꼬리가 몽글 머리를 가리킨다 */}
          <Bubble t={t} from={T.yell} until={T.sum} x={695} y={1490} tipX={392} tipY={1590} color={C.brown} sub={ROMAN.ten} w={510} h={360} size={108} shout={-4}>
            <span style={{ color: C.hour }}>{'열 시\n'}</span>
            <span style={{ color: C.minute }}>십오 분!</span>
          </Bubble>
          <Sign t={t} at={T.yell + 0.3} until={T.sum} lang={lang}>{L.whoNow}</Sign>
          <Sign t={t} at={T.sum} until={T.total + 1} lang={lang} cream size={L.size * 0.875}>
            <span style={{ fontFamily: FONT[lang], color: C.brown }}>{L.endH} </span>
            <span style={{ fontFamily: KO, fontWeight: 900, color: C.hour }}>한 · 두 · 세</span>
            <br />
            <span style={{ fontFamily: FONT[lang], color: C.brown }}>{L.endM} </span>
            <span style={{ fontFamily: KO, fontWeight: 900, color: C.minute }}>일 · 이 · 삼</span>
          </Sign>
        </>
      ) : null}
      <Sound />
    </AbsoluteFill>
  );
};
