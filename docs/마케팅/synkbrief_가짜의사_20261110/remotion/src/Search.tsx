// 폰 화면 — 광고 속 얼굴로 찾기(재연용으로 직접 만든 화면 · 실제 서비스 로고 없음). 글은 우리가 쓴 그대로라 영상 모델이 다시 그리지 않는다.
// 찾는 중 → 「일치하는 결과가 없습니다」. 버터는 이 편에서 「없습니다」 한 곳(화면 결 ②). 얼굴 사진은 광고 동영상 A1에서 뽑은 한 장.
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const BUTTER = '#F5C445';
const X = 74;

// resultAt = 결과가 뜨는 프레임(이 화면이 시작한 뒤)
export const Search: React.FC<{ resultAt: number }> = ({ resultAt }) => {
  const f = useCurrentFrame();
  const inScale = interpolate(f, [0, 8], [1.035, 1], { ...clamp, easing: EASE_OUT });
  const shakeX = Math.sin(f * 0.21) * 2.0 + Math.sin(f * 0.53) * 1.0;
  const shakeY = Math.cos(f * 0.17) * 2.4;
  const bar = interpolate(f, [4, resultAt], [0.08, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const searching = interpolate(f, [resultAt - 4, resultAt], [1, 0], clamp);
  const res = interpolate(f, [resultAt, resultAt + 9], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill style={{ background: '#111214', fontFamily: KO, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${shakeX}px, ${shakeY}px) scale(${inScale})`, transformOrigin: '50% 35%' }}>
        <div style={{ position: 'absolute', left: X, right: X, top: 420 }}>
          <div style={{ fontWeight: 600, fontSize: 42, color: '#9A9AA0', letterSpacing: -0.4 }}>‹ 이미지로 찾기</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 40, marginTop: 50 }}>
            <div style={{ width: 300, height: 360, borderRadius: 28, overflow: 'hidden', background: '#222', flex: 'none' }}>
              <Img src={staticFile('img/A1_face.jpg')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 50, lineHeight: 1.3, color: '#E5E5EA', letterSpacing: -0.8 }}>광고 속<br />그 선생님</div>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.12)', marginTop: 70, overflow: 'hidden', opacity: searching }}>
            <div style={{ width: `${bar * 100}%`, height: '100%', background: 'rgba(255,255,255,0.7)' }} />
          </div>
          <div style={{ fontWeight: 600, fontSize: 46, color: '#9A9AA0', letterSpacing: -0.6, marginTop: 30, opacity: searching }}>비슷한 얼굴 찾는 중</div>
          <div style={{ marginTop: -60, opacity: res, transform: `translateY(${(1 - res) * 28}px)` }}>
            <div style={{ fontWeight: 800, fontSize: 108, lineHeight: 1.14, letterSpacing: -2.6, color: '#fff', wordBreak: 'keep-all' }}>
              일치하는 결과가<br /><span style={{ color: BUTTER }}>없습니다</span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 44, color: '#9A9AA0', letterSpacing: -0.6, marginTop: 34 }}>병원 · 이름 · 다른 사진 0건</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
