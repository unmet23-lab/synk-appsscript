// 07 풀리는 시각: 펼친 Claude 줄(계정 셋, 계정마다 두 겹 고리)이 보이다가, 조용한 구간이 시작되는 박에 화면이 founder 계정까지
// 내려가고 초기화 줄에 크레용 동그라미 하나. 줄 글은 accountRow·rowLine 그대로(11:45 값, 16:36부터의 「N% 남음」 표기).
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { CLAUDE_ACCOUNTS, PLAN, READ_AT, SERVICE_ROWS } from '../data';
import { L } from '../theme';
import { BoardZ, CaptionF, CrayonRing, FloatCard, HeadF, Lines, MarkF, settle } from '../v5/cine';
import { focusOf, Gauge, leftPercent, LeftText, levelOf, MiniGauge } from '../v5/gauge';
import { interpolate } from 'remotion';
import { clamp } from '../lib/anim';
import { at, T } from './time';

const BW = 440;
const PAD = 22;
const Z = (L.W - L.X - L.R - 2 * PAD) / BW;
const TOP = 640;
const H = 600; // 화면 판 높이(자막 위까지)
// founder 계정까지 내려가는 거리(판 안 화면 px)와 초기화 줄 상자(화면 좌표) — 정지컷 실측
export const RESET = { scroll: 739, ring: { x: 352, y: 999, w: 370, h: 36 } };
const keep = (s: string) => s.replace(/ /g, ' '); // 앱 keep(): 「· 2일 7시간 뒤」가 줄 끝에서 떨어지지 않게

export const Reset07: React.FC = () => {
  const f = useCurrentFrame();
  const down = settle(f, at('reset', 47.5), 10);
  const drift = interpolate(f, [T, at('reset', 54)], [1, 1.02], clamp);
  const claude = SERVICE_ROWS[0];
  return (
    <>
      <HeadF left="synkbrief 활용" right="07" />
      <Lines at={T} size={72} top={L.TOP - 8} lines={[<>언제 풀리는지 <MarkF key="m" p={interpolate(f, [at('reset', 46.5), at('reset', 46.5) + 12], [0, 1], clamp)}>시간까지</MarkF></>]} />
      <div style={{ position: 'absolute', inset: 0, scale: String(drift), transformOrigin: '540px 940px' }}>
      <FloatCard style={{ left: L.X, top: TOP, width: L.W - L.X - L.R, height: H, padding: `0 ${PAD}px` }}>
        <div style={{ translate: `0 ${-RESET.scroll * down}px` }}>
          <BoardZ width={BW} scale={Z}>
            <div className="ms-table" style={{ marginTop: 12 }}>
              <div className="ms-block open ms-s-claude">
                <button type="button" className="ms-row" aria-expanded="true">
                  <span className="ms-tag">{claude.tag}</span>
                  <span className="ms-count">계정 3</span>
                  <span className="ms-status">
                    <b>{claude.best}</b> <MiniGauge left={claude.left} />
                    주간 <LeftText left={claude.left} /> <span className="ms-soft">가장 여유 있는 계정</span>
                  </span>
                  <span className="ms-next">{claude.next}</span>
                  <span className="ms-price ms-num">
                    <span className="ms-soft">요금 없음</span>
                  </span>
                  <span className="ms-chev" aria-hidden="true" />
                </button>
                <div className="ms-detail">
                  {CLAUDE_ACCOUNTS.map((a) => {
                    const g = { weekly: leftPercent(a.weekly), session: leftPercent(a.session) };
                    const low = levelOf(g[focusOf(g)]) === 'low';
                    return (
                      <div key={a.name} className="ms-account has-gauge">
                        <Gauge g={g} label={false} />
                        <div className="ms-account-name">
                          <strong>{a.name}</strong>
                          <span className="ms-chip ms-chip-ok">연결됨</span>
                          {low ? <span className="ms-chip ms-chip-warn">거의 소진</span> : null}
                        </div>
                        <div className="ms-account-info">
                          <div>
                            주간 <LeftText left={g.weekly} />
                          </div>
                          <div>
                            5시간 <LeftText left={g.session} />
                            {a.sessionIn ? <span className="ms-soft"> {keep(`· ${a.sessionIn} 뒤 풀림`)}</span> : null}
                          </div>
                          <div>
                            Fable 주간 <LeftText left={leftPercent(a.fable)} />
                          </div>
                          <div>
                            매주 {a.reset} 초기화 <span className="ms-soft">{keep(`· ${a.resetIn} 뒤`)}</span>
                          </div>
                          <div>
                            <span className="ms-soft">
                              {READ_AT} 확인 · {PLAN}
                            </span>
                          </div>
                        </div>
                        <div className="ms-account-actions">
                          <button type="button" className="ms-button ms-button-small">
                            요금·결제일
                          </button>
                          <button type="button" className="ms-button ms-button-small">
                            지우기
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </BoardZ>
        </div>
      </FloatCard>
      <CrayonRing id="reset" x={RESET.ring.x} y={RESET.ring.y} w={RESET.ring.w} h={RESET.ring.h} at={at('reset', 50)} padY={9} />
      </div>
      <CaptionF text="다 쓴 계정도 언제 풀리는지 바로." em="언제 풀리는지" at={T + 2} />
    </>
  );
};
