// 표지(따로 짠 한 장, 10-23 보완판): 작은 줄은 어디서(Windows 작업 관리자), 큰 제목은 영상의 한 문장(「계속 저장하는」 버터 한 곳),
// 아래는 증거 한 마디 — 제가 만든 프로그램이 한 시간에 저장한 양 막대 둘(실측, 고치기 전 바쁠 때 4분 · 고친 뒤 30분).
// 글은 SNS 키트 cover916 안전 영역(x 65~920, y 269~1428) 안, 전부 프로필 3:4 격자(y 240~1680) 안.
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { BUTTER, DIM, INK, STAGE } from '../film/parts';
import { EN, KO, MONO } from '../lib/fonts';
import * as D from './data';

const Bar: React.FC<{ top: number; label: string; value: string; mb: number; strong?: boolean }> = ({ top, label, value, mb, strong }) => {
  const w = 560;
  const len = Math.max(12, w * (mb / D.BEFORE.mbPerHour));
  return (
    <div style={{ position: 'absolute', left: 72, top, width: 850 }}>
      <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 34, color: INK }}>{label}</div>
      <div style={{ position: 'relative', height: 68, marginTop: 14 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: len, height: 68, borderRadius: 10, background: strong ? BUTTER : '#3A3934' }} />
        <div style={{ position: 'absolute', left: len + 22, top: 0, lineHeight: '68px', fontFamily: EN, fontWeight: 700, fontSize: 44, color: strong ? BUTTER : INK }}>{value}</div>
      </div>
    </div>
  );
};

export const Cover: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE }}>
    <div style={{ position: 'absolute', left: 72, top: 292, fontFamily: KO, fontWeight: 600, fontSize: 40, color: DIM, letterSpacing: '-0.02em' }}>Windows 작업 관리자 · 다섯 단계</div>
    <div style={{ position: 'absolute', left: 68, top: 366, fontFamily: KO, fontWeight: 780, fontSize: 88, lineHeight: 1.16, letterSpacing: '-0.04em', color: INK }}>
      PC가 괜히 느리면,
      <br />
      뒤에서 <span style={{ color: BUTTER }}>계속 저장하는</span>
      <br />
      프로그램 찾기
    </div>
    <div style={{ position: 'absolute', left: 72, top: 760, fontFamily: KO, fontWeight: 600, fontSize: 32, color: DIM }}>제가 만든 프로그램 · 한 시간에 저장한 양</div>
    <Bar top={830} label="고치기 전" value="4.3GB" mb={D.BEFORE.mbPerHour} />
    <Bar top={1000} label="고친 뒤" value="94MB" mb={D.V31.mbPerHour} strong />
    <div style={{ position: 'absolute', left: 72, top: 1178, fontFamily: KO, fontWeight: 560, fontSize: 28, color: DIM }}>제 PC · 고치기 전은 바쁠 때 4분, 고친 뒤는 30분 잰 값</div>
    <Img src={staticFile('img/logo-synk-paper.webp')} style={{ position: 'absolute', left: 72, top: 1340, height: 52 }} />
    <div style={{ position: 'absolute', left: 260, top: 1352, fontFamily: MONO, fontSize: 26, color: DIM }}>yuhobuilds</div>
  </AbsoluteFill>
);
