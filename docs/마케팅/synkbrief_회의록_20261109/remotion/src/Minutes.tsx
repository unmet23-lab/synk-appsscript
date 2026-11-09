// 폰 화면 — AI 회의록 메일(재연용으로 직접 만든 화면 · 실제 서비스 로고 없음). 글은 우리가 쓴 그대로라 영상 모델이 다시 그리지 않는다.
// 스크롤로 논의 → 결정 사항까지 내려가고, 마지막은 그 줄 밖을 어둡게 누른다(화면 결 ⑥). 버터는 「비밀」 한 곳.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE = Easing.bezier(0.45, 0, 0.15, 1);
const BUTTER = '#F5C445';
const X = 74;

const Row: React.FC<{ head: string; body: React.ReactNode; dim: number; big?: boolean }> = ({ head, body, dim, big }) => (
  <div style={{ marginBottom: big ? 0 : 54, opacity: dim }}>
    <div style={{ fontWeight: 600, fontSize: 40, color: '#9A9AA0', letterSpacing: -0.4, marginBottom: 10 }}>{head}</div>
    <div style={{ fontWeight: big ? 800 : 600, fontSize: big ? 112 : 62, lineHeight: big ? 1.14 : 1.28, letterSpacing: big ? -2.6 : -1.1, color: '#fff', wordBreak: 'keep-all' }}>{body}</div>
  </div>
);

// d = 이 화면이 시작한 뒤 프레임, scrollAt · focusAt = 스크롤 · 누르기 시작 프레임
export const Minutes: React.FC<{ scrollAt: number; scrollLen: number; focusAt: number }> = ({ scrollAt, scrollLen, focusAt }) => {
  const f = useCurrentFrame();
  const scroll = interpolate(f, [scrollAt, scrollAt + scrollLen], [0, 1.5], { ...clamp, easing: EASE });
  const focus = interpolate(f, [focusAt, focusAt + 10], [1, 0.22], clamp);
  const shakeX = Math.sin(f * 0.21) * 2.2 + Math.sin(f * 0.53) * 1.1;
  const shakeY = Math.cos(f * 0.17) * 2.6;
  const inScale = interpolate(f, [0, 8], [1.035, 1], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  return (
    <AbsoluteFill style={{ background: '#111214', fontFamily: KO, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${shakeX}px, ${shakeY - scroll * 720}px) scale(${inScale})`, transformOrigin: '50% 30%' }}>
        <div style={{ position: 'absolute', left: X, right: X, top: 420 }}>
          <div style={{ opacity: focus }}>
            <div style={{ fontWeight: 600, fontSize: 42, color: '#9A9AA0', letterSpacing: -0.4 }}>‹ 받은 편지함</div>
            <div style={{ fontWeight: 800, fontSize: 96, lineHeight: 1.14, letterSpacing: -2.6, color: '#fff', marginTop: 46 }}>AI 회의록<br />주간 회의 요약</div>
            <div style={{ fontWeight: 700, fontSize: 50, color: '#E5E5EA', letterSpacing: -0.8, marginTop: 34 }}>받는 사람 · 참석자 전원 14명</div>
            <div style={{ height: 2, background: 'rgba(255,255,255,0.14)', marginTop: 54, marginBottom: 56 }} />
            <Row head="논의 1" body="3분기 일정 확인" dim={1} />
            <Row head="논의 2" body="부장님, 같은 말 네 번 하심" dim={1} />
            <Row head="논의 3" body={<>부장님은 회의를 왜 하는지 모르심<div style={{ fontSize: 44, fontWeight: 600, color: '#C7C7CC', letterSpacing: -0.6, marginTop: 10 }}>대리 의견 · 과장 동의</div></>} dim={1} />
          </div>
          <div style={{ height: 230 }} />
          {/* 웃음 줄은 스크롤이 거의 다 내려온 뒤에 나타난다(첫 렌더에서 스크롤 전부터 아래에 보여 먼저 샜다) */}
          <Row big head="결정 사항" body={<>부장님께는<br /><span style={{ color: BUTTER }}>비밀</span>로 한다</>} dim={interpolate(f, [scrollAt + scrollLen * 0.55, scrollAt + scrollLen], [0, 1], clamp)} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
