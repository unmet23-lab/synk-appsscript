// LAB E7 「손 + 목 = 손목」(10-29) — 오마주 원본(Korean Hamin wOXCfmVQz78, 18초)의 뼈대를 그대로 둔 박자표.
// 화면 초는 원본을 0.25초 띠로 잰 값(낱말 A · 낱말 B · 둘이 나란히 · 합쳐진 결과), 목소리 초는 원본 받아쓰기 낱말 시각을
// 목표로 앞 줄과 겹치지 않게 민 값이다(public/v/자리.json — scratchpad의 place.py가 셈).
// v2(이해 시험 1회 뒤): 셋째 세트의 「김(steam)」 칸을 0.5초 늘리고(둘이 나란히 10.5 → 11.0초, 원본 박자 0.6초 안),
// 끝 한마디로 다음 문제 「손 + 바닥 = ?」를 붙였다(오마주.json 「다르게」). v3(이해 시험 2회 뒤): 그 문제의 답(손바닥 = Palm)까지 보이고,
// 넷째 세트는 늦어진 목소리에 맞춰 0.1~0.25초 늦췄다(원본 박자 0.6초 안).
import VO from '../../public/v/자리.json';

export const FPS = 30;
export const MAIN = 18.3; // 원본 뼈대가 끝나는 초
export const TOTAL = 21.6;
export const TOTAL_FRAMES = Math.round(TOTAL * FPS);
export const fr = (s: number) => Math.round(s * FPS);
export const BEAT = 60 / 105; // 원본 박자 105BPM

export type Word = { en: string; ko: string; rom: string; img: string };
export type Item = {
  a: Word;
  b: Word;
  r: { en: string; img: string };
  t: { a: number; b: number; both: number; res: number; end: number };
  badge?: { text: string; from: number; to: number };
};

export const ITEMS: Item[] = [
  {
    a: { en: 'Hand', ko: '손', rom: 'son', img: 'K01' },
    b: { en: 'Neck', ko: '목', rom: 'mok', img: 'K02b' },
    r: { en: 'Wrist', img: 'K03' },
    t: { a: 0.0, b: 1.25, both: 2.5, res: 2.75, end: 4.5 },
  },
  {
    a: { en: 'Seaweed', ko: '김', rom: 'gim', img: 'K04' },
    b: { en: 'Rice', ko: '밥', rom: 'bap', img: 'K05' },
    r: { en: 'Gimbap', img: 'K06' },
    t: { a: 4.5, b: 5.75, both: 7.0, res: 7.5, end: 9.25 },
  },
  {
    // 반전 — 앞 세트의 「김(김)」이 여기서는 「김(김이 나다)」. 원본 셋째 세트의 같은 낱말 자리.
    a: { en: 'Mouth', ko: '입', rom: 'ip', img: 'K07b' },
    b: { en: 'Steam', ko: '김', rom: 'gim', img: 'K08' },
    r: { en: 'Frosty breath', img: 'K09' },
    t: { a: 9.25, b: 10.25, both: 11.0, res: 11.75, end: 13.75 },
    badge: { text: 'Same 김, new meaning!', from: 10.3, to: 12.6 },
  },
  {
    a: { en: 'Fire', ko: '불', rom: 'bul', img: 'K10' },
    b: { en: 'Flower', ko: '꽃', rom: 'kkot', img: 'K11' },
    r: { en: 'Flame', img: 'K12' },
    t: { a: 13.95, b: 15.0, both: 16.1, res: 16.7, end: MAIN },
  },
];

/** 끝 — 불꽃이 한 번 더 피는 초(원본 17.25초에 결과 인물이 노래를 내지른다) */
export const FINALE = 17.45;
/** 끝 한마디 — 다음 문제(손 + 바닥 = ?)와 그 답(손바닥 = Palm) */
export const NEXT = { a: { en: 'Hand', ko: '손', rom: 'son', img: 'K01' }, b: { en: 'Floor', ko: '바닥', rom: 'badak', img: 'K13' }, r: { en: 'Palm', img: 'K14' }, at: MAIN, res: 19.8 };
/** 몽글 표정: 박마다 노래(B0) ↔ 웃음(B1), 마지막 결과부터 감탄(B2), 다음 문제에서 웃음 */
export const AMAZED = 16.7;

export const VOICE: { id: string; at: number }[] = VO as { id: string; at: number }[];
