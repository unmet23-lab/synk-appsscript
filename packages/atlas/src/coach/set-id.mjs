// 판 번호(제시 · 판 단위 사건의 setId)를 짓고 읽는 한 자리(단계 4 계획 §21-23의 2 — 설계 주인 11-17 답 1). 판 번호의 꼴은 엔진 안의
// 약속이라, 짓는 함수와 읽는 함수를 이 모듈 하나에 둔다 — 꼴을 바꾸면 둘이 함께 바뀐다(판을 여는 openSet은 coach/session.mjs가 setIdOf를 부른다).
//   꼴: set.<게임 이름>.<판을 연 시각(밀리초 정수)>.<코치 꼬리 — 소문자와 숫자 6자>.<그 코치가 연 판의 차례(1부터)>
// 게임 이름에는 점과 줄표가 들 수 있다('world-mock.x'). 그래서 읽기는 뒤 세 마디를 꼴째 맞춰 본 뒤에만 앞을 게임 이름으로 읽고, 꼴에 맞지
// 않으면 null이다(null은 근거가 아니다). 의존이 없는 잎 파일이라 unit 시험이 부르고, 서버 셈(record/first.mjs)도 이것만 부른다.
const PART = '[A-Za-z0-9_:-]+';
// 게임 이름의 꼴 — 사건 검사(record/events.mjs ID)가 받는 글자를 점으로 이은 마디들. 빈 마디 · 앞뒤 점은 없다.
const GAME = new RegExp(`^${PART}(?:\\.${PART})*$`);
const SET_ID = new RegExp(
  `^set\\.(${PART}(?:\\.${PART})*)\\.(0|[1-9][0-9]*)\\.([a-z0-9]{6})\\.([1-9][0-9]*)$`,
);
const GAME_MAX = 80; // 판 번호 전체가 사건 번호 한도(120자) 안에 들게
const SET_MAX = 120;
const TAG_LETTERS = 'abcdefghijklmnopqrstuvwxyz0123456789';

export const isGameId = game =>
  typeof game === 'string' && game.length <= GAME_MAX && GAME.test(game);

// 코치 꼬리 — 같은 게임 이름의 코치 둘이 같은 밀리초에 판을 열어도 번호가 갈린다(Fable 5.2 D9). random은 시험만 준다.
export const coachTag = (random = Math.random) =>
  Array.from({ length: 6 }, () => TAG_LETTERS[Math.floor(random() * 36)]).join('');

export const setIdOf = (gameId, now, tag, seq) => `set.${gameId}.${now}.${tag}.${seq}`;

// 판 번호 → 게임 이름. 꼴이 틀렸거나 글자가 아니면 null.
export function gameOfSet(setId) {
  if (typeof setId !== 'string' || setId.length > SET_MAX) return null;
  const match = SET_ID.exec(setId);
  return match && match[1].length <= GAME_MAX ? match[1] : null;
}

// 판 번호 → 판을 연 시각(코치 시계의 밀리초 — 판을 연 코치의 host.now()). 꼴이 틀렸으면 null(gameOfSet과 같은 꼴 검사).
export const openedAtOfSet = setId =>
  gameOfSet(setId) == null ? null : Number(SET_ID.exec(setId)[2]);
