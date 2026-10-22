// 「매진 임박」 가편집(38.5초, 16:9): 공포 정지컷(붉은밤) + 홈쇼핑 끼어들기 넷(코드) + 임시 목소리 · 소리.
// 시각은 01_콘티_대사.md 컷 표 그대로. 하드컷만 쓰고, 홈쇼핑 음악은 「방송은 늘 켜져 있다」처럼 영상 시간과 같은 자리로 흐르다
// 홈쇼핑 컷에서만 들린다(들어가는 프레임에 터지고 나오는 프레임에 끊긴다). 모든 소리 크기에 MASTER 0.8(현장 노트 — Remotion은 0dBFS 넘는 표본을 자른다).
import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { H1, H2, H3, HE, SceneProps } from '../hs/scenes';
import { FPS, sec } from '../hs/parts';

const MASTER = 0.8;
export const FILM_LEN = sec(38.5);

type Cut = { id: string; t0: number; t1: number; hs?: boolean; move?: [number, number]; drift?: number };
export const CUTS: Cut[] = [
  { id: 'C01', t0: 0.0, t1: 2.0, move: [1.0, 1.035] },
  { id: 'C02', t0: 2.0, t1: 4.0, move: [1.02, 1.055] },
  { id: 'C03', t0: 4.0, t1: 5.5, move: [1.0, 1.02] },
  { id: 'C04', t0: 5.5, t1: 8.0, move: [1.0, 1.025] },
  { id: 'H1', t0: 8.0, t1: 10.0, hs: true },
  { id: 'C05', t0: 10.0, t1: 11.5, move: [1.03, 1.04] },
  { id: 'C06', t0: 11.5, t1: 13.0, move: [1.04, 1.06], drift: -14 },
  { id: 'C07', t0: 13.0, t1: 15.5, move: [1.0, 1.03] },
  { id: 'H2', t0: 15.5, t1: 18.5, hs: true },
  { id: 'C08', t0: 18.5, t1: 20.0, move: [1.0, 1.05] },
  { id: 'C09', t0: 20.0, t1: 22.5, move: [1.0, 1.025] },
  { id: 'H3', t0: 22.5, t1: 26.5, hs: true },
  { id: 'C10', t0: 26.5, t1: 28.5, move: [1.06, 1.04], drift: 14 },
  { id: 'C11', t0: 28.5, t1: 31.0, move: [1.0, 1.03] },
  // 끝의 멍 컷 셋(10-22 피해자 셋 — 통2 · 리4 · 지유가 차례로 멍해진다), 0.67초씩. 1.02 고정은 슬라이드처럼 멈춰 보여(Fable P3) 살짝 민다
  { id: 'C12', t0: 31.0, t1: 31.67, move: [1.02, 1.035] },
  { id: 'C12b', t0: 31.67, t1: 32.33, move: [1.02, 1.035] },
  { id: 'C13', t0: 32.33, t1: 33.0, move: [1.02, 1.035] },
  { id: 'C14', t0: 33.0, t1: 34.5, move: [1.0, 1.02] },
  { id: 'HE', t0: 34.5, t1: 38.5, hs: true },
];
const HS_SCENE: Record<string, React.FC<SceneProps>> = { H1, H2, H3, HE };

// 목소리: [파일, 시작 초, 크기]
const VO: [string, number, number][] = [
  ['R1', 2.3, 1.0], ['V1', 5.65, 0.95], ['HS1', 8.05, 1.15], ['R2', 11.8, 1.0], ['V2', 13.04, 0.95], ['HS2', 15.55, 1.15],
  ['SCREAM', 18.9, 1.3], ['R3', 20.9, 1.0], ['HS3a', 22.62, 1.15], ['HS3b', 24.12, 1.15], ['HS3c', 25.0, 1.15],
  ['R4', 28.8, 1.0], ['R5', 33.4, 1.0], ['HS4', 35.3, 1.15],
];
const HS_SPANS = CUTS.filter((c) => c.hs).map((c) => [sec(c.t0), sec(c.t1)] as const);
const inHS = (f: number) => HS_SPANS.some(([a, b]) => f >= a && f < b);
// 홈쇼핑에서 나온 뒤 정적(낮은 울림도 비운다): 10.0~10.6 · 18.5~18.9 · 26.5~27.1
const QUIET = [[sec(10.0), sec(10.6)], [sec(18.5), sec(18.9)], [sec(26.5), sec(27.1)]] as const;
const inQuiet = (f: number) => QUIET.some(([a, b]) => f >= a && f < b);
// 칼 「탁」(28.0초) 둘레는 울림을 낮춰 「탁」이 올라오게(Fable P2 — 울림 피크 −12dB 아래에 묻혔다)
const KNIFE = [sec(27.1), sec(28.5)] as const;
// 쇼호스트가 말하는 동안은 음악을 낮춘다(믹스 받아쓰기에서 「무이자」→「의자」, 「주문」→「중원」으로 묻혔다 — 0.26에선 목소리가 음악보다 4dB쯤 위라 모자라 0.15로)
const TALK = [[8.05, 10.0], [15.55, 18.48], [22.62, 23.98], [24.12, 26.15], [35.3, 36.75]].map(([a, b]) => [sec(a), sec(b)] as const);
const talking = (f: number) => TALK.some(([a, b]) => f >= a && f < b);

const StillCut: React.FC<{ c: Cut }> = ({ c }) => {
  const f = useCurrentFrame();
  const len = sec(c.t1 - c.t0);
  const [s0, s1] = c.move ?? [1, 1.03];
  const p = f / Math.max(1, len - 1);
  const s = s0 + (s1 - s0) * p;
  const dy = (c.drift ?? 0) * (p - 0.5);
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <Img src={staticFile(`stills/${c.id}.jpg`)} style={{ width: 1920, height: 1080, transform: `translateY(${dy}px) scale(${s})`, transformOrigin: '50% 45%' }} />
    </AbsoluteFill>
  );
};

const SfxAt: React.FC<{ t: number; src: string; vol: number; len?: number; from?: number }> = ({ t, src, vol, len, from }) => (
  <Sequence from={sec(t)} durationInFrames={len ? sec(len) : undefined} layout="none">
    <Audio src={staticFile(src)} volume={vol * MASTER} trimBefore={from ? sec(from) : undefined} />
  </Sequence>
);

// p: 홈쇼핑 제품(product.ts) — 없으면 1안. 공포 컷 · 소리는 두 안이 같다
export const Film: React.FC<SceneProps> = ({ p }) => (
  <AbsoluteFill style={{ background: '#000' }}>
    {CUTS.map((c) => {
      const Scene = c.hs ? HS_SCENE[c.id] : null;
      return (
        <Sequence key={c.id} from={sec(c.t0)} durationInFrames={sec(c.t1) - sec(c.t0)}>
          {Scene ? <Scene p={p} /> : <StillCut c={c} />}
        </Sequence>
      );
    })}
    {/* 홈쇼핑 음악: 영상 시간과 같은 자리로 흐르고 홈쇼핑 컷에서만 들린다(경계 1프레임 안에서 켜고 끔). 끝 0.5초는 줄인다.
        곡을 1.5초 당겨 튼다 — 같은 자리면 22.5초(H3 입구)가 곡이 꺼지는 박이라 터지지 않았다(Fable P2, 당기면 네 입구 모두 −13dB 넘음) */}
    <Audio
      src={staticFile('music/hs.mp3')}
      trimBefore={36}
      volume={(f) => (inHS(f) ? (talking(f) ? 0.15 : 0.5) : 0) * interpolate(f, [FILM_LEN - sec(0.5), FILM_LEN], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * MASTER}
    />
    {/* 공포 바탕: 낮은 울림 + 어두운 공간, 홈쇼핑과 그 뒤 정적에는 없다 */}
    <Audio src={staticFile('amb/drone.wav')} loop volume={(f) => (inHS(f) || inQuiet(f) ? 0 : f >= KNIFE[0] && f < KNIFE[1] ? 0.15 : 0.42) * MASTER} />
    {/* 정적에도 방 공기만 아주 작게 남긴다 — 표본 0인 디지털 무음은 폰에서 끊김으로 들릴 수 있다(Fable P3) */}
    <Audio src={staticFile('amb/dark.wav')} loop volume={(f) => (inHS(f) ? 0 : inQuiet(f) ? 0.03 : 0.22) * MASTER} />
    <SfxAt t={0} src="amb/candle.wav" vol={0.12} len={8.0} />
    {/* 삐걱: 파일 앞 1.6초는 거의 무음이라(피크 −13.6 · RMS −39) 33.6초 자리의 삐걱을 쓴다(Fable P2) */}
    <SfxAt t={1.25} src="amb/creak.wav" vol={0.8} len={1.6} from={33.6} />
    <SfxAt t={4.05} src="amb/weep.wav" vol={0.45} len={1.45} />
    <SfxAt t={27.7} src="amb/knife.wav" vol={1.0} len={0.8} />{/* 파일 피크가 0.30초 자리 → 28.0초에 「탁」 */}
    <SfxAt t={28.55} src="amb/phone_n.wav" vol={0.6} len={0.25} />{/* 원본 피크 −32.8dBFS라 준비.mjs가 −6dBFS로 맞춘 사본 */}
    {VO.map(([n, t, v]) => <SfxAt key={n} t={t} src={`vo/${n}.wav`} vol={v} />)}
  </AbsoluteFill>
);

// 9:16 띠판: 가운데 16:9 띠(1080×608, y 656) + 위 검정에 고정 머리글(장르를 처음부터 알린다 — 카드 「가져올 것 3」)
export const Band916: React.FC<SceneProps> = ({ p }) => {
  const f = useCurrentFrame();
  const end = f >= sec(34.5);
  const lines = end ? ['제품 광고 문의', 'PULSE'] : ['강도가 들었는데', '홈쇼핑이 자꾸 끼어든다'];
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <div style={{ position: 'absolute', left: 0, top: 656, width: 1920, height: 1080, transform: 'scale(0.5625)', transformOrigin: '0 0' }}>
        <Film p={p} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 452, textAlign: 'center', fontFamily: "'SUIT', sans-serif", fontWeight: 700, fontSize: 54, lineHeight: 1.32, color: '#FFFFFF', letterSpacing: -0.5 }}>
        {lines.map((l) => <div key={l}>{l}</div>)}
      </div>
      {/* 띠 안 면책(13.5px)은 폰에서 못 읽어(Fable P2) 띠 밑 검정에 따로 */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1292, textAlign: 'center', fontFamily: "'SUIT', sans-serif", fontWeight: 600, fontSize: 30, color: 'rgba(255,255,255,0.62)' }}>가상 브랜드 · AI로 만든 가상 모델·음성</div>
    </AbsoluteFill>
  );
};

export { FPS };
