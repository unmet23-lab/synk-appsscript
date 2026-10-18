// 02 전: 실제 브라우저 화면 둘(claude.ai 계정 메뉴의 「로그아웃」 → 사용량 화면, 10-17 16:3x 크롬에서 찍음, 메일은 앞부분만).
// 드럼이 빠지는 마디(12박)에 사용량 화면으로 넘어가고, 14박에 큰 숫자 「×6」(계정 여섯 개를 이렇게). 메뉴의 메일 줄은 덮었다(scripts/before02.py).
// 캡처 파일은 git 밖(public/before/, 원본 .tmp/synkbrief-subs-20261017/cap-before/).
import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, ramp } from '../lib/anim';
import { C, F, L } from '../theme';
import { CaptionF, FloatCard, HeadF, Lines, MarkF, settle } from '../v5/cine';
import { at, T } from './time';

const TOP = 640;
const W = L.W - L.X - L.R; // 836
const H = 592;

export const BEFORE_HITS: { at: number; src: string; v: number }[] = [
  { at: at('before', 12), src: 'sfx/tick.wav', v: 0.4 },
  { at: at('before', 14), src: 'sfx/thud.wav', v: 0.5 },
];

export const Before02: React.FC = () => {
  const f = useCurrentFrame();
  const usage = f >= at('before', 12);
  const six = settle(f, at('before', 14), 12);
  return (
    <>
      <HeadF left="synkbrief 활용" right="02" />
      <Lines at={T} size={72} top={L.TOP - 8} lines={[<>계정마다 <MarkF key="m" p={ramp(f, at('before', 8.5), 12)}>다시 로그인</MarkF></>]} />
      <FloatCard style={{ left: L.X, top: TOP, width: W, height: H }} stamp="실제 화면 · claude.ai">
        <div style={{ width: W, height: H }}>
          <Img src={staticFile(usage ? 'before/claude-usage.png' : 'before/claude-menu.png')} style={{ width: W, height: H, display: 'block' }} />
        </div>
      </FloatCard>
      {six > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            right: L.R + 10,
            top: 1010,
            font: `800 200px/0.9 ${F.ko}`,
            letterSpacing: '-.06em',
            color: C.crayon,
            opacity: interpolate(six, [0, 0.3], [0, 1], clamp),
            scale: String(0.7 + 0.3 * six),
            transformOrigin: '100% 100%',
          }}
        >
          ×6
        </div>
      ) : null}
      <CaptionF text="계정마다 로그아웃, 로그인, 사용량 확인." em="사용량 확인." at={T + 2} />
    </>
  );
};
