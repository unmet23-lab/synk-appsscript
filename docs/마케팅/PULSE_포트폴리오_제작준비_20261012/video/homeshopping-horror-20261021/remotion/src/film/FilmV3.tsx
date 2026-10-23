// 「매진 임박」 콘티 v3 가편집(39.2초 · 16:9 · 30컷, 03_콘티_v3.md): 반응 조사(02_반응조사_20261022.md)를 넣은 판.
// v2(Film.tsx)와 같은 원칙 — 하드컷만, 홈쇼핑 음악은 영상 시간과 같은 자리로 흐르다 홈쇼핑 칸에서만 들린다, 모든 소리에 MASTER 0.8.
// 바뀐 것: 공포 컷마다 앵글 · 크기를 바꾼 v3 정지컷과 크롭 · 급줌, 홈쇼핑 칸은 쇼호스트 + 제품 · 가격판 멀티캠(hs/v3.tsx),
// 공포 대사 자막(가는 명조 — 소리를 꺼도 읽히게), 끝은 쇼호스트가 강도에게 말을 걸고 첫 컷 구도로 돌아와 택배 상자 그림자(고리).
import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { E1V3, E2V3, H1V3, H2V3, H3V3 } from '../hs/v3';
import { P2V3, Product } from '../hs/product';
import { FPS, sec } from '../hs/parts';
import { EN, KO, SERIF } from '../lib/fonts';

const MASTER = 0.8;
export const FILM_V3_LEN = sec(39.2);

// move: 크기 [처음, 끝] · origin: 확대 중심 · shake: 손떨림(px) · rot: 기울기 [처음, 끝](도) · crash: 급줌 [시작 초(컷 안), 끝 크기] · drift: 위아래 흐름(px)
// reveal: [그림자 없는 판, 시작 초, 걸리는 초] — 그 판 위로 이 컷(그림자 있는 판)이 왼쪽부터 쓸려 들어온다(0.3초 훅, Fable P2-5)
type Cut = { id: string; t0: number; t1: number; hs?: React.FC<{ p?: Product }>; still?: string; move?: [number, number]; origin?: string; shake?: number; rot?: [number, number]; crash?: [number, number]; drift?: number; reveal?: [string, number, number]; end?: boolean };
// v3.1(10-22 Fable 설계 검토 뒤): 강도 얼굴을 되살리고(C09v3 · 전환점은 v2 C11), 번호 누름(C11b) → 통화(C11) 순서, 멍 셋 밑 ARS,
// 새 대사 실측에 맞춰 칸을 늘리고(36.0 → 39.2초) 공포 쪽 길이를 되돌렸다(22.6 → 24.3초)
export const CUTS_V3: Cut[] = [
  { id: 'C01a', t0: 0.0, t1: 1.0, move: [1.0, 1.02], reveal: ['C01a_bg', 0.3, 0.25] },
  { id: 'C01b', t0: 1.0, t1: 1.6, still: 'C01a', move: [2.2, 2.4], origin: '56% 23%' },
  { id: 'C02v3', t0: 1.6, t1: 3.4, move: [1.0, 1.08], origin: '50% 38%' },
  { id: 'C03v3', t0: 3.4, t1: 4.9, move: [1.02, 1.04], shake: 3 },
  { id: 'C04', t0: 4.9, t1: 7.5, move: [1.0, 1.0] },
  { id: 'H1', t0: 7.5, t1: 9.8, hs: H1V3 },
  // 얼굴 CU 판(C05v3cu — 눈 접사 C05v3보다 갸웃이 읽히고 닮음을 가릴 수 있다, Fable P3-2)에 후반 기울기
  { id: 'C05v3', t0: 9.8, t1: 11.1, still: 'C05v3cu', move: [1.26, 1.3], rot: [6, 8] },   // 8° 기울이면 1.26배는 키워야 모서리가 안 비친다(Fable 최종 P2-A — 1.12배는 검은 쐐기)
  { id: 'C06', t0: 11.1, t1: 12.4, move: [1.04, 1.06], drift: -14 },
  { id: 'C07v3', t0: 12.4, t1: 15.2, move: [1.02, 1.05], shake: 4 },
  { id: 'H2', t0: 15.2, t1: 18.2, hs: H2V3 },
  { id: 'C08', t0: 18.2, t1: 19.5, move: [1.0, 1.0], crash: [0.3, 1.4], origin: '50% 56%' },
  { id: 'C09v3', t0: 19.5, t1: 21.1, move: [1.0, 1.04] },
  { id: 'C09b', t0: 21.1, t1: 21.9, move: [1.0, 1.05] },
  { id: 'H3', t0: 21.9, t1: 26.5, hs: H3V3 },
  { id: 'C10', t0: 26.5, t1: 28.3, move: [1.06, 1.04], drift: 14 },
  { id: 'C11b', t0: 28.3, t1: 28.9, move: [1.0, 1.06] },
  { id: 'C11', t0: 28.9, t1: 31.2, move: [1.0, 1.03] },
  // 멍 셋은 같은 크기로(C13은 가슴 위라 얼굴 크기를 맞춰 키운다) — 0.6초씩, 밑에 휴대폰에서 새는 ARS
  { id: 'C12', t0: 31.2, t1: 31.8, move: [1.02, 1.035] },
  { id: 'C12b', t0: 31.8, t1: 32.4, move: [1.02, 1.035] },
  { id: 'C13', t0: 32.4, t1: 33.0, move: [1.25, 1.27], origin: '50% 36%' },
  { id: 'C14', t0: 33.0, t1: 34.3, move: [1.0, 1.02] },
  { id: 'E1', t0: 34.3, t1: 35.2, hs: E1V3 },
  { id: 'E2', t0: 35.2, t1: 37.6, hs: E2V3 },
  { id: 'E3', t0: 37.6, t1: 39.2, move: [1.0, 1.01], end: true },
];
const HS_SPANS = CUTS_V3.filter((c) => c.hs).map((c) => [sec(c.t0), sec(c.t1)] as const);
const inHS = (f: number) => HS_SPANS.some(([a, b]) => f >= a && f < b);

// 목소리: [파일, 시작 초, 크기] — 새로 구운 줄은 HS1v3(성준 — 하린이 화면에 있는 동안은 화면 밖 남자 진행자) · HS3cv3 · ARS · E2
const VO: [string, number, number][] = [
  ['R1', 3.5, 1.0], ['V1', 4.95, 0.95], ['HS1v3', 7.55, 1.15], ['R2', 11.3, 1.0], ['V2', 12.45, 0.95], ['HS2', 15.25, 1.15],
  ['SCREAM', 18.5, 1.3], ['R3', 19.85, 1.0], ['HS3a', 21.95, 1.15], ['HS3b', 23.42, 1.15], ['HS3cv3', 24.25, 1.15],
  ['R4', 29.1, 1.0], ['ARS_tel', 31.25, 2.0], ['R5', 33.3, 1.0], ['E2', 35.25, 1.15],
];
// 쇼호스트가 말하는 동안 음악을 낮춘다(v2와 같은 까닭 — 「무이자」 「특별 할인」이 묻혔다)
const TALK = [[7.55, 9.62], [15.25, 18.18], [21.95, 25.85], [35.25, 37.4]].map(([a, b]) => [sec(a), sec(b)] as const);
const talking = (f: number) => TALK.some(([a, b]) => f >= a && f < b);
// 홈쇼핑 앞 0.3초 완전 정적과 나온 뒤 정적(낮은 울림도 비운다)
const QUIET = [[7.24, 7.5], [9.8, 10.4], [14.91, 15.2], [18.2, 18.5], [21.6, 21.9], [26.5, 27.0]].map(([a, b]) => [sec(a), sec(b)] as const);
const inQuiet = (f: number) => QUIET.some(([a, b]) => f >= a && f < b);
const KNIFE = [sec(27.0), sec(28.3)] as const;
// 멍 셋 밑 ARS가 바탕보다 작았다(Fable 최종 P2-B — ARS −32 · 바탕 −26.5 dBFS) — 그동안 바탕을 내리고 ARS를 두 배로
const ARS_BED = [sec(31.2), sec(33.0)] as const;
const inArs = (f: number) => f >= ARS_BED[0] && f < ARS_BED[1];

// 공포 대사 자막(가는 명조, 한 줄씩 3프레임 페이드 — 낱말 팝 · 형광펜은 쓰지 않는다). 쇼호스트 말은 홈쇼핑 자막 띠(hs/v3.tsx)
export const SUBS_V3: [number, number, string][] = [
  [3.5, 4.9, '가진 거… 다 내놔.'],
  [4.95, 7.24, '이, 이거… 한정판이에요…'],
  [11.3, 12.3, '…장난해?'],
  [12.45, 14.91, '이것도요! 구성 추가… 무이자 십 개월…!'],
  [19.85, 21.0, '…이게, 얼만데.'],
  [29.1, 31.2, '…네. 방송 보고 전화했는데요.'],
  [31.25, 33.0, '(전화) 주문 수량을 말씀해 주세요.'],
  [33.3, 34.3, '…두 개요.'],
];

const StillCut: React.FC<{ c: Cut }> = ({ c }) => {
  const f = useCurrentFrame();
  const len = sec(c.t1 - c.t0);
  const p = f / Math.max(1, len - 1);
  const [s0, s1] = c.move ?? [1, 1.03];
  let s = s0 + (s1 - s0) * p;
  if (c.crash) {
    const at = sec(c.crash[0]);
    s *= interpolate(f, [at, at + 5], [1, c.crash[1]], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  }
  const dy = (c.drift ?? 0) * (p - 0.5);
  const jit = c.shake ? { x: Math.sin(f * 1.7) * c.shake + Math.sin(f * 0.43) * c.shake * 0.6, y: Math.cos(f * 1.3) * c.shake * 0.7 } : { x: 0, y: 0 };
  const r = c.rot ? c.rot[0] + (c.rot[1] - c.rot[0]) * p : 0;
  const tf = { width: 1920, height: 1080, transform: `translate(${jit.x}px, ${dy + jit.y}px) rotate(${r}deg) scale(${s})`, transformOrigin: c.origin ?? '50% 45%' };
  // reveal: 그림자 없는 판 위로 그림자 있는 판을 왼쪽부터 쓸어 넣는다(두 판은 그림자 자리 밖에서는 픽셀이 같다 — 정지컷_준비_v3.py)
  const w = c.reveal ? interpolate(f, [sec(c.reveal[1]), sec(c.reveal[1] + c.reveal[2])], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 100;
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      {c.reveal ? <Img src={staticFile(`stills/${c.reveal[0]}.jpg`)} style={{ ...tf, position: 'absolute' }} /> : null}
      <Img src={staticFile(`stills/${c.still ?? c.id}.jpg`)} style={{ ...tf, position: 'absolute', clipPath: w < 100 ? `inset(0 ${100 - w}% 0 0)` : undefined }} />
    </AbsoluteFill>
  );
};

// 끝 고리 컷 위 끝 문구 — 첫 컷과 같은 구도의 빈 거실에 택배 상자 그림자, 그 위로 조용히
const EndLine: React.FC = () => {
  const f = useCurrentFrame();
  const o = (at: number) => interpolate(f, [at, at + 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 150 }}>
      <div style={{ opacity: o(4), fontFamily: KO, fontWeight: 800, fontSize: 64, color: '#FFFFFF', letterSpacing: -1, textShadow: '0 2px 16px rgba(0,0,0,0.8)' }}>강도도 사게 만드는 광고</div>
      <div style={{ opacity: o(10), fontFamily: EN, fontWeight: 800, fontSize: 84, color: '#FFFFFF', letterSpacing: 18, marginTop: 14, marginRight: -18, textShadow: '0 2px 16px rgba(0,0,0,0.8)' }}>PULSE</div>
      <div style={{ opacity: o(0), position: 'absolute', left: 46, bottom: 40, background: 'rgba(255,255,255,0.9)', borderRadius: 40, padding: '8px 24px', fontFamily: KO, fontWeight: 600, fontSize: 30, color: '#34342F' }}>가상 브랜드 · AI로 만든 가상 모델·음성</div>
    </AbsoluteFill>
  );
};

const Sub: React.FC<{ text: string; len: number; size: number }> = ({ text, len, size }) => {
  const f = useCurrentFrame();
  const o = Math.min(interpolate(f, [0, 3], [0, 1], { extrapolateRight: 'clamp' }), interpolate(f, [len - 3, len], [1, 0], { extrapolateLeft: 'clamp' }));
  return <div style={{ opacity: o, fontFamily: SERIF, fontWeight: 400, fontSize: size, color: '#FFFFFF', letterSpacing: 1, textShadow: '0 2px 10px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.9)', whiteSpace: 'nowrap' }}>{text}</div>;
};
// 자막 줄들을 한 자리(bottom px)에 — 16:9는 화면 안 아래, 9:16은 띠 밑 검정(띠 안에 넣으면 폰에서 너무 작다)
export const Subs: React.FC<{ bottom: number; size: number }> = ({ bottom, size }) => (
  <>
    {SUBS_V3.map(([a, b, t]) => (
      <Sequence key={t} from={sec(a)} durationInFrames={sec(b) - sec(a)} layout="none">
        <div style={{ position: 'absolute', left: 0, right: 0, bottom, display: 'flex', justifyContent: 'center' }}>
          <Sub text={t} len={sec(b) - sec(a)} size={size} />
        </div>
      </Sequence>
    ))}
  </>
);

const SfxAt: React.FC<{ t: number; src: string; vol: number; len?: number; from?: number }> = ({ t, src, vol, len, from }) => (
  <Sequence from={sec(t)} durationInFrames={len ? sec(len) : undefined} layout="none">
    <Audio src={staticFile(src)} volume={vol * MASTER} trimBefore={from ? sec(from) : undefined} />
  </Sequence>
);

export const FilmV3: React.FC<{ p?: Product; subs?: boolean }> = ({ p = P2V3, subs = true }) => (
  <AbsoluteFill style={{ background: '#000' }}>
    {CUTS_V3.map((c) => {
      const Scene = c.hs;
      return (
        <Sequence key={c.id} from={sec(c.t0)} durationInFrames={sec(c.t1) - sec(c.t0)}>
          {Scene ? <Scene p={p} /> : <StillCut c={c} />}
          {c.end ? <EndLine /> : null}
        </Sequence>
      );
    })}
    {subs ? <Subs bottom={64} size={50} /> : null}
    {/* 홈쇼핑 음악: 영상 시간과 같은 자리로 흐르고 홈쇼핑 칸에서만 들린다. 끝 고리 컷(E3)에서는 꺼진다 */}
    <Audio src={staticFile('music/hs.mp3')} trimBefore={36} volume={(f) => (inHS(f) ? (talking(f) ? 0.15 : 0.5) : 0) * MASTER} />
    {/* 울림 파일 첫 0.25초가 페이드인이라(Fable P3) 0.5초 건너뛰고 튼다 — 0초부터 소리 */}
    <Audio src={staticFile('amb/drone.wav')} loop trimBefore={12} volume={(f) => (inHS(f) || inQuiet(f) ? 0 : (f >= KNIFE[0] && f < KNIFE[1]) || inArs(f) ? 0.15 : f >= sec(37.6) ? 0.2 : 0.42) * MASTER} />
    <Audio src={staticFile('amb/dark.wav')} loop volume={(f) => (inHS(f) ? 0 : inQuiet(f) ? 0.03 : inArs(f) ? 0.08 : 0.22) * MASTER} />
    <SfxAt t={0} src="amb/candle.wav" vol={0.12} len={7.2} />
    <SfxAt t={0.3} src="sfx/heartbeat.wav" vol={0.9} />
    <SfxAt t={0.7} src="amb/creak.wav" vol={0.7} len={1.2} from={33.6} />
    <SfxAt t={1.0} src="amb/blade48.wav" vol={0.5} len={0.6} />
    <SfxAt t={3.45} src="amb/weep.wav" vol={0.4} len={1.45} />
    <SfxAt t={15.25} src="amb/cheer2.wav" vol={0.22} len={1.0} />
    <SfxAt t={25.9} src="amb/cheer2.wav" vol={0.35} len={0.6} from={2} />{/* H3d 굳은 미소 — 말 없이 환호만 */}
    <SfxAt t={27.6} src="amb/knife.wav" vol={1.0} len={0.8} />{/* 파일 피크가 0.30초 자리 → 27.9초에 「탁」 */}
    <SfxAt t={28.35} src="amb/phone_n.wav" vol={0.5} len={0.25} />{/* 번호 누름 */}
    <SfxAt t={28.4} src="sfx/ringback.wav" vol={0.45} />{/* 연결음 꼬리가 「네」와 겹쳐(Fable P3) 앞당기고 R4는 29.1초로 */}
    <SfxAt t={34.4} src="amb/cheer2.wav" vol={0.25} len={0.8} from={4} />
    <SfxAt t={37.65} src="sfx/doorbell.wav" vol={0.6} />
    {VO.map(([n, t, v]) => <SfxAt key={n} t={t} src={`vo/${n}.wav`} vol={v} />)}
  </AbsoluteFill>
);

// 9:16 띠판: 가운데 16:9 띠 + 위 머리글(0초부터, 끝 고리 컷에서 「제품 광고 문의 / PULSE」) + 띠 밑 자막 · 면책
export const HEADS: Record<string, [string, string]> = {
  기본: ['광고 회사가', '공포 영화를 찍으면'], // 자기 풍자형 — 원본 네 번 올리기에서 터진 판의 꼴(02_반응조사 §1)
  전제: ['강도가 들었는데', '홈쇼핑이 자꾸 끼어든다'], // v2
  오도: ['진지한 공포 단편입니다', '(진짜로)'],
  이름표: ['K-홈쇼핑', '호러'],
};
export const Band916V3: React.FC<{ p?: Product; head?: string }> = ({ p = P2V3, head = '기본' }) => {
  const f = useCurrentFrame();
  const end = f >= sec(37.6);
  const lines = end ? ['제품 광고 문의', 'PULSE'] : HEADS[head] ?? HEADS.기본;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <div style={{ position: 'absolute', left: 0, top: 656, width: 1920, height: 1080, transform: 'scale(0.5625)', transformOrigin: '0 0' }}>
        <FilmV3 p={p} subs={false} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 452, textAlign: 'center', fontFamily: "'SUIT', sans-serif", fontWeight: 700, fontSize: 54, lineHeight: 1.32, color: '#FFFFFF', letterSpacing: -0.5 }}>
        {lines.map((l) => <div key={l}>{l}</div>)}
      </div>
      <Subs bottom={1920 - 1340} size={44} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1430, textAlign: 'center', fontFamily: "'SUIT', sans-serif", fontWeight: 600, fontSize: 30, color: 'rgba(255,255,255,0.62)' }}>가상 브랜드 · AI로 만든 가상 모델·음성</div>
    </AbsoluteFill>
  );
};

export { FPS };
