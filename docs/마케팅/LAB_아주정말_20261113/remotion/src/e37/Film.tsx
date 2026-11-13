// LAB 영어 E37 「very」 — 「“Very” in Korean?」 하고 사전을 편 몽글 앞에서 사전이 펑 열리고, 낱말 조각(아주 · 정말 · 진짜 · 완전)이 하나씩
// 날아올라 머물다가, 매우 · 너무 · 엄청 · 되게 …가 점점 빨리 쏟아져 방을 채운다. 끝은 조각 더미에서 눈만 내민 몽글 「한국어… 진짜 어려워…」.
// 원본 doci_korean 6x_nN3roaHk의 뼈대(한 장면 · 낱말이 쌓여 화면을 채움 · 끝 컷)를 따른다(timeline.ts).
// 장면은 GPT 이미지(구독 경로)로 구운 판(판/*.png, 지시문 판/*.txt) — 방 세 장(빈 방 · 책상까지 쌓임 · 꽉 참)은 아래에서 위로 덮어 더미가 차오르게,
// 낱말 조각은 조각판에서 오린 것(한글은 바느질로 구운 글 — 장면과 한 장). 화면 글은 판 · 상자 없이 위쪽 그늘의 큰 글자 한 갈래.
// 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { FONT, KO, LOCS, TEXT, WORDS, type Loc, type LocText } from './data';
import { fr, T } from './timeline';

const C = { cream: '#FFF6E6', coral: '#FF8A75', mint: '#9FD8B4', dim: 'rgba(255,246,230,0.86)' };
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const FULL: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, objectFit: 'cover' };
const SHADOW = '0 3px 0 rgba(20,10,6,0.95), 0 0 12px rgba(16,8,4,0.95), 0 0 26px rgba(16,8,4,0.9), 0 6px 30px rgba(16,8,4,0.9)';
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const bump = (t: number, at: number, up = 0.05, down = 0.35) => interpolate(t, [at - 0.02, at + up, at + down], [0, 1, 0], clamp);
// 결정적인 흩음(렌더마다 같은 값)
const rnd = (i: number, k = 0) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const BOOK: [number, number] = [522, 1215]; // 사전 가운데(1080×1920)
// 몽글 자리(가운데 x · y · 반지름 x · y) — 구운 판에서 잰 값
const SPOT: Record<string, [number, number, number, number]> = {
  room1: [560, 1030, 215, 185],
  room2: [558, 1030, 215, 175],
  room3: [545, 990, 180, 110],
};

// 같은 그림의 몽글 자리만 따로 움직인다 — 몸을 늘이지 않고 자리 · 기울기만
const Patch: React.FC<{ img: string; dx?: number; dy?: number; rot?: number }> = ({ img, dx = 0, dy = 0, rot = 0 }) => {
  const [cx, cy, rx, ry] = SPOT[img];
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, black 72%, transparent 100%)`;
  return <Img src={staticFile(`img/${img}.jpg`)} style={{ ...FULL, WebkitMaskImage: mask, maskImage: mask, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, transformOrigin: `${cx}px ${cy + ry * 0.85}px` }} />;
};

// 몽글 움직임 — 사전을 보며 갸웃 → 펑에 깜짝 뛰고 떨다가 → 더미에 묻혀 가라앉고 → 끝에 고개를 내민다
const mongle = (t: number) => {
  let dx = 0;
  let dy = 0;
  let rot = 0;
  if (t < T.burst) {
    rot = 2.6 * Math.sin(t * 2.4);
    dy = -10 * bump(t, T.ask, 0.08, 0.4);
  } else if (t < T.rain) {
    const jump = interpolate(t, [T.burst, T.burst + 0.12, T.burst + 0.45], [0, -40, 0], { ...clamp, easing: Easing.out(Easing.quad) });
    dy = jump;
    rot = -3 + 2 * Math.sin(t * 3);
    dx = 2.4 * Math.sin(t * 38) * (t > T.more ? 1.6 : 1);
    for (const at of T.w) dy -= 14 * bump(t, at + 0.1, 0.06, 0.3);
    // 낱말이 하나 튀어나올 때마다 움찔 — 뒤로 젖혀지며 납작(장면 심사 v1 답 4 「낱말마다 움찔하고 점점 지쳐 가게」)
    T.f.forEach((at, j) => {
      const k = bump(t, at + 0.05, 0.05, 0.28);
      dy += 10 * k;
      rot -= (j % 2 ? 5 : -5) * k;
      dx += (j % 2 ? -8 : 8) * k;
    });
  } else {
    // 파묻혀 가라앉는다 → 끝 컷에서 고개를 쏙 내민다
    dy = interpolate(t, [T.rain, T.full], [0, 18], clamp) - interpolate(t, [T.end + 0.05, T.end + 0.4], [0, 22], { ...clamp, easing: Easing.out(Easing.back(2)) });
    rot = t > T.end ? 2.2 * Math.sin((t - T.end) * 2.2) : 0;
    dy += 9 * bump(t, T.bonk, 0.05, 0.3);
    dx = t < T.full ? 2 * Math.sin(t * 30) : 0;
  }
  return { dx, dy, rot };
};

const Layer: React.FC<{ img: string; t: number; mask?: string }> = ({ img, t, mask }) => {
  const m = mongle(t);
  return (
    <AbsoluteFill style={mask ? { WebkitMaskImage: mask, maskImage: mask } : undefined}>
      <Img src={staticFile(`img/${img}.jpg`)} style={FULL} />
      <Patch img={img} dx={m.dx} dy={m.dy} rot={m.rot} />
    </AbsoluteFill>
  );
};
// 아래에서 위로 차오르는 덮개 — edge(px) 아래는 새 판
const rise = (edge: number) => `linear-gradient(to bottom, transparent ${edge - 34}px, black ${edge + 26}px)`;

const Plate: React.FC<{ t: number }> = ({ t }) => {
  const e1 = interpolate(t, [T.burst + 0.1, T.more - 0.1], [2080, 900], { ...clamp, easing: Easing.out(Easing.quad) });
  const e2 = interpolate(t, [T.f[0] + 0.3, T.full], [2080, 760], { ...clamp, easing: Easing.inOut(Easing.quad) });
  // 카메라 — 천천히 다가가고, 펑에 한 번 흔들리고, 끝 컷은 더미 속 몽글 가까이
  let z = interpolate(t, [0, T.burst], [1.0, 1.06], clamp);
  let ox = 540;
  let oy = 1100;
  if (t >= T.burst) z = interpolate(t, [T.burst, T.burst + 0.08, T.burst + 0.5, T.end], [1.12, 1.0, 1.0, 1.0], clamp);
  if (t >= T.end) {
    z = interpolate(t, [T.end, T.total], [1.9, 2.02], { ...clamp, easing: Easing.inOut(Easing.quad) });
    ox = 545;
    oy = 1000;
  }
  const shake = interpolate(t, [T.burst, T.burst + 0.5], [1, 0], clamp) * 8;
  const quake = t >= T.rain && t < T.full ? 2.2 : 0;
  const sx = shake * Math.sin(t * 61) + quake * Math.sin(t * 37) + 1.6 * Math.sin((2 * Math.PI * t) / 3.9);
  const sy = shake * Math.cos(t * 53) + quake * Math.cos(t * 29) + 1.3 * Math.sin((2 * Math.PI * t) / 4.7 + 1);
  return (
    <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) scale(${z})`, transformOrigin: `${ox}px ${oy}px` }}>
      {t < T.more + 0.2 ? <Layer img="room1" t={t} /> : null}
      {t >= T.burst ? <Layer img="room2" t={t} mask={t < T.more ? rise(e1) : undefined} /> : null}
      {t >= T.f[0] + 0.3 ? <Layer img="room3" t={t} mask={t < T.full ? rise(e2) : undefined} /> : null}
      {t >= T.end ? <Bonk t={t} /> : null}
    </AbsoluteFill>
  );
};

// 조각 하나 — 사전에서 날아올라(호를 그리며 커짐) 머물다가 더미로 떨어진다
const TILE_W = 305;
const Tile: React.FC<{ t: number; img: string; at: number; to: [number, number]; size: number; rot: number; fall: number; land: [number, number]; read?: string; readSize?: number; gloss?: string; glossSize?: number; from?: [number, number]; from0?: number; font?: string }> = ({ t, img, at, to, size, rot, fall, land, read, readSize = 44, gloss, glossSize = 56, from = BOOK, from0 = 0.18, font = FONT }) => {
  if (t < at || t > fall + 0.55) return null;
  const p = interpolate(t, [at, at + 0.42], [0, 1], { ...clamp, easing: EASE_OUT });
  const sp = interpolate(t, [at, at + 0.3, at + 0.42], [from0, size * 1.12, size], clamp);
  let x = lerp(from[0], to[0], p);
  let y = lerp(from[1], to[1], p) - 260 * Math.sin(Math.PI * Math.min(1, p)) * (1 - p * 0.6);
  let s = sp;
  let r = lerp(rnd(at) > 0.5 ? 28 : -28, rot, p) + (p >= 1 ? 2 * Math.sin((t - at) * 3) : 0);
  let o = 1;
  let blur = 0;
  if (p >= 1) y += 6 * Math.sin((t - at) * 2.6);
  if (t >= fall) {
    // 떨어지는 조각은 비치지 않는 실물로 빠르게 떨어져 더미에 닿는 순간 사라진다(미학 맹검 GPT C080 「반투명 페이드가 스티커 같다」) — 흐림은 움직임 흐림만
    const q = interpolate(t, [fall, fall + 0.28], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
    x = lerp(x, land[0], q);
    y = lerp(y, land[1], q);
    s = lerp(size, size * 0.42, q);
    r = rot + 160 * q * (rnd(at, 3) > 0.5 ? 1 : -1);
    o = t < fall + 0.28 ? 1 : 0;
    blur = 4 * q;
  }
  // 뜻 줄은 조각이 자리 잡기 전부터(이해 시험 v4 — 넷 다 「무척 · 엄청 뜻이 안 보임」), 떨어지기 시작하면 바로 지운다
  // (떨어지는 조각을 따라 내려가면 아래 조각의 뜻 줄과 겹친다 — v8 9.3초 「매우」 · 「엄청」)
  const ra = read && t < fall ? interpolate(t, [at + 0.12, at + 0.28], [0, 1], clamp) : 0; // 떨어지는 순간 끊는다(흐린 잔상 없이)
  return (
    <>
      <Img src={staticFile(`img/${img}.png`)} style={{ position: 'absolute', left: x - TILE_W / 2, top: y - 115, width: TILE_W, transform: `scale(${s}) rotate(${r}deg)`, transformOrigin: '50% 50%', opacity: o, filter: `blur(${blur}px) drop-shadow(0 10px 14px rgba(20,10,6,0.55))` }} />
      {read ? (
        // 뜻이 길면(버마어) 읽는 법 다음에서 줄을 바꾼다 — 오른쪽 조각의 뜻이 화면 밖으로 잘리지 않게(v8 정지컷)
        <div style={{ position: 'absolute', left: x - 260, width: 520, top: y + 118 * s - 4, textAlign: 'center', fontFamily: font, fontWeight: 700, fontStyle: 'italic', fontSize: readSize, lineHeight: 1.25, color: C.cream, opacity: ra, textShadow: SHADOW }}>
          <span style={{ whiteSpace: 'nowrap' }}>{read}</span>
          {gloss ? <><br /><span style={{ fontStyle: 'normal', fontWeight: 800, color: C.mint, fontSize: glossSize, whiteSpace: 'nowrap' }}>{`= ${gloss}`}</span></> : null}
        </div>
      ) : null}
    </>
  );
};

// 첫 화면의 한 조각 — 사전에서 「아주」 하나만 쏙 올라와 떠 있다(「Just one word… right?」), 3.2초에 첫 낱말로 날아오른다
const ONE: [number, number] = [560, 745];
const One: React.FC<{ t: number; L: LocText }> = ({ t, L }) => {
  if (t < 0.5 || t >= T.w[0]) return null;
  const p = interpolate(t, [0.5, 0.85], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.4)) });
  const y = lerp(BOOK[1], ONE[1], p) + (t > 0.85 ? 8 * Math.sin((t - 0.85) * 3.2) : 0) - 14 * bump(t, T.burst, 0.05, 0.25);
  const r = 4 * Math.sin(t * 2.1) + 10 * bump(t, T.burst, 0.05, 0.2);
  const ra = interpolate(t, [0.95, 1.15], [0, 1], clamp);
  return (
    <>
      <Img src={staticFile('img/w01.png')} style={{ position: 'absolute', left: ONE[0] - TILE_W / 2, top: y - 115, width: TILE_W, transform: `scale(${0.55 * p}) rotate(${r}deg)`, filter: 'drop-shadow(0 10px 14px rgba(20,10,6,0.55))' }} />
      <div style={{ position: 'absolute', left: ONE[0] - 260, width: 520, top: y + 118 * 0.55 - 4, textAlign: 'center', fontFamily: L.font, fontWeight: 700, fontStyle: 'italic', fontSize: 42, lineHeight: 1.25, color: C.cream, opacity: ra, textShadow: SHADOW }}>
        <span style={{ whiteSpace: 'nowrap' }}>{WORDS[0].read}</span>
        <br /><span style={{ fontStyle: 'normal', fontWeight: 800, color: C.mint, fontSize: 56 * Math.max(0.95, L.scale), whiteSpace: 'nowrap' }}>{`= ${L.gloss[0]}`}</span>
      </div>
    </>
  );
};

// 넷은 위쪽에 둘씩 두 줄로 머문다(원본의 꼬리표가 머리 둘레에 쌓이듯), 여덟은 빨리 떴다 떨어진다
// 오른쪽 조각은 750 — 뜻 줄이 오른쪽 단추 자리(920px)를 넘지 않게(올리기 전 검사 v12 「오른쪽 끝 995~1025px」), 몽글 오른눈(557)은 비켜 간다.
// 뜻은 「읽는 법 / = 뜻」 두 줄이라 아랫줄은 990까지 내린다.
const MAIN_TO: [number, number][] = [[285, 640], [750, 640], [285, 990], [750, 990]];
const MAIN_ROT = [-6, 5, 4, -5];
// 아랫줄은 넷보다 조금 더 내린다 — 영어 뜻이 길면(very much · extremely) 두 줄이 되어 아래 조각에 닿았다(v11 정지컷)
const FLOOD_TO: [number, number][] = [[285, 640], [750, 640], [285, 990], [750, 990], [285, 640], [750, 640], [285, 990], [750, 990]];
const FLOOD_ROT = [3, -7, 6, -4, 5, -6, 7, -3];

const Words: React.FC<{ t: number; L: LocText }> = ({ t, L }) => (
  <>
    {T.w.map((at, i) => (
      <Tile key={`m${i}`} t={t} img={WORDS[i].img} at={at} to={MAIN_TO[i]} size={0.95} rot={MAIN_ROT[i]} fall={T.more + 0.05 + i * 0.12} land={[300 + i * 160, 1500 + 40 * (i % 2)]} read={WORDS[i].read} readSize={42} gloss={L.gloss[i]} glossSize={56 * Math.max(0.95, L.scale)} font={L.font} {...(i === 0 ? { from: ONE, from0: 0.55 } : {})} />
    ))}
    {T.f.map((at, j) => (
      <Tile key={`f${j}`} t={t} img={WORDS[4 + j].img} at={at} to={FLOOD_TO[j]} size={0.92} rot={FLOOD_ROT[j] * 0.5} fall={T.fFall[j]} land={[200 + 90 * j, 1450 + 60 * (j % 3)]} read={WORDS[4 + j].read} readSize={42} gloss={L.gloss[4 + j]} glossSize={56 * Math.max(0.95, L.scale)} font={L.font} />
    ))}
  </>
);

// 쏟아짐 — 작은 조각이 위에서 우르르 떨어져 더미에 묻힌다(점점 빽빽하게)
const RAIN_N = 34;
const Rain: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.rain - 0.2 || t > T.full + 0.6) return null;
  const span = T.full - T.rain;
  return (
    <>
      {Array.from({ length: RAIN_N }).map((_, i) => {
        const at = T.rain + span * Math.pow(i / RAIN_N, 0.75) - 0.1;
        const d = 0.48 + 0.14 * rnd(i, 1);
        if (t < at || t > at + d) return null;
        const q = (t - at) / d;
        const x = 120 + 840 * rnd(i, 2);
        const groundY = interpolate(at, [T.rain, T.full], [1250, 980], clamp) + 120 * rnd(i, 5);
        const y = lerp(700, groundY, q * q);
        const s = 0.32 + 0.16 * rnd(i, 4);
        const r = (rnd(i, 6) - 0.5) * 220 * q;
        // 비치지 않게 — 아주 짧게 나타나고 바닥에 닿으면 사라진다(미학 맹검 GPT C077 「조각이 서로 비침」)
        const o = interpolate(q, [0, 0.04], [0, 1], clamp);
        return <Img key={i} src={staticFile(`img/b${String((i % 12) + 1).padStart(2, '0')}.png`)} style={{ position: 'absolute', left: x - TILE_W / 2, top: y - 115, width: TILE_W, transform: `scale(${s}) rotate(${r}deg)`, opacity: o, filter: 'blur(0.8px) drop-shadow(0 6px 8px rgba(20,10,6,0.5))' }} />;
      })}
    </>
  );
};

// 끝 컷 — 더미 속 몽글 머리 위로 마지막 한 조각 「진짜」가 떨어져 툭 얹힌다(끝 문장의 그 진짜)(판이 1.9배라 판 좌표로 둔다)
const Bonk: React.FC<{ t: number }> = ({ t }) => {
  const q = interpolate(t, [T.end + 0.08, T.bonk], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const y = lerp(560, 902, q) - 10 * bump(t, T.bonk + 0.02, 0.05, 0.25);
  const r = lerp(-40, -8, q) + 3 * bump(t, T.bonk, 0.05, 0.3);
  return <Img src={staticFile('img/w03.png')} style={{ position: 'absolute', left: 552 - TILE_W / 2, top: y - 115, width: TILE_W, transform: `scale(0.36) rotate(${r}deg)`, filter: 'drop-shadow(0 4px 5px rgba(20,10,6,0.55))' }} />;
};

// 화면 글 — 판 없이 위쪽 그늘에: 큰 줄(굵게) + 덧붙임 한 줄
const Title: React.FC<{ t: number; at: number; until: number; big: React.ReactNode; size?: number; top?: number; note?: string; noteAt?: number; font?: string; scale?: number }> = ({ t, at, until, big, size = 96, top = 250, note, noteAt, font = FONT, scale = 1 }) => {
  if (t < at || t >= until) return null;
  const a = interpolate(t, [at, at + 0.2], [0, 1], { ...clamp, easing: EASE_OUT });
  const na = note ? interpolate(t, [noteAt ?? at, (noteAt ?? at) + 0.2], [0, 1], { ...clamp, easing: EASE_OUT }) : 0;
  return (
    <div style={{ position: 'absolute', left: 80, width: 920, top, textAlign: 'center', opacity: a, transform: `translateY(${(1 - a) * 18}px)`, textShadow: SHADOW }}>
      <div style={{ fontFamily: font, fontWeight: 800, fontSize: size * scale, lineHeight: scale < 1 ? 1.32 : 1.12, color: C.cream, whiteSpace: 'pre-line' }}>{big}</div>
      {note ? <div style={{ fontFamily: font, fontWeight: 600, fontSize: 56 * Math.max(1, scale), lineHeight: 1.2, color: C.dim, marginTop: 20, opacity: na }}>{note}</div> : null}
    </div>
  );
};

// 몽글의 말 — 몽글 곁에 글자만(상자 · 테두리 없음)
const Say: React.FC<{ t: number; L: LocText }> = ({ t, L }) => {
  if (t < T.say) return null;
  const a = interpolate(t, [T.say, T.say + 0.22], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const sa = interpolate(t, [T.say + 0.5, T.say + 0.7], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', left: 60, width: 960, top: 470, textAlign: 'center', transform: `scale(${a}) rotate(-2deg)`, transformOrigin: '50% 100%', textShadow: SHADOW }}>
      <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 92, lineHeight: 1.12, color: C.cream, whiteSpace: 'nowrap' }}>{TEXT.sayKo}</div>
      <div style={{ fontFamily: L.font, fontWeight: 700, fontStyle: L.scale < 1 ? 'normal' : 'italic', fontSize: 52 * Math.max(0.8, L.scale), lineHeight: 1.3, color: C.dim, marginTop: 14, opacity: sa }}>
        {L.sayPre}<span style={{ fontFamily: KO, fontWeight: 900, fontStyle: 'normal', color: C.mint }}>진짜</span>{L.sayPost}
      </div>
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
// 음악은 끝 컷(몽글 한 줄) 동안 반쯤 낮춘다 — 그 밑에 방 공기가 깔려 있다(음악층 ⑲)
const bgmVol = (f: number) => {
  const t = f / 30;
  const k = interpolate(t, [0, T.end - 0.1, T.end + 0.3, T.total - 0.7, T.total], [1, 1, 0.55, 0.55, 0], clamp);
  return 0.13 * MASTER * k;
};
const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('sfx/bgm.wav')} volume={bgmVol} />
    <Audio src={staticFile('sfx/room.wav')} volume={0.5 * MASTER} />
    <Sfx file="pop.wav" at={T.hook} vol={0.22} />
    <Sfx file="boing.wav" at={0.5} vol={0.26} />
    <Sfx file="pop.wav" at={T.ask} vol={0.18} />
    <Sfx file="burst.wav" at={T.burst - 0.06} vol={0.7} />
    {T.w.map((at, i) => (
      <React.Fragment key={`w${i}`}>
        <Sfx file="boing.wav" at={at} vol={0.32} />
        <Vo id={`w${i + 1}`} at={at + 0.1} />
        <Sfx file="thud.wav" at={T.more + 0.05 + i * 0.12 + 0.48} vol={0.4} />
      </React.Fragment>
    ))}
    <Sfx file="whoosh.wav" at={T.more - 0.1} vol={0.28} />
    {T.f.map((at, j) => (
      <React.Fragment key={`f${j}`}>
        <Sfx file="boing.wav" at={at} vol={0.26} />
        <Vo id={`f${j + 1}`} at={at + 0.06} vol={0.95} />
        <Sfx file="thud.wav" at={T.fFall[j] + 0.08} vol={0.22} />
      </React.Fragment>
    ))}
    <Sfx file="rumble.wav" at={T.rain - 0.1} vol={0.7} />
    <Sfx file="pop.wav" at={T.line} vol={0.2} />
    <Sfx file="ding.wav" at={T.start} vol={0.3} />
    <Sfx file="whoosh.wav" at={T.end - 0.12} vol={0.26} />
    <Sfx file="pop.wav" at={T.end + 0.1} vol={0.24} />
    <Sfx file="thud.wav" at={T.bonk - 0.02} vol={0.55} />
    <Vo id="m1" at={T.say} />
  </>
);

// 장면 심사용(scene)에는 화면 글을 빼고 장면 · 조각의 한글 · 소리만 남긴다
export const Film: React.FC<{ scene?: boolean; loc?: Loc }> = ({ scene, loc = 'en' }) => {
  const L = LOCS[loc];
  const frame = useCurrentFrame();
  const t = frame / 30;
  return (
    <AbsoluteFill style={{ background: '#1A120D' }}>
      <Plate t={t} />
      {/* 위쪽을 어둡게 — 글자와 머무는 조각이 놓일 자리(상자가 아니라 빛). 끝 컷은 더미 위 벽이 이미 어두워 조금만 */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1080, opacity: t >= T.end ? 0.75 : 1, background: 'linear-gradient(to bottom, rgba(20,12,8,0.95) 0%, rgba(20,12,8,0.9) 34%, rgba(20,12,8,0.7) 62%, rgba(20,12,8,0.32) 84%, rgba(20,12,8,0) 100%)' }} />
      {t >= T.burst && t < T.end ? <Rain t={t} /> : null}
      <One t={t} L={L} />
      {t < T.end ? <Words t={t} L={L} /> : null}
      {!scene ? (
        <>
          <Title t={t} at={T.hook} until={T.burst} big={L.hook} size={108} note={L.ask} noteAt={T.ask} font={L.font} scale={L.scale} />
          <Title t={t} at={T.more} until={T.line} big={L.more} size={84} top={300} font={L.font} scale={L.scale} />
          <Title t={t} at={T.line} until={T.end} big={L.line} size={88} top={250} note={L.start} noteAt={T.start} font={L.font} scale={L.scale} />
          <Say t={t} L={L} />
        </>
      ) : null}
      <Sound />
    </AbsoluteFill>
  );
};
