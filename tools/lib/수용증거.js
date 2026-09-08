'use strict';

// 의미 판정은 모델, 누락·중복·미확인은 도구가 판정한다.
// 기존 발주/스키마와 호환되도록 원문을 키로 쓴다. 줄바꿈·바깥 공백만 정규화한다.
function 기준키(s) { return typeof s === 'string' ? s.replace(/\r\n/g, '\n').trim() : ''; }

function 수용검사(기준들, 응답) {
  const 기준 = (기준들 || []).map(기준키);
  const 항목 = 응답 && Array.isArray(응답.항목) ? 응답.항목 : [];
  const 문제 = [];
  if (!기준.length || 기준.some((k) => !k) || new Set(기준).size !== 기준.length) 문제.push('발주 기준이 비었거나 중복됐다');
  if (!응답 || 응답.확인불가 || !Array.isArray(응답.항목)) 문제.push('수용 응답을 확인하지 못했다');
  const 본것 = new Set();
  const 미충족 = [], 미확인 = [];
  let 충족수 = 0;
  for (const x of 항목) {
    const k = 기준키(x && x.기준);
    if (!기준.includes(k)) { 문제.push('발주에 없는 기준을 판정했다'); continue; }
    if (본것.has(k)) { 문제.push('같은 기준을 중복 판정했다'); continue; }
    본것.add(k);
    if (!x || !['충족', '미충족', '확인불가'].includes(x.판정) || !기준키(x.근거)) {
      문제.push('판정 또는 근거가 없거나 잘못됐다');
      continue;
    }
    if (x.판정 === '충족') 충족수++;
    else if (x.판정 === '미충족') 미충족.push(x);
    else 미확인.push(x);
  }
  const 누락 = 기준.filter((k) => !본것.has(k));
  if (누락.length) 문제.push(`기준 ${누락.length}/${기준.length}개를 판정하지 않았다`);
  const 확인불가 = !!(문제.length || 미확인.length);
  return { 기준수: 기준.length, 충족수, 미충족, 미확인, 누락, 문제: [...new Set(문제)], 확인불가,
    완료: !확인불가 && !미충족.length && 충족수 === 기준.length };
}

// 실제 완료 분기와 회귀 시험이 같은 판정 함수를 사용한다.
function 완료판정({ 수용, 시험 = [], 차단 = [], sha, 검수생략 = false }) {
  return !!(sha && !검수생략 && 수용 && 수용.완료 && 시험.length && 시험.every((t) => t.통과 === true) && !차단.length);
}

module.exports = { 기준키, 수용검사, 완료판정 };
