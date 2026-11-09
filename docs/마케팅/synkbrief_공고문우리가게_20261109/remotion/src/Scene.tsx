// 한 장면 — AI 답의 끝줄(직접대출, 9쪽을 1순위로) → 공고문을 넘겨 9쪽 → 그 줄만 밝아진다.
// 장면 심사용(제목 · 해설 없음)이고, 본편 끝 23.0~32.5초에 같은 부품이 그대로 들어간다.
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { clamp, EASE_IO, Flip, FullPan, PageCam, Sfx, sec } from './parts';

// 9쪽 ②의 단서 줄(쪽 좌표) — 「민간 금융기관 이용이 어려운 연매출 1억 4백만원 미만이면서 업력 7년 미만인 / 경우에 한해 직접대출 지원」
export const LINE: [number, number] = [1286, 1382];
const KEY = { px: 686, py: 1310 }; // 「연매출 1억 4백만원 미만이면서 업력 7년 미만인」이 시작하는 자리

// t: 이 부품이 시작하고 지난 프레임을 받는 안쪽 — 9쪽을 다 넘긴 뒤 hold초 멈췄다가 그 줄로 다가간다
export const Page9: React.FC<{ hold: number }> = ({ hold }) => {
  const f = useCurrentFrame();
  const a = sec(hold), b = a + 18, c = sec(hold + 1.15), d = c + 16;
  const whole = 900 / 1400;
  const s = f < c ? interpolate(f, [a, b], [whole, 1.0], { ...clamp, easing: EASE_IO }) : interpolate(f, [c, d], [1.0, 1.6], { ...clamp, easing: EASE_IO });
  // 쪽 전체(가운데) → 그 줄 전체 → 줄의 앞 조건
  const px = f < c ? interpolate(f, [a, b], [700, 737], { ...clamp, easing: EASE_IO }) : interpolate(f, [c, d], [737, KEY.px], { ...clamp, easing: EASE_IO });
  const py = f < c ? interpolate(f, [a, b], [0, 1334], { ...clamp, easing: EASE_IO }) : interpolate(f, [c, d], [1334, KEY.py], { ...clamp, easing: EASE_IO });
  const sx = f < c ? 540 : interpolate(f, [c, d], [540, 52], { ...clamp, easing: EASE_IO });
  const sy = f < c ? interpolate(f, [a, b], [650, 1090], { ...clamp, easing: EASE_IO }) : 1090;
  const litA = interpolate(f, [a, a + 9], [0, 0.86], clamp);
  const drift = f > d ? (f - d) * 0.0006 : 0;
  return (
    <AbsoluteFill style={{ background: '#0b0b0b', overflow: 'hidden' }}>
      <PageCam n={9} s={s + drift} px={px} py={py} sx={sx} sy={sy} lit={LINE} litA={litA} />
    </AbsoluteFill>
  );
};

// 본편과 같은 박자 — 0 답 끝줄 · 2.8 넘김 시작 · 4.98 그 줄로 다가감
export const EndScene: React.FC<{ lineDur?: number; flipPer?: number; hold?: number }> = ({ lineDur = 2.8, flipPer = 4, hold = 0.9 }) => {
  const flipDur = (8 * flipPer) / 30;
  const flips = Array.from({ length: 8 }, (_, i) => lineDur + (i * flipPer) / 30);
  return (
    <AbsoluteFill style={{ background: '#0b0b0b' }}>
      <Sequence durationInFrames={sec(lineDur)}>
        <FullPan y0={5300} dur={lineDur} h={340} top={900} lit={[5340, 5612]} note="Gemini 답의 끝 줄" zoom={0.0012} ox={540} oy={1080} />
      </Sequence>
      <Sequence from={sec(lineDur)} durationInFrames={sec(flipDur)}>
        <Flip per={flipPer} />
      </Sequence>
      <Sequence from={sec(lineDur + flipDur)}>
        <Page9 hold={hold} />
      </Sequence>
      {flips.map((t, i) => <Sfx key={i} at={t} src="flip" v={0.28} />)}
      <Sfx at={lineDur + flipDur + 0.02} src="hand" v={0.22} />
      <Sfx at={lineDur + flipDur + hold + 0.5} src="tok" v={0.24} />
    </AbsoluteFill>
  );
};

export const SCENE_TOTAL = sec(6.0);
export const Scene: React.FC = () => <EndScene lineDur={1.1} hold={0.45} />;
