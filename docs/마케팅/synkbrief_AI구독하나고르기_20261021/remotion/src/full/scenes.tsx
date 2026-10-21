// 「AI 유료 구독, 하나만 고른다면 — 질문 셋」 여덟 장면. 장면마다 착지 박(time.ts B)에 내려앉고, 글은 마스크로 올라오며, 강조는 크레용 밑줄·형광펜.
// 요금은 2026-10-21 아침 각 회사 공식 요금 페이지 문구를 그대로 옮긴 카드(기획.md 「정보 품질」), 06의 할인만 구글 원 실제 화면.
// 지난 편 v4 마감 점검대로: 판은 쉬지 않고 움직이고(카메라·떠 있기), 장면이 밀려 들어올 때 내용이 이미 보이며, 형광펜·밑줄·숫자는 목소리 낱말에 맞춘다.
import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, ramp } from '../lib/anim';
import { beat } from '../lib/beat';
import { C, F, L } from '../theme';
import { HeadF, Lines, MarkF, settle } from '../v5/cine';
import { camAt, countText, CREDIT, ease, fadeUp, IMG, landPop, Mark, PriceCard, QChip, Stamp, Verdict } from './parts';
import { at, CUT, seq, TOTAL } from './time';
import { wordFrame } from './vo-time';

const CW = L.W - L.X - L.R; // 836: 오른쪽 플랫폼 단추 자리를 비운 본문 폭
const HEAD = 'synkbrief 활용';
const IN = 2; // 들어오는 장면의 글·판이 시작하는 프레임 — 밀기(5~12프레임) 동안 이미 보인다

type K = Parameters<typeof seq>[0];
/** 장면 k 안에서 나레이션 줄 id의 낱말이 시작하는 프레임(없으면 fallback 박) */
const wordIn = (k: K, id: string, word: string, fallbackBeat: number, variant: 'A' | 'B' = 'A') => {
  const abs = wordFrame(variant, id, word);
  return abs === null ? at(k, fallbackBeat) : abs - seq(k).from;
};
const hiStyle = (p: number): React.CSSProperties => ({ backgroundImage: `linear-gradient(${C.mark},${C.mark})`, backgroundRepeat: 'no-repeat', backgroundSize: `${p * 100}% 44%`, backgroundPosition: '0 88%' });
/** 떠 있기: 판이 아주 천천히 오르내린다(정지 구간을 없앤다) */
const bob = (f: number, phase = 0, amp = 6) => Math.sin((f + phase) / 22) * amp;

// 요금 세 장(공식 페이지 그대로). Claude는 한국 접속 화면 표기(부가세 10% 포함 · 월별 결제).
const THREE = [
  { maker: 'OpenAI', plan: 'ChatGPT Plus', value: 29000, prefix: '₩', note: '한 달' },
  { maker: 'Google', plan: 'Google AI Pro', value: 29000, prefix: '₩', note: '한 달' },
  { maker: 'Anthropic', plan: 'Claude Pro', value: 22, prefix: '$', note: '한 달 · 부가세 포함 · 월별 결제' },
];

// ── 01 훅 ─────────────────────────────────────────────────────────────
// A(인스타 · 결과·오해): 0프레임부터 제목과 요금 세 장. 「질문 셋」에 ①②③ 칩.
// B(유튜브 · 질문): 같은 세 장 위에 「?」, 「질문 세 개」에 ①②③ 칩.
export const hookT = (variant: 'A' | 'B') => {
  const id = variant === 'A' ? 'a01' : 'b01';
  const q = variant === 'A' ? wordIn('hook', id, '질문', 5, variant) : wordIn('hook', id, '질문', 4.5, variant);
  return { q, mark: variant === 'A' ? wordIn('hook', id, '같아요.', 3, variant) : wordIn('hook', id, '딱', 2, variant) };
};
const Three: React.FC<{ y: number; at0: number; f: number; small?: boolean; stagger?: number; count?: boolean }> = ({ y, at0, f, small, stagger = 3, count = false }) => {
  const gap = 18;
  const w = Math.floor((CW - gap * 2) / 3);
  return (
    <>
      {THREE.map((c, i) => (
        <PriceCard
          key={c.plan}
          x={L.X + i * (w + gap)}
          y={y + bob(f, i * 17, 5)}
          w={w}
          h={small ? 240 : 256}
          maker={c.maker}
          plan={c.plan}
          value={c.value}
          prefix={c.prefix}
          unit=""
          at={at0 + i * stagger}
          countLen={count ? 14 : 0}
          size={small ? 46 : 50}
          note={c.note}
          style={{ padding: '22px 20px 20px' }}
        />
      ))}
    </>
  );
};
export const Hook01: React.FC<{ variant: 'A' | 'B' }> = ({ variant }) => {
  const f = useCurrentFrame();
  const t = hookT(variant);
  const chips = [
    { n: '①', label: '무료로 될까?' },
    { n: '②', label: '조금만 더?' },
    { n: '③', label: '묶음 혜택?' },
  ];
  // 0프레임부터 보이게: 카드는 -10프레임에 착지가 끝난 것으로 둔다
  const cardsAt = -12;
  const title =
    variant === 'A'
      ? ['AI 구독 세 곳,', <MarkF key="m" p={ramp(f, t.mark, 12)}>값은 거의 같아요</MarkF>]
      : ['AI 유료 구독,', <MarkF key="m" p={ramp(f, t.mark, 12)}>딱 하나만 한다면?</MarkF>];
  const zoom = interpolate(f, [0, seq('hook').len], [1, 1.05], clamp);
  return (
    <>
      <HeadF left={HEAD} right="2026.10.21 공식 요금" />
      <Lines visibleAtZero at={0} size={88} top={L.TOP} lines={title} />
      <div style={{ position: 'absolute', inset: 0, scale: String(zoom), transformOrigin: '50% 55%' }}>
        <Three y={800} at0={cardsAt} f={f} />
        {variant === 'B' ? null : (
          [0, 1].map((i) => {
            const gap = 18;
            const w = Math.floor((CW - gap * 2) / 3);
            const x = L.X + (i + 1) * (w + gap) - gap / 2;
            const s = settle(f, beat(1.5) + i * 4, 18);
            return (
              <div key={i} style={{ position: 'absolute', left: x - 30, top: 898, width: 60, height: 60, borderRadius: '50%', background: C.markField, color: C.ink, display: 'grid', placeItems: 'center', font: `900 44px/1 ${F.ko}`, scale: String(s), boxShadow: '0 10px 20px -10px rgba(0,0,0,.5)' }}>
                {i === 0 ? '=' : '≈'}
              </div>
            );
          })
        )}
        <div style={{ position: 'absolute', left: L.X, top: 1110, width: CW, display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {chips.map((c, i) => (
            <QChip key={c.n} n={c.n} label={c.label} at={t.q + i * 4} size={32} />
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1290, font: `650 28px/1.2 ${F.ko}`, color: C.onField2, opacity: interpolate(f, [t.q, t.q + 8], [0, 1], clamp) }}>
        그래서, 고르는 질문 셋
      </div>
    </>
  );
};

// ── 02 값: 세 회사 기본 유료 요금 ───────────────────────────────────────
// 줄마다 목소리 「플러스」·「프로,」·「클로드」에 숫자가 세어지고, 16박 드롭에 앞 둘 사이 「=」, 「못 골라요」에 밑줄.
export const priceT = () => ({
  r0: wordIn('price', 'v02', '플러스,', 9),
  r1: wordIn('price', 'v02', '프로,', 10),
  r2: wordIn('price', 'v02', '클로드', 13),
  eq: at('price', 16),
  fx: wordIn('price', 'v02', '환율로', 14),
  no: wordIn('price', 'v02', '못', 15),
});
export const Price02: React.FC = () => {
  const f = useCurrentFrame();
  const t = priceT();
  const rows = [t.r0, t.r1, t.r2];
  const rowH = 180;
  const top = 762;
  const eqS = settle(f, t.eq, 18);
  const z = interpolate(f, [0, seq('price').len], [1, 1.04], clamp);
  return (
    <>
      <HeadF left={HEAD} right="공식 요금 페이지" />
      <Lines at={IN} size={80} top={L.TOP} lines={['한 달 요금,', <MarkF key="m" p={ramp(f, t.no, 12)}>값으론 못 골라요</MarkF>]} />
      <div style={{ position: 'absolute', inset: 0, scale: String(z), transformOrigin: '50% 45%' }}>
        {THREE.map((c, i) => {
          const s = settle(f, rows[i] - 6, 16);
          const ring = i < 2 && f >= t.eq;
          return (
            <div
              key={c.plan}
              style={{
                position: 'absolute',
                left: L.X,
                top: top + i * (rowH + 18) + bob(f, i * 13, 3),
                width: CW,
                height: rowH,
                boxSizing: 'border-box',
                padding: '0 34px',
                borderRadius: 28,
                background: '#fff',
                color: C.ink,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: ring ? `0 0 0 6px ${C.mark},0 30px 60px -30px rgba(4,12,36,.7)` : '0 30px 60px -30px rgba(4,12,36,.7)',
                opacity: interpolate(s, [0, 0.4], [0, 1], clamp),
                translate: `${(1 - s) * 80}px 0`,
              }}
            >
              <div>
                <div style={{ font: `600 26px/1.2 ${F.ko}`, color: C.muted }}>{c.maker}</div>
                <div style={{ marginTop: 6, font: `800 42px/1.1 ${F.ko}`, letterSpacing: '-.035em' }}>{c.plan}</div>
                {c.prefix === '$' ? <div style={{ marginTop: 8, font: `600 22px/1.2 ${F.ko}`, color: C.muted }}>{c.note.replace('한 달 · ', '')}</div> : null}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'flex-end' }}>
                  <span style={{ font: `850 68px/1 ${F.ko}`, letterSpacing: '-.04em', color: C.acc, display: 'inline-block', scale: String(landPop(f, rows[i] + 10)), transformOrigin: '100% 80%' }}>{countText(f, rows[i] - 6, c.value, 16, c.prefix)}</span>
                  <span style={{ font: `700 28px/1 ${F.ko}`, color: C.muted }}>/월</span>
                </div>
                {c.prefix === '$' ? (
                  <div style={{ marginTop: 8, font: `750 26px/1.2 ${F.ko}`, color: C.ink, ...fadeUp(f, t.fx, 12) }}>
                    <span style={hiStyle(ramp(f, t.fx + 4, 12))}>≈ ₩29,200</span>
                    <span style={{ font: `500 20px/1.2 ${F.ko}`, color: C.muted }}> 10.21 환율 1,327원</span>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        <div style={{ position: 'absolute', left: L.X + CW - 120, top: top + rowH - 12, width: 74, height: 74, borderRadius: '50%', background: C.markField, color: C.ink, display: 'grid', placeItems: 'center', font: `900 52px/1 ${F.ko}`, scale: String(eqS * (1 + 0.15 * Math.sin(Math.min(1, Math.max(0, f - t.eq) / 8) * Math.PI))), boxShadow: '0 10px 22px -10px rgba(0,0,0,.5)' }}>=</div>
      </div>
      <div style={{ position: 'absolute', left: L.X, top: top + 3 * (rowH + 18) + 10, width: CW, font: `500 22px/1.35 ${F.ko}`, color: C.onField2, ...fadeUp(f, t.r2 + 6, 14) }}>
        {CREDIT} · Claude는 부가세 포함 표시, 원화는 페이지 표기 그대로 · 환율은 2026.10.21 Google Finance
      </div>
    </>
  );
};

// ── 03 ① 무료에서 막히나요? ──────────────────────────────────────────
// 흔한 오해 「일단 유료부터」에 ✕ → 챗GPT Free 카드(요금 페이지 비교표 문구 그대로): 「무제한」에 형광펜, 「막히는」에 「제한적」 줄.
// 「일주일만」에 결론 알약(바로 해 볼 한 단계). Fable 10-21 P1·P2 반영.
export const freeT = () => ({
  hi: wordIn('free', 'v03', '무제한,', 26),
  lim: wordIn('free', 'v03', '막히는', 27),
  ok: wordIn('free', 'v03', '일주일만', 29) - 2,
});
export const Free03: React.FC = () => {
  const f = useCurrentFrame();
  const t = freeT();
  return (
    <>
      <HeadF left={HEAD} right="질문 ①" />
      <div style={{ position: 'absolute', left: L.X, top: L.TOP - 6, width: CW, display: 'flex', alignItems: 'center', gap: 16 }}>
        <QChip n="①" label="무료로 될까?" at={IN - 10} on size={30} />
        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 999, background: 'rgba(255,255,255,.14)', color: '#fff', font: `700 28px/1 ${F.ko}`, ...fadeUp(f, IN + 4, 16) }}>
          <span style={{ textDecoration: f >= IN + 14 ? 'line-through' : 'none', textDecorationColor: C.crayon, textDecorationThickness: 4 }}>“일단 유료부터”?</span>
          <Mark ok={false} at={IN + 12} size={40} style={{ position: 'relative' }} />
        </span>
      </div>
      <Lines at={IN} size={84} top={L.TOP + 92} lines={['무료에서', <MarkF key="m" p={ramp(f, wordIn('free', 'v03', '막히나요?', 24), 12)}>막히나요?</MarkF>]} />
      <div style={{ position: 'absolute', left: L.X, top: 830 + bob(f, 3, 4), width: CW, boxSizing: 'border-box', padding: '28px 34px 26px', borderRadius: 28, background: '#fff', color: C.ink, boxShadow: '0 30px 60px -30px rgba(4,12,36,.7)', ...fadeUp(f, IN, 34) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ font: `800 38px/1.1 ${F.ko}`, letterSpacing: '-.035em' }}>ChatGPT Free</span>
          <span style={{ font: `850 52px/1 ${F.ko}`, color: C.acc, letterSpacing: '-.04em' }}>
            ₩0<span style={{ font: `700 24px/1 ${F.ko}`, color: C.muted }}>/월</span>
          </span>
        </div>
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', font: `750 42px/1.3 ${F.ko}`, letterSpacing: '-.035em' }}>
          <span>일상적인 텍스트 대화</span>
          <span style={hiStyle(ramp(f, t.hi, 14))}>무제한*</span>
        </div>
        <div style={{ marginTop: 14, padding: '14px 18px', borderRadius: 16, background: f >= t.lim ? '#fff1ee' : '#f4f5f7', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', font: `700 32px/1.3 ${F.ko}`, letterSpacing: '-.03em', color: f >= t.lim ? C.ink : C.muted, transition: 'none' }}>
          <span>파일 업로드 · 이미지 생성 · 심층 리서치</span>
          <span style={{ color: C.crayon, fontWeight: 800 }}>제한적</span>
        </div>
        <div style={{ marginTop: 14, font: `500 21px/1.4 ${F.ko}`, color: C.muted }}>*악용 방지를 위한 제한이 적용됩니다. — chatgpt.com 요금 페이지 비교표</div>
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1168, font: `600 26px/1.3 ${F.ko}`, color: C.onField2, ...fadeUp(f, t.lim + 8, 14) }}>
        Gemini·Claude도 무료 요금제가 있어요(한도는 회사마다 다름)
      </div>
      <Verdict x={L.X} y={1240} w={CW} lead="일주일 세어 보기" result="안 막히면 무료 그대로" at={t.ok} />
    </>
  );
};

// ── 04 ② 조금만 더 필요하면 ───────────────────────────────────────────
// 요금 사다리(₩0 → ₩7,500 → ₩13,000 → ₩29,000)에 점이 목소리 이름마다 켜지고, 아래 중간 요금제 카드 둘이 숫자를 센다.
export const midT = () => ({ go: wordIn('mid', 'v04', '고', 36), plus: wordIn('mid', 'v04', '플러스', 38), mid: wordIn('mid', 'v04', '중간', 34) });
export const Mid04: React.FC = () => {
  const f = useCurrentFrame();
  const t = midT();
  const w = Math.floor((CW - 20) / 2);
  const steps = [
    { v: 0, label: '무료', at: IN },
    { v: 7500, label: 'AI Plus', at: t.plus },
    { v: 13000, label: 'Go', at: t.go },
    { v: 29000, label: 'Plus · AI Pro', at: IN + 4 },
  ];
  const lx = L.X + 20;
  const lw = CW - 40;
  const pos = (v: number) => lx + (v / 29000) * lw;
  const midP = ease(f, t.mid, 16);
  return (
    <>
      <HeadF left={HEAD} right="질문 ②" />
      <div style={{ position: 'absolute', left: L.X, top: L.TOP - 6 }}>
        <QChip n="②" label="조금만 더?" at={IN - 10} on size={30} />
      </div>
      <Lines at={IN} size={84} top={L.TOP + 92} lines={['조금만 더라면,', <MarkF key="m" p={midP}>중간 요금제</MarkF>]} />
      {/* 요금 사다리 */}
      <div style={{ position: 'absolute', left: 0, top: 860, width: L.W, height: 150, ...fadeUp(f, IN, 20) }}>
        <div style={{ position: 'absolute', left: lx, top: 40, width: lw, height: 8, borderRadius: 4, background: 'rgba(255,255,255,.25)' }} />
        <div style={{ position: 'absolute', left: pos(7500) - 6, top: 34, width: (pos(13000) - pos(7500)) * midP + 12, height: 20, borderRadius: 10, background: C.markField, opacity: midP }} />
        {steps.map((s, i) => {
          const on = settle(f, s.at, 18);
          return (
            <div key={i} style={{ position: 'absolute', left: pos(s.v), top: 44, translate: '-50% -50%' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#fff', boxShadow: `0 0 0 ${on * 8}px rgba(255,235,176,.45)`, scale: String(0.6 + 0.4 * on) }} />
              <div style={{ position: 'absolute', left: '50%', top: 34, translate: '-50% 0', whiteSpace: 'nowrap', textAlign: 'center', opacity: interpolate(on, [0, 0.4], [0.35, 1], clamp) }}>
                <div style={{ font: `800 28px/1.1 ${F.ko}`, color: '#fff' }}>{s.v === 0 ? '₩0' : `₩${s.v.toLocaleString('ko-KR')}`}</div>
                <div style={{ font: `600 20px/1.3 ${F.ko}`, color: C.onField2 }}>{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>
      <PriceCard x={L.X} y={1060 + bob(f, 0, 4)} w={w} h={300} maker="OpenAI" plan="ChatGPT Go" value={13000} prefix="₩" at={t.go} note="이 플랜에는 광고가 포함될 수 있습니다" size={54} style={{ padding: '22px 22px 20px' }} />
      <PriceCard x={L.X + w + 20} y={1060 + bob(f, 11, 4)} w={w} h={300} maker="Google" plan="Google AI Plus" value={7500} prefix="₩" at={t.plus} note="무료보다 2배 사용량 · 400GB" size={54} style={{ padding: '22px 22px 20px' }} />
    </>
  );
};

// ── 05 ③ 매일 쓰는 게 있나요? ─────────────────────────────────────────
// 저장공간 막대: 무료 15GB가 차오르다 목소리 「찼으면」에 붉게 → 「구글,」에 유료 저장공간 둘(AI Plus 400GB · AI Pro 5TB)이 같은 눈금으로 열린다.
// 결론은 구글 하나로 밀지 않는다 — 「챗지피티나」에 「손에 익은 AI → 그 회사」(Fable 10-21 P1).
export const bundleT = () => ({ full: wordIn('bundle', 'v05', '찼으면', 52), g: wordIn('bundle', 'v05', '구글,', 53), hand: wordIn('bundle', 'v05', '챗지피티나', 54) });
export const Bundle05: React.FC = () => {
  const f = useCurrentFrame();
  const t = bundleT();
  const fill = ease(f, IN + 2, Math.max(10, t.full - IN - 2));
  const red = interpolate(f, [t.full - 2, t.full + 6], [0, 1], clamp);
  const open = ease(f, t.g, 22);
  const tiers = [
    { name: 'Google AI Plus', size: '400GB', w: 400 / 5000, price: '₩7,500/월' },
    { name: 'Google AI Pro', size: '5TB', w: 1, price: '₩29,000/월' },
  ];
  return (
    <>
      <HeadF left={HEAD} right="질문 ③" />
      <div style={{ position: 'absolute', left: L.X, top: L.TOP - 6 }}>
        <QChip n="③" label="묶음 혜택?" at={IN - 10} on size={30} />
      </div>
      <Lines at={IN} size={84} top={L.TOP + 92} lines={['매일 쓰는 게', <MarkF key="m" p={ramp(f, wordIn('bundle', 'v05', '있나요?', 51), 12)}>있나요?</MarkF>]} />
      <div style={{ position: 'absolute', left: L.X, top: 836 + bob(f, 7, 4), width: CW, boxSizing: 'border-box', padding: '26px 20px 24px', borderRadius: 28, background: '#fff', color: C.ink, boxShadow: '0 30px 60px -30px rgba(4,12,36,.7)', ...fadeUp(f, IN, 30) }}>
        <div style={{ padding: '0 12px', display: 'flex', justifyContent: 'space-between', font: `750 30px/1.2 ${F.ko}` }}>
          <span>구글 무료 저장공간</span>
          <span style={{ color: red > 0.5 ? C.crayon : C.muted }}>15GB{red > 0.5 ? ' · 꽉 참' : ''}</span>
        </div>
        <div style={{ margin: '12px 0 0', height: 30, borderRadius: 15, background: C.hair, overflow: 'hidden' }}>
          <div style={{ width: `${fill * 100}%`, height: '100%', borderRadius: 15, background: red > 0.5 ? C.crayon : C.acc }} />
        </div>
        {tiers.map((x, i) => (
          <div key={x.name} style={{ marginTop: i === 0 ? 26 : 16, opacity: interpolate(open, [0, 0.3], [0.25, 1], clamp) }}>
            <div style={{ padding: '0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', font: `750 28px/1.2 ${F.ko}` }}>
              <span>
                {x.name} <span style={{ font: `600 22px/1 ${F.ko}`, color: C.muted }}>{x.price}</span>
              </span>
              <span style={{ color: C.acc }}>{x.size}</span>
            </div>
            <div style={{ margin: '10px 0 0', height: 30, borderRadius: 15, background: C.hair, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(0.03, x.w) * ease(f, t.g + i * 6, 22) * 100}%`, height: '100%', borderRadius: 15, background: `linear-gradient(90deg, ${C.acc}, ${C.field})` }} />
            </div>
          </div>
        ))}
        <div style={{ marginTop: 12, padding: '0 12px', font: `500 21px/1.3 ${F.ko}`, color: C.muted }}>Gmail · Drive · 포토에서 쓰는 클라우드 저장공간 — 구글 원 요금 페이지</div>
      </div>
      <Verdict x={L.X} y={1210} w={CW} lead="구글 사진·메일이 꽉 찼으면" result="구글 요금제" at={t.g + 8} ok={false} />
      <Verdict x={L.X} y={1318} w={CW} lead="챗GPT·클로드가 손에 익었으면" result="그 회사 걸로" at={t.hand} ok={false} />
    </>
  );
};

// ── 06 시한: 구글 AI 프로 연간 40% 할인 ─────────────────────────────────
// 구글 원 실제 화면(파란 할인 띠)이 목소리 「시월」에 띠로 당겨 들어가고, 「사십」에 「40%」 도장 + ₩290,000 취소선 → ₩174,000.
// 조건(신규 연간·대상자 한정·10월 31일까지 신청)은 오른쪽에 같이, 「클로드도」에 Claude Pro 연간 요금 한 줄(Fable 10-21 P1 — 할인이 구글만인 듯 보이지 않게).
export const saleT = () => ({ pct: wordIn('sale', 'v06', '사십', 69), date: wordIn('sale', 'v06', '시월', 67), claude: wordIn('sale', 'v06', '클로드도', 71) });
export const Sale06: React.FC = () => {
  const f = useCurrentFrame();
  const t = saleT();
  const len = seq('sale').len;
  const cw = 380;
  const ih = Math.round((cw * 1611) / 1080); // 그림 전체 높이
  const ch = 400; // 판 높이: 그림 위쪽(할인 띠·요금·5TB)만 — 가입 단추는 판 밖
  // 카메라: 카드 전체 → 위쪽 파란 할인 띠로 당겨 들어간다
  const cam = camAt(f, [
    [0, { z: 1, fx: 0.5, fy: 0.3 }],
    [t.date, { z: 1.0, fx: 0.5, fy: 0.3 }],
    [t.date + 40, { z: 1.22, fx: 0.5, fy: 0.08 }],
    [len, { z: 1.3, fx: 0.5, fy: 0.08 }],
  ]);
  const tx = cw / 2 - cam.z * cam.fx * cw;
  const ty = Math.min(0, Math.max(ch - cam.z * ih, ch / 2 - cam.z * cam.fy * ih));
  const pct = settle(f, t.pct, 16);
  const strike = ease(f, t.pct + 2, 10);
  const px = L.X + cw + 30;
  const pw = L.W - L.R - px;
  return (
    <>
      <HeadF left={HEAD} right="구글코리아 블로그 · 2026.10.02" />
      <Lines at={IN} size={76} top={L.TOP} lines={['구글 AI 프로 연간,', <MarkF key="m" p={ramp(f, t.date, 12)}>10월 31일까지</MarkF>]} />
      <div style={{ position: 'absolute', left: L.X, top: 760, width: cw, height: ch, borderRadius: 28, overflow: 'hidden', boxShadow: '0 0 0 1px rgba(255,255,255,.12),0 50px 90px -40px rgba(4,12,36,.75)', ...fadeUp(f, IN, 30) }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: cw, height: ih, transformOrigin: '0 0', transform: `translate(${Math.min(0, Math.max(cw - cam.z * cw, tx))}px, ${ty}px) scale(${cam.z})` }}>
          <Img src={IMG.googleCard} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
        <Stamp size={18} style={{ left: 14, bottom: 14, padding: '6px 10px' }}>
          구글 원 요금 페이지 실제 화면
        </Stamp>
      </div>
      <div style={{ position: 'absolute', left: px, top: 770, width: pw }}>
        <div style={{ font: `650 26px/1.2 ${F.ko}`, color: C.onField2, ...fadeUp(f, IN + 4, 16) }}>Google AI Pro 연간</div>
        <div style={{ position: 'relative', display: 'inline-block', marginTop: 10, font: `800 46px/1 ${F.ko}`, color: 'rgba(255,255,255,.8)', ...fadeUp(f, IN + 6, 16) }}>
          ₩290,000
          <span style={{ position: 'absolute', left: -4, top: '52%', height: 6, width: `calc(${strike * 100}% + 8px)`, background: C.crayon, borderRadius: 3 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
          <div style={{ font: `850 54px/1 ${F.ko}`, color: C.markField, letterSpacing: '-.04em', opacity: interpolate(f, [t.pct, t.pct + 6], [0, 1], clamp), scale: String(landPop(f, t.pct + 18)), transformOrigin: '0 80%' }}>
            {countText(f, t.pct, 174000, 18, '₩')}
          </div>
          <div style={{ flex: 'none', display: 'grid', placeItems: 'center', width: 100, height: 100, borderRadius: '50%', background: C.crayon, color: '#fff', font: `900 36px/1 ${F.ko}`, rotate: `${-10 + 4 * (1 - pct)}deg`, scale: String(interpolate(pct, [0, 1], [1.8, 1], clamp)), opacity: interpolate(pct, [0, 0.3], [0, 1], clamp), boxShadow: '0 18px 36px -16px rgba(0,0,0,.6)' }}>
            40%
          </div>
        </div>
        <div style={{ marginTop: 8, font: `600 24px/1.3 ${F.ko}`, color: C.onField2, opacity: interpolate(f, [t.pct + 10, t.pct + 18], [0, 1], clamp) }}>월 환산 ₩14,500</div>
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
          {['신규 연간 구독만', '혜택 적용 대상자 한정', '10월 31일까지 신청'].map((s, i) => (
            <span key={s} style={{ padding: '10px 16px', borderRadius: 12, background: '#fff', color: C.ink, font: `750 26px/1 ${F.ko}`, ...fadeUp(f, (i === 2 ? t.date : t.date - 20) + i * 3, 16) }}>
              {s}
            </span>
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1250, width: CW, display: 'flex', alignItems: 'baseline', gap: 14, padding: '18px 24px', boxSizing: 'border-box', borderRadius: 22, background: '#fff', color: C.ink, ...fadeUp(f, t.claude - 2, 24) }}>
        <span style={{ font: `800 32px/1.2 ${F.ko}`, letterSpacing: '-.03em' }}>Claude Pro도 연간이면</span>
        <span style={{ font: `850 40px/1 ${F.ko}`, color: C.acc }}>월 $18</span>
        <span style={{ font: `500 21px/1.2 ${F.ko}`, color: C.muted }}>선불 $220 · claude.com</span>
      </div>
    </>
  );
};

// ── 07 정리: 고르는 질문 셋 ───────────────────────────────────────────
// 세 줄이 목소리 「안」·「조금」·「매일」에 하나씩 착지하고 체크가 붙는다. 맨 아래 바로 해 볼 한 단계.
export const sumT = () => ({ a: wordIn('sum', 'v07', '안', 80.5), b: wordIn('sum', 'v07', '조금', 82), c: wordIn('sum', 'v07', '매일', 84) });
export const Sum07: React.FC = () => {
  const f = useCurrentFrame();
  const t = sumT();
  const rows = [
    { n: '①', q: '무료에서 막히나요?', a: '안 막히면 무료 그대로', at: t.a },
    { n: '②', q: '조금만 더 필요하면?', a: '중간 요금제(₩7,500 · ₩13,000)', at: t.b },
    { n: '③', q: '매일 쓰는 게 있나요?', a: '그 회사 걸로', at: t.c },
  ];
  return (
    <>
      <HeadF left={HEAD} right="정리" />
      <Lines at={IN} size={84} top={L.TOP} lines={['고르는 질문,', <MarkF key="m" p={ramp(f, t.a, 12)}>딱 셋</MarkF>]} />
      {rows.map((r, i) => {
        const s = settle(f, r.at - 4, 16);
        return (
          <div
            key={r.n}
            style={{
              position: 'absolute',
              left: L.X,
              top: 760 + i * 196 + bob(f, i * 9, 3),
              width: CW,
              height: 176,
              boxSizing: 'border-box',
              padding: '0 28px',
              borderRadius: 26,
              background: '#fff',
              color: C.ink,
              display: 'flex',
              alignItems: 'center',
              gap: 22,
              boxShadow: '0 26px 50px -28px rgba(4,12,36,.7)',
              opacity: interpolate(s, [0, 0.4], [0.18, 1], clamp),
              translate: `${(1 - s) * 60}px 0`,
            }}
          >
            <span style={{ flex: 'none', width: 74, height: 74, borderRadius: '50%', background: C.field, color: '#fff', display: 'grid', placeItems: 'center', font: `900 44px/1 ${F.ko}` }}>{r.n}</span>
            <div style={{ flex: 1 }}>
              <div style={{ font: `650 28px/1.2 ${F.ko}`, color: C.muted, letterSpacing: '-.02em' }}>{r.q}</div>
              <div style={{ marginTop: 8, font: `800 36px/1.2 ${F.ko}`, letterSpacing: '-.035em' }}>{r.a}</div>
            </div>
            <Mark ok at={r.at + 6} size={56} style={{ position: 'relative', flex: 'none' }} />
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: L.X, top: 760 + 3 * 196 + 6, width: CW, font: `700 32px/1.3 ${F.ko}`, color: C.markField, letterSpacing: '-.03em', ...fadeUp(f, t.c + 16, 16) }}>
        먼저 일주일, 무료에서 막히는 횟수부터 세어 보기
      </div>
    </>
  );
};

// ── 08 끝 ─────────────────────────────────────────────────────────────
// cut박 뒤 곡 끝맺음 첫 타격에 댓글 단추가 한 번 눌리고, 요금 세 장은 끝까지 천천히 당겨진다. 마지막 0.6초만 멈춘 화면.
export const End08: React.FC<{ variant: 'A' | 'B' }> = ({ variant }) => {
  const f = useCurrentFrame();
  const local = (abs: number) => abs - seq('end').from;
  const still = local(TOTAL - 18);
  const ff = Math.min(f, still);
  const press = interpolate(ff, [local(CUT) - 1, local(CUT) + 1, local(CUT) + 7], [1, 0.95, 1], clamp);
  const q = wordIn('end', 'v08', '지금', 83);
  const zoom = interpolate(ff, [0, still], [0.94, 1.06], clamp);
  return (
    <>
      <HeadF left={HEAD} right="@synkbrief" />
      <Lines at={IN} size={84} top={L.TOP} lines={['질문 셋 정리는', <MarkF key="m" p={ramp(ff, wordIn('end', 'v08', '정리해', 81), 12)}>{variant === 'A' ? '캡션에' : '고정 댓글에'}</MarkF>]} />
      <div style={{ position: 'absolute', inset: 0, scale: String(zoom), transformOrigin: '50% 48%', ...fadeUp(ff, IN + 2, 30) }}>
        <Three y={760} at0={-30} f={ff} small />
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1060, ...fadeUp(ff, q - 4) }}>
        <div style={{ display: 'inline-block', padding: '22px 34px', borderRadius: 999, background: '#fff', color: C.ink, font: `800 44px/1.1 ${F.ko}`, letterSpacing: '-.035em', boxShadow: '0 22px 44px -22px rgba(4,12,36,.6)', scale: String(press), transformOrigin: '50% 50%' }}>
          지금 AI 구독, 몇 개 쓰세요?
        </div>
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1176, font: `600 32px/1.3 ${F.ko}`, color: C.onField, ...fadeUp(ff, q + 20) }}>
        댓글로 <b style={{ color: C.markField }}>0 · 1 · 2 · 3개 이상</b>
      </div>
      <div style={{ position: 'absolute', left: L.X, right: L.R, top: 1290, display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...fadeUp(ff, IN + 6) }}>
        <span style={{ display: 'inline-flex', padding: '12px 18px', borderRadius: 16, background: '#fff' }}>
          <Img src={staticFile('kit/logo-shift.webp')} style={{ height: 40, display: 'block' }} />
        </span>
        <span style={{ font: `500 22px/1.2 ${F.ko}`, color: C.onField2 }}>{CREDIT}</span>
      </div>
    </>
  );
};
