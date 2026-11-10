// 폰 화면 — 광고 속 얼굴로 찾기(재연용으로 직접 만든 화면 · 실제 서비스 로고 · 이름 없음). 글은 우리가 쓴 그대로라 영상 모델이 다시 그리지 않는다.
// v2(11-10 미학 맹검 04 기각 「폰 앱 꼴 없이 급조한 목업 · 로딩 막대가 툭 사라짐 · 앱에 안 쓰는 설명 글 · 사진 속 청진기」):
//   상태 줄 · 검색창 안 사진 칩 · 얼굴 위를 훑는 스캔 줄 · 결과 탭 · 빈 결과 아이콘으로 실제 앱 꼴을 갖추고, 찾는 중 → 결과는 밀려 올라오며 바뀐다.
//   사진은 A1에서 얼굴만 뽑은 한 장(청진기가 안 보이게). 버터는 이 편에서 「없습니다」 한 곳(화면 결 ②).
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const BUTTER = '#F5C445';
const X = 64;
const INK = '#F2F2F7';
const SUB = '#9A9AA0';
const LINE = 'rgba(255,255,255,0.12)';

// resultAt = 결과가 뜨는 프레임(이 화면이 시작한 뒤)
export const Search: React.FC<{ resultAt: number }> = ({ resultAt }) => {
  const f = useCurrentFrame();
  const inScale = interpolate(f, [0, 8], [1.035, 1], { ...clamp, easing: EASE_OUT });
  const shakeX = Math.sin(f * 0.21) * 2.0 + Math.sin(f * 0.53) * 1.0;
  const shakeY = Math.cos(f * 0.17) * 2.4;
  const scan = interpolate(f, [2, resultAt], [0, 1], clamp);
  const scanY = (Math.sin(scan * Math.PI * 3 - Math.PI / 2) + 1) / 2; // 위아래로 한 번 반 훑음
  const searching = interpolate(f, [resultAt - 3, resultAt + 2], [1, 0], clamp);
  const res = interpolate(f, [resultAt, resultAt + 10], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill style={{ background: '#0E0F11', fontFamily: KO, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${shakeX}px, ${shakeY}px) scale(${inScale})`, transformOrigin: '50% 35%' }}>
        {/* 상태 줄 */}
        <div style={{ position: 'absolute', left: X, right: X, top: 300, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: INK, fontWeight: 700, fontSize: 40 }}>
          <span>9:41</span>
          <span style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
            {[14, 20, 26, 32].map((h, i) => <span key={i} style={{ width: 9, height: h, background: INK, borderRadius: 2, display: 'inline-block' }} />)}
            <span style={{ width: 62, height: 30, border: `3px solid ${INK}`, borderRadius: 8, marginLeft: 14, position: 'relative', display: 'inline-block' }}>
              <span style={{ position: 'absolute', left: 4, top: 4, bottom: 4, width: 40, background: INK, borderRadius: 3 }} />
            </span>
          </span>
        </div>
        {/* 머리 · 검색창 */}
        <div style={{ position: 'absolute', left: X, right: X, top: 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 26, color: INK }}>
            <span style={{ fontSize: 64, fontWeight: 500, lineHeight: 1 }}>‹</span>
            <span style={{ fontSize: 52, fontWeight: 800, letterSpacing: -1 }}>이미지로 찾기</span>
          </div>
          <div style={{ marginTop: 34, height: 118, borderRadius: 59, background: '#1E2023', border: `2px solid ${LINE}`, display: 'flex', alignItems: 'center', padding: '0 22px', gap: 22 }}>
            <div style={{ width: 76, height: 76, borderRadius: 16, overflow: 'hidden', flex: 'none' }}>
              <Img src={staticFile('img/A1_face.jpg')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span style={{ fontSize: 44, fontWeight: 600, color: SUB, letterSpacing: -0.6 }}>이 사진으로 찾기</span>
          </div>
        </div>
        {/* 찾는 중 — 얼굴 위를 훑는 스캔 줄 */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 700, display: 'flex', justifyContent: 'center', opacity: searching }}>
          <div style={{ width: 560, height: 680, borderRadius: 36, overflow: 'hidden', position: 'relative', background: '#222' }}>
            <Img src={staticFile('img/A1_face.jpg')} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.85)' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: `${scanY * 100}%`, height: 6, background: 'rgba(255,255,255,0.95)', boxShadow: '0 0 28px 10px rgba(255,255,255,0.35)' }} />
            {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([r, b], i) => (
              <div key={i} style={{ position: 'absolute', width: 70, height: 70, ...(r ? { right: 28 } : { left: 28 }), ...(b ? { bottom: 28 } : { top: 28 }), borderColor: 'rgba(255,255,255,0.9)', borderStyle: 'solid', borderWidth: `${b ? 0 : 6}px ${r ? 6 : 0}px ${b ? 6 : 0}px ${r ? 0 : 6}px`, borderRadius: 10 }} />
            ))}
          </div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1420, textAlign: 'center', fontSize: 52, fontWeight: 700, color: SUB, letterSpacing: -0.8, opacity: searching }}>비슷한 얼굴 찾는 중</div>
        {/* 결과 — 탭 · 빈 결과 */}
        <div style={{ position: 'absolute', left: X, right: X, top: 700, opacity: res, transform: `translateY(${(1 - res) * 60}px)` }}>
          <div style={{ display: 'flex', gap: 44, fontSize: 42, fontWeight: 700, color: SUB, borderBottom: `2px solid ${LINE}`, paddingBottom: 22 }}>
            <span style={{ color: INK, borderBottom: `5px solid ${INK}`, paddingBottom: 18, marginBottom: -24 }}>전체</span>
            <span>비슷한 이미지</span>
            <span>출처</span>
          </div>
          <div style={{ marginTop: 120, display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 170, height: 170, borderRadius: 85, border: `8px solid ${SUB}`, position: 'relative' }}>
              <div style={{ position: 'absolute', width: 80, height: 10, background: SUB, borderRadius: 5, right: -64, bottom: -18, transform: 'rotate(45deg)' }} />
              <div style={{ position: 'absolute', width: 110, height: 8, background: SUB, borderRadius: 4, left: 22, top: 77, transform: 'rotate(-45deg)' }} />
            </div>
          </div>
          <div style={{ marginTop: 110, textAlign: 'center', fontWeight: 800, fontSize: 112, lineHeight: 1.14, letterSpacing: -2.6, color: '#fff', wordBreak: 'keep-all' }}>
            일치하는 결과가<br /><span style={{ color: BUTTER }}>없습니다</span>
          </div>
          <div style={{ marginTop: 34, textAlign: 'center', fontWeight: 700, fontSize: 50, color: SUB, letterSpacing: -0.8 }}>비슷한 이미지 0개</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
