'use strict';
/**
 * synk.im 방문 기록이 보내는 값의 목록(2026-11-17).
 * 사이트 쪽의 세기 코드(SYNK-website site-v10/visit-count.js)가 보내는 글과 한 글자도 다르면 안 된다.
 * 사이트 쪽을 고치면 이 목록과 시험(tests/사이트방문.test.js 「값 목록」)을 같이 고친다.
 * 설계: docs/마케팅/사이트방문_분석/설계.md 1절.
 */

const 기록 = Object.freeze({ 들어옴: '들어옴', 떠남: '떠남', 누름: '누름' });

const 쪽언어 = Object.freeze(['한국어 쪽', '영어 쪽', '몽골어 쪽']);

/** 들어온 곳 → 솔리오의 다섯 갈래. SYNK 안은 갈래가 없다(사이트 안을 옮겨 다닌 것). */
const 갈래표 = Object.freeze({
  직접: '직접',
  검색: '검색',
  'AI 답변': 'AI 답변',
  인스타그램: 'SNS', 유튜브: 'SNS', 틱톡: 'SNS', 스레드: 'SNS', 페이스북: 'SNS', X: 'SNS', 링크드인: 'SNS', 블로그: 'SNS',
  '다른 사이트': '다른 사이트',
  'SYNK 안': null,
});
const 갈래차례 = Object.freeze(['검색', 'SNS', 'AI 답변', '직접', '다른 사이트']);

/** 들어온 곳 이름 — 검색과 AI 답변일 때만 온다(사이트 쪽 SEARCH_HOSTS · AI_HOSTS · AI_TAGS의 이름과 같다). */
const 들어온곳이름 = Object.freeze(['구글', '네이버', '빙', '다음', '그 밖의 검색', 'ChatGPT', '퍼플렉시티', 'Gemini', 'Copilot', 'Claude', '그록']);

/** 새로 고침이나 뒤로·앞으로로 다시 불러온 들어옴 — 사람 방문에서 뺀다(11-17 Fable 설계 검토 P1-1). */
const 다시연쪽 = Object.freeze(['새로 고침', '뒤로·앞으로']);

/** 꼬리표 글자 규칙(사이트 쪽 fromTag와 같다) */
const 꼬리표꼴 = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** 문의 · 앱 받기 비율은 사람 방문이 이 수를 넘을 때만 보인다 — 방문이 적으면 한 사람의 손놀림이 큰 비율로 보인다(검토 P2-7). */
const 비율기준 = 30;

const 기기 = Object.freeze(['휴대폰', '컴퓨터·태블릿']);

/** 차례가 있는 구간 — 가운데 구간을 셀 때 이 차례를 쓴다. */
const 머문시간 = Object.freeze(['10초 아래', '10~30초', '30초~1분', '1~3분', '3~10분', '10분 넘음']);
const 내려본곳 = Object.freeze(['4분의 1 아래', '절반 아래', '4분의 3 아래', '끝 앞', '끝까지']);
const 다음 = Object.freeze({ 안: '사이트 안 다른 쪽', 바깥링크: '바깥 링크', 떠남: '화면을 떠남' });

const 누른것 = Object.freeze([
  '문의 메일', '문의 메일 주소 복사', '문의 양식', '광고 의뢰', '광고 예시 보기',
  '앱 받기(Windows)', '앱 받기(Mac)', '웹 플랫폼 열기', 'WORLD 열기', '체험 열기', 'SNS 채널', '다른 바깥 링크',
]);
const 문의묶음 = Object.freeze(['문의 메일', '문의 메일 주소 복사', '문의 양식', '광고 의뢰']);
const 앱받기묶음 = Object.freeze(['앱 받기(Windows)', '앱 받기(Mac)']);

/** 셈에서 빼는 꼬리표 — 우리 시험과 기능 점검(사이트 쪽은 self · qa를 아예 보내지 않는다). */
const 뺄꼬리표 = Object.freeze(['qa', 'self', 'launch-check']);

/** 쪽 경로 → 솔리오에 보일 이름. 모르는 경로는 경로 그대로 보인다. */
const 쪽이름표 = Object.freeze({
  '/': '홈', '/lab/': 'LAB', '/shift/': 'SHIFT', '/pulse/': 'PULSE', '/path/': 'PATH', '/atlas/': '아틀라스', '/founder/': '창업자',
  '/mn/': '몽골어 홈',
});
function 쪽이름(쪽) {
  const p = String(쪽 || '');
  if (쪽이름표[p]) return 쪽이름표[p];
  if (p === '/en/') return '영어 홈';
  if (p.startsWith('/en/') && 쪽이름표[p.slice(3)]) return `영어 ${쪽이름표[p.slice(3)]}`;
  return p || '다른 쪽';
}

module.exports = { 기록, 쪽언어, 갈래표, 갈래차례, 들어온곳이름, 다시연쪽, 꼬리표꼴, 비율기준, 기기, 머문시간, 내려본곳, 다음, 누른것, 문의묶음, 앱받기묶음, 뺄꼬리표, 쪽이름표, 쪽이름 };
