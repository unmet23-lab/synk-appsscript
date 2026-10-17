// 04 지금 확인: 흰 종이 위 실제 화면 판. 단추를 누르면 계정 칩이 박자마다 「읽음」으로 바뀌고, 제목 옆 숫자가 0/6 → 6/6.
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ACCOUNTS, CHECK } from '../data';
import { clamp, ramp } from '../lib/anim';
import { Board, Caption, Cursor, Head, Mark, Paper, Screen, Title } from '../parts';
import { C, F, L } from '../theme';

export const CHECK_T = { click: 20, first: 30, gap: 9, len: 120 };

const BW = 520;
const SCALE = (L.W - L.X - L.R - 52) / BW;

export const Check: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const doneAt = (i: number) => CHECK_T.first + i * CHECK_T.gap;
  const done = ACCOUNTS.filter((_, i) => f >= doneAt(i)).length;
  const reading = f >= CHECK_T.click + 1 && done < ACCOUNTS.length;
  const finished = done === ACCOUNTS.length;
  const endAt = doneAt(ACCOUNTS.length - 1);
  const slam = spring({ frame: f - endAt, fps, config: { damping: 12, stiffness: 220, mass: 0.6 } });
  const punch = interpolate(f, [CHECK_T.click, CHECK_T.click + 4, CHECK_T.click + 16], [0, 0.035, 0], clamp);
  const push = interpolate(f, [0, CHECK_T.len], [1, 1.035], clamp) + punch;
  return (
    <Paper>
      <div style={{ position: 'absolute', inset: 0, scale: String(push), transformOrigin: '50% 45%' }}>
        <Head left="synkbrief 활용" right="04" />
        <Title size={64}>
          <Mark p={ramp(f, 6, 12)}>지금 확인</Mark> 한 번
        </Title>
        <div
          style={{
            position: 'absolute',
            right: L.R,
            top: L.TOP - 6,
            font: `500 72px/1 ${F.mono}`,
            letterSpacing: '-.04em',
            color: finished ? C.acc : C.muted,
            fontVariantNumeric: 'tabular-nums',
            scale: String(finished ? 1 + 0.25 * (1 - slam) : 1),
            transformOrigin: '100% 50%',
          }}
        >
          {done}/{CHECK.total}
        </div>
        <Screen top={650} height={560} stamp="2026.10.17 · 실제 화면">
          <Board width={BW} scale={SCALE}>
            <div className="ms-hero" style={{ padding: '16px 18px 14px' }}>
              <span className="ms-eyebrow">SYNK FOR YOU / AI 구독 계정판</span>
              <div className="ms-hero-note" style={{ marginTop: 14 }}>
                <span>{reading ? '공식 프로그램으로 읽는 중이에요…' : finished ? `마지막 확인 ${CHECK.at} · 6/6개 읽음` : '연결한 계정 6개'}</span>
                <div className="ms-hero-actions">
                  <button className="ms-button ms-button-primary" style={{ opacity: reading ? 0.7 : 1 }}>{reading ? '확인 중…' : '지금 확인'}</button>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              {ACCOUNTS.map((a, i) => {
                const ok = f >= doneAt(i);
                const live = reading && !ok;
                const pop = ok ? interpolate(f, [doneAt(i), doneAt(i) + 6], [1.08, 1], clamp) : 1;
                const pulse = live ? 0.55 + 0.45 * Math.abs(Math.sin((f - CHECK_T.click) / 4 + i)) : 1;
                return (
                  <div key={i} className={`mt-chip ms-s-${a.svc}`} style={{ scale: String(pop), borderColor: ok ? 'color-mix(in srgb,var(--ms-ok) 55%,transparent)' : undefined }}>
                    <span className="ms-tag">{a.label}</span>
                    <span>{a.name}</span>
                    <span className="st" style={{ color: ok ? 'var(--ms-ok)' : 'var(--ink-3)', opacity: pulse }}>{ok ? '✓ 읽음' : live ? '읽는 중' : '대기'}</span>
                  </div>
                );
              })}
            </div>
          </Board>
        </Screen>
        <div
          style={{
            position: 'absolute',
            left: L.X,
            top: 1222,
            font: `500 30px/1 ${F.mono}`,
            color: C.muted,
            opacity: interpolate(slam, [0, 0.5], [0, 1], clamp),
            translate: `0 ${(1 - slam) * 16}px`,
          }}
        >
          {finished ? `계정 ${CHECK.total}개 · ${CHECK.seconds}초` : ''}
        </div>
        <Cursor path={[[2, 1000, 1500], [16, 820, 838], [26, 820, 838], [36, 980, 1100]]} click={CHECK_T.click} hideAfter={34} />
      </div>
      <Caption text="한 번이면 계정 6개를 다 읽어요." em="계정 6개를" at={8} />
    </Paper>
  );
};
