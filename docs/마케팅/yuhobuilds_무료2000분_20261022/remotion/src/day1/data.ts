// 화면에 나오는 글. 전부 실제 값이다(대화 문장은 띄어쓰기까지 그대로, 줄임은 「…」 하나로만). 근거는 기획.md 「사실 대조」.
// 대화·시각: 조율 세션 「예약된 게시물 확인」 기록(10-20 17:35:53 ~ 18:22:18). 채널 순서는 실제 확인 순서.

/** 00 실제 질문(17:35:53). */
export const QUESTION = '오늘 synk lab이랑 synk brief , synk shift , yuhobuilds 에 올라가는 예약된 게시물들 있어 ?';
export const SESSION_TITLE = '예약된 게시물 확인';

/** 채널 12곳(실제 확인 순서). grp: 막힌 곳 묶음 번호(①유튜브 셋 ②인스타 계정마다 ③틱톡 한 계정·샤오훙수 주소). */
export type Channel = { p: string; h: string; grp?: 1 | 2 | 3 };
export const CHANNELS: Channel[] = [
  { p: 'YouTube · API', h: '@synkkorean', grp: 1 },
  { p: 'YouTube · 스튜디오', h: 'SYNK 브리핑', grp: 1 },
  { p: 'YouTube · 스튜디오', h: '@yuhobuilds', grp: 1 },
  { p: 'Business Suite', h: 'SYNK' },
  { p: 'Business Suite', h: 'LAB 스리랑카' },
  { p: 'Business Suite', h: 'LAB 캄보디아' },
  { p: 'Business Suite', h: 'LAB 네팔' },
  { p: 'Instagram', h: '@synkbrief', grp: 2 },
  { p: 'Instagram', h: '@yuhobuilds', grp: 2 },
  { p: 'Instagram', h: '@synk.mn', grp: 2 },
  { p: 'TikTok', h: '@synklab.mm', grp: 3 },
  { p: '크리에이터 센터', h: '샤오훙수', grp: 3 },
];

/** 01·07·08 세션 목록(앱 Code 탭, 실제 제목·시작 시각). */
export const PARENT = { title: SESSION_TITLE, meta: '17:35' } as const;
export const CHILDREN = [
  { title: 'LAB 관용구 퀴즈 #4 「간」 — 오늘 영어·몽골어판', meta: '18:21', brand: 'LAB' },
  { title: 'synkbrief AI 음식 사진 편 + SHIFT 블로그 글', meta: '18:21', brand: 'synkbrief' },
  { title: 'yuhobuilds 「오늘 다 올려야 돼」 실화 편', meta: '18:22', brand: 'yuhobuilds' },
] as const;

/** 03 유튜브 API 출력(17:39:48 실제 첫 줄). 아래 영상 줄은 제목·ID를 가리고 상태만 보인다. */
export const API_CMD = '$ node yt_scheduled.cjs';
export const API_HEAD = '== lab-youtube → SYNK LAB | Learn Korean · 최근 30편';
export const API_ROWS = ['private', 'private', 'private', 'private', 'private', 'unlisted'] as const;
/** 스튜디오 채널 칩(실제 채널 이름). 둘째 → 셋째 전환은 한 번 안 넘어갔다(17:43:38 → 17:44:20 다시). */
export const YT_CHIPS = ['SYNK LAB | Learn Korean', 'SYNK 브리핑', '유호 · AI와 회사 만들기'] as const;

/** 04 인스타 실제 화면(전환 창 → 예약 달력) 세 번. */
export const IG_STEPS = [
  { sw: 'cap/ig_sw1.png', cal: 'cap/ig_cal1.png', h: '@synkbrief' },
  { sw: 'cap/ig_sw2.png', cal: 'cap/ig_cal2.png', h: '@yuhobuilds' },
  { sw: 'cap/ig_sw3.png', cal: 'cap/ig_cal3.png', h: '@synk.mn' },
] as const;

/** 05 주소. */
export const URL_TT = 'tiktok.com/tiktokstudio/content';
export const URL_XHS = 'creator.xiaohongshu.com/new/note-manager';
export const URL_RED_A = 'creator.';
export const URL_RED_B = 'rednote';
export const URL_RED_C = '.com/new/note-manager';

/** 06 유호님 실제 두 문장(18:11:23 · 18:11:48)과 바로 앞 Claude 답의 첫 문장(17:53:21). */
export const ANSWER = '오늘(10-20) 지금 시각으로 네 계정 모두 예약 걸린 게시물이 없어요.';
export const SAY1 = '오늘 다 올려야되는데.\n지금 전부 각각 하나씩 제작준비하자';
export const SAY2_A = '우리 앞으로 ';
export const SAY2_MARK = '1일 1 컨텐츠';
export const SAY2_B = ' 업로드해야해.  오케이 ?준비된 모든 채널에 말이야';

/** 07 월요일 트렌드 스캔 §4 추천 셋(제목만 줄임) + 오늘 실화. */
export const SCAN_HEAD = '월요일 트렌드 스캔 · 2026-10-19';
export const SCAN_SUB = '추천 셋';
export const SCAN_ROWS = [
  { t: "yuhobuilds 「자동 DM에서 'AI 티' 지우기」", tag: '10-19 올림', pick: false },
  { t: 'LAB 관용구 퀴즈 「간」', tag: '', pick: true },
  { t: 'synkbrief 「메뉴판 AI 음식 사진」', tag: '', pick: true },
] as const;
export const TODAY_ROW = 'yuhobuilds · 오늘 있었던 일';

/** 08 올리는 계정(조율 세션이 크롬 하나로 바꿔 가며 올린다). */
export const POST_CHIPS = ['@synk.mn', '@synkbrief', '@yuhobuilds'] as const;

/** 10 끝 프로필 카드(세션 공유 편과 같은 채널 문구). */
export const PROFILE = {
  handle: '@yuhobuilds',
  name: '유호 · YUHO BUILDS',
  bio: 'AI로 회사를 만드는 과정',
  sub: '직접 만든 결과와 시행착오까지',
} as const;
