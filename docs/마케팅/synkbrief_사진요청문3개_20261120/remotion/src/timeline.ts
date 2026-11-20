// synkbrief 「사진 한 장에 붙여 넣는 요청문 3개」 시간표 — 장면 · 말 · 소리 한 곳(초).
// 뼈대는 형식 원본(인스타 릴스 Dd9GKV2hJCQ · 36.0초): 0초부터 위 큰 제목 → 「사진 + 한마디 → 결과」 되풀이 → 끝에 댓글 낱말(원본 32.0초).
// 우리는 길이 20~25초 · 항목 셋(유호님이 정하신 것 — 오마주.json 「다르게」). 끝 장치는 우리 끝 장면(21.43초)과 큰 글(21.53초)이다.
// r2(이해 시험 뒤): 첫 줄에 「평소 쓰던 챗지피티」를 넣고, 0~3초가 멈춰 보인다는 지적에 2.0초에 아래 사진을 빈 방으로 바꾸고,
//   메뉴판 · 옛날 사진 칸도 결과 설명 대신 요청문 가운데 한 줄을 말하고 보인다(넷이 모두 「무엇을 입력하는지 화면에 없다」).
// r6(최종본 독립 검수 뒤 — 주 세션): 옛날 사진 칸만 고쳤다. 결과 영상은 요청문과 맞는 구간(입 다문 옅은 웃음 · 눈 깜빡임 한 번)을 원래 빠르기로 쓰고,
//   얼굴로 크게 당기지 않고, 넷째 줄 첫마디를 「옛날 사진은 제미나이에,」로 바꿨다. 모음 컷은 첫 장부터 제목이 보인다.
export const FPS = 30;

// 장면이 시작하는 초
export const S = {
  hook: 0, // 표지 A 짜임 — 채워진 방 + 보낸 빈 방 사진 + 제목
  room: 2.0, // 아래 사진이 보낸 빈 방으로 바뀐다(「빈 방 사진이랑」) — 제목은 그대로 서 있다
  line: 3.7, // 제목이 보낸 한 줄로 바뀐다
  fill0: 3.9, // 방이 채워지기 시작(첫 줄을 말하는 동안 — 빈 방 한 구성이 4초를 넘지 않게)
  fill1: 8.1, // 다 채워짐(「채워 줘」)
  menu: 9.45, // 2 손글씨 메뉴판
  menuFill0: 11.9, // 새 메뉴판으로 바뀌기 시작(「깔끔한 메뉴판을」)
  menuFill1: 13.5,
  photo: 14.6, // 3 옛날 사진
  photoMove: 16.2, // 움직이는 결과가 겹쳐 뜬다(「살짝 웃으며」 16.31초 바로 앞) — 받은 영상의 4.7초부터 원래 빠르기로. 눈 깜빡임은 19.71~19.92초
  recap: 20.08, // 보낸 사진 세 장 + 「요청문 3개」
  end: 21.43, // 끝 3초 — 채워진 방 화면 가득 + 큰 글
  cta: 21.53,
  total: 24.43,
};
export const TOTAL_S = S.total;

// 말(범수) — public/vo/<id>.wav. V5는 쉼표에서 둘로 나눠(a · b) 말과 화면이 같이 바뀌게 한다(음성/범수의 한 줄을 자른 것)
export const VO: { id: string; t: number }[] = [
  { id: 'V1', t: 0.15 }, // 평소 쓰던 챗지피티에, 빈 방 사진이랑 이 한 줄을 보냈어요.
  { id: 'V2', t: 3.75 }, // 네가 아는 나를 바탕으로, 내가 좋아할 만한 물건들로, 이 방을 채워 줘.
  { id: 'V3', t: 9.6 }, // 손글씨 메뉴판 사진엔, 인쇄해서 붙일 깔끔한 메뉴판을 새로 만들어 줘.
  { id: 'V4', t: 14.75 }, // 옛날 사진은 제미나이에, 살짝 웃으며 눈을 한 번 깜빡이는 정도로만 움직여 줘.(4.55초)
  { id: 'V5a', t: S.recap + 0.17 }, // 요청문 세 개,
  { id: 'V5b', t: S.cta }, // 댓글에 사진이라고 남기면 보내 드려요.
];

// 위 작은 줄(굵은 낱말 + 옅은 설명) — 도구 이름은 시청자가 따라 할 도구라 적는다. 첫 줄은 표지와 같은 크기(34), 나머지는 40
// bar = 굵은 낱말과 옅은 설명 사이에 가는 선을 둔다(둘이 한 문장으로 붙어 읽히지 않게)
export const TAGS: { from: number; to: number; b: string; i?: string; size?: number; bar?: boolean }[] = [
  { from: S.hook, to: S.line, b: 'SYNK 브리핑', i: '따라 하는 AI', size: 34 },
  { from: S.line, to: S.menu, b: 'ChatGPT', i: '평소 나눈 대화를 기억해요' },
  { from: S.menu, to: S.photo, b: 'ChatGPT', i: '요청문 가운데 한 줄' },
  { from: S.photo, to: S.recap, b: '제미나이 앱', i: '사진 속 인물은 AI로 만든 예시예요', bar: true },
  { from: S.recap, to: S.total + 1, b: 'SYNK 브리핑' },
];

// 큰 글 = 말. at = 줄마다 뜨는 초. [ ] = 버터 글자(화면마다 한 곳). 요청문 줄은 나눌 자료의 원문 그대로다
// hard = 그 컷 첫 장부터 다 보인다(올라오며 뜨지 않는다)
export type Line = { lines: string[]; from: number; to: number; at: number[]; size: number; hard?: boolean };
export const LINES: Line[] = [
  { lines: ['네가 아는 나를 바탕으로,', '내가 좋아할 만한 물건들로', '이 방을 채워 줘'], from: S.line, to: S.menu, at: [3.77, 5.35, 7.25], size: 76 },
  { lines: ['손글씨 메뉴판 사진엔'], from: 9.6, to: 11.2, at: [9.62], size: 92 },
  { lines: ['인쇄해서 붙일', '깔끔한 메뉴판을', '새로 만들어 줘'], from: 11.2, to: S.photo, at: [11.24, 11.88, 12.8], size: 76 },
  { lines: ['옛날 사진은 제미나이에'], from: 14.75, to: 16.27, at: [14.77], size: 92 },
  { lines: ['살짝 웃으며', '눈을 한 번 깜빡이는', '정도로만 움직여 줘'], from: 16.27, to: S.recap, at: [16.31, 17.2, 18.24], size: 76 },
  { lines: ['[요청문 3개]'], from: S.recap, to: S.end, at: [S.recap], size: 128, hard: true },
  { lines: ['댓글에', '[「사진」]'], from: S.cta, to: S.total + 1, at: [S.cta, S.cta + 0.35], size: 150 },
];

// 효과음 — 말머리와 겹치지 않는 자리에만
export const SOUNDS: { t: number; src: string; vol: number }[] = [
  { t: S.fill1 + 0.1, src: 'sfx/tok.wav', vol: 0.3 },
  { t: S.menu - 0.04, src: 'sfx/swish.wav', vol: 0.22 },
  { t: S.menuFill1 + 0.1, src: 'sfx/tok.wav', vol: 0.26 },
  { t: S.photo - 0.04, src: 'sfx/swish.wav', vol: 0.22 },
  { t: S.recap - 0.04, src: 'sfx/swish.wav', vol: 0.2 },
  { t: S.end - 0.04, src: 'sfx/swish.wav', vol: 0.22 },
  { t: S.cta + 0.35, src: 'sfx/thud.wav', vol: 0.28 },
];

// 배경음(보유곡 시티팝_147의 27초부터) 볼륨 — 끝까지 깔고 목소리 아래로, 끝 0.9초만 닫는다
export const BGM = { t: [0, 0.25, S.total - 0.9, S.total], v: [0.1, 0.26, 0.26, 0] };
