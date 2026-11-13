// SYNK SOLIO(싱크 솔리오) — AI 1인기업을 위한 통합 업무 앱. 사업 SHIFT 안의 제품이고 SYNK 플랫폼에서 연다(2026-11-13 유호님 확정).
// PC 런처(desktop/renderer)와 웹 플랫폼(experiences/synk-account, 빌드 사본)이 같이 쓰는 글 · 경로만 둔다. 화면은 각자 그린다.
// 쓸 수 있는 기능(AI 구독 관리 — 옛 회원 혜택 「AI 구독 계정판」)과 준비 중인 것(백업·복구)을 나눠 적고, 준비 중인 것에는
// 설치 · 다운로드 · 신청 · 결제 같은 행동을 두지 않는다(백업 상태 근거: experiences/solo-backup-rust/ROADMAP.md 1절, 11-12 0.5.0을 끔).
// 웹 공개본 묶음은 바뀐 조각만 얹으므로(qa/solio-20261113) 이 파일의 최상위 이름은 모두 solio · SOLIO로 시작한다(묶음 안 다른 이름과 겹치지 않게).

export const SOLIO = Object.freeze({
  id: 'solio', name: 'SYNK SOLIO', koName: '싱크 솔리오', menu: '솔리오', tagline: 'AI 1인기업을 위한 통합 업무 앱',
  asset: 'solio-object.webp', alt: '계기판 · 자물쇠 구름 · 연필이 꽂힌 청금석 펠트 공구 바구니',
  summary: '혼자 하는 사업에 필요한 도구를 한곳에 모아요. 지금은 AI 구독 관리를 쓸 수 있고, 백업·복구는 준비하고 있어요.',
  homeLine: '혼자 하는 사업에 필요한 도구를 한곳에 모아요.',
});

// 탭(밑줄 글자 탭) — 홈 · 백업·복구 · AI 구독 관리. 모르는 값은 홈.
export const SOLIO_SECTIONS = Object.freeze([['home', '홈'], ['backup', '백업·복구'], ['subscriptions', 'AI 구독 관리']]);
export const solioSection = value => SOLIO_SECTIONS.some(([id]) => id === value) ? value : 'home';

// AI 구독 관리: PC 앱 기능 · 무료 조건 · 이 PC 저장은 옛 「AI 구독 계정판」 그대로다(desktop/renderer/subscriptions.mjs · src/ai-subscriptions.cjs).
export const SOLIO_SUBSCRIPTIONS = Object.freeze({
  id: 'subscriptions', name: 'AI 구독 관리', formerName: 'AI 구독 계정판',
  kicker: 'AI 구독 남은 양·결제일',
  headline: 'AI 구독마다 이번 주에 남은 양을 보여 줘요.',
  description: '연결한 AI 계정의 남은 사용량과 다시 채워지는 시각을 보고, 결제일과 구독료도 함께 챙겨요.',
  statusLabel: 'PC 앱 · 회원 무료',
  asset: 'benefit-subscriptions.webp',
  alt: '남은 양을 가리키는 바늘이 달린 반원 펠트 계기판',
  steps: Object.freeze([
    Object.freeze({ title: '지금 쓸 계정부터', body: '서비스마다 남은 게 가장 많은 계정을 먼저 보여 주고, 다 쓴 계정이 언제 풀리는지 가까운 순서로 알려 줘요.' }),
    Object.freeze({ title: '한 번 눌러 전부 확인', body: '이 PC에 연결한 여러 계정을 공식 프로그램으로 한꺼번에 읽어요. 계정마다 로그아웃했다 다시 들어갈 필요가 없어요.' }),
    Object.freeze({ title: '처음 연결은 따라 하기만', body: '설치 확인부터 로그인까지 단계마다 알려 줘요. 토큰 파일은 열지 않고, 각 서비스가 공식으로 알려 주는 숫자만 모아요.' }),
  ]),
  availability: 'SYNK ID로 로그인한 회원이 PC 앱에서 무료로 써요. 자동으로 읽을 계정은 해당 서비스의 공식 프로그램을 PC에 설치하거나 API 키를 넣어 연결해요. 자동 확인을 지원하지 않는 서비스도 구독료와 결제일을 직접 기록할 수 있어요. 기록은 이 PC에만 저장해요.',
  // 웹 안내: 새 판은 「솔리오 → AI 구독 관리」, 0.4.88 이하 이전 판은 「회원 혜택 → AI 구독 계정판」이라 두 판 모두 실제 이름으로 적는다.
  pcEntry: '이미 PC 앱이 있으면 PC 앱 위 메뉴 「솔리오」 → 「AI 구독 관리」에서 열어요. 이전 판에서는 「회원 혜택」 → 「AI 구독 계정판」에서 열어요.',
});

export const SOLIO_BACKUP = Object.freeze({
  id: 'backup', name: '백업·복구', statusLabel: '준비 중',
  headline: '업무 파일을 암호화해 백업하고 새 PC에서 되살리는 기능이에요.',
  rows: Object.freeze([
    Object.freeze(['무엇인가요', '업무 파일을 암호화해 클라우드에 백업하고, 새 PC에서 그대로 되살리는 기능을 만들고 있어요.']),
    Object.freeze(['지금 상태', 'SYNK 안에서 개발하고 검증하는 단계예요. 설치 파일과 요금은 아직 공개하지 않았어요.']),
    Object.freeze(['열리면', '이 자리에서 바로 쓸 수 있게 열어요. 그 전에는 따로 신청하거나 내려받을 것이 없어요.']),
  ]),
});

// 옛 회원 혜택 경로(저장된 PC 마지막 화면 · 뒤로 가기 기록 · 웹 #benefits/… 주소 · 옛 단추)를 새 자리로 잇는다.
export const SOLIO_LEGACY_BENEFITS = Object.freeze({
  insight: Object.freeze({ view: 'insight', hash: '#account/insight' }),
  subscriptions: Object.freeze({ view: 'solio', section: 'subscriptions', hash: '#solio/subscriptions' }),
});
export function solioMigrateRoute(route) {
  const moved = route?.view === 'benefits' && typeof route.benefitId === 'string' && Object.hasOwn(SOLIO_LEGACY_BENEFITS, route.benefitId) ? SOLIO_LEGACY_BENEFITS[route.benefitId] : null;
  if (!moved) return route;
  return { ...route, view: moved.view, benefitId: null, ...(moved.section ? { section: moved.section } : {}), scroll: 0, pageScroll: 0 };
}

// 찾기: PC 라이브러리 검색칸 · PC 명령 메뉴 · 웹 둘러보기 검색이 같이 쓴다. 옛 이름(계정판 · 회원 혜택)으로 찾아도 새 자리가 나온다.
export const SOLIO_SEARCH = Object.freeze([
  Object.freeze({ id: 'solio', title: '솔리오', where: 'SYNK SOLIO · AI 1인기업을 위한 통합 업무 앱', route: Object.freeze({ view: 'solio', section: 'home' }), hash: '#solio', words: '솔리오 solio 싱크 솔리오 1인 사업 1인기업 혼자 업무 도구 shift 시프트' }),
  Object.freeze({ id: 'solio-subscriptions', title: 'AI 구독 관리', where: '솔리오 · PC 앱 · 회원 무료', route: Object.freeze({ view: 'solio', section: 'subscriptions' }), hash: '#solio/subscriptions', words: 'ai 구독 계정판 구독 계정 사용량 남은 양 한도 초기화 결제일 구독료' }),
  Object.freeze({ id: 'solio-backup', title: '백업·복구', where: '솔리오 · 준비 중', route: Object.freeze({ view: 'solio', section: 'backup' }), hash: '#solio/backup', words: '백업 복구 되살리기 새 pc 암호화 클라우드' }),
  Object.freeze({ id: 'insight', title: '내 성향', where: '내 계정 · 맞춤 정보', route: Object.freeze({ view: 'insight' }), hash: '#account/insight', words: '성향 내 성향 맞춤 맞춤 정보 관심사 도움 방식 배우는 이유 학습 기록' }),
  Object.freeze({ id: 'care', title: '플레저', where: '회원 혜택', route: Object.freeze({ view: 'benefits', benefitId: 'care' }), hash: '#benefits/care', words: '플레저 회원 혜택 경조사 생일 음력 기념일 연락 안부 장부 마음' }),
]);
export function solioSearch(query = '') {
  const term = String(query).trim().toLocaleLowerCase('ko');
  if (!term) return [];
  return SOLIO_SEARCH.filter(item => [item.title, item.where, item.words].join(' ').toLocaleLowerCase('ko').includes(term));
}
