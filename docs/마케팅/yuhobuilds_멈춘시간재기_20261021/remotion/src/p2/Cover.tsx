// 표지(따로 짠 한 장): 작은 줄은 질문, 큰 제목은 결과 숫자(「24초」 버터 한 곳), 아래는 같은 도구로 잰 전·후 띠(실제 값).
// 글은 SNS 키트 cover916 안전 영역(x 65~920, y 269~1428) 안, 전부 프로필 3:4 격자(y 240~1680) 안.
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { BUTTER, DIM, INK, STAGE } from '../film/parts';
import { EN, KO, MONO } from '../lib/fonts';
import { BINS } from './bins.generated';

const STILL = 0.15;
const Bar: React.FC<{ values: readonly number[]; top: number; label: string; still: number }> = ({ values, top, label, still }) => {
  const w = 855;
  const n = values.length;
  const gap = 2;
  const cw = (w - gap * (n - 1)) / n;
  return (
    <div style={{ position: 'absolute', left: 65, top, width: w }}>
      <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 36, color: INK }}>
        {label} <span style={{ fontFamily: EN, color: DIM, fontWeight: 600 }}>· 멈춤 {Math.round((still / 42) * 100)}%</span>
      </div>
      <div style={{ position: 'relative', height: 76, marginTop: 18 }}>
        {values.map((v, i) => (
          <div key={i} style={{ position: 'absolute', left: i * (cw + gap), top: 0, width: cw, height: 76, borderRadius: 2, background: v < STILL ? BUTTER : '#3A3934' }} />
        ))}
      </div>
    </div>
  );
};

export const Cover: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE }}>
    <div style={{ position: 'absolute', left: 72, top: 292, fontFamily: KO, fontWeight: 600, fontSize: 44, color: DIM, letterSpacing: '-0.02em' }}>내 쇼츠, 멈춘 시간 재 보셨어요?</div>
    <div style={{ position: 'absolute', left: 68, top: 372, fontFamily: KO, fontWeight: 780, fontSize: 104, lineHeight: 1.12, letterSpacing: '-0.04em', color: INK }}>
      42초 중
      <br />
      <span style={{ color: BUTTER }}>24초</span>가 멈춤
    </div>
    <Bar values={BINS.before.values} top={720} label="고치기 전" still={BINS.before.still} />
    <Bar values={BINS.after.values} top={930} label="고친 뒤" still={BINS.after.still} />
    <div style={{ position: 'absolute', left: 72, top: 1150, fontFamily: KO, fontWeight: 650, fontSize: 40, color: INK, letterSpacing: '-0.02em' }}>재는 법 · 기준 둘 · 고치는 셋</div>
    <div style={{ position: 'absolute', left: 72, top: 1214, fontFamily: KO, fontWeight: 560, fontSize: 30, color: DIM }}>노랑 = 화면이 거의 안 바뀐 0.5초</div>
    <Img src={staticFile('img/logo-synk-paper.webp')} style={{ position: 'absolute', left: 72, top: 1340, height: 52 }} />
    <div style={{ position: 'absolute', left: 260, top: 1352, fontFamily: MONO, fontSize: 26, color: DIM }}>yuhobuilds</div>
  </AbsoluteFill>
);
