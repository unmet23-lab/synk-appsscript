// 04 지금 확인(본편 v2): 단추에 바짝 다가간 채 커서가 곡선으로 와서 누르고, 화면이 물러나며 계정을 읽는다.
// 판은 앱이 그린 HTML 그대로: 누르기 전 「「지금 확인」을 누르면…」 → 「공식 프로그램으로 읽는 중이에요… k/16」(앱이 보이는 진행 수,
// 계정 줄은 읽힌 만큼 값이 생기고 나머지는 「확인 중」) → 다시 터지는 박에 마지막 확인과 고리. 박마다 몇 계정씩 읽힌다.
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { AppBoard, boardHtml, BoardKey, drawArcs, useBoardBoxes } from '../app/board';
import snapshot from '../app/snapshot.json';
import { clamp, ramp } from '../lib/anim';
import { C, F, L } from '../theme';
import { CaptionF, CursorArc, FloatCard, HeadF, Lines, MarkF, settle } from '../v5/cine';

const BW = 500;
const SCALE = (L.W - L.X - L.R) / BW;
const PAD = 14; // 판 안쪽 여백(화면 px)
const TOP = 640;
const H = 620; // 자막 위까지
const W_IN = BW - (2 * PAD) / SCALE;
const TOTAL = snapshot.rows.length;
const SECONDS = 19; // 10-18 16:18 확인: 16개 19.2초(개발 창 실측)
// 박마다 읽힌 계정 수(16개를 여섯 박에, 마지막 박에 16/16)
const STEPS = [3, 5, 8, 11, 13, TOTAL];
const CSS = `.sc-check .ms-back,.sc-check .ms-hero-top,.sc-check .ms-hero-title,.sc-check .ms-object,.sc-check .ms-section-heading,.sc-check .ms-section+.ms-section,.sc-check .ms-foot{display:none!important}
.sc-check .ms-hero.has-art{min-height:0;padding:16px 18px;border-radius:16px}
.sc-check .ms-hero-note{border-top:0;padding-top:0}
.sc-check .ms-section{margin-top:12px}`;

type Timing = { click: number; done: number[]; len: number };

export const Check04: React.FC<{ t: Timing; label?: string }> = ({ t, label = '04' }) => {
  const f = useCurrentFrame();
  const step = t.done.filter((d) => f >= d).length;
  const clicked = f >= t.click + 1;
  const finished = step === t.done.length;
  const read = step === 0 ? 0 : STEPS[step - 1];
  const endAt = t.done[t.done.length - 1];
  const key = (!clicked ? 'check-idle' : finished ? 'done' : `check-${read}`) as BoardKey;
  // 다 읽은 순간 새 값이 들어온 고리만 앱처럼 한 번 그린다(읽는 동안은 바뀐 값 그대로). 고리 순서 Claude·GPT·Gemini 가운데
  // 16/16에 처음 값이 생기는 건 GPT뿐 — 셋 다 다시 그리면 이미 있던 Claude 57%가 바닥으로 되감긴다(Fable 10-18 v3 P2①).
  const html = finished ? drawArcs(boardHtml(key), [1, ramp(f, endAt, 27), 1]) : boardHtml(key);
  const [boxes, probe] = useBoardBoxes(boardHtml('check-idle'), W_IN, SCALE, 'sc-check', CSS, ['.ms-hero .ms-button-primary']);
  const btn = boxes?.['.ms-hero .ms-button-primary'];
  const BTN = btn ? { x: L.X + PAD + btn.x + btn.w / 2, y: TOP + PAD + btn.y + btn.h / 2 } : { x: 0, y: 0 };
  // 카메라: 단추 쪽에 1.25배로 붙어 있다가 누른 뒤 물러나고, 다 읽은 박에 살짝 다가가 머문다.
  const pull = settle(f, t.click + 2, 8);
  const hold = settle(f, endAt, 10);
  const zoom = 1.25 - 0.25 * pull + 0.03 * hold;
  const ox = interpolate(pull, [0, 1], [Math.max(400, BTN.x + 200), 540]);
  // 원점을 단추(≈780)에 두면 1.25배 때 카드 위끝이 600으로 올라가 제목 밑줄(598~607)을 덮는다 → 720 위로 두어 위끝 620(v5c 값).
  const oy = interpolate(pull, [0, 1], [Math.min(BTN.y, 720), 960]);
  const slam = settle(f, endAt, 18);
  const press = interpolate(f, [t.click - 1, t.click + 1, t.click + 6], [1, 0.94, 1], clamp);
  return (
    <>
      {probe}
      <HeadF left="synkbrief 활용" right={label} />
      <Lines at={2} size={72} top={L.TOP - 8} lines={[<MarkF key="m" p={ramp(f, 8, 12)}>지금 확인</MarkF>]} />
      <div
        style={{
          position: 'absolute',
          right: L.R,
          top: L.TOP - 4,
          font: `500 76px/1 ${F.mono}`,
          letterSpacing: '-.04em',
          color: finished ? C.markField : 'rgba(255,255,255,.62)',
          fontVariantNumeric: 'tabular-nums',
          scale: String(finished ? 1.3 - 0.3 * slam : 1),
          transformOrigin: '100% 50%',
        }}
      >
        {read}/{TOTAL}
      </div>
      <div style={{ position: 'absolute', inset: 0, scale: String(zoom), transformOrigin: `${ox}px ${oy}px` }}>
        <FloatCard style={{ left: L.X, top: TOP, width: BW * SCALE, height: H, padding: PAD }} stamp="실제 화면 · 2026.10.18">
          {/* 누르는 순간 단추만 살짝 눌린다(앱 화면 그대로, 크기만) */}
          <AppBoard html={html} width={W_IN} scale={SCALE} cls="sc-check" css={`${CSS}\n.sc-check .ms-hero .ms-button-primary{scale:${press.toFixed(3)}}`} />
        </FloatCard>
        {btn ? <CursorArc from={[990, 1480]} to={[BTN.x, BTN.y]} start={1} arrive={t.click - 5} click={t.click} leave={t.click + 8} /> : null}
      </div>
      <div
        style={{
          position: 'absolute',
          right: L.R,
          top: L.TOP + 80,
          font: `500 28px/1 ${F.mono}`,
          color: 'rgba(255,255,255,.78)',
          opacity: interpolate(slam, [0, 0.4], [0, 1], clamp),
          translate: `0 ${(1 - slam) * 14}px`,
        }}
      >
        {finished ? `계정 ${TOTAL}개 · ${SECONDS}초` : ''}
      </div>
      <CaptionF text={`한 번이면 계정 ${TOTAL}개를 다 읽어요.`} em={`계정 ${TOTAL}개를`} at={t.click + 10} />
    </>
  );
};
