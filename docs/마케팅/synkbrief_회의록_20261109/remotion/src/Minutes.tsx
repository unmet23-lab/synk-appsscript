// 폰 화면 — AI 회의록 메일(재연용으로 직접 만든 다크 모드 메일 앱 · 실제 서비스 로고 없음).
// v2(11-10 미학 맹검 「검정 바탕 위 기본 고딕만 늘어놓아 PPT 같다 · 아래 3분의 1이 빈다」): 상태 줄 · 보낸이 줄 · 받는 사람 · 제목 · 논의 목록 ·
// 결정 사항 · 아래 답장 줄로 화면을 채우고, 줄이 하나씩 올라온 뒤 「결정 사항」이 마지막에 들어온다. 버터는 「비밀」 한 곳.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const BUTTER = '#F5C445';
const X = 74;
const SUB = '#9A9AA0';
const LINE = 'rgba(255,255,255,0.12)';

// at = 그 줄이 올라오는 프레임
const Up: React.FC<{ at: number; dim: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, dim, children, style }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 9], [0, 1], { ...clamp, easing: EASE });
  return <div style={{ ...style, opacity: p * dim, transform: `translateY(${(1 - p) * 26}px)` }}>{children}</div>;
};

// scrollAt = 논의 줄이 올라오기 시작 · scrollLen = 그 사이 · focusAt = 결정 사항이 들어오고 나머지가 가라앉는 프레임
export const Minutes: React.FC<{ scrollAt: number; scrollLen: number; focusAt: number }> = ({ scrollAt, scrollLen, focusAt }) => {
  const f = useCurrentFrame();
  const dim = interpolate(f, [focusAt + 4, focusAt + 14], [1, 0.26], clamp);
  const shakeX = Math.sin(f * 0.21) * 2.0 + Math.sin(f * 0.53) * 1.0;
  const shakeY = Math.cos(f * 0.17) * 2.4;
  const inScale = interpolate(f, [0, 8], [1.035, 1], { ...clamp, easing: EASE });
  const step = Math.round(scrollLen / 3);
  const item = (t: string, k: number, extra?: React.ReactNode) => (
    <Up at={scrollAt + k * step} dim={dim} style={{ display: 'flex', gap: 26, marginBottom: 44 }}>
      <div style={{ width: 14, height: 14, borderRadius: 7, background: '#636366', marginTop: 30, flex: 'none' }} />
      <div>
        <div style={{ fontWeight: 600, fontSize: 62, lineHeight: 1.26, letterSpacing: -1.4, color: '#fff', wordBreak: 'keep-all' }}>{t}</div>
        {extra}
      </div>
    </Up>
  );
  return (
    <AbsoluteFill style={{ background: '#000', fontFamily: KO, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${shakeX}px, ${shakeY}px) scale(${inScale})`, transformOrigin: '50% 40%' }}>
        {/* 상태 줄 */}
        <div style={{ position: 'absolute', left: X, right: X, top: 58, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: dim }}>
          <div style={{ fontWeight: 700, fontSize: 40, color: '#fff', letterSpacing: -0.5 }}>7:42</div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
            {[14, 20, 26, 32].map((h, i) => <div key={i} style={{ width: 9, height: h, borderRadius: 2, background: '#fff' }} />)}
            <div style={{ width: 62, height: 30, borderRadius: 8, border: '3px solid #fff', marginLeft: 12, position: 'relative' }}><div style={{ position: 'absolute', left: 4, top: 4, bottom: 4, width: 34, borderRadius: 4, background: '#fff' }} /></div>
          </div>
        </div>
        {/* 위 줄 */}
        <div style={{ position: 'absolute', left: X - 10, right: X, top: 160, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: dim }}>
          <div style={{ fontWeight: 600, fontSize: 44, color: '#C7C7CC', letterSpacing: -0.5 }}>‹ 받은편지함</div>
          <div style={{ fontWeight: 700, fontSize: 52, color: '#C7C7CC', letterSpacing: 4 }}>···</div>
        </div>
        {/* 보낸이 · 받는 사람 */}
        <div style={{ position: 'absolute', left: X, right: X, top: 290, display: 'flex', gap: 28, alignItems: 'center', opacity: dim }}>
          <div style={{ width: 112, height: 112, borderRadius: 56, background: '#3A3A3C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 44, color: '#fff', flex: 'none' }}>AI</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 800, fontSize: 54, color: '#fff', letterSpacing: -1.2 }}>AI 회의록</div>
              <div style={{ fontWeight: 600, fontSize: 38, color: SUB }}>오후 7:42</div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 44, color: '#E5E5EA', letterSpacing: -0.8, marginTop: 8 }}>받는 사람: 참석자 전원 14명</div>
          </div>
        </div>
        {/* 제목 */}
        <div style={{ position: 'absolute', left: X, right: X, top: 470, opacity: dim }}>
          <div style={{ fontWeight: 800, fontSize: 92, lineHeight: 1.12, letterSpacing: -2.6, color: '#fff' }}>주간 회의 요약</div>
          <div style={{ height: 2, background: LINE, marginTop: 44 }} />
        </div>
        {/* 논의 */}
        <div style={{ position: 'absolute', left: X, right: X, top: 650 }}>
          <Up at={scrollAt - 6} dim={dim}><div style={{ fontWeight: 700, fontSize: 40, color: SUB, letterSpacing: -0.4, marginBottom: 22 }}>논의</div></Up>
          {item('3분기 일정 확인', 0)}
          {item('부장님, 같은 말 네 번 하심', 1)}
          {item('부장님은 회의를 왜 하는지 모르심', 2, <div style={{ fontWeight: 600, fontSize: 44, color: '#C7C7CC', letterSpacing: -0.6, marginTop: 8 }}>대리 의견 · 과장 동의</div>)}
        </div>
        {/* 결정 사항 — 마지막에 들어와 혼자 밝다 */}
        <Up at={focusAt - 4} dim={1} style={{ position: 'absolute', left: X, right: X, top: 1250 }}>
          <div style={{ fontWeight: 700, fontSize: 40, color: SUB, letterSpacing: -0.4, marginBottom: 16 }}>결정 사항</div>
          <div style={{ fontWeight: 800, fontSize: 124, lineHeight: 1.1, letterSpacing: -3.4, color: '#fff' }}>부장님께는<br /><span style={{ color: BUTTER }}>비밀</span>로 한다</div>
        </Up>
        {/* 아래 답장 줄 */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1690, borderTop: `2px solid ${LINE}`, opacity: dim }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', paddingTop: 34 }}>
            {['답장', '전체 답장', '전달'].map((t) => <div key={t} style={{ fontWeight: 600, fontSize: 40, color: '#C7C7CC', letterSpacing: -0.4 }}>{t}</div>)}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
