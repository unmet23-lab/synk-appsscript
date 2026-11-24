// LAB 편 전체를 영상으로 — 본보기(11-25 Claude). 정지 그림 판(Plate) 대신 샷마다 Omni 영상을 깐다.
// 샷 영상은 tools/플로우영상.js 「넣기」가 remotion/public/vid/<샷>.mp4로 둔다(git 밖 — 판본 회차는 tools/판본영상들이기.js가 들인다).
// 글(말풍선 · 낱말 카드 · 끝 카드)과 소리(목소리 · 배경 음악 · 효과음)는 정지 그림 편과 똑같이 그 위에 얹는다.
import React from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, interpolate } from 'remotion';
import { KO } from '../lib/fonts';

export const FPS = 30;

// 샷 — at: 편에서 시작 초 · len: 쓸 길이(초) · from: 영상 안에서 시작 초 · rate: 빠르게(1 = 그대로)
// 받은 영상은 720×1280이다. 1080×1920 화면에 가득 깐다(objectFit cover). 카메라 움직임(밀기 · 당기기)은 넣지 않는다 — 영상 안 움직임으로 충분하다.
export type Shot = { at: number; len: number; vid: string; from?: number; rate?: number };
export const SHOTS: Shot[] = [
  { at: 0, len: 7.9, vid: 's1.mp4' },
  { at: 7.9, len: 4.0, vid: 's2.mp4' },
];
export const TOTAL = SHOTS.reduce((m, s) => Math.max(m, s.at + s.len), 0);
const fr = (s: number) => Math.round(s * FPS);

const ShotLayer: React.FC<{ s: Shot }> = ({ s }) => (
  <Sequence from={fr(s.at)} durationInFrames={fr(s.len)} layout="none">
    <AbsoluteFill>
      <OffthreadVideo
        src={staticFile(`vid/${s.vid}`)}
        muted
        startFrom={fr(s.from ?? 0)}
        playbackRate={s.rate ?? 1}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </AbsoluteFill>
  </Sequence>
);

// 글 한 줄(본보기) — 정지 그림 편의 말풍선 · 카드 코드를 그대로 얹으면 된다
const Card: React.FC<{ text: string; at: number; len: number }> = ({ text, at, len }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [fr(at), fr(at) + 6, fr(at + len) - 6, fr(at + len)], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 80, right: 80, top: 260, textAlign: 'center', opacity: o, fontFamily: KO, fontWeight: 800, fontSize: 92, color: '#2B1B12', background: '#FFF8EC', border: '6px solid #2B1B12', borderRadius: 36, padding: '18px 26px' }}>
      {text}
    </div>
  );
};

export const Film: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#c9a37a' }}>
    {SHOTS.map((s, i) => <ShotLayer key={i} s={s} />)}
    <Card text="뜨거워!" at={2.0} len={2.2} />
  </AbsoluteFill>
);
