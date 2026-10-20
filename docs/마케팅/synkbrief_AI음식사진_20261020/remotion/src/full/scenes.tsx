// 「메뉴판 AI 음식 사진」 아홉 장면(v4). 장면마다 착지 박(time.ts B)에 내려앉고, 글은 마스크로 올라오며, 강조는 크레용 밑줄·형광펜.
// 사진은 전부 3:2(1536×1024) — 원본(스톡 실제 사진), 결과 1(요청문 다섯 줄), 결과 2(색을 콕 집은 여섯째 줄), AI 생성 예시.
// 결과 판은 원본과 위치·크기가 같다(ORB 대조 배율 1.000, 이동 0.2px 이하) — 닦아 넘기기·반반 카드를 그대로 겹친다.
// 10-20 Fable 콘티 검수 반영: 서로 다른 사진을 「메뉴판 → 나온 음식」으로 맞바꾸지 않는다(03), 결과에는 확인한 것만(양·재료),
// 색은 ✓ 대신 「똑같진 않아도 훨씬 가깝게」(08), AI 생성 판 도장은 늘 「AI 생성 예시 · 실제 음식 아님」.
// v4(10-20 조율 세션 마감 점검 — v3는 42초 중 54%가 거의 멈춤, 가장 긴 정지 6초): 모든 장면의 사진에 쉬지 않는 카메라(당기기·이동),
// 장면이 밀려 들어올 때 내용이 이미 보이게(빈 파란 화면 없음), 형광펜·밑줄은 목소리 낱말에, 확인 셋은 낱말마다 사진의 그 자리로 당겨 들어간다,
// 요청문은 지금 말하는 구절만 크게. 줄거리·글·목소리는 v3 그대로.
import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, ramp } from '../lib/anim';
import { beat } from '../lib/beat';
import { C, F, L } from '../theme';
import { CaptionF, CrayonRing, HeadF, Lines, MarkF, settle } from '../v5/cine';
import COLORS from '../../public/img/colors.json';
import { Cam, camAt, Chip, CREDIT, ease, fadeUp, IMG, kb, Mark, Photo, Quote, Stamp } from './parts';
import { at, CUT, seq, T, TOTAL } from './time';
import { wordFrame } from './vo-time';

const CW = L.W - L.X - L.R; // 836: 오른쪽 플랫폼 단추 자리를 비운 본문 폭
const HEAD = 'synkbrief 활용';
const AI_STAMP = 'AI 생성 예시 · 실제 음식 아님';
const IN = 2; // 들어오는 장면의 글·판이 시작하는 프레임 — 밀기(5~12프레임) 동안 이미 보인다

type K = Parameters<typeof seq>[0];
/** 장면 k 안에서 나레이션 줄 id의 낱말이 시작하는 프레임(없으면 fallback 박) */
const wordIn = (k: K, id: string, word: string, fallbackBeat: number, variant: 'A' | 'B' = 'A') => {
  const abs = wordFrame(variant, id, word);
  return abs === null ? at(k, fallbackBeat) : abs - seq(k).from;
};

const hiStyle = (p: number): React.CSSProperties => ({ backgroundImage: `linear-gradient(${C.mark},${C.mark})`, backgroundRepeat: 'no-repeat', backgroundSize: `${p * 100}% 44%`, backgroundPosition: '0 88%' });
const io = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ── 01 훅 ─────────────────────────────────────────────────────────────
// A(인스타 · 결과 먼저): 0프레임부터 원본│결과 2 반반 카드와 제목. 손잡이가 한 번 왕복한다 — 오른쪽 끝(원본: 찜기 뚜껑·쇠그릇)까지
//   갔다가 왼쪽 끝(결과 2: 걷힌 빈 상)까지, 다시 가운데로. 사진은 그동안 천천히 당겨진다.
// B(유튜브 · 질문): AI 생성 라볶이 + 도장, 쉬지 않고 당겨진다.
export const Hook01: React.FC<{ variant: 'A' | 'B' }> = ({ variant }) => {
  const f = useCurrentFrame();
  const len = seq('hook').len;
  if (variant === 'A') {
    const split = interpolate(f, [beat(0.5), beat(2.5), beat(5), beat(7)], [0.5, 0.88, 0.12, 0.5], { ...clamp, easing: io });
    return (
      <>
        <HeadF left={HEAD} right="실제 사진 + AI 보정" />
        <Lines visibleAtZero at={0} size={92} top={L.TOP} lines={['진짜 라볶이 사진,', '양·재료는 그대로,', <MarkF key="m" p={ramp(f, at('hook', 3), 12)}>빛·배경만 AI로</MarkF>]} />
        <Photo src={IMG.after2} under={IMG.before} split={split} x={L.X} y={900} w={CW} cam={kb(f, len, 1.0, 1.12, 0.5, 0.5, 0.52, 0.46)}>
          <Stamp style={{ left: 20, top: 20 }}>원본</Stamp>
          <Stamp tone="light" style={{ right: 20, top: 20 }}>
            AI로 다듬음
          </Stamp>
        </Photo>
        <div style={{ position: 'absolute', left: L.X, top: 900 + Math.round((CW * 2) / 3) + 18, font: `500 22px/1.2 ${F.ko}`, color: C.onField2 }}>{CREDIT}</div>
      </>
    );
  }
  return (
    <>
      <HeadF left={HEAD} right="AI 생성 예시" />
      <Lines visibleAtZero at={0} size={88} top={L.TOP} lines={['메뉴판에', 'AI로 만든 음식 사진,', <MarkF key="m" p={ramp(f, at('hook', 3), 12)}>써도 될까요?</MarkF>]} />
      <Photo src={IMG.ai} x={L.X} y={900} w={CW} cam={kb(f, len, 1.0, 1.18, 0.5, 0.5, 0.55, 0.42)}>
        <Stamp tone="ai" style={{ right: 20, top: 20 }}>
          {AI_STAMP}
        </Stamp>
      </Photo>
    </>
  );
};

// ── 02 사실: 표시 의무 없음 ───────────────────────────────────────────
// 인용 카드 아래 AI 생성 예시 띠가 천천히 옆으로 흐른다. 「표시 의무」 형광펜은 목소리 「표시」에.
export const Fact02: React.FC = () => {
  const f = useCurrentFrame();
  const len = seq('fact').len;
  const hi = wordIn('fact', 'v02', '표시', 11);
  const no = wordIn('fact', 'v02', '없어요.', 11.5);
  return (
    <>
      <HeadF left={HEAD} right="뉴시스 · 2026.10.13" />
      <Lines at={IN} size={76} top={L.TOP} lines={['AI로 만든 음식 사진,', <>표시 의무는 <MarkF key="m" p={ramp(f, no, 12)}>없어요</MarkF></>]} />
      <Quote
        x={L.X}
        y={750}
        w={CW}
        size={38}
        p={settle(f, IN + 2, 14)}
        markP={ramp(f, hi, 14)}
        parts={[{ t: '현행법상 일반 음식점 점주가 AI로 만든 음식사진을 실제 메뉴사진처럼 사용하더라도 ' }, { t: '별도의 표시 의무는 없다', em: true }]}
        who="과기정통부 관계자 · 뉴시스 2026.10.13"
      />
      <div style={{ position: 'absolute', left: L.X, top: 1040, ...fadeUp(f, IN + 4, 30) }}>
        <Photo src={IMG.ai} x={0} y={0} w={CW} h={200} radius={22} cam={kb(f, len, 1.25, 1.4, 0.3, 0.5, 0.7, 0.46)}>
          <Stamp tone="ai" size={18} style={{ right: 12, top: 12, padding: '6px 10px' }}>
            {AI_STAMP}
          </Stamp>
        </Photo>
      </div>
      <CaptionF text="AI 사진을 메뉴판에 걸어도, 지금은 표시 의무가 없어요." em="지금은 표시 의무가 없어요." at={T + 3} />
    </>
  );
};

// ── 03 손님: AI 생성 예시 위로 손님 말이 올라온다 ───────────────────────
// 다른 사진과 맞바꿔 「한 가게의 전후」처럼 연출하지 않는다(Fable P1). 판은 쉬지 않고 당겨지고, 말이 올라오면 살짝 흐려진다.
export const guestT = () => ({ quote: wordIn('guest', 'v03', '실제랑', 18) - 4, mark: wordIn('guest', 'v03', '속은', 19) });
export const Guest03: React.FC = () => {
  const f = useCurrentFrame();
  const len = seq('guest').len;
  const g = guestT();
  const q = settle(f, g.quote, 14);
  const dim = interpolate(f, [g.quote, g.quote + 12], [0, 1], clamp);
  return (
    <>
      <HeadF left={HEAD} right="뉴시스 · 2026.10.13" />
      <Lines at={IN} size={80} top={L.TOP} lines={[<>그런데 <MarkF key="m" p={ramp(f, wordIn('guest', 'v03', '손님은', 16.5), 12)}>손님은</MarkF></>]} />
      <Photo src={IMG.ai} x={L.X} y={660} w={CW} cam={kb(f, len, 1.04, 1.22, 0.5, 0.5, 0.6, 0.4)} style={{ filter: `blur(${dim * 5}px) brightness(${1 - dim * 0.25})` }} />
      {/* 도장은 흐림 층 밖에 — 판이 흐려져도 「AI 생성 예시」가 읽혀야 한다(Fable 10-20 최종 P1: A판은 AI 생성 판이 여기서만 나온다) */}
      <div style={{ position: 'absolute', left: L.X, top: 660, width: CW, height: 40 }}>
        <Stamp tone="ai" style={{ right: 20, top: 20 }}>
          {AI_STAMP}
        </Stamp>
      </div>
      <Quote x={L.X} y={1010} w={CW} size={50} p={q} markP={ramp(f, g.mark, 14)} parts={[{ t: '실제랑 다르면 ' }, { t: '속은 기분이 든다', em: true }]} who="손님(22) · 뉴시스 2026.10.13" />
    </>
  );
};

// ── 04 전환: 만들지 말고, 다듬기 ───────────────────────────────────────
export const Turn04: React.FC = () => {
  const f = useCurrentFrame();
  const len = seq('turn').len;
  return (
    <>
      <HeadF left={HEAD} right="실제 사진" />
      <Lines at={IN} size={104} top={L.TOP} lines={['만들지 말고,', <MarkF key="m" p={ramp(f, wordIn('turn', 'v04', '다듬어요.', 26), 12)}>다듬기</MarkF>]} />
      <Photo src={IMG.before} x={L.X} y={830} w={CW} cam={kb(f, len, 1.0, 1.16, 0.5, 0.5, 0.56, 0.44)} style={fadeUp(f, IN, 40)}>
        <Stamp style={{ left: 20, top: 20 }}>실제 사진</Stamp>
        <Stamp size={18} style={{ left: 20, bottom: 18, padding: '6px 10px', fontWeight: 500 }}>
          {CREDIT}
        </Stamp>
      </Photo>
    </>
  );
};

// ── 05 요청문 ─────────────────────────────────────────────────────────
// 화면 글 = 판1에 실제로 넣은 요청문 그대로(그림/판1_다듬기_지시문.txt의 한국어 부분). 첫 줄만 크게 놓고,
// 목소리가 말하는 구절(「음식은 그대로 두고」 → 「빛·색·배경만」)에 형광펜이 지나간다. 나머지 네 줄은 작게 — 전문은 캡션·고정 댓글에.
export const PROMPT_LINES = [
  '이 사진 속 음식은 그대로 두고, 빛·색·배경만 다듬어 주세요.',
  '· 음식의 양·재료·모양과 그릇은 바꾸지 마세요. 더하거나 빼지 마세요.',
  '· 창가 자연광처럼 부드럽고 밝게, 색은 실제에 가깝게.',
  '· 가장자리 잡동사니만 정리하고 구도는 그대로.',
  '· 없던 수증기·윤기·글자는 넣지 마세요.',
];
export const FIX_LINE = '· 국물은 원본처럼 노란빛 도는 주황색 그대로, 더 빨갛게 하지 마세요.';
export const promptT = () => ({ food: wordIn('prompt', 'v05', '음식은', 32), light: wordIn('prompt', 'v05', '빛,', 33) });
export const LINE_IN = (i: number) => IN + 4 + i * 3; // 작은 네 줄이 3프레임씩 엇갈려 올라온다(Film 효과음도 이 시각)

export const Prompt05: React.FC<{ variant: 'A' | 'B' }> = ({ variant }) => {
  const f = useCurrentFrame();
  const len = seq('prompt').len;
  const p = promptT();
  const first = PROMPT_LINES[0];
  const e1 = '음식은 그대로 두고';
  const e2 = '빛·색·배경만';
  const i1 = first.indexOf(e1);
  const i2 = first.indexOf(e2);
  return (
    <>
      <HeadF left={HEAD} right="요청문 그대로" />
      <Lines at={IN} size={72} top={L.TOP - 6} lines={[<>사진을 올리고 이렇게 <MarkF key="m" p={ramp(f, wordIn('prompt', 'v05', '쓰세요.', 31), 12)}>쓰세요</MarkF></>]} />
      <Photo src={IMG.before} x={L.X} y={640} w={CW} h={270} radius={24} cam={kb(f, len, 1.05, 1.3, 0.45, 0.5, 0.58, 0.44)} style={fadeUp(f, IN, 30)}>
        <Stamp size={20} style={{ left: 14, top: 14, padding: '6px 12px' }}>
          첨부한 실제 사진
        </Stamp>
      </Photo>
      <div style={{ position: 'absolute', left: L.X, top: 935, width: CW, padding: '24px 30px 26px', borderRadius: 28, background: '#fff', color: C.ink, boxShadow: '0 30px 60px -30px rgba(4,12,36,.7)', ...fadeUp(f, IN + 2, 30) }}>
        <div style={{ font: `800 46px/1.36 ${F.ko}`, letterSpacing: '-.04em' }}>
          {first.slice(0, i1)}
          <span style={hiStyle(ramp(f, p.food, 12))}>{e1}</span>
          {first.slice(i1 + e1.length, i2)}
          <span style={hiStyle(ramp(f, p.light, 12))}>{e2}</span>
          {first.slice(i2 + e2.length)}
        </div>
        <div style={{ marginTop: 14, font: `600 26px/1.45 ${F.ko}`, letterSpacing: '-.025em', color: C.muted }}>
          {PROMPT_LINES.slice(1).map((ln, i) => (
            <div key={i} style={fadeUp(f, LINE_IN(i), 14)}>
              {ln}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, font: `700 22px/1.2 ${F.ko}`, color: C.acc }}>{variant === 'A' ? '전문은 캡션에' : '전문은 고정 댓글에'}</div>
      </div>
    </>
  );
};

// ── 06 결과 1 ─────────────────────────────────────────────────────────
// 같은 판에서 원본 → 결과 1로 닦아 넘기고, 걷힌 자리(왼쪽 위 찜기 뚜껑, 오른쪽 쇠그릇)에 동그라미 — 목소리 「가장자리만」에.
// 동그라미도 사진과 같은 카메라에 붙어 함께 당겨진다.
export const afterT = () => ({ wipe0: IN + 6, wipe1: IN + 26, ring: wordIn('after', 'v06', '가장자리만', 43.5) });
export const After06: React.FC = () => {
  const f = useCurrentFrame();
  const len = seq('after').len;
  const a = afterT();
  const wipe = ease(f, a.wipe0, a.wipe1 - a.wipe0);
  const h = Math.round((CW * 2) / 3);
  return (
    <>
      <HeadF left={HEAD} right="결과 1" />
      <Lines at={IN} size={70} top={L.TOP} lines={['결과 1,', <>가장자리만 <MarkF key="m" p={ramp(f, a.ring + 6, 12)}>깨끗</MarkF></>]} />
      <Photo
        src={IMG.after1}
        under={IMG.before}
        wipe={wipe}
        x={L.X}
        y={705}
        w={CW}
        cam={kb(f, len, 1.0, 1.1, 0.5, 0.5, 0.5, 0.46)}
        inner={
          <>
            <CrayonRing id="lid" x={6} y={8} w={150} h={Math.round(h * 0.42)} at={a.ring} padX={18} padY={18} />
            <CrayonRing id="bowl" x={CW - 92} y={24} w={80} h={Math.round(h * 0.5)} at={a.ring + 6} padX={14} padY={18} />
          </>
        }
      >
        <Stamp style={{ left: 20, top: 20, opacity: 1 - wipe }}>원본</Stamp>
        <Stamp tone="light" style={{ right: 20, top: 20, opacity: wipe }}>
          AI로 다듬음
        </Stamp>
      </Photo>
      <CaptionF text="얼핏 보면 배치 그대로, 가장자리만 깨끗해졌죠." em="가장자리만 깨끗해졌죠." at={T + 3} />
    </>
  );
};

// ── 07 확인 셋 ────────────────────────────────────────────────────────
// 원본│결과 1 반반 판이 크게 있고, 목소리가 「양」·「재료」·「색」을 말할 때마다 그 자리로 당겨 들어가며 아래 알약이 하나씩 뜬다.
// 반반 경계가 판 가운데에 고정돼 있어, 당긴 자리에서 왼쪽 원본과 오른쪽 결과 1이 맞닿는다(국물 색 차이가 경계에서 보인다). ✗는 「빨개졌네요」에.
/** 확인 셋 시각(장면 안 프레임) */
export const checkT = (variant: 'A' | 'B') => {
  const qty = wordIn('check', 'v07', '양', 51, variant);
  const ing = wordIn('check', 'v07', '재료', 53, variant);
  const col = wordIn('check', 'v07', '색은,', 55, variant);
  const why = wordIn('check', 'v07', '실제에', 56, variant);
  const red = wordIn('check', 'v07', '빨개졌네요.', 59, variant);
  return { qty, ing, col, why, red, qtyMark: qty + 10, ingMark: ing + 10, redMark: red + 4 };
};
const CAMS: Record<'qty' | 'ing' | 'col', Cam> = {
  qty: { z: 2.1, fx: 0.7, fy: 0.42 }, // 오른쪽 떡 무리
  ing: { z: 2.0, fx: 0.47, fy: 0.38 }, // 가운데 라면·계란
  col: { z: 1.9, fx: 0.4, fy: 0.68 }, // 왼쪽 아래 국물 — 경계가 국물 위를 지난다
};

const Pill: React.FC<{ x: number; at: number; label: string; ok: boolean; markAt: number }> = ({ x, at: a, label, ok, markAt }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: L.X + x, top: 1108, width: 262, height: 92, borderRadius: 24, background: '#fff', boxShadow: '0 20px 40px -24px rgba(4,12,36,.7)', display: 'flex', alignItems: 'center', paddingLeft: 26, ...fadeUp(f, a - 2, 36) }}>
      <span style={{ font: `800 46px/1 ${F.ko}`, color: C.ink, letterSpacing: '-.04em' }}>{label}</span>
      <Mark ok={ok} at={markAt} size={60} style={{ right: 18, top: 16 }} />
    </div>
  );
};

export const Check07: React.FC<{ variant: 'A' | 'B' }> = ({ variant }) => {
  const f = useCurrentFrame();
  const c = checkT(variant);
  const len = seq('check').len;
  const cam = camAt(f, [
    [0, { z: 1.0, fx: 0.5, fy: 0.5 }],
    [c.qty - 10, { z: 1.18, fx: 0.55, fy: 0.46 }],
    [c.qty + 6, CAMS.qty],
    [c.ing - 6, { ...CAMS.qty, z: CAMS.qty.z + 0.08 }],
    [c.ing + 6, CAMS.ing],
    [c.col - 6, { ...CAMS.ing, z: CAMS.ing.z + 0.08 }],
    [c.col + 8, CAMS.col],
    [len, { ...CAMS.col, z: CAMS.col.z + 0.25 }],
  ]);
  const gap = 25;
  return (
    <>
      <HeadF left={HEAD} right="올리기 전 확인" />
      <Lines at={IN} size={72} top={L.TOP - 6} lines={[<>확인 <MarkF key="m" p={ramp(f, wordIn('check', 'v07', '세', 49), 12)}>셋</MarkF></>]} />
      <Photo src={IMG.after1} under={IMG.before} split={0.5} x={L.X} y={620} w={CW} h={470} radius={26} cam={cam} style={fadeUp(f, IN, 30)}>
        <Stamp size={20} style={{ left: 14, top: 14, padding: '6px 12px' }}>
          원본
        </Stamp>
        <Stamp tone="light" size={20} style={{ right: 14, top: 14, padding: '6px 12px' }}>
          결과 1
        </Stamp>
      </Photo>
      <Pill x={0} at={c.qty} label="양" ok markAt={c.qtyMark} />
      <Pill x={262 + gap} at={c.ing} label="재료" ok markAt={c.ingMark} />
      <Pill x={(262 + gap) * 2} at={c.col} label="색" ok={false} markAt={c.redMark} />
      <div style={{ position: 'absolute', left: L.X, top: 1222, display: 'flex', alignItems: 'center', gap: 14, ...fadeUp(f, c.col + 4, 20) }}>
        <span style={{ width: 54, height: 54, borderRadius: 14, background: COLORS.before.hex, boxShadow: 'inset 0 0 0 3px rgba(255,255,255,.6)' }} />
        <span style={{ font: `700 26px/1 ${F.ko}`, color: C.onField }}>원본</span>
        <span style={{ width: 54, height: 54, borderRadius: 14, background: COLORS.after1.hex, boxShadow: 'inset 0 0 0 3px rgba(255,255,255,.6)', marginLeft: 12 }} />
        <span style={{ font: `700 26px/1 ${F.ko}`, color: C.onField }}>결과 1</span>
        <span style={{ marginLeft: 14, font: `800 28px/1 ${F.ko}`, color: '#ffd0c9', opacity: f >= c.redMark ? 1 : 0 }}>더 빨개짐</span>
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1318, width: CW, font: `700 38px/1.3 ${F.ko}`, color: C.markField, letterSpacing: '-.03em', ...fadeUp(f, c.why, 20) }}>
        “색은 실제에 가깝게”라고만 썼더니
      </div>
    </>
  );
};

// ── 08 한 줄 더 ───────────────────────────────────────────────────────
// 여섯째 줄에 형광펜 → 「콕」에 결과 1 → 결과 2로 닦기, 사진은 국물 쪽으로 쉬지 않고 당겨진다, 「똑같진」에 결론 한 줄.
export const fixT = () => {
  const kok = wordIn('fix', 'v08', '콕', 65.5);
  return { line: IN + 6, wipe0: kok - 2, wipe1: kok + 16, chips: kok + 18, same: wordIn('fix', 'v08', '똑같진', 67) };
};
export const Fix08: React.FC = () => {
  const f = useCurrentFrame();
  const len = seq('fix').len;
  const t = fixT();
  const wipe = ease(f, t.wipe0, t.wipe1 - t.wipe0);
  const pw = 560;
  const ph = Math.round((pw * 2) / 3);
  return (
    <>
      <HeadF left={HEAD} right="결과 2" />
      <Lines at={IN} size={72} top={L.TOP - 6} lines={[<>한 줄 <MarkF key="m" p={ramp(f, wordIn('fix', 'v08', '더.', 64.5), 12)}>더</MarkF></>]} />
      <div style={{ position: 'absolute', left: L.X, top: 650, width: CW, padding: '24px 28px', borderRadius: 26, background: '#fff', color: C.ink, boxShadow: '0 24px 50px -28px rgba(4,12,36,.7)', font: `800 36px/1.42 ${F.ko}`, letterSpacing: '-.035em', ...fadeUp(f, IN, 30) }}>
        <span style={hiStyle(ramp(f, t.line, 16))}>{FIX_LINE}</span>
      </div>
      <Photo src={IMG.after2} under={IMG.after1} wipe={wipe} x={L.X} y={860} w={pw} cam={kb(f, len, 1.0, 1.32, 0.5, 0.5, 0.42, 0.62)} style={fadeUp(f, IN + 2, 30)}>
        <Stamp size={20} style={{ left: 14, top: 14, padding: '6px 10px', opacity: 1 - wipe }}>
          결과 1
        </Stamp>
        <Stamp tone="light" size={20} style={{ left: 14, top: 14, padding: '6px 10px', opacity: wipe }}>
          AI로 다듬음 · 결과 2
        </Stamp>
      </Photo>
      <div style={{ position: 'absolute', left: L.X + pw + 24, top: 860, width: CW - pw - 24, height: ph, borderRadius: 26, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, ...fadeUp(f, t.chips, 30) }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <Chip color={COLORS.before.hex} label="원본" size={64} />
          <Chip color={COLORS.after1.hex} label="결과 1" size={64} />
        </div>
        <Chip color={COLORS.after2.hex} label="결과 2" size={64} />
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 860 + ph + 26, width: CW, font: `700 40px/1.3 ${F.ko}`, color: C.markField, letterSpacing: '-.03em', ...fadeUp(f, t.same, 20) }}>
        똑같진 않아도, 원본에 훨씬 가깝게
      </div>
    </>
  );
};

// ── 09 끝 ─────────────────────────────────────────────────────────────
// 80박 뒤 곡 끝맺음 첫 타격에 댓글 단추가 한 번 눌리고, 사진 둘은 끝까지 당겨진다. 마지막 0.6초만 멈춘 화면(다시 재생될 때 훅으로).
// 올리기판(2패스 1.7Mbps)에서는 작은 당기기가 압축에 묻혀 정지로 재져서(v4 첫 판 끝 2.0~2.5초) 당기는 폭을 키웠다.
export const End09: React.FC<{ variant: 'A' | 'B' }> = ({ variant }) => {
  const f = useCurrentFrame();
  const local = (abs: number) => abs - seq('end').from;
  const still = local(TOTAL - 18);
  const ff = Math.min(f, still);
  const press = interpolate(ff, [local(CUT) - 1, local(CUT) + 1, local(CUT) + 7], [1, 0.95, 1], clamp);
  const pw = Math.round((CW - 28) / 2);
  const ph = Math.round((pw * 2) / 3);
  return (
    <>
      <HeadF left={HEAD} right="@synkbrief" />
      <Lines at={IN} size={84} top={L.TOP} lines={['요청문 전문은', <MarkF key="m" p={ramp(ff, wordIn('end', 'v09', '적어', 75), 12)}>{variant === 'A' ? '캡션에' : '고정 댓글에'}</MarkF>]} />
      <div style={{ position: 'absolute', left: L.X, top: 772, ...fadeUp(ff, IN + 2, 30) }}>
        <Photo src={IMG.before} x={0} y={0} w={pw} h={ph} radius={22} cam={kb(ff, still, 1.0, 1.36, 0.5, 0.5, 0.42, 0.62)}>
          <Stamp size={18} style={{ left: 10, top: 10, padding: '6px 10px' }}>
            원본
          </Stamp>
        </Photo>
        <Photo src={IMG.after2} x={pw + 28} y={0} w={pw} h={ph} radius={22} cam={kb(ff, still, 1.0, 1.36, 0.5, 0.5, 0.42, 0.62)}>
          <Stamp tone="light" size={18} style={{ left: 10, top: 10, padding: '6px 10px' }}>
            AI로 다듬음
          </Stamp>
        </Photo>
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1088, ...fadeUp(ff, wordIn('end', 'v09', 'AI', 76.5) - 4) }}>
        <div style={{ display: 'inline-block', padding: '22px 34px', borderRadius: 999, background: '#fff', color: C.ink, font: `800 44px/1.1 ${F.ko}`, letterSpacing: '-.035em', boxShadow: '0 22px 44px -22px rgba(4,12,36,.6)', scale: String(press), transformOrigin: '50% 50%' }}>
          AI 메뉴 사진, 표시해야 할까요?
        </div>
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1204, font: `600 32px/1.3 ${F.ko}`, color: C.onField, ...fadeUp(ff, wordIn('end', 'v09', '할까요?', 78)) }}>
        댓글로 <b style={{ color: C.markField }}>O · X</b>
      </div>
      <div style={{ position: 'absolute', left: L.X, right: L.R, top: 1300, display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...fadeUp(ff, IN + 6) }}>
        <span style={{ display: 'inline-flex', padding: '12px 18px', borderRadius: 16, background: '#fff' }}>
          <Img src={staticFile('kit/logo-shift.webp')} style={{ height: 40, display: 'block' }} />
        </span>
        <span style={{ font: `500 22px/1.2 ${F.ko}`, color: C.onField2 }}>{CREDIT}</span>
      </div>
    </>
  );
};
