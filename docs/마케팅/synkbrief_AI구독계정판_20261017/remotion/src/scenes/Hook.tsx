// 01A 훅(결과 먼저): 0프레임에 제목이 읽히고, 실제 계정판의 「지금 확인」을 누르면 계정 여섯 줄이 박자마다 쏟아진다.
import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { ACCOUNTS } from '../data';
import { clamp, ramp } from '../lib/anim';
import { Board, Cursor, Field, Head, Mark, Title } from '../parts';
import { L } from '../theme';

export const HOOK = { click: 30, rows: 36, rowGap: 7, mark: 84, len: 108 };

const BW = 540; // 계정판 css 폭(휴대폰 폭)
const SCALE = (L.W - L.X - L.R) / BW; // = 1.548

export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reading = f >= HOOK.click + 2 && f < HOOK.rows + HOOK.rowGap * 6 + 4;
  const shown = ACCOUNTS.filter((_, i) => f >= HOOK.rows + i * HOOK.rowGap).length;
  const cardIn = spring({ frame: f - 4, fps, config: { damping: 16, stiffness: 130 } });
  const bump = (i: number) => interpolate(f, [HOOK.rows + i * HOOK.rowGap, HOOK.rows + i * HOOK.rowGap + 6], [1.18, 1], clamp);
  const lastBump = Math.min(...ACCOUNTS.map((_, i) => (f >= HOOK.rows + i * HOOK.rowGap ? bump(i) : 1)));
  const punch = interpolate(f, [HOOK.click, HOOK.click + 4, HOOK.click + 16], [0, 0.04, 0], clamp);
  return (
    <Field>
      <Head left="synkbrief 활용" right="2026.10.17 · 실제 화면" onField />
      <Title size={108} onField>
        클릭 한 번,
        <br />
        AI 계정{' '}
        <span style={{ display: 'inline-block', scale: String(lastBump), transformOrigin: '50% 70%', fontVariantNumeric: 'tabular-nums' }}>6</span>개
        <br />
        <Mark p={ramp(f, HOOK.mark, 12)} onField>
          남은 한도
        </Mark>
      </Title>
      <div style={{ position: 'absolute', left: L.X, top: 925, scale: String(1 + punch), transformOrigin: '85% 10%', translate: `0 ${(1 - cardIn) * 120}px`, opacity: interpolate(cardIn, [0, 0.4], [0, 1], clamp) }}>
        <Board width={BW} scale={SCALE}>
          <div style={{ background: '#0c0d11', borderRadius: 22, padding: '12px 14px 6px', boxShadow: '0 24px 50px -24px rgba(0,0,0,.6)' }}>
            <div className="ms-hero" style={{ padding: '12px 16px', borderRadius: 16 }}>
              <div className="ms-hero-note" style={{ borderTop: 0, paddingTop: 0 }}>
                <span>{reading ? '공식 프로그램으로 읽는 중이에요…' : f > HOOK.click ? `마지막 확인 11:45 · ${shown}/6개 읽음` : '연결한 계정 6개'}</span>
                <div className="ms-hero-actions">
                  <button className="ms-button ms-button-primary" style={{ minHeight: 38, padding: '6px 16px', opacity: reading ? 0.7 : 1 }}>
                    {reading ? '확인 중…' : '지금 확인'}
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-list" style={{ marginTop: 6 }}>
              {ACCOUNTS.map((a, i) => {
                const at = HOOK.rows + i * HOOK.rowGap;
                const s = spring({ frame: f - at, fps, config: { damping: 15, stiffness: 190, mass: 0.7 } });
                const fill = ramp(f, at + 2, 14);
                if (f < at) return <div key={i} className="mt-row" style={{ visibility: 'hidden' }}><span className="ms-tag">.</span></div>;
                return (
                  <div key={i} className={`mt-row ms-s-${a.svc}`} style={{ opacity: interpolate(s, [0, 0.5], [0, 1], clamp), translate: `0 ${(1 - s) * -18}px`, scale: String(0.96 + 0.04 * s) }}>
                    <span className="ms-tag">{a.label}</span>
                    <b>{a.name}</b>
                    {a.weekly !== undefined ? (
                      <>
                        <span className={`ms-bar${a.weekly >= 90 ? ' hot' : ''}`}>
                          <span style={{ width: `${a.weekly * fill}%` }} />
                        </span>
                        <span className="ms-num">주간 {Math.round(a.weekly * fill)}%</span>
                      </>
                    ) : (
                      <span className="ms-num ms-warn-text">크레딧 {(a.credits! * fill).toFixed(2)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Board>
      </div>
      <Cursor path={[[10, 980, 1500], [26, 838, 1004], [44, 838, 1004], [54, 1000, 1180]]} click={HOOK.click} hideAfter={50} />
    </Field>
  );
};
