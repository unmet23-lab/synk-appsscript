// v5 04 지금 확인: 단추에 바짝 다가간 채 커서가 곡선으로 와서 누르고, 화면이 물러나며 계정 줄을 하나씩 읽는다(지금 읽는 줄만 밝게,
// 진행 막대가 찬다). 다시 터지는 박에 6/6이 찍히고 한 박 머문다.
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { ACCOUNTS, CHECK } from '../data';
import { clamp, ramp } from '../lib/anim';
import { C, F, L } from '../theme';
import { CHK } from '../timeline';
import { BoardZ, CaptionF, CursorArc, FloatCard, HeadF, Lines, MarkF, settle } from './cine';
import { leftPercent, LeftText, MiniGauge } from './gauge';

const BW = 500;
const SCALE = (L.W - L.X - L.R) / BW;
const TOP = 640;
// 「지금 확인」 단추 가운데(줌 전 화면 좌표) — 10-18 실측: 안내 문장 줄 아래 둘째 줄 왼쪽(단추 둘, Fable 10-18 P2④)
export const BTN = { x: 215, y: 816 };

type Timing = { click: number; done: number[]; len: number };

export const Check5: React.FC<{ t?: Timing; label?: string }> = ({ t = CHK, label = '04' }) => {
  const f = useCurrentFrame();
  const done = ACCOUNTS.filter((_, i) => f >= t.done[i]).length;
  const reading = f >= t.click + 1 && done < ACCOUNTS.length;
  const finished = done === ACCOUNTS.length;
  const endAt = t.done[ACCOUNTS.length - 1];
  // 카메라: 단추 쪽에 1.25배로 붙어 있다가 누른 뒤 물러나고, 6/6에서 살짝 다가가 머문다(원점 y 720은 카드 위끝을 제목 아래에 두려고)
  const pull = settle(f, t.click + 2, 8);
  const hold = settle(f, endAt, 10);
  const zoom = 1.25 - 0.25 * pull + 0.03 * hold;
  // 시작 원점 x 525(Fable v5c): 클로즈업에서 앱 문구 첫 글자가 왼쪽 밖으로 잘리지 않게(문장 x 40부터). 단추 둘은 둘째 줄 왼쪽(10-18)
  const ox = interpolate(pull, [0, 1], [525, 540]);
  const oy = interpolate(pull, [0, 1], [720, 960]);
  const slam = settle(f, endAt, 18);
  return (
    <>
      <HeadF left="synkbrief 활용" right={label} />
        <Lines at={2} size={72} top={L.TOP - 8} lines={[<MarkF key="m" p={ramp(f, 8, 12)}>지금 확인</MarkF>]} />
        <div
          style={{
            position: 'absolute',
            right: L.R,
            top: L.TOP - 4,
            font: `500 76px/1 ${F.mono}`,
            letterSpacing: '-.04em',
            color: finished ? C.markField : 'rgba(255,255,255,.62)',
            fontVariantNumeric: 'tabular-nums',
            scale: String(finished ? 1.3 - 0.3 * slam : 1),
            transformOrigin: '100% 50%',
          }}
        >
          {done}/{CHECK.total}
        </div>
      <div style={{ position: 'absolute', inset: 0, scale: String(zoom), transformOrigin: `${ox}px ${oy}px` }}>
        <FloatCard style={{ left: L.X, top: TOP, width: BW * SCALE }} stamp="실제 화면 · 2026.10.17">
          <BoardZ width={BW} scale={SCALE}>
            <div style={{ padding: '38px 14px 10px' }}>
              <div className="ms-hero has-art" style={{ padding: '16px 18px 14px', borderRadius: 16 }}>
                <div className="ms-hero-note" style={{ borderTop: 0, paddingTop: 0, rowGap: 10 }}>
                  <span style={{ flex: '1 0 100%' }}>{reading ? '공식 프로그램으로 읽는 중이에요…' : finished ? `마지막 확인 ${CHECK.at} · 6/6개 읽음` : '「지금 확인」을 누르면 연결한 계정을 한꺼번에 읽어요.'}</span>
                  <div className="ms-hero-actions">
                    {/* 읽는 동안은 앱처럼 disabled(앱 css .ms-button:disabled 투명도 .45) */}
                    <button className="ms-button ms-button-primary" disabled={reading} style={{ scale: String(interpolate(f, [t.click - 1, t.click + 1, t.click + 6], [1, 0.94, 1], clamp)) }}>
                      {reading ? '확인 중…' : '지금 확인'}
                    </button>
                    <button className="ms-button">계정 연결</button>
                  </div>
                </div>
              </div>
              <div className="mt-list" style={{ marginTop: 8 }}>
                {ACCOUNTS.map((a, i) => {
                  const ok = f >= t.done[i];
                  const current = reading && i === done;
                  const shown = ok ? interpolate(f, [t.done[i], t.done[i] + 6], [0, 1], clamp) : 0; // 값은 읽히는 순간 생긴다
                  const lit = ok ? interpolate(f, [t.done[i], t.done[i] + 6], [0.5, 1], clamp) : reading || current ? 0.5 : 1;
                  return (
                    <div
                      key={i}
                      className={`mt-row ms-s-${a.svc}`}
                      style={{
                        minHeight: 36,
                        padding: '5px 8px',
                        margin: '0 -8px',
                        borderRadius: 10,
                        background: current ? 'rgba(255,255,255,.07)' : 'transparent',
                        opacity: current ? 0.8 : lit,
                      }}
                    >
                      <span className="ms-tag">{a.label}</span>
                      <b>{a.name}</b>
                      {a.weekly !== undefined ? (
                        <span className="mt-left">
                          {/* 읽기 전엔 고리 바닥만, 읽히는 순간 앱 곡선으로 고리가 차고 값이 생긴다 */}
                          <MiniGauge left={leftPercent(a.weekly)} drawAt={t.done[i]} />
                          <span style={{ opacity: shown }}>
                            주간&nbsp;<LeftText left={leftPercent(a.weekly)} />
                          </span>
                        </span>
                      ) : (
                        <span className="mt-left ms-warn-text" style={{ opacity: shown }}>
                          크레딧&nbsp;<b className="ms-num">{a.credits!.toFixed(2)}</b>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </BoardZ>
        </FloatCard>
        <CursorArc from={[990, 1480]} to={[BTN.x, BTN.y]} start={1} arrive={t.click - 5} click={t.click} leave={t.click + 8} />
      </div>
      <div
        style={{
          position: 'absolute',
          right: L.R,
          top: L.TOP + 80,
          font: `500 28px/1 ${F.mono}`,
          color: 'rgba(255,255,255,.78)',
          opacity: interpolate(slam, [0, 0.4], [0, 1], clamp),
          translate: `0 ${(1 - slam) * 14}px`,
        }}
      >
        {finished ? `계정 ${CHECK.total}개 · ${CHECK.seconds}초` : ''}
      </div>
      <CaptionF text="한 번이면 계정 6개를 다 읽어요." em="계정 6개를" at={t.click + 10} />
    </>
  );
};
