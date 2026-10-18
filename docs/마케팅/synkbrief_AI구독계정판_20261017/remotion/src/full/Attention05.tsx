// 05 다 쓴 것·모자란 것(본편 v2): 한눈에 보기의 서비스 줄은 점과 개수 글로 상태를 말한다(초록 바로 써요 · 노랑 부족 · 빈 원 다 씀).
// 판이 내려앉고, 드럼이 터지는 박에 Higgsfield 줄로 다가가 「2개 부족」에 크레용 동그라미 하나. 줄 글은 앱 HTML 그대로.
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { AppBoard, boardHtml, ringAround, useBoardBoxes } from '../app/board';
import { clamp, ramp } from '../lib/anim';
import { L } from '../theme';
import { CaptionF, FloatCard, HeadF, Lines, MarkF, settle } from '../v5/cine';

const BW = 460;
const PAD = 22;
const Z = (L.W - L.X - L.R - 2 * PAD) / BW;
const TOP = 640;
const H = 600;
// 01 목록만(포스터·02·아래 입구는 감춘다). Typecast 줄도 감춘다(키 끝 네 글자가 보이는 줄이고 이 장면의 말과 무관 — Fable 10-18 v3 P3⑧).
// 동그라미를 감싼 span(mt-mark, 인라인 inline-block)은 block으로: 앱 휴대폰 규칙대로 「3개 중 1개 넉넉」 / 「2개 부족」 두 줄(Fable v3 P2③).
const CSS = `.sc-att .ms-back,.sc-att .ms-hero,.sc-att .ms-section-heading,.sc-att .ms-section+.ms-section,.sc-att .ms-foot,.sc-att .ms-s-typecast{display:none!important}
.sc-att .ms-section{margin-top:0}
.sc-att .ms-count .mt-mark{display:block!important;width:fit-content}`;
// 부족한 크레딧 글(앱 countText 꼬리) — Higgsfield 줄
const NEEDLE = /<span class="ms-soft">\d+개 부족[^<]*<\/span>/;

type Timing = { chips: number[]; pop: number; back: number; circle: number };

export const Attention05: React.FC<{ t: Timing; label?: string }> = ({ t, label = '05' }) => {
  const f = useCurrentFrame();
  const base = boardHtml('glance');
  const [boxes, probe] = useBoardBoxes(base, BW, Z, 'sc-att', CSS, ['.ms-svc.ms-s-gemini']);
  const gem = boxes?.['.ms-svc.ms-s-gemini'];
  // 드럼 박에 Gemini 줄 위끝까지 올린다(판 안 화면 px) → 판 위끝이 줄 경계에 오고 Higgsfield 줄과 그 추천 줄이 다 보인다.
  // 비율로 올리면 Typecast 줄을 감춘 뒤 42%는 카드 바닥 257px이 비고, 70%는 위끝이 GPT 추천 줄 글자를 반쯤 잘랐다.
  const go = settle(f, t.pop, 10);
  const lift = gem ? gem.y * go : 0;
  // 두 줄이 된 뒤 아랫줄 「2개 부족」만 두르게 세로 여백 6(기본 14면 윗줄 「3개 중 1개」를 지난다), 가로 14(24면 왼쪽 호가 태그 알약을 지난다)
  const html = ringAround(base, NEEDLE, ramp(f, t.circle, 14), 'att', { x: 14, y: 6 });
  const drift = interpolate(f, [12, t.circle + 30], [1, 1.02], clamp);
  return (
    <>
      {probe}
      <HeadF left="synkbrief 활용" right={label} />
      <Lines at={2} size={72} top={L.TOP - 8} lines={[<><MarkF key="m" p={ramp(f, 8, 12)}>다 쓴 것</MarkF>도 줄마다</>]} />
      <div style={{ position: 'absolute', inset: 0, scale: String(drift), transformOrigin: `540px ${TOP + 380}px` }}>
        <FloatCard style={{ left: L.X, top: TOP, width: L.W - L.X - L.R, height: H, padding: `${PAD}px ${PAD}px 0` }}>
          <div style={{ translate: `0 ${-lift}px` }}>
            <AppBoard html={html} width={BW} scale={Z} cls="sc-att" css={CSS} />
          </div>
        </FloatCard>
      </div>
      <CaptionF text="다 쓴 계정, 모자란 크레딧까지." em="모자란 크레딧까지." at={14} />
    </>
  );
};
