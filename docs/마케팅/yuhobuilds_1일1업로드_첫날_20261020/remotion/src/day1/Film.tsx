// yuhobuilds 「AI 직원 셋에게 오늘 올릴 영상을 한 편씩」 1일 1업로드 첫날(10-20). 만족 사례 S22·자동 DM 편 문법 그대로:
// 검정 무대 위 밝은 판 하나가 끝까지 변형, 머리글이 곧 내레이션(말한 낱말 안에서만), 버터 한 곳, 0프레임부터 문제가 보이고 6초 안에 해결,
// 12초 안에 반전(「지금 이 영상도 그중 하나」). 막이 바뀌는 두 곳(막힌 곳 → 정한 것, 끝)만 한 장으로 이어 위로 넘긴다.
// 실제 캡처(인스타·틱톡·샤오훙수·Business Suite)는 조율 세션이 찍은 원본을 가려서 쓴다(화면/만들기.py). 사건은 배경음 박 격자 위.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { BUTTER, DIM, INK, STAGE } from '../film/parts';
import { KO, MONO } from '../lib/fonts';
import { clamp, IN, IN_OUT, OUT, prog, stagger } from '../lib/motion';
import { chipSwap, Headline, lerpBox, Shell, StripIn, StripOut, Swap, type Box, type HW } from '../full/kit';
import { ANSWER, CHANNELS, CHILDREN, IG_STEPS, POST_CHIPS, SAY1, SAY2_A, SAY2_B, SAY2_MARK, SESSION_TITLE, URL_RED_A, URL_RED_B, URL_RED_C, URL_TT, URL_XHS, YT_CHIPS } from './data';
import { EndCard, END_FOLLOW } from './End';
import { ARROW_MONO, Cap, CAP_SIZE, CapBar, ChannelChip, childY, Count3, DayStrip, DocCard, MeBubble, PanelTop, PostRight, Question, ROW_TOP, SessionList, Terminal, TileGrid, UI_INK, UI_MUTED } from './parts';
import { LINES, lineEnd, S, TOTAL, VO, wd, type Spoken } from './time';

const B_CHAT: Box = { x: 64, y: 590, w: 952, h: 760, r: 34 };
const B_LIST: Box = { x: 64, y: 600, w: 952, h: 700, r: 30 };
const B_TERM: Box = { x: 64, y: 600, w: 952, h: 600, r: 26 };
const B_CAP: Box = { x: 64, y: 600, w: 952, h: 640, r: 26 };
const B_SAY: Box = { x: 64, y: 600, w: 952, h: 640, r: 34 };
const B_DOC: Box = { x: 64, y: 600, w: 952, h: 640, r: 30 };

const GRID_TOP = 300;
const CHECK_A = 30; // 「물었더니」 무렵부터
const CHECK_B = wd('h1', 10); // 「와서」까지 12칸이 실제 확인 순서대로
const ZERO_AT = wd('h1', 11); // 「하나도」

// ───────────── 머리글 ─────────────
const h = (t: string, id: Spoken, i: number, accent?: boolean | number): HW => ({ t, at: wd(id, i), accent: accent === true ? wd(id, i) : typeof accent === 'number' ? accent : undefined });

const Heads: React.FC = () => {
  const f = useCurrentFrame();
  const big = { fontSize: 80 };
  const mid = { fontSize: 74 };
  return (
    <>
      {/* 00: 0프레임부터 문제 전체(표지 노릇, Fable M1). 「하나도」에 버터 */}
      {f < VO.h2 ? (
        <Headline
          lines={[
            [{ t: '예약된', at: -12 }, { t: '게시물', at: -12 }],
            [{ t: '있냐고', at: -12 }, { t: '물었더니,', at: -12 }],
            [{ t: '채널', at: -12 }, { t: '12곳,', at: -12 }, { t: '하나도', at: -12, accent: ZERO_AT }, { t: '없대요', at: -12 }],
          ]}
          out={VO.h2 - 8}
          top={236}
          style={mid}
        />
      ) : null}
      {f >= VO.h2 - 4 && f < VO.h3 + 6 ? <Headline lines={[[h('AI', 'h2', 1), h('직원', 'h2', 2), h('셋에게', 'h2', 3, true)], [h('한', 'h2', 7), h('편씩', 'h2', 8), h('맡겼어요', 'h2', 9)]]} out={VO.h3 - 6} style={big} /> : null}
      {f >= VO.h3 - 4 && f < S.rew + 8 ? <Headline lines={[[h('지금', 'h3', 0), h('이', 'h3', 1, true), h('영상도', 'h3', 2, wd('h3', 1))], [h('그중', 'h3', 3), h('하나예요', 'h3', 4)]]} out={S.rew - 4} style={big} /> : null}
      {f >= VO.c1 - 4 && f < S.s03 + 8 ? (
        <Headline lines={[[h('답이', 'c1', 0), h('오기까지', 'c1', 1), h('17분,', 'c1', 2)], [h('막힌', 'c1', 4), h('데가', 'c1', 5), h('세', 'c1', 6, true), h('군데', 'c1', 7, wd('c1', 6))]]} out={S.s03 - 4} style={big} />
      ) : null}
      {f >= VO.b1 - 4 && f < wd('b1', 5) + 4 ? <Headline lines={[[h('유튜브', 'b1', 0), h('API로는', 'b1', 1)], [h('한', 'b1', 2, true), h('채널만', 'b1', 3, wd('b1', 2))]]} out={wd('b1', 5) - 6} style={big} /> : null}
      {f >= wd('b1', 5) - 4 && f < S.s04 + 8 ? <Headline lines={[[h('나머진', 'b1', 5), h('스튜디오에서', 'b1', 6)], [h('바꿔', 'b1', 7), h('가며', 'b1', 8)]]} out={S.s04 - 4} style={big} /> : null}
      {f >= VO.b2 - 4 && f < wd('b2', 5) + 4 ? <Headline lines={[[h('인스타', 'b2', 0), h('예약', 'b2', 1), h('달력이', 'b2', 2)], [h('계정마다', 'b2', 3, true), h('따로', 'b2', 4)]]} out={wd('b2', 5) - 6} style={big} /> : null}
      {f >= wd('b2', 5) - 4 && f < S.s05 + 8 ? <Headline lines={[[h('계정을', 'b2', 5)], [h('세', 'b2', 6, true), h('번', 'b2', 7, wd('b2', 6)), h('바꿨고', 'b2', 8)]]} out={S.s05 - 4} style={big} /> : null}
      {f >= VO.b3 - 4 && f < wd('b3', 5) + 4 ? <Headline lines={[[h('틱톡은', 'b3', 0)], [h('한', 'b3', 1, true), h('계정만', 'b3', 2, wd('b3', 1))]]} out={wd('b3', 5) - 6} style={big} /> : null}
      {f >= wd('b3', 5) - 4 && f < S.s06 ? <Headline lines={[[h('샤오훙수는', 'b3', 5)], [h('주소를', 'b3', 6), h('rednote로', 'b3', 7, true)]]} out={S.s06 - 6} style={big} /> : null}
      {f >= S.s06 + 6 && f < wd('t1', 3) + 4 ? <Headline lines={[[h('답을', 't1', 0), h('듣고', 't1', 1)], [h('정했어요', 't1', 2)]]} out={wd('t1', 3) - 6} style={big} /> : null}
      {f >= wd('t1', 3) - 4 && f < S.s07 + 8 ? <Headline lines={[[h('준비된', 't1', 3), h('채널마다,', 't1', 4)], [h('하루', 't1', 5, true), h('한', 't1', 6, wd('t1', 5)), h('편', 't1', 7, wd('t1', 5))]]} out={S.s07 - 4} style={big} /> : null}
      {f >= VO.s1 - 4 && f < wd('s1', 8) + 4 ? <Headline lines={[[h('월요일', 's1', 0), h('스캔에서', 's1', 2), h('둘,', 's1', 3)], [h('오늘', 's1', 4), h('일에서', 's1', 5), h('하나', 's1', 6)]]} out={wd('s1', 8) - 6} style={big} /> : null}
      {f >= wd('s1', 8) - 4 && f < S.s08 + 8 ? <Headline lines={[[h('세션', 's1', 8), h('셋을', 's1', 9)], [h('한', 's1', 10, true), h('번에', 's1', 11, wd('s1', 10))]]} out={S.s08 - 4} style={big} /> : null}
      {f >= VO.s2 - 4 && f < wd('s2', 4) + 4 ? <Headline lines={[[h('올리기만은', 's2', 0)], [h('한', 's2', 1, true), h('곳에서', 's2', 2, wd('s2', 1))]]} out={wd('s2', 4) - 6} style={big} /> : null}
      {f >= wd('s2', 4) - 4 && f < S.s09 + 8 ? <Headline lines={[[h('계정을', 's2', 4), h('바꿔', 's2', 5), h('가며', 's2', 6)], [h('같이', 's2', 8), h('하면', 's2', 9), h('엉키거든요', 's2', 10)]]} out={S.s09 - 4} style={big} /> : null}
      {f >= VO.e1b - 4 && f < S.s10 ? <Headline lines={[[h('내일부터', 'e1b', 0)], [h('매일', 'e1b', 1, true), h('한', 'e1b', 2), h('편씩', 'e1b', 3)]]} out={S.s10 - 6} style={big} /> : null}
    </>
  );
};

// ───────────── 1막: 질문·12칸 → 세 세션(반전) → 되감기 → 막힌 곳 셋 ─────────────
const ActOne: React.FC = () => {
  const f = useCurrentFrame();
  let box = lerpBox(B_CHAT, B_LIST, prog(f, S.s01, 12, OUT));
  box = lerpBox(box, B_CHAT, prog(f, S.rew + 4, 14, IN_OUT));
  box = lerpBox(box, B_TERM, prog(f, S.s03, 12, OUT));
  box = lerpBox(box, B_CAP, prog(f, S.s04, 12, OUT));
  const dark = prog(f, S.s03, 10, IN_OUT);
  // 카메라: 0프레임부터 12칸 쪽으로 천천히 밀고(1.05배), 세션 목록에서 풀었다가 「이 영상도」에 한 번(1.03배)
  const push = 0.05 * prog(f, 0, S.s01, IN_OUT) * (1 - prog(f, S.s01, 12, IN_OUT)) + 0.03 * prog(f, wd('h3', 1), 8, OUT) * (1 - prog(f, S.rew - 6, 10, IN_OUT));
  return (
    <div style={{ position: 'absolute', inset: 0, transform: push > 1e-4 ? `scale(${1 + push})` : undefined, transformOrigin: '540px 1000px' }}>
      <Shell box={box} paper={1} dark={dark} darkFrom="bottom">
        {/* 00: 질문 + 12칸 + 실제 「예약된 게시물 없음」 */}
        {f < S.s01 + 12 ? (
          <Swap outP={prog(f, S.s01, 10, IN)}>
            <PanelTop title={SESSION_TITLE} right="Claude" />
            <Question />
            <TileGrid f={f} top={GRID_TOP} checkA={CHECK_A} checkB={CHECK_B} ringAt={ZERO_AT} />
            <BsProof f={f} />
          </Swap>
        ) : null}
        {/* 01: 세션 목록 — 「한 편씩」(다시 터지는 박)에 새 세션 세 줄, 「이 영상도」에 셋째 줄 */}
        {f >= S.s01 && f < S.rew + 14 ? (
          <Swap inP={prog(f, S.s01 + 2, 8, OUT)} outP={prog(f, S.rew + 4, 10, IN)}>
            <SessionList childIn={(i) => prog(f, S.rows + i * 4, 9, OUT)} mark={prog(f, wd('h3', 1), 8, OUT)} tag={prog(f, wd('h3', 1) + 4, 8, OUT)} />
          </Swap>
        ) : null}
        {/* 02: 되감기 — 시계가 18:22 → 17:35, 12칸 다시(모두 0), 「세 군데」에 번호 */}
        {f >= S.rew + 4 && f < S.s03 + 12 ? (
          <Swap inP={prog(f, S.rew + 8, 8, OUT)} outP={prog(f, S.s03, 8, IN)}>
            <PanelTop title={SESSION_TITLE} right="Claude" />
            <RewindClock f={f} />
            <TileGrid f={f} top={GRID_TOP} checkA={0} checkB={0} all badgeAt={wd('c1', 6)} />
          </Swap>
        ) : null}
        {/* 03: ① 유튜브 API 출력 → 스튜디오 채널 칩 */}
        {f >= S.s03 + 4 && f < S.s04 + 10 ? (
          <Swap inP={prog(f, S.s03 + 6, 8, OUT)} outP={prog(f, S.s04, 8, IN)}>
            <Terminal f={f} at={S.s03 + 6} markAt={wd('b1', 2)} />
            <YtChip f={f} />
          </Swap>
        ) : null}
        {/* 04: ② 인스타 실제 화면 — 전환 창 한 번 + 빈 달력 셋 */}
        {f >= S.s04 + 2 && f < S.s05 + 10 ? (
          <Swap inP={prog(f, S.s04 + 4, 8, OUT)} outP={prog(f, S.s05, 8, IN)}>
            <IgCaps f={f} />
          </Swap>
        ) : null}
        {/* 05: ③ 틱톡 → 샤오훙수 → rednote */}
        {f >= S.s05 + 2 ? (
          <Swap inP={prog(f, S.s05 + 4, 8, OUT)}>
            <TtXhs f={f} />
          </Swap>
        ) : null}
      </Shell>
    </div>
  );
};

/** 「하나도」: 실제 Business Suite 「예약된 게시물 없음」(17:45)이 12칸 위에 증거로 찍힌다. */
const BsProof: React.FC<{ f: number }> = ({ f }) => {
  const p = prog(f, ZERO_AT + 2, 9, OUT);
  if (p <= 0) return null;
  const [w, hh] = CAP_SIZE.bs;
  const W = 560; // 원본의 실효 2.4배(완성본 검수 P3: 360px에서 읽히게)
  const H = (W / w) * hh;
  return (
    <div
      style={{
        position: 'absolute',
        left: (952 - W) / 2,
        top: GRID_TOP + (448 - H) / 2,
        width: W,
        height: H,
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 22px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.08)',
        opacity: Math.min(1, p * 1.6),
        transform: `scale(${interpolate(p, [0, 1], [0.9, 1], clamp)}) rotate(${interpolate(p, [0, 1], [-2.5, -1], clamp)}deg)`,
      }}
    >
      <Cap src="cap/bs.png" w={W} h={H} maxW={W} />
    </div>
  );
};

/** 02 되감기 시계(대화창 질문 자리): 18:22 → 17:35로 거꾸로 돈 뒤 「→ 17:53 답」. */
const RewindClock: React.FC<{ f: number }> = ({ f }) => {
  const r = prog(f, S.rew, 14, IN_OUT);
  const min = Math.round(interpolate(r, [0, 1], [18 * 60 + 22, 17 * 60 + 35], clamp));
  const hh = String(Math.floor(min / 60)).padStart(2, '0');
  const mm = String(min % 60).padStart(2, '0');
  const tail = prog(f, wd('c1', 2), 8, OUT);
  return (
    <div style={{ position: 'absolute', left: 34, right: 34, top: 128, height: 140, display: 'flex', alignItems: 'baseline', gap: 22 }}>
      <span style={{ fontFamily: MONO, fontSize: 92, color: UI_INK, letterSpacing: '-0.02em', filter: r > 0 && r < 1 ? `blur(${2.5 * (1 - Math.abs(2 * r - 1))}px)` : undefined }}>
        {hh}:{mm}
      </span>
      <span style={{ fontFamily: ARROW_MONO, fontSize: 34, color: UI_MUTED, opacity: tail, transform: `translateX(${(1 - tail) * -16}px)`, display: 'inline-block' }}>
        질문 → 17:53 답
      </span>
    </div>
  );
};

/** 03 스튜디오 채널 칩: SYNK LAB → SYNK 브리핑 → (한 번 안 넘어감) → 유호 · AI와 회사 만들기. 「나머진」부터. */
const YtChip: React.FC<{ f: number }> = ({ f }) => {
  const a = wd('b1', 5) - 2; // 「나머진」
  const s1 = wd('b1', 6); // 「스튜디오에서」 → SYNK 브리핑
  const fail = wd('b1', 7) - 2; // 「바꿔」 → 눌렀는데 그대로
  const s2 = wd('b1', 8) + 2; // 「가며」 → 다시 눌러 넘어감
  const name = f < s1 + 3 ? YT_CHIPS[0] : f < s2 + 3 ? YT_CHIPS[1] : YT_CHIPS[2];
  const blur = Math.max(chipSwap(f, s1), chipSwap(f, fail), chipSwap(f, s2));
  const shake = f >= fail + 4 && f < fail + 16 ? (f - fail - 4) / 12 : 0;
  const noteO = prog(f, fail + 5, 5, OUT) * (1 - prog(f, s2, 5, IN));
  return <ChannelChip name={name} blur={blur} note="안 넘어감 → 다시" noteO={noteO} shake={shake} o={prog(f, a, 8, OUT)} />;
};

/** 04 인스타: 전환 창(17:48:17) → @synkbrief·@yuhobuilds·@synk.mn 빈 달력, 세기 1·2·3. */
const IG_AT = () => [wd('b2', 3) - 6, wd('b2', 5) - 4, wd('b2', 6)];
const IgCaps: React.FC<{ f: number }> = ({ f }) => {
  const at = IG_AT();
  const k = f < at[0] ? -1 : f < at[1] ? 0 : f < at[2] ? 1 : 2;
  const [sw, sh] = CAP_SIZE.ig_sw2;
  const [cw, ch] = CAP_SIZE.ig_cal1;
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: '#0C0D10' }} />
      {k < 0 ? <Cap src="cap/ig_sw2.png" w={sw} h={sh} bottom={86} maxW={540} /> : null}
      {IG_STEPS.map((st, i) => (k === i ? <Cap key={i} src={st.cal} w={cw} h={ch} bottom={86} maxW={952} y={(1 - prog(f, at[i], 7, OUT)) * 40} o={prog(f, at[i], 5, OUT)} border="#2A2A2A" /> : null))}
      <CapBar right={<Count3 n={k + 1} flash={k >= 0 ? 1 - prog(f, at[k], 10, OUT) : 0} />}>
        {k < 0 ? (
          '계정 전환'
        ) : (
          <>
            <span style={{ color: BUTTER }}>{IG_STEPS[k as 0 | 1 | 2].h}</span> 예약 달력
          </>
        )}
      </CapBar>
    </>
  );
};

/** 05 틱톡(한 계정) → 샤오훙수 주소(로그인 화면) → rednote 주소(노트 관리). */
const TtXhs: React.FC<{ f: number }> = ({ f }) => {
  const xAt = wd('b3', 5) - 2; // 「샤오훙수는」
  const rAt = wd('b3', 7); // 「레드노트로」
  const stage = f < xAt ? 0 : f < rAt ? 1 : 2;
  const [tw, th] = CAP_SIZE.tt;
  const [xw, xh] = CAP_SIZE.xhs;
  const [rw, rh] = CAP_SIZE.rednote;
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: '#FFFFFF' }} />
      {stage === 0 ? (
        <UrlBarSimple text={URL_TT} />
      ) : (
        <UrlBarSwap f={f} at={rAt} />
      )}
      {stage === 0 ? <Cap src="cap/tt.png" w={tw} h={th} top={74} bottom={86} maxW={952} /> : null}
      {stage === 1 ? <Cap src="cap/xhs.png" w={xw} h={xh} top={74} bottom={86} maxW={560} o={prog(f, xAt, 6, OUT)} /> : null}
      {stage === 2 ? <Cap src="cap/rednote.png" w={rw} h={rh} top={74} bottom={86} maxW={952} o={prog(f, rAt + 2, 6, OUT)} y={(1 - prog(f, rAt + 2, 8, OUT)) * 30} /> : null}
      <CapBar>{stage === 0 ? <>틱톡 스튜디오 · 로그인된 계정 <span style={{ color: BUTTER }}>1개</span></> : stage === 1 ? '샤오훙수 · 로그인 화면' : <>rednote 주소 · <span style={{ color: BUTTER }}>열림</span></>}</CapBar>
    </>
  );
};

const URL_BAR: React.CSSProperties = { position: 'absolute', left: 0, right: 0, top: 0, height: 74, background: '#E9E7E1', borderBottom: '1px solid #E2DFD7' };
const Lock: React.FC = () => (
  <svg width={22} height={26} viewBox="0 0 22 26" style={{ position: 'absolute', left: 30, top: 24 }}>
    <rect x={2} y={11} width={18} height={13} rx={3} fill="none" stroke={UI_MUTED} strokeWidth={2.2} />
    <path d="M6 11 L6 7 Q6 2 11 2 Q16 2 16 7 L16 11" fill="none" stroke={UI_MUTED} strokeWidth={2.2} />
  </svg>
);
const UrlBarSimple: React.FC<{ text: string }> = ({ text }) => (
  <div style={URL_BAR}>
    <Lock />
    <div style={{ position: 'absolute', left: 68, top: 21, fontFamily: MONO, fontSize: 25, color: UI_INK, whiteSpace: 'nowrap' }}>{text}</div>
  </div>
);
const UrlBarSwap: React.FC<{ f: number; at: number }> = ({ f, at }) => {
  const p = prog(f, at - 4, 8, OUT);
  const mark = prog(f, at + 4, 8, OUT);
  return (
    <div style={{ ...URL_BAR, overflow: 'hidden' }}>
      <Lock />
      <div style={{ position: 'absolute', left: 68, top: 21, fontFamily: MONO, fontSize: 25, color: UI_INK, whiteSpace: 'nowrap', transform: `translateY(${-50 * p}px)`, opacity: 1 - p }}>{URL_XHS}</div>
      <div style={{ position: 'absolute', left: 68, top: 21, fontFamily: MONO, fontSize: 25, color: UI_INK, whiteSpace: 'nowrap', transform: `translateY(${50 * (1 - p)}px)`, opacity: p }}>
        {URL_RED_A}
        <span style={{ fontWeight: 700, backgroundImage: `linear-gradient(${BUTTER}, ${BUTTER})`, backgroundSize: `${mark * 100}% 6px`, backgroundPosition: '0 100%', backgroundRepeat: 'no-repeat' }}>{URL_RED_B}</span>
        {URL_RED_C}
      </div>
    </div>
  );
};

// ───────────── 2막: 「1일 1 컨텐츠」 → 월요일 스캔 → 세션 셋 → 올리기는 한 곳 → 매일 ─────────────
const ActTwo: React.FC = () => {
  const f = useCurrentFrame();
  let box = lerpBox(B_SAY, B_DOC, prog(f, S.s07, 12, OUT));
  const fold = wd('s1', 10); // 「한 번에」: 문서가 세션 목록으로 접힌다
  box = lerpBox(box, B_LIST, prog(f, fold - 2, 12, OUT));
  return (
    <Shell box={box} paper={1}>
      {/* 06: 대화창 — 앞의 답(흐림) + 유호님 두 문장(18:11) */}
      {f < S.s07 + 10 ? (
        <Swap outP={prog(f, S.s07, 8, IN)}>
          <PanelTop title={SESSION_TITLE} right="Claude" />
          <div style={{ position: 'absolute', left: 34, right: 120, top: 120, fontFamily: KO, fontWeight: 540, fontSize: 28, lineHeight: 1.45, color: UI_INK, opacity: 0.45, letterSpacing: '-0.015em' }}>
            <div style={{ fontFamily: MONO, fontSize: 20, color: UI_MUTED, marginBottom: 6 }}>17:53</div>
            {ANSWER}
          </div>
          <div style={{ position: 'absolute', left: 30, right: 30, top: 270, display: 'flex', flexDirection: 'column', gap: 22 }}>
            <MeBubble parts={[{ t: SAY1 }]} appear={prog(f, S.s06 + 10, 6, OUT)} size={30} time="18:11" />
            <MeBubble parts={[{ t: SAY2_A }, { t: SAY2_MARK, mark: prog(f, wd('t1', 5), 10, OUT) }, { t: SAY2_B }]} appear={prog(f, S.s06 + 22, 6, OUT)} size={30} time="18:11" />
          </div>
        </Swap>
      ) : null}
      {/* 07: 월요일 트렌드 스캔 추천 셋 → 오늘 실화 */}
      {f >= S.s07 && f < fold + 10 ? (
        <Swap inP={prog(f, S.s07 + 2, 8, OUT)} outP={prog(f, fold, 8, IN)}>
          <DocCard f={f} at={S.s07 + 2} picks={[wd('s1', 3) - 2, wd('s1', 3) + 3]} todayAt={wd('s1', 6)} />
        </Swap>
      ) : null}
      {/* 07 끝~09: 세션 목록 */}
      {f >= fold ? (
        <Swap inP={prog(f, fold + 2, 8, OUT)}>
          <ListTail f={f} fold={fold} />
        </Swap>
      ) : null}
    </Shell>
  );
};

/** 07 끝 ~ 09: 세 세션 → 「올리기」 꼬리표가 맨 위 줄로(한 곳에서) → 계정 칩이 바뀜 → 7칸 달력. */
const ListTail: React.FC<{ f: number; fold: number }> = ({ f, fold }) => {
  const tagAt = wd('s2', 0); // 「올리기만은」: 세 줄 오른쪽에 꼬리표
  const moveAt = wd('s2', 1) - 2; // 「한 곳에서」: 한꺼번에 맨 위 줄로
  const arrived = prog(f, moveAt + 10, 6, OUT);
  const swaps = [wd('s2', 4), wd('s2', 5) + 2, wd('s2', 6) + 4];
  const chip = f < swaps[1] + 3 ? 0 : f < swaps[2] + 3 ? 1 : 2;
  const chipBlur = Math.max(chipSwap(f, swaps[1]), chipSwap(f, swaps[2]));
  const strip = prog(f, S.s09, 8, OUT);
  return (
    <>
      <SessionList
        childIn={(i) => prog(f, fold + 4 + i * 3, 8, OUT)}
        parentGlow={arrived * (1 - prog(f, S.s09, 10, IN_OUT))}
        parentRight={f >= moveAt + 8 ? <PostRight o={arrived} name={POST_CHIPS[chip]} blur={chipBlur} /> : undefined}
      />
      {/* 「올리기」 꼬리표 셋 */}
      {f >= tagAt && f < moveAt + 12
        ? CHILDREN.map((_, i) => {
            const a = prog(f, tagAt + i * 2, 6, OUT);
            const m = prog(f, moveAt, 11, IN_OUT);
            const y = interpolate(m, [0, 1], [childY(i) + 18, ROW_TOP + 20], clamp);
            const x = interpolate(m, [0, 1], [742, 650], clamp);
            const o = a * (1 - prog(f, moveAt + 8, 4, IN));
            return (
              <div key={i} style={{ position: 'absolute', left: x, top: y, padding: '6px 16px', borderRadius: 12, background: '#2B2A26', color: '#F4F2EC', fontFamily: KO, fontWeight: 650, fontSize: 23, opacity: o, transform: `scale(${0.9 + 0.1 * a})` }}>
                올리기
              </div>
            );
          })
        : null}
      {/* 09: 다른 세션 줄을 덮고 7칸 달력 */}
      {strip > 0 ? <div style={{ position: 'absolute', left: 0, right: 0, top: 500, bottom: 0, background: '#F6F5F1', opacity: strip }} /> : null}
      {strip > 0 ? <DayStrip f={f} at={S.s09} everyAt={wd('e1b', 1)} top={520} /> : null}
    </>
  );
};

// ───────────── 무대 아래 표시 ─────────────
const Label: React.FC = () => {
  const f = useCurrentFrame();
  const o = 1 - prog(f, S.s10, 6, IN);
  if (o <= 0) return null;
  let text = '재현 화면 · 문구와 시각은 실제';
  if (f >= ZERO_AT && f < S.s01) text = '실제 화면 · 17:45 Business Suite';
  else if (f >= S.s04 && f < S.s05) text = '실제 화면 · 17:48 인스타 웹';
  else if (f >= S.s05 && f < wd('b3', 5) - 2) text = '실제 화면 · 17:50 틱톡 스튜디오';
  else if (f >= wd('b3', 5) - 2 && f < S.s06) text = '실제 화면 · 17:51 샤오훙수 · 주소줄은 재현';
  return <div style={{ position: 'absolute', left: 72, top: 1376, fontFamily: MONO, fontSize: 26, color: DIM, opacity: o }}>{text}</div>;
};

// ───────────── 소리 ─────────────
type Hit = { at: number; src: string; v: number };
const hits = (): Hit[] => [
  ...[0, 2, 4, 6, 8, 10].map((i) => ({ at: stagger(CHECK_A, i, CHANNELS.length, CHECK_B - CHECK_A, 1), src: 'sfx/tick.wav', v: 0.12 })),
  { at: ZERO_AT, src: 'sfx/thud.wav', v: 0.5 },
  { at: ZERO_AT + 3, src: 'sfx/pop.wav', v: 0.3 },
  { at: S.s01, src: 'sfx/swish.wav', v: 0.32 },
  ...[0, 1, 2].map((i) => ({ at: S.rows + i * 4, src: 'sfx/tok.wav', v: 0.32 })),
  { at: wd('h3', 1), src: 'sfx/snap.wav', v: 0.4 },
  { at: S.rew - 2, src: 'sfx/whoosh_rev.wav', v: 0.34 },
  { at: wd('c1', 6), src: 'sfx/pop.wav', v: 0.36 },
  { at: S.s03, src: 'sfx/swish.wav', v: 0.32 },
  { at: wd('b1', 2), src: 'sfx/tok.wav', v: 0.32 },
  { at: wd('b1', 6), src: 'sfx/tick2.wav', v: 0.3 },
  { at: wd('b1', 7) + 2, src: 'sfx/thud.wav', v: 0.2 },
  { at: wd('b1', 8) + 2, src: 'sfx/tick2.wav', v: 0.3 },
  { at: S.s04, src: 'sfx/swish.wav', v: 0.3 },
  ...IG_AT().map((at) => ({ at, src: 'sfx/whoosh_side.wav', v: 0.22 })),
  { at: IG_AT()[2] + 1, src: 'sfx/pop.wav', v: 0.3 },
  { at: S.s05, src: 'sfx/swish.wav', v: 0.3 },
  { at: wd('b3', 5) - 2, src: 'sfx/tok.wav', v: 0.3 },
  { at: wd('b3', 7), src: 'sfx/snap.wav', v: 0.4 },
  { at: S.s06, src: 'sfx/swish.wav', v: 0.34 },
  { at: S.s06 + 10, src: 'sfx/pop.wav', v: 0.26 },
  { at: S.s06 + 22, src: 'sfx/pop.wav', v: 0.26 },
  { at: wd('t1', 5), src: 'sfx/snap.wav', v: 0.36 },
  { at: S.s07, src: 'sfx/swish.wav', v: 0.28 },
  { at: wd('s1', 3) - 2, src: 'sfx/tick.wav', v: 0.25 },
  { at: wd('s1', 3) + 3, src: 'sfx/tick.wav', v: 0.25 },
  { at: wd('s1', 6), src: 'sfx/tick.wav', v: 0.25 },
  { at: wd('s1', 10) - 2, src: 'sfx/pop.wav', v: 0.36 },
  { at: wd('s2', 0), src: 'sfx/tok.wav', v: 0.3 },
  { at: wd('s2', 1) - 2, src: 'sfx/whoosh_side.wav', v: 0.24 },
  { at: wd('s2', 1) + 8, src: 'sfx/tok.wav', v: 0.4 },
  { at: wd('s2', 5) + 2, src: 'sfx/tick2.wav', v: 0.26 },
  { at: wd('s2', 6) + 4, src: 'sfx/tick2.wav', v: 0.26 },
  { at: S.s09, src: 'sfx/swish.wav', v: 0.18 },
  ...[0, 1, 2, 3, 4, 5].map((i) => ({ at: wd('e1b', 1) + i * 3, src: 'sfx/tick.wav', v: 0.14 })),
  { at: S.s10, src: 'sfx/swish.wav', v: 0.45 },
  { at: END_FOLLOW, src: 'sfx/tok.wav', v: 0.55 },
];

export const Day1Film: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const ranges = LINES.map((id) => [VO[id], lineEnd(id)] as [number, number])
    .sort((p, q) => p[0] - q[0])
    .reduce<[number, number][]>((acc, [a, b]) => {
      const last = acc[acc.length - 1];
      if (last && a - last[1] < 20) last[1] = Math.max(last[1], b);
      else acc.push([a, b]);
      return acc;
    }, []);
  // 되감기 한 박만 배경음을 비운다(Fable L)
  const hollow = (fr: number) => interpolate(fr, [S.rew - 3, S.rew + 2, S.rew + 13, S.rew + 18], [1, 0.45, 0.45, 1], clamp);
  const bgmVolume = (fr: number) => {
    const tail = Math.min(1, (TOTAL - fr) / 20) * hollow(fr);
    const voice = Math.max(0, ...ranges.map(([a, b]) => interpolate(fr, [a - 10, a, b, b + 10], [0, 1, 1, 0], clamp)));
    return (0.45 - 0.14 * voice) * tail;
  };
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <Label />
      <StripOut at={S.s06}>
        <ActOne />
      </StripOut>
      <StripIn at={S.s06}>
        <StripOut at={S.s10}>
          <ActTwo />
        </StripOut>
      </StripIn>
      <StripIn at={S.s10}>
        <EndCard />
      </StripIn>
      <Heads />
      {LINES.map((id) => (
        <Sequence key={id} from={VO[id]} layout="none">
          <Audio src={staticFile(`vo/${id}.wav`)} />
        </Sequence>
      ))}
      {hits().map((x, i) => (
        <Sequence key={i} from={x.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(x.src)} volume={x.v} />
        </Sequence>
      ))}
      {bgm ? <Audio src={staticFile('bgm.wav')} volume={bgmVolume} /> : null}
    </AbsoluteFill>
  );
};

export { INK };
