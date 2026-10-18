// 09 흔한 오해 → 공식 프로그램(본편 v2): 조용한 구간에 「토큰 복사?」가 먼저, 두 박 뒤 「필요 없어요」. 계정 관리의 서비스 블록 머리
// (공식 프로그램 이름·판 · 연결 단추)가 처음부터 어둡게 깔려 있다가 64박 드롭부터 한 박씩 켜진다(불투명도만). 글은 앱 HTML 그대로.
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { AppBoard, boardHtml } from '../app/board';
import { clamp, ramp } from '../lib/anim';
import { C, F, L } from '../theme';
import { CaptionF, FloatCard, HeadF, MarkF, settle } from '../v5/cine';
import { at, T } from './time';

const BW = 480;
const PAD = 22;
const Z = (L.W - L.X - L.R - 2 * PAD) / BW;
const TOP = 640;
export const LIGHT = [64, 65, 66, 67];
// 계정 관리 01의 서비스 블록 머리만(계정 줄·제목·다른 구획은 감춘다). Typecast 블록도 감춘다: Typecast는 API 키를 붙여 넣는 연결이라
// 「토큰 복사? 필요 없어요」 아래에 두면 그 자리에서 모순이다(Fable 10-18 「Typecast 카드를 09에 넣지 말 것」). 공식 프로그램 넷만 켠다.
const CSS = `.sc-off .ms-back,.sc-off .ms-mtitle,.sc-off .ms-section-heading,.sc-off .ms-mrow,.sc-off .ms-mempty,.sc-off .ms-section+.ms-section,.sc-off .ms-s-typecast{display:none!important}
.sc-off .ms-mtitle+.ms-section{margin-top:0}`;

const Mask: React.FC<{ p: number; children: React.ReactNode }> = ({ p, children }) => (
  <span style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: '.12em', marginBottom: '-.12em', verticalAlign: 'top' }}>
    <span style={{ display: 'inline-block', translate: `0 ${(1 - p) * 105}%` }}>{children}</span>
  </span>
);

export const Official09: React.FC = () => {
  const f = useCurrentFrame();
  const push = interpolate(f, [at('official', 64), at('official', 72)], [1, 1.03], clamp);
  const lights = LIGHT.map((b, i) => `.sc-off .ms-mblock:nth-child(${i + 1}){opacity:${(0.3 + 0.7 * interpolate(f, [at('official', b), at('official', b) + 6], [0, 1], clamp)).toFixed(3)}}`).join('\n');
  return (
    <>
      <HeadF left="synkbrief 활용" right="09 · 흔한 오해" />
      <div style={{ position: 'absolute', left: L.X, right: L.R, top: L.TOP - 8, color: C.onField, font: `800 72px/1.12 ${F.ko}`, letterSpacing: '-.045em', whiteSpace: 'nowrap' }}>
        {/* 「토큰」은 이 영상에서 사용량 뜻으로도 쓰여(02 「남은 토큰」), 로그인용은 「인증 토큰」으로 가른다(v4) */}
        <Mask p={settle(f, T, 16)}>인증 토큰 복사?</Mask>{' '}
        <Mask p={settle(f, at('official', 62), 16)}>
          <MarkF p={ramp(f, at('official', 62.5), 12)}>필요 없어요</MarkF>
        </Mask>
      </div>
      <div style={{ position: 'absolute', inset: 0, scale: String(push), transformOrigin: `540px 1150px` }}>
        <FloatCard style={{ left: L.X, top: TOP, width: L.W - L.X - L.R, padding: PAD }}>
          <AppBoard html={boardHtml('manage')} width={BW} scale={Z} cls="sc-off" css={`${CSS}\n${lights}`} />
        </FloatCard>
      </div>
      {/* 내레이션 「각 서비스 공식 프로그램이」(31.2초)와 같이 뜨게 64박에(66박이면 말보다 1.2초 늦다) */}
      <CaptionF text="각 서비스 공식 프로그램이 알려 준 숫자만." em="공식 프로그램이" at={at('official', 64) + 2} />
    </>
  );
};
