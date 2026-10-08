// 입장 검사 — 안내 목소리(나레이션) 원고와 첫 근무 연수 단계.
// 소리 파일은 art-source/voice.mjs가 이 원고와 content.mjs의 손님 대사로 한 번 구워 assets/voice/에 둔다(접속마다 AI를 부르지 않는다).
// 안내문 규칙은 읽기 연습 대상이라 목소리로 읽어 주지 않는다. 알림도 '왔다'는 것만 말한다.

/** 근무 전 안내: 화면의 안내 카드 글(venue.briefing) 앞에 근무지 이름을 붙여 읽는다. */
export const BRIEF_LEAD = {
  pool: '하늘 수영장이에요.',
  library: '별빛 도서관이에요.',
  museum: '바람 미술관이에요.',
  concert: '노을 공원 음악회예요.',
};

export const MEMO_LINE = '새 알림이 왔어요! 안내문 아래에 붙으니까 꼭 읽어 봐요.';

export const RESULT_LINES = [
  '괜찮아요, 오늘은 연습한 날이에요. 놓친 손님을 다시 만나 봐요.',
  '근무 끝! 오늘도 수고했어요.',
  '좋은 근무였어요! 다음 근무지도 기대돼요.',
  '완벽한 근무였어요! 모든 손님을 바르게 맞이했어요.',
];

/**
 * 첫 근무 연수(하늘 수영장, 첫 손님 pool-01 김보리 · 둘째 손님 pool-02 나구리).
 * target: 비출 곳(CSS 선택자). wait: 사용자가 해야 할 조작(없으면 '다음' 단추). guest: 이 단계가 나오는 손님 순번(0부터).
 * reveals: 이 단계를 본 손님은 답을 들은 것이다 — 연수를 건너뛰고 도장을 찍어도 '답 도움'으로 기록한다.
 */
export const TUTORIAL = [
  { id: 'tut-guest', guest: 0, target: '.window', text: '첫 손님이 왔어요! 먼저 손님이 하는 말을 읽어 봐요.' },
  { id: 'tut-notice', guest: 0, target: '#notice', text: '이게 오늘의 안내문이에요. 손님이 지켜야 할 규칙이 세 개 있어요.' },
  { id: 'tut-papers', guest: 0, target: '.papers', text: '손님이 보여 준 표와 짐이에요. 안내문과 하나씩 맞춰 봐요.' },
  { id: 'tut-pass', guest: 0, target: '#btn-pass', wait: 'pass', reveals: true, text: '보리 씨는 수영 모자가 있고 음식은 없어요. 규칙을 다 지켰으니까 통과를 눌러요.' },
  { id: 'tut-why', guest: 0, target: '#feedback', wait: 'next', text: '맞았어요! 왜 맞았는지는 여기에서 읽을 수 있어요. 이제 다음 손님을 눌러요.' },
  { id: 'tut-tray', guest: 1, target: '.tray', reveals: true, text: '이번에는 구리 씨의 짐을 봐요. 어? 김밥이 있네요.' },
  { id: 'tut-rule', guest: 1, target: '#notice .rule[data-rule="food"]', reveals: true, text: '안내문의 두 번째 규칙을 봐요. 음식은 가지고 들어갈 수 없어요.' },
  { id: 'tut-reject', guest: 1, target: '#btn-reject', wait: 'reject', reveals: true, text: '규칙을 하나라도 어기면 거절이에요. 거절을 눌러요.' },
  { id: 'tut-choose', guest: 1, target: '#notice .rule[data-rule="food"]', wait: 'rule:food', reveals: true, text: '왜 거절하는지 골라요. 두 번째 규칙을 눌러요.' },
  { id: 'tut-why2', guest: 1, target: '#feedback', wait: 'next', text: '잘했어요! 거절할 때는 이렇게 이유도 같이 골라요. 다음 손님을 눌러요.' },
  { id: 'tut-hint', guest: 2, target: '#btn-hint', text: '잘 모르겠으면 돋보기를 눌러요. 어디를 봐야 하는지 노랗게 알려 줘요.' },
  { id: 'tut-free', guest: 2, target: null, text: '이제 혼자 해 볼 차례예요. 시간은 넉넉하니까 천천히 읽어요.' },
];
export const TUTORIAL_CASES = ['pool-01', 'pool-02'];

/** 소리 파일 이름(목소리 굽기와 화면이 같은 이름을 쓴다). */
export const VOICE_ID = {
  line: (caseId) => `line-${caseId}`,
  reply: (caseId) => `reply-${caseId}`,
  thanks: (who) => `thanks-${who}`,
  why: (who) => `why-${who}`,
  oops: (caseId) => `nar-oops-${caseId}`,
  brief: (venueId) => `nar-brief-${venueId}`,
  memo: () => 'nar-memo',
  result: (stars) => `nar-result-${stars}`,
  tutorial: (stepId) => `nar-${stepId}`,
};
export const GENERIC_THANKS = '고마워요!';
export const GENERIC_WHY = '네? 왜요?';
