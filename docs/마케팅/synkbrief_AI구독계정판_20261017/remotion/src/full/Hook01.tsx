// 01 훅(본편 v2, 10-18 계정판 구조 개편 뒤): 0프레임부터 제목이 읽히고, 비스듬히 떠 있던 실제 계정판(한눈에 보기)이 펴지며 다가온다.
// 판은 앱이 그린 HTML 그대로(포스터 아래 줄 + 「지금 확인」·「계정 관리」, 서비스마다 추천 계정 한 줄). 줄마다 반 박씩 고리가 그려진다.
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { AppBoard, boardHtml, drawArcs } from '../app/board';
import snapshot from '../app/snapshot.json';
import { clamp, ramp } from '../lib/anim';
import { L } from '../theme';
import { HOOK } from '../timeline';
import { FloatCard, HeadF, Lines, MarkF, settle } from '../v5/cine';

const BW = 500;
const SCALE = (L.W - L.X - L.R) / BW;
const TOTAL = snapshot.rows.length;
// 포스터 그림·제목은 03 장면의 몫이라 여기서는 감추고, 포스터 아래 줄(상태 한 줄 + 단추 둘)과 01 목록만 둔다.
// Typecast 줄도 감춘다 — 키 끝 네 글자가 02로 밀어 올리는 넘김(107~113프레임)에 흐린 채 스쳤다(Fable 10-19 P2-3, 05·09와 같은 규칙).
const CSS = `.sc-hook .ms-back,.sc-hook .ms-hero-top,.sc-hook .ms-hero-title,.sc-hook .ms-object,.sc-hook .ms-section-heading,.sc-hook .ms-section+.ms-section,.sc-hook .ms-foot,.sc-hook .ms-s-typecast{display:none!important}
.sc-hook .ms-hero.has-art{min-height:0;padding:14px 16px 16px;border-radius:16px}
.sc-hook .ms-hero-note{border-top:0;padding-top:0}
.sc-hook .ms-section{margin-top:12px}`;

export const Hook01: React.FC<{ variant?: 'A' | 'B' }> = ({ variant = 'A' }) => {
  const f = useCurrentFrame();
  const flat = settle(f, 2, 9);
  const push = settle(f, HOOK.click, 6);
  const rows = HOOK.rows.slice(0, 5);
  const bump = Math.min(...rows.map((r) => (f >= r ? interpolate(f, [r, r + 6], [1.14, 1], clamp) : 1)));
  // 고리는 Claude·GPT·Gemini 줄에 하나씩(크레딧 줄은 고리가 없다) — 줄이 착지하는 박에 앱 곡선으로
  const html = drawArcs(boardHtml('glance'), rows.slice(0, 3).map((r) => ramp(f, r, 27)));
  return (
    <>
      <HeadF left="synkbrief 활용" right="2026.10.18 · 실제 화면" />
      <div style={{ position: 'absolute', inset: 0, scale: String(1 + 0.045 * push), transformOrigin: '50% 72%' }}>
        <Lines
          visibleAtZero
          at={0}
          size={variant === 'A' ? 100 : 84}
          top={L.TOP}
          lines={
            variant === 'A'
              ? [
                  '클릭 한 번,',
                  <>
                    AI 계정 <span style={{ display: 'inline-block', scale: String(bump), transformOrigin: '50% 75%', fontVariantNumeric: 'tabular-nums' }}>{TOTAL}</span>개
                  </>,
                  <MarkF key="m" p={ramp(f, HOOK.mark, 12)}>남은 사용량</MarkF>,
                ]
              : ['AI 구독 3개 넘으면,', '이번 주 사용량', <>얼마 남았는지 <MarkF key="m" p={ramp(f, HOOK.mark, 12)}>아세요?</MarkF></>]
          }
        />
        <div style={{ position: 'absolute', left: L.X, top: 890, width: BW * SCALE, perspective: 1700 }}>
          <FloatCard
            style={{
              position: 'relative',
              padding: '12px 14px 0',
              transformOrigin: '50% 0%',
              transform: `translateY(${(1 - flat) * 120}px) rotateX(${(1 - flat) * 28}deg) rotateZ(${(1 - flat) * -6}deg) scale(${0.9 + 0.1 * flat})`,
            }}
          >
            <AppBoard html={html} width={BW - 28 / SCALE} scale={SCALE} cls="sc-hook" css={CSS} />
          </FloatCard>
        </div>
      </div>
    </>
  );
};
