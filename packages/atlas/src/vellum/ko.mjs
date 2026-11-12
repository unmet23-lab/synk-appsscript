// 한국어 줄 — 보통 눈높이 · 기능 글(말하는 사람 default). 이유 종류마다 문장 틀 하나.
// 틀 = (slots, name, j) → 문장. name은 그 이유가 가리키는 단위 · 능력 · 주제의 화면 이름(낫표 밖), j는 조사(josa.mjs).
// 단위 · 능력 이야기(unit.* · skill.* · pace.* · idle · day.capped)는 단계 2의 reasonLine(reason/ko.mjs)과 같은 문장이다 —
// 다른 것은 받침 뒤의 「으로」 하나다(reasonLine은 「약국」로 — 시험이 이 차이만 허락한다).
// host.* · goal.match는 WORLD의 hostReason(world-learning-plan.mjs)이 쓰던 문장을 옮겼다. host.order(제품 순서)는 문장이 없다.
const retry = (s, name) =>
  s.other
    ? `방금 놓친 「${name}」, 다른 문제로 한 번 더 만나요.`
    : `방금 놓친 「${name}」, 한 번 더 만나요.`;

const shaky = (s, name) =>
  s.reviews === 1
    ? `지난번에 놓친 「${name}」, ${s.days}일 만에 다시 만나요.`
    : `「${name}」 ${s.reviews}번 중 ${s.misses}번 놓쳤어요. ${s.days}일 만에 다시 만나요.`;

// 숙제 상태를 모르면 말하지 않는다(null) — plan.mjs가 review · missed만 싣는 것과 같이, 모르는 상태를 놓친 답 문장으로 짓지 않는다(카본 끝 판 C4).
const homework = (s, name) =>
  s.status === 'review'
    ? `이번 주 숙제예요. 「${name}」 기록이 오래돼 새 문항으로 다시 확인해요.`
    : s.status === 'missed'
      ? `이번 주 숙제예요. 「${name}」에서 놓친 답이 있어 새 문항으로 다시 확인해요.`
      : null;

const one = sentence => ({ standard: { default: [sentence] } });

export const KO = Object.freeze({
  'unit.retry': one(retry),
  'unit.shaky': one(shaky),
  'unit.due': one((s, name) => `「${name}」 본 지 ${s.days}일 됐어요. 잊기 전에 한 번 더 만나요.`),
  'unit.new': one((_, name) => `「${name}」 처음 만나요.`),
  'skill.up': one(
    (s, name) => `「${name}」 ${s.streak}번 이어서 혼자 맞혔어요. 한 단계 올려 볼게요.`,
  ),
  'skill.ease': one((_, name) => `「${name}」 조금 쉬운 것부터 다시 잡아 볼게요.`),
  'pace.breather': one(
    (s, name, j) =>
      `${s.misses}번 이어서 놓쳤어요. 잘 아는 「${name}」${j(`「${name}」`, '으로', '로')} 숨을 고르고 가요.`,
  ),
  idle: one(() => '오늘 돌아온 것은 다 만났어요. 가볍게 이어가요.'),
  'day.capped': one(() => '오늘은 여기까지예요. 남은 것은 내일 만나요.'),
  'pace.stubborn': one(
    () => '자꾸 놓치는 말은 이번 판에 여기까지 만나요. 다음 판에 다른 방법으로 다시 만나요.',
  ),
  'goal.match': one(
    (_, name, j) => `더 배우고 싶다고 알려 준 「${name}」${j(`「${name}」`, '이에요', '예요')}.`,
  ),
  'host.resume': one(
    () => '하던 학습의 같은 자리에서 이어가요. 다른 활동을 골라도 지금 진도는 남아 있어요.',
  ),
  'host.prerequisite': one(() => '한글부터 만나요. 소리를 듣고 글자를 고르며 읽는 법을 익혀요.'),
  'host.homework': one(homework),
  'host.form': one(
    () => '시험처럼 처음 보는 문항을 정해진 시간 안에 풀어 봐요. 점수나 급수로 바꾸지 않아요.',
  ),
  'host.recheck': one(
    () => '이번 주 계획의 다시 확인이에요. 처음 보는 문항으로 지금 위치를 확인해요.',
  ),
  'host.start': one(() => '시험 목표에 맞춰 짧은 진단으로 시작점을 먼저 확인해요.'),
  'host.next': one(() => '생활 팩의 다음 레슨이에요. 아직 기록이 없는 표현을 새로 만나요.'),
});
