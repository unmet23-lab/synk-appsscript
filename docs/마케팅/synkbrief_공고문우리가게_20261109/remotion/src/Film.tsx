// synkbrief B36 「공고문 우리 가게」(11-09) — 정책자금 공고문은 AI한테 「우리 가게가 되는 것만, 몇 쪽인지도」.
// 뼈대는 yKocFQ3dN54(오마주.json — 39.6초: 사람 앞에 두 칸 판을 깔고 항목이 하나씩 크게 튀어나와 한쪽으로 갈라진다 · 37.5초 끝 장치).
// 이 편 36.6초 = 원본의 92%. 판 구간은 원본의 「이름 → 바로 판정」 박자를 우리 말로 옮겼다(원본의 말은 옮기지 않는다). 판은 「끝났어요 / 미래예요」 대신 「안 돼요 / 돼요」, 항목은 공고문의 자금 13개.
// 겉은 장부 「화면 결」: 위 그늘 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳(쪽수) · SUIT 하나 · 마침표 없음 · 안전선 안.
// 실제 화면은 Gemini(11-09, 지어낸 예시 가게)를 휴대폰 폭으로 찍은 그대로이고, 공고문은 중기부 공고 제2026-576호 PDF 그대로다.
import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import PLACE from './vo-place.json';
import { BUTTER, clamp, EASE_IO, EASE_OUT, Flip, FULL_H, FullPan, GREY, Screen, sec, Sfx, Shade, Small, T, X, Y } from './parts';
import { EndScene } from './Scene';

const vo = (id: string) => (PLACE as { id: string; at: number }[]).find((c) => c.id === id)!.at / 30;
const seq = (from: number, to: number, el: React.ReactNode) => <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)}>{el}</Sequence>;

export const S = {
  hook: 0, flip: 1.2, type1: 4.4, type2: 6.7, close: 8.0, sent: 10.42, ans: 10.9, board: 11.2, pause: 21.8, back: 23.1,
  table: 25.5, end: 27.6, lineDur: 2.4, total: 36.6,
};
export const TOTAL = sec(S.total);

// ── 훅: 사장님 → 실제 공고문 30쪽이 화면 가득 넘어간다
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const z = 1 + f * 0.0009;
  return (
    <AbsoluteFill style={{ background: '#0b0b0b', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: '50% 45%' }}>
        <Img src={staticFile('img/sajang.jpg')} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, objectFit: 'cover' }} />
      </div>
    </AbsoluteFill>
  );
};

// ── 분류판 — 자금 이름이 가운데 크게 나왔다가 한쪽으로 간다(이름은 실제 답 그대로, 줄임만)
type Item = { name: string; ok: boolean; page?: string; note?: string; at: number; hold?: number };
const ITEMS: Item[] = [
  { name: '소공인특화', ok: false, at: 11.9, hold: 5 },
  { name: '혁신성장촉진', ok: false, at: 12.5, hold: 5 },
  { name: '민간투자 매칭', ok: false, at: 13.1, hold: 5 },
  { name: '재해 자금', ok: false, at: 13.75, hold: 18 },
  { name: '홈플러스 피해', ok: false, at: 14.72, hold: 4 },
  { name: '일반경영안정', ok: true, page: '6쪽', at: 15.1, hold: 24 },
  { name: '재도전특별', ok: false, at: 16.95, hold: 14 },
  { name: '장애인기업', ok: false, at: 17.72, hold: 4 },
  { name: '일시적 경영애로', ok: true, page: '8~9쪽', at: 18.1, hold: 24 },
  { name: '청년고용연계', ok: false, at: 19.5, hold: 4 },
  { name: '신용취약', ok: true, page: '10쪽', at: 19.9, hold: 18 },
  { name: '상생성장', ok: false, at: 21.2, hold: 5 },
  // 변주 — 21.8~23.1은 판을 걷고 사장님 얼굴(「잠깐만요」), 판이 돌아오면 오른쪽으로
  { name: '대환대출', ok: true, page: '11~12쪽', note: '고금리 대출이 있을 때', at: 23.1, hold: 16 },
];
// 판은 위 그늘 아래(bg)와 위(fg)로 나눈다 — 머리글 · 선이 그늘에 눌려 회색이 되지 않게. 왼쪽 글자는 x 74에 묶어 천천히 다가간다.
// 판의 세 구성 — ① 제목 + 판 ② 제목 말이 끝나면 판이 위로 올라와 커진다(자금 이름이 폰에서 읽힘) ③ 18초부터 「안 돼요」 칸을 치우고 「돼요」와 쪽수만 크게.
// 「잠깐만요」(사장님) 뒤에는 ①로 돌아와 완성 판을 다 보인다.
const LX = X, RX = 500, DIV = 470, ROW_L = 62, ROW_R = 130, Y0_L = 786, Y0_R = 786;
const RISE: [number, number] = [14.15, 14.5]; // 원본 변주 자리(원본 16초 = 우리 14.8초 ±0.7)에서 판이 바뀐다
const ONLY: [number, number] = [17.9, 18.2];
const stepAt = (f: number, [a, b]: [number, number]) => (f >= sec(S.back - S.board) ? 0 : interpolate(f, [sec(a - S.board), sec(b - S.board)], [0, 1], { ...clamp, easing: EASE_IO }));
const riseAt = (f: number) => stepAt(f, RISE);
const BoardBg: React.FC = () => {
  const f = useCurrentFrame(); // 0 = S.board
  return (
    <AbsoluteFill style={{ background: '#0b0b0b', overflow: 'hidden' }}>
      <Img src={staticFile('img/sajang.jpg')} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, objectFit: 'cover', filter: 'brightness(0.17) blur(26px)', transform: `scale(${1.12 + f * 0.0004})` }} />
    </AbsoluteFill>
  );
};
const Board: React.FC = () => {
  const f = useCurrentFrame(); // 0 = S.board
  const line = interpolate(f, [0, 12], [0, 1], { ...clamp, easing: EASE_OUT });
  let li = 0, ri = 0;
  if (f >= sec(S.pause - S.board) && f < sec(S.back - S.board)) return null; // 「잠깐만요」 동안은 판을 걷는다
  const k = riseAt(f), k2 = stepAt(f, ONLY);
  // 첫 「돼요」(15.1초) — 안 돼요가 이어지다 처음 갈리는 자리(원본 변주 자리). 판 전체가 한 번 쿵 내려앉는다.
  const hitAt = sec(15.1 - S.board);
  const hit = f < hitAt ? 0 : interpolate(f, [hitAt, hitAt + 9], [1, 0], { ...clamp, easing: EASE_OUT });
  const Z = (1 + f * 0.00012) * (1 + 0.18 * k) * (1 + 0.54 * k2) * (1 + 0.05 * hit);
  const camX = -(RX - LX) * Z * k2, camY = -340 * k; // ③에서 「돼요」 칸이 왼쪽 글 줄(x 74)로 온다
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${camX}px, ${camY}px) scale(${Z})`, transformOrigin: '74px 650px' }}>
      <div style={{ position: 'absolute', left: LX, top: 650, opacity: line, fontFamily: KO, fontWeight: 800, fontSize: 52, letterSpacing: -1, color: '#fff' }}>안 돼요</div>
      <div style={{ position: 'absolute', left: RX, top: 650 + 16 * k2, opacity: line, fontFamily: KO, fontWeight: 800, fontSize: 52 - 22 * k2, letterSpacing: -1, color: '#fff' }}>돼요</div>
      {/* 선 굵기 · 양 끝은 판이 커져도 화면에서 같게(x 74~1006) */}
      <div style={{ position: 'absolute', left: LX + (RX - LX) * k2, top: 726, width: (932 / Z) * line, height: 3 / Z, background: 'rgba(255,255,255,0.75)' }} />
      <div style={{ position: 'absolute', left: DIV, top: 650, width: 3 / Z, height: 670 * line, opacity: 1 - k2, background: 'rgba(255,255,255,0.75)' }} />
      {ITEMS.map((it, i) => {
        const at = sec(it.at - S.board);
        const slot = it.ok ? ri++ : li++;
        if (f < at) return null;
        const pop = interpolate(f, [at, at + 5], [0, 1], { ...clamp, easing: EASE_OUT });
        const hold = it.hold ?? 9;
        const go = interpolate(f, [at + hold, at + hold + 7], [0, 1], { ...clamp, easing: EASE_IO });
        // 이름이 나오는 자리는 화면에 고정(판 아래, 앱 글자 자리 위 — 세로선을 끊지 않는다). 판이 움직여도 크기 · 자리가 같게 판 좌표로 되돌려 쓴다.
        const cx = LX + (540 - camX - LX) / Z, cy = 650 + (1325 - 75 * k - camY - 650) / Z, big = 84 / Z;
        const tx = it.ok ? RX : LX, ty = it.ok ? Y0_R + slot * ROW_R : Y0_L + slot * ROW_L, small = it.ok ? 46 : 38;
        const x = interpolate(go, [0, 1], [cx, tx]);
        const y = interpolate(go, [0, 1], [cy, ty]);
        const size = interpolate(go, [0, 1], [big, small]);
        const tr = go < 1 ? `translate(${interpolate(go, [0, 1], [-50, 0])}%, 0) scale(${0.82 + 0.18 * pop})` : undefined;
        const color = go < 0.5 ? '#fff' : it.ok ? '#fff' : '#b9b9b9';
        const pageIn = interpolate(f, [at + hold + 6, at + hold + 12], [0, 1], { ...clamp, easing: EASE_OUT });
        return (
          <React.Fragment key={it.name}>
            <div style={{ position: 'absolute', left: x, top: y, whiteSpace: 'nowrap', opacity: Math.min(1, pop * 1.6), transform: tr, transformOrigin: '50% 50%', fontFamily: KO, fontWeight: it.ok ? 800 : 700, fontSize: size, letterSpacing: -1.4, color, textShadow: '0 2px 18px rgba(0,0,0,0.7)' }}>{it.name}</div>
            {it.ok && pageIn > 0 ? (
              <div style={{ position: 'absolute', left: RX, top: ty + 54, opacity: pageIn, transform: `translateY(${(1 - pageIn) * 12}px)`, fontFamily: KO, fontWeight: 800, fontSize: 46, lineHeight: 1.12, letterSpacing: -1.2, color: BUTTER }}>
                {it.page}
                {it.note ? <div style={{ fontWeight: 600, fontSize: 28, lineHeight: 1.3, color: GREY, letterSpacing: -0.4 }}>{it.note}</div> : null}
              </div>
            ) : null}
          </React.Fragment>
        );
      })}
      </div>
    </AbsoluteFill>
  );
};

const NOTE = '예시 가게로 실제 Gemini에 물어본 화면 · 11월 9일';

// 판 위 예시 가게 조건 한 줄(시험관 넷이 「왜 갈리는지 모르겠다」고 짚은 자리)
// 판이 올라갈 때 같이 올라가 판 바로 위에 남는다
const Cond: React.FC<{ rise?: boolean }> = ({ rise }) => {
  const f = useCurrentFrame();
  const top = rise ? interpolate(riseAt(f), [0, 1], [592, 256]) : 592; // 판 바로 위 — 판에 딸린 줄로 읽히게
  return <div style={{ position: 'absolute', left: X, top, fontFamily: KO, fontWeight: 600, fontSize: 31, color: GREY, letterSpacing: -0.6, whiteSpace: 'nowrap' }}>백반집 · 창업 3년 · 작년 매출 9,800만 원 · 올해 20% 감소 · 신용 780</div>;
};

// 「잠깐만요」 — 판을 걷고 사장님 얼굴만
const Pause: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: '#0b0b0b', overflow: 'hidden' }}>
      <Img src={staticFile('img/sajang.jpg')} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, objectFit: 'cover', transformOrigin: '42% 46%', transform: `scale(${1.42 + f * 0.0012})` }} />
    </AbsoluteFill>
  );
};

// 끝 — 그대로 붙여 쓸 말(실제 요청의 끝 두 문장에서)
const Keep: React.FC<{ from: number }> = ({ from }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [sec(from), sec(from) + 9], [0, 1], { ...clamp, easing: EASE_OUT });
  if (f < sec(from)) return null;
  return (
    <>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1170, bottom: 0, opacity: p, background: 'linear-gradient(to bottom, rgba(11,11,11,0) 0px, rgba(11,11,11,0.98) 40px)' }} />
    <div style={{ position: 'absolute', left: X, top: 1240, width: 930, opacity: p, transform: `translateY(${(1 - p) * 18}px)`, fontFamily: KO }}>
      <div style={{ fontWeight: 600, fontSize: 32, color: GREY, letterSpacing: -0.5, marginBottom: 14 }}>붙여 쓸 말</div>
      <div style={{ fontWeight: 700, fontSize: 52, lineHeight: 1.24, color: '#fff', letterSpacing: -1.4 }}>우리 가게가 신청할 수 있는<br />자금만 표로 뽑아 줘<br />공고문 <span style={{ color: BUTTER }}>몇 쪽</span>인지도 적어 줘</div>
    </div>
    </>
  );
};

// 실제 표 — 답 한 장에서 머리줄과 네 줄만 잘라 빈 칸 없이 쌓는다(값 · 글은 그대로, 줄을 크게 다시 짬)
const ROWS: { a: number; b: number; sub?: boolean }[] = [{ a: 1306, b: 1384 }, { a: 1454, b: 1532 }, { a: 1992, b: 2068 }, { a: 2126, b: 2196, sub: true }, { a: 2660, b: 2736 }, { a: 3394, b: 3470 }, { a: 3594, b: 3664, sub: true }];
const ROW_S = 1.36;
// 답 화면 원본의 두 칸(자금명 x 40~480 · 쪽수 x 575~775). 사이 빈 칸만 줄여 「공고 쪽수」가 화면 안에 다 들어오게 한다. 바탕은 원본과 같은 #000.
const COL1 = { x: 40, w: 440 }, COL2 = { x: 575, w: 200 };
const COL2_L = 667;
const ROWS_TOP = 716;
const SCROLL = 0.5; // 먼저 실제 답을 그대로 빠르게 굴려 보인 뒤(화면 결 — 실물 먼저) 줄만 모은다
const TableRows: React.FC = () => {
  const f0 = useCurrentFrame();
  if (f0 < sec(SCROLL)) return <FullPan y0={1290} y1={2700} dur={SCROLL} h={720} top={ROWS_TOP} ease={false} />;
  const f = f0 - sec(SCROLL);
  let y = ROWS_TOP;
  const cell = (c: { x: number; w: number }, left: number, a: number, h: number, s: number) => (
    <div style={{ position: 'absolute', left, top: 0, width: c.w * s, height: h, overflow: 'hidden' }}>
      <Img src={staticFile('img/full.jpg')} style={{ position: 'absolute', left: -c.x * s, top: -a * s, width: 1080 * s, height: FULL_H * s, maxWidth: 'none', filter: 'brightness(1.15)' }} />
    </div>
  );
  return (
    <AbsoluteFill style={{ background: '#000', transform: `scale(${1 + f * 0.0004})`, transformOrigin: `${X}px 1100px` }}>
      {ROWS.map(({ a, b, sub }, i) => {
        const s = sub ? ROW_S * 0.76 : ROW_S; // 괄호 줄은 작게 — 이름에 딸린 줄로 읽히게
        const h = (b - a) * s;
        const top = y;
        y += h;
        const p = interpolate(f, [i * 3, i * 3 + 7], [0, 1], { ...clamp, easing: EASE_OUT });
        return (
          <div key={a} style={{ position: 'absolute', left: 0, top, width: 1080, height: h, opacity: p * (sub ? 0.6 : 1), transform: `translateY(${(1 - p) * 18}px)` }}>
            {cell(COL1, X - (62 - COL1.x) * s, a, h, s)}
            {sub ? null : cell(COL2, COL2_L, a, h, s)}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
// 표 출처 줄 — 위 그늘에 눌려 안 읽히지 않게 그늘 위에 얹는다
const TableNote: React.FC = () => <div style={{ position: 'absolute', left: X, top: ROWS_TOP - 56, fontFamily: KO, fontWeight: 600, fontSize: 30, color: GREY, letterSpacing: -0.4 }}>Gemini 답의 표에서 줄만 모음 · 예시 가게</div>;

export const Film: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: '#0b0b0b' }}>
      {/* 0 훅 — 브레이크타임의 사장님 → 1.2 실제 공고문 30쪽이 넘어간다 */}
      {seq(S.hook, S.flip, <Hook />)}
      {seq(S.flip, S.type1, <Flip to={30} per={3} w={960} top={560} />)}
      {/* 4.4 실제 화면 — 공고문을 올리고 가게 사정을 친다 */}
      {seq(S.type1, S.type2, <Screen dir="t2" pre="f" k0={38} k1={64} dur={S.type2 - S.type1} box={{ x: 0, y: 1380, w: 1080, h: 950 }} top={800} note={NOTE} hold={0.2} />)}
      {/* 6.7 요청 끝줄 */}
      {seq(S.type2, S.close, <Screen dir="t2" pre="f" k0={65} k1={80} dur={S.close - S.type2} box={{ x: 0, y: 1380, w: 1080, h: 950 }} top={800} note={NOTE} />)}
      {seq(S.close, S.sent, <Screen dir="t2" pre="f" k0={80} k1={87} dur={S.sent - S.close} box={{ x: 40, y: 1740, w: 1000, h: 380 }} scale={1.06} top={980} note={NOTE} hold={0.5} />)}
      {/* 10.42 보냄 → 답이 나온다 */}
      {seq(S.sent, S.ans, <Screen dir="t2" pre="f" k0={89} k1={120} dur={S.ans - S.sent} box={{ x: 0, y: 120, w: 1080, h: 760 }} top={800} />)}
      {seq(S.ans, S.board, <FullPan y0={1000} dur={S.board - S.ans} h={1000} top={800} />)}
      {/* 11.2 분류판 — 13.75부터 자금이 하나씩 */}
      {seq(S.board, S.table, <BoardBg />)}
      {seq(S.pause, S.back, <Pause />)}
      {/* 25.5 실제 표 — 네 줄과 쪽수 */}
      {seq(S.table, S.end, <TableRows />)}
      {/* 27.6 답 끝줄 → 공고문을 넘겨 9쪽 → 그 줄(한 장면) */}
      {seq(S.end, S.total, <EndScene lineDur={S.lineDur} hold={0.35} backAt={3.3} />)}

      <Shade a={0.9} />
      {seq(S.board, S.table, <Board />)}
      {seq(S.table, S.end, <TableNote />)}
      {/* 위 작은 표시 */}
      <Small text="예시 가게 · 사장님 장면은 AI로 만든 재연" from={S.hook} to={S.flip} />
      <Small text="실제 공고문 · 중소벤처기업부 공고 제2026-576호" from={S.flip} to={S.type1} />
      <Small text="실제 공고문 그대로 · 중소벤처기업부 공고 제2026-576호" from={S.end + S.lineDur} to={S.total} />
      <Small text="예시 가게 조건으로 Gemini가 신청 대상을 가른 결과" from={S.board} to={S.pause} />
      <Small text="예시 가게 조건으로 Gemini가 신청 대상을 가른 결과" from={S.back} to={S.table} />
      <Small text="사장님 장면은 AI로 만든 재연" from={S.pause} to={S.back} />
      {seq(S.board, S.pause, <Cond rise />)}
      {seq(S.back, S.table, <Cond />)}

      {/* 큰 글자 = 말 */}
      <T still lines={[<React.Fragment key="a">정책자금 공고문 <Y>30쪽</Y></React.Fragment>, 'AI한테 시켜 봤습니다']} size={88} from={0} to={vo('n02')} />
      <T lines={['우리 가게는', '뭐가 되나']} from={vo('n02')} to={S.type1} />
      <T lines={['공고문을 올리고', '가게 사정을 적어요']} from={vo('n03')} to={vo('n04')} />
      <T lines={['되는 자금만', <React.Fragment key="y">공고문 <Y>몇 쪽</Y>인지도</React.Fragment>]} from={vo('n04')} to={vo('n05')} />
      <T lines={['이 가게 조건으로', '자금 13개가 갈립니다']} size={88} from={vo('n05')} to={RISE[0] + 0.2} fadeOut={8} />
      <T lines={['대환대출은', '잠깐만요']} from={S.pause} to={S.back} />
      <T lines={['고금리 대출이 있으면', '돼요']} size={88} from={S.back} to={vo('n06')} />
      <T lines={['13개 중 4개']} size={112} from={vo('n06')} to={S.table} />
      <T lines={['실제 표에도', <React.Fragment key="y"><Y>쪽수</Y>가 그대로</React.Fragment>]} from={S.table} to={S.end} />
      <T lines={['AI가 제일 먼저', <React.Fragment key="y">보라는 건 <Y>9쪽</Y></React.Fragment>]} from={vo('n08')} to={vo('n09')} />
      <T lines={[<React.Fragment key="y"><Y>9쪽</Y>을 펴 봤습니다</React.Fragment>]} from={vo('n09')} to={vo('n10')} />
      <T lines={['AI가 말한 조건', '진짜 그대로 있습니다']} size={92} from={vo('n10')} to={vo('n11')} />
      <T lines={['쪽수를 받으면', '확인은 바로입니다']} from={vo('n11')} to={S.total + 1} />
      <Keep from={vo('n11') + 0.35} />
      <Small text="SYNK 브리핑" from={vo('n11')} to={S.total} right brand />

      {/* 소리 */}
      <Audio src={staticFile('bgm.wav')} volume={(fr: number) => 0.8 * interpolate(fr, [0, sec(0.4), TOTAL - 20, TOTAL], [0.0, 0.225, 0.2, 0], clamp)} />
      {(PLACE as { id: string; at: number }[]).map((c) => (
        <Sequence key={c.id} from={c.at}><Audio src={staticFile(`vo/${c.id}.wav`)} volume={0.8} /></Sequence>
      ))}
      {Array.from({ length: 14 }, (_, i) => <Sfx key={i} at={S.flip + i * 0.2} src="flip" v={0.2} />)}
      <Sfx at={S.sent} src="tok" v={0.24} />
      {ITEMS.map((it) => <Sfx key={it.name} at={it.at} src={it.ok ? 'pop' : 'tick'} v={it.ok ? 0.26 : 0.3} />)}
      <Sfx at={S.pause} src="tok" v={0.24} />
      <Sfx at={23.1 + 16 / 30} src="tok" v={0.2} />
    </AbsoluteFill>
  );
};
