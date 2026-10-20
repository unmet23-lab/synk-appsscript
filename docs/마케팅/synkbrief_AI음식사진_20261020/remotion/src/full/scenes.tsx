// 「메뉴판 AI 음식 사진」 아홉 장면. 장면마다 착지 박(time.ts B)에 내려앉고, 글은 마스크로 올라오며, 강조는 크레용 밑줄.
// 사진은 전부 3:2(1536×1024) — 원본(스톡 실제 사진), 결과 1(요청문 다섯 줄), 결과 2(색을 콕 집은 여섯째 줄), AI 생성 예시.
// 결과 판은 원본과 위치·크기가 같다(ORB 대조 배율 1.000, 이동 0.2px 이하) — 닦아 넘기기·반반 카드를 그대로 겹친다.
// 10-20 Fable 콘티 검수 반영: 서로 다른 사진을 「메뉴판 → 나온 음식」으로 맞바꾸지 않는다(03), 결과에는 확인한 것만(양·재료),
// 색은 ✓ 대신 「똑같진 않아도 훨씬 가깝게」(08), AI 생성 판 도장은 늘 「AI 생성 예시 · 실제 음식 아님」.
import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, ramp } from '../lib/anim';
import { beat } from '../lib/beat';
import { C, F, L } from '../theme';
import { CaptionF, CrayonRing, HeadF, Lines, MarkF, settle } from '../v5/cine';
import COLORS from '../../public/img/colors.json';
import { Chip, CREDIT, ease, fadeUp, IMG, Mark, Photo, Quote, Stamp } from './parts';
import { at, CUT, seq, T, TOTAL } from './time';
import { wordFrame } from './vo-time';

const CW = L.W - L.X - L.R; // 836: 오른쪽 플랫폼 단추 자리를 비운 본문 폭
const HEAD = 'synkbrief 활용';
const AI_STAMP = 'AI 생성 예시 · 실제 음식 아님';

/** 장면 k 안에서 나레이션 줄 id의 낱말이 시작하는 프레임(없으면 fallback 박) */
const wordIn = (k: Parameters<typeof seq>[0], id: string, word: string, fallbackBeat: number, variant: 'A' | 'B' = 'A') => {
  const abs = wordFrame(variant, id, word);
  return abs === null ? at(k, fallbackBeat) : abs - seq(k).from;
};

const hiStyle = (p: number): React.CSSProperties => ({ backgroundImage: `linear-gradient(${C.mark},${C.mark})`, backgroundRepeat: 'no-repeat', backgroundSize: `${p * 100}% 44%`, backgroundPosition: '0 88%' });

// ── 01 훅 ─────────────────────────────────────────────────────────────
// A(인스타 · 결과 먼저): 0프레임부터 원본│결과 2 반반 카드와 제목. 왼쪽 원본엔 찜기 뚜껑, 오른쪽 결과엔 쇠그릇이 걷힌 빈 상.
//   가운데 선이 왼쪽으로 한 번 쓸려 결과를 더 보여 주고 돌아온다.
// B(유튜브 · 질문): AI 생성 라볶이 + 도장, 아주 천천히 다가온다.
export const Hook01: React.FC<{ variant: 'A' | 'B' }> = ({ variant }) => {
  const f = useCurrentFrame();
  const len = seq('hook').len;
  if (variant === 'A') {
    const split = interpolate(f, [beat(1), beat(3), beat(4.5), beat(6.5)], [0.5, 0.14, 0.14, 0.5], { ...clamp, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) });
    const drift = interpolate(f, [0, len], [1, 1.03], clamp);
    return (
      <>
        <HeadF left={HEAD} right="실제 사진 + AI 보정" />
        <Lines visibleAtZero at={0} size={92} top={L.TOP} lines={['진짜 라볶이 사진,', '양·재료는 그대로,', <MarkF key="m" p={ramp(f, at('hook', 3), 12)}>빛·배경만 AI로</MarkF>]} />
        <div style={{ position: 'absolute', inset: 0, scale: String(drift), transformOrigin: `540px 1180px` }}>
          <Photo src={IMG.after2} under={IMG.before} split={split} x={L.X} y={900} w={CW}>
            <Stamp style={{ left: 20, top: 20 }}>원본</Stamp>
            <Stamp tone="light" style={{ right: 20, top: 20 }}>
              AI로 다듬음
            </Stamp>
          </Photo>
        </div>
        <div style={{ position: 'absolute', left: L.X, top: 900 + Math.round((CW * 2) / 3) + 18, font: `500 22px/1.2 ${F.ko}`, color: C.onField2 }}>{CREDIT}</div>
      </>
    );
  }
  const drift = interpolate(f, [0, len], [1, 1.05], clamp);
  return (
    <>
      <HeadF left={HEAD} right="AI 생성 예시" />
      <Lines visibleAtZero at={0} size={88} top={L.TOP} lines={['메뉴판에', 'AI로 만든 음식 사진,', <MarkF key="m" p={ramp(f, at('hook', 3), 12)}>써도 될까요?</MarkF>]} />
      <div style={{ position: 'absolute', inset: 0, scale: String(drift), transformOrigin: `540px 1180px` }}>
        <Photo src={IMG.ai} x={L.X} y={900} w={CW}>
          <Stamp tone="ai" style={{ right: 20, top: 20 }}>
            {AI_STAMP}
          </Stamp>
        </Photo>
      </div>
    </>
  );
};

// ── 02 사실: 표시 의무 없음 ───────────────────────────────────────────
export const Fact02: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <>
      <HeadF left={HEAD} right="뉴시스 · 2026.10.13" />
      <Lines at={T} size={76} top={L.TOP} lines={['AI로 만든 음식 사진,', <>표시 의무는 <MarkF key="m" p={ramp(f, at('fact', 10), 12)}>없어요</MarkF></>]} />
      <Quote
        x={L.X}
        y={750}
        w={CW}
        size={38}
        p={settle(f, T + 6, 14)}
        markP={ramp(f, at('fact', 11), 14)}
        parts={[{ t: '현행법상 일반 음식점 점주가 AI로 만든 음식사진을 실제 메뉴사진처럼 사용하더라도 ' }, { t: '별도의 표시 의무는 없다', em: true }]}
        who="과기정통부 관계자 · 뉴시스 2026.10.13"
      />
      <CaptionF text="AI 사진을 메뉴판에 걸어도, 지금은 표시 의무가 없어요." em="지금은 표시 의무가 없어요." at={T + 3} />
    </>
  );
};

// ── 03 손님: AI 생성 예시 위로 손님 말이 올라온다 ───────────────────────
// 다른 사진과 맞바꿔 「한 가게의 전후」처럼 연출하지 않는다(Fable P1). 판은 말이 올라오면 살짝 흐려진다.
export const Guest03: React.FC = () => {
  const f = useCurrentFrame();
  const q = settle(f, at('guest', 17), 14);
  const dim = interpolate(f, [at('guest', 17), at('guest', 18)], [0, 1], clamp);
  return (
    <>
      <HeadF left={HEAD} right="뉴시스 · 2026.10.13" />
      <Lines at={T} size={80} top={L.TOP} lines={[<>그런데 <MarkF key="m" p={ramp(f, at('guest', 18), 12)}>손님은</MarkF></>]} />
      <Photo src={IMG.ai} x={L.X} y={660} w={CW} style={{ filter: `blur(${dim * 5}px) brightness(${1 - dim * 0.25})`, ...fadeUp(f, T + 2, 50) }} />
      {/* 도장은 흐림 층 밖에 — 판이 흐려져도 「AI 생성 예시」가 읽혀야 한다(Fable 10-20 최종 P1: A판은 AI 생성 판이 여기서만 나온다) */}
      <div style={{ position: 'absolute', left: L.X, top: 660, width: CW, height: 40, ...fadeUp(f, T + 2, 50) }}>
        <Stamp tone="ai" style={{ right: 20, top: 20 }}>
          {AI_STAMP}
        </Stamp>
      </div>
      <Quote
        x={L.X}
        y={1010}
        w={CW}
        size={50}
        p={q}
        markP={ramp(f, at('guest', 19), 14)}
        parts={[{ t: '실제랑 다르면 ' }, { t: '속은 기분이 든다', em: true }]}
        who="손님(22) · 뉴시스 2026.10.13"
      />
    </>
  );
};

// ── 04 전환: 만들지 말고, 다듬기 ───────────────────────────────────────
export const Turn04: React.FC = () => {
  const f = useCurrentFrame();
  const drift = interpolate(f, [T, seq('turn').len], [1, 1.025], clamp);
  return (
    <>
      <HeadF left={HEAD} right="실제 사진" />
      <Lines at={T} size={104} top={L.TOP} lines={['만들지 말고,', <MarkF key="m" p={ramp(f, at('turn', 26), 12)}>다듬기</MarkF>]} />
      <div style={{ position: 'absolute', inset: 0, scale: String(drift), transformOrigin: `540px 1100px`, ...fadeUp(f, T + 4, 60) }}>
        <Photo src={IMG.before} x={L.X} y={830} w={CW}>
          <Stamp style={{ left: 20, top: 20 }}>실제 사진</Stamp>
          <Stamp size={18} style={{ left: 20, bottom: 18, padding: '6px 10px', fontWeight: 500 }}>
            {CREDIT}
          </Stamp>
        </Photo>
      </div>
    </>
  );
};

// ── 05 요청문 ─────────────────────────────────────────────────────────
// 화면 글 = 판1에 실제로 넣은 요청문 그대로(그림/판1_다듬기_지시문.txt의 한국어 부분). 한 장으로 놓고 두 밑칠만 움직인다(Fable P3).
export const PROMPT_LINES = [
  '이 사진 속 음식은 그대로 두고, 빛·색·배경만 다듬어 주세요.',
  '· 음식의 양·재료·모양과 그릇은 바꾸지 마세요. 더하거나 빼지 마세요.',
  '· 창가 자연광처럼 부드럽고 밝게, 색은 실제에 가깝게.',
  '· 가장자리 잡동사니만 정리하고 구도는 그대로.',
  '· 없던 수증기·윤기·글자는 넣지 마세요.',
];
export const FIX_LINE = '· 국물은 원본처럼 노란빛 도는 주황색 그대로, 더 빨갛게 하지 마세요.';
const EM: [string, number][] = [
  ['음식은 그대로 두고', 32],
  ['더하거나 빼지 마세요.', 33.5],
  ['색은 실제에 가깝게.', 35],
];

const HiLine: React.FC<{ text: string; f: number }> = ({ text, f }) => {
  const hit = EM.find(([e]) => text.includes(e));
  if (!hit) return <>{text}</>;
  const [em, b] = hit;
  const i = text.indexOf(em);
  return (
    <>
      {text.slice(0, i)}
      <span style={hiStyle(ramp(f, at('prompt', b), 12))}>{em}</span>
      {text.slice(i + em.length)}
    </>
  );
};

export const LINE_IN = (i: number) => T + 2 + i * 3; // 줄마다 3프레임씩 엇갈려 올라온다
export const Prompt05: React.FC = () => {
  const f = useCurrentFrame();
  const card = settle(f, T, 14);
  return (
    <>
      <HeadF left={HEAD} right="요청문 그대로" />
      <Lines at={T} size={70} top={L.TOP} lines={['사진을 올리고', <>이렇게 <MarkF key="m" p={ramp(f, at('prompt', 31), 12)}>쓰세요</MarkF></>]} />
      <div
        style={{
          position: 'absolute',
          left: L.X,
          top: 730,
          width: CW,
          padding: '26px 30px 30px',
          borderRadius: 30,
          background: '#fff',
          color: C.ink,
          boxShadow: '0 30px 60px -30px rgba(4,12,36,.7)',
          opacity: interpolate(card, [0, 0.4], [0, 1], clamp),
          translate: `0 ${(1 - card) * 50}px`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <Img src={IMG.before} style={{ width: 126, height: 84, objectFit: 'cover', borderRadius: 12 }} />
          <div style={{ font: `600 26px/1.3 ${F.ko}`, color: C.muted }}>사진 1장 첨부</div>
        </div>
        <div style={{ font: `600 33px/1.5 ${F.ko}`, letterSpacing: '-.03em' }}>
          {PROMPT_LINES.map((ln, i) => (
            <div key={i} style={{ marginTop: i === 1 ? 10 : 0, ...fadeUp(f, LINE_IN(i), 18) }}>
              <HiLine text={ln} f={f} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// ── 06 결과 1 ─────────────────────────────────────────────────────────
// 같은 판에서 원본 → 결과 1로 닦아 넘기고, 걷힌 자리(왼쪽 위 찜기 뚜껑, 오른쪽 쇠그릇)에 동그라미.
export const After06: React.FC = () => {
  const f = useCurrentFrame();
  const wipe = ease(f, T + 6, 22);
  const y = 705;
  const h = Math.round((CW * 2) / 3);
  return (
    <>
      <HeadF left={HEAD} right="결과 1" />
      <Lines at={T} size={70} top={L.TOP} lines={['결과 1,', <>가장자리만 <MarkF key="m" p={ramp(f, at('after', 43), 12)}>깨끗</MarkF></>]} />
      <Photo src={IMG.after1} under={IMG.before} wipe={wipe} x={L.X} y={y} w={CW}>
        <Stamp style={{ left: 20, top: 20, opacity: 1 - wipe }}>원본</Stamp>
        <Stamp tone="light" style={{ right: 20, top: 20, opacity: wipe }}>
          AI로 다듬음
        </Stamp>
      </Photo>
      <CrayonRing id="lid" x={L.X + 6} y={y + 8} w={150} h={Math.round(h * 0.42)} at={at('after', 43.5)} padX={18} padY={18} />
      <CrayonRing id="bowl" x={L.X + CW - 92} y={y + 24} w={80} h={Math.round(h * 0.5)} at={at('after', 44.5)} padX={14} padY={18} />
      <CaptionF text="얼핏 보면 배치 그대로, 가장자리만 깨끗해졌죠." em="가장자리만 깨끗해졌죠." at={T + 3} />
    </>
  );
};

// ── 07 확인 셋 ────────────────────────────────────────────────────────
// 세 줄은 착지하자마자 깔고(빈 화면 없이), 판정 표시는 나레이션 낱말(양·재료·빨개졌네요) 뒤에 하나씩.
const crop = (src: string, w: number, rx: number, ry: number, rw: number) => {
  // 3:2 판에서 (rx, ry)부터 폭 rw(원본 1536 기준)인 3:2 영역을 폭 w 상자에 채운다
  const k = w / rw;
  return { width: w, height: Math.round((w * 2) / 3), borderRadius: 12, backgroundImage: `url(${src})`, backgroundSize: `${1536 * k}px ${1024 * k}px`, backgroundPosition: `${-rx * k}px ${-ry * k}px` } as const;
};

const Row: React.FC<{ y: number; at: number; title: string; sub: string; children: React.ReactNode; ok: boolean; markAt: number; note?: string }> = ({ y, at: a, title, sub, children, ok, markAt, note }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: L.X, top: y, width: CW, height: 176, borderRadius: 26, background: '#fff', boxShadow: '0 24px 50px -28px rgba(4,12,36,.7)', ...fadeUp(f, a, 40) }}>
      <div style={{ position: 'absolute', left: 30, top: 26 }}>
        <div style={{ font: `800 52px/1 ${F.ko}`, color: C.ink, letterSpacing: '-.04em' }}>{title}</div>
        <div style={{ marginTop: 14, font: `500 23px/1.25 ${F.ko}`, color: C.muted, width: 190 }}>{sub}</div>
      </div>
      <div style={{ position: 'absolute', left: 236, top: 18, bottom: 18, right: 120, display: 'flex', alignItems: 'center', gap: 16 }}>{children}</div>
      <Mark ok={ok} at={markAt} size={70} style={{ right: 30, top: 53 }} />
      {note && f >= markAt ? <div style={{ position: 'absolute', right: 14, top: 132, font: `700 21px/1 ${F.ko}`, color: ok ? '#2fae6b' : C.crayon, ...fadeUp(f, markAt + 2, 8) }}>{note}</div> : null}
    </div>
  );
};

/** 확인 셋 시각(장면 안 프레임): 줄 등장은 낱말 4프레임 전, ✓는 낱말 10프레임 뒤, ✗는 「빨개졌네요」 4프레임 뒤 */
export const checkT = (variant: 'A' | 'B') => {
  const qty = wordIn('check', 'v07', '양', 51, variant);
  const ing = wordIn('check', 'v07', '재료', 53, variant);
  const col = wordIn('check', 'v07', '색은,', 55, variant);
  const why = wordIn('check', 'v07', '실제에', 56, variant);
  const red = wordIn('check', 'v07', '빨개졌네요.', 59, variant);
  return { qty, ing, col, why, red, qtyMark: qty + 10, ingMark: ing + 10, redMark: red + 4 };
};

export const Check07: React.FC<{ variant: 'A' | 'B' }> = ({ variant }) => {
  const f = useCurrentFrame();
  const { why, qtyMark, ingMark, redMark } = checkT(variant);
  const ys = [650, 846, 1042];
  return (
    <>
      <HeadF left={HEAD} right="올리기 전 확인" />
      <Lines at={T} size={72} top={L.TOP - 6} lines={[<>확인 <MarkF key="m" p={ramp(f, at('check', 50), 12)}>셋</MarkF></>]} />
      <Row y={ys[0]} at={T + 4} title="양" sub="떡 개수·크기" ok markAt={qtyMark}>
        <div style={crop(IMG.before, 186, 900, 330, 540)} />
        <div style={crop(IMG.after1, 186, 900, 330, 540)} />
      </Row>
      <Row y={ys[1]} at={T + 8} title="재료" sub="없던 게 생기거나 빠지지 않았나" ok markAt={ingMark}>
        {['떡', '라면', '계란'].map((t) => (
          <span key={t} style={{ padding: '12px 20px', borderRadius: 999, background: '#eef2f8', font: `700 30px/1 ${F.ko}`, color: C.ink }}>
            {t}
          </span>
        ))}
        <span style={{ font: `500 22px/1.2 ${F.ko}`, color: C.muted }}>그대로</span>
      </Row>
      <Row y={ys[2]} at={T + 12} title="색" sub="국물 색" ok={false} markAt={redMark} note="더 빨개짐">
        <Chip color={COLORS.before.hex} label="원본" size={78} />
        <Chip color={COLORS.after1.hex} label="결과 1" size={78} />
      </Row>
      <div style={{ position: 'absolute', left: L.X, top: 1250, width: CW, font: `700 36px/1.3 ${F.ko}`, color: C.markField, letterSpacing: '-.03em', ...fadeUp(f, why, 20) }}>
        “색은 실제에 가깝게”라고만 썼더니
      </div>
    </>
  );
};

// ── 08 한 줄 더 ───────────────────────────────────────────────────────
export const Fix08: React.FC = () => {
  const f = useCurrentFrame();
  const wipe = ease(f, T + 26, 18);
  const pw = 560;
  const ph = Math.round((pw * 2) / 3);
  return (
    <>
      <HeadF left={HEAD} right="결과 2" />
      <Lines at={T} size={72} top={L.TOP - 6} lines={[<>한 줄 <MarkF key="m" p={ramp(f, at('fix', 65), 12)}>더</MarkF></>]} />
      <div style={{ position: 'absolute', left: L.X, top: 650, width: CW, padding: '24px 28px', borderRadius: 26, background: '#fff', color: C.ink, boxShadow: '0 24px 50px -28px rgba(4,12,36,.7)', font: `700 33px/1.45 ${F.ko}`, letterSpacing: '-.03em', ...fadeUp(f, T, 30) }}>
        <span style={hiStyle(ramp(f, T + 8, 14))}>{FIX_LINE}</span>
      </div>
      <Photo src={IMG.after2} under={IMG.after1} wipe={wipe} x={L.X} y={850} w={pw}>
        <Stamp size={20} style={{ left: 14, top: 14, padding: '6px 10px', opacity: 1 - wipe }}>
          결과 1
        </Stamp>
        <Stamp tone="light" size={20} style={{ left: 14, top: 14, padding: '6px 10px', opacity: wipe }}>
          AI로 다듬음 · 결과 2
        </Stamp>
      </Photo>
      <div style={{ position: 'absolute', left: L.X + pw + 24, top: 850, width: CW - pw - 24, height: ph, borderRadius: 26, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, ...fadeUp(f, T + 20, 30) }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <Chip color={COLORS.before.hex} label="원본" size={64} />
          <Chip color={COLORS.after1.hex} label="결과 1" size={64} />
        </div>
        <Chip color={COLORS.after2.hex} label="결과 2" size={64} />
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 850 + ph + 26, width: CW, font: `700 40px/1.3 ${F.ko}`, color: C.markField, letterSpacing: '-.03em', ...fadeUp(f, T + 50, 20) }}>
        똑같진 않아도, 원본에 훨씬 가깝게
      </div>
    </>
  );
};

// ── 09 끝 ─────────────────────────────────────────────────────────────
// 80박 뒤 곡 끝맺음 첫 타격에 댓글 단추가 한 번 눌리고, 마지막 2초는 멈춘 화면(다시 재생될 때 훅으로).
export const End09: React.FC<{ variant: 'A' | 'B' }> = ({ variant }) => {
  const f = useCurrentFrame();
  const local = (abs: number) => abs - seq('end').from;
  const still = local(TOTAL - 60);
  const ff = Math.min(f, still);
  const drift = interpolate(ff, [T, still], [1, 1.02], clamp);
  const press = interpolate(ff, [local(CUT) - 1, local(CUT) + 1, local(CUT) + 7], [1, 0.95, 1], clamp);
  const pw = Math.round((CW - 28) / 2);
  return (
    <>
      <HeadF left={HEAD} right="@synkbrief" />
      <div style={{ position: 'absolute', inset: 0, scale: String(drift), transformOrigin: `${L.X}px ${L.TOP}px` }}>
        <Lines at={T - 2} size={84} top={L.TOP} lines={['요청문 전문은', <MarkF key="m" p={ramp(ff, at('end', 75), 12)}>{variant === 'A' ? '캡션에' : '고정 댓글에'}</MarkF>]} />
        <div style={{ position: 'absolute', left: L.X, top: 772, ...fadeUp(ff, at('end', 74.5)) }}>
          <Photo src={IMG.before} x={0} y={0} w={pw} radius={22}>
            <Stamp size={18} style={{ left: 10, top: 10, padding: '6px 10px' }}>
              원본
            </Stamp>
          </Photo>
          <Photo src={IMG.after2} x={pw + 28} y={0} w={pw} radius={22}>
            <Stamp tone="light" size={18} style={{ left: 10, top: 10, padding: '6px 10px' }}>
              AI로 다듬음
            </Stamp>
          </Photo>
        </div>
        <div style={{ position: 'absolute', left: L.X, top: 1088, ...fadeUp(ff, at('end', 77)) }}>
          <div style={{ display: 'inline-block', padding: '22px 34px', borderRadius: 999, background: '#fff', color: C.ink, font: `800 44px/1.1 ${F.ko}`, letterSpacing: '-.035em', boxShadow: '0 22px 44px -22px rgba(4,12,36,.6)', scale: String(press), transformOrigin: '50% 50%' }}>
            AI 메뉴 사진, 표시해야 할까요?
          </div>
        </div>
        <div style={{ position: 'absolute', left: L.X, top: 1204, font: `600 32px/1.3 ${F.ko}`, color: C.onField, ...fadeUp(ff, at('end', 78)) }}>
          댓글로 <b style={{ color: C.markField }}>O · X</b>
        </div>
        <div style={{ position: 'absolute', left: L.X, right: L.R, top: 1300, display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...fadeUp(ff, at('end', 78.5)) }}>
          <span style={{ display: 'inline-flex', padding: '12px 18px', borderRadius: 16, background: '#fff' }}>
            <Img src={staticFile('kit/logo-shift.webp')} style={{ height: 40, display: 'block' }} />
          </span>
          <span style={{ font: `500 22px/1.2 ${F.ko}`, color: C.onField2 }}>{CREDIT}</span>
        </div>
      </div>
    </>
  );
};
