// 10 연결 가이드(본편 v2): 계정 관리의 Gemini 블록에서 가이드가 그 자리에 펼쳐진 화면(1·2단계 ✓)이 보이다가 로그인 단계까지
// 내려가고, 브레이크(76박)에 「이 PC의 기존 로그인 쓰기」에 크레용 동그라미 하나. 글은 앱 HTML 그대로(guide('gemini'), 설치됨·로그인 전).
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { AppBoard, boardHtml, ringAround, useBoardBoxes } from '../app/board';
import { clamp, ramp } from '../lib/anim';
import { L } from '../theme';
import { CaptionF, FloatCard, HeadF, Lines, MarkF, settle } from '../v5/cine';
import { at, T } from './time';

const BW = 440;
const PAD = 22;
const Z = (L.W - L.X - L.R - 2 * PAD) / BW;
const TOP = 640;
const H = 600;
// Gemini 블록만(다른 블록·제목·다른 구획은 감춘다)
const CSS = `.sc-guide .ms-back,.sc-guide .ms-mtitle,.sc-guide .ms-section-heading,.sc-guide .ms-mblock:not(.ms-s-gemini),.sc-guide .ms-section+.ms-section{display:none!important}
.sc-guide .ms-mtitle+.ms-section{margin-top:0}`;
const STEP3 = '.ms-s-gemini .ms-step:nth-child(3)';
const NEEDLE = /<button type="button" class="ms-button" data-subs="existing" data-service="gemini"[^>]*>[^<]*<\/button>/;

export const Guide10: React.FC = () => {
  const f = useCurrentFrame();
  const base = boardHtml('manage-gemini');
  const [boxes, probe] = useBoardBoxes(base, BW, Z, 'sc-guide', CSS, [STEP3]);
  const s3 = boxes?.[STEP3];
  const down = settle(f, at('guide', 73), 9);
  // 3단계 경계선이 판 위끝에 오게(−24면 2단계 마지막 줄이 위끝에 반 잘려 걸렸다 — Fable v3 P3②)
  const scroll = s3 ? Math.max(0, s3.y - 2) * down : 0;
  const drift = interpolate(f, [T, at('guide', 80)], [1, 1.02], clamp);
  const html = ringAround(base, NEEDLE, ramp(f, at('guide', 76), 14), 'guide', { x: 16, y: 12 });
  return (
    <>
      {probe}
      <HeadF left="synkbrief 활용" right="10" />
      <Lines at={T} size={72} top={L.TOP - 8} lines={[<>처음이면 <MarkF key="m" p={interpolate(f, [at('guide', 72.5), at('guide', 72.5) + 12], [0, 1], clamp)}>가이드대로</MarkF></>]} />
      <div style={{ position: 'absolute', inset: 0, scale: String(drift), transformOrigin: '540px 940px' }}>
        <FloatCard style={{ left: L.X, top: TOP, width: L.W - L.X - L.R, height: H, padding: `${PAD}px ${PAD}px 0` }}>
          <div style={{ translate: `0 ${-scroll}px` }}>
            <AppBoard html={html} width={BW} scale={Z} cls="sc-guide" css={CSS} />
          </div>
        </FloatCard>
      </div>
      <CaptionF text="같은 앱이어도 내 계정 숫자가 나와요." em="내 계정 숫자가" at={T + 2} />
    </>
  );
};
