// 「Claude 기능 셋 — 반복하는 말로 고르기」 여덟 장면. 장면마다 착지 박(time.ts B)에 내려앉고, 글은 마스크로 올라오며, 강조는 크레용 밑줄·형광펜.
// Claude 앱 화면은 녹화하지 않는다 — 말풍선·폴더·승인 상자는 SYNK 키트로 그린 예시 그림(「예시 그림」 도장),
// 기능·요금제 조건은 Anthropic 도움말 원문(2026-10-22 확인, 기획.md 「정보 품질」) 그대로. 앱 로고는 쓰지 않고 글자 칩만.
import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, ramp } from '../lib/anim';
import { C, F, L } from '../theme';
import { HeadF, Lines, MarkF, settle, Spinner } from '../v5/cine';
import { ease, fadeUp, Mark, Stamp } from './parts';
import { at, CUT, seq, TOTAL } from './time';
import { wordFrame } from './vo-time';

const CW = L.W - L.X - L.R; // 836
const HEAD = 'synkbrief 기초';
const IN = 2;
const SRC = 'Anthropic Claude 도움말 · 2026.10.22 확인';
const EX = '예시 그림 · 실제 앱 화면 아님';
const MENU_NOTE = '메뉴 이름은 Claude 도움말 영문 표기 · 요금제·언어에 따라 화면이 조금 다를 수 있어요';

type K = Parameters<typeof seq>[0];
const wordIn = (k: K, id: string, word: string, fallbackBeat: number, variant: 'A' | 'B' = 'A') => {
  const abs = wordFrame(variant, id, word);
  return abs === null ? at(k, fallbackBeat) : abs - seq(k).from;
};
const bob = (f: number, phase = 0, amp = 6) => Math.sin((f + phase) / 22) * amp;
const shadow = '0 26px 50px -28px rgba(4,12,36,.7)';

// ── 그림 부품 ─────────────────────────────────────────────────────────
/** 오른쪽 화살표(SUIT 서체는 「→」를 꺾쇠처럼 그려서 선 그림으로 둔다). 글자 높이(em)에 맞춘다. */
const Arr: React.FC<{ color?: string; w?: number }> = ({ color = 'currentColor', w = 0.9 }) => (
  <svg viewBox="0 0 24 24" style={{ width: `${w}em`, height: `${w}em`, verticalAlign: '-0.08em', margin: '0 .12em', overflow: 'visible' }} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12h17M14 5.5l6.5 6.5-6.5 6.5" />
  </svg>
);

type IconKind = 'folder' | 'skill' | 'plug' | 'doc';
/** 기능 아이콘(선 그림 하나, 앱 로고 아님) */
const Icon: React.FC<{ kind: IconKind; size?: number; color?: string }> = ({ kind, size = 44, color = C.acc }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
    {kind === 'folder' ? <path d="M3 7.5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /> : null}
    {kind === 'skill' ? (
      <>
        <path d="M5 4h11l3 3v13H5z" />
        <path d="M8.5 10h7M8.5 13.5h7M8.5 17h4" />
      </>
    ) : null}
    {kind === 'plug' ? (
      <>
        <path d="M9 3v5M15 3v5M6.5 8h11v3a5.5 5.5 0 0 1-11 0z" />
        <path d="M12 16.5V21" />
      </>
    ) : null}
    {kind === 'doc' ? (
      <>
        <rect x="3.5" y="5" width="17" height="12" rx="1.6" />
        <path d="M8 21h8M12 17v4" />
      </>
    ) : null}
  </svg>
);

/** 말풍선: me = 내 말(흰, 오른쪽) · ai = Claude 말(어두운, 왼쪽). again이면 「↻ 또」 도장이 같이 튄다. */
const Bubble: React.FC<{ me?: boolean; text: React.ReactNode; at: number; again?: boolean; x?: number; y: number; w?: number; size?: number }> = ({ me = true, text, at: a, again, x, y, w, size = 34 }) => {
  const f = useCurrentFrame();
  const s = settle(f, a, 16);
  const st = settle(f, a + 6, 20);
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        ...(me ? { right: x ?? L.R } : { left: x ?? L.X }),
        maxWidth: w ?? 700,
        boxSizing: 'border-box',
        padding: '22px 28px',
        borderRadius: me ? '30px 30px 8px 30px' : '30px 30px 30px 8px',
        background: me ? '#fff' : C.ink,
        color: me ? C.ink : '#fff',
        font: `700 ${size}px/1.3 ${F.ko}`,
        letterSpacing: '-.03em',
        wordBreak: 'keep-all',
        boxShadow: shadow,
        opacity: interpolate(s, [0, 0.35], [0, 1], clamp),
        translate: `0 ${(1 - s) * 40}px`,
        scale: String(0.94 + 0.06 * s),
        transformOrigin: me ? '100% 100%' : '0 100%',
      }}
    >
      {text}
      {again ? (
        <span style={{ position: 'absolute', left: -34, top: -22, padding: '8px 14px', borderRadius: 999, background: C.crayon, color: '#fff', font: `850 26px/1 ${F.ko}`, scale: String(interpolate(st, [0, 1], [0.3, 1], clamp)), rotate: '-8deg', opacity: interpolate(st, [0, 0.3], [0, 1], clamp), boxShadow: '0 8px 18px -8px rgba(0,0,0,.5)' }}>
          ↻ 또
        </span>
      ) : null}
    </div>
  );
};

/** 흰 판(예시 그림 도장 포함) */
const Board: React.FC<{ x: number; y: number; w: number; h?: number; children: React.ReactNode; style?: React.CSSProperties; ex?: boolean }> = ({ x, y, w, h, children, style, ex = true }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box', padding: '26px 28px', borderRadius: 30, background: '#fff', color: C.ink, boxShadow: shadow, ...style }}>
    {ex ? (
      <Stamp tone="light" size={25} style={{ right: 20, top: -18, background: '#eef1f6', boxShadow: '0 6px 14px -8px rgba(0,0,0,.35)' }}>
        {EX}
      </Stamp>
    ) : null}
    {children}
  </div>
);

/** 알약(노란 또는 흰) */
const Pill: React.FC<{ children: React.ReactNode; at: number; tone?: 'mark' | 'white'; style?: React.CSSProperties; size?: number }> = ({ children, at: a, tone = 'mark', style, size = 32 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 26px', borderRadius: 999, background: tone === 'mark' ? C.markField : '#fff', color: C.ink, font: `800 ${size}px/1.1 ${F.ko}`, letterSpacing: '-.03em', whiteSpace: 'nowrap', boxShadow: '0 16px 32px -18px rgba(0,0,0,.5)', ...fadeUp(f, a, 22), ...style }}>
      {children}
    </div>
  );
};

/** 기능 이름표(아이콘 + 영문 메뉴 + 뜻) */
const FeatureTag: React.FC<{ kind: IconKind; en: string; ko: string; size?: number; dark?: boolean }> = ({ kind, en, ko, size = 40, dark }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
    <span style={{ width: size * 1.6, height: size * 1.6, borderRadius: 18, background: dark ? 'rgba(255,255,255,.12)' : C.accSoft, display: 'grid', placeItems: 'center', flex: 'none' }}>
      <Icon kind={kind} size={size} color={dark ? '#fff' : C.acc} />
    </span>
    <div>
      <div style={{ font: `850 ${size}px/1.05 ${F.ko}`, letterSpacing: '-.03em' }}>{ko}</div>
      <div style={{ marginTop: 6, font: `500 ${Math.max(22, Math.round(size * 0.58))}px/1.1 ${F.mono}`, color: dark ? 'rgba(255,255,255,.7)' : C.muted }}>{en}</div>
    </div>
  </div>
);

// 지어낸 예시 말(실제 사람의 대화가 아님)
const SAYS = ['우리 회사 소개, 다시 붙여 넣을게요', '보고서는 이 양식, 이 순서로…', '메일 내용 복사해 왔어요'];

// ── 01 훅 ─────────────────────────────────────────────────────────────
// A(인스타 · 손해 피하기): 0프레임부터 제목 + 첫 말풍선, 목소리를 따라 말풍선 둘이 더 쌓이며 「↻ 또」. 「반복하는」에 칩.
// B(유튜브 · 질문): 기능 카드 셋에 물음표, 「반복하는」에 같은 칩.
export const hookT = (variant: 'A' | 'B') => {
  const id = variant === 'A' ? 'a01' : 'b01';
  return variant === 'A'
    ? { b2: wordIn('hook', id, '설명,', 1.5, variant), b3: wordIn('hook', id, '매번', 3, variant), mark: wordIn('hook', id, '아직도', 3, variant), chip: wordIn('hook', id, '반복하는', 5, variant), chip2: wordIn('hook', id, '끝에', 9, variant) }
    : { b2: wordIn('hook', id, '스킬,', 1.5, variant), b3: wordIn('hook', id, '커넥터.', 2.5, variant), mark: wordIn('hook', id, '내', 5, variant), chip: wordIn('hook', id, '반복하는', 7, variant), chip2: wordIn('hook', id, '끝에', 10.5, variant) };
};
export const Hook01: React.FC<{ variant: 'A' | 'B' }> = ({ variant }) => {
  const f = useCurrentFrame();
  const t = hookT(variant);
  const title =
    variant === 'A'
      ? ['Claude한테 같은 설명,', <MarkF key="m" p={ramp(f, t.mark, 12)}>아직도 매번 하세요?</MarkF>]
      : ['프로젝트? 스킬? 커넥터?', <MarkF key="m" p={ramp(f, t.mark, 12)}>내 경우엔 뭘까요?</MarkF>];
  const chipS = settle(f, t.chip, 18);
  const chip2S = settle(f, t.chip2, 18);
  return (
    <>
      <HeadF left={HEAD} right="Claude · 기능 고르기" />
      <Lines visibleAtZero at={0} size={82} top={L.TOP} lines={title} />
      {variant === 'A' ? (
        <>
          <Bubble text={SAYS[0]} at={-30} again y={790 + bob(f, 0, 3)} />
          <Bubble text={SAYS[1]} at={t.b2} again y={930 + bob(f, 12, 3)} />
          <Bubble text={SAYS[2]} at={t.b3} again y={1070 + bob(f, 24, 3)} />
          <Stamp size={25} style={{ left: L.X, top: 1186 }}>
            {EX}
          </Stamp>
        </>
      ) : (
        <div style={{ position: 'absolute', left: L.X, top: 800, width: CW, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {(
            [
              ['folder', 'Projects', '프로젝트', -30],
              ['skill', 'Skills', '스킬', t.b2],
              ['plug', 'Connectors', '커넥터', t.b3],
            ] as const
          ).map(([kind, en, ko, a], i) => (
            <div key={en} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 26px', borderRadius: 26, background: '#fff', color: C.ink, boxShadow: shadow, position: 'relative', top: bob(f, i * 12, 3), ...fadeUp(f, a, 30) }}>
              <FeatureTag kind={kind} en={en} ko={ko} size={36} />
              <span style={{ font: `900 64px/1 ${F.ko}`, color: C.crayon, rotate: `${Math.sin((f + i * 17) / 9) * 7}deg` }}>?</span>
            </div>
          ))}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          left: L.X,
          top: 1262,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 16,
          padding: '18px 28px',
          borderRadius: 999,
          background: C.markField,
          color: C.ink,
          font: `850 38px/1 ${F.ko}`,
          letterSpacing: '-.03em',
          opacity: interpolate(chipS, [0, 0.35], [0, 1], clamp),
          scale: String(interpolate(chipS, [0, 1], [0.7, 1], clamp)),
          transformOrigin: '0 50%',
          boxShadow: '0 16px 32px -18px rgba(0,0,0,.5)',
        }}
      >
        반복하는 말 <Arr color={C.acc} /> 쓸 기능
      </div>
      <div
        style={{
          position: 'absolute',
          left: L.X,
          top: 1358,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 26px',
          borderRadius: 999,
          background: C.crayon,
          color: '#fff',
          font: `850 34px/1 ${F.ko}`,
          letterSpacing: '-.03em',
          opacity: interpolate(chip2S, [0, 0.35], [0, 1], clamp),
          scale: String(interpolate(chip2S, [0, 1], [0.7, 1], clamp)),
          transformOrigin: '0 50%',
          boxShadow: '0 16px 32px -18px rgba(0,0,0,.5)',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff">
          <path d="M6 3h12v18l-6-4.5L6 21z" />
        </svg>
        끝에 한 장 정리
      </div>
    </>
  );
};

// ── 02 기준 ───────────────────────────────────────────────────────────
// 세 줄 카드가 목소리 「자료를」·「방식을」·「메일이랑」에 하나씩 켜진다. 오른쪽은 아직 「?」.
export const ruleT = () => ({ a: wordIn('rule', 'v02', '자료를', 17), b: wordIn('rule', 'v02', '방식을', 20), c: wordIn('rule', 'v02', '메일이랑', 23) });
export const Rule02: React.FC = () => {
  const f = useCurrentFrame();
  const t = ruleT();
  const rows = [
    { pre: '같은 ', em: '자료', post: '를 붙여 넣는다', at: t.a },
    { pre: '같은 ', em: '방식', post: '을 설명한다', at: t.b },
    { pre: '', em: '메일·일정', post: '을 복사해 온다', at: t.c },
  ];
  return (
    <>
      <HeadF left={HEAD} right="기준 하나" />
      <Lines at={IN} size={84} top={L.TOP} lines={['내가 Claude한테', <MarkF key="m" p={ramp(f, t.a - 6, 12)}>뭘 반복하나?</MarkF>]} />
      {rows.map((r, i) => {
        const on = settle(f, r.at - 2, 16);
        return (
          <div
            key={r.em}
            style={{
              position: 'absolute',
              left: L.X,
              top: 790 + i * 176 + bob(f, i * 11, 3),
              width: CW,
              height: 150,
              boxSizing: 'border-box',
              padding: '0 30px',
              borderRadius: 26,
              background: '#fff',
              color: C.ink,
              display: 'flex',
              alignItems: 'center',
              gap: 22,
              boxShadow: on > 0.5 ? `0 0 0 6px ${C.mark},${shadow}` : shadow,
              opacity: interpolate(on, [0, 0.4], [0.22, 1], clamp),
              translate: `${(1 - on) * 50}px 0`,
            }}
          >
            <span style={{ flex: 'none', width: 66, height: 66, borderRadius: '50%', background: C.field, color: '#fff', display: 'grid', placeItems: 'center', font: `900 38px/1 ${F.ko}` }}>{i + 1}</span>
            <div style={{ flex: 1, font: `750 44px/1.15 ${F.ko}`, letterSpacing: '-.035em' }}>
              {r.pre}
              <b style={{ fontWeight: 900, color: C.acc }}>{r.em}</b>
              {r.post}
            </div>
            <span style={{ font: `900 52px/1 ${F.ko}`, color: C.crayon, opacity: on }}><Arr />?</span>
          </div>
        );
      })}
    </>
  );
};

// ── 03 프로젝트 ────────────────────────────────────────────────────────
// 폴더 판: 자료 칩 셋 + 지침 카드가 들어가고, 「모든」에 아래 대화 셋이 같은 자료를 가리킨다. 「다섯」에 알약.
export const projT = () => ({ files: wordIn('proj', 'v03', '파일이랑', 29), rule: wordIn('proj', 'v03', '지침을', 30), all: wordIn('proj', 'v03', '대화는', 33), five: wordIn('proj', 'v03', '무료', 37) });
const FILES = ['회사 소개.pdf', '가격표.xlsx', '자주 묻는 질문.docx'];
export const Proj03: React.FC = () => {
  const f = useCurrentFrame();
  const t = projT();
  const link = ease(f, t.all, 16);
  return (
    <>
      <HeadF left={HEAD} right="① 같은 자료" />
      <Lines at={IN} size={84} top={L.TOP} lines={[<>같은 자료면 <Arr key="a" w={0.8} /></>, <MarkF key="m" p={ramp(f, IN + 8, 12)}>프로젝트</MarkF>]} />
      <Board x={L.X} y={770 + bob(f, 0, 3)} w={CW} h={520} style={fadeUp(f, IN, 26)}>
        <FeatureTag kind="folder" en="Projects" ko="프로젝트 · 거래처 응대" size={34} />
        <div style={{ marginTop: 22, display: 'flex', gap: 18 }}>
          <div style={{ flex: 1.15, padding: '16px 18px', borderRadius: 20, background: '#f4f6fa' }}>
            <div style={{ font: `700 22px/1 ${F.ko}`, color: C.muted, marginBottom: 12 }}>자료</div>
            {FILES.map((n, i) => (
              <div key={n} style={{ marginTop: i ? 10 : 0, padding: '12px 14px', borderRadius: 12, background: '#fff', font: `700 26px/1.1 ${F.ko}`, letterSpacing: '-.02em', boxShadow: link > 0.3 ? `0 0 0 3px ${C.accSoft}` : 'none', ...fadeUp(f, t.files + i * 4, 18) }}>
                {n}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, padding: '16px 18px', borderRadius: 20, background: C.ink, color: '#fff', ...fadeUp(f, t.rule, 18) }}>
            <div style={{ font: `700 22px/1 ${F.ko}`, color: 'rgba(255,255,255,.65)', marginBottom: 12 }}>지침</div>
            <div style={{ font: `750 28px/1.4 ${F.ko}`, letterSpacing: '-.025em' }}>답은 존댓말로,<br />가격은 표로</div>
          </div>
        </div>
        <div style={{ marginTop: 22, display: 'flex', gap: 14 }}>
          {['대화 1', '대화 2', '대화 3'].map((c, i) => {
            const s = settle(f, t.all + i * 4, 18);
            return (
              <div key={c} style={{ flex: 1, padding: '16px 0', borderRadius: 16, textAlign: 'center', background: s > 0.5 ? C.accSoft : '#f1f3f6', font: `800 28px/1 ${F.ko}`, color: C.ink, scale: String(0.92 + 0.08 * s), opacity: interpolate(s, [0, 0.3], [0.35, 1], clamp) }}>
                {c} <span style={{ color: C.acc }}>✓</span>
              </div>
            );
          })}
        </div>
      </Board>
      <div style={{ position: 'absolute', left: L.X, top: 1310, width: CW, font: `700 30px/1.3 ${F.ko}`, color: '#fff', ...fadeUp(f, t.all + 4, 16) }}>한 번 넣어 두면, 그 안의 대화는 다 같이 써요</div>
      <Pill at={t.five} style={{ left: L.X, top: 1370 }}>
        무료 계정도 프로젝트 5개까지
      </Pill>
    </>
  );
};

// ── 04 스킬 ───────────────────────────────────────────────────────────
// 스킬 카드(주간 보고 순서) → 「써」에 내 말풍선 → 「알아서」에 「스킬 사용 중」 칩(돌다가 ✓).
export const skillT = () => ({ steps: wordIn('skill', 'v04', '양식이나', 44), ask: wordIn('skill', 'v04', '가르쳐', 48), use: wordIn('skill', 'v04', '켜', 49), note: wordIn('skill', 'v04', '필요할', 50), done: wordIn('skill', 'v04', '알아서', 52) });
export const Skill04: React.FC = () => {
  const f = useCurrentFrame();
  const t = skillT();
  const done = f >= t.done;
  return (
    <>
      <HeadF left={HEAD} right="② 같은 방식" />
      <Lines at={IN} size={84} top={L.TOP} lines={[<>같은 방식이면 <Arr key="a" w={0.8} /></>, <MarkF key="m" p={ramp(f, IN + 8, 12)}>스킬</MarkF>]} />
      <Board x={L.X} y={770 + bob(f, 0, 3)} w={CW} style={fadeUp(f, IN, 26)}>
        <FeatureTag kind="skill" en="Skills" ko="스킬 · 주간 보고" size={34} />
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {['① 지난주 한 일', '② 이번 주 할 일', '③ 막힌 것 · 도움 필요'].map((s, i) => {
            // 「알아서」에 스킬 순서를 한 줄씩 따라가며 ✓(스킬이 쓰이는 모습)
            const run = settle(f, t.done + i * 9, 18);
            return (
              <div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 12, background: run > 0.5 ? C.accSoft : '#f4f6fa', font: `750 30px/1.1 ${F.ko}`, letterSpacing: '-.025em', ...fadeUp(f, t.steps + i * 4, 18) }}>
                {s}
                <span style={{ color: C.acc, font: `900 30px/1 ${F.ko}`, opacity: run, scale: String(0.5 + 0.5 * run) }}>✓</span>
              </div>
            );
          })}
        </div>
      </Board>
      <Bubble text="이번 주 주간 보고 써 줘" at={t.ask} y={1176} size={32} />
      <div style={{ position: 'absolute', left: L.X, top: 1290, display: 'inline-flex', alignItems: 'center', gap: 14, padding: '16px 24px', borderRadius: 999, background: C.ink, color: '#fff', font: `750 30px/1 ${F.ko}`, letterSpacing: '-.02em', ...fadeUp(f, t.use, 20) }}>
        {done ? <span style={{ color: C.markField, font: `900 30px/1 ${F.ko}` }}>✓</span> : <Spinner size={30} />}
        스킬 사용 중 · 주간 보고
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1376, width: CW, font: `650 26px/1.35 ${F.ko}`, color: C.onField2, wordBreak: 'keep-all', ...fadeUp(f, t.note, 14) }}>
        켜 둔 스킬만 써요 · 안 쓰면 「주간 보고 스킬로」처럼 이름을 불러 주세요
      </div>
    </>
  );
};

// ── 05 흔한 오해 ───────────────────────────────────────────────────────
// 「아니에요」에 ✕, 내 말풍선 → Claude 질문 → 「올리면」에 스킬 파일 → Customize › Skills. 아래 한 줄 = 먼저 켤 설정(Fable 10-22: 화면 줄이기).
export const mythT = () => ({ no: wordIn('myth', 'v05', '아니에요.', 58), ask: wordIn('myth', 'v05', '이런', 60), q: wordIn('myth', 'v05', '물어보면서', 63), file: wordIn('myth', 'v05', '만들어', 65), up: wordIn('myth', 'v05', '파일을', 66) });
export const Myth05: React.FC = () => {
  const f = useCurrentFrame();
  const t = mythT();
  return (
    <>
      <HeadF left={HEAD} right="흔한 오해" />
      <Lines at={IN} size={80} top={L.TOP} lines={['스킬은 코딩해야 만든다?', <MarkF key="m" p={ramp(f, t.no, 12)}>말로 시키면 돼요</MarkF>]} />
      <Mark ok={false} at={t.no} size={110} style={{ right: L.R - 10, top: L.TOP + 90 }} />
      <Stamp size={25} style={{ right: L.R, top: 770 }}>
        {EX}
      </Stamp>
      <Bubble text="주간 보고 스킬 만들고 싶어" at={t.ask} y={830} size={34} />
      <Bubble me={false} text="언제 쓰나요? 잘 쓴 보고서는 어떤 거예요?" at={t.q} y={960} w={720} size={32} />
      <div style={{ position: 'absolute', left: L.X, top: 1116, display: 'flex', alignItems: 'center', gap: 6, ...fadeUp(f, t.file, 22) }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '16px 22px', borderRadius: 18, background: '#fff', color: C.ink, font: `800 30px/1 ${F.ko}`, boxShadow: shadow }}>
          <Icon kind="skill" size={34} /> 만들어 준 스킬 파일
        </span>
        <span style={{ font: `750 32px/1.2 ${F.ko}`, color: '#fff' }}>
          <Arr />
          Customize › Skills에 올리기
        </span>
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1246, width: CW, boxSizing: 'border-box', padding: '18px 24px', borderRadius: 22, background: C.markField, color: C.ink, ...fadeUp(f, t.up, 18) }}>
        <div style={{ font: `850 29px/1.25 ${F.ko}`, letterSpacing: '-.03em' }}>먼저 켜 둘 것 · 무료 포함 모든 요금제</div>
        <div style={{ marginTop: 6, font: `650 25px/1.3 ${F.ko}`, letterSpacing: '-.01em' }}>Settings › Capabilities · Code execution and file creation(코드 실행·파일 만들기)</div>
      </div>
    </>
  );
};

// ── 06 커넥터 ─────────────────────────────────────────────────────────
// 앱 칩 둘(Gmail·캘린더 — 드라이브는 「자료」와 겹쳐 블로그로, Fable 10-22) → 선 → 「물어볼 때 찾아 읽기」, 「메일을」에 승인 상자(예시).
export const connT = () => ({ apps: wordIn('conn', 'v06', '지메일,', 73), read: wordIn('conn', 'v06', '물어볼', 77), send: wordIn('conn', 'v06', '읽고,', 80), ask: wordIn('conn', 'v06', '보내기', 82) });
export const Conn06: React.FC = () => {
  const f = useCurrentFrame();
  const t = connT();
  const apps = ['Gmail', 'Google 캘린더'];
  const line = ease(f, t.read - 6, 14);
  const press = interpolate(f, [t.ask + 10, t.ask + 13, t.ask + 19], [1, 0.92, 1], clamp);
  return (
    <>
      <HeadF left={HEAD} right="③ 메일·일정" />
      <Lines at={IN} size={84} top={L.TOP} lines={[<>메일·일정이면 <Arr key="a" w={0.8} /></>, <MarkF key="m" p={ramp(f, IN + 8, 12)}>커넥터</MarkF>]} />
      <div style={{ position: 'absolute', left: L.X, top: 770, width: CW, display: 'flex', gap: 16 }}>
        {apps.map((a, i) => (
          <span key={a} style={{ flex: 1, textAlign: 'center', padding: '22px 0', borderRadius: 20, background: '#fff', color: C.ink, font: `800 32px/1 ${F.ko}`, letterSpacing: '-.03em', boxShadow: shadow, position: 'relative', top: bob(f, i * 10, 3), ...fadeUp(f, t.apps + i * 6, 22) }}>
            {a}
          </span>
        ))}
      </div>
      <svg width={CW} height={70} style={{ position: 'absolute', left: L.X, top: 850, overflow: 'visible' }}>
        {[0, 1].map((i) => {
          const x0 = (CW / 2) * i + CW / 4;
          return <line key={i} x1={x0} y1={0} x2={CW / 2} y2={70 * line} stroke="#fff" strokeWidth={4} strokeDasharray="8 8" opacity={0.85 * line} />;
        })}
      </svg>
      <div style={{ position: 'absolute', left: L.X, top: 928, width: CW, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 26px', borderRadius: 24, background: C.ink, color: '#fff', ...fadeUp(f, t.read - 4, 20) }}>
        <FeatureTag kind="plug" en="Customize › Connectors" ko="커넥터" size={30} dark />
        <span style={{ font: `850 32px/1.15 ${F.ko}`, color: C.markField, textAlign: 'right' }}>
          물어볼 때
          <br />
          찾아 읽기
        </span>
      </div>
      <Board x={L.X + 40} y={1086 + bob(f, 5, 3)} w={CW - 80} style={{ padding: '24px 28px', ...fadeUp(f, t.send, 24) }}>
        <div style={{ font: `800 34px/1.25 ${F.ko}`, letterSpacing: '-.03em' }}>이 메일을 보낼까요?</div>
        <div style={{ marginTop: 6, font: `600 24px/1.3 ${F.ko}`, color: C.muted }}>받는 사람 · 거래처 담당자</div>
        <div style={{ marginTop: 18, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <span style={{ padding: '12px 22px', borderRadius: 14, background: '#f1f3f6', font: `750 26px/1 ${F.ko}` }}>취소</span>
          <span style={{ padding: '12px 22px', borderRadius: 14, background: C.acc, color: '#fff', font: `800 26px/1 ${F.ko}`, scale: String(press) }}>승인</span>
        </div>
      </Board>
      <div style={{ position: 'absolute', left: L.X, top: 1350, width: CW, font: `750 31px/1.35 ${F.ko}`, color: '#fff', wordBreak: 'keep-all', ...fadeUp(f, t.ask, 16) }}>
        메일 보내기 전엔 먼저 물어봐요 <span style={{ color: C.onField2, fontWeight: 600 }}>(기본 설정)</span>
      </div>
    </>
  );
};

// ── 07 한 장 정리 ─────────────────────────────────────────────────────
// 표 넷: 셋은 목소리 「자료는」·「방식은」·「메일과」에, 넷째(아티팩트)는 작게 뒤에. 끝에 「저장」 도장.
export const sumT = () => ({ a: wordIn('sum', 'v07', '자료는', 87), b: wordIn('sum', 'v07', '방식은', 89), c: wordIn('sum', 'v07', '메일과', 90), free: wordIn('sum', 'v07', '셋', 93), save: wordIn('sum', 'v07', '커넥터.', 92) });
const ROWS: { when: string; kind: IconKind; what: string; note: string }[] = [
  { when: '같은 자료를 붙여 넣는다', kind: 'folder', what: '프로젝트', note: 'Projects · 무료 5개' },
  { when: '같은 방식을 설명한다', kind: 'skill', what: '스킬', note: 'Skills · 코드 실행 켜기' },
  { when: '메일·일정을 복사해 온다', kind: 'plug', what: '커넥터', note: 'Connectors · 보내기 전 승인' },
];
export const Sum07: React.FC = () => {
  const f = useCurrentFrame();
  const t = sumT();
  const ats = [t.a, t.b, t.c];
  const saveS = settle(f, t.save + 4, 18);
  return (
    <>
      <HeadF left={HEAD} right="한 장 정리" />
      <Lines at={IN} size={84} top={L.TOP} lines={['한 장 정리,', <MarkF key="m" p={ramp(f, t.a, 12)}>반복하는 말<Arr w={0.75} />기능</MarkF>]} />
      <div style={{ position: 'absolute', left: L.X, top: 770, width: CW, boxSizing: 'border-box', padding: '14px 18px', borderRadius: 30, background: '#fff', color: C.ink, boxShadow: shadow, ...fadeUp(f, IN, 26) }}>
        {ROWS.map((r, i) => {
          const on = settle(f, ats[i] - 2, 16);
          return (
            <div key={r.what} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 12px', borderTop: i ? `2px solid ${C.hair}` : 'none', background: on > 0.5 ? 'rgba(255,224,122,.35)' : 'transparent', borderRadius: 16, opacity: interpolate(on, [0, 0.4], [0.35, 1], clamp) }}>
              <div style={{ flex: 1, font: `750 33px/1.2 ${F.ko}`, letterSpacing: '-.035em' }}>{r.when}</div>
              <span style={{ font: `850 34px/1 ${F.ko}`, color: C.acc }}><Arr /></span>
              <div style={{ width: 316, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icon kind={r.kind} size={38} />
                <div>
                  <div style={{ font: `900 38px/1 ${F.ko}`, letterSpacing: '-.03em' }}>{r.what}</div>
                  <div style={{ marginTop: 6, font: `600 22px/1.15 ${F.ko}`, color: C.muted, whiteSpace: 'nowrap', letterSpacing: '-.02em' }}>{r.note}</div>
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 12px 8px', borderTop: `2px solid ${C.hair}`, ...fadeUp(f, t.c + 10, 14) }}>
          <div style={{ flex: 1, font: `650 27px/1.25 ${F.ko}`, color: C.muted, letterSpacing: '-.025em' }}>문서·슬라이드가 필요하다</div>
          <span style={{ font: `850 28px/1 ${F.ko}`, color: C.muted }}><Arr /></span>
          <div style={{ width: 316, font: `750 27px/1.25 ${F.ko}`, color: C.ink }}>
            그냥 만들어 달라고 하기
            <div style={{ font: `600 24px/1.2 ${F.ko}`, color: C.muted }}>아티팩트 · 무료 포함</div>
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1300, width: CW - 220, font: `700 28px/1.35 ${F.ko}`, color: '#fff', wordBreak: 'keep-all', ...fadeUp(f, t.free, 16) }}>
        셋 다 무료 계정도 돼요
        <div style={{ font: `600 23px/1.35 ${F.ko}`, color: C.onField2 }}>커넥터는 웹·데스크톱 · 팀·기업은 관리자가 켠 뒤</div>
      </div>
      <div style={{ position: 'absolute', right: L.R - 6, top: 1300, display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 24px', borderRadius: 16, background: C.crayon, color: '#fff', font: `900 36px/1 ${F.ko}`, rotate: '-6deg', scale: String(interpolate(saveS, [0, 1], [1.6, 1], clamp)), opacity: interpolate(saveS, [0, 0.3], [0, 1], clamp), boxShadow: '0 14px 28px -12px rgba(0,0,0,.5)' }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff">
          <path d="M6 3h12v18l-6-4.5L6 21z" />
        </svg>
        저장
      </div>
    </>
  );
};

// ── 08 끝 ─────────────────────────────────────────────────────────────
export const End08: React.FC<{ variant: 'A' | 'B' }> = ({ variant }) => {
  const f = useCurrentFrame();
  const local = (abs: number) => abs - seq('end').from;
  const still = local(TOTAL - 18);
  const ff = Math.min(f, still);
  const press = interpolate(ff, [local(CUT) - 1, local(CUT) + 1, local(CUT) + 7], [1, 0.95, 1], clamp);
  const q = wordIn('end', 'v08', '여러분은', 103);
  return (
    <>
      <HeadF left={HEAD} right="@synkbrief" />
      <Lines at={IN} size={80} top={L.TOP} lines={['같은 말 또 할 때,', <MarkF key="m" p={ramp(ff, wordIn('end', 'v08', '꺼내', 100), 12)}>저장해 둔 표 꺼내기</MarkF>]} />
      <div style={{ position: 'absolute', left: L.X, top: 760, width: CW, display: 'flex', gap: 12, ...fadeUp(ff, IN + 2, 20) }}>
        {ROWS.map((r, i) => (
          <span key={r.what} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '16px 0', borderRadius: 18, background: '#fff', color: C.ink, font: `850 30px/1 ${F.ko}`, translate: `0 ${bob(ff, i * 10, 3)}px` }}>
            <Icon kind={r.kind} size={30} /> {r.what}
          </span>
        ))}
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 900, ...fadeUp(ff, q - 4) }}>
        <div style={{ display: 'inline-block', padding: '24px 34px', borderRadius: 34, background: '#fff', color: C.ink, font: `850 44px/1.25 ${F.ko}`, letterSpacing: '-.035em', boxShadow: '0 22px 44px -22px rgba(4,12,36,.6)', scale: String(press), transformOrigin: '0 50%' }}>
          여러분은 AI한테
          <br />뭘 제일 많이 반복하세요?
        </div>
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1090, font: `650 34px/1.3 ${F.ko}`, color: C.onField, ...fadeUp(ff, q + 14) }}>
        댓글로 <b style={{ color: C.markField }}>① 자료 · ② 방식 · ③ 메일·일정</b>
        <div style={{ font: `600 28px/1.4 ${F.ko}`, color: C.onField2 }}>④ 아직 안 써 봤어요</div>
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1214, width: CW, font: `650 28px/1.35 ${F.ko}`, color: C.onField2, ...fadeUp(ff, q + 20) }}>
        메뉴 위치·스킬 만드는 법은 {variant === 'A' ? '캡션에' : '설명란에'}
      </div>
      <div style={{ position: 'absolute', left: L.X, right: L.R, top: 1320, display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...fadeUp(ff, IN + 6) }}>
        <span style={{ display: 'inline-flex', padding: '12px 18px', borderRadius: 16, background: '#fff' }}>
          <Img src={staticFile('kit/logo-shift.webp')} style={{ height: 40, display: 'block' }} />
        </span>
        <span style={{ font: `500 22px/1.3 ${F.ko}`, color: C.onField2, textAlign: 'right' }}>
          {SRC}
          <br />
          영문 메뉴 표기 · {MENU_NOTE.split(' · ')[1]}
        </span>
      </div>
    </>
  );
};
