// 표지(따로 짠 한 장, S22처럼 전·후 두 판): 작은 줄은 상황, 큰 제목은 약속(「다섯 줄」 버터 한 곳), 아래는 같은 순간의 전·후.
// 글은 SNS 키트 cover916 안전 영역(x 65~920, y 269~1428) 안, 전부 프로필 3:4 격자(y 240~1680) 안.
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { BUTTER, DIM, INK, STAGE } from '../film/parts';
import { KO, MONO } from '../lib/fonts';

const HALF = 420;
const SHOT_H = 470;
/** 원본 1080×1920에서 머리글 쪽(x 40~, y 240~)을 반 판 폭에 맞춘다. */
const Shot: React.FC<{ src: string; label: string; good?: boolean; left: number }> = ({ src, label, good, left }) => {
  const s = 0.62;
  return (
    <div style={{ position: 'absolute', left, top: 800, width: HALF, height: SHOT_H }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 26, overflow: 'hidden', background: STAGE, boxShadow: `0 0 0 2px ${good ? BUTTER : '#3A3934'}` }}>
        <Img src={staticFile(src)} style={{ position: 'absolute', left: -40 * s, top: -240 * s, width: 1080 * s, height: 1920 * s }} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: -64, padding: '6px 16px', borderRadius: 12, background: good ? BUTTER : '#26251F', color: good ? '#141412' : INK, fontFamily: KO, fontWeight: 700, fontSize: 28 }}>{label}</div>
    </div>
  );
};

export const Cover: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE }}>
    <div style={{ position: 'absolute', left: 72, top: 292, fontFamily: KO, fontWeight: 600, fontSize: 44, color: DIM, letterSpacing: '-0.02em' }}>AI한테 "트렌디하게" 시켰더니</div>
    <div style={{ position: 'absolute', left: 68, top: 372, fontFamily: KO, fontWeight: 780, fontSize: 104, lineHeight: 1.12, letterSpacing: '-0.04em', color: INK }}>
      AI 티 빼는
      <br />
      모션 요청 <span style={{ color: BUTTER }}>다섯 줄</span>
    </div>
    <Shot src="still/v7c_18.6.png" label="전 · 더한 판" left={65} />
    <Shot src="still/v8_18.6.png" label="후 · 뺀 판" good left={65 + HALF + 15} />
    <div style={{ position: 'absolute', left: 72, top: 1300, fontFamily: KO, fontWeight: 600, fontSize: 34, color: DIM, letterSpacing: '-0.02em' }}>많이 본 영상들에서 찾은 규칙</div>
    <Img src={staticFile('img/logo-synk-paper.webp')} style={{ position: 'absolute', left: 72, top: 1372, height: 52 }} />
    <div style={{ position: 'absolute', left: 260, top: 1384, fontFamily: MONO, fontSize: 26, color: DIM }}>yuhobuilds</div>
  </AbsoluteFill>
);
