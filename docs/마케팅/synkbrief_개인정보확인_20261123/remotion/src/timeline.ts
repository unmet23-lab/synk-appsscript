// synkbrief B69 「인터넷에 드러난 내 정보를 ChatGPT로 찾고 지우기」 시간표 — 장면 · 말 · 소리 한 곳(초).
// 뼈대: 표지와 같은 첫 화면(결과 카드 먼저) → 보낸 요청문에 답이 써지는 실제 녹화 → 민감정보 카드(전화번호 · 집 주소는 안 나옴 / 사진 · 경력은 나옴)
//   → 위험도순 표(여섯 곳) → 보낸 요청문 → 꼭 붙일 한 줄(이름이 같은 다른 사람은 빼기)과 실제로 뺀 목록 → 지우는 차례(원본부터)
//   → 끝 3초 민감정보 카드를 다시 크게 두고 「아래 글에 적어 뒀어요」.
// 화면은 모두 2026-11-23 ChatGPT 임시 채팅에서 받은 실제 답(실험 E06)이다(scripts/재료.py). 이름 · 아이디 말고 답에 나온 다른 정보는 가렸다.
// 큰 글이 뜨는 초는 음성/범수/<줄>.json의 낱말 시각에 맞췄다. 구성마다 첫 줄은 그 구성의 첫 프레임부터 서 있다(Film.tsx Big).
export const FPS = 30;

// 판(올리는 곳)마다 끝 줄만 다르다 — 인스타 · 틱톡은 아래 글(@synkbrief는 키워드 DM이 없다), 유튜브는 고정 댓글
export type Variant = 'ig' | 'yt';
export const END: Record<Variant, { vo: string; dur: number; ctaAt: number; cta: string[]; ctaSize: number }> = {
  ig: { vo: 'N7', dur: 3.052, ctaAt: 1.97, cta: ['아래 글에', '[적어 뒀어요]'], ctaSize: 132 },
  yt: { vo: 'N7Y', dur: 2.919, ctaAt: 1.75, cta: ['고정 댓글에', '[적어 뒀어요]'], ctaSize: 132 },
};

// 장면이 시작하는 초
export const S = {
  hook: 0, // 표지와 같은 화면 — 제목 + 민감정보 카드. 0.45초부터 보낸 요청문에 답이 써지는 실제 녹화
  badge: 3.85, // 민감정보 카드 — 줄이 말에 맞춰 하나씩
  table: 7.85, // 위험도순 표(여섯 곳)
  ask: 10.7, // 보낸 요청문 말풍선
  line: 16.5, // 꼭 붙일 한 줄 — 말풍선 끝 두 줄로 다가간 뒤(16.5) 실제로 뺀 목록(18.22)
  lineEx: 18.22,
  del: 20.75, // 지우는 곳 표(20.75) → 원본부터라는 답의 문단(22.1)
  delOrder: 22.1,
  end: 24.65, // 끝 — 민감정보 카드를 다시 크게
};
export const N7_AT = 24.75;
export const totalOf = (v: Variant) => Math.round((N7_AT + END[v].dur + 0.95) * 10) / 10;

// 훅의 녹화 — 그 구성 안의 초마다 바뀌는 실제 화면(rec0 = 보낸 말풍선과 「생각 중」, rec1~5 = 답이 써지는 중)
// y = 화면에서 보이는 윗줄(원본 화면 화소). 답이 아래로 자라니 따라 내려간다
// v2: 장면 심사(v1 넘김)가 「작은 글씨가 빠르게 올라가 0.5초 안에 읽히는 말이 없고, 글자 겹침 · 흐린 줄은 오류처럼 보인다」고 해
// 여섯 장을 두 장으로 줄였다 — 보낸 말풍선과 「생각 중」(1.1초), 답 제목이 뜬 화면(2.3초). 글이 겹쳐 그려지는 중간 장(rec3 · rec4)과 가린 줄이 보이는 장은 뺐다
export const REC: { at: number; img: string; y: number }[] = [
  { at: 0.45, img: 'rec0', y: 150 },
  { at: 2.0, img: 'rec2', y: 470 }, // v4 첫컷검사 #66 — 말풍선이 1.1초뿐이라 읽을 틈이 없다 → 1.55초
];
export const COVER_OUT = 0.45; // 표지 카드가 녹화로 바뀌는 초

// 민감정보 카드의 네 줄이 켜지는 초(badge 구성 안) — 말 「전화번호랑」 · 「얼굴 사진이랑」에 맞춘다
export const BADGE_ROWS = [0.1, 2.15, 2.3, 2.45]; // 둘째~넷째 줄은 「얼굴 사진이랑 경력은 나왔어요」 한 말에 함께(따로 띄우면 넷째 줄이 0.7초만 머문다)

// 말(범수) — public/vo/<id>.wav
export const VO: { id: string; t: number }[] = [
  { id: 'N1', t: 0.15 }, // 제 이름이랑 아이디로, 인터넷에 드러난 제 정보를 찾아 달라고 했어요.(3.58)
  { id: 'N2', t: 3.95 }, // 전화번호랑 집 주소는 안 나왔고, 얼굴 사진이랑 경력은 나왔어요.(3.74)
  { id: 'N3', t: 7.95 }, // 여섯 곳을 찾아서, 위험한 순서로 정리해 줬어요.(2.60)
  { id: 'N4', t: 10.8 }, // 보낸 말은 이거예요. 이 두 가지로 인터넷을 검색해서, 누구나 볼 수 있게 드러난 내 정보를 찾아 줘.(5.31)
  { id: 'N5', t: 16.6 }, // 그리고 이 한 줄. 이름이 같은 다른 사람으로 보이는 정보는 빼 줘.(3.82)
  { id: 'N6', t: 20.85 }, // 지울 곳도 알려 줘요. 원본 사이트부터, 그다음 구글이랑 네이버예요.(3.64)
];

// 위 작은 줄 — 도구 이름은 시청자가 따라 할 도구라 적는다. 첫 줄은 표지와 같은 크기(34), 나머지는 40
export const TAGS: { from: number; to: number; b: string; i?: string; size?: number; bar?: boolean }[] = [
  { from: S.hook, to: S.badge, b: 'SYNK 브리핑', i: 'ChatGPT 앱', size: 34 },
  { from: S.badge, to: S.table, b: 'ChatGPT 앱', i: 'SYNK 대표 이름으로 해 봤어요', bar: true },
  { from: S.table, to: S.ask, b: 'ChatGPT 앱', i: '이름 · 아이디 말고는 가렸어요', bar: true },
  { from: S.ask, to: S.lineEx, b: 'ChatGPT 앱', i: 'SYNK 대표 이름으로 해 봤어요', bar: true },
  { from: S.lineEx, to: S.del, b: 'ChatGPT 앱', i: '이름이 같은 다른 사람 자료는 가렸어요', bar: true },
  { from: S.del, to: S.end, b: 'ChatGPT 앱', i: 'SYNK 대표 이름으로 해 봤어요', bar: true },
  { from: S.end, to: 99, b: 'SYNK 브리핑', i: 'SYNK 대표 이름으로 해 봤어요', bar: true },
];

// 큰 글 = 말. at = 줄마다 뜨는 초. [ ] = 버터 글자(화면마다 한 곳). 「 」 안은 보낸 요청문 원문 그대로다
export type Line = { lines: string[]; from: number; to: number; at: number[]; size: number };
export const LINES: Line[] = [
  { lines: ['전화번호 · 집 주소는', '[안 나왔고]', '얼굴 사진 · 경력은', '나왔어요'], from: S.badge, to: S.table, at: [S.badge, 4.97, 5.97, 5.97], size: 92 },
  { lines: ['[여섯 곳]을 찾아서', '위험한 순서로'], from: S.table, to: S.ask, at: [S.table, 9.18], size: 104 },
  // 줄이 구성 끝 1초 안에 새로 뜨지 않게 묶는다(새 글은 1.2초 넘게 — 점검표 #66). 「보낸 말은 이거예요」 · 「그리고 이 한 줄」은 첫 프레임부터 두 줄 다
  { lines: ['보낸 말은', '[이거예요]'], from: S.ask, to: 12.12, at: [S.ask, S.ask], size: 120 },
  { lines: ['「이 두 가지로 인터넷을', '검색해서, 누구나 볼 수 있게', '드러난 내 정보를 [찾아 줘]」'], from: 12.12, to: S.line, at: [12.12, 13.09, 14.8], size: 70 },
  { lines: ['그리고', '[이 한 줄]'], from: S.line, to: S.lineEx, at: [S.line, S.line], size: 120 },
  { lines: ['「이름이 같은 다른 사람으로', '보이는 정보는 [빼 줘]」'], from: S.lineEx, to: S.del, at: [S.lineEx, 19.36], size: 80 },
  { lines: ['지울 곳도', '[알려 줘요]'], from: S.del, to: S.delOrder, at: [S.del, S.del], size: 120 },
  { lines: ['[원본 사이트]부터,', '그다음 구글 · 네이버'], from: S.delOrder, to: S.end, at: [S.delOrder, 23.17], size: 96 },
];
export const END_LINES = { lines: ['요청문이랑', '지우는 곳 다섯 군데'], at: [S.end, N7_AT + 0.61], size: 104 };

// 효과음 — 말머리와 겹치지 않는 자리에만
export const SOUNDS: { t: number; src: string; vol: number }[] = [
  { t: S.hook + 0.4, src: 'sfx/tok.wav', vol: 0.22 },
  { t: S.badge - 0.06, src: 'sfx/swish.wav', vol: 0.2 },
  { t: S.table - 0.06, src: 'sfx/swish.wav', vol: 0.2 },
  { t: S.ask - 0.06, src: 'sfx/swish.wav', vol: 0.2 },
  { t: S.lineEx - 0.04, src: 'sfx/tick.wav', vol: 0.24 },
  { t: S.del - 0.06, src: 'sfx/swish.wav', vol: 0.2 },
  { t: S.delOrder - 0.04, src: 'sfx/tick.wav', vol: 0.24 },
  { t: S.end - 0.08, src: 'sfx/swish.wav', vol: 0.22 },
];

// 배경음(보유곡 퀴즈120_테크팝의 39초부터 — 곡 안 빈 마디 37.25~38.75초 뒤, 67.25초 앞) — 끝까지 깔고 목소리 아래로, 끝 0.9초만 닫는다
export const bgmOf = (total: number) => ({ t: [0, 0.25, total - 0.9, total], v: [0.12, 0.25, 0.25, 0] });
