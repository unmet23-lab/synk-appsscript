'use strict';
/* Prism 산출 계약 — 분모와 주장 범위가 비어 있는 분포를 받지 않는다.
 * 학생행 검사는 출처·키출처의 흔한 무늬 넷만 막는다. 목록 밖의 경로
 * (예: git/student_rows.json)는 못 잡으므로 학생 데이터 부재의 증명이 아니다.
 * 판·대상·과업·조건·기간은 비어 있는지만 잰다. 형식·대표성·최소 표본은
 * 판정하지 않으며, 칸을 채웠다는 사실이 일반 분포라는 주장을 보증하지 않는다.
 * 대상은 집단 이름이다. 독립수·편중은 백엔드에서 식별자로 계산한 파생 수이며,
 * 이 계약은 학생 식별자를 요구하거나 산출에 담도록 허용하지 않는다.
 */

const 갈래들 = new Set(['학생', '학부모', '강사', '내부']);
const 채운문자열 = (값) => typeof 값 === 'string' && 값.trim().length > 0;

function 검증(행, 옵션) {
  if (행 === null || typeof 행 !== 'object' || Array.isArray(행)) {
    return { 통과: false, 사유: ['행없음'] };
  }

  // 아래 검사 순서가 곧 계약의 사유 순서다. 같은 사유는 한 번만 붙인다.
  const 사유 = [];
  if (행.값 === undefined) 사유.push('값없음');
  if (!Number.isFinite(행.n) || 행.n < 0) 사유.push('n없음');
  if (!Number.isFinite(행.분모) || 행.분모 <= 0) 사유.push('분모없음');
  for (const 칸 of ['판', '출처', '키출처', '대상', '과업', '조건', '기간']) {
    if (!채운문자열(행[칸])) 사유.push(`${칸}없음`);
  }

  const 독립수정상 = Number.isFinite(행.독립수) && Number.isInteger(행.독립수) && 행.독립수 >= 0;
  if (!독립수정상) {
    사유.push('독립수없음');
  } else if (행.독립수 === 0
    ? 행.편중 !== null
    : !Number.isFinite(행.편중) || 행.편중 < 0 || 행.편중 > 1) {
    사유.push('편중없음');
  }

  if ([행.출처, 행.키출처].some((값) => typeof 값 === 'string' && /student_id|learner_id|profiles|이름/i.test(값))) {
    사유.push('학생행');
  }

  // 옵션 생략만 기본 동작이다. 갈래가 없는 옵션이나 잘못된 옵션은 거절한다.
  const 갈래 = 옵션?.갈래;
  if (갈래 === '학생' || 갈래 === '학부모') {
    if ([행.값, 행.설명, 행.라벨].some((값) => typeof 값 === 'string' && /평균|일반|다른 학생/.test(값))) {
      사유.push('대조낱말');
    }
  } else if (옵션 !== undefined && !갈래들.has(갈래)) {
    사유.push('갈래모름');
  }
  return { 통과: 사유.length === 0, 사유 };
}

module.exports = { 검증 };
