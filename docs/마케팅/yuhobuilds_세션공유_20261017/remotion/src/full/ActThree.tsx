// 3막(11, 1349~1626프레임): 글로 된 방법(README 종이)이 길게 흐르다 그 판이 그대로 도구 저장소 카드가 되고,
// 101박에 같은 카드가 프로필 카드(머리 긴 프로필 사진 · 핸들 · 팔로우 단추 · 댓글칸)가 된다.
// 「댓글에 세션 남기면 링크 보내 드려요」: 댓글칸에 「세션」이 쳐지고, 음악 끝맺음(104박) 「보내」에 댓글이 올라간다.
// 「팔로우하면 다음 도구도 보여 드릴게요」: 팔로우 단추가 팔로잉이 된다.
// 10-18 유호님 「마무리가 너무 아쉬워 … 머리 길때 잘생긴버전 프로필」 → 「끝을 댓글 「세션」 + 팔로우로 바꿔줘」.
// 저장소 주소는 화면에 넣지 않는다(링크는 인스타 댓글 DM · 유튜브 고정 댓글로 준다).
import React from 'react';
import { Img, staticFile, useCurrentFrame } from 'remotion';
import { beat } from '../lib/beat';
import { EN, KO, MONO } from '../lib/fonts';
import { IN, IN_OUT, OUT, prog } from '../lib/motion';
import { PROFILE, README_LINES, REPO } from './data';
import { DIM, Headline, INK, lerpBox, Shell, StripIn, Swap, UI_INK, type Box } from './kit';
import { F, S, wd } from './time';

export const DOC_OUT = wd('f1a', 6) - 7; // 「그래서」 직전에 종이가 어두운 카드로 바뀌기 시작한다
export const REPO_IN = DOC_OUT + 9; // 어두운 카드가 다 덮이자마자 저장소 이름·설명(「제가」 직전)
export const END_IN = beat(101); // 카드가 프로필 카드가 된다(「댓글에」 4프레임 앞)

const FACTS_IN = REPO_IN + 12; // 사실 줄은 카드가 바뀌기 전에 다 읽히게
const KEYWORD = '세션';

const HEADINGS = new Set(['어떤 문제인가요', '어떻게 푸나요', '예약 작업', '설치']);

const PANEL_DOC: Box = { x: 64, y: 640, w: 952, h: 600, r: 22 };
const PANEL_REPO: Box = { x: 64, y: 640, w: 952, h: 420, r: 26 };
const PANEL_END: Box = { x: 64, y: 560, w: 952, h: 750, r: 32 };

/** 11 판 하나: README 종이 → (「그래서」) 어두운 저장소 카드 → (101박) 프로필 카드. 판은 바뀌지 않고 크기·내용만 바뀐다. */
const Panel11: React.FC = () => {
  const f = useCurrentFrame();
  const d = prog(f, DOC_OUT, 10, OUT);
  let box = lerpBox(PANEL_DOC, PANEL_REPO, prog(f, DOC_OUT, 12, OUT));
  box = lerpBox(box, PANEL_END, prog(f, END_IN, 12, OUT));
  const scroll = -560 * prog(f, F.scroll, 30, IN_OUT);
  // 음악 끝맺음(댓글이 올라가는 순간)에 카드가 한 번 다가왔다 물러나고, 끝까지 아주 천천히 다가온다(마지막 화면도 살아 있게)
  const hit = prog(f, F.send - 1, 6, OUT) * (1 - prog(f, F.send + 6, 12, IN_OUT));
  const drift = prog(f, END_IN + 10, S.end - END_IN - 10, IN_OUT);
  const s = (1 + 0.03 * hit) * (1 + 0.025 * drift);
  return (
    <div style={{ position: 'absolute', inset: 0, transform: s !== 1 ? `scale(${s})` : undefined, transformOrigin: f < END_IN ? '540px 850px' : '540px 935px' }}>
      <Shell box={box} paper={d < 1 ? 1 : 0} dark={d}>
        {f < DOC_OUT + 6 ? (
          <Swap outP={prog(f, DOC_OUT, 6, IN)}>
            <div style={{ position: 'absolute', left: 44, right: 44, top: 40, transform: `translateY(${scroll}px)` }}>
              <div style={{ fontFamily: EN, fontWeight: 650, fontSize: 44, color: UI_INK, marginBottom: 18 }}>{REPO.name}</div>
              {README_LINES.map((l, i) => {
                const heading = HEADINGS.has(l);
                const code = l.startsWith('<') || l.startsWith('    ');
                return (
                  <div
                    key={i}
                    style={{
                      fontFamily: code ? MONO : KO,
                      fontWeight: heading ? 680 : 520,
                      fontSize: heading ? 32 : code ? 21 : 26,
                      lineHeight: heading ? '58px' : '42px',
                      marginTop: heading ? 16 : 0,
                      color: heading ? UI_INK : '#3A3935',
                      filter: 'blur(2.5px)',
                      whiteSpace: code ? 'pre' : 'normal',
                    }}
                  >
                    {l}
                  </div>
                );
              })}
            </div>
          </Swap>
        ) : null}
        {f >= REPO_IN && f < END_IN + 6 ? (
          <Swap inP={prog(f, REPO_IN, 8, OUT)} outP={prog(f, END_IN, 6, IN)}>
            <BookGlyph />
            <div style={{ position: 'absolute', left: 92, top: 34, fontFamily: EN, fontWeight: 650, fontSize: 46, color: INK, letterSpacing: '-0.01em' }}>{REPO.name}</div>
            <div style={{ position: 'absolute', left: 40, top: 118, width: 872, fontFamily: KO, fontWeight: 560, fontSize: 29, lineHeight: 1.5, color: '#B9B6AE', wordBreak: 'keep-all' }}>{REPO.desc}</div>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 268, height: 1, background: '#2A2926' }} />
            {REPO.facts.map((t, i) => {
              const a = prog(f, FACTS_IN + i * 12, 8, OUT);
              return (
                <div key={i} style={{ position: 'absolute', left: 40, top: 294 + i * 46, fontFamily: KO, fontWeight: 600, fontSize: 28, color: INK, opacity: a, transform: `translateY(${(1 - a) * 10}px)` }}>
                  {t}
                </div>
              );
            })}
          </Swap>
        ) : null}
        {f >= END_IN + 2 ? <ProfileCard f={f} /> : null}
      </Shell>
    </div>
  );
};

/** 끝 프로필 카드: 머리 긴 프로필 사진(아치 창) · 핸들 · 채널 문구 · 팔로우 단추 · 흰 펠트 synk 로고 · 댓글칸. */
const ProfileCard: React.FC<{ f: number }> = ({ f }) => {
  const a = prog(f, END_IN + 2, 8, OUT);
  const photo = prog(f, END_IN + 2, 14, OUT); // 사진은 아치 창 안에서 살짝 다가오며 자리 잡는다
  const lineA = (at: number) => prog(f, at, 8, OUT);
  // 줄마다 살짝 올라오며 켜진다(투명도만으로 켜지는 페이드 사슬이 되지 않게)
  const rise = (at: number) => `translateY(${(1 - lineA(at)) * 8}px)`;
  const show = (at: number): React.CSSProperties => ({ opacity: lineA(at), transform: rise(at) });
  return (
    <Swap inP={a}>
      <div style={{ position: 'absolute', left: 40, top: 40, width: 370, height: 460, borderRadius: '185px 185px 28px 28px', overflow: 'hidden', background: '#0B0B0A', boxShadow: 'inset 0 0 0 1px #2A2926' }}>
        <Img src={staticFile('img/yuho-profile.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '44% 30%', transform: `scale(${1.08 - 0.08 * photo})`, transformOrigin: '50% 40%' }} />
      </div>
      <div style={{ position: 'absolute', left: 446, top: 70, fontFamily: EN, fontWeight: 650, fontSize: 54, color: INK, letterSpacing: '-0.01em', ...show(END_IN + 4) }}>{PROFILE.handle}</div>
      <div style={{ position: 'absolute', left: 448, top: 148, fontFamily: KO, fontWeight: 600, fontSize: 28, color: DIM, ...show(END_IN + 6) }}>{PROFILE.name}</div>
      <div style={{ position: 'absolute', left: 448, top: 206, fontFamily: KO, fontWeight: 650, fontSize: 32, color: '#D9D6CE', letterSpacing: '-0.02em', ...show(END_IN + 8) }}>{PROFILE.bio}</div>
      <div style={{ position: 'absolute', left: 448, top: 254, fontFamily: KO, fontWeight: 520, fontSize: 27, color: '#8E8B84', ...show(END_IN + 10) }}>{PROFILE.sub}</div>
      <FollowButton f={f} style={show(END_IN + 12)} />
      <Img src={staticFile('img/logo-synk-paper.webp')} style={{ position: 'absolute', left: 446, top: 430, height: 56, ...show(END_IN + 14) }} />
      <CommentBox f={f} style={show(END_IN + 10)} />
    </Swap>
  );
};

/** 팔로우 단추: 「팔로우하면」에 눌려 「팔로잉 ✓」이 된다(앱의 단추처럼 흰 단추 → 어두운 단추). */
const FollowButton: React.FC<{ f: number; style: React.CSSProperties }> = ({ f, style }) => {
  const press = prog(f, F.follow, 3, OUT) * (1 - prog(f, F.follow + 3, 6, OUT));
  const on = f >= F.follow + 3;
  return (
    <div style={{ position: 'absolute', left: 446, top: 318, width: 252, height: 72, ...style }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 18,
          background: on ? '#2A2926' : '#F4F2EC',
          transform: `scale(${1 - 0.06 * press})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          fontFamily: KO,
          fontWeight: 680,
          fontSize: 31,
          letterSpacing: '-0.02em',
          color: on ? INK : '#121211',
        }}
      >
        {on ? (
          <>
            팔로잉
            <svg width={26} height={20} viewBox="0 0 26 20">
              <path d="M3 10 L10 17 L23 3" fill="none" stroke={INK} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        ) : (
          '팔로우'
        )}
      </div>
    </div>
  );
};

/** 댓글칸: 「댓글에」 불이 들어오고, 「세션」이 쳐지고, 「보내」(음악 끝맺음)에 올라가 위에 댓글 한 줄로 남는다. */
const CommentBox: React.FC<{ f: number; style: React.CSSProperties }> = ({ f, style }) => {
  const focus = prog(f, F.comment, 6, OUT);
  const typed = f < F.type ? 0 : f < F.type + 4 ? 1 : 2; // 「세」 → 「세션」
  const sent = prog(f, F.send, 7, OUT);
  const press = prog(f, F.send - 2, 2, OUT) * (1 - prog(f, F.send, 6, OUT));
  const caretOn = f >= F.comment && f < F.send && Math.floor((f - F.comment) / 15) % 2 === 0; // 실제 커서처럼 0.5초마다
  const text = KEYWORD.slice(0, typed);
  const ready = typed === 2 && sent < 1;
  return (
    <>
      {/* 올라간 댓글 한 줄 */}
      {sent > 0 ? (
        <div style={{ position: 'absolute', left: 40, top: 520, height: 52, display: 'flex', alignItems: 'center', gap: 16, opacity: sent, transform: `translateY(${(1 - sent) * 70}px)` }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: '#C3CBCB' }} />
          <div style={{ fontFamily: KO, fontWeight: 650, fontSize: 32, color: INK, letterSpacing: '-0.02em' }}>{KEYWORD}</div>
          <div style={{ fontFamily: MONO, fontSize: 21, color: DIM }}>방금</div>
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 40, top: 590, width: 872, height: 108, borderRadius: 54, background: '#121211', boxShadow: `inset 0 0 0 2px ${focus > 0 ? `rgba(244,242,236,${0.25 + 0.6 * focus * (1 - sent)})` : '#3A3935'}`, ...style }}>
        {/* 말풍선 */}
        <svg width={42} height={42} viewBox="0 0 42 42" style={{ position: 'absolute', left: 32, top: 33 }}>
          <path d="M21 6 C30.5 6 37 12 37 19.5 C37 27 30.5 33 21 33 C18.6 33 16.4 32.6 14.4 31.9 L7 35 L8.8 28.6 C6.4 26.2 5 23 5 19.5 C5 12 11.5 6 21 6 Z" fill="none" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
        </svg>
        {/* 쓰는 글 또는 안내 글 */}
        <div style={{ position: 'absolute', left: 96, top: 0, width: 700, height: 108, display: 'flex', alignItems: 'center' }}>
          {/* 안내 글: 쓰기 전에 보이고, 보낸 글이 올라가는 동안 다시 켜진다(빈 칸이 생기지 않게) */}
          <span style={{ position: 'absolute', left: 10, top: 34, fontFamily: KO, fontWeight: 520, fontSize: 32, color: '#6E6C66', opacity: typed === 0 ? 1 : sent }}>댓글 달기…</span>
          {typed > 0 && sent < 1 ? (
            <span style={{ fontFamily: KO, fontWeight: 650, fontSize: 36, color: INK, letterSpacing: '-0.02em', opacity: 1 - sent, transform: `translateY(${-40 * sent}px)`, display: 'inline-block' }}>{text}</span>
          ) : null}
          {caretOn ? <span style={{ display: 'inline-block', width: 3, height: 40, marginLeft: typed > 0 ? 4 : 0, background: INK }} /> : null}
        </div>
        {/* 보내기 */}
        <div
          style={{
            position: 'absolute',
            right: 22,
            top: 22,
            width: 64,
            height: 64,
            borderRadius: 32,
            background: ready ? '#F4F2EC' : '#2A2926',
            transform: `scale(${1 - 0.1 * press})`,
          }}
        >
          <svg width={64} height={64} viewBox="0 0 64 64">
            <path d="M32 44 V21 M22 30 L32 20 L42 30" fill="none" stroke={ready ? '#121211' : '#8E8B84'} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </>
  );
};

const BookGlyph: React.FC = () => (
  <svg width={34} height={34} viewBox="0 0 34 34" style={{ position: 'absolute', left: 40, top: 44 }}>
    <path d="M6 5 H24 Q28 5 28 9 V29 H10 Q6 29 6 25 Z M6 25 Q6 21 10 21 H28" fill="none" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
  </svg>
);

const HeadsThree: React.FC = () => {
  const f = useCurrentFrame();
  const ctaOut = wd('cta', 6) - 6; // 「드려요」를 다 읽은 뒤 빠진다(빠지는 줄 끝과 들어오는 줄 첫머리는 자리가 달라 안 겹친다)
  return (
    <>
      {f < DOC_OUT + 8 ? (
        <Headline
          lines={[
            [{ t: '방법만', at: wd('f1a', 0) }, { t: '글로', at: wd('f1a', 1) }, { t: '드리면', at: wd('f1a', 2) }],
            [{ t: '따라', at: wd('f1a', 3) }, { t: '하기', at: wd('f1a', 4) }, { t: '어렵잖아요', at: wd('f1a', 5) }],
          ]}
          out={DOC_OUT - 1}
        />
      ) : null}
      {f >= DOC_OUT && f < END_IN + 4 ? (
        <Headline
          lines={[
            [{ t: '그래서', at: wd('f1a', 6) }, { t: '제가', at: wd('f1a', 7) }, { t: '쓰는', at: wd('f1a', 8) }],
            [{ t: '도구를', at: wd('f1a', 9) }, { t: '공개했어요', at: wd('f1a', 10) }],
          ]}
          out={wd('cta', 0) - 10}
        />
      ) : null}
      {/* 이 장면의 버터는 키워드 하나 — 무엇을 남기면 되는지 */}
      {f >= wd('cta', 0) - 4 && f < ctaOut + 10 ? (
        <Headline
          lines={[
            [{ t: '댓글에', at: wd('cta', 0) }, { t: `「${KEYWORD}」`, at: wd('cta', 1), accent: wd('cta', 1) }, { t: '남기면', at: wd('cta', 2) }],
            [{ t: '링크', at: wd('cta', 3) }, { t: '보내', at: wd('cta', 4) }, { t: '드려요', at: wd('cta', 5) }],
          ]}
          out={ctaOut}
        />
      ) : null}
      {f >= ctaOut + 6 ? (
        <Headline
          lines={[
            [{ t: '팔로우하면', at: wd('cta', 6) }, { t: '다음', at: wd('cta', 7) }, { t: '도구도', at: wd('cta', 8) }],
            [{ t: '보여', at: wd('cta', 9) }, { t: '드릴게요', at: wd('cta', 10) }],
          ]}
        />
      ) : null}
    </>
  );
};

export const ActThree: React.FC = () => (
  <StripIn at={S.s11}>
    <Panel11 />
    <HeadsThree />
  </StripIn>
);
