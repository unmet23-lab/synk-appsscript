// 문제 한 판(v6, 2026-11-10). 화면 글은 모두 안전 영역(x 65~920 · y 269~1428 — 올리기 전 검사 ⑤) 안에 둔다.
//
// 한 판의 흐름 — 장면 카드(폭 855)가 처음부터 끝까지 화면 가운데 크게 남는다:
//   글자 그대로  한국어 제목(목소리) + 다리 글 “글자 그대로 옮긴 말” + 글자 그대로 장면(웃음이 있는 곳에서 한 장 전체로 빠지고,
//                둘째 박에 장면 속 사건 — 둘째 컷이나 움직임) → 장면 아래 가장자리에 띠 한 줄
//   보기         제목 · 다리 글이 작아져 위에 남고(고르는 동안에도 글자 그대로의 말이 보인다) 장면은 큰 채로, 그 아래 보기
//                킥이 멈춘 박에 띠가 「셋 = 3」 · 「둘 = 2」 · 「하나 = 1」(한국어 목소리)로 바뀐다 — 장면 속 인물을 가리지 않는다
//   정답         정답 보기가 초록으로 → 장면 카드가 뒤집혀 뜻 장면(앞면 = 글자 그대로, 뒷면 = 진짜 뜻)
//   뜻           「관용구 = 뜻」 + 뜻 장면(귀퉁이에 때 · 곳 이름표) + 따라 말하기(해요체 한국어 목소리 · 소리 적기 · 그 문장의 뜻)
// 문제마다 꼴이 다르다(박자표 kind): three = 보기 셋 + 「이제 네가 말해!」, duel = 큰 카드 둘 · 둘 하나,
// ox = 「맞을까 틀릴까」 — 함정 뜻 하나(「= …?」)에 ✓ · ✗, 답은 늘 ✗(「아니야!」) → 장면이 뒤집혀 진짜 뜻.
//   (v6a · v6b 시험: 셋째 문제에서 「앞의 두 문제와 같은 틀이라 지루」 — 보기 고르기를 세 번 하지 않는다)
//
// v5와 달라진 까닭(시험 · 맹검이 짚은 것):
//   · 보기 동안 장면이 600×450으로 줄었다 → 폭 855 그대로(볼 이유 심사 「2.5초부터 작은 칸으로 줄어든다」)
//   · 3 · 2 · 1 배지가 장면 속 고양이 머리를 가렸다(미학 맹검) → 띠 안으로
//   · 만화 글자(두꺼운 테) · 두꺼운 테 보기 상자 · O 도장(미학 맹검 「구식 학습지」) → 테 없는 글자와 색 판
//   · 글이 한 번에 툭 뜬다(미학 맹검) → 줄마다 짧게 오른다
//   · 「되다 → 됐어요」 말끝이 왜 바뀌는지(GPT · 그록) → 바뀐 말끝에 색 + 그 문장의 뜻 한 줄(LAB 몽골 판 꼴 — 한글 · 키릴 읽기 · 몽골 뜻 세 줄)
//   · 소리 적기가 「몽골어가 아니고 작다」(그록) → 앞에 소리 표시, 글자를 키움
//   · v6a 시험(s · h · K): 「글자 그대로 옮기면:」 머리와 보기 동안의 작은 다리 글이 작아 못 읽었다 → 키움
import React from 'react';
import { AbsoluteFill, interpolate, interpolateColors, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Burst, clamp, EASE_OUT } from './anim';
import { shotsOf, type LocQuestion, type Question as Q } from './episode';
import { fitBox, type LangProfile } from './lang';
import { Scene } from './Scene';
import { B, qT, QS } from './timeline';
import { K, plate, stitch, type } from './theme';
import type { Ui } from './ui';

export const SAFE = { l: 65, r: 920, t: 269, b: 1428 };
export const W = SAFE.r - SAFE.l; // 855
const CX = (SAFE.l + SAFE.r) / 2;
const TOP = 352; // 위 알약(HUD) 아래 첫 줄

export const emOf = (s: string) => [...s].reduce((w, c) => w + (c === ' ' ? 0.28 : 1), 0);
const ease = (f: number, a: number, len: number) => interpolate(f, [a, a + len], [0, 1], { ...clamp, easing: EASE_OUT });
/** 줄 단위로 짧게 오른다(영상 글자 모션 — 한 번에 툭 뜨지 않게). */
const rise = (p: number, dist = 26): React.CSSProperties => ({ opacity: Math.min(1, p * 1.7), translate: `0 ${(1 - p) * dist}px` });

/** 한국어 제목 — 8.5em(한글 8자 남짓)을 넘으면 띄어쓰기에서 두 줄로(「사공이 많으면 / 배가 산으로 간다」). */
export const titleLines = (idiom: string): string[] => {
  if (emOf(idiom) <= 8.5) return [idiom];
  const words = idiom.split(' ');
  let best: string[] = [idiom];
  let bestW = Infinity;
  for (let i = 1; i < words.length; i++) {
    const pair = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
    const w = Math.max(...pair.map(emOf));
    if (w < bestW) [best, bestW] = [pair, w];
  }
  return best;
};

/** 해요체에서 말끝이 바뀐 곳 — 「파김치가 되다」 · 「파김치가 됐어요」 → 앞 「파김치가 」 · 바뀐 말 「됐어요」.
 *  낱말째 색을 준다(「무거워요」). 명사로 끝나는 관용구는 끝 낱말(「떡이에요」). */
export const sayParts = (idiom: string, say: string) => {
  let best = { i: 0, n: 0 };
  for (let i = 0; i < idiom.length; i++) {
    let n = 0;
    while (i + n < idiom.length && n < say.length && idiom[i + n] === say[n]) n++;
    if (n > best.n) best = { i, n };
  }
  const n = say[best.n - 1] === ' ' ? best.n : say.lastIndexOf(' ', Math.max(0, best.n - 1)) + 1;
  return { head: say.slice(0, n), tail: say.slice(n) };
};

const Lines: React.FC<{ lines: string[]; style: React.CSSProperties; align?: 'left' | 'center' }> = ({ lines, style, align = 'center' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start' }}>
    {lines.map((l, i) => (
      <span key={i} style={{ whiteSpace: 'nowrap', ...style }}>{l}</span>
    ))}
  </div>
);

const Check: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={color} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
);
/** 초시계 — 셈 동안 남은 몫(left 1 → 0)이 산호색 부채꼴로 줄어든다(v6f). */
const Stopwatch: React.FC<{ size: number; left: number }> = ({ size, left }) => {
  const a = Math.max(0, Math.min(1, left)) * 2 * Math.PI;
  const r = 8.2;
  const x = 12 + r * Math.sin(a), y = 13.5 - r * Math.cos(a);
  const arc = left >= 0.999 ? `M12 13.5m0 -${r}a${r} ${r} 0 1 1 0 ${2 * r}a${r} ${r} 0 1 1 0 -${2 * r}z` : `M12 13.5L12 ${13.5 - r}A${r} ${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x} ${y}z`;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ flex: `0 0 ${size}px` }}>
      <rect x={10} y={1.2} width={4} height={2.6} rx={1} fill={K.navy} />
      <circle cx={12} cy={13.5} r={10} fill={K.paper} stroke={K.navy} strokeWidth={2.2} />
      {left > 0.001 ? <path d={arc} fill={K.coral} /> : null}
    </svg>
  );
};
const Speaker: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} style={{ flex: `0 0 ${size}px` }}>
    <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill={color} />
    <path d="M15.2 9a4.2 4.2 0 010 6M17.8 6.6a7.6 7.6 0 010 10.8" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </svg>
);

/** 따라 말하기 판 높이 — 뜻 단계가 아래에서 위로 쌓을 때 쓴다. */
const sayHeight = (label: boolean, mean: number, readLines: number, readSize: number) => 16 + (label ? 58 : 0) + 74 + readLines * readSize * 1.16 + (mean ? mean * 1.3 + 4 : 0) + 18;

export const Question: React.FC<{ q: Q; index: number; ui: Ui; prof: LangProfile; loc: LocQuestion }> = ({ q, index, ui, prof, loc }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spec = QS[index];
  const T = qT(index);
  const duel = spec.kind === 'duel';
  const ox = spec.kind === 'ox';
  const trap = q.trap ?? [0, 1, 2].find((k) => k !== q.correct) ?? 0;
  const show: number[] = duel ? q.show ?? [0, 1] : ox ? [trap] : [0, 1, 2];

  const morph = ease(f, T.board, 8); // 글자 그대로 → 보기
  const toMean = ease(f, T.flip, 10); // 보기 → 뜻
  const enter = index === 0 ? 1 : ease(f, 0, 7);

  // ── 글자 그대로: 제목 · 다리 글 · 장면 ───────────────────────────────────
  const tl = titleLines(q.idiom);
  const titleSize = Math.min(tl.length > 1 ? 92 : 118, Math.floor(830 / Math.max(...tl.map(emOf))));
  const titleH = tl.length * titleSize * 1.1;
  // v6d: 「글자 그대로 옮기면:」 머리를 키웠다 — v6a haiku · 그록이 둘 다 「제목 아래 작은 몽골어 줄을 못 읽었다」(한 문장의 「글자 그대로가 아니다」를 이 줄이 맡는다)
  const labelFit = fitBox(ui.bridgeLabel, prof, 800, 52, 36, 1);
  const labelH = spec.label ? labelFit.size * 1.3 + 2 : 0;
  const lit = fitBox(`“${loc.literal}”`, prof, 810, 58, 38, 2);
  const litH = lit.lines.length * lit.size * 1.14;
  const hookCardTop = Math.round(TOP + titleH + 8 + labelH + litH + 18);
  // v6f: 글자 그대로 장면은 화면 폭 가득(1080) — v6d 볼 이유 심사 「1.5초 산 위의 배가 글 네 줄이 얹힌 작은 카드 안이라 눈에 박히지 않는다」(학교) ·
  //   한 장면 심사 「화면의 3분의 2가 빈 바탕」(ㅂ셋). 띠(장면 아래 가장자리에 걸친다)가 안전 영역(아래 1428)에 들게 높이는 1386 − 위.
  const hookCardH = Math.round(Math.min(810, 1386 - hookCardTop));

  // ── 보기: 제목 · 다리 글은 작게 위에, 장면은 큰 채로, 아래 보기 ─────────────
  const sTitle = Math.min(62, Math.floor(820 / emOf(q.idiom)));
  const sLit = fitBox(`“${loc.literal}”`, prof, 820, 50, 36, 2); // v6d: 44 → 50(v6a sonnet 「4~12초 윗줄 작은 번역 글씨」)
  const sLitTop = TOP + sTitle * 1.16;
  const boardCardTop = Math.round(sLitTop + sLit.lines.length * sLit.size * 1.14 + 14);
  const BTN = { h: 124, gap: 16 }; // v6e: 112 → 124 · 글 46 → 50(v6d sonnet 「4초 뒤 보기 글씨가 작다」)
  const OX = { card: 128, gap: 18, btn: 168 };
  const optsH = duel ? 292 : ox ? OX.card + OX.gap + OX.btn : 3 * BTN.h + 2 * BTN.gap;
  const optsTop = SAFE.b - optsH;
  const boardCardH = optsTop - 70 - boardCardTop; // 띠(높이 84)가 장면 아래 가장자리에 걸친다 · v6f: 54 → 70(맹검 「노란 알약이 A 보기 윗변에 여백 없이 맞닿는다」)

  // ── 뜻: 「관용구 = 뜻」 · 뜻 장면 · 따라 말하기 ─────────────────────────────
  const correctText = loc.options[q.correct];
  const meaningFit = fitBox(`= ${correctText}`, prof, 770, 54, 36, 2);
  const pillTop = Math.round(TOP + sTitle * 1.16 + 6);
  const pillH = meaningFit.lines.length * meaningFit.size * 1.14 + 22;
  const sp = sayParts(q.idiom, q.say);
  const readFit = fitBox(loc.reading, prof, 690, 54, 38, 2); // v6f: 50 → 54(v6d · v6f0 그록 「파란 칸 발음이 작다」)
  const sayMean = loc.sayMean ? fitBox(`= ${loc.sayMean}`, prof, 780, 46, 34, 1) : null;
  const sayH = sayHeight(spec.label, sayMean ? sayMean.size : 0, readFit.lines.length, readFit.size);
  const sayTop = SAFE.b - 4 - sayH;
  const meanCardTop = pillTop + pillH + (loc.when ? 58 : 36); // v6e: 때 이름표가 칸 위 가장자리에 걸친다 · v6f: 칸 위로 거의 다 올려(칸 안으로 12px만) 장면 속 머리를 안 덮게 — 칸을 22px 내렸다
  const meanCardH = sayTop - 22 - meanCardTop;

  const cardTop = interpolate(toMean, [0, 1], [interpolate(morph, [0, 1], [hookCardTop, boardCardTop]), meanCardTop]);
  const cardH = interpolate(toMean, [0, 1], [interpolate(morph, [0, 1], [hookCardH, boardCardH]), meanCardH]);
  const cardX = interpolate(morph, [0, 1], [0, SAFE.l]); // 글자 그대로(폭 가득) → 보기부터 폭 855
  const cardW = interpolate(morph, [0, 1], [1080, W]);
  const cardR = interpolate(morph, [0, 1], [0, 36]);

  // 장면 카드가 뒤집힌다 — 앞면 글자 그대로, 뒷면 뜻
  const flipP = interpolate(f, [T.flip, T.flip + 10], [0, 1], clamp);
  const back = flipP >= 0.5;
  const angle = back ? (flipP - 1) * 180 : flipP * 180;
  const flipScale = 1 - 0.06 * Math.sin(Math.PI * flipP);
  const meanAt = T.flip + 5;

  // ── 띠 한 줄: 첫 문제 「하지만 뜻은 전혀 달라요!」 · 둘째 「둘 중 하나를 골라요!」 · 셋째 「마지막 건 속지 마세요!」
  //     → 킥이 멈춘 박에 「셋 = 3」 · 「둘 = 2」 · 「하나 = 1」 → 정답에 「맞아요!」
  const bandBase = spec.kind === 'three' ? ui.but : duel ? ui.duelHook : ui.hooks[1];
  const rightText = ox ? ui.stamp : ui.right; // 「맞을까 틀릴까」의 답은 ✗ — 「맞아요!」가 아니라 「아니야!」
  const counting = f >= T.count[0] && f < T.reveal;
  const ci = counting ? T.count.filter((c) => f >= c).length - 1 : 0;
  const countN = T.count.length - ci; // 3 · 2 · 1(둘째 문제는 2 · 1)
  const countKo = ui.koCount[ui.koCount.length - countN];
  const right = f >= T.reveal;
  const bandFit = fitBox(right ? rightText : bandBase, prof, 770, right ? 56 : 50, 30, 1);
  const bandIn = ease(f, T.band, 8);
  const tick = counting ? T.count[ci] : T.reveal;
  const bandPop = counting || right ? 1 + 0.16 * Math.exp(-(f - tick) / 3.2) : 1;
  // v6f: 첫 문제의 셈 동안 띠 둘째 줄에 「3초 안에 맞혀 봐요!」(퀴즈 #6 · #7에서 세 겹을 거친 글) + 줄어드는 초시계 —
  //   「셋 · 둘 · 하나가 무엇을 세는지」(v6d 음식 haiku · 그록, ㅂ셋 sonnet · haiku — 같은 자리 둘째). 둘째 · 셋째 문제는 초시계만.
  const hint = spec.kind === 'three' && counting;
  const hintFit = fitBox(ui.countLabel, prof, 640, 34, 26, 1);
  const bandH = hint ? 84 + Math.round(hintFit.size * 1.2) + 2 : 84;
  const bandTop = cardTop + cardH - 42 - (bandH - 84);
  const clock = counting ? Math.min(1, (f - T.count[0]) / Math.max(1, T.reveal - T.count[0])) : 0;

  // ── 정답 ─────────────────────────────────────────────────────────────
  const reveal = interpolate(f, [T.reveal, T.reveal + 5], [0, 1], clamp);
  const pos = show.indexOf(q.correct);
  const DW = (W - 22) / 2;
  const burstX = duel ? SAFE.l + pos * (DW + 22) + DW / 2 : ox ? SAFE.l + DW + 22 + DW / 2 : CX;
  const burstY = duel ? optsTop + optsH / 2 : ox ? optsTop + OX.card + OX.gap + OX.btn / 2 : optsTop + pos * (BTN.h + BTN.gap) + BTN.h / 2;
  const whenIn = ease(f, meanAt + 4, 8);
  // 고르는 동안 박마다 보기 하나씩 불이 옮겨 간다(어느 것일까 — 게임 쇼의 불빛). 보기가 다 뜬 다음 박부터 정답 전까지
  const scanFrom = (T.opts[T.opts.length - 1] ?? T.board) + B;
  const scanOn = f >= scanFrom && f < T.reveal;
  const scanIdx = scanOn ? Math.floor((f - scanFrom) / B) % (ox ? 2 : show.length) : -1;
  const scanP = scanOn ? Math.min(1, ((f - scanFrom) % B) / 4) : 0;

  return (
    <AbsoluteFill>
      {/* 큰 제목(한국어) — 보기 단계에서 작은 제목으로 넘어간다 */}
      <div style={{ position: 'absolute', left: SAFE.l, width: W, top: TOP, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: (1 - morph) * Math.min(1, enter * 2), translate: `0 ${(1 - enter) * 30 - morph * 24}px`, scale: `${1 - 0.2 * morph}`, transformOrigin: '50% 0%' }}>
        {tl.map((line, li) => (
          <span key={li} style={{ whiteSpace: 'nowrap', ...type(titleSize, { weight: 900, line: 1.1 }) }}>{line}</span>
        ))}
      </div>
      <div style={{ position: 'absolute', left: SAFE.l, width: W, top: TOP, display: 'flex', justifyContent: 'center', opacity: morph, translate: `0 ${(1 - morph) * 18}px` }}>
        <span style={{ whiteSpace: 'nowrap', ...type(sTitle, { weight: 900 }) }}>{q.idiom}</span>
      </div>

      {/* 다리 글: (첫 문제만) 「글자 그대로 옮기면:」 + “글자 그대로의 말” — 보기 동안에도 작게 남는다 */}
      <div style={{ position: 'absolute', left: SAFE.l, width: W, top: TOP + titleH + 8, opacity: (1 - morph) * (index === 0 ? 1 : Math.min(1, ease(f, 3, 8) * 1.7)), translate: `0 ${index === 0 ? 0 : (1 - ease(f, 3, 8)) * 26}px` }}>
        {spec.label ? (
          <div style={{ display: 'flex', justifyContent: 'center', height: labelH }}>
            <span style={{ whiteSpace: 'nowrap', ...type(labelFit.size, { font: 'loc', color: K.butter, weight: 700 }) }}>{ui.bridgeLabel}</span>
          </div>
        ) : null}
        <Lines lines={lit.lines} style={type(lit.size, { font: 'loc', weight: 800 })} />
      </div>
      <div style={{ position: 'absolute', left: SAFE.l, width: W, top: sLitTop, opacity: morph * (1 - toMean) }}>
        <Lines lines={sLit.lines} style={type(sLit.size, { font: 'loc', weight: 700, color: 'rgba(255, 246, 220, 0.9)' })} />
      </div>

      {/* 장면 카드 — 앞면 글자 그대로, 정답 뒤 뒤집혀 뜻 장면 */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `perspective(1800px) rotateY(${angle}deg) scale(${flipScale * (0.94 + 0.06 * enter)})`, transformOrigin: `${CX}px ${cardTop + cardH / 2}px` }}>
        {back ? (
          <Scene shots={shotsOf(q.art.meaning)} moves={q.art.moves?.meaning} t={f - meanAt} fps={fps} x={SAFE.l} y={cardTop} w={W} h={cardH} beat2={(T.say - meanAt) / B} pull={false} />
        ) : (
          <Scene shots={shotsOf(q.art.literal, q.art.focus)} moves={q.art.moves?.literal} t={f - (index === 0 ? 0 : 2)} fps={fps} x={cardX} y={cardTop} w={cardW} h={cardH} beat2={spec.beat2} radius={cardR} />
        )}
      </div>
      {/* 뜻 장면 귀퉁이의 때 · 곳 이름표(일기장 날짜 딱지처럼 — 뜻 장면 셋이 한 사람의 하루로 이어진다) */}
      {loc.when && back ? (
        <div style={{ position: 'absolute', ...(q.art.whenRight ? { right: 1080 - SAFE.r + 28 } : { left: SAFE.l + 28 }), top: cardTop - 50, ...plate(K.paper, 12, 4), padding: '5px 18px 7px', rotate: q.art.whenRight ? '3deg' : '-3deg', ...rise(whenIn, 14) }}>{/* v6f: whenRight — 그 뜻 장면의 왼쪽 위에 인물 머리가 있으면 오른쪽에(v6f0 학교 맹검 03 「라벨이 뒷줄 곰의 머리 · 귀를 덮는다」) */}{/* v6e: 장면 칸 위 가장자리에 걸친 딱지 — 칸 안 왼쪽 위에 두니 곰 선생님 머리를 덮었다(v6d 미학 맹검 03) */}
          <span style={{ ...type(44, { font: 'loc', weight: 800, color: K.navy }), whiteSpace: 'nowrap' }}>{loc.when}</span>
        </div>
      ) : null}

      {/* 보기 */}
      {f >= T.board && toMean < 1 ? (
        <div style={{ position: 'absolute', left: SAFE.l, top: optsTop, width: W, height: optsH, opacity: 1 - toMean, translate: `0 ${toMean * 26}px` }}>
          {ox ? <OxBoard f={f} T={T} text={`= ${loc.options[trap]}?`} prof={prof} sizes={OX} reveal={reveal} scanIdx={scanIdx} scanP={scanP} /> : null}
          {(ox ? [] : show).map((oi, p) => {
            const isC = oi === q.correct;
            const inP = ease(f, T.opts[p] ?? T.board, 8);
            const glow = p === scanIdx ? scanP : 0;
            const rest = interpolateColors(glow, [0, 1], [K.paper, '#FFF1D2']); // v6e: 노란 채움(#FFE7A0)이 「정답 표시인지 헷갈렸다」(v6d GPT)
            const bg = isC ? interpolateColors(reveal, [0, 1], [rest, K.meadow]) : rest;
            const color = isC ? interpolateColors(reveal, [0, 1], [K.navy, K.white]) : K.navy;
            const popC = isC && f >= T.reveal ? 1 + 0.05 * Math.exp(-(f - T.reveal) / 4) : 1 + 0.025 * glow;
            const dim = isC ? 1 : 1 - 0.62 * reveal;
            // v6f: 고르는 동안 불빛이 옮겨 간 보기는 살짝 들리고 남색 테가 선다(옅은 채움만으로는 v6f0 맹검 「선택지 강조 모션이 전혀 없다」 · 노란 채움은 v6d GPT 「정답 표시인지」)
            const lift = f < T.reveal ? glow : 0;
            const ring = lift ? { boxShadow: `0 7px 0 rgba(13, 20, 48, 0.28), 0 0 0 ${Math.round(5 * lift)}px rgba(27, 42, 90, 0.85)` } : {};
            const badge = (size: number) => (
              <div style={{ width: size, height: size, flex: `0 0 ${size}px`, borderRadius: size / 2, background: isC && reveal > 0.5 ? K.white : K.navy, display: 'grid', placeItems: 'center' }}>
                {isC && reveal > 0.5 ? <Check size={size * 0.7} color={K.meadow} /> : <span style={{ font: `800 ${Math.round(size * 0.5)}px 'Inter Tight', sans-serif`, color: K.cream }}>{'ABC'[p]}</span>}
              </div>
            );
            if (duel) {
              // 카드 안 글 자리(높이 150)를 넘지 않는 가장 큰 크기 — 세 줄짜리 보기가 카드 아래로 넘쳤다(v6b 학교 편)
              let fit = fitBox(loc.options[oi], prof, DW - 48, 56, 34, 3);
              while (fit.size > 34 && fit.lines.length * fit.size * 1.14 > 150) fit = fitBox(loc.options[oi], prof, DW - 48, fit.size - 2, 34, 3);
              return (
                <div key={oi} style={{ position: 'absolute', left: p * (DW + 22), top: 0, width: DW, height: optsH, ...plate(bg, 34, 8), ...ring, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '26px 20px 22px', boxSizing: 'border-box', opacity: Math.min(1, inP * 1.7) * dim, translate: `0 ${(1 - inP) * 34 - 10 * lift}px`, scale: `${popC}` }}>
                  <div style={stitch(9, 'rgba(27, 42, 90, 0.2)', 26)} />{/* v6f: 펠트 조각처럼 안쪽 실땀(맹검 「디자인 디테일 없는 흰색 기본 도형 상자」) */}
                  {badge(68)}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    <Lines lines={fit.lines} style={{ ...type(fit.size, { font: 'loc', color, weight: 800 }), textAlign: 'center' }} />
                  </div>
                </div>
              );
            }
            const fit = fitBox(loc.options[oi], prof, W - 150, 50, 32, 2);
            return (
              <div key={oi} style={{ position: 'absolute', left: 0, top: p * (BTN.h + BTN.gap), width: W, height: BTN.h, ...plate(bg, 30, 7), ...ring, display: 'flex', alignItems: 'center', gap: 22, padding: '0 24px 0 22px', boxSizing: 'border-box', opacity: Math.min(1, inP * 1.7) * dim, translate: `0 ${(1 - inP) * 30 - 8 * lift}px`, scale: `${popC}` }}>
                <div style={stitch(8, 'rgba(27, 42, 90, 0.2)', 22)} />
                {badge(62)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Lines lines={fit.lines} align="left" style={type(fit.size, { font: 'loc', color, weight: 800, line: 1.12 })} />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      {/* v6f: 보기 판 아래 남은 시간 막대 — 보기가 다 뜬 때부터 정답까지 줄어든다(v6f0 학교 맹검 02 「3초 퀴즈 카운트다운 구간에 타이머 막대 · 숫자 모션이 없다」) */}
      {f >= (T.opts[T.opts.length - 1] ?? T.board) && f < T.reveal + 8 ? (() => {
        const t0 = T.opts[T.opts.length - 1] ?? T.board;
        const left = Math.max(0, 1 - (f - t0) / Math.max(1, T.reveal - t0));
        const out = interpolate(f, [T.reveal, T.reveal + 8], [1, 0], clamp);
        return (
          <div style={{ position: 'absolute', left: SAFE.l + 30, top: SAFE.b + 14, width: W - 60, height: 22, borderRadius: 11, background: 'rgba(255, 246, 220, 0.38)', boxShadow: '0 4px 0 rgba(13, 20, 48, 0.28)', overflow: 'hidden', opacity: out * Math.min(1, ease(f, t0, 6) * 1.7) }}>
            <div style={{ width: `${left * 100}%`, height: '100%', borderRadius: 11, background: interpolateColors(left, [0, 0.34, 1], [K.coral, K.coral, K.butter]) }} />
          </div>
        );
      })() : null}
      {f >= T.reveal && toMean < 1 ? <Burst at={T.reveal + 1} x={burstX} y={burstY} colors={[K.coral, K.butter, K.meadow, K.cream]} seed={`q${index}`} count={22 + index * 8} spread={480} dur={32} /> : null}

      {/* 띠 — 장면 아래 가장자리에 걸친다(버터색 판 — 지난 편들의 남색 머리 글 상자와 다르게) */}
      {f >= T.band && toMean < 1 ? (
        <div style={{ position: 'absolute', left: SAFE.l, width: W, top: bandTop, height: bandH, display: 'flex', justifyContent: 'center', alignItems: 'center', ...rise(bandIn, 22), opacity: Math.min(1, bandIn * 1.7) * (1 - toMean) }}>
          <div style={{ ...plate(right ? (ox ? K.coral : K.meadow) : K.butter, hint ? 40 : 999, 6), height: bandH, padding: '0 40px', display: 'flex', flexDirection: hint ? 'column' : 'row', justifyContent: 'center', alignItems: 'center', gap: hint ? 0 : 16, scale: `${bandPop}` }}>
            {counting ? (
              <>
                <div style={{ height: 84, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <Stopwatch size={58} left={1 - clock} />
                  <span style={{ ...type(58, { weight: 900, color: K.navy }), whiteSpace: 'nowrap' }}>{countKo}</span>
                  <span style={{ font: `800 54px 'Inter Tight', sans-serif`, color: K.navy }}>= {countN}</span>
                </div>
                {hint ? <span style={{ ...type(hintFit.size, { font: 'loc', weight: 800, color: K.navy, line: 1.2 }), whiteSpace: 'nowrap', marginTop: -10 }}>{ui.countLabel}</span> : null}
              </>
            ) : (
              <span style={{ ...type(bandFit.size, { font: 'loc', weight: 800, color: right ? K.white : K.navy }), whiteSpace: 'nowrap' }}>{right ? rightText : bandBase}</span>
            )}
          </div>
        </div>
      ) : null}

      {/* 뜻 단계: = 뜻 · 따라 말하기 */}
      {f >= T.flip ? (
        <>
          <div style={{ position: 'absolute', left: SAFE.l, width: W, top: pillTop, display: 'flex', justifyContent: 'center', ...rise(ease(f, T.flip + 3, 9)) }}>
            <div style={{ ...plate(K.butter, 26, 6), padding: '9px 30px 13px' }}>
              <Lines lines={meaningFit.lines} style={type(meaningFit.size, { font: 'loc', weight: 800, color: K.navy })} />
            </div>
          </div>
          <SayIt f={f} fps={fps} ui={ui} parts={sp} say={q.say} idiom={q.idiom} reading={readFit} mean={sayMean} at={T.say} turnAt={T.turn} label={spec.label} top={sayTop} height={sayH} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

/** 「맞을까 틀릴까」 판: 함정 뜻 카드(「= …?」) 아래 ✓ · ✗ 단추. 고르는 동안 박마다 불이 옮겨 가고, 답에서 ✗가 산호색으로 차며 함정 뜻에 줄이 그어진다. */
const OxBoard: React.FC<{ f: number; T: ReturnType<typeof qT>; text: string; prof: LangProfile; sizes: { card: number; gap: number; btn: number }; reveal: number; scanIdx: number; scanP: number }> = ({ f, T, text, prof, sizes, reveal, scanIdx, scanP }) => {
  const fit = fitBox(text, prof, W - 90, 54, 34, 2);
  const cardIn = ease(f, T.opts[0] ?? T.board, 8);
  const btnIn = ease(f, T.opts[1] ?? T.board, 8);
  const DW = (W - 22) / 2;
  const pop = f >= T.reveal ? 1 + 0.07 * Math.exp(-(f - T.reveal) / 4) : 1;
  const strike = interpolate(f, [T.reveal + 2, T.reveal + 9], [0, 1], clamp);
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: sizes.card, ...plate(K.paper, 30, 7), display: 'grid', placeItems: 'center', boxSizing: 'border-box', padding: '0 30px', opacity: Math.min(1, cardIn * 1.7) * (1 - 0.45 * reveal), translate: `0 ${(1 - cardIn) * 30}px` }}>
        <div style={stitch(8, 'rgba(27, 42, 90, 0.2)', 22)} />
        <div style={{ position: 'relative' }}>
          <Lines lines={fit.lines} style={type(fit.size, { font: 'loc', color: K.navy, weight: 800, line: 1.12 })} />
          <div style={{ position: 'absolute', left: -8, right: -8, top: '52%', height: 7, borderRadius: 4, background: K.coral, transform: `scaleX(${strike})`, transformOrigin: 'left center' }} />
        </div>
      </div>
      {[0, 1].map((k) => {
        const isX = k === 1;
        const glow = k === scanIdx ? scanP : 0;
        const rest = interpolateColors(glow, [0, 1], [K.paper, '#FFF1D2']); // v6e: 노란 채움(#FFE7A0)이 「정답 표시인지 헷갈렸다」(v6d GPT)
        const bg = isX ? interpolateColors(reveal, [0, 1], [rest, K.coral]) : rest;
        const stroke = isX ? interpolateColors(reveal, [0, 1], [K.coral, K.white]) : K.meadow;
        return (
          <div key={k} style={{ position: 'absolute', left: k * (DW + 22), top: sizes.card + sizes.gap, width: DW, height: sizes.btn, ...plate(bg, 34, 8), ...(glow && f < T.reveal ? { boxShadow: `0 8px 0 rgba(13, 20, 48, 0.28), 0 0 0 ${Math.round(5 * glow)}px rgba(27, 42, 90, 0.85)` } : {}), display: 'grid', placeItems: 'center', opacity: Math.min(1, btnIn * 1.7) * (isX ? 1 : 1 - 0.62 * reveal), translate: `0 ${(1 - btnIn) * 34 - (f < T.reveal ? 10 * glow : 0)}px`, scale: `${isX ? pop : 1 + 0.025 * glow}` }}>
            <div style={stitch(9, 'rgba(27, 42, 90, 0.2)', 26)} />
            <svg viewBox="0 0 24 24" width={112} height={112}>
              {isX ? <path d="M6 6l12 12M18 6L6 18" fill="none" stroke={stroke} strokeWidth={3.4} strokeLinecap="round" /> : <path d="M4.5 12.5l5 5L19.5 7" fill="none" stroke={stroke} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />}
            </svg>
          </div>
        );
      })}
    </>
  );
};

/** 따라 말하기 판: (첫 문제) 이름표 → 해요체(한국어 · 바뀐 말끝에 색) → 소리 표시 + 읽는 법 → 그 문장의 뜻. */
const SayIt: React.FC<{
  f: number; fps: number; ui: Ui; say: string; idiom: string; parts: ReturnType<typeof sayParts>; reading: { size: number; lines: string[] }; mean: { size: number; lines: string[] } | null;
  at: number; turnAt: number | null; label: boolean; top: number; height: number;
}> = ({ f, fps, ui, say, idiom, parts, reading, mean, at, turnAt, label, top, height }) => {
  const inP = ease(f, at - 5, 9);
  if (f < at - 5) return null;
  const turn = turnAt !== null && f >= turnAt;
  const turnPop = turn ? 1 + 0.14 * spring({ frame: f - (turnAt ?? 0), fps, config: { damping: 6, stiffness: 180, mass: 0.6 } }) * Math.exp(-(f - (turnAt ?? 0)) / 14) : 1;
  // v6f: 사전 꼴 말끝을 지우고 말할 꼴로 — 「비행기를 ~~태우다~~ → 태웠어요」(v5 G · K · v6d G · v6f1 K 「말끝이 왜 바뀌나」, 「말할 때는 이렇게:」 이름표만으로는 안 풀렸다).
  //   명사로 끝나 말끝이 사전 꼴을 품는 관용구(「그림의 떡」 → 「떡이에요」 · 「수박 겉 핥기」 → 「핥기였어요」)는 지우지 않는다.
  const hi = parts.head ? idiom.lastIndexOf(parts.head) : -1; // 「사공이 많으면 배가 산으로 간다」 → 「배가 산으로 갔어요」처럼 앞이 잘린 꼴도
  const dict = hi >= 0 ? idiom.slice(hi + parts.head.length) : '';
  const swap = dict && !parts.tail.startsWith(dict) ? dict : '';
  const koSize = Math.min(64, Math.floor(770 / (emOf(say) + (swap ? 0.72 * emOf(swap) + 1.1 : 0))));
  return (
    <div style={{ position: 'absolute', left: SAFE.l, width: W, top, height, display: 'flex', justifyContent: 'center', ...rise(inP, 34) }}>
      <div style={{ ...plate(K.navy, 34, 8), width: W, height, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 26px 18px', boxSizing: 'border-box' }}>
        {label ? (
          <div style={{ height: 58, display: 'flex', alignItems: 'flex-start' }}>
            <span style={{ padding: '4px 22px 6px', borderRadius: 999, background: turn ? K.butter : K.coral, ...type(34, { font: 'loc', weight: 800, color: turn ? K.navy : K.white }), letterSpacing: '0.03em', whiteSpace: 'nowrap', scale: `${turnPop}` }}>{turn ? ui.yourTurn : ui.sayHow ?? ui.sayIt}</span>
          </div>
        ) : null}
        <div style={{ height: 74, display: 'flex', alignItems: 'center', whiteSpace: 'pre' }}>
          <span style={type(koSize, { weight: 900, color: K.white })}>{parts.head}</span>
          {swap ? <span style={{ ...type(Math.round(koSize * 0.72), { weight: 800, color: 'rgba(201, 216, 246, 0.8)' }), textDecoration: 'line-through', textDecorationThickness: 4, textDecorationColor: K.coral }}>{swap}</span> : null}
          {swap ? <svg viewBox="0 0 24 24" width={Math.round(koSize * 0.72)} height={Math.round(koSize * 0.72)} style={{ margin: '0 8px', flex: '0 0 auto' }}><path d="M3 12h15M13 6l6 6-6 6" fill="none" stroke={K.butter} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
          {/* v6f: 한국어 목소리가 읽을 때 · 「이제 네가」에 바뀐 말끝이 통 튄다(맹검 03 「따라 읽을 문장에 리듬 모션이 없다」) */}
          <span style={{ ...type(koSize, { weight: 900, color: K.butter }), display: 'inline-block', scale: `${1 + 0.14 * Math.exp(-Math.max(0, f - at - 3) / 5) * (f >= at + 3 ? 1 : 0) + (turnAt !== null && f >= turnAt ? 0.12 * Math.exp(-(f - turnAt) / 6) : 0)}`, transformOrigin: '50% 80%' }}>{parts.tail}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Speaker size={Math.round(reading.size * 0.9)} color={K.sky} />
          <Lines lines={reading.lines} align="left" style={{ ...type(reading.size, { font: 'loc', weight: 700, color: K.sky, line: 1.16 }) }} />
        </div>
        {mean ? (
          <div style={{ marginTop: 4 }}>
            <span style={{ ...type(mean.size, { font: 'loc', weight: 800, color: K.butter, line: 1.3 }), whiteSpace: 'nowrap' }}>{mean.lines[0]}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};
