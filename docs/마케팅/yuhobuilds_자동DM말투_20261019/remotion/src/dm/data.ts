// 화면에 나오는 글. 전부 실제 운영 문구다(바꾸지 않는다, 줄임은 「…」 하나로만). 근거는 기획.md 「사실 대조」.
// 옛 문구: .tmp/comment-dm-tone-20261018/render-compare.md(운영 v60 코드·캠페인 값으로 뽑은 받는 화면)
// 지금 문구: .tmp/comment-dm-session-copy-20261019/campaigns-after.json(10-19 11:33 운영에서 다시 읽은 값)·talk 고정 답
// 이어 답하기: .tmp/comment-dm-tone-20261018/live-followup-20261019.png(@1101yuh 시험 계정, 10-19 12:21~12:27)

/** 00·01·08 훅: 같은 질문, 옛 답 → 지금 답. */
export const HOOK = {
  q: '대화 기록은 괜찮나요?',
  oldHead: '아니요',
  oldRest: ', 대화 원문',
  oldPath: '(~/.claude/projects)',
  oldTail: '은 건드리지 않아요. 계정마다 따로 있는 세션 목록 폴더만 똑같이 맞춰요.',
  neuHead: '걱정하지 않으셔도 돼요.',
  neuRest: ' 나누신 대화 내용은 열어 보지도, 바꾸지도, 지우지도 않아요. …',
} as const;

/** 02·03 보낸 DM 목록: 10-18 「세션」 댓글 14건 → 첫 DM 14통. 처음엔 첫 DM 첫 줄, 조용해지는 박에 그 DM의 마지막 줄(꼬리)로. */
export const INBOX_N = 14;
export const FIRST_DM_HEAD = '「세션」 남겨 주셔서 고마워요! 계정을 바꿔도 Claude Code…';
export const FIRST_DM_TAIL = "자동으로 보낸 메시지예요. 그만 받으려면 '중단'이라고…";

/** 04 점검표: 인계 「지금 운영에서 나갈 수 있는 어색한 문구」 1~7 그대로. */
export const CHECKS = ['뜻이 뒤집힘', '차갑게 읽힘', '높임 빠짐', '기계적인 거절', '밀어내거나 무응답', '애매한 답', '어색한 말'] as const;

/** 05 예시 셋(점검표 2·4·5번). old가 null이면 답이 없었다. mark는 말이 인용하는 대목(버터 밑줄). neu는 지금 답 첫 문장. */
export type Example = { check: number; q: string; old: string[] | null; mark?: string; neu: string };
export const EXAMPLES: Example[] = [
  { check: 1, q: '감사합니다', old: ['도움이 되면 좋겠어요 🙌', "그만 받으려면 '중단'이라고 보내 주세요."], mark: '그만 받으려면', neu: '말씀 감사해요! 유용하게 쓰셨으면 좋겠어요 🙌' },
  { check: 3, q: '맥북은요?', old: ['이 질문은 자동 답변에 없어서 바로 답드리기 어려워요. 링크 안의 안내를 먼저 봐 주시고, …'], mark: '답드리기 어려워요', neu: '아쉽게도 지금은 윈도우 PC에서만 쓸 수 있어요. …' },
  { check: 4, q: '에러 떠요 ㅠㅠ', old: null, neu: '불편을 드려 죄송해요. …' },
];

/** 06 이어 답하기(실제 시험 대화). */
export const FOLLOW = [
  { me: true, t: '집 컴퓨터에도 깔면 같이 보여요?' },
  { me: false, t: '아쉽게도 컴퓨터끼리는 이어지지 않아요. 이 도구는 설치한 컴퓨터 안에서만 계정별 세션 목록을 맞추고 …' },
  { me: true, t: '그럼 두 대 다 깔아야 해요?' },
  { me: false, t: '네, 두 컴퓨터 모두에서 계정을 바꿔 가며 쓰신다면 컴퓨터마다 따로 설치해 주셔야 해요. …' },
] as const;

/** 07 안내 자료에 근거 없는 질문의 고정 답(모델 답이 걸러질 때)과 알림 메일 제목(엔진_synkbrief.js 443행). */
export const ESCALATE = '질문 감사해요! 안내 자료에는 없는 내용이라, 직접 확인해서 답드릴게요.';
export const MAIL_SUBJECT = '[SYNK DM] 직접 답할 DM이 있어요';

/** 09 끝 프로필 카드(세션 공유 편과 같은 채널 문구). */
export const PROFILE = {
  handle: '@yuhobuilds',
  name: '유호 · YUHO BUILDS',
  bio: 'AI로 회사를 만드는 과정',
  sub: '직접 만든 결과와 시행착오까지',
} as const;
