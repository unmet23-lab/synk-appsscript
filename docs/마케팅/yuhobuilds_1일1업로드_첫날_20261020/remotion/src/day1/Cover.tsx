// 표지(따로 짠 한 장, S22 표지 문법): 작은 줄은 상황, 큰 제목은 결과(버터 한 곳), 아래는 실제 세션 세 줄과 「채널 12곳 · 예약 0」.
// 글은 SNS 키트 cover916 안전 영역(x 65~920, y 269~1428) 안, 전부 프로필 3:4 격자(y 240~1680) 안.
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { BUTTER, DIM, INK, STAGE } from '../film/parts';
import { EN, KO, MONO } from '../lib/fonts';
import { CHILDREN, PARENT } from './data';
import { PAPER, RULE, UI_INK, UI_MUTED } from './parts';

export const Cover: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE }}>
    <div style={{ position: 'absolute', left: 72, top: 292, fontFamily: KO, fontWeight: 600, fontSize: 46, color: DIM, letterSpacing: '-0.02em' }}>1일 1업로드 첫날</div>
    <div style={{ position: 'absolute', left: 68, top: 372, fontFamily: KO, fontWeight: 780, fontSize: 122, lineHeight: 1.1, letterSpacing: '-0.04em', color: INK }}>
      AI 직원 <span style={{ color: BUTTER }}>셋</span>에게
      <br />한 편씩 맡겼다
    </div>
    <div style={{ position: 'absolute', left: 65, top: 720, width: 855, height: 520, borderRadius: 36, background: PAPER }}>
      <div style={{ position: 'absolute', left: 36, top: 30, fontFamily: KO, fontWeight: 650, fontSize: 32, color: UI_INK }}>Code</div>
      <div style={{ position: 'absolute', right: 34, top: 36, fontFamily: MONO, fontSize: 22, color: UI_MUTED }}>10-20</div>
      <div style={{ position: 'absolute', left: 18, right: 18, top: 96, height: 76, borderRadius: 18, background: '#EBE9E3' }}>
        <div style={{ position: 'absolute', left: 24, top: 31, width: 13, height: 13, borderRadius: 7, background: '#2B2A26' }} />
        <div style={{ position: 'absolute', left: 56, top: 17, fontFamily: KO, fontWeight: 620, fontSize: 31, color: '#2B2A26' }}>{PARENT.title}</div>
      </div>
      {CHILDREN.map((c, i) => (
        <div key={i} style={{ position: 'absolute', left: 62, right: 18, top: 190 + i * 80, height: 70, borderRadius: 16, boxShadow: i === 2 ? `0 0 0 4px ${BUTTER}` : undefined, background: i === 2 ? '#F3EBD3' : undefined }}>
          <div style={{ position: 'absolute', left: 18, top: 29, width: 11, height: 11, borderRadius: 6, background: '#2B2A26' }} />
          <div style={{ position: 'absolute', left: 44, top: 16, width: 640, fontFamily: KO, fontWeight: 560, fontSize: 28, color: '#2B2A26', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</div>
          <div style={{ position: 'absolute', right: 18, top: 23, fontFamily: MONO, fontSize: 20, color: UI_MUTED }}>{c.meta}</div>
        </div>
      ))}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 440, height: 1, background: RULE }} />
      <div style={{ position: 'absolute', left: 36, top: 456, display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <span style={{ fontFamily: KO, fontWeight: 650, fontSize: 32, color: UI_INK }}>채널 12곳 · 예약</span>
        <span style={{ fontFamily: EN, fontWeight: 760, fontSize: 46, color: UI_INK, lineHeight: 1 }}>0</span>
      </div>
    </div>
    <Img src={staticFile('img/logo-synk-paper.webp')} style={{ position: 'absolute', left: 72, top: 1300, height: 52 }} />
    <div style={{ position: 'absolute', left: 260, top: 1312, fontFamily: MONO, fontSize: 26, color: DIM }}>재현 화면 · 제목과 시각은 실제</div>
  </AbsoluteFill>
);
