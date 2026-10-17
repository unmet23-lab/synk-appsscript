// v5 05 급한 것만 맨 위에(청금석 무대 위, 칩은 튕기지 않고 내려앉음): 「지금 볼 것」 칩이 떨어지고, 「주간 99%」가 칩에서 튀어나와 화면을 채운 뒤 돌아가며 크레용 동그라미.
import { evolvePath } from '@remotion/paths';
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { ATTENTION } from '../data';
import { clamp, EASE_IN_OUT, ramp } from '../lib/anim';
import { Board } from '../parts';
import { C, F, L } from '../theme';
import { ATT } from '../timeline';
import { CaptionF, FloatCard, HeadF, Lines, MarkF, settle } from './cine';

// 10-17 유호님 「이 단락 크기를 조금 키워보는건」: 판 css 폭을 520 → 380으로 줄여 2배 남짓으로 키운다(칩 글자 약 29px).
const BW = 380;
const SCALE = (L.W - L.X - L.R - 52) / BW;

const TOP = 640;
// 둘째 칩(주간 99%)의 화면 위 자리 — 렌더 정지컷(10-17)에서 잰 값: 판 안 css 134에서 시작, 폭 222
const CHIP = { x: L.X + 26 + 2 * SCALE, y: TOP + 26 + 134 * SCALE, w: 222 * SCALE, h: 44 * SCALE };

export const Attention5: React.FC = () => {
  const f = useCurrentFrame();
  const out = settle(f, ATT.pop, 11);
  const back = interpolate(f, [ATT.back, ATT.back + 10], [0, 1], { ...clamp, easing: EASE_IN_OUT });
  const big = out * (1 - back);
  const circle = evolvePath(ramp(f, ATT.circle, 14), 'M 30 60 C 30 15, 330 5, 380 50 C 420 95, 120 125, 40 95 C 10 85, 20 40, 60 30');
  return (
    <>
      <HeadF left="synkbrief 활용" right="05" />
      <Lines at={2} size={72} top={L.TOP - 8} lines={[<>급한 것만 <MarkF key="m" p={ramp(f, 8, 12)}>맨 위에</MarkF></>]} />
      <FloatCard style={{ left: L.X, right: L.R, top: TOP, height: 440, padding: 26 }}>
        <Board width={BW} scale={SCALE}>
          <section className="ms-section" style={{ borderTop: 0, padding: '4px 2px 0' }}>
            <div className="ms-section-heading" style={{ opacity: 1 - 0.92 * big }}>
              <span className="ms-section-number">01</span>
              <div>
                <h2>지금 볼 것</h2>
                <p>소진·한도 90% 이상·크레딧 부족·3일 안 결제만 올라와요.</p>
              </div>
            </div>
            <div className="ms-attn" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              {ATTENTION.map((a, i) => {
                const s = settle(f, ATT.chips[i], 16);
                const lifted = i === 0 ? big : 0; // 1번 칩만 흐리고, 2번 칩(주간 99%)은 큰 숫자 밑 출처로 또렷하게
                return (
                  <button
                    key={i}
                    className={`ms-attn-chip ms-l${a.level}`}
                    style={{ opacity: interpolate(s, [0, 0.4], [0, 1], clamp) * (1 - 0.92 * lifted), translate: `0 ${(1 - s) * -40}px`, scale: String(0.9 + 0.1 * s) }}
                  >
                    <span className="ms-dot" aria-hidden="true" />
                    {a.text}
                  </button>
                );
              })}
            </div>
          </section>
        </Board>
      </FloatCard>
      {/* 칩에서 튀어나온 큰 숫자: 바로 99%(셈 없음), 아래끝이 2번 칩 위에 오게 */}
      {big > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            left: interpolate(big, [0, 1], [CHIP.x, L.X + 48]),
            top: interpolate(big, [0, 1], [CHIP.y, 700]),
            transformOrigin: '0 0',
            scale: String(interpolate(big, [0, 1], [0.18, 1])),
            opacity: interpolate(big, [0, 0.25], [0, 1], clamp),
          }}
        >
          <div style={{ font: `800 200px/0.9 ${F.ko}`, letterSpacing: '-.06em', color: C.crayon, fontVariantNumeric: 'tabular-nums' }}>
            99%
          </div>
        </div>
      ) : null}
      {/* 크레용 동그라미 */}
      <svg width={CHIP.w + 80} height={CHIP.h + 70} viewBox="0 0 420 130" preserveAspectRatio="none" style={{ position: 'absolute', left: CHIP.x - 40, top: CHIP.y - 35, overflow: 'visible' }}>
        <path
          d="M 30 60 C 30 15, 330 5, 380 50 C 420 95, 120 125, 40 95 C 10 85, 20 40, 60 30"
          fill="none"
          stroke={C.crayon}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={circle.strokeDasharray}
          strokeDashoffset={circle.strokeDashoffset}
          style={{ filter: 'url(#rough)' }}
        />
        <defs>
          <filter id="rough">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={3} />
            <feDisplacementMap in="SourceGraphic" scale={4} />
          </filter>
        </defs>
      </svg>
      <CaptionF text="다 써 가는 계정, 모자란 크레딧부터." em="다 써 가는 계정," at={14} />
    </>
  );
};
