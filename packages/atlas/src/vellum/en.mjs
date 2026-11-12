// 영어 줄 — 보통 눈높이 · 기능 글(말하는 사람 default). WORLD 짧은 연습(4-1)에 보이는 종류만(문항 위 이유 · 판 끝 문장).
// 세 겹 대조(11-11): 아르곤 문법 · flash와 Opus 직역 역번역에서 뜻이 원문과 같다 — 처음 초안의 「meet」(만나다 직역)은 「try · review ·
// back」으로 고쳤다. 셋째 겹 Fable은 4-1 화면 검수의 최종에서. 철자는 앱 영어 표의 이웃 줄을 따른다(이 흐름은 Practice).
// 학습 대상의 한국어 이름은 영어 따옴표 ‘…’ 안에 그대로 둔다 — 화면 글 표에서 한국어 학습 내용이 값으로 드는 줄(홈 추천 이유 등)과
// 같은 꼴이다(11-12 Fable 5.2 화면 최종 F5 — 낫표는 한국어 화면만). 홈 · 활동 고르기 문장(host.* · goal.match)은 그 화면(4-3)에서 더한다.
const days = n => `${n} ${n === 1 ? 'day' : 'days'}`;
const times = n => `${n} ${n === 1 ? 'time' : 'times'}`;
const one = sentence => ({ standard: { default: [sentence] } });

const retry = (s, name) =>
  s.other
    ? `You just missed ‘${name}’ — let’s try it again in a different question.`
    : `You just missed ‘${name}’ — let’s try it one more time.`;

// 같은 하루(days 0)에 돌아오면 날 수를 말하지 않는다(Fable 5.2 끝 판 F4).
const shaky = (s, name) => {
  if (!s.days)
    return s.reviews === 1
      ? `You missed ‘${name}’ earlier today — here it is again.`
      : `‘${name}’: missed ${s.misses} out of ${times(s.reviews)}. Back again today.`;
  return s.reviews === 1
    ? `You missed ‘${name}’ last time — it’s back after ${days(s.days)}.`
    : `‘${name}’: missed ${s.misses} out of ${times(s.reviews)}. Back after ${days(s.days)}.`;
};

export const EN = Object.freeze({
  'unit.retry': one(retry),
  'unit.shaky': one(shaky),
  'unit.due': one((s, name) =>
    s.days
      ? `It’s been ${days(s.days)} since you last saw ‘${name}’. Let’s review it once more before it fades.`
      : `You saw ‘${name}’ earlier today. Let’s review it once more before it fades.`,
  ),
  'unit.new': one((_, name) => `Seeing ‘${name}’ for the first time.`),
  'skill.up': one(
    (s, name) =>
      `${name}: you got it right on your own ${times(s.streak)} in a row. Let’s step it up a level.`,
  ),
  'skill.ease': one(
    (_, name) =>
      `${name}: let’s build this skill back up, starting with something a little easier.`,
  ),
  'pace.breather': one(
    (s, name) =>
      `You missed ${s.misses} in a row. Let’s catch our breath with ‘${name}’, one you know well.`,
  ),
  idle: one(
    () => 'You’ve covered everything due for review today. Let’s keep things light from here.',
  ),
  'day.capped': one(() => 'That’s it for today. We’ll save the rest for tomorrow.'),
  'pace.stubborn': one(
    () =>
      // 끈질긴 단위는 여러 날에 걸친 표시다 — 「this round」를 「kept missing」에 붙이면 「이번 판에서 자꾸 놓친 말」로 읽혀(이번 판에 한 문항만
      // 냈고 맞혔어도 나온다) 현재형 · 판 쪽으로 옮겼다(Fable 5.2 끝 판 넘친 #16 — 한국어 원문 「자꾸 놓치는 말은 이번 판에 여기까지」).
      'That’s it for this round on the expressions you keep missing. Next round, we’ll try them a different way.',
  ),
});
