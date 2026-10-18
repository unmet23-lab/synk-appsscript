// 08 앞으로 7일(본편 v2): 「02 다음에 풀려요」(다 쓴 계정이 풀리는 가까운 셋)가 내려앉고, 박에 「앞으로 7일 일정 N개 모두 보기」가 눌려
// 그 자리에서 펼쳐진다 — 풀리는 때와 쓸 수 있는 계정의 주간 초기화(흐린 줄)가 날짜순으로 반 박씩 하나씩(위치·불투명도만). 글은 앱 HTML 그대로.
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { AppBoard, boardHtml, staggerCss, useBoardBoxes } from '../app/board';
import { clamp, EASE_IN_OUT } from '../lib/anim';
import { L } from '../theme';
import { CaptionF, FloatCard, HeadF, Lines, MarkF, settle } from '../v5/cine';
import { at, T } from './time';

const BW = 460;
const PAD = 22;
const Z = (L.W - L.X - L.R - 2 * PAD) / BW;
const TOP = 640;
const H = 600;
// 02 구획만(포스터·01·아래 입구는 감춘다)
const CSS = `.sc-week .ms-back,.sc-week .ms-hero,.sc-week .ms-section:first-of-type,.sc-week .ms-foot{display:none!important}
.sc-week .ms-section{margin-top:0}`;

export const Week08: React.FC = () => {
  const f = useCurrentFrame();
  const open = at('week', 54.5);
  const opened = f >= open;
  const drift = interpolate(f, [T, at('week', 60)], [1, 1.03], clamp);
  // 펼친 뒤: 앞 셋은 그대로, 넷째부터 반 박씩
  const half = (at('week', 55) - at('week', 54)) ;
  const ps = Array.from({ length: 16 }, (_, i) => (i < 3 ? 1 : settle(f, open + (i - 2) * half * 0.5, 16)));
  const css = opened ? `${CSS}\n${staggerCss('.sc-week .ms-next-item', ps)}` : CSS;
  // 펼친 목록이 판 아래로 넘치는 만큼, 줄이 나타나는 동안 천천히 올린다(끝 줄까지 보이게).
  const [boxes, probe] = useBoardBoxes(boardHtml('glance-more'), BW, Z, 'sc-week', CSS, ['.ms-next']);
  const list = boxes?.['.ms-next'];
  const over = list ? Math.max(0, list.y + list.h - (H - PAD) + 18) : 0;
  const scroll = opened ? over * interpolate(f, [open + half, at('week', 59)], [0, 1], { ...clamp, easing: EASE_IN_OUT }) : 0;
  return (
    <>
      {probe}
      <HeadF left="synkbrief 활용" right="08" />
      <Lines at={T} size={72} top={L.TOP - 8} lines={[<>앞으로 <MarkF key="m" p={interpolate(f, [open, open + 12], [0, 1], clamp)}>7일 한눈에</MarkF></>]} />
      <div style={{ position: 'absolute', inset: 0, scale: String(drift), transformOrigin: `540px ${TOP + 280}px` }}>
        <FloatCard style={{ left: L.X, top: TOP, width: L.W - L.X - L.R, height: H, padding: `${PAD}px ${PAD}px 0` }}>
          <div style={{ translate: `0 ${-scroll}px` }}>
            <AppBoard html={boardHtml(opened ? 'glance-more' : 'glance')} width={BW} scale={Z} cls="sc-week" css={css} />
          </div>
        </FloatCard>
      </div>
      <CaptionF text="초기화 전에 쓰게, 날짜순으로." em="초기화 전에" at={T + 2} />
    </>
  );
};
