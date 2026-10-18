// 08 앞으로 7일: 「앞으로 7일」 구획이 내려앉고 날짜 줄이 박마다 하나씩(위치·불투명도만). 글은 agendaSection 그대로.
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { AGENDA } from '../data';
import { clamp } from '../lib/anim';
import { L } from '../theme';
import { BoardZ, CaptionF, FloatCard, HeadF, Lines, MarkF, settle } from '../v5/cine';
import { at, T } from './time';

const BW = 440;
const PAD = 22;
const Z = (L.W - L.X - L.R - 2 * PAD) / BW;
const TOP = 640;

export const Week08: React.FC = () => {
  const f = useCurrentFrame();
  const drift = interpolate(f, [T, at('week', 60)], [1, 1.03], clamp);
  const dayAt = [T, at('week', 54.5), at('week', 55)];
  return (
    <>
      <HeadF left="synkbrief 활용" right="08" />
      <Lines at={T} size={72} top={L.TOP - 8} lines={[<>앞으로 <MarkF key="m" p={interpolate(f, [at('week', 54.5), at('week', 54.5) + 12], [0, 1], clamp)}>7일 한눈에</MarkF></>]} />
      <div style={{ position: 'absolute', inset: 0, scale: String(drift), transformOrigin: `540px ${TOP + 280}px` }}>
        <FloatCard style={{ left: L.X, top: TOP, width: L.W - L.X - L.R, padding: `18px ${PAD}px ${PAD}px` }}>
          <BoardZ width={BW} scale={Z}>
            <section className="ms-section" style={{ borderTop: 0, padding: '4px 2px 0' }}>
              <div className="ms-section-heading" style={{ marginBottom: 16 }}>
                <span className="ms-section-number">03</span>
                <div>
                  <h2>앞으로 7일</h2>
                  <p>주간 초기화와 결제일을 날짜별로 모았어요.</p>
                </div>
              </div>
              <div className="ms-agenda">
                {AGENDA.map((d, i) => {
                  const s = i === 0 ? 1 : settle(f, dayAt[i], 16);
                  return (
                    <div key={d.day} className="ms-day" style={{ opacity: interpolate(s, [0, 0.5], [0, 1], clamp), translate: `0 ${(1 - s) * 18}px` }}>
                      <strong>{d.day}</strong>
                      <div>
                        {d.items.map((it) => (
                          <div key={it.time + it.what} className={`ms-day-item ms-s-${it.svc}`}>
                            <span className="ms-num">{it.time}</span>
                            <span className="ms-tag">{it.tag}</span>
                            <span>{it.what}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </BoardZ>
        </FloatCard>
      </div>
      <CaptionF text="초기화와 결제일까지 날짜별로." em="결제일까지" at={T + 2} />
    </>
  );
};
