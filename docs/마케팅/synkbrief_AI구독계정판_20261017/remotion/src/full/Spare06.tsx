// 06 여유 있는 계정: 「지금 볼 것」의 고리 카드(서비스마다 지금 가장 여유 있는 계정)가 내려앉으며 앱처럼 고리가 그려지고
// 가운데 숫자는 처음부터 값(앱은 처음 보일 때 숫자를 굴리지만, 굴러가는 동안 셈하듯 다른 숫자가 읽혀 뺐다 — Fable 10-18 P1①). 두 박 뒤 Claude 카드의 「계정 3개 중 가장 여유」에 크레용 동그라미 하나.
// 카드 마크업은 subscriptions.mjs meter() 그대로(휴대폰 폭 배치), 값은 11:45 확인.
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { METERS } from '../data';
import { clamp } from '../lib/anim';
import { L } from '../theme';
import { BoardZ, CaptionF, CrayonRing, FloatCard, HeadF, Lines, MarkF } from '../v5/cine';
import { Gauge, levelOf, WINDOW_NAME } from '../v5/gauge';
import { at, T } from './time';

const BW = 440;
const PAD = 22;
const Z = (L.W - L.X - L.R - 2 * PAD) / BW;
const TOP = 640;
const H = 600;
// 「계정 3개 중 가장 여유」 상자(화면 좌표) — 정지컷 실측
export const SPARE_NOTE = { x: 368, y: 734, w: 214, h: 34 };

export const Spare06: React.FC = () => {
  const f = useCurrentFrame();
  const drift = interpolate(f, [T, at('spare', 46)], [1, 1.02], clamp);
  return (
    <>
      <HeadF left="synkbrief 활용" right="06" />
      <Lines at={T} size={72} top={L.TOP - 8} lines={[<>제일 <MarkF key="m" p={interpolate(f, [at('spare', 40.5), at('spare', 40.5) + 12], [0, 1], clamp)}>여유 있는 계정</MarkF></>]} />
      <div style={{ position: 'absolute', inset: 0, scale: String(drift), transformOrigin: `540px ${TOP + 200}px` }}>
        <FloatCard style={{ left: L.X, top: TOP, width: L.W - L.X - L.R, height: H, padding: `${PAD}px ${PAD}px 0` }}>
          <BoardZ width={BW} scale={Z}>
            <div className="ms-meters" style={{ margin: 0 }}>
              {METERS.map((m) => {
                const rings = ['weekly', 'session'] as const;
                return (
                  <button key={m.svc} type="button" className={`ms-meter ms-s-${m.svc}`}>
                    <Gauge g={m.g} label drawAt={T} />
                    <span className="ms-meter-body">
                      <span className="ms-meter-head">
                        <span className="ms-tag">{m.tag}</span>
                        {m.name ? <strong>{m.name}</strong> : null}
                      </span>
                      {m.note ? <span className="ms-meter-note">{m.note}</span> : null}
                      <span className="ms-legend">
                        {rings
                          .filter((k) => (m.g as Record<string, number | undefined>)[k] !== undefined)
                          .map((k) => {
                            const left = (m.g as Record<string, number>)[k];
                            return (
                              <span key={k} className="ms-legend-row" data-ring={k} data-level={levelOf(left)}>
                                <i aria-hidden="true" />
                                {WINDOW_NAME[k]}
                                <span>
                                  <b className={`ms-num${left <= 10 ? ' ms-warn-text' : ''}`}>{left}%</b> 남음
                                </span>
                              </span>
                            );
                          })}
                      </span>
                      <span className="ms-reset">
                        {m.reset[0]}
                        {m.reset[1] ? <b>{m.reset[1]}</b> : null}
                      </span>
                    </span>
                    <span className="ms-chev" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </BoardZ>
        </FloatCard>
        <CrayonRing id="spare" x={SPARE_NOTE.x} y={SPARE_NOTE.y} w={SPARE_NOTE.w} h={SPARE_NOTE.h} at={at('spare', 42)} padY={12} />
      </div>
      <CaptionF text="지금 쓸 여유 있는 계정까지." em="여유 있는 계정까지." at={T + 2} />
    </>
  );
};
