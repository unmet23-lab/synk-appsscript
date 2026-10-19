// 표지(따로 짠 한 장, S22 표지 문법): 작은 줄은 상황, 큰 제목은 약속(버터 한 곳), 아래는 같은 질문에 대한 전·후 답.
// 글은 SNS 키트 cover916 안전 영역(x 65~920, y 269~1428) 안, 전부 프로필 3:4 격자(y 240~1680) 안. 말풍선 글은 제목의 55% 아래.
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { BUTTER, DIM, INK, STAGE } from '../film/parts';
import { KO, MONO } from '../lib/fonts';
import { Avatar, BUBBLE_BOT, BUBBLE_ME, ME_INK, PAPER, RULE, UI_INK, UI_MUTED } from './parts';

const Row: React.FC<{ tag: string; text: React.ReactNode; dim?: boolean; top: number }> = ({ tag, text, dim, top }) => (
  <div style={{ position: 'absolute', left: 36, right: 36, top }}>
    <div style={{ fontFamily: MONO, fontSize: 30, color: UI_MUTED, marginBottom: 14 }}>{tag}</div>
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, opacity: dim ? 0.55 : 1 }}>
      <Avatar size={56} />
      <div style={{ padding: '22px 30px 24px', borderRadius: 36, background: BUBBLE_BOT, color: UI_INK, fontFamily: KO, fontWeight: 600, fontSize: 46, lineHeight: 1.3, letterSpacing: '-0.02em', maxWidth: 680 }}>{text}</div>
    </div>
  </div>
);

export const Cover: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE }}>
    <div style={{ position: 'absolute', left: 72, top: 292, fontFamily: KO, fontWeight: 600, fontSize: 46, color: DIM, letterSpacing: '-0.02em' }}>받는 쪽에서 다시 읽어 보니</div>
    <div style={{ position: 'absolute', left: 68, top: 372, fontFamily: KO, fontWeight: 780, fontSize: 128, lineHeight: 1.08, letterSpacing: '-0.04em', color: INK }}>
      자동 DM의
      <br />
      <span style={{ color: BUTTER }}>AI 티</span> 지우기
    </div>
    <div style={{ position: 'absolute', left: 65, top: 720, width: 855, height: 640, borderRadius: 36, background: PAPER }}>
      <div style={{ position: 'absolute', left: 36, right: 36, top: 34, display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ padding: '18px 28px', borderRadius: 32, background: BUBBLE_ME, color: ME_INK, fontFamily: KO, fontWeight: 600, fontSize: 38, letterSpacing: '-0.02em' }}>대화 기록은 괜찮나요?</div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 140, height: 1, background: RULE }} />
      <Row tag="전" top={170} dim text={<>아니요, 대화 원문(…)은 건드리지 않아요.</>} />
      <Row tag="후" top={400} text={<>걱정하지 않으셔도 돼요.</>} />
    </div>
    <Img src={staticFile('img/logo-synk-paper.webp')} style={{ position: 'absolute', left: 72, top: 1392, height: 52 }} />
    <div style={{ position: 'absolute', left: 260, top: 1404, fontFamily: MONO, fontSize: 26, color: DIM }}>재현 화면 · 문구는 실제</div>
  </AbsoluteFill>
);
