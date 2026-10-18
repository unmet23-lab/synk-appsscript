// v5 01A 훅: 0프레임부터 제목이 읽히고, 비스듬히 떠 있던 실제 계정판이 펴지며 다가온다. 계정 줄은 「읽는 중」에서 반 박마다 숫자로.
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { ACCOUNTS } from '../data';
import { clamp, ramp } from '../lib/anim';
import { L } from '../theme';
import { HOOK } from '../timeline';
import { BoardZ, FloatCard, HeadF, Lines, MarkF, settle } from './cine';

const BW = 500;
const SCALE = (L.W - L.X - L.R) / BW;

export const Hook5: React.FC = () => {
  const f = useCurrentFrame();
  const flat = settle(f, 2, 9);
  const push = settle(f, HOOK.click, 6);
  const bump = Math.min(...ACCOUNTS.map((_, i) => (f >= HOOK.rows[i] ? interpolate(f, [HOOK.rows[i], HOOK.rows[i] + 6], [1.14, 1], clamp) : 1)));
  return (
    <>
    <HeadF left="synkbrief 활용" right="2026.10.17 · 실제 화면" />
    <div style={{ position: 'absolute', inset: 0, scale: String(1 + 0.045 * push), transformOrigin: '50% 72%' }}>
      <Lines
        visibleAtZero
        at={0}
        size={100}
        top={L.TOP}
        lines={[
          '클릭 한 번,',
          <>
            AI 계정 <span style={{ display: 'inline-block', scale: String(bump), transformOrigin: '50% 75%', fontVariantNumeric: 'tabular-nums' }}>6</span>개
          </>,
          <MarkF key="m" p={ramp(f, HOOK.mark, 12)}>남은 한도</MarkF>,
        ]}
      />
      <div style={{ position: 'absolute', left: L.X, top: 890, width: BW * SCALE, perspective: 1700 }}>
        <FloatCard
          style={{
            position: 'relative',
            padding: 0,
            transformOrigin: '50% 0%',
            transform: `translateY(${(1 - flat) * 120}px) rotateX(${(1 - flat) * 28}deg) rotateZ(${(1 - flat) * -6}deg) scale(${0.9 + 0.1 * flat})`,
          }}
        >
          <BoardZ width={BW} scale={SCALE}>
            <div style={{ padding: '12px 14px 6px' }}>
              <div className="ms-hero" style={{ padding: '11px 16px', borderRadius: 16 }}>
                <div className="ms-hero-note" style={{ borderTop: 0, paddingTop: 0 }}>
                  <span>마지막 확인 11:45 · 6/6개 읽음</span>
                  <div className="ms-hero-actions">
                    <button className="ms-button ms-button-primary">지금 확인</button>
                  </div>
                </div>
              </div>
              <div className="mt-list" style={{ marginTop: 6 }}>
                {ACCOUNTS.map((a, i) => {
                  const at = HOOK.rows[i];
                  const fill = ramp(f, at, 12);
                  return (
                    <div key={i} className={`mt-row ms-s-${a.svc}`} style={{ minHeight: 38 }}>
                      <span className="ms-tag">{a.label}</span>
                      <b>{a.name}</b>
                      {a.weekly !== undefined ? (
                        <>
                          <span className={`ms-bar${a.weekly >= 90 ? ' hot' : ''}`}>
                            <span style={{ width: `${a.weekly * fill}%` }} />
                          </span>
                          <span className="ms-num">주간 {a.weekly}%</span>
                        </>
                      ) : (
                        <span className="ms-num ms-warn-text">크레딧 {a.credits!.toFixed(2)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </BoardZ>
        </FloatCard>
      </div>
    </div>
    </>
  );
};
