// 시작 난도. 주소로 정한 판(level=busy, 시험 · 다시 보기) > 학생이 고른 난도 > 앱이 넘긴 시험 목표 급(3급 이상이면 바쁜 아침).
// 능력 판단이 아니라 어디서 시작할지만 정한다. 입구에서 언제든 바꾼다.
// core.mjs에 두면 새 app.mjs가 캐시에 남은 옛 core.mjs의 없는 이름을 불러 10분 동안 게임이 안 열린다(import 엇갈림). 그래서 새 파일이다.
export const startLevel = ({ forced = null, saved = null, grade = null } = {}) => forced === 'busy' ? 'busy' : saved === 'busy' || saved === 'basic' ? saved : Number(grade) >= 3 ? 'busy' : 'basic';
