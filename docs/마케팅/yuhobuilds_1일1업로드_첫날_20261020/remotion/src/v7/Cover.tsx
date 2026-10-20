// v7 표지(따로 짠 한 장): 작은 줄은 대상, 큰 제목은 약속(「"올려"」 버터 한 곳), 아래는 영상 끝의 체크리스트 네 줄(저장하고 싶은 한 장).
// 글은 SNS 키트 cover916 안전 영역(x 65~920, y 269~1428) 안, 전부 프로필 3:4 격자(y 240~1680) 안.
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { BUTTER, DIM, INK, STAGE } from '../film/parts';
import { KO, MONO } from '../lib/fonts';
import { PAPER, RULE, UI_INK, UI_MUTED } from '../day1/parts';

const ITEMS = [
  ['월요일: 한 주 소재 목록', '트렌드 · 받은 질문 · 달력 · 내 실화'],
  ['매일 같은 시각: 브랜드마다 한 편', '아침 7시로 걸어 둠'],
  ['최종본 보고 「올려」 한 번', '사람 몫은 여기만'],
  ['4일 치 예약 비축', '올리기는 한 창에서 차례로'],
] as const;

export const CoverV7: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE }}>
    <div style={{ position: 'absolute', left: 72, top: 292, fontFamily: KO, fontWeight: 600, fontSize: 44, color: DIM, letterSpacing: '-0.02em' }}>AI에 맡기는 3단계 · 체크리스트</div>
    <div style={{ position: 'absolute', left: 68, top: 372, fontFamily: KO, fontWeight: 780, fontSize: 96, lineHeight: 1.12, letterSpacing: '-0.04em', color: INK }}>
      SNS 업로드 자동화,
      <br />
      사람이 할 일은
      <br />
      <span style={{ color: BUTTER }}>"올려"</span> 한 마디
    </div>
    <div style={{ position: 'absolute', left: 65, top: 800, width: 855, height: 520, borderRadius: 36, background: PAPER }}>
      <div style={{ position: 'absolute', left: 36, top: 30, fontFamily: KO, fontWeight: 760, fontSize: 38, color: UI_INK, letterSpacing: '-0.03em' }}>SNS 업로드 자동화 체크리스트</div>
      <svg width={40} height={50} viewBox="0 0 46 58" style={{ position: 'absolute', right: 36, top: 30 }}>
        <path d="M5 4 Q5 2 7 2 L39 2 Q41 2 41 4 L41 54 L23 41 L5 54 Z" fill={BUTTER} stroke={BUTTER} strokeWidth={3.5} strokeLinejoin="round" />
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 96, height: 1, background: RULE }} />
      {ITEMS.map(([t, s], i) => (
        <div key={i} style={{ position: 'absolute', left: 30, right: 30, top: 116 + i * 98, height: 88 }}>
          <div style={{ position: 'absolute', left: 6, top: 22, width: 36, height: 36, borderRadius: 9, boxShadow: `inset 0 0 0 3px ${UI_INK}` }} />
          <div style={{ position: 'absolute', left: 64, top: 10, fontFamily: KO, fontWeight: 720, fontSize: 32, color: UI_INK, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{t}</div>
          <div style={{ position: 'absolute', left: 66, top: 52, fontFamily: KO, fontWeight: 560, fontSize: 22, color: UI_MUTED, whiteSpace: 'nowrap' }}>{s}</div>
        </div>
      ))}
    </div>
    <Img src={staticFile('img/logo-synk-paper.webp')} style={{ position: 'absolute', left: 72, top: 1360, height: 52 }} />
    <div style={{ position: 'absolute', left: 260, top: 1372, fontFamily: MONO, fontSize: 26, color: DIM }}>yuhobuilds · 1일 1업로드 첫날</div>
  </AbsoluteFill>
);
