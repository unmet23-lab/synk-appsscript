// 본편 장면. 청금석 무대 하나 위에서 장면마다 변화 하나. 사건 시각은 나레이션 낱말 시각(wf)에 붙인다.
// 증거는 실제 화면(떠 있는 판), 비유는 펠트 물건. 화면 캡처는 기울이지 않는다(읽어야 하니까).
import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, EASE_IN_OUT, EASE_OUT, ramp } from '../lib/anim';
import { CursorArc, FloatCard, HeadF, lerp, Lines, MarkF, settle } from '../lib/cine';
import { C, F, L } from '../theme';
import { Scene, SceneKey, vEnd, wf } from '../timeline';
import { FPS } from '../lib/beat';

type P = { s: Scene };
const img = (n: string) => staticFile(`img/${n}`);
const feltShadow = 'drop-shadow(0 34px 44px rgba(0,0,0,.34))';

// ── 작은 부품 ───────────────────────────────────────────────

/** 말자막: 덩어리가 그 낱말을 말하는 순간 짧게 떠오른다. 강조 덩어리는 노란 글자. show/hide로 두 단계 자막. */
const Cap: React.FC<{ s: Scene; id: string; chunks: { t: string; w: number; em?: boolean }[]; hideAt?: number; showAt?: number }> = ({ s, id, chunks, hideAt, showAt }) => {
  const f = useCurrentFrame();
  if (showAt !== undefined && f < showAt) return null;
  if (hideAt !== undefined && f >= hideAt) return null;
  return (
    <p style={{ position: 'absolute', left: L.X, right: L.R, bottom: L.H - L.CAP_BOTTOM, margin: 0, font: `760 58px/1.24 ${F.ko}`, letterSpacing: '-.03em', color: '#fff' }}>
      {chunks.map((c, i) => {
        const at = wf(s, id, c.w) - 2;
        const p = interpolate(f, [at, at + 7], [0, 1], { ...clamp, easing: EASE_OUT });
        return (
          <span key={i} style={{ display: 'inline-block', marginRight: '.26em', opacity: p, translate: `0 ${(1 - p) * 14}px`, color: c.em ? C.markField : undefined }}>
            {c.t}
          </span>
        );
      })}
    </p>
  );
};

/** 날짜 도장 칩: 눌리듯 1.2 → 1, −4° */
const Stamp: React.FC<{ at: number; num: string; word: string; left: number; top: number }> = ({ at, num, word, left, top }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const p = settle(f, at, 20);
  return (
    <div style={{ position: 'absolute', left, top, display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 26px', borderRadius: 16, background: '#fff', color: C.ink, font: `800 46px/1 ${F.ko}`, letterSpacing: '-.03em', boxShadow: `0 0 0 4px ${C.ink}, ${8 * p}px ${8 * p}px 0 ${C.ink}`, rotate: '-4deg', scale: String(1.2 - 0.2 * p), opacity: interpolate(f - at, [0, 2], [0, 1], clamp) }}>
      <b style={{ font: `500 46px/1 ${F.mono}`, color: C.acc, letterSpacing: '-.04em' }}>{num}</b>
      {word}
    </div>
  );
};

/** O·✕ 둥근 딱지(흰 바탕) */
const Badge: React.FC<{ at: number; ok: boolean; x: number; y: number; size?: number }> = ({ at, ok, x, y, size = 150 }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const p = settle(f, at, 20);
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: `0 0 0 4px ${C.ink}, 0 18px 30px -12px rgba(0,0,0,.45)`, scale: String(1.25 - 0.25 * p), opacity: interpolate(f - at, [0, 2], [0, 1], clamp) }}>
      <span style={{ font: `800 ${size * 0.62}px/1 ${F.latin}`, color: ok ? C.ok : C.no, marginTop: size * 0.02 }}>{ok ? 'O' : '✕'}</span>
    </div>
  );
};

/** 출처 줄(모노, 작게) */
const Src: React.FC<{ top: number; children: React.ReactNode }> = ({ top, children }) => (
  <p style={{ position: 'absolute', left: L.X, right: L.R, top, margin: 0, font: `500 24px/1.3 ${F.mono}`, color: C.onField2 }}>{children}</p>
);

/** 흰 이름표 */
const Tag: React.FC<{ x: number; y: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ x, y, children, style }) => (
  <span style={{ position: 'absolute', left: x, top: y, padding: '12px 22px', borderRadius: 14, background: '#fff', color: C.ink, font: `800 36px/1 ${F.ko}`, letterSpacing: '-.02em', boxShadow: `0 0 0 3px ${C.ink}`, whiteSpace: 'nowrap', ...style }}>{children}</span>
);

/** 화살표: 「→」 글자는 SUIT에서 꺾쇠(>)처럼 보여서 선으로 그린다 */
const Arrow: React.FC = () => (
  <svg viewBox="0 0 40 24" style={{ width: '.86em', height: '.52em', verticalAlign: '.06em', overflow: 'visible' }}>
    <path d="M3 12 H34 M24 3 L36 12 L24 21" fill="none" stroke="currentColor" strokeWidth={4.6} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** 풀이 줄(흰 글자, 강조는 노랑) */
const Gloss: React.FC<{ top: number; at: number; children: React.ReactNode; small?: string }> = ({ top, at, children, small }) => {
  const f = useCurrentFrame();
  const p = settle(f, at, 16);
  return (
    <div style={{ position: 'absolute', left: L.X, right: L.R, top, font: `700 36px/1.35 ${F.ko}`, letterSpacing: '-.02em', color: '#fff', opacity: p, translate: `0 ${(1 - p) * 24}px` }}>
      {children}
      {small ? <div style={{ marginTop: 6, font: `500 24px/1.3 ${F.mono}`, color: C.onField2 }}>{small}</div> : null}
    </div>
  );
};

const Title: React.FC<{ s: Scene; children: React.ReactNode; size?: number; second?: React.ReactNode }> = ({ s, children, size = 72, second }) => (
  <Lines at={s.land - 2} size={size} top={L.TOP - 8} lines={second ? [children, second] : [children]} />
);
const useMark = (s: Scene, delay = 8) => ramp(useCurrentFrame(), s.land + delay, 12);

// ── 01A 훅(인스타 · 결과) ───────────────────────────────────
const HookA: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const markAt = wf(s, 'a01', 7); // 사라집니다
  const punch = settle(f, markAt, 10);
  const b1 = settle(f, wf(s, 'a01', 0), 9); // 지피티에스랑
  const b2 = settle(f, wf(s, 'a01', 1), 9); // 젬
  const src = settle(f, wf(s, 'a01', 3), 14); // 두셨죠?
  return (
    <>
      <HeadF right="개인 계정 기준 · 실제 화면" />
      <div style={{ position: 'absolute', inset: 0, scale: String(1 + 0.04 * punch), transformOrigin: '30% 40%' }}>
        <Lines visibleAtZero at={0} size={104} top={L.TOP - 6} lines={['GPTs·젬,', '올해 둘 다', <MarkF key="m" p={ramp(f, markAt, 12)}>사라집니다</MarkF>]} />
        <FloatCard style={{ left: L.X, top: 930 + (1 - b1) * 90, width: L.CW, height: Math.round((215 * L.CW) / 1225) }}>
          <Img src={img('gemini_banner.png')} style={{ width: L.CW, display: 'block' }} />
        </FloatCard>
        <FloatCard style={{ left: L.X, top: 1102 + (1 - b2) * 90, width: L.CW, height: Math.round((172 * L.CW) / 1281), opacity: interpolate(b2, [0, 0.25], [0, 1], clamp) }}>
          <Img src={img('chatgpt_banner.png')} style={{ width: L.CW, display: 'block' }} />
        </FloatCard>
        <div style={{ opacity: src }}><Src top={1238}>화면: 제미나이 Gems · ChatGPT 「내 GPT」 · 2026.10.17</Src></div>
      </div>
    </>
  );
};

// ── 01C 훅(유튜브 · 틀린 것) ────────────────────────────────
const HookC: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const xAt = wf(s, 'c01', 5); // 아닙니다
  const box = settle(f, 0, 9);
  return (
    <>
      <HeadF right="개인 계정 기준" />
      <Lines visibleAtZero at={0} size={92} top={L.TOP - 6} lines={['「알아서 옮겨', '주겠지?」']} />
      <Lines at={wf(s, 'c01', 4) - 4} size={92} top={L.TOP - 6 + Math.round(92 * 1.12) * 2} lines={[<>GPTs는 <MarkF key="m" p={ramp(f, xAt, 12)}>아닙니다</MarkF></>]} />
      <Img src={img('felt_box1.webp')} style={{ position: 'absolute', left: 250, top: 900 + (1 - box) * 80, width: 470, filter: feltShadow }} />
      <Badge at={xAt} ok={false} x={660} y={880} size={190} />
    </>
  );
};

// ── 02A 맞혀 보기(인스타) ───────────────────────────────────
const QuizA: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const think = vEnd(s, 'a02');
  const card = (i: number) => settle(f, s.land + i * 4, 12);
  const fill = ramp(f, think, 20, (t) => t);
  const Card: React.FC<{ i: number; ok: boolean; label: string }> = ({ i, ok, label }) => (
    <div style={{ height: 400, borderRadius: 36, background: '#fff', display: 'grid', placeItems: 'center', alignContent: 'center', boxShadow: `0 0 0 3px ${C.ink}, 10px 10px 0 ${C.ink}`, translate: `0 ${(1 - card(i)) * 120}px`, opacity: interpolate(card(i), [0, 0.3], [0, 1], clamp) }}>
      <span style={{ font: `800 210px/1 ${F.latin}`, color: ok ? C.ok : C.no }}>{ok ? 'O' : '✕'}</span>
      <small style={{ marginTop: 6, font: `700 40px/1 ${F.ko}`, color: C.ink }}>{label}</small>
    </div>
  );
  return (
    <>
      <HeadF right="맞혀 보세요" />
      <Title s={s}><><MarkF p={useMark(s)}>알아서</MarkF> 옮겨질까?</></Title>
      <div style={{ position: 'absolute', left: L.X, right: L.R, top: 680, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
        <Card i={0} ok label="옮겨진다" />
        <Card i={1} ok={false} label="직접 해야" />
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1130, width: L.CW, height: 12, borderRadius: 6, background: 'rgba(255,255,255,.22)', opacity: f >= think - 2 ? 1 : 0 }}>
        <div style={{ width: `${fill * 100}%`, height: '100%', borderRadius: 6, background: C.markField }} />
      </div>
      <Cap s={s} id="a02" chunks={[{ t: '만들어 둔 건,', w: 1 }, { t: '알아서', w: 4, em: true }, { t: '옮겨질까요?', w: 5 }]} />
    </>
  );
};

// ── 02C 그럼 젬은(유튜브) ──────────────────────────────────
const QuizC: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const think = vEnd(s, 'c02');
  const gem = settle(f, s.land, 12);
  const q = (k: number) => settle(f, think + k * 5, 16);
  const fill = ramp(f, think, 24, (t) => t);
  return (
    <>
      <HeadF right="맞혀 보세요" />
      <Title s={s}><>그럼 <MarkF p={useMark(s)}>젬은?</MarkF></></Title>
      <Img src={img('gem.webp')} style={{ position: 'absolute', left: 330, top: 700 + (1 - gem) * 100, width: 380, filter: feltShadow }} />
      <Tag x={400} y={1110}>제미나이 젬</Tag>
      <span style={{ position: 'absolute', left: 110, top: 800, font: `800 150px/1 ${F.latin}`, color: '#fff', opacity: q(0), translate: `0 ${(1 - q(0)) * 40}px` }}>O?</span>
      <span style={{ position: 'absolute', left: 740, top: 806, font: `800 140px/1 ${F.latin}`, color: '#fff', opacity: q(1), translate: `0 ${(1 - q(1)) * 40}px` }}>✕?</span>
      <div style={{ position: 'absolute', left: L.X, top: 1200, width: L.CW, height: 12, borderRadius: 6, background: 'rgba(255,255,255,.22)', opacity: f >= think - 2 ? 1 : 0 }}>
        <div style={{ width: `${fill * 100}%`, height: '100%', borderRadius: 6, background: C.markField }} />
      </div>
      <Cap s={s} id="c02" chunks={[{ t: '그럼,', w: 0 }, { t: '제미나이', w: 1 }, { t: '젬은요?', w: 2, em: true }]} />
    </>
  );
};

// ── 03-1 젬은 알아서: 실제 띠 + 선택 + 조명 + 11.17 도장 ──────────
const GEM_W = L.CW;
const GEM_K = GEM_W / 856; // 움직임 시안(폭 856)에서 잰 자리를 그대로 줄인다
const Gem1: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const selAt = wf(s, 'v03', 1); // 네.
  const sel1 = ramp(f, selAt, 12);
  const sel2 = ramp(f, selAt + 12, 6);
  const dim = ramp(f, selAt + 4, 10);
  const H = Math.round(185 * (GEM_W / 670));
  return (
    <>
      <HeadF right="젬" />
      <Title s={s}><>젬은 <MarkF p={useMark(s)}>알아서</MarkF></></Title>
      <FloatCard style={{ left: L.X, top: 690, width: GEM_W, height: H }}>
        <Img src={img('gemini_crop.png')} style={{ width: GEM_W, height: H, display: 'block' }} />
        <span style={{ position: 'absolute', left: 508 * GEM_K, top: 75 * GEM_K, width: 259 * GEM_K * sel1, height: 41 * GEM_K, borderRadius: 6, background: C.field, mixBlendMode: 'screen' }} />
        <span style={{ position: 'absolute', left: 28 * GEM_K, top: 130 * GEM_K, width: 68 * GEM_K * sel2, height: 41 * GEM_K, borderRadius: 6, background: C.field, mixBlendMode: 'screen' }} />
        <span style={{ position: 'absolute', left: 21 * GEM_K, top: 69 * GEM_K, width: 758 * GEM_K, height: 109 * GEM_K, borderRadius: 14, boxShadow: `0 0 0 3000px rgba(6,8,12,${0.58 * dim})` }} />
      </FloatCard>
      <Src top={690 + H + 22}>화면: 제미나이 Gems · 2026.10.17</Src>
      <Stamp at={wf(s, 'v03', 2)} num="11.17" word="부터" left={560} top={690 + H + 6} />
      <Cap s={s} id="v03" chunks={[{ t: '젬은, 네.', w: 0, em: true }, { t: '11월 17일부터', w: 2 }]} />
    </>
  );
};

// ── 03-2 젬 → 스킬: 보석이 스킬 카드로 쏙, O ──────────────────
const Gem2: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const card = settle(f, s.land, 12);
  const goAt = wf(s, 'v03', 5); // 옮겨지기
  const go = ramp(f, goAt, 14, EASE_IN_OUT);
  const okAt = vEnd(s, 'v03') - 4;
  return (
    <>
      <HeadF right="젬 · 스킬" />
      <Title s={s}><>젬 <Arrow /> <MarkF p={useMark(s)}>스킬</MarkF></></Title>
      <Img src={img('skillcard.webp')} style={{ position: 'absolute', left: 560, top: 660 + (1 - card) * 90, width: 320, filter: feltShadow }} />
      <Img src={img('gem.webp')} style={{ position: 'absolute', left: lerp(110, 590, go), top: lerp(760, 820, go), width: 260, scale: String(1 - 0.42 * go), filter: feltShadow }} />
      <Badge at={okAt} ok x={770} y={600} />
      <Gloss top={1140} at={s.land + 6} small="Gemini 고객센터 「Gem에서 스킬로의 전환」">
        <span style={{ color: C.markField }}>스킬</span> = 저장해 둔 지시를 「/」로 불러 쓰기
      </Gloss>
      <Cap s={s} id="v03" chunks={[{ t: '알아서', w: 4, em: true }, { t: '옮겨지기 시작해요', w: 5 }]} />
    </>
  );
};

// ── 04 GPTs는 직접: 실제 「내 GPT」 + 12.11 도장 → 카메라가 단추로 → 커서 클릭 ─────
const MG_W = L.CW;
const MG_K = MG_W / 877; // mygpt_board.png 877×810
const MG_WIN = { top: 660, h: 560 };
const BTN = { x: 507 * MG_K, y: 740 * MG_K, w: 322 * MG_K, h: 70 * MG_K }; // 판 안 단추 가운데·크기
const PAN = Math.round(810 * MG_K) - MG_WIN.h; // 판 아래끝이 창 아래끝에 닿을 만큼만 내려간다(검은 빈 띠가 생기지 않게)
const Gpt: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const stampAt = wf(s, 'v04', 2); // 십이월
  const panAt = wf(s, 'v04', 4) - 6; // 전에
  const clickAt = wf(s, 'v04', 5); // 직접
  const pan = ramp(f, panAt, 16, EASE_IN_OUT);
  const zoom = settle(f, clickAt, 10);
  const dim = ramp(f, clickAt, 10);
  const sel = ramp(f, stampAt, 12);
  const by = BTN.y - PAN; // 이동 뒤 창 안 단추 y
  const gx = L.X + BTN.x + BTN.w / 2 - 46; // 커서 끝은 단추 오른쪽 위 — 몸통이 단추 글자를 가리지 않게
  const gy = MG_WIN.top + by + 6;
  return (
    <>
      <HeadF right="GPTs" />
      <Title s={s}><>GPTs는 <MarkF p={useMark(s)}>직접</MarkF></></Title>
      <FloatCard style={{ left: L.X, top: MG_WIN.top, width: MG_W, height: MG_WIN.h }}>
        <div style={{ position: 'absolute', inset: 0, transformOrigin: `0px ${by}px`, scale: String(1 + 0.1 * zoom) }}>
          <div style={{ position: 'absolute', left: 0, top: -PAN * pan, width: MG_W }}>
            <Img src={img('mygpt_board.png')} style={{ width: MG_W, display: 'block' }} />
            <span style={{ position: 'absolute', left: 124, top: 41, width: 168 * sel, height: 34, borderRadius: 6, background: C.field, mixBlendMode: 'screen', opacity: 1 - dim }} />
            <span style={{ position: 'absolute', left: BTN.x - BTN.w / 2, top: BTN.y - BTN.h / 2, width: BTN.w, height: BTN.h, borderRadius: 999, boxShadow: `0 0 0 3000px rgba(6,8,12,${0.58 * dim})` }} />
            <span style={{ position: 'absolute', left: BTN.x - BTN.w / 2 - 7, top: BTN.y - BTN.h / 2 - 7, width: BTN.w + 14, height: BTN.h + 14, borderRadius: 999, border: `5px solid ${C.field}`, boxSizing: 'border-box', opacity: dim }} />
          </div>
        </div>
      </FloatCard>
      <Stamp at={stampAt} num="12.11" word="전에" left={600} top={600} />
      <CursorArc from={[880, 1380]} to={[gx, gy]} start={clickAt - 22} arrive={clickAt - 6} clicks={[clickAt]} leave={clickAt + 8} />
      <Gloss top={MG_WIN.top + MG_WIN.h + 24} at={clickAt + 6}>
        <span style={{ color: C.markField }}>플러그인으로 마이그레이션</span> = 옮기기
      </Gloss>
      <Cap s={s} id="v04" chunks={[{ t: 'GPTs는 아니에요.', w: 0 }, { t: '12월 11일 전에,', w: 2 }]} hideAt={wf(s, 'v04', 5) - 3} />
      <Cap s={s} id="v04" chunks={[{ t: '직접', w: 5, em: true }, { t: '옮겨야 해요', w: 6 }]} showAt={wf(s, 'v04', 5) - 3} />
    </>
  );
};

// ── 05-1 잠김: 펠트 상자가 내려앉고 커서가 두 번 헛클릭 ──────────
const Lock: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const drop = settle(f, wf(s, 'v05', 1) - 4, 12); // 옮기면
  const c1 = s.z.v05 + Math.round(0.74 * FPS) + 2; // 「안 옮기면,」 끝 바로 뒤
  return (
    <>
      <HeadF right="안 옮기면" />
      <Title s={s}><>안 옮기면 <MarkF p={useMark(s)}>잠겨요</MarkF></></Title>
      <Img src={img('felt_locked.webp')} style={{ position: 'absolute', left: 220, top: lerp(380, 690, drop), width: 580, opacity: interpolate(drop, [0, 0.2], [0, 1], clamp), filter: feltShadow }} />
      <CursorArc from={[960, 1400]} to={[560, 1010]} start={c1 - 16} arrive={c1 - 4} clicks={[c1, c1 + 7]} />
      <Cap s={s} id="v05" chunks={[{ t: '안 옮기면,', w: 0 }]} />
    </>
  );
};

// ── 05-2 실제 안내: 「12월 11일부로 종료」 선택 + 0.75초 정지 ───────
const CG_W = 760;
const CG_K = CG_W / 866; // chatgpt_crop2.png 866×172(원본에서 반만 든 「@」 아이콘 34px를 잘라 냄)
const Notice: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const selAt = wf(s, 'v05', 2); // 그날부터
  const sel = ramp(f, selAt, 10);
  const dim = ramp(f, selAt + 2, 10);
  const push = settle(f, selAt, 10);
  const H = Math.round(172 * CG_K);
  const top = 840;
  return (
    <>
      <HeadF right="실제 안내" />
      <Title s={s}><><MarkF p={useMark(s)}>12월 11일</MarkF>부로 종료</></Title>
      <div style={{ position: 'absolute', inset: 0, scale: String(1 + 0.08 * push), transformOrigin: `${L.X + 156 * CG_K}px ${top + 52 * CG_K}px` }}>
        <FloatCard style={{ left: L.X, top, width: CG_W, height: H }}>
          <Img src={img('chatgpt_crop2.png')} style={{ width: CG_W, display: 'block' }} />
          <span style={{ position: 'absolute', left: 86 * CG_K, top: 39 * CG_K, width: 160 * CG_K * sel, height: 30 * CG_K, borderRadius: 5, background: C.field, mixBlendMode: 'screen' }} />
          <span style={{ position: 'absolute', left: 2 * CG_K, top: 32 * CG_K, width: 390 * CG_K, height: 44 * CG_K, borderRadius: 10, boxShadow: `0 0 0 3000px rgba(6,8,12,${0.58 * dim})` }} />
        </FloatCard>
      </div>
      <Src top={top + H + 70}>화면: ChatGPT 「내 GPT」 · 2026.10.17</Src>
      <Cap s={s} id="v05" chunks={[{ t: '그날부터', w: 2 }, { t: '못 열어요', w: 3, em: true }]} />
    </>
  );
};

// ── 06 남이 만든 GPT: 남의 상자가 「만든 사람」 쪽으로 ───────────────
const Other: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const goAt = wf(s, 'v06', 3); // 만든(사람이)
  const go = ramp(f, goAt, 16, EASE_IN_OUT);
  const chip = settle(f, goAt + 8, 18);
  const boxes = settle(f, s.land, 12);
  return (
    <>
      <HeadF right="남이 만든 GPT" />
      <Lines at={s.land - 2} size={72} top={L.TOP - 8} lines={['남이 만든 건', <MarkF key="m" p={useMark(s)}>만든 사람이</MarkF>]} />
      <div style={{ position: 'absolute', inset: 0, translate: `0 ${(1 - boxes) * 90}px` }}>
        <Img src={img('felt_box1.webp')} style={{ position: 'absolute', left: 96, top: 800, width: 330, filter: feltShadow }} />
        <Tag x={150} y={1110}>내 GPT</Tag>
        <div style={{ position: 'absolute', left: 0, top: 0, translate: `${go * 120}px ${go * 40}px` }}>
          <Img src={img('felt_box2.webp')} style={{ position: 'absolute', left: 470, top: 800, width: 330, filter: feltShadow }} />
          <Tag x={520} y={1110}>남의 GPT</Tag>
        </div>
      </div>
      {f >= goAt + 8 ? (
        <span style={{ position: 'absolute', left: 620, top: 720, padding: '14px 24px', borderRadius: 16, background: C.ink, color: '#fff', font: `800 38px/1 ${F.ko}`, letterSpacing: '-.02em', boxShadow: '0 0 0 3px #fff', scale: String(1.2 - 0.2 * chip), opacity: interpolate(f - goAt - 8, [0, 2], [0, 1], clamp) }}>만든 사람이 옮김</span>
      ) : null}
      <Cap s={s} id="v06" chunks={[{ t: '옮겨서', w: 5 }, { t: '다시 알려 줘야', w: 6, em: true }, { t: '해요', w: 9 }]} />
    </>
  );
};

// ── 07 안 따라오는 것: 네 줄, 대화 O · 셋 ✕ ─────────────────────
const Ledger: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const rows = [
    { t: '그동안 나눈 대화', ok: true, at: wf(s, 'v07', 2) },
    { t: '게시 안 한 수정', ok: false, at: wf(s, 'v07', 7) },
    { t: '외부 연결(액션)', ok: false, at: wf(s, 'v07', 9) },
    { t: '공유 설정', ok: false, at: wf(s, 'v07', 11) },
  ];
  const second = wf(s, 'v07', 3); // 하지만
  return (
    <>
      <HeadF right="옮길 때" />
      <Title s={s}><><MarkF p={useMark(s)}>대화만</MarkF> 남아요</></Title>
      <div style={{ position: 'absolute', left: L.X, right: L.R, top: 660, display: 'grid', gap: 14 }}>
        {rows.map((r, i) => {
          const p = settle(f, s.land + i * 3, 14);
          const m = f >= r.at ? settle(f, r.at, 20) : 0;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '22px 30px', borderRadius: 22, background: r.ok && m > 0 ? '#eaf6ee' : '#fff', boxShadow: `0 0 0 3px ${C.ink}${!r.ok && m > 0 ? `, ${8 * m}px ${8 * m}px 0 ${C.ink}` : ''}`, translate: `0 ${(1 - p) * 80}px`, opacity: interpolate(p, [0, 0.3], [0, 1], clamp) }}>
              <b style={{ flex: 1, font: `800 44px/1.1 ${F.ko}`, letterSpacing: '-.03em', color: C.ink }}>{r.t}</b>
              <span style={{ width: 60, textAlign: 'center', font: `800 54px/1 ${F.latin}`, color: r.ok ? C.ok : C.no, opacity: m > 0 ? 1 : 0, scale: String(1.3 - 0.3 * m) }}>{r.ok ? 'O' : '✕'}</span>
            </div>
          );
        })}
      </div>
      <Cap s={s} id="v07" chunks={[{ t: '대화 기록은', w: 0 }, { t: '남아요', w: 2, em: true }]} hideAt={second - 2} />
      <Cap s={s} id="v07" chunks={[{ t: '게시 안 한 수정,', w: 4 }, { t: '외부 연결,', w: 8 }, { t: '공유 설정은', w: 10 }, { t: '안 따라와요', w: 12, em: true }]} showAt={second - 2} />
    </>
  );
};

// ── 08 질문 세 개: 칩 셋이 눌리며 내려앉고 「같은 질문으로 비교」 ─────
const Questions: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const ats = [wf(s, 'v08', 2), wf(s, 'v08', 4), wf(s, 'v08', 7)]; // 자주 · 질문 · 적어
  const cmpAt = wf(s, 'v08', 9); // 옮긴
  const qs = ['회의 메모 정리해 줘', '영어 메일 다듬어 줘', '주간 보고 요약해 줘'];
  return (
    <>
      <HeadF right="지금 할 일" />
      <Title s={s}><>옮기기 전 <MarkF p={useMark(s)}>질문 세 개</MarkF></></Title>
      <div style={{ position: 'absolute', left: L.X, right: 200, top: 660, display: 'grid', gap: 22 }}>
        {ats.map((at, i) => {
          const p = settle(f, at - 3, 18);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '28px 32px', borderRadius: 24, background: '#fff', color: C.ink, font: `800 48px/1 ${F.ko}`, letterSpacing: '-.03em', boxShadow: `0 0 0 3px ${C.ink}, ${8 * p}px ${8 * p}px 0 ${C.ink}`, translate: `${i * 18}px ${(1 - p) * -40}px`, scale: String(1.08 - 0.08 * p), opacity: interpolate(p, [0, 0.2], [0, 1], clamp) }}>
              <i style={{ font: `500 40px/1 ${F.mono}`, fontStyle: 'normal', color: C.acc }}>0{i + 1}</i>{qs[i]}
            </div>
          );
        })}
      </div>
      <Gloss top={1060} at={cmpAt}>
        <Arrow /> 옮긴 뒤 <span style={{ color: C.markField }}>같은 질문으로 비교</span>
      </Gloss>
      <Cap s={s} id="v08" chunks={[{ t: '자주 쓰던', w: 2 }, { t: '질문 세 개', w: 4, em: true }]} hideAt={cmpAt - 2} />
      <Cap s={s} id="v08" chunks={[{ t: '옮긴 뒤', w: 9 }, { t: '비교하세요', w: 11, em: true }]} showAt={cmpAt - 2} />
    </>
  );
};

// ── 09 내 날짜: 맞춤 프로그램 실제 화면(휴대폰), 두 번 눌러 결과 ─────
const PH = { w: 470, h: 660, left: (L.W - 470) / 2 - 40, top: 650 };
const PK = PH.w / 750;
const Tool: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const t1 = wf(s, 'v09', 1); // 날짜와
  const t2 = wf(s, 'v09', 3); // 일은
  const phone = settle(f, s.land, 12);
  const screen = f < t1 + 3 ? { src: 'tool_1_where.jpg', y: 420 } : f < t2 + 3 ? { src: 'tool_2_who.jpg', y: 420 } : { src: 'tool_6_result.jpg', y: 0 };
  const tap1: [number, number] = [PH.left + 360 * PK, PH.top + (1386 - 420) * PK];
  const tap2: [number, number] = [PH.left + 360 * PK, PH.top + (964 - 420) * PK];
  return (
    <>
      <HeadF right="내 결과" />
      <Title s={s}><>내 날짜는 <MarkF p={useMark(s)}>1분이면</MarkF></></Title>
      <FloatCard style={{ left: PH.left, top: PH.top + (1 - phone) * 90, width: PH.w, height: PH.h, borderRadius: 44, boxShadow: `0 0 0 10px ${C.screen}, 0 50px 90px -40px rgba(4,12,36,.75)` }}>
        <Img src={img(screen.src)} style={{ position: 'absolute', left: 0, top: -screen.y * PK, width: PH.w, display: 'block' }} />
      </FloatCard>
      {/* 손가락 대신 같은 커서가 두 번 누른다: 첫 번째는 「둘 다」, 두 번째는 「내가 만들었어요」 */}
      {f < t1 + 6 ? <CursorArc from={[980, 1400]} to={tap1} start={t1 - 16} arrive={t1 - 4} clicks={[t1]} /> : <CursorArc from={tap1} to={tap2} start={t1 + 6} arrive={t2 - 4} clicks={[t2]} leave={t2 + 14} />}
      <Cap s={s} id="v09" chunks={[{ t: '프로필 링크에서', w: 4 }, { t: '1분이면', w: 6, em: true }]} />
    </>
  );
};

// ── 10 끝 ──────────────────────────────────────────────
const End: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const cta = settle(f, s.land + 10, 16);
  const tail = settle(f, s.land + 20, 16);
  return (
    <>
      <HeadF right="개인 계정 기준" />
      <Lines at={s.land - 2} size={88} top={L.TOP - 8} lines={['GPTs·젬,', <><MarkF key="m" p={useMark(s, 10)}>몇 개</MarkF> 만들어</>, '두셨어요?']} />
      <p style={{ position: 'absolute', left: L.X, right: L.R, top: 846, margin: 0, font: `600 38px/1.42 ${F.ko}`, letterSpacing: '-.02em', color: C.onField2, opacity: settle(f, s.land + 4, 16) }}>젬 11.17부터 자동 · GPTs 12.11 전에 직접</p>
      <div style={{ position: 'absolute', left: L.X, top: 940, display: 'inline-flex', alignItems: 'center', gap: 16, padding: '24px 36px', borderRadius: 28, background: '#fff', color: C.ink, font: `800 44px/1.1 ${F.ko}`, letterSpacing: '-.03em', scale: String(1.1 - 0.1 * cta), opacity: interpolate(cta, [0, 0.2], [0, 1], clamp), boxShadow: '0 22px 40px -20px rgba(4,12,36,.6)' }}>
        내 날짜
        <span style={{ font: `700 44px/1.1 ${F.latin}`, padding: '4px 18px 8px', borderRadius: 14, background: C.field, color: '#fff' }}>synk.im/brief/skills</span>
      </div>
      <p style={{ position: 'absolute', left: L.X, top: 1064, margin: 0, font: `600 36px/1.4 ${F.ko}`, color: C.onField2, opacity: tail, translate: `0 ${(1 - tail) * 20}px` }}>댓글로 알려 주세요.</p>
      <div style={{ position: 'absolute', left: L.X, right: L.R, bottom: 676, display: 'flex', alignItems: 'center', justifyContent: 'space-between', font: `600 28px/1 ${F.latin}`, color: C.onField2 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '12px 20px', borderRadius: 16, background: '#fff' }}>
          <Img src={staticFile('kit/logo-shift.webp')} style={{ height: 40, display: 'block' }} />
        </span>
        <span>@synkbrief</span>
      </div>
    </>
  );
};

export const SCENES: Record<SceneKey, React.FC<P>> = { hookA: HookA, hookC: HookC, quizA: QuizA, quizC: QuizC, gem1: Gem1, gem2: Gem2, gpt: Gpt, lock: Lock, notice: Notice, other: Other, ledger: Ledger, questions: Questions, tool: Tool, end: End };

/** 효과음: 장면마다 [시퀀스 안 프레임, 파일, 음량]. 사건 하나에 소리 하나. */
export const hitsFor = (s: Scene): [number, string, number][] => {
  const w = (id: string, n: number) => wf(s, id, n);
  const enter: [number, string, number][] = s.key === 'hookA' || s.key === 'hookC' ? [] : [[2, 'swish', 0.32]];
  switch (s.key) {
    case 'hookA': return [[6, 'tok', 0.45], [w('a01', 7), 'punch', 0.5]];
    case 'hookC': return [[4, 'tok', 0.45], [w('c01', 5), 'buzz', 0.32]];
    case 'quizA': return [...enter, [s.land, 'pop', 0.3], [s.land + 4, 'pop', 0.3], ...[0, 8, 16].map((k): [number, string, number] => [vEnd(s, 'a02') + k, 'tick', 0.45])];
    case 'quizC': return [...enter, [s.land, 'pop', 0.3], ...[0, 8, 16].map((k): [number, string, number] => [vEnd(s, 'c02') + k, 'tick', 0.45])];
    case 'gem1': return [...enter, [w('v03', 2), 'tick', 0.6], [w('v03', 3), 'stamp', 0.5]];
    case 'gem2': return [...enter, [w('v03', 5), 'swish', 0.5], [vEnd(s, 'v03') - 4, 'ding', 0.4]];
    case 'gpt': return [...enter, [w('v04', 2), 'stamp', 0.5], [w('v04', 5), 'click', 0.6]];
    case 'lock': {
      const c1 = s.z.v05 + Math.round(0.74 * FPS) + 2;
      return [...enter, [w('v05', 1) + 6, 'lock', 0.55], [c1, 'click', 0.45], [c1 + 7, 'buzz2', 0.32]];
    }
    case 'notice': return [...enter, [w('v05', 2), 'tick', 0.55], [vEnd(s, 'v05'), 'freeze', 0.35]];
    case 'other': return [...enter, [w('v06', 3), 'swish', 0.45], [w('v06', 3) + 8, 'tok', 0.4]];
    case 'ledger': return [...enter, [w('v07', 2), 'ding', 0.35], [w('v07', 7), 'stamp', 0.45], [w('v07', 9), 'stamp', 0.45], [w('v07', 11), 'stamp', 0.45]];
    case 'questions': return [...enter, [w('v08', 2) - 3, 'tok', 0.4], [w('v08', 4) - 3, 'tok', 0.4], [w('v08', 7) - 3, 'tok', 0.4], [w('v08', 9), 'swish', 0.35]];
    case 'tool': return [...enter, [w('v09', 1), 'click', 0.45], [w('v09', 3), 'click', 0.45]];
    case 'end': return [...enter, [s.land + 10, 'tok', 0.4], [vEnd(s, 'v10') + 4, 'sting', 0.4]];
  }
  return enter;
};
