// 06 여유 있는 계정(본편 v2): 서비스마다 「추천」 계정 하나(덜 남은 쪽이 가장 많이 남은 계정, 같으면 큰 요금제)와 고리.
// 판이 내려앉으며 앱처럼 고리가 그려지고(숫자는 처음부터 값), 두 박 뒤 Claude 줄의 추천 계정에 크레용 동그라미 하나. 줄 글은 앱 HTML 그대로.
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { AppBoard, boardHtml, drawArcs, ringAround } from '../app/board';
import { clamp, ramp } from '../lib/anim';
import { L } from '../theme';
import { CaptionF, FloatCard, HeadF, Lines, MarkF } from '../v5/cine';
import { at, T } from './time';

const BW = 460;
const PAD = 22;
const Z = (L.W - L.X - L.R - 2 * PAD) / BW;
const TOP = 640;
const H = 600;
// 동그라미를 감싼 span은 글 폭만(.ms-pick이 flex column이라 열 폭으로 늘어나 오른쪽 호가 글 끝보다 220px 더 갔다 — Fable v3 P3①).
const CSS = `.sc-spare .ms-back,.sc-spare .ms-hero,.sc-spare .ms-section-heading,.sc-spare .ms-section+.ms-section,.sc-spare .ms-foot{display:none!important}
.sc-spare .ms-section{margin-top:0}
.sc-spare .ms-pick .mt-mark{align-self:flex-start}`;
// Claude 줄의 추천 계정 이름과 요금제(첫 번째 ms-pick-name)
const NEEDLE = /<span class="ms-pick-name"><span>[^<]+<\/span>(?:<small>[^<]*<\/small>)?<\/span>/;

export const Spare06: React.FC = () => {
  const f = useCurrentFrame();
  const drift = interpolate(f, [T, at('spare', 46)], [1, 1.02], clamp);
  const html = ringAround(drawArcs(boardHtml('glance'), ramp(f, T, 27)), NEEDLE, ramp(f, at('spare', 42), 14), 'spare', { x: 30, y: 12 });
  return (
    <>
      <HeadF left="synkbrief 활용" right="06" />
      <Lines at={T} size={72} top={L.TOP - 8} lines={[<>제일 <MarkF key="m" p={interpolate(f, [at('spare', 40.5), at('spare', 40.5) + 12], [0, 1], clamp)}>여유 있는 계정</MarkF></>]} />
      <div style={{ position: 'absolute', inset: 0, scale: String(drift), transformOrigin: `540px ${TOP + 200}px` }}>
        <FloatCard style={{ left: L.X, top: TOP, width: L.W - L.X - L.R, height: H, padding: `${PAD}px ${PAD}px 0` }}>
          <AppBoard html={html} width={BW} scale={Z} cls="sc-spare" css={CSS} />
        </FloatCard>
      </div>
      <CaptionF text="지금 쓸 여유 있는 계정까지." em="여유 있는 계정까지." at={T + 2} />
    </>
  );
};
