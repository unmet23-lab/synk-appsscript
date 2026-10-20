// yuhobuilds 첫날 편 v7(10-20 밤) — 유호님 피드백 「시청자입장에서 얻어갈수있는게 … 궁금하게 시작」, 「제대로된 정보나 해결책」.
// 「우리가 한 일」(v6) 대신 「따라 할 구조」: 0초 약속(제 몫은 "올려" 한 마디) → 증거(오늘 세 편) + 고리(끝에 체크리스트) →
// ① 소재 ② 제작 ③ 게시(단계마다 맡길 것 + 막힌 곳 하나, 실제 값) → 체크리스트(고리를 닫음) → 저장·팔로우.
// 문법은 S22 그대로: 검정 무대 위 판 하나, 머리글이 곧 내레이션(말한 낱말 안에서만), 버터 한 곳. 판 속 내용은 1.5~2초마다 바뀐다.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { BUTTER, DIM, INK, STAGE } from '../film/parts';
import { EN, KO, MONO } from '../lib/fonts';
import { clamp, IN, IN_OUT, OUT, prog } from '../lib/motion';
import { Shell, StripIn, StripOut, Swap, type Box } from '../full/kit';
import { KHeadline, type Kind, type KW } from './KHead';
import { Cap, CAP_SIZE, MeBubble, PanelTop, SessionList, TileGrid, TILE, UI_INK, UI_MUTED, RULE, ME_INK, childY, ROW_TOP } from '../day1/parts';
import { SESSION_TITLE } from '../day1/data';
import { EndCard, END_FOLLOW } from './End';
import { LINES, lineEnd, S, TOTAL, VO, wd, type Spoken } from './time';

const B: Box = { x: 64, y: 600, w: 952, h: 640, r: 30 };
const PW = 952;

// ───────────── 실제 값 ─────────────
/** 예약 작업(앱 「예약된 작업」의 실제 제목·시각, list_scheduled_tasks 10-20 20:2x). */
const TASKS = [
  { t: '【매주 월요일】 SYNK 트렌드 스캔 · Argon 수집 검수', at: '월 09:30' },
  { t: '【매일 07:00】 SYNK LAB 오늘 편 만들기', at: '매일 07:00' },
  { t: '【매일 07:05】 synkbrief 오늘 편 + SYNK SHIFT 블로그 글', at: '매일 07:05' },
  { t: '【매일 07:10】 yuhobuilds 오늘 편 만들기', at: '매일 07:10' },
  { t: '【매일 14:00】 예약 큐 — 새 편 「올려」 받으면 슬롯대로 예약', at: '매일 14:00' },
] as const;
/** 월요일 트렌드 스캔 10-19 §3 후보 7개의 브랜드와 트리거(표의 굵은 글). */
const CANDS = [
  { b: 'yuhobuilds', tr: ['실화', '트렌드'] },
  { b: 'LAB 영어', tr: ['달력', '트렌드', '질문'] },
  { b: 'LAB 스페인어', tr: ['달력'] },
  { b: 'LAB 몽골', tr: ['질문', '트렌드'] },
  { b: 'yuhobuilds', tr: ['트렌드', '실화'] },
  { b: 'synkbrief', tr: ['보도', '질문', '트렌드'] },
  { b: 'synkbrief', tr: ['질문', '달력'] },
] as const;
const TRIG = ['트렌드', '질문', '달력', '실화'] as const;
/** 예약 큐(node tools/예약큐.js 10-20 20:2x 실제 출력). */
const Q_DATES = ['10-20', '10-21', '10-22', '10-23', '10-24'] as const;
const Q_BRANDS = ['LAB', 'synkbrief', 'yuhobuilds', 'SHIFT'] as const;
/** 조율 세션 기록의 실제 문구(18:12:57 한도, 18:15:39 유호님). */
const LIMIT_LINE = "You've hit your session limit · resets 8:20pm (Asia/Seoul)";
const THREE = [
  { src: 'thumb/lab.png', label: 'LAB · 관용구 퀴즈 #4' },
  { src: 'thumb/brief.png', label: 'synkbrief · 음식 사진' },
  { src: 'thumb/yuho_v7.png', label: 'yuhobuilds · 이 영상' },
] as const;
const CHECK = [
  { t: '월요일: 한 주 소재 목록', s: '트렌드 · 받은 질문 · 달력 · 내 실화', at: () => wd('c1', 2) },
  { t: '매일 같은 시각: 브랜드마다 한 편', s: '아침 7시로 걸어 둠', at: () => wd('c1', 4) },
  { t: '최종본 보고 「올려」 한 번', s: '사람 몫은 여기만', at: () => wd('c1', 6) },
  { t: '4일 치 예약 비축', s: '올리기는 한 창에서 차례로', at: () => wd('c1', 9) },
] as const;

// ───────────── 머리글 ─────────────
/** 키네틱 낱말: 말한 시각(at)에 팝, mark는 형광펜(말한 시각에). */
const k = (t: string, id: Spoken, i: number, opt: { mark?: boolean | number; kind?: Kind; from?: number; to?: number } = {}): KW => ({
  t,
  at: wd(id, i),
  mark: opt.mark === true ? wd(id, i) : typeof opt.mark === 'number' ? opt.mark : undefined,
  kind: opt.kind,
  from: opt.from,
  to: opt.to,
});

const Heads: React.FC = () => {
  const f = useCurrentFrame();
  const show = (a: number, b: number) => f >= a && f < b;
  return (
    <>
      {/* 0프레임부터 약속 세 줄(표지 노릇). 「자동화」에 밑줄, 「"올려"」에 형광펜 + 위로 튐 */}
      {show(-1, VO.h2 + 4) ? (
        <KHeadline
          lines={[
            [{ t: 'SNS', at: -12 }, { t: '업로드', at: -12 }, { t: '자동화,', at: -12, kind: 'under', mark: wd('h1', 2) }],
            [{ t: '사람이', at: -12 }, { t: '할', at: -12 }, { t: '일은', at: -12 }],
            [{ t: '"올려"', at: -12, mark: wd('h1', 6), kind: 'up' }, { t: '한', at: -12 }, { t: '마디', at: -12 }],
          ]}
          out={VO.h2 - 10}
          size={74}
        />
      ) : null}
      {show(VO.h2 - 4, wd('h2', 8) + 4) ? <KHeadline lines={[[k('첫날인', 'h2', 0), k('오늘', 'h2', 1)], [k('3편', 'h2', 2, { mark: true, kind: 'count', from: 1, to: 3 })]]} out={wd('h2', 8) - 10} /> : null}
      {show(wd('h2', 8) - 4, VO.s1 + 4) ? <KHeadline lines={[[k('세', 'h2', 8), k('단계로,', 'h2', 9)], [k('끝엔', 'h2', 10), k('체크리스트', 'h2', 11, { mark: true, kind: 'check' })]]} out={VO.s1 - 10} /> : null}
      {show(VO.s1 - 4, wd('s1', 8) + 4) ? <KHeadline lines={[[k('첫째,', 's1', 0), k('소재는', 's1', 1)], [k('월요일에', 's1', 2, { mark: true }), k('한', 's1', 4), k('주', 's1', 5), k('치', 's1', 6)]]} out={wd('s1', 8) - 10} /> : null}
      {show(wd('s1', 8) - 4, VO.s1b + 4) ? <KHeadline lines={[[k('트렌드,', 's1', 8), k('질문,', 's1', 9)], [k('달력,', 's1', 10), k('실화', 's1', 11, { mark: true })]]} out={VO.s1b - 10} /> : null}
      {show(VO.s1b - 4, VO.s2 + 4) ? <KHeadline lines={[[k('예약이', 's1b', 0), k('텅', 's1b', 1, { kind: 'hollow' }), k('비어도,', 's1b', 2)], [k('만들', 's1b', 3), k('건', 's1b', 4), k('이', 's1b', 5), k('후보에서', 's1b', 6, { mark: true })]]} out={VO.s2 - 10} size={74} /> : null}
      {show(VO.s2 - 4, wd('s2', 8) + 4) ? <KHeadline lines={[[k('둘째,', 's2', 0), k('제작은', 's2', 1), k('매일', 's2', 2)], [k('아침', 's2', 3), k('7시로', 's2', 4, { mark: true, kind: 'count', from: 1, to: 7 }), k('걸어', 's2', 6), k('뒀어요', 's2', 7)]]} out={wd('s2', 8) - 10} size={74} /> : null}
      {show(wd('s2', 8) - 4, VO.s2b + 4) ? <KHeadline lines={[[k('저는', 's2', 8)], [k('최종본만', 's2', 9, { mark: true }), k('봐요', 's2', 10)]]} out={VO.s2b - 10} /> : null}
      {show(VO.s2b - 4, wd('s2b', 6) + 4) ? <KHeadline lines={[[k('오늘은', 's2b', 0), k('셋', 's2b', 1), k('다', 's2b', 2)], [k('사용량', 's2b', 3), k('한도에', 's2b', 4), k('멈췄는데', 's2b', 5)]]} out={wd('s2b', 6) - 10} freezeAt={wd('s2b', 5)} /> : null}
      {show(wd('s2b', 6) - 4, VO.s3 + 4) ? <KHeadline lines={[[k('"이어서', 's2b', 6, { mark: true, kind: 'up' }), k('해"로', 's2b', 7, { mark: wd('s2b', 6) })], [k('다시', 's2b', 8), k('이었어요', 's2b', 9)]]} out={VO.s3 - 10} /> : null}
      {show(VO.s3 - 4, wd('s3', 5) + 4) ? <KHeadline lines={[[k('셋째,', 's3', 0), k('게시는', 's3', 1)], [k('"올려"', 's3', 2, { mark: true, kind: 'up' }), k('한', 's3', 3), k('마디', 's3', 4)]]} out={wd('s3', 5) - 10} /> : null}
      {show(wd('s3', 5) - 4, VO.s3b + 4) ? <KHeadline lines={[[k('목표는', 's3', 5), k('4일', 's3', 6, { mark: true, kind: 'count', from: 1, to: 4 }), k('치', 's3', 7), k('비축', 's3', 8)], [k('오늘부터', 's3', 9), k('쌓아요', 's3', 10)]]} out={VO.s3b - 10} size={74} /> : null}
      {show(VO.s3b - 4, wd('s3b', 8) + 4) ? <KHeadline lines={[[k('채널마다', 's3b', 0), k('화면이', 's3b', 2), k('달라서,', 's3b', 3)], [k('올리기는', 's3b', 4), k('한', 's3b', 5, { mark: true }), k('창에서', 's3b', 6, { mark: wd('s3b', 5) })]]} out={wd('s3b', 8) - 10} size={72} /> : null}
      {show(wd('s3b', 8) - 4, VO.c1 + 4) ? <KHeadline lines={[[k('동시엔', 's3b', 8)], [k('엉켜요', 's3b', 9, { mark: true })]]} out={VO.c1 - 10} /> : null}
      {show(VO.c1 - 4, VO.cta + 4) ? <KHeadline lines={[[k('정리하면', 'c1', 0)], [k('넷', 'c1', 1, { mark: true })]]} out={VO.cta - 10} /> : null}
      {show(VO.cta - 4, S.end) ? <KHeadline lines={[[k('저장해', 'cta', 0, { mark: true, kind: 'save' }), k('두고', 'cta', 1)], [k('하나씩', 'cta', 2), k('따라', 'cta', 3), k('해', 'cta', 4), k('보세요', 'cta', 5)]]} out={S.end - 10} /> : null}
    </>
  );
};

// ───────────── 단계 표시(① 소재 ② 제작 ③ 게시) ─────────────
const Steps: React.FC = () => {
  const f = useCurrentFrame();
  const o = prog(f, wd('h2', 8), 8, OUT) * (1 - prog(f, S.c1, 8, IN));
  if (o <= 0) return null;
  const cur = f < S.s1 ? -1 : f < S.s2 ? 0 : f < S.s3 ? 1 : 2;
  return (
    <div style={{ position: 'absolute', left: 64, top: 538, display: 'flex', gap: 12, opacity: o }}>
      {['소재', '제작', '게시'].map((t, i) => (
        <div
          key={i}
          style={{
            padding: '8px 18px 9px',
            borderRadius: 14,
            background: i === cur ? BUTTER : i < cur ? '#2A2926' : 'transparent',
            boxShadow: i > cur ? 'inset 0 0 0 2px #4A4843' : undefined,
            color: i === cur ? '#141412' : i < cur ? INK : '#A9A69E',
            fontFamily: KO,
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: '-0.02em',
          }}
        >
          {i + 1} {t}
        </div>
      ))}
    </div>
  );
};

// ───────────── 판 내용 ─────────────
/** 예약 큐(실제 출력). tag: 「여기서 "올려"」 꼬리표, goal: 내일부터 4칸 「목표」. */
const QueueView: React.FC<{ f: number; tagAt?: number; goalAt?: number }> = ({ f, tagAt, goalAt }) => {
  const colX = (i: number) => 330 + i * 104;
  const tag = tagAt === undefined ? 0 : prog(f, tagAt, 8, OUT);
  const goal = goalAt === undefined ? 0 : prog(f, goalAt, 8, OUT);
  return (
    <>
      <div style={{ position: 'absolute', left: 34, top: 28, fontFamily: MONO, fontSize: 23, color: DIM }}>$ node tools/예약큐.js</div>
      <div style={{ position: 'absolute', left: 34, top: 76, fontFamily: KO, fontWeight: 650, fontSize: 28, color: INK }}>예약 큐 · 오늘 2026-10-20</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 128, height: 1, background: '#2A2926' }} />
      <div style={{ position: 'absolute', left: 34, top: 148, fontFamily: KO, fontWeight: 600, fontSize: 22, color: DIM }}>브랜드</div>
      {Q_DATES.map((d, i) => (
        <div key={d} style={{ position: 'absolute', left: colX(i) - 30, width: 80, top: 150, textAlign: 'center', fontFamily: MONO, fontSize: 21, color: i === 0 ? INK : DIM }}>
          {d}
        </div>
      ))}
      <div style={{ position: 'absolute', left: 852, top: 148, fontFamily: KO, fontWeight: 600, fontSize: 22, color: DIM }}>비축</div>
      {Q_BRANDS.map((b, r) => (
        <React.Fragment key={b}>
          <div style={{ position: 'absolute', left: 34, top: 200 + r * 66, fontFamily: KO, fontWeight: 650, fontSize: 30, color: INK }}>{b}</div>
          {Q_DATES.map((d, i) => (
            <div key={d} style={{ position: 'absolute', left: colX(i) - 30, width: 80, top: 196 + r * 66, textAlign: 'center', fontFamily: EN, fontWeight: 600, fontSize: 34, color: i === 0 ? INK : '#55534E' }}>
              {i === 0 ? '○' : '·'}
            </div>
          ))}
          <div style={{ position: 'absolute', left: 852, top: 202 + r * 66, fontFamily: KO, fontWeight: 600, fontSize: 26, color: DIM }}>0일</div>
        </React.Fragment>
      ))}
      <div style={{ position: 'absolute', left: 34, top: 580, fontFamily: KO, fontWeight: 600, fontSize: 23, color: DIM }}>○ 승인 대기 · ● 채움</div>
      {/* 오늘 칸(○)을 감싸는 버터 테두리 + 꼬리표 */}
      {tag > 0 ? (
        <>
          <div style={{ position: 'absolute', left: colX(0) - 34, top: 186, width: 88, height: 4 * 66 - 6, borderRadius: 16, boxShadow: `inset 0 0 0 ${4 * tag}px ${BUTTER}` }} />
          <div style={{ position: 'absolute', left: colX(0) - 70, top: 452 + (1 - tag) * 14, padding: '8px 16px', borderRadius: 14, background: BUTTER, color: '#141412', fontFamily: KO, fontWeight: 720, fontSize: 25, opacity: tag, whiteSpace: 'nowrap' }}>
            여기서 「올려」
          </div>
        </>
      ) : null}
      {/* 내일부터 4칸: 목표 */}
      {goal > 0 ? (
        <>
          {[1, 2, 3, 4].map((i) => {
            const g = prog(f, (goalAt ?? 0) + (i - 1) * 3, 7, OUT);
            return <div key={i} style={{ position: 'absolute', left: colX(i) - 34, top: 186, width: 88, height: 4 * 66 - 6, borderRadius: 16, border: `3px dashed rgba(245,196,69,${0.9 * g})` }} />;
          })}
          <div style={{ position: 'absolute', left: colX(1) - 34, top: 452 + (1 - goal) * 14, padding: '8px 16px', borderRadius: 14, background: BUTTER, color: '#141412', fontFamily: KO, fontWeight: 720, fontSize: 25, opacity: goal, whiteSpace: 'nowrap' }}>
            목표: 4일 치 미리 예약
          </div>
        </>
      ) : null}
    </>
  );
};

/** 오늘 만든 세 편(실제 0초 화면). check: 「최종본」 확인 표시. */
const CARD_W = 262;
const CARD_H = 466;
const ThreeCards: React.FC<{ f: number; at: number; checkAt?: number; peekAt?: number; peekOut?: number }> = ({ f, at, checkAt, peekAt, peekOut }) => {
  const left0 = (PW - (3 * CARD_W + 2 * 26)) / 2;
  const chk = checkAt === undefined ? 0 : prog(f, checkAt, 8, OUT);
  const peek = peekAt === undefined ? 0 : prog(f, peekAt, 10, OUT) * (peekOut === undefined ? 1 : 1 - prog(f, peekOut, 8, IN));
  return (
    <>
      {THREE.map((c, i) => {
        const a = prog(f, at + i * 5, 9, OUT);
        return (
          <div key={i} style={{ position: 'absolute', left: left0 + i * (CARD_W + 26), top: 40, width: CARD_W, opacity: a, transform: `translateY(${(1 - a) * 30}px) scale(${0.92 + 0.08 * a})`, transformOrigin: '50% 100%' }}>
            <div style={{ position: 'relative', width: CARD_W, height: CARD_H, borderRadius: 18, overflow: 'hidden', background: '#0A0A0A', boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}>
              <Img src={staticFile(c.src)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {chk > 0 ? (
                <div style={{ position: 'absolute', right: 14, bottom: 14, width: 64, height: 64, borderRadius: 32, background: BUTTER, opacity: chk, transform: `scale(${interpolate(chk, [0, 0.6, 1], [0.4, 1.12, 1], clamp)})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width={34} height={28} viewBox="0 0 40 32">
                    <path d="M4 17 L15 27 L36 5" fill="none" stroke="#141412" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              ) : null}
            </div>
            <div style={{ marginTop: 14, textAlign: 'center', fontFamily: KO, fontWeight: 650, fontSize: 24, color: UI_INK, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{c.label}</div>
          </div>
        );
      })}
      {chk > 0 ? <div style={{ position: 'absolute', left: 0, right: 0, top: 572, textAlign: 'center', fontFamily: KO, fontWeight: 700, fontSize: 30, color: UI_INK, opacity: chk }}>사람은 최종본만 보고 확인</div> : null}
      {/* 끝에 줄 체크리스트가 살짝 보였다 사라진다(고리) */}
      {peek > 0 ? (
        <div style={{ position: 'absolute', right: 26, top: 330 + (1 - peek) * 80, width: 360, height: 250, borderRadius: 22, background: '#FFFFFF', boxShadow: '0 20px 50px rgba(0,0,0,0.28)', opacity: peek, padding: '22px 26px' }}>
          <div style={{ fontFamily: KO, fontWeight: 720, fontSize: 26, color: UI_INK }}>업로드 자동화 체크리스트</div>
          {[0, 1, 2, 3].map((k) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, boxShadow: `inset 0 0 0 2.5px ${UI_MUTED}` }} />
              <div style={{ width: 200 - k * 22, height: 14, borderRadius: 7, background: '#E3E0D8' }} />
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
};

/** 앱의 예약 작업 목록(재현, 제목·시각은 실제). hi: 켜진 줄. */
const TaskList: React.FC<{ f: number; hi: (i: number) => number }> = ({ f, hi }) => (
  <>
    <PanelTop title="예약된 작업" right="Claude" />
    {TASKS.map((t, i) => {
      const k = hi(i);
      return (
        <div key={i} style={{ position: 'absolute', left: 20, right: 20, top: 112 + i * 100, height: 88, borderRadius: 18, background: k > 0 ? `rgba(245,196,69,${0.32 * k})` : '#EFEDE7', boxShadow: k > 0 ? `inset 0 0 0 ${3 * k}px ${BUTTER}` : undefined }}>
          <div style={{ position: 'absolute', left: 24, top: 14, width: 860, fontFamily: KO, fontWeight: 640, fontSize: 27, color: UI_INK, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.t}</div>
          <div style={{ position: 'absolute', left: 24, top: 52, fontFamily: MONO, fontSize: 20, color: UI_MUTED }}>{t.at}</div>
        </div>
      );
    })}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 620, height: 1, background: f > -1 ? RULE : undefined }} />
  </>
);

/** 월요일 트렌드 스캔 후보 7개. 말한 트리거 칩이 차례로 버터. */
const ScanCard: React.FC<{ f: number; pickAt?: number }> = ({ f, pickAt }) => {
  const lit = (tr: string) => {
    const k = TRIG.indexOf(tr as (typeof TRIG)[number]);
    return k < 0 ? 0 : prog(f, wd('s1', 8 + k), 5, OUT);
  };
  return (
    <>
      <PanelTop title="월요일 트렌드 스캔 · 2026-10-19" right="후보 7개" />
      {CANDS.map((c, i) => {
        const pk = pickAt !== undefined && (i === 1 || i === 5) ? prog(f, pickAt + (i === 5 ? 4 : 0), 7, OUT) : 0;
        return (
        <div key={i} style={{ position: 'absolute', left: 24, right: 24, top: 108 + i * 74, height: 64, borderBottom: `1px solid ${RULE}`, background: pk > 0 ? `rgba(245,196,69,${0.3 * pk})` : undefined, borderRadius: pk > 0 ? 12 : 0 }}>
          <div style={{ position: 'absolute', left: 6, top: 18, fontFamily: MONO, fontSize: 22, color: UI_MUTED }}>{i + 1}</div>
          <div style={{ position: 'absolute', left: 48, top: 14, fontFamily: KO, fontWeight: 640, fontSize: 28, color: UI_INK }}>
            {c.b}
            {pk > 0 ? <span style={{ marginLeft: 14, fontSize: 22, fontWeight: 720, color: '#7A5A00', opacity: pk }}>✓ 오늘 고름</span> : null}
          </div>
          <div style={{ position: 'absolute', right: 6, top: 10, display: 'flex', gap: 8 }}>
            {c.tr.map((tr) => {
              const l = lit(tr);
              return (
                <div key={tr} style={{ padding: '6px 14px', borderRadius: 12, background: l > 0 ? `rgba(245,196,69,${l})` : TILE, color: UI_INK, fontFamily: KO, fontWeight: 650, fontSize: 23 }}>
                  {tr}
                </div>
              );
            })}
          </div>
        </div>
        );
      })}
    </>
  );
};

/** 사용량 한도: 세 세션에 「멈춤」 → 실제 한도 문구 → 「이어서 해」 → 다시 켜짐. */
const LimitView: React.FC<{ f: number }> = ({ f }) => {
  const stop = prog(f, wd('s2b', 3), 6, OUT);
  const line = prog(f, wd('s2b', 4), 6, OUT);
  const bubble = prog(f, wd('s2b', 6) - 2, 6, OUT);
  const resume = prog(f, wd('s2b', 8), 6, OUT);
  return (
    <>
      <SessionList childIn={() => 1} />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            right: 120,
            top: childY(i) + 18,
            padding: '5px 14px',
            borderRadius: 12,
            background: resume > 0.5 ? BUTTER : '#D5D1C8',
            color: resume > 0.5 ? '#141412' : '#5E5C56',
            fontFamily: KO,
            fontWeight: 700,
            fontSize: 21,
            opacity: stop,
            transform: `scale(${0.9 + 0.1 * stop})`,
          }}
        >
          {resume > 0.5 ? '이어서 ✓' : '멈춤'}
        </div>
      ))}
      {/* 멈춘 동안 줄이 흐려진다 */}
      {stop > 0 && resume < 1 ? <div style={{ position: 'absolute', left: 60, right: 20, top: childY(0) - 6, height: 3 * 84, background: `rgba(246,245,241,${0.45 * stop * (1 - resume)})` }} /> : null}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 446, bottom: 0, background: '#F6F5F1' }} />
      <div style={{ position: 'absolute', left: 30, right: 30, top: 456, padding: '14px 20px', borderRadius: 14, background: '#2B2A26', fontFamily: MONO, fontSize: 21, color: '#E8C26A', opacity: line * (1 - 0.6 * resume), whiteSpace: 'nowrap', overflow: 'hidden' }}>
        {LIMIT_LINE}
      </div>
      <div style={{ position: 'absolute', left: 30, right: 30, top: 536 }}>
        <MeBubble parts={[{ t: '이어서 해' }]} appear={bubble} size={32} />
      </div>
    </>
  );
};

/** 실제 캡처 넷이 낱말마다(인스타 달력 → Business Suite → 틱톡 → rednote). */
const CapsFlip: React.FC<{ f: number }> = ({ f }) => {
  const ats = [VO.s3b, VO.s3b + 12, VO.s3b + 24, VO.s3b + 36];
  const k = f < ats[1] ? 0 : f < ats[2] ? 1 : f < ats[3] ? 2 : 3;
  const caps = [
    { src: 'cap/ig_cal2.png', key: 'ig_cal2', bg: '#0C0D10', label: '인스타 · 계정마다 예약 달력' },
    { src: 'cap/bs.png', key: 'bs', bg: '#FFFFFF', label: 'Business Suite · 예약됨' },
    { src: 'cap/tt.png', key: 'tt', bg: '#FFFFFF', label: '틱톡 스튜디오 · 로그인 1계정' },
    { src: 'cap/rednote.png', key: 'rednote', bg: '#FFFFFF', label: '샤오훙수 · rednote 주소' },
  ];
  const c = caps[k];
  const [w, hh] = CAP_SIZE[c.key];
  const p = prog(f, ats[k], 5, OUT);
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: c.bg }} />
      <Cap src={c.src} w={w} h={hh} bottom={86} maxW={c.key === 'bs' ? 560 : 952} o={p} y={(1 - p) * 24} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 86, background: '#141412', borderTop: '1px solid #2A2926' }}>
        <div style={{ position: 'absolute', left: 30, top: 25, fontFamily: KO, fontWeight: 650, fontSize: 29, color: INK, whiteSpace: 'nowrap' }}>{c.label}</div>
        <div style={{ position: 'absolute', right: 30, top: 27, fontFamily: MONO, fontSize: 24, color: DIM }}>{k + 1} / 4</div>
      </div>
    </>
  );
};

/** 올리기는 한 곳(조율 세션 한 줄). */
const OnePlace: React.FC<{ f: number }> = ({ f }) => {
  const a = prog(f, wd('s3b', 4) - 2, 8, OUT);
  return (
    <>
      <SessionList childIn={() => 1} parentGlow={prog(f, wd('s3b', 5), 8, OUT)} parentRight={<span style={{ padding: '6px 14px', borderRadius: 12, background: '#2B2A26', color: ME_INK, fontFamily: KO, fontWeight: 650, fontSize: 23, opacity: a }}>올리기 · 한 창에서</span>} />
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: 'absolute', right: 120, top: childY(i) + 18, padding: '5px 14px', borderRadius: 12, background: '#EBE9E3', color: UI_MUTED, fontFamily: KO, fontWeight: 650, fontSize: 20, opacity: a }}>
          만들기만
        </div>
      ))}
    </>
  );
};

/** 체크리스트(저장하고 싶은 한 장). 「저장해」에 책갈피가 채워진다. */
const Checklist: React.FC<{ f: number }> = ({ f }) => {
  const save = prog(f, wd('cta', 0), 8, OUT);
  return (
    <>
      <div style={{ position: 'absolute', left: 36, top: 30, fontFamily: KO, fontWeight: 760, fontSize: 40, color: UI_INK, letterSpacing: '-0.03em' }}>SNS 업로드 자동화 체크리스트</div>
      <div style={{ position: 'absolute', left: 38, top: 86, fontFamily: MONO, fontSize: 21, color: UI_MUTED }}>yuhobuilds · 10-20 첫날에 짠 구조</div>
      <svg width={46} height={58} viewBox="0 0 46 58" style={{ position: 'absolute', right: 36, top: 30, transform: `scale(${1 + 0.15 * save * (1 - prog(f, wd('cta', 0) + 8, 10, IN_OUT))})` }}>
        <path d="M5 4 Q5 2 7 2 L39 2 Q41 2 41 4 L41 54 L23 41 L5 54 Z" fill={save > 0.5 ? BUTTER : 'none'} stroke={save > 0.5 ? BUTTER : UI_INK} strokeWidth={3.5} strokeLinejoin="round" />
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 132, height: 1, background: RULE }} />
      {CHECK.map((c, i) => {
        const a = prog(f, VO.c1 + 2 + i * 3, 7, OUT);
        const k = prog(f, c.at(), 7, OUT);
        return (
          <div key={i} style={{ position: 'absolute', left: 26, right: 26, top: 152 + i * 114, height: 100, borderRadius: 18, background: k > 0 ? `rgba(245,196,69,${0.24 * k})` : undefined, opacity: a, transform: `translateY(${(1 - a) * 14}px)` }}>
            <div style={{ position: 'absolute', left: 18, top: 28, width: 40, height: 40, borderRadius: 10, background: k > 0.5 ? UI_INK : undefined, boxShadow: `inset 0 0 0 3px ${UI_INK}` }}>
              {k > 0 ? (
                <svg width={40} height={40} viewBox="0 0 40 40">
                  <path d="M9 21 L17 29 L32 12" fill="none" stroke={BUTTER} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={40} strokeDashoffset={40 * (1 - k)} />
                </svg>
              ) : null}
            </div>
            <div style={{ position: 'absolute', left: 80, top: 16, fontFamily: KO, fontWeight: 720, fontSize: 33, color: UI_INK, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{c.t}</div>
            <div style={{ position: 'absolute', left: 82, top: 60, fontFamily: KO, fontWeight: 560, fontSize: 23, color: UI_MUTED, whiteSpace: 'nowrap' }}>{c.s}</div>
          </div>
        );
      })}
    </>
  );
};

// ───────────── 판 하나 ─────────────
const Panel: React.FC = () => {
  const f = useCurrentFrame();
  // 어두운 판: 예약 큐(0~h2), 예약 큐(s3 둘째 반), 캡처(s3b 앞 반)
  const q2 = wd('s3', 5) - 4;
  const one = wd('s3b', 4) - 2;
  const dark =
    1 - prog(f, S.cards, 8, IN_OUT) + prog(f, q2, 8, IN_OUT) * (1 - prog(f, VO.s3b - 2, 2, OUT)) + prog(f, VO.s3b - 2, 2, OUT) * (1 - prog(f, one, 8, IN_OUT));
  const sw = (a: number, b: number) => ({ inP: prog(f, a + 2, 7, OUT), outP: prog(f, b, 7, IN) });
  const live = (a: number, b: number) => f >= a && f < b + 9;
  const scan = wd('s1', 4) - 2;
  const pick = wd('s1b', 3) - 2;
  const cardsAt = wd('s2', 8) - 2;
  return (
    <Shell box={B} paper={1} dark={Math.max(0, Math.min(1, dark))} darkFrom="bottom">
      {live(0, S.cards) ? (
        <Swap outP={prog(f, S.cards, 7, IN)}>
          <QueueView f={f} tagAt={wd('h1', 6)} />
        </Swap>
      ) : null}
      {live(S.cards, S.s1) ? (
        <Swap {...sw(S.cards, S.s1)}>
          <ThreeCards f={f} at={S.cards + 2} peekAt={wd('h2', 10) - 2} peekOut={S.s1 - 8} />
        </Swap>
      ) : null}
      {live(S.s1, scan) ? (
        <Swap {...sw(S.s1, scan)}>
          <TaskList f={f} hi={(i) => (i === 0 ? prog(f, wd('s1', 2), 6, OUT) : 0)} />
        </Swap>
      ) : null}
      {live(scan, S.s1b) ? (
        <Swap {...sw(scan, S.s1b)}>
          <ScanCard f={f} />
        </Swap>
      ) : null}
      {live(S.s1b, pick) ? (
        <Swap {...sw(S.s1b, pick)}>
          <PanelTop title="오늘 17:53 · 채널 12곳" right="예약 0" />
          <TileGrid f={f} top={120} checkA={0} checkB={0} all />
        </Swap>
      ) : null}
      {live(pick, S.s2) ? (
        <Swap {...sw(pick, S.s2)}>
          <ScanCard f={f} pickAt={wd('s1b', 6)} />
        </Swap>
      ) : null}
      {live(S.s2, cardsAt) ? (
        <Swap {...sw(S.s2, cardsAt)}>
          <TaskList f={f} hi={(i) => (i >= 1 && i <= 3 ? prog(f, wd('s2', 2) + (i - 1) * 7, 6, OUT) : 0)} />
        </Swap>
      ) : null}
      {live(cardsAt, S.s2b) ? (
        <Swap {...sw(cardsAt, S.s2b)}>
          <ThreeCards f={f} at={cardsAt} checkAt={wd('s2', 9)} />
        </Swap>
      ) : null}
      {live(S.s2b, S.s3) ? (
        <Swap {...sw(S.s2b, S.s3)}>
          <LimitView f={f} />
        </Swap>
      ) : null}
      {live(S.s3, q2) ? (
        <Swap {...sw(S.s3, q2)}>
          <TaskList f={f} hi={(i) => (i === 4 ? prog(f, wd('s3', 2), 6, OUT) : 0)} />
        </Swap>
      ) : null}
      {live(q2, VO.s3b) ? (
        <Swap {...sw(q2, VO.s3b)}>
          <QueueView f={f} goalAt={wd('s3', 6)} />
        </Swap>
      ) : null}
      {live(VO.s3b, one) ? (
        <Swap {...sw(VO.s3b, one)}>
          <CapsFlip f={f} />
        </Swap>
      ) : null}
      {live(one, S.c1) ? (
        <Swap {...sw(one, S.c1)}>
          <OnePlace f={f} />
        </Swap>
      ) : null}
      {f >= S.c1 ? (
        <Swap inP={prog(f, S.c1 + 2, 7, OUT)}>
          <Checklist f={f} />
        </Swap>
      ) : null}
    </Shell>
  );
};

// ───────────── 무대 아래 표시 ─────────────
const Label: React.FC = () => {
  const f = useCurrentFrame();
  const o = 1 - prog(f, S.end, 6, IN);
  if (o <= 0) return null;
  let text = '재현 화면 · 이름과 시각은 실제';
  if (f < S.cards) text = '실제 출력 · 예약 큐 10-20';
  else if (f < S.s1) text = '오늘 만든 세 편의 실제 0초 화면';
  else if (f >= wd('s3', 5) - 4 && f < VO.s3b) text = '실제 출력 · 예약 큐 10-20';
  else if (f >= VO.s3b && f < wd('s3b', 4) - 2) text = '실제 화면 · 10-20 17:45~17:51';
  else if (f >= wd('s2', 8) - 2 && f < S.s2b) text = '오늘 만든 세 편의 실제 0초 화면';
  return <div style={{ position: 'absolute', left: 72, top: 1268, fontFamily: MONO, fontSize: 25, color: DIM, opacity: o }}>{text}</div>;
};

// ───────────── 소리 ─────────────
type Hit = { at: number; src: string; v: number };
const hits = (): Hit[] => [
  { at: wd('h1', 6), src: 'sfx/snap.wav', v: 0.38 },
  { at: S.cards, src: 'sfx/swish.wav', v: 0.3 },
  ...[0, 1, 2].map((i) => ({ at: S.cards + 2 + i * 5, src: 'sfx/tok.wav', v: 0.3 })),
  ...[0, 1, 2].map((i) => ({ at: wd('h2', 8) + i * 3, src: 'sfx/tick.wav', v: 0.16 })),
  { at: wd('h2', 10) - 2, src: 'sfx/whoosh_side.wav', v: 0.2 },
  { at: S.s1, src: 'sfx/swish.wav', v: 0.3 },
  { at: wd('s1', 2), src: 'sfx/tick2.wav', v: 0.26 },
  { at: wd('s1', 4) - 2, src: 'sfx/swish.wav', v: 0.22 },
  ...[8, 9, 10, 11].map((k) => ({ at: wd('s1', k), src: 'sfx/tick.wav', v: 0.2 })),
  { at: S.s1b, src: 'sfx/swish.wav', v: 0.26 },
  { at: wd('s1b', 3) - 2, src: 'sfx/swish.wav', v: 0.2 },
  { at: wd('s1b', 6), src: 'sfx/pop.wav', v: 0.3 },
  { at: S.s2, src: 'sfx/swish.wav', v: 0.3 },
  ...[0, 1, 2].map((i) => ({ at: wd('s2', 2) + i * 7, src: 'sfx/tick2.wav', v: 0.2 })),
  { at: wd('s2', 8) - 2, src: 'sfx/swish.wav', v: 0.22 },
  { at: wd('s2', 9), src: 'sfx/pop.wav', v: 0.32 },
  { at: S.s2b, src: 'sfx/swish.wav', v: 0.26 },
  { at: wd('s2b', 3), src: 'sfx/thud.wav', v: 0.3 },
  { at: wd('s2b', 6) - 2, src: 'sfx/pop.wav', v: 0.3 },
  { at: wd('s2b', 8), src: 'sfx/snap.wav', v: 0.34 },
  { at: S.s3, src: 'sfx/swish.wav', v: 0.3 },
  { at: wd('s3', 2), src: 'sfx/tick2.wav', v: 0.24 },
  { at: wd('s3', 5) - 4, src: 'sfx/swish.wav', v: 0.22 },
  ...[0, 1, 2, 3].map((i) => ({ at: wd('s3', 6) + i * 3, src: 'sfx/tick.wav', v: 0.16 })),
  ...[0, 1, 2, 3].map((k) => ({ at: VO.s3b + k * 12, src: 'sfx/whoosh_side.wav', v: 0.18 })),
  { at: wd('s3b', 5), src: 'sfx/tok.wav', v: 0.36 },
  { at: S.c1, src: 'sfx/swish.wav', v: 0.3 },
  ...CHECK.map((c) => ({ at: c.at(), src: 'sfx/tick2.wav', v: 0.28 })),
  { at: wd('cta', 0), src: 'sfx/pop.wav', v: 0.34 },
  { at: S.end, src: 'sfx/swish.wav', v: 0.3 },
  { at: END_FOLLOW, src: 'sfx/tok.wav', v: 0.55 },
];

export const V7Film: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const ranges = LINES.map((id) => [VO[id], lineEnd(id)] as [number, number])
    .sort((p, q) => p[0] - q[0])
    .reduce<[number, number][]>((acc, [a, b]) => {
      const last = acc[acc.length - 1];
      if (last && a - last[1] < 20) last[1] = Math.max(last[1], b);
      else acc.push([a, b]);
      return acc;
    }, []);
  const bgmVolume = (fr: number) => {
    const tail = Math.min(1, (TOTAL - fr) / 20);
    const voice = Math.max(0, ...ranges.map(([a, b]) => interpolate(fr, [a - 10, a, b, b + 10], [0, 1, 1, 0], clamp)));
    return (0.42 - 0.14 * voice) * tail;
  };
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <Label />
      <Steps />
      <StripOut at={S.end}>
        <Panel />
      </StripOut>
      <StripIn at={S.end}>
        <EndCard />
      </StripIn>
      <Heads />
      {LINES.map((id) => (
        <Sequence key={id} from={VO[id]} layout="none">
          <Audio src={staticFile(`vo7/${id}.wav`)} />
        </Sequence>
      ))}
      {hits().map((x, i) => (
        <Sequence key={i} from={x.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(x.src)} volume={x.v} />
        </Sequence>
      ))}
      {bgm ? <Audio src={staticFile('bgm_v7.wav')} volume={bgmVolume} /> : null}
    </AbsoluteFill>
  );
};

export { ROW_TOP, SESSION_TITLE, UI_MUTED };
