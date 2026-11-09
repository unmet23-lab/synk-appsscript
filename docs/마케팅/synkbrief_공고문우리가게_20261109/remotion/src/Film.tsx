// synkbrief B36 「공고문 우리 가게」(11-09) — 정책자금 공고문은 AI한테 「우리 가게가 되는 것만, 몇 쪽인지도」.
// 뼈대는 yKocFQ3dN54(오마주.json — 39.6초: 사람 앞에 두 칸 판을 깔고 항목이 하나씩 크게 튀어나와 한쪽으로 갈라진다 · 37.5초 끝 장치).
// 이 편 36.6초 = 원본의 92%. 판 구간은 원본의 「이름 → 바로 판정」 박자를 우리 말로 옮겼다(원본의 말은 옮기지 않는다). 판은 「끝났어요 / 미래예요」 대신 「안 돼요 / 돼요」, 항목은 공고문의 자금 13개.
// 겉은 장부 「화면 결」: 위 그늘 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳(쪽수) · SUIT 하나 · 마침표 없음 · 안전선 안.
// 실제 화면은 Gemini(11-09, 지어낸 예시 가게)를 휴대폰 폭으로 찍은 그대로이고, 공고문은 중기부 공고 제2026-576호 PDF 그대로다.
import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import PLACE from './vo-place.json';
import { BUTTER, clamp, EASE_IO, EASE_OUT, FULL_H, FullPan, GREY, pageSrc, PH, PW, Screen, sec, Sfx, Shade, Small, T, X, Y } from './parts';
import { EndScene } from './Scene';

const vo = (id: string) => (PLACE as { id: string; at: number }[]).find((c) => c.id === id)!.at / 30;
const seq = (from: number, to: number, el: React.ReactNode) => <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)}>{el}</Sequence>;

export const S = {
  hook: 0, type1: 4.4, type2: 6.7, close: 8.0, sent: 10.42, ans: 10.9, board: 11.2,
  table: 25.5, end: 27.6, lineDur: 2.4, total: 36.6,
};
export const TOTAL = sec(S.total);

// ── 훅: 사장님 앞에 실제 공고문 쪽이 하나씩 떨어진다(원본의 로고가 튀어나오는 칸)
const DROPS: { n: number; at: number; x: number; y: number; r: number }[] = [
  { n: 1, at: 0.28, x: 540, y: 1390, r: -3 },
  { n: 7, at: 0.78, x: 500, y: 1400, r: 2.5 },
  { n: 6, at: 1.46, x: 585, y: 1385, r: -1.5 },
  { n: 10, at: 2.2, x: 520, y: 1410, r: 3.5 },
  { n: 13, at: 2.9, x: 560, y: 1395, r: -3.5 },
  { n: 16, at: 3.56, x: 535, y: 1405, r: 1.5 },
];
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const z = 1 + f * 0.00035;
  const W = 500;
  const Ht = (PH / PW) * W;
  return (
    <AbsoluteFill style={{ background: '#0b0b0b', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: '50% 45%' }}>
        <Img src={staticFile('img/sajang.jpg')} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, objectFit: 'cover' }} />
      </div>
      {DROPS.map((d) => {
        const a = sec(d.at);
        if (f < a) return null;
        const p = interpolate(f, [a, a + 6], [0, 1], { ...clamp, easing: EASE_OUT });
        const s = interpolate(p, [0, 1], [1.28, 1]);
        return (
          <div key={d.n} style={{ position: 'absolute', left: d.x - W / 2, top: d.y - Ht / 2, width: W, height: Ht, opacity: Math.min(1, p * 2), transform: `rotate(${d.r}deg) scale(${s})`, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <Img src={pageSrc(d.n)} style={{ width: W, height: Ht }} />
          </div>
        );
      })}
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
  // 변주 — 혼자 가운데에 오래 머물다(「잠깐만요」) 「있으면, 돼요」에서 오른쪽으로
  { name: '대환대출', ok: true, page: '11~12쪽', note: '고금리 대출이 있을 때', at: 21.8, hold: 54 },
];
const LX = X, RX = 574, ROW_L = 68, ROW_R = 150, Y0_L = 786, Y0_R = 786;
const Board: React.FC = () => {
  const f = useCurrentFrame(); // 0 = S.board
  const line = interpolate(f, [0, 12], [0, 1], { ...clamp, easing: EASE_OUT });
  let li = 0, ri = 0;
  return (
    <AbsoluteFill style={{ background: '#0b0b0b', overflow: 'hidden' }}>
      {/* 대환대출 칸(「잠깐만요」)만 사장님 얼굴로 컷 — 판이 같은 구도로 5초 넘게 이어지지 않게 */}
      {f >= sec(21.8 - S.board) && f < sec(24.5 - S.board) ? (
        <Img src={staticFile('img/sajang.jpg')} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, objectFit: 'cover', filter: 'brightness(0.42) blur(2px)', transformOrigin: '42% 44%', transform: `scale(${1.75 + (f - sec(21.8 - S.board)) * 0.0012})` }} />
      ) : (
        <Img src={staticFile('img/sajang.jpg')} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, objectFit: 'cover', filter: 'brightness(0.27) blur(7px)', transform: `scale(${1.05 + f * 0.0004})` }} />
      )}
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${1 + f * 0.00035})`, transformOrigin: '540px 1000px' }}>
      <div style={{ position: 'absolute', left: LX, top: 650, opacity: line, fontFamily: KO, fontWeight: 800, fontSize: 50, letterSpacing: -1, color: GREY }}>안 돼요</div>
      <div style={{ position: 'absolute', left: RX, top: 650, opacity: line, fontFamily: KO, fontWeight: 800, fontSize: 50, letterSpacing: -1, color: '#fff' }}>돼요</div>
      <div style={{ position: 'absolute', left: 74, top: 726, width: 932 * line, height: 3, background: 'rgba(255,255,255,0.75)' }} />
      <div style={{ position: 'absolute', left: 539, top: 650, width: 3, height: 690 * line, background: 'rgba(255,255,255,0.75)' }} />
      {ITEMS.map((it, i) => {
        const at = sec(it.at - S.board);
        const slot = it.ok ? ri++ : li++;
        if (f < at) return null;
        const pop = interpolate(f, [at, at + 5], [0, 1], { ...clamp, easing: EASE_OUT });
        const hold = it.hold ?? 9;
        const go = interpolate(f, [at + hold, at + hold + 7], [0, 1], { ...clamp, easing: EASE_IO });
        const cx = 540, cy = 1420, big = 92;
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
              <div style={{ position: 'absolute', left: RX, top: ty + 58, opacity: pageIn, transform: `translateY(${(1 - pageIn) * 12}px)`, fontFamily: KO, fontWeight: 800, fontSize: 46, letterSpacing: -1.2, color: BUTTER }}>
                {it.page}
                {it.note ? <span style={{ fontWeight: 600, fontSize: 26, color: GREY, marginLeft: 14, letterSpacing: -0.4 }}>{it.note}</span> : null}
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

// 실제 표 — 답 한 장에서 머리줄과 네 줄만 잘라 빈 칸 없이 쌓는다(값 · 글은 그대로, 줄을 크게 다시 짬)
const ROWS: [number, number][] = [[1296, 1392], [1446, 1604], [1980, 2268], [2654, 2808], [3392, 3736]];
const TableRows: React.FC = () => {
  const f = useCurrentFrame();
  let y = 700;
  return (
    <AbsoluteFill style={{ background: '#0b0b0b', transform: `scale(${1 + f * 0.0008})`, transformOrigin: '300px 1100px' }}>
      <div style={{ position: 'absolute', left: X, top: 648, fontFamily: KO, fontWeight: 600, fontSize: 30, color: '#9a9a9a', letterSpacing: -0.4 }}>Gemini 답의 표 · 사이 빈 칸만 줄임</div>
      {ROWS.map(([a, b], i) => {
        const h = b - a;
        const top = y;
        y += h;
        const p = interpolate(f, [i * 6, i * 6 + 7], [0, 1], { ...clamp, easing: EASE_OUT });
        return (
          <div key={a} style={{ position: 'absolute', left: 0, top, width: 1080, height: h, overflow: 'hidden', opacity: p, transform: `translateY(${(1 - p) * 18}px)` }}>
            <Img src={staticFile('img/full.jpg')} style={{ position: 'absolute', left: 0, top: -a, width: 1080, height: FULL_H, maxWidth: 'none', filter: 'brightness(1.15)' }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const Film: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: '#0b0b0b' }}>
      {/* 0 훅 — 브레이크타임의 사장님, 실제 공고문 쪽이 쌓인다 */}
      {seq(S.hook, S.type1, <Hook />)}
      {/* 4.4 실제 화면 — 공고문을 올리고 가게 사정을 친다 */}
      {seq(S.type1, S.type2, <Screen dir="t2" pre="f" k0={38} k1={64} dur={S.type2 - S.type1} box={{ x: 0, y: 1380, w: 1080, h: 950 }} top={800} note={NOTE} hold={0.2} />)}
      {/* 6.7 요청 끝줄 */}
      {seq(S.type2, S.close, <Screen dir="t2" pre="f" k0={65} k1={80} dur={S.close - S.type2} box={{ x: 0, y: 1380, w: 1080, h: 950 }} top={800} note={NOTE} />)}
      {seq(S.close, S.sent, <Screen dir="t2" pre="f" k0={80} k1={87} dur={S.sent - S.close} box={{ x: 40, y: 1740, w: 1000, h: 380 }} scale={1.06} top={980} note={NOTE} hold={0.5} />)}
      {/* 10.42 보냄 → 답이 나온다 */}
      {seq(S.sent, S.ans, <Screen dir="t2" pre="f" k0={89} k1={120} dur={S.ans - S.sent} box={{ x: 0, y: 120, w: 1080, h: 760 }} top={800} />)}
      {seq(S.ans, S.board, <FullPan y0={1000} dur={S.board - S.ans} h={1000} top={800} />)}
      {/* 11.2 분류판 — 13.75부터 자금이 하나씩 */}
      {seq(S.board, S.table, <Board />)}
      {/* 25.5 실제 표 — 네 줄과 쪽수 */}
      {seq(S.table, S.end, <TableRows />)}
      {/* 27.6 답 끝줄 → 공고문을 넘겨 9쪽 → 그 줄(한 장면) */}
      {seq(S.end, S.total, <EndScene lineDur={S.lineDur} hold={0.35} />)}

      <Shade a={0.9} />
      {/* 위 작은 표시 */}
      <Small text="예시 가게 · 사장님 장면은 AI로 만든 재연" from={S.hook} to={S.type1} />
      <Small text="실제 공고문 그대로 · 중소벤처기업부 공고 제2026-576호" from={S.end + S.lineDur} to={S.total} />
      <Small text="예시 가게 조건으로 Gemini가 신청 대상을 가른 결과" from={S.board} to={S.table} />
      {seq(S.board, S.table, <div style={{ position: 'absolute', left: X, top: 546, fontFamily: KO, fontWeight: 600, fontSize: 31, color: GREY, letterSpacing: -0.6, whiteSpace: 'nowrap' }}>백반집 · 창업 3년 · 작년 매출 9,800만 원 · 올해 20% 감소 · 신용 780</div>)}

      {/* 큰 글자 = 말 */}
      <T still lines={[<React.Fragment key="a">정책자금 공고문 <Y>30쪽</Y></React.Fragment>, 'AI한테 시켜 봤습니다']} size={88} from={0} to={vo('n02')} />
      <T lines={['우리 가게는', '뭐가 되나']} from={vo('n02')} to={S.type1} />
      <T lines={['공고문을 올리고', '가게 사정을 적어요']} from={vo('n03')} to={vo('n04')} />
      <T lines={['되는 자금만', <React.Fragment key="y">공고문 <Y>몇 쪽</Y>인지도</React.Fragment>]} from={vo('n04')} to={vo('n05')} />
      <T lines={['이 가게 조건으로', '자금 13개가 갈립니다']} size={88} from={vo('n05')} to={vo('n06')} />
      <T lines={['13개 중 4개']} size={112} from={vo('n06')} to={S.table} />
      <T lines={['실제 표에도', <React.Fragment key="y"><Y>쪽수</Y>가 그대로</React.Fragment>]} from={S.table} to={S.end} />
      <T lines={['AI가 제일 먼저', <React.Fragment key="y">보라는 건 <Y>9쪽</Y></React.Fragment>]} from={vo('n08')} to={vo('n09')} />
      <T lines={[<React.Fragment key="y"><Y>9쪽</Y>을 펴 봤습니다</React.Fragment>]} from={vo('n09')} to={vo('n10')} />
      <T lines={['AI가 말한 조건', '진짜 그대로 있습니다']} size={92} from={vo('n10')} to={vo('n11')} />
      <T lines={['쪽수를 받으면', '확인은 바로입니다']} from={vo('n11')} to={S.total + 1} />
      <Small text="SYNK 브리핑" from={vo('n11')} to={S.total} right />

      {/* 소리 */}
      <Audio src={staticFile('bgm.wav')} volume={(fr: number) => 0.8 * interpolate(fr, [0, sec(0.4), TOTAL - 20, TOTAL], [0.0, 0.17, 0.15, 0], clamp)} />
      {(PLACE as { id: string; at: number }[]).map((c) => (
        <Sequence key={c.id} from={c.at}><Audio src={staticFile(`vo/${c.id}.wav`)} volume={0.8} /></Sequence>
      ))}
      {DROPS.map((d) => <Sfx key={d.n} at={d.at} src="hand" v={0.26} />)}
      <Sfx at={S.sent} src="tok" v={0.24} />
      {ITEMS.map((it) => <Sfx key={it.name} at={it.at} src={it.ok ? 'pop' : 'tick'} v={it.ok ? 0.26 : 0.3} />)}
      <Sfx at={21.8 + 54 / 30} src="pop" v={0.26} />
    </AbsoluteFill>
  );
};
