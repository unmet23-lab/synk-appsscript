// 09 흔한 오해 → 공식 프로그램: 조용한 구간에 「토큰 복사?」가 먼저, 두 박 뒤 「필요 없어요」. 연결 카드 넷은 처음부터
// 어둡게 깔려 있다가 64박 드롭부터 한 박씩 켜진다(불투명도만). 카드 글은 connectSection 그대로(11:45 공식 프로그램 넷).
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { CONNECTS } from '../data';
import { clamp, ramp } from '../lib/anim';
import { C, F, L } from '../theme';
import { BoardZ, CaptionF, FloatCard, HeadF, MarkF, settle } from '../v5/cine';
import { at, T } from './time';

const BW = 580;
const PAD = 20;
const Z = (L.W - L.X - L.R - 2 * PAD) / BW;
const TOP = 640;
export const LIGHT = [64, 65, 66, 67];

const Mask: React.FC<{ p: number; children: React.ReactNode }> = ({ p, children }) => (
  <span style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: '.12em', marginBottom: '-.12em', verticalAlign: 'top' }}>
    <span style={{ display: 'inline-block', translate: `0 ${(1 - p) * 105}%` }}>{children}</span>
  </span>
);

export const Official09: React.FC = () => {
  const f = useCurrentFrame();
  const push = interpolate(f, [at('official', 64), at('official', 72)], [1, 1.03], clamp);
  return (
    <>
      <HeadF left="synkbrief 활용" right="09 · 흔한 오해" />
      <div style={{ position: 'absolute', left: L.X, right: L.R, top: L.TOP - 8, color: C.onField, font: `800 72px/1.12 ${F.ko}`, letterSpacing: '-.045em', whiteSpace: 'nowrap' }}>
        <Mask p={settle(f, T, 16)}>토큰 복사?</Mask>{' '}
        <Mask p={settle(f, at('official', 62), 16)}>
          <MarkF p={ramp(f, at('official', 62.5), 12)}>필요 없어요</MarkF>
        </Mask>
      </div>
      <div style={{ position: 'absolute', inset: 0, scale: String(push), transformOrigin: `540px 1150px` }}>
        <FloatCard style={{ left: L.X, top: TOP, width: L.W - L.X - L.R, padding: PAD }}>
          <BoardZ width={BW} scale={Z}>
            <div className="ms-connects">
              {CONNECTS.map((c, i) => {
                const on = interpolate(f, [at('official', LIGHT[i]), at('official', LIGHT[i]) + 6], [0, 1], clamp);
                return (
                  <div key={c.svc} className={`ms-connect ms-s-${c.svc}`} style={{ opacity: 0.3 + 0.7 * on }}>
                    <div>
                      <span className="ms-tag">{c.tag}</span>
                      <span className="ms-chip ms-chip-ok">설치됨</span>
                    </div>
                    <p>
                      {c.tool} · 연결한 계정 {c.count}개
                      <br />
                      <span className="ms-soft ms-num">{c.version}</span>
                    </p>
                    <button type="button" className="ms-button">
                      계정 더 연결
                    </button>
                  </div>
                );
              })}
            </div>
          </BoardZ>
        </FloatCard>
      </div>
      <CaptionF text="각 서비스 공식 프로그램이 알려 준 숫자만." em="공식 프로그램이" at={at('official', 66) + 2} />
    </>
  );
};
