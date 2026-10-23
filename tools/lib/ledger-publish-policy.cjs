'use strict';

// 장부를 처음 올릴 때와 운영 사본이 재시도할 때 같은 사용자 손잡이를 따른다.
function holdResult(environment = process.env, explicitRepository = false) {
  const mode = String(environment.SYNK_장부올리기 || '').trim();
  if (mode === '끔') return { 결과: '건너뜀', 이유: 'SYNK_장부올리기=끔' };
  if (mode === '나중') return { 결과: '미룸', 이유: '부른 묶음 실행기가 끝에 한 번 올린다' };
  if (!explicitRepository && environment.NODE_TEST_CONTEXT) return { 결과: '건너뜀', 이유: '시험 안' };
  return null;
}

module.exports = { holdResult };
