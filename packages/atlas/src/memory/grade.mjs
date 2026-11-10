// 답 하나가 기억 단위에 주는 등급(설계 §3-2의 표). 의존이 없어 unit 시험이 바로 부른다.
//   판정 못 함(소리 미전달 · 저장 실패 · 채점 안 함 · 건너뜀) → null(반영 안 함 — 모르는 것은 벌점이 아니다)
//   틀림 · 「모르겠어요」 · 답이나 해설을 본 뒤 맞힘 → again(놓침)
//   힌트를 보고 맞힘 → hard(08-22 「낮은 확신 → Hard」와 같은 뜻)
//   혼자 맞힘: 고르는 꼴 → weak(약한 성공), 만들어 내는 꼴(조립 · 말하기) → good
// Easy는 내지 않는다(걸린 시간 재료가 없다 — 08-22 확정 ⓒ).
export const PRODUCED = Object.freeze(['cup-compose', 'spoken']);
export const GRADES = Object.freeze(['again', 'hard', 'weak', 'good']);

export function gradeOf({
  correct,
  assisted = false,
  answerShown = false,
  unknown = false,
  responseFormat = 'unknown',
  assessable = true,
}) {
  if (!assessable) return null;
  if (unknown) return 'again';
  if (typeof correct !== 'boolean') return null;
  if (!correct || answerShown) return 'again';
  if (assisted) return 'hard';
  return PRODUCED.includes(responseFormat) ? 'good' : 'weak';
}
