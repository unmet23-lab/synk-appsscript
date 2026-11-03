// synkbrief B23 v2(11-04) — 같은 말 · 소리 · 장면 · 실제 화면에 겉만 「화면 결」로 다시 입힌 판(본보기 synkbrief_요금제질문셋_20261103 FilmV2).
// 유호님 11-03 「누가봐도 ai 슬롭」 — 옛 판의 빨강 · 노랑 꼬리표 · 빨간 줄 · 노란 형광 · ✕○ 빨강 · 초록 칸 · 빨간 상자 · 검은 자막 상자를 뺐다.
// 결: 위 그늘 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳(「원문 그대로」) · 실제 화면은 작은 회색 출처 한 줄, 짚는 줄은 그 밖을 어둡게 ·
// 줄 긋기는 흰 선 · 사람 장면은 내리고 위는 같은 장면을 뒤집어 흐리게 · SUIT 하나 · 마침표 없음 · 안전선 안.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import PLACE from './vo-place.json';
import { S, TOTAL } from './Film';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * 30);
const vo = (id: string) => (PLACE as { id: string; at: number }[]).find((c) => c.id === id)!.at / 30;
const seq = (from: number, to: number, el: React.ReactNode) => <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)}>{el}</Sequence>;

const BUTTER = '#F5C445';
const GREY = '#A3A3A3';
const X = 74;
const TOP = 284;
const SCAN = { w: 1241, h: 1754 };

type Crop = { s: number; cx: number; cy: number; ay?: number };
const Vid: React.FC<{ src: string; start: number; crop: Crop; drift?: number; rate?: number; free?: boolean }> = ({ src, start, crop, drift = 0.01, rate = 1, free }) => {
  const f = useCurrentFrame();
  const s = crop.s * (1 + (f / 30) * drift);
  const ay = crop.ay ?? 960;
  const x = free ? 540 - crop.cx * s : Math.min(0, Math.max(1080 - 1080 * s, 540 - crop.cx * s));
  const y = free ? ay - crop.cy * s : Math.min(0, Math.max(1920 - 1920 * s, ay - crop.cy * s));
  return (
    <AbsoluteFill style={{ background: '#0e0e0e', overflow: 'hidden' }}>
      <OffthreadVideo muted src={staticFile(src)} startFrom={sec(start)} playbackRate={rate}
        style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: `translate(${x}px, ${y}px) scale(${s})` }} />
    </AbsoluteFill>
  );
};
const Pic: React.FC<{ src: string; w: number; h: number; s: number; cx: number; cy: number; ay?: number; drift?: number; bg?: string; children?: React.ReactNode }> = ({ src, w, h, s, cx, cy, ay = 960, drift = 0.012, bg = '#0e0e0e', children }) => {
  const f = useCurrentFrame();
  const z = s * (1 + (f / 30) * drift);
  return (
    <AbsoluteFill style={{ background: bg, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 540 - cx * z, top: ay - cy * z, width: w, height: h, transformOrigin: '0 0', transform: `scale(${z})` }}>
        <Img src={staticFile(src)} style={{ width: w, height: h, display: 'block' }} />
        {children}
      </div>
    </AbsoluteFill>
  );
};
// 사람 장면 — 내리고 위는 뒤집어 흐리게, 컷이 1.035배에서 내려앉는다
const Lowered: React.FC<{ d?: number; children: React.ReactNode }> = ({ d = 260, children }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 8], [1.035, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#0b0b0b' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scaleY(-1)`, transformOrigin: '50% 0%', filter: 'blur(26px) brightness(0.55)' }}>{children}</div>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scale(${z})`, transformOrigin: '50% 30%' }}>{children}</div>
    </AbsoluteFill>
  );
};
const Shade: React.FC = () => (
  <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(10,10,10,0.92) 0px, rgba(10,10,10,0.8) 470px, rgba(10,10,10,0.34) 760px, rgba(10,10,10,0) 940px)' }} />
);

const T: React.FC<{ lines: React.ReactNode[]; from: number; to: number; size?: number; meta?: string; still?: boolean; soft?: boolean }> = ({ lines, from, to, size = 92, meta, still, soft }) => {
  const f = useCurrentFrame();
  const a = sec(from), b = sec(to);
  if (f < a || f >= b) return null;
  const out = interpolate(f, [b - 3, b], [1, 0], clamp);
  const up = (k: number) => {
    const p = still ? 1 : interpolate(f, [a + k * 3, a + k * 3 + 9], [0, 1], { ...clamp, easing: EASE_OUT });
    return { opacity: p * out, transform: `translateY(${(1 - p) * 28}px)` };
  };
  return (
    <div style={{ position: 'absolute', left: X, width: 846, top: TOP, fontFamily: KO, textShadow: '0 2px 14px rgba(0,0,0,0.55)' }}>
      {meta ? <div style={{ ...up(0), fontWeight: 600, fontSize: 32, letterSpacing: -0.5, color: '#C8C8C8', marginBottom: 18 }}>{meta}</div> : null}
      {lines.map((l, i) => (
        <div key={i} style={{ ...up(i + (meta ? 1 : 0)), fontWeight: soft ? 700 : 800, fontSize: size, lineHeight: 1.16, letterSpacing: -2.4, color: soft ? '#D6D6D6' : '#fff', wordBreak: 'keep-all' }}>{l}</div>
      ))}
    </div>
  );
};

// 실제 화면이 무엇인지 — 작은 회색 출처 한 줄
const Src: React.FC<{ text: string; from: number; to: number; y: number; dark?: boolean }> = ({ text, from, to, y, dark }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  return <div style={{ position: 'absolute', left: X, top: y, fontFamily: KO, fontWeight: 600, fontSize: 32, letterSpacing: -0.5, color: dark ? '#3a3a3a' : '#C8C8C8' }}>{text}</div>;
};

const Small: React.FC<{ text: string; from: number; to: number; right?: boolean }> = ({ text, from, to, right }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  const pos = right ? { right: 1080 - 920 } : { left: X };
  return <><div style={{ position: 'absolute', left: 0, right: 0, top: 1240, height: 240, background: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.55))' }} /><div style={{ position: 'absolute', ...pos, top: 1372, fontFamily: KO, fontWeight: 700, fontSize: 34, color: 'rgba(255,255,255,0.9)', letterSpacing: -0.4, textShadow: '0 0 3px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.85), 0 1px 18px rgba(0,0,0,0.8)' }}>{text}</div></>;
};

// 그어 나가는 흰 줄(빨간 줄 대신)
const Strike: React.FC<{ on: number; x: number; y: number; w: number; t?: number }> = ({ on, x, y, w, t = 6 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [sec(on), sec(on) + 9], [0, 1], { ...clamp, easing: EASE_OUT });
  return <div style={{ position: 'absolute', left: x, top: y - t / 2, width: w * p, height: t, background: '#fff', borderRadius: t / 2 }} />;
};

// 두 줄 맞대기 — 위 AI 요약 줄(흰 줄) · 확인 질문 · 진짜 줄 두 덩이
const Flip: React.FC<{ top: number; strikeAt: number }> = ({ top, strikeAt }) => (
  <>
    <Img src={staticFile('img/line_ai_big.png')} style={{ position: 'absolute', left: 33, top: top + 70, width: 1014, height: 84 }} />
    <Strike on={strikeAt} x={60} y={top + 112} w={970} />
    <Img src={staticFile('img/q_bubble.png')} style={{ position: 'absolute', left: 300, top: top + 190, width: 680, height: 204 }} />
    <Img src={staticFile('img/ans_b1.png')} style={{ position: 'absolute', left: 64, top: top + 500, width: 690, height: 99 }} />
    <Img src={staticFile('img/ans_b2.png')} style={{ position: 'absolute', left: 64, top: top + 615, width: 952, height: 93 }} />
  </>
);

// 여덟 번 — 흑백 칸(실제 결과: 기획.md 「결과 화면」). 바뀐 칸은 흰 테두리, 그대로인 칸은 어둡게
// 시험관 셋이 「바뀜 · 그대로 칸이 무슨 표시인지」를 같이 짚어 칸 글을 빼고 큰 숫자 + 점 여덟으로. 찬 점 = 조건이 바뀐 번
const RUNS = [false, false, false, false, false, true, true, false];
const Tally: React.FC<{ from: number }> = ({ from }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: '#101010' }}>
      <div style={{ position: 'absolute', left: X, top: 650, width: 846, fontFamily: KO, color: '#fff', fontWeight: 800, fontSize: 190, lineHeight: 1.1, letterSpacing: -6 }}>8번 중 6번</div>
      <div style={{ position: 'absolute', left: X, top: 900, width: 846, display: 'flex', gap: 30 }}>
        {RUNS.map((ok, i) => {
          const o = interpolate(f, [sec(from) + i, sec(from) + i + 3], [0, 1], clamp);
          return <div key={i} style={{ opacity: o, width: 76, height: 76, borderRadius: 38, boxSizing: 'border-box', background: ok ? 'transparent' : '#fff', border: ok ? '3px solid rgba(255,255,255,0.45)' : 'none' }} />;
        })}
      </div>
      <div style={{ position: 'absolute', left: X, top: 1006, fontFamily: KO, fontWeight: 600, fontSize: 36, letterSpacing: -0.6, color: '#C8C8C8' }}>찬 점이 조건을 바꾼 답이에요</div>
    </AbsoluteFill>
  );
};

// 두 조건 맞대기 — 「설치」와 「폐업 반환」이 어떻게 다른지(시험관 둘이 26초까지 못 잡음)
const Two: React.FC = () => {
  const f = useCurrentFrame();
  const up = (k: number) => { const p = interpolate(f, [k, k + 9], [0, 1], { ...clamp, easing: EASE_OUT }); return { opacity: p, transform: `translateY(${(1 - p) * 28}px)` }; };
  const label: React.CSSProperties = { fontWeight: 600, fontSize: 34, color: '#C8C8C8', marginBottom: 8, letterSpacing: -0.5 };
  const body: React.CSSProperties = { fontWeight: 800, fontSize: 64, lineHeight: 1.22, letterSpacing: -1.8, wordBreak: 'keep-all' };
  return (
    <AbsoluteFill style={{ background: '#0e0e0e' }}>
      <div style={{ position: 'absolute', left: X, width: 846, top: 660, fontFamily: KO }}>
        <div style={up(0)}><div style={label}>AI 요약</div><div style={{ ...body, color: '#9a9a9a', textDecoration: 'line-through', textDecorationThickness: 4 }}>6개월 안에 키오스크 설치</div></div>
        <div style={{ ...up(6), marginTop: 52 }}><div style={label}>원문</div><div style={{ ...body, color: '#fff' }}>6개월 안에 폐업하면 지원금 반환</div></div>
      </div>
    </AbsoluteFill>
  );
};

// 확인 한 줄(글은 실제로 친 요청 그대로) — 말풍선 · 칠 대신 왼쪽 선과 글. 「원문 그대로」만 버터
const Prompt: React.FC = () => {
  const f = useCurrentFrame();
  const q = interpolate(f, [0, 7], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill style={{ background: '#0e0e0e', overflow: 'hidden' }}>
      <Img src={staticFile('img/r2_top.png')} style={{ position: 'absolute', left: 0, top: -200, width: 1080, height: 2341, filter: 'blur(18px) brightness(0.32)', transform: `scale(${1.04 + f * 0.001})` }} />
      <div style={{ position: 'absolute', left: X, width: 846, top: 680, fontFamily: KO, borderLeft: '3px solid rgba(255,255,255,0.55)', paddingLeft: 28, opacity: q, transform: `translateY(${(1 - q) * 28}px)` }}>
        <div style={{ fontWeight: 600, fontSize: 32, color: '#C8C8C8', marginBottom: 18 }}>요약 뒤에 이렇게 한 줄</div>
        <div style={{ fontWeight: 800, fontSize: 76, lineHeight: 1.26, letterSpacing: -2, color: '#fff', wordBreak: 'keep-all' }}>
          '6개월'이 나오는 줄을 <span style={{ color: BUTTER }}>원문 그대로</span> 옮겨 줘
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 원문 종이 — 「사.」 두 줄(757~826px)만 남기고 어둡게(노란 칠 대신)
const ScanLine: React.FC<{ s: number; cy: number; ay?: number }> = ({ s, cy, ay = 960 }) => (
  <Pic src="img/scan_page.png" w={SCAN.w} h={SCAN.h} s={s} cx={620} cy={cy} ay={ay} drift={0.01} bg="#1a1a1a">
    <div style={{ position: 'absolute', left: 0, top: 0, width: SCAN.w, height: 750, background: 'rgba(10,10,10,0.9)' }} />
    <div style={{ position: 'absolute', left: 0, top: 832, width: SCAN.w, height: SCAN.h - 832, background: 'rgba(10,10,10,0.9)' }} />
  </Pic>
);
// 걸린 돈 — 잘린 요약 카드(200만 · 140만 · 70%)가 「무슨 숫자인지 · 내가 낼 돈인지」 시험관 둘이 같이 짚어 글로. 값은 요약 화면 그대로(키오스크 200만 원일 때 지원금 140만 원)
const Money: React.FC = () => {
  const f = useCurrentFrame();
  const up = (k: number) => { const p = interpolate(f, [k, k + 9], [0, 1], { ...clamp, easing: EASE_OUT }); return { opacity: p, transform: `translateY(${(1 - p) * 28}px)` }; };
  return (
    <AbsoluteFill style={{ background: '#0e0e0e' }}>
      <div style={{ position: 'absolute', left: X, width: 846, top: 660, fontFamily: KO }}>
        <div style={{ ...up(0), fontWeight: 600, fontSize: 36, color: '#C8C8C8', letterSpacing: -0.5, marginBottom: 14 }}>키오스크 200만 원이면, 받은 지원금은</div>
        <div style={{ ...up(4), fontWeight: 800, fontSize: 170, lineHeight: 1.08, letterSpacing: -6, color: '#fff' }}>140만 원</div>
        <div style={{ ...up(10), fontWeight: 700, fontSize: 56, marginTop: 22, letterSpacing: -1.4, color: '#fff', wordBreak: 'keep-all' }}>6개월 안에 폐업하면 돌려줘야 해요</div>
      </div>
    </AbsoluteFill>
  );
};

// 종이의 그 줄을 크게 다시— 시험관 셋이 「공문 글씨가 작아 못 읽음」(글은 공문 그대로)
const ScanBig: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  const q = interpolate(f, [sec(from) + 2, sec(from) + 11], [0, 1], { ...clamp, easing: EASE_OUT });
  return <div style={{ position: 'absolute', left: X, width: 846, top: 1230, opacity: q, transform: `translateY(${(1 - q) * 28}px)`, fontFamily: KO, fontWeight: 800, fontSize: 60, lineHeight: 1.24, letterSpacing: -1.6, color: '#fff', wordBreak: 'keep-all' }}>6개월 안에 폐업하면<br />지원금을 돌려주셔야 합니다</div>;
};

const Sfx: React.FC<{ t: number; src: string; vol: number }> = ({ t, src, vol }) => (
  <Sequence from={sec(t)} durationInFrames={60}><Audio src={staticFile(src)} volume={vol} /></Sequence>
);

const FACE = (s: number) => ({ s, cx: 470, cy: 560, ay: 820 });
const Man: React.FC<{ start: number; crop: Crop; drift?: number; rate?: number }> = (p) => <Lowered><Vid src="img/V1.mp4" {...p} /></Lowered>;

export const FilmV2: React.FC = () => {
  const bgm = (fr: number) => interpolate(fr, [0, sec(0.4), sec(S.turn - 0.3), sec(S.turn), sec(29.5), sec(30.3), sec(S.total - 0.7), sec(S.total)],
    [0, 0.13, 0.13, 0.0, 0.0, 0.1, 0.1, 0], clamp);
  const V = { wait: 0.0, react: 2.55, gaze: 4.23, mutter: 6.3 };
  const KIOSK = { s: 1.7, cx: 860, cy: 700, ay: 900 };
  const AY = 1120;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {seq(S.a, S.line, <Pic src="img/r2_top.png" w={1080} h={2341} s={1.0} cx={540} cy={640} ay={AY} drift={0.015} />)}
      {seq(S.line, S.man, <Pic src="img/r2_top.png" w={1080} h={2341} s={1.0} cx={540} cy={1180} ay={AY} drift={0.015} />)}
      {seq(S.man, S.wrong, <Pic src="img/r1_bullets.png" w={1080} h={441} s={1.0} cx={540} cy={220} ay={AY - 40} drift={0.02} />)}
      {seq(S.wrong, S.scan, <AbsoluteFill style={{ background: '#0e0e0e' }}>
        <Img src={staticFile('img/line_ai_big.png')} style={{ position: 'absolute', left: 33, top: 860, width: 1014, height: 84 }} />
        <Strike on={0.05} x={60} y={902} w={970} />
      </AbsoluteFill>)}
      {seq(S.scan, S.l1, <Pic src="img/scan_page.png" w={SCAN.w} h={SCAN.h} s={1.15} cx={620} cy={255} ay={AY - 60} drift={0.01} bg="#0e0e0e">
        {/* 제목 띠만 남긴다 — 화면을 흰 종이로 다 채우면 앞뒤 어두운 화면과 부딪힌다 */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: SCAN.w, height: 150, background: '#0e0e0e' }} />
        <div style={{ position: 'absolute', left: 0, top: 318, width: SCAN.w, height: SCAN.h - 318, background: '#0e0e0e' }} />
      </Pic>)}
      {seq(S.l1, S.flashP, <Pic src="img/line_R1.png" w={1080} h={385} s={1.0} cx={540} cy={190} ay={AY - 60} drift={0.02} />)}
      {seq(S.flashP, S.tally, <Pic src="img/line_R5.png" w={1080} h={502} s={1.0} cx={540} cy={250} ay={AY - 60} drift={0.02} />)}
      {seq(S.tally, S.tally2, <Tally from={0} />)}
      {seq(S.tally2, S.blur, <Tally from={-60} />)}
      {seq(S.blur, S.key, <Pic src="img/line_R2.png" w={1080} h={502} s={1.0} cx={540} cy={250} ay={AY - 60} drift={0.015} />)}
      {seq(S.key, S.typing, <Vid src="img/type.mp4" start={0} crop={{ s: 1.0, cx: 540, cy: 1300, ay: 1160 }} free drift={0.0} rate={0.01} />)}
      {seq(S.typing, 14.2, <Vid src="img/type.mp4" start={0} crop={{ s: 1.35, cx: 440, cy: 1760, ay: 1160 }} free drift={0.0} rate={4.55 / (14.2 - S.typing)} />)}
      {seq(14.2, S.send, <Prompt />)}
      {seq(S.send, S.prompt, <Vid src="img/type.mp4" start={4.55} crop={{ s: 1.0, cx: 540, cy: 1300, ay: 1160 }} free drift={0.0} />)}
      {seq(S.prompt, S.ans, <Man start={V.wait} crop={FACE(1.35)} drift={0.01} />)}
      {seq(S.ans, S.flip, <Vid src="img/type.mp4" start={6.3} crop={{ s: 1.0, cx: 540, cy: 1100, ay: 1060 }} free drift={0.0} />)}
      {seq(S.flip, S.paper, <AbsoluteFill style={{ background: '#0e0e0e' }}><Flip top={470} strikeAt={0.1} /></AbsoluteFill>)}
      {seq(S.paper, S.ai, <Man start={V.react} crop={FACE(1.4)} drift={0.012} />)}
      {seq(S.ai, S.real, <ScanLine s={1.0} cy={792} ay={AY - 40} />)}
      {seq(S.real, S.turn, <Two />)}
      {seq(S.turn, S.p2, <Man start={V.mutter} crop={FACE(1.45)} drift={0.0} />)}
      {seq(S.p2, S.p4, <Man start={V.mutter + (S.p2 - S.turn)} crop={KIOSK} drift={0.0} />)}
      {seq(S.p4, S.wide, <Man start={V.mutter + (S.p4 - S.turn)} crop={FACE(2.0)} drift={0.005} />)}
      {seq(S.wide, S.card1, <Man start={V.mutter + (S.wide - S.turn)} crop={FACE(1.3)} drift={0.008} />)}
      {seq(S.card1, S.card, <Pic src="img/r1_bullets.png" w={1080} h={441} s={1.0} cx={540} cy={220} ay={AY - 40} drift={0.015}><Strike on={0.05} x={372} y={196} w={645} t={5} /></Pic>)}
      {seq(S.card, S.worry, <Money />)}
      {seq(S.worry, S.f3, <Man start={V.gaze} crop={{ s: 1.25, cx: 700, cy: 640, ay: 900 }} drift={0.008} rate={(V.mutter - V.gaze) / (S.f3 - S.worry)} />)}
      {seq(S.f3, S.end, <ScanLine s={0.86} cy={792} ay={AY - 40} />)}
      {/* 끝 3초 — 사장님 장면을 다시, 아래에 원문 줄 */}
      {seq(S.end, S.end2, <Man start={5.4} rate={0.7} crop={{ s: 1.25, cx: 700, cy: 640, ay: 900 }} drift={0.008} />)}
      {seq(S.end2, S.total, <Man start={5.4 + (S.end2 - S.end) * 0.7} rate={0.7} crop={FACE(1.6)} drift={0.008} />)}
      <Shade />
      {/* 치는 화면은 위쪽에 앱 글이 많아 글자 뒤를 더 누른다 */}
      {seq(S.key, 14.2, <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(10,10,10,0.97) 0px, rgba(10,10,10,0.97) 560px, rgba(10,10,10,0) 760px)' }} />)}
      {seq(S.end, S.total, <>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1080, height: 300, background: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.82) 22%, rgba(0,0,0,0.82))' }} />
        <Img src={staticFile('img/ans_b1.png')} style={{ position: 'absolute', left: 64, top: 1150, width: 690, height: 99, mixBlendMode: 'screen' }} />
        <Img src={staticFile('img/ans_b2.png')} style={{ position: 'absolute', left: 64, top: 1252, width: 952, height: 93, mixBlendMode: 'screen' }} />
      </>)}

      <T meta="지원금 최대 140만 원이 걸린 공문" lines={['흐릿한 공문,', 'AI 요약에 이렇게 나왔어요']} from={0} to={S.wrong - 0.05} size={76} still />
      <T lines={['그런데 원문엔', '이런 말이 없어요']} from={vo('n02')} to={S.scan} />
      <T lines={['새 대화로 여덟 번 물었더니', '여섯 번이 조건을 바꿨어요']} from={vo('n03')} to={vo('n04') - 0.05} size={72} />
      <T lines={['확인은', '한 줄이면 돼요']} from={vo('n04')} to={14.2} />
      <T lines={["'6개월' 자리엔", '마감일 · 금액을 넣어도 돼요']} from={vo('n08')} to={S.send} size={72} />
      <T soft lines={['요약을 믿고', '키오스크를 들인 사장님']} from={S.prompt + 0.1} to={S.ans} size={76} />
      <T lines={['요약할 땐 AI가,', '그럴듯한 말로 바꿔 쓰기도 해요']} from={vo('n05')} to={vo('n09') - 0.1} size={68} />
      <T lines={['같은 6개월인데,', '전혀 다른 조건이에요']} from={vo('n09')} to={S.turn - 0.05} size={80} />
      <T meta="사장님" lines={['…폐업하면,', '돌려줘야 한다고?']} from={S.turn + 0.2} to={vo('n06') - 0.1} />
      <T lines={['요약만 믿었다면 몰랐을 조건', '6개월 안에 폐업하면 반환']} from={vo('n06')} to={vo('n10') - 0.1} size={72} />
      <T lines={['6개월 안에 문 닫으면,', '키오스크값을 고스란히', '떠안는 셈이에요']} from={vo('n10')} to={S.end - 0.05} size={76} />
      <T lines={['지원금이 걸린 줄은,', <span style={{ color: BUTTER }}>원문 그대로 한 번 더</span>]} from={vo('n07')} to={S.total} size={84} />

      <Src text="ChatGPT 요약" from={S.a} to={S.wrong} y={640} />
      <Src text="ChatGPT 요약의 이 줄" from={S.wrong} to={S.scan} y={806} />
      <Src text="올린 공문 — 흐릿한 스캔본(예시로 만든 것)" from={S.scan} to={S.l1} y={640} />
      <Src text="ChatGPT 요약 · 다른 대화" from={S.l1} to={S.flashP} y={760} />
      <Src text="ChatGPT 요약 · 또 다른 대화" from={S.flashP} to={S.tally} y={760} />
      <Src text="같은 공문 · 새 대화 여덟 번" from={S.tally} to={S.blur} y={590} />
      <Src text="ChatGPT 요약 · 또 다른 대화" from={S.blur} to={S.key} y={760} />
      <Src text="ChatGPT 요약" from={S.flip} to={S.paper} y={490} />
      <Src text="원문 그대로 옮긴 답" from={S.flip} to={S.paper} y={920} />
      <Src text="원문(예시로 만든 공문)" from={S.ai} to={S.real} y={760} />
      <ScanBig from={S.ai} to={S.real} />
      <ScanBig from={S.f3} to={S.end} />
      <Src text="ChatGPT 요약" from={S.card1} to={S.card} y={800} />
      <Src text="원문(예시로 만든 공문)" from={S.f3} to={S.end} y={760} />

      <Small text="AI로 지어낸 장면이에요" from={S.prompt} to={S.ans} />
      <Small text="AI로 지어낸 장면이에요" from={S.paper} to={S.ai} />
      <Small text="AI로 지어낸 장면이에요" from={S.turn} to={S.card1} />
      <Small text="AI로 지어낸 장면이에요" from={S.worry} to={S.f3} />

      <Audio src={staticFile('bgm.wav')} volume={bgm} />
      {(PLACE as { id: string; at: number }[]).map((c) => (
        <Sequence key={c.id} from={c.at} durationInFrames={TOTAL - c.at}><Audio src={staticFile(`vo/${c.id}.wav`)} /></Sequence>
      ))}
      <Sequence from={sec(S.turn)} durationInFrames={sec(2.6)}>
        <Audio src={staticFile('img/V1.mp4')} trimBefore={sec(V.mutter)} volume={1.6} />
      </Sequence>
      <Sfx t={S.wrong + 0.05} src="sfx/pen.wav" vol={0.6} />
      <Sfx t={S.l1} src="sfx/tick.wav" vol={0.4} />
      <Sfx t={S.l3} src="sfx/tick.wav" vol={0.4} />
      <Sfx t={S.tally2} src="sfx/thud.wav" vol={0.5} />
      {Array.from({ length: 22 }, (_, i) => <Sfx key={i} t={S.typing + 0.1 + i * ((14.2 - S.typing - 0.25) / 22)} src="sfx/tick.wav" vol={0.28} />)}
      <Sfx t={S.send} src="sfx/swish.wav" vol={0.5} />
      <Sfx t={S.ans} src="sfx/thud.wav" vol={0.9} />
      <Sfx t={S.flip + 0.1} src="sfx/pen.wav" vol={0.5} />
      <Sfx t={S.turn} src="sfx/thud.wav" vol={0.8} />
      <Sfx t={S.end} src="sfx/tok.wav" vol={0.5} />
    </AbsoluteFill>
  );
};

export { TOTAL };
