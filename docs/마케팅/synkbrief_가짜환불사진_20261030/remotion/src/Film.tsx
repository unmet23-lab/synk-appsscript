// synkbrief B20 「가짜 환불 사진」 본편(31.2초) — 제작 절차 「한 장면 먼저」 셋째 시험 편.
// 뼈대는 원본 OgcUEwcQY8A(리꼬 「삼성이 작정하고 숨겨둔 대박 AI 기능 3가지」 41초): 0~2.4초 큰 훅 글 → 2.4초 첫 칸 → 11.3초 둘째 칸 →
// 21.4초 셋째 칸(제미나이로 먹던 음식 사진을 「먹기 전으로」) → 30.9초 새 음식으로 돌아감(가장 센 장면) → 39.2초 첫 컷 구도로 돌아와 끝 한마디(끝 카드 없음).
// 우리는 같은 자리에: 리뷰 사진(속이 분홍빛) → 사장님 억울 → 다시 저장한 사진은 제미나이 「판별할 수 없습니다」 → 원본 파일 요청 →
// 파일 그대로는 「AI로 편집된 기록」 → 반전: 분홍 속살이 녹아 원래 다 익은 치킨으로 → 첫 컷 구도로 돌아옴(수미상관).
// 컷 · 박자는 원본 초 × 0.761(우리 31.2초 ÷ 원본 41초) 자리에 둔다 — 「나란히」가 우리 초를 원본 길이로 늘여 견준다(첫 2초만 실제 초).
// 무대는 화면 가득 배달 치킨 사진 · 치킨집 주방(B18 메뉴판 벽 · B19 옛 사진과 다름), 배경음 「퀴즈120_테크팝」(B18 「시티팝_147」 · B19 「따뜻_118」과 다름).
// 「후」(다 익은 원래 사진)는 끝 3초(28.39초)에 첫 컷 구도에서 처음 녹아 보인다(전후 편 규칙 · v5 볼 이유 심사).
// v2 시험관 넷이 같이 짚은 자리(검은 글 화면 5초 · 작은 글 · 「예시로 만든 사진」 · 앞치마 몸통 컷)를 고친 v3 — 기획.md 「이해 시험」.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import PLACE from './vo-place.json';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * 30);

// 장면 시작 초 — 원본 박자(오마주.json 「박자」) × 0.761
// v6: v5 볼 이유 심사(Opus) 「흰 속살 뒤집기가 26초에 먼저 나와 끝이 재방송」 → 「후」(다 익은 속살)는 끝 3초(28.39초)에 처음 · 한 번만.
// 원본 반전 자리(30.9 → 23.51초)는 꼬리표가 떨어지는 장면(v7 — v6 시험관 셋 「꼬리표가 뭔지」 · Opus 「정리 카드는 복습」).
export const S = {
  hook: 0, jump: 0.5, v1: 1.83, v1b: 4.11, v1c: 5.63, photo: 6.77, photo1: 7.15, photo2: 7.38,
  t2: 8.6, t2big: 9.21, t2hl: 10.5, doubt: 12.1, unknown: 14.46, unknown2: 15.52,
  ask: 16.29, t1: 18.04, t1big: 18.42, t1hl: 19.41, back: 21.16,
  sum: 23.51, sum2: 24.58, sumhl: 26.03, home: 26.48, melt: 28.39, stamp: 29.83, end: 31.2,
};
export const TOTAL = sec(S.end);
// V1(제미나이 앱 동영상 만들기, 720×1280 → 1080×1920): 사장님이 휴대폰을 보다 치킨을 갈라 하얀 속살을 보고 숨을 내쉰다.
export const V1 = { from: 4.2, tear: 5.7, sigh: 7.6, relief: 8.3 };

const vo = (id: string) => (PLACE as { id: string; at: number }[]).find((c) => c.id === id)!.at;

// 원본 꼴 큰 글(가운데 위, 흰 굵은 글 + 어두운 반투명 판) — 사진 · 얼굴을 가리지 않게 위쪽
const Big: React.FC<{ text: string; from: number; to: number; y?: number; size?: number; color?: string }> = ({ text, from, to, y = 250, size = 76, color = '#fff' }) => {
  const f = useCurrentFrame();
  const a = sec(from), b = sec(to);
  if (f < a || f >= b) return null;
  const p = interpolate(f, [a, a + 5], [0.86, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ position: 'absolute', left: 50, right: 50, top: y, display: 'flex', justifyContent: 'center' }}>
      <div style={{ fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1.22, letterSpacing: -1.5, color, textAlign: 'center', wordBreak: 'keep-all',
        background: 'rgba(12,12,12,0.82)', padding: '14px 30px', borderRadius: 18, scale: `${p}` }}>
        {text}
      </div>
    </div>
  );
};

// 아래 자막(말과 같은 글)
const Cap: React.FC<{ text: string; from: number; to: number; y?: number; color?: string }> = ({ text, from, to, y = 1500, color = '#fff' }) => {
  const f = useCurrentFrame();
  const o = Math.min(interpolate(f, [from, from + 4], [0, 1], clamp), interpolate(f, [to - 4, to], [1, 0], clamp));
  if (o <= 0) return null;
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: y, display: 'flex', justifyContent: 'center', opacity: o }}>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 56, lineHeight: 1.28, letterSpacing: -1, color, textAlign: 'center', wordBreak: 'keep-all',
        background: 'rgba(10,10,10,0.92)', padding: '12px 26px', borderRadius: 16, maxWidth: 960 }}>
        {text}
      </div>
    </div>
  );
};

// 작은 이름표(사진 위 왼쪽 위)
const Tag: React.FC<{ text: string; from: number; to: number; y?: number; bg?: string; fg?: string }> = ({ text, from, to, y = 520, bg = 'rgba(250,246,236,0.96)', fg = '#2a1d10' }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  const p = interpolate(f, [sec(from), sec(from) + 6], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ position: 'absolute', left: 56, top: y, opacity: p, translate: `${(1 - p) * -20}px 0` }}>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 46, color: fg, background: bg, padding: '8px 20px', borderRadius: 12 }}>{text}</div>
    </div>
  );
};

// 사진 판 — 쪽마다 다가가는 정도(원본 박자마다 한 단계)
const Photo: React.FC<{ src: string; steps: [number, number, number, number][]; base?: number }> = ({ src, steps, base = 0 }) => {
  const f = useCurrentFrame() + base;
  let s = 1, ox = 540, oy = 960;
  for (const [t, sc, x, y] of steps) if (f >= sec(t)) { s = sc; ox = x; oy = y; }
  const drift = interpolate(f, [0, 300], [0, 0.15], clamp);
  return <Img src={staticFile(src)} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, transformOrigin: `${ox}px ${oy}px`, scale: `${s + drift}` }} />;
};

// 실제 제미나이 화면 한 컷(그대로) → 같은 글을 크게 다시 짠다(제작 절차 「실제 화면은 크게 다시 짜기」 — 글은 실제 그대로)
const Screen: React.FC<{ shot: string; zoom: [number, number, number, number][]; bigAt: number; label: string; children: React.ReactNode }> = ({ shot, zoom, bigAt, label, children }) => {
  const f = useCurrentFrame();
  let s = 1, ox = 400, oy = 295;
  for (const [t, sc, x, y] of zoom) if (f >= sec(t)) { s = sc; ox = x; oy = y; }
  const q = interpolate(f, [sec(bigAt) - 4, sec(bigAt) + 6], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill style={{ background: '#111' }}>
      <Img src={staticFile('img/가짜.jpg')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, filter: 'blur(24px) brightness(0.5)', scale: '1.1', opacity: q }} />
      <div style={{ position: 'absolute', left: 0, top: 560, width: 1080, height: 797, overflow: 'hidden', opacity: 1 - q }}>
        <Img src={staticFile(shot)} style={{ width: 1080, height: 797, transformOrigin: `${ox * 1.35}px ${oy * 1.35}px`, scale: `${s}` }} />
      </div>
      <div style={{ position: 'absolute', left: 50, right: 50, top: 330, opacity: 1 - q, display: 'flex', justifyContent: 'center' }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 44, color: '#fff', background: 'rgba(66,103,210,0.9)', padding: '8px 22px', borderRadius: 12 }}>{label}</div>
      </div>
      <div style={{ position: 'absolute', left: 44, right: 44, top: 480, opacity: q, translate: `0 ${(1 - q) * 30}px`, scale: `${1 + (f / 30) * 0.012}` }}>{children}</div>
    </AbsoluteFill>
  );
};

export const Hl: React.FC<{ on: number; children: React.ReactNode }> = ({ on, children }) => {
  const f = useCurrentFrame();
  const w = interpolate(f, [sec(on), sec(on) + 8], [0, 1], { ...clamp, easing: EASE_OUT });
  return <span style={{ fontWeight: 900, backgroundImage: 'linear-gradient(#ffd84a, #ffd84a)', backgroundRepeat: 'no-repeat', backgroundPosition: '0 88%', backgroundSize: `${w * 100}% 38%` }}>{children}</span>;
};

export const Card: React.FC<{ head: string; tag?: string; children: React.ReactNode }> = ({ head, tag, children }) => (
  <>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
      <Img src={staticFile('img/가짜.jpg')} style={{ width: 110, height: 196, objectFit: 'cover', borderRadius: 12, border: '3px solid rgba(250,246,236,0.9)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tag ? <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 46, color: '#1d1a16', background: '#ffd84a', padding: '6px 18px', borderRadius: 12, width: 'fit-content' }}>{tag}</div> : null}
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 50, lineHeight: 1.25, color: '#fff', background: 'rgba(10,10,10,0.85)', padding: '8px 20px', borderRadius: 14, whiteSpace: 'pre-line' }}>{head}</div>
      </div>
    </div>
    <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 60, lineHeight: 1.36, wordBreak: 'keep-all', letterSpacing: -1, color: '#1d1a16', background: 'rgba(250,246,236,0.97)', padding: '28px 34px', borderRadius: 26 }}>
      {children}
    </div>
  </>
);

// 사장님(V1) — 제미나이가 가로(1280×720)로 만들어 얼굴은 턱 아래로 잘렸다. 손 · 치킨 · 휴대폰 자리를 3:4로 잘라 가운데 크게(배율 k),
// 위아래는 같은 영상을 흐리게 깐다. 컷마다 [시작 초, 배율 k, 원본에서 가운데 x, 원본에서 가운데 y](원본 화소)로 다른 크기 — 원본 박자에 맞춘 디지털 줌.
export const BOSS_SRC = { w: 1280, h: 720 };
export const Boss: React.FC<{ start: number; crops: [number, number, number, number][]; vol?: number; rate?: number }> = ({ start, crops, vol = 0.5, rate = 1 }) => {
  const f = useCurrentFrame();
  let k = 2, cx = 640, cy = 400;
  for (const [t, kk, x, y] of crops) if (f >= sec(t)) { k = kk; cx = x; cy = y; }
  const W = BOSS_SRC.w * k, H = BOSS_SRC.h * k;
  const left = Math.min(0, Math.max(1080 - W, 540 - cx * k));
  const top = Math.min(240, Math.max(1680 - H, 960 - cy * k));
  return (
    <AbsoluteFill style={{ background: '#111', overflow: 'hidden' }}>
      <OffthreadVideo src={staticFile('img/V1.mp4')} startFrom={sec(start)} playbackRate={rate} muted
        style={{ position: 'absolute', left: -1166, top: 0, width: 3413, height: 1920, filter: 'blur(28px) brightness(0.42)' }} />
      <div style={{ position: 'absolute', left: 0, top: 240, width: 1080, height: 1440, overflow: 'hidden' }}>
        <OffthreadVideo src={staticFile('img/V1.mp4')} startFrom={sec(start)} playbackRate={rate} volume={vol}
          style={{ position: 'absolute', left, top: top - 240, width: W, height: H }} />
      </div>
    </AbsoluteFill>
  );
};

// 반전 — 리뷰 사진(가짜)의 분홍 속살이 녹아 원래 사진(다 익은 속살)으로. 두 판은 구도가 맞는다(배경 차이 평균 2.7/255).
// 장면 심사 v1(Opus) 「「(예시)」 딱지가 반전을 꺾는다」 → 도장은 「AI로 고치기 전」만, 예시라는 표시는 화면 아래 작은 글(Honest)로.
// steps: [반전 뒤 초, 배율, 가운데 x, 가운데 y] — 원본 박자 자리에서 한 단계씩 확 다가감
export const Reveal: React.FC<{ stampAt?: number; steps?: [number, number, number, number][]; melt?: boolean; meltAt?: number }> = ({ stampAt = 0.63, steps = [[0, 1.18, 540, 1150]], melt = true, meltAt = 4 }) => {
  const f = useCurrentFrame();
  const m = melt ? interpolate(f, [meltAt, meltAt + 22], [0, 1], { ...clamp, easing: Easing.bezier(0.45, 0, 0.55, 1) }) : 1;
  let s = 1.18, ox = 540, oy = 1150;
  for (const [t, sc, x, y] of steps) if (f >= sec(t)) { s = sc; ox = x; oy = y; }
  s += (f / 30) * 0.012;
  const st = interpolate(f, [sec(stampAt), sec(stampAt) + 6], [1.4, 1], { ...clamp, easing: EASE_OUT });
  const so = interpolate(f, [sec(stampAt), sec(stampAt) + 3], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transformOrigin: `${ox}px ${oy}px`, scale: `${s}` }}>
        <Img src={staticFile('img/가짜.jpg')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920 }} />
        <Img src={staticFile('img/원래.jpg')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, opacity: m }} />
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 520, top: 560, opacity: so, scale: `${st}`, rotate: '-6deg' }}>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 60, color: '#fff', background: 'rgba(214,48,49,0.94)', padding: '8px 22px', borderRadius: 12, border: '4px solid #fff' }}>AI로 고치기 전</div>
      </div>
    </AbsoluteFill>
  );
};

// 반전 직전 리뷰 사진 위 판정 도장(장면 심사 v1 답 4 「같은 사진 위에 판정 딱지를 붙였다가 하얀 원본으로」)
const Verdict: React.FC<{ at: number; text: string; color: string }> = ({ at, text, color }) => {
  const f = useCurrentFrame();
  const st = interpolate(f, [sec(at), sec(at) + 6], [1.5, 1], { ...clamp, easing: EASE_OUT });
  const so = interpolate(f, [sec(at), sec(at) + 3], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', left: 470, top: 560, opacity: so, scale: `${st}`, rotate: '-6deg' }}>
      <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 60, color, background: 'rgba(255,255,255,0.95)', padding: '8px 22px', borderRadius: 12, border: `5px solid ${color}` }}>{text}</div>
    </div>
  );
};

// 예시라는 표시(작게, 아래 오른쪽 — 처음부터 끝까지). Fable 사실 검수 · 장면 심사 v1을 함께 맞춤 — v2 haiku 「「재연」 뜻 불분명」 · sonnet 「「예시로 만든 사진」이 안 와닿음」 → 「예시로 꾸민 장면」
const Honest: React.FC = () => (
  <div style={{ position: 'absolute', left: 64, top: 262, fontFamily: KO, fontWeight: 700, fontSize: 34, color: '#fff', background: 'rgba(10,10,10,0.72)', padding: '6px 16px', borderRadius: 999 }}>
    예시로 꾸민 장면
  </div>
);

// 첫 화면 리뷰 맥락(장면 심사 v1 답 4 「이 사진으로 누가 가게를 몰아세웠다는 이야기를 먼저」) — 배달앱 화면을 흉내 내지 않는 따옴표 판
const Review: React.FC<{ to: number }> = ({ to }) => {
  const f = useCurrentFrame();
  if (f >= sec(to)) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1380, display: 'flex', justifyContent: 'center' }}>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 52, lineHeight: 1.3, color: '#2a1d10', background: 'rgba(250,246,236,0.97)', padding: '16px 28px', borderRadius: 18, textAlign: 'center' }}>
        <span style={{ color: '#e1a500' }}>★</span><span style={{ color: '#c9c3b8' }}>★★★★</span> 리뷰<br />「하나도 안 익었어요. 환불해 주세요」
      </div>
    </div>
  );
};

// 꼬리표 장면 — v6 시험관 셋 「꼬리표가 뭔지 · 왜 떨어지는지」, Opus 「24~26초 정리 카드는 복습」 → 말 대신 움직임으로:
// 사진 파일에 달린 「AI로 고침」 꼬리표가 흔들리다, 다시 저장하자 떨어지고, 「판별 불가」가 찍힌다.
const TagScene: React.FC<{ fallAt: number; stampAt: number; step2: number }> = ({ fallAt, stampAt, step2 }) => {
  const f = useCurrentFrame();
  const fall = interpolate(f, [sec(fallAt), sec(fallAt) + 20], [0, 1], { ...clamp, easing: Easing.bezier(0.5, 0, 0.9, 0.6) });
  const swing = Math.sin(f / 5) * 5 * (1 - fall);
  const save = interpolate(f, [sec(fallAt) - 8, sec(fallAt) - 2, sec(fallAt) + 12, sec(fallAt) + 18], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill>
      <Img src={staticFile('img/가짜.jpg')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, filter: 'blur(26px) brightness(0.42)', scale: '1.1' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 330, display: 'flex', justifyContent: 'center' }}>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 62, color: '#fff', background: 'rgba(10,10,10,0.85)', padding: '10px 28px', borderRadius: 16 }}>꼬리표 = 파일 안의 기록</div>
      </div>
      <div style={{ position: 'absolute', left: 250, top: 500, width: 520, height: 924, rotate: '-2deg', scale: `${(f >= sec(step2) ? 1.2 : f >= sec(fallAt) ? 1.1 : 1) + (f / 30) * 0.012}` }}>
        <Img src={staticFile('img/가짜.jpg')} style={{ width: 520, height: 924, objectFit: 'cover', borderRadius: 10, border: '8px solid #faf6ec', boxSizing: 'border-box' }} />
        <div style={{ position: 'absolute', left: 400, top: -30, width: 340, transformOrigin: '20px 30px', rotate: `${14 + swing + fall * 70}deg`, translate: `${fall * 60}px ${fall * 1000}px`, opacity: 1 - interpolate(fall, [0.75, 1], [0, 1], clamp) }}>
          <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 60, color: '#c0392b', background: '#fff4c2', padding: '16px 24px 16px 54px', borderRadius: '40px 12px 12px 40px', border: '4px solid #c9a227', whiteSpace: 'nowrap' }}>
            <span style={{ position: 'absolute', left: 16, top: 34, width: 22, height: 22, borderRadius: 99, background: '#2a1d10' }} />
            AI로 고침
          </div>
        </div>
        <div style={{ position: 'absolute', left: 90, top: 400, opacity: save, fontFamily: KO, fontWeight: 900, fontSize: 58, color: '#fff', background: 'rgba(66,103,210,0.95)', padding: '10px 24px', borderRadius: 14 }}>다시 저장</div>
      </div>
      <Verdict at={stampAt} text="모른대요" color="#5b5b5b" />
    </AbsoluteFill>
  );
};

const Brand: React.FC = () => (
  <div style={{ position: 'absolute', left: 60, top: 1760, display: 'flex', gap: 12, alignItems: 'center' }}>
    <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 30, color: '#fff', background: 'rgba(10,10,10,0.72)', padding: '6px 16px', borderRadius: 999 }}>
      <span style={{ color: '#5d8bff' }}>●</span> SYNK 브리핑
    </div>
  </div>
);

export const Film: React.FC = () => {
  const music = (x: number) => interpolate(x, [0, sec(S.melt) - 6, sec(S.melt) + 6, TOTAL - 16, TOTAL], [0.13, 0.13, 0.24, 0.24, 0.0], clamp);
  return (
    <AbsoluteFill style={{ background: '#111' }}>
      {/* 0 훅 — 리뷰 사진(가짜)을 화면 가득, 0.5초에 확 다가감(원본 첫 박자) */}
      <Sequence from={0} durationInFrames={sec(S.v1)}>
        <Photo src="img/가짜.jpg" steps={[[0, 1.0, 540, 1150], [S.jump, 1.16, 540, 1150]]} />
      </Sequence>
      {/* 사장님 억울 — V1(손이 방금 튀긴 치킨을 갈라 김 나는 하얀 속살) */}
      <Sequence from={sec(S.v1)} durationInFrames={sec(S.photo) - sec(S.v1)}>
        <Boss start={V1.from} crops={[[0, 2.6, 640, 470], [S.v1b - S.v1, 3.0, 660, 480], [S.v1c - S.v1, 2.6, 680, 440]]} />
      </Sequence>
      {/* 리뷰 사진 속살로 확 다가감 */}
      <Sequence from={sec(S.photo)} durationInFrames={sec(S.t2) - sec(S.photo)}>
        <Photo src="img/가짜.jpg" steps={[[0, 1.4, 520, 1240], [S.photo1 - S.photo, 1.65, 520, 1240], [S.photo2 - S.photo, 1.95, 520, 1240]]} />
      </Sequence>
      {/* 다시 저장한 사진 → 실제 제미나이 화면 한 컷(짧게) → 같은 글을 크게 「판별할 수 없습니다」 */}
      <Sequence from={sec(S.t2)} durationInFrames={sec(S.doubt) - sec(S.t2)}>
        <Screen shot="img/T2_다시저장_답.png" label="실제 화면 · 리뷰에서 저장한 사진" bigAt={S.t2big - S.t2} zoom={[[0, 1, 400, 295]]}>
          <Card head={"제미나이 앱 → 사진 올리고\n「이 사진, AI로 만든 거야?」"} tag="리뷰에서 저장한 사진">
            이 사진은 Google AI로 생성된 이미지가 아니며, … 실제로 촬영된 사진인지 여부는 <Hl on={S.t2hl - S.t2}>판별할 수 없습니다.</Hl>
          </Card>
        </Screen>
      </Sequence>
      {/* 사장님 막막 — V1 첫머리(휴대폰을 내려다보는 손 · 집게) */}
      <Sequence from={sec(S.doubt)} durationInFrames={sec(S.unknown) - sec(S.doubt)}>
        <Boss start={0.2} crops={[[0, 2.0, 840, 360]]} vol={0.4} />
      </Sequence>
      {/* 리뷰 사진 위 회색 도장 「판별 불가」 */}
      <Sequence from={sec(S.unknown)} durationInFrames={sec(S.ask) - sec(S.unknown)}>
        <Photo src="img/가짜.jpg" steps={[[0, 1.0, 540, 1150], [S.unknown2 - S.unknown, 1.16, 540, 1150]]} />
        <Verdict at={0.15} text="모른대요" color="#5b5b5b" />
      </Sequence>
      {/* 원본 파일 요청(원본은 제미나이 반짝이 → 셋째 칸) */}
      <Sequence from={sec(S.ask)} durationInFrames={sec(S.t1) - sec(S.ask)}>
        <AbsoluteFill>
          <Img src={staticFile('img/가짜.jpg')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, filter: 'blur(26px) brightness(0.45)', scale: '1.1' }} />
          <div style={{ position: 'absolute', left: 70, right: 70, top: 760, fontFamily: KO, fontWeight: 800, fontSize: 70, lineHeight: 1.3, color: '#2a1d10', textAlign: 'center', wordBreak: 'keep-all',
            background: 'rgba(250,246,236,0.97)', padding: '34px 30px', borderRadius: 28 }}>
            「원본 사진, <span style={{ color: '#c0392b' }}>파일로</span> 보내 주시겠어요?」
          </div>
        </AbsoluteFill>
      </Sequence>
      {/* 받은 파일 그대로 → 실제 화면 한 컷(짧게) → 「AI 도구로 편집된 기록」 */}
      <Sequence from={sec(S.t1)} durationInFrames={sec(S.back) - sec(S.t1)}>
        <Screen shot="img/T1_파일그대로_답.png" label="실제 화면 · 받은 원본 파일" bigAt={S.t1big - S.t1} zoom={[[0, 1, 400, 295]]}>
          <Card head={"제미나이 앱 → 사진 올리고\n「이 사진, AI로 만든 거야?」"} tag="받은 원본 파일 그대로">
            네, 이 이미지 파일에는 생성형 AI로 제작되고 <Hl on={S.t1hl - S.t1}>AI 도구로 편집되었음을 나타내는</Hl> 검증 가능한 기록이 포함되어 있습니다.
          </Card>
        </Screen>
      </Sequence>
      {/* 리뷰 사진 다시 + 판정 도장(기록이 뜨는 순간) */}
      <Sequence from={sec(S.back)} durationInFrames={sec(S.sum) - sec(S.back)}>
        <Photo src="img/가짜.jpg" steps={[[0, 1.18, 540, 1150]]} />
        <Verdict at={0.1} text="AI로 고친 사진" color="#d63031" />
      </Sequence>
      {/* 원본 반전 자리 — 파일의 꼬리표가 다시 저장하자 떨어지고 「판별 불가」 */}
      <Sequence from={sec(S.sum)} durationInFrames={sec(S.home) - sec(S.sum)}>
        <TagScene fallAt={S.sum2 - S.sum} step2={25.49 - S.sum} stampAt={S.sumhl - S.sum - 0.2} />
      </Sequence>
      {/* 끝 — 첫 컷 구도의 리뷰 사진(원본 39.2초 수미상관) → 끝 3초에 처음으로 분홍 속살이 녹아 다 익은 치킨(핵심 장면) */}
      <Sequence from={sec(S.home)} durationInFrames={TOTAL - sec(S.home)}>
        <Reveal stampAt={S.stamp - S.home} meltAt={sec(S.melt - S.home)} steps={[[0, 1.16, 540, 1150], [27.78 - S.home, 1.26, 540, 1150], [S.stamp - S.home, 1.36, 540, 1180]]} />
      </Sequence>

      {/* 글 */}
      <Big text="이 사진, 진짜일까요?" from={S.jump} to={S.v1} y={300} size={84} />
      <Review to={S.v1} />
      <Tag text="치킨집 사장님 · 방금 튀긴 치킨" from={S.v1} to={S.photo} y={330} />
      <Cap text="저희는 늘, 이렇게 다 익혀서 나가는데요." from={vo('v02')} to={sec(S.photo)} />
      <Tag text="리뷰에서 저장한 사진" from={S.photo} to={S.t2} y={330} />
      <Cap text="제미나이한테 AI 사진이냐고 물었더니… 모른대요." from={vo('v03')} to={sec(S.doubt)} y={1500} />
      <Cap text="진짜 덜 익은 건지, 알 길이 없는 거죠." from={vo('v09')} to={sec(S.ask)} />
      <Cap text="그래서 원본 파일로 보내 달라고 했죠." from={vo('v04')} to={sec(S.t1)} y={1300} />
      <Cap text="파일 그대로 올리니까, AI로 고친 기록이 나와요." from={vo('v05')} to={sec(S.back)} y={1500} />
      <Cap text="다시 저장한 사진은, 이 꼬리표가 떨어져 있던 거예요." from={vo('v06')} to={vo('v07')} y={1490} />
      <Cap text="「모른다」는, 진짜라는 뜻이 아니에요." from={vo('v07')} to={vo('v08')} color="#ffc928" />
      <Cap text="원래는, 다 익은 치킨이었어요." from={vo('v08')} to={TOTAL} color="#ffc928" />
      <Brand />
      <Honest />

      {(PLACE as { id: string; at: number }[]).map((c) => (
        <Sequence key={c.id} from={c.at}>
          <Audio src={staticFile(`vo/${c.id}.wav`)} />
        </Sequence>
      ))}
      {[S.v1, S.t2, S.ask, S.t1].map((t) => (
        <Sequence key={t} from={sec(t) - 2} durationInFrames={20}>
          <Audio src={staticFile('sfx/tok.wav')} volume={0.3} />
        </Sequence>
      ))}
      {[S.unknown + 0.15, S.back + 0.1].map((t) => (
        <Sequence key={t} from={sec(t)} durationInFrames={30}>
          <Audio src={staticFile('sfx/thud.wav')} volume={0.28} />
        </Sequence>
      ))}
      <Sequence from={sec(S.sum2)} durationInFrames={30}>
        <Audio src={staticFile('sfx/swish.wav')} volume={0.3} />
      </Sequence>
      <Sequence from={sec(S.sumhl - 0.2)} durationInFrames={30}>
        <Audio src={staticFile('sfx/thud.wav')} volume={0.28} />
      </Sequence>
      {[S.melt].map((t) => (
        <Sequence key={t} from={sec(t)} durationInFrames={40}>
          <Audio src={staticFile('sfx/swish.wav')} volume={0.35} />
        </Sequence>
      ))}
      <Sequence from={sec(S.stamp)} durationInFrames={30}>
        <Audio src={staticFile('sfx/pop.wav')} volume={0.3} />
      </Sequence>
      <Audio src={staticFile('bgm.mp3')} volume={music} />
    </AbsoluteFill>
  );
};
