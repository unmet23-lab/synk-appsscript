// LAB 몽골 M48 「더워 · 뜨거워」 핵심 장면(제작 절차 「한 장면 먼저」) — 원본 반전 자리(10.4초) 앞뒤 4.2초를 글 없이 그 소리째.
// 다가감(넓게) → 치맛자락이 맥반석 계란에 닿음(가까이) → 펄쩍 「뜨거워!」(넓게, 몽글 층이 실제로 솟았다 떨어짐) → 착지(눌렸다 튐 · 눈물).
// 그림: 판/_지시문만들기.py로 구운 k1d · k2 · k3 · k4c · k4b(펠트 미니어처), 몽글 층은 tools/층나누기.py가 빈 판 k0로 떼어 냈다(판/층).
//   가까운 칸은 빈 판 k2e와의 차이로 판/_가까이층.py가 몸 층 · 흰 김 줄기 층을 따로 오렸다.
// v1 첫컷검사(다른 눈 「다시」)로 고친 것: 가까운 칸에서 몸이 밀려 들어가 눌리고 떨어져 솟음 · 착지 뒤 크게 되튐 · 남자 친구 부채 그대로(k4c) ·
//   웃는 두 친구가 두 꼴(k4c · k4b)을 번갈아 들썩임.
//   판/_판짜기.py가 1.25배(1280×1920)로 키워 public/img에 둔다 — 넓은 칸은 왼쪽 40px, 가까운 칸은 100px부터 1080을 보인다.
// 큰 움직임은 펄쩍 한 번뿐이다(유호님 11-20 「큰 움직임과 멀미」) — 다가감은 작은 콩콩 둘, 착지 뒤는 떨림만.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';

export const SCENE_FPS = 30;
export const SCENE_SEC = 4.2;
export const SCENE_FRAMES = Math.round(SCENE_SEC * SCENE_FPS);
const fr = (sec: number) => Math.round(sec * SCENE_FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)

// 칸 경계(초)
const T = { touch: 1.3, jump: 2.0, land: 2.9 };
// 넓은 칸 카메라 — 1280 폭 판에서 화면 왼쪽 끝이 놓일 자리
const CAM_WIDE = 40;
const CAM_A = 30; // 다가감 칸 — 몽글 기준 판 자리가 왼쪽 끝에서 가까워 10px 덜 민다
const CAM_CLOSE = 100;
// 몽글 층의 발 자리(1280×1920 판 화소 — 층나누기의 「바닥」 × 1.25)
const FOOT = { a: [404, 1632], c: [507, 1299], d: [312, 1629] } as const;
// 가까운 칸 몸 층이 계란에 닿는 자리(누르는 기준점 — k2 원본 (500, 1100) × 1.25)
const TOUCH_PT = [625, 1375] as const;
// 착지 칸 층은 화면 왼쪽 끝에 걸리지 않게 오른쪽으로 옮기고 조금 줄인다(계란 그릇과 띄운다)
const D_SHIFT = 66;
const D_SCALE = 0.96;

const Plate: React.FC<{ src: string; cam: number; push?: number; origin?: string; dx?: number; dy?: number }> = ({ src, cam, push = 1, origin = '50% 70%', dx = 0, dy = 0 }) => (
  <Img
    src={staticFile(`img/${src}`)}
    style={{ position: 'absolute', left: -cam, top: 0, width: 1280, height: 1920, transformOrigin: origin, transform: `translate(${dx}px, ${dy}px) scale(${push})` }}
  />
);

// 몽글 층 — 판과 같은 크기의 투명 PNG. 발(foot)을 기준으로 옮기고 늘이고 누른다.
const Layer: React.FC<{ src: string; cam: number; foot: readonly [number, number]; dx: number; dy: number; sx: number; sy: number; rot?: number }> = ({ src, cam, foot, dx, dy, sx, sy, rot = 0 }) => (
  <Img
    src={staticFile(`img/${src}`)}
    style={{
      position: 'absolute',
      left: -cam,
      top: 0,
      width: 1280,
      height: 1920,
      transformOrigin: `${foot[0]}px ${foot[1]}px`,
      transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${sx}, ${sy})`,
    }}
  />
);

// 다가감 — 몸을 뒤로 젖힌 채 계란 쪽으로 콩콩 두 번 다가와 몸을 기울여 들여다봄(옆으로 멀리 오면 왼쪽 끝에 잘린다 — v1 첫 렌더)
const ShotA: React.FC<{ f: number }> = ({ f }) => {
  const t = f / SCENE_FPS;
  const dx = interpolate(t, [0, 0.9], [-24, 0], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const hop = (a: number, b: number) => (t >= a && t <= b ? Math.sin(((t - a) / (b - a)) * Math.PI) : 0);
  const h = hop(0.12, 0.42) + hop(0.5, 0.8);
  const land = (a: number) => interpolate(t, [a, a + 0.06, a + 0.14], [0, 1, 0], clamp);
  const squash = 0.07 * (land(0.42) + land(0.8));
  const rot = interpolate(t, [0, 0.8, 1.2], [-8, -3, 4], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const push = interpolate(t, [0, T.touch], [1.0, 1.025], clamp);
  return (
    <AbsoluteFill style={{ transformOrigin: '50% 75%', transform: `scale(${push})` }}>
      <Plate src="a_bg.jpg" cam={CAM_A} />
      <Layer src="a_m.png" cam={CAM_A} foot={FOOT.a} dx={dx} dy={-26 * h} sx={1 + squash} sy={1 - squash + 0.04 * h} rot={rot} />
    </AbsoluteFill>
  );
};

// 닿음 — 가까이: 몸 층이 계란 쪽으로 밀려 들어가(0~0.18초) 닿는 순간 눌리고 흰 김이 튀며 떨다가(0.18~0.42초) 몸을 떼며 솟는다(0.42~0.7초)
const ShotB: React.FC<{ f: number }> = ({ f }) => {
  const t = f / SCENE_FPS; // 이 칸 안의 초
  const HIT = 0.18;
  const slide = interpolate(t, [0, HIT], [-150, 0], { ...clamp, easing: Easing.in(Easing.quad) });
  const press = interpolate(t, [HIT, HIT + 0.05, HIT + 0.2, 0.45], [1, 0.9, 0.95, 0.97], clamp); // 계란에 눌려 가로로 줄어듦
  const k = interpolate(t, [HIT, 0.45], [1, 0.3], clamp);
  const tremble = t >= HIT && t < 0.42 ? Math.sin(t * 110) * 6 * k : 0;
  const pull = interpolate(t, [0.42, 0.7], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) }); // 데인 순간 확 떨어진다 — 0.25초 간격 그림에도 잡히게
  const dx = slide - 110 * pull + tremble;
  const dy = -200 * pull;
  const sy = 1 + 0.14 * pull;
  const rot = -9 * pull;
  const push = interpolate(t, [0, 0.7], [1.0, 1.06], clamp) + 0.04 * interpolate(t, [HIT, HIT + 0.04, HIT + 0.22], [0, 1, 0], clamp);
  const splash = interpolate(t, [HIT, HIT + 0.05, 0.55, 0.7], [0, 1, 1, 0], clamp);
  const splashS = interpolate(t, [HIT, HIT + 0.12], [0.6, 1.1], clamp);
  return (
    <AbsoluteFill style={{ transformOrigin: '49% 69%', transform: `scale(${push})` }}>
      <Plate src="b_bg.jpg" cam={CAM_CLOSE} />
      <Layer src="b_m.png" cam={CAM_CLOSE} foot={TOUCH_PT} dx={dx} dy={dy} sx={press / Math.sqrt(sy)} sy={sy} rot={rot} />
      <div style={{ position: 'absolute', inset: 0, opacity: splash }}>
        <Layer src="b_splash.png" cam={CAM_CLOSE} foot={TOUCH_PT} dx={0} dy={0} sx={splashS} sy={splashS} />
      </div>
    </AbsoluteFill>
  );
};

// 펄쩍 — 몽글 층이 바닥에서 솟아(늘어남) 꼭대기를 지나 왼쪽으로 떨어진다(내려오며 다시 늘어남)
const ShotC: React.FC<{ f: number }> = ({ f }) => {
  const p = f / fr(T.land - T.jump); // 0..1
  const groundA = FOOT.a[1] - FOOT.c[1]; // 바닥에 있을 때의 dy(+333)
  const groundD = FOOT.d[1] - FOOT.c[1];
  const up = interpolate(p, [0, 0.42], [groundA - 110, -24], { ...clamp, easing: Easing.out(Easing.cubic) }); // 가까운 칸 끝에서 이미 솟던 몸을 이어 받는다
  const down = interpolate(p, [0.42, 1], [-24, groundD], { ...clamp, easing: Easing.in(Easing.quad) });
  const dy = p < 0.42 ? up : down;
  const dx = interpolate(p, [0, 0.42, 1], [FOOT.a[0] - FOOT.c[0], -120, FOOT.d[0] + D_SHIFT - FOOT.c[0]], clamp);
  const stretch = interpolate(p, [0, 0.3, 0.5, 0.85, 1], [1.16, 1.06, 1.0, 1.08, 1.1], clamp);
  const rot = interpolate(p, [0, 0.42, 1], [3, -5, -2], clamp);
  return (
    <AbsoluteFill>
      <Plate src="c_bg.jpg" cam={CAM_WIDE} />
      <Layer src="c_m.png" cam={CAM_WIDE} foot={FOOT.c} dx={dx} dy={dy} sx={1 / Math.sqrt(stretch)} sy={stretch} rot={rot} />
    </AbsoluteFill>
  );
};

// 착지 — 납작하게 눌렸다가 크게 튀어 오르고(작은 콩) 다시 앉으며 눈물. 뒤 두 친구는 웃음 두 꼴(k4c · k4b)을 0.3초마다 번갈아 들썩인다
const ShotD: React.FC<{ f: number }> = ({ f }) => {
  const t = f / SCENE_FPS;
  const sy = interpolate(t, [0, 0.18, 0.35, 0.5, 0.65], [0.68, 1.15, 0.9, 1.04, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const hop = -34 * interpolate(t, [0.08, 0.2, 0.34], [0, 1, 0], clamp);
  const shiver = t > 0.7 ? Math.sin(t * 48) * 1.6 : 0;
  const push = interpolate(t, [0, 1.3], [1.0, 1.025], clamp);
  const laughB = Math.floor((t + 0.0001) / 0.3) % 2 === 1; // 0.3초마다 웃음 꼴을 바꾼다
  return (
    <AbsoluteFill style={{ transformOrigin: '35% 80%', transform: `scale(${push})` }}>
      <Plate src={laughB ? 'd_bg2.jpg' : 'd_bg.jpg'} cam={CAM_WIDE} />
      <Layer src="d_m.png" cam={CAM_WIDE} foot={FOOT.d} dx={D_SHIFT} dy={hop} sx={(D_SCALE * 1) / Math.sqrt(sy)} sy={D_SCALE * sy} rot={shiver} />
    </AbsoluteFill>
  );
};

// 효과음(초 · 파일 · 크기)
const SFX: [number, string, number][] = [
  [0.12, 'tok.wav', 0.12],
  [0.5, 'tok.wav', 0.12],
  [T.touch + 0.18, 'sizzle_hit.wav', 0.7],
  [T.touch + 0.2, 'puff.wav', 0.25],
  [T.touch + 0.42, 'whoosh_up.wav', 0.3],
  [T.jump + 0.02, 'boing.wav', 0.25],
  [2.55, 'whoosh_down.wav', 0.22],
  [T.land, 'thud.wav', 0.45],
  [T.land + 0.12, 'boing.wav', 0.14],
  [3.5, 'shiver.wav', 0.2],
  [3.7, 'sad.wav', 0.16],
];
const VO: [string, number][] = [['m2', T.touch + 0.44]]; // 뜨거워! — 몸을 떼며 솟는 순간(1.74초)

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.18 * MASTER * interpolate(i, [SCENE_FRAMES - 12, SCENE_FRAMES], [1, 0], clamp)} />
    <Audio src={staticFile('sfx/room.wav')} volume={0.1 * MASTER} endAt={SCENE_FRAMES} />
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

export const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const s = frame / SCENE_FPS;
  let shot: React.ReactNode;
  if (s < T.touch) shot = <ShotA f={frame} />;
  else if (s < T.jump) shot = <ShotB f={frame - fr(T.touch)} />;
  else if (s < T.land) shot = <ShotC f={frame - fr(T.jump)} />;
  else shot = <ShotD f={frame - fr(T.land)} />;
  return (
    <AbsoluteFill style={{ backgroundColor: '#3a2412', overflow: 'hidden' }}>
      {shot}
      <Sound />
    </AbsoluteFill>
  );
};
