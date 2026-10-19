// 표지(10-18 유호님 「전후 비교 표지도 만들어줘」): 같은 계정 바꾸기의 전·후 — 목록이 텅 빈 판 / 그대로인 판.
// SNS 키트 builds: 검정 면 · 흰 글자 · 버터 한 곳(제목의 「그대로」). 제목은 구체적인 약속, 도구 이름·상황은 작은 줄.
// 글자는 cover916 안전 영역(x 65~920, y 269~1428) 안, 전부 프로필 3:4 격자(y 240~1680) 안.
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { KO, MONO } from '../lib/fonts';
import { AVATARS, BUTTER, DIM, INK, NEW_ROW, PAPER, SIDE_ROWS_AFTER, STAGE, UI_INK, UI_MUTED } from './kit';

const PW = 440;
const PH = 580;
const PY = 800;

/** 본편 사이드바를 표지 크기로 다시 그린 판. full이면 목록이 그대로(맨 윗줄 새 세션 띠), 아니면 텅 빈 목록. */
const Panel: React.FC<{ x: number; full: boolean }> = ({ x, full }) => (
  <div style={{ position: 'absolute', left: x, top: PY, width: PW, height: PH, borderRadius: 28, background: PAPER, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', left: 30, top: 24, fontFamily: KO, fontWeight: 650, fontSize: 32, color: UI_INK, letterSpacing: '-0.02em' }}>Code</div>
    {full
      ? SIDE_ROWS_AFTER.map((row, i) => (
          <div key={i} style={{ position: 'absolute', left: 14, top: 84 + i * 74, width: PW - 28, height: 64, borderRadius: 16, background: row.isNew ? NEW_ROW : undefined, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 22, top: 26, width: 12, height: 12, borderRadius: 6, background: row.isNew ? '#2B2A26' : '#CFCBC2' }} />
            <div style={{ position: 'absolute', left: 48, top: 13, fontFamily: KO, fontWeight: 560, fontSize: 27, color: '#2B2A26', filter: 'blur(5px)', whiteSpace: 'nowrap' }}>{row.title}</div>
          </div>
        ))
      : null}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 474, height: 1, background: '#E2DFD7' }} />
    <div style={{ position: 'absolute', left: 28, top: 500, width: 52, height: 52, borderRadius: 26, background: AVATARS['계정 2'] }} />
    <div style={{ position: 'absolute', left: 96, top: 506, fontFamily: KO, fontWeight: 650, fontSize: 32, color: UI_INK, letterSpacing: '-0.02em' }}>계정 2</div>
    <svg width={22} height={30} viewBox="0 0 22 30" style={{ position: 'absolute', left: 206, top: 512 }}>
      <path d="M5 11 L11 5 L17 11 M5 19 L11 25 L17 19" fill="none" stroke={UI_MUTED} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

const Label: React.FC<{ x: number; tag: string; children: React.ReactNode }> = ({ x, tag, children }) => (
  <div style={{ position: 'absolute', left: x + 4, top: PY - 70, fontFamily: KO, fontWeight: 700, fontSize: 44, letterSpacing: '-0.03em', color: INK, whiteSpace: 'nowrap' }}>
    <span style={{ color: DIM }}>{tag}</span>
    <span style={{ color: '#4A4843' }}> · </span>
    {children}
  </div>
);

export const Cover: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE }}>
    <div style={{ position: 'absolute', left: 72, top: 296, fontFamily: KO, fontWeight: 640, fontSize: 46, letterSpacing: '-0.03em', color: '#B9B6AE' }}>Claude 5시간 한도가 찼을 때</div>
    <div style={{ position: 'absolute', left: 68, top: 368, fontFamily: KO, fontWeight: 760, fontSize: 150, lineHeight: 1.08, letterSpacing: '-0.045em', color: INK }}>
      <div>계정 바꿔도</div>
      <div>
        세션 <span style={{ color: BUTTER }}>그대로</span>
      </div>
    </div>
    <Label x={64} tag="전">다 사라짐</Label>
    <Label x={576} tag="후">그대로</Label>
    <Panel x={64} full={false} />
    <Panel x={576} full />
    <svg width={48} height={28} viewBox="0 0 48 28" style={{ position: 'absolute', left: 516, top: PY + PH / 2 - 14 }}>
      <path d="M4 14 H42 M31 4 L43 14 L31 24" fill="none" stroke={DIM} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <div style={{ position: 'absolute', left: 72, top: PY + PH + 22, fontFamily: MONO, fontSize: 24, color: DIM }}>재현 화면</div>
    <Img src={staticFile('img/logo-synk-paper.webp')} style={{ position: 'absolute', left: 72, top: 1486, height: 52 }} />
  </AbsoluteFill>
);
