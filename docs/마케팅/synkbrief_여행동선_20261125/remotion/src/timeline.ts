// synkbrief B77 「여행 동선 — 가고 싶은 곳을 붙이고 '하루 세 곳만, 이동 30분 안' 한 줄」 시간표 — 장면 · 말 · 소리 한 곳(초).
// 뼈대(오마주 원본 @mavgpt 여행 코드 릴스의 「약속 → 보낸 말 → 답 화면」 박자를 한 가지 일로 줄임) — 이해 시험 1회 뒤 결과 먼저로:
//   답 속 지도에서 세 날의 길이 그려짐 → 2.6초 보낸 글(가고 싶은 곳 열두 곳 + 한 줄) → 날짜를 바꾼 지도 1 · 2 · 3일차 → 뺀 세 곳과 까닭
//   → 카카오맵으로 가장 먼 구간을 다시 잼(21분) → 지도 위 여섯 구간 시간 → 한 줄 없이 보낸 답(하루 네 곳) → 붙인 한 줄을 크게
//   → 끝: 지도 없이 온 답에 「지도로도 보여 줘.」를 이어 보내 받은 지도(밝은 화면, 실험 E07 · E08).
// 화면은 모두 2026-11-25 ChatGPT 임시 채팅(실험 E02 · E06 · E08)과 카카오맵에서 실제로 받은 것이다(scripts/재료.py).
// 큰 글이 뜨는 초는 음성/범수/<줄>.json의 낱말 시각에 맞췄다.
export const FPS = 30;

export type Variant = 'ig' | 'yt';
// 끝 줄 — 판마다 같은 줄. 이해 시험 1회 뒤 N8(「여행 가기 전에, 도시만 바꿔서 붙여 보세요」 + 한 줄과 지도)이었고,
// 올리기 전 검사 ⑯(첫 · 끝 장면이 11-27 개인정보확인 편과 같은 어두운 무대)과 미학 맹검(끝 화면의 말풍선 띠 · 같은 지도 되풀이)으로
// 실험 E07(같은 글, 지도 없이 옴) → E08(「지도로도 보여 줘.」에 지도)의 팁 N9로 바꿨다. 「도시만 바꿔서」는 붙인 한 줄 화면의 위 작은 줄로 옮겼다.
export const END: Record<Variant, { vo: string; dur: number; cta2At: number; cta3At: number }> = {
  ig: { vo: 'N9', dur: 3.368, cta2At: 1.133, cta3At: 2.214 }, // 지도가 안 나오면, 지도로도 보여 줘, 이렇게 이어서 보내 보세요.(「지도로도」 · 「이렇게」)
  yt: { vo: 'N9', dur: 3.368, cta2At: 1.133, cta3At: 2.214 },
};

// 말(범수) — public/vo/<id>.wav
export const VO: { id: string; t: number }[] = [
  { id: 'N1a', t: 0.15 }, // 가고 싶은 곳이, 날짜별 동선 지도로 나왔어요.(2.34)
  { id: 'N1b', t: 2.65 }, // 목록을 몽땅 붙이고, 한 줄만 더했거든요.(2.44)
  { id: 'N2', t: 5.3 }, // 첫날은 해운대 쪽, 둘째 날은 남포동 쪽, 셋째 날은 영도 쪽.(3.77)
  { id: 'N3', t: 9.3 }, // 다 못 넣는 곳은, 까닭까지 달아서 빼 줬고요.(2.49)
  { id: 'N4', t: 12.05 }, // 카카오맵 자동차 길찾기로 다시 재 보니, 구간마다 다 삼십 분 안이었어요.(3.81)
  { id: 'N6', t: 16.15 }, // 이 한 줄을 빼면, 먼 곳까지 다 넣어서 하루 일정이 꽉 차요.(3.12)
  { id: 'N5', t: 19.55 }, // 붙일 한 줄은 이거예요. 하루에 세 곳만, 이동은 삼십 분 안으로 묶어 줘.(4.13)
];
export const N7_AT = 23.9;
export const totalOf = (v: Variant) => Math.round((N7_AT + END[v].dur + 0.95) * 10) / 10;

// 장면이 시작하는 초
export const S = {
  hook: 0, // 결과 먼저 — 답 속 지도를 펼친 화면에서 세 날의 길이 차례로 그려진다(길 그리기)
  list: 2.6, // 보낸 글 — 가고 싶은 곳 열두 곳 + 한 줄(말풍선)
  d1: 5.2, // 펼친 지도 1일차(「첫날은」)
  d2: 5.3 + 1.375, // 2일차(「둘째」)
  d3: 5.3 + 2.745, // 3일차(「셋째」)
  excl: 9.2, // 답 첫 문단(12곳 중 3곳은 제외) + 제외한 3곳과 까닭
  kakao: 11.95, // 카카오맵 자동차 길찾기 — 태종대유원지 → 흰여울문화마을 21분 6.7km
  legs: 14.2, // 「구간마다」 — 다 그려진 지도 위에 카카오맵으로 잰 구간 시간
  without: 16.05, // 한 줄 없이 보낸 답(E06) — 날마다 네 곳 표와 열두 곳 지도(이해 시험 2회 볼 이유 심사)
  line: 19.45, // 붙인 한 줄 — 말풍선의 끝 줄을 크게 + 답의 「이동이 30분 이내가 되도록」
  lineIn: 19.55 + 1.524, // 「하루에」 — 한 줄이 커지는 초
  end: 23.8, // 끝 — 지도 없이 온 답에 이어 보낸 「지도로도 보여 줘.」와 그 답의 지도(밝은 화면)
};

// 위 작은 줄 — 굵은 낱말 | 옅은 설명
export const TAGS: { from: number; to: number; b: string; i: string }[] = [
  // 이해 시험 2회(s · h · G 「ChatGPT 지도가 실제 기능인지, 어떻게 여는지 모름」) — 지도가 ChatGPT 답 속에 함께 나온 것임을 위 줄에 쓴다
  { from: S.hook, to: S.list, b: 'ChatGPT 답', i: '지도까지 같이 나왔어요' },
  { from: S.list, to: S.d1, b: '저희가 직접', i: '부산 열두 곳을 보냈어요' }, // 이해 시험 2회 s · h 「SYNK 브리핑이 누구인지 모름」
  { from: S.d1, to: S.excl, b: 'ChatGPT 답 속 지도', i: '날짜를 바꿔 봤어요' },
  { from: S.excl, to: S.kakao, b: 'ChatGPT', i: '뺀 곳과 까닭' },
  { from: S.kakao, to: S.legs, b: '카카오맵', i: '가장 먼 구간을 다시 쟀어요' },
  { from: S.legs, to: S.without, b: '카카오맵', i: '여섯 구간을 다 쟀어요' },
  { from: S.without, to: S.line, b: 'ChatGPT', i: '한 줄 없이 보냈더니' },
  { from: S.line, to: S.end, b: '붙일 한 줄', i: '도시만 바꿔서 쓰면 돼요' },
  { from: S.end, to: 99, b: 'ChatGPT', i: '지도 없이 온 답에 이어서' },
];

// 큰 글 = 말. at = 줄마다 뜨는 초(첫 줄은 구성 첫 프레임부터). [ ] = 버터 글자(화면마다 한 곳)
// 새 글은 앞 글이 뜬 뒤 5/6초 안에 띄우지 않는다(화면 글 머무름) — 낱말이 가까우면 두 줄을 함께 띄운다
// live = 마지막에 뜬 줄만 버터(날짜를 바꿀 때마다 그날 줄이 버터가 된다 — 한 때에 버터는 한 곳)
export type Line = { lines: string[]; from: number; to: number; at: number[]; size: number; live?: boolean };
export const LINES: Line[] = [
  { lines: ['가고 싶은 곳이', '날짜별 [지도]로'], from: S.hook, to: S.list, at: [0, 0.15 + 0.85], size: 112 },
  { lines: ['목록을 몽땅 붙이고', '[한 줄]만 더했어요'], from: S.list, to: S.d1, at: [S.list, 2.65 + 1.353], size: 104 },
  { lines: ['첫날 해운대 쪽', '둘째 날 남포동 쪽', '셋째 날 영도 쪽'], from: S.d1, to: S.excl, at: [S.d1, S.d2, S.d3], size: 96, live: true },
  { lines: ['다 못 넣는 곳은', '[까닭까지] 달아서', '빼 줬어요'], from: S.excl, to: S.kakao, at: [S.excl, 9.3 + 1.196, 9.3 + 1.196], size: 104 },
  { lines: ['카카오맵으로 재 보니', '구간마다 다 [30분] 안'], from: S.kakao, to: S.without, at: [S.kakao, 12.05 + 2.247], size: 100 }, // 「구간마다」 — 「30분 안」이 하루 합계로 읽히지 않게(장면 첫 컷 검사 v8)
  { lines: ['이 한 줄을 빼면', '먼 곳까지 다 넣어', '하루가 [꽉] 차요'], from: S.without, to: S.line, at: [S.without, 16.15 + 0.912, 16.15 + 2.056], size: 104 },
  { lines: ['붙일 한 줄은'], from: S.line, to: S.lineIn, at: [S.line], size: 110 },
  { lines: ['「하루에 세 곳만,', '이동은 [30분 안으로]', '묶어 줘」'], from: S.lineIn, to: S.end, at: [S.lineIn, 19.55 + 2.727, 19.55 + 2.727], size: 96 },
];
export const END_LINES = { lines: ['지도가 안 나오면', '「[지도로도 보여 줘]」', '이어서 보내 보세요'], size: 100 };

// 효과음 — 말머리와 겹치지 않는 자리에만
export const SOUNDS: { t: number; src: string; vol: number }[] = [
  { t: 0.12, src: 'sfx/tick.wav', vol: 0.18 },
  { t: S.list - 0.06, src: 'sfx/swish.wav', vol: 0.2 },
  { t: S.d1 - 0.06, src: 'sfx/swish.wav', vol: 0.2 },
  { t: S.d2 - 0.03, src: 'sfx/tick.wav', vol: 0.2 },
  { t: S.d3 - 0.03, src: 'sfx/tick.wav', vol: 0.2 },
  { t: S.excl - 0.06, src: 'sfx/swish.wav', vol: 0.2 },
  { t: S.kakao - 0.06, src: 'sfx/swish.wav', vol: 0.2 },
  { t: S.legs - 0.04, src: 'sfx/thud.wav', vol: 0.2 },
  { t: S.without - 0.06, src: 'sfx/swish.wav', vol: 0.2 },
  { t: S.line - 0.06, src: 'sfx/swish.wav', vol: 0.2 },
  { t: S.lineIn - 0.03, src: 'sfx/pop.wav', vol: 0.2 },
  { t: S.end - 0.08, src: 'sfx/swish.wav', vol: 0.22 },
];

// 배경음(보유곡 「01_Joyful-Happy-Upbeat」의 6초부터 — 0~38초에 빈 마디 없음, 렌더 뒤 음악층으로 확인) — 끝까지 깔고 목소리 아래로, 끝 0.9초만 닫는다
export const bgmOf = (total: number) => ({ t: [0, 0.25, total - 0.9, total], v: [0.12, 0.2, 0.2, 0] });

// 한 장면 심사용 구성(scene, 6초, 글 · 말 없이) — 위에 보낸 한 줄, 아래 펼친 지도에서 날마다 길이 이어 그려진다
export const SCENE_DUR = 6.0;
// v2(첫 컷 검사 v1 「목록을 읽을 시간이 짧다」 · 「핀 이름이 화면 끝에 잘린다」): 목록을 1.7초 두고, 지도는 휠로 줄인 화면으로
// v3(첫 컷 검사 v2 「날짜별 지도가 1초 만에 바뀌어 장소 이름을 읽을 시간이 짧다」): 날짜마다 1.45초 넘게 두고 모든 날짜 칸은 뺀다
// v4(첫 컷 검사 v3 「날짜별 지도의 작은 장소명을 1~2초에 못 읽는다」): 지도는 두 칸만 — 모든 날짜(세 날의 길) → 1일차
// v5(첫 컷 검사 v4 「말풍선 맨 아래 두 조건을 1.5초에 못 읽는다」): 말풍선을 원래 크기로 키우고 세 칸을 2초씩 — 그래도 「열두 지명을 2초에 못 읽음」 · 「지도가 2초 만에 바뀜」
// v6: 읽을 글을 줄인다 — 보낸 한 줄만 크게(1.8초) → 모든 날짜 지도에 머문다(4.2초). 첫 컷 통과, 장면 심사 넘김 · 볼 이유 2(「지도가 4초 멈춤 · 경로가 1번부터 이어 그려지면」)
// v7: 위 빈 자리에 보낸 한 줄(실제 말풍선)을 두고, 아래 펼친 지도에서 날마다 실제 흰 길이 첫 핀부터 이어 그려진다(scripts/길그리기.py) → 다 그려진 원래 화면에 머문다
// v8(장면 심사 v7 넘김 · 2 「30분 안에 묶였다는 결과가 안 보인다 · 선마다 이동 시간 · 쿵에 크게」): 그날 길이 다 그려지면 카카오맵으로 잰 구간 시간을 길 옆에,
//   4.1초에 위 말풍선 자리를 「구간마다 다 / 차로 30분 안」 큰 글로 바꾼다(첫 컷 검사 v8 「세 날 다」는 하루 합계로 읽혀 18+16=34분과 어긋남)
export const SCENE_CUTS: { at: number; n: string }[] = [{ at: 0, n: 'draw' }];
// 카카오맵 자동차 길찾기로 잰 구간 시간(2026-11-25 아침, 기획.md 「실험」) — 지도 좌표(map_all) 기준 자리
// yl = 본편 「구간마다」 장면(판 윗변 LEGS_PT)에서 쓰는 자리 — 글자 아래 끝이 화면 아래 캡션 자리(1428px) 위에 오게
export const LEG_LABELS: { d: number; text: string; x: number; y: number; yl?: number }[] = [
  { d: 1, text: '18분 · 16분', x: 700, y: 410 },
  { d: 2, text: '10분 · 6분', x: 250, y: 752 },
  { d: 3, text: '21분 · 13분', x: 480, y: 955, yl: 925 },
];
export const LEGS_PT = 420;
export const SCENE_END_AT = 4.1;
export const SCENE_SOUNDS: { t: number; src: string; vol: number }[] = [
  { t: 0.22, src: 'sfx/tick.wav', vol: 0.2 },
  { t: 1.62, src: 'sfx/tick.wav', vol: 0.2 },
  { t: 2.52, src: 'sfx/tick.wav', vol: 0.2 },
  { t: 4.08, src: 'sfx/thud.wav', vol: 0.24 },
];

// 길 그리기(초) — d = 날, a ~ b 동안 그날 길이 첫 핀부터 끝 핀까지 드러난다. 장면은 0초부터, 본편은 S.map부터 잰다
export type Draw = { d: number; a: number; b: number };
export const DRAW_SCENE: Draw[] = [
  { d: 1, a: 0.25, b: 1.45 },
  { d: 2, a: 1.65, b: 2.35 },
  { d: 3, a: 2.55, b: 3.75 },
];
export const DRAW_FILM: Draw[] = [
  { d: 1, a: 0.15, b: 0.85 },
  { d: 2, a: 0.9, b: 1.25 },
  { d: 3, a: 1.3, b: 1.9 },
];
export const ROUTE_STEPS = 24;
