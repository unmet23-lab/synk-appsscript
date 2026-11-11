// 영어 줄 — 보통 눈높이 · 기능 글(말하는 사람 default). WORLD 짧은 연습(4-1)에 보이는 종류만(문항 위 이유 · 판 끝 문장).
// 세 겹 대조(11-11): 아르곤 문법 · flash와 Opus 직역 역번역에서 뜻이 원문과 같다 — 처음 초안의 「meet」(만나다 직역)은 「try · review ·
// back」으로 고쳤다. 셋째 겹 Fable은 4-1 화면 검수의 최종에서. 앱 영어는 영국식 철자로 통일돼 있다(Practise).
// 「」 안은 학습 대상의 한국어 이름 그대로다. 홈 · 활동 고르기 문장(host.* · goal.match)은 그 화면(4-3)에서 더한다.
const days = n => `${n} ${n === 1 ? 'day' : 'days'}`;
const times = n => `${n} ${n === 1 ? 'time' : 'times'}`;
const one = sentence => ({ standard: { default: [sentence] } });

const retry = (s, name) =>
  s.other
    ? `You just missed 「${name}」 — let’s try it again in a different question.`
    : `You just missed 「${name}」 — let’s try it one more time.`;

const shaky = (s, name) =>
  s.reviews === 1
    ? `You missed 「${name}」 last time — it’s back after ${days(s.days)}.`
    : `「${name}」: missed ${s.misses} out of ${times(s.reviews)}. Back after ${days(s.days)}.`;

export const EN = Object.freeze({
  'unit.retry': one(retry),
  'unit.shaky': one(shaky),
  'unit.due': one(
    (s, name) =>
      `It’s been ${days(s.days)} since you last saw 「${name}」. Let’s review it once more before it fades.`,
  ),
  'unit.new': one((_, name) => `Seeing 「${name}」 for the first time.`),
  'skill.up': one(
    (s, name) =>
      `「${name}」: you got it right on your own ${times(s.streak)} in a row. Let’s step it up a level.`,
  ),
  'skill.ease': one(
    (_, name) =>
      `「${name}」: let’s build this skill back up, starting with something a little easier.`,
  ),
  'pace.breather': one(
    (s, name) =>
      `You missed ${s.misses} in a row. Let’s catch our breath with 「${name}」, one you know well.`,
  ),
  idle: one(
    () => 'You’ve covered everything due for review today. Let’s keep things light from here.',
  ),
  'day.capped': one(() => 'That’s it for today. We’ll save the rest for tomorrow.'),
  'pace.stubborn': one(
    () =>
      'That’s it for the words you kept missing this round. Next round, we’ll try them a different way.',
  ),
});
