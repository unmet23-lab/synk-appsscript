// LAB 몽골 M31 「설렐 때 네 마디」(11-06) — 머리 글 → 늦가을 캠퍼스의 설레는 네 칸(상황 → 표현) → 그 사람 앞 굳은 인사 → 문자 → 불꽃놀이.
// 우리편 M1 「화날 때 네 마디」(../../../../LAB_화날때_mn_20261031/remotion/src/film/Film.tsx)의 틀 — 왼쪽 게이지가 칸마다 찬다.
// 그림은 장면마다 구운 한 장(누끼 없음). 같은 판을 부드러운 타원 가면으로 겹쳐 그 자리만 움직인다(M28 Patch).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { BGM_DUCK, BGM_VOL, BURST_AT, Bubble as BubbleData, CELLS, END_LINE_AT, FPS, GREET_AT, HOLD_BEATS, INNER_AT, Loc, LocPack, LOCS, MSG_AT, OPEN_INNER_AT, PHONE_AT, REPLY_AT, REPLY_VO, SFX, TEXT, TOTAL, VO_LEN } from './data';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2B2522';
const ROSE = '#E2456B';
const MEAN = '#B8325A';
const CREAM = '#FFFDF7';
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
const bump = (t: number, at: number, up = 0.05, down = 0.35) => interpolate(t, [at - 0.02, at + up, at + down], [0, 1, 0], clamp);

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

// 몽글만 살짝 움직이는 조각 — 같은 판을 타원 가면으로 겹쳐 그 자리만 눌렀다 폈다 · 떨게 한다(장면이 떨리지 않게)
const Patch: React.FC<{ img: string; cx: number; cy: number; rx: number; ry: number; sx?: number; sy?: number; dx?: number; dy?: number; rot?: number; ox?: number; oy?: number; op?: number; filter?: string }> = ({ img, cx, cy, rx, ry, sx = 1, sy = 1, dx = 0, dy = 0, rot = 0, ox, oy, op = 1, filter }) => {
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, black 78%, transparent 100%)`;
  return <Img src={staticFile(`img/${img}`)} style={{ ...FULL, opacity: op, filter, WebkitMaskImage: mask, maskImage: mask, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${sx}, ${sy})`, transformOrigin: `${ox ?? cx}px ${oy ?? cy + ry * 0.75}px` }} />;
};

// 칸마다 몽글 자리(판옮기기.py로 1080x1920에 맞춘 좌표) — 움직임 조각과 하트가 여기서 난다
const MONGLE: Record<string, { cx: number; cy: number; rx: number; ry: number }> = {
  'hook.jpg': { cx: 560, cy: 1320, rx: 340, ry: 340 },
  'open.jpg': { cx: 385, cy: 1260, rx: 350, ry: 440 },
  'rain3b.jpg': { cx: 530, cy: 1080, rx: 400, ry: 380 },
  'tree2b.jpg': { cx: 530, cy: 1530, rx: 490, ry: 210 },
  'lib1.jpg': { cx: 253, cy: 1300, rx: 200, ry: 210 },
  'lib2.jpg': { cx: 612, cy: 1220, rx: 420, ry: 380 },
  'rain1.jpg': { cx: 398, cy: 1300, rx: 250, ry: 255 },
  'rain2.jpg': { cx: 383, cy: 1330, rx: 235, ry: 225 },
  'rain3.jpg': { cx: 525, cy: 1110, rx: 420, ry: 400 },
  'hall1.jpg': { cx: 264, cy: 1440, rx: 200, ry: 215 },
  'hall2.jpg': { cx: 544, cy: 1200, rx: 446, ry: 315 },
  'tree1.jpg': { cx: 225, cy: 1470, rx: 195, ry: 210 },
  'tree2.jpg': { cx: 547, cy: 1390, rx: 470, ry: 220 },
  'greet.jpg': { cx: 350, cy: 1420, rx: 190, ry: 215 },
  'phone.jpg': { cx: 365, cy: 1390, rx: 190, ry: 205 },
  'burst.jpg': { cx: 340, cy: 1255, rx: 200, ry: 210 },
};
const HOOK_BEATS = [0.15, 0.95, 1.7, 2.4];
// 두근두근 칸 — 가슴에서 튀어나온 펠트 하트가 박자마다 뛴다
const LIB2_BEATS = [5.12, 5.32, 5.9, 6.1, 6.5, 6.7, 7.2, 7.4];

const Plate: React.FC<{ i: number; t: number }> = ({ i, t }) => {
  const c = CELLS[i];
  const end = i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL;
  const img = c.next && t >= c.next.at ? c.next.img : c.img;
  const m = MONGLE[img] ?? MONGLE['greet.jpg'];
  let z = interpolate(t, [c.at, end], [1, 1.05], clamp);
  let ox = 540;
  let oy = 1100;
  let dx = 0;
  let dy = 0;
  // 머리 칸 — 심장이 뛸 때마다 들썩, 3.2초까지 몽글 쪽으로 다가간다
  if (i === 0) {
    z = interpolate(t, [0, 3.2], [1.0, 1.1], { ...clamp, easing: Easing.inOut(Easing.quad) });
    ox = 520;
    oy = 1100;
  }
  // 표현 칸 — 말이 터질 때 한 번 당김
  if (c.bubble) {
    z += 0.05 * bump(t, c.at, 0.06, 0.45);
    const second = (c.vo ?? [])[1];
    if (second && !c.next && t >= second.at - 0.05) z *= 1.09;
    ox = m.cx;
    oy = m.cy;
  }
  // 심쿵 — 가슴이 내려앉는 순간 화면이 아래로 툭
  if (img === 'hall2.jpg') dy = 26 * interpolate(t, [c.at, c.at + 0.06, c.at + 0.5], [0, 1, 0], clamp);
  // 인사 칸 — 그 사람 쪽에서 몽글 쪽으로 천천히, 문자 칸 — 휴대폰 쪽으로 다가감
  if (img === 'greet.jpg') {
    z = interpolate(t, [GREET_AT, PHONE_AT], [1.0, 1.08], clamp);
    ox = 520;
    oy = 1300;
  }
  if (img === 'phone.jpg') {
    z = interpolate(t, [PHONE_AT, BURST_AT], [1.06, 1.24], { ...clamp, easing: Easing.out(Easing.cubic) });
    ox = 470;
    oy = 1330;
  }
  if (img === 'burst.jpg') {
    // 불꽃이 터질 때 크게 들썩 → 천천히 뒤로 빠지며 불꽃 전체를 보인다 · 두 번째 불꽃에 한 번 더
    z = interpolate(t, [BURST_AT, BURST_AT + 0.12, BURST_AT + 1.4, TOTAL], [1.22, 1.12, 1.03, 1.0], { ...clamp, easing: Easing.out(Easing.cubic) });
    if (t >= REPLY_AT) z = 1.16 + 0.03 * interpolate(t, [REPLY_AT, TOTAL], [0, 1], clamp);
    ox = t >= REPLY_AT ? 520 : 470;
    oy = t >= REPLY_AT ? 1120 : 1150;
    const s = interpolate(t, [BURST_AT, BURST_AT + 0.7], [1, 0], clamp);
    dx = 12 * s * Math.sin(t * 80);
    dy = 9 * s * Math.cos(t * 67);
  }
  // 몽글의 움직임 — 숨 · 두근 · 녹아내림 · 굳어서 떨림
  let msx = 1 + 0.012 * Math.sin(t * 7.5);
  let msy = 2 - msx;
  let mdx = 0;
  let mdy = 0;
  let mrot = 0;
  for (const v of c.vo ?? []) {
    const b = bump(t, v.at, 0.05, 0.3);
    msx += 0.035 * b;
    msy += 0.035 * b;
  }
  if (img === 'tree2.jpg') {
    const melt = interpolate(t, [c.at, c.at + 1.6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
    msx = 1 + 0.1 * melt + 0.01 * Math.sin(t * 5);
    msy = 1 - 0.09 * melt;
  }
  if (img === 'greet.jpg') {
    const shake = interpolate(t, [GREET_AT + 0.6, GREET_AT + 1.0, PHONE_AT], [0.6, 1, 1.6], clamp);
    mdx = 5 * shake * Math.sin(t * 92);
    mrot = 0.35 * shake * Math.sin(t * 71);
  }
  if (img === 'phone.jpg') mdx = 2.5 * Math.sin(t * 88);
  let mfilter: string | undefined;
  if (i === 0) {
    let thump = 0;
    for (const b of HOOK_BEATS) thump = Math.max(thump, bump(t, b, 0.05, 0.28));
    msx += 0.04 * thump;
    msy += 0.04 * thump;
    mdx = 4 * interpolate(t, [0.7, 1.2], [0, 1], clamp) * Math.sin(t * 92);
    mrot = 0.3 * Math.sin(t * 71) * interpolate(t, [0.7, 1.2], [0, 1], clamp);
    const red = interpolate(t, [0, 3.2], [0, 0.5], clamp);
    mfilter = `saturate(${1 + 0.6 * red}) hue-rotate(${-6 * red}deg) brightness(${1 - 0.05 * red})`;
  }
  if (img === 'greet.jpg' || img === 'phone.jpg') {
    let thump = 0;
    for (const b of HOLD_BEATS) thump = Math.max(thump, bump(t, b, 0.04, 0.22));
    msx += 0.06 * thump;
    msy += 0.06 * thump;
    const red = interpolate(t, [GREET_AT, GREET_AT + 0.7, BURST_AT], [0.1, 0.45, 1], clamp) * (0.8 + 0.2 * thump);
    mfilter = `saturate(${1 + 0.9 * red}) hue-rotate(${-10 * red}deg) brightness(${1 - 0.1 * red}) contrast(${1 + 0.08 * red})`;
  }
  // 그 사람 — 손 흔들며 살짝 들썩
  const boyBob = img === 'greet.jpg' ? -7 * Math.abs(Math.sin((t - GREET_AT) * 5.2)) : 0;
  if (img === 'burst.jpg') mdy = -14 * Math.abs(Math.sin((t - BURST_AT) * 3.2)) * interpolate(t, [BURST_AT, BURST_AT + 0.3], [0, 1], clamp);
  // 휴대폰 — 울리는 동안 흔들림
  const buzz = t >= PHONE_AT && t < PHONE_AT + 0.4 ? 7 * Math.sin((t - PHONE_AT) * 140) : t >= PHONE_AT + 0.48 && t < PHONE_AT + 0.78 ? 7 * Math.sin((t - PHONE_AT) * 140) : 0;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#2a1d16' }}>
      <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px) scale(${z})`, transformOrigin: `${ox}px ${oy}px` }}>
        <Img src={staticFile(`img/${img}`)} style={FULL} />
        {img === 'greet.jpg' ? <Patch img="greet.jpg" cx={830} cy={1130} rx={240} ry={500} dy={boyBob} oy={1600} /> : null}
        {img === 'open.jpg' ? <Patch img="open.jpg" cx={803} cy={1136} rx={125} ry={145} rot={6 * Math.sin(t * 9)} ox={870} oy={1265} /> : null}
        <Patch img={img} cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} sx={msx} sy={msy} dx={mdx} dy={mdy} rot={mrot} filter={mfilter} />
        {img === 'phone.jpg' ? <PhoneScreen t={t} x={550} y={1260} w={67} h={120} rot={0} dx={buzz} /> : null}
        {img === 'lib2.jpg' ? (() => {
          let k = 1;
          for (const b of LIB2_BEATS) k += 0.12 * bump(t, b, 0.04, 0.18);
          return <Patch img="lib2.jpg" cx={612} cy={1344} rx={130} ry={115} sx={k} sy={k} ox={612} oy={1344} />;
        })() : null}
        {img === 'phone.jpg' ? <Patch img="phone.jpg" cx={583} cy={1317} rx={95} ry={115} dx={buzz} rot={buzz * 0.4} /> : null}
        {img === 'burst.jpg' ? <BurstReveal t={t} /> : null}
        {img === 'burst.jpg' ? <PhoneScreen t={t} x={548} y={1172} w={84} h={132} rot={11} dx={0} reply /> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 휴대폰 화면 속 작은 대화 — 그 사람 얼굴 · 받은 문자 줄(· 끝에는 보낸 답장 줄)
const PhoneScreen: React.FC<{ t: number; x: number; y: number; w: number; h: number; rot: number; dx: number; reply?: boolean }> = ({ t, x, y, w, h, rot, dx, reply }) => {
  const lit = interpolate(t, [MSG_AT - 0.1, MSG_AT + 0.05], [0, 1], clamp);
  const sent = reply ? interpolate(t, [REPLY_AT, REPLY_AT + 0.12], [0, 1], clamp) : 0;
  const u = w / 67;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 9 * u, overflow: 'hidden', background: '#FFFDF8', transform: `translateX(${dx}px) rotate(${rot}deg)`, transformOrigin: '50% 50%', boxShadow: `0 0 ${18 * lit}px rgba(255,255,255,${0.9 * lit})` }}>
      <div style={{ position: 'absolute', left: 5 * u, top: 7 * u, width: 15 * u, height: 15 * u, borderRadius: '50%', overflow: 'hidden', opacity: lit }}>
        <Img src={staticFile('img/face.jpg')} style={{ width: '100%', height: '100%' }} />
      </div>
      <div style={{ position: 'absolute', left: 5 * u, top: 26 * u, width: 50 * u, height: 17 * u, borderRadius: 6 * u, background: '#ECE6E1', opacity: lit, fontFamily: KO, fontWeight: 800, fontSize: 6.2 * u, color: INK, lineHeight: `${17 * u}px`, paddingLeft: 3 * u, whiteSpace: 'nowrap', overflow: 'hidden' }} />
      {reply ? <div style={{ position: 'absolute', right: 5 * u, top: 48 * u, width: 40 * u, height: 17 * u, borderRadius: 6 * u, background: ROSE, opacity: sent, fontFamily: KO, fontWeight: 800, fontSize: 6.4 * u, color: '#fff', lineHeight: `${17 * u}px`, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden' }} /> : null}
    </div>
  );
};

// 불꽃 — 문자 판 위로 몽글 머리에서부터 둥글게 번져 나간다(0.35초), 불꽃 덩어리는 계속 숨 쉬듯 부푼다
const BurstReveal: React.FC<{ t: number }> = ({ t }) => {
  const r = interpolate(t, [BURST_AT, BURST_AT + 0.38], [0, 2300], { ...clamp, easing: Easing.out(Easing.cubic) });
  const under = r < 2290;
  const throb = 1 + 0.025 * Math.sin((t - BURST_AT) * 6.5) + 0.05 * bump(t, REPLY_AT, 0.06, 0.6);
  const mask = `radial-gradient(circle ${Math.max(1, r)}px at 340px 1120px, black 86%, transparent 100%)`;
  const glow = `radial-gradient(ellipse 520px 640px at 480px 520px, black 70%, transparent 100%)`;
  return (
    <>
      {under ? <Img src={staticFile('img/phone.jpg')} style={{ ...FULL, transform: 'scale(1.0)' }} /> : null}
      <Img src={staticFile('img/burst.jpg')} style={{ ...FULL, WebkitMaskImage: mask, maskImage: mask }} />
      {/* 불꽃 덩어리만 숨 쉬듯 */}
      <Img src={staticFile('img/burst.jpg')} style={{ ...FULL, WebkitMaskImage: glow, maskImage: glow, opacity: r > 1500 ? 1 : 0, transform: `scale(${throb})`, transformOrigin: '340px 1120px' }} />
    </>
  );
};

// 반짝이 — 머리 칸 · 표현 칸에서 몽글 둘레로 피어오르는 빛 알갱이 · 하트(펠트 판 위 빛이라 그리지 않은 티가 덜 나게 흐리게)
const Hearts: React.FC<{ t: number; from: number; until: number; x: number; y: number; n?: number; spread?: number; rise?: number }> = ({ t, from, until, x, y, n = 12, spread = 260, rise = 620 }) => {
  if (t < from || t >= until) return null;
  const out: React.ReactNode[] = [];
  for (let k = 0; k < n; k++) {
    const t0 = from + ((k * 0.19) % 1.6);
    const s = t - t0;
    if (s < 0 || s > 1.5) continue;
    const side = k % 2 ? 1 : -1;
    const px = x + side * (40 + ((k * 53) % spread)) + side * 30 * Math.sin(s * 3 + k);
    const py = y - rise * (s / 1.5) - 40;
    const size = 34 + ((k * 17) % 34);
    const op = interpolate(s, [0, 0.15, 1.1, 1.5], [0, 0.9, 0.7, 0], clamp);
    out.push(
      <svg key={k} width={size} height={size} viewBox="0 0 32 30" style={{ position: 'absolute', left: px - size / 2, top: py - size / 2, opacity: op, transform: `rotate(${side * 12}deg) scale(${0.7 + 0.3 * Math.min(1, s * 3)})`, filter: 'drop-shadow(0 4px 6px rgba(120,20,40,0.35))' }}>
        <defs>
          <radialGradient id={`h${k}`} cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#FFC2D1" />
            <stop offset="60%" stopColor="#F2577A" />
            <stop offset="100%" stopColor="#C9244D" />
          </radialGradient>
        </defs>
        <path d="M16 29 C 6 21, 0 15, 0 8.5 C 0 3.5, 4 0, 8.5 0 C 12 0, 14.5 2, 16 4.8 C 17.5 2, 20 0, 23.5 0 C 28 0, 32 3.5, 32 8.5 C 32 15, 26 21, 16 29 Z" fill={`url(#h${k})`} />
      </svg>,
    );
  }
  return <>{out}</>;
};

// 비 — 우산 칸에 내리는 빗줄기
const Rain: React.FC<{ t: number }> = ({ t }) => {
  const out: React.ReactNode[] = [];
  for (let k = 0; k < 46; k++) {
    const x = (k * 97) % 1180 - 50;
    const sp = 2600 + ((k * 37) % 700);
    const y = ((t * sp + k * 173) % 2300) - 300;
    out.push(<div key={k} style={{ position: 'absolute', left: x - (y * 0.12), top: y, width: 3, height: 70 + ((k * 13) % 50), background: 'linear-gradient(180deg, rgba(255,255,255,0), rgba(235,242,255,0.75))', transform: 'rotate(7deg)', borderRadius: 2 }} />);
  }
  return <>{out}</>;
};

const Gauge: React.FC<{ i: number; t: number; L: LocPack }> = ({ i, t, L }) => {
  let from = 0;
  let to = 0;
  let at = 0;
  CELLS.forEach((c, k) => {
    if (k <= i && c.bubble) {
      from = to;
      to = c.bubble.gauge;
      at = c.at;
    }
  });
  const v = interpolate(t, [at, at + 0.33], [from, to], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
  // 끝 — 그 사람 앞에서 꽉 찬 하트가 박자마다 부풀며 떨고(속으로 참는 중), 불꽃이 터지면 빠진다
  const holding = t >= GREET_AT && t < BURST_AT;
  const shake = holding ? interpolate(t, [GREET_AT, PHONE_AT, BURST_AT], [2, 4, 7], clamp) * Math.sin(t * 95) : 0;
  let beat = 0;
  if (holding) for (const b of HOLD_BEATS) beat = Math.max(beat, bump(t, b, 0.05, 0.25));
  const grow = holding ? 1 + 0.08 * interpolate(t, [GREET_AT, BURST_AT], [0, 1], clamp) + 0.14 * beat : 1;
  const glow = holding ? 0.5 + 0.5 * beat : 0;
  if (t >= BURST_AT) return null;
  const S = 150;
  const fillTop = 30 * (1 - Math.min(1, v));
  return (
    <div style={{ position: 'absolute', left: 52, top: 770, width: S + 20, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `translateX(${shake}px) scale(${grow})`, transformOrigin: '50% 40%' }}>
      <svg width={S} height={S * 30 / 32} viewBox="-1 -1 34 32" style={{ overflow: 'visible', filter: glow ? `drop-shadow(0 0 ${18 * glow}px rgba(255,80,120,0.9))` : 'drop-shadow(0 6px 10px rgba(40,10,20,0.35))' }}>
        <defs>
          <clipPath id="heartClip">
            <path d="M16 29 C 6 21, 0 15, 0 8.5 C 0 3.5, 4 0, 8.5 0 C 12 0, 14.5 2, 16 4.8 C 17.5 2, 20 0, 23.5 0 C 28 0, 32 3.5, 32 8.5 C 32 15, 26 21, 16 29 Z" />
          </clipPath>
          <linearGradient id="heartFill" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#C9244D" />
            <stop offset="100%" stopColor="#FF8FA8" />
          </linearGradient>
        </defs>
        <path d="M16 29 C 6 21, 0 15, 0 8.5 C 0 3.5, 4 0, 8.5 0 C 12 0, 14.5 2, 16 4.8 C 17.5 2, 20 0, 23.5 0 C 28 0, 32 3.5, 32 8.5 C 32 15, 26 21, 16 29 Z" fill="rgba(255,253,247,0.95)" />
        <rect x={-1} y={fillTop} width={34} height={32} fill="url(#heartFill)" clipPath="url(#heartClip)" />
        <path d="M16 29 C 6 21, 0 15, 0 8.5 C 0 3.5, 4 0, 8.5 0 C 12 0, 14.5 2, 16 4.8 C 17.5 2, 20 0, 23.5 0 C 28 0, 32 3.5, 32 8.5 C 32 15, 26 21, 16 29 Z" fill="none" stroke={INK} strokeWidth={1.6} />
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={3} x2={29} y1={30 * (1 - g)} y2={30 * (1 - g)} stroke={INK} strokeWidth={0.5} strokeDasharray="1.2 1.2" opacity={0.45} clipPath="url(#heartClip)" />)}
      </svg>
      <div style={{ marginTop: 6, fontFamily: L.font, fontWeight: 800, fontSize: 28, color: '#fff', background: 'rgba(28,22,20,0.86)', borderRadius: 12, padding: '4px 10px 6px', whiteSpace: 'nowrap' }}>{L.gauge}</div>
    </div>
  );
};

const FlyHeart: React.FC<{ b: BubbleData; at: number; t: number }> = ({ b, at, t }) => {
  const s0 = at + 0.25;
  const k = interpolate(t, [s0, s0 + 0.5], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  if (t < s0 || k >= 1) return null;
  const x0 = b.side === 'right' ? 920 - b.width + 10 : 160;
  const y0 = b.bottom - 120;
  const x1 = 137;
  const y1 = 840;
  const x = x0 + (x1 - x0) * k;
  const y = y0 + (y1 - y0) * k - 260 * Math.sin(Math.PI * k);
  const size = 84 - 36 * k;
  return (
    <svg width={size} height={size} viewBox="0 0 32 30" style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, filter: 'drop-shadow(0 4px 8px rgba(120,20,40,0.45))' }}>
      <path d="M16 29 C 6 21, 0 15, 0 8.5 C 0 3.5, 4 0, 8.5 0 C 12 0, 14.5 2, 16 4.8 C 17.5 2, 20 0, 23.5 0 C 28 0, 32 3.5, 32 8.5 C 32 15, 26 21, 16 29 Z" fill={ROSE} stroke={INK} strokeWidth={2} />
    </svg>
  );
};

// 눈 맞춤 — 두 얼굴 사이에 반짝이(도서관 칸, 시험 v4 「3~6초 몽글이 가만히」)
const Spark: React.FC<{ t: number; from: number; until: number; a: [number, number]; b: [number, number] }> = ({ t, from, until, a, b }) => {
  if (t < from || t >= until) return null;
  const out: React.ReactNode[] = [];
  for (let k = 0; k < 7; k++) {
    const u = (k + 0.5) / 7;
    const x = a[0] + (b[0] - a[0]) * u;
    const y = a[1] + (b[1] - a[1]) * u - 60 * Math.sin(Math.PI * u);
    const on = interpolate(t, [from + 0.08 * k, from + 0.08 * k + 0.12], [0, 1], clamp);
    const tw = 0.6 + 0.4 * Math.abs(Math.sin((t - from) * 9 + k));
    const sz = 30 * tw * on;
    out.push(<div key={k} style={{ position: 'absolute', left: x - sz / 2, top: y - sz / 2, width: sz, height: sz, background: '#FFE08A', clipPath: 'polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)', filter: 'drop-shadow(0 0 6px rgba(255,220,120,0.9))' }} />);
  }
  return <>{out}</>;
};

const Sit: React.FC<{ text: string; at: number; t: number; L: LocPack }> = ({ text, at, t, L }) => {
  const p = interpolate(t, [at, at + 0.17], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: 'absolute', left: 44, right: 134, top: 276, textAlign: 'center', opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
      <span style={{ display: 'inline-block', background: 'rgba(28,22,20,0.84)', color: '#fff', fontFamily: L.font, fontWeight: 700, fontSize: L.sitSize, lineHeight: Math.max(1.2, L.lineH), padding: '18px 34px 22px', borderRadius: 28, whiteSpace: 'pre-line' }}>{text}</span>
    </div>
  );
};

const Hook: React.FC<{ t: number; L: LocPack }> = ({ t, L }) => {
  const p = interpolate(t, [0, 0.2], [0.92, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: 'absolute', left: 44, right: 134, top: 250, textAlign: 'center', transform: `scale(${p})` }}>
      <span style={{ display: 'inline-block', background: CREAM, border: `7px solid ${INK}`, color: INK, fontFamily: L.font, fontWeight: 800, fontSize: L.hookSize, lineHeight: L.lineH, padding: '20px 44px 28px', borderRadius: 40, whiteSpace: 'pre-line', boxShadow: '0 10px 28px rgba(0,0,0,0.28)' }}>{L.hook}</span>
    </div>
  );
};

const Speech: React.FC<{ b: BubbleData; at: number; t: number; L: LocPack }> = ({ b, at, t, L }) => {
  const p = interpolate(t, [at, at + 0.13], [0.86, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const tailL = Math.max(0, b.tip[0] - 56);
  return (
    <>
      <div style={{ position: 'absolute', bottom: 1920 - b.bottom, ...(b.side === 'right' ? { right: 160 } : { left: 150 }), width: b.width, textAlign: 'center' }}>
        <div style={{ display: 'inline-block', width: '100%', boxSizing: 'border-box', background: CREAM, border: `6px solid ${INK}`, borderRadius: 48, padding: '20px 30px 24px', boxShadow: '0 10px 28px rgba(0,0,0,0.28)', transform: `scale(${p})`, transformOrigin: '50% 100%' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <span style={{ background: ROSE, color: '#fff', fontFamily: EN, fontWeight: 800, fontSize: 42, lineHeight: 1, padding: '9px 22px 11px', borderRadius: 999 }}>{b.n}/4</span>
          </div>
          <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 112, color: INK, lineHeight: 1.14, whiteSpace: 'nowrap' }}>{b.ko}</div>
          <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 52, color: '#5F4E42', lineHeight: 1.15, marginTop: 2 }}>🔊 {L.reads[b.n - 1]}</div>
          <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.meanSize, color: MEAN, lineHeight: L.lineH, marginTop: 8, whiteSpace: 'pre-line' }}>{L.means[b.n - 1]}</div>
        </div>
      </div>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity: p }}>
        <path d={`M ${tailL} ${b.bottom - 8} L ${tailL + 60} ${b.bottom - 8} L ${b.tip[0]} ${b.tip[1]} Z`} fill={CREAM} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        <rect x={tailL + 3} y={b.bottom - 14} width={54} height={9} fill={CREAM} />
      </svg>
    </>
  );
};

// 작은 말풍선 — 그 사람의 말 · 끝 인사(한국어 · 읽기 · 몽골 뜻)
const Small: React.FC<{ t: number; from: number; until: number; left: number; top: number; width: number; ko: string; read: string; mn?: string; tip: [number, number]; L: LocPack; koSize?: number }> = ({ t, from, until, left, top, width, ko, read, mn, tip, L, koSize = 78 }) => {
  if (t < from || t >= until) return null;
  const p = interpolate(t, [from, from + 0.13], [0.8, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
  // 높이를 정해 두어 꼬리가 늘 상자 밑에서 나온다(꼬리 덮개를 글 위에 얹지 않는다 — v1에서 몽골어 줄을 가렸다)
  const h = Math.round(koSize * 1.14 + 42 * 1.15 + (mn ? 46 * L.lineH + 4 : 0) + 28 + 12 + 6);
  const bx = Math.min(Math.max(tip[0], left + 70), left + width - 70);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: p > 0.8 ? 1 : 0 }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0 }}>
        <path d={`M ${bx - 32} ${top + h - 14} L ${bx + 32} ${top + h - 14} L ${tip[0]} ${tip[1]} Z`} fill={CREAM} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      </svg>
      <div style={{ position: 'absolute', left, top, width, height: h, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', background: CREAM, border: `6px solid ${INK}`, borderRadius: 40, padding: '8px 18px 10px', boxShadow: '0 10px 24px rgba(0,0,0,0.28)', transform: `scale(${p})`, transformOrigin: `${((bx - left) / width) * 100}% 100%` }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: koSize, color: INK, lineHeight: 1.14, whiteSpace: 'nowrap' }}>{ko}</div>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 42, color: '#5F4E42', lineHeight: 1.15 }}>🔊 {read}</div>
        {mn ? <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 46, color: MEAN, lineHeight: L.lineH, marginTop: 4, whiteSpace: 'nowrap' }}>{mn}</div> : null}
      </div>
    </div>
  );
};

// 문자 알림 — 휴대폰 옆에 뜨는 알림 카드(앱 화면을 펠트로 그리지 않고 깔끔한 알림 꼴로)
const Message: React.FC<{ t: number; L: LocPack }> = ({ t, L }) => {
  if (t < MSG_AT) return null;
  const p = interpolate(t, [MSG_AT, MSG_AT + 0.22], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.5)) });
  // 불꽃이 터지면 위로 올라가 작아지고, 답장이 같은 대화창 안 아래에 붙는다
  const up = interpolate(t, [BURST_AT, BURST_AT + 0.3], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const sent = interpolate(t, [REPLY_AT, REPLY_AT + 0.2], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) });
  const top = 760 + (520 - 760) * up;
  const sc = (0.9 + 0.1 * p) * (1 - 0.1 * up);
  return (
    <div style={{ position: 'absolute', left: 70, width: 940, top, transform: `translateY(${(1 - p) * -40}px) scale(${sc})`, opacity: p, transformOrigin: '50% 0%' }}>
      <div style={{ background: 'rgba(255,253,247,0.97)', borderRadius: 44, padding: '20px 30px 26px', boxShadow: '0 18px 40px rgba(40,10,20,0.38)', border: `5px solid ${INK}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
          <Img src={staticFile('img/face.jpg')} style={{ width: 104, height: 104, borderRadius: '50%', border: `5px solid ${ROSE}`, objectFit: 'cover', flexShrink: 0 }} />
          <div style={{ background: '#EFE8E2', borderRadius: '10px 36px 36px 36px', padding: '12px 26px 16px' }}>
            <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 80, color: INK, lineHeight: 1.16, whiteSpace: 'nowrap' }}>{TEXT.msgKo}</div>
            <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 50, color: MEAN, lineHeight: L.lineH, marginTop: 4 }}>{L.msgMn}</div>
          </div>
        </div>
        {t >= REPLY_AT ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, transform: `translateY(${(1 - sent) * 30}px) scale(${0.85 + 0.15 * sent})`, opacity: Math.min(1, sent * 1.4), transformOrigin: '100% 0%' }}>
            <div style={{ background: ROSE, borderRadius: '36px 10px 36px 36px', padding: '12px 30px 18px', textAlign: 'center', border: `4px solid ${INK}` }}>
              <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 92, color: '#fff', lineHeight: 1.12, whiteSpace: 'nowrap' }}>{TEXT.replyMsgKo}</div>
              <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 42, color: '#FFE3EA', lineHeight: 1.15 }}>🔊 {L.replyMsgRead}</div>
              <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 48, color: '#fff', lineHeight: L.lineH, marginTop: 2 }}>{L.replyMsgMn}</div>
            </div>
          </div>
        ) : null}
      </div>
      {up < 0.5 ? (
        <svg width={940} height={300} style={{ position: 'absolute', left: 0, top: '100%', overflow: 'visible', opacity: 1 - up * 2 }}>
          <path d="M 470 -6 L 540 -6 L 510 400" fill="rgba(255,253,247,0.97)" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        </svg>
      ) : null}
    </div>
  );
};

// 속마음 — 몽글 머리 위 생각 구름 「(속으로) 반했어!!」(시험 v2: 작은 딱지라 못 읽음)
const Thought: React.FC<{ t: number; at: number; L: LocPack; left: number; top: number; dots: [number, number][]; w?: number }> = ({ t, at, L, left, top, dots, w = 470 }) => {
  const q2 = interpolate(t, [at, at + 0.17], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
  const beat = 1 + 0.04 * Math.abs(Math.sin((t - at) * 8));
  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity: q2 }}>
        <circle cx={dots[0][0]} cy={dots[0][1]} r={16} fill={CREAM} stroke={INK} strokeWidth={5} />
        <circle cx={dots[1][0]} cy={dots[1][1]} r={24} fill={CREAM} stroke={INK} strokeWidth={5} />
      </svg>
      <div style={{ position: 'absolute', left, top, width: w, height: 230, borderRadius: 120, background: CREAM, border: `6px solid ${INK}`, boxShadow: '0 10px 24px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: `scale(${q2 * beat})`, transformOrigin: '50% 100%' }}>
        <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 44, color: '#5F4E42', lineHeight: L.lineH }}>({L.inner})</div>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: w < 450 ? 94 : 104, lineHeight: 1.05, color: ROSE }}>반했어!!</div>
      </div>
    </>
  );
};

const End: React.FC<{ t: number; L: LocPack; bare: boolean }> = ({ t, L, bare }) => {
  const q = interpolate(t, [END_LINE_AT, END_LINE_AT + 0.2], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) }) * interpolate(t, [BURST_AT - 0.05, BURST_AT + 0.15], [1, 0], clamp);
  return (
    <>
      {/* 그 사람 「안녕!」 · 몽글 「안녕하세요…」(굳어서 존댓말) */}
      <Small t={t} from={GREET_AT + 0.05} until={PHONE_AT} left={560} top={470} width={440} ko={TEXT.hiKo} read={L.hiRead} mn={L.hiMn} tip={[720, 760]} L={L} koSize={84} />
      <Small t={t} from={GREET_AT + 0.78} until={PHONE_AT} left={240} top={900} width={520} ko={TEXT.replyKo} read={L.replyRead} mn={L.replyMn} tip={[330, 1230]} L={L} koSize={78} />
      {!bare && t >= INNER_AT && t < PHONE_AT ? <Thought t={t} at={INNER_AT} L={L} left={96} top={520} dots={[[300, 830], [330, 780]]} /> : null}
      <Hearts t={t} from={BURST_AT + 0.1} until={TOTAL} x={340} y={1150} n={16} spread={420} rise={900} />
      <Message t={t} L={L} />
      {/* 불꽃이 터지는 순간 — 분홍 빛 한 번 */}
      {t >= BURST_AT && t < BURST_AT + 0.3 ? <AbsoluteFill style={{ background: `rgba(255,210,225,${interpolate(t, [BURST_AT, BURST_AT + 0.05, BURST_AT + 0.3], [0, 0.6, 0], clamp)})` }} /> : null}
      {/* 맺음 줄 — 그 사람 앞에서는 속으로만 */}
      {!bare && q > 0 ? (
        <div style={{ position: 'absolute', left: 36, right: 126, top: 240, textAlign: 'center', opacity: q, transform: `scale(${0.9 + 0.1 * q})` }}>
          <span style={{ display: 'inline-block', background: CREAM, border: `7px solid ${INK}`, color: INK, fontFamily: L.font, fontWeight: 800, fontSize: L.endSize, lineHeight: L.lineH, padding: '14px 38px 22px', borderRadius: 34 }}>
            {L.end1}
            <br />
            <span style={{ color: ROSE }}>{L.end2}</span>
          </span>
        </div>
      ) : null}
    </>
  );
};

// 영상 전체에 까는 배경음 — 앞뒤로 살짝 페이드하고, 말 둘레에서만 낮춘다. 불꽃이 터지기 직전 한 번 숨을 죽인다
const VO_SPANS = [...CELLS.flatMap((c) => c.vo ?? []), REPLY_VO].map((v) => [fr(v.at), fr(v.at + VO_LEN[v.id])]);
const bgmVol = (f: number) => {
  const duck = Math.min(...VO_SPANS.map(([a, b]) => interpolate(f, [a - 6, a, b, b + 6], [1, BGM_DUCK, BGM_DUCK, 1], clamp)));
  const hush = interpolate(f, [fr(PHONE_AT) - 3, fr(PHONE_AT) + 3, fr(BURST_AT) - 2, fr(BURST_AT) + 4], [1, 0.35, 0.35, 1.15], clamp);
  return BGM_VOL * MASTER * duck * hush * interpolate(f, [0, 8, TOTAL_FRAMES - 30, TOTAL_FRAMES], [0, 1, 1, 0], clamp);
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('sfx/bgm.wav')} volume={bgmVol} />
    {CELLS.flatMap((c) => c.vo ?? []).map((v) => (
      <Sequence key={`${v.id}-${v.at}`} from={fr(v.at)} layout="none">
        <Audio src={staticFile(`vo/${v.id}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    <Sequence from={fr(REPLY_VO.at)} layout="none">
      <Audio src={staticFile(`vo/${REPLY_VO.id}.wav`)} volume={MASTER} />
    </Sequence>
    {SFX.map((s) => (
      <Sequence key={`${s.file}-${s.at}`} from={fr(s.at)} layout="none">
        <Audio src={staticFile(`sfx/${s.file}`)} volume={MASTER * s.vol} />
      </Sequence>
    ))}
  </>
);

export const Film: React.FC<{ loc?: Loc; bare?: boolean }> = ({ loc = 'mn', bare = false }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const i = cellAt(t);
  const c = CELLS[i];
  const L = LOCS[loc];
  const sitN = CELLS.slice(0, i + 1).filter((x) => x.sit).length - 1;
  const img = c.next && t >= c.next.at ? c.next.img : c.img;
  const m = MONGLE[img] ?? MONGLE['greet.jpg'];
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a1d16' }}>
      <Plate i={i} t={t} />
      {img.startsWith('rain') ? <Rain t={t} /> : null}
      {c.bubble ? <Hearts t={t} from={c.at} until={(CELLS[i + 1]?.at ?? TOTAL)} x={m.cx} y={m.cy - 260} n={10} spread={300} rise={420} /> : null}
      {i > 0 && t < BURST_AT ? <Gauge i={i} t={t} L={L} /> : null}
      {i === 0 ? <Hook t={t} L={L} /> : null}
      {i === 0 ? <Small t={t} from={0.72} until={3.2} left={470} top={500} width={440} ko={TEXT.replyKo} read={L.replyRead} mn={L.replyMn} tip={[600, 850]} L={L} koSize={74} /> : null}
      {i === 0 && t >= OPEN_INNER_AT ? <Thought t={t} at={OPEN_INNER_AT} L={L} left={24} top={520} w={420} dots={[[290, 812], [262, 772]]} /> : null}
      {c.sit ? <Sit text={L.sits[sitN]} at={c.at} t={t} L={L} /> : null}
      {img === 'hall1.jpg' ? <Small t={t} from={12.6} until={14.4} left={540} top={560} width={460} ko={TEXT.call.ko} read={L.callRead} mn={L.callMn} tip={[800, 880]} L={L} koSize={84} /> : null}
      {c.bubble ? <Speech b={c.bubble} at={c.at} t={t} L={L} /> : null}
      {c.bubble && t < BURST_AT ? <FlyHeart b={c.bubble} at={c.at} t={t} /> : null}
      {img === 'lib1.jpg' ? <Spark t={t} from={3.55} until={5.0} a={[300, 1120]} b={[700, 1060]} /> : null}
      {t >= GREET_AT ? <End t={t} L={L} bare={bare} /> : null}
      <Sound />
    </AbsoluteFill>
  );
};

// 한 장면 먼저(제작 절차 「오마주」 2) — 끝 장면만 떼어 심사에 보이는 판. 맺음 줄 · 속마음 딱지 같은 설명 글은 뺀다
export const SCENE_FROM = GREET_AT;
export const SceneFilm: React.FC = () => (
  <Sequence from={-fr(SCENE_FROM)} layout="none">
    <Film bare />
  </Sequence>
);
