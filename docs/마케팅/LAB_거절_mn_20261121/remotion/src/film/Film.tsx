// LAB 몽골 M68 「거절할 때 네 마디」(11-21) — 회식 자리에서 부장님 잔에 「싫어요!」 → 자리가 꽁꽁 언다 → ✗(윗사람에게는 안 돼요)
// → 네 마디로 다시 거절할 때마다 얼음이 녹는다(괜찮아요 · 다음에요 · 좀 생각해 볼게요 · 마음만 받을게요) → 선배 「노래방 가자!」 → 몽글 「다음에요~」 → 이번엔 선배만 언다 → 끝 줄.
// 원본 Dana Kim 「한국에선 '감사합니다'라고 안 해요」(303uDpWBcg4)의 뼈대 — 머리 칸 · 틀린 말 ✗ · 진짜 쓰는 말 · 반전 끝.
// 그림은 장면마다 구운 한 장(누끼 없음) — 같은 판을 부드러운 타원 가면으로 겹쳐 그 자리만 움직인다(M63 · M64 본뜸).
// 말은 말한 인형에게서 꼬리가 나오는 말풍선(LAB 교훈 L21). 맞는 말은 초록 ✓, 틀린 말은 빨강 ✗(제작 절차 「맞는 말 · 틀린 말」 — 본뜬 코드 LAB_사요찍어요_mn_20261116).
// 판본 틀: 그 나라 글과 글꼴 · 글자 크기는 판본 꾸러미 p(./판본/<KEY>.json)에서 받는다. 그림 · 한국어 · 소리 · 박자 · 카메라는 그대로다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import {
  BGM, BGM_FROZEN, BOSS_FACE, CAM, CELLS, DRIP_FROM, DRIP_TO, END_AT, ENV_AT, ENVELOPE, FACE_AT, FINE_AT, FPS, FREEZE2_AT, FREEZE_AT, GLASS_HAND, LAUGH_BOSS, LAUGH_MATE,
  Line, LINES, NOD, TTO_AT, CRINGE2_AT, CRINGE_AT, MIC_ARM, OPEN_BOSS, OPEN_MATE, OPEN_SENIOR, MIC_AT, MONGLE, NEXT_AT, NG_AT, PHONE_NEXT, PHONE_THINK, PUSH_AT, SENIOR, SFX, SWEAT, TAIL, THINK_AT, TOTAL, WIPE,
} from './data';
import { LocPack } from './판본';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2B2522';
const CREAM = '#FFFDF7';
const MEAN = '#7E3B86'; // 뜻 줄 — 자주(맞음 · 틀림이 아닌 글에 초록 · 빨강을 쓰지 않는다)
const OK = '#0A9A66';
const NG = '#D92D20';
const MONGLE_EDGE = '#D88A5E'; // 몽글 말풍선 테두리(따뜻한 살구 — 빨강과 다르게)
const SENIOR_EDGE = '#4E7FC0'; // 선배 말풍선 테두리(하늘색 셔츠)
const BOSS_EDGE = '#3B4A7A'; // 부장님(남색 양복)
const MATE_EDGE = '#C79A2E'; // 동료(크림 카디건 — 진한 겨자)
const EDGE: Record<string, string> = { m: MONGLE_EDGE, s: SENIOR_EDGE, b: BOSS_EDGE, d: MATE_EDGE };
const SH = '0 3px 0 rgba(12,10,24,0.5), 0 5px 18px rgba(8,6,16,0.62)';
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
const bump = (t: number, at: number, up = 0.05, down = 0.35) => interpolate(t, [at - 0.02, at + up, at + down], [0, 1, 0], clamp);
const Glow: React.FC<{ x: number; y: number; w: number; h: number; a?: number }> = ({ x, y, w, h, a = 0.5 }) => (
  <div style={{ position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, background: `radial-gradient(ellipse at 50% 50%, rgba(10,8,22,${a}) 0%, rgba(10,8,22,${a * 0.55}) 45%, rgba(10,8,22,0) 72%)` }} />
);

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

// 칸마다 카메라(배율 · 축) — 말풍선 꼬리 끝도 이 값으로 옮긴다
const cam = (i: number, t: number) => {
  const c = CELLS[i];
  const end = i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL;
  const k = CAM[c.img];
  let z = interpolate(t, [c.at, end], [k.z0, k.z1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  let dx = 0;
  let dy = 0;
  if (c.img === 'open.jpg') {
    // 부장님이 잔을 더 내미는 0.9초에 카메라를 한 번에 당긴다 — 원본 첫 2초의 두 박자(0.9 · 1.8초) 가운데 첫 박(나란히 검사 「첫 2초 박자 1」). 몽글(884)이 화면 안에 남게 옆으로 민다
    const punch = interpolate(t, [PUSH_AT, PUSH_AT + 0.07], [0, 1], clamp);
    z += 0.1 * punch;
    dx -= 26 * punch;
  }
  if (c.img === 'freeze.jpg') {
    // 언 부장님 얼굴 쪽으로 다가간다(원본 3.3초 박자) → ✗에 혼자 안 언 몽글 쪽으로 미끄러진다(첫 컷 다른 눈 v1 뜻풀이 — ✗ 뒤 행동 변화)
    z = interpolate(t, [FACE_AT, FACE_AT + 0.45], [1.0, 1.18], { ...clamp, easing: Easing.out(Easing.cubic) });
    dx -= interpolate(t, [NG_AT, NG_AT + 0.45], [0, 90], { ...clamp, easing: Easing.inOut(Easing.cubic) }); // 1.18배에서 오른쪽 끝이 화면 안(1084px)에 남는 만큼만
  }
  // 얼어붙는 순간 화면이 떨린다
  const sh = (at: number) => interpolate(t, [at, at + 0.3], [1, 0], clamp);
  if (c.img === 'freeze.jpg') {
    dx += 7 * sh(FREEZE_AT) * Math.sin(t * 95);
    dy += 4 * sh(FREEZE_AT) * Math.sin(t * 71);
  }
  if (c.img === 'freeze2.jpg') {
    dx = 7 * sh(FREEZE2_AT) * Math.sin(t * 95);
    dy = 4 * sh(FREEZE2_AT) * Math.sin(t * 71);
  }
  return { z, ox: k.ox, oy: k.oy, dx, dy };
};
const onScreen = (i: number, t: number, p: [number, number]): [number, number] => {
  const { z, ox, oy, dx, dy } = cam(i, t);
  return [ox + (p[0] - ox) * z + dx, oy + (p[1] - oy) * z + dy];
};

const Patch: React.FC<{ img: string; cx: number; cy: number; rx: number; ry: number; sx?: number; sy?: number; dx?: number; dy?: number; rot?: number; ox?: number; oy?: number }> = ({ img, cx, cy, rx, ry, sx = 1, sy = 1, dx = 0, dy = 0, rot = 0, ox, oy }) => {
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, black 78%, transparent 100%)`;
  return <Img src={staticFile(`img/${img}`)} style={{ ...FULL, WebkitMaskImage: mask, maskImage: mask, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${sx}, ${sy})`, transformOrigin: `${ox ?? cx}px ${oy ?? cy + ry * 0.75}px` }} />;
};

// 얼음이 한 점에서 번져 나가며 앞 그림을 덮는다
const FrostWipe: React.FC<{ img: string; from: [number, number]; at: number; t: number }> = ({ img, from, at, t }) => {
  const r = interpolate(t, [at, at + WIPE], [80, 2300], clamp); // 고르게 — 0.25초마다 번진 자리가 보이게
  const mask = `radial-gradient(circle ${r}px at ${from[0]}px ${from[1]}px, black 82%, transparent 100%)`;
  return <Img src={staticFile(`img/${img}`)} style={{ ...FULL, WebkitMaskImage: mask, maskImage: mask }} />;
};

const Plate: React.FC<{ i: number; t: number }> = ({ i, t }) => {
  const c = CELLS[i];
  const img = c.img;
  const { z, ox, oy, dx, dy } = cam(i, t);
  const m = MONGLE[img];
  // 몽글 — 늘 둥실(밑단을 축으로 늘였다 줄이기만)
  let msx = 1 + 0.012 * Math.sin(t * 5.5);
  let msy = 2 - msx + 0.014 * Math.sin(t * 2.6);
  let mrot = 0;
  for (const l of LINES) {
    if (l.who !== 'm') continue;
    const b = bump(t, l.voAt, 0.05, 0.3);
    msx += 0.025 * b;
    msy += 0.025 * b;
  }
  if (img === 'freeze.jpg') {
    // 혼자 안 언 몽글 — 움찔 작아지며 떤다
    // 첫 컷 다른 눈 v1 #26 · 뜻풀이: 혼자 안 언 몽글이 같은 자세로 굳어 보임 · ✗ 뒤 행동 변화가 없음 → 크게 떨고, ✗에 움찔 작아지며 뒤로 기운다
    const shrink = interpolate(t, [NG_AT, NG_AT + 0.25], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
    // 11-21 시안 v2: 17% 줄이면 밑의 원래 몸이 두 겹으로 비친다 — 움찔은 5%까지만, 행동 변화는 카메라가 몽글 쪽으로 미끄러지는 것으로(cam)
    mrot = 3 * Math.sin(t * 40) + 3 * shrink;
    msx -= 0.03 * shrink;
    msy -= 0.05 * shrink;
  }
  if (img === 'cringe.jpg') {
    // 움찔 — 들어오자마자 찌부러졌다 떨린다
    const sq = interpolate(t, [CRINGE_AT, CRINGE_AT + 0.08, CRINGE_AT + 0.35], [0, 1, 0.35], { ...clamp, easing: Easing.out(Easing.quad) });
    msx += 0.05 * sq;
    msy -= 0.06 * sq;
    mrot = 2.5 * Math.sin(t * 42);
  }
  if (img === 'cringe2.jpg') mrot = 2 * Math.sin(t * 44);
  if (img === 'fine.jpg') mrot = -7 * interpolate(t, [FINE_AT + 0.1, FINE_AT + 0.5], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) }) + 1.5 * Math.sin(t * 2.4); // 공손히 옆으로 기울임
  if (img === 'next.jpg') mrot = 6 * interpolate(t, [NEXT_AT + 0.1, NEXT_AT + 0.5], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) }); // 미안한 듯 뒤로
  if (img === 'think.jpg') mrot = 5 * Math.sin((t - THINK_AT) * 3.2); // 갸웃갸웃 — 생각하는 척
  if (img === 'envelope.jpg') {
    // 꾸벅 — 몸을 앞(왼쪽)으로 숙였다 편다
    mrot = -12 * interpolate(t, [ENV_AT + 0.2, ENV_AT + 0.55, ENV_AT + 1.3, ENV_AT + 1.7], [0, 1, 1, 0.2], { ...clamp, easing: Easing.inOut(Easing.quad) });
  }
  if (img === 'mic.jpg') mrot = 3 * Math.sin((t - MIC_AT) * 4);
  if (img === 'freeze2.jpg') {
    mrot = 1.3 * Math.sin(t * 40);
    msy -= 0.04 * interpolate(t, [FREEZE2_AT + 0.2, FREEZE2_AT + 0.5], [0, 1], clamp);
  }
  // 첫 칸 — 부장님 잔 든 손이 앞으로
  const gdx = img === 'open.jpg' ? -10 * bump(t, PUSH_AT, 0.12, 0.7) + 2 * Math.sin(t * 3) : 0;
  // 폰 · 봉투 · 마이크 — 내미는 손이 살짝 흔들린다
  const pnx = img === 'next.jpg' ? 5 * Math.sin((t - NEXT_AT) * 7) * interpolate(t, [NEXT_AT, NEXT_AT + 1.2], [1, 0.3], clamp) : 0;
  const ptx = img === 'think.jpg' ? 6 * Math.sin((t - THINK_AT) * 6) : 0;
  const evx = img === 'envelope.jpg' ? -10 * interpolate(t, [ENV_AT, ENV_AT + 0.3], [1, 0], { ...clamp, easing: Easing.out(Easing.cubic) }) + 3 * Math.sin((t - ENV_AT) * 5) : 0;
  const mic = img === 'mic.jpg' ? 7 * Math.sin((t - MIC_AT) * 7) : 0;
  // 몽글이 거절한 뒤 권한 사람이 웃으며 두 번 끄덕인다(볼 이유 opus v1 — 거절을 들은 상대의 반응이 없다)
  const nl = LINES.find((l) => l.nodAt !== undefined && l.nodAt >= c.at && l.nodAt < (i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL));
  const nod = nl?.nodAt !== undefined ? 6 * Math.max(0, Math.sin((Math.PI * (t - nl.nodAt)) / 0.28)) * (t >= nl.nodAt && t < nl.nodAt + 0.56 ? 1 : 0) : 0;
  // 끝 — 웃음으로 들썩
  const laugh = img === 'freeze2.jpg' ? Math.abs(Math.sin((t - FREEZE2_AT) * 9)) * interpolate(t, [FREEZE2_AT + 0.35, FREEZE2_AT + 0.6], [0, 1], clamp) : 0;
  return (
    <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px) scale(${z})`, transformOrigin: `${ox}px ${oy}px` }}>
      <Img src={staticFile(`img/${img}`)} style={FULL} />
      {img === 'open.jpg' ? (
        <>
          <Patch img={img} {...OPEN_SENIOR} sy={1 + 0.025 * Math.abs(Math.sin(t * 7))} />
          <Patch img={img} {...OPEN_MATE} sy={1 + 0.02 * Math.abs(Math.sin(t * 6 + 1))} rot={1.5 * Math.sin(t * 3)} />
          <Patch img={img} {...OPEN_BOSS} rot={-2.5 * bump(t, PUSH_AT, 0.15, 0.7) + 1 * Math.sin(t * 2.5)} ox={OPEN_BOSS.cx + 60} oy={OPEN_BOSS.cy + 260} />
          <Patch img={img} {...GLASS_HAND} dx={gdx} />
        </>
      ) : null}
      {img === 'next.jpg' ? <Patch img={img} {...PHONE_NEXT} rot={pnx * 0.4} dx={pnx} /> : null}
      {img === 'think.jpg' ? <Patch img={img} {...PHONE_THINK} rot={ptx * 0.4} /> : null}
      {img === 'envelope.jpg' ? <Patch img={img} {...ENVELOPE} dx={evx} /> : null}
      {img === 'mic.jpg' ? <Patch img={img} cx={MIC_ARM.cx} cy={MIC_ARM.cy} rx={MIC_ARM.rx} ry={MIC_ARM.ry} rot={mic} ox={MIC_ARM.px} oy={MIC_ARM.py} /> : null}
      {img === 'freeze2.jpg' ? (
        <>
          <Patch img={img} {...LAUGH_BOSS} sy={1 + 0.03 * laugh} rot={-2 * laugh} />
          <Patch img={img} {...LAUGH_MATE} sy={1 + 0.03 * laugh} rot={2 * laugh} />
        </>
      ) : null}
      {NOD[img] ? <Patch img={img} {...NOD[img]} rot={nod} ox={NOD[img].cx} oy={NOD[img].cy + NOD[img].ry * 0.95} /> : null}
      {m ? <Patch img={img} cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} sx={msx} sy={msy} rot={mrot} /> : null}
    </AbsoluteFill>
  );
};

// 얼어붙는 칸의 앞 그림 — 얼음이 덮기 전까지 앞 그림을 밑에 깐다
const FreezeLayer: React.FC<{ i: number; t: number }> = ({ i, t }) => {
  const c = CELLS[i];
  if (c.img !== 'freeze.jpg' && c.img !== 'freeze2.jpg') return null;
  if (t >= c.at + WIPE + 0.05) return null;
  const prev = c.img === 'freeze.jpg' ? 'open.jpg' : 'mic.jpg';
  const from: [number, number] = c.img === 'freeze.jpg' ? [MONGLE['open.jpg'].cx, MONGLE['open.jpg'].cy] : [SENIOR.x, SENIOR.y];
  const { z, ox, oy, dx, dy } = cam(i, t);
  return (
    <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px) scale(${z})`, transformOrigin: `${ox}px ${oy}px` }}>
      <Img src={staticFile(`img/${prev}`)} style={FULL} />
      <FrostWipe img={c.img} from={from} at={c.at} t={t} />
    </AbsoluteFill>
  );
};

// 언 칸 — 찬 김이 천천히 흐른다 · 얼어붙는 순간 흰 번쩍
const Cold: React.FC<{ i: number; t: number }> = ({ i, t }) => {
  const c = CELLS[i];
  if (!['freeze.jpg', 'freeze2.jpg', 'cringe.jpg', 'cringe2.jpg'].includes(c.img)) return null;
  const flash = c.img === 'cringe.jpg' || c.img === 'cringe2.jpg' ? 0 : interpolate(t, [c.at, c.at + 0.05, c.at + 0.25], [0, 0.2, 0], clamp);
  const x = 540 + 120 * Math.sin((t - c.at) * 0.9);
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 700px 500px at ${x}px 1100px, rgba(220,236,255,0.16), rgba(220,236,255,0) 70%)` }} />
      <div style={{ position: 'absolute', inset: 0, background: `rgba(235,245,255,${flash})` }} />
    </>
  );
};

// 녹는 물방울 — 괜찮아 칸에서 잔 밑으로 똑똑
const Drips: React.FC<{ i: number; t: number }> = ({ i, t }) => {
  if (CELLS[i].img !== 'fine.jpg') return null;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0 }}>
      {[0, 1, 2].map((k) => {
        const u = (((t - FINE_AT) * 1.4 + k / 3) % 1 + 1) % 1;
        const [x, y0] = onScreen(i, t, DRIP_FROM);
        const [, y1] = onScreen(i, t, [DRIP_FROM[0], DRIP_TO]);
        const y = y0 + (y1 - y0) * u * u;
        return <ellipse key={k} cx={x + (k - 1) * 6} cy={y} rx={7} ry={10} fill="rgba(225,240,255,0.85)" opacity={Math.sin(Math.PI * Math.min(1, u * 1.1))} />;
      })}
    </svg>
  );
};

// 머리 글 — 0~1.5초. 숫자로 얻는 것을 약속한다(머리말 「몽골 편 고르기」 2)
const Hook: React.FC<{ pk: LocPack; t: number }> = ({ pk, t }) => {
  if (t >= NO_AT_HIDE) return null;
  const p = interpolate(t, [0, 0.2], [0.92, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const a = interpolate(t, [NO_AT_HIDE - 0.12, NO_AT_HIDE], [1, 0], clamp);
  return (
    <div style={{ opacity: a }}>
      <Glow x={540} y={420} w={1100} h={520} a={0.6} />
      <div style={{ position: 'absolute', left: 70, right: 70, top: 300, textAlign: 'center', transform: `scale(${p})`, color: CREAM, fontFamily: pk.font, fontWeight: 800, fontSize: pk.hookSize, lineHeight: Math.max(1.14, pk.lineH), whiteSpace: 'pre-line', textShadow: SH }}>{pk.hook}</div>
    </div>
  );
};
const NO_AT_HIDE = 1.55;

const Stamp: React.FC<{ kind: 'ok' | 'ng'; q: number }> = ({ kind, q }) => (
  <div style={{ position: 'absolute', right: -50, top: -54, width: 104, height: 104, borderRadius: 999, background: kind === 'ng' ? NG : OK, border: `7px solid ${CREAM}`, boxShadow: '0 6px 14px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: q, transform: `scale(${0.6 + 0.4 * q}) rotate(${kind === 'ng' ? 8 : -8}deg)` }}>
    <svg width={58} height={58} viewBox="0 0 58 58">
      {kind === 'ng' ? <path d="M12 12 L46 46 M46 12 L12 46" stroke="#fff" strokeWidth={10} strokeLinecap="round" fill="none" /> : <path d="M9 31 L23 45 L49 14" stroke="#fff" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
    </svg>
  </div>
);

// 말풍선 — 말한 인형에게서 꼬리(L21). 뜻 · 한글 · 읽는 법. 네 마디는 「n / 4」, 맞는 말 ✓ · 틀린 말 ✗ 도장
const Bubble: React.FC<{ pk: LocPack; l: Line; i: number; t: number }> = ({ pk, l, i, t }) => {
  if (t < l.at || t >= l.until) return null;
  const img = CELLS[i].img;
  const tail = TAIL[img]?.[l.who];
  const p = interpolate(t, [l.at, l.at + 0.14], [0.85, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const markAt = l.markAt ?? l.voAt + 0.35;
  const q = l.mark ? interpolate(t, [markAt, markAt + 0.16], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) }) : 0;
  const ng = l.mark === 'ng' && t >= markAt; // q > 0은 되튐 이징이 0에서 2e-16을 내 처음부터 참이 된다(11-21 시안 1)
  const edge = ng ? NG : EDGE[l.who];
  const { left, top, width } = l.boxBy?.[img] ?? l.box;
  const h = l.h ?? 290;
  const up = tail?.up;
  const rootY = up ? top + 8 : top + h - 8;
  const tip = tail ? onScreen(i, t, tail.tip) : null;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: Math.min(1, (p - 0.85) / 0.1) }}>
      {tail && tip ? (
        <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, filter: 'drop-shadow(0 8px 16px rgba(8,6,16,0.35))' }}>
          <path d={`M ${tail.root - 32} ${rootY} L ${tail.root + 32} ${rootY} L ${tip[0]} ${tip[1]} Z`} fill={CREAM} stroke={edge} strokeWidth={7} strokeLinejoin="round" />
        </svg>
      ) : null}
      <div style={{ position: 'absolute', left, top, width, height: h, boxSizing: 'border-box', background: CREAM, border: `7px solid ${edge}`, borderRadius: 46, boxShadow: '0 10px 28px rgba(8,6,16,0.35)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', transform: `scale(${p})`, transformOrigin: up ? '60% 0%' : '60% 100%' }}>
        {tail ? <div style={{ position: 'absolute', left: tail.root - left - 26, [up ? 'top' : 'bottom']: -9, width: 52, height: 14, background: CREAM } as React.CSSProperties} /> : null}
        {l.mark ? <Stamp kind={l.mark} q={q} /> : null}
        <div style={{ fontFamily: pk.font, fontWeight: 800, fontSize: pk.meanSize, color: MEAN, lineHeight: Math.max(1.14, pk.lineH), whiteSpace: 'pre-line' }}>{pk.means[l.k]}</div>
        <div style={{ position: 'relative', fontFamily: KO, fontWeight: 900, fontSize: l.koSize, color: ng ? NG : INK, lineHeight: 1.1, whiteSpace: 'nowrap', marginTop: 2 }}>
          {l.ko}
          {ng ? <div style={{ position: 'absolute', left: -10, right: -10, top: '52%', height: 9, background: NG, borderRadius: 5, transform: `scaleX(${q})`, transformOrigin: '0% 50%' }} /> : null}
        </div>
        {l.mark === 'ok' && pk.okPill ? (
          <div style={{ position: 'absolute', left: 26, bottom: -34, opacity: q, transform: `scale(${0.8 + 0.2 * q})`, transformOrigin: '0% 50%' }}>
            <span style={{ display: 'inline-block', background: OK, color: '#fff', fontFamily: pk.font, fontWeight: 800, fontSize: pk.okPillSize, lineHeight: 1.1, padding: '8px 22px 10px', borderRadius: 999, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>✓ {pk.okPill}</span>
          </div>
        ) : null}
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: l.offer ? 48 : 56, color: '#4A3A30', lineHeight: 1.15, fontStyle: 'italic', whiteSpace: 'nowrap' }}>{pk.reads[l.k]}</div>
      </div>
    </div>
  );
};

// ✗ 알약 — 「윗사람에게는 안 돼요」(틀린 말 바로 그 칸에서 — L04). 첫 컷 다른 눈 v1: 가운데 한 줄 알약이 몽글 얼굴을 덮음 · 1.5초가 안 됨 → 왼쪽 두 줄 · ✗와 함께 1.5초 넘게
const NgPill: React.FC<{ pk: LocPack; i: number; t: number }> = ({ pk, i, t }) => {
  if (t < NG_AT + 0.08 || t >= FINE_AT) return null;
  const q = interpolate(t, [NG_AT + 0.08, NG_AT + 0.26], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) });
  const no = LINES.find((l) => l.k === 0)!; // 「싫어요!」 줄(대사 차례가 바뀌어도 그 줄을 따른다)
  const box = no.boxBy?.[CELLS[i].img] ?? no.box;
  return (
    <div style={{ position: 'absolute', left: box.left - 10, bottom: 1920 - box.top + 26, opacity: q, transform: `scale(${0.8 + 0.2 * q})`, transformOrigin: '20% 100%' }}>
      <div style={{ display: 'inline-block', background: NG, color: '#fff', fontFamily: pk.font, fontWeight: 800, fontSize: pk.pillSize, lineHeight: Math.max(1.14, pk.lineH), padding: '14px 30px 16px', borderRadius: 34, whiteSpace: 'pre-line', boxShadow: '0 6px 16px rgba(0,0,0,0.35)' }}>✕ {pk.ngPill}</div>
    </div>
  );
};

// 언 칸 — 몽글 옆 땀방울이 주르륵(첫 컷 다른 눈 v1 #26 — 혼자 안 언 몽글이 굳어 보임)
const Sweat: React.FC<{ i: number; t: number }> = ({ i, t }) => {
  const img = CELLS[i].img;
  if (img !== 'cringe.jpg' && img !== 'cringe2.jpg') return null;
  const u = ((t - CRINGE_AT) * 1.6) % 1;
  const from: [number, number] = img === 'cringe.jpg' ? SWEAT : [930, 1090];
  const [x, y] = onScreen(i, t, [from[0] + 30 * u, from[1] + 260 * u * u]);
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity: Math.sin(Math.PI * Math.min(1, u * 1.05)) }}>
      <path d={`M ${x} ${y - 30} C ${x + 16} ${y - 6}, ${x + 18} ${y + 14}, ${x} ${y + 16} C ${x - 18} ${y + 14}, ${x - 16} ${y - 6}, ${x} ${y - 30} Z`} fill="#8FD0F5" stroke="#FFFFFF" strokeWidth={3} />
    </svg>
  );
};

// 녹는 넘어감 — 언 칸에서 괜찮아 칸으로: 언 그림이 0.35초에 걷히고, 찬 빛 · 서리 테가 0.8초 동안 녹는다(첫 컷 다른 눈 v1 #51 · #29 — 풀린 계기 없이 노랗게 바뀜)
const Thaw: React.FC<{ i: number; t: number }> = ({ i, t }) => {
  if (CELLS[i].img !== 'fine.jpg' || t >= FINE_AT + 0.8) return null;
  const a = interpolate(t, [FINE_AT, FINE_AT + 0.35], [1, 0], { ...clamp, easing: Easing.in(Easing.quad) });
  const cold = interpolate(t, [FINE_AT, FINE_AT + 0.8], [0.5, 0], { ...clamp, easing: Easing.out(Easing.quad) });
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, opacity: a }}>
        <div style={{ position: 'absolute', inset: 0, transform: 'scale(1.09)', transformOrigin: '666px 1150px' }}>
          <Img src={staticFile('img/cringe2.jpg')} style={FULL} />
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: `rgba(190,220,255,${cold * 0.5})`, boxShadow: `inset 0 0 220px 90px rgba(240,248,255,${cold})` }} />
    </>
  );
};

// 되짚기(이해 시험 v2 둘(s · G): 「또 다음에?!」에 왜 어는지 모름) — 선배 머리 곁 생각 구름에 아까 등산 장면(몽글이 「다음에요」 한 칸)을 작게 보인다(L07 앞 장면 되짚기)
const Callback: React.FC<{ pk: LocPack; t: number }> = ({ pk, t }) => {
  if (t < TTO_AT + 0.05 || t >= FREEZE2_AT) return null;
  const q = interpolate(t, [TTO_AT + 0.05, TTO_AT + 0.25], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) });
  const cx = 715; // 오른쪽 안전선(920px) 안 · 선배 얼굴 오른쪽
  const cy = 745;
  const r = 140;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: q }}>
      {[[575, 790, 14], [590, 760, 20], [600, 725, 0]].map(([x, y, d], k) => (
        <div key={k} style={{ position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: 999, background: CREAM, boxShadow: '0 3px 8px rgba(0,0,0,0.3)' }} />
      ))}
      <div style={{ position: 'absolute', left: cx - r, top: cy - r, width: 2 * r, height: 2 * r, borderRadius: 999, overflow: 'hidden', border: `8px solid ${CREAM}`, boxShadow: '0 8px 20px rgba(0,0,0,0.4)', transform: `scale(${0.7 + 0.3 * q})` }}>
        <Img src={staticFile('img/next.jpg')} style={{ position: 'absolute', width: 1080 * 0.34, height: 1920 * 0.34, left: r - 560 * 0.34, top: r - 1060 * 0.34, filter: 'sepia(0.35)' }} />
      </div>
      <div style={{ position: 'absolute', left: cx - 280, width: 485, top: cy + r + 14, textAlign: 'center' }}>
        <span style={{ display: 'inline-block', background: 'rgba(20,14,10,0.78)', color: CREAM, fontFamily: pk.font, fontWeight: 800, fontSize: 48, lineHeight: 1.15, padding: '8px 20px 10px', borderRadius: 20, whiteSpace: 'pre-line' }}>{pk.recall}</span>
      </div>
    </div>
  );
};

const EndLine: React.FC<{ pk: LocPack; t: number }> = ({ pk, t }) => {
  if (t < END_AT) return null;
  const a = interpolate(t, [END_AT, END_AT + 0.15], [0, 1], clamp);
  const s = interpolate(t, [END_AT, END_AT + 0.18], [0.9, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  return (
    <div style={{ position: 'absolute', left: 70, right: 70, top: 300, textAlign: 'center', opacity: a, transform: `scale(${s})` }}>
      <Glow x={470} y={110} w={1050} h={430} a={0.7} />
      <span style={{ position: 'relative', color: CREAM, fontFamily: pk.font, fontWeight: 800, fontSize: pk.endSize, lineHeight: Math.max(1.2, pk.lineH), whiteSpace: 'pre-line', textShadow: SH }}>{pk.end}</span>
    </div>
  );
};

const Sounds: React.FC = () => (
  <>
    <Audio
      src={staticFile('sfx/bgm.wav')}
      volume={(f) => MASTER * interpolate(f / FPS, [0, FREEZE_AT - 0.05, FREEZE_AT + 0.1, FINE_AT - 0.2, FINE_AT + 0.2, FREEZE2_AT - 0.05, FREEZE2_AT + 0.1, FREEZE2_AT + 1.0, TOTAL - 0.5, TOTAL], [BGM, BGM, BGM_FROZEN, BGM_FROZEN, BGM, BGM, BGM_FROZEN, BGM, BGM, 0], clamp)}
    />
    <Audio src={staticFile('sfx/air.wav')} volume={(f) => 0.3 * MASTER * interpolate(f / FPS, [0, TOTAL - 0.4, TOTAL], [1, 1, 0], clamp)} />
    {SFX.map((s, k) => (
      <Sequence key={k} from={fr(s.at)} layout="none">
        <Audio src={staticFile(`sfx/${s.file}`)} volume={s.vol * MASTER} />
      </Sequence>
    ))}
    {LINES.map((l, k) => (
      <Sequence key={`v${k}`} from={fr(l.voAt)} layout="none">
        <Audio src={staticFile(`vo/${l.vo}.wav`)} volume={1.1 * MASTER} />
      </Sequence>
    ))}
  </>
);

export const Film: React.FC<{ p: LocPack }> = ({ p }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const i = cellAt(t);
  return (
    <AbsoluteFill style={{ background: '#140f0c', overflow: 'hidden' }}>
      <Plate i={i} t={t} />
      <FreezeLayer i={i} t={t} />
      <Cold i={i} t={t} />
      <Drips i={i} t={t} />
      <Sweat i={i} t={t} />
      <Thaw i={i} t={t} />
      {/* 위쪽 그늘 — 글자가 놓일 자리(상자가 아니라 빛) */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 700, background: 'linear-gradient(to bottom, rgba(10,8,22,0.42) 0%, rgba(10,8,22,0.22) 58%, rgba(10,8,22,0) 100%)' }} />
      <Hook pk={p} t={t} />
      {LINES.map((l) => (
        <Bubble key={l.k} pk={p} l={l} i={i} t={t} />
      ))}
      <NgPill pk={p} i={i} t={t} />
      <Callback pk={p} t={t} />
      <EndLine pk={p} t={t} />
      <Sounds />
    </AbsoluteFill>
  );
};

// 쓰지 않는 값 경고를 막는다(칸 이름은 data.ts가 원천)
void BOSS_FACE;
void MIC_AT;
void ENV_AT;
