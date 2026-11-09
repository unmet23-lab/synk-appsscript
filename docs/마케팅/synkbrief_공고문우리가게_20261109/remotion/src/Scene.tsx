// 한 장면 — AI 답의 끝줄(직접대출, 9쪽을 1순위로) → 공고문을 넘겨 9쪽 → 그 줄만 밝아진다.
// 장면 심사용(제목 · 해설 없음)이고, 본편 끝 23.0~32.5초에 같은 부품이 그대로 들어간다.
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { clamp, EASE_IO, Flip, FullPan, PageCam, Sfx, sec } from './parts';

// 9쪽 ②의 단서 줄(쪽 좌표) — 「민간 금융기관 이용이 어려운 연매출 1억 4백만원 미만이면서 업력 7년 미만인 / 경우에 한해 직접대출 지원」
export const LINE: [number, number] = [1286, 1382];
const KEY = { px: 655, py: 1313 }; // 「연매출 1억 4백만원 미만이면서 업력 7년 미만인」이 시작하는 자리

// t: 이 부품이 시작하고 지난 프레임을 받는 안쪽 — 9쪽을 다 넘긴 뒤 hold초 멈췄다가 그 줄로 다가간다
export const Page9: React.FC<{ hold: number; backAt?: number }> = ({ hold, backAt }) => {
  const f = useCurrentFrame();
  const a = sec(hold), b = a + 18, c = sec(hold + 1.15), d = c + 16;
  const e = backAt === undefined ? Infinity : sec(backAt), g = e + 14;
  const whole = 900 / 1400;
  const WHOLE = { s: 0.875, px: 747, py: 1334, sx: 540, sy: 1090 }; // 온전한 두 줄 — 양쪽에 글 여백(x 65 안쪽)
  const KEYV = { s: 1.56, px: KEY.px, py: KEY.py, sx: 74, sy: 1090 }; // 앞 조건 크게
  const ease = { ...clamp, easing: EASE_IO };
  const lerp = (k: number, A: typeof WHOLE, B: typeof WHOLE) => ({ s: A.s + (B.s - A.s) * k, px: A.px + (B.px - A.px) * k, py: A.py + (B.py - A.py) * k, sx: A.sx + (B.sx - A.sx) * k, sy: A.sy + (B.sy - A.sy) * k });
  const first = { s: whole, px: 700, py: 0, sx: 540, sy: 650 };
  const v = f < c ? lerp(interpolate(f, [a, b], [0, 1], ease), first, WHOLE) : f < e ? lerp(interpolate(f, [c, d], [0, 1], ease), WHOLE, KEYV) : lerp(interpolate(f, [e, g], [0, 1], ease), KEYV, WHOLE);
  // 끝(붙여 쓸 말)에서는 제목 뒤로 공고문 글이 얼룩처럼 비치지 않게 더 누른다
  const litA = e === Infinity ? interpolate(f, [a, a + 9], [0, 0.965], clamp) : interpolate(f, [a, a + 9, e, g], [0, 0.965, 0.965, 0.992], clamp);
  const drift = f > g ? (f - g) * 0.0005 : f > d ? (f - d) * 0.0006 : 0;
  return (
    <AbsoluteFill style={{ background: '#0b0b0b', overflow: 'hidden' }}>
      <PageCam n={9} s={v.s + drift} px={v.px} py={v.py} sx={v.sx} sy={v.sy} lit={LINE} litA={litA} />
    </AbsoluteFill>
  );
};

// 본편과 같은 박자 — 0 답 끝줄 · 2.8 넘김 시작 · 4.98 그 줄로 다가감
export const EndScene: React.FC<{ lineDur?: number; flipPer?: number; hold?: number; backAt?: number }> = ({ lineDur = 2.8, flipPer = 4, hold = 0.9, backAt }) => {
  const flipDur = (8 * flipPer) / 30;
  const flips = Array.from({ length: 8 }, (_, i) => lineDur + (i * flipPer) / 30);
  return (
    <AbsoluteFill style={{ background: '#0b0b0b' }}>
      <Sequence durationInFrames={sec(lineDur)}>
        <FullPan y0={5340} dur={lineDur} h={272} top={940} note="Gemini 답의 끝 줄" zoom={0.0012} ox={74} oy={1080} />
      </Sequence>
      <Sequence from={sec(lineDur)} durationInFrames={sec(flipDur)}>
        <Flip per={flipPer} />
      </Sequence>
      <Sequence from={sec(lineDur + flipDur)}>
        <Page9 hold={hold} backAt={backAt} />
      </Sequence>
      {flips.map((t, i) => <Sfx key={i} at={t} src="flip" v={0.28} />)}
      <Sfx at={lineDur + flipDur + 0.02} src="hand" v={0.22} />
      <Sfx at={lineDur + flipDur + hold + 0.5} src="tok" v={0.24} />
    </AbsoluteFill>
  );
};

export const SCENE_TOTAL = sec(6.0);
export const Scene: React.FC = () => <EndScene lineDur={1.1} hold={0.45} />;
