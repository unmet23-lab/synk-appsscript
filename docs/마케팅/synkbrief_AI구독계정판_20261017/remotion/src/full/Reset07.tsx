// 07 풀리는 시각(본편 v2): 펼친 Claude 줄(계정마다 요금제 · 남은 % · 주간 초기화)이 보이다가, 조용한 구간이 시작되는 박에
// 화면이 「막혀 있어요」까지 내려가고 첫 막힌 계정의 풀리는 때 줄에 크레용 동그라미 하나. 줄 글은 앱 HTML 그대로.
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
// Claude 줄과 펼친 계정만(포스터·다른 서비스·02·아래 입구는 감춘다)
const CSS = `.sc-reset .ms-back,.sc-reset .ms-hero,.sc-reset .ms-section-heading,.sc-reset .ms-svc:not(.ms-s-claude),.sc-reset .ms-section+.ms-section,.sc-reset .ms-foot{display:none!important}
.sc-reset .ms-section{margin-top:0}`;
const BLOCKED = '.ms-detail .ms-acc-group:nth-child(2)';
// 「막혀 있어요」 첫 줄의 「17:00에 풀려요(39분 뒤)」 글 조각만(앱 detailHtml의 막힌 줄). ms-acc-when 요소 전체를 감싸면
// 감싼 span이 휴대폰 grid(이름 2열 1행 · 글 2~3열 2행)의 자식 자리를 빼앗아 이름 칸이 0폭이 된다(Fable 10-18 v3 P1).
const NEEDLE = /(?<=<h3>막혀 있어요<\/h3><div class="ms-acc"[^>]*>(?:(?!<\/div>).)*?<span class="ms-acc-when">[^<]*)<b>[^<]+<\/b>에 풀려요\([^)]*\)/;

export const Reset07: React.FC = () => {
  const f = useCurrentFrame();
  const base = boardHtml('glance-claude');
  const [boxes, probe] = useBoardBoxes(base, BW, Z, 'sc-reset', CSS, [BLOCKED]);
  const g = boxes?.[BLOCKED];
  const down = settle(f, at('reset', 47.5), 10);
  const scroll = g ? Math.max(0, g.y - 18) * down : 0;
  const drift = interpolate(f, [T, at('reset', 54)], [1, 1.02], clamp);
  // 붓 모양은 상자 안쪽 7%쯤에서 글 높이를 지나므로 가로 여백을 넉넉히(14면 「뒤)」를 지났다), 세로는 아래 줄에 닿지 않게 3(8이면 5px 지났다).
  const html = ringAround(base, NEEDLE, ramp(f, at('reset', 50), 14), 'reset', { x: 30, y: 3 });
  return (
    <>
      {probe}
      <HeadF left="synkbrief 활용" right="07" />
      <Lines at={T} size={72} top={L.TOP - 8} lines={[<>언제 풀리는지 <MarkF key="m" p={interpolate(f, [at('reset', 46.5), at('reset', 46.5) + 12], [0, 1], clamp)}>시간까지</MarkF></>]} />
      <div style={{ position: 'absolute', inset: 0, scale: String(drift), transformOrigin: '540px 940px' }}>
        <FloatCard style={{ left: L.X, top: TOP, width: L.W - L.X - L.R, height: H, padding: `${PAD}px ${PAD}px 0` }}>
          <div style={{ translate: `0 ${-scroll}px` }}>
            <AppBoard html={html} width={BW} scale={Z} cls="sc-reset" css={CSS} />
          </div>
        </FloatCard>
      </div>
      <CaptionF text="다 쓴 계정도 언제 풀리는지 바로." em="언제 풀리는지" at={T + 2} />
    </>
  );
};
