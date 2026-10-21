// 표지(따로 짠 한 장): 작은 줄은 누구에게(도구 받은 분 · Claude 계정 여러 개), 큰 제목은 결과 숫자(「94MB」 버터 한 곳), 아래는 시간당 쓴 양 막대 둘(실측).
// 글은 SNS 키트 cover916 안전 영역(x 65~920, y 269~1428) 안, 전부 프로필 3:4 격자(y 240~1680) 안.
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { BUTTER, DIM, INK, STAGE } from '../film/parts';
import { EN, KO, MONO } from '../lib/fonts';
import * as D from './data';

const Bar: React.FC<{ top: number; label: string; mb: number; strong?: boolean }> = ({ top, label, mb, strong }) => {
  const w = 600;
  return (
    <div style={{ position: 'absolute', left: 72, top, width: 850 }}>
      <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 36, color: INK }}>{label}</div>
      <div style={{ position: 'relative', height: 72, marginTop: 16 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: Math.max(10, w * (mb / D.BEFORE.mbPerHour)), height: 72, borderRadius: 10, background: strong ? BUTTER : '#3A3934' }} />
        <div style={{ position: 'absolute', left: Math.max(10, w * (mb / D.BEFORE.mbPerHour)) + 20, top: 0, lineHeight: '72px', fontFamily: EN, fontWeight: 700, fontSize: 44, color: strong ? BUTTER : INK }}>
          {mb.toLocaleString('en-US')}MB
        </div>
      </div>
    </div>
  );
};

export const Cover: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE }}>
    <div style={{ position: 'absolute', left: 72, top: 292, fontFamily: KO, fontWeight: 600, fontSize: 42, color: DIM, letterSpacing: '-0.02em' }}>Claude 세션 공유 도구, 받으셨나요?</div>
    <div style={{ position: 'absolute', left: 68, top: 372, fontFamily: KO, fontWeight: 780, fontSize: 100, lineHeight: 1.12, letterSpacing: '-0.04em', color: INK }}>
      한 시간 4.3GB가
      <br />
      <span style={{ color: BUTTER }}>94MB</span>로
    </div>
    <Bar top={700} label="고치기 전 · 시간당 쓴 양" mb={D.BEFORE.mbPerHour} />
    <Bar top={890} label="지금 판" mb={D.V31.mbPerHour} strong />
    <div style={{ position: 'absolute', left: 72, top: 1110, fontFamily: KO, fontWeight: 650, fontSize: 40, color: INK, letterSpacing: '-0.02em' }}>어디서 샜나 · 고친 셋 · 내 PC에서 찾기</div>
    <div style={{ position: 'absolute', left: 72, top: 1174, fontFamily: KO, fontWeight: 560, fontSize: 30, color: DIM }}>제 PC · 폴더 29곳에서 잰 값</div>
    <Img src={staticFile('img/logo-synk-paper.webp')} style={{ position: 'absolute', left: 72, top: 1340, height: 52 }} />
    <div style={{ position: 'absolute', left: 260, top: 1352, fontFamily: MONO, fontSize: 26, color: DIM }}>yuhobuilds</div>
  </AbsoluteFill>
);
