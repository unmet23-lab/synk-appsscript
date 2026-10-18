// 10 연결 가이드: Gemini 연결 가이드가 위(1·2단계 ✓)에서 보이다가 로그인 단계까지 내려가고, 브레이크(76박)에
// 「이 PC의 기존 로그인 쓰기」에 크레용 동그라미 하나. 단계 글은 guide('gemini') 그대로(설치됨·로그인 전).
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { GEMINI_GUIDE } from '../data';
import { clamp } from '../lib/anim';
import { L } from '../theme';
import { BoardZ, CaptionF, CrayonRing, FloatCard, HeadF, Lines, MarkF, settle } from '../v5/cine';
import { at, T } from './time';

const BW = 440;
const PAD = 22;
const Z = (L.W - L.X - L.R - 2 * PAD) / BW;
const TOP = 640;
const H = 600;
// 로그인 단계까지 내려가는 거리(화면 px)와 단추 상자(화면 좌표) — 정지컷 실측
export const GUIDE = { scroll: 580, ring: { x: 236, y: 874, w: 330, h: 84 } };

export const Guide10: React.FC = () => {
  const f = useCurrentFrame();
  const down = settle(f, at('guide', 73), 9);
  const drift = interpolate(f, [T, at('guide', 80)], [1, 1.02], clamp);
  return (
    <>
      <HeadF left="synkbrief 활용" right="10" />
      <Lines at={T} size={72} top={L.TOP - 8} lines={[<>처음이면 <MarkF key="m" p={interpolate(f, [at('guide', 72.5), at('guide', 72.5) + 12], [0, 1], clamp)}>가이드대로</MarkF></>]} />
      <div style={{ position: 'absolute', inset: 0, scale: String(drift), transformOrigin: '540px 940px' }}>
      <FloatCard style={{ left: L.X, top: TOP, width: L.W - L.X - L.R, height: H, padding: `0 ${PAD}px` }}>
        <div style={{ translate: `0 ${-GUIDE.scroll * down}px` }}>
          <BoardZ width={BW} scale={Z}>
            <div className="ms-guide">
              <div className="ms-guide-head">
                <h3>Gemini 연결 가이드</h3>
                <button type="button" className="ms-link">
                  닫기
                </button>
              </div>
              <ol>
                <li className="ms-step ms-step-done">
                  <span className="ms-step-mark ms-num" aria-hidden="true">
                    ✓
                  </span>
                  <div>
                    <h4>요금제 확인</h4>
                    <p>{GEMINI_GUIDE.plan}</p>
                    <button type="button" className="ms-link">
                      요금제 보기
                    </button>
                  </div>
                </li>
                <li className="ms-step ms-step-done">
                  <span className="ms-step-mark ms-num" aria-hidden="true">
                    ✓
                  </span>
                  <div>
                    <h4>Antigravity CLI 설치</h4>
                    <p>{GEMINI_GUIDE.installed}</p>
                  </div>
                </li>
                <li className="ms-step ms-step-now">
                  <span className="ms-step-mark ms-num" aria-hidden="true">
                    3
                  </span>
                  <div>
                    <h4>로그인</h4>
                    <p>{GEMINI_GUIDE.login}</p>
                    <div className="ms-inline">
                      <button type="button" className="ms-button">
                        이 PC의 기존 로그인 쓰기
                      </button>
                      <button type="button" className="ms-button ms-button-primary">
                        Gemini 로그인
                      </button>
                    </div>
                  </div>
                </li>
                <li className="ms-step ms-step-wait">
                  <span className="ms-step-mark ms-num" aria-hidden="true">
                    4
                  </span>
                  <div>
                    <h4>첫 확인</h4>
                    <p>{GEMINI_GUIDE.first}</p>
                  </div>
                </li>
              </ol>
            </div>
          </BoardZ>
        </div>
      </FloatCard>
      <CrayonRing id="guide" x={GUIDE.ring.x} y={GUIDE.ring.y} w={GUIDE.ring.w} h={GUIDE.ring.h} at={at('guide', 76)} />
      </div>
      <CaptionF text="같은 앱이어도 내 계정 숫자가 나와요." em="내 계정 숫자가" at={T + 2} />
    </>
  );
};
