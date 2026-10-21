// 표지(따로 짠 한 장): 작은 줄은 누구에게(AI로 코딩하고 GitHub에 올리는 분), 큰 제목은 사건(「2초 만에」 버터 한 곳), 아래는 실제 실행 기록 다섯 줄과 약속.
// 글은 SNS 키트 cover916 안전 영역(x 65~920, y 269~1428) 안, 전부 프로필 3:4 격자(y 240~1680) 안.
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { BUTTER, DIM, INK, STAGE } from '../film/parts';
import { EN, KO, MONO } from '../lib/fonts';
import * as D from './data';

const X: React.FC = () => (
  <svg width={30} height={30} viewBox="0 0 26 26">
    <circle cx={13} cy={13} r={11.5} fill="none" stroke={INK} strokeWidth={2.2} />
    <path d="M8.5 8.5 L17.5 17.5 M17.5 8.5 L8.5 17.5" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
  </svg>
);

export const Cover: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE }}>
    <div style={{ position: 'absolute', left: 72, top: 292, fontFamily: KO, fontWeight: 600, fontSize: 42, color: DIM, letterSpacing: '-0.02em' }}>GitHub 무료 2,000분, 다 쓰면?</div>
    <div style={{ position: 'absolute', left: 68, top: 372, fontFamily: KO, fontWeight: 780, fontSize: 100, lineHeight: 1.12, letterSpacing: '-0.04em', color: INK }}>
      자동 검사가
      <br />
      <span style={{ color: BUTTER }}>2초 만에</span> 꺼짐
    </div>
    <div style={{ position: 'absolute', left: 72, top: 690, width: 850 }}>
      {D.DEAD_RUNS.slice(0, 5).map(([when, sec], i) => (
        <div key={i} style={{ height: 74, marginBottom: 12, borderRadius: 14, background: '#1C1B19', display: 'flex', alignItems: 'center', gap: 20, padding: '0 22px' }}>
          <X />
          <span style={{ fontFamily: MONO, fontSize: 30, color: INK, width: 130 }}>verify</span>
          <span style={{ fontFamily: KO, fontWeight: 650, fontSize: 30, color: INK, width: 150 }}>단계 0개</span>
          <span style={{ fontFamily: EN, fontWeight: 600, fontSize: 30, color: '#B6B3AB' }}>{sec}s</span>
          <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 26, color: '#8E8B84' }}>{when}</span>
        </div>
      ))}
    </div>
    <div style={{ position: 'absolute', left: 72, top: 1150, fontFamily: KO, fontWeight: 650, fontSize: 40, color: INK, letterSpacing: '-0.02em' }}>공짜로 다시 돌리는 길 둘</div>
    <div style={{ position: 'absolute', left: 72, top: 1214, fontFamily: KO, fontWeight: 560, fontSize: 30, color: DIM }}>남은 시간 보는 곳까지</div>
    <Img src={staticFile('img/logo-synk-paper.webp')} style={{ position: 'absolute', left: 72, top: 1340, height: 52 }} />
    <div style={{ position: 'absolute', left: 260, top: 1352, fontFamily: MONO, fontSize: 26, color: DIM }}>yuhobuilds</div>
  </AbsoluteFill>
);
