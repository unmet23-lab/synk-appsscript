// synkbrief B69 「인터넷에 드러난 내 정보를 ChatGPT로 찾고 지우기」 본편 — 수요 장부 synkbrief 1번(자료 나눔 꼴, 한 사람의 한 가지 일).
// 결: 표지 A 짜임(검정 바탕 · 위 큰 글자 · 아래 실제 화면 · 버터 한 곳 · SUIT 하나)을 첫 화면으로 두고 같은 결로 끝까지 간다.
// 색 꼬리표 · 스티커 · 번호 동그라미 · 색 띠 · 색 상자 · 말풍선 · 고리는 우리가 더하지 않는다(화면 속 초록 · 주황 판정은 ChatGPT 답 그대로다).
// 화면은 모두 2026-11-23 ChatGPT 임시 채팅에서 받은 실제 답(실험 E06)이고, 이름 · 아이디 말고 답에 나온 다른 정보는 재료.py에서 가렸다.
// 움직임은 작게 — 판은 초마다 1~3% 다가가고, 녹화 장면은 실제로 답이 써진 차례대로 바뀐다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import badgeSizes from './badgeSizes.json';
import { S, VO, TAGS, LINES, END_LINES, SOUNDS, FPS, END, N7_AT, REC, COVER_OUT, BADGE_ROWS, totalOf, bgmOf, type Variant } from './timeline';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * FPS);
const INK = '#0E0E0E'; // 찍은 ChatGPT 화면의 바탕색과 같게 — 자른 화면이 바탕에 녹는다
const BUTTER = '#F5C445';
const X = 84;
const MASTER = 0.8; // Remotion은 합친 소리가 0 dBFS를 넘으면 자른다 — 모든 소리에 같은 값을 곱한다
const SHOT_W = 1075; // 찍은 화면 폭(430 × 2.5)
const img = (n: string) => staticFile(`img/${n}.jpg`);

// 재료 그림 크기(재료.py가 자른 값)
const SIZE: Record<string, [number, number]> = {
  bubble: [720, 990], bubble_end: [720, 310], badges: [1004, 572], table: [1020, 1260], order: [1020, 280],
  del_head: [1020, 200], del_rows1: [1020, 570], del_rows2: [1020, 430], excluded: [1020, 940],
};

// 아래 판 — top부터 화면 아래 끝까지(위 가장자리는 검정으로 녹인다). 들어올 때 1.03배에서 내려앉고 천천히 다가간다
const Bleed: React.FC<{ top?: number; drift?: number; origin?: string; fade?: number; children: React.ReactNode }> = ({ top = 760, drift = 0.012, origin = '50% 30%', fade = 60, children }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 8], [1.03, 1], { ...clamp, easing: EASE_OUT }) * (1 + (f / FPS) * drift);
  return (
    <div style={{ position: 'absolute', left: 0, top, width: 1080, height: 1920 - top, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: origin }}>{children}</div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: fade, background: `linear-gradient(to bottom, rgba(14,14,14,1) 0px, rgba(14,14,14,0) ${fade}px)` }} />
    </div>
  );
};

// 잘라 낸 화면 한 장을 (x, y)에 w 폭으로
const Pic: React.FC<{ n: string; x: number; y: number; w: number; opacity?: number; style?: React.CSSProperties }> = ({ n, x, y, w, opacity = 1, style }) => {
  const [iw, ih] = SIZE[n];
  return <Img src={img(n)} style={{ position: 'absolute', left: x, top: y, width: w, height: (ih / iw) * w, display: 'block', opacity, ...style }} />;
};

// ── 민감정보 카드 — 실제 카드의 네 줄을 이름 조각 · 판정 조각으로 잘라 크게 다시 짠다(글 · 색은 받은 화면 그대로)
// 줄 k: 이름은 왼쪽(x 70), 판정 알약은 오른쪽 끝(x 915)에 맞춘다. rows = 줄마다 켜지는 정도(0~1)
// r14: 1010 → 915 · 이름 1.3 → 1.16배 · 알약 1.4 → 1.25배 — 올리기 전 검사 「오른쪽 단추 자리」: 알약이 릴스 · 쇼츠 오른쪽 단추(좋아요 · 댓글) 자리(x 920 밖)에 걸렸다
const RIGHT = 915;
const RS = 1.16;
const MS = 1.25;
const MARK_LIFT = 'brightness(1.35)'; // 판정 알약 — 받은 화면 그대로면 검은 바탕과 밝기 차가 약하다(v3 · v4 첫컷검사 흠). 색과 글은 그대로 두고 밝기만 올린다 // 판정 알약 배율 — 이름보다 조금 크게(v3 첫컷검사 흠: 초록 · 주황 글자가 이름보다 작고 어둡다)
// 줄 배율(가장 긴 둘째 줄 이름 560px × 1.3 = 728 — 판정 알약과 35px 띄움)
const bsz = (n: string) => (badgeSizes as Record<string, number[]>)[n];
const BadgeRow: React.FC<{ k: number; y: number; s?: number; o?: number }> = ({ k, y, s = RS, o = 1 }) => {
  const [lw, lh] = bsz(`badge_label${k}`);
  const [mw, mh] = bsz(`badge_mark${k}`);
  return (
    <div style={{ position: 'absolute', left: 0, top: y, width: 1080, height: lh * s, opacity: o, transform: `translateY(${(1 - o) * 26}px)` }}>
      <Img src={img(`badge_label${k}`)} style={{ position: 'absolute', left: 70, top: 0, width: lw * s, height: lh * s, mixBlendMode: 'lighten' }} />
      <Img src={img(`badge_mark${k}`)} style={{ position: 'absolute', left: RIGHT - mw * MS * (s / RS), top: (lh * s - mh * MS * (s / RS)) / 2, width: mw * MS * (s / RS), height: mh * MS * (s / RS), filter: MARK_LIFT, mixBlendMode: 'lighten' }} />
    </div>
  );
};
const ROW_GAP = 150; // r14: 160 → 150 — 마지막 줄을 앱 글자 자리(y 1428) 위에
// 줄 차례 — 노출 확인 셋(2 · 3 · 4)을 위에, 확인되지 않음(1)을 맨 아래에(장면 심사 v11: 초록 「확인되지 않음」을 먼저 보이면 김이 빠진다). 글 · 색은 받은 화면 그대로
const ORDER = [2, 3, 4, 1];
const BadgeRows: React.FC<{ y: number; rows: number[] }> = ({ y, rows }) => (
  <>
    {ORDER.map((k, i) => <BadgeRow key={k} k={k} y={y + i * ROW_GAP} o={rows[i]} />)}
    {/* 줄 사이 가는 선 — 받은 카드의 칸 선과 같은 결 */}
    {[1, 2, 3].map((i) => <div key={`l${i}`} style={{ position: 'absolute', left: 70, top: y + i * ROW_GAP - 25, width: RIGHT - 70, height: 2, background: 'rgba(255,255,255,0.08)', opacity: Math.min(rows[i - 1], rows[i]) }} />)}
  </>
);

// ── 0 훅: 첫 프레임은 표지와 같은 화면(제목 + 민감정보 네 줄). 2초에 실제 답 화면(제목 · 조사 기준일)으로 바뀐다 ──
// v12: 장면 심사 v11 「첫 1.5초가 움직임 없는 긴 글 상자와 생각 중뿐」 — 말풍선은 훅에서 빼고(요청문은 10.7초부터 크게) 결과 네 줄로 연다
const Hook: React.FC<{ bare?: boolean }> = ({ bare }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const card = t < COVER_OUT ? 1 : 0; // 표지 카드는 0.45초에 끊어 바꾼다(v4 첫컷검사 — 겹쳐 바꾸면 결과 표가 말풍선 위에 잔상으로 남는다)
  // 녹화 — 화면 윗줄 y를 장마다 맞춰 내려가며, 장 사이는 0.12초 겹쳐 바꾼다
  const idx = REC.reduce((a, r, k) => (t >= r.at ? k : a), -1);
  const top = bare ? 0 : 744;
  const H = 1920 - top;
  const scale = 1080 / SHOT_W;
  // 답 화면(rec2)에서는 제목 · 조사 기준일 · 첫 문장(화면 y 600~900)만 남기고 아래를 녹인다 — v3 첫컷검사 #66(본문 여러 문단이 읽히기 전에 넘어간다)
  const ans = idx >= REC.length - 1 && idx >= 0 ? 1 : 0; // 답 화면은 첫 장부터 아래를 녹인 채 뜬다(v13 첫컷검사 — 첫 장에 본문이 보였다가 어두워졌다)
  // 답 화면은 제목이 아래 판의 가운데쯤 오게 둔다(v12 장면 심사 — 위에 붙여 두면 아래가 까맣게 빈다). 심사용(bare)은 위 머리줄(「임시」)까지 보인다
  const ry = (r: { y: number; img: string }) => (r.img === 'rec2' ? (bare ? -60 : 241) : r.y);
  const cut = (722 - ry(REC[REC.length - 1])) * scale; // r7: 답 화면을 키우지 않으므로 1.06을 뺐다 // v16: 답 제목 두 줄만 — 경계를 좁혀 「조사 기준일」이 비치지 않게(v15 첫컷검사 흠) // 제목 두 줄과 조사 기준일만(v8 첫컷검사 #66 — 첫 문장까지 다섯 줄은 1.65초에 다 못 읽는다)
  const keep = ans > 0 ? `linear-gradient(to bottom, #000 0px, #000 ${cut}px, rgba(0,0,0,${1 - ans}) ${cut + 20}px)` : undefined;
  return (
    <AbsoluteFill style={{ background: INK }}>
      <div style={{ position: 'absolute', left: 0, top, width: 1080, height: H, overflow: 'hidden', WebkitMaskImage: keep, maskImage: keep }}>
        {/* 장마다 제 자리(y)에 둔다 — 말풍선 장은 내내 이름 · 아이디가 보이게 움직이지 않고(v4 첫컷검사 #5), 답 장으로 겹쳐 바뀐다 */}
        {REC.map((r, k) => {
          if (k > idx || k < idx - 1) return null;
          if (k < idx) return null; // 장 사이는 끊어 바꾼다(v10 첫컷검사 #5 — 0.12초 겹쳐 바꾸면 말풍선과 답 글이 겹쳐 읽히지 않는다)
          const o = 1;
          const zz = r.img === 'rec2' ? 1 + Math.max(0, t - r.at) * 0.03 : 1.06 + Math.max(0, t - r.at) * 0.012; // v20: 답 화면이 1.8초로 길어져 멈춰 보이지 않게 아주 천천히 — 왼쪽 끝(제목 첫 글자)과 제목 높이를 고정점으로 // r7: 답 화면은 키우지 않는다 — 1.06배면 제목 첫 글자가 왼쪽 끝에 붙어 잘려 보였다(이해 시험 2회 볼 이유 심사)
          return (
            <div key={r.img} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 2330 * scale, opacity: o, transform: `translateY(${-ry(r) * scale}px) scale(${zz})`, transformOrigin: r.img === 'rec2' ? `3.7% ${(650 / 2330) * 100}%` : `50% ${((ry(r) + 300) / 2330) * 100}%` }}>
              <Img src={img(r.img)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 2330 * scale }} />
              {r.img === 'rec0' ? (
                // 말풍선은 첫 문장 네 줄(이름 · 아이디 · 「이 두 가지로 … 찾아 줘.」)만 또렷하게 — v5 첫컷검사 #66: 아홉 줄을 1.5초에 다 읽을 수 없다(v8 #61: 두 줄에서 끊으면 「인터넷을」 낱말 가운데서 끊긴다). 전문은 10.7초부터 크게 다시 나온다
                <div style={{ position: 'absolute', left: 330 * scale, top: 568 * scale, width: 720 * scale, height: (1190 - 568) * scale, background: 'rgba(14,14,14,0.58)', borderRadius: 30 }} />
              ) : r.img === 'rec2' ? (
                // v16 첫컷검사 #66 — 답 화면 1.25초에 요청문 끝 다섯 줄까지 읽을 수 없다 → 말풍선은 어둡게, 제목 두 줄만 또렷하게
                <>
                  <div style={{ position: 'absolute', left: 336 * scale, top: 86 * scale, width: 704 * scale, height: (474 - 86) * scale, background: INK, borderRadius: 30 }} />
                  {/* v19: 심사용(bare)도 본편처럼 머리줄을 가린다 — 본편은 위 큰 글 자리라 머리줄이 안 보인다. v18 첫컷검사 #66 「머리줄까지 1.25초에 읽을 글이 많다」 */}
                  {bare ? <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 100 * scale, background: INK }} /> : null}
                  {/* v20: 오른쪽 끝의 ChatGPT 스크롤 막대(가는 회색 선)도 지운다 — v19 첫컷검사 흠 */}
                  <div style={{ position: 'absolute', left: 1046 * scale, top: 0, width: 40 * scale, height: 2330 * scale, background: INK }} />
                </> // r6: 이해 시험 1회 sonnet · haiku 「3초 흐린 대화 칸이 무엇인지 모름」 → 흐리게가 아니라 지운다
              ) : null}
            </div>
          );
        })}
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 70, background: 'linear-gradient(to bottom, rgba(14,14,14,1), rgba(14,14,14,0))' }} />
      </div>
      {card > 0 ? (
        <div style={{ position: 'absolute', inset: 0, background: INK, opacity: card, transform: `scale(${1 + Math.min(t, COVER_OUT) * 0.02})`, transformOrigin: '50% 62%' }}>
          <BadgeRows y={bare ? 760 : 870} rows={[1, 1, 1, 1]} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// 표지 제목 — 훅 내내 선다(「제 이름이랑 아이디로, 인터넷에 드러난 제 정보를 찾아 달라고 했어요」)
const HookTitle: React.FC = () => {
  const f = useCurrentFrame();
  if (f >= sec(S.badge)) return null;
  const o = interpolate(f, [sec(S.badge) - 3, sec(S.badge)], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 79, top: 352, opacity: o, fontFamily: KO, fontWeight: 800, fontSize: 112, letterSpacing: '-0.045em', lineHeight: 1.1, color: '#fff', whiteSpace: 'nowrap' }}>
      <div>내 이름과 아이디로</div>
      <div>인터넷에 드러난</div>
      <div style={{ color: BUTTER }}>내 정보 찾기</div>
    </div>
  );
};

// ── 1 민감정보 카드 — 줄이 말에 맞춰 켜진다(전화번호 · 집 주소 · 생년월일 「확인되지 않음」 → 사진 · 근무처 · 실명 연결 「노출 확인」) ──
const Badge: React.FC<{ bare?: boolean }> = ({ bare }) => {
  const f = useCurrentFrame();
  const y0 = bare ? 760 : 870;
  const [A, B3, B4, G] = BADGE_ROWS; // 큰 줄이 줄어드는 때 · 근무처 · 실명 연결 · 초록 줄
  const shrink = interpolate(f, [sec(A) - 6, sec(A) + 3], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const pop = (t: number) => interpolate(f, [sec(t), sec(t) + 6], [0, 1], { ...clamp, easing: EASE_OUT });
  // 첫 줄(인물 사진 및 얼굴 관련 이미지 · 노출 확인) — 크게(1.6배, 알약은 그 아래 왼쪽) → 목록 첫 자리(1.3배 한 줄)로
  const [lw, lh] = bsz('badge_label2');
  const [mw, mh] = bsz('badge_mark2');
  const BIG = 1.45; // r14: 1.6이면 큰 「인물 사진」 줄이 x 966까지 가 오른쪽 단추 자리에 걸린다
  const s = BIG + (RS - BIG) * shrink;
  const lx = 70, ly = (y0 + 120) + (y0 - (y0 + 120)) * shrink;
  const mxBig = 70, myBig = y0 + 120 + lh * BIG + 26;
  const mxSmall = RIGHT - mw * MS, mySmall = y0 + (lh * RS - mh * MS) / 2;
  const z = 1 + (f / FPS) * 0.01;
  const rows = [1, pop(B3), pop(B4), pop(G)];
  return (
    <AbsoluteFill style={{ background: INK }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: '50% 62%' }}>
        {ORDER.slice(1).map((k, i) => <BadgeRow key={k} k={k} y={y0 + (i + 1) * ROW_GAP} o={rows[i + 1]} />)}
        {[1, 2, 3].map((i) => <div key={`l${i}`} style={{ position: 'absolute', left: 70, top: y0 + i * ROW_GAP - 25, width: RIGHT - 70, height: 2, background: 'rgba(255,255,255,0.08)', opacity: rows[i] }} />)}
        <Img src={img('badge_label2')} style={{ position: 'absolute', left: lx, top: ly, width: lw * s, height: lh * s, mixBlendMode: 'lighten' }} />
        {/* 판정 알약은 옮겨 가지 않고 큰 자리에서 사라졌다가 작은 자리에 뜬다 — 옮겨 가면 줄어드는 이름 위를 지나간다(v6) */}
        <Img src={img('badge_mark2')} style={{ position: 'absolute', left: mxBig, top: myBig, width: mw * BIG, height: mh * BIG, filter: MARK_LIFT, mixBlendMode: 'lighten', opacity: 1 - Math.min(1, shrink * 2) }} />
        <Img src={img('badge_mark2')} style={{ position: 'absolute', left: mxSmall, top: mySmall, width: mw * MS, height: mh * MS, filter: MARK_LIFT, mixBlendMode: 'lighten', opacity: Math.max(0, (shrink - 0.82) / 0.18) }} />
      </div>
    </AbsoluteFill>
  );
};

// ── 2 위험도순 표 — 실제 표(둘째 줄 정보 칸은 가림). 위에서 아래로 한 줄씩 내려가며 보인다 ──
// r6: 이해 시험 1회 sonnet · GPT 「8~10초 표 글자가 작아 못 읽음」 → 머리줄과 위 네 줄(높음 둘 · 중간 둘)만, 판단 칸을 빼고 1.22배로
const TB = { x0: 0, y0: 110, x1: 855, y1: 900 };
const Table: React.FC = () => {
  const f = useCurrentFrame();
  const k = 1040 / (TB.x1 - TB.x0);
  const h = (TB.y1 - TB.y0) * k;
  const reveal = interpolate(f, [2, sec(1.2)], [140, h + 40], { ...clamp, easing: Easing.out(Easing.cubic) });
  const mask = `linear-gradient(to bottom, #000 ${reveal - 40}px, transparent ${reveal + 40}px)`;
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Bleed top={744} drift={0.012} origin="40% 20%">
        <div style={{ position: 'absolute', left: 20, top: 36, width: 1040, height: h, overflow: 'hidden', WebkitMaskImage: mask, maskImage: mask }}>
          <Img src={img('table')} style={{ position: 'absolute', left: -TB.x0 * k, top: -TB.y0 * k, width: 1020 * k, height: 1260 * k }} />
        </div>
      </Bleed>
    </AbsoluteFill>
  );
};

// 보낸 말풍선의 몇 줄만 잘라 크게 — 잘린 자리가 보이지 않게 같은 바탕색 · 점선 테두리의 상자에 담는다(r6: 이해 시험 1회 haiku · GPT · opus 「긴 요청문이 작고 아래가 잘린다」)
const BUB = '#2D2D2D';
const BubbleCrop: React.FC<{ y0: number; y1: number; top: number; k?: number; opacity?: number }> = ({ y0, y1, top, k = 1.5, opacity = 1 }) => {
  const x0 = 40, x1 = 682, pad = 34; // r12: 682 — 690이면 원래 말풍선 오른쪽 위 둥근 모서리 밖 검정 점이 잡혔다
  const w = (x1 - x0) * k, h = (y1 - y0) * k;
  return (
    <div style={{ position: 'absolute', left: (1080 - w - pad * 2) / 2, top, width: w + pad * 2, height: h + pad * 2, background: BUB, borderRadius: 52, border: '3px dashed rgba(255,255,255,0.32)', boxSizing: 'border-box', overflow: 'hidden', opacity }}>
      <div style={{ position: 'absolute', left: pad - 3, top: pad - 3, width: w, height: h, overflow: 'hidden' }}>
        <Img src={img('bubble')} style={{ position: 'absolute', left: -x0 * k, top: -y0 * k, width: 720 * k, height: 990 * k }} />
      </div>
    </div>
  );
};

// ── 3 보낸 요청문 — 실제로 보낸 말풍선을 크게 ──
// 말로 읽는 첫 문장(이름 · 아이디 · 「이 두 가지로 … 찾아 줘」) 네 줄만 크게. 번호 1~3 줄은 아래 글에 있다
// r10: 말에 맞춰 줄이 늘어난다 — 두 줄(이름 · 아이디) → 「인터넷을」(12.99)에 셋째 줄 → 「드러난」(15.07)에 넷째 줄. 올리기 전 검사 ⑬ 한 구성 5.5초를 나눈다
const ASK_LINES = [{ at: 0, y1: 168 }, { at: 12.99, y1: 233 }, { at: 15.07, y1: 300 }];
const Ask: React.FC = () => {
  const f = useCurrentFrame();
  const t = S.ask + f / FPS;
  const y1 = ASK_LINES.filter((l) => t >= l.at).slice(-1)[0].y1;
  return (
  <AbsoluteFill style={{ background: INK }}>
    {/* r9: 다가감 0.01 → 0.024(올리기 전 검사 ② 11.5~16초가 멈춤으로 잡힘 · ⑬ 한 구성 5.5초). 끝까지 다가가도 글이 안 잘리게 1.4배로 */}
    <Bleed top={760} drift={0.035} origin="50% 33%" fade={20}>
      <BubbleCrop y0={32} y1={y1} top={170} k={1.28} />
    </Bleed>
  </AbsoluteFill>
  );
};

// ── 4 꼭 붙일 한 줄 — 말풍선 끝 두 줄로 다가간 뒤(16.35), 실제로 뺀 목록(18.07 · 목록은 가림) ──
const Line: React.FC = () => {
  const f = useCurrentFrame();
  const ex = sec(S.lineEx - S.line);
  const zin = interpolate(f, [0, 6], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill style={{ background: INK }}>
      {f < ex ? (
        <Bleed top={760} drift={0.045} origin="50% 29%" fade={20}>
          {/* 꼭 붙일 마지막 두 줄만 같은 상자에 크게 · r9 다가감 0.035 */}
          <BubbleCrop y0={822} y1={950} top={200} opacity={zin} />
        </Bleed>
      ) : (
        <Sequence from={ex} layout="none">
          {/* r6: 이해 시험 1회 haiku · GPT 「흐린 목록을 못 읽음」 → 가린 목록은 빼고 답의 제목과 첫 문장만 */}
          <Bleed top={744} drift={0.042} origin="50% 29%" fade={20}>
            <div style={{ position: 'absolute', left: 55, top: 238, width: 970, height: 202, overflow: 'hidden' }}>
              <Pic n="excluded" x={0} y={0} w={970} />
            </div>
          </Bleed>
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

// ── 5 지우는 곳 — 실제 창구 표(20.35), 그다음 원본부터라는 답의 문단을 크게(21.7) ──
const Del: React.FC = () => {
  const f = useCurrentFrame();
  const ord = sec(S.delOrder - S.del);
  return (
    <AbsoluteFill style={{ background: INK }}>
      {/* r7: 창구 표는 뺐다 — 이해 시험 2회 셋 모두 「21초 표 글자가 작고 빨리 지나간다」. 지우는 곳 다섯은 끝 화면에 크게 보인다 */}
      {ord < 0 ? null : (
        <Sequence from={0} layout="none">
          <Bleed top={760} drift={0.03} origin="50% 34%" fade={20}>
            {/* 원본부터라는 문단만 — 끝의 출처 칩(「Google Sear… +2」)은 덮는다(이해 시험 1회 haiku 「잘려 못 읽음」) */}
            <div style={{ position: 'absolute', left: 70, top: 270, width: 940, height: 258 }}>
              <Pic n="order" x={0} y={0} w={940} />
              <div style={{ position: 'absolute', left: 459, top: 184, width: 258, height: 65, background: INK }} />
            </div>
          </Bleed>
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

// ── 끝: 지우는 곳 다섯(자료의 3단계 그대로) — r6: 이해 시험 1회 셋 모두 「처음 표로 돌아가 안내로 끝나 흐지부지」, haiku · GPT 「끝 카드가 지난 편과 같다」 ──
// r7: 이름마다 하는 일을 한 줄 — 이해 시험 2회 sonnet · GPT 「구글 두 곳의 차이를 모름」, haiku · GPT 「118이 무엇인지 모름」
const END_LIST: [string, string][] = [
  ['원본 사이트 관리자', '올라간 쪽에서 먼저 지워요'],
  ['구글 「결과 삭제」', '검색 결과 하나를 빼요'],
  ['구글 「나와 관련된 검색 결과」', '내 연락처가 검색되는지 알려 줘요'],
  ['네이버 권리보호센터', '사진 · 사생활 게시물을 신고해요'],
  ['개인정보침해 신고센터 118', '안 지워 주면 신고해요'],
];
const End: React.FC = () => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 8], [1.03, 1], { ...clamp, easing: EASE_OUT }) * (1 + (f / FPS) * 0.012);
  const o = interpolate(f, [0, 6], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill style={{ background: INK }}>
      <div style={{ position: 'absolute', left: X, top: 700, transform: `scale(${z})`, transformOrigin: '0% 30%', opacity: o, fontFamily: KO, letterSpacing: '-0.035em', color: '#fff', whiteSpace: 'nowrap' }}>
        {END_LIST.map(([t, d], i) => (
          // r8: SNS 안전 영역(x 920 · y 1428 안) — 다섯 줄을 1428 위에, 가장 긴 셋째 줄을 920 안에
          <div key={i} style={{ height: 144, display: 'flex', alignItems: 'flex-start' }}>
            <span style={{ width: 58, opacity: 0.5, fontWeight: 600, fontSize: 56, lineHeight: 1.1 }}>{i + 1}</span>
            <span>
              <div style={{ fontWeight: 700, fontSize: 56, lineHeight: 1.1 }}>{t}</div>
              <div style={{ fontWeight: 500, fontSize: 38, lineHeight: 1.3, opacity: 0.62, marginTop: 6 }}>{d}</div>
            </span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// 줄 안의 [ ] = 버터 글자
const rich = (l: string) => l.split(/(\[[^\]]+\])/).map((p, k) => (p.startsWith('[') ? <span key={k} style={{ color: BUTTER }}>{p.slice(1, -1)}</span> : <React.Fragment key={k}>{p}</React.Fragment>));

// 큰 글자가 곧 말 — 첫 줄은 구성이 바뀌는 첫 프레임부터 서 있고, 다음 줄부터 28px 올라오며 뜬다
const BigBlock: React.FC<{ lines: string[]; at: number[]; size: number }> = ({ lines, at, size }) => {
  const f = useCurrentFrame();
  const first = sec(at[0]);
  return (
    <div style={{ position: 'absolute', left: X, top: 352, fontFamily: KO, fontWeight: 800, fontSize: size, letterSpacing: '-0.045em', lineHeight: size >= 110 ? 1.1 : 1.16, color: '#fff', whiteSpace: 'nowrap' }}>
      {lines.map((s, k) => {
        const a = sec(at[k]);
        const p = a <= first ? 1 : interpolate(f, [a - 2, a + 4], [0, 1], { ...clamp, easing: EASE_OUT });
        return <div key={k} style={{ opacity: p, transform: `translateY(${(1 - p) * 28}px)` }}>{rich(s)}</div>;
      })}
    </div>
  );
};
const Big: React.FC<{ v: Variant }> = ({ v }) => {
  const f = useCurrentFrame();
  const ctaAt = N7_AT + END[v].ctaAt;
  if (f >= sec(ctaAt)) return <BigBlock lines={END[v].cta} at={[ctaAt, ctaAt + 0.35]} size={END[v].ctaSize} />;
  if (f >= sec(S.end)) return <BigBlock lines={END_LINES.lines} at={END_LINES.at} size={END_LINES.size} />;
  const l = LINES.find((x) => f >= sec(x.from) && f < sec(x.to));
  return l ? <BigBlock lines={l.lines} at={l.at} size={l.size} /> : null;
};

// 위 작은 줄 — 굵은 낱말 + 옅은 설명. bar = 둘 사이에 가는 선(한 문장으로 붙어 읽히지 않게)
const Tag: React.FC = () => {
  const f = useCurrentFrame();
  const g = TAGS.find((x) => f >= sec(x.from) && f < sec(x.to));
  if (!g) return null;
  const size = g.size ?? 40;
  return (
    <div style={{ position: 'absolute', left: X, top: size === 34 ? 292 : 286, fontFamily: KO, fontWeight: 700, fontSize: size, letterSpacing: '0.01em', lineHeight: 1.2, color: '#fff', whiteSpace: 'nowrap' }}>
      {g.b}
      {g.bar ? <span style={{ display: 'inline-block', width: 2, height: 30, margin: '0 20px', background: 'rgba(255,255,255,0.42)', verticalAlign: '-3px' }} /> : null}
      {g.i ? <span style={{ fontWeight: 500, opacity: size === 34 ? 0.7 : 0.74, marginLeft: g.bar ? 0 : 16 }}>{g.i}</span> : null}
    </div>
  );
};

const Sound: React.FC<{ v: Variant; bare?: boolean }> = ({ v, bare }) => {
  const total = totalOf(v);
  const bgm = bgmOf(total);
  return (
    <>
      <Audio src={staticFile('bgm.wav')} volume={(fr) => interpolate(fr, bgm.t.map(sec), bgm.v, clamp) * MASTER} />
      {bare ? null : [...VO, { id: END[v].vo, t: N7_AT }].map((o, i) => (
        <Sequence key={i} from={sec(o.t)}>
          <Audio src={staticFile(`vo/${o.id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {SOUNDS.map((s, i) => (
        <Sequence key={`s${i}`} from={Math.max(0, sec(s.t))} durationInFrames={45}><Audio src={staticFile(s.src)} volume={s.vol * MASTER} /></Sequence>
      ))}
      {bare ? null : <Sequence from={sec(N7_AT + END[v].ctaAt + 0.35)} durationInFrames={45}><Audio src={staticFile('sfx/thud.wav')} volume={0.26 * MASTER} /></Sequence>}
    </>
  );
};

const Seq: React.FC<{ a: number; b: number; children: React.ReactNode }> = ({ a, b, children }) => (
  <Sequence from={sec(a)} durationInFrames={sec(b) - sec(a)}>{children}</Sequence>
);

// bare = 한 장면 심사용(제목 · 큰 글 · 작은 줄 · 말 없이 그 장면의 화면과 소리만)
export const Film: React.FC<{ v: Variant; bare?: boolean }> = ({ v, bare }) => (
  <AbsoluteFill style={{ background: INK }}>
    <Seq a={S.hook} b={S.badge}><Hook bare={bare} /></Seq>
    <Seq a={S.badge} b={S.table}><Badge bare={bare} /></Seq>
    <Seq a={S.table} b={S.ask}><Table /></Seq>
    <Seq a={S.ask} b={S.line}><Ask /></Seq>
    <Seq a={S.line} b={S.del}><Line /></Seq>
    <Seq a={S.del} b={S.end}><Del /></Seq>
    <Seq a={S.end} b={totalOf(v)}><End /></Seq>
    {bare ? null : <><HookTitle /><Big v={v} /><Tag /></>}
    <Sound v={v} bare={bare} />
  </AbsoluteFill>
);
