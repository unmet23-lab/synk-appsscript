// 이유 문장 — 한국어 기본 말투 한 벌. 단계 4의 문장 표(Vellum: 종류 × 화면 언어 × 눈높이 × 말하는 사람 — 설계 §7)가 이 자리를 넓힌다.
// 지금은 장면 단정(시험)과 시제품이 낸 꼴을 지키려고 둔다. label(단위 · 능력 id) → 화면에 보일 이름.
export function reasonLine(why, label = id => id) {
  const s = why.slots;
  let name = '';
  if (why.code.startsWith('skill.')) name = label(s.skill);
  else if (s.unit) name = label(s.unit);
  switch (why.code) {
    case 'unit.retry':
      return s.other
        ? `방금 놓친 「${name}」, 다른 문제로 한 번 더 만나요.`
        : `방금 놓친 「${name}」, 한 번 더 만나요.`;
    case 'unit.shaky':
      return s.reviews === 1
        ? `지난번에 놓친 「${name}」, ${s.days}일 만에 다시 만나요.`
        : `「${name}」 ${s.reviews}번 중 ${s.misses}번 놓쳤어요. ${s.days}일 만에 다시 만나요.`;
    case 'unit.due':
      return `「${name}」 본 지 ${s.days}일 됐어요. 잊기 전에 한 번 더 만나요.`;
    case 'skill.up':
      return `「${name}」 ${s.streak}번 이어서 혼자 맞혔어요. 한 단계 올려 볼게요.`;
    case 'skill.ease':
      return `「${name}」 조금 쉬운 것부터 다시 잡아 볼게요.`;
    case 'unit.new':
      return `「${name}」 처음 만나요.`;
    case 'pace.breather':
      return `${s.misses}번 이어서 놓쳤어요. 잘 아는 「${name}」로 숨을 고르고 가요.`;
    case 'day.capped':
      return '오늘은 여기까지예요. 남은 것은 내일 만나요.';
    case 'pace.stubborn':
      return '자꾸 놓치는 말은 이번 판에 여기까지 만나요. 다음 판에 다른 방법으로 다시 만나요.';
    default:
      return '오늘 돌아온 것은 다 만났어요. 가볍게 이어가요.';
  }
}
