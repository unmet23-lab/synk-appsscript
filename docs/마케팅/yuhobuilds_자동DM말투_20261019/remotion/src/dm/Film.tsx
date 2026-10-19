// yuhobuilds 「자동 DM에서 AI 티 지우기」 본편(10-19). 만족 사례 S22(세션 공유 편 v14) 문법 그대로:
// 검정 무대 위 밝은 판 하나가 끝까지 변형, 머리글이 곧 내레이션(말한 낱말 안에서만), 버터 한 곳, 0~3초 문제 → 되감기 → 해결,
// 막이 바뀌는 두 곳(문제 → 해결, 해결 → 끝)만 한 장으로 이어 위로 넘긴다. 사건은 잘라 붙인 배경음의 박 격자 위.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { BUTTER, DIM, STAGE } from '../film/parts';
import { KO, MONO } from '../lib/fonts';
import { clamp, IN, IN_OUT, OUT, prog, stagger } from '../lib/motion';
import { Headline, lerpBox, Shell, StripIn, StripOut, Swap, type Box, type HW } from '../full/kit';
import { CHECKS, ESCALATE, EXAMPLES, FIRST_DM_HEAD, FIRST_DM_TAIL, FOLLOW, HOOK, INBOX_N, MAIL_SUBJECT } from './data';
import { EndCard, END_FOLLOW } from './End';
import { Bubble, ChatHeader, CheckRow, glyphs, HiddenQuestion, InboxRow, MailCard, RULE, Typing, UI_INK, UI_MUTED, type Seg } from './parts';
import { LINES, lineEnd, S, TOTAL, VO, wd, wdEnd, type Line } from './time';

const CHAT: Box = { x: 64, y: 590, w: 952, h: 730, r: 34 };
const LIST: Box = { x: 64, y: 570, w: 952, h: 770, r: 30 };
const PAIR: Box = { x: 64, y: 790, w: 952, h: 500, r: 34 };

const OLD_LEN = glyphs(HOOK.oldHead + HOOK.oldRest + HOOK.oldPath + HOOK.oldTail).length;
const NEU_LEN = glyphs(HOOK.neuHead + HOOK.neuRest).length;
const TYPE_AT = VO.sum + 6; // 지금 답이 차오르기 시작

// ───────────── 머리글 ─────────────
const h = (t: string, id: Line, i: number, accent?: boolean | number): HW => ({ t, at: wd(id, i), accent: accent === true ? wd(id, i) : typeof accent === 'number' ? accent : undefined });

const Heads: React.FC = () => {
  const f = useCurrentFrame();
  const big = { fontSize: 80 };
  return (
    <>
      {/* 00: 0프레임부터 두 줄(표지 노릇), 「아니요」 낱말에 버터 */}
      {f < S.rew + 10 ? (
        <Headline
          lines={[
            [{ t: '괜찮냐고', at: -12 }, { t: '물으면,', at: -12 }],
            [{ t: '제', at: -12 }, { t: '자동', at: -12 }, { t: 'DM은', at: -12 }, { t: '"아니요"부터', at: -12, accent: wd('h1', 5) }],
          ]}
          out={S.rew - 2}
          style={big}
        />
      ) : null}
      {f >= VO.sum - 4 && f < VO.c1 + 10 ? <Headline lines={[[h('지금은', 'sum', 0), h('이렇게', 'sum', 1), h('답해요', 'sum', 2)]]} out={VO.c1 - 4} style={big} /> : null}
      {/* 02: 숫자 두 벌(SUIT는 →를 꺾쇠로 그려 쓰지 않는다 — 말한 낱말 「댓글에서 답글까지」 그대로) */}
      {f >= VO.c1 - 4 && f < wd('c1', 10) + 4 ? <Headline lines={[[h("'세션'", 'c1', 3), h('댓글', 'c1', 4), h('14개,', 'c1', 5)], [h('DM', 'c1', 7), h('14통', 'c1', 8)]]} out={wd('c1', 10) - 9} style={big} /> : null}
      {f >= wd('c1', 10) - 2 && f < S.s03 + 10 ? <Headline lines={[[h('댓글에서', 'c1', 10), h('답글까지', 'c1', 11)], [h('평균', 'c1', 12), h('18초', 'c1', 13, true)]]} out={S.s03 - 4} style={big} /> : null}
      {f >= VO.t1 - 4 && f < S.s04 + 10 ? <Headline lines={[[h('받는', 't1', 1), h('쪽에서', 't1', 2), h('읽어', 't1', 3), h('보니,', 't1', 4)], [h('너무', 't1', 5), h('기계', 't1', 6, true), h('같았어요', 't1', 7, wd('t1', 6))]]} out={S.s04 - 4} style={big} /> : null}
      {f >= VO.d1 - 4 && f < S.s05 + 10 ? <Headline lines={[[h('한', 'd1', 3), h('줄씩', 'd1', 4), h('다시', 'd1', 5), h('읽었더니,', 'd1', 6)], [h('일곱', 'd1', 7, true), h('군데가', 'd1', 8), h('걸렸어요', 'd1', 9)]]} out={S.s05 - 4} style={big} /> : null}
      {/* 05: 말이 인용하는 대목만(말한 낱말 그대로) */}
      {f >= wd('d2', 2) - 4 && f < wd('d2', 5) + 6 ? <Headline lines={[[h("'그만", 'd2', 2), h("받으려면'", 'd2', 3)]]} out={wd('d2', 5) - 6} top={380} style={big} /> : null}
      {f >= wd('d2', 8) - 4 && f < wd('d2', 10) + 6 ? <Headline lines={[[h("'답드리기", 'd2', 8), h("어려워요'", 'd2', 9)]]} out={wd('d2', 10) - 6} top={380} style={big} /> : null}
      {f >= wd('d2', 13) - 4 && f < S.fix + 6 ? <Headline lines={[[h('답이', 'd2', 13), h('없었어요', 'd2', 14)]]} out={S.fix - 6} top={380} style={big} /> : null}
      {f >= VO.d3 - 4 && f < S.s06 ? <Headline lines={[[h('다', 'd3', 0), h('고쳤어요', 'd3', 1, true)]]} out={S.s06 - 8} top={380} style={big} /> : null}
      {f >= S.s06 + 6 && f < S.s07 + 10 ? (
        <Headline lines={[[h('정해진', 'e1', 1), h('답에', 'e1', 2), h('없는', 'e1', 3), h('질문은,', 'e1', 4)], [h('Claude가', 'e1', 6), h('앞', 'e1', 7), h('대화를', 'e1', 8), h('읽고', 'e1', 9)], [h('이어서', 'e1', 10, true)]]} out={S.s07 - 4} top={250} style={{ fontSize: 76 }} />
      ) : null}
      {f >= VO.e2 - 4 && f < S.s08 + 10 ? (
        <Headline lines={[[h('모르는', 'e2', 0), h('건', 'e2', 1)], [h('"직접', 'e2', 2, true), h('확인해서', 'e2', 3, wd('e2', 2))], [h('답드릴게요"', 'e2', 4, wd('e2', 2))]]} out={S.s08 - 4} top={250} style={{ fontSize: 76 }} />
      ) : null}
      {f >= VO.f1 - 4 && f < S.s09 + 2 ? <Headline lines={[[h('AI', 'f1', 0), h('티는', 'f1', 1), h('기능이', 'f1', 2), h('아니라,', 'f1', 3)], [h('받는', 'f1', 4), h('사람이', 'f1', 5), h('읽는', 'f1', 6)], [h('한', 'f1', 7), h('줄에서', 'f1', 8)]]} out={S.s09 - 6} top={290} /> : null}
    </>
  );
};

// ───────────── 1막: 훅 → 숫자 → 꼬리 → 일곱 → 예시 셋 → 다 고침 ─────────────
const ActOne: React.FC = () => {
  const f = useCurrentFrame();
  let box = lerpBox(CHAT, LIST, prog(f, S.s02, 12, OUT));
  box = lerpBox(box, CHAT, prog(f, S.s05, 12, OUT));
  // 카메라: 「아니요」 말풍선 쪽으로 천천히 밀고, 되감기에 풀었다가 지금 답 테두리 박에 한 번 더(1.12배 이하)
  // 0프레임부터 천천히 민다(검수 P3: 0~2초 화면 변화가 점 셋뿐)
  const push = 0.05 * prog(f, 0, S.rew, IN_OUT) * (1 - prog(f, S.rew, 12, IN_OUT)) + 0.04 * prog(f, S.newAccent - 2, 8, OUT) * (1 - prog(f, S.s02 - 6, 10, IN_OUT));
  return (
    <div style={{ position: 'absolute', inset: 0, transform: push > 1e-4 ? `scale(${1 + push})` : undefined, transformOrigin: '430px 960px' }}>
      <Shell box={box} paper={1}>
        {f < S.s02 + 12 ? (
          <Swap outP={prog(f, S.s02, 10, IN)}>
            <HookChat f={f} />
          </Swap>
        ) : null}
        {f >= S.s02 && f < S.s04 + 10 ? (
          <Swap inP={prog(f, S.s02 + 2, 8, OUT)} outP={prog(f, S.s04, 8, IN)}>
            <Inbox f={f} />
          </Swap>
        ) : null}
        {f >= S.s04 && f < S.s05 + 10 ? (
          <Swap inP={prog(f, S.s04 + 2, 8, OUT)} outP={prog(f, S.s05, 8, IN)}>
            <Checklist f={f} />
          </Swap>
        ) : null}
        {f >= S.s05 ? <Examples f={f} /> : null}
      </Shell>
    </div>
  );
};

/** 00·01: 같은 질문에 옛 답 → 되감김 → 지금 답. */
const HookChat: React.FC<{ f: number }> = ({ f }) => {
  const oldAt = wd('h1', 5);
  const rewP = prog(f, S.rew, 14, IN_OUT);
  const oldShown = Math.round(OLD_LEN * (1 - rewP));
  const typed = Math.round(interpolate(f, [TYPE_AT, TYPE_AT + 26], [0, NEU_LEN], { ...clamp, easing: OUT }));
  const oldSegs: Seg[] = [{ t: HOOK.oldHead, mark: prog(f, oldAt, 8, OUT) }, { t: HOOK.oldRest }, { t: HOOK.oldPath, nowrap: true }, { t: HOOK.oldTail }];
  return (
    <>
      <ChatHeader />
      <div style={{ position: 'absolute', left: 34, right: 34, top: 140, display: 'flex', flexDirection: 'column', gap: 26 }}>
        <Bubble me segs={[{ t: HOOK.q }]} />
        {f >= 24 && f < oldAt ? <Typing f={f} at={24} /> : null}
        {f >= oldAt && f < S.rew + 14 && oldShown > 0 ? <Bubble segs={oldSegs} shown={oldShown} appear={prog(f, oldAt, 6, OUT)} /> : null}
        {f >= S.rew + 12 && f < TYPE_AT ? <Typing f={f} at={S.rew + 12} /> : null}
        {f >= TYPE_AT ? <Bubble segs={[{ t: HOOK.neuHead, mark: prog(f, S.newAccent, 8, OUT) }, { t: HOOK.neuRest }]} shown={typed} appear={prog(f, TYPE_AT, 5, OUT)} /> : null}
      </div>
    </>
  );
};

/** 02·03: 보낸 DM 14줄 → 「보냄」 → 조용해지는 박에 미리보기가 같은 꼬리 줄로. */
const Inbox: React.FC<{ f: number }> = ({ f }) => {
  const rowsEnd = wdEnd('c1', 6);
  const sentA = wd('c1', 7);
  const sentB = wdEnd('c1', 9);
  const tail = prog(f, S.s03, 4, OUT);
  return (
    <>
      <div style={{ position: 'absolute', left: 32, top: 22, fontFamily: KO, fontWeight: 680, fontSize: 31, color: UI_INK, letterSpacing: '-0.02em' }}>yuhobuilds · 보낸 DM</div>
      <div style={{ position: 'absolute', right: 32, top: 28, fontFamily: MONO, fontSize: 22, color: UI_MUTED }}>10-18 「세션」 댓글</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 76, height: 1, background: RULE }} />
      {Array.from({ length: INBOX_N }, (_, i) => (
        <InboxRow
          key={i}
          i={i}
          top={90 + i * 48}
          appear={prog(f, stagger(S.s02 + 4, i, INBOX_N, rowsEnd - S.s02 - 4), 7, OUT)}
          sent={prog(f, stagger(sentA, i, INBOX_N, sentB - sentA), 4, OUT)}
          tail={tail}
          head={FIRST_DM_HEAD}
          tailText={FIRST_DM_TAIL}
        />
      ))}
    </>
  );
};

/** 04: 일곱 줄 점검표(인계 1~7 그대로). */
const Checklist: React.FC<{ f: number }> = ({ f }) => {
  const a = S.s04 + 3;
  const crossA = wd('d1', 7);
  const crossB = wdEnd('d1', 9);
  return (
    <>
      <div style={{ position: 'absolute', left: 32, top: 22, fontFamily: KO, fontWeight: 680, fontSize: 31, color: UI_INK, letterSpacing: '-0.02em' }}>받는 사람 화면으로 다시 읽기</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 76, height: 1, background: RULE }} />
      {CHECKS.map((label, i) => (
        <CheckRow key={i} n={i + 1} label={label} top={92 + i * 88} appear={prog(f, stagger(a, i, CHECKS.length, crossA - a - 4), 7, OUT)} cross={prog(f, stagger(crossA, i, CHECKS.length, crossB - crossA), 6, OUT)} />
      ))}
    </>
  );
};

/** 05: 예시 셋(점검표 2·4·5번) → 「다 고쳤어요」에 지금 나가는 정해진 답 셋. */
const Examples: React.FC<{ f: number }> = ({ f }) => {
  const starts = [wd('d2', 0) - 2, wd('d2', 5) - 2, wd('d2', 10) - 2];
  const k = f < starts[1] ? 0 : f < starts[2] ? 1 : 2;
  const ex = EXAMPLES[k];
  const s = starts[k];
  const oldAt = [wd('d2', 1), wd('d2', 7), wd('d2', 12)][k];
  const markAt = [wd('d2', 2), wd('d2', 8), wd('d2', 13)][k];
  const seg: Seg[] = [];
  if (ex.old) {
    ex.old.forEach((line, li) => {
      const text = (li > 0 ? '\n' : '') + line;
      if (ex.mark && line.includes(ex.mark)) {
        const [pre, post] = text.split(ex.mark);
        seg.push({ t: pre }, { t: ex.mark, mark: prog(f, markAt, 10, OUT) }, { t: post });
      } else seg.push({ t: text });
    });
  }
  // 예시가 바뀔 때: 앞 예시는 위로 빠지고 새 예시가 아래에서 올라온다(같은 창, 내용만)
  const swapIn = prog(f, s, 7, OUT);
  const exOut = prog(f, S.fix - 2, 8, IN);
  return (
    <>
      {f < S.fix + 8 ? (
        <div style={{ position: 'absolute', inset: 0, opacity: (k === 0 ? prog(f, S.s05 + 4, 8, OUT) : 1) * (1 - exOut) }}>
          <ChatHeader right={`${ex.check + 1} · ${CHECKS[ex.check]}`} />
          <div style={{ position: 'absolute', left: 34, right: 34, top: 140, display: 'flex', flexDirection: 'column', gap: 26, opacity: swapIn, transform: `translateY(${(1 - swapIn) * 36}px)` }}>
            <Bubble me segs={[{ t: ex.q }]} appear={prog(f, s + 2, 6, OUT)} />
            {ex.old ? <Bubble segs={seg} appear={prog(f, oldAt, 6, OUT)} /> : f >= oldAt ? <NoReply f={f} at={oldAt} end={markAt + 8} /> : null}
          </div>
        </div>
      ) : null}
      {f >= S.fix - 2 ? <FixedStack f={f} at={S.fix} /> : null}
    </>
  );
};

/** 「에러 떠요」: 점 셋이 떴다가 아무것도 오지 않고 꺼진다 → 「답 없음」. */
const NoReply: React.FC<{ f: number; at: number; end: number }> = ({ f, at, end }) => {
  const dots = 1 - prog(f, end - 6, 6, IN);
  return (
    <div style={{ position: 'relative', height: 100 }}>
      {dots > 0 ? <Typing f={f} at={at} opacity={dots} /> : null}
      <div style={{ position: 'absolute', left: 70, top: 32, fontFamily: MONO, fontSize: 28, color: UI_MUTED, opacity: prog(f, end - 2, 6, OUT) }}>답 없음</div>
    </div>
  );
};

/** 「다 고쳤어요」: 지금 나가는 정해진 답 셋(첫 문장). */
const FixedStack: React.FC<{ f: number; at: number }> = ({ f, at }) => (
  <>
    <div style={{ position: 'absolute', left: 32, top: 24, fontFamily: KO, fontWeight: 680, fontSize: 31, color: UI_INK, letterSpacing: '-0.02em', opacity: prog(f, at, 6, OUT) }}>지금 나가는 정해진 답</div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 78, height: 1, background: RULE, opacity: prog(f, at, 6, OUT) }} />
    <div style={{ position: 'absolute', left: 30, right: 30, top: 104, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {EXAMPLES.map((ex, i) => {
        const a = prog(f, at + i * 4, 8, OUT);
        return (
          <div key={i} style={{ opacity: a, transform: `translateY(${(1 - a) * 22}px)`, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Bubble me segs={[{ t: ex.q }]} size={28} />
            <Bubble segs={[{ t: ex.neu }]} size={31} width={780} />
          </div>
        );
      })}
    </div>
  </>
);

// ───────────── 2막: 이어 답하기 → 다른 대화의 직접 확인·알림 → 두 말풍선 ─────────────
const ActTwo: React.FC = () => {
  const f = useCurrentFrame();
  const box = lerpBox(CHAT, PAIR, prog(f, S.s08, 12, OUT));
  const q2 = prog(f, wd('e1', 5), 6, OUT);
  const a2At = wd('e1', 10);
  const a2Len = glyphs(FOLLOW[3].t).length;
  const a2Shown = Math.round(interpolate(f, [a2At, a2At + 22], [0, a2Len], { ...clamp, easing: OUT }));
  // 「앞 대화를」: 첫 답에 버터 테두리 → 둘째 답이 차오른 뒤 풀린다
  const prev = prog(f, wd('e1', 7), 8, OUT) * (1 - prog(f, a2At + 16, 10, IN_OUT));
  const other = prog(f, S.s07, 8, OUT);
  const escAt = wd('e2', 2) - 2;
  return (
    <Shell box={box} paper={1}>
      {/* 06: 실제 시험 대화 */}
      {f < S.s07 + 10 ? (
        <Swap outP={prog(f, S.s07, 8, IN)}>
          <ChatHeader right="시험 계정과의 대화" />
          <div style={{ position: 'absolute', left: 34, right: 34, top: 136, display: 'flex', flexDirection: 'column', gap: 22 }}>
            <Bubble me segs={[{ t: FOLLOW[0].t }]} size={32} />
            <Bubble segs={[{ t: FOLLOW[1].t }]} size={32} width={760} outline={prev} />
            <Bubble me segs={[{ t: FOLLOW[2].t }]} size={32} appear={q2} />
            {f >= a2At - 8 ? f < a2At ? <Typing f={f} at={a2At - 8} /> : <Bubble segs={[{ t: FOLLOW[3].t }]} shown={a2Shown} size={32} width={760} /> : null}
          </div>
        </Swap>
      ) : null}
      {/* 07: 다른 대화(재현) — 안내 자료에 없는 질문(글은 가림) → 고정 답 → 알림 메일 */}
      {f >= S.s07 && f < S.s08 + 10 ? (
        <Swap inP={other} outP={prog(f, S.s08, 8, IN)}>
          <ChatHeader right="다른 대화" />
          <div style={{ position: 'absolute', left: 34, right: 34, top: 300, display: 'flex', flexDirection: 'column', gap: 26 }}>
            <HiddenQuestion appear={prog(f, S.s07 + 4, 7, OUT)} />
            {f >= escAt ? <Bubble segs={[{ t: ESCALATE }]} appear={prog(f, escAt, 6, OUT)} /> : null}
          </div>
          <MailCard f={f} at={wd('e2', 6)} subject={MAIL_SUBJECT} />
        </Swap>
      ) : null}
      {/* 08: 두 말풍선만 — 「한」에 지금 답 테두리 */}
      {f >= S.s08 ? (
        <Swap inP={prog(f, S.s08 + 4, 8, OUT)}>
          <div style={{ position: 'absolute', left: 34, right: 34, top: 40, display: 'flex', flexDirection: 'column', gap: 30 }}>
            <Bubble segs={[{ t: HOOK.oldHead }, { t: HOOK.oldRest }, { t: HOOK.oldPath, nowrap: true }, { t: '은 건드리지 않아요. …' }]} dim={0.75} />
            <Bubble segs={[{ t: HOOK.neuHead }, { t: HOOK.neuRest }]} outline={prog(f, wd('f1', 7), 8, OUT)} />
          </div>
        </Swap>
      ) : null}
    </Shell>
  );
};

// ───────────── 무대 아래 표시 ─────────────
const Label: React.FC = () => {
  const f = useCurrentFrame();
  const o = 1 - prog(f, S.s09, 6, IN);
  if (o <= 0) return null;
  return <div style={{ position: 'absolute', left: 72, top: 1374, fontFamily: MONO, fontSize: 26, color: DIM, opacity: o }}>재현 화면 · 문구는 실제</div>;
};

// ───────────── 소리 ─────────────
type Hit = { at: number; src: string; v: number };
const hits = (): Hit[] => [
  { at: wd('h1', 5), src: 'sfx/thud.wav', v: 0.5 },
  { at: S.rew - 3, src: 'sfx/whoosh_rev.wav', v: 0.34 },
  { at: S.newAccent, src: 'sfx/snap.wav', v: 0.3 },
  { at: S.s02, src: 'sfx/swish.wav', v: 0.35 },
  ...[0, 3, 6, 9, 12].map((i) => ({ at: stagger(S.s02 + 4, i, INBOX_N, wdEnd('c1', 6) - S.s02 - 4), src: 'sfx/tick.wav', v: 0.13 })),
  { at: wd('c1', 13), src: 'sfx/pop.wav', v: 0.38 },
  { at: S.s03, src: 'sfx/snap.wav', v: 0.4 },
  { at: S.s04, src: 'sfx/swish.wav', v: 0.32 },
  ...CHECKS.map((_, i) => ({ at: stagger(wd('d1', 7), i, CHECKS.length, wdEnd('d1', 9) - wd('d1', 7)), src: 'sfx/tick2.wav', v: 0.15 })),
  { at: wd('d2', 2), src: 'sfx/tok.wav', v: 0.4 },
  { at: wd('d2', 5) - 2, src: 'sfx/whoosh_side.wav', v: 0.22 },
  { at: wd('d2', 8), src: 'sfx/tok.wav', v: 0.4 },
  { at: wd('d2', 10) - 2, src: 'sfx/whoosh_side.wav', v: 0.22 },
  { at: wd('d2', 14) + 6, src: 'sfx/thud.wav', v: 0.35 },
  { at: S.fix, src: 'sfx/pop.wav', v: 0.42 },
  { at: S.s06, src: 'sfx/swish.wav', v: 0.5 },
  { at: wd('e1', 7), src: 'sfx/whoosh_side.wav', v: 0.24 },
  { at: wd('e1', 10), src: 'sfx/tick.wav', v: 0.18 },
  { at: S.s07, src: 'sfx/swish.wav', v: 0.28 },
  { at: wd('e2', 2) - 2, src: 'sfx/pop.wav', v: 0.3 },
  { at: wd('e2', 6), src: 'sfx/tick2.wav', v: 0.32 },
  { at: S.s08, src: 'sfx/swish.wav', v: 0.28 },
  { at: wd('f1', 7), src: 'sfx/snap.wav', v: 0.38 },
  { at: S.s09, src: 'sfx/swish.wav', v: 0.45 },
  { at: END_FOLLOW, src: 'sfx/tok.wav', v: 0.55 },
];

export const DmFilm: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const ranges = LINES.map((id) => [VO[id], lineEnd(id)] as [number, number])
    .sort((p, q) => p[0] - q[0])
    .reduce<[number, number][]>((acc, [a, b]) => {
      const last = acc[acc.length - 1];
      if (last && a - last[1] < 20) last[1] = Math.max(last[1], b);
      else acc.push([a, b]);
      return acc;
    }, []);
  // 되감는 동안 배경음을 비우고 지금 답이 차오를 때 돌아온다(S22 01)
  const hollow = (fr: number) => interpolate(fr, [S.rew - 3, S.rew + 2, TYPE_AT - 2, TYPE_AT + 4], [1, 0.45, 0.45, 1], clamp);
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
        <StripOut at={S.s09}>
          <ActTwo />
        </StripOut>
      </StripIn>
      <StripIn at={S.s09}>
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
