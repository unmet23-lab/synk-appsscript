// synkbrief B21 「목소리 전화」 본편(42.5초) — 제작 절차 「한 장면 먼저」 넷째 편.
// 뼈대는 원본 4kQaWtaB_Qk(애마극장 48.4초 · 평소의 88배): 0~3.3초 폰 · 눈 · 폰 → 3.3초 있을 수 없는 까닭을 큰 그림으로 →
// 8.2초 전화를 받고 22초 동안 전화 속 목소리와 듣는 얼굴을 번갈아 → 30.2초 둘째 국면 → 46.5초 얼굴 한 컷으로 끝(끝 카드 없음).
// 우리는 같은 자리에: 전화 속 딸 울음 → 2.89초 넓은 그림으로 옆에 멀쩡히 앉은 딸 → 사기범 → 「엄마, 왜 그래?」 → 돌아봄(심사를 넘은 장면) →
// 「이거… 내 목소리잖아」 · 「그럼… 이건 누구야?」 → 둘째 국면 「AI가 만든 목소리」 → 금감원 실제 화면 → 가족 암호 → 같은 구도로 다시 온 전화 →
// 끝 3초 「귤.」과 웃음(핵심 장면과 같은 구도).
// 컷 · 박자는 원본 초 × 0.877(우리 42.5초 ÷ 원본 48.44초, 첫 2초만 실제 초). 무대는 밝은 거실 소파, 소리는 음악 없는 긴장 저음 — B19 · B20과 다르다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import PLACE from './vo-place.json';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * 30);

export const S = {
  phone: 0, eye: 0.3, daughter: 1.4, eye2: 1.93, wide: 2.89, wide2: 3.68, hand: 5.7, face: 7.19,
  why: 10.61, turn: 11.66, both: 13.77, mom1: 14.82,
  b: 15.87, b1: 16.66, b2: 17.82, b3: 19.64, b4: 20.72, b5: 22.87, b6: 24.9,
  ai: 26.49, fss: 28.1, fss2: 30.34,
  plan: 32.5, plan2: 33.41, plan3: 34.73,
  end: 35.9, end2: 37.45, end3: 38.6, gyul: 39.4, gyul2: 40.78, total: 42.5,
};
export const TOTAL = sec(S.total);

const vo = (id: string) => (PLACE as { id: string; at: number }[]).find((c) => c.id === id)!.at;

// 한 컷: 1080×1920 영상의 (cx, cy)를 화면 (540, ay)에 두고 s배 — 넘치는 쪽은 가장자리에 맞춘다
type Crop = { s: number; cx: number; cy: number; ay?: number };
export const Shot: React.FC<{ src: string; start: number; crop: Crop; rate?: number; drift?: number }> = ({ src, start, crop, rate = 1, drift = 0.02 }) => {
  const f = useCurrentFrame();
  const s = crop.s * (1 + (f / 30) * drift);
  const ay = crop.ay ?? 880;
  const x = Math.min(0, Math.max(1080 - 1080 * s, 540 - crop.cx * s));
  const y = Math.min(0, Math.max(1920 - 1920 * s, ay - crop.cy * s));
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <OffthreadVideo muted src={staticFile(src)} startFrom={sec(start)} playbackRate={rate}
        style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: `translate(${x}px, ${y}px) scale(${s})` }} />
    </AbsoluteFill>
  );
};

// 위 고정 제목(원본엔 없고 같은 꼴 rMrZAlVDc6Q에서 가져온 우리 판단 — 첫 2초에 있을 수 없는 일을 약속한다)
const Title: React.FC<{ a: string; b: string; from?: number; to: number }> = ({ a, b, from = 0, to }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 280, display: 'flex', justifyContent: 'center' }}>
      <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 70, lineHeight: 1.26, letterSpacing: -1.5, textAlign: 'center', wordBreak: 'keep-all', color: '#fff',
        background: 'rgba(10,10,10,0.8)', padding: '16px 34px', borderRadius: 18 }}>
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.2, color: '#e8e8e8', marginBottom: 6 }}>재연 장면이에요</div>
        {a ? <>{a}<br /></> : null}<span style={{ color: '#ffc928' }}>{b}</span>
      </div>
    </div>
  );
};

// 아래 자막(말과 같은 글) — 전화 속 말은 노랑
const Cap: React.FC<{ text: string; from: number; to: number; y?: number; color?: string; size?: number }> = ({ text, from, to, y = 1265, color = '#fff', size = 54 }) => {
  const f = useCurrentFrame();
  const a = sec(from), b = sec(to);
  if (f < a || f >= b) return null;
  const o = Math.min(interpolate(f, [a, a + 3], [0, 1], clamp), interpolate(f, [b - 3, b], [1, 0], clamp));
  return (
    <div style={{ position: 'absolute', left: 65, right: 160, top: y, display: 'flex', justifyContent: 'center', opacity: o }}>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: size, lineHeight: 1.28, letterSpacing: -1, color, textAlign: 'center', wordBreak: 'keep-all',
        background: 'rgba(10,10,10,0.97)', padding: '12px 24px', borderRadius: 16, maxWidth: 855 }}>
        {text}
      </div>
    </div>
  );
};

const Small: React.FC<{ text: string; from: number; to: number; y?: number; right?: boolean }> = ({ text, from, to, y = 150, right }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  return (
    <div style={{ position: 'absolute', top: y, ...(right ? { right: 170 } : { left: 0, right: 0, display: 'flex', justifyContent: 'center' }) }}>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 38, color: '#fff', background: 'rgba(10,10,10,0.72)', padding: '5px 18px', borderRadius: 10 }}>{text}</div>
    </div>
  );
};

export const Hl: React.FC<{ on: number; children: React.ReactNode }> = ({ on, children }) => {
  const f = useCurrentFrame();
  const w = interpolate(f, [sec(on), sec(on) + 8], [0, 1], { ...clamp, easing: EASE_OUT });
  return <span style={{ fontWeight: 900, backgroundImage: 'linear-gradient(#ffd84a, #ffd84a)', backgroundRepeat: 'no-repeat', backgroundPosition: '0 88%', backgroundSize: `${w * 100}% 38%` }}>{children}</span>;
};

// 금감원 실제 화면 한 컷 → 같은 글을 크게(글은 실제 그대로). 뒤는 방금 그 두 사람(검은 글 화면으로 두지 않는다)
const Fss: React.FC = () => {
  const f = useCurrentFrame();
  const two = sec(S.fss2 - S.fss);
  const q = interpolate(f, [0, 6], [0, 1], { ...clamp, easing: EASE_OUT });
  const card: React.CSSProperties = { position: 'absolute', left: 56, right: 56, fontFamily: KO, color: '#1b1b1b', background: '#fff', borderRadius: 24, padding: '34px 36px', wordBreak: 'keep-all' };
  return (
    <AbsoluteFill style={{ background: '#101317' }}>
      <Img src={staticFile('img/근접끝.jpg')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, filter: 'blur(22px) brightness(0.45)', scale: `${1.08 + (f / 30) * 0.01}` }} />
      {f < two ? (
        <div style={{ ...card, top: 480, opacity: q, fontWeight: 800, fontSize: 74, lineHeight: 1.3, translate: `0 ${(1 - q) * 30}px` }}>
          <Img src={staticFile('img/금감원_로고.png')} style={{ width: 300, height: 96, display: 'block', marginBottom: 8 }} />
          <div style={{ fontSize: 42, fontWeight: 800, color: '#2856aa', marginBottom: 16 }}>소비자경보 · 2026년 2월</div>
          울면서 “엄마” 부르는 아이 목소리… 알고보니 <Hl on={0.5}>AI 보이스피싱</Hl>
        </div>
      ) : (
        <div style={{ ...card, top: 480, fontWeight: 800, fontSize: 76, lineHeight: 1.3, scale: `${1 + ((f - two) / 30) * 0.012}` }}>
          <Img src={staticFile('img/금감원_로고.png')} style={{ width: 300, height: 96, display: 'block', marginBottom: 8 }} />
          <div style={{ fontSize: 42, fontWeight: 800, color: '#2856aa', marginBottom: 16 }}>같은 경보 자료에서</div>
          <Hl on={S.fss2 - S.fss + 0.4}>부모라 하더라도</Hl> … 판단하기가 어려움
        </div>
      )}
    </AbsoluteFill>
  );
};

const Sfx: React.FC<{ t: number; src: string; vol: number }> = ({ t, src, vol }) => (
  <Sequence from={sec(t)} durationInFrames={75}><Audio src={staticFile(src)} volume={vol} /></Sequence>
);
const Say: React.FC<{ t: number; src: string; vol?: number }> = ({ t, src, vol = 1.15 }) => (
  <Sequence from={sec(t)}><Audio src={staticFile(`vo/${src}.wav`)} volume={vol} /></Sequence>
);

const MOM = { cx: 333, cy: 440 }, DAU = { cx: 838, cy: 574 };
const BM = { cx: 300, cy: 430 }, BD = { cx: 760, cy: 540 }, BP = { cx: 540, cy: 930 };
const WIDE = { s: 1.0, cx: 540, cy: 960 };

export const Film: React.FC = () => {
  const f = useCurrentFrame();
  const drone = interpolate(f, [0, sec(1.5), sec(S.plan - 0.6), sec(S.plan)], [0.1, 0.2, 0.26, 0], clamp);
  const seq = (from: number, to: number, el: React.ReactNode) => <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)}>{el}</Sequence>;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {seq(S.phone, S.eye, <Shot src="img/A.mp4" start={0} crop={{ s: 2.8, cx: 218, cy: 551 }} />)}
      {seq(S.eye, S.daughter, <Shot src="img/A.mp4" start={0.3} crop={{ s: 2.5, ...MOM }} />)}
      {seq(S.daughter, S.eye2, <Shot src="img/A.mp4" start={0.8} crop={{ s: 2.1, cx: 880, cy: 720 }} />)}
      {seq(S.eye2, S.wide, <Shot src="img/A.mp4" start={1.4} crop={{ s: 3.0, cx: 333, cy: 430 }} />)}
      {seq(S.wide, S.wide2, <Shot src="img/A.mp4" start={0.1} crop={WIDE} drift={0.012} />)}
      {seq(S.wide2, S.hand, <Shot src="img/A.mp4" start={0.9} rate={0.8} crop={{ s: 1.28, cx: 590, cy: 620 }} drift={0.012} />)}
      {seq(S.hand, S.face, <Shot src="img/A.mp4" start={2.0} crop={{ s: 3.1, cx: 218, cy: 551 }} />)}
      {seq(S.face, S.why, <Shot src="img/A.mp4" start={3.0} rate={0.61} crop={{ s: 2.2, ...MOM }} />)}
      {/* 심사를 넘은 장면 — A 5.1초부터 잇달아, 크기만 바꾼다 */}
      {seq(S.why, S.turn, <Shot src="img/A.mp4" start={5.1} crop={{ s: 2.0, ...DAU }} />)}
      {seq(S.turn, S.both, <Shot src="img/A.mp4" start={6.15} crop={{ s: 1.25, cx: 560, cy: 640 }} drift={0.01} />)}
      {seq(S.both, S.mom1, <Shot src="img/A.mp4" start={8.26} crop={{ s: 1.7, cx: 560, cy: 560 }} drift={0.01} />)}
      {seq(S.mom1, S.b, <Shot src="img/A.mp4" start={9.31} rate={0.65} crop={{ s: 2.2, ...DAU }} drift={0} />)}
      {/* 근접 — 심사관 제안: 딸이 자기 목소리를 듣는다 */}
      {seq(S.b, S.b1, <Shot src="img/B.mp4" start={0} crop={WIDE} drift={0.012} />)}
      {seq(S.b1, S.b2, <Shot src="img/B.mp4" start={S.b1 - S.b} crop={{ s: 2.1, ...BP }} />)}
      {seq(S.b2, S.b3, <Shot src="img/B.mp4" start={S.b2 - S.b} crop={{ s: 1.9, ...BD }} />)}
      {seq(S.b3, S.b4, <Shot src="img/B.mp4" start={S.b3 - S.b} crop={{ s: 1.2, cx: 540, cy: 760 }} />)}
      {seq(S.b4, S.b5, <Shot src="img/B.mp4" start={S.b4 - S.b} crop={{ s: 1.9, ...BM }} />)}
      {/* 볼 이유 심사 제안: 딸이 전화기에 대고 말해도 전화 속 딸은 계속 운다 */}
      {seq(S.b5, S.b6, <Shot src="img/Y.mp4" start={0.1} crop={{ s: 1.15, cx: 540, cy: 760 }} drift={0.012} />)}
      {seq(S.b6, S.ai, <Shot src="img/B.mp4" start={8.4} rate={0.8} crop={{ s: 2.3, ...BP }} />)}
      {/* 둘째 국면 — 소파 위 전화만 */}
      {seq(S.ai, S.fss, <Shot src="img/D.mp4" start={0.2} crop={WIDE} drift={0.03} />)}
      {seq(S.fss, S.plan, <Fss />)}
      {seq(S.plan, S.plan2, <Shot src="img/P.mp4" start={0} crop={{ s: 1.15, cx: 540, cy: 620 }} />)}
      {seq(S.plan2, S.plan3, <Shot src="img/P.mp4" start={S.plan2 - S.plan} crop={{ s: 1.7, cx: 520, cy: 620 }} />)}
      {seq(S.plan3, S.end, <Shot src="img/P.mp4" start={S.plan3 - S.plan} crop={{ s: 1.15, cx: 540, cy: 620 }} />)}
      {/* 같은 구도로 다시 온 전화 */}
      {seq(S.end, S.end2, <Shot src="img/C.mp4" start={0} crop={WIDE} drift={0.01} />)}
      {seq(S.end2, S.end3, <Shot src="img/C.mp4" start={S.end2 - S.end} crop={{ s: 2.0, cx: 340, cy: 500 }} />)}
      {seq(S.end3, S.gyul, <Shot src="img/C.mp4" start={S.end3 - S.end} crop={{ s: 1.9, cx: 860, cy: 700 }} />)}
      {seq(S.gyul, S.gyul2, <Shot src="img/G.mp4" start={0.9} crop={{ s: 1.05, cx: 560, cy: 760 }} drift={0.01} />)}
      {seq(S.gyul2, S.total, <Shot src="img/G.mp4" start={0.9 + S.gyul2 - S.gyul} crop={{ s: 1.5, cx: 560, cy: 640 }} drift={0.01} />)}

      <Title a="" b="전화 속에서 딸이 운다" to={S.wide} />
      <Title a="딸이 옆에 있는데" b="전화 속에서 딸이 운다" from={S.wide} to={S.ai} />
      <Title a="" b="우리 집 암호, 뭐로 할까?" from={S.plan} to={S.end} />
      <Title a="" b="암호를 정해 뒀다면?" from={S.end} to={S.gyul} />
      <Cap text="엄마… 엄마, 나 좀 살려줘…" from={0.1} to={S.wide} color="#ffc928" />
      <Cap text="민지 어머니시죠? 따님, 저랑 같이 있어요." from={vo('m01') / 30} to={vo('m02') / 30} color="#ffc928" />
      <Cap text="오십만 원만 보내세요. 전화는 끊지 마시고요." from={vo('m02') / 30} to={S.why} color="#ffc928" />
      <Cap text="엄마, 왜 그래?" from={S.why + 0.05} to={S.why + 1.75} />
      <Cap text="엄마…" from={13.96} to={15.3} color="#ffc928" />
      <Cap text="엄마… 나 무서워…" from={S.b} to={S.b2} color="#ffc928" />
      <Cap text="이거… 내 목소리잖아." from={S.b2 + 0.05} to={20.1} />
      <Cap text="그럼… 이건 누구야?" from={20.85} to={23.2} />
      <Cap text="나 여기 있어…" from={23.1} to={24.75} />
      <Cap text="엄마… 엄마, 나 좀 살려줘…" from={24.9} to={S.ai} color="#ffc928" />
      <Cap text="AI가 만든 목소리예요." from={vo('v01') / 30} to={S.fss} size={66} />
      <Cap text="금융감독원이 경보까지 낸 수법이에요." from={vo('v02') / 30} to={S.fss2} y={1265} />
      <Cap text="우는 소리는, 부모도 바로 못 가린대요." from={vo('v03') / 30} to={S.plan} y={1265} />
      <Cap text="미국 FBI도 권해요. 가족끼리 암호 한 단어만 정해 두세요." from={vo('v04') / 30} to={S.end} />
      <Cap text="엄마…" from={S.end + 0.05} to={36.85} color="#ffc928" />
      <Cap text="우리 집 암호가 뭐지?" from={36.9} to={38.45} />
      <Cap text="…전화가 끊겼어요." from={38.75} to={39.4} />
      <Cap text="귤." from={39.6} to={40.2} size={80} />
      <Title a="" b="우리 집 암호는, 귤" from={39.65} to={S.total} />
      <Cap text="목소리는 베껴도, 우리 집 암호는 몰라요." from={vo('v05') / 30} to={S.total} color="#ffc928" />
      <Small text="SYNK 브리핑" from={S.plan} to={S.total} y={1195} right />

      {[['p_m01', 'm01'], ['p_m02', 'm02']].map(([w, id]) => (
        <Sequence key={id} from={vo(id)}><Audio src={staticFile(`vo/${w}.wav`)} volume={1.2} /></Sequence>
      ))}
      {['v01', 'v02', 'v03', 'v04', 'v05'].map((id) => (
        <Sequence key={id} from={vo(id)}><Audio src={staticFile(`vo/${id}.wav`)} /></Sequence>
      ))}
      <Say t={0.05} src="s_cry" />
      <Say t={S.why} src="s_why" vol={1.1} />
      <Say t={13.96} src="s_mom1" />
      <Say t={S.b} src="s_scared" />
      <Say t={S.b2} src="s_mine" />
      <Say t={20.72} src="s_who" />
      <Say t={22.87} src="s_here" />
      <Sequence from={sec(24.85)} durationInFrames={sec(S.ai) - sec(24.85)}><Audio src={staticFile('vo/s_cry.wav')} volume={1.15} /></Sequence>
      <Say t={S.end + 0.02} src="s_mom2" vol={0.9} />
      <Say t={S.end + 0.0} src="s_code" vol={1.1} />
      <Sequence from={sec(S.gyul)}>
        <Audio src={staticFile('vo/s_gyul.wav')} trimBefore={27} volume={1.1} />
      </Sequence>
      <Sfx t={S.wide} src="sfx/thud.wav" vol={0.22} />
      <Sfx t={S.ai} src="sfx/thud.wav" vol={0.3} />
      <Sfx t={S.fss - 0.05} src="sfx/tok.wav" vol={0.3} />
      <Sfx t={38.7} src="sfx/끊김.wav" vol={0.6} />
      <Audio src={staticFile('bgm.wav')} volume={drone} />
    </AbsoluteFill>
  );
};
