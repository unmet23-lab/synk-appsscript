// LAB 몽골 M48 「더워 · 뜨거워」 편(11-23 15시 회차 — 07시 회차의 장면 v2를 가운데 두고 키움). 원본 우리편 M29 「춥다 · 차갑다」 19.6초 뼈대(기획.md 「원본 1:1」).
// 칸: 훅(헉헉대는 몽글) → 친구 「더워!」 + 상자 더워 → 계란 저글링 → 몽글 「계란이 더워!」 ✗ → 상상 칸(땀 흘리는 계란) → 친구들 웃음 → 「계란이 뜨거워!」 ✓ + 상자 뜨거워
//   → 핵심 장면(다가감 → 치맛자락이 계란에 닿음 → 펄쩍 「뜨거워!」 → 착지) → 둘러앉아 「아, 더워~」 → 계란을 내밂 → 「계란이… 뜨거워!」 ✓ → 끝: 등 뒤 그릇에 닿아 더 크게 펄쩍 「뜨거워!!」 + 위 두 줄.
// 판본 틀: 몽골어 글은 판본/MN.json(L)에서 받는다(그림 · 한국어 · 목소리 · 박자는 이 파일 하나). 글 원천은 게시/검문/mn_화면.txt(세 겹 검수판).
// 맞음틀림: 맞는 말 초록 #0A9A66 + ✓, 틀린 말 빨강 #D92D20 + ✗(「더워」에 줄). 낱말 상자 강조는 호박색, 몽골 뜻 줄은 남색 — 초록 · 빨강은 맞음 · 틀림에만.
// 글자 안전선: 가로 65~920 · 세로 269~1428. 큰 움직임은 펄쩍 두 번뿐(유호님 11-20 「큰 움직임과 멀미」).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';

export type LocPack = {
  lang: string;
  font: string;
  head: string;
  hook: string;
  means: string[];
  boxSubs: string[];
  reads: string[];
  wrong: string;
  endA: string;
  endB: string;
  coverAt: number;
};

export const FPS = 30;
export const TOTAL = 19.6;
export const TOTAL_FRAMES = Math.round(TOTAL * FPS);
const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8;

// 박자 — 원본 M29(훅 0.3 · 1.7 · 3.0 · 4.1 · 4.9 · 5.4 · 6.3 · 6.8 · 8.8 · 10.4 · 12.4 · 13.4 · 15.0 · 15.5 · 17.0)
export const T = {
  b1: 1.7, // 친구 「더워!」 + 상자 더워
  jug: 3.0, // 계란 저글링
  look: 4.1, // 몽글 쪽으로
  say: 4.9, // 「계란이 더워!」
  wrong: 5.4, // 상상 칸 ✗
  laugh: 7.2, // 상상 칸 끝 — 친구들 웃음은 고쳐 줌 칸(f1 — 둘이 웃는 그림)이 맡는다(v2: 상상 칸을 1.8초로 늘리고 웃음 칸을 줄임)
  fix: 7.25, // 「계란이 뜨거워!」 ✓ + 상자 뜨거워
  a: 8.8, // 핵심 장면 — 다가감
  touch: 10.4, // 치맛자락이 계란에 닿음(반전)
  jump: 11.4, // 펄쩍
  land: 12.3, // 착지 · 웃음
  rest: 13.4, // 새 구도 — 둘러앉아 「아, 더워~」
  offer: 15.3, // 계란을 내밂
  no: 15.6, // 「계란이… 뜨거워!」 ✓ · 끝 두 줄
  end: 17.0, // 등 뒤 그릇에 닿아 더 크게 펄쩍
} as const;

const C = { ink: '#2A1A12', paper: '#FFF9F0', amber: '#B86A00', navy: '#24356E', ok: '#0A9A66', ng: '#D92D20' };

// ── 판과 층(1280×1920 판 — 화면 1080 폭에 cam만큼 왼쪽을 잘라 보인다) ──
const CAM_WIDE = 40;
const CAM_A = 30;
const CAM_CLOSE = 100;
const FOOT = { h: [401, 1639], a: [404, 1632], c: [506, 1299], d: [312, 1629] } as const;
const TOUCH_PT = [625, 1375] as const;
const D_SHIFT = 66;
const D_SCALE = 0.96;

const Plate: React.FC<{ src: string; cam: number; dy?: number }> = ({ src, cam, dy = 0 }) => (
  <Img src={staticFile(`img/${src}`)} style={{ position: 'absolute', left: -cam, top: dy, width: 1280, height: 1920 }} />
);
const Layer: React.FC<{ src: string; cam: number; foot: readonly [number, number] | readonly number[]; dx?: number; dy?: number; sx?: number; sy?: number; rot?: number }> = ({ src, cam, foot, dx = 0, dy = 0, sx = 1, sy = 1, rot = 0 }) => (
  <Img
    src={staticFile(`img/${src}`)}
    style={{ position: 'absolute', left: -cam, top: 0, width: 1280, height: 1920, transformOrigin: `${foot[0]}px ${foot[1]}px`, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${sx}, ${sy})` }}
  />
);
// 카메라 — 화면 좌표의 축(ox, oy)을 기준으로 z배
const Cam: React.FC<{ z: number; ox: number; oy: number; sx?: number; sy?: number; children: React.ReactNode }> = ({ z, ox, oy, sx = 0, sy = 0, children }) => (
  <AbsoluteFill style={{ transformOrigin: `${ox}px ${oy}px`, transform: `translate(${sx}px, ${sy}px) scale(${z})` }}>{children}</AbsoluteFill>
);
const lerp = (t: number, a: number, b: number, v0: number, v1: number, ease = Easing.inOut(Easing.quad)) => interpolate(t, [a, b], [v0, v1], { ...clamp, easing: ease });
// 박자마다 살짝 다가가는 손카메라(punch)
const punchAt = (t: number, beats: number[]) => beats.reduce((m, b) => Math.max(m, interpolate(t, [b - 0.02, b + 0.08, b + 0.45], [0, 1, 0], clamp)), 0);

// 훅 — 더위에 지친 몽글이 헉헉 들썩인다(장면 심사 v2 「첫 1초가 멈춰 있다」) · 김이 피어오른다
const ShotHook: React.FC<{ t: number }> = ({ t }) => {
  const pant = Math.sin(t * Math.PI * 2 * 1.7);
  const sy = 1 - 0.04 + 0.085 * pant - lerp(t, 0, 1.7, 0, 0.06);
  const z = lerp(t, 0, T.b1, 1.0, 1.12);
  // 땀방울(불투명한 펠트 물방울) — 몽글 머리에서 양옆으로 튀어 떨어진다
  const drop = (at: number, x0: number, y0: number, vx: number) => {
    const u = (t - at) / 0.6;
    if (u < 0 || u > 1) return null;
    const x = x0 + vx * u;
    const y = y0 - 90 * Math.sin(Math.PI * Math.min(1, u * 1.4)) + 260 * u * u;
    return <div key={at} style={{ position: 'absolute', left: x - 22, top: y - 30, width: 44, height: 60, background: '#A9D8F2', border: '4px solid #6FA9CC', borderRadius: '50% 50% 50% 50% / 62% 62% 38% 38%', transform: `rotate(${vx > 0 ? 25 : -25}deg)`, opacity: 1 - u * 0.4 }} />;
  };
  return (
    <Cam z={z} ox={400} oy={1520} sx={6 * Math.sin(t * 2.1)}>
      <Plate src="h_bg.jpg" cam={CAM_WIDE} />
      <Layer src="h_m.png" cam={CAM_WIDE} foot={FOOT.h} sx={1 / Math.sqrt(Math.max(0.8, sy))} sy={sy} rot={3 * Math.sin(t * Math.PI * 1.7)} />
      {drop(0.2, 150, 1120, -150)}
      {drop(0.75, 580, 1100, 160)}
      {drop(1.25, 170, 1130, -130)}
    </Cam>
  );
};
// 친구 「더워!」 — 남자 친구 가까이, 부채질하는 손 박자로 들썩
const ShotB1: React.FC<{ t: number }> = ({ t }) => {
  const u = t - T.b1;
  const z = lerp(u, 0, 1.3, 1.04, 1.1) + 0.04 * punchAt(t, [T.b1 + 0.05]);
  const flap = 4 * Math.sin(u * Math.PI * 2 * 3.2);
  return (
    <Cam z={z + 0.2} ox={585} oy={0} sx={flap * 0.4} sy={Math.abs(flap) * 0.5}>
      <Plate src="p_b1.jpg" cam={CAM_WIDE} />
    </Cam>
  );
};
// 계란 저글링(3.0~4.1) → 몽글 쪽으로(4.1~5.4) — 같은 판에서 카메라만 옮긴다
const ShotB2: React.FC<{ t: number }> = ({ t }) => {
  const u = t - T.jug;
  const toM = lerp(t, T.look, T.look + 0.5, 0, 1);
  const ox = 820 + (300 - 820) * toM;
  const oy = 820 + (1320 - 820) * toM;
  const z = 1.12 + 0.18 * toM + 0.03 * punchAt(t, [T.say]);
  const toss = t < T.look ? 7 * Math.abs(Math.sin(u * Math.PI * 2 * 1.6)) : 0; // 받을 때마다 톡톡
  return (
    <Cam z={z} ox={ox} oy={oy} sy={-toss}>
      <Plate src="p_b2.jpg" cam={CAM_WIDE} />
    </Cam>
  );
};
// 상상 칸 — 양머리 수건을 쓰고 땀 흘리는 계란(틀린 말 그대로의 그림), 둘레를 흰 꿈 테로 지금 장면과 가른다(교훈 L07)
const ShotDream: React.FC<{ t: number }> = ({ t }) => {
  const u = t - T.wrong;
  const z = interpolate(u, [0, 0.12, 0.9], [1.12, 1.0, 1.03], { ...clamp, easing: Easing.out(Easing.cubic) });
  const wob = (3 + 3 * Math.min(1, u)) * Math.sin(u * Math.PI * 2 * 2.2); // 1.8초 동안 점점 더 덜덜
  return (
    <AbsoluteFill style={{ backgroundColor: '#E37210' }}>
      <Cam z={z} ox={540} oy={1500}>
        <div style={{ position: 'absolute', inset: 0, transformOrigin: '540px 1700px', transform: `rotate(${wob}deg)` }}>
          <Plate src="p_e1.jpg" cam={CAM_WIDE + 40} dy={130} />
        </div>
      </Cam>
      <AbsoluteFill style={{ boxShadow: 'inset 0 0 120px 60px rgba(255,248,236,0.92)' }} />
      <div style={{ position: 'absolute', left: 80, top: 1300, fontSize: 110 }}>💭</div>
    </AbsoluteFill>
  );
};
// 친구들 웃음(6.3) → 남자 친구가 계란을 들어 보이며 고쳐 줌(6.8)
const ShotF1: React.FC<{ t: number }> = ({ t }) => {
  const toB = lerp(t, T.fix, T.fix + 0.35, 0, 1);
  const z = 1.02 + 0.13 * toB + 0.03 * punchAt(t, [T.fix + 0.05]);
  const laugh = t < T.fix ? 5 * Math.abs(Math.sin((t - T.laugh) * Math.PI * 2 * 2.5)) : 0;
  return (
    <Cam z={z} ox={540 + 260 * toB} oy={960} sy={-laugh}>
      <Plate src="p_f1.jpg" cam={CAM_WIDE} />
    </Cam>
  );
};

// ── 핵심 장면(장면 v2를 편 박자로 — 첫 컷 다른 눈 v2 「눌렸다 떨어져 솟는 과정이 안 보인다 · 컷 사이에 몸을 떼는 동작이 빠졌다 · 되튐이 없다」를 고침) ──
const ShotA: React.FC<{ t: number }> = ({ t }) => {
  const u = t - T.a; // 0..1.6
  const dx = lerp(u, 0, 1.2, -24, 0);
  const hop = (a: number, b: number) => (u >= a && u <= b ? Math.sin(((u - a) / (b - a)) * Math.PI) : 0);
  const h = hop(0.25, 0.6) + hop(0.72, 1.07);
  const land = (a: number) => interpolate(u, [a, a + 0.06, a + 0.14], [0, 1, 0], clamp);
  const squash = 0.07 * (land(0.6) + land(1.07));
  const rot = interpolate(u, [0, 1.0, 1.6], [-8, -3, 5], { ...clamp, easing: Easing.inOut(Easing.quad) });
  return (
    <Cam z={lerp(u, 0, 1.6, 1.0, 1.035)} ox={540} oy={1440}>
      <Plate src="a_bg.jpg" cam={CAM_A} />
      <Layer src="a_m.png" cam={CAM_A} foot={FOOT.a} dx={dx} dy={-26 * h} sx={1 + squash} sy={1 - squash + 0.04 * h} rot={rot} />
    </Cam>
  );
};
// 닿음 가까이(1.0초) — 밀려 들어감(0~0.22) → 눌려 떨며 김 · 붉은 열기(0.22~0.55) → 확 떨어져 솟음(0.55~1.0). 카메라는 닿는 자리로 더 다가간다(장면 심사 v2 ①)
const ShotB: React.FC<{ t: number }> = ({ t }) => {
  const u = t - T.touch;
  const HIT = 0.22;
  const slide = interpolate(u, [0, HIT], [-170, 0], { ...clamp, easing: Easing.in(Easing.quad) });
  const press = interpolate(u, [HIT, HIT + 0.06, HIT + 0.25, 0.55], [1, 0.84, 0.9, 0.93], clamp);
  const k = interpolate(u, [HIT, 0.55], [1, 0.4], clamp);
  const tremble = u >= HIT && u < 0.55 ? Math.sin(u * 110) * 7 * k : 0;
  const pull = interpolate(u, [0.55, 0.92], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  const dx = slide - 150 * pull + tremble;
  const dy = -300 * pull;
  const sy = 1 + 0.16 * pull;
  const rot = -11 * pull;
  const sx0 = TOUCH_PT[0] - CAM_CLOSE;
  const z = lerp(u, 0, 0.5, 1.0, 1.2) + 0.05 * interpolate(u, [HIT, HIT + 0.04, HIT + 0.25], [0, 1, 0], clamp);
  const splash = interpolate(u, [HIT, HIT + 0.05, 0.75, 0.95], [0, 1, 1, 0], clamp);
  const splashS = interpolate(u, [HIT, HIT + 0.2], [0.7, 1.5], clamp);
  const glow = interpolate(u, [HIT, HIT + 0.06, 0.6, 0.85], [0, 0.85, 0.7, 0], clamp);
  return (
    <Cam z={z} ox={sx0} oy={TOUCH_PT[1] - 40}>
      <Plate src="b_bg.jpg" cam={CAM_CLOSE} />
      <Layer src="b_m.png" cam={CAM_CLOSE} foot={TOUCH_PT} dx={dx} dy={dy} sx={press / Math.sqrt(sy)} sy={sy} rot={rot} />
      <div style={{ position: 'absolute', left: sx0 - 230, top: TOUCH_PT[1] - 200, width: 460, height: 360, borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(255,70,30,0.75), rgba(255,90,30,0) 70%)', opacity: glow, mixBlendMode: 'screen' }} />
      <div style={{ position: 'absolute', inset: 0, opacity: splash }}>
        <Layer src="b_splash.png" cam={CAM_CLOSE} foot={TOUCH_PT} sx={splashS} sy={splashS} />
      </div>
    </Cam>
  );
};
// 펄쩍(0.9초) — 그릇 곁에서 몸을 떼며 솟는 자세로 이어 받아(가까운 칸의 끝) 꼭대기를 지나 왼쪽으로 떨어진다. 눈은 > < (장면 심사 v2 ②)
const ShotC: React.FC<{ t: number }> = ({ t }) => {
  const p = (t - T.jump) / (T.land - T.jump);
  const groundA = FOOT.a[1] - FOOT.c[1];
  const groundD = FOOT.d[1] - FOOT.c[1];
  const up = interpolate(p, [0, 0.42], [groundA - 90, -24], { ...clamp, easing: Easing.out(Easing.cubic) });
  const down = interpolate(p, [0.42, 1], [-24, groundD], { ...clamp, easing: Easing.in(Easing.quad) });
  const dy = p < 0.42 ? up : down;
  const dx = interpolate(p, [0, 0.42, 1], [FOOT.a[0] - FOOT.c[0] + 30, -120, FOOT.d[0] + D_SHIFT - FOOT.c[0]], clamp);
  const stretch = interpolate(p, [0, 0.3, 0.5, 0.85, 1], [1.16, 1.06, 1.0, 1.08, 1.1], clamp);
  const rot = interpolate(p, [0, 0.42, 1], [-9, -5, -2], clamp);
  return (
    <AbsoluteFill>
      <Plate src="cx_bg.jpg" cam={CAM_WIDE} />
      <Layer src="cx_m.png" cam={CAM_WIDE} foot={FOOT.c} dx={dx} dy={dy} sx={1 / Math.sqrt(stretch)} sy={stretch} rot={rot} />
    </AbsoluteFill>
  );
};
// 착지(1.1초) — 납작 → 크게 되튀어 오름(0.12~0.45) → 다시 앉으며 눌림 → 떨며 눈물. 뒤 두 친구는 웃음 두 꼴을 0.3초마다 번갈아
const ShotD: React.FC<{ t: number }> = ({ t }) => {
  const u = t - T.land;
  const hop = -120 * interpolate(u, [0.1, 0.27, 0.45], [0, 1, 0], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const sy = interpolate(u, [0, 0.1, 0.27, 0.45, 0.55, 0.7], [0.66, 0.9, 1.12, 0.78, 1.04, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const shiver = u > 0.75 ? Math.sin(u * 48) * 1.6 : 0;
  const laughB = Math.floor((u + 0.0001) / 0.3) % 2 === 1;
  return (
    <Cam z={lerp(u, 0, 1.1, 1.0, 1.025)} ox={380} oy={1530}>
      <Plate src={laughB ? 'd_bg2.jpg' : 'd_bg.jpg'} cam={CAM_WIDE} />
      <Layer src="d_m.png" cam={CAM_WIDE} foot={FOOT.d} dx={D_SHIFT} dy={hop} sx={D_SCALE / Math.sqrt(sy)} sy={D_SCALE * sy} rot={shiver} />
    </Cam>
  );
};
// 새 구도 — 둘러앉아 쉼, 남자 친구 「아, 더워~」(부채 박자로 들썩)
const ShotRest: React.FC<{ t: number }> = ({ t }) => {
  const u = t - T.rest;
  const fan = 3 * Math.sin(u * Math.PI * 2 * 1.2);
  return (
    <Cam z={lerp(u, 0, 1.9, 1.0, 1.05)} ox={640} oy={1200} sy={fan * 0.5}>
      <Plate src="p_r1.jpg" cam={CAM_WIDE} />
    </Cam>
  );
};
// 계란을 내밂(15.3) → 몽글이 몸을 젖혀 사양(15.6~17.0) — 빈 판을 못 구워(굽기 계정 11-23 20:26까지 막힘) 한 판에 카메라만 몽글 · 그릇 쪽으로
const ShotOffer: React.FC<{ t: number }> = ({ t }) => {
  const u = t - T.offer;
  const z = lerp(u, 0, 1.7, 1.03, 1.14) + 0.03 * punchAt(t, [T.no + 0.03]);
  return (
    <Cam z={z} ox={lerp(u, 0, 1.7, 600, 330)} oy={1300}>
      <Plate src="p_r2.jpg" cam={CAM_WIDE} />
    </Cam>
  );
};
// 끝 — 핵심 장면이 다시(처음 구도): 닿음 가까이(k2 그대로, 0~0.4초) → 몽글 없는 빈 판(k1d 배경) 위에서 > < 눈 몽글이 그릇 곁에서 솟아
//   꼭대기에 떨며 떠 있고 그릇에서 김이 피어오른다(0.4~2.6초). 카메라는 핵심 장면 때보다 조금 가깝다.
const ShotEnd: React.FC<{ t: number }> = ({ t }) => {
  const u = t - T.end;
  if (u < 0.4) {
    const HIT = 0.08;
    const slide = interpolate(u, [0, HIT], [-120, 0], { ...clamp, easing: Easing.in(Easing.quad) });
    const press = interpolate(u, [HIT, HIT + 0.05, 0.24], [1, 0.84, 0.9], clamp);
    const pull = interpolate(u, [0.24, 0.4], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
    const tremble = u >= HIT && u < 0.24 ? Math.sin(u * 120) * 7 : 0;
    const sx0 = TOUCH_PT[0] - CAM_CLOSE;
    const splash = interpolate(u, [HIT, HIT + 0.04, 0.4], [0, 1, 1], clamp);
    const splashS = interpolate(u, [HIT, HIT + 0.2], [0.8, 1.7], clamp);
    const glow = interpolate(u, [HIT, HIT + 0.05, 0.4], [0, 0.9, 0.6], clamp);
    const flash = interpolate(u, [HIT, HIT + 0.03, HIT + 0.14], [0, 0.5, 0], clamp);
    return (
      <AbsoluteFill>
        <Cam z={1.24} ox={sx0} oy={TOUCH_PT[1] - 40}>
          <Plate src="b_bg.jpg" cam={CAM_CLOSE} />
          <Layer src="b_m.png" cam={CAM_CLOSE} foot={TOUCH_PT} dx={slide + tremble - 120 * pull} dy={-420 * pull} sx={press} sy={1 + 0.2 * pull} rot={-10 * pull} />
          <div style={{ position: 'absolute', left: sx0 - 230, top: TOUCH_PT[1] - 200, width: 460, height: 360, borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(255,70,30,0.75), rgba(255,90,30,0) 70%)', opacity: glow, mixBlendMode: 'screen' }} />
          <div style={{ position: 'absolute', inset: 0, opacity: splash }}>
            <Layer src="b_splash.png" cam={CAM_CLOSE} foot={TOUCH_PT} sx={splashS} sy={splashS} />
          </div>
        </Cam>
        <AbsoluteFill style={{ backgroundColor: '#FFF6E8', opacity: flash }} />
      </AbsoluteFill>
    );
  }
  const w = u - 0.4;
  const groundA = FOOT.a[1] - FOOT.c[1];
  const dy = interpolate(w, [0, 0.3], [groundA - 90, 20], { ...clamp, easing: Easing.out(Easing.cubic) }) - 12 * Math.sin(Math.max(0, w - 0.3) * Math.PI * 2 * 1.1);
  const dx = interpolate(w, [0, 0.3], [FOOT.a[0] - FOOT.c[0] + 30, -110], { ...clamp, easing: Easing.out(Easing.cubic) });
  const stretch = interpolate(w, [0, 0.2, 0.45], [1.24, 1.1, 1.0], clamp);
  const quiver = w > 0.3 ? Math.sin(w * 52) * 3 : 0;
  const shake = w < 0.3 ? (random(`es${Math.floor(w * 60)}`) - 0.5) * 20 * (1 - w / 0.3) : 0;
  const puffs = [0, 1, 2, 3].map((i) => {
    const st = 0.02 + i * 0.22;
    const p = interpolate(w, [st, st + 1.1], [0, 1], clamp);
    const x = 840 + (i % 2 === 0 ? -40 : 50);
    return <div key={i} style={{ position: 'absolute', left: x - 130, top: 1540 - 620 * p - 110, width: 260, height: 220, borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(255,250,240,0.85), rgba(255,250,240,0) 68%)', opacity: p > 0 ? 0.9 * (1 - p) : 0, filter: 'blur(5px)' }} />;
  });
  return (
    <Cam z={lerp(w, 0, 2.2, 1.08, 1.12)} ox={480} oy={1700} sx={shake} sy={shake * 0.5}>
      <Plate src="a_bg.jpg" cam={CAM_A} />
      {puffs}
      <Layer src="cx_m.png" cam={CAM_A} foot={FOOT.c} dx={dx + quiver} dy={dy} sx={1 / Math.sqrt(stretch)} sy={stretch} rot={-4} />
    </Cam>
  );
};

const Shots: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.b1) return <ShotHook t={t} />;
  if (t < T.jug) return <ShotB1 t={t} />;
  if (t < T.wrong) return <ShotB2 t={t} />;
  if (t < T.laugh) return <ShotDream t={t} />;
  if (t < T.a) return <ShotF1 t={t} />;
  if (t < T.touch) return <ShotA t={t} />;
  if (t < T.jump) return <ShotB t={t} />;
  if (t < T.land) return <ShotC t={t} />;
  if (t < T.rest) return <ShotD t={t} />;
  if (t < T.offer) return <ShotRest t={t} />;
  if (t < T.end) return <ShotOffer t={t} />;
  return <ShotEnd t={t} />;
};

// ── 글 ──
const pop = (t: number, at: number) => interpolate(t, [at, at + 0.18], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) });
const fade = (t: number, at: number, d = 0.18) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

// 말풍선 — 한국어 줄(짚는 낱말 hot) + 몽골 뜻 줄. mark ok/ng는 짚는 낱말 색 · 귀퉁이 도장(✓/✗) · ng는 낱말에 줄. 꼬리는 말한 사람 쪽(tx, ty)
const Bubble: React.FC<{
  t: number; from: number; until: number; x: number; y: number; ko: string; hot?: string; mean?: string; font: string;
  koSize?: number; meanSize?: number; mark?: 'ok' | 'ng'; markAt?: number; tail?: [number, number]; mnOnly?: boolean;
}> = ({ t, from, until, x, y, ko, hot, mean, font, koSize = 84, meanSize = 50, mark, markAt = from, tail, mnOnly = false }) => {
  if (t < from || t >= until) return null;
  const a = pop(t, from);
  const mo = mark && t >= markAt ? interpolate(t, [markAt, markAt + 0.14], [0, 1], clamp) : 0;
  const ms = mark && t >= markAt ? interpolate(t, [markAt, markAt + 0.16], [1.7, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
  const col = mark === 'ok' ? C.ok : mark === 'ng' ? C.ng : C.amber;
  const parts = hot && ko.includes(hot) ? ko.split(hot) : [ko];
  const tailEl = tail ? (() => {
    const [tx, ty] = tail;
    const bx = x;
    const by = y;
    const ang = Math.atan2(ty - by, tx - bx);
    const len = Math.hypot(tx - bx, ty - by);
    return (
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
        <path d={`M ${bx + Math.cos(ang + Math.PI / 2) * 30} ${by + Math.sin(ang + Math.PI / 2) * 30} L ${bx + Math.cos(ang) * len} ${by + Math.sin(ang) * len} L ${bx + Math.cos(ang - Math.PI / 2) * 30} ${by + Math.sin(ang - Math.PI / 2) * 30} Z`} fill={C.paper} stroke={C.ink} strokeWidth={5} strokeLinejoin="round" />
      </svg>
    );
  })() : null;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: Math.min(1, a * 1.4) }}>
      {tailEl}
      <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${0.85 + 0.15 * a})` }}>
        <div style={{ position: 'relative', background: C.paper, border: `5px solid ${C.ink}`, borderRadius: 44, padding: '14px 36px 18px', textAlign: 'center', boxShadow: '0 10px 26px rgba(60,20,0,0.3)', whiteSpace: 'pre' }}>
          {mnOnly ? null : (
            <div style={{ fontFamily: KO, fontWeight: 900, fontSize: koSize, lineHeight: 1.12, color: C.ink }}>
              {parts.length === 2 ? (
                <>
                  {parts[0]}
                  <span style={{ position: 'relative', color: mark && t >= markAt ? col : C.amber }}>
                    {hot}
                    {mark === 'ng' && mo > 0 ? <span style={{ position: 'absolute', left: -6, right: -6, top: '52%', height: 10, borderRadius: 5, background: C.ng, opacity: mo, transform: 'rotate(-3deg)' }} /> : null}
                  </span>
                  {parts[1]}
                </>
              ) : ko}
            </div>
          )}
          {mean ? <div style={{ fontFamily: font, fontWeight: 800, fontSize: mnOnly ? 66 : meanSize, lineHeight: 1.15, color: mnOnly ? C.ink : C.navy, marginTop: mnOnly ? 0 : 4 }}>{mean}</div> : null}
          {mark ? (
            <div style={{ position: 'absolute', right: -44, top: -46, width: 96, height: 96, borderRadius: 48, background: col, color: '#FFFFFF', fontFamily: KO, fontWeight: 900, fontSize: 64, lineHeight: '96px', textAlign: 'center', opacity: mo, transform: `scale(${ms})`, boxShadow: '0 6px 14px rgba(0,0,0,0.3)' }}>
              {mark === 'ok' ? '✓' : '✗'}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

// 위 띠 — 몽골어 한 줄(상상 칸 06 — 흰 구름 띠)
const TopBand: React.FC<{ t: number; from: number; until: number; text: string; font: string; size?: number }> = ({ t, from, until, text, font, size = 64 }) => {
  if (t < from || t >= until) return null;
  const a = fade(t, from);
  return (
    <div style={{ position: 'absolute', left: 65, width: 855, top: 290, display: 'flex', justifyContent: 'center', opacity: a, transform: `translateY(${(1 - a) * 16}px)` }}>
      <div style={{ background: 'rgba(255,249,240,0.97)', borderRadius: 80, padding: '22px 48px 26px', boxShadow: '0 10px 28px rgba(60,20,0,0.28)', fontFamily: font, fontWeight: 800, fontSize: size, lineHeight: 1.15, color: C.ink, textAlign: 'center' }}>{text}</div>
    </div>
  );
};
// 첫 물음 팻말 — 찜질방 나무 팻말(짙은 나무색 · 크림 글 · 살짝 기울임). 지난 두 편 머리 글(흰 이름표)과 꼴 · 색을 달리한다(이해 시험 v1 haiku 9번)
const SignBoard: React.FC<{ t: number; from: number; until: number; text: string; font: string }> = ({ t, from, until, text, font }) => {
  if (t < from || t >= until) return null;
  const a = fade(t, from, 0.22);
  return (
    <div style={{ position: 'absolute', left: 65, width: 855, top: 280, display: 'flex', justifyContent: 'center', opacity: a, transform: `translateY(${(1 - a) * -20}px) rotate(-1.6deg)` }}>
      <div style={{ background: '#6E3B1C', border: '7px solid #3F1F0D', borderRadius: 22, padding: '16px 34px 20px', boxShadow: 'inset 0 0 0 4px rgba(255,220,170,0.25), 0 12px 26px rgba(40,10,0,0.4)', fontFamily: font, fontWeight: 800, fontSize: 54, lineHeight: 1.16, color: '#FFF1D6', textAlign: 'center', maxWidth: 855 }}>{text}</div>
    </div>
  );
};

// 낱말 상자 — 한국어(호박색) · 🔊 키릴 읽기 · 몽골 뜻(위 자리 — 말풍선이 뜬 0.85초 뒤에 떠 2.5초 머문다, 제작 절차 「화면 글은 읽을 만큼」)
const WordBox: React.FC<{ t: number; from: number; until: number; ko: string; read: string; sub: string; font: string; top?: number }> = ({ t, from, until, ko, read, sub, font, top = 285 }) => {
  if (t < from || t >= until) return null;
  const a = fade(t, from, 0.15);
  return (
    <div style={{ position: 'absolute', left: 65, width: 855, top, display: 'flex', justifyContent: 'center', opacity: a, transform: `translateY(${(1 - a) * 16}px)` }}>
      <div style={{ background: 'rgba(255,249,240,0.97)', borderRadius: 40, padding: '16px 40px 24px', boxShadow: '0 10px 28px rgba(60,20,0,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 26 }}>
          <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 118, lineHeight: 1.0, color: C.amber }}>{ko}</div>
          <div style={{ fontFamily: font, fontWeight: 700, fontSize: 60, color: C.amber }}>🔊 {read}</div>
        </div>
        <div style={{ fontFamily: font, fontWeight: 800, fontSize: 54, lineHeight: 1.15, color: C.navy, marginTop: 8 }}>{sub}</div>
      </div>
    </div>
  );
};

// 끝 — 앞에서 쓴 낱말 상자 둘을 나란히: 왼쪽 「더워」 아래 «Өрөө халуун», 오른쪽 「뜨거워」 아래 «Хүрэхэд халуун»(15.6 · 16.4)
const EndBoxes: React.FC<{ t: number; L: LocPack }> = ({ t, L }) => {
  if (t < T.no) return null;
  const box = (at: number, ko: string, mn: string) => {
    const a = fade(t, at, 0.2);
    return (
      <div style={{ opacity: a, transform: `translateY(${(1 - a) * 16}px)`, background: 'rgba(255,249,240,0.97)', borderRadius: 36, padding: '12px 26px 18px', boxShadow: '0 10px 26px rgba(60,20,0,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 330 }}>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 86, lineHeight: 1.0, color: C.amber }}>{ko}</div>
        <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 48, lineHeight: 1.15, color: C.navy, marginTop: 6 }}>{mn}</div>
      </div>
    );
  };
  return (
    <div style={{ position: 'absolute', left: 65, width: 855, top: 280, display: 'flex', justifyContent: 'center', gap: 30 }}>
      {box(T.no, '더워', L.endA)}
      {box(T.no + 0.8, '뜨거워', L.endB)}
    </div>
  );
};

const Texts: React.FC<{ t: number; L: LocPack }> = ({ t, L }) => {
  const f = L.font;
  return (
    <>
      <SignBoard t={t} from={0} until={3.45} text={L.head} font={f} />
      <Bubble t={t} from={0} until={T.b1} x={400} y={1060} ko="" mean={L.hook} font={f} mnOnly tail={[380, 1200]} />
      <Bubble t={t} from={T.b1 + 0.03} until={T.jug} x={300} y={1200} ko="더워!" mean={L.means[0]} font={f} koSize={96} tail={[520, 1330]} />
      <WordBox t={t} from={T.b1 + 0.86} until={T.b1 + 3.36} ko="더워" read={L.reads[0]} sub={L.boxSubs[0]} font={f} top={505} />
      <Bubble t={t} from={T.say} until={T.fix} x={500} y={835} ko="계란이 더워!" hot="더워" mean={L.means[1]} font={f} mark="ng" markAt={T.wrong} tail={t < T.wrong ? [300, 1020] : undefined} />
      <TopBand t={t} from={T.wrong + 0.32} until={T.fix} text={L.wrong} font={f} />
      <Bubble t={t} from={T.fix} until={T.a} x={470} y={1240} ko="계란이 뜨거워!" hot="뜨거워" mean={L.means[2]} font={f} mark="ok" markAt={T.fix + 0.35} tail={[880, 960]} />
      <WordBox t={t} from={T.fix + 0.85} until={T.fix + 3.35} ko="뜨거워" read={L.reads[1]} sub={L.boxSubs[1]} font={f} />
      <Bubble t={t} from={T.touch + 0.48} until={T.rest + 0.05} x={460} y={600} ko="뜨거워!" hot="뜨거워" mean={L.means[3]} font={f} koSize={96} mark="ok" markAt={T.touch + 0.5} />
      <Bubble t={t} from={T.rest + 0.08} until={T.offer + 0.1} x={600} y={620} ko="아, 더워~" hot="더워" mean={L.means[4]} font={f} tail={[880, 800]} />
      <Bubble t={t} from={T.no} until={T.end} x={470} y={940} ko="계란이… 뜨거워!" hot="뜨거워" mean={L.means[5]} font={f} koSize={80} mark="ok" markAt={T.no + 0.6} tail={[400, 1150]} />
      <Bubble t={t} from={T.end + 0.05} until={TOTAL} x={640} y={1335} ko="뜨거워!!" hot="뜨거워" mean={L.means[6]} font={f} koSize={100} />
      <EndBoxes t={t} L={L} />
    </>
  );
};

// ── 소리 ──
const VO: [string, number][] = [
  ['b1', T.b1 + 0.05],
  ['m1', T.say + 0.03],
  ['b2', T.fix + 0.05],
  ['m2', T.touch + 0.56],
  ['b3', T.rest + 0.08],
  ['m3', T.no + 0.03],
  ['m4', T.end + 0.06],
];
const SFX: [number, string, number][] = [
  [0.05, 'pop.wav', 0.16],
  [0.3, 'puff.wav', 0.12],
  [T.b1, 'pop.wav', 0.16],
  [T.jug + 0.05, 'tok.wav', 0.16],
  [T.jug + 0.36, 'tok.wav', 0.16],
  [T.jug + 0.68, 'tok.wav', 0.16],
  [T.look, 'whoosh_up.wav', 0.12],
  [T.say, 'pop.wav', 0.16],
  [T.wrong, 'boing.wav', 0.3],
  [T.wrong + 0.1, 'sad.wav', 0.12],
  [T.wrong + 0.6, 'boing.wav', 0.14],
  [T.wrong + 1.2, 'puff.wav', 0.14],
  [T.fix + 0.35, 'sparkle.wav', 0.18],
  [T.a + 0.25, 'tok.wav', 0.12],
  [T.a + 0.72, 'tok.wav', 0.12],
  [T.touch + 0.22, 'sizzle_hit.wav', 0.75],
  [T.touch + 0.24, 'puff.wav', 0.25],
  [T.touch + 0.55, 'whoosh_up.wav', 0.3],
  [T.touch + 0.9, 'sparkle.wav', 0.12],
  [T.jump + 0.02, 'boing.wav', 0.22],
  [T.jump + 0.5, 'whoosh_down.wav', 0.2],
  [T.land, 'thud.wav', 0.45],
  [T.land + 0.12, 'boing.wav', 0.16],
  [T.land + 0.8, 'shiver.wav', 0.18],
  [T.rest, 'pop.wav', 0.12],
  [T.offer, 'pop.wav', 0.14],
  [T.offer + 0.35, 'tok.wav', 0.12],
  [T.offer + 1.05, 'tok.wav', 0.12],
  [T.no + 0.6, 'sparkle.wav', 0.14],
  [T.end, 'sizzle_hit.wav', 0.85],
  [T.end + 0.03, 'puff.wav', 0.3],
  [T.end + 0.05, 'whoosh_up.wav', 0.34],
  [T.end + 0.4, 'shiver.wav', 0.2],
  [T.end + 1.5, 'whoosh_down.wav', 0.2],
  [T.end + 1.85, 'thud.wav', 0.42],
  [T.end + 2.0, 'boing.wav', 0.16],
];
const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.17 * MASTER * interpolate(i, [0, 8, TOTAL_FRAMES - 15, TOTAL_FRAMES], [0, 1, 1, 0], clamp)} />
    <Audio src={staticFile('sfx/room.wav')} volume={0.1 * MASTER} endAt={TOTAL_FRAMES} />
    {VO.map(([v, t]) => (
      <Sequence key={v} from={fr(t)} layout="none">
        <Audio src={staticFile(`vo/${v}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {SFX.map(([t, f, v]) => (
      <Sequence key={`${t}-${f}`} from={fr(t)} layout="none">
        <Audio src={staticFile(`sfx/${f}`)} volume={v * MASTER} />
      </Sequence>
    ))}
  </>
);

export const Film: React.FC<{ L: LocPack }> = ({ L }) => {
  const t = useCurrentFrame() / FPS;
  return (
    <AbsoluteFill style={{ backgroundColor: '#3a2412', overflow: 'hidden' }}>
      <Shots t={t} />
      <Texts t={t} L={L} />
      <Sound />
    </AbsoluteFill>
  );
};
