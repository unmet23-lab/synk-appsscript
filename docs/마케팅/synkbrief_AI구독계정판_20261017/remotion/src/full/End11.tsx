// 11 끝: 80박 드롭에 「SYNK 회원이면 무료」(훅 제목과 같은 자리·크기 — 다시 재생될 때 제목에서 제목으로 이어진다),
// 경로 → 댓글 질문 단추 → 로고가 박마다. 끝맺음 첫 타격에 질문 단추가 한 번 눌리고, 마지막 2초는 멈춘 화면.
import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, ramp } from '../lib/anim';
import { beat } from '../lib/beat';
import { C, F, L } from '../theme';
import { HeadF, Lines, MarkF, settle } from '../v5/cine';
import { at, B, CUT, T, TOTAL } from './time';

const rise = (f: number, a: number) => {
  const s = settle(f, a, 15);
  return { opacity: interpolate(s, [0, 0.45], [0, 1], clamp), translate: `0 ${(1 - s) * 26}px` };
};

export const End11: React.FC = () => {
  const f = useCurrentFrame();
  const local = (abs: number) => abs - (beat(B.end) - T); // 영상 프레임 → 이 장면 프레임
  const still = local(TOTAL - 60);
  const ff = Math.min(f, still); // 마지막 2초는 멈춘다
  const drift = interpolate(ff, [T, still], [1, 1.02], clamp);
  const press = interpolate(ff, [local(CUT) - 1, local(CUT) + 1, local(CUT) + 7], [1, 0.95, 1], clamp);
  return (
    <>
      <HeadF left="synkbrief 활용" right="PC 앱 · 회원 무료" />
      <div style={{ position: 'absolute', inset: 0, scale: String(drift), transformOrigin: `${L.X}px ${L.TOP}px` }}>
        <Lines visibleAtZero at={0} size={100} top={L.TOP} lines={['SYNK 회원이면', <MarkF key="m" p={ramp(ff, at('end', 80.5), 12)}>무료</MarkF>]} />
        <div style={{ position: 'absolute', left: L.X, top: 790, font: `500 30px/1.3 ${F.ko}`, color: C.onField2, letterSpacing: '-.01em', ...rise(ff, at('end', 82)) }}>
          PC 앱 <span style={{ opacity: 0.6 }}>›</span> 회원 혜택 <span style={{ opacity: 0.6 }}>›</span> AI 구독 계정판
        </div>
        <div style={{ position: 'absolute', left: L.X, top: 880, ...rise(ff, at('end', 84)) }}>
          <div
            style={{
              display: 'inline-block',
              padding: '22px 36px',
              borderRadius: 999,
              background: '#fff',
              color: C.ink,
              font: `800 48px/1.1 ${F.ko}`,
              letterSpacing: '-.035em',
              boxShadow: '0 22px 44px -22px rgba(4,12,36,.6)',
              scale: String(press),
              transformOrigin: '50% 50%',
            }}
          >
            AI 구독, 몇 개 쓰세요?
          </div>
        </div>
        <div style={{ position: 'absolute', left: L.X, top: 1012, font: `500 30px/1.3 ${F.ko}`, color: C.onField2, ...rise(ff, at('end', 84.5)) }}>댓글로 알려 주세요.</div>
        <div style={{ position: 'absolute', left: L.X, right: L.R, top: 1330, display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...rise(ff, at('end', 85)) }}>
          <span style={{ display: 'inline-flex', padding: '12px 18px', borderRadius: 16, background: '#fff' }}>
            <Img src={staticFile('kit/logo-shift.webp')} style={{ height: 40, display: 'block' }} />
          </span>
          <span style={{ font: `500 28px/1 ${F.mono}`, color: C.onField2 }}>@synkbrief</span>
        </div>
      </div>
    </>
  );
};
