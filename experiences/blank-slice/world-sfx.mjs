// 빈칸 베기 — WORLD 캠퍼스 판(밤 도서관)의 종이 손맛 소리(2026-11-04). 파일 없이 Web Audio로 그 자리에서 만든다.
// LAB 화면은 sfx.mjs의 「펠트 사각」 그대로이고, 이 파일은 WORLD에서만 audio.mjs useVoices로 갈아 끼운다.
// 같은 버스 · 리미터 · 부품(sfx.mjs parts)을 쓰고, 브랜드 사운드킷 셋째 가족 「게임 효과음」 규칙을 그대로 지킨다(world-sfx.test.mjs):
//   ① 한 소리 400ms 이하  ② 실패음 없음 — 틀려도 같은 손맛 소리에서 「팅」만 빠진다  ③ 음이 있는 층은 사인 · 트라이앵글만
//   ④ 음높이는 C 펜타토닉 안(미끄럼은 시작 · 끝음)  ⑤ 잡음은 넓은 대역만(띠 거르개 Q 0.9 이하 — 좁으면 무전 잡음, 08-28 귀 검수)
// 겉 세 안(형광펜 「쓱」 · 찢기 「찌익」 · 종이 칼 「삭」)을 같은 크기로 견준 뒤 11-04 유호님 「드래그하면 찢어지는 효과음 · 타격감 · 과일 자르는 게임 느낌」으로
// 찢기를 정했다. 베기 = 칙 · 찌이익 · 툭 · 파사삭, 빈칸에 붙을 때 = 테이프 「착」.
// 몽글 목소리(괜찮아 · 기뻐 · 눌러)는 앱에서 쓰지 않는다(10-31 마스코트 뺌) — 같은 자리에 목소리 없는 짧은 음을 둔다(KIT_MAP).
import { VOICES as FELT, parts, comboNote, PENTA } from './sfx.mjs';

const { place, env, tone, hiss, filter, ring } = parts;
const N = { C3: 130.81, G3: 196, E4: 329.63, G4: 392, D5: 587.33, E5: 659.26, G5: 783.99, C6: 1046.5, E6: 1318.51, G6: 1567.98 };
export { comboNote, PENTA };

/** 소리별 전체 크기 — qa/world-campus-20261104/소리재기.cjs가 K 가중 순간 음량(BS.1770, 400ms)을 재고 맞춘 값.
 *  LAB 펠트와 같은 자리: 베기 맞힘 −17.8 LUFS(사운드킷 「획득」 −20.8보다 3 크게), 끼워짐 −28, 던지기 −26.6.
 *  찢기 소리 자체는 펠트보다 앞에 세웠다(틀림 −21.5, 펠트 −23.7 — 「찢어지는 효과음」이 주인공). 휘두르기 · 별은 sfx.mjs LEVEL 그대로. */
export const LEVEL = { slice: 2.04, snap: 2.99, launch: 4.34, nudge: 3.37, streak: 2.72, tap: 6.7, mark: 3.78 };

/** 맞힘의 「팅」: 연속할수록 C 펜타토닉 계단을 오르고 4연속부터 두 칸 위 음을 겹친다(LAB과 같은 계단). */
function ting(b, t, combo, dest) {
  ring(b, t + 0.012, comboNote(combo), 0.36, 0.34, dest);
  if (combo >= 4) ring(b, t + 0.04, comboNote(combo + 2), 0.14, 0.3, dest);
  return 0.38;
}

/** 소리 모음. audio.mjs useVoices로 넣는다. 이름은 LAB VOICES와 같다(+ 몽글 목소리 자리를 대신하는 nudge · streak · tap). */
export const VOICES = {
  whoosh: FELT.whoosh,

  /** 찢기 — 과일 닌자 결: 네 겹이 0.2초 안에 겹친다. 칼날이 닿는 「칙」 → 섬유가 하나씩 끊기는 알갱이 「찌이익」(처음 촘촘 · 크게,
   *  끝으로 듬성 · 작게) + 마찰 바탕 → 두 쪽이 갈라지는 무게 「툭」 → 종이 조각이 터져 팔랑이는 「파사삭」. 틀려도 같은 네 겹이고 「팅」만 없다. */
  slice(b, t, { correct = true, combo = 1, x = 0 } = {}) {
    const dest = place(b, LEVEL.slice, x * 0.35), len = 0.2;
    hiss(b, t, 0.02, false).connect(filter(b, 'highpass', 5000, 0.6)).connect(env(b, t, 0.0005, 0.42, 0.012)).connect(dest);
    for (let tt = t + 0.004; tt < t + len;) {
      const k = (tt - t) / len, amp = 0.82 * Math.pow(1 - k, 0.6) * (0.55 + 0.45 * b.rand());
      hiss(b, tt, 0.008, false).connect(filter(b, 'bandpass', 1700 + b.rand() * 3300, 0.8))
        .connect(env(b, tt, 0.0004, amp, 0.0025 + b.rand() * 0.0035)).connect(dest);
      tt += 0.0022 + k * 0.006 + b.rand() * 0.002;
    }
    const lp = filter(b, 'lowpass', 7000, 0.6);
    lp.frequency.setValueAtTime(7000, t); lp.frequency.exponentialRampToValueAtTime(2200, t + len);
    hiss(b, t, len + 0.02).connect(filter(b, 'highpass', 900, 0.5)).connect(lp).connect(env(b, t, 0.006, 0.3, len)).connect(dest);
    tone(b, 'sine', t + 0.003, N.G3, N.C3, 0.06, 0.12).connect(env(b, t + 0.003, 0.002, 0.16, 0.1)).connect(dest);
    tone(b, 'triangle', t + 0.002, N.D5, N.G4, 0.05, 0.08).connect(env(b, t + 0.002, 0.001, 0.22, 0.065)).connect(dest);
    [[0.06, 0.1], [0.1, 0.07], [0.15, 0.05]].forEach(([dt, lv]) => {   // 터진 종이 조각이 팔랑
      hiss(b, t + dt, 0.045).connect(filter(b, 'bandpass', 1500 + b.rand() * 900, 0.7)).connect(env(b, t + dt, 0.003, lv, 0.035)).connect(dest);
    });
    return correct ? ting(b, t, combo, dest) : len + 0.03;
  },

  /** 던지기: 책상에서 카드가 튀어 오르는 「팔랑」 + 작은 「뽁」(솔3→솔4). n은 같은 순간에 오른 조각 수. */
  launch(b, t, { x = 0, n = 1 } = {}) {
    const dest = place(b, LEVEL.launch, x * 0.5), lv = Math.min(1, 0.75 + 0.12 * n);
    hiss(b, t, 0.08).connect(filter(b, 'bandpass', 1800, 0.7)).connect(env(b, t, 0.01, 0.07 * lv, 0.06)).connect(dest);
    tone(b, 'sine', t, N.G3, N.G4, 0.09, 0.15).connect(env(b, t, 0.008, 0.1 * lv, 0.12)).connect(dest);
    return 0.15;
  },

  /** 찢은 쪽지가 빈칸에 붙는 테이프 「착」: 붙는 순간 넓은 잡음 + 끈적하게 떨어지는 잔 알갱이 셋 + 몸통. 사운드킷 「획득」과 함께 울린다. */
  snap(b, t, { x = 0 } = {}) {
    const dest = place(b, LEVEL.snap, x * 0.4);
    hiss(b, t, 0.04, false).connect(filter(b, 'highpass', 2400, 0.6)).connect(env(b, t, 0.001, 0.16, 0.024)).connect(dest);
    for (const dt of [0.012, 0.021, 0.034]) hiss(b, t + dt, 0.006, false).connect(filter(b, 'bandpass', 3000 + b.rand() * 1500, 0.8)).connect(env(b, t + dt, 0.0004, 0.08, 0.003)).connect(dest);
    tone(b, 'triangle', t, N.G4, N.E4, 0.035, 0.07).connect(env(b, t, 0.001, 0.16, 0.05)).connect(dest);
    return 0.075;
  },

  star: FELT.star,

  /** 틀렸을 때 몽글 「괜찮아」 자리: 묻듯이 오르는 두 음(미5 → 솔5) — 내려가는 음 없음. */
  nudge(b, t) {
    const dest = place(b, LEVEL.nudge, 0);
    tone(b, 'sine', t, N.E5, 0, 0, 0.13).connect(env(b, t, 0.006, 0.12, 0.11)).connect(dest);
    tone(b, 'sine', t + 0.11, N.G5, 0, 0, 0.16).connect(env(b, t + 0.11, 0.006, 0.12, 0.14)).connect(dest);
    return 0.27;
  },
  /** 4연속마다 몽글 「기뻐」 자리: 도6 · 미6 · 솔6을 빠르게. */
  streak(b, t) {
    const dest = place(b, LEVEL.streak, 0);
    [N.C6, N.E6, N.G6].forEach((f, i) => ring(b, t + i * 0.055, f, 0.12, 0.2, dest));
    return 0.335;
  },
  /** 결과 채점의 빨간 펜 한 번: 펜이 종이를 긋는 짧은 「슥」. 맞힌 문장이면 맞힌 수만큼 계단을 오르는 작은 음을 얹는다(틀림 · 놓침은 음 없음 — 실패음 아님). */
  mark(b, t, { ok = false, step = 1 } = {}) {
    const dest = place(b, LEVEL.mark, 0);
    hiss(b, t, 0.05, false).connect(filter(b, 'bandpass', 3400, 0.8)).connect(env(b, t, 0.002, 0.14, 0.035)).connect(dest);
    if (!ok) return 0.05;
    tone(b, 'triangle', t + 0.008, comboNote(step), 0, 0, 0.11).connect(env(b, t + 0.008, 0.002, 0.1, 0.09)).connect(dest);
    return 0.12;
  },

  /** 단추 누름(몽글 「무」 자리): 작고 짧은 딸깍. */
  tap(b, t) {
    const dest = place(b, LEVEL.tap, 0);
    tone(b, 'triangle', t, N.G5, N.E5, 0.02, 0.05).connect(env(b, t, 0.001, 0.1, 0.035)).connect(dest);
    return 0.05;
  },
};

/** 사운드킷 파일 가운데 몽글 목소리는 앱에서 울리지 않는다 — 같은 자리의 소리 이름(위 VOICES) 또는 null(울리지 않음). */
export const KIT_MAP = Object.freeze({ calm1: 'nudge', calm2: 'nudge', joy1: 'streak', joy2: 'streak', tap: 'tap', done: null });
