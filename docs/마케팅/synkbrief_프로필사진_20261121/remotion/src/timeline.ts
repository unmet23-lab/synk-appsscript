// synkbrief B68 「셀카 한 장을 프로필 사진으로 바꾸는 명령어」 시간표 — 장면 · 말 · 소리 한 곳(초).
// 뼈대: 표지와 같은 첫 화면(결과 먼저 → 같은 자리에서 셀카 → 받은 사진) → 보낸 셀카 → 보낸 명령어와 받은 사진 → 한 줄 더(잔머리) → 얼굴 견줌(점 · 홑꺼풀)
//   → 하나씩만 바꾸는 명령어 셋의 결과 → 끝 3초 셀카가 받은 사진으로 바뀐 뒤 「댓글에 「프로필」」.
// 그림은 모두 2026-11-21 ChatGPT에서 실제로 받은 결과다(scripts/재료.py · 기획.md 「실험」). 화면의 「 」 안은 보낸 명령어 원문이다.
// 큰 글이 뜨는 초는 음성/범수/<줄>.json의 낱말 시각에 맞췄다. 구성마다 첫 줄은 그 구성의 첫 프레임부터 서 있다(Film.tsx Big).
// 같은 짜임이 4초를 넘지 않게 장면마다 사진 놓는 꼴을 바꿨다(작은 사진 → 화면 가득 가까이 → 사진 칸 → 화면 가득 머리 → 나란히 두 칸 → 사진 칸 셋 → 화면 가득).
export const FPS = 30;

// 판(올리는 곳)마다 끝 줄만 다르다 — 인스타는 키워드 DM, 유튜브는 고정 댓글, 틱톡은 아래 글
export type Variant = 'ig' | 'yt' | 'tt';
// 끝 말: 1회 이해 시험에서 「얼굴 확인하는 법」을 넷이 다 무엇인지 모르겠다고 했고, r3의 「얼굴이 바뀌었는지 보는 법」도 2회에서 둘이 같은 말을 했다.
// 「명령어 전부」는 화면에 이미 다 나와 겹친다는 지적도 있어, r4부터 영상에 없는 것을 이름으로 댄다. r4의 「쓰면 안 되는 말」도 3회에서 둘이 무엇인지 모르겠다고 해 r6은 「그 명령어 여섯 개 전부」 하나만 댄다.
export const END: Record<Variant, { vo: string; dur: number; ctaAt: number; cta: string[]; ctaSize: number }> = {
  ig: { vo: 'N7', dur: 3.457, ctaAt: 1.7, cta: ['댓글에', '[「프로필」]'], ctaSize: 150 },
  yt: { vo: 'N7Y', dur: 2.847, ctaAt: 1.57, cta: ['고정 댓글에', '[적어 뒀어요]'], ctaSize: 124 },
  tt: { vo: 'N7T', dur: 2.569, ctaAt: 1.49, cta: ['아래 글에', '[적어 뒀어요]'], ctaSize: 124 },
};

// 장면이 시작하는 초
// r3: 명령어 칸에 명령어 뒷부분을 작게 더하며 늘렸고(시험관 둘이 「…」 뒤가 무엇인지 모르겠다고 함), 배경만 · 옷만을 1.4초씩으로 늘렸다(둘이 너무 빨리 지나간다고 함).
// r5: 작은 글을 못 읽었다는 2회 지적(GPT · 그록)에 작은 글을 키우고 명령어 칸을 0.4초 더 늘렸다(r2보다 1.3초 김).
export const S = {
  hook: 0, // 표지와 같은 화면 — 받은 프로필 사진(큰 판) + 보낸 셀카(작게) + 제목. 0.2초부터 같은 자리에서 보낸 셀카로 바뀌었다가 「프로필 사진이」에 받은 사진으로 돌아온다
  sent: 2.7, // 보낸 셀카 한 장(작은 사진 꼴)
  ask: 5.35, // 보낸 명령어 — 셀카를 화면 가득 가까이
  askBox: 8.15, // 사진 칸 — 셀카가 같은 자리에서 받은 사진으로 바뀐다(「…바꿔 줘.」 뒤). 명령어 뒷부분이 작게 붙는다
  more: 11.85, // 한 줄 더 — 화면 가득 머리
  moreSwap: 13.8, // 「한 줄 더 보냈더니」 — 위에서 아래로 쓸어내리며 잔머리가 정리된 판으로(r4: 2회 시험관 둘 · 볼 이유 심사가 「잔머리가 바뀐 게 안 보인다」)
  face: 15.75, // 보낸 셀카와 받은 사진의 얼굴을 나란히
  bg: 18.1, // 하나씩만 바꾸는 명령어 — 배경만
  clothes: 19.5, // 옷만
  cafe: 20.9, // 카페 창가로(r6: 흑백 판은 3회 시험관 둘 · 볼 이유 심사가 「다른 사람처럼 보인다」고 해 카페 창가 판 E11로 바꿈)
  end: 22.85, // 끝 — 보낸 셀카가 화면 가득 → 「댓글에」 큰 글이 뜨는 때 같은 자리에서 받은 사진으로
};
export const N7_AT = 22.95;
// 첫 화면과 끝 화면에서 셀카 → 받은 사진으로 바뀌는 때(그 구성 안의 초). 끝은 판마다 「댓글에 …」 큰 글이 뜨는 때에 맞춘다(endSwapOf)
export const HOOK_SWAP = { zoomFrom: 0.2, zoomTo: 0.6, inFrom: 0.45, inTo: 0.75, outFrom: 1.35, outTo: 1.7 };
export const endSwapOf = (v: Variant) => { const a = N7_AT - S.end + END[v].ctaAt - 0.05; return { from: a, to: a + 0.4 }; };
export const MORE_WIPE = 0.5; // 잔머리 판으로 쓸어내리는 길이(초)
export const totalOf = (v: Variant) => Math.round((N7_AT + END[v].dur + 1.15) * 10) / 10;

// 말(범수) — public/vo/<id>.wav. from · to는 그 파일 안에서 쓰는 구간(초) — N6은 쉼표 뒤 조용한 자리(0.57 · 1.02초)에서 셋으로 나눠 그림이 바뀌는 박에 맞춘다
export const VO: { id: string; t: number; from?: number; to?: number }[] = [
  { id: 'N1', t: 0.15 }, // 방에서 찍은 셀카 한 장이, 프로필 사진이 됐어요.(2.40)
  { id: 'N2', t: 2.8 }, // 챗지피티에 셀카를 올리고, 이렇게 보냈어요.(2.41)
  { id: 'N3', t: 5.45 }, // 이 셀카를 사진관에서 찍은 프로필 사진으로 바꿔 줘. 얼굴 생김새와 점은 그대로 두고.(4.79)
  { id: 'N4', t: 11.9 }, // 잔머리만 단정하게 정리해 줘. 한 줄 더 보냈더니, 머리도 정리됐어요.(3.80 · 1.05배)
  { id: 'N5', t: 15.85 }, // 점도, 홑꺼풀도, 그대로예요.(2.07)
  { id: 'N6', t: 18.15, from: 0, to: 0.57 }, // 배경만,
  { id: 'N6', t: 19.53, from: 0.57, to: 1.02 }, // 옷만,
  { id: 'N6', t: 20.93, from: 1.02 }, // 카페 창가로 바꾸는 명령어도 있어요.
];

// 위 작은 줄 — 도구 이름은 시청자가 따라 할 도구라 적는다. 첫 줄은 표지와 같은 크기(34), 나머지는 40
export const TAGS: { from: number; to: number; b: string; i?: string; size?: number; bar?: boolean }[] = [
  { from: S.hook, to: S.sent, b: 'SYNK 브리핑', i: 'ChatGPT 앱', size: 34 },
  { from: S.sent, to: S.end, b: 'ChatGPT 앱', i: '예시 셀카는 AI로 만든 인물이에요', bar: true },
  { from: S.end, to: 99, b: 'SYNK 브리핑', i: '예시 셀카는 AI로 만든 인물이에요', bar: true }, // r8: 독립 검수 — 끝 화면에도 AI 인물 표시
];

// 큰 글 = 말. at = 줄마다 뜨는 초. [ ] = 버터 글자(화면마다 한 곳). 「 」 안은 보낸 명령어 원문 그대로다
// small = 말로 읽지 않는 명령어 뒷부분(작은 흰 글, smallAt부터) — 큰 글은 말과 같은 것만이다
// smallStep = 작은 글을 한 줄씩 띄우는 간격(초). r9: 독립 검수가 9.6~11.85초 말 없는 자리에 「새로 나타나는 것이 없다」고 해 한 줄씩 띄운다
export type Line = { lines: string[]; from: number; to: number; at: number[]; size: number; small?: string[]; smallAt?: number; smallStep?: number };
export const LINES: Line[] = [
  { lines: ['ChatGPT에', '셀카를 올리고', '이렇게 보냈어요'], from: S.sent, to: S.ask, at: [S.sent, 3.37, 4.42], size: 96 },
  {
    lines: ['「이 셀카를 사진관에서 찍은', '프로필 사진으로 바꿔 줘.', '얼굴 생김새와 점은', '[그대로 두고],'],
    from: S.ask, to: S.more, at: [S.ask, 6.82, 8.47, 9.52], size: 72,
    small: ['배경은 밝은 회색,', '조명은 부드럽게,', '옷은 네이비 재킷에 흰 셔츠,', '정면에서 어깨까지 나오게.」'], smallAt: 9.6, smallStep: 0.45,
  },
  { lines: ['「잔머리만 단정하게', '정리해 줘」', '한 줄 더 보냈더니', '[머리도 정리됐어요]'], from: S.more, to: S.face, at: [S.more, 12.84, 13.85, 14.79], size: 76 },
  { lines: ['점도, 홑꺼풀도', '[그대로예요]'], from: S.face, to: S.bg, at: [S.face, 17.35], size: 112 },
  { lines: ['[배경만]'], from: S.bg, to: S.clothes, at: [S.bg], size: 124 },
  { lines: ['[옷만]'], from: S.clothes, to: S.cafe, at: [S.clothes], size: 124 },
  { lines: ['[카페 창가로]', '바꾸는 명령어도 있어요'], from: S.cafe, to: S.end, at: [S.cafe, 21.56], size: 80 },
];
// r9: 독립 검수 — 영상에 나온 명령은 다섯인데 「여섯 개」라 셈이 안 맞는다. 「여섯 개 전부」 밑에 자료 표의 여섯 이름을 작은 글로 둔다
export const END_LINES = { lines: ['그 명령어', '여섯 개 전부'], at: [S.end, N7_AT + 0.54], size: 112, small: ['배경만 · 조명만 · 옷만 ·', '구도만 · 흑백으로 · 카페 창가로'], smallAt: N7_AT + 0.54 };

// 나란히 칸 위 작은 글
export const PAIR_LABELS = ['보낸 셀카', '받은 사진'];

// 효과음 — 말머리와 겹치지 않는 자리에만
export const SOUNDS: { t: number; src: string; vol: number }[] = [
  { t: S.sent - 0.06, src: 'sfx/swish.wav', vol: 0.2 },
  { t: S.askBox + 0.1, src: 'sfx/tok.wav', vol: 0.26 },
  { t: S.more - 0.1, src: 'sfx/swish.wav', vol: 0.2 },
  { t: S.face - 0.08, src: 'sfx/swish.wav', vol: 0.2 },
  { t: S.bg - 0.04, src: 'sfx/tick.wav', vol: 0.24 },
  { t: S.clothes - 0.04, src: 'sfx/tick.wav', vol: 0.24 },
  { t: S.cafe - 0.04, src: 'sfx/tick.wav', vol: 0.24 },
  { t: S.end - 0.08, src: 'sfx/swish.wav', vol: 0.22 },
];

// 배경음(보유곡 시티팝_147의 30초부터 — 곡 안 빈 마디 26.25~27초 뒤, 104초 앞) 볼륨 — 끝까지 깔고 목소리 아래로, 끝 0.9초만 닫는다
export const bgmOf = (total: number) => ({ t: [0, 0.25, total - 0.9, total], v: [0.12, 0.25, 0.25, 0] }); // r6: 음악이 전체보다 12.2dB 작다는 올리기 전 검사(확인할 것)에 0.2 → 0.25
