// 05 급한 것만 맨 위에: 「지금 볼 것」 칩이 떨어지고, 「주간 99%」가 칩에서 튀어나와 화면을 채운 뒤 돌아가며 크레용 동그라미.
import { evolvePath } from '@remotion/paths';
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ATTENTION } from '../data';
import { clamp, EASE_IN_OUT, ramp } from '../lib/anim';
import { Board, Caption, Head, Mark, Paper, Screen, Title } from '../parts';
import { C, F, L } from '../theme';
import { ATT } from '../timeline';

export { ATT };

// 10-17 유호님 「이 단락 크기를 조금 키워보는건」: 판 css 폭을 520 → 380으로 줄여 2배 남짓으로 키운다(칩 글자 약 29px).
const BW = 380;
const SCALE = (L.W - L.X - L.R - 52) / BW;

const TOP = 640;
// 둘째 칩(주간 99%)의 화면 위 자리 — 렌더 정지컷(10-17)에서 잰 값: 판 안 css 134에서 시작, 폭 222
const CHIP = { x: L.X + 26 + 2 * SCALE, y: TOP + 26 + 134 * SCALE, w: 222 * SCALE, h: 44 * SCALE };

export const Attention: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = spring({ frame: f - ATT.pop, fps, config: { damping: 14, stiffness: 150, mass: 0.8 } });
  const back = interpolate(f, [ATT.back, ATT.back + 10], [0, 1], { ...clamp, easing: EASE_IN_OUT });
  const big = out * (1 - back);
  const fill = ramp(f, ATT.pop + 6, 22);
  const circle = evolvePath(ramp(f, ATT.circle, 14), 'M 30 60 C 30 15, 330 5, 380 50 C 420 95, 120 125, 40 95 C 10 85, 20 40, 60 30');
  return (
    <Paper>
      <Head left="synkbrief 활용" right="05" />
      <Title size={64}>
        급한 것만 <Mark p={ramp(f, 6, 12)}>맨 위에</Mark>
      </Title>
      <Screen top={TOP} height={440}>
        <div style={{ opacity: 1 - 0.88 * big }}>
        <Board width={BW} scale={SCALE}>
          <section className="ms-section" style={{ borderTop: 0, padding: '4px 2px 0' }}>
            <div className="ms-section-heading">
              <span className="ms-section-number">01</span>
              <div>
                <h2>지금 볼 것</h2>
                <p>소진·한도 90% 이상·크레딧 부족·3일 안 결제만 올라와요.</p>
              </div>
            </div>
            <div className="ms-attn" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              {ATTENTION.map((a, i) => {
                const s = spring({ frame: f - ATT.chips[i], fps, config: { damping: 13, stiffness: 200, mass: 0.7 } });
                const lifted = i === 1 ? big : 0;
                return (
                  <button
                    key={i}
                    className={`ms-attn-chip ms-l${a.level}`}
                    style={{ opacity: interpolate(s, [0, 0.4], [0, 1], clamp) * (1 - 0.6 * lifted), translate: `0 ${(1 - s) * -40}px`, scale: String(0.9 + 0.1 * s) }}
                  >
                    <span className="ms-dot" aria-hidden="true" />
                    {a.text}
                  </button>
                );
              })}
            </div>
          </section>
        </Board>
        </div>
      </Screen>
      {/* 칩에서 튀어나온 큰 숫자: 어두워진 판 위 가운데로 */}
      {big > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            left: interpolate(big, [0, 1], [CHIP.x, L.X + 48]),
            top: interpolate(big, [0, 1], [CHIP.y, TOP + 92]),
            transformOrigin: '0 0',
            scale: String(interpolate(big, [0, 1], [0.18, 1])),
            opacity: interpolate(big, [0, 0.25], [0, 1], clamp),
          }}
        >
          <div style={{ font: `900 220px/0.9 ${F.ko}`, letterSpacing: '-.06em', color: C.crayon, fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(99 * fill)}%
          </div>
          <div style={{ marginTop: 18, width: 740, height: 26, borderRadius: 13, background: 'rgba(255,255,255,.16)', overflow: 'hidden' }}>
            <div style={{ width: `${99 * fill}%`, height: '100%', borderRadius: 13, background: C.crayon }} />
          </div>
          <div style={{ marginTop: 18, font: `500 30px/1 ${F.mono}`, color: 'rgba(255,255,255,.72)' }}>founder · Claude 주간 한도</div>
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
      <Caption text="다 써 가는 계정, 모자란 크레딧부터." em="모자란 크레딧부터." at={8} />
    </Paper>
  );
};
