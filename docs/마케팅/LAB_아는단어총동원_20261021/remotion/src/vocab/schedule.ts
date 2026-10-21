// 시각표: 나레이션 줄 길이(vo.generated.ts)로 낱말마다 자리를 잡는다. 낱말 한 칸은 말 길이 + 0.08초, 짧아도 0.56초(박자감, 카드의 「한 박자에 한 단어」).
// 갈래 사이에 반 박쯤 숨(0.22초), 엇나가는 갈래 앞은 조금 더(0.35초). 화면은 목소리 시작에 맞춰 바뀐다(2~3초마다가 아니라 낱말마다).
import { VO } from './vo.generated';
import { WORDS } from './data';

export const FPS = 30;
const dur = (id: string) => {
  const l = VO.find((x) => x.id === id);
  if (!l) throw new Error(`나레이션 줄이 없다: ${id}`);
  return l.dur;
};
const SLOT_MIN = 0.56;
const IN_GAP = 0.08;
const CAT_GAP = 0.22;
const PANIC_GAP = 0.25;

const build = () => {
  let t = 0.05;
  const ask = t;
  t += dur('ask') + 0.22;
  const words: { id: string; at: number; end: number }[] = [];
  WORDS.forEach((w, i) => {
    if (i > 0 && w.cat !== WORDS[i - 1].cat) t += w.cat === 4 ? PANIC_GAP : CAT_GAP;
    const at = t;
    t += Math.max(dur(w.id) + IN_GAP, SLOT_MIN);
    words.push({ id: w.id, at, end: t });
  });
  const laugh = t; // 묻는 사람이 웃음을 참는다(소리 없음). 0.5초면 「(trying not to laugh)」를 못 읽어 0.8초(10-21 Fable P2)
  t += 0.8;
  const slowCard = t - 0.2; // 달팽이가 먼저 뜨고(딩) 목소리
  const slow = t;
  t += dur('slow') + 0.18;
  const ok = t;
  t += dur('ok') + 0.12;
  const turn = t; // 따라 말할 차례
  t += 2.0;
  const end = turn + 0.9; // 댓글 질문은 차례 도중에 띠로 바뀐다
  const total = t + 0.7;
  return { ask, words, laugh, slowCard, slow, ok, turn, end, total };
};

export const S = build();
export const f = (sec: number) => Math.round(sec * FPS);
export const TOTAL = f(S.total);
/** 소리 자리(초). 줄 id → 시작. */
export const VO_AT: Record<string, number> = { ask: S.ask, slow: S.slow, ok: S.ok, ...Object.fromEntries(S.words.map((w) => [w.id, w.at])) };
